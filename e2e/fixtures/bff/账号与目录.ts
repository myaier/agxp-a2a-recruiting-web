// e2e/fixtures/bff/账号与目录.ts
// 账号与目录域 fixture（C2）：fixture 标记值与静态主体/简历/意向样本，
// 从 e2e/数据源模式.spec.ts 原样迁出。可变路由 handler 见同文件的
// 处理账号与目录域（阶段二迁入）。

import { P6标记 } from './Agent规则';
import { 断言精确键集, 信封, 目录页, type 路由上下文形 } from './协议';
import type { P4发现fixture形 } from './发现推荐';
import type { P8FixtureState } from './账号控制面';

// ── fixture 标记值 ──

// 只存在于 fixture 的标记值：Mock 里没有，断言页面展示它们即证明渲染来自 HTTP。
export const 标记 = {
  主体真名: '后端 fixture 候选人',
  城市display: ' Fixture 市',
  学校display: ' Fixture 大学',
  专业display: ' Fixture 专业',
  学校副行: 'Fixture City · Fixtureland',
  职位display: ' Fixture 工程师',
  简历summary: '后端 fixture 个人优势标记',
  意向标题城市: 'Fixture 市',
} as const;

// ── 静态主体/简历/意向样本 ──

export const fixture主体 = {
  subject_id: 'subj-fixture-001',
  roles: [{ role: 'candidate' as const, status: 'active' as const }],
  last_used_role: 'candidate' as const,
};

export const fixture简历 = {
  profile: {
    real_name: 标记.主体真名,
    work_start_year: 2019,
    status: 'employed' as const,
    current_education: null,
    graduation_year: null,
    gender: null,
    birth_year: null,
    birth_month: null,
  },
  profile_revision: 1,
  summary: 标记.简历summary,
  summary_revision: 1,
  skills: ['Go', '分布式事务'],
  skills_revision: 1,
  experiences: [],
  // J-PILOT-02 起登录落点按「已水合简历 + active 意向」判建档完备（至少一条含毕业时间的
  // 完整教育经历）；educations 空会把候选打回 /student 学生分流，主壳用例全部落空。
  educations: [
    {
      id: 'edu-fixture-001',
      institution: { id: 'inst-fixture-001', display_name: 标记.学校display },
      degree: '本科',
      major: { id: 'major-fixture-001', display_name: 标记.专业display },
      start_month: '2015-09',
      end_month: '2019-06',
      revision: 1,
    },
  ],
  certificates: [],
  aggregate_revision: 1,
};

export const fixture意向列表 = {
  intentions: [
    {
      // Task 8：用 P6 契约形的真实 intention_id（int_ + 32 hex），意向级规则 scope 与
      // 意向级创建 body 引用的都是这一个权威 ID
      intention_id: P6标记.意向编号,
      recruitment_type: 'social_full_time' as const,
      job_category: { id: 'job-fixture-001', display_name: 标记.职位display },
      primary_location: { id: 'loc-fixture-001', display_name: 标记.意向标题城市 },
      alternate_locations: [],
      industries: [],
      workplace_modes: ['onsite' as const],
      compensation: { mode: 'range' as const, lower: 30, upper: 50, annual_salary_months: 15 },
      salary_period: 'month' as const,
      graduation_month: null,
      internship_months: null,
      onsite_days_per_week: null,
      exclusions: {
        alternate_weekend_work: 'unspecified' as const,
        outsourcing_only: 'unspecified' as const,
        onsite_only: 'unspecified' as const,
        frequent_travel: 'unspecified' as const,
      },
      private_preferences: '',
      status: 'active' as const,
      revision: 1,
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
  ],
};


// ── 路由 handler（C2 阶段二迁入）──

/** 装配层推导的账号域共享状态：主体/偏好写入推进它，me/session 路由直读直写。 */
export interface 账号主体形 {
  subject_id: string;
  roles: { role: 'candidate' | 'recruiter'; status: 'active' }[];
  last_used_role: 'candidate' | 'recruiter' | null;
}

/** 账号与目录域 handler 的装配参数：域间只共享这些明确引用。 */
export interface 账号域参数形 {
  主体: 账号主体形;
  fixture主体: 账号主体形;
  会话已登录: boolean;
  登录尝试id: string;
  Onboarding完成表: Record<'candidate' | 'recruiter', string | null>;
  P8域: P8FixtureState | null;
  P4域: P4发现fixture形 | null;
}

export async function 处理账号与目录域(
  上下文: 路由上下文形,
  参数: 账号域参数形,
): Promise<boolean> {
  const { 主体, fixture主体, 会话已登录, 登录尝试id, Onboarding完成表, P8域, P4域 } = 参数;
  const { route, url, path, method, body } = 上下文;

  // ── session / auth ──
  if (path === '/api/v1/session' && method === 'GET') {
    // P8 注销 202 之后：会话已被服务端清除，保护读取一律 401 invalid_session
    if (P8域?.分支.已注销) {
      await route.fulfill({ status: 401, json: { error: { type: 'invalid_session', message: '会话已随账号注销失效' } } });
      return true;
    }
    if (会话已登录) {
      await route.fulfill({ status: 200, json: 信封({ identity_id: 'id-fixture', session_id: 'sess-fixture', expires_at: '2026-08-26T00:00:00Z' }) });
    } else {
      await route.fulfill({ status: 401, json: { error: { type: 'invalid_session', message: '未登录' } } });
    }
    return true;
  }
  if (path === '/api/v1/auth/login-attempts' && method === 'POST') {
    await route.fulfill({ status: 200, json: 信封({ attempt_id: 登录尝试id, next_action: { type: 'enter_code', expires_at: '2026-08-25T01:00:00Z' } }) });
    return true;
  }
  if (path.startsWith('/api/v1/auth/login-attempts/') && path.endsWith('/complete') && method === 'POST') {
    await route.fulfill({ status: 200, json: 信封({ identity_id: 'id-fixture', session_id: 'sess-fixture', expires_at: '2026-08-26T00:00:00Z', next_action: { type: 'completed' } }) });
    return true;
  }
  if (path === '/api/v1/auth/logout' && method === 'POST') {
    await route.fulfill({ status: 200, json: 信封({ logged_out: true }) });
    return true;
  }

  // ── me ──
  if (path === '/api/v1/me' && method === 'GET') {
    if (P8域?.分支.已注销) {
      await route.fulfill({ status: 401, json: { error: { type: 'invalid_session', message: '会话已随账号注销失效' } } });
      return true;
    }
    await route.fulfill({ status: 200, json: 信封(主体) });
    return true;
  }
  if (path.startsWith('/api/v1/me/roles/') && method === 'PUT') {
    await route.fulfill({ status: 200, json: 信封(主体) });
    return true;
  }
  if (path === '/api/v1/me/preferences/last-used-role' && method === 'PUT') {
    // 服务端语义：记录偏好后，后续 GET /me 返回新值（刷新恢复用例依赖这一点）
    if (主体 !== fixture主体) 主体.last_used_role = (body as { role?: 'recruiter' | null })?.role ?? null;
    await route.fulfill({ status: 200, json: 信封(主体) });
    return true;
  }

  // ── stg 契约对齐 2026-09-14：me/onboarding 显式路由（绝不在兜底通配上躲测试）。
  //    缺省按已建立账号返回双角色已完成；新招聘方 onboarding 旅程的 recruiter 从
  //    null 起步，POST complete 模拟对应状态变化（首次与重试同一时间）并受理 body {} ──
  if (path === '/api/v1/me/onboarding' && method === 'GET') {
    await route.fulfill({
      status: 200,
      json: 信封({
        roles: [
          { role: 'candidate', status: 'active', completed_at: Onboarding完成表.candidate },
          { role: 'recruiter', status: 'active', completed_at: Onboarding完成表.recruiter },
        ],
      }),
    });
    return true;
  }
  const Onboarding完成写主 = /^\/api\/v1\/me\/onboarding\/(candidate|recruiter)\/complete$/.exec(path);
  if (Onboarding完成写主 && method === 'POST') {
    断言精确键集(body, []);
    const role = Onboarding完成写主[1] as 'candidate' | 'recruiter';
    Onboarding完成表[role] ??= '2026-09-14T08:00:00Z';
    await route.fulfill({
      status: 200,
      json: 信封({ role, status: 'active', completed_at: Onboarding完成表[role] }),
    });
    return true;
  }

  // ── resume ──
  if (path === '/api/v1/me/resume' && method === 'GET') {
    await route.fulfill({ status: 200, json: 信封(fixture简历) });
    return true;
  }
  // 候选账号档案（水合五支持域之一）：最小合法档案 —— 无头像。缺这条时兜底空信封
  // 会让 解候选账号档案 fail closed，交互式切身份（hr→candidate）整轮被第一错误挡住。
  if (path === '/api/v1/me/account-profile' && method === 'GET') {
    await route.fulfill({ status: 200, json: 信封({ avatar_url: null, revision: 1, updated_at: null }) });
    return true;
  }
  if (path === '/api/v1/me/resume/summary' && method === 'PATCH') {
    await route.fulfill({ status: 200, json: 信封({ ...fixture简历, summary: (body as { value?: string })?.value ?? '', summary_revision: 2 }) });
    return true;
  }
  if (path === '/api/v1/me/resume/profile' && method === 'PATCH') {
    await route.fulfill({ status: 200, json: 信封({ ...fixture简历, profile: { ...fixture简历.profile, ...(body as object) }, profile_revision: 2 }) });
    return true;
  }
  if (path === '/api/v1/me/resume/skills' && method === 'PATCH') {
    await route.fulfill({ status: 200, json: 信封({ ...fixture简历, skills: (body as { skills?: string[] })?.skills ?? [], skills_revision: 2 }) });
    return true;
  }
  if (path.startsWith('/api/v1/me/resume/educations') && method === 'POST') {
    const b = body as { institution_id?: string; degree?: string; major_id?: string; start_month?: string };
    await route.fulfill({ status: 200, json: 信封({ entry: { kind: 'education', education: { id: 'edu-fixture-001', institution: { id: b.institution_id ?? '', display_name: 标记.学校display }, degree: b.degree ?? '', major: { id: b.major_id ?? '', display_name: 'Fixture 专业' }, start_month: b.start_month ?? '', end_month: null, revision: 1 } }, aggregate_revision: 2 }) });
    return true;
  }
  if (path.startsWith('/api/v1/me/resume/experiences') && method === 'POST') {
    await route.fulfill({ status: 200, json: 信封({ entry: { kind: 'experience', experience: { id: 'exp-fixture-001', company: (body as { company?: string })?.company ?? '', industry: { id: 'ind-fixture', display_name: 'Fixture 行业' }, title: (body as { title?: string })?.title ?? '', start_month: '2020-01', end_month: null, description: '', hidden: false, internship: false, revision: 1, projects: null } }, aggregate_revision: 2 }) });
    return true;
  }

  // ── intentions ──
  if (path === '/api/v1/me/intentions' && method === 'GET') {
    // P4 发现 fixture 在场时可以改答自己的意向列表（候选端 scope 坐标 / 迟到应答用例用）
    await route.fulfill({ status: 200, json: 信封(P4域?.意向们 ? { intentions: P4域.意向们 } : fixture意向列表) });
    return true;
  }
  if (path === '/api/v1/me/intentions' && method === 'POST') {
    await route.fulfill({ status: 200, json: 信封(fixture意向列表.intentions[0]) });
    return true;
  }

  // ── catalog ──
  if (path === '/api/v1/catalog/locations' && method === 'GET') {
    const q = url.searchParams.get('q') ?? '';
    const admin1 = url.searchParams.get('admin1_code') ?? '';
    const items = admin1 !== '' || q !== ''
      ? [{ id: 'loc-fixture-001', display_name: 标记.城市display, country_code: 'CN', country_name: '中国', admin1_code: admin1 || 'SH', admin1_name: 'Fixture 省', timezone: 'Asia/Shanghai', population: 1000 }]
      : [];
    await route.fulfill({ status: 200, json: 信封(目录页(items)) });
    return true;
  }
  if (path === '/api/v1/catalog/education-institutions' && method === 'GET') {
    const q = url.searchParams.get('q') ?? '';
    const items = q !== ''
      ? [{ id: 'inst-fixture-001', display_name: 标记.学校display, location: { id: 'loc-fixture-001', display_name: 'Fixture City', country_code: 'CN', country_name: 'Fixtureland', admin1_code: null, admin1_name: null, timezone: 'Asia/Shanghai', population: 0 } }]
      : [];
    await route.fulfill({ status: 200, json: 信封(目录页(items)) });
    return true;
  }
  if (path.startsWith('/api/v1/catalog/job-categories') && method === 'GET') {
    await route.fulfill({ status: 200, json: 信封(目录页([{ id: 'job-fixture-001', display_name: 标记.职位display, parent_id: null, selectable: true }])) });
    return true;
  }
  if (path.startsWith('/api/v1/catalog/industries') && method === 'GET') {
    await route.fulfill({ status: 200, json: 信封(目录页([{ id: 'ind-fixture-001', display_name: 'Fixture 行业', parent_id: null, selectable: true }])) });
    return true;
  }
  if (path.startsWith('/api/v1/catalog/majors') && method === 'GET') {
    await route.fulfill({ status: 200, json: 信封(目录页([{ id: 'major-fixture-001', display_name: 'Fixture 专业', parent_id: null, selectable: true }])) });
    return true;
  }
  return false;
}
