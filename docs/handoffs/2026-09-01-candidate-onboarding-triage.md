# 可直接转发：候选人 onboarding 问题归属与执行入口

> 本文是零上下文版本。接收者不需要访问原测试机器、浏览器录屏、截图、PDF、认证状态或其他聊天记录。

> **状态复核基线：** 2026-09-05 05:37 +08:00；前端 `origin/main@280f83ef`，后端 `origin/release/0.2.5@21e34ff04`。前端主线虽已前进，但仍未新增目录别名或候选披露 contact-profile；下表 ONB-08、ONB-10 的未关闭边界不变，其余完成项继续有效。状态优先于后文原始分配与优先级。

## 系统背景

这是一个 React 19 + TypeScript + Vite 的招聘 Web App，手机 UI 运行在桌面浏览器中的 402×874 设备框内。真实后端模式通过：

```bash
VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local npm run dev
```

访问 `http://localhost:5173`，Vite 将 `/api/v1` 代理到本地 BFF。Mock 与 backend 数据严格隔离；backend 已接线的简历、意向和附件只认服务端权威，不允许失败后回退 Mock。

## 本轮测试输入

使用一个新候选账号完成首次 onboarding：上传两页中文 PDF，选择社招路径，填写姓名、性别、出生年月、工作起始年、求职状态、硕士教育、北京、产品运营、30–40K，并在在线简历中只添加：

- 1 条工作经历；
- 1 个技能；
- 1 个证书。

测试 PDF 可以正常下载和预览，结构包括个人抬头、两段教育、三段工作、技能和英语证书。本文不附原 PDF，也不包含真实手机号、邮箱或认证材料。

## 服务端与网络证据

测试结束后，同一已登录会话的权威读结果为：

```text
GET /api/v1/me/resume                    200
  profile: 姓名/性别/出生年月/工作起始年/状态均存在
  educations: 1
  experiences: 0
  skills: 0
  certificates: 0

GET /api/v1/me/intentions?status=active 200
  intentions: 0

GET /api/v1/me/resume-files             200
  文件存在、可预览
  parse.status: failed
  parse.failure_code: parser_invalid_output

GET /api/v1/me/credentials              200
  唯一 phone_otp credential 存在，并返回服务端生成的掩码 display
```

浏览器整个测试历史中，候选资料只发出过：

```text
PATCH /api/v1/me/resume/profile      200
POST  /api/v1/me/resume/educations   201
```

从未发出：

```text
PATCH /api/v1/me/resume/skills
POST  /api/v1/me/resume/experiences
POST  /api/v1/me/resume/certificates
POST  /api/v1/me/intentions
```

所以经历、技能、证书和意向不是“后端保存成功后丢失”，而是前端没有发请求。

## 归属矩阵

| 编号 | 现象 | 主归属 | 结论 | 复核状态与依据（更新至 2026-09-05 05:37 +08:00） |
| --- | --- | --- | --- | --- |
| ONB-01 | 上传 PDF 后没有自动预填在线简历 | 新产品/API 能力 | 当前批准合同明确不向浏览器返回解析正文，也不自动写在线简历；不能当现有 bug 直接修 | **已完成；旧合同结论已失效。** 后端 suggestion API `f2d7af565` + 前端预填收尾 `86125819` 均已进入对应远端主线。 |
| ONB-02 | 可预览 PDF 最终为 `parser_invalid_output` | 后端 | 上传和对象存储正常，失败发生在异步解析链路 | **旧的具体归因已失效。** `a46b82df2`/`48e292660`/`05f87254c` 已补失败分类、诊断和合成中文 PDF 矩阵；单次旧观测不能继续证明页数/中文 PDF 缺陷，也不保证任意 provider 输出必然成功。 |
| ONB-03 | 30–40K 返回起点再进入后变回面议 | 前端 | reducer 的 `启程引导` 整体替换 draft，删除已有薪资/到岗 | **已完成。** candidate onboarding 修复集成 `b174d760`，并有后续 draft cleanup `09f447f7`。 |
| ONB-04 | 刷新后 onboarding 城市、职位、薪资等丢失 | 前端 | backend onboarding draft 只在 React 内存，没有账号隔离的可恢复草稿 | **已完成。** scoped draft recovery 已随 `b174d760` 合入，后续由 `09f447f7` 收紧清理。 |
| ONB-05 | 添加经历、技能、证书后保存零请求，刷新全丢 | 前端执行阻断 + 证书合同不一致 | UI 固定产生空证书年份，写入映射又同步拒绝空年份；异常发生在任何网络调用之前 | **已完成。** 前端 preflight/nullable mapping 在 `b174d760`；后端 nullable 合同在 `6e27240ed`/`d4c656fca`。 |
| ONB-06 | 最终意向列表为 0 | 前端级联 | 简历保存失败阻断正常路由，刷新又清空 draft；历史中没有 intention POST | **已完成。** 正常 onboarding persistence closure 随 `b174d760` 合入。 |
| ONB-07 | 学校/专业只输入文字时“下一步”看似可用但不能继续 | 前端 | 按钮只检查文本非空，提交函数却额外要求目录引用 | **已完成。** Catalog selection validity 与页面回归随 `b174d760` 合入。 |
| ONB-08 | 搜“新闻与传播”无结果，搜“新闻”才出现“新闻学” | 后端目录/产品数据 | 需要目录 owner 判断是否建立别名；前端必须提供诚实空态 | **未关闭。** 本次复核未发现目录别名提交；不标已完成或失效。 |
| ONB-09 | 个人信息页手机号为空 | 前端 | 已有 `/me/credentials` 权威掩码手机号，页面未复用 | **已完成。** 权威 credential 展示由 `bcf25ba5` 落地并进入前端主线。 |
| ONB-10 | 邮箱/微信显示可编辑，但刷新不返回 | 产品/API 合同缺口 + 前端假持久化 | 页面只 dispatch 本地状态；当前没有候选披露联系方式写接口 | **部分完成。** 假持久化已退场、avatar/账号 credential 已接通；独立披露 contact-profile 仍不存在，见 2026-09-04 remainder 后端/全栈 Handoff。 |
| ONB-11 | 标注模式浮钮遮住技能“添加” | 前端 | 开发工具 z-index 90，固定落在窄视口业务操作区 | **已完成。** annotation tooling 隔离随 `b174d760` 合入。 |

## 分配方式

- 前端 Coding Agent：直接接收 `2026-09-01-candidate-onboarding-frontend-handoff.md` 全文。
- 后端 Coding Agent：直接接收 `2026-09-01-candidate-onboarding-backend-handoff.md` 全文。
- 如果只有一个全栈 Agent：先执行前端 P0，随后处理 parser；自动预填、候选联系方式和专业别名必须作为合同决策单独确认。

## 优先级

1. P0：修复证书导致的整份简历零请求保存失败。
2. P0：修复 onboarding draft 覆盖和刷新丢失，恢复最终意向创建闭环。
3. P0（后端）：定位 `parser_invalid_output`。
4. P1：选择器状态、手机号权威展示、标注浮钮遮挡。
5. 合同工作：自动预填、可编辑披露联系方式、专业别名、证书年份是否可空。

不要通过手工插库或手工 POST 意向来“修复”UI；必须从正常 onboarding 路径产生真实请求并做权威回读。
