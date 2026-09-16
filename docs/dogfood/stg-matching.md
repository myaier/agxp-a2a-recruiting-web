# STG 双向匹配 Suite（stg-matching）

Suite `stg-matching` 在真实 STG 后端上验收**双向匹配**的 S0–S3 主路径：两个独立 Case
（`stg-matching-recruiter` 招聘者发起 / `stg-matching-candidate` 求职者发起），
每 Case 一轮一个全新 run（新账号、新组织、新岗位、新意向、新 PDF 版本），不能共用。

- 状态：本文只固化材料、准入与运行骨架。**两个 Case 现阶段均为 `NOT_RUN`；S0–S3
  的真实入口、人工待办分界与阶段细节尚待 Task 4 探索固化，本文不预填任何通过**。
- 2026-09-17 两项 controller 裁定已应用于材料并经在线 validate 证实（见第 2、11 节）：
  经历行业重冻为活目录叶子 `开发者工具`；项目事实以文字并入经历 description。
- 权威设计：`docs/superpowers/specs/2026-09-17-baseline-stg-matching-design.md`。
- 权威环境：后端 checkout 的 `.claude/skills/agxp-recruitment-e2e-env/SKILL.md`、
  `.claude/skills/agxp-recruitment-stg-env/SKILL.md` 与
  `apps/recruitment/README.md`「双向匹配 dogfood」节；现场 CLI 输出是真相，本文件
  不是版本真相源。
- 入口注册与报告：[真实后端行为验收](真实后端行为验收.md)与
  [真实后端报告模板](真实后端报告模板.md)；证据落既有 `dogfood-output/<run-id>/`。

## 1. 目的与范围

- 验收内容：专用合成材料（双角色完整 onboarding + 结构化匹配资料 + 合成 PDF）在
  真实 STG 上的双向匹配 S0–S3：匿名初筛 → 递交简历 → 需要协调 → 意向确认 → 完成
  与会话就绪（不发送消息）。
- 每轮、每 Case 都用全新 run；同一 run 不承载两个 Case，也不当第二轮复用。
- 非目标：旧 B02 Suite 的替换/解析全分支、模型输出逐字断言、匹配分或固定秒数、
  discovery 可选功能（见第 8 节禁用清单）。

## 2. 材料与合成基线（固定值，字节不变使用）

合成材料均为虚构数据，无真实个人信息。两份专用材料：

| 文件 | 用途 |
| --- | --- |
| [fixtures/stg-matching-happy.yaml](fixtures/stg-matching-happy.yaml) | 双角色完整结构化资料（scene `ephemeral-baseline`，双方 `complete_onboarding`/`set_role_preference` 均 true），字段合同同后端 `case.schema.json`（不复制入本仓库） |
| [fixtures/stg-matching-resume.pdf](fixtures/stg-matching-resume.pdf) | 与 YAML 完全一致的单页中文真实文本层合成简历（candidate 上传用） |

固定值（summary / description / requirements / PDF 全一致）：

| 字段组 | 固定合成值 |
| --- | --- |
| 候选 | 林知行；在职；工作起始年 2020 |
| 学历 | 清华大学 · 计算机科学与技术 · 本科 · 2016-09 至 2020-06 |
| 经历 | 测试工程师 · 开发者工具（活目录叶子，企业服务 / SaaS 根下；2026-09-17 裁定重冻，原冻结值见第 11 节）· 2020-07 至今；不写公司名，组织引用由 operator 替换 |
| 经历/项目事实 | 持续负责 Python/pytest 自动化、HTTP API 测试与 SQL 数据校验；项目「接口自动化回归」担任测试工程师，成果为建立接口回归并验证数据库一致性（以文字并入经历 description）；无量化成绩 |
| 意向 | 社招全职 · 测试工程师 · 北京市；备选城市/行业为空；仅混合办公；20-25K/月 · 13 薪；四项排除（大小周/外包/纯现场/频繁出差）均 excluded |
| PDF 事实 | 北京混合办公、20-25K/月13薪、双休、非外包、无需频繁出差、非纯现场、两周内到岗；无电话/邮箱/真实证件；雇主栏省略 |
| 招聘者/组织 | 周明远 · 招聘负责人；组织为合法占位结构，brand_name 云极测试；真实 run 名由 operator 替换 |
| 岗位 | 测试工程师（接口自动化）；社招全职直招 · 测试工程师 · 北京市；办公地 北京市海淀区中关村软件园（合成测试地址）；混合办公；20-25K · 13 薪；经验五年以上；学历本科 |
| JD 与四问 | Python/pytest/HTTP API/SQL 与经历逐项吻合；本科且五年以上；双休、非外包、无需频繁出差、非纯现场、可两周到岗；岗位四问均 not_required；structured_requirements_confirmed=true |

- 生成与核对记录（2026-09-17）：PDF 由一次性脚本以 CoreText 逐行绘制生成（工具为
  临时代码，留在忽略目录 `test-results/baseline-stg-matching/task3-scratch/`，不入库、
  不构成通用生成器）；核对方式为 macOS PDFKit 全文提取（本机无 poppler，沿用
  stg-onboarding Suite 的原生命名核对法）+ sips 渲染 PNG 视觉核对：单页、全部合成
  事实齐全、无缺字/裁切/孤字。选择逐行 CoreText 的原因：headless Chrome
  `--print-to-pdf`（stg-onboarding 先例工具）在本机把逐字形子集字体写碎，
  PDFKit 提取时出现「SQL → S/Q/L 交错」与个别字形顶出容器的伪影。
- **经历下的 `projects` 键必须省略**（2026-09-17 在线 validate 实测：部署侧
  ExperienceWrite 合同拒绝内嵌 projects，报 `must_be_omitted`；本仓库
  `case.schema.json` 允许该键属后端 schema 与部署校验器的已知不一致，裁定按在线
  权威执行）。项目事实以上表文字形式存在于经历 description 与 PDF。
- 材料可用不等于 Case 可跑：可运行性受第 3 节准入与部署前置约束。

## 3. 生命周期与 operator 命令（每轮现场核验）

每轮概念顺序（从后端 checkout 根执行；`AGXP_MONOREPO_DIR` 指向用户提供的后端
checkout，前端不得修改后端）：

```bash
# 0) 前端根固定材料路径（后端命令按绝对路径读取，不复制配置进后端仓库）
MATCHING_CONFIG="$(realpath docs/dogfood/fixtures/stg-matching-happy.yaml)"

cd "$AGXP_MONOREPO_DIR"

# 1) 准入三项（缺一即 rc75 BLOCKED，不进浏览器）
tools/dev-env.sh exec -- apps/recruitment/scripts/stg-env.sh preflight
#   必须 result: OK，且 matching cleanup: recruitment=1 server=1 ok
tools/dev-env.sh exec -- apps/recruitment/scripts/stg-env.sh status

# 2) 离线 + 在线 validate（在线须目录唯一解析、fingerprint 不变）
tools/dev-env.sh exec -- apps/recruitment/scripts/stg-env.sh validate --config "$MATCHING_CONFIG" --offline
tools/dev-env.sh exec -- apps/recruitment/scripts/stg-env.sh validate --config "$MATCHING_CONFIG"
#   在线输出逐行 resolved: <path> -> <id> (<kind>)，result: OK

# 3) 每次新 run（run id 全新且唯一，建议 front-match-<UTC 时间戳>-<随机后缀>）
RUN_ID=front-match-$(date -u '+%Y%m%dT%H%M%S')
tools/dev-env.sh exec -- apps/recruitment/scripts/stg-env.sh prepare --run-id "$RUN_ID" --config "$MATCHING_CONFIG"
tools/dev-env.sh exec -- apps/recruitment/scripts/stg-env.sh verify  --run-id "$RUN_ID"

# 4) 两端浏览器旅程（第 6/7 节；一个 Case 占用整个 run）
#    前端本地起服务，两个角色各用独立具名 agent-browser 会话

# 5) finally（无论业务成败/超时/中断，同一 run）
tools/dev-env.sh exec -- apps/recruitment/scripts/stg-env.sh cleanup --run-id "$RUN_ID"
tools/dev-env.sh exec -- apps/recruitment/scripts/stg-env.sh status
```

- 直接调用 `stg-env.sh` 缺本机 jsonschema 时必须用后端既有
  `tools/dev-env.sh exec --` 包装：不安装临时依赖、不启动本地后端、不改变
  contract fingerprint（2026-09-17 实测同包装下 fingerprint 为
  `10763fe5e816c9a3443677ff6015e9e06c14b2c0c635a339b33e331e28a1e282`）。
- `prepare` 成功输出 `phase: READY` 与回执路径；登录材料位于后端 checkout 的
  `.agxp-recruitment-stg-env/sessions/<run-id>/login.json`（两个合成号码，0600）。
  4 位验证码沿既有受限离线通道取得（第 5 节）。
- 退出码语义：`0` 成功 / `75` BLOCKED（外部前置缺失、占用冲突、部署漂移）/
  `1` FAIL / `2` 参数或配置非法。占用/proof/恢复边界以后端 skill 为准，不换 run
  抢占、不清理 foreign run。

## 4. 前端启动与代理

```bash
VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=stg \
  npm run dev -- --host localhost --port 5173 --strictPort
```

浏览器固定访问 `http://localhost:5173`。复用已有服务前核对实际环境变量、代理目标
与 owner；5173 被他人占用时不杀进程、不换 Origin，协调不了记 `BLOCKED`。保存启动
输出与 `/api/v1` 请求证据，确认代理上游为 `https://recruitment-stg.agxp.ai`；代理
必须服务端注入 BFF 公网 Origin（`__Host-` Secure cookie 的成立性是前端责任）。
local 栈、route fixture 或仅见页面都不算 STG 证据。

## 5. 安全登录与凭据输入通道

原则：手机号与验证码不进 shell argv、聊天、报告、日志、截图或录像；公开证据只记
「受限通道对通过/失败」结论。

- 两个角色各用独立具名会话（如 `agent-browser session id --scope worktree --prefix
  "stg-matching-candidate"` 与 `...-recruiter`），全程不混用。
- **安全输入做法（agent-browser 0.35.2 已实测）**：
  1. 受限本地进程（Python 等）读取 `login.json` 取得本角色合成号码；验证码由
     operator 经既有受限离线通道交给同一进程内存，不落文件。
  2. 该进程构造 batch JSON 命令数组（`["fill", "<ref>", "<值>"]`），经 **subprocess
     stdin** 传给具名会话的 `agent-browser --session <name> batch --bail`；值不进
     shell argv。
  3. **已核对回显行为（2026-09-17，非秘密假值）**：`fill` 命令自身输出仅
     `✓ Done`，不回显所填值；但**之后的 `snapshot` 会显示输入框当前值**。因此
     凭据在字段里的整个窗口期禁止 snapshot、screenshot、trace 与 stream，提交并
     离开登录页后才恢复取证。
  4. 失败时：隔离原始输出（不展示、不粘贴），按脱敏摘要报告并停止该 Case
     （BLOCKED），不得改用明文 argv 或人工念码绕行。
  5. 无安全通道可用（工具不支持 stdin batch 等）即记 `BLOCKED`，不继续。
- 报告不写手机号、验证码、Cookie、Authorization、proof 或完整认证状态；只引用
  receipt / login 路径与允许公开的安全实体 ID。

## 6. Case stg-matching-recruiter（招聘者发起）

**流程细节待 Task 4 探索固化**，当前仅锁定骨架：

1. 新 run（第 3 节）+ 招聘者会话 UI 登录（第 5 节）。
2. 在本轮岗位的真实候选推荐入口找到本轮候选（允许刷新推荐；找不到则在预算内
   观察并调查，不委托其他 STG 用户）。
3. 按当前界面发起委托；不能复制候选端的 PDF 确认步骤假装两端相同。
4. 候选端会话完成附件确认/递交等待办（按本人真实待办）。
5. 跟踪同一真实委托/Case 的安全 ID 与角色归属；S0–S3 各节点证据与共同断言见
   第 8 节；刷新后不重复发起。

## 7. Case stg-matching-candidate（求职者发起）

**流程细节待 Task 4 探索固化**，当前仅锁定骨架：

1. 新 run（第 3 节，不复用上一 Case 的 run）+ 候选会话 UI 登录（第 5 节）。
2. 从真实职位入口找到本轮岗位 `测试工程师（接口自动化）`。
3. 选择本轮 `stg-matching-resume.pdf` 的**准确版本**并确认披露；不得以最新附件
   替代 Case 原版本。
4. 发起委托；观察受理、连续记录与真实开案（不得将有回执等同 Case 已创建）。
5. S0–S3 各节点证据与共同断言见第 8 节。

## 8. S0–S3 共同观察点（待 Task 4 以真实运行固化断言粒度）

| 节点 | 必需证据（方向无关） |
| --- | --- |
| 数据与附件就绪 | 双方建档落正确角色；JD/意向/简历符合第 2 节矩阵；PDF 真实上传解析且准确版本可选择 |
| 发起与开案 | 真实写入、持久委托回执、真实 Case；刷新/导航恢复同一记录、无重复委托 |
| S0 匿名初筛 | 双端阶段状态、允许展示的 Agent 问答/总结、真实通过事实；不人工补写答案 |
| S1 递交简历 | 准确绑定本轮 PDF 版本的披露与查看；自动推进则观察，需本人操作则执行 |
| S2 需要协调 | 仅用固定材料事实作答；无差异自动完成则以阶段历史证明经过；材料未覆盖的新问题如实记录，不临场编造 |
| S3 意向确认 | 双方各自阅读当前总结并明确确认；一方确认不冒称双方完成；版本变化重新阅读 |
| 完成与会话 | 双端刷新仍显示同一 Case 完成、本人待办消失；移交就绪后打开正确真人会话，双方可达，**不发送任何消息** |

业务断言只针对事实、阶段归属、版本、持久性、权限与操作效果；不断言模型完整文本、
固定问答轮数、匹配分或固定秒数。

## 9. 只走主路径（cleanup 阻断清单）

下列操作不在 S0–S3 主路径内，且会让本 run 停在 `CLEANUP_BLOCKED`（详见后端
README「双向匹配 dogfood」节）：discovery 卡片的不感兴趣/收藏/拒绝；岗位/候选人
订阅；Agent 规则界面或把 Case 指令保存为规则；求职端助手聊天；数据导出；反馈与
举报。刷新推荐可以（本 run 自己的推荐批次在 purge 时删除）。

## 10. cleanup 判读与成功标准

- `hub_task/work_not_terminal`：同一次 cleanup 内 60 秒总预算、10 秒间隔重试；
  耗尽 `CLEANUP_BLOCKED`，用**同一 run 同一条** cleanup 命令重试；绝不 reset、
  强制解锁或手工 SQL。
- 已知阻断边界：Hub 任务未知/404、foreign/共享引用、会话里已有消息。
- **本 Suite 成功只认**：rc0 + `CLEANED` + `residuals=[]` + 合法 `retained`（固定
  `{kind,count,reason}` 类别、三方 inspect 对账一致）+ 占用释放 + 原 Cookie 重放
  401 + 无未收敛工作。`CLEANED_WITH_RESIDUAL` 不算成功。
- 业务 verdict、cleanup verdict、基础设施准入三列分记，互不合并。
- 跨轮隔离（两轮验证时）：第二轮 owner 列表无旧资料、旧组织公开读不可见、旧
  Cookie 被拒、旧 Case/附件/会话 ID 按不可见合同拒绝。

## 11. 能力缺口与依赖（诚实清单）

- **行业目录（2026-09-17 已按裁定收敛）**：Plan 原冻结值 `软件与信息技术服务业`
  源自 schema example，不在 STG 活目录（后端 checkout
  `apps/recruitment/internal/catalog/data/industries.csv.gz`，部署同源；活目录为
  六根树——金融科技、互联网平台、企业服务/SaaS、云计算/基础软件、AI/大模型、
  智能硬件/制造，仅叶子可选，GB/T 名亦无）。经 controller 裁定重冻为活目录叶子
  `开发者工具`（`tax_sclwtqpzwuv2qmiyz2dcjjr74q`），在线 validate 已回执唯一解析；
  证据链（unresolved 报错、探针、目录树清单）见 Task 3 报告。
- **`projects` 载体**：部署侧 validate 拒绝 config 内嵌 projects（`must_be_omitted`），
  与本仓库 `case.schema.json` 的 projects 定义及后端 scene 的嵌套创建代码
  （`stg_fixture_scene.py` 逐条创建路径在当前部署校验下不可达）不一致；裁定按
  在线权威省略该键、事实走 description 文字。**后端侧矛盾保留本记录供向后端方
  报告，不在前端仓库修**。
- 在线 validate 的能力前提是 fixture 管理面与部署健康；`preflight` 三项准入任一
  缺失即 BLOCKED，不引用旧 PASS。
- 正式 L3、B02 附件全分支、H01–H04 其余场景不在本 Suite 范围；本 Suite 两个 Case
  的浏览器 PASS 证据未产生前，不写任何已通过。
