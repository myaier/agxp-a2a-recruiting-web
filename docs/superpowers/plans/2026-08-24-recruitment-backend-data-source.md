# 招聘真实后端数据源切换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变现有视觉和默认 PM Mock 体验的前提下，用两个环境变量控制招聘原型使用 Mock 或 Local/STG Recruitment BFF 数据。

**Architecture:** 用纯函数解析运行配置，并让 Vite 只在 Backend 开发模式代理 `/api/v1`。现有 Context 保留 reducer 和演示域数据，新增一个类型化 HTTP 数据源、纯映射层和少量异步操作；Backend 支持域只接受服务端结果，未支持域继续使用隔离的演示模块，接口失败绝不回退 Mock。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、Testing Library、Playwright；不增加运行时或测试依赖。

**Spec:** `docs/superpowers/specs/2026-08-24-recruitment-backend-data-source-design.md`

## Global Constraints

- `VITE_DATA_SOURCE` 只允许 `mock | backend`，缺省值必须是 `mock`。
- `VITE_BACKEND_ENV` 只允许 `stg | local`，缺省值必须是 `stg`，且只在 Backend 模式生效。
- Local BFF 固定为 `http://127.0.0.1:8097`；STG 固定为 `https://recruitment-stg.agxp.ai`。
- 浏览器只请求同源 `/api/v1`；所有 BFF 请求都设置 `credentials: 'include'`。
- Backend 只支持本地 Vite dev；GitHub Pages、Capacitor 和普通生产构建继续以 Mock 为默认。
- 登录页必须保持 4 个验证码格；Backend 登录以 Local/STG BFF 已支持 4 位 OTP 为外部前提，前端不得补位、截断或改成 6 格。
- 不新增或修改 CSS、布局、文案、Loading、骨架、错误面板、重试按钮、环境标签或数据源徽标。
- 只复用现有 `路由加载中` 和 `轻提示`；默认 Mock 的 DOM、交互顺序和模拟加载节奏必须保持不变。
- Backend 已支持域失败时绝不回退 Mock；市场职位、匹配、评价、消息、规则、AI 简报、会话和历史继续使用明确隔离的演示数据。
- 不修改 `~/agxp-monorepo`；实施前只读核对 `apps/recruitment-bff/openapi/mobile-v1.yaml`，契约漂移时先停下更新规格和计划。
- 不增加状态库、请求框架、通用 SDK、缓存框架或全站错误系统。

## File Structure

| 文件 | 责任 |
| --- | --- |
| `.env.example` | 记录两个非敏感变量、允许值和默认值 |
| `src/配置/运行配置.ts` | 解析/校验环境变量，生成类型化数据源模式和代理描述 |
| `vite.config.ts` | 根据纯代理描述配置 `/api/v1`，保持 Pages build 行为 |
| `src/数据/BFF契约.ts` | 保存本次实际使用的 Mobile API DTO 子集，不向页面暴露 |
| `src/测试/BFF样本.ts` | 为 DTO、映射和 Context 测试提供一份集中、类型化的最小样本 |
| `src/数据/HTTP客户端.ts` | 封装 fetch、Cookie、ETag、幂等键、受控重试和错误类型 |
| `src/数据/招聘数据源类型.ts` | 定义页面模型快照、后端元数据和数据源能力签名 |
| `src/数据/后端映射.ts` | BFF DTO 与现有中文页面模型之间的纯函数映射 |
| `src/数据/前端附属数据.ts` | 保存岗位无后端字段的 `加分关键词`、`实习转正` |
| `src/数据/HTTP招聘数据源.ts` | 组合 HTTP、目录解析、简历/意向/岗位读写 |
| `src/数据/接口层.ts` | 按运行配置返回 `mock`/`backend` 判别联合，不做失败兜底 |
| `src/状态/应用状态.tsx` | 水合后端快照并提供登录、角色、简历、意向和岗位异步操作 |
| `src/应用.tsx` | Backend 初始化期间复用现有 `路由加载中`，处理无会话回登录 |
| `src/屏幕/登录.tsx` | 把现有按钮接到手机/微信登录操作，保持 4 格和原 DOM/CSS |
| `src/屏幕/选身份.tsx` | Backend 模式先确保/记录角色，成功后沿用当前导航与翻面动画 |
| 候选人简历/意向屏幕 | 把已支持写动作从直接 dispatch 改为 Context 异步操作 |
| 招聘方岗位屏幕 | 把职位 CRUD/归档/重开从直接 dispatch 改为 Context 异步操作 |
| `src/**/*.test.ts(x)` | 运行配置、HTTP、映射、附属存储、Context 的单元/组件测试 |
| `e2e/数据源模式.spec.ts` | 守住默认 Mock、4 格验证码和零新增 Loading 的浏览器行为 |
| `README.md` | 记录启动命令、后端前提、演示域和附属字段限制 |

---

### Task 1: 锁定 BFF 契约并实现运行配置与 Vite 代理

**Files:**
- Create: `.env.example`
- Create: `src/配置/运行配置.ts`
- Create: `src/配置/运行配置.test.ts`
- Modify: `vite.config.ts:1-31`

**Interfaces:**
- Consumes: `process.env`/Vite `loadEnv()` 的字符串键值。
- Produces:
  - `解析运行配置(env): 运行配置`
  - `取代理描述(config): 代理描述 | null`
  - `断言运行场景(config, command): void`

- [ ] **Step 1: 只读确认目标分支仍有本次使用的端点**

Run:

```bash
git -C /Users/visionclaw/agxp-monorepo show integration/stg-recruitment-91a4e19:apps/recruitment-bff/openapi/mobile-v1.yaml \
  | rg '^  /api/v1/(auth/login-attempts|auth/logout|session|me:|me/roles/\{role\}|me/preferences/last-used-role|me/resume|me/intentions|recruiter/jobs|catalog/job-categories|catalog/locations|catalog/majors|catalog/industries|catalog/education-institutions)'
```

Expected: 命令列出以上端点；若任何端点缺失或请求/响应字段与设计基线不同，停止实施，更新 spec 与本计划，不修改前端猜测契约。

- [ ] **Step 2: 写运行配置失败测试**

```ts
// src/配置/运行配置.test.ts
import { describe, expect, it } from 'vitest';
import { 解析运行配置, 取代理描述, 断言运行场景 } from './运行配置';

describe('运行配置', () => {
  it('缺省为 mock + stg', () => {
    expect(解析运行配置({})).toEqual({ 数据源: 'mock', 后端环境: 'stg' });
  });

  it.each([
    [{ VITE_DATA_SOURCE: 'backend', VITE_BACKEND_ENV: 'local' }, 'http://127.0.0.1:8097', null],
    [{ VITE_DATA_SOURCE: 'backend', VITE_BACKEND_ENV: 'stg' }, 'https://recruitment-stg.agxp.ai', 'https://recruitment-stg.agxp.ai'],
  ] as const)('为 Backend dev 返回代理描述', (env, target, origin) => {
    expect(取代理描述(解析运行配置(env))).toEqual({ target, 改写Origin: origin });
  });

  it('Mock 不配置代理', () => {
    expect(取代理描述(解析运行配置({ VITE_BACKEND_ENV: 'local' }))).toBeNull();
  });

  it.each([
    [{ VITE_DATA_SOURCE: 'fixture' }, 'VITE_DATA_SOURCE'],
    [{ VITE_BACKEND_ENV: 'prod' }, 'VITE_BACKEND_ENV'],
  ])('拒绝未知枚举值', (env, key) => {
    expect(() => 解析运行配置(env)).toThrow(key);
  });

  it('拒绝 production build 显式启用 backend', () => {
    expect(() => 断言运行场景(解析运行配置({ VITE_DATA_SOURCE: 'backend' }), 'build'))
      .toThrow('Backend 数据源只支持 Vite dev');
  });
});
```

- [ ] **Step 3: 运行测试并确认因模块不存在而失败**

Run: `npm test -- src/配置/运行配置.test.ts`

Expected: FAIL，错误包含 `Cannot find module './运行配置'`。

- [ ] **Step 4: 实现纯运行配置模块**

```ts
// src/配置/运行配置.ts
export type 数据源模式 = 'mock' | 'backend';
export type 后端环境 = 'stg' | 'local';
export interface 运行配置 { 数据源: 数据源模式; 后端环境: 后端环境 }
export interface 代理描述 { target: string; 改写Origin: string | null }

type 环境值 = Record<string, string | boolean | undefined>;

export function 解析运行配置(env: 环境值): 运行配置 {
  const 数据源 = env.VITE_DATA_SOURCE || 'mock';
  const 后端环境 = env.VITE_BACKEND_ENV || 'stg';
  if (数据源 !== 'mock' && 数据源 !== 'backend') {
    throw new Error('VITE_DATA_SOURCE 只允许 mock 或 backend');
  }
  if (后端环境 !== 'stg' && 后端环境 !== 'local') {
    throw new Error('VITE_BACKEND_ENV 只允许 stg 或 local');
  }
  return { 数据源, 后端环境 };
}

export function 取代理描述(config: 运行配置): 代理描述 | null {
  if (config.数据源 === 'mock') return null;
  return config.后端环境 === 'local'
    ? { target: 'http://127.0.0.1:8097', 改写Origin: null }
    : { target: 'https://recruitment-stg.agxp.ai', 改写Origin: 'https://recruitment-stg.agxp.ai' };
}

export function 断言运行场景(config: 运行配置, command: string): void {
  if (command === 'build' && config.数据源 === 'backend') {
    throw new Error('Backend 数据源只支持 Vite dev');
  }
}
```

- [ ] **Step 5: 接入 Vite 配置和示例环境文件**

`.env.example` 写入：

```dotenv
# mock | backend；缺省 mock，保持 PM 原型体验
VITE_DATA_SOURCE=mock
# stg | local；仅 Backend 模式生效，缺省 stg
VITE_BACKEND_ENV=stg
```

把 `vite.config.ts` 改为 `defineConfig(({ command, mode }) => { ... })`，使用：

```ts
import { defineConfig, loadEnv } from 'vite';
import { 解析运行配置, 取代理描述, 断言运行场景 } from './src/配置/运行配置';

const 环境 = loadEnv(mode, process.cwd(), '');
const 运行 = 解析运行配置(环境);
断言运行场景(运行, command);
const 代理 = 取代理描述(运行);

server: {
  host: true,
  proxy: 代理 ? {
    '/api/v1': {
      target: 代理.target,
      changeOrigin: 代理.改写Origin !== null,
      configure(proxy) {
        if (!代理.改写Origin) return;
        proxy.on('proxyReq', (request) => request.setHeader('Origin', 代理.改写Origin!));
      },
    },
  } : undefined,
},
```

保留现有 `base`、React plugin、CSS modules 和 build 配置原样；开发控制台只输出一次 `数据源=mock` 或 `数据源=backend/stg|local`。

- [ ] **Step 6: 运行单测、类型检查和构建**

Run:

```bash
npm test -- src/配置/运行配置.test.ts
npm run typecheck
npm run build
```

Expected: 三条命令 exit 0；build 使用缺省 Mock，不生成 Backend 发布配置。

- [ ] **Step 7: 提交**

```bash
git add .env.example src/配置/运行配置.ts src/配置/运行配置.test.ts vite.config.ts
git commit -m "feat: 增加招聘数据源运行配置"
```

---

### Task 2: 实现 BFF DTO 子集和可靠 HTTP 内核

**Files:**
- Create: `src/数据/BFF契约.ts`
- Create: `src/数据/HTTP客户端.ts`
- Create: `src/数据/HTTP客户端.test.ts`
- Create: `src/测试/BFF样本.ts`

**Interfaces:**
- Consumes: 同源 `/api/v1`、注入的 `fetch`、`crypto.randomUUID()`。
- Produces:
  - `创建BFF客户端(deps).请求<T>(请求选项): Promise<BFF响应<T>>`
  - `BFF错误`（`status`、`code`、`fieldErrors`、`retryAfterSeconds`）
  - `取后端错误文案(error): string`
  - 本计划实际使用的会话、主体、目录、简历、意向和岗位 DTO。

- [ ] **Step 1: 写 HTTP 行为失败测试**

```ts
// src/数据/HTTP客户端.test.ts
import { describe, expect, it, vi } from 'vitest';
import { 创建BFF客户端, BFF错误 } from './HTTP客户端';

describe('BFF HTTP 客户端', () => {
  it('始终带 Cookie，并返回 result、ETag', async () => {
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({ result: { job_id: 'job_1' }, meta: { request_id: 'r1', api_version: 'v1' } }),
      { status: 200, headers: { 'Content-Type': 'application/json', ETag: '"3"' } },
    ));
    const client = 创建BFF客户端({ fetcher, 生成幂等键: () => 'idem-fixed' });
    await expect(client.请求<{ job_id: string }>({ path: '/api/v1/recruiter/jobs/job_1' }))
      .resolves.toMatchObject({ result: { job_id: 'job_1' }, etag: '"3"' });
    expect(fetcher).toHaveBeenCalledWith('/api/v1/recruiter/jobs/job_1', expect.objectContaining({ credentials: 'include' }));
  });

  it('创建请求生成一次幂等键并在 outcome unknown 时复用', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ error: { type: 'operation_outcome_unknown', message: 'unknown' } }),
        { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '0' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ result: { job_id: 'job_1' }, meta: { request_id: 'r2', api_version: 'v1' } }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ));
    const client = 创建BFF客户端({ fetcher, 生成幂等键: () => 'idem-fixed', 等待: async () => {} });
    await client.请求({ path: '/api/v1/recruiter/jobs', method: 'POST', body: {}, 幂等: true });
    expect(fetcher.mock.calls.map(([, init]) => new Headers(init?.headers).get('Idempotency-Key')))
      .toEqual(['idem-fixed', 'idem-fixed']);
  });

  it('发送 If-Match 并保留结构化校验错误', async () => {
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({ error: { type: 'validation_failed', message: 'bad', fields: { title: 'required' } } }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    ));
    const client = 创建BFF客户端({ fetcher, 生成幂等键: () => 'idem-fixed' });
    await expect(client.请求({ path: '/api/v1/recruiter/jobs/job_1', method: 'PATCH', body: {}, ifMatch: '"2"' }))
      .rejects.toMatchObject<BFF错误>({ status: 422, code: 'validation_failed', fieldErrors: { title: 'required' } });
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('If-Match')).toBe('"2"');
  });

  it('普通网络错误不调用任何 Mock 数据源', async () => {
    const fetcher = vi.fn(async () => { throw new TypeError('offline'); });
    const client = 创建BFF客户端({ fetcher, 生成幂等键: () => 'idem-fixed' });
    await expect(client.请求({ path: '/api/v1/session' })).rejects.toMatchObject({ code: 'network_error' });
    expect(fetcher).toHaveBeenCalledTimes(2); // 初次读取 + 唯一一次读取重试
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- src/数据/HTTP客户端.test.ts`

Expected: FAIL，缺少 `HTTP客户端` 模块。

- [ ] **Step 3: 定义闭合 DTO 子集**

`src/数据/BFF契约.ts` 必须定义实际字段，不使用 `any`。本次使用的 DTO 采用以下闭合类型：

```ts
export type BFF角色 = 'candidate' | 'recruiter';
export interface BFF目录引用 { id: string; display_name: string }
export interface BFF主体 {
  subject_id: string;
  roles: { role: BFF角色; status: 'active' | 'suspended' }[];
  last_used_role: BFF角色 | null;
}
export interface BFF当前会话 { identity_id: string; session_id: string; expires_at: string }
export interface BFF登录尝试 {
  attempt_id: string;
  next_action: { type: 'enter_code' | 'redirect' | 'completed'; expires_at?: string; retry_after_seconds?: number; redirect_url?: string };
}
export interface BFF简历 {
  profile: BFF简历资料;
  profile_revision: number;
  summary: string;
  summary_revision: number;
  skills: string[];
  skills_revision: number;
  experiences: BFF经历[];
  educations: BFF教育[];
  certificates: BFF证书[];
  aggregate_revision: number;
}
export interface BFF简历资料 {
  real_name: string; work_start_year: number | null; status: 'student' | 'employed' | 'unemployed' | '';
  current_education: string | null; graduation_year: number | null; gender: 'male' | 'female' | null;
  birth_year: number | null; birth_month: number | null;
}
export interface BFF项目 { id: string; name: string; role: string; result: string; revision: number }
export interface BFF经历 {
  id: string; company: string; industry: BFF目录引用; title: string; start_month: string; end_month: string | null;
  description: string; hidden: boolean; internship: boolean; revision: number; projects: BFF项目[] | null;
}
export interface BFF教育 {
  id: string; institution: BFF目录引用; degree: string; major: BFF目录引用;
  start_month: string; end_month: string | null; revision: number;
}
export interface BFF证书 { id: string; name: string; year: number; revision: number }
export interface BFF意向补偿 { mode: 'range' | 'negotiable'; lower?: number | null; upper?: number | null; annual_salary_months?: number | null }
export interface BFF意向排除 {
  alternate_weekend_work: 'allowed' | 'excluded' | 'unspecified'; outsourcing_only: 'allowed' | 'excluded' | 'unspecified';
  onsite_only: 'allowed' | 'excluded' | 'unspecified'; frequent_travel: 'allowed' | 'excluded' | 'unspecified';
}
export interface BFFOwnerIntention {
  intention_id: string; recruitment_type: 'social_full_time' | 'campus' | 'internship' | 'part_time';
  job_category: BFF目录引用; primary_location: BFF目录引用; alternate_locations: BFF目录引用[];
  industries: BFF目录引用[]; workplace_modes: ('onsite' | 'hybrid' | 'remote')[];
  compensation: BFF意向补偿; salary_period: 'month' | 'day' | 'hour'; graduation_month: string | null;
  internship_months: number | null; onsite_days_per_week: number | null; exclusions: BFF意向排除;
  private_preferences: string; status: 'active' | 'archived'; revision: number; created_at: string; updated_at: string;
}
export interface BFFOwnerJob {
  job_id: string; publisher_mode: 'direct' | 'agency'; publisher_affiliation_ref?: string;
  publisher_verification_status: 'unverified' | 'verified';
  hiring_organization_claim: { display_name: string; legal_name?: string | null };
  title: string; recruitment_type: 'social_full_time' | 'campus' | 'internship' | 'part_time';
  category: BFF目录引用; location: BFF目录引用; office_location: string;
  workplace_mode: 'onsite' | 'hybrid' | 'remote'; salary_lower: number; salary_upper: number;
  salary_period: 'month' | 'day' | 'hour'; annual_salary_months: number | null; campus_cohort: number | null;
  internship_months: number | null; onsite_days_per_week: number | null; experience_requirement: string;
  education_requirement: string; description: string; requirements: string; keywords: string[];
  private_screening_preferences: string; status: 'active' | 'archived'; revision: number;
  published_at: string; created_at: string; updated_at: string;
}
export interface BFF信封<T> { result: T; meta: { request_id: string; api_version: 'v1' } }
```

另定义下列 write 类型，其属性必须与 OpenAPI 一一对应：

```ts
export interface BFF资料写入 extends Omit<BFF简历资料, 'status'> { status: 'student' | 'employed' | 'unemployed' }
export interface BFF经历写入 { company: string; industry_id: string; title: string; start_month: string; end_month?: string | null; description?: string; hidden?: boolean; internship?: boolean }
export interface BFF项目写入 { name: string; role?: string; result?: string }
export interface BFF教育写入 { institution_id: string; degree: string; major_id: string; start_month: string; end_month?: string | null }
export interface BFF证书写入 { name: string; year: number }
export interface BFF意向写入 {
  recruitment_type: BFFOwnerIntention['recruitment_type']; job_category_id: string; primary_location_id: string;
  alternate_location_ids: string[]; industry_ids: string[]; workplace_modes: BFFOwnerIntention['workplace_modes'];
  compensation: BFF意向补偿; graduation_month: string | null; internship_months: number | null;
  onsite_days_per_week: number | null; exclusions: BFF意向排除; private_preferences: string;
}
export interface BFF岗位创建 {
  publisher_mode: 'direct' | 'agency'; hiring_organization_claim: { display_name: string; legal_name: string | null };
  title: string; recruitment_type: BFFOwnerJob['recruitment_type']; category_id: string; location_id: string;
  office_location: string; workplace_mode: BFFOwnerJob['workplace_mode']; salary?: { lower: number; upper: number };
  annual_salary_months?: number | null; campus_cohort?: number | null; internship_months?: number | null;
  onsite_days_per_week?: number | null; experience_requirement: string; education_requirement: string;
  description: string; requirements: string; keywords?: string[]; private_screening_preferences?: string;
}
export type BFF岗位补丁 = Partial<BFF岗位创建>;
```

字段名逐项复制自 OpenAPI；不要为协议中不存在的页面字段增加 wire 属性。

- [ ] **Step 4: 建立集中测试样本**

在 `src/测试/BFF样本.ts` 导出以下完整常量，时间统一使用 `2026-08-24T00:00:00Z`：

```ts
export const BFF主体样本: BFF主体 = {
  subject_id: 'sub_1', roles: [{ role: 'candidate', status: 'active' }], last_used_role: 'candidate',
};
export const BFF简历样本: BFF简历 = {
  profile: { real_name: '沈亦舟', work_start_year: 2021, status: 'employed', current_education: null, graduation_year: null, gender: 'male', birth_year: 1998, birth_month: 6 },
  profile_revision: 2, summary: '优势', summary_revision: 1, skills: ['TypeScript'], skills_revision: 3,
  experiences: [{ id: 'exp_1', company: '云衢', industry: { id: 'tax_i', display_name: '互联网' }, title: '工程师', start_month: '2021-01', end_month: null, description: '平台', hidden: true, internship: false, revision: 4, projects: [] }],
  educations: [{ id: 'edu_1', institution: { id: 'ins_1', display_name: '复旦大学' }, degree: '本科', major: { id: 'tax_m', display_name: '计算机科学' }, start_month: '2017-09', end_month: '2021-06', revision: 2 }],
  certificates: [{ id: 'cert_1', name: 'PMP', year: 2024, revision: 1 }], aggregate_revision: 9,
};
export const BFF岗位样本: BFFOwnerJob = {
  job_id: 'job_1', publisher_mode: 'direct', publisher_verification_status: 'unverified',
  hiring_organization_claim: { display_name: '云衢科技', legal_name: null }, title: 'AI 产品实习生',
  recruitment_type: 'internship', category: { id: 'tax_product', display_name: '产品经理' },
  location: { id: 'loc_shanghai', display_name: '上海' }, office_location: '张江路 1 号', workplace_mode: 'hybrid',
  salary_lower: 300, salary_upper: 500, salary_period: 'day', annual_salary_months: null, campus_cohort: null,
  internship_months: 3, onsite_days_per_week: 4, experience_requirement: 'none', education_requirement: 'bachelor',
  description: '参与产品工作', requirements: '在校生', keywords: ['Python'], private_screening_preferences: '',
  status: 'active', revision: 1, published_at: '2026-08-24T00:00:00Z', created_at: '2026-08-24T00:00:00Z', updated_at: '2026-08-24T00:00:00Z',
};
export const 页面岗位样本: 在招岗位 = {
  编号: 'job_1', 名称: 'AI 产品实习生', 薪资带: '300-500 元/天', 状态: '在招', 在谈数: 0,
  城市: '上海', 办公地: '张江路 1 号', 办公方式: '混合', 招聘类型: '实习生', 职位类别: '产品经理',
  筛选要求: '', 经验要求: '不限', 最低学历: '本科', 职位描述: '参与产品工作', 职位要求: '在校生',
  硬性条件: ['本科及以上'], 职位关键词: ['Python'], 加分关键词: ['课程项目'],
  实习月数: 3, 每周天数: 4, 实习转正: true, 发布于: '2026-08-24',
};
export const BFF意向样本: BFFOwnerIntention = {
  intention_id: 'int_1', recruitment_type: 'internship',
  job_category: { id: 'tax_product', display_name: '产品经理' }, primary_location: { id: 'loc_shanghai', display_name: '上海' },
  alternate_locations: [], industries: [], workplace_modes: ['hybrid'],
  compensation: { mode: 'range', lower: 300, upper: 500, annual_salary_months: null }, salary_period: 'day',
  graduation_month: null, internship_months: 3, onsite_days_per_week: 4,
  exclusions: { alternate_weekend_work: 'unspecified', outsourcing_only: 'unspecified', onsite_only: 'unspecified', frequent_travel: 'unspecified' },
  private_preferences: '', status: 'active', revision: 1,
  created_at: '2026-08-24T00:00:00Z', updated_at: '2026-08-24T00:00:00Z',
};
```

该文件顶部显式 import `BFF主体/BFF简历/BFFOwnerJob/BFFOwnerIntention` 和现有 `在招岗位` 类型；后续测试只通过对象展开修改单一字段，避免每个测试复制一套漂移样本。

- [ ] **Step 5: 实现 HTTP 客户端**

```ts
// src/数据/HTTP客户端.ts
export class BFF错误 extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors: Record<string, string> = {},
    public retryAfterSeconds: number | null = null,
  ) { super(message); }
}

export interface BFF请求选项 {
  path: `/api/v1/${string}`;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  ifMatch?: string;
  幂等?: boolean;
}

export interface BFF响应<T> { result: T; etag: string | null; requestId: string | null }
export interface BFF客户端依赖 {
  fetcher?: typeof fetch;
  生成幂等键?: () => string;
  等待?: (milliseconds: number) => Promise<void>;
}
export interface BFF客户端 { 请求<T>(options: BFF请求选项): Promise<BFF响应<T>> }
export function 创建BFF客户端(deps?: BFF客户端依赖): BFF客户端;

export function 取后端错误文案(error: unknown): string {
  if (!(error instanceof BFF错误)) return '网络连接失败，请稍后再试';
  if (error.code === 'invalid_session') return '登录已失效，请重新登录';
  if (error.code === 'invalid_origin') return '当前后端环境配置不正确';
  if (error.code === 'version_conflict') return '数据已在其他地方更新，请重试';
  if (error.code === 'validation_failed') return Object.values(error.fieldErrors)[0] ?? '填写内容未通过校验';
  return error.message || '请求失败，请稍后再试';
}
```

实现规则必须固定为：

- GET 网络错误只重试一次；mutation 网络错误不自动重试。
- `409 idempotency_in_progress` 和 `503 operation_outcome_unknown` 最多受控重试一次，等待 `Retry-After`，并复用第一次生成的 Idempotency-Key。
- `Content-Type: application/json` 只在有 body 时发送。
- 所有调用设置 `credentials: 'include'`；不读取 Cookie。
- 非 2xx 解析 `{ error: { type, message, fields? } }` 为 `BFF错误`；响应不是合法 JSON 时使用 `invalid_response`。
- 不 import `模拟数据`、`企业端模拟数据` 或 `接口层`。

- [ ] **Step 6: 运行测试、lint 和类型检查**

Run:

```bash
npm test -- src/数据/HTTP客户端.test.ts
npm run lint
npm run typecheck
```

Expected: 全部 exit 0。

- [ ] **Step 7: 提交**

```bash
git add src/数据/BFF契约.ts src/数据/HTTP客户端.ts src/数据/HTTP客户端.test.ts src/测试/BFF样本.ts
git commit -m "feat: 增加招聘 BFF HTTP 客户端"
```

---

### Task 3: 实现目录解析和候选人简历映射

**Files:**
- Create: `src/数据/招聘数据源类型.ts`
- Create: `src/数据/后端映射.ts`
- Create: `src/数据/后端映射.test.ts`

**Interfaces:**
- Consumes: `BFF简历`、现有 `基本信息/简历经历段/简历教育段/简历证书`。
- Produces:
  - `页面简历快照`
  - `从BFF简历(dto): 页面简历快照`
  - `转资料写入/转经历写入/转教育写入/转证书写入`
  - `精确目录ID(items, displayName, kind): string`

- [ ] **Step 1: 写映射失败测试**

```ts
// src/数据/后端映射.test.ts
import { describe, expect, it } from 'vitest';
import { 从BFF简历, 精确目录ID, 转资料写入 } from './后端映射';

describe('候选人后端映射', () => {
  it('完整映射 profile 并保留四类条目的真实 ID', () => {
    const 页面 = 从BFF简历({
      profile: { real_name: '沈亦舟', work_start_year: 2021, status: 'employed', current_education: null, graduation_year: null, gender: 'male', birth_year: 1998, birth_month: 6 },
      profile_revision: 2, summary: '优势', summary_revision: 1, skills: ['TypeScript'], skills_revision: 3,
      experiences: [{ id: 'exp_1', company: '云衢', industry: { id: 'tax_i', display_name: '互联网' }, title: '工程师', start_month: '2021-01', end_month: null, description: '平台', hidden: true, internship: false, revision: 4, projects: [] }],
      educations: [{ id: 'edu_1', institution: { id: 'ins_1', display_name: '复旦大学' }, degree: '本科', major: { id: 'tax_m', display_name: '计算机科学' }, start_month: '2017-09', end_month: '2021-06', revision: 2 }],
      certificates: [{ id: 'cert_1', name: 'PMP', year: 2024, revision: 1 }], aggregate_revision: 9,
    });
    expect(页面.基本信息).toMatchObject({ 真名: '沈亦舟', 开始工作年: '2021', 身份: '在职', 性别: '男', 出生年: '1998', 出生月: '6' });
    expect(页面.经历[0].编号).toBe('exp_1');
    expect(页面.教育[0].编号).toBe('edu_1');
    expect(页面.证书[0].编号).toBe('cert_1');
    expect(页面.服务端快照.aggregate_revision).toBe(9);
  });

  it('把页面 profile 转成闭合后端 body', () => {
    expect(转资料写入({ 真名: '沈亦舟', 开始工作年: '2021', 身份: '离职', 性别: '男', 出生年: '1998', 出生月: '6' }))
      .toEqual({ real_name: '沈亦舟', work_start_year: 2021, status: 'unemployed', current_education: null, graduation_year: null, gender: 'male', birth_year: 1998, birth_month: 6 });
  });

  it('目录显示名必须唯一精确匹配', () => {
    const items = [{ id: 'tax_1', display_name: '产品经理' }];
    expect(精确目录ID(items, '产品经理', '职位类别')).toBe('tax_1');
    expect(() => 精确目录ID(items, '产品', '职位类别')).toThrow('无法唯一匹配职位类别：产品');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/数据/后端映射.test.ts`

Expected: FAIL，缺少映射导出。

- [ ] **Step 3: 定义页面快照和后端元数据**

```ts
// src/数据/招聘数据源类型.ts
import type { 基本信息, 简历经历段, 简历教育段, 简历证书, 在招岗位, 求职意向 } from './类型';
import type { 求职初筛偏好, 求职薪资单位 } from '../流程/onboarding配置';
import type { BFF简历, BFF主体, BFF目录引用, BFFOwnerIntention, BFFOwnerJob } from './BFF契约';

export interface 页面简历快照 {
  基本信息: 基本信息;
  个人优势: string;
  技能: string[];
  经历: 简历经历段[];
  教育: 简历教育段[];
  证书: 简历证书[];
  服务端快照: BFF简历;
}
export type 页面简历写入 = Omit<页面简历快照, '服务端快照'>;
export interface 目录索引 {
  职位类别: BFF目录引用[]; 地点: BFF目录引用[]; 行业: BFF目录引用[];
  院校: BFF目录引用[]; 专业: BFF目录引用[];
}
export interface 意向草稿型 {
  编辑编号: string | null; 求职类型: '全职' | '兼职'; 工作城市: string; 期望职位: string;
  感兴趣城市们: string[]; 薪资下限: number | null; 薪资上限: number | null; 期望行业们: string[];
  后端招聘类型: BFFOwnerIntention['recruitment_type'] | null; 求职类型已改: boolean;
}
export interface 意向映射上下文 { 原始: BFFOwnerIntention | null; 办公方式: string[]; 目录: 目录索引 }
export interface 首次意向输入 {
  职位们: string[]; 城市们: string[]; 薪资: { 下限: number; 上限: number; 单位: 求职薪资单位 };
  筛选偏好: 求职初筛偏好; 排除项: string[];
}
export interface 岗位映射上下文 { 公司: string; 目录: 目录索引 }
export interface 页面意向快照 { 列表: 求职意向[]; 服务端: Record<string, BFFOwnerIntention> }
export interface 页面岗位快照 { 列表: 在招岗位[]; 服务端: Record<string, BFFOwnerJob> }
export interface 后端会话快照 { 已登录: boolean; 主体: BFF主体 | null }
```

把 `意向草稿型` 从 `应用状态.tsx` 移到该类型文件，并在 `应用状态.tsx` 使用 `export type { 意向草稿型 } from '../数据/招聘数据源类型'` 保持现有屏幕 import 不变，避免数据层反向 import React Context。

- [ ] **Step 4: 实现简历映射**

在 `后端映射.ts` 中固定使用以下枚举映射：

```ts
const 身份到后端 = { 在校: 'student', 在职: 'employed', 离职: 'unemployed' } as const;
const 后端到身份 = { student: '在校', employed: '在职', unemployed: '离职' } as const;
const 性别到后端 = { 男: 'male', 女: 'female' } as const;
const 后端到性别 = { male: '男', female: '女' } as const;
```

映射规则：

- `summary <-> 个人优势`；`skills <-> 技能`。
- Experience 的 `id` 直接作为页面 `编号`，`industry.display_name -> 行业`，projects 同样保留真实 ID。
- Education 的 `institution/major.display_name` 映射页面学校/专业并保留真实 ID。
- Certificate 的整数 year 转字符串；空字符串写入时拒绝，不写 `NaN`。
- 后端 null 转页面可选空字符串；页面空字符串转后端 null。
- 从未写入过的 profile 若 `status === ''`，页面使用当前注册流的既有默认“在职”；用户保存前仍会经过现有身份选择页。
- 新建页面条目的临时编号不是后端 ID；写入后必须用服务端响应/重新读取结果替换。

- [ ] **Step 5: 运行候选映射测试和类型检查**

Run:

```bash
npm test -- src/数据/后端映射.test.ts
npm run typecheck
```

Expected: 两条命令 exit 0。

- [ ] **Step 6: 提交**

```bash
git add src/数据/招聘数据源类型.ts src/数据/后端映射.ts src/数据/后端映射.test.ts
git commit -m "feat: 增加简历与目录映射"
```

---

### Task 4: 实现意向/岗位映射和前端附属字段

**Files:**
- Modify: `src/数据/后端映射.ts`
- Modify: `src/数据/后端映射.test.ts`
- Create: `src/数据/前端附属数据.ts`
- Create: `src/数据/前端附属数据.test.ts`

**Interfaces:**
- Consumes: `BFFOwnerIntention`、`BFFOwnerJob`、`意向草稿型`、`在招岗位`、后端环境。
- Produces:
  - `从BFF意向/转意向写入/转首次意向写入`
  - `从BFF岗位/转岗位创建/转岗位补丁`
  - `读取/写入/删除岗位附属数据(env, jobId)`

- [ ] **Step 1: 写意向、岗位和附属存储失败测试**

```ts
// 追加到 src/数据/后端映射.test.ts
import { BFF意向样本, BFF岗位样本, 页面岗位样本 } from '../测试/BFF样本';

it('把后端岗位映射为现有页面模型', () => {
  expect(从BFF岗位(BFF岗位样本, { 加分关键词: ['课程项目'], 实习转正: true })).toMatchObject({
    编号: 'job_1', 名称: 'AI 产品实习生', 城市: '上海', 办公方式: '混合',
    招聘类型: '实习生', 职位类别: '产品经理', 职位关键词: ['Python'],
    加分关键词: ['课程项目'], 实习转正: true, 状态: '在招', 在谈数: 0,
  });
});

it('职位创建只发送 BFF 支持字段', () => {
  const 目录 = {
    职位类别: [{ id: 'tax_product', display_name: '产品经理' }],
    地点: [{ id: 'loc_shanghai', display_name: '上海' }],
    行业: [], 院校: [], 专业: [],
  };
  const body = 转岗位创建(页面岗位样本, 目录, { 公司: '云衢科技' });
  expect(body).toMatchObject({
    publisher_mode: 'direct', hiring_organization_claim: { display_name: '云衢科技', legal_name: null },
    title: 页面岗位样本.名称, category_id: 'tax_product', location_id: 'loc_shanghai',
    keywords: 页面岗位样本.职位关键词, private_screening_preferences: 页面岗位样本.筛选要求,
  });
  expect(body).not.toHaveProperty('加分关键词');
  expect(body).not.toHaveProperty('实习转正');
});

it('已加载的校园/实习意向在用户没切招聘类型时保留原类型', () => {
  const 草稿 = {
    编辑编号: BFF意向样本.intention_id, 求职类型: '全职' as const, 工作城市: '上海', 期望职位: '产品经理',
    感兴趣城市们: [], 薪资下限: 10, 薪资上限: 20, 期望行业们: [],
    求职类型已改: false, 后端招聘类型: 'internship' as const,
  };
  const context = {
    原始: BFF意向样本,
    办公方式: ['混合'],
    目录: { 职位类别: [{ id: 'tax_product', display_name: '产品经理' }], 地点: [{ id: 'loc_shanghai', display_name: '上海' }], 行业: [], 院校: [], 专业: [] },
  };
  expect(转意向写入(草稿, context).recruitment_type)
    .toBe('internship');
});
```

```ts
// src/数据/前端附属数据.test.ts
import { describe, expect, it } from 'vitest';
import { 创建岗位附属存储 } from './前端附属数据';

it('按环境和真实岗位 ID 隔离附属字段', () => {
  const storage = new Map<string, string>();
  const store = 创建岗位附属存储({ getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) });
  store.写入('stg', 'job_1', { 加分关键词: ['课程项目'], 实习转正: true });
  expect(store.读取('stg', 'job_1')).toEqual({ 加分关键词: ['课程项目'], 实习转正: true });
  expect(store.读取('local', 'job_1')).toEqual({});
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/数据/后端映射.test.ts src/数据/前端附属数据.test.ts`

Expected: FAIL，缺少岗位/意向映射和附属存储。

- [ ] **Step 3: 实现意向映射**

固定映射：

```ts
const 招聘类型到页面 = {
  social_full_time: '全职', campus: '全职', internship: '全职', part_time: '兼职',
} as const;
const 页面招聘类型到后端 = { 全职: 'social_full_time', 兼职: 'part_time' } as const;
const 办公方式到后端 = { 现场: 'onsite', 混合: 'hybrid', 远程: 'remote', 全远程: 'remote' } as const;
```

为 `意向草稿型` 增加两个不渲染字段：

```ts
后端招聘类型: 'social_full_time' | 'campus' | 'internship' | 'part_time' | null;
求职类型已改: boolean;
```

这两个字段已经由 Task 3 的共享类型定义；本 Task 修改 `空意向草稿`、`拆意向为草稿` 和 `改意向草稿` reducer 分支，使运行时值完整，并在用户 patch 包含 `求职类型` 时把 `求职类型已改` 设为 true。

打开后端意向时保留原始招聘类型；只有用户实际点过现有“全职/兼职”单选才按页面值覆盖。创建意向时：

- 城市、职位、行业用目录精确匹配。
- 薪资未填时发送 `{ mode: 'negotiable' }`，已填时发送 range。
- 办公方式来自已有 `引导预填.筛选偏好.办公方式`；完全缺失时抛出“请先完善办公方式”，由现有轻提示展示，不猜默认值。
- full-time/part-time 的 graduation/internship/onsite nullable 字段发 null；已有校园/实习意向更新时从服务端快照保留 UI 未表达的值。
- `private_preferences` 沿用服务端快照，创建时为空字符串。
- `转首次意向写入` 使用 `迁移主要求职类型()` 取得唯一主类型；`大小周/纯外包 / 乙方/全现场办公/频繁出差` 分别映射四个 exclusion 为 `excluded`，未选为 `unspecified`，其他自定义排除文本以 `其他排除：A、B` 写入 `private_preferences`。

- [ ] **Step 4: 实现岗位映射和附属存储**

`前端附属数据.ts` 暴露的接口固定为：

```ts
export interface 岗位附属 { 加分关键词?: string[]; 实习转正?: boolean }
export interface 岗位附属存储 {
  读取(env: 后端环境, jobId: string): 岗位附属;
  写入(env: 后端环境, jobId: string, value: 岗位附属): void;
  删除(env: 后端环境, jobId: string): void;
}
export function 创建岗位附属存储(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): 岗位附属存储;
```

固定枚举：

```ts
const 岗位类型到后端 = { 社招全职: 'social_full_time', 校园招聘: 'campus', 实习生: 'internship', 兼职: 'part_time' } as const;
const 办公方式到岗位后端 = { 现场: 'onsite', 混合: 'hybrid', 远程: 'remote', 全远程: 'remote' } as const;
const 学历到后端 = { 不限: 'none', 大专: 'associate', 本科: 'bachelor', 硕士: 'master', 博士: 'doctorate' } as const;
```

- 薪资带解析为 `{ lower, upper }` 和 month/day/hour；解析失败直接抛错。
- `职位关键词 -> keywords`；`筛选要求 -> private_screening_preferences`。
- `加分关键词/实习转正` 只进 `AGXP后端岗位附属v1:${env}:${jobId}`，不出现在 BFF body。
- 真实岗位 `在谈数` 固定 0；演示候选仍由未支持演示域自行计算。
- PATCH 带回 title/type/category/location 的服务端原值，满足 BFF immutable-field 契约；其他字段按现有编辑表单生成闭合 patch。
- 删除真实岗位时同步删除附属键。

- [ ] **Step 5: 运行映射、附属存储和类型测试**

Run:

```bash
npm test -- src/数据/后端映射.test.ts src/数据/前端附属数据.test.ts
npm run typecheck
```

Expected: 全部 exit 0。

- [ ] **Step 6: 提交**

```bash
git add src/数据/后端映射.ts src/数据/后端映射.test.ts src/数据/前端附属数据.ts src/数据/前端附属数据.test.ts src/状态/应用状态.tsx
git commit -m "feat: 增加意向与岗位后端映射"
```

---

### Task 5: 实现统一数据源选择和 Recruitment BFF 业务方法

**Files:**
- Create: `src/数据/HTTP招聘数据源.ts`
- Create: `src/数据/HTTP招聘数据源.test.ts`
- Modify: `src/数据/接口层.ts:1-55`
- Create: `src/数据/接口层.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4 的运行配置、HTTP client、DTO、映射和附属存储。
- Produces:
  - `HTTP招聘数据源` 的会话、角色、目录、简历、意向和岗位方法。
  - `招聘数据源选择 = { 模式: 'mock' } | { 模式: 'backend'; 后端: HTTP招聘数据源 }`。
  - `创建招聘数据源(config, deps)` 和默认 `招聘数据`。

- [ ] **Step 1: 写数据源选择和业务调用失败测试**

```ts
// src/数据/接口层.test.ts
import { vi } from 'vitest';
import type { HTTP招聘数据源 } from './HTTP招聘数据源';

it('缺省只选择 Mock，且不构造 HTTP 数据源', () => {
  const 创建HTTP = vi.fn();
  expect(创建招聘数据源({ 数据源: 'mock', 后端环境: 'stg' }, { 创建HTTP })).toEqual({ 模式: 'mock' });
  expect(创建HTTP).not.toHaveBeenCalled();
});

it('Backend 失败直接向上抛出，不返回模拟数据', async () => {
  const 读取岗位 = vi.fn().mockRejectedValue(new BFF错误(503, 'recruitment_service_unavailable', 'down'));
  const 后端 = { 读取岗位 } as unknown as HTTP招聘数据源;
  const source = 创建招聘数据源({ 数据源: 'backend', 后端环境: 'stg' }, { 创建HTTP: () => 后端 });
  if (source.模式 !== 'backend') throw new Error('测试配置必须选择 backend');
  await expect(source.后端.读取岗位()).rejects.toMatchObject({ code: 'recruitment_service_unavailable' });
  expect(读取岗位).toHaveBeenCalledTimes(1);
});
```

```ts
// src/数据/HTTP招聘数据源.test.ts
import { BFF简历样本 } from '../测试/BFF样本';
import type { BFF请求选项 } from './HTTP客户端';
import { 从BFF简历 } from './后端映射';
import { 创建岗位附属存储 } from './前端附属数据';

function 内存附属存储() {
  const values = new Map<string, string>();
  return 创建岗位附属存储({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
}

it('手机登录使用 +86 E.164 和两次独立幂等操作', async () => {
  const 请求 = vi.fn(async (options: BFF请求选项) => {
    if (options.path === '/api/v1/auth/login-attempts') {
      return { result: { attempt_id: 'att_1', next_action: { type: 'enter_code' } }, etag: null, requestId: 'r1' };
    }
    return { result: { identity_id: 'id_1', session_id: 'sess_1', expires_at: '2026-08-25T00:00:00Z', next_action: { type: 'completed' } }, etag: null, requestId: 'r2' };
  });
  const source = 创建HTTP招聘数据源({ client: { 请求 }, 后端环境: 'stg', 附属存储: 内存附属存储() });
  const attempt = await source.开始手机登录('13800000000');
  await source.完成手机登录(attempt.attempt_id, '1234');
  expect(请求.mock.calls.map(([options]) => options)).toMatchObject([
    { path: '/api/v1/auth/login-attempts', method: 'POST', body: { provider: 'phone_otp', input: { phone: '+8613800000000' } }, 幂等: true },
    { path: `/api/v1/auth/login-attempts/${attempt.attempt_id}/complete`, method: 'POST', body: { proof: { code: '1234' } }, 幂等: true },
  ]);
});

it('保存简历按快照 diff 写 singleton/entries 后重新 GET', async () => {
  const 请求 = vi.fn(async (options: BFF请求选项) => {
    if (options.method === 'POST') return { result: { entry: { kind: 'experience', experience: BFF简历样本.experiences[0] }, aggregate_revision: 10 }, etag: null, requestId: 'r2' };
    return { result: BFF简历样本, etag: '"4"', requestId: 'r1' };
  });
  const source = 创建HTTP招聘数据源({ client: { 请求 }, 后端环境: 'stg', 附属存储: 内存附属存储() });
  const 旧页面 = 从BFF简历(BFF简历样本);
  const 新页面 = {
    ...旧页面,
    基本信息: { ...旧页面.基本信息, 真名: '新名字' },
    技能: [...旧页面.技能, 'React'],
    经历: [...旧页面.经历, { ...旧页面.经历[0], 编号: 'local-new', 公司: '新公司' }],
  };
  await source.保存简历(新页面, BFF简历样本);
  expect(请求.mock.calls.map(([options]) => [options.method ?? 'GET', options.path, options.ifMatch ?? null])).toEqual([
    ['PATCH', '/api/v1/me/resume/profile', '"2"'],
    ['PATCH', '/api/v1/me/resume/skills', '"3"'],
    ['POST', '/api/v1/me/resume/experiences', null],
    ['GET', '/api/v1/me/resume', null],
  ]);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/数据/接口层.test.ts src/数据/HTTP招聘数据源.test.ts`

Expected: FAIL，缺少新工厂和 HTTP 数据源。

- [ ] **Step 3: 定义 HTTP 数据源的精确方法**

```ts
export interface HTTP招聘数据源 {
  恢复会话(): Promise<BFF当前会话>;
  开始手机登录(手机号11位: string): Promise<BFF登录尝试>;
  开始微信登录(): Promise<BFF登录尝试>;
  完成手机登录(attemptId: string, code4位: string): Promise<BFF当前会话>;
  退出登录(): Promise<void>;
  读取主体(): Promise<BFF主体>;
  确保角色(role: BFF角色): Promise<BFF主体>;
  记录当前角色(role: BFF角色): Promise<BFF主体>;
  读取简历(): Promise<页面简历快照>;
  保存简历(next: 页面简历写入, previous: BFF简历): Promise<页面简历快照>;
  读取意向(): Promise<页面意向快照>;
  创建意向(draft: 意向草稿型, context: 意向映射上下文): Promise<页面意向快照>;
  创建首次意向(input: 首次意向输入, context: Omit<意向映射上下文, '原始'>): Promise<页面意向快照>;
  更新意向(id: string, draft: 意向草稿型, context: 意向映射上下文): Promise<页面意向快照>;
  删除意向(id: string, revision: number): Promise<页面意向快照>;
  读取岗位(): Promise<页面岗位快照>;
  创建岗位(job: 在招岗位, context: 岗位映射上下文): Promise<页面岗位快照>;
  更新岗位(job: 在招岗位, previous: BFFOwnerJob, context: 岗位映射上下文): Promise<页面岗位快照>;
  归档岗位(id: string, revision: number): Promise<页面岗位快照>;
  重开岗位(id: string, revision: number): Promise<页面岗位快照>;
  删除岗位(id: string, revision: number): Promise<页面岗位快照>;
}

export function 创建HTTP招聘数据源(deps: {
  client: Pick<ReturnType<typeof 创建BFF客户端>, '请求'>;
  后端环境: 后端环境;
  附属存储: 岗位附属存储;
}): HTTP招聘数据源;
```

- [ ] **Step 4: 实现接口路径、分页和目录精确解析**

使用以下固定路径：

- 会话：`GET /api/v1/session`、`POST /api/v1/auth/logout`。
- 主体：`GET /api/v1/me`、`PUT /api/v1/me/roles/{role}` body `{}`、`PUT /api/v1/me/preferences/last-used-role`。
- Resume：OpenAPI 中 `/me/resume` 的 singleton、entry 和 nested project 路由。
- Intentions：`GET/POST /api/v1/me/intentions`、`GET/PATCH/DELETE /api/v1/me/intentions/{id}`。
- Jobs：`GET/POST /api/v1/recruiter/jobs`、`GET/PATCH/DELETE /api/v1/recruiter/jobs/{id}`、archive/reopen。
- Catalog：job-categories、locations、majors、industries、education-institutions。

Catalog resolver 使用 `?q=${encodeURIComponent(displayName)}`，遍历 `next_cursor`，只接受 `display_name === input` 且 selectable 的唯一项；缓存键为 `kind:q`。Jobs 列表遍历 cursor 直到 `next_cursor` 为 null；intentions 最多五条无需分页。

Resume 保存顺序固定为 profile → summary → skills → experiences/projects → educations → certificates；比较 `JSON.stringify` 后只写变化分区。任何中途失败都执行一次 `GET /api/v1/me/resume` 并把新快照附在错误上，Context 使用该权威快照恢复。

- [ ] **Step 5: 实现数据源判别联合**

```ts
export type 招聘数据源选择 =
  | { 模式: 'mock' }
  | { 模式: 'backend'; 后端环境: 后端环境; 后端: HTTP招聘数据源 };

export function 创建招聘数据源(config: 运行配置, deps = 默认依赖): 招聘数据源选择 {
  if (config.数据源 === 'mock') return { 模式: 'mock' };
  return { 模式: 'backend', 后端环境: config.后端环境, 后端: deps.创建HTTP(config.后端环境) };
}
```

保留 `src/数据/接口层.ts` 中原有未支持演示读取函数供现状使用，但删除“屏幕永远不直接 import 模拟数据”的失实注释；明确这些函数只属于未接后端的演示域。不得在 `catch` 中返回 `模拟数据源`。

- [ ] **Step 6: 运行数据源测试和全量单测**

Run:

```bash
npm test -- src/数据/接口层.test.ts src/数据/HTTP招聘数据源.test.ts
npm test
npm run typecheck
```

Expected: 全部 exit 0。

- [ ] **Step 7: 提交**

```bash
git add src/数据/HTTP招聘数据源.ts src/数据/HTTP招聘数据源.test.ts src/数据/接口层.ts src/数据/接口层.test.ts
git commit -m "feat: 实现招聘后端数据源"
```

---

### Task 6: 接入会话、登录、退出和角色同步

**Files:**
- Modify: `src/状态/应用状态.tsx:118-246,247-340,661-770,1454-1564`
- Modify: `src/状态/应用状态.test.ts`
- Modify: `src/应用.tsx:71-91`
- Modify: `src/屏幕/登录.tsx:25-83,180-207`
- Modify: `src/屏幕/选身份.tsx:25-66`
- Modify: `src/屏幕/设置.tsx:10-21,175-193`
- Modify: `src/屏幕/企业设置.tsx:9-19,119-134`
- Create: `src/屏幕/登录.test.tsx`

**Interfaces:**
- Consumes: `招聘数据源选择` 和现有 reducer。
- Produces: `use应用状态()` 新增 `后端状态` 与 `操作`，保留原 `状态/派发` 不变。

- [ ] **Step 1: 写 Provider 会话/角色失败测试**

```ts
// 追加 src/状态/应用状态.test.ts
import { screen } from '@testing-library/react';
import { BFF主体样本, BFF简历样本 } from '../测试/BFF样本';
import type { BFF角色 } from '../数据/BFF契约';
import type { HTTP招聘数据源 } from '../数据/HTTP招聘数据源';
import { 从BFF简历 } from '../数据/后端映射';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

function 创建后端桩(lastUsedRole: 'candidate' | 'recruiter' | null = 'candidate') {
  const 主体 = { ...BFF主体样本, last_used_role: lastUsedRole };
  return {
    恢复会话: vi.fn(async () => ({ identity_id: 'id_1', session_id: 'sess_1', expires_at: '2026-08-25T00:00:00Z' })),
    读取主体: vi.fn(async () => 主体),
    确保角色: vi.fn(async (role: BFF角色) => ({ ...主体, roles: [...主体.roles, { role, status: 'active' as const }] })),
    记录当前角色: vi.fn(async (role: BFF角色) => ({ ...主体, last_used_role: role })),
    读取简历: vi.fn(async () => 从BFF简历(BFF简历样本)),
    保存简历: vi.fn(async () => 从BFF简历(BFF简历样本)),
    读取意向: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    创建意向: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    更新意向: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    删除意向: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    读取岗位: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    创建岗位: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    更新岗位: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    归档岗位: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    重开岗位: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    删除岗位: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    开始手机登录: vi.fn(), 完成手机登录: vi.fn(), 开始微信登录: vi.fn(), 退出登录: vi.fn(),
  } as unknown as HTTP招聘数据源;
}

it('Backend 恢复会话与主体，角色完成后才派发切身份', async () => {
  const 后端 = 创建后端桩('candidate');
  function 探针() {
    const { 后端状态, 操作 } = use应用状态();
    return createElement('button', { onClick: () => 操作.切身份('招聘方') }, 后端状态.初始化);
  }
  render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端 } }, createElement(探针)));
  await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('完成'));
  await userEvent.click(screen.getByRole('button'));
  expect(后端.确保角色).toHaveBeenCalledWith('recruiter');
  expect(后端.记录当前角色).toHaveBeenCalledWith('recruiter');
  expect(后端.确保角色.mock.invocationCallOrder[0]).toBeLessThan(后端.记录当前角色.mock.invocationCallOrder[0]);
});

it('401 只清后端状态，不载入 Mock 支持域', async () => {
  const 后端 = 创建后端桩();
  后端.恢复会话.mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
  function 探针() {
    const { 后端状态, 状态 } = use应用状态();
    return createElement('output', null, JSON.stringify({ 后端状态, 岗位数: 状态.岗位列表.length, 意向数: 状态.求职意向表.length }));
  }
  render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端 } }, createElement(探针)));
  await waitFor(() => expect(screen.getByText(/"初始化":"完成"/)).toBeInTheDocument());
  expect(screen.getByText(/"已登录":false/)).toBeInTheDocument();
  expect(screen.getByText(/"岗位数":0/)).toBeInTheDocument();
  expect(screen.getByText(/"意向数":0/)).toBeInTheDocument();
});
```

- [ ] **Step 2: 写登录页失败测试，守住 4 格和请求完成后导航**

```tsx
// src/屏幕/登录.test.tsx
const mock跳转 = vi.fn();
const mock操作 = { 开始手机登录: vi.fn(), 完成手机登录: vi.fn(), 微信登录: vi.fn() };
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转 }) }));
vi.mock('../状态/应用状态', () => ({
  use应用状态: () => ({ 操作: mock操作, 数据源模式: 'backend' }),
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

it('保持四格验证码，并等待 Backend 登录成功才导航', async () => {
  const 完成 = deferred<void>();
  mock操作.开始手机登录.mockResolvedValue(undefined);
  mock操作.完成手机登录.mockReturnValue(完成.promise);
  render(<MemoryRouter><登录 /></MemoryRouter>);
  await userEvent.type(screen.getByLabelText('手机号'), '13800000000');
  await userEvent.click(screen.getByRole('button', { name: '获取验证码' }));
  expect(document.querySelectorAll('[class*="验证码格"]')).toHaveLength(4);
  await userEvent.type(screen.getByLabelText('短信验证码'), '1234');
  await userEvent.click(screen.getByText(/已阅读并同意/));
  await userEvent.click(screen.getByRole('button', { name: '进入' }));
  expect(mock跳转).not.toHaveBeenCalled();
  完成.resolve();
  await waitFor(() => expect(mock跳转).toHaveBeenCalledWith(路径.选身份));
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm test -- src/状态/应用状态.test.ts src/屏幕/登录.test.tsx`

Expected: FAIL，Context 尚无 `后端状态/操作`。

- [ ] **Step 4: 扩展 Context，不改 reducer 的 Mock 语义**

新增内部状态：

```ts
export interface 后端状态 {
  初始化: '跳过' | '进行中' | '完成';
  已登录: boolean;
  主体: BFF主体 | null;
  简历快照: BFF简历 | null;
  意向快照: Record<string, BFFOwnerIntention>;
  岗位快照: Record<string, BFFOwnerJob>;
}

export interface 应用操作 {
  开始手机登录(phone: string): Promise<void>;
  完成手机登录(code: string): Promise<void>;
  微信登录(): Promise<string | null>;
  退出登录(): Promise<void>;
  切身份(to: '求职者' | '招聘方'): Promise<void>;
  保存简历(next: 页面简历写入): Promise<void>;
  保存个人优势(text: string): Promise<void>;
  保存意向(draft: 意向草稿型): Promise<void>;
  保存首次意向(input: 首次意向输入): Promise<void>;
  删除意向(id: string): Promise<void>;
  发布岗位(job: 在招岗位): Promise<void>;
  更新岗位(job: 在招岗位): Promise<void>;
  归档岗位(id: string): Promise<void>;
  重开岗位(id: string): Promise<void>;
  删除岗位(id: string): Promise<void>;
}
```

在 reducer 的 `动作` 联合中加入三个只供 Provider 使用的内部动作：

```ts
| { 型: '水合后端简历'; 快照: 页面简历快照 }
| { 型: '水合后端意向'; 快照: 页面意向快照 }
| { 型: '水合后端岗位'; 快照: 页面岗位快照 }
```

三个分支只替换各自支持域：简历分支替换基本信息/优势/技能/经历/教育/证书，意向分支替换意向表并调用现有 `选新当前意向`，岗位分支替换岗位列表并调用现有 `选新当前岗`；不能覆盖未支持演示域。

Provider 接受可选 `数据源={招聘数据}` 便于测试。`use应用状态()` 的值精确扩展为 `{ 状态, 派发, 数据源模式, 后端状态, 操作 }`。Mock 分支设置 `初始化='跳过'`，每个操作同步派发现有 action 后返回 resolved Promise。Backend mount 只执行一次恢复会话；React StrictMode 下用 ref 阻止双请求。

Backend 初始化：

1. `GET session`；401 视为未登录并完成初始化，其他错误轻提示且仍不载入 Mock 支持域。
2. 已登录则 `GET me`。
3. `last_used_role` 存在时调用对应水合；为 null 时保持身份选择。
4. candidate 水合简历+意向，recruiter 水合岗位；未支持域保持当前演示状态。

Provider 初始化 reducer 时按数据源选种子：Mock 直接使用现有 `初始状态`；Backend 把 `求职意向表/岗位列表` 置空、`当前意向/当前岗位编号` 置空，并把简历支持域设为 `基本信息={ 真名: '', 开始工作年: '', 身份: '在职' }`、`个人优势=''`、经历/教育/技能/证书均为空数组，直到服务端水合。未支持域（市场、匹配、消息等）才保留演示种子。这样 Backend 失败不会短暂显示或保留支持域 Mock 数据。

- [ ] **Step 5: 复用现有路由 Loading 并接入登录/角色/退出**

- 导出但不改写 `路由加载中`；Backend `初始化='进行中'` 时 `应用` 返回同一个 `<路由加载中 />`。
- Backend 初始化完成且无会话时，非登录路径用现有 `<Navigate to={路径.登录} replace />`。
- Backend 已恢复会话且当前仍在登录页时：`last_used_role=candidate` 替换到求职主壳，`recruiter` 替换到企业主壳，null 替换到现有身份选择页；不新增中间页面。
- `登录.tsx` 保留全部 JSX/className/文案。Mock 分支继续当前即时行为；Backend 的取码/进入/微信按钮调用 Context 操作，使用 `useRef<boolean>` 阻止重复点击，不增加 disabled class 或 Loading 文案。
- Backend 手机登录保存 `attempt_id` 在 Provider ref；完成时仍原样发送 4 位 code。
- Backend 微信按钮调用 `操作.微信登录()`，返回非空 redirect URL 后执行 `window.location.assign(url)`；Mock 操作返回 null，页面仍直接去身份页。目标环境若拒绝测试用 WeChat provider，则复用轻提示，不回退 Mock。
- `选身份.tsx` 保留 950ms 翻面动画；计时结束后先 `await 操作.切身份`，成功才执行当前 `替换跳转`，失败复用 `轻提示` 并允许再次点击。
- 两个设置页的退出确认按钮先 `await 操作.退出登录()`，成功后按当前方式 `替换跳转(路径.登录)`；不改弹层 DOM/CSS。

- [ ] **Step 6: 运行会话测试、全量单测和现有 onboarding E2E**

Run:

```bash
npm test -- src/状态/应用状态.test.ts src/屏幕/登录.test.tsx
npm test
npm run build
npx playwright test e2e/onboarding.spec.ts
```

Expected: 全部 exit 0；现有 Mock onboarding 行为不变。

- [ ] **Step 7: 提交**

```bash
git add src/状态/应用状态.tsx src/状态/应用状态.test.ts src/应用.tsx src/屏幕/登录.tsx src/屏幕/登录.test.tsx src/屏幕/选身份.tsx src/屏幕/设置.tsx src/屏幕/企业设置.tsx
git commit -m "feat: 接入招聘登录与角色会话"
```

---

### Task 7: 接入候选人简历和求职意向操作

**Files:**
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`
- Modify: `src/屏幕/基本信息.tsx`
- Modify: `src/屏幕/学生分流.tsx`
- Modify: `src/屏幕/就读时间段.tsx`
- Modify: `src/屏幕/工作经历.tsx`
- Modify: `src/屏幕/引导问答.tsx`
- Modify: `src/屏幕/我的简历.tsx`
- Modify: `src/屏幕/最高学历.tsx`
- Modify: `src/屏幕/毕业院校.tsx`
- Modify: `src/屏幕/求职状态.tsx`
- Modify: `src/屏幕/选专业.tsx`
- Modify: `src/屏幕/添加意向.tsx`
- Create: `src/屏幕/添加意向.test.tsx`

**Interfaces:**
- Consumes: Task 6 的 `应用操作.保存简历/保存意向/删除意向`。
- Produces: Backend 权威简历/意向写入，Mock 操作与当前 reducer 完全相同。

- [ ] **Step 1: 写 Context 成功、失败和并发测试**

```ts
it('Backend 简历保存成功后才派发服务端映射结果', async () => {
  let 当前!: ReturnType<typeof use应用状态>;
  function 上下文探针() { 当前 = use应用状态(); return null; }
  const 后端 = 创建后端桩('candidate');
  const 保存完成 = deferred<页面简历快照>();
  vi.mocked(后端.保存简历).mockReturnValue(保存完成.promise);
  render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端 } }, createElement(上下文探针)));
  await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
  const 页面 = 从BFF简历(BFF简历样本);
  const 页面写入: 页面简历写入 = { 基本信息: 页面.基本信息, 个人优势: 页面.个人优势, 技能: 页面.技能, 经历: 页面.经历, 教育: 页面.教育, 证书: 页面.证书 };
  const 请求 = 当前.操作.保存简历({ ...页面写入, 基本信息: { ...页面.基本信息, 真名: '新名' } });
  expect(当前.状态.基本信息.真名).toBe('沈亦舟');
  保存完成.resolve({ ...页面, 基本信息: { ...页面.基本信息, 真名: '新名' } });
  await 请求;
  await waitFor(() => expect(当前.状态.基本信息.真名).toBe('新名'));
});

it('部分保存失败时采用错误携带的重新读取快照且不使用 Mock', async () => {
  let 当前!: ReturnType<typeof use应用状态>;
  function 上下文探针() { 当前 = use应用状态(); return null; }
  const 后端 = 创建后端桩('candidate');
  const 权威 = 从BFF简历({ ...BFF简历样本, skills: ['服务端权威技能'], skills_revision: 4 });
  vi.mocked(后端.保存简历).mockRejectedValue(Object.assign(new BFF错误(409, 'version_conflict', 'stale'), { 权威简历: 权威 }));
  render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端 } }, createElement(上下文探针)));
  await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
  const 页面 = 从BFF简历(BFF简历样本);
  const 页面写入: 页面简历写入 = { 基本信息: 页面.基本信息, 个人优势: 页面.个人优势, 技能: 页面.技能, 经历: 页面.经历, 教育: 页面.教育, 证书: 页面.证书 };
  await expect(当前.操作.保存简历({ ...页面写入, 技能: ['本地未确认技能'] })).rejects.toMatchObject({ code: 'version_conflict' });
  await waitFor(() => expect(当前.状态.简历技能).toEqual(['服务端权威技能']));
  expect(当前.状态.简历技能).not.toContain('本地未确认技能');
});

it('同一个 Backend 写操作进行中时拒绝重复提交', async () => {
  let 当前!: ReturnType<typeof use应用状态>;
  function 上下文探针() { 当前 = use应用状态(); return null; }
  const 后端 = 创建后端桩('candidate');
  const 完成 = deferred<页面意向快照>();
  vi.mocked(后端.创建意向).mockReturnValue(完成.promise);
  render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端 } }, createElement(上下文探针)));
  await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
  const 草稿 = { 编辑编号: null, 求职类型: '全职' as const, 工作城市: '上海', 期望职位: '产品经理', 感兴趣城市们: [], 薪资下限: 10, 薪资上限: 20, 期望行业们: [], 后端招聘类型: null, 求职类型已改: false };
  const 第一次 = 当前.操作.保存意向(草稿);
  const 第二次 = 当前.操作.保存意向(草稿);
  expect(后端.创建意向).toHaveBeenCalledTimes(1);
  完成.resolve({ 列表: [], 服务端: {} });
  await Promise.all([第一次, 第二次]);
});
```

- [ ] **Step 2: 写添加意向页面失败测试**

```tsx
const mock返回 = vi.fn();
const mock保存意向 = vi.fn();
const 草稿 = { 编辑编号: null, 求职类型: '全职', 工作城市: '上海', 期望职位: '产品经理', 感兴趣城市们: [], 薪资下限: 10, 薪资上限: 20, 期望行业们: [], 后端招聘类型: null, 求职类型已改: false } as const;
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: vi.fn(), 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({
  use应用状态: () => ({ 状态: { 意向草稿: 草稿 }, 派发: vi.fn(), 操作: { 保存意向: mock保存意向, 删除意向: vi.fn() } }),
}));

it('保存 Backend 意向成功后才返回，失败复用轻提示', async () => {
  const 完成 = deferred<void>();
  mock保存意向.mockReturnValue(完成.promise);
  render(<MemoryRouter initialEntries={['/intentions/new']}><Routes><Route path="/intentions/new" element={<添加意向 />} /></Routes></MemoryRouter>);
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(mock返回).not.toHaveBeenCalled();
  完成.resolve();
  await waitFor(() => expect(mock返回).toHaveBeenCalled());
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm test -- src/状态/应用状态.test.ts src/屏幕/添加意向.test.tsx`

Expected: FAIL，候选操作尚未写入后端。

- [ ] **Step 4: 实现候选 Context 操作**

- `保存简历` 用 `后端状态.简历快照` 做 If-Match/diff 基线；成功派发 Task 6 已定义的内部 action `水合后端简历`，只替换基本信息、优势、技能、经历、教育、证书。
- `保存个人优势` 在 Mock 模式派发现有 `存个人优势`；Backend 模式把文本合入当前页面简历快照后复用 `保存简历`，从而只 PATCH summary。
- `保存首次意向` 在 Mock 模式是 no-op，保持当前预置意向不增加；Backend 仅在当前真实意向列表为空时创建一条，已有意向时 no-op，防止重复走向导制造重复数据。
- 作品集链接和文件名继续沿用当前 `AGXP简历v2`，不发送 BFF。
- `保存意向` 根据 `草稿.编辑编号` 选择 create/update；成功用整张服务端意向列表水合 `求职意向表` 并重算 `当前意向`。
- `删除意向` 使用服务端 revision；成功重新读取列表。
- 401 统一清会话；409 version conflict 重新读取；422 映射现有轻提示；不 catch 后 dispatch 原 action。
- 用 `useRef<Set<string>>` 锁定 `简历保存`、`意向:${id|new}`，finally 解锁。

- [ ] **Step 5: 改候选屏幕调用点，不改 JSX/CSS**

把列出的九个 `存简历` 调用改成 `await 操作.保存简历({...})`，成功后执行原导航；Mock 操作内部仍同步 dispatch。

`引导问答.tsx` 的最后一题先 `await 操作.保存个人优势(自我介绍)`，再调用：

```ts
await 操作.保存首次意向({
  职位们: 已选职位,
  城市们: 已选城市,
  薪资: { 下限: 薪资下限, 上限: 薪资上限, 单位: 当前薪资单位 },
  筛选偏好: 全局.引导预填?.筛选偏好 ?? 默认求职初筛偏好(全局.基本信息.身份 === '在校'),
  排除项,
});
```

两次真实写入都成功后才走当前 `向导出口`；错误复用轻提示并停留当前题。作品集链接仍派发现有本地 action，不进入 BFF。首次意向映射使用筛选偏好中的主要求职类型、毕业月、实习月数、到岗天数和办公方式；四个内置排除项分别映射 BFF 的四个 exclusions，自定义排除项拼入 `private_preferences`，不丢弃也不伪造新 wire 字段。

`我的简历.tsx` 的姓名行内编辑是特例：使用本地 `姓名草稿` 保持逐字输入，只在 blur/Enter 调一次 `操作.保存简历`，避免每个按键产生 HTTP PATCH。输入框、className、label 和布局不变。

`添加意向.tsx`：

```ts
const 提交 = async () => {
  if (!可保存) return;
  try {
    await 操作.保存意向(草稿);
    派发({ 型: '清意向草稿' });
    返回();
  } catch (error) {
    轻提示(取后端错误文案(error));
  }
};
```

删除路径同样成功后返回；Mock 下 `操作` 派发当前 `新增/改/删意向`，DOM 与流程不变。

- [ ] **Step 6: 运行候选测试与 onboarding 回归**

Run:

```bash
npm test -- src/状态/应用状态.test.ts src/屏幕/添加意向.test.tsx
npm test
npx playwright test e2e/onboarding.spec.ts
npm run typecheck
```

Expected: 全部 exit 0。

- [ ] **Step 7: 提交**

```bash
git add src/状态/应用状态.tsx src/状态/应用状态.test.ts src/屏幕/基本信息.tsx src/屏幕/学生分流.tsx src/屏幕/就读时间段.tsx src/屏幕/工作经历.tsx src/屏幕/引导问答.tsx src/屏幕/我的简历.tsx src/屏幕/最高学历.tsx src/屏幕/毕业院校.tsx src/屏幕/求职状态.tsx src/屏幕/选专业.tsx src/屏幕/添加意向.tsx src/屏幕/添加意向.test.tsx
git commit -m "feat: 接入真实简历与求职意向"
```

---

### Task 8: 接入招聘方职位 CRUD、归档与重开

**Files:**
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`
- Modify: `src/屏幕/发布岗位.tsx:248-315,450-480`
- Modify: `src/屏幕/岗位管理.tsx:35-80,175-200`
- Modify: `src/屏幕/岗位详情.tsx:300-355`
- Create: `src/屏幕/发布岗位.test.tsx`

**Interfaces:**
- Consumes: `应用操作.发布岗位/更新岗位/归档岗位/重开岗位/删除岗位`。
- Produces: 真实岗位 ID/revision 驱动的岗位状态；Mock 继续当前起步候选演示。

- [ ] **Step 1: 写 Context 岗位失败测试**

```ts
import { BFF岗位样本, 页面岗位样本 } from '../测试/BFF样本';

it('Backend 发布岗位使用服务端 ID，且不播种 Mock 起步候选', async () => {
  let 当前!: ReturnType<typeof use应用状态>;
  function 上下文探针() { 当前 = use应用状态(); return null; }
  const 后端 = 创建后端桩('recruiter');
  const 服务端岗位 = { ...BFF岗位样本, job_id: 'job_real_1' };
  vi.mocked(后端.创建岗位).mockResolvedValue({ 列表: [{ ...页面岗位样本, 编号: 'job_real_1' }], 服务端: { job_real_1: 服务端岗位 } });
  render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端 } }, createElement(上下文探针)));
  await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
  await 当前.操作.发布岗位({ ...页面岗位样本, 编号: 'P-临时' });
  expect(当前.状态.岗位列表[0].编号).toBe('job_real_1');
  expect(当前.状态.企业候选列表.some((item) => item.岗位编号 === 'job_real_1')).toBe(false);
});

it('Backend 更新使用当前 revision，409 后重新读取而不覆盖', async () => {
  let 当前!: ReturnType<typeof use应用状态>;
  function 上下文探针() { 当前 = use应用状态(); return null; }
  const 后端 = 创建后端桩('recruiter');
  const 初始 = { 列表: [页面岗位样本], 服务端: { [BFF岗位样本.job_id]: BFF岗位样本 } };
  const 最新列表 = [{ ...页面岗位样本, 名称: '服务端最新岗位名' }];
  vi.mocked(后端.读取岗位).mockResolvedValueOnce(初始).mockResolvedValueOnce({ 列表: 最新列表, 服务端: 初始.服务端 });
  vi.mocked(后端.更新岗位).mockRejectedValue(new BFF错误(409, 'version_conflict', 'stale'));
  render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端 } }, createElement(上下文探针)));
  await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
  await expect(当前.操作.更新岗位({ ...页面岗位样本, 名称: '本地冲突名称' })).rejects.toMatchObject({ code: 'version_conflict' });
  expect(后端.读取岗位).toHaveBeenCalledTimes(2);
  expect(当前.状态.岗位列表).toEqual(最新列表);
});
```

- [ ] **Step 2: 写发布岗位组件失败测试**

```tsx
import { 页面岗位样本 } from '../测试/BFF样本';

const mock返回 = vi.fn();
const mock更新岗位 = vi.fn();
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: mock返回, 进企业主壳: vi.fn(), 替换跳转: vi.fn() }) }));
vi.mock('../状态/应用状态', () => ({
  use应用状态: () => ({ 状态: { 岗位列表: [页面岗位样本], 企业候选列表: [] }, 派发: vi.fn(), 操作: { 更新岗位: mock更新岗位, 发布岗位: vi.fn(), 删除岗位: vi.fn() } }),
}));

it('Backend 编辑保存成功前不导航', async () => {
  const 完成 = deferred<void>();
  mock更新岗位.mockReturnValue(完成.promise);
  render(<MemoryRouter initialEntries={['/hr/post-job/job_1']}><Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes></MemoryRouter>);
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(mock返回).not.toHaveBeenCalled();
  完成.resolve();
  await waitFor(() => expect(mock返回).toHaveBeenCalled());
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm test -- src/状态/应用状态.test.ts src/屏幕/发布岗位.test.tsx`

Expected: FAIL，页面仍直接 dispatch。

- [ ] **Step 4: 实现岗位 Context 操作**

- Backend create/update/archive/reopen/delete 成功后统一用 `页面岗位快照` 水合岗位列表和 revision map。
- create 成功后写入附属数据，键使用响应的真实 job ID；不能用页面临时 `P-xx`。
- update 成功后更新同 ID 附属数据。
- delete 成功后删除附属数据。
- archive/reopen/update/delete 从 `后端状态.岗位快照[id].revision` 生成强 ETag `"${revision}"`。
- 409/version conflict 和 503/outcome unknown 最终仍不确定时调用 `读取岗位()`；不派发 Mock 岗位 action。
- Mock 分支原样派发 `发布岗位/更新岗位/停止招聘/重开岗位/删除岗位`，保留现有起步候选体验。

- [ ] **Step 5: 改三个岗位屏幕的调用顺序**

- `发布岗位.tsx`：组装字段和校验不动；用 `await 操作.发布岗位/更新岗位`，成功才显示当前轻提示和导航。
- 两处删除确认改为 `await 操作.删除岗位`，失败保留弹层或关闭后使用现有轻提示；不增加 Loading 状态。
- `岗位管理.tsx` 和 `岗位详情.tsx` 的停止/重开改为对应操作，成功后复用原提示。
- 每个页面用 ref 锁避免重复点击；不改变按钮 `className`、文案或 disabled 样式。

- [ ] **Step 6: 运行岗位测试和回归**

Run:

```bash
npm test -- src/状态/应用状态.test.ts src/屏幕/发布岗位.test.tsx
npm test
npx playwright test e2e/onboarding.spec.ts
npm run build
```

Expected: 全部 exit 0；现有 Mock 发岗 E2E 仍看到 `AI 产品实习生`。

- [ ] **Step 7: 提交**

```bash
git add src/状态/应用状态.tsx src/状态/应用状态.test.ts src/屏幕/发布岗位.tsx src/屏幕/发布岗位.test.tsx src/屏幕/岗位管理.tsx src/屏幕/岗位详情.tsx
git commit -m "feat: 接入真实招聘岗位数据"
```

---

### Task 9: 补齐文档、零视觉回归和最终验证

**Files:**
- Create: `e2e/数据源模式.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: 完成后的运行配置和 UI。
- Produces: 可执行的 Local/STG 联调说明与默认 Mock 回归门。

- [ ] **Step 1: 写默认 Mock/零视觉 E2E**

```ts
// e2e/数据源模式.spec.ts
import { expect, test } from '@playwright/test';

test('缺省数据源保持 PM Mock 登录体验和四格验证码', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
  });
  await page.goto('/');
  await page.getByLabel('手机号').fill('13800000000');
  await page.getByRole('button', { name: '获取验证码' }).click();
  await expect(page.locator('[class*="验证码格"]')).toHaveCount(4);
  await page.getByLabel('短信验证码').fill('1234');
  await page.getByText(/已阅读并同意/).click();
  await page.getByRole('button', { name: '进入' }).click();
  await expect(page).toHaveURL(/#\/identity$/);
  expect(apiRequests).toEqual([]);
  await expect(page.getByText('数据源')).toHaveCount(0);
  await expect(page.getByText(/backend|stg|local/i)).toHaveCount(0);
});
```

- [ ] **Step 2: 先运行 E2E，确认默认 Mock 门通过**

Run: `npx playwright test e2e/数据源模式.spec.ts`

Expected: PASS；这是对已经实现的默认行为做验收测试，不要求人为制造 red 状态。

- [ ] **Step 3: 更新 README**

加入以下原样可执行内容：

````md
### 数据源

缺省不设置环境变量即使用 Mock。真实后端只用于本地 Vite dev：

```bash
VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=stg npm run dev
VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local npm run dev
```

Local BFF 必须监听 `127.0.0.1:8097`，并配置：

```dotenv
RECRUITMENT_BFF_ENV=test
RECRUITMENT_BFF_PUBLIC_ORIGIN=http://localhost:5173
```

浏览器使用 `http://localhost:5173`。前端保持 4 位验证码；目标 BFF 必须先支持 4 位 OTP。
````

README 同时列出：

- Backend 真实域：登录/会话/角色、目录、简历、求职意向、招聘方岗位。
- 演示域：市场发现、匹配/评价、消息、规则、AI 简报、会话和历史。
- 接口失败不回退 Mock。
- `加分关键词/实习转正` 是按后端环境+岗位 ID 保存的本浏览器附属数据；作品集/附件文件名也仅留本地，不跨设备同步。

- [ ] **Step 4: 运行最终自动化验证**

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright test
```

Expected: 所有命令 exit 0，Vitest/Playwright 输出 0 failures。

- [ ] **Step 5: 验证本分支没有视觉资源改动**

Run:

```bash
test -z "$(git diff --name-only 93fe768..HEAD -- '*.css' '*.module.css' 'src/组件/通用.tsx' 'src/样式/*')"
git diff --check 93fe768..HEAD
```

Expected: 第一条无输出且 exit 0；第二条无 whitespace error。允许修改 `src/应用.tsx` 只为复用已有 `路由加载中`，不得改其 JSX/style object。

- [ ] **Step 6: 人工联调 Local**

Run frontend:

```bash
VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local npm run dev -- --host localhost --port 5173
```

With BFF configured as documented, verify in `http://localhost:5173`:

1. 4 位 OTP 可在后端改造完成后登录；此前应得到现有轻提示而不是 Mock 登录。
2. candidate 登录/角色选择后能读取并保存简历和意向。
3. recruiter 登录/角色选择后能读取、发布、编辑、归档、重开和删除岗位。
4. 断开 BFF 后，真实简历/意向/岗位不变成演示数据。
5. 重复点击不会创建两个意向或岗位。

- [ ] **Step 7: 人工联调 STG**

Run:

```bash
VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=stg npm run dev -- --host localhost --port 5173
```

在浏览器 Network 面板确认：请求路径为同源 `/api/v1`、Cookie 为 HttpOnly、mutation 经代理后的 Host/Origin 为 `https://recruitment-stg.agxp.ai`。重复 Local 的候选/招聘方读写检查，并验证 401、409、503 没有 Mock 回退或重复创建。

- [ ] **Step 8: 提交**

```bash
git add README.md e2e/数据源模式.spec.ts
git commit -m "docs: 补充招聘后端联调与回归门"
```

- [ ] **Step 9: 最终提交审计**

Run:

```bash
git status --short
git log --oneline 93fe768..HEAD
```

Expected: worktree clean；日志中每个 Task 至少一个独立提交，且无 `~/agxp-monorepo` 变更。
