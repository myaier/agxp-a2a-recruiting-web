// 后端正常详情 · 组件测试（契约 C，Task 9）：只在正常联合成立时挂载的正常详情子组件。
// 原 屏幕/P5/MatchCase详情 的 详情主体/阶段动作区 连接职责原样搬入 —— 内部无条件调用
// use后端详情动作 与 useCasePDF预览，把结果组装为 A/B 纯展示 props、动作卡与弹层。
// 覆盖：
//   · 组装：共用外壳两 Tab、状态区、阶段流（尾部动作卡经 详情动作卡 渲染一次）、
//     typed 附件入口走 Case 专属 PDF 路径、S1 底栏输入态照常可发（Tab 切换不改变发送
//     Case，草稿不丢）；J-PILOT-01（Spec §7）：S0 respond_fact 零输入、底栏原控件禁用；
//   · 刷新合法可空字段由有值→null：附件入口消失（旧回调不再可点）、ready 移交退回
//     pending（旧 conversation_ref 的导航回调不可达）—— 不残留旧入口或旧执行回调；
//   · 终局：底栏只读且零发送、终局摘要卡在场、无任何动作控件。
// 夹具走真实 映射P5详情 与 decoder 已接受的 DTO（不给 P5 加字段造样本）。
// 仓库未装 @testing-library/jest-dom，用 toBeTruthy / disabled 属性断言。

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo, useState } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 后端详情渲染, 后端正常详情 } from './后端正常详情';
import type { 后端正常资源, 后端连续资源 } from './use后端详情控制';
import { 从P5到详情分段, 从P5到详情顶栏, 从P5到职位资料, P5阶段共用名 } from '../../数据/详情展示映射';
import {
  从连续到详情分段,
  从连续到详情顶栏,
  从连续到详情状态,
  从连续到职位资料,
  映射公开初评,
  映射连续底栏,
} from '../../数据/连续代谈展示映射';
import { 映射P5详情, 映射S0底栏说明 } from '../../数据/MatchCase展示映射';
import { 路径 } from '../../路由/路径表';
import { 从BFF到在线简历展示 } from '../../数据/在线简历展示映射';
import type { P5详情正常视图 } from '../../数据/MatchCase展示映射';
import type { P5列表项, P5详情, P5阶段区, P5简历附件 } from '../../数据/招聘数据源/MatchCase';
import type { NegotiationDetail } from '../../数据/招聘数据源/连续代谈';
import type { 公开初评托盘视图 } from '../../数据/连续代谈展示映射';
import {
  BFF安全职位资料样本,
  BFF候选在线简历样本,
  BFF候选身份披露样本,
} from '../../测试/展示资料样本';
import { P5历史连续块 } from '../../测试/BFF样本';

const mock跳转 = vi.fn();
vi.mock('../../路由/导航钩子', () => ({
  use导航: () => ({ 返回: vi.fn(), 跳转: mock跳转 }),
}));

const mock新增叮嘱 = vi.fn(
  async (_role: unknown, _caseId: unknown, _内容: unknown): Promise<void> => undefined,
);
const mock回答事实 = vi.fn(async (): Promise<void> => undefined);
const mock决定S0 = vi.fn(async (): Promise<void> => undefined);
const mock决定S1 = vi.fn(async (): Promise<void> => undefined);
const mock决定S2 = vi.fn(async (): Promise<void> => undefined);
const mock决定S3 = vi.fn(async (): Promise<void> => undefined);
const mock提交简历 = vi.fn(async (): Promise<void> => undefined);
const mock读取简历PDF = vi.fn(async () => ({ url: 'blob:p5-resume', revoke: () => undefined }));
const mock准备候选委托简历 = vi.fn(async (): Promise<null> => null);
const mock操作 = {
  设置P5范围: vi.fn(),
  读取详情: vi.fn(async () => undefined),
  新增叮嘱: mock新增叮嘱,
  回答事实: mock回答事实,
  决定S0: mock决定S0,
  决定S1: mock决定S1,
  决定S2: mock决定S2,
  决定S3: mock决定S3,
  回答对话: vi.fn(async (): Promise<void> => undefined),
  重新考虑: vi.fn(async (): Promise<void> => undefined),
  提交简历: mock提交简历,
  读取简历PDF: mock读取简历PDF,
  准备候选委托简历: mock准备候选委托简历,
};

// jsdom 不实现 scrollIntoView（进屏自动定位会调用它）
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

// ── 夹具（与 MatchCase详情.test 同形，只取本文件需要的行）──

const 叮嘱占位 = '有想法就告诉你的AI代理';
const 冻结职位 = {
  jobId: 'job_0123456789abcdef0123456789abcdef',
  job: { title: '平台工程师', location: '上海', publicSalaryRange: '25-40K·16薪', requiredSkills: ['Go'] },
};

function 状态(覆盖: Partial<P5列表项['state']> = {}): P5列表项['state'] {
  return {
    caseId: 'mc_direct', lifecycle: 'open', stage: 'anonymous_screening', status: 'needs_user',
    step: 'human_decision', round: 1, roundBudget: 3, needsUser: true,
    outcome: null, outcomeCode: null,
    createdAt: '2026-08-29T01:00:00Z', updatedAt: '2026-08-29T02:00:00Z', finalizedAt: null,
    agentAttention: null,
    ...覆盖,
  };
}

const 待段 = (stage: 'resume_submission' | 'needs_coordination' | 'intent_confirmation'): P5阶段区 => ({
  stage, state: 'pending', occurredAt: null, summary: '', checklist: [], transcript: [],
  instructionReceipts: [], attachment: null, screeningRecords: null,
});

function S0阶段区组(): P5阶段区[] {
  return [
    {
      stage: 'anonymous_screening', state: 'active', occurredAt: '2026-08-29T01:10:00Z',
      summary: 'candidate_reevaluation', checklist: [],
      // 问答以 screening records 为权威来源（S0–S3 展示统一 Task 4）；transcript 只留流程事件
      transcript: [
        { eventId: 'evt_c1', stage: 'anonymous_screening', kind: 'case_created', role: '', occurredAt: '2026-08-29T01:00:00Z' },
      ],
      instructionReceipts: [],
      attachment: null,
      screeningRecords: {
        messages: [{
          id: 's0q_1', kind: 'question', role: 'candidate', stage: 'anonymous_screening',
          askingRole: 'candidate', round: 1, text: '每周可以到岗几天？',
          exchangeRef: null, occurredAt: '2026-08-29T01:10:00Z',
        }],
        summaries: [],
      },
    },
    待段('resume_submission'), 待段('needs_coordination'), 待段('intent_confirmation'),
  ];
}

function 候选S0详情DTO(覆盖: { matchScore?: number | null; jobDetail?: P5详情['jobDetail'] } = {}): P5详情 {
  return {
    role: 'candidate',
    context: {
      intentionId: 'int_0123456789abcdef0123456789abcdef',
      job: 冻结职位,
    },
    state: 状态(),
    needsAction: true,
    availableActions: ['respond_fact', 'end_screening'],
    stages: S0阶段区组(),
    currentCoordination: null,
    intentConfirmations: { candidate: '', recruiter: '' },
    terminalSummary: null,
    conversationRef: null,
    // release/0.2.5：展示字段是解码层 required 成员；Task 6 起消费（旧 Case 合法 null 档）。
    matchScore: 覆盖.matchScore ?? null,
    jobDetail: 覆盖.jobDetail ?? null,
    ...P5历史连续块,
  };
}

/** S1 open 行（候选，resume_submission waiting）：非 S0 的叮嘱输入态（Spec §7）。 */
function 候选S1详情DTO(): P5详情 {
  return {
    ...候选S0详情DTO(),
    state: 状态({
      stage: 'resume_submission', status: 'waiting', step: 'awaiting_resume_parse',
      needsUser: false,
    }),
    needsAction: false,
    availableActions: [],
    stages: [
      { ...S0阶段区组()[0]!, state: 'passed', summary: '匿名初筛已通过' },
      { ...待段('resume_submission'), state: 'active', occurredAt: '2026-08-29T01:30:00Z', summary: 'awaiting_resume_parse' },
      待段('needs_coordination'), 待段('intent_confirmation'),
    ],
  };
}

const 已披露附件: P5简历附件 = {
  fileId: 'rf_00000000000000000000000000000007',
  fileVersionId: 'rfv_00000000000000000000000000000007',
  displayName: '后端工程师_简历_v2.pdf',
};

/** 招聘端 S1 初筛行（needs_user + screening）：typed 附件是该段唯一 PDF 入口。 */
function 招聘S1附件详情DTO(带附件: boolean, 覆盖: {
  candidateResume?: Extract<P5详情, { role: 'recruiter' }>['candidateResume'];
  identity?: Extract<P5详情, { role: 'recruiter' }>['candidateIdentity'];
  jobDetail?: P5详情['jobDetail'];
} = {}): P5详情 {
  return {
    role: 'recruiter',
    context: { candidateAlias: 'candidate-0123456789ab', job: 冻结职位 },
    state: 状态({
      caseId: 'mc_hr', stage: 'resume_submission', status: 'needs_user',
      step: 'awaiting_recruiter_decision', needsUser: true,
    }),
    needsAction: true,
    availableActions: ['decide_resume_screening'],
    stages: [
      {
        stage: 'anonymous_screening', state: 'passed', occurredAt: '2026-08-29T01:10:00Z',
        summary: '匿名初筛已通过', checklist: [], transcript: [], instructionReceipts: [],
        attachment: null, screeningRecords: null,
      },
      {
        stage: 'resume_submission', state: 'active', occurredAt: '2026-08-29T01:30:00Z',
        summary: '简历已披露，等待初筛结论', checklist: [], transcript: [], instructionReceipts: [],
        attachment: 带附件 ? 已披露附件 : null, screeningRecords: null,
      },
      待段('needs_coordination'), 待段('intent_confirmation'),
    ],
    currentCoordination: null,
    intentConfirmations: { candidate: '', recruiter: '' },
    terminalSummary: null,
    conversationRef: null,
    matchScore: null,
    jobDetail: 覆盖.jobDetail ?? null,
    ...P5历史连续块,
    candidateResume: 覆盖.candidateResume ?? null,
    candidateIdentity: 覆盖.identity ?? { state: 'anonymous', name: null, avatar_url: null, disclosed_at: null },
  };
}

/** completed 移交行：pending（ref 缺席）与 ready（合法 conversation_ref）。 */
function 移交详情DTO(阶段: 'pending' | 'ready'): P5详情 {
  const 底 = 候选S0详情DTO();
  return {
    ...底,
    state: 状态({
      lifecycle: 'completed', stage: 'intent_confirmation', status: 'passed',
      step: 阶段 === 'ready' ? 'complete' : 'handoff_pending', needsUser: false,
      finalizedAt: '2026-08-29T04:00:00Z',
    }),
    needsAction: false,
    availableActions: [],
    stages: [
      { ...S0阶段区组()[0]!, state: 'passed', summary: '匿名初筛已通过' },
      { ...待段('resume_submission'), state: 'passed' },
      { ...待段('needs_coordination'), state: 'passed' },
      { ...待段('intent_confirmation'), state: 'passed', summary: '双方已确认意向' },
    ],
    intentConfirmations: { candidate: 'confirm', recruiter: 'confirm' },
    terminalSummary: null,
    conversationRef: 阶段 === 'ready' ? '3003' : null,
  };
}

/** ended 终局（S0 ended、终局摘要齐备、零动作）。 */
function 已终止详情DTO(): P5详情 {
  return {
    ...候选S0详情DTO(),
    state: 状态({
      lifecycle: 'ended', status: 'ended', step: 'complete', needsUser: false,
      outcome: 'user_ended', outcomeCode: 'user_ended', finalizedAt: '2026-08-29T03:00:00Z',
    }),
    needsAction: false,
    availableActions: [],
    stages: [{ ...S0阶段区组()[0]!, state: 'ended', summary: 'complete' }, ...S0阶段区组().slice(1)],
    terminalSummary: {
      stage: 'anonymous_screening', outcome: 'user_ended', reasonSummary: 'user_ended',
      finalizedAt: '2026-08-29T03:00:00Z',
    },
  };
}

// ── 资源构造：真实 mapper + 桩操作（父控制 hook 的正常分支同形产出）──

function 取视图(详情: P5详情): P5详情正常视图 {
  const 视图 = 映射P5详情(详情);
  if (视图.kind !== '正常') throw new Error('测试夹具必须是正常视图');
  return 视图;
}

/** 底栏走父控制同款接线（S0 禁用分支同 映射S0底栏说明；草稿在父、发送直发桩）；
 *  公开初评（候选聚合独有）经 从P5到详情分段 装进 S0 段，不再有页顶托盘。 */
function 宿主({
  详情,
  caseId,
  初评 = null,
}: {
  详情: P5详情;
  caseId: string;
  初评?: 公开初评托盘视图 | null;
}) {
  const [草稿, 设草稿] = useState('');
  const 资源 = useMemo<后端正常资源>(() => {
    const 视图 = 取视图(详情);
    const 移交 = 视图.handoff;
    // Task 6：招聘角色映射 candidate_resume（候选恒 null），与父控制 hook 同口径；
    // 顶栏画像与第二 Tab 正文同吃这一份安全投影。
    const 在线简历资料 = 详情.role === 'recruiter' ? 从BFF到在线简历展示(详情.candidateResume) : null;
    // 父控制同款底栏判定：S0（双端）保留原控件但禁用（发送 null 零叮嘱请求），非 S0
    // 终局只读，S1 起进行中可输入。
    const S0禁用说明 = 映射S0底栏说明(详情.state);
    const 底栏: 后端正常资源['底栏'] = S0禁用说明 !== null
      ? { kind: '输入', 占位: S0禁用说明, 值: '', 改变: () => undefined, 发送: null, 禁用说明: S0禁用说明 }
      : 视图.终局
        ? { kind: '只读', 说明: '当前在谈已结束，仅可查看' }
        : {
            kind: '输入', 占位: 叮嘱占位, 值: 草稿, 改变: 设草稿,
            发送: () => {
              const 内容 = 草稿.trim();
              if (内容 === '') return;
              void mock新增叮嘱(详情.role, caseId, 内容).then(() => 设草稿(''));
            },
            禁用说明: null,
          };
    return {
      kind: '正常',
      canonical记录ID: null,
      顶栏: 从P5到详情顶栏(视图, 在线简历资料),
      动作段: P5阶段共用名(详情.state.stage),
      分段们: 从P5到详情分段(视图, 详情, 初评),
      职位资料: 从P5到职位资料(视图),
      在线简历资料,
      // 页尾「已确认」只来自双方确认完成事实（lifecycle completed，与父控制 hook 同口径）
      在线简历已确认: 详情.role === 'recruiter' && 详情.state.lifecycle === 'completed',
      底栏,
      终局: {
        摘要: null,
        移交: 移交 !== null
          ? {
              说明: 移交.copy,
              开始私聊: 移交.state === 'ready'
                ? {
                    键: '开始私聊', 文案: '开始私聊', 外观: '主要', 禁用说明: null,
                    执行: () => mock跳转(路径.真人会话路径(移交.conversationId)),
                  }
                : {
                    键: '开始私聊', 文案: '开始私聊', 外观: '主要', 禁用说明: '准备中',
                    执行: null,
                  },
            }
          : null,
      },
      刷新错误: null,
      重试: () => undefined,
      当前段引用: { current: null },
      动作输入: { role: 详情.role, caseId, 视图, 详情, 操作: mock操作 },
      PDF输入: { role: 详情.role, caseId, 读取: mock读取简历PDF },
    };
  }, [详情, caseId, 草稿, 初评]);
  return <后端正常详情 资源={资源} />;
}

beforeEach(() => {
  mock新增叮嘱.mockClear();
  mock读取简历PDF.mockClear();
  mock跳转.mockClear();
  mock回答事实.mockClear();
  mock决定S0.mockClear();
  mock决定S1.mockClear();
  mock提交简历.mockClear();
});

describe('后端正常详情 · 组装（A/B 纯展示 props + 动作卡 + 弹层）', () => {
  it('外壳两 Tab + 状态区 + 阶段流：动作卡只经共用卡渲染一次；S0 零输入且底栏原控件禁用', () => {
    render(<宿主 详情={候选S0详情DTO()} caseId="mc_direct" />);
    expect(screen.getByText('平台工程师 · 公司信息缺失')).toBeTruthy(); // 顶栏（mapper 投影，公司槽原位保留）
    expect(screen.getByRole('button', { name: '代谈进度' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '职位详情' })).toBeTruthy();
    expect(screen.getByText('轮次 1/3')).toBeTruthy(); // 状态区
    expect(screen.getByText('每周可以到岗几天？')).toBeTruthy(); // 阶段流（系统状态行）
    // J-PILOT-01（Spec §7）：S0 respond_fact 零输入 —— 无回答框/提交键，旧 S0 行给待核实说明
    expect(screen.queryByRole('textbox', { name: '回答问题' })).toBeNull();
    expect(screen.queryByRole('button', { name: '提交回答' })).toBeNull();
    expect(screen.getByText('旧版状态待核实，请交负责人处理')).toBeTruthy();
    // review-r1（Spec §7「停止该卡交互」）：旧 S0 needs_user 行的 end_screening 卡不再出
    //（旧响应仍携带时被行白名单摘除挡下）；既有 end/邀请路径见 S0 passed 行用例
    expect(screen.queryByRole('button', { name: '结束初筛' })).toBeNull();
    // 底栏：原 textarea 保留但真实禁用，placeholder 为 S0 文案（不是只读 div）
    const 框 = screen.getByPlaceholderText('双方 AI 代理正在确认条件') as HTMLTextAreaElement;
    expect(框.disabled).toBe(true);
    expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('S0 双端零人工输入：Enter、点击、状态切换迟到回调零 POST', async () => {
    const user = userEvent.setup();
    render(<宿主 详情={候选S0详情DTO()} caseId="mc_direct" />);
    const 框 = screen.getByPlaceholderText('双方 AI 代理正在确认条件') as HTMLTextAreaElement;
    fireEvent.keyDown(框, { key: 'Enter' });
    await user.click(screen.getByRole('button', { name: '发送' }));
    fireEvent.change(框, { target: { value: '不该写进去' } });
    expect(mock新增叮嘱).not.toHaveBeenCalled(); // Enter/点击/程序回调均零 POST
    expect(mock回答事实).not.toHaveBeenCalled();
  });

  it('Tab 不改变发送 Case：切资料再切回，草稿保留、发送仍带原 caseId（S1 输入态）', async () => {
    const user = userEvent.setup();
    render(<宿主 详情={候选S1详情DTO()} caseId="mc_direct" />);
    const 框 = screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement;
    await user.type(框, '周五也可以到岗');
    await user.click(screen.getByRole('button', { name: '职位详情' }));
    // 底栏在外壳层（不随 Tab 槽互斥卸载）：草稿原样
    const 框2 = screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement;
    expect(框2.value).toBe('周五也可以到岗');
    await user.click(screen.getByRole('button', { name: '代谈进度' }));
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(mock新增叮嘱).toHaveBeenCalledTimes(1);
    expect(mock新增叮嘱).toHaveBeenCalledWith('candidate', 'mc_direct', '周五也可以到岗');
  });

  it('typed 附件在场：入口只走 Case 专属 role 路径，弹层以租约地址呈现，关闭即回收', async () => {
    const user = userEvent.setup();
    const 租约 = { url: 'blob:p5-resume', revoke: vi.fn() };
    mock读取简历PDF.mockResolvedValue(租约);
    render(<宿主 详情={招聘S1附件详情DTO(true)} caseId="mc_hr" />);
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v2\.pdf/ }));
    expect(mock读取简历PDF).toHaveBeenCalledTimes(1);
    expect(mock读取简历PDF).toHaveBeenCalledWith('recruiter', 'mc_hr');
    const 弹层 = await screen.findByRole('dialog', { name: '简历原件' });
    expect((within(弹层).getByTitle('简历 PDF') as HTMLIFrameElement).getAttribute('src')).toBe('blob:p5-resume');
    await user.click(within(弹层).getByRole('button', { name: '关闭' }));
    expect(租约.revoke).toHaveBeenCalledTimes(1);
  });
});

describe('后端正常详情 · 同一 Case 刷新可空字段有值→null', () => {
  it('typed 附件退场：PDF 入口消失，旧入口不可再点（零请求）', () => {
    const 页 = render(<宿主 详情={招聘S1附件详情DTO(true)} caseId="mc_hr" />);
    expect(screen.getByRole('button', { name: /后端工程师_简历_v2\.pdf/ })).toBeTruthy();
    // 权威重读后附件合法地变 null（decoder 接受的输入），同一挂载组件 rerender
    页.rerender(<宿主 详情={招聘S1附件详情DTO(false)} caseId="mc_hr" />);
    expect(screen.queryByRole('button', { name: /后端工程师_简历_v2\.pdf/ })).toBeNull();
    expect(screen.queryByText('后端工程师_简历_v2.pdf')).toBeNull(); // 不残留旧附件入口
    expect(mock读取简历PDF).not.toHaveBeenCalled(); // 旧执行回调不再可达
  });

  it('ready 移交退回 pending：私聊键禁用，旧 conversation_ref 的导航不可达（装 S3 段尾）', async () => {
    const user = userEvent.setup();
    const 页 = render(<宿主 详情={移交详情DTO('ready')} caseId="mc_direct" />);
    // 移交装在意向确认段尾（顶部终局卡退场）：completed 的 S3 默认折叠，手动展开到达
    await user.click(screen.getByRole('button', { name: /意向确认/ }));
    await user.click(screen.getByRole('button', { name: '开始私聊' }));
    expect(mock跳转).toHaveBeenCalledTimes(1);
    expect(mock跳转).toHaveBeenCalledWith(路径.真人会话路径('3003'));
    // 重读后 step 退回 handoff_pending、ref 缺席（decoder 接受）：旧导航回调不残留
    页.rerender(<宿主 详情={移交详情DTO('pending')} caseId="mc_direct" />);
    const 键 = screen.getByRole('button', { name: '开始私聊' }) as HTMLButtonElement;
    expect(键.disabled).toBe(true);
    await user.click(键);
    expect(mock跳转).toHaveBeenCalledTimes(1); // 零新导航
    expect(screen.getByText('准备中')).toBeTruthy(); // 禁用说明就地解释
  });
});

// ── 写中禁用解释（review-r1 F6，spec §5「正在提交…保留该动作位置并禁用解释」）──

/** S3 意向行（候选）：单键 确认意向 直发 决定S3（单键动作的写中夹具）。
 *  阶段区与真实 S3 行同形：S0–S2 passed、意向确认 active。 */
function 候选S3意向详情DTO(): P5详情 {
  return {
    ...候选S0详情DTO(),
    state: 状态({ stage: 'intent_confirmation', status: 'needs_user', step: 'awaiting_confirmations' }),
    availableActions: ['confirm_intent'],
    stages: [
      { ...S0阶段区组()[0]!, state: 'passed', summary: '匿名初筛已通过' },
      { ...待段('resume_submission'), state: 'passed' },
      { ...待段('needs_coordination'), state: 'passed' },
      {
        ...待段('intent_confirmation'), state: 'active',
        occurredAt: '2026-08-29T03:00:00Z', summary: 'awaiting_confirmations',
      },
    ],
    intentConfirmations: { candidate: '', recruiter: 'confirm' },
  };
}

/** 命令在飞时断言：按钮真实 disabled、说明可见且经 aria-describedby 关联到该按钮。 */
function 断言写中解释(按钮: HTMLButtonElement) {
  expect(按钮.disabled).toBe(true); // 真实禁用（不靠 onClick 缺席）
  const 说明id = 按钮.getAttribute('aria-describedby');
  expect(说明id).toBeTruthy();
  const 说明 = document.getElementById(说明id!);
  expect(说明?.textContent).toBe('正在提交，请稍候'); // 就地可见 + 可访问关联
}

describe('后端正常详情 · 写中禁用解释（review-r1 F6）', () => {
  it('双键动作（decide_resume_screening）：在飞时双键真实禁用且各自带说明，落定后恢复', async () => {
    let 送达!: () => void;
    mock决定S1.mockImplementation(() => new Promise<void>((解决) => { 送达 = 解决; }));
    render(<宿主 详情={招聘S1附件详情DTO(false)} caseId="mc_hr" />);
    const user = userEvent.setup();
    const 通过 = screen.getByRole('button', { name: '通过初筛' }) as HTMLButtonElement;
    const 不合适 = screen.getByRole('button', { name: '不合适' }) as HTMLButtonElement;
    await user.click(通过);
    // 在飞：两个键位都保留、真实 disabled、说明可见且 aria-describedby 各自关联
    断言写中解释(通过);
    断言写中解释(不合适);
    expect(screen.getAllByText('正在提交，请稍候')).toHaveLength(2);
    送达();
    await waitFor(() => {
      expect((screen.getByRole('button', { name: '通过初筛' }) as HTMLButtonElement).disabled).toBe(false);
    });
    // 落定后恢复：说明退场、按钮可再点
    expect(screen.queryByText('正在提交，请稍候')).toBeNull();
    expect(通过.getAttribute('aria-describedby')).toBeNull();
    expect((screen.getByRole('button', { name: '不合适' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('单键动作（confirm_intent）：在飞时同样真实禁用并就地解释，落定后恢复', async () => {
    let 送达!: () => void;
    mock决定S3.mockImplementation(() => new Promise<void>((解决) => { 送达 = 解决; }));
    render(<宿主 详情={候选S3意向详情DTO()} caseId="mc_direct" />);
    const user = userEvent.setup();
    const 确认 = screen.getByRole('button', { name: '确认意向' }) as HTMLButtonElement;
    await user.click(确认);
    断言写中解释(确认);
    expect(screen.getAllByText('正在提交，请稍候')).toHaveLength(1);
    送达();
    await waitFor(() => {
      expect((screen.getByRole('button', { name: '确认意向' }) as HTMLButtonElement).disabled).toBe(false);
    });
    expect(screen.queryByText('正在提交，请稍候')).toBeNull();
  });
});

describe('后端正常详情 · 终局（S0–S3 展示统一 Task 4：结束信息只入终局段）', () => {
  it('S0 其它终局：底栏原控件禁用（占位「本次代谈已结束」）、无顶部终局卡、终局段给胶囊+原因+时间', () => {
    render(<宿主 详情={已终止详情DTO()} caseId="mc_direct" />);
    const 框 = screen.getByPlaceholderText('本次代谈已结束') as HTMLTextAreaElement;
    expect(框.disabled).toBe(true);
    expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText('当前在谈已结束，仅可查看')).toBeNull(); // S0 用终局分行占位，不是通用只读条
    // 顶部终局卡退场：无「终局」标题，wire 原词一律不上屏（中文字典口径）
    expect(screen.queryByText('终局')).toBeNull();
    expect(document.body.textContent).not.toContain('user_ended');
    // 结束所在段（S0，默认展开）承载状态胶囊、原因句与本地结束时间
    expect(screen.getByText('已结束')).toBeTruthy();
    expect(screen.getByText('本次代谈已结束')).toBeTruthy();
    expect(screen.getByText(/^结束时间：\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '结束初筛' })).toBeNull(); // 零动作控件
  });
});

// ── Task 6：资料 Tab 的冻结正文、公司导航与在线简历 ─────────────────────────────

describe('后端正常详情 · 资料 Tab 冻结正文与公司导航（Task 6）', () => {
  it('候选 Case 冻结职位资料抵达真实 Tab：JD/公司名可见，有真实组织编号时公司入口可导航', async () => {
    const user = userEvent.setup();
    render(<宿主 详情={候选S0详情DTO({ matchScore: 73, jobDetail: BFF安全职位资料样本 })} caseId="mc_direct" />);
    expect(screen.getByText('平台工程师 · 云衢科技')).toBeTruthy(); // 顶栏公司名同源
    expect(screen.getByText('73')).toBeTruthy(); // 顶栏权威分（0 之外的真实值原样）
    await user.click(screen.getByRole('button', { name: '职位详情' }));
    expect(screen.getByText('参与产品工作')).toBeTruthy(); // JD 原槽
    expect(screen.getByText('云衢科技')).toBeTruthy();
    expect(screen.queryByText('当前在谈详情数据未提供')).toBeNull(); // 冻结快照在场缺口说明退场
    const 入口 = screen.getByRole('button', { name: /云衢科技/ }) as HTMLButtonElement;
    expect(入口.disabled).toBe(false);
    await user.click(入口);
    expect(mock跳转).toHaveBeenCalledWith(路径.企业详情('org_1')); // 现有 路径.企业详情
    expect(mock跳转).toHaveBeenCalledTimes(1); // 只导航，不改 Case 缓存
    expect(mock读取简历PDF).not.toHaveBeenCalled(); // 无额外自动公司/Job/Resume 请求
  });

  it('旧 Case（job_detail=null）：公司入口仍禁用并就地解释，资料区保留未知口径', async () => {
    const user = userEvent.setup();
    render(<宿主 详情={候选S0详情DTO()} caseId="mc_direct" />);
    await user.click(screen.getByRole('button', { name: '职位详情' }));
    // 名称缺失时公司头行的可访问名是「公司标志缺失—」，按图位定位入口
    const 入口 = screen.getByRole('img', { name: '公司标志缺失' }).closest('button') as HTMLButtonElement;
    expect(入口.disabled).toBe(true);
    expect(screen.getByText('公司详情暂不可用')).toBeTruthy();
    await user.click(入口);
    expect(mock跳转).not.toHaveBeenCalled();
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy();
  });

  it('招聘端 Case 资料 Tab 吃共享在线简历正文：内容抵达，S1 披露前后仍去名、零头像请求', async () => {
    const user = userEvent.setup();
    const 页 = render(
      <宿主
        详情={招聘S1附件详情DTO(false, {
          candidateResume: BFF候选在线简历样本,
          identity: BFF候选身份披露样本, // 已披露带姓名头像
        })}
        caseId="mc_hr"
      />,
    );
    await user.click(screen.getByRole('button', { name: '在线简历' }));
    expect(screen.getByText('四年全栈经验')).toBeTruthy(); // self_description 原槽
    expect(screen.queryByText('沈亦舟')).toBeNull(); // 本轮仍去名
    expect(document.querySelector('img[src="https://cdn.example.com/case/avatar_1.png"]')).toBeNull();
    // S1 前后 identity 变 anonymous：UI 仍去名（在线简历资料与身份无关）
    页.rerender(
      <宿主
        详情={招聘S1附件详情DTO(false, {
          candidateResume: BFF候选在线简历样本,
          identity: { state: 'anonymous', name: null, avatar_url: null, disclosed_at: null },
        })}
        caseId="mc_hr"
      />,
    );
    expect(screen.getByText('四年全栈经验')).toBeTruthy();
    expect(screen.queryByText('沈亦舟')).toBeNull();
  });
});

// ── S0–S3 展示统一 Task 6（Spec §5.3/§7.3）：招聘端顶栏画像与正文同源（candidate_resume
//    安全摘要）、完整布局保留匹配分析缺失区、页尾「已确认」只来自双方确认完成事实 ──

describe('后端正常详情 · 招聘端顶栏同源与页尾确认事实（Task 6）', () => {
  beforeEach(() => {
    mock新增叮嘱.mockClear();
    mock读取简历PDF.mockClear();
    mock跳转.mockClear();
  });

  /** 有安全摘要的招聘端 DTO：顶栏画像与正文同吃 candidate_resume 投影 */
  function 招聘带简历DTO(): P5详情 {
    return 招聘S1附件详情DTO(false, { candidateResume: BFF候选在线简历样本 });
  }

  it('顶栏画像与在线简历正文同源：性别/年限/学历/状态来自同一安全摘要，最近工作行作副标题', () => {
    render(<宿主 详情={招聘带简历DTO()} caseId="mc_hr" />);
    const 栏 = screen.getByRole('button', { name: '返回' }).parentElement!;
    const 栏文 = 栏.textContent ?? '';
    expect(栏文).toContain('5 年'); // resume.summary.experience_years（「不满 1 年」同口径出自映射）
    expect(栏文).toContain('本科');
    expect(栏文).toContain('在职看机会'); // 闭表求职状态
    expect(栏文).toContain('示例公司 · 软件工程师'); // 最近工作行 → 副标题
    expect(screen.queryByText('candidate-0123456789ab')).toBeNull(); // alias 仍不进顶栏
    // 岗位上下文单独保留行
    expect(screen.getByText('平台工程师 · 上海 · 25-40K·16薪')).toBeTruthy();
  });

  it('candidate_resume 缺源：顶栏画像位置保留、缺失占位归展示层，副标题不残留', () => {
    render(<宿主 详情={招聘S1附件详情DTO(false)} caseId="mc_hr" />);
    const 栏 = screen.getByRole('button', { name: '返回' }).parentElement!;
    const 栏文 = 栏.textContent ?? '';
    expect(栏文).toContain('经验缺失');
    expect(栏文).toContain('学历缺失');
    expect(栏文).toContain('求职状态缺失');
    expect(栏文).not.toContain('示例公司');
  });

  it('R1：完整布局下安全资料有值也保留匹配分析标题与缺失提示（不整区消失）', async () => {
    const user = userEvent.setup();
    render(<宿主 详情={招聘带简历DTO()} caseId="mc_hr" />);
    await user.click(screen.getByRole('button', { name: '在线简历' }));
    expect(screen.getByText('匹配度分析')).toBeTruthy();
    expect(screen.getByText('匹配分析缺失')).toBeTruthy(); // 无对齐证据：明确缺失，不从公开 matches 重建
  });

  it('页尾「已确认」只来自双方确认完成事实（lifecycle completed）：进行中给生成声明', async () => {
    const user = userEvent.setup();
    const 页 = render(<宿主 详情={招聘带简历DTO()} caseId="mc_hr" />);
    await user.click(screen.getByRole('button', { name: '在线简历' }));
    expect(screen.getByText('这份简历由候选人的AI代理生成 · 内容不可转发')).toBeTruthy();
    expect(screen.queryByText(/双方已确认意向，可进入真人沟通/)).toBeNull();
    // 双方确认完成（completed，非仅进入 S3）：页尾才宣称可进入真人沟通
    // （completed + handoff_pending 是移交准备中的合法完成行，页尾只认 lifecycle；
    //   终态零动作的契约一并满足）
    const 完成详情: P5详情 = {
      ...招聘带简历DTO(),
      needsAction: false,
      availableActions: [],
    };
    完成详情.state = 状态({
      caseId: 'mc_hr', lifecycle: 'completed', stage: 'intent_confirmation', status: 'passed',
      step: 'handoff_pending', needsUser: false, finalizedAt: '2026-08-29T04:00:00Z',
    });
    页.rerender(<宿主 详情={完成详情} caseId="mc_hr" />);
    expect(screen.getByText('双方已确认意向，可进入真人沟通 · 内容不可转发')).toBeTruthy();
  });
});

// ── J-PILOT-01 Task 5：公开初评托盘 + 后端详情渲染 的联合切换 ──

/** pre-Case 聚合样本：控制层连续资源的同形产出（映射全走真实 mapper）。 */
function 连续详情DTO(选项: {
  phase?: NegotiationDetail['phase'];
  jobDetail?: NegotiationDetail['job_detail'];
  匹配分?: number | null;
} = {}): NegotiationDetail {
  const phase = 选项.phase ?? 'evaluating';
  return {
    needs_action: false,
    record_id: 'dlg_0123456789abcdef0123456789abcdef',
    record_kind: 'delegation',
    intention_id: 'int_0123456789abcdef0123456789abcdef',
    job: {
      job_id: 'job_0123456789abcdef0123456789abcdef',
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
    delegation_id: 'dlg_rcpt_01',
    evaluation_id: phase === 'accepted' || phase === 'evaluating' ? 'ev_01' : null,
    case_id: null,
    shelf: 'active',
    phase,
    case_state: null,
    failure: null,
    refusal_code: null,
    actions: { retry: false, archive: false, open_case: false },
    retry_generation: 0,
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T09:00:00Z',
    archived_at: null,
    match_score: 选项.匹配分 ?? null,
    evaluation: null,
    case_detail: null,
    failure_history: [],
    agent_summary: {
      public_evaluation: {
        evaluation_id: 'ev_pub_1',
        decision: 'fit',
        summary: '公开信息看，经验方向与岗位大体相符。',
        coverage: 'public_job_and_candidate_data',
        evidence: {
          matches: [{ dimension: 'city', code: 'city_match', source: 'structured_precheck' }],
          conflicts: [],
          unknowns: [],
        },
        next_action: 'promote_to_a2a',
        completed_at: '2026-09-01T09:00:00Z',
      },
      condition_confirmation: null,
    },
    job_detail: 选项.jobDetail ?? null,
  };
}

describe('后端正常详情 · 公开资料匹配检查（S0–S3 展示统一 Task 4：装进 S0 段）', () => {
  it('决定与中文核对项落 S0 段小结区，恰一次；英文 summary 与 wire 码不再上屏', () => {
    const 聚合 = 连续详情DTO({ phase: 'case_started' });
    render(
      <宿主 详情={候选S0详情DTO()} caseId="mc_direct" 初评={映射公开初评(聚合)} />,
    );
    expect(screen.getByText('公开资料匹配检查：公开初评匹配')).toBeTruthy();
    expect(screen.getAllByText('公开资料匹配检查：公开初评匹配')).toHaveLength(1);
    expect(screen.getByText('其他条件：匹配')).toBeTruthy(); // 未知维度不透出原词
    // 英文原文与 wire 码不出现在任何展示面
    expect(document.body.textContent).not.toContain('公开信息看，经验方向与岗位大体相符。');
    expect(document.body.textContent).not.toContain('city_match');
    expect(document.body.textContent).not.toContain('structured_precheck');
    // 页顶托盘已退场
    expect(screen.queryByText('公开信息初评')).toBeNull();
  });

  it('公开初评缺席：无匹配检查行（不造空结论）', () => {
    render(<宿主 详情={候选S0详情DTO()} caseId="mc_direct" />);
    expect(screen.queryByText(/公开资料匹配检查/)).toBeNull();
  });
});

/** 与控制层连续分支同形的资源（真实 mapper + 恒空动作卡；初评托盘只归 retention）。 */
function 连续资源(聚合: NegotiationDetail): 后端连续资源 {
  return {
    kind: '连续',
    canonical记录ID: 聚合.record_id,
    顶栏: 从连续到详情顶栏(聚合),
    状态: 从连续到详情状态(聚合),
    公开初评: 聚合.phase === 'case_started' ? 映射公开初评(聚合) : null,
    分段们: 从连续到详情分段(聚合),
    职位资料: 从连续到职位资料(聚合),
    失败动作卡: null,
    归档确认: null,
    底栏: 映射连续底栏(聚合),
    刷新错误: null,
    重试: () => undefined,
  };
}

describe('后端详情渲染 · 连续联合与 Tab 保持（J-PILOT-01 Task 5）', () => {
  it('连续联合：共用外壳两 Tab + pre-Case 状态 + 四未到达阶段 + 禁用底栏（无叮嘱输入）', async () => {
    render(
      <MemoryRouter initialEntries={['/deal/dlg_x']}>
        <后端详情渲染 资源={连续资源(连续详情DTO())} />
      </MemoryRouter>,
    );
    expect(screen.getByText('平台工程师 · 公司信息缺失')).toBeTruthy(); // 顶栏同款槽
    expect(screen.getByRole('button', { name: '代谈进度' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '职位详情' })).toBeTruthy();
    expect(screen.getByText('正在进行公开信息初评')).toBeTruthy(); // 状态区（Spec §6）
    expect(screen.getByText('轮次 —')).toBeTruthy(); // 无轮次不造 0/3
    // pre-Case 的公开初评装 S0 信息区（灰条不可展开时无托盘，Task 4 起 retention 才有页顶托盘）
    expect(screen.queryByText('公开信息初评')).toBeNull();
    // 底栏：原控件保留但真实禁用，文案在 placeholder 原样可见（不是只读 div）
    expect((screen.getByPlaceholderText('AI 代理正在进行公开信息初评') as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(true);
    // 四阶段灰条在场（未到达不可展开）
    ['匿名初筛', '递交简历', '需要协调', '意向确认'].forEach((名) => {
      expect(screen.getAllByText(名).length).toBeGreaterThan(0);
    });
  });

  it('同卡 pre-Case→Case：联合切换不重置 Tab（开案时不跳 Tab、不换页）', async () => {
    const user = userEvent.setup();
    const 视图 = 取视图(候选S0详情DTO());
    const Case资源 = 构造正常资源(视图, 'mc_direct');
    const 壳 = ({ 资源 }: { 资源: typeof Case资源 | 后端连续资源 }) => (
      <MemoryRouter initialEntries={['/deal/dlg_x']}>
        <后端详情渲染 资源={资源} />
      </MemoryRouter>
    );
    const 页 = render(<壳 资源={连续资源(连续详情DTO())} />);
    expect(screen.getByText('正在进行公开信息初评')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '职位详情' })); // 切到资料 Tab
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy();
    // 轮询推进：同一张卡开案（连续 → 正常联合），Tab 仍是 资料
    页.rerender(<壳 资源={Case资源} />);
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy(); // 资料 Tab 内容还在
    expect(screen.queryByText('正在进行公开信息初评')).toBeNull(); // 进度槽互斥卸载
    await user.click(screen.getByRole('button', { name: '代谈进度' }));
    expect(screen.getByText('每周可以到岗几天？')).toBeTruthy(); // Case 四阶段流照常
  });

  // Task 6：pre-case 也用它自身 job_detail + match_score（顶栏/资料区同源），公司入口按编号导航
  it('pre-case 冻结职位与公司导航：无 case_id 照常显示，入口按真实组织编号进企业详情', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/deal/dlg_x']}>
        <后端详情渲染 资源={连续资源(连续详情DTO({ jobDetail: BFF安全职位资料样本, 匹配分: 73 }))} />
      </MemoryRouter>,
    );
    expect(screen.getByText('平台工程师 · 云衢科技')).toBeTruthy();
    expect(screen.getByText('73')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '职位详情' }));
    expect(screen.getByText('参与产品工作')).toBeTruthy();
    const 入口 = screen.getByRole('button', { name: /云衢科技/ }) as HTMLButtonElement;
    expect(入口.disabled).toBe(false);
    await user.click(入口);
    expect(mock跳转).toHaveBeenCalledWith(路径.企业详情('org_1'));
  });
});

// ── S0–S3 展示统一 Task 5（Spec §5.3）：后端详情渲染 首次挂载深链定位 Tab ──
// candidate 只认 ?tab=job、recruiter 只认 ?tab=resume，不匹配/未知值进度；useState 懒
// 初始化只读一次 —— 后续同记录 query 不抢手选 Tab；换 record 由 key 重挂载按新 query
// 重新初始化；pre-Case→Case 联合切换不重置（上一 describe 已钉）。

/** 测试本地导航钮：同一路由内改写 query（同记录 query 变化，后端详情渲染 不重挂载）。 */
function 测试改query钮({ 目标, 文案 }: { 目标: string; 文案: string }) {
  const 导航 = useNavigate();
  return <button type="button" onClick={() => 导航(目标)}>{文案}</button>;
}

describe('后端详情渲染 · Tab 深链初始化（S0–S3 展示统一 Task 5）', () => {
  function 渲染深链(
    资源: 后端正常资源 | 后端连续资源,
    地址: string,
    换钮?: { 目标: string; 文案: string },
  ) {
    return render(
      <MemoryRouter initialEntries={[地址]}>
        {换钮 !== undefined ? <测试改query钮 目标={换钮.目标} 文案={换钮.文案} /> : null}
        <后端详情渲染 资源={资源} />
      </MemoryRouter>,
    );
  }

  it('candidate 只认 ?tab=job：深链直开资料 Tab；?tab=resume / 未知值 / 缺 query 都回进度', () => {
    const 资源 = 连续资源(连续详情DTO());
    渲染深链(资源, '/deal/dlg_x?tab=job');
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy(); // 资料 Tab 直开
    expect(screen.queryByText('正在进行公开信息初评')).toBeNull(); // 进度槽互斥卸载
    cleanup();
    渲染深链(资源, '/deal/dlg_x?tab=resume');
    expect(screen.getByText('正在进行公开信息初评')).toBeTruthy(); // candidate 不认 resume
    cleanup();
    渲染深链(资源, '/deal/dlg_x?tab=whatever');
    expect(screen.getByText('正在进行公开信息初评')).toBeTruthy(); // 未知值回进度
    cleanup();
    渲染深链(资源, '/deal/dlg_x');
    expect(screen.getByText('正在进行公开信息初评')).toBeTruthy(); // 缺 query 回进度
    cleanup();
  });

  it('recruiter 只认 ?tab=resume：深链直开在线简历 Tab；?tab=job 回进度', async () => {
    const 招聘详情 = 招聘S1附件详情DTO(false);
    const 资源 = 构造正常资源(取视图(招聘详情), 'mc_hr', 招聘详情);
    渲染深链(资源, '/hr/candidate/mc_hr?tab=resume');
    expect(await screen.findByText('当前在谈详情数据未提供')).toBeTruthy(); // 简历整档缺失说明
    expect(screen.queryByText('递交简历')).toBeNull(); // 进度槽已卸载
    cleanup();
    渲染深链(资源, '/hr/candidate/mc_hr?tab=job');
    expect(await screen.findByText('递交简历')).toBeTruthy(); // recruiter 不认 job
    cleanup();
  });

  it('后续同记录 query 不抢手选 Tab：手选进度后再遇 ?tab=job 不被拉回资料', async () => {
    const user = userEvent.setup();
    const 页 = 渲染深链(连续资源(连续详情DTO()), '/deal/dlg_x?tab=job', {
      目标: '/deal/dlg_x?tab=job',
      文案: '同记录再来一次 job 深链',
    });
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy(); // 深链先开资料
    await user.click(screen.getByRole('button', { name: '代谈进度' })); // 手选回进度
    expect(screen.getByText('正在进行公开信息初评')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '同记录再来一次 job 深链' }));
    expect(screen.getByText('正在进行公开信息初评')).toBeTruthy(); // 懒初始化只读一次
    expect(screen.queryByText('当前在谈详情数据未提供')).toBeNull();
    页.unmount();
  });
});

/** 与父控制正常分支同形的正常资源（真实 mapper；公开初评恒 null）。 */
function 构造正常资源(视图: P5详情正常视图, caseId: string, 详情: P5详情 = 候选S0详情DTO()): 后端正常资源 {
  const 在线简历资料 = 详情.role === 'recruiter' ? 从BFF到在线简历展示(详情.candidateResume) : null;
  return {
    kind: '正常',
    canonical记录ID: null,
    顶栏: 从P5到详情顶栏(视图, 在线简历资料),
    动作段: P5阶段共用名(详情.state.stage),
    分段们: 从P5到详情分段(视图, 详情, null),
    职位资料: 从P5到职位资料(视图),
    在线简历资料,
    // 页尾「已确认」只来自双方确认完成事实（lifecycle completed，与父控制同口径）
    在线简历已确认: 详情.role === 'recruiter' && 详情.state.lifecycle === 'completed',
    底栏: { kind: '输入', 占位: '有想法就告诉你的AI代理', 值: '', 改变: () => undefined, 发送: null, 禁用说明: null },
    终局: { 摘要: null, 移交: null },
    刷新错误: null,
    重试: () => undefined,
    当前段引用: { current: null },
    动作输入: { role: 详情.role, caseId, 视图, 详情, 操作: mock操作 },
    PDF输入: { role: 详情.role, caseId, 读取: mock读取简历PDF },
  };
}
