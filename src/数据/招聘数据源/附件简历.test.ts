// 附件简历域数据源测试：冻结每个 browser call 的 method/path/If-Match/幂等/multipart 形状，
// 并锁定 strict decode（exact key set、闭合 parse 状态与 Spec 四失败码、media type 精确
// application/pdf、limits max_files 1..3 且 items.length <= max_files）与
// 二进制下载只认归一化 contentType（不信 Blob 自带参数）。

import { describe, expect, it, vi } from 'vitest';
import { 创建附件简历数据源 } from './附件简历';

describe('附件简历数据源', () => {
  const 正常状态 = { status: 'not_started' } as const;
  const 正常文件 = {
    file_id: 'rf_1', display_name: 'resume.pdf', revision: 2,
    current_version: {
      version_id: 'rfv_2', version: 2, size_bytes: 8,
      media_type: 'application/pdf' as const, sha256: 'a'.repeat(64),
      created_at: '2026-08-28T00:00:00Z', parse: 正常状态,
    },
    created_at: '2026-08-27T00:00:00Z', updated_at: '2026-08-28T00:00:00Z',
  };
  const 正常库 = {
    items: [正常文件],
    limits: { max_files: 3, max_file_bytes: 10_485_760, accepted_media_types: ['application/pdf'] as ['application/pdf'] },
  };

  it('create sends the exact multipart parts and no manual Content-Type', async () => {
    const 请求 = vi.fn().mockResolvedValue({ result: 正常文件, etag: null, requestId: 'req' });
    const source = 创建附件简历数据源({ 请求, 请求二进制: vi.fn() });
    const file = new File(['%PDF'], 'resume.pdf', { type: 'application/pdf' });
    await source.创建附件简历(file, true);
    const options = 请求.mock.calls[0][0];
    expect(options).toMatchObject({ path: '/api/v1/me/resume-files', method: 'POST', 幂等: true });
    expect(Array.from(options.formData.entries())).toEqual([
      ['display_name', 'resume.pdf'], ['file', file], ['processing_consent_confirmed', 'true'],
    ]);
    expect(options.body).toBeUndefined();
  });

  it('replace preserves slot name by omitting display_name and sends CAS', async () => {
    const 请求 = vi.fn().mockResolvedValue({ result: 正常文件, etag: '"3"', requestId: 'req' });
    const source = 创建附件简历数据源({ 请求, 请求二进制: vi.fn() });
    const file = new File(['%PDF'], 'new-name.pdf', { type: 'application/pdf' });
    await source.替换附件简历('rf_1', 2, file, true);
    const options = 请求.mock.calls[0][0];
    expect(options).toMatchObject({
      path: '/api/v1/me/resume-files/rf_1/content', method: 'PUT', ifMatch: '"2"', 幂等: true,
    });
    expect(Array.from(options.formData.entries())).toEqual([
      ['file', file], ['processing_consent_confirmed', 'true'],
    ]);
  });

  it('delete and parse use the current CAS/version and parse literal true', async () => {
    const 请求 = vi.fn()
      .mockResolvedValueOnce({ result: { deleted: true }, etag: null, requestId: 'd' })
      .mockResolvedValueOnce({ result: { status: 'pending', updated_at: '2026-08-28T01:00:00Z' }, etag: null, requestId: 'p' });
    const source = 创建附件简历数据源({ 请求, 请求二进制: vi.fn() });
    await source.删除附件简历('rf_1', 2);
    await source.请求附件解析('rf_1', 'rfv_2', true);
    expect(请求.mock.calls[0][0]).toEqual({
      path: '/api/v1/me/resume-files/rf_1', method: 'DELETE', ifMatch: '"2"',
    });
    expect(请求.mock.calls[1][0]).toEqual({
      path: '/api/v1/me/resume-files/rf_1/parse', method: 'POST', 幂等: true,
      body: { version_id: 'rfv_2', processing_consent_confirmed: true },
    });
  });

  it.each([
    [{ items: [正常文件, 正常文件, 正常文件, 正常文件], limits: 正常库.limits }, 'too many items'],
    [{ items: [{ ...正常文件, extra: true }], limits: 正常库.limits }, 'unknown file key'],
    [{ items: [{ ...正常文件, current_version: { ...正常文件.current_version, media_type: 'text/plain' } }], limits: 正常库.limits }, 'wrong media type'],
    [{ items: [{ ...正常文件, current_version: { ...正常文件.current_version, parse: { status: 'succeeded', updated_at: 'now' } } }], limits: 正常库.limits }, 'missing parse_id'],
    [{ items: [{ ...正常文件, current_version: { ...正常文件.current_version, parse: { status: 'not_started', updated_at: 'now' } } }], limits: 正常库.limits }, 'extra parse key'],
  ])('list rejects malformed closed response: %s', async (result, _场景) => {
    const source = 创建附件简历数据源({
      请求: vi.fn().mockResolvedValue({ result, etag: null, requestId: 'req' }),
      请求二进制: vi.fn(),
    });
    await expect(source.读取附件简历库()).rejects.toMatchObject({ code: 'invalid_response', status: 200 });
  });

  it('download rejects a successful non-PDF response', async () => {
    const source = 创建附件简历数据源({
      请求: vi.fn(),
      请求二进制: vi.fn().mockResolvedValue({
        blob: new Blob(['html'], { type: 'text/html' }), contentType: 'text/html',
        contentDisposition: null, requestId: 'req',
      }),
    });
    await expect(source.下载附件简历('rf_1')).rejects.toMatchObject({ code: 'invalid_response', status: 200 });
  });

  it('download trusts the normalized response content type instead of raw Blob parameters', async () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf;charset=binary' });
    const source = 创建附件简历数据源({
      请求: vi.fn(),
      请求二进制: vi.fn().mockResolvedValue({
        blob, contentType: 'application/pdf', contentDisposition: null, requestId: 'req',
      }),
    });
    await expect(source.下载附件简历('rf_1')).resolves.toBe(blob);
  });

  // ── 成功 decoder table：五种 parse 状态逐个闭合解码，字段断言而非快照 ──

  const 解析状态样本: Array<[string, Record<string, unknown>]> = [
    ['not_started', { status: 'not_started' }],
    ['pending', { status: 'pending', updated_at: '2026-08-28T01:00:00Z' }],
    ['processing', { status: 'processing', updated_at: '2026-08-28T01:00:00Z' }],
    ['succeeded', { status: 'succeeded', parse_id: 'rp_9', updated_at: '2026-08-28T01:00:00Z' }],
    ['failed', { status: 'failed', failure_code: 'document_unreadable', updated_at: '2026-08-28T01:00:00Z' }],
  ];

  it.each(解析状态样本)('list decodes each closed parse state: %s', async (_状态, parse) => {
    const source = 创建附件简历数据源({
      请求: vi.fn().mockResolvedValue({
        result: { items: [{ ...正常文件, current_version: { ...正常文件.current_version, parse } }], limits: 正常库.limits },
        etag: null, requestId: 'req',
      }),
      请求二进制: vi.fn(),
    });
    const 库 = await source.读取附件简历库();
    expect(库.items).toHaveLength(1);
    expect(库.items[0].file_id).toBe('rf_1');
    expect(库.items[0].display_name).toBe('resume.pdf');
    expect(库.items[0].revision).toBe(2);
    expect(库.items[0].created_at).toBe('2026-08-27T00:00:00Z');
    expect(库.items[0].current_version.version_id).toBe('rfv_2');
    expect(库.items[0].current_version.version).toBe(2);
    expect(库.items[0].current_version.size_bytes).toBe(8);
    expect(库.items[0].current_version.media_type).toBe('application/pdf');
    expect(库.items[0].current_version.sha256).toBe('a'.repeat(64));
    expect(库.items[0].current_version.parse).toEqual(parse);
  });

  // Spec 只允许四种失败码：逐个验证 failed 状态按原样闭合解码。
  const 解析失败码样本 = [
    'document_unreadable',
    'document_too_complex',
    'parser_invalid_output',
    'parser_temporarily_unavailable',
  ] as const;

  it.each(解析失败码样本.map((failure_code) => [failure_code, {
    status: 'failed', failure_code, updated_at: '2026-08-28T01:00:00Z',
  }] as const))('list decodes each closed failure code: %s', async (failure_code, parse) => {
    const source = 创建附件简历数据源({
      请求: vi.fn().mockResolvedValue({
        result: { items: [{ ...正常文件, current_version: { ...正常文件.current_version, parse } }], limits: 正常库.limits },
        etag: null, requestId: 'req',
      }),
      请求二进制: vi.fn(),
    });
    const 库 = await source.读取附件简历库();
    expect(库.items[0].current_version.parse).toEqual({
      status: 'failed', failure_code, updated_at: '2026-08-28T01:00:00Z',
    });
  });

  // 每个 exact key set 对象（库 / limits / 版本 / 五种 parse 状态）都必须拒绝未知键，
  // 缺必需键同样 fail closed。
  it.each([
    [{ items: [正常文件] }, 'library missing limits key'],
    [{ ...正常库, extra: true }, 'library unknown key'],
    [{ items: [正常文件], limits: { ...正常库.limits, extra: true } }, 'limits unknown key'],
    [{ items: [{ ...正常文件, current_version: { ...正常文件.current_version, extra: true } }], limits: 正常库.limits }, 'version unknown key'],
    [{ items: [{ ...正常文件, current_version: { ...正常文件.current_version, parse: { status: 'not_started', extra: true } } }], limits: 正常库.limits }, 'not_started parse unknown key'],
    [{ items: [{ ...正常文件, current_version: { ...正常文件.current_version, parse: { status: 'pending', updated_at: 'now', extra: true } } }], limits: 正常库.limits }, 'pending parse unknown key'],
    [{ items: [{ ...正常文件, current_version: { ...正常文件.current_version, parse: { status: 'processing', updated_at: 'now', extra: true } } }], limits: 正常库.limits }, 'processing parse unknown key'],
    [{ items: [{ ...正常文件, current_version: { ...正常文件.current_version, parse: { status: 'succeeded', parse_id: 'rp_9', updated_at: 'now', extra: true } } }], limits: 正常库.limits }, 'succeeded parse unknown key'],
    [{ items: [{ ...正常文件, current_version: { ...正常文件.current_version, parse: { status: 'failed', failure_code: 'document_unreadable', updated_at: 'now', extra: true } } }], limits: 正常库.limits }, 'failed parse unknown key'],
  ])('list rejects closed-object violations: %s', async (result, _场景) => {
    const source = 创建附件简历数据源({
      请求: vi.fn().mockResolvedValue({ result, etag: null, requestId: 'req' }),
      请求二进制: vi.fn(),
    });
    await expect(source.读取附件简历库()).rejects.toMatchObject({ code: 'invalid_response', status: 200 });
  });

  // limits：max_files 是 1..3 的整数且 items.length <= max_files。
  it('list accepts max_files=2 with exactly two items and keeps decoded limits fields', async () => {
    const source = 创建附件简历数据源({
      请求: vi.fn().mockResolvedValue({
        result: {
          items: [正常文件, 正常文件],
          limits: { max_files: 2, max_file_bytes: 10_485_760, accepted_media_types: ['application/pdf'] },
        },
        etag: null, requestId: 'req',
      }),
      请求二进制: vi.fn(),
    });
    const 库 = await source.读取附件简历库();
    expect(库.limits.max_files).toBe(2);
    expect(库.limits.max_file_bytes).toBe(10_485_760);
    expect(库.limits.accepted_media_types).toEqual(['application/pdf']);
    expect(库.items).toHaveLength(2);
  });

  it.each([
    [{ items: [正常文件, 正常文件, 正常文件], limits: { ...正常库.limits, max_files: 2 } }, 'more items than max_files'],
    [{ items: [正常文件, 正常文件, 正常文件, 正常文件], limits: { ...正常库.limits, max_files: 4 } }, 'max_files above the 1..3 cap'],
  ])('list rejects limits violations: %s', async (result, _场景) => {
    const source = 创建附件简历数据源({
      请求: vi.fn().mockResolvedValue({ result, etag: null, requestId: 'req' }),
      请求二进制: vi.fn(),
    });
    await expect(source.读取附件简历库()).rejects.toMatchObject({ code: 'invalid_response', status: 200 });
  });

  // 标量规则：字符串非空、revision/version 正整数、size 非负整数、
  // max_file_bytes>=1、accepted types 精确为单元素 application/pdf。
  it.each([
    [{ items: [{ ...正常文件, display_name: '' }], limits: 正常库.limits }, 'empty display_name'],
    [{ items: [{ ...正常文件, revision: 0 }], limits: 正常库.limits }, 'revision below 1'],
    [{ items: [{ ...正常文件, current_version: { ...正常文件.current_version, size_bytes: -1 } }], limits: 正常库.limits }, 'negative size_bytes'],
    [{ items: [{ ...正常文件, current_version: { ...正常文件.current_version, sha256: '' } }], limits: 正常库.limits }, 'empty sha256'],
    [{ items: [正常文件], limits: { ...正常库.limits, accepted_media_types: ['application/pdf', 'text/plain'] } }, 'extra accepted media type'],
    [{ items: [正常文件], limits: { ...正常库.limits, max_file_bytes: 0 } }, 'max_file_bytes below 1'],
  ])('list rejects scalar contract violations: %s', async (result, _场景) => {
    const source = 创建附件简历数据源({
      请求: vi.fn().mockResolvedValue({ result, etag: null, requestId: 'req' }),
      请求二进制: vi.fn(),
    });
    await expect(source.读取附件简历库()).rejects.toMatchObject({ code: 'invalid_response', status: 200 });
  });
});
