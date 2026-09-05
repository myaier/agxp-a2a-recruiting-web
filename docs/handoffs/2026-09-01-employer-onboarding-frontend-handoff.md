# Employer Onboarding 前端修复 Implementation Plan

> **给 Coding Agent：** REQUIRED SUB-SKILL：使用 `superpowers:test-driven-development` 逐任务实现；任务较多时使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`。本文自包含，不要索要原测试机器、职位材料、浏览器状态、截图或之前的聊天记录。

> **状态复核（2026-09-04 18:44 +08:00）：已完成。** P0 onboarding 修复已由 `68935537` 集成；独立的 JD PDF 前端接线由 `fd3a98fb` 至 `ef88edff` 完成。上述提交均已确认是前端 `origin/main@26d80923` 的祖先，因此 Task 1–8 不再是可领取工作；后文未勾选框保留为历史实现与验收说明。

**目标：** 让真实后端模式下的新招聘方能够创建招聘名片、填写公司声明、发布一条合同合法的岗位，并在刷新后看到权威资料；同时修正无企业关系空态、认证状态、错误文案、导出文案和页面缩放。

**架构选择：** 保持服务端 profile/jobs/affiliations 为权威事实。把 recruiter profile 的 404 建模成合法“缺失”水合态；首次 profile 写入复用现有 PATCH CAS 的 revision 0。岗位发布前在页面层预检用户可修正字段，不削弱 BFF 合同。JD 导入作为后端 API 就绪后的独立建议稿能力接入，不与手工发岗 P0 混合。

**技术栈：** React 19、TypeScript 6、React Router 7、Vite 8、Vitest 4、Testing Library、Playwright。

## 已知失败事实

全新招聘方选择角色后，`GET /api/v1/recruiter/profile` 返回 404，页面停在身份选择页；重登录只因 `last_used_role=recruiter` 直接进入 `/hr`。招聘名片保存没有发 profile mutation。岗位 POST 的关键字段是：

```json
{
  "hiring_organization_claim": { "display_name": "", "legal_name": null },
  "requirements": ""
}
```

后端以 422 拒绝两个字段，页面显示机器码。最终权威状态仍是 profile 404、jobs 空列表。

后端现有合同已经支持：

```text
PATCH /api/v1/recruiter/profile
If-Match: "0"
{"public_name":"...","title":"..."}
→ 200，revision=1
```

所以不得新增 profile POST，也不得等待后端先改 profile 语义。

## 全局约束

- `VITE_DATA_SOURCE=backend` 时任何失败都不得回退 Mock。
- profile 404 只代表尚未创建，不代表 session/role 失败；其他 profile 404 之外的非 401 错误仍必须诚实呈现。
- 以“profile 是否存在”作为最小 recruiter onboarding 完成标记；不要用“jobs 是否为空”，否则用户删除全部岗位后会被错误送回 onboarding。
- 首次资料保存必须先成功写 profile，再进入发布岗位。已有 profile 的名片编辑不应每次都跳去发岗。
- 未认证公司声明只存在于账号作用域的本地状态；切账号、登出、401 时继续遵守现有清理边界。
- 岗位 create 的 `hiring_organization_claim.display_name`、`description`、`requirements` 必须在发请求前非空。
- Catalog 字段只能写用户选中的 `{id, display_name}`；JD 模型建议不得制造 ID 或自动选择首项。
- TDD：每个任务先提交会失败的回归，再做最小实现。

## 文件地图

| 文件 | 本次职责 |
| --- | --- |
| `src/状态/后端/类型.ts` | recruiter profile 水合阶段 |
| `src/状态/应用状态.tsx` | 新水合 action/state 初值与账号清理 |
| `src/状态/后端/组织操作.ts` | profile 404 空态、revision 0 首写、组织空态 |
| `src/状态/后端/会话操作.ts` | recruiter 水合编排和错误传播 |
| `src/应用.tsx` | 恢复会话时按 profile 存在性恢复路由 |
| `src/屏幕/选身份.tsx` | 首次招聘方入口状态 |
| `src/屏幕/招聘名片.tsx` | 首次 profile 保存、受控公司声明、成功导航 |
| `src/数据/招聘数据源/组织.ts` | 复用 PATCH，允许显式 revision 0 |
| `src/状态/后端/岗位操作.ts` | 发岗声明的最后一道非空保护 |
| `src/屏幕/发布岗位.tsx` | 恢复 requirements 输入、remote 地址条件、字段级错误 |
| `src/数据/后端映射.ts` | 合法 JobCreate 映射 |
| `src/数据/HTTP客户端.ts` | 不把本地错误冒充网络错误；保留结构化 fieldErrors |
| `src/屏幕/公司档案编辑.tsx` | 无 affiliation 空态 |
| `src/屏幕/公司档案分区编辑.tsx` | 直接进入分区时的同一空态 |
| `src/屏幕/企业设置.tsx` | 权威验证状态 |
| `src/屏幕/账号安全.tsx` | 招聘方/中性导出文案 |
| `index.html` | 允许浏览器缩放 |
| `e2e/数据源模式.spec.ts` | 真实数据源形状的完整 onboarding 回归 |

---

## Task 1：把 recruiter profile 404 建模成合法缺失态

**Files:**
- Modify: `src/状态/后端/类型.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/后端/组织操作.ts`
- Modify: `src/状态/后端/组织操作.test.ts`
- Modify: `src/状态/后端/会话操作.test.ts`

建议增加一个闭合阶段，而不是继续用 `招聘方档案 === null` 同时表达“未请求、请求中、缺失、失败”：

```ts
type 招聘方档案水合阶段 = '未开始' | '进行中' | '缺失' | '成功' | '失败';
```

- [ ] 写失败测试：`读取招聘方档案()` 返回 `BFF错误(404, 'not_found', ...)` 时，水合结果不是 reject。
- [ ] 断言 404 后仍继续读取 affiliations；没有 current affiliation 时不读取公开企业。
- [ ] 断言交互式 `切身份('招聘方')` 在 profile 404 时仍 resolve；真正的 500/503 仍 reject，401 仍统一清账号。
- [ ] 在发请求前设为 `进行中`；200 派发 profile 并设 `成功`；仅 404/not_found 设 `缺失`；其他失败设 `失败`。
- [ ] 账号清理、主体切换和角色清理必须把阶段恢复到 `未开始`，防止上一个账号的“成功/缺失”泄漏。

```bash
npm test -- src/状态/后端/组织操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts
git add src/状态/后端/类型.ts src/状态/应用状态.tsx src/状态/后端/组织操作.ts src/状态/后端/组织操作.test.ts src/状态/后端/会话操作.test.ts
git commit -m "fix: treat missing recruiter profile as onboarding state"
```

---

## Task 2：实现 profile 首写和正确的恢复路由

**Files:**
- Modify: `src/数据/招聘数据源/组织.ts`
- Modify: `src/数据/招聘数据源/组织.test.ts`
- Modify: `src/状态/后端/组织操作.ts`
- Modify: `src/状态/后端/组织操作.test.ts`
- Modify: `src/应用.tsx`
- Create: `src/应用.test.tsx`
- Modify: `src/屏幕/选身份.tsx`
- Modify: `src/屏幕/选身份.test.tsx`

- [ ] 写数据源测试：显式 revision `0` 时仍发送 `PATCH /api/v1/recruiter/profile` 和 `If-Match: "0"`，绝不新增 POST。
- [ ] 写操作测试：水合阶段为 `缺失` 且 profile 为 null 时，`保存招聘方档案` 使用 revision 0；响应 revision 1 后写入权威 profile 并把阶段设为 `成功`。
- [ ] 保留已有 profile 的 revision CAS；`未开始/进行中/失败` 时保存必须给出明确本地状态错误，不可盲写 revision 0。
- [ ] 恢复会话时，先等待 recruiter 支持域水合。`缺失` 导向 `路径.招聘名片`，`成功` 导向 `路径.企业主壳`；不要仅凭 `last_used_role` 直跳 `/hr`。
- [ ] 身份选择成功进入招聘名片时携带 `{ 从注册流: true }`；恢复发现 profile 缺失也携带该标记。
- [ ] 写路由回归：缺失 profile → 名片；存在 profile → `/hr`；水合失败不伪装成缺失。

如果当前应用初始化路由在水合完成前已经渲染，不要用任意 timeout；使用现有 `后端状态.初始化` 加 profile 水合阶段形成确定条件。

```bash
npm test -- src/数据/招聘数据源/组织.test.ts src/状态/后端/组织操作.test.ts src/屏幕/选身份.test.tsx src/应用.test.tsx
git add src/数据/招聘数据源/组织.ts src/数据/招聘数据源/组织.test.ts src/状态/后端/组织操作.ts src/状态/后端/组织操作.test.ts src/应用.tsx src/屏幕/选身份.tsx src/屏幕/选身份.test.tsx
git commit -m "fix: create and resume recruiter onboarding profile"
```

---

## Task 3：让招聘名片原子地保存姓名、职务和公司声明

**Files:**
- Modify: `src/屏幕/招聘名片.tsx`
- Modify: `src/屏幕/招聘名片.test.tsx`
- Modify: `src/状态/后端/岗位操作.ts`
- Modify: `src/状态/后端/岗位操作.test.ts`

当前公司输入使用 `defaultValue`，只在 blur 时执行 `保存未认证公司声明`。改成受控字段，并在点击保存时完成以下顺序：

```text
trim + 本地校验姓名/公司
  → 同步提交未认证公司声明
  → await 保存招聘方档案
  → 若从注册流进入，导航到发布岗位并携带从注册流标记
  → 否则保留现有编辑返回语义
```

- [ ] 新 profile fixture 为 null/缺失态，填写姓名、职务和公司后点击保存，断言 profile 保存被调用且公司声明保存被调用。
- [ ] 不触发 blur、直接点击保存，结果仍必须包含公司声明。
- [ ] 空姓名显示“请填写姓名”；没有 verified affiliation 且空公司显示“请填写公司名称”；二者都不得发请求。
- [ ] 保存进行中禁用重复点击。
- [ ] 首次成功导航到 `路径.发布岗位`；已有档案编辑成功不强制跳发岗。
- [ ] profile 本地状态错误显示真实可行动文案，不得走“网络连接失败”。
- [ ] 在 `取发岗声明` 增加最后一道 trim/非空保护。因为 operation 当前返回非 Promise validation type，可在调用前由页面阻止，或让操作抛出明确 client-validation error；不要构造空 claim 发网。

```bash
npm test -- src/屏幕/招聘名片.test.tsx src/状态/后端/岗位操作.test.ts
git add src/屏幕/招聘名片.tsx src/屏幕/招聘名片.test.tsx src/状态/后端/岗位操作.ts src/状态/后端/岗位操作.test.ts
git commit -m "fix: persist recruiter card before job creation"
```

---

## Task 4：恢复独立职位要求并在发岗前完成合同预检

**Files:**
- Modify: `src/屏幕/发布岗位.tsx`
- Modify: `src/屏幕/发布岗位.test.tsx`
- Modify: `src/数据/后端映射.ts`
- Modify: `src/数据/后端映射.test.ts`
- Modify: `src/数据/招聘数据源/岗位.test.ts`
- Modify: `e2e/onboarding.spec.ts`
- Modify: `e2e/数据源模式.spec.ts`

当前源码明确删除了 requirements 输入，却继续发送空字符串。恢复“职位要求”多行文本框；不要把职位描述自动复制过去。

- [ ] 测试第三步存在可访问标签为“职位要求”的 textarea。
- [ ] requirements 为空时“发布”在前端停止，提示“请填写职位要求”，零 mutation。
- [ ] 没有 verified affiliation 且公司声明为空时停止，提示“请填写公司名称”，零 mutation。
- [ ] 完整表单映射后断言 request body 的 `hiring_organization_claim.display_name`、`description`、`requirements` 都是 trim 后的非空文本。
- [ ] 更新现有单元/E2E helper，删除“职位要求已删”的注释和错误假设。
- [ ] 数据源模式 E2E 不要只 mock `操作.发布岗位`；拦截实际 POST 并检查请求体，再返回 201，最后检查页面水合后的岗位。

岗位基线回归可使用：

```text
description: 用户研究、产品验证、产品策略、实验、数据分析、需求执行、GTM、发布与增长
requirements: 应届或毕业年级；有产品/技术/增长/分析/创业经历；关注 AI/SaaS/工作流/开发工具/Agent
```

```bash
npm test -- src/屏幕/发布岗位.test.tsx src/数据/后端映射.test.ts src/数据/招聘数据源/岗位.test.ts
npm run test:e2e:data-source -- --grep "新招聘方 onboarding"
git add src/屏幕/发布岗位.tsx src/屏幕/发布岗位.test.tsx src/数据/后端映射.ts src/数据/后端映射.test.ts src/数据/招聘数据源/岗位.test.ts e2e/onboarding.spec.ts e2e/数据源模式.spec.ts
git commit -m "fix: submit complete recruiter job contract"
```

---

## Task 5：与后端协同修复全远程办公地址

**依赖：** 后端必须先确认并落地“`workplace_mode=remote` 时 `office_location` 可为空；onsite/hybrid 时非空”。前端 PR 可以先写测试，但不得在旧合同上发布会稳定 422 的 UI。

**Files:**
- Modify: `src/屏幕/发布岗位.tsx`
- Modify: `src/屏幕/发布岗位.test.tsx`
- Modify: `src/数据/后端映射.test.ts`
- Modify: `src/屏幕/岗位详情.tsx`

- [ ] remote 模式隐藏或禁用“办公地点”实体地址输入，并从 draft 清除旧值。
- [ ] remote 提交 `office_location: ""`；onsite/hybrid 仍在前端要求非空。
- [ ] 从 remote 切回 onsite/hybrid 后必须重新填写地址，不能恢复一个用户已经清除的陈旧地址。
- [ ] 岗位详情在 remote + 空地址时只显示城市/远程标签，不渲染空地址分隔符。
- [ ] 编辑已有岗位时覆盖 workplace 变化的两种方向。

```bash
npm test -- src/屏幕/发布岗位.test.tsx src/数据/后端映射.test.ts src/屏幕/岗位详情.test.tsx
git add src/屏幕/发布岗位.tsx src/屏幕/发布岗位.test.tsx src/数据/后端映射.test.ts src/屏幕/岗位详情.tsx src/屏幕/岗位详情.test.tsx
git commit -m "fix: make office address conditional for remote jobs"
```

---

## Task 6：修正公司档案空态和认证状态

**Files:**
- Modify: `src/屏幕/公司档案编辑.tsx`
- Modify: `src/屏幕/公司档案编辑.test.tsx`
- Modify: `src/屏幕/公司档案分区编辑.tsx`
- Modify: `src/屏幕/公司档案分区编辑.test.tsx`
- Modify: `src/屏幕/企业设置.tsx`
- Modify: `src/屏幕/企业设置.test.tsx`

没有 current verified affiliation 时，组织水合不会也不应该请求公开 Organization。这是立即可判定的空态，不是 loading。

- [ ] 区分：组织水合进行中、无可用 affiliation、公开企业读取失败、已有企业档案四种状态。
- [ ] 无 affiliation 时显示说明和两个现有动作：“申请成为企业管理员”“使用邀请加入企业”；不要创建合成 Organization。
- [ ] 只有真实请求在飞时显示“正在加载企业资料”；失败显示错误与重试。
- [ ] 直接打开分区编辑路由时执行同一权限/空态保护。
- [ ] 删除 `企业设置.tsx` 的硬编码“已认证”。复用 `企业实名认证.tsx`/`从BFF招聘身份` 的状态映射，至少诚实区分未认证、审核中、已认证、已拒绝/已撤销。
- [ ] 公司自由文本声明不得被当成企业认证。

```bash
npm test -- src/屏幕/公司档案编辑.test.tsx src/屏幕/公司档案分区编辑.test.tsx src/屏幕/企业设置.test.tsx
git add src/屏幕/公司档案编辑.tsx src/屏幕/公司档案编辑.test.tsx src/屏幕/公司档案分区编辑.tsx src/屏幕/公司档案分区编辑.test.tsx src/屏幕/企业设置.tsx src/屏幕/企业设置.test.tsx
git commit -m "fix: show truthful recruiter organization state"
```

---

## Task 7：本地化字段错误、修正文案并恢复缩放

**Files:**
- Modify: `src/数据/HTTP客户端.ts`
- Modify: `src/数据/HTTP客户端.test.ts`
- Modify: `src/屏幕/发布岗位.tsx`
- Modify: `src/屏幕/账号安全.tsx`
- Modify: `src/屏幕/账号安全.test.tsx`
- Modify: `index.html`
- Create or Modify: viewport static regression test used by this repository

- [ ] HTTP 错误对象继续保留完整 `fieldErrors`。不要把第一个 `reason` 机器码直接当最终用户文案。
- [ ] 在发布岗位表单按 `path + reason` 映射到字段：公司名称、办公地址、职位描述、职位要求等；未知 path 使用通用“请检查岗位信息”，并保留诊断对象供开发环境检查。
- [ ] 传输失败才显示网络错误，本地 validation 和服务端 422 不得冒充网络失败。
- [ ] 数据导出文案改成角色感知或中性“账号资料与业务记录”；招聘方界面不得出现“你的简历”。
- [ ] viewport 改为：

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

- [ ] 静态测试断言没有 `user-scalable=no`、`maximum-scale=1`、`minimum-scale=1`。

```bash
npm test -- src/数据/HTTP客户端.test.ts src/屏幕/发布岗位.test.tsx src/屏幕/账号安全.test.tsx
npm run typecheck
npm run lint
npm run build
git add src/数据/HTTP客户端.ts src/数据/HTTP客户端.test.ts src/屏幕/发布岗位.tsx src/屏幕/账号安全.tsx src/屏幕/账号安全.test.tsx index.html
git commit -m "fix: present truthful recruiter errors and account copy"
```

---

## Task 8：后端 API 就绪后接入 JD 建议稿导入

**这是独立能力提交，不阻塞 Task 1～7。** 只有在后端 handoff 中的 API/OpenAPI 合同合并后执行。

**Files:**
- Modify: `src/数据/BFF契约.ts`
- Create: `src/数据/招聘数据源/JD导入.ts`
- Create: `src/数据/招聘数据源/JD导入.test.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/状态/后端/类型.ts`
- Create: `src/状态/后端/JD导入操作.ts`
- Create: `src/状态/后端/JD导入操作.test.ts`
- Modify: `src/屏幕/发布岗位.tsx`
- Modify: `src/屏幕/发布岗位.test.tsx`
- Modify: `e2e/数据源模式.spec.ts`

- [ ] 在发布岗位首屏增加 PDF 上传和明确的模型处理同意；保留“手动填写”。
- [ ] multipart POST 创建导入任务，轮询 GET 到 `succeeded|failed`；离开页面停止前端轮询，不伪造取消服务端任务。
- [ ] 成功结果只作为可编辑建议稿填入 title、description、requirements、workplace 等自由/枚举字段。
- [ ] Catalog 只显示模型建议文本，要求用户从 job-categories/locations 选择真实项；不得用模型文本猜 ID。
- [ ] 不自动提交 Job；用户必须逐步确认并点击发布。
- [ ] 上传失败、解析失败和部分字段缺失都保留手填路径；不得回退 Mock。
- [ ] 不把 PDF 字节、全文、模型响应或导入结果写 localStorage/sessionStorage。

```bash
npm test -- src/数据/招聘数据源/JD导入.test.ts src/状态/后端/JD导入操作.test.ts src/屏幕/发布岗位.test.tsx
npm run test:e2e:data-source -- --grep "JD 建议稿导入"
git add src/数据/BFF契约.ts src/数据/招聘数据源/JD导入.ts src/数据/招聘数据源/JD导入.test.ts src/数据/HTTP招聘数据源.ts src/状态/后端/类型.ts src/状态/后端/JD导入操作.ts src/状态/后端/JD导入操作.test.ts src/屏幕/发布岗位.tsx src/屏幕/发布岗位.test.tsx e2e/数据源模式.spec.ts
git commit -m "feat: import editable job drafts from JD PDFs"
```

## 最终验证清单

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e:data-source -- --grep "新招聘方 onboarding|JD 建议稿导入"
```

必须人工或自动确认：

- 新招聘方 profile 404 不再卡身份选择。
- 首次名片保存真实发 PATCH + `If-Match: "0"`，回读 revision 1。
- 公司输入不依赖 blur。
- JobCreate 的公司名、description、requirements 均非空并得到 201。
- profile 缺失刷新回名片，profile 存在刷新进 `/hr`。
- 无 affiliation 时公司档案是可操作空态，设置页不显示虚假“已认证”。
- 招聘方导出不出现“你的简历”。
- 页面允许缩放。
- remote 空地址只在相应后端合同部署后验收。
- JD 导入只产生用户可编辑建议稿，不自动发布、不猜 Catalog ID。

交付报告必须列出修改文件、commit SHA、每条验证命令和退出码；未运行的 E2E 要明确写 `NOT RUN` 及原因。
