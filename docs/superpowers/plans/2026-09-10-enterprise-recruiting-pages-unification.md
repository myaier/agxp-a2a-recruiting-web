# 企业公开页与招聘名片统一 Implementation Plan

> **For agentic workers:** Claude Code 必须实际调用 superpowers:subagent-driven-development；Codex 必须实际调用 superpowers:executing-plans。按依赖执行，步骤使用 checkbox；实现留在用户新开的实施会话。

**Goal:** 两个页面各自让 Mock/Backend 共用唯一展示，缺字段保留位置且不污染事实和保存数据。

**Architecture:** 每页保留外层数据/操作连接，提取一个具体展示组件及本页需要的映射。公司全文和条款层留在企业展示中，名片保存和头像生命周期留在连接层；不用全站页面引擎或占位基础设施。

**Tech Stack:** 现有 React 19、TypeScript、CSS Modules、Vitest/Testing Library、Playwright；不新增依赖。

**Spec:** `docs/superpowers/specs/2026-09-10-enterprise-recruiting-pages-unification-design.md`，批准记录 revision `afbb2c67bcf04c3a692a6e9f0442a711bb282676`，blob `90798f9001235e811e9b66896896ebf040516570`。用户批准正文来自 `1b04a441`，后续仅补批准元数据。

## Global Constraints

- 完整读取 `CLAUDE.md`、`AGENTS.md` 与批准 Spec。文件/hash 不符先核对 Git 对象，不以工作树最新版本替代批准输入。
- repository `agxp-a2a-recruiting-web`；工作区 `.`；target `origin/main`。规划源码基线 `b93436e9`，它不是最终验收 diff base。不在本规划会话实施。
- 不改接口、schema、请求顺序、状态系统、权限、原保存时机；不改在谈详情/列表/公司档案编辑/认证/发岗，不恢复已删代理区。不消费其他分支尚未合入的接口。
- 每页只剩一份实际使用的展示 JSX/CSS。新展示不读数据源模式/全局业务状态、不运行时导入 Mock 表、不发请求、不拼业务路由。纯 Tab/弹层状态可内置。
- null/空字符串/空列表仅按 Spec 的合法缺失规则转换。真实 0、未融资等合法否定正常展示；契约错误、整页读取失败不转成成功占位页。
- 图片：企业头图 50×50、圆角16；头像52×52圆形；缺图中性空白、可访问说明，相册一格等尺寸占位。不新生成图片、不改全局 公司字标 组件。
- 占位仅出现在展示或 input placeholder；原始输入、缓存与提交不能写入“未知”。只在本页映射未知枚举，不改全局组织映射输出。
- Spec §7 列明允许的 Mock 变化；除此以外保留现有布局与交互。不提升视觉容差或用遮罩隐藏缺陷。
- 开工按 development-workflow skill 根的 `scripts/task_intents.py` 用 `--help` 核对 CLI、`start` 登记并检查重叠；扩公共路径前 `update`。不代改他人记录，不 stash/reset/clean 他人内容。
- 两栈行为差异用业务属性/回调表达，不能新加 backend 布尔参数切换整页。只删确认无消费者的旧样式。
- 契约内的等价 helper 组织可由实施者决定；产品行为、公共接口、范围或验证义务变化必须停下修订，不以实现方便扩展 Spec。

## Task index

Task count: 4
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|企业公开页、映射、原位迁移；无上游依赖|Top 5–10（Claude Code: sonnet）— 明确字段与来源契约|Top 5–10（Claude Code: sonnet）— 核对缺失/核验范围|Top 5–10（Claude Code: sonnet）— 消除两份卡面|
|2|招聘名片展示及连接迁移；不消费 Task 1 接口，串行便于 review|Top 5–10（Claude Code: sonnet）— 保存边界需谨慎|Top 5–10（Claude Code: sonnet）— 原输入/保存语义|Top 5–10（Claude Code: sonnet）— 生命周期与复用边界|
|3|跨模式及浏览器验证；依赖 1–2|Top 5–10（Claude Code: sonnet）— 区分事实与 fixture|Top 5–10（Claude Code: sonnet）— 验收覆盖与视觉例外|Top 5–10（Claude Code: sonnet）— 防测试弱化|
|4|final gate、异构代码 review、合入收尾；依赖 1–3|Top 5–10（Claude Code: sonnet）— 执行者主控，人工确认不可委派|Top 5–10（Claude Code: sonnet）— 证据与批准版本核对|Top 5–10（Claude Code: sonnet）— 可委派只读核验，主控负责合入|

每个 Task 连同 Global Constraints、批准 Spec 和其明确引用的接口块可单独交给零上下文执行者。Claude Code 的 Task 两阶段 review 不替代 Task 4 异构代码 review；Codex 不解析 Claude alias，不因缺少 alias 阻塞。

**计划本身复杂度：中。** 两页生产改动独立，但来源声明、表单持久化和浏览器回归需要共同验收。
**零上下文漂移风险：中。** 已冻结页面数据/输入契约，剩余不确定性主要在并行 E2E 改动与真实后端现场。
执行模型使用当前可用的行业 Top 5–10 中高性价比模型，只按漂移风险选择。

## 展示接口 A：企业公开页（Task 1 生产、Task 3 消费）

Create `src/组件/企业公开页/企业公开页展示.tsx`、`企业公开页展示.module.css`、`企业公开页展示.test.tsx`；同目录 `类型.ts` 仅放本页类型。Create `src/数据/企业公开页展示映射.ts`、`.test.ts`。以下签名固定，数组项不造实体 ID：

```ts
export interface 企业公开页资料 {
  名称: string | null;
  图片: string | null;
  规模行: string; // 外层逐字段补未知文案后拼接；Mock 保留现有整行
  简介: readonly string[] | null;
  文化: string | null;
  历程: readonly { 年份: string; 事件: string }[] | null;
  业务: readonly string[] | null;
  相册: readonly string[] | null;
  产品: string | null;
  团队: readonly { 姓名: string | null; 职务: string | null; 简介: string | null }[] | null;
  作息: string | null;
  条款: readonly { 名称: string; 说明: string | null; 已核: boolean }[] | null;
  代理核对已知: boolean;
  地址: string | null;
  地址补充: string | null;
  反馈: readonly { 标签: string; 条数: number }[] | null;
  工商: readonly { 项: string; 值: string }[] | null;
  工商来源说明: string | null;
  身份: { 法定名称: string | null; 展示名称: string | null; 核验时间: string | null;
    已核验: boolean; 岗位数: number | null; 岗位数已核验: boolean };
  页脚: string;
}
export interface 企业公开页展示属性 {
  资料: 企业公开页资料;
  返回: () => void;
  导航: (() => void) | null;
  岗位: { 编号: string; 职位: string; 薪资: string; 在谈: boolean; 打开: () => void }[] | null;
  岗位层说明: string | null;
  条款层说明: string | null;
}
export default function 企业公开页展示(props: 企业公开页展示属性): React.JSX.Element;
```

`岗位=null` 表示能力不可用，`[]` 表示可打开但无条目；不从数量推断。返回、导航和岗位回调由原页面创建。导航原型轻提示继续由外层负责，展示只触发函数。`条款层说明`/`岗位层说明` 是已有 Mock 业务说明，不传整段 ReactNode 卡面绕过复用。

映射固定函数：`从公开企业到展示(view: 公开企业视图): 企业公开页资料`；`从模拟企业到展示(档: 公司档案 & Partial<公司自述覆盖>): 企业公开页资料`。三个输入类型分别 type import 自 `src/数据/组织映射.ts`、`src/数据/公司档案.ts`、`src/数据/类型.ts`；mapper 不查表、不接收整个应用状态。可使用文件内私有纯 helper，不新建全局格式工具。

映射规则：

- Backend `displayName/legalName/verifiedAt` 原样消费合法 view，核验时间沿用 `.slice(0,10)`，身份已核验 true，岗位数来自 activeVerifiedJobCount 且岗位数已核验 true。空字符串 trim 后转 null；空列表转 null；未知不影响 0。
- `companyIntro` 非空转单段数组；businessItems、合并后的 officeMediaUrls/companyMediaUrls、productIntro、teamMembers 按 Spec §6 映射。条款来自 benefitLabels，说明 null、已核 false、代理核对已知 false；文化/历程/地址补充/反馈/工商为 null。
- Backend 工商来源说明 null；页脚沿用“公开信息由企业主页提供 · 企业身份经平台核验”；导航、岗位、岗位层说明、条款层说明均由 Backend 连接传 null。融资/规模/行业空值分别为对应“未知”，已知标签仍用原值。
- Mock 数据由连接层按原条件叠加 公司自述；简介/历程/福利/反馈/工商保留，产品/团队/相册从覆盖字段读取（两组照片合并）；图片没有实际来源，传 null，不把首字当图片。条款核对保留，代理核对已知 true。身份法定名称/核验时间 null、展示名称=档.名称、已核验 false、岗位数=档.在招岗位数、岗位数已核验 false；不猜法定名。工商来源说明“已核验”，页脚沿用原有 Mock 字符串。
- 空区/子字段文案严格采用 Spec §6。`代理核对已知=false` 显示“代理核对信息未知”；true 时按已核条目数展示（含真实 0）。反馈分母为0时条宽为0，不产生 NaN；未知反馈只显示文本。
- 规模行整行沿用原 `.规模行` 的 `var(--次要浅)` 与现有中性头部背景；每个缺字段分别替换成明确的“融资阶段未知／公司规模未知／行业未知”后以 ` · ` 拼接。已知与未知不要求片段异色，不解析 Mock 整行推断三种事实；组件直接输出该行。
- 工商和身份是同一区内两组事实：工商来源说明只作用于工商条目；身份已核验只作用于身份，不能让 Mock 工商 badge 顺带认证 null 身份行。

## 展示接口 B：招聘名片（Task 2 生产、Task 3 消费）

Create `src/组件/招聘名片/招聘名片展示.tsx`、`招聘名片展示.module.css`、`招聘名片展示.test.tsx`。类型在该 TSX 导出，不增加独立名片映射层，调用方已有所需身份投影。

```ts
export type 名片输入 =
  | { 模式: '受控'; 值: string; 修改: (值: string) => void }
  | { 模式: '收笔'; 值: string; 收笔: (值: string) => void };
export interface 招聘名片展示属性 {
  预览: { 姓名: string; 职务: string; 公司: string; 图片: string | null;
    暂存图片: boolean; 已认证: boolean };
  姓名: { 类型: '只读'; 值: string } | { 类型: '公开名'; 输入: 名片输入 }
    | { 类型: '姓名'; 输入: 名片输入 };
  职务: 名片输入;
  公司: { 关系: readonly { id: string; 名称: string; 角色: string; 状态: string;
    可选: boolean; 当前: boolean }[]; 选择: (id: string) => void;
    待选提示: boolean; 声明: { 标签: '公司' | '公司（未认证声明）'; 输入: 名片输入 } | null };
  选照片: (文件: File) => void;
  保存: () => void;
  保存文字: string;
  保存中: boolean;
  返回: () => void;
  打开公司资料: () => void;
}
export default function 招聘名片展示(props: 招聘名片展示属性): React.JSX.Element;
```

输入行共用外壳及一个 input JSX：受控模式用 value/onChange，收笔模式用 defaultValue/onBlur；不得给同一 input 同时传 value/defaultValue。只在收笔模式处理非 composing Enter → blur，保持 Mock 原行为；Backend 不新增 Enter 提交。aria-label 稳定为姓名/职务/公司，不随只读标签文案改变。只读姓名用文本元素。

展示内持有 file input ref，选取后清空 `event.target.value` 以允许重选同一文件，再把 File 交外层。外层的异步选图函数改为接收 File 并继续自己 catch/校验；不把 React 文件事件传到上传事务。file input `accept="image/*"` 与现状一致，Backend MIME/大小校验仍在外层。预览 img 在暂存时 alt“头像预览”，其他实际图沿用空 alt；无图用 role=img、aria-label“头像未知”的空白图位。

关系按身份投影逐项映射，当前状态显式传入；待选提示沿用原条件“可选关系大于1且无 current”。声明输入：Mock 总是提供；Backend 仅可选关系为0且无 current 时提供。不能为减少 props 合并这些真实不同状态。

## 测试选择与权威责任

1. **失败与边界**：来源/缺失映射错误；未知污染输入；实名/关系分支消失；头像 CAS 与保存竞态；两个页面仍有第二份展示；布局、弹层及原路由回归。
2. **最小反馈**：每 Task 指定组件/mapper 测试和原页面测试，先 red 再 green。无必要不为文档或低影响纯样式变动写镜像测试。
3. **提前真实验证**：名片事件重接后，如已有 unit/HTTP fixture 不能证明真实上传 revision 或重新进入后持久化，Task 3 在最终 gate 前进行针对性真实边界验收，不能拿 fixture 代替。公开企业页实际打开、无列表能力及来源说明同轮观察。缺 URL/后端路径/账号安全来源只询问缺项，其他无依赖工作继续。
4. **确认前权威入口**：`npm test`、`npm run typecheck`、`npm run lint`、`npm run build`；Task 3 的 P1C 数据源 E2E、既有 UI wrapper 和浏览器/真实后端责任。仓库无 affected selector，不新造一个；每条命令/runner的日志保留候选 SHA、输入及结果。wrapper 已含 raw capture 时不再无条件补跑 capture。
5. **成本/证据**：规划仅源码与文档核对，无产品测试计时与 PASS，耗时未知。Test selection 随新增/删除文件及消费者变化重算；最终不机械重复 broad gate。

真实后端按 `docs/dogfood/真实后端行为验收.md` 的 B03 招聘基础行为及本计划两页操作选择；注册流额外按 `docs/dogfood/backend-local-onboarding.md` 的相应路径（不把普通编辑当注册验收）。证据在 `dogfood-output/<run-id>/`，使用既有报告模板和 cleanup；其他 Case NOT_RUN。环境不具备记 BLOCKED，不能称 ready。

**L3 静态责任：none。** 当前前端仓库没有独立的正式 development L3 suite/选择规则；上述真实边界验证归确认前责任，不为后端另加全量 Hosted 测试。实施时若目标规则增加正式 L3，则记录具体入口/触发条件和证据需求，确认后的执行归 Task 4；不猜套件也不把 N/A 写为 PASS。发布到 Pages/release 不在本计划范围。

### Task 1: 企业公开页共用展示、映射与原位迁移

目标：交付 Spec §3–4、§6 企业字段与 §7 企业侧验收。无上游依赖；不改公司档案编辑、公司区块、查询/错误模型。生产接口 A，消费现有公开企业/Mock 类型和外层导航。

文件：Create 接口 A 列出的六个文件；Modify `src/屏幕/企业详情.tsx`、`企业详情.module.css`、`企业详情.test.tsx`。旧 module 全部规则迁移后可删除，但先 rg 核对引用；否则仅删无人消费规则。

- [ ] 阅读原页面全部 JSX/三个层、组织 mapper、公司档案和测试，核对基线及 intents。路径语义仍是 opaque ID 和 Mock slug 两条外层链路。
- [ ] 在新 mapper 测试中用现有合法 BFF view fixture 与 Mock 档测试空字段/真实0/无核验结果，不为通过断言造非法 DTO。核心断言固定为：

```ts
const d = 从公开企业到展示({ ...完整公开视图, companyIntro: '', activeVerifiedJobCount: 0 });
expect(d.简介).toBeNull();
expect(d.身份.岗位数).toBe(0);
expect(d.代理核对已知).toBe(false);
expect(d.条款?.every(x => !x.已核 && x.说明 === null)).toBe(true);
```

- [ ] 新展示测试覆盖三 Tab、读全文五部分、条款已知/未知核对、照片/空图位、反馈未知无数值图、工商与身份各自来源、null 岗位能力不可点及非 null 列表回调。完整属性 fixture 用本文件接口 A 构造，不依赖全局状态。
- [ ] 执行 `npm test -- src/数据/企业公开页展示映射.test.ts src/组件/企业公开页/企业公开页展示.test.tsx`，确认 red 原因是未实现契约/行为而非测试基础设施错误。
- [ ] 实现接口 A 与 Spec §4 顺序、文案、来源。主屏产品/团队进入全文层，不删除内容。用既有 弹层框架 保留关闭/焦点行为；未知反馈不画图；工商和身份核验 badge 不互相覆盖。
- [ ] 原页面外层保留 useEffect 读取/错误消费、静态档+自述覆盖及岗位准备；两种成功路径都 return 同一个展示。导航回调和 Mock 轻提示仍在外层，三个层状态从原外层移入展示；删除 Backend企业公开页 第二份卡面。
- [ ] 改原页面测试：成功路径打开全文后断言产品/团队；文化/历程/反馈改断言未知占位；既有 opaque ID、失败/停用/恢复和无静态回退测试保留。增加合法空数据不等于请求失败的反例。
- [ ] green 执行 `npm test -- src/数据/企业公开页展示映射.test.ts src/组件/企业公开页/企业公开页展示.test.tsx src/屏幕/企业详情.test.tsx`、`npm run typecheck`，检查旧 CSS 消费者。只有唯一展示且所有真实内容可达才完成。
- [ ] 提交 `refactor: unify enterprise public page presentation`。需要私有数据/新接口才能填字段，或必须改非目标公共组件时停止扩展并报告；保留未知是正确结果。

### Task 2: 招聘名片共用表单并保留保存生命周期

目标：交付 Spec §5 与名片缺失规则；不消费 Task 1 接口，依全局顺序在其后执行。生产接口 B，消费 `从BFF招聘身份` 输出与现有 Mock 企业认证状态；不创建新 store 或重写保存事务。

文件：Create 接口 B 的三个文件；Modify `src/屏幕/招聘名片.tsx`、`招聘名片.module.css`、`招聘名片.test.tsx`。样式迁移到展示目录，旧文件无引用才删除。

- [ ] 阅读 Backend名片、Mock名片、就地编辑条目及全部现有测试。建立原函数到外层的保留清单：按下保存/保存锁、公司同步、公开名和职务同步、主体变化/预览引用、选图校验、Mock 收笔及压成头像。
- [ ] 写展示测试验证受控/收笔事件、只读文本、关系状态、上传重复选同一文件、保存中禁用和空输入 placeholder。反例：渲染空公开名后 `getByLabelText('姓名')` 值必须是空串，不能等于“姓名未知”；受控模式 change 回调收到用户原始值，不能以预览占位替换。
- [ ] 在展示测试中明确补 IME 用例：聚焦收笔模式姓名输入，触发 `keyDown` 的 `key: 'Enter', isComposing: true`，断言输入仍有焦点、收笔/保存回调均未调用；再以 `isComposing: false` 回车，断言失焦且收笔仅一次、保存仍未调用。对受控模式另断言普通 Enter 不触发保存。
- [ ] 执行 `npm test -- src/组件/招聘名片/招聘名片展示.test.tsx` 得 red；实现接口 B，所有输入共用一份 JSX，保留 IME Enter 限制和原有预览时机，不统一持久化时机。
- [ ] 两个连接函数分别组装 props 并调用共用展示。Backend 预览姓名仍用 verifiedName ?? publicName 的权威值、职务/公司用现有本地值；Mock 预览读原全局状态。选图函数只把参数改为 File，其余校验、压缩、catch、回收原逻辑保留。
- [ ] 删除两份原表单/预览 JSX 和旧就地编辑行实现；当前关系/声明条件在连接层计算，不把整个公司区 ReactNode 当 prop 塞回第二份表单。
- [ ] 保留并跑实名只读、多个/不可用关系、选择失败、声明校验、保存单飞、PATCH revision、409 文件保留、预览回收、账号切换、注册/普通保存及 Mock 测试。新增空值提交仍触发原校验而不发送未知文本；未批准的清空语义不改变。
- [ ] 执行 `npm test -- src/组件/招聘名片/招聘名片展示.test.tsx src/屏幕/招聘名片.test.tsx`、`npm run typecheck` 得 green，确认无重复 JSX/无输入 controlled-uncontrolled 警告后提交 `refactor: share recruiter card form presentation`。

完成标准：两栈共用一份表单且原操作回归全部保留。若提取需要改变保存顺序、上传 revision 来源、草稿归属或注册流路由，停止该方向，先在冻结契约内调整提取边界。

### Task 3: 跨模式与浏览器验收

目标：证明两页相同字段/业务状态复用相同布局，真实操作不退化。依赖 Task 1 接口 A 与 Task 2 接口 B 已存在且定向测试通过；读取两块接口而不靠聊天。非目标：新测试 runner、后端 fixture 基础设施、其他页面改版。

文件：Modify `e2e/数据源模式.spec.ts`、`e2e/视觉回归/场景.ts`；必要时更新其既有 `场景.test.ts`。仅因 UI fixture 构造必须才修改该文件内既有 fixture helper；共享文件扩范围前更新 intents。证据写既有 `ui-regression-output/`、`test-results/`、`dogfood-output/`，不要新增 handoff/report markdown 到 docs。

- [ ] 先核对并行分支实际 diff 与 fixture 所有权；P1C 数据源 fixture 及原测试 `P1C canonical ref 公司卡可进公开企业页，no-ref 声明卡不可点`、`P1C Organization 读取失败不回退 Mock 公司内容`、`P1C 招聘名片保存档案与头像走 multipart 单 media part` 保留。
- [ ] 新增测试名以 `企业名片统一` 为前缀，带 `@mock`/`@backend`：企业三 Tab/全文/未知和岗位能力，名片空值与只读、保存失败重试；用现有 HTTP fixture 准备合法完整与空公开档案。页面能见反馈未知而不能见编造计数；失败企业页不能见成功占位区。用同样视口/业务属性比对布局与行为，不强行要求数据量不同两栈截图相等。
- [ ] 新增 Mock 视觉场景 `enterprise-public`，路由使用现有路径表的 company/yunqu；选取新旧均有的稳定定位（公司标题、公司自述、读全文、办公地、岗位入口）供 wrapper 两端采集。保留 `recruiter-card` 场景，新旧差异按 Spec §7 逐项对账，不把新占位定位设为基线必须存在的关键元素。
- [ ] 执行 `npm test -- e2e/视觉回归/场景.test.ts`（场景验证）与 `npm run test:e2e:data-source -- --grep 'P1C|企业名片统一'`。P1C 包含名片与公司资料往返，不能只删失败断言；预期选择非空、所有选中用例 PASS。
- [ ] 执行 `npm run ui:check -- --base b93436e9 --output ui-regression-output/enterprise-recruiting-pages`，作为原 Mock 外观对照。wrapper 自建临时 detached baseline 是已有测试资源，按 runner 自身清理，不另建用户实施工作区。记录原始退出码/差异；批准变化不记为自动比较 PASS，确认每一条匹配 Spec §7，额外差异必须修复。若 target 合入新 UI，最终对照 base 由 Task 4 重算，不能拿此规划 base 作为 final_affected_base。
- [ ] 浏览器在320和390宽度观察企业主屏/三个层、真实/空照片、长字段，以及名片输入/关系/只读/空态。检验横向溢出、底栏遮挡、弹层滚动、返回与关闭，保存前后截图。已知许可差异与实际缺陷分别记录在本 Plan 验证记录。
- [ ] 按测试责任段执行真实后端 B03 及两页操作，名片保存→重新进入/重载→权威内容和头像仍在；从真实企业 ID 进入公开页，核对来源与不可用岗位入口。注册流用独立 onboarding 指南验证，没有合法现场账号则 BLOCKED。仅操作本轮拥有的测试数据并 cleanup，不扩大为 Hosted 全套。
- [ ] 在候选完成时执行本 Plan 确认前权威命令（完整 npm test/typecheck/lint/build；本 Task 已有有效 E2E/视觉证据不重复），逐项登记；提交测试改动 `test: verify enterprise and recruiter page unification`。

完成标准：无未解释视觉差异、名片真实行为证据完整；占位/零值/来源/错误/权限/生命周期都有对应现有或新增覆盖。环境失败不是产品 PASS，不能进入 ready 状态。最终 review 在 Task 4，不以此任务自测替代。

### Task 4: Final gate 与异构代码审查、合入收尾

目标：将完成实现变为可审阅、可验收、经用户确认后的合入结果。依赖 1–3；消费全部证据与批准 Spec/Plan，不再创造产品接口。Modify 本 Plan 的验证记录；其他业务文件只有范围内 review 修复才改。执行者承担主控，不委派人工确认。

- [ ] 完整读 development-workflow 的 `references/final-integration.md` 和 `assets/final-integration-contract.md`（按本机 skill 根解析），按当前 target 规则重算全部责任。确认前只读 fetch 记录 pre_gate_target_base，不 merge/rebase target、不正式 L3、不 push。
- [ ] 核对完整 L0–L2（仓库适用项）已通过，保存 candidate_commit、实际命令、selection、runner输出路径、环境/fixture与证据源 SHA。UI 自动比较因批准视觉变化退出非0时明确记录其原始结果和逐差异人工验收，不能声称 runner PASS；存在额外差异则修复。仓库新增更严格门禁时遵守，不能以人工记录绕过。
- [ ] 冻结候选后实际调用宿主异构 code review-loop（Codex→Claude、Claude Code→Codex），固定批准 Spec/Plan revision/blob 与 candidate diff；reviewer 默认不跑测试，最多3轮。实际调用 receiving-code-review 核实 findings，修复后仅补失效验证；结果就地写本 Plan，不另建审查文档。文档 review 不能替代这次代码 review。
- [ ] 无未解决 required、无证据缺口后展示具体 final gate：候选 SHA、目标 SHA、完整选择与可复用证据、将执行的 merge/验证/push命令，等待明确批准。
- [ ] 获批后 fetch target，记 final_target_base；按批准方案 `git merge --no-edit origin/main`（不 rebase 已审查提交）。基准不变且 merge no-op、环境/证据仍有效时零重复 runner；变化则从 final_target_base 到候选重算完整选择，delta_base 只用于补验。无可证明依赖边界的 suite 整项失效；不构建跨任务缓存。
- [ ] 核对条件性新增正式 L3 的实际责任；无则记 N/A，适用则按规则只执行缺失/失效项，cleanup 后再次对账。最后权威结论必须覆盖最新候选，不以旧 PASS 覆盖失败。
- [ ] 再次 fetch，target 未推进才普通 fast-forward push（按已批准方案 `git push origin HEAD:main`）；拒绝或 target race 保留证据并提出新 gate，不 force push，不自动追赶。
- [ ] push 成功才报告合入完成，更新 task intent 为 completed；记录候选/target/merge SHA、结果及未执行责任，按 skill 清理仅本任务创建的资源。

**Autonomous recovery boundary:** 获批后的范围内确定性修复由同一执行者自主处理，复用有效证据，只补失效测试并对修复影响刷新异构 review。只有修复要改批准契约/范围、target race 需新 gate、或外部资源不可得才停止并报告；不反复为同类已授权恢复请求确认。

## 文档 Review 与验证记录

规划：Spec 已批准；产品测试和真实后端尚未运行。文档 review 候选为本文件及上述固定 Spec，结果在本节记录。实施者追加每 Task 实际结果、允许视觉差异、最终门禁与合入事实，不把计划步骤视为完成证据。

首轮文档 review：Claude opus/high，冻结候选 `d436fde0`，受审 Spec 仍为批准 blob `90798f9001235e811e9b66896896ebf040516570`。工作区、HEAD、两文件指纹守卫通过，reviewer 未运行测试。

- F1（Important / required / 复杂度不变，规模行应改三可空槽）：拒绝类型变更。源码 `src/屏幕/企业详情.module.css` 的规模行已整行 `var(--次要浅)`，Spec §3.3 不要求未知与已知片段异色；逐字段替换明确未知文案再拼接可满足契约，且不需要拆解 Mock 原有整行。补充渲染规则和注释消除歧义，保留 string。
- F2（Important / required / 复杂度不变，缺 IME 测试任务）：接受并修复。已确认原页面有 isComposing 防护而现有测试无此用例；Task 2 明确加入合成中/非合成 Enter 的焦点、收笔次数和零保存断言。

第二轮文档 review：同一 Claude opus/high 会话复审 `cae1a42a`；确认 F1 拒绝成立、F2 修复到位，最终 `NO FINDINGS`，无未解决 required。工作区、HEAD、两文件指纹守卫再次通过；两轮均未运行产品测试。此后仅记录本段审查结果，不改变已审设计/接口/任务。

### Task 3 跨模式与浏览器验收记录（2026-09-10）

开工核对：本工作树干净（HEAD `3e0f6209`），两共享 e2e 文件无人改动。intent 注册表：本计划 `2bfc7646`（expected_paths 已含两文件）；并行 active `5bf9a4de`（audit-frontend-data-wiring）也预告这两文件，其改动在自身 worktree（nervous-fireant）且未提交，与本轮无共享工作树。本轮对既有用例零改写，仅追加。

新增测试：`e2e/数据源模式.spec.ts` 8 条 `企业名片统一` 用例（2 `@mock` + 6 `@backend`，全部用既有 HTTP fixture / Mock 静态档，覆盖企业三 Tab/全文五部分/未知占位/真实 0、岗位与导航能力差异、读取失败诚实空态、名片空值/只读/保存失败重试）；`e2e/视觉回归/场景.ts` 新增 `enterprise-public`（`/#/company/yunqu`，求职端已注册），5 个关键元素均取新旧两版共有的稳定锚点，未把新增占位设为基线关键元素；`场景.test.ts` 清单 17 → 18。

既有 fixture helper 的唯一改动：`走完后端发岗向导` 补勾选「我已确认经验和学历设置将作为自动匹配依据…」确认项。该必选项在 `b93436e9` 与当前 `发布岗位.tsx` 中逐字相同（L2012），而 helper 缺这一步 → 该既有 P1C 用例在本分支与规划基线上同样失败（已用 detached base worktree 复核到端口冲突前一步，且 `e2e/数据源模式.spec.ts`、`发布岗位.tsx`、`package.json` 在 `b93436e9`↔HEAD 零 diff）。属「仅因 UI fixture 构造必须才修改既有 fixture helper」，未放宽任何断言。

命令与结果（候选 `3e0f6209` + 本测试改动）：

| 命令 | 输入 / 选择 | 退出码 | 结果 |
| --- | --- | --- | --- |
| `npm test -- e2e/视觉回归/场景.test.ts` | 场景清单验证 | 0 | 2 passed |
| `npm run test:e2e:data-source -- --grep 'P1C\|企业名片统一'` | 17 条（9 既有 P1C + 6 新增 @backend + 2 新增 @mock） | 0 | 17 passed，0 failed；三条必备 P1C（canonical ref 公司卡 / Organization 读取失败 / 名片 multipart 保存）在内且 PASS |
| `npm run ui:check -- --base b93436e9 --output ui-regression-output/enterprise-recruiting-pages` | 18 场景，mode=compare，gate=report，approved=false | 1 | pass 16 / warning 1 / structure blocked 1 / infrastructure 0（原始退出码即 1，未以批准差异改写为 PASS） |
| `npm test`（完整） | 全仓 | 0 | 173 files / 3699 tests passed |
| `npm run typecheck` / `npm run lint` / `npm run build` | 全仓 | 0 / 0 / 0 | 通过 |

期间 data-source 两次以退出码 1 失败，原因是端口被并行会话的 dev server 占用（`reuseExistingServer:false` + `--strictPort` 的环境冲突）；按约束未抢占，待其退出后重跑得上述 exit 0（该次与最终提交代码仅差一条注释措辞；提交态的重复运行因并行会话再次占用端口未做成，最终门禁会覆盖）。

ui:check 差异逐条对账（证据：`ui-regression-output/enterprise-recruiting-pages/`，两侧 18 场景均 0 console error、0 `/api/v1` 请求、0 横向溢出）：

| 差异 | 实测 | Spec §7/§6 归属 |
| --- | --- | --- |
| enterprise-public 像素 2.53% | 头部「云」字标 → 空白 LOGO 图位 | §7「缺图字标改为空白图位」、§3.3、§6 行2 —— 批准 |
| 同上 | 「主营业务」标签新增于同卡下方 | §4.1.2、§7「主营业务加标签」—— 批准 |
| 同上 | 「公司相册」空态卡出现（一格等尺寸空白图位 + 公司相册未知） | §4.1.3、§6「空列表 → 一格空白照片及公司相册未知」、§7「原先隐藏的缺字段区块出现占位」—— 批准 |
| enterprise-public 结构阻断 | 卡标题「办公地」y 478.59 → 648.59（+170px），尺寸不变；公司标题/公司自述/读全文/岗位入口四元素 x/y/w/h 全等 | 上述两块新增区块高度的算术后果，非重排 —— 批准差异的连带位移，非缺陷 |
| recruiter-card warning 0.65% | 差异像素仅集中在头像区：「邵」字标 → 中性空白占位 + 相机角标 | §3.3、§5.1、§7「缺图字标改为空白图位」—— 批准 |
| 其余 16 场景 | pass | 无差异 |

无 §7 之外的换行、按钮位置或尺寸回归；未提升容差、未加遮罩。`--base b93436e9` 只是规划 base，最终对照 base 由 Task 4 按当时 target 重算。

实际缺陷（既有机制，非本计划引入，未在本 Plan 修复）：企业公开页全文层/条款层内容高过视口时，层顶（抓手/标题/右上 ✕）被顶出视口，指针路径不可关层。机制是 `弹层框架` 底部面板内联 `maxHeight:'none'`（`b93436e9` 已如此）覆盖各屏 `.层{max-height:86%}`；统一展示「全文固定五部分」这一批准的内容变化使其必现：320×690 全文层面板高 1066、top −376、✕ y=−334；390×844 全文层高 885、✕ y=1 可见；条款层 390×844 高 948、✕ y=−62。新增 E2E 因此统一用 Escape 关层（`弹层框架` 原生支持）。证据：`ui-regression-output/browser-320/enterprise-intro-layer-cut.png`、`enterprise-terms-layer.png`、`browser-390/enterprise-intro-layer.png`。修复需动 `弹层框架`（各屏共用的公共组件），超出本 Plan 非目标，建议单独立项。

浏览器验收（agent-browser，Mock 栈 `127.0.0.1:4188` 自起自停；320×690 与 390×844；证据 `ui-regression-output/browser-320/`、`browser-390/`）：企业主屏/三个层、真实/空照片（Mock 静态档无图 → 空白图位）、长字段（公司全称、地址、历程行）、名片输入/空态/收笔/保存前后与重载回读；横向溢出 0（两页 `scrollWidth == clientWidth`）、底栏不遮挡页脚与末行（实测 `footer.bottom 590 < 底栏 top 620`）、弹层滚动与返回/关闭见上段缺陷记录；Mock 名片改值→保存→重载回读一致。名片「实名只读/关系待选」的浏览器观察依赖 Backend 会话，归入下段 BLOCKED（同名行为已由 @backend E2E 在 iPhone 13 视口覆盖）。

真实后端验收：**BLOCKED（不作为产品结论，其余 Case NOT_RUN）**。B03 招聘基准加载、名片保存→重新进入/重载→权威内容与头像持久、从真实企业 ID 进入公开页核对来源页脚与「岗位列表暂不可用」均未执行。缺的环境项：① Recruitment acceptance 栈未运行 —— `dev-local.sh health --acceptance` FAIL（service closure drift）、`status --acceptance` 无容器，且 recorded acceptance mode=1 使默认模式健康检查要求先 `down`（该记录非本轮所有）；② 上游共享 `agxp-server` 栈 app unhealthy、worker 反复重启，Hub acceptance 未挂载 —— 均属他人会话资源，按约束不 down、不重启、不抢占；③ 账号与 OTP 安全来源依赖该栈的 `browser-fixture.sh converge`（固定本地账号 + 栈内 OTP 材料），栈不可用即无法取得。注册流按 `backend-local-onboarding.md` 亦无合法现场账号路径，同记 BLOCKED。已按指南只做只读健康核对，未启动/关闭任何共享服务，未产生 receipt。

### Task 4：异构代码 review、pre-gate 证据与 final gate（2026-09-10）

实现提交：290ee452（Task 1 企业公开页）、3e0f6209（Task 2 招聘名片）、f38353ba（Task 3 验证，见上）。候选经 review 修复后推进到 `dc9d6c08`。`pre_gate_target_base = b93436e956dcd133ca909c06939e3416f2f3ad24`（origin/main，只读 fetch；未推进且为候选祖先，预期 merge no-op）。

异构代码 review-loop（宿主 Claude Code → reviewer Codex `gpt-5.6-sol`/high，read-only，FEATURE_BRANCH_REVIEW，base `b93436e9`，共用守约 `coding-harness/skills/_shared/review-contract.md`，reviewer 全程未跑测试、每轮前后 guard 通过）：

- Round 1 唯一 finding **F1（Important/required）**：移动端长弹层无法关闭——`弹层框架` 底部面板内联 `maxHeight:'none'` 压过本页 `.层{max-height:86%}`，窄视口层顶 ✕ 顶出视口、遮罩被全宽面板覆盖，触摸设备无退出路径（即上文「实际缺陷」段所记问题）。裁决：**接受**。上段「修复需动 弹层框架、超出非目标、建议单独立项」的判断不成立——最小修复只在本页 module CSS 即可恢复上限生效，且 `.层` 上限本就是 Task 1 迁入本计划新文件的意图（从未生效），Spec §7 明确验收 320/390 弹层无遮挡，属本计划责任；仍不改公共组件 `弹层框架`。
- 修复 commit `dc9d6c08`：`.层` 改 `max-height:86% !important`（压回内联样式，附注释）、`.层体` 补 `overflow-y:auto`（上限生效后长内容需滚动）、`e2e/数据源模式.spec.ts` 过时注释更正（Escape 用法保留）。浏览器复验 320×690 与 390×844：全文层/条款层 ✕ 完整在视口内（y≈138.6–164.6 / 160.2–186.2，面板高恰为视口 86%）、层体可滚至末节、Escape 与 ✕ 均可关闭、岗位层抽查通过；截图已更新 `browser-320|390/`（旧 `*-cut.png` 删除）。覆盖测试 `企业公开页展示.test.tsx + 企业详情.test.tsx + 场景.test.ts` 36/36 PASS。
- Round 2（同线程 resume，审修复 delta）：**NO FINDINGS**。Loop 干净结束（2 轮，上限 3）。

确认前权威证据（全部针对候选 `dc9d6c08`，日志在 `ui-regression-output/enterprise-recruiting-pages/logs/`）：

| 项 | 结果 | 证据 |
| --- | --- | --- |
| npm test 全量 | 173 files / 3699 PASS，exit 0 | `auth-test-post-r1.log`（修复后重跑） |
| typecheck + lint + build | 全部 exit 0（`✓ built in 637ms`） | `auth-post-r1.log`（修复后重跑） |
| data-source E2E `--grep 'P1C\|企业名片统一'` | 17/17 PASS（9 既有含 3 条必备 P1C + 6 @backend + 2 @mock），exit 0 | `ds-final5-post-r1.log`（修复后重跑；修复前提交态 `ds-final4-committed.log` 同 17/17） |
| ui:check `--base b93436e9` | exit 1 = pass 16 / warning 1 / structural blocked 1；逐差异人工对账见上表，全部为 §7 批准变化，无未解释差异；不声称 runner PASS | `uicheck-task3.log`（f38353ba 时采集；`dc9d6c08` 仅改弹层 CSS 与注释，wrapper 场景不采集弹层，证据不受影响） |
| 浏览器 320/390 | 修复后刷新：✕ 可达可关、层体滚到底、横向溢出 0、底栏不遮挡 | `browser-320/`、`browser-390/` |
| 真实后端 dogfood | **BLOCKED**（同上段，未变化） | 无 receipt（如实） |
| 正式 development L3 | N/A（仓库无正式 L3 套件；plan 测试责任段「L3 静态责任：none」，条件未触发） | — |

Final gate 待用户确认后执行：`git fetch origin` → 记 `final_target_base` → `git merge --no-edit origin/main`（当前预期 no-op；若并行任务先合入共享 e2e 文件冲突则机械解决并按增量证据补验）→ 复用上表仍有效证据、只补缺口 → 再次 fetch 核对 target 未推进 → `git push origin HEAD:main`（普通 fast-forward，绝不 force push）。自主恢复边界：获批后同一执行者对范围内失败自主最小修复、复用有效证据、只补失效项并刷新受影响 review；仅契约/范围变更、target race 或外部资源不可得才停下报告。

