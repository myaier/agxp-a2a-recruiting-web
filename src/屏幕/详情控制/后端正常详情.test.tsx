// 后端正常详情 · 组件测试（契约 C，Task 9）：只在正常联合成立时挂载的正常详情子组件。
// 原 屏幕/P5/MatchCase详情 的 详情主体/阶段动作区 连接职责原样搬入 —— 内部无条件调用
// use后端详情动作 与 useCasePDF预览，把结果组装为 A/B 纯展示 props、动作卡与弹层。
// 覆盖：
//   · 组装：共用外壳两 Tab、状态区、阶段流（尾部动作卡经 详情动作卡 渲染一次）、
//     respond_fact 的问题卡嵌在卡正文槽、typed 附件入口走 Case 专属 PDF 路径、
//     底栏输入态照常可发（Tab 切换不改变发送 Case，草稿不丢）；
//   · 刷新合法可空字段由有值→null：附件入口消失（旧回调不再可点）、ready 移交退回
//     pending（旧 conversation_ref 的导航回调不可达）—— 不残留旧入口或旧执行回调；
//   · 终局：底栏只读且零发送、终局摘要卡在场、无任何动作控件。
// 夹具走真实 映射P5详情 与 decoder 已接受的 DTO（不给 P5 加字段造样本）。
// 仓库未装 @testing-library/jest-dom，用 toBeTruthy / disabled 属性断言。

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 后端正常详情 } from './后端正常详情';
import type { 后端正常资源 } from './use后端详情控制';
import { 从P5到详情分段, 从P5到详情顶栏, 从P5到详情状态, 从P5到职位资料 } from '../../数据/详情展示映射';
import { 映射P5详情 } from '../../数据/MatchCase展示映射';
import { 路径 } from '../../路由/路径表';
import type { P5详情正常视图 } from '../../数据/MatchCase展示映射';
import type { P5列表项, P5详情, P5阶段区, P5简历附件 } from '../../数据/招聘数据源/MatchCase';

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
      transcript: [{
        eventId: 'evt_q1', stage: 'anonymous_screening', kind: 'supplementary_question',
        role: 'candidate', ref: 'prompt_1', text: '每周可以到岗几天？',
        occurredAt: '2026-08-29T01:10:00Z',
      }],
      instructionReceipts: [], attachment: null,
      screeningRecords: { messages: [], summaries: [] },
    },
    待段('resume_submission'), 待段('needs_coordination'), 待段('intent_confirmation'),
  ];
}

function 候选S0详情DTO(): P5详情 {
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
  };
}

const 已披露附件: P5简历附件 = {
  fileId: 'rf_00000000000000000000000000000007',
  fileVersionId: 'rfv_00000000000000000000000000000007',
  displayName: '后端工程师_简历_v2.pdf',
};

/** 招聘端 S1 初筛行（needs_user + screening）：typed 附件是该段唯一 PDF 入口。 */
function 招聘S1附件详情DTO(带附件: boolean): P5详情 {
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

/** 底栏走父控制同款接线：草稿在父、发送直发 mock新增叮嘱（组件只透传）。 */
function 宿主({ 详情, caseId }: { 详情: P5详情; caseId: string }) {
  const [草稿, 设草稿] = useState('');
  const 回答在飞表 = useMemo(() => ({ current: new Map<string, Promise<void>>() }), []);
  const 资源 = useMemo<后端正常资源>(() => {
    const 视图 = 取视图(详情);
    const 移交 = 视图.handoff;
    return {
      kind: '正常',
      顶栏: 从P5到详情顶栏(视图),
      状态: 从P5到详情状态(视图),
      分段们: 从P5到详情分段(视图, 详情.state.stage),
      职位资料: 从P5到职位资料(视图),
      底栏: 视图.终局
        ? { kind: '只读', 说明: '当前在谈已结束，仅可查看' }
        : {
            kind: '输入', 占位: 叮嘱占位, 值: 草稿, 改变: 设草稿,
            发送: () => {
              const 内容 = 草稿.trim();
              if (内容 === '') return;
              void mock新增叮嘱(详情.role, caseId, 内容).then(() => 设草稿(''));
            },
            禁用说明: null,
          },
      终局: {
        摘要: 视图.终局摘要 !== null ? { ...视图.终局摘要 } : null,
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
      动作输入: {
        role: 详情.role, caseId, 视图, 详情, 操作: mock操作, 回答在飞表,
      },
      PDF输入: { role: 详情.role, caseId, 读取: mock读取简历PDF },
    };
  }, [详情, caseId, 草稿, 回答在飞表]);
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
  it('外壳两 Tab + 状态区 + 阶段流：动作卡只经共用卡渲染一次，问题卡嵌在 respond_fact 正文槽', async () => {
    render(<宿主 详情={候选S0详情DTO()} caseId="mc_direct" />);
    expect(screen.getByText('平台工程师 · 公司信息缺失')).toBeTruthy(); // 顶栏（mapper 投影，公司槽原位保留）
    expect(screen.getByRole('button', { name: '代谈进度' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '职位详情' })).toBeTruthy();
    expect(screen.getByText('轮次 1/3')).toBeTruthy(); // 状态区
    expect(screen.getByText('每周可以到岗几天？')).toBeTruthy(); // 阶段流
    // respond_fact 卡：问题与回答框同卡（事实问题卡 在卡正文槽，不是第二张卡）
    expect(screen.getByRole('textbox', { name: '回答问题' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '提交回答' })).toBeTruthy();
    // end_screening 卡经同一 renderer（详情动作卡）在场
    expect(screen.getByRole('button', { name: '结束初筛' })).toBeTruthy();
    // 底栏输入态照常（进行中单）
    expect(screen.getByPlaceholderText(叮嘱占位)).toBeTruthy();
  });

  it('Tab 不改变发送 Case：切资料再切回，草稿保留、发送仍带原 caseId', async () => {
    const user = userEvent.setup();
    render(<宿主 详情={候选S0详情DTO()} caseId="mc_direct" />);
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

  it('ready 移交退回 pending：私聊键禁用，旧 conversation_ref 的导航不可达', async () => {
    const user = userEvent.setup();
    const 页 = render(<宿主 详情={移交详情DTO('ready')} caseId="mc_direct" />);
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

describe('后端正常详情 · 终局只读', () => {
  it('ended：底栏只读且零发送、终局摘要卡在场、无任何动作控件', () => {
    render(<宿主 详情={已终止详情DTO()} caseId="mc_direct" />);
    expect(screen.getByText('当前在谈已结束，仅可查看')).toBeTruthy(); // 底部区域保留（只读）
    expect(screen.queryByPlaceholderText(叮嘱占位)).toBeNull();
    expect(screen.queryByRole('button', { name: '发送' })).toBeNull();
    expect(screen.getByText('终局')).toBeTruthy(); // 终局摘要卡（终局区）
    expect(screen.getAllByText('user_ended').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: '结束初筛' })).toBeNull(); // 零动作控件
  });
});
