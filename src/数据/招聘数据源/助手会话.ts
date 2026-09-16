// 助手会话域数据源：BFF /api/v1/me/assistant —— 求职端 AI 聊天的历史分页、发送、
// 轮询与重试。第十九个域 facade：协议代码（path / method / body / 调用方幂等键 /
// GET 不缓存）按冻结 mobile-v1 assistant 契约实现：历史 cursor 为非零十进制最多 19 位
// （不复用真人会话的 base64url 正则）；发送 body 严格 {text}，text trim 后按 TextEncoder
// 字节数本地预检 1–4096；retry 无正文；两个 POST 的幂等键都由调用方显式传入。
// 每个响应先 strict decode（exact key set、闭合 enum、asm_/ast_/dlg_|mc_ ID pattern、
// RFC3339、status↔reply、retryable↔failed、unavailable cards 空、三种已知 card 闭合解码），
// 不 `as` 直转；接口失败绝不回退 Mock。未知 card.kind 是唯一前向兼容边界：解 reply 时
// 整卡跳过，不展示、不跳转；已知 kind 的非法 data 按 invalid_response 拒绝。
// 嵌套 agent_summary 复用连续代谈域导出的 解NegotiationAgentSummary，不复制其实现。
// 本模块不 import React 或 Mock。

import { BFF错误 } from '../HTTP客户端';
import type { BFF客户端 } from '../HTTP客户端';
import { 解NegotiationAgentSummary } from './连续代谈';
import type { NegotiationAgentSummary } from './连续代谈';

const 助手前缀 = '/api/v1/me/assistant';
/** 历史 cursor 的闭合模式（OpenAPI AssistantHistoryCursor）：非零十进制，最多 19 位。 */
const 历史游标模式 = /^[1-9][0-9]{0,18}$/;
const 消息ID模式 = /^asm_[0-9a-f]{32}$/;
const 轮次ID模式 = /^ast_[0-9a-f]{32}$/;
const 记录ID模式 = /^(dlg_|mc_)[0-9a-f]{32}$/;
/** 新消息 trim 后按 UTF-8 字节计的上限；本地预检与后端同一口径，不能用 UTF-16 length。 */
const 文本字节上限 = 4096;
const 文本编码器 = new TextEncoder();

function 契约错误(message = '服务返回了不符合契约的助手会话数据'): BFF错误 {
  return new BFF错误(200, 'invalid_response', message);
}

// ── 本域小 guard：与 连续代谈.ts / 真人会话.ts 同一闭合纪律；本域统一 status=200 的 invalid_response ──

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === 'object' && 值 !== null && !Array.isArray(值);
}

/** exact key set：缺必需键或多出未知键都按契约漂移 fail closed（assistant schema 全部 additionalProperties:false）。 */
function 要求闭合对象(input: unknown, 必需键: readonly string[]): Record<string, unknown> {
  if (!是记录(input)) throw 契约错误();
  for (const 键 of 必需键) if (!(键 in input)) throw 契约错误();
  const 允许键 = new Set(必需键);
  for (const 键 of Object.keys(input)) if (!允许键.has(键)) throw 契约错误();
  return input;
}

function 要求字符串(值: unknown): string {
  if (typeof 值 !== 'string') throw 契约错误();
  return 值;
}

/** 不透明 ID 一律要求非空；声明了 pattern 的 ID 再过 要求模式串。 */
function 要求非空字符串(值: unknown): string {
  const 字符串 = 要求字符串(值);
  if (字符串.length === 0) throw 契约错误();
  return 字符串;
}

/** OpenAPI 声明了 pattern 的响应 ID：非空且形状匹配，二者缺一即契约漂移。 */
function 要求模式串(值: unknown, 模式: RegExp): string {
  const 字符串 = 要求非空字符串(值);
  if (!模式.test(字符串)) throw 契约错误();
  return 字符串;
}

function 要求可空字符串(值: unknown): string | null {
  if (值 === null) return null;
  return 要求字符串(值);
}

function 要求布尔(值: unknown): boolean {
  if (typeof 值 !== 'boolean') throw 契约错误();
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

/** OpenAPI integer：安全整数（有限、无小数）；本域字段无额外声明界。 */
function 要求整数(值: unknown): number {
  if (typeof 值 !== 'number' || !Number.isSafeInteger(值)) throw 契约错误();
  return 值;
}

function 要求可空整数(值: unknown): number | null {
  if (值 === null) return null;
  return 要求整数(值);
}

const RFC3339模式 = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

/** 时间戳按 OpenAPI 声明为 RFC 3339；形状或可解析性不对都拒绝。 */
function 要求RFC3339(值: unknown): string {
  const 字符串 = 要求字符串(值);
  if (!RFC3339模式.test(字符串) || Number.isNaN(Date.parse(字符串))) throw 契约错误();
  return 字符串;
}

// ── 闭合 vocabulary（与冻结 mobile-v1 OpenAPI 的 Assistant* schemas 一一对应）──

const 消息状态全表 = ['processing', 'succeeded', 'failed', 'uncertain'] as const;
const 可见性全表 = ['available', 'unavailable'] as const;
const 薪资周期全表 = ['month', 'day', 'hour'] as const;
const 记录类别全表 = ['delegation', 'case'] as const;
const 在谈阶段全表 = ['accepted', 'evaluating', 'evaluation_failed', 'refused', 'case_started'] as const;
const 岗位可用性全表 = ['available', 'unavailable'] as const;

// ── 公开 DTO：字段名逐字保留 YAML 原名（snake_case）；形状来自冻结 Assistant* schemas ──

export interface AssistantJobItem {
  job_id: string;
  title: string;
  organization_name: string | null;
  office_location: string;
  salary_lower: number;
  salary_upper: number;
  salary_period: 'month' | 'day' | 'hour';
  annual_salary_months: number | null;
  safe_reasons: string[];
}

/** 在谈项里的公开岗位快照：五键全 required，与连续代谈域的 NegotiationJob 不同形。 */
export interface AssistantNegotiationJob {
  job_id: string;
  title: string | null;
  location: string | null;
  public_salary_range: string | null;
  availability: 'available' | 'unavailable';
}

export interface AssistantNegotiationItem {
  record_id: string;
  record_kind: 'delegation' | 'case';
  intention_id: string;
  job: AssistantNegotiationJob;
  case_id: string | null;
  phase: 'accepted' | 'evaluating' | 'evaluation_failed' | 'refused' | 'case_started';
  needs_action: boolean;
}

/** 在谈列表项再加既有 A2 agent summary；decoder 复用连续代谈域，不复制证据/总结实现。 */
export interface AssistantNegotiationDetail extends AssistantNegotiationItem {
  agent_summary: NegotiationAgentSummary;
}

export interface AssistantJobRecommendations {
  intention_id: string | null;
  items: AssistantJobItem[];
  next_cursor: string | null;
}

export interface AssistantNegotiationList {
  items: AssistantNegotiationItem[];
  next_cursor: string | null;
}

export type AssistantCard =
  | { kind: 'job_recommendations'; queried_at: string; data: AssistantJobRecommendations }
  | { kind: 'negotiation_list'; queried_at: string; data: AssistantNegotiationList }
  | { kind: 'negotiation_detail'; queried_at: string; data: AssistantNegotiationDetail };

export interface AssistantReply {
  text: string;
  visibility: 'available' | 'unavailable';
  cards: AssistantCard[];
}

export interface AssistantMessage {
  message_id: string;
  turn_id: string;
  text: string;
  created_at: string;
  status: 'processing' | 'succeeded' | 'failed' | 'uncertain';
  retryable: boolean;
  error_code: string | null;
  reply: AssistantReply | null;
}

export interface AssistantMessagePage {
  items: AssistantMessage[];
  next_cursor: string | null;
}

// ── 具体 decoder：逐字段过 guard，不做 `as` 直转 ──

function 解岗位项(input: unknown): AssistantJobItem {
  const raw = 要求闭合对象(input, [
    'job_id', 'title', 'organization_name', 'office_location', 'salary_lower',
    'salary_upper', 'salary_period', 'annual_salary_months', 'safe_reasons',
  ]);
  return {
    job_id: 要求非空字符串(raw.job_id),
    title: 要求字符串(raw.title),
    organization_name: 要求可空字符串(raw.organization_name),
    office_location: 要求字符串(raw.office_location),
    salary_lower: 要求整数(raw.salary_lower),
    salary_upper: 要求整数(raw.salary_upper),
    salary_period: 要求枚举(raw.salary_period, 薪资周期全表),
    annual_salary_months: 要求可空整数(raw.annual_salary_months),
    safe_reasons: 要求数组(raw.safe_reasons).map(要求字符串),
  };
}

function 解岗位推荐数据(input: unknown): AssistantJobRecommendations {
  const raw = 要求闭合对象(input, ['intention_id', 'items', 'next_cursor']);
  return {
    intention_id: 要求可空字符串(raw.intention_id),
    items: 要求数组(raw.items).map(解岗位项),
    next_cursor: 要求可空字符串(raw.next_cursor),
  };
}

function 解在谈职位(input: unknown): AssistantNegotiationJob {
  const raw = 要求闭合对象(input, ['job_id', 'title', 'location', 'public_salary_range', 'availability']);
  return {
    job_id: 要求非空字符串(raw.job_id),
    title: 要求可空字符串(raw.title),
    location: 要求可空字符串(raw.location),
    public_salary_range: 要求可空字符串(raw.public_salary_range),
    availability: 要求枚举(raw.availability, 岗位可用性全表),
  };
}

/** 在谈列表行与详情共用的七键主体。 */
function 解在谈项字段(raw: Record<string, unknown>): AssistantNegotiationItem {
  return {
    record_id: 要求模式串(raw.record_id, 记录ID模式),
    record_kind: 要求枚举(raw.record_kind, 记录类别全表),
    intention_id: 要求非空字符串(raw.intention_id),
    job: 解在谈职位(raw.job),
    case_id: 要求可空字符串(raw.case_id),
    phase: 要求枚举(raw.phase, 在谈阶段全表),
    needs_action: 要求布尔(raw.needs_action),
  };
}

function 解在谈列表数据(input: unknown): AssistantNegotiationList {
  const raw = 要求闭合对象(input, ['items', 'next_cursor']);
  return {
    items: 要求数组(raw.items).map((行) => 解在谈项字段(要求闭合对象(行, [
      'record_id', 'record_kind', 'intention_id', 'job', 'case_id', 'phase', 'needs_action',
    ]))),
    next_cursor: 要求可空字符串(raw.next_cursor),
  };
}

function 解在谈详情数据(input: unknown): AssistantNegotiationDetail {
  const raw = 要求闭合对象(input, [
    'record_id', 'record_kind', 'intention_id', 'job', 'case_id', 'phase', 'needs_action', 'agent_summary',
  ]);
  return {
    ...解在谈项字段(raw),
    agent_summary: 解NegotiationAgentSummary(raw.agent_summary),
  };
}

/**
 * 单张查询快照卡：kind 决定 data 的闭合解码。已知 kind 的非法 data 抛契约错误；
 * 未知 kind（含未来新增类型）整卡返回 null，由 解助手回复 跳过 —— 不把未知 data
 * 强转成任一 DTO，也不展示、不跳转。
 */
function 解已知卡片(input: unknown): AssistantCard | null {
  if (!是记录(input)) throw 契约错误();
  const kind = 要求字符串(input.kind);
  if (kind === 'job_recommendations') {
    const raw = 要求闭合对象(input, ['kind', 'queried_at', 'data']);
    return { kind, queried_at: 要求RFC3339(raw.queried_at), data: 解岗位推荐数据(raw.data) };
  }
  if (kind === 'negotiation_list') {
    const raw = 要求闭合对象(input, ['kind', 'queried_at', 'data']);
    return { kind, queried_at: 要求RFC3339(raw.queried_at), data: 解在谈列表数据(raw.data) };
  }
  if (kind === 'negotiation_detail') {
    const raw = 要求闭合对象(input, ['kind', 'queried_at', 'data']);
    return { kind, queried_at: 要求RFC3339(raw.queried_at), data: 解在谈详情数据(raw.data) };
  }
  return null;
}

function 解助手回复(input: unknown): AssistantReply {
  const raw = 要求闭合对象(input, ['text', 'visibility', 'cards']);
  const visibility = 要求枚举(raw.visibility, 可见性全表);
  const cards = 要求数组(raw.cards)
    .map(解已知卡片)
    .filter((卡片): 卡片 is AssistantCard => 卡片 !== null);
  // unavailable 表示回复引用的信息已不可查看：text 是固定提示，cards 必为空。
  if (visibility === 'unavailable' && cards.length !== 0) throw 契约错误();
  return { text: 要求非空字符串(raw.text), visibility, cards };
}

/**
 * 单条消息：required/nullable 闭合 + schema 冻结的联合不变式 ——
 * reply 只在 succeeded 出现；retryable=true 只允许 failed。
 */
function 解助手消息(input: unknown): AssistantMessage {
  const raw = 要求闭合对象(input, [
    'message_id', 'turn_id', 'text', 'created_at', 'status', 'retryable', 'error_code', 'reply',
  ]);
  const status = 要求枚举(raw.status, 消息状态全表);
  const retryable = 要求布尔(raw.retryable);
  if (status === 'succeeded' && raw.reply === null) throw 契约错误();
  if (status !== 'succeeded' && raw.reply !== null) throw 契约错误();
  if (retryable && status !== 'failed') throw 契约错误();
  return {
    message_id: 要求模式串(raw.message_id, 消息ID模式),
    turn_id: 要求模式串(raw.turn_id, 轮次ID模式),
    text: 要求非空字符串(raw.text),
    created_at: 要求RFC3339(raw.created_at),
    status,
    retryable,
    error_code: 要求可空字符串(raw.error_code),
    reply: raw.reply === null ? null : 解助手回复(raw.reply),
  };
}

/** 历史 next_cursor 恰为 string|null，非空时须为可原样回传的非零十进制查询参数。 */
function 解历史游标(值: unknown): string | null {
  if (值 === null) return null;
  const 字符串 = 要求字符串(值);
  if (!历史游标模式.test(字符串)) throw 契约错误();
  return 字符串;
}

function 解助手历史页(input: unknown): AssistantMessagePage {
  const raw = 要求闭合对象(input, ['items', 'next_cursor']);
  return {
    items: 要求数组(raw.items).map(解助手消息),
    next_cursor: 解历史游标(raw.next_cursor),
  };
}

// ── 调用方输入预检：在任何 fetch 之前拒绝，非法即抛、零请求 ──

/** 调用方 cursor 必须匹配历史 cursor 的发布模式，原样回传后端。 */
function 校验调用方游标(cursor: string): string {
  if (!历史游标模式.test(cursor)) {
    throw new BFF错误(0, 'invalid_request', 'cursor 需为非零十进制且最多 19 位');
  }
  return cursor;
}

function 校验轮次ID(turnId: string): string {
  if (!轮次ID模式.test(turnId)) {
    throw new BFF错误(0, 'invalid_request', 'turn_id 需为 ast_ 前缀加 32 位小写十六进制');
  }
  return turnId;
}

/** 新消息本地预检：trim 后 1–4096 UTF-8 字节；发出 trim 后的正文（与后端同一口径）。 */
function 校验发送文本(text: string): string {
  const 正文 = text.trim();
  const 字节数 = 文本编码器.encode(正文).length;
  if (字节数 < 1 || 字节数 > 文本字节上限) {
    throw new BFF错误(0, 'invalid_request', '消息内容需为 1 到 4096 个字节');
  }
  return 正文;
}

function 助手路径(suffix: string): `/api/v1/${string}` {
  return `${助手前缀}${suffix}` as `/api/v1/${string}`;
}

export interface 助手会话数据源 {
  读取助手历史(cursor?: string): Promise<AssistantMessagePage>;
  发送助手消息(text: string, idempotencyKey: string): Promise<AssistantMessage>;
  读取助手轮次(turnId: string): Promise<AssistantMessage>;
  重试助手轮次(turnId: string, idempotencyKey: string): Promise<AssistantMessage>;
}

export function 创建助手会话数据源(请求: BFF客户端['请求']): 助手会话数据源 {
  async function 读取助手历史(cursor?: string): Promise<AssistantMessagePage> {
    const 游标 = cursor === undefined ? null : 校验调用方游标(cursor);
    const { result } = await 请求<unknown>({
      path: 助手路径(`/messages${游标 === null ? '' : `?cursor=${encodeURIComponent(游标)}`}`),
      不缓存: true,
    });
    return 解助手历史页(result);
  }

  async function 发送助手消息(text: string, idempotencyKey: string): Promise<AssistantMessage> {
    const { result } = await 请求<unknown>({
      path: 助手路径('/messages'),
      method: 'POST',
      body: { text: 校验发送文本(text) },
      幂等: true,
      幂等键: idempotencyKey,
    });
    return 解助手消息(result);
  }

  async function 读取助手轮次(turnId: string): Promise<AssistantMessage> {
    const { result } = await 请求<unknown>({
      path: 助手路径(`/turns/${encodeURIComponent(校验轮次ID(turnId))}`),
      不缓存: true,
    });
    return 解助手消息(result);
  }

  async function 重试助手轮次(turnId: string, idempotencyKey: string): Promise<AssistantMessage> {
    // retry 按契约无正文：只有路径轮次 ID 与调用方新幂等键。
    const { result } = await 请求<unknown>({
      path: 助手路径(`/turns/${encodeURIComponent(校验轮次ID(turnId))}/retry`),
      method: 'POST',
      幂等: true,
      幂等键: idempotencyKey,
    });
    return 解助手消息(result);
  }

  return {
    读取助手历史,
    发送助手消息,
    读取助手轮次,
    重试助手轮次,
  };
}
