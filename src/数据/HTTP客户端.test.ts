import { describe, expect, it, vi } from 'vitest';
import { BFF错误, type BFF请求选项, 创建BFF客户端, 取后端错误文案 } from './HTTP客户端';

describe('BFF HTTP 客户端', () => {
  it('始终带 Cookie，并返回 result、ETag', async () => {
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({ result: { job_id: 'job_1' }, meta: { request_id: 'r1', api_version: 'v1' } }),
      { status: 200, headers: { 'Content-Type': 'application/json', ETag: '"3"' } },
    ));
    const client = 创建BFF客户端({ fetcher, 生成幂等键: () => 'idem-fixed' });
    await expect(client.请求<{ job_id: string }>({ path: '/api/v1/recruiter/jobs/job_1' }))
      .resolves.toMatchObject({ result: { job_id: 'job_1' }, etag: '"3"' });
    expect(fetcher).toHaveBeenCalledWith('/api/v1/recruiter/jobs/job_1', expect.objectContaining({ credentials: 'include' }));
  });

  it('创建请求生成一次幂等键并在 outcome unknown 时复用', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ error: { type: 'operation_outcome_unknown', message: 'unknown' } }),
        { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '0' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ result: { job_id: 'job_1' }, meta: { request_id: 'r2', api_version: 'v1' } }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ));
    const client = 创建BFF客户端({ fetcher, 生成幂等键: () => 'idem-fixed', 等待: async () => {} });
    await client.请求({ path: '/api/v1/recruiter/jobs', method: 'POST', body: {}, 幂等: true });
    expect(fetcher.mock.calls.map(([, init]) => new Headers(init?.headers).get('Idempotency-Key')))
      .toEqual(['idem-fixed', 'idem-fixed']);
  });

  it('发送 If-Match 并保留结构化校验错误', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(
      JSON.stringify({ error: { type: 'validation_failed', message: 'bad', fields: [{ path: 'title', reason: 'required' }] } }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    ));
    const client = 创建BFF客户端({ fetcher, 生成幂等键: () => 'idem-fixed' });
    await expect(client.请求({ path: '/api/v1/recruiter/jobs/job_1', method: 'PATCH', body: {}, ifMatch: '"2"' }))
      .rejects.toMatchObject({ status: 422, code: 'validation_failed', fieldErrors: [{ path: 'title', reason: 'required' }] });
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('If-Match')).toBe('"2"');
  });

  // Task 2：BFF 字段错误为有序数组（{path,reason}），保留服务端给定顺序，不再按对象 key 解析。
  it('解析有序字段错误数组', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: {
      type: 'validation_failed', message: 'bad',
      fields: [{ path: 'compensation.lower', reason: 'required' }],
    } }), { status: 422, headers: { 'Content-Type': 'application/json' } }));
    await expect(创建BFF客户端({ fetcher, 生成幂等键: () => 'k' }).请求({ path: '/api/v1/me/intentions', method: 'POST', body: {} }))
      .rejects.toMatchObject({ fieldErrors: [{ path: 'compensation.lower', reason: 'required' }] });
  });

  it('普通网络错误不调用任何 Mock 数据源', async () => {
    const fetcher = vi.fn(async () => { throw new TypeError('offline'); });
    const client = 创建BFF客户端({ fetcher, 生成幂等键: () => 'idem-fixed' });
    await expect(client.请求({ path: '/api/v1/session' })).rejects.toMatchObject({ code: 'network_error' });
    expect(fetcher).toHaveBeenCalledTimes(2); // 初次读取 + 唯一一次读取重试
  });

  it('区分网络、后端不可用与异常响应的用户提示', () => {
    expect(取后端错误文案(new BFF错误(0, 'network_error', 'fetch failed')))
      .toBe('无法连接后端服务，请检查网络或稍后重试');
    for (const status of [502, 503, 504]) {
      expect(取后端错误文案(new BFF错误(status, 'downstream_unavailable', 'down')))
        .toBe('后端服务暂时不可用，请稍后重试');
    }
    expect(取后端错误文案(new BFF错误(200, 'invalid_response', 'bad payload')))
      .toBe('服务返回异常，请稍后重试');
  });

  it('FormData 原样发送且不手写 Content-Type', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(
      JSON.stringify({ result: { ok: true }, meta: { request_id: 'r1', api_version: 'v1' } }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    ));
    const formData = new FormData();
    formData.append('media', new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' }));
    await 创建BFF客户端({ fetcher, 生成幂等键: () => 'idem-fixed-0001' })
      .请求({ path: '/api/v1/recruiter/avatar', method: 'POST', formData, 幂等: true });
    const init = fetcher.mock.calls[0][1]!;
    expect(init.body).toBe(formData);
    expect(new Headers(init.headers).has('Content-Type')).toBe(false);
  });

  it('204 成功返回 undefined 而不解析 JSON', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    await expect(创建BFF客户端({ fetcher }).请求<void>({
      path: '/api/v1/organizations/org_1/media/media_1', method: 'DELETE',
    })).resolves.toMatchObject({ result: undefined });
  });

  it('运行时拒绝绕过类型系统同时提供 JSON body 与 FormData', async () => {
    await expect(创建BFF客户端().请求({
      path: '/api/v1/recruiter/avatar', method: 'POST', body: {}, formData: new FormData(),
    } as unknown as BFF请求选项)).rejects.toThrow('body 与 formData 不能同时提供');
  });

  // P4：调用方显式传入的幂等键（一次用户意图在结果未知后可跨调用复用）必须原样落在
  // Idempotency-Key 上：覆盖键生成器，且受控重试复用同一把。
  it('调用方提供的幂等键覆盖生成器并在受控重试中保持不变', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { type: 'idempotency_in_progress', message: 'pending', request_id: 'r1' },
      }), { status: 409, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { batch_id: 'bat_1' }, meta: { request_id: 'r2', api_version: 'v1' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const 生成幂等键 = vi.fn(() => 'generated-key');
    const client = 创建BFF客户端({ fetcher, 生成幂等键, 等待: async () => {} });

    await client.请求({
      path: '/api/v1/me/job-recommendation-refreshes',
      method: 'POST', body: { intention_id: 'int_1' },
      幂等: true, 幂等键: 'click-key-0000001',
    });

    expect(生成幂等键).not.toHaveBeenCalled();
    expect(fetcher.mock.calls.map(([, init]) =>
      new Headers(init?.headers).get('Idempotency-Key'))).toEqual([
        'click-key-0000001', 'click-key-0000001',
      ]);
  });

  it.each([
    ['短于 16 字节', 'short-key'],
    ['长于 128 字节', 'k'.repeat(129)],
    ['包含空格', 'key with space-000001'],
    ['包含非 ASCII', '键键键键键键键键键键键键键键键键'],
  ])('调用方幂等键%s在发请求前按 invalid_request 拒绝', async (_label, key) => {
    const fetcher = vi.fn();
    const client = 创建BFF客户端({ fetcher, 生成幂等键: () => 'generated-key' });
    await expect(client.请求({
      path: '/api/v1/me/job-recommendation-refreshes',
      method: 'POST', body: { intention_id: 'int_1' },
      幂等: true, 幂等键: key,
    })).rejects.toMatchObject({ status: 0, code: 'invalid_request' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('裸幂等键（未开幂等）在发请求前按 invalid_request 拒绝', async () => {
    const fetcher = vi.fn();
    const client = 创建BFF客户端({ fetcher, 生成幂等键: () => 'generated-key' });
    await expect(client.请求({
      path: '/api/v1/me/job-recommendation-refreshes',
      method: 'POST', body: { intention_id: 'int_1' },
      幂等键: 'click-key-0000001',
    })).rejects.toMatchObject({ status: 0, code: 'invalid_request' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
