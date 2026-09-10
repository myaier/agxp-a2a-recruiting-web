// use后端详情控制 · 控制测试（契约 C，Task 9）：详情路由的读取/轮询/叮嘱/映射与稳定
// 回答在飞表自 屏幕/P5/MatchCase详情 的路由实例原样搬入。覆盖：
//   · scope 登记/退出：进屏先 设置P5范围(detail) 再强制读（invocationCallOrder），
//     卸载清回 null；
//   · 返回联合：加载（无快照）/ 失败（detail null + error）/ 契约错误 各给
//     {kind:'不可用', 状态, 说明, 重试}，重试走 读取详情(role, caseId, true)；
//   · 正常分支交付 后端正常资源（契约 C 字段齐全），不把错误变成正常缺失；
//   · 叮嘱：真实 POST（无乐观清空），失败保留草稿且只提示一次，成功才清空，
//     空输入零请求，在飞锁（连点单发）在控制层不在 DOM；
//   · 终局：底栏只读（「当前在谈已结束，仅可查看」、无发送回调）+ 停 3 秒节拍；
//     completed+pending 底栏同样只读、私聊键禁用但节拍继续；ready 只用合法
//     conversation_ref 导航且节拍停；
//   · 回答在飞表：父 hook 唯一持有，正常→失败→正常不重建（表身份稳定）。
// 夹具走真实 映射P5详情 / decoder 已接受的 DTO 形状（不给 P5 加字段造样本）。
// 仓库未装 @testing-library/jest-dom，断言用调用计数与 toBe。

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { use后端详情控制 } from './use后端详情控制';
import type { 后端正常资源, 后端详情控制结果 } from './use后端详情控制';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { 映射P5详情, P5契约错误提示 } from '../../数据/MatchCase展示映射';
import { 路径 } from '../../路由/路径表';
import type { P5详情快照 } from '../../状态/后端/类型';
import type { P5列表项, P5详情, P5阶段区 } from '../../数据/招聘数据源/MatchCase';
import type { P5角色 } from '../../数据/MatchCase展示映射';
import type { BFF主体 } from '../../数据/BFF契约';

const mock跳转 = vi.fn();
vi.mock('../../路由/导航钩子', () => ({
  use导航: () => ({ 返回: vi.fn(), 跳转: mock跳转 }),
}));

const mock设置P5范围 = vi.fn();
const mock读取详情 = vi.fn(async () => undefined);
const mock新增叮嘱 = vi.fn(async (): Promise<void> => undefined);
const mock回答事实 = vi.fn(async (): Promise<void> => undefined);
const mock决定S0 = vi.fn(async (): Promise<void> => undefined);
const mock决定S1 = vi.fn(async (): Promise<void> => undefined);
const mock决定S2 = vi.fn(async (): Promise<void> => undefined);
const mock决定S3 = vi.fn(async (): Promise<void> => undefined);
const mock提交简历 = vi.fn(async (): Promise<void> => undefined);
const mock读取简历PDF = vi.fn(async () => ({ url: 'blob:p5', revoke: () => undefined }));
const mock准备候选委托简历 = vi.fn(async (): Promise<null> => null);
// 生产 Provider 的 操作 引用稳定（useMemo），桩宿主同样给恒定表
const mock操作 = {
  设置P5范围: mock设置P5范围,
  读取详情: mock读取详情,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

// ── 夹具：快照里存 decoder 已接受的归一化 DTO（与 MatchCase详情.test 同形）──

const 意向ID = 'int_0123456789abcdef0123456789abcdef';
const 冻结职位 = {
  jobId: 'job_0123456789abcdef0123456789abcdef',
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

function 阶段区组(): P5阶段区[] {
  const S0: P5阶段区 = {
    stage: 'anonymous_screening', state: 'active', occurredAt: '2026-08-29T01:10:00Z',
    summary: 'candidate_reevaluation',
    checklist: [{ label: 'anonymous_screening_passed', done: true }],
    transcript: [
      {
        eventId: 'evt_q1', stage: 'anonymous_screening', kind: 'supplementary_question',
        role: 'candidate', ref: 'prompt_1', text: '每周可以到岗几天？',
        occurredAt: '2026-08-29T01:10:00Z',
      },
    ],
    instructionReceipts: [],
    attachment: null,
    screeningRecords: { messages: [], summaries: [] },
  };
  const 待 = (stage: 'resume_submission' | 'needs_coordination' | 'intent_confirmation'): P5阶段区 => ({
    stage, state: 'pending', occurredAt: null, summary: '', checklist: [], transcript: [],
    instructionReceipts: [], attachment: null, screeningRecords: null,
  });
  return [S0, 待('resume_submission'), 待('needs_coordination'), 待('intent_confirmation')];
}

function 候选详情DTO(覆盖: { state?: P5列表项['state']; availableActions?: P5详情['availableActions'] } = {}): P5详情 {
  return {
    role: 'candidate',
    context: { intentionId: 意向ID, job: 冻结职位 },
    state: 覆盖.state ?? 状态(),
    needsAction: true,
    availableActions: 覆盖.availableActions ?? ['respond_fact', 'end_screening'],
    stages: 阶段区组(),
    currentCoordination: null,
    intentConfirmations: { candidate: '', recruiter: '' },
    terminalSummary: null,
    conversationRef: null,
  };
}

/** ended 终局（S0 ended、终局摘要齐备、零动作）。 */
function 已终止详情DTO(): P5详情 {
  return 候选详情DTO({
    state: 状态({
      lifecycle: 'ended', status: 'ended', step: 'complete', needsUser: false,
      outcome: 'user_ended', outcomeCode: 'user_ended', finalizedAt: '2026-08-29T03:00:00Z',
    }),
    availableActions: [],
  });
}

function 终局阶段区组(): P5阶段区[] {
  return [
    { ...阶段区组()[0]!, state: 'ended', summary: 'complete' },
    ...阶段区组().slice(1),
  ];
}

function 已终止带摘要DTO(): P5详情 {
  const 底 = 已终止详情DTO();
  return {
    ...底,
    stages: 终局阶段区组(),
    terminalSummary: {
      stage: 'anonymous_screening', outcome: 'user_ended', reasonSummary: 'user_ended',
      finalizedAt: '2026-08-29T03:00:00Z',
    },
  };
}

/** completed + handoff_pending：双方已确认、会话在创建（节拍继续）。 */
function 待移交DTO(): P5详情 {
  return 候选详情DTO({
    state: 状态({
      lifecycle: 'completed', stage: 'intent_confirmation', status: 'passed', step: 'handoff_pending',
      needsUser: false, finalizedAt: '2026-08-29T04:00:00Z',
    }),
    availableActions: [],
  });
}

/** completed + complete + conversation_ref：会话已发布（节拍停、可进私聊）。 */
function 已移交DTO(conversationRef = '3003'): P5详情 {
  return { ...待移交DTO(), state: { ...待移交DTO().state!, step: 'complete' }, conversationRef };
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

function 置详情状态(选项: {
  role?: P5角色;
  caseId?: string;
  快照?: P5详情快照;
  不预置快照?: boolean;
  登录角色?: BFF主体['last_used_role'];
  已登录?: boolean;
} = {}) {
  const role = 选项.role ?? 'candidate';
  const caseId = 选项.caseId ?? 'mc_direct';
  mock应用状态 = {
    数据源模式: 'backend',
    派发: vi.fn(),
    状态: {},
    后端状态: {
      已登录: 选项.已登录 ?? true,
      主体: {
        subject_id: 'sub_1',
        roles: [{ role, status: 'active' }],
        last_used_role: 选项.登录角色 === undefined ? role : 选项.登录角色,
      },
      P5详情: 选项.不预置快照 === true ? {} : {
        [P5范围键.detail(role, caseId)]: 选项.快照 ?? 详情快照(),
      },
    },
    操作: mock操作,
  };
  return caseId;
}

/** 取正常资源（非正常联合直接抛错，测试夹具问题不冒充行为）。 */
function 取正常(结果: 后端详情控制结果): 后端正常资源 {
  if (结果.kind !== '正常') throw new Error(`期望正常联合，得到 ${结果.kind}/${结果.状态}`);
  return 结果;
}

beforeEach(() => {
  mock设置P5范围.mockClear();
  mock读取详情.mockClear();
  mock新增叮嘱.mockReset();
  mock新增叮嘱.mockImplementation(async () => undefined);
  mock跳转.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('use后端详情控制 · scope 与读取', () => {
  it('进屏先登记 detail scope 再强制读；卸载清回 null', async () => {
    置详情状态({ 快照: 详情快照({ detail: 候选详情DTO() }) });
    const 视 = renderHook(() => use后端详情控制({ role: 'candidate', caseId: 'mc_direct' }));
    expect(mock设置P5范围).toHaveBeenCalledWith('candidate', P5范围键.detail('candidate', 'mc_direct'));
    expect(mock读取详情).toHaveBeenCalledWith('candidate', 'mc_direct', true);
    expect(mock设置P5范围.mock.invocationCallOrder[0]).toBeLessThan(
      mock读取详情.mock.invocationCallOrder[0]);
    视.unmount();
    expect(mock设置P5范围).toHaveBeenLastCalledWith('candidate', null);
  });

  it('换单：换 scope 键重登记 + 强制读新单', () => {
    置详情状态({ caseId: 'mc_a', 快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_a' }) }) }) });
    const 视 = renderHook(({ caseId }) => use后端详情控制({ role: 'candidate', caseId }), {
      initialProps: { caseId: 'mc_a' },
    });
    expect(mock读取详情).toHaveBeenLastCalledWith('candidate', 'mc_a', true);
    置详情状态({ caseId: 'mc_b', 快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_b' }) }) }) });
    视.rerender({ caseId: 'mc_b' });
    expect(mock设置P5范围).toHaveBeenLastCalledWith('candidate', P5范围键.detail('candidate', 'mc_b'));
    expect(mock读取详情).toHaveBeenLastCalledWith('candidate', 'mc_b', true);
    视.unmount();
    expect(mock设置P5范围).toHaveBeenLastCalledWith('candidate', null);
  });
});

describe('use后端详情控制 · 不可用联合', () => {
  it('无快照 → 加载：说明在读文案，重试 null（没有可重试的失败）', () => {
    置详情状态({ 不预置快照: true });
    const { result } = renderHook(() => use后端详情控制({ role: 'candidate', caseId: 'mc_direct' }));
    expect(result.current).toEqual({
      kind: '不可用', 状态: '加载', 说明: '正在读入这一单…', 重试: null,
    });
  });

  it('首载失败 → 失败：error 原样给说明，重试走 force 重读', () => {
    置详情状态({
      快照: 详情快照({ 阶段: '失败', detail: null, error: '服务暂时不可用，请稍后再试' }),
    });
    const { result } = renderHook(() => use后端详情控制({ role: 'candidate', caseId: 'mc_direct' }));
    expect(result.current.kind).toBe('不可用');
    if (result.current.kind !== '不可用') throw new Error('unreachable');
    expect(result.current.状态).toBe('失败');
    expect(result.current.说明).toBe('服务暂时不可用，请稍后再试');
    expect(result.current.重试).toBeTypeOf('function');
    act(() => result.current.重试!());
    expect(mock读取详情).toHaveBeenLastCalledWith('candidate', 'mc_direct', true);
  });

  it('契约错误 → 只给固定提示与重试，不出正常资源（不把错误变缺失）', () => {
    置详情状态({
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ step: 'handoff_pending' }) }) }),
    });
    const { result } = renderHook(() => use后端详情控制({ role: 'candidate', caseId: 'mc_direct' }));
    expect(result.current.kind).toBe('不可用');
    if (result.current.kind !== '不可用') throw new Error('unreachable');
    expect(result.current.状态).toBe('契约错误');
    expect(result.current.说明).toBe(P5契约错误提示);
    act(() => result.current.重试!());
    expect(mock读取详情).toHaveBeenLastCalledWith('candidate', 'mc_direct', true);
  });
});

describe('use后端详情控制 · 正常资源与映射', () => {
  it('正常分支交付契约 C 全字段；typed 段不进展示（动作/PDF 只给输入）', () => {
    置详情状态({ 快照: 详情快照({ detail: 候选详情DTO() }) });
    const { result } = renderHook(() => use后端详情控制({ role: 'candidate', caseId: 'mc_direct' }));
    const 资源 = 取正常(result.current);
    expect(资源.顶栏.标题).toBe('平台工程师 · 公司信息缺失'); // 公司槽原位保留（review-r1 F3）
    expect(资源.状态.徽标).toBe('需要你');
    expect(资源.分段们.length).toBe(4); // S0–S3 一段不缺
    expect(资源.职位资料.摘要?.职位).toBe('平台工程师');
    expect(资源.职位资料.接口缺口说明).toBe('当前在谈详情数据未提供');
    expect(资源.刷新错误).toBeNull();
    expect(资源.重试).toBeTypeOf('function');
    expect(资源.当前段引用).toBeTypeOf('object');
    // 动作/PDF 输入与视图同源（真实 映射P5详情，不造第二份视图）
    expect(资源.动作输入.role).toBe('candidate');
    expect(资源.动作输入.caseId).toBe('mc_direct');
    expect(资源.动作输入.视图).toEqual(映射P5详情(候选详情DTO()));
    expect(资源.动作输入.回答在飞表).toBeTypeOf('object');
    expect(资源.PDF输入).toEqual({
      role: 'candidate', caseId: 'mc_direct', 读取: mock读取简历PDF,
    });
    // 底栏是可输入（进行中单）
    expect(资源.底栏.kind).toBe('输入');
  });

  it('刷新失败（有旧详情）：错误与重试进资源，正常字段不从旧值降级', () => {
    置详情状态({
      快照: 详情快照({ detail: 候选详情DTO(), error: '服务暂时不可用，请稍后再试' }),
    });
    const { result } = renderHook(() => use后端详情控制({ role: 'candidate', caseId: 'mc_direct' }));
    const 资源 = 取正常(result.current);
    expect(资源.刷新错误).toBe('服务暂时不可用，请稍后再试');
    expect(资源.顶栏.标题).toBe('平台工程师 · 公司信息缺失'); // 公司槽原位保留（review-r1 F3） // 旧详情原样保留
    act(() => 资源.重试());
    expect(mock读取详情).toHaveBeenLastCalledWith('candidate', 'mc_direct', true);
  });

  it('回答在飞表父级唯一持有：正常→失败→正常不重建（表身份稳定）', () => {
    置详情状态({ 快照: 详情快照({ detail: 候选详情DTO() }) });
    const 视 = renderHook(() => use后端详情控制({ role: 'candidate', caseId: 'mc_direct' }));
    const 首表 = 取正常(视.result.current).动作输入.回答在飞表;
    // 同一渲染内两次取值同一张表
    expect(取正常(视.result.current).动作输入.回答在飞表).toBe(首表);
    // 刷新失败（detail 变 null）→ 不可用；恢复正常 → 表仍是原来那张
    置详情状态({
      快照: 详情快照({ 阶段: '失败', detail: null, error: '服务暂时不可用，请稍后再试' }),
    });
    视.rerender();
    expect(视.result.current.kind).toBe('不可用');
    置详情状态({ 快照: 详情快照({ detail: 候选详情DTO() }) });
    视.rerender();
    expect(取正常(视.result.current).动作输入.回答在飞表).toBe(首表);
    视.unmount();
  });
});

describe('use后端详情控制 · Case 叮嘱', () => {
  it('进行中单：底栏输入态；发送走真实 POST（role/caseId/trim 后原文），成功才清空', async () => {
    置详情状态({ 快照: 详情快照({ detail: 候选详情DTO() }) });
    const { result } = renderHook(() => use后端详情控制({ role: 'candidate', caseId: 'mc_direct' }));
    const 底栏 = 取正常(result.current).底栏;
    if (底栏.kind !== '输入') throw new Error('进行中单底栏应是输入态');
    act(() => 底栏.改变('  周五也可以到岗  '));
    const 有稿 = 取正常(result.current).底栏;
    if (有稿.kind !== '输入') throw new Error('unreachable');
    expect(有稿.值).toBe('  周五也可以到岗  '); // 草稿原样（trim 只在发送时）
    act(() => 有稿.发送!());
    expect(mock新增叮嘱).toHaveBeenCalledTimes(1);
    expect(mock新增叮嘱).toHaveBeenCalledWith('candidate', 'mc_direct', '周五也可以到岗');
    await waitFor(() => {
      const 再次 = 取正常(result.current).底栏;
      if (再次.kind !== '输入') throw new Error('unreachable');
      expect(再次.值).toBe(''); // 仅成功清空（无乐观清空）
    });
  });

  it('失败不伪造回执：草稿保留、不清空、不本地派发', async () => {
    mock新增叮嘱.mockImplementation(async () => {
      throw new Error('网络错误');
    });
    置详情状态({ 快照: 详情快照({ detail: 候选详情DTO() }) });
    const { result } = renderHook(() => use后端详情控制({ role: 'candidate', caseId: 'mc_direct' }));
    const 底栏 = 取正常(result.current).底栏;
    if (底栏.kind !== '输入') throw new Error('unreachable');
    act(() => 底栏.改变('周五也可以到岗'));
    const 有稿 = 取正常(result.current).底栏; // 改变后重取（草稿在 hook state 里）
    if (有稿.kind !== '输入') throw new Error('unreachable');
    act(() => 有稿.发送!());
    await waitFor(() => expect(mock新增叮嘱).toHaveBeenCalledTimes(1));
    const 失败后 = 取正常(result.current).底栏;
    if (失败后.kind !== '输入') throw new Error('unreachable');
    expect(失败后.值).toBe('周五也可以到岗'); // 失败绝不清空
    expect(mock应用状态.派发).not.toHaveBeenCalled(); // 也不落本地规则/气泡
  });

  it('空输入零请求；在飞期间重复发送单发（锁在控制层）', async () => {
    let 送达!: () => void;
    mock新增叮嘱.mockImplementation(() => new Promise<void>((解决) => { 送达 = 解决; }));
    置详情状态({ 快照: 详情快照({ detail: 候选详情DTO() }) });
    const { result } = renderHook(() => use后端详情控制({ role: 'candidate', caseId: 'mc_direct' }));
    const 空底栏 = 取正常(result.current).底栏;
    if (空底栏.kind !== '输入') throw new Error('unreachable');
    act(() => 空底栏.发送!());
    expect(mock新增叮嘱).not.toHaveBeenCalled(); // 空输入（草稿空串）
    act(() => 空底栏.改变('周五也可以到岗'));
    const 有稿 = 取正常(result.current).底栏;
    if (有稿.kind !== '输入') throw new Error('unreachable');
    act(() => 有稿.发送!());
    act(() => 有稿.发送!()); // 在飞连点：单发
    expect(mock新增叮嘱).toHaveBeenCalledTimes(1);
    送达();
    await waitFor(() => expect(mock新增叮嘱).toHaveBeenCalledTimes(1));
  });
});

// ── 叮嘱 scope 栅栏（review-r1 F4）：本 hook 常驻路由实例，草稿与在飞锁不得跨
//    scope（角色/单/主体）沿用；旧单迟到的清空/收口对不上代际整包作废（spec §3.1/§5）。──

/** 测试外置可控 promise：手动决定 settle 时机（在飞叮嘱夹具用）。 */
function 可控Promise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((ok) => { resolve = ok; });
  return { promise, resolve };
}

function 取输入栏(结果: 后端详情控制结果): { 值: string; 改变: (值: string) => void; 发送: (() => void) | null } {
  const 底栏 = 取正常(结果).底栏;
  if (底栏.kind !== '输入') throw new Error('进行中单底栏应是输入态');
  return 底栏;
}

describe('use后端详情控制 · 叮嘱 scope 栅栏', () => {
  it('换单清草稿零误发：A 的草稿不带到 B，B 发送只带 B 的 case_id', async () => {
    置详情状态({ caseId: 'mc_a', 快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_a' }) }) }) });
    const 视 = renderHook(
      ({ role, caseId }) => use后端详情控制({ role, caseId }),
      { initialProps: { role: 'candidate' as P5角色, caseId: 'mc_a' } },
    );
    act(() => 取输入栏(视.result.current).改变('A 单的草稿'));
    expect(取输入栏(视.result.current).值).toBe('A 单的草稿');

    置详情状态({ caseId: 'mc_b', 快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_b' }) }) }) });
    await act(async () => {
      视.rerender({ role: 'candidate', caseId: 'mc_b' });
    });
    expect(取输入栏(视.result.current).值).toBe(''); // 切换单即清空，不沿用上一单
    act(() => 取输入栏(视.result.current).改变('B 单草稿'));
    act(() => 取输入栏(视.result.current).发送!());
    expect(mock新增叮嘱).toHaveBeenCalledTimes(1);
    expect(mock新增叮嘱).toHaveBeenCalledWith('candidate', 'mc_b', 'B 单草稿'); // 零误发：A 单从未发送
    视.unmount();
  });

  it('A 在飞迟到落定不清 B 的草稿：清空/收口都过代际栅栏，B 照常可发（锁不被旧单卡死）', async () => {
    const 门 = 可控Promise<void>();
    mock新增叮嘱.mockImplementationOnce(() => 门.promise);
    置详情状态({ caseId: 'mc_a', 快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_a' }) }) }) });
    const 视 = renderHook(
      ({ role, caseId }) => use后端详情控制({ role, caseId }),
      { initialProps: { role: 'candidate' as P5角色, caseId: 'mc_a' } },
    );
    act(() => 取输入栏(视.result.current).改变('A 单在飞的草稿'));
    act(() => 取输入栏(视.result.current).发送!());
    expect(mock新增叮嘱).toHaveBeenCalledWith('candidate', 'mc_a', 'A 单在飞的草稿');

    置详情状态({ caseId: 'mc_b', 快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_b' }) }) }) });
    await act(async () => {
      视.rerender({ role: 'candidate', caseId: 'mc_b' });
    });
    act(() => 取输入栏(视.result.current).改变('B 单草稿'));
    await act(async () => {
      门.resolve(); // A 的成功此刻才落定
    });
    expect(取输入栏(视.result.current).值).toBe('B 单草稿'); // 迟到清空对不上代际，整包作废

    act(() => 取输入栏(视.result.current).发送!()); // B 单照常可发（在飞锁已随换代放行）
    expect(mock新增叮嘱).toHaveBeenCalledTimes(2);
    expect(mock新增叮嘱).toHaveBeenLastCalledWith('candidate', 'mc_b', 'B 单草稿');
    视.unmount();
  });

  it('同一 URL 主体换代同样清草稿（scope 含 主体.subject_id，key 重挂载之外父 hook 也重置）', async () => {
    置详情状态({ 快照: 详情快照({ detail: 候选详情DTO() }) });
    const 视 = renderHook(
      ({ role, caseId }) => use后端详情控制({ role, caseId }),
      { initialProps: { role: 'candidate' as P5角色, caseId: 'mc_direct' } },
    );
    act(() => 取输入栏(视.result.current).改变('切换账号前的草稿'));
    expect(取输入栏(视.result.current).值).toBe('切换账号前的草稿');

    mock应用状态 = {
      ...mock应用状态,
      后端状态: {
        ...mock应用状态.后端状态,
        主体: { ...mock应用状态.后端状态.主体, subject_id: 'sub_2' },
      },
    };
    await act(async () => {
      视.rerender({ role: 'candidate', caseId: 'mc_direct' }); // 同 URL 同单，只换账号
    });
    expect(取输入栏(视.result.current).值).toBe(''); // 不能沿用上一个人的内容
    视.unmount();
  });
});

// ── 回答在飞锁表按主体换代（review-r2 F-r2-1）：父 hook 常驻路由实例，主体换代时
//    整表替换（RefObject 不变）；换单/同主体重渲不换表（回原单续锁语义保持）。──

describe('use后端详情控制 · 回答在飞表按主体换代', () => {
  it('主体换代整表替换：RefObject 不变、新表干净；换单与同主体重渲仍同一张表', async () => {
    置详情状态({ caseId: 'mc_a', 快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_a' }) }) }) });
    const 视 = renderHook(
      ({ role, caseId }) => use后端详情控制({ role, caseId }),
      { initialProps: { role: 'candidate' as P5角色, caseId: 'mc_a' } },
    );
    const 表引用 = 取正常(视.result.current).动作输入.回答在飞表;
    表引用.current.set('mc_a', Promise.resolve());
    const 首表 = 表引用.current;

    // 换单：同一张表（回原单续锁语义不变）
    置详情状态({ caseId: 'mc_b', 快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_b' }) }) }) });
    await act(async () => {
      视.rerender({ role: 'candidate', caseId: 'mc_b' });
    });
    expect(取正常(视.result.current).动作输入.回答在飞表).toBe(表引用);
    expect(表引用.current).toBe(首表);

    // 同一 URL 同一单，主体换代（切换账号）：.current 换成全新空表
    mock应用状态 = {
      ...mock应用状态,
      后端状态: {
        ...mock应用状态.后端状态,
        主体: { ...mock应用状态.后端状态.主体, subject_id: 'sub_2' },
      },
    };
    await act(async () => {
      视.rerender({ role: 'candidate', caseId: 'mc_b' });
    });
    expect(取正常(视.result.current).动作输入.回答在飞表).toBe(表引用); // RefObject 不变（契约 C）
    expect(表引用.current).not.toBe(首表); // 表实例换代：新主体不继承旧账号的在飞锁
    expect(表引用.current.size).toBe(0);
    视.unmount();
  });
});

describe('use后端详情控制 · 终局与移交', () => {
  it('ended 终局：底栏只读且无发送回调、终局摘要齐备、3 秒节拍停', async () => {
    vi.useFakeTimers();
    置详情状态({ 快照: 详情快照({ detail: 已终止带摘要DTO() }) });
    const 视 = renderHook(() => use后端详情控制({ role: 'candidate', caseId: 'mc_direct' }));
    const 资源 = 取正常(视.result.current);
    expect(资源.底栏).toEqual({ kind: '只读', 说明: '当前在谈已结束，仅可查看' });
    // 摘要三字段：结束语/原因是 wire 原词，定格于是 mapper 的本地展示值（非 RFC3339）
    expect(资源.终局.摘要?.结束语).toBe('user_ended');
    expect(资源.终局.摘要?.原因).toBe('user_ended');
    expect(资源.终局.摘要?.定格于).toBeTruthy();
    expect(资源.终局.摘要?.定格于).not.toContain('T');
    expect(资源.终局.移交).toBeNull();
    expect(mock读取详情).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(7000));
    expect(mock读取详情).toHaveBeenCalledTimes(1); // 终局停轮询（§10.3）
    视.unmount();
  });

  it('completed+pending：私聊键禁用（禁用说明在场）、3 秒节拍继续权威重读', async () => {
    vi.useFakeTimers();
    置详情状态({ 快照: 详情快照({ detail: 待移交DTO() }) });
    const 视 = renderHook(() => use后端详情控制({ role: 'candidate', caseId: 'mc_direct' }));
    const 资源 = 取正常(视.result.current);
    const 键 = 资源.终局.移交?.开始私聊;
    expect(键).toBeTruthy();
    expect(键?.执行).toBeNull(); // 无可执行导航
    expect(键?.禁用说明).not.toBeNull();
    act(() => 键?.执行?.()); // 类型上不可能，防御性确认零导航路径
    expect(mock跳转).not.toHaveBeenCalled();
    const 基线 = mock读取详情.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(3000));
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(mock读取详情.mock.calls.length).toBeGreaterThan(基线); // pending 继续轮询
    视.unmount();
  });

  it('ready：私聊键可执行、只导航真实 conversation_ref；节拍停', async () => {
    vi.useFakeTimers();
    置详情状态({ 快照: 详情快照({ detail: 已移交DTO('3003') }) });
    const 视 = renderHook(() => use后端详情控制({ role: 'candidate', caseId: 'mc_direct' }));
    const 资源 = 取正常(视.result.current);
    const 键 = 资源.终局.移交?.开始私聊;
    expect(键?.禁用说明).toBeNull();
    act(() => 键?.执行?.());
    expect(mock跳转).toHaveBeenCalledWith(路径.真人会话路径('3003'));
    expect(mock跳转).toHaveBeenCalledTimes(1); // 只用合法 ref，不生成第二坐标
    const 基线 = mock读取详情.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(mock读取详情.mock.calls.length).toBe(基线); // 已发布会话停节拍
    视.unmount();
  });

  it('会话/角色不匹配关节拍（已登录=false）', async () => {
    vi.useFakeTimers();
    置详情状态({ 已登录: false, 快照: 详情快照({ detail: 候选详情DTO() }) });
    const 视 = renderHook(() => use后端详情控制({ role: 'candidate', caseId: 'mc_direct' }));
    await act(() => vi.advanceTimersByTimeAsync(7000));
    expect(mock读取详情).toHaveBeenCalledTimes(1); // 只有挂载直达读
    视.unmount();
  });
});
