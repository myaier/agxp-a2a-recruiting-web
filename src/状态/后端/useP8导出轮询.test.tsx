// P8 Task 5：useP8导出轮询 的假时钟生命周期测试。
// 对齐 spec §7.4：打开/重新可见立即 GET；仍 queued/running 时依次等待 2、4、8 秒，
// 之后 10 秒封顶；状态变化或重新可见重置退避；关闭/卸载/隐藏只停前端计时
// （服务端任务继续）；ready/failed/expired 停表；同拍绝不重叠请求；主体/会话换代的
// 迟到结算不再安排旧周期工作。快照与栅栏归操作层（P8控制面操作.ts）所有，
// 本钩子只持节拍与在途表，依赖全部显式注入，绝不读 Context。

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useP8导出轮询 } from './useP8导出轮询';

afterEach(() => {
  vi.useRealTimers();
});

/** 推进假时钟：触发内部状态更新的用例必须裹 act，避免 React 19 的更新告警。 */
async function 走(毫秒: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(毫秒);
  });
}

/** 可控可见性源：注入 visibility 入参（缺省用 document 的用例不经过这里）。 */
function 创建可见源桩(初始: 'visible' | 'hidden' = 'visible') {
  const 桩 = {
    visibilityState: 初始 as 'visible' | 'hidden',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    触发可见性: (_状态: 'visible' | 'hidden') => {},
  };
  const 听者们: Array<() => void> = [];
  桩.addEventListener = vi.fn((_型: string, 听者: () => void) => { 听者们.push(听者); });
  桩.触发可见性 = (状态: 'visible' | 'hidden') => {
    桩.visibilityState = 状态;
    for (const 听者 of 听者们) 听者();
  };
  return 桩;
}

describe('useP8导出轮询', () => {
  it('打开立即一拍，随后 2s/4s/8s，之后 10s 封顶', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn(async () => undefined);
    renderHook(() => useP8导出轮询({
      enabled: true, exportId: 'exp_1', status: 'running', refresh,
    }));
    expect(refresh).toHaveBeenCalledTimes(1); // immediate on mount/open
    await 走(2_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    await 走(4_000);
    expect(refresh).toHaveBeenCalledTimes(3);
    await 走(8_000);
    expect(refresh).toHaveBeenCalledTimes(4);
    await 走(10_000);
    expect(refresh).toHaveBeenCalledTimes(5); // capped at 10s thereafter
    await 走(10_000);
    expect(refresh).toHaveBeenCalledTimes(6);
    await 走(9_999);
    expect(refresh).toHaveBeenCalledTimes(6); // 封顶后就是恒定 10s 一拍
  });

  it('enabled=false 或 exportId=null 零请求；翻 true 立即一拍，翻回 false 即停', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn(async () => undefined);
    const { rerender } = renderHook(
      ({ enabled, exportId }) => useP8导出轮询({ enabled, exportId, status: 'queued', refresh }),
      { initialProps: { enabled: false as boolean, exportId: 'exp_1' as string | null } },
    );
    await 走(30_000);
    expect(refresh).not.toHaveBeenCalled();
    rerender({ enabled: true, exportId: 'exp_1' });
    expect(refresh).toHaveBeenCalledTimes(1);
    rerender({ enabled: true, exportId: null }); // 没有已知导出 ID：零请求
    await 走(30_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    rerender({ enabled: false, exportId: 'exp_1' }); // 关闭弹层/离开页面：立即停表
    await 走(30_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('ready/failed/expired 是终态：停表零请求（status 未知时照常轮询直到得知状态）', async () => {
    vi.useFakeTimers();
    for (const 终态 of ['ready', 'failed', 'expired'] as const) {
      const refresh = vi.fn(async () => undefined);
      renderHook(() => useP8导出轮询({
        enabled: true, exportId: 'exp_1', status: 终态, refresh,
      }));
      await 走(30_000);
      expect(refresh).not.toHaveBeenCalled();
    }
    const 未知refresh = vi.fn(async () => undefined);
    renderHook(() => useP8导出轮询({
      enabled: true, exportId: 'exp_1', status: null, refresh: 未知refresh,
    }));
    expect(未知refresh).toHaveBeenCalledTimes(1);
    await 走(2_000);
    expect(未知refresh).toHaveBeenCalledTimes(2);
  });

  it('状态变化重置退避：queued→running 后立即一拍，下一拍回到 2 秒', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn(async () => undefined);
    const { rerender } = renderHook(
      ({ status }) => useP8导出轮询({ enabled: true, exportId: 'exp_1', status, refresh }),
      { initialProps: { status: 'queued' as 'queued' | 'running' } },
    );
    await 走(2_000);
    await 走(4_000);
    expect(refresh).toHaveBeenCalledTimes(3); // 0s + 2s + 6s
    await 走(3_000); // 9s：第三拍在 14s（2+4+8），此刻未到
    expect(refresh).toHaveBeenCalledTimes(3);
    rerender({ status: 'running' }); // 状态变化：重置退避 + 立即一拍
    expect(refresh).toHaveBeenCalledTimes(4);
    await 走(1_999);
    expect(refresh).toHaveBeenCalledTimes(4);
    await 走(1); // 新周期 2 秒到点
    expect(refresh).toHaveBeenCalledTimes(5);
  });

  it('同拍绝不重叠：在飞期间到点只跳过，不并发第二发', async () => {
    vi.useFakeTimers();
    let 兑现!: () => void;
    const pending = new Promise<void>((完成) => { 兑现 = 完成; });
    const refresh = vi.fn(() => pending);
    renderHook(() => useP8导出轮询({
      enabled: true, exportId: 'exp_1', status: 'running', refresh,
    }));
    expect(refresh).toHaveBeenCalledTimes(1);
    await 走(60_000); // 第一拍仍在飞：所有到点的拍都被在途表拦下
    expect(refresh).toHaveBeenCalledTimes(1);
    兑现();
    await act(async () => { await vi.runAllTicks(); });
    await 走(10_000); // 在飞收口后，最近一拍到点（封顶 10s 内必达）：节拍照常恢复
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('隐藏停表、重新可见立即一拍并重置退避（服务端任务继续，前端不再计时）', async () => {
    vi.useFakeTimers();
    const 可见源 = 创建可见源桩('visible');
    const refresh = vi.fn(async () => undefined);
    renderHook(() => useP8导出轮询({
      enabled: true, exportId: 'exp_1', status: 'running', refresh,
      visibility: 可见源 as unknown as Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>,
    }));
    expect(refresh).toHaveBeenCalledTimes(1);
    await 走(2_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    act(() => { 可见源.触发可见性('hidden'); });
    await 走(60_000); // 隐藏：到点不发请求也不续排
    expect(refresh).toHaveBeenCalledTimes(2);
    act(() => { 可见源.触发可见性('visible'); });
    expect(refresh).toHaveBeenCalledTimes(3); // 重新可见：立即一拍
    await 走(1_999);
    expect(refresh).toHaveBeenCalledTimes(3);
    await 走(1); // 退避已重置：下一拍 2 秒
    expect(refresh).toHaveBeenCalledTimes(4);
  });

  it('卸载清表：unmount 后不再有任何请求；迟到的完成不安排旧周期工作', async () => {
    vi.useFakeTimers();
    let 兑现!: () => void;
    const pending = new Promise<void>((完成) => { 兑现 = 完成; });
    const refresh = vi.fn(() => pending);
    const { unmount } = renderHook(() => useP8导出轮询({
      enabled: true, exportId: 'exp_1', status: 'running', refresh,
    }));
    expect(refresh).toHaveBeenCalledTimes(1);
    unmount();
    兑现();
    await act(async () => { await vi.runAllTicks(); });
    await 走(60_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('主体/会话换代（exportId 换坐标）：旧周期整包作废，迟到结算不再安排旧节拍', async () => {
    vi.useFakeTimers();
    let 兑现!: () => void;
    const pending = new Promise<void>((完成) => { 兑现 = 完成; });
    const refresh = vi.fn(() => pending);
    const { rerender } = renderHook(
      ({ exportId }) => useP8导出轮询({ enabled: true, exportId, status: 'running', refresh }),
      { initialProps: { exportId: 'exp_A' as string | null } },
    );
    expect(refresh).toHaveBeenCalledTimes(1); // 旧周期立即一拍（仍在飞）
    rerender({ exportId: 'exp_B' }); // 换主体/会话：新坐标立即一拍
    expect(refresh).toHaveBeenCalledTimes(2);
    兑现(); // 旧周期的迟到结算
    await act(async () => { await vi.runAllTicks(); });
    await 走(2_000);
    // 旧周期绝不安排后续：2 秒到点的这一拍属于新周期（其立即拍之后的 2s 拍），旧周期零新增
    expect(refresh).toHaveBeenCalledTimes(3);
  });
});
