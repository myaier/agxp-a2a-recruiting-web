# Accessible Wheel Listboxes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give salary, numeric, and year/month wheel listboxes one shared keyboard, direct-click, scroll, and ARIA interaction contract without changing their visual design or data rules.

**Architecture:** Add a headless `use可访问滚轮` Hook that owns focusable-listbox props, stable active-option IDs, bounded keyboard selection, direct option selection, programmatic scroll synchronization, and the existing 90ms scroll debounce. Keep all three existing visual components and CSS modules, and instantiate the Hook independently for every column.

**Tech Stack:** React 19, TypeScript 6, Vitest 4, Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-09-01-sms-login-hydration-salary-listbox-design.md`

## Global Constraints

- Execute after `docs/superpowers/plans/2026-09-01-sms-login-role-hydration.md` is complete and its verification gate is green.
- Use the login Plan's calibrated main anchor `37b0a459e53b48dfb3e204a647c805334d0bff06` or a later revalidated/rebased main. The 2026-09-01 calibration found no changes to the four target wheel components since the prior base.
- Do not change wheel CSS, highlighter geometry, row height, option ranges, steps, units, scroll-snap behavior, or overlay structure.
- Use `aria-activedescendant` with stable option IDs. Do not add roving option `tabIndex`.
- Support ArrowUp, ArrowDown, Home, and End. Clamp at boundaries and do not wrap. PageUp/PageDown remain out of scope.
- Mouse click selects the exact option immediately and focuses its owning listbox.
- Touch/wheel/drag continues to select the nearest option after 90ms without new scroll events.
- Programmatic scroll caused by keyboard, click, initial positioning, or external values must not produce a second state write.
- Each column has independent refs, timer, active ID, and pending programmatic-scroll marker.
- Salary remains 3–100K, allows an intermediate upper value below lower, and raises upper to lower only on confirmation.
- Follow TDD in every task and commit each independently reviewable deliverable.

---

## File Map

| File | Responsibility in this Plan |
| --- | --- |
| `src/组件/可访问滚轮.ts` | Headless shared interaction and ARIA Hook |
| `src/组件/内嵌双滚轮.tsx`, tests | First consumer; two-column isolation and full Hook contract |
| `src/组件/薪资区间层.tsx`, tests | Salary confirmation, normalization, and reopen values |
| `src/组件/数字滚轮层.tsx`, tests | Single-column consumer using row height 40 |
| `src/组件/年月滚轮层.tsx`, tests | Dynamic year/month consumer using row height 40 |
| `src/屏幕/基本信息.tsx`, `src/屏幕/就读时间段.tsx`, `src/屏幕/学生分流.tsx` | Existing non-salary `内嵌双滚轮` consumers; inherit the shared contract without product edits |
| `src/屏幕/学生分流.test.tsx` | One screen-level focus-order regression for an embedded wheel inside a real dialog |

### Task 1: Build the headless Hook through the embedded double-wheel contract

**Files:**
- Create: `src/组件/可访问滚轮.ts`
- Modify: `src/组件/内嵌双滚轮.tsx`
- Create: `src/组件/内嵌双滚轮.test.tsx`
- Modify: `src/屏幕/学生分流.test.tsx`

**Interfaces:**
- Consumes: a readonly numeric option list, controlled numeric value, setter, and exact row height.
- Produces: `use可访问滚轮({ 选项, 值, 设值, 行高 })` returning `滚轮引用`, `活动项编号`, `处理滚动`, `处理按键`, and `取选项属性(index)`.

- [ ] **Step 1: Write keyboard, boundary, click, and column-isolation tests**

Create `src/组件/内嵌双滚轮.test.tsx` with a controlled harness:

```tsx
function 宿主({ 左初值 = 4, 右初值 = 12 }: { 左初值?: number; 右初值?: number }) {
  const [左, 设左] = useState(左初值);
  const [右, 设右] = useState(右初值);
  return (
    <>
      <output aria-label="左值">{左}</output>
      <output aria-label="右值">{右}</output>
      <内嵌双滚轮
        左档={[3, 4, 5, 6]}
        右档={[10, 11, 12, 13]}
        左值={左}
        右值={右}
        设左值={设左}
        设右值={设右}
        左名="薪资下限"
        右名="薪资上限"
        左单位="K"
        右单位="K"
      />
    </>
  );
}

it('两列可 Tab 聚焦且 ArrowUp/ArrowDown 只改变当前列', async () => {
  const 用户 = userEvent.setup();
  render(<宿主 />);
  const 左列 = screen.getByRole('listbox', { name: '薪资下限' });
  const 右列 = screen.getByRole('listbox', { name: '薪资上限' });

  await 用户.tab();
  expect(document.activeElement).toBe(左列);
  await 用户.keyboard('{ArrowDown}');
  expect(within(左列).getByRole('option', { name: '5' }).getAttribute('aria-selected')).toBe('true');
  expect(within(右列).getByRole('option', { name: '12' }).getAttribute('aria-selected')).toBe('true');

  await 用户.tab();
  expect(document.activeElement).toBe(右列);
  await 用户.keyboard('{ArrowUp}');
  expect(within(右列).getByRole('option', { name: '11' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByLabelText('左值').textContent).toBe('5');
  expect(screen.getByLabelText('右值').textContent).toBe('11');
});

it('Home/End 到达边界，Arrow 键在边界夹紧', async () => {
  const 用户 = userEvent.setup();
  render(<宿主 />);
  const 左列 = screen.getByRole('listbox', { name: '薪资下限' });
  左列.focus();
  await 用户.keyboard('{Home}{ArrowUp}');
  expect(within(左列).getByRole('option', { name: '3' }).getAttribute('aria-selected')).toBe('true');
  await 用户.keyboard('{End}{ArrowDown}');
  expect(within(左列).getByRole('option', { name: '6' }).getAttribute('aria-selected')).toBe('true');
});

it('点击非当前 option 直接选择并把焦点留在所属 listbox', async () => {
  const 用户 = userEvent.setup();
  render(<宿主 />);
  const 右列 = screen.getByRole('listbox', { name: '薪资上限' });
  await 用户.click(within(右列).getByRole('option', { name: '10' }));
  expect(document.activeElement).toBe(右列);
  expect(within(右列).getByRole('option', { name: '10' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByLabelText('左值').textContent).toBe('4');
  expect(screen.getByLabelText('右值').textContent).toBe('10');
});
```

Import `render`, `screen`, `within`, `act`, `userEvent`, `useState`, and Vitest globals explicitly. The repository does not install `@testing-library/jest-dom`; use native `textContent`, `getAttribute`, `disabled`, and `document.activeElement` assertions throughout this Plan.

- [ ] **Step 2: Write ARIA, scroll debounce, external-value, and duplicate-write tests**

Add a spy-capable controlled harness whose setters increment counters. Cover:

```tsx
it('aria-activedescendant points at the selected option id', () => {
  render(<宿主 />);
  const 左列 = screen.getByRole('listbox', { name: '薪资下限' });
  const 选中 = within(左列).getByRole('option', { name: '4' });
  expect(选中.id).not.toBe('');
  expect(左列.getAttribute('aria-activedescendant')).toBe(选中.id);
});

it('scroll 停止 90ms 后选择最近档', () => {
  vi.useFakeTimers();
  try {
    render(<宿主 />);
    const 左列 = screen.getByRole('listbox', { name: '薪资下限' });
    Object.defineProperty(左列, 'scrollTop', { configurable: true, writable: true, value: 92 });
    fireEvent.scroll(左列);
    act(() => vi.advanceTimersByTime(89));
    expect(screen.getByLabelText('左值').textContent).toBe('4');
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByLabelText('左值').textContent).toBe('5');
  } finally {
    vi.useRealTimers();
  }
});
```

Use row height `46`, so `scrollTop=92` selects index `2`, value `5`. Add this controlled rerender case to lock the programmatic-scroll suppression requirement:

```tsx
it('外部改值定位滚轮且对应程序 scroll 不重复写 state', () => {
  vi.useFakeTimers();
  try {
    const 设左值 = vi.fn();
    const { rerender } = render(
      <内嵌双滚轮
        左档={[3, 4, 5, 6]}
        右档={[10, 11, 12, 13]}
        左值={4}
        右值={12}
        设左值={设左值}
        设右值={vi.fn()}
        左名="薪资下限"
        右名="薪资上限"
      />,
    );
    const 左列 = screen.getByRole('listbox', { name: '薪资下限' });
    rerender(
      <内嵌双滚轮
        左档={[3, 4, 5, 6]}
        右档={[10, 11, 12, 13]}
        左值={6}
        右值={12}
        设左值={设左值}
        设右值={vi.fn()}
        左名="薪资下限"
        右名="薪资上限"
      />,
    );
    expect(左列.scrollTop).toBe(138);
    fireEvent.scroll(左列);
    act(() => vi.advanceTimersByTime(90));
    expect(设左值).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
```

- [ ] **Step 3: Run the new test and record the RED**

```bash
npm test -- src/组件/内嵌双滚轮.test.tsx
```

Expected: focus, keyboard, direct-click, active-descendant, and external-scroll assertions fail because the existing listbox exposes only `onScroll` and `aria-selected`.

- [ ] **Step 4: Implement the shared Hook**

Create `src/组件/可访问滚轮.ts`:

```ts
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type RefObject,
} from 'react';

interface 可访问滚轮参数 {
  选项: readonly number[];
  值: number;
  设值: (值: number) => void;
  行高: number;
}

interface 滚轮选项属性 {
  id: string;
  onClick: MouseEventHandler<HTMLElement>;
}

interface 可访问滚轮结果 {
  滚轮引用: RefObject<HTMLDivElement | null>;
  活动项编号: string | undefined;
  处理滚动: () => void;
  处理按键: KeyboardEventHandler<HTMLDivElement>;
  取选项属性: (序号: number) => 滚轮选项属性;
}

const 夹序号 = (序号: number, 长度: number) =>
  Math.min(Math.max(序号, 0), Math.max(长度 - 1, 0));

export function use可访问滚轮({ 选项, 值, 设值, 行高 }: 可访问滚轮参数): 可访问滚轮结果 {
  const 滚轮引用 = useRef<HTMLDivElement>(null);
  const 防抖计时 = useRef(0);
  const 自报值 = useRef(值);
  const 已定位序号 = useRef<number | null>(null);
  const 待忽略程序序号 = useRef<number | null>(null);
  const 编号前缀 = `wheel-${useId().replaceAll(':', '')}`;
  const 当前序号 = 选项.indexOf(值);
  const 选项编号 = useCallback(
    (序号: number) => `${编号前缀}-option-${序号}`,
    [编号前缀],
  );

  const 滚到序号 = useCallback((序号: number) => {
    const 节点 = 滚轮引用.current;
    if (!节点) return;
    window.clearTimeout(防抖计时.current);
    待忽略程序序号.current = 序号;
    已定位序号.current = 序号;
    节点.scrollTop = 序号 * 行高;
  }, [行高]);

  const 选择序号 = useCallback((原序号: number, 聚焦: boolean) => {
    if (选项.length === 0) return;
    const 序号 = 夹序号(原序号, 选项.length);
    const 下一值 = 选项[序号];
    自报值.current = 下一值;
    滚到序号(序号);
    if (聚焦) 滚轮引用.current?.focus();
    if (下一值 !== 值) 设值(下一值);
  }, [值, 滚到序号, 设值, 选项]);

  useEffect(() => {
    if (当前序号 < 0) return;
    if (已定位序号.current === 当前序号 && 自报值.current === 值) return;
    自报值.current = 值;
    滚到序号(当前序号);
  }, [值, 当前序号, 滚到序号]);

  useEffect(() => () => window.clearTimeout(防抖计时.current), []);

  const 处理滚动 = useCallback(() => {
    window.clearTimeout(防抖计时.current);
    防抖计时.current = window.setTimeout(() => {
      const 节点 = 滚轮引用.current;
      if (!节点 || 选项.length === 0) return;
      const 序号 = 夹序号(Math.round(节点.scrollTop / 行高), 选项.length);
      if (待忽略程序序号.current === 序号) {
        待忽略程序序号.current = null;
        return;
      }
      待忽略程序序号.current = null;
      已定位序号.current = 序号;
      const 下一值 = 选项[序号];
      自报值.current = 下一值;
      if (下一值 !== 值) 设值(下一值);
    }, 90);
  }, [值, 设值, 行高, 选项]);

  const 处理按键: KeyboardEventHandler<HTMLDivElement> = useCallback((事件) => {
    if (选项.length === 0) return;
    const 基准 = 当前序号 < 0 ? 0 : 当前序号;
    const 目标 = 事件.key === 'ArrowUp' ? 基准 - 1
      : 事件.key === 'ArrowDown' ? 基准 + 1
        : 事件.key === 'Home' ? 0
          : 事件.key === 'End' ? 选项.length - 1
            : null;
    if (目标 === null) return;
    事件.preventDefault();
    选择序号(目标, false);
  }, [当前序号, 选择序号, 选项.length]);

  const 取选项属性 = useCallback((序号: number): 滚轮选项属性 => ({
    id: 选项编号(序号),
    onClick: () => 选择序号(序号, true),
  }), [选择序号, 选项编号]);

  return {
    滚轮引用,
    活动项编号: 当前序号 >= 0 ? 选项编号(当前序号) : undefined,
    处理滚动,
    处理按键,
    取选项属性,
  };
}
```

If the repository TypeScript/lib target lacks `String.prototype.replaceAll`, use `.replace(/:/g, '')`; do not relax the target or add a dependency.

- [ ] **Step 5: Replace the embedded column's duplicated mechanics**

In `src/组件/内嵌双滚轮.tsx`, remove the column's `useEffect`, `useRef`, local debounce, self-reported value, initial-positioning effect, external-positioning effect, and local `处理滚动`. Keep `行高 = 46` and call:

```ts
const {
  滚轮引用,
  活动项编号,
  处理滚动,
  处理按键,
  取选项属性,
} = use可访问滚轮({ 选项: 档表, 值, 设值, 行高 });
```

Wire the listbox and options:

```tsx
<div
  ref={滚轮引用}
  className={`${样式.滚轮} 滚动区`}
  onScroll={处理滚动}
  onKeyDown={处理按键}
  role="listbox"
  tabIndex={0}
  aria-label={名称}
  aria-activedescendant={活动项编号}
>
  {档表.map((档, 序号) => (
    <div
      key={档}
      className={样式.档}
      role="option"
      aria-selected={档 === 值}
      {...取选项属性(序号)}
    >
      <span className={`${档 === 值 ? 样式.档选中 : 样式.档未选} 等宽数字`}>{档}</span>
    </div>
  ))}
</div>
```

Import only `use可访问滚轮`; `内嵌双滚轮.tsx` should no longer import React hooks.

- [ ] **Step 6: Add one non-salary consumer focus-order regression**

Extend the existing `src/屏幕/学生分流.test.tsx` harness; do not create another full Provider mock. Add a campus-recruiting case that opens its “预计毕业时间” dialog and proves the two inherited listboxes participate in the dialog's real Tab order:

```tsx
it('预计毕业时间弹层把毕业年和毕业月接入真实 Tab 顺序', async () => {
  const 用户 = userEvent.setup();
  render学生分流({
    数据源: 'backend',
    基本信息: { 身份: '在校' },
    引导预填: {
      ...完整预填,
      筛选偏好: {
        ...完整预填.筛选偏好,
        求职类型: ['校园招聘'],
        毕业时间: '2027-06',
      },
    },
  });
  await 用户.click(screen.getByRole('button', { name: /2027 年 06 月/ }));
  const 取消 = screen.getByRole('button', { name: '取消' });
  const 完成 = screen.getByRole('button', { name: '完成' });
  const 年列 = screen.getByRole('listbox', { name: '毕业年' });
  const 月列 = screen.getByRole('listbox', { name: '毕业月' });

  expect(document.activeElement).toBe(取消);
  await 用户.tab();
  expect(document.activeElement).toBe(完成);
  await 用户.tab();
  expect(document.activeElement).toBe(年列);
  await 用户.tab();
  expect(document.activeElement).toBe(月列);
});
```

This single integration case covers focus-trap composition. Keyboard selection, direct click, state isolation, and ARIA semantics remain owned by `内嵌双滚轮.test.tsx` and therefore cover all three screen consumers.

- [ ] **Step 7: Run tests, typecheck, and commit**

```bash
npm test -- src/组件/内嵌双滚轮.test.tsx src/屏幕/学生分流.test.tsx
npm run typecheck
git diff --check
git add src/组件/可访问滚轮.ts src/组件/内嵌双滚轮.tsx src/组件/内嵌双滚轮.test.tsx src/屏幕/学生分流.test.tsx
git commit -m "feat: add accessible wheel interactions"
```

### Task 2: Lock salary confirmation and reopen behavior

**Files:**
- Create: `src/组件/薪资区间层.test.tsx`
- Inspect: `src/组件/薪资区间层.tsx`

**Interfaces:**
- Consumes: Task 1's accessible embedded double wheel and existing 3–100K salary state.
- Produces: regression coverage for direct selection, confirmation, upper-bound normalization, and fresh mount initialization.

- [ ] **Step 1: Add exact salary behavior tests**

Create `src/组件/薪资区间层.test.tsx`:

```tsx
it('直接点选两列后确定回传当前值', async () => {
  const 确认 = vi.fn();
  const 用户 = userEvent.setup();
  render(<薪资区间层 下限={20} 上限={30} 确认={确认} 取消={vi.fn()} />);
  const 下限列 = screen.getByRole('listbox', { name: '薪资下限' });
  const 上限列 = screen.getByRole('listbox', { name: '薪资上限' });
  await 用户.click(within(下限列).getByRole('option', { name: '21' }));
  await 用户.click(within(上限列).getByRole('option', { name: '31' }));
  await 用户.click(screen.getByRole('button', { name: '确定' }));
  expect(确认).toHaveBeenCalledWith(21, 31);
});

it('确定时把低于下限的上限抬到下限', async () => {
  const 确认 = vi.fn();
  const 用户 = userEvent.setup();
  render(<薪资区间层 下限={20} 上限={30} 确认={确认} 取消={vi.fn()} />);
  const 下限列 = screen.getByRole('listbox', { name: '薪资下限' });
  const 上限列 = screen.getByRole('listbox', { name: '薪资上限' });
  await 用户.click(within(下限列).getByRole('option', { name: '40' }));
  await 用户.click(within(上限列).getByRole('option', { name: '25' }));
  await 用户.click(screen.getByRole('button', { name: '确定' }));
  expect(确认).toHaveBeenCalledWith(40, 40);
});

it('重新挂载从已保存值定位', () => {
  const { unmount } = render(
    <薪资区间层 下限={20} 上限={30} 确认={vi.fn()} 取消={vi.fn()} />,
  );
  unmount();
  render(<薪资区间层 下限={21} 上限={31} 确认={vi.fn()} 取消={vi.fn()} />);
  expect(within(screen.getByRole('listbox', { name: '薪资下限' }))
    .getByRole('option', { name: '21' }).getAttribute('aria-selected')).toBe('true');
  expect(within(screen.getByRole('listbox', { name: '薪资上限' }))
    .getByRole('option', { name: '31' }).getAttribute('aria-selected')).toBe('true');
});
```

Add this keyboard case to prove salary confirmation consumes the same state as ARIA selection:

```tsx
it('键盘选择后的高亮值就是确定回传值', async () => {
  const 确认 = vi.fn();
  const 用户 = userEvent.setup();
  render(<薪资区间层 下限={20} 上限={30} 确认={确认} 取消={vi.fn()} />);
  const 下限列 = screen.getByRole('listbox', { name: '薪资下限' });
  下限列.focus();
  await 用户.keyboard('{ArrowDown}');
  expect(within(下限列).getByRole('option', { name: '21' })
    .getAttribute('aria-selected')).toBe('true');
  await 用户.click(screen.getByRole('button', { name: '确定' }));
  expect(确认).toHaveBeenCalledWith(21, 30);
});
```

- [ ] **Step 2: Run the test and repair only exposed salary integration defects**

```bash
npm test -- src/组件/薪资区间层.test.tsx src/组件/内嵌双滚轮.test.tsx
```

Expected after Task 1: tests should pass without changing `薪资区间层.tsx`. If a test fails because the salary layer, rather than the Hook, violates the frozen confirmation rule, add the smallest product fix in `薪资区间层.tsx` and keep the failing regression.

- [ ] **Step 3: Commit the salary contract tests**

```bash
git diff --check
git add src/组件/薪资区间层.test.tsx src/组件/薪资区间层.tsx
git commit -m "test: lock accessible salary selection"
```

If `薪资区间层.tsx` is unchanged, `git add` ignores it and the commit contains only the test file.

### Task 3: Migrate numeric and year/month wheels to the same Hook

**Files:**
- Modify: `src/组件/数字滚轮层.tsx`
- Create: `src/组件/数字滚轮层.test.tsx`
- Modify: `src/组件/年月滚轮层.tsx`
- Create: `src/组件/年月滚轮层.test.tsx`

**Interfaces:**
- Consumes: Task 1's `use可访问滚轮` and exact row height `40`.
- Produces: the same focus, keyboard, click, scroll, and ARIA contract for single-number and dynamic year/month wheels.

- [ ] **Step 1: Add a numeric-wheel integration test**

Create `src/组件/数字滚轮层.test.tsx`:

```tsx
it('数字滚轮支持键盘和直接点选并提交同一值', async () => {
  const 确认 = vi.fn();
  const 用户 = userEvent.setup();
  render(
    <数字滚轮层 标题="年薪月数" 初值={12} 最小={12} 最大={16} 单位="薪"
      确认={确认} 取消={vi.fn()} />,
  );
  const 列 = screen.getByRole('listbox', { name: '年薪月数' });
  列.focus();
  await 用户.keyboard('{ArrowDown}');
  expect(within(列).getByRole('option', { name: '13' }).getAttribute('aria-selected')).toBe('true');
  await 用户.click(within(列).getByRole('option', { name: '16' }));
  await 用户.click(screen.getByRole('button', { name: '完成' }));
  expect(确认).toHaveBeenCalledWith(16);
});
```

- [ ] **Step 2: Add dynamic year/month integration tests**

Create `src/组件/年月滚轮层.test.tsx`:

```tsx
it('年月两列分别可键盘选择并提交', async () => {
  const 确认 = vi.fn();
  const 用户 = userEvent.setup();
  render(
    <年月滚轮层 标题="入职时间" 初值="2025-06" 最小="2024-01" 最大="2026-12"
      确认={确认} 取消={vi.fn()} />,
  );
  const 年列 = screen.getByRole('listbox', { name: '年份' });
  const 月列 = screen.getByRole('listbox', { name: '月份' });
  年列.focus();
  await 用户.keyboard('{ArrowDown}');
  月列.focus();
  await 用户.keyboard('{Home}');
  await 用户.click(screen.getByRole('button', { name: '完成' }));
  expect(确认).toHaveBeenCalledWith('2026-01');
});

it('年份改变导致月份范围收缩时 active descendant 跟随夹紧值', async () => {
  const 用户 = userEvent.setup();
  render(
    <年月滚轮层 标题="离职时间" 初值="2025-12" 最小="2025-01" 最大="2026-08"
      确认={vi.fn()} 取消={vi.fn()} />,
  );
  const 年列 = screen.getByRole('listbox', { name: '年份' });
  await 用户.click(within(年列).getByRole('option', { name: '2026' }));
  const 月列 = screen.getByRole('listbox', { name: '月份' });
  await waitFor(() => expect(
    within(月列).getByRole('option', { name: '8' }).getAttribute('aria-selected'),
  ).toBe('true'));
  expect(月列.getAttribute('aria-activedescendant'))
    .toBe(within(月列).getByRole('option', { name: '8' }).id);
});
```

- [ ] **Step 3: Run the tests and record the RED**

```bash
npm test -- src/组件/数字滚轮层.test.tsx src/组件/年月滚轮层.test.tsx
```

Expected: keyboard, click, and active-descendant assertions fail because both components still use their duplicated scroll-only column implementation.

- [ ] **Step 4: Replace both local column implementations with the Hook**

In both components keep `行高 = 40`, local state, option construction, overlay shell, highlighter, and unit spans. Inside each private column use:

```ts
const {
  滚轮引用,
  活动项编号,
  处理滚动,
  处理按键,
  取选项属性,
} = use可访问滚轮({ 选项, 值, 设值, 行高 });
```

Wire each listbox with `onKeyDown`, `tabIndex={0}`, and `aria-activedescendant`; spread `取选项属性(序号)` onto each option exactly as in Task 1. Remove the duplicated ref/effect/debounce/self-reported-value code and unused React hook imports.

For `年月滚轮层`, do not move the existing month-clamping effect into the Hook. The parent remains responsible for making `月` valid for the selected year; the Hook responds to the resulting controlled value and changed option index.

- [ ] **Step 5: Run all wheel tests, typecheck, and commit**

```bash
npm test -- src/组件/内嵌双滚轮.test.tsx src/组件/薪资区间层.test.tsx src/组件/数字滚轮层.test.tsx src/组件/年月滚轮层.test.tsx
npm run typecheck
git diff --check
git add src/组件/数字滚轮层.tsx src/组件/数字滚轮层.test.tsx src/组件/年月滚轮层.tsx src/组件/年月滚轮层.test.tsx
git commit -m "refactor: share accessible wheel behavior"
```

### Task 4: Run the full automated and real Backend regression

**Files:**
- No required product changes; any defect found returns to the owning Task with a failing focused test and a separate fix commit.

**Interfaces:**
- Consumes: the completed login Plan and Tasks 1–3 of this Plan.
- Produces: automated verification plus a real `backend/local` browser-closure report.

- [ ] **Step 1: Run the handoff focused tests**

```bash
npm test -- src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts src/屏幕/登录.test.tsx src/屏幕/添加意向.test.tsx src/屏幕/我的简历.test.tsx src/数据/HTTP招聘数据源.test.ts
npm test -- src/组件/内嵌双滚轮.test.tsx src/组件/薪资区间层.test.tsx src/组件/数字滚轮层.test.tsx src/组件/年月滚轮层.test.tsx
```

Expected: every file passes.

- [ ] **Step 2: Run the complete repository verification**

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
git status --short
```

Expected: every command exits `0`; the worktree is clean after committed Tasks 1–3.

- [ ] **Step 3: Start the real Backend/local frontend**

Use the `agent-browser` skill for this browser step. Start the repository's local BFF by its documented command, then start the frontend:

```bash
VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local npm run dev
```

Open `http://localhost:5173`. Keep the exact terminal/browser handles so the same processes are monitored and stopped; do not launch duplicate servers after a quiet wait.

- [ ] **Step 4: Complete the real session and intention closure**

Using an existing candidate account with one active intention:

1. Log out.
2. Complete SMS login.
3. Before opening a role page, inspect the network log and assert exactly one successful request for `/api/v1/me`, `/api/v1/me/resume`, and `/api/v1/me/intentions?status=active`, plus the current candidate privacy, attachment, and Agent-rule hydration requests.
4. Open “我的”; assert the authoritative name appears and neither “沈亦舟” nor “在职 · 保密求职中” appears.
5. Open “我的简历”; assert authoritative education and resume sections appear without refresh.
6. Open “求职意向”; assert `1/5` appears and opening the page sends no additional intentions GET.
7. Edit the existing intention. In the salary layer, Tab to each listbox, use Arrow keys, directly click a non-current option, and exercise physical wheel/touch scrolling. Assert the visual highlight and `aria-selected` always match.
8. Save 21–31K. Assert PATCH carries the current revision's `If-Match`, then the authoritative GET returns 21–31K.
9. Reopen and refresh; assert 21–31K remains.
10. Log out and SMS-login again; assert the authoritative resume and `1/5` intention state return without refresh and each hydration resource is read once in the new session.

If the local BFF, SMS code, or test account is unavailable, report the exact environment blocker and stop the real-backend portion. Do not substitute Mock evidence.

- [ ] **Step 5: Return final evidence without a verification-only commit**

Report request counts, route/status codes, absence of page-level duplicate GETs, salary input modes exercised, `If-Match` value, authoritative post-save value, all command exit statuses, and any environment blocker. If a product defect was fixed during this Task, include its focused RED/GREEN test and fix commit SHA; otherwise create no additional commit.

## Wheel Plan Completion Report

Return:

- Task commit SHAs and focused RED/GREEN evidence;
- keyboard, direct-click, scroll, boundary, active-descendant, duplicate-write, and dynamic-month test results;
- full repository verification exit statuses;
- real Backend request counts and salary persistence evidence, or the exact non-Mock environment blocker;
- confirmation that no CSS, range, `If-Match`, DTO, or page-level fetch behavior changed.
