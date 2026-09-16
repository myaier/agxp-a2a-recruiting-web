# Dogfood 六项前端修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL：Claude Code 使用 superpowers:subagent-driven-development；Codex 使用 superpowers:executing-plans。按下述 Task index 顺序执行，checkbox 跟踪实施，不在规划会话实现。

**Goal:** 修复 DF-005、DF-002、DF-014、DF-015、DF-004、DF-011，并完成 DF-016、DF-008 的受控浏览器回归。

**Architecture:** 在现有 decoder、表单编辑目标、Backend 缓存水合和详情正文中局部修正。复用已有纯函数、词表、fixture 和组件；不新增接口、全局状态层、校验框架或依赖。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、Testing Library、Playwright；沿用 package-lock.json。

**Spec:** `docs/superpowers/specs/2026-09-16-dogfood-frontend-fixes-design.md`。用户批准行为版本 revision `54d72d4ea2cf9f2a3e2e6383359c068b6a733464` / blob `8c6ce1af4aec5196d7ce17d739d9d17fc514554a`；批准记录版 revision `4e3d42de1a1baa64c623619ecf10a6f1756d0500` / blob `44748c767b67e8ca2aeaf0f93567d0efaea321e5`，仅批准元数据变更，§1–§11 相同。实施使用批准记录版，不能用未来同路径文件替代。

## Global Constraints

- 仓库 `agxp-a2a-recruiting-web`，target `main`，宿主工作区 `.`。源码核查基线 `30a0d3b24c2257da70c8b54fff4ee0ebb5ad71d0`；不新建第二个用户工作区，不 stash/reset/clean。开工核对当前 HEAD、差异、批准文档 Git 对象；相关实现漂移则先对照契约，不照搬行号。
- 读取 `CLAUDE.md`、`AGENTS.md`、`docs/testing/README.md`。本文、Spec 与这些规则是零聊天上下文的完整入口；不得依赖原 Dogfood 私人证据。
- 执行顺序固定：Task 1 → 2 → 3 → 4 → 5 → 6。无需并行化；Claude 的逐 Task 委派仍按顺序进行。Task 3–5 没有产品接口依赖，顺序仅为用户优先级。
- Backend 只认同主体/同 scope 的权威资料；不改变隐私、canonical 目录选择、状态机、动作权限、Case 冻结资料、Mock 行为或既有存储记录。
- DF-011 只放双端独立详情正文的“匹配度分析”内：候选在职位名/薪资之后、JD 之前；招聘在画像之后、个人优势之前。无浮窗、不改列表卡、不改 Case 匹配依据。
- L3 responsibility: none。用户明确本分支不跑 L3；浏览器 fixture 不是实际后端验收。确认后也不启动真实服务、登录、上传或 Agent 操作。
- 非目标：DF-001/003/006/007/009/010/012/013/017/018/019/020、新 highlights 资源、后端证据、媒体故障、姓名头像策略和经历排序。DF-008/016 只有既定回归责任，失败先归因，不自动扩大产品修复。
- 内部 helper 可在下述文件内等价组织；新增公共输入签名与错误语义按 Task 冻结。不得增加无当前消费者的抽象、配置、测试框架或“顺便”拆文件。
- 新测试放已有文件，标题带 `DF-005`、`DF-002` 等稳定标记；新增浏览器叶子同时带 `@dogfood-frontend`。不改全局 fixture 默认、不清空其他任务 evidence、不通过改超时或产品开关掩盖失败。
- 保留既有受影响测试。修改明确钉住旧缺陷的断言需注明原因。测试清单仅在收尾用既有生成器更新，不手抄叶子；runner 原始证据用既有 ignored 输出位置。

## Task index

Task count: 6
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|DF-005 decoder + DF-016/008 浏览器回归；无上游|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|2|DF-002 缺项提示与首错定位；Task 1 后|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|3|DF-014 缓存水合不覆盖权威头像；Task 2 后|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|4|DF-015 可见集合计数；Task 3 后|任意（Claude Code: haiku）|任意（Claude Code: haiku）|任意（Claude Code: haiku）|
|5|DF-004 实际预填来源文案；Task 4 后|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|6|DF-011 双端独立详情原因；Task 5 后|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|

档位理由：Task 1–3/5–6 分别涉及严格 wire 边界、既有编辑生命周期、异步资料归属、预填来源和共享正文兼容，三角色均需独立核对反例；Task 4 只有同集合计数及测试，无需较高档位。角色表不额外要求 Codex 对每 Task 委派，实际 review 次序服从对应执行 skill。

**计划本身复杂度：中。** 六个局部改动跨数据、状态、页面；已有结构足够，主要成本在受控回归。

**零上下文漂移风险：中。** 目录/预填规则、资料水合顺序及推荐 scope 需要按当前实现核对；已冻结签名、输入和反例，无真实服务依赖。

执行模型只按零上下文漂移风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。Claude 条件 alias 与通用档位见角色表；Codex 使用宿主当前模型，不解析 Claude alias。

## 测试选择五问

1. 防什么失败：optional wire 被拒绝、首错隐藏、缓存覆盖权威图、可见集合与数字分叉、虚假预填承诺、推荐原因丢失，以及 Task 1 两个跨页面消费者。
2. 最小开发反馈：每 Task 的 Vitest 文件先加 `-t 'DF-xxx'` 单独跑新反例；修复后跑该 Task 列出的文件选集。浏览器仅跑 `--project=fixture --grep '@dogfood-frontend'` 的相关文件。无代码改变时不重跑产品测试。
3. 提前验证边界：Task 1 在 decoder 修复后立即跑两端浏览器回归；Task 2 验证真实 DOM 聚焦/滚动与目录保存；Task 3 用受控 promise 顺序和页面图片请求验证；Task 6 验证真实详情入口、scope 切换及区块位置。都由本地 HTTP fixture 覆盖，禁止依赖真实账号。遇到只能由实际服务确认的未知项，记录限制，不违背 none 约定启动 L3。
4. 权威验收：实施 Task 和宿主内 review 后先 Claude/Codex 异构代码 review，再执行最小 affected 静态与 L0–L2、清单校验，然后人工 final gate；确认后只补输入已变化的证据，不重复 broad gate。此项目无额外 affected wrapper，使用本文原生 npm 命令组合。
5. 已有证据与成本：源码基线相关 8 文件/366 Vitest 用例通过，4.79 秒；DF-005 合成缺头像键→invalid_response、补 null→PASS。新选集成本未知，不预跑估时。旧全量 J-PILOT-02 基线失败见 testing README，不属于本范围；范围内新失败必须修复，不用基线失败标签掩盖。

## Task 通用操作纪律

每 Task 先读 Global Constraints、该 Task 全文及对应 Spec 节；测试红因须是指定故障而非缺 fixture/导入错误。实现后按所列命令确认、检查 diff 只覆盖预期文件，提交一个可审查的逻辑变化。下述“预期编辑文件”包括允许的新测试位置；无需变更的文件保持原样。新增文件和删除文件均为无，除收尾更新现有清单。扩大范围先更新本机 task intent 并说明理由，产品边界变化须修订批准设计。

### Task 1: DF-005 可选头像归一化与 DF-016/DF-008 页面回归

目标：解除缺席头像键造成的整页失败，并在同一修复上验证已存在的画像接线和终态轮询。非目标：改通用闭合 guard、修阶段文案、改变隐私或轮询周期。

预期编辑文件：
- 新增：无。删除：无。
- 修改：`src/数据/招聘数据源/展示资料.ts`（唯一产品修复点）。
- 修改测试：`src/数据/招聘数据源/展示资料.test.ts`、`src/数据/招聘数据源/MatchCase.test.ts`、`src/数据/招聘数据源/连续代谈.test.ts`、`e2e/suites/MatchCase.spec.ts`、`e2e/suites/连续委托.spec.ts`。
- 只读依赖：`src/测试/展示资料样本.ts`、`src/测试/BFF样本.ts`、`src/屏幕/详情控制/use后端详情控制.ts`、`src/数据/详情展示映射.ts`、`src/状态/后端/MatchCase操作.ts`、`e2e/fixtures/bff/MatchCase.ts`、`e2e/fixtures/数据源交互.ts`。若样本导出迁移，按测试当前 import 找现有来源，不新造 fixture 系统。

输入/输出：`解职位资料(input: unknown)` 及 `解P5详情`、连续详情 decoder 签名不变；内部 `BFF公开发布人档案.avatar_url` 仍为 string | null。只对 record 且头像键缺席的输入补 null；显式 undefined 不视作缺席。JSON 来自现有 HTTP decoder，不扩大支持非 JSON 对象。

- [ ] 在现有完整安全职位样本复制 publisher_profile、删除头像键后，断言解码结果头像为 null；增加显式 undefined、数字、对象、未知键、其他必需键缺席仍拒绝的表驱动反例。不得改变共享样本默认值。
- [ ] 用既有合法候选/招聘 Case fixture 和候选 negotiation 嵌套 Case，各只删该键，断言完整解码成功、Case ID/终态保持。运行下面 Vitest 命令加 `-t 'DF-005'`，记录原实现失败。
- [ ] 在 `解发布人档案` 内部局部归一化，继续调用原闭合 guard 和各字段解码函数；不改 `BFF契约.ts` 的内部类型、不改共享 guard。
- [ ] 在现有浏览器 fixture suite 增加 `DF-005 DF-016 @dogfood-frontend` 场景：候选、招聘分别从正常列表导航打开缺键详情；招聘顶栏与在线简历显示相同合成摘要，随后摘要变 null 并经既有刷新清旧值；身份数据不触发姓名/头像渲染。只在该测试的响应覆盖中删除键，不改整个 fixture 默认。
- [ ] 增加 `DF-008 @dogfood-frontend` 双角色场景：当前页可见且 open 卡出现后，改变对应 fixture 权威 active/open 集合和 history 集合；等待下一次真实生产节拍请求及页面移除断言，再导航历史确认 ended 记录可见且无处理中。两种历史状态分别覆盖首次进入、预先访问历史后返回当前再发生终态；不清缓存、不手动刷新代替轮询。历史页无定时请求。通过网络响应/DOM 条件等待，不用固定 sleep。
- [ ] 执行定向命令，确认预期；提交 `fix: accept omitted publisher avatar in case details`。

```bash
npm test -- src/数据/招聘数据源/展示资料.test.ts src/数据/招聘数据源/MatchCase.test.ts src/数据/招聘数据源/连续代谈.test.ts --maxWorkers=4 --retry=0
npm run test:e2e -- e2e/suites/MatchCase.spec.ts e2e/suites/连续委托.spec.ts --project=fixture --grep '@dogfood-frontend' --workers=1 --retries=0
```

完成：缺键全链路通过；坏值仍拒绝；两端页面无需 shim；画像同源和跨轮询终态回看均通过。停止条件：DF-008/016 回归确实暴露额外产品缺陷时给精确证据，不改状态机、不自动清缓存通过测试；先判断是否超出本 Spec 的回归范围并报告。

### Task 2: DF-002 卡片缺项提示与保存首错定位

目标：缺必填项的预填工作经历在折叠时可发现，保存时自动进入现有编辑页并聚焦首错。非目标：改变必填规则、为教育/证书重做 UX、引入通用表单框架。

预期编辑文件：
- 新增：无。删除：无。
- 修改：`src/流程/候选Onboarding简历预填.ts`、`src/屏幕/工作经历.tsx`、`src/屏幕/工作经历.module.css`。
- 修改测试：`src/流程/候选Onboarding简历预填.test.ts`、`src/屏幕/工作经历.资料与预填.test.tsx`、`e2e/suites/候选建档.spec.ts`。

依赖：Task 1 已提交；无消费其新接口。读原 `经历未完成`、`数未完成项`、`取工作页预填` 与编辑目标/恢复草稿实现，保留预填编号适用范围。

新增同域接口冻结：`export function 取经历缺项(段: 简历经历段): Array<'公司' | '行业' | '职位' | '入职时间'>`。按原判定比较值，不把空串改成 trim 后空导致扩大校验；公司名称空或组织编号 undefined 合为公司一项、行业引用 undefined 算行业。返回顺序公司→行业→职位→入职时间。原 `经历未完成` 复用返回长度；计数仍是未完成条数而非字段数；页面仅对原预填拦截适用的条目使用自动定位。

- [ ] 添加 `DF-002` 纯函数反例：公司名在但 ID 缺、行业原文在但引用缺、多缺项顺序、完整项空数组；`数未完成项` 仍只算 prefill 条目、教育证书计数不变。
- [ ] 添加组件失败用例：两张折叠卡显示具体缺项；已有公司原文但缺组织 ID 时显示“请从目录选择公司”；点保存打开第一条且第一字段控件获焦；修正或删除后重算；只有教育/证书缺项时不打开完整经历；已有草稿内容保留。运行下列 Vitest 选集加 `-t 'DF-002'` 确认红因。
- [ ] 提取上述局部 helper；列表卡按缺项数组显示“待补充：公司、行业”等已有样式可容纳的行。已有公司原文但缺组织 ID 时，卡片及字段提示明确“请从目录选择公司”（helper 仍返回单个公司项，页面从当前段判断文字）；不得用公司为空推断权限或造企业值。
- [ ] 保存遇到预填经历错误时通过现有 `设编辑目标` 打开首条，传入可空首错字段作为编辑页本地展示输入。挂载后用 ref 滚动并 focus 对应输入或选择按钮；不要自动弹出目录选择器、不要 setTimeout 猜挂载时机。
- [ ] 错误字段附近说明保持可见；补齐后重新按当前草稿判断，删除/返回保持原有草稿和持久化流程。用户自建条目仍由原必填守卫处理，不扩大 canonical 强制条件。
- [ ] 在候选建档 suite 增加 `DF-002 @dogfood-frontend`：合成 PDF 预填两条缺公司/行业的工作经历，点顶部保存观察首错可见与 focus，通过现有目录交互补齐并完成建档相关保存。断言无效总保存未发、最终保存 ID 正确；不上传真实简历。复用现有安装与覆盖能力，不建新解析器。
- [ ] 跑命令确认并提交 `fix: expose incomplete imported work experience`。

```bash
npm test -- src/流程/候选Onboarding简历预填.test.ts src/屏幕/工作经历.资料与预填.test.tsx --maxWorkers=4 --retry=0
npm run test:e2e -- e2e/suites/候选建档.spec.ts --project=fixture --grep '@dogfood-frontend' --workers=1 --retries=0
```

完成：三段等任意现有列表按序定位、修正后可继续，提示与拦截只有一份经历规则。停止条件：需要更改目录写入合同或恢复系统才能实现时，记录具体阻塞；不通过放开 ID 要求绕过。

### Task 3: DF-014 Backend 缓存不覆盖账户头像

目标：无论缓存和 account-profile 哪个先完成，最终头像服从服务端；Mock 行为保持。非目标：头像上传重构、缓存版本升级、图片失败降级、全缓存清空。

预期编辑文件：
- 新增：无。删除：无。
- 修改：`src/数据/资料缓存.ts`、`src/状态/资料持久化.ts`、`src/状态/应用状态.tsx`。
- 修改测试：`src/数据/资料缓存.test.ts`、`src/状态/应用状态.归约.test.ts`、`src/状态/应用状态.资料与建档.test.ts`、`e2e/suites/账号与支持.spec.ts`。
- 只读消费者：`src/状态/后端/会话操作.ts`、`src/屏幕/我的.tsx`、`src/状态/初始状态.ts`；不改账户头像 revision 计算。

依赖：Task 2 后，无接口依赖。保留 `资料缓存快照` 和 action 形状；无需新 mode 参数：现有 Backend 专用 `水合账号资料` 路径可在合并前排除头像。基线已核对该 action 唯一生产调用在 `资料持久化.ts` 的缓存 effect；服务端 account-profile 水合和上传走独立 `存求职头像` action。实施先复核它仍只承担缓存水合，而非所有 Backend 水合；若新基线让权威服务端也使用它，则只在缓存调用边界剔除头像，不拦截权威路径。Mock 自身缓存路径不排除。

- [ ] 在缓存测试加 `DF-014`：Backend 的旧 null、URL、data URL 读后不含头像键，Mock 仍保留；写后 Backend JSON 不含头像键、其他允许字段保持。
- [ ] 在 reducer 测试从已存权威头像的 state 派发含旧 null 的 `水合账号资料`，断言头像不变；其他缓存允许项照常水合。
- [ ] 在 Provider 测试复用 `deferred`、`创建后端桩` 控制 account-profile 回应：缓存先/服务端先两种完成顺序；服务端明确 null 清图；切账号不沿用旧图；账户请求失败不恢复旧缓存头像。此处验证 effect/action 真实接线，不只测试自制 reducer。运行 Vitest 选集加 `-t 'DF-014'` 确认红因。
- [ ] Backend 读缓存忽略求职头像、Backend 写快照移除求职头像；`水合账号资料` 解构时排除求职头像，阻止默认 `空账号资料` null 覆盖。保留退出/切账号 `清账号资料` 清空行为，不把“忽略缓存”做成“永不清头像”。
- [ ] 在账号与支持 suite 增加 `DF-014 @dogfood-frontend`：旧缓存头像 null、fixture account-profile 为非空 URL/revision，打开候选“我”，验证图片请求 URL 带权威 revision、img src 正确；完整 reload 后保持。媒体响应用合成可解码图片，精确声明路径，不访问外部 URL。
- [ ] 跑命令和额外只读消费者已有测试确认，提交 `fix: keep backend account avatar service-owned`。

```bash
npm test -- src/数据/资料缓存.test.ts src/状态/应用状态.归约.test.ts src/状态/应用状态.资料与建档.test.ts src/状态/应用状态.会话.test.ts src/屏幕/我的.test.tsx --maxWorkers=4 --retry=0
npm run test:e2e -- e2e/suites/账号与支持.spec.ts --project=fixture --grep '@dogfood-frontend' --workers=1 --retries=0
```

完成：两种顺序都不覆盖、旧缓存无兼容漏洞、合法 null 与切主体可清空、Mock 不回归。停止条件：需要新增持久化格式或服务端 API 时不扩展。

### Task 4: DF-015 推荐横幅使用可见集合

目标：招聘推荐横幅计数与实际可见候选卡一致。非目标：统计批次总数、修改过滤、委托或空态机制。

预期编辑文件：
- 新增：无。删除：无。
- 修改：`src/屏幕/候选推荐.tsx`、`src/屏幕/候选推荐.test.tsx`。

依赖：Task 3 后，无接口依赖。消费者横幅 `强调` 从 `后端卡们.length` 改为 `待选卡们.length`；源集合和已有 `delegation_id` 过滤保持。

- [ ] 在现有组件 fixture 增加 `DF-015`：两推荐一条已委托→横幅 1 且卡 1；全部已委托→0/空态；无推荐→0；后续快照新增 delegation→计数随集合减少。
- [ ] 跑 `npm test -- src/屏幕/候选推荐.test.tsx -t 'DF-015' --maxWorkers=4 --retry=0`，确认混合样本旧值为 2 失败。
- [ ] 仅改横幅读取集合，不提取新 helper，不增加状态，不改 Mock 分支。
- [ ] 跑 `npm test -- src/屏幕/候选推荐.test.tsx --maxWorkers=4 --retry=0`；预期全通过，提交 `fix: count visible recruiter recommendations`。

完成：数字始终与现有过滤后集合一致；无需额外浏览器专用用例，现有页面组件测试直接覆盖该单值接线。

### Task 5: DF-004 个人优势文案服从实际预填来源

目标：只有实际应用了有效建议才声称已提取。非目标：接 personal-highlights、重新解析简历、自动覆盖用户输入或改变保存顺序。

预期编辑文件：
- 新增：无。删除：无。
- 修改：`src/屏幕/引导问答.tsx`、`src/屏幕/引导问答.test.tsx`。
- 只读依赖：`src/流程/候选Onboarding简历预填.ts` 的 `取个人优势预填`、`取可恢复个人优势建议` 与既有恢复按钮回调。

依赖：Task 4 后，无接口依赖。仅保存页面局部“初值是否来自有效建议”来源，不加全局 store 或持久化字段。保持现有 summary 初值函数签名及写入行为。

- [ ] 增加 `DF-004` 组件用例：无上传/无建议、空白/不可用建议、有效建议实际初始化、已有个人优势优先、独立编辑、用户清空、用户文本初始化后恢复有效建议仍为中性说明。后到建议不能覆盖用户已有文本或让说明误称已应用。
- [ ] 跑 `npm test -- src/屏幕/引导问答.test.tsx -t 'DF-004' --maxWorkers=4 --retry=0` 确认旧无条件说明失败。
- [ ] 初始化时记录现有 `取个人优势预填` 是否真正采用了当前有效建议；不靠文本相等推断来源（已有用户文本恰与建议相同仍属用户文本）。建议是否可用、已有文本是否为空沿用既有函数判断。
- [ ] 非独立编辑且实际采用过有效建议且当前文本 trim 非空时显示原提取说明；其他注册流显示“可以介绍你的经验、技能和擅长的事情。”。独立编辑仍不传说明。来源标记只在初始化计算；恢复按钮沿用原动作，不更新该标记。以用户文本初始化后再恢复仍显示中性说明。清空当前文本立即回中性文案，不新增自动恢复行为。
- [ ] Mock 同样依据实际初始化来源，不因为存在 Mock 种子建议就声称已应用；恢复动作不改变初始化来源。保存个人优势、确认 summary、保存首次意向的原顺序不变。
- [ ] 跑 `npm test -- src/屏幕/引导问答.test.tsx src/流程/候选Onboarding简历预填.test.ts --maxWorkers=4 --retry=0`，确认保存与恢复既有测试通过，提交 `fix: describe only applied resume highlights`。

完成：说明准确、未触碰保存资源；不为两条文案新增状态机或通用 provenance 模型。

### Task 6: DF-011 双端独立详情内联展示推荐依据

目标：在双端独立详情原匹配区展示已有安全原因，保留分数和合法核对行。非目标：列表卡变化、浮窗、新推荐 store、新请求、Case 推荐补读、虚构证据。

预期编辑文件：
- 新增：无。删除：无。
- 修改：`src/数据/发现推荐映射.ts`、`src/屏幕/职位详情展示/类型.ts`、`src/屏幕/职位详情展示/准备职位正文.ts`、`src/屏幕/职位详情展示/职位正文展示.tsx`、`src/组件/在谈详情/类型.ts`、`src/组件/在谈详情/在线简历正文.tsx`、`src/屏幕/匿名在线简历.tsx`。
- 修改测试：`src/数据/发现推荐映射.test.ts`、`src/屏幕/职位详情展示/准备职位正文.test.ts`、`src/屏幕/职位详情展示/职位正文展示.test.tsx`、`src/组件/在谈详情/在线简历正文.test.tsx`、`src/屏幕/匿名在线简历.test.tsx`、`src/屏幕/职位详情.test.tsx`、`e2e/suites/发现推荐.spec.ts`。

依赖：Task 5 后；上述文件均为既有消费者，禁止为两个不同正文重建共用详情框架。保留 P4 原推荐 ID/scope 选择逻辑。

局部公共输入：

```ts
// src/数据/发现推荐映射.ts，复用已有亮点文案四码表
export function 映射推荐依据(码们: readonly string[]): string[];
// src/屏幕/职位详情展示/类型.ts 的 职位正文数据
推荐依据?: readonly string[];
// src/组件/在谈详情/类型.ts 的 在线简历正文属性
推荐依据?: readonly string[];
```

语义：undefined 表示消费者不启用本项（Mock、Case 保持原展示）；[] 表示该独立详情已启用但无已知原因，显示“暂无推荐依据”；非空按映射后的中文逐条或紧凑文本展示。组件不解 wire、不请求、不读 Context。`映射推荐依据` 只认自有键四码、未知丢弃、去重保持首次出现顺序。

生产者/消费者：候选 `准备Backend职位正文` 对当前 `视图.卡.对得上` 原原因数组应用映射；直取无推荐时给 [] 并保留原 null 分数。招聘 `从P4招聘候选` 的既有 `亮点` 字段及其保留重复项的测试完全不改；只在匿名简历 Backend 正常详情入口对当前同 scope `卡.highlights` 调用 `映射推荐依据` 后传可选 prop。已有列表消费者输出不变，不改候选卡主体去消费这些原因，也不把它们写入 personal_highlights。招聘正常详情的 `亮点` 在现类型是必有 string[]，不是 undefined；原始 highlights 空或全未知时传 []。没有合法推荐坐标或详情卡时继续现有不可用/加载/错误分支，不为了显示空原因创建一个新的“无推荐简历”页面。只有 Mock/Case 不传 prop（undefined）。

- [ ] 添加 `DF-011` mapper 用例：新 helper 四码中文、重复稳定去重、未知/原型键不展示；现有 `从P4招聘候选` 的亮点重复项保持原状；分数 0 保留；推荐缺席与当前 scope 切换不从其他卡取值。
- [ ] 添加两正文组件用例：候选有核对行时保留原内容并同区展示原因；basis 已确认但行空时保留一个匹配标题、一个分数环或缺分位；basis 未确认的“经验与学历尚未核对”仍在。招聘只有顶栏分数、正文无额外环；原因与“暂无逐条匹配证据”区分。undefined prop 的 Mock/Case 旧行为完全保持。
- [ ] 跑下列 Vitest 文件选集加 `-t 'DF-011'`，确认未消费原因的旧实现失败。
- [ ] 实现 mapper 及可选字段接线。候选“核对且行空”的 fallback 放职位正文展示/准备层，不修改全站 `匹配分析块` 的空行行为；用原有说明分支承载可读缺失状态，不重复标题。
- [ ] 招聘匹配段在当前 `在线简历正文` 原位置处理可选原因；传了 prop 才使用“推荐依据”和“暂无逐条匹配证据”，不把 Case 全局“匹配分析缺失”文案一并更换。个人优势区及以下结构保持。
- [ ] 用现有页面测试补换意向/岗位/候选与响应变空，确认原因立即清旧；若需要测试数据只在本例创建，不修改共享默认。
- [ ] 在发现推荐 suite 增加 `DF-011 @dogfood-frontend` 双端场景：从推荐列表进入独立详情，断言匹配区位于标题/画像之后、JD/个人优势之前；显示已有中文原因、无原始码、无第二分数环；导航另一记录不残留。直接详情无推荐仍给真实缺失状态；网络中不增加推荐或 Case 补读请求。
- [ ] 跑命令并提交 `fix: show recommendation reasons in detail sections`。

```bash
npm test -- src/数据/发现推荐映射.test.ts src/屏幕/职位详情展示/准备职位正文.test.ts src/屏幕/职位详情展示/职位正文展示.test.tsx src/组件/在谈详情/在线简历正文.test.tsx src/屏幕/匿名在线简历.test.tsx src/屏幕/职位详情.test.tsx --maxWorkers=4 --retry=0
npm run test:e2e -- e2e/suites/发现推荐.spec.ts --project=fixture --grep '@dogfood-frontend' --workers=1 --retries=0
```

完成：双端独立正文有实际已有原因、无伪证据；无原因和无分真实降级；Mock/Case 不回归。停止条件：当前合同不存在所需原因时不得外查或编造，以批准的缺失状态完成；若当前类型与声明有实质不同先核对批准基线，不能扩 schema。

## 实施后收尾（不计入 Task count）

同一实施 session 持续完成以下顺序，不重新分配收尾 Task，不调用默认 finishing 菜单。

1. 完成所有 Task 与执行 skill 要求的宿主内全局 review，随后退出 Task/global review 循环。实际调用异构 review-loop：Codex 宿主用 claude-review-loop，Claude 宿主用对应 Codex review-loop。绑定批准 Spec 精确版本、固定 base/head 和最小修复范围；reviewer 默认不跑测试。按 skill 轮次裁决，轮间仅修复相关轻量验证；不额外在每个 Task 或 final gate 之后再次调用异构 review。
2. review 收口后重算实际 diff 与消费者的最小 affected。Task 已有效通过的证据可复用，不为汇总重复全部文件；变化使某文件依赖/fixture失效时只补相应子集。必须覆盖的最终责任：Task 1–6 列出的测试、共享正文旧 Case/Mock 消费者、全项目静态检查及测试清单。共享正文兼容补选 `src/屏幕/详情控制/后端正常详情.test.tsx`、`src/屏幕/详情控制/use后端详情控制.test.tsx`、`src/数据/在线简历正文映射.test.ts`，先按实际 diff 确认可复用与否。
3. 下列静态/清单入口执行一次；新增叶子经生成器维护。浏览器责任合并一次执行可避免多个 Vite 冷启动；若各 Task 的相同候选已满足所有子集，可直接引用原始回执而不再运行合并命令。既有消费者的固定补选见下一组命令，不能只跑新用例冒充全部消费者验证；实际 diff 扩大时再按风险补精确子集。

```bash
npm run lint
npm run typecheck
git diff --check
npm run test:list -- --write
npm run test:list -- --check
npm run test:e2e -- e2e/suites/MatchCase.spec.ts e2e/suites/连续委托.spec.ts e2e/suites/候选建档.spec.ts e2e/suites/账号与支持.spec.ts e2e/suites/发现推荐.spec.ts --project=fixture --grep '@dogfood-frontend' --workers=1 --retries=0
```

既有消费者补选（已在 Task 中执行且输入有效则复用）：

```bash
npm test -- src/屏幕/详情控制/后端正常详情.test.tsx src/屏幕/详情控制/use后端详情控制.test.tsx src/数据/在线简历正文映射.test.ts --maxWorkers=4 --retry=0
npm run test:e2e -- e2e/suites/MatchCase.spec.ts --project=fixture --grep '详情直达刷新|披露前与解析中|已披露招聘端|单一历史集合' --workers=1 --retries=0
npm run test:e2e -- e2e/suites/候选建档.spec.ts --project=fixture --grep '候选 onboarding 完整保存' --workers=1 --retries=0
npm run test:e2e -- e2e/suites/账号与支持.spec.ts --project=fixture --grep '401 清账号|切换身份后迟到' --workers=1 --retries=0
npm run test:e2e -- e2e/suites/发现推荐.spec.ts --project=fixture --grep 'P4 候选列表与详情|P4 详情直取|招聘端列表与详情渲染|独立匿名简历 Backend|切意向后旧 scope' --workers=1 --retries=0
npm run test:e2e -- e2e/suites/发现推荐.spec.ts --project=mock --grep '独立匿名简历 Mock 默认行为保持' --workers=1 --retries=0
```

这些用例分别承担 decoder 双角色/PDF 隐私、建档保存、头像主体清理、推荐详情与隔离、共享正文 Mock 兼容。新 DF-011 文案使旧“匹配分析缺失”断言失效时，只更新独立详情的期望为批准文案；保留 Case 原断言。

清单唯一预期修改：`docs/testing/cases.md`；不增加 Suite/框架。若 required 受影响检查失败，修复并只重跑失效责任。保留 raw receipt 的候选 SHA、命令、运行环境、fixture、选择与结果；不新建缓存系统或单独交付报告文件。

4. 全部适用 L0–L2 在人工 final gate 前完成并提交；呈现具体修改、review 裁决、已通过/未覆盖责任、target 与合入方式，请用户明确确认。确认前仅可 fetch 读引用，不合 target、不 push。本分支 L3 none 贯穿确认前后，不把未执行写为 PASS。
5. 确认后完整读取 development-workflow 的 `references/final-integration.md` 与 `assets/final-integration-contract.md`；同步 target、记录 final_target_base、重算完整责任。基准及输入未变零重跑复用；变动只补失效/新增责任，完成 cleanup 后再对账，核对 target 未推进后普通 fast-forward push，禁止 force push。若 target 推进按合同重新同步/核算，不重开 review-loop 或整套 Task review。
6. 使用 development-workflow 的 `scripts/task_intents.py` 在开工 start、范围变化 update、收尾刷新/完成，资源按实际 skill 根解析；不要删除别人的 intent。不自动销毁用户工作区。

## 文档审查与执行交付记录

本 Plan 是批准 Spec 的实现分解，不新增产品能力。Claude 文档 review 的固定范围仅本 Plan 与对应 Spec，模式 WORKFLOW_DOCUMENT_REVIEW，scope_approved_by_parent_workflow=true；用户已明确授权。review 按共用 `../_shared/review-contract.md`，只读且不运行测试。

第一轮 Claude Opus/high 文档 review 已完成，候选 revision `2a394e8f7be8b6cf03db79e4bf7f70891a338ded`、Plan blob `eb9dfca7b0b078d8bfafd1738901e9ff92ad10ac`；Spec 始终使用批准记录版。审查只读 guard 通过，reviewer 未运行测试。

|Finding|裁决与证据|处理|
|---|---|---|
|R1-1 Important：招聘亮点 producer 改动可能改变列表|当前列表的亮点来自 candidate_summary.personal_highlights，该假定的直接故障未证实；但旧 mapper 明确保留重复项，为详情去重改变全局 producer 没必要|接受简化：保持原 `从P4招聘候选` 输出与既有测试不变，详情入口用原始 highlights 做局部映射；同时更正 Plan 原错误函数名|
|R1-2 Important：缺 canonical ID 的提示不明确|符合 Spec §5，原 Plan 只写待补充公司不足以定位原因|接受：冻结“请从目录选择公司”提示及断言，helper 不加类型分支|
|R1-3 Minor：水合 action 可能承担服务端写入|源码不支持该故障：水合账号资料仅缓存 effect 调用，权威路径用存求职头像|不采纳新增机制，补明确调用证据和基线漂移时检查缓存/权威边界的条件|
|R1-4 Minor：招聘无上下文可能传 undefined|当前正常视图亮点为必有 string[]；无卡走加载/不可用，不存在该假设的正常页|不新增无上下文页面；明确有效详情的空/未知原因传 []、无卡保留原错误/加载、undefined 仅 Mock/Case|
|R1-5 Minor：恢复建议更新初值来源超出 Spec|Spec §8 仅允许实际初值来源；恢复时新增状态更新无必要|接受并删去：来源只初始化，恢复按钮不改来源标记；保留恢复行为测试|

上述修订不改变批准 Spec。第二轮恢复同一 Claude Opus/high reviewer session，审查 revision `2996c9c37f634958b4989dd9f4bf7f1aaa041202`、Plan blob `0203cb666126656a000c2832a341270d7c1c6713`，返回精确 `NO FINDINGS`；只读 guard 通过，未运行测试，无未解决 required。文档 review 共 2 轮，第一轮 2 Important / 3 Minor，三项接受修订、两项核实前提后澄清边界；第二轮无新问题。本次追加审查结束记录，不改变已审查的 Task 或行为契约。执行交付仅一个 `docs/superpowers/prompts/2026-09-16-dogfood-frontend-fixes.md`，含 Claude Code/Codex 两节，各自完整 text 代码框；绑定最终文档 revision/blob，用 development-workflow 的 `scripts/validate_prompt_grading.py --plan ... --prompt ...` 校验。规划 session 不执行上述产品 Task。
