import { describe, expect, it, vi } from 'vitest';
import { BFF错误, 客户端校验错误, type BFF请求选项, 创建BFF客户端, 取后端错误文案 } from './HTTP客户端';

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
    const fetcher = vi.fn<typeof fetch>(async () => { throw new TypeError('offline'); });
    const client = 创建BFF客户端({ fetcher, 生成幂等键: () => 'idem-fixed' });
    await expect(client.请求({ path: '/api/v1/session', 不缓存: true })).rejects.toMatchObject({ code: 'network_error' });
    expect(fetcher).toHaveBeenCalledTimes(2); // 初次读取 + 唯一一次读取重试
    // opt-in no-store 的 GET 重试必须复用同一 init：每次都带 cache: 'no-store'。
    expect(fetcher.mock.calls.map(([, init]) => init?.cache)).toEqual(['no-store', 'no-store']);
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

  // Task 1：客户端字段校验错误直接显示具体原因，不落成网络错误文案。
  it('客户端字段校验显示具体原因而不是网络错误', () => {
    expect(取后端错误文案(new 客户端校验错误('certificate.year', '证书年份超出范围')))
      .toBe('证书年份超出范围');
  });

  // Task 6：本地 Error 不冒充网络故障、不泄露内部文本；422 通用文案不展示机器 reason。
  it('client validation 显示可行动文案，未知本地 Error 不冒充网络也不泄露内部文本', () => {
    expect(取后端错误文案(new 客户端校验错误('requirements', '请填写职位要求')))
      .toBe('请填写职位要求');
    expect(取后端错误文案(new Error('招聘方档案状态尚未就绪，请刷新后重试')))
      .toBe('请求失败，请稍后再试');
  });

  // review-final 修复 1：只有 code === 'network_error' 才是断网。客户端自铸的
  // BFF错误 一律带 status 0（见 数据源层与 HTTP客户端 的入参拦截），旧实现的
  // `status === 0 ||` 让每一条本地校验/本地契约错误都冒充「网络连不上」，
  // 用户被支去查 wifi。真实传输故障永远带 network_error，判据只留这一条。
  it('status 0 的本地校验错误不冒充网络失败，真正的 network_error 仍是网络文案', () => {
    expect(取后端错误文案(new BFF错误(0, 'validation_failed', '规则内容需要 1 到 2000 个字符')))
      .toBe('填写内容未通过校验');
    expect(取后端错误文案(new BFF错误(0, 'invalid_response', '规则响应结构不合法')))
      .toBe('服务返回异常，请稍后重试');
    expect(取后端错误文案(new BFF错误(0, 'invalid_request', '幂等键只能与幂等请求一起提供')))
      .toBe('幂等键只能与幂等请求一起提供');
    expect(取后端错误文案(new BFF错误(0, 'network_error', '网络连接失败，请稍后再试')))
      .toBe('无法连接后端服务，请检查网络或稍后重试');
  });

  it('422 保留 fieldErrors，但通用文案不展示机器 reason', () => {
    const error = new BFF错误(422, 'validation_failed', 'bad', [
      { path: 'requirements', reason: 'must_not_be_blank' },
    ]);
    expect(error.fieldErrors).toEqual([{ path: 'requirements', reason: 'must_not_be_blank' }]);
    expect(取后端错误文案(error)).toBe('填写内容未通过校验');
  });

  // 真实性修复 D：任意 5xx 与 internal_error（无论 status）都落安全通用文案，
  // 原始后端 message 绝不进全局 UI fallback。
  it.each([
    [500, 'internal_error'],
    [502, 'downstream_unavailable'],
    [503, 'downstream_unavailable'],
    [504, 'gateway_timeout'],
    [400, 'internal_error'],
  ])('%i/%s 不泄漏原始 message', (status, code) => {
    const text = 取后端错误文案(new BFF错误(status, code, 'database password leaked'));
    expect(text).toBe('后端服务暂时不可用，请稍后重试');
    expect(text).not.toContain('database');
  });

  it('未知 BFF 4xx 不泄漏未审核 message', () => {
    expect(取后端错误文案(new BFF错误(418, 'unknown_business_code', 'raw english')))
      .toBe('请求失败，请稍后再试');
  });

  it('闭合 code 映射保持：session / origin / conflict / validation', () => {
    expect(取后端错误文案(new BFF错误(401, 'invalid_session', 'expired')))
      .toBe('登录已失效，请重新登录');
    expect(取后端错误文案(new BFF错误(400, 'invalid_origin', 'bad origin')))
      .toBe('当前后端环境配置不正确');
    expect(取后端错误文案(new BFF错误(409, 'version_conflict', 'stale')))
      .toBe('数据已在其他地方更新，请重试');
    expect(取后端错误文案(new BFF错误(422, 'validation_failed', 'bad')))
      .toBe('填写内容未通过校验');
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

    const result = await client.请求二进制('/api/v1/me/resume-files/rf_1/content', { 不缓存: true });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith('/api/v1/me/resume-files/rf_1/content', {
      method: 'GET', headers: expect.any(Headers), credentials: 'include', cache: 'no-store',
    });
    // 二进制 GET 的网络错误重试同样保留 opt-in 的 cache: 'no-store'。
    expect(fetcher.mock.calls.map(([, init]) => init?.cache)).toEqual(['no-store', 'no-store']);
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

  // P8 opt-in 严格信封：2xx JSON 体必须恰为 {result, meta:{request_id, api_version:'v1'}}。
  // 缺/多根键、缺/多 meta 键、空 request_id、错 api_version、JSON 尾随内容与非 JSON
  // 都按 invalid_response fail closed；未开启该选项的调用保持既有宽松行为。
  it('严格信封接受恰好 {result, meta:{request_id, api_version:"v1"}} 的响应', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      result: { credential_id: 'cred_1' },
      meta: { request_id: 'r1', api_version: 'v1' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const client = 创建BFF客户端({ fetcher });
    await expect(client.请求({ path: '/api/v1/me/credentials', 严格信封: true }))
      .resolves.toMatchObject({ result: { credential_id: 'cred_1' }, requestId: 'r1' });
  });

  it.each([
    ['缺 result 根键', JSON.stringify({ meta: { request_id: 'r1', api_version: 'v1' } })],
    ['缺 meta 根键', JSON.stringify({ result: {} })],
    ['多根键', JSON.stringify({ result: {}, meta: { request_id: 'r1', api_version: 'v1' }, extra: 1 })],
    ['缺 meta 键', JSON.stringify({ result: {}, meta: { request_id: 'r1' } })],
    ['多 meta 键', JSON.stringify({ result: {}, meta: { request_id: 'r1', api_version: 'v1', extra: 1 } })],
    ['空 request_id', JSON.stringify({ result: {}, meta: { request_id: '', api_version: 'v1' } })],
    ['错 api_version', JSON.stringify({ result: {}, meta: { request_id: 'r1', api_version: 'v2' } })],
    ['meta 非对象', JSON.stringify({ result: {}, meta: null })],
    ['JSON 尾随内容', '{"result":{},"meta":{"request_id":"r1","api_version":"v1"}} trailing'],
    ['非 JSON', 'not json at all'],
  ])('严格信封拒绝%s', async (_label, body) => {
    const fetcher = vi.fn(async () => new Response(body, {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    const client = 创建BFF客户端({ fetcher });
    await expect(client.请求({ path: '/api/v1/me/credentials', 严格信封: true }))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });

  // Task 5 路由 opt-in 严格错误合同：非 2xx 信封必须恰好命中路由 OpenAPI 白名单
  // （根键只有 error、error 键只有 type/message/request_id、request_id 非空、
  // status+type 恰好命中一行且 message 精确一致），任何漂移都按 invalid_response
  // fail closed；未传该选项的调用保持既有宽松解析。
  const 严格错误合同 = [{
    status: 409,
    type: 'organization_verification_required',
    message: 'A verified organization is required to discover candidates.',
  }] as const;

  const 招聘刷新选项 = {
    path: '/api/v1/recruiter/candidate-recommendation-refreshes' as const,
    method: 'POST' as const,
    body: { job_id: 'job_1' },
    幂等: true,
    幂等键: 'click-key-0000001',
    严格错误合同,
  };

  it('严格错误合同接受精确 409 信封并保留 Retry-After', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      error: {
        type: 'organization_verification_required',
        message: 'A verified organization is required to discover candidates.',
        request_id: 'req_1',
      },
    }), { status: 409, headers: { 'Content-Type': 'application/json', 'Retry-After': '7' } }));
    const client = 创建BFF客户端({ fetcher });
    await expect(client.请求(招聘刷新选项)).rejects.toMatchObject({
      status: 409,
      code: 'organization_verification_required',
      message: 'A verified organization is required to discover candidates.',
      retryAfterSeconds: 7,
      fieldErrors: [],
    });
    // 409 organization_verification_required 不属于受控重试，绝不重发。
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  const 精确信封 = JSON.stringify({
    error: {
      type: 'organization_verification_required',
      message: 'A verified organization is required to discover candidates.',
      request_id: 'req_1',
    },
  });

  it.each([
    ['错 status', 精确信封, 400],
    ['未知 type', JSON.stringify({ error: { type: 'recommendation_unavailable', message: 'A verified organization is required to discover candidates.', request_id: 'req_1' } }), 409],
    ['错固定 message', JSON.stringify({ error: { type: 'organization_verification_required', message: '需要组织认证', request_id: 'req_1' } }), 409],
    ['空 request_id', JSON.stringify({ error: { type: 'organization_verification_required', message: 'A verified organization is required to discover candidates.', request_id: '' } }), 409],
    ['缺 error 键', JSON.stringify({ error: { type: 'organization_verification_required', message: 'A verified organization is required to discover candidates.' } }), 409],
    ['缺 error 根键', JSON.stringify({ message: 'A verified organization is required to discover candidates.' }), 409],
    ['根多键', JSON.stringify({ error: { type: 'organization_verification_required', message: 'A verified organization is required to discover candidates.', request_id: 'req_1' }, meta: {} }), 409],
    ['error 多键', JSON.stringify({ error: { type: 'organization_verification_required', message: 'A verified organization is required to discover candidates.', request_id: 'req_1', fields: [] } }), 409],
    ['error 非对象', JSON.stringify({ error: 'organization_verification_required' }), 409],
    ['根非对象', JSON.stringify(['organization_verification_required']), 409],
    ['非 JSON', 'not json at all', 409],
  ])('严格错误合同拒绝%s', async (_label, body, status) => {
    const fetcher = vi.fn(async () => new Response(body, {
      status, headers: { 'Content-Type': 'application/json' },
    }));
    const client = 创建BFF客户端({ fetcher });
    await expect(client.请求(招聘刷新选项)).rejects.toMatchObject({
      status, code: 'invalid_response', message: '错误响应不符合路由契约',
    });
expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('未传严格错误合同的调用保持既有宽松解析（额外键与未知 type 照常透传）', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      error: { type: 'whatever', message: 'oops', extra: 1 },
    }), { status: 422, headers: { 'Content-Type': 'application/json' } }));
    const client = 创建BFF客户端({ fetcher });
    await expect(client.请求({ path: '/api/v1/session' }))
      .rejects.toMatchObject({ status: 422, code: 'whatever', message: 'oops' });
expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('严格错误合同随受控重试透传：重试响应同样按合同校验', async () => {
    const 重试合同 = [{
      status: 409,
      type: 'idempotency_in_progress',
      message: 'The operation is still in progress.',
    }] as const;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { type: 'idempotency_in_progress', message: 'The operation is still in progress.', request_id: 'req_1' },
      }), { status: 409, headers: { 'Content-Type': 'application/json', 'Retry-After': '0' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { type: 'idempotency_in_progress', message: 'drifted message', request_id: 'req_2' },
      }), { status: 409, headers: { 'Content-Type': 'application/json' } }));
    const client = 创建BFF客户端({ fetcher, 生成幂等键: () => 'idem-fixed', 等待: async () => {} });
    await expect(client.请求({
      path: '/api/v1/me/job-recommendation-refreshes', method: 'POST', body: {},
      幂等: true, 幂等键: 'click-key-0000001', 严格错误合同: 重试合同,
    })).rejects.toMatchObject({ status: 409, code: 'invalid_response' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('未开启严格信封的调用保持宽松行为（多键响应照常透传 result）', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      result: { ok: true }, meta: { request_id: 'r1', api_version: 'v1' }, extra: 1,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const client = 创建BFF客户端({ fetcher });
    await expect(client.请求({ path: '/api/v1/session' }))
      .resolves.toMatchObject({ result: { ok: true }, requestId: 'r1' });
    // opt-in 语义只在选项位上：fetch init 与既有调用完全一致
    expect(fetcher).toHaveBeenCalledWith('/api/v1/session', expect.objectContaining({ credentials: 'include' }));
    expect(fetcher.mock.calls[0][1]?.cache).toBeUndefined();
  });

  // P5：只有显式 不缓存: true 的 JSON / 二进制请求才设置 Request.cache = 'no-store'；
  // 既有调用方（未传该选项）的 fetch init 保持原样（cache 为 undefined）。
  it('only explicitly no-store JSON and binary requests set Request.cache', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { ok: true }, meta: { request_id: 'json', api_version: 'v1' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('%PDF-1.7', {
        status: 200, headers: { 'Content-Type': 'application/pdf' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { ok: true }, meta: { request_id: 'normal', api_version: 'v1' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const client = 创建BFF客户端({ fetcher });
    await client.请求({ path: '/api/v1/me/match-cases', 不缓存: true });
    await client.请求二进制(
      '/api/v1/me/match-cases/mc_1/resume-submission/content',
      { 不缓存: true },
    );
    await client.请求({ path: '/api/v1/session' });

    expect(fetcher.mock.calls.map(([, init]) => init?.cache)).toEqual([
      'no-store', 'no-store', undefined,
    ]);
  });
});
