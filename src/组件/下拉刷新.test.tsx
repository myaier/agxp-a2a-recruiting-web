// 下拉刷新（P4 Task 6）：刷新回调升级为可异步 —— 松手仍同步调用回调（既有两个
// 同步 Mock 调用方的时序不变），转圈动画与真实请求的 settle 取较晚者收场，
// 且动画至少保持 900ms。三个用例：
//   · 同步回调：动画恰好 900ms（现有时序的回归金丝雀）；
//   · pending 的 Promise：过了 900ms 还在转，settle 才收；
//   · 900ms 内就 rejected 的请求：等满最短动画再收（不闪收、不提前）。
// 注：仓库未装 @testing-library/jest-dom，用 querySelector + toBeNull 断言；
// 转圈观感按既有 CSS-module 测试惯例取 [class*="刷新转"]，不为测试加产品属性。

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import 下拉刷新 from './下拉刷新';

function 触发下拉() {
  const root = screen.getByTestId('滚动区').parentElement!;
  fireEvent.pointerDown(root, { clientY: 0 });
  fireEvent.pointerMove(root, { clientY: 120 });
  fireEvent.pointerUp(root, { clientY: 120 });
}

const 活跃转圈 = () => document.querySelector('[class*="刷新转"]');

function 渲染(刷新: () => void | Promise<void>) {
  return render(<下拉刷新 刷新={刷新}><div className="滚动区" data-testid="滚动区" /></下拉刷新>);
}

afterEach(() => {
  // 假时钟每个用例后恢复，避免泄漏进其它测试文件
  vi.useRealTimers();
});

describe('下拉刷新 · 异步刷新与最短动画', () => {
  it('同步刷新仍保持至少 900ms 动画', async () => {
    vi.useFakeTimers();
    const 刷新 = vi.fn();
    渲染(刷新);
    触发下拉();
    expect(刷新).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[class*="刷新转"]')).not.toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(899));
    expect(document.querySelector('[class*="刷新转"]')).not.toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(document.querySelector('[class*="刷新转"]')).toBeNull();
  });

  it('pending 的请求过了 900ms 仍保持动画，settle 后才收起', async () => {
    vi.useFakeTimers();
    let resolve!: () => void;
    const 刷新 = vi.fn(
      () => new Promise<void>((resolve一次) => {
        resolve = resolve一次;
      }),
    );
    渲染(刷新);
    触发下拉();
    expect(刷新).toHaveBeenCalledTimes(1);
    // 请求还没回来：动画不能因为 900ms 到点就撤，刷新中的事实必须留着
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(活跃转圈()).not.toBeNull();
    await act(async () => {
      resolve();
    });
    expect(活跃转圈()).toBeNull();
  });

  it('900ms 内就 rejected 的请求也等满最短动画再收起', async () => {
    vi.useFakeTimers();
    let reject!: (错误: Error) => void;
    const 刷新 = vi.fn(
      () => new Promise<void>((_resolve一次, reject一次) => {
        reject = reject一次;
      }),
    );
    渲染(刷新);
    触发下拉();
    // 立刻失败：动画不闪撤，至少转满 900ms（Promise.allSettled 吞掉拒绝本身）
    await act(async () => {
      reject(new Error('网络失败'));
    });
    expect(活跃转圈()).not.toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(899));
    expect(活跃转圈()).not.toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(活跃转圈()).toBeNull();
  });
});
