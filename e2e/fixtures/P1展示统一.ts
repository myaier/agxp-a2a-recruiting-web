// e2e/fixtures/P1展示统一.ts
// P1 Backend展示 的最小 path+method 白名单 HTTP fixture（仅测试使用）。
//
// 与 e2e/数据源模式.spec.ts 的边界：该文件禁改、禁 import（会触发整套测试注册）。
// 这里只复制其 P4/P7 场景已验证的 wire 值语义（信封 / CandidateJob / 会话项 / 简历 /
// 意向 / 隐私 / 附件空库），不复制它的全域状态机、multipart 处理与任何 test 注册。
//
// 白名单纪律（brief 第 1 条）：
//   · 只应答本任务需要的 path+method：应用启动必要的会话/主体/简历/意向/隐私/附件库/
//     账号档案/Agent 规则与 MatchCase 空页水合 + 本任务的岗位/推荐/会话读取；
//   · 未知 API 一律记录并返回受控 503 错误，绝不放行真实网络，也绝不泛化所有 GET 成功；
//   · 标记值（P1FIX 前缀）只存在于 fixture，断言页面展示它们即证明渲染来自 HTTP 而非 Mock；
//   · 双栈同文对照场景（交易中台架构师 / 美团 / 梁思远）刻意与 Mock 基准同文，
//     证据靠请求序列（渲染前必先有对应 GET），不靠文本本身。
//
// 「错误带缓存」用读数相位机（不用测试端翻转开关）：会话列表无游标 GET 第 1–2 次
// 返回缓存行、第 3 次返回 500（错误行 + 缓存行共存）、第 4 次起返回合法空页（刷新为空）。
// 主壳首屏非 force 水合 + 进消息 Tab 的 force 刷新恰好是前两次（StrictMode 双挂载由
// 操作层读锁单飞收敛为一次），后续两次都是「重试」按钮触发 —— 相位确定，不靠重跑碰运气。

import type { Page, Route } from '@playwright/test';

export type P1角色 = 'candidate' | 'recruiter';
export type P1场景名 = '完整' | '缺失' | '长文' | '错误带缓存';

export interface P1请求记录 {
  method: string;
  path: string;
  body: unknown;
}

export interface P1路由结果 {
  /** 本页全部 /api/v1 请求（含白名单外被拒的）：断言请求序列与未知 API 为零用 */
  请求: P1请求记录[];
}

// ── 编号（与既有 fixture 同族：int_/job_ + 32 hex，会话坐标十进制）──────────────
const 编号 = {
  意向: 'int_00112233445566778899aabbccddee01',
  职位完整: 'job_00112233445566778899aabbccddee01',
  职位零分: 'job_00112233445566778899aabbccddee02',
  职位缺失: 'job_00112233445566778899aabbccddee03',
  职位长文: 'job_00112233445566778899aabbccddee04',
  职位错误: 'job_00112233445566778899aabbccddee05',
  会话甲: '3001',
  会话乙: '3002',
  会话丙: '3003',
  会话丁: '3004',
  会话长标题: '3005',
  会话长副标题: '3006',
  消息甲一: '4001',
  消息甲二: '4004',
} as const;

// ── 标记值（只存在于 fixture；双栈同文对照的三个文本与 Mock 基准逐字一致）─────────
const 标记 = {
  同文职位: '交易中台架构师',
  同文薪资下: 60,
  同文薪资上: 80,
  同文公司: '美团',
  同文发布人: '梁思远',
  专有职位: 'P1FIX 缺口补齐工程师',
  专有公司: 'P1FIX 星河科技',
  专有发布人: 'P1FIX 招聘负责人',
  专有摘要: 'P1FIX 摘要：可以，下午三点见',
  长标题: '测'.repeat(80),
  长副标题: 'P1FIX 长副标题：'.repeat(6),
  长摘要: 'P1FIX 长摘要，反复补充同一句占位正文以确保单行截断生效。'.repeat(3),
  长正文段落们: Array.from({ length: 6 }, (_, 序) =>
    `P1FIX 长文段落 ${序 + 1}：负责跨端展示统一回归的占位正文，逐行验证如实上屏。`),
} as const;

const 时间戳 = '2026-08-30T10:46:00Z';

function 信封<T>(result: T): { result: T; meta: { request_id: string; api_version: 'v1' } } {
  return { result, meta: { request_id: 'p1-fixture-req', api_version: 'v1' } };
}

// ── 启动水合的最小合法载荷（值语义照抄 数据源模式.spec.ts 已验证 fixture）──────────

function 主体(role: P1角色) {
  return {
    subject_id: 'subj-p1-fixture-001',
    roles: [{ role, status: 'active' }],
    last_used_role: role,
  };
}

const 简历 = {
  profile: {
    real_name: 'P1FIX 候选人',
    work_start_year: 2019,
    status: 'employed',
    current_education: null,
    graduation_year: null,
    gender: null,
    birth_year: null,
    birth_month: null,
  },
  profile_revision: 1,
  summary: 'P1FIX 个人优势标记',
  summary_revision: 1,
  skills: ['Go', '分布式事务'],
  skills_revision: 1,
  experiences: [],
  educations: [],
  certificates: [],
  aggregate_revision: 1,
};

const 意向 = {
  intention_id: 编号.意向,
  recruitment_type: 'social_full_time',
  job_category: { id: 'job-fixture-p1', display_name: '后端工程师' },
  primary_location: { id: 'loc-fixture-p1', display_name: 'P1FIX 市' },
  alternate_locations: [],
  industries: [],
  workplace_modes: ['onsite'],
  compensation: { mode: 'range', lower: 30, upper: 50, annual_salary_months: 15 },
  salary_period: 'month',
  graduation_month: null,
  internship_months: null,
  onsite_days_per_week: null,
  exclusions: {
    alternate_weekend_work: 'unspecified',
    outsourcing_only: 'unspecified',
    onsite_only: 'unspecified',
    frequent_travel: 'unspecified',
  },
  private_preferences: '',
  status: 'active',
  revision: 1,
  created_at: 时间戳,
  updated_at: 时间戳,
};

const 隐私 = {
  employer_privacy_enabled: true,
  disclosure_preferences: {
    current_employer: 'never',
    education: 'resume_submission',
    portfolio_links: 'anonymous',
  },
  organization_blocks: [],
  revision: 1,
  updated_at: 时间戳,
};

const 附件空库 = {
  items: [],
  limits: { max_files: 3, max_file_bytes: 10_485_760, accepted_media_types: ['application/pdf'] },
};

const 账号档案 = { avatar_url: null, revision: 0, updated_at: null };

const MatchCase摘要零 = {
  open_total: 0,
  open_anonymous_screening_total: 0,
  open_needs_action_total: 0,
  ended_total: 0,
  completed_total: 0,
};

// ── P4 CandidateJob / 候选推荐卡（wire 键集与 数据源模式.spec.ts 同构）─────────────

interface P1CandidateJob形 {
  job_id: string;
  publisher_verification_status: string;
  hiring_organization_verification_status: string;
  hiring_organization_claim: { display_name: string; legal_name: string | null };
  title: string;
  recruitment_type: 'social_full_time';
  category: { id: string; display_name: string };
  location: { id: string; display_name: string };
  office_location: string;
  workplace_mode: 'hybrid';
  salary_lower: number;
  salary_upper: number;
  salary_period: 'month';
  annual_salary_months: number | null;
  campus_cohort: null;
  internship_months: null;
  onsite_days_per_week: null;
  experience_requirement: 'three_to_five_years';
  education_requirement: 'bachelor';
  structured_requirements_confirmed: boolean;
  hard_requirements: Record<string, 'unknown'>;
  description: string;
  requirements: string;
  keywords: string[];
  status: 'active';
  revision: number;
  published_at: string;
  created_at: string;
  updated_at: string;
  publisher_organization_ref?: string;
  hiring_organization_ref?: string;
  publisher_profile?: { public_name: string; title: string; personal_verification_status: string };
}

function P1岗位(job_id: string, 覆盖: Partial<P1CandidateJob形> = {}): P1CandidateJob形 {
  return {
    job_id,
    publisher_verification_status: 'verified',
    hiring_organization_verification_status: 'verified',
    hiring_organization_claim: { display_name: 标记.同文公司, legal_name: null },
    title: 标记.同文职位,
    recruitment_type: 'social_full_time',
    category: { id: 'job-fixture-p1', display_name: '后端工程师' },
    location: { id: 'loc-fixture-p1', display_name: 'P1FIX 市' },
    office_location: 'P1FIX 市 Fixture 路 8 号',
    workplace_mode: 'hybrid',
    salary_lower: 标记.同文薪资下,
    salary_upper: 标记.同文薪资上,
    salary_period: 'month',
    annual_salary_months: null,
    campus_cohort: null,
    internship_months: null,
    onsite_days_per_week: null,
    experience_requirement: 'three_to_five_years',
    education_requirement: 'bachelor',
    structured_requirements_confirmed: true,
    hard_requirements: {
      alternate_weekend_work: 'unknown',
      outsourcing_only: 'unknown',
      onsite_only: 'unknown',
      frequent_travel: 'unknown',
    },
    description: 'P1FIX 岗位描述：负责跨端展示统一回归。\n参与高可用架构设计。',
    requirements: 'P1FIX 岗位要求：熟悉分布式一致性。\n有大规模系统经验。',
    keywords: ['P1FIX'],
    status: 'active',
    revision: 1,
    published_at: 时间戳,
    created_at: 时间戳,
    updated_at: 时间戳,
    publisher_organization_ref: 'org-fixture-p1',
    hiring_organization_ref: 'org-fixture-p1',
    publisher_profile: {
      public_name: 标记.同文发布人,
      title: '招聘负责人',
      personal_verification_status: 'verified',
    },
    ...覆盖,
  };
}

interface P1候选卡形 {
  recommendation_id: string;
  batch_id: string;
  intention_id: string;
  rank: number;
  match_score: number;
  match_reasons: string[];
  state: 'available';
  structured_requirements_confirmed: boolean;
  job: P1CandidateJob形;
  delegation: null;
}

function P1推荐卡(job: P1CandidateJob形, match_score: number, 覆盖: Partial<P1候选卡形> = {}): P1候选卡形 {
  return {
    recommendation_id: `rec_${job.job_id.slice(-2)}`,
    batch_id: 'bat_p1fixture_c1',
    intention_id: 编号.意向,
    rank: 1,
    match_score,
    match_reasons: ['direction_match', 'compensation_overlap'],
    state: 'available',
    structured_requirements_confirmed: true,
    job,
    delegation: null,
    ...覆盖,
  };
}

// ── P7 会话项 / 消息（wire 键集与 数据源模式.spec.ts 同构）────────────────────────

interface P1会话项形 {
  conversation_id: string;
  case_id: string;
  kind: 'human_handoff';
  last_message: { message_id: string; sender_role: 'candidate' | 'recruiter'; preview: string; created_at: string } | null;
  last_activity_at: string;
  unread_count: number;
  context_status: 'available' | 'unavailable';
  context?: { primary_label: string; secondary_label: string; job_ref?: string; resume_ref?: string } | null;
}

function P1会话项(
  conversation_id: string,
  选项: { 未读?: number; 摘要?: string | null; 无上下文?: boolean; 时间?: string } = {},
): P1会话项形 {
  const 上下文不可用 = 选项.无上下文 === true;
  const 条: P1会话项形 = {
    conversation_id,
    case_id: 'mc_p1_000000000000000000000001',
    kind: 'human_handoff',
    last_message: 选项.摘要 === null
      ? null
      : {
        message_id: 编号.消息甲二,
        sender_role: 'recruiter',
        preview: 选项.摘要 ?? 标记.专有摘要,
        created_at: 选项.时间 ?? 时间戳,
      },
    last_activity_at: 选项.时间 ?? 时间戳,
    unread_count: 选项.未读 ?? 0,
    context_status: 上下文不可用 ? 'unavailable' : 'available',
  };
  if (!上下文不可用) {
    条.context = {
      primary_label: `P1FIX 职位 ${conversation_id}`,
      secondary_label: 'P1FIX 市',
      job_ref: 编号.职位完整,
      resume_ref: 'rf_00112233445566778899aabbccddee01',
    };
  }
  return 条;
}

interface P1消息形 {
  message_id: string;
  kind: 'user_text';
  sender_role: 'candidate' | 'recruiter';
  content: string;
  created_at: string;
}

// ── 每个场景的 fixture 内容 ──────────────────────────────────────────────────────

interface P1场景fixture {
  岗位: Record<string, P1CandidateJob形>;
  推荐卡: P1候选卡形[];
  /** 无游标会话列表第 N 次读取（1 起）的应答；null = 500 受控错误 */
  会话页: (读数: number) => { items: P1会话项形[]; next_cursor: string | null } | null;
  /** 带游标会话列表应答（游标原文 → 页） */
  会话页按游标: Record<string, { items: P1会话项形[]; next_cursor: string | null }>;
  会话消息: Record<string, P1消息形[]>;
  /** canonical job GET 一律 500（失败不正常占位场景） */
  岗位GET错误: boolean;
}

function 会话消息甲(): P1消息形[] {
  return [
    { message_id: 编号.消息甲一, kind: 'user_text', sender_role: 'candidate', content: 'P1FIX 候选：想约明天下午聊聊', created_at: '2026-08-30T01:00:00Z' },
    { message_id: 编号.消息甲二, kind: 'user_text', sender_role: 'recruiter', content: 'P1FIX 招聘：可以，下午三点见', created_at: '2026-08-30T02:00:00Z' },
  ];
}

function 场景fixture(场景: P1场景名): P1场景fixture {
  if (场景 === '完整') {
    // 双栈同文对照：同文岗位 + 两条同文长度的会话行（后一条在游标第二页，顺带覆盖分页）
    const 同文会话 = P1会话项(编号.会话甲, { 摘要: '新建岗，产品这边你是第一个，配 6 个工程师', 时间: '2026-08-30T10:46:00Z' });
    同文会话.context = { primary_label: '陆知遥', secondary_label: 'MiniMax · 直聊中 · 未走AI代理', job_ref: 编号.职位完整, resume_ref: 'rf_00112233445566778899aabbccddee01' };
    const 同文会话乙 = P1会话项(编号.会话乙, { 摘要: '收到！面试官是邵铭 + 架构评审组，流程约 90 分钟', 时间: '2026-08-29T09:30:00Z' });
    同文会话乙.context = { primary_label: '林筱', secondary_label: '铨衡人才 · 意向已确认 · 真人沟通', job_ref: 编号.职位完整, resume_ref: 'rf_00112233445566778899aabbccddee01' };
    const 未读会话 = P1会话项(编号.会话丙, { 未读: 2, 摘要: 'P1FIX 摘要：第二页会话', 时间: '2026-08-28T08:00:00Z' });
    return {
      岗位: {
        [编号.职位完整]: P1岗位(编号.职位完整),
        [编号.职位零分]: P1岗位(编号.职位零分),
      },
      推荐卡: [
        P1推荐卡(P1岗位(编号.职位完整), 92),
        P1推荐卡(P1岗位(编号.职位零分), 0),
      ],
      会话页: () => ({ items: [同文会话, 同文会话乙], next_cursor: 'p1page2' }),
      会话页按游标: { p1page2: { items: [未读会话], next_cursor: null } },
      会话消息: { [编号.会话甲]: 会话消息甲(), [编号.会话乙]: [], [编号.会话丙]: [] },
      岗位GET错误: false,
    };
  }
  if (场景 === '缺失') {
    // 缺失：发布人缺席 / 组织 ref 缺席 / JD 合法空正文 / 会话无上下文、无 lastMessage、未读 0
    const 缺失岗位 = P1岗位(编号.职位缺失, {
      title: 标记.专有职位,
      hiring_organization_claim: { display_name: 标记.专有公司, legal_name: null },
      publisher_profile: undefined,
      publisher_organization_ref: undefined,
      hiring_organization_ref: undefined,
      description: '   ',
      requirements: '',
    });
    return {
      岗位: { [编号.职位缺失]: 缺失岗位 },
      推荐卡: [],
      会话页: () => ({
        items: [
          P1会话项(编号.会话甲, { 无上下文: true }),
          P1会话项(编号.会话乙, { 摘要: null }),
          P1会话项(编号.会话丙, { 未读: 3 }),
        ],
        next_cursor: null,
      }),
      会话页按游标: {},
      会话消息: { [编号.会话甲]: 会话消息甲(), [编号.会话乙]: [], [编号.会话丙]: [] },
      岗位GET错误: false,
    };
  }
  if (场景 === '长文') {
    const 长文岗位 = P1岗位(编号.职位长文, {
      title: 标记.长标题,
      description: 标记.长正文段落们.join('\n'),
      requirements: 标记.长正文段落们.slice(0, 3).join('\n'),
    });
    const 长标题会话 = P1会话项(编号.会话长标题, { 摘要: 标记.专有摘要 });
    长标题会话.context = { primary_label: 标记.长标题, secondary_label: 'P1FIX 市', job_ref: 编号.职位长文, resume_ref: 'rf_00112233445566778899aabbccddee01' };
    const 长副标题会话 = P1会话项(编号.会话长副标题, { 摘要: 标记.长摘要 });
    长副标题会话.context = { primary_label: 'P1FIX 正常长度标题', secondary_label: 标记.长副标题, job_ref: 编号.职位长文, resume_ref: 'rf_00112233445566778899aabbccddee01' };
    return {
      岗位: { [编号.职位长文]: 长文岗位 },
      推荐卡: [P1推荐卡(长文岗位, 76)],
      会话页: () => ({ items: [长标题会话, 长副标题会话], next_cursor: null }),
      会话页按游标: {},
      会话消息: { [编号.会话长标题]: 会话消息甲(), [编号.会话长副标题]: [] },
      岗位GET错误: false,
    };
  }
  // 错误带缓存：岗位 GET 一律 500（失败不正常占位）；会话列表按读数相位机走 缓存 → 500 → 空页
  return {
    岗位: {},
    推荐卡: [],
    会话页: (读数) => {
      if (读数 <= 2) {
        return { items: [P1会话项(编号.会话甲, { 未读: 1 }), P1会话项(编号.会话乙)], next_cursor: null };
      }
      if (读数 === 3) return null;
      return { items: [], next_cursor: null };
    },
    会话页按游标: {},
    会话消息: { [编号.会话甲]: 会话消息甲(), [编号.会话乙]: [] },
    岗位GET错误: true,
  };
}

// ── 事件源桩：只拦截 /api/v1/events/live 的 WebSocket，放行 Vite HMR 的原生套接字 ──
// 用普通构造函数（不用 class）：非事件 URL 直接 return new 原生(...)，避免构造器返回值的类型歧义。
async function 安装P1事件桩(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // 测试 seam 只挂到 window，产品 bundle 不含
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const 原生 = (window as any).WebSocket as any;
    // 普通构造函数 + 返回普通对象（不借原生 prototype：原生槽位方法对普通 this 会
    // 抛 Illegal invocation）。非事件 URL 原样放行原生 WebSocket（Vite HMR 不受影响）。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const P1事件桩 = function (url: string | URL, ...其余: unknown[]) {
      const 地址 = String(url);
      if (!地址.includes('/api/v1/events/live')) {
        return new 原生(url, ...其余);
      }
      // 事件桩：构造后下一轮事件循环触发 onopen（handlers 已由 adapter 挂好），零真实连接
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const 桩: any = {
        readyState: 1,
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
        send: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      };
      桩.close = () => {
        if (桩.readyState === 3) return;
        桩.readyState = 3;
        桩.onclose?.();
      };
      setTimeout(() => { if (桩.readyState === 1) 桩.onopen?.(); }, 0);
      return 桩;
    } as unknown as any;
    P1事件桩.CONNECTING = 0;
    P1事件桩.OPEN = 1;
    P1事件桩.CLOSING = 2;
    P1事件桩.CLOSED = 3;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).WebSocket = P1事件桩;
  });
}

// ── 安装路由 ─────────────────────────────────────────────────────────────────────

/**
 * 安装 P1 Backend展示 的白名单 HTTP fixture。仅测试使用；每个测试自装自清理
 * （Playwright 每测试独立 page，route 随 page 生命周期销毁）。
 */
export async function 安装P1路由(
  page: Page,
  options: { role: P1角色; 场景: P1场景名 },
): Promise<P1路由结果> {
  const { role, 场景 } = options;
  const fixture = 场景fixture(场景);
  const 前缀 = role === 'candidate' ? '/api/v1/me' : '/api/v1/recruiter';
  const 记录们: P1请求记录[] = [];
  // 会话列表无游标读数（相位机只用它；带游标的翻页读不推进相位）
  let 会话读数 = 0;

  await 安装P1事件桩(page);

  await page.route('**/api/v1/**', async (route: Route) => {
    const 请求 = route.request();
    const url = new URL(请求.url());
    const path = url.pathname;
    const method = 请求.method();
    const body = method === 'GET' || method === 'DELETE'
      ? null
      : (() => { try { return JSON.parse(请求.postData() ?? '{}'); } catch { return {}; } })();
    记录们.push({ method, path, body });

    const 答 = async (状态: number, json: unknown) => {
      await route.fulfill({ status: 状态, json, headers: { 'Cache-Control': 'no-store' } });
    };

    // ── 会话 / 主体（双端同路）──
    if (path === '/api/v1/session' && method === 'GET') {
      await 答(200, 信封({ identity_id: 'id-p1-fixture', session_id: 'sess-p1-fixture', expires_at: '2026-09-30T00:00:00Z' }));
      return;
    }
    if (path === '/api/v1/me' && method === 'GET') {
      await 答(200, 信封(主体(role)));
      return;
    }

    // ── Agent 规则域空水合（双端；空清单不产生任何规则/提案 UI）──
    if ((path === `${前缀}/agent-rules` || path === `${前缀}/agent-rule-proposals`) && method === 'GET') {
      await 答(200, 信封(path.endsWith('agent-rules') ? { rules: [] } : { proposals: [] }));
      return;
    }

    // ── 候选端启动水合 ──
    if (role === 'candidate') {
      if (path === '/api/v1/me/resume' && method === 'GET') { await 答(200, 信封(简历)); return; }
      if (path === '/api/v1/me/intentions' && method === 'GET') { await 答(200, 信封({ intentions: [意向] })); return; }
      if (path === '/api/v1/me/privacy' && method === 'GET') { await 答(200, 信封(隐私)); return; }
      if (path === '/api/v1/me/resume-files' && method === 'GET') { await 答(200, 信封(附件空库)); return; }
      if (path === '/api/v1/me/account-profile' && method === 'GET') { await 答(200, 信封(账号档案)); return; }
      if (path === '/api/v1/me/match-cases/summary' && method === 'GET') { await 答(200, 信封(MatchCase摘要零)); return; }
      if (path === '/api/v1/me/match-cases' && method === 'GET') { await 答(200, 信封({ items: [], next_cursor: null })); return; }

      // 本任务岗位 / 推荐：列表按意向 scope 一页 + canonical job GET（错误带缓存场景一律 500）
      if (path === '/api/v1/me/job-recommendations' && method === 'GET') {
        await 答(200, 信封({ recommendations: fixture.推荐卡, next_cursor: null }));
        return;
      }
      const 岗位匹配 = /^\/api\/v1\/jobs\/([^/]+)$/.exec(path);
      if (岗位匹配 && method === 'GET') {
        const 岗 = fixture.岗位[decodeURIComponent(岗位匹配[1]!)];
        if (fixture.岗位GET错误 || !岗) {
          await 答(fixture.岗位GET错误 ? 500 : 404, { error: { type: fixture.岗位GET错误 ? 'internal_error' : 'job_not_found', message: 'P1 fixture 固定分支' } });
          return;
        }
        await 答(200, 信封(岗));
        return;
      }
    }

    // ── 招聘端启动水合（组织链 + owner Jobs 空页 + MatchCase 空页）──
    if (role === 'recruiter') {
      if (path === '/api/v1/recruiter/profile' && method === 'GET') {
        await 答(200, 信封({ public_name: 'P1FIX 招聘方', title: '招聘负责人', personal_verification_status: 'unverified', verified_name: null, avatar_url: null, revision: 1 }));
        return;
      }
      if (path === '/api/v1/recruiter/affiliations' && method === 'GET') { await 答(200, 信封({ affiliations: [] })); return; }
      if (path === '/api/v1/recruiter/organization-admin-requests' && method === 'GET') { await 答(200, 信封({ requests: [] })); return; }
      if (path === '/api/v1/recruiter/jobs' && method === 'GET') { await 答(200, 信封({ jobs: [], next_cursor: null })); return; }
      if (path === '/api/v1/recruiter/match-cases/summary' && method === 'GET') { await 答(200, 信封(MatchCase摘要零)); return; }
      if (path === '/api/v1/recruiter/match-cases' && method === 'GET') { await 答(200, 信封({ items: [], next_cursor: null })); return; }
    }

    // ── P7 真人会话（双端同形；错误带缓存场景由读数相位机选择应答）──
    const 会话匹配 = new RegExp(`^${前缀}/conversations(?:/([^/]+))?(?:/(messages|read))?$`).exec(path);
    if (会话匹配) {
      const 坐标 = 会话匹配[1] ?? null;
      const 子路径 = 会话匹配[2] ?? null;
      if (坐标 === null && method === 'GET') {
        if (url.searchParams.get('cursor') === null) {
          会话读数 += 1;
          const 页 = fixture.会话页(会话读数);
          if (页 === null) {
            await 答(500, { error: { type: 'internal_error', message: 'P1 fixture 固定错误分支' } });
            return;
          }
          await 答(200, 信封(页));
          return;
        }
        const 游标 = url.searchParams.get('cursor') ?? '';
        const 页 = fixture.会话页按游标[游标] ?? { items: [], next_cursor: null };
        await 答(200, 信封(页));
        return;
      }
      if (坐标 !== null && 子路径 === null && method === 'GET') {
        const 全部会话 = Object.values(fixture.会话页按游标).flatMap((页) => 页.items);
        const 当前页 = fixture.会话页(1);
        const 条 = (当前页?.items ?? []).find((项) => 项.conversation_id === decodeURIComponent(坐标))
          ?? 全部会话.find((项) => 项.conversation_id === decodeURIComponent(坐标));
        if (!条) {
          await 答(404, { error: { type: 'conversation_not_found', message: 'P1 fixture 会话不存在' } });
          return;
        }
        await 答(200, 信封(条));
        return;
      }
      if (坐标 !== null && 子路径 === 'messages' && method === 'GET') {
        await 答(200, 信封({ messages: fixture.会话消息[decodeURIComponent(坐标)] ?? [], next_cursor: null }));
        return;
      }
      if (坐标 !== null && 子路径 === 'read' && method === 'PUT') {
        await 答(200, 信封({ read_through_message_id: (body as { read_through_message_id?: string }).read_through_message_id ?? '' }));
        return;
      }
    }

    // ── 白名单外：记录 + 受控错误，绝不放行真实网络 ──
    await 答(503, { error: { type: 'p1_fixture_unknown_api', message: `P1 fixture 白名单外请求：${method} ${path}` } });
  });

  return { 请求: 记录们 };
}