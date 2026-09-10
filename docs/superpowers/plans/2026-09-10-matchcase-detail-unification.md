# 双端在谈详情展示统一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Claude Code 使用 superpowers:subagent-driven-development；Codex 使用 superpowers:executing-plans。依赖顺序串行实施，不自动另建用户工作区。checkbox 表示执行步骤。

**Goal:** 双端在谈详情的 Mock/Backend 共用展示与 CSS，第二 Tab 和资料区完整保留，缺失明确可见，现有真实动作与披露边界不变。

**Architecture:** 保留两种来源的连接层，复用既有阶段流与业务操作；提取页面实际需要的纯展示、局部投影和控制 hooks。资料缺失不填成 Mock 业务对象，不新增后端查询或全站框架。

**Tech Stack:** React 19、TypeScript、CSS Modules、Vitest/Testing Library、Playwright；精确依赖由当前 package-lock.json 锁定，不升级。

**Spec:** `docs/superpowers/specs/2026-09-10-matchcase-detail-unification-design.md`。产品批准版本 revision `dc86b11686011a87c3778d917f9cd3ef59cace22`、blob `dfc599b50d605df288597154cf76b5110ed9db30`；批准及用户 Task 数量覆盖记录 revision `ec45087d90534298ce7d9f9d7b9f4e02e9d13106`、blob `22245cf802b92f867990d9da646b792029822a67`。最新用户覆盖解除 8–10 限制，不改变产品范围；执行输入使用含记录版本，产品依据仍绑定原批准正文。

## Global Constraints

- 本次只覆盖两条详情路由、它们的控制逻辑、展示组件和必要测试。
- 两端都保留第二个 Tab：求职端「职位详情」、招聘端「在线简历」。缺数据不得隐藏整个 Tab 或整个信息区。
- 展示层不读 Context、fixture、localStorage、环境变量或 BFF raw DTO，不自行推导动作权限、计算业务匹配分、请求数据或拼路由。
- 缺失使用现有次要文字色，不用错误红色/通过绿色。数值 0 是合法数值时显示 0；缺失显示“—”和可访问文案，不传入 0、NaN。
- 无原因证据时使用“缺失”，不新增获取缺失原因的接口或全局原因系统。
- 不改 BFF schema、请求 URL/query/body、解码白名单、角色授权、状态机、数据库或持久化；不新增 Company/Job/Resume/P4 查询来填 Case 详情，不把 open candidate_summary 引入 detail 请求。
- 用户工作区固定 `.`，target `origin/main`；实现基线从 `b93436e956dcd133ca909c06939e3416f2f3ad24` 及已批准文档出发，开工只读核对当前 target/并行改动，不覆盖已有工作，不 stash/reset/clean。
- 执行前完整读取 CLAUDE.md、AGENTS.md、Spec；外部 skill 以逻辑名发现，references/assets/scripts 从解析符号链接后的 skill 根目录解析。缺必需合同不能跳过。
- 实施前用 development-workflow 的 `scripts/task_intents.py start` 登记；扩路径前 update/list。审核每轮冻结候选与批准契约；reviewer 不跑测试、不修改文件，最多三轮，required/optional 分开裁决。
- 非目标为列表、onboarding、选择器、招聘名片、发岗、简历管理和独立匿名简历改版。不要修审计中的其他问题。

## Task index

Task count: 11
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

11 = 9 个实现交付 + 1 个整体验收/peer review + 1 个 final gate；符合 workflow 12 个实现 Task 软上限，无隐藏收尾。全部串行，Task 1→2→3→4→5→6→7→8→9→10→11。每个 Task 引用 Global Constraints 和下列显式契约，不能依赖规划聊天。中间提交允许保留尚未迁移的旧组件，当前 Task 的完成要求必须可独立测试；最终不保留双模式展示。

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|共享壳、顶栏、Tab；基线|Top 5–10（Claude Code: sonnet）；明确展示边界|Top 5–10（Claude Code: sonnet）；核对完整布局|Top 5–10（Claude Code: sonnet）；限制槽位滥用|
|2|阶段投影及状态区；1|Top 5–10（Claude Code: sonnet）；搬移现有映射|前沿 / 顶级模型（Claude Code: opus）；角色和当前段语义|Top 5–10（Claude Code: sonnet）；删除重复|
|3|职位 Tab 和缺口；1–2|Top 5–10（Claude Code: sonnet）；具体资料区|Top 5–10（Claude Code: sonnet）；不跨域补齐|Top 5–10（Claude Code: sonnet）；共享公司/分析组件默认兼容|
|4|在线简历 Tab；1–3|Top 5–10（Claude Code: sonnet）；提取既有正文|前沿 / 顶级模型（Claude Code: opus）；披露和旧消费者边界|Top 5–10（Claude Code: sonnet）；无双份正文|
|5|S0 动作及回答；1–4|前沿 / 顶级模型（Claude Code: opus）；在飞换单|前沿 / 顶级模型（Claude Code: opus）；精确动作条件|Top 5–10（Claude Code: sonnet）；控制/展示边界|
|6|S1 选择与披露提交；1–5|前沿 / 顶级模型（Claude Code: opus）；文件版本和授权|前沿 / 顶级模型（Claude Code: opus）；取消零提交|Top 5–10（Claude Code: sonnet）；复用现有操作|
|7|PDF 预览生命周期；1–6|前沿 / 顶级模型（Claude Code: opus）；资源和迟到响应|前沿 / 顶级模型（Claude Code: opus）；角色授权|Top 5–10（Claude Code: sonnet）；不造租约基础设施|
|8|S2/S3 卡及模拟决策；1–7|前沿 / 顶级模型（Claude Code: opus）；typed 坐标与不同剧情|前沿 / 顶级模型（Claude Code: opus）；无假成功|Top 5–10（Claude Code: sonnet）；卡片复用|
|9|叮嘱、终局、控制收口；1–8|前沿 / 顶级模型（Claude Code: opus）；会话和换代|前沿 / 顶级模型（Claude Code: opus）；只读/移交|Top 5–10（Claude Code: sonnet）；残留接线审计|
|10|浏览器/完整验证与异构 review；1–9|前沿 / 顶级模型（Claude Code: opus）；跨层证据归因|前沿 / 顶级模型（Claude Code: opus）；Spec 全覆盖|前沿 / 顶级模型（Claude Code: opus）；收尾审查|
|11|final gate；1–10|前沿 / 顶级模型（Claude Code: opus）；主控不委派人工批准|Top 5–10（Claude Code: sonnet）；可委派只读证据核对|Top 5–10（Claude Code: sonnet）；可委派差异核对|

**计划本身复杂度：高。** 多阶段 UI、两类控制来源及已有共享消费者，验证成本高。

**零上下文漂移风险：高。** P5 动作锁/租约不能随展示重挂载丢失，列表分支可能先合入，旧 Mock 与服务端流程不能逐词对应。执行模型使用当前可用的行业顶尖模型；Task 角色表按局部判断难度细化。Codex 按宿主配置与通用档位执行，不校验 Claude alias；Claude 角色 alias 缺失则报告，不静默降档。

## 文件职责与公共契约

新展示目录为 `src/组件/在谈详情/`；新控制目录为 `src/屏幕/详情控制/`。不要把模式名放入展示组件名或 props。源码位置用符号定位，不依赖后续漂移的行号。

- `详情外壳.tsx/.module.css`、`详情顶栏.tsx`：固定版式与 Tab，标题/内容由输入提供。
- `详情状态区.tsx`、`详情动作卡.tsx/.module.css`、`事实问题卡.tsx`、`简历选择层.tsx`、`详情底栏.tsx`、`终局区.tsx`：本页实际重复的业务展示。
- `职位资料.tsx/.module.css`：匹配分析、JD、要求、公司、对接人；`在线简历正文.tsx`：从原简历正文提取的纯渲染，沿用原 CSS，旧导出继续兼容。
- `类型.ts`：以下局部展示类型；不输出全局业务 DTO。
- `src/数据/详情展示映射.ts/.test.ts`：数据投影，无 I/O。现有 `MatchCase展示映射.ts` 不改协议语义。
- `use后端详情动作.ts`、`useCasePDF预览.ts`、`use后端详情控制.ts`、`后端正常详情.tsx`：由原 P5 屏搬来的业务控制。hook 拆分按已存在生命周期，不再新增 facade/状态库。
- 原 `在谈详情.tsx`、`候选详情.tsx`、`P5/MatchCase详情.tsx` 保留路由/来源连接角色；Mock 原控制可留本文件，不为对称再拆两个巨型 controller。

### A. 页面与字段展示

下列类型定义于新 `类型.ts`；React 类型只用 type import。text/null 的语义由每个区块的明确文案决定，不建立通用 reason 枚举。`ReactNode` 槽只用于组合本 Plan 的共享子组件，禁止传入旧 Mock/Backend 整页 JSX 逃避复用。

```ts
import type { ReactNode } from 'react';
export type 详情Tab = '进度' | '资料';
export interface 顶栏信息 {
  端: '求职' | '招聘';
  标题: string | null;
  副标题: string | null;
  画像: { 性别: '男' | '女' | null; 年限: string | null; 学历: string | null; 求职状态: string | null } | null;
  右侧: { kind: '分数'; 值: number | null } | { kind: '薪资'; 值: string | null };
  岗位上下文: string | null;
}
export interface 详情外壳属性 {
  信息: 顶栏信息;
  返回: () => void;
  当前Tab: 详情Tab;
  切Tab: (tab: 详情Tab) => void;
  进度: ReactNode;
  资料: ReactNode;
  底栏: ReactNode;
  弹层?: ReactNode;
}
export interface 状态区信息 {
  阶段: string; 状态: string; 步骤: string | null;
  轮次: { 当前: number; 预算: number } | null;
  徽标: '需要你' | '需注意' | '代理处理中' | null;
  注意说明: string | null;
}
export interface 详情按钮 {
  键: string; 文案: string; 外观: '主要' | '次要' | '危险';
  禁用说明: string | null;
  执行: (() => void) | null;
}
export interface 详情动作卡信息 {
  键: string; 标题: string; 说明: string | null;
  正文?: ReactNode; 按钮们: readonly 详情按钮[];
}
export interface 事实问题属性 {
  问题: string; 草稿: string; 改草稿: (value: string) => void;
  提交: 详情按钮;
}
export type 详情底栏信息 =
  | { kind: '输入'; 占位: string; 值: string; 改变: (value: string) => void; 发送: (() => void) | null; 禁用说明: string | null }
  | { kind: '只读'; 说明: string };
export interface 终局区信息 {
  摘要: { 结束语: string; 原因: string; 定格于: string } | null;
  移交: { 说明: string; 开始私聊: 详情按钮 } | null;
}
```

导出具名组件 `详情外壳(props: 详情外壳属性)`、`详情顶栏({信息,返回})`、`详情状态区({信息}: {信息: 状态区信息})`、`详情动作卡({信息}: {信息: 详情动作卡信息})`、`事实问题卡(props: 事实问题属性)`、`详情底栏({信息}: {信息: 详情底栏信息})`、`终局区({信息}: {信息: 终局区信息})`。返回类型由 JSX 推导。按钮只有 `执行!==null && 禁用说明===null` 才可触发；否则真实 disabled，说明可见且可访问。底栏已发送的在飞锁归控制层，不能只靠 disabled DOM。

### B. 阶段和资料

`从P5到详情顶栏(view: P5详情正常视图): 顶栏信息`、`从P5到详情状态(view: P5详情正常视图): 状态区信息`、`从P5到详情分段(view: P5详情正常视图, currentStage: P5阶段): 分段项[]` 定义于 `详情展示映射.ts`。P5 类型的精确来源为 `src/数据/MatchCase展示映射.ts`，分段项来源 `src/组件/阶段对话流.tsx`。阶段投影不绑定动作和 PDF 回调，调用方仅给对应段设置 `尾部`、默认展开；不从展示文案推 currentStage，来自 raw `detail.state.stage`。

Mock 分段继续用现有映射算法（同角色消息、种子小结和归约结果），最终产物同为 `分段项[]`，在 Task 2 删除重复阶段流 JSX。`分段项` 新增可选 `展示标题?: string` 默认使用原 `阶段`，从 P5 `区.标题` 传入；颜色/顺序仍用原 `阶段`。不改所有消费者的阶段命名。Mock 取自已有状态的标题、分数等在连接层构造 `顶栏信息`，禁止在 mapper 内读 fixture 或 Context。

```ts
// 类型.ts，资料区自己的输入；只为本页当前字段服务。
// 对齐行：type import，来源 src/数据/匹配对齐.ts；实施时相对本文件解析模块路径。
export interface 职位资料信息 {
  摘要: { 职位: string; 城市: string; 薪资: string; 技能: readonly string[] } | null;
  分析: { 分: number | null; 行们: 对齐行[] | null; 文案: { 墨句: string; 灰句: string } | null };
  职位详情: readonly string[] | null;
  职位要求: readonly string[] | null;
  公司: {
    名称: string | null; 字标: string | null; 简介: string | null;
    元行: readonly { 标签: '融资阶段' | '规模' | '行业' | '成立' | '地址'; 值: string | null }[];
    标签: readonly string[] | null;
  };
  对接人: { 姓名: string | null; 职务: string | null; 字标: string | null };
  接口缺口说明: string | null;
}
```

`职位资料({信息,公司详情}: {信息: 职位资料信息; 公司详情: 详情按钮})`；`从P5到职位资料(view: P5详情正常视图): 职位资料信息`。P5 信息保持摘要已知，其余未提供字段 null，五个公司元行始终存在，接口说明为“当前在谈详情数据未提供”。null 表示缺失；空数组显示“暂无…”；不得用默认具体公司/分析补值。Mock 从现有取在谈岗位详情、匹配对齐和公司档案查询结果在连接层构造同形，空值同规则。

在线简历正文的兼容接口：把现有 `简历正文` 的 props 抽成具名 `在线简历正文属性`，保留 `档`、`真名`、`已确认`、`薪资结论`、`对齐行们`、`求职状态` 的既有名称及非空分支类型，只有 `档` 扩为 `匿名简历档 | null`，新增 `完整布局?: boolean`（默认 false）、`缺失说明?: string | null`（默认 null）。`匿名简历档` 现有类型位于 `src/数据/企业端模拟数据.ts`，新展示只能 type import，不能导入表或值；允许将纯类型原样迁入 `类型.ts` 并旧路径 type re-export，但不得重建第二种完整简历模型。`在线简历正文(props: 在线简历正文属性)` 在 `src/组件/在谈详情/在线简历正文.tsx` 导出；旧 `匿名在线简历.tsx` 导出 `简历正文` 为兼容包装且不放第二份正文 JSX。两种来源的详情均传 `完整布局=true`；Backend 当前传档 null，不构造空假简历；旧独立页面不传开关，保持原行为。缺失时各区在同一组 JSX 中处理 null，不能顶层 `if (!档) return <另一整页>`。

### C. 控制接口

控制所需 P5 类型来源保持 `src/数据/招聘数据源/MatchCase.ts`、`src/状态/后端/类型.ts`、`src/数据/MatchCase展示映射.ts`；这些生产模块不扩 wire/状态 schema。

`use后端详情动作` 的输入为 `{role: P5角色; caseId: string; 视图: P5详情正常视图; 详情: P5详情; 操作: Pick<应用操作,'回答事实'|'决定S0'|'决定S1'|'决定S2'|'决定S3'|'提交简历'|'准备候选委托简历'>; 回答在飞表: RefObject<Map<string,Promise<void>>>}`。返回 `{卡片们: readonly 详情动作卡信息[]; 事实问题: 事实问题属性 | null; 简历选择: 简历选择属性 | null; 披露确认: 确认属性 | null; 终结确认: 确认属性 | null}`。

`简历选择属性` 与 `确认属性` 均定义并导出于 `src/组件/在谈详情/类型.ts`（Task 5 交付，即便当时 S1 值仍为 null 也先声明完整合同），控制 hook 与展示组件从该文件 type import，展示不得反向 import 控制模块。`确认属性` 使用 `React.ComponentProps<typeof 确认层>` 的类型别名（组件来源 `src/组件/确认层.tsx`），控制模块可 type import；确认层只接收已有 props。`简历选择属性` 定义为 `{职位名:string; 文件们: readonly {键:string; 文件名:string; 状态文:string; 禁用说明:string|null}[]; 选中键:string|null; 选择:(key:string)=>void; 取消:()=>void; 确认:详情按钮}`，展示不持 BFF 文件。控制层维护键到原 `{file_id,file_version_id,displayName}` 选择的映射，使用既有 `从附件行取选择值`，不得以文件名作身份。

`useCasePDF预览({role,caseId,读取}: {role:P5角色; caseId:string; 读取:应用操作['读取简历PDF']})` 返回 `{预览:{文件名:string;地址:string}|null; 打开:(文件名:string)=>Promise<void>; 关闭:()=>void}`。只 Backend 使用此 hook；Mock 使用原仿真文件预览控制。共用阶段流和预览层的外壳/关闭呈现，真实 PDF 字节与 Mock 仿真纸身仍使用不同内容 renderer，不能把两种内容混为同一数据能力。

`use后端详情控制({role,caseId}: {role:P5角色;caseId:string})` 始终挂载，只负责读取/轮询/叮嘱/映射和稳定回答在飞表，不调用 `use后端详情动作` 或 `useCasePDF预览`。返回明确联合：`{kind:'不可用'; 状态:'加载'|'失败'|'契约错误'; 说明:string; 重试:(()=>void)|null}` 或 `后端正常资源`。控制模块导出以下内部资源类型（不放展示目录），只供正常控制组件消费：

```ts
// 既有类型与组件接口的源文件见 A/B/C；类型导入在实际文件内解析。
export interface 后端正常资源 {
  kind: '正常';
  顶栏: 顶栏信息; 状态: 状态区信息; 分段们: 分段项[];
  职位资料: 职位资料信息; 底栏: 详情底栏信息; 终局: 终局区信息;
  刷新错误: string | null; 重试: () => void;
  当前段引用: RefObject<HTMLDivElement | null>;
  动作输入: Parameters<typeof use后端详情动作>[0];
  PDF输入: Parameters<typeof useCasePDF预览>[0];
}
```

`src/屏幕/详情控制/后端正常详情.tsx` 导出 `后端正常详情({资源}: {资源: 后端正常资源})`，只在正常联合成立时挂载；内部无条件调用动作与 PDF hooks，组装其结果为 A/B 纯展示 props、动作卡和弹层，不把 raw `动作输入` 交给展示层。这只是搬移原 `详情主体/阶段动作区` 的连接职责，不新增 facade。

生命周期固定：主体会话范围的 route 实例持有 `use后端详情控制`；正常控制子组件按 role/case key 重挂载，自己持 Tab/选项/弹层 UI。`回答在飞表` 只在父读取控制 hook 内创建，通过 `动作输入` 传入，因此同会话跨 Case 或正常→错误→正常不会重建。主体/会话换代时整个父实例重置并回收下层资源，不能只用 caseId 作为账号边界。正常子组件内动作/PDF hook 顺序固定；初次加载绝不以假非空视图调用动作 hook，render 也不回写父状态。Task 5/7 先在原正常控制子组件内调用，Task 9 再把该组件移入上述文件，禁止改成条件调用 hooks。


## 测试选择与最终责任

1. **要防的失败/边界：** 展示重复、缺失收行、假分数/假成功、错误当缺失、角色泄漏、Case 切换/Tab 切换丢锁、PDF 迟到泄漏、共享消费者样式回归。使用现有 P5 组件测试保护动作，新增无 Provider 展示测试保护结构。
2. **最小反馈命令：** 每 Task 指定 `npm test -- <准确路径>`；首次依赖不在时 `npm ci`（不更新 lockfile）。代码中含 TS 接口改变即补 `npm run typecheck`。每 Task 的 red 必须因预期新行为/缺组件失败，而非缺依赖或配置错误；green 后提交本 Task 明确文件。
3. **提前真实边界验证条件：** 纯展示和原控制搬移先用既有 P5 HTTP/组件测试验证。若出现无法由现有测试证明的实际 cookie、PDF 字节、角色授权或后端版本问题，在 final gate 前调查来源并确认可用环境；不可假借本任务改协议。确需提前真实验证时按用户新批准范围执行，不无条件等到收尾才发现环境缺口。
4. **确认前最终权威验证：** `npm run typecheck`、`npm run lint`、`npm test`、`npm run build`、`npm run test:e2e:data-source`、`npm run test:e2e`、`npm run ui:check`。当前仓库无 affected runner；共享阶段流/简历正文使全套既有回归有依据。定向已被全套覆盖时最终只跑权威完整入口，不再重复定向。review 修复只补失效项。失败不能以改阈值、接受全部截图或改标签消除；既有失败必须有基准证据，不能无证据称历史问题。
5. **已有证据/成本：** 规划只读了源码、Spec 和相关测试，未跑产品测试/浏览器，依赖安装情况和耗时未知。11 Task 的最后两个分别承担确认前完整验证/peer review 和确认后的合入/真实 local；不是两轮完整测试。

L3 集成责任：required，`docs/dogfood/真实后端行为验收.md` 的 H01 happy 中双角色在谈详情相关节点，以及同指南 H03 p5 的真实失败场景（现场合同不提供合法 Case 时记 BLOCKED）。只记录实际完成的节点，不声称完整 H01/H03 通过；其他 B/H 项 NOT_RUN。用现有 `agent-browser` 与后端 fixture 入口，先核验目标 URL、后端工作区、专用账号/OTP 安全来源、acceptance 健康和权限。缺输入在实施 Task 10 前提前询问，规划 prompt 不猜或携带秘密。真实写入只走 UI，准备/清理走既有 fixture receipt；共享测试资源不得与列表任务并发变更。

## Task briefs

### Task 1: 共用外壳、顶栏与 Tab

目标：三条现有 route 连接均用同一详情外壳，正常 Backend 出现两个 Tab。非目标：迁移阶段动作和实现完整资料正文。

文件：Create `src/组件/在谈详情/类型.ts`、`详情外壳.tsx`、`详情外壳.module.css`、`详情顶栏.tsx`、`详情外壳.test.tsx`；Modify `src/屏幕/在谈详情.tsx`、`候选详情.tsx`、`P5/MatchCase详情.tsx` 及各自 `.test.tsx`。Create `src/数据/详情展示映射.ts`、`详情展示映射.test.ts`（先仅顶栏函数）。依赖：批准基线和 Global Constraints；生产契约 A 的外壳/顶栏与 B 的顶栏 mapper。

- [ ] 阅读三入口和 CSS，记录 Mock 完整数据截图/现有样式位置；只读检查列表任务是否已合入 `候选头行` 可选参数，未合入不引用该参数。把本 Task 文件纳入 task intent。
- [ ] 写无 Provider 外壳测试：两端各两个 Tab、点击只发 `切Tab` 回调，资料/进度唯一挂载；招聘端不显示 alias/姓名，缺年限等仍占位，真实分数 0 保留；右侧无 NaN。
- [ ] 运行 `npm test -- src/组件/在谈详情/详情外壳.test.tsx src/数据/详情展示映射.test.ts` 取得预期 red。
- [ ] 以 Mock 外壳 CSS 为基准实现 A；右侧未知分不用列表任务的未发布分数组件。招聘头行复用现有组件的文字 props，性别未知在详情本地同尺寸标记，不复制头行。已有共享可选参数若已进入精确实施提交则使用它。
- [ ] 三入口正常内容替换共同壳，连接层持有 Tab；换 Case/角色重置。尚未迁移的子内容可传入指定槽位但不能再带第二层返回栏/Tab/滚动壳。Backend 错误路径保持原样，不调用合法顶栏 mapper。
- [ ] 上述测试 green，执行 `npm test -- src/屏幕/在谈详情.test.tsx src/屏幕/候选详情.test.tsx src/屏幕/P5/MatchCase详情.test.tsx` 与 typecheck；提交 `refactor: share match case detail shell`。

完成：实际两模式共用壳，Tab 不改路由且错误无虚假详情。停止：必须修改共享头行而对方正在编辑时先解决精确依赖，不编造接口。剩余资料槽临时内容只到 Task 3/4，最终不允许一句缺失代替全页。

### Task 2: 共用阶段投影、状态区与详情 CSS

目标：两端同一阶段流、P5 状态/标题不丢，详情解除对列表 CSS 的依赖。依赖 Task 1 契约 A/B；非目标：改协议映射、重写轮询或阶段状态机。

文件：Create `src/组件/在谈详情/详情状态区.tsx/.test.tsx`；Modify `src/组件/阶段对话流.tsx/.test.tsx`、`src/组件/在谈详情/详情外壳.module.css`、`src/数据/详情展示映射.ts/.test.ts`、三条详情 `.tsx/.test.tsx`。不编辑 `P5/MatchCase列表.module.css`。

- [ ] 从现有 `段内对话` 和分段构造搬出 B 的纯 mapper；写测试：S0消息→旧timeline→叮嘱的既有顺序、候选私有总结不入招聘端、四阶段不缺段、pending 的待推进文案、动作段 passed 仍能展开、真实待办/注意徽标及轮次保持，Mock 无轮次显示缺失。
- [ ] 执行 `npm test -- src/数据/详情展示映射.test.ts src/组件/阶段对话流.test.tsx src/组件/在谈详情/详情状态区.test.tsx` 取得 red。
- [ ] 增加兼容可选 `展示标题`，颜色及排序仍用 `阶段`。控制层把动作 ReactNode 仅挂到合法当前段，纯投影不含命令。空消息有中性说明，不造对话；不把将来阶段显示为接口缺失。
- [ ] 将 P5 详情用到的徽标/空态/错误/状态样式迁入详情自己的 CSS，逐个替换 import/class；列表 CSS 不删除不回写。三详情的流共享同一渲染链，去掉重复 JSX。
- [ ] 测试 Tab 切回进度仍可定位当前段，正常换 Case 不沿用折叠状态；运行前述命令及 `npm test -- src/屏幕/P5/MatchCase详情.test.tsx src/屏幕/P5/MatchCase历史.test.tsx`，typecheck green 后提交 `refactor: isolate detail stages and styles`。

完成：`rg 'MatchCase列表.module.css' src/屏幕/P5/MatchCase详情.tsx` 无匹配；既有 S0消息/附件入口测试仍通过。若标题更改导致旧命名断言失效，只改展示契约断言，不删角色隔离测试。

### Task 3: 共用职位资料 Tab 与完整缺失区

目标：求职 Mock/Backend 都显示 Spec §3.3 全部区块。依赖 1–2；生产 B 的职位资料组件/mapper；非目标：Company/Job/P4 查询和独立职位详情改版。

文件：Create `src/组件/在谈详情/职位资料.tsx/.module.css/.test.tsx`；Modify `src/数据/详情展示映射.ts/.test.ts`、`src/屏幕/在谈详情.tsx/.test.tsx`、`src/屏幕/P5/MatchCase详情.tsx/.test.tsx`。默认不改 `公司区块` 和 `匹配分析块`；只以显式资料/props 复用。需搬移原 `在谈详情.module.css` 的资料样式时仅删无人消费规则。

- [ ] 读取 `职位详情Tab`、`取在谈岗位详情`、`公司区块` 和匹配分析输入。Mock 所有静态查询移到连接层；新组件无运行时模拟数据 import。
- [ ] 写 red：P5 缺资料时匹配分析/JD/要求/公司五元行/标签/对接人全部有标题或标签及缺失；0 分有效，部分公司字段保留已知部分；空数组与 null 文案不同；无资料不发公司导航。同一已挂载组件 rerender 公司/对接人有值→合法空值时，文字/图位变缺失、导航禁用且旧回调不再执行；空值→有值再次可显示新值。
- [ ] 运行 `npm test -- src/组件/在谈详情/职位资料.test.tsx src/数据/详情展示映射.test.ts`。
- [ ] 实现 B，缺分或证据时在同一分析区给缺失说明，不传伪造数给旧分析组件。公司显式 `资料` 和中性自定义 `标志`，避免静态 fallback；公司入口禁用与原因在本页展示，不改变其他消费者。
- [ ] Backend 只投影冻结摘要和合法缺失，Mock 投影现有正文/公司/对接人；共用 `职位资料` 替换旧 Tab。请求监控断言 Tab 切换零新增组织/推荐/岗位请求。
- [ ] green 后执行 `npm test -- src/屏幕/在谈详情.test.tsx src/屏幕/P5/MatchCase详情.test.tsx src/屏幕/职位详情.test.tsx src/屏幕/岗位详情.test.tsx`，typecheck；提交 `refactor: share case job details with missing fields`。

完成：Backend 可查看完整第二 Tab，已知职位事实不丢，Mock 缺对接人也保留空区；如果需新增 API 才能实现内容则停止，不突破 Spec，用约定缺失。

### Task 4: 共用在线简历正文及缺失区

目标：招聘 Mock/Backend 第二 Tab 共用正文，保护独立匿名简历默认行为。依赖 1–3；生产 B 的正文兼容接口；非目标：解析 PDF 填字段或扩大 detail candidate_summary。

文件：Create `src/组件/在谈详情/在线简历正文.tsx/.test.tsx`；Modify `src/屏幕/匿名在线简历.tsx/.test.tsx`、`匿名在线简历.module.css`（仅本页显式完整布局样式）、`src/屏幕/候选详情.tsx/.test.tsx`、`src/屏幕/P5/MatchCase详情.tsx/.test.tsx`。

- [ ] 读取现有 `简历正文` props 和所有调用方，写默认兼容及 `完整布局=true` tests。断言画像/匹配依据/个人优势/期望/工作/项目/教育/技能/页尾均在；null 不显示假薪资一致性、姓名、年龄和旧人像。
- [ ] 执行 `npm test -- src/组件/在谈详情/在线简历正文.test.tsx src/屏幕/匿名在线简历.test.tsx` 得 red。
- [ ] 提取唯一正文，逐区处理空对象/空数组；`档` 缺失时仍走同一渲染顺序，分数和分析不填 0；空项目保留标题仅由完整布局开关控制。保留旧导出包装、旧默认及 CSS，不把后端 null 造为完整 Mock 档案。
- [ ] Mock 连接层完成已有公司实名显示规则/匹配计算的资料准备；Backend 档 null、缺失说明明确。严格保留现有披露语义：null 不自动变“尚未披露”，Case PDF 已披露不生成结构化简历。
- [ ] 删旧正文重复 JSX；green 后运行 `npm test -- src/屏幕/候选详情.test.tsx src/屏幕/P5/MatchCase详情.test.tsx src/屏幕/匿名在线简历.test.tsx` 与 typecheck；提交 `refactor: share case resume presentation`。

完成：旧匿名简历页面默认无新增占位，详情模式所有区块存在；若发现旧默认必须改变才能共享，先通过薄适配保留，不顺便改其他页面。

### Task 5: S0 事实问题、结束初筛与动作展示边界

目标：开始从 P5 阶段动作区移出控制，S0 卡真正纯展示。依赖 1–4；生产 A 动作卡/事实问题、C 动作 hook 的 S0 部分。非目标：改动作允许矩阵。

文件：Modify `src/组件/在谈详情/类型.ts`（补齐 C 的两个导出类型）；Create `src/组件/在谈详情/详情动作卡.tsx/.module.css/.test.tsx`、`事实问题卡.tsx/.test.tsx`、`src/屏幕/详情控制/use后端详情动作.ts/.test.tsx`；Modify `src/屏幕/P5/MatchCase详情.tsx/.test.tsx`。hook 在后续 Task 补入 S1/S2/S3，同一返回合同不变；未迁移卡继续由旧控制暂时提供，禁止同一 action 双挂载。

- [ ] 阅读原 `respond_fact/end_screening`、回答在飞表和准备代际。写纯卡禁用/回调测试及控制测试：空回答零请求，promptId 原值、503 保留草稿、成功才清、结束需确认、同 Case 回来时仍在飞不能重发。
- [ ] 执行 `npm test -- src/组件/在谈详情/详情动作卡.test.tsx src/组件/在谈详情/事实问题卡.test.tsx src/屏幕/详情控制/use后端详情动作.test.tsx` 得 red。
- [ ] 使用 C 输入完成 S0 分支搬移。动作 hook 仅在原正常详情子组件无条件调用（Task 9 迁为 `后端正常详情`）；稳定父路由/读取控制持有回答在飞表，传入动作 hook；动作 UI 重挂载不重建表。命令调用参数与旧实现逐项对照，回调不能捕获已经换掉的 Case 继续更改新草稿。
- [ ] 已提供但本次禁止的动作使用 null 回调/禁用说明；未知动作/非法状态继续由原 decoder 拒绝，不画所有未来动作。保留动作标题/说明和原确认语义。
- [ ] 前述测试 green 后运行 `npm test -- src/屏幕/P5/MatchCase详情.test.tsx src/状态/后端/MatchCase操作.test.ts`、typecheck；提交 `refactor: separate screening action control`。

完成：S0 展示无 raw/操作接口，旧 S1–S3 暂存不重复执行；跨 Case 的在飞回归必须通过，否则不能因其“只是重构”跳过。

### Task 6: S1 选择、披露确认与递交控制

目标：共用文件单选和业务动作卡，文件版本与披露闭环保持。依赖 1–5；生产 C 的 S1 返回值及 `简历选择层(props: 简历选择属性)`；非目标：改附件库管理或新授权机制。

文件：Create `src/组件/在谈详情/简历选择层.tsx/.test.tsx`；Modify `src/屏幕/详情控制/use后端详情动作.ts/.test.tsx`、`src/屏幕/P5/MatchCase详情.tsx/.test.tsx`、两 Mock 详情 `.tsx/.test.tsx`（其已有递交动作/弹层接同一展示组件）。复用 `附件简历选择层.module.css`，不更改其默认规则。

- [ ] 写 red：多文件按服务端顺序、单选不默认授权、取消/Esc/遮罩零提交；同名不同版本保持坐标，显示解析状态；replace/invitation/retry 分别用原动作和绑定文件；招聘通过/不合适需原条件。
- [ ] 执行 `npm test -- src/组件/在谈详情/简历选择层.test.tsx src/屏幕/详情控制/use后端详情动作.test.tsx`。
- [ ] 控制层用既有准备附件操作与 helper 建立 `键→真实文件版本` 映射；选择视图只接文件名/状态/禁用原因，选定后新建本次 Case 披露确认。copy 保留冻结职位和所选文件，consent 字面 true 只在确认动作发出。
- [ ] 搬移 accept/decline/retry/replace/decide_resume_screening；保留原锁、过时响应与失败提示，不重写状态机。Mock 原型选择仅把其本地选项映射给同一展示，不调用真实附件库；Mock 特有确认文案由控制提供。
- [ ] 删被替代的 P5 `S1简历选择层` 及 S1 JSX；green 后运行 `npm test -- src/屏幕/P5/MatchCase详情.test.tsx src/屏幕/在谈详情.test.tsx src/屏幕/候选详情.test.tsx src/组件/附件简历选择层.test.tsx` 与 typecheck；提交 `refactor: share resume submission controls`。

完成：真实 file_id/file_version_id 不由展示推断，授权永不跨 Case/重试复用。若现有 Mock 没有多附件能力，不新增模拟附件库，只复用它已具备的单项确认界面。

### Task 7: Case PDF 预览控制与资源回收

目标：PDF 租约与展示分离，阶段附件位一致。依赖 1–6；生产 C 的 `useCasePDF预览`；非目标：把仿真简历渲染器转换成真实 PDF 或预取文件。

文件：Create `src/屏幕/详情控制/useCasePDF预览.ts/.test.tsx`；Modify `src/屏幕/P5/MatchCase详情.tsx/.test.tsx`。原 `原始PDF层` / `简历预览层` 默认行为不改；共同弹层壳已有机制直接复用，不新建媒体框架。

- [ ] 从 `详情主体` 搬移租约/ref/代际逻辑前写 red：连点单请求，S1 有时间线时附件入口仍在，双角色读各自 role/case；关闭/卸载/换 Case 回收，迟到成功立刻回收，迟到失败不向新页提示。
- [ ] 执行 `npm test -- src/屏幕/详情控制/useCasePDF预览.test.tsx src/屏幕/P5/MatchCase详情.test.tsx`。
- [ ] 实现 C 的 PDF hook，revoke 幂等且只处理自己租约，caseId/role 变化立即清预览和在飞引用。租约不能写全局缓存。Mock 留在原文件预览控制，Backend 不导入 Mock 原件。
- [ ] PDF hook 仅在正常详情子组件无条件调用，Task 9 迁入 `后端正常详情`，不从始终挂载的读取 hook 条件调用。正常详情用 hook 状态渲染现有 `原始PDF层`，关闭回调直接回收。Tab 切换不能卸载 hook 或让在飞租约无人回收；无 typed 附件时不从本人附件库猜文件，也不出现真实下载入口。
- [ ] 前述测试 green 后 typecheck；提交 `refactor: isolate case pdf preview lifecycle`。

完成：现有 P5 PDF 全部回归通过，生产模块无额外 content 请求；停止：任何需要扩大 PDF 授权范围的方案不属于本任务。

### Task 8: S2/S3 共用决策卡与 Mock 剧情连接

目标：两端两种来源共享协调和意向确认卡的展示，保持不同业务控制。依赖 1–7；消费 A 动作卡和 C 动作 hook；非目标：统一 Mock 与 Backend 的状态机或新增规则写入。

文件：Modify `src/屏幕/详情控制/use后端详情动作.ts/.test.tsx`、`src/组件/在谈详情/详情动作卡.tsx/.test.tsx`、三条详情 `.tsx/.test.tsx`；原 `拿不准弹层` 只在原型控制下保留，不全站改行为。

- [ ] 写 red：S2 使用当前 issueId 且本端未决才提供决定，S3 未决才确认/婉拒；成功依赖权威重读，失败无本地推进。Mock 接受/退出/终止/确认仍派发原动作和规则入口，不能发 P5。
- [ ] 执行 `npm test -- src/屏幕/详情控制/use后端详情动作.test.tsx src/屏幕/在谈详情.test.tsx src/屏幕/候选详情.test.tsx`。
- [ ] 搬移 typed S2/S3 判断到动作 hook，投影 A 的具体卡标题、说明、正文和按钮；Mock 原有协调事实/决定展示同组件，正文槽只包含事实块，不传整份原决策卡。
- [ ] “拿不准/记成规则”原型可用时继续本地行为；相同区域 Backend 保留相应入口的禁用原因“暂不支持记成规则”，无 rules mutation。无当前动作不提前挂未来按钮。
- [ ] 删除三页旧 `协调决策卡/意向确认卡` 展示和 P5 控件 switch 的剩余 S2/S3 JSX，确认同语义按钮仅一套 renderer。green 后运行 P5 详情/操作测试及 typecheck；提交 `refactor: share coordination and intent cards`。

完成：已提供但不可用按钮能解释，未提供动作不凭 stage 生成；不接受以删取消/拒绝分支来简化卡片。

### Task 9: 叮嘱、终局、移交与正常控制收口

目标：所有 Backend 接线从展示移出，正常/不可用联合完整，Mock 终局也只读。依赖 1–8；生产 A 底栏/终局区、C 后端详情控制。非目标：新增会话坐标或更改轮询节拍。

文件：Create `src/组件/在谈详情/详情底栏.tsx/.test.tsx`、`终局区.tsx/.test.tsx`、`src/屏幕/详情控制/use后端详情控制.ts/.test.tsx`、`src/屏幕/详情控制/后端正常详情.tsx/.test.tsx`；Modify 三详情 `.tsx/.test.tsx`、详情映射和自有 CSS。共享 `真输入条` 可用现有 props时直接使用；若需禁用则本页外层使用只读区域，不全站修改默认行为。

- [ ] 写 red：正常 Case 叮嘱失败不伪造回执；终局显示只读底栏且无可执行发送；pending 私聊禁用且继续轮询，ready 只使用合法 conversation_ref；Tab 不改变发送 Case；角色/账号变更销毁弹层与原草稿。同一 Case 刷新合法可空字段由有值→null/空数组后显示新缺失态，不残留旧附件入口或旧执行回调；仅采用 decoder 接受的输入，不给 P5 添加公司字段造样本。公司/对接人刷新过渡由 Task 3 无 Provider rerender 覆盖。
- [ ] 执行 `npm test -- src/组件/在谈详情/详情底栏.test.tsx src/组件/在谈详情/终局区.test.tsx src/屏幕/详情控制/use后端详情控制.test.tsx src/屏幕/详情控制/后端正常详情.test.tsx`。
- [ ] 搬移既有 scope 登记/退出、读取、轮询、叮嘱与错误处理到控制 hook；读取 hook 正常分支返回 C 的 `后端正常资源`，外层 route 只按 kind 选择错误/加载或 keyed `后端正常详情`；后者无条件调用动作/PDF hooks 再组装 A/B/C 纯展示，不把错误变成正常缺失。稳定在飞表不能随正常区卸载而丢失；按 C 的生命周期边界组织。
- [ ] 非终局禁用由已有刷新/动作保护表达；terminal 为只读，正常摘要字段不丢；Mock 只读判断消费其已有完成/归档事实，不把“进入意向确认阶段”当作已完成。
- [ ] 全仓核对详情新展示 import，禁止 use应用状态/BFF raw/fixture/路由。允许受控组件内部 Tab/折叠状态；清除重复 CSS/模式分支、遗留不可达 Backend 判断和未使用 import，仅限本范围。
- [ ] green 后运行 `npm test -- src/屏幕/P5/MatchCase详情.test.tsx src/屏幕/在谈详情.test.tsx src/屏幕/候选详情.test.tsx src/屏幕/P5/MatchCase历史.test.tsx src/状态/后端/MatchCase操作.test.ts`、typecheck；提交 `refactor: complete shared detail control boundary`。

完成：`详情主体` 不再把 raw 快照/整个应用操作传进 UI，正常/失败交替不违反 hooks 顺序；所有阶段功能仍可用。发现必须改 P5 全局状态 schema 则停止说明，不扩展方案。

### Task 10: 跨模式布局、完整回归与实施 peer review

目标：证明整体按 Spec 交付而不是仅完成组件拆分。依赖 1–9；输出有效确认前证据和本 Plan 实施记录。非目标：正式 local 集成或合 target。

文件：Modify `e2e/数据源模式.spec.ts`（在现有 P5 fixture/装P5候选/装P5招聘作用域中新增独立 describe，不复制庞大 fixture）；必要时 `e2e/视觉回归/场景.ts`、对应 `.test.ts` 的详情锚点；Create `e2e/详情布局.test.ts`（如需纯几何断言 helper 的单测才创建）。不为拆测试文件先提取全局 fixture 框架。与列表 task intent 预告此公共文件交集，保留另一分支用例。

- [ ] 写 `在谈详情完整布局 @mock/@backend` 定向旅程，390/320px 各端覆盖两个 Tab。Backend 用现有 HTTP fixture 加正常全缺、合法部分空、长正文/状态、终局等样本；缺 P5 不支持的字段不用额外 wire 键塞入。完整/等价数据的共有展示通过同一纯组件在已有浏览器测试工具可达的渲染路径比对；不得因此添加生产调试路由。仅测试服务端真实支持的事实，相同 DOM/CSS 的等价输入另由无 Provider 组件测试钉住。
- [ ] 增加同 Case 可空字段由有值刷新为空的合法 HTTP 样本，断言 UI 占位和入口清理，不放宽 decoder。先运行 `npm run test:e2e:data-source -- --grep '在谈详情完整布局'`，核对两个项目实际选择到用例；每页截图、区块顺序、Tab 切换、scrollWidth≤clientWidth、可点/禁用原因、缺失区仍在。截图存 test-results 或 ui-regression-output，禁止只用组件测试宣布布局通过。
- [ ] 新增/改动旧测试对终局“无输入”断言时改成“只读区域、零发送”，对缺失内容保留位置断言，不删除原零请求、隐私和坐标断言。用现有 P5 HTTP 旅程回归 S0–S3、PDF/移交、列表/历史打开详情；定位器用语义，不锁定旧 CSS 名。
- [ ] 按测试选择节运行确认前完整权威命令并修复范围内失败；更新 Spec 字段缺口表仅限已证实事实。规划/审计文档不算业务测试 PASS；未执行的真实 local 明确 NOT_RUN。核实真实目标 URL/后端工作区/账号来源，缺失时提前询问但继续可完成的本地工作。
- [ ] 调用本宿主异构代码 review-loop：Codex→Claude，Claude→Codex；固定实施 base/head、批准 Spec 版本、用户 Task 数覆盖和有效测试 evidence；reviewer 只读不跑测试。逐项核实 required/optional，最多三轮；拒绝无当前依据的泛化建议。修复只补失效证据，review 记录写本 Plan。
- [ ] 所有适用确认前测试有效、无未解决有效 required 后，提交 `test: verify shared detail layout and behavior`，记录具体 SHA/命令/结果/截图与剩余真实环境责任。

完成：不可把 HTTP fixture 写成真实 local PASS；如果依赖列表共享参数尚未落基线，记录实际局部方案并在 final gate 同步后清理重复标记，不能假设不存在冲突。

### Task 11: Final gate、真实 local 验收与合入

目标：同一实施执行者完成可审阅确认、必要真实验收、普通合入；依赖 1–10。文件：本 Plan 实施记录；范围内必要修复；证据沿用 `dogfood-output/<run-id>/`、`test-results/`、`ui-regression-output/`。不新建手写 review/handoff/validation 文档，dogfood 原有报告格式放其证据目录。

- [ ] 完整读取 development-workflow 的 `references/final-integration.md`、`assets/final-integration-contract.md`。只读 fetch，冻结候选与 pre-gate target，核对 task intent/列表分支现状、全部适用确认前证据、review 和真实环境输入。
- [ ] 向用户展示具体候选 SHA、target、命令/截图证据、同步及增量复验方案、H01/H03 选中节点/准备清理方案与普通 push；等待对本方案的明确确认。批准 Spec/Plan 不等于批准合入。确认前不 merge target、不正式 L3、不 push。
- [ ] 确认后 fetch，记 final_target_base，`git merge --no-edit origin/main`（不 rebase 已审查候选），重算输入依赖/配置/fixtures/共享 CSS 的影响。基准未变复用有效证据；已变仅补失效/新增责任，证明不了有效性就补验，不重复无变化的全套 gate。
- [ ] 检查列表已合入的候选头行未知参数，按 Spec §9 使用并删除临时局部性别标记；参数未出现继续本页局部标记，不从未验证分支 cherry-pick；共享阶段流、独立简历默认和列表→详情导航有有效回归。发现产品契约变化停止重新设计，不私自修改批准底线。
- [ ] 按测试选择节的 required local 执行 agent-browser dogfood；当前 CLI/后端文档核验后用已有 receipt 生命周期准备、verify、UI 操作、cleanup。记录双角色详情两 Tab、四阶段/允许动作、S1 PDF和隐私、pending/ready、失败显示的实际节点和 NOT_RUN。缺后端 scene/权限/安全账号或工具无法满足记 BLOCKED，不以 mock 替代。
- [ ] dogfood 取证期间遵守指南不边观察边改代码；产品失败先留证、清理本轮资源，再回实现修复，review 新候选并补失效验证。禁止准备工具补写被测业务结果。
- [ ] 只清理本任务创建的服务/会话/fixture，不能停列表任务栈或占其测试账号。cleanup 后再次对账证据影响。无有效 required 遗留且证据完整，再 fetch 核对 target 未变；`git push origin HEAD:main` 仅普通 fast-forward。target race/push rejected 不强推，更新方案再确认。
- [ ] 写实际合入 SHA、证据及未执行项，task intent completed；若未 push 成功不得宣称已合入。用户不批准则保留候选和完整证据等待，不清理他人工作。

## Spec 覆盖与自检

§1–2 展示/控制边界：1、2、5–9；§3.1 顶栏/Tab：1；§3.2 阶段：2；§3.3 职位资料：3；§3.4 简历：4；§4 空/缺/错误与披露：1–4、6、9、10；§5 动作/资源：5–9；§6 缺口：3–4、10；§7 非目标：Global Constraints；§8 验收：各 Task 和10–11；§9 并行：Global Constraints、1–2、10–11；§10 交付：本文件及后续 prompt。Task 数最新覆盖以批准记录为准。

已自检接口消费/生产、依赖顺序、默认兼容和测试路径。内部 helper 等价组织由实施者决定；不得把可观察行为、公共 props、权限或验证责任留作临时设计。所有新文件只为实际重复或生命周期边界服务。

## 文档 review 记录

首轮：Claude（opus/high，plan 权限），候选 revision `8dceb3cc`，Spec blob `22245cf802b92f867990d9da646b792029822a67`、Plan blob `c9077e52` 前缀；完整指纹存在本轮工具记录。批准契约与 Task 数覆盖见本 Plan header。结果 3 条 required（Important 1、Minor 2），全部核实接受，均不改变批准 Spec：

1. 生命周期返回接口矛盾：接受并修复。读取 hook 不再返回动作/PDF hook 的结果，由正常控制子组件调用；稳定回答在飞表仍归父读取控制，不让正常/错误切换清锁。复杂度影响：降低。
2. 刷新有值→空缺少明确测试分配：接受并修复。Task 3 资料组件 rerender 钉文字/图片/旧回调清理，Task 9/10 钉合法 P5 可空字段的刷新过渡，不造公司 wire 字段。复杂度影响：不变。
3. 两个共享属性类型归属缺失：接受并修复。明确 Task 5 修改展示 `类型.ts`，导出 `简历选择属性`、`确认属性`，禁止展示反向依赖控制模块。复杂度影响：不变。

另由 planner 自检修正文档代码示例的相对 import 写法，改为仓库相对类型来源说明，以通过 prompt 可迁移路径校验。

守约记录：首轮 HEAD/status/受审文件指纹均未改变，未运行测试；但 reviewer 额外读取源码，超出本轮指定的文档及规则范围。该偏差不作为扩大产品范围的授权，三条 finding 均可直接由 Plan/Spec 内容核实；复审明确禁止继续读取源码，仅查两文档及必要规则。第二轮已在同一 reviewer session 复审修复，结果如下。

第二轮：Claude（opus/high，plan 权限），候选 revision `1696db60`、Plan blob `8b3726a5e87fb8e1cd326872734ce7e10461b5f7`，Spec/批准版本不变。报告为 `NO FINDINGS`，3 条 required 全部解除，无新增 finding；复审仅读取冻结文档/diff与合同，未再次越界读源码，未跑测试、未改文件。HEAD/status/文件指纹保护检查通过。文档 review 共 2 轮已收敛；本段仅追加结果，不改变受审实施合同。首轮3条接受修复，0条拒绝，0条 optional 延后，0条未解决 required。

## 实施记录

当前尚未实施，产品测试、截图、真实 local 均未执行。新实施 session 在本节按 Task 追加 commit、验证、peer review 和 final gate 事实，不把未执行项写成 PASS。

### 2026-09-10 · Task 1–10 实施与验收（宿主 Claude Code）

分支 `survey-frequent-pages-component-reuse`（基线 `b93436e9`，即本 Plan 实现基线；target `origin/main`）。每 Task 三角色（implementer / spec reviewer / code-quality reviewer）按本文件角色表执行，两 reviewer 全部通过（0 open Critical/Important）后进入下一 Task；Task 3、Task 10 各有一轮 fix loop 后复核通过。

**Task 提交**（base `6a7fa58b` 为本 Plan 文档 HEAD）：

| Task | Commit | 交付 |
|---|---|---|
| 1 共用外壳、顶栏与 Tab | `2f0e979e` | 详情外壳/详情顶栏/类型.ts/顶栏 mapper，三入口接线 |
| 2 共用阶段投影、状态区与详情 CSS | `3f8d05a6` | 状态/分段 mapper、详情状态区、详情样式脱离列表 CSS |
| 3 共用职位资料 Tab 与完整缺失区 | `0e1fca34`（含 r1 修复） | 职位资料五区块完整缺失布局 |
| 4 共用在线简历正文及缺失区 | `2808cddc` | 在线简历正文唯一化 + 兼容包装 + 九区缺失 |
| 5 S0 事实问题、结束初筛与动作展示边界 | `a851b295` | 详情动作卡/事实问题卡/use后端详情动作（S0） |
| 6 S1 选择、披露确认与递交控制 | `38fd6b25` | 简历选择层、键→文件版本映射、字面 true 仅确认发出 |
| 7 Case PDF 预览控制与资源回收 | `70ef9420` | useCasePDF预览（租约字节级等价搬移） |
| 8 S2/S3 共用决策卡与 Mock 剧情连接 | `b90456dd` | 三屏单一 renderer、Mock 原型派发零 P5、Backend 规则入口禁用 |
| 9 叮嘱、终局、移交与正常控制收口 | `9fe1505a` | use后端详情控制/后端正常详情/详情底栏/终局区；keyed 重挂载；硬清理（死 CSS/过时注释） |
| 10 跨模式布局、完整回归与实施 peer review | `2ddc02f4` | e2e「在谈详情完整布局」7 旅程（390/320px 双端双 Tab，23 截图）；修复 13 条基线既有 P5 e2e fixture 缺解码键失败（b93436e9 对照证据）；终局断言改造 |

**确认前证据**（Task 10）：`npm run typecheck`/`lint`/`build` exit 0；`npm test` 全量绿（3826）；`test:e2e` 4 条与 `test:e2e:data-source` 22 条失败均他域基线既有（final-only=0，逐条对照证据）；`ui:check` exit 1 = 详情场景 Tab 改名的有意结构差（对基线归因运行），基线重采列入 final gate。真实 local（H01 详情节点 + H03 p5）**NOT_RUN**，等用户提供目标 URL/后端工作区/双角色账号与 OTP 来源。

**实施 peer review（异构 Codex review-loop，2026-09-10）**：read-only 三轮，冻结范围 `b93436e9...2ddc02f4`，共用守约 `coding-harness/skills/_shared/review-contract.md`，绑定批准 Spec/Plan 版本（见本文件头部），reviewer 未跑测试。
- Round 1（6 findings）：F1 Tab 可见名称漂移（接受，`76f15cb5` 修复——按端投影 代谈进度/职位详情/在线简历，键 进度/资料 不变）；F2 Mock 无共用状态区（**拒绝**——批准 Plan 契约 B 与第 62/123 行把 Mock 分段留连接层，Task 2 双 review 已就同一问题记录裁定，无新证据）；F3 Backend 求职顶栏公司槽缺失（接受，标题 `职位名 · 公司信息缺失`）；F4 叮嘱草稿不随 Case/账号隔离（接受，主体/角色/单变化代际栅栏）；F5 普通命令迟到失败泄漏（接受，发命令过代际栅栏）；F6 写中禁用无解释（接受，全部带「正在提交，请稍候」）。
- Round 2（1 finding）：回答在飞表仅按 caseId 键、换账号继承锁（接受，`7e1186ae` 修复——主体变化时渲染期替换全新 Map + 提交闭包捕获旧 Map，迟到清理不触新账号表；3 个新测试含 reviewer 精确场景）。
- Round 3：**NO FINDINGS**。修复波验证：npm test 3836 绿、typecheck/lint exit 0、详情布局 e2e 7 passed。

**遗留与 final gate 责任**：origin/main 已领先（列表任务已合入）——final gate 按 final-integration-contract 同步 target、增量重算责任、`候选头行` 未知性别占位 参数收敛本页局部标记；`.superpowers` 工作区部分报告文件曾被提交进分支，final gate cleanup 时 untrack + gitignore；L3 真实 local 验收与合入等用户确认后执行。
