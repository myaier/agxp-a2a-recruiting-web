# 登录区号可编辑与 STG 基础试点 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: 实际调用 `superpowers:executing-plans`，按本 Plan 逐 Task 实施；本任务两种宿主均为 3 个 Task，不调用 subagent-driven-development。步骤以 checkbox 跟踪。

**Goal:** 正式支持默认 `+86` 的可编辑区号登录，证明既有前端 E2E 兼容，并通过两轮真实 STG 一次性账号基础试点。

**Architecture:** 复用登录页区号按钮及弹层框架，登录请求增加可选区号参数并保留旧默认值；输入校验由登录 UI 和请求构造共用一个小型纯函数模块。真实 STG 数据生命周期全部复用后端已有 skill/CLI，浏览器步骤与证据沿用现有 dogfood 文档，不新增 runner 或后端机制。

**Tech Stack:** React、TypeScript、Vite、Vitest、Testing Library、Playwright、agent-browser；后端环境工具为现有 Bash/Python CLI。

**Spec:** `docs/superpowers/specs/2026-09-12-editable-login-dial-code-stg-pilot-design.md`；用户批准 revision `ed25e232`，blob `18300b23ee1faddd80da6c3faacc3f6f18c2a106`。随后批准状态提交 `13bd8e8f` 仅修改元信息；行为以批准快照为准。

## Global Constraints

- 仓库 `agxp-a2a-recruiting-web`，工作区 `.`；规划源码基线 `3ad5d4bf3efff659ebd01188e956000ae5655f9d`，规划时 `origin/main` 指向同一 SHA。拟合入 `origin/main`，实际目标及 push 在实施 final gate 方案中明确确认，不提前合入或 push。
- 先完整读 `AGENTS.md`、`CLAUDE.md`；沿用用户工作区，不创建第二用户工作区，不 stash/reset/clean 用户内容。通过 development-workflow 根相对 `scripts/task_intents.py` 登记及更新本机改动预告。
- 中文文案及文档；默认 `+86`，四位 OTP，原手机号 label/placeholder、协议、Mock 零网络和 Backend 角色水合落点保持。区号不持久化。
- 不改后端、P8 换绑、Cookie/CORS、安全门槛或现有路由；不新增依赖、国家目录、配置服务、测试 DSL、浏览器 runner、CI 编排。普通短信供应商可用性不是本次承诺。
- 工具的受限登录材料、OTP、Cookie、proof 不输出到聊天/日志/报告。业务写入经 UI，准备/清理由既有环境 CLI 完成；不以路由 mock 或 Cookie 注入证明 STG PASS。
- 明确只执行基础试点，原 B01–B05/H01–H04 表及 local 路径保持；受限场景不执行。两轮各自 CLEANED 且无残留是试点完成条件。
- 外部 skill 按逻辑名发现，资源路径从其真实根解析；review 共用规则为 review skill 根相对 `../_shared/review-contract.md`。缺必需输入则报告，不写入规划机器路径。
- 新增小模块只有两个现有消费者（登录页、认证请求）；无关大文件不拆分。状态扩展仅用于手机号登录尝试，避免复制整套全局认证状态机。

## Task index 与执行分级

Task count: 3
Claude Code execution: superpowers:executing-plans
Codex execution: superpowers:executing-plans

按 1 → 2 → 3 串行执行。实施 review、适用验证、final gate 不计 Task。

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|登录 UI、兼容请求、尝试失效及单测；无 Task 依赖|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|2|既有与新增浏览器回归；依赖 Task 1 的区号/校验/状态行为|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|3|STG 双轮流程及模板；依赖 Task 1 UI 与 Task 2 验证清单|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|

角色档位表达审核所需判断能力，不要求 executing-plans 无条件派出三名子 Agent；按执行 skill 自身要求执行。

**计划本身复杂度：中。** 产品改动集中，但登录尝试生命周期和三类浏览器证据要对齐。

**零上下文漂移风险：中。** 精确合同已冻结；STG 版本、现场权限、清理与 browser skill 版本需执行者判断。执行模型使用当前可用的行业 Top 5–10 中高性价比模型。三任务角色相同档位，因为都涉及不能以假成功绕过的合同边界；不以改文档为由降至无判断的机械执行。

## 1. 冻结接口与状态行为

新增 `src/数据/登录手机号.ts`，只服务当前登录；不接入 P8 换绑。

```ts
export function 规范化登录区号(raw: string): string;
export function 构造登录手机号(phone: string, dialCode?: string): string;
// 会话数据源和会话操作同名方法均增加可选第二参数：
开始手机登录(phone: string, dialCode?: string): Promise<BFF登录尝试>; // 数据源
开始手机登录(phone: string, dialCode?: string): Promise<void>; // 状态操作
取消手机登录尝试(): void; // 状态操作，局部失效，不发送网络请求
```

区号 trim 后允许一个可选 `+`，剩余匹配 `[1-9][0-9]{0,2}`；返回规范的 `+数字`。`构造登录手机号` 的缺省区号 `+86`，phone 是本地号码字符串，允许空格、ASCII 横线和括号等既有格式分隔，去掉这些分隔后必须只含数字，禁止删除字母或把完整 `+号码` 当成本地号码猜区号。`+86` 要求 11 位本地数字；其他区号要求拼接后 8–15 位数字。错误使用既有 `客户端校验错误(field, message)`，field 为 `dialCode` 或 `phone`，中文说明；调用方不得吞错后发送请求。

精确例子（全部为离线合成值，不是可登录材料）：

```ts
构造登录手机号('13800000000') === '+8613800000000';
构造登录手机号('138 0000 0000', '+86') === '+8613800000000';
构造登录手机号('123456789012', '+999') === '+999123456789012';
规范化登录区号(' 999 ') === '+999';
// '0' / '++86' / '1234' / '8x6' 区号报错；
// '+999123456789012' 作为 phone、含字母、超长、空值报错，均零请求。
```

UI 保存号码输入，不按固定 11 位 slice；合法 +86 继续显示 3-4-4，其余完整显示。超长/非法内容可见并阻止提交，不能静默裁剪成为另一号码。区号改变保留全部号码，规范化后的号码或区号实际改变才作废 challenge。新挂载默认 +86，卸载清理本次尝试及 UI 定时器。

尝试生命周期使用已有 `尝试引用` 加一份稳定的手机号登录代际引用（由 Provider 持有，传给会话操作）；开始新请求、取消尝试均清空旧 attempt 并递增代际。begin 结算仅在仍是当前代际时存入 attempt；旧成功和旧失败都不能覆盖新尝试。取消方法只使本地资格失效，不声称撤销已发送短信。

完成调用在无当前 attempt 时抛本地校验错误，零 complete 请求。已开始的正常 complete 保留既有认证/水合行为，不因正常导航卸载强行撤销成功会话。页面限制 begin/complete 期间的号码、区号及冲突操作；同步 ref 防双击，旧组件定时回调/响应不更新新挂载。取消区号弹层或确认相同值不调用失效操作。换号清 OTP 和有效 challenge，但保留尚未结束的重发倒计时；倒计时结束后重新取码。begin 失败保持原有可重试语义。

区号按钮 `aria-label="编辑区号，当前 +86"`（随当前值变化）；弹层 `aria-label="编辑登录区号"`，输入 `aria-label="区号"`，按钮“确认区号”“取消”。复用 `弹层框架`，首焦点在区号输入，错误在弹层内可读，Escape/遮罩取消并恢复焦点。手机与验证码原 label 不改。

## 2. 测试选择与证据

本仓库没有后端 `tools/test affected` 或 L0–L2 catalog，不引入它们；下列显式选择表就是本任务适用的完整责任。按实际 diff/消费者校准，边界扩大时更新表并说明原因，不把范围外 suite 自动纳入。

### 测试选择五问

1. 防止默认区号破坏旧输入、新区号被截断/重复前缀、旧 challenge 串号、Mock 发真请求、角色水合回归、清理残留与假 PASS。
2. 开发反馈用 Task 1 定向 Vitest；UI 确定性边界用 Task 2 精确 Playwright 子集，不在每次改动后跑全部浏览器。
3. 输入→HTTP 请求由 route fixture 验证序列化；真实 Cookie/Origin、角色隔离和环境生命周期只能通过 STG 双轮证明，不能用组件或 mock API 代替。正式 STG 在获批 final gate 中执行；依赖缺失明确 BLOCKED。
4. 最终责任为单测/构建 + 已选既有浏览器/视觉 + 新区号 fixture + 双轮 STG。发布、后端 API L3 smoke、后端部署不属于本 Plan。
5. 现有代码和后端历史运行记录仅作设计证据；无本次改动后运行结果，成本未知。执行时保存实际耗时、candidate、选择和退出码；相同有效证据不重复 broad gate。

### 精确选择

**U：单测与类型构建**

```bash
npm test -- src/数据/登录手机号.test.ts src/数据/HTTP招聘数据源.test.ts src/屏幕/登录.test.tsx src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts src/数据/招聘数据源/P8控制面.test.ts
npm run typecheck
VITE_DATA_SOURCE=mock VITE_BACKEND_ENV=stg npm run build
```

Provider 大套件被选中是因为增加稳定代际依赖、取消操作及旧 attempt 完成防线；数据源现有方法名单断言需保留原责任并仅补新增操作。P8 数据源定向套件证明相邻换绑默认未受影响；不要求全产品单测。

**B：既有及新增 fixture 浏览器**

```bash
npm run test:e2e:data-source -- --project=mock-stg --grep '缺省数据源保持 PM Mock 登录体验和四格验证码|P8 Mock 账号安全/反馈/职位举报/直聊举报零控制面请求|登录区号'
npm run test:e2e:data-source -- --project=backend-stg --grep '登出时挂起的隐私 GET 过期不作数|P8 换绑：四位码成功|登录区号'
VITE_DATA_SOURCE=mock VITE_BACKEND_ENV=stg npm run test:e2e -- e2e/onboarding.spec.ts e2e/换壳无闪屏.spec.ts
```

执行前用相同选择加 `--list` 核对命中预期，随后必须实跑；标签项目沿用配置。默认 config 的 4173 可复用服务，执行者必须先确认已有服务 env/归属；不确定时记端口阻塞，不杀他人进程。fixture 配置的 4181–4183 必须空闲，未知请求拦截失败不得落到 STG。所有浏览器证据与 Vitest 分开记录。

**V：既有视觉责任**

```bash
npm run ui:check -- --base 3ad5d4bf3efff659ebd01188e956000ae5655f9d
```

现有 wrapper 无场景筛选参数，该命令执行一轮已有全量场景，复用其 reference/candidate 与比较报告；这是满足既有默认首屏视觉比较且不新建 harness 的最小现有权威入口，成本未知。它创建/回收自身管理的临时只读基准 worktree，这是现有测试工具的临时资源，不是第二实施工作区；不手动建立 integration worktree。检查 `entry-login-default` 的实际差异与截图，不把 report 模式退出 0 当像素无变化；新弹层 390/320 截图由 Task 2 留证。若 wrapper 报既有其他场景失败，核对本次归因，不能降低门槛或批量重录基线。合入基准变化后按最终目标调整基准并校准失效证据。

**S：真实 STG，required development 验收**

唯一入口为完成 Task 3 后 `docs/dogfood/真实后端行为验收.md` 的“STG 基础试点”，Agent 按文档执行，无 npm runner。前置：获批具体 final gate、可读后端 checkout/skills、健康且兼容的 STG、SSH/依赖、无 foreign 占用、可安全取得 OTP、agent-browser doctor 可用、前端独占 URL。严格两轮；第一轮完整基础 CRUD/双会话，第二轮精简身份轮换/意向 CRUD，均 CLEANED，且首轮登录失效。外部前置不具备记 BLOCKED；不以仅 U/B/V 通过宣称试点完成。

### Task 1: 默认兼容的区号登录与尝试生命周期

**目标：** Spec §4 全部产品行为可用，原一参数请求仍默认 +86，新 +999 全长号码经 UI/状态/数据源传递正确。

**预期编辑文件：**
- 新增：`src/数据/登录手机号.ts`、`src/数据/登录手机号.test.ts`。
- 修改：`src/屏幕/登录.tsx`、`src/屏幕/登录.module.css`、`src/屏幕/登录.test.tsx`、`src/数据/招聘数据源/会话.ts`、`src/数据/HTTP招聘数据源.test.ts`、`src/状态/后端/类型.ts`、`src/状态/后端/会话操作.ts`、`src/状态/后端/会话操作.test.ts`、`src/状态/应用状态.tsx`、`src/状态/应用状态.test.ts`。
- 删除：无。只读复用 `src/组件/弹层框架.tsx`，不改其公共行为。

**输入/输出：** 消费现有 `客户端校验错误`、弹层、attempt ref 和 Provider 水合；输出 §1 准确签名。新增稳定引用在共享 `后端操作依赖` 中声明为 `手机登录代际?: 可变引用<number>`，Provider 恒注入；在 `创建会话操作` 工厂入口检查 undefined 即抛接线错误并收窄，不创建 fallback 引用。仅实际调用该工厂的定向测试构造同步补齐。沿用已有 `提交候选意向快照` 的“共享类型可选、消费入口必需”约定，避免牵连不消费登录代际的其他域依赖桩；无需修改 P8 等无关测试。给 `会话操作` 增加取消方法只扩展前端本地接口，无新后端 route。跨 task 依赖：无。

- [ ] 阅读批准 Spec §4、上述文件与所有 `开始手机登录`/`尝试引用` 消费者，保存原默认请求和 Mock 路由断言。
- [ ] 先补纯函数失败测试：默认/显式 +86、+999 完整号码、分隔符、无效区号、字母、空和超长、切区号保留数字；先执行单文件 Vitest，确认失败源于待实现行为。
- [ ] 实现 §1 纯函数，数据源和状态层增加可选区号参数；不修改 HTTP 路由/幂等或 P8 规则。保留原单参数断言并追加显式区号零重复前缀断言。
- [ ] 先写状态反例：无 attempt 完成零请求；A begin 迟到于取消/B begin；A 失败不能清除 B；取消零网络；正常四位 complete 后水合仍成立。将旧“空 attempt 仍发 complete”的历史断言改为本地拒绝，注明此项是已批准失效修复，不能顺便削弱其他断言。
- [ ] 用稳定代际与既有 attempt ref 实现失效，只改手机号登录的写入和守卫。新 begin 清旧 attempt；取码重放无无限重试。保持完成会话的主体/角色水合及原账号清理逻辑。
- [ ] 组件先写失败反例，再增加弹层、默认值和全长号码显示；按 §1 可访问名称定位。取消/同值不失效，实际换号清码但不抹去未到期重发等待；请求期间禁用相冲突输入/按钮并有同步守卫。卸载时清理局部延迟聚焦/定时回调与旧取码尝试。
- [ ] 测试 default +86、区号确认/取消/Escape/焦点、+999 十二位、超长可见但禁用提交、改回 +86 不截断、四格码、协议、Mock 零后端操作、begin/complete 飞行期保护、卸载重进旧响应无效。用现有 deferred/fake timers，不让单测等待真实 60 秒。
- [ ] 运行 U 中单测与类型检查；验证 red→green 和完整旧默认请求断言仍在。记录实际命令/耗时，不写“预计通过”。按本 task 精确路径提交。

**完成/停止：** 全部 §4 行为和 U 定向测试通过。若需要修改 P8、全局会话协议、后端或新依赖，停止扩大范围并报告具体原因；不为绕开 TypeScript 改成宽泛 any。

### Task 2: 既有 E2E 默认兼容与新区号浏览器证据

**目标：** 证明不操作区号的原脚本仍通过，以及真实 DOM 交互发送完整新号码；不把 route fixture 叫做真实后端。

**预期编辑文件：**
- 新增：无。
- 修改：`e2e/数据源模式.spec.ts`。
- 删除：无。只读执行 `e2e/onboarding.spec.ts`、`e2e/换壳无闪屏.spec.ts`、`e2e/视觉回归/场景.ts`、现有三份 Playwright config 及 UI wrapper；不默认改旧脚本或配置。

**输入/输出：** 依赖 Task 1 的默认 +86、§1 UI 名称和请求签名，先核对其 commit 与实际导出存在。输出 `登录区号` 名称前缀的新 fixture Case 与 B/V 证据；原测试号码、选择器和默认操作序列不变。

- [ ] 在现有 `e2e/数据源模式.spec.ts` 原 fixture 边界内追加 `登录区号` describe，按 @backend/@mock 区分项目。既有 fixture 能力直接复用；全 `/api/v1` 拦截并对未声明请求失败，不 route.continue 到真实 STG。
- [ ] 固定最小新增旅程：Backend 弹层改 +999 → 十二位号码取码 → 请求 body 为完整合成号码 → 四位 complete → 角色落点 → 刷新；默认 Mock 打开弹层后取消仍 +86 → 原 11 位登录且零 API；Backend 已取码后实际改号不可用旧码完成、倒计时不被重置成可立即重发。延迟/竞态主要由 Task 1 单测承担，浏览器不重复所有排列。
- [ ] 在新增弹层旅程中检查 390 和 320 宽度、输入/确认按钮可达、页面无水平溢出；保存默认与弹层截图至 Playwright 现有 test output，不新建截图框架。
- [ ] 对 B 三条命令分别 `--list`，记录预期旧/new Case 命中；随后实际运行 B。旧默认用例保持原号码与操作，不添加“先选 +86”绕过默认值验证。
- [ ] 执行 V 一次，检查实际默认登录差异与框位置；代码改变 default 首屏时不能用整体更新基线让它通过。记录其他场景如有已存失败的证据与归因。
- [ ] 失败按 systematic-debugging 定位；Task 1 实现回归只修批准范围并补受影响测试，修改范围预告先更新。完成后按 task 精确路径提交测试改动。

**完成/停止：** 旧短信和微信/Mock 导航路径、新区号、默认视觉有实际结果。环境/基线故障如实报告；不能用 `--list`、API probe 或修改旧默认输入替代实际浏览器结果。新增用例运行必须不接触真实 STG。

### Task 3: 接入现有 dogfood 指南与两轮报告

**目标：** 无聊天上下文的 Agent 可用后端既有 skill 完成 Spec §5，明确场景范围、材料、CLI 生命周期和恢复；本 Task 只改指南，不提前执行正式 STG。

**预期编辑文件：**
- 新增：无。
- 修改：`docs/dogfood/真实后端行为验收.md`、`docs/dogfood/真实后端报告模板.md`。
- 删除：无。CLAUDE/README 已路由至此指南，不加第二个 skill 或入口。

**输入/输出：** 消费 Task 1 区号 UI、Task 2 默认/新行为证据和后端固定 CLI 合同；输出新增范围名 `STG 基础试点`、两轮节点表和清理结果。原“全部”继续仅指原 B/H 范围，STG 不偷偷替代 local 环境段。

- [ ] 在入口/提示词/环境选择中增加 `STG 基础试点`，首先路由，选中此项跳过 local dev-local/browser-fixture 和 B/H baseline 前置；原 local 启动与 receipt v2 完整保留。
- [ ] 指南环境段增加独立 STG 前端启动变体：`VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=stg npm run dev -- --host localhost --port 5173 --strictPort`，默认浏览器 URL 为 `http://localhost:5173`；不能沿用 local 变量或擅换 127.0.0.1。已有服务需核对实际 env、代理目标和归属，否则独占启动或明确端口阻塞。记录启动输出与实际 API 请求，确认走 STG 代理，不能把本地栈结果算 STG PASS。
- [ ] 指南给出从调用者后端 checkout 根执行的确定顺序，变量为执行时显式输入：

```bash
apps/recruitment/scripts/stg-env.sh validate --config apps/recruitment/testdata/stg-ephemeral/default.yaml
apps/recruitment/scripts/stg-env.sh prepare --run-id "$STG_RUN_ID" --scene ephemeral-baseline
apps/recruitment/scripts/stg-env.sh verify --run-id "$STG_RUN_ID"
# Agent 通过两套独立浏览器会话完成 UI 步骤后，无论成败都履行 cleanup：
apps/recruitment/scripts/stg-env.sh cleanup --run-id "$STG_RUN_ID"
```

- [ ] 说明 `STG_RUN_ID` 每轮新建；prepare 部分失败只用同 ID 重试/cleanup，未清理不可换 ID。prepare 未返回 READY 或 verify 失败不得进入浏览器消费；ephemeral 失败不得降级为固定账号。`status` 不带 run-id；`preflight` 为并集，只区分无关固定账号输入，真实 ephemeral 管理前置不跳过。依赖缺失按后端指引经 `tools/dev-env.sh exec --` 使用相同 CLI，不现场安装临时框架。
- [ ] 登录材料在后端 `.agxp-recruitment-stg-env/sessions/ID/login.json`，安全回执在 `receipts/`；OTP 经 skill 描述的受限通道取得。读取到受限进程/浏览器输入，不打印、不录像登录、不输出完整认证状态。执行者先确认工具支持安全输入；无法做到则 BLOCKED，不以 shell 明文 argv 或报告泄露绕行。
- [ ] 精确写入 Spec §5 两轮节点；第一轮初始资源 ID、每次写入后/刷新证据、双会话隔离、CLEANED；第二轮双登录/意向 CRUD/身份不同/不继承/清理。首轮号码比较及清理后登录失效验证只在受限内存进行，公开报告只记结论和安全字段。
- [ ] 给出排除动作、自动请求副作用观察、rc2/75/1、foreign 占用、proof 丢失、残留持锁和中断恢复规则；不放宽 Cookie 或忽略 cleanup。不关他人服务；只收尾本轮 session/PID，无 `close --all` 或端口批量杀进程。
- [ ] 模板增加环境类型、实际 `VITE_DATA_SOURCE`/`VITE_BACKEND_ENV`、浏览器 URL/代理目标、每轮 run/scene/后端实际版本/receipt 与材料路径、节点状态、旧登录失效、identity rotation 和 cleanup。原 B/H 表保留 NOT_RUN，试点结论单列，不能把子集填成原 B02/B04 全通过。
- [ ] 核对指南与模板互链、命令存在、CLI 参数及范围判定一致，沿用 gitignored `dogfood-output/` 和现有 `docs/runs/` 摘要约定。规划/review 摘要写本 Plan，不新增独立 handoff/review 文档。
- [ ] 文档 diff 自检、按 task 精确路径提交；不为 Markdown 机械增加镜像单测，不执行远端环境 mutation。

**完成/停止：** 新会话只凭指南、后端 checkout 与安全材料即可执行；local 原责任未改变。遇后端 CLI 合同漂移先记录真实版本和缺口，不在本 Task 实施后端修复。

## 实施后收尾（不计入 Task count）

1. 完成所有 Task 与 executing-plans 要求的宿主内 review；没有要求的不新增。退出 Task 循环，不调用默认 finishing-a-development-branch。
2. 在固定候选上调用宿主映射的异构 review-loop：Codex → Claude、Claude Code → Codex；绑定上述批准 Spec/本 Plan 精确版本及共享合同，reviewer 默认不跑测试。每轮裁决逐条核实，必要性/复杂度字段完整；轮间仅轻量单测/静态检查，不跑 broad gate，不手动增加 review 轮次。
3. review 返回可继续后，对规划源码基线到候选的完整 diff 核验消费者，完成 U/B/V 的最小完整责任，记录实际证据、范围变化和成本。Task 中已有有效同候选证据可复用；改动、fixture、配置、浏览器版本和基准变化使相关证据失效，只补缺口，不再进入 Task/global/异构 review。前端没有 affected CLI，使用本 Plan 显式映射对账，不运行不存在的 `tools/test`。
4. 只读取得 target 最新事实并展示具体 final gate：候选 commit、target/ref 和 pre-gate SHA、U/B/V 原始证据及复用判断、S 两轮操作与清理、所需外部前置、同步和拟 push 动作、自主恢复边界。未获用户对具体方案明确确认，不合 target、不跑 S、不 push；规划批准不是 final gate 批准。
5. 获批后在同一实施 session 按 development-workflow 的 `references/final-integration.md` 及 `assets/final-integration-contract.md` 同步 target，记录 `final_target_base`，重算完整 diff 和 U/B/V 责任，复用有效证据、补缺口，然后执行 S。获批范围内失败自主最小修复及定向复验，不再调用异构 review；改变批准行为、外部权限不足或 target race 时报告并停止依赖动作。
6. 每轮 S cleanup 后对账。最终 U/B/V 与 S 两轮及清理证据完整才宣称本轮目标达成；S BLOCKED 时如实保留试点未完成，不默认推进宣称完整交付。最终核对目标未推进后按获批方案普通 fast-forward push；不得 force push，不更改主工作区。
7. 测试原始产物沿用 `test-results/`、`ui-regression-output/`、`dogfood-output/`；长期脱敏运行摘要按既有 dogfood 模板写 `docs/runs/`（这是运行证据，不是新规划 handoff）。实施简要 review/验证/合入记录就地写本 Plan。更新 task intent 最终状态，清楚区分代码实现、测试、STG 和合入事实。

## 规划自检与文档 review

- Spec §4 → Task 1；§6 默认/新 E2E → Task 2 与 U/B/V；§5 → Task 3 与 S；§7 非目标贯穿 Global Constraints。未增加 Spec 之外的产品能力。
- 所有 task 均有精确文件、依赖、接口、反例、命令及完成/停止条件；只三个实施 Task，正式 STG 和异构 review 属收尾。
- 批准状态仅更新 Spec 元信息，契约仍绑定 `ed25e232` / `18300b23ee1faddd80da6c3faacc3f6f18c2a106`。
- 文档 review 已按下述冻结输入完成；本阶段仍无产品实现或产品测试 PASS。

### Claude 文档 review 与裁决（2026-09-12）

- 模式 `WORKFLOW_DOCUMENT_REVIEW`，父 workflow 已授权；reviewer Claude Opus / high，独立只读 session `ee541951-67b0-4e05-a520-3d0a291313f8`，一轮。候选 HEAD `470fd44c`，范围恰为本 Plan 与批准 Spec 路径；原批准合同 `ed25e232` / `18300b23ee1faddd80da6c3faacc3f6f18c2a106`。
- 审查前后 status、HEAD、两文件指纹一致；reviewer 未运行测试。结论为 2 条 Important/required、1 条 Minor/optional，不表述为原报告 NO FINDINGS。

| Finding | 裁决与证据 | 必要性 / 复杂度影响 |
| --- | --- | --- |
| 全局依赖必填牵连无关测试构造 | 接受并修复。源码确有多域完整 `后端操作依赖` 构造；沿用 `提交候选意向快照` 的可选声明加消费入口 throw，Provider 恒注入，只更新会话工厂的消费者测试。不降低接线约束、不扩大 P8 行为范围。 | required / 降低 |
| Task 3 缺 STG 前端启动命令 | 接受并修复。指南现有启动是 local，已明确要求新增 backend/stg 命令、URL、实际 env/代理证据与模板字段，防止误跑本地栈。 | required / 不变 |
| READY 与禁止固定账号降级应写入步骤 | 接受并补充。既有 Spec 已规定，Task 3 显式落为指南义务，提高零上下文可执行性。 | optional / 不变 |

三项修订均不改变批准 Spec。主控逐条核实，修订后做文件/结构/契约自检；无未解决的有效 required finding，按 review-loop 停止条件结束一轮，不伪称修订后经过第二轮 Claude review。review 原始结果存本轮临时产物，长期裁决以上表为准。
