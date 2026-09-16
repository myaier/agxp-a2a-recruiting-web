// e2e/fixtures/bff/隐私与实名.ts
// P3 隐私域与候选实名域 fixture（C2）：隐私权威视图/组织库/脚本队列、组织屏蔽、
// 候选实名 summary/幂等指纹，从 e2e/数据源模式.spec.ts 原样迁出。
// 可变状态归每次 安装BFF路由 所有。

import { P1C标记 } from './招聘组织';

// ── P3 隐私域标记 ──

// ─────────────────────────────────────────────────────────────────────────────
// P3 隐私域 fixture（Task 6）：/api/v1/me/privacy 整读与稀疏补丁、组织屏蔽与解除、
// 可屏蔽组织搜索。所有标记值只存在于 fixture（明显的合成编号），断言页面展示它们
// 即证明渲染来自 HTTP 而非 Mock。每个请求的 path/method/body/If-Match/Idempotency-Key
// 都经 请求拦截 记录，密钥只在测试进程内比对，不进日志。
// ─────────────────────────────────────────────────────────────────────────────

export const P3标记 = {
  /** 组织搜索命中（自动来源屏蔽用）——同一族三个，第一页两枚便于验证游标 */
  可屏蔽组织甲: 'Fixture 云衢关联甲',
  可屏蔽组织甲法定: '上海 Fixture 云衢关联甲有限公司',
  可屏蔽组织乙: 'Fixture 云衢关联乙',
  可屏蔽组织乙法定: '上海 Fixture 云衢关联乙有限公司',
  可屏蔽组织丙: 'Fixture 云衢关联丙',
  可屏蔽组织丙法定: '上海 Fixture 云衢关联丙有限公司',
  /** 手动添加搜索族 */
  手动组织甲: 'Fixture 磐石信息',
  手动组织甲法定: '上海 Fixture 磐石信息有限公司',
  /** 停用组织：strict 口径绝不进搜索结果，但允许出现在既有屏蔽里 */
  停用组织: 'Fixture 停用旧东家',
  停用组织法定: '上海 Fixture 停用旧东家有限公司',
  冲突披露值显示: '一直允许',
} as const;

// ── P3 隐私域 fixture 与工厂 ──

export interface P3屏蔽形 {
  organization_id: string;
  organization_display_name: string;
  organization_status: 'active' | 'suspended';
  source: 'current_employer' | 'related_organization' | 'manual';
  created_at: string;
}

export interface P3隐私形 {
  employer_privacy_enabled: boolean;
  disclosure_preferences: {
    current_employer: 'never' | 'resume_submission' | 'anonymous';
    education: 'never' | 'resume_submission' | 'anonymous';
    portfolio_links: 'never' | 'resume_submission' | 'anonymous';
  };
  organization_blocks: P3屏蔽形[];
  revision: number;
  updated_at: string;
}

/** 组织库里的一项：搜索池与屏蔽元数据共用（搜索只回 active） */
export interface P3组织库项形 {
  display_name: string;
  legal_name: string;
  status: 'active' | 'suspended';
}

/**
 * GET /me/privacy 的脚本队列项：
 *  - 无项 → 按当前权威视图即刻应答；
 *  - { 保持 } → 本次请求挂起，测试调 兑现() 放行后再按当时视图应答（口径对齐安全重读语义）；
 *  - { 响应 } → 强制以这份（可能过时的）快照应答，制造跨会话陈旧响应。
 */
export interface P3隐私读取脚本形 {
  /** 本次请求先挂起，直到这个 promise 兑现后再按当时视图应答 */
  保持?: Promise<void>;
  响应?: P3隐私形;
}

/** 单个搜索词的行为脚本（竞态用例）：延迟应答 + 固定项目/游标；未命中脚本的词走组织池 */
export interface P3搜索脚本形 {
  词: string;
  延迟毫秒?: number;
  items: { organization_id: string; display_name: string; legal_name: string }[];
  next_cursor: string | null;
}

/** P3 隐私域可变 fixture：测试自持一份，安装路由后 handler 与测试共享同一对象 */
export interface P3隐私fixture形 {
  /** 权威视图（live）：handler 直读直写；测试也可在两步之间直接改它模拟他端变更 */
  视图: P3隐私形;
  /** 组织搜索池（key = organization_id）；strict active 搜索只回 active 项 */
  组织库: Record<string, P3组织库项形>;
  /** GET privacy 脚本队列（FIFO，逐次消费） */
  get脚本: P3隐私读取脚本形[];
  /** 搜索行为脚本（按词匹配一次性消费） */
  搜索脚本: P3搜索脚本形[];
  /** 已受理的组织搜索（请求到达即记；竞态用例轮询「已发出」） */
  搜索完成: { q: string; cursor: string | null }[];
  /** 已应答的组织搜索（应答回写后记；竞态用例轮询「旧响应已终结」） */
  搜索已答: { q: string; cursor: string | null }[];
  /** 写入计数（不含 hydration 读），零基线由各用例自行快照增量 */
  统计: { 补丁: number; 屏蔽写入: number; 解除写入: number };
  /** 幂等键 → 回执 登记表：同键重放回原 receipt（200） */
  幂等登记: Map<string, { receipt: unknown; 块: P3屏蔽形 }>;
}

export function P3隐私fixture(覆盖: Partial<P3隐私形> = {}): P3隐私fixture形 {
  const 初始视图: P3隐私形 = {
    employer_privacy_enabled: true,
    disclosure_preferences: {
      current_employer: 'never',
      education: 'resume_submission',
      portfolio_links: 'anonymous',
    },
    organization_blocks: [],
    revision: 1,
    updated_at: '2026-08-26T00:00:00Z',
    ...覆盖,
  };
  return {
    视图: 初始视图,
    组织库: {},
    get脚本: [],
    搜索脚本: [],
    搜索完成: [],
    搜索已答: [],
    统计: { 补丁: 0, 屏蔽写入: 0, 解除写入: 0 },
    幂等登记: new Map(),
  };
}

/** 可屏蔽组织的默认搜索池：同族三枚 active（首页两枚留游标）+ 一枚手动族 + 一枚停用 */
export function P3默认组织库(): Record<string, P3组织库项形> {
  return {
    'org-fixture-p3-block-a': { display_name: P3标记.可屏蔽组织甲, legal_name: P3标记.可屏蔽组织甲法定, status: 'active' },
    'org-fixture-p3-block-b': { display_name: P3标记.可屏蔽组织乙, legal_name: P3标记.可屏蔽组织乙法定, status: 'active' },
    'org-fixture-p3-block-c': { display_name: P3标记.可屏蔽组织丙, legal_name: P3标记.可屏蔽组织丙法定, status: 'active' },
    'org-fixture-p3-manual-a': { display_name: P3标记.手动组织甲, legal_name: P3标记.手动组织甲法定, status: 'active' },
    'org-fixture-p3-suspended': { display_name: P3标记.停用组织, legal_name: P3标记.停用组织法定, status: 'suspended' },
  };
}

/** 合同 C：默认搜索池叠加 P1C 组织甲 —— 需要经 公司选择抽屉 选中 P1C fixture 组织的
 *  用例（名片自报 / 发岗向导 / 经历企业）用它给 隐私fixture.组织库 供搜索；
 *  按 ID 回读公开企业仍走 组织fixture.organizations，两处都要给（各用例自行 seed）。 */
export function P1C搜索池(): Record<string, P3组织库项形> {
  return {
    ...P3默认组织库(),
    [P1C标记.组织甲编号]: { display_name: P1C标记.组织甲名, legal_name: P1C标记.组织甲法定名, status: 'active' },
  };
}

/** 发送前克隆视图：测试随后改权威对象不应影响已在途响应体 */
export function P3克隆视图(视图: P3隐私形): P3隐私形 {
  return {
    ...视图,
    disclosure_preferences: { ...视图.disclosure_preferences },
    organization_blocks: 视图.organization_blocks.map((块) => ({ ...块 })),
  };
}

// ── 候选实名域 fixture ──

// ── FE-IV-01：候选实名域 fixture（@backend）。可变 summary 归每次 安装BFF路由 所有，
//    页面写入只影响本测试；creates/cancels 只记录 part 名、metadata JSON、headers，
//    绝不记录文件 bytes 或文件名 ──

export interface 候选实名请求投影 {
  request_id: string;
  status: 'pending' | 'verified' | 'rejected' | 'cancelled';
  revision: number;
  submitted_at: string;
  rejection_reason: string | null;
}

export interface 候选实名FixtureState {
  /** 当前权威 wire summary（unverified 起步；create → pending；cancel → unverified + cancelled） */
  summary: {
    status: 'unverified' | 'pending' | 'verified' | 'rejected';
    verified_name: string | null;
    current_request: 候选实名请求投影 | null;
    revision: number;
    updated_at: string;
  };
  /** create 投影：幂等键 + part 名顺序 + metadata JSON + evidence 数（无 bytes/文件名） */
  creates: { key: string; parts: string[]; metadata: unknown; evidence数: number }[];
  /** cancel 投影：requestId 与收到的 quoted If-Match */
  cancels: { requestId: string; ifMatch: string }[];
  /** summary GET 计数 */
  gets: number;
  /** 幂等键 → 输入指纹（同键同输入重放，异输入 409） */
  键值: Map<string, string>;
}

export function 创建候选实名fixture(): 候选实名FixtureState {
  return {
    summary: {
      status: 'unverified',
      verified_name: null,
      current_request: null,
      revision: 1,
      updated_at: '2026-09-05T00:00:00Z',
    },
    creates: [],
    cancels: [],
    gets: 0,
    键值: new Map(),
  };
}

/** 实名 fixture 的契约 fail closed（与 P2要求 同款）。 */
export function IV要求(condition: unknown): asserts condition {
  if (!condition) throw new Error('候选实名 fixture 契约失败');
}
