// P2 Task 4：use附件简历刷新 的假时钟生命周期测试。
// 不变量（设计 §9）：mount 且 visible 立即读一次；settle 后且 snapshot active 才在 3000ms 再读
// （active false→true 只排 timer，不产生第二次 immediate GET）；在飞期间推进时间 / visibility /
// effect 重跑都不重叠；hidden / terminal / unmount / Mock / 登出不再读；visible 恢复立即读；
// 「在飞期间 hidden→visible」settle 后立刻补读（active=false 也一样）；后台轮询错误不 toast。

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BFF错误 } from '../数据/HTTP客户端';
import type { BFF附件简历 } from '../数据/BFF契约';
import { use附件简历刷新 } from './附件简历刷新';

const mock轻提示 = vi.hoisted(() => vi.fn());
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

interface 刷新上下文 {
  数据源模式: 'mock' | 'backend';
  后端状态: {
    已登录: boolean;
    主体: { subject_id: string; last_used_role: 'candidate' | 'recruiter' } | null;
    附件简历库: { items: BFF附件简历[]; limits: { max_files: number; max_file_bytes: number; accepted_media_types: ['application/pdf'] } } | null;
  };
  操作: {
    刷新附件简历: () => Promise<void>;
    恢复候选Onboarding预填: () => Promise<void>;
    激活候选Onboarding预填: () => void;
    同步候选Onboarding解析: () => Promise<void>;
    重试候选Onboarding预填: () => Promise<void>;
    继续手填候选Onboarding: () => void;
    确认候选Onboarding预填分区: () => void;
    清候选Onboarding预填: () => void;
  };
}

let mock应用状态: 刷新上下文 | null = null;
let 刷新 = vi.fn(async () => {});

/** 候选 onboarding 预填操作探针（Task 8 回归）：刷新钩子只拥有轮询，
 *  绝不触发预填域 —— 挂上探针只为了让越界调用立刻红。 */
const mock预填操作 = {
  恢复候选Onboarding预填: vi.fn().mockResolvedValue(undefined),
  激活候选Onboarding预填: vi.fn(),
  同步候选Onboarding解析: vi.fn().mockResolvedValue(undefined),
  重试候选Onboarding预填: vi.fn().mockResolvedValue(undefined),
  继续手填候选Onboarding: vi.fn(),
  确认候选Onboarding预填分区: vi.fn(),
  清候选Onboarding预填: vi.fn(),
};

function 行(parse: BFF附件简历['current_version']['parse'], 编号 = 'rf_1'): BFF附件简历 {
  return {
    file_id: 编号,
    display_name: `${编号}.pdf`,
    revision: 1,
    current_version: {
      version_id: 'v1',
      version: 1,
      size_bytes: 1,
      media_type: 'application/pdf',
      sha256: 'a'.repeat(64),
      created_at: 't',
      parse,
    },
    created_at: 't',
    updated_at: 't',
  };
}

const 解析中: BFF附件简历['current_version']['parse'] = { status: 'processing', updated_at: 't' };
const 已完成: BFF附件简历['current_version']['parse'] = { status: 'succeeded', parse_id: 'p', updated_at: 't' };

function 布置(选项: {
  items?: BFF附件简历[];
  已登录?: boolean;
  数据源模式?: 'mock' | 'backend';
  角色?: 'candidate' | 'recruiter';
  subject_id?: string;
}) {
  刷新 = vi.fn(async () => {});
  const 已登录 = 选项.已登录 ?? true;
  mock应用状态 = {
    数据源模式: 选项.数据源模式 ?? 'backend',
    后端状态: {
      已登录,
      主体: 已登录
        ? { subject_id: 选项.subject_id ?? 'sub_1', last_used_role: 选项.角色 ?? 'candidate' }
        : null,
      附件简历库: {
        items: 选项.items ?? [],
        limits: { max_files: 3, max_file_bytes: 2 * 1024 * 1024, accepted_media_types: ['application/pdf'] },
      },
    },
    操作: { 刷新附件简历: () => 刷新(), ...mock预填操作 },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

/** jsdom 的 visibilityState 是原型 getter：这里用可配置的自身属性覆盖，用后删除还原。 */
function 设可见(值: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 值 });
}
function 发可见变化() {
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  vi.useRealTimers();
  // 删掉覆盖用的自身属性，还原 jsdom 原型上的 visibilityState getter
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('use附件简历刷新', () => {
  it('mount visible 立即读一次；settle 后且仍 active 只在 3000ms 再读', async () => {
    vi.useFakeTimers();
    布置({ items: [行(解析中)] });
    const { unmount } = renderHook(() => use附件简历刷新());
    expect(刷新).toHaveBeenCalledTimes(1);
    await vi.runAllTicks(); // 第一发 settle → 排下一次
    expect(刷新).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2999);
    expect(刷新).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(刷新).toHaveBeenCalledTimes(2);
    unmount();
    await vi.runAllTicks();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('active true→false 后不再排 timer；false→true 只排 3 秒 timer，不产生第二次 immediate GET', async () => {
    vi.useFakeTimers();
    布置({ items: [行(解析中)] });
    const { rerender, unmount } = renderHook(() => use附件简历刷新());
    expect(刷新).toHaveBeenCalledTimes(1);
    await vi.runAllTicks(); // settle 后排了 3000ms timer

    布置({ items: [行(已完成)] }); // 全部 terminal：active=false
    rerender();
    await vi.advanceTimersByTimeAsync(10000);
    expect(刷新).toHaveBeenCalledTimes(0); // 不再读
    expect(vi.getTimerCount()).toBe(0); // true→false 清掉了已排 timer

    布置({ items: [行(解析中)] }); // active 翻回 true
    rerender();
    expect(刷新).toHaveBeenCalledTimes(0); // active 翻转本身不立即 GET
    expect(vi.getTimerCount()).toBe(1); // 只排一个 3 秒 timer
    await vi.advanceTimersByTimeAsync(2999);
    expect(刷新).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(刷新).toHaveBeenCalledTimes(1);
    unmount();
    await vi.runAllTicks();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('在飞期间推进时间 / 重复 visibility 不重叠；settle 后立即补一发（immediate 意图不被 owner finally 消费）', async () => {
    vi.useFakeTimers();
    const 待定 = deferred<void>();
    布置({ items: [行(解析中)] });
    刷新.mockImplementation(() => 待定.promise);
    const { unmount } = renderHook(() => use附件简历刷新());
    expect(刷新).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10000); // 在飞：推进再多时间也不发第二发
    expect(刷新).toHaveBeenCalledTimes(1);
    发可见变化(); // 仍 visible 的 visibilitychange：只登记 settle 后立即刷新
    expect(刷新).toHaveBeenCalledTimes(1);
    待定.resolve();
    await vi.runAllTicks(); // owner finally 让位（immediate 意图不被消费）
    await vi.runAllTicks(); // waiter 链比 owner 深一拍：再泄一拍才补读
    expect(刷新).toHaveBeenCalledTimes(2);
    unmount();
    await vi.runAllTicks();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('在飞期间 session effect 重跑（登出→再登录）不产生重叠，settle 后只补一发', async () => {
    vi.useFakeTimers();
    const 待定 = deferred<void>();
    布置({ items: [行(解析中)] });
    刷新.mockImplementation(() => 待定.promise);
    const { rerender, unmount } = renderHook(() => use附件简历刷新());
    expect(刷新).toHaveBeenCalledTimes(1);

    布置({ items: [行(解析中)], 已登录: false }); // 主体清空：session effect 重跑
    rerender();
    布置({ items: [行(解析中)], 已登录: true });
    rerender();
    expect(刷新).toHaveBeenCalledTimes(0); // 单飞标志跨 effect 重跑存活：不重叠

    待定.resolve();
    await vi.runAllTicks(); // owner finally：迟到 settle 只清在途
    await vi.runAllTicks(); // waiter 链补读（比 owner 深一拍）
    expect(刷新).toHaveBeenCalledTimes(1); // 新周期的 immediate waiter 只补一发
    unmount();
    await vi.runAllTicks();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('hidden 挂载不读；visible 恢复立即读；再 hidden 清掉已排 timer', async () => {
    vi.useFakeTimers();
    设可见('hidden');
    布置({ items: [行(解析中)] });
    const { unmount } = renderHook(() => use附件简历刷新());
    await vi.advanceTimersByTimeAsync(10000);
    expect(刷新).not.toHaveBeenCalled();

    设可见('visible');
    发可见变化();
    expect(刷新).toHaveBeenCalledTimes(1); // 立即读，不等 3000ms
    await vi.runAllTicks(); // settle → 排 3000ms
    expect(vi.getTimerCount()).toBe(1);

    设可见('hidden');
    发可见变化();
    expect(vi.getTimerCount()).toBe(0); // hidden 清 timer
    await vi.advanceTimersByTimeAsync(10000);
    expect(刷新).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('「在飞期间 hidden→visible」settle 后立刻再读，不等 3000ms；active=false 也一样', async () => {
    vi.useFakeTimers();
    const 待定 = deferred<void>();
    布置({ items: [行(解析中)] });
    刷新.mockImplementation(() => 待定.promise);
    const { rerender, unmount } = renderHook(() => use附件简历刷新());
    expect(刷新).toHaveBeenCalledTimes(1);

    设可见('hidden');
    发可见变化(); // 在飞期间切后台
    设可见('visible');
    发可见变化(); // 立刻回前台：登记 settle 后立即刷新
    expect(刷新).toHaveBeenCalledTimes(1);

    布置({ items: [行(已完成)] }); // active 翻 false 也不该取消 immediate 意图（新 mock 从 0 计数）
    rerender();
    待定.resolve();
    await vi.runAllTicks(); // owner finally 让位
    await vi.runAllTicks(); // waiter 链补读（比 owner 深一拍）
    expect(刷新).toHaveBeenCalledTimes(1); // 未推进 3000ms 就补读了

    await vi.advanceTimersByTimeAsync(10000);
    expect(刷新).toHaveBeenCalledTimes(1); // active=false：不再轮询
    unmount();
    await vi.runAllTicks();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Mock 模式与招聘方身份不读', async () => {
    vi.useFakeTimers();
    布置({ items: [行(解析中)], 数据源模式: 'mock' });
    const { rerender, unmount } = renderHook(() => use附件简历刷新());
    await vi.advanceTimersByTimeAsync(10000);
    expect(刷新).not.toHaveBeenCalled();

    布置({ items: [行(解析中)], 角色: 'recruiter' });
    rerender();
    await vi.advanceTimersByTimeAsync(10000);
    expect(刷新).not.toHaveBeenCalled();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Mock 模式零候选预填操作：挂载、时间推进与 session effect 重跑都不碰预填域', async () => {
    vi.useFakeTimers();
    布置({ items: [行(解析中)], 数据源模式: 'mock' });
    const { rerender, unmount } = renderHook(() => use附件简历刷新());
    await vi.advanceTimersByTimeAsync(10000);
    // 换主体强制 session effect 在 Mock 模式下重跑一轮（探针是同一组引用，全程计数）
    布置({ items: [行(解析中)], 数据源模式: 'mock', subject_id: 'sub_2' });
    rerender();
    await vi.advanceTimersByTimeAsync(10000);
    expect(刷新).not.toHaveBeenCalled();
    expect(mock预填操作.恢复候选Onboarding预填).not.toHaveBeenCalled();
    expect(mock预填操作.激活候选Onboarding预填).not.toHaveBeenCalled();
    expect(mock预填操作.同步候选Onboarding解析).not.toHaveBeenCalled();
    expect(mock预填操作.重试候选Onboarding预填).not.toHaveBeenCalled();
    expect(mock预填操作.继续手填候选Onboarding).not.toHaveBeenCalled();
    expect(mock预填操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    expect(mock预填操作.清候选Onboarding预填).not.toHaveBeenCalled();
    unmount();
    await vi.runAllTicks();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('登出后不再读，在飞请求迟到 settle 也不补读', async () => {
    vi.useFakeTimers();
    const 待定 = deferred<void>();
    布置({ items: [行(解析中)] });
    刷新.mockImplementation(() => 待定.promise);
    const { rerender, unmount } = renderHook(() => use附件简历刷新());
    expect(刷新).toHaveBeenCalledTimes(1);

    布置({ items: [行(解析中)], 已登录: false });
    rerender();
    待定.resolve();
    await vi.runAllTicks();
    expect(刷新).toHaveBeenCalledTimes(0); // 新周期 mock：登出后不补读
    await vi.advanceTimersByTimeAsync(10000);
    expect(刷新).toHaveBeenCalledTimes(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('启用=false 不读，翻 true 立即读一次', async () => {
    vi.useFakeTimers();
    布置({ items: [行(解析中)] });
    const { rerender, unmount } = renderHook(({ 启用 }) => use附件简历刷新(启用), {
      initialProps: { 启用: false },
    });
    await vi.advanceTimersByTimeAsync(10000);
    expect(刷新).not.toHaveBeenCalled();
    rerender({ 启用: true });
    expect(刷新).toHaveBeenCalledTimes(1);
    unmount();
    await vi.runAllTicks();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('后台轮询错误静默：不 toast，下一拍照常重试', async () => {
    vi.useFakeTimers();
    布置({ items: [行(解析中)] });
    刷新.mockRejectedValueOnce(new BFF错误(503, 'storage_unavailable', '内部细节'));
    const { unmount } = renderHook(() => use附件简历刷新());
    await vi.runAllTicks(); // 第一发 reject 被吞
    expect(刷新).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(刷新).toHaveBeenCalledTimes(2); // 下一拍照常
    await vi.runAllTicks();
    expect(mock轻提示).not.toHaveBeenCalled();
    unmount();
    await vi.runAllTicks();
    expect(vi.getTimerCount()).toBe(0);
  });
});
