// 接触记录域数据源：BFF /api/v1/me/contact-events —— 候选「谁接触过我」的成功快照。
// 第十六个域 facade：协议代码（path / GET 不缓存 / limit 首屏与续页都是 50）按已冻结的
// contact-events 契约实现。每个响应先 strict decode（页 / item / organization 三层
// exact key set、闭合 action、event/organization ID pattern、1–200 组织展示名、严格
// RFC3339、同页 event_id 不重复、next_cursor null 或 ≤512 base64url），不 `as` 直转；
// 接口失败绝不回退 Mock。本模块不 import React 或 Mock，也不携带招聘方人名等任何
// 合同外字段。

import { BFF错误 } from '../HTTP客户端';
import type { BFF客户端 } from '../HTTP客户端';

const 游标模式 = /^[A-Za-z0-9_-]+$/;
const RFC3339模式 = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;
const 事件ID模式 = /^cev_[0-9a-f]{32}$/;
const 组织ID模式 = /^org_[0-9a-f]{32}$/;
/** contact-events 契约的 cursor 上限（与 MatchCase 域的 4096 不同，本域冻结为 512）。 */
const 游标上限 = 512;
/** contact-events 页大小：默认与最大都是 50，首屏显式请求 limit=50。 */
const 页上限 = 50;

function 契约错误(): BFF错误 {
  return new BFF错误(200, 'invalid_response', '服务返回了不符合契约的接触记录数据');
}

// ── 本域小 guard：与 MatchCase.ts / 发现推荐.ts 同一闭合纪律，本域统一 status=200 的 invalid_response ──

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === 'object' && 值 !== null && !Array.isArray(值);
}

/** exact key set：缺必需键或多出未知键都按契约漂移 fail closed。 */
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

/** OpenAPI 声明了 pattern 的响应 ID：非空且形状匹配，二者缺一即契约漂移。 */
function 要求模式串(值: unknown, 模式: RegExp): string {
  const 字符串 = 要求字符串(值);
  if (字符串.length === 0 || !模式.test(字符串)) throw 契约错误();
  return 字符串;
}

/** 组织展示名：非空且长度 1–200（OpenAPI minLength 1 / maxLength 200）。 */
function 要求限长非空字符串(值: unknown, 最大: number): string {
  const 字符串 = 要求字符串(值);
  if (字符串.length === 0 || 字符串.length > 最大) throw 契约错误();
  return 字符串;
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

/**
 * occurred_at 按 OpenAPI 声明为 RFC 3339；形状、可解析性与真实日历三者都过才放行。
 * Date.parse 会把 2026-02-30 / 24:00 / :60 这类分量归一化成另一天 —— 把分量按原
 * 时区偏移还原回去逐一比对，任何被归一化的非法日历都按契约漂移拒绝（Go 后端同口径）。
 */
function 要求RFC3339(值: unknown): string {
  const 字符串 = 要求字符串(值);
  const 组 = RFC3339模式.exec(字符串);
  if (组 === null || Number.isNaN(Date.parse(字符串))) throw 契约错误();
  const [, 年, 月, 日, 时, 分, 秒, , 区] = 组;
  const 偏移分钟 = 区 === 'Z' || 区 === 'z'
    ? 0
    : (区[0] === '-' ? -1 : 1) * (Number(区.slice(1, 3)) * 60 + Number(区.slice(4, 6)));
  const 还原 = new Date(Date.parse(字符串) + 偏移分钟 * 60000);
  if (还原.getUTCFullYear() !== Number(年) || 还原.getUTCMonth() !== Number(月) - 1 ||
    还原.getUTCDate() !== Number(日) || 还原.getUTCHours() !== Number(时) ||
    还原.getUTCMinutes() !== Number(分) || 还原.getUTCSeconds() !== Number(秒)) {
    throw 契约错误();
  }
  return 字符串;
}

// ── 闭合 vocabulary（与 mobile-v1 OpenAPI 一一对应）──

const 动作全表 = [
  'anonymous_profile_viewed', 'contact_started', 'submitted_resume_viewed',
] as const;

// ── 归一化 DTO：只保留页面消费的五个事实，合同外字段（人名/职务/时长/详情 ID）进不了 UI ──

export type 接触事件动作 =
  | 'anonymous_profile_viewed'
  | 'contact_started'
  | 'submitted_resume_viewed';

export interface 接触事件 {
  eventId: string;
  organization: { organizationId: string; displayName: string };
  action: 接触事件动作;
  occurredAt: string;
}

export interface 接触事件页 {
  items: 接触事件[];
  nextCursor: string | null;
}

export interface 接触记录数据源 {
  读取接触事件(cursor?: string): Promise<接触事件页>;
}

/** 响应 cursor 恰为 string | null：缺键、坏类型、空、超 512 或坏形状都是契约漂移。 */
function 解下一游标(值: unknown): string | null {
  if (值 === null) return null;
  if (typeof 值 !== 'string' || 值.length === 0 || 值.length > 游标上限 || !游标模式.test(值)) {
    throw 契约错误();
  }
  return 值;
}

/**
 * 解接触事件页：页 / item / organization 逐层闭合，完整页面解码成功后才返回规范化数据；
 * 同页 event ID 重复按契约漂移拒绝（后端按 newest-first 唯一事件，重复即漂移）。
 */
export function 解接触事件页(input: unknown): 接触事件页 {
  const raw = 要求闭合对象(input, ['items', 'next_cursor']);
  const ids = new Set<string>();
  const items = 要求数组(raw.items).map((item) => {
    const row = 要求闭合对象(item, ['event_id', 'organization', 'action', 'occurred_at']);
    const organization = 要求闭合对象(row.organization, ['organization_id', 'display_name']);
    const eventId = 要求模式串(row.event_id, 事件ID模式);
    if (ids.has(eventId)) throw 契约错误();
    ids.add(eventId);
    return {
      eventId,
      organization: {
        organizationId: 要求模式串(organization.organization_id, 组织ID模式),
        displayName: 要求限长非空字符串(organization.display_name, 200),
      },
      action: 要求枚举(row.action, 动作全表),
      occurredAt: 要求RFC3339(row.occurred_at),
    };
  });
  return { items, nextCursor: 解下一游标(raw.next_cursor) };
}

/** 调用方 cursor 在任何 fetch 前校验：非空 base64url 字符串且 ≤512，非法即抛、零请求。 */
function 校验调用方游标(cursor: string): string {
  if (typeof cursor !== 'string' || cursor.length === 0 || cursor.length > 游标上限 || !游标模式.test(cursor)) {
    throw new BFF错误(0, 'invalid_request', 'cursor 需为非空 base64url 且不超过 512 字节');
  }
  return cursor;
}

export function 创建接触记录数据源(请求: BFF客户端['请求']): 接触记录数据源 {
  return {
    async 读取接触事件(cursor?: string): Promise<接触事件页> {
      const query = cursor === undefined
        ? `?limit=${页上限}`
        : `?limit=${页上限}&cursor=${encodeURIComponent(校验调用方游标(cursor))}`;
      const { result } = await 请求<unknown>({
        path: `/api/v1/me/contact-events${query}`,
        不缓存: true,
      });
      return 解接触事件页(result);
    },
  };
}