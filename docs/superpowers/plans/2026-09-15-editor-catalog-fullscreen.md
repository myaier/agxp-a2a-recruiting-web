# 第一批目录选择全屏化与已确认缺陷修复：实施 Plan

日期：2026-09-15。版本：v1.1。当前阶段只交付文档，不实施产品代码。

## Header

- Goal：五个编辑字段改为全屏选择；修复学校/专业重复选择；对齐热门城市名称；期望职位 Backend 复用 Mock 的二级标题、三级按钮布局。
- Architecture：同页子视图 + 一份轻量外壳；现有目录正文、页面草稿和数据适配继续复用。期望职位只拆出页面专属纯展示组件和本地目录钩子。
- Tech Stack：现有 React / TypeScript / CSS Modules / Vitest + Testing Library / Playwright；不加依赖。
- Spec：`docs/superpowers/specs/2026-09-15-editor-catalog-fullscreen-design.md` v1.2；批准 revision `711ebfbddf34c5c646aeef2dda79a782addf45d2`，blob `5bae22b7414f0df573bfffa2e25860c3bcec2326`。后续批准记录更新不授权正文变化。
- Repository：`myaier/agxp-a2a-recruiting-web`；执行工作区 `.`；target `origin/main`。前端调查代码基线 `eeaead9abadfd1e87c4abda19fd3de5a6a66af63`，规划分支 `audit-option-components-editors`；禁止把分支名当成已部署状态。

## Global Constraints

1. 完整读取 `CLAUDE.md`、`AGENTS.md`。用 Git 验证批准 Spec 对象及最终 prompt 固定的 Plan 对象存在；当前 Spec 与批准正文只允许批准记录差异。不依赖聊天截图：预期职位布局见本 Plan 的接口/例子及 Spec §5.7。
2. 复用工作区 `.`，不创建第二用户工作区，不 stash/reset/clean。不推送、不合目标分支直到实施后的人工 final gate。开工通过 development-workflow 的 `scripts/task_intents.py start` 登记路径并核查已有 intent；按该 CLI 的帮助填写当地参数。
3. **最小实现、现有样式**：使用 `通用.tsx` 的返回栏、现有字段行、搜索框、按钮、颜色、圆角、间距和安全区。期望职位复制现有 Mock JSX 的布局及 `选期望职位.module.css` 类名；不重做视觉稿。不改共享 `弹层框架`，不引入通用树、全局选择管理器、路由或状态库。
4. 非目标：公司对象选择、薪资/日期等小选项、城市两栏结构、引导问答的职位交互、招聘端类别分组重设计、后端 API/schema/数据迁移。只有出现其它真实消费者且现有组件不能满足时，才另提通用化。
5. 五个新全屏入口均为同页子视图。父表单 DOM 保持挂载，通过 `hidden` 且显式 `display:none` 隔离；没有父表单卸载、重新初始化、history 条目。返回/Escape 取消选择，恢复打开字段焦点和原滚动位置；浏览器返回仍沿原路由离开。子视图打开前关闭互斥浮层。
6. 子视图只有选择有效候选才原子写父草稿的名称/ref 并关闭。搜索输入、翻页、取消都不写父草稿；不调用保存资源 API，不添加确认按钮。Backend 只提交有效 ID；Mock 按现有模型值处理。已存显示名但无 ID 的旧值可展示，不能假造 ID。
7. 全屏外壳不管 API/数据源/业务状态。请求、游标、过期响应、版本、真实引用在页面或页面局部 hook 内。错误不能伪装成功空态；既有成功页在追加请求失败后保留并能重试；切换条件的迟到响应不得覆盖当前状态。
8. 每 Task 的新增/修改/删除清单为预期边界；发现实际必需遗漏先核查消费者并更新 intent、Plan 理由，不能借此扩大批准范围。测试与 fixture 改动同样计入边界。不使用整个目录作授权。
9. 顺序执行 Task 1–8。Task 间依赖只要求前置成果进入当前已验证分支，不要求中途合 main；本次外壳只有本批消费者，不是跨仓共享基础设施。完成每 Task 做聚焦验证和逻辑提交，不清理用户变更。
10. 开发采用有意义的行为回归测试先复现，再实现。不得为 CSS 属性逐条镜像断言；真实滚动/布局/焦点由 Task 8 浏览器验证。所有判断都注明真实证据；未验证手机软键盘就不能宣称覆盖。

## Task index

Task count: 8
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|外壳与岗位类别；无依赖；焦点/父表单边界|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|2|简历教育学校/专业；依赖 1；草稿引用与子页查询|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|3|简历行业；依赖 1；既有查询复用|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|4|公司行业；依赖 1；双模式共用视图与权限|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|5|onboarding 学校/专业稳定点选；无依赖；异步状态|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|6|城市名称及有限别名兼容；无依赖；四处消费者|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|7|期望职位展示/状态分离；无依赖；自动三级加载|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|
|8|浏览器布局与跨入口回归；依赖 1–7；实际交互证据|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|Top 5–10（Claude Code: sonnet）|

三角色分别检查实现、批准语义、最小复杂度与代码质量；各 Task 都涉及状态或跨入口行为，使用同一中档基线即可，不以范围大为由上调顶级档。Claude 每 Task 用独立 implementer 及两个顺序 reviewer；Codex 按 executing-plans 与宿主可用能力执行，不解析 Claude alias。

**计划本身复杂度：高。** 多处表单、两种数据源和浏览器交互，验证成本较高；不等于需要新增架构。

**零上下文漂移风险：中。** 数据层级和名称已核验，公共边界在本文冻结；剩余风险是移动端高度链、既有草稿及异步状态组合。执行模型只按此风险选择当前可用的行业 Top 5–10 中高性价比模型。

## 已核验的目录事实及样例

核验来源：后端仓库 `agxp-monorepo` revision `495177f4cb7b6382b9a844b5163a58d52eb01ab6` 下 `apps/recruitment/internal/catalog/data/manifest.json`、`job_categories.csv.gz`、`locations.csv.gz`（后两者同目录），读取时这些文件无工作树修改。只读数据核验，不代表线上部署验收；本任务不修改后端仓库。

- 职业数据集 `pm-2026-08-22-87684eee3610`：282 个节点，13 个一级、42 个二级均不可选，227 个三级可选。根最多 10 组，每组最多 16 个叶子。现有目录数据支持目标布局，无需新 API。
- 产品根 `tax_42k463flvnxtm6ayeabxhuiequ`；产品经理组 `tax_itkhtoz22mnbizmljydkoyegbi`；其中产品经理叶子 `tax_2sssgq7pajylyrsooukbgorpye`。同名组/叶子必须以 ID 区分。
- 页面显示：左「产品」保持高亮；右「产品经理」标题下有「产品经理」「AI产品经理」等按钮，之后是「游戏策划」「高端产品职位」标题及各自按钮。点击标题不发请求、不导航；选择左根后自动加载当前根的所有已加载二级组的三级首屏。
- `查询Taxonomy('job-categories', { parentId?, q?, cursor?, limit:50 })` 延续现有签名：无 q/parent 返回根，有 parent 返回直接子项，q 是全局搜索、可命中父节点。使用现有返回类型的 `items/nextCursor/catalogVersion`，以源码类型名核对，禁止改传输合同。
- 城市数据集 `cities500-2026-08-22-59d087eca781`。以下 22 个现有 ID 均在快照中有可选记录且国家匹配；顺序/数量/国家不变。海外英文也是目录实际名称，不统一加“市”。

|旧名|目录显示名|固定 ID|
|---|---|---|
|北京|北京市|loc_7gn74qrcymqcwwuqwotm47dbba|
|上海|上海市|loc_ugt5s3vsvxs3fvd2llx7zc6fqe|
|深圳|深圳市|loc_vy3ebpr35fdpnf47vxjbdkeofu|
|广州|广州市|loc_52x36rfspi2ujlvgf6armiypva|
|杭州|杭州市|loc_rtahepw6oeduie7r2y6uuvuone|
|成都|成都市|loc_rnwcahrqvqml63ghf4nppnsb6m|
|南京|南京市|loc_qo4w5gb36ynsb52vyfjqc5sriq|
|武汉|武汉市|loc_rhxwvluw34qlzjlvhbxkllbumi|
|苏州|苏州市|loc_xxbtotpzlokmiqu4hu3i2y7vou|
|西安|西安市|loc_gpmoc4foa4ebtfoofdjysig5ai|
|长沙|长沙市|loc_su65jpfrwv5ntghlvt2exhxvzq|
|合肥|合肥市|loc_rxsr3lujbdmye7l4jlhzzjkg4e|
|新加坡|Singapore|loc_qdyx7r6fcyjrcokobaxsorhhrm|
|东京|Tokyo|loc_gindn4bs4n7mvpn3faaijxbffu|
|首尔|Seoul|loc_pswxk2zhx7ojs77li77rrnamdu|
|纽约|New York City|loc_yznqm7rztcj3n3g44o32kpafr4|
|旧金山|San Francisco|loc_l5z6vokf4ygtue6np52acqgfim|
|洛杉矶|Los Angeles|loc_p23lys7rl6cfu5nv34z3qxdgdq|
|伦敦|London|loc_pioooosgfiwtihwvqmpfktcsxi|
|悉尼|Sydney|loc_j2huzmsvhzfnpeoww52qe6nkam|
|温哥华|Vancouver|loc_savwtbprerwrbtcbxuvu2trvdy|
|多伦多|Toronto|loc_lfgywjg4b2fvfw2asycwtc3mwu|

## 冻结的页面局部接口

### A. 全屏选择外壳

新增 `src/组件/全屏选择外壳.tsx`，命名导出 `全屏选择外壳`，props：`{ 标题: string; 关闭: () => void; children: React.ReactNode }`。使用已有 `返回栏`，`role="dialog"`、`aria-modal="true"` 与可访问名称；首次焦点在返回按钮，Tab/Shift+Tab 限于子视图，Escape 调用关闭；父层负责隐藏自己及关闭后的焦点/滚动恢复，不给壳增加父状态/模式参数。不得在壳卸载时抢先 focus 尚未显示的父元素。

壳作为已有 `次级页外壳` 的内容兄弟，`flex:1; min-height:0`，标题固定，正文纵向 flex；不再嵌套第二个带顶部安全区的 `次级页外壳`。局部 CSS 只提供满高/溢出/底部安全区，目录列表自己滚动，不制造双滚动。禁止用 `height:100vh` 绕开现有应用容器。

父页打开处理器在设置打开状态前记录触发元素及父滚动节点的 scrollTop（存在多个实际滚动节点则分别记录）；关闭后由父页 layout effect 在 wrapper 已恢复显示时，先 focus({ preventScroll: true }) 到仍连接的触发元素，再恢复已记录 scrollTop。首次挂载不恢复焦点。不提取新的焦点/滚动管理器；Task 1–4 在各自父页使用相同少量 refs/effect 写法。

### B. 期望职位纯展示

新增 `src/组件/期望职位选择正文.tsx`，命名导出 `期望职位选择正文`。页面模型（只在该组件/局部 hook 使用）：

```ts
type 目录尾态 = { 加载中: boolean; 错误: string | null; 还有: boolean; 加载更多: () => void; 重试: () => void };
type 期望职位项 = { 键: string; 名称: string; 选中: boolean; 禁用: boolean };
type 期望职位组 = { 键: string; 标题: string; 项们: 期望职位项[]; 尾态: 目录尾态 };
type 期望职位选择正文Props = {
  搜索词: string; 改搜索词: (词: string) => void;
  根项们: { 键: string; 名称: string; 选中: boolean }[];
  切换根: (键: string) => void; 根尾态: 目录尾态;
  组们: 期望职位组[]; 右尾态: 目录尾态;
  已选: { 键: string; 名称: string }[];
  切换选择: (键: string) => void; 移除: (键: string) => void;
  保存: () => void; 可保存: boolean; 返回: () => void;
};
```

展示含当前页返回、大标题、搜索、左右栏、底部已选/保存；直接复用原 Mock CSS。空标题组仅用于搜索直接命中的叶子平铺，隐藏空标题；其余标题使用语义 heading，不渲染 button。禁止导入数据源模式、Context、BFF DTO、API 或路由。`禁用` 只用于不可操作/达上限提示，父节点不伪装成职位按钮。

页面保留真实 ref、最多选择数、保存和跳转；Backend hook 提供目录状态及 ID 查找，Mock 映射现有 `职业分类树`，无 API。异步尾态回调由 hook 提供，展示不持游标。细节内部 helper 不冻结，不新造公共领域模型。

## 测试选择与责任

1. 防止的失败：子页关闭丢表单/引用、父表单仍可聚焦、旧搜索覆盖新结果、点选触发清列表、城市重复键/错 ID、职位父节点下钻、组分页相互污染、权限/资源保存时机变化。
2. 开发最小命令为每 Task 列出的 Vitest 文件；修改测试先确认失败确实来自目标行为，再实现后转绿。`npm run typecheck` 在接口任务完成后用作静态验证；不每 Task 跑整套 build/e2e。
3. 前移真实边界条件：若实际目录 DTO/版本处理与本文样例不同或需改变 API/权限接线，先读现有 API 类型及后端快照，聚焦验证再继续；触及批准之外的后端合同则停止扩围。不用 mock 自证未知接口。真实服务验证采用 `docs/dogfood/真实后端行为验收.md` 的定向路径，需要合法 URL/账号/运行模式；缺失如实报，不猜凭据。
4. 最终权威责任在实施主控：重算实际 diff/消费者，执行所选 Vitest、`npm run typecheck`、`npm run lint`、`npm run build` 和 Task 8 指定 Playwright 子集；现有 CI 的 UI regression 规则保持，不通过调阈值/删快照让 gate 过。收尾只跑尚无有效证据的责任；不宣称整个测试套件通过。
5. 已有诊断证据：学校/专业两条临时复现测试约 2.22 秒，期望职位两模式两条约 488ms，均证实旧行为、临时文件已移除。这不是修复 PASS；正式任务测试、浏览器成本未知。后端 gzip 只读核验已完成，无需再下载全目录或跑后端 suite。

正式 L3：后端 `none`（无后端实现变更）；前端真实服务验证 `conditional`：若 Task 7 真实 DTO/目录结果不能由已核验数据和既有适配合同解释，或最终 diff 改变认证/权限/持久化接线，依 `docs/dogfood/真实后端行为验收.md` 对受影响的路径验证。实施主控负责判定及记录具体 selection，需 `AGXP_MONOREPO_DIR`（如采用本地后端）、服务 URL、账号与对应环境许可；按 final integration contract 在人工 gate 后执行正式 L3。缺环境记录 BLOCKED/selection_gap，不把条件为空写成 PASS；无上述变化则记录不触发。发布 full sequence 属独立发布流程。

### Task 1: 最小全屏外壳与发布岗位类别

目标：职位类别从抽屉改为全屏，保留现有两栏下钻语义及自动岗位名称规则。依赖：无；先确认现有 `岗位职业分类正文Props` 与 A 契约。

预期编辑文件：
- 新增：`src/组件/全屏选择外壳.tsx`、`src/组件/全屏选择外壳.module.css`、`src/组件/全屏选择外壳.test.tsx`。
- 修改：`src/组件/岗位职业分类正文.tsx`、`src/组件/岗位职业分类正文.test.tsx`、`src/屏幕/发布岗位.tsx`、`src/屏幕/发布岗位.test.tsx`。
- 删除：无。

输入/输出：正文现有根栏/子栏/展开/选定/关闭签名不变；页面仍处理真实 ref 与草稿。新壳按 A；只替换容器/标题，不强加期望职位分组或新搜索。

- [ ] 加回归：改过岗位名称后进入类别，返回/Escape 草稿、步骤、字段原值不变；选择合法项只更新类别 ref，手改名称不覆盖；初始名称为空/等于旧类别才跟随。
- [ ] 实现 A 并测试焦点闭环、Escape、卸载恢复；不要修改共享弹层。
- [ ] 在类别打开前记录父滚动位置和触发元素，关闭后按 A 的父页时序恢复；原城市行为只作结构参考，不能假设它已实现滚动恢复。
- [ ] 将类别子视图移出现有父表单 hidden wrapper，父 wrapper 隐藏条件含城市或类别；避免把全屏正文藏进自己的祖先。复用城市已有保留挂载做法。
- [ ] 将正文旧抓手/遮罩替换为 A；已发布类别不可改、非 selectable 不提交、企业选择与薪资层不变。
- [ ] 执行 `npm test -- src/组件/全屏选择外壳.test.tsx src/组件/岗位职业分类正文.test.tsx src/屏幕/发布岗位.test.tsx`，预期无失败；再 `npm run typecheck`。

失败反例：CSS 覆盖 hidden、关闭时触发提交、切换步骤丢 JD/企业草稿。完成条件：上述行为绿且两模式入口一致；发现需改职位 API 则停止扩围。

### Task 2: 简历教育学校和专业全屏子视图

目标：教育编辑页两个输入候选改为字段点击行/全屏选择，同一实现服务 onboarding 和我的简历。依赖：Task 1 的 A 已验证。

预期编辑文件：
- 新增：无。
- 修改：`src/屏幕/工作经历.tsx`、`src/屏幕/工作经历.test.tsx`。
- 删除：无。

局部契约：教育编辑父页维护 `打开目录: '学校' | '专业' | null`；文件内私有教育选择子组件接收字段种类、当前名称/ref、现有目录查询和 `选定(目录选择值)`/`关闭()`。复用源码中的 `目录选择值` 类型，不引入跨页事务层。搜索/候选/游标在子视图；关闭销毁查询，原教育草稿保留。Mock 用现有高校/专业名录映射稳定键，Backend 用现有目录适配，保留旧预填展示。

- [ ] 测试学校/专业各自取消不会清父 ref，选中同步名称/ref 且只关闭，资源保存由原表单提交触发。
- [ ] 父编辑页继续挂载；仅替换学校/专业字段与候选的显示位置，保持学历、时间、描述、教育 ID 和保存回调。
- [ ] 子页复用 A 和 `教育目录候选列表`，每次打开将父草稿当前名称复制为子页搜索初词并查询；空名称保持现有空词行为。旧已选值在子页当前值区域持续可见，目录匹配项按 ref ID（Mock 按稳定模拟键/名称）标记，不为目录缺失的旧文本伪造可选行；查询去抖/过期请求/版本保持现有合同，ID 标记选中；保留重试/加载更多。重复打开不能成为永久空列表。
- [ ] 初始复制后，子页搜索使用独立 state，后续编辑搜索不写父草稿、不取消父选择。打开/关闭按 A 记录并恢复父页滚动及触发焦点。后台模式未选有效项不得把自由文本当 ref。
- [ ] 执行 `npm test -- src/屏幕/工作经历.test.tsx`；断言两个路由入口复用、同名不同 ID、取消/保存、搜索失败重试。

失败反例：进入子页把另一字段引用清掉、取消搜索更改资源、返回卸载整个教育表单。完成条件：两字段双模式用例绿；不在这里抽取 onboarding 通用控制器。

### Task 3: 简历工作/实习行业全屏

目标：换外壳保留行业目录行为。依赖：Task 1 的 A。

预期编辑文件：
- 新增：无。
- 修改：`src/组件/简历行业选择正文.tsx`、`src/组件/简历行业选择正文.test.tsx`、`src/屏幕/工作经历.tsx`、`src/屏幕/工作经历.test.tsx`。
- 删除：无。

输入/输出：`简历行业选择正文Props` 的目录/已选键/选择/关闭不变，`行业分类列表` 与 `use行业目录` 及 Mock/Backend 适配不变；单选回填名称/ref，关闭，不立即保存经历。

- [ ] 更新旧 72% 弹层断言为全屏入口行为，并新增未保存描述/公司/时间跨取消保留。
- [ ] 正文改用 A、保留行业列表唯一滚动区；父经历编辑页 hidden 保持挂载，正文在兄弟位置；按 A 在父页保存/恢复滚动和触发焦点。
- [ ] 复核展开多个根、深度限制、分页、错误重试、版本换代和已选高亮不因容器变化失效。
- [ ] 执行 `npm test -- src/组件/简历行业选择正文.test.tsx src/屏幕/工作经历.test.tsx`。

失败反例：复用行业正文但把 hook 移到每次重绘都重建查询的位置、行业选择触发资源保存。完成条件：双模式单选及取消绿；不新增行业搜索或改行业数据源。

### Task 4: 公司档案行业全屏、两模式共用展示

目标：公司基本信息的行业字段统一入口/正文，保持公司自己的选项及权限。依赖：Task 1 的 A；不依赖或强制复用 Task 3 的深度上限。

预期编辑文件：
- 新增：无。
- 修改：`src/屏幕/公司档案分区编辑.tsx`、`src/屏幕/公司档案分区编辑.test.tsx`。
- 删除：无。

在该文件提取私有 `公司行业选择正文`，签名为 `(props: { 搜索词: string; 改搜索词: (词: string) => void; 行们: 公司行业行[]; 分页们: { 父键: string | null; 还有: boolean; 加载中: boolean; 错误: string | null }[]; 加载更多: (父键: string | null) => void; 重试: (父键: string | null) => void; 关闭: () => void; 选定: (键: string) => void; 展开: (键: string) => void }) => React.JSX.Element`；`公司行业行 = { 键: string; 名称: string; 层级: number; 可选: boolean; 有子项: boolean; 展开: boolean; 选中: boolean }`。保留已有公司目录父子导航，分页状态按父键映射现有父 ID，根为 null。无 BFF/Context；Mock 行业池映射成可选行、原值不变，Backend DTO 在现有后端行业区映射。A 提供外壳；不新建跨页行业查询层。

- [ ] 测试可编辑状态才可打开；只读/非管理员不出现可提交入口；取消不改名称/ref，选择仅写基本信息草稿。
- [ ] 将 Mock 内嵌 chips 与 Backend 内嵌目录的入口改为同一字段行，把两者展示接入私有正文；Backend 查询/状态继续在其页面适配拥有。
- [ ] 保持原有目录深度/父项可选判定/加载更多能力、搜索和名称 ID 原子更新；必要的查询开关、迟到响应保护限于当前子视图，关闭后不能改父草稿。搜索不补不存在的 API 功能。
- [ ] 父基本信息输入/媒体/权限继续挂载；在公司分区编辑根层设置打开状态和兄弟子页，将含返回/保存栏的整个父表单 wrapper 隐藏。Backend 目录状态可留现有后端行业区的页面适配，但通过根层渲染子页，不嵌入被隐藏的基本信息后代。按 A 记录/恢复滚动与焦点；只触及行业路径。
- [ ] 执行 `npm test -- src/屏幕/公司档案分区编辑.test.tsx`，覆盖两模式、搜索、分页、取消、重开、只读、媒体/其他基本字段保留。

失败反例：把公司 Mock 行业池替换为简历行业字典、限制原可访问层级、选择行业提前保存整个公司。完成条件：回归绿；不顺手重写公司资料表单。

### Task 5: onboarding 学校/专业点选稳定性

目标：修复搜索选中时闪烁和二次点选候选消失；维持点击选择后仍停留本页、下一步提交的交互。依赖：无。

预期编辑文件：
- 新增：无。
- 修改：`src/屏幕/毕业院校.tsx`、`src/屏幕/毕业院校.test.tsx`、`src/屏幕/选专业.tsx`、`src/屏幕/选专业.test.tsx`。
- 删除：无。

根因已确认：选择回调同时设置答案显示名并清候选；effect 又由答案派生查询。首次短词变全名触发清空/重查，第二次相同名称不触发 effect 却清空列表。专业 Mock 还存在已点选隐藏全部及排除精确匹配的逻辑。

局部状态合同：输入显示值、有效选择答案/ref、实际查询词分开。用户输入才更新实际查询词并按原规则清失效引用；点击候选只更新显示值和答案/ref，不清结果、不改变当前查询及游标。翻页沿发出首屏的查询词。真实选择用 ID 判断，不能仅按同名字符串打勾。

- [ ] 各页先写短词搜索→选中→重复同项用例：列表持续存在，未出现新的加载/空态，API 不因为选择额外调用。
- [ ] 在原页添加必要 query state，不抽通用 hook；保持去抖、请求序号/版本换代和旧响应防护。
- [ ] 删除专业 Mock 的已点选隐藏/精确匹配排除；保持其原有自由文本下一步语义，不把 Backend ID 要求套到 Mock。
- [ ] 测试换候选、真输入清旧 ref、选中后翻页仍原词、旧响应晚到、同名不同 ID、预填、下一步 guard。
- [ ] 执行 `npm test -- src/屏幕/毕业院校.test.tsx src/屏幕/选专业.test.tsx`。

失败反例：用 ref 跳过所有 effect 导致真实输入再也不查询，或拿新显示全名配旧 cursor。完成条件：回归和新增复现全部绿；不改 onboarding 进度/路由。

### Task 6: 热门城市规范显示名与有限别名兼容

目标：22 个固定 ID 对齐上表规范名，四个消费者无旧新名重复。依赖：无。

预期编辑文件：
- 新增：无。
- 修改：`src/数据/城市精选.ts`、`src/数据/城市精选.test.ts`、`src/数据/城市与行业.ts`、`src/屏幕/选工作城市.tsx`、`src/屏幕/选工作城市.test.tsx`、`src/屏幕/选择城市.tsx`、`src/屏幕/选择城市.test.tsx`、`src/屏幕/引导问答.tsx`、`src/屏幕/引导问答.test.tsx`、`src/屏幕/发布岗位.tsx`、`src/屏幕/发布岗位.test.tsx`。
- 删除：无。

保留原 `精选城市项`/列表公共结构。只在 `城市精选.ts` 新增有限映射 helper：`规范精选城市名称(名称: string): string`（仅上表旧名/规范名映射，其余原样），`精选城市显示名(id: string, 原名: string): string`（ID 命中用规范名，否则原样）。Mock 展示/默认/去重/选择比较归一到规范名，搜索可匹配别名和规范名；Backend ID 为唯一身份，静态旧 ref 显示可规范化，不后台重写存储。

- [ ] 测试上表全部 22 个名称、ID、顺序和国家均匹配既有值；防止仅测试北京/上海。
- [ ] 静态名称按表替换；在四消费者的 UI 数据适配边界使用有限映射。旧 Mock 草稿「北京」与热门「北京市」选中视为同项，取消不能悄悄持久化归一化结果。
- [ ] 对省内候选/当前城市/默认选择在本批消费者统一比较，旧中文海外搜索仍能找到规范项；不批量修改全局 reducer 或无关城市数据。
- [ ] 测试热门与省内相同 ID 只选一次、回显同名，未知名字保持、海外映射不错误加后缀；选定提交仍原 ID。
- [ ] 执行 `npm test -- src/数据/城市精选.test.ts src/屏幕/选工作城市.test.tsx src/屏幕/选择城市.test.tsx src/屏幕/引导问答.test.tsx src/屏幕/发布岗位.test.tsx`。

失败反例：字符串键不同重复城市、广州变成广州市市、海外 ID 被重建、打开页面为 22 项逐个请求。完成条件：数据与消费者回归绿；上线目录快照与表冲突时先核验差异，不能猜新名。

### Task 7: 期望职位共用 Mock 布局、Backend 自动分组

目标：两模式仅一套 JSX/CSS，Backend 数据映射为一级导航/二级标题/三级按钮。依赖：无；不要把 Task 1 招聘端类别的导航语义改成此页面。

预期编辑文件：
- 新增：`src/组件/期望职位选择正文.tsx`、`src/组件/期望职位选择正文.test.tsx`、`src/屏幕/期望职位目录钩子.ts`、`src/屏幕/期望职位目录钩子.test.tsx`。
- 修改：`src/屏幕/选期望职位.tsx`、`src/屏幕/选期望职位.test.tsx`。
- 删除：无。

接口按 B 冻结；局部 hook 接收现有 `查询Taxonomy` 方法（沿用现有类型）及搜索词，返回根/组展示数据、各级页状态/事件和 `按键取项(id)` 的真实目录项查找；选中集合仍由页面持有。只在本页使用，不创建通用树服务。

- [ ] 先写真实三级 fixture（含同名组/叶子）测试：点一级后无第二次点击就出现多组标题/叶子，一级持续选中，标题不可点击；两模式通过同一纯视图。
- [ ] 从当前 Mock 页提取 B，原 CSS 不改；Mock 保持现有树、搜索和底部保存，真实 ref 不进入展示。页面将保存上限维持 onboarding 10、求职意向 1。
- [ ] Backend 按选中根请求二级首屏，再为每个二级组自动请求三级首屏。只加载当前根；组请求按目录顺序串行即可，不加并发池/后台全树预热。各组独立增量呈现，某组失败继续加载其余组。
- [ ] 根列表、当前根二级列表、各组三级列表各自保存 cursor/version/loading/error；根/二级更多按钮加载新增项，并对新增组启动三级首屏；组更多仅追加该组。ID 去重保序。追加失败保留旧项、独立重试。
- [ ] 使用视图 generation 防止根切换、搜索变化、关闭后的旧响应回写。页版本不匹配时放弃旧 cursor/缓存，重置该活动浏览/搜索视图并通过既有第三参数 `{ 强制刷新: true }` 从首屏恢复，避免 HTTP 缓存返回旧首屏，不混版本；不得清除页面已选 refs。
- [ ] 搜索仍全局、保留 API 返回次序与分页：可选叶子进入直接结果组；命中的根（parent_id 为空）自动查二级再查三级；命中的二级自动查三级，非可选节点只呈现标题。相同 ID 只展示一次可选项；同名组不合并。没有展开父节点按钮，不修改左根作为下钻状态。清空搜索恢复最近根并使旧搜索响应失效。
- [ ] 测试一组失败不清兄弟组、分页不串 cursor、快速换根/词、版本换代、搜索命中父/叶混合、无子项空态、已选预填/移除/10与1上限、点击 leaf 不立即保存资源。
- [ ] 执行 `npm test -- src/组件/期望职位选择正文.test.tsx src/屏幕/期望职位目录钩子.test.tsx src/屏幕/选期望职位.test.tsx`；再 `npm run typecheck`。

失败反例：level2 仍为按钮；一次选择根请求全目录；同名父子合并丢 leaf；一组失败阻塞所有组；展示组件判断 Backend。完成条件：上述 fixture 及旧保存合同绿。若运行目录出现不同层级/父项可选等与核验快照冲突，报告具体数据证据，不自行支持任意深度或让父项可选。

### Task 8: 定向浏览器交互及布局回归

目标：验证 DOM 测试不能证明的整页高度、滚动、焦点和跨入口草稿；不实施新功能。依赖：Task 1–7 已通过聚焦测试。

预期编辑文件：
- 新增：无。
- 修改：`e2e/数据源模式.spec.ts`。
- 删除：无。

复用该文件 `pickerMock登录`、`创建候选OnboardingFixture` 及既有招聘方 fixture/路由拦截。新增测试带 `@catalog-fullscreen` 及 `@mock`/`@backend`；目录响应局部 override 使用真实三级结构，不改变所有旧用例共用 fixture。旧 `@picker` 因形态变化必要断言同步，并给这部分受影响用例加本次标签，使 selection 包含旧合同回归。

- [ ] 在 Mock/Backend 均覆盖五字段进入/取消/重开/选择：先填其它字段、滚动到入口，返回仍保留值/位置；dialog 充满应用可用区、父字段不可聚焦，Tab/Escape/返回可用，无底部抽屉残留。
- [ ] 覆盖 390×844 常规屏、320×568 短屏、844×390 横屏，长候选能滚到底，返回/底部保存可达、无双滚动。软键盘仅在可用真实移动环境人工验证；缩 viewport 只能报告近似验证。
- [ ] 学校/专业搜索后同项连点两次候选不消失，选择不额外请求；城市热门/省内去重同名；期望职位点根直接出现至少两组，点 leaf 后底部已选/保存正确。
- [ ] 对 Backend 捕获最终资源请求里的原 catalog ID；取消/选择子页本身零资源 mutation；Mock 不发 Backend 目录请求。
- [ ] 先预览：`npm run test:e2e:data-source -- --project=mock-stg --project=backend-stg --grep @catalog-fullscreen --list`；检查仅含上述用例及受影响旧回归且两个项目非空。
- [ ] 执行：`npm run test:e2e:data-source -- --project=mock-stg --project=backend-stg --grep @catalog-fullscreen --workers=1`。保留原测试产物/截图，不新增报告文件或测试配置。遇环境错误修环境，不抬 timeout 掩盖业务失败。

失败反例：仅断言 dialog 存在便宣称全屏，或旧 fixture 只有两级无法发现下钻问题。完成条件：选中用例通过、截图符合现有项目样式、未覆盖真实软键盘如实记录；该 Task 不包含最终 review/合入。

## 实施后收尾（不计入 Task count）

1. 全部 Task 和执行 skill 要求的宿主内全局 review 完成（未要求不新增），退出 Task 循环。本节替代默认 finishing-a-development-branch，不再添加整套测试、合入菜单或清理。
2. 自动调用异构只读 review-loop：Codex 宿主用 Claude，Claude 宿主用 Codex。绑定批准 Spec、最终 Plan、固定候选 diff 和共用 `../_shared/review-contract.md`；reviewer 不运行测试、不改文件。逐条核实 finding 的 required/optional 与复杂度，轮间只跑修复相关快速检查；轮次/停止条件由该 skill 决定。
3. 重算实际 diff 和消费者，完成前述最小充分的适用 L0–L2 权威验收。复用候选、依赖、fixture/runtime 都仍有效的 PASS，只补缺口；不对同一有效候选重复整轮。修复后不重入 Task/global/异构 review；记录证据失效和最小重测。不虚构本仓不存在的 affected wrapper。
4. 人工 final gate 前持续执行完上述授权工作；只读 fetch，展示候选 commit、target SHA、review 结论、测试 selection/receipt、未验证项及同步/增量验证/普通 push 方案，再等明确批准。此确认来自 development-workflow 的 `assets/execution-contract.md` §7，仅约束实施后的合入，不要求本规划再次确认。
5. 批准后遵循 development-workflow 的 `references/final-integration.md` 和 `assets/final-integration-contract.md`：同步 target，记 final_target_base，重算完整责任并依 INCREMENTAL_EVIDENCE 仅补缺口，执行适用正式 L3，cleanup 后再对账，确认 target 未推进后普通 fast-forward push，禁止 force push。不新增异构 review，不宣布未完成验证为 PASS。

## 文档 Review 记录

2026-09-15 完成 1 轮 `claude-review-loop`（Opus / high / plan mode），模式 `WORKFLOW_DOCUMENT_REVIEW`，上层 workflow 已授权。冻结清单为 Header 的 Spec 与本 Plan；候选 revision `70715573`，批准 Spec revision/blob 同 Header。审查前后 HEAD、porcelain-z、两文件 Git 内容指纹一致，未运行测试、未改文件。

|Finding|等级/类别/必要性/复杂度|核实与裁决|
|---|---|---|
|R1-1 搜索初值歧义|Important / 真实缺陷 / required / 不变|接受并修复。现有 Mock 空词不显示候选；Task 2 现明确首次复制当前名称为搜索初词，后续独立编辑，当前值持续可见，不假造目录候选。|
|R1-2 滚动恢复无实施步骤|Minor / 契约违反 / required / 不变|接受并修复。A 与 Task 1–4 明确父页打开前记录、关闭显示后恢复 scrollTop 和 preventScroll 焦点，避免到浏览器任务才补实现。|
|R1-3 返回版本字段名|Minor / 真实缺陷 / optional / 不变|接受并修复。类型实际为 catalogVersion，改正错误的 version 文案。|

同轮自检补明：公司全屏在分区编辑根层渲染以隔离父返回/保存栏；公司私有展示 props 补齐类型；期望职位换版继续使用既有强制刷新参数。均为原合同的最小落实，不改批准 Spec。

审查边界记录：reviewer 报告额外只读了少量实现/测试源码核对事实，超出本轮“文档及必要规则”的输入边界；未将此扩大为产品代码 review，也未据此宣称产品已经验收。规划者独立复核了三项依据。工作树保护检查通过。

结论：3 项接受并修复，0 拒绝/延后，0 未解决有效 required。按 review-loop 的裁决结束条件在第 1 轮结束；最终 v1.1 为裁决后版本，未声称另经第二轮审查。产品实现与产品测试尚未执行。本 Plan 后续 prompt 固定最终 revision/blob。
