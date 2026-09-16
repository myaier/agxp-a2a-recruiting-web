# AI 助手与真人聊天展示增量 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: 两宿主均实际调用 `superpowers:executing-plans`，按编号顺序实施；不在本规划会话实施。步骤使用 checkbox。development-workflow 的收尾合同覆盖执行 skill 的默认 finishing 流程。

**Goal:** 完成已批准的 AI Markdown/类型标题/卡内匹配理由/消息时间，以及真人聊天身份、操作栏、弹层与短气泡修复，保留业务读写语义。

**Architecture:** 复用现有聊天容器与状态层，仅提取纯展示气泡和正文；AI 三类卡片继续固定组合。真人页从现有授权 Case/岗位/公开企业读取展示事实，复用职位资料、操作栏与 PDF 租约，不增加 schema、缓存或业务流程。

**Tech Stack:** React 19、TypeScript、CSS Modules、react-markdown 10、Vitest、统一 Playwright 离线 fixture。

**Spec:** `docs/superpowers/specs/2026-09-16-candidate-assistant-chat-design.md`，批准 revision `81e12c337596e063e089a6074c6bb2779e5dde60`，blob `8eebfc2ec223dab7deaa1d8bbe5afc02675aeb98`。用户批准了 `3006283a` 内容并明确免真栈 L3；此冻结提交只记录批准和该覆盖。实施范围为 §10–§12；§1–§9 为保持约束，不重新实现原功能。

**Baseline / target:** 主线基线 `30a0d3b24c2257da70c8b54fff4ee0ebb5ad71d0`，target `origin/main`，工作区 `.`。后端源码参考为 `agxp-monorepo` revision `719ead0a0a4368b4dc2ff7e85d57ab74f47e9095`，仅用于解释已有契约，不要求启动后端或修改它。

**计划本身复杂度：中。** 两个现有页面共享展示基础，真人页有异步资料与 PDF 生命周期，但均复用既有机制。

**零上下文漂移风险：中。** 主要风险为把用人企业当发布方、扩展真人消息业务、抽取气泡时改动未纳入消费者。执行模型使用当前可用的行业 Top 5–10 中高性价比模型。

## Global Constraints

- 先完整读 `AGENTS.md`、`CLAUDE.md`、批准 Spec、`docs/testing/README.md`；用户要求最小实现。当前工作区已有 `output/` 预览，保留不提交、不依赖，不 stash/reset/clean，不创建第二个工作区。
- 开工核对 Git 对象存在及 blob，使用 development-workflow 根相对 `scripts/task_intents.py start` 登记路径；扩大路径先 update 并检查重叠。没有仓库级新基础设施需求。
- 本轮 `L3 responsibility: none`，按用户要求不执行真栈 L3、不部署、不准备 STG 资源、不调用真实模型。不得用免测授权改变后端 schema、披露规则或消息读写业务。
- 保持助手历史/发送/轮询/重试、P7 已读/实时事件/分页/幂等/草稿恢复及举报行为。不要把通用气泡变成业务控制器，不增加第二消息 store、注册器、配置项、框架或轮询。
- 卡片内部仅增加匹配理由及自然高度；原公司、分数、薪资、发布人、标签、按钮的内容、图标、大小、位置与样式不重绘。移除旧卡外理由和“请进入岗位详情操作”脚注；委托仍禁用，保留详情入口。
- 查询时间字段继续严格解码但不显示。AI 两侧时间均是同条 `created_at`，真人每条用自己的 `createdAt`；本地时区 `MM-DD HH:mm`，非当前年加年份，不生成新业务时间。
- API 失败不回 Mock，缺值有明确占位。无授权 context 不使用旧身份；资料读失败不阻断聊天。真人不解析 cards，AI 三类结构化结果不由 Markdown 推导。
- 全部输出文档用中文；技术标识、commit message 沿用仓库约定。只在本文记录 review，不新增 handoff/review 报告文档。

## Task index 与角色档位

Task count: 3
Claude Code execution: superpowers:executing-plans
Codex execution: superpowers:executing-plans

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|纯展示气泡、正文与时间；无任务依赖|Top 5–10（Claude Code: sonnet）；保留已有端差|Top 5–10（Claude Code: sonnet）；核对安全与视觉合同|Top 5–10（Claude Code: sonnet）；避免通用化过度|
|2|AI 结果标题、卡内理由与时间；依赖 1|Top 5–10（Claude Code: sonnet）；固定三类映射|Top 5–10（Claude Code: sonnet）；核对卡面不变|Top 5–10（Claude Code: sonnet）；复用文案/组件|
|3|真人页资料、操作栏与弹层、共用气泡；依赖 1、2 的稳定接口|Top 5–10（Claude Code: sonnet）；生命周期需判断|Top 5–10（Claude Code: sonnet）；身份/公司来源约束|Top 5–10（Claude Code: sonnet）；复用现有状态和租约|

以上为每 Task 三角色责任/档位；是否实际派发宿主内 reviewer 按执行 skill，不因角色表额外建立三轮流程。两宿主 N=3 均顺序 executing-plans；异构 review 仅在实施后收尾执行。

## 公共展示合同（任务衔接）

Task 1 在 `src/组件/聊天气泡.tsx` 提供以下纯展示出口，Task 2/3 不再各写一套：

```tsx
export interface 聊天气泡属性 {
  方: '我方' | '对方';
  头像: React.ReactNode;
  时间?: string | null; // RFC3339；省略时无空时间节点
  宽内容?: boolean; // 默认 false；仅 AI 有 cards 时 true
  类名?: string; // 现有外观适配，不允许业务含义
  气泡类名?: string;
  children: React.ReactNode;
}
export function 聊天气泡(props: 聊天气泡属性): React.ReactElement;
export function 聊天正文(props: {
  内容: string;
  格式: 'text' | 'markdown';
  类名?: string;
}): React.ReactElement;
export function 格式化聊天时间(iso: string, 当前年?: number): string;
```

无效时间只返回空字符串、不生成当前时间；可选 `当前年` 仅让纯函数测试可控，不是产品设置项。气泡展示 `<time dateTime={时间}>`；不要传入已格式化字符串二次解析。正文允许 React children 组合，因此 AI 卡片仍由 `查询结果展示` 组装，不为卡片增加新容器注册接口。

保持适配层：现有 `代理气泡框` / `代理气泡` / `我方气泡` 名称不改，增加可选 `时间?: string | null`；`代理气泡` 增加可选 `正文格式?: 'text' | 'markdown'`，默认 text 保持 Mock/招聘端原行为。用现有外观类保留端差，不让新基础样式覆盖未纳入的招聘端 AI 布局。头像仍由原适配层构造。

### Task 1: 提取最小共用气泡、Markdown 正文与时间

**目标 / 非目标：** 实现上面的展示接口并让现有助手适配层可用；不读取 API、不改变消息 DTO、不重构 A2A/直聊/真人状态层。Markdown 使用 `react-markdown@10`（实施时锁定解析出的确切 lockfile，不升级其他依赖）；仅 CommonMark 能力，不安装 GFM、代码高亮、数学或 raw HTML 插件。官方依据：[react-markdown 文档](https://github.com/remarkjs/react-markdown) 的同步组件、默认 URL 转换与 skipHtml；不自制 Markdown 解析器。

**预期编辑文件：**
- 新增：`src/组件/聊天气泡.tsx`、`src/组件/聊天气泡.module.css`、`src/组件/聊天气泡.test.tsx`。
- 修改：`package.json`、`package-lock.json`、`src/组件/问AI代理/对话展示.tsx`、`src/组件/问AI代理/对话展示.module.css`、`src/组件/问AI代理/对话展示.test.tsx`、`docs/testing/cases.md`。
- 删除：无。

**输入 / 输出：** 输入是已有内容/头像/角色样式与可选 ISO 时间；输出是公共展示合同。普通短气泡 `fit-content`/不 grow，父时间列不能 stretch 气泡；长文 max-width 与头像留白保留，`min-width:0`、`overflow-wrap:anywhere`；宽内容显式伸展。纯文本保留换行，Markdown 段落/标题/列表/引用/代码使用局部样式，代码块折行或块内滚动，绝不把整页撑宽。不写全局元素 CSS。

- [x] 核对 Task 1 预期路径和现有对话展示测试；写公共组件测试：text 模式的 `**` 不变，markdown 模式生成 strong/heading/list/hr；原始 `<script>`/HTML 不执行，危险链接不产生可执行 href；普通换行、多段不被折成一段；无时间不产生空节点，合法时间 dateTime 保留原串，跨年格式正确。时间测试归于 `describe('聊天时间')`：用 `new Date(2026, 8, 16, 17, 7).toISOString()` 构造本地 17:07 的输入，显式传当前年 2026，期望 `09-16 17:07`；不同年份则期望带年份，避免硬编码 UTC 字符串却依赖机器时区。
- [x] 用 `npm test -- src/组件/聊天气泡.test.tsx` 确认新行为先失败。若依赖未安装，先 `npm ci`；不能把依赖/导入基础设施错误当行为反例。（npm ci 完成；红跑：模块缺失 1 failed/no tests；react-markdown 安装后行为红转为断言红再转绿）
- [x] 实现纯组件及时间格式化。Markdown 使用同步 `Markdown`、`skipHtml` 和默认安全 URL 处理，不用 `dangerouslySetInnerHTML`；不为消息加载外部 Markdown 图片，图片标记仅呈现 alt 文本（本任务不支持消息附件），链接保留正常安全链接语义。默认 CommonMark 的段落/硬换行语义，纯文本 `white-space:pre-wrap`；不修改存储原文。（react-markdown@10.1.0 锁定；运行时入口仅以 default 导出同步 Markdown，具名导入为 undefined，已按默认导入）
- [x] 修改助手适配层复用新组件，保持现有头像、快捷行、Mock 及招聘端字体/宽度端差。新增时间字段不使整条短气泡 grow；调整旧 class 的挂点并验证 DOM 行列关系，不只把原 JSX 包一层。（行向/头像槽/气泡列交基础组件；.代理行 移除，镜像净空改列内 39px，.求职 .简报气泡 保留后代选择器；原消费者 4 文件 66 例全绿）
- [x] 执行 `TZ=Asia/Shanghai npm test -- src/组件/聊天气泡.test.tsx src/组件/问AI代理/对话展示.test.tsx`、`TZ=UTC npm test -- src/组件/聊天气泡.test.tsx -t 聊天时间` 和 `npm run typecheck`。两个 TZ 只影响命令进程，不修改全库 vitest 配置，不为同一候选重复其他测试。预期相关测试通过，既有默认 props 不改变 Mock 内容；测试不要镜像内部 helper，检验可见输出与安全 DOM。（28 passed 双文件 / UTC 5 passed / typecheck 0 错；消费者回归 66 passed；回执在 output/chat-presentation-evidence/task1/）
- [x] 记录命令/代码版本/结果，更新 runner Case 清单（统一可在 Task 3 汇总 write，最终 check 必须通过），提交本任务精确路径，排除 `output/`。

**完成/停止：** 共享出口可供两个业务页面消费，原消费者测试通过。若必须改消息协议或招聘端产品样式，停止该扩展，不能作为本任务便利重构。

### Task 2: AI 回复 Markdown、完整类型标题与卡内中文理由

**目标 / 非目标：** 落实 Spec §10 全部可见行为；不修改助手数据源、查询能力、业务按钮权限、原生详情导航或卡片其余内容。依赖 Task 1 公共接口，执行前核对其已存在并通过定向测试。

**预期编辑文件：**
- 新增：无。
- 修改：`src/组件/问AI代理/查询结果展示.tsx`、`src/组件/问AI代理/查询结果展示.module.css`、`src/组件/问AI代理/查询结果展示.test.tsx`、`src/屏幕/问AI代理.tsx`、`src/屏幕/问AI代理.test.tsx`、`src/组件/列表卡片/求职推荐卡.tsx`、`src/组件/列表卡片/类型.ts`、`src/组件/列表卡片/求职推荐卡.test.tsx`、`src/屏幕/看市场.module.css`、`src/数据/发现推荐映射.ts`、`src/数据/发现推荐映射.test.ts`、`e2e/suites/助手会话.spec.ts`、`e2e/fixtures/助手会话.ts`、`docs/testing/cases.md`。
- 删除：无。

**输入 / 输出契约：** `查询结果展示属性` 新增必填 `时间: string`，调用方传当前 `AssistantMessage.created_at`；我方气泡同传该字段。所有成功 Agent 回复（包括无卡/不可见提示）用 markdown 正文。已知类型标题为：

```ts
const 结果标题 = {
  job_recommendations: '推荐岗位',
  negotiation_list: '在谈列表',
  negotiation_detail: '在谈详情',
} satisfies Record<AssistantCard['kind'], string>;
```

列表显示该组实际 n 个岗位/n 条在谈，详情不显示数量；重复类型不合并；仅在解码后有已知卡片时显示正文后的结果分割线。已有 decoder 跳过未知 kind，保持，不改 wire。

求职推荐卡增加可选 `匹配理由?: readonly { 文案: string; 已匹配: boolean }[]`。不传时完全没有新区域（市场原样），传空数组显示“暂无推荐理由”。插在标签后、底部分割线前；true 为绿色勾和文字，false 是自然语言普通说明。只增本区样式，不调整按钮等原有规则。

导出并复用发现推荐映射已有四项亮点文案（允许把既有闭表从私有改成 export，不复制第二个翻译表）：category/experience/location/workplace_mode 分别为“职位方向匹配/经验要求匹配/工作地点匹配/办公方式匹配”。查自有键；未命中且完整匹配 `^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$` 的机器码过滤，空白过滤，其他自然语言保留且 `已匹配:false`；按原序，不猜评分。

- [x] 更新/新增失败断言：以 Spec §10.5 完整原文与两岗位样本覆盖 Markdown；按三类单独、混排、重复类型/空列表检查标题、数量与顺序；查询时间不显示，Agent 时间只在整条气泡之后出现一次。
- [x] 用 `npm test -- src/组件/问AI代理/查询结果展示.test.tsx src/屏幕/问AI代理.test.tsx` 定向确认旧纯文本/查询时间/卡外理由失败。保留导航、禁用委托、空态、不可用项和解读动作原断言，替换已被用户明确取消的脚注断言。（红跑 18 failed：标题/数量/时间/卡内理由/Markdown 全部先行失败）
- [x] 实施标题/分割线/正文接线；移除 `queried_at.slice` 展示和卡外重复理由、脚注，保留 decoder 字段。普通 Agent 使用窄气泡，有卡使用宽内容；首读空会话说明不是持久消息，不编造时间。
- [x] 在原推荐卡插入可选理由区域，复用文案并验证市场未传属性时 DOM 内容和按钮不变。`constructor` 等原型名不能命中翻译；不对未知自然语言添加肯定勾。（理由区插在卡主体内标签行后；细对勾图标复用现有绿色体系；看市场.test.tsx 71 例全绿确认零变化）
- [x] 页面两侧传同一条 created_at。时间测试用 created_at 与 queried_at 跨分钟样本，避免真实样本同一分钟掩盖取错字段；历史重载时间不漂移。
- [x] 执行 `npm test -- src/组件/问AI代理/查询结果展示.test.tsx src/屏幕/问AI代理.test.tsx src/组件/列表卡片/求职推荐卡.test.tsx src/数据/发现推荐映射.test.ts`；浏览器执行 `npm run test:e2e -- e2e/suites/助手会话.spec.ts --project=fixture`。新样式用例并入原 Suite，用 320px/390px、真实样本文案截图检查卡内理由、标题、时间、按钮与原卡对照；无卡与多卡均无横向溢出。新增时间用例分成两个原生 describe，分别 `test.use({ timezoneId: 'Asia/Shanghai' })` 与 `test.use({ timezoneId: 'UTC' })`，每组只跑一个时间来源对照用例，复用统一 fixture；同一输入 `2026-09-16T09:07:33.348845Z` 分别显示 `09-16 17:07` / `09-16 09:07`，冻结测试当前年为 2026，并令 queried_at 跨分钟。不要为时区把整个导航旅程复制两遍。（单元 143 passed + 看市场 71；fixture 9/9 绿：时间 describe 用 page.clock.install 冻结 2026；发现并修复基线既有红——产品 94be6952 已把在谈详情页初评本地化为「公开初评匹配」，旧断言「结论：fit」在 d746327a 验证后的 40 提交窗口内过期，属陈旧断言对齐，非产品改动；Task 1 结构变化波及的 `[class*="我行"]` 选择器同步改为 `[class*="我方"]`，问AI代理展示.spec.ts（mock）一并修复验证）
- [x] 记录测试、截图位置与候选版本，提交本任务精确文件。此处无需重跑 Task 1 完全未变化的基础测试；若改了共享组件则按影响补它的用例。

**完成/停止：** 三类已知标题一一对应、真实字段原样、卡面只有批准的理由变化、时间正确、导航未回归。遇到新后端 card 类型先核对契约，不兜底当详情。

### Task 3: 真人页对齐 Mock 操作栏/弹层与共用气泡

**目标 / 非目标：** 实现 Spec §11。当前 P7 接口不含姓名、电话、微信，不改它；按已授权 caseId 复用现有读取补页头及资料。聊天业务仍留在现有 Backend 容器。依赖 Task 1 气泡/正文接口与 Task 2 已验证的 AI 消费者；不迁移未开放直聊/A2A。

**预期编辑文件：**
- 新增：`src/屏幕/P7/use真人会话资料.ts`、`src/屏幕/P7/use真人会话资料.test.tsx`（只组织该页面资料读取、映射与局部失败状态，无 store）。
- 修改：`src/屏幕/P7/Backend真人会话.tsx`、`src/屏幕/P7/Backend真人会话.test.tsx`、`src/屏幕/真人会话操作栏.tsx`、`src/屏幕/真人会话操作栏.module.css`、`src/屏幕/真人会话操作栏.test.tsx`、`src/组件/原始PDF层.tsx`、`src/组件/原始PDF层.test.tsx`、`e2e/suites/真人消息.spec.ts`、`e2e/fixtures/bff/真人消息.ts`、`e2e/fixtures/bff/安装BFF路由.ts`、`e2e/fixtures/bff/MatchCase.ts`、`e2e/fixtures/bff/发现推荐.ts`、`e2e/fixtures/bff/招聘组织.ts`、`docs/testing/cases.md`。
- 删除：无。已足够的 fixture 文件无需为凑清单改动；不改 P5/P7 数据协议或状态机文件。PDF 文件新增/现存核对见下步骤，不创建第二套 PDF 下载机制。

**实际生产者接口与数据责任：**

- `操作.读取详情(role, caseId, force?)` → `后端状态.P5详情[P5范围键.detail(role, caseId)]`，含 `P5详情` 与失败状态。只在当前 P7 授权详情 context available 后读取，进会话做一次定向读取，不加轮询。按当前角色/会话与 provider 身份隔离生命周期，缓存键不替代当前授权。首进当前范围需要本轮读取成功且快照无错误才消费身份，失败不继续展示缓存中的旧身份；手动重读同样以本次结果判定，不仅检查 detail 非空。
- 候选端 `操作.读取候选岗位详情(jobRef, force?)` → `后端状态.候选岗位详情[jobRef]`，取 `publisher_organization_ref`；通过 `操作.读取公开企业(id)` → `状态.公开企业表[id].display_name` 得到发布方名称；`状态.不可用公开企业编号` 中的 ID 不使用旧缓存。仅用于页头当前公开公司，不覆盖 Case 冻结 jobDetail。若岗位/企业失败，局部显示缺失，不自动重试风暴。
- 招聘页头用 Case `candidateIdentity`：disclosed+name 有效才显示真名/头像；anonymous 代号；disclosed 无名占位。候选页头用 Case `jobDetail.publisher_profile.public_name/title/avatar_url`，公司按上条发布方组织；缺字段按 Spec 原文占位。我方头像用当前身份已有资料，没有则中性占位。
- 职位正文用 `映射P5详情(detail)` → 判别 `view.kind === '正常'` → `从P5到职位资料(view)` → `职位资料`；不引入带轮询/业务动作的 `use后端详情控制` 整体。契约错误/缺 jobDetail 给不可用与局部重读；公司导航沿用已有可信组织坐标门控，不编造 enabled 动作。
- PDF 沿用 `操作.读取简历PDF('recruiter', caseId)` 返回对象租约，仍然点击才取件；租约由 Backend 页持有、关闭/卸载/context 失效回收，迟到结果回收。

**局部 hook 的出口（只给当前页，不做通用资源框架）：**

```ts
use真人会话资料(角色: P7角色, 详情: P7会话项 | null): {
  标题: string;
  副标题: string;
  对方头像URL: string | null;
  对方首字: string;
  职位资料: 职位资料信息 | null;
  资料状态: 'loading' | 'available' | 'unavailable';
  重读资料: () => void;
}
```

hook 读取现有 provider 状态；允许几个局部 ref/state 记录本次范围与补读失败，不另存 P5 DTO 副本。清空原资料必须在当前授权不匹配的渲染即生效，不等旧请求回来再清。

**操作栏最小增量：** 所有主项统一 `主项内容: ReactNode`，删除迁移后无生产调用方的 `主项按下` 联合分支及其旧回调专属测试；保留交换模式和 Mock 联系卡。仅增加当前用例需要的可选 `主项禁用?: boolean`、`联系方式占位?: boolean`（默认 false）、`主项打开?: () => void`、`主项关闭?: () => void`。Backend 使用占位模式，电话/微信展开普通缺失文字，无复制；Mock 不传占位属性保持原行为。主项使用已有全屏层，开层时调用 `主项打开` 以延迟取 PDF；“继续沟通”及所有关闭路径调用 `主项关闭` 回收租约。没有第二种导航回调模式，不新增全局弹层管理器。

PDF 层复用：从 `原始PDF层.tsx` 导出同文件 `原始PDF正文({文件名,地址})`（或等价同文件纯正文出口），原 `原始PDF层` 内复用它，其他消费者不变；真人全屏层嵌正文，不嵌另一层弹层。不要复制 iframe 和租约逻辑。

- [x] 先核对现有操作/状态字段、资料映射以及 PDF 文件与测试；上述修改文件在基线均已存在，不新建第二份测试文件。
- [x] 追加资料 hook/页面反例：disclosed 有名/缺名/anonymous、候选招聘者及发布方和用人企业不同、缺资料/请求失败、不阻断发消息、换会话/角色/账号/context unavailable 不透出旧身份；使用受控 promise 验证迟到资料不污染新页，不运行真 API。
- [x] 先跑 `npm test -- src/屏幕/P7/Backend真人会话.test.tsx src/屏幕/P7/use真人会话资料.test.tsx`，确认现有页面无法满足新页头/占位行为；旧“按 job_ref 跳转”“无电话微信”断言改为批准的新行为，不删消息读写与隔离断言。
- [x] 实现局部资料 hook 和 Backend 页接线。针对补读使用当前范围 guard 与原 provider 代际，不建立新生命周期框架；context 失效时关闭资料弹层、清理 PDF，保留消息可读写和重读入口。
- [x] 扩展操作栏最小属性，复用原 CSS 全屏层。候选内容显示现有 Case 职位资料；招聘开层先展示加载，按原 Case 取 PDF，成功嵌正文，失败提供本层重试。主项授权坐标缺失禁用占位，电话微信仍可看缺失说明；切换操作互斥。关闭/切会话/卸载/失权递增现有 PDF 代际，撤销已有租约，迟到回执不能重开层。
- [x] 真人消息行改用 Task 1 的 `聊天气泡` + markdown `聊天正文`，时间传 `行.createdAt`，保留 `data-侧` 与系统消息分支；不改 senderRole 左右判定或消息键，不修改发送的 content。删除本页重复气泡 JSX/UTC 取短时间函数；不全局改旧直聊 CSS，以免改动 Mock/A2A。
- [x] 在统一真人消息 fixture 显式加入新增 Case/岗位/企业读取；复用各域 handlers 与统一安装入口，遗漏请求必须被离线边界拒绝。用真实 PDF fixture 覆盖全屏展示、关闭/失权回收、迟到响应；不因新资料读取而放行真实网。
- [x] 执行 `npm test -- src/屏幕/P7/use真人会话资料.test.tsx src/屏幕/P7/Backend真人会话.test.tsx src/屏幕/真人会话操作栏.test.tsx src/组件/原始PDF层.test.tsx src/屏幕/真人会话.test.tsx src/屏幕/企业真人会话.test.tsx`；`npm run test:e2e -- e2e/suites/真人消息.spec.ts --project=fixture` 验双角色和交互，另按实际 Mock 用例选择 `--project=mock` 同 Suite，禁止以空选择记通过。
- [x] 浏览器保存 320px/390px 双侧短/长消息与弹层截图，检查短气泡实际 bounding box 随文字缩短、长文不溢出、关闭后滚动/草稿/URL 不变，电话微信缺失不可复制。真人时间同样用两个显式 `timezoneId` describe（Asia/Shanghai 和 UTC）各一条聚焦用例，冻结当前年 2026；分别给对方/我方不同的 createdAt（如 09:07Z/09:09Z），断言本地两条时间分别为 17:07/17:09，UTC 对照为 09:07/09:09，不误用 AI 整轮时间。通过标准 test fixture 建上下文，避免绕过离线边界。按 Spec 不把截图称为真栈通过。
- [x] 全部 Case 修改收敛后运行 `npm run test:list -- --write` 与 `npm run test:list -- --check`；核对只更新生成区。记录证据与提交。若新增文件不在清单映射规则内才调整映射表并提前更新 intent；通常 `src/屏幕/`、`src/组件/` 前缀已覆盖，不新增配置。


**Task 3 执行备注（就地记录）：** 单元 63 passed（六文件）+ fixture 11/11 + mock 1/1 + typecheck/lint 0；证据在 output/chat-presentation-evidence/task3/（截图 p7-bubbles-320/390、p7-job-layer-390、p7-pdf-layer-390 与 vitest-定向.log、候选版本.txt）。实现要点：操作栏删除 主项按下 旧分支（R1-2 已批准），新增 主项禁用/主项打开/主项关闭/联系方式占位；Backend 页操作栏按 会话 key 重挂实现换会话即关层；PDF 失败态改层内重试（不再轻提示）；候选端 Case 详情走 me/negotiations 聚合（case_detail 投影），P7 fixture 因此补答聚合/canonical 岗位/公开企业/PDF 内容四路，并用真实 decoder 探针校准了三处契约形状（record_id 十六进制、candidate 别名 pattern、completed 需 finalized_at）；清单 write 后 check 通过（第一层 5767 / 第二层 335），diff 仅含本任务来源。

**完成/停止：** 现有两角色消息回归通过、短气泡修复、身份合法降级、资料弹层不离开聊天、PDF 租约完整、Mock 默认操作栏不变。任何需要后端新字段或业务写入的方案不在范围内；缺公司/联系方式按已有占位完成，不因理论完备性扩范围。

## 测试选择五问与验证责任

1. **防什么失败：** 共享气泡破坏未纳入端差、Markdown 不安全/不换行、卡片内容被重画、三类标题漏映射、时间错用 UTC/queried_at、真人页补读身份串号/公司误认、PDF 迟到泄漏与草稿丢失。Task 1–3 的具体断言是最小责任。
2. **最小反馈入口：** 每 Task 的精确 Vitest 文件集；UI 接线用助手/真人两 Suite 的 fixture project，Mock 仅对应消费者；本地开发先 `npm ci`，不启动真后端。失败先定位，修复后只重跑该风险子集。
3. **提前验证边界：** 真人补读请求/授权失效/PDF 租约需要 Task 3 的受控响应与浏览器 fixture，在该 Task 完成前验证，不拖到最后。CSS 几何由浏览器证实，jsdom 文本断言不能证明短气泡宽度。
4. **最终权威与发布：** 本地静态 `npm run typecheck`、`npm run lint`、定向组件+两 Suite，以及 Case 清单 check；生产构建验证新增 Markdown 依赖的 ESM 打包，`npm run build` 只在候选收敛后执行一次。本轮 L3 none，部署不在范围；合入仍需 final gate 明确确认。
5. **已有证据与成本：** 规划仅源码核对、文档 diff/path 校验，无产品测试 PASS。本地 PNG 是原 Mockup，不是产品验证。执行时记录实际耗时，当前预计耗时未知；Task 中有效证据可在收尾复用，不为标签重复整层运行。

本仓库没有为本任务提供独立 affected 命令；按 `docs/testing/README.md` 的原生文件/标题选择记录 candidate、target、命令和 covered risk。新依赖、共享 CSS、fixture 和消费者都纳入 selection。最终选择重新对照实际 diff，未变化且输入/runtime/fixture 有效的证据复用；新增/失效部分才补跑。不要凭宽泛的“样式改动”省略必要接线测试，也不要自动扩成全库测试。

## 实施后收尾（不计入 Task count）

1. 完成编号任务及 executing-plans 实际要求的宿主内全局 review（不要求则不额外添加），退出 Task 循环。
2. 实际调用宿主异构 review-loop：Codex → Claude，Claude Code → Codex；绑定批准 Spec 与最终 Plan revision/blob、固定候选 diff，传共用 `../_shared/review-contract.md`，reviewer 不跑测试。轮间仅修复相关轻量检查，不跑 affected/全层；裁决遵守必要性与复杂度，不盲目加抽象。
3. 按最终 diff 完成最小覆盖的 affected/L0–L2；复用 Task 有效回执，只补缺口，运行必要的 typecheck/lint/build 与清单校验。真实 L3 明确 none，不记 PASS、不以环境缺失阻塞。
4. 展示具体 final gate 方案（候选 commit、target SHA、已完成测试、可复用证据与缺口、同步/普通 fast-forward 合入动作），等待用户明确确认；当前 workflow 启动不是合入授权。确认前仅只读 fetch，不同步合入 target、不 push。
5. 获批后按 development-workflow 根相对 `references/final-integration.md` / `assets/final-integration-contract.md` 同步实际 target、重算责任并只补失效项；本轮跳过 L3，无真栈 cleanup。确认后不再做异构 review；target race 按合同重新呈现范围，不强推。普通 fast-forward push 成功后才报告合入，更新 task intent。

## 异构 Codex review 记录（实施后收尾）

- 模式：`codex-review-loop` FEATURE_BRANCH_REVIEW（开发合同授权的实施后收尾步骤）。冻结范围 `30a0d3b2...6364483f`（fork point = origin/main，分支独有 8 提交：5 文档 + 3 实施）。Reviewer 为 Codex CLI（`gpt-5.6-sol` / reasoning high / read-only 沙箱 / stdin 提示词文件），绑定批准 Spec blob `8eebfc2e`、最终 Plan 与共用 `../_shared/review-contract.md`；reviewer 全程未跑测试、未改文件（每轮前后 HEAD/porcelain 指纹一致）。
- R1（thread 01a0aa05-edf5-7550-9b43-d190a351b566）：4 项 finding，全部裁决接受（required 4 / optional 0，拒绝 0）：
  1. PDF 关闭/失权不作废在途取件（契约违反/Important/required/复杂度不变）→ 修复：新增 失效PDF会话 局部入口（关层/换会话/换角色/卸载/授权失权统一递增代际、回收租约、复位预览），操作栏 key 并入授权态实现失权即关层；补两条单测（关层后迟到租约即时回收且重开重新取件、同会话 context 失权关层回收）。
  2. 资料 hook 消费旧成功缓存，未满足「本轮读取成功」门槛（契约违反/Important/required/复杂度增加——防旧身份与旧发布方公司继续展示的现实隐私风险，收益足以抵偿）→ 修复：每个授权范围强制一次定向读取（读取详情/读取候选岗位详情 force），本轮 promise 结算前一律 pending 降级（含手动重读期间），落地后仍按快照成功无错消费；hook 测试改异步等待并新增两条门槛反例。
  3. 全屏层 PDF 正文塌陷（契约违反/Important/required/复杂度不变）→ 修复：原始PDF正文 增加可选 类名，页面传 `.PDF全高`（height:100%）让纸底在非 flex 正文区获得确定高度；e2e 断言 iframe 高度 >400px。
  4. 真人长气泡丢失对侧留白（契约违反/Minor/required/复杂度不变）→ 修复：消息行传 `我方消息行/对方消息行` 行类 + `对侧留白` 气泡类（后代选择器抬高特异性，不依赖模块加载顺序、不收窄基础样式），我方让 41px/对方让 35px（与直聊镜像净空同口径）；e2e 双侧长消息对侧边距 ≥40px。
- R1 修复提交：见 git log `fix(review-r1)`；轮间轻量检查 = 受影响单测 40 passed + typecheck/lint 0 + 真人消息 fixture e2e 11/11（未跑全层）。

## 文档审查记录

- 模式：`WORKFLOW_DOCUMENT_REVIEW`，父 workflow 已授权。固定范围仅本 Spec 和本 Plan；批准 Spec revision `81e12c337596e063e089a6074c6bb2779e5dde60` / blob `8eebfc2ec223dab7deaa1d8bbe5afc02675aeb98`。
- 首轮候选：Plan revision `3c79e1c22991759ec09681825a3908e93b24cc32` / blob `4c15217f9819157c99fb6792e840f7dec594cf80`。Reviewer 为 Claude CLI，`opus` / `high` / `permission-mode plan`；session `59a6d2aa-a46a-43ae-84da-fcf1b9f6c813`。未运行产品测试。审查前后 HEAD、porcelain 与受审文件 hash guard 均一致。
- R1-1：Important / 契约违反 / required / 复杂度不变。Plan 未将 Spec 的显式本地时区及 UTC 对照落实为执行步骤。接受并修复：Task 1 单测以本地 Date 构造确定输入、提供 Shanghai/UTC 两个进程命令；Task 2/3 在原生 describe 设定 timezoneId，各增加聚焦对照，固定当前年，不复制整个旅程。
- R1-2：Minor / 可选增强 / optional / 复杂度降低。迁移后操作栏 `主项按下` 无生产消费者，保留会造成多余联合类型与分支。核对源码只有 Backend 两处调用和一条专属测试，接受并简化：统一内容模式，移除废弃分支，保留真实需要的开关层/禁用/缺失占位属性；Mock 不受影响。
- 裁决：2 项均接受，required 1 / optional 1，拒绝 0，延后 0；均不改变批准产品契约。修订后自检对应步骤、文件和命令，无未解决有效 required finding。依 claude-review-loop 的“裁决后无未解决 required”停止条件，结束于第 1 轮，不将本结论写成 reviewer 返回 `NO FINDINGS`，不为追求零建议额外循环。
- 验证：仅文档 diff、关键约束与路径自检；执行提示词生成后另运行工作流规定的 grading 校验，产品测试留给新实施 session。
