# 候选人交互登录水合与求职意向修复 Handoff

> 本文面向拿到前端仓库、但没有测试机文件、浏览器会话或此前聊天记录的 Coding Agent。文中所有路径均为仓库相对路径。

## 目标

修复 Backend 模式下已有账号完成短信登录后，候选人简历、求职意向等角色数据不加载的问题；同时补齐求职意向薪资双滚轮的键盘与直接点选能力。

这两个问题均已通过真实 `backend/local` 浏览器走查和代码追踪归因为前端问题。求职意向的 POST、PATCH、乐观并发版本和后续 GET 均已证明后端正常，不需要为这次修复修改 BFF 合同或数据。

## 运行方式

```bash
npm install
VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local npm run dev
```

用 `http://localhost:5173` 访问前端。本地 BFF 默认由 Vite 代理到 `127.0.0.1:8097`。Backend 模式禁止失败后回退 Mock。

## 实测结论

### 正常路径

候选人求职意向的完整增改查链路工作正常：

1. 初始 `GET /api/v1/me/intentions?status=active` 返回空列表。
2. 新增一条“北京市 / AI 产品经理 / 全职 / 混合 / 20–30K / Agent 与应用层”意向，POST 返回 201，随后 GET 返回 1 条、`revision=1`。
3. 再次打开编辑页时所有字段正确预填。
4. 增加上海市备选城市和远程办公，把薪资改为 21–31K。
5. PATCH 携带 `If-Match: "1"`，返回 200、`revision=2`；紧随其后的 GET 返回相同权威结果。
6. 再次打开、直接刷新编辑页，所有修改都仍在。

说明意向 DTO 映射、创建、更新、revision/ETag、权威重读和页面回显本身都正确。

### 失败路径

退出登录后，在同一浏览器重新完成短信登录：

- 网络只有登录完成、`GET /api/v1/me` 和会话列表。
- 没有 `GET /api/v1/me/resume`。
- 没有 `GET /api/v1/me/intentions?status=active`。
- 个人页错误显示 Mock 人名“沈亦舟”。
- 求职意向页显示 `0/5`，且打开该页也不触发 GET。
- 保持 cookie 直接刷新后，冷启动恢复链请求 resume 和 intentions，真实候选人资料与刚保存的 `1/5` 意向立即恢复。

这也复现并解释了此前“后端有简历，但前端我的简历为空”的问题。它不是简历页特有故障，而是交互式登录后整个角色支持域未水合。

## ISSUE-001：短信登录成功后未水合上次使用角色的数据

**优先级：P0 / High**

**归属：Frontend**

### 根因链

1. `src/状态/后端/会话操作.ts` 的 `创建会话操作().完成手机登录` 当前只做：

   - 完成 login attempt；
   - `读取主体()`；
   - 跨 subject 时清旧账号状态；
   - 写入 subject fence、递增会话代际；
   - 设置 `后端状态.已登录=true` 和 `主体`。

   它没有调用同文件已有的 `水合角色数据(...)`。

2. `水合角色数据(...)` 才是角色数据的统一入口：

   - candidate：简历、active intentions、隐私、附件简历库、Agent 规则；
   - recruiter：组织、岗位、Agent 规则；
   - `last_used_role=null`：保持身份选择，不读角色域。

3. 冷启动恢复在 `src/状态/应用状态.tsx` 中显式调用该函数；切换身份也在 `会话操作.ts` 中调用。只有交互式短信登录漏掉。

4. `src/屏幕/登录.tsx` 在 `完成手机登录` resolve 后无条件导航到身份选择；同时 `src/应用.tsx` 监听 `已登录`，又按 `last_used_role` 自动 replace 到候选或招聘主壳。两个导航所有者产生竞态。已有 candidate 角色会直接进入主壳，身份选择页无法补做角色切换水合。

5. 角色页面没有兜底读取：

   - `src/屏幕/我的简历.tsx` 直接读取全局简历切片，仅附件钩子会单独读 resume-files；
   - `src/屏幕/求职意向管理.tsx` 直接读取 `状态.求职意向表`，页面挂载不请求 intentions。

6. `src/屏幕/我的.tsx` 使用 `状态.基本信息.真名.trim() || 我的信息.姓名`。Backend 数据为空时会泄漏 Mock 人名，放大了故障并展示错误身份。

### 推荐修复结构

让“建立会话”和“角色水合”成为一个原子编排，再允许 UI 进入角色主壳：

1. `完成手机登录` 成功读到主体后，先完成现有的跨主体清理、subject fence 和 generation 更新。
2. 若 `last_used_role` 非空，调用公共 `水合角色数据(...)`，不要复制简历/意向读取逻辑。
3. 该登录场景建议复用 cold-start 的非交互失败策略：各支持域独立提交，非 401 失败提示但不回退 Mock；任一 401 走统一 `清账号状态` 并保持未登录。
4. 只有水合结算且会话未失效后才设置 `已登录=true` 与主体，避免根路由在空状态时抢先跳主壳。
5. Backend 登录后的路由只保留一个所有者。推荐删除 `登录.tsx` 中 Backend 分支的无条件 `跳转(路径.选身份)`，由 `应用.tsx` 根据已水合主体的 `last_used_role` 统一决定 candidate/recruiter/identity 落点。Mock 分支行为不变。
6. Backend 页面不得使用 Mock PII 兜底。`我的.tsx` 在 Backend 资料尚未可用时显示中性占位或加载态；Mock 模式才允许 `我的信息.姓名`。

不要用“在我的简历页和求职意向页各加一次 GET”作为主要修复。那会掩盖登录编排缺口、造成重复请求，并让隐私、附件、规则、招聘方组织/岗位仍然缺失。

### 必须先写的回归测试

#### Provider / 会话操作

在 `src/状态/后端/会话操作.test.ts` 或 `src/状态/应用状态.test.ts` 增加：

1. **已有 candidate 角色交互登录**

   - 初始无恢复会话；
   - 完成手机登录后 `读取主体()` 返回 `last_used_role='candidate'`；
   - 断言简历、意向、隐私、附件和候选规则读取各执行一次；
   - 断言 `已登录=true` 时页面切片已包含水合结果；
   - 断言 intentions 不是 Backend 空种子。

2. **已有 recruiter 角色交互登录**

   - 断言完整招聘方水合链执行；
   - 防止只修 candidate 分支。

3. **无上次角色**

   - `last_used_role=null` 时不读任何角色域；
   - 最终允许进入身份选择页。

4. **水合 401**

   - 不落 `已登录=true`；
   - 主体、简历、意向、附件、规则和目录缓存按现有统一清理口径归零。

5. **非 401 的单域失败**

   - 成功的兄弟域仍提交；
   - 不出现 Mock 数据；
   - 登录操作不会被误报为验证码失败。

6. **同 subject 重登与跨 subject 登录**

   - 保持现有 generation、stale response fence 和跨账号清理断言；
   - 新水合不得让旧账号迟到响应覆盖当前账号。

#### 导航

更新 `src/屏幕/登录.test.tsx`，并按需要为 `src/应用.tsx` 新建测试：

- Backend 登录页等待操作完成，但不再自己无条件跳 identity。
- 根路由在候选水合结束后只跳一次 candidate 主壳。
- recruiter 和 `last_used_role=null` 的落点正确。
- 操作失败或会话失效时保持登录页。

#### Mock 隔离

为 `src/屏幕/我的.tsx` 增加组件测试：

- Backend 空资料不显示 Mock 人名“沈亦舟”。
- Mock 模式仍保留原型兜底。

### ISSUE-001 验收标准

- [ ] 已有 candidate 账号从无登录态完成短信登录后，无需刷新即可看到权威姓名、教育、简历和 active intentions。
- [ ] 网络中登录完成、`GET /me` 后会出现角色水合请求；每个资源不重复读取。
- [ ] 已有 1 条意向的账号首次进入意向页直接显示 `1/5`，不是 `0/5`。
- [ ] Backend 任意未水合状态不显示 Mock 人名或 Mock 角色数据。
- [ ] recruiter 交互登录同样完成其角色域水合。
- [ ] `last_used_role=null` 仍进入身份选择，不提前读取角色域。
- [ ] 401、跨账号、同账号重登、StrictMode 和 stale response 现有保护不回归。
- [ ] 刷新后的结果与交互登录后的结果一致。

## ISSUE-002：薪资 listbox 不支持键盘和直接点选

**优先级：P2 / Medium**

**归属：Frontend accessibility / interaction**

### 复现

1. 打开 `/#/intentions/:id`，点击“薪资要求”。
2. 聚焦“薪资下限”列，按 ArrowDown，选中值不变。
3. 直接点击一个非当前 option，目标值不会直接成为选中项。
4. 通过触摸、滚轮或连续逐档移动仍可选择并保存，说明写入链无故障。

### 根因

`src/组件/薪资区间层.tsx` 复用 `src/组件/内嵌双滚轮.tsx`。后者只通过 `onScroll` 停止 90ms 后计算值：

- listbox 没有 `tabIndex`；
- 没有 `onKeyDown`；
- 没有 `aria-activedescendant` 或 roving focus；
- option 没有 `onClick`；
- 现有 `aria-selected` 只是被动反映 scroll 后的 React state。

### 推荐实现

保持当前视觉滚轮和触摸 scroll-snap，不改薪资数据模型：

1. 让每列 listbox 可聚焦。
2. 支持 ArrowUp/ArrowDown、Home/End；可选支持 PageUp/PageDown。
3. 键盘变更时同步 state 和 `scrollTop`，并避免 onScroll 防抖重复回写。
4. option 点击时直接选择该值并滚到中心，不依赖浏览器把被点击元素滚进视口的副作用。
5. 用稳定 option id + `aria-activedescendant`，或完整实现 roving `tabIndex`；两者选其一，不要半套混用。
6. 到达 3/100 边界时夹紧，不循环；上下限最终归一规则保持现状。

`数字滚轮层.tsx` 和 `年月滚轮层.tsx` 使用相似模式。至少审计并抽取共享的可访问滚轮行为，避免只修薪资后留下三个不同实现；但不要顺手改变无关页面外观或数据范围。

### 必须先写的回归测试

新建 `src/组件/内嵌双滚轮.test.tsx`，并按需增加 `薪资区间层.test.tsx`：

- ArrowDown/ArrowUp 改变对应列的 `aria-selected`。
- Home/End 到达边界。
- 点击 option 直接选中目标值。
- 左右列互不影响。
- “确定”把当前两列值交给回调；上限低于下限时仍按现有规则抬到下限。
- 触摸/scroll 现有路径仍通过。
- 弹层重新打开时从已保存值定位。

### ISSUE-002 验收标准

- [ ] 两列可通过 Tab 聚焦。
- [ ] 键盘、鼠标直接点选和触摸滚动三种输入都能选择准确值。
- [ ] `aria-selected` 与视觉高亮、提交值始终一致。
- [ ] 20–30K 修改保存后，重新打开和刷新仍正确预填。

## 明确不应修改的后端行为

- `GET /api/v1/me/intentions?status=active` 是 active 意向的权威来源。
- 创建返回 201；更新使用 `If-Match` 与 revision/ETag；成功后前端重读权威列表。
- 已验证 `revision=1` 更新为 `revision=2`，备选城市、办公方式和薪资全部持久化。
- 不要新增本地意向缓存来绕过 GET，不要取消 `If-Match`，不要在失败时播种 Mock 意向。

## 实施顺序

1. 先写 ISSUE-001 的 Provider/会话回归，让当前实现明确失败。
2. 修复交互登录水合与单一导航所有权。
3. 补 Backend PII/Mock 兜底隔离测试与修复。
4. 跑会话、登录、应用状态、简历和意向 focused tests。
5. 再为滚轮写键盘/点击失败测试并实现 ISSUE-002。
6. 跑全量静态检查和构建。
7. 用真实 backend/local 再走一次“退出登录 → 短信登录 → 我的简历 → 求职意向 → 编辑保存 → 退出重登”闭环。

## 验证命令

```bash
npm test -- src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts src/屏幕/登录.test.tsx src/屏幕/添加意向.test.tsx src/屏幕/我的简历.test.tsx src/数据/HTTP招聘数据源.test.ts
npm test -- src/组件/内嵌双滚轮.test.tsx src/组件/薪资区间层.test.tsx
npm run typecheck
npm run lint
npm run build
```

若其中一个新增测试文件尚未创建，先按上文创建再运行，不要从命令中永久删掉。

## 浏览器回归的网络断言

交互登录已有 candidate 后，至少断言：

```text
POST /api/v1/auth/login-attempts/:id/complete  200
GET  /api/v1/me                                 200
GET  /api/v1/me/resume                          200
GET  /api/v1/me/intentions?status=active        200
```

其余候选支持域按当前公共水合合同执行。进入 `/#/intentions` 时应已能从 state 渲染，不需要页面挂载后再补一次 intentions GET。保存修改时继续断言 PATCH 带当前 revision 对应的 `If-Match`，随后权威 GET 与页面一致。

## 本次调查已运行的基线测试

以下现有测试在未修复代码上全部通过，说明测试缺口确实存在：

```text
src/状态/后端/会话操作.test.ts
src/屏幕/登录.test.tsx
src/屏幕/添加意向.test.tsx
src/数据/HTTP招聘数据源.test.ts

4 files passed, 77 tests passed
```

不要把这组绿色基线当作问题不存在；它们没有覆盖“无恢复会话挂载 → 交互短信登录已有角色 → 角色支持域必须在导航前水合”的组合路径，也没有覆盖滚轮键盘/option 点击语义。
