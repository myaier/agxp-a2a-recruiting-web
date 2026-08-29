// P5 Task 5：双端详情（MatchCase详情 + 在谈详情/候选详情 的 Backend 分支）的行为测试。
// 覆盖：URL case_id + 已认证角色直达刷新（绝不读列表记忆补 context）、招聘端别名原样
// 且无姓名/联系方式/对端字段、四阶段固定 S0→S3 顺序（mapper 交付顺序，无客户端重排）、
// checklist/transcript/叮嘱回执只作展示、时间线文本不产生任何控件（未知状态隐藏全部
// mutation 控件）、首载失败/刷新失败的重试走 force 权威重读、可见 3 秒详情节拍（恒
// force=true）、终局停轮询、会话/角色栅栏关轮询、缺 P5.1 段不渲染、case_id 是唯一坐标
// （scope 键/请求都不用别名）、Case 叮嘱：POST 等服务器、无乐观气泡、仅成功清空草稿、
// 失败保留草稿、终局/契约错误隐藏输入。测试宿主：mock 应用状态 / 导航钩子（同
// MatchCase列表.test.tsx 惯例）；仓库未装 @testing-library/jest-dom，用 toBeTruthy /
// queryBy* 缺席断言为 null。

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchCase详情 } from './MatchCase详情';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import type { P5详情快照 } from '../../状态/后端/类型';
import type { P5列表项 } from '../../数据/招聘数据源/MatchCase';
import type { P5详情 } from '../../数据/招聘数据源/MatchCase';
import type { P5阶段区 } from '../../数据/招聘数据源/MatchCase';
import type { P5角色 } from '../../数据/MatchCase展示映射';
import { P5契约错误提示 } from '../../数据/MatchCase展示映射';
import type { BFF主体 } from '../../数据/BFF契约';

// jsdom 不实现 scrollIntoView（详情屏挂载后自动定位会调用它）
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

const mock派发 = vi.fn();
const mock返回 = vi.fn();
const mock设置P5范围 = vi.fn();
const mock读取详情 = vi.fn(async () => undefined);
const mock新增叮嘱 = vi.fn(async (): Promise<void> => undefined);
const mock加载工作区 = vi.fn(async () => undefined);
const mock刷新工作区 = vi.fn(async () => undefined);
// 生产 Provider 的 操作 引用稳定（useMemo），桩宿主同样给恒定表
const mock操作 = {
  设置P5范围: mock设置P5范围,
  读取详情: mock读取详情,
  新增叮嘱: mock新增叮嘱,
  加载工作区: mock加载工作区,
  刷新工作区: mock刷新工作区,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../../路由/导航钩子', () => ({ use导航: () => ({ 返回: mock返回, 跳转: vi.fn() }) }));

const 意向ID = 'int_0123456789abcdef0123456789abcdef';
const 职位ID = 'job_0123456789abcdef0123456789abcdef';
const 别名 = 'candidate-0123456789ab';
const 叮嘱占位 = '有想法就告诉你的AI代理';

// ── DTO 样本：快照里存的是已 decode 的归一化 P5 DTO（decode 归 Task 1）；
//    基线行取 open/anonymous_screening/needs_user（step human_decision）—— 想看见
//    respond_fact 卡的夹具必须用这一行（Task 2 pin）。──

const 冻结职位 = {
  jobId: 职位ID,
  job: {
    title: '平台工程师',
    location: '上海',
    publicSalaryRange: '25-40K·16薪',
    requiredSkills: ['Go', 'Kubernetes'],
  },
};

function 状态(覆盖: Partial<P5列表项['state']> = {}): P5列表项['state'] {
  return {
    caseId: 'mc_direct', lifecycle: 'open', stage: 'anonymous_screening', status: 'needs_user',
    step: 'human_decision', round: 1, roundBudget: 3, needsUser: true,
    outcome: null, outcomeCode: null,
    createdAt: '2026-08-29T01:00:00Z', updatedAt: '2026-08-29T02:00:00Z', finalizedAt: null,
    ...覆盖,
  };
}

/** 四阶段区固定 S0→S3；S0 带 checklist/待答问题/双端叮嘱回执，其余 pending。 */
function 阶段区组(覆盖: Partial<Record<P5阶段区['stage'], Partial<P5阶段区>>> = {}): P5阶段区[] {
  const 基础: P5阶段区[] = [
    {
      stage: 'anonymous_screening', state: 'active', occurredAt: '2026-08-29T01:10:00Z',
      summary: '已核对城市与年限，薪资带交集待核对',
      checklist: [{ label: '基础事实已答', done: true }, { label: '薪资带交集待核对', done: false }],
      transcript: [
        {
          eventId: 'evt_q1', stage: 'anonymous_screening', kind: 'supplementary_question',
          role: 'candidate', ref: 'prompt_1', text: '每周可以到岗几天？',
          occurredAt: '2026-08-29T01:10:00Z',
        },
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
    },
    { stage: 'resume_submission', state: 'pending', occurredAt: null, summary: '简历提交未开始', checklist: [], transcript: [], instructionReceipts: [], attachment: null },
    { stage: 'needs_coordination', state: 'pending', occurredAt: null, summary: '差异协同未开始', checklist: [], transcript: [], instructionReceipts: [], attachment: null },
    { stage: 'intent_confirmation', state: 'pending', occurredAt: null, summary: '意向确认未开始', checklist: [], transcript: [], instructionReceipts: [], attachment: null },
  ];
  return 基础.map((区) => ({ ...区, ...覆盖[区.stage] }));
}

interface 详情选项 {
  state?: P5列表项['state'];
  stages?: P5阶段区[];
  needsAction?: boolean;
  availableActions?: P5详情['availableActions'];
  terminalSummary?: P5详情['terminalSummary'];
}

function 候选详情DTO(选项: 详情选项 = {}): P5详情 {
  return {
    role: 'candidate',
    context: { intentionId: 意向ID, job: 冻结职位 },
    state: 选项.state ?? 状态(),
    needsAction: 选项.needsAction ?? true,
    availableActions: 选项.availableActions ?? ['respond_fact', 'end_screening'],
    stages: 选项.stages ?? 阶段区组(),
    currentCoordination: null,
    intentConfirmations: { candidate: '', recruiter: '' },
    terminalSummary: 选项.terminalSummary ?? null,
  };
}

function 招聘详情DTO(选项: 详情选项 = {}): P5详情 {
  return {
    role: 'recruiter',
    context: { candidateAlias: 别名, job: 冻结职位 },
    state: 选项.state ?? 状态({
      status: 'running', step: 'policy_check', needsUser: false, round: 0,
    }),
    needsAction: 选项.needsAction ?? false,
    availableActions: 选项.availableActions ?? [],
    stages: 选项.stages ?? 阶段区组(),
    currentCoordination: null,
    intentConfirmations: { candidate: '', recruiter: '' },
    terminalSummary: 选项.terminalSummary ?? null,
  };
}

/** ended 终局详情（S0 ended、终局摘要齐备、零动作零待办）。 */
function 已终止详情DTO(): P5详情 {
  return 候选详情DTO({
    state: 状态({
      lifecycle: 'ended', status: 'ended', step: 'complete', needsUser: false,
      outcome: 'user_ended', outcomeCode: 'user_ended', finalizedAt: '2026-08-29T03:00:00Z',
    }),
    needsAction: false,
    availableActions: [],
    stages: 阶段区组({ anonymous_screening: { state: 'ended', summary: '匿名初筛已结束' } }),
    terminalSummary: {
      stage: 'anonymous_screening', outcome: 'user_ended', reasonSummary: 'user_ended',
      finalizedAt: '2026-08-29T03:00:00Z',
    },
  });
}

/** 矩阵外四元组（open+needs_user 却给 handoff_pending）：decode 挡得住的漂移若仍进
 *  快照，展示映射必须 fail closed —— 不需要任何 as。 */
function 契约外详情DTO(): P5详情 {
  return 候选详情DTO({ state: 状态({ step: 'handoff_pending' }) });
}

function 详情快照(选项: {
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

/** 组件级状态底座：只喂 MatchCase详情 会读的字段（列表记忆刻意缺席 —— 直达刷新不读它）。 */
function 置详情状态(选项: {
  role: P5角色;
  caseId?: string;
  快照?: P5详情快照;
  不预置快照?: boolean;
  /** 轮询栅栏用：后端主体当前角色（缺省与组件角色一致 = 会话有效） */
  登录角色?: BFF主体['last_used_role'];
  已登录?: boolean;
}) {
  const caseId = 选项.caseId ?? 'mc_direct';
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
      P5详情: 选项.不预置快照 === true ? {} : {
        [P5范围键.detail(选项.role, caseId)]: 选项.快照 ?? 详情快照(),
      },
    },
    操作: mock操作,
  };
  return caseId;
}

/** 双端路由：求职端 /deal/:id、招聘端 /hr/candidate/:id（包壳屏各自拥有路由，这里同形）。 */
function 渲染详情(role: P5角色, caseId: string) {
  const 地址 = role === 'candidate' ? `/deal/${caseId}` : `/hr/candidate/${caseId}`;
  const 模板 = role === 'candidate' ? '/deal/:id' : '/hr/candidate/:id';
  return render(
    <MemoryRouter initialEntries={[地址]}>
      <Routes>
        {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
        <Route path={模板} element={<MatchCase详情 role={role} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MatchCase详情 · 直达刷新与隐私（Backend）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock返回.mockClear();
    mock设置P5范围.mockClear();
    mock读取详情.mockClear();
    mock新增叮嘱.mockClear();
    mock加载工作区.mockClear();
    mock刷新工作区.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // brief 片段：direct URL refresh —— 只凭 URL case_id + 已认证角色，不读任何列表快照
  it('direct URL refresh renders context without list memory', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(mock设置P5范围).toHaveBeenCalledWith('candidate', P5范围键.detail('candidate', 'mc_direct'));
    expect(mock读取详情).toHaveBeenCalledWith('candidate', 'mc_direct', true);
    // 先注册可见范围再读（操作层栅栏靠注册的可见范围对上）
    expect(mock设置P5范围.mock.invocationCallOrder[0]).toBeLessThan(
      mock读取详情.mock.invocationCallOrder[0]);
    expect(await screen.findByText('平台工程师')).toBeTruthy(); // 冻结职位名
    expect(screen.getByText(`意向 ${意向ID}`)).toBeTruthy(); // 候选端自己的意向坐标原样
    expect(screen.getByText('上海 · 25-40K·16薪')).toBeTruthy(); // 城市 · 薪资带
    // 列表记忆零读取：不碰任何工作区/列表操作
    expect(mock加载工作区).not.toHaveBeenCalled();
    expect(mock刷新工作区).not.toHaveBeenCalled();
    cleanup();
    // 卸载即清可见范围
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    const 页 = 渲染详情('candidate', 'mc_direct');
    页.unmount();
    expect(mock设置P5范围).toHaveBeenLastCalledWith('candidate', null);
  });

  it('招聘端直达刷新：candidate_alias 逐字原样 + 冻结职位；无姓名/联系方式/对端意向字段', async () => {
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: 招聘详情DTO() }) });
    渲染详情('recruiter', 'mc_hr');
    expect(mock读取详情).toHaveBeenCalledWith('recruiter', 'mc_hr', true);
    // scope 坐标是 case_id（不是别名）
    expect(mock设置P5范围).toHaveBeenCalledWith('recruiter', P5范围键.detail('recruiter', 'mc_hr'));
    expect(await screen.findByText(别名)).toBeTruthy(); // 别名逐字原样，不截断不派生
    // 冻结职位随副标题在场（职位名 · 城市 · 薪资带）
    expect(screen.getByText('平台工程师 · 上海 · 25-40K·16薪')).toBeTruthy();
    // 姓名与结构化身份是 P5.1 依赖：一个都不渲染
    expect(screen.queryByText('沈亦舟')).toBeNull();
    expect(screen.queryByText(`意向 ${意向ID}`)).toBeNull(); // 对端（候选端）字段进不了视图
    expect(screen.queryByText(意向ID)).toBeNull();
    expect(screen.queryByText('匹配度分析')).toBeNull();
    expect(screen.queryByText('适配')).toBeNull();

    // 候选端镜像：别名/对端字段同样不出现（双向不漏）
    cleanup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('平台工程师')).toBeTruthy();
    expect(screen.getByText(`意向 ${意向ID}`)).toBeTruthy();
    expect(screen.queryByText(别名)).toBeNull();
  });

  it('四阶段固定 S0→S3 顺序（mapper 交付顺序，无客户端重排）', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    const 名序 = ['匿名初筛', '递交简历', '需要协调', '意向确认'];
    await screen.findByText('平台工程师');
    名序.forEach((名) => expect(screen.getAllByText(名).length).toBe(1));
    const [s0, s1, s2, s3] = 名序.map((名) => screen.getAllByText(名)[0]!);
    expect(s0.compareDocumentPosition(s1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(s1.compareDocumentPosition(s2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(s2.compareDocumentPosition(s3) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('checklist / 时间线 / 叮嘱回执按类型渲染为展示文本', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    // S0 是当前段（默认展开）：核对清单、待答问题文本、双方叮嘱回执全部在场
    expect(await screen.findByText('基础事实已答')).toBeTruthy();
    expect(screen.getByText('薪资带交集待核对')).toBeTruthy(); // 未完成项标「核对中」
    expect(screen.getByText('每周可以到岗几天？')).toBeTruthy(); // 时间线文本原样展示
    expect(screen.getByText('工作日 10:00-19:00 联系')).toBeTruthy(); // 本端叮嘱回执
    expect(screen.getByText('流程预计两周内走完')).toBeTruthy(); // 对端叮嘱回执
    expect(screen.getByText('待处理')).toBeTruthy(); // 状态文案胶囊（六闭词表）
    expect(screen.getByText('等待人工决定是否继续')).toBeTruthy(); // 步骤说明（17 词闭表）
    expect(screen.getByText('轮次 1/3')).toBeTruthy();
  });

  it('时间线只作展示：running 行零动作卡、零回答输入（绝不从文本推状态/按钮）', async () => {
    // running 行（step policy_check）行侧白名单为空 —— 即便夹具给了 transcript 文本，
    // 展示映射也不出任何卡；时间线文本只能是文字。
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          state: 状态({ status: 'running', step: 'policy_check', needsUser: false, round: 0 }),
          needsAction: false,
          availableActions: [],
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('每周可以到岗几天？')).toBeTruthy(); // 文本照样展示
    expect(screen.queryByText('补充事实')).toBeNull(); // 无 respond_fact 卡
    expect(screen.queryByText('结束初筛')).toBeNull(); // 无 end_screening 卡
    // 状态权威来自 state.status（状态行 + 当前段胶囊都是闭词「进行中」），非文本推断
    expect(screen.getAllByText('进行中').length).toBeGreaterThan(0);
  });

  it('契约错误视图 fail closed：提示 + 重试（force 重读）+ 隐藏全部 mutation 控件', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 契约外详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText(P5契约错误提示)).toBeTruthy();
    expect(screen.queryByText('平台工程师')).toBeNull(); // 部分数据一概不渲染
    expect(screen.queryByPlaceholderText(叮嘱占位)).toBeNull(); // 叮嘱输入隐藏
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock读取详情).toHaveBeenCalledTimes(2);
    expect(mock读取详情).toHaveBeenLastCalledWith('candidate', 'mc_direct', true);
  });

  it('首载失败给失败态与重试（force 重读）；无输入', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'candidate',
      快照: 详情快照({ 阶段: '失败', detail: null, error: '服务暂时不可用，请稍后再试' }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText('这一单暂时打不开')).toBeTruthy();
    expect(screen.getByText('服务暂时不可用，请稍后再试')).toBeTruthy();
    expect(screen.queryByPlaceholderText(叮嘱占位)).toBeNull();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock读取详情).toHaveBeenCalledTimes(2);
    expect(mock读取详情).toHaveBeenLastCalledWith('candidate', 'mc_direct', true);
  });

  it('刷新失败保留旧详情只读 + 单独错误行交代 + 重试走刷新', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'candidate',
      快照: 详情快照({ detail: 候选详情DTO(), error: '服务暂时不可用，请稍后再试' }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText('平台工程师')).toBeTruthy(); // 旧详情原样保留，不降级成空白
    expect(screen.getByText('服务暂时不可用，请稍后再试')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock读取详情).toHaveBeenCalledTimes(2);
    expect(mock读取详情).toHaveBeenLastCalledWith('candidate', 'mc_direct', true);
  });

  it('可见 3 秒节拍权威重读（恒 force=true）', async () => {
    vi.useFakeTimers();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(mock读取详情).toHaveBeenCalledTimes(1); // 挂载直达读那一次
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(mock读取详情).toHaveBeenCalledTimes(2);
    expect(mock读取详情).toHaveBeenLastCalledWith('candidate', 'mc_direct', true);
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(mock读取详情).toHaveBeenCalledTimes(3);
  });

  it('终局详情停 3 秒轮询、隐藏输入，终局摘要原样展示', async () => {
    vi.useFakeTimers();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 已终止详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(mock读取详情).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(7000));
    expect(mock读取详情).toHaveBeenCalledTimes(1); // terminal detail 停止 polling（§10.3）
    expect(screen.queryByPlaceholderText(叮嘱占位)).toBeNull(); // 终局隐藏叮嘱输入
    // 终局摘要 wire 原样（不翻译不改写）
    expect(screen.getAllByText('user_ended').length).toBeGreaterThan(0);
    expect(screen.getByText('2026-08-29T03:00:00Z')).toBeTruthy();
  });

  it('会话/角色不匹配关轮询（已登录=false 或 last_used_role 非本端）', async () => {
    vi.useFakeTimers();
    置详情状态({
      role: 'candidate',
      登录角色: 'recruiter', // 组件角色 candidate，主体当前角色却是 recruiter
      快照: 详情快照({ detail: 候选详情DTO() }),
    });
    渲染详情('candidate', 'mc_direct');
    await act(() => vi.advanceTimersByTimeAsync(7000));
    expect(mock读取详情).toHaveBeenCalledTimes(1); // 只有挂载直达读，无节拍
    cleanup();
    mock读取详情.mockClear(); // 两条腿分开计数
    置详情状态({
      role: 'candidate', 已登录: false,
      快照: 详情快照({ detail: 候选详情DTO() }),
    });
    渲染详情('candidate', 'mc_direct');
    await act(() => vi.advanceTimersByTimeAsync(7000));
    expect(mock读取详情).toHaveBeenCalledTimes(1);
  });

  it('缺 P5.1 段不渲染：无 Tab、无匹配度分析、无适配分、无占位', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('平台工程师')).toBeTruthy();
    expect(screen.queryByText('代谈进度')).toBeNull(); // 无 Mock 的 Tab 行
    expect(screen.queryByText('职位详情')).toBeNull();
    expect(screen.queryByText('在线简历')).toBeNull();
    expect(screen.queryByText('匹配度分析')).toBeNull();
    expect(screen.queryByText('适配')).toBeNull();
    expect(screen.queryByText('公司')).toBeNull(); // 无公司块（P5.1 依赖）
  });
});

describe('MatchCase详情 · Case 叮嘱输入', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock返回.mockClear();
    mock设置P5范围.mockClear();
    mock读取详情.mockClear();
    mock加载工作区.mockClear();
    mock刷新工作区.mockClear();
    // clearMocks 只清调用记录不清实现：逐测试重置 新增叮嘱 的桩实现，默认按成功收口
    mock新增叮嘱.mockReset();
    mock新增叮嘱.mockImplementation(async () => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('提交等待服务器：无乐观气泡/无本地派发，成功才清空，重读归操作层（候选端）', async () => {
    const user = userEvent.setup();
    let 送达!: () => void;
    mock新增叮嘱.mockImplementation(
      () => new Promise<void>((解决) => { 送达 = 解决; }));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    const 框 = screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement;
    await user.type(框, '周五也可以到岗');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(mock新增叮嘱).toHaveBeenCalledTimes(1);
    expect(mock新增叮嘱).toHaveBeenCalledWith('candidate', 'mc_direct', '周五也可以到岗');
    // 在途：草稿未清、无乐观气泡（jsdom 会把 textarea 值镜像进 DOM —— 该文本允许
    // 只出现在输入框里，任何非输入框元素出现即算乐观气泡）、无本地归约
    expect(框.value).toBe('周五也可以到岗');
    expect(screen.getAllByText('周五也可以到岗').every((元) => 元.tagName === 'TEXTAREA')).toBe(true);
    expect(mock派发).not.toHaveBeenCalled();
    expect(mock读取详情).toHaveBeenCalledTimes(1); // 仍是挂载那次：不自己重读
    送达();
    await waitFor(() => expect(框.value).toBe('')); // 仅成功清空
    expect(mock读取详情).toHaveBeenCalledTimes(1); // 权威重读归 Task 3 操作层
  });

  it('招聘端同构：role/case_id 原样透传给 新增叮嘱', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'recruiter', caseId: 'mc_hr',
      快照: 详情快照({
        detail: 招聘详情DTO({
          state: 状态({ caseId: 'mc_hr', status: 'running', step: 'policy_check', needsUser: false, round: 0 }),
          needsAction: false,
          availableActions: [],
        }),
      }),
    });
    渲染详情('recruiter', 'mc_hr');
    const 框 = screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement;
    await user.type(框, '优先看 Go 背景');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(mock新增叮嘱).toHaveBeenCalledWith('recruiter', 'mc_hr', '优先看 Go 背景');
    await waitFor(() => expect(框.value).toBe(''));
  });

  it('发送失败保留草稿（不清空、不乐观）', async () => {
    const user = userEvent.setup();
    mock新增叮嘱.mockImplementation(async () => {
      throw new Error('网络错误');
    });
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    const 框 = screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement;
    await user.type(框, '周五也可以到岗');
    await user.click(screen.getByRole('button', { name: '发送' }));
    await waitFor(() => expect(mock新增叮嘱).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(框.value).toBe('周五也可以到岗')); // 失败绝不清空
    expect(mock派发).not.toHaveBeenCalled(); // 也不落任何本地规则/气泡
  });

  it('空输入不发送', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(mock新增叮嘱).not.toHaveBeenCalled();
  });

  it('终局详情隐藏输入（无任何 mutation 控件）', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 已终止详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    // 结束语与原因码都是 wire 原词（user_ended 出现两处属正常）
    expect(await screen.findAllByText('user_ended')).toBeTruthy();
    expect(screen.queryByPlaceholderText(叮嘱占位)).toBeNull();
    expect(screen.queryByRole('button', { name: '发送' })).toBeNull();
  });
});
