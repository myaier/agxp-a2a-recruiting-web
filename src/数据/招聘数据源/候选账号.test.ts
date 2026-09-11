import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type { 建档待写入, 建档写入跟踪 } from '../招聘数据源类型';
import { 创建候选账号数据源 } from './候选账号';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

describe('候选账号数据源', () => {
  const 请求Mock = vi.fn();
  const 数据源 = 创建候选账号数据源(请求Mock as unknown as 请求函数);

  beforeEach(() => 请求Mock.mockReset());

  it('读取账号档案使用 no-store 并闭合解码', async () => {
    请求Mock.mockResolvedValueOnce({
      result: { avatar_url: '/api/v1/me/avatar/content', revision: 2, updated_at: '2026-09-03T19:00:00Z' },
    });
    await expect(数据源.读取候选账号档案()).resolves.toMatchObject({ revision: 2 });
    expect(请求Mock).toHaveBeenCalledWith({ path: '/api/v1/me/account-profile', 不缓存: true });
  });

  it('上传头像只带 media、If-Match 与幂等', async () => {
    请求Mock.mockResolvedValueOnce({
      result: { avatar_url: '/api/v1/me/avatar/content', revision: 3, updated_at: '2026-09-03T19:01:00Z' },
    });
    const file = new File(['a'], 'a.png', { type: 'image/png' });
    await 数据源.替换候选头像(file, 2);
    const options = 请求Mock.mock.calls[0][0] as BFF请求选项;
    expect(options).toMatchObject({ path: '/api/v1/me/avatar', method: 'POST', ifMatch: '"2"', 幂等: true });
    expect([...options.formData!.keys()]).toEqual(['media']);
    expect(options.formData!.get('media')).toBe(file);
  });

  // ── J-PILOT-02 Task 8：onboarding 头像命令的建档跟踪（与 附件简历.ts 文件命令同一模式）──

  it('带跟踪：发送前固定 avatar 命令（五键文件核对 + 原 revision 的 ifMatch），请求沿用跟踪回带的原幂等键/原 ifMatch，成功后立刻交 account revision 回执', async () => {
    请求Mock.mockResolvedValueOnce({
      result: { avatar_url: '/api/v1/me/avatar/content', revision: 8, updated_at: '2026-09-03T19:02:00Z' },
    });
    const file = new File(['a'], 'a.png', { type: 'image/png' });
    const 已确认 = vi.fn();
    const 发送前 = vi.fn((命令: 建档待写入): 建档待写入 =>
      ({ ...命令, 幂等键: 'idem-avatar-original-1', ifMatch: 3 }));
    await 数据源.替换候选头像(file, 7, { 发送前, 已确认 } as 建档写入跟踪);
    // 命令：avatar 种类、本次 GET 回的 revision 作 ifMatch、prepared、五键文件核对（绝不存字节）
    const 命令 = 发送前.mock.calls[0][0];
    expect(命令.种类).toBe('avatar');
    expect(命令.ifMatch).toBe(7);
    expect(命令.阶段).toBe('prepared');
    expect(Object.keys(命令.文件核对!).sort()).toEqual(['lastModified', 'name', 'sha256', 'size', 'type']);
    // 请求沿用跟踪回带的原键与原 ifMatch —— revision 也是幂等身份，不用新快照的 7 冒充原命令
    const options = 请求Mock.mock.calls[0][0] as BFF请求选项;
    expect(options.幂等键).toBe('idem-avatar-original-1');
    expect(options.ifMatch).toBe('"3"');
    // 成功后立刻交回执（只带 account revision，不存完整响应）
    expect(已确认).toHaveBeenCalledWith(
      expect.objectContaining({ 种类: 'avatar', 幂等键: 'idem-avatar-original-1', ifMatch: 3 }),
      { revision: 8 },
    );
  });

  it('SHA-256 不可用：命令不带文件核对（认不出字节的命令由调用方不登记），请求照常发出', async () => {
    const 摘要桩 = vi.spyOn(globalThis.crypto.subtle, 'digest')
      .mockRejectedValue(new Error('SubtleCrypto unavailable'));
    try {
      请求Mock.mockResolvedValueOnce({ result: { avatar_url: null, revision: 2, updated_at: null } });
      const file = new File(['a'], 'a.png', { type: 'image/png' });
      const 已确认 = vi.fn();
      const 发送前 = vi.fn((命令: 建档待写入): 建档待写入 => 命令);
      await 数据源.替换候选头像(file, 1, { 发送前, 已确认 } as 建档写入跟踪);
      expect(发送前.mock.calls[0][0].文件核对).toBeUndefined();
      expect(请求Mock).toHaveBeenCalledTimes(1); // 上传本身照常
      expect(已确认).toHaveBeenCalledTimes(1);
    } finally {
      摘要桩.mockRestore();
    }
  });

  it('删除头像带 If-Match 与幂等且没有请求体', async () => {
    请求Mock.mockResolvedValueOnce({ result: { avatar_url: null, revision: 4, updated_at: null } });
    await 数据源.删除候选头像(3);
    expect(请求Mock).toHaveBeenCalledWith({
      path: '/api/v1/me/avatar', method: 'DELETE', ifMatch: '"3"', 幂等: true,
    });
  });

  it('拒绝未知字段、任意头像地址和负 revision', async () => {
    for (const result of [
      { avatar_url: null, revision: 0, updated_at: null, extra: true },
      { avatar_url: 'https://example.com/a.png', revision: 0, updated_at: null },
      { avatar_url: null, revision: -1, updated_at: null },
    ]) {
      请求Mock.mockResolvedValueOnce({ result });
      await expect(数据源.读取候选账号档案()).rejects.toMatchObject({ code: 'invalid_response' });
    }
  });
});
