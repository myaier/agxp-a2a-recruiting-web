// P8 控制面域数据源：BFF /api/v1 的账号安全（凭证/会话/退出其他设备）、手机号换绑、
// 数据导出、招聘账号注销与合规反馈/上下文举报。第十三个域 facade：
// 每个 JSON 请求 opt-in 严格信封（HTTP客户端 校验恰为 {result, meta}），
// GET 全部 不缓存，mutation 全部 幂等 + 调用方幂等键；创建导出不带 body，
// 注销 body 精确 {}。每个响应先 strict decode（exact key set、闭合 enum、
// exp_/del_ pattern、RFC3339、安全非负计数、列表唯一 ID、会话恰好一个 current、
// 凭证至多一个 phone_otp、LinkNextAction 只认 enter_code、导出任意
// status×download_ready 组合都放行），错误先过逐端点闭合联合表，
// 未发布的 status+code 组合一律按 invalid_response fail closed。
// download 只给同源相对 URL，不经过 JSON 客户端、不缓冲 ZIP。
// 接口失败绝不回退 Mock。本模块不 import React 或模拟数据。

import { BFF错误 } from '../HTTP客户端';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type { BFF凭证提供者, BFF工单状态, BFF注销状态, BFF导出状态 } from '../BFF契约';

// ── camelCase 领域类型：wire 的 snake_case 只在 decoder 里出现一次 ──

export interface P8Credential {
  credentialId: string;
  provider: 'phone_otp' | 'wechat' | 'email_otp';
  display: string;
  verifiedAt: string;
}

export interface P8Session {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export interface P8ReplacementAttempt {
  attemptId: string;
  nextAction: {
    type: 'enter_code';
    expiresAt: string | null;
    retryAfterSeconds: number | null;
  };
}

export interface P8ReplacementResult {
  credential: P8Credential;
  revokedSessions: number;
  unchanged: boolean;
}

export interface P8DataExport {
  exportId: string;
  status: 'queued' | 'running' | 'ready' | 'failed' | 'expired';
  createdAt: string;
  expiresAt: string | null;
  downloadReady: boolean;
}

export interface P8AccountDeletion {
  deletionId: string;
  status: 'deletion_pending' | 'retention' | 'deleted';
  retentionUntil: string;
}

export type P8FeedbackCategory = 'bug' | 'suggestion' | 'other';
export type P8ReportReason =
  | 'false_information'
  | 'salary_misrepresentation'
  | 'harassment'
  | 'other';
export type P8ReportTarget =
  | { type: 'job'; ref: string }
  | { type: 'match_case'; ref: string }
  | { type: 'conversation'; ref: string };

export interface P8FeedbackReceipt {
  ticketId: string;
  status: 'received' | 'reviewing' | 'resolved' | 'dismissed';
}

export interface P8ReportReceipt extends P8FeedbackReceipt {
  blockStatus: 'applied' | 'not_requested';
}

function P8契约错误(): BFF错误 {
  return new BFF错误(200, 'invalid_response', '服务返回了不符合契约的账号控制面数据');
}

// ── 本域小 guard：与 真人会话.ts / MatchCase.ts 同一闭合纪律；不引入 validator 库 ──

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === 'object' && 值 !== null && !Array.isArray(值);
}

/** exact key set：缺必需键或多出未知键（可选键仅按白名单放行）都按契约漂移 fail closed。 */
function 要求闭合对象(
  input: unknown,
  必需键: readonly string[],
  可选键: readonly string[] = [],
): Record<string, unknown> {
  if (!是记录(input)) throw P8契约错误();
  for (const 键 of 必需键) if (!(键 in input)) throw P8契约错误();
  const 允许键 = new Set([...必需键, ...可选键]);
  for (const 键 of Object.keys(input)) if (!允许键.has(键)) throw P8契约错误();
  return input;
}

function 要求字符串(值: unknown): string {
  if (typeof 值 !== 'string') throw P8契约错误();
  return 值;
}

function 要求非空字符串(值: unknown): string {
  const 字符串 = 要求字符串(值);
  if (字符串.length === 0) throw P8契约错误();
  return 字符串;
}

/** OpenAPI 声明了 pattern 的响应 ID：非空且形状匹配，二者缺一即契约漂移。 */
function 要求模式串(值: unknown, 模式: RegExp): string {
  const 字符串 = 要求非空字符串(值);
  if (!模式.test(字符串)) throw P8契约错误();
  return 字符串;
}

function 要求数组(值: unknown): unknown[] {
  if (!Array.isArray(值)) throw P8契约错误();
  return 值;
}

function 要求布尔(值: unknown): boolean {
  if (typeof 值 !== 'boolean') throw P8契约错误();
  return 值;
}

function 要求枚举<T extends string>(值: unknown, 取值: readonly T[]): T {
  if (typeof 值 !== 'string') throw P8契约错误();
  for (const 候选 of 取值) if (候选 === 值) return 候选;
  throw P8契约错误();
}

/** revoked_sessions / retry_after_seconds：非安全整数或负数都是契约漂移。 */
function 要求安全非负整数(值: unknown): number {
  if (typeof 值 !== 'number' || !Number.isSafeInteger(值) || 值 < 0) throw P8契约错误();
  return 值;
}

const RFC3339模式 = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

/** 时间戳按 OpenAPI 声明为 RFC 3339 UTC；形状或可解析性不对都拒绝。 */
function 要求RFC3339(值: unknown): string {
  const 字符串 = 要求字符串(值);
  if (!RFC3339模式.test(字符串) || Number.isNaN(Date.parse(字符串))) throw P8契约错误();
  return 字符串;
}

// ── 闭合 vocabulary ──

const 提供者全表 = ['phone_otp', 'wechat', 'email_otp'] as const satisfies readonly BFF凭证提供者[];
const 导出状态全表 = ['queued', 'running', 'ready', 'failed', 'expired'] as const satisfies readonly BFF导出状态[];
const 注销状态全表 = ['deletion_pending', 'retention', 'deleted'] as const satisfies readonly BFF注销状态[];
const 工单状态全表 = ['received', 'reviewing', 'resolved', 'dismissed'] as const satisfies readonly BFF工单状态[];
const 屏蔽状态全表 = ['applied', 'not_requested'] as const satisfies readonly P8ReportReceipt['blockStatus'][];
const 反馈分类全表 = ['bug', 'suggestion', 'other'] as const satisfies readonly P8FeedbackCategory[];
const 举报原因全表 = [
  'false_information', 'salary_misrepresentation', 'harassment', 'other',
] as const satisfies readonly P8ReportReason[];
const 举报目标分支全表 = ['job', 'match_case', 'conversation'] as const satisfies readonly P8ReportTarget['type'][];

/** 发布的 ID pattern：DataExport.export_id / AccountDeletion.deletion_id。 */
const 导出ID模式 = /^exp_[0-9a-f]{32}$/;
const 注销ID模式 = /^del_[0-9a-f]{32}$/;

// ── 具体 decoder：逐字段过 guard，不做 `as` 直转 ──

function 解单凭证(input: unknown): P8Credential {
  const raw = 要求闭合对象(input, ['credential_id', 'provider', 'display', 'verified_at']);
  return {
    credentialId: 要求非空字符串(raw.credential_id),
    provider: 要求枚举(raw.provider, 提供者全表),
    display: 要求非空字符串(raw.display),
    verifiedAt: 要求RFC3339(raw.verified_at),
  };
}

/**
 * 解P8凭证列表：重复 credential_id 或多个 phone_otp 都是契约漂移
 * （页面按唯一 phone_otp 行展示掩码手机号；零个 → “未绑定”）。
 */
export function 解P8凭证列表(input: unknown): P8Credential[] {
  const raw = 要求闭合对象(input, ['credentials']);
  const 行们 = 要求数组(raw.credentials).map(解单凭证);
  const 已见 = new Set<string>();
  let 手机凭证数 = 0;
  for (const 行 of 行们) {
    if (已见.has(行.credentialId)) throw P8契约错误();
    已见.add(行.credentialId);
    if (行.provider === 'phone_otp') 手机凭证数 += 1;
  }
  if (手机凭证数 > 1) throw P8契约错误();
  return 行们;
}

function 解单会话(input: unknown): P8Session {
  const raw = 要求闭合对象(input, ['session_id', 'expires_at', 'created_at', 'current']);
  return {
    sessionId: 要求非空字符串(raw.session_id),
    expiresAt: 要求RFC3339(raw.expires_at),
    createdAt: 要求RFC3339(raw.created_at),
    current: 要求布尔(raw.current),
  };
}

/** 解P8会话：恰好一个 current=true（前端不变式，schema 不编码）；零个或多个都拒绝，不自行挑行。 */
export function 解P8会话(input: unknown): P8Session[] {
  const raw = 要求闭合对象(input, ['sessions']);
  const 行们 = 要求数组(raw.sessions).map(解单会话);
  const 已见 = new Set<string>();
  let 当前数 = 0;
  for (const 行 of 行们) {
    if (已见.has(行.sessionId)) throw P8契约错误();
    已见.add(行.sessionId);
    if (行.current) 当前数 += 1;
  }
  if (当前数 !== 1) throw P8契约错误();
  return 行们;
}

/** 解P8换绑尝试：LinkNextAction 只认 enter_code（P8 前端收窄）；窗口字段缺席归 null，在场必须合法。 */
export function 解P8换绑尝试(input: unknown): P8ReplacementAttempt {
  const raw = 要求闭合对象(input, ['attempt_id', 'next_action']);
  const 动作 = 要求闭合对象(raw.next_action, ['type'], ['expires_at', 'retry_after_seconds']);
  return {
    attemptId: 要求非空字符串(raw.attempt_id),
    nextAction: {
      type: 要求枚举(动作.type, ['enter_code'] as const),
      expiresAt: 动作.expires_at === undefined ? null : 要求RFC3339(动作.expires_at),
      retryAfterSeconds: 动作.retry_after_seconds === undefined
        ? null
        : 要求安全非负整数(动作.retry_after_seconds),
    },
  };
}

export function 解P8换绑结果(input: unknown): P8ReplacementResult {
  const raw = 要求闭合对象(input, ['credential', 'revoked_sessions', 'unchanged']);
  return {
    credential: 解单凭证(raw.credential),
    revokedSessions: 要求安全非负整数(raw.revoked_sessions),
    unchanged: 要求布尔(raw.unchanged),
  };
}

/**
 * 解P8导出：status 与 download_ready 的任意组合都放行（可下载只是派生 UI 规则
 * ready && downloadReady，由操作层/页面决定）；expires_at 必在但可空（可空 ≠ 可缺）。
 */
export function 解P8导出(input: unknown): P8DataExport {
  const raw = 要求闭合对象(input, ['export_id', 'status', 'created_at', 'expires_at', 'download_ready']);
  return {
    exportId: 要求模式串(raw.export_id, 导出ID模式),
    status: 要求枚举(raw.status, 导出状态全表),
    createdAt: 要求RFC3339(raw.created_at),
    expiresAt: raw.expires_at === null ? null : 要求RFC3339(raw.expires_at),
    downloadReady: 要求布尔(raw.download_ready),
  };
}

export function 解P8注销(input: unknown): P8AccountDeletion {
  const raw = 要求闭合对象(input, ['deletion_id', 'status', 'retention_until']);
  return {
    deletionId: 要求模式串(raw.deletion_id, 注销ID模式),
    status: 要求枚举(raw.status, 注销状态全表),
    retentionUntil: 要求RFC3339(raw.retention_until),
  };
}

/** ticket_id 发布为裸 string（无 pattern / minLength）：只断言 string，不发明约束。 */
export function 解P8反馈回执(input: unknown): P8FeedbackReceipt {
  const raw = 要求闭合对象(input, ['ticket_id', 'status']);
  return { ticketId: 要求字符串(raw.ticket_id), status: 要求枚举(raw.status, 工单状态全表) };
}

export function 解P8举报回执(input: unknown): P8ReportReceipt {
  const raw = 要求闭合对象(input, ['ticket_id', 'status', 'block_status']);
  return {
    ticketId: 要求字符串(raw.ticket_id),
    status: 要求枚举(raw.status, 工单状态全表),
    blockStatus: 要求枚举(raw.block_status, 屏蔽状态全表),
  };
}

/** 撤销其他设备的回执：只认 revoked_sessions 一个键。 */
function 解撤销会话数(input: unknown): number {
  const raw = 要求闭合对象(input, ['revoked_sessions']);
  return 要求安全非负整数(raw.revoked_sessions);
}

// ── 逐端点闭合错误联合：发布表之外（含通用 400/401/403 的未发布组合）即 invalid_response ──

type P8端点 =
  | '会话列表'
  | '凭证列表'
  | '撤销其他会话'
  | '换绑开始'
  | '换绑完成'
  | '创建数据导出'
  | '读取数据导出'
  | '账号注销'
  | '提交反馈'
  | '提交举报';

const P8错误表: Record<P8端点, readonly (readonly [number, string])[]> = {
  // GET 不发布 400/403
  会话列表: [[401, 'invalid_session'], [503, 'identity_service_unavailable']],
  凭证列表: [[401, 'invalid_session'], [503, 'identity_service_unavailable']],
  撤销其他会话: [
    [400, 'invalid_request_body'], [401, 'invalid_session'], [403, 'invalid_origin'],
    [409, 'idempotency_conflict'], [409, 'idempotency_in_progress'],
    [503, 'identity_service_unavailable'], [503, 'operation_outcome_unknown'],
  ],
  换绑开始: [
    [400, 'invalid_request_body'], [401, 'invalid_session'], [403, 'invalid_origin'],
    [409, 'idempotency_conflict'], [409, 'idempotency_in_progress'], [429, 'rate_limited'],
    [503, 'identity_service_unavailable'], [503, 'operation_outcome_unknown'],
  ],
  // complete 不发布 429
  换绑完成: [
    [400, 'invalid_request_body'], [401, 'invalid_session'], [403, 'invalid_origin'],
    [409, 'credential_replacement_conflict'], [409, 'idempotency_conflict'], [409, 'idempotency_in_progress'],
    [503, 'identity_service_unavailable'], [503, 'operation_outcome_unknown'],
  ],
  // 403 是三码联合（MutationForbidden）
  创建数据导出: [
    [400, 'invalid_request_body'], [401, 'invalid_session'],
    [403, 'invalid_origin'], [403, 'role_required'], [403, 'role_suspended'],
    [409, 'export_in_progress'], [409, 'idempotency_conflict'],
    [503, 'identity_service_unavailable'], [503, 'recruitment_service_unavailable'], [503, 'operation_outcome_unknown'],
  ],
  // GET 不发布 400/403；503 是双码联合
  读取数据导出: [
    [401, 'invalid_session'], [404, 'data_export_not_found'],
    [503, 'identity_service_unavailable'], [503, 'recruitment_service_unavailable'],
  ],
  // 403 只发布 invalid_origin（与创建导出的三码联合不同）
  账号注销: [
    [400, 'invalid_request_body'], [401, 'invalid_session'], [403, 'invalid_origin'],
    [409, 'export_in_progress'],
    [503, 'recruitment_service_unavailable'], [503, 'operation_outcome_unknown'],
  ],
  // 合规 429 不带 Retry-After：facade 只透传，倒计时/自动重试由操作层决定
  提交反馈: [
    [400, 'invalid_request_body'], [401, 'invalid_session'], [403, 'invalid_origin'],
    [409, 'idempotency_conflict'], [429, 'rate_limited'],
    [503, 'identity_service_unavailable'], [503, 'recruitment_service_unavailable'], [503, 'operation_outcome_unknown'],
  ],
  提交举报: [
    [400, 'invalid_request_body'], [401, 'invalid_session'], [403, 'invalid_origin'],
    [404, 'report_target_not_found'],
    [409, 'block_unavailable'], [409, 'idempotency_conflict'], [429, 'rate_limited'],
    [503, 'identity_service_unavailable'], [503, 'recruitment_service_unavailable'], [503, 'operation_outcome_unknown'],
  ],
};

function 校验P8错误(endpoint: P8端点, error: unknown): never {
  if (!(error instanceof BFF错误)) throw error;
  // 网络错误 / 请求前 invalid_request / 解码期 invalid_response 不在发布表语义内，原样透传
  if (error.status === 0 || error.code === 'invalid_response') throw error;
  if (!P8错误表[endpoint].some(([status, code]) => status === error.status && code === error.code)) {
    throw P8契约错误();
  }
  throw error;
}

// ── 调用方入参校验：非法输入在任何 fetch 前按 invalid_request 拒绝 ──

/** 换绑尝试 ID：发布为 minLength 1 的不透明串；路径片段编码一次。 */
function 校验尝试ID(attemptId: string): string {
  if (typeof attemptId !== 'string' || attemptId.length === 0) {
    throw new BFF错误(0, 'invalid_request', '换绑尝试 ID 不能为空');
  }
  return attemptId;
}

/** proof 只要求非空字符串；四位规则由调用方 import 短信验证码位数 执行。 */
function 校验P8证明(code: string): string {
  if (typeof code !== 'string' || code.length === 0) {
    throw new BFF错误(0, 'invalid_request', '验证码不能为空');
  }
  return code;
}

function 校验导出ID(exportId: string): string {
  if (typeof exportId !== 'string' || !导出ID模式.test(exportId)) {
    throw new BFF错误(0, 'invalid_request', '数据导出 ID 需为 exp_ 加 32 位小写十六进制');
  }
  return exportId;
}

/** 举报目标入参：exact key set（恰为 {type, ref}）、闭合分支与非空 ref，非法即零请求拒绝。 */
function 校验举报目标(target: P8ReportTarget): { type: P8ReportTarget['type']; ref: string } {
  const 非法目标 = () => new BFF错误(0, 'invalid_request', '举报对象不合法');
  if (!是记录(target)) throw 非法目标();
  const 键们 = Object.keys(target);
  if (键们.length !== 2 || !键们.includes('type') || !键们.includes('ref')) throw 非法目标();
  if (typeof target.ref !== 'string' || target.ref.length === 0) {
    throw new BFF错误(0, 'invalid_request', '举报对象 ref 不能为空');
  }
  for (const 候选 of 举报目标分支全表) {
    if (target.type === 候选) return { type: 候选, ref: target.ref };
  }
  throw 非法目标();
}

// ── 数据源 ──

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

export interface P8控制面数据源 {
  读取P8凭证(): Promise<P8Credential[]>;
  读取P8会话(): Promise<P8Session[]>;
  开始P8手机号换绑(phone: string, key: string): Promise<P8ReplacementAttempt>;
  完成P8手机号换绑(attemptId: string, code: string, key: string): Promise<P8ReplacementResult>;
  退出P8其他设备(key: string): Promise<number>;
  创建P8数据导出(key: string): Promise<P8DataExport>;
  读取P8数据导出(exportId: string): Promise<P8DataExport>;
  取P8数据导出下载地址(exportId: string): `/api/v1/me/data-exports/${string}/download`;
  请求P8账号注销(key: string): Promise<P8AccountDeletion>;
  提交P8反馈(category: P8FeedbackCategory, details: string, key: string): Promise<P8FeedbackReceipt>;
  提交P8举报(target: P8ReportTarget, reason: P8ReportReason, alsoBlock: boolean, key: string): Promise<P8ReportReceipt>;
}

export function 创建P8控制面数据源(请求: 请求函数): P8控制面数据源 {
  async function P8请求<T>(endpoint: P8端点, options: BFF请求选项, 解码: (input: unknown) => T): Promise<T> {
    try {
      const { result } = await 请求<unknown>(options);
      return 解码(result);
    } catch (error) {
      // 解码抛出的 invalid_response 也会经这里原样透传
      return 校验P8错误(endpoint, error);
    }
  }

  return {
    async 读取P8凭证() {
      return P8请求('凭证列表', { path: '/api/v1/me/credentials', 不缓存: true, 严格信封: true }, 解P8凭证列表);
    },
    async 读取P8会话() {
      return P8请求('会话列表', { path: '/api/v1/security/sessions', 不缓存: true, 严格信封: true }, 解P8会话);
    },
    async 开始P8手机号换绑(phone, key) {
      // 与 会话.开始手机登录 同款产品手机号规则：11 位裸号补 +86 构造 E.164
      return P8请求('换绑开始', {
        path: '/api/v1/me/credential-replacement-attempts',
        method: 'POST',
        body: { phone: `+86${phone}` },
        幂等: true,
        幂等键: key,
        严格信封: true,
      }, 解P8换绑尝试);
    },
    async 完成P8手机号换绑(attemptId, code, key) {
      const id = 校验尝试ID(attemptId);
      const proof = 校验P8证明(code);
      return P8请求('换绑完成', {
        path: `/api/v1/me/credential-replacement-attempts/${encodeURIComponent(id)}/complete`,
        method: 'POST',
        body: { proof: { code: proof } },
        幂等: true,
        幂等键: key,
        严格信封: true,
      }, 解P8换绑结果);
    },
    async 退出P8其他设备(key) {
      return P8请求('撤销其他会话', {
        path: '/api/v1/security/sessions/others',
        method: 'DELETE',
        幂等: true,
        幂等键: key,
        严格信封: true,
      }, 解撤销会话数);
    },
    async 创建P8数据导出(key) {
      // 该路由不携带请求体：Idempotency-Key + Origin 即整个请求
      return P8请求('创建数据导出', {
        path: '/api/v1/me/data-exports',
        method: 'POST',
        幂等: true,
        幂等键: key,
        严格信封: true,
      }, 解P8导出);
    },
    async 读取P8数据导出(exportId) {
      const id = 校验导出ID(exportId);
      return P8请求('读取数据导出', {
        path: `/api/v1/me/data-exports/${encodeURIComponent(id)}`,
        不缓存: true,
        严格信封: true,
      }, 解P8导出);
    },
    取P8数据导出下载地址(exportId) {
      // 同源相对 URL：下载走浏览器导航（同源 endpoint 流式落盘），不经过本 facade 的 JSON 请求
      const id = 校验导出ID(exportId);
      return `/api/v1/me/data-exports/${encodeURIComponent(id)}/download`;
    },
    async 请求P8账号注销(key) {
      // EmptyRequest：required 且无属性 → body 精确 {}
      return P8请求('账号注销', {
        path: '/api/v1/me/account-deletion',
        method: 'POST',
        body: {},
        幂等: true,
        幂等键: key,
        严格信封: true,
      }, 解P8注销);
    },
    async 提交P8反馈(category, details, key) {
      if (!反馈分类全表.includes(category)) {
        throw new BFF错误(0, 'invalid_request', '反馈分类不合法');
      }
      if (typeof details !== 'string') {
        throw new BFF错误(0, 'invalid_request', '反馈内容需要是字符串');
      }
      return P8请求('提交反馈', {
        path: '/api/v1/compliance/feedback',
        method: 'POST',
        body: { category, details },
        幂等: true,
        幂等键: key,
        严格信封: true,
      }, 解P8反馈回执);
    },
    async 提交P8举报(target, reason, alsoBlock, key) {
      const 举报目标 = 校验举报目标(target);
      if (!举报原因全表.includes(reason)) {
        throw new BFF错误(0, 'invalid_request', '举报原因不合法');
      }
      if (typeof alsoBlock !== 'boolean') {
        throw new BFF错误(0, 'invalid_request', '屏蔽选项需要是布尔值');
      }
      return P8请求('提交举报', {
        path: '/api/v1/compliance/reports',
        method: 'POST',
        body: { target: 举报目标, reason, also_block: alsoBlock },
        幂等: true,
        幂等键: key,
        严格信封: true,
      }, 解P8举报回执);
    },
  };
}
