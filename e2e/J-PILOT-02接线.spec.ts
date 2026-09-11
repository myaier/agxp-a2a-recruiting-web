// e2e/J-PILOT-02接线.spec.ts
// J-PILOT-02 候选 onboarding 接线 · Task 10 定向浏览器用例。
//
// 四类场景（brief 原文）：学生/社招手填、education POST 后读取失败刷新不重复、
// 头像 unknown 不能完成、同数据 Mock/Backend 共用布局。
//
// 装载方式沿 e2e/onboarding.spec.ts 与 e2e/数据源模式.spec.ts 的既有口径：
//   · @backend 用例 test.use({ baseURL: 4182 }) 钉到显式 backend/stg dev server，
//     由 playwright.数据源模式.config.ts 的 webServer 数组启动（npm run
//     test:e2e:data-source）。默认 config 只起 Mock 4173，连不上 4182 —— 用例开头
//     探测端口，不可达即 test.skip 并注明入口，绝不在 Mock 冒充 Backend 结果，
//     也不新建第二套 runner。
//   · 全部 /api/v1 请求被本文件自带的 route fixture 拦截应答（wire 形与闭合键集
//     校验对齐 数据源模式.spec.ts 的既有 fixture）。route mock 只证明前端在拦截
//     边界上的行为，绝不作为真实 provider / 真实 BFF 联调证据；真实链路结论保持
//     BLOCKED，走 docs/dogfood/ 真实入口。
//
// 断言口径（本旅程本轮接线的真实风险）：
//   · 零工作经历可以下一步（保存推进到引导问答，且 POST /resume/experiences 为 0）；
//   · 至少一条完整教育才走完（教育四连页收口 POST /resume/educations 恰 1 次）；
//   · 首次意向仅一 POST / 一个 id（完成核对走 GET /me/intentions/{id} exact ID）；
//   · URL 三态 wire 行为：本轮未改 → profile PATCH 不带 作品集链接；改过 → 带
//     （设置 string / 清空 null）；
//   · 恢复题序/编辑文本不丢：education 写入读取失败后刷新，页面回到原题、重走不重复 POST。
//
// 已知 PM_BLOCKED（不统计为 PASS）：排除题「再加一家」无真实组织结果选择，一键与
// 手输均被阻止 —— 本文件不断言屏蔽新增闭环。

import { expect, test, type Page, type Route } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// fixture：标记值 / 简历快照 / 可变状态（测试自持，handler 直读直写）
// ─────────────────────────────────────────────────────────────────────────────

/** 只存在于 fixture 的标记值（Mock 里没有，页面展示即证明渲染来自 HTTP 拦截边界） */
const 标记 = {
  城市: ' Fixture 市',
  学校: ' Fixture 大学',
  专业: 'Fixture 专业',
  职位: ' Fixture 工程师',
  行业: 'Fixture 行业',
  主体: 'subj-fixture-jp02-001',
  意向编号: 'int_00112233445566778899aabbccddeef0',
  手机掩码: '+86 139 **** 0210',
} as const;

/** BFF 信封：{ result, meta } */
function 信封<T>(result: T): { result: T; meta: { request_id: string; api_version: 'v1' } } {
  return { result, meta: { request_id: 'fixture-jp02', api_version: 'v1' } };
}

/** BFF 目录页 */
function 目录页<T extends { id: string }>(items: T[]): {
  items: T[];
  next_cursor: string | null;
  catalog_version: string;
} {
  return { items, next_cursor: null, catalog_version: 'fixture-jp02-v1' };
}

/** 目录 ID → 展示名：写入 body 只带选择 ID，权威应答从这里补 display_name */
const 目录展示: Record<string, string> = {
  'loc-fixture-001': 标记.城市,
  'job-fixture-001': 标记.职位,
  'ind-fixture-001': 标记.行业,
  'inst-fixture-001': 标记.学校,
  'major-fixture-001': 标记.专业,
};

interface 教育条目形 {
  id: string;
  institution: { id: string; display_name: string };
  degree: string;
  major: { id: string; display_name: string };
  start_month: string;
  end_month: string | null;
  revision: number;
}

interface 意向条目形 {
  intention_id: string;
  recruitment_type: string;
  job_category: { id: string; display_name: string };
  primary_location: { id: string; display_name: string };
  alternate_locations: { id: string; display_name: string }[];
  industries: { id: string; display_name: string }[];
  workplace_modes: string[];
  compensation: Record<string, unknown>;
  salary_period: string;
  graduation_month: string | null;
  internship_months: number | null;
  onsite_days_per_week: number | null;
  exclusions: Record<string, string>;
  private_preferences: string;
  status: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

interface 建档fixture形 {
  主体: { subject_id: string; roles: { role: 'candidate' | 'recruiter'; status: 'active' }[]; last_used_role: 'candidate' | 'recruiter' | null };
  resume: {
    profile: Record<string, unknown>;
    profile_revision: number;
    summary: string;
    summary_revision: number;
    skills: string[];
    skills_revision: number;
    experiences: unknown[];
    educations: 教育条目形[];
    certificates: unknown[];
    aggregate_revision: number;
  };
  intentions: 意向条目形[];
  /** 非读取请求（method/path/body）存证；GET 计数走 读取 */
  mutations: { method: string; path: string; body: unknown }[];
  读取: { 简历: number; 意向: number; 意向详情ID们: string[] };
  /** >0 时 GET /me/resume 答 503 并递减：制造「education POST 成功后读取失败」窗口 */
  简历GET失败剩余: number;
  /** 头像域：应答脚本（'unknown' → 503 operation_outcome_unknown；'ok' → 200）逐请求消费 */
  头像: {
    应答脚本: ('unknown' | 'ok')[];
    请求们: { key: string | null; ifMatch: string | null }[];
    revision: number;
    avatar_url: string | null;
  };
}

function 创建建档fixture(): 建档fixture形 {
  return {
    主体: { subject_id: 标记.主体, roles: [{ role: 'candidate', status: 'active' }], last_used_role: null },
    resume: {
      profile: {
        real_name: '',
        work_start_year: null,
        status: '',
        current_education: null,
        graduation_year: null,
        gender: null,
        birth_year: null,
        birth_month: null,
        portfolio_url: null,
      },
      profile_revision: 1,
      summary: '',
      summary_revision: 1,
      skills: [],
      skills_revision: 1,
      experiences: [],
      educations: [],
      certificates: [],
      aggregate_revision: 1,
    },
    intentions: [],
    mutations: [],
    读取: { 简历: 0, 意向: 0, 意向详情ID们: [] },
    简历GET失败剩余: 0,
    头像: { 应答脚本: [], 请求们: [], revision: 1, avatar_url: null },
  };
}

// ── 闭合键集校验（对齐既有 fixture：未知字段拒收，必含键缺席也拒收）──

function 断言键集(body: unknown, 允许键: readonly string[], 必含键: readonly string[] = []): void {
  expect(body).toBeTruthy();
  const 键们 = Object.keys(body as object);
  expect(键们.filter((键) => !允许键.includes(键))).toEqual([]);
  for (const 键 of 必含键) expect(键们).toContain(键);
}

// ─────────────────────────────────────────────────────────────────────────────
// 路由安装：覆盖候选 onboarding 旅程触达的全部 /api/v1 端点；未匹配路由答空信封
//（strict decode 拒收 —— 漏端点会当场红，不会被静默 Mock 顶替）
// ─────────────────────────────────────────────────────────────────────────────

async function 安装BFF路由(page: Page, fixture: 建档fixture形): Promise<void> {
  await page.route('**/api/v1/**', async (route: Route) => {
    const 请求 = route.request();
    const url = new URL(请求.url());
    const path = url.pathname;
    const method = 请求.method();
    const 是multipart = (请求.headers()['content-type'] ?? '').includes('multipart/form-data');
    const body = method !== 'GET' && !是multipart
      ? (() => { try { return JSON.parse(请求.postData() ?? '{}'); } catch { return {}; } })()
      : {};

    if (method !== 'GET') fixture.mutations.push({ method, path, body });

    // ── session / 主体 ──
    if (path === '/api/v1/session' && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封({ identity_id: 'id-fixture-jp02', session_id: 'sess-fixture-jp02', expires_at: '2026-12-01T00:00:00Z' }) });
      return;
    }
    if (path === '/api/v1/me' && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封({ ...fixture.主体 }) });
      return;
    }
    const 角色写 = /^\/api\/v1\/me\/roles\/(candidate|recruiter)$/.exec(path);
    if (角色写 && method === 'PUT') {
      断言键集(body, []);
      if (!fixture.主体.roles.some((行) => 行.role === 角色写[1])) {
        fixture.主体.roles.push({ role: 角色写[1] as 'candidate' | 'recruiter', status: 'active' });
      }
      await route.fulfill({ status: 200, json: 信封({ ...fixture.主体 }) });
      return;
    }
    if (path === '/api/v1/me/preferences/last-used-role' && method === 'PUT') {
      断言键集(body, ['role']);
      fixture.主体.last_used_role = (body as { role: 'candidate' | 'recruiter' }).role;
      await route.fulfill({ status: 200, json: 信封({ ...fixture.主体 }) });
      return;
    }

    // ── 简历域：读取（可注入一次 503 窗口）与分区写入 ──
    if (path === '/api/v1/me/resume' && method === 'GET') {
      fixture.读取.简历 += 1;
      if (fixture.简历GET失败剩余 > 0) {
        fixture.简历GET失败剩余 -= 1;
        await route.fulfill({ status: 503, json: { error: { type: 'service_unavailable', message: 'fixture 注入的读取失败窗口' } } });
        return;
      }
      await route.fulfill({ status: 200, json: 信封(JSON.parse(JSON.stringify(fixture.resume))) });
      return;
    }
    if (path === '/api/v1/me/resume/profile' && method === 'PATCH') {
      // 八键全量 + 可选 portfolio_url（三态：属性缺省 = 未改；null = 清空；string = 设置）
      断言键集(body, ['real_name', 'work_start_year', 'status', 'current_education', 'graduation_year', 'gender', 'birth_year', 'birth_month', 'portfolio_url']);
      fixture.resume.profile = { ...JSON.parse(JSON.stringify(fixture.resume.profile)), ...JSON.parse(JSON.stringify(body)) };
      fixture.resume.profile_revision += 1;
      fixture.resume.aggregate_revision += 1;
      await route.fulfill({ status: 200, json: 信封(JSON.parse(JSON.stringify(fixture.resume))) });
      return;
    }
    if (path === '/api/v1/me/resume/summary' && method === 'PATCH') {
      断言键集(body, ['value']);
      fixture.resume.summary = (body as { value: string }).value;
      fixture.resume.summary_revision += 1;
      fixture.resume.aggregate_revision += 1;
      await route.fulfill({ status: 200, json: 信封(JSON.parse(JSON.stringify(fixture.resume))) });
      return;
    }
    if (path === '/api/v1/me/resume/skills' && method === 'PATCH') {
      断言键集(body, ['skills']);
      fixture.resume.skills = [...(body as { skills: string[] }).skills];
      fixture.resume.skills_revision += 1;
      fixture.resume.aggregate_revision += 1;
      await route.fulfill({ status: 200, json: 信封(JSON.parse(JSON.stringify(fixture.resume))) });
      return;
    }
    const 教育改 = /^\/api\/v1\/me\/resume\/educations\/([^/]+)$/.exec(path);
    if (教育改 && method === 'PATCH') {
      // 教育更新（CAS）：body 同创建（end_month 可选）；成功后整册快照回读
      断言键集(body, ['institution_id', 'degree', 'major_id', 'start_month', 'end_month'], ['institution_id', 'degree', 'major_id', 'start_month']);
      const 目标 = fixture.resume.educations.find((条) => 条.id === 教育改[1]);
      if (目标 === undefined) {
        await route.fulfill({ status: 404, json: { error: { type: 'education_not_found', message: 'fixture：未知教育条目' } } });
        return;
      }
      const 写 = body as { institution_id: string; degree: string; major_id: string; start_month: string; end_month?: string | null };
      目标.institution = { id: 写.institution_id, display_name: 目录展示[写.institution_id] ?? '' };
      目标.degree = 写.degree;
      目标.major = { id: 写.major_id, display_name: 目录展示[写.major_id] ?? '' };
      目标.start_month = 写.start_month;
      目标.end_month = 写.end_month ?? null;
      目标.revision += 1;
      fixture.resume.aggregate_revision += 1;
      await route.fulfill({ status: 200, json: 信封(JSON.parse(JSON.stringify(fixture.resume))) });
      return;
    }
    if (path === '/api/v1/me/resume/educations' && method === 'POST') {
      断言键集(body, ['institution_id', 'degree', 'major_id', 'start_month', 'end_month'], ['institution_id', 'degree', 'major_id', 'start_month']);
      const 写 = body as { institution_id: string; degree: string; major_id: string; start_month: string; end_month?: string | null };
      const 新教育: 教育条目形 = {
        id: `edu-fixture-jp02-${fixture.resume.educations.length + 1}`,
        institution: { id: 写.institution_id, display_name: 目录展示[写.institution_id] ?? '' },
        degree: 写.degree,
        major: { id: 写.major_id, display_name: 目录展示[写.major_id] ?? '' },
        start_month: 写.start_month,
        end_month: 写.end_month ?? null,
        revision: 1,
      };
      fixture.resume.educations.push(新教育);
      fixture.resume.aggregate_revision += 1;
      await route.fulfill({ status: 200, json: 信封({ entry: { kind: 'education', education: JSON.parse(JSON.stringify(新教育)) }, aggregate_revision: fixture.resume.aggregate_revision }) });
      return;
    }

    // ── 意向域：列表 / 创建 / exact ID 读取（完成核对的权威回读）──
    if (path === '/api/v1/me/intentions' && method === 'GET') {
      fixture.读取.意向 += 1;
      await route.fulfill({ status: 200, json: 信封({ intentions: JSON.parse(JSON.stringify(fixture.intentions)) }) });
      return;
    }
    if (path === '/api/v1/me/intentions' && method === 'POST') {
      断言键集(
        body,
        ['recruitment_type', 'job_category_id', 'primary_location_id', 'alternate_location_ids', 'industry_ids', 'workplace_modes', 'compensation', 'graduation_month', 'internship_months', 'onsite_days_per_week', 'exclusions', 'private_preferences'],
        ['recruitment_type', 'job_category_id', 'primary_location_id', 'alternate_location_ids', 'industry_ids', 'workplace_modes', 'compensation', 'graduation_month', 'internship_months', 'onsite_days_per_week', 'exclusions', 'private_preferences'],
      );
      const 写 = body as { recruitment_type: string; job_category_id: string; primary_location_id: string; alternate_location_ids: string[]; industry_ids: string[]; workplace_modes: string[]; compensation: Record<string, unknown>; graduation_month: string | null; internship_months: number | null; onsite_days_per_week: number | null; exclusions: Record<string, string>; private_preferences: string };
      const 新意向: 意向条目形 = {
        intention_id: 标记.意向编号,
        recruitment_type: 写.recruitment_type,
        job_category: { id: 写.job_category_id, display_name: 目录展示[写.job_category_id] ?? '' },
        primary_location: { id: 写.primary_location_id, display_name: 目录展示[写.primary_location_id] ?? '' },
        alternate_locations: 写.alternate_location_ids.map((id) => ({ id, display_name: 目录展示[id] ?? '' })),
        industries: 写.industry_ids.map((id) => ({ id, display_name: 目录展示[id] ?? '' })),
        workplace_modes: [...写.workplace_modes],
        compensation: JSON.parse(JSON.stringify(写.compensation)),
        salary_period: 写.recruitment_type === 'internship' || 写.recruitment_type === 'part_time' ? 'day' : 'month',
        graduation_month: 写.graduation_month,
        internship_months: 写.internship_months,
        onsite_days_per_week: 写.onsite_days_per_week,
        exclusions: { ...写.exclusions },
        private_preferences: 写.private_preferences,
        status: 'active',
        revision: 1,
        created_at: '2026-09-11T00:00:00Z',
        updated_at: '2026-09-11T00:00:00Z',
      };
      fixture.intentions.push(新意向);
      await route.fulfill({ status: 200, json: 信封(JSON.parse(JSON.stringify(新意向))) });
      return;
    }
    const 意向详情 = /^\/api\/v1\/me\/intentions\/([^/]+)$/.exec(path);
    if (意向详情 && method === 'GET') {
      fixture.读取.意向详情ID们.push(意向详情[1]!);
      const 目标 = fixture.intentions.find((条) => 条.intention_id === 意向详情[1]);
      if (目标 === undefined) {
        await route.fulfill({ status: 404, json: { error: { type: 'intention_not_found', message: 'fixture：未知意向' } } });
        return;
      }
      await route.fulfill({ status: 200, json: 信封(JSON.parse(JSON.stringify(目标))) });
      return;
    }

    // ── 凭证 / 隐私 / 账号档案 / 附件库（候选支持域水合的五域之四，resume 之外）──
    if (path === '/api/v1/me/credentials' && method === 'GET') {
      await route.fulfill({
        status: 200,
        json: 信封({ credentials: [{ credential_id: 'crd-fixture-jp02-0001', provider: 'phone_otp', display: 标记.手机掩码, verified_at: '2026-09-01T00:00:00Z' }] }),
      });
      return;
    }
    if (path === '/api/v1/me/privacy' && method === 'GET') {
      await route.fulfill({
        status: 200,
        json: 信封({
          employer_privacy_enabled: true,
          disclosure_preferences: { current_employer: 'never', education: 'resume_submission', portfolio_links: 'anonymous' },
          organization_blocks: [],
          revision: 1,
          updated_at: '2026-09-11T00:00:00Z',
        }),
      });
      return;
    }
    if (path === '/api/v1/me/account-profile' && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封({ avatar_url: fixture.头像.avatar_url, revision: fixture.头像.revision, updated_at: null }) });
      return;
    }
    if (path === '/api/v1/me/avatar' && method === 'POST') {
      // multipart：只存证幂等键与 If-Match（同 key / 同 ifMatch 重放是本域的断言对象），
      // 不解析也不记录文件字节
      fixture.头像.请求们.push({ key: 请求.headers()['idempotency-key'] ?? null, ifMatch: 请求.headers()['if-match'] ?? null });
      const 应答 = fixture.头像.应答脚本.shift() ?? 'ok';
      if (应答 === 'unknown') {
        await route.fulfill({ status: 503, json: { error: { type: 'operation_outcome_unknown', message: 'fixture 注入的头像未知结果' } } });
        return;
      }
      fixture.头像.revision += 1;
      fixture.头像.avatar_url = '/api/v1/me/avatar/content';
      await route.fulfill({ status: 200, json: 信封({ avatar_url: fixture.头像.avatar_url, revision: fixture.头像.revision, updated_at: '2026-09-11T00:00:00Z' }) });
      return;
    }
    // ── Agent 规则域（交互式切身份的水合域之一）：空清单即合法权威态 ──
    if (path === '/api/v1/me/agent-rules' && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封({ rules: [] }) });
      return;
    }
    if (path.startsWith('/api/v1/me/agent-rule-proposals') && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封({ proposals: [] }) });
      return;
    }
    if (path === '/api/v1/me/resume-files' && method === 'GET') {
      // 空附件库也要带合法 limits（items+limits 双键是闭合契约，缺 limits 解码直接拒）
      await route.fulfill({
        status: 200,
        json: 信封({ items: [], limits: { max_files: 3, max_file_bytes: 10_485_760, accepted_media_types: ['application/pdf'] } }),
      });
      return;
    }

    // ── 目录 ──
    if (path === '/api/v1/catalog/locations' && method === 'GET') {
      await route.fulfill({
        status: 200,
        json: 信封(目录页([
          { id: 'loc-fixture-001', display_name: 标记.城市, country_code: 'CN', country_name: '中国', admin1_code: 'SH', admin1_name: 'Fixture 省', timezone: 'Asia/Shanghai', population: 1000 },
        ])),
      });
      return;
    }
    if (path === '/api/v1/catalog/education-institutions' && method === 'GET') {
      await route.fulfill({
        status: 200,
        json: 信封(目录页([
          { id: 'inst-fixture-001', display_name: 标记.学校, location: { id: 'loc-fixture-001', display_name: 'Fixture City', country_code: 'CN', country_name: 'Fixtureland', admin1_code: null, admin1_name: null, timezone: 'Asia/Shanghai', population: 0 } },
        ])),
      });
      return;
    }
    if (path.startsWith('/api/v1/catalog/job-categories') && method === 'GET') {
      await route.fulfill({
        status: 200,
        json: 信封(目录页([{ id: 'job-fixture-001', display_name: 标记.职位, parent_id: null, selectable: true, has_children: false }])),
      });
      return;
    }
    if (path.startsWith('/api/v1/catalog/industries') && method === 'GET') {
      await route.fulfill({
        status: 200,
        json: 信封(目录页([{ id: 'ind-fixture-001', display_name: 标记.行业, parent_id: null, selectable: true, has_children: false }])),
      });
      return;
    }
    if (path.startsWith('/api/v1/catalog/majors') && method === 'GET') {
      await route.fulfill({
        status: 200,
        json: 信封(目录页([{ id: 'major-fixture-001', display_name: 标记.专业, parent_id: null, selectable: true, has_children: false }])),
      });
      return;
    }

    // 兜底：未匹配 /api/v1/* 答空信封（strict decode 拒收 → 漏端点当场红）
    await route.fulfill({ status: 200, json: 信封(null) });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 旅程 helper（沿用 onboarding.spec.ts / 数据源模式.spec.ts 的可见导航口径）
// ─────────────────────────────────────────────────────────────────────────────

/** Backend dev server 探测：默认 config 只起 Mock 4173，连不上 4182 就跳过并注明入口 */
async function 要求后端Server(page: Page): Promise<void> {
  const 可达 = await page.request
    .get('/', { timeout: 3_000 })
    .then((响应) => 响应.status() < 500)
    .catch(() => false);
  test.skip(!可达, 'backend/stg dev server (4182) 未启动：默认 playwright config 只起 Mock 4173。本组用 npm run test:e2e:data-source -- e2e/J-PILOT-02接线.spec.ts --project=backend-stg 运行');
}

/** 选身份 → 完善资料（Backend 偏好从空起步：身份/求职类型/办公方式都要用户明确选） */
async function 进完善资料(page: Page, 在校: boolean): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
  await page.getByRole('button', { name: '我要找工作' }).click();
  await expect(page).toHaveURL(/#\/student$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: '完善资料' })).toBeVisible();

  await page.getByRole('button', { name: 在校 ? '在校' : '已毕业', exact: true }).click();
  await page.getByRole('button', { name: 在校 ? '实习生' : '社招全职', exact: true }).click();
  if (在校) {
    // 实习生必填：可实习月数 / 每周到岗天数（Backend 无默认，必须点选）
    await page.getByRole('button', { name: '至少 3 个月' }).click();
    await page.getByRole('button', { name: '每周 3 天' }).click();
  }
  // 办公方式：Backend 从空起步，点一枚「现场」补齐
  await page.getByRole('button', { name: '现场', exact: true }).click();

  await page.getByRole('button', { name: '选择工作城市' }).click();
  await expect(page).toHaveURL(/#\/onboard\/city$/);
  await page.getByPlaceholder('搜索城市 / 省份').fill('fixture');
  await expect(page.getByRole('button', { name: 标记.城市, exact: true })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 标记.城市, exact: true }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page).toHaveURL(/#\/student$/);

  await page.getByRole('button', { name: '选择期望职位' }).click();
  await expect(page).toHaveURL(/#\/onboard\/job$/);
  // Backend 双栏：fixture 目录只有一项，左右两栏同名，点右栏那枚
  const 职位键 = page.getByRole('button', { name: 标记.职位, exact: true });
  await expect(职位键.first()).toBeVisible({ timeout: 10_000 });
  await expect(职位键).toHaveCount(2, { timeout: 10_000 });
  await 职位键.last().click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page).toHaveURL(/#\/student$/);
}

/** 滚轮滚到指定档（薪资轮/年份轮同一实现：listbox 可访问名 + 纯数字 option） */
async function 滚轮(page: Page, 名称: string, 档: number): Promise<void> {
  const 轮 = page.getByRole('listbox', { name: 名称 });
  await 轮.waitFor();
  await 轮.evaluate((节点, 目标) => {
    const 档们 = [...节点.querySelectorAll<HTMLElement>('[role="option"]')];
    const 序 = Math.max(0, 档们.findIndex((项) => (项.textContent ?? '').trim() === String(目标)));
    const 行高 = 档们.length > 1 ? 档们[1]!.offsetTop - 档们[0]!.offsetTop : 46;
    节点.scrollTop = 序 * 行高;
  }, 档);
  await expect(轮.getByRole('option', { name: String(档), exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
}

/** 基本信息页 → 求职状态（选档）→ 学历四连页（Backend 学校/专业走 fixture 目录；社招路径） */
async function 走资料与学历(page: Page, 档: string): Promise<void> {
  await page.getByPlaceholder('身份证上的名字').fill('Fixture 候选人');
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page).toHaveURL(/#\/onboard\/status$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: '现在是什么状态？' })).toBeVisible();
  await page.getByRole('button', { name: 档 }).click();
  await page.getByRole('button', { name: '下一步' }).click();

  // 社招：状态后走学历四连页（学生顺序不同：basic → 学历 → 经历 → 状态，不经过本函数尾段）
  await 走学历四连页(page);
}

/** 学历四连页：本科 → fixture 学校 → fixture 专业 → 就读时间段（两侧滚轮各滚一次即确认） */
async function 走学历四连页(page: Page): Promise<void> {
  await expect(page).toHaveURL(/#\/onboard\/degree$/, { timeout: 15_000 });
  await page.getByRole('button', { name: '本科' }).click();
  await page.getByRole('button', { name: '下一步' }).click();

  await expect(page).toHaveURL(/#\/onboard\/school$/, { timeout: 15_000 });
  const 学校框 = page.getByPlaceholder('学校名称');
  await 学校框.fill('fixture');
  await expect(page.getByText(标记.学校)).toBeVisible({ timeout: 10_000 });
  await page.getByText(标记.学校).click();
  await page.getByRole('button', { name: '下一步' }).click();

  await expect(page).toHaveURL(/#\/onboard\/major$/, { timeout: 15_000 });
  const 专业框 = page.getByPlaceholder('专业名称');
  await 专业框.fill('fixture');
  await expect(page.getByRole('button', { name: 标记.专业, exact: true })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 标记.专业, exact: true }).click();
  await page.getByRole('button', { name: '下一步' }).click();

  await expect(page).toHaveURL(/#\/onboard\/eduyears$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible();
}

/** 就读时间段：滚轮交互即确认 —— 滚到与显示默认（2021/2025）不同的档，
 *  值真正变化才会走 设入学年并确认/设毕业年并确认（滚到默认档是 no-op，不确认） */
async function 走就读时间段(page: Page): Promise<void> {
  await 滚轮(page, '入学年', 2020);
  await 滚轮(page, '毕业年', 2024);
}

/** 偏好段尾：排除题 →（可选自定义原文，走常驻「用你自己的话写」行内输入；
 *  屏蔽公司的「再加一家」是 PM_BLOCKED 路径，本文件不碰）→ 优势题 → 保存并继续 → 披露 */
async function 走偏好段尾(page: Page, 优势: string, 自定义排除?: string): Promise<void> {
  await expect(page.getByRole('heading', { name: '哪些情况直接排除？' })).toBeVisible({ timeout: 20_000 });
  if (自定义排除 !== undefined) {
    await page.getByPlaceholder('用你自己的话写').fill(自定义排除);
    await page.getByRole('button', { name: '添加' }).click();
    // 写完即视为已选：自定义词进排除网格（选中态由 排除键选中 class 表达，无 aria-pressed）；
    // 逐字进 private_preferences 的 wire 断言在用例尾部的 fixture 存证上
    await expect(page.getByRole('button', { name: 自定义排除 })).toBeVisible();
  }
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await expect(page.getByRole('heading', { name: '分享一下自己的个人优势' })).toBeVisible();
  await page.getByLabel('个人优势').fill(优势);
  await page.getByRole('button', { name: '保存并继续' }).click();
  await expect(page).toHaveURL(/#\/disclosure$/, { timeout: 30_000 });
}

/** 披露 → 头像页（不上传）→ 完成注册 → 初始化 → 主壳 */
async function 完成注册进主壳(page: Page): Promise<void> {
  await page.getByRole('button', { name: '完成设置，开始匹配' }).click();
  await expect(page).toHaveURL(/#\/onboard\/avatar$/);
  await page.getByRole('button', { name: '完成注册' }).click();
  // 完成注册清栈进初始化页（约 3.6s 播完）替换进主壳
  await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
}

/** 经 DataTransfer 在页面里构造带固定 lastModified 的头像文件并派发 change。
 *  setInputFiles 每次调用都会铸新的 lastModified（当时刻），而头像命令的文件核对
 *  （name/type/size/lastModified/sha256 五键）把 lastModified 当身份的一部分 ——
 *  「未知结果后重选同一张图」必须字节与元数据都一致，这里两次都用同一常量。 */
async function 选头像文件(page: Page, 字节: Buffer, lastModified: number): Promise<void> {
  // hash 路由已切但 React 屏未挂完的窗口里 input 可能还不在 —— 先等它在
  await page.locator('input[type="file"]').first().waitFor({ state: 'attached' });
  await page.evaluate(async ({ base64, mtime }) => {
    const bytes = Uint8Array.from(atob(base64), (字符) => 字符.charCodeAt(0));
    const 文件 = new File([bytes], '头像.png', { type: 'image/png', lastModified: mtime });
    const 框 = document.querySelector('input[type="file"]');
    if (!(框 instanceof HTMLInputElement)) throw new Error('头像文件框未找到');
    const 传送 = new DataTransfer();
    传送.items.add(文件);
    框.files = 传送.files;
    框.dispatchEvent(new Event('change', { bubbles: true }));
  }, { base64: 字节.toString('base64'), mtime: lastModified });
}

function 计数(fixture: 建档fixture形, method: string, path: string): number {
  return fixture.mutations.filter((条) => 条.method === method && 条.path === path).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend fixture 用例（@backend）
// ─────────────────────────────────────────────────────────────────────────────

test.describe('J-PILOT-02 候选 onboarding Backend fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径；
  // 超时按用例体 test.setTimeout 给足（全程可见导航 + debounce + 初始化页 3.6s + reload）
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('社招手填全旅程：零工作经历、URL 设置后清空、恰一首次意向 @backend', async ({ page }) => {
    test.setTimeout(240_000);
    await 要求后端Server(page);
    const fixture = 创建建档fixture();
    await 安装BFF路由(page, fixture);

    // ── 完善资料（社招）→ 向导薪资段 30/40 → 基本信息 ──
    await 进完善资料(page, false);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/wizard\?stage=salary$/);
    await expect(page.getByRole('heading', { name: '期望现金月薪是？' })).toBeVisible();
    await 滚轮(page, '最低月薪', 30);
    await 滚轮(page, '最高月薪', 40);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/basic$/);

    // ── 姓名 → 在职档 → 学历四连页 → 就读时间段 ──
    await 走资料与学历(page, '在职 · 考虑机会');
    await 走就读时间段(page);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/experience$/, { timeout: 15_000 });

    // ── 在线简历：零工作经历直存（URL 先设置）──
    await expect(page.getByRole('heading', { name: '在线简历' })).toBeVisible();
    await page.getByLabel('作品集或项目链接').fill('github.com/jp02/kept-project');
    await page.getByLabel('作品集或项目链接').blur();
    await expect(page.getByLabel('作品集或项目链接')).toHaveValue('https://github.com/jp02/kept-project');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('heading', { name: '哪些情况直接排除？' })).toBeVisible({ timeout: 20_000 });

    // 设置态的 URL wire 事实：本轮明确改过 → profile PATCH 带 portfolio_url 字符串
    const 设置写 = fixture.mutations.filter((条) => 条.method === 'PATCH' && 条.path === '/api/v1/me/resume/profile');
    expect(设置写.length).toBeGreaterThanOrEqual(1);
    expect((设置写.at(-1)!.body as Record<string, unknown>).portfolio_url).toBe('https://github.com/jp02/kept-project');

    // ── 返回在线简历清空 URL 再存：清空态 wire 事实（null）＋ 不重复创建教育 ──
    await page.goBack();
    await expect(page).toHaveURL(/#\/experience$/);
    await expect(page.getByRole('heading', { name: '在线简历' })).toBeVisible();
    await page.getByLabel('作品集或项目链接').fill('');
    await page.getByLabel('作品集或项目链接').blur();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('heading', { name: '哪些情况直接排除？' })).toBeVisible({ timeout: 20_000 });
    const 清空写 = fixture.mutations.filter((条) => 条.method === 'PATCH' && 条.path === '/api/v1/me/resume/profile').at(-1)!.body as Record<string, unknown>;
    expect(清空写.portfolio_url).toBeNull();

    // ── 偏好段尾（含自定义排除原文，验证逐字进 private_preferences）→ 披露 → 主壳 ──
    await 走偏好段尾(page, 'Fixture 候选人的个人优势标记', '不接受只有单休的安排');
    await 完成注册进主壳(page);

    // ── 精确断言 ──
    // 零工作经历：全旅程一次 POST /resume/experiences 都没有
    expect(计数(fixture, 'POST', '/api/v1/me/resume/experiences')).toBe(0);
    // 至少一条完整教育：恰 1 次 POST（institution/major 都是目录稳定 ID）
    expect(计数(fixture, 'POST', '/api/v1/me/resume/educations')).toBe(1);
    expect(fixture.resume.educations).toHaveLength(1);
    expect(fixture.resume.educations[0]).toMatchObject({
      institution: { id: 'inst-fixture-001' },
      major: { id: 'major-fixture-001' },
      start_month: '2020-09',
      end_month: '2024-06',
    });
    // 首次意向仅一 POST / 一个 id：完成核对走 exact ID 的 GET
    expect(计数(fixture, 'POST', '/api/v1/me/intentions')).toBe(1);
    expect(fixture.intentions).toHaveLength(1);
    expect(fixture.intentions[0]!.intention_id).toBe(标记.意向编号);
    // 完成核对按本轮 exact ID 读取：记录到的请求 id 必须就是本次创建的那一个
    expect(fixture.读取.意向详情ID们.length).toBeGreaterThanOrEqual(1);
    expect(fixture.读取.意向详情ID们).toContain(标记.意向编号);
    // exclusions 固定四键全 unspecified；自定义原文逐字进 private_preferences（固定拼接 + 换行分隔）
    expect(Object.keys(fixture.intentions[0]!.exclusions).sort()).toEqual(['alternate_weekend_work', 'frequent_travel', 'onsite_only', 'outsourcing_only']);
    expect(Object.values(fixture.intentions[0]!.exclusions).every((值) => 值 === 'unspecified')).toBe(true);
    expect(fixture.intentions[0]!.private_preferences).toContain('不接受只有单休的安排');
  });

  test('学生手填全旅程：实习生档、零工作经历、URL 未改不携带、恰一首次意向 @backend', async ({ page }) => {
    test.setTimeout(240_000);
    await 要求后端Server(page);
    const fixture = 创建建档fixture();
    await 安装BFF路由(page, fixture);

    // ── 完善资料（在校/实习生，含实习月数与到岗天数）→ 基本信息 → 学历四连页 ──
    await 进完善资料(page, true);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/basic$/);
    await page.getByPlaceholder('身份证上的名字').fill('Fixture 实习生');
    await page.getByRole('button', { name: '下一步' }).click();
    await 走学历四连页(page);
    await 走就读时间段(page);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/experience$/, { timeout: 15_000 });

    // ── 在线简历：零经历/零技能/零证书直存（URL 全程未碰）──
    await expect(page.getByRole('heading', { name: '在线简历' })).toBeVisible();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/onboard\/status$/);
    await page.getByRole('button', { name: '在校 · 考虑机会' }).click();
    await page.getByRole('button', { name: '下一步' }).click();

    // ── 学生尾段向导：实习日薪（默认档直过）→ 排除 → 优势 → 披露 → 主壳 ──
    await expect(page).toHaveURL(/#\/wizard$/);
    await expect(page.getByRole('heading', { name: '期望实习日薪是？' })).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();
    await 走偏好段尾(page, 'Fixture 实习生的个人优势标记');
    await 完成注册进主壳(page);

    // ── 精确断言 ──
    expect(计数(fixture, 'POST', '/api/v1/me/resume/experiences')).toBe(0);
    expect(计数(fixture, 'POST', '/api/v1/me/resume/educations')).toBe(1);
    // URL 省略态：本轮未改 → 所有 profile PATCH 都不带 portfolio_url 键
    const 资料写 = fixture.mutations.filter((条) => 条.method === 'PATCH' && 条.path === '/api/v1/me/resume/profile');
    expect(资料写.length).toBeGreaterThanOrEqual(1);
    for (const 写 of 资料写) {
      expect(Object.hasOwn(写.body as object, 'portfolio_url')).toBe(false);
    }
    // 首次意向仅一 POST / 一个 id；实习生档位与目录引用如实上屏
    expect(计数(fixture, 'POST', '/api/v1/me/intentions')).toBe(1);
    expect(fixture.intentions).toHaveLength(1);
    expect(fixture.intentions[0]!.recruitment_type).toBe('internship');
    expect(fixture.intentions[0]!.job_category).toEqual({ id: 'job-fixture-001', display_name: 标记.职位 });
    expect(fixture.intentions[0]!.primary_location).toEqual({ id: 'loc-fixture-001', display_name: 标记.城市 });
    // 完成核对按本轮 exact ID 读取：记录到的请求 id 必须就是本次创建的那一个
    expect(fixture.读取.意向详情ID们.length).toBeGreaterThanOrEqual(1);
    expect(fixture.读取.意向详情ID们).toContain(标记.意向编号);
    // 完成后角色偏好已落 candidate（刷新直达主壳的依据）
    expect(fixture.主体.last_used_role).toBe('candidate');
  });

  test('education POST 后读取失败：刷新回原题、重走不重复 POST @backend', async ({ page }) => {
    test.setTimeout(240_000);
    await 要求后端Server(page);
    const fixture = 创建建档fixture();
    await 安装BFF路由(page, fixture);

    // ── 走到就读时间段（教育四连页已收口，只差起止）──
    await 进完善资料(page, false);
    await page.getByRole('button', { name: '下一步' }).click();
    await 滚轮(page, '最低月薪', 30);
    await 滚轮(page, '最高月薪', 40);
    await page.getByRole('button', { name: '下一步' }).click();
    await 走资料与学历(page, '在职 · 考虑机会');
    await 走就读时间段(page);

    // ── 注入一次读取失败窗口：POST 教育成功 → 紧随的权威 GET 503 → 保存失败留在原页 ──
    fixture.简历GET失败剩余 = 1;
    await page.getByRole('button', { name: '下一步' }).click();
    // 读取失败经既有轻提示收口（5xx → 「后端服务暂时不可用，请稍后重试」），页面留在原题
    await expect(page.getByText('后端服务暂时不可用，请稍后重试')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/#\/onboard\/eduyears$/);
    expect(计数(fixture, 'POST', '/api/v1/me/resume/educations')).toBe(1);
    expect(fixture.resume.educations).toHaveLength(1);

    // ── 刷新：草稿恢复回就读时间段（题序不丢），服务端那条教育已在权威快照里 ──
    await page.reload();
    await expect(page).toHaveURL(/#\/onboard\/eduyears$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible();
    await expect(page.getByRole('listbox', { name: '入学年' }).getByRole('option', { name: '2020', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
    await expect(page.getByRole('listbox', { name: '毕业年' }).getByRole('option', { name: '2024', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });

    // ── 重走下一步：按已存身份核对，不再 POST 教育；GET 成功后推进 ──
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/experience$/, { timeout: 30_000 });
    expect(计数(fixture, 'POST', '/api/v1/me/resume/educations')).toBe(1);
    expect(fixture.resume.educations).toHaveLength(1);
    // 读取失败的窗口只消费了一次；此后 GET 全部恢复成功
    expect(fixture.简历GET失败剩余).toBe(0);
  });

  test('头像 unknown 不能完成：不伪成功、同 key/ifMatch 重放、成功后才完成 @backend', async ({ page }) => {
    test.setTimeout(240_000);
    await 要求后端Server(page);
    const fixture = 创建建档fixture();
    // 前两次 POST 答 503 operation_outcome_unknown：第一次会被 HTTP 客户端受控重试一次
    //（同 key），重试仍未知才抛给页面 —— 槽保留、头像状态 待核对
    fixture.头像.应答脚本 = ['unknown', 'unknown', 'ok'];
    await 安装BFF路由(page, fixture);

    // ── 走完整旅程到头像页（未选头像本可完成；这里上传撞未知结果）──
    await 进完善资料(page, false);
    await page.getByRole('button', { name: '下一步' }).click();
    await 滚轮(page, '最低月薪', 30);
    await 滚轮(page, '最高月薪', 40);
    await page.getByRole('button', { name: '下一步' }).click();
    await 走资料与学历(page, '在职 · 考虑机会');
    await 走就读时间段(page);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/experience$/, { timeout: 15_000 });
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await 走偏好段尾(page, 'Fixture 候选人的个人优势标记');
    await page.getByRole('button', { name: '完成设置，开始匹配' }).click();
    await expect(page).toHaveURL(/#\/onboard\/avatar$/);

    // ── 选同一张图：第一次（含受控重试）全部未知 → 不出现「头像已更新」假成功，
    //    用现有轻提示说明恢复操作 ──
    const 头像PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    await 选头像文件(page, 头像PNG, 1_760_000_000_000);
    await expect(page.getByText('头像上传结果未确认')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('头像已更新')).toHaveCount(0);
    await expect(page).toHaveURL(/#\/onboard\/avatar$/);
    expect(fixture.头像.请求们).toHaveLength(2);

    // ── 重选同一张图：原命令重放 —— 同 Idempotency-Key、同 If-Match，不换新 revision ──
    await 选头像文件(page, 头像PNG, 1_760_000_000_000);
    await expect(page.getByText('头像已更新')).toBeVisible({ timeout: 15_000 });
    expect(fixture.头像.请求们).toHaveLength(3);
    const [首键, 次键, 三键] = fixture.头像.请求们;
    expect(首键!.key).toBeTruthy();
    expect(new Set([首键!.key, 次键!.key, 三键!.key]).size).toBe(1);
    expect(new Set([首键!.ifMatch, 次键!.ifMatch, 三键!.ifMatch]).size).toBe(1);
    expect(首键!.ifMatch).toBe('"1"');

    // ── 成功回执已交：完成注册核对通过进主壳（未知阶段从未被当成已保存）──
    await page.getByRole('button', { name: '完成注册' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    expect(fixture.头像.revision).toBe(2);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 同数据 Mock/Backend 共用布局：单测试开两个 context（4181 Mock / 4182 Backend），
  // 对共享屏取「布局骨架」（可见交互元素的首个 CSS module 类名，忽略状态类与文案，
  // 数据差异只允许体现在同类节点的数量与文本）。选期望职位屏刻意不比：Mock 下钻与
  // Backend 双栏是两个被 Plan 明确保留的原入口，不是共用布局的声明对象。
  // ───────────────────────────────────────────────────────────────────────────
  test('同数据 Mock/Backend 共用布局：共享屏布局骨架一致 @backend', async ({ browser, page }) => {
    test.setTimeout(240_000);
    const 服务器可达 = async (根: string) =>
      page.request.get(根, { timeout: 3_000 }).then((响应) => 响应.status() < 500).catch(() => false);
    const 后端可达 = await 服务器可达('http://127.0.0.1:4182');
    const Mock可达 = await 服务器可达('http://127.0.0.1:4181');
    test.skip(!(后端可达 && Mock可达), '需要 mock(4181) 与 backend(4182) 两个 dev server：npm run test:e2e:data-source 后本用例才运行');

    /** 布局骨架：可见 button/input/heading/listbox 的 [tag, 首类名] 去重保序列表 */
    const 取骨架 = async (目标: Page) =>
      目标.evaluate(() => {
        const 签们: string[] = [];
        for (const 元 of Array.from(document.querySelectorAll<HTMLElement>('button, input, h1, h2, h3, [role="listbox"]'))) {
          if (元.getClientRects().length === 0) continue;
          const 首类 = (元.getAttribute('class') ?? '').split(/\s+/)[0] ?? '';
          const 签 = `${元.tagName.toLowerCase()}#${元.getAttribute('role') ?? ''}.${首类}`;
          if (!签们.includes(签)) 签们.push(签);
        }
        return 签们;
      });

    // ── Backend 侧（4182 + fixture 路由）：搜索并选中 fixture 城市，让「已选」区有货 ──
    const fixture = 创建建档fixture();
    await 安装BFF路由(page, fixture);
    await 进完善资料前半(page, false);
    const 后端学生分流390 = await 取骨架(page);
    await page.getByRole('button', { name: '选择工作城市' }).click();
    await expect(page).toHaveURL(/#\/onboard\/city$/);
    await expect(page.getByPlaceholder('搜索城市 / 省份')).toBeVisible();
    // 已批准的定位缺失态：Backend 不假选上海，「暂未获取定位」如实上屏且不可点
    await expect(page.getByRole('button', { name: '暂未获取定位', exact: true })).toBeDisabled();
    await page.getByPlaceholder('搜索城市 / 省份').fill('fixture');
    await expect(page.getByRole('button', { name: 标记.城市, exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 标记.城市, exact: true }).click();
    const 后端城市页390 = await 取骨架(page);

    // ── Mock 侧（4181 独立 context，本地数据；默认城市上海已带「已选」状态）──
    const mock上下文 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mock页 = await mock上下文.newPage();
    await mock页.goto('http://127.0.0.1:4181/');
    await mock页.getByText(/已阅读并同意/).click();
    await mock页.getByRole('button', { name: '微信登录' }).click();
    await expect(mock页).toHaveURL(/#\/identity$/);
    await mock页.getByRole('button', { name: '我要找工作' }).click();
    await expect(mock页).toHaveURL(/#\/student$/);
    await expect(mock页.getByRole('heading', { name: '完善资料' })).toBeVisible();
    const mock学生分流390 = await 取骨架(mock页);
    // Mock 默认城市是上海：行内值就是「上海」（无「选择工作城市」占位）
    await mock页.getByRole('button', { name: /上海/ }).first().click();
    await expect(mock页).toHaveURL(/#\/onboard\/city$/);
    await expect(mock页.getByPlaceholder('搜索城市 / 省份')).toBeVisible();
    const mock城市页390 = await 取骨架(mock页);

    // ── 390 主视口：同一布局组件与 CSS module 类名，两模式骨架逐项一致 ──
    expect(后端学生分流390, '完善资料屏 390 布局骨架').toEqual(mock学生分流390);
    expect(后端城市页390, '选工作城市屏 390 布局骨架').toEqual(mock城市页390);

    // ── 320 窄屏：两页都收窄重取骨架，Mode 间一致（底栏/长名称/滚动承载属视觉
    //    巡检与真实 dogfood 责任，这里只钉「收窄不产生另一套布局结构」）──
    await page.setViewportSize({ width: 320, height: 844 });
    await mock页.setViewportSize({ width: 320, height: 844 });
    expect(await 取骨架(page), '选工作城市屏 320 布局骨架（Backend）').toEqual(await 取骨架(mock页));
    await page.goBack();
    await mock页.goBack();
    await expect(page).toHaveURL(/#\/student$/);
    await expect(mock页).toHaveURL(/#\/student$/);
    expect(await 取骨架(page), '完善资料屏 320 布局骨架（Backend）').toEqual(await 取骨架(mock页));
    await mock上下文.close();
  });
});

/** 布局对比用的前半程：进完善资料但不点「下一步」（停留在 /#/student 原始态） */
async function 进完善资料前半(page: Page, 在校: boolean): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
  await page.getByRole('button', { name: '我要找工作' }).click();
  await expect(page).toHaveURL(/#\/student$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: '完善资料' })).toBeVisible();
  await page.getByRole('button', { name: 在校 ? '在校' : '已毕业', exact: true }).click();
  await page.getByRole('button', { name: 在校 ? '实习生' : '社招全职', exact: true }).click();
}
