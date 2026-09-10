// useCasePDF预览 · 控制测试（契约 C 的 PDF 分支，Task 7 自 屏幕/P5/MatchCase详情 的
// 详情主体 原样搬入，租约/在飞/代际生命周期逐项对照旧实现）：
//   · 挂载零请求（打开 是唯一触发，绝不预取）；连点只发一次请求（在飞单飞），
//     弹层已开时再点零新请求；
//   · 读取只走 (role, caseId) 的 Case 专属 role 路径，双角色各读各的臂；
//   · 关闭/换 Case/换角色/卸载都立即回收租约并清预览；重复关闭幂等（不二次 revoke）；
//   · 迟到的成功租约立刻回收（只回收自己那张，不碰新单租约），不开弹层不写 state；
//   · 迟到的失败不向新页提示；当前代际的失败轻提示 取后端错误文案 的文案；
//   · 换代释放在飞标志：新单第一次点击不被上一单的在飞锁挡住。
// 租约绝不写全局缓存：hook 内部只有 ref/state，无模块级租约表。
// 屏级回归（typed 附件入口、S1 有时间线时入口仍在、真实弹层渲染）归
// 屏幕/P5/MatchCase详情.test.tsx 的既有用例，本文件只钉控制合同。

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCasePDF预览 } from './useCasePDF预览';
import { 取后端错误文案 } from '../../数据/HTTP客户端';
import type { P5角色 } from '../../数据/MatchCase展示映射';
import type { PDF对象租约 } from '../../数据/PDF对象租约';
import type { 应用操作 } from '../../状态/后端/类型';

const mock轻提示 = vi.hoisted(() => vi.fn());
vi.mock('../../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

/** 测试外置可控 promise：手动决定 settle 时机（在途读取夹具用）。 */
function 可控Promise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** 租约桩：url 唯一标识，revoke 计数即回收证据。 */
function 建租约(url: string): PDF对象租约 {
  return { url, revoke: vi.fn(() => undefined) };
}

/** 操作桩签名与 应用操作.读取简历PDF 同形（避免 vi.fn 推导宽类型过不了合同检查）。 */
type 读取桩 = 应用操作['读取简历PDF'];
type 预览输入 = Parameters<typeof useCasePDF预览>[0];

/** 恒成功的默认读取桩（失败/在途用例各自覆写）。 */
function 默认读取(租约: PDF对象租约): 读取桩 {
  return vi.fn(async (): Promise<PDF对象租约> => 租约);
}

/** 挂 hook 的统一入口（默认 candidate/mc_a，与 屏级测试 的角色·单坐标同形）。 */
function 挂预览(选项: { role?: P5角色; caseId?: string; 读取: 读取桩 }) {
  const 初始: 预览输入 = {
    role: 选项.role ?? 'candidate',
    caseId: 选项.caseId ?? 'mc_a',
    读取: 选项.读取,
  };
  return renderHook((props: 预览输入) => useCasePDF预览(props), { initialProps: 初始 });
}

beforeEach(() => {
  mock轻提示.mockClear();
});

describe('useCasePDF预览 · 打开与在飞单发', () => {
  it('挂载零请求：打开 是唯一触发，绝不预取文件', () => {
    const 读取 = 默认读取(建租约('blob:x'));
    挂预览({ 读取 });
    expect(读取).not.toHaveBeenCalled();
  });

  it('打开成功后预览以 (文件名, 租约地址) 挂出；弹层开着时再点零新请求', async () => {
    const 租约 = 建租约('blob:p5-resume');
    const 读取 = 默认读取(租约);
    const { result } = 挂预览({ 读取 });
    expect(result.current.预览).toBeNull();
    await act(async () => {
      await result.current.打开('后端工程师_简历_v1.pdf');
    });
    expect(读取).toHaveBeenCalledTimes(1);
    expect(读取).toHaveBeenCalledWith('candidate', 'mc_a');
    expect(result.current.预览).toEqual({ 文件名: '后端工程师_简历_v1.pdf', 地址: 'blob:p5-resume' });
    expect(租约.revoke).not.toHaveBeenCalled();
    // 弹层已开：预览在场即挡住第二发（防连点的另一半）
    await act(async () => {
      await result.current.打开('后端工程师_简历_v1.pdf');
    });
    expect(读取).toHaveBeenCalledTimes(1);
  });

  it('在飞中的连点只发一次请求；settle 后才开预览', async () => {
    const 门 = 可控Promise<PDF对象租约>();
    const 读取 = vi.fn(((): Promise<PDF对象租约> => 门.promise));
    const { result } = 挂预览({ 读取 });
    await act(async () => {
      void result.current.打开('后端工程师_简历_v1.pdf');
    });
    await act(async () => {
      void result.current.打开('后端工程师_简历_v1.pdf');
    });
    await act(async () => {
      void result.current.打开('后端工程师_简历_v1.pdf');
    });
    expect(读取).toHaveBeenCalledTimes(1);
    expect(result.current.预览).toBeNull();
    await act(async () => {
      门.resolve(建租约('blob:once'));
      await 门.promise;
    });
    expect(result.current.预览).toEqual({ 文件名: '后端工程师_简历_v1.pdf', 地址: 'blob:once' });
  });

  it('双角色读各自 role/case：candidate 与 recruiter 各走各的 Case 专属臂', async () => {
    const 读取 = 默认读取(建租约('blob:x'));
    const { result, rerender } = 挂预览({ role: 'candidate', caseId: 'mc_direct', 读取 });
    await act(async () => {
      await result.current.打开('后端工程师_简历_v1.pdf');
    });
    expect(读取).toHaveBeenLastCalledWith('candidate', 'mc_direct');
    // 换角色/换单（换代回收后）读的是新臂新单，不复用旧路径
    await act(async () => {
      rerender({ role: 'recruiter', caseId: 'mc_hr', 读取 });
    });
    await act(async () => {
      await result.current.打开('后端工程师_简历_v2.pdf');
    });
    expect(读取).toHaveBeenLastCalledWith('recruiter', 'mc_hr');
    expect(读取).toHaveBeenCalledTimes(2);
  });
});

describe('useCasePDF预览 · 回收（关闭/换 Case/换角色/卸载）', () => {
  it('关闭即回收租约并清预览；重复关闭幂等（不二次 revoke、不重取）', async () => {
    const 租约 = 建租约('blob:p5-resume');
    const 读取 = 默认读取(租约);
    const { result } = 挂预览({ 读取 });
    await act(async () => {
      await result.current.打开('后端工程师_简历_v1.pdf');
    });
    await act(async () => {
      result.current.关闭();
    });
    expect(租约.revoke).toHaveBeenCalledTimes(1);
    expect(result.current.预览).toBeNull();
    await act(async () => {
      result.current.关闭(); // 幂等：引用已空，不再 revoke
    });
    expect(租约.revoke).toHaveBeenCalledTimes(1);
    expect(读取).toHaveBeenCalledTimes(1); // 关闭不重取
  });

  it('弹层开着时卸载：租约立即回收', async () => {
    const 租约 = 建租约('blob:p5-resume');
    const 读取 = 默认读取(租约);
    const { result, unmount } = 挂预览({ 读取 });
    await act(async () => {
      await result.current.打开('后端工程师_简历_v1.pdf');
    });
    act(() => {
      unmount();
    });
    expect(租约.revoke).toHaveBeenCalledTimes(1);
  });

  it('换 Case 立即清预览并回收（不等关闭）', async () => {
    const 租约 = 建租约('blob:old-case');
    const 读取 = 默认读取(租约);
    const { result, rerender } = 挂预览({ caseId: 'mc_a', 读取 });
    await act(async () => {
      await result.current.打开('后端工程师_简历_v1.pdf');
    });
    expect(result.current.预览).not.toBeNull();
    await act(async () => {
      rerender({ role: 'candidate', caseId: 'mc_other', 读取 });
    });
    expect(租约.revoke).toHaveBeenCalledTimes(1);
    expect(result.current.预览).toBeNull();
  });

  it('换角色立即清预览并回收（同 Case 也不沿用）', async () => {
    const 租约 = 建租约('blob:cand');
    const 读取 = 默认读取(租约);
    const { result, rerender } = 挂预览({ role: 'candidate', caseId: 'mc_a', 读取 });
    await act(async () => {
      await result.current.打开('后端工程师_简历_v1.pdf');
    });
    await act(async () => {
      rerender({ role: 'recruiter', caseId: 'mc_a', 读取 });
    });
    expect(租约.revoke).toHaveBeenCalledTimes(1);
    expect(result.current.预览).toBeNull();
  });
});

describe('useCasePDF预览 · 迟到响应（局部代际栅栏）', () => {
  it('在途卸载：迟到成功立即回收，不开预览不写 state', async () => {
    const 门 = 可控Promise<PDF对象租约>();
    const 读取 = vi.fn(((): Promise<PDF对象租约> => 门.promise));
    const { result, unmount } = 挂预览({ 读取 });
    await act(async () => {
      void result.current.打开('后端工程师_简历_v1.pdf');
    });
    act(() => {
      unmount();
    });
    const 迟到 = 建租约('blob:late');
    await act(async () => {
      门.resolve(迟到);
      await 门.promise;
    });
    expect(迟到.revoke).toHaveBeenCalledTimes(1);
  });

  it('在途换 Case：新单第一次点击不被旧在飞锁挡住；旧单迟到成功只回收自己那张', async () => {
    const 旧门 = 可控Promise<PDF对象租约>();
    const 旧租约 = 建租约('blob:old-case');
    const 新租约 = 建租约('blob:new-case');
    const 读取 = vi.fn(((): Promise<PDF对象租约> => Promise.resolve(新租约)));
    读取.mockReturnValueOnce(旧门.promise);
    const { result, rerender } = 挂预览({ caseId: 'mc_a', 读取 });
    await act(async () => {
      void result.current.打开('后端工程师_简历_v1.pdf');
    });
    await act(async () => {
      rerender({ role: 'candidate', caseId: 'mc_other', 读取 });
    });
    // 换代即释放在飞标志：新单立即能点（不被上一单的在飞锁挡住）
    await act(async () => {
      await result.current.打开('后端工程师_简历_v2.pdf');
    });
    expect(读取).toHaveBeenLastCalledWith('candidate', 'mc_other');
    expect(result.current.预览).toEqual({ 文件名: '后端工程师_简历_v2.pdf', 地址: 'blob:new-case' });
    // 旧单迟到成功：只回收自己那张，不碰新单租约/预览
    await act(async () => {
      旧门.resolve(旧租约);
      await 旧门.promise;
    });
    expect(旧租约.revoke).toHaveBeenCalledTimes(1);
    expect(新租约.revoke).not.toHaveBeenCalled();
    expect(result.current.预览).toEqual({ 文件名: '后端工程师_简历_v2.pdf', 地址: 'blob:new-case' });
  });

  it('当前代际读取失败：轻提示安全文案（取后端错误文案），不开预览', async () => {
    const 读取 = vi.fn(((): Promise<PDF对象租约> => Promise.reject(new Error('读取失败'))));
    const { result } = 挂预览({ 读取 });
    await act(async () => {
      await result.current.打开('后端工程师_简历_v1.pdf');
    });
    expect(mock轻提示).toHaveBeenCalledTimes(1);
    expect(mock轻提示).toHaveBeenCalledWith(取后端错误文案(new Error('读取失败')));
    expect(result.current.预览).toBeNull();
  });

  it('在途换 Case 后迟到失败：不向新页提示', async () => {
    const 门 = 可控Promise<PDF对象租约>();
    const 读取 = vi.fn(((): Promise<PDF对象租约> => 门.promise));
    const { result, rerender } = 挂预览({ caseId: 'mc_a', 读取 });
    await act(async () => {
      void result.current.打开('后端工程师_简历_v1.pdf');
    });
    await act(async () => {
      rerender({ role: 'candidate', caseId: 'mc_other', 读取 });
    });
    await act(async () => {
      门.reject(new Error('迟到失败'));
      await 门.promise.catch(() => undefined);
    });
    expect(mock轻提示).not.toHaveBeenCalled();
  });
});
