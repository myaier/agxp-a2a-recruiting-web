# 固定 AI 代理入口与受控展示组件实施 Plan

> 新实施 session 使用 development-workflow；Claude Code 在本 Plan 的 4 个 Task 下调用 superpowers:subagent-driven-development，Codex 始终调用 superpowers:executing-plans。只计实施 Task，异构 review 与 final gate 不计数。

**Goal：** 为双端 Backend 补固定 AI 动态行与禁用聊天外壳，并把 Mock 气泡 / 快捷操作 / 简报 / 建议整理为受控展示，保持现有外观与模拟行为。

**Architecture：** 保留各页面的同步模式门和 Backend / Mock 容器，复用已有消息列表、代理标与输入栏；新展示组件只消费内部 props 与回调，真人 P7 域和 Mock 操作均不搬入组件。

**Tech Stack：** React 19、TypeScript、CSS Modules、Vitest / Testing Library、既有 Playwright Chrome 配置，不增依赖。

**Spec：** `docs/superpowers/specs/2026-09-14-agent-session-and-display-components-design.md`。批准内容 revision `c214d8ab648f6ccbd7d0a91ee50711354db67d8d`、blob `3332632638f1f1f93984bc44c6401e692d7435fa`；用户授权 rebase 后事实校准，执行引用校准 revision `b969b267de0cac54dbd68c17c1a7544b67413fa0`、blob `6df343758e71b2921080a1d3ccae7c86286d973b`。校准仅记批准、上游和 fixture 前提，产品行为未改变。

## Global Constraints

- 仓库 `agxp-a2a-recruiting-web`；target `origin/main`；规划集成基线 `1f8c223739deb8fb14fdfba51ca8240f081ab089`，宿主工作区 `.`。执行前核对精确 Git 对象、规则、实际 diff；复用用户选定工作区，不另建第二工作区、不 stash/reset/clean 他人内容。
- 完整读取 `CLAUDE.md`、`AGENTS.md`、批准 Spec 与本 Plan。逻辑 skill development-workflow 的资源按其安装根解析；实施开工读取 `assets/execution-contract.md`，用 `scripts/task_intents.py` 的 help 确认参数后 start 登记；扩大路径前 update 并查重叠。
- AI 行维持 Mock 分类：全部第一条会话行、通知显示、仅会话隐藏；按标题/副标题/摘要做 trim 后包含匹配，搜索不匹配可隐藏。不是 CSS 吸顶，不加置顶状态。
- Backend AI 行：标题“AI代理动态”；副标题“你的求职AI代理”/“你的招聘AI代理”；摘要“聊天暂未开放，可查看代理功能”；时间空、未读无；点击分别导航到 `路径.问AI代理` / `路径.企业问AI代理`。不创建 P7 ID，不注入 P7 快照、不算真人未读、不占分页。
- Backend 聊天页使用既有标题、真实说明、导航与更多入口，增加值为空、提示“AI代理聊天暂未开放”的 `真输入条`，textarea/发送都 disabled。零 Mock 会话、简报、回复、规则 mutation；不可发送，不能先挂 Mock 再隐藏。
- Mock 的 fixture、关键词口径、550ms 延迟、头像 / 薪资读取、退出重入生命周期、规则派发及反馈留在页面。不统一两端放宽行为，不改 fixture 文案 / 统计，不添加清空 / 删除 / 新建 / 持久化 Session。
- 展示组件不 import fixture、Context、路由、API、存储或业务操作；收到新 props 直接更新，不把初值复制为不可更新的 state。不建立 DTO、助手事件枚举、操作状态机、useChat、注册平台或通用适配层。
- 保留实际 CSS 差异：求职气泡收缩/招聘伸展、13.5px/1.45 与 14px/1.7、简报头/时间标/统计差异、求职快捷行横滑/招聘换行。迁移后删无调用的旧 CSS，不为“统一”改变现有像素。
- 不修改真人会话 API/DTO/Provider、其他业务页面、代理详情产品逻辑或全局样式。仅允许下列任务的精确文件。实际所需路径超出时先查调用证据、更新预告；涉及新产品行为或持久化/API范围时停止并修订批准契约。
- 新失败回归只覆盖变更行为；先确认失败原因再实现。简单样式迁移用浏览器对照，不增加大量实现镜像测试。不要把旧的“Backend 无输入 / 无 AI 行”断言保留为新验收要求，也不得删掉真实隔离断言。
- 进度、review 裁决与验收事实写本 Plan；runner 输出使用既有 `test-results/` / `ui-regression-output/`，不另建 handoff 或 review 报告。

## Task index

Task count: 4
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|Backend 固定入口及列表状态组合；无前置实现依赖|Top 5–10（Claude Code: sonnet）；现有列表契约明确|前沿 / 顶级模型（Claude Code: opus）；校验真实集合/本地入口隔离|Top 5–10（Claude Code: sonnet）；防止新增消息平台|
|2|对话展示提取与禁用外壳；依赖 Task 1 入口可达|Top 5–10（Claude Code: sonnet）；局部受控组件|Top 5–10（Claude Code: sonnet）；模式门及禁用交互|Top 5–10（Claude Code: sonnet）；CSS 差异与组件粒度|
|3|受控简报与建议接回 Mock；依赖 Task 2 气泡框|Top 5–10（Claude Code: sonnet）；展示与操作边界固定|前沿 / 顶级模型（Claude Code: opus）；检查模拟成功/状态生命周期|Top 5–10（Claude Code: sonnet）；消除 fixture 耦合与重复|
|4|双端双模式浏览器回归和 P1 消费者校准；依赖 Task 1–3|Top 5–10（Claude Code: sonnet）；复用已存在 HTTP fixture|Top 5–10（Claude Code: sonnet）；核对 onboarding 和网络边界|Top 5–10（Claude Code: sonnet）；最小测试集合与可重复证据|

**计划本身复杂度：中。** 范围为两个消息连接层入口和两端代理页的具体展示，API 不变；列表错误/搜索组合及视觉保持需要整页验证。

**零上下文漂移风险：中。** 风险集中在旧断言含义、上游 onboarding 守卫和两端 CSS 不同；公共边界、反例和现场停止条件均已给定。执行模型只按此风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

## 测试选择与最终责任

1. **防止的失败：** 固定行依赖 P7 成功才出现 / 被分页重复添加 / 污染未读；通知仍空；Backend 可发送或启动 Mock 定时器；组件 props 更新不生效或自称成功；样式迁移改变布局。涉及数据源分支、页面生命周期、受控 props、真实 DOM，不涉及新 SQL/事务。
2. **开发反馈：** 每 Task 给最小 Vitest 命令，Task 4 用既有 Playwright 配置的精确文件/grep。仓库无统一 affected runner，不新增 wrapper。收尾根据实际 diff、消费者重算这些集合；不要跑全部 `e2e/数据源模式.spec.ts` 或整个测试层。
3. **提前验证真实边界：** Task 1 修改产品前保存重构前截图；Task 2/3 在对应控件完成时比较原图，Task 4 验证浏览器输入 disabled 与正确路由。Backend 只用白名单 HTTP fixture，不能绕过 onboarding；若 fixture 被新上游拒绝，修测试前提，不修改产品守卫。
4. **最终权威责任：** 同一实施执行者负责适用完整 L0–L2（本 Plan 的定向单元、类型/lint/build和两模式浏览器），记录源码 SHA、命令、退出码与截图。正式 development L3：`none`，因为不改后端接口、写入、会话发送或持久化；不选 B01–B05/H01–H04、STG Onboarding 或 release-only。若实际 diff 扩展到这些边界，先按 Spec 停止范围扩张，再由批准后的新 selection 决定；不得以 none 掩盖新增责任。
5. **已有证据与成本：** rebase 前 50 条定向单元约 1.23 秒、2 条浏览器约 10.6 秒，只证明旧行为；rebase 后校准单元结果记录在文末。新行为与截图成本未知，不为计时先跑整套。不得把规划旧 PASS 当作实施 PASS；相同有效候选的已覆盖证据可复用，不无条件重复 broad gate。

### Task 1: Backend 消息列表补固定 AI 动态行

目标：无需真人会话也可从全部 / 通知进入代理页；真人列表语义保持。非目标：创建后端 Session、修改 Mock 未读、改共享列表样式。

预期编辑文件：
- 新增：无。
- 修改：`src/屏幕/P7/Backend会话列表.tsx`、`src/屏幕/P7/Backend会话列表.test.tsx`。
- 删除：无。

依赖与输入：读取 `src/屏幕/消息列表.tsx` / `企业消息.tsx` 的角色分流，`消息列表展示/类型.ts` 的 `会话行数据` / `列表提示`，`消息行映射.ts` 的 `从Backend消息行`；现有 `消息列表展示` 接受行数组、前后提示和加载更多。不修改这些公共签名。输入仍为 `后端状态.P7收件箱[role]` 与既有操作，输出仅页面内部组装后的展示数据，无新导出。

固定行构造合同（可直接在连接组件内构造，不新增工厂文件）：键分别 `agent-entry:candidate` / `agent-entry:recruiter`；头像 `{种类:'代理'}`；字段按 Global Constraints；未读 `{种类:'无'}`；`按下`闭包跳对应代理路径。键不会与规范十进制 P7 conversationId 冲突；不使用 fixture X-01/H-01。

组合与状态合同：
- 全部 = 搜索过滤后的固定行（若有） + 已过滤 P7 行；仅会话 = P7 行；通知 = 固定行（若有）。P7 行调用原映射，顺序不动。
- P7 的首读 effect / 范围 / 重试 / 分页不变，通知不显示这些提示和加载更多；固定行不能掩盖真实收件箱错误。
- 无搜索、P7 成功空页：全部 = AI行 + “还没有真人会话”，仅会话 = 同空态，通知 = AI行、无“还没有通知”。
- 有搜索、没有可见行：通知可直接显示既有无匹配提示；全部 / 仅会话在 P7 成功或有缓存时可显示无匹配；首读未完成且无缓存只保留读入/错误，不宣称搜完。错误与缓存无匹配可共存；有 AI 行命中时不出“没有匹配”。
- AI 行在 P7 失败、清空缓存、重试、追加、角色重挂时保持当前角色唯一入口，但仍受页签/搜索约束；固定第一条会话行不要求越过前置错误提示。

实施与验证：
- [ ] 用既有浏览器工具在当前未修改代码基线上启动 Mock Vite（`VITE_DATA_SOURCE=mock VITE_BACKEND_ENV=stg npm run dev -- --host 127.0.0.1 --port 4173 --strictPort`，只复用已核实模式的自有服务）。`http://127.0.0.1:4173/#/app` / `http://127.0.0.1:4173/#/hr` 消息 Tab，以及 `http://127.0.0.1:4173/#/agent` / `http://127.0.0.1:4173/#/hr/agent`；320×844、390×844 保存截图到 `ui-regression-output/agent/reference/`，文件以角色、列表/代理、宽度命名。记录 commit 与 viewport；滚到简报头再截图，另保存快捷行/输入所在底部。此为实际修改前基线，不是新一轮需求调查。不为截图改产品或添加入口。
- [ ] 扩充现有可变状态 harness，按两个角色验证完整/成功空/首读/失败/错误带缓存、页签和搜索；新增断言先失败于 AI 行缺席。既有“通知空”改为正确分类，真实 P7 路由/已读/分页断言保留。
- [ ] 按上述数据流在连接组件内组装入口、过滤与提示，零 P7 数据写入。AI 点击 spy 只收到代理路径，现有派发 spy 为零；P7 点击仍去真人参数路由。
- [ ] rerender 空页→有数据→追加页，验证只有一条 AI 行及真人次序；有 AI 搜索命中且真人零命中时无错误的无匹配提示。切通知时错误提示/加载更多消失，切回恢复。
- [ ] 运行下列命令，预期全部通过；然后提交本 Task 两个精确文件。

```bash
npm run test -- src/屏幕/P7/Backend会话列表.test.tsx src/屏幕/消息列表.test.tsx src/屏幕/企业消息.test.tsx
```

失败反例：构造假的 `human_handoff`；在 `快照.阶段==='成功'` 才插入；每翻页 append 一个 AI 行；通知仍沿用 `行们=[]`；未读跟 Mock 一样给 0 红点。完成条件：上述输入矩阵和导航保持，产品仅列表连接文件改变。需 API/全局状态改动才能实现时停止，不能自行扩大。

### Task 2: 提取对话展示并补 Backend 禁用输入外壳

目标：两端气泡、快捷行复用受控展示，Backend 从固定入口进入完整但不可发送的外壳。非目标：提取简报业务、统一两端像素、开放任何消息发送。

预期编辑文件：
- 新增：`src/组件/问AI代理/对话展示.tsx`、`src/组件/问AI代理/对话展示.module.css`、`src/组件/问AI代理/对话展示.test.tsx`。
- 修改：`src/屏幕/问AI代理.tsx`、`src/屏幕/企业问AI代理.tsx`、`src/屏幕/问AI代理.module.css`、`src/屏幕/企业问AI代理.module.css`、`src/屏幕/问AI代理.test.tsx`、`src/屏幕/企业问AI代理.test.tsx`。
- 删除：无文件；只删本步骤迁移后无使用者的原样式/内联展示。

依赖：Task 1 完成，原始截图存在。输入来自两页容器与现有 `代理标` / `真输入条`。对话列表 map、滚动引用、草稿/发送/定时器仍由页面持有；简报暂留原实现，不因迁移普通气泡提前删其仍使用的 CSS。

生产契约：`对话展示.tsx` 命名导出以下类型和组件，后续 Task 3 使用 `代理气泡框`。参数都是内存 props；外观只选择 CSS。

```ts
import type { ReactNode } from 'react';
export type 代理外观 = '求职' | '招聘';
export type 快捷操作项 = { 键: string; 文案: string; 按下: () => void };
// 导出同名函数组件，以下是其 props 签名，不要求返回类型标注。
// 代理气泡框({外观, 简报=false, children})
export type 代理气泡框属性 = {
  外观: 代理外观; 简报?: boolean; children: ReactNode;
};
// 代理气泡({外观, 内容})
export type 代理气泡属性 = { 外观: 代理外观; 内容: string };
// 我方气泡({外观, 内容, 头像URL, 首字})
export type 我方气泡属性 = {
  外观: 代理外观; 内容: string; 头像URL: string | null; 首字: string;
};
// 快捷操作行({外观, 项们})
export type 快捷操作行属性 = { 外观: 代理外观; 项们: readonly 快捷操作项[] };
```

气泡框负责已有代理行、代理标与气泡外壳，普通文本排版由 `代理气泡` 内的文字容器负责；简报=true 时只求职端采用当前 `.简报气泡` 的全宽覆盖，招聘端保持当前基础气泡宽度。不得额外增加影响 flex 的 DOM 外层。内部两端类合并到新 CSS Module，外观差异按原声明保留。

实施与验证：
- [ ] 把两页测试的 Backend “textbox/发送不存在”改为存在且 disabled；仍断言无 fixture 简报 / 快捷问句 / 模拟回复。先跑下面的两页命令，新增禁用栏断言应失败。
- [ ] 迁移代理气泡、我方气泡、快捷行，Mock 传原发送回调与头像结果；Backend 传现有导航闭包，不共享 Mock state/hook。更多、返回与对话布局仍由页面管理。
- [ ] Backend 消息区保留当前真实说明气泡，不创建消息数组；底部真实导航之后挂 `真输入条`，`值=""`、`占位="AI代理聊天暂未开放"`、`禁用` 为 true，改变/发送使用无副作用回调，不依赖 Mock 发送。复用已有 disabled 实现，不改 `通用.tsx`。
- [ ] 对话展示测试只验证换 props 后文本/头像信息更新、快捷项点击只调用该项回调；组件无需 Provider。页面测试验证 Backend 点击/Enter 无消息或规则副作用；Mock 550ms 正常回复，切 Backend / 卸载确实 clear 所有待回复定时器（用 fake timers / clearTimeout spy，不以 DOM 消失替代清理）。
- [ ] 同视口浏览器对比原图：Mock 普通气泡宽度、长字符串换行、求职快捷横滑/招聘换行、底部输入；Backend 唯一预期空间变化是新增禁用输入。只迁移现有风格；无像素漂移后运行命令并提交本 Task 文件。

```bash
npm run test -- src/组件/问AI代理/对话展示.test.tsx src/屏幕/问AI代理.test.tsx src/屏幕/企业问AI代理.test.tsx
```

失败反例：用 `外观` 决定模式；在 Backend 绑定隐藏的 Mock 发送；disabled 只改变颜色；把招聘 `flex:1` 改成求职的收缩；重新挂载清空用于掩盖 props 不更新。完成条件：两种模式真实消费新展示、Backend 外壳可达但不可发送，Mock 行为不变。若需要改变通用输入公共接口或默认行为，停止检查原因，本 Task 不授权改其它消费者。

### Task 3: 提取受控简报、建议和漏斗

目标：同一组件实例可随展示数据和处理文案更新；Mock 操作由容器负责。非目标：未来结果卡、真实规则提案接线、确认弹层、自动刷新。

预期编辑文件：
- 新增：`src/组件/问AI代理/简报展示.tsx`、`src/组件/问AI代理/简报展示.module.css`、`src/组件/问AI代理/简报展示.test.tsx`。
- 修改：`src/屏幕/问AI代理.tsx`、`src/屏幕/企业问AI代理.tsx`、`src/屏幕/问AI代理.module.css`、`src/屏幕/企业问AI代理.module.css`、`src/屏幕/问AI代理.test.tsx`、`src/屏幕/企业问AI代理.test.tsx`。
- 删除：无文件；删除已搬走的内联简报和无使用者 CSS。

依赖与输入：Task 2 导出的 `代理气泡框` / `代理外观` 必须存在且已接页面。消费 fixture 只在两页容器；`src/数据/模拟数据.ts` / `企业端模拟数据.ts`、`Agent规则提案卡`、`确认层` 不修改。

生产契约：`简报展示.tsx` 命名导出 `简报展示`、`规则建议` 及下列类型。漏斗行、统计项保持文件内 helper。

```ts
import type { 代理外观 } from './对话展示';
export type 规则建议属性 = {
  标题: string; 正文前: string; 数值1: string; 正文中: string;
  数值2: string; 正文后: string; 维持文案: string; 放宽文案: string;
  处理文案: string | null; 维持: () => void; 放宽: () => void;
};
export type 简报统计 = { 名称: string; 数值: string; 强调: boolean };
export type 漏斗展示档 = {
  名称: string; 人数: number; 宽度: number;
  动作: { 说明: string; 按下: () => void } | null;
};
export type 简报展示属性 = {
  外观: 代理外观; 标题: string; 更新时间: string;
  统计: readonly 简报统计[];
  正文前: string; 正文强调: string; 正文后: string; 脚注: string;
  建议: 规则建议属性; 漏斗: readonly 漏斗展示档[] | null;
};
```

原 fixture 的人数/宽度原样传入；不从人数推算宽度。建议组件内部颜色/排版属于简报 CSS；两端建议现有共同声明共用，差异由 `简报展示` 外观容器的局部样式保持。`处理文案===null` 出双按钮，否则显示该文案。外观不参与业务处理。

实施与验证：
- [ ] 用自造 props 编写组件行为测试：render 后 rerender（同 key）变统计 0→12、正文、漏斗人数/宽度及处理文案；依次验证可见内容更新，null 与数值 0 不混淆。维持/放宽点击各只调用对应 spy，一次点击不自动替换按钮；父级送处理文案后才替换。
- [ ] 将简报 JSX / CSS 迁入组件，标题、09:00 更新、脚注和全部建议文案由容器提供；保留统计→企业漏斗→正文→建议→脚注的既有顺序，外壳用 Task 2 气泡框。不为统计/漏斗另外建立文件层次。
- [ ] 将 `已维持红线` state 放入各自 Mock 容器；只给对应“已维持红线…”文案。求职放宽仍 `新增规则` + 本页轻提示，招聘仍 `企业新增规则` + 跳设置；不要因为展示提取让放宽变为已维持、禁止重复点击或新增确认。
- [ ] 只选择 fixture 展示字段；规则内容/来源只在回调闭包使用。企业容器决定“硬性匹配”的动作及原 aria-label，组件按 `动作!==null` 渲染 button，其余 div；button 内容 span，不嵌套按钮。
- [ ] 页面测试补求职/招聘维持零规则 mutation、招聘放宽载荷与跳转、唯一漏斗入口、Mock 回复和重挂初始化；求职既有跨页规则断言继续使用原文件，不迁移其 harness。静态检查新展示目录 imports 无 fixture/API/Context/route/storage。
- [ ] 浏览器对比原简报宽度、统计字体、时间标、分隔线、建议脚注顺序及底部输入不遮挡；运行下列命令并提交本 Task 精确文件。

```bash
npm run test -- src/组件/问AI代理/简报展示.test.tsx src/屏幕/问AI代理.test.tsx src/屏幕/企业问AI代理.test.tsx
npm run test -- src/屏幕/看市场.test.tsx -t '问AI代理：Backend 不挂载模拟规则动作，Mock 仍可改成可谈'
```

失败反例：组件 `useState(今日简报)`、点击自行显示“已成功”、直接 import 整份 fixture、用 `Agent规则提案卡` 的 ready 状态包建议、简报字号全部选一端覆盖另一端。完成条件：新组件更新 props 就刷新，无全局业务依赖；两页真实消费且模拟操作保留。若发现需要助手 DTO 或真实结果状态才能完成，停止，本任务仅内部展示模型。

### Task 4: 完成双模式浏览器验收与已有 P1 断言校准

目标：证明整页固定入口、禁用聊天及 Mock 展示保持；校准旧 P1 消费者，不仅验证孤立组件。非目标：改 onboarding、扩展业务 fixture 平台、跑真实助手接线。

预期编辑文件：
- 新增：`e2e/问AI代理展示.spec.ts`。
- 修改：`e2e/P1展示统一.spec.ts`。
- 删除：无。

依赖：Task 1–3 已完成及定向测试通过；共用 `e2e/fixtures/P1展示统一.ts` 当前导出 `安装P1路由(page,{role,场景})`，其中 role 为 candidate/recruiter，场景为完整/缺失/长文/错误带缓存，返回 `{请求}`；已包含 Onboarding 域对应角色的 completed 应答，不再复制启动 fixture。不 import 任意 `.spec.ts`（会注册无关测试），不修改 fixture 文件。前端现有 `playwright.数据源模式.config.ts` 启动 mock-stg 4181、backend-stg 4182，Chrome iPhone 配置；端口占用立即报告，不按端口杀他人进程或改成放行外网。

浏览器合同：新增测试使用 `@agent @mock` / `@agent @backend` 标签和对应项目 baseURL；循环两种角色、320/390 宽度，height=844。Backend 安装上述完整场景，`page.goto('/#/app')` 或 `'/#/hr'` 后等正确主壳，再点 nav 内消息按钮。Mock 走同样主壳路径，不写 Session 存储；若需稳定资料使用 `e2e/视觉回归/稳定页面.ts` 导出的 `打开稳定页面` 既有 Mock 种子能力，不绕过 Backend guard。

实施与验证：
- [ ] 新增 Backend 浏览器用例：全部第一条 AI 行，通知有 / 仅会话无，搜索“AI代理”命中 / 无关词不命中 / 清空恢复；点击进入正确代理 URL，真实说明、三个导航与禁用输入可见。按键/点发送后无新消息，无新增 POST/PUT/DELETE；断言请求记录中 P7 会话详情请求路径不包含固定入口键、无规则 mutation，不禁止合法收件箱 GET。
- [ ] 空页/加载/失败组合由 Task 1 双角色组件测试覆盖，浏览器只用完整 HTTP 集合证明真实组装和导航，不再创建一套状态机。对全部/通知/仅会话的既有 P1 消息段作定向校准：删除仅因名称相同就判 Mock 污染的旧“AI代理动态不存在”，改为唯一入口、无模拟摘要/时间/未读；“还没有通知”改为固定行。其中“缺失 无上下文、无 lastMessage 与未读”内的旧 AI 缺席断言也必须修改；搜索筛掉 AI 的旧缺席断言保留；真人参数路由、读消息、分页和错误带缓存断言保留。
- [ ] 新增 Mock 浏览器用例：两端列表与代理初始页面、输入一条长文本、快捷句立即发送并等真实 DOM 回复、建议操作。求职放宽留本页/提示，招聘放宽跳设置；维持不导航且显示本端文案；招聘只有硬性匹配可点。请求监听证明 Mock 页面旅程零业务 API 请求（沿用现有 API 请求监听范围，不含 HMR）。
- [ ] 同视口保存初始/长文本/建议处理后的截图至 `testInfo.outputPath(...)` 并 attach；对照 Task 1 的 Mock 基线，相同内容字体/宽度/间距保持；超长输入不得产生新横向溢出。Backend 新增输入导致垂直空间变化是预期，但导航/输入不得遮挡；测试 DOM 的 disabled 与焦点/点击实际行为。
- [ ] 执行下面精确用例集合。P1 只选消息相关测试，不采集岗位或运行其全套；新 @agent 覆盖两项目。P1 应选中五种消息用例（完整候选、完整招聘、缺失、长标题、错误缓存）×两个宽度，共10条，排除四种岗位用例；检查实际 selection，空或缺失 selection 不算 PASS。提交两个文件。

```bash
npm run test:e2e:data-source -- e2e/问AI代理展示.spec.ts --grep '@agent' --workers=1
npm run test:e2e:data-source -- e2e/P1展示统一.spec.ts --project=backend-stg --grep '消息行|lastMessage|长标题与截断|错误缓存共存' --workers=1
```

失败反例：为跳过 onboarding 直接修改全局应用状态；所有 GET 泛化成功；Backend 出现“刚刚/替你初筛23人”的模拟摘要；把旧 Backend AI 缺席断言全部删除却不校验新增入口；用角色名代替外观截图。完成条件：两宽度、双角色、两模式实际整页证据及 P1 消费者均成立，没有测试平台注册或业务接线变化。

## 实施后收尾（不计入 Task count）

同一实施 session 连续完成，不另起 Integration Owner，不创建第二工作区。

1. 全部 Task 及执行 skill 要求的宿主内全局 review 完成（不额外发明全局 review）后，退出 Task 循环；调用宿主映射异构 review-loop：Codex→Claude、Claude Code→Codex，携带批准 Spec/Plan 精确版本、用户目标、固定候选 diff、共用 `../_shared/review-contract.md`。reviewer 只读且默认不跑测试；轮次/裁决/停止遵循其 skill，轮间只跑修复相关轻量测试。不要在每个 Task 中跑异构 review。
2. 随后做适用完整 affected/L0–L2：基于实际变动与消费者取本节集合，不机械运行全仓。Task 的有效 PASS 与下面重复时证明候选/依赖/环境相同后复用，不再执行。缺证据或改变时只补缺口。

```bash
npm run test -- src/屏幕/P7/Backend会话列表.test.tsx src/屏幕/消息列表.test.tsx src/屏幕/企业消息.test.tsx src/屏幕/消息列表展示/消息列表展示.test.tsx src/屏幕/消息列表展示/消息行映射.test.ts src/屏幕/问AI代理.test.tsx src/屏幕/企业问AI代理.test.tsx src/组件/问AI代理/对话展示.test.tsx src/组件/问AI代理/简报展示.test.tsx
npm run test -- src/屏幕/看市场.test.tsx -t '问AI代理：Backend 不挂载模拟规则动作，Mock 仍可改成可谈'
npm run typecheck
npm run lint
npm run build
```

Task 4 两条浏览器命令也是本次完整责任的一部分，证据有效则不重跑。未改共享 `真输入条` 时不增加其测试；若实际修改则违反当前文件范围，先处理范围问题，不以额外全仓测试替代批准。新增文件/CSS迁移/消费者变更都纳入 selection。

3. 人工 final gate 前只读 fetch 可用于了解 target；不 merge target、不运行正式 L3、不 push。展示候选提交、target SHA、完整责任与有效 evidence、合入动作及增量补验方案，等待用户明确确认。本收尾覆盖默认 finishing-a-development-branch，不回到 Task/global review，不自动增加全套测试或合入菜单。
4. 获批后完整读取逻辑 development-workflow 的 `references/final-integration.md` 与 `assets/final-integration-contract.md`：同步 target、记录 final_target_base、重算完整责任；基准未变且证据有效时零重跑，否则只补新选中/失效项；当前正式 development L3 selection 为 none，不把未运行记 PASS。cleanup 后再次对账 target，普通 fast-forward push，不 force push。确认后不再调用异构 review。实施 session 自有服务/临时证据按既有规范收尾，不动用户资源。

## 文档校准与 Review 记录

- 用户已批准原 Spec 并授权 rebase、校准、Plan、Claude Review及执行提示词；本 Plan 不增加产品目标。
- rebase 到 `origin/main@1f8c223739deb8fb14fdfba51ca8240f081ab089` 无冲突；核心问 AI / 列表 / 输入代码未变。校准采用已有完成 onboarding 的 P1 fixture，且将旧 P1 消息断言纳入 Task 4 精确修改范围。
- 校准验证：在 `b969b267de0cac54dbd68c17c1a7544b67413fa0` 运行两端消息、Backend 列表、共享消息展示/映射、两端问 AI 的 7 文件 / 50 条 Vitest，全部通过，耗时 1.05 秒。未运行新增行为或真实后端验收。
- Claude 文档 review 固定范围仅本 Plan 与所引用 Spec。首轮候选 `545e65a4`；reviewer 为独立 Claude CLI（opus / high、plan 只读模式），无测试；工作树状态、HEAD、文件指纹守卫通过。
- R1-F1（Important / 真实缺陷 / required / 复杂度不变）：接受。旧 `--grep '消息'` 漏掉缺失、长标题、错误缓存用例，缺失用例仍断言 AI 行不存在。已明确修改该断言并将 Task 4 与收尾引用的 selection 改为五种消息用例×两宽度，不扩大到岗位测试；不改变 Spec。
- R1-F2（Minor / 真实缺陷 / optional / 复杂度不变）：接受。补全 `e2e/视觉回归/稳定页面.ts` 路径并指定 `打开稳定页面` 导出，避免执行者猜工具位置。
- R2：同一隔离 Claude 会话复审候选 `c6120b61`（Plan blob `517df4e5` 前缀，Spec 校准 blob 不变），返回精确 `NO FINDINGS`；status/HEAD/内容指纹守卫再次通过。共2轮，1项 required及1项optional均已修复，无拒绝/延后/未解决项；本行仅记录已发生的review结论，不改变受审实施合同。
- selection 校验：驱动者执行 Task 4 的 P1 命令加 `--list`，列出五种消息用例×320/390两宽度，共10条，未执行浏览器产品测试。两轮reviewer均未运行测试。
- 执行交付：使用逻辑 development-workflow 的双宿主模板生成单个 prompt 文件，再运行 `scripts/validate_prompt_grading.py --plan docs/superpowers/plans/2026-09-14-agent-session-and-display-components.md --prompt docs/superpowers/prompts/2026-09-14-agent-session-and-display-components.md`；实际校验结果随prompt提交记录，不再变更此处已冻结实施内容。
