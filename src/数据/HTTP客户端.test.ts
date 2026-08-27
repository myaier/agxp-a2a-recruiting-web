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

  it('binary GET includes credentials, retries one network failure and exposes fixed headers', async () => {
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    // vitest jsdom 环境里 Response 是 Node（undici）的：跨 realm 的 jsdom Blob 会被
    // Response 构造器字符串化成 "[object Blob]"，所以 mock 用 pdf 自己的字节构造 body。
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockImplementationOnce(async () => new Response(await pdf.arrayBuffer(), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="resume.pdf"',
          'X-Request-Id': 'req_pdf',
        },
      }));
    const client = 创建BFF客户端({ fetcher });

    const result = await client.请求二进制('/api/v1/me/resume-files/rf_1/content');

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith('/api/v1/me/resume-files/rf_1/content', {
      method: 'GET', headers: expect.any(Headers), credentials: 'include',
    });
    expect(await result.blob.text()).toBe('%PDF-1.7');
    expect(result.contentType).toBe('application/pdf');
    expect(result.contentDisposition).toBe('attachment; filename="resume.pdf"');
    expect(result.requestId).toBe('req_pdf');
  });

  it('binary GET parses the normal JSON error envelope and does not retry HTTP errors', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { type: 'resume_file_not_found', message: 'missing', fields: [] },
    }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
    const client = 创建BFF客户端({ fetcher });

    await expect(client.请求二进制('/api/v1/me/resume-files/rf_missing/content'))
      .rejects.toMatchObject({ status: 404, code: 'resume_file_not_found', message: 'missing' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
