// BFF HTTP 客户端：同源 /api/v1 的可靠内核。
// 浏览器只请求同源 /api/v1；所有调用设置 credentials: 'include'；不读取 Cookie。
// 接口失败绝不回退 Mock —— 本模块不 import 模拟数据/企业端模拟数据/接口层。

import type { BFF信封, BFF简历 } from './BFF契约';

/** BFF 校验错误里的单条字段问题：path 是字段路径，reason 是可展示的拒绝理由。 */
export interface BFF字段错误 {
  path: string;
  reason: string;
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

export interface BFF请求选项 {
  path: `/api/v1/${string}`;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  ifMatch?: string;
  幂等?: boolean;
}

export interface BFF响应<T> {
  result: T;
  etag: string | null;
  requestId: string | null;
}

export interface BFF客户端依赖 {
  fetcher?: typeof fetch;
  生成幂等键?: () => string;
  等待?: (milliseconds: number) => Promise<void>;
}

export interface BFF客户端 {
  请求<T>(options: BFF请求选项): Promise<BFF响应<T>>;
}

type 尝试结果<T> =
  | { kind: '成功'; 响应: BFF响应<T> }
  | { kind: '错误'; error: BFF错误 }
  | { kind: '网络错误' };

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

export function 创建BFF客户端(deps: BFF客户端依赖 = {}): BFF客户端 {
  const fetcher = deps.fetcher ?? globalThis.fetch;
  const 生成幂等键 = deps.生成幂等键 ?? (() => globalThis.crypto.randomUUID());
  const 等待 = deps.等待 ?? ((毫秒: number) => new Promise<void>((完成) => setTimeout(完成, 毫秒)));

  async function 单次<T>(path: string, init: RequestInit): Promise<尝试结果<T>> {
    let resp: Response;
    try {
      resp = await fetcher(path, init);
    } catch {
      return { kind: '网络错误' };
    }

    if (resp.ok) {
      const etag = resp.headers.get('ETag');
      let body: unknown;
      try {
        body = await resp.json();
      } catch {
        return { kind: '错误', error: new BFF错误(resp.status, 'invalid_response', '响应不是合法 JSON') };
      }
      const 信封 = body as BFF信封<T> | undefined;
      const requestId = 信封 && typeof 信封 === 'object' && 'meta' in 信封 && 信封.meta ? 信封.meta.request_id ?? null : null;
      return {
        kind: '成功',
        响应: { result: 信封?.result as T, etag, requestId },
      };
    }

    // 非 2xx：解析 { error: { type, message, fields? } } 为 BFF错误。
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
    return { kind: '错误', error: new BFF错误(resp.status, code, message, fieldErrors, 解析RetryAfter(resp)) };
  }

  async function 请求<T>(options: BFF请求选项): Promise<BFF响应<T>> {
    const method = options.method ?? 'GET';
    const isGet = method === 'GET';
    const headers = new Headers();
    const hasBody = options.body !== undefined;
    // Content-Type 只在有 body 时发送。
    if (hasBody) headers.set('Content-Type', 'application/json');
    if (options.ifMatch !== undefined) headers.set('If-Match', options.ifMatch);
    // 幂等请求生成一次 Idempotency-Key，受控重试时复用同一把。
    let 幂等键: string | null = null;
    if (options.幂等) {
      幂等键 = 生成幂等键();
      headers.set('Idempotency-Key', 幂等键);
    }
    const init: RequestInit = {
      method,
      headers,
      credentials: 'include',
    };
    if (hasBody) init.body = JSON.stringify(options.body);

    let 结果 = await 单次<T>(options.path, init);

    // GET 网络错误只重试一次；mutation 网络错误不自动重试。
    if (结果.kind === '网络错误' && isGet) {
      结果 = await 单次<T>(options.path, init);
    }

    if (结果.kind === '网络错误') {
      throw new BFF错误(0, 'network_error', '网络连接失败，请稍后再试');
    }

    // 幂等请求遇 409 idempotency_in_progress / 503 operation_outcome_unknown：
    // 最多受控重试一次，等待 Retry-After（秒），复用同一把 Idempotency-Key。
    if (结果.kind === '错误' && 幂等键 !== null && 可受控重试(结果.error)) {
      const 等待毫秒 = (结果.error.retryAfterSeconds ?? 0) * 1000;
      await 等待(等待毫秒);
      结果 = await 单次<T>(options.path, init);
      // 受控重试本身遇网络错误时按网络错误抛出，绝不回退 Mock。
      if (结果.kind === '网络错误') {
        throw new BFF错误(0, 'network_error', '网络连接失败，请稍后再试');
      }
    }

    if (结果.kind === '错误') throw 结果.error;
    return 结果.响应;
  }

  return { 请求 };
}

export function 取后端错误文案(error: unknown): string {
  if (!(error instanceof BFF错误)) return '网络连接失败，请稍后再试';
  if (error.code === 'invalid_session') return '登录已失效，请重新登录';
  if (error.code === 'invalid_origin') return '当前后端环境配置不正确';
  if (error.code === 'version_conflict') return '数据已在其他地方更新，请重试';
  if (error.code === 'validation_failed') return error.fieldErrors[0]?.reason ?? '填写内容未通过校验';
  return error.message || '请求失败，请稍后再试';
}