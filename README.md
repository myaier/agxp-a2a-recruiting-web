# agxp-a2a-recruiting-web

AGXP A2A 招聘前端。产品名未定，全站暂用 AGXP。

**形态是手机 App，只是可以在浏览器里操作。** 桌面浏览器打开会看到一台 402×874 的
iPhone 在跑这个 App（带机身框、灵动岛、状态栏和 home 横条）；真手机浏览器打开则全屏铺满、
按真实安全区排版。两种形态共用同一套布局代码，靠 `--安全区上/下` 两个 CSS 变量切换。

## 产品是什么

求职者与企业各自把条件告诉自己的 AI 代理，双方代理在双盲池中匿名核对硬性条件
（城市 / 年限 / 薪资带交集布尔判定，**数值互不披露**）→ 条件互过后互递简历 →
分歧项由代理协调、拿不准的问人 → 双方确认意向后互换联系方式，转真人沟通。

**产品不做谈薪** —— 薪资谈判发生在面试之后，由双方真人完成。任何报价 / 谈薪 UI 都不要引入。

## 技术选型

按《Hybrid 推荐选型与落地方案》确定：**Capacitor + React + TypeScript**。

- **Web 层**（本仓库）：页面、组件、路由、表单、业务状态、接口调用，以及绝大多数产品逻辑
- **原生层**（Capacitor 薄壳，待接）：App 容器、权限、Keychain、安全存储、推送、
  Universal Link、相机/相册/文件、系统分享
- **Bridge**：只做能力接口，白名单 + 明确数据结构 + 版本号协商 —— 见
  [`src/原生桥/能力接口.ts`](src/原生桥/能力接口.ts)

**不引 Ionic**：保留现有设计系统，避免界面被框架默认样式绑住。

## 文档

- [docs/后端接口需求.md](docs/后端接口需求.md) — 给后端同事：全部接口契约与业务硬约束
- [docs/前端修改指南.md](docs/前端修改指南.md) — 想改前端从这里开始：文件速查表 + 发布流程

## 跑起来

```bash
npm install && npm run dev
```

浏览器打开 `http://localhost:5173`。手机上测试用局域网地址（dev server 已开 `host: true`）。

其它命令：

```bash
npm run typecheck
```

```bash
npm run build
```

```bash
npm run deploy
```

`deploy` = 构建 + 补 `.nojekyll`/`404.html` + 强推到 `gh-pages` 分支。

### 数据源

缺省不设置环境变量即使用 Mock。真实后端只用于本地 Vite dev：

```bash
VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=stg npm run dev
VITE_DATA_SOURCE=backend VITE_BACKEND_ENV=local npm run dev
```

Local BFF 必须监听 `127.0.0.1:8097`，并配置：

```dotenv
RECRUITMENT_BFF_ENV=test
RECRUITMENT_BFF_PUBLIC_ORIGIN=http://localhost:5173
```

浏览器使用 `http://localhost:5173`。前端保持 4 位验证码；目标 BFF 必须先支持 4 位 OTP。

- Backend 真实域：登录/会话/角色、目录、简历、求职意向、招聘方岗位。
- 演示域：市场发现、匹配/评价、消息、规则、AI 简报、会话和历史。
- 接口失败不回退 Mock。
- `加分关键词/实习转正` 是按后端环境+岗位 ID 保存的本浏览器附属数据；作品集/附件文件名也仅留本地，不跨设备同步。

### 环境变量与重启

`VITE_DATA_SOURCE` / `VITE_BACKEND_ENV` 在 Vite dev server 启动时读取一次。**改环境变量必须重启
Vite**（停掉 dev server 重新 `npm run dev`），`.env.local` 改了同理——Vite 不会热重载这两个变量。
缺省（不设任何变量）= `mock/stg`；只设 `VITE_BACKEND_ENV=local` 而不设 `VITE_DATA_SOURCE=backend`
仍是 Mock（不构造代理、不发 HTTP 请求）。

### 按需 Catalog

Backend 模式不预取全量目录。选择器（城市 / 学校 / 职位 / 行业 / 专业）在用户展开或搜索时
按需分页查询 `/api/v1/catalog/*`，查询返回 `{ items, nextCursor }`，按 id 去重累积；
选中的目录引用（`{ id, display_name }`）保存在草稿 / 引导预填里，写入时直接用 id，
不再保存前反查目录或全量预取。学校候选副行显示「城市 · 国家」（来自 institution 嵌套的 location）。

### 学校城市消歧

同名学校在不同城市时，候选列表用「城市 · 国家」副行区分；选中后只存 institution ID，
学校所在城市不写入 Education、不进筛选步骤、不改简历展示。

### 后端配套部署前提

- `stg`：`https://recruitment-stg.agxp.ai`，需可达 + 有效证书 + 支持 4 位 OTP。
- `local`：本地 BFF 监听 `127.0.0.1:8097`，配置 `RECRUITMENT_BFF_ENV=test` +
  `RECRUITMENT_BFF_PUBLIC_ORIGIN=http://localhost:5173`。
- 后端必须先实现已接线端点（session / auth / me / catalog / resume / intentions / jobs）。
- 演示域（市场/匹配/消息/规则/AI简报/会话/历史）未接线，Backend 模式仍用演示种子。

### Mock / Backend 本地缓存隔离

- Mock 只有一个 `demo` 账号；简历、引导答案和资料快照在 `localStorage` 中按
  `mock + 后端环境 + demo` 分仓。旧全局键会在成功迁移后删除。
- Backend 已接线的简历/意向/岗位只认服务端权威，不写浏览器持久副本。
- 头像、公司资料等尚未接服务端的字段，Backend 只保留在当前标签页的 `sessionStorage`，
  按 `backend + stg/local + subject_id` 分仓；切账号或退出后页面立即清空上一个主体的资料。
- 退出登录 / 401 清空后端目录缓存，避免下个会话复用上个会话的目录页。

### 数据源边界 E2E

```bash
npm run test:e2e:data-source                       # 全量（mock + backend 两组）
npm run test:e2e:data-source -- --grep '@mock'     # 只跑 Mock 回归
npm run test:e2e:data-source -- --grep '@backend'  # 只跑 Backend fixture
```

由 `playwright.数据源模式.config.ts` 同时启动两个不可复用的 Vite dev server
（`mock/stg` 端口 4181、`backend/stg` 端口 4182），按测试标题里的 `@mock` / `@backend`
标签分项目各跑一组用例（iPhone 13 视口、本机 Chrome）。

- **Mock 运行方式**：显式 `VITE_DATA_SOURCE=mock` server。断言招聘剧情从身份选择进
  招聘名片、公司档案分区导航与候选端静态公司页保持、图片仍是本地预览，且全程
  **零 `/api/v1` 请求**；Mock fixture 不持有 opaque Organization ID。
- **Backend 运行方式（intercepted）**：显式 `VITE_DATA_SOURCE=backend` server，
  Playwright `page.route` 拦截全部 `/api/v1/*` 用确定性 fixture 应答。它只验证前端
  在拦截边界上的行为（请求形状 / 信封解码 / 恢复路径 / 渲染来源），**不是真实 BFF
  联调**——data-source Playwright 不启动、不修改、也不验证任何真实后端服务；
  Backend dev server 的 `/api/v1` 代理目标（stg）从测试不可达，所有响应都来自 fixture。
- fixture 通过 `安装BFF路由` 扩展：P1C 覆盖招聘方档案与头像（multipart 单 `media`
  part + If-Match）、企业关系与 current 选择、公开企业直读、企业档案 CAS（409 用
  `覆盖` seam 注入 `version_conflict`）、两步媒体协议（`metadata`+`media` part 名按
  content-type boundary 检查、删除走 204）、管理员申请按屏读取、owner Jobs 创建
  （body 只带 claim，无 refs / verification status）。multipart 不用 JSON parser 解
  整体，敏感正文只在测试进程内比对。
- 基线视觉回归（`e2e/视觉回归/`，固定 16 个 scene ID）由 `playwright.视觉回归.config.ts`
  单独驱动，不为本套件增加 Backend 视觉场景；Backend 行为全部由数据源模式 Playwright 验证。

确定性 fixture 通过后，还需按上面命令对可达的真实 `stg`（以及本地 BFF 可用时的 `local`）
完成一次真实登录 / 资源读取 smoke。若目标环境或 OTP 前置未就绪，记录外部 blocker，
不能用 route fixture 冒充真实联调通过。

### 未接线演示域与前端附属字段

- 演示域（市场发现、匹配/评价、消息、规则、AI 简报、会话、历史）仍用 Mock 种子，
  Backend 模式不替换它们，也不被 Backend 失败路径污染。
- 前端附属字段（`加分关键词` / `实习转正` / 作品集链接 / 附件文件名）按后端环境 + 实体 ID
  保存在本浏览器，不跨设备同步，不进 BFF 写入 body。

## 目录结构

```
index.html                    移动 App 形态的 meta（viewport-fit=cover / 禁缩放 / 主屏全屏）
capacitor.config.ts           iOS 壳配置，接壳时用
src/样式/设计令牌.css          颜色 / 圆角 / 安全区 / 顶部渐变，改这里等于全局改版
src/样式/全局.css              重置 + App 手感（禁整页滚动、禁橡皮筋、禁点击高亮）
src/组件/设备外框.tsx          桌面画机身 / 真机全屏，两形态切换
src/组件/玻璃导航栏.tsx        底部毛玻璃悬浮胶囊
src/组件/通用.tsx              页面外壳 / 返回栏 / 主按钮 / 阶段标签 / 分歧轴 / 输入条…
src/组件/图标.tsx              内联 SVG 图标，零图片依赖
src/数据/类型.ts               领域类型，后端接入按这份契约对齐
src/数据/模拟数据.ts           演示数据（集中一处，便于清理）
src/数据/接口层.ts             API 层，屏幕只通过它拿数据
src/状态/应用状态.tsx          Context、根 reducer 与跨域编排
src/状态/初始状态.ts           Mock/Backend 种子与启动快照恢复
src/状态/资料持久化.ts         按环境/账号同步浏览器缓存
src/状态/领域/*.ts              候选、岗位、隐私、消息等域 reducer
src/状态/后端/*.ts              会话、候选/岗位写入与目录查询编排
src/路由/路径表.ts             路由表，URL 用 ASCII slug
src/原生桥/能力接口.ts         Bridge 白名单
src/屏幕/*.tsx                 各屏，文件名对应设计稿编号
```

## 屏幕对照表

设计稿：`design_handoff_duixi_app/storyboard.dc.html`（求职端约 30 屏）。本仓库已实现：

| 文件 | 设计稿编号 | 说明 |
|---|---|---|
| 登录 | R1 | 手机号进入 |
| 选身份 | R2 | 三端分流（猎头 / 企业本期不开放） |
| 工作经历 | A2 | 简历解析结果可改 |
| 引导问答 | A3a–A3g | 七题一页一问，含薪资双滚轮 |
| 披露说明 | A4 | 四阶段披露 |
| 主壳 + 在谈首页 | **A6·L** | 定稿首页，档案卡 + 四阶段状态系统 |
| 看市场 | A14 | 自己刷岗，「让AI代理去谈」 |
| 消息列表 | A16 | AI代理动态 + 真人会话 |
| 我的 | A15 | 状态入口 + 功能宫格 |
| 在谈详情 | A6·C / A6a / A6a·J | 顺利态 / 卡点态 / 职位详情 Tab，状态驱动同一模板 |
| 往来记录 | A8·B | 代理间对话流，可发叮嘱 |
| 拿不准弹层 | A24 | 介入后沉淀为规则的底部抽屉 |
| 问AI代理 | A27 | 今日简报 + 可发消息 |
| 职位详情 | A18 | 直接聊 / 让AI代理去谈 |
| 直聊会话 | A26 | 代理旁听 |
| 真人会话 | A19 | 意向确认后真人接管 |
| 求职意向管理 / 添加意向 | A20 / A21 | 多意向，每个意向独立条件集 |
| 规则库 | A10·B | 规则开关，关闭保留记录 |
| 我的简历 | A17 | 代理诊断 + 在线简历 |
| 未通过说明 | A6b | 为什么放弃这个岗 + 松一档建议 |

企业端（招人方，与求职端同构，路由前缀 `/hr`）：

| 文件 | 设计稿编号 | 说明 |
|---|---|---|
| 企业实名认证 | R8 | 人脸识别（模拟） |
| 招聘名片 | R9 | 候选人所见的你 |
| 发布岗位 | D0 / D0b / D0c | 三步：基础信息 → 职位描述 → 要求与硬性条件 |
| 企业主壳 + 企业在谈候选 | **D5·B** | 企业端定稿首页，候选卡四阶段（双盲：确认前只见代号） |
| 候选推荐 | D11 / D11·D | 人才 Tab 第二视图，「让AI代理去聊」 |
| 候选详情 | D5·C / D11·A | 谈判进度 + 在线简历（四维评估批注版）双 Tab |
| 候选未通过 | D5·D | AI代理为什么筛掉他 + 松一档 |
| 企业往来记录 | D7 | 代理间对话镜像视角，可发叮嘱 |
| 企业问AI代理 | D14 | 招聘方日报 + 人才漏斗 |
| 企业消息 / 企业真人会话 | D12 / D12·A | 意向确认后与候选人直聊 |
| 企业我的 | D13 | 公司与认证人 + 功能宫格 |
| 岗位管理 | D17 | 在招与归档，点岗切换首页视角 |
| 企业代理设置 | D16 | 授权分层 + 企业侧规则库 |

**未做**：猎头端（设计稿 R3–R5、C1–C15，已按产品决策移除入口）、深色模式（设计稿只定了浅色）。

## 四阶段状态系统

卡片阶段标签、详情页时间线节点、披露说明徽标统一走 `阶段配色`：

| 阶段 | 文字色 | tint 底 |
|---|---|---|
| 匿名初筛 | `#6f7a5c` | `#eef0e9` |
| 递交简历 | `#7fa317` | `#eef6d6` |
| 需要协调 | `#d98511` | `#fdf3e1` |
| 意向确认 | `#d92d20` | `#fdecea` |

两条交互硬规矩（来自设计稿）：

- 等你行动的卡**红描边并置顶**，带「需要你」胶囊
- **卡上不放决策按钮**，决策一律进详情页做

## 部署

GitHub Pages，源为 `gh-pages` 分支。`main` 只放源码，构建产物不进版本历史。

三个 Pages 适配点已在构建里处理，别删：

1. `vite.config.ts` 的 `base` —— Pages 挂在子路径下，不加前缀则 JS/CSS 全部 404
2. `.nojekyll` —— 关掉 Jekyll 预处理
3. `index.html` 的 `viewport-fit=cover` —— iOS Safari 的 `env(safe-area-inset-*)`
   生效前提。不加的话底部玻璃导航会贴住 home 横条，跟手机上的设计不一致

## 下一步（方案第 4 节）

- [ ] 关键链路 POC：`npx cap add ios`，在真 iPhone 上跑通启动、登录、核心列表/详情、
      表单提交、附件上传、返回手势、断网恢复
- [ ] 补齐生产能力：安全存储、权限、Deep Link、推送插件；Bridge 版本协商、统一日志、
      加载失败兜底、灰度与回滚
- [ ] 分层测试：Web 页面用 Playwright 做高频回归；每次 H5 发布跑安装态 App 核心 smoke；
      每个发布候选跑真机与 TestFlight 回归
- [ ] 清理演示数据：`src/数据/模拟数据.ts` 整体替换为真实接口（改 `接口层.ts` 一处即可）
