# Review R1 修复报告（在谈详情统一 · survey-frequent-pages-component-reuse）

- 日期：2026-09-10
- 范围：五条已接收 finding（F1/F3/F4/F5/F6）的落地、验证与提交；被驳回的 finding 2（Mock 状态区）未触碰。
- 分支边界遵守：未改 BFF schema/URL/query/body/解码/授权/状态机，未新增查询；内部 Tab 键 `进度/资料` 与契约 A/C 类型形状不变；平行边界文件（列表卡片等）零触碰；`src/组件/在谈详情` 保持纯展示。

## F1（required）Tab 可见名称恢复产品合同

**改动**
- `src/组件/在谈详情/详情外壳.tsx:11-24,34`：Tab 名表按 `信息.端` 投影 —— 求职 →
  [{进度, 代谈进度}, {资料, 职位详情}]，招聘 → [{进度, 代谈进度}, {资料, 在线简历}]。
  Tab 键（契约 A 冻结）与 `切Tab` 回调不变；深链 `?tab=job`/`?tab=resume` 仍由连接层
  映射到键 `资料`（连接层零改动）。招聘端 Backend 未新增 alias/真名（纯展示改名）。

**测试随动**
- `src/组件/在谈详情/详情外壳.test.tsx`：两端 Tab 名断言（求职 代谈进度/职位详情、招聘 代谈进度/在线简历）。
- `src/屏幕/在谈详情.test.tsx:170-172`（Mock 求职端）、`src/屏幕/候选详情.test.tsx:90-91,120,155,170,212,229,234`（Mock 招聘端 + Backend 读入中缺席）。
- `src/屏幕/P5/MatchCase详情.test.tsx`：Task 1–10 改成 进度/资料 的断言全部按端还原（413-414、417、444-446、716、749-752、780、799、813、826-829、2674-2675、2778）；
  「缺 P5.1 段」测试（原 680-692）重写 —— Tab 行现在是共用产品名，招聘端 Tab 名不上求职端，P5.1 面（匹配度分析/公司块）仍缺席；资料区标题循环改 `getAllByText`（`职位详情` 与 Tab 按钮同词）。
- `src/屏幕/详情控制/后端正常详情.test.tsx:274-275,292,296`。
- e2e `e2e/数据源模式.spec.ts`：在谈详情完整布局 4 条旅程的 Tab 定位器按端更新（`代谈进度`/`职位详情`/`在线简历`），旅程其余步骤不变；`断言纵序` 入参扩为 `string | Locator`（7671），`职位详情` 区块标题用 `getByText(..., {exact:true}).last()` 避开同词 Tab 按钮。
- e2e `e2e/视觉回归/场景.ts:180-197`：`?tab=job` 深链不变，「资料 Tab 按钮」锚点收回收敛的精确名 `button[name="职位详情" exact]`（基线与当前同名，跨版本 alternation 退役）。

## F3（required）Backend 求职顶栏公司槽

**改动**
- `src/数据/详情展示映射.ts:26`：candidate 分支标题 `${view.职位.职位名} · 公司信息缺失`
  （公司槽位原位保留、spec §3.1 缺失文案；无新查询/类型）。招聘端分支未动（岗位上下文行已承载）。

**测试随动**
- `src/数据/详情展示映射.test.ts:53`、`src/屏幕/详情控制/use后端详情控制.test.tsx:304,331`、`src/屏幕/详情控制/后端正常详情.test.tsx:273`、`src/屏幕/P5/MatchCase详情.test.tsx` 全部求职端顶栏断言改组合标题。
- e2e：Playwright `getByText` 子串匹配天然兼容；`断言纵序` 的 `公司信息` 锚点因顶栏新增「公司信息缺失」串味，backend 旅程改精确锚点（`e2e/数据源模式.spec.ts:8297`）。

## F4（required）叮嘱草稿按 scope 隔离 + 迟到栅栏

**改动**（`src/屏幕/详情控制/use后端详情控制.ts:103-124`）
- 新增 `叮嘱代际` ref：`[role, caseId, 主体.subject_id]` 换代与卸载都递增；换代效果同时
  `设叮嘱草稿('')` 并放行在飞锁（`发送中.current = false`，新 scope 干净起步）。
- `发叮嘱` 捕获本轮代际：成功清空、失败轻提示、finally 收口（`发送中.current = false`）
  均过代际栅栏 —— 旧单迟到的回调对不上代际整包作废（spec §3.1/§5）。

**新增测试**
- `src/屏幕/详情控制/use后端详情控制.test.tsx:415-508`（hook 级，3 条）：换单清草稿零误发；
  A 在飞迟到落定不清 B 的草稿且 B 照常可发（锁不被旧单卡死）；同一 URL 主体换代同样清草稿。
- `src/屏幕/P5/MatchCase详情.test.tsx:2684-2714`（屏级）：同一 Route 内 `测试换Case钮` 换单后
  父 hook 草稿清空、B 发送只带 B 的 case_id。

## F5（required）发命令迟到失败/收口栅栏

**改动**（`src/屏幕/详情控制/use后端详情动作.ts:119-137`）
- `发命令` 捕获现有 `代际`：`catch（报错）` 与 `finally（设写中(false)）` 只在本轮代际上收口。
- 既有 caseId 重置效果补 `设写中(false)`（:100）：hook 复用换 case 时旧单写中不卡死新单
  （真实路由为 keyed 重挂载，此项是防御性收口）。

**新增测试**
- `src/屏幕/详情控制/use后端详情动作.test.tsx:972-1033`：换单后迟到的失败不提示
  （轻提示计数 0，含单例容器清空防串扰）、不收口新单；新单照常可发且本代失败正常提示/收口。

## F6（required）写中禁用解释

**改动**（`src/屏幕/详情控制/use后端详情动作.ts:119-121` + 10 个被 写中 门控的按钮）
- 新增 `写中说明 = '正在提交，请稍候'`；end_screening / accept / replace / decline / retry /
  decide_resume_screening×2 / decide_coordination×2 / confirm_intent / decline_intent 全部
  写中期间 `禁用说明: 写中 ? 写中说明 : null`（`执行: null` 语义不变）。共用 `详情动作卡`/
  `详情按钮位` 既有 aria-describedby 渲染负责可见与可访问关联，展示层零改动。

**新增/随动测试**
- `src/屏幕/详情控制/后端正常详情.test.tsx:357-413`（DOM 级，双键 decide_resume_screening +
  单键 confirm_intent）：在飞时真实 disabled、`正在提交，请稍候` 可见且
  `aria-describedby → document.getElementById(...).textContent` 关联成立；落定后恢复
  （可再点、说明退场）。
- `src/屏幕/详情控制/use后端详情动作.test.tsx`：两条既有写中锁测试补断言在飞
  `禁用说明 === '正在提交，请稍候'`、落定恢复 `null`。

## 验证证据

| 命令 | 结果 |
| --- | --- |
| `npm test`（vitest 全量） | 184 文件 / 3833 用例全部通过 |
| `npm run typecheck` | 通过（exit 0） |
| `npm run lint`（oxlint） | 通过（exit 0） |
| `npm run test:e2e:data-source -- --grep '在谈详情完整布局'` | 7 passed（mock 双端 2 + backend 双端 2 + 终局只读 1 + 刷新 2；截图重生成于 `test-results/详情布局/`） |

排查记录（e2e 一次失败）：backend 求职端旅程 `断言纵序` 的 `公司信息` 子串锚点被 F3 顶栏
「… · 公司信息缺失」串味（命中顶栏 y=6），改精确锚点后通过 —— 根因即 F3 文案与既有子串
锚点的冲突，非布局回归。

## 文件清单

源码 4：`src/组件/在谈详情/详情外壳.tsx`、`src/数据/详情展示映射.ts`、`src/屏幕/详情控制/use后端详情控制.ts`、`src/屏幕/详情控制/use后端详情动作.ts`
测试 8：`详情外壳.test.tsx`、`详情展示映射.test.ts`、`use后端详情控制.test.tsx`、`use后端详情动作.test.tsx`、`后端正常详情.test.tsx`、`MatchCase详情.test.tsx`、`在谈详情.test.tsx`、`候选详情.test.tsx`
e2e 2：`e2e/数据源模式.spec.ts`、`e2e/视觉回归/场景.ts`

## 顾虑

- 无阻塞项。两处刻意的最小取舍：F4 的 scope 换代效果同时放行 `发送中` ref（否则迟到的
  finally 被栅栏吞掉会让在飞锁永久卡死，spec §5「丢弃迟到」与「新 scope 干净起步」需配套）；
  F5 在既有 caseId 重置效果补一行 `设写中(false)`（hook 复用路径的防御性收口，真实路由
  keyed 重挂载天然重置）。
- 视觉回归基线：Tab 行文案像素将随 F1 变化，`candidate-negotiation-detail` 场景的几何锚点
  已收紧为精确名，正式跑 视觉回归 时按流程重采基线即可（本次未跑，任务清单只要求
  data-source grep）。

---

# Review R2 修复记录（追加，2026-09-10）

Codex round 2 确认 F1–F6 已解决、F2 维持关闭；新接收一条 required finding。

## F-r2-1（required）回答在飞表按主体隔离

**问题**：账号 A 在 caseId=X 的 respond_fact 在飞期间，同一路由切到账号 B：父 hook
（use后端详情控制）不随主体重挂载，回答在飞表仍含 A 的条目 → B 的回答区被判提交中直至
A 落定；且 A 的迟到 `回答在飞表.current.delete(caseId)` 会误删 B 的同单在飞项。

**改动**
- `src/屏幕/详情控制/use后端详情控制.ts:135-153`：检测 `主体.subject_id` 变化时把
  `回答在飞表.current` 整表替换为全新 Map —— RefObject 与契约 C 类型不变（子 hook 经同一
  RefObject 读到新表）；换单/同主体重渲不换表（回原单续锁语义保持）。**替换必须在渲染期
  完成**：React 的 effects 自子向父触发，新主体子 hook（keyed 重挂载）的换单续锁效果先于
  父 hook 的 passive effect 读表 —— effect 里换表会让 B 误继承 A 的锁（屏级测试先红后绿，
  实证钉住该顺序）。刻意不用「清空同一个 ref」：A 迟到的 delete 会删到 B 在同一 Map 里的
  新条目。
- `src/屏幕/详情控制/use后端详情动作.ts:139-161`：`发回答` 提交时把当时
  `回答在飞表.current` 的 Map 实例捕获进闭包（`锁表`），`finally` 的 delete 与记账 set 都
  作用于被捕获的表 —— A 的迟到清理只作用于 A 的旧表，绝不动 B 的新表。续锁观察者本就
  只读承诺链 + 代际栅栏收口，无需改动。

**测试**
- `src/屏幕/详情控制/use后端详情控制.test.tsx:415-450`（hook 级）：主体换代
  `.current` 换全新空表、RefObject 不变；换单与同主体重渲仍同一张表。
- `src/屏幕/详情控制/use后端详情动作.test.tsx:535-585`（hook 级）：A 提交在飞 → 换主体
  （模拟父 hook 整表替换 + 子 hook 重挂载）→ B 不继承锁、能发起自己的请求（新表记账）→
  A 迟到落定只清被捕获的旧表、B 的在飞项不动、B 仍在飞 → B 自己落定正常收口。
- `src/屏幕/P5/MatchCase详情.test.tsx:2786-2848`（屏级全链路，Codex 验证场景）：
  A 回答 pending → 同路由同 caseId 换账号 → B 初始不继承锁（输入/提交键可用）并发起自己的
  请求 → A 迟到失败落定：不清 B 草稿、不放 B 锁、轻提示 0（A 的失败不弹）→ B 自己落定后
  草稿清空、锁释放。

**验证**：`npm test` 184 文件 / 3836 用例全过（含上述 3 条新测试）；`npm run typecheck`
exit 0；`npm run lint` exit 0；
`npm run test:e2e:data-source -- --grep '在谈详情完整布局'` 7 passed（不受影响）。

提交：`fix(review-r2): isolate answer in-flight table by subject`（本文件随同提交）。