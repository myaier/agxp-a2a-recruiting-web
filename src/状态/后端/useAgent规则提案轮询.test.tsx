// P6 Task 5：useAgent规则提案轮询 的假时钟生命周期测试。
// 对齐设计 §4.4：只在 开启 时排一个 interval；只轮 interpreting；同一 proposal
// 同时最多一个 GET；卸载/关闭即停；旧周期的迟到完成不安排任何后续工作。
// 角色切换在页面上表现为换一份 提案 数组 + 翻 开启（钩子入参只建模这两者）。
// 注：仓库未装 @testing-library/jest-dom，断言一律用调用计数与 toBe/toEqual。

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BFFAgent规则解释中提案样本, BFFAgent规则就绪提案样本 } from '../../测试/BFF样本';
import { useAgent规则提案轮询 } from './useAgent规则提案轮询';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

afterEach(() => {
  // 假时钟每个用例后恢复，避免泄漏进其它测试文件
  vi.useRealTimers();
});

describe('useAgent规则提案轮询', () => {
  it('polls interpreting Proposals single-flight and stops at terminal state', async () => {
    vi.useFakeTimers();
    const pending = deferred<void>();
    const 刷新 = vi.fn(() => pending.promise);
    const { rerender, unmount } = renderHook(
      ({ 提案 }) => useAgent规则提案轮询({ 开启: true, 提案, 刷新, 间隔毫秒: 2000 }),
      { initialProps: { 提案: [BFFAgent规则解释中提案样本] } },
    );
    await vi.advanceTimersByTimeAsync(4000);
    expect(刷新).toHaveBeenCalledTimes(1);
    pending.resolve();
    await vi.runAllTicks();
    rerender({ 提案: [BFFAgent规则就绪提案样本] });
    await vi.advanceTimersByTimeAsync(4000);
    expect(刷新).toHaveBeenCalledTimes(1);
    unmount();
    vi.useRealTimers();
  });

  it('开启=false 不起节拍，翻 true 后从默认 2 秒起轮，翻回 false 即停', async () => {
    vi.useFakeTimers();
    const 刷新 = vi.fn(async (_id: string) => undefined);
    const { rerender } = renderHook(
      ({ 开启, 提案 }) => useAgent规则提案轮询({ 开启, 提案, 刷新 }),
      { initialProps: { 开启: false, 提案: [BFFAgent规则解释中提案样本] } },
    );
    // Backend 水合未就绪：页面传 开启=false，绝不能发 GET
    await vi.advanceTimersByTimeAsync(6000);
    expect(刷新).not.toHaveBeenCalled();
    // proposals 水合成功后页面把 开启 翻 true：一个默认间隔后才发第一发
    rerender({ 开启: true, 提案: [BFFAgent规则解释中提案样本] });
    await vi.advanceTimersByTimeAsync(2000);
    expect(刷新).toHaveBeenCalledTimes(1);
    // 再翻回 false（离开页面 / 会话或角色切换）：interval 清掉，不再发
    rerender({ 开启: false, 提案: [BFFAgent规则解释中提案样本] });
    await vi.advanceTimersByTimeAsync(6000);
    expect(刷新).toHaveBeenCalledTimes(1);
  });

  it('多个 interpreting 提案各轮一发，单飞在途，完成后下一拍继续', async () => {
    vi.useFakeTimers();
    const pending = deferred<void>();
    const 刷新 = vi.fn((_id: string) => pending.promise);
    const 甲 = { ...BFFAgent规则解释中提案样本, proposal_id: 'arp_0123456789abcdef0123456789abcdea' };
    const 乙 = { ...BFFAgent规则解释中提案样本, proposal_id: 'arp_0123456789abcdef0123456789abcdeb' };
    const { unmount } = renderHook(
      ({ 提案 }) => useAgent规则提案轮询({ 开启: true, 提案, 刷新, 间隔毫秒: 2000 }),
      { initialProps: { 提案: [甲, 乙] } },
    );
    await vi.advanceTimersByTimeAsync(2000);
    expect(刷新).toHaveBeenCalledTimes(2);
    expect(刷新.mock.calls.map(([id]) => id).sort()).toEqual([甲.proposal_id, 乙.proposal_id]);
    // 两发都在途：再走两拍也绝不对同一 ID 并发第二发
    await vi.advanceTimersByTimeAsync(4000);
    expect(刷新).toHaveBeenCalledTimes(2);
    pending.resolve();
    await vi.runAllTicks();
    // 在途清空后，仍在 interpreting 的提案进入下一拍继续轮
    await vi.advanceTimersByTimeAsync(2000);
    expect(刷新).toHaveBeenCalledTimes(4);
    unmount();
  });

  it('unmount 清掉节拍，迟到的完成只落 finally，不再安排任何 GET', async () => {
    vi.useFakeTimers();
    const pending = deferred<void>();
    const 刷新 = vi.fn((_id: string) => pending.promise);
    const { unmount } = renderHook(
      ({ 提案 }) => useAgent规则提案轮询({ 开启: true, 提案, 刷新, 间隔毫秒: 2000 }),
      { initialProps: { 提案: [BFFAgent规则解释中提案样本] } },
    );
    await vi.advanceTimersByTimeAsync(2000);
    expect(刷新).toHaveBeenCalledTimes(1);
    unmount(); // 在飞期间卸载页面
    pending.resolve();
    await vi.runAllTicks(); // 迟到完成：只能清在途，不得再安排后续工作
    await vi.advanceTimersByTimeAsync(8000);
    expect(刷新).toHaveBeenCalledTimes(1);
  });

  it('换一份提案数组（切角色）后轮新 ID，被换下的 ID 不再出现', async () => {
    vi.useFakeTimers();
    const 刷新 = vi.fn(async (_id: string) => undefined);
    const 候选卡 = BFFAgent规则解释中提案样本;
    const 招聘卡 = { ...BFFAgent规则解释中提案样本, proposal_id: 'arp_00fedcba98765432fedcba9876543210' };
    const { rerender } = renderHook(
      ({ 提案 }) => useAgent规则提案轮询({ 开启: true, 提案, 刷新, 间隔毫秒: 2000 }),
      { initialProps: { 提案: [候选卡] } },
    );
    await vi.advanceTimersByTimeAsync(2000);
    expect(刷新).toHaveBeenCalledTimes(1);
    // 页面换上另一角色的提案数组：新 ID 进节拍，旧 ID 不再被点
    rerender({ 提案: [招聘卡] });
    await vi.advanceTimersByTimeAsync(2000);
    expect(刷新).toHaveBeenCalledTimes(2);
    expect(刷新.mock.calls.map(([id]) => id)).toEqual([候选卡.proposal_id, 招聘卡.proposal_id]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(刷新).toHaveBeenCalledTimes(3);
    expect(刷新.mock.calls.every(([id]) => id === 招聘卡.proposal_id || id === 候选卡.proposal_id)).toBe(true);
  });

  it('单发失败被吞掉，下一拍照常重试，不产生未处理 rejection', async () => {
    vi.useFakeTimers();
    let 已失败 = false;
    const 刷新 = vi.fn(async (_id: string) => {
      if (!已失败) {
        已失败 = true;
        throw new Error('恢复读失败');
      }
    });
    renderHook(
      ({ 提案 }) => useAgent规则提案轮询({ 开启: true, 提案, 刷新, 间隔毫秒: 2000 }),
      { initialProps: { 提案: [BFFAgent规则解释中提案样本] } },
    );
    // 第一拍抛错（操作层恢复失败会抛）：钩子吞掉，unhandled rejection 会让本用例失败
    await vi.advanceTimersByTimeAsync(2000);
    await vi.runAllTicks();
    expect(刷新).toHaveBeenCalledTimes(1);
    // 第二拍照常重试
    await vi.advanceTimersByTimeAsync(2000);
    expect(刷新).toHaveBeenCalledTimes(2);
  });
});
