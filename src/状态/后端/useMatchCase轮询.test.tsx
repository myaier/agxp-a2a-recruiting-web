// P5 Task 3：useMatchCase轮询 的假时钟生命周期测试。
// 对齐 spec §10.3：open 列表每 5 秒重读已载窗口、open 详情每 3 秒权威重读，
// 且只在 document 可见时节拍真正发请求；隐藏标签页、卸载、scope 变化与终局详情停表；
// 单飞（同一目标在飞期间绝不并发第二发）；单拍失败吞掉（错误态由操作层快照承载），
// 下一拍照常重试。会话/范围栅栏归操作层（MatchCase操作.ts）所有，本钩子只持节拍与在途表。

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMatchCase轮询 } from './useMatchCase轮询';
import type { P5可轮询列表, P5可轮询详情 } from './useMatchCase轮询';

const 列表范围: P5可轮询列表 = { role: 'candidate', filterRef: null };
const 详情范围: P5可轮询详情 = { role: 'candidate', caseId: 'mc_1' };

afterEach(() => {
  vi.useRealTimers();
  还原可见性();
});

/** 推进假时钟：触发内部状态更新的用例必须裹 act，避免 React 19 的更新告警。 */
async function 走(毫秒: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(毫秒);
  });
}

/** jsdom 的 visibilityState 默认 'visible'；本文件用可控桩替换以驱动 §10.3 的可见栅栏。 */
function 设可见性(状态: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', {
    value: 状态, configurable: true,
  });
}

function 还原可见性(): void {
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible', configurable: true,
  });
}

describe('useMatchCase轮询', () => {
  it('open 列表每 5 秒、open 详情每 3 秒各一发', async () => {
    vi.useFakeTimers();
    const 刷新列表 = vi.fn(async () => undefined);
    const 刷新详情 = vi.fn(async () => undefined);
    renderHook(() => useMatchCase轮询({
      开启: true, 列表: 列表范围, 详情: 详情范围, 详情终局: false,
      刷新列表, 刷新详情,
    }));
    await 走(3_000);
    expect(刷新详情).toHaveBeenCalledTimes(1);
    expect(刷新列表).not.toHaveBeenCalled();
    await 走(2_000); // 5 秒：列表第一拍
    expect(刷新列表).toHaveBeenCalledTimes(1);
    expect(刷新详情).toHaveBeenCalledTimes(1);
    await 走(1_000); // 6 秒：详情第二拍
    expect(刷新详情).toHaveBeenCalledTimes(2);
    await 走(4_000); // 10 秒：列表第二拍、详情第三拍
    expect(刷新列表).toHaveBeenCalledTimes(2);
    expect(刷新详情).toHaveBeenCalledTimes(3);
  });

  it('缺省间隔即 5000/3000；列表/详情任一缺席时不为它排表', async () => {
    vi.useFakeTimers();
    const 刷新列表 = vi.fn(async () => undefined);
    const 刷新详情 = vi.fn(async () => undefined);
    renderHook(() => useMatchCase轮询({
      开启: true, 列表: null, 详情: 详情范围, 详情终局: false,
      刷新列表, 刷新详情,
    }));
    await 走(2_999);
    expect(刷新详情).not.toHaveBeenCalled();
    await 走(1_000); // 3999ms：详情第一拍（3000ms 到点）
    expect(刷新详情).toHaveBeenCalledTimes(1);
    expect(刷新列表).not.toHaveBeenCalled(); // 列表缺席：绝不为它排表
    await 走(2_000); // 5999ms：详情第二拍未到
    expect(刷新详情).toHaveBeenCalledTimes(1);
    await 走(1_000); // 6999ms：详情第二拍（6000ms 到点）
    expect(刷新详情).toHaveBeenCalledTimes(2);
    expect(刷新列表).not.toHaveBeenCalled();
  });

  it('开启=false 不起节拍，翻 true 后起轮，翻回 false 即停', async () => {
    vi.useFakeTimers();
    const 刷新列表 = vi.fn(async () => undefined);
    const { rerender } = renderHook(
      ({ 开启 }) => useMatchCase轮询({
        开启, 列表: 列表范围, 详情: null, 详情终局: false,
        刷新列表, 刷新详情: vi.fn(async () => undefined),
      }),
      { initialProps: { 开启: false } },
    );
    await 走(20_000);
    expect(刷新列表).not.toHaveBeenCalled();
    rerender({ 开启: true });
    await 走(5_000);
    expect(刷新列表).toHaveBeenCalledTimes(1);
    rerender({ 开启: false }); // 会话/角色换代由页面翻 开启：立即停表
    await 走(15_000);
    expect(刷新列表).toHaveBeenCalledTimes(1);
  });

  it('隐藏标签页零请求，恢复可见后节拍照常继续', async () => {
    vi.useFakeTimers();
    const 刷新列表 = vi.fn(async () => undefined);
    const 刷新详情 = vi.fn(async () => undefined);
    renderHook(() => useMatchCase轮询({
      开启: true, 列表: 列表范围, 详情: 详情范围, 详情终局: false,
      刷新列表, 刷新详情,
    }));
    设可见性('hidden');
    await 走(10_000);
    expect(刷新列表).not.toHaveBeenCalled();
    expect(刷新详情).not.toHaveBeenCalled();
    设可见性('visible');
    await 走(5_000); // 恢复可见：到点的拍照常发请求
    expect(刷新列表).toHaveBeenCalledTimes(1);
    expect(刷新详情.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('unmount 清掉两张节拍表，迟到的完成不再安排任何请求', async () => {
    vi.useFakeTimers();
    const pending = deferred<void>();
    const 刷新列表 = vi.fn(() => pending.promise);
    const 刷新详情 = vi.fn(async () => undefined);
    const { unmount } = renderHook(() => useMatchCase轮询({
      开启: true, 列表: 列表范围, 详情: null, 详情终局: false,
      刷新列表, 刷新详情,
    }));
    await 走(5_000);
    expect(刷新列表).toHaveBeenCalledTimes(1);
    unmount();
    pending.resolve();
    await act(async () => {
      await vi.runAllTicks();
    });
    await 走(30_000);
    expect(刷新列表).toHaveBeenCalledTimes(1);
    expect(刷新详情).not.toHaveBeenCalled();
  });

  it('scope 变化即结束本周期：旧表清掉，按新范围重新起拍', async () => {
    vi.useFakeTimers();
    const 刷新列表 = vi.fn(async () => undefined);
    const { rerender } = renderHook(
      ({ 列表 }) => useMatchCase轮询({
        开启: true, 列表, 详情: null, 详情终局: false,
        刷新列表, 刷新详情: vi.fn(async () => undefined),
      }),
      { initialProps: { 列表: 列表范围 } },
    );
    await 走(5_000);
    expect(刷新列表).toHaveBeenCalledTimes(1);
    rerender({ 列表: { role: 'candidate', filterRef: 'int_2' } }); // 切意向 = 换 scope
    await 走(5_000);
    expect(刷新列表).toHaveBeenCalledTimes(2);
    expect(刷新列表).toHaveBeenLastCalledWith({ role: 'candidate', filterRef: 'int_2' });
  });

  it('终局详情停详情节拍，列表节拍照常', async () => {
    vi.useFakeTimers();
    const 刷新列表 = vi.fn(async () => undefined);
    const 刷新详情 = vi.fn(async () => undefined);
    const { rerender } = renderHook(
      ({ 详情终局 }) => useMatchCase轮询({
        开启: true, 列表: 列表范围, 详情: 详情范围, 详情终局,
        刷新列表, 刷新详情,
      }),
      { initialProps: { 详情终局: false } },
    );
    await 走(3_000);
    expect(刷新详情).toHaveBeenCalledTimes(1);
    rerender({ 详情终局: true }); // 轮询读到 ended/completed：详情表停
    await 走(30_000);
    expect(刷新详情).toHaveBeenCalledTimes(1);
    expect(刷新列表).toHaveBeenCalledTimes(6); // 列表 5 秒拍不受详情终局影响
  });

  it('同一目标在飞期间绝不并发第二发，完成后下一拍继续', async () => {
    vi.useFakeTimers();
    const pending = deferred<void>();
    const 刷新详情 = vi.fn(() => pending.promise);
    renderHook(() => useMatchCase轮询({
      开启: true, 列表: null, 详情: 详情范围, 详情终局: false,
      刷新列表: vi.fn(async () => undefined), 刷新详情,
    }));
    await 走(3_000);
    expect(刷新详情).toHaveBeenCalledTimes(1);
    await 走(9_000); // 在途期间绝不并发第二发
    expect(刷新详情).toHaveBeenCalledTimes(1);
    pending.resolve();
    await act(async () => {
      await vi.runAllTicks();
    });
    await 走(3_000);
    expect(刷新详情).toHaveBeenCalledTimes(2);
  });

  it('单拍失败吞掉（无未处理 rejection），下一拍照常重试', async () => {
    vi.useFakeTimers();
    let 已失败 = false;
    const 刷新列表 = vi.fn(async () => {
      if (!已失败) {
        已失败 = true;
        throw new Error('down');
      }
    });
    renderHook(() => useMatchCase轮询({
      开启: true, 列表: 列表范围, 详情: null, 详情终局: false,
      刷新列表, 刷新详情: vi.fn(async () => undefined),
    }));
    await 走(5_000);
    await act(async () => {
      await vi.runAllTicks();
    });
    expect(刷新列表).toHaveBeenCalledTimes(1);
    await 走(5_000);
    expect(刷新列表).toHaveBeenCalledTimes(2); // 上一拍失败不断表：重试错误由快照承载
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
