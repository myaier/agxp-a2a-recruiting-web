// e2e/fixtures/bff/真人消息.ts
// P7 真人会话域 fixture（C2）：收件箱/详情/消息分页的 wire 投影与可变 fixture 工厂，
// 从 e2e/数据源模式.spec.ts 原样迁出。可变状态归每次 安装BFF路由 所有。
// 展示增量（Spec §11.2/§11.3）：补答会话页的三类定向补读 —— 同 Case 详情
//（P5详情wire 复用 MatchCase 域构造器）、canonical 岗位（发布方 ref ≠ 用人企业）、
// 公开企业与授权简历 PDF —— P7 旅程自包含，不为此激活其它域（其它域在场时仍按
// 安装BFF路由 的固定分发顺序先行应答）。
import { 信封, type 路由上下文形 } from './协议';
import { P4CandidateJob, type P4CandidateJob形 } from './发现推荐';
import { P5Case, P5详情wire, P5连续详情wire, type P5Case记录形, type P5连续记录形 } from './MatchCase';
import { P1C企业档案 } from './招聘组织';

// ── P7 真人会话域 fixture 与工厂 ──

// ─────────────────────────────────────────────────────────────────────────────
// P7 真人会话域可变 fixture（Task 7）。双端（候选 me / 招聘 recruiter）conversations
// 的收件箱、详情、消息分页、纯文本发送（Idempotency-Key 同键重放只落一条）、
// forward-only 已读（PUT 后该角色未读归零）与 context 投影（available /
// unavailable 演练）。消息分页响应键是实际实现的 { messages, next_cursor }，
// 已读回执是 { read_through_message_id }。会话不能由浏览器创建：fixture 只预置
// 3003 一条会话，9900 可标记不存在（foreign / wrong-role 404 演练）。
// ─────────────────────────────────────────────────────────────────────────────

export const P7会话编号 = {
  会话: '3003',
  // 候选聚合 record_id 契约 ^(dlg_|mc_)[0-9a-f]{32}$：案例号同时充当聚合 canonical 坐标
  案例: `mc_${'0'.repeat(28)}0771`,
  职位: 'job_00112233445566778899aabbccddeeff',
  简历: 'rf_00112233445566778899aabbccddeeff',
} as const;

export const P7标记 = {
  职位名: 'P7 Fixture 后端工程师',
  地点: 'P7 Fixture 市',
  // 們选别名契约 ^candidate-[0-9a-f]{12}$（招聘端 Case 详情 candidate_alias / P7 context 代号）
  候选代号: 'candidate-0000000077a1',
  候选消息: 'P7 Fixture 候选：想约明天下午聊聊',
  招聘消息: 'P7 Fixture 招聘：可以，下午三点见',
  招聘回复: 'P7 Fixture 招聘：没问题，明天下午三点',
} as const;

/** Spec §11.2 补读数据的标记值：发布方与用人企业刻意不同（验证不张冠李戴）。 */
export const P7资料标记 = {
  发布人姓名: 'P7 Fixture 招聘负责人·林澈',
  发布人职务: '招聘负责人',
  发布方编号: 'org-p7-publisher-0001',
  发布方名称: 'P7 Fixture 发布方猎头',
  用人企业编号: 'org-p7-hiring-0002',
  用人企业名: 'P7 Fixture 用人企业',
  冻结职位说明: 'P7 Fixture 冻结职位说明：跨端协作的平台岗',
} as const;

export type P7角色词 = 'candidate' | 'recruiter';

export interface P7消息wire形 {
  message_id: string;
  kind: 'user_text';
  sender_role: P7角色词;
  content: string;
  created_at: string;
}

export interface P7FixtureState {
  messages: Record<string, P7消息wire形[]>;
  unread: Record<P7角色词, number>;
  sends: Array<{ role: P7角色词; key: string; content: string }>;
  reads: Array<{ role: P7角色词; through: string }>;
  /** 详情 context 投影：'unavailable' 或显式上下文（ref 可缺省隐藏动作）；缺省 available + 职位上下文 */
  contexts: Record<string, { primary_label: string; secondary_label: string; job_ref?: string; resume_ref?: string } | 'unavailable'>;
  /** 标记为不存在的会话坐标（foreign / wrong-role 404） */
  不存在: string[];
  /** 发送首答 503 operation_outcome_unknown（消息已落库、响应未知）：受控重试同键重放收敛一条 */
  首答未知: boolean;
  /** Spec §11.2：caseId → Case 记录（页头身份/职位资料补读）；缺省 = P7 案例一条（disclosed + 冻结发布人档案 + 已披露可取 PDF） */
  case们?: Record<string, P5Case记录形>;
  /** Spec §11.2：候选端聚合读（me/negotiations）的连续记录；缺省 = P7 案例一条（case_started） */
  连续记录?: Record<string, P5连续记录形>;
  /** Spec §11.2：jobId → canonical 岗位（候选页头发布方公司链）；缺省 = P7 职位（发布方 ≠ 用人企业） */
  岗位?: Record<string, P4CandidateJob形>;
  /** Spec §11.2：orgId → 公开企业 display_name；缺省 = 发布方编号 → 发布方名称 */
  企业?: Record<string, string>;
}

/** P7 会话案例的 Case 记录：completed 单（招聘端 candidateIdentity=disclosed 出真名；
 *  候选端 jobDetail 带发布人档案）；已披露 = true 使授权简历 PDF 可取。 */
export function P7案例记录(覆盖: Partial<P5Case记录形> = {}): P5Case记录形 {
  const 案例们 = P5Case({
    caseId: P7会话编号.案例,
    lifecycle: 'completed',
    stage: 'intent_confirmation',
    status: 'passed',
    step: 'handoff_pending',
    职位名: P7标记.职位名,
    alias: P7标记.候选代号,
    createdAt: '2026-08-29T01:00:00Z',
    updatedAt: '2026-08-29T02:00:00Z',
    finalizedAt: '2026-08-29T02:00:00Z',
    意向词: { candidate: 'confirm' as const, recruiter: 'confirm' as const },
    终局: { stage: 'intent_confirmation', outcome: '', reason_summary: '', finalized_at: '2026-08-29T02:00:00Z' },
    身份: 'disclosed',
    已披露: true,
    jobDetail: {
      title: P7标记.职位名,
      description: P7资料标记.冻结职位说明,
      requirements: 'P7 Fixture 冻结职位要求',
      recruitment_type: 'social_full_time',
      category: { id: 'cat_p7', display_name: '后端开发' },
      location: { id: 'loc_p7', display_name: P7标记.地点 },
      office_location: 'P7 Fixture 办公地址',
      workplace_mode: 'hybrid',
      salary_lower: 25,
      salary_upper: 40,
      salary_period: 'month',
      annual_salary_months: 15,
      campus_cohort: null,
      internship_months: null,
      onsite_days_per_week: null,
      experience_requirement: null,
      education_requirement: '本科',
      hard_requirements: {
        alternate_weekend_work: 'unknown',
        outsourcing_only: 'not_required',
        onsite_only: 'unknown',
        frequent_travel: 'unknown',
      },
      structured_requirements_confirmed: null,
      keywords: [],
      organization: null,
      company_intro: null,
      office_address: null,
      benefit_codes: null,
      publisher_profile: {
        public_name: P7资料标记.发布人姓名,
        title: P7资料标记.发布人职务,
        personal_verification_status: 'verified',
        avatar_url: null,
      },
    },
    ...覆盖,
  });
  // completed 单的 S3 段摘要是真实 wire step word（同 MatchCase 域 己 样本口径）
  案例们.阶段区们[3]!.summary = 'handoff_pending';
  案例们.阶段区们[3]!.transcript = [
    {
      event_id: 'evt_p7_done', stage: 'intent_confirmation', kind: 'case_completed',
      role: '', reason_code: 'handoff_pending', occurred_at: '2026-08-29T02:00:00Z',
    },
  ];
  return 案例们;
}

/** P7 会话的 canonical 当前岗位：发布方 ref 指猎头组织、用人企业是另一家 ——
 *  候选页头公司只能来自发布方链，绝不拿 organization/claim 替代。 */
export function P7当前岗位(覆盖: Partial<P4CandidateJob形> = {}): P4CandidateJob形 {
  return P4CandidateJob({
    job_id: P7会话编号.职位,
    title: P7标记.职位名,
    publisher_organization_ref: P7资料标记.发布方编号,
    hiring_organization_ref: P7资料标记.用人企业编号,
    hiring_organization_claim: { display_name: P7资料标记.用人企业名 },
    organization: {
      organization_id: P7资料标记.用人企业编号,
      display_name: P7资料标记.用人企业名,
      industry: null,
      company_size: null,
      funding_stage: null,
      logo: null,
    },
    ...覆盖,
  });
}

/** P7 案例的候选连续记录（canonical = case 坐标，case_started 相位）。 */
export function P7连续记录(): P5连续记录形 {
  return {
    recordId: P7会话编号.案例,
    recordKind: 'case',
    caseId: P7会话编号.案例,
    delegationId: null,
    evaluationId: null,
    phase: 'case_started',
    needsAction: false,
    actions: { retry: false, archive: false, open_case: false },
    failure: null,
    refusalCode: null,
    retryGeneration: 0,
    职位名: P7标记.职位名,
    createdAt: '2026-08-29T01:00:00Z',
    updatedAt: '2026-08-29T02:00:00Z',
    archivedAt: null,
    公开评: null,
  };
}

export function 创建P7fixture(): P7FixtureState {
  return {
    messages: { [P7会话编号.会话]: [] },
    unread: { candidate: 0, recruiter: 0 },
    sends: [],
    reads: [],
    contexts: {},
    不存在: [],
    首答未知: false,
    case们: { [P7会话编号.案例]: P7案例记录() },
    连续记录: { [P7会话编号.案例]: P7连续记录() },
    岗位: { [P7会话编号.职位]: P7当前岗位() },
    企业: { [P7资料标记.发布方编号]: P7资料标记.发布方名称 },
  };
}

/** 会话条 wire：双端共用一条 3003；context 不可用只降级展示字段（消息事实仍在）。 */
export function P7会话项wire(P7域: P7FixtureState, id: string, role: P7角色词): Record<string, unknown> {
  const 消息们 = P7域.messages[id] ?? [];
  const 最后 = 消息们.at(-1) ?? null;
  const 上下文 = P7域.contexts[id] ?? {
    primary_label: P7标记.职位名,
    secondary_label: role === 'candidate' ? P7标记.地点 : P7标记.候选代号,
    job_ref: P7会话编号.职位,
    resume_ref: P7会话编号.简历,
  };
  const 条: Record<string, unknown> = {
    conversation_id: id,
    case_id: P7会话编号.案例,
    kind: 'human_handoff',
    last_message: 最后 === null
      ? null
      : { message_id: 最后.message_id, sender_role: 最后.sender_role, preview: 最后.content, created_at: 最后.created_at },
    last_activity_at: 最后?.created_at ?? '2026-08-30T00:00:00Z',
    unread_count: P7域.unread[role],
    context_status: 上下文 === 'unavailable' ? 'unavailable' : 'available',
  };
  if (上下文 !== 'unavailable') 条.context = { ...上下文 };
  return 条;
}


// ── 路由 handler（C2 阶段二迁入）──

export async function 处理真人消息域(
  P7域: P7FixtureState | null,
  上下文: 路由上下文形,
): Promise<boolean> {
  if (P7域 === null) return false;
  const { route, 请求, path, method, body } = 上下文;

  // ── P7 真人会话域（Task 7）：可变 fixture 在场才应答；每个 JSON 应答带 no-store。
  //    路由匹配：收件箱（无坐标）→ 详情 / 消息 / 已读（带坐标）。发送登记
  //    Idempotency-Key：同键重放回已落库的那一条（不重复追加）；首答未知分支
  //    消息已落库但响应 503，客户端受控重试同键收敛。已读 PUT 后该角色未读归零。──
  const P7答复 = async (状态: number, json: unknown) => {
    await route.fulfill({ status: 状态, json, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  };
  const P7匹配 = /^\/api\/v1\/(me|recruiter)\/conversations(?:\/([^/]+))?(?:\/(messages|read))?$/.exec(path);
  if (P7匹配) {
    const 角色: P7角色词 = P7匹配[1] === 'me' ? 'candidate' : 'recruiter';
    const 坐标 = P7匹配[2] ?? null;
    const 子路径 = P7匹配[3] ?? null;
    if (坐标 === null && method === 'GET') {
      await P7答复(200, 信封({ items: [P7会话项wire(P7域, P7会话编号.会话, 角色)], next_cursor: null }));
      return true;
    }
    if (坐标 !== null && !P7域.不存在.includes(坐标)) {
      if (子路径 === null && method === 'GET') {
        await P7答复(200, 信封(P7会话项wire(P7域, 坐标, 角色)));
        return true;
      }
      if (子路径 === 'messages' && method === 'GET') {
        await P7答复(200, 信封({ messages: P7域.messages[坐标] ?? [], next_cursor: null }));
        return true;
      }
      if (子路径 === 'messages' && method === 'POST') {
        const 键 = 请求.headers()['idempotency-key'] ?? '';
        const 正文 = (body as { content?: string }).content ?? '';
        P7域.sends.push({ role: 角色, key: 键, content: 正文 });
        const 已落库 = (P7域.messages[坐标] ?? []).find((条) => 条.sender_role === 角色 && 条.content === 正文);
        if (已落库) {
          // 同键重放 / 同文重复：幂等服务端只回已落库的那一条，绝不二次追加
          await P7答复(200, 信封(已落库));
          return true;
        }
        const 新消息: P7消息wire形 = {
          message_id: `${4005 + P7域.sends.length}`,
          kind: 'user_text', sender_role: 角色, content: 正文, created_at: '2026-08-30T02:00:00Z',
        };
        (P7域.messages[坐标] ??= []).push(新消息);
        if (P7域.首答未知) {
          P7域.首答未知 = false; // 消息已落库，但把首答替换成 503 结果未知
          await route.fulfill({
            status: 503,
            json: { error: { type: 'operation_outcome_unknown', message: 'The outcome is unknown.' } },
          });
          return true;
        }
        await P7答复(200, 信封(新消息));
        return true;
      }
      if (子路径 === 'read' && method === 'PUT') {
        const through = (body as { read_through_message_id?: string }).read_through_message_id ?? '';
        P7域.reads.push({ role: 角色, through });
        P7域.unread[角色] = 0;
        await P7答复(200, 信封({ read_through_message_id: through }));
        return true;
      }
    }
    if (坐标 !== null && P7域.不存在.includes(坐标)) {
      // foreign / wrong-role / unpublished 统一 404
      await route.fulfill({
        status: 404,
        json: { error: { type: 'conversation_not_found', message: 'The conversation does not exist.', request_id: 'p7-fixture' } },
      });
      return true;
    }
  }

  // ── Spec §11.2/§11.3：会话页三类定向补读（同 Case 详情 / canonical 岗位 / 公开企业）
  //    与授权简历 PDF 内容。P7 旅程自包含作答；其它域 fixture 在场时按统一分发顺序
  //    先行应答（本段只兜 P7-only 安装）。候选端 Case 详情走聚合 alias
  //   （me/negotiations，case_detail 投影 P5详情）。──
  const P7聚合匹配 = /^\/api\/v1\/me\/negotiations\/([^/]+)$/.exec(path);
  if (P7聚合匹配 && method === 'GET') {
    const 坐标 = decodeURIComponent(P7聚合匹配[1]!);
    const r = P7域.连续记录?.[坐标];
    const c = r?.caseId !== null && r !== undefined ? P7域.case们?.[r.caseId!] : undefined;
    if (!r || !c) {
      await route.fulfill({
        status: 404,
        json: { error: { type: 'negotiation_not_found', message: '记录不存在', request_id: 'p7-fixture' } },
      });
      return true;
    }
    await P7答复(200, 信封(P5连续详情wire(P7域.case们 ?? {}, r)));
    return true;
  }
  const P7案例匹配 = /^\/api\/v1\/(me|recruiter)\/match-cases\/([^/]+)$/.exec(path);
  if (P7案例匹配 && method === 'GET') {
    const 角色: P7角色词 = P7案例匹配[1] === 'me' ? 'candidate' : 'recruiter';
    const c = P7域.case们?.[decodeURIComponent(P7案例匹配[2]!)];
    if (!c) {
      await route.fulfill({
        status: 404,
        json: { error: { type: 'match_case_not_found', message: 'Case 不存在', request_id: 'p7-fixture' } },
      });
      return true;
    }
    await P7答复(200, 信封(P5详情wire(c, 角色)));
    return true;
  }
  const P7内容匹配 = /^\/api\/v1\/(me|recruiter)\/match-cases\/([^/]+)\/resume-submission\/content$/.exec(path);
  if (P7内容匹配 && method === 'GET') {
    const c = P7域.case们?.[decodeURIComponent(P7内容匹配[2]!)];
    if (!c || !c.已披露) {
      await P7答复(409, { error: { type: 'resume_submission_not_allowed', message: '简历尚未披露' } });
      return true;
    }
    await route.fulfill({
      status: 200,
      body: Buffer.from('%PDF-1.7\nP7 fixture raw resume\n'),
      contentType: 'application/pdf',
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'attachment; filename="P7-Fixture-简历.pdf"',
      },
    });
    return true;
  }
  const P7岗位匹配 = /^\/api\/v1\/jobs\/([^/]+)$/.exec(path);
  if (P7岗位匹配 && method === 'GET') {
    const 岗 = P7域.岗位?.[decodeURIComponent(P7岗位匹配[1]!)];
    if (!岗) {
      await route.fulfill({
        status: 404,
        json: { error: { type: 'job_not_found', message: '岗位不存在', request_id: 'p7-fixture' } },
      });
      return true;
    }
    await P7答复(200, 信封(JSON.parse(JSON.stringify(岗))));
    return true;
  }
  const P7企业匹配 = /^\/api\/v1\/organizations\/([^/]+)$/.exec(path);
  if (P7企业匹配 && method === 'GET') {
    const 编号 = decodeURIComponent(P7企业匹配[1]!);
    const 名称 = P7域.企业?.[编号];
    if (名称 === undefined) {
      await route.fulfill({
        status: 404,
        json: { error: { type: 'organization_not_found', message: '企业不存在', request_id: 'p7-fixture' } },
      });
      return true;
    }
    await P7答复(200, 信封({
      organization_id: 编号,
      legal_name: null,
      display_name: 名称,
      verified_at: null,
      profile: { ...P1C企业档案(), display_name: 名称 },
      active_verified_job_count: 0,
    }));
    return true;
  }
  return false;
}
