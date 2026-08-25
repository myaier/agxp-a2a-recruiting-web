# 招聘已接线 API 跑通与数据层对齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在优先保持 PM 现有 UI 的前提下，让 Backend 模式只用已经接线的 Recruitment BFF API 跑通登录/角色、五类目录、简历、求职意向和招聘岗位；目录按需加载、选择即保存真实 ID，Backend 失败不混入 Mock。

**Architecture:** 保留现有 Mock/Backend 判别与中文页面模型，在数据层增加闭合目录查询接口和最小 `目录选择值`。Backend 表单的字符串继续负责渲染，但与同生命周期的目录引用原子更新；写入直接取 ID。Catalog 不参与初始化水合，只在选择器打开/搜索/翻页时查询。资源 owner DTO 始终是服务端权威，UI 未表达字段从最新 owner DTO 保留。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、Testing Library、Playwright；不增加依赖、状态库、请求框架或缓存框架。

**Spec:** `docs/superpowers/specs/2026-08-25-recruitment-wired-api-integration-design.md`

**Implementation baseline:** `a6c4432d291337e13f63eca27f200921a91d21fb`

## Global Constraints

- 本计划不使用 `/development-workflow`；不生成 manifest、handoff、admission、ledger 或执行提示词。
- 只消费当前 `HTTP招聘数据源` 已经接线的 API；不新增评价、匹配、文件、消息、规则、微信验证等端点。
- 4 位验证码由另一分支处理，本计划不得修改验证码格数、请求字段或相关断言。
- 优先保持 PM 已确认的页面、路由、CSS、布局、控件和文案。只允许为受控选择、学校消歧、办公方式必填、真实错误状态做最小行为改动。
- Mock 模式继续使用本地字典和现有演示数据；Backend 已支持域只使用 BFF，失败不得回退 Mock。
- 不设置 `VITE_DATA_SOURCE` 时必须保持 Mock；仅设置 `VITE_BACKEND_ENV` 不得构造 HTTP 数据源或发出 `/api/v1` 请求。只有显式 `VITE_DATA_SOURCE=backend` 才启用真实分支，切换变量后必须重启 Vite。
- Backend Provider 不得读写 PM 的 `AGXP简历v2`、`AGXP求职筛选v1` 等 Mock 持久化键。确需跨刷新保留的 Backend 草稿至少按 `VITE_BACKEND_ENV` 隔离，并在退出、401、主体切换时清理。
- Backend 启动/角色切换不得预取 Catalog；owner DTO 自带引用的回显不得依赖目录网络请求。
- Catalog 每次只读一页；调用方显式使用 cursor；禁止自动追完 cursor 或建立全量前端索引。
- taxonomy 非 selectable 节点必须保留用于导航，只有 selectable 项可提交。
- Backend 的受控字段在用户点选时保存 `{id, display_name}`；禁止按 `display_name` 反查 ID。
- 院校查询必须保留 `InstitutionItem.location` 并在候选副行显示“城市 · 国家”；Education 写入仍只含 institution ID，简历展示仍只显示学校名。
- 城市省级分组是前端视图配置：省只映射 `country_code/admin1_code` 查询，不进入 payload；具体城市必须来自 BFF。
- 所有 401/409/422/503 继续走现有轻提示、权威重读和相同幂等键策略，不新增全站错误系统。

## File Structure

| 文件 | 责任 |
| --- | --- |
| `src/数据/BFF契约.ts` | 定义 taxonomy/location/institution 的闭合 item DTO |
| `src/数据/招聘数据源类型.ts` | 定义查询参数、目录页、目录选择值与各表单引用元数据 |
| `src/数据/HTTP招聘数据源.ts` | 一页查询、同请求去重、会话缓存清理、active intentions 与资源写入 |
| `src/数据/后端映射.ts` | 直接用选择时保存的 ID，保留 owner DTO 未表达字段 |
| `src/状态/应用状态.tsx` | 资源独立水合、表单引用生命周期、401/409 行为 |
| `src/配置/运行配置.ts` | 保持缺省 Mock、显式 Backend 与 stg/local 代理边界 |
| `src/数据/城市与行业.ts` | 只保留省/热门展示配置，不再充当 Backend 可提交城市事实源 |
| 现有选择器屏幕 | 保持 UI 外壳，Backend 模式改为按需查询与引用选择 |
| 现有简历/意向/岗位屏幕 | 保存字符串与引用的原子更新，最小真实校验提示 |

---

### Task 1: 用闭合分页查询替换全量 Catalog 预取

**Files:**
- Modify: `src/数据/BFF契约.ts`
- Modify: `src/数据/招聘数据源类型.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/数据/HTTP招聘数据源.test.ts`

**Interfaces:**
- Produces:
  - `查询Taxonomy(kind, query): Promise<目录页<BFFTaxonomyItem>>`
  - `查询Location(query): Promise<目录页<BFFLocationItem>>`
  - `查询Institution(query): Promise<目录页<BFFInstitutionItem>>`
  - `清空目录缓存(): void`
- Cache key: endpoint + normalized filter + cursor；只缓存当前 session 已请求页面；同 key in-flight 去重。

- [ ] **Step 1: 写失败测试**

```ts
it('目录查询只请求一页且保留不可选 taxonomy 导航节点', async () => {
  请求.mockResolvedValueOnce({
    result: {
      items: [{ id: 'tax_root', display_name: '技术', parent_id: null, selectable: false }],
      next_cursor: 'next-1', catalog_version: 'v2',
    },
  });
  const source = 创建HTTP招聘数据源(依赖());
  await expect(source.查询Taxonomy('job-categories', { limit: 20 })).resolves.toEqual({
    items: [{ id: 'tax_root', display_name: '技术', parent_id: null, selectable: false }],
    nextCursor: 'next-1', catalogVersion: 'v2',
  });
  expect(请求).toHaveBeenCalledTimes(1);
});

it('相同 in-flight 查询去重，清缓存后重新请求', async () => {
  let resolve!: (value: unknown) => void;
  请求.mockReturnValue(new Promise((r) => { resolve = r; }));
  const source = 创建HTTP招聘数据源(依赖());
  const a = source.查询Location({ countryCode: 'CN', admin1Code: '31', limit: 20 });
  const b = source.查询Location({ countryCode: 'CN', admin1Code: '31', limit: 20 });
  expect(请求).toHaveBeenCalledTimes(1);
  resolve({ result: { items: [], next_cursor: null, catalog_version: 'v2' } });
  await Promise.all([a, b]);
  source.清空目录缓存();
  await source.查询Location({ countryCode: 'CN', admin1Code: '31', limit: 20 });
  expect(请求).toHaveBeenCalledTimes(2);
});

it('院校结果保留嵌套地点', async () => {
  请求.mockResolvedValueOnce({ result: { items: [{
    id: 'ins_1', display_name: '复旦大学',
    location: { id: 'loc_1', display_name: '上海市', country_code: 'CN', country_name: '中国', admin1_code: '31', admin1_name: '上海市', timezone: 'Asia/Shanghai', population: 0 },
  }], next_cursor: null, catalog_version: 'v2' } });
  const page = await 创建HTTP招聘数据源(依赖()).查询Institution({ q: '复旦', limit: 20 });
  expect(page.items[0].location).toMatchObject({ display_name: '上海市', country_name: '中国' });
});
```

- [ ] **Step 2: 运行测试并确认当前 API 缺失而失败**

Run: `npm test -- src/数据/HTTP招聘数据源.test.ts`

Expected: FAIL，`查询Taxonomy/查询Location/查询Institution` 不存在。

- [ ] **Step 3: 定义闭合 DTO 与页面查询类型**

```ts
export interface BFFTaxonomyItem extends BFF目录引用 {
  parent_id: string | null;
  selectable: boolean;
}
export interface BFFLocationItem extends BFF目录引用 {
  country_code: string;
  country_name: string;
  admin1_code: string | null;
  admin1_name: string | null;
  timezone: string;
  population: number;
}
export interface BFFInstitutionItem extends BFF目录引用 {
  location: BFFLocationItem;
}

export type 目录选择值 = BFF目录引用;
export interface 目录页<T> { items: T[]; nextCursor: string | null; catalogVersion: string }
export interface Taxonomy查询 { parentId?: string; q?: string; cursor?: string; limit?: number }
export interface Location查询 { q?: string; countryCode?: string; admin1Code?: string; cursor?: string; limit?: number }
export interface Institution查询 { q?: string; countryCode?: string; locationId?: string; cursor?: string; limit?: number }
```

- [ ] **Step 4: 实现一页查询和最小缓存**

```ts
function 编码查询(entries: [string, string | number | undefined][]): string {
  const params = new URLSearchParams();
  for (const [key, value] of entries) if (value !== undefined && value !== '') params.set(key, String(value));
  return params.toString();
}

async function 查询一页<T>(path: `/api/v1/catalog/${string}`, query: string): Promise<目录页<T>> {
  const key = `${path}?${query}`;
  const existing = 目录页面缓存.get(key) as Promise<目录页<T>> | undefined;
  if (existing) return existing;
  const pending = 请求<BFF目录页<T>>({ path: `${path}${query ? `?${query}` : ''}` as `/api/v1/${string}` })
    .then(({ result }) => ({ items: result.items, nextCursor: result.next_cursor, catalogVersion: result.catalog_version }))
    .catch((error) => { 目录页面缓存.delete(key); throw error; });
  目录页面缓存.set(key, pending);
  return pending;
}
```

三个公开方法只映射 query 参数；taxonomy endpoint 只允许 `job-categories|industries|majors`。本任务暂时保留旧 `读取目录/解析目录项/确保目录`，只供尚未迁移的 Resume/Intention/Job 写入调用；Task 2 移除初始化预取，Tasks 5–7 逐域迁移后由 Task 7 删除这些兼容方法。兼容期不得新增调用点。`查询Location` 固定映射 `/api/v1/catalog/locations`，`查询Institution` 固定映射 `/api/v1/catalog/education-institutions`。

- [ ] **Step 5: 运行测试并提交**

Run: `npm test && npm run typecheck`

Expected: PASS；既有全量目录测试继续覆盖临时兼容方法，新增测试覆盖分页方法。本任务还必须运行完整 `npm test`，保证中间提交没有已知红测试。

Commit: `refactor: 按页查询招聘目录`

---

### Task 2: 从初始化移除 Catalog，并修正错误/会话边界

**Files:**
- Modify: `src/数据/HTTP客户端.ts`
- Modify: `src/数据/HTTP客户端.test.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`
- Modify: `src/配置/运行配置.test.ts`

**Interfaces:**
- `BFF错误.fieldErrors: Array<{path:string; reason:string}>`。
- Candidate 水合并行读取 Resume 与 `status=active` Intention；Recruiter 只读取 Job pages。
- 退出和 401 调用 `清空目录缓存()`；409 重读对应资源。
- Mock 原型持久化 key 不在 Backend 分支读写；Backend 草稿 key 至少按 `stg/local` 分区。

- [ ] **Step 1: 写失败测试**

```ts
it('解析有序字段错误数组', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: {
    type: 'validation_failed', message: 'bad',
    fields: [{ path: 'compensation.lower', reason: 'required' }],
  } }), { status: 422, headers: { 'Content-Type': 'application/json' } }));
  await expect(创建BFF客户端({ fetcher, 生成幂等键: () => 'k' }).请求({ path: '/api/v1/me/intentions', method: 'POST', body: {} }))
    .rejects.toMatchObject({ fieldErrors: [{ path: 'compensation.lower', reason: 'required' }] });
});

it('candidate 初始化不读取目录并独立提交简历和 active 意向', async () => {
  const backend = 后端桩();
  backend.读取简历.mockResolvedValue(简历快照);
  backend.读取意向.mockResolvedValue(意向快照);
  renderProvider({ backend, role: 'candidate' });
  await waitFor(() => expect(backend.读取简历).toHaveBeenCalled());
  expect(backend.读取意向).toHaveBeenCalled();
  expect(backend.读取目录).not.toHaveBeenCalled();
  expect(backend.读取意向).toHaveBeenCalledWith();
});

it('交互式切换角色也不预取目录', async () => {
  const backend = 后端桩();
  renderProvider({ backend, role: 'candidate' });
  await 当前.操作.切身份('招聘方');
  await waitFor(() => expect(backend.读取岗位).toHaveBeenCalled());
  expect(backend.读取目录).not.toHaveBeenCalled();
});

it('Backend 水合和退出不覆盖 Mock 原型缓存', async () => {
  localStorage.setItem('AGXP简历v2', '{"PM":"mock-resume"}');
  localStorage.setItem('AGXP求职筛选v1', '{"PM":"mock-onboarding"}');
  const before = [localStorage.getItem('AGXP简历v2'), localStorage.getItem('AGXP求职筛选v1')];
  const { 当前 } = renderBackendProvider({ env: 'stg' });
  await 当前.操作.退出登录();
  expect([localStorage.getItem('AGXP简历v2'), localStorage.getItem('AGXP求职筛选v1')]).toEqual(before);
});
```

在数据源测试另断言请求 path 精确为 `/api/v1/me/intentions?status=active`。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- src/数据/HTTP客户端.test.ts src/状态/应用状态.test.ts src/数据/HTTP招聘数据源.test.ts`

Expected: FAIL，旧错误按对象解析，初始化仍调 `读取目录`，意向缺 status filter。

- [ ] **Step 3: 修改错误类型与解析**

```ts
export interface BFF字段错误 { path: string; reason: string }
export class BFF错误 extends Error {
  fieldErrors: BFF字段错误[];
}

const fields = Array.isArray(payload.error.fields)
  ? payload.error.fields.filter((item): item is BFF字段错误 =>
      typeof item?.path === 'string' && typeof item?.reason === 'string')
  : [];
```

- [ ] **Step 4: 删除目录水合，但暂时保留 legacy 写入 ref**

删除 `水合角色资源` 末尾的目录预取分支；暂时保留 `取目录/目录引用/读取目录`，只为 Tasks 5–7 尚未迁移的写入路径服务，并在注释中写明 Task 7 删除。candidate 资源使用 `Promise.allSettled` 独立派发，单项失败只提示该资源；recruiter 保持岗位读取。`读取意向` path 改为：

```ts
const { result } = await 请求<BFF意向列表>({ path: '/api/v1/me/intentions?status=active' });
```

退出与 401 cleanup 调 `后端.清空目录缓存()`；409 的现有 catch 分支按资源调用 `读取简历/读取意向/读取岗位` 后派发权威快照。

同时给原型持久化 effect 加明确模式边界：Backend 不得写 `AGXP简历v2`、`AGXP求职筛选v1`。Backend onboarding 若仍需刷新恢复，新增独立且包含 `后端环境` 的草稿键；读取只发生在 Backend 分支，退出、401 和 principal identity 变化时删除。不得把已水合的 Resume/Intention/Job 复制进该草稿，也不得把 Backend refs 降级写回 Mock 字符串缓存。

- [ ] **Step 5: 运行测试并提交**

Run: `npm test && npm run typecheck`

Expected: PASS。

Commit: `fix: 解耦招聘资源水合与目录`

---

### Task 3: 让城市选择器使用省级 filter 和真实 Location 引用

**Files:**
- Modify: `src/数据/城市与行业.ts`
- Modify: `src/数据/招聘数据源类型.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/屏幕/选工作城市.tsx`
- Create: `src/屏幕/选工作城市.test.tsx`
- Modify: `src/屏幕/选择城市.tsx`
- Modify: `src/屏幕/引导问答.tsx`

**Interfaces:**
- 展示配置：`城市分组配置 { 省:string; filters:{countryCode:string; admin1Code?:string}[] }`。
- Backend selected state: `目录选择值[]`；字符串 chips 使用 `display_name`。
- 直辖市为四个 CN admin1 filter 聚合；省名不进入 payload。

- [ ] **Step 1: 写失败组件测试**

```tsx
it('Backend 点击上海保存 Location ID，省标题不进入值', async () => {
  const 查询Location = vi.fn(async () => ({ items: [{
    id: 'loc_sh', display_name: '上海市', country_code: 'CN', country_name: '中国',
    admin1_code: '31', admin1_name: '上海市', timezone: 'Asia/Shanghai', population: 24870000,
  }], nextCursor: null, catalogVersion: 'v2' }));
  render城市页({ 数据源: 'backend', 查询Location });
  await user.click(screen.getByText('直辖市'));
  expect(查询Location).toHaveBeenCalledWith(expect.objectContaining({ countryCode: 'CN', admin1Code: '31' }));
  await user.click(await screen.findByText('上海市'));
  await user.click(screen.getByRole('button', { name: '保存' }));
  expect(派发).toHaveBeenCalledWith(expect.objectContaining({
    型: '存引导预填', 城市引用们: [{ id: 'loc_sh', display_name: '上海市' }],
  }));
});

it('Backend 搜索发送 q 而不扫描本地城市字典', async () => {
  render城市页({ 数据源: 'backend', 查询Location });
  await user.type(screen.getByPlaceholderText('搜索城市 / 省份'), '杭州市');
  await waitFor(() => expect(查询Location).toHaveBeenCalledWith(expect.objectContaining({ q: '杭州市' })));
});
```

- [ ] **Step 2: 运行测试并确认旧页面只读本地字符串**

Run: `npm test -- src/屏幕/选工作城市.test.tsx`

Expected: FAIL。

- [ ] **Step 3: 将城市字典收敛为视图 filter 配置**

```ts
export interface 城市分组配置 {
  省: string;
  filters: { countryCode: string; admin1Code?: string }[];
}
export const 城市分组: 城市分组配置[] = [
  { 省: '直辖市', filters: ['11', '12', '31', '50'].map((admin1Code) => ({ countryCode: 'CN', admin1Code })) },
  { 省: '广东', filters: [{ countryCode: 'CN', admin1Code: '44' }] },
  { 省: '浙江', filters: [{ countryCode: 'CN', admin1Code: '33' }] },
  { 省: '江苏', filters: [{ countryCode: 'CN', admin1Code: '32' }] },
];
```

实施时把当前全部省级标题映射为国家/行政区 code；港澳台分别使用 `HK/MO/TW`，海外保留展示组但不制造可提交值。Mock 的原 `城市字典/热门城市` 保留并只在 Mock 分支使用。

- [ ] **Step 4: 接入按需查询和引用 state**

组件保留现有 DOM/CSS。Backend 分支的 `城市键` 参数改为 `目录选择值`，点击以 ID 去重；搜索 250ms debounce；每组初次展开请求第一页，下一页只在现有滚动容器接近底部时请求 cursor。`状态.引导预填` 与 `意向草稿` 分别新增 `城市引用们`、`工作城市引用/感兴趣城市引用们`，reducer 每次同时写字符串与引用。`存引导预填` action 必须同时携带两者：没有 refs 时显式写空数组，禁止保留旧 refs。Backend 退出、401 与后端环境切换时只清空 Task 2 定义的 Backend 专用草稿 refs，避免跨 session/环境提交陈旧 ID；不得清空或重写 Mock 的 `AGXP求职筛选v1`。同一 session、同一后端环境的 onboarding 刷新仍可恢复 refs。

- [ ] **Step 5: 迁移另一个意向城市多选页并验证 UI**

`选择城市.tsx` 复用同一查询 hook/纯 helper，不新增通用框架；主城市 ID 不进入 alternate 引用列表，仍保持 0/9 限制。

Run: `npm test -- src/屏幕/选工作城市.test.tsx src/状态/应用状态.test.ts && npm run typecheck`

Expected: PASS；Mock 测试证明现有本地城市与 DOM 不变。

- [ ] **Step 6: 提交**

Commit: `feat: 用后端地点驱动城市选择`

---

### Task 4: 让职位、行业、专业和学校选择器按需查询

**Files:**
- Modify: `src/屏幕/选期望职位.tsx`
- Modify: `src/屏幕/选期望行业.tsx`
- Modify: `src/屏幕/选专业.tsx`
- Modify: `src/屏幕/毕业院校.tsx`
- Modify: `src/屏幕/引导问答.tsx`
- Modify: `src/屏幕/工作经历.tsx`
- Modify: `src/数据/类型.ts`
- Modify: `src/数据/招聘数据源类型.ts`
- Modify: `src/状态/应用状态.tsx`
- Create: `src/屏幕/选期望职位.test.tsx`
- Create: `src/屏幕/选期望行业.test.tsx`
- Create: `src/屏幕/选专业.test.tsx`
- Create: `src/屏幕/毕业院校.test.tsx`
- Create: `src/屏幕/工作经历.test.tsx`
- Create: `src/屏幕/引导问答.test.tsx`
- Create: `src/数据/目录选择.ts`
- Create: `src/数据/目录选择.test.ts`

**Interfaces:**
- `创建分页选择(loadPage)` 只管理当前 selector 的 pages/loading/error；不持久化、不跨 session。
- taxonomy 打开 root 时 omits `parent_id`；展开时发送 parent ID；只有 `selectable=true` 调用 onSelect。
- Institution candidate value preserves `{id,display_name,location}` until selection; selected education stores only `{id,display_name}`。

- [ ] **Step 1: 写纯 helper 和组件失败测试**

```ts
it('合并分页时按 id 去重且保留导航节点', () => {
  expect(合并目录页(
    [{ id: 'root', display_name: '技术', parent_id: null, selectable: false }],
    [{ id: 'root', display_name: '技术', parent_id: null, selectable: false }, { id: 'leaf', display_name: '后端开发', parent_id: 'root', selectable: true }],
  ).map((item) => item.id)).toEqual(['root', 'leaf']);
});
```

```tsx
it('学校候选显示城市和国家，选择后只保存学校引用', async () => {
  render毕业院校({ result: {
    id: 'ins_fudan', display_name: '复旦大学',
    location: { id: 'loc_sh', display_name: '上海市', country_code: 'CN', country_name: '中国', admin1_code: '31', admin1_name: '上海市', timezone: 'Asia/Shanghai', population: 0 },
  }});
  await user.type(screen.getByRole('textbox'), '复旦');
  expect(await screen.findByText('上海市 · 中国')).toBeVisible();
  await user.click(screen.getByText('复旦大学'));
  expect(保存简历).toHaveBeenCalledWith(expect.objectContaining({
    教育: [expect.objectContaining({ 学校: '复旦大学', 学校引用: { id: 'ins_fudan', display_name: '复旦大学' } })],
  }));
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- src/数据/目录选择.test.ts src/屏幕/毕业院校.test.tsx src/屏幕/选期望职位.test.tsx src/屏幕/选期望行业.test.tsx src/屏幕/选专业.test.tsx src/屏幕/工作经历.test.tsx src/屏幕/引导问答.test.tsx`

Expected: FAIL，旧组件读取本地字符串，学校结果无 location。

- [ ] **Step 3: 实现最小分页 helper**

```ts
export function 合并目录页<T extends { id: string }>(oldItems: T[], newItems: T[]): T[] {
  const seen = new Set(oldItems.map((item) => item.id));
  return [...oldItems, ...newItems.filter((item) => !seen.has(item.id))];
}
export function 可提交Taxonomy(item: BFFTaxonomyItem): boolean { return item.selectable; }
export function 学校副标题(item: BFFInstitutionItem): string {
  return `${item.location.display_name} · ${item.location.country_name}`;
}
```

- [ ] **Step 4: 迁移 taxonomy selectors**

本任务先在 `类型.ts/招聘数据源类型.ts/应用状态.tsx` 定义 Resume/Intention/首次意向所需引用字段及原子 reducer action，保证选择器提交可以编译；Tasks 5–6 再把这些字段接到 BFF 写入。Mock 分支保持本地树。Backend 分支首次读 roots，展开按 `parentId`，搜索按 `q`；推荐区域只渲染本次 BFF 已返回项。点击非 selectable 只展开，点击 selectable 原子保存 `{id,display_name}` 和原字符串。专业无层级，直接按 q/next cursor。

`工作经历.tsx` 的所属行业弹层也属于本任务：Mock 保留 `常见行业`，Backend 改为 `查询Taxonomy('industries')`，点选 leaf 才写 `行业引用`；继续自由输入立即清除旧引用，未选候选时复用现有轻提示阻止 Backend 保存。

- [ ] **Step 5: 迁移学校 selector**

输入 250ms debounce 后 `查询Institution({q,limit:20})`；每行复用现有副行元素显示 `学校副标题`。继续输入立即清除旧 `学校引用`，没有点候选时保存走现有 `轻提示('请从候选学校中选择')`。不增加城市/国家选择页，不把 location 写入 Education payload。

- [ ] **Step 6: 运行测试并提交**

Run: `npm test && npm run typecheck`

Expected: PASS；截图/DOM 快照只新增学校候选副行内容，不改页面结构与 CSS token。

Commit: `feat: 按需加载招聘分类和学校`

---

### Task 5: Resume 写入直接使用表单目录引用

**Files:**
- Modify: `src/数据/类型.ts`
- Modify: `src/数据/招聘数据源类型.ts`
- Modify: `src/数据/后端映射.ts`
- Modify: `src/数据/后端映射.test.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/数据/HTTP招聘数据源.test.ts`
- Modify: `src/状态/应用状态.tsx`

**Interfaces:**
- `简历经历段.行业引用?: 目录选择值`；`简历教育段.学校引用?: 目录选择值`、`专业引用?: 目录选择值`。
- BFF-hydrated existing rows always populate refs from owner DTO；Backend new/changed controlled values require refs。

- [ ] **Step 1: 写失败 mapping tests**

```ts
it('Education 直接使用选择时保存的 ID', () => {
  expect(转教育写入({
    编号: 'edu_local', 学校: '同名大学', 学校引用: { id: 'ins_cn', display_name: '同名大学' },
    专业: '计算机科学', 专业引用: { id: 'maj_cs', display_name: '计算机科学' },
    学历: '本科', 开始: '2020-09', 结束: '2024-06',
  })).toMatchObject({ institution_id: 'ins_cn', major_id: 'maj_cs' });
});

it('没有候选引用时不按显示名反查', async () => {
  await expect(source.保存简历({ ...resume, 教育: [{ ...resume.教育[0], 学校: '手输学校', 学校引用: undefined }] }, previous))
    .rejects.toThrow('请从候选学校中选择');
  expect(请求).not.toHaveBeenCalledWith(expect.objectContaining({ path: expect.stringContaining('/catalog/') }));
});
```

- [ ] **Step 2: 运行失败测试**

Run: `npm test -- src/数据/后端映射.test.ts src/数据/HTTP招聘数据源.test.ts`

Expected: FAIL，映射仍要求 `目录索引` 并按名称精确匹配。

- [ ] **Step 3: 修改映射签名**

```ts
function 必需引用(value: 目录选择值 | undefined, label: string): string {
  if (!value) throw new Error(`请从候选${label}中选择`);
  return value.id;
}

export function 转教育写入(段: 简历教育段): BFF教育写入 {
  return {
    institution_id: 必需引用(段.学校引用, '学校'),
    major_id: 必需引用(段.专业引用, '专业'),
    degree: 转学历(段.学历), start_month: 段.开始, end_month: 段.结束 || null,
  };
}
```

`转经历写入` 同样读取 `行业引用.id`。`从BFF简历` 直接把 owner `industry/institution/major` 转为引用字段。删除 `从快照建目录` 及保存前 `确保目录` 循环。

- [ ] **Step 4: 保持草稿与服务端快照边界**

onboarding 未完成条目继续留本地草稿；成功写入用 BFF 返回 ID/revision 原子替换。中途失败仍 GET 权威 Resume；用户尚未完成的本地草稿不能被误标为服务端成功。

- [ ] **Step 5: 运行测试并提交**

Run: `npm test -- src/数据/后端映射.test.ts src/数据/HTTP招聘数据源.test.ts src/状态/应用状态.test.ts && npm run typecheck`

Expected: PASS；简历 mapping 与保存路径不再调用 `精确目录ID/确保目录`。意向和岗位的 legacy 调用将在 Tasks 6–7 清除，最终静态门禁统一放在 Task 8。

Commit: `refactor: 用目录引用保存简历`

---

### Task 6: 对齐 CandidateIntention 创建、编辑和生命周期

**Files:**
- Modify: `src/数据/招聘数据源类型.ts`
- Modify: `src/数据/后端映射.ts`
- Modify: `src/数据/后端映射.test.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/屏幕/添加意向.tsx`
- Modify: `src/屏幕/选择城市.tsx`
- Modify: `src/屏幕/选期望行业.tsx`
- Modify: `src/屏幕/引导问答.tsx`
- Modify: `src/屏幕/引导问答.test.tsx`
- Modify: `src/屏幕/添加意向.test.tsx`
- Modify: `src/状态/应用状态.test.ts`
- Modify: `src/数据/HTTP招聘数据源.test.ts`

**Interfaces:**
- 草稿新增 `职位引用`、`工作城市引用`、`感兴趣城市引用们`、`行业引用们`、`办公方式`。
- social/campus range create omits unknown `annual_salary_months`；edit preserves existing value and all UI-unexpressed fields。

- [ ] **Step 1: 写失败 tests**

```ts
it('新建意向不默认 onsite、不补 12、按 ID 去重地点', () => {
  const body = 转意向写入({
    ...空草稿,
    求职类型: '全职', 职位引用: ref('tax_pm', '产品经理'),
    工作城市引用: ref('loc_sh', '上海市'),
    感兴趣城市引用们: [ref('loc_sh', '上海市'), ref('loc_hz', '杭州市')],
    行业引用们: [ref('tax_it', '互联网')], 办公方式: ['hybrid'],
    薪资下限: 20, 薪资上限: 30,
  }, { 原始: null });
  expect(body).toMatchObject({
    job_category_id: 'tax_pm', primary_location_id: 'loc_sh',
    alternate_location_ids: ['loc_hz'], industry_ids: ['tax_it'], workplace_modes: ['hybrid'],
  });
  expect(body.compensation).toEqual({ mode: 'range', lower: 20, upper: 30 });
});

it('编辑只改可见字段并保留 owner 未表达字段', () => {
  const body = 转意向写入(从BFF意向草稿(ownerCampus), { 原始: ownerCampus });
  expect(body).toMatchObject({
    recruitment_type: 'campus', graduation_month: ownerCampus.graduation_month,
    exclusions: ownerCampus.exclusions, private_preferences: ownerCampus.private_preferences,
  });
  expect(body.compensation.annual_salary_months).toBe(ownerCampus.compensation.annual_salary_months);
});
```

- [ ] **Step 2: 运行测试并确认旧 mapping 依赖目录索引/默认值**

Run: `npm test -- src/数据/后端映射.test.ts src/状态/应用状态.test.ts src/屏幕/添加意向.test.tsx`

Expected: FAIL。

- [ ] **Step 3: 修改意向 mapping**

```ts
const alternate_location_ids = 去重引用(draft.感兴趣城市引用们)
  .filter((item) => item.id !== draft.工作城市引用?.id)
  .map((item) => item.id);
const compensation = draft.薪资下限 === null || draft.薪资上限 === null
  ? { mode: 'negotiable' as const }
  : {
      mode: 'range' as const, lower: draft.薪资下限,
      upper: draft.薪资上限,
      ...(原始?.compensation.annual_salary_months == null ? {} : { annual_salary_months: 原始.compensation.annual_salary_months }),
    };
```

新建时不存在 annual months 就省略；不得填 12。编辑时对 UI 未修改字段从最新 `原始` merge，用户实际切换求职类型时才清理/改写类型专属字段。

`首次意向输入` 同时新增 `职位引用: 目录选择值` 与 `城市引用们: 目录选择值[]`；`引导问答.tsx` 的 Backend 分支复用 Tasks 3–4 的查询结果并在选中时原子保存字符串和 refs。`转首次意向写入` 保留当前 recruitment type、毕业/实习条件、排除项和 private preferences 的计算，只把三个目录字段替换为直接读取 refs：

```ts
const [primary, ...alternate] = 去重引用(输入.城市引用们);
if (!primary) throw new Error('请从候选城市中选择');
return {
  recruitment_type,
  job_category_id: 必需引用(输入.职位引用, '职位'),
  primary_location_id: primary.id,
  alternate_location_ids: alternate.map((item) => item.id),
  industry_ids: [],
  workplace_modes: 映射办公方式(输入.筛选偏好.办公方式),
  compensation: { mode: 'range', lower: 输入.薪资.下限, upper: 输入.薪资.上限 },
  graduation_month,
  internship_months,
  onsite_days_per_week,
  exclusions,
  private_preferences,
};
```

新增失败测试：给两个同名职位 fixture（不同 ID），只选择 `职位引用.id='tax_selected'`，断言首次意向 body 使用 `tax_selected`，且请求记录没有 `/catalog/`；这覆盖 `引导问答 → 保存首次意向 → 创建首次意向 → 转首次意向写入` 整条生产链。

Backend 模式进入 `引导问答` 时不得把硬编码 `['后端开发', '交易 / 支付系统', '金融科技（行业）']/['上海']` 当成已选择答案：未从 owner DTO 或当前会话目录候选得到 refs 时，受控职位/城市初始值为空。`引导问答.test.tsx` 必须覆盖“默认字符串不会提交”和“点远程候选后字符串+refs 原子写入”；Mock 仍保留当前默认答案。

- [ ] **Step 4: 用现有选择行增加办公方式必填**

`添加意向.tsx` 复用 onboarding 已有现场/混合/远程片组选项和样式；未选时保存 `轻提示('请选择办公方式')`。首次 onboarding 直接带入用户已经回答的办公方式，不新增重复问题。

- [ ] **Step 5: 权威重读生命周期**

create/update/delete 成功后继续重新读取 `status=active` 列表；delete 用 If-Match。409 先重读 owner DTO 再提示，不用稀疏列表覆盖服务端字段。归档项不会回到当前列表，本轮不接归档管理 UI。

- [ ] **Step 6: 运行测试并提交**

Run: `npm test -- src/数据/后端映射.test.ts src/数据/HTTP招聘数据源.test.ts src/状态/应用状态.test.ts src/屏幕/添加意向.test.tsx src/屏幕/引导问答.test.tsx && npm run typecheck`

Expected: PASS。

Commit: `fix: 对齐求职意向后端语义`

---

### Task 7: 对齐 Recruiter Job 的 category/location 引用

**Files:**
- Modify: `src/数据/类型.ts`
- Modify: `src/数据/招聘数据源类型.ts`
- Modify: `src/数据/后端映射.ts`
- Modify: `src/数据/后端映射.test.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/屏幕/发布岗位.tsx`
- Modify: `src/屏幕/发布岗位.test.tsx`
- Modify: `src/状态/应用状态.test.ts`

**Interfaces:**
- `在招岗位` 的 Backend 草稿元数据携带 `类别引用/地点引用`；列表字符串继续渲染。
- Create 直接提交 selected IDs；update 继续带 owner immutable fields 与 If-Match。

- [ ] **Step 1: 写失败测试**

```ts
it('岗位创建使用选择时保存的类别和地点 ID', () => {
  const body = 转岗位创建({
    ...页面岗位,
    类别引用: { id: 'tax_backend', display_name: '后端开发' },
    地点引用: { id: 'loc_sh', display_name: '上海市' },
  }, { 公司: '甲公司' });
  expect(body).toMatchObject({ category_id: 'tax_backend', location_id: 'loc_sh' });
});

it('岗位更新保留 immutable category/location/type/title', () => {
  const body = 转岗位补丁({ ...页面岗位, 薪资下限: 35 }, { 原始: ownerJob, 公司: '甲公司' });
  expect(body).toMatchObject({
    title: ownerJob.title, recruitment_type: ownerJob.recruitment_type,
    category_id: ownerJob.category.id, location_id: ownerJob.location.id,
  });
});
```

- [ ] **Step 2: 运行测试并确认显示名反查仍存在**

Run: `npm test -- src/数据/后端映射.test.ts src/数据/HTTP招聘数据源.test.ts`

Expected: FAIL。

- [ ] **Step 3: 接入已有候选行样式**

Backend 的岗位类别使用 Task 4 taxonomy selector；工作城市自由输入下方复用现有候选行，按 q 调 `查询Location`。继续输入清除旧地点引用，未选候选时阻止发布；办公详细地址保持自由文本。Mock 分支不变。

- [ ] **Step 4: 修改 mapping 和数据源**

`转岗位创建` 从 refs 取 ID；`从BFF岗位` 填 refs。`转岗位补丁` 的 immutable 字段只取 latest owner DTO，不取可能过期的页面字符串。归档/重开/删除保持 If-Match，成功后重读岗位列表；附属字段仍只写现有前端存储。

本步骤完成后删除 `应用状态.tsx` 的 `取目录/目录引用`、`招聘数据源类型.ts` 的 `目录索引`、`HTTP招聘数据源.ts` 的 `读取目录/解析目录项/确保目录` 以及所有 mapping context 的 `目录` 字段。此时 Resume/Intention/首次 Intention/Job 均已迁移，删除不会造成中间提交不可编译。

- [ ] **Step 5: 运行测试并提交**

Run: `npm test -- src/数据/后端映射.test.ts src/数据/HTTP招聘数据源.test.ts src/状态/应用状态.test.ts && npm run typecheck`

Expected: PASS。

Commit: `fix: 用目录引用发布招聘岗位`

---

### Task 8: 完整回归 Backend/Mock 边界与 PM UI

**Files:**
- Modify: `e2e/数据源模式.spec.ts`
- Create: `playwright.数据源模式.config.ts`（或等价的双 server 隔离配置）
- Modify: `package.json`
- Modify: `README.md`
- Modify only failing tests directly covering Tasks 1–7.

**Interfaces:**
- Backend test BFF fixture only implements already-wired endpoints。
- Mock E2E retains current screenshots/DOM and 4 OTP cells。
- 数据源 E2E 同时启动两个不可复用的 Vite server：显式 `mock/stg` 与显式 `backend/stg`；两者使用不同端口/baseURL。缺省值及“只设置 `VITE_BACKEND_ENV`”由配置单测独立覆盖。

- [ ] **Step 1: 增加 Backend 集成 fixture 场景**

以 `VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=stg` 启动专用 dev server。Playwright route fixture 记录所有 `/api/v1/catalog/*` 请求，覆盖：candidate login/session 后无 Catalog 请求；打开城市后只请求目标省第一页；中文/英文学校搜索选择同一 institution ID 且候选显示城市·国家；Resume/Intention/Job POST/PATCH body 使用选择 ID；422 array fields、401 cleanup、409 reread、503 same idempotency key。响应放入只存在于 fixture 的标记值，并断言页面展示该值，证明渲染来自 HTTP 而非 Mock。

- [ ] **Step 2: 增加 Mock 不变回归**

以显式 `VITE_DATA_SOURCE=mock VITE_BACKEND_ENV=stg` 的专用 dev server 启动，禁止 `reuseExistingServer`，避免 `.env.local` 或开发者已运行的 Backend 进程污染验收。走现有 candidate/recruiter 演示流程；断言本地城市/学校/职位仍可选、没有 `/api/v1` 请求、登录仍为 4 个验证码格、没有新增页面/弹层/全局 loading。配置单测继续断言 `解析运行配置({})` 缺省为 Mock，且只给 `VITE_BACKEND_ENV=local` 时不构造代理/HTTP 数据源。

两个 dev server 使用不同端口，因此浏览器存储也属于不同 origin，不能用它们伪造“同源切换模式”的持久化证明。该边界由 Task 2 的同 origin jsdom/component test 覆盖：先写入 Mock 的 `AGXP简历v2/AGXP求职筛选v1` 哨兵，再挂载 Backend Provider 完成水合、401 与退出，断言两枚哨兵未变化；另以单测证明 `stg/local` Backend 草稿 key 不同且互不恢复引用。如需浏览器级复核，必须在同一端口顺序重启 Mock/Backend server 后再比较，不能跨端口比较 localStorage。

- [ ] **Step 3: 运行全量前端验证**

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e:data-source
```

`test:e2e:data-source` 必须由专用配置启动两个 server，等价命令语义为：Mock 进程显式设置 `mock/stg`，Backend 进程显式设置 `backend/stg`，端口不同且都不复用已有 server。再单独断言 `VITE_DATA_SOURCE=backend npm run build` 以预期的“Backend 数据源只支持 Vite dev”失败，防止误发布半可用 Backend bundle。

Expected: 全部正向命令 exit 0，Backend build 按预期拒绝；若 Playwright 环境缺浏览器，记录真实环境 blocker，不能把未运行写成通过。

- [ ] **Step 4: 静态边界检查**

```bash
rg '读取目录|解析目录项|精确目录ID|确保目录' src
rg "from '../数据/(城市与行业|高校名录|职业分类|专业名录)'" src/屏幕
git diff --check
```

Expected: 第一条只允许历史注释/测试明确断言“不再调用”；第二条只允许 Mock 分支所在模块，Backend 选择器不能直接把本地字符串作为提交事实；diff check clean。

- [ ] **Step 5: 更新 README 并提交**

README 只记录现有 Backend/Mock 启动方式、环境变量变更后需重启 Vite、按需 Catalog、学校城市消歧、后端配套部署前提、Mock/Backend 本地缓存隔离、未接线演示域和前端附属字段，不宣称新增 API。确定性 fixture 通过后，还需按 README 命令对可用的真实 `stg`（以及本地 BFF 可用时的 `local`）完成一次登录/资源读取 smoke；若目标环境或 OTP 前置未就绪，明确记录外部 blocker，不能用 route fixture 冒充真实联调通过。

Commit: `test: 验证招聘已接线 API 场景`

## Plan Self-Review

- 已覆盖 spec 的 Catalog 初始化、分页、引用保存、城市分组、taxonomy 导航、学校消歧、Resume、Intention、Job、错误与会话边界。
- 所有 Backend 写入路径都直接使用选择时保存的 ID；不存在显示名反查或全量目录预取。
- 学校城市只在候选副行出现，不增加筛选步骤、不写入 Education、不改变简历展示。
- UI 改动只限受控候选、学校副行、办公方式必填与真实错误；无 CSS 系统/页面重做。
- Mock 与未接线演示域没有被 Backend 失败路径污染。
- Mock 原型 localStorage 永远不由 Backend 分支读写，`stg/local` Backend 草稿互相隔离。
- Mock 与 Backend E2E 使用两个独立 Vite 进程，既证明缺省 PM 流程零 API 请求，也证明显式覆盖后页面消费 HTTP fixture；真实 BFF smoke 另行记录，fixture 不冒充线上联通性。
- 没有 manifest、handoff、admission、ledger、执行 prompt 或 `/development-workflow` 产物。
- 没有新增依赖、状态库、通用 SDK、持久目录缓存或假想架构。
