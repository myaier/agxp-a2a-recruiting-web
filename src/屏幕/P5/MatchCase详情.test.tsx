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

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchCase详情 } from './MatchCase详情';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { 路径 } from '../../路由/路径表';
import type { P5详情快照 } from '../../状态/后端/类型';
import type { P5列表项 } from '../../数据/招聘数据源/MatchCase';
import type { P5详情 } from '../../数据/招聘数据源/MatchCase';
import type { P5阶段区 } from '../../数据/招聘数据源/MatchCase';
import type { P5S0筛选记录 } from '../../数据/招聘数据源/MatchCase';
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

/** 动态取轻提示条数：轻提示 是 body 上的单例容器，每次断言都重查（捕获引用会过期）。 */
function 轻提示条数(): number {
  return (Array.from(document.body.children).find(
    (节点) => (节点 as HTMLElement).style?.zIndex === '999',
  ) as HTMLElement | undefined)?.childElementCount ?? 0;
}

function 清空轻提示(): void {
  const 容器 = Array.from(document.body.children).find(
    (节点) => (节点 as HTMLElement).style?.zIndex === '999',
  ) as HTMLElement | undefined;
  if (容器) 容器.innerHTML = '';
}

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
    agentAttention: null,
    ...覆盖,
  };
}

/** 四阶段区固定 S0→S3；S0 带 checklist/待答问题/双端叮嘱回执，其余 pending。
 *  summary/checklabel 用真实 wire 闭词（spec §2.4）：summary 是阶段最后一个 step word，
 *  未开始阶段为空串（展示映射负责闭词→中文，未知词不进 DOM）。 */
function 阶段区组(覆盖: Partial<Record<P5阶段区['stage'], Partial<P5阶段区>>> = {}): P5阶段区[] {
  const 基础: P5阶段区[] = [
    {
      stage: 'anonymous_screening', state: 'active', occurredAt: '2026-08-29T01:10:00Z',
      summary: 'candidate_reevaluation',
      checklist: [{ label: 'anonymous_screening_passed', done: true }, { label: 'resume_bound', done: false }],
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
      // S0 展开块归一化形状：仅 S0 可为对象，其余段一律 null
      screeningRecords: { messages: [], summaries: [] },
    },
    { stage: 'resume_submission', state: 'pending', occurredAt: null, summary: '', checklist: [], transcript: [], instructionReceipts: [], attachment: null, screeningRecords: null },
    { stage: 'needs_coordination', state: 'pending', occurredAt: null, summary: '', checklist: [], transcript: [], instructionReceipts: [], attachment: null, screeningRecords: null },
    { stage: 'intent_confirmation', state: 'pending', occurredAt: null, summary: '', checklist: [], transcript: [], instructionReceipts: [], attachment: null, screeningRecords: null },
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
  /** P7 Task 6：completed + complete 的已发布会话坐标。 */
  conversationRef?: P5详情['conversationRef'];
  /** Task 3：招聘端别名可换（S0 禁词断言按整页 body 文本算，别名不得含 candidate 字样）。 */
  别名?: string;
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
    conversationRef: 选项.conversationRef ?? null,
  };
}

function 招聘详情DTO(选项: 详情选项 = {}): P5详情 {
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
    stages: 阶段区组({ anonymous_screening: { state: 'ended', summary: 'complete' } }),
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

/**
 * 终局时间的期望值：用 Date 的本地 getter 独立推出 `YYYY-MM-DD HH:mm`，
 * 与 mapper 的 Intl 路径各算各的（生产跟随用户环境时区，测试按进程 TZ 取期望）。
 */
function 本地终局期望(原文: string): string {
  const 时刻 = new Date(原文);
  const 补 = (数: number) => String(数).padStart(2, '0');
  return `${时刻.getFullYear()}-${补(时刻.getMonth() + 1)}-${补(时刻.getDate())}`
    + ` ${补(时刻.getHours())}:${补(时刻.getMinutes())}`;
}

/** 测试外置可控 promise：手动决定 settle 时机（回答 in-flight 夹具用）。 */
function 可控Promise<T>() {
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
function 测试换Case钮({ 目标, 文案 }: { 目标: string; 文案: string }) {
  const 导航 = useNavigate();
  return <button type="button" onClick={() => 导航(目标)}>{文案}</button>;
}

/** 测试本地地址行：把当前路由地址印进 DOM，钉住「切 Tab 不改 URL」（外壳 Tab 是页内状态）。 */
function 测试地址行() {
  const 位置 = useLocation();
  return <div>{位置.pathname + 位置.search}</div>;
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
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy(); // 冻结职位名 · 公司槽缺失占位（F3）
    // Task 4：内部意向 ID 不再出现在可见内容里（业务上下文靠冻结职位/城市/薪资承载）
    expect(document.body.textContent).not.toContain(意向ID);
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

  it('招聘端直达刷新：candidate_alias 不进顶栏（去名裁定）+ 画像缺段占位 + 岗位上下文；无姓名/对端字段', async () => {
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: 招聘详情DTO() }) });
    渲染详情('recruiter', 'mc_hr');
    expect(mock读取详情).toHaveBeenCalledWith('recruiter', 'mc_hr', true);
    // scope 坐标是 case_id（不是别名）
    expect(mock设置P5范围).toHaveBeenCalledWith('recruiter', P5范围键.detail('recruiter', 'mc_hr'));
    // 去名裁定（2026-09-09）：alias 是不透明展示文本，不解析、不渲染，也不以「缺少姓名」恢复姓名区
    expect(await screen.findByTitle('匹配分缺失')).toBeTruthy();
    expect(document.body.textContent).not.toContain(别名);
    // 画像位置全保留，缺失说缺失；性别位给中性未知标记，不猜性别
    expect(screen.getByText('经验缺失')).toBeTruthy();
    expect(screen.getByText('学历缺失')).toBeTruthy();
    expect(screen.getByText('求职状态缺失')).toBeTruthy();
    expect(screen.getByRole('img', { name: '性别未知' })).toBeTruthy();
    // 冻结职位随岗位上下文行在场（职位名 · 城市 · 薪资带）
    expect(screen.getByText('平台工程师 · 上海 · 25-40K·16薪')).toBeTruthy();
    // 姓名与结构化身份是 P5.1 依赖：一个都不渲染
    expect(screen.queryByText('沈亦舟')).toBeNull();
    expect(document.body.textContent).not.toContain(意向ID); // 对端（候选端）字段进不了视图
    expect(screen.queryByText('匹配度分析')).toBeNull();

    // 候选端镜像：别名/对端字段同样不出现（双向不漏）
    cleanup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy();
    expect(document.body.textContent).not.toContain(意向ID);
    expect(screen.queryByText(别名)).toBeNull();
  });

  it('正常 Backend 详情用共用外壳：进度/资料两 Tab 在场，切 Tab 不改 URL，换单 Tab 回进度', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'candidate', caseId: 'mc_a',
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_a' }) }) }),
    });
    const 页 = render(
      <MemoryRouter initialEntries={['/deal/mc_a']}>
        <测试地址行 />
        <测试换Case钮 目标="/deal/mc_b" 文案="切到新单" />
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy();
    expect(screen.getByText('/deal/mc_a')).toBeTruthy();
    expect(screen.getByRole('button', { name: '代谈进度' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '职位详情' })).toBeTruthy();

    // 切到资料：槽位换成缺口说明（当前 P5 detail 不提供资料区字段），地址不变
    await user.click(screen.getByRole('button', { name: '职位详情' }));
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy();
    expect(screen.queryByText('轮次 1/3')).toBeNull(); // 进度 槽已卸载（唯一挂载）
    expect(screen.getByText('/deal/mc_a')).toBeTruthy();

    // 换单：Tab 重置回进度，不把上一单的视图带给下一单
    置详情状态({
      role: 'candidate', caseId: 'mc_b',
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_b' }) }) }),
    });
    await user.click(screen.getByRole('button', { name: '切到新单' }));
    expect(await screen.findByText('轮次 1/3')).toBeTruthy();
    expect(screen.getByText('/deal/mc_b')).toBeTruthy();
    页.unmount();
  });

  it('从资料 Tab 切回进度：当前段回到 DOM 且重新定位（不因条件挂载丢失节点定位）', async () => {
    vi.useFakeTimers();
    const 滚动 = vi.fn();
    const 原生 = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = 滚动;
    try {
      置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
      渲染详情('candidate', 'mc_direct');
      await act(() => vi.advanceTimersByTimeAsync(300));
      expect(滚动.mock.calls.length).toBeGreaterThan(0); // 进入详情定位当前阶段
      const 首次 = 滚动.mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name: '职位详情' }));
      expect(screen.queryByText('匿名初筛')).toBeNull(); // 进度槽互斥挂载，切走即卸载
      fireEvent.click(screen.getByRole('button', { name: '代谈进度' }));
      // 当前段回到 DOM（默认展开），不是只有状态区
      expect(screen.getByText('匿名初筛')).toBeTruthy();
      expect(screen.getByText('每周可以到岗几天？')).toBeTruthy();
      await act(() => vi.advanceTimersByTimeAsync(300));
      expect(滚动.mock.calls.length).toBeGreaterThan(首次); // 切回进度重新定位当前段
    } finally {
      HTMLElement.prototype.scrollIntoView = 原生;
      vi.useRealTimers();
    }
  });

  it('正常换 Case 不沿用折叠状态：上一单手动收起的当前段，在新单恢复默认展开', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'candidate', caseId: 'mc_a',
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_a' }) }) }),
    });
    const 页 = render(
      <MemoryRouter initialEntries={['/deal/mc_a']}>
        <测试换Case钮 目标="/deal/mc_b" 文案="切到新单" />
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>,
    );
    // S0 是当前段，默认展开：段内对话在场
    expect(await screen.findByText('每周可以到岗几天？')).toBeTruthy();
    await user.click(screen.getByText('匿名初筛').closest('button')!);
    expect(screen.queryByText('每周可以到岗几天？')).toBeNull(); // 手动收起

    置详情状态({
      role: 'candidate', caseId: 'mc_b',
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_b' }) }) }),
    });
    await user.click(screen.getByRole('button', { name: '切到新单' }));
    expect(await screen.findByText('每周可以到岗几天？')).toBeTruthy(); // 新单回到默认展开
    页.unmount();
  });

  it('四阶段固定 S0→S3 顺序（mapper 交付顺序，无客户端重排）；分节条显示 P5 自己的阶段标题', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    // 展示标题 = P5 区.标题（服务端阶段标题闭词投影）；颜色/排序/折叠键仍是共用四阶段名
    const 名序 = ['匿名初筛', '简历提交', '差异协同', '意向确认'];
    await screen.findByText('平台工程师 · 公司信息缺失');
    名序.forEach((名) => expect(screen.getAllByText(名).length).toBe(1));
    const [s0, s1, s2, s3] = 名序.map((名) => screen.getAllByText(名)[0]!);
    expect(s0.compareDocumentPosition(s1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(s1.compareDocumentPosition(s2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(s2.compareDocumentPosition(s3) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('checklist / 时间线 / 叮嘱回执按类型渲染为展示文本', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    // S0 是当前段（默认展开）：核对清单（闭词→固定中文）、待答问题文本、双方叮嘱回执全部在场
    expect(await screen.findByText('匿名初筛已通过')).toBeTruthy();
    expect(screen.getByText('简历已绑定')).toBeTruthy(); // 未完成项标「核对中」
    expect(screen.getByText('每周可以到岗几天？')).toBeTruthy(); // 时间线文本原样展示
    expect(screen.getByText('工作日 10:00-19:00 联系')).toBeTruthy(); // 本端叮嘱回执
    expect(screen.getByText('流程预计两周内走完')).toBeTruthy(); // 对端叮嘱回执
    expect(screen.getByText('待处理')).toBeTruthy(); // 状态文案胶囊（六闭词表）
    expect(screen.getByText('等待人工决定是否继续')).toBeTruthy(); // 步骤说明（17 词闭表）
    expect(screen.getByText('轮次 1/3')).toBeTruthy();
  });

  it('阶段 summary/checklist 闭词走固定中文，未知 token 不进 DOM（安全兜底）', async () => {
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          stages: 阶段区组({
            anonymous_screening: {
              summary: 'secret_internal_step',
              checklist: [
                { label: 'anonymous_screening_passed', done: true },
                { label: 'secret_internal_check', done: false },
              ],
            },
          }),
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    // 已知闭词 → 固定中文；未知 summary → 安全兜底文案；未知 checklist 整项省略
    expect(await screen.findByText('阶段信息待更新')).toBeTruthy();
    expect(screen.getByText('匿名初筛已通过')).toBeTruthy();
    // 原始 token 一个都不进 DOM
    expect(screen.queryByText('secret_internal_step')).toBeNull();
    expect(screen.queryByText('secret_internal_check')).toBeNull();
  });

  it('candidate_question 步骤说明是 AI 侧生成动作，不是候选人的人工待办', async () => {
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          state: 状态({ status: 'running', step: 'candidate_question', needsUser: false, round: 0 }),
          needsAction: false,
          availableActions: [],
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    expect((await screen.findAllByText('候选方 AI 正在生成补充问题')).length).toBeGreaterThan(0);
    expect(screen.queryByText('等待候选人补充事实')).toBeNull(); // 旧文案（人工待办口径）退役
    // AI 生成中：无任何人工回答控件
    expect(screen.queryByRole('textbox', { name: '回答问题' })).toBeNull();
    expect(screen.queryByRole('button', { name: '提交回答' })).toBeNull();
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
    expect(screen.getByText('平台工程师 · 公司信息缺失')).toBeTruthy(); // 旧详情原样保留，不降级成空白
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

  it('终局详情不显示「代理处理中」徽标（只读终局，不是在处理）', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 已终止详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    await screen.findByText('终局'); // 终局卡在场（缺失则 findBy 抛错）
    expect(screen.queryByText('代理处理中')).toBeNull();
    expect(screen.queryByText('需要你')).toBeNull();
  });

  it('终局详情停 3 秒轮询、隐藏输入，终局摘要给本地时间而非原始 RFC3339', async () => {
    vi.useFakeTimers();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 已终止详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(mock读取详情).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(7000));
    expect(mock读取详情).toHaveBeenCalledTimes(1); // terminal detail 停止 polling（§10.3）
    expect(screen.queryByPlaceholderText(叮嘱占位)).toBeNull(); // 终局隐藏叮嘱输入
    // 结束语/原因仍是 wire 原样（不翻译不改写）
    expect(screen.getAllByText('user_ended').length).toBeGreaterThan(0);
    // 定格于换成本地展示值：原始 RFC3339 与任何 ISO 形状都不得出现在屏上
    expect(document.body.textContent).not.toContain('2026-08-29T03:00:00Z');
    expect(document.body.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
    expect(screen.getByText(本地终局期望('2026-08-29T03:00:00Z'))).toBeTruthy();
    // 内部 ID 同样不在可见内容里
    expect(document.body.textContent).not.toContain(意向ID);
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

  it('缺 P5.1 段不渲染：无 Mock Tab 名、无匹配度分析、匹配分位显示缺失、无公司块', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy();
    // Tab 行是共用产品名（spec §1：求职端 代谈进度 / 职位详情），招聘端 Tab 名不上求职端
    expect(screen.getByRole('button', { name: '代谈进度' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '职位详情' })).toBeTruthy();
    expect(screen.queryByText('在线简历')).toBeNull();
    expect(screen.queryByText('匹配度分析')).toBeNull(); // Mock 的资料面不出现（P5.1 依赖）
    // Backend 详情没有匹配分：右侧分数位显示缺失（— + 可访问说明），不传 0、不画假分
    const 分数位 = screen.getByTitle('匹配分缺失');
    expect(分数位.textContent).toBe('—');
    expect(screen.queryByText('公司')).toBeNull(); // 无公司块（P5.1 依赖）
  });
});

// ── 详情统一 Task 3：第二 Tab 用共用 职位资料 渲染完整缺失区（spec §3.3）─────────

describe('MatchCase详情 · 资料 Tab 与完整缺失区（Task 3）', () => {
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

  it('缺资料：分析/JD/要求/公司五元行/标签/对接人都有标题或标签及缺失；冻结摘要与缺口说明在场', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '职位详情' }));
    // 阅读顺序（spec §3.3）五个区块各有标题，位置一个不缺。「职位详情」与 Tab 按钮
    // 同词（Tab 名恢复产品合同），逐标题按在场断言即可
    for (const 标题 of ['匹配度分析', '职位详情', '职位要求', '公司信息', '对接人']) {
      expect(screen.getAllByText(标题).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('匹配分析缺失')).toBeTruthy();
    expect(screen.getByText('职位详情缺失')).toBeTruthy();
    expect(screen.getByText('职位要求缺失')).toBeTruthy();
    expect(screen.getByText('公司介绍缺失')).toBeTruthy();
    expect(screen.getByText('公司标签缺失')).toBeTruthy();
    // 公司五元行位置恒在，缺值显示「—」+ 可访问缺失说明
    for (const 标签 of ['融资阶段', '规模', '行业', '成立', '地址']) {
      expect(screen.getByText(标签)).toBeTruthy();
      expect(screen.getByTitle(`${标签}缺失`).textContent).toBe('—');
    }
    expect(screen.getByTitle('对接人姓名缺失').textContent).toBe('—');
    expect(screen.getByTitle('对接人职务缺失').textContent).toBe('—');
    expect(screen.getByRole('img', { name: '对接人头像缺失' })).toBeTruthy();
    expect(screen.getByRole('img', { name: '公司标志缺失' })).toBeTruthy();
    // 冻结四事实不丢（岗位摘要位如实展示），缺口说明用约定句
    expect(screen.getByText('上海')).toBeTruthy();
    expect(screen.getByText('Kubernetes')).toBeTruthy();
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy();
    // 缺失不走错误红/通过绿的语义色：这里没有通过/失败图标
    expect(screen.queryByRole('img', { name: /通过/ })).toBeNull();
  });

  it('Tab 切换零新增请求：组织/推荐/岗位等所有操作在切换前后调用数不变', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy();
    const 操作调用数 = () => Object.values(mock操作).map((fn) => fn.mock.calls.length);
    const 切换前 = 操作调用数();
    fireEvent.click(screen.getByRole('button', { name: '职位详情' }));
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy();
    expect(操作调用数()).toEqual(切换前);
    fireEvent.click(screen.getByRole('button', { name: '代谈进度' }));
    expect(screen.getByText('匿名初筛')).toBeTruthy();
    expect(操作调用数()).toEqual(切换前);
  });
});

// ── 详情统一 Task 4：招聘端第二 Tab = 共用 在线简历正文（完整布局、档 null）──────
//    Backend P5 detail 不提供结构化在线简历：九区逐区缺失，不以一句「简历尚未同步」
//    替代整页；求职期望未知不给「已进入初筛/一致」承诺。求职端第二 Tab 仍是 职位资料。
describe('MatchCase详情 · 招聘端在线简历 Tab（Task 4）', () => {
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

  it('recruiter 资料 Tab：九区标题原位保留并逐区缺失，缺口说明与页尾说明在场', async () => {
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: 招聘详情DTO() }) });
    渲染详情('recruiter', 'mc_hr');
    expect(await screen.findByText('平台工程师 · 上海 · 25-40K·16薪')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '在线简历' }));
    const 标题们 = [
      '匹配度分析', '个人优势', '求职期望', '工作经历', '项目经历', '教育经历', '专业技能',
    ] as const;
    for (const 标题 of 标题们) expect(screen.getByText(标题)).toBeTruthy();
    const 缺失们 = [
      '匿名画像缺失', '职位信息缺失', '匹配分析缺失', '个人优势缺失', '求职期望缺失',
      '工作经历缺失', '项目经历缺失', '教育经历缺失', '专业技能缺失',
    ] as const;
    for (const 缺失 of 缺失们) expect(screen.getByText(缺失)).toBeTruthy();
    // 区块级缺口说明用与求职端资料区同一句约定文案
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy();
    expect(screen.getByText(/在线简历缺失 · 内容不可转发/)).toBeTruthy();
  });

  it('recruiter 资料 Tab 不给无依据承诺与身份信息：无假薪资结论、无一致性 ✓、别名不上屏', async () => {
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: 招聘详情DTO() }) });
    渲染详情('recruiter', 'mc_hr');
    await screen.findByText('平台工程师 · 上海 · 25-40K·16薪');
    fireEvent.click(screen.getByRole('button', { name: '在线简历' }));
    expect(screen.queryByText('薪资带已进入初筛')).toBeNull();
    expect(screen.queryByText('✓')).toBeNull();
    expect(document.body.textContent).not.toContain(别名);
    expect(document.body.textContent).not.toContain('适配分');
    // 招聘端第二 Tab 不是 职位资料（那是求职端的资料区）
    expect(screen.queryByText('公司信息')).toBeNull();
    expect(screen.queryByText('对接人')).toBeNull();
  });

  it('candidate 资料 Tab 仍是职位资料（完整缺失区），不出现在线简历缺失占位', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '职位详情' }));
    expect(screen.getByText('公司信息')).toBeTruthy();
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy();
    expect(screen.queryByText('匿名画像缺失')).toBeNull();
    expect(screen.queryByText('工作经历缺失')).toBeNull();
  });

  it('招聘端切 Tab 零新增请求：所有操作在切换前后调用数不变', async () => {
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: 招聘详情DTO() }) });
    渲染详情('recruiter', 'mc_hr');
    await screen.findByText('平台工程师 · 上海 · 25-40K·16薪');
    const 操作调用数 = () => Object.values(mock操作).map((fn) => fn.mock.calls.length);
    const 切换前 = 操作调用数();
    fireEvent.click(screen.getByRole('button', { name: '在线简历' }));
    expect(screen.getByText('个人优势缺失')).toBeTruthy();
    expect(操作调用数()).toEqual(切换前);
    fireEvent.click(screen.getByRole('button', { name: '代谈进度' }));
    expect(screen.getByText('匿名初筛')).toBeTruthy();
    expect(操作调用数()).toEqual(切换前);
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

/** S1 needs_user 行（招聘）：初筛结论卡；S1 区带已披露 typed 附件。
 *  带段内对话 = 再给 S1 段一条带文本时间线 + 一条本端叮嘱回执（终审回归钉用：
 *  段内有对话内容时 PDF 入口不得被压掉）。 */
function S1初筛详情(带附件: boolean, 带段内对话 = false): P5详情 {
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
          eventId: 'evt_s1_note', stage: 'resume_submission', kind: 'stage_note',
          role: '', text: '候选人已确认可以到岗', occurredAt: '2026-08-29T02:30:00Z',
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

/** S1 waiting + screening_resume（招聘）：AI 初筛进行中 —— 克隆 S1初筛详情(true) 后
 *  只改 state 四元组与动作侧：waiting 行 + 空动作表，AI 文案在场、零决策控件。 */
function S1AI初筛详情(): P5详情 {
  const 基座 = S1初筛详情(true);
  return {
    ...基座,
    state: { ...基座.state, status: 'waiting', step: 'screening_resume', needsUser: false },
    needsAction: false,
    availableActions: [],
  };
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

/** P7 Task 6：completed + complete + conversation_ref —— 会话已发布的权威移交形态。 */
function 已发布移交详情DTO(role: P5角色 = 'candidate'): P5详情 {
  const 底 = 已完成移交详情DTO();
  const 已发布 = { ...底, state: { ...底.state, step: 'complete' as const }, conversationRef: '3003' };
  return role === 'candidate'
    ? 已发布
    : { ...已发布, role, context: { candidateAlias: 别名, job: 底.context.job } };
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

  it('回答 pending：输入与按钮禁用、显示「提交中…」、重复点击零额外请求', async () => {
    const user = userEvent.setup();
    const deferred = 可控Promise<void>();
    mock回答事实.mockReturnValueOnce(deferred.promise);
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    const input = screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement;
    await user.type(input, '每周可以到岗 3 天');
    await user.click(screen.getByRole('button', { name: '提交回答' }));
    // 可见 pending：textarea 与按钮双双锁定，按钮文案切「提交中…」
    expect(input.disabled).toBe(true);
    expect((screen.getByRole('button', { name: '提交中…' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: '提交中…' })); // 禁用键：零额外请求
    expect(mock回答事实).toHaveBeenCalledTimes(1);
    deferred.resolve();
    await waitFor(() => expect(input.value).toBe('')); // 成功才清草稿
    await waitFor(() => expect(input.disabled).toBe(false)); // 落定后恢复可输入
  });

  it('回答失败：恢复输入与按钮，草稿原样保留', async () => {
    const user = userEvent.setup();
    mock回答事实.mockRejectedValueOnce(new Error('failed'));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    const input = screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement;
    await user.type(input, '保留这段回答');
    await user.click(screen.getByRole('button', { name: '提交回答' }));
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '提交回答' }) as HTMLButtonElement).disabled).toBe(false));
    expect(input.disabled).toBe(false);
    expect(input.value).toBe('保留这段回答'); // 失败绝不清空
  });

  it('跨 Case deferred：旧单迟到的成败不改动新单的草稿与 pending 状态', async () => {
    const user = userEvent.setup();
    const deferred = 可控Promise<void>();
    mock回答事实.mockReturnValueOnce(deferred.promise);
    置详情状态({
      role: 'candidate', caseId: 'mc_a',
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_a' }) }) }),
    });
    render(
      <MemoryRouter initialEntries={['/deal/mc_a']}>
        <测试换Case钮 目标="/deal/mc_b" 文案="切到新单" />
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>,
    );
    const inputA = screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement;
    await user.type(inputA, '旧单的回答');
    await user.click(screen.getByRole('button', { name: '提交回答' }));
    expect(mock回答事实).toHaveBeenCalledWith('candidate', 'mc_a', 'prompt_1', '旧单的回答');
    expect((screen.getByRole('button', { name: '提交中…' }) as HTMLButtonElement).disabled).toBe(true);

    // 预置新单快照，同一 Route 内切 case：草稿清空、pending 解除（代际递增）
    置详情状态({
      role: 'candidate', caseId: 'mc_b',
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_b' }) }) }),
    });
    await user.click(screen.getByRole('button', { name: '切到新单' }));
    const inputB = screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement;
    expect(inputB.value).toBe('');
    expect((screen.getByRole('button', { name: '提交回答' }) as HTMLButtonElement).disabled).toBe(false);
    await user.type(inputB, '新单草稿');

    // 旧单请求此刻才落定：代际栅栏作废其迟到回调，新单草稿与 pending 分毫不动
    await act(async () => {
      deferred.resolve();
    });
    expect(inputB.value).toBe('新单草稿');
    expect((screen.getByRole('button', { name: '提交回答' }) as HTMLButtonElement).disabled).toBe(false);

    // 新单照常可发：新代际的锁与清空只作用于新草稿
    await user.click(screen.getByRole('button', { name: '提交回答' }));
    expect(mock回答事实).toHaveBeenCalledTimes(2);
    expect(mock回答事实).toHaveBeenLastCalledWith('candidate', 'mc_b', 'prompt_1', '新单草稿');
  });

  it('回答在飞时离开又回原单：续锁到旧请求收口，不放行第二段草稿（同键单飞防吞稿）', async () => {
    const user = userEvent.setup();
    const deferred = 可控Promise<void>();
    mock回答事实.mockReturnValueOnce(deferred.promise);
    置详情状态({
      role: 'candidate', caseId: 'mc_a',
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_a' }) }) }),
    });
    render(
      <MemoryRouter initialEntries={['/deal/mc_a']}>
        <测试换Case钮 目标="/deal/mc_b" 文案="切到新单" />
        <测试换Case钮 目标="/deal/mc_a" 文案="切回旧单" />
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>,
    );
    const inputA = screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement;
    await user.type(inputA, '第一段回答');
    await user.click(screen.getByRole('button', { name: '提交回答' }));
    expect(mock回答事实).toHaveBeenCalledWith('candidate', 'mc_a', 'prompt_1', '第一段回答');
    expect((screen.getByRole('button', { name: '提交中…' }) as HTMLButtonElement).disabled).toBe(true);

    // 离开去 B：B 的回答区干净起步（A 单在飞不锁 B）
    置详情状态({
      role: 'candidate', caseId: 'mc_b',
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_b' }) }) }),
    });
    await user.click(screen.getByRole('button', { name: '切到新单' }));
    expect((screen.getByRole('button', { name: '提交回答' }) as HTMLButtonElement).disabled).toBe(false);

    // 回到 A：旧请求仍在飞 → 回答区续锁，不得放行第二段草稿
    //（操作层同键单飞会复用旧 POST，放锁会让新草稿绑上旧承诺被静默吞掉）
    置详情状态({
      role: 'candidate', caseId: 'mc_a',
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_a' }) }) }),
    });
    await user.click(screen.getByRole('button', { name: '切回旧单' }));
    const inputA2 = screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement;
    expect(inputA2.value).toBe('');
    expect(inputA2.disabled).toBe(true);
    expect((screen.getByRole('button', { name: '提交中…' }) as HTMLButtonElement).disabled).toBe(true);

    // 旧请求收口：解锁恢复可输入，且全程只发过一次 POST
    deferred.resolve();
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '提交回答' }) as HTMLButtonElement).disabled).toBe(false));
    expect(mock回答事实).toHaveBeenCalledTimes(1);

    // 收口后新草稿照常提交
    await user.type(inputA2, '第二段回答');
    await user.click(screen.getByRole('button', { name: '提交回答' }));
    expect(mock回答事实).toHaveBeenCalledTimes(2);
    expect(mock回答事实).toHaveBeenLastCalledWith('candidate', 'mc_a', 'prompt_1', '第二段回答');
  });

  it('经无动作单往返：在飞锁随页面存活，回原单续锁（动作区重挂载不丢锁）', async () => {
    const user = userEvent.setup();
    const deferred = 可控Promise<void>();
    mock回答事实.mockReturnValueOnce(deferred.promise);
    置详情状态({
      role: 'candidate', caseId: 'mc_a',
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_a' }) }) }),
    });
    render(
      <MemoryRouter initialEntries={['/deal/mc_a']}>
        <测试换Case钮 目标="/deal/mc_b" 文案="切到无动作单" />
        <测试换Case钮 目标="/deal/mc_a" 文案="切回旧单" />
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>,
    );
    const inputA = screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement;
    await user.type(inputA, '第一段回答');
    await user.click(screen.getByRole('button', { name: '提交回答' }));
    expect((screen.getByRole('button', { name: '提交中…' }) as HTMLButtonElement).disabled).toBe(true);

    // 切到无动作单（running 行 + 空动作表）：阶段动作区整体卸载
    置详情状态({
      role: 'candidate', caseId: 'mc_b',
      快照: 详情快照({
        detail: 候选详情DTO({
          state: 状态({ caseId: 'mc_b', status: 'running', step: 'policy_check', needsUser: false, round: 0 }),
          needsAction: false,
          availableActions: [],
        }),
      }),
    });
    await user.click(screen.getByRole('button', { name: '切到无动作单' }));
    expect(screen.queryByRole('textbox', { name: '回答问题' })).toBeNull(); // 动作区已卸载

    // 回原单：新动作区重挂载，仍续锁到旧请求收口
    置详情状态({
      role: 'candidate', caseId: 'mc_a',
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_a' }) }) }),
    });
    await user.click(screen.getByRole('button', { name: '切回旧单' }));
    const inputA2 = screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement;
    expect(inputA2.value).toBe('');
    expect(inputA2.disabled).toBe(true);
    expect((screen.getByRole('button', { name: '提交中…' }) as HTMLButtonElement).disabled).toBe(true);

    deferred.resolve();
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '提交回答' }) as HTMLButtonElement).disabled).toBe(false));
    expect(mock回答事实).toHaveBeenCalledTimes(1); // 往返全程只发过一次 POST
    await user.type(inputA2, '第二段回答');
    await user.click(screen.getByRole('button', { name: '提交回答' }));
    expect(mock回答事实).toHaveBeenCalledTimes(2);
    expect(mock回答事实).toHaveBeenLastCalledWith('candidate', 'mc_a', 'prompt_1', '第二段回答');
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

  it('S0 迁移后单挂载：两卡只经 详情动作卡/事实问题卡 渲染一次，问题与回答框同卡', () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    // 同一 action 只有一个来源（hook 卡唯一挂载，旧 switch 不再出 S0 两卡）
    expect(screen.getAllByText('补充事实')).toHaveLength(1);
    expect(screen.getAllByRole('textbox', { name: '回答问题' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '提交回答' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '结束初筛' })).toHaveLength(1);
    // 事实问题卡在 respond_fact 卡正文槽内：当前问题 + 动作标题/说明保留
    expect(screen.getByText('问：每周可以到岗几天？')).toBeTruthy();
    expect(screen.getByText('回答当前阶段待补充的问题')).toBeTruthy();
    expect(screen.getByText('结束本次匿名初筛')).toBeTruthy();
  });

  it('respond_fact + end_screening 只有补充事实与结束动作，没有继续初筛', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({ availableActions: ['respond_fact', 'end_screening'] }),
      }),
    });
    渲染详情('candidate', 'mc_direct');

    // 「继续初筛」是前端自造的未授权动作：任何形态都不出现（spec §10.1）
    expect(screen.queryByRole('button', { name: '继续初筛' })).toBeNull();
    expect(screen.getByRole('textbox', { name: '回答问题' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '结束初筛' }));
    expect(mock决定S0).not.toHaveBeenCalled();
    const 确认框 = screen.getByRole('dialog');
    expect(within(确认框).getByText('结束后这一单立即终止，无法恢复。')).toBeTruthy();
    await user.click(within(确认框).getByRole('button', { name: '暂不结束' })); // 取消零请求
    expect(mock决定S0).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '结束初筛' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '结束初筛' }));
    expect(mock决定S0).toHaveBeenCalledTimes(1);
    expect(mock决定S0).toHaveBeenCalledWith('mc_direct', 'end');
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
    await user.click(within(选择框).getByRole('radio', { name: /简历_v2\.pdf/ }));
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
    await user.click(within(再选).getByRole('radio', { name: /简历_v1\.pdf/ }));
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
    expect(screen.queryByRole('radio', { name: /简历_v1\.pdf/ })).toBeNull(); // 单份不再过单选层
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
    await user.click(within(选择框).getByRole('radio', { name: /简历_v2\.pdf/ }));
    await user.click(within(选择框).getByRole('button', { name: '选定这份' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '暂不递交' }));
    expect(mock提交简历).not.toHaveBeenCalled();
    // 第二次：改选 v1，确认递交 —— 发出去的恰是这次选的对
    await user.click(screen.getByRole('button', { name: '更换简历' }));
    const 再选 = await screen.findByRole('dialog');
    await user.click(within(再选).getByRole('radio', { name: /简历_v1\.pdf/ }));
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

// ── P7 Task 6：completed 两步移交接线（pending 继续轮询 → ready 启用并进 P7 路由）──
describe('MatchCase详情 · P7 移交两步接线', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock跳转.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pending（handoff_pending）：开始私聊在场但禁用，3 秒节拍继续权威重读，无内部错误词', async () => {
    vi.useFakeTimers();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 已完成移交详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getAllByText('双方已确认，正在创建会话').length).toBeGreaterThan(0);
    const 私聊键 = screen.getByRole('button', { name: '开始私聊' }) as HTMLButtonElement;
    expect(私聊键.disabled).toBe(true);
    const 基线 = mock读取详情.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(3000));
    await act(() => vi.advanceTimersByTimeAsync(3000));
    // pending 不是详情终局：多拍后仍在权威重读（same-party 长期 pending 同形态）
    expect(mock读取详情.mock.calls.length).toBeGreaterThan(基线);
    expect(mock跳转).not.toHaveBeenCalled();
    // 绝不出现内部错误词或前端自造的超时终态
    expect(screen.queryByText(/invalid_actor_identity/)).toBeNull();
    expect(screen.queryByText('真人会话已建立')).toBeNull();
    expect((screen.getByRole('button', { name: '开始私聊' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('ready（complete + conversation_ref）：开始私聊启用并按角色进入 P7 会话路由', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 已发布移交详情DTO('candidate') }) });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText('真人会话已建立')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '开始私聊' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.真人会话路径('3003'));

    // 招聘端镜像：进入企业参数路由
    cleanup();
    mock跳转.mockClear();
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: 已发布移交详情DTO('recruiter') }) });
    渲染详情('recruiter', 'mc_hr');
    await user.click(screen.getByRole('button', { name: '开始私聊' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.企业真人会话路径('3003'));
  });

  it('ready 详情终局停轮询：3 秒节拍不再重读', async () => {
    vi.useFakeTimers();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 已发布移交详情DTO('candidate') }) });
    渲染详情('candidate', 'mc_direct');
    const 基线 = mock读取详情.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(3000));
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(mock读取详情.mock.calls.length).toBe(基线);
  });
});

describe('MatchCase详情 · 授权原始 PDF（Task 6）', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock读取简历PDF.mockClear();
    mock读取简历PDF.mockResolvedValue({ url: 'blob:p5-resume', revoke: () => undefined });
    mock跳转.mockClear();
    清空轻提示();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('披露前与解析中：无姓名/联系方式/PDF 入口，零 PDF 请求', async () => {
    // 解析中（S1 waiting）：后端保持附件闭合
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1解析中详情() }) });
    渲染详情('recruiter', 'mc_hr');
    expect(await screen.findByText('正在解析简历')).toBeTruthy(); // 详情已渲染（S1 段摘要）
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

  it('S1 段有叮嘱回执与文本时间线时 PDF 入口仍在（终审回归钉），照常打开', async () => {
    const user = userEvent.setup();
    const 租约 = { url: 'blob:p5-resume', revoke: vi.fn() };
    mock读取简历PDF.mockResolvedValue(租约);
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1初筛详情(true, true) }) });
    渲染详情('recruiter', 'mc_hr');
    // 段内对话非空：本端叮嘱回执与文本时间线都照常展示
    expect(await screen.findByText('只在工作日 10:00-19:00 联系')).toBeTruthy();
    expect(screen.getByText('候选人已确认可以到岗')).toBeTruthy();
    // 入口不被段内对话压掉：仍在、可开、恰好一次租约
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v2\.pdf/ }));
    expect(mock读取简历PDF).toHaveBeenCalledTimes(1);
    expect(mock读取简历PDF).toHaveBeenCalledWith('recruiter', 'mc_hr');
    const 弹层 = await screen.findByRole('dialog', { name: '简历原件' });
    expect(
      (within(弹层).getByTitle('简历 PDF') as HTMLIFrameElement).getAttribute('src'),
    ).toBe('blob:p5-resume');
    await user.click(within(弹层).getByRole('button', { name: '关闭' }));
    expect(租约.revoke).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: '简历原件' })).toBeNull();
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

  // Task 3：候选端也能看本 Case 已下发的本人 PDF —— 入口只由阶段投影的 typed 附件授权。
  it('候选端 typed 附件在场：点击走 candidate 路径一次，弹层以租约地址呈现真实 PDF', async () => {
    const user = userEvent.setup();
    const 租约 = { url: 'blob:p5-own-resume', revoke: vi.fn() };
    mock读取简历PDF.mockResolvedValue(租约);
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(true) }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('重试简历校验')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v1\.pdf/ }));
    expect(mock读取简历PDF).toHaveBeenCalledTimes(1);
    // 角色路径严格：候选端只走 candidate 臂，不复用 recruiter 路径
    expect(mock读取简历PDF).toHaveBeenCalledWith('candidate', 'mc_direct');
    const 弹层 = await screen.findByRole('dialog', { name: '简历原件' });
    expect(
      (within(弹层).getByTitle('简历 PDF') as HTMLIFrameElement).getAttribute('src'),
    ).toBe('blob:p5-own-resume');
    await user.click(within(弹层).getByRole('button', { name: '关闭' }));
    expect(租约.revoke).toHaveBeenCalledTimes(1);
  });

  it('候选端无附件：零入口零请求，不从附件库猜文件', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(false) }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('重试简历校验')).toBeTruthy();
    expect(screen.queryByText('查看 ›')).toBeNull();
    expect(screen.queryByText('后端工程师_简历_v1.pdf')).toBeNull();
    expect(mock读取简历PDF).not.toHaveBeenCalled();
  });

  it('候选端连点只发一次请求（在飞单飞）', async () => {
    const user = userEvent.setup();
    const 门 = 可控Promise<{ url: string; revoke: () => undefined }>();
    mock读取简历PDF.mockReturnValue(门.promise);
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(true) }) });
    渲染详情('candidate', 'mc_direct');
    const 入口 = screen.getByRole('button', { name: /后端工程师_简历_v1\.pdf/ });
    await user.click(入口);
    await user.click(入口);
    await user.click(入口);
    expect(mock读取简历PDF).toHaveBeenCalledTimes(1);
    await act(async () => {
      门.resolve({ url: 'blob:once', revoke: vi.fn(() => undefined) });
      await 门.promise;
    });
    expect(await screen.findByRole('dialog', { name: '简历原件' })).toBeTruthy();
  });

  it('读取在途卸载：迟到成功的租约立即回收，不打开弹层', async () => {
    const user = userEvent.setup();
    const 门 = 可控Promise<{ url: string; revoke: () => undefined }>();
    const 租约 = { url: 'blob:late', revoke: vi.fn(() => undefined) };
    mock读取简历PDF.mockReturnValue(门.promise);
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(true) }) });
    const 页 = 渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v1\.pdf/ }));
    页.unmount();
    await act(async () => {
      门.resolve(租约);
      await 门.promise;
    });
    expect(租约.revoke).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: '简历原件' })).toBeNull();
  });

  it('读取在途换 Case：迟到租约回收，且新 Case 的第一次点击不被旧在飞锁挡住', async () => {
    const user = userEvent.setup();
    const 旧门 = 可控Promise<{ url: string; revoke: () => undefined }>();
    const 旧租约 = { url: 'blob:old-case', revoke: vi.fn(() => undefined) };
    const 新租约 = { url: 'blob:new-case', revoke: vi.fn(() => undefined) };
    mock读取简历PDF.mockReturnValueOnce(旧门.promise).mockResolvedValue(新租约);
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(true) }) });
    const 页 = 渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v1\.pdf/ }));
    页.unmount();
    cleanup();

    置详情状态({ role: 'candidate', caseId: 'mc_other', 快照: 详情快照({ detail: S1等待详情(true) }) });
    渲染详情('candidate', 'mc_other');
    await user.click(await screen.findByRole('button', { name: /后端工程师_简历_v1\.pdf/ }));
    expect(mock读取简历PDF).toHaveBeenLastCalledWith('candidate', 'mc_other');
    const 弹层 = await screen.findByRole('dialog', { name: '简历原件' });
    expect(
      (within(弹层).getByTitle('简历 PDF') as HTMLIFrameElement).getAttribute('src'),
    ).toBe('blob:new-case');
    // 旧 Case 的迟到成功只回收，不改新 Case 的弹层
    await act(async () => {
      旧门.resolve(旧租约);
      await 旧门.promise;
    });
    expect(旧租约.revoke).toHaveBeenCalledTimes(1);
    expect(
      (within(await screen.findByRole('dialog', { name: '简历原件' }))
        .getByTitle('简历 PDF') as HTMLIFrameElement).getAttribute('src'),
    ).toBe('blob:new-case');
  });

  it('读取失败只在当前页轻提示：不跳转、不生成模拟文件；迟到失败不提示', async () => {
    const user = userEvent.setup();
    mock读取简历PDF.mockRejectedValueOnce(new Error('读取失败'));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(true) }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v1\.pdf/ }));
    await waitFor(() => expect(轻提示条数()).toBe(1));
    expect(screen.queryByRole('dialog', { name: '简历原件' })).toBeNull();
    expect(mock跳转).not.toHaveBeenCalled();

    // 卸载后到达的失败不再提示
    清空轻提示();
    const 门 = 可控Promise<{ url: string; revoke: () => undefined }>();
    mock读取简历PDF.mockReturnValue(门.promise);
    cleanup();
    置详情状态({ role: 'candidate', caseId: 'mc_late', 快照: 详情快照({ detail: S1等待详情(true) }) });
    const 页 = 渲染详情('candidate', 'mc_late');
    await user.click(await screen.findByRole('button', { name: /后端工程师_简历_v1\.pdf/ }));
    页.unmount();
    await act(async () => {
      门.reject(new Error('迟到失败'));
      await 门.promise.catch(() => undefined);
    });
    expect(轻提示条数()).toBe(0);
  });
});

// ══ Task 5 夹具：S1 三条步骤文案逐词钉死（解析中 / AI 初筛中 / 人工决定）══

describe('MatchCase详情 · S1 步骤文案三态（Task 5）', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock决定S1.mockClear();
    mock读取简历PDF.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('解析中 / AI 初筛中 / 人工决定：文案来自 17 词闭表，决策卡只随人工决定行出现', async () => {
    // 解析中（S1 waiting + awaiting_resume_parse）：段摘要与步骤说明同词，出现即算
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1解析中详情() }) });
    渲染详情('recruiter', 'mc_hr');
    expect((await screen.findAllByText('正在解析简历')).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: '通过初筛' })).toBeNull();
    expect(screen.queryByRole('button', { name: '不合适' })).toBeNull();

    // 人工决定（S1 needs_user + awaiting_recruiter_decision）：等待文案 + 招聘端唯一决策卡
    cleanup();
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1初筛详情(true) }) });
    渲染详情('recruiter', 'mc_hr');
    expect(await screen.findByText('等待招聘方决定')).toBeTruthy();
    expect(screen.getByRole('button', { name: '通过初筛' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '不合适' })).toBeTruthy();

    // AI 初筛中（S1 waiting + screening_resume + 空动作表）：新 AI 文案、零决策控件
    cleanup();
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1AI初筛详情() }) });
    渲染详情('recruiter', 'mc_hr');
    expect(await screen.findByText('招聘方 AI 正在初筛已提交简历')).toBeTruthy();
    expect(screen.queryByText('出具简历初筛结论')).toBeNull();
    expect(screen.queryByRole('button', { name: '通过初筛' })).toBeNull();
    expect(screen.queryByRole('button', { name: '不合适' })).toBeNull();
    expect(mock决定S1).not.toHaveBeenCalled();
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

// ══ Hosted Agent 失败合同：owner-safe agent_attention 只给安全说明，零重试入口 ══

/** S1 attention 合法行（open|resume_submission|attention_required|screening_resume）：
 *  行侧白名单为空（零动作卡），needsAction 可真可假 —— 徽标归属按 viewer 待办优先。 */
function 注意详情DTO(role: P5角色, needsAction: boolean): P5详情 {
  const state = 状态({
    ...(role === 'recruiter' ? { caseId: 'mc_hr' } : {}),
    stage: 'resume_submission', status: 'attention_required', step: 'screening_resume',
    needsUser: false,
    agentAttention: { code: 'agent_unavailable', retryable: false },
  });
  return role === 'candidate'
    ? 候选详情DTO({ state, needsAction, availableActions: [] })
    : 招聘详情DTO({ state, needsAction, availableActions: [] });
}

describe('MatchCase详情 · owner-safe agent_attention', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock决定S0.mockClear();
    mock决定S1.mockClear();
    mock决定S2.mockClear();
    mock决定S3.mockClear();
    mock提交简历.mockClear();
    mock跳转.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(['candidate', 'recruiter'] as const)(
    'attention 详情给安全说明，徽标按待办优先，零 Agent 重试（%s）',
    async (role) => {
      const caseId = role === 'candidate' ? 'mc_direct' : 'mc_hr';
      // needsAction=false：说明在场（状态行后）、徽标「需注意」、「代理处理中」缺席
      置详情状态({ role, caseId, 快照: 详情快照({ detail: 注意详情DTO(role, false) }) });
      渲染详情(role, caseId);
      expect(await screen.findByText('AI 服务暂时不可用，本 Case 尚未继续')).toBeTruthy();
      // 「需注意」徽标与 attention 状态文案同词（闭词表）：出现即算
      expect(screen.getAllByText('需注意').length).toBeGreaterThan(0);
      expect(screen.queryByText('代理处理中')).toBeNull();
      expect(screen.queryByText('需要你')).toBeNull();
      // attention 行不出现 retry_resume_readiness 卡/控件，也没有任何新增 Agent retry 键
      expect(screen.queryByText('重试简历校验')).toBeNull();
      expect(screen.queryByRole('button', { name: '重试校验' })).toBeNull();
      expect(screen.queryByRole('button', { name: '重试' })).toBeNull();
      expect(mock提交简历).not.toHaveBeenCalled();
      cleanup();

      // needsAction=true：徽标仍是「需要你」且说明仍在
      置详情状态({ role, caseId, 快照: 详情快照({ detail: 注意详情DTO(role, true) }) });
      渲染详情(role, caseId);
      expect(screen.getByText('需要你')).toBeTruthy();
      expect(screen.getByText('AI 服务暂时不可用，本 Case 尚未继续')).toBeTruthy();
      expect(screen.queryByText('代理处理中')).toBeNull();
      expect(screen.queryByRole('button', { name: '重试校验' })).toBeNull();
      cleanup();
    },
  );

  it('retry_resume_readiness 的既有合法 S1 case 原文案与 operation 仍在（attention 接线不触碰）', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(true) }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('重试简历校验')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重试校验' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认递交' }));
    expect(mock提交简历).toHaveBeenCalledTimes(1);
    expect(mock提交简历).toHaveBeenCalledWith('mc_direct', 绑定附件.fileId, 绑定附件.fileVersionId, true);
  });
});

// ══ Task 3 夹具：S0 screening records 完整记录（问答 + 初评/复评总结）══

/** S0 详情的招聘端别名刻意不含 candidate/recruiter 字样：禁词断言按整页 body 文本算。 */
const S0别名 = 'hr-0123456789ab';

/**
 * S0 完整记录样本：轮次 1–4，三种未回答状态齐备（同轮问答各最多一条、答必命中同轮问）。
 * question 时间故意横跨旧时间线两侧（旧 transcript 是 2026-08-29T01:10Z）——
 * 段内顺序固定，若实现按时间混排就会把 08-30 的问答插到旧时间线后面。
 */
function S0记录样本(): P5S0筛选记录 {
  return {
    messages: [
      { id: 's0q_1', kind: 'question', role: 'candidate', round: 1, text: '需要确认岗位的值班安排。', occurredAt: '2026-08-23T10:01:00Z' },
      { id: 's0a_1', kind: 'answer', role: 'recruiter', round: 1, answerStatus: 'answered', text: '没有固定晚班，周末偶尔需要支援。', occurredAt: '2026-08-23T10:05:00Z' },
      { id: 's0q_2', kind: 'question', role: 'candidate', round: 2, text: '还需要了解团队规模。', occurredAt: '2026-08-30T09:00:00Z' },
      { id: 's0a_2', kind: 'answer', role: 'recruiter', round: 2, answerStatus: 'declined', occurredAt: '2026-08-30T09:02:00Z' },
      { id: 's0q_3', kind: 'question', role: 'candidate', round: 3, text: '平时出差频率如何？', occurredAt: '2026-08-30T09:10:00Z' },
      { id: 's0a_3', kind: 'answer', role: 'recruiter', round: 3, answerStatus: 'unknown', occurredAt: '2026-08-30T09:12:00Z' },
      { id: 's0q_4', kind: 'question', role: 'candidate', round: 4, text: '带团队的人数规模？', occurredAt: '2026-08-30T09:20:00Z' },
      { id: 's0a_4', kind: 'answer', role: 'recruiter', round: 4, answerStatus: 'not_available', occurredAt: '2026-08-30T09:22:00Z' },
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
function S0完整记录详情(role: P5角色, 选项: 详情选项 = {}): P5详情 {
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

/** S0 消息时间的期望值：用 Date 本地 getter 独立推出 HH:mm（与页面 Intl formatter 各算各的）。 */
function 本地时分期望(原文: string): string {
  const 时刻 = new Date(原文);
  const 补 = (数: number) => String(数).padStart(2, '0');
  return `${补(时刻.getHours())}:${补(时刻.getMinutes())}`;
}

/** 双端路由树（可复用元素引用：轮询式 rerender 用同一棵树喂新快照）。 */
function S0详情树(role: P5角色, caseId: string) {
  const 地址 = role === 'candidate' ? `/deal/${caseId}` : `/hr/candidate/${caseId}`;
  const 模板 = role === 'candidate' ? '/deal/:id' : '/hr/candidate/:id';
  return (
    <MemoryRouter initialEntries={[地址]}>
      <Routes>
        {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
        <Route path={模板} element={<MatchCase详情 role={role} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('MatchCase详情 · S0 screening records 呈现（Task 3）', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock回答事实.mockClear();
    mock决定S0.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** 气泡行：正文 span → 气泡 div → 行 div；我方行里有代理标 svg，对方行没有（既有 DOM 结构）。 */
  function 气泡行(文本: string): HTMLElement {
    const 气泡 = screen.getByText(文本).closest('div');
    if (气泡 === null) throw new Error(`找不到气泡：${文本}`);
    return 气泡.parentElement as HTMLElement;
  }
  const 是我方行 = (行: HTMLElement) => 行.querySelector('svg') !== null;

  it.each(['candidate', 'recruiter'] as const)(
    '同一批 S0 问答按 viewer 分方位；只出现正文/状态与时间，无技术字段（%s）',
    (role) => {
      const caseId = role === 'candidate' ? 'mc_direct' : 'mc_hr';
      置详情状态({ role, caseId, 快照: 详情快照({ detail: S0完整记录详情(role) }) });
      渲染详情(role, caseId);
      // question 是候选方、answer 是招聘方：candidate 下 question 我方；recruiter 下左右相反
      expect(是我方行(气泡行('需要确认岗位的值班安排。'))).toBe(role === 'candidate');
      expect(是我方行(气泡行('没有固定晚班，周末偶尔需要支援。'))).toBe(role === 'recruiter');
      // 只出现正文/状态/时间：kind、role、round、ID 与技术标题一概不进 DOM
      const 文本 = document.body.textContent ?? '';
      ['question', 'answer', 'candidate', 'recruiter', 'round 1', 's0q_1', 'Agent问答'].forEach(
        (词) => expect(文本).not.toContain(词),
      );
    },
  );

  it('candidate：初评与全部复评都进托盘且无总结时间；recruiter：无总结正文也无空托盘', () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0完整记录详情('candidate') }) });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText('初评：初评已确认岗位在浦东园区，值班安排仍待确认。')).toBeTruthy();
    // 逐轮复评全部出现，标签只由 phase/round 给定
    expect(screen.getByText('第 1 轮复评：已确认没有固定晚班，团队规模仍待确认。')).toBeTruthy();
    expect(screen.getByText('第 2 轮复评：团队规模初步确认为 6 人。')).toBeTruthy();
    // 总结不显示时间：屏上没有任何 RFC3339 原文
    expect(document.body.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}T/);

    cleanup();
    置详情状态({
      role: 'recruiter', caseId: 'mc_hr',
      快照: 详情快照({ detail: S0完整记录详情('recruiter') }),
    });
    渲染详情('recruiter', 'mc_hr');
    // 招聘方没有总结区域，也没有空托盘或失败占位：托盘只有阶段区自己的旧小结
    expect(screen.queryByText(/初评：/)).toBeNull();
    expect(screen.queryByText(/第 \d+ 轮复评/)).toBeNull();
    expect(screen.getAllByText('代 理 小 结').length).toBe(1);
    const 托盘 = screen.getByText('代 理 小 结').parentElement as HTMLElement;
    expect(托盘.textContent).not.toContain('值班安排仍待确认');
  });

  it('三种未回答只显示固定文案：无伪造正文，也没有新增输入框', () => {
    const 记录 = S0记录样本();
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          state: 状态({
            status: 'running', step: 'policy_check', needsUser: false, round: 0, roundBudget: 5,
          }),
          needsAction: false,
          availableActions: [],
          stages: 阶段区组({
            anonymous_screening: { screeningRecords: { messages: 记录.messages.filter((条) => 条.round >= 2), summaries: [] } },
          }),
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    // 三条未回答的气泡正文就是固定文案本身（getByText 精确匹配：拼了别的字就找不到）
    expect(screen.getByText('已拒绝回答')).toBeTruthy();
    expect(screen.getByText('暂无法确认')).toBeTruthy();
    expect(screen.getByText('暂无可用信息')).toBeTruthy();
    // 段内气泡 9 个不多不少：轮 2–4 的 6 条 S0 问答 + 旧 transcript 1 条 + 旧叮嘱回执 2 条
    const 列 = 气泡行('还需要了解团队规模。').parentElement as HTMLElement;
    expect(列.childElementCount).toBe(9);
    // 没有新增输入框：只剩底部 Case 叮嘱一条
    expect(screen.getAllByRole('textbox').length).toBe(1);
  });

  it('S0 记录固定在旧 transcript 与叮嘱回执之前：不按时间混排', () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0完整记录详情('candidate') }) });
    渲染详情('candidate', 'mc_direct');
    const 序 = [
      '需要确认岗位的值班安排。', // s0q_1（2026-08-23，早于旧时间线）
      '没有固定晚班，周末偶尔需要支援。',
      '带团队的人数规模？', // s0q_4（2026-08-30，晚于旧时间线）
      '暂无可用信息', // s0a_4
      '每周可以到岗几天？', // 旧 transcript
      '工作日 10:00-19:00 联系', // 旧叮嘱回执
      '流程预计两周内走完',
    ].map((文本) => screen.getByText(文本));
    for (let 下标 = 0; 下标 < 序.length - 1; 下标 += 1) {
      const 前 = 序[下标] as Element;
      const 后 = 序[下标 + 1] as Element;
      expect(前.compareDocumentPosition(后) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('question-only、空 messages、轮次空档都合法；轮询式重读同批记录不重复', () => {
    const 记录 = S0记录样本();
    // 仅问（question-only）
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          stages: 阶段区组({
            anonymous_screening: { screeningRecords: { messages: [记录.messages[0]!], summaries: [] } },
          }),
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getAllByText('需要确认岗位的值班安排。').length).toBe(1);
    expect(screen.queryByText(/初评：/)).toBeNull();

    // 空 messages + 仅 initial 总结：零问答气泡，托盘只有总结
    cleanup();
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          stages: 阶段区组({
            anonymous_screening: {
              screeningRecords: {
                messages: [],
                summaries: [{ id: 's0sum_1', phase: 'initial', summary: '初评确认岗位在浦东园区。', occurredAt: '2026-08-23T10:06:00Z' }],
              },
            },
          }),
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(screen.queryByText('需要确认岗位的值班安排。')).toBeNull();
    expect(screen.getByText('初评：初评确认岗位在浦东园区。')).toBeTruthy();

    // 轮次空档（round 1 → 3）：原样渲染，不补位不重排
    cleanup();
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          stages: 阶段区组({
            anonymous_screening: {
              screeningRecords: { messages: [记录.messages[0]!, 记录.messages[4]!], summaries: [] },
            },
          }),
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getAllByText('需要确认岗位的值班安排。').length).toBe(1);
    expect(screen.getAllByText('平时出差频率如何？').length).toBe(1);

    // 轮询式重读：同批记录以新快照整包再来一遍，气泡与总结都不重复
    cleanup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0完整记录详情('candidate') }) });
    const 树 = S0详情树('candidate', 'mc_direct');
    const 页 = render(树);
    expect(screen.getAllByText('需要确认岗位的值班安排。').length).toBe(1);
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0完整记录详情('candidate') }) });
    页.rerender(树);
    expect(screen.getAllByText('需要确认岗位的值班安排。').length).toBe(1);
    expect(screen.getAllByText('初评：初评已确认岗位在浦东园区，值班安排仍待确认。').length).toBe(1);
  });

  it('旧摘要/清单/附件/叮嘱与 respond_fact、结束卡仍在：fact response 仍提交 transcript ref prompt_1', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0完整记录详情('candidate') }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('系统正在复评候选信息')).toBeTruthy(); // 旧步骤摘要头行
    expect(screen.getByText('匿名初筛已通过')).toBeTruthy(); // 清单
    expect(screen.getByText('简历已绑定')).toBeTruthy();
    expect(screen.getByText('工作日 10:00-19:00 联系')).toBeTruthy(); // 叮嘱回执
    expect(screen.getByRole('button', { name: /后端工程师_简历_v1\.pdf/ })).toBeTruthy(); // 附件入口
    expect(screen.getByText('补充事实')).toBeTruthy(); // respond_fact 卡
    expect(screen.getByRole('button', { name: '结束初筛' })).toBeTruthy(); // 终结卡仍在
    await user.type(screen.getByRole('textbox', { name: '回答问题' }), '每周可以到岗 3 天');
    await user.click(screen.getByRole('button', { name: '提交回答' }));
    // mutation 坐标仍是 transcript ref：screening record ID 永不作坐标
    expect(mock回答事实).toHaveBeenCalledTimes(1);
    expect(mock回答事实).toHaveBeenCalledWith('candidate', 'mc_direct', 'prompt_1', '每周可以到岗 3 天');
  });

  it('S0 新消息走本地 HH:mm 且不读 Date.now()；旧时间线仍是既有 UTC 字符串切片', () => {
    vi.useFakeTimers();
    // 期望值独立用本地 getter 推出：UTC 进程 = 10:01，Asia/Shanghai 进程 = 18:01
    const 期望 = 本地时分期望('2026-08-23T10:01:00Z');
    const 错位 = 期望 === '10:01' ? '18:01' : '10:01';

    vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0完整记录详情('candidate') }) });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText(期望)).toBeTruthy();
    expect(screen.queryByText(错位)).toBeNull(); // 显示跟进程时区走，不写死
    // 旧 transcript／叮嘱回执保持既有字符串切片结果（本任务不统一时间线）
    expect(screen.getByText('01:10')).toBeTruthy();
    expect(screen.getByText('01:05')).toBeTruthy();
    expect(screen.getByText('01:06')).toBeTruthy();

    // 换一个 fake 当前时间：显示不变（不读 Date.now()）
    cleanup();
    vi.setSystemTime(new Date('2030-06-01T18:30:00Z'));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0完整记录详情('candidate') }) });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText(期望)).toBeTruthy();
    expect(screen.getByText('01:10')).toBeTruthy();
  });
});

// ── 详情统一 Task 9：控制收口后的路由级行为（契约 C 生命周期）──
// 读取控制迁 use后端详情控制、正常区迁 keyed 后端正常详情 后的边界钉子：
// Tab 不改变发送 Case；换单/账号变更销毁弹层与原草稿；正常/失败交替不违反 hooks 顺序。
describe('MatchCase详情 · 控制收口（Task 9）', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock新增叮嘱.mockReset();
    mock新增叮嘱.mockImplementation(async () => undefined);
    mock读取简历PDF.mockReset();
    mock读取简历PDF.mockResolvedValue({ url: 'blob:p5-resume', revoke: () => undefined });
    mock跳转.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Tab 不改变发送 Case：切资料再切回，叮嘱草稿保留、发送仍带当前 case_id', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    const 框 = screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement;
    await user.type(框, '周五也可以到岗');
    await user.click(screen.getByRole('button', { name: '职位详情' }));
    await user.click(screen.getByRole('button', { name: '代谈进度' }));
    // 底栏草稿归父控制（切 Tab 不卸载、不换单）：回来原样，发送坐标仍是本单
    expect((screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement).value).toBe('周五也可以到岗');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(mock新增叮嘱).toHaveBeenCalledTimes(1);
    expect(mock新增叮嘱).toHaveBeenCalledWith('candidate', 'mc_direct', '周五也可以到岗');
  });

  it('换单重置父层叮嘱草稿：A 的草稿不带进 B，B 发送只带 B 的 case_id（review-r1 F4）', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'candidate', caseId: 'mc_a',
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_a' }) }) }),
    });
    render(
      <MemoryRouter initialEntries={['/deal/mc_a']}>
        <测试换Case钮 目标="/deal/mc_b" 文案="切到新单" />
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>,
    );
    const 框A = screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement;
    await user.type(框A, 'A 单的叮嘱草稿');

    // 同一 Route 内换单：父控制 hook 不卸载，叮嘱草稿仍必须随 scope 清空
    置详情状态({
      role: 'candidate', caseId: 'mc_b',
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_b' }) }) }),
    });
    await user.click(screen.getByRole('button', { name: '切到新单' }));
    const 框B = screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement;
    expect(框B.value).toBe(''); // 不沿用上一单的内容（spec §3.1）
    await user.type(框B, 'B 单的叮嘱草稿');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(mock新增叮嘱).toHaveBeenCalledTimes(1);
    expect(mock新增叮嘱).toHaveBeenCalledWith('candidate', 'mc_b', 'B 单的叮嘱草稿'); // 零误发
  });

  it('换单销毁弹层与原草稿：开着的 PDF 弹层关闭并回收租约，回答草稿清空', async () => {
    const user = userEvent.setup();
    const 租约 = { url: 'blob:p5-resume', revoke: vi.fn() };
    mock读取简历PDF.mockResolvedValue(租约);
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0完整记录详情('candidate') }) });
    const 页 = render(
      <MemoryRouter initialEntries={['/deal/mc_direct']}>
        <测试换Case钮 目标="/deal/mc_other" 文案="切到新单" />
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>,
    );
    // 同一单里既有待答问题又有 typed 附件：草稿与弹层同时在场
    const 回答框 = (await screen.findByRole('textbox', { name: '回答问题' })) as HTMLTextAreaElement;
    await user.type(回答框, '每周可以到岗 3 天');
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v1\.pdf/ }));
    await screen.findByRole('dialog', { name: '简历原件' });

    // 换单：正常控制子组件按 key 重挂载 —— 弹层销毁（租约回收）、草稿清空
    const 新单 = S0完整记录详情('candidate');
    置详情状态({
      role: 'candidate', caseId: 'mc_other',
      快照: 详情快照({ detail: { ...新单, state: { ...新单.state!, caseId: 'mc_other' } } }),
    });
    await user.click(screen.getByRole('button', { name: '切到新单' }));
    await waitFor(() => expect(租约.revoke).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog', { name: '简历原件' })).toBeNull();
    expect((screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement).value).toBe('');
    页.unmount();
  });

  it('账号变更销毁弹层与原草稿（key 带 主体/角色/单，不能只用 caseId 作账号边界）', async () => {
    const user = userEvent.setup();
    const 租约 = { url: 'blob:p5-resume', revoke: vi.fn() };
    mock读取简历PDF.mockResolvedValue(租约);
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0完整记录详情('candidate') }) });
    // rerender 需要新元素实例（同一元素引用会让 React 直接跳过重渲染）
    const 树 = () => (
      <MemoryRouter initialEntries={['/deal/mc_direct']}>
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>
    );
    const 页 = render(树());
    const 回答框 = (await screen.findByRole('textbox', { name: '回答问题' })) as HTMLTextAreaElement;
    await user.type(回答框, '每周可以到岗 3 天');
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v1\.pdf/ }));
    await screen.findByRole('dialog', { name: '简历原件' });

    // 同一 URL 同一单，主体换代（切换账号）：正常区整建重置
    mock应用状态 = {
      ...mock应用状态,
      后端状态: {
        ...mock应用状态.后端状态,
        主体: { ...mock应用状态.后端状态.主体, subject_id: 'sub_2' },
      },
    };
    页.rerender(树());
    await waitFor(() => expect(租约.revoke).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog', { name: '简历原件' })).toBeNull();
    expect((screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement).value).toBe('');
    页.unmount();
  });

  // ── 回答在飞锁表按主体换代（review-r2 F-r2-1）：父 hook 常驻路由实例、不随主体重挂载，
  //    锁表必须随账号整表替换 —— 新主体不继承旧账号的在飞锁；旧单迟到的收口只作用于
  //    发回答闭包捕获的旧表，删不到新表里的在飞项，也不在换代后弹旧单的提示。──
  it('同路由换账号：B 不继承 A 的回答在飞锁；A 迟到落定不清 B 草稿、不放 B 锁、不提示', async () => {
    const user = userEvent.setup();
    const 门A = 可控Promise<void>();
    const 门B = 可控Promise<void>();
    mock回答事实.mockReturnValueOnce(门A.promise).mockReturnValueOnce(门B.promise);
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0完整记录详情('candidate') }) });
    // rerender 需要新元素实例（同一元素引用会让 React 直接跳过重渲染）
    const 树 = () => (
      <MemoryRouter initialEntries={['/deal/mc_direct']}>
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>
    );
    const 页 = render(树());
    const 框A = (await screen.findByRole('textbox', { name: '回答问题' })) as HTMLTextAreaElement;
    await user.type(框A, 'A 的回答');
    await user.click(screen.getByRole('button', { name: '提交回答' }));
    expect(mock回答事实).toHaveBeenCalledTimes(1);
    expect(mock回答事实).toHaveBeenCalledWith('candidate', 'mc_direct', 'prompt_1', 'A 的回答');
    expect((screen.getByRole('button', { name: '提交中…' }) as HTMLButtonElement).disabled).toBe(true);
    清空轻提示();

    // 同一 URL 同一单，主体换代（切换账号）：正常区按 key 整建重置，父 hook 不重挂载
    mock应用状态 = {
      ...mock应用状态,
      后端状态: {
        ...mock应用状态.后端状态,
        主体: { ...mock应用状态.后端状态.主体, subject_id: 'sub_2' },
      },
    };
    页.rerender(树());

    // B 初始不继承 A 的在飞锁：回答区干净可输入、可发起自己的请求
    const 框B = (await screen.findByRole('textbox', { name: '回答问题' })) as HTMLTextAreaElement;
    expect(框B.value).toBe('');
    expect(框B.disabled).toBe(false);
    expect((screen.getByRole('button', { name: '提交回答' }) as HTMLButtonElement).disabled).toBe(false);
    await user.type(框B, 'B 的回答');
    await user.click(screen.getByRole('button', { name: '提交回答' }));
    expect(mock回答事实).toHaveBeenCalledTimes(2);
    expect(mock回答事实).toHaveBeenLastCalledWith('candidate', 'mc_direct', 'prompt_1', 'B 的回答');

    // A 此刻才失败落定：迟到的收口只作用于被捕获的旧表 —— B 草稿不动、锁不放、旧单失败不提示
    await act(async () => {
      门A.reject(new Error('A 单迟到的失败'));
    });
    expect(轻提示条数()).toBe(0);
    expect((screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement).value).toBe('B 的回答');
    expect((screen.getByRole('button', { name: '提交中…' }) as HTMLButtonElement).disabled).toBe(true); // B 仍在飞

    // B 自己落定：草稿清空、锁释放（A 的迟到收口没有污染 B 的承诺链）
    await act(async () => {
      门B.resolve();
    });
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '提交回答' }) as HTMLButtonElement).disabled).toBe(false));
    expect((screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement).value).toBe('');
    页.unmount();
  });

  it('正常→失败→正常交替不违反 hooks 顺序：错误页与正常页各自完整，恢复即整页回来', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    // rerender 需要新元素实例（同一元素引用会让 React 直接跳过重渲染）
    const 树 = () => (
      <MemoryRouter initialEntries={['/deal/mc_direct']}>
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>
    );
    const 页 = render(树());
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy();

    // 首载失败（detail 变 null）：整页走失败态，不把错误当缺失塞进正常区
    置详情状态({
      role: 'candidate',
      快照: 详情快照({ 阶段: '失败', detail: null, error: '服务暂时不可用，请稍后再试' }),
    });
    页.rerender(树());
    expect(screen.getByText('这一单暂时打不开')).toBeTruthy();
    expect(screen.queryByText('平台工程师')).toBeNull();

    // 恢复正常：hooks 顺序不变，正常区整页回来
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    页.rerender(树());
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy();
    expect(screen.getByRole('button', { name: '职位详情' })).toBeTruthy();
    页.unmount();
  });
});
