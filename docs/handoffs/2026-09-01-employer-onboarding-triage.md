# 可直接转发：用人侧 onboarding 问题归属与执行入口

> 本文是零上下文版本。接收者不需要访问原测试机器、原始职位材料、浏览器会话、截图、录屏或之前的聊天记录。文中的路径均为仓库相对路径。

> **状态复核（2026-09-04 18:44 +08:00）：EMP-01 至 EMP-14 均已完成。** 前端 P0、空态、错误文案与可访问性修复由 `68935537` 集成；remote 空地址与 JD import 后端能力由 `45f7323e`/`7f1200a5b` 进入发布线；JD 前端接线由 `fd3a98fb`–`ef88edff` 完成。引用提交分别已确认进入前端 `origin/main@26d80923` 与后端 `origin/release/0.2.5@21e34ff04`。下文归因矩阵保留的是问题发生时的事实，不再是待办清单。

## 仓库与运行背景

- 前端仓库：`myaier/agxp-a2a-recruiting-web`
- 后端仓库：`myaier/agxp-monorepo`
- 后端相关模块：`apps/recruitment`、`apps/recruitment-bff`
- 前端真实后端模式：

```bash
VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local npm run dev
```

前端只请求同源 `/api/v1`，Vite 在 local 环境转发到 Recruitment BFF。Backend 模式禁止失败后回退 Mock。

## 复现场景和期望岗位信息

用一个全新招聘方账号完成首次 onboarding。期望创建的岗位事实如下：

- 组织显示名：`Project Star`
- 岗位：`Product Manager`
- 全职、远程优先、尽快或滚动到岗
- 工作内容包含用户研究、产品验证、产品策略、实验、数据分析、需求和执行、GTM、发布与增长
- 候选要求包含应届或毕业年级、产品/技术/增长/分析/创业经历，以及对 AI、SaaS、工作流、开发工具或 Agent 的兴趣

实际 UI 没有职位材料上传入口，只能手填三步：基础分类、一个职位描述文本框、学历薪资和办公地址等条件。

## 可复现事实

### 1. 首次选择招聘方身份被 404 卡住

角色激活和 `last_used_role` 写入均成功。随后：

```text
GET /api/v1/recruiter/profile
→ 404 not_found
```

页面停留在身份选择页，并显示英文原始错误 `The resource does not exist.`。重新登录后却直接进入招聘方首页，跳过首次资料填写。

### 2. 招聘名片首次保存没有发出请求

在招聘名片填写姓名、职务、公司后点击保存，页面显示“网络连接失败，请稍后再试”。浏览器没有发出 profile mutation。重新打开后姓名和职务丢失；公司名只剩前端本地声明。服务端继续返回：

```text
GET /api/v1/recruiter/profile
→ 404 not_found
```

### 3. 岗位提交产生前端无法修正的 422

表单选择校园招聘、不限毕业届、产品/Product Manager、全远程、本科、18–28K × 12、上海，并填写完整职位描述。因为远程模式仍强制办公地址，只能填入“远程办公，无固定办公地点”。

提交体的关键错误字段为：

```json
{
  "hiring_organization_claim": {
    "display_name": "",
    "legal_name": null
  },
  "requirements": ""
}
```

BFF 返回：

```text
422 validation_failed
hiring_organization_claim.display_name → must_not_be_blank
requirements                           → must_not_be_blank
```

UI 没有独立的职位要求输入，且公司声明只在输入框 blur 时写入本地状态。错误又把稳定机器码 `must_not_be_blank` 直接展示给用户。

### 4. 后续资料页与权威状态不一致

- 公司档案页永久显示“正在加载企业资料”，但没有发起企业资料请求。
- 企业设置固定显示“企业实名认证 已认证”。
- 招聘方数据导出文案仍写“打包下载你的简历与协商记录”。
- 页面 viewport 禁止缩放。

最终权威回读：

```text
GET /api/v1/me                    200，active/last_used_role 都是 recruiter
GET /api/v1/me/credentials        200，存在一条已验证 phone_otp 凭证
GET /api/v1/recruiter/profile     404
GET /api/v1/recruiter/jobs        200，jobs=[]
```

因此不存在“后端保存后丢数据”：招聘方档案没有 mutation，岗位 create 被 422 拒绝。

## 代码级归因矩阵

| 编号 | 现象 | 主归属 | 已确认根因与边界 |
| --- | --- | --- | --- |
| EMP-01 | 首次身份选择被 profile 404 卡住 | 前端 | `水合招聘方组织数据` 把“新账号无 profile”当异常；404 应成为合法的 `缺失` 水合态，然后继续 affiliations/jobs 水合 |
| EMP-02 | 招聘名片首次保存零请求 | 前端 | `保存招聘方档案` 在本地 profile 为 null 时同步抛错；后端同一 PATCH 已支持 `If-Match: "0"` 首写并返回 revision 1 |
| EMP-03 | 错误显示成“网络连接失败” | 前端 | 普通 `Error('招聘方档案尚未水合')` 被通用错误文案错误归类成网络故障 |
| EMP-04 | 重登录直接跳首页 | 前端 | `应用.tsx` 只看 `last_used_role=recruiter`，没有结合 profile 水合结果；最小完成标记应是 recruiter profile 是否存在 |
| EMP-05 | 招聘名片保存后没有进入发岗 | 前端 | Backend 分支保存成功后没有导航；首次创建应进入发布岗位，已有档案编辑保存则返回/留页 |
| EMP-06 | 公司声明为空导致 422 | 前端 | 公司输入是 uncontrolled，声明只在 blur 时写状态；岗位操作稍后从状态取值，正常流程仍可能得到空字符串 |
| EMP-07 | `requirements` 为空导致 422 | 前端 | `发布岗位.tsx` 明确删除了职位要求输入，却仍映射 `requirements: ''`；后端合同明确将 description 和 requirements 分开且都必填 |
| EMP-08 | 全远程仍强制虚构实体办公地址 | 前后端 | 前端校验无条件必填；后端 `ValidateCreate/ValidateUpdate` 同样无条件要求非空。应改成 remote 可空、onsite/hybrid 必填 |
| EMP-09 | 没有上传职位材料并预填岗位的入口 | 前后端新能力 | 两个仓库都没有 recruiter-owned JD upload/parse API；现有候选简历解析有不同 owner、schema 和隐私语义，不能直接挪用 |
| EMP-10 | 公司档案永久 loading 且零请求 | 前端 | 没有 current verified affiliation 时本来就不会读公开企业；页面把“无企业关系”误当“仍在加载” |
| EMP-11 | 企业实名认证固定显示已认证 | 前端 | `企业设置.tsx` 硬编码；服务端已有个人验证状态、企业关系状态和组织状态，不能由公司名推断 |
| EMP-12 | 招聘方导出文案仍说简历 | 前端 | `账号安全.tsx` 使用候选人固定文案；接口本身不是问题 |
| EMP-13 | 表单展示 `must_not_be_blank` | 前端 | HTTP 客户端直接取 `fieldErrors[0].reason`；应由具体表单按 field path + reason 本地化 |
| EMP-14 | 禁止页面缩放 | 前端 | `index.html` 使用 `maximum-scale=1, minimum-scale=1, user-scalable=no`，违反可缩放要求 |

## 不应做的“修复”

- 不要把后端 recruiter profile GET 404 改成合成的空 profile。404 是首写 CAS 与缺失资源的现有明确语义。
- 不要新增 profile POST。现有 `PATCH /api/v1/recruiter/profile` + `If-Match: "0"` 就是首次创建协议。
- 不要删除后端 `hiring_organization_claim.display_name` 或 `requirements` 必填校验来迁就当前 UI。
- 不要让岗位 description 同时偷偷复制成 requirements。两个字段面向不同展示和筛选语义，UI 应让用户确认两段内容。
- 不要为无企业关系的用户创建合成 Organization。未认证公司声明不是 canonical Organization。
- 不要把模型生成的 Catalog ID 直接写入岗位。类别和地点 ID 必须由用户从服务端目录选择。
- 不要用本地缓存或手工插库制造“已完成”；完成标准必须是正常 UI mutation 后的权威回读。

## 推荐拆分和顺序

1. 前端 P0：EMP-01～EMP-07，先打通 profile 首写和手工发岗。
2. 前后端协同 P1：EMP-08；后端合同先允许 remote 空地址，前端随后隐藏并清空实体地址。
3. 前端 P1：EMP-10～EMP-14。
4. 独立能力 P2：EMP-09。先冻结 API 和隐私/目录边界，再分别实现后端异步导入和前端建议稿确认 UI。

## 最终验收

从全新招聘方账号开始，正常 UI 应满足：

```text
选择招聘方身份
  → profile 404 被识别为“尚未创建”
  → 招聘名片
  → PATCH /api/v1/recruiter/profile, If-Match: "0"
  → 200, revision=1
  → 发布岗位
  → POST /api/v1/recruiter/jobs 的公司 display_name、description、requirements 均非空
  → 201
  → GET /api/v1/recruiter/profile 为 200
  → GET /api/v1/recruiter/jobs 至少一条且内容与表单一致
```

刷新或重登录时：profile 缺失则回招聘名片；profile 已存在则进入招聘方首页。没有 verified affiliation 时，公司档案页显示可操作空态，不显示永久 loading；设置页不谎报已认证。

## 交付入口

- 前端 Coding Agent：直接发送 `2026-09-01-employer-onboarding-frontend-handoff.md` 全文。
- 后端 Coding Agent：直接发送 `2026-09-01-employer-onboarding-backend-handoff.md` 全文。
- 全栈 Agent：先阅读本文，再按“推荐拆分和顺序”执行；JD 导入不要与 P0 缺陷修复混成一个不可审查的大提交。
