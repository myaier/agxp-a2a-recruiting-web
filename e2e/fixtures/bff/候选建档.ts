// e2e/fixtures/bff/候选建档.ts
// 候选 onboarding 可变 fixture（C2）：注册流起点的主体/简历/意向状态、目录展示映射
// 与每个写入端点的闭合键集断言，从 e2e/数据源模式.spec.ts 原样迁出。
// 可变状态归每次 安装BFF路由 所有。

import { expect } from '@playwright/test';
import type { BFF简历, BFFOwnerIntention } from '../../../src/数据/BFF契约';
import { fixture简历, 标记 } from './账号与目录';
import { P4深克隆 } from './发现推荐';
import { 信封, type 路由上下文形, 断言闭合键集, 断言精确键集 } from './协议';
import type { 招聘方OnboardingFixture形, P1C招聘组织Fixture形 } from './招聘组织';
import type { P3隐私fixture形 } from './隐私与实名';

// ── 候选 onboarding 可变 fixture ──

// ─────────────────────────────────────────────────────────────────────────────
// 候选 onboarding 可变 fixture（Task 8）。证明 Tasks 1–7 修完后的整条 Backend 写链：
//   · 深克隆既有静态 fixture简历 的信封形状（绝不共享状态），profile / summary / skills /
//     experiences / educations / certificates 全部清空成「从未写入过」的注册流起点；
//   · 主体 last_used_role 从 null 起步：会话恢复落身份选择页，从 我要找工作 走完整注册流，
//     角色写入推进它，reload 后直接进主壳；
//   · 每个 mutation 严格闭合校验（Object.keys(body).sort() 对照允许键集 + 必含键在内），
//     未知字段一律拒收；证书 body 必须显式带 year（null 或 1900–2100 整数）；
//   · 受理的 mutation 记录 { method, path, body }、只写本 fixture、推进对应 revision，
//     之后所有 GET 一律回更新后的快照（year: null 原样保留，绝不编造年份）；
//   · 读取计数（resume / intentions）证明 reload 走的是权威重读而非本地状态。
// 只在 选项.候选OnboardingFixture 在场时接管这些路由 —— 既有 Backend 用例的静态
// fixture简历 路由一个字都不动。这只是前端拦截边界上的 wire 行为验证，不是真实
// BFF 联调（真实服务从不被启动、修改或验证）；真实联调仍以 Recruitment/BFF 的
// nullable year 契约基线为前置。
// ─────────────────────────────────────────────────────────────────────────────

export type 记录的Mutation = { method: string; path: string; body: unknown };

/** 候选 onboarding 可变 fixture：测试自持一份，安装路由后 handler 与测试共享同一对象 */
export interface 候选OnboardingFixture {
  /** 本 fixture 专属主体：last_used_role 起步 null（落身份选择页），角色写入推进它 */
  主体: { subject_id: string; roles: { role: 'candidate' | 'recruiter'; status: 'active' }[]; last_used_role: 'candidate' | 'recruiter' | null };
  resume: BFF简历;
  intentions: BFFOwnerIntention[];
  mutations: 记录的Mutation[];
  /** GET 计数：reload 后必须重新 GET 简历与意向（权威重读，不沿用本地状态） */
  读取: { 简历: number; 意向: number };
  /** 简历域请求序列（含分区写入与 GET）：断言保存以最终权威 GET 收尾 */
  简历请求: { method: string; path: string }[];
  /** stg 契约对齐 2026-09-14：me/onboarding 的完成状态（null 起步，POST complete 推进） */
  完成: { candidate: string | null; recruiter: string | null };
}

/** 只存在于本 fixture 的标记值（区别于 P8标记.手机掩码 与 既有静态 fixture 的编号） */
export const Onboarding标记 = {
  主体: 'subj-fixture-onboarding-001',
  手机掩码: '+86 136 **** 7725',
  意向编号: 'int_00112233445566778899aabbccddeef0',
} as const;

/** 目录 ID → 展示名：写入 body 只带选择 ID，权威应答里的 display_name 从这里补 */
export const Onboarding目录展示: Record<string, string> = {
  'loc-fixture-001': 标记.城市display,
  'job-fixture-001': 标记.职位display,
  'ind-fixture-001': 'Fixture 行业',
  // 简历行业 @backend 用例自建行业目录的孙叶子：权威快照回读要带显示名 ——
  // 空显示名会让 重入后的经历段 被 保存简历 的「不完整条目跳过」守卫拦下（零写入）
  'ind_leaf_bank': '银行支付',
  'inst-fixture-001': 标记.学校display,
  'major-fixture-001': 'Fixture 专业',
};

/**
 * 深克隆静态 fixture简历 的信封形状后整体清空内容（注册流起点）。
 * 用既有的 P4深克隆 做深拷贝：Playwright 的 TS 转译目标不保证 structuredClone，
 * 且这里只需要纯 JSON 数据的独立副本 —— 与静态 fixture简历 不共享任何可变状态。
 */
export function 创建候选OnboardingFixture(): 候选OnboardingFixture {
  return {
    主体: {
      subject_id: Onboarding标记.主体,
      roles: [{ role: 'candidate', status: 'active' }],
      last_used_role: null,
    },
    resume: {
      ...(P4深克隆(fixture简历) as BFF简历),
      profile: {
        real_name: '',
        work_start_year: null,
        status: '',
        current_education: null,
        graduation_year: null,
        gender: null,
        birth_year: null,
        birth_month: null,
      },
      summary: '',
      skills: [],
      experiences: [],
      educations: [],
      certificates: [],
    },
    intentions: [],
    mutations: [],
    读取: { 简历: 0, 意向: 0 },
    简历请求: [],
    完成: { candidate: null, recruiter: null },
  };
}

// ── 候选 onboarding 写入契约断言 ──

/** 证书写入：year 必须显式在场（不是缺属性），值只能是 null 或 1900–2100 整数 */
export function 断言证书写入(body: unknown): asserts body is { name: string; year: number | null } {
  expect(body).toBeTruthy();
  expect(Object.keys(body as object).sort()).toEqual(['name', 'year']);
  const value = body as { name: unknown; year: unknown };
  expect(typeof value.name).toBe('string');
  expect(Object.prototype.hasOwnProperty.call(value, 'year')).toBe(true);
  expect(value.year === null || (
    Number.isInteger(value.year) && Number(value.year) >= 1900 && Number(value.year) <= 2100
  )).toBe(true);
}

/** 资料（profile）分区写入：八键全量替换，status 只认三个后端档位。
 *  Task 1（core editors §6.1）：portfolio_url 是合同内的三态可选键 —— 缺席 = 保留已存
 *  URL，null = 明确清空，非空字符串 = 替换（^https?://[^\s]+$，≤2048 码点）。 */
export function 断言资料写入(body: unknown): asserts body is {
  real_name: string;
  work_start_year: number | null;
  status: 'student' | 'employed' | 'unemployed';
  current_education: string | null;
  graduation_year: number | null;
  gender: 'male' | 'female' | null;
  birth_year: number | null;
  birth_month: number | null;
  portfolio_url?: string | null;
} {
  断言闭合键集(body, ['real_name', 'work_start_year', 'status', 'current_education', 'graduation_year', 'gender', 'birth_year', 'birth_month', 'portfolio_url'], ['real_name', 'work_start_year', 'status', 'current_education', 'graduation_year', 'gender', 'birth_year', 'birth_month']);
  const 写 = body as Record<string, unknown>;
  expect(typeof 写.real_name).toBe('string');
  expect(写.work_start_year === null || Number.isInteger(写.work_start_year)).toBe(true);
  expect(['student', 'employed', 'unemployed']).toContain(写.status);
  expect(写.current_education === null || typeof 写.current_education === 'string').toBe(true);
  expect(写.graduation_year === null || Number.isInteger(写.graduation_year)).toBe(true);
  expect(写.gender === null || ['male', 'female'].includes(写.gender as string)).toBe(true);
  expect(写.birth_year === null || Number.isInteger(写.birth_year)).toBe(true);
  expect(写.birth_month === null || Number.isInteger(写.birth_month)).toBe(true);
  if (Object.prototype.hasOwnProperty.call(写, 'portfolio_url')) {
    expect(
      写.portfolio_url === null
        || (typeof 写.portfolio_url === 'string'
          && /^https?:\/\/\S+$/.test(写.portfolio_url)
          && [...写.portfolio_url].length <= 2048),
    ).toBe(true);
  }
}

/** 个人优势（summary）分区写入：单键 value */
export function 断言摘要写入(body: unknown): asserts body is { value: string } {
  断言精确键集(body, ['value']);
  expect(typeof (body as { value: unknown }).value).toBe('string');
}

/** 技能分区写入：单键 skills，数组里必须全是非常字符串 */
export function 断言技能写入(body: unknown): asserts body is { skills: string[] } {
  断言精确键集(body, ['skills']);
  const 写 = body as { skills: unknown };
  expect(Array.isArray(写.skills)).toBe(true);
  expect((写.skills as unknown[]).every((项) => typeof 项 === 'string' && 项 !== '')).toBe(true);
}

/** 经历写入：company / industry_id / title / start_month 必填，其余可选 */
export function 断言经历写入(body: unknown): asserts body is {
  organization_id: string;
  industry_id: string;
  title: string;
  start_month: string;
  end_month?: string | null;
  description?: string;
  hidden?: boolean;
  internship?: boolean;
} {
  // 合同 C（2026-09-13）：organization_id 是唯一企业坐标，company 键退役 wire 不收
  断言闭合键集(body, ['organization_id', 'industry_id', 'title', 'start_month', 'end_month', 'description', 'hidden', 'internship'], ['organization_id', 'industry_id', 'title', 'start_month']);
  const 写 = body as Record<string, unknown>;
  expect(typeof 写.organization_id).toBe('string');
  expect(写.organization_id).not.toBe('');
  expect(typeof 写.industry_id).toBe('string');
  expect(typeof 写.title).toBe('string');
  expect(typeof 写.start_month).toBe('string');
  if ('end_month' in 写) expect(写.end_month === null || typeof 写.end_month === 'string').toBe(true);
  if ('description' in 写) expect(typeof 写.description).toBe('string');
  if ('hidden' in 写) expect(typeof 写.hidden).toBe('boolean');
  if ('internship' in 写) expect(typeof 写.internship).toBe('boolean');
}

/** 教育写入：institution_id / degree / major_id / start_month 必填，end_month 可选 */
export function 断言教育写入(body: unknown): asserts body is {
  institution_id: string;
  degree: string;
  major_id: string;
  start_month: string;
  end_month?: string | null;
} {
  断言闭合键集(body, ['institution_id', 'degree', 'major_id', 'start_month', 'end_month'], ['institution_id', 'degree', 'major_id', 'start_month']);
  const 写 = body as Record<string, unknown>;
  expect(typeof 写.institution_id).toBe('string');
  expect(typeof 写.degree).toBe('string');
  expect(typeof 写.major_id).toBe('string');
  expect(typeof 写.start_month).toBe('string');
  if ('end_month' in 写) expect(写.end_month === null || typeof 写.end_month === 'string').toBe(true);
}

/** 意向写入：BFF意向写入 的十二键闭合契约（compensation / exclusions 子键同样闭合） */
export function 断言意向写入(body: unknown): asserts body is {
  recruitment_type: 'social_full_time' | 'campus' | 'internship' | 'part_time';
  job_category_id: string;
  primary_location_id: string;
  alternate_location_ids: string[];
  industry_ids: string[];
  workplace_modes: ('onsite' | 'hybrid' | 'remote')[];
  compensation: { mode: 'range' | 'negotiable'; lower?: number | null; upper?: number | null; annual_salary_months?: number | null };
  graduation_month: string | null;
  internship_months: number | null;
  onsite_days_per_week: number | null;
  exclusions: Record<'alternate_weekend_work' | 'outsourcing_only' | 'onsite_only' | 'frequent_travel', 'allowed' | 'excluded' | 'unspecified'>;
  private_preferences: string;
} {
  断言精确键集(body, ['recruitment_type', 'job_category_id', 'primary_location_id', 'alternate_location_ids', 'industry_ids', 'workplace_modes', 'compensation', 'graduation_month', 'internship_months', 'onsite_days_per_week', 'exclusions', 'private_preferences']);
  const 写 = body as Record<string, unknown> & { compensation: Record<string, unknown>; exclusions: Record<string, unknown> };
  expect(['social_full_time', 'campus', 'internship', 'part_time']).toContain(写.recruitment_type);
  expect(typeof 写.job_category_id).toBe('string');
  expect(typeof 写.primary_location_id).toBe('string');
  expect(Array.isArray(写.alternate_location_ids)).toBe(true);
  expect(Array.isArray(写.industry_ids)).toBe(true);
  expect(Array.isArray(写.workplace_modes)).toBe(true);
  expect((写.workplace_modes as string[]).every((值) => ['onsite', 'hybrid', 'remote'].includes(值))).toBe(true);
  断言闭合键集(写.compensation, ['mode', 'lower', 'upper', 'annual_salary_months'], ['mode']);
  expect(['range', 'negotiable']).toContain(写.compensation.mode);
  断言精确键集(写.exclusions, ['alternate_weekend_work', 'outsourcing_only', 'onsite_only', 'frequent_travel']);
  expect(Object.values(写.exclusions).every((值) => ['allowed', 'excluded', 'unspecified'].includes(值 as string))).toBe(true);
  expect(写.graduation_month === null || typeof 写.graduation_month === 'string').toBe(true);
  expect(写.internship_months === null || Number.isInteger(写.internship_months)).toBe(true);
  expect(写.onsite_days_per_week === null || Number.isInteger(写.onsite_days_per_week)).toBe(true);
  expect(typeof 写.private_preferences).toBe('string');
}


// ── 路由 handler（C2 阶段二迁入；返回是否已应答，由 安装BFF路由 按固定顺序调用）──

export async function 处理候选建档域(
  Onboarding域: 候选OnboardingFixture | null,
  组织fixture: P1C招聘组织Fixture形 | 招聘方OnboardingFixture形 | null,
  P3域: P3隐私fixture形 | null,
  上下文: 路由上下文形,
): Promise<boolean> {
  if (Onboarding域 === null) return false;
  const { route, path, method, body } = 上下文;

  // ── 候选 onboarding 可变 fixture（Task 8）：只在选项在场时接管；每个写入都过
  //    闭合键集校验（未知字段拒收），受理后记录 { method, path, body }、只写本
  //    fixture、推进 revision，之后所有 GET 回更新后的快照 ──
  const 记变更 = (路径: string) => {
    Onboarding域.mutations.push({ method, path: 路径, body });
  };
  const 答简历 = async () => {
    await route.fulfill({ status: 200, json: 信封(P4深克隆(Onboarding域.resume)) });
  };
  // company 是服务端冻结的展示快照（合同 C）：按 organization_id 从既有组织目录
  //（招聘组织 fixture + 隐私搜索池）反查 display_name 冻结进快照（真实 BFF 同语义，
  // src/数据/后端映射.ts 转经历 注释）；无 organization_id 维持空串
  const 经历企业展示名 = (编号: string | undefined): string =>
    编号 !== undefined && 编号 !== ''
      ? 组织fixture?.organizations[编号]?.display_name
        ?? P3域?.组织库[编号]?.display_name
        ?? ''
      : '';

  // 主体：last_used_role 从 null 起步（会话恢复落身份选择页），角色写入推进它
  if (path === '/api/v1/me' && method === 'GET') {
    await route.fulfill({ status: 200, json: 信封(P4深克隆(Onboarding域.主体)) });
    return true;
  }
  // stg 契约对齐 2026-09-14：onboarding 状态只列本 fixture 实际角色，完成由 POST 推进
  if (path === '/api/v1/me/onboarding' && method === 'GET') {
    await route.fulfill({
      status: 200,
      json: 信封({
        roles: Onboarding域.主体.roles.map((行) => ({
          role: 行.role,
          status: 'active' as const,
          completed_at: Onboarding域.完成[行.role],
        })),
      }),
    });
    return true;
  }
  const Onboarding完成写 = /^\/api\/v1\/me\/onboarding\/(candidate|recruiter)\/complete$/.exec(path);
  if (Onboarding完成写 && method === 'POST') {
    断言精确键集(body, []); // complete：body 精确 {}
    记变更(path);
    const role = Onboarding完成写[1] as 'candidate' | 'recruiter';
    Onboarding域.完成[role] ??= '2026-09-14T08:00:00Z'; // 首次与重试同一时间
    await route.fulfill({
      status: 200,
      json: 信封({ role, status: 'active', completed_at: Onboarding域.完成[role] }),
    });
    return true;
  }
  const Onboarding角色写 = /^\/api\/v1\/me\/roles\/(candidate|recruiter)$/.exec(path);
  if (Onboarding角色写 && method === 'PUT') {
    断言精确键集(body, []); // 确保角色：body 精确 {}
    记变更(path);
    if (!Onboarding域.主体.roles.some((行) => 行.role === Onboarding角色写[1])) {
      Onboarding域.主体.roles.push({ role: Onboarding角色写[1] as 'candidate' | 'recruiter', status: 'active' });
    }
    await route.fulfill({ status: 200, json: 信封(P4深克隆(Onboarding域.主体)) });
    return true;
  }
  if (path === '/api/v1/me/preferences/last-used-role' && method === 'PUT') {
    断言精确键集(body, ['role']);
    expect(['candidate', 'recruiter']).toContain((body as { role: string }).role);
    记变更(path);
    Onboarding域.主体.last_used_role = (body as { role: 'candidate' | 'recruiter' }).role;
    await route.fulfill({ status: 200, json: 信封(P4深克隆(Onboarding域.主体)) });
    return true;
  }

  // 简历域读取：权威快照永远来自本 fixture 的当前状态（含 year: null 原样保留）
  if (path === '/api/v1/me/resume' && method === 'GET') {
    Onboarding域.读取.简历 += 1;
    Onboarding域.简历请求.push({ method, path });
    await 答简历();
    return true;
  }
  if (path.startsWith('/api/v1/me/resume/') && method !== 'GET') {
    Onboarding域.简历请求.push({ method, path });
  }
  if (path === '/api/v1/me/resume/profile' && method === 'PATCH') {
    断言资料写入(body);
    记变更(path);
    Onboarding域.resume.profile = { ...P4深克隆(Onboarding域.resume.profile), ...P4深克隆(body) } as BFF简历['profile'];
    Onboarding域.resume.profile_revision += 1;
    Onboarding域.resume.aggregate_revision += 1;
    await 答简历();
    return true;
  }
  if (path === '/api/v1/me/resume/summary' && method === 'PATCH') {
    断言摘要写入(body);
    记变更(path);
    Onboarding域.resume.summary = (body as { value: string }).value;
    Onboarding域.resume.summary_revision += 1;
    Onboarding域.resume.aggregate_revision += 1;
    await 答简历();
    return true;
  }
  if (path === '/api/v1/me/resume/skills' && method === 'PATCH') {
    断言技能写入(body);
    记变更(path);
    Onboarding域.resume.skills = [...(body as { skills: string[] }).skills];
    Onboarding域.resume.skills_revision += 1;
    Onboarding域.resume.aggregate_revision += 1;
    await 答简历();
    return true;
  }
  if (path === '/api/v1/me/resume/experiences' && method === 'POST') {
    断言经历写入(body);
    记变更(path);
    const 写 = body as {
      organization_id: string; industry_id: string; title: string; start_month: string;
      end_month?: string | null; description?: string; hidden?: boolean; internship?: boolean;
    };
    const 新经历: BFF简历['experiences'][number] = {
      id: `exp-fixture-onboard-${Onboarding域.resume.experiences.length + 1}`,
      organization_id: 写.organization_id,
      company: 经历企业展示名(写.organization_id),
      industry: { id: 写.industry_id, display_name: Onboarding目录展示[写.industry_id] ?? '' },
      title: 写.title,
      start_month: 写.start_month,
      end_month: 写.end_month ?? null,
      description: 写.description ?? '',
      hidden: 写.hidden ?? false,
      internship: 写.internship ?? false,
      revision: 1,
      projects: null,
    };
    Onboarding域.resume.experiences.push(新经历);
    Onboarding域.resume.aggregate_revision += 1;
    await route.fulfill({
      status: 200,
      json: 信封({ entry: { kind: 'experience', experience: P4深克隆(新经历) }, aggregate_revision: Onboarding域.resume.aggregate_revision }),
    });
    return true;
  }
  // 经历更新（同 id CAS）：body 同创建；company 快照按最新 organization_id 重新冻结
  //（与 保存简历 的 PATCH /me/resume/experiences/{id} 消费合同一致，教育 PATCH 同款）
  const Onboarding经历改 = /^\/api\/v1\/me\/resume\/experiences\/([^/]+)$/.exec(path);
  if (Onboarding经历改 && method === 'PATCH') {
    断言经历写入(body);
    记变更(path);
    const 目标 = Onboarding域.resume.experiences.find((条) => 条.id === Onboarding经历改[1]);
    if (目标 === undefined) {
      await route.fulfill({ status: 404, json: { error: { type: 'experience_not_found', message: 'fixture：未知经历条目' } } });
      return true;
    }
    const 写 = body as {
      organization_id: string; industry_id: string; title: string; start_month: string;
      end_month?: string | null; description?: string; hidden?: boolean; internship?: boolean;
    };
    目标.organization_id = 写.organization_id;
    目标.company = 经历企业展示名(写.organization_id);
    目标.industry = { id: 写.industry_id, display_name: Onboarding目录展示[写.industry_id] ?? '' };
    目标.title = 写.title;
    目标.start_month = 写.start_month;
    目标.end_month = 写.end_month ?? null;
    目标.description = 写.description ?? '';
    目标.hidden = 写.hidden ?? false;
    目标.internship = 写.internship ?? false;
    目标.revision += 1;
    Onboarding域.resume.aggregate_revision += 1;
    await 答简历();
    return true;
  }
  if (path === '/api/v1/me/resume/educations' && method === 'POST') {
    断言教育写入(body);
    记变更(path);
    const 写 = body as { institution_id: string; degree: string; major_id: string; start_month: string; end_month?: string | null };
    const 新教育: BFF简历['educations'][number] = {
      id: `edu-fixture-onboard-${Onboarding域.resume.educations.length + 1}`,
      institution: { id: 写.institution_id, display_name: Onboarding目录展示[写.institution_id] ?? '' },
      degree: 写.degree,
      major: { id: 写.major_id, display_name: Onboarding目录展示[写.major_id] ?? '' },
      start_month: 写.start_month,
      end_month: 写.end_month ?? null,
      revision: 1,
    };
    Onboarding域.resume.educations.push(新教育);
    Onboarding域.resume.aggregate_revision += 1;
    await route.fulfill({
      status: 200,
      json: 信封({ entry: { kind: 'education', education: P4深克隆(新教育) }, aggregate_revision: Onboarding域.resume.aggregate_revision }),
    });
    return true;
  }
  // 教育更新（同 id CAS）：body 同创建（end_month 可选）；成功以整册权威快照回读
  //（与 保存简历 的 PATCH /me/resume/educations/{id} 消费合同一致，J-PILOT-02 同款）
  const Onboarding教育改 = /^\/api\/v1\/me\/resume\/educations\/([^/]+)$/.exec(path);
  if (Onboarding教育改 && method === 'PATCH') {
    断言教育写入(body);
    记变更(path);
    const 目标 = Onboarding域.resume.educations.find((条) => 条.id === Onboarding教育改[1]);
    if (目标 === undefined) {
      await route.fulfill({ status: 404, json: { error: { type: 'education_not_found', message: 'fixture：未知教育条目' } } });
      return true;
    }
    const 写 = body as { institution_id: string; degree: string; major_id: string; start_month: string; end_month?: string | null };
    目标.institution = { id: 写.institution_id, display_name: Onboarding目录展示[写.institution_id] ?? '' };
    目标.degree = 写.degree;
    目标.major = { id: 写.major_id, display_name: Onboarding目录展示[写.major_id] ?? '' };
    目标.start_month = 写.start_month;
    目标.end_month = 写.end_month ?? null;
    目标.revision += 1;
    Onboarding域.resume.aggregate_revision += 1;
    await 答简历();
    return true;
  }
  if (path === '/api/v1/me/resume/certificates' && method === 'POST') {
    断言证书写入(body);
    记变更(path);
    const 写 = body as { name: string; year: number | null };
    const 新证书: BFF简历['certificates'][number] = {
      id: `cert-fixture-onboard-${Onboarding域.resume.certificates.length + 1}`,
      name: 写.name,
      // name-only 写入的 year: null 原样保留，绝不编造年份
      year: 写.year,
      revision: 1,
    };
    Onboarding域.resume.certificates.push(新证书);
    Onboarding域.resume.aggregate_revision += 1;
    await route.fulfill({
      status: 200,
      json: 信封({ entry: { kind: 'certificate', certificate: P4深克隆(新证书) }, aggregate_revision: Onboarding域.resume.aggregate_revision }),
    });
    return true;
  }

  // 意向域：GET 回本 fixture 当前列表；POST 严格校验后物化唯一一条 active 意向
  if (path === '/api/v1/me/intentions' && method === 'GET') {
    Onboarding域.读取.意向 += 1;
    await route.fulfill({ status: 200, json: 信封({ intentions: P4深克隆(Onboarding域.intentions) }) });
    return true;
  }
  if (path === '/api/v1/me/intentions' && method === 'POST') {
    断言意向写入(body);
    记变更(path);
    const 写 = body as {
      recruitment_type: 'social_full_time' | 'campus' | 'internship' | 'part_time';
      job_category_id: string; primary_location_id: string; alternate_location_ids: string[]; industry_ids: string[];
      workplace_modes: ('onsite' | 'hybrid' | 'remote')[];
      compensation: { mode: 'range' | 'negotiable'; lower?: number | null; upper?: number | null; annual_salary_months?: number | null };
      graduation_month: string | null; internship_months: number | null; onsite_days_per_week: number | null;
      exclusions: BFFOwnerIntention['exclusions']; private_preferences: string;
    };
    const 新意向: BFFOwnerIntention = {
      intention_id: Onboarding标记.意向编号,
      recruitment_type: 写.recruitment_type,
      job_category: { id: 写.job_category_id, display_name: Onboarding目录展示[写.job_category_id] ?? '' },
      primary_location: { id: 写.primary_location_id, display_name: Onboarding目录展示[写.primary_location_id] ?? '' },
      alternate_locations: 写.alternate_location_ids.map((id) => ({ id, display_name: Onboarding目录展示[id] ?? '' })),
      industries: 写.industry_ids.map((id) => ({ id, display_name: Onboarding目录展示[id] ?? '' })),
      workplace_modes: [...写.workplace_modes],
      compensation: P4深克隆(写.compensation),
      // salary_period 是服务端按 recruitment_type 派生的只读字段
      salary_period: 写.recruitment_type === 'internship' || 写.recruitment_type === 'part_time' ? 'day' : 'month',
      graduation_month: 写.graduation_month,
      internship_months: 写.internship_months,
      onsite_days_per_week: 写.onsite_days_per_week,
      exclusions: P4深克隆(写.exclusions),
      private_preferences: 写.private_preferences,
      status: 'active',
      revision: 1,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    };
    Onboarding域.intentions.push(新意向);
    await route.fulfill({ status: 200, json: 信封(P4深克隆(新意向)) });
    return true;
  }
  // 完成核对的 exact ID 权威回读（J-PILOT-02 同款）：只认本轮创建的那一条
  const Onboarding意向详情 = /^\/api\/v1\/me\/intentions\/([^/]+)$/.exec(path);
  if (Onboarding意向详情 && method === 'GET') {
    const 目标 = Onboarding域.intentions.find((条) => 条.intention_id === Onboarding意向详情[1]);
    if (目标 === undefined) {
      await route.fulfill({ status: 404, json: { error: { type: 'intention_not_found', message: 'fixture：未知意向' } } });
      return true;
    }
    await route.fulfill({ status: 200, json: 信封(P4深克隆(目标)) });
    return true;
  }

  // 凭证投影：只存在于本 fixture 的唯一打码手机号（个人信息页的账号手机号来源）
  if (path === '/api/v1/me/credentials' && method === 'GET') {
    await route.fulfill({
      status: 200,
      json: 信封({
        credentials: [
          { credential_id: 'crd-fixture-onboarding-phone-0001', provider: 'phone_otp', display: Onboarding标记.手机掩码, verified_at: '2026-09-01T00:00:00Z' },
        ],
      }),
    });
    return true;
  }
  return false;
}
