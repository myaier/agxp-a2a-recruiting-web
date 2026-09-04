// 候选实名域数据源：BFF /api/v1/me/identity-verification* 的候选 owner 流程 ——
// summary 读取、multipart 材料创建与 pending 取消。合同冻结在 release/0.2.5：
// create 是 202 无 ETag、multipart 恰一个 metadata JSON part + 一至两个同名
// evidence part（不手写 Content-Type，浏览器生成 boundary，不读/不复制证件 bytes）；
// cancel 用 summary 顶层 revision 的 quoted If-Match 与 encodeURIComponent 路径。
// 每个响应 strict decode：双层 exact key set、闭合枚举、非空 request ID（后端未发布
// 更窄 grammar，前端不发明）、≥1 safe integer revision、逐分量 RFC3339、verified_name
// 与 rejection_reason 的状态矩阵（两层 revision 不要求相等）；任何漂移统一
// invalid_response。接口失败绝不回退 Mock。

import { BFF错误 } from '../HTTP客户端';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';

function 契约错误(): BFF错误 {
  return new BFF错误(200, 'invalid_response', '候选实名响应不符合契约');
}

// ── 本域小 guard：与 JD导入.ts 同一闭合纪律，本域统一 status=200 的 invalid_response ──

function 是记录(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** exact key set：缺必需键或多出未知键都按契约漂移 fail closed。 */
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

/** OpenAPI integer format int64 minimum 1：非数字、非整数、非安全整数或 <1 都是契约漂移。 */
function 要求正安全整数(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw 契约错误();
  return value;
}

/** 后端 OpenAPI 只约束非空字符串，未发布更窄 grammar；前端不自行发明。 */
function 要求非空字符串(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw 契约错误();
  return value;
}

/** RFC3339 形状：YYYY-MM-DDTHH:MM:SS(.frac)?(Z|±HH:MM)。 */
const RFC3339 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/;

/** 月份天数（下标 0 = 一月）；闰年由 要求RFC3339时间 按年份现场计算。 */
const 平年月天数 = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/**
 * RFC3339 时间必须逐分量合法（同 JD导入.ts 的算法）：Date.parse 会把 2026-02-30、
 * 24:00:00 这类畸形值静默归一化成合法时刻，靠它把关会把非合同时间放进页面 ——
 * 这里显式校验月份/日（含闰年二月）/时分秒与偏移量，畸形即契约漂移 fail closed。
 */
function 要求RFC3339时间(value: unknown): string {
  if (typeof value !== 'string') throw 契约错误();
  const 命中 = RFC3339.exec(value);
  if (命中 === null) throw 契约错误();
  const [, 年, 月, 日, 时, 分, 秒, 偏移号, 偏移时, 偏移分] = 命中;
  const 年数 = Number(年);
  const 月数 = Number(月);
  const 日数 = Number(日);
  const 闰 = (年数 % 4 === 0 && 年数 % 100 !== 0) || 年数 % 400 === 0;
  const 月天数 = 月数 === 2 && 闰 ? 29 : 平年月天数[月数 - 1];
  if (月数 < 1 || 月数 > 12 || Number.isNaN(月天数) || 日数 < 1 || 日数 > 月天数) throw 契约错误();
  if (Number(时) > 23 || Number(分) > 59 || Number(秒) > 59) throw 契约错误();
  if (偏移号 !== undefined && (Number(偏移时) > 23 || Number(偏移分) > 59)) throw 契约错误();
  return value;
}

// ── 闭合 vocabulary（与 mobile-v1 OpenAPI 一一对应）──

export type 候选实名状态 = 'unverified' | 'pending' | 'verified' | 'rejected';
export type 候选实名申请状态 = 'pending' | 'verified' | 'rejected' | 'cancelled';
export type 候选实名拒绝原因 =
  | 'document_unreadable'
  | 'identity_mismatch'
  | 'document_expired'
  | 'unsupported_document'
  | 'other';
export type 候选实名证件类型 = 'national_id' | 'passport' | 'other_government_id';

const 状态全表 = ['unverified', 'pending', 'verified', 'rejected'] as const satisfies readonly 候选实名状态[];
const 申请状态全表 = ['pending', 'verified', 'rejected', 'cancelled'] as const satisfies readonly 候选实名申请状态[];
const 拒绝原因全表 = [
  'document_unreadable',
  'identity_mismatch',
  'document_expired',
  'unsupported_document',
  'other',
] as const satisfies readonly 候选实名拒绝原因[];

export interface 候选实名申请 {
  requestId: string;
  status: 候选实名申请状态;
  revision: number;
  submittedAt: string;
  rejectionReason: 候选实名拒绝原因 | null;
}

export interface 候选实名摘要 {
  status: 候选实名状态;
  verifiedName: string | null;
  currentRequest: 候选实名申请 | null;
  revision: number;
  updatedAt: string;
}

export interface 创建候选实名输入 {
  legalName: string;
  documentType: 候选实名证件类型;
  evidence: File[];
}

/** verified_name：只在 verified 时非空 —— trim 后非空且 ≤200 Unicode code point（Array.from 计数，不用 UTF-16 length）。 */
function 解认证姓名(value: unknown, status: 候选实名状态): string | null {
  if (status !== 'verified') {
    if (value !== null) throw 契约错误();
    return null;
  }
  if (typeof value !== 'string') throw 契约错误();
  if (value.trim().length === 0 || Array.from(value).length > 200) throw 契约错误();
  return value;
}

/** 请求：五键闭合；rejection_reason 只在 rejected request 时非空，其他状态必须为 null。 */
function 解码申请(value: unknown): 候选实名申请 {
  const raw = 要求闭合对象(value, ['request_id', 'status', 'revision', 'submitted_at', 'rejection_reason']);
  const status = 要求枚举(raw.status, 申请状态全表);
  const rejectionReason = raw.rejection_reason === null
    ? null
    : 要求枚举(raw.rejection_reason, 拒绝原因全表);
  if (status === 'rejected' ? rejectionReason === null : rejectionReason !== null) throw 契约错误();
  return {
    requestId: 要求非空字符串(raw.request_id),
    status,
    revision: 要求正安全整数(raw.revision),
    submittedAt: 要求RFC3339时间(raw.submitted_at),
    rejectionReason,
  };
}

/**
 * 摘要：五键闭合 + summary/request 状态矩阵 —— unverified 只配 null 或 cancelled
 * 请求（取消后的合法投影），pending/verified/rejected 必须带同状态请求；两层 revision
 * 不要求相等，不在此强加。
 */
function 解码摘要(value: unknown): 候选实名摘要 {
  const raw = 要求闭合对象(value, ['status', 'verified_name', 'current_request', 'revision', 'updated_at']);
  const status = 要求枚举(raw.status, 状态全表);
  const verifiedName = 解认证姓名(raw.verified_name, status);
  const currentRequest = raw.current_request === null ? null : 解码申请(raw.current_request);
  const 请求状态 = currentRequest?.status ?? null;
  const 矩阵矛盾 = status === 'unverified'
    ? 请求状态 !== null && 请求状态 !== 'cancelled'
    : 请求状态 !== status;
  if (矩阵矛盾) throw 契约错误();
  return {
    status,
    verifiedName,
    currentRequest,
    revision: 要求正安全整数(raw.revision),
    updatedAt: 要求RFC3339时间(raw.updated_at),
  };
}

// ── 数据源 ──

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

export interface 候选实名数据源 {
  读取候选实名(): Promise<候选实名摘要>;
  创建候选实名申请(input: 创建候选实名输入, idempotencyKey: string): Promise<候选实名摘要>;
  取消候选实名申请(requestId: string, revision: number): Promise<候选实名摘要>;
}

export function 创建候选实名数据源(请求: 请求函数): 候选实名数据源 {
  return {
    async 读取候选实名() {
      const response = await 请求<unknown>({
        path: '/api/v1/me/identity-verification',
        不缓存: true,
        严格信封: true,
      });
      return 解码摘要(response.result);
    },
    async 创建候选实名申请(input, idempotencyKey) {
      // 冻结的 multipart 组装：metadata 只含 trim 后 legal_name 与 document_type，
      // evidence 直接附加页面持有的原始 File；本域不做文件组合校验，也不复制 File。
      const formData = new FormData();
      formData.append('metadata', new Blob([
        JSON.stringify({ legal_name: input.legalName.trim(), document_type: input.documentType }),
      ], { type: 'application/json' }));
      for (const file of input.evidence) formData.append('evidence', file);
      const response = await 请求<unknown>({
        path: '/api/v1/me/identity-verification-requests',
        method: 'POST',
        formData,
        幂等: true,
        幂等键: idempotencyKey,
        严格信封: true,
      });
      return 解码摘要(response.result);
    },
    async 取消候选实名申请(requestId, revision) {
      // If-Match 用 summary 顶层 revision 的 quoted decimal；requestId 只做 URL 编码。
      const response = await 请求<unknown>({
        path: `/api/v1/me/identity-verification-requests/${encodeURIComponent(requestId)}/cancel`,
        method: 'POST',
        body: {},
        ifMatch: `"${revision}"`,
        严格信封: true,
      });
      return 解码摘要(response.result);
    },
  };
}
