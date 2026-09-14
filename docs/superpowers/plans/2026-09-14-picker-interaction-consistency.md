# 城市、行业、薪资与就读年份交互统一实施 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Claude Code 使用 `superpowers:subagent-driven-development`；Codex 使用 `superpowers:executing-plans`。按下列 checkbox 逐 Task 执行。本文件只交付计划，本规划 session 不实施产品。

**Goal:** 修复行业折叠/滚动和就读年份假选中，统一招聘城市与月薪交互，并保证 Mock / Backend 共用设计、保留 Mock 演示预填。

**Architecture:** 复用现有全页/弹层外壳，提取具体行业列表控制和城市选择正文；页面继续拥有草稿、角色权限和 API 保存。月薪扩展既有弹层的业务用途，年份扩展既有滚轮的可空能力；不新增通用表单、无限树、全局岗位草稿或后端协议。

**Tech Stack:** React 19、TypeScript、Vite、Vitest / Testing Library、Playwright；沿用 package-lock.json，不新增依赖。

**Spec:** `docs/superpowers/specs/2026-09-14-picker-interaction-consistency-design.md`，批准 v1.1 revision `ad6abf85c3a7460731333281285bfc8d40971bfd`，blob `e84dc211ec1931eba84557b079b5e50a94cddbe6`。当前 Spec 仅增加批准记录，不替代这个产品合同。用户明确批准写 Plan、Claude review 和执行提示词，未授权跳过实施 final gate。

## Global Constraints

- 仓库 `agxp-a2a-recruiting-web`；当前工作区 `.`，复用用户选定工作区，不创建第二工作区，不 stash/reset/clean 其他改动。调查代码基线 `5825ff47a27600cbe5591fb1a9a5fe43e7201272`；target `origin/main`（远端默认分支），实施 final gate 前只读获取 target 事实，不提前合并或 push。
- 完整阅读 `CLAUDE.md`、`AGENTS.md` 与批准 Spec。按精确 Git 对象核对；对象缺失、源码与下列接口实质不符时先定位差异，不能拿最新文档默认为批准。路径均相对仓库根；外部 skill 用逻辑名发现，其资源相对实际 skill 根解析。
- 本轮仅 frontend。行业/地点使用现有 catalog 接口和稳定 ID；后端 DTO、岗位 POST/PATCH、revision/If-Match、sparse patch、薪资单位及金额倍率不变。职位分类与岗位名称独立、手动改名不覆盖、已发布类别/类型/城市/title 锁定不变。
- 同业务入口两模式调用同一个展示组件，展示不得读取数据源模式/Context/raw DTO。Mock 与 HTTP 查询适配允许不同；Mock 不发真实请求，Backend 失败不得回退 Mock。
- 保留 Mock 默认资料、目录和演示预填。既有真实值/已有 Mock 值优先，空 fixture 和用户清空不得被默认值补回；2021/2025 从页面伪默认移到显式 Mock 数据种子。不得为了统一样例把既有 2014/2017 教育资料改成 2021/2025。
- 行业根/子/孙最多三级，不增加无限树、推荐算法、全文预加载、虚拟列表、通用数据请求层。城市本地子视图，不新增 route/history/global persistence。出生年月、日薪/时薪、学校/专业/公司选择不重做。
- Task 顺序串行 1→2→3→4→5；共享文件和浏览器测试有重叠，刻意并行无收益。每 Task 先核对依赖产物及通过证据在当前 HEAD，不能只凭前人文字继续；共享变更与直接消费者同 Task 保持可用，不制造必须跨提交联动的半成品。
- 每 Task 写失败回归→确认失败原因→最小实现→定向 PASS→提交该 Task 精确文件。新测试验证用户行为/数据边界，不镜像 helper 实现。测试异常与产品失败分开，不用修改超时/删断言冒充通过。
- 开工用 development-workflow 的 `scripts/task_intents.py start` 登记当前路径；扩大文件或接口范围前 `update` 并查重叠，具体参数先读 CLI help；不删他人预告。文档执行进度/review 记录在本 Plan；不另建 handoff 或 review 报告。

## Task index

Task count: 5
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|两处行业共用折叠列表及弹层滚动；无上游依赖|Top 5–10（Claude Code: sonnet）；契约已冻结|前沿 / 顶级模型（Claude Code: opus）；检查分页换版与选择分离|Top 5–10（Claude Code: sonnet）；删除重复状态，控制抽象|
|2|共用城市全页及岗位本地子视图；依赖 Task 1 弹层回归已稳定|Top 5–10（Claude Code: sonnet）；限定本地状态|前沿 / 顶级模型（Claude Code: opus）；角色/JD 迟到边界|Top 5–10（Claude Code: sonnet）；消费适配与生命周期|
|3|岗位月薪复用双滚轮；依赖 Task 2 岗位表单基线|Top 5–10（Claude Code: sonnet）；有限金额策略|Top 5–10（Claude Code: sonnet）；保留求职协议与金额|Top 5–10（Claude Code: sonnet）；避免配置框架|
|4|可空就读年份与显式 Mock 预填；依赖 Task 3 滚轮消费者基线|Top 5–10（Claude Code: sonnet）；保留非空接口|前沿 / 顶级模型（Claude Code: opus）；预填/草稿保存时序|Top 5–10（Claude Code: sonnet）；单一值真相|
|5|两模式真实浏览器交互回归；依赖 Task 1–4 实现与定向证据|Top 5–10（Claude Code: sonnet）；既有 Playwright 入口|Top 5–10（Claude Code: sonnet）；覆盖真实 DOM 与模式矩阵|Top 5–10（Claude Code: sonnet）；避免重复 fixture 平台|

**计划本身复杂度：中。** 五个界面涉及少量共享控件，业务和接口不变，但存在真实浏览器布局与异步验证成本。

**零上下文漂移风险：中。** 主要风险是执行现场已有改动、目录返回差异和默认 Mock/空数据混淆；精确契约和反例已约束自主设计空间。执行模型只按此风险选择，使用当前可用的行业 Top 5–10 中高性价比模型。

## 测试选择与责任

1. 防止的失败：折叠缓存混为一体、请求迟到重新展开/串主体、弹层长到屏幕外、城市关闭丢岗位草稿、金额夹值/倍率漂移、年份空态变已选、Mock 页面设计分叉。对应 DOM、查询生命周期、DTO 提交边界；不涉及新 SQL/事务。
2. 开发最小命令列在每 Task。最终取这些文件的并集及真实受影响消费者；先 `git diff --name-status <已记录基准> HEAD`、查消费者与测试入口，再选择。仓库无统一 affected runner，使用明确 Vitest 文件、既有类型/lint/build 和带 @picker 标签的浏览器子集，不发明新 wrapper。
3. 何时提前验证真实边界：布局/滚轮程序定位在 Task 5 用真实浏览器验证；Task 2/3 单元测试捕获 API payload 与请求归属；若发现 DTO/权限/后端契约需要改变，停止扩大产品范围。fixture 无法证明真实保存回读，留作已明示的最终 dogfood 责任，不将其标成 Backend 联调 PASS。
4. 最终权威：执行者对完整受影响 selection、原始输出、源码 SHA、依赖/运行时/fixture 与环境负责。正式 development L3 为 required：按 `docs/dogfood/真实后端行为验收.md` 的 local B02、B04 完整 Case，另在相同候选会话补工作经历行业和空值 onboarding 年份的 UI 保存/刷新断言；不运行 B01/B03/B05/H01–H04 全套。B02/B04 所需基础加载是前置，不把未选 Case 标 PASS。必须在 final gate 方案列环境、临时账号、数据准备、清理、具体操作与证据并获批后执行；缺环境记 BLOCKED。release-only 为 none。
5. 已有证据仅调查基线：184 项定向约 27.5 秒、80 项经历/行业约 6.87 秒，均漏了本次缺陷，不能充当实施 PASS；最小 Chromium 布局复现已证明高度覆盖问题，但不是实际页面验收。新增浏览器子集成本未知，不为计时提前跑重测试。

### Task 1: 两处行业使用同一折叠列表并修复弹层滚动

目标：删除伪推荐/Mock 自填，单选与多选只改变业务选择规则，展开/缓存/滚动机制共用。非目标：改变全页/半页外壳、无限层级、行业推荐服务。

预期编辑文件：
- 新增：`src/组件/行业分类列表.tsx`、`src/组件/行业分类列表.module.css`、`src/组件/行业分类列表.test.tsx`、`src/屏幕/行业目录钩子.ts`、`src/屏幕/行业目录钩子.test.ts`。
- 修改：`src/组件/期望行业选择正文.tsx`、`src/组件/期望行业选择正文.test.tsx`、`src/组件/简历行业选择正文.tsx`、`src/组件/简历行业选择正文.test.tsx`、`src/屏幕/选期望行业.tsx`、`src/屏幕/选期望行业.test.tsx`、`src/屏幕/工作经历.tsx`、`src/屏幕/工作经历.test.tsx`、`src/屏幕/工作经历.module.css`、`src/组件/弹层框架.tsx`、`src/组件/弹层框架.test.tsx`。
- 删除：无文件；删两页重复的行业树状态/请求逻辑、推荐与 Mock 自填 JSX。

输入位置：两页原有根/子/孙 catalog 查询、`src/数据/城市与行业.ts` 的 `行业字典`；工作经历保存与期望草稿派发保持页面所有。`弹层框架` 的 bottom 内联 maxHeight none 覆盖 caller 72%，依赖关闭回调的 effect 会在每次重渲染重聚焦。

生产/消费契约（新类型由 `行业分类列表.tsx` 导出；不带 BFF 或业务写入）：

```ts
export type 行业项 = { 键: string; 名称: string; 可选: boolean; 有子项: boolean };
export type 行业页 = { 项: 行业项[]; 下一页: string | null; 版本: string };
export type 查询行业页 = (父键: string | null, 游标: string | null) => Promise<行业页>;
// 行业目录钩子.ts 导出 use行业目录(参数: {查询:查询行业页;目录身份:string})。
// 目录身份必须包含当前模式与主体身份；同主体查询 callback 稳定。
export type 行业行 = 行业项 & {
  层级: 0 | 1 | 2; 展开: boolean; 加载中: boolean;
  错误: string | null; 空: boolean; 可加载更多: boolean; 达深度上限: boolean;
};
// hook 返回 {行: 行业行[], 根加载中:boolean, 根错误:string|null, 根空:boolean,
// 根可加载更多:boolean, 切换展开:(键:string)=>void,
// 加载更多:(父键:string|null)=>void, 重试:(父键:string|null)=>void}。
// 行业分类列表 props = 上述 hook 返回字段，加：
// 已选键: readonly string[]; 上限: number; 选择:(项:行业项)=>void。
```

查询适配明确放在 `src/屏幕/行业目录钩子.ts`：该文件持有具体行业的 Mock 字典转换与 HTTP DTO 转换，接收已注入的查询操作，不读取 Context；两页选择数据适配并调用 hook，展示文件 `行业分类列表.tsx` 不读模式或 DTO。该文件在新增清单中，不另建适配文件；底层调用保持现有操作签名，仅转换 id/display_name/selectable/has_children、分页游标与 catalog version。键 `mock:industry:<根序>:<子序>` 仅局部使用，不根据名称作 ID。根 Mock 仅展开，细分可选；HTTP 选择与展开严格独立。两页保留引用映射表：点击选项按键取得原引用，不从名称重建 ID。

外部行为：全页最多3项，选择即派发意向草稿、保存/返回只返回；经历单选立即写当前经历草稿并关闭。满额仍可取消和折叠。可选且有子项时分开选择区/展开按钮；三级的不可选且有子项显示“暂不支持继续展开”，不伪装可选。收起递归清掉后代可见展开状态但保留缓存和已选；请求去重；在飞收起可缓存不重开。目录版本/主体变更作废旧缓存/游标/响应，不改已选业务值；新版本根页成为新缓存起点，旧子页不能拼到新根。失败保留重试入口，区别成功空页。

- [ ] 核对两页原有查询签名、版本字段及行业字典，确认上面适配可无后端更改成立；先记录测试 fixture 的父/子/孙、两个同名不同 ID。
- [ ] 新增失败回归：展开 A→选 a1→收起 A→重新展开，a1 仍选中且只请求一次；加载中收起 A，resolve 后仍关闭；根/子分页失败可重试；换版不混合、旧响应无效；多选第4个被拒但可取消；两模式无“推荐”/“自填行业”；同名 a1/b1 选 a1 时 b1 不选、两项可按各自ID分别取消；经历单选 a1 后仅回填当前经历草稿并关闭，关闭未选择时草稿不变。
- [ ] 运行 `npm test -- src/屏幕/选期望行业.test.tsx src/屏幕/工作经历.test.tsx src/组件/期望行业选择正文.test.tsx src/组件/简历行业选择正文.test.tsx src/组件/行业分类列表.test.tsx src/屏幕/行业目录钩子.test.ts src/组件/弹层框架.test.tsx`，确认因行为缺失失败，不是 fixture/import 错误。
- [ ] 运行 `rg -n '弹层框架|定位=|max-height|maxHeight|overflow' src/组件 src/屏幕`，逐个记录 bottom 消费者是否有被覆盖的 CSS 限高、内部滚动与固定操作区；居中消费者单列为不受 bottom 修改影响。记录检查结论于本Plan；只有真实受影响者补定向断言/Task 5 场景，先更新 task intent，不扩成全量E2E。
- [ ] 实现共享列表/具体控制器和两页接线；删除重复状态，保留既有保存路径。底部框架移除内联 maxHeight 覆盖，caller 72% 不变；列表 flex:1/min-height:0/overflow-y:auto。effect 首开/卸载负责焦点，最新关闭回调用 ref 或稳定事件引用供 Escape 使用，不以每次关闭函数变化重跑首开效果；居中分支不被限高。
- [ ] 重跑同命令须 PASS。弹层单元断言 rerender 后焦点留在刚展开按钮、Tab 边界/Escape/关闭恢复保持，居中定位保持。真实高度/滚动由 Task 5 承担，jsdom 不宣称布局已通过。
- [ ] `git diff --check` 后提交本 Task 精确文件，message `fix: unify industry selection and sheet scrolling`。

完成：两模式两入口共用列表、所有以上行为测试 PASS。停止：现有 catalog 实际需要超过三级才能选定常用项、或适配必须改 API；报告证据，不自行做无限树。

### Task 2: 复用全页城市选择并嵌入岗位表单

目标：岗位新建城市使用全页单选，保存 id/name 原子回填且其他表单不丢；候选现有10城/意向单城保持。非目标：候选备选城市页面、路由/全局草稿系统。

预期编辑文件：
- 新增：`src/组件/工作城市选择正文.tsx`、`src/组件/工作城市选择正文.test.tsx`。
- 修改：`src/屏幕/选工作城市.tsx`、`src/屏幕/选工作城市.module.css`、`src/屏幕/选工作城市.test.tsx`、`src/屏幕/城市查询钩子.ts`、`src/屏幕/城市查询钩子.test.ts`、`src/屏幕/发布岗位.tsx`、`src/屏幕/发布岗位.test.tsx`。
- 删除：无文件；删岗位城市 input+搜索 chips，页面重复城市展示改为共用正文。

依赖检查：Task 1 的弹层/行业测试已进入当前提交且 PASS；岗位仍是 wrapper+keyed `岗位编辑表单`，步骤和 JD 状态在表单实例中。输入来源为原 `use城市默认页` / `use城市搜索`，无新请求层。

生产契约：`工作城市选择正文.tsx` 导出如下数据类型与默认组件；组件内部拥有本次临时选择，挂载从初始值复制，不随 JD/父 rerender 重置。

```ts
export type 城市项 = { 键: string; 名称: string; 副行?: string };
export type 城市组 = { 键: string; 名称: string; 城市: 城市项[] };
export type 城市列表状态 = {
  组: 城市组[]; 加载中: boolean; 错误: string | null;
  可加载更多: boolean; 加载更多: () => void; 重试: () => void;
};
export type 工作城市选择属性 = {
  标题: string; 上限: 1 | 10; 初始已选: 城市项[];
  搜索词: string; 改搜索词: (词: string) => void;
  列表: 城市列表状态; 返回: () => void;
  保存: (已选: 城市项[]) => void;
};
```

选工作城市和岗位 wrapper 分别适配 HTTP/Mock 数据、处理查询和业务派发；展示组件不读 Context/router。默认目录的推荐/分组沿原城市视觉（删除的是行业推荐）；已选芯片可取消，空保存 disabled，单选不显示多选计数。`use城市搜索` 原返回字段保持兼容，新增 `错误:string|null`、`重试:()=>void`；默认页同样暴露错误/重试供正文，既有消费者可不传。失败显示错误与重试，成功0条显示无结果。查询代次在卸载/主体变更/新搜索时失效；重试使用当前词，分页错误保留已有项和当前游标，不装成成功空页。

岗位：在 `岗位编辑表单` 内加本地城市打开状态；原表单保持挂载，通过 hidden 隐藏整个原步骤/操作区使其退出键盘和无障碍树，兄弟全页正文填满原页面容器。返回/Escape 关闭并恢复城市行焦点；无新 history 条目，浏览器返回沿旧 route 离开。只新建可打开，发布后城市行保持锁定。

本次选择查询/临时状态随子视图销毁；页面查询 scope/回填校验捕获当前岗位与主体身份，过期保存不得落旧草稿。保存先按键从当前目录或原合法引用表取实际引用，再一次性回填显示名及 `地点引用`；不能构造候选操作。JD 源城市只作打开时搜索初词，不产生 location_id；打开之后迟到 JD 不覆盖临时值；用户保存的引用优先于同轮迟到导入的城市提示。

- [ ] 写失败测试：两模式岗位填 JD/企业/薪资→城市打开→选择/取消→原字段不丢；选择后保存 id+name；空禁用；同名不同ID正确；编辑锁定；候选草稿派发0次。HTTP 失败→重试/空结果分别断言。
- [ ] 运行 `npm test -- src/屏幕/选工作城市.test.tsx src/屏幕/城市查询钩子.test.ts src/屏幕/发布岗位.test.tsx src/组件/工作城市选择正文.test.tsx` 确认新行为 FAIL。
- [ ] 提取同份正文并适配两业务；实现错误/重试及 generation cleanup；岗位 local subview 不替换/卸载 form。增加延迟 JD / 城市请求、关闭重开/切主体反例，禁止旧响应回填。
- [ ] 同命令 PASS；候选10城/意向1城回归 PASS；断言隐藏原表单不能被角色查询和 Tab 访问、Escape 返回不离开岗位页面。实际浏览器由 Task 5 证明。
- [ ] `git diff --check` 后提交精确文件，message `feat: reuse full-page city picker in job editor`。

完成：同一正文覆盖两模式和候选/岗位，原岗位 DTO 只写 location_id，所有草稿隔离反例 PASS。停止：必须更换路由或持久化才能保留草稿时，先检查是否错误卸载了表单，不自行扩大设计。

### Task 3: 岗位月薪复用薪资区间层

目标：社招/校招月薪使用双滚轮且保留原金额域、取消语义。非目标：日薪/时薪、年薪月数、后端单位或金额协议。

预期编辑文件：
- 新增：无。
- 修改：`src/组件/薪资区间层.tsx`、`src/组件/薪资区间层.module.css`、`src/组件/薪资区间层.test.tsx`、`src/屏幕/发布岗位.tsx`、`src/屏幕/发布岗位.test.tsx`。
- 删除：无文件；月薪主界面两输入改选择行，原数字规则复用到弹层精确输入，不删除日/时薪需要的控件。

依赖：Task 2 岗位本地城市行为已 PASS。读取既有 `薪资区间层` props、`src/数据/后端映射.ts` 的岗位薪资转换与 `发布岗位` 的 `拆薪资带`/校验；现有 K 数字不乘1000。现有所有薪资层消费者默认行为保持。

生产契约：给 `薪资区间层` 现有 props 增加 `用途?: '求职' | '岗位'`，默认 `'求职'`；只岗位月薪传 `'岗位'`。`周期`、`下限:number|null`、`上限:number|null`、`确认`、`取消` 原签名不变，无数据源模式参数。

岗位用途月薪常用档0..100步1，将传入有限有效非负整数加入各列并排序去重（当前123/234应原样；10000等可解析服务器已有整数也不得截断）。精确输入次级入口采用 digits-only、至多4位，合法范围0..9999；未编辑的已有超范围值仍保留，禁止一打开即经过输入截断。档位数量有界，不生成上万 DOM。空弹层可见默认10/11，只有确定进入草稿。倒置显示字段错误且不关闭；空/非法不能确认；取消/Escape/遮罩零回填。求职用途保留旧档位、默认值、小数/大额精确往返以及上限取max策略，不套岗位整数校验。

- [ ] 增加失败回归矩阵：两模式×社招/校招×新建/编辑；0、9999、123/234、服务端10000原样确定；空打开取消不填值；输入倒置30/20停留报错；修正20/30才回填；求职12.5/123.5不取整，求职倒置仍沿旧max。
- [ ] 运行 `npm test -- src/组件/薪资区间层.test.tsx src/屏幕/发布岗位.test.tsx` 确认新用例因月薪入口/策略缺失 FAIL。
- [ ] 添加用途分支、次级输入及月薪选择行；所有 state 只在弹层本地变化，确认才由岗位表单回填原字符串字段。断言最终请求的上下限和单位与原映射完全相同，原岗位提交校验仍在。
- [ ] 同命令 PASS，检查非月薪使用点没有被月薪分支接管；金额9999场景 option 数量仍为常用档加最多两个当前值。
- [ ] `git diff --check` 后提交精确文件，message `feat: use shared salary wheels for monthly jobs`。

完成：行为矩阵和金额往返 PASS。停止：出现后端只接受不同金额倍率/小数的证据时保持现有协议，报告冲突，不顺便转换。

### Task 4: 就读年份可空并保留 Mock 数据预填

目标：可见年份就是保存年份，消除隐藏确认 flags；默认 Mock 演示有效、空数据真实为空。非目标：改出生年月、未来年份上限、所有 Mock 初始资料或其他页面 end_month:null 合同。

预期编辑文件：
- 新增：`src/状态/就读年份演示预填.test.ts`。
- 修改：`src/组件/可访问滚轮.ts`、`src/组件/内嵌双滚轮.tsx`、`src/组件/内嵌双滚轮.test.tsx`、`src/屏幕/就读时间段.tsx`、`src/屏幕/就读时间段.test.tsx`、`src/数据/模拟数据.ts`、`src/状态/初始状态.ts`。
- 删除：无文件；删除就读页面的2021/2025兜底与两侧“已确认”flags。

依赖：Task 3 薪资层的数字滚轮行为已 PASS；核对 `取就读年份预填` 的 eligibility 与现有草稿保存路径，不更改建议算法。`初始状态.ts` 既有简历教育为2014/2017，应原样优先，不把它误称空 demo。

生产契约：`use可访问滚轮` 参数在原类型上仅做 `T extends number | null` 的泛型，`选项:readonly T[];值:T;设值:(值:T)=>void;行高:number`，返回字段不变。数值消费者仍推断 T=number，不强迫其 setter 接受 null。

`内嵌双滚轮` 使用判别联合 props：旧 props 不变且 `允许空值?:false`；新增分支 `允许空值:true` 时 `左值/右值:number|null`、`设左值/设右值:(值:number|null)=>void`，档表仍 number[]，组件内部各加一个 null 项显示“请选择”。其余名称/单位参数保持。null 时只有空项 selected，所有数字 aria-selected=false；use可访问滚轮 依序号处理 null，不用数字哨兵污染保存值。程序定位不得调用 setter；点击/键盘/真实滚动可选，选择空项即清空。

页面入学/毕业 state 为 `number|null`，档仍2000..2030；未填就不拼日期，点击下一步标记对应字段持续错误，修改该项清除，倒置也显示错误且0提交。有效值写 `YYYY-09` / `YYYY-06`；清空写回现有草稿字段空字符串（不扩展 DTO）；保存成功→确认 education_period→导航时序保持，失败不确认不跳转。有效当前值/eligible建议直接下一步。

事实优先级：`就读时间段.tsx` 原实现是 `年份初始.start ?? 2021` / `年份初始.end ?? 2025`，有效已有值从来优先于这组兜底；`初始状态.ts` 实际默认教育是2014/2017。因此批准Spec §4.5/§8的2021/2025描述按“保留这组演示预填数据”执行，不解释成覆盖已有有效资料的迁移。这遵守用户“Mock数据部分还是留着预填数据”的明确要求；不改批准Spec自证。

Mock 数据契约：在 `模拟数据.ts` 导出 `就读年份演示预填 = { 开始:'2021-09', 结束:'2025-06' }`，仅在既有 Mock 初始教育数据构造时使用；对象合并顺序为显式演示种子→既有有效教育字段，因而既有2014/2017不变。2021/2025演示 fixture 直接使用这个生产种子给页面完整教育段，不由页面判断模式补空。`创建初始状态` 继续优先完整缓存；缓存中的空字段/空数组不能合并演示种子；Backend 初始教育仍空。禁止逐次 render/刷新/保存时自动回填。这样保留演示数据来源，且不更改现有非空 Mock 资料。

- [ ] 写失败测试：Mock生产种子2021/2025直接下一步；通过实际 `创建初始状态` 默认Mock路径、不给教育覆盖fixture，断言原默认2014/2017仍原样且可直接下一步；Mock/Backend同空输入无数字选中、点击2021/2025可直接下一步；单侧、越界、eligible/noneligible建议；点空项清空后重开不补回；保存失败不确认不导航。
- [ ] 运行 `npm test -- src/屏幕/就读时间段.test.tsx src/组件/内嵌双滚轮.test.tsx src/状态/就读年份演示预填.test.ts`，确认新行为 FAIL。
- [ ] 实现受限泛型与判别联合、页面 nullable 真相和字段错误；迁移演示常量到数据层，保留缓存优先与 Backend 空态。草稿更新仍通过既有操作，不新增持久化。
- [ ] 同命令 PASS；运行 `npm test -- src/组件/数字滚轮层.test.tsx src/组件/年月滚轮层.test.tsx src/组件/薪资区间层.test.tsx` 验证共享 hook 的非空消费者；`npm run typecheck` 证明旧 setter 类型无需放宽。出生年月页面不改产品规则。
- [ ] `git diff --check` 后提交精确文件，message `fix: represent empty education years without losing mock seeds`。

完成：Mock显式种子、既有样例、空 fixture 三者分明，年份保存与视觉一致。停止：Mock缓存/初始化适配不能区分明确空值与未初始化时先核实数据来源，不能将所有空值补种子。

### Task 5: 用实际页面验证两模式滚动、焦点和完整操作

目标：把 Task 1–4 的真实布局与用户操作固化到现有浏览器入口。非目标：新建测试框架、全站视觉基线或启动真实后端。

预期编辑文件：
- 修改：`e2e/数据源模式.spec.ts`。
- 新增/删除：无。复用该文件已有 Mock 导航和 Backend route fixture，不提取全站通用 fixture、不新增配置。

依赖：Task 1–4 在同一当前候选，各自定向测试已通过。读取 `playwright.数据源模式.config.ts` 与现有 fixture；新用例都带 `@picker`，同时各带 `@mock` 或 `@backend`，只跑 mock-stg/backend-stg，不跑 annotation。Backend 所有 API 请求 route fulfil，意外未匹配请求使测试失败，不能落到 stg；Mock 记录真实 API 写入数必须0。

浏览器合同：测试走实际页面和既有登录/种子入口，不独立拼一个仿制组件。两模式采用同形行业数据/已选状态（fixture遵循既有Mock字典形态），验证同布局/标签/折叠动作；差异只在数据接线。固定手机390×844与短屏844×390；直接定位 scrollable list，断言 `scrollHeight > clientHeight`，操作真实滚动后最后项可点击，向上滚回首项可达。面板 bounding box 位于视口，最大高度受72%约束（允许边框像素误差），展开两根不抢焦点；展开/分页再测，短屏关闭可达。

- [ ] 在现有 describe/fixture 内新增 @picker 场景：经历行业两根展开→滚到底选中→重新打开已选仍在；期望行业折叠不丢选中/无推荐；至少一个其他底部弹层（薪资）和居中确认框首开、Tab、Escape、关闭恢复，确认底层改动不截断。
- [ ] 新增岗位城市场景：填其他字段→打开全页→键盘不能进入原表单→取消保留→保存回填并发布捕获 location_id；验证不导航候选 route、不写候选草稿。执行社招/校招月薪确定/取消/精确输入/倒置，并检查提交原金额。
- [ ] 新增两模式就读年份场景：先用不注入教育fixture的默认Mock会话验证实际已有2014/2017原样且直接继续，再以显式Mock2021/2025演示数据验证该种子直接继续；空值“请选择”时程序定位不选年，直接点2021/2025成功；真实滚动后值保存，硬刷新沿原草稿恢复；选择空项再刷新不补默认。用真实浏览器补足 jsdom 不会产生布局/程序 scroll 事件的缺口。
- [ ] 首次运行 `npm run test:e2e:data-source -- e2e/数据源模式.spec.ts --project=mock-stg --project=backend-stg --grep @picker --workers=1`。预期所有新场景 PASS；若发现漏实现，先以失败 trace 定位，最小修复限定在 Task 1–4 已声明文件，补定向单元测试并重新执行失效场景；这属于 Task 5 完成前，尚未进入收尾。
- [ ] 记录每个模式实际执行数量与viewport、源码SHA、fixture配置和trace/原始输出位置，不记录token等凭据；0 tests不是PASS。将本Task文件与必要修复逐项提交，message `test: cover shared picker interactions in both data modes`。

完成：真实 DOM 滚动和完整用户操作均有两模式证据，Mock零写入，HTTP fixture无网络逃逸。停止：Chrome/端口前置缺失按环境问题处理；fixture PASS不代表真实Backend通过，不能以缩小视口断言或关闭焦点检查取得通过。

## 实施后收尾（不计入 Task count）

1. 同一主控先完成执行 skill 要求的宿主内全局 review（未要求不额外新增），结束所有实施 Task，退出 Task/global review 循环；本节覆盖默认 finishing-a-development-branch，不追加菜单、自动整套测试或另一个工作区。
2. 冻结完整候选，调用异构只读 review-loop：Codex→Claude，Claude Code→Codex；传批准 Spec 精确版本、固定 base/head、用户目标/非目标、已有证据。reviewer 默认不跑测试，使用该 skill 的 `../_shared/review-contract.md`。轮间仅修复相关轻量单元/静态检查，裁决按 skill，结果就地记本Plan。不在实施Task中提前调用、不在final gate确认后再调用。
3. 异构 review 返回可继续后重算 actual diff 与消费者；确认前完成适用完整最小 L0–L2：Task 1–4 命令的去重文件并集、Task 5 的 @picker 两项目，以及 `npm run typecheck`、`npm run lint`、`npm run build`。它们分别证明业务边界、浏览器交互、类型、静态规则、生产打包。已有同候选有效 PASS 可复用；不得同一有效候选机械全部重跑。若共享 hook/框架发现另有受影响消费者，按实际引用补最小文件并记原因；无证据不扩成全套 E2E。失败自主修复，仅补失效项，不回到 Task/global/异构 review；记录这些修复不在原 review commit 内。
4. 本仓库无 affected CLI，主控在本Plan记录完整责任清单、每项命令/selection/源码SHA/输出位置/依赖/运行时/fixture/环境、失效理由。只读 fetch 后记录 pre-gate target SHA。所有适用 L0–L2 无缺口才展示具体 final gate：候选SHA、targetSHA、已验证证据、预计复用/补验、required local dogfood B02/B04及行业/年份补充步骤、账号/环境准备与清理、merge origin/main 和普通push动作、风险及自主恢复边界，并等待用户明确确认。
5. 正式 L3 前置：实际后端checkout由执行现场配置的 `AGXP_MONOREPO_DIR` 提供，按 `docs/dogfood/真实后端行为验收.md` 核对 local工具、双账号/fixture、运行环境和浏览器；没有权限/环境记BLOCKED，由同一执行者负责补齐，不能宣称就绪合入或改跑Hosted全套。使用该指南既有报告/receipt位置，不另造规划handoff。真实数据写入走UI，临时对象按指南清理；年份额外场景用专用可建档候选，不破坏B02基准账号。
6. 获批后读取 development-workflow 的 `references/final-integration.md` 与其 operative contract：fetch→记录 `final_target_base`→merge `origin/main`→按 `final_target_base..HEAD` 重算完整责任→复用有效L0–L2，仅补缺口→required development L3→cleanup后再次对账。基准/候选/环境未变时L0–L2启动0个runner；冲突修复/新依赖/fixture或cleanup影响才使相关证据失效。恢复限已批准产品范围，测试失败由执行者归因最小修复，不再调用异构review；产品契约变化/缺外部资源/target race才停止说明。
7. 全部责任无缺口后再次fetch核对target未推进，普通fast-forward push（禁止force）。target race不自动追赶，展示变化和补验范围重新取得final gate确认。成功后更新task intent completed和本Plan实际结果；不把计划、fixture通过、review通过或等待批准写成已合入。

## 文档 review 记录

批准契约：Spec revision `ad6abf85c3a7460731333281285bfc8d40971bfd` / blob `e84dc211ec1931eba84557b079b5e50a94cddbe6`。冻结范围仅Spec与本Plan。

首轮：Claude Opus/high，候选 HEAD `cd490673`，Spec blob `6d291ef4`，Plan blob `94fbdc72`。进程成功，工作树状态/HEAD/受审文件指纹 guard PASS，无测试/写入。Reviewer 额外读了少量源码和配置，违反本次仅文档边界；记录此偏差，复审明确禁止额外源码读取，首轮不单独作为最终严格文档审查结论。

|意见|类别/严重度/必要性/复杂度|裁决与依据|
|---|---|---|
|1 默认Mock必须改为2021/2025|契约违反 / Important / required / 不变|拒绝要求覆盖既有2014/2017的修复。旧页面已有值优先，默认Mock已有2014/2017，2021/2025只在缺值时兜底；用户明确要求保留Mock预填。批准Spec同时要求保留既有资料，因此以现有值优先解释示例年份，不做资料迁移。接受其测试证据提醒：补真实默认Mock初始化/页面直接继续，显式2021/2025种子另测，不拿注入fixture冒充默认路径。|
|2 底部弹层影响检查缺口|契约违反 / Minor / required / 不变|接受并补rg检查、逐个记录CSS限高/滚动结论，只为实际受影响者补最小验证，不加全套E2E。|
|3 行业适配文件含糊|契约违反 / Minor / required / 不变|接受文件定位澄清；固定在已列出的行业目录钩子.ts，展示层仍纯展示。拒绝“适配放hook必然违反展示纯净”的推断，Spec仅禁止展示读DTO/模式，具体数据控制器不属于展示。|
|4 同名ID/单选断言缺口|契约违反 / Minor / required / 不变|接受，写明各自ID独立选择/取消和经历单选只写当前草稿后关闭、无选择关闭不改。|

Planner附加自检：既有薪资区间层.test.tsx由“新增”改为“修改”，纳入薪资次级输入样式文件；补行业hook参数类型，不改变产品合同。修订后由同一Claude session仅复审文档和上述裁决。

第二轮：Claude Opus/high，同一review session，候选HEAD `7b2e85d6`、Plan blob `0cdf667e`，批准Spec引用不变。reviewer确认只读文档及限定版本差异，未读源码/其他配置、未运行测试、未写文件；状态/HEAD/指纹guard再次PASS。复审接受第1项裁决，确认第2–4项已解决，`## Findings` 返回精确 `NO FINDINGS`。本loop在2轮结束，无未解决有效required项；本行仅追加最终review结论，不改实施合同。产品尚未实现，实施测试与真实后端验收尚未运行。
