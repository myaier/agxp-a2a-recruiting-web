// e2e/fixtures/bff/隐私与实名.ts
// P3 隐私域与候选实名域 fixture（C2）：隐私权威视图/组织库/脚本队列、组织屏蔽、
// 候选实名 summary/幂等指纹，从 e2e/数据源模式.spec.ts 原样迁出。
// 可变状态归每次 安装BFF路由 所有。

import { P1C标记 } from './招聘组织';
import { P4深克隆 } from './发现推荐';
import { 信封, 解metadata部件, type 路由上下文形 } from './协议';

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


// ── 路由 handler（C2 阶段二迁入）──

export async function 处理候选实名域(
  IV域: 候选实名FixtureState | null,
  上下文: 路由上下文形,
): Promise<boolean> {
  const { route, 请求, path, method, body, 部件们 } = 上下文;

  // ── FE-IV-01：候选实名域 fixture —— GET 回当前严格摘要信封（no-store + ETag）；
  //    create 校验 Idempotency-Key（16–128 可见 ASCII）与 multipart 形状（恰一个
  //    metadata + 一至两个 evidence，metadata 恰两键），同键同输入重放同 summary、
  //    异输入 409 idempotency_conflict，202 不伪造 ETag；cancel 校验 body {} 与
  //    等于当前顶层 revision 的 quoted If-Match，错 revision 409，成功回 cancelled ──
  if (IV域 && path === '/api/v1/me/identity-verification' && method === 'GET') {
    IV域.gets += 1;
    await route.fulfill({
      status: 200,
      json: 信封(P4深克隆(IV域.summary)),
      headers: { 'cache-control': 'no-store', etag: `"${IV域.summary.revision}"` },
    });
    return true;
  }
  if (IV域 && path === '/api/v1/me/identity-verification-requests' && method === 'POST') {
    const key = 请求.headers()['idempotency-key'] ?? '';
    IV要求(/^[!-~]{16,128}$/.test(key));
    const parts = 部件们?.map((件) => 件.name) ?? [];
    const evidence数 = parts.filter((名) => 名 === 'evidence').length;
    IV要求(parts.length === evidence数 + 1 && parts[0] === 'metadata' &&
      (evidence数 === 1 || evidence数 === 2));
    const metadataPart = 部件们?.find((件) => 件.name === 'metadata');
    IV要求(metadataPart !== undefined && metadataPart.contentType === 'application/json');
    const metadata = metadataPart ? 解metadata部件(metadataPart.bytes) : undefined;
    IV要求(metadata !== null && typeof metadata === 'object' &&
      Object.keys(metadata as Record<string, unknown>).sort().join(',') === 'document_type,legal_name');
    const 指纹 = `${JSON.stringify(metadata)}|${evidence数}`;
    const 已有指纹 = IV域.键值.get(key);
    if (已有指纹 !== undefined && 已有指纹 !== 指纹) {
      await route.fulfill({
        status: 409,
        json: { error: { type: 'idempotency_conflict', message: '同幂等键提交了不同输入' } },
      });
      return true;
    }
    IV域.键值.set(key, 指纹);
    IV域.creates.push({ key, parts, metadata, evidence数 });
    if (IV域.summary.status === 'unverified') {
      IV域.summary = {
        status: 'pending',
        verified_name: null,
        current_request: {
          request_id: 'ivq-fixture-0001',
          status: 'pending',
          revision: 1,
          submitted_at: '2026-09-05T00:00:00Z',
          rejection_reason: null,
        },
        revision: 2,
        updated_at: '2026-09-05T00:00:01Z',
      };
    }
    await route.fulfill({
      status: 202,
      json: 信封(P4深克隆(IV域.summary)),
      headers: { 'cache-control': 'no-store' },
    });
    return true;
  }
  const IV取消 = /^\/api\/v1\/me\/identity-verification-requests\/([^/]+)\/cancel$/.exec(path);
  if (IV域 && IV取消 && method === 'POST') {
    IV要求(body !== null && typeof body === 'object' && Object.keys(body as object).length === 0);
    const ifMatch = 请求.headers()['if-match'] ?? '';
    IV域.cancels.push({ requestId: IV取消[1]!, ifMatch });
    if (ifMatch !== `"${IV域.summary.revision}"`) {
      await route.fulfill({
        status: 409,
        json: { error: { type: 'version_conflict', message: 'revision 已变化' } },
      });
      return true;
    }
    const 当前 = IV域.summary.current_request;
    if (当前 !== null && 当前.status === 'pending') {
      IV域.summary = {
        status: 'unverified',
        verified_name: null,
        current_request: { ...当前, status: 'cancelled', revision: 当前.revision + 1 },
        revision: IV域.summary.revision + 1,
        updated_at: '2026-09-05T00:00:02Z',
      };
    }
    await route.fulfill({
      status: 200,
      json: 信封(P4深克隆(IV域.summary)),
      headers: { 'cache-control': 'no-store', etag: `"${IV域.summary.revision}"` },
    });
    return true;
  }
  return false;
}

export async function 处理隐私域(
  P3域: P3隐私fixture形 | null,
  上下文: 路由上下文形,
): Promise<boolean> {
  if (P3域 === null) return false;
  const { route, 请求, url, path, method, body } = 上下文;

  // ── P3 隐私域（隐私 fixture 存在时才应答；缺席走兜底空信封 → strict decode 拒绝，
  //    正是「Mock 内容不顶替 HTTP」的既有边界）──
  // GET 权威整读：脚本队列 FIFO 消费 —— 无项即刻回当前视图；
  // { 保持 } 先挂起（安全重读在飞的窗口），放行后再按当时视图应答；{ 响应 } 强制回陈旧快照。
  if (path === '/api/v1/me/privacy' && method === 'GET') {
    const 脚本项 = P3域.get脚本.shift();
    if (脚本项?.保持) await 脚本项.保持;
    await route.fulfill({ status: 200, json: 信封(脚本项?.响应 ? P3克隆视图(脚本项.响应) : P3克隆视图(P3域.视图)) });
    return true;
  }

  // PATCH 稀疏补丁：quoted If-Match 必须等于当前 revision 的 etag，不符 409 version_conflict；
  // 成功按成员合并、revision+1，回完整视图。body 只允许服务端拥有的两个成员。
  if (path === '/api/v1/me/privacy' && method === 'PATCH') {
    P3域.统计.补丁 += 1;
    const etag = 请求.headers()['if-match'] ?? '';
    if (etag !== `"${P3域.视图.revision}"`) {
      await route.fulfill({ status: 409, json: { error: { type: 'version_conflict', message: '版本冲突' } } });
      return true;
    }
    const 补丁 = body as { employer_privacy_enabled?: boolean; disclosure_preferences?: Partial<P3隐私形['disclosure_preferences']> };
    if (补丁.employer_privacy_enabled !== undefined) {
      P3域.视图.employer_privacy_enabled = 补丁.employer_privacy_enabled;
    }
    if (补丁.disclosure_preferences !== undefined) {
      P3域.视图.disclosure_preferences = { ...P3域.视图.disclosure_preferences, ...补丁.disclosure_preferences };
    }
    P3域.视图.revision += 1;
    P3域.视图.updated_at = '2026-08-27T00:00:00Z';
    await route.fulfill({ status: 200, json: 信封(P3克隆视图(P3域.视图)) });
    return true;
  }

  // GET 可屏蔽组织搜索：strict active（停用组织永不出现）；游标与 query 绑定
  // （格式 `${q}|${页码}`，跨词/未知游标一律空页）。固定每页 2 条制造翻页游标。
  if (path === '/api/v1/organizations' && method === 'GET') {
    const q = (url.searchParams.get('q') ?? '').trim();
    const 脚本 = P3域.搜索脚本.find((项) => 项.词 === q);
    if (脚本) {
      P3域.搜索脚本 = P3域.搜索脚本.filter((项) => 项 !== 脚本);
      P3域.搜索完成.push({ q, cursor: 脚本.next_cursor });
      if (脚本.延迟毫秒) await new Promise((resolve) => setTimeout(resolve, 脚本.延迟毫秒));
      P3域.搜索已答.push({ q, cursor: 脚本.next_cursor });
      await route.fulfill({
        status: 200,
        json: 信封({
          // 公司选择抽屉的 搜索组织 闭合解码要求 verification_status（合同 B 四字段形状）
          items: 脚本.items.map((项) => ({ ...项, verification_status: 'unverified' as const })),
          next_cursor: 脚本.next_cursor,
        }),
      });
      return true;
    }
    const 游标原文 = url.searchParams.get('cursor') ?? '';
    let 页码 = 1;
    let 归属词 = q;
    if (游标原文 !== '') {
      const 解码 = Buffer.from(游标原文, 'base64url').toString('utf8');
      const 分隔 = 解码.lastIndexOf('|');
      归属词 = 分隔 >= 0 ? 解码.slice(0, 分隔) : '\0不匹配';
      页码 = Number(分隔 >= 0 ? 解码.slice(分隔 + 1) : NaN);
    }
    const 池 = Object.entries(P3域.组织库)
      .filter(([, 项]) => 项.status === 'active')
      .filter(([, 项]) => 项.display_name.includes(q))
      .map(([编号, 项]) => ({
        organization_id: 编号,
        display_name: 项.display_name,
        legal_name: 项.legal_name,
        // 公司选择抽屉的 搜索组织 闭合解码要求该键（合同 B 四字段形状）
        verification_status: 'unverified' as const,
      }));
    const 每页 = 2;
    const 起点 = Number.isInteger(页码) && 页码 > 0 && 归属词 === q ? (页码 - 1) * 每页 : -1;
    const items = 起点 < 0 ? [] : 池.slice(起点, 起点 + 每页);
    const next_cursor = 起点 < 0 || 起点 + 每页 >= 池.length ? null : Buffer.from(`${q}|${页码 + 1}`).toString('base64url');
    P3域.搜索完成.push({ q, cursor: next_cursor });
    P3域.搜索已答.push({ q, cursor: next_cursor });
    await route.fulfill({ status: 200, json: 信封({ items, next_cursor }) });
    return true;
  }

  // POST 屏蔽：If-Match + 非空 Idempotency-Key 必带；组织必须是搜索池里的稳定 ID。
  // 同键重放或同组织重复都以 200 回原 receipt；新建 201 receipt。
  if (path === '/api/v1/me/privacy/organization-blocks' && method === 'POST') {
    P3域.统计.屏蔽写入 += 1;
    const etag = 请求.headers()['if-match'] ?? '';
    const 幂等键 = 请求.headers()['idempotency-key'] ?? '';
    const 重放 = 幂等键 !== '' && P3域.幂等登记.get(幂等键);
    const 新块 = body as { organization_id?: string; source?: P3屏蔽形['source'] };
    const 库项 = 新块.organization_id !== undefined ? P3域.组织库[新块.organization_id] : undefined;
    if (
      etag !== `"${P3域.视图.revision}"` ||
      幂等键 === '' ||
      !库项 ||
      (新块.source !== 'current_employer' && 新块.source !== 'related_organization' && 新块.source !== 'manual')
    ) {
      await route.fulfill({
        status: 库项 === undefined && 新块.organization_id !== undefined ? 409 : 422,
        json: {
          error: {
            type: 库项 === undefined && 新块.organization_id !== undefined ? 'organization_unavailable' : 'validation_failed',
            message: '屏蔽请求未通过校验',
          },
        },
      });
      return true;
    }
    if (重放) {
      await route.fulfill({ status: 200, json: 信封(JSON.parse(JSON.stringify(重放.receipt)) as unknown) });
      return true;
    }
    const 重复 = P3域.视图.organization_blocks.find((块) => 块.organization_id === 新块.organization_id);
    if (重复) {
      const 回执 = {
        organization_block: { ...重复 },
        privacy_revision: P3域.视图.revision,
        created_at: 重复.created_at,
      };
      P3域.幂等登记.set(幂等键, { receipt: 回执, 块: { ...重复 } });
      await route.fulfill({ status: 200, json: 信封(回执) });
      return true;
    }
    const 块: P3屏蔽形 = {
      organization_id: 新块.organization_id!,
      organization_display_name: 库项.display_name,
      organization_status: 库项.status,
      source: 新块.source!,
      created_at: '2026-08-27T01:00:00Z',
    };
    P3域.视图.organization_blocks = [...P3域.视图.organization_blocks.map((项) => ({ ...项 })), { ...块 }];
    P3域.视图.revision += 1;
    const 回执 = { organization_block: { ...块 }, privacy_revision: P3域.视图.revision, created_at: 块.created_at };
    P3域.幂等登记.set(幂等键, { receipt: 回执, 块 });
    await route.fulfill({ status: 201, json: 信封(回执) });
    return true;
  }

  // POST 解除：目标必须仍在名单里（404）；建档来源的解除必须显式风险确认（422）；
  // 成功移除并 revision+1，回完整视图。
  const 解除匹配 = /^\/api\/v1\/me\/privacy\/organization-blocks\/([^/]+)\/unblock$/.exec(path);
  if (解除匹配 && method === 'POST') {
    P3域.统计.解除写入 += 1;
    const etag = 请求.headers()['if-match'] ?? '';
    const 目标 = P3域.视图.organization_blocks.find((块) => 块.organization_id === 解除匹配[1]);
    if (etag !== `"${P3域.视图.revision}"` || !目标) {
      await route.fulfill({ status: 目标 ? 409 : 404, json: { error: { type: 目标 ? 'version_conflict' : 'organization_block_not_found', message: '解除失败' } } });
      return true;
    }
    const 要求确认 = (body as { risk_acknowledged?: boolean }).risk_acknowledged !== true;
    if ((目标.source === 'current_employer' || 目标.source === 'related_organization') && 要求确认) {
      await route.fulfill({ status: 422, json: { error: { type: 'risk_acknowledgement_required', message: '需要风险确认' } } });
      return true;
    }
    P3域.视图.organization_blocks = P3域.视图.organization_blocks.filter((块) => 块.organization_id !== 解除匹配[1]).map((块) => ({ ...块 }));
    P3域.视图.revision += 1;
    await route.fulfill({ status: 200, json: 信封(P3克隆视图(P3域.视图)) });
    return true;
  }
  return false;
}
