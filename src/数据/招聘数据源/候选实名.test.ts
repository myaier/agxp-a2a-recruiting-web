// 候选实名域 data source 的行为测试 —— strict decoder 与三个请求形状。
// decoder 覆盖五种合法投影、五闭合拒绝原因、summary/request 双层 exact key set、
// 未知 enum、空 request ID、非正/非安全整数 revision、逐分量 RFC3339（闰年月日、
// 23:59:59、offset）、verified_name 与 rejection_reason 的状态矩阵（两层 revision
// 不要求相等）；请求侧冻结 GET no-store、create multipart（恰一个 metadata JSON
// Blob + 一至两个同名 evidence File）、cancel 的 quoted If-Match 与 encodeURIComponent
// 路径。任何漂移统一 status=200 的 invalid_response，接口失败绝不回退 Mock。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import { 创建候选实名数据源 } from './候选实名';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

const 待审请求wire = {
  request_id: 'ivq_0123456789abcdef0123456789abcdef',
  status: 'pending',
  revision: 3,
  submitted_at: '2026-09-04T08:00:00Z',
  rejection_reason: null,
};

const 待审摘要wire = {
  status: 'pending',
  verified_name: null,
  current_request: { ...待审请求wire },
  revision: 7,
  updated_at: '2026-09-04T08:00:01Z',
};

describe('候选实名数据源', () => {
  const 请求Mock = vi.fn();
  const 请求 = 请求Mock as unknown as 请求函数;
  const 源 = 创建候选实名数据源(请求);

  beforeEach(() => {
    请求Mock.mockReset();
  });

  /** 给下一次 读取候选实名 喂 wire result，返回解出的摘要（或抛出契约错误）。 */
  async function 解(wire: unknown) {
    请求Mock.mockResolvedValueOnce({ result: wire, etag: null, requestId: 'r1' });
    return 源.读取候选实名();
  }

  describe('严格解码', () => {
    it('unverified + 无请求 解出中性摘要', async () => {
      await expect(解({
        status: 'unverified',
        verified_name: null,
        current_request: null,
        revision: 1,
        updated_at: '2026-09-01T00:00:00Z',
      })).resolves.toEqual({
        status: 'unverified',
        verifiedName: null,
        currentRequest: null,
        revision: 1,
        updatedAt: '2026-09-01T00:00:00Z',
      });
    });

    it('unverified + cancelled 请求是取消后的合法投影', async () => {
      await expect(解({
        status: 'unverified',
        verified_name: null,
        current_request: { ...待审请求wire, status: 'cancelled', revision: 5 },
        revision: 8,
        updated_at: '2026-09-04T09:00:00Z',
      })).resolves.toMatchObject({
        status: 'unverified',
        currentRequest: { status: 'cancelled', revision: 5, rejectionReason: null },
      });
    });

    it('pending 摘要带 pending 请求且两层 revision 不要求相等', async () => {
      await expect(解(待审摘要wire)).resolves.toEqual({
        status: 'pending',
        verifiedName: null,
        currentRequest: {
          requestId: 'ivq_0123456789abcdef0123456789abcdef',
          status: 'pending',
          revision: 3,
          submittedAt: '2026-09-04T08:00:00Z',
          rejectionReason: null,
        },
        revision: 7,
        updatedAt: '2026-09-04T08:00:01Z',
      });
    });

    it('verified 摘要只发布 verified_name 与 verified 请求', async () => {
      await expect(解({
        status: 'verified',
        verified_name: '张三',
        current_request: { ...待审请求wire, status: 'verified' },
        revision: 9,
        updated_at: '2026-09-04T10:00:00Z',
      })).resolves.toMatchObject({
        status: 'verified',
        verifiedName: '张三',
        currentRequest: { status: 'verified', rejectionReason: null },
      });
    });

    it('rejected 摘要带闭合拒绝原因', async () => {
      await expect(解({
        status: 'rejected',
        verified_name: null,
        current_request: { ...待审请求wire, status: 'rejected', rejection_reason: 'identity_mismatch' },
        revision: 9,
        updated_at: '2026-09-04T10:00:00Z',
      })).resolves.toMatchObject({
        status: 'rejected',
        verifiedName: null,
        currentRequest: { status: 'rejected', rejectionReason: 'identity_mismatch' },
      });
    });

    it.each([
      'document_unreadable',
      'identity_mismatch',
      'document_expired',
      'unsupported_document',
      'other',
    ] as const)('五个闭合拒绝原因 %s 逐项通过', async (reason) => {
      await expect(解({
        status: 'rejected',
        verified_name: null,
        current_request: { ...待审请求wire, status: 'rejected', rejection_reason: reason },
        revision: 9,
        updated_at: '2026-09-04T10:00:00Z',
      })).resolves.toMatchObject({ currentRequest: { rejectionReason: reason } });
    });

    it('verified_name 200 个含 surrogate pair 的 code point 通过', async () => {
      const 姓名 = `${'😀'.repeat(50)}${'a'.repeat(150)}`;
      await expect(解({
        status: 'verified',
        verified_name: 姓名,
        current_request: { ...待审请求wire, status: 'verified' },
        revision: 9,
        updated_at: '2026-09-04T10:00:00Z',
      })).resolves.toMatchObject({ verifiedName: 姓名 });
    });

    it.each([
      // summary 层漂移：extra / missing key、未知 enum、坏时间、坏 revision
      { ...待审摘要wire, extra: true },
      { status: 'pending', verified_name: null, current_request: null, revision: 1, updated_at: '2026-09-04T08:00:00Z' },
      { ...待审摘要wire, status: 'unknown' },
      { ...待审摘要wire, revision: 0 },
      { ...待审摘要wire, revision: -1 },
      { ...待审摘要wire, revision: 1.5 },
      { ...待审摘要wire, revision: Number.NaN },
      { ...待审摘要wire, revision: Number.POSITIVE_INFINITY },
      { ...待审摘要wire, revision: 2 ** 53 },
      { ...待审摘要wire, revision: '7' },
      { ...待审摘要wire, updated_at: '2026-02-30T00:00:00Z' },
      { ...待审摘要wire, updated_at: '2026-09-04T24:00:00Z' },
      { ...待审摘要wire, updated_at: '2026-09-04T08:00:00+25:00' },
      { ...待审摘要wire, updated_at: '2026-09-04 08:00:00Z' },
      // request 层漂移：extra / missing key、未知 enum、空 ID、坏时间、坏 revision
      { ...待审摘要wire, current_request: { ...待审请求wire, extra: 1 } },
      { ...待审摘要wire, current_request: { request_id: 'ivq_1', status: 'pending', revision: 3, submitted_at: '2026-09-04T08:00:00Z' } },
      { ...待审摘要wire, current_request: { ...待审请求wire, status: 'awaiting' } },
      { ...待审摘要wire, current_request: { ...待审请求wire, request_id: '' } },
      { ...待审摘要wire, current_request: { ...待审请求wire, revision: 0 } },
      { ...待审请求wire, status: 'pending', revision: 2, submitted_at: '2026-09-31T08:00:00Z', rejection_reason: null },
      { ...待审摘要wire, current_request: { ...待审请求wire, revision: Number.NaN } },
      // verified_name 矩阵：非 verified 非空、verified 为空、空白、201 code point
      { ...待审摘要wire, verified_name: '张三' },
      { status: 'verified', verified_name: null, current_request: { ...待审请求wire, status: 'verified' }, revision: 9, updated_at: '2026-09-04T10:00:00Z' },
      { status: 'verified', verified_name: '   ', current_request: { ...待审请求wire, status: 'verified' }, revision: 9, updated_at: '2026-09-04T10:00:00Z' },
      { status: 'verified', verified_name: `${'😀'.repeat(51)}${'a'.repeat(150)}`, current_request: { ...待审请求wire, status: 'verified' }, revision: 9, updated_at: '2026-09-04T10:00:00Z' },
      // rejection_reason 矩阵：rejected 缺原因、非 rejected 带原因、未知原因
      { status: 'rejected', verified_name: null, current_request: { ...待审请求wire, status: 'rejected', rejection_reason: null }, revision: 9, updated_at: '2026-09-04T10:00:00Z' },
      { ...待审摘要wire, current_request: { ...待审请求wire, rejection_reason: 'other' } },
      { status: 'unverified', verified_name: null, current_request: { ...待审请求wire, status: 'cancelled', rejection_reason: 'other' }, revision: 8, updated_at: '2026-09-04T09:00:00Z' },
      { status: 'rejected', verified_name: null, current_request: { ...待审请求wire, status: 'rejected', rejection_reason: 'weird' }, revision: 9, updated_at: '2026-09-04T10:00:00Z' },
      // summary/request 状态矩阵矛盾
      { status: 'unverified', verified_name: null, current_request: { ...待审请求wire, status: 'pending' }, revision: 8, updated_at: '2026-09-04T09:00:00Z' },
      { status: 'verified', verified_name: '张三', current_request: { ...待审请求wire, status: 'pending' }, revision: 9, updated_at: '2026-09-04T10:00:00Z' },
      { status: 'rejected', verified_name: null, current_request: { ...待审请求wire, status: 'verified' }, revision: 9, updated_at: '2026-09-04T10:00:00Z' },
      { ...待审摘要wire, current_request: { ...待审请求wire, status: 'rejected', rejection_reason: 'other' } },
    ])('契约漂移 fail closed', async (wire) => {
      await expect(解(wire)).rejects.toThrowError(
        expect.objectContaining({ status: 200, code: 'invalid_response' }),
      );
    });
  });

  describe('请求选项与 multipart', () => {
    beforeEach(() => {
      请求Mock.mockResolvedValue({ result: { ...待审摘要wire, current_request: { ...待审请求wire } }, etag: null, requestId: 'r1' });
    });

    it('三方法请求选项逐字冻结', async () => {
      const file = new File([new Uint8Array([1])], 'front.png', { type: 'image/png' });
      await 源.读取候选实名();
      await 源.创建候选实名申请(
        { legalName: 'Fixture Candidate', documentType: 'passport', evidence: [file] },
        'iv-create-0123456789abcdef',
      );
      await 源.取消候选实名申请('opaque/request', 7);
      expect(请求Mock.mock.calls.map(([options]) => options)).toEqual([
        {
          path: '/api/v1/me/identity-verification',
          不缓存: true,
          严格信封: true,
        },
        {
          path: '/api/v1/me/identity-verification-requests',
          method: 'POST',
          formData: expect.any(FormData),
          幂等: true,
          幂等键: 'iv-create-0123456789abcdef',
          严格信封: true,
        },
        {
          path: '/api/v1/me/identity-verification-requests/opaque%2Frequest/cancel',
          method: 'POST',
          body: {},
          ifMatch: '"7"',
          严格信封: true,
        },
      ]);
    });

    it('create 组装恰含 metadata JSON Blob 和单个 evidence File', async () => {
      const file = new File([new Uint8Array([1, 2, 3])], 'front.png', { type: 'image/png' });
      await 源.创建候选实名申请(
        { legalName: '  Fixture Candidate  ', documentType: 'passport', evidence: [file] },
        'iv-create-0123456789abcdef',
      );
      const create选项 = 请求Mock.mock.calls[0]?.[0] as (BFF请求选项 & { formData: FormData });
      const parts = [...create选项.formData.entries()];
      expect(parts.map(([名]) => 名)).toEqual(['metadata', 'evidence']);
      const [metadata, evidence] = parts.map(([, 值]) => 值);
      expect(metadata).toBeInstanceOf(Blob);
      expect((metadata as Blob).type).toBe('application/json');
      const 解析 = JSON.parse(await (metadata as Blob).text()) as Record<string, unknown>;
      expect(Object.keys(解析).sort()).toEqual(['document_type', 'legal_name']);
      expect(解析).toEqual({ legal_name: 'Fixture Candidate', document_type: 'passport' });
      // 直接附加页面持有的原始 File，不复制、不读 bytes、不带 filename/编号/size 字段
      expect(evidence).toBe(file);
    });

    it('create 支持两个同名 evidence part', async () => {
      const file1 = new File([new Uint8Array([1])], 'front.png', { type: 'image/png' });
      const file2 = new File([new Uint8Array([2])], 'back.png', { type: 'image/png' });
      await 源.创建候选实名申请(
        { legalName: 'Fixture Candidate', documentType: 'national_id', evidence: [file1, file2] },
        'iv-create-0123456789abcdef',
      );
      const create选项 = 请求Mock.mock.calls[0]?.[0] as (BFF请求选项 & { formData: FormData });
      const parts = [...create选项.formData.entries()];
      expect(parts.map(([名]) => 名)).toEqual(['metadata', 'evidence', 'evidence']);
      expect(parts[1]?.[1]).toBe(file1);
      expect(parts[2]?.[1]).toBe(file2);
    });
  });
});
