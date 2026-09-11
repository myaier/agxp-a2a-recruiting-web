# Backend + Local Onboarding Dogfood Case

- Case ID：`DOGFOOD-ONBOARDING-BACKEND-LOCAL`
- 覆盖角色：候选人、招聘方
- 自动化工具：可见 Chrome + CDP + `agent-browser`
- 数据源：`backend/local`
- 性质：人工监督或 Agent 独立执行的探索式回归，不替代 Playwright/Vitest/后端 hermetic Case

## 1. 目的

用两个全新测试账号，从登录开始分别走完候选人和招聘方 onboarding，并在完成后检查页面回显、刷新/重登录恢复和服务端权威数据。发现问题时立即留下可复现证据，走查结束后再做代码归因；走查过程中不阅读前端或后端源码。

本用例刻意覆盖以下真实边界：

- 手机 OTP 登录、角色激活和 `last_used_role`；
- PDF 上传及解析/预填体验；
- 候选人在线简历与首次求职意向；
- 招聘方名片、公司声明、首个岗位；
- 空资源、异步状态、字段校验、错误文案和刷新恢复；
- 页面事实与 `/api/v1` 权威只读结果是否一致。

范围区分：本文只管**全新账号注册走查**和存量账号接线巡检。基于 fixture 基准账号的
九类业务行为验收（候选/招聘 CRUD、双会话隔离、Hosted 场景）走
[真实后端行为验收](真实后端行为验收.md)，两者互不替代。

## 2. 三层保存结构

### 第一层：可提交的测试例

本文只保存可重复步骤、断言和安全规则。不得写入测试手机号、验证码、Cookie、request ID、真实姓名/邮箱、原始材料文件名或任何机器绝对路径。

### 第二层：不可提交的单次证据

每次执行使用：

```text
dogfood-output/<role>-onboarding-<YYYY-MM-DD>-<run-id>/
  report.md
  screenshots/
  videos/
  network/
  chrome-profile/
```

`dogfood-output/` 已由 `.gitignore` 忽略。这里可以短期保存截图、视频、HAR、Chrome profile 和完整报告，但它们可能含个人信息或认证材料，不得提交、粘贴到公开 issue 或直接发送给第三方。

### 第三层：可提交的脱敏运行摘要

需要长期保留某次结论时，在 `docs/runs/` 新建：

```text
<YYYY-MM-DD>-backend-local-onboarding-dogfood.md
```

只记录代码基线、环境、执行范围、PASS/FAIL、问题编号和修复/handoff 链接。不得依赖第二层文件才能理解结论。

## 3. 前置条件

1. Recruitment backend local 测试栈已健康启动。
2. 前端依赖已安装，工作区没有被其他 Agent 共用的 dev server 或浏览器 session。
3. 每个角色准备一个从未完成该角色 onboarding 的测试账号。手机号和 OTP 只在执行时由用户或安全测试配置提供。
4. 准备两份合成 PDF：
   - 候选简历 fixture：含姓名、教育、工作、技能、证书等明确基线；
   - JD fixture：含公司、岗位、用工类型、办公模式、职责和候选要求。
5. 材料必须是虚构数据。确需使用真实材料时，只放在仓库外，并在运行摘要中写“外部测试材料”，不记录路径和内容中的个人联系方式。

执行前读取当前安装版本匹配的工具说明：

```bash
agent-browser --version
agent-browser skills get core --full
agent-browser skills get dogfood
```

本文编写时验证过 `agent-browser 0.35.2`；未来执行以本机 `skills get` 输出为准，不把本文当 CLI 版本真相源。

## 4. 启动 backend/local 前端

```bash
VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local npm run dev
```

记录 Vite 实际输出的 URL。默认示例为：

```text
http://localhost:5173
```

先用浏览器确认页面能打开。不要在 backend 模式失败时切到 Mock 继续并声称通过。

## 5. 通过 CDP 启动可见 Chrome

为每次运行使用独立 Chrome profile，避免污染日常浏览器或继承旧账号状态。下面是 macOS 示例；其他系统用等价 Chrome 启动命令。

```bash
export RUN_ID="$(date +%Y%m%d-%H%M%S)"
export ROLE="candidate"
export OUTPUT_DIR="dogfood-output/${ROLE}-onboarding-${RUN_ID}"
export CDP_PORT="9222"
export TARGET_URL="http://localhost:5173"
export SESSION="$(agent-browser session id --scope worktree --prefix "dogfood-${ROLE}")"
mkdir -p "$OUTPUT_DIR/screenshots" "$OUTPUT_DIR/videos" "$OUTPUT_DIR/network" "$OUTPUT_DIR/chrome-profile"

open -na "Google Chrome" --args \
  --remote-debugging-port="$CDP_PORT" \
  --user-data-dir="$PWD/$OUTPUT_DIR/chrome-profile" \
  --new-window about:blank
```

连接 CDP 并把 session 固定到自己的 tab：

```bash
agent-browser --session "$SESSION" --cdp "$CDP_PORT" --pin-tab open "$TARGET_URL"
agent-browser --session "$SESSION" --cdp "$CDP_PORT" set viewport 402 874
agent-browser --session "$SESSION" --cdp "$CDP_PORT" wait --load networkidle
agent-browser --session "$SESSION" --cdp "$CDP_PORT" screenshot --annotate "$OUTPUT_DIR/screenshots/initial.png"
agent-browser --session "$SESSION" --cdp "$CDP_PORT" snapshot -i
```

如果同机并行跑两个角色，必须使用不同 `CDP_PORT`、`SESSION`、`OUTPUT_DIR` 和 Chrome profile。不要让两个 Agent 连接同一 Chrome tab。

## 6. 固定操作纪律

### 6.1 Snapshot/ref 循环

每次页面跳转、弹层打开、异步列表更新或表单提交后都重新：

```bash
agent-browser --session "$SESSION" --cdp "$CDP_PORT" wait --load networkidle
agent-browser --session "$SESSION" --cdp "$CDP_PORT" snapshot -i
```

页面变化后旧的 `@eN` 已失效，不得继续使用。优先顺序为：最新 snapshot ref → role/label/text 定位 → CSS 兜底。

### 6.2 等待与节奏

- 正常走查不加固定 sleep；模型调用之间的自然耗时足够观察。
- 同一条 shell 命令内连续操作，或录制给人看的复现视频时，动作间隔约 1 秒。
- 业务等待优先使用目标文字、URL 或 `networkidle`，裸时间等待只用于模型处理观察和复现视频。
- 异步解析不能只等待一次固定时长；观察页面状态直到成功、失败或明确超时，并记录状态迁移。

### 6.3 只从用户路径产生写入

- 所有 profile、resume、intention 和 job mutation 必须由正常 UI 操作产生。
- 不用 `eval fetch()`、curl、数据库或管理接口补写缺失数据来“完成”流程。
- 走查结束后的 `eval fetch()` 只能发 GET，用于权威回读。
- 遇到 blocker 时先记录；可以通过重新登录、返回上一步或正常导航继续探索，但必须说明绕行，不得隐藏原 blocker。

### 6.4 每个关键页面固定检查

```bash
agent-browser --session "$SESSION" --cdp "$CDP_PORT" snapshot -i
agent-browser --session "$SESSION" --cdp "$CDP_PORT" errors
agent-browser --session "$SESSION" --cdp "$CDP_PORT" console
agent-browser --session "$SESSION" --cdp "$CDP_PORT" network requests
```

可疑页面再截图，不需要为每个正常点击保存图片。静态问题使用一张 annotated screenshot；交互/时序问题确认可复现后再录视频。

### 6.5 取证

交互问题：

```bash
agent-browser --session "$SESSION" --cdp "$CDP_PORT" record start "$OUTPUT_DIR/videos/issue-NNN-repro.webm"
# 动作前截图；同一命令连续操作时约间隔 1 秒
agent-browser --session "$SESSION" --cdp "$CDP_PORT" screenshot "$OUTPUT_DIR/screenshots/issue-NNN-step-1.png"
agent-browser --session "$SESSION" --cdp "$CDP_PORT" screenshot --annotate "$OUTPUT_DIR/screenshots/issue-NNN-result.png"
agent-browser --session "$SESSION" --cdp "$CDP_PORT" record stop
```

HAR 只在网络时序或请求体是问题核心时录制：

```bash
agent-browser --session "$SESSION" --cdp "$CDP_PORT" network har start
# 复现问题
agent-browser --session "$SESSION" --cdp "$CDP_PORT" network har stop "$OUTPUT_DIR/network/issue-NNN.har"
```

HAR 可能包含 Cookie、认证 header 和响应正文，只能留在第二层。长期摘要只写 method、path、status 和脱敏后的关键字段结论。

### 6.6 报告

初始化时复制 agent-browser 自带模板：

```bash
export DOGFOOD_SKILL_DIR="$(agent-browser skills path dogfood)"
cp "$DOGFOOD_SKILL_DIR/templates/dogfood-report-template.md" "$OUTPUT_DIR/report.md"
```

每确认一个问题立即写入 `report.md`，不要等走查结束再回忆。Issue 至少包含：severity、页面、前置状态、复现步骤、期望、实际、是否稳定复现、网络摘要和证据相对路径。

## 7. Fixture 基线

### 7.1 候选简历

执行前从 fixture 提取并在临时报告写一份脱敏基线：

- 姓名或合成别名；
- 最高学历、学校、专业；
- 工作起始年和 1～3 条经历；
- 至少一个技能；
- 至少一个证书，明确是否有年份；
- 不记录手机号、邮箱、证件号或地址原文。

### 7.2 JD

脱敏基线至少包含：

- 公司显示名；
- 岗位名和用工类型；
- 现场/混合/远程；
- 职位描述；
- 职位要求；
- JD 没写的薪资、城市、学历等字段列为“需人工补充”。

自动预填只能与这份基线比较。模型没有证据的字段不得因为“看起来合理”判为正确。

## 8. Case CAND-ONB-001：候选人 onboarding

### 输入约束

- 使用全新候选测试账号。
- 覆盖四个分支（J-PILOT-02 起）：**社招手填（no-PDF）**、**学生手填（no-PDF）**、**社招 + PDF**、**学生 + PDF**。手填分支不上传 PDF（上传横幅保持「确认后开始识别」占位，不得假称已识别）；PDF 分支上传候选简历 fixture。
- **完成门槛（2026-09-11 起）**：至少一条完整教育（含毕业时间）才可完成。工作经历、技能、证书、Summary、头像、PDF 均可选——**零工作经历也必须能走完整个旅程**。旧断言「在线简历只保留 1 条经历、1 个技能、1 个证书」已废除，不得再把「恰好 1 经历/技能/证书」当完成门槛或成功标准。
- 学生分支选「在校 + 实习生」：实习月数、每周到岗天数为必选，尾段向导是实习日薪（元/天）。
- 简历之外的字段使用固定合成值，不临场随机，以便复跑对比。

### 已知 PM_BLOCKED 控件（如实记录，禁止统计为 PASS）

- 排除题「屏蔽公司」的「再加一家」只有自由文本、无真实组织结果选择；一键屏蔽与手输均被阻止并提示「无法确认具体公司，请先明确选择要屏蔽的公司」。已实现并可验收的是权威回显、解除（仅 `manual` 来源可单击直解，其余来源拒绝执行并以轻提示指向既有入口）、拒绝假成功。**屏蔽新增不计 PASS**。
- 向导城市题所用共享滚动区不暴露 onScroll/ref：该题只有默认首页 + 真实搜索，无增量加载（记录缺口，不算缺陷通过项）。

### 步骤与断言

| # | 操作 | 页面/网络断言 |
| --- | --- | --- |
| C1 | 打开登录页 | 手机号、协议、验证码流程可访问；console/page error 为空 |
| C2 | 输入执行时提供的测试手机号和 OTP | 登录成功；密码/OTP 不写入报告或截图标题 |
| C3 | 选择“我要找工作” | candidate role 激活并进入候选 onboarding，不停在身份页 |
| C4 | （仅 PDF 分支）上传 PDF 并明确同意模型处理 | 文件名/大小/解析状态可见；上传失败有可理解错误和重试路径 |
| C5 | （仅 PDF 分支）检查解析/预填 | 只按 fixture 基线判定；缺失、错误或无预填均记录，不自行脑补；预填不覆盖用户已手改字段 |
| C6 | 填写基本信息 | 姓名、身份、学历/工作起始年等可完成；前后导航不静默覆盖已填值 |
| C7 | 填至少 1 条完整教育；经历/技能/证书按剧本（手填分支可为零） | 保存按钮可达且不被浮层遮挡；本地校验能定位到具体字段；零工作经历时保存仍推进到下一屏 |
| C8 | 填期望职位、城市、薪资、到岗等 | 返回上一页再进入时值仍在；目录项必须实际选中而非只输入文字；Backend 定位缺失态显示「暂未获取定位」且不可点，不假选上海 |
| C9 | 完成披露说明和首次意向 | 进入候选主壳；正常路径产生 resume/intention mutations；首次意向恰好一次 POST、一个 id |
| C10 | 打开“我的简历”“求职意向”“个人信息” | 至少 1 条完整教育、至少 1 条 active intention 回显；经历/技能/证书按实际填写回显（零项合法、不显示占位数据）；手机号显示服务端掩码 |
| C11 | 刷新当前页面 | 已保存内容仍在；不回身份选择或空白 onboarding；未完成的在途编辑（如教育编辑层半填字段）恢复原题不丢失 |
| C12 | 退出并重新登录 | 权威资料仍在；路由进入已完成候选体验 |

### 候选人权威只读回查

在同一登录 session 中执行以下 GET 汇总。不要输出正文或联系方式：

```bash
agent-browser --session "$SESSION" --cdp "$CDP_PORT" eval --stdin <<'EOF'
const get = async (path) => {
  const response = await fetch(path, { credentials: 'include' });
  let body = null;
  try { body = await response.json(); } catch {}
  return { status: response.status, result: body?.result ?? null };
};
const [me, resume, intentions, files, credentials, account, privacy] = await Promise.all([
  get('/api/v1/me'),
  get('/api/v1/me/resume'),
  get('/api/v1/me/intentions?status=active'),
  get('/api/v1/me/resume-files'),
  get('/api/v1/me/credentials'),
  get('/api/v1/me/account-profile'),
  get('/api/v1/me/privacy'),
]);
({
  me: { status: me.status, role: me.result?.last_used_role ?? null },
  resume: {
    status: resume.status,
    profilePresent: Boolean(resume.result?.profile),
    portfolioUrl: resume.result?.profile?.portfolio_url ?? null,
    completeEducations: resume.result?.educations?.filter(e => e.institution?.id && e.degree && e.major?.id && e.start_month && e.end_month)?.length ?? null,
    experiences: resume.result?.experiences?.length ?? null,
    skills: resume.result?.skills?.length ?? null,
    certificates: resume.result?.certificates?.length ?? null,
  },
  intentions: { status: intentions.status, count: intentions.result?.intentions?.length ?? null, ids: intentions.result?.intentions?.map(i => i.intention_id) ?? [] },
  resumeFiles: {
    status: files.status,
    count: files.result?.items?.length ?? null,
    parseStatuses: files.result?.items?.map(item => item.current_version?.parse?.status ?? null) ?? [],
  },
  credentials: {
    status: credentials.status,
    phoneOtpCount: credentials.result?.credentials?.filter(item => item.provider === 'phone_otp').length ?? null,
  },
  account: {
    status: account.status,
    avatarPresent: account.result?.avatar_url !== null && account.result?.avatar_url !== undefined,
    revision: account.result?.revision ?? null,
  },
  privacy: {
    status: privacy.status,
    revision: privacy.result?.revision ?? null,
    organizationBlocks: privacy.result?.organization_blocks?.length ?? null,
  },
});
EOF
```

成功标准：HTTP 状态均为预期 200；role 为 candidate；resume 至少 1 条**完整**教育（institution/degree/major/起止齐全）；experiences/skills/certificates 与实际填写一致（手填分支为 0 合法，不得出现占位数据）；active intention 至少 1 且 intention_id 与本次旅程产生的 id 一致（下一步用 exact ID 复读）；凭证存在。解析失败不能被写成上传失败，两者分开裁定。

### 完成门槛与恢复/隔离只读回查（J-PILOT-02 起）

完成后在同一登录 session 内继续以下**只读**核对（全部走 GET 与既有 UI 路径，不补写业务数据）：

1. **exact intention**：用上面记下的本次 intention_id 直接 `GET /api/v1/me/intentions/{id}`，只读回一条且内容与页面一致——「列表非空」从不冒充本次成功。
2. **URL 三态**：本次旅程未编辑作品集链接 → 权威 `portfolio_url` 保持原值（本轮无写入）；编辑并保存过 → 与最终输入一致；清空过 → null。刷新后输入框回显与权威值一致。
3. **privacy**：屏蔽名单页（`/#/blocklist`）只显示权威 `organization_blocks` 的回显；「再加一家」走 PM_BLOCKED 分支记录，不计 PASS。
4. **头像**：未选头像的分支完成后 `account-profile.avatar_url` 为 null；上传过的分支 avatar 在场。头像结果未知的恢复（重选同一张图按原 key 重放 / 明确放弃）只按页面事实记录，不推定成功。
5. **刷新/重登/换角色隔离**：任一候选 onboarding 页刷新回原题（题序与在途编辑不丢）；退出重登直达已完成体验；同一浏览器切到招聘方再看回候选，不出现上一账号草稿或资料串扰。

### 可见 Chrome 视觉检查（390×844 主视口 + 320 窄屏）

本 Case 的两个手填分支各做一轮，固定视口 390×844 与 320×844（locale zh-CN / Asia/Shanghai），逐屏截图留证：

- **定位缺失态**：Backend 城市选择页「当前定位」为已批准的缺失态（「暂未获取定位」、不可点），不得假选上海或渲染 Mock 定位。
- **真实长名称**：学校/专业/职位搜索用真实目录里可得到的最长名称候选，检查候选行、已选 chip 与返回栏标题不溢出、不遮挡。
- **滚动/返回**：教育四连页、在线简历屏、向导各题在 320 宽下滚动到底/返回上一屏，布局结构不变（真实数据导致的自然换行如实记录，不算布局缺陷，也不得以此解释新增结构）。
- **Mock 基线无布局 diff**：候选 onboarding 共享屏（完善资料、选工作城市、毕业院校等）与 Mock 同名屏使用同一布局组件——用相同展示数据在 Mock 与 Backend 两模式各取一份（`e2e/J-PILOT-02接线.spec.ts` 的布局骨架对比已在拦截边界固化；真实 Backend 侧在此用页面观察复核），出现两套布局即为 FAIL。发现原型自身布局缺陷时取证交 PM，不自行改 CSS。
- **真实 Backend 单独验可用性**：以上视觉项必须在真实 Backend（非 route fixture）上执行；fixture 侧通过只能证明拦截边界行为，不能抵扣本项。
- **PM_BLOCKED 控件**：本节截图会覆盖「屏蔽公司」卡与城市题——按上文 PM_BLOCKED 记录，禁止统计为 PASS。

### 真实 PDF 链路结论的记录口径（J-PILOT-02 收尾事实）

- 2026-09-11 本轮执行环境：本地 BFF 未监听、stg 401、测试账号 OTP 源刻意不在仓库——**真实 PDF / provider 链路结论保持 BLOCKED**，未观察到 `parser_invalid_output` 故不记 FAIL。Playwright route fixture 的 PDF/解析用例 PASS 只证明拦截边界，不能抵扣真实链路证据。
- 固定「扫描 862 个岗位」的初始化表达整改**本轮明确延期**，不算测试通过也不算新发现缺陷。

### Highlights 只读检查（J-PILOT-02）

只读、零写入；无合法招聘场景时整分支记 BLOCKED，不为验证创建岗位或 Case：

- **候选侧**：候选 onboarding 全程与「我的简历」页无任何新增 Highlights 标签；本人页面不出现需要招聘方确认的来源标签。
- **招聘侧（有既有合法场景才执行）**：既有 reader/projection 的 stable 标签与其来源的 exact file/version/parse 元组一致；Summary 不作为标签来源。
- **禁止事项**：不发送任何 Highlights 候选编辑 PUT；不创建岗位/Case/会话来制造验证条件。
- **判定**：观察到真实 `parser_invalid_output` 明确记 FAIL，依赖它的后续步骤记 BLOCKED；缺合法招聘场景记 BLOCKED 并写明缺口，不记 NOT_RUN 充数。

## 9. Case EMP-ONB-001：招聘方 onboarding

### 输入约束

- 使用另一个全新 recruiter 测试账号。
- 上传 JD fixture；如果当前版本没有导入入口，立即记问题，然后用正常手填路径继续。
- 只创建 1 条岗位。
- JD 之外使用固定合成值，例如招聘人姓名、职务、薪资、城市和学历要求。

### 步骤与断言

| # | 操作 | 页面/网络断言 |
| --- | --- | --- |
| E1 | 打开登录页并完成 OTP | 登录成功；测试凭证不进入长期报告 |
| E2 | 选择“我要招人” | recruiter role 激活；新账号 profile 缺失时进入资料创建，不显示裸 404 |
| E3 | 填招聘名片：姓名、职务、公司 | 点击保存不依赖公司输入先 blur；正常首写产生 profile mutation |
| E4 | 进入发布岗位 | 首次名片保存后正常衔接；刷新/返回不绕过必填资料 |
| E5 | 检查“从 JD 导入”入口 | 存在则上传并比较建议稿；不存在或失败则记录，保留手填路径 |
| E6 | 填岗位基础信息 | 类别和地点从目录真实选择；公司声明来自用户刚确认的信息 |
| E7 | 填职位描述和职位要求 | 两段均可见、可编辑、非空；不得将机器错误码直接展示给用户 |
| E8 | 填学历、薪资、工作模式等 | remote 不要求虚构实体地址；onsite/hybrid 要求具体地址 |
| E9 | 发布 1 条岗位 | JobCreate 成功；重复点击受控；成功后进入岗位/人才主体验 |
| E10 | 打开招聘名片、公司资料、设置、岗位详情、账号安全 | 名片与岗位回显；无 verified affiliation 时公司资料显示可操作空态；认证状态真实；导出文案角色正确 |
| E11 | 刷新当前页面 | profile 和岗位仍在；没有永久 loading 或回身份页 |
| E12 | 退出并重新登录 | 已有 profile 进入 recruiter 主壳；岗位列表仍含刚创建的岗位 |

### 招聘方权威只读回查

```bash
agent-browser --session "$SESSION" --cdp "$CDP_PORT" eval --stdin <<'EOF'
const get = async (path) => {
  const response = await fetch(path, { credentials: 'include' });
  let body = null;
  try { body = await response.json(); } catch {}
  return { status: response.status, result: body?.result ?? null };
};
const [me, profile, affiliations, jobs, credentials] = await Promise.all([
  get('/api/v1/me'),
  get('/api/v1/recruiter/profile'),
  get('/api/v1/recruiter/affiliations'),
  get('/api/v1/recruiter/jobs'),
  get('/api/v1/me/credentials'),
]);
({
  me: { status: me.status, role: me.result?.last_used_role ?? null },
  profile: {
    status: profile.status,
    present: profile.status === 200,
    revision: profile.result?.revision ?? null,
    hasPublicName: Boolean(profile.result?.public_name),
    hasTitle: Boolean(profile.result?.title),
  },
  affiliations: {
    status: affiliations.status,
    count: affiliations.result?.affiliations?.length ?? null,
    statuses: affiliations.result?.affiliations?.map(item => item.status) ?? [],
  },
  jobs: {
    status: jobs.status,
    count: jobs.result?.jobs?.length ?? null,
    completeBodies: jobs.result?.jobs?.map(job => ({
      hasTitle: Boolean(job.title),
      hasCompany: Boolean(job.hiring_organization_claim?.display_name),
      hasDescription: Boolean(job.description),
      hasRequirements: Boolean(job.requirements),
      workplaceMode: job.workplace_mode ?? null,
      officeLocationPresent: Boolean(job.office_location),
    })) ?? [],
  },
  credentials: {
    status: credentials.status,
    phoneOtpCount: credentials.result?.credentials?.filter(item => item.provider === 'phone_otp').length ?? null,
  },
});
EOF
```

成功标准：role 为 recruiter；profile 200 且 revision ≥ 1；jobs 至少 1，title/company/description/requirements 非空；凭证存在。Affiliations 可以为空，页面必须把它显示成未加入/未认证的诚实空态，而不是永久 loading 或“已认证”。

## 10. 已走查范围与复验路径地图

除两个首次 onboarding Case 外，2026-09-01 的 backend/local dogfood 还实际走过已有账号重登、求职意向增改查和两端“我”/设置页。下面把这些路径固化为长期回归入口；单次执行结果见 [`docs/runs/2026-09-01-backend-local-onboarding-dogfood.md`](../runs/2026-09-01-backend-local-onboarding-dogfood.md)。

URL 使用 HashRouter 完整写法；`:id` 表示本次运行从服务端响应或页面链接取得的真实资源 ID，不得硬编码历史 ID。

| Case | 角色与目的 | 页面路径 |
| --- | --- | --- |
| `CAND-ONB-001` | 全新候选人首次 onboarding | `/#/` → `/#/identity` → `/#/student` → `/#/wizard?stage=salary` → `/#/basic` 及 `/#/onboard/*` → `/#/experience` → `/#/wizard` → `/#/disclosure` → `/#/onboard/avatar` → `/#/init` → `/#/app` |
| `EMP-ONB-001` | 全新招聘方首次 onboarding | `/#/` → `/#/identity` → `/#/hr/card` → `/#/hr/post-job` → `/#/hr-init` → `/#/hr` |
| `CAND-AUTH-001` | 已有候选人交互登录后的角色水合 | `/#/settings` 退出 → `/#/` OTP 登录 → `/#/app` → `/#/resume` → `/#/intentions` → 刷新 |
| `CAND-INT-001` | 求职意向创建、查询、编辑、再查询 | `/#/intentions` → `/#/intentions/new` → `/#/intentions/cities`、`/#/intentions/industries` → `/#/intentions` → `/#/intentions/:id` → 刷新/重登 |
| `CAND-ME-001` | 候选人“我”和设置接线巡检 | `/#/app` 的“我”Tab → `/#/profile`、`/#/resume`、`/#/intentions`、`/#/rules`、`/#/settings` 及其下属页 |
| `EMP-ME-001` | 招聘方“我”和设置接线巡检 | `/#/hr` 的“我”Tab → `/#/hr/card`、`/#/hr/jobs`、`/#/hr/company-profile`、`/#/hr/settings` 及其下属页 |

路径地图只声明覆盖范围，不把 2026-09-01 的失败现象写成永久预期。修复后仍按下面的权威断言判定。

## 11. Case CAND-AUTH-001：已有候选人交互登录水合

### 前置状态

- 使用已完成 candidate onboarding 的账号；服务端至少已有 resume，可有 0～5 条 active intention。
- 先在已登录态用只读 GET 记录 resume 摘要、active intention 数量、privacy revision 和 Agent rule 数量，不记录正文或个人信息。

### 步骤与断言

| # | 操作 | 页面/网络断言 |
| --- | --- | --- |
| A1 | 从 `/#/settings` 正常退出 | 回到 `/#/`；旧账号姓名、简历和意向不再留在页面状态 |
| A2 | 在同一浏览器完成 OTP 登录 | 登录完成后读取 `/api/v1/me`；已有 `last_used_role=candidate` 时，在进入主壳前完成 candidate 支持域水合 |
| A3 | 不刷新，直接打开 `/#/resume` | 姓名、教育、经历、技能和证书与登录前权威摘要一致；不得显示 Mock 简历或全空简历 |
| A4 | 不刷新，打开 `/#/intentions` | 数量与 `GET /api/v1/me/intentions?status=active` 一致；页面不得靠挂载后的临时补读掩盖登录水合缺口 |
| A5 | 打开 `/#/rules` 和 `/#/settings` | Agent 规则、隐私和手机号凭证均有终态；不永久 loading，不回退演示数据 |
| A6 | 刷新当前页 | 刷新前后数据和落点一致；刷新不能成为“修复”交互登录空状态的必要动作 |

网络至少应包含登录完成、`GET /api/v1/me` 和当前 candidate 公共水合合同要求的 resume、intentions、privacy、附件、规则等请求。任何 401 必须清理账号态，非 401 单域失败应诚实展示且不得回退 Mock。

## 12. Case CAND-INT-001：求职意向增改查闭环

### 输入约束

- 使用已有 candidate 账号，先记录当前 active intention 数量和每条 revision。
- 新意向使用固定合成职位、城市、行业、薪资、求职类型、办公方式与到岗状态。
- 若已有 5 条 active intention，先使用专门的清理账号或按产品正常归档路径腾出名额；不得直接删数据库。

### 步骤与断言

| # | 操作 | 页面/网络断言 |
| --- | --- | --- |
| I1 | 打开 `/#/intentions` | 页面数量与 active intentions GET 一致；记录创建前数量 |
| I2 | 进入 `/#/intentions/new` | 新建态为空或只含明确产品默认值，不继承其他账号草稿 |
| I3 | 填主职位、主城市、薪资、类型、办公方式、到岗等 | 目录字段必须实际点选；薪资双滚轮支持触摸/滚动，并至少用键盘或直接点选 option 验一次 |
| I4 | 进入 `/#/intentions/cities` 和 `/#/intentions/industries` 后返回 | 次级页选择回显，主表单其他字段不丢失 |
| I5 | 保存新意向 | 发出 `POST /api/v1/me/intentions`，成功为 201；随后权威 GET 数量加一，并在临时报告记录响应 revision |
| I6 | 从列表进入 `/#/intentions/:id` | 所有字段与刚保存结果一致，尤其是薪资单位/区间、城市和行业 |
| I7 | 修改至少一个普通字段和薪资区间后保存 | 发出 PATCH，`If-Match` 使用当前 revision；成功后 revision 增加且紧随其后的 GET 返回相同结果 |
| I8 | 再次打开并直接刷新编辑页 | 修改仍在；刷新不回退旧 revision、不丢次级页字段 |
| I9 | 退出并重新登录后回到意向列表 | 无需额外刷新即可看到同一条意向及最新 revision；同时覆盖 `CAND-AUTH-001` |

若 POST/PATCH 成功但页面错误，应比较响应、随后 GET 和本地映射；若页面没有发 mutation，归为前端流程阻断，不得描述成“后端保存后丢失”。

## 13. Case CAND-ME-001：候选人“我”与设置接线巡检

使用一个服务端资源数量已知的 candidate 账号。进入每页前记录预期 GET；页面打开后检查 network、console、error，涉及 mutation 的控件必须执行一次成功路径或明确确认当前没有写合同。

| 页面 | 路径 | 主要权威检查 |
| --- | --- | --- |
| “我”首页 | `/#/app` 的“我”Tab | 在谈、初筛、待拍、归档和代理跟进数来自 P5 MatchCase/会话/历史资源；0 必须显示 0，不得继承 Mock 数组 |
| 个人信息 | `/#/profile` | 姓名来自 resume；手机号来自 P8 credential；头像、微信、邮箱没有持久化合同时不得出现“已保存”假象 |
| 我的简历 | `/#/resume` | 与 resume GET 一致；交互登录后无需刷新即可回显 |
| 求职意向 | `/#/intentions` | 与 active intentions GET 一致；必要时串行执行 `CAND-INT-001` |
| AI 代理规则库 | `/#/rules` | P6 rules/proposals 有加载终态；系统内置“先问我”偏好若无合同则只读或明确仅本次，不得假保存 |
| 设置 | `/#/settings` | 手机号、实名摘要、隐私开关均来自权威资源；逐项打开下属页 |
| 账号与安全 | `/#/account` | sessions、退出其他设备、换绑、导出、注销走 P8；导出文案符合候选角色 |
| 披露偏好 | `/#/disclosure-prefs` | GET/PATCH privacy + `If-Match`；刷新后保持；机制锁定项不可修改 |
| 屏蔽名单 | `/#/blocklist` | 只提交目录返回的稳定 organization ID；无搜索结果时有解释，不把自由文本当 ID |
| 谁接触过我 | `/#/visitors` | 有后端审计合同则显示权威列表；没有则显示诚实空态/未开放，不得显示演示公司 |
| 历史代谈 | `/#/archived` | 与 completed/ended MatchCase history 一致，0 时为空态 |
| 帮助、反馈、协议 | `/#/help`、`/#/feedback`、`/#/terms` | 静态内容可达；反馈产生真实工单号；不得泄漏另一个角色或旧账号数据 |

额外执行“对现雇主隐身”开关的一次取消和一次确认路径，确认取消不 mutation、确认成功后 revision 增加，失败时 UI 回滚或保持原权威值。

## 14. Case EMP-ME-001：招聘方“我”与设置接线巡检

使用一个 profile、affiliation、job、conversation、MatchCase 和 Agent rule 数量已知的 recruiter 账号。合法 404/空数组是必须覆盖的正式状态，不得只用资料齐全账号。

| 页面 | 路径 | 主要权威检查 |
| --- | --- | --- |
| “我”首页 | `/#/hr` 的“我”Tab | 岗位、在谈、待拍板、意向达成和代理状态来自 jobs/P5/规则资源；0 必须显示 0 |
| 招聘名片 | `/#/hr/card` | profile 200 时回显；404 时进入首次创建态，并用 PATCH + `If-Match: "0"` 首写，不新增 profile POST |
| 岗位管理 | `/#/hr/jobs` | 与 recruiter jobs GET 一致；0 岗位时其他统计不得显示演示候选数 |
| 公司资料 | `/#/hr/company-profile` | 无 active/verified affiliation 时显示可操作空态；有组织时才读取/编辑 canonical organization |
| 设置 | `/#/hr/settings` | 企业认证摘要与 `/#/hr/verify` 同源；逐项打开下属页 |
| 认证摘要 | `/#/hr/verify` | 分别展示个人验证、当前任职和管理员申请的权威状态；不把 0 affiliation 写成已认证 |
| 账号与安全 | `/#/account` | 共用 P8 能力正常，导出和注销文案符合招聘角色，不出现“导出简历” |
| AI 代理设置 | `/#/hr/agent-settings` | P6 rules/proposals 有终态；系统内置偏好没有持久化合同时不得假保存 |
| 披露策略 | `/#/hr/disclosure` | 若为产品固定机制，页面明确只读，不写“改动即时生效”；若允许编辑则必须有后端合同和刷新验证 |
| 历史代谈 | `/#/hr/archived` | 与 recruiter completed/ended history 一致，空数组不显示 Mock 归档 |
| 帮助、反馈、协议 | `/#/help`、`/#/feedback`、`/#/terms` | 共用页面可达且角色文案正确；反馈走真实接口 |

对 profile 404、0 affiliation、0 job、0 rule、0 conversation、0 MatchCase 的空账号至少完整跑一次；再用资料齐全账号抽查非空回显，避免只修空态而破坏正常态。

## 15. 横向检查

两个角色都执行：

```bash
agent-browser --session "$SESSION" --cdp "$CDP_PORT" a11y --tags wcag2a,wcag2aa --json
agent-browser --session "$SESSION" --cdp "$CDP_PORT" errors
agent-browser --session "$SESSION" --cdp "$CDP_PORT" console
```

重点观察：

- 页面允许浏览器缩放；
- 固定浮层不遮挡业务按钮；
- 焦点、label、button name 可被 snapshot 识别；
- loading 有终态，错误有可操作恢复路径；
- 中文界面不直接展示英文后端 message 或机器 reason；
- 退出、401、换账号后不显示上一账号的姓名、公司、草稿或岗位。

## 16. 结果判定

- `PASS`：主路径完成，刷新/重登录和权威回读一致，没有 blocker/high issue。
- `PASS_WITH_NOTES`：主路径完成，仅有不影响完成和持久化的 medium/low 观察。
- `FAIL`：流程无法完成、明确数据丢失、权威写入缺失/被拒、跨账号泄漏或页面谎报认证/保存状态。
- `BLOCKED`：测试栈、CDP、账号或材料前置不可用，尚未开始判断产品；必须写清 blocker，不能写成 FAIL 或 PASS。

一个角色失败不自动停止另一个角色；两条 case 独立给结论。Issue 数量不是目标，复现和权威证据优先。

## 17. 收尾

1. 更新临时 `report.md` 的 severity 计数。
2. 确认报告和截图没有把手机号、OTP 或完整联系方式写进标题/文件名。
3. 停止 HAR/录屏后再关闭 session：

```bash
agent-browser --session "$SESSION" --cdp "$CDP_PORT" record stop
agent-browser --session "$SESSION" --cdp "$CDP_PORT" network har stop "$OUTPUT_DIR/network/final.har"
agent-browser --session "$SESSION" --cdp "$CDP_PORT" close
```

只在确实启动过录屏/HAR 时执行对应 stop；未启动时忽略其错误。随后关闭本次独立 Chrome 和前端 dev server，确认 CDP/Vite 端口释放。

4. 如需长期保存，按第二节规则编写 `docs/runs/` 脱敏摘要。
5. 代码归因在 dogfood 结束后单独进行。归因文档必须自包含，不引用第二层本机证据作为唯一依据。

## 18. 维护规则

- 产品路径、字段或 API 改变时，先更新本测试例，再执行新基线。
- 已修复问题要保留其业务断言，不在本文保留过时的“应该失败”步骤。
- 确定性且稳定的断言应逐步下沉到 Vitest/Playwright；本文继续负责跨页体验、真实后端一致性和探索式观察。
- 本文不固定测试账号，不提交真实 PDF，不保存认证状态。
- 通用 agent-browser 命令和视觉巡检规则以 `docs/UI回归巡检.md` 为补充参考。
