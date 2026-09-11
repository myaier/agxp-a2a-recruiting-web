// use后端详情动作 · 控制测试（契约 C 的 S0 + S1 分支）：respond_fact / end_screening 与
// S1 五动作（accept/decline/retry/replace/decide_resume_screening）的业务控制自
// 屏幕/P5/MatchCase详情 的 阶段动作区 原样搬入，命令参数与生命周期逐项对照旧实现：
//   · J-PILOT-01（Spec §7）：S0 respond_fact 不再出输入/提交 —— 白名单摘除后零回答区；
//   · 失败（503）保留草稿可继续编辑；成功才清空；
//   · 回答在飞表契约随 respond_fact 移除（原锁账语义随该路径退役）；
//     在飞中不可能重发第二段草稿；他单在飞不锁本单（按 caseId 记账）；
//   · 换 Case 后旧单迟到回调不能改动新单草稿（局部代际栅栏）；
//   · end_screening 保持二次确认语义：确认前零请求，确认后 决定S0(caseId,'end')，
//     取消零请求；招聘端结束卡零控件（wire 缺 recruiter decisions 臂，fail closed）；
//   · S1（Task 6 迁入）：多份附件按服务端顺序出单选（键→真实文件版本映射在控制层，
//     同名不同版本不串坐标）；单选不默认授权；选定后新建本次 Case 披露确认，正文点名
//     冻结职位与所选文件，consent 字面 true 只在确认动作发出；取消/收层零请求；
//     replace/invitation 每次尝试重跑权威库，空库提示去上传，null 静默返回；
//     重试只取阶段区 typed 附件坐标（无坐标零控件）；通过初筛直发、不合适/婉拒邀请
//     过终结确认；换 Case 清层且迟到的库结果整包作废。
// 夹具走真实 映射P5详情（视图与 raw DTO 同屏同源），不造假视图对象。
// 仓库未装 @testing-library/jest-dom，断言用调用计数与 toBe。

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { use后端详情动作 } from './use后端详情动作';
import type { 后端详情动作输入 } from './use后端详情动作';
import { 映射P5详情 } from '../../数据/MatchCase展示映射';
import type { P5详情正常视图, P5角色, P5动作 } from '../../数据/MatchCase展示映射';
import type { P5阶段区, P5状态视图, P5详情, P5工作区职位, P5简历附件 } from '../../数据/招聘数据源/MatchCase';
import type { BFF附件简历, BFF附件简历库 } from '../../数据/BFF契约';
import type { 简历选择属性, 确认属性, 详情动作卡信息 } from '../../组件/在谈详情/类型';
import { 路径 } from '../../路由/路径表';

// 空附件库跳转 我的简历 走 导航钩子（屏级测试同款 mock；hook 本体在 Router 内运行）
const mock跳转 = vi.fn();
vi.mock('../../路由/导航钩子', () => ({
  use导航: () => ({ 跳转: mock跳转, 返回: vi.fn() }),
}));

// ── 夹具：S0 needs_user 行（human_decision）——想看见 respond_fact/end_screening 卡
//    必须用这一行；补充问题按 viewer 角色匹配（零/多条会被映射层 fail closed）。──

const 冻结职位: P5工作区职位 = {
  jobId: 'job_0123456789abcdef0123456789abcdef',
  job: { title: '平台工程师', location: '上海', publicSalaryRange: '25-40K·16薪', requiredSkills: ['Go'] },
};

function 状态(覆盖: Partial<P5状态视图> = {}): P5状态视图 {
  return {
    caseId: 'mc_a',
    lifecycle: 'open',
    stage: 'anonymous_screening',
    status: 'needs_user',
    step: 'human_decision',
    round: 1,
    roundBudget: 3,
    needsUser: true,
    outcome: null,
    outcomeCode: null,
    createdAt: '2026-09-10T01:00:00Z',
    updatedAt: '2026-09-10T02:00:00Z',
    finalizedAt: null,
    agentAttention: null,
    ...覆盖,
  };
}

function 阶段区组(问题角色: P5角色, 问题ref: string): P5阶段区[] {
  const S0: P5阶段区 = {
    stage: 'anonymous_screening',
    state: 'active',
    occurredAt: '2026-09-10T01:10:00Z',
    summary: 'candidate_reevaluation',
    checklist: [],
    transcript: [
      {
        eventId: 'evt_q1',
        stage: 'anonymous_screening',
        kind: 'supplementary_question',
        role: 问题角色,
        ref: 问题ref,
        text: '每周可以到岗几天？',
        occurredAt: '2026-09-10T01:10:00Z',
      },
    ],
    instructionReceipts: [],
    attachment: null,
    screeningRecords: { messages: [], summaries: [] },
  };
  const 待 = (stage: 'resume_submission' | 'needs_coordination' | 'intent_confirmation'): P5阶段区 => ({
    stage,
    state: 'pending',
    occurredAt: null,
    summary: '',
    checklist: [],
    transcript: [],
    instructionReceipts: [],
    attachment: null,
    screeningRecords: null,
  });
  return [S0, 待('resume_submission'), 待('needs_coordination'), 待('intent_confirmation')];
}

function S0详情DTO(选项: { role?: P5角色; caseId?: string; 问题ref?: string } = {}): P5详情 {
  const 公共 = {
    state: 状态({ caseId: 选项.caseId ?? 'mc_a' }),
    needsAction: true,
    availableActions: ['respond_fact', 'end_screening'] as P5动作[],
    currentCoordination: null,
    intentConfirmations: { candidate: '', recruiter: '' } as const,
    terminalSummary: null,
    conversationRef: null,
  };
  if ((选项.role ?? 'candidate') === 'recruiter') {
    return {
      role: 'recruiter',
      context: { candidateAlias: 'candidate-0123456789ab', job: 冻结职位 },
      stages: 阶段区组('recruiter', 选项.问题ref ?? 'prompt_hr'),
      ...公共,
    };
  }
  return {
    role: 'candidate',
    context: { intentionId: 'int_0123456789abcdef0123456789abcdef', job: 冻结职位 },
    stages: 阶段区组('candidate', 选项.问题ref ?? 'prompt_1'),
    ...公共,
  };
}

function 正常视图(详情: P5详情): P5详情正常视图 {
  const 视图 = 映射P5详情(详情);
  if (视图.kind !== '正常') throw new Error('测试夹具必须是正常视图');
  return 视图;
}

// ── S1 夹具：邀请二卡 / 重试 / 更换 / 初筛结论 各行的详情 DTO（行与动作来自 17 行矩阵）──

/** 32 位十六进制填充（附件库样本 id 与 wire pattern 同形）。 */
function 填充十六(序: number): string {
  return String(序).padEnd(32, '0').slice(0, 32);
}

/** 附件库样本行（parse 用 succeeded / pending 两种，覆盖状态文）。 */
function 附件库行(序: number, 覆盖: Partial<BFF附件简历> = {}): BFF附件简历 {
  return {
    file_id: `rf_${填充十六(序)}`,
    display_name: `简历_v${序}.pdf`,
    revision: 1,
    current_version: {
      version_id: `rfv_${填充十六(序)}`,
      version: 1,
      size_bytes: 2048,
      media_type: 'application/pdf',
      sha256: '0'.repeat(64),
      created_at: '2026-08-29T00:00:00Z',
      parse: { status: 'succeeded', parse_id: `rp_${序}`, updated_at: '2026-08-29T00:00:00Z' },
    },
    created_at: '2026-08-29T00:00:00Z',
    updated_at: '2026-08-29T00:00:00Z',
    ...覆盖,
  };
}

function 附件库(条数: number, 覆盖行: Record<number, Partial<BFF附件简历>> = {}): BFF附件简历库 {
  return {
    items: Array.from({ length: 条数 }, (_, 下标) => 附件库行(下标 + 1, 覆盖行[下标 + 1])),
    limits: { max_files: 5, max_file_bytes: 10485760, accepted_media_types: ['application/pdf'] },
  };
}

/** 候选人自己已绑定的 S1 附件（重试卡的 typed 坐标唯一来源）。 */
const 绑定附件: P5简历附件 = {
  fileId: 'rf_00000000000000000000000000000007',
  fileVersionId: 'rfv_00000000000000000000000000000007',
  displayName: '后端工程师_简历_v1.pdf',
};

/** S1 阶段区组：S0 passed + S1 active（可选 typed 附件）+ 其余 pending。 */
function S1阶段区组(附件: P5简历附件 | null): P5阶段区[] {
  const 待 = (stage: 'needs_coordination' | 'intent_confirmation'): P5阶段区 => ({
    stage, state: 'pending', occurredAt: null, summary: '', checklist: [], transcript: [],
    instructionReceipts: [], attachment: null, screeningRecords: null,
  });
  return [
    {
      stage: 'anonymous_screening', state: 'passed', occurredAt: '2026-09-10T01:10:00Z',
      summary: '匿名初筛已通过', checklist: [], transcript: [], instructionReceipts: [],
      attachment: null, screeningRecords: null,
    },
    {
      stage: 'resume_submission', state: 'active', occurredAt: '2026-09-10T01:30:00Z',
      summary: '简历已提交，等待校验', checklist: [], transcript: [], instructionReceipts: [],
      attachment: 附件, screeningRecords: null,
    },
    待('needs_coordination'),
    待('intent_confirmation'),
  ];
}

/** S0 passed 行（候选）：邀请二卡（accept/decline）。 */
function S0邀请详情DTO(caseId = 'mc_a'): P5详情 {
  return {
    role: 'candidate',
    context: { intentionId: 'int_0123456789abcdef0123456789abcdef', job: 冻结职位 },
    state: 状态({ caseId, stage: 'anonymous_screening', status: 'passed', step: 'awaiting_candidate_resume_invitation', needsUser: false }),
    needsAction: true,
    availableActions: ['accept_resume_invitation', 'decline_resume_invitation'],
    stages: S1阶段区组(null).map((区) => 区.stage === 'anonymous_screening'
      ? { ...区, summary: '匿名初筛已通过，等待候选人回应简历邀请' }
      : 区.stage === 'resume_submission' ? { ...区, state: 'pending' as const, occurredAt: null, summary: '', attachment: null } : 区),
    currentCoordination: null,
    intentConfirmations: { candidate: '', recruiter: '' },
    terminalSummary: null,
    conversationRef: null,
  };
}

/** S1 waiting 行（候选）：重试卡；带绑定 = 阶段区有 typed 附件。 */
function S1重试详情DTO(带绑定: boolean, caseId = 'mc_a'): P5详情 {
  return {
    role: 'candidate',
    context: { intentionId: 'int_0123456789abcdef0123456789abcdef', job: 冻结职位 },
    state: 状态({ caseId, stage: 'resume_submission', status: 'waiting', step: 'awaiting_resume_parse', needsUser: false }),
    needsAction: true,
    availableActions: ['retry_resume_readiness'],
    stages: S1阶段区组(带绑定 ? 绑定附件 : null),
    currentCoordination: null,
    intentConfirmations: { candidate: '', recruiter: '' },
    terminalSummary: null,
    conversationRef: null,
  };
}

/** S1 needs_user 行（候选）：重试 + 更换二卡。 */
function S1更换详情DTO(caseId = 'mc_a'): P5详情 {
  return {
    role: 'candidate',
    context: { intentionId: 'int_0123456789abcdef0123456789abcdef', job: 冻结职位 },
    state: 状态({ caseId, stage: 'resume_submission', status: 'needs_user', step: 'awaiting_resume_parse' }),
    needsAction: true,
    availableActions: ['retry_resume_readiness', 'replace_resume'],
    stages: S1阶段区组(绑定附件),
    currentCoordination: null,
    intentConfirmations: { candidate: '', recruiter: '' },
    terminalSummary: null,
    conversationRef: null,
  };
}

/** S1 needs_user 行（招聘）：初筛结论卡。 */
function S1初筛详情DTO(caseId = 'mc_hr'): P5详情 {
  return {
    role: 'recruiter',
    context: { candidateAlias: 'candidate-0123456789ab', job: 冻结职位 },
    state: 状态({ caseId, stage: 'resume_submission', status: 'needs_user', step: 'awaiting_recruiter_decision', needsUser: true }),
    needsAction: true,
    availableActions: ['decide_resume_screening'],
    stages: S1阶段区组(null),
    currentCoordination: null,
    intentConfirmations: { candidate: '', recruiter: '' },
    terminalSummary: null,
    conversationRef: null,
  };
}

// ── S2/S3 夹具（Task 8 迁入）：typed 协同块 / 本端意向词是这两个阶段唯一的坐标，
//    展示视图不带这两个字段，判定只能吃 raw 详情。──

const 协同问题ID = 'iss_0123456789abcdef0123456789abcdef';
type 协同块形 = NonNullable<P5详情['currentCoordination']>;

function 协同块(覆盖: Partial<协同块形> = {}): 协同块形 {
  return {
    issueId: 协同问题ID,
    kind: 'work_mode',
    requiredRoles: ['candidate', 'recruiter'],
    candidateDecided: false,
    recruiterDecided: false,
    ...覆盖,
  };
}

/** S2 needs_user 行（双端）：协同卡；S0/S1 passed、needs_coordination active。 */
function S2详情DTO(角色: P5角色, 协同: P5详情['currentCoordination'], caseId = 'mc_a'): P5详情 {
  const 阶段们: P5阶段区[] = [
    { stage: 'anonymous_screening', state: 'passed', occurredAt: '2026-09-10T01:10:00Z', summary: '匿名初筛已通过', checklist: [], transcript: [], instructionReceipts: [], attachment: null, screeningRecords: null },
    { stage: 'resume_submission', state: 'passed', occurredAt: '2026-09-10T01:30:00Z', summary: '简历初筛已通过', checklist: [], transcript: [], instructionReceipts: [], attachment: null, screeningRecords: null },
    { stage: 'needs_coordination', state: 'active', occurredAt: '2026-09-10T02:00:00Z', summary: 'coordinating', checklist: [], transcript: [], instructionReceipts: [], attachment: null, screeningRecords: null },
    { stage: 'intent_confirmation', state: 'pending', occurredAt: null, summary: '', checklist: [], transcript: [], instructionReceipts: [], attachment: null, screeningRecords: null },
  ];
  return 角色 === 'candidate'
    ? {
        role: 'candidate',
        context: { intentionId: 'int_0123456789abcdef0123456789abcdef', job: 冻结职位 },
        state: 状态({ caseId, stage: 'needs_coordination', status: 'needs_user', step: 'coordinating' }),
        needsAction: true,
        availableActions: ['decide_coordination'],
        stages: 阶段们,
        currentCoordination: 协同,
        intentConfirmations: { candidate: '', recruiter: '' },
        terminalSummary: null,
        conversationRef: null,
      }
    : {
        role: 'recruiter',
        context: { candidateAlias: 'candidate-0123456789ab', job: 冻结职位 },
        state: 状态({ caseId, stage: 'needs_coordination', status: 'needs_user', step: 'coordinating' }),
        needsAction: true,
        availableActions: ['decide_coordination'],
        stages: 阶段们,
        currentCoordination: 协同,
        intentConfirmations: { candidate: '', recruiter: '' },
        terminalSummary: null,
        conversationRef: null,
      };
}

/** S3 needs_user 行（双端）：意向二卡；S0/S1/协同 passed、意向 active。 */
function S3详情DTO(
  角色: P5角色,
  意向: P5详情['intentConfirmations'],
  caseId = 'mc_a',
): P5详情 {
  const 阶段们: P5阶段区[] = [
    { stage: 'anonymous_screening', state: 'passed', occurredAt: '2026-09-10T01:10:00Z', summary: '匿名初筛已通过', checklist: [], transcript: [], instructionReceipts: [], attachment: null, screeningRecords: null },
    { stage: 'resume_submission', state: 'passed', occurredAt: '2026-09-10T01:30:00Z', summary: '简历初筛已通过', checklist: [], transcript: [], instructionReceipts: [], attachment: null, screeningRecords: null },
    { stage: 'needs_coordination', state: 'passed', occurredAt: '2026-09-10T02:00:00Z', summary: '差异事项已确认', checklist: [], transcript: [], instructionReceipts: [], attachment: null, screeningRecords: null },
    { stage: 'intent_confirmation', state: 'active', occurredAt: '2026-09-10T03:00:00Z', summary: 'awaiting_confirmations', checklist: [], transcript: [], instructionReceipts: [], attachment: null, screeningRecords: null },
  ];
  const 公共 = {
    needsAction: true,
    availableActions: ['confirm_intent', 'decline_intent'] as P5动作[],
    stages: 阶段们,
    currentCoordination: null,
    intentConfirmations: 意向,
    terminalSummary: null,
    conversationRef: null,
  };
  return 角色 === 'candidate'
    ? {
        role: 'candidate',
        context: { intentionId: 'int_0123456789abcdef0123456789abcdef', job: 冻结职位 },
        state: 状态({ caseId, stage: 'intent_confirmation', status: 'needs_user', step: 'awaiting_confirmations' }),
        ...公共,
      }
    : {
        role: 'recruiter',
        context: { candidateAlias: 'candidate-0123456789ab', job: 冻结职位 },
        state: 状态({ caseId, stage: 'intent_confirmation', status: 'needs_user', step: 'awaiting_confirmations' }),
        ...公共,
      };
}

function 取卡片(result: { current: 动作结果 }, 键: string): 详情动作卡信息 {
  const 卡 = result.current.卡片们.find((条) => 条.键 === 键);
  if (卡 === undefined) throw new Error(`夹具必须提供 ${键} 卡`);
  return 卡;
}

function 取简历选择(result: { current: 动作结果 }): 简历选择属性 {
  const 选择 = result.current.简历选择;
  if (选择 === null) throw new Error('夹具必须打开简历选择层');
  return 选择;
}

function 取披露确认(result: { current: 动作结果 }): 确认属性 {
  const 确认 = result.current.披露确认;
  if (确认 === null) throw new Error('夹具必须打开披露确认');
  return 确认;
}

function 取终结确认(result: { current: 动作结果 }): 确认属性 {
  const 确认 = result.current.终结确认;
  if (确认 === null) throw new Error('夹具必须打开终结确认');
  return 确认;
}

/** 测试外置可控 promise：手动决定 settle 时机（写中 in-flight 夹具用）。 */
function 可控Promise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((ok) => {
    resolve = ok;
  });
  return { promise, resolve };
}

type 动作结果 = ReturnType<typeof use后端详情动作>;

/** 挂 hook 的统一入口。 */
function 挂动作(输入: 后端详情动作输入) {
  return renderHook((props: 后端详情动作输入) => use后端详情动作(props), { initialProps: 输入 });
}

/** 操作桩签名与 应用操作 对应方法同形（避免 vi.fn 推导宽类型过不了合同检查）。 */
type 决定S0桩 = (caseId: string, action: 'continue' | 'end') => Promise<void>;
type 决定S1桩 = (caseId: string, action: 'continue' | 'not_fit') => Promise<void>;
type 决定S2桩 = (role: P5角色, caseId: string, issueId: string, action: 'accept' | 'reject') => Promise<void>;
type 决定S3桩 = (role: P5角色, caseId: string, action: 'confirm' | 'decline') => Promise<void>;
type 提交简历桩 = (caseId: string, fileId: string, fileVersionId: string, disclosureConfirmed: true) => Promise<void>;
type 准备委托桩 = () => Promise<BFF附件简历库 | null>;

function 动作输入(选项: {
  详情: P5详情;
  决定S0?: 决定S0桩;
  决定S1?: 决定S1桩;
  决定S2?: 决定S2桩;
  决定S3?: 决定S3桩;
  提交简历?: 提交简历桩;
  准备候选委托简历?: 准备委托桩;
}): 后端详情动作输入 {
  return {
    role: 选项.详情.role,
    caseId: 选项.详情.state.caseId,
    视图: 正常视图(选项.详情),
    详情: 选项.详情,
    操作: {
      决定S0: 选项.决定S0 ?? vi.fn(async (): Promise<void> => undefined),
      决定S1: 选项.决定S1 ?? vi.fn(async (): Promise<void> => undefined),
      决定S2: 选项.决定S2 ?? vi.fn(async (): Promise<void> => undefined),
      决定S3: 选项.决定S3 ?? vi.fn(async (): Promise<void> => undefined),
      提交简历: 选项.提交简历 ?? vi.fn(async (): Promise<void> => undefined),
      准备候选委托简历: 选项.准备候选委托简历 ?? vi.fn(async (): Promise<null> => null),
    },
  };
}

// ── J-PILOT-01（Spec §7）：S0 respond_fact 不再出输入/提交 ──

describe('use后端详情动作 · S0 respond_fact 零输入（J-PILOT-01）', () => {
  it('旧 S0 needs_user 行：不出 respond_fact 卡、无事实问题；零请求', async () => {
    const 决定S0 = vi.fn(async (): Promise<void> => undefined);
    const { result } = 挂动作(动作输入({ 详情: S0详情DTO(), 决定S0 }));
    expect(result.current.卡片们.map((卡) => 卡.键)).toEqual([]);
    expect(JSON.stringify(result.current)).not.toContain('prompt_1'); // 无补充问题视图/提交控件
    expect(决定S0).not.toHaveBeenCalled(); // 确认前零请求；S0 无任何人工补事实路径
  });

  it('招聘端同一行同样零输入：respond_fact 双端都不出卡', () => {
    const { result } = 挂动作(动作输入({ 详情: S0详情DTO({ role: 'recruiter' }) }));
    expect(result.current.卡片们.map((卡) => 卡.键)).toEqual([]);
  });
});

describe('use后端详情动作 · end_screening（结束初筛）', () => {
  // review-r1（Spec §7「停止该卡交互」）：旧 S0 needs_user/human_decision 行白名单已移除
  // end_screening —— 旧响应仍携带该动作时双端零卡零请求。use后端详情动作 的 end_screening
  // handler 仅为既有接口保留（不清全站旧接口），经真实映射不再可达。

  it('旧 S0 needs_user 行携带 end_screening：候选端不出结束卡、零确认零请求', async () => {
    const 决定S0 = vi.fn(async (): Promise<void> => undefined);
    const { result } = 挂动作(动作输入({ 详情: S0详情DTO(), 决定S0 }));
    expect(result.current.卡片们.map((卡) => 卡.键)).toEqual([]);
    expect(result.current.终结确认).toBeNull();
    expect(决定S0).not.toHaveBeenCalled();
  });

  it('招聘端同一行同样不出结束卡：双端零控件零请求', () => {
    const 决定S0 = vi.fn(async (): Promise<void> => undefined);
    const { result } = 挂动作(
      动作输入({ 详情: S0详情DTO({ role: 'recruiter', 问题ref: 'prompt_hr' }), 决定S0 }),
    );
    expect(result.current.卡片们.map((卡) => 卡.键)).toEqual([]);
    expect(result.current.终结确认).toBeNull();
    expect(决定S0).not.toHaveBeenCalled();
  });
});

describe('use后端详情动作 · 返回合同', () => {
  it('S0 夹具下 S1 两槽恒 null：卡片只来自映射交集，无 S1 卡即无选择/披露', () => {
    const { result } = 挂动作(动作输入({ 详情: S0详情DTO() }));
    expect(result.current.简历选择).toBeNull();
    expect(result.current.披露确认).toBeNull();
    // S0 respond_fact/end_screening 白名单摘除：零动作卡（零输入，Spec §7）
    expect(result.current.卡片们.map((卡) => 卡.键)).toEqual([]);
  });
});

// ── S1（Task 6 迁入）：选择 → 披露确认 → 提交，以及四类终局/直发动作 ──────────────

describe('use后端详情动作 · S1 接受邀请 / 更换简历（选择 → 披露确认 → 提交）', () => {
  it('多份附件按服务端顺序出单选；状态文来自行数据；单选不默认授权（确认键不可触发）', async () => {
    const 准备 = vi.fn(async (): Promise<BFF附件简历库 | null> => 附件库(3, {
      2: { current_version: { ...附件库行(2).current_version, parse: { status: 'pending', updated_at: '2026-08-29T00:00:00Z' } } },
    }));
    const { result } = 挂动作(动作输入({ 详情: S0邀请详情DTO(), 准备候选委托简历: 准备 }));
    await act(async () => {
      取卡片(result, 'accept_resume_invitation').按钮们[0]?.执行?.();
    });
    const 选择 = 取简历选择(result);
    // 服务端顺序：键与文件名逐行对位，控制层不重排
    expect(选择.文件们.map((行) => 行.键)).toEqual([`rf_${填充十六(1)}`, `rf_${填充十六(2)}`, `rf_${填充十六(3)}`]);
    expect(选择.文件们.map((行) => 行.文件名)).toEqual(['简历_v1.pdf', '简历_v2.pdf', '简历_v3.pdf']);
    // 状态文按行带出（解析状态原样，展示不推导）
    expect(选择.文件们.map((行) => 行.状态文)).toEqual(['识别完成', '等待识别', '识别完成']);
    // 单选不默认授权：初始无选中、确认不可触发
    expect(选择.选中键).toBeNull();
    expect(选择.确认.执行).toBeNull();
    expect(选择.职位名).toBe('平台工程师');
  });

  it('选择只认键：同名不同版本的两行不串坐标（第二行的 fileId/versionId 各归各）', async () => {
    const 库 = 附件库(2);
    库.items[1] = { ...库.items[1]!, display_name: '简历_v1.pdf' }; // 同名不同 file/version
    const 提交简历 = vi.fn(async (): Promise<void> => undefined);
    const { result } = 挂动作(动作输入({
      详情: S1更换详情DTO(),
      准备候选委托简历: vi.fn(async (): Promise<BFF附件简历库 | null> => 库),
      提交简历,
    }));
    await act(async () => {
      取卡片(result, 'replace_resume').按钮们[0]?.执行?.();
    });
    const 选择 = 取简历选择(result);
    await act(async () => {
      选择.选择(`rf_${填充十六(2)}`); // 选第二行（同名）
    });
    await act(async () => {
      取简历选择(result).确认.执行?.();
    });
    await act(async () => {
      取披露确认(result).执行();
    });
    expect(提交简历).toHaveBeenCalledTimes(1);
    expect(提交简历).toHaveBeenCalledWith('mc_a', `rf_${填充十六(2)}`, `rfv_${填充十六(2)}`, true);
  });

  it('选定后新建本次 Case 披露确认：正文点名冻结职位与所选文件；取消/确认都即刻收层，零请求或字面 true', async () => {
    const 提交简历 = vi.fn(async (): Promise<void> => undefined);
    const { result } = 挂动作(动作输入({
      详情: S0邀请详情DTO(),
      准备候选委托简历: vi.fn(async (): Promise<BFF附件简历库 | null> => 附件库(2)),
      提交简历,
    }));
    await act(async () => {
      取卡片(result, 'accept_resume_invitation').按钮们[0]?.执行?.();
    });
    await act(async () => {
      取简历选择(result).选择(`rf_${填充十六(2)}`);
    });
    await act(async () => {
      取简历选择(result).确认.执行?.(); // 选定这份 → 进披露确认
    });
    expect(result.current.简历选择).toBeNull(); // 选择层已收
    const 披露 = 取披露确认(result);
    expect(披露.标题).toBe('确认递交这份简历？');
    expect(披露.正文).toContain('「平台工程师」这一 Case 递交「简历_v2.pdf」');
    expect(披露.正文).toContain('授权仅对这一次递交生效');
    expect(披露.取消文).toBe('暂不递交');
    expect(提交简历).not.toHaveBeenCalled(); // 确认前零请求
    await act(async () => {
      披露.取消();
    });
    expect(result.current.披露确认).toBeNull(); // 取消收层
    expect(提交简历).not.toHaveBeenCalled(); // 取消零提交

    // 再来一次：重新选择 → 新建披露确认，不复用上一次授权
    await act(async () => {
      取卡片(result, 'accept_resume_invitation').按钮们[0]?.执行?.();
    });
    await act(async () => {
      取简历选择(result).选择(`rf_${填充十六(1)}`);
    });
    await act(async () => {
      取简历选择(result).确认.执行?.();
    });
    await act(async () => {
      取披露确认(result).执行();
    });
    expect(提交简历).toHaveBeenCalledTimes(1);
    expect(提交简历).toHaveBeenCalledWith('mc_a', `rf_${填充十六(1)}`, `rfv_${填充十六(1)}`, true);
  });

  it('取消收层零提交：简历选择.取消 清层，下一次打开重新单选（不记上次选中）', async () => {
    const 提交简历 = vi.fn(async (): Promise<void> => undefined);
    const 准备 = vi.fn(async (): Promise<BFF附件简历库 | null> => 附件库(2));
    const { result } = 挂动作(动作输入({
      详情: S0邀请详情DTO(),
      准备候选委托简历: 准备,
      提交简历,
    }));
    await act(async () => {
      取卡片(result, 'accept_resume_invitation').按钮们[0]?.执行?.();
    });
    await act(async () => {
      取简历选择(result).选择(`rf_${填充十六(1)}`);
    });
    await act(async () => {
      取简历选择(result).取消();
    });
    expect(result.current.简历选择).toBeNull();
    expect(result.current.披露确认).toBeNull();
    expect(提交简历).not.toHaveBeenCalled();

    await act(async () => {
      取卡片(result, 'accept_resume_invitation').按钮们[0]?.执行?.();
    });
    expect(取简历选择(result).选中键).toBeNull(); // 不记上次的选中
    expect(准备).toHaveBeenCalledTimes(2); // 每次尝试都重跑权威库读取
  });

  it('单份附件直达披露确认（不过单选层），仍点名该文件与冻结职位', async () => {
    const 提交简历 = vi.fn(async (): Promise<void> => undefined);
    const { result } = 挂动作(动作输入({
      详情: S0邀请详情DTO(),
      准备候选委托简历: vi.fn(async (): Promise<BFF附件简历库 | null> => 附件库(1)),
      提交简历,
    }));
    await act(async () => {
      取卡片(result, 'accept_resume_invitation').按钮们[0]?.执行?.();
    });
    expect(result.current.简历选择).toBeNull();
    const 披露 = 取披露确认(result);
    expect(披露.正文).toContain('「简历_v1.pdf」');
    await act(async () => {
      披露.执行();
    });
    expect(提交简历).toHaveBeenCalledWith('mc_a', `rf_${填充十六(1)}`, `rfv_${填充十六(1)}`, true);
  });

  it('空附件库：提示去上传并跳转我的简历，零提交；null（会话/角色换代）静默返回', async () => {
    const 提交简历 = vi.fn(async (): Promise<void> => undefined);
    const { result } = 挂动作(动作输入({
      详情: S0邀请详情DTO(),
      准备候选委托简历: vi.fn(async (): Promise<BFF附件简历库 | null> => ({ ...附件库(0) })),
      提交简历,
    }));
    await act(async () => {
      取卡片(result, 'accept_resume_invitation').按钮们[0]?.执行?.();
    });
    await waitFor(() => expect(mock跳转).toHaveBeenCalledWith(路径.我的简历));
    expect(result.current.简历选择).toBeNull();
    expect(提交简历).not.toHaveBeenCalled();

    const 静默 = 挂动作(动作输入({
      详情: S0邀请详情DTO(),
      准备候选委托简历: vi.fn(async (): Promise<BFF附件简历库 | null> => null), // null 不是空库
      提交简历,
    }));
    mock跳转.mockClear();
    await act(async () => {
      取卡片(静默.result, 'accept_resume_invitation').按钮们[0]?.执行?.();
    });
    expect(静默.result.current.简历选择).toBeNull(); // 静默返回
    expect(mock跳转).not.toHaveBeenCalled(); // 绝不把换代当空库去上传
    expect(提交简历).not.toHaveBeenCalled();
  });

  it('换 Case 清层：选择/披露/终结确认即刻关闭，迟到的库结果整包作废（代际栅栏）', async () => {
    const deferred = 可控Promise<BFF附件简历库 | null>();
    const { result, rerender } = 挂动作(动作输入({
      详情: S0邀请详情DTO('mc_a'),
      准备候选委托简历: vi.fn(() => deferred.promise),
    }));
    await act(async () => {
      取卡片(result, 'accept_resume_invitation').按钮们[0]?.执行?.();
    });
    // 换单（同路由只换参数，hook 复用）：已开的披露确认与新单一起清空
    rerender(动作输入({
      详情: S0邀请详情DTO('mc_b'),
      准备候选委托简历: vi.fn(() => deferred.promise),
    }));
    expect(result.current.简历选择).toBeNull();
    expect(result.current.披露确认).toBeNull();
    expect(result.current.终结确认).toBeNull();

    // 旧单的权威库此刻才回来：对不上代际，整包作废 —— 不在新单上弹层
    await act(async () => {
      deferred.resolve(附件库(2));
    });
    expect(result.current.简历选择).toBeNull();
  });
});

describe('use后端详情动作 · S1 重试校验（typed 附件坐标）', () => {
  it('重试（原授权检查）：用阶段中原绑定 file/version 对直接提交字面 true，不重选、不重新要求披露确认', async () => {
    const 提交简历 = vi.fn(async (): Promise<void> => undefined);
    const 准备 = vi.fn(async (): Promise<BFF附件简历库 | null> => 附件库(2));
    const { result } = 挂动作(动作输入({
      详情: S1重试详情DTO(true),
      准备候选委托简历: 准备,
      提交简历,
    }));
    await act(async () => {
      取卡片(result, 'retry_resume_readiness').按钮们[0]?.执行?.();
    });
    expect(result.current.简历选择).toBeNull(); // 不重选：坐标只来自阶段区
    expect(result.current.披露确认).toBeNull(); // 不重新展示披露确认（Spec §9 原授权交接）
    expect(提交简历).toHaveBeenCalledTimes(1);
    expect(提交简历).toHaveBeenCalledWith('mc_a', 绑定附件.fileId, 绑定附件.fileVersionId, true);
    expect(准备).not.toHaveBeenCalled(); // 重试绝不猜库、不重跑附件库读取
  });

  it('重试失败原地提示，落定后恢复可点（不是纯刷新或重跑 Agent）', async () => {
    const 轻提示数 = (): number => {
      const 容器 = Array.from(document.body.children).find(
        (节点) => (节点 as HTMLElement).style?.zIndex === '999',
      ) as HTMLElement | undefined;
      return 容器?.childElementCount ?? 0;
    };
    const 清空轻提示 = (): void => {
      const 容器 = Array.from(document.body.children).find(
        (节点) => (节点 as HTMLElement).style?.zIndex === '999',
      ) as HTMLElement | undefined;
      if (容器) 容器.innerHTML = '';
    };
    const 提交简历 = vi.fn(async (): Promise<void> => { throw new Error('503'); });
    const { result } = 挂动作(动作输入({ 详情: S1重试详情DTO(true), 提交简历 }));
    清空轻提示(); // 轻提示 是 body 单例容器：断言前清空（前序测试残留会干扰计数）
    await act(async () => {
      取卡片(result, 'retry_resume_readiness').按钮们[0]?.执行?.();
    });
    await waitFor(() => expect(轻提示数()).toBe(1)); // 失败原地提示真实错误
    await waitFor(() =>
      expect(取卡片(result, 'retry_resume_readiness').按钮们[0]?.执行).not.toBeNull(),
    );
  });

  it('无 typed 附件：重试卡零按钮（fail closed，绝不猜坐标）', () => {
    const { result } = 挂动作(动作输入({
      详情: S1重试详情DTO(false),
    }));
    const 卡 = 取卡片(result, 'retry_resume_readiness');
    expect(卡.标题).toBeTruthy(); // 卡框架仍在（映射交集）
    expect(卡.按钮们).toHaveLength(0); // 无坐标即无控件
  });
});

describe('use后端详情动作 · S1 婉拒邀请与初筛结论', () => {
  it('婉拒邀请：终结确认原语义，确认发 决定S0(caseId, end)，取消零请求', async () => {
    const 决定S0 = vi.fn(async (): Promise<void> => undefined);
    const 提交简历 = vi.fn(async (): Promise<void> => undefined);
    const { result } = 挂动作(动作输入({
      详情: S0邀请详情DTO(),
      决定S0,
      提交简历,
    }));
    await act(async () => {
      取卡片(result, 'decline_resume_invitation').按钮们[0]?.执行?.();
    });
    const 确认 = 取终结确认(result);
    expect(确认.标题).toBe('婉拒这次简历邀请？');
    expect(确认.正文).toBe('婉拒后这一单将结束，不会向该招聘方披露你的简历。');
    expect(确认.执行文).toBe('婉拒邀请');
    expect(确认.取消文).toBe('暂不婉拒');
    expect(决定S0).not.toHaveBeenCalled(); // 确认前零请求
    await act(async () => {
      确认.取消();
    });
    expect(result.current.终结确认).toBeNull();
    expect(决定S0).not.toHaveBeenCalled();

    await act(async () => {
      取卡片(result, 'decline_resume_invitation').按钮们[0]?.执行?.();
    });
    await act(async () => {
      取终结确认(result).执行();
    });
    expect(决定S0).toHaveBeenCalledTimes(1);
    expect(决定S0).toHaveBeenCalledWith('mc_a', 'end');
    expect(提交简历).not.toHaveBeenCalled(); // 婉拒绝不携带简历
  });

  it('通过初筛直发 决定S1(continue)；不合适过终结确认后 决定S1(not_fit)，取消零请求', async () => {
    const 决定S1 = vi.fn(async (): Promise<void> => undefined);
    const { result } = 挂动作(动作输入({
      详情: S1初筛详情DTO(),
      决定S1,
    }));
    const 卡 = 取卡片(result, 'decide_resume_screening');
    const 通过 = 卡.按钮们.find((键) => 键.文案 === '通过初筛');
    const 不合适 = 卡.按钮们.find((键) => 键.文案 === '不合适');
    if (通过 === undefined || 不合适 === undefined) throw new Error('初筛结论卡必须有双键');

    await act(async () => {
      通过.执行?.();
    });
    expect(决定S1).toHaveBeenCalledTimes(1);
    expect(决定S1).toHaveBeenCalledWith('mc_hr', 'continue');

    await act(async () => {
      不合适.执行?.();
    });
    const 确认 = 取终结确认(result);
    expect(确认.标题).toBe('判定简历不合适？');
    expect(确认.正文).toBe('判定后这一单将结束，无法恢复。');
    expect(确认.执行文).toBe('确认不合适');
    expect(确认.取消文).toBe('再想想');
    expect(决定S1).toHaveBeenCalledTimes(1); // 确认前零请求
    await act(async () => {
      确认.取消();
    });
    expect(result.current.终结确认).toBeNull();
    expect(决定S1).toHaveBeenCalledTimes(1);

    await act(async () => {
      不合适.执行?.();
    });
    await act(async () => {
      取终结确认(result).执行();
    });
    expect(决定S1).toHaveBeenCalledTimes(2);
    expect(决定S1).toHaveBeenLastCalledWith('mc_hr', 'not_fit');
  });

  it('写中锁保留：决定S1 在飞期间初筛双键都不可再点，收口后恢复', async () => {
    const deferred = 可控Promise<void>();
    const 决定S1 = vi.fn(() => deferred.promise);
    const { result } = 挂动作(动作输入({
      详情: S1初筛详情DTO(),
      决定S1,
    }));
    const 卡 = () => 取卡片(result, 'decide_resume_screening');
    await act(async () => {
      卡().按钮们.find((键) => 键.文案 === '通过初筛')?.执行?.();
    });
    // 在飞：双键执行均为 null（真实 disabled 由 详情动作卡 落实），且每键带写中禁用说明
    // （review-r1 F6：说明经 aria-describedby 就地解释，落定恢复 null）
    expect(卡().按钮们.every((键) => 键.执行 === null)).toBe(true);
    expect(卡().按钮们.every((键) => 键.禁用说明 === '正在提交，请稍候')).toBe(true);
    deferred.resolve();
    await waitFor(() => expect(卡().按钮们.every((键) => 键.执行 !== null)).toBe(true));
    expect(卡().按钮们.every((键) => 键.禁用说明 === null)).toBe(true);
  });
});

// ── 发命令迟到栅栏（review-r1 F5，spec §5 迟到结果丢弃）：换单后迟到的失败提示与
//    写中收口对不上代际即整包作废，不落在新单的页面上；新 scope 干净起步可再发。──

describe('use后端详情动作 · 发命令迟到失败栅栏', () => {
  /** 轻提示 是 body 上的单例容器：断言前清空，避免前序测试的残留干扰计数。 */
  function 轻提示数(): number {
    const 容器 = Array.from(document.body.children).find(
      (节点) => (节点 as HTMLElement).style?.zIndex === '999',
    ) as HTMLElement | undefined;
    return 容器?.childElementCount ?? 0;
  }
  function 清空轻提示(): void {
    const 容器 = Array.from(document.body.children).find(
      (节点) => (节点 as HTMLElement).style?.zIndex === '999',
    ) as HTMLElement | undefined;
    if (容器) 容器.innerHTML = '';
  }

  it('换单后迟到的失败不提示、不收口新单写中锁；新单照常可发', async () => {
    let 打回!: () => void;
    const 迟到失败 = new Promise<void>((_, fail) => { 打回 = fail; });
    const 决定S1 = vi.fn(() => 迟到失败);
    const 单A = S1初筛详情DTO('mc_a');
    const 单B = S1初筛详情DTO('mc_b');
    const { result, rerender } = 挂动作(动作输入({ 详情: 单A, 决定S1 }));
    await act(async () => {
      取卡片(result, 'decide_resume_screening').按钮们.find((键) => 键.文案 === '通过初筛')?.执行?.();
    });
    expect(决定S1).toHaveBeenCalledWith('mc_a', 'continue');
    清空轻提示();

    // 换单（hook 复用、caseId 换）：写中锁随 scope 重置放行，不沿用旧单在飞
    rerender(动作输入({ 详情: 单B, 决定S1 }));
    const 新卡 = 取卡片(result, 'decide_resume_screening');
    expect(新卡.按钮们.find((键) => 键.文案 === '通过初筛')?.执行).not.toBeNull();

    // 旧单此刻才失败：迟到提示对不上代际整包作废
    await act(async () => {
      打回();
      await 迟到失败.catch(() => undefined);
    });
    expect(轻提示数()).toBe(0); // 不在新单的页面上弹旧单的失败
    expect(取卡片(result, 'decide_resume_screening').按钮们.find((键) => 键.文案 === '通过初筛')?.执行).not.toBeNull();

    // 新单照常可发：新代际的失败正常提示、正常收口
    const 失败 = vi.fn(async (): Promise<void> => { throw new Error('503'); });
    rerender(动作输入({ 详情: 单B, 决定S1: 失败 }));
    await act(async () => {
      取卡片(result, 'decide_resume_screening').按钮们.find((键) => 键.文案 === '不合适')?.执行?.();
    });
    await act(async () => {
      取终结确认(result).执行(); // 判不合适过二次确认后发命令
    });
    await waitFor(() => expect(轻提示数()).toBe(1)); // 本单失败正常原地提示
    await waitFor(() =>
      expect(取卡片(result, 'decide_resume_screening').按钮们.find((键) => 键.文案 === '不合适')?.执行).not.toBeNull(),
    );
  });
});

// ── S2/S3（Task 8 迁入）：typed 协同块 / 本端意向词栅栏，成功依赖权威重读 ──────────

describe('use后端详情动作 · S2 协同决定（decide_coordination）', () => {
  it('本端必需且未决才提供决定：接受/拒绝带当前协同块的精确 issueId（role/caseId 逐项对照）', async () => {
    const 决定S2 = vi.fn(async (): Promise<void> => undefined);
    const { result } = 挂动作(动作输入({
      详情: S2详情DTO('candidate', 协同块()),
      决定S2,
    }));
    const 卡 = 取卡片(result, 'decide_coordination');
    expect(卡.标题).toBe('回应协同事项'); // 映射交集给的标题/说明原样保留
    expect(卡.说明).toBe('对当前协同事项作出接受或拒绝');
    const 接受 = 卡.按钮们.find((键) => 键.文案 === '接受');
    const 拒绝 = 卡.按钮们.find((键) => 键.文案 === '拒绝');
    if (接受 === undefined || 拒绝 === undefined) throw new Error('S2 卡必须有接受/拒绝双键');

    await act(async () => {
      接受.执行?.();
    });
    expect(决定S2).toHaveBeenCalledTimes(1);
    expect(决定S2).toHaveBeenCalledWith('candidate', 'mc_a', 协同问题ID, 'accept');
    await act(async () => {
      拒绝.执行?.();
    });
    expect(决定S2).toHaveBeenLastCalledWith('candidate', 'mc_a', 协同问题ID, 'reject');
  });

  it('协同块换代后只用当前块的 issueId（不缓存上一次坐标）', async () => {
    const 决定S2 = vi.fn(async (): Promise<void> => undefined);
    const { result, rerender } = 挂动作(动作输入({
      详情: S2详情DTO('recruiter', 协同块()),
      决定S2,
    }));
    const 新块 = 协同块({ issueId: 'iss_ffffffffffffffffffffffffffffffff', kind: 'travel' });
    rerender(动作输入({
      详情: S2详情DTO('recruiter', 新块),
      决定S2,
    }));
    await act(async () => {
      取卡片(result, 'decide_coordination').按钮们.find((键) => 键.文案 === '接受')?.执行?.();
    });
    expect(决定S2).toHaveBeenCalledWith('recruiter', 'mc_a', 'iss_ffffffffffffffffffffffffffffffff', 'accept');
  });

  it('非必需角色 / 本端已决 / currentCoordination 缺席 → 零控件零请求（fail closed）', () => {
    const 决定S2 = vi.fn(async (): Promise<void> => undefined);
    const 非必需 = 挂动作(动作输入({
      详情: S2详情DTO('candidate', 协同块({ requiredRoles: ['recruiter'] })),
      决定S2,
    }));
    expect(取卡片(非必需.result, 'decide_coordination').按钮们).toHaveLength(0);

    const 本端已决 = 挂动作(动作输入({
      详情: S2详情DTO('candidate', 协同块({ candidateDecided: true })),
      决定S2,
    }));
    expect(取卡片(本端已决.result, 'decide_coordination').按钮们).toHaveLength(0);

    const 无协同块 = 挂动作(动作输入({
      详情: S2详情DTO('candidate', null),
      决定S2,
    }));
    expect(取卡片(无协同块.result, 'decide_coordination').按钮们).toHaveLength(0);
    expect(决定S2).not.toHaveBeenCalled();
  });

  it('成功无本地推进（权威重读归操作层）；失败原地提示且写中收口，不锁死', async () => {
    const 决定S2 = vi.fn(async (): Promise<void> => undefined);
    const { result } = 挂动作(动作输入({
      详情: S2详情DTO('candidate', 协同块()),
      决定S2,
    }));
    await act(async () => {
      取卡片(result, 'decide_coordination').按钮们.find((键) => 键.文案 === '接受')?.执行?.();
    });
    // 命令收口后本 hook 绝不本地重建视图：卡片与控件仍按原视图（推进只来自下一次权威重读）
    const 卡 = 取卡片(result, 'decide_coordination');
    expect(卡.按钮们.find((键) => 键.文案 === '接受')?.执行).not.toBeNull();

    const 失败 = 挂动作(动作输入({
      详情: S2详情DTO('candidate', 协同块()),
      决定S2: vi.fn(async (): Promise<void> => {
        throw new Error('503');
      }),
    }));
    await act(async () => {
      取卡片(失败.result, 'decide_coordination').按钮们.find((键) => 键.文案 === '拒绝')?.执行?.();
    });
    expect(document.body.textContent).toContain('请求失败，请稍后再试'); // 失败原地提示
    // 失败无本地推进：卡片还在、按钮恢复可点（可再次尝试）
    expect(取卡片(失败.result, 'decide_coordination').按钮们.find((键) => 键.文案 === '拒绝')?.执行).not.toBeNull();
  });

  it('写中锁：决定S2 在飞期间接受/拒绝都不可再点，收口后恢复', async () => {
    const deferred = 可控Promise<void>();
    const { result } = 挂动作(动作输入({
      详情: S2详情DTO('candidate', 协同块()),
      决定S2: vi.fn(() => deferred.promise),
    }));
    const 卡 = () => 取卡片(result, 'decide_coordination');
    await act(async () => {
      卡().按钮们.find((键) => 键.文案 === '接受')?.执行?.();
    });
    const 决定键们 = () => 卡().按钮们.filter((键) => 键.文案 === '接受' || 键.文案 === '拒绝');
    expect(决定键们().every((键) => 键.执行 === null)).toBe(true);
    expect(决定键们().every((键) => 键.禁用说明 === '正在提交，请稍候')).toBe(true);
    deferred.resolve();
    await waitFor(() =>
      expect(卡().按钮们.find((键) => 键.文案 === '接受')?.执行).not.toBeNull(),
    );
    expect(决定键们().every((键) => 键.禁用说明 === null)).toBe(true); // 落定后说明退场
  });

  it('相同区域保留规则入口：Backend 记成规则在场但禁用，原因「暂不支持记成规则」，零执行', () => {
    const { result } = 挂动作(动作输入({
      详情: S2详情DTO('candidate', 协同块()),
    }));
    const 规则键 = 取卡片(result, 'decide_coordination').按钮们.find((键) => 键.文案 === '记成规则');
    if (规则键 === undefined) throw new Error('Backend 协同卡必须保留记成规则入口');
    expect(规则键.执行).toBeNull(); // 无 rules mutation：在场但不可用
    expect(规则键.禁用说明).toBe('暂不支持记成规则'); // 已提供但不可用的按钮能解释
  });
});

describe('use后端详情动作 · S3 意向确认/婉拒（confirm_intent / decline_intent）', () => {
  it('本端意向词为空：确认意向/婉拒意向分别发 决定S3(role, caseId, confirm|decline)', async () => {
    const 决定S3 = vi.fn(async (): Promise<void> => undefined);
    const { result } = 挂动作(动作输入({
      详情: S3详情DTO('candidate', { candidate: '', recruiter: 'confirm' }),
      决定S3,
    }));
    expect(result.current.卡片们.map((卡) => 卡.键)).toEqual(['confirm_intent', 'decline_intent']);
    await act(async () => {
      取卡片(result, 'confirm_intent').按钮们[0]?.执行?.();
    });
    expect(决定S3).toHaveBeenCalledTimes(1);
    expect(决定S3).toHaveBeenCalledWith('candidate', 'mc_a', 'confirm');
    await act(async () => {
      取卡片(result, 'decline_intent').按钮们[0]?.执行?.();
    });
    expect(决定S3).toHaveBeenLastCalledWith('candidate', 'mc_a', 'decline');
  });

  it('本端已决 → 意向二卡零控件零请求（等待态来自服务端行，不凭 stage 提前挂按钮）', () => {
    const 决定S3 = vi.fn(async (): Promise<void> => undefined);
    const { result } = 挂动作(动作输入({
      详情: S3详情DTO('recruiter', { candidate: 'confirm', recruiter: 'confirm' }),
      决定S3,
    }));
    expect(取卡片(result, 'confirm_intent').按钮们).toHaveLength(0);
    expect(取卡片(result, 'decline_intent').按钮们).toHaveLength(0);
    expect(决定S3).not.toHaveBeenCalled();
  });
});
