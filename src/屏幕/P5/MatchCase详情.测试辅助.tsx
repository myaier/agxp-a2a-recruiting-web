// MatchCase详情 测试的共用桩与 DTO/构造夹具簇：mock 桩、状态/阶段区组构造、各阶段详情
// DTO、渲染辅助（组件经 登记详情组件 注入）。由 src/屏幕/P5/MatchCase详情.test.tsx
// 按冻结归属拆出时提取；vitest 按测试文件隔离实例化，不跨文件共享状态。原文件头注：
// P5 Task 5：双端详情（MatchCase详情 + 在谈详情/候选详情 的 Backend 分支）的行为测试。
// 覆盖：URL case_id + 已认证角色直达刷新（绝不读列表记忆补 context）、招聘端别名原样
// 且无姓名/联系方式/对端字段、四阶段固定 S0→S3 顺序（mapper 交付顺序，无客户端重排）、
// checklist/transcript/叮嘱回执只作展示、时间线文本不产生任何控件（未知状态隐藏全部
// mutation 控件）、首载失败/刷新失败的重试走 force 权威重读、可见 3 秒详情节拍（恒
// force=true）、终局停轮询、会话/角色栅栏关轮询、缺 P5.1 段不渲染、case_id 是唯一坐标
// （scope 键/请求都不用别名）、Case 叮嘱：POST 等服务器、无乐观气泡、仅成功清空草稿、
// 失败保留草稿、终局/契约错误隐藏输入。
// P5 Task 6 追加：S0–S3 动作卡（只从映射交集渲染、typed prompt/issue/file 坐标、
// S1 提交/更换的 Plan 1 单选 + Case 专属披露确认（字面 true、不复用、取消零请求）、
// S2/S3 按必需未决/本端未决栅栏、动作缺席零请求、招聘端授权 PDF（typed 附件才出
// 入口、只走 Case 专属 role 路径、租约关闭/卸载即回收、绝不读 blob 文本）。
// 测试宿主：mock 应用状态 / 导航钩子（同 MatchCase列表.test.tsx 惯例）；仓库未装
// @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { vi } from 'vitest';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { type P5详情快照, type P5连续详情快照 } from '../../状态/后端/类型';
import { type NegotiationDetail } from '../../数据/招聘数据源/连续代谈';
import { type P5列表项 } from '../../数据/招聘数据源/MatchCase';
import { type P5详情 } from '../../数据/招聘数据源/MatchCase';
import { type P5阶段区 } from '../../数据/招聘数据源/MatchCase';
import { type P5S0筛选记录 } from '../../数据/招聘数据源/MatchCase';
import { type P5角色 } from '../../数据/MatchCase展示映射';
import { type BFF主体, type BFF附件简历库 } from '../../数据/BFF契约';
import { P5历史连续块 } from '../../测试/BFF样本';


// jsdom 不实现 scrollIntoView（详情屏挂载后自动定位会调用它）
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

export const mock派发 = vi.fn();
export const mock返回 = vi.fn();
export const mock跳转 = vi.fn();
export const mock替换跳转 = vi.fn();
export const mock设置P5范围 = vi.fn();
export const mock读取详情 = vi.fn(async () => undefined);
export const mock读取连续详情 = vi.fn(async () => undefined);
export const mock重试连续记录 = vi.fn(async (): Promise<void> => undefined);
export const mock归档连续记录 = vi.fn(async (): Promise<void> => undefined);
export const mock新增叮嘱 = vi.fn(async (): Promise<void> => undefined);
export const mock加载工作区 = vi.fn(async () => undefined);
export const mock刷新工作区 = vi.fn(async () => undefined);
// Task 6：S0–S3 命令、Case 专属 PDF 租约与委托前权威附件库读取
export const mock回答事实 = vi.fn(async (): Promise<void> => undefined);
export const mock决定S0 = vi.fn(async (): Promise<void> => undefined);
export const mock决定S1 = vi.fn(async (): Promise<void> => undefined);
export const mock决定S2 = vi.fn(async (): Promise<void> => undefined);
export const mock决定S3 = vi.fn(async (): Promise<void> => undefined);
export const mock提交简历 = vi.fn(async (): Promise<void> => undefined);
export const mock读取简历PDF = vi.fn(async () => ({ url: 'blob:p5-resume', revoke: () => undefined }));
export const mock准备候选委托简历 = vi.fn(async (): Promise<BFF附件简历库 | null> => null);
// 生产 Provider 的 操作 引用稳定（useMemo），桩宿主同样给恒定表
export const mock操作 = {
  设置P5范围: mock设置P5范围,
  读取详情: mock读取详情,
  读取连续详情: mock读取连续详情,
  重试连续记录: mock重试连续记录,
  归档连续记录: mock归档连续记录,
  新增叮嘱: mock新增叮嘱,
  加载工作区: mock加载工作区,
  刷新工作区: mock刷新工作区,
  回答事实: mock回答事实,
  决定S0: mock决定S0,
  决定S1: mock决定S1,
  决定S2: mock决定S2,
  决定S3: mock决定S3,
  提交简历: mock提交简历,
  读取简历PDF: mock读取简历PDF,
  准备候选委托简历: mock准备候选委托简历,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let mock应用状态: any;

import type { MatchCase详情 as 详情组件 } from './MatchCase详情';
let 已登记: typeof 详情组件 | null = null;

/** suite 加载后登记被测组件（helper 不能静态 import 组件，避免 vi.mock 工厂环）。 */
export function 登记详情组件(组件: typeof 详情组件) {
  已登记 = 组件;
}

/** 测试体内需要整体重设桩应用状态时用（import 绑定只读，改写走这里）。 */
export function 设应用状态(值: any) {
  mock应用状态 = 值;
}



/** 动态取轻提示条数：轻提示 是 body 上的单例容器，每次断言都重查（捕获引用会过期）。 */
export function 轻提示条数(): number {
  return (Array.from(document.body.children).find(
    (节点) => (节点 as HTMLElement).style?.zIndex === '999',
  ) as HTMLElement | undefined)?.childElementCount ?? 0;
}

export function 清空轻提示(): void {
  const 容器 = Array.from(document.body.children).find(
    (节点) => (节点 as HTMLElement).style?.zIndex === '999',
  ) as HTMLElement | undefined;
  if (容器) 容器.innerHTML = '';
}

export const 意向ID = 'int_0123456789abcdef0123456789abcdef';
export const 职位ID = 'job_0123456789abcdef0123456789abcdef';
export const 别名 = 'candidate-0123456789ab';
export const 叮嘱占位 = '有想法就告诉你的AI代理';

// ── DTO 样本：快照里存的是已 decode 的归一化 P5 DTO（decode 归 Task 1）；
//    基线行取 open/anonymous_screening/needs_user（step human_decision）—— 想看见
//    respond_fact 卡的夹具必须用这一行（Task 2 pin）。──

export const 冻结职位 = {
  jobId: 职位ID,
  job: {
    title: '平台工程师',
    location: '上海',
    publicSalaryRange: '25-40K·16薪',
    requiredSkills: ['Go', 'Kubernetes'],
  },
};

export function 状态(覆盖: Partial<P5列表项['state']> = {}): P5列表项['state'] {
  return {
    caseId: 'mc_direct', lifecycle: 'open', stage: 'anonymous_screening', status: 'needs_user',
    step: 'human_decision', round: 1, roundBudget: 3, needsUser: true,
    outcome: null, outcomeCode: null,
    createdAt: '2026-08-29T01:00:00Z', updatedAt: '2026-08-29T02:00:00Z', finalizedAt: null,
    agentAttention: null,
    ...覆盖,
  };
}

/** 四阶段区固定 S0→S3；S0 带 checklist/待答问题/双端叮嘱回执，其余 pending。
 *  summary/checklabel 用真实 wire 闭词（spec §2.4）：summary 是阶段最后一个 step word，
 *  未开始阶段为空串（展示映射负责闭词→中文，未知词不进 DOM）。 */
export function 阶段区组(覆盖: Partial<Record<P5阶段区['stage'], Partial<P5阶段区>>> = {}): P5阶段区[] {
  const 基础: P5阶段区[] = [
    {
      stage: 'anonymous_screening', state: 'active', occurredAt: '2026-08-29T01:10:00Z',
      summary: 'candidate_reevaluation',
      checklist: [{ label: 'anonymous_screening_passed', done: true }, { label: 'resume_bound', done: false }],
      transcript: [
        // 问答以 screening records 为权威（S0–S3 展示统一 Task 4）；transcript 只留流程事件
        {
          eventId: 'evt_n1', stage: 'anonymous_screening', kind: 'stage_note',
          role: '', reasonCode: 'policy_checked', occurredAt: '2026-08-29T01:20:00Z',
        },
      ],
      instructionReceipts: [
        {
          instructionId: 'aci_1', owner: 'candidate', stage: 'anonymous_screening',
          expression: '工作日 10:00-19:00 联系', occurredAt: '2026-08-29T01:05:00Z',
        },
        {
          instructionId: 'aci_2', owner: 'recruiter', stage: 'anonymous_screening',
          expression: '流程预计两周内走完', occurredAt: '2026-08-29T01:06:00Z',
        },
      ],
      attachment: null,
      // S0 展开块归一化形状：仅 S0 可为对象，其余段一律 null
      screeningRecords: {
        messages: [{
          id: 's0q_1', kind: 'question', role: 'candidate', stage: 'anonymous_screening',
          askingRole: 'candidate', round: 1, text: '每周可以到岗几天？',
          exchangeRef: null, occurredAt: '2026-08-29T01:10:00Z',
        }],
        summaries: [],
      },
    },
    { stage: 'resume_submission', state: 'pending', occurredAt: null, summary: '', checklist: [], transcript: [], instructionReceipts: [], attachment: null, screeningRecords: null },
    { stage: 'needs_coordination', state: 'pending', occurredAt: null, summary: '', checklist: [], transcript: [], instructionReceipts: [], attachment: null, screeningRecords: null },
    { stage: 'intent_confirmation', state: 'pending', occurredAt: null, summary: '', checklist: [], transcript: [], instructionReceipts: [], attachment: null, screeningRecords: null },
  ];
  return 基础.map((区) => ({ ...区, ...覆盖[区.stage] }));
}

export interface 详情选项 {
  state?: P5列表项['state'];
  stages?: P5阶段区[];
  needsAction?: boolean;
  availableActions?: P5详情['availableActions'];
  terminalSummary?: P5详情['terminalSummary'];
  currentCoordination?: P5详情['currentCoordination'];
  intentConfirmations?: P5详情['intentConfirmations'];
  /** P7 Task 6：completed + complete 的已发布会话坐标。 */
  conversationRef?: P5详情['conversationRef'];
  /** Task 3：招聘端别名可换（S0 禁词断言按整页 body 文本算，别名不得含 candidate 字样）。 */
  别名?: string;
}

export function 候选详情DTO(选项: 详情选项 = {}): P5详情 {
  return {
    role: 'candidate',
    context: { intentionId: 意向ID, job: 冻结职位 },
    state: 选项.state ?? 状态(),
    needsAction: 选项.needsAction ?? true,
    availableActions: 选项.availableActions ?? ['respond_fact', 'end_screening'],
    stages: 选项.stages ?? 阶段区组(),
    currentCoordination: 选项.currentCoordination ?? null,
    intentConfirmations: 选项.intentConfirmations ?? { candidate: '', recruiter: '' },
    terminalSummary: 选项.terminalSummary ?? null,
    conversationRef: 选项.conversationRef ?? null,
    // release/0.2.5：展示字段是解码层 required 成员；本屏不消费，置合法 null 档。
    matchScore: null,
    jobDetail: null,
    ...P5历史连续块,
  };
}


/** S1 open 行（候选，resume_submission waiting）：非 S0 的叮嘱输入态（J-PILOT-01 Spec §7）。 */
export function 候选S1详情DTO(caseId = 'mc_direct'): P5详情 {
  const 底 = 候选详情DTO();
  return {
    ...底,
    state: 状态({
      caseId, stage: 'resume_submission', status: 'waiting', step: 'awaiting_resume_parse',
      needsUser: false,
    }),
    needsAction: false,
    availableActions: [],
    stages: [
      { ...阶段区组()[0]!, state: 'passed', summary: 'complete', transcript: [], instructionReceipts: [] },
      { ...阶段区组()[1]!, state: 'active', occurredAt: '2026-08-29T01:30:00Z', summary: 'awaiting_resume_parse' },
      ...阶段区组().slice(2),
    ],
    terminalSummary: null,
  };
}
export function 招聘详情DTO(选项: 详情选项 = {}): P5详情 {
  return {
    role: 'recruiter',
    context: { candidateAlias: 选项.别名 ?? 别名, job: 冻结职位 },
    state: 选项.state ?? 状态({
      status: 'running', step: 'policy_check', needsUser: false, round: 0,
    }),
    needsAction: 选项.needsAction ?? false,
    availableActions: 选项.availableActions ?? [],
    stages: 选项.stages ?? 阶段区组(),
    currentCoordination: 选项.currentCoordination ?? null,
    intentConfirmations: 选项.intentConfirmations ?? { candidate: '', recruiter: '' },
    terminalSummary: 选项.terminalSummary ?? null,
    conversationRef: 选项.conversationRef ?? null,
    matchScore: null,
    jobDetail: null,
    ...P5历史连续块,
    candidateResume: null,
    candidateIdentity: { state: 'anonymous', name: null, avatar_url: null, disclosed_at: null },
  };
}

/** ended 终局详情（S0 ended、终局摘要齐备、零动作零待办）。 */
export function 已终止详情DTO(): P5详情 {
  return 候选详情DTO({
    state: 状态({
      lifecycle: 'ended', status: 'ended', step: 'complete', needsUser: false,
      outcome: 'user_ended', outcomeCode: 'user_ended', finalizedAt: '2026-08-29T03:00:00Z',
    }),
    needsAction: false,
    availableActions: [],
    stages: 阶段区组({ anonymous_screening: { state: 'ended', summary: 'complete' } }),
    terminalSummary: {
      stage: 'anonymous_screening', outcome: 'user_ended', reasonSummary: 'user_ended',
      finalizedAt: '2026-08-29T03:00:00Z',
    },
  });
}

/** 矩阵外四元组（open+needs_user 却给 handoff_pending）：decode 挡得住的漂移若仍进
 *  快照，展示映射必须 fail closed —— 不需要任何 as。 */
export function 契约外详情DTO(): P5详情 {
  return 候选详情DTO({ state: 状态({ step: 'handoff_pending' }) });
}

export function 详情快照(选项: {
  阶段?: P5详情快照['阶段'];
  detail?: P5详情 | null;
  error?: string | null;
  刷新中?: boolean;
} = {}): P5详情快照 {
  return {
    阶段: 选项.阶段 ?? '成功',
    刷新中: 选项.刷新中 ?? false,
    detail: 选项.detail ?? null,
    error: 选项.error ?? null,
    generation: 1,
  };
}

// ── J-PILOT-01 Task 5：候选聚合夹具（NegotiationDetail 已 decode 形状）──
// 候选分支只读 continuous detail：置详情状态 把 快照.detail 包装进 P5连续详情 槽
// （canonical 键落位，同状态层 保存候选聚合快照）；pre-Case/alias 用 连续快照 显式覆盖。

export function 连续详情DTO(选项: {
  recordId?: string;
  caseId?: string | null;
  phase?: NegotiationDetail['phase'];
  needsAction?: boolean;
  shelf?: NegotiationDetail['shelf'];
  failure?: NegotiationDetail['failure'];
  refusalCode?: NegotiationDetail['refusal_code'];
  actions?: Partial<NegotiationDetail['actions']>;
  caseDetail?: NegotiationDetail['case_detail'];
  publicEvaluation?: NegotiationDetail['agent_summary']['public_evaluation'];
} = {}): NegotiationDetail {
  const recordId = 选项.recordId ?? 'mc_direct';
  const recordKind = recordId.startsWith('dlg_') ? ('delegation' as const) : ('case' as const);
  const caseDetail = 选项.caseDetail ?? null;
  const phase = 选项.phase ?? (caseDetail !== null ? 'case_started' : 'accepted');
  return {
    needs_action: 选项.needsAction ?? true,
    record_id: recordId,
    record_kind: recordKind,
    intention_id: 意向ID,
    job: {
      job_id: 职位ID,
      title: '平台工程师',
      location: '上海',
      public_salary_range: '25-40K·16薪',
      availability: 'available',
      organization: null,
      required_skills: null,
      recruitment_type: null,
      workplace_mode: null,
      annual_salary_months: null,
    },
    delegation_id: recordKind === 'delegation' ? 'dlg_rcpt_01' : null,
    evaluation_id: phase === 'accepted' || phase === 'evaluating' ? 'ev_01' : null,
    case_id: 选项.caseId !== undefined
      ? 选项.caseId
      : caseDetail !== null ? caseDetail.state.caseId : null,
    shelf: 选项.shelf ?? 'active',
    phase,
    case_state: caseDetail !== null ? caseDetail.state : null,
    failure: 选项.failure ?? null,
    refusal_code: 选项.refusalCode ?? null,
    actions: { retry: false, archive: false, open_case: false, ...选项.actions },
    retry_generation: 0,
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T09:00:00Z',
    archived_at: null,
    match_score: null,
    evaluation: null,
    case_detail: caseDetail,
    failure_history: [],
    agent_summary: {
      public_evaluation: 选项.publicEvaluation === undefined ? null : 选项.publicEvaluation,
      condition_confirmation: null,
    },
    job_detail: null,
  };
}

export function 连续详情快照(选项: {
  聚合?: NegotiationDetail | null;
  阶段?: P5连续详情快照['阶段'];
  error?: string | null;
  刷新中?: boolean;
} = {}): P5连续详情快照 {
  return {
    ownerSubjectId: 'sub_1',
    阶段: 选项.阶段 ?? '成功',
    刷新中: 选项.刷新中 ?? false,
    detail: 选项.聚合 === undefined ? 连续详情DTO() : 选项.聚合,
    error: 选项.error ?? null,
    generation: 1,
  };
}

/** 组件级状态底座：只喂 MatchCase详情 会读的字段（列表记忆刻意缺席 —— 直达刷新不读它）。 */
export function 置详情状态(选项: {
  role: P5角色;
  caseId?: string;
  /** Case 内容载体：candidate 由它包装聚合 case_detail；recruiter 是 P5详情 槽本体。 */
  快照?: P5详情快照;
  /** candidate 显式覆盖连续槽（pre-Case/alias/retention 专用）；缺省按 快照 包装。 */
  连续快照?: P5连续详情快照;
  不预置快照?: boolean;
  /** 轮询栅栏用：后端主体当前角色（缺省与组件角色一致 = 会话有效） */
  登录角色?: BFF主体['last_used_role'];
  已登录?: boolean;
}) {
  const caseId = 选项.caseId ?? 'mc_direct';
  const 包装连续快照 = 选项.快照 === undefined
    ? 连续详情快照()
    : 连续详情快照({
      阶段: 选项.快照.阶段,
      刷新中: 选项.快照.刷新中,
      error: 选项.快照.error,
      聚合: 选项.快照.detail === null ? null : 连续详情DTO({ caseDetail: 选项.快照.detail }),
    });
  mock应用状态 = {
    数据源模式: 'backend',
    派发: mock派发,
    状态: {},
    后端状态: {
      已登录: 选项.已登录 ?? true,
      主体: {
        subject_id: 'sub_1',
        roles: [{ role: 选项.role, status: 'active' }],
        last_used_role: 选项.登录角色 === undefined ? 选项.role : 选项.登录角色,
      },
      P5详情: 选项.不预置快照 === true ? {} : 选项.role === 'recruiter' ? {
        [P5范围键.detail(选项.role, caseId)]: 选项.快照 ?? 详情快照(),
      } : {},
      // 候选连续槽只按 canonical record_id 落位；显式 连续快照 用其聚合 record_id 作键
      P5连续详情: 选项.role === 'candidate' && 选项.不预置快照 !== true
        ? 选项.连续快照 !== undefined
          ? { [P5范围键.negotiation(选项.连续快照.detail?.record_id ?? caseId)]: 选项.连续快照 }
          : { [P5范围键.negotiation(caseId)]: 包装连续快照 }
        : {},
    },
    操作: mock操作,
  };
  return caseId;
}

/** 双端路由：求职端 /deal/:id、招聘端 /hr/candidate/:id（包壳屏各自拥有路由，这里同形）。 */
export function 渲染详情(role: P5角色, caseId: string) {
  const 详情 = 已登记!;
  const 地址 = role === 'candidate' ? `/deal/${caseId}` : `/hr/candidate/${caseId}`;
  const 模板 = role === 'candidate' ? '/deal/:id' : '/hr/candidate/:id';
  return render(
    <MemoryRouter initialEntries={[地址]}>
      <Routes>
        {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
        <Route path={模板} element={<详情 role={role} />} />
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * 终局时间的期望值：用 Date 的本地 getter 独立推出 `YYYY-MM-DD HH:mm`，
 * 与 mapper 的 Intl 路径各算各的（生产跟随用户环境时区，测试按进程 TZ 取期望）。
 */
export function 本地终局期望(原文: string): string {
  const 时刻 = new Date(原文);
  const 补 = (数: number) => String(数).padStart(2, '0');
  return `${时刻.getFullYear()}-${补(时刻.getMonth() + 1)}-${补(时刻.getDate())}`
    + ` ${补(时刻.getHours())}:${补(时刻.getMinutes())}`;
}

/** 测试外置可控 promise：手动决定 settle 时机（回答 in-flight 夹具用）。 */
export function 可控Promise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** 测试本地导航钮：同一 Route 内推入新路径 —— MatchCase详情 保持挂载、caseId 切换，
 *  对应生产里从一单详情直切另一单（不重挂载，恰是 准备代际 栅栏要挡的场景）。 */
export function 测试换Case钮({ 目标, 文案 }: { 目标: string; 文案: string }) {
  const 导航 = useNavigate();
  return <button type="button" onClick={() => 导航(目标)}>{文案}</button>;
}

/** 测试本地地址行：把当前路由地址印进 DOM，钉住「切 Tab 不改 URL」（外壳 Tab 是页内状态）。 */
export function 测试地址行() {
  const 位置 = useLocation();
  return <div>{位置.pathname + 位置.search}</div>;
}

// ══ Task 6 夹具：各可见卡行（Task 2 pin）的详情 DTO + Plan 1 附件库样本 ══

export const 协同问题ID = 'cdi_0123456789abcdef0123456789abcdef';
/** 候选人自己已绑定的 S1 附件（重试卡的 typed 坐标唯一来源）。 */
export const 绑定附件 = {
  fileId: 'rf_00000000000000000000000000000007',
  fileVersionId: 'rfv_00000000000000000000000000000007',
  displayName: '后端工程师_简历_v1.pdf',
};
/** 披露后招聘端 S1 区的 typed 附件（PDF 按钮的唯一授权）。 */
export const 已披露附件 = {
  fileId: 'rf_00000000000000000000000000000009',
  fileVersionId: 'rfv_00000000000000000000000000000009',
  displayName: '后端工程师_简历_v2.pdf',
};

/** 32 位十六进制填充（附件库样本 id 与 wire pattern 同形）。 */
export function 填充十六(序: number): string {
  return String(序).padEnd(32, '0').slice(0, 32);
}

export function 附件库样本(条数: number): BFF附件简历库 {
  return {
    items: Array.from({ length: 条数 }, (_, 下标) => {
      const 序 = 下标 + 1;
      return {
        file_id: `rf_${填充十六(序)}`,
        display_name: `简历_v${序}.pdf`,
        revision: 1,
        current_version: {
          version_id: `rfv_${填充十六(序)}`,
          version: 1,
          size_bytes: 2048,
          media_type: 'application/pdf' as const,
          sha256: '0'.repeat(64),
          created_at: '2026-08-29T00:00:00Z',
          parse: { status: 'succeeded' as const, parse_id: `rp_${序}`, updated_at: '2026-08-29T00:00:00Z' },
        },
        created_at: '2026-08-29T00:00:00Z',
        updated_at: '2026-08-29T00:00:00Z',
      };
    }),
    limits: { max_files: 5, max_file_bytes: 10485760, accepted_media_types: ['application/pdf' as const] },
  };
}

/** S0 passed 行：邀请二卡只在此行可见；S0 区已 passed，动作区仍必须可见可用。 */
export function S0邀请详情(): P5详情 {
  return 候选详情DTO({
    state: 状态({ status: 'passed', step: 'awaiting_candidate_resume_invitation', needsUser: false }),
    needsAction: true,
    availableActions: ['accept_resume_invitation', 'decline_resume_invitation'],
    stages: 阶段区组({
      anonymous_screening: { state: 'passed', summary: '匿名初筛已通过，等待候选人回应简历邀请' },
    }),
  });
}

/** S1 waiting 行（候选）：重试卡 + 本人已绑定附件。 */
export function S1等待详情(带绑定: boolean): P5详情 {
  return 候选详情DTO({
    state: 状态({ stage: 'resume_submission', status: 'waiting', step: 'awaiting_resume_parse', needsUser: false }),
    needsAction: true,
    availableActions: ['retry_resume_readiness'],
    stages: 阶段区组({
      anonymous_screening: { state: 'passed', summary: '匿名初筛已通过' },
      resume_submission: {
        state: 'active', summary: '简历已提交，等待校验',
        attachment: 带绑定 ? 绑定附件 : null,
      },
    }),
  });
}

/** S1 needs_user 行（候选）：重试 + 更换二卡。 */
export function S1更换详情(): P5详情 {
  return 候选详情DTO({
    state: 状态({ stage: 'resume_submission', status: 'needs_user', step: 'awaiting_resume_parse' }),
    needsAction: true,
    availableActions: ['retry_resume_readiness', 'replace_resume'],
    stages: 阶段区组({
      anonymous_screening: { state: 'passed', summary: '匿名初筛已通过' },
      resume_submission: {
        state: 'active', summary: '简历校验未通过，等待候选人处理', attachment: 绑定附件,
      },
    }),
  });
}

/** S1 needs_user 行（招聘）：初筛结论卡；S1 区带已披露 typed 附件。
 *  带段内对话 = 再给 S1 段一条带文本时间线 + 一条本端叮嘱回执（终审回归钉用：
 *  段内有对话内容时 PDF 入口不得被压掉）。 */
export function S1初筛详情(带附件: boolean, 带段内对话 = false): P5详情 {
  return 招聘详情DTO({
    state: 状态({
      caseId: 'mc_hr', stage: 'resume_submission', status: 'needs_user',
      step: 'awaiting_recruiter_decision', needsUser: true,
    }),
    needsAction: true,
    availableActions: ['decide_resume_screening'],
    stages: 阶段区组({
      anonymous_screening: { state: 'passed', summary: '匿名初筛已通过' },
      resume_submission: {
        state: 'active', summary: '简历已披露，等待初筛结论',
        transcript: 带段内对话 ? [{
          eventId: 'evt_s1_submitted', stage: 'resume_submission', kind: 'resume_submitted',
          role: '', occurredAt: '2026-08-29T02:30:00Z',
        }] : [],
        instructionReceipts: 带段内对话 ? [{
          instructionId: 'aci_s1', owner: 'recruiter', stage: 'resume_submission',
          expression: '只在工作日 10:00-19:00 联系', occurredAt: '2026-08-29T02:31:00Z',
        }] : [],
        attachment: 带附件 ? 已披露附件 : null,
      },
    }),
  });
}

/** S1 waiting 行（招聘）：解析中附件保持闭合 —— 无姓名/联系方式/PDF 入口。 */
export function S1解析中详情(): P5详情 {
  return 招聘详情DTO({
    state: 状态({
      caseId: 'mc_hr', stage: 'resume_submission', status: 'waiting',
      step: 'awaiting_resume_parse', needsUser: false,
    }),
    needsAction: false,
    availableActions: [],
    stages: 阶段区组({
      anonymous_screening: { state: 'passed', summary: '匿名初筛已通过' },
      resume_submission: { state: 'active', summary: '正在解析简历', transcript: [], attachment: null },
    }),
  });
}

/** S1 waiting + screening_resume（招聘）：AI 初筛进行中 —— 克隆 S1初筛详情(true) 后
 *  只改 state 四元组与动作侧：waiting 行 + 空动作表，AI 文案在场、零决策控件。 */
export function S1AI初筛详情(): P5详情 {
  const 基座 = S1初筛详情(true);
  return {
    ...基座,
    state: { ...基座.state, status: 'waiting', step: 'screening_resume', needsUser: false },
    needsAction: false,
    availableActions: [],
  };
}

/** S2 行（双端）：协同卡 + 当前协同块。 */
export function S2详情(
  role: P5角色,
  协同: P5详情['currentCoordination'],
  状态覆盖: Partial<P5列表项['state']> = {},
): P5详情 {
  const 公共 = {
    needsAction: true,
    availableActions: ['decide_coordination'] as P5详情['availableActions'],
    stages: 阶段区组({
      anonymous_screening: { state: 'passed', summary: '匿名初筛已通过' },
      resume_submission: { state: 'passed', summary: '简历初筛已通过' },
      needs_coordination: { state: 'active', summary: '存在待确认的差异事项' },
    }),
    currentCoordination: 协同,
  };
  return role === 'candidate'
    ? 候选详情DTO({
        ...公共,
        state: 状态({ stage: 'needs_coordination', status: 'needs_user', step: 'coordinating', ...状态覆盖 }),
      })
    : 招聘详情DTO({
        ...公共,
        state: 状态({
          caseId: 'mc_hr', stage: 'needs_coordination', status: 'needs_user',
          step: 'coordinating', ...状态覆盖,
        }),
      });
}

/** S3 行（双端）：意向卡按本端意向词栅栏。 */
export function S3详情(
  role: P5角色,
  意向: P5详情['intentConfirmations'],
  动作: P5详情['availableActions'] = ['confirm_intent', 'decline_intent'],
  步骤: P5列表项['state']['step'] = 'awaiting_confirmations',
): P5详情 {
  const 公共 = {
    needsAction: 动作.length > 0,
    availableActions: 动作,
    stages: 阶段区组({
      anonymous_screening: { state: 'passed', summary: '匿名初筛已通过' },
      resume_submission: { state: 'passed', summary: '简历初筛已通过' },
      needs_coordination: { state: 'passed', summary: '差异事项已确认' },
      intent_confirmation: { state: 'active', summary: '等待双方确认意向' },
    }),
    intentConfirmations: 意向,
  };
  return role === 'candidate'
    ? 候选详情DTO({ ...公共, state: 状态({ stage: 'intent_confirmation', status: 'needs_user', step: 步骤 }) })
    : 招聘详情DTO({
        ...公共,
        state: 状态({
          caseId: 'mc_hr', stage: 'intent_confirmation', status: 'needs_user', step: 步骤,
        }),
      });
}

/** P7 Task 6：completed + complete + conversation_ref —— 会话已发布的权威移交形态。 */
export function 已发布移交详情DTO(role: P5角色 = 'candidate'): P5详情 {
  const 底 = 已完成移交详情DTO();
  const 已发布 = { ...底, state: { ...底.state, step: 'complete' as const }, conversationRef: '3003' };
  return role === 'candidate'
    ? 已发布
    : {
      ...已发布,
      role,
      context: { candidateAlias: 别名, job: 底.context.job },
      candidateResume: null,
      candidateIdentity: { state: 'anonymous', name: null, avatar_url: null, disclosed_at: null },
    };
}

/** completed + handoff_pending：双方已确认的终局移交（第二次确认后的权威形态）。 */
export function 已完成移交详情DTO(): P5详情 {
  return 候选详情DTO({
    state: 状态({
      lifecycle: 'completed', stage: 'intent_confirmation', status: 'passed', step: 'handoff_pending',
      needsUser: false, outcome: null, outcomeCode: null, finalizedAt: '2026-08-29T04:00:00Z',
    }),
    needsAction: false,
    availableActions: [],
    stages: 阶段区组({
      anonymous_screening: { state: 'passed' },
      resume_submission: { state: 'passed' },
      needs_coordination: { state: 'passed' },
      intent_confirmation: { state: 'passed', summary: '双方已确认意向' },
    }),
    intentConfirmations: { candidate: 'confirm', recruiter: 'confirm' },
    terminalSummary: { stage: 'intent_confirmation', outcome: '', reasonSummary: '', finalizedAt: '2026-08-29T04:00:00Z' },
  });
}

// ══ Task 7 夹具：completed + handoff_pending 的招聘端镜像 ══

/** completed + handoff_pending（招聘端）：移交文案 + 恒禁用的「开始私聊」，零 mutation。 */
export function 招聘已完成移交DTO(): P5详情 {
  return 招聘详情DTO({
    state: 状态({
      caseId: 'mc_done', lifecycle: 'completed', stage: 'intent_confirmation', status: 'passed',
      step: 'handoff_pending', needsUser: false, outcome: null, outcomeCode: null,
      finalizedAt: '2026-08-29T04:00:00Z',
    }),
    needsAction: false,
    availableActions: [],
    stages: 阶段区组({
      anonymous_screening: { state: 'passed' },
      resume_submission: { state: 'passed' },
      needs_coordination: { state: 'passed' },
      intent_confirmation: { state: 'passed', summary: '双方已确认意向' },
    }),
    intentConfirmations: { candidate: 'confirm', recruiter: 'confirm' },
    terminalSummary: { stage: 'intent_confirmation', outcome: '', reasonSummary: '', finalizedAt: '2026-08-29T04:00:00Z' },
  });
}

// ══ Hosted Agent 失败合同：owner-safe agent_attention 只给安全说明，零重试入口 ══

/** S1 attention 合法行（open|resume_submission|attention_required|screening_resume）：
 *  行侧白名单为空（零动作卡），needsAction 可真可假 —— 徽标归属按 viewer 待办优先。 */
export function 注意详情DTO(role: P5角色, needsAction: boolean): P5详情 {
  const state = 状态({
    ...(role === 'recruiter' ? { caseId: 'mc_hr' } : {}),
    stage: 'resume_submission', status: 'attention_required', step: 'screening_resume',
    needsUser: false,
    agentAttention: { code: 'agent_unavailable', retryable: false },
  });
  // 段与 state 同相：S1 是当前段（active），S0 已过 —— 胶囊/说明都落当前段
  const stages = 阶段区组({
    anonymous_screening: { state: 'passed', summary: 'complete' },
    resume_submission: { state: 'active', summary: 'screening_resume' },
  });
  return role === 'candidate'
    ? 候选详情DTO({ state, needsAction, availableActions: [], stages })
    : 招聘详情DTO({ state, needsAction, availableActions: [], stages });
}

// ══ Task 3 夹具：S0 screening records 完整记录（问答 + 初评/复评总结）══

/** S0 详情的招聘端别名刻意不含 candidate/recruiter 字样：禁词断言按整页 body 文本算。 */
export const S0别名 = 'hr-0123456789ab';

/**
 * S0 完整记录样本：轮次 1–4，三种未回答状态齐备（同轮问答各最多一条、答必命中同轮问）。
 * question 时间故意横跨旧时间线两侧（旧 transcript 是 2026-08-29T01:10Z）——
 * 段内顺序固定，若实现按时间混排就会把 08-30 的问答插到旧时间线后面。
 */
export function S0记录样本(): P5S0筛选记录 {
  return {
    messages: [
      { id: 's0q_1', kind: 'question', role: 'candidate', stage: 'anonymous_screening', askingRole: 'candidate', round: 1, text: '需要确认岗位的值班安排。', exchangeRef: null, occurredAt: '2026-08-23T10:01:00Z' },
      { id: 's0a_1', kind: 'answer', role: 'recruiter', stage: 'anonymous_screening', askingRole: 'candidate', round: 1, answerStatus: 'answered', answerSource: 'agent', text: '没有固定晚班，周末偶尔需要支援。', occurredAt: '2026-08-23T10:05:00Z' },
      { id: 's0q_2', kind: 'question', role: 'candidate', stage: 'anonymous_screening', askingRole: 'candidate', round: 2, text: '还需要了解团队规模。', exchangeRef: null, occurredAt: '2026-08-30T09:00:00Z' },
      { id: 's0a_2', kind: 'answer', role: 'recruiter', stage: 'anonymous_screening', askingRole: 'candidate', round: 2, answerStatus: 'declined', answerSource: 'agent', occurredAt: '2026-08-30T09:02:00Z' },
      { id: 's0q_3', kind: 'question', role: 'candidate', stage: 'anonymous_screening', askingRole: 'candidate', round: 3, text: '平时出差频率如何？', exchangeRef: null, occurredAt: '2026-08-30T09:10:00Z' },
      { id: 's0a_3', kind: 'answer', role: 'recruiter', stage: 'anonymous_screening', askingRole: 'candidate', round: 3, answerStatus: 'unknown', answerSource: 'agent', occurredAt: '2026-08-30T09:12:00Z' },
      { id: 's0q_4', kind: 'question', role: 'candidate', stage: 'anonymous_screening', askingRole: 'candidate', round: 4, text: '带团队的人数规模？', exchangeRef: null, occurredAt: '2026-08-30T09:20:00Z' },
      { id: 's0a_4', kind: 'answer', role: 'recruiter', stage: 'anonymous_screening', askingRole: 'candidate', round: 4, answerStatus: 'not_available', answerSource: 'agent', occurredAt: '2026-08-30T09:22:00Z' },
    ],
    summaries: [
      { id: 's0sum_1', phase: 'initial', summary: '初评已确认岗位在浦东园区，值班安排仍待确认。', occurredAt: '2026-08-23T10:06:00Z' },
      { id: 's0sum_2', phase: 'reevaluation', round: 1, summary: '已确认没有固定晚班，团队规模仍待确认。', occurredAt: '2026-08-30T09:30:00Z' },
      { id: 's0sum_3', phase: 'reevaluation', round: 2, summary: '团队规模初步确认为 6 人。', occurredAt: '2026-08-30T09:40:00Z' },
    ],
  };
}

/**
 * S0 完整记录详情：candidate 端带初评+复评总结；recruiter 端同批 messages、恒空总结
 * （合同口径：候选端小结绝不下发招聘端）。其余字段用基线夹具（含 typed 附件），
 * 钉住「新记录不挤掉旧要素」。
 */
export function S0完整记录详情(role: P5角色, 选项: 详情选项 = {}): P5详情 {
  const 记录 = S0记录样本();
  const stages = 阶段区组({
    anonymous_screening: {
      attachment: 绑定附件,
      screeningRecords: role === 'candidate'
        ? 记录
        : { messages: 记录.messages, summaries: [] },
    },
  });
  return role === 'candidate'
    ? 候选详情DTO({ ...选项, stages })
    : 招聘详情DTO({ ...选项, stages, 别名: S0别名 });
}

/**
 * S1 open 行 + S0 附件/记录在场：非 S0 的叮嘱输入态 + typed 附件弹层（J-PILOT-01，Spec §7
 * 「进入 S1 后按真实当前阶段恢复既有非 S0 行为」；S0 段历史记录可回看）。
 */
export function S1完整记录详情(role: P5角色): P5详情 {
  const 底 = S0完整记录详情(role);
  return {
    ...底,
    state: {
      ...底.state!,
      stage: 'resume_submission', status: 'waiting', step: 'awaiting_resume_parse', needsUser: false,
    },
    availableActions: [],
    stages: 底.stages!.map((区) => 区.stage === 'anonymous_screening'
      ? { ...区, state: 'passed' as const, summary: 'complete' }
      : 区.stage === 'resume_submission'
        ? { ...区, state: 'active' as const, occurredAt: '2026-08-29T01:30:00Z', summary: 'awaiting_resume_parse', attachment: 绑定附件 }
        : 区),
    terminalSummary: null,
  };
}

/** S0 消息时间的期望值：用 Date 本地 getter 独立推出 HH:mm（与页面 Intl formatter 各算各的）。 */
export function 本地时分期望(原文: string): string {
  const 时刻 = new Date(原文);
  const 补 = (数: number) => String(数).padStart(2, '0');
  return `${补(时刻.getHours())}:${补(时刻.getMinutes())}`;
}

/** 双端路由树（可复用元素引用：轮询式 rerender 用同一棵树喂新快照）。 */
export function S0详情树(role: P5角色, caseId: string) {
  const 详情 = 已登记!;
  const 地址 = role === 'candidate' ? `/deal/${caseId}` : `/hr/candidate/${caseId}`;
  const 模板 = role === 'candidate' ? '/deal/:id' : '/hr/candidate/:id';
  return (
    <MemoryRouter initialEntries={[地址]}>
      <Routes>
        {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
        <Route path={模板} element={<详情 role={role} />} />
      </Routes>
    </MemoryRouter>
  );
}
