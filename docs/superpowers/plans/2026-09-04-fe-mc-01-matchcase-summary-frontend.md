# FE-MC-01 MatchCase 精确统计前端接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Backend 模式下用 candidate/recruiter 的权威 MatchCase summary 显示双端精确统计，并保留现有标题、文案、布局、导航、Mock 行为和 P5 列表能力。

**Architecture:** 在现有 MatchCase data source 中严格解码五字段 summary；在 P5 状态/操作中增加按 role、subject 隔离的内存快照并复用现有 session/scope fence、单飞和 401 清理；现有 selector 将成功快照投影为页面字符串，两个“我的”页负责挂载读取，两个代理详情页只消费已载内存快照。Mutation 确认成功后仅刷新已经加载过的同角色 summary，且刷新失败不改变 mutation 结果。

**Tech Stack:** React 19、TypeScript 6、Vitest、Testing Library、现有 BFF 客户端与 P5 MatchCase operation。

**Spec:** `docs/superpowers/specs/2026-09-04-fe-mc-01-matchcase-summary-frontend-design.md`

## Global Constraints

- 实施前在当前隔离 worktree 中完整阅读 `CLAUDE.md`、`AGENTS.md`、Spec 和本 Plan。开始 Task 1 前执行 `git fetch origin`，把最新 `origin/main` 普通 merge 到实现分支；不得 rebase 已批准文档提交。若冲突需要新的产品判断，停止并回报。
- 本 Plan 只覆盖 `FE-MC-01`；不得实现或夹带 `FE-IV-01`。
- 必须对接已发布后端基线：Recruitment `9c4eff934`、BFF `5917f71a5`、`origin/release/0.2.5`=`21e34ff047bf17e20e0fc0e13f1e391460456270`、OpenAPI `1.0.0`。若最新后端合同与 Spec 不同，停止并报告 contract drift，不得猜合同。
- 页面不得直接 `fetch`；不得新增 query/cache 框架、独立 summary 域、轮询、全局 `visibilitychange` 监听或持久化。
- Backend 统计不得回退 P5 open page 长度、history 长度、legacy Mock 数组或 localStorage；首次加载、刷新中、失败、坏 schema、owner/role/session 不匹配均显示 `—`，成功的零显示 `0`。
- 不改变任何现有 summary 标题、代理卡标题、统计名称、布局、颜色或点击行为；尤其不得追加可见的 `MatchCase` 字样。候选卡原有 `当前 MatchCase：N` 文本逐字保留，招聘方“我的招聘AI代理”卡继续只显示在招岗位与规则文案。
- 候选映射固定为 `open_total`、`open_anonymous_screening_total`、`open_needs_action_total`、`ended_total + completed_total`；招聘映射固定为现有 Job 在招数、`open_total`、`open_needs_action_total`、`completed_total`。
- Summary 失败与列表/历史/详情隔离；mutation 已成功时 summary 刷新失败不得 reject mutation，也不得清空其它 P5 资源。此前未加载 summary 时 mutation 不发隐藏 summary 请求。
- 每个实现 Task 严格 RED → GREEN，完成后提交；不顺手重构。代码块中的实现是冻结接口，不得改名或引入等价抽象。
- 唯一权威 Plan-scope gate 是 `npm test`。定向 Vitest 是 inner loop；`npm run typecheck`、`npm run lint`、`npm run build` 是最终基本验证，不能代替 `npm test`。

## Prerequisites and completion

- 前序 Plan：无。三个实现 Task 在同一 branch/worktree 串行执行，顺序为 Task 1 → Task 2 → Task 3；不得并行改共享类型、操作或测试桩。
- Task 1 产出 `MatchCaseSummary` 与 `读取P5摘要`；Task 2 消费它们并产出 `P5摘要快照`、`P5摘要` 状态和 `加载摘要`；Task 3 原子修改 selector 及其全部四个现有消费者，避免提交暂时不可 typecheck 的中间状态。
- 完成标准：严格 decoder、双端 endpoint、加载/失败/重试/单飞/会话栅栏/401、mutation revalidation、双端页面映射、代理详情、Mock 零请求均有自动测试；`npm test`、typecheck、lint、build 通过；Backend local dogfood 有真实运行记录；工作树干净。
- **计划本身复杂度：中。** 原因：接入严格 wire 合同并修改共享 P5 operation 与四个消费者，但不改变现有列表、详情或页面架构。
- **零上下文漂移风险：中。** 原因：执行前需同步 `origin/main`，P5 类型、operation 与测试桩可能有现场漂移；本 Plan 已冻结 schema、状态归属、失败语义、消费者和测试门。
- 执行模型档位：当前可用的行业 Top 5–10 中高性价比模型；模型档位只由零上下文漂移风险决定，不用于补偿 Plan 缺失。
- Integration metadata：`integration_requirement: none`、`selection_ssot: none`、`selection_gap: none`、`l3_selection: []`；仓库没有本变更对应的正式 L3 Case catalog/selection SSOT。Backend local dogfood 属 Plan 的 L0–L2/等价隔离验收，不得伪装为 L3。

---

### Task 1: 在 MatchCase data source 中加入严格 summary 合同

**Files:**
- Modify: `src/数据/招聘数据源/MatchCase.ts`
- Modify: `src/数据/招聘数据源/MatchCase.test.ts`

**Self-contained brief:**
- Global Constraints 全量适用。
- Predecessor artifacts：无代码前序；只消费现有 `要求闭合对象`、`要求范围整数`、`P5路径` 和 `BFF客户端.请求`。
- Produces：归一化 `MatchCaseSummary`、导出的 `解MatchCaseSummary(input)`、`MatchCase数据源.读取P5摘要(role)`。
- Wire 必需键恰为 `open_total`、`open_anonymous_screening_total`、`open_needs_action_total`、`ended_total`、`completed_total`；不得接受额外键。

- [ ] **Step 1: 写失败合同测试**

在 `MatchCase.test.ts` 的 import 中增加 `解MatchCaseSummary`，并在列表测试前加入：

```ts
const 合法摘要Wire = {
  open_total: 51,
  open_anonymous_screening_total: 17,
  open_needs_action_total: 9,
  ended_total: 4,
  completed_total: 3,
};

it('双端 summary 走角色 endpoint、no-store，并返回精确归一化值', async () => {
  请求Mock
    .mockResolvedValueOnce(响应(合法摘要Wire))
    .mockResolvedValueOnce(响应({
      open_total: 0,
      open_anonymous_screening_total: 0,
      open_needs_action_total: 0,
      ended_total: 0,
      completed_total: 0,
    }));
  await expect(source.读取P5摘要('candidate')).resolves.toEqual({
    openTotal: 51,
    openAnonymousScreeningTotal: 17,
    openNeedsActionTotal: 9,
    endedTotal: 4,
    completedTotal: 3,
  });
  await expect(source.读取P5摘要('recruiter')).resolves.toEqual({
    openTotal: 0,
    openAnonymousScreeningTotal: 0,
    openNeedsActionTotal: 0,
    endedTotal: 0,
    completedTotal: 0,
  });
  expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
    { path: '/api/v1/me/match-cases/summary', 不缓存: true },
    { path: '/api/v1/recruiter/match-cases/summary', 不缓存: true },
  ]);
});

it.each([
  { open_total: 1, open_anonymous_screening_total: 0, open_needs_action_total: 0, ended_total: 0 },
  { ...合法摘要Wire, unknown_total: 1 },
  { ...合法摘要Wire, open_total: '51' },
  { ...合法摘要Wire, open_total: 1.5 },
  { ...合法摘要Wire, open_total: -1 },
  { ...合法摘要Wire, open_total: Number.NaN },
  { ...合法摘要Wire, open_total: Number.POSITIVE_INFINITY },
  { ...合法摘要Wire, open_total: Number.MAX_SAFE_INTEGER + 1 },
])('summary 拒绝缺键、多键与坏整数：%j', (wire) => {
  expect(() => 解MatchCaseSummary(wire)).toThrow(契约漂移);
});

it('ended 与 completed 的和不是安全整数时整包拒绝', () => {
  expect(() => 解MatchCaseSummary({
    ...合法摘要Wire,
    ended_total: Number.MAX_SAFE_INTEGER,
    completed_total: 1,
  })).toThrow(契约漂移);
});
```

- [ ] **Step 2: 运行 RED**

```bash
npx vitest run src/数据/招聘数据源/MatchCase.test.ts
```

Expected：FAIL，指出 `解MatchCaseSummary` 与 `读取P5摘要` 尚不存在。

- [ ] **Step 3: 实现最小 strict decoder 与请求方法**

在 `MatchCase.ts` 的 DTO 类型区加入：

```ts
export interface MatchCaseSummary {
  openTotal: number;
  openAnonymousScreeningTotal: number;
  openNeedsActionTotal: number;
  endedTotal: number;
  completedTotal: number;
}

export function 解MatchCaseSummary(input: unknown): MatchCaseSummary {
  const raw = 要求闭合对象(input, [
    'open_total',
    'open_anonymous_screening_total',
    'open_needs_action_total',
    'ended_total',
    'completed_total',
  ]);
  const endedTotal = 要求范围整数(raw.ended_total, 0, Number.MAX_SAFE_INTEGER);
  const completedTotal = 要求范围整数(raw.completed_total, 0, Number.MAX_SAFE_INTEGER);
  if (!Number.isSafeInteger(endedTotal + completedTotal)) throw 契约错误();
  return {
    openTotal: 要求范围整数(raw.open_total, 0, Number.MAX_SAFE_INTEGER),
    openAnonymousScreeningTotal: 要求范围整数(
      raw.open_anonymous_screening_total, 0, Number.MAX_SAFE_INTEGER),
    openNeedsActionTotal: 要求范围整数(raw.open_needs_action_total, 0, Number.MAX_SAFE_INTEGER),
    endedTotal,
    completedTotal,
  };
}
```

在 `MatchCase数据源` interface 加入：

```ts
读取P5摘要(role: P5角色): Promise<MatchCaseSummary>;
```

在 `创建MatchCase数据源` 内加入并从返回对象导出：

```ts
async function 读取P5摘要(role: P5角色): Promise<MatchCaseSummary> {
  const { result } = await 请求<unknown>({
    path: P5路径(role, '/match-cases/summary'),
    不缓存: true,
  });
  return 解MatchCaseSummary(result);
}
```

- [ ] **Step 4: 运行 GREEN 与提交**

```bash
npx vitest run src/数据/招聘数据源/MatchCase.test.ts
git add src/数据/招聘数据源/MatchCase.ts src/数据/招聘数据源/MatchCase.test.ts
git commit -m "feat: add matchcase summary data source"
```

Expected：测试 PASS，提交成功。

---

### Task 2: 在 P5 状态与操作层实现 summary 生命周期和 mutation 后刷新

**Files:**
- Modify: `src/状态/后端/类型.ts`
- Modify: `src/状态/后端/MatchCase操作.ts`
- Modify: `src/状态/后端/MatchCase操作.test.ts`

**Self-contained brief:**
- Global Constraints 全量适用。
- Predecessor artifacts：Task 1 已提交并产出 `MatchCaseSummary` 与 `HTTP招聘数据源.读取P5摘要(role)`。
- Produces：`P5摘要快照`、`P5MatchCase状态.P5摘要`、`P5范围键.summary(role)`、`MatchCase操作.加载摘要(role)`。
- Summary 首载和刷新都清除旧 `summary`；`进行中/失败` 快照的 `summary` 必须为 `null`。公共加载与 mutation revalidation 复用同一个 `运行摘要读`。

- [ ] **Step 1: 扩展数据源桩并写 RED 测试**

在 `MatchCase操作.test.ts` 的类型 import 加入 `MatchCaseSummary`，并加入：

```ts
const 初始摘要: MatchCaseSummary = {
  openTotal: 51,
  openAnonymousScreeningTotal: 17,
  openNeedsActionTotal: 9,
  endedTotal: 4,
  completedTotal: 3,
};

const 更新摘要: MatchCaseSummary = {
  openTotal: 50,
  openAnonymousScreeningTotal: 16,
  openNeedsActionTotal: 8,
  endedTotal: 5,
  completedTotal: 4,
};
```

在 `创建P5数据源` 返回对象加入：

```ts
读取P5摘要: vi.fn(async (): Promise<MatchCaseSummary> => 初始摘要),
```

在 `P5范围键 与 设置P5范围` 用例加入：

```ts
expect(P5范围键.summary('candidate')).toBe('p5:summary:candidate');
expect(P5范围键.summary('recruiter')).toBe('p5:summary:recruiter');
```

新增以下测试：

```ts
describe('P5 summary 读取与刷新', () => {
  beforeEach(() => {
    env.操作.设置P5范围('candidate', P5范围键.summary('candidate'));
  });

  it('首载成功写当前 owner；刷新立即清旧值，失败保持 null，重试恢复', async () => {
    await env.操作.加载摘要('candidate');
    expect(env.最新状态().P5摘要.candidate).toMatchObject({
      ownerSubjectId: 'sub_1', 阶段: '成功', 刷新中: false, summary: 初始摘要, error: null,
    });

    const 刷新 = deferred<MatchCaseSummary>();
    vi.mocked(env.数据源.读取P5摘要).mockReturnValueOnce(刷新.promise);
    const 在飞 = env.操作.加载摘要('candidate');
    expect(env.最新状态().P5摘要.candidate).toMatchObject({
      ownerSubjectId: 'sub_1', 阶段: '进行中', 刷新中: true, summary: null, error: null,
    });
    刷新.reject(new BFF错误(500, 'server_error', '失败'));
    await 在飞;
    expect(env.最新状态().P5摘要.candidate).toMatchObject({
      阶段: '失败', 刷新中: false, summary: null,
    });

    vi.mocked(env.数据源.读取P5摘要).mockResolvedValueOnce(更新摘要);
    await env.操作.加载摘要('candidate');
    expect(env.最新状态().P5摘要.candidate?.summary).toEqual(更新摘要);
  });

  it('同 role/owner 单飞，candidate 与 recruiter 使用独立槽', async () => {
    const 读取 = deferred<MatchCaseSummary>();
    vi.mocked(env.数据源.读取P5摘要).mockReturnValueOnce(读取.promise);
    const 甲 = env.操作.加载摘要('candidate');
    const 乙 = env.操作.加载摘要('candidate');
    expect(env.数据源.读取P5摘要).toHaveBeenCalledTimes(1);
    读取.resolve(初始摘要);
    await Promise.all([甲, 乙]);

    设主体角色(招聘主体);
    env.操作.设置P5范围('recruiter', P5范围键.summary('recruiter'));
    vi.mocked(env.数据源.读取P5摘要).mockResolvedValueOnce(更新摘要);
    await env.操作.加载摘要('recruiter');
    expect(env.最新状态().P5摘要.candidate?.summary).toEqual(初始摘要);
    expect(env.最新状态().P5摘要.recruiter?.summary).toEqual(更新摘要);
  });

  it('同角色换主体后迟到 success 不污染新主体', async () => {
    const 旧读 = deferred<MatchCaseSummary>();
    vi.mocked(env.数据源.读取P5摘要).mockReturnValueOnce(旧读.promise);
    const 在飞 = env.操作.加载摘要('candidate');
    env.deps.主体标识引用.current = 'sub_2';
    env.deps.会话代际.current += 1;
    env.deps.后端状态引用.current = {
      ...env.deps.后端状态引用.current,
      主体: { ...候选主体, subject_id: 'sub_2' },
    };
    env.操作.设置P5范围('candidate', null);
    env.操作.设置P5范围('candidate', P5范围键.summary('candidate'));
    旧读.resolve(初始摘要);
    await 在飞;
    expect(env.最新状态().P5摘要.candidate?.summary).not.toEqual(初始摘要);
  });

  it('当前 401 清空账号和 P5 summary；迟到 401 不清新会话', async () => {
    vi.mocked(env.数据源.读取P5摘要)
      .mockRejectedValueOnce(new BFF错误(401, 'unauthorized', '当前会话'));
    await env.操作.加载摘要('candidate');
    expect(env.最新状态().已登录).toBe(false);
    expect(env.最新状态().P5摘要).toEqual({});

    env = 创建P5操作测试环境();
    env.操作.设置P5范围('candidate', P5范围键.summary('candidate'));
    const 旧401 = deferred<MatchCaseSummary>();
    vi.mocked(env.数据源.读取P5摘要).mockReturnValueOnce(旧401.promise);
    const 在飞 = env.操作.加载摘要('candidate');
    env.deps.会话代际.current += 1;
    旧401.reject(new BFF错误(401, 'unauthorized', '旧会话'));
    await 在飞;
    expect(env.最新状态().已登录).toBe(true);
  });

  it('mutation 只刷新已载同角色 summary，刷新失败不改变 mutation 成功', async () => {
    await env.操作.加载摘要('candidate');
    env.操作.设置P5范围('candidate', P5范围键.open('candidate', null));
    vi.mocked(env.数据源.读取P5Open列表).mockResolvedValue(候选页([候选行('mc_1')], null));
    await env.操作.加载工作区('candidate', null);
    env.操作.设置P5范围('candidate', P5范围键.detail('candidate', 'mc_1'));
    vi.mocked(env.数据源.读取P5详情).mockResolvedValueOnce(权威候选详情);
    await env.操作.读取详情('candidate', 'mc_1');
    vi.mocked(env.数据源.读取P5详情).mockResolvedValue(已解事实详情);
    vi.mocked(env.数据源.读取P5摘要)
      .mockRejectedValueOnce(new BFF错误(500, 'server_error', 'summary refresh failed'));
    await expect(env.操作.回答事实('candidate', 'mc_1', 'prompt_1', '回答')).resolves.toBeUndefined();
    expect(env.数据源.回答P5事实).toHaveBeenCalledTimes(1);
    expect(env.数据源.读取P5摘要).toHaveBeenCalledTimes(2);
    expect(env.最新状态().P5摘要.candidate?.summary).toBeNull();
    expect(env.最新状态().P5工作区[P5范围键.open('candidate', null)]?.阶段).toBe('成功');
    expect(env.最新状态().P5详情[P5范围键.detail('candidate', 'mc_1')]?.detail)
      .toEqual(已解事实详情);

    const 未载 = 创建P5操作测试环境();
    未载.操作.设置P5范围('candidate', P5范围键.detail('candidate', 'mc_1'));
    vi.mocked(未载.数据源.读取P5详情).mockResolvedValue(已解事实详情);
    await 未载.操作.回答事实('candidate', 'mc_1', 'prompt_1', '回答');
    expect(未载.数据源.读取P5摘要).not.toHaveBeenCalled();
  });

  it('Mock 模式加载 summary 零请求', async () => {
    const mockEnv = 创建P5操作测试环境(false);
    mockEnv.操作.设置P5范围('candidate', P5范围键.summary('candidate'));
    await mockEnv.操作.加载摘要('candidate');
    expect(mockEnv.数据源.读取P5摘要).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行 RED**

```bash
npx vitest run src/状态/后端/MatchCase操作.test.ts
```

Expected：FAIL，缺少 `P5摘要`、`P5范围键.summary` 与 `操作.加载摘要`。

- [ ] **Step 3: 增加状态类型、scope key 与快照构造器**

在 `类型.ts` 从 data source import `MatchCaseSummary`，加入：

```ts
export interface P5摘要快照 {
  ownerSubjectId: string | null;
  阶段: P5加载阶段;
  刷新中: boolean;
  summary: MatchCaseSummary | null;
  error: string | null;
  generation: number;
}

export interface P5MatchCase状态 {
  P5摘要: Partial<Record<P5角色, P5摘要快照>>;
  P5工作区: Record<string, P5列表快照>;
  P5历史: Record<string, P5列表快照>;
  P5详情: Record<string, P5详情快照>;
}
```

在 `MatchCase操作` 的 `设置P5范围` 后加入：

```ts
/** 每次调用都发起当前角色的权威 no-store summary 读取；并发同 scope 单飞。 */
加载摘要(role: P5角色): Promise<void>;
```

在 `MatchCase操作.ts` import `MatchCaseSummary`、`P5摘要快照`，修改：

```ts
export const P5范围键 = {
  summary: (role: P5角色): string => `p5:summary:${role}`,
  open: (role: P5角色, filterRef: string | null): string =>
    `p5:open:${role}:${filterRef === null ? '*' : 段(filterRef)}`,
  history: (role: P5角色, lifecycle: P5历史生命周期, filterRef: string | null): string =>
    `p5:history:${role}:${lifecycle}:${filterRef === null ? '*' : 段(filterRef)}`,
  detail: (role: P5角色, caseId: string): string =>
    `p5:detail:${role}:${段(caseId)}`,
} as const;

export function 创建空P5MatchCase状态(): P5MatchCase状态 {
  return { P5摘要: {}, P5工作区: {}, P5历史: {}, P5详情: {} };
}

function 起步摘要(ownerSubjectId: string | null, generation: number): P5摘要快照 {
  return { ownerSubjectId, 阶段: '进行中', 刷新中: true, summary: null, error: null, generation };
}

function 成功摘要(
  ownerSubjectId: string | null, summary: MatchCaseSummary, generation: number,
): P5摘要快照 {
  return { ownerSubjectId, 阶段: '成功', 刷新中: false, summary, error: null, generation };
}

function 失败摘要(
  ownerSubjectId: string | null, 错误: unknown, generation: number,
): P5摘要快照 {
  return {
    ownerSubjectId, 阶段: '失败', 刷新中: false,
    summary: null, error: 取后端错误文案(错误), generation,
  };
}
```

- [ ] **Step 4: 实现唯一 summary 读核与已载刷新**

先把 `MatchCase操作.ts` 文件头的 mutation 刷新说明改为“确认成功后权威重读 detail、刷新已载列表/历史，并刷新已载同角色 summary；summary 失败不 reject mutation”。随后在 `运行列表读` 后、mutation 核前加入：

```ts
async function 运行摘要读(role: P5角色): Promise<void> {
  if (!是后端 || !后端) return;
  if (后端状态引用.current.主体?.last_used_role !== role) return;
  const scopeKey = P5范围键.summary(role);
  const 取得 = 获取读锁(scopeKey);
  if (!取得) return;
  const fence = 取得.fence;
  try {
    设后端状态((旧态) => ({
      ...旧态,
      P5摘要: { ...旧态.P5摘要, [role]: 起步摘要(fence.subjectId, fence.scopeGeneration) },
    }));
    const summary = await 后端.读取P5摘要(role);
    if (!栅栏仍当前(fence)) return;
    设后端状态((旧态) => ({
      ...旧态,
      P5摘要: { ...旧态.P5摘要, [role]: 成功摘要(fence.subjectId, summary, fence.scopeGeneration) },
    }));
  } catch (错误) {
    if (!栅栏仍当前(fence)) return;
    if (是401(错误)) {
      清账号与P5();
      return;
    }
    设后端状态((旧态) => ({
      ...旧态,
      P5摘要: { ...旧态.P5摘要, [role]: 失败摘要(fence.subjectId, 错误, fence.scopeGeneration) },
    }));
  } finally {
    释放读锁(取得);
  }
}

async function 刷新已载摘要(role: P5角色): Promise<void> {
  const 旧 = 后端状态引用.current.P5摘要[role];
  if (旧 === undefined || 旧.ownerSubjectId !== 主体标识引用.current) return;
  await 运行摘要读(role);
}
```

在返回的 operation object 的 `设置P5范围` 后加入：

```ts
加载摘要(role) {
  return 运行摘要读(role);
},
```

把 mutation 对账确认后的 `await 刷新已载列表(input.role)` 扩展为两条同形、串行且各自不抛的刷新：

```ts
await 刷新已载列表(input.role);
await 刷新已载摘要(input.role);
```

保留 `权威重读详情` 的现有非 401 catch `return`、现有 `栅栏仍当前(fence)` 和现有列表刷新，避免改变 detail/list 失败语义。在明确 POST 成功分支中，让 summary 刷新独立发生在权威 detail 重读之后：

```ts
await 权威重读详情(input.role, input.caseId);
await 刷新已载摘要(input.role);
```

`刷新已载列表` 自身通过 `Promise.allSettled` 隔离列表错误，`运行摘要读` 自己吞掉并结算 summary 非 401 错误；因此不增加只调用一次的组合 helper。若 detail 重读触发当前 401，P5 已被清空，后续 `刷新已载摘要` 会零请求返回。结果不确定但权威对账确认成功的分支按同样两行刷新既有列表与已载 summary。

- [ ] **Step 5: 运行 GREEN、相关回归与提交**

```bash
npx vitest run src/状态/后端/MatchCase操作.test.ts src/状态/后端/会话操作.test.ts
git add src/状态/后端/类型.ts src/状态/后端/MatchCase操作.ts src/状态/后端/MatchCase操作.test.ts
git commit -m "feat: manage matchcase summary state"
```

Expected：测试 PASS；既有 mutation/list/detail/401 测试不回归。

---

### Task 3: 原子迁移 summary selector 的全部四个页面消费者

**Files:**
- Modify: `src/状态/后端/MatchCase统计.ts`
- Modify: `src/状态/后端/MatchCase统计.test.ts`
- Modify: `src/屏幕/我的.tsx`
- Modify: `src/屏幕/我的.test.tsx`
- Modify: `src/屏幕/企业我的.tsx`
- Modify: `src/屏幕/企业我的.test.tsx`
- Modify: `src/屏幕/代理详情.tsx`
- Modify: `src/屏幕/代理详情.test.tsx`
- Modify: `src/屏幕/企业代理详情.tsx`
- Modify: `src/屏幕/企业代理详情.test.tsx`

**Self-contained brief:**
- Global Constraints 全量适用。
- Predecessor artifacts：Task 2 已提交并产出 `P5摘要快照`、`后端状态.P5摘要`、`P5范围键.summary(role)` 与 `操作.加载摘要(role)`。
- Produces：`P5Open统计` 的精确 `open/anonymousScreening/needsAction/archived/completed` 字符串；两个“我的”页进入时注册 summary scope 并权威读取；两个代理详情页只消费已载内存 summary。
- `取P5候选横幅状态` 继续读取 `P5列表快照`，不得迁移或改变其四态文案。
- Selector 的签名与四个消费者必须在同一 Task、同一 commit 原子切换；Step 8 前不提交，避免留下不能 typecheck 的中间状态。

- [ ] **Step 1: 把 selector 测试改为精确 summary 合同**

在 `MatchCase统计.test.ts` 保留 `行`、`成功(items,nextCursor)` 和末条 `候选横幅保持既有四态且 owner 不匹配视为未载入` 测试；只删除当前 describe 内前四条 open 统计 `it`（`完整成功窗口…`、`未尽分页…`、`非成功快照为中性值`、`owner 不匹配…`），把现有 describe 改名为 `describe('MatchCase 统计 selector', () => {`，再把以下 fixture 放在 describe 之前、把三条新 `it` 直接加入这个已改名 describe。不得创建第二个 describe：

```ts
import type { P5列表快照, P5摘要快照 } from './类型';

const 权威摘要 = {
  openTotal: 51,
  openAnonymousScreeningTotal: 17,
  openNeedsActionTotal: 9,
  endedTotal: 4,
  completedTotal: 3,
};

function 成功摘要(覆盖: Partial<P5摘要快照> = {}): P5摘要快照 {
  return {
    ownerSubjectId: 'sub_1', 阶段: '成功', 刷新中: false,
    summary: 权威摘要, error: null, generation: 1,
    ...覆盖,
  };
}

it('成功 summary 返回跨页精确数字和两个终局投影', () => {
    expect(取P5Open统计(成功摘要(), 'sub_1')).toEqual({
      open: '51', anonymousScreening: '17', needsAction: '9', archived: '7', completed: '3',
    });
  });

  it('权威零与未加载的中性值可区分', () => {
    expect(取P5Open统计(成功摘要({
      summary: {
        openTotal: 0,
        openAnonymousScreeningTotal: 0,
        openNeedsActionTotal: 0,
        endedTotal: 0,
        completedTotal: 0,
      },
    }), 'sub_1')).toEqual({
      open: '0', anonymousScreening: '0', needsAction: '0', archived: '0', completed: '0',
    });
    expect(取P5Open统计(undefined, 'sub_1')).toEqual({
      open: '—', anonymousScreening: '—', needsAction: '—', archived: '—', completed: '—',
    });
  });

  it.each([
    成功摘要({ 阶段: '进行中', 刷新中: true, summary: null }),
    成功摘要({ 阶段: '失败', summary: null, error: '失败' }),
    成功摘要({ 刷新中: true, summary: null }),
    成功摘要({ ownerSubjectId: 'sub_old' }),
  ])('加载、刷新、失败或 owner 不匹配都显示中性值', (snapshot) => {
    expect(取P5Open统计(snapshot, 'sub_1')).toEqual({
      open: '—', anonymousScreening: '—', needsAction: '—', archived: '—', completed: '—',
    });
  });
```

- [ ] **Step 2: 把候选“我的”测试桩改为 summary 并冻结文案**

在 `我的.test.tsx` 把文件头的 Backend MatchCase 说明改为“当前 candidate owner 的 summary 精确统计、挂载刷新、Mock 零 summary operation”；不得再声称读取 unfiltered open 快照。删除 `P5列表项`、`P5列表快照`、`行` 和 `成功P5快照`，import `P5摘要快照`。稳定 operation spy 改为：

```ts
const 设置P5范围 = vi.fn();
const 加载摘要 = vi.fn(async () => undefined);
```

测试上下文保留现有 `Agent规则水合`、`简历快照`、`主体` 显式类型，只把 operation 与 P5 字段改为：

```ts
操作: { 设置P5范围: typeof 设置P5范围; 加载摘要: typeof 加载摘要 };
P5摘要: { candidate?: P5摘要快照 };
```

加入 fixture：

```ts
function 成功摘要(ownerSubjectId = 'sub_candidate'): P5摘要快照 {
  return {
    ownerSubjectId, 阶段: '成功', 刷新中: false,
    summary: {
      openTotal: 51,
      openAnonymousScreeningTotal: 17,
      openNeedsActionTotal: 9,
      endedTotal: 4,
      completedTotal: 3,
    },
    error: null,
    generation: 1,
  };
}
```

让 `布置` 接收 `P5摘要?: P5摘要快照`，operation 写 `{ 设置P5范围, 加载摘要 }`，后端字段写：

```ts
P5摘要: 选项.P5摘要 === undefined ? {} : { candidate: 选项.P5摘要 },
```

把 Backend 统计核心测试替换为：

```ts
it('Backend 注册 candidate summary scope，并保留原标题文案显示精确跨页统计', async () => {
  const scope = P5范围键.summary('candidate');
  const { unmount } = 布置('backend', {
    主体: { ...BFF主体样本, subject_id: 'sub_candidate', last_used_role: 'candidate' },
    P5摘要: 成功摘要(),
  });
  for (const text of ['51', '17', '9', '7', '在谈', '初筛中', '待你拍', '已归档']) {
    expect(screen.getByText(text)).toBeTruthy();
  }
  expect(screen.getByText(/当前 MatchCase：51/)).toBeTruthy();
  await waitFor(() => expect(设置P5范围).toHaveBeenCalledWith('candidate', scope));
  expect(加载摘要).toHaveBeenCalledWith('candidate');
  unmount();
  expect(设置P5范围).toHaveBeenLastCalledWith('candidate', null);
});

it('刷新中或旧 owner 显示 —；Mock 保留原数字且零 summary operation', () => {
  布置('backend', {
    主体: { ...BFF主体样本, subject_id: 'sub_new', last_used_role: 'candidate' },
    P5摘要: { ...成功摘要('sub_old'), 阶段: '进行中', 刷新中: true, summary: null },
  });
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);

  设置P5范围.mockClear();
  加载摘要.mockClear();
  布置('mock');
  expect(screen.getByText(String(初始状态.在谈列表.length))).toBeTruthy();
  expect(设置P5范围).not.toHaveBeenCalled();
  expect(加载摘要).not.toHaveBeenCalled();
});
```

删除原 `Backend 注册 candidate unfiltered scope 并只显示权威统计`、`Backend 旧 owner 显示 —` 两例；它们已由上面两例完整替代。把仍引用旧 fixture 的两个代理卡用例逐字替换为：

```ts
it('Backend 代理卡只说 MatchCase 事实，无在线断言与占位运营页脚', () => {
  const { unmount } = 布置('backend', {
    主体: { ...BFF主体样本, subject_id: 'sub_candidate', last_used_role: 'candidate' },
    P5摘要: 成功摘要(),
  });
  expect(screen.getByText(/当前 MatchCase：51/)).toBeTruthy();
  for (const text of ['在线', '并行寻访', '400-000-0000', '人力资源服务许可证', '资质证照']) {
    expect(screen.queryByText(new RegExp(text))).toBeNull();
  }
  expect(screen.queryByText(/规则 \d+ 条生效/)).toBeNull();
  unmount();
});

it('Backend 规则水合成功后显示当前 MatchCase 与已水合规则数', () => {
  布置('backend', {
    规则水合: '成功',
    主体: { ...BFF主体样本, subject_id: 'sub_candidate', last_used_role: 'candidate' },
    P5摘要: 成功摘要(),
  });
  expect(screen.getByText(/当前 MatchCase：51/)).toBeTruthy();
  expect(screen.getByText(/规则 \d+ 条生效/)).toBeTruthy();
});
```

把文件 `beforeEach` 与所有 Mock 零调用断言中的 `加载工作区` 全部改为 `加载摘要`；改完后 `rg -n 'P5快照|成功P5快照|加载工作区|P5列表项|P5列表快照' src/屏幕/我的.test.tsx` 必须零匹配。

- [ ] **Step 3: 把招聘“我的”测试桩改为 summary 并冻结不新增 MatchCase 文案**

在 `企业我的.test.tsx` 把文件头的 Backend MatchCase 说明改为“当前 recruiter owner 的 summary 精确统计、挂载刷新、在招岗位仍来自 Job、Mock 零 summary operation”；不得再声称读取 unfiltered open 快照或意向达成固定 `—`。删除 P5 list fixture/import；import `P5摘要快照`，把 `mock加载工作区` 改名为 `mock加载摘要`。让 `置Backend应用状态` 的第三参数为 `P5摘要?: P5摘要快照`，operation 写 `{ 设置P5范围: mock设置P5范围, 加载摘要: mock加载摘要 }`，后端字段写：

```ts
P5摘要: P5摘要 === undefined ? {} : { recruiter: P5摘要 },
```

加入：

```ts
function 成功招聘摘要(ownerSubjectId = 'sub_recruiter'): P5摘要快照 {
  return {
    ownerSubjectId, 阶段: '成功', 刷新中: false,
    summary: {
      openTotal: 52,
      openAnonymousScreeningTotal: 18,
      openNeedsActionTotal: 8,
      endedTotal: 6,
      completedTotal: 5,
    },
    error: null,
    generation: 1,
  };
}
```

核心断言改为：

```ts
it('在招岗位仍读 Job；其余三项读 recruiter summary；代理卡不追加 MatchCase 文案', async () => {
  置Backend应用状态(
    { 岗位列表: [{ 编号: 'J-1', 名称: 'AI 产品实习生', 状态: '在招', 薪资带: '300-500 元/天' }] },
    '未开始',
    成功招聘摘要(),
  );
  const { unmount } = render(<MemoryRouter><企业我的 /></MemoryRouter>);
  for (const text of ['1', '52', '8', '5', '在招岗位', '在谈', '待拍板', '意向达成']) {
    expect(screen.getByText(text)).toBeTruthy();
  }
  expect(screen.getByText('1 个在招岗位')).toBeTruthy();
  expect(screen.queryByText(/MatchCase/)).toBeNull();
  await waitFor(() => expect(mock设置P5范围)
    .toHaveBeenCalledWith('recruiter', P5范围键.summary('recruiter')));
  expect(mock加载摘要).toHaveBeenCalledWith('recruiter');
  unmount();
  expect(mock设置P5范围).toHaveBeenLastCalledWith('recruiter', null);
});
```

删除原 `注册 recruiter unfiltered scope…` 用例；它已由上面的精确 summary 用例替代。把仍引用旧 list fixture 的点击与旧 owner 用例逐字替换为：

```ts
it('点击待拍板仍派发 企业看全部在谈/待我拍板', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  置Backend应用状态({}, '未开始', 成功招聘摘要());
  render(<MemoryRouter><企业我的 /></MemoryRouter>);
  await user.click(screen.getByRole('button', { name: /待拍板/ }));
  expect(mock派发).toHaveBeenCalledWith({ 型: '企业看全部在谈', 档: '待我拍板' });
});

it('企业候选列表不进入 Backend 展示：旧 owner summary 显示 —', () => {
  置Backend应用状态(
    { 企业候选列表: [{ 编号: 'A-01' }, { 编号: 'A-02' }] },
    '未开始',
    成功招聘摘要('sub_old'),
  );
  render(<MemoryRouter><企业我的 /></MemoryRouter>);
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  expect(mock派发).not.toHaveBeenCalled();
});
```

把文件 `beforeEach` 与所有 Mock 零调用断言中的 `mock加载工作区` 全部改为 `mock加载摘要`。现有统计卡点击动作与 Mock 行为保持不变。

`置Mock应用状态` 是独立测试桩；它的 `后端状态` 也必须把旧字段逐字替换为：

```ts
P5摘要: {},
```

最终门禁扩展为：`rg -n 'P5快照|成功P5快照|mock加载工作区|招聘行|P5列表项|P5列表快照|P5工作区' src/屏幕/企业我的.test.tsx`，必须零匹配。

- [ ] **Step 4: 运行 RED**

```bash
npx vitest run src/状态/后端/MatchCase统计.test.ts src/屏幕/我的.test.tsx src/屏幕/企业我的.test.tsx
```

Expected：FAIL，selector 仍要求 `P5列表快照`，页面仍注册 open scope/调用 `加载工作区`，且终局指标仍为 `—`。

- [ ] **Step 5: 实现 summary selector**

把 `MatchCase统计.ts` 文件头改为：

```ts
// Backend MatchCase 精确统计：四个页面共用 summary 投影；只认当前 owner 的成功快照，
// loading/refresh/error/owner mismatch 一律给 —，成功零明确给 0，绝不回退分页 N/N+。
// 候选 P5 横幅仍由 open 列表快照驱动，保留既有分页与四态语义。
```

把 `MatchCase统计.test.ts` 文件头同步改成“summary 精确统计 + open 列表横幅”口径，不得再声称 open 统计来自分页。随后在 `MatchCase统计.ts` 保留 `P5候选横幅状态`、`取P5候选横幅状态` 与 `P5列表快照` import；加入 `P5摘要快照` 并替换统计部分：

```ts
export interface P5Open统计 {
  open: string;
  anonymousScreening: string;
  needsAction: string;
  archived: string;
  completed: string;
}

const 中性统计: P5Open统计 = {
  open: '—', anonymousScreening: '—', needsAction: '—', archived: '—', completed: '—',
};

export function 取P5Open统计(
  snapshot: P5摘要快照 | undefined,
  subjectId: string | null,
): P5Open统计 {
  if (subjectId === null || snapshot?.阶段 !== '成功' || snapshot.刷新中 ||
    snapshot.ownerSubjectId !== subjectId || snapshot.summary === null) {
    return 中性统计;
  }
  const summary = snapshot.summary;
  return {
    open: String(summary.openTotal),
    anonymousScreening: String(summary.openAnonymousScreeningTotal),
    needsAction: String(summary.openNeedsActionTotal),
    archived: String(summary.endedTotal + summary.completedTotal),
    completed: String(summary.completedTotal),
  };
}
```

- [ ] **Step 6: 接线两个“我的”页**

在 `我的.tsx` 把 Backend MatchCase 紧邻注释与 open scope/列表读取块一并替换为：

```ts
// Backend MatchCase 真相源：四项统计与候选代理卡数字只读当前 candidate/owner 的
// 权威 summary。首次加载、每次挂载刷新、失败或 owner 不匹配都显示 —；不回退分页或 Mock。
const P5Scope = P5范围键.summary('candidate');
const 当前SubjectId = 后端状态.主体?.last_used_role === 'candidate'
  ? 后端状态.主体.subject_id
  : null;
const Backend统计 = 取P5Open统计(后端状态.P5摘要.candidate, 当前SubjectId);

useEffect(() => {
  if (!是后端 || 当前SubjectId === null) return;
  操作.设置P5范围('candidate', P5Scope);
  void 操作.加载摘要('candidate').catch(() => undefined);
  return () => 操作.设置P5范围('candidate', null);
}, [是后端, 当前SubjectId, P5Scope, 操作]);
```

候选 Backend 第四格只改数值，不改标题：

```ts
{ 数值: Backend统计.archived, 名称: '已归档', 色: '次要' },
```

候选代理卡原代码逐字保留：

```tsx
{是后端
  ? '当前 MatchCase：' + Backend统计.open
  : '在线 · 正在跟进 ' + 状态.在谈列表.length + ' 个机会'}
```

在 `企业我的.tsx` 把 Backend MatchCase 紧邻注释与读取块一并替换为：

```ts
// Backend MatchCase 真相源：在谈/待拍板/意向达成只读当前 recruiter/owner 的权威
// summary；在招岗位继续读 Job。每次挂载刷新，失败时显示 —，不回退分页或 Mock。
const P5Scope = P5范围键.summary('recruiter');
const 当前SubjectId = 后端状态.主体?.last_used_role === 'recruiter'
  ? 后端状态.主体.subject_id
  : null;
const Backend统计 = 取P5Open统计(后端状态.P5摘要.recruiter, 当前SubjectId);

useEffect(() => {
  if (!是后端 || 当前SubjectId === null) return;
  操作.设置P5范围('recruiter', P5Scope);
  void 操作.加载摘要('recruiter').catch(() => undefined);
  return () => 操作.设置P5范围('recruiter', null);
}, [是后端, 当前SubjectId, P5Scope, 操作]);
```

招聘 Backend 第四格只改数值，不改标题：

```ts
{
  数值: Backend统计.completed,
  名称: '意向达成',
  色: '次要',
},
```

招聘代理卡 JSX 不得修改；尤其不得加 `Backend统计.open` 或 `MatchCase` 文本。

- [ ] **Step 7: 运行“我的”页 GREEN，但暂不提交**

```bash
npx vitest run src/状态/后端/MatchCase统计.test.ts src/屏幕/我的.test.tsx src/屏幕/企业我的.test.tsx
```

Expected：测试 PASS；页面精确显示大于单页上限的数字且没有 `+`。此时 selector 的两个代理详情消费者尚未迁移，禁止提交、禁止运行 typecheck，继续执行 Step 8–11 后原子提交。

#### Task 3 continuation: 迁移两个代理详情页的既有“正在代谈”消费者

**Files:**
- Modify: `src/屏幕/代理详情.tsx`
- Modify: `src/屏幕/代理详情.test.tsx`
- Modify: `src/屏幕/企业代理详情.tsx`
- Modify: `src/屏幕/企业代理详情.test.tsx`

**Self-contained brief:**
- Global Constraints 全量适用。
- Predecessor artifacts：Task 3 Step 1–7 的同一未提交工作树；`取P5Open统计` 接受 `P5摘要快照`，`后端状态.P5摘要.candidate/recruiter` 已存在。
- Produces：两个详情页继续显示现有“正在代谈”标题，只把数字来源改为当前角色已载 summary；详情页绝不注册 scope、绝不调用 `加载摘要`。

- [ ] **Step 8: 把两个详情页测试 fixture 改为 summary**

把 `代理详情.test.tsx` 与 `企业代理详情.test.tsx` 文件头改为“正在代谈只消费当前 owner 的已载 summary，直达无快照显示 —，Mock 保持 legacy 且零 summary operation”；不得再声称读取 unfiltered open 快照。在两个测试文件删除 `P5范围键`、`P5列表项`、`P5列表快照` 和行 fixture，import `P5摘要快照`。候选 fixture：

```ts
function 成功候选摘要(ownerSubjectId = 'sub_1'): P5摘要快照 {
  return {
    ownerSubjectId, 阶段: '成功', 刷新中: false,
    summary: {
      openTotal: 51,
      openAnonymousScreeningTotal: 17,
      openNeedsActionTotal: 9,
      endedTotal: 4,
      completedTotal: 3,
    },
    error: null,
    generation: 1,
  };
}
```

招聘 fixture 使用以下完整代码：

```ts
function 成功招聘摘要(ownerSubjectId = 'sub_r'): P5摘要快照 {
  return {
    ownerSubjectId, 阶段: '成功', 刷新中: false,
    summary: {
      openTotal: 52,
      openAnonymousScreeningTotal: 18,
      openNeedsActionTotal: 8,
      endedTotal: 6,
      completedTotal: 5,
    },
    error: null,
    generation: 1,
  };
}
```

测试上下文把 `加载工作区` spy 改为 `加载摘要`，并把选项字段定义为 `P5摘要?: P5摘要快照`；候选与招聘的后端状态分别写：

```ts
P5摘要: 选项.P5摘要 === undefined ? {} : { candidate: 选项.P5摘要 },
```

```ts
P5摘要: 选项.P5摘要 === undefined ? {} : { recruiter: 选项.P5摘要 },
```

候选成功用例替换为：

```ts
it('已有 summary 时显示精确 open_total，且详情页不注册、不请求', () => {
  置应用状态({ 模式: 'backend', P5摘要: 成功候选摘要() });
  render(<MemoryRouter><代理详情 /></MemoryRouter>);
  expect(screen.getByText('51')).toBeTruthy();
  expect(screen.getByText('正在代谈')).toBeTruthy();
  expect(设置P5范围).not.toHaveBeenCalled();
  expect(加载摘要).not.toHaveBeenCalled();
});
```

招聘镜像用例断言 `52` 与现有“正在代谈”。两端保留直达无快照/owner mismatch=`—` 和 Mock legacy 长度测试，并把零 operation 断言改为 `加载摘要`。

`企业代理详情.test.tsx` 的 owner mismatch 用例逐字替换为：

```ts
it('企业候选列表不进入 Backend 展示：无快照或 owner 不匹配显示 —', () => {
  置应用状态({
    模式: 'backend',
    企业候选列表: [{ 编号: 'A-01' }, { 编号: 'A-02' }, { 编号: 'A-03' }],
    P5摘要: 成功招聘摘要('sub_old'),
    主体: { ...BFF主体样本, subject_id: 'sub_new', last_used_role: 'recruiter' },
  });
  render(<MemoryRouter><企业代理详情 /></MemoryRouter>);
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.queryByText('3')).toBeNull();
  expect(screen.queryByText('52')).toBeNull();
});
```

完成两个测试桩迁移后执行以下静态门禁，必须零匹配：

```bash
rg -n 'P5快照|成功P5快照|加载工作区|招聘行|function 行|P5列表项|P5列表快照|P5范围键' src/屏幕/代理详情.test.tsx src/屏幕/企业代理详情.test.tsx
```

- [ ] **Step 9: 运行代理详情 RED**

```bash
npx vitest run src/屏幕/代理详情.test.tsx src/屏幕/企业代理详情.test.tsx
```

Expected：FAIL，生产页仍从 `P5工作区[P5范围键.open(...)]` 取值。

- [ ] **Step 10: 实现最小消费者迁移**

在 `代理详情.tsx` 删除 `P5范围键` import，把紧邻 Backend MatchCase 注释与 selector 调用一并替换为：

```ts
// Backend MatchCase 真相源：“正在代谈”只消费当前 candidate/owner 已载的权威 summary；
// 本详情页不注册、不请求，直达无快照或 owner 不匹配显示 —，Mock 保持 legacy 长度。
const Backend统计 = 取P5Open统计(后端状态.P5摘要.candidate, 当前SubjectId);
const 在谈数 = 是后端 ? Backend统计.open : 状态.在谈列表.length;
```

在 `企业代理详情.tsx` 删除 `P5范围键` import，把紧邻 Backend MatchCase 注释与 selector 调用一并替换为：

```ts
// Backend MatchCase 真相源：“正在代谈”只消费当前 recruiter/owner 已载的权威 summary；
// 本详情页不注册、不请求，直达无快照或 owner 不匹配显示 —，Mock 保持 legacy 长度。
const Backend统计 = 取P5Open统计(后端状态.P5摘要.recruiter, 当前SubjectId);
const 在谈数 = 是后端 ? Backend统计.open : 状态.企业候选列表.length;
```

不得改两个页面的 `正在代谈`、代理标题、在线文案、规则数字或其它 JSX。

- [ ] **Step 11: 运行 GREEN、typecheck 与原子提交**

```bash
npx vitest run src/数据/招聘数据源/MatchCase.test.ts src/状态/后端/MatchCase操作.test.ts src/状态/后端/MatchCase统计.test.ts src/屏幕/我的.test.tsx src/屏幕/企业我的.test.tsx src/屏幕/代理详情.test.tsx src/屏幕/企业代理详情.test.tsx
npm run typecheck
git add src/状态/后端/MatchCase统计.ts src/状态/后端/MatchCase统计.test.ts src/屏幕/我的.tsx src/屏幕/我的.test.tsx src/屏幕/企业我的.tsx src/屏幕/企业我的.test.tsx src/屏幕/代理详情.tsx src/屏幕/代理详情.test.tsx src/屏幕/企业代理详情.tsx src/屏幕/企业代理详情.test.tsx
git commit -m "feat: show exact matchcase summaries"
```

Expected：全部测试与 typecheck PASS；selector 和四个消费者在同一提交中切换，不留下不可编译中间提交。

---

### Terminal Integration Task: 异构 review、Plan-scope 验收、Backend dogfood 与人工 final gate

**Files:**
- Runtime write only: 本批次 manifest 指定的唯一 Plan Handoff、admission sidecar、`integration-ledger.md`、`integration-result.md`
- Product files: 仅在异构 review 发现并核实了本 Plan 范围内缺陷时修改；修复后提交并重跑受影响测试。

**Self-contained brief:**
- Global Constraints 全量适用。
- Predecessor artifacts：Task 1–3 的三个提交、干净工作树，以及执行提示词提供的仓库外绝对 manifest、Plan Handoff、admission sidecar、ledger、result 路径；开始前必须验证 manifest 为 `handoff_version: 5`、`execution_revision: 1` 且 Plan SHA-256 与当前文件一致。任一路径缺失或 metadata 不一致时停止，不得猜路径。
- 本批次只有一个 Plan；当前 execution owner 在同一 branch/worktree 中成为唯一 integration owner。`integration_requirement: none`，L3 selection 是空集并记录 N/A，不得扩大为 all-L3。

**Runtime file contracts:**

唯一 Plan Handoff 必须逐字包含以下字段；尖括号值由执行时事实替换，不保留占位符：

```yaml
handoff_version: 5
plan_id: fe-mc-01
plan_path: docs/superpowers/plans/2026-09-04-fe-mc-01-matchcase-summary-frontend.md
execution_revision: 1
plan_sha256: <manifest 中的精确 SHA-256>
calibrated_against: none
implementation_status: READY | NOT_READY
implementation_gap: none | <精确缺口>
plan_scope_validation:
  status: PASS | TEST_DEFECT | ENV_BLOCKED | FLAKY | PRODUCT_FAILURE | UNKNOWN
  evidence: <Task、L0-L2、dogfood 的命令与 receipt>
branch: implement-fe-mc-01
commit: <可解析 commit SHA>
worktree: <执行提示词指定的绝对路径>
worktree_status: clean | dirty
base: origin/main@<同步时 SHA>
tests_run:
  diagnostic_or_inner_loop: <命令、结果与 receipt>
  authoritative_plan_scope: <npm test 的结果与 receipt>
performance_observations: []
review_summary: <reviewer、轮次、findings 与处理>
integration_requirement: none
selection_ssot: none
selection_gap: none
l3_selection: []
release_handoff:
  required: false
  owner: none
  required_mode: none
  nightly_only_mode: none
  status: none
  reason: no formal L3 or release responsibility for this frontend wiring
merge_notes: <实现与同步说明>
dependency_drift: none | requires_replan
affected_downstream_plans: none
dependency_drift_summary: none | <变化合同与影响>
replan_handoff: none | <upstream commit、事实、受影响假设与校准接受条件>
```

单 Plan admission sidecar 固定为：

```yaml
admission_version: 1
plan_id: fe-mc-01
upstream_commit: <Plan Handoff 的 commit>
status: BLOCKED
validation_status: PASS | TEST_DEFECT | ENV_BLOCKED | FLAKY | PRODUCT_FAILURE | UNKNOWN
known_gaps: []
allowed_downstream: []
release_effect: none
updated_at: <RFC3339 timestamp>
```

`integration-ledger.md` 至少按 candidate generation 追加 `candidate_generation`、HEAD、input commits、repair commits、每条命令/evidence/receipt、PASS 复用或失效原因、admission N/A、performance observations。`integration-result.md` 至少包含 `integration_status: PENDING | RUNNING | TEST_REPAIR | ENV_BLOCKED | FLAKY | PRODUCT_BLOCKED | PASS`、`release_verdict: PENDING`、target base、最终 generation/HEAD、input/repair commits、L0–L3 evidence、admission N/A、push 命令与结果；未 push 不得写 PASS。

- [ ] **Step 1: 做异构代码 review 并处理 findings**

执行宿主是 Codex 时调用以 Claude 为 reviewer 的多轮 review-loop；执行宿主是 Claude Code 时调用以 Codex 为 reviewer 的对应 review-loop。冻结范围为本 Plan 实现 commit 相对同步后 `origin/main` 的 feature diff。逐条核实 finding，修复所有成立的 Critical/Important/Minor；拒绝不成立 finding 时记录一行证据理由。每轮修复后提交，最多三轮，直到 `NO FINDINGS` 或记录 cap。

- [ ] **Step 2: 运行定向 L0–L2 与唯一权威 Plan-scope gate**

```bash
npx vitest run src/数据/招聘数据源/MatchCase.test.ts src/状态/后端/MatchCase操作.test.ts src/状态/后端/MatchCase统计.test.ts src/屏幕/我的.test.tsx src/屏幕/企业我的.test.tsx src/屏幕/代理详情.test.tsx src/屏幕/企业代理详情.test.tsx
npm run typecheck
npm run lint
npm run build
npm test
```

Expected：五条命令全部退出 0；最后一条 `npm test` 是唯一 `authoritative_plan_scope`，其余记录为 `diagnostic_or_inner_loop` 或基本验证。任何失败先按 test/environment/flaky/product 分类，不得把未运行或阻塞写成 PASS。

- [ ] **Step 3: 运行真实 Backend local dogfood 并记录证据**

使用仓库现有整栈 runner；它负责 bootstrap、fixture、浏览器会话和 cleanup：

```bash
npm run test:agent-browser:backend-local -- --journey candidate-load
npm run test:agent-browser:backend-local -- --journey recruiter-load
```

Expected：两次命令退出 0，报告为 PASS。额外从 runner 打印的本轮绝对报告路径中记录 candidate/recruiter `/api/v1/*/match-cases/summary` 请求是否出现；若现有 journey 没有覆盖“我的”页 summary，使用 `docs/AgentBrowser真实后端验收.md` 的受控本地栈步骤做一次只读探索，记录：进入“我”页、离开后重新进入、两端角色切换、原标题未变、招聘代理卡没有新增 `MatchCase` 文案、P5 列表导航仍可进入。不得修改共享 E2E runner来制造本 Plan 的通过证据。环境无法启动时如实写 `ENV_BLOCKED` 与精确日志，不得伪造 PASS。

- [ ] **Step 4: 写 Plan Handoff 草稿与单 Plan admission**

按 manifest 的 v5 schema 写唯一 Plan Handoff：implementation status/gap、Plan scope validation、branch/commit/worktree、测试与 review、`integration_requirement: none`、`selection_ssot: none`、`selection_gap: none`、`l3_selection: []`、release handoff false/none、dependency drift。重新读取确认完整。

进入本 Terminal Task 后才以 integration owner 身份原子写 admission sidecar：`status: BLOCKED`、`allowed_downstream: []`、`known_gaps: []`、`release_effect: none`。这是单 Plan 没有 downstream consumer 的结构性 N/A，不阻断 final gate。

- [ ] **Step 5: 展示并等待人工 final gate**

向用户展示：target=`origin/main`、当前观察到的 target HEAD、candidate branch/worktree/commit、已完成 review 与 L0–L2 evidence、获批后将再次 fetch/merge、重跑最终受影响验证并普通 fast-forward push。明确提醒“本次完成前不要批准另一个面向同一 target 的 final gate”。然后停止；必须得到用户明确批准后才能继续。

- [ ] **Step 6: 获批后同步、最终验证与普通 push**

严格依序执行：

```bash
git fetch origin
git merge --no-edit origin/main
npm run typecheck
npm run lint
npm run build
npm test
git fetch origin
git rev-parse origin/main
git push origin HEAD:main
```

第一次 fetch 后记录 target SHA；第二次 fetch 后必须确认 `origin/main` 未移动。若移动或 push 被拒绝，不自动追赶、不 force push，重新展示 final gate 并等待批准。只有 push 成功后才能在 `integration-result.md` 写 `integration_status: PASS`；`release_verdict` 固定为 `PENDING`。

最终聊天只返回以下七项简短 verdict，所有详细证据留在固定运行期文件：

```text
1. Implementation readiness：READY | NOT_READY
2. Plan scope validation：PASS | TEST_DEFECT | ENV_BLOCKED | FLAKY | PRODUCT_FAILURE | UNKNOWN
3. 后续 Plan 依赖漂移：无 | 需要校准（PLAN_IDS）
4. Handoff 写入：PASS | FAIL
5. 运行期文件：admission sidecar、integration-ledger.md、integration-result.md 各自 PASS | FAIL
6. L3 selection 写回：N/A（integration_requirement: none）
7. 集成结果：integration_status: PASS | 非 PASS 分类，与 target push SHA | 未 push
```
