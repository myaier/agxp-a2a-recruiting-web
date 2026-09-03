// Agent 规则域数据源：BFF /api/v1 的 agent-rules / agent-rule-proposals（P6）。
// 第八个域 facade：协议代码（path / method / body / If-Match / 幂等 / 空对象 body / 分页循环）
// 按 P6 冻结契约实现。每个响应先 strict decode（exact key set、闭合 enum、ID 正则、
// 日期可解析），不 `as` 直转；接口失败绝不回退 Mock。本模块不 import React 或 Mock。

import { BFF错误 } from '../HTTP客户端';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type {
  BFF角色,
  BFFAgent规则,
  BFFAgent规则作用域,
  BFFAgent规则状态,
  BFFAgent规则提案,
  BFFAgent规则提案失败码,
  BFFAgent规则提案状态,
  BFFAgent规则后果,
} from '../BFF契约';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

const 角色前缀: Record<BFF角色, '/api/v1/me' | '/api/v1/recruiter'> = {
  candidate: '/api/v1/me',
  recruiter: '/api/v1/recruiter',
};

function 版本ETag(version: number): string {
  return `"${version}"`;
}

/** 单条规则的强 ETag 必须点名它自己的版本，否则是契约漂移（防止拿旧缓存写错版本）。 */
function 确认版本ETag(rule: BFFAgent规则, etag: string | null): BFFAgent规则 {
  if (etag !== 版本ETag(rule.version)) {
    throw new BFF错误(0, 'invalid_response', '规则版本与 ETag 不一致');
  }
  return rule;
}

// ── 本域小 guard：与 组织.ts 同一闭合纪律；本域统一 status=0 的 invalid_response ──

function 契约错误(): BFF错误 {
  return new BFF错误(0, 'invalid_response', '服务返回了不符合契约的 Agent 规则数据');
}

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === 'object' && 值 !== null && !Array.isArray(值);
}

/** exact key set：缺必需键或多出未知键都按契约漂移 fail closed。 */
function 要求闭合对象(
  input: unknown,
  必需键: readonly string[],
): Record<string, unknown> {
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

function 要求非空字符串(值: unknown): string {
  const 字符串 = 要求字符串(值);
  if (字符串.length === 0) throw 契约错误();
  return 字符串;
}

/** 日期必须可解析；解码后保留服务端的原始字符串。 */
function 要求日期(值: unknown): string {
  const 字符串 = 要求字符串(值);
  if (Number.isNaN(Date.parse(字符串))) throw 契约错误();
  return 字符串;
}

/** 版本是安全正整数（OpenAPI minimum: 1）。 */
function 要求版本(值: unknown): number {
  if (typeof 值 !== 'number' || !Number.isSafeInteger(值) || 值 < 1) throw 契约错误();
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

function 要求ID(值: unknown, 模式: RegExp): string {
  const 字符串 = 要求字符串(值);
  if (!模式.test(字符串)) throw 契约错误();
  return 字符串;
}

// ── 闭合 vocabulary 与 ID 正则（与 mobile-v1 OpenAPI 一一对应）──

const 规则ID模式 = /^rul_[0-9a-f]{32}$/;
const 提案ID模式 = /^arp_[0-9a-f]{32}$/;
const 意向ID模式 = /^int_[0-9a-f]{32}$/;

const 子句类型全表 = [
  'information_disclosure', 'workplace_mode', 'work_schedule', 'compensation_band',
  'role_domain', 'candidate_affiliation', 'qualification', 'contact_cadence',
] as const satisfies readonly BFFAgent规则['clause_kinds'][number][];
const 规则状态全表 = ['active', 'paused', 'archived'] as const satisfies readonly BFFAgent规则状态[];
const 提案状态全表 = [
  'interpreting', 'ready', 'accepted', 'dismissed', 'failed',
] as const satisfies readonly BFFAgent规则提案状态[];
const 后果全表 = ['auto_allow', 'auto_deny', 'advisory', 'mixed'] as const satisfies readonly BFFAgent规则后果[];
const 提案失败码全表 = ['agent_unavailable', 'interpretation_failed'] as const satisfies readonly BFFAgent规则提案失败码[];

// ── 具体 decoder：逐字段过 guard，不做 `as` 直转 ──

function 解作用域(input: unknown): BFFAgent规则作用域 {
  // 两个 scope 臂各自闭合：global 只有 {type}，intention 恰好 {type,intention_id}。
  if (!是记录(input)) throw 契约错误();
  for (const 键 of Object.keys(input)) {
    if (键 !== 'type' && 键 !== 'intention_id') throw 契约错误();
  }
  if (!('type' in input)) throw 契约错误();
  if (input.type === 'global') {
    if ('intention_id' in input) throw 契约错误();
    return { type: 'global' };
  }
  if (input.type === 'intention') {
    return { type: 'intention', intention_id: 要求ID(input.intention_id, 意向ID模式) };
  }
  throw 契约错误();
}

const 规则键 = [
  'rule_id', 'version', 'state', 'scope', 'clause_kinds', 'display_text', 'created_at', 'updated_at',
] as const;

function 解Agent规则(input: unknown): BFFAgent规则 {
  const raw = 要求闭合对象(input, 规则键);
  return {
    rule_id: 要求ID(raw.rule_id, 规则ID模式),
    version: 要求版本(raw.version),
    state: 要求枚举(raw.state, 规则状态全表),
    scope: 解作用域(raw.scope),
    clause_kinds: 要求数组(raw.clause_kinds).map((项) => 要求枚举(项, 子句类型全表)),
    display_text: 要求非空字符串(raw.display_text),
    created_at: 要求日期(raw.created_at),
    updated_at: 要求日期(raw.updated_at),
  };
}

const 提案公开键 = new Set([
  'proposal_id', 'state', 'normalized_text', 'consequence', 'created_at', 'failure_code',
]);

/**
 * 提案三种形状分开校验：
 * - interpreting：只有 proposal_id+state（fresh create）或再加合法 created_at（list/get 视图），
 *   永不携带 normalized_text/consequence/failure_code；
 * - ready：五个已定事实键必须带齐（normalized_text/consequence/created_at），
 *   携带 failure_code 即契约错误；
 * - accepted/dismissed/failed：只允许这六个公开键，出现过的可选项逐个过同样的
 *   类型/enum/日期校验；failure_code 只在 state='failed' 合法（legacy failed 缺席合法）。
 */
function 解Agent规则提案(input: unknown): BFFAgent规则提案 {
  if (!是记录(input)) throw 契约错误();
  for (const 键 of Object.keys(input)) if (!提案公开键.has(键)) throw 契约错误();
  if (!('proposal_id' in input && 'state' in input)) throw 契约错误();
  const proposal_id = 要求ID(input.proposal_id, 提案ID模式);
  const state = 要求枚举(input.state, 提案状态全表);

  if (state === 'interpreting') {
    if ('normalized_text' in input || 'consequence' in input || 'failure_code' in input) throw 契约错误();
    if ('created_at' in input) {
      return { proposal_id, state, created_at: 要求日期(input.created_at) };
    }
    return { proposal_id, state };
  }
  if (state === 'ready') {
    if ('failure_code' in input) throw 契约错误();
    if (!('normalized_text' in input && 'consequence' in input && 'created_at' in input)) throw 契约错误();
    return {
      proposal_id,
      state,
      normalized_text: 要求字符串(input.normalized_text),
      consequence: 要求枚举(input.consequence, 后果全表),
      created_at: 要求日期(input.created_at),
    };
  }
  const 回执: BFFAgent规则提案 = { proposal_id, state };
  if ('normalized_text' in input) 回执.normalized_text = 要求字符串(input.normalized_text);
  if ('consequence' in input) 回执.consequence = 要求枚举(input.consequence, 后果全表);
  if ('created_at' in input) 回执.created_at = 要求日期(input.created_at);
  if ('failure_code' in input) {
    if (state !== 'failed') throw 契约错误();
    回执.failure_code = 要求枚举(input.failure_code, 提案失败码全表);
  }
  return 回执;
}

// ── 分页：读取全部页；每页 wrapper 只有 items 键和可选 next_cursor ──

/** 第一页用原始路径（可带查询）；之后每页追加 cursor 参数。 */
function 分页路径(基础路径: string): (cursor: string | null) => `/api/v1/${string}` {
  return (cursor) => {
    if (cursor === null) return 基础路径 as `/api/v1/${string}`;
    const 分隔符 = 基础路径.includes('?') ? '&' : '?';
    return `${基础路径}${分隔符}cursor=${encodeURIComponent(cursor)}` as `/api/v1/${string}`;
  };
}

/** 创建文本先去首尾空白，再按 Unicode 码点数校验 1–2000（与 BFF maxLength 一致）。 */
function 校验创建文本(text: string): string {
  const 内容 = text.trim();
  if (内容.length === 0 || Array.from(内容).length > 2000) {
    throw new BFF错误(0, 'validation_failed', '规则内容需要 1 到 2000 个字符');
  }
  return 内容;
}

export interface Agent规则数据源 {
  读取Agent规则(role: BFF角色, filter?: BFFAgent规则作用域): Promise<BFFAgent规则[]>;
  读取单条Agent规则(role: BFF角色, ruleId: string): Promise<BFFAgent规则>;
  修改Agent规则(role: BFF角色, ruleId: string, version: number, operation: 'pause' | 'resume'): Promise<BFFAgent规则>;
  删除Agent规则(role: BFF角色, ruleId: string, version: number): Promise<void>;
  创建Agent规则提案(role: BFF角色, text: string, scope?: BFFAgent规则作用域): Promise<BFFAgent规则提案>;
  读取Agent规则提案(role: BFF角色, proposalId: string): Promise<BFFAgent规则提案>;
  读取Agent规则提案列表(role: BFF角色, state: 'interpreting' | 'ready'): Promise<BFFAgent规则提案[]>;
  接受Agent规则提案(role: BFF角色, proposalId: string): Promise<BFFAgent规则>;
  放弃Agent规则提案(role: BFF角色, proposalId: string): Promise<BFFAgent规则提案>;
  创建Agent规则替换提案(role: BFF角色, rule: BFFAgent规则, text: string): Promise<BFFAgent规则提案>;
}

export function 创建Agent规则数据源(请求: 请求函数): Agent规则数据源 {
  /**
   * 追加一个不透明 cursor：查询里已有 ? 时用 &，否则用 ?；cursor 只 encodeURIComponent 一次。
   * 空串、非字符串或重复出现的 cursor 都按契约漂移拒绝 —— 同时挡住翻页死循环。
   */
  async function 读取全部页<TItem>(
    pathForCursor: (cursor: string | null) => `/api/v1/${string}`,
    key: 'rules' | 'proposals',
    decodeItem: (input: unknown) => TItem,
  ): Promise<TItem[]> {
    const 全部: TItem[] = [];
    const 见过的游标 = new Set<string>();
    let 游标: string | null = null;
    while (true) {
      // 显式标注响应/result：泛型循环里的隐式推断会绕成 TS7022。
      const 响应: BFF响应<unknown> = await 请求<unknown>({ path: pathForCursor(游标) });
      const { result }: { result: unknown } = 响应;
      if (!是记录(result)) throw 契约错误();
      if (!(key in result)) throw 契约错误();
      const 允许键 = new Set([key, 'next_cursor']);
      for (const 键 of Object.keys(result)) if (!允许键.has(键)) throw 契约错误();
      全部.push(...要求数组(result[key]).map(decodeItem));
      if (!('next_cursor' in result)) break;
      const 下一个: unknown = result.next_cursor;
      if (typeof 下一个 !== 'string' || 下一个 === '') throw 契约错误();
      if (见过的游标.has(下一个)) throw 契约错误();
      见过的游标.add(下一个);
      游标 = 下一个;
    }
    return 全部;
  }

  async function 读取Agent规则(role: BFF角色, filter?: BFFAgent规则作用域): Promise<BFFAgent规则[]> {
    // recruiter 的范围永远是全局：路由只收 cursor，任何过滤参数都是调用方错误。
    if (role === 'recruiter' && filter !== undefined) {
      throw new BFF错误(0, 'invalid_request', '招聘方的 Agent 规则只有全局范围');
    }
    let 基础路径 = `${角色前缀[role]}/agent-rules`;
    if (filter?.type === 'global') 基础路径 += '?scope=global';
    if (filter?.type === 'intention') {
      // 与 cursor 同样过一遍 encodeURIComponent（合法 ID 下是恒等变换）。
      基础路径 += `?scope=intention&intention_id=${encodeURIComponent(filter.intention_id)}`;
    }
    return 读取全部页(分页路径(基础路径), 'rules', 解Agent规则);
  }

  async function 读取单条Agent规则(role: BFF角色, ruleId: string): Promise<BFFAgent规则> {
    const { result, etag } = await 请求<unknown>({ path: `${角色前缀[role]}/agent-rules/${ruleId}` });
    return 确认版本ETag(解Agent规则(result), etag);
  }

  async function 修改Agent规则(
    role: BFF角色, ruleId: string, version: number, operation: 'pause' | 'resume',
  ): Promise<BFFAgent规则> {
    const { result, etag } = await 请求<unknown>({
      path: `${角色前缀[role]}/agent-rules/${ruleId}`,
      method: 'PATCH',
      body: { operation },
      ifMatch: 版本ETag(version),
    });
    return 确认版本ETag(解Agent规则(result), etag);
  }

  async function 删除Agent规则(role: BFF角色, ruleId: string, version: number): Promise<void> {
    await 请求<unknown>({
      path: `${角色前缀[role]}/agent-rules/${ruleId}`,
      method: 'DELETE',
      ifMatch: 版本ETag(version),
    });
  }

  async function 创建Agent规则提案(
    role: BFF角色, text: string, scope?: BFFAgent规则作用域,
  ): Promise<BFFAgent规则提案> {
    // scope 是 candidate 的必填输入，recruiter 永远没有 —— 调用方错误在发请求前拒绝。
    if (role === 'candidate' && scope === undefined) {
      throw new BFF错误(0, 'invalid_request', '候选人的 Agent 规则提案需要选择范围');
    }
    if (role === 'recruiter' && scope !== undefined) {
      throw new BFF错误(0, 'invalid_request', '招聘方的 Agent 规则提案不接受范围');
    }
    const body = role === 'candidate'
      ? { text: 校验创建文本(text), scope }
      : { text: 校验创建文本(text) };
    const { result } = await 请求<unknown>({
      path: `${角色前缀[role]}/agent-rule-proposals`,
      method: 'POST',
      body,
      幂等: true,
    });
    return 解Agent规则提案(result);
  }

  async function 读取Agent规则提案(role: BFF角色, proposalId: string): Promise<BFFAgent规则提案> {
    const { result } = await 请求<unknown>({ path: `${角色前缀[role]}/agent-rule-proposals/${proposalId}` });
    return 解Agent规则提案(result);
  }

  async function 读取Agent规则提案列表(
    role: BFF角色, state: 'interpreting' | 'ready',
  ): Promise<BFFAgent规则提案[]> {
    return 读取全部页(
      分页路径(`${角色前缀[role]}/agent-rule-proposals?state=${state}`),
      'proposals',
      解Agent规则提案,
    );
  }

  async function 接受Agent规则提案(role: BFF角色, proposalId: string): Promise<BFFAgent规则> {
    const { result, etag } = await 请求<unknown>({
      path: `${角色前缀[role]}/agent-rule-proposals/${proposalId}/accept`,
      method: 'POST',
      // accept 的 body 契约就是空对象。
      body: {},
      幂等: true,
    });
    return 确认版本ETag(解Agent规则(result), etag);
  }

  async function 放弃Agent规则提案(role: BFF角色, proposalId: string): Promise<BFFAgent规则提案> {
    const { result } = await 请求<unknown>({
      path: `${角色前缀[role]}/agent-rule-proposals/${proposalId}/dismiss`,
      method: 'POST',
      body: {},
      幂等: true,
    });
    return 解Agent规则提案(result);
  }

  async function 创建Agent规则替换提案(
    role: BFF角色, rule: BFFAgent规则, text: string,
  ): Promise<BFFAgent规则提案> {
    // 替换 body 按角色闭合：candidate 复用基线规则的 scope，recruiter 永远没有 scope。
    const body = role === 'candidate'
      ? { text: 校验创建文本(text), scope: rule.scope }
      : { text: 校验创建文本(text) };
    const { result } = await 请求<unknown>({
      path: `${角色前缀[role]}/agent-rules/${rule.rule_id}/replacement-proposals`,
      method: 'POST',
      body,
      ifMatch: 版本ETag(rule.version),
      幂等: true,
    });
    return 解Agent规则提案(result);
  }

  return {
    读取Agent规则,
    读取单条Agent规则,
    修改Agent规则,
    删除Agent规则,
    创建Agent规则提案,
    读取Agent规则提案,
    读取Agent规则提案列表,
    接受Agent规则提案,
    放弃Agent规则提案,
    创建Agent规则替换提案,
  };
}
