// BFF HTTP 客户端：同源 /api/v1 的可靠内核。
// 浏览器只请求同源 /api/v1；所有调用设置 credentials: 'include'；不读取 Cookie。
// 接口失败绝不回退 Mock —— 本模块不 import 模拟数据/企业端模拟数据/接口层。

import type { BFF信封, BFF简历 } from './BFF契约';

/** BFF 校验错误里的单条字段问题：path 是字段路径，reason 是可展示的拒绝理由。 */
export interface BFF字段错误 {
  path: string;
  reason: string;
}

/** Task 5 路由 opt-in 严格错误合同的一行：路由 OpenAPI 冻结的 status / type / 固定 message。 */
export interface BFF严格错误项 {
  status: number;
  type: string;
  message: string;
}

export class BFF错误 extends Error {
  status: number;
  code: string;
  fieldErrors: BFF字段错误[];
  retryAfterSeconds: number | null;
  /** 简历分区写入中途失败时，重新 GET 拿到的权威快照；Context 用它恢复服务端真实状态。 */
  权威简历?: BFF简历;
  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors: BFF字段错误[] = [],
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.retryAfterSeconds = retryAfterSeconds;
    this.name = 'BFF错误';
  }
}

/**
 * Task 1：客户端本地校验错误（映射层在发请求前拒绝的字段问题）。
 * 带 BFF 稳定字段名（如 certificate.year / intention.primary_location_id），
 * 取后端错误文案 直接显示 message —— 只有真正的传输错误才落网络文案。
 */
export class 客户端校验错误 extends Error {
  readonly code = 'client_validation';
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.field = field;
    this.name = '客户端校验错误';
  }
}

interface BFF请求共同选项 {
  path: `/api/v1/${string}`;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  ifMatch?: string;
  幂等?: boolean;
  /** One user intent may retain this key across separate calls after outcome uncertainty. */
  幂等键?: string;
  /** P5 opt-in：显式为 true 时设置 Request.cache = 'no-store'（非持久化读取）；缺省时 cache 保持 undefined。 */
  不缓存?: true;
  /** P8 opt-in：显式为 true 时严格校验 2xx JSON 体恰为 {result, meta:{request_id, api_version:'v1'}}
   *  （OpenAPI Meta：additionalProperties false、request_id minLength 1、api_version const v1）。
   *  缺/多根键、缺/多 meta 键、空 request_id、错版本与 JSON 尾随内容都按 invalid_response
   *  fail closed；缺省时保持既有宽松行为，不改变任何既有请求。 */
  严格信封?: true;
  /** Task 5 opt-in：路由 OpenAPI 错误白名单。启用后非 2xx 信封先按它精确校验（见 解析严格错误），
   *  任何漂移都转 invalid_response；缺省时保持既有宽松解析，不改变任何既有请求。 */
  严格错误合同?: readonly BFF严格错误项[];
}

/** body 与 formData 互斥：JSON 请求走 body，multipart 上传走 formData（浏览器生成 boundary）。 */
export type BFF请求选项 = BFF请求共同选项 & (
  | { body?: unknown; formData?: never }
  | { formData: FormData; body?: never }
);

export interface BFF响应<T> {
  result: T;
  etag: string | null;
  requestId: string | null;
}

/** 二进制 GET（附件简历内容等）的原始字节流响应：contentType 取 media type 部分（去参数、小写）。 */
export interface BFF二进制响应 {
  blob: Blob;
  contentType: string;
  contentDisposition: string | null;
  requestId: string | null;
}

export interface BFF客户端依赖 {
  fetcher?: typeof fetch;
  生成幂等键?: () => string;
  等待?: (milliseconds: number) => Promise<void>;
}

/** 二进制 GET（附件简历内容等）的请求选项：不缓存 为 P5 opt-in no-store 标记。 */
export interface BFF二进制请求选项 {
  不缓存?: true;
}

export interface BFF客户端 {
  请求<T>(options: BFF请求选项): Promise<BFF响应<T>>;
  请求二进制(path: `/api/v1/${string}`, options?: BFF二进制请求选项): Promise<BFF二进制响应>;
}

type 尝试结果<T> =
  | { kind: '成功'; 响应: BFF响应<T> }
  | { kind: '错误'; error: BFF错误 }
  | { kind: '网络错误' };

/** 调用方提供的幂等键：16–128 个可见 ASCII 字节（不含空格），与 OpenAPI IdempotencyKeyHeader 一致。 */
const 幂等键模式 = /^[!-~]{16,128}$/;

/** 409 idempotency_in_progress 与 503 operation_outcome_unknown 可受控重试一次。 */
function 可受控重试(error: BFF错误): boolean {
  return (
    (error.status === 409 && error.code === 'idempotency_in_progress') ||
    (error.status === 503 && error.code === 'operation_outcome_unknown')
  );
}

function 解析RetryAfter(resp: Response): number | null {
  const 值 = resp.headers.get('Retry-After');
  if (值 === null) return null;
  const 数字 = Number(值);
  return Number.isFinite(数字) ? 数字 : null;
}

/** P8 opt-in 严格信封：body 恰为 {result, meta:{request_id, api_version:'v1'}}；返回漂移说明，合规返回 null。 */
function 校验严格信封(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return '响应不是 {result, meta} 信封';
  }
  const 根键 = Object.keys(body);
  if (根键.length !== 2 || !根键.includes('result') || !根键.includes('meta')) {
    return '响应根键不符合 {result, meta} 信封';
  }
  const meta = (body as { meta: unknown }).meta;
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    return '响应 meta 不符合契约';
  }
  const meta键 = Object.keys(meta);
  if (meta键.length !== 2 || !meta键.includes('request_id') || !meta键.includes('api_version')) {
    return '响应 meta 键不符合契约';
  }
  const { request_id, api_version } = meta as { request_id: unknown; api_version: unknown };
  if (typeof request_id !== 'string' || request_id.length === 0) return '响应 request_id 不符合契约';
  if (api_version !== 'v1') return '响应 api_version 不符合契约';
  return null;
}

/** 非 2xx：解析 { error: { type, message, fields? } } 为 BFF错误；JSON 请求与 binary GET 共用。 */
async function 解析错误响应(resp: Response): Promise<BFF错误> {
  let code = 'invalid_response';
  let message = '请求失败';
  let fieldErrors: BFF字段错误[] = [];
  try {
    const body = await resp.json();
    if (body && typeof body === 'object' && 'error' in body) {
      const err = (body as { error: { type?: string; message?: string; fields?: unknown } }).error;
      if (err && typeof err === 'object') {
        if (typeof err.type === 'string') code = err.type;
        if (typeof err.message === 'string') message = err.message;
        // Task 2：fields 是有序数组，每项 {path,reason}；只保留两项都是字符串的条目，
        // 其余形状（含旧的 Record<string,string>）一律忽略，避免 [object Object] 进文案。
        fieldErrors = Array.isArray(err.fields)
          ? err.fields.filter((item): item is BFF字段错误 =>
              typeof item?.path === 'string' && typeof item?.reason === 'string')
          : [];
      }
    }
  } catch {
    // 响应不是合法 JSON → 保持 invalid_response
  }
  return new BFF错误(resp.status, code, message, fieldErrors, 解析RetryAfter(resp));
}

/**
 * Task 5 路由 opt-in 严格错误合同：非 2xx JSON 体必须恰为
 * { error: { type, message, request_id } }，且 status+type 恰好命中合同一行、
 * message 与该行精确一致、request_id 非空。任何漂移（错 status/type/message、
 * 空 request_id、缺/多键、非对象、非 JSON）都 fail closed 成 invalid_response。
 * 与宽松解析的差异只在「原样丢失的 exact-key 信息」；合规时仍铸同一形状的 BFF错误。
 */
function 解析严格错误(resp: Response, body: unknown, 合同: readonly BFF严格错误项[]): BFF错误 {
  const retryAfter = 解析RetryAfter(resp);
  const 漂移 = () => new BFF错误(resp.status, 'invalid_response', '错误响应不符合路由契约', [], retryAfter);
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return 漂移();
  const 根键 = Object.keys(body);
  if (根键.length !== 1 || 根键[0] !== 'error') return 漂移();
  const err = (body as { error: unknown }).error;
  if (typeof err !== 'object' || err === null || Array.isArray(err)) return 漂移();
  const error键 = Object.keys(err);
  if (error键.length !== 3 ||
      !error键.includes('type') || !error键.includes('message') || !error键.includes('request_id')) {
    return 漂移();
  }
  const { type, message, request_id } = err as { type: unknown; message: unknown; request_id: unknown };
  if (typeof request_id !== 'string' || request_id.length === 0) return 漂移();
  const 命中 = 合同.filter((row) => row.status === resp.status && row.type === type);
  if (命中.length !== 1 || message !== 命中[0].message) return 漂移();
  return new BFF错误(resp.status, 命中[0].type, 命中[0].message, [], retryAfter);
}

export function 创建BFF客户端(deps: BFF客户端依赖 = {}): BFF客户端 {
  const fetcher = deps.fetcher ?? globalThis.fetch;
  const 生成幂等键 = deps.生成幂等键 ?? (() => globalThis.crypto.randomUUID());
  const 等待 = deps.等待 ?? ((毫秒: number) => new Promise<void>((完成) => setTimeout(完成, 毫秒)));

  async function 单次<T>(
    path: string,
    init: RequestInit,
    严格信封?: boolean,
    严格错误合同?: readonly BFF严格错误项[],
  ): Promise<尝试结果<T>> {
    let resp: Response;
    try {
      resp = await fetcher(path, init);
    } catch {
      return { kind: '网络错误' };
    }

    if (resp.ok) {
      const etag = resp.headers.get('ETag');
      // 204 No Content：无 JSON envelope，result 为 undefined；request ID 从 X-Request-Id header 读取。
      if (resp.status === 204) {
        return {
          kind: '成功',
          响应: { result: undefined as T, etag, requestId: resp.headers.get('X-Request-Id') },
        };
      }
      let body: unknown;
      try {
        body = await resp.json();
      } catch {
        return { kind: '错误', error: new BFF错误(resp.status, 'invalid_response', '响应不是合法 JSON') };
      }
      // P8 opt-in 严格信封：初次与受控重试共用同一条校验，漂移即 fail closed。
      if (严格信封) {
        const 漂移 = 校验严格信封(body);
        if (漂移 !== null) {
          return { kind: '错误', error: new BFF错误(resp.status, 'invalid_response', 漂移) };
        }
      }
      const 信封 = body as BFF信封<T> | undefined;
      const requestId = 信封 && typeof 信封 === 'object' && 'meta' in 信封 && 信封.meta ? 信封.meta.request_id ?? null : null;
      return {
        kind: '成功',
        响应: { result: 信封?.result as T, etag, requestId },
      };
    }

    // 非 2xx：带严格错误合同时先按路由白名单精确校验；否则走既有宽松解析。
    if (严格错误合同 !== undefined) {
      let body: unknown;
      try {
        body = await resp.json();
      } catch {
        body = undefined; // 非 JSON → 按 严格错误合同 fail closed
      }
      return { kind: '错误', error: 解析严格错误(resp, body, 严格错误合同) };
    }
    return { kind: '错误', error: await 解析错误响应(resp) };
  }

  async function 请求<T>(options: BFF请求选项): Promise<BFF响应<T>> {
    // 类型系统已让 body 与 formData 互斥；这里再挡住绕过类型系统的调用方。
    if (options.body !== undefined && options.formData !== undefined) {
      throw new BFF错误(0, 'invalid_request', 'body 与 formData 不能同时提供');
    }
    // 幂等键只在幂等请求上有意义：裸键是调用方错误，在任何 fetch 之前拒绝。
    if (options.幂等键 !== undefined && !options.幂等) {
      throw new BFF错误(0, 'invalid_request', '幂等键只能与幂等请求一起提供');
    }
    const method = options.method ?? 'GET';
    const isGet = method === 'GET';
    const headers = new Headers();
    const hasBody = options.body !== undefined;
    // Content-Type 只在 JSON body 时发送；FormData 原样交给浏览器生成 multipart boundary。
    if (hasBody) headers.set('Content-Type', 'application/json');
    if (options.ifMatch !== undefined) headers.set('If-Match', options.ifMatch);
    // 幂等请求确定一次 Idempotency-Key，受控重试时复用同一把。调用方提供的键
    // （一次用户意图在结果未知后可跨调用复用）先过 16–128 可见 ASCII 校验，
    // 非法输入在任何 fetch 之前拒绝；注入/生成键路径维持既有行为，不在本边界内。
    let 幂等键: string | null = null;
    if (options.幂等) {
      if (options.幂等键 !== undefined) {
        if (!幂等键模式.test(options.幂等键)) {
          throw new BFF错误(0, 'invalid_request', 'Idempotency-Key 需要 16 到 128 个可见 ASCII 字符');
        }
        幂等键 = options.幂等键;
      } else {
        幂等键 = 生成幂等键();
      }
      headers.set('Idempotency-Key', 幂等键);
    }
    const init: RequestInit = {
      method,
      headers,
      credentials: 'include',
      ...(options.不缓存 ? { cache: 'no-store' as const } : {}),
    };
    if (hasBody) init.body = JSON.stringify(options.body);
    else if (options.formData !== undefined) init.body = options.formData;

    let 结果 = await 单次<T>(options.path, init, options.严格信封, options.严格错误合同);

    // GET 网络错误只重试一次；mutation 网络错误不自动重试。
    if (结果.kind === '网络错误' && isGet) {
      结果 = await 单次<T>(options.path, init, options.严格信封, options.严格错误合同);
    }

    if (结果.kind === '网络错误') {
      throw new BFF错误(0, 'network_error', '网络连接失败，请稍后再试');
    }

    // 幂等请求遇 409 idempotency_in_progress / 503 operation_outcome_unknown：
    // 最多受控重试一次，等待 Retry-After（秒），复用同一把 Idempotency-Key。
    if (结果.kind === '错误' && 幂等键 !== null && 可受控重试(结果.error)) {
      const 等待毫秒 = (结果.error.retryAfterSeconds ?? 0) * 1000;
      await 等待(等待毫秒);
      结果 = await 单次<T>(options.path, init, options.严格信封, options.严格错误合同);
      // 受控重试本身遇网络错误时按网络错误抛出，绝不回退 Mock。
      if (结果.kind === '网络错误') {
        throw new BFF错误(0, 'network_error', '网络连接失败，请稍后再试');
      }
    }

    if (结果.kind === '错误') throw 结果.error;
    return 结果.响应;
  }

  // 二进制 GET：附件简历内容等原始字节流下载。与 JSON GET 一样只重试一次网络错误、
  // 带 credentials: 'include'；非 2xx 复用同一套 解析错误响应 —— 不重试 HTTP 错误，
  // 成功时也绝不尝试解析 JSON envelope（返回原始 Blob）。
  async function 请求二进制(path: `/api/v1/${string}`, options?: BFF二进制请求选项): Promise<BFF二进制响应> {
    const init: RequestInit = {
      method: 'GET',
      headers: new Headers(),
      credentials: 'include',
      ...(options?.不缓存 ? { cache: 'no-store' as const } : {}),
    };
    let resp: Response;
    try {
      resp = await fetcher(path, init);
    } catch {
      try {
        resp = await fetcher(path, init);
      } catch {
        throw new BFF错误(0, 'network_error', '网络连接失败，请稍后再试');
      }
    }
    if (!resp.ok) throw await 解析错误响应(resp);
    return {
      blob: await resp.blob(),
      contentType: resp.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() ?? '',
      contentDisposition: resp.headers.get('Content-Disposition'),
      requestId: resp.headers.get('X-Request-Id'),
    };
  }

  return { 请求, 请求二进制 };
}

export function 取后端错误文案(error: unknown): string {
  // 客户端本地校验错误先判：直接给出具体原因，不落网络文案
  if (error instanceof 客户端校验错误) return error.message;
  // Task 6：普通本地 Error 不是传输故障 —— 只给通用文案，绝不冒充网络故障，
  // 也绝不把内部 message（可能含实现细节）泄露给用户。
  if (!(error instanceof BFF错误)) {
    return '请求失败，请稍后再试';
  }
  // review-final：判据只认 code。真实传输故障永远由本模块铸成 network_error；
  // status 0 还覆盖所有客户端自铸错误（本地校验、契约解码、入参拦截），
  // 旧的 `status === 0 ||` 会把它们统统说成「网络连不上」，把用户支去查 wifi。
  if (error.code === 'network_error') return '无法连接后端服务，请检查网络或稍后重试';
  // 真实性修复 D：任意 5xx 与 internal_error（无论 status）都收口为安全通用文案，
  // 原始 BFF message 不再进入全局 UI fallback。
  if (error.status >= 500 || error.code === 'internal_error') {
    return '后端服务暂时不可用，请稍后重试';
  }
  if (error.code === 'invalid_response') return '服务返回异常，请稍后重试';
  if (error.code === 'invalid_session') return '登录已失效，请重新登录';
  if (error.code === 'invalid_origin') return '当前后端环境配置不正确';
  if (error.code === 'version_conflict') return '数据已在其他地方更新，请重试';
  // Task 6：fieldErrors 仍完整保留给调用方按字段本地化；通用文案不展示机器 reason。
  if (error.code === 'validation_failed') return '填写内容未通过校验';
  // 只有 status 0 的本地自铸 invalid_request 沿用其可行动文案；
  // 其余未知远端 4xx 不透传未审核 message。
  if (error.status === 0 && error.code === 'invalid_request' && error.message) {
    return error.message;
  }
  return '请求失败，请稍后再试';
}
