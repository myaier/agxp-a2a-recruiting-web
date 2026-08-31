// P8 控制面域数据源测试：冻结每个端点的 method/path/body/幂等键/不缓存/严格信封
// （创建导出不带 body；注销 body 精确 {}；举报 body 只含 target/reason/also_block），
// strict decode（exact key set、闭合 enum、exp_/del_ pattern、RFC3339、安全非负计数、
// 重复 ID、会话恰好一个 current、凭证至多一个 phone_otp、导出任意 status×download_ready
// 组合都放行，可下载只是派生 UI 规则），以及逐端点闭合错误联合：
// 表外 status+code 一律按 invalid_response fail closed。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BFF错误, type BFF请求选项, type BFF响应 } from '../HTTP客户端';
import type {
  BFF举报回执,
  BFF会话摘要,
  BFF反馈回执,
  BFF账号注销,
  BFF数据导出,
  BFF安全凭证,
} from '../BFF契约';
import {
  创建P8控制面数据源,
  解P8举报回执,
  解P8会话,
  解P8凭证列表,
  解P8导出,
  解P8注销,
  解P8反馈回执,
  解P8换绑尝试,
  解P8换绑结果,
  type P8控制面数据源,
} from './P8控制面';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

function 响应<T>(result: T): BFF响应<T> {
  return { result, etag: null, requestId: 'fixture-request' };
}

const 契约漂移 = '服务返回了不符合契约的账号控制面数据';

const 导出ID = `exp_${'0123456789abcdef'.repeat(2)}`;
const 注销ID = `del_${'0123456789abcdef'.repeat(2)}`;

const 手机凭证Wire: BFF安全凭证 = {
  credential_id: 'cred_0000000000000001',
  provider: 'phone_otp',
  display: '+86 138 **** 0000',
  verified_at: '2026-08-20T10:00:00Z',
};

const 微信凭证Wire: BFF安全凭证 = {
  credential_id: 'cred_0000000000000002',
  provider: 'wechat',
  display: '微信 · 已绑定',
  verified_at: '2026-08-21T10:00:00Z',
};

const 当前会话Wire: BFF会话摘要 = {
  session_id: 'sess_0000000000000001',
  expires_at: '2026-09-05T00:00:00Z',
  created_at: '2026-08-30T00:00:00Z',
  current: true,
};

const 其他会话Wire: BFF会话摘要 = {
  session_id: 'sess_0000000000000002',
  expires_at: '2026-09-01T00:00:00Z',
  created_at: '2026-08-29T00:00:00Z',
  current: false,
};

const 换绑尝试Wire = {
  attempt_id: 'att_0123456789abcdef',
  next_action: {
    type: 'enter_code' as const,
    expires_at: '2026-08-30T01:00:00Z',
    retry_after_seconds: 60,
  },
};

const 换绑结果Wire = {
  credential: 手机凭证Wire,
  revoked_sessions: 3,
  unchanged: false,
};

const 导出Wire: BFF数据导出 = {
  export_id: 导出ID,
  status: 'ready',
  created_at: '2026-08-30T00:00:00Z',
  expires_at: '2026-08-31T00:00:00Z',
  download_ready: true,
};

const 注销Wire: BFF账号注销 = {
  deletion_id: 注销ID,
  status: 'deletion_pending',
  retention_until: '2026-09-29T00:00:00Z',
};

const 反馈回执Wire: BFF反馈回执 = { ticket_id: 'TICKET-8', status: 'received' };
const 举报回执Wire: BFF举报回执 = { ticket_id: 'TICKET-9', status: 'received', block_status: 'applied' };

describe('P8 控制面数据源 请求形状', () => {
  let 请求Mock: ReturnType<typeof vi.fn>;
  let source: P8控制面数据源;

  beforeEach(() => {
    请求Mock = vi.fn();
    source = 创建P8控制面数据源(请求Mock as unknown as 请求函数);
  });

  it('凭证与会话两个 GET 都走 不缓存 + 严格信封，并按 camelCase 解码', async () => {
    请求Mock
      .mockResolvedValueOnce(响应({ credentials: [手机凭证Wire, 微信凭证Wire] }))
      .mockResolvedValueOnce(响应({ sessions: [当前会话Wire, 其他会话Wire] }));
    await expect(source.读取P8凭证()).resolves.toEqual([
      {
        credentialId: 'cred_0000000000000001',
        provider: 'phone_otp',
        display: '+86 138 **** 0000',
        verifiedAt: '2026-08-20T10:00:00Z',
      },
      {
        credentialId: 'cred_0000000000000002',
        provider: 'wechat',
        display: '微信 · 已绑定',
        verifiedAt: '2026-08-21T10:00:00Z',
      },
    ]);
    await expect(source.读取P8会话()).resolves.toEqual([
      {
        sessionId: 'sess_0000000000000001',
        createdAt: '2026-08-30T00:00:00Z',
        expiresAt: '2026-09-05T00:00:00Z',
        current: true,
      },
      {
        sessionId: 'sess_0000000000000002',
        createdAt: '2026-08-29T00:00:00Z',
        expiresAt: '2026-09-01T00:00:00Z',
        current: false,
      },
    ]);
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      { path: '/api/v1/me/credentials', 不缓存: true, 严格信封: true },
      { path: '/api/v1/security/sessions', 不缓存: true, 严格信封: true },
    ]);
  });

  it('换绑两步各带独立幂等键；begin 构造 +86 E.164；complete 只要求非空 proof 并把尝试 ID 编码一次', async () => {
    请求Mock
      .mockResolvedValueOnce(响应(换绑尝试Wire))
      .mockResolvedValueOnce(响应(换绑结果Wire));
    await expect(source.开始P8手机号换绑('13900000001', 'p8-begin-key-000001')).resolves.toEqual({
      attemptId: 'att_0123456789abcdef',
      nextAction: { type: 'enter_code', expiresAt: '2026-08-30T01:00:00Z', retryAfterSeconds: 60 },
    });
    // facade 不持有位数规则（调用方 import 短信验证码位数）：非空 proof 一律放行
    await expect(source.完成P8手机号换绑('att 1', '99', 'p8-complete-key-000001')).resolves.toMatchObject({
      credential: { credentialId: 'cred_0000000000000001' },
      revokedSessions: 3,
      unchanged: false,
    });
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      {
        path: '/api/v1/me/credential-replacement-attempts',
        method: 'POST',
        body: { phone: '+8613900000001' },
        幂等: true,
        幂等键: 'p8-begin-key-000001',
        严格信封: true,
      },
      {
        path: '/api/v1/me/credential-replacement-attempts/att%201/complete',
        method: 'POST',
        body: { proof: { code: '99' } },
        幂等: true,
        幂等键: 'p8-complete-key-000001',
        严格信封: true,
      },
    ]);
  });

  it('退出其他设备 DELETE 只带幂等键，回执 revoked_sessions 解码为数字', async () => {
    请求Mock.mockResolvedValueOnce(响应({ revoked_sessions: 3 }));
    await expect(source.退出P8其他设备('p8-revoke-key-000001')).resolves.toBe(3);
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/security/sessions/others',
      method: 'DELETE',
      幂等: true,
      幂等键: 'p8-revoke-key-000001',
      严格信封: true,
    });
  });

  it('创建数据导出不带 body；读取导出 GET 不缓存；下载地址是同源相对 URL 且零请求', async () => {
    请求Mock
      .mockResolvedValueOnce(响应(导出Wire))
      .mockResolvedValueOnce(响应({ ...导出Wire, status: 'queued', expires_at: null, download_ready: false }));
    await expect(source.创建P8数据导出('p8-export-key-0001')).resolves.toEqual({
      exportId: 导出ID,
      status: 'ready',
      createdAt: '2026-08-30T00:00:00Z',
      expiresAt: '2026-08-31T00:00:00Z',
      downloadReady: true,
    });
    await expect(source.读取P8数据导出(导出ID)).resolves.toMatchObject({
      status: 'queued',
      expiresAt: null,
      downloadReady: false,
    });
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      {
        path: '/api/v1/me/data-exports',
        method: 'POST',
        幂等: true,
        幂等键: 'p8-export-key-0001',
        严格信封: true,
      },
      { path: `/api/v1/me/data-exports/${导出ID}`, 不缓存: true, 严格信封: true },
    ]);
    const 地址 = source.取P8数据导出下载地址(导出ID);
    expect(地址).toBe(`/api/v1/me/data-exports/${导出ID}/download`);
    expect(/^https?:\/\//.test(地址)).toBe(false); // 同源相对路径，绝不指向对象存储
    expect(请求Mock).toHaveBeenCalledTimes(2); // URL 构造是纯函数，不发请求
  });

  it('注销 body 精确 {}；反馈 body 只带 category/details；举报 body 只带 target/reason/also_block', async () => {
    请求Mock
      .mockResolvedValueOnce(响应(注销Wire))
      .mockResolvedValueOnce(响应(反馈回执Wire))
      .mockResolvedValueOnce(响应(举报回执Wire));
    await expect(source.请求P8账号注销('p8-delete-key-0001')).resolves.toEqual({
      deletionId: 注销ID,
      status: 'deletion_pending',
      retentionUntil: '2026-09-29T00:00:00Z',
    });
    await expect(source.提交P8反馈('bug', '导出按钮没有响应', 'p8-feedback-key-0001'))
      .resolves.toEqual({ ticketId: 'TICKET-8', status: 'received' });
    await expect(
      source.提交P8举报({ type: 'conversation', ref: '3003' }, 'harassment', true, 'p8-report-key-0001'),
    ).resolves.toEqual({ ticketId: 'TICKET-9', status: 'received', blockStatus: 'applied' });
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      {
        path: '/api/v1/me/account-deletion',
        method: 'POST',
        body: {},
        幂等: true,
        幂等键: 'p8-delete-key-0001',
        严格信封: true,
      },
      {
        path: '/api/v1/compliance/feedback',
        method: 'POST',
        body: { category: 'bug', details: '导出按钮没有响应' },
        幂等: true,
        幂等键: 'p8-feedback-key-0001',
        严格信封: true,
      },
      {
        path: '/api/v1/compliance/reports',
        method: 'POST',
        body: { target: { type: 'conversation', ref: '3003' }, reason: 'harassment', also_block: true },
        幂等: true,
        幂等键: 'p8-report-key-0001',
        严格信封: true,
      },
    ]);
  });

  it('非法入参（空 proof/尝试 ID、坏导出 ID、未知分类/原因/target 分支）在任何 fetch 前拒绝', async () => {
    await expect(source.完成P8手机号换绑('', '1234', 'p8-complete-key-000002'))
      .rejects.toMatchObject({ status: 0, code: 'invalid_request' });
    await expect(source.完成P8手机号换绑('att_1', '', 'p8-complete-key-000002'))
      .rejects.toMatchObject({ status: 0, code: 'invalid_request' });
    await expect(source.读取P8数据导出('exp_bad'))
      .rejects.toMatchObject({ status: 0, code: 'invalid_request' });
    expect(() => source.取P8数据导出下载地址('exp_bad')).toThrow(BFF错误);
    await expect(source.提交P8反馈('complaint' as never, '内容长度足够', 'p8-feedback-key-0002'))
      .rejects.toMatchObject({ status: 0, code: 'invalid_request' });
    for (const 坏目标 of [
      { type: 'direct', ref: '1' },
      { type: 'job', ref: '' },
      { type: 'job' },
      { type: 'job', ref: 'job_1', note: 'x' },
    ] as never[]) {
      await expect(source.提交P8举报(坏目标, 'harassment', true, 'p8-report-key-0002'))
        .rejects.toMatchObject({ status: 0, code: 'invalid_request' });
    }
    await expect(source.提交P8举报({ type: 'job', ref: 'job_1' }, 'spam' as never, true, 'p8-report-key-0003'))
      .rejects.toMatchObject({ status: 0, code: 'invalid_request' });
    expect(请求Mock).not.toHaveBeenCalled();
  });
});

describe('P8 控制面逐端点闭合错误联合', () => {
  let 请求Mock: ReturnType<typeof vi.fn>;
  let source: P8控制面数据源;

  beforeEach(() => {
    请求Mock = vi.fn();
    source = 创建P8控制面数据源(请求Mock as unknown as 请求函数);
  });

  // 允许 = 发布的 status+code（非通用分支 + 各端点发布的通用 400/401/403）；不可能 = 表外组合
  const 端点表: readonly {
    名: string;
    调用: (source: P8控制面数据源) => Promise<unknown>;
    允许: readonly (readonly [number, string])[];
    不可能: readonly [number, string];
  }[] = [
    {
      名: 'GET security/sessions',
      调用: (s) => s.读取P8会话(),
      允许: [[401, 'invalid_session'], [503, 'identity_service_unavailable']],
      不可能: [400, 'invalid_request_body'], // GET 不发布 400
    },
    {
      名: 'GET me/credentials',
      调用: (s) => s.读取P8凭证(),
      允许: [[401, 'invalid_session'], [503, 'identity_service_unavailable']],
      不可能: [403, 'invalid_origin'], // GET 不发布 403
    },
    {
      名: 'DELETE security/sessions/others',
      调用: (s) => s.退出P8其他设备('p8-revoke-key-000001'),
      允许: [
        [400, 'invalid_request_body'], [401, 'invalid_session'], [403, 'invalid_origin'],
        [409, 'idempotency_conflict'], [409, 'idempotency_in_progress'],
        [503, 'identity_service_unavailable'], [503, 'operation_outcome_unknown'],
      ],
      不可能: [429, 'rate_limited'],
    },
    {
      名: 'POST replacement begin',
      调用: (s) => s.开始P8手机号换绑('13900000001', 'p8-begin-key-000001'),
      允许: [
        [400, 'invalid_request_body'], [401, 'invalid_session'], [403, 'invalid_origin'],
        [409, 'idempotency_conflict'], [409, 'idempotency_in_progress'], [429, 'rate_limited'],
        [503, 'identity_service_unavailable'], [503, 'operation_outcome_unknown'],
      ],
      不可能: [409, 'credential_replacement_conflict'], // 冲突码只在 complete 发布
    },
    {
      名: 'POST replacement complete',
      调用: (s) => s.完成P8手机号换绑('att_0123456789abcdef', '1234', 'p8-complete-key-000001'),
      允许: [
        [400, 'invalid_request_body'], [401, 'invalid_session'], [403, 'invalid_origin'],
        [409, 'credential_replacement_conflict'], [409, 'idempotency_conflict'], [409, 'idempotency_in_progress'],
        [503, 'identity_service_unavailable'], [503, 'operation_outcome_unknown'],
      ],
      不可能: [429, 'rate_limited'], // complete 不发布 429
    },
    {
      名: 'POST me/data-exports',
      调用: (s) => s.创建P8数据导出('p8-export-key-0001'),
      允许: [
        [400, 'invalid_request_body'], [401, 'invalid_session'],
        [403, 'invalid_origin'], [403, 'role_required'], [403, 'role_suspended'], // 三码联合
        [409, 'export_in_progress'], [409, 'idempotency_conflict'],
        [503, 'identity_service_unavailable'], [503, 'recruitment_service_unavailable'], [503, 'operation_outcome_unknown'],
      ],
      不可能: [404, 'data_export_not_found'],
    },
    {
      名: 'GET me/data-exports/{id}',
      调用: (s) => s.读取P8数据导出(导出ID),
      允许: [
        [401, 'invalid_session'], [404, 'data_export_not_found'],
        [503, 'identity_service_unavailable'], [503, 'recruitment_service_unavailable'],
      ],
      不可能: [400, 'invalid_request_body'], // GET 不发布 400/403
    },
    {
      名: 'POST me/account-deletion',
      调用: (s) => s.请求P8账号注销('p8-delete-key-0001'),
      允许: [
        [400, 'invalid_request_body'], [401, 'invalid_session'], [403, 'invalid_origin'], // 403 只此一码
        [409, 'export_in_progress'],
        [503, 'recruitment_service_unavailable'], [503, 'operation_outcome_unknown'],
      ],
      不可能: [403, 'role_suspended'], // 与创建导出的三码联合不同：表外即漂移
    },
    {
      名: 'POST compliance/feedback',
      调用: (s) => s.提交P8反馈('bug', '导出按钮没有响应', 'p8-feedback-key-0001'),
      允许: [
        [400, 'invalid_request_body'], [401, 'invalid_session'], [403, 'invalid_origin'],
        [409, 'idempotency_conflict'], [429, 'rate_limited'],
        [503, 'identity_service_unavailable'], [503, 'recruitment_service_unavailable'], [503, 'operation_outcome_unknown'],
      ],
      不可能: [409, 'idempotency_in_progress'],
    },
    {
      名: 'POST compliance/reports',
      调用: (s) => s.提交P8举报({ type: 'job', ref: 'job_1' }, 'harassment', true, 'p8-report-key-0001'),
      允许: [
        [400, 'invalid_request_body'], [401, 'invalid_session'], [403, 'invalid_origin'],
        [404, 'report_target_not_found'],
        [409, 'block_unavailable'], [409, 'idempotency_conflict'], [429, 'rate_limited'],
        [503, 'identity_service_unavailable'], [503, 'recruitment_service_unavailable'], [503, 'operation_outcome_unknown'],
      ],
      不可能: [409, 'export_in_progress'],
    },
  ];

  it.each(端点表)('$名：表内 status+code 原样透传，表外组合按 invalid_response 拒绝', async ({ 调用, 允许, 不可能 }) => {
    for (const [status, code] of 允许) {
      请求Mock.mockRejectedValueOnce(new BFF错误(status, code, 'fixed'));
      await expect(调用(source)).rejects.toMatchObject({ status, code });
    }
    请求Mock.mockRejectedValueOnce(new BFF错误(不可能[0], 不可能[1], 'fixed'));
    await expect(调用(source)).rejects.toMatchObject({ status: 200, code: 'invalid_response' });
  });

  it('网络错误、请求前 invalid_request 与解码期 invalid_response 原样透传，不进错误表', async () => {
    请求Mock.mockRejectedValueOnce(new BFF错误(0, 'network_error', 'offline'));
    await expect(source.读取P8会话()).rejects.toMatchObject({ status: 0, code: 'network_error' });
    请求Mock.mockRejectedValueOnce(new BFF错误(200, 'invalid_response', '响应不是合法 JSON'));
    await expect(source.读取P8会话()).rejects.toMatchObject({ code: 'invalid_response' });
    请求Mock.mockRejectedValueOnce(new Error('非 BFF 错误'));
    await expect(source.读取P8会话()).rejects.toThrow('非 BFF 错误');
  });
});

describe('P8 控制面 strict decode', () => {
  it('解P8凭证列表：camelCase 映射；空列表（零 phone_otp）合法；重复 ID 与双 phone_otp 拒绝', () => {
    expect(解P8凭证列表({ credentials: [手机凭证Wire, 微信凭证Wire] })).toEqual([
      {
        credentialId: 'cred_0000000000000001',
        provider: 'phone_otp',
        display: '+86 138 **** 0000',
        verifiedAt: '2026-08-20T10:00:00Z',
      },
      {
        credentialId: 'cred_0000000000000002',
        provider: 'wechat',
        display: '微信 · 已绑定',
        verifiedAt: '2026-08-21T10:00:00Z',
      },
    ]);
    // 零 phone_otp 合法：页面按“未绑定”渲染，decoder 不造行
    expect(解P8凭证列表({ credentials: [] })).toEqual([]);
    expect(() => 解P8凭证列表({ credentials: [微信凭证Wire, 微信凭证Wire] })).toThrow(契约漂移);
    expect(() => 解P8凭证列表({
      credentials: [手机凭证Wire, { ...手机凭证Wire, credential_id: 'cred_0000000000000009' }],
    })).toThrow(契约漂移);
  });

  it('解P8凭证列表：缺键/多键/未知 provider/坏时间/空 display 都按契约漂移拒绝', () => {
    expect(() => 解P8凭证列表({ credentials: [{ ...手机凭证Wire, provider: 'sms' }] })).toThrow(契约漂移);
    expect(() => 解P8凭证列表({ credentials: [{ ...手机凭证Wire, extra: 1 }] })).toThrow(契约漂移);
    const { display: _缺display, ...缺display行 } = 手机凭证Wire;
    expect(() => 解P8凭证列表({ credentials: [缺display行] })).toThrow(契约漂移);
    expect(() => 解P8凭证列表({ credentials: [{ ...手机凭证Wire, display: '' }] })).toThrow(契约漂移);
    expect(() => 解P8凭证列表({ credentials: [{ ...手机凭证Wire, verified_at: '2026-08-20' }] })).toThrow(契约漂移);
    expect(() => 解P8凭证列表({ credential: [] })).toThrow(契约漂移);
    expect(() => 解P8凭证列表({ credentials: [手机凭证Wire], extra: 1 })).toThrow(契约漂移);
  });

  it('解P8会话：恰好一个 current；零个/多个/重复 ID/坏时间都拒绝', () => {
    expect(解P8会话({ sessions: [当前会话Wire, 其他会话Wire] })).toHaveLength(2);
    expect(解P8会话({ sessions: [其他会话Wire, { ...当前会话Wire, session_id: 'sess_0000000000000003' }] })[1].current)
      .toBe(true); // current 不必是第一行
    expect(() => 解P8会话({ sessions: [{ ...当前会话Wire, current: false }] })).toThrow(契约漂移);
    expect(() => 解P8会话({ sessions: [当前会话Wire, { ...其他会话Wire, current: true }] })).toThrow(契约漂移);
    expect(() => 解P8会话({ sessions: [其他会话Wire, 其他会话Wire] })).toThrow(契约漂移);
    expect(() => 解P8会话({ sessions: [{ ...当前会话Wire, created_at: '昨天' }] })).toThrow(契约漂移);
    expect(() => 解P8会话({ sessions: [{ ...当前会话Wire, session_id: '' }] })).toThrow(契约漂移);
    expect(() => 解P8会话({ sessions: [{ ...当前会话Wire, current: 'yes' }] })).toThrow(契约漂移);
  });

  it('解P8换绑尝试：LinkNextAction 只认 enter_code；缺席窗口字段归 null，在场必须合法', () => {
    expect(解P8换绑尝试(换绑尝试Wire)).toEqual({
      attemptId: 'att_0123456789abcdef',
      nextAction: { type: 'enter_code', expiresAt: '2026-08-30T01:00:00Z', retryAfterSeconds: 60 },
    });
    expect(解P8换绑尝试({ attempt_id: 'att_1', next_action: { type: 'enter_code' } }))
      .toMatchObject({ nextAction: { expiresAt: null, retryAfterSeconds: null } });
    expect(解P8换绑尝试({
      attempt_id: 'att_1',
      next_action: { type: 'enter_code', retry_after_seconds: 0 },
    }).nextAction.retryAfterSeconds).toBe(0); // minimum: 0，零冷却合法
    expect(() => 解P8换绑尝试({ attempt_id: 'att_1', next_action: { type: 'redirect' } })).toThrow(契约漂移);
    expect(() => 解P8换绑尝试({ attempt_id: 'att_1', next_action: { type: 'completed' } })).toThrow(契约漂移);
    expect(() => 解P8换绑尝试({ attempt_id: 'att_1', next_action: { type: 'enter_code', expires_at: '2026-08-30' } }))
      .toThrow(契约漂移);
    expect(() => 解P8换绑尝试({ attempt_id: 'att_1', next_action: { type: 'enter_code', expires_at: null } }))
      .toThrow(契约漂移); // 可选字段不接受 null，缺席才归 null
    expect(() => 解P8换绑尝试({ attempt_id: 'att_1', next_action: { type: 'enter_code', retry_after_seconds: -1 } }))
      .toThrow(契约漂移);
    expect(() => 解P8换绑尝试({ attempt_id: 'att_1', next_action: { type: 'enter_code', retry_after_seconds: 1.5 } }))
      .toThrow(契约漂移);
    expect(() => 解P8换绑尝试({
      attempt_id: 'att_1',
      next_action: { type: 'enter_code', retry_after_seconds: Number.MAX_SAFE_INTEGER + 1 },
    })).toThrow(契约漂移);
    expect(() => 解P8换绑尝试({ attempt_id: 'att_1', next_action: { type: 'enter_code', redirect_url: '/x' } }))
      .toThrow(契约漂移);
    expect(() => 解P8换绑尝试({ attempt_id: '', next_action: { type: 'enter_code' } })).toThrow(契约漂移);
    expect(() => 解P8换绑尝试({ attempt_id: 'att_1' })).toThrow(契约漂移);
  });

  it('解P8换绑结果：credential 解码 + 安全非负 revoked_sessions', () => {
    expect(解P8换绑结果(换绑结果Wire)).toEqual({
      credential: {
        credentialId: 'cred_0000000000000001',
        provider: 'phone_otp',
        display: '+86 138 **** 0000',
        verifiedAt: '2026-08-20T10:00:00Z',
      },
      revokedSessions: 3,
      unchanged: false,
    });
    expect(解P8换绑结果({ ...换绑结果Wire, revoked_sessions: 0 }).revokedSessions).toBe(0);
    for (const 坏数 of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => 解P8换绑结果({ ...换绑结果Wire, revoked_sessions: 坏数 })).toThrow(契约漂移);
    }
    expect(() => 解P8换绑结果({ credential: 手机凭证Wire, revoked_sessions: 3 })).toThrow(契约漂移); // 缺 unchanged
  });

  it('解P8导出：五种 status × downloadReady 任意组合都放行，不按组合拒绝', () => {
    for (const status of ['queued', 'running', 'ready', 'failed', 'expired'] as const) {
      for (const download_ready of [false, true]) {
        expect(解P8导出({ ...导出Wire, status, download_ready })).toMatchObject({
          status,
          downloadReady: download_ready,
        });
      }
    }
  });

  it('解P8导出：exp_ pattern、必在可空 expires_at、缺键/多键、坏时间拒绝', () => {
    expect(() => 解P8导出({ ...导出Wire, export_id: 'exp_bad' })).toThrow(契约漂移);
    expect(() => 解P8导出({ ...导出Wire, export_id: `exp_${'0'.repeat(31)}` })).toThrow(契约漂移);
    expect(() => 解P8导出({ ...导出Wire, export_id: `EXP_${'0'.repeat(32)}` })).toThrow(契约漂移);
    expect(() => 解P8导出({ ...导出Wire, export_id: `exp_${'g'.repeat(32)}` })).toThrow(契约漂移);
    expect(解P8导出({ ...导出Wire, expires_at: null }).expiresAt).toBeNull();
    expect(() => 解P8导出({ ...导出Wire, expires_at: '2026-08-31' })).toThrow(契约漂移);
    const { expires_at: _缺expires, ...缺expires行 } = 导出Wire;
    expect(() => 解P8导出(缺expires行)).toThrow(契约漂移); // 必在键缺失（可空 ≠ 可缺）
    expect(() => 解P8导出({ ...导出Wire, download_url: '/x' })).toThrow(契约漂移);
    expect(() => 解P8导出({ ...导出Wire, status: 'done' })).toThrow(契约漂移);
    expect(() => 解P8导出({ ...导出Wire, download_ready: 'yes' })).toThrow(契约漂移);
  });

  it('解P8注销：del_ pattern 与闭合状态；坏 retention_until 拒绝', () => {
    expect(解P8注销(注销Wire)).toEqual({
      deletionId: 注销ID,
      status: 'deletion_pending',
      retentionUntil: '2026-09-29T00:00:00Z',
    });
    expect(解P8注销({ ...注销Wire, status: 'deleted' }).status).toBe('deleted');
    expect(() => 解P8注销({ ...注销Wire, deletion_id: 'del_bad' })).toThrow(契约漂移);
    expect(() => 解P8注销({ ...注销Wire, deletion_id: `del_${'0'.repeat(33)}` })).toThrow(契约漂移);
    expect(() => 解P8注销({ ...注销Wire, status: 'cancelled' })).toThrow(契约漂移);
    expect(() => 解P8注销({ ...注销Wire, retention_until: '下月' })).toThrow(契约漂移);
  });

  it('解P8反馈/举报回执：ticket_id 只要求 string（发布无 pattern），exact key set 与闭合 enum 仍生效', () => {
    expect(解P8反馈回执(反馈回执Wire)).toEqual({ ticketId: 'TICKET-8', status: 'received' });
    expect(解P8反馈回执({ ticket_id: 't', status: 'reviewing' })).toEqual({ ticketId: 't', status: 'reviewing' });
    expect(() => 解P8反馈回执({ ticket_id: 't', status: 'open' })).toThrow(契约漂移);
    expect(() => 解P8反馈回执({ ticket_id: 't', status: 'received', extra: 1 })).toThrow(契约漂移);
    expect(() => 解P8反馈回执({ status: 'received' })).toThrow(契约漂移);
    expect(解P8举报回执(举报回执Wire)).toEqual({ ticketId: 'TICKET-9', status: 'received', blockStatus: 'applied' });
    expect(解P8举报回执({ ...举报回执Wire, block_status: 'not_requested' }).blockStatus).toBe('not_requested');
    expect(() => 解P8举报回执({ ...举报回执Wire, block_status: 'maybe' })).toThrow(契约漂移);
    const { block_status: _无block, ...缺block行 } = 举报回执Wire;
    expect(() => 解P8举报回执(缺block行)).toThrow(契约漂移);
  });
});
