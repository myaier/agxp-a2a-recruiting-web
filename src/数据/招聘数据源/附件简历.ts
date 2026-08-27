// 附件简历域数据源：BFF /api/v1/me/resume-files（P2：上传 / CAS 替换 / 删除 / 解析 / 二进制下载）。
// 第九个域 facade：协议代码（path / method / multipart parts / If-Match / 幂等）按冻结契约实现。
// 每个响应先 strict decode（exact key set、闭合 parse 状态与 Spec 四失败码、media type 精确
// application/pdf、limits max_files 1..3 且 items.length <= max_files），不 `as` 直转；
// 接口失败绝不回退 Mock。本模块不 import React 或 Mock。

import { BFF错误 } from '../HTTP客户端';
import type { BFF客户端 } from '../HTTP客户端';
import type {
  BFF附件解析失败码,
  BFF附件解析状态,
  BFF附件简历,
  BFF附件简历版本,
  BFF附件简历库,
  BFF删除回执,
} from '../BFF契约';

// ── 本域小 guard：闭合纪律与 组织.ts / Agent规则.ts 同一基调；本域统一 status=200 的 invalid_response ──

function 契约错误(): BFF错误 {
  return new BFF错误(200, 'invalid_response', '附件简历响应不符合契约');
}

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === 'object' && 值 !== null && !Array.isArray(值);
}

/** exact key set：Object.keys 排序后与必需键排序完全相等，缺键或多出未知键都按契约漂移 fail closed。 */
function 要求闭合对象(input: unknown, 必需键: readonly string[]): Record<string, unknown> {
  if (!是记录(input)) throw 契约错误();
  const 实际键 = Object.keys(input).sort();
  const 期望键 = [...必需键].sort();
  if (实际键.length !== 期望键.length) throw 契约错误();
  for (let i = 0; i < 实际键.length; i += 1) {
    if (实际键[i] !== 期望键[i]) throw 契约错误();
  }
  return input;
}

function 要求非空字符串(值: unknown): string {
  if (typeof 值 !== 'string' || 值.length === 0) throw 契约错误();
  return 值;
}

/** revision / version 是正整数（OpenAPI minimum: 1）。 */
function 要求正整数(值: unknown): number {
  if (typeof 值 !== 'number' || !Number.isInteger(值) || 值 < 1) throw 契约错误();
  return 值;
}

/** size_bytes 是非负整数。 */
function 要求非负整数(值: unknown): number {
  if (typeof 值 !== 'number' || !Number.isInteger(值) || 值 < 0) throw 契约错误();
  return 值;
}

function 要求数组(值: unknown): unknown[] {
  if (!Array.isArray(值)) throw 契约错误();
  return 值;
}

function 要求枚举<T extends string>(值: unknown, 取值: readonly T[]): T {
  if (typeof 值 !== 'string') throw 契约错误();
  for (const 候选 of 取值) if (候选 === 值) return 候选;
  throw 契约错误();
}

// ── 闭合 vocabulary：parse 五种状态、失败码只有 Spec 四值、media type 精确 application/pdf ──

const 解析失败码全表 = [
  'document_unreadable',
  'document_too_complex',
  'parser_invalid_output',
  'parser_temporarily_unavailable',
] as const satisfies readonly BFF附件解析失败码[];

/** parse 每种状态各自闭合的 exact key set。 */
const 解析状态键: Record<BFF附件解析状态['status'], readonly string[]> = {
  not_started: ['status'],
  pending: ['status', 'updated_at'],
  processing: ['status', 'updated_at'],
  succeeded: ['parse_id', 'status', 'updated_at'],
  failed: ['failure_code', 'status', 'updated_at'],
};

function 解码附件解析状态(input: unknown): BFF附件解析状态 {
  if (!是记录(input)) throw 契约错误();
  const status = 要求枚举(input.status, ['not_started', 'pending', 'processing', 'succeeded', 'failed']);
  const raw = 要求闭合对象(input, 解析状态键[status]);
  if (status === 'not_started') return { status };
  if (status === 'pending' || status === 'processing') {
    return { status, updated_at: 要求非空字符串(raw.updated_at) };
  }
  if (status === 'succeeded') {
    return {
      status,
      parse_id: 要求非空字符串(raw.parse_id),
      updated_at: 要求非空字符串(raw.updated_at),
    };
  }
  return {
    status,
    failure_code: 要求枚举(raw.failure_code, 解析失败码全表),
    updated_at: 要求非空字符串(raw.updated_at),
  };
}

const 版本键 = [
  'version_id', 'version', 'size_bytes', 'media_type', 'sha256', 'created_at', 'parse',
] as const;

function 解码附件简历版本(input: unknown): BFF附件简历版本 {
  const raw = 要求闭合对象(input, 版本键);
  if (raw.media_type !== 'application/pdf') throw 契约错误();
  return {
    version_id: 要求非空字符串(raw.version_id),
    version: 要求正整数(raw.version),
    size_bytes: 要求非负整数(raw.size_bytes),
    media_type: 'application/pdf',
    sha256: 要求非空字符串(raw.sha256),
    created_at: 要求非空字符串(raw.created_at),
    parse: 解码附件解析状态(raw.parse),
  };
}

const 文件键 = [
  'file_id', 'display_name', 'revision', 'current_version', 'created_at', 'updated_at',
] as const;

function 解码附件简历(input: unknown): BFF附件简历 {
  const raw = 要求闭合对象(input, 文件键);
  return {
    file_id: 要求非空字符串(raw.file_id),
    display_name: 要求非空字符串(raw.display_name),
    revision: 要求正整数(raw.revision),
    current_version: 解码附件简历版本(raw.current_version),
    created_at: 要求非空字符串(raw.created_at),
    updated_at: 要求非空字符串(raw.updated_at),
  };
}

const 库键 = ['items', 'limits'] as const;
const 限制键 = ['max_files', 'max_file_bytes', 'accepted_media_types'] as const;

function 解码附件简历库(input: unknown): BFF附件简历库 {
  const raw = 要求闭合对象(input, 库键);
  const limits = 要求闭合对象(raw.limits, 限制键);
  // max_files 只许 1..3 的整数：>3 同时违反当前产品上限与 OpenAPI maxItems:3，
  // 必须 fail closed，而不是静默支持 4–5 行；items 超出 max_files 同样拒绝。
  const maxFiles = limits.max_files;
  if (typeof maxFiles !== 'number' || !Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 3) {
    throw 契约错误();
  }
  const maxFileBytes = limits.max_file_bytes;
  if (typeof maxFileBytes !== 'number' || !Number.isInteger(maxFileBytes) || maxFileBytes < 1) {
    throw 契约错误();
  }
  const accepted = limits.accepted_media_types;
  if (!Array.isArray(accepted) || accepted.length !== 1 || accepted[0] !== 'application/pdf') {
    throw 契约错误();
  }
  const items = 要求数组(raw.items).map((项) => 解码附件简历(项));
  if (items.length > maxFiles) throw 契约错误();
  return {
    items,
    limits: { max_files: maxFiles, max_file_bytes: maxFileBytes, accepted_media_types: ['application/pdf'] },
  };
}

function 解码删除回执(input: unknown): BFF删除回执 {
  const raw = 要求闭合对象(input, ['deleted']);
  if (raw.deleted !== true) throw 契约错误();
  return { deleted: true };
}

export interface 附件简历数据源 {
  读取附件简历库(): Promise<BFF附件简历库>;
  创建附件简历(file: File, consent: true): Promise<BFF附件简历>;
  替换附件简历(fileId: string, revision: number, file: File, consent: true): Promise<BFF附件简历>;
  删除附件简历(fileId: string, revision: number): Promise<BFF删除回执>;
  请求附件解析(fileId: string, versionId: string, consent: true): Promise<BFF附件解析状态>;
  下载附件简历(fileId: string): Promise<Blob>;
}

type 附件请求 = Pick<BFF客户端, '请求' | '请求二进制'>;

export function 创建附件简历数据源(client: 附件请求): 附件简历数据源 {
  return {
    async 读取附件简历库() {
      const { result } = await client.请求<unknown>({ path: '/api/v1/me/resume-files' });
      return 解码附件简历库(result);
    },
    async 创建附件简历(file, consent) {
      const formData = new FormData();
      formData.append('display_name', file.name);
      formData.append('file', file);
      formData.append('processing_consent_confirmed', String(consent));
      const { result } = await client.请求<unknown>({
        path: '/api/v1/me/resume-files', method: 'POST', formData, 幂等: true,
      });
      return 解码附件简历(result);
    },
    async 替换附件简历(fileId, revision, file, consent) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('processing_consent_confirmed', String(consent));
      const { result } = await client.请求<unknown>({
        path: `/api/v1/me/resume-files/${encodeURIComponent(fileId)}/content`,
        method: 'PUT', formData, ifMatch: `"${revision}"`, 幂等: true,
      });
      return 解码附件简历(result);
    },
    async 删除附件简历(fileId, revision) {
      const { result } = await client.请求<unknown>({
        path: `/api/v1/me/resume-files/${encodeURIComponent(fileId)}`,
        method: 'DELETE', ifMatch: `"${revision}"`,
      });
      return 解码删除回执(result);
    },
    async 请求附件解析(fileId, versionId, consent) {
      const { result } = await client.请求<unknown>({
        path: `/api/v1/me/resume-files/${encodeURIComponent(fileId)}/parse`,
        method: 'POST', 幂等: true,
        body: { version_id: versionId, processing_consent_confirmed: consent },
      });
      return 解码附件解析状态(result);
    },
    async 下载附件简历(fileId) {
      const result = await client.请求二进制(`/api/v1/me/resume-files/${encodeURIComponent(fileId)}/content`);
      if (result.contentType !== 'application/pdf') {
        throw new BFF错误(200, 'invalid_response', '附件响应不是 PDF');
      }
      return result.blob;
    },
  };
}
