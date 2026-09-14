// Onboarding 域数据源：BFF /api/v1/me/onboarding 的读取与角色完成。
// 第十八个域 facade：stg 契约对齐 2026-09-14 Spec §4 冻结的两端点 —— GET 读取实际持有的
// 角色（candidate→recruiter、最多两项、无重复、completed_at 为 null 或合法 RFC3339），
// POST /{role}/complete 以严格 JSON {} 收尾且不带 If-Match/新增幂等键；GET 显式 no-store。
// 每个响应先 strict decode（exact key set、闭合 role/status 枚举、completed_at 形状），
// POST 额外保证 status=active、completed_at 非空且 role 与请求一致；非法运行时 role 在
// 发送前按 invalid_request 拒绝（客户端错误语义）。不在数据源里做路由判断或重新实现
// 资料完备判定；接口失败绝不回退 Mock。本模块不 import React 或模拟数据。

import { BFF错误 } from '../HTTP客户端';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type { BFFOnboarding角色状态, BFFOnboarding状态, BFF角色 } from '../BFF契约';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

function 契约错误(): BFF错误 {
  return new BFF错误(200, 'invalid_response', 'Onboarding 响应不符合冻结契约');
}

// ── 本域小 guard：闭合纪律与 简历预填/连续代谈 同一基调；统一 status=200 的 invalid_response ──

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === 'object' && 值 !== null && !Array.isArray(值);
}

/** exact key set：缺必需键或多出未知键都按契约漂移 fail closed。 */
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

function 要求数组(值: unknown): unknown[] {
  if (!Array.isArray(值)) throw 契约错误();
  return 值;
}

function 要求枚举<T extends string>(值: unknown, 取值: readonly T[]): T {
  if (typeof 值 !== 'string') throw 契约错误();
  for (const 候选 of 取值) if (候选 === 值) return 候选;
  throw 契约错误();
}

const RFC3339模式 = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

/**
 * Spec §4：completed_at 必在，为 null 或合法 RFC3339 —— 合法指真实存在的日历时间。
 * Date.parse 会把 2026-02-30 / 24:00 这类越界分量归一化成另一天（review-r1 F3），
 * 与 接触记录.ts 的 要求RFC3339 同口径：把分量按原时区偏移还原回去逐一比对，
 * 任何被归一化的不存在时间都按契约漂移拒绝；小数秒不参与分量比较。
 */
function 要求可空RFC3339(值: unknown): string | null {
  if (值 === null) return null;
  if (typeof 值 !== 'string') throw 契约错误();
  const 组 = RFC3339模式.exec(值);
  if (组 === null || Number.isNaN(Date.parse(值))) throw 契约错误();
  const [, 年, 月, 日, 时, 分, 秒, , 区] = 组;
  const 偏移分钟 = 区 === 'Z' || 区 === 'z'
    ? 0
    : (区[0] === '-' ? -1 : 1) * (Number(区.slice(1, 3)) * 60 + Number(区.slice(4, 6)));
  const 还原 = new Date(Date.parse(值) + 偏移分钟 * 60000);
  if (还原.getUTCFullYear() !== Number(年) || 还原.getUTCMonth() !== Number(月) - 1 ||
    还原.getUTCDate() !== Number(日) || 还原.getUTCHours() !== Number(时) ||
    还原.getUTCMinutes() !== Number(分) || 还原.getUTCSeconds() !== Number(秒)) {
    throw 契约错误();
  }
  return 值;
}

// ── 闭合 vocabulary（Spec §4 冻结）──

const 角色全表 = ['candidate', 'recruiter'] as const satisfies readonly BFF角色[];
const 状态全表 = ['active', 'suspended'] as const;

// ── 具体 decoder：逐字段过 guard，不做 `as` 直转 ──

function 解角色状态(input: unknown): BFFOnboarding角色状态 {
  const raw = 要求闭合对象(input, ['role', 'status', 'completed_at']);
  return {
    role: 要求枚举(raw.role, 角色全表),
    status: 要求枚举(raw.status, 状态全表),
    completed_at: 要求可空RFC3339(raw.completed_at),
  };
}

/** GET result：只列实际角色；candidate→recruiter 固定顺序、最多两项、无重复。 */
function 解Onboarding状态(input: unknown): BFFOnboarding状态 {
  const raw = 要求闭合对象(input, ['roles']);
  const roles = 要求数组(raw.roles).map(解角色状态);
  if (roles.length > 2) throw 契约错误();
  if (roles.length === 2 && !(roles[0].role === 'candidate' && roles[1].role === 'recruiter')) {
    throw 契约错误();
  }
  return { roles };
}

/** POST result：单个角色对象，额外保证 active、completed_at 非空且 role 与请求一致。 */
function 解完成角色状态(input: unknown, role: BFF角色): BFFOnboarding角色状态 {
  const 状态 = 解角色状态(input);
  if (状态.status !== 'active' || 状态.completed_at === null || 状态.role !== role) {
    throw 契约错误();
  }
  return 状态;
}

// ── 调用方入参校验：非法运行时 role 在任何请求前按客户端错误拒绝 ──

function 校验角色(role: BFF角色): BFF角色 {
  if (typeof role !== 'string' || !(角色全表 as readonly string[]).includes(role)) {
    throw new BFF错误(0, 'invalid_request', 'Onboarding 角色仅支持 candidate 或 recruiter');
  }
  return role;
}

export interface Onboarding数据源 {
  读取Onboarding(): Promise<BFFOnboarding状态>;
  完成Onboarding(role: BFF角色): Promise<BFFOnboarding角色状态>;
}

export function 创建Onboarding数据源(请求: 请求函数): Onboarding数据源 {
  return {
    async 读取Onboarding() {
      const { result } = await 请求<unknown>({ path: '/api/v1/me/onboarding', 不缓存: true });
      return 解Onboarding状态(result);
    },
    async 完成Onboarding(role) {
      const 目标 = 校验角色(role);
      const { result } = await 请求<unknown>({
        path: `/api/v1/me/onboarding/${目标}/complete`,
        method: 'POST',
        body: {},
      });
      return 解完成角色状态(result, 目标);
    },
  };
}
