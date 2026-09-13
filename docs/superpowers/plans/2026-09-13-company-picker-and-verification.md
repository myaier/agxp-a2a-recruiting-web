# 七类公司选择与企业认证接线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL：Codex 实际调用 `superpowers:executing-plans`；Claude Code 实际调用 `superpowers:subagent-driven-development`。按下列依赖连续执行，checkbox 记录进度。完成实施后进入唯一的不计数收尾章节，不自动进入 finishing 默认流程。

**Goal:** 七类页面复用公司选择底部抽屉，搜索／添加后以真实企业 ID 保存，认证申请准确绑定所选企业。

**Architecture:** 在既有组织数据源、组织操作、页面草稿及 DTO 中最小接线；公司抽屉复用弹层框架、现有候选列表样式和组织查询钩子。保留档案自报企业与管理 affiliation 两种既有事实的区别，不新建企业状态服务、请求框架、通用表单或目录基础设施。

**Tech Stack:** React 19、TypeScript、现有 CSS Modules、Vitest/Testing Library、Vite、Playwright；不新增依赖。

**Spec:** `docs/superpowers/specs/2026-09-13-company-picker-and-verification-design.md`。批准契约为 revision `4b4edad965ef89e6a59a9927cacab3a94cdbdf37` / blob `1aeb99dc03fb2ff343a3fd10cb67a7771aace7d1`；用户于 2026-09-13 明确批准写零上下文 Plan、Claude review、执行提示词。工作树 Spec 的状态／前置纠正不是新的产品授权。

## Global Constraints

- 仓库 `myaier/agxp-a2a-recruiting-web`；工作区 `.`。前端调查基线 `5fca5f7a30376c962bd89f3e2afa5e46cab47421`，预计合入目标 `origin/main`（当前 origin/HEAD 指向 main），final gate 冻结实际目标，不改别的 worktree。
- 后端合同固定 `agxp-monorepo@e2c40ef2ec6cdc8ca5228add4a83d5dde0deb684`，使用该版本 `apps/recruitment-bff/openapi/mobile-v1.yaml`；执行者现场定位后端，先验证 Git 对象／部署版本。仅源码存在不等于运行环境支持；不修改后端，不升级锁文件。
- 完整读 `AGENTS.md`、`CLAUDE.md` 及批准 Spec。以 `git show 4b4edad965ef89e6a59a9927cacab3a94cdbdf37:docs/superpowers/specs/2026-09-13-company-picker-and-verification-design.md` 核对契约；不以最新 Spec 自证范围扩大。
- 无新增 UI 库、状态库、后端服务、通用目录框架、兼容双写或持久化迁移；不重构整个组织域。新共享部件只服务七个现实入口及已存在的教育候选列表。
- 七类入口严格为招聘名片、工作经历、引导问答、屏蔽名单、管理员申请、发布／编辑岗位、企业实名认证；邀请绑定及公司档案权限作为保护性回归，不新增选择控件。
- Mock/Backend 共用新增展示；请求仍通过既有操作和数据源。Mock ID 不进 Backend，不建立模拟 HTTP/认证后台。中文文案与现有布局、颜色、选中勾沿用。
- 选中／创建只返回企业选择，父页面按自己的保存纪律执行；创建为独立已确认写入，父表单取消不删除共享企业。
- 企业已认证、自报公司、用户 affiliation 三者不能混淆；`verified + admin` 才是管理员关系。只知企业 ID 不产生管理权限。
- 搜索 250ms 防抖、分页、迟到响应与账号切换保护保留；抽屉中文输入与稳定关闭回调必须验证。
- 不恢复旧公司文本为真实身份；旧草稿和解析文本只作搜索词。保留用户内容，阻止缺企业 ID 的实际经历／岗位写入，不通过跳过条目伪造保存成功。
- 任务共享文件顺序修改；不刻意并行。每次扩大路径先按 development-workflow 的 `scripts/task_intents.py update` 更新本机预告并检查重叠，不删除他人记录。
- 本 Plan 冻结边界、接口与反例；内部 helper 名称或等价实现可由实施者选择，不预写整套实现正文。若现场变更导致契约不可满足，报告精确冲突，不顺便重新设计。

## Task index 与角色档位

Task count: 6
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

**计划本身复杂度：高。** 七类页面涉及严格 DTO、CAS、建档恢复及两种企业坐标，测试责任跨层；任务按现有职责拆分，没有额外架构层。

**零上下文漂移风险：中。** 产品范围及后端版本已冻结，主要风险为旧草稿、共享状态与已推进目标分支的适配，具体接口及反例在本 Plan 指定。

执行模型按中漂移风险选择当前可用的行业 Top 5–10 中高性价比模型。档位为 workflow 映射，不是实时模型排名。

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|组织 wire 与操作合同；无实施依赖|Top 5–10（Claude Code: sonnet）|前沿 / 顶级模型（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|2|公司抽屉与查询控制；依赖 1|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|3|招聘名片、实名、申请三页；依赖 1、2|Top 5–10（Claude Code: sonnet）|前沿 / 顶级模型（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|4|经历 ID、预填与恢复；依赖 1、2、3|Top 5–10（Claude Code: sonnet）|前沿 / 顶级模型（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|5|屏蔽两页；依赖 1、2、4|Top 5–10（Claude Code: sonnet）|前沿 / 顶级模型（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|
|6|岗位创建／编辑；依赖 1、2、3、5|Top 5–10（Claude Code: sonnet）|前沿 / 顶级模型（Claude Code: opus）|Top 5–10（Claude Code: sonnet）|

三角色是宿主执行 skill 使用时的分配；Codex 固定 executing-plans，不因表格主动启动 Task 子代理或解析 Claude alias。依赖 3→4→5→6 部分是共享 BFF/类型/测试样本的串行约束，不能把中途前端候选部署到真实环境。

## 公共契约与交接表

### A. 组织目录、档案、申请

沿用 `src/数据/BFF契约.ts` 的现有名称，新增／调整：

```ts
interface BFF组织搜索项 {
  organization_id: string;
  display_name: string;
  legal_name: string | null;
  verification_status: 'unverified' | 'verified';
}
interface BFF组织创建结果 { organization: BFF组织搜索项; created: boolean }
// BFF招聘方档案：新增必需 organization_ref: string | null。
// BFF招聘方档案补丁：新增可选 organization_ref?: string | null，省略保留、null 清空。
// BFF企业管理员申请：新增必需 organization_id: string。
// BFF企业管理员申请元数据：删除 display_name，新增必需 organization_id。
// BFF公开企业：legal_name、verified_at 均 string | null，其他键保持原合同。
```

数据源 `组织数据源` 新增 `创建组织(displayName: string, idempotencyKey: string): Promise<BFF组织创建结果>`，调用 `POST /api/v1/organizations`，JSON 仅 `{display_name}`，请求使用现有 `幂等: true, 幂等键: idempotencyKey`。沿用 `搜索组织(query)` 的路径、参数，解析四字段条目。返回结果经 strict decoder，不 `as` 直转、不将 null 变空字符串。

操作表 `组织操作` 新增：

```ts
搜索组织(query: 组织搜索查询): Promise<BFF组织搜索页>;
创建组织(displayName: string, idempotencyKey: string): Promise<BFF组织创建结果>;
读取目录企业(id: string): Promise<BFF组织搜索项>;
```

`读取目录企业` 在现有组织操作文件调用数据源 `读取公开企业(id)`，校验回执 ID 一致，再从 display_name/legal_name/verified_at 投影；两项认证事实非空时 verified，均 null 时 unverified，矛盾响应拒绝。PublicOrganization 本身没有 verification_status，不发明 wire 字段。不修改当前管理关系／企业档案，不增加目录缓存；页面按需读取选择。已有公开企业缓存仅按原调用链使用。

新操作及本次触及的档案／申请写入捕获既有主体、角色、会话代际；迟到成功不派发、不返回可应用的旧主体选择，迟到 401 不清新会话。现有 Provider 通过 spread 组合操作，无需新 store。原 `搜索可屏蔽组织` 待 Task 5 全部消费者迁移后删除，不留重复实现。

错误：422 字段错误回到 display_name/organization_id 或具体 ref 槽；创建 409 `organization_unavailable` 保留输入并说明不可用，`idempotency_conflict` 不自动换键掩盖；409 版本冲突读取当前资源后提示重试，不能无确认覆盖用户草稿；401 沿现有会话清理；网络／503 保留输入并可重试，错误不冒称空结果。

### B. 共用 UI 合同

在 `src/屏幕/组织查询钩子.ts` 导出扩展后的 `use组织查询`，保持现有一个钩子承担实例内搜索／创建控制；不新增 controller/service 层。参数改为 `{搜索?, 创建?, 作用域键: string}`：搜索和创建签名见 A；作用域键用既有 backend env + 主体 + 角色以及页面资源 ID 拼接，由页面传入，Mock 使用固定本地作用域。切换作用域清理本实例、作废在飞请求。

输出保留 `词/设词/结果/搜索中/下一页游标/加载中/加载更多/重新查询/选择/选中`，新增 `搜索错误: string|null, 加载错误: string|null, 创建中: boolean, 创建错误: string|null, 添加(displayName: string): Promise<BFF组织搜索项|null>`。移除 `来源/设来源`；这两个 state 留在屏蔽页面。`添加` 同步单飞，每个提交名称意图保存 UUID key，失败重试同名同键、改名新键；页面关闭／作用域变更后返回 null，不回填。查询实例不持久化。

新增 `src/组件/公司选择层.tsx` 为纯展示（不读 Context、HTTP、BFF DTO、路由或存储），props 精确为：

```ts
type 公司选择行 = { 键: string; 名称: string; 正式名: string|null; 已认证: boolean; 选中: boolean };
type 公司选择层属性 = {
  搜索词: string; 修改搜索词: (value: string) => void;
  项们: 公司选择行[]; 搜索中: boolean; 搜索错误: string|null; 重试搜索: () => void;
  还有: boolean; 加载中: boolean; 加载错误: string|null; 加载更多: () => void;
  选定: (key: string) => void; 关闭: () => void;
  创建中: boolean; 创建错误: string|null; 添加: (name: string) => void;
};
```

纯展示可维护“搜索／添加”视图及名称编辑值；创建在途禁用添加，关闭仍可用。进入添加预填搜索词，返回搜索不丢原父页选择。空输入不请求，显示“输入公司名称”；失败与零结果分开。结果行通过 ID 交回，调用方在本实例结果中定位完整项，正常选中回填后关闭；添加成功用返回项执行同一个回填路径。

抽屉以 `弹层框架` 为骨架，样式采用原行业选择的抓手／标题／列表和教育候选列表颜色尺寸。新增公司样式只处理搜索框、正文高度与错误位置，390×844 及键盘出现时列表能滚动，底部操作可达。新增 `src/组件/目录候选列表.tsx` 提取教育组件已有 JSX，教育原 props/导出保持包装；公司将名称、正式名、认证文字映射为该简单列表的主副行，不创建万能 renderer/配置表。

Mock 模拟目录集中在 `src/数据/企业端模拟数据.ts` 增加导出，以本地数组模拟搜索／添加（同名复用）；候选页面也可用该目录，绝不取真实接口。Mock 认证原型保留，但该页新增公司选择也使用同一抽屉。不增加产品调试入口。

### C. 保存归属与页面字段

- 招聘名片待保存选择留本页，PATCH 带 organization_ref，成功后水合档案；头像后续 CAS 使用保存返回 revision。已有 `当前企业关系编号` 只服务 affiliation/管理，不被自报选择赋值。
- 实名页选择仅为待申请选择，跳转 `/hr/organization-application?organization_id=<encoded-id>`。这是公开 ID，不是邀请 token；申请页以参数优先，其次档案 organization_ref，无值则空。读取校验成功前不允许申请；刷新保留 URL 目标，旧响应不覆盖新目标。更换选择更新 URL（replace）并清空原企业材料。
- 申请仍走原 multipart 元数据＋1–5 files。domains 可 `[]`，名称长度用 Unicode code points。列表按所选 organization_id 过滤，取消始终用实际 request_id/revision；未提交的其他企业选择不影响已有请求。不要新增单申请 GET。
- `简历经历段` 新增 `组织编号?: string`，原 `公司` 只保留展示／搜索词。BFF经历读新增 organization_id，BFF经历写入改为 organization_id，禁止 company。其他领域不自动赋予成员权。
- `在招岗位` 新增可选 `发布模式?: 'direct'|'agency', 发布方企业编号?: string, 用人企业编号?: string`。Backend 读从 OwnerJob 原样恢复；编辑不从名片重新推断。表单待选项可为本地完整目录项，最终保存到这三个字段。
- 将 `岗位创建上下文` 改为 `{publisherMode: 'direct'|'agency'; publisherOrganizationRef: string; hiringOrganizationRef: string}`，现有创建数据源签名不变；context 由本次 job 字段构建，删除 `取发岗声明` 文本推导。更新数据源仍为 `更新岗位(job, previous)`，仅将用户实际改变的 refs 进补丁。
- 当前前端新建模式只有 direct，本任务保持这一来源；agency 由已存在岗位的 publisher_mode 恢复并展示双企业行，不额外发明新建代理模式选择器。直招单行选一次，两 refs 相等。新建默认档案企业（读取有效后才选中），编辑恢复自己的 ID。

## 测试选择与前置（五问）

1. 防止的故障：严格 decoder 拒绝新后端、自由文本被当 ID、未认证用户被挡、重复创建／错误回填、经历恢复丢 ID、跨账号污染、认证目标错绑、隐私 revision 过时和岗位双 ID 混淆。涉及 HTTP、状态、表单及页面返回／刷新边界。
2. 开发最小反馈用各 Task 指定的 `npm test -- <文件们>`。先读已有测试再增加有必要的失败反例，不增加测试平台；本仓库没有 `tools/test affected` 或 TEST_DELTA 入口，不借用后端整层 runner。确认前完整 diff 的 affected 可用安装版本支持的 `npx vitest related --run <完整变更源码列表>` 加新增／直接修改测试文件的显式运行；不是 `--changed` 只测最后一次提交。
3. HTTP JSON 与 multipart 变化在 Task 1/3/4/6 用已有请求桩验证确切 body/header；共享焦点在 Task 2 用真实 DOM 验证；隐私连续 CAS 在 Task 5 用立即返回与延迟返回分别验证，不能等正式 L3 才首次发现。正式真实后端仍留 final gate。
4. 全部实施和异构 review 后负责汇总最小覆盖结果、typecheck/lint/build、七页面浏览器验收；现有 PR UI Regression workflow 为独立视觉 CI，不能声称已通过而实际未跑。实际 deployment、正式后端行为与合入在 final gate 方案批准后执行。
5. 本候选没有运行测试，无 PASS 可复用，成本未知；历史样本只用于定位。用测试产物／终端结果留证，时间未知不编造。只有候选／依赖／环境不变且覆盖可证明时才复用。

L3 selection: required，七类入口真实 API 闭环＋注册复用与双会话隔离。精确入口为 `docs/dogfood/真实后端行为验收.md` 的 local B01–B05 中实际覆盖候选/招聘 CRUD、双会话隔离部分，以及 `docs/dogfood/backend-local-onboarding.md` 的相关注册步骤；追加七页面观察点见 Spec §7，不伪称指南原 Case 全部已覆盖。按该指南先读后端环境 skill，取得部署于冻结版本的可用环境、目标 URL、测试账户安全来源与环境归属。正式 scope、精确命令与 cleanup 在 final gate 展示；不默认运行 H01–H04、STG 或后端 release 全量。缺前置记 BLOCKED/未验证，由同一实施者协调，不在规划时造账号或运行栈。

### Task 1: 接通目录与新组织 wire 契约

目标：真实搜索／创建／按 ID 读取可供后续页面使用，新招聘档案和申请响应不会被旧 strict decoder 拒绝。非目标：不接页面、不改岗位／经历写入、不建立缓存。

预期编辑文件：
- 新增：无。
- 修改：`src/数据/BFF契约.ts`、`src/数据/招聘数据源/组织.ts`、`src/状态/后端/类型.ts`、`src/状态/后端/组织操作.ts`、`src/数据/组织映射.ts`、`src/测试/BFF样本.ts`、`src/数据/招聘数据源/组织.test.ts`、`src/状态/后端/组织操作.test.ts`、`src/数据/组织映射.test.ts`、`src/数据/HTTP招聘数据源.test.ts`。
- 删除：无。

消费：后端固定 OpenAPI、现有 BFF请求选项.幂等键、主体及会话代际 refs、组织数据源 facade。产出：合同 A 的 DTO 和三个组织操作，`组织操作` 经 Provider 原 spread 自然可用；不改组合架构。

- [ ] 读取上述生产／测试文件及后端组织路由，核对合同 A 字段；核对公开企业无 verification_status，nullable 两事实是投影来源。
- [ ] 在已有组织 HTTP 测试补失败用例：null legal_name＋unverified 四字段页可读；POST 只有 display_name 且保留明确幂等键；创建 201/复用 200 都可解析；PublicOrganization 两事实 null 可读；profile organization_ref 三态；申请响应含 organization_id。坏 enum、额外字段仍拒绝。
- [ ] 在组织操作测试补目录调用期间切账号、旧 401、读取回执 ID 不匹配；创建和读取目录不能修改当前管理关系。
- [ ] 运行 `npm test -- src/数据/招聘数据源/组织.test.ts src/状态/后端/组织操作.test.ts src/数据/组织映射.test.ts src/数据/HTTP招聘数据源.test.ts`，确认新增断言因旧字段／缺方法失败后实施最小修改。
- [ ] 更新共用样本字段（组织项、档案、申请、公开企业），现有测试本地对象只补新合同必需键，不批量改无关业务预期；保持旧已认证事实有效。
- [ ] 用同一命令验证 PASS，检查 `git diff --check`，只提交该 Task 的实际文件。

最小断言示例（沿既有测试 harness）：`expect(options.body).toEqual({display_name:'启明科技'})`；`expect(options.幂等键).toBe(key)`；`expect(result.organization.legal_name).toBeNull()`；目录读取后 `当前企业关系编号` 原值不变。

完成：A 合同请求、响应、隔离反例全部成立。停止：后端冻结版本与公开接口不符，或必须更改全局权限才能搜索时报告，不扩张 API。

### Task 2: 实现共用公司选择抽屉并复用候选列表

目标：完成搜索、分页、添加、同名复用、回填、取消及中文输入；七页只需提供操作与回填。非目标：不改父页保存，不新增页面路由或通用组件系统。

预期编辑文件：
- 新增：`src/组件/公司选择层.tsx`、`src/组件/公司选择层.module.css`、`src/组件/公司选择层.test.tsx`、`src/组件/目录候选列表.tsx`。
- 修改：`src/组件/教育目录候选列表.tsx`、`src/组件/教育目录候选列表.test.tsx`、`src/屏幕/组织查询钩子.ts`、`src/屏幕/组织查询钩子.test.ts`、`src/数据/企业端模拟数据.ts`。
- 删除：无。

消费：Task 1 A 的完整搜索项与操作签名；原行业选择／教育候选 CSS、弹层框架。产出：B 的精确 props/hook，Mock 搜索／创建 callbacks 与本地数组。教育 props 导出不变，不迫使学校／专业调用者新增企业参数。

- [ ] 用现有 React Testing Library 样式写用例驱动公司纯展示：零输入、结果选择、返回／遮罩／Escape 取消、同抽屉添加及失败保留、创建中禁用。名称使用 Unicode code points 计数，拒空白／控制字符，合法中文 80 字可提交。
- [ ] 扩展 hook 测试：250ms 防抖；A 词迟到不覆盖 B；相同 ID 跨页去重；错误与空结果不同；在飞双击只创建一次；同名失败重试 key 相同，改名 key 不同；切作用域后旧结果返回 null。
- [ ] 运行 `npm test -- src/组件/公司选择层.test.tsx src/屏幕/组织查询钩子.test.ts src/组件/教育目录候选列表.test.tsx`，观察新增断言失败。
- [ ] 按合同 B 提取简单候选 JSX，教育保持 wrapper；公司层用稳定关闭 callback 接现有弹层，不重写全局弹层系统。先用这一局部方案满足连续输入，无证据不改弹层骨架。
- [ ] Mock callbacks 使用模拟企业数组，同名复用只在本地；不通过数据源模式分两套公司 JSX。仅复用必要列表和样式，不移动整个教育／行业组件目录。
- [ ] 运行 `npm test -- src/组件/公司选择层.test.tsx src/屏幕/组织查询钩子.test.ts src/组件/教育目录候选列表.test.tsx src/组件/弹层框架.test.tsx src/屏幕/工作经历.test.tsx` 定向验证（新增共享列表真实旧消费者）；检查 diff 后提交。

反例：搜索返回列表后中文输入法确认字词不能触发首行选择或创建；关抽屉后创建成功不改新页面；教育列表仍显示原副文与单一选中勾。完成：B 可被后续页面直接使用，原消费者通过。停止：需要新增设计系统或产品流程才能完成时回到批准范围解决，不现场发明。

### Task 3: 接通招聘名片、企业实名和管理员申请

目标：三页使用同一选择层，自报保存、申请传值和管理权限各自正确。非目标：不更改邀请 token、公司档案编辑流程或认证审批后台。

预期编辑文件：
- 新增：无。
- 修改：`src/屏幕/招聘名片.tsx`、`src/组件/招聘名片/招聘名片展示.tsx`、`src/屏幕/企业实名认证.tsx`、`src/屏幕/企业组织申请.tsx`、`src/状态/后端/组织操作.ts`、`src/数据/BFF契约.ts`、`src/数据/招聘数据源/组织.ts`、`src/数据/组织映射.ts`、`src/路由/路径表.ts`、`src/屏幕/招聘名片.test.tsx`、`src/屏幕/企业实名认证.test.tsx`、`src/屏幕/企业组织申请.test.tsx`、`src/组件/招聘名片/招聘名片展示.test.tsx`、`src/状态/后端/组织操作.test.ts`、`src/数据/招聘数据源/组织.test.ts`、`src/数据/组织映射.test.ts`、`src/状态/应用状态.test.ts`。
- 删除：无。

消费：Task 1 A 操作／DTO；Task 2 B UI／hook。产出：合同 C 的档案保存、query 参数传值与按企业筛申请，供 Task 6 默认岗位企业使用。不新增全局“当前目录企业”，仍读 `招聘方档案.organization_ref`。

- [ ] 名片测试冻结注册首写 If-Match 0、后续保存新 revision、选择未认证企业可保存且不改管理 relation；改选后取消保持原公司；保存后头像使用返回 revision；409 重读后用户草稿仍可见。
- [ ] 实名和申请测试冻结 query 参数优先于档案、直接访问缺选择、刷新恢复、目标不存在、旧目标迟到、换企业清空证据、取消选择保留证据、只展示对应企业申请。先运行下方命令确认失败。
- [ ] 名片公司展示 props 改为公司选择行和按下回调；保留现有关系列表作为管理关系控件，禁止把 affiliation id 赋给 organization_ref。公司 preview 使用待保存选择名。
- [ ] 实名页沿已批准位置显示待申请企业，按钮携带 encoded organization_id；个人实名与任职管理员独立显示。Mock 原型中公司输入也换同一选择 UI，保留其余原型行为。
- [ ] 申请 metadata 精确为 `{organization_id, legal_name, registry_key, explanation, domains}`；display_name 从请求删除，展示名读选中企业。允许 domains=[]；保留文件边界、multipart 和输入长度。更换成功后清材料，提交在途禁止换目标／重复提交。
- [ ] 创建操作读取真实申请结果后刷新申请列表；若 approved 再重读关系与目标企业，不以 POST 成功自行认证。提交已成功而后续刷新失败时保留返回申请，不诱导重复 POST；页面显示状态刷新失败可重试读取。取消只按选定申请 id/revision，不能替换为全列表最新项。
- [ ] 运行 `npm test -- src/屏幕/招聘名片.test.tsx src/屏幕/企业实名认证.test.tsx src/屏幕/企业组织申请.test.tsx src/组件/招聘名片/招聘名片展示.test.tsx src/状态/后端/组织操作.test.ts src/数据/招聘数据源/组织.test.ts src/数据/组织映射.test.ts src/状态/应用状态.test.ts`。保护性再运行 `npm test -- src/屏幕/企业邀请加入.test.tsx src/屏幕/公司档案编辑.test.tsx src/屏幕/公司档案分区编辑.test.tsx`。
- [ ] 检查 diff 并提交。仅按当前选择生成的新代码变更，不能通过修改无关企业设置/我的布局“统一整个企业端”。

断言：`metadata.organization_id===目标ID` 且无 display_name；换自报企业后管理档案 PUT 仍指向原管理员 relation 的企业；组织已认证但自己无 relation 时申请入口可达，管理按钮不因此开启。完成：三页合同闭环与权限回归成立。停止：后端版本不支持未认证 PublicOrganization 时记录环境前置，不回填假认证事实。

### Task 4: 工作经历真实企业 ID 与建档恢复

目标：经历新增／编辑／解析预填确认、日常保存及建档恢复贯通企业 ID。非目标：不改教育、项目、技能协议，不清空用户草稿。

预期编辑文件：
- 新增：无。
- 修改：`src/数据/类型.ts`、`src/数据/BFF契约.ts`、`src/数据/后端映射.ts`、`src/数据/招聘数据源/简历.ts`、`src/数据/资料缓存.ts`、`src/流程/候选Onboarding简历预填.ts`、`src/状态/后端/候选操作.ts`、`src/屏幕/工作经历.tsx`、`src/测试/BFF样本.ts`、`src/数据/后端映射.test.ts`、`src/数据/招聘数据源/简历.test.ts`、`src/数据/资料缓存.test.ts`、`src/流程/候选Onboarding简历预填.test.ts`、`src/状态/后端/候选操作.test.ts`、`src/屏幕/工作经历.test.tsx`。
- 删除：无。

消费：A 目录项、B 选择层、现有分区 diff/待写入槽与恢复协议。产出：`简历经历段.组织编号?: string`、BFF经历.organization_id、BFF经历写入.organization_id；Task 5 用该 ID，不读取解析文本判断企业身份。

- [ ] 在映射测试写入经历 `{组织编号:'org_1', 公司:'快照名', ...既有必需字段}`，断言请求含 organization_id、不含 company；缺 ID 为 `客户端校验错误('organization_id', '请选择公司')`。
- [ ] 在经历页面测试以搜索词预填旧公司文本、选中后保存、取消不改旧值、同名不同 ID 不混淆；解析预填不自动搜索首命中／创建，完成状态必须包含真实 ID。
- [ ] 在缓存与恢复测试使用已保存和待写入 experience-create/update 槽：保留组织编号，重放 body 与原幂等 key 一致；未知结果后恢复不再次创建已成功经历。运行下方命令确认新增用例失败。
- [ ] 从BFF简历读入 ID，转经历写入只传 ID。数据源构建 mutation 步骤前检查需要写的经历；旧空白占位仍按原中间屏规则保留，但缺 ID 的用户完整条目不能直接跳过再报告完成。不得在完成保存后用服务器快照覆盖丢失该草稿。
- [ ] 资料缓存沿现有字段白名单支持组织编号和四字段公司待选（legal_name nullable）；旧文本草稿不升级为真实选择，也不因新增字段将整份草稿判坏删除。`候选操作` 恢复请求体的 company 读取改为 organization_id，显示文本从原草稿／已有快照保留；待写入旧 company body 标为需重新选企业而不自动重放旧合同。
- [ ] 预填 `经历未完成` 增加 ID 缺失判断；公司显示文本保留供搜索。页面接 B 抽屉，普通表单完成和 onboarding 最终提交都不能绕过 ID。
- [ ] 运行 `npm test -- src/数据/后端映射.test.ts src/数据/招聘数据源/简历.test.ts src/数据/资料缓存.test.ts src/流程/候选Onboarding简历预填.test.ts src/状态/后端/候选操作.test.ts src/屏幕/工作经历.test.tsx`，检查 diff 后提交。

断言：POST/PATCH experiences 不含 company；角色切换后旧写入不污染另一主体；只改教育且经历完全未变不强制用户重写经历；实际需提交缺 ID 经历时明确拦截且保留文本。完成：读写恢复使用同一 ID，Task 5 可消费。停止：必须更换建档 journal 架构才能恢复时先报告已验证的具体缺口，不新建 journal。

### Task 5: 屏蔽名单与引导问答复用目录

目标：两页面搜索／添加并以真实 ID 屏蔽，正确处理连续 revision、部分成功及解除。非目标：不新增批量后端 API，不把历史任职推断为企业关联关系。

预期编辑文件：
- 新增：无。
- 修改：`src/屏幕/屏蔽名单.tsx`、`src/屏幕/引导问答.tsx`、`src/状态/后端/隐私操作.ts`、`src/状态/后端/类型.ts`、`src/屏幕/屏蔽名单.test.tsx`、`src/屏幕/引导问答.test.tsx`、`src/状态/后端/隐私操作.test.ts`、`src/状态/应用状态.test.ts`。
- 删除：无（删除旧 `搜索可屏蔽组织` 方法与重复搜索 JSX，不删除文件）。

消费：A 组织操作、B 抽屉、Task 4 经历组织编号，以及 `添加组织屏蔽(id, source): Promise<void>` / `解除组织屏蔽(item)`。产出：两个入口及一键操作均使用现有隐私接口、既有权威状态，原来源 UI 不丢。

- [ ] 屏蔽名单保留 `来源` 为页面本地 state，选择企业后按钮才可用；改来源清理待选，取消抽屉保留原值。写入成功后重读／合并权威隐私再显示 chip。
- [ ] 引导“再加一家”明确代表手动屏蔽，选中／添加完成即调用 source=手动添加；创建目录成功而屏蔽失败时显示屏蔽失败，不再次造目录条目，允许重选同一企业重试。
- [ ] 一键屏蔽先检查所有非空公司经历都有组织编号；缺任一则提示回工作经历补选，本轮不静默部分执行。真实 ID 去重，已有屏蔽不改 source；结束时间为 null 的在职经历用当前雇主，其余曾任职企业用手动添加，不从历史经历推断 related_organization。多个同 ID 条目只调用一次，在职优先。
- [ ] 用顺序 await 处理目标 ID；不要 Promise.all。现有隐私快照提交仅 setState 时同一 tick 后端状态引用可能落后，最小调整既有提交函数使本次权威 revision 同步写进 ref 后再派发；保留原隔离栅栏，不新建批处理协议。首次失败停止剩余写入，已成功项显示，重试跳过已有成功目标。
- [ ] 开关状态从本次目标集合与权威屏蔽计算；无目标不能显示全部已屏蔽。关闭一键时导航现有屏蔽名单进行逐项解除确认，不自动解除当前雇主／关联公司，不做假的本地关态。
- [ ] 删除隐私域搜索代理，所有目录查询使用组织操作。Mock 使用同一 UI，模拟的本地屏蔽沿现有 action，不发 Backend 请求。
- [ ] 先补失败测试并运行，再实施，再运行 `npm test -- src/屏幕/屏蔽名单.test.tsx src/屏幕/引导问答.test.tsx src/状态/后端/隐私操作.test.ts src/状态/应用状态.test.ts`。关键序列：隐私 revision 3 → 首写回执4 → 第二写携带4；第二项失败仅首项 chip，重试不重写首项；关闭只去现有解除入口。
- [ ] 检查 diff 后提交。

完成：两页不再依赖公司自由文本，三来源保留，部分失败和风险确认成立。停止：需要新增批量服务或修改 privacy source enum 时报告，不把它纳入最小前端实现。

### Task 6: 发布／编辑岗位显式保存双企业坐标

目标：直招单选同 ID、代理编辑双选不同 ID，刷新和再编辑稳定；不再从已认证 affiliation 或本地公司声明生成 claim。非目标：不新增模式切换、不扩展推荐／初筛门槛修复、不更改岗位其他不可变字段。

预期编辑文件：
- 新增：无。
- 修改：`src/数据/类型.ts`、`src/数据/BFF契约.ts`、`src/数据/招聘数据源类型.ts`、`src/数据/后端映射.ts`、`src/数据/招聘数据源/岗位.ts`、`src/状态/后端/岗位操作.ts`、`src/屏幕/发布岗位.tsx`、`src/测试/BFF样本.ts`、`src/数据/后端映射.test.ts`、`src/数据/招聘数据源/岗位.test.ts`、`src/数据/HTTP招聘数据源.test.ts`、`src/状态/后端/岗位操作.test.ts`、`src/屏幕/发布岗位.test.tsx`。
- 删除：无（删除本链路 `取发岗声明` 及旧 claim 可写字段，不全仓清除仍有消费者的旧显示字段）。

消费：A/B、Task 3 profile.organization_ref 和 C 的精确岗位字段/context。产出：BFF岗位创建两个必需 refs；补丁两个可选 refs，仅有用户实际变更才传；服务端公司快照只读。

- [ ] 在映射／数据源测试替换“不得提交 refs”旧断言：创建 direct 两 refs 相等，agency 不同；JSON 无 hiring_organization_claim、affiliation ref、verification status。缺 ref 或 direct 不相等在发请求前指出具体字段。
- [ ] 从BFF岗位恢复发布模式和双 ID；新建默认读取档案所选企业，用户触碰后迟到默认读取不能覆盖。编辑每个企业按其 ID 读取，不按当前名片猜；无效企业允许更换，不能显示成已成功保存。
- [ ] 在岗位表单现有企业信息相关位置加选择行，direct 一个“用人企业”、agency “发布方企业／用人企业”两个；不增加新建模式选择器。选中只改本岗草稿，取消保持原值。
- [ ] 操作层以 job 内三字段构造 context；更新 mapping 将变化的 refs 进 PATCH，未改公司时不回传 claim/refs，不受名片改变影响。ID 清空或 suspension 错误回到对应选择行；保留 If-Match、结构化确认、所有权和现有 mutation 锁／会话代际。
- [ ] JD 解析建议只填现有正文等字段，不创造或覆盖企业 ID；无企业默认时必须用户选择。移除本页针对未认证声明的“去招聘名片填写名称”阻挡。
- [ ] 先用新增失败断言运行，再实施，再运行 `npm test -- src/数据/后端映射.test.ts src/数据/招聘数据源/岗位.test.ts src/数据/HTTP招聘数据源.test.ts src/状态/后端/岗位操作.test.ts src/屏幕/发布岗位.test.tsx`；补跑 `npm test -- src/屏幕/岗位详情.test.tsx` 保护读回展示。
- [ ] 检查 diff 后提交；任务只记录实施验证，不把全局异构 review 或 final gate 塞入本 Task。

完成：新建、编辑、刷新及双坐标反例成立；本次选择不赋予企业管理／他人岗位权限。停止：真实后端需要合同外字段或只有全局权限重构才能发岗时报告具体证据，不以 fallback claim 继续。

## 实施后收尾（不计入 Task count）

1. 全部 Task 及执行 skill 要求的宿主内全局 review 完成后，退出 Task 循环。Codex 调用 `claude-review-loop`，Claude Code 调用以 Codex 为 reviewer 的只读多轮 review-loop；绑定批准 Spec 精确版本与固定候选 diff、共用 review 合同。reviewer 不跑测试；轮间只补修复的轻量测试，必要性与复杂度逐项裁决，轮次／停止条件由对应 skill 负责。修复不扩张 Spec，optional 不阻塞。
2. 异构 review 返回后对完整基线 diff 计算 affected：读取 `git diff --name-status <实际已记录目标SHA>...HEAD`、全部生产消费者和新增／修改测试；用安装版本 Vitest 的 related 能力覆盖完整变更源码，再显式覆盖直接修改／新增测试。先核实 CLI 支持，不照抄后端 tools/test；所有选择命令和结果留在现有测试产物或执行终端。相关测试已经有效通过则复用，不能只覆盖最后修复提交。
3. 运行尚无有效证据的 `npm run typecheck`、`npm run lint`、`npm run build`。共享 DTO 的编译错误样本允许精确补新字段，先记录具体新增路径；不能把无关测试删掉取得全绿。测试失败在批准范围内修复后只补失效项，不重新触发 Task/global/异构 review。
4. 展示具体 final gate：候选 commit、实际 origin/main SHA、完整 diff 责任、已有可复用证据、七页 Mock/Backend 浏览器与正式 L3 选择、实际 URL/后端版本/账号安全来源、环境归属、待执行命令、清理和普通 fast-forward 合入/push。未明确批准前不合 target、不跑正式 L3、不 push。规划批准或复制 prompt 不代替此门。
5. 获批后完整读取 development-workflow 的 `references/final-integration.md` 和 `assets/final-integration-contract.md`；fetch、记录 final_target_base、按批准动作同步 target，重算完整责任；不变证据零重跑，变化仅补缺口。真实后端按本 Plan 测试选择节执行；七页面独立页面入口通过之外，还观察名片保存→发岗、经历保存→屏蔽、实名→申请三个跨页衔接。
6. 原 PR `UI Regression` CI 运行 `npm run ui:check -- --base <实际目标ref>`，沿既有 policy 留视觉报告；该 wrapper 会创建并清理工具临时 detached reference worktree，这是既有测试机制，不能另建实施工作区。若与工作流资源限制冲突或无必要子集支持，明确记录限制并在 final gate 决定，不能静默删除 CI。批准布局变化与非预期漂移分开核对。
7. cleanup 后检查证据是否失效，补最小缺口，再核对 target 未前进；仅普通 fast-forward push，不 force push。竞态按工作流更新具体方案，不无限追赶。记录真实 PASS/失败/BLOCKED 与合入结果，更新本机 task intent；不把未执行的浏览器或 L3 写成通过。

## 文档审查记录

本段只记录当前 Spec/Plan 文档 review，不替代实施 code review。范围固定为本 Plan 与 `docs/superpowers/specs/2026-09-13-company-picker-and-verification-design.md`；批准输入精确版本见 Header。模式 `WORKFLOW_DOCUMENT_REVIEW`，`scope_approved_by_parent_workflow: true`。当前为首轮候选，尚未完成 Claude review；完成后在此原位记录 reviewer、轮次、候选版本、findings、逐条裁决和停止结论，不新建 review report。
