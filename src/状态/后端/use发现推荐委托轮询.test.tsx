// P4 Task 5：use发现推荐委托轮询 的假时钟生命周期测试。
// 对齐设计 §8.3：只在 开启 时排一个 interval；只轮页面传入的 accepted/evaluating 委托；
// 同一 delegation 同时最多一个 GET；卸载/关闭即停并重置计数与暂停表；
// 连续 5 次非 401 失败进暂停表（本周期跳过），一次成功只清该委托的计数；
// 401 属统一清理，绝不变成暂停标记。
// 注：仓库未装 @testing-library/jest-dom，断言一律用调用计数与 toBe/toEqual。

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BFF错误 } from '../../数据/HTTP客户端';
import { P4委托进度未知文案, use发现推荐委托轮询 } from './use发现推荐委托轮询';
import type { 可轮询委托 } from './use发现推荐委托轮询';

const 活跃 = (delegationId: string, role: 可轮询委托['role'] = 'candidate'): 可轮询委托 =>
  ({ role, delegationId, state: 'accepted' });

afterEach(() => {
  // 假时钟每个用例后恢复，避免泄漏进其它测试文件
  vi.useRealTimers();
});

/** 推进假时钟：触发暂停表 state 更新的用例必须裹 act，避免 React 19 的更新告警。 */
async function 走(毫秒: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(毫秒);
  });
}

describe('use发现推荐委托轮询', () => {
  it('polls accepted receipts every two seconds and stops at case_started', async () => {
    vi.useFakeTimers();
    const 刷新委托 = vi.fn().mockResolvedValue(undefined);
    const active = [{ role: 'candidate' as const, delegationId: 'del_1', state: 'accepted' as const }];
    const { rerender } = renderHook(
      ({ 委托 }) => use发现推荐委托轮询({
        开启: true, 委托, 刷新: 刷新委托, 间隔毫秒: 2_000,
      }),
      { initialProps: { 委托: active } },
    );
    await vi.advanceTimersByTimeAsync(2_000);
    expect(刷新委托).toHaveBeenCalledTimes(1);
    rerender({ 委托: [] }); // operation committed case_started; selector no longer returns it
    await vi.advanceTimersByTimeAsync(4_000);
    expect(刷新委托).toHaveBeenCalledTimes(1);
  });

  it('开启=false 不起节拍，翻 true 后从默认 2 秒起轮，翻回 false 即停', async () => {
    vi.useFakeTimers();
    const 刷新委托 = vi.fn(async (_role: 可轮询委托['role'], _id: string) => undefined);
    const { rerender } = renderHook(
      ({ 开启, 委托 }) => use发现推荐委托轮询({ 开启, 委托, 刷新: 刷新委托 }),
      { initialProps: { 开启: false, 委托: [活跃('del_off')] } },
    );
    // Mock 模式 / 会话未就绪：页面传 开启=false，绝不能发 GET
    await 走(6000);
    expect(刷新委托).not.toHaveBeenCalled();
    rerender({ 开启: true, 委托: [活跃('del_off')] });
    await 走(2000);
    expect(刷新委托).toHaveBeenCalledTimes(1);
    // 离开页面 / 会话或角色切换：interval 清掉，不再发
    rerender({ 开启: false, 委托: [活跃('del_off')] });
    await 走(6000);
    expect(刷新委托).toHaveBeenCalledTimes(1);
  });

  it('同一 delegation 同时最多一个在飞 GET，完成后下一拍继续', async () => {
    vi.useFakeTimers();
    const pending = deferred<void>();
    const 刷新委托 = vi.fn(() => pending.promise);
    const { unmount } = renderHook(
      ({ 委托 }) => use发现推荐委托轮询({ 开启: true, 委托, 刷新: 刷新委托, 间隔毫秒: 2000 }),
      { initialProps: { 委托: [活跃('del_inflight')] } },
    );
    await 走(2000);
    expect(刷新委托).toHaveBeenCalledTimes(1);
    await 走(4000); // 在途期间绝不并发第二发
    expect(刷新委托).toHaveBeenCalledTimes(1);
    pending.resolve();
    await act(async () => {
      await vi.runAllTicks();
    });
    await 走(2000);
    expect(刷新委托).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('多个委托各轮一发，双端角色都按原样传给刷新函数', async () => {
    vi.useFakeTimers();
    const 刷新委托 = vi.fn(async (_role: 可轮询委托['role'], _id: string) => undefined);
    renderHook(
      ({ 委托 }) => use发现推荐委托轮询({ 开启: true, 委托, 刷新: 刷新委托, 间隔毫秒: 2000 }),
      { initialProps: { 委托: [活跃('del_a'), 活跃('del_b', 'recruiter')] } },
    );
    await 走(2000);
    expect(刷新委托).toHaveBeenCalledTimes(2);
    expect(刷新委托).toHaveBeenCalledWith('candidate', 'del_a');
    expect(刷新委托).toHaveBeenCalledWith('recruiter', 'del_b');
  });

  it('非活跃/被摘除的委托立刻退出节拍，其余照常', async () => {
    vi.useFakeTimers();
    const 刷新委托 = vi.fn(async (_role: 可轮询委托['role'], _id: string) => undefined);
    const { rerender } = renderHook(
      ({ 委托 }) => use发现推荐委托轮询({ 开启: true, 委托, 刷新: 刷新委托, 间隔毫秒: 2000 }),
      { initialProps: { 委托: [活跃('del_keep'), 活跃('del_drop')] } },
    );
    await 走(2000);
    expect(刷新委托).toHaveBeenCalledTimes(2);
    // 终态提交后页面 selector 把 del_drop 摘出数组：后续节拍只剩 del_keep
    rerender({ 委托: [活跃('del_keep')] });
    await 走(2000);
    expect(刷新委托).toHaveBeenCalledTimes(3);
    expect(刷新委托.mock.calls[2]?.[1]).toBe('del_keep');
    await 走(2000);
    expect(刷新委托).toHaveBeenCalledTimes(4);
    expect(刷新委托.mock.calls[3]?.[1]).toBe('del_keep');
  });

  it('unmount 清掉节拍，迟到的完成只落在途清理，不再安排任何 GET', async () => {
    vi.useFakeTimers();
    const pending = deferred<void>();
    const 刷新委托 = vi.fn(() => pending.promise);
    const { unmount } = renderHook(
      ({ 委托 }) => use发现推荐委托轮询({ 开启: true, 委托, 刷新: 刷新委托, 间隔毫秒: 2000 }),
      { initialProps: { 委托: [活跃('del_late')] } },
    );
    await 走(2000);
    expect(刷新委托).toHaveBeenCalledTimes(1);
    unmount(); // 在飞期间卸载页面
    pending.resolve();
    await act(async () => {
      await vi.runAllTicks();
    });
    await 走(8000);
    expect(刷新委托).toHaveBeenCalledTimes(1);
  });

  it('单发失败被吞掉，下一拍照常重试，不产生未处理 rejection', async () => {
    vi.useFakeTimers();
    let 已失败 = false;
    const 刷新委托 = vi.fn(async (_role: 可轮询委托['role'], _id: string) => {
      if (!已失败) {
        已失败 = true;
        throw new BFF错误(503, 'source_unavailable', 'down');
      }
    });
    renderHook(
      ({ 委托 }) => use发现推荐委托轮询({ 开启: true, 委托, 刷新: 刷新委托, 间隔毫秒: 2000 }),
      { initialProps: { 委托: [活跃('del_retry')] } },
    );
    await 走(2000);
    await act(async () => {
      await vi.runAllTicks();
    });
    expect(刷新委托).toHaveBeenCalledTimes(1);
    await 走(2000);
    expect(刷新委托).toHaveBeenCalledTimes(2);
  });

  it('连续四次失败仍不上暂停表，第五次进入暂停并跳过后续节拍；中性文案逐字冻结', async () => {
    vi.useFakeTimers();
    const 刷新委托 = vi.fn(async () => {
      throw new BFF错误(503, 'source_unavailable', 'down');
    });
    const { result, unmount } = renderHook(
      ({ 委托 }) => use发现推荐委托轮询({ 开启: true, 委托, 刷新: 刷新委托, 间隔毫秒: 2000 }),
      { initialProps: { 委托: [活跃('del_pause')] } },
    );
    await 走(2000);
    await 走(2000);
    await 走(2000);
    await 走(2000);
    expect(刷新委托).toHaveBeenCalledTimes(4);
    expect(result.current.has('del_pause')).toBe(false);
    await 走(2000); // 第五次连续非 401 失败
    expect(刷新委托).toHaveBeenCalledTimes(5);
    expect(result.current.has('del_pause')).toBe(true);
    expect([...result.current]).toEqual(['del_pause']);
    // 暂停后同一节拍周期不再为它发 GET
    await 走(6000);
    expect(刷新委托).toHaveBeenCalledTimes(5);
    expect(P4委托进度未知文案).toBe('暂时无法确认进度，请稍后刷新');
    unmount();
  });

  it('一次成功把该委托的连续失败计数清零，重数到五才暂停', async () => {
    vi.useFakeTimers();
    let 已失败次数 = 0;
    const 刷新委托 = vi.fn(async () => {
      已失败次数 += 1;
      // 失败 4 次 → 成功 1 次（清零）→ 再失败 4 次仍不暂停 → 第 10 拍（连续第 5 次失败）才暂停
      if (已失败次数 !== 5) throw new BFF错误(503, 'source_unavailable', 'down');
    });
    const { result, unmount } = renderHook(
      ({ 委托 }) => use发现推荐委托轮询({ 开启: true, 委托, 刷新: 刷新委托, 间隔毫秒: 2000 }),
      { initialProps: { 委托: [活跃('del_reset')] } },
    );
    for (let 拍 = 1; 拍 <= 9; 拍 += 1) {
      await 走(2000);
      expect(刷新委托).toHaveBeenCalledTimes(拍);
      expect(result.current.has('del_reset')).toBe(false);
    }
    await 走(2000); // 第 10 拍：成功重置后的第 5 次连续失败
    expect(刷新委托).toHaveBeenCalledTimes(10);
    expect(result.current.has('del_reset')).toBe(true);
    unmount();
  });

  it('401 只留给统一清理，绝不变成暂停标记', async () => {
    vi.useFakeTimers();
    const 刷新委托 = vi.fn(async () => {
      throw new BFF错误(401, 'invalid_session', 'expired');
    });
    const { result, unmount } = renderHook(
      ({ 委托 }) => use发现推荐委托轮询({ 开启: true, 委托, 刷新: 刷新委托, 间隔毫秒: 2000 }),
      { initialProps: { 委托: [活跃('del_401')] } },
    );
    for (let 拍 = 1; 拍 <= 7; 拍 += 1) {
      await 走(2000);
      expect(刷新委托).toHaveBeenCalledTimes(拍);
      expect(result.current.has('del_401')).toBe(false);
    }
    unmount();
  });

  it('周期清理重置计数与暂停表：翻 false 清空 Set，翻 true 后从头起算', async () => {
    vi.useFakeTimers();
    const 刷新委托 = vi.fn(async () => {
      throw new BFF错误(503, 'source_unavailable', 'down');
    });
    const { result, rerender } = renderHook(
      ({ 开启, 委托 }) => use发现推荐委托轮询({ 开启, 委托, 刷新: 刷新委托, 间隔毫秒: 2000 }),
      { initialProps: { 开启: true, 委托: [活跃('del_cycle')] } },
    );
    for (let 拍 = 1; 拍 <= 5; 拍 += 1) {
      await 走(2000);
    }
    expect(刷新委托).toHaveBeenCalledTimes(5);
    expect(result.current.has('del_cycle')).toBe(true);
    // 离开页面：清理把暂停表清空 —— 重进页面是一轮全新的有界轮询
    rerender({ 开启: false, 委托: [活跃('del_cycle')] });
    expect(result.current.size).toBe(0);
    rerender({ 开启: true, 委托: [活跃('del_cycle')] });
    await 走(2000);
    expect(刷新委托).toHaveBeenCalledTimes(6); // 新周期第一拍
    expect(result.current.has('del_cycle')).toBe(false); // 连续第 1 次失败，远未到上界
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
