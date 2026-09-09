# 三类列表卡片统一 Implementation Plan

> **For agentic workers:** Claude Code 实际调用 superpowers:subagent-driven-development；Codex 实际调用 superpowers:executing-plans。按 Task 顺序执行，步骤用 checkbox 跟踪；最后一个 Task 是同一执行者主持的 final gate。

**Goal:** 三类卡片各自统一 Mock/Backend 展示，以当前 Mock 布局承载真实字段和明显未知占位。

**Architecture:** 保留原页面连接层及 P4/P5 操作，分别映射成小型展示数据，再使用三类纯卡片。候选信息主体、分数位及在谈阶段区只为已经重复的消费者共享；不建立通用卡片框架。

**Tech Stack:** React 19、TypeScript、CSS Modules、Vitest/Testing Library、Playwright，沿用 package-lock.json。

**Spec:** `docs/superpowers/specs/2026-09-10-list-card-unification-design.md`。用户已批准 revision `8e2a145523e86550d4984cb48376fb6564159bf6`、blob `12009a42b14732645494dca463f6003392015731`。工作树 Spec 后续只更新批准记录；实施须用 Git 对象核对批准正文 §1–§9，不能把未经批准的新正文当基线。

**Repository / target:** `myaier/agxp-a2a-recruiting-web` / `origin/main`。产品基线 `b93436e956dcd133ca909c06939e3416f2f3ad24`。宿主工作区 `.`，不创建第二个用户工作区；本 Plan 不授权提前同步 target、实施或发布。

## Global Constraints

- 完整读取 CLAUDE.md、AGENTS.md；中文文档；最小改动，无顺便重构。
- Spec §4 占位只作用于合法正常卡的展示字段；协议缺键、错误状态、无权限或加载失败维持原错误路径，绝不造全未知正常卡。
- 三类卡各一套 JSX/CSS，不按数据源分卡面；页面数据/操作模式分支允许保留。
- 卡片不 import Context、fixture、HTTP、路由、持久化；不派发、不请求、不计算业务分数。连接层仍负责 ID、范围、分数与操作。
- 合法 null 不等于 0，不等于隐私未披露；有明确披露事实才说未披露。现有列表无法区分空因时用未知，不加缺失原因系统。
- Mock 已有非空显示值保留。工作/教育复合行显示已有部分，全空才占位。占位不得写回 DTO、草稿、过滤、存储或请求。
- 请求参数、P4/P5 严格解码、scope、状态机、权限、分页、排序/分组、轮询、迟到响应隔离和按钮动作不变；禁止新增逐卡读取。
- 无候选真名/代号/薪资关系；招聘卡不增加头像位；已删除的筛选入口不恢复。
- 历史、已筛、详情、匿名简历、市场卡、代理/初始化不改版。共享组件默认行为不变。
- 新增文件仅限本 Plan 的卡片实现和测试，不建运行配置、新状态库、通用 schema 或新的验证平台。
- 实施前用 development-workflow 的 skill 根目录相对 `scripts/task_intents.py start` 登记改动预告；扩大路径前 update，遵守其它有效预告。
- 同 clone 不 stash/reset/clean 他人内容；复用 `.`，自动化 UI runner 自建并清理的临时只读基准检出不作为第二个用户实施工作区。

## Task index

Task count: 5
Claude Code execution: superpowers:subagent-driven-development
Codex execution: superpowers:executing-plans

|Task|交付与依赖|implementer|spec reviewer|code-quality reviewer|
|---|---|---|---|---|
|1|招聘推荐卡、候选主体和分数位；无前置任务|Top 5–10（Claude Code: sonnet）；已有两份同构 JSX|Top 5–10（Claude Code: sonnet）；核验占位和行为|Top 5–10（Claude Code: sonnet）；核验重复与状态隔离|
|2|招聘在谈卡和阶段区；依赖 1 的候选主体/分数位|Top 5–10（Claude Code: sonnet）；局部展示迁移|Top 5–10（Claude Code: sonnet）；状态不能丢失|Top 5–10（Claude Code: sonnet）；P5 消费边界|
|3|求职在谈卡；依赖 1 的分数位、2 的阶段区|Top 5–10（Claude Code: sonnet）；有限映射和样式|Top 5–10（Claude Code: sonnet）；冻结职位与未知来源|Top 5–10（Claude Code: sonnet）；hook 与旧样式引用|
|4|全体卡片跨模式浏览器验证及实施 peer review；依赖 1–3|Top 5–10（Claude Code: sonnet）；复用现有 harness|Top 5–10（Claude Code: sonnet）；验收覆盖完整性|前沿 / 顶级模型（Claude Code: opus）；跨任务整体验证|
|5|final gate；依赖 4；由同一实施执行者主控|Top 5–10（Claude Code: sonnet）；主控，不委派批准/合入|Top 5–10（Claude Code: sonnet）；可核验证据|Top 5–10（Claude Code: sonnet）；可核验范围/合入事实|

Claude Code 每 Task 的 spec/code-quality 角色不替代最终 Codex 异构代码 review；Codex 按宿主能力与通用档位执行，不解析 Claude alias，最终以 Claude 异构 review。实现串行，不并行改动 P5/MatchCase列表.tsx。

**计划本身复杂度：中。** 三类 JSX/CSS 迁移涉及 P4/P5 消费与布局验证，业务底座不改。

**零上下文漂移风险：中。** props、文案与边界已冻结，仍需在浏览器处理窄屏及真实后端环境。执行模型使用当前可用的行业 Top 5–10 中高性价比模型。

## 公共展示契约

新建 `src/组件/列表卡片/`，公共类型放 `类型.ts`。展示数据是内存 props，不是 BFF schema，不持久化。以下签名固定；内部 helper 组织可等价调整。

```ts
import type { 阶段 } from '../../数据/类型';
export interface 候选卡信息 {
  性别: '男' | '女' | null;
  年限: string | null;
  学历: string | null;
  求职状态: string | null;
  工作: string | null;
  教育: string | null;
  亮点: readonly string[];
}
export interface 在谈阶段信息 {
  标题: string;
  色系: 阶段;
  待办: boolean;
  徽标: '需要你' | '需注意' | '代理处理中' | null;
  文本: string;
  注意说明: string | null;
}
export type 推荐操作状态 =
  | { kind: '可委托'; 提交中: boolean }
  | { kind: '回执'; 文案: string };
export interface 招聘推荐卡属性 {
  信息: 候选卡信息;
  匹配分: number | null;
  收藏: boolean;
  收藏禁用: boolean;
  滑开: boolean;
  操作状态: 推荐操作状态;
  打开: () => void;
  切收藏: () => void;
  委托: () => void;
}
export interface 招聘在谈卡属性 {
  信息: 候选卡信息;
  匹配分: number | null;
  阶段: 在谈阶段信息;
  打开: () => void;
}
export interface 求职在谈卡属性 {
  公司: string | null;
  公司简介: string | null;
  公司字标: { 首字: string; 公司名: string } | null;
  匹配分: number | null;
  薪资: string;
  职位: string;
  标签: readonly string[];
  阶段: 在谈阶段信息;
  打开: () => void;
}
```

默认导出的组件和文件同名：`候选信息主体.tsx({信息}: {信息: 候选卡信息})`、`卡片分数.tsx({分}: {分: number | null})`、`在谈阶段区.tsx({信息}: {信息: 在谈阶段信息})`、`招聘推荐卡.tsx(招聘推荐卡属性)`、`招聘在谈卡.tsx(招聘在谈卡属性)`、`求职在谈卡.tsx(求职在谈卡属性)`。每个有对应 `.module.css`，纯类型无 CSS。不额外定义通用 props 注册机制。

候选主体负责头行、工作/教育图标行和亮点，分数定位由具体卡的外层右列负责；主体允许具体卡 CSS 通过局部外层布局定位，不暴露模式开关。为测试设置稳定卡内位置：具体卡根 `data-testid="招聘推荐卡|招聘在谈卡|求职在谈卡"`，各区域用 `data-card-region="head|score|work|education|tags|stage|actions|company|salary|title"`，只标实际存在的区域，不能改变可访问语义。

字段纯映射放 `src/数据/列表卡片映射.ts`（类型引用 `组件/列表卡片/类型` 为 type-only；零 React/fixture 运行时依赖）：

```ts
import type { 推荐候选, 候选, 在谈单 } from './类型';
import type { 招聘候选摘要视图 } from './招聘候选摘要映射';
import type { P5列表正常视图 } from './MatchCase展示映射';
import type { 候选卡信息, 在谈阶段信息 } from '../组件/列表卡片/类型';
export function 从招聘摘要到卡信息(v: 招聘候选摘要视图 | null): 候选卡信息;
export function 从Mock推荐到卡信息(v: 推荐候选): 候选卡信息;
export function 从Mock候选到卡信息(v: 候选, 标签: readonly string[]): 候选卡信息;
export function 从Mock在谈到阶段(v: Pick<在谈单, '阶段' | '需要你' | '下一步'>): 在谈阶段信息;
export function 从P5到阶段(v: P5列表正常视图): 在谈阶段信息;
```

上述函数只转换数据，不插入占位文本。招聘摘要缺省统一传 null；Mock 标签回查由 Mock 连接层完成后作为参数传入。P5 到阶段的色系闭表：匿名初筛→匿名初筛、简历提交→递交简历、差异协同→需要协调、意向确认→意向确认；标题保留 P5 原文。`从P5到阶段` 的 `待办` 恒为 false：Backend 只保留原徽标，不新增呼吸点；`从Mock在谈到阶段` 的 `待办` 取原 `需要你`，保留 Mock 呼吸点。输入必须是现有合法映射的正常分支，不以兜底色遮掩契约错误。

占位精确遵守 Spec §4：经验未知、学历未知、求职状态未知、工作经历未知、教育经历未知、亮点信息未知、公司信息未知、公司简介未知、标签信息未知；性别 `?` 16px，可访问名与 title 均为「性别未知」，分数位 40px 内 `—` 与「分数未知」，可访问名「匹配分未知」，公司图位 34px/10px 圆角空块，可访问名「公司图片未知」。标签 trim 后无有效展示项按空处理；非空项不去重、不排序。占位文本沿用现有次要文字色，不使用错误红色；Task 4 浏览器观察一并核对。

`候选头行` 用可选 `未知性别占位?: boolean`（默认 false）支持 16px 问号；卡片主体预格式化三段未知文本传入现有年限/学历/求职状态 props，用 `类名` 仅在卡片调用处允许最多两行；非目标消费者保持默认隐藏空项及原布局。无需让整个头行知道模式。

## 测试选择与责任

1. 防范边界：空值/零值与协议错误混淆、假成功、跨 scope 导航、重复 JSX/CSS、真实待办丢失、窄屏遮挡、共享头行影响详情。仅展示层重构，无数据库/事务/schema 变化。
2. 最小反馈：每 Task 下列 Vitest 文件命令；依赖缺失先 `npm ci`，不升级 lock。最终构建 `npm run build` 已含 tsc -b，不再机械追加同候选 `typecheck`。
3. 提前真实边界：CSS 必须 Task 4 浏览器验证；若发现展示任务必须新增 API 或改权限，停止该设计扩张并报告，不自行接后端。真实 local 环境作为 Task 5 必需验收，不用 HTTP fixture 冒充。
4. 确认前完整责任：`npm run lint`、`npm run build`、下列定向 Vitest、`npm run test:e2e:data-source`、`npm run ui:check -- --base b93436e956dcd133ca909c06939e3416f2f3ad24`。新增聚焦浏览器检查被 data-source 全量入口包含时只运行一次权威全量结果；开发时可用 `--grep '卡片统一'`。这些是现有脚本，没有自动 affected 选择器，不虚构 L0/L1 标签对应速度。
5. 已有 evidence：此前组件测试因缺 vitest 未启动；已完成源码/文档核对，测试时间未知。仓库 UI runner 含临时 base worktree 和清理；它是自动化已有行为，不创建第二个人工实施空间。

完整定向 Vitest 命令（新增目录包括所有新组件测试）：

```bash
npm test -- src/组件/列表卡片 src/数据/列表卡片映射.test.ts src/数据/招聘候选摘要映射.test.ts src/屏幕/候选推荐.test.tsx src/屏幕/企业在谈候选.test.tsx src/屏幕/在谈首页.test.tsx src/屏幕/P5/MatchCase列表.test.tsx src/屏幕/候选详情.test.tsx src/屏幕/匿名在线简历.test.tsx src/屏幕/看市场.test.tsx src/屏幕/P5/MatchCase历史.test.tsx
```

真实 local（静态集成责任 `required`）：Task 5 确认后按 `docs/dogfood/真实后端行为验收.md` 工具/环境/receipt 纪律核验实际三类卡，至少候选推荐→委托→在谈与招聘推荐/在谈读取的相关节点（对应 Hosted H01 的相关过程）；不宣称跑完全部 H01，未执行节点标 NOT_RUN。精确观察要求见 Task 5。本仓库未规定正式 L3 suite 名，workflow 的 development L3 在本任务指这轮真实边界观察，不另造 npm 入口。没有本地账号/数据/后端环境时是未完成 required 验收，不是自动免除。owner 为实施执行者；可在确认前只读确认环境输入，账号秘密不落文档。

若目标基线变化，final gate 重算适用范围；上述固定基线只用于本次开发比较，不替代 `final_target_base`。共享消费者或配置增改必须补入消费者测试；没有变化且已验证的相同输入不重复 broad gate。

### Task 1: 共用招聘推荐卡、候选主体与分数位

目标：招聘推荐两模式最终调用同一组件，保留原底部行为，摘要缺失变明确占位。非目标：不动招聘在谈/P5、请求层或筛选。

文件：Create `src/组件/列表卡片/类型.ts`、`候选信息主体.tsx/.module.css`、`卡片分数.tsx/.module.css`、`招聘推荐卡.tsx/.module.css`、对应 `.test.tsx`；Create `src/数据/列表卡片映射.ts/.test.ts`；Modify `src/组件/候选头行.tsx`、`src/屏幕/候选推荐.tsx`、`候选推荐.module.css`、`候选推荐.test.tsx`。公用阶段和其他卡类型按公共契约声明即可，不预写后续组件。

生产：公共契约中的 `候选卡信息`、推荐组件、分数位、候选主体、前两个映射函数。消费：既有 `推荐候选` 和 `招聘候选摘要视图`，不得修改其业务含义。

- [ ] 核对 Spec revision/blob、产品基线可达，读本 Task 文件和相邻测试。登记 task intent，安装锁定依赖；共享头行的所有消费者用 `rg` 核对。
- [ ] 在新组件测试建立无 Provider 宿主；先写候选字段 null 的占位（含 `getByLabelText('性别未知')` 及 title）、分数 0/null、部分工作已知、重复标签与有值→null rerender。推荐操作分别验证 callback 次数、滑开零动作、禁用零动作、回执不渲染委托按钮。
- [ ] 执行 `npm test -- src/组件/列表卡片 src/数据/列表卡片映射.test.ts src/屏幕/候选推荐.test.tsx`，确认新行为断言失败；不能把缺依赖/测试未收集当 red。
- [ ] 按上述 props 实现主体和分数位，搬移 Mock 推荐卡样式，给候选头行加默认 false 的未知性别参数。保留已知分的现有适配环，未知只走中性分数位。
- [ ] 映射 Mock 画像拆分/工作教育与原标签；Backend 摘要只从当前快照来。原页面用 `操作状态={展示 === null ? {kind:'可委托',提交中:委托中} : {kind:'回执',文案:委托文字}}`，让状态回执无额外业务推断。
- [ ] 来源为两模式现有固定文案「你的AI代理从人才库筛出」，连同原图标随 Mock 卡面搬移，不新增来源 prop；组件测试断言来源保留。删除原两份推荐卡 JSX，两个 map 都调用共享组件；外层滑动行与收藏/淘汰/委托锁及异步闭包原样保留。只删除不再被引用的旧卡面 CSS，不动顶栏/弹层样式。
- [ ] 更新原「摘要 null 收行」断言，保留已有六态、API 零调用/真实 ID、失败与切岗断言；执行上述命令加 `npm test -- src/屏幕/候选详情.test.tsx src/屏幕/匿名在线简历.test.tsx`，检查默认头行未变。
- [ ] 定向测试通过后提交本 Task 文件：`git commit -m 'refactor: share recruiter recommendation card rendering'`；角色 review 按宿主要求，不能拿此 Task review 替代最终异构 review。

最小断言示例（Testing Library 无 jest-dom，使用已有 Vitest 风格）：

```tsx
const 点击 = vi.fn();
const 信息 = { 性别: null, 年限: null, 学历: null, 求职状态: null,
  工作: null, 教育: null, 亮点: [] } as const;
render(<招聘推荐卡 信息={信息} 匹配分={null} 收藏={false} 收藏禁用={false}
  滑开={false} 操作状态={{kind:'回执',文案:'委托失败'}}
  打开={点击} 切收藏={vi.fn()} 委托={vi.fn()} />);
expect(screen.getByText('工作经历未知')).toBeTruthy();
expect(screen.getByLabelText('匹配分未知')).toBeTruthy();
expect(screen.queryByRole('button', {name:'让AI代理去聊'})).toBeNull();
```

完成/停止：两种来源共享单组件、占位可读、所有原行为断言保留并通过；若需更改 API、范围或不可恢复 UI 决策则停止而非增加模式分支。

### Task 2: 共用招聘在谈卡和在谈阶段区

目标：统一招聘在谈卡，分数缺失占原匹配分位置，P5 待办移入阶段区而不丢状态。依赖 Task 1 公共类型、候选主体/分数位及映射；开工核对这些接口已在当前工作区提交中存在。非目标：不改候选端卡、历史、详情和 P5 状态机。

文件：Create `src/组件/列表卡片/招聘在谈卡.tsx/.module.css/.test.tsx`、`在谈阶段区.tsx/.module.css/.test.tsx`；Modify `src/数据/列表卡片映射.ts/.test.ts`、`src/屏幕/企业在谈候选.tsx/.module.css/.test.tsx`、`src/屏幕/P5/MatchCase列表.tsx/.module.css/.test.tsx`。不改业务 `MatchCase展示映射.ts` 和 DTO。

生产：`招聘在谈卡(招聘在谈卡属性)`、`在谈阶段区({信息})`、`从Mock候选到卡信息`、`从Mock在谈到阶段`、`从P5到阶段`，签名见公共契约。阶段区按四种真实语义色系显示标题，不根据 arbitrary 文本猜状态。

- [ ] 读取基线招聘 Mock 候选卡、P5 正常/错误视图及阶段颜色，记录现有 DOM/CSS 位置，确认 P5 历史是否引用同一 CSS 后再删样式。
- [ ] 写失败测试：完整/空摘要都保留工作教育标签；P5 匹配分未知；需要你/需注意/代理处理中出现在阶段区，attention 说明存在；Mock 阶段文字与下一步保留且徽标 null；Mock 需要你时有呼吸点，Backend 需要你时仅有徽标、无呼吸点。
- [ ] 执行 `npm test -- src/组件/列表卡片 src/数据/列表卡片映射.test.ts src/屏幕/企业在谈候选.test.tsx src/屏幕/P5/MatchCase列表.test.tsx` 验证 red。
- [ ] 按 Mock CSS 实现招聘在谈卡布局，复用候选主体与分数位。阶段区使用自己的小展示组件与 `阶段配色`；不改变通用 `阶段标签` 默认实现。原 P5 徽标显示文案优先级保留，只从头行搬到底部阶段区。
- [ ] Mock 层继续回查推荐标签并传给 `从Mock候选到卡信息`；Backend 只用合法 `P5列表正常视图.候选摘要`，传 `匹配分={null}`。卡内不读 fixture。两边打开回调保持各自 Case/原型 ID。
- [ ] P5 当前 `kind==='契约错误'` 路径先于共享卡片保持不变。不得用未知阶段替代错误行。保留列表 effect、排序、分页、scope 与轮询。
- [ ] 删除原 Mock 候选卡和 Backend 招聘在谈卡的重复 JSX/无人用 CSS；候选端 P5 卡还在，不能误删其 `职位段`、阶段样式或历史用类。
- [ ] 上述命令通过；再跑 `npm test -- src/屏幕/P5/MatchCase历史.test.tsx`；提交 `git commit -m 'refactor: share recruiter open case cards'`。

失败反例：`needs_action=false` 且 attention 非空时仍说代理处理中；把缺分数补 0；点击跳到 recommendation ID；CSS 清理让历史卡变形。完成需在测试里逐项排除；发现公共类型不匹配时修同一契约，不造第二个同义类型。

### Task 3: 共用求职在谈卡及公司占位

目标：真实 P5 在谈使用 Mock 公司卡布局及明确空位，保留冻结职位/薪资/城市/技能。依赖 Task 1 分数位、Task 2 阶段区和阶段映射，开工核对签名。非目标：不改看市场，不额外查公司/岗位/推荐。

文件：Create `src/组件/列表卡片/求职在谈卡.tsx/.module.css/.test.tsx`；Modify `src/屏幕/在谈首页.tsx/.module.css/.test.tsx`、`src/屏幕/P5/MatchCase列表.tsx/.module.css/.test.tsx`。不修改 `use适配分.ts` 的其它消费者。

生产：`求职在谈卡(求职在谈卡属性)`。消费：P5 正常职位视图 `{职位名,城市,薪资带,技能}`，Mock `在谈单`；Backend 连接层直接传公司三个 props 为 null、匹配分 null。

- [ ] 读取 Mock 卡、`use适配分` 及 P5 `职位段`。写无 Provider 卡片测试，断言公司信息未知/公司简介未知/公司图片未知、40px 未知分、职位/薪资/城市技能不丢。
- [ ] 写页面连接失败测试：真实接口缺公司不触发组织/推荐请求；Mock 局部连接组件计算分并传入；Backend 不触发该 hook 的 Mock 数据路径。公司 logo 无资源不能发空 URL/外部图片请求。
- [ ] 执行 `npm test -- src/组件/列表卡片/求职在谈卡.test.tsx src/屏幕/在谈首页.test.tsx src/屏幕/P5/MatchCase列表.test.tsx` 验证 red。
- [ ] 将原 Mock 卡 CSS 移入共享求职在谈卡；公司字标非 null 时复用 `公司字标`，null 时 CSS 中性空块 34px/10px。未知分使用 Task 1 卡片分数，薪资位仍在其下方，职位/标签/阶段顺序固定。
- [ ] Mock 原 `在谈卡` 改为仅做 `use适配分(单)` 和 props 映射的连接组件，不能含第二份卡面 JSX。不是在 map 的迭代体内直接调用 hook。
- [ ] Backend 传 `薪资={视图.职位.薪资带}`、`职位={视图.职位.职位名}`、`标签={[视图.职位.城市,...视图.职位.技能]}`、`阶段={从P5到阶段(视图)}`、原 caseId 导航。格式化薪资仅保留原展示破折号行为，不能改币种/单位或数值。
- [ ] 删除旧 Backend 候选卡/职位事实段及不再使用的样式；先全仓 rg 引用，保留列表/契约错误/空态/追加等容器样式。
- [ ] 上述命令通过，再执行 `npm test -- src/屏幕/看市场.test.tsx src/屏幕/P5/MatchCase历史.test.tsx`；提交 `git commit -m 'refactor: share candidate open case cards'`。

失败反例：P5 公司未知却显示静态公司 logo；把原城市技能行丢掉；为统一布局跨域读取；stage text 被下一步未知覆盖。完成需共享卡片无业务 import、原范围分组/待办入口继续有效。

### Task 4: 跨模式布局验收、完整本地验证与实施 peer review

目标：证明三类卡既共用结构，也在 320/390px 可读可点，未改真实请求与状态边界。依赖 Task 1–3 全部完成；核对公共类型和三类组件被六个调用路径实际引用。非目标：不新增演示路由/全站截图平台/生产 fixture 开关。

文件：Modify `e2e/数据源模式.spec.ts`（使用文件已有 P4/P5 fixture 与登录/路由宿主）、`e2e/视觉回归/场景.ts`（仅已变卡片定位器确需更新时）、对应 `场景.test.ts`；必要布局修复仅限 Task 1–3 文件；验证记录和 peer review 裁决写本 Plan 的实施记录。

- [ ] 添加命名带 `卡片统一` 及对应 `@mock`/`@backend` 的聚焦 Playwright 用例，复用 `P4招聘卡`、`创建P5MatchCasefixture`、`P5列表项wire` 及该文件现有 route handler。只对本组 fixture 实例修改完整/空/长文本/零值字段，不改所有 E2E 的默认业务事实，不新增生产注入入口。
- [ ] 新用例通过真实页面入口分别打开推荐、双端在谈；采集卡根内区域 boundingBox 相对卡根的坐标/尺寸，并截图到 `test-results`。完整等价展示输入的两模式区域顺序/几何差 ≤1px；差别仅出现在 Spec 允许的徽标/注意说明时按区域检查，不能用全页像素等同。
- [ ] 对 390×844、320×844 检查完整、全空、部分空、长文本；未知头行最多两行、分数区域不遮挡；工作/教育/标签未收行。用滚动尺寸与区域交集检查水平溢出/覆盖，再实际点击收藏、详情/整卡、委托及滑动操作验证可用性。
- [ ] 已知 Mock/Backend 数据不相同（P5 缺公司/匹配分）时不强制文字或截图相同：比较固定区位置，另用无 Provider 组件测试喂同一 props 证明模式无关。不得为了同图额外扩展 HTTP schema。
- [ ] 开发反馈 `npm run test:e2e:data-source -- --grep '卡片统一'`；首次先确认新增用例能揭示移位/收行，再实施最小 CSS 修复。将失败原因区分产品/测试/环境，不把超时简单记成 flaky。
- [ ] 执行本 Plan 测试责任里的 lint、build、完整定向 Vitest、全量 data-source 和 ui:check；每项记录 commit、命令、原始日志位置及退出码。Mock 完整场景应保持基线，批准的空值场景允许内容变化但不能抬高阈值或删除断言规避失败。
- [ ] 自检三类卡的运行时 import 与模式判断，删除已证明无人使用的重复 CSS，不扩展到其它死代码清理。更新 Spec 字段缺口表只允许核实事实；产品契约变化停止请求修订。
- [ ] 提交冻结候选 `git commit -m 'test: verify shared list card layouts across data sources'`。按宿主调用异构代码 review-loop：Codex→Claude、Claude→Codex，绑定批准 Spec 和执行 Plan 精确版本、固定 target base/candidate SHA；reviewer 不跑测试。使用 receiving-code-review 逐条裁决，optional 不阻塞，最多 3 轮。
- [ ] 修复 required 后仅重跑失效项；最终记录为无未解决有效 required，全部适用确认前测试有效，才进入 Task 5。

完成/停止：不能以 component tests 替代 CSS 浏览器观察；不能以 Mock visual PASS 证明 Backend；如现有基准/工具失败，保留证据修复合理范围，不宣称完成。相同有效候选的 full E2E 已包含聚焦测试时不重复跑两套最终 gate。

### Task 5: Final gate 与真实 local 验收、合入

目标：同一执行者完成批准前证据展示及批准后的真实边界验收和普通合入。依赖 Task 4；生产代码不新增任务外能力。文件：本 Plan 实施记录；必要修复仅前述范围；工具证据放 `dogfood-output/<run-id>/`、`ui-regression-output/`、`test-results/` 等已有输出目录（run-id 在现场生成，不是待填产品契约）。

- [ ] 完整读取 development-workflow 的 `references/final-integration.md` 与 skill 根目录相对 `assets/final-integration-contract.md`；检查任务预告，保留当前工作区用户内容。
- [ ] 只读 fetch，记录 pre-gate target SHA；核对所有适用确认前测试及实施 review 证据。环境确认输入：真实目标 URL、含 dev-local/browser-fixture 脚本的后端工作区、专用测试账号及 OTP 安全来源，缺失时提前明确询问，不在 prompt 写秘密。
- [ ] 给用户展示候选 SHA、target SHA、证据列表、复用/增量验证方案、真实 local 流程、同步及普通 push 动作和自主恢复边界。等待对这份具体 final gate 的明确确认；本规划批准不是合入批准。确认前不 merge target、不运行本次正式真实 local 验收、不 push。
- [ ] 确认后 fetch 并记录 `final_target_base`，`git merge --no-edit origin/main`，不 rebase 已 review 候选；重算完整责任。基准/输入/环境无变时复用有效测试，冲突/修复/环境变化仅补失效项；不得将旧 planning base 当最终比较基线。
- [ ] 真实 local 按 dogfood 指南原有工具和资源归属规则运行；观察候选看市场委托产生真实在谈后公司/分数未知占位、冻结薪资/职位；招聘推荐真实摘要/匹配分与收藏/委托，招聘在谈真实摘要/未知分及待办状态，点击进入正确详情。截图记录 390px 与必要窄屏，界面不出现演示名/假分；若缺失 Case/账号权限而无法观察，记录 BLOCKED，不以已通过 HTTP fixture 替代。
- [ ] 真实状态中未自然出现的所有 null/0/长文边界由 Task 4 自动化样本补充；不得修改真实他人业务状态强行造样本。每个节点区分实际执行/NOT_RUN，不声称完整跑完 H01 或 B01–B05。
- [ ] 清理由自己创建的 fixture/会话/服务并再核对其对既有测试 evidence 的影响；仅补因此失效项目。发现范围内失败自主归因修复，review 绑定修复后新候选；超范围产品变更停止说明。
- [ ] 再 fetch 核对 target 等于 final_target_base。未变化且 required evidence 完整时 `git push origin HEAD:main`（普通 fast-forward）；race/push rejected 不强推，更新方案再确认。无合入权限则保留候选/证据并报告具体缺口。
- [ ] 记录实际合入 SHA、原始验证结果/未执行项，task intent 更新 completed；未 push 成功不得声明已合入。

## Spec 覆盖自检

|Spec|交付|
|---|---|
|§1–3 范围/纯展示边界|Global Constraints，Task 1–3|
|§4 文本/图位/性别/分数/空因|公共契约，Task 1/3 的边界测试|
|§5 三类布局与阶段状态|Task 1 推荐、Task 2 招聘在谈/阶段、Task 3 求职在谈|
|§6 占位配色、布局稳定、窄屏与默认共享组件|公共占位契约、Task 1 默认头行保护、Task 4 浏览器|
|§7 字段缺口|固定现有映射，不扩 API；Task 4 核实|
|§8 行为与验证|每 Task 测试、Task 4 完整验证、Task 5 真实 local|
|§9–10 交付/批准|本 Plan、后续双宿主 bundle，Spec 批准 pin|

## 文档 review 记录

规划 owner：Codex。范围仅本 Plan 与对应 Spec；Claude opus/high 以 WORKFLOW_DOCUMENT_REVIEW 只读审查。批准契约固定上述 Spec revision/blob，候选版本每轮以 Git SHA 和文件 blob 记录；reviewer 禁止测试，逐条由 planner 自主裁决，最多 3 轮。第一轮候选 `5f5b9bd9e42673ff7b33f7e0836fe727b3bd4c2a`，Plan blob `149ad042da2686c23e3576b86e9455309190cabd`，Spec 批准 pin 不变。只读 guard（status、HEAD、文件指纹）通过；未运行产品测试。

第一轮裁决：

- R1-1 required / Important / 契约违反 / 复杂度不变：接受，固定 Backend 待办 false，Mock 取需要你，并补差异断言；不改 Spec。
- R1-2 required / Minor / 契约违反 / 复杂度不变：接受，补次要文字色、浏览器观察与 §6 覆盖；不改 Spec。
- R1-3 required / Minor / 契约违反 / 复杂度不变：接受，补性别可访问名/title 与断言；不改 Spec。
- R1-4 required / Minor / 契约违反 / 复杂度不变：接受明确来源。已核对候选推荐.tsx 两卡均为「你的AI代理从人才库筛出」，固定搬移，无新 prop；不改 Spec。
- R1-5 optional / Minor / 可选增强 / 复杂度降低：接受，将从Mock候选到卡信息的实现移到 Task 2，与实际消费者同时交付。
- R1-6 optional / Minor / 可选增强 / 复杂度降低：拒绝。用户明确启动 development-workflow，其 planning/execution contract 要求 task intent 与 final-integration 规则；这是既有工作流责任，不是本任务新增产品基础设施。维持这些约束。

第二轮候选 `b70b2d2e9679dd69c2b4599fb742ec0571956f98`，Plan blob `950ce6f2c22957e5049a0f32531315753f34530f`；同一 Claude opus/high session 复审返回 `NO FINDINGS`，四项 required 和已采纳 optional 均核实解决，拒绝项无新证据未重开。两轮 status、HEAD、文件指纹 guard 均通过。无未解决有效 required。最终本节仅补审查结果与完整版本，产品契约、接口和实施步骤不再变化。

## 实施记录

当前未实施，未运行产品测试或真实 local 验收。新实施 session 在这里记录各 Task 提交、命令与 receipt、实施 peer review 裁决、final gate 批准及最终合入事实；不得将规划文档检查写成产品 PASS。
