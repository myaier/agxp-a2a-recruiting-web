import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
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
