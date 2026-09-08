# Backend 在谈／市场、委托与 MatchCase 修复实施 Plan

> **For agentic workers:** 使用 `superpowers:executing-plans` 逐 Task 实施。上层 development-workflow 指定同一执行者在用户选择的新实施 session 连续完成，不自动启动 subagent-driven-development，不新增工作区。步骤用 checkbox 跟踪；本 Plan 冻结契约而不复制全部内部实现代码。

**Goal:** 完成已批准 Spec 的六类 Backend 内容与业务接线修复，保留 PM 现有视觉和 Mock 行为。

**Architecture:** 复用当前 React 页面、P4/P5 映射、当前意向／岗位 ID、会话缓存和 PDF 租约。只补 ID 恢复、页面本次委托记录、P5 工作区失效和真实创建 ID 回传；不新增全局状态框架、协议清洗层或后端接口。

**Tech Stack:** React 19、TypeScript、Vitest/jsdom、Testing Library、现有 HTTP 数据源、npm。

**Spec:** `docs/superpowers/specs/2026-09-08-backend-discovery-intention-matchcase-content-design.md`；用户在本轮明确回复“批准Spec，你继续吧”。批准 revision：`e6f4af66c5453c952cea997e2435e55650749165`；blob：`f5839c411825a05987ca5bc8835f057c6b8261f6`。Spec 工作树版本必须与该 blob 一致；本 Plan 不修改批准 Spec 自证合规。

## Global Constraints

- 仓库 `/Users/visionclaw/.paseo/worktrees/09eyc7i7/ignorant-cheetah`；复用该 Paseo 工作区与 `fix/recruit-card-intention-alignment` 分支。目标 `origin/main`，规划时本地可见 target 为 `968a51f40083b276d9c7cf0bf32f8f403212450f`，不是未来 final gate 的实际 target SHA。
- 先完整读取 `CLAUDE.md`、`AGENTS.md` 和批准 Spec。产品仅改 Backend；不改 Mock reducer、Mock 造 Case、样式定义或布局，不新增组件。可在现有组件中替换内容／条件／事件与复用 Mock 已有成功样式。
- 不执行任何基于浏览器的 E2E、Playwright、agent-browser、截图或视觉比较，不启动真实后端浏览器旅程。不改相关配置、CI、CSS、图标资产和视觉基线。
- 不推导 Case ID，不从推荐拼装 Workspace 卡片，不把 accepted／HTTP 成功解释成已开案；不放宽组织、披露或权限门禁。
- 不新增后端契约、全局时间／协议／缓存框架，不顺便拆分大文件；Mock 名称选择语义保留。只新增测试文件可行，新增产品组件不可行。
- 执行前用 `/Users/visionclaw/coding-harness/skills/development-workflow/scripts/task_intents.py` 登记路径与内部接口改动；扩大范围前更新并核对重叠。不创建第二工作区、不 stash/reset/clean 用户内容。
- 当前 Plan 的所有 Task 属于同一份联合验收交付。六个 Task 有各自回退与测试边界，但共享页面／状态文件，串行执行更简单；不拆成依赖尚未合入产物的多份 Plan。12 Task 软上限内无需人为拆批。
- 按 Task 先加有意义的失败反例、运行定向测试、最小实现、定向 PASS 后提交。定向通过不等于 final gate；实施 peer review 后展示具体 final gate 方案，用户确认后才同步 target／跑最终 broad gate／push。
- 外部真实栈未验收的部分始终标为“待联合验收”。后端空 keywords 修复的部署版本必须由联合验收 owner 核实，本 Plan 不声称其已部署。

## Task index 与交付边界

| Task | 交付与 Spec 对应 | 顺序／回退边界 |
| --- | --- | --- |
| 1 | 招聘卡机器码中文化（§3） | 无上游；独立回退映射与测试 |
| 2 | 意向 ID 选择、页面 scope 与刷新恢复（§4） | 接在 1 后；恢复与消费者一起回退，不留名称反查 |
| 3 | Case typed PDF 双端入口及租约生命周期（§5） | 接在 2 后；独立回退详情与测试 |
| 4 | 隐藏 ID 与终局本地时间（§6） | 与 3 同文件，串行；回退显示改动不回退 3 |
| 5 | 委托成功文案、暂留／过滤、单卡忙态、P5 失效与错误呈现（§7） | 消费 2 的准确 ID scope；全部子步骤闭环后交付，不只删导航 |
| 6 | 发布响应 ID 回传与新岗安全选中（§8） | 消费现有 ID scope；创建返回链与页面一并回退 |

**计划本身复杂度：高。** 变更横跨 P4、P5、候选会话恢复及发布返回链，涉及真实异步生命周期与多个消费者。

**零上下文漂移风险：中。** 行为、scope、错误语义和验证已冻结；内部现有实现与 PM 同时改动可能需要局部适配，外部后端部署不阻塞前端接口测试但限制联合验收结论。

执行模型只按零上下文漂移风险选择：使用当前可用的行业 Top 5–10 中高性价比模型；不因计划本身复杂度高而自动提高档位。

## 共同验证合同（测试选择五问）

1. **要防的失败与边界：** 意向／岗位错 scope、跨主体缓存污染、未经确认的成功、单卡阻塞全列表、旧在飞读复活空缓存、PDF 迟到租约泄漏、用户可见内部 token。DOM 测试需要检查用户文本和请求实参，不能只测纯 helper。
2. **最小合法入口：** `npm test -- <本 Task 精确测试文件>`；使用仓库 lockfile 依赖。已有 node_modules 可直接用，缺依赖时 `npm ci`。接口签名变更完成后运行 `npm run typecheck`，不先跑全套测试摸耗时。
3. **提前验证真实边界：** Task 2 的 storage＋Provider 重建、Task 5 的 HTTP 回执→P4→P5 操作接线、Task 6 的创建响应→数据源→操作→页面必须在各 Task 用现有 HTTP 适配与 Provider 测试证明，不只 mock 最外层 hook。此处“真实边界”是生产前端序列化／接线；不需要外部栈或浏览器。后端空 keywords 的部署问题不能由这些测试证明，留联合验收。
4. **最终权威验收与发布：** 同一实施者负责，final gate 确认后在最终候选依次运行 `npm test`、`npm run typecheck`、`npm run lint`、`npm run build`。仓库没有 affected wrapper，按实际 diff 核对这四项仍是正式非浏览器入口；同一有效候选不重复完整运行。此 Plan 不执行 deploy，普通 fast-forward 推送目标需要 final gate 明确确认。
5. **证据与成本：** 规划阶段仅源码／契约核对和文档检查，无产品测试 PASS 或计时，耗时未知。实施记录 source SHA、命令、结果、环境与必要 raw 日志；修复后只补失败项和实际影响项。不将旧分支 PASS 当本候选 PASS。

浏览器 L3 集成责任：`none`，用户明确豁免。发布后双端真实栈走查：`conditional`，owner 为后续联合验收执行者，前置是确认后端 `feat/recruitment-p7-screening-keywords` 修复已部署的精确版本；不在本次新实施 session 自动运行浏览器。CI 可能自行运行既有 UI Regression，不改 CI 或为此补截图；未跑部分不记 PASS。

## Task 1：招聘推荐内容映射

**文件：** 修改 `src/数据/发现推荐映射.ts`；测试 `src/数据/发现推荐映射.test.ts`。

**契约：** `从P4招聘候选(card: BFF招聘候选推荐): P4招聘候选页面` 签名不变。`employed→在职`；四个 highlights 分别为 `category_matched→职位方向匹配`、`experience_met→经验要求匹配`、`location_matched→工作地点匹配`、`workplace_mode_matched→办公方式匹配`。未知／空 job_status 为“求职状态待确认”，未知 highlights 过滤，已知顺序／重复数量不变。闭合自有键查表，原型属性名不能命中。

- [ ] 添加已知／未知／空／混合多项反例，确认旧透传实现失败；例如 highlights 为 `['category_matched','unknown','location_matched']` 时亮点精确等于 `['职位方向匹配','工作地点匹配']`，空数组仍为 `[]`，`constructor` 不产生亮点。
- [ ] 在现有 mapper 文件实现局部文案表，不动 DTO enum、摘要自由文本或匹配依据门禁；更新“原样透传”注释。
- [ ] 运行 `npm test -- src/数据/发现推荐映射.test.ts`，确认中文化和现有匿名投影测试通过；只提交本 Task 文件，建议 `fix: localize backend recruiter recommendation codes`。

完成条件：页面模型不再携带这两组字段的原始未知 token；无新增基础设施。停止条件：需要修改摘要／技能语义或后端协议时停止该扩展，仍完成本表映射。

## Task 2：Backend 当前意向统一 ID 与会话恢复

**文件：** 修改 `src/屏幕/顶部意向栏.tsx`、`src/屏幕/在谈首页.tsx`、`src/屏幕/看市场.tsx`、`src/状态/领域/候选资料.ts`、`src/状态/应用状态.tsx`、`src/状态/资料持久化.ts`、`src/数据/资料缓存.ts`、`src/状态/后端/类型.ts`、`src/状态/后端/会话操作.ts`、`src/状态/后端/候选操作.ts`、`src/状态/后端/Agent规则操作.ts`。最后两处仅接入已存在的权威意向水合和本任务的会话保护，不改 Agent 规则／简历业务。

**测试：** 修改 `src/数据/资料缓存.test.ts`、`src/状态/应用状态.test.ts`、`src/状态/后端/会话操作.test.ts`、`src/状态/后端/Agent规则操作.test.ts`、`src/屏幕/看市场.test.tsx`、`src/屏幕/P5/MatchCase列表.test.tsx`、`src/状态/后端/候选操作.test.ts`；新增 `src/屏幕/顶部意向栏.test.tsx`（新增的是测试）。

**内部契约与数据归属：**

- `当前意向编号: string | null` 继续是唯一选中值；保留 `切意向` 的 `{ 意向, 编号? }` 形状，Mock 不带编号。有效要求列表有同 ID 且服务端字典对应 active。
- `水合后端意向` 动作只增可选 `恢复编号?: string | null`；选择优先级为有效旧 ID → 有效恢复 ID → 返回列表首个 active → null。名称只来自选中的行，null 对应空串；普通水合不传恢复编号。不改 Mock `选新当前意向`／`改意向`／`删意向`／`新增意向`。
- `资料缓存快照` 增可选 `当前意向编号?: string | null`，只接受非空字符串或 null，旧格式仍可读。`水合账号资料` 解构丢弃该未校验字段，不能直接覆盖当前 ID。
- 为成功水合和持久化写屏障提供一个任务内聚接线：`后端操作依赖.提交候选意向快照(input: { 快照: 页面意向快照; subjectId: string; sessionGeneration: number; 恢复选择?: boolean }): void`。Provider 实现该回调：验证捕获主体／会话仍有效；首次角色水合的恢复选择才从 subject-scoped sessionStorage 读取恢复 ID；派发同一份快照并更新既有后端意向快照。回调只复用已有意向 state，不新增第二套选中状态。
- 回调同时在 Provider 局部 ref 记录已接纳的 `{ subjectId, sessionGeneration, 服务端对象引用 }`。`use资料持久化` 只在当前 candidate、账号缓存范围一致、代际一致，且 reducer 中的 `后端意向服务端` 已等于该对象引用后写选中 ID；否则保留缓存原字段，不用初始 null／默认值覆盖它。该 ref 只是成功水合到 React commit 的写屏障，不持久化，不是业务模型；避免把初始化空字典当权威空列表。
- 会话角色水合、候选创建／更新／删除及 409／503 重读、Agent scope_denied 重读，都经该回调提交真实成功快照；传入各请求开始时的主体／代际，不能在完成时重新取新主体冒充请求 owner。清账号／切角色的空种子仍走清理原动作，不标为一次成功读取。水合失败不触发回调；重试成功才打开写屏障。
- 正常缓存写入需保留未就绪或 recruiter 阶段的候选选择字段，避免既有“重写整个资料缓存”把它丢掉；不能把 A 字段并入 B。成功空列表允许写 null，退出／角色切换使旧写屏障失效。存储失败不影响页面。

- [ ] 在现有 active DTO fixture 构造同名上海／北京两项，明确 ID 为 `int_sh`／`int_bj`；补水合、编辑另一同名项／当前项、新增不抢占有效选择、删非当前项、删当前／最后项、归档回退及重排反例。确认正常水合保留 `int_bj`，无有效 ID 不使用标题兜底。
- [ ] 实现上述最小内部接线与缓存兼容；检查所有 `水合后端意向` 生产调用方，清理调用不能误标为服务端成功。会话依赖手工组装处及测试桩同步传入新回调，不静默缺省成无恢复能力。
- [ ] Backend 顶部按 ID 选中，标签按 Spec §4.2 的职位→城市→已有薪资→同组序号依次消歧；只对碰撞组加长。点击后端仍带名称与 ID，Mock 分支原样。在谈和市场横幅直接以有效当前 ID 构造 P5 key；无效“当前”scope 零请求，显式全部档继续 null。P4 已用 ID 的路径保留并测一致性。
- [ ] Provider 测试 seed sessionStorage 为 `int_bj`，完整卸载重建；控制服务端 Promise，断言水合前零 P4／当前 P5 请求、缓存仍为 `int_bj`；水合后首次请求即 `int_bj`。补失败重试、失效 ID 回退、权威空列表清空、存储损坏／抛错、环境／主体／角色隔离和迟到水合。
- [ ] 组件测试点击第二胶囊，断言第二选中、P4/P5 请求实参和横幅对应 `int_bj`，不是第一条；全部档不高亮，无效当前不会查询全部。直接断言胶囊容器及首页用户可见 `textContent` 不含 `int_sh`／`int_bj` 或 `int_` 前缀内部编号；同城市、同薪资与最终同组序号也覆盖该负断言。旧名称-only Backend fixture 补有效 ID，不能保留反查兼容。
- [ ] 运行 `npm test -- src/数据/资料缓存.test.ts src/状态/应用状态.test.ts src/状态/后端/会话操作.test.ts src/状态/后端/候选操作.test.ts src/状态/后端/Agent规则操作.test.ts src/屏幕/顶部意向栏.test.tsx src/屏幕/看市场.test.tsx src/屏幕/P5/MatchCase列表.test.tsx`。候选 CRUD 用例复用已有候选操作测试和应用状态测试，不删除该测试参数。运行 `npm run typecheck`，提交 `fix: keep backend intention selection scoped by id`。

完成条件：Spec §4 所有请求／显示／刷新一致，Mock 未动。回退必须覆盖恢复接线、缓存字段与页面消费者，旧缓存多一个可选字段不会破坏旧版。若发现需要持久化业务快照或重构 Mock，拒绝该扩展。

## Task 3：双端 Case 附件与 PDF 生命周期

**文件：** 修改 `src/屏幕/P5/MatchCase详情.tsx`、`src/屏幕/P5/MatchCase详情.test.tsx`。只读参考 `src/数据/PDF对象租约.ts`、`src/状态/后端/MatchCase操作.ts`、`src/数据/招聘数据源/MatchCase.ts`，不新增取 PDF 方法或组件。

**契约：** 阶段 typed attachment 为唯一入口授权；两端传 `点附件` 并调用现有 `读取简历PDF(role, caseId)`；`附件常驻` 只取附件在场，不再 recruiter 过滤。无附件零入口零请求，角色路径严格。现有 S1 递交／披露动作不变。

- [ ] 替换“候选端无任何 PDF UI”旧测试；双端覆盖有／无附件、有段内对话；点击断言准确 role＋caseId、既有 dialog 与 iframe src、重复点击单飞。
- [ ] 移除附件值／常驻／回调的多余角色条件，更新旧注释。复用现有弹层、租约 ref 与关闭入口，保留所有样式。
- [ ] 将本次读取捕获绑定 role＋caseId＋详情主体生命周期。Case／角色变化时回收旧租约、清预览、使在飞读取过期；卸载同样处理。Promise 迟到成功时立即 revoke，不 setState；迟到失败不在新 Case 轻提示。只有当前读取的 finally 可释放自己的在飞标志，不能解锁新请求。可用局部代际 ref 和 effect，不建全局租约系统。
- [ ] 延迟 Promise 用例分别在关闭（已打开）、换 Case、换角色、卸载后验证回收；未完成时卸载后 resolve 仍回收；正常失败当前页轻提示，无跳转、无虚假文件。已有会话级回收仍遵守租约幂等 revoke，不以 spy 次数误判幂等多边界回收。
- [ ] 运行 `npm test -- src/屏幕/P5/MatchCase详情.test.tsx src/数据/PDF对象租约.test.ts src/数据/招聘数据源/MatchCase.test.ts`，提交 `fix: expose case authorized resume to both roles`。

完成条件：用户能看当前 Case 自己的真实附件，旧招聘行为不回归。回退只覆盖此 Task 的附件和局部生命周期改动。

## Task 4：MatchCase 隐藏 ID 与终局时间

**文件：** 修改 `src/数据/MatchCase展示映射.ts`、`src/数据/MatchCase展示映射.test.ts`、`src/屏幕/P5/MatchCase详情.tsx`、`src/屏幕/P5/MatchCase详情.test.tsx`。

**契约：** 内部 `intentionId` 不删除；只清掉状态行可见“意向 {ID}”。保持现有节点／样式声明亦可，只要无可见 ID 或新增占位文案，不能借清理去改 CSS／布局。`定格于` 的 string 形状不变，改为本地显示值。

- [ ] DOM 反例同时断言 `container.textContent` 不含 `int_0123456789abcdef`、不含原 `2026-08-29T03:00:00Z`，并断言原始 RFC3339 模式不出现；只断言新中文文本存在不够。使用受控 fixture 避免 Agent 自由文本携带相同字串。
- [ ] 本文件内函数 `格式化终局时间(原文: string): string` 用 Date 校验有效性、`Intl.DateTimeFormat('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' })` 和 formatToParts 拼 `YYYY-MM-DD HH:mm`。不设置生产 timeZone，不硬编码加八小时；invalid date 返回“时间待确认”，不改 decoder。
- [ ] 保留加载、轮询、动作、会话跳转及 Task 3 PDF 测试；去掉旧 ID DOM 断言，保留 mapper 内部 ID 断言。CSS、行内样式值及布局均不改，不强行删除仍保留的内容槽。
- [ ] 分别运行 `TZ=Asia/Shanghai npm test -- src/数据/MatchCase展示映射.test.ts src/屏幕/P5/MatchCase详情.test.tsx` 与 `TZ=UTC npm test -- src/数据/MatchCase展示映射.test.ts`。测试按该进程实际时区给期望，上海例为 `2026-08-29 11:00`、UTC 为 `2026-08-29 03:00`；补跨日、午夜 00、异常值。提交 `fix: keep internal case coordinates out of visible copy`。

完成条件：可见内容无内部 ID／原始终局时间，内部契约和业务接线不变；不延伸格式化其他时间或自由文本。

## Task 5：委托成功展示、列表生命周期与真实在谈刷新

**文件：** 修改 `src/数据/发现推荐映射.ts`、`src/屏幕/候选推荐.tsx`、`src/屏幕/看市场.tsx`、`src/屏幕/匿名在线简历.tsx`、`src/屏幕/职位详情.tsx`、`src/状态/后端/发现推荐操作.ts`、`src/状态/后端/MatchCase操作.ts`、`src/屏幕/P5/MatchCase列表.tsx`。按现有组合需要改 `src/状态/应用状态.tsx`／`src/状态/后端/类型.ts`；轮询钩子 `src/状态/后端/use发现推荐委托轮询.ts` 优先只复用，不改节拍。

**测试：** 相应 `src/数据/发现推荐映射.test.ts`、四个页面 `.test.tsx`、`src/状态/后端/发现推荐操作.test.ts`、`src/状态/后端/MatchCase操作.test.ts`、`src/状态/后端/use发现推荐委托轮询.test.tsx`、`src/屏幕/P5/MatchCase列表.test.tsx`；Provider 接线测试在 `src/状态/应用状态.test.ts`。数据源边界用现有 `src/数据/招聘数据源/发现推荐.test.ts`。

**冻结状态矩阵：**

| 输入 | 控件／过滤／失效 |
| --- | --- |
| delegation 为 null | 对应 Mock 主操作，坐标与权限就绪才可点 |
| HTTP 在飞、accepted、evaluating | 不可重复提交，不显示成功；保持轮询／原安全提示；不按成功过滤、不失效 P5 |
| case_started＋非空合法 case_id | 页面对应已接手／已接触不可操作成功槽；历史成功过滤、本次成功暂留；P5 对应与全部 open 失效 |
| case_started＋null／空白 case_id | 非成功，不过滤、不失效；安全“暂时无法确认进度，请稍后刷新”或既有契约错误，不能声称已开案 |
| needs_user、refused、failed | 原状态／原因／重试，不按成功过滤，不显示已接手，不改变状态机 |

**接口冻结：** `映射P4委托展示(summary, receipt)` 保留 `state/copy/reason/inProgress/caseId` 形状；成功统一由 `state === 'case_started' && caseId !== null` 判断。mapper 可使无 caseId 的 case_started copy 为已有进度未知文案。各页成功文案在页面固定，不把 recruiter 两处不同成功词强行统一进 mapper。

**P5 局部接口：** 在 `MatchCase操作.ts` 导出 `失效P5开案工作区(deps: 后端操作依赖, input: { role: P5角色; subjectId: string; sessionGeneration: number; filterRefs: readonly string[] }): void`，供 P4 开案提交调用。函数入口先调用本文件既有 `取P5引用(deps)`，复用其缺引用即抛接线错误的守卫并取得必需的 P5范围代际；不能 optional chain 或缺失时静默 return。沿用既有 deps，不新增 Provider 全局事件层。生产和手工测试依赖桩同步提供原有完整 P5运行时引用；测试缺引用时明确报接线错误，不得仍宣称失效成功。

- [ ] 先补六态＋坏 Case ID mapper／页面失败用例。四页主操作文案按 Spec §7.1；招聘列表为“AI代理已接触”，其他三页“AI代理已接手”；匿名在线简历未委托为 Mock 的“让AI代理去谈”。成功无“查看进展”、无导航，原资料入口地址不变。职位详情复用 disabled 主键，其余复用已有 span／状态条；不新增样式。
- [ ] 两个列表建立当前页面周期本次发起集合，key 为 candidate intention＋job 或 recruiter job＋recommendation，关联 delegation_id 后才能匹配轮询。记录点击只表示本次操作；显示成功／暂留始终还要通过权威成功谓词。POST 直接成功和轮询到成功都保留原排序。进屏首载的历史成功不加入集合，历史 accepted 本轮变成功也不当本轮点击暂留。
- [ ] 页面周期至少绑定主体、角色、scope 及挂载；离开到详情／其他子视图、切 scope、scope A→B→A 均结束旧周期并清本次集合。迟到 POST resolve 或 finally 不能改新周期记录／忙态；若服务端权威重读不再返回本次卡，不伪造推荐快照，保留当前已加载卡的短暂展示仅限本周期已有内容，不写回数据源或外存。用户主动搜索／收藏筛选照常，不能以暂留绕过筛选。
- [ ] 只对历史成功执行渲染过滤，不修改 P4 原始缓存或删除详情坐标；重挂／浏览器刷新集合为空，以 GET 摘要恢复判断。已成功或进行中禁重复；无推荐坐标的直接职位详情仍不可委托。前端未加载完成／失败不得当作 null delegation 放开操作。
- [ ] 将列表委托 busy 变为本地按业务 pair 的集合／ref，保留操作层相同 pair 单飞／幂等；不要再用整页反馈中锁委托。候选确认层确认关闭后可以处理另一张卡；测试 A pending 时 B 委托和收藏可执行、A 连点仅一次。同一资源现有反馈锁保持，不改反馈协议。
- [ ] 实现 P5 失效：对去重的 `[...filterRefs, null]` 计算 `P5范围键.open(role, ref)`，只在捕获主体／代际仍有效时对该 key 的 `${scopeKey}#读` 加一并移除匹配 owner 的工作区槽。引用中的读代际在调用栈内更新，不在 React updater 内做副作用；旧读／追加因此过期，新加载能接管读锁。别改 scope 生命周期、动作幂等、详情、历史或其他角色快照。
- [ ] 在 P4 委托创建成功和轮询成功的有效提交点接失效。创建直接用操作输入 intentionId／jobId；轮询提交前按旧卡 delegation_id 匹配候选列表键、招聘列表／详情 jobId，收集实际关联 filterRefs；无关联仍失效同角色全部，不能猜 scope。对同一 delegation_id＋case_id 使用已存在 `P4真实Case引用` 判断是否已处理，不另建持久去重表。React 同批提交也不得重复触发重读；本方案只有失效无立即 GET。不能在用户换 scope 后用陈旧回执失效新 scope。
- [ ] 修复 `MatchCase列表` 已成功空缓存刷新失败被条目数隐藏的错误／重试：error 在场时不能只显示正常空态；复用现有错误行及按钮。有旧卡保留只读、首载错误原行为保留，重试继续真实 API。保留 lifecycle 列表合同，不因开案强塞 open。
- [ ] 用生产操作工厂＋受控 HTTP facade 验证：POST/轮询 case_started 后，已缓存的对应与全部 P5 scope 再调用加载工作区会真实 GET；其他 scope 仍缓存；旧延迟 GET resolve 不复活空缓存；随后 GET 新 Case→页面用后端 caseId 进入详情。GET 返回空、ended 或失败均不造卡。两角色／详情发起路径至少覆盖完整接线。
- [ ] 运行 `npm test -- src/数据/发现推荐映射.test.ts src/数据/招聘数据源/发现推荐.test.ts src/屏幕/候选推荐.test.tsx src/屏幕/看市场.test.tsx src/屏幕/匿名在线简历.test.tsx src/屏幕/职位详情.test.tsx src/状态/后端/发现推荐操作.test.ts src/状态/后端/use发现推荐委托轮询.test.tsx src/状态/后端/MatchCase操作.test.ts src/屏幕/P5/MatchCase列表.test.tsx src/状态/应用状态.test.ts`，再 `npm run typecheck`。提交 `fix: align backend delegation feedback with mock interaction`。

完成条件：成功展示／卡片去留／非成功保留／单卡互不阻塞／P5 失效作为整体通过。回退需包含全部接线，不只恢复一个导航按钮；不改成功事实或 lifecycle 定义。后端 500 是错误，绝不补关键词绕过。

## Task 6：发布成功回传真实岗位 ID 并安全选中

**文件：** 修改 `src/数据/招聘数据源类型.ts`、`src/数据/招聘数据源/岗位.ts`、`src/状态/后端/类型.ts`、`src/状态/后端/岗位操作.ts`、`src/屏幕/发布岗位.tsx`。按类型推导影响核对 `src/数据/HTTP招聘数据源.ts`（只有显式声明才改）。测试 `src/数据/招聘数据源/岗位.test.ts`、`src/状态/后端/岗位操作.test.ts`、`src/屏幕/发布岗位.test.tsx`、`src/屏幕/候选推荐.test.tsx`、`src/屏幕/P5/MatchCase列表.test.tsx`、`src/状态/应用状态.test.ts`。

**内部结果契约：** 新增 `页面岗位创建结果 extends 页面岗位快照 { 创建岗位编号: string }`；仅创建返回 `Promise<页面岗位创建结果>`，列表／更新／归档返回原快照不变。`岗位操作.发布岗位(job: 在招岗位): Promise<string | null>`：有效 Backend 成功返回真实创建 ID；Mock 保持原派发但返回 null；因同操作已在飞而未执行、请求过时则 null；失败抛原错误，调用方不能把 null 当 Backend 成功。此为前端内部契约，无新增 wire 字段。

- [ ] 数据源测试 POST job_id 与输入 P-xx 不同，随后岗位列表包含多个同名／并发新增岗；断言返回创建 ID 精确等于 POST ID，与数组位置无关。ID 空白／缺失为 invalid_response；必须先验证再写附属。成功重读没包含该可用岗位或重读失败，不静默选择其他岗位，走错误恢复。
- [ ] 数据源返回 `{ ...权威快照, 创建岗位编号: result.job_id }`；不返回整个新 DTO 作第二份状态、不扩大全部岗位快照接口。岗位操作捕获发起主体／角色／会话代际，成功先确认仍有效再水合后端岗位并返回 ID；迟到成功／失败不能污染新主体。409／503 权威重读也使用发起 fence，过时 401 不清新会话。保留其余岗位动作语义，不泛化全部写操作。
- [ ] 页面提交开始捕获本次页面生命周期和已提交的角色／主体／当前岗位选择变化版本；页面内 ref 在可观察的导航／scope 改变时使本次意图失效（包括离开再回来、A→B→A），不用仅比较最终 ID。Backend await 返回非 null 且意图仍有效时，先派发 `切当前岗位`（真实 ID），再按既有流程提示／企业人才 Tab／主壳或注册初始化；null 或旧意图不导航、不提示成功。Mock 继续原成功导航，不套 Backend 非 null 判断。
- [ ] 发布页无全局选择系统需求：以现有路由 location key、页面清理和局部变化计数保护当前发布即可；若宿主在切换时卸载组件，cleanup 已使旧回调失效。不在 reducer 永久增加导航事务或通用意图模型。编辑分支保持原保存返回。
- [ ] 组件＋Provider 反例：正常发布前选择旧岗，响应后新胶囊、标题、推荐 API 和当前 P5 scope 都为新 ID，正在加载不出现旧候选，空响应给该岗空态；失败保旧选择；leave/unmount、角色／主体变化、用户选另一岗及 A→B→A 后 resolve 不抢选／跳页。保留现有组织资格门禁与 Mock 测试。
- [ ] 运行 `npm test -- src/数据/招聘数据源/岗位.test.ts src/状态/后端/岗位操作.test.ts src/屏幕/发布岗位.test.tsx src/屏幕/候选推荐.test.tsx src/屏幕/P5/MatchCase列表.test.tsx src/状态/应用状态.test.ts` 和 `npm run typecheck`，提交 `fix: select the server created job after publishing`。

完成条件：新增返回链与消费页面共同通过，所有现有生产创建消费者和相关测试桩更新到明确新返回值；未执行／过时不能当发布成功。回退同时撤创建结果类型与页面消费，wire 不受影响。

## 收尾（不计入实现 Task）

- [ ] 对照 Spec §9 验收矩阵检查 Task 证据。用 `git diff --name-only 968a51f40083b276d9c7cf0bf32f8f403212450f...HEAD` 审核自身文件范围，确认没有 CSS、视觉基线、Mock 状态机或后端契约变化；核对实际当前基线变化，不将该 planning SHA 当最终 gate base。
- [ ] 在 `docs/handoffs/2026-09-08-backend-discovery-intention-matchcase-content-implementation.md` 记录实现 commit、定向命令／结果／耗时、Spec/Plan 精确版本、未跑浏览器理由和待联合验收；该路径是实施者产物，规划时不存在正常，不是要求预先读取的输入。
- [ ] 定向收敛后按宿主映射进行异构代码 review（Codex 实施→Claude；Claude 实施→Codex）。冻结代码 base/head 与批准 Spec／最终 Plan 版本，reviewer 不跑测试，最多三轮，逐项核实并记录 required／optional、复杂度及裁决；文档 review 不能替代该步骤。
- [ ] 更新 task intent，展示具体 final gate 方案：当前候选、实际观察的 `origin/main` SHA、上述非浏览器四项 gate、普通 fast-forward push、自主范围内修复边界。未获明确确认前不得合 target 或跑最终 broad gate。
- [ ] 确认后按 `/Users/visionclaw/coding-harness/skills/development-workflow/references/final-integration.md` 同步真实 target，重算验证责任，完成一次权威 gate；保留有效证据，修复后只补实际失效验证。target race 按合同重新展示方案，不强推或无限追赶。
- [ ] 最终报告区分：前端定向／权威验证、异构 review、是否实际 push、浏览器未运行、后端部署未核验及待联合验收。不得宣称未做的真实栈／视觉验证 PASS。
