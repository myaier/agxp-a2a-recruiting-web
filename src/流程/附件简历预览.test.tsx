// P2 Task 4：use附件PDF预览 的假时钟生命周期测试（设计 §8.3）。
// 固定流程：点击 handler 同步预开空白窗口并隔离 opener → await 下载 → 成功把 object URL
// 导航给预开窗口（popup 被拦则 rel=noopener 临时 anchor 兜底）→ load 后延迟 5 秒回收，
// 30 秒硬兜底并存 → unmount 立即回收；失败关闭窗口并轻提示。任一路径每个 URL 恰好回收一次，
// 结束时不留 timer，object URL 绝不进 React state。

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BFF错误 } from '../数据/HTTP客户端';
import { use附件PDF预览 } from './附件简历预览';

const mock轻提示 = vi.hoisted(() => vi.fn());
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

interface 预览上下文 {
  数据源模式: 'mock' | 'backend';
  后端状态: {
    附件简历库: { items: unknown[]; limits: { max_files: number; max_file_bytes: number; accepted_media_types: ['application/pdf'] } } | null;
  };
  操作: { 下载附件简历: (fileId: string) => Promise<Blob> };
}

let mock应用状态: 预览上下文 | null = null;

function 布置(选项: {
  limits?: { max_files: number; max_file_bytes: number } | null;
  下载?: (fileId: string) => Promise<Blob>;
}) {
  mock应用状态 = {
    数据源模式: 'backend',
    后端状态: {
      附件简历库: {
        items: [],
        limits: {
          max_files: 3,
          max_file_bytes: 选项.limits?.max_file_bytes ?? 2 * 1024 * 1024,
          accepted_media_types: ['application/pdf'],
        },
      },
    },
    操作: { 下载附件简历: 选项.下载 ?? (async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' })) },
  };
}

interface 伪窗口 {
  opener: unknown;
  location: { replace: ReturnType<typeof vi.fn> };
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  触发load: () => void;
}

function 构建伪窗口(): 伪窗口 {
  const load监听: (() => void)[] = [];
  return {
    opener: { 泄漏: true },
    location: { replace: vi.fn() },
    close: vi.fn(),
    addEventListener: vi.fn((类型: string, 回调: () => void) => {
      if (类型 === 'load') load监听.push(回调);
    }),
    触发load: () => load监听.forEach((回调) => 回调()),
  };
}

function 侦察锚元素(): HTMLAnchorElement[] {
  const 锚记录: HTMLAnchorElement[] = [];
  const 原创建 = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((标签: string) => {
    const 元素 = 原创建(标签);
    if (标签 === 'a') 锚记录.push(元素 as HTMLAnchorElement);
    return 元素;
  }) as unknown as typeof document.createElement);
  return 锚记录;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('use附件PDF预览', () => {
  it('同步预开 about:blank 并置 opener=null；成功把 object URL 导航给预开窗口', async () => {
    vi.useFakeTimers();
    const 伪 = 构建伪窗口();
    vi.spyOn(window, 'open').mockReturnValue(伪 as unknown as Window);
    const 下载 = vi.fn(async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
    布置({ 下载 });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf-1');
    const 回收 = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const { result, unmount } = renderHook(() => use附件PDF预览());
    const 完成 = result.current.打开附件PDF('rf_1');
    // 同步段：还没等下载就预开窗口并隔离 opener
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(伪.opener).toBeNull();
    await vi.runAllTicks();
    await 完成;
    expect(下载).toHaveBeenCalledWith('rf_1');
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(伪.location.replace).toHaveBeenCalledWith('blob:pdf-1');
    expect(伪.close).not.toHaveBeenCalled();
    expect(回收).not.toHaveBeenCalled(); // 创建不等于回收
    unmount();
  });

  it('popup load 后 4,999ms 不回收、5,000ms 回收；load 不取消 30 秒硬兜底，释放清两个 timer', async () => {
    vi.useFakeTimers();
    const 伪 = 构建伪窗口();
    vi.spyOn(window, 'open').mockReturnValue(伪 as unknown as Window);
    布置({});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf-load');
    const 回收 = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const { result, unmount } = renderHook(() => use附件PDF预览());
    const 完成 = result.current.打开附件PDF('rf_1');
    await vi.runAllTicks();
    await 完成;
    expect(回收).not.toHaveBeenCalled();

    伪.触发load(); // load 不立即回收，只新增 5 秒延迟释放（此时硬兜底仍在 → 共 2 个 timer）
    expect(回收).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(2);

    await vi.advanceTimersByTimeAsync(4999);
    expect(回收).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(回收).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0); // 释放同时清掉 30 秒硬兜底

    await vi.advanceTimersByTimeAsync(30000);
    expect(回收).toHaveBeenCalledTimes(1); // 任一路径每个 URL 只回收一次
    unmount();
  });

  it('无 load 时 30 秒硬兜底回收', async () => {
    vi.useFakeTimers();
    const 伪 = 构建伪窗口();
    vi.spyOn(window, 'open').mockReturnValue(伪 as unknown as Window);
    布置({});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf-hard');
    const 回收 = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const { result, unmount } = renderHook(() => use附件PDF预览());
    const 完成 = result.current.打开附件PDF('rf_1');
    await vi.runAllTicks();
    await 完成;
    await vi.advanceTimersByTimeAsync(29999);
    expect(回收).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(回收).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });

  it('popup 为 null 时创建 rel=noopener 的临时 anchor 兜底', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'open').mockReturnValue(null);
    布置({});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf-anchor');
    const 回收 = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const 点击 = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const 锚记录 = 侦察锚元素();

    const { result, unmount } = renderHook(() => use附件PDF预览());
    const 完成 = result.current.打开附件PDF('rf_1');
    await vi.runAllTicks();
    await 完成;
    expect(锚记录).toHaveLength(1);
    const 锚 = 锚记录[0];
    expect(锚.getAttribute('rel')).toBe('noopener');
    expect(锚.getAttribute('target')).toBe('_blank');
    expect(锚.getAttribute('href')).toBe('blob:pdf-anchor');
    expect(点击).toHaveBeenCalledTimes(1);
    expect(document.body.contains(锚)).toBe(false); // click 后即移除
    expect(回收).not.toHaveBeenCalled(); // 兜底路径同样走 30 秒兜底，不立即回收

    await vi.advanceTimersByTimeAsync(30000);
    expect(回收).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });

  it('下载失败关闭预开窗口并按 limits 轻提示，服务端 message 不进 UI', async () => {
    vi.useFakeTimers();
    const 伪 = 构建伪窗口();
    vi.spyOn(window, 'open').mockReturnValue(伪 as unknown as Window);
    布置({
      limits: { max_files: 3, max_file_bytes: 5 * 1024 * 1024 },
      下载: async () => {
        throw new BFF错误(413, 'resume_file_too_large', 'sha256:deadbeef request_id:req_9 内部细节');
      },
    });
    const 建URL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf-never');
    const 回收 = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const { result, unmount } = renderHook(() => use附件PDF预览());
    const 完成 = result.current.打开附件PDF('rf_1');
    await vi.runAllTicks();
    await 完成;
    expect(伪.close).toHaveBeenCalledTimes(1);
    expect(mock轻提示).toHaveBeenCalledWith('文件不能超过 5 MB');
    expect(建URL).not.toHaveBeenCalled();
    expect(回收).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0); // 失败路径不留任何 timer
    unmount();
  });

  it('unmount 立即释放仍存活的 URL/timer', async () => {
    vi.useFakeTimers();
    const 伪 = 构建伪窗口();
    vi.spyOn(window, 'open').mockReturnValue(伪 as unknown as Window);
    布置({});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf-unmount');
    const 回收 = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const { result, unmount } = renderHook(() => use附件PDF预览());
    const 完成 = result.current.打开附件PDF('rf_1');
    await vi.runAllTicks();
    await 完成;
    expect(vi.getTimerCount()).toBe(1); // 30 秒硬兜底在排
    unmount();
    expect(回收).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
