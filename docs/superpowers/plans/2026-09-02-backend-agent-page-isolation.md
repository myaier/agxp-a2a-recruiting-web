# Backend Agent Page Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the existing Mock Agent prototype intact while making both Backend Agent pages read-only, truthful navigation hubs with no fixture content, send input, delayed reply, or Mock fallback.

**Architecture:** Put a synchronous `数据源模式` branch at each page entry before any Mock state/effect is mounted. Move the current prototype body unchanged into a Mock-only function, render Backend copy and three role-correct actions in the page's existing bubble/quick-action slots, and make every Backend-reachable entry describe the destination as Agent functionality rather than live chat.

**Tech Stack:** React 19, TypeScript, React Router, Vitest, Testing Library, Vite.

**Spec:** `docs/superpowers/specs/2026-09-02-frontend-truthfulness-batch-design.md`

**Execution order:** This is Slice 3 of 3. Start only after Slices 1 and 2 are committed in the same worktree; use named symbols rather than frozen numeric line anchors where prior slices moved code. Do not run a parallel writer.

## Global Constraints

- Frontend baseline is `origin/main@b2827dae16e89b199b487ab1564246b7b66e34f6`.
- Backend contract baseline is `release/0.2.5@45f7323e34f6f6db11faee658144e28d338b36be`.
- Do not modify runtime files under `src/组件/**`; the existing `src/组件/候选筛选抽屉.test.tsx` may change because it contains cross-page Agent assertions.
- Do not create a visual component, add a route, or modify CSS.
- Reuse `次级页外壳`, `返回栏`, `代理气泡`, `.对话流`, `.对话内容`, `.快捷行`, and `.快捷键` exactly where they already appear.
- Visible changes are limited to Backend-only copy, conditional visibility, and existing-button navigation. Mock copy and layout stay unchanged.
- Backend mode must not initialize fixture conversation state, render fixture statistics/funnel/dialogue/quick questions/input, schedule a reply timer, or dispatch a Mock rule mutation.
- A network error, logout, hydration state, or data-source transition must never select the Mock branch as a fallback.
- Follow TDD and commit every independently testable task.

## File Responsibility Map

- `src/屏幕/问AI代理.tsx`: mode-first candidate page branch, Mock timer ownership, and candidate Backend destinations.
- `src/屏幕/问AI代理.test.tsx`: candidate Backend DOM absence, role-correct actions, Mock preservation, and mode-switch timer isolation.
- `src/屏幕/企业问AI代理.tsx`: mode-first recruiter page branch, Mock timer ownership, and recruiter Backend destinations.
- `src/屏幕/企业问AI代理.test.tsx`: recruiter Backend DOM absence, role-correct actions, Mock preservation, and mode-switch timer isolation.
- `src/组件/候选筛选抽屉.test.tsx`: replace the now-invalid Backend interaction assertion; retain the Mock rule-mutation assertion.
- `src/屏幕/候选推荐.tsx`, `src/屏幕/看市场.tsx`, `src/屏幕/在谈首页.tsx`, `src/屏幕/企业在谈候选.tsx`: change Backend Agent-banner action copy through the existing `动作文` prop.
- `src/屏幕/帮助与客服.tsx`, `src/屏幕/直聊会话.tsx`: make Backend-reachable explanatory text/action labels truthful without changing markup or styles.
- `src/屏幕/候选推荐.test.tsx`, `src/屏幕/看市场.test.tsx`: focused entry-copy regression assertions in already-owned screen tests; the two thin P5 parent screens are covered by the explicit route-callsite source audit.

---

### Task 1: Isolate the Candidate Agent Page Before Mock State Mounts

**Files:**
- Create: `src/屏幕/问AI代理.test.tsx`
- Modify: `src/屏幕/问AI代理.tsx:12-151`
- Modify: `src/屏幕/看市场.test.tsx:228-250`

**Interfaces:**
- Consumes: `数据源模式`, `派发`, `use导航`, `路径.主壳`, and `路径.规则库`.
- Produces: no exported API; Backend actions select the existing candidate shell destination and navigate through existing routes.

- [ ] **Step 1: Add a page test harness with switchable application mode**

Create `问AI代理.test.tsx` with hoisted navigation/application spies. The provider result must be read from a mutable variable on every render so `rerender` can simulate a source switch:

```tsx
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 问AI代理 from './问AI代理';
import { 路径 } from '../路由/路径表';
import { 快捷问句 } from '../数据/模拟数据';

const mock派发 = vi.fn();
const mock返回 = vi.fn();
const mock跳转 = vi.fn();
const mock替换跳转 = vi.fn();
let 当前模式: 'mock' | 'backend' = 'backend';

vi.mock('../状态/应用状态', () => ({
  use应用状态: () => ({
    数据源模式: 当前模式,
    派发: mock派发,
    状态: {
      基本信息: { 真名: '沈亦舟' },
      引导预填: null,
    },
  }),
}));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({
    返回: mock返回,
    跳转: mock跳转,
    替换跳转: mock替换跳转,
  }),
}));
vi.mock('../组件/轻提示', () => ({ 轻提示: vi.fn() }));

beforeEach(() => {
  当前模式 = 'backend';
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});
```

- [ ] **Step 2: Write failing Backend absence and navigation tests**

```tsx
it('Backend only renders truthful read-only guidance', () => {
  render(<问AI代理 />);
  expect(screen.getByText(/真实匹配与委托请从「市场」进入/)).toBeTruthy();
  expect(screen.queryByText('今日简报')).toBeNull();
  expect(screen.queryByText(/已接触前 3 家/)).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.queryByRole('button', { name: '发送' })).toBeNull();
});

it.each([
  ['去市场', [{ 型: '切Tab', Tab: '职位' }, { 型: '切子视图', 子视图: '看市场' }], 路径.主壳],
  ['看在谈', [{ 型: '切Tab', Tab: '职位' }, { 型: '切子视图', 子视图: '在谈' }], 路径.主壳],
] as const)('%s selects the candidate shell destination', async (name, actions, target) => {
  render(<问AI代理 />);
  await userEvent.click(screen.getByRole('button', { name }));
  expect(mock派发.mock.calls.map(([action]) => action)).toEqual(actions);
  expect(mock替换跳转).toHaveBeenCalledWith(target);
});

it('规则库 uses the canonical candidate route', async () => {
  render(<问AI代理 />);
  await userEvent.click(screen.getByRole('button', { name: '规则库' }));
  expect(mock跳转).toHaveBeenCalledWith(路径.规则库);
});
```

- [ ] **Step 3: Write failing Mock preservation and queued-timer isolation tests**

```tsx
it('Mock keeps the briefing, quick questions, and send input', () => {
  当前模式 = 'mock';
  render(<问AI代理 />);
  expect(screen.getByText('今日简报')).toBeTruthy();
  expect(screen.getByRole('textbox')).toBeTruthy();
  expect(screen.getByRole('button', { name: 快捷问句[0] })).toBeTruthy();
});

it('switching Mock to Backend cancels a queued fake reply', async () => {
  vi.useFakeTimers();
  当前模式 = 'mock';
  const page = render(<问AI代理 />);
  await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
    screen.getByRole('button', { name: 快捷问句[0] }),
  );
  当前模式 = 'backend';
  page.rerender(<问AI代理 />);
  await act(() => vi.advanceTimersByTimeAsync(550));
  expect(screen.queryByText(/搜到 7 个全远程/)).toBeNull();
  expect(screen.queryByText('今日简报')).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
});
```

Replace the existing cross-page Backend test in `看市场.test.tsx` that clicks `改成可谈`; that control is intentionally absent after the mode-first split. Merge it with the adjacent Mock assertion:

```tsx
it('问AI代理：Backend 不挂载模拟规则动作，Mock 仍可改成可谈', async () => {
  置应用状态({ 模式: 'backend', 状态: { 基本信息: { 真名: '测试' } } });
  const page = render(<问AI代理 />);
  expect(screen.queryByRole('button', { name: '改成可谈' })).toBeNull();
  expect(mock派发).not.toHaveBeenCalled();

  置应用状态({ 模式: 'mock', 状态: { 基本信息: { 真名: '测试' } } });
  page.rerender(<问AI代理 />);
  await userEvent.click(screen.getByRole('button', { name: '改成可谈' }));
  expect(mock派发).toHaveBeenCalledWith({
    型: '新增规则',
    内容: 今日简报.松一档.规则内容,
    来源: 今日简报.松一档.规则来源,
  });
  expect(mock跳转).not.toHaveBeenCalledWith(路径.规则库);
  expect(mock轻提示).toHaveBeenCalledWith('已记成规则');
});
```

Delete the now-duplicate adjacent Mock-only test after merging its assertions.

- [ ] **Step 4: Run the new tests and confirm the Backend branch fails**

```bash
npm run test -- src/屏幕/问AI代理.test.tsx
```

Expected: Backend still renders `今日简报` and the textbox, and its destination buttons do not exist.

- [ ] **Step 5: Split the entry from the Mock-only body and own timer cleanup**

Keep the default export as the mode gate:

```tsx
export default function 问AI代理() {
  const { 数据源模式 } = use应用状态();
  return 数据源模式 === 'backend' ? <Backend问AI代理 /> : <Mock问AI代理 />;
}
```

Move the current page implementation, including salary fallback, `改成可谈`, conversation state, scroll effect, render tree, and existing `简报气泡`, into `Mock问AI代理` without changing its visible output. Replace the bare reply timeout with an owned handle:

```tsx
const 回复定时器 = useRef<Set<number>>(new Set());

useEffect(() => () => {
  回复定时器.current.forEach((handle) => window.clearTimeout(handle));
  回复定时器.current.clear();
}, []);

const handle = window.setTimeout(() => {
  回复定时器.current.delete(handle);
  设对话((旧) => [...旧, { 编号: 时刻 + 1, 角色: '代理', 内容: 生成回复(内容, 薪资底线K) }]);
}, 550);
回复定时器.current.add(handle);
```

Backend mode must use only the existing classes and elements:

```tsx
function Backend问AI代理() {
  const { 返回, 跳转, 替换跳转 } = use导航();
  const { 派发 } = use应用状态();
  const 去主壳 = (子视图: '看市场' | '在谈') => {
    派发({ 型: '切Tab', Tab: '职位' });
    派发({ 型: '切子视图', 子视图 });
    替换跳转(路径.主壳);
  };

  return (
    <次级页外壳 对话底 白底>
      <返回栏
        返回={返回}
        标题="我的求职AI代理"
        右侧={<button className={`${样式.更多} 可点`} onClick={() => 跳转(路径.代理详情)}>⋯</button>}
      />
      <div className={`${样式.对话流} 滚动区`}>
        <div className={样式.对话内容}>
          <代理气泡 内容="真实匹配与委托请从「市场」进入，真实阶段请到「在谈」查看，长期规则请到「规则库」设置。当前 Backend 模式暂不提供自由对话、日报和漏斗。" />
        </div>
      </div>
      <div className={样式.快捷行}>
        <button className={`${样式.快捷键} 可点`} onClick={() => 去主壳('看市场')}>去市场</button>
        <button className={`${样式.快捷键} 可点`} onClick={() => 去主壳('在谈')}>看在谈</button>
        <button className={`${样式.快捷键} 可点`} onClick={() => 跳转(路径.规则库)}>规则库</button>
      </div>
    </次级页外壳>
  );
}
```

Do not render `真输入条`. Preserve the existing ellipsis Agent-detail action and route in the `返回栏`; it is an existing non-chat destination and removing it would change the visual structure unnecessarily.

- [ ] **Step 6: Run and commit the candidate page**

```bash
npm run test -- src/屏幕/问AI代理.test.tsx src/屏幕/看市场.test.tsx
git add src/屏幕/问AI代理.tsx src/屏幕/问AI代理.test.tsx src/屏幕/看市场.test.tsx
git commit -m "fix: isolate candidate backend agent page"
```

---

### Task 2: Isolate the Recruiter Agent Page Before Mock State Mounts

**Files:**
- Create: `src/屏幕/企业问AI代理.test.tsx`
- Modify: `src/屏幕/企业问AI代理.tsx:12-164`
- Modify: `src/组件/候选筛选抽屉.test.tsx:154-173`

**Interfaces:**
- Consumes: `数据源模式`, `派发`, `use导航`, `路径.企业主壳`, and `路径.企业代理设置`.
- Produces: no exported API; Backend actions select existing recruiter shell destinations and never expose Mock rule actions.

- [ ] **Step 1: Mirror the candidate harness and write failing Backend tests**

Create `企业问AI代理.test.tsx` with the same mutable-mode, navigation, and application-state harness as Task 1. Its state is:

```tsx
状态: {
  企业认证: { 姓名: '邵铭', 公司: '云衢科技', 职务: '技术 VP' },
  招聘头像: null,
},
```

Assert the recruiter-specific contract:

```tsx
it('Backend only renders truthful recruiter guidance', () => {
  render(<企业问AI代理 />);
  expect(screen.getByText(/真实匹配与委托请从「推荐」进入/)).toBeTruthy();
  expect(screen.queryByText('今日简报')).toBeNull();
  expect(screen.queryByText('在谈 5')).toBeNull();
  expect(screen.queryByText(/已接触前 3 家/)).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.queryByRole('button', { name: '发送' })).toBeNull();
});

it.each([
  ['看推荐', [{ 型: '企业切Tab', Tab: '人才' }, { 型: '企业切子视图', 子视图: '推荐' }]],
  ['看在谈', [{ 型: '企业切Tab', Tab: '人才' }, { 型: '企业切子视图', 子视图: '在谈' }]],
] as const)('%s selects the recruiter shell destination', async (name, actions) => {
  render(<企业问AI代理 />);
  await userEvent.click(screen.getByRole('button', { name }));
  expect(mock派发.mock.calls.map(([action]) => action)).toEqual(actions);
  expect(mock替换跳转).toHaveBeenCalledWith(路径.企业主壳);
});

it('AI代理设置 uses the canonical recruiter route', async () => {
  render(<企业问AI代理 />);
  await userEvent.click(screen.getByRole('button', { name: 'AI代理设置' }));
  expect(mock跳转).toHaveBeenCalledWith(路径.企业代理设置);
});
```

- [ ] **Step 2: Add Mock preservation and source-switch timer tests**

Assert Mock still shows `今日简报`, the funnel row `硬性匹配`, a textbox, and the first value from `企业快捷问句`. Send that quick question under fake timers, switch the mutable mode to Backend, rerender, advance 550 ms, and assert the generated funnel reply and all Mock fixtures remain absent.

- [ ] **Step 3: Replace the obsolete cross-page Backend assertion**

In `候选筛选抽屉.test.tsx`, delete the test that clicks Backend `放宽薪资带`; that control must no longer exist. Replace it with:

```tsx
it('企业问AI代理：Backend 不挂载模拟规则动作，Mock 仍可放宽薪资带', async () => {
  置应用状态({ 模式: 'backend', 状态: 招聘页状态() });
  const page = render(<企业问AI代理 />);
  expect(screen.queryByRole('button', { name: '放宽薪资带' })).toBeNull();
  expect(mock派发).not.toHaveBeenCalled();

  置应用状态({ 模式: 'mock', 状态: 招聘页状态() });
  page.rerender(<企业问AI代理 />);
  await userEvent.click(screen.getByRole('button', { name: '放宽薪资带' }));
  expect(mock派发).toHaveBeenCalledWith({
    型: '企业新增规则',
    内容: 企业日报.松一档.规则内容,
    来源: 企业日报.松一档.规则来源,
  });
  expect(mock跳转).toHaveBeenCalledWith(路径.企业代理设置);
});
```

Remove the adjacent duplicate Mock-only test after merging its assertion into this test.

- [ ] **Step 4: Run the tests and confirm current Backend behavior fails**

```bash
npm run test -- src/屏幕/企业问AI代理.test.tsx src/组件/候选筛选抽屉.test.tsx
```

Expected: the Backend page still renders its fixture briefing/funnel/input and exposes `放宽薪资带`.

- [ ] **Step 5: Implement the recruiter mode gate and Mock-owned timer**

Mirror Task 1:

```tsx
export default function 企业问AI代理() {
  const { 数据源模式 } = use应用状态();
  return 数据源模式 === 'backend' ? <Backend企业问AI代理 /> : <Mock企业问AI代理 />;
}
```

Move the current body unchanged into `Mock企业问AI代理`, track/clear every `window.setTimeout` handle there, and render this Backend body through existing slots:

```tsx
function Backend企业问AI代理() {
  const { 返回, 跳转, 替换跳转 } = use导航();
  const { 派发 } = use应用状态();
  const 去主壳 = (子视图: '推荐' | '在谈') => {
    派发({ 型: '企业切Tab', Tab: '人才' });
    派发({ 型: '企业切子视图', 子视图 });
    替换跳转(路径.企业主壳);
  };

  return (
    <次级页外壳 对话底 白底>
      <返回栏
        返回={返回}
        标题="我的招聘AI代理"
        右侧={<button className={`${样式.更多} 可点`} onClick={() => 跳转(路径.企业代理详情)}>⋯</button>}
      />
      <div className={`${样式.对话流} 滚动区`}>
        <div className={样式.对话内容}>
          <代理气泡 内容="真实匹配与委托请从「推荐」进入，真实阶段请到「在谈」查看，长期规则请到「AI 代理设置」提交。当前 Backend 模式暂不提供自由对话、日报和漏斗。" />
        </div>
      </div>
      <div className={样式.快捷行}>
        <button className={`${样式.快捷键} 可点`} onClick={() => 去主壳('推荐')}>看推荐</button>
        <button className={`${样式.快捷键} 可点`} onClick={() => 去主壳('在谈')}>看在谈</button>
        <button className={`${样式.快捷键} 可点`} onClick={() => 跳转(路径.企业代理设置)}>AI代理设置</button>
      </div>
    </次级页外壳>
  );
}
```

The recruiter Backend branch omits `真输入条`, funnel, briefing, and rule mutation controls. Preserve the existing ellipsis Agent-detail action and route in the `返回栏`.

- [ ] **Step 6: Run and commit the recruiter page**

```bash
npm run test -- src/屏幕/企业问AI代理.test.tsx src/组件/候选筛选抽屉.test.tsx
git add src/屏幕/企业问AI代理.tsx src/屏幕/企业问AI代理.test.tsx src/组件/候选筛选抽屉.test.tsx
git commit -m "fix: isolate recruiter backend agent page"
```

---

### Task 3: Make Every Backend-Reachable Agent Entry Truthful

**Files:**
- Modify: `src/屏幕/候选推荐.tsx:100-105,327-332`
- Modify: `src/屏幕/看市场.tsx:326-331,388`
- Modify: `src/屏幕/在谈首页.tsx:109-113,191-195`
- Modify: `src/屏幕/企业在谈候选.tsx:116-120,212-216`
- Modify: `src/屏幕/帮助与客服.tsx:10-27,64-73`
- Modify: `src/屏幕/直聊会话.tsx:113-121`
- Modify: `src/屏幕/候选推荐.test.tsx`
- Modify: `src/屏幕/看市场.test.tsx`

**Interfaces:**
- Consumes: existing `数据源模式`, existing `代理横幅.动作文`, and existing Agent-page routes.
- Produces: Backend-visible action copy `查看代理功能 ›` (or `查看代理功能` where the existing button style does not append a chevron); Mock continues to say `问AI代理 ›` and retains all prototype promises.

- [ ] **Step 1: Add failing Backend-versus-Mock banner assertions**

Add one assertion at the existing render point in each owned test:

```tsx
// Backend branch
expect(screen.getByRole('button', { name: /查看代理功能/ })).toBeTruthy();
expect(screen.queryByRole('button', { name: /问AI代理/ })).toBeNull();

// Mock branch
expect(screen.getByRole('button', { name: /问AI代理/ })).toBeTruthy();
```

Place recruiter recommendation coverage in `候选推荐.test.tsx` and candidate market coverage in `看市场.test.tsx`. `在谈首页.tsx` and `企业在谈候选.tsx` are thin mode-split parents without dedicated suites; pin their exact Backend `动作文` props in the source audit in Step 4. These tests must not snapshot CSS or DOM structure.

- [ ] **Step 2: Pass mode-specific action copy through existing banners**

Do not modify `代理横幅`. At mixed-mode call sites use:

```tsx
动作文={数据源模式 === 'backend' ? '查看代理功能 ›' : undefined}
```

At call sites already split into `Backend...` and `Mock...` functions, pass `动作文="查看代理功能 ›"` only in the Backend function and leave the Mock call unchanged. Apply this to candidate/recruiter recommendation, market, and Case-list screens.

- [ ] **Step 3: Correct non-banner Backend copy without changing markup**

`帮助与客服.tsx` is mixed mode. Read `数据源模式` from `use应用状态`; preserve the entire current客服 card in Mock, but in Backend change only its existing description and primary button text:

```tsx
const 是Backend = 数据源模式 === 'backend';

// Existing description node
{是Backend
  ? '当前 Backend 模式不提供 AI 代理自由对话。真实匹配请到市场，真实阶段请到在谈查看；账号、认证和投诉问题可转人工。'
  : '先问你的 AI 代理 —— 它知道你每一单的上下文，能直接告诉你这一单卡在哪。涉及账号、认证、投诉的问题再转人工。'}

// Existing primary button
{是Backend ? '查看 AI 代理功能' : '问我的 AI 代理'}
```

`直聊会话.tsx` already has `是后端`. In its existing旁听 text/button slots use:

```tsx
{是后端
  ? '当前 Backend 模式不提供 AI 代理自由对话；真实阶段请到「在谈」查看'
  : '你选择了自己聊，AI代理在旁听：只提醒、不插话'}
```

and `是后端 ? '查看代理功能' : '交回AI代理'`. Keep the existing route and button classes.

Do not modify `消息列表.tsx` or `企业消息.tsx`: both default exports choose `Backend会话列表` before their `Mock...` bodies mount, so their Agent fixture rows and Agent routes are not Backend-reachable.

- [ ] **Step 4: Run focused entry tests and source-audit all route call sites**

```bash
npm run test -- \
  src/屏幕/候选推荐.test.tsx \
  src/屏幕/看市场.test.tsx

rg -n -C 3 '路径\.(问AI代理|企业问AI代理)' src/屏幕
rg -n -C 6 '动作文="查看代理功能 ›"' \
  src/屏幕/在谈首页.tsx src/屏幕/企业在谈候选.tsx
```

For every remaining result, prove one of these in the code review notes:

1. it is inside a `Mock...` body unreachable from Backend mode;
2. its Backend-visible action says `查看代理功能`; or
3. it is a route declaration/import rather than user-facing copy.

Expected remaining Mock-only results include `Mock消息列表` and `Mock企业消息`. Do not change them.
The second command must show exactly the Backend parent branch in each file; the Mock branch must still omit `动作文` and inherit `问AI代理 ›`.

- [ ] **Step 5: Commit the entry-copy audit**

```bash
git add \
  src/屏幕/候选推荐.tsx src/屏幕/候选推荐.test.tsx \
  src/屏幕/看市场.tsx src/屏幕/看市场.test.tsx \
  src/屏幕/在谈首页.tsx src/屏幕/企业在谈候选.tsx \
  src/屏幕/帮助与客服.tsx src/屏幕/直聊会话.tsx
git commit -m "fix: clarify backend agent entry points"
```

---

### Task 4: Verify Isolation, Visual Freeze, and Production Output

**Files:**
- Verify all files changed in Tasks 1-3.

- [ ] **Step 1: Run the complete Agent-isolation test set**

```bash
npm run test -- \
  src/屏幕/问AI代理.test.tsx \
  src/屏幕/企业问AI代理.test.tsx \
  src/组件/候选筛选抽屉.test.tsx \
  src/屏幕/候选推荐.test.tsx \
  src/屏幕/看市场.test.tsx
```

Expected: Mock interactions pass; Backend DOM contains no fixture briefing/funnel/dialogue/input and all role-correct CTA assertions pass.

- [ ] **Step 2: Run static Backend-fake-content guards on the mode branches**

Review both page entries and prove that `useState(代理对话初始...)`, fixture rendering, and `window.setTimeout` exist only under `Mock问AI代理`/`Mock企业问AI代理`. Then run:

```bash
rg -n '今日简报|在谈 5|已接触前 3 家|真输入条|setTimeout' \
  src/屏幕/问AI代理.tsx src/屏幕/企业问AI代理.tsx
```

Expected: textual matches remain because Mock is intentionally preserved; inspection confirms none occur in either `Backend...` function.

- [ ] **Step 3: Enforce the visual freeze**

```bash
test -z "$(git diff b2827dae16e89b199b487ab1564246b7b66e34f6...HEAD --name-only -- '*.css' '*.module.css')"
test -z "$(git diff b2827dae16e89b199b487ab1564246b7b66e34f6...HEAD --name-only -- 'src/组件/*.tsx' 'src/组件/**/*.tsx' | rg -v '\.test\.tsx$')"
git diff --check
```

Expected: no CSS or runtime shared-component changes and no whitespace errors.

- [ ] **Step 4: Run repository gates**

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: all exit zero.

- [ ] **Step 5: Commit only if verification required a correction**

```bash
git status --short
git add path/to/each-file-corrected-during-verification
git commit -m "test: harden backend agent isolation"
```

Skip the commit when the working tree is clean.

## Slice Completion Evidence

Before handing this slice to the integration owner, record:

- exact targeted-test command and passing count;
- `typecheck`, `lint`, and `build` exit status;
- the Agent-route `rg` audit classification;
- visual-freeze guard output;
- candidate/recruiter Backend DOM absence assertions;
- Mock mode smoke result;
- commit SHAs created by Tasks 1-3.

Do not claim browser acceptance here. The integration owner performs the final `VITE_DATA_SOURCE=backend` browser walkthrough against the frozen backend environment after all three slices are combined.
