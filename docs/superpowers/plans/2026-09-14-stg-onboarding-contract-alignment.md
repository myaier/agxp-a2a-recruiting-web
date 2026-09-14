# 企业命名、MatchCase 与 STG onboarding 实施计划

> **For agentic workers:** 实际调用宿主对应 skill：Claude Code 使用 superpowers:subagent-driven-development，Codex 使用 superpowers:executing-plans。全部编号任务完成后进入不计数收尾，停在具体 final gate 确认前；不是实施一开始就运行 STG。

**Goal:** 最小修复企业命名与 MatchCase，接入冻结 onboarding API，并固化可独立选择的四条 STG 旅程。

**Architecture:** 复用现有域 facade、HTTP 错误、后端状态、会话 generation 和页面；仅新增 onboarding 数据源与最小状态操作。企业表单增一个常用名字段；MatchCase 删除错误下界；L3 用现有 agent-browser 文档驱动。

**Tech Stack:** React/TypeScript、Vitest/Testing Library、现有 Playwright、agent-browser、外部后端 stg-env CLI。不升级依赖。

**Spec:** `docs/superpowers/specs/2026-09-14-stg-onboarding-contract-alignment-design.md`，revision `7a7eaaab89b40f2a6b8aba84ed3ae55096e62f2e` / blob `6fbf0e9913a23bcf495b13ca01bcfe18e2da1433`。用户批准原设计 dca499e8，7a7eaaab 仅记录批准；用户强调“只做最小实现，不额外增加复杂度”。

后端 API 的批准文档、revision/blob 见 Spec §1、接口见 §4。前端调查基线 `5825ff47a27600cbe5591fb1a9a5fe43e7201272`，target `origin/main`，最终获批后 push `refs/heads/main`。工作区 `.`，不创建第二个用户工作区。后端 checkout 由用户提供，不在交付中固化机器路径。

## Global Constraints

- 仅上述 Spec 范围。后端不在本任务写入范围；设计冻结允许并行编码，不代表实际 STG 已提供接口。
- 不修改 candidate-recommendations 的 recommendations:null、NegotiationJob 三态；不忽略整个响应合同、跳坏行或生成假空页面。
- 不新增状态库、路由框架、测试平台、自动解析编排、通用错误/DTO框架、数据库清理或 GC；新增 helper 仅承载当前重复调用，不推广其他域。
- 企业常用名/品牌/工商事实分开；Mock 不改产品行为。现有 full replacement、revision、权限和历史快照语义保留。
- 新 onboarding 查询不改 `/me`，完成不改 last_used_role；后端完成事实优先于旧首次引导草稿，不删除普通编辑输入。
- 四条变体独立 run/会话，解析失败不能手填后算 parsed PASS；允许后端已证明隔离的 retained，不以零残留为 gate。
- 用户指定完整 npm 验证与适用 E2E 不能只跑新增测试；正式真实 STG L3 待后端就绪且具体 final gate 获批。原有 route-fixture Playwright gate 不冒称真实 STG。
- 不 stash/reset/clean 用户内容。已有 `docs/runs/2026-09-14-backend-onboarding-handoff.md` 与 `docs/runs/2026-09-14-stg-env-retest.md` 不自动提交；它们不是产品通过证据。

## Task index 与模型分配

Task count: 5
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

**计划本身复杂度：高。** 涉及两个独立合同修复及跨页面的完成恢复，但不扩架构。
**零上下文漂移风险：高。** 会话/草稿在飞请求及后端部署能力需精确判断，使用当前可用的行业顶尖模型执行。

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|MatchCase 最小修复；独立|Top 5–10（Claude Code: sonnet）；闭合合同局部修复|Top 5–10（Claude Code: sonnet）；核对边界|Top 5–10（Claude Code: sonnet）；禁止扩大兼容|
|2|企业三种名称接线；独立于1|前沿 / 顶级模型（Claude Code: opus）；full replacement/缓存|前沿 / 顶级模型（Claude Code: opus）；权限与历史投影|Top 5–10（Claude Code: sonnet）；限制重构|
|3|onboarding HTTP域；依赖冻结后端Spec|Top 5–10（Claude Code: sonnet）；两个精确端点|前沿 / 顶级模型（Claude Code: opus）；闭合解码|Top 5–10（Claude Code: sonnet）；复用已有设施|
|4|onboarding状态/提交/路由；依赖3|前沿 / 顶级模型（Claude Code: opus）；恢复与代际|前沿 / 顶级模型（Claude Code: opus）；旧草稿及未知结果|前沿 / 顶级模型（Claude Code: opus）；控制页面耦合|
|5|STG Suite/材料；消费1–4行为|Top 5–10（Claude Code: sonnet）；复用dogfood|前沿 / 顶级模型（Claude Code: opus）；证据和清理边界|Top 5–10（Claude Code: sonnet）；不加运行框架|

按表顺序实施。与后端并行不要求前端内部并行；共享 BFF 类型、状态和样本按提交串行修改。Task3 可依据用户指定的后端冻结设计实现，不以其产品代码尚未落地阻塞；实际不同合同必须返回校准，禁止自行适配未知字段。

## 开工与测试责任

读 AGENTS.md、CLAUDE.md、批准 Spec 和当前任务；按实际安装位置发现 execution skill、TDD skill。执行 development-workflow 的 `scripts/task_intents.py start`，扩大文件范围前 update。只读 fetch main 后记录 SHA；若 origin/main 已前进，先核对改变，按工作区保护与 workflow 规则选择最新基线（规划基线当前正是 main），不要复制已有 hotfix。实施阶段最终 target 合入由 final gate 控制；如最新 main 已改变本任务行为，先校准事实再实施。

测试五问：
- 风险：解码拒合法/放非法、企业错字段/旧缓存、首次完成与回访误路由、未保存草稿丢失或迟到跨账号写；各 Task 有最低反例。
- 最小开发反馈：`npx vitest run <精确文件>`；页面组合风险用已有组件/route-fixture Playwright，不靠新增 fake 后端证明服务端事务。
- 提前真实边界：HTTP facade 用真实序列化与域 decoder；完整路由用 provider/页面测试及已有 Playwright；Cookie/代理/部署/真实解析只由批准后 STG L3 证明。
- 最终权威：用户要求的六条 npm 命令在确认前各跑一轮有效候选；没有 affected wrapper，不伪造命令。后端 provider/PG 测试归后端，不重复建设。
- 成本：本轮未运行测试，无新增计时证据。记录实际耗时/通过数量；不升超时、不为填表重跑 broad gate。修改共享 fixture 后核对全部消费者，限定 typecheck 传播的字面量补键，不借编译错误全局重构。

### Task 1: MatchCase 允许显式空技能数组

目标：仅 WorkspacePublicJob 接受 [] 且保留 requiredSkills:[]。不改连续代谈或推荐接口。

预期编辑文件：
- 修改：`src/数据/招聘数据源/MatchCase.ts`、`src/数据/招聘数据源/MatchCase.test.ts`、`src/数据/HTTP招聘数据源.test.ts`。
- 条件修改（确有旧注释/fixture时）：`src/数据/BFF契约.ts`、`src/测试/BFF样本.ts`、`src/测试/P5Mock边界种子.ts`；只改 MatchCase 样本。
- 新增/删除：无。

消费：现有解工作区职位及两角色工作区list/history/detail。产出接口不变，只修合法输入域。

- [ ] 从最新文件定位 `const 技能 = 要求数组(职位.required_skills).map(要求字符串)`；对照后端 WorkspacePublicJob maxItems64、无minItems及BFF list/detail测试。将旧非法矩阵中的[]移出，先加成功反例并在下述定向命令看到旧下界导致的目标失败；不得把环境/编译错误当作最终红灯证据。
- [ ] 用既有候选/招聘工厂注入 job.job.required_skills=[]，对 open list、history、detail 读取返回 requiredSkills:[]；角色参数化复用现有构造，不新建 fixture 框架。HTTP facade 至少证明空技能沿公开方法进入真实decoder。
- [ ] 保留缺键/null/对象或字符串/非字符串成员拒绝，64项成功、65项失败；原闭合对象、角色隔离、candidate_summary用原测试证明。
- [ ] 最小修改为 `if (技能.length > 64) throw 契约错误()`，更新错误minItems注释；数组/元素guard原样保留，不合成、不跳行。
- [ ] 运行定向测试至通过，检查 diff 仅目标语义，提交本任务文件。

```sh
npx vitest run src/数据/招聘数据源/MatchCase.test.ts src/数据/HTTP招聘数据源.test.ts
```

完成条件：红绿证据明确，全部指定非法边界仍拒绝。若 main 已修，不重复改实现，补缺失证据并记录准确基线。

### Task 2: 企业常用名、品牌名和工商名独立接线

目标：现有后台管理员编辑及所有 full replacement 保留display_name，成功后当前名称一致；不改历史快照和Mock。

预期编辑文件：
- 修改：`src/数据/BFF契约.ts`、`src/数据/招聘数据源/组织.ts`、`src/数据/招聘数据源/组织.test.ts`、`src/数据/组织映射.ts`、`src/数据/组织映射.test.ts`、`src/数据/公司主页资料.ts`、`src/屏幕/公司档案编辑.tsx`、`src/屏幕/公司档案编辑.test.tsx`、`src/屏幕/公司档案分区编辑.tsx`、`src/屏幕/公司档案分区编辑.test.tsx`、`src/状态/后端/组织操作.ts`、`src/状态/后端/组织操作.test.ts`、`src/测试/BFF样本.ts`、`e2e/数据源模式.spec.ts`。
- 条件修改：`src/状态/应用状态.tsx`、`src/状态/应用状态.test.ts`、`src/屏幕/公司主页.tsx`、`src/屏幕/公司主页.test.tsx`、`src/数据/HTTP招聘数据源.test.ts`、`e2e/fixtures/展示字段接线.ts`；限同ID当前名称发布/共享样本补键。先验证路径存在，若消费者位置漂移更新intent记录等价路径。
- 新增/删除：无；不改样式文件。

接口：BFF企业档案、BFF企业档案替换均增加 required display_name:string；资料形增加可选 `企业常用名?: string` 以不改Mock构造，Backend从profile始终赋值。转BFF企业档案替换 用 draft.企业常用名，未提供时保留server.display_name；显式空字符串仍按常用名校验拒绝，不能truthy回退。旧公司全称继续作为品牌draft承载，避免无关重命名。

- [ ] 先加decoder接受新合法闭合profile、缺display_name拒绝的反例；映射以三个不同名称验证不串写。增加full replacement反例：只编辑介绍/福利/媒体仍携带原display_name；记录红灯。
- [ ] Backend基本信息增加“企业常用名”控件；品牌名称保持原槽，工商全称只读。常用名按冻结80字符/trim/控制字符规则校验，后端唯一冲突显示字段错误，输入保留。verified admin以原权限门判断，不因为字段可显示就允许写。
- [ ] 修改组织映射与全部replacement构造，包括媒体操作的内联body和未知结果比较，保留revision/媒体ID及未编辑字段。更新所有组织profile字面量消费者只补真实合同键，不把任何额外字段改成自动忽略。
- [ ] 发布档案收口以响应display_name更新同ID当前身份/公开cache/当前关系显示，或在确需权威关联事实时复用现有读取；不可用 pre-await 身份覆盖最新scope。已有目录读取下次打开返回新名；不在岗位/经历/MatchCase历史快照做全局字符串替换。
- [ ] 页面与状态反例：常用名A改B、品牌仍C、工商仍D；保存后不刷新已显示B，刷新仍B；名称冲突/版本冲突保留输入；成员只读；只改媒体不丢名；切企业/账号时旧响应不改新scope。
- [ ] 定向测试通过后提交。若发现新媒体/企业接口合同实质变化，记录依赖而非扩展本次后端范围。

```sh
npx vitest run src/数据/招聘数据源/组织.test.ts src/数据/组织映射.test.ts src/屏幕/公司档案编辑.test.tsx src/屏幕/公司档案分区编辑.test.tsx src/状态/后端/组织操作.test.ts src/状态/应用状态.test.ts
```

完成条件：三名独立、所有replacement正确、刷新及当前缓存一致，Mock行为无改动；企业日常编辑真实L3不扩大首个Suite。

### Task 3: 新增最小 onboarding HTTP 域

目标：实现冻结的两端点及严格解码，供状态层使用；不在数据源里做路由或重新判断资料完备。

预期编辑文件：
- 新增：`src/数据/招聘数据源/Onboarding.ts`、`src/数据/招聘数据源/Onboarding.test.ts`。
- 修改：`src/数据/BFF契约.ts`、`src/数据/HTTP招聘数据源.ts`、`src/数据/HTTP招聘数据源.test.ts`、`src/测试/BFF样本.ts`。
- 删除：无。不需要改公共HTTP错误框架；确有缺少已冻结错误文案时只增局部映射。

生产接缝（遵循现有请求依赖签名组织工厂，接口名固定）：

```ts
type BFFOnboarding角色状态 = {
  role: BFF角色; status: 'active' | 'suspended'; completed_at: string | null;
};
type BFFOnboarding状态 = { roles: BFFOnboarding角色状态[] };
interface Onboarding数据源 {
  读取Onboarding(): Promise<BFFOnboarding状态>;
  完成Onboarding(role: BFF角色): Promise<BFFOnboarding角色状态>;
}
```

POST decoder额外保证status active、completed_at非null及role与参数相同。HTTP招聘数据源组合该域并再导出类型；字段closed、数组顺序/无重复与RFC3339按批准Spec，不建通用validator库。

- [ ] 写失败测试：GET空roles、两角色不同时间；缺键/额外键/未知role/status、重复/逆序角色、错误时间、缺completed_at拒绝；null仅查询允许。POST严格{}、两角色路径、成功同角色active非null；未知结果错误原样传递。
- [ ] GET `/api/v1/me/onboarding` 使用既有no-store选项；POST `/api/v1/me/onboarding/{role}/complete` 不发If-Match/新增幂等键。无效运行时role在发送前拒绝，保持客户端错误语义。
- [ ] 复用HTTP客户端 envelope/fieldErrors处理。非法成功响应抛invalid_response，401/403/422/503不转空roles；正常/me样本与decoder保持不变。
- [ ] HTTP facade测试确保工厂确实暴露两个方法且路径/body正确，正常请求走真实域decoder；定向红绿通过后提交。

```sh
npx vitest run src/数据/招聘数据源/Onboarding.test.ts src/数据/HTTP招聘数据源.test.ts
```

完成条件：能从已冻结设计编码，无需等待部署；不能写“STG已支持”。后端实际Task1交付时核对OpenAPI与批准版本，不临时改接口。

### Task 4: 接入完成状态、恢复及统一分流

目标：登录/选择身份/切端/候选最后一步/招聘名片使用Task3合同，消除完成后反复引导和未完成误放行；不改整个router。

预期编辑文件：
- 新增：`src/状态/后端/Onboarding操作.ts`、`src/状态/后端/Onboarding操作.test.ts`。
- 修改：`src/状态/后端/类型.ts`、`src/状态/后端/会话操作.ts`、`src/状态/后端/会话操作.test.ts`、`src/状态/后端/候选操作.ts`、`src/状态/后端/候选操作.test.ts`、`src/状态/应用状态.tsx`、`src/状态/应用状态.test.ts`、`src/应用.tsx`、`src/应用.test.tsx`、`src/屏幕/选身份.tsx`、`src/屏幕/选身份.test.tsx`、`src/屏幕/招聘名片.tsx`、`src/屏幕/招聘名片.test.tsx`、`src/屏幕/添加头像.tsx`、`src/屏幕/添加头像.test.tsx`、`src/测试/操作桩.ts`、`e2e/数据源模式.spec.ts`、`e2e/J-PILOT-02接线.spec.ts`。
- 条件修改：`src/流程/候选Onboarding预填边界.tsx`、`src/流程/候选Onboarding预填边界.test.tsx`，限已完成时阻止旧预填/草稿自动重放；先核对现有实际文件名，等价路径调整只记录不扩设计。
- 删除：无。不新增sessionStorage完成标志、逐屏后端进度或route mock服务。

状态接缝：在后端状态中新增required `Onboarding` 判别union（未读取/加载中/成功{数据:BFFOnboarding状态}/失败{错误}），错误承载复用现有BFF错误类型。应用操作增 `刷新Onboarding():Promise<BFFOnboarding状态>` 与 `完成角色Onboarding(role:BFF角色):Promise<BFFOnboarding角色状态>`，放既有创建操作组合。Mock不发网络且沿原页面流程；不要用一个假completed=true更新Backend状态。

水合与草稿优先级：会话恢复/登录首先确定主体，在任何候选草稿恢复写副作用之前得到Onboarding结果；失败保留输入、阻止完成/未完成猜测与自动恢复写。新角色ensure+preference成功后刷新，不用旧空roles。沿会话generation加最小本域请求序号，防止同scope旧GET覆盖较新的complete/刷新，不新建通用请求调度器。查询中的role状态与所选主体角色明显矛盾时刷新相关权威状态或显示重试，不自动ensure停用角色。

- [ ] 先写状态反例：首次空roles；已有角色偏好null选择后completed进主壳/未完成进引导；GET503/404与坏响应不等于未完成；换账号迟到200/401不影响新scope；同scope旧GET不能把已完成覆盖为null。
- [ ] 初始化/登出/切身份/测试桩都补明确运行态。现有会话水合（mount、登录、切端）接入上述顺序，资源读取故障仍显示其原错误，不让Onboarding成功吞组织/简历错误；空角色无需profile存在。
- [ ] 在应用与选身份移除旧“profile存在/简历教育+意向完备”回访判定，使用Spec§5表。提取一个局部共享纯判定即可，保持现有目标角色URL守卫；查询未完成前显示加载/重试，不挂载会自动保存的引导页，也不闪进主壳。显式从本次注册名片跳首岗不被已完成状态抢导航。
- [ ] 候选 完成候选Onboarding 保留原本轮待写入/编辑/确认检查，最后调用完成角色Onboarding。成功后再同步清本轮草稿；POST未知结果时GET查证，confirmed完成才清；仍null留草稿允许重试，GET失败留错误。重载读到已完成时先解除旧草稿拦截/作废旧恢复写，再清引导所属信息；不清普通编辑输入。
- [ ] 招聘名片本次profile和选定头像写成功后、注册流导航前调用完成角色Onboarding('recruiter')。完成失败不得重复创建名片或重新上传已经成功头像；复用已有已保存结果/操作幂等，重试以完成操作为主。普通名片编辑不强制complete或跳发岗。无公司但后端已完成的用户可正常回访，保留当前注册UI公司选择步骤。
- [ ] 422按冻结path给可行动中文提示：姓名/status、完整教育、意向、招聘名片；留当前草稿，引导用户正常导航到相应现有页面，不后台补写。未知503给重试/查证；当前401才清账号。不得把“本轮确认”的前端草稿字段传完成API。
- [ ] 组件覆盖已完成+旧草稿、未完成+有效草稿、无草稿完整资料但完成null（仍引导）、已完成后删最后意向（仍主页）、停用、有角色偏好null、保存失败保留输入、普通名片编辑、首次名片完成后首岗不被截断。
- [ ] 更新两个现有E2E文件的按测试可变Onboarding fixture：GET输出真实样本，POST模拟对应状态变化用于浏览器接线验证；不在通配路由一律返回已完成来躲测试。fixture继承现有role/subject隔离。
- [ ] 定向测试通过后提交，完整Playwright留确认前权威一轮；若定向发现跨页风险需要提前运行受影响具体测试可用现有grep，记录后续复用。

```sh
npx vitest run src/状态/后端/Onboarding操作.test.ts src/状态/后端/会话操作.test.ts src/状态/后端/候选操作.test.ts src/状态/应用状态.test.ts src/应用.test.tsx src/屏幕/选身份.test.tsx src/屏幕/招聘名片.test.tsx src/屏幕/添加头像.test.tsx
```

完成条件：三类入口同一语义、两个完成按钮接线、已完成事实优先但输入不误丢、未知结果不误清；不靠真实STG先跑才发现基础分流。

### Task 5: 固化一个 Suite 两个 Case 四个变体

目标：可独立交给agent-browser执行的用户旅程，复用后端空账号和既有证据目录；当前只固化，不运行L3。

预期编辑文件：
- 新增：`docs/dogfood/stg-onboarding.md`、`docs/dogfood/resources/JD-onboarding.pdf`。
- 修改：`docs/dogfood/真实后端行为验收.md`、`docs/dogfood/真实后端报告模板.md`。
- 条件修改：`docs/dogfood/resources/简历-v1.pdf`不修改原内容；若原合成文件不含足够解析事实则新增`docs/dogfood/resources/简历-onboarding.pdf`，在同一Case文档记内容；优先复用原PDF，不建生成器或增加运行依赖。
- 删除：无。前端不增加后端catalog、npm runner或自动判分机制。

消费Spec§6四条旅程、后端ephemeral-empty初始/旅程后verify与retained合同。稳定选择：Suite `stg-onboarding`，Case `stg-onboarding-candidate`/`stg-onboarding-recruiter`，variant `manual`/`parsed`，支持单个三元组，不强迫跑长复合链。

- [ ] 检查现有简历PDF可读与合成事实；JD PDF提供合成公司/岗位标题、描述、要求、地点及容易观察的关键词，不要求解析所有字段。使用已有可用工具生成一次静态PDF并提取/渲染核对，生成工具不加入产品依赖或测试runner。
- [ ] Case文档写明确入口命令（从后端checkout运行）、安全登录输入方式、每项独立run、必要前置、手填和解析关键节点、持久化与回访断言、可观察失败、finally收尾和受限凭据反证。登录期间不截图/录像凭据；报告不放手机号/OTP/cookie/proof。
- [ ] 所有业务写走UI，只读同角色API可补证。公司使用run唯一名；parsed必须真实任务成功+预填确认后保存，不能等待超时转手填PASS。记录有界等待预算与最终状态，不规定模型逐字输出。
- [ ] initial verify→UI→journey verify；journey不代替页面PASS。按后端批准能力保留唯一终态资源，无实际干扰不要求物理删除；pending/unknown等按实际支持报告，不私自清后端。不将第一轮旧资料误用为第二轮前置。
- [ ] 报告模板增加Suite/Case/variant、frontend/backend源码/部署版本、每个节点、业务/收尾/隔离分别结论、retained依据、未运行原因。至少两个独立run衔接证明隔离；单Case可运行但报告不冒称两轮。复用dogfood-output，不新建报告平台。
- [ ] 原真实后端指南增加新Suite入口，与local B/H、旧STG试点分开；删除/限定会误约束新Suite的零残留/同名复建要求，保留原范围历史。原`全部`不偷偷纳入新STG。
- [ ] 自检所有路径、选择ID、后端新命令均标明部署依赖；候选B02附件限制与JD终态保留状态诚实列出。无需为Markdown或PDF写镜像单测。提交Case文档与材料，不运行agent-browser业务动作。

完成条件：四个独立选择项文档和材料齐全，现阶段均NOT_RUN/待final gate；本地fixture E2E不被写作远端证据。

## 实施后收尾（不计入 Task count）

1. 全部Task及execution skill要求的宿主内global review完成后退出Task循环。Codex调用claude-review-loop，Claude调用对应Codex只读review-loop，绑定批准Spec与固定候选；reviewer默认不跑测试，轮间仅修复相关轻量验证，轮次/停止按skill。覆盖默认finishing菜单，不再增加Task/global review。
2. review裁决后覆盖完整实际diff的L0–L2责任。本仓库无affected runner，按用户明确要求执行下面六条命令并记录完整数量、耗时和失败/跳过原因；同一有效候选不重复broad gate。共享fixture引起失败应最小修复实际消费者，不跳过旧测试。完成git diff --check。
3. 读取development-workflow的references/final-integration.md及assets/final-integration-contract.md。停在final gate确认前，展示候选commit、目标SHA、有效证据、后端Task1实现/API及CLI/部署状态、精确L3选择、前置/占用和允许retained、获批后的合入/push动作。后端未就绪保持等待，不擅自部署或先跑正式L3；用户启动实施prompt不等于批准final gate。
4. 具体方案获批后才同步/整合target，记录final_target_base并按完整diff重算责任；按INCREMENTAL_EVIDENCE复用仍有效测试，只补缺失/失效项。按批准选择执行真实STG L3，缺能力报BLOCKED不降级。STG操作从用户指定后端checkout依其skills，不修改后端。
5. 收尾后对账，记录业务与清理/保留证据；仅补因此失效验证，确认target未推进后按获批动作普通fast-forward push，不force。不在确认后重新启动异构review；target race或语义范围变化更新方案。解析未开放可经用户批准只跑两个manual，但明确四变体尚未全验收。
6. 报告修改文件/根因/后端合同、各命令完整数量、git diff --check、所有FAIL/SKIP/BLOCKED/NOT_RUN原因与无无关重构；维护task intent。实现记录写本Plan，真实运行摘要沿既有docs/runs约定，不新增独立规划review报告。

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
npm run test:e2e:data-source
git diff --check
```

L3 selection：`stg-onboarding` required；candidate/manual、recruiter/manual为核心；candidate/parsed conditional（B02开放、真实解析及支持收尾）；recruiter/parsed conditional（真实JD可用且终态保留支持）。四项均按Spec固化。正式命令入口为agent-browser dogfood文档，无虚构npm命令；最终选择由final gate明确，不在本Plan把conditional记PASS。MatchCase只确定性回归，企业编辑L3、local B/H、真实代谈均none。本次无发布/部署授权。

## 文档 review 与实施记录

本Plan候选待Claude异构文档review；范围仅批准Spec与本文，不审其他分支内容、不跑产品测试。记录将在本节就地追加，不新建review文件。当前无实施、测试计时或STG证据；不得预填通过数。
