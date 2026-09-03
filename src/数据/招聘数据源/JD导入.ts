// JD 导入域数据源：BFF /api/v1/recruiter/job-draft-imports 的建议稿创建与读取。
// 第十五个域 facade：job-draft-imports 冻结合同（agxp-server scope/jd-pdf-upload-feature-parity@2be8c2748）。
// POST multipart 恰好 file + processing_consent_confirmed:"true" 两 part，不手写 Content-Type，
// 调用方幂等键 + 严格信封；部分系统给合法 .pdf 空 MIME，只在上传 part 内规范化为
// application/pdf（保留文件名与 lastModified），不增加额外 part。
// GET 显式 no-store + 严格信封；import_id 先过 ^jdi_[0-9a-f]{32}$ grammar，非法即零 HTTP
// 按 invalid_request 拒绝。每个响应 strict decode：每层 exact key set、pending/processing/
// succeeded/failed 状态矛盾 fail closed、闭合枚举、RFC3339 时间、keywords 不许 null 或
// 非字符串成员；任何漂移统一 invalid_response。接口失败绝不回退 Mock。

import { BFF错误 } from '../HTTP客户端';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type {
  BFFJD导入,
  BFFJD导入失败码,
  BFFJD建议,
} from '../BFF契约';

// ── 本域小 guard：闭合纪律与 简历预填.ts 同一基调；本域统一 status=200 的 invalid_response ──

function 契约错误(): BFF错误 {
  return new BFF错误(200, 'invalid_response', 'JD 导入响应不符合契约');
}

function 是记录(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** exact key set：Object.keys 排序后与必需键排序完全相等，缺键或多出未知键都按契约漂移 fail closed。 */
function 要求闭合对象(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!是记录(value)) throw 契约错误();
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw 契约错误();
  }
  return value;
}

function 要求枚举<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value === 'string' && values.includes(value as T)) return value as T;
  throw 契约错误();
}

function 要求可空字符串(value: unknown): string | null {
  if (value === null || typeof value === 'string') return value;
  throw 契约错误();
}

function 要求可空枚举<T extends string>(value: unknown, values: readonly T[]): T | null {
  return value === null ? null : 要求枚举(value, values);
}

/** 发布的 import_id grammar（handoff 冻结 pattern）：jdi_ 前缀 + 32 位小写十六进制。 */
const 导入ID = /^jdi_[0-9a-f]{32}$/;

/** RFC3339 时间：YYYY-MM-DDTHH:MM:SS(.frac)?(Z|±HH:MM)，且必须是真实日历时刻。 */
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function 要求导入ID(value: unknown): string {
  if (typeof value !== 'string' || !导入ID.test(value)) throw 契约错误();
  return value;
}

function 要求时间(value: unknown): string {
  if (typeof value !== 'string' || !RFC3339.test(value) || Number.isNaN(Date.parse(value))) throw 契约错误();
  return value;
}

const 建议键 = [
  'title', 'recruitment_type', 'workplace_mode', 'office_location', 'description',
  'requirements', 'education_requirement', 'experience_requirement',
  'category_source_name', 'location_source_name', 'keywords',
] as const;

/** 建议：handoff 冻结十一个键全在；nullable 字段允许 null，keywords 必须是纯字符串数组。 */
function 解码建议(value: unknown): BFFJD建议 {
  const raw = 要求闭合对象(value, 建议键);
  if (!Array.isArray(raw.keywords) || raw.keywords.some((item) => typeof item !== 'string')) {
    throw 契约错误();
  }
  return {
    title: 要求可空字符串(raw.title),
    recruitment_type: 要求可空枚举(raw.recruitment_type, ['social_full_time', 'campus', 'internship', 'part_time']),
    workplace_mode: 要求可空枚举(raw.workplace_mode, ['onsite', 'hybrid', 'remote']),
    office_location: 要求可空字符串(raw.office_location),
    description: 要求可空字符串(raw.description),
    requirements: 要求可空字符串(raw.requirements),
    education_requirement: 要求可空枚举(raw.education_requirement, ['none', 'associate', 'bachelor', 'master', 'doctorate']),
    experience_requirement: 要求可空枚举(raw.experience_requirement, ['none', 'one_to_three_years', 'three_to_five_years', 'five_plus_years', 'ten_plus_years']),
    category_source_name: 要求可空字符串(raw.category_source_name),
    location_source_name: 要求可空字符串(raw.location_source_name),
    keywords: [...raw.keywords] as string[],
  };
}

const 失败码 = [
  'invalid_pdf',
  'document_too_complex',
  'parser_invalid_output',
  'parser_temporarily_unavailable',
] as const satisfies readonly BFFJD导入失败码[];

/** 导入：先认 status 闭集，再按状态要求 exact key set（suggestion/failure_code 不串位）。 */
function 解码JD导入(value: unknown): BFFJD导入 {
  if (!是记录(value)) throw 契约错误();
  const status = 要求枚举(value.status, ['pending', 'processing', 'succeeded', 'failed']);
  const keys = status === 'succeeded'
    ? ['import_id', 'status', 'created_at', 'updated_at', 'suggestion']
    : status === 'failed'
      ? ['import_id', 'status', 'created_at', 'updated_at', 'failure_code']
      : ['import_id', 'status', 'created_at', 'updated_at'];
  const raw = 要求闭合对象(value, keys);
  const base = {
    import_id: 要求导入ID(raw.import_id),
    created_at: 要求时间(raw.created_at),
    updated_at: 要求时间(raw.updated_at),
  };
  if (status === 'succeeded') return { ...base, status, suggestion: 解码建议(raw.suggestion) };
  if (status === 'failed') return { ...base, status, failure_code: 要求枚举(raw.failure_code, 失败码) };
  return { ...base, status };
}

// ── 数据源 ──

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

export interface JD导入数据源 {
  创建JD导入(file: File, idempotencyKey: string): Promise<BFFJD导入>;
  读取JD导入(importId: string): Promise<BFFJD导入>;
}

export function 创建JD导入数据源(请求: 请求函数): JD导入数据源 {
  return {
    async 创建JD导入(file, idempotencyKey) {
      const formData = new FormData();
      // 校验附件PDF 允许部分系统提供空 MIME：只在 multipart part 内规范化为 application/pdf。
      const upload = file.type === ''
        ? new File([file], file.name, { type: 'application/pdf', lastModified: file.lastModified })
        : file;
      formData.append('file', upload);
      formData.append('processing_consent_confirmed', 'true');
      const response = await 请求<unknown>({
        path: '/api/v1/recruiter/job-draft-imports',
        method: 'POST',
        formData,
        幂等: true,
        幂等键: idempotencyKey,
        严格信封: true,
      });
      return 解码JD导入(response.result);
    },
    async 读取JD导入(importId) {
      if (!导入ID.test(importId)) {
        throw new BFF错误(0, 'invalid_request', 'JD 导入编号不合法');
      }
      const response = await 请求<unknown>({
        path: `/api/v1/recruiter/job-draft-imports/${encodeURIComponent(importId)}` as `/api/v1/${string}`,
        不缓存: true,
        严格信封: true,
      });
      return 解码JD导入(response.result);
    },
  };
}
