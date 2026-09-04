# MatchCase 动作与闭词展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 MatchCase 阶段摘要和 checklist 不泄漏服务端闭词，纠正 `candidate_question` 语义，移除未授权“继续初筛”，并为补充事实提交提供可见 in-flight 状态。

**Architecture:** 在现有 `MatchCase展示映射.ts` 中增加纯展示 allowlist，不改变 decoder、状态矩阵或动作交集；页面动作区只删除 `end_screening` 下错误的 continue 命令，并用独立 state 显示回答提交中。服务端 operation 和权威重读保持原样。

**Tech Stack:** TypeScript、React 18、Vitest、Testing Library。

**Spec:** `docs/superpowers/specs/2026-09-04-frontend-truthfulness-route-state-repair-design.md`

## Global Constraints

- 开始前完整阅读 `CLAUDE.md`、`AGENTS.md` 和 Spec。
- stage `summary` 与 checklist `label` 在公开 OpenAPI 中仍是 `string`；不得收紧 decoder。
- 展示映射不得参与 lifecycle/stage/status、`needs_user`、`available_actions` 或 mutation 判定。
- 可见按钮必须是当前端实现命令、`available_actions` 与既有 17 行状态矩阵的交集。
- 招聘端不得借用候选 `决定S0` 路径。
- 回答成功才清草稿；失败保留；页面不得本地推进 Case。
- 不修改 Hosted Agent failure contract、P5 operation、轮询、session/subject/role fence 或 CSS。
- PM 视觉冻结：不改 CSS、className、内联布局、DOM 布局骨架或区块顺序，不新增 React 组件/组件文件；仅修改现有文案映射、按钮可见性和现有回答区状态。
- 每个 Task 严格执行 red → green → commit。

---

### Task 1: 为 17 个 stage summary 和 8 个 checklist label 建立展示 allowlist

**Files:**
- Modify: `src/数据/MatchCase展示映射.ts`
- Modify: `src/数据/MatchCase展示映射.test.ts`
- Modify: `src/屏幕/P5/MatchCase详情.test.tsx`

**Interfaces:**
- Consumes: `P5阶段区.summary: string`、`checklist[].label: string`。
- Produces: `映射阶段摘要(summary, state): string`、`映射清单(checklist): { 文本, 完成 }[]`；未知 checklist 项省略。

- [ ] **Step 1: 写真实 wire token 的失败测试**

把当前中文 summary/checklist fixture 改为真实 token。建立 17 项期望表：

```ts
const 期望步骤说明 = {
  policy_check: '系统正在核对投递政策',
  candidate_evaluation: '候选方 AI 正在评估岗位',
  candidate_question: '候选方 AI 正在生成补充问题',
  recruiter_answer: '等待招聘方 AI 回答补充问题',
  candidate_reevaluation: '系统正在复评候选信息',
  human_decision: '等待人工决定是否继续',
  complete: '本阶段已完成',
  awaiting_candidate_resume_invitation: '等待候选人回应简历邀请',
  awaiting_resume_parse: '正在解析简历',
  screening_resume: '招聘方 AI 正在初筛已提交简历',
  awaiting_recruiter_decision: '等待招聘方决定',
  coordinating: '双方 AI 正在核对剩余差异',
  awaiting_candidate_decision: '等待候选人确认协同事项',
  awaiting_confirmations: '等待双方确认意向',
  awaiting_candidate_confirmation: '等待候选人确认意向',
  awaiting_recruiter_confirmation: '等待招聘方确认意向',
  handoff_pending: '双方已确认，正在创建会话',
} as const;
```

对每个 key 构造一个合法四阶段详情，将目标阶段 `summary` 设为 key，断言映射后的 `摘要` 等于中文且 JSON/DOM 不含原 token。建立 checklist 表：

```ts
const 期望清单文案 = {
  anonymous_screening_passed: '匿名初筛已通过',
  resume_bound: '简历已绑定',
  resume_parse_ready: '简历已解析',
  resume_disclosed: '简历已披露',
  resume_screened: '简历初筛已完成',
  differences_resolved: '分歧已核对',
  candidate_confirmed: '候选人已确认',
  recruiter_confirmed: '招聘方已确认',
} as const;
```

未知 summary `secret_internal_step` 显示“阶段信息待更新”；空 summary 使用阶段状态中性文案；未知 checklist `secret_internal_check` 被省略。断言 `available_actions` 和 `state` 与输入完全相同。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/数据/MatchCase展示映射.test.ts src/屏幕/P5/MatchCase详情.test.tsx
```

Expected: 当前 `区.summary`、`项.label` 原样进入视图和 DOM，`candidate_question` 文案错误。

- [ ] **Step 3: 实现纯展示映射**

复用现有 `步骤说明表` 作为 summary allowlist，并修改 `candidate_question` 值。增加 checklist allowlist：

```ts
const 清单文案表 = {
  anonymous_screening_passed: '匿名初筛已通过',
  resume_bound: '简历已绑定',
  resume_parse_ready: '简历已解析',
  resume_disclosed: '简历已披露',
  resume_screened: '简历初筛已完成',
  differences_resolved: '分歧已核对',
  candidate_confirmed: '候选人已确认',
  recruiter_confirmed: '招聘方已确认',
} as const;

function 已有键<T extends object>(表: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(表, key);
}

function 映射阶段摘要(summary: string, state: P5阶段区['state']): string {
  if (summary === '') return 阶段区状态文案表[state];
  return 已有键(步骤说明表, summary) ? 步骤说明表[summary] : '阶段信息待更新';
}

function 映射清单(checklist: P5阶段区['checklist']) {
  return checklist.flatMap((项) =>
    已有键(清单文案表, 项.label)
      ? [{ 文本: 清单文案表[项.label], 完成: 项.done }]
      : [],
  );
}
```

`映射阶段区` 改为调用两函数。不要改 `P5阶段区块视图` 类型、wire decoder、矩阵或动作卡。

- [ ] **Step 4: 运行并提交**

```bash
npx vitest run src/数据/MatchCase展示映射.test.ts src/屏幕/P5/MatchCase详情.test.tsx
git add src/数据/MatchCase展示映射.ts src/数据/MatchCase展示映射.test.ts src/屏幕/P5/MatchCase详情.test.tsx
git commit -m "fix: map matchcase display tokens safely"
```

Expected: PASS。

### Task 2: `end_screening` 只保留候选端“结束初筛”

**Files:**
- Modify: `src/屏幕/P5/MatchCase详情.tsx`
- Modify: `src/屏幕/P5/MatchCase详情.test.tsx`

**Interfaces:**
- Consumes: 已映射 `end_screening` 动作卡和 candidate role。
- Produces: 一枚带现有确认层的“结束初筛”按钮；零 continue 命令。

- [ ] **Step 1: 改写错误固化测试**

替换当前“继续/结束两条 S0 决定”用例：

```tsx
it('respond_fact + end_screening 只有补充事实与结束动作，没有继续初筛', async () => {
  const user = userEvent.setup();
  置详情状态({
    role: 'candidate',
    快照: 详情快照({
      detail: 候选详情DTO({ availableActions: ['respond_fact', 'end_screening'] }),
    }),
  });
  渲染详情('candidate', 'mc_direct');

  expect(screen.queryByRole('button', { name: '继续初筛' })).toBeNull();
  expect(screen.getByRole('textbox', { name: '回答问题' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: '结束初筛' }));
  expect(mock决定S0).not.toHaveBeenCalled();
  const 确认框 = screen.getByRole('dialog');
  await user.click(within(确认框).getByRole('button', { name: '结束初筛' }));
  expect(mock决定S0).toHaveBeenCalledTimes(1);
  expect(mock决定S0).toHaveBeenCalledWith('mc_direct', 'end');
});
```

保留招聘端 `end_screening` 零控件/零请求测试，并遍历十个动作断言每枚可见按钮都有 operation 路线。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/屏幕/P5/MatchCase详情.test.tsx
```

Expected: “继续初筛”仍出现且会调用 `决定S0(caseId, 'continue')`。

- [ ] **Step 3: 删除错误按钮和命令**

```tsx
case 'end_screening':
  return role !== 'candidate' ? null : (
    <div style={键行样式}>
      <button
        type="button"
        className="可点"
        style={动作次键样式}
        disabled={写中}
        onClick={确认结束初筛}
      >
        结束初筛
      </button>
    </div>
  );
```

不要删除 `决定S0(..., 'continue')` 类型或 operation：其它合法流程若使用它不在本 Plan 重构；只删除此错误 UI 路径。

- [ ] **Step 4: 运行并提交**

```bash
npx vitest run src/屏幕/P5/MatchCase详情.test.tsx
git add src/屏幕/P5/MatchCase详情.tsx src/屏幕/P5/MatchCase详情.test.tsx
git commit -m "fix: remove unauthorized screening continuation"
```

Expected: PASS。

### Task 3: 补充事实提交显示独立 in-flight 状态

**Files:**
- Modify: `src/屏幕/P5/MatchCase详情.tsx`
- Modify: `src/屏幕/P5/MatchCase详情.test.tsx`

**Interfaces:**
- Consumes: `操作.回答事实(role, caseId, promptId, body): Promise<void>`。
- Produces: `回答提交中: boolean`；ref 继续作为同步重入锁。

- [ ] **Step 1: 写 pending/resolve/reject 失败测试**

```tsx
it('回答 pending 时禁用输入和按钮、显示提交中且拒绝重复请求', async () => {
  const deferred = 可控Promise<void>();
  mock回答事实.mockReturnValueOnce(deferred.promise);
  渲染详情('candidate', 'mc_direct');
  const input = screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement;
  await userEvent.type(input, '每周可以到岗 3 天');
  await userEvent.click(screen.getByRole('button', { name: '提交回答' }));
  expect(input.disabled).toBe(true);
  expect((screen.getByRole('button', { name: '提交中…' }) as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: '提交中…' }));
  expect(mock回答事实).toHaveBeenCalledTimes(1);
  deferred.resolve();
  await waitFor(() => expect(input.value).toBe(''));
});

it('回答失败恢复输入并保留草稿', async () => {
  mock回答事实.mockRejectedValueOnce(new Error('failed'));
  渲染详情('candidate', 'mc_direct');
  const input = screen.getByRole('textbox', { name: '回答问题' }) as HTMLTextAreaElement;
  await userEvent.type(input, '保留这段回答');
  await userEvent.click(screen.getByRole('button', { name: '提交回答' }));
  await waitFor(() => expect((screen.getByRole('button', { name: '提交回答' }) as HTMLButtonElement).disabled).toBe(false));
  expect(input.value).toBe('保留这段回答');
});
```

在测试文件本地加入以下 helper（若已有同名实现则直接复用，不重复定义）：

```ts
function 可控Promise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/屏幕/P5/MatchCase详情.test.tsx
```

Expected: 请求虽由 ref 单飞，但 textarea/按钮没有可见 pending 状态。

- [ ] **Step 3: 实现独立可渲染状态**

```tsx
const [回答提交中, 设回答提交中] = useState(false);
const 回答在飞 = useRef(false);
const 回答代际 = useRef(0);

useEffect(() => {
  回答代际.current += 1;
  回答在飞.current = false;
  设回答提交中(false);
  设回答草稿('');
  return () => { 回答代际.current += 1; };
}, [caseId]);

const 发回答 = () => {
  const 内容 = 回答草稿.trim();
  const 问题 = 视图.补充问题;
  if (内容 === '' || 问题 === null || caseId === '' || 回答在飞.current) return;
  const 本轮 = 回答代际.current;
  回答在飞.current = true;
  设回答提交中(true);
  操作.回答事实(role, caseId, 问题.promptId, 内容)
    .then(() => {
      if (回答代际.current === 本轮) 设回答草稿('');
    })
    .catch((错误: unknown) => {
      if (回答代际.current === 本轮) 报错(错误);
    })
    .finally(() => {
      if (回答代际.current === 本轮) {
        回答在飞.current = false;
        设回答提交中(false);
      }
    });
};
```

渲染：

```tsx
<textarea
  aria-label="回答问题"
  value={回答草稿}
  disabled={回答提交中}
  onChange={(事件) => 设回答草稿(事件.target.value)}
/>
<button type="button" disabled={回答提交中} onClick={发回答}>
  {回答提交中 ? '提交中…' : '提交回答'}
</button>
```

新增一条切换 Case 的 deferred 测试：旧请求完成后，新 Case 的草稿与 pending 状态不变。不要复用 `写中`，不要本地重建详情。

- [ ] **Step 4: 运行并提交**

```bash
npx vitest run src/屏幕/P5/MatchCase详情.test.tsx
git add src/屏幕/P5/MatchCase详情.tsx src/屏幕/P5/MatchCase详情.test.tsx
git commit -m "fix: show matchcase answer submission state"
```

Expected: PASS。

### Task 4: 运行 MatchCase 联合验证

**Files:**
- Test: all files changed by this Plan

**Interfaces:**
- Consumes: Tasks 1–3。
- Produces: 映射、动作和页面状态联合回归证据。

- [ ] **Step 1: 运行定向测试**

```bash
npx vitest run src/数据/MatchCase展示映射.test.ts src/屏幕/P5/MatchCase详情.test.tsx src/状态/后端/MatchCase操作.test.ts
npm run typecheck
npm run lint
```

Expected: 全部 PASS / exit 0。

- [ ] **Step 2: 检查状态/动作未漂移**

在测试输出和 diff 中确认：

```text
P5展示状态矩阵行数 = 17
available_actions 顺序与交集逻辑未改
P5 operation 文件未改
轮询与权威重读文件未改
招聘 end_screening 仍零控件
```

- [ ] **Step 3: 检查工作树**

```bash
git diff --check
git status --short
```

Expected: 无未提交文件。

## Plan Completion Check

- [ ] 17 个 summary token 和 8 个 checklist token 均有固定中文映射。
- [ ] 未知 token 不进入 DOM，未知 checklist 按设计省略。
- [ ] `candidate_question` 与 human decision/`respond_fact` 人类待办明确区分。
- [ ] `end_screening` 不再产生 continue 命令，招聘端不借用候选路线。
- [ ] 回答 pending 可见且锁输入；失败保留草稿，成功才清空，重复点击零额外请求。
- [ ] 实现范围的 `git diff --name-only` 不含 CSS/产品组件新文件；非测试产品代码的 diff 不含 className、内联布局或页面骨架改动，也没有新增 React 组件声明。
