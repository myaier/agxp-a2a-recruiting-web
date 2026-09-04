# FE-IV-01 候选实名认证前端接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Backend 模式下让候选从设置页进入独立实名认证页，读取权威状态、提交合法材料、刷新审核结果、取消 pending 申请，并在 verified/rejected 状态下只展示服务端允许的 owner-safe 信息；Mock 行为保持不变。

**Architecture:** 新增一个闭合 `候选实名` data source facade，接入现有 `HTTP招聘数据源`；新增一个只保存 owner summary 的 Backend 状态切片和一个持有单飞锁、mutation 锁、稳定幂等键及 session fence 的 operation owner；设置页只映射摘要并导航，独立页面独占姓名草稿和 `File[]`。不接历史 endpoint，不新增缓存框架、向导或通用上传抽象。

**Tech Stack:** React 19、React Router 7、TypeScript 6、Vitest 4、Testing Library、Playwright、现有 BFF HTTP 客户端与应用状态 Provider。

**Spec:** `docs/superpowers/specs/2026-09-04-candidate-identity-verification-frontend-design.md`

## Global Constraints

- 实施前完整阅读 `CLAUDE.md`、`AGENTS.md`、Spec 和本 Plan，并使用 `superpowers:test-driven-development`。当前已审查文档基线是 `origin/main@280f83ef0670d07465e87fd56a2a4b0b843be04e`；开始 Task 1 前执行 `git fetch origin main`。若 `origin/main` 已前进，把它普通 merge 到实现分支并重新运行文档 review 指定的基线检查；不要重写已 review 的提交历史。
- 后端公开合同冻结在 `agxp-monorepo release/0.2.5@21e34ff047bf17e20e0fc0e13f1e391460456270`，BFF OpenAPI 路径是 `apps/recruitment-bff/openapi/mobile-v1.yaml`。若 endpoint、成功状态码、字段集合、枚举、revision、multipart 形状或错误码发生漂移，停止并报告，不自行猜测兼容层。
- FE-MC-01 已在前端基线。必须原样保留 `P5MatchCase状态.P5摘要`、`P5摘要快照`、`MatchCase操作.加载摘要` 和所有 MatchCase 页面。与本任务唯一共享的产品文件是 `src/状态/后端/类型.ts`；新增内容只能并列组合，不能覆盖或改名 P5 成员。
- 页面不得直接 `fetch`。HTTP 只在 data source；session/role/subject fence、单飞、mutation 锁、幂等恢复和统一 401 清理只在 operation；React 页面只持有草稿、文件、busy、确认层和安全文案。
- 全局状态、浏览器存储、toast、日志和 analytics 不得保存 legal name 草稿、document type 草稿、文件名、`File`、`FormData`、证件 bytes 或原始错误 body。全局只保存严格解码后的 owner-safe summary。
- 不调用 `GET /api/v1/me/identity-verification-requests`；不实现历史页、自动轮询、OCR、人脸识别、reviewer UI、简历姓名预填、verified name 回写、通用上传组件或通用状态框架。
- 文件前置校验只覆盖数量、扩展名、声明 MIME 和组合：恰好一个 PDF，或一至两张 PNG/JPEG。不得硬编码 10 MiB、50 MiB 或 51 MiB；精确大小由服务端裁决。
- 每个实现 Task 严格 RED → GREEN 并单独提交。不得顺手重构；代码块中的公开类型、方法名、路由、状态文案和错误文案是冻结接口。
- 唯一权威 plan-scope 单测门是 `npm test`。定向 Vitest 是 inner loop；`npm run typecheck`、`npm run lint`、`npm run build` 和 `npm run test:e2e:data-source` 是不同层级的验证，不能互相冒充。

## Prerequisites and completion

- 四个任务串行执行：Task 1 产出 data source；Task 2 消费它并产出状态/operation；Task 3 原子接入设置入口、路由与页面；Task 4 补 data-source E2E 并跑最终门。
- Task 2 的 `后端状态.候选实名?` 可选只用于兼容聚焦其它域的测试桩；Provider 必须始终显式播种，所有运行时读取必须走同一个 `取候选实名快照()` 回退，不得形成两个默认值。
- 完成标准：严格 decoder、multipart、幂等键、CAS、单飞、并发锁、冲突重读、当前/迟到 401、登出/换主体/切角色清理、设置页五状态、四状态页面、文件校验、Mock 隔离、路由 guard 都有自动测试；全量门通过且工作树干净。
- **计划本身复杂度：中。** 新增一个窄域并接现有 data source → operation → Provider → 页面链路，不增加基础设施。
- **零上下文漂移风险：中。** 风险集中在共享 `后端操作依赖`、统一会话清理和应用路由表；本 Plan 已给出精确锚点与不变量。
- Integration metadata：`integration_requirement: none`、`selection_ssot: none`、`selection_gap: none`、`l3_selection: []`。Playwright route fixture 只是隔离的前端 data-source E2E，不是真实后端联调；真实 reviewer 终审没有安全 seed 时不作为完成阻塞。

---

### Task 1: 新增严格候选实名 data source 并组合进根 facade

**Files:**
- Create: `src/数据/招聘数据源/候选实名.ts`
- Create: `src/数据/招聘数据源/候选实名.test.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/数据/HTTP招聘数据源.test.ts`

**Self-contained brief:**
- 消费现有 `BFF客户端.请求` 的 `formData`、`幂等`、`幂等键`、`ifMatch`、`不缓存`、`严格信封` 选项。
- 产出 `候选实名数据源` 三方法，供 Task 2 通过 `HTTP招聘数据源` 调用。
- 成功信封必须传 `严格信封: true`；GET 必须 `不缓存: true`。新域自行 strict decode `result`，任何缺键、多键、坏枚举、坏整数、坏时间和状态矩阵矛盾统一抛 `BFF错误(200, 'invalid_response', '候选实名响应不符合契约')`。
- 不给 `request_id` 发明 regex，只要求非空字符串；revision 必须是大于等于 1 的 safe integer；姓名上限按 Unicode code point 计算。

**Frozen interfaces:**

```ts
export type 候选实名状态 = 'unverified' | 'pending' | 'verified' | 'rejected';
export type 候选实名申请状态 = 'pending' | 'verified' | 'rejected' | 'cancelled';
export type 候选实名拒绝原因 =
  | 'document_unreadable'
  | 'identity_mismatch'
  | 'document_expired'
  | 'unsupported_document'
  | 'other';
export type 候选实名证件类型 = 'national_id' | 'passport' | 'other_government_id';

export interface 候选实名申请 {
  requestId: string;
  status: 候选实名申请状态;
  revision: number;
  submittedAt: string;
  rejectionReason: 候选实名拒绝原因 | null;
}

export interface 候选实名摘要 {
  status: 候选实名状态;
  verifiedName: string | null;
  currentRequest: 候选实名申请 | null;
  revision: number;
  updatedAt: string;
}

export interface 创建候选实名输入 {
  legalName: string;
  documentType: 候选实名证件类型;
  evidence: File[];
}

export interface 候选实名数据源 {
  读取候选实名(): Promise<候选实名摘要>;
  创建候选实名申请(input: 创建候选实名输入, idempotencyKey: string): Promise<候选实名摘要>;
  取消候选实名申请(requestId: string, revision: number): Promise<候选实名摘要>;
}
```

- [ ] **Step 1: 写 strict decoder 和 wire 请求 RED 测试**

在新测试中用 `vi.fn()` 构造请求函数，至少冻结以下用例：

1. `unverified + null request`、`unverified + cancelled request`、`pending`、`verified`、`rejected` 五种合法投影；五个拒绝原因逐项通过。
2. summary 必需键恰为 `status, verified_name, current_request, revision, updated_at`；request 必需键恰为 `request_id, status, revision, submitted_at, rejection_reason`。
3. extra/missing key、未知 enum、空 request ID、0/负数/小数/NaN/Infinity/超 safe integer revision、`2026-02-30T00:00:00Z`、`24:00:00Z`、坏 offset 全部拒绝。
4. `verified_name` 只在 verified 时允许 trim 后非空且不超过 200 code point；rejection reason 只在 rejected request 时非空；summary/request 状态矩阵严格，但两层 revision 不要求相等。
5. 三个请求选项逐字相等：

```ts
expect(请求Mock.mock.calls.map(([options]) => options)).toEqual([
  {
    path: '/api/v1/me/identity-verification',
    不缓存: true,
    严格信封: true,
  },
  {
    path: '/api/v1/me/identity-verification-requests',
    method: 'POST',
    formData: expect.any(FormData),
    幂等: true,
    幂等键: 'iv-create-0123456789abcdef',
    严格信封: true,
  },
  {
    path: '/api/v1/me/identity-verification-requests/opaque%2Frequest/cancel',
    method: 'POST',
    body: {},
    ifMatch: '"7"',
    严格信封: true,
  },
]);
```

6. 从 create 的 `FormData` 取出 entries，断言顺序和内容是一个 `metadata` Blob 加一或两个同名 `evidence` File；`metadata.type === 'application/json'`，解析后恰为 `{ legal_name: legalName.trim(), document_type: documentType }`，没有 filename/document number/size。

- [ ] **Step 2: 运行 RED**

```bash
npx vitest run src/数据/招聘数据源/候选实名.test.ts
```

Expected：FAIL，模块和导出尚不存在。

- [ ] **Step 3: 实现最小 decoder 与三方法**

在新模块内就地实现 `要求闭合对象`、`要求枚举`、`要求正安全整数`、`要求RFC3339时间`、`要求非空字符串`，不要抽成共享 decoder。RFC3339 必须复用仓库 `JD导入.ts` 的逐分量算法（含闰年、月日、23:59:59 和 offset 检查），不能只用 `Date.parse`。

请求体实现冻结为：

```ts
const formData = new FormData();
formData.append('metadata', new Blob([
  JSON.stringify({ legal_name: input.legalName.trim(), document_type: input.documentType }),
], { type: 'application/json' }));
for (const file of input.evidence) formData.append('evidence', file);
```

data source 不负责页面文件组合校验，也不复制 `File`。取消路径必须 `encodeURIComponent(requestId)`，`If-Match` 必须使用传入的 summary revision。

- [ ] **Step 4: 用 RED 组合测试接入根 facade**

先在 `HTTP招聘数据源.test.ts` 的最小 client/facade 能力表中加入三个方法名，并断言既有 FE-MC `读取P5摘要` 仍在。运行：

```bash
npx vitest run src/数据/HTTP招聘数据源.test.ts
```

Expected：FAIL，根 facade 尚未暴露候选实名三方法。

再在 `HTTP招聘数据源.ts`：

- 文件头追加一行说明候选实名域，不写容易漂移的域序号；
- import `候选实名数据源` / `创建候选实名数据源`；
- 把 `候选实名数据源` 加入 `HTTP招聘数据源` 交集；
- 在 factory 返回值末尾 spread `...创建候选实名数据源(请求)`。

- [ ] **Step 5: 运行 GREEN 与提交**

```bash
npx vitest run src/数据/招聘数据源/候选实名.test.ts src/数据/HTTP招聘数据源.test.ts
git diff --check
git add src/数据/招聘数据源/候选实名.ts src/数据/招聘数据源/候选实名.test.ts src/数据/HTTP招聘数据源.ts src/数据/HTTP招聘数据源.test.ts
git commit -m "feat: add candidate identity verification data source"
```

Expected：定向测试 PASS；提交只含四个文件。

---

### Task 2: 实现候选实名状态、operation owner 与统一会话清理

**Files:**
- Create: `src/状态/后端/候选实名操作.ts`
- Create: `src/状态/后端/候选实名操作.test.ts`
- Modify: `src/状态/后端/类型.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`
- Modify: `src/状态/后端/会话操作.ts`
- Modify: `src/状态/后端/会话操作.test.ts`

**Self-contained brief:**
- 消费 Task 1 的 `候选实名摘要`、`创建候选实名输入` 和根 facade 三方法。
- 产出全局 owner-safe snapshot、四个页面操作和三类运行时引用。
- Backend + 已登录 candidate 才可调用；每次请求捕获 `subject_id + last_used_role + 会话代际`。过时成功/失败/401 整包丢弃；当前 401 调用现有 `清账号状态(deps)`。
- GET 单飞；create/cancel 各自 mutation 单飞。create 待定 intent 只保存一把 key，不保存 input；页面编辑时显式清 key。

**Frozen state and operation interfaces:**

```ts
export interface 候选实名快照 {
  阶段: '未开始' | '进行中' | '成功' | '失败';
  摘要: 候选实名摘要 | null;
  刷新中: boolean;
  错误: string | null;
}

export function 创建空候选实名快照(): 候选实名快照 {
  return { 阶段: '未开始', 摘要: null, 刷新中: false, 错误: null };
}

export function 取候选实名快照(state: 后端状态): 候选实名快照 {
  return state.候选实名 ?? 创建空候选实名快照();
}

export interface 候选实名操作 {
  加载候选实名(force?: boolean): Promise<void>;
  提交候选实名(input: 创建候选实名输入): Promise<'已提交' | '状态已更新' | '已换代'>;
  取消候选实名(): Promise<'已取消' | '状态已更新' | '已换代'>;
  重置候选实名提交意图(): void;
}
```

在 `后端状态` 增加 `候选实名?: 候选实名快照`；在 `应用操作` 交集中加入 `候选实名操作`。在 `后端操作依赖` 增加三个可选引用，以兼容其它域测试桩：

```ts
候选实名读取锁?: 可变引用<Promise<void> | null>;
候选实名变更锁?: 可变引用<Set<'create' | 'cancel'>>;
候选实名提交意图?: 可变引用<string | null>;
```

operation 工厂入口必须逐项判空并抛接线缺陷，生产 Provider 则始终注入。

- [ ] **Step 1: 写 operation RED 测试环境和行为矩阵**

新测试的 `设后端状态` 必须同步更新 `后端状态引用.current`，模拟真实 Provider。fake 数据源至少包含 `读取候选实名`、`创建候选实名申请`、`取消候选实名申请`、`清空目录缓存`。

覆盖：

1. Mock、无后端、未登录、recruiter、主体 null：四个公开方法零 HTTP；mutation 返回 `已换代`。
2. 初次 GET：阶段 `未开始 → 进行中 → 成功`；并发两次只发一请求；非 force 成功缓存零请求。
3. 已有成功摘要 force 刷新：在飞保持 `阶段=成功, 摘要=旧值, 刷新中=true`；失败保留旧摘要并写安全错误。首次失败则 `阶段=失败, 摘要=null`。
4. create/cancel 重复点击只发一笔。create 第一次铸 `crypto.randomUUID()`，失败后的未编辑重试复用相同 key；`重置候选实名提交意图()` 后下一次创建使用新 key。
5. create 202 和 cancel 200 的 response summary 直接提交；成功 create 清 key；成功 cancel 保持 key 已空。
6. create `version_conflict` 后强制 GET：若权威状态不再可创建，提交新摘要并返回 `状态已更新`；仍可创建或重读失败时原样抛原冲突。
7. cancel `404 not_found`、`409 version_conflict`、`503 operation_outcome_unknown` 后强制 GET：若原 pending request/revision 已改变，返回 `状态已更新`；仍是原 pending 或重读失败时原样抛原错误。cancel 绝不自动重放。
8. create 的 `operation_outcome_unknown` 或 `network_error` 保留 key 并原样抛；不做额外 create。
9. 请求在飞时换 subject、换 role 或递增会话代际：迟到成功和失败都返回 `已换代`，不写状态、不提示。当前 401 统一清账号；迟到 401 不清新会话。
10. `清候选实名引用()` 清 GET 锁、两把 mutation 锁和 key；状态 helper 回干净底座。
11. mutation 对账撞上更早起飞的 GET 时，等待旧读结算但不采用其结果，再发一笔新 GET；旧读不能在对账结果后反向覆盖状态。
12. 无成功摘要或 `currentRequest?.status !== 'pending'` 时取消零 HTTP 并返回 `状态已更新`。

- [ ] **Step 2: 运行 RED**

```bash
npx vitest run src/状态/后端/候选实名操作.test.ts
```

Expected：FAIL，新模块、类型和导出尚不存在。

- [ ] **Step 3: 实现 operation 的单一 fence 和读写算法**

在 `候选实名操作.ts` 导出：

```ts
export function 清候选实名引用(deps: Pick<后端操作依赖,
  '候选实名读取锁' | '候选实名变更锁' | '候选实名提交意图'>>): void {
  if (deps.候选实名读取锁) deps.候选实名读取锁.current = null;
  deps.候选实名变更锁?.current.clear();
  if (deps.候选实名提交意图) deps.候选实名提交意图.current = null;
}
```

错误状态只写安全文案；operation 可以使用本域函数：

```ts
function 取实名操作错误文案(error: unknown): string {
  if (error instanceof BFF错误) {
    if (error.code === 'identity_verification_unavailable') return '实名认证暂时不可用，请稍后再试';
    if (error.code === 'operation_outcome_unknown') return '暂时无法确认操作结果，请刷新状态或重试';
  }
  return '请求失败，请稍后再试';
}
```

GET 的 `finally` 只在引用仍指向本次 Promise 时释放锁，防止旧请求释放新锁。强制重读要返回内部 `{ committed: boolean; summary: 候选实名摘要 | null }` 结果供 mutation 对账；公开 `加载候选实名()` 只返回 `void`。mutation 对账不得直接清空锁并并发第二笔读取，因为旧响应可能晚于新响应提交；若已有 GET 在飞，必须先 await 它、重新检查 mutation fence，再另发一笔新 GET，且不把旧读结果当作对账证据。

判断 cancel 原 pending 是否变化必须同时比较 `currentRequest.requestId`、`currentRequest.status === 'pending'` 和顶层 `revision`；不能只比较 status。create 对账仅当新摘要是 `pending | verified` 时返回 `状态已更新`，`unverified | rejected` 仍抛原冲突。取消起飞前若 `取候选实名快照()` 没有成功摘要或 `currentRequest?.status !== 'pending'`，零 HTTP 并返回 `状态已更新`。

- [ ] **Step 4: 用根状态 RED 断言接入 Provider**

先在 `应用状态.test.ts` 增加根操作形状和初始快照断言，明确 `加载摘要` 与 `加载候选实名` 同时存在；运行：

```bash
npx vitest run src/状态/应用状态.test.ts
```

Expected：FAIL，Provider 尚未播种候选实名状态和操作。

再在 `应用状态.tsx`：

1. 初始 `后端状态` spread/字段中加入 `候选实名: 创建空候选实名快照()`。
2. 在其它域引用旁创建：

```ts
const 候选实名读取锁 = useRef<Promise<void> | null>(null);
const 候选实名变更锁 = useRef(new Set<'create' | 'cancel'>());
const 候选实名提交意图 = useRef<string | null>(null);
```

3. 三引用放进 `后端操作依赖`。
4. `操作` 组合加入 `...创建候选实名操作(deps)`，保持 FE-MC 的 `...创建MatchCase操作(deps)` 原样。

- [ ] **Step 5: 用会话 RED 断言接入所有清理口**

先在 `会话操作.test.ts` 为登出、当前 401、candidate A → B、candidate → recruiter 各加断言：快照等于 `创建空候选实名快照()`，读锁/变更锁/key 清空；迟到 401 用例继续证明新会话不被清。运行：

```bash
npx vitest run src/状态/后端/会话操作.test.ts
```

Expected：FAIL，会话边界尚未清理候选实名状态和引用。

再在 `会话操作.ts` 按现有注释锚点逐处窄改：

- `清账号状态` 的依赖 Pick 加三引用；状态更新加入 `候选实名: 创建空候选实名快照()`；末尾调用 `清候选实名引用(deps)`。
- `创建会话操作` 解构、`账号清理依赖` 和 `角色水合依赖` 都透传三引用。
- 手机登录发现 candidate A → B 时清快照和引用。
- 新会话建立前把快照回底座并清引用，保证同 subject 重登也不继承未知 create intent。
- `切身份` 离开 candidate 时清快照和引用；切回 candidate 从空态按需 GET。
- mount 水合当前 401 走 `清账号状态` 时透传三引用。

- [ ] **Step 6: 运行 GREEN、类型检查与提交**

```bash
npx vitest run src/状态/后端/候选实名操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
npm run typecheck
git diff --check
git add src/状态/后端/候选实名操作.ts src/状态/后端/候选实名操作.test.ts src/状态/后端/类型.ts src/状态/应用状态.tsx src/状态/应用状态.test.ts src/状态/后端/会话操作.ts src/状态/后端/会话操作.test.ts
git commit -m "feat: manage candidate identity verification state"
```

Expected：定向测试和 typecheck PASS；无 FE-MC 测试桩机械改动。

---

### Task 3: 原子接入设置页、候选路由与四状态页面

**Files:**
- Modify: `src/屏幕/设置.tsx`
- Modify: `src/屏幕/设置.test.tsx`
- Modify: `src/路由/路径表.ts`
- Create: `src/屏幕/候选实名认证.tsx`
- Create: `src/屏幕/候选实名认证.test.tsx`
- Create: `src/屏幕/候选实名认证.module.css`
- Modify: `src/应用.tsx`
- Modify: `src/应用.test.tsx`

**Self-contained brief:**
- 消费 Task 2 的 `后端状态.候选实名` 和 `操作.加载候选实名()`。
- 产出冻结路由 `/settings/identity-verification`、设置页入口和单页四状态 UI；入口、Route 和页面同一提交落地，不留下可导航但未注册的中间态。

**Frozen setting mapping:**

```ts
const 实名行值 = 候选实名.阶段 !== '成功' || 候选实名.摘要 === null
  ? '—'
  : ({
      unverified: '未认证',
      pending: '审核中',
      verified: '已认证',
      rejected: '未通过',
    } as const)[候选实名.摘要.status];
```

- [ ] **Step 1: 写设置页 RED 测试**

扩展现有 `设置 · 实名状态真相源`：

1. Backend 挂载调用 `加载候选实名()` 恰一次；加载/失败/无成功摘要显示 `—`。
2. 四种成功摘要分别显示 `未认证 / 审核中 / 已认证 / 未通过`。
3. Backend 实名整行恢复为 button，点击 `跳转(路径.候选实名认证)`；它与 P8 credentials 读取互不阻塞。
4. Mock 仍显示 `已认证`、点击仍给 `实名认证 · 已通过，无需重复认证`，且 `加载候选实名` 零调用。

- [ ] **Step 2: 运行 RED**

```bash
npx vitest run src/屏幕/设置.test.tsx
```

Expected：FAIL，路径与加载操作尚未接线。

- [ ] **Step 3: 实现设置页最小接线和路径分类**

在 `路径表.ts` 加：

```ts
候选实名认证: '/settings/identity-verification',
```

在 `设置.tsx`：

- Backend effect 同时触发 `加载P8凭证()` 与 `加载候选实名()`，两个 Promise 都独立 `.catch(() => undefined)`；任一失败不阻断另一项。
- 用 `取候选实名快照(后端状态)` 读取统一默认值。
- Backend 行改为 button、显示 `实名行值`、保留尖括号并导航；Mock 分支逐字保留。

- [ ] **Step 4: 运行设置入口中间 GREEN，保持未提交**

```bash
npx vitest run src/屏幕/设置.test.tsx
npm run typecheck
git diff --check
```

Expected：设置页测试和 typecheck PASS；继续完成本 Task 的页面与 Route，尚不提交。

#### Part B：独立页面、表单与文件生命周期

- 消费 Task 2 四操作、本 Task 路径和 `确认层` / `轻提示` / 通用页面外壳。
- 草稿和文件仅为组件 state；页面卸载调用 `重置候选实名提交意图()`，DOM 卸载即释放 input/File 引用。
- 页面不得显示 cancelled 历史、submitted legal name、document type、文件名以外的材料信息、reviewer note 或未知服务端字段。

**Frozen UI vocabulary:**

```ts
export const 候选实名拒绝文案: Record<候选实名拒绝原因, string> = {
  document_unreadable: '证件内容无法清晰识别，请重新上传清楚的材料',
  identity_mismatch: '填写的信息与证件不一致，请核对后重新提交',
  document_expired: '证件已过有效期，请更换有效证件',
  unsupported_document: '暂不支持这类证件，请更换支持的政府签发证件',
  other: '本次认证未通过，请重新提交材料',
};
```

表单标签与选项冻结为：证件姓名、证件类型、证件材料；`national_id → 居民身份证`、`passport → 护照`、`other_government_id → 其他政府签发证件`。文件前置校验只返回下列闭合文案：

- 零文件：`请上传证件材料`
- 超过两个文件：`最多上传两张图片，或一份 PDF`
- 不支持的扩展名：`仅支持 PDF、PNG、JPG 或 JPEG`
- 空或不支持的声明 MIME：`文件类型无法识别，请选择 PDF、PNG 或 JPEG`
- 扩展名与声明 MIME 矛盾：`文件扩展名与类型不一致，请重新选择`
- 两份 PDF 或 PDF 混选图片：`PDF 只能单独上传一份`

页面错误映射冻结为：

- `invalid_request_body` → `提交内容不完整，请检查后重试`
- `media_invalid` → `材料格式或内容无法识别，请更换文件`
- `request_too_large` → `材料超过服务端允许的大小`
- `identity_verification_unavailable` → `实名认证暂时不可用，请稍后再试`
- `operation_outcome_unknown` / create `network_error` → `提交结果暂未确认，请保留原材料后重试或刷新状态`
- `idempotency_conflict` → `本次提交状态冲突，请重新选择材料后重试`
- `validation_failed`（不区分 field path/reason）→ `提交内容不完整，请检查后重试`
- 其它 → `请求失败，请稍后再试`

- [ ] **Step 5: 写纯校验、四状态、交互和路由 RED 测试**

从页面模块导出纯函数 `校验候选实名文件(files)` 和 `候选实名码点数(value)` 供测试。覆盖：

1. 姓名 trim 后空、201 个 Unicode code point 拒绝；200 个含 surrogate pair 的 code point 通过。
2. 单 PDF、单 PNG、单 JPEG、双 PNG/JPEG 通过。
3. 0/3 文件、双 PDF、PDF+图片、`.gif`、扩展名/MIME 矛盾、空 MIME 全部给固定可行动文案；不检查 `file.size`。
4. 初始/失败显示中性读取态与“重试”；成功快照 force 刷新时保留旧状态并显示刷新中。
5. unverified 是空姓名、空证件类型、空文件表单；cancelled request 不渲染历史。
6. pending 显示“审核中”和格式化 `submittedAt`，有刷新和取消；没有提交表单。
7. verified 只显示 `verifiedName`，没有提交或取消。
8. rejected 五个 reason 逐项显示固定文案，下面是全新空表单。
9. direct route 的 Mock 访问 replace 到 `路径.设置`；recruiter/未登录分别由既有角色/会话守卫处理，页面不挂载；三者都零实名 API。
10. 任一字段/文件变化和卸载都会 reset intent；提交在飞时控件全部 disabled，重复点击零第二请求。
11. 读取文件后 input value 清空；移除后同名文件能再次加入；文件名只在当前页面显示，卸载后重挂为空。
12. create success 清草稿并切 pending；outcome unknown/network 保留草稿；idempotency conflict 后编辑文件触发新意图。
13. pending 刷新单飞；取消必须先确认，确认层 Escape/取消键零 mutation；确认后 busy，成功回 unverified。
14. `状态已更新` 不弹“已提交”假成功，只按 operation 已提交的新权威摘要渲染；错误不拼接 `error.message`、field path、request ID 或文件名。

同时在 `应用.test.tsx` 写真实路由 RED 断言：candidate 直达页面；recruiter 在页面 effect 前被角色守卫拦截且实名读取零调用；未登录按现有保护逻辑去登录；未知路径 fallback 不变。

- [ ] **Step 6: 运行页面与路由 RED**

```bash
npx vitest run src/屏幕/候选实名认证.test.tsx src/应用.test.tsx
```

Expected：FAIL，页面模块不存在。

- [ ] **Step 7: 实现表单、状态 UI 和敏感文件清理**

页面挂载行为：

```ts
useEffect(() => {
  if (!可访问) return;
  void 操作.加载候选实名().catch(() => undefined);
  return () => 操作.重置候选实名提交意图();
}, [可访问, 操作]);
```

`可访问` 必须精确定义为：

```ts
const 可访问 = 数据源模式 === 'backend' && 后端状态.已登录 &&
  后端状态.主体?.last_used_role === 'candidate';
```

Mock 分支直接 `<Navigate to={路径.设置} replace />`；recruiter 和未登录不在页面内另造第二套路由规则，交给应用现有同步守卫。

所有 `legalName`、`documentType`、文件新增/移除 handler 先更新本地 state，再调用 `重置候选实名提交意图()`。文件 input 必须 `multiple`，有可见 label，`accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"`；读取 `event.currentTarget.files` 后立即把 `event.currentTarget.value = ''`，使同文件可重新选择。

提交时：

1. 同步校验姓名、证件类型、文件集合；失败写页面 `role="alert"`，零 operation。
2. 设置 `提交中=true`，禁用全部表单控件、文件移除和提交。
3. 调 `提交候选实名({ legalName: legalName.trim(), documentType, evidence: files })`。
4. `已提交 | 状态已更新`：清姓名、证件类型、文件和页面错误；`已换代` 静默。
5. 失败保留全部草稿与 File 引用，显示闭合安全文案，允许原材料同键重试。

取消时先开现有 `确认层`，文案固定：标题 `取消实名认证申请？`，正文 `取消后本次审核会终止，如需认证必须重新提交材料。`，执行文 `取消申请`。确认后立即关层并设置 `取消中=true`；主页面取消/刷新键都禁用。失败保留 pending 页面并显示安全错误。

pending 的“刷新状态”和初次读取失败的“重试”必须调用 `加载候选实名(true)`；刷新在飞时刷新键与取消键都 disabled，取消在飞时两键同样 disabled，不让页面主动制造读写交叠。operation 仍按 Task 2 覆盖外部并发和竞态，不能只依赖 UI 禁用。

页面私有 CSS 只定义状态块、表单行、文件列表、错误块、按钮行和 busy/disabled；外壳、返回栏、确认层和基础行视觉复用现有组件/令牌。不得复制 `确认层.module.css` 或创建通用上传组件。

- [ ] **Step 8: 注册 lazy Route 并完成 guard 测试**

在 `应用.tsx` 加：

```ts
const 候选实名认证 = lazy(() => import('./屏幕/候选实名认证'));
```

在候选设置 Route 附近注册：

```tsx
<Route path={路径.候选实名认证} element={<候选实名认证 />} />
```

同时把 `路径.候选实名认证` 逐项追加到 `候选路由模式`。让 Step 5 的 `应用.test.tsx` RED 用例转绿：recruiter 主体按现有 active roles 规则去 `路径.选身份` 或对应切身份路径，且页面 effect 不挂载；不得把该路径加入 `招聘方恢复路径`。

- [ ] **Step 9: 运行完整页面交互 GREEN**

```bash
npx vitest run src/屏幕/候选实名认证.test.tsx src/应用.test.tsx
```

Expected：Step 5 的纯函数、状态、交互、敏感文件生命周期和路由 guard 用例全部 PASS；所有错误使用 `role="alert"` 或现有可读状态机制。

- [ ] **Step 10: 运行 Task 全量 GREEN、路由回归与提交**

```bash
npx vitest run src/屏幕/候选实名认证.test.tsx src/屏幕/设置.test.tsx src/应用.test.tsx
npm run typecheck
npm run lint
git diff --check
git add src/屏幕/设置.tsx src/屏幕/设置.test.tsx src/路由/路径表.ts src/屏幕/候选实名认证.tsx src/屏幕/候选实名认证.test.tsx src/屏幕/候选实名认证.module.css src/应用.tsx src/应用.test.tsx
git commit -m "feat: add candidate identity verification flow"
```

Expected：页面、设置和路由测试 PASS；typecheck/lint PASS。

---

### Task 4: 补 data-source E2E、全量验证与交付记录

**Files:**
- Modify: `e2e/数据源模式.spec.ts`
- Create: `docs/superpowers/handoffs/2026-09-05-candidate-identity-verification-frontend.md`

**Self-contained brief:**
- Playwright fixture 只证明前端 HTTP 边界和用户旅程，不声称启动或验证真实 BFF。
- 使用合成姓名 `Fixture Candidate IV` 和测试进程内合成 PNG/PDF bytes；fixture 只记录 part 名、metadata JSON、headers 和请求次数，不把文件 bytes/文件名写进 handoff 或 snapshot。
- fixture 状态从 `unverified` 开始，create 后变 `pending`，cancel 后变 `unverified + cancelled current_request`。不实现 reviewer approve/reject 后端路由；verified/rejected 已由 Task 3 组件 fixture 覆盖。

- [ ] **Step 1: 写 Backend 旅程与 fixture 契约 RED 测试**

新增用例标题必须逐字包含 `候选实名`，并沿用现有标签：Mock 用例标题 `Mock 候选实名保持原型且零实名请求 @mock`，Backend 用例标题 `候选实名提交刷新取消闭环 @backend`。

测试先按下述冻结契约调用尚未实现的 `候选实名域` fixture 选项，并完成 Backend 流程断言；Mock 测试监听所有 pathname 包含 `identity-verification` 的请求，确认设置页仍是原型 `已认证` 且请求列表为空。运行：

```bash
npm run test:e2e:data-source -- --grep "候选实名"
```

Expected：FAIL，fixture 尚不接受 `候选实名域`，对应 route handler 也不存在。

Backend 流程：

1. 用现有 fixture 登录为 candidate，进入 `/#/settings`。
2. 设置页显示 `未认证`；点击实名认证进入 `/#/settings/identity-verification`。
3. 填合成姓名、选择 passport、上传一张合成 PNG，提交。
4. 断言页面显示 `审核中`；fixture 记录 metadata 只有两键、一个 evidence、稳定幂等键。
5. reload 页面，断言 GET 仍读到 pending，草稿/文件名不出现。
6. 点取消、确认，断言 `If-Match` 使用顶层 revision；页面回 `未认证`。
7. 返回设置页显示 `未认证`；fixture 当前 summary 为 `unverified + cancelled`。

- [ ] **Step 2: 实现最小可变 fixture 与 Mock 请求分类**

在现有 `安装BFF路由` 选项增加可选 `候选实名域`。路由行为冻结：

- `GET /api/v1/me/identity-verification` 返回当前 strict summary 信封。
- `POST /api/v1/me/identity-verification-requests` 校验 `Idempotency-Key` 在 16–128 可见 ASCII、multipart part 名恰为一个 metadata + 1–2 evidence；metadata 恰两键。首次写 pending，相同 key 同输入重放同 summary；异输入回 409 `idempotency_conflict`。
- `POST .../{request_id}/cancel` 校验 body `{}` 和 `If-Match` 等于当前顶层 revision，随后返回 cancelled summary；错 revision 回 409。
- 所有成功应答使用现有 `信封()` 并加 no-store；GET/cancel 带 ETag，create 不伪造 ETag。

Mock 测试监听所有 pathname 包含 `identity-verification` 的请求，确认设置页仍是原型 `已认证` 且请求列表为空。

- [ ] **Step 3: 运行 E2E GREEN**

```bash
npm run test:e2e:data-source -- --grep "候选实名"
```

Expected：两个新旅程 PASS；报告明确它们是 route fixture，不是真实后端。

- [ ] **Step 4: 运行所有最终验证门**

先用 `superpowers:verification-before-completion`，再执行：

```bash
npx vitest run src/数据/招聘数据源/候选实名.test.ts src/数据/HTTP招聘数据源.test.ts src/状态/后端/候选实名操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts src/屏幕/设置.test.tsx src/屏幕/候选实名认证.test.tsx src/应用.test.tsx
npm run typecheck
npm run lint
npm run build
npm test
npm run test:e2e:data-source
git diff --check
git status --short
```

Expected：全部 exit 0；`npm test` 是权威 plan-scope gate。若全量 E2E 因仓库既有外部条件失败，记录精确失败测试和与本变更的关系，不把定向通过冒充全量通过。

- [ ] **Step 5: 写 handoff、提交并检查范围**

handoff 必须记录：最终前后端基线、Task commits、每 Task RED/GREEN、权威 `npm test` 数量、typecheck/lint/build/E2E 结果、Claude review 轮次、任何已核实后拒绝的 finding、真实 reviewer 终审未执行时的前置条件。不得记录证件文件名、bytes、legal name 或 request body。

```bash
git add e2e/数据源模式.spec.ts docs/superpowers/handoffs/2026-09-05-candidate-identity-verification-frontend.md
git commit -m "test: cover candidate identity verification journey"
git diff --stat origin/main...HEAD
git status --short --branch
```

Expected：工作树干净；diff 只包含 FE-IV-01 spec、plan、实现、测试和 handoff，没有 FE-MC 重写、历史页或通用基础设施。

---

## Plan self-review checklist

- [ ] Spec §1–13 的每条范围内要求至少映射到一个 Task 和一个自动测试；明确非目标没有进入文件列表。
- [ ] 所有新增公开方法在 data source、`HTTP招聘数据源`、`应用操作` 和测试桩中的名称一致。
- [ ] `后端状态.候选实名?` 只有一个默认 helper；Provider 总是播种，页面/operation 不手写另一个默认对象。
- [ ] FE-MC 的 `P5摘要` 和 `加载摘要` 在类型、Provider 操作组合和根 facade 测试中仍存在。
- [ ] create 只保存 key，不保存 input/File；cancel 使用顶层 revision；冲突/未知结果先权威 GET，不宣称假成功。
- [ ] 文件校验没有 size 上限；没有 history endpoint、自动轮询、简历姓名预填或 reviewer UI。
- [ ] 执行前扫描 `TBD`、`TODO`、`FIXME`、`placeholder`、“类似处理”、“以后补”和省略号；除本 checklist 的扫描词外不得存在未决实现步骤。
- [ ] 每个 Task 都有 RED、GREEN、精确命令、预期结果和提交边界；最终门包含 focused tests、typecheck、lint、build、`npm test` 与 data-source E2E。
