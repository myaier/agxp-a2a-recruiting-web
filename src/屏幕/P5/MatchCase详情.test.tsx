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

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchCase详情 } from './MatchCase详情';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { 路径 } from '../../路由/路径表';
import type { P5详情快照 } from '../../状态/后端/类型';
import type { P5列表项 } from '../../数据/招聘数据源/MatchCase';
import type { P5详情 } from '../../数据/招聘数据源/MatchCase';
import type { P5阶段区 } from '../../数据/招聘数据源/MatchCase';
import type { P5角色 } from '../../数据/MatchCase展示映射';
import { P5契约错误提示 } from '../../数据/MatchCase展示映射';
import type { BFF主体, BFF附件简历库 } from '../../数据/BFF契约';

// jsdom 不实现 scrollIntoView（详情屏挂载后自动定位会调用它）
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

const mock派发 = vi.fn();
const mock返回 = vi.fn();
const mock跳转 = vi.fn();
const mock设置P5范围 = vi.fn();
const mock读取详情 = vi.fn(async () => undefined);
const mock新增叮嘱 = vi.fn(async (): Promise<void> => undefined);
const mock加载工作区 = vi.fn(async () => undefined);
const mock刷新工作区 = vi.fn(async () => undefined);
// Task 6：S0–S3 命令、Case 专属 PDF 租约与委托前权威附件库读取
const mock回答事实 = vi.fn(async (): Promise<void> => undefined);
const mock决定S0 = vi.fn(async (): Promise<void> => undefined);
const mock决定S1 = vi.fn(async (): Promise<void> => undefined);
const mock决定S2 = vi.fn(async (): Promise<void> => undefined);
const mock决定S3 = vi.fn(async (): Promise<void> => undefined);
const mock提交简历 = vi.fn(async (): Promise<void> => undefined);
const mock读取简历PDF = vi.fn(async () => ({ url: 'blob:p5-resume', revoke: () => undefined }));
const mock准备候选委托简历 = vi.fn(async (): Promise<BFF附件简历库 | null> => null);
// 生产 Provider 的 操作 引用稳定（useMemo），桩宿主同样给恒定表
const mock操作 = {
  设置P5范围: mock设置P5范围,
  读取详情: mock读取详情,
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
let mock应用状态: any;

vi.mock('../../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../../路由/导航钩子', () => ({ use导航: () => ({ 返回: mock返回, 跳转: mock跳转 }) }));

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
  currentCoordination?: P5详情['currentCoordination'];
  intentConfirmations?: P5详情['intentConfirmations'];
}

function 候选详情DTO(选项: 详情选项 = {}): P5详情 {
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
    currentCoordination: 选项.currentCoordination ?? null,
    intentConfirmations: 选项.intentConfirmations ?? { candidate: '', recruiter: '' },
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

// ══ Task 6 夹具：各可见卡行（Task 2 pin）的详情 DTO + Plan 1 附件库样本 ══

const 协同问题ID = 'cdi_0123456789abcdef0123456789abcdef';
/** 候选人自己已绑定的 S1 附件（重试卡的 typed 坐标唯一来源）。 */
const 绑定附件 = {
  fileId: 'rf_00000000000000000000000000000007',
  fileVersionId: 'rfv_00000000000000000000000000000007',
  displayName: '后端工程师_简历_v1.pdf',
};
/** 披露后招聘端 S1 区的 typed 附件（PDF 按钮的唯一授权）。 */
const 已披露附件 = {
  fileId: 'rf_00000000000000000000000000000009',
  fileVersionId: 'rfv_00000000000000000000000000000009',
  displayName: '后端工程师_简历_v2.pdf',
};

/** 32 位十六进制填充（附件库样本 id 与 wire pattern 同形）。 */
function 填充十六(序: number): string {
  return String(序).padEnd(32, '0').slice(0, 32);
}

function 附件库样本(条数: number): BFF附件简历库 {
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
function S0邀请详情(): P5详情 {
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
function S1等待详情(带绑定: boolean): P5详情 {
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
function S1更换详情(): P5详情 {
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

/** S1 needs_user 行（招聘）：初筛结论卡；S1 区带已披露 typed 附件。 */
function S1初筛详情(带附件: boolean): P5详情 {
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
        state: 'active', summary: '简历已披露，等待初筛结论', transcript: [],
        attachment: 带附件 ? 已披露附件 : null,
      },
    }),
  });
}

/** S1 waiting 行（招聘）：解析中附件保持闭合 —— 无姓名/联系方式/PDF 入口。 */
function S1解析中详情(): P5详情 {
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

/** S2 行（双端）：协同卡 + 当前协同块。 */
function S2详情(
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
function S3详情(
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

/** completed + handoff_pending：双方已确认的终局移交（第二次确认后的权威形态）。 */
function 已完成移交详情DTO(): P5详情 {
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

describe('MatchCase详情 · S0/S1 动作（Task 6）', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock回答事实.mockClear();
    mock决定S0.mockClear();
    mock决定S1.mockClear();
    mock提交简历.mockClear();
    mock准备候选委托简历.mockClear();
    mock跳转.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('回答补充问题：prompt ref + 回答原文的精确调用；重读归操作层，成功才清空', async () => {
    const user = userEvent.setup();
    let 送达!: () => void;
    mock回答事实.mockImplementation(() => new Promise<void>((解决) => { 送达 = 解决; }));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    await user.type(screen.getByRole('textbox', { name: '回答问题' }), '每周可以到岗 3 天');
    await user.click(screen.getByRole('button', { name: '提交回答' }));
    // brief 片段同形：role、case_id、typed prompt ref、回答原文
    expect(mock回答事实).toHaveBeenCalledTimes(1);
    expect(mock回答事实).toHaveBeenCalledWith('candidate', 'mc_direct', 'prompt_1', '每周可以到岗 3 天');
    expect(mock派发).not.toHaveBeenCalled();
    expect(mock读取详情).toHaveBeenCalledTimes(1); // 仍是挂载那次：权威重读归 Task 3 操作层
    送达();
    const 框 = screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement;
    await waitFor(() => expect(框.value).toBe('')); // 仅成功清空
    expect(mock读取详情).toHaveBeenCalledTimes(1);
  });

  it('空回答不发送；在飞重复点击只发一次（同键重放归操作层）', async () => {
    const user = userEvent.setup();
    let 送达!: () => void;
    mock回答事实.mockImplementation(() => new Promise<void>((解决) => { 送达 = 解决; }));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: '提交回答' })); // 空输入
    expect(mock回答事实).not.toHaveBeenCalled();
    await user.type(screen.getByRole('textbox', { name: '回答问题' }), '负责交易网关');
    const 键 = screen.getByRole('button', { name: '提交回答' });
    await user.click(键);
    await user.click(键); // 在飞：屏层单发，重放语义由操作层的稳定意图键承担
    expect(mock回答事实).toHaveBeenCalledTimes(1);
    送达();
  });

  it('多条/零条补充问题：整页契约错误，无回答控件，零请求', async () => {
    const user = userEvent.setup();
    const 双问阶段 = 阶段区组({
      anonymous_screening: {
        transcript: [
          {
            eventId: 'evt_q1', stage: 'anonymous_screening', kind: 'supplementary_question',
            role: 'candidate', ref: 'prompt_1', text: '每周可以到岗几天？', occurredAt: '2026-08-29T01:10:00Z',
          },
          {
            eventId: 'evt_q2', stage: 'anonymous_screening', kind: 'supplementary_question',
            role: 'candidate', ref: 'prompt_2', text: '期望薪资是多少？', occurredAt: '2026-08-29T01:11:00Z',
          },
        ],
      },
    });
    置详情状态({
      role: 'candidate',
      快照: 详情快照({ detail: 候选详情DTO({ stages: 双问阶段 }) }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText(P5契约错误提示)).toBeTruthy(); // 唯一匹配被破坏：整页 fail closed
    expect(screen.queryByRole('textbox', { name: '回答问题' })).toBeNull();
    expect(screen.queryByRole('button', { name: '提交回答' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '重试' })); // 只允许重新 GET
    expect(mock读取详情).toHaveBeenCalledTimes(2);
    expect(mock回答事实).not.toHaveBeenCalled();

    cleanup();
    const 无问阶段 = 阶段区组({
      anonymous_screening: {
        transcript: [{
          eventId: 'evt_n1', stage: 'anonymous_screening', kind: 'stage_note',
          role: '', reasonCode: 'policy_checked', occurredAt: '2026-08-29T01:20:00Z',
        }],
      },
    });
    置详情状态({
      role: 'candidate',
      快照: 详情快照({ detail: 候选详情DTO({ stages: 无问阶段 }) }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText(P5契约错误提示)).toBeTruthy();
    expect(mock回答事实).not.toHaveBeenCalled();
  });

  it('end_screening（候选）：继续/结束两条 S0 决定的精确调用，结束过二次确认', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: '继续初筛' }));
    expect(mock决定S0).toHaveBeenCalledTimes(1);
    expect(mock决定S0).toHaveBeenCalledWith('mc_direct', 'continue');

    await user.click(screen.getByRole('button', { name: '结束初筛' }));
    const 确认框 = screen.getByRole('dialog');
    expect(within(确认框).getByText('结束后这一单立即终止，无法恢复。')).toBeTruthy();
    await user.click(within(确认框).getByRole('button', { name: '暂不结束' })); // 取消零请求
    expect(mock决定S0).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: '结束初筛' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '结束初筛' }));
    expect(mock决定S0).toHaveBeenCalledTimes(2);
    expect(mock决定S0).toHaveBeenLastCalledWith('mc_direct', 'end');
  });

  it('end_screening（招聘）：wire 缺 recruiter decisions 臂 → 零控件零请求（fail closed，后端缺口观察）', async () => {
    置详情状态({
      role: 'recruiter', caseId: 'mc_hr',
      快照: 详情快照({
        detail: 招聘详情DTO({
          state: 状态({ caseId: 'mc_hr', stage: 'anonymous_screening', status: 'needs_user', step: 'human_decision' }),
          needsAction: true,
          availableActions: ['respond_fact', 'end_screening'],
          stages: 阶段区组({
            anonymous_screening: {
              transcript: [{
                eventId: 'evt_q9', stage: 'anonymous_screening', kind: 'supplementary_question',
                role: 'recruiter', ref: 'prompt_hr', text: '这个岗位要求到岗时间？', occurredAt: '2026-08-29T01:10:00Z',
              }],
            },
          }),
        }),
      }),
    });
    渲染详情('recruiter', 'mc_hr');
    // respond_fact 双端都有准许路线（fact-responses 有 recruiter 臂）
    expect(screen.getByRole('textbox', { name: '回答问题' })).toBeTruthy();
    // 投影器会给 needs_user 属主发 end_screening，但冻结 wire 的 decisions 路线只有
    // 候选端 /me 臂 —— 招聘端结束卡零控件、零请求（fail closed，待后端补 recruiter 臂）
    expect(screen.queryByRole('button', { name: '继续初筛' })).toBeNull();
    expect(screen.queryByRole('button', { name: '结束初筛' })).toBeNull();
    expect(mock决定S0).not.toHaveBeenCalled();
    expect(mock提交简历).not.toHaveBeenCalled();
    expect(mock决定S1).not.toHaveBeenCalled();
    expect(mock准备候选委托简历).not.toHaveBeenCalled();
    expect(mock读取简历PDF).not.toHaveBeenCalled();
  });

  it('接受简历邀请：单选 → Case 专属披露确认点名所选 PDF → 字面 true；取消零请求', async () => {
    const user = userEvent.setup();
    mock准备候选委托简历.mockResolvedValue(附件库样本(2));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0邀请详情() }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: '接受邀请' }));
    // 单选层：多份附件必须当场单选一份（S1 递交口径的文案）
    const 选择框 = await screen.findByRole('dialog');
    expect(within(选择框).getByText(/本次 Case 是「平台工程师」/)).toBeTruthy();
    await user.click(within(选择框).getByRole('radio', { name: '简历_v2.pdf' }));
    await user.click(within(选择框).getByRole('button', { name: '选定这份' }));
    // 披露确认：正文点名冻结职位（Case 上下文）与这次递交哪份 PDF，说清递交即披露
    const 披露框 = screen.getByRole('dialog');
    expect(within(披露框).getByText(/「平台工程师」这一 Case 递交「简历_v2\.pdf」/)).toBeTruthy();
    expect(within(披露框).getByText(/仅对这一次递交生效/)).toBeTruthy();
    await user.click(within(披露框).getByRole('button', { name: '暂不递交' })); // 取消：零请求
    expect(mock提交简历).not.toHaveBeenCalled();
    // 再来一次：选择与披露都重新走，不复用上一次的授权
    await user.click(screen.getByRole('button', { name: '接受邀请' }));
    const 再选 = await screen.findByRole('dialog');
    await user.click(within(再选).getByRole('radio', { name: '简历_v1.pdf' }));
    await user.click(within(再选).getByRole('button', { name: '选定这份' }));
    const 再披露 = screen.getByRole('dialog');
    expect(within(再披露).getByText(/简历_v1\.pdf/)).toBeTruthy(); // 点名的是这次选的
    await user.click(within(再披露).getByRole('button', { name: '确认递交' }));
    expect(mock提交简历).toHaveBeenCalledTimes(1);
    expect(mock提交简历).toHaveBeenCalledWith('mc_direct', `rf_${填充十六(1)}`, `rfv_${填充十六(1)}`, true);
    expect(mock准备候选委托简历).toHaveBeenCalledTimes(2); // 每次尝试都重跑权威库读取
    expect(mock决定S0).not.toHaveBeenCalled();
  });

  it('接受简历邀请：单份附件直达披露确认（仍点名该 PDF 与职位）', async () => {
    const user = userEvent.setup();
    mock准备候选委托简历.mockResolvedValue(附件库样本(1));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0邀请详情() }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: '接受邀请' }));
    const 披露框 = await screen.findByRole('dialog');
    expect(within(披露框).getByText(/「平台工程师」这一 Case 递交「简历_v1\.pdf」/)).toBeTruthy();
    expect(screen.queryByRole('radio', { name: '简历_v1.pdf' })).toBeNull(); // 单份不再过单选层
    await user.click(within(披露框).getByRole('button', { name: '确认递交' }));
    expect(mock提交简历).toHaveBeenCalledWith('mc_direct', `rf_${填充十六(1)}`, `rfv_${填充十六(1)}`, true);
  });

  it('婉拒简历邀请 = 决定S0 end（服务端唯一准许路线，e2e J2 同款）；确认前零请求', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0邀请详情() }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: '婉拒邀请' }));
    const 确认框 = screen.getByRole('dialog');
    expect(within(确认框).getByText(/不会向该招聘方披露你的简历/)).toBeTruthy();
    await user.click(within(确认框).getByRole('button', { name: '婉拒邀请' }));
    expect(mock决定S0).toHaveBeenCalledTimes(1);
    expect(mock决定S0).toHaveBeenCalledWith('mc_direct', 'end');
    expect(mock提交简历).not.toHaveBeenCalled(); // 婉拒绝不携带简历
  });

  it('附件库为空：提示去上传并跳转，零提交请求；null（会话/角色换代）静默返回', async () => {
    const user = userEvent.setup();
    mock准备候选委托简历.mockResolvedValue(附件库样本(0));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0邀请详情() }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: '接受邀请' }));
    await waitFor(() => expect(mock跳转).toHaveBeenCalledWith(路径.我的简历));
    expect(screen.getByText('请先上传一份 PDF 简历')).toBeTruthy();
    expect(mock提交简历).not.toHaveBeenCalled();

    cleanup();
    mock准备候选委托简历.mockResolvedValue(null); // null 不是空库：静默返回，绝不去上传
    mock准备候选委托简历.mockClear();
    mock跳转.mockClear();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0邀请详情() }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: '接受邀请' }));
    await waitFor(() => expect(mock准备候选委托简历).toHaveBeenCalledTimes(1));
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock提交简历).not.toHaveBeenCalled();
  });

  it('S1 重试：用已绑定的 file/version 对 + 字面 true；每次都过新披露确认；取消零请求', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(true) }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: '重试校验' }));
    const 披露框 = screen.getByRole('dialog');
    expect(within(披露框).getByText(/「平台工程师」这一 Case 递交「后端工程师_简历_v1\.pdf」/)).toBeTruthy();
    await user.click(within(披露框).getByRole('button', { name: '暂不递交' }));
    expect(mock提交简历).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '重试校验' })); // 再来：重新确认
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认递交' }));
    expect(mock提交简历).toHaveBeenCalledTimes(1);
    expect(mock提交简历).toHaveBeenCalledWith(
      'mc_direct', 绑定附件.fileId, 绑定附件.fileVersionId, true);
  });

  it('S1 重试无 typed 附件：零控件零请求（fail closed，绝不猜坐标）', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(false) }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('重试简历校验')).toBeTruthy(); // 卡框架仍在（映射交集）
    expect(screen.queryByRole('button', { name: '重试校验' })).toBeNull(); // 无坐标即无控件
    expect(mock提交简历).not.toHaveBeenCalled();
  });

  it('S1 更换简历：同一单选 + 披露栅栏，第二份不复用第一份授权', async () => {
    const user = userEvent.setup();
    mock准备候选委托简历.mockResolvedValue(附件库样本(2));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1更换详情() }) });
    渲染详情('candidate', 'mc_direct');
    // 第一次：选 v2 后在披露层取消
    await user.click(screen.getByRole('button', { name: '更换简历' }));
    const 选择框 = await screen.findByRole('dialog');
    await user.click(within(选择框).getByRole('radio', { name: '简历_v2.pdf' }));
    await user.click(within(选择框).getByRole('button', { name: '选定这份' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '暂不递交' }));
    expect(mock提交简历).not.toHaveBeenCalled();
    // 第二次：改选 v1，确认递交 —— 发出去的恰是这次选的对
    await user.click(screen.getByRole('button', { name: '更换简历' }));
    const 再选 = await screen.findByRole('dialog');
    await user.click(within(再选).getByRole('radio', { name: '简历_v1.pdf' }));
    await user.click(within(再选).getByRole('button', { name: '选定这份' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认递交' }));
    expect(mock提交简历).toHaveBeenCalledTimes(1);
    expect(mock提交简历).toHaveBeenCalledWith('mc_direct', `rf_${填充十六(1)}`, `rfv_${填充十六(1)}`, true);
  });

  it('S1 初筛结论（招聘）：continue|not_fit 精确调用，not_fit 过二次确认', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1初筛详情(false) }) });
    渲染详情('recruiter', 'mc_hr');
    await user.click(screen.getByRole('button', { name: '通过初筛' }));
    expect(mock决定S1).toHaveBeenCalledTimes(1);
    expect(mock决定S1).toHaveBeenCalledWith('mc_hr', 'continue');
    await user.click(screen.getByRole('button', { name: '不合适' }));
    const 确认框 = screen.getByRole('dialog');
    await user.click(within(确认框).getByRole('button', { name: '确认不合适' }));
    expect(mock决定S1).toHaveBeenCalledTimes(2);
    expect(mock决定S1).toHaveBeenLastCalledWith('mc_hr', 'not_fit');
  });

  it('行白名单外的动作词不渲染（映射交集）：needs_user 行给邀请词也不出卡、零请求', async () => {
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          needsAction: true,
          availableActions: ['accept_resume_invitation', 'decline_resume_invitation'],
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('待处理')).toBeTruthy();
    expect(screen.queryByText('接受简历邀请')).toBeNull(); // S0 needs_user 行白名单不含邀请二卡
    expect(screen.queryByRole('button', { name: '接受邀请' })).toBeNull();
    expect(screen.queryByRole('button', { name: '婉拒邀请' })).toBeNull();
    expect(mock提交简历).not.toHaveBeenCalled();
    expect(mock决定S0).not.toHaveBeenCalled();
    expect(mock准备候选委托简历).not.toHaveBeenCalled();
  });
});

describe('MatchCase详情 · S2/S3 动作（Task 6）', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock决定S1.mockClear();
    mock决定S2.mockClear();
    mock决定S3.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('S2（候选）：接受/拒绝带精确 issueId（typed 协同块）', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: S2详情('candidate', {
          issueId: 协同问题ID, kind: 'work_mode', requiredRoles: ['candidate', 'recruiter'],
          candidateDecided: false, recruiterDecided: false,
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: '接受' }));
    expect(mock决定S2).toHaveBeenCalledTimes(1);
    expect(mock决定S2).toHaveBeenCalledWith('candidate', 'mc_direct', 协同问题ID, 'accept');
    await user.click(screen.getByRole('button', { name: '拒绝' }));
    expect(mock决定S2).toHaveBeenCalledTimes(2);
    expect(mock决定S2).toHaveBeenLastCalledWith('candidate', 'mc_direct', 协同问题ID, 'reject');
  });

  it('S2（招聘）：同 issueId 独立表态', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'recruiter', caseId: 'mc_hr',
      快照: 详情快照({
        detail: S2详情('recruiter', {
          issueId: 协同问题ID, kind: 'work_schedule', requiredRoles: ['candidate', 'recruiter'],
          candidateDecided: true, recruiterDecided: false,
        }),
      }),
    });
    渲染详情('recruiter', 'mc_hr');
    await user.click(screen.getByRole('button', { name: '拒绝' }));
    expect(mock决定S2).toHaveBeenCalledWith('recruiter', 'mc_hr', 协同问题ID, 'reject');
  });

  it('S2：非必需角色 / 本端已决 → 等待态零控件零请求', async () => {
    // 本端（候选）不在必需名单：卡虽在映射交集里，typed 事实不给控件
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: S2详情('candidate', {
          issueId: 协同问题ID, kind: 'travel', requiredRoles: ['recruiter'],
          candidateDecided: false, recruiterDecided: false,
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('回应协同事项')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '接受' })).toBeNull();
    expect(screen.queryByRole('button', { name: '拒绝' })).toBeNull();
    expect(mock决定S2).not.toHaveBeenCalled();

    cleanup();
    // 本端已决：服务端形态是 waiting 行 + 空动作表（needs_action 与动作表精确耦合）
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          state: 状态({
            stage: 'needs_coordination', status: 'waiting',
            step: 'awaiting_recruiter_decision', needsUser: false,
          }),
          needsAction: false,
          availableActions: [],
          stages: 阶段区组({
            anonymous_screening: { state: 'passed', summary: '匿名初筛已通过' },
            resume_submission: { state: 'passed', summary: '简历初筛已通过' },
            needs_coordination: { state: 'active', summary: '本端已表态，等待对方' },
          }),
          currentCoordination: {
            issueId: 协同问题ID, kind: 'work_mode', requiredRoles: ['candidate', 'recruiter'],
            candidateDecided: true, recruiterDecided: false,
          },
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText('等待招聘方决定')).toBeTruthy(); // 等待态来自 17 词闭表
    expect(screen.queryByRole('button', { name: '接受' })).toBeNull();
    expect(screen.queryByRole('button', { name: '拒绝' })).toBeNull();
    expect(mock决定S2).not.toHaveBeenCalled();
  });

  it('S2：卡在场但 currentCoordination 缺席 → fail closed 零请求', async () => {
    置详情状态({
      role: 'candidate',
      快照: 详情快照({ detail: S2详情('candidate', null) }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('回应协同事项')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '接受' })).toBeNull();
    expect(screen.queryByRole('button', { name: '拒绝' })).toBeNull();
    expect(mock决定S2).not.toHaveBeenCalled();
  });

  it('S3：双端独立确认/婉拒 → 决定S3 confirm|decline', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'candidate',
      快照: 详情快照({ detail: S3详情('candidate', { candidate: '', recruiter: '' }) }),
    });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: '确认意向' }));
    expect(mock决定S3).toHaveBeenCalledWith('candidate', 'mc_direct', 'confirm');
    await user.click(screen.getByRole('button', { name: '婉拒意向' }));
    expect(mock决定S3).toHaveBeenLastCalledWith('candidate', 'mc_direct', 'decline');

    cleanup();
    置详情状态({
      role: 'recruiter', caseId: 'mc_hr',
      快照: 详情快照({
        detail: S3详情('recruiter', { candidate: 'confirm', recruiter: '' }, ['confirm_intent', 'decline_intent'], 'awaiting_recruiter_confirmation'),
      }),
    });
    渲染详情('recruiter', 'mc_hr');
    await user.click(screen.getByRole('button', { name: '确认意向' }));
    expect(mock决定S3).toHaveBeenLastCalledWith('recruiter', 'mc_hr', 'confirm');
  });

  it('S3：本端已决 → 等待态零控件（等待文案来自步骤闭表）', async () => {
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: S3详情(
          'candidate',
          { candidate: 'confirm', recruiter: '' },
          [], 'awaiting_recruiter_confirmation',
        ),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText('等待招聘方确认意向')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '确认意向' })).toBeNull();
    expect(screen.queryByRole('button', { name: '婉拒意向' })).toBeNull();
    expect(mock决定S3).not.toHaveBeenCalled();
  });

  it('第二次确认后的终局：移交文案在场、全部 mutation 控件缺席、屏层零本地重读', async () => {
    const user = userEvent.setup();
    // 先看确认动作本身：点击后屏层不做任何本地重建（权威重读归操作层）
    置详情状态({
      role: 'candidate',
      快照: 详情快照({ detail: S3详情('candidate', { candidate: '', recruiter: 'confirm' }, ['confirm_intent', 'decline_intent'], 'awaiting_candidate_confirmation') }),
    });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: '确认意向' }));
    expect(mock决定S3).toHaveBeenCalledTimes(1);
    expect(mock读取详情).toHaveBeenCalledTimes(1); // 仍是挂载那次
    expect(mock派发).not.toHaveBeenCalled();

    // 第二次确认后的权威形态（completed + handoff_pending）：只读移交，零动作控件
    cleanup();
    mock决定S3.mockClear(); // 两条腿分开计数
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 已完成移交详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    // 移交文案在场（移交行 + handoff_pending 步骤说明同词，出现即算）
    expect(screen.getAllByText('双方已确认，正在创建会话').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: '确认意向' })).toBeNull();
    expect(screen.queryByRole('button', { name: '婉拒意向' })).toBeNull();
    expect(screen.queryByRole('button', { name: '接受' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: '回答问题' })).toBeNull();
    expect(screen.queryByPlaceholderText(叮嘱占位)).toBeNull();
    expect(mock决定S3).not.toHaveBeenCalled();
  });
});

describe('MatchCase详情 · 授权原始 PDF（Task 6）', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock读取简历PDF.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('披露前与解析中：无姓名/联系方式/PDF 入口，零 PDF 请求', async () => {
    // 解析中（S1 waiting）：后端保持附件闭合
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1解析中详情() }) });
    渲染详情('recruiter', 'mc_hr');
    expect(await screen.findByText(别名)).toBeTruthy();
    expect(screen.queryByText('后端工程师_简历_v2.pdf')).toBeNull(); // 无 PDF 入口
    expect(screen.queryByText('查看 ›')).toBeNull();
    // 无姓名/联系方式/结构化身份（P5.1 缺席即不渲染）
    expect(screen.queryByText('沈亦舟')).toBeNull();
    expect(screen.queryByText(/手机：/)).toBeNull();
    expect(screen.queryByText(/邮箱：/)).toBeNull();
    expect(mock读取简历PDF).not.toHaveBeenCalled();
    // 初筛卡不带附件的镜像（披露前 S1 needs_user 无附件）：同样无入口
    cleanup();
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1初筛详情(false) }) });
    渲染详情('recruiter', 'mc_hr');
    expect(screen.queryByText('查看 ›')).toBeNull();
    expect(mock读取简历PDF).not.toHaveBeenCalled();
  });

  it('typed 附件在场：点击只走 Case 专属 role 路径一次，弹层以租约地址呈现真实 PDF，关闭即回收', async () => {
    const user = userEvent.setup();
    const 租约 = { url: 'blob:p5-resume', revoke: vi.fn() };
    mock读取简历PDF.mockResolvedValue(租约);
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1初筛详情(true) }) });
    渲染详情('recruiter', 'mc_hr');
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v2\.pdf/ }));
    // 只调 Case 专属 role 路径（role + case_id），一次点击一次租约
    expect(mock读取简历PDF).toHaveBeenCalledTimes(1);
    expect(mock读取简历PDF).toHaveBeenCalledWith('recruiter', 'mc_hr');
    const 弹层 = await screen.findByRole('dialog', { name: '简历原件' });
    expect(within(弹层).getByText('后端工程师_简历_v2.pdf')).toBeTruthy(); // 顶栏只有徽标+文件名+关闭
    // 正文以租约对象地址直接呈现真实字节（经 URL 渲染，绝不读 blob 文本/字节）
    const 阅览框 = within(弹层).getByTitle('简历 PDF') as HTMLIFrameElement;
    expect(阅览框.getAttribute('src')).toBe('blob:p5-resume');
    await user.click(within(弹层).getByRole('button', { name: '关闭' }));
    expect(租约.revoke).toHaveBeenCalledTimes(1); // 关闭即回收
    expect(screen.queryByRole('dialog', { name: '简历原件' })).toBeNull();
    expect(mock读取简历PDF).toHaveBeenCalledTimes(1); // 关闭不重取
  });

  it('弹层开着时整页卸载也回收租约（无缓存无持久化）', async () => {
    const user = userEvent.setup();
    const 租约 = { url: 'blob:p5-resume', revoke: vi.fn() };
    mock读取简历PDF.mockResolvedValue(租约);
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1初筛详情(true) }) });
    const 页 = 渲染详情('recruiter', 'mc_hr');
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v2\.pdf/ }));
    await screen.findByRole('dialog', { name: '简历原件' });
    页.unmount();
    expect(租约.revoke).toHaveBeenCalledTimes(1); // 卸载即回收
  });

  it('候选端无任何 PDF UI（本任务不建候选侧入口）', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(true) }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('重试简历校验')).toBeTruthy();
    expect(screen.queryByText('查看 ›')).toBeNull(); // 自己的绑定附件不出查看入口
    expect(mock读取简历PDF).not.toHaveBeenCalled();
  });
});

// ══ Task 7 夹具：completed + handoff_pending 的招聘端镜像 ══

/** completed + handoff_pending（招聘端）：移交文案 + 恒禁用的「开始私聊」，零 mutation。 */
function 招聘已完成移交DTO(): P5详情 {
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

describe('MatchCase详情 · completed 移交只读（Task 7）', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock跳转.mockClear();
    mock新增叮嘱.mockClear();
    mock回答事实.mockClear();
    mock决定S0.mockClear();
    mock决定S1.mockClear();
    mock决定S2.mockClear();
    mock决定S3.mockClear();
    mock提交简历.mockClear();
    mock读取简历PDF.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // brief 片段：completed handoff never navigates to chat —— 按钮在场但恒禁用，
  // 点击零导航（仓库无 jest-dom，toBeDisabled 换成 disabled 属性断言）。
  it('completed handoff never navigates to chat（双端）', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'recruiter', caseId: 'mc_done',
      快照: 详情快照({ detail: 招聘已完成移交DTO() }),
    });
    渲染详情('recruiter', 'mc_done');
    // 移交文案与 handoff_pending 步骤说明同词：findAllByText（在场即算，出现两处属正常）
    expect((await screen.findAllByText('双方已确认，正在创建会话')).length).toBeGreaterThan(0);
    const 按钮 = screen.getByRole('button', { name: '开始私聊' }) as HTMLButtonElement;
    expect(按钮.disabled).toBe(true); // toBeDisabled 的仓库等价断言
    expect(按钮.hasAttribute('disabled')).toBe(true);
    await user.click(按钮); // 禁用键点击无效：零导航、零 mutation
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock决定S3).not.toHaveBeenCalled();

    // 候选端镜像：同一形态同样只给文案 + 恒禁用键
    cleanup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 已完成移交详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect((await screen.findAllByText('双方已确认，正在创建会话')).length).toBeGreaterThan(0);
    const 候选键 = screen.getByRole('button', { name: '开始私聊' }) as HTMLButtonElement;
    expect(候选键.disabled).toBe(true);
    await user.click(候选键);
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('移交视图零会话标识：视图/导航参数/存储/请求坐标都不存在会话标识', async () => {
    const user = userEvent.setup();
    const 存储写入 = vi.spyOn(Storage.prototype, 'setItem');
    try {
      置详情状态({
        role: 'recruiter', caseId: 'mc_done',
        快照: 详情快照({ detail: 招聘已完成移交DTO() }),
      });
      渲染详情('recruiter', 'mc_done');
      expect((await screen.findAllByText('双方已确认，正在创建会话')).length).toBeGreaterThan(0);
      await user.click(screen.getByRole('button', { name: '开始私聊' }));

      // 视图态：页面上含「会话」的文本只有那句准备文案（移交行 + 步骤说明），无任何会话标识
      const 含会话 = screen.getAllByText(/会话/);
      expect(含会话.length).toBeGreaterThan(0);
      含会话.forEach((元) => expect(元.textContent).toBe('双方已确认，正在创建会话'));
      expect(screen.queryByText(/conversation|chat[-_]?id|conv[-_]|session[-_]?id/i)).toBeNull();

      // 导航参数：零跳转（禁用键点击与整页任何入口都不产生会话路由）
      expect(mock跳转).not.toHaveBeenCalled();

      // 存储：全程零写入（快照/标识只在内存）
      expect(存储写入).not.toHaveBeenCalled();

      // 请求坐标：读详情只有 (role, case_id, force) 三元组，无第四个会话参数
      expect(mock读取详情.mock.calls.length).toBeGreaterThan(0);
      mock读取详情.mock.calls.forEach((调) => {
        expect(调).toEqual(['recruiter', 'mc_done', true]);
      });
      // 其余 mutation/PDF 操作一概零调用
      expect(mock新增叮嘱).not.toHaveBeenCalled();
      expect(mock回答事实).not.toHaveBeenCalled();
      expect(mock决定S0).not.toHaveBeenCalled();
      expect(mock决定S1).not.toHaveBeenCalled();
      expect(mock决定S2).not.toHaveBeenCalled();
      expect(mock决定S3).not.toHaveBeenCalled();
      expect(mock提交简历).not.toHaveBeenCalled();
      expect(mock读取简历PDF).not.toHaveBeenCalled();
    } finally {
      存储写入.mockRestore();
    }
  });
});
