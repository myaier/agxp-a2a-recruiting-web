# 招聘推荐、招聘者展示与城市目录最小接线实施 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Claude Code 实际调用 superpowers:subagent-driven-development；Codex 实际调用 superpowers:executing-plans。按 Task 顺序连续执行，步骤用 checkbox 跟踪；收尾不计 Task、不调用默认 finishing 流程。

**Goal:** 修复未认证企业推荐门禁、招聘公开名预览、“我”页招聘者身份，以及三个入口的大中华区默认城市目录。

**Architecture:** 沿既有映射、页面与查询钩子接线。删除旧认证专用恢复；预览和头像复用已有状态；城市仅增加22项精选配置，既有默认查询改为四国独立分页，三个消费者同一次接通。不新增通用框架或后端能力。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、Testing Library、既有 Playwright 视觉门禁与 agent-browser Backend/local dogfood；以 package-lock.json 为实际版本。

**Spec:** `docs/superpowers/specs/2026-09-14-recruiter-and-city-fixes-design.md` v1.2。批准记录 revision `855800e28a9523ea69abda811914d67ae9328dd7`，blob `0d19bf56241fab334d53b9b8cfec121351a848ed`。原产品批准正文 revision `7b6e51221a51aac3d52c6c23920ff3237faf1da0`，blob `9a76a1c34c1d76cdd810f578ebe8ae133e9ee4ed`；二者仅批准状态不同。

**计划本身复杂度：高。** 四处产品行为与真实后端验收，城市包含多分支分页和三个保存消费者；没有架构迁移。

**零上下文漂移风险：中。** 产品与数据流冻结；需要现场核实22个目录 ID 和新版后端。缺环境时明确停在对应责任，不临场改产品。因此执行基线使用当前可用的行业 Top 5–10 中高性价比模型。

## Global Constraints

- 完整读 `CLAUDE.md`、`AGENTS.md` 与批准 Spec。当前工作区为 `.`；不新建实施工作区，不 stash/reset/clean 用户内容，不修改后端。仓库路径一律相对根目录；外部 skill 通过逻辑名称发现，按该 skill 根相对解析资源。
- 规划源码基线 `5825ff47a27600cbe5591fb1a9a5fe43e7201272`，当时 HEAD=刚 fetch 的 origin/main。开工记录 `git status --short --branch`、`git rev-parse HEAD origin/main`，只读 `git fetch origin main`，核对 main 推进和预期文件实际内容。
- 用户明确要求从最新 origin/main 开始：开工建立实现基线时允许在当前用户工作区保护已有改动后，以普通 merge 纳入最新 origin/main，保留本 Plan/Spec 提交；这是对 workflow“确认前不合 target”的一次起点例外，非最终合入授权。若存在用户改动冲突或实质契约变化，先报告，不重置、不擅自重设设计。冻结实际实现基线为 START_BASE；后续 target 同步、正式 L3、push 仍在人工 final gate 后。
- 开工读 development-workflow 的 `assets/execution-contract.md`；按其 `scripts/task_intents.py --help` 使用 start 登记当前任务和下面精确文件，读 active/paused 记录；扩范围前 update，不替其他任务改记录。宿主已在 linked worktree 则复用，不创建第二个。
- 不修复企业管理员申请、公司信息、名片公司读取、岗位用人企业读取的后端错误；不伪造组织、认证或假成功。实际后端阻塞单独报告，不静默换 Mock。
- 不改 P4 推荐ID/岗位坐标、幂等、scope/subject/generation 栅栏、401、单飞或 DTO 的严格解码。只撤企业认证前提及其专用恢复。
- 名片请求、revision、头像上传、错误保留、注册跳转不变；“我”页零新增头像/公司/档案请求。
- 城市精选固定12个大陆+10个海外，不含TW/HK/MO；三个区域标题中文，组内用 API 原名，接受英文/拼音；不增加中文搜索能力，不迁移既有已选和历史值。
- 不恢复旧折叠 use城市分组，不清理无关死代码；不增加 feature flag、缓存框架、国际化系统或通用目录抽象。仅已有目录选择值替代局部不必要的完整 DTO 类型。
- 先行为 RED，再最小实现 GREEN，保留有价值的既有反例；不只删旧测试，不改测试阈值取得绿灯。不在规划会话实现产品。

## Task index

Task count: 4
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

按 1→2→3→4 串行，前三项业务相互独立；Task 4 的查询、配置与三个消费者相互依赖，一起交付以避免半接线。每 Task 自带独立测试周期，文档核验和环境准备归对应 Task，不另计基础设施 Task。

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|推荐前提及错误接线；无上游业务依赖|Top 5–10（Claude Code: sonnet）；P4栅栏需认真辨别|Top 5–10（Claude Code: sonnet）；核对旧码与新前提|前沿 / 顶级模型（Claude Code: opus）；关注删恢复后的单飞/幂等|
|2|名片实时预览；独立|任意（Claude Code: haiku）；局部取值变更|Top 5–10（Claude Code: sonnet）；保护实名与保存|Top 5–10（Claude Code: sonnet）；检查双入口|
|3|招聘者头像姓名；独立|Top 5–10（Claude Code: sonnet）；局部图片生命周期|Top 5–10（Claude Code: sonnet）；明确姓名/公司语义|Top 5–10（Claude Code: sonnet）；旧error与换主体|
|4|城市查询+精选+三入口完整接线；内部一起交付|Top 5–10（Claude Code: sonnet）；冻结查询及引用契约|前沿 / 顶级模型（Claude Code: opus）；核对完整目录与真实ID|前沿 / 顶级模型（Claude Code: opus）；多游标、失败与版本|

Claude Code 的条件 alias 不适用于 Codex。Codex 用自身模型配置与 executing-plans，不寻找 haiku/sonnet/opus，不为角色表擅自增加委派。各宿主依执行 skill 完成必要的内部 review；异构 review 仅在全部 Task 后执行。

## 共同测试与证据选择

1. **失败与边界：** 推荐未知/缺ref/未认证三态；实名与草稿优先级；图片失败与身份切换；目录国家/游标/版本隔离、真实ID保存与全局搜索；Mock零Backend请求。
2. **最小开发反馈：** 每 Task 的 `npm test -- <精确文件>`；新增目标断言先运行记录 RED，最小改动后运行同命令 GREEN。保留原会话进程，不因等待超时重启 suite。
3. **提前真实边界：** Task 4 精选正式接入前用真实 Location GET核对22条ID，不以单测或快照替代；其余浏览器回归在实施 review后执行。后端推荐新规则需要现场新版服务，旧409兼容不算新规则成功。
4. **最终责任：** 用户明确要求完整单元、typecheck、lint、production build、Backend/local回归；另履行现有视觉CI。该前端没有 `tools/test affected` 或 L0–L3 runner，不复制后端测试平台；用实际 diff 的定向清单与下面现有命令履责。正式后端 development L3 selection=none，本任务不改后端、不调用 release/behavior runner；本次手工定向 dogfood 是用户明确要求的前端验收，在 final gate 确认前完成，不把它标成已跑后端正式 L3。
5. **已有证据/成本：** START前规划基线10文件420测试通过，Vitest5.27秒（完整命令见 Spec§9）；这是旧行为基线。完整单元、build、视觉及真实浏览器耗时未知，不为估时先跑重测试。每份输出记录源码commit、基线、命令、环境、结果和缺口到既有忽略目录。

### Task 1: 撤销推荐企业认证前提及旧恢复接线

目标：权威owner job有非空ref即允许推荐；缺ref引导编辑；旧认证拒绝只作为实际请求失败。非目标：其他P4算法、操作协议、实名或岗位编辑实现。

预期编辑文件：
- 新增：无。
- 修改：`src/数据/发现推荐映射.ts`、`src/数据/发现推荐映射.test.ts`、`src/状态/后端/发现推荐操作.ts`、`src/状态/后端/发现推荐操作.test.ts`、`src/屏幕/候选推荐.tsx`、`src/屏幕/候选推荐.test.tsx`。
- 删除：无。

只读消费者/保护测试：`src/数据/HTTP客户端.test.ts`、`src/数据/招聘数据源/发现推荐.test.ts`、`src/状态/后端/use发现推荐委托轮询.test.tsx`；不要修改解码器来放宽旧码。

接口：生产 `判断P4招聘组织前提(job: BFFOwnerJob | null | undefined)`，保留unknown/ready形状，blocked只剩 `reason: 'missing_ref'`。消费权威 `后端状态.岗位快照[jobId]`；页面仍先验证当前岗位在招，ready才传入现有范围与轮询钩子。`刷新招聘候选(jobId)`、加载与注册签名不变。

```ts
// 函数外部结果必须等价于此；不增加企业查询。
if (job == null) return { kind: 'unknown' };
const organizationRef = job.hiring_organization_ref?.trim() ?? '';
return organizationRef === ''
  ? { kind: 'blocked', reason: 'missing_ref' }
  : { kind: 'ready', organizationRef };
```

- [ ] 读以上实现与原测试的组织前提/refresh409区，定位 `就绪岗位` 对注册、加载、下拉、补给、委托轮询的五处传递；记录 START_BASE 与实际差异。
- [ ] 修改旧“unverified受阻”参数化测试为 verified/unverified+ref均ready并发请求；追加undefined/null/空串/空白ref、未水合owner中性加载、缺ref点击 `路径.编辑岗位(jobId)`。页面断言不包含“匿名候选推荐需要已验证的用人组织”“先完成企业实名认证”“去认证”。
- [ ] 用现有操作mock、计时/延迟promise工具覆盖 unverified 的下拉GET、补给POST及accepted/evaluating委托轮询；断言错误scope/未知owner零请求，切岗和迟到响应原反例保留。
- [ ] refresh旧精确409测试改为：只发一次refresh POST，不额外 `读取岗位()`，原错误码仍抛出；持久快照中文为“推荐请求被服务端拒绝，请稍后重试”，无认证CTA，不自动重POST。保留同键重试、并发点击单飞、401与stale fence用例，只替换依赖已删除组织重读的旧场景。
- [ ] 运行下方定向命令得到行为 RED；若失败来自 fixture缺字段而非目标，先修fixture后重新记录RED。
- [ ] 采用上面的最小前提；替换页面受阻文案为“这个岗位尚未选择用人企业”，CTA“编辑岗位并选择用人企业”，删除认证/加入企业入口。保留无在招岗位和owner加载的中性分支。
- [ ] `P4错误文案`只替换旧码中文；删除refresh的认证专用catch/Owner Jobs对账锁与分类，调用原 `运行范围刷新` 不变。页面移除旧码静默return；保留真实invalid_response持久保护，不能把已知旧409升级为invalid_response。只清理因此失去用途的导入/局部量。
- [ ] 运行定向命令GREEN，检查diff未修改通用幂等/栅栏实现，然后仅提交本Task文件，建议 `fix: allow recommendations for unverified hiring organizations`。

验证命令：

```bash
npm test -- src/数据/发现推荐映射.test.ts src/状态/后端/发现推荐操作.test.ts src/屏幕/候选推荐.test.tsx src/数据/HTTP客户端.test.ts src/数据/招聘数据源/发现推荐.test.ts src/状态/后端/use发现推荐委托轮询.test.tsx
```

完成：所有目标及保护断言通过，unverified不再决定可用性。停止条件：新版后端改变P4其他契约或现有单飞/栅栏行为无法保持，记录具体差异，不放宽保护换取绿灯。未部署新版后端不会阻止本Task单测，但阻止最终真实推荐成功判定。

### Task 2: 招聘名片公开名草稿即时预览

目标：未实名公开名输入立刻反映在顶部名片，实名仍权威只读；两个Backend入口相同。非目标：公司加载、保存事务、头像或导航重构。无上游接口依赖。

预期编辑文件：
- 新增：无。
- 修改：`src/屏幕/招聘名片.tsx`、`src/屏幕/招聘名片.test.tsx`。
- 删除：无。

消费 `身份.verifiedName/publicName` 和本地 `公开名`；生产仍为 `招聘名片展示` 原props。名片表单操作、revision和 `从注册流` 路由state契约不变。

- [ ] 读 `后端名片` 与展示组件测试，复用原 fixture/render helper。参数化普通编辑和 `{ 从注册流: true }` 两入口：输入一个新名字，不提交，在顶部预览容器断言新名字而非只在input断言；清空也不得回旧名字。
- [ ] 保留/补充有verifiedName时公开名不可编辑、预览权威实名；保存仍提交trim后public_name，revision和两个入口原跳转不变。Mock原预览行为沿既有用例保护。
- [ ] 运行下方命令记录RED，然后将显示姓名计算移到公开名state之后，等价 `可编辑公开名 ? 公开名 : 身份.verifiedName`；readonly值仍是权威姓名，不改保存或水合effect。
- [ ] 再运行GREEN，核对diff仅取值/对应注释与测试；提交 `fix: preview recruiter public name while editing`。

```bash
npm test -- src/屏幕/招聘名片.test.tsx src/组件/招聘名片/招聘名片展示.test.tsx
```

完成：两入口未保存即更新预览，实名与原保存行为通过。停止：若改名必须改后端保存合同才能成立，先报告，不扩大本Task。

### Task 3: “我”页显示招聘者头像、姓名与独立任职信息

目标：顶部入口代表招聘者本人，失败图片有fallback；无公司不误导完善名片。非目标：组织读取、关系选择、档案请求、统计/功能宫格。无上游接口依赖。

预期编辑文件：
- 新增：无。
- 修改：`src/屏幕/企业我的.tsx`、`src/屏幕/企业我的.module.css`、`src/屏幕/企业我的.test.tsx`。
- 删除：无。

消费 `从BFF招聘身份` 已有 `verifiedName/publicName/avatarUrl/title/currentAffiliation`；公司沿用现有 `显示公司` 来源，不伪造新组织。Mock消费 `企业认证` 与 `招聘头像`。输出仍为跳转 `路径.招聘名片` 的原button。

- [ ] 测试先覆盖有效src/alt、无图、error、verifiedName优先、publicName、无姓名占位、无企业但有名片、职务与公司独立行、原关系标签和跳转；Mock同样使用本人名而非公司。
- [ ] 用rerender与fireEvent.error覆盖 URL更新、切主体和旧img迟到error：新图仍显示；断言没有额外档案/组织请求（原summary加载不计为新增）。运行下方命令RED。
- [ ] 主标题非空实名→非空公开名→“完善招聘名片”，fallback取有效姓名首个Unicode字符，缺名为“人”。头像alt“招聘者头像”，适配原圆形容器object-fit:cover。职务/公司非空才显示，状态胶囊保留。
- [ ] 图片错误只归当前主体+URL。可在同文件用一个仅负责头像的局部组件，并以主体+URL作为React key使失败state天然重置；只提取这一真实生命周期边界，不做共享头像框架。旧节点error不影响新挂载实例。
- [ ] 运行GREEN，检查原统计/summary scope不变，提交 `fix: show recruiter identity on account page`。

```bash
npm test -- src/屏幕/企业我的.test.tsx
```

完成：上述展示与生命周期断言通过，映射和网络层零改动。停止：缺字段只能走已定义占位，不申请新增后端或模拟数据补齐。

### Task 4: 四国默认目录、真实精选与三个城市入口一次接通

目标：默认可分页浏览CN/TW/HK/MO；12+10精选独立；全球搜索；港澳台中文组名/英文条目；三个入口同规则、保持保存ID。查询与消费者的局部类型变更必须在本Task内完成，不提交不可编译的中间状态。无前三Task接口依赖。

预期编辑文件：
- 新增：`src/数据/城市精选.ts`、`src/数据/城市精选.test.ts`。
- 修改：`src/数据/城市与行业.ts`、`src/屏幕/城市查询钩子.ts`、`src/屏幕/城市查询钩子.test.ts`、`src/屏幕/选工作城市.tsx`、`src/屏幕/选工作城市.test.tsx`、`src/屏幕/选择城市.tsx`、`src/屏幕/选择城市.test.tsx`、`src/屏幕/引导问答.tsx`、`src/屏幕/引导问答.test.tsx`、`src/组件/备选城市选择正文.tsx`、`src/组件/备选城市选择正文.test.tsx`、`docs/dogfood/backend-local-onboarding.md`。
- 删除：无。

只读：`src/数据/招聘数据源类型.ts`（目录选择值=既有BFF目录引用）、`src/数据/招聘数据源/目录.ts`（缓存/强制刷新）、`src/状态/后端/目录查询.ts`、`src/数据/HTTP招聘数据源.test.ts`、`src/状态/后端/候选操作.test.ts`。本Task不改HTTP schema、后端请求API或持久状态类型。

#### 精确局部接口与归属

```ts
// src/数据/城市精选.ts：仅复用已有 目录选择值，不造完整BFF条目。
export type 精选城市项 = 目录选择值 & { countryCode: string };
export const 国内精选城市: readonly 精选城市项[]; // Spec§6.2表的12项/顺序
export const 海外精选城市: readonly 精选城市项[]; // 同表10项/顺序

// src/屏幕/城市查询钩子.ts：生产接口；去掉旧热门项们返回值。
use城市默认页(查询Location: 查询Location方法 | undefined): {
  项们: BFFLocationItem[];
  加载中: boolean;
  还有: boolean; // 尚未成功的首页/失败待重试页也为true
  加载更多: () => Promise<void>;
}
// 保持签名：按行政区分组(项们: BFFLocationItem[])
//   => { 键: string; 城市们: BFFLocationItem[] }[]
// use城市搜索 原返回值/方法签名不变。
```

精选配置归产品展示；查询钩子仅管理默认目录，不依赖精选。三页的后端已选state、toggle入参、ID→项映射统一收窄为已有 `目录选择值`；目录分组/查询继续用真实BFFLocationItem，不改变数据源类型。`引导问答` 的城市题props和上层已选state同步收窄，删除为了初始化选择而补空国家/时区/人口的造字段代码。其他用途的BFFLocationItem不迁移。

`备选城市正文Props` 用 `国内热门项们: 城市按钮值[]`、`海外热门项们: 城市按钮值[]` 替代原 `热门项们`，其余字段不变。标题“国内热门城市”“海外热门城市”；另两页沿原CSS渲染同名区域。选择列表/搜索/历史的同一个ID共享选中状态，禁止按中文名字反查ID；提交原有目录选择值，HTTP层仍只发ID。无需全站覆盖精选的中文别名，后端权威回读原名可保留。

`城市与行业.ts`：保留现有导出兼容未改消费者；Mock默认城市字典把四直辖市分别列出、港澳台拆三组、移除海外长组。导出 `Mock城市搜索字典`，由默认字典加原海外模拟记录/新增精选名构成，按名称去重；三个Mock搜索改读这一份。已有Mock中文港澳台历史值不迁移，仍正常展示/删除；新默认条目使用核实后的API英文名。旧 `城市分组/use城市分组` 不启用、不作为此Task测试真相，不无关清理。

#### 查询与失败的精确行为

固定国家顺序CN/TW/HK/MO，默认页大小保持20。每个国家持有items、nextCursor、catalogVersion、首页是否成功、pending；ref同步设pending防同一事件循环重复调用，useState供渲染。首次四请求可并发，一支失败不会丢弃其他支结果。

- 分支尚无成功首页→请求 `{countryCode, limit:20}`；有游标→请求 `{countryCode, cursor:该支游标, limit:20}`；成功且cursor=null→不再请求该支。
- 加载更多仅对未完成/失败可重试的分支取一页，且跳过pending。聚合加载中=任一pending，聚合还有=任一未成功首页或有cursor；失败不写null游标伪造完成。
- 响应项 country_code 不等于请求国家→该支整页不提交，提示“城市目录数据异常，请重试”，保留其原游标/可重试状态。默认聚合只来自四支，海外精选与搜索无写入路径。
- 同支追加版本变化→丢弃该支旧累计页/旧游标并以同countryCode、无cursor、`{ 强制刷新:true }` 重读首页；重读失败保留“需从首页重开”的状态，不拿旧游标重试。其他支不重开。端点级缓存失效用既有实现，不新增版本协调服务。
- 按ID去重；卸载/禁用查询后代际作废，旧完成与finally不能恢复旧列表或覆盖新pending。use城市搜索现有250ms防抖与版本重开保持原合同；消费完整 `查询Location方法` 类型，不丢弃可选强制刷新参数。
- `按行政区分组`：CN按admin1_code聚合，标题取非空admin1_name，缺信息不编造；标题顺序按code稳定。TW/HK/MO无视admin1细分，键固定为用户三个中文名称；组内保留display_name。空分支加载失败不渲染假城市，所有四支成功时展示实际存在分组。

#### 步骤与验证

- [ ] **真实ID前置：** 读 Spec§6.2的22项及后端快照出处；定位执行环境提供的后端checkout，读其规则和local启动说明。按dogfood文档使用健康的测试栈/账号，GET `/api/v1/catalog/locations` 核对每项ID、国家、城市与可选返回。大陆可按CN首页核对12项；海外按表中国家+API原名查询，翻页直到命中精确ID或明确无结果。仅开发核验可以逐项查，运行产品禁止首载22次搜索。后端未运行时按现有启动文档准备，不能改其代码或占用/关闭他人的栈；外部前置缺失记BLOCKED。保存非敏感核验摘要和原始证据于 `dogfood-output/<run-id>/`，记录backend commit、catalog_version。
- [ ] 若任一精选无法真实核实，不生成可提交假城市；可先做其余确定的查询/页面工作，但Task4与最终交付保持未完成，不能用快照替代接口核验。确认后的ID表才能进入 `城市精选.ts`，以实际回包为准的等价ID更新需记录原因；换产品城市需重新确认。
- [ ] **先RED：** 用现有hook测试助手追加按countryCode分发的promise桩：首次仅四国、各自分页、同tick单飞、一国首页失败后重试、追加失败保留cursor、版本重开失败再试从首页、跨国家响应拒收、卸载迟到结果不提交；保留全局搜索的q无国家限制/清空/换词迟到反例。
- [ ] 在三个页面测试中都断言两个精选区、无港澳台精选、三个中文组标题与英文可选条目、全球搜索与清空恢复、按ID选择；不要继续用默认首页动态项当热门的断言。选工作城市覆盖注册多选与 `来源=意向` 单选；选择城市覆盖主城市排除、9上限、历史/取消/保存；引导问答覆盖默认和搜索第二页可达及原建档引用保存。
- [ ] Mock测试覆盖分组名称/英文条目、海外仅精选或搜索不入长列表、搜索范围未缩窄、已有历史值不丢失、原选择上限；新配置测试断言12/10长度、顺序、ID唯一、国家范围，不将这类单测说成真实可提交证明。展示组件测试适配两个热门props。
- [ ] 运行下方命令记录RED；实现一份精选、四支默认查询和分组规则，不复制三个query实现。三个消费者一起适配目录选择值与两热门区。
- [ ] 保持两现有选择页的分页/滚动交互；在引导问答城市题列表尾增加同款“加载更多”按钮，根据当前搜索态接搜索/默认的还有与加载中。初始加载使用既有中性加载文案，不将正在加载当无结果；失败支可通过该按钮重试。不得改共享滚动区基础设施或题序。
- [ ] 把dogfood旧“向导城市仅首页”的已知限制改为实际分页断言，加入三个标题/组内原名/精选排除港澳台的行为说明，不修改无关known blockers。
- [ ] 运行下方定向GREEN及 `npm run typecheck`，核对没有 `as BFFLocationItem` 或假DTO字段用于新精选。检查整个Task类型/保存接线后提交 `fix: curate city picks and scope default directory`。

```bash
npm test -- src/数据/城市精选.test.ts src/屏幕/城市查询钩子.test.ts src/屏幕/选工作城市.test.tsx src/屏幕/选择城市.test.tsx src/屏幕/引导问答.test.tsx src/组件/备选城市选择正文.test.tsx src/数据/HTTP招聘数据源.test.ts src/状态/后端/候选操作.test.ts
npm run typecheck
```

完成：22项有真实核验，四国分页与三入口契约全部通过；Mock零后端调用，保存消费者接线无类型漏洞。停止：目录接口缺失/精选失效/环境不可用如实报告，绝不新增后端或偷偷按名字提交。城市英文不构成阻塞。

## 实施后收尾（不计入 Task count）

全部Task及宿主执行skill要求的全局review结束后，退出Task循环，按以下顺序在同一实施session持续完成；这覆盖默认finishing分支菜单。

1. **异构代码review：** 冻结START_BASE..候选HEAD，绑定本Plan与批准Spec；Codex调用claude-review-loop，Claude Code调用codex-review-loop。必须读取该skill及根相对 `../_shared/review-contract.md`，默认只读不测试。轮次、裁决、停止条件按skill；轮间只跑修复相关定向单元或静态检查，不跑完整gate。记录每条finding的必要性/复杂度与核实裁决，optional不强制采纳。不因本次规划文档review已完成而跳过此代码review。
2. **实际diff覆盖与完整前端验证：** `git diff --name-status START_BASE..HEAD` 对照本Plan全部生产/消费/删除/新增路径，补齐漏选风险；执行下面权威命令一次，并将日志放忽略证据目录。此仓库无affected runner，手工核对清单不是伪造一个selection receipt。用户要求完整单元，不以定向PASS代替。修复后只补受影响项；无法证明旧完整证据仍有效时明确缺口，不声称全绿。

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run ui:check -- --base "$START_BASE"
```

视觉入口由仓库runner创建/清理短期detached参考worktree，这是既有测试工具行为，非第二个用户实施工作区。按 `docs/UI回归巡检.md` 读取report与diff；默认report模式exit0不等于无视觉变化；不改UI_VISUAL_GATE/阈值/基准来隐藏差异，也不自行加ui-change-approved标签。结构/API隔离或基础设施失败按仓库规则处理，不能用标签绕过。

3. **用户指定Backend/local定向浏览器验收：** 读 `docs/dogfood/真实后端行为验收.md` 和更新后的 `docs/dogfood/backend-local-onboarding.md`，先运行 `agent-browser --version`、`agent-browser doctor`、`agent-browser skills get core --full`、`agent-browser skills get dogfood`。前端启动命令 `VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local npm run dev -- --host localhost --port 5173 --strictPort`。沿文档准备独立账号/浏览器，复用健康栈时不关闭他人资源，账号材料不进聊天/提交。
   - 真实owner job为unverified+有效ref：进入推荐，观察正确job_id的GET发出并正常显示推荐页；下拉刷新、让代理再找一批和accepted/evaluating轮询各记录真实网络结论。新版服务仍返回旧认证409时兼容UI可单独通过，但新产品路径判BLOCKED/FAIL，不能报整体通过。
   - 名片普通编辑与注册入口未保存改名预览；已实名权威只读；普通UI保存及权威回读按原规则。若公司读取阻止保存，记录后端依赖，不能伪造公司绕过。
   - “我”页头像与本人名、公司/职务/关系；真实有效图检查，失败fallback由确定性测试覆盖，无需篡改后端图片。
   - 三个城市入口均检查两热门区、无港澳台精选、中文组名+英文条目、四国分页、全球海外原名搜索、清空恢复、选海外精选保存canonical ID并权威回读。保持各入口原限制；Mock页面行为有定向测试与视觉证据，不代替Backend真实路径。
   - 仅本次路径，不自动跑B01–B05/H01–H04或注册全套；借用其前置与纪律，不把未跑Case标PASS。证据/报告用 `dogfood-output/<run-id>/`，先清理本次自建session/service，再记录环境清理对证据的影响。正式后端L3=none，本次dogfood为确认前前端验收；不要求后端中文化。
4. **人工final gate：** 全部适用验证无缺口、review结论允许继续后，展示具体候选commit、只读fetch后的pre-gate origin/main、可复用证据、当前已review版本与后续修复差异、合入和push命令、风险及自主恢复边界；等用户明确确认。测试失败或backend阻塞时继续可独立工作，最终如实列未完成，不称ready，不以此次规划批准代替final gate批准。
5. **确认后的同步/验证/合入：** 完整读 development-workflow 的 `references/final-integration.md` 与 `assets/final-integration-contract.md`。同步实际origin/main，记录final_target_base，普通merge；按最终完整diff重算责任，输入/环境未变复用有效PASS，仅补新选中或失效验证。后端正式development L3仍none，不执行release runner；合入触及真实边界时补本次受影响dogfood路径。cleanup后再次核对证据，最终fetch确认target未推进，在授权范围内普通fast-forward push至main，不force、不操作其他用户工作区。target race或产品范围变化报告并重做具体方案；不在确认后重新调用异构review。

最终报告：根因、实际文件、设计取舍、RED/GREEN与所有验证命令结果、文档/代码review各自版本与裁决、后端依赖、实际push事实。原日志/截图留既有忽略路径，摘要就地写入本Plan“实施记录”，不新增handoff/review报告/执行说明文档。完成或取消时更新task intent状态。

## 文档 review 记录

候选范围仅本Plan与批准Spec。使用 WORKFLOW_DOCUMENT_REVIEW，scope_approved_by_parent_workflow=true；reviewer为Claude opus/high，plan权限、只读且不跑测试。逐轮精确revision/blob、finding裁决与结论在实际审查后写入本节；当前尚未获得review结论，不据此生成执行提示词。

## 实施记录

尚未实施。新实施session在此记录实际START_BASE、Task提交、代码review候选与裁决、验证摘要/忽略证据位置、缺口及final gate状态；不把规划基线420条旧测试PASS当成本次实现PASS。
