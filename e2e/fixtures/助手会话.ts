// e2e/fixtures/助手会话.ts
// 求职端助手聊天旅程 fixture（Task 6）：在 e2e/fixtures/P1展示统一.ts 的白名单路由之上
// 叠加一层覆盖路由（Playwright 后注册的路由优先），只拦两类路径：
//   · /api/v1/me/assistant/** —— 四路助手契约（历史分页 / 发送 / 轮询 / 重试）；
//   · GET /api/v1/me/negotiations/{record_id} —— 助手在谈卡片点原生在谈详情的聚合读。
// 其余请求一律 route.fallback() 交还 P1 白名单路由（应用启动水合、岗位 GET、企业公开档、
// 真人会话……全部沿用既有白名单与场景）；白名单外仍由 P1 路由受控 503，绝不放行真实网络。
//
// 剧本纪律（与 P1展示统一 的白名单纪律一致）：
//   · 测试经 创建助手会话状态() 拿到可变剧本，再 安装助手会话路由() 装订；轮询按
//     「队列 + 尾部重复」消费 —— 测试把终态快照推进队列，下一次 2 秒轮询即换答案，
//     不靠时钟竞态，也不从测试端直接改页面状态；
//   · 剧本外的发送 / 重试 / 轮次读取一律受控 503；未登记的 record_id 给真实 404
//     （原生在谈详情按现有不可用态渲染，fixture 不补假数据）；
//   · 本 fixture 的模拟回复只证明前端承载与请求（202 受理、幂等键、轮询、卡片渲染），
//     不证明真实模型理解 —— 真实模型旅程归 final gate 人工验收。
//
// wire 形状用 src 的冻结 DTO 类型静态约束（import type 零运行时依赖）；信封与 P1
// 路由同形 { result, meta }。注意两个在谈详情契约不同形、不可混用：
//   · 助手回复里的 negotiation_detail 卡 data = 7 键主体 + agent_summary（job 五键快照，
//     闭合解码多一键即拒）；
//   · 原生在谈详情聚合读 = NegotiationDetail 全键（job 十键、case_state/case_detail/
//     evaluation/job_detail 在场），pre-Case 封闭档要求三块 Case 坐标全部缺席。

import type { Page, Route } from '@playwright/test';
import { 安装P1路由 } from './P1展示统一';
import type { P1请求记录, P1场景名 } from './P1展示统一';
import type {
  AssistantCard,
  AssistantJobItem,
  AssistantJobRecommendations,
  AssistantMessage,
  AssistantMessagePage,
  AssistantNegotiationDetail,
  AssistantNegotiationItem,
  AssistantNegotiationList,
} from '../../src/数据/招聘数据源/助手会话';
import type { NegotiationAgentSummary, NegotiationDetail } from '../../src/数据/招聘数据源/连续代谈';

/** 助手域时间戳基线（RFC3339）；卡片查询时间按卡各给，见各测试剧本。 */
const 时间戳 = '2026-09-15T08:00:00Z';

function 信封<T>(result: T): { result: T; meta: { request_id: string; api_version: 'v1' } } {
  return { result, meta: { request_id: 'assistant-fixture-req', api_version: 'v1' } };
}

// ── wire 构造器：字段名逐字保留 YAML 原名，形状由冻结 DTO 类型约束 ────────────────

/** 一条助手消息：缺省 succeeded 底座（reply 由调用方显式给），状态组合由调用方覆盖。 */
export function 助手消息(
  基础: { 编号: string; 轮次: string; 文本: string },
  覆盖: Partial<Omit<AssistantMessage, 'message_id' | 'turn_id' | 'text'>> = {},
): AssistantMessage {
  return {
    message_id: 基础.编号,
    turn_id: 基础.轮次,
    text: 基础.文本,
    created_at: 时间戳,
    status: 'succeeded',
    retryable: false,
    error_code: null,
    reply: null,
    ...覆盖,
  };
}

/** 岗位推荐项（AssistantJobItem 九键闭合）。 */
export function 岗位项(
  基础: { 岗位编号: string; 职位: string },
  覆盖: Partial<Omit<AssistantJobItem, 'job_id' | 'title'>> = {},
): AssistantJobItem {
  return {
    job_id: 基础.岗位编号,
    title: 基础.职位,
    organization_name: 'P1FIX 星河科技',
    office_location: 'P1FIX 市',
    salary_lower: 25,
    salary_upper: 40,
    salary_period: 'month',
    annual_salary_months: null,
    safe_reasons: ['direction_match'],
    ...覆盖,
  };
}

/** 在谈项七键主体（record_id 按 dlg_/mc_ + 32 hex 由调用方保证）。 */
export function 在谈项(
  基础: { 记录编号: string; 职位: string },
  覆盖: {
    job?: Partial<AssistantNegotiationItem['job']>;
  } & Partial<Omit<AssistantNegotiationItem, 'record_id' | 'job'>> = {},
): AssistantNegotiationItem {
  const { job, ...其余 } = 覆盖;
  return {
    record_id: 基础.记录编号,
    record_kind: 'delegation',
    intention_id: 'int_00112233445566778899aabbccddee01',
    job: {
      job_id: 'job_00112233445566778899aabbccddee01',
      title: 基础.职位,
      location: 'P1FIX 市',
      public_salary_range: '25-40K',
      availability: 'available',
      ...job,
    },
    case_id: null,
    phase: 'accepted',
    needs_action: false,
    ...其余,
  };
}

export function 岗位推荐页(items: AssistantJobItem[], next_cursor: string | null): AssistantJobRecommendations {
  return { intention_id: 'int_00112233445566778899aabbccddee01', items, next_cursor };
}

export function 在谈页(items: AssistantNegotiationItem[], next_cursor: string | null): AssistantNegotiationList {
  return { items, next_cursor };
}

export function 岗位推荐卡(查询时间: string, data: AssistantJobRecommendations): AssistantCard {
  return { kind: 'job_recommendations', queried_at: 查询时间, data };
}

export function 在谈列表卡(查询时间: string, data: AssistantNegotiationList): AssistantCard {
  return { kind: 'negotiation_list', queried_at: 查询时间, data };
}

export function 在谈详情卡(查询时间: string, data: AssistantNegotiationDetail): AssistantCard {
  return { kind: 'negotiation_detail', queried_at: 查询时间, data };
}

/** 助手在谈详情卡的 data（8 键闭合）：7 键主体 + agent_summary，job 保持五键快照。 */
export function 在谈详情卡数据(
  项: AssistantNegotiationItem,
  覆盖: { 公开初评?: NegotiationAgentSummary['public_evaluation'] } = {},
): AssistantNegotiationDetail {
  return {
    ...项,
    agent_summary: { public_evaluation: 覆盖.公开初评 ?? null, condition_confirmation: null },
  };
}

/**
 * 原生在谈详情页聚合读（GET /api/v1/me/negotiations/{record_id}）的应答：pre-Case
 * delegation 封闭档 —— case_id=null 时 case_state/case_detail/condition_confirmation 必须全部
 * 缺席（连续代谈域的聚合不变式）；job 补齐 release/0.2.5 十键快照（null=未知，合法档）。
 */
export function 在谈详情应答(
  项: AssistantNegotiationItem,
  覆盖: { 公开初评?: NegotiationAgentSummary['public_evaluation'] } = {},
): NegotiationDetail {
  return {
    ...项,
    job: {
      job_id: 项.job.job_id,
      title: 项.job.title,
      location: 项.job.location,
      public_salary_range: 项.job.public_salary_range,
      availability: 项.job.availability,
      organization: null,
      required_skills: null,
      recruitment_type: null,
      workplace_mode: null,
      annual_salary_months: null,
    },
    delegation_id: null,
    evaluation_id: null,
    shelf: 'active',
    case_state: null,
    failure: null,
    refusal_code: null,
    actions: { retry: false, archive: false, open_case: false },
    retry_generation: 0,
    created_at: 时间戳,
    updated_at: 时间戳,
    archived_at: null,
    match_score: null,
    evaluation: null,
    case_detail: null,
    failure_history: [],
    job_detail: null,
    agent_summary: { public_evaluation: 覆盖.公开初评 ?? null, condition_confirmation: null },
  };
}

// ── 剧本状态：测试持有并按步推进；路由侧只读 ─────────────────────────────────────

export interface 助手会话状态 {
  /** 无游标首页应答（wire 顺序：最新在前）。默认空页。 */
  首页: AssistantMessagePage;
  /** cursor → 更早页应答；未登记的游标按合法空页应答。 */
  更早页: Record<string, AssistantMessagePage>;
  /** POST /messages 的 202 受理应答；null = 剧本未授权发送 → 受控 503。 */
  发送受理: AssistantMessage | null;
  /** POST /turns/{原轮次}/retry 的 202 应答，按原轮次 id 键入；未键入 → 受控 503。 */
  重试受理: Record<string, AssistantMessage>;
  /** GET /turns/{turn_id} 轮询队列：多于一条时逐次 shift，只剩一条时重复它。 */
  轮询队列: Record<string, AssistantMessage[]>;
  /** GET /negotiations/{record_id} 应答；未登记的 record_id 给真实 404。 */
  在谈详情: Record<string, NegotiationDetail>;
  /** 观测计数（断言用）：无游标首页读数。 */
  历史读数: number;
  /** 观测计数：各轮次轮询读数。 */
  轮询读数: Record<string, number>;
}

export function 创建助手会话状态(): 助手会话状态 {
  return {
    首页: { items: [], next_cursor: null },
    更早页: {},
    发送受理: null,
    重试受理: {},
    轮询队列: {},
    在谈详情: {},
    历史读数: 0,
    轮询读数: {},
  };
}

export interface 助手覆盖请求 {
  method: string;
  path: string;
  /** GET /messages 的 cursor 参数；其余请求为 null */
  游标: string | null;
  /** Idempotency-Key 请求头（两个 POST 的契约）；无则 null */
  幂等键: string | null;
}

export interface 助手会话路由结果 {
  /** P1 白名单路由记录的全部请求（覆盖层处理的请求不在其中，见 覆盖请求） */
  请求: P1请求记录[];
  /** 覆盖层自己处理的请求（四路助手 + 在谈详情聚合读） */
  覆盖请求: 助手覆盖请求[];
}

const 受控错误 = { error: { type: 'p1_fixture_unknown_api', message: '助手 fixture 白名单外请求' } };

/**
 * 安装求职端助手聊天旅程路由。内部先装 P1 白名单路由（场景可指定，默认『完整』），
 * 再叠覆盖层 —— 后注册者优先，未命中的请求 fallback 回 P1 路由。
 */
export async function 安装助手会话路由(
  page: Page,
  options: { 状态: 助手会话状态; 场景?: P1场景名 },
): Promise<助手会话路由结果> {
  const { 状态, 场景 = '完整' } = options;
  const 基座 = await 安装P1路由(page, { role: 'candidate', 场景 });
  const 覆盖请求: 助手覆盖请求[] = [];

  const 是覆盖路径 = (path: string): boolean =>
    path.startsWith('/api/v1/me/assistant/') || /^\/api\/v1\/me\/negotiations\/[^/]+$/.test(path);

  await page.route((url) => 是覆盖路径(url.pathname), async (route: Route) => {
    const 请求 = route.request();
    const url = new URL(请求.url());
    const path = url.pathname;
    const method = 请求.method();
    覆盖请求.push({
      method,
      path,
      游标: path === '/api/v1/me/assistant/messages' ? url.searchParams.get('cursor') : null,
      幂等键: 请求.headers()['idempotency-key'] ?? null,
    });

    const 答 = async (状态码: number, json: unknown) => {
      await route.fulfill({ status: 状态码, json, headers: { 'Cache-Control': 'no-store' } });
    };

    // ── 四路助手契约（Spec §3）──
    if (path === '/api/v1/me/assistant/messages' && method === 'GET') {
      if (url.searchParams.get('cursor') === null) {
        状态.历史读数 += 1;
        await 答(200, 信封(状态.首页));
        return;
      }
      const 游标 = url.searchParams.get('cursor') ?? '';
      await 答(200, 信封(状态.更早页[游标] ?? { items: [], next_cursor: null }));
      return;
    }
    if (path === '/api/v1/me/assistant/messages' && method === 'POST') {
      if (状态.发送受理 === null) {
        await 答(503, 受控错误);
        return;
      }
      await 答(202, 信封(状态.发送受理));
      return;
    }
    const 轮次匹配 = /^\/api\/v1\/me\/assistant\/turns\/([^/]+)$/.exec(path);
    if (轮次匹配 && method === 'GET') {
      const 轮次 = decodeURIComponent(轮次匹配[1]!);
      状态.轮询读数[轮次] = (状态.轮询读数[轮次] ?? 0) + 1;
      const 队列 = 状态.轮询队列[轮次];
      const 快照 = 队列 === undefined || 队列.length === 0
        ? null
        : 队列.length > 1 ? 队列.shift()! : 队列[0]!;
      if (快照 === null) {
        await 答(503, 受控错误);
        return;
      }
      await 答(200, 信封(快照));
      return;
    }
    const 重试匹配 = /^\/api\/v1\/me\/assistant\/turns\/([^/]+)\/retry$/.exec(path);
    if (重试匹配 && method === 'POST') {
      const 应答 = 状态.重试受理[decodeURIComponent(重试匹配[1]!)];
      if (应答 === undefined) {
        await 答(503, 受控错误);
        return;
      }
      await 答(202, 信封(应答));
      return;
    }

    // ── 在谈详情聚合读（助手在谈卡片点原生详情；未登记给真实 404）──
    const 详情匹配 = /^\/api\/v1\/me\/negotiations\/([^/]+)$/.exec(path);
    if (详情匹配 && method === 'GET') {
      const 详情 = 状态.在谈详情[decodeURIComponent(详情匹配[1]!)];
      if (详情 === undefined) {
        await 答(404, { error: { type: 'negotiation_not_found', message: '助手 fixture 无此记录' } });
        return;
      }
      await 答(200, 信封(详情));
      return;
    }

    await 答(503, 受控错误);
  });

  return { 请求: 基座.请求, 覆盖请求 };
}
