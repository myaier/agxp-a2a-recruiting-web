import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import { 创建Agent设置数据源 } from './Agent设置';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

const 候选设置 = {
  material_submission: 'ask_first' as const,
  out_of_authority_concession: 'reject' as const,
  revision: 4,
  updated_at: '2026-09-03T19:00:00Z',
};
const 招聘设置 = {
  out_of_authority_concession: 'ask_first' as const,
  revision: 2,
  updated_at: '2026-09-03T19:00:00Z',
};

describe('Agent设置数据源', () => {
  let 请求: ReturnType<typeof vi.fn>;
  beforeEach(() => { 请求 = vi.fn(); });

  it('双端 GET 走各自路径并禁止缓存', async () => {
    请求.mockResolvedValueOnce({ result: 候选设置 }).mockResolvedValueOnce({ result: 招聘设置 });
    const source = 创建Agent设置数据源(请求 as 请求函数);
    await expect(source.读取Agent设置('candidate')).resolves.toEqual(候选设置);
    await expect(source.读取Agent设置('recruiter')).resolves.toEqual(招聘设置);
    expect(请求.mock.calls.map(([options]) => options)).toEqual([
      { path: '/api/v1/me/agent-settings', 不缓存: true },
      { path: '/api/v1/recruiter/agent-settings', 不缓存: true },
    ]);
  });

  it('PATCH 稀疏写入并携带 revision 与幂等键', async () => {
    请求.mockResolvedValue({ result: { ...候选设置, material_submission: 'auto_send', revision: 5 } });
    const source = 创建Agent设置数据源(请求 as 请求函数);
    await source.修改Agent设置('candidate', { material_submission: 'auto_send' }, 4);
    expect(请求).toHaveBeenCalledWith({
      path: '/api/v1/me/agent-settings',
      method: 'PATCH',
      body: { material_submission: 'auto_send' },
      ifMatch: '"4"',
      幂等: true,
    });
  });

  it('招聘端不接受 material_submission，响应多字段也 fail closed', async () => {
    const source = 创建Agent设置数据源(请求 as 请求函数);
    await expect(source.修改Agent设置('recruiter', { material_submission: 'auto_send' }, 1))
      .rejects.toMatchObject({ code: 'validation_failed' });
    expect(请求).not.toHaveBeenCalled();

    请求.mockResolvedValueOnce({ result: { ...招聘设置, material_submission: 'ask_first' } });
    await expect(source.读取Agent设置('recruiter')).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('未知枚举、缺键和空补丁都在请求边界拒绝', async () => {
    const source = 创建Agent设置数据源(请求 as 请求函数);
    请求.mockResolvedValueOnce({ result: { ...候选设置, material_submission: 'always' } });
    await expect(source.读取Agent设置('candidate')).rejects.toMatchObject({ code: 'invalid_response' });
    await expect(source.修改Agent设置('candidate', {}, 1)).rejects.toMatchObject({ code: 'validation_failed' });
  });

  it.each(['candidate', 'recruiter'] as const)('%s 接受初始 nullable 时间', async (role) => {
    const result = role === 'candidate'
      ? { material_submission: 'ask_first', out_of_authority_concession: 'reject', revision: 0, updated_at: null }
      : { out_of_authority_concession: 'ask_first', revision: 0, updated_at: null };
    请求.mockResolvedValue({ result });
    await expect(创建Agent设置数据源(请求 as 请求函数).读取Agent设置(role))
      .resolves.toEqual(result);
  });

  it('非 null 时间仍须是逐分量合法 RFC3339（带偏移合法）', async () => {
    请求.mockResolvedValueOnce({ result: { ...候选设置, updated_at: '2026-09-03T19:00:00+08:00' } });
    await expect(创建Agent设置数据源(请求 as 请求函数).读取Agent设置('candidate'))
      .resolves.toMatchObject({ updated_at: '2026-09-03T19:00:00+08:00' });
  });

  it.each([
    42,
    '',
    '2026-02-30T00:00:00Z',
    '2026-09-03 19:00:00',
    '2026-09-03T24:00:00Z',
  ])('拒绝非法 updated_at %j', async (updated_at) => {
    请求.mockResolvedValue({ result: { ...候选设置, updated_at } });
    await expect(创建Agent设置数据源(请求 as 请求函数).读取Agent设置('candidate'))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });
});
