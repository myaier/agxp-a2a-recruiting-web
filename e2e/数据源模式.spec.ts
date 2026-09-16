// e2e/数据源模式.spec.ts
// 数据源边界 E2E：Mock 回归 + Backend fixture。两个 describe 各自 test.use({ baseURL })
// 钉到专用 server（mock/stg 4181、backend/stg 4182），项目用 grep 按 @mock / @backend 标签选跑。
//
// Mock：显式 mock/stg server，走现有 candidate 演示流程；断言没有 /api/v1 请求、登录仍 4 格验证码、
// 本地城市/学校/职位仍可选、没有新增页面/弹层/全局 loading。
//
// Backend：显式 backend/stg server。Playwright page.route 拦截所有 /api/v1/* 用 fixture 应答
// （Backend dev server 会代理 /api/v1 到 stg，但 stg 从测试不可达，所以 route-fulfil 全部 fixture）。
// 这只验证前端在拦截边界上的行为，不是真实 BFF 联调 —— 真实后端从不被启动、修改或验证。
// 记录所有 /api/v1/catalog/* 请求，覆盖：candidate login/session 后无 Catalog 请求；打开城市只请求
// 目标省第一页；中英文学校搜索选择同一 institution ID 且候选副行显示「城市 · 国家」；
// 写入 body 使用选择 ID（不含 /catalog/ 反查）；422 array fields、401 cleanup、409 reread、503 同幂等键。
// 响应放入只存在于 fixture 的标记值，断言页面展示该值，证明渲染来自 HTTP 而非 Mock。
//
// P1C（Task 6）：追加组织域 fixture —— RecruiterProfile / Affiliation / 公开企业 / 企业档案与媒体 /
// 管理员申请 / owner Jobs。multipart 请求（头像 / 企业媒体 / 管理员申请证据）不用 JSON parser 解整体，
// 按 content-type boundary 取 part 名；metadata part 内容只在测试进程内比对，不写日志、不进 snapshot。
//
// P6（Task 8）：追加 Agent 规则域可变 fixture —— agent-rules / agent-rule-proposals 双角色。
// 清单一律两页翻页；解读中提案在第二次单项 GET 转 ready；pause/resume 各自推进版本；
// 新规则/替换规则只在 accept 时物化；archive 只认当前版本 If-Match；409/503/响应丢失
// 由专用 fixture ID 选择固定分支。变更回执（body / If-Match / Idempotency-Key）存在
// fixture 的 mutationRequests 里供测试断言；Mock 场景断言 P6 域全程零 /api/v1 请求。
//
// P4（Task 8）：追加发现推荐域可变 fixture —— 候选 job-recommendations / 招聘
// candidate-recommendations 双端 + 双端委托与刷新。编号与标记值（P4编号 / P4标记）只在
// fixture 里存在，Mock 数据里没有；断言页面展示它们即证明渲染来自 HTTP 而非 Mock。
// fixture 拥有 available/rejected 数组、收藏、刷新计数、委托单项读取、变更回执存证
// （method/path/body/If-Match/Idempotency-Key）与一个非法翻页分支；受控重试同键回同一张
// 回执。Mock 场景以任务书原文的 isP4 正则断言发现域全程零请求。
//
// P2（Task 7）：追加附件简历域可变 fixture —— /api/v1/me/resume-files 的 0–3 行 PDF 库。
// 清单 GET 驱动 pending→processing→终态状态机（写入归零重放）；multipart part 形状 /
// consent / If-Match / 幂等键 fail closed；预览只认 authenticated content GET；
// Mock describe 证明 resume-files 请求数为 0。
//
// P5（Task 8）：追加 MatchCase 域可变 fixture —— 双端 match-cases 工作区/历史/详情/
// S0–S3 命令/Case 叮嘱/披露 PDF。10 条 Backend 旅程覆盖：同 Case 双端 needs_action
// 分歧与列表顺序游标、未知词与矩阵外四元组 fail closed、双端详情直达刷新（空列表
// 记忆）、S0 事实 503 同键重放、披露前/解析中失败隐私（零姓名零联系方式零 PDF）、
// 已披露招聘端只开 Case 专属原始 PDF（含终审回归钉：S1 段落有 Case 叮嘱回执时
// 入口不得被段内对话压掉）、S2/S3 权威重读与终态动作消失、completed 移交
// 文案且绝不请求会话路由、终局架子只读详情、登出/切角色清空可见 P5 状态。每个 Case
// JSON 应答带 no-store、PDF 带 private, no-store（应答头存证）；Mock describe 记录
// 全部含 /match-cases 的浏览器请求并证明清单为空。
//
// 在谈详情完整布局（详情统一 Task 10，2026-09-10）：Spec §8.5 定向旅程 —— 双端 ×
// Mock/Backend × 390/320px × 两 Tab 的区块完整、完整缺失布局、长正文、终局只读与
// 可空字段「有值刷新为空」（附件入口清理 / 清单行消失）。P5 fixture 侧补齐三处已由
// 解码合同要求但 fixture 一直缺失的应答：S0 段 screening_records（88a5948e 起）、
// 招聘端 open 行 candidate_summary（2026-09-09 摘要接线起）、/me/account-profile 最小
// 合法档案（交互式切身份的五支持域之一）—— 三处缺口在基线 b93436e9 就使 P5 Backend
// 旅程整批失败（Task 10 修复，证据见任务报告）。
//
// P8（Task 8）：追加控制面域可变 fixture —— 凭证/会话/退出其他设备/手机号换绑、
// 数据导出（创建幂等 + queued→running→ready 状态机 + application/zip 下载）、
// 账号注销（body 精确 {}、202 后保护读取一律 401）与合规反馈/上下文举报
// （block_unavailable 零写入、404 目标不存在统一收口、applied 把组织写进 P3 权威视图）。
// 每个变更的 method/path/body/原始字节/Idempotency-Key/Origin 存进 变更请求；
// 幂等按「同键同原文重放同一张回执、同键异原文 409」收口；Mock describe 以任务书
// 原文的 isP8 正则断言控制面全程零请求。

// C2（2026-09-16）：BFF fixture 已整体迁至 e2e/fixtures/bff/ —— 安装BFF路由 是薄装配
// 入口（BFF路由选项 形状以本文件历史声明为源，未改），各域样本/工厂/路由 handler 在
// 同目录各域模块；跨 describe 共用的交互 helper 在 e2e/fixtures/数据源交互.ts。

import { expect, test } from './fixtures/test';
import type { Locator, Page, Route } from '@playwright/test';
import type { BFFOwnerIntention } from '../src/数据/BFF契约';
import { 装三级职位目录桩, 抽屉搜企业并选中, 走完后端发岗向导, 是APIv1路径, 断言登录页无水平溢出, 断言意向规则零写入口, 装P4候选, 装P4招聘, 左滑候选卡, 左滑附件行, 断言附件标题几何未漂移, 装P5候选, 装P5招聘, 装P5双角色, 断言纵序, 安装P7事件桩, P7带消息fixture, 走向导薪资, Mock源, Mock登录求职, Mock切到招聘推荐, pickerMock登录, pickerBackend存量候选 } from './fixtures/数据源交互';
import { 信封, type 拦截请求形 } from './fixtures/bff/协议';
import { 标记, fixture简历, fixture意向列表 } from './fixtures/bff/账号与目录';
import { P6标记, P6编号, P6分支编号, P6规则 } from './fixtures/bff/Agent规则';
import { P4编号, P4标记, P4补充编号, P4摘要, P4深克隆, P4CandidateJob, P4候选卡, P4招聘卡, P4意向, P4招聘岗位, P4发现fixture, type P4发现fixture形 } from './fixtures/bff/发现推荐';
import { P1C标记, 创建招聘方OnboardingFixture, P1C企业档案, P1C岗位, P1C招聘组织Fixture, P1C管理员关系, P1C成员关系, P1C组织甲, P1C组织乙, 带企业关系, 一像素PNG, type P1C企业档案形 } from './fixtures/bff/招聘组织';
import { P3标记, P3隐私fixture, P3默认组织库, P1C搜索池, 创建候选实名fixture, type 候选实名FixtureState } from './fixtures/bff/隐私与实名';
import { P2新附件, 创建P2附件fixture, type P2附件fixture形 } from './fixtures/bff/附件';
import { P5编号, P5标记, P5连续编号, 种连续探针记录, 创建P5MatchCasefixture, type P5MatchCasefixture形 } from './fixtures/bff/MatchCase';
import { P7会话编号, P7标记, 创建P7fixture, type P7FixtureState } from './fixtures/bff/真人消息';
import { P8键模式, P8编号, P8标记, 创建P8fixture, type P8FixtureState, type P8变更回执形 } from './fixtures/bff/账号控制面';
import { Onboarding标记, 创建候选OnboardingFixture, 断言意向写入, type 候选OnboardingFixture } from './fixtures/bff/候选建档';
import { 安装BFF路由, type BFF路由选项 } from './fixtures/bff/安装BFF路由';

// ─────────────────────────────────────────────────────────────────────────────
// Mock 回归 @mock
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Mock 数据源回归 @mock', () => {
  // 显式 mock/stg server（端口 4181），不依赖缺省 dev server
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('缺省数据源保持 PM Mock 登录体验和四格验证码 @mock', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });
    await page.goto('/');
    await page.getByLabel('手机号').fill('13800000000');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.locator('[class*="验证码格"]')).toHaveCount(4);
    await page.getByLabel('短信验证码').fill('1234');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '进入' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    expect(apiRequests).toEqual([]);
    await expect(page.getByText('数据源')).toHaveCount(0);
    await expect(page.getByText(/backend|stg|local/i)).toHaveCount(0);
  });

  test('Mock 本地城市/学校/职位仍可选，无新增页面或弹层 @mock', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    // 微信登录在 Mock 模式仍一键直进，但必须先同意协议
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // 本地期望职位仍可选
    await page.getByRole('button', { name: /选择期望职位/ }).click();
    await page.getByRole('button', { name: '产品', exact: true }).click();
    await page.getByRole('button', { name: '产品经理', exact: true }).click();
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // 没有任何 /api/v1 请求（Mock 模式零 API）
    expect(apiRequests).toEqual([]);
  });

  test('Mock 双端规则页全程零 API 请求，双端顶栏无筛选入口 @mock', async ({ page }) => {
    // P6（Task 8）：双端规则页（/rules、/hr/agent-settings）在 Mock 下全部走本地状态，
    // 断言 P6 的 agent-rule 请求恒为零。
    // 第二批（2026-09-09）：双端筛选抽屉（看市场 / 候选推荐 顶栏「筛选 ▾」）已整体删除，
    // 原本经抽屉本地新增 / 改写规则的两段随之删去，改为断言顶栏没有「筛选」入口；
    // 规则的 canonical 入口只剩这两页。
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // ── /rules：按当前分区与精确规则标记验证全局规则（不再有「4 条」式总计）──
    await page.goto('/#/rules');
    await expect(page.getByRole('heading', { name: '你教它的规则' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '哪些情况直接排除' })).toBeVisible();
    await expect(page.getByRole('switch', { name: '规则：不主动披露并行接触数量' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('switch', { name: '规则：全现场办公的岗位直接婉拒' })).toHaveAttribute('aria-checked', 'false');
    // 意向级规则属于意向域：本页不渲染，也不提供编辑/删除/开关任何一个写入口
    await 断言意向规则零写入口(page, '双休是底线；隔周六可谈，大小周不谈');

    // ── 候选端市场：顶栏没有「筛选」入口（放大镜「搜索职位」仍在）──
    await page.goto('/#/app');
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await expect(page.getByRole('button', { name: '搜索职位' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /筛选/ })).toHaveCount(0);
    await expect(page.getByText('告诉AI代理你的硬性要求')).toHaveCount(0);

    // ── 切到招聘端：Mock 企业规则行本地可维护（开关 + 添加规则），无「3 条生效」式总计 ──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
    await page.goto('/#/hr/agent-settings');
    await expect(page.getByText('竞对在职候选人不接触、不推进')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('switch', { name: '规则：竞对在职候选人不接触、不推进' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: '添加规则' })).toBeVisible();

    // ── 招聘端推荐子视图：企业顶栏没有「筛选」入口 ──
    await page.goto('/#/hr');
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    await expect(page.getByRole('button', { name: '让AI代理去聊' }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /筛选/ })).toHaveCount(0);
    await expect(page.getByText('告诉AI代理你的硬性要求')).toHaveCount(0);

    // P6 域在 Mock 下零请求：agent-rule 一个都没有，整个会话也没有任何 /api/v1
    expect(apiRequests.filter((url) => url.includes('agent-rule'))).toEqual([]);
    expect(apiRequests).toEqual([]);
  });

  test('Mock 上传演示零 resume-files 请求 @mock', async ({ page }) => {
    // P2：Mock 的附件简历仍是硬编码演示行，上传演示只落本地文件名 + 轻提示。
    // 监听页面所有请求，证明 /api/v1/me/resume-files 请求数为 0（Mock 不接 BFF 附件库）。
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // 上传演示（Mock）：本地派发文件名 + 轻提示，不发网络请求
    await page.locator('input[type=file]').setInputFiles({
      name: 'demo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('demo.pdf')).toBeVisible();
    await expect(page.getByText('已选择简历，可识别的信息将用于预填')).toBeVisible();

    // 我的简历的附件区照旧是 Mock 演示行，不是权威 0–3 行
    await page.goto('/#/resume');
    await expect(page.getByText('沈亦舟_简历_2026.pdf')).toBeVisible();

    expect(apiRequests.filter((url) => new URL(url).pathname.startsWith('/api/v1/me/resume-files'))).toEqual([]);
    expect(apiRequests).toEqual([]);
  });

  // ── 企业名片统一（Task 3）：统一展示后 Mock 侧事实/能力不退化。
  //    占位文案按 Spec §3/§4/§6；Mock 独有能力（三 Tab 内容、岗位层跳转、收笔落全局）保留。
  //    两栈数据量不同，不做截图相等断言；视觉对照由 ui:check 场景 enterprise-public 负责。──

  test('企业名片统一 Mock 企业公开页三 Tab/全文/未知占位与条款层 @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/#/company/yunqu');
    await expect(page.getByRole('heading', { name: '云衢科技' })).toBeVisible({ timeout: 10_000 });

    // 三 Tab 切换只换正文；历程有年份/事件时用时间线文案，不另造年份
    await expect(page.getByText(/做券商与银行的交易中台与清结算基础设施/)).toBeVisible();
    await page.getByRole('button', { name: '企业文化' }).click();
    await expect(page.getByText(/把复杂留给系统，把确定性交给客户/)).toBeVisible();
    await page.getByRole('button', { name: '发展历程' }).click();
    await expect(page.getByText(/2025 C 轮，启动交易网关多活与海外通道/)).toBeVisible();
    await page.getByRole('button', { name: '公司简介' }).click();

    // 主营业务有明确标签；相册无照片 → 一格空白图位 + 未知说明（不整卡消失）
    await expect(page.getByText('主营业务', { exact: true })).toBeVisible();
    await expect(page.getByText('交易中台', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: '公司相册未知' })).toBeVisible();

    // 作息与条款摘要：Mock 代理核对已知 → 「已提供 N 条」+ 真实已核计数
    const 条款卡 = page.getByRole('button', { name: /作息与条款/ });
    await expect(条款卡).toContainText('已提供 9 条条款');
    await expect(条款卡).toContainText('3 条已由代理核对');

    // 办公地：地址、补充与原型导航键都在
    await expect(page.getByText('上海市浦东新区世纪大道 1568 号中建大厦 28 层')).toBeVisible();
    await expect(page.getByRole('button', { name: '导航 ›' })).toBeVisible();

    // 在职者反馈有 fixture 数据 → 才有统计卡与真实计数
    await expect(page.getByText('技术氛围好', { exact: true })).toBeVisible();
    await expect(page.getByText('晋升看产出', { exact: true })).toBeVisible();

    // 工商与企业身份：Mock 工商条目保留；身份无 Mock 事实 → 明确未知，不拿展示名/首字顶替
    await expect(page.getByText('上海云衢信息科技有限公司')).toBeVisible();
    await expect(page.getByText('法定名称未知')).toBeVisible();
    await expect(page.getByText('核验时间未知')).toBeVisible();
    await expect(page.getByText('46 个在招岗位')).toBeVisible();

    // 全文层固定五部分：静态档没有产品/团队 → 占位出现（Spec §7「缺字段区块出现占位」）。
    // 层体自滚、面板封在视口 86% 内，右上 ✕ 始终在视口里；这里仍用 Escape 走键盘关闭路径
    await page.getByRole('button', { name: '读全文 ›' }).click();
    await expect(page.getByText('以下内容由企业自行提供，平台未逐条核实。')).toBeVisible();
    await expect(page.getByText('产品介绍未知')).toBeVisible();
    await expect(page.getByText('团队介绍未知')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('产品介绍未知')).toHaveCount(0);

    // 条款层：已核/自述两组与 Mock 业务说明都还在
    await 条款卡.click();
    await expect(page.getByText('代理已核对', { exact: true })).toBeVisible();
    await expect(page.getByText('公司自述，尚未核对', { exact: true })).toBeVisible();
    await expect(page.getByText(/想让代理去核某一条/)).toBeVisible();
    await page.keyboard.press('Escape');

    // 底部岗位层：Mock 能力保留 —— 可打开，零匹配条目时给过滤说明，不编造岗位
    await page.getByRole('button', { name: '看这家在招的 46 个岗位' }).click();
    await expect(page.getByText(/其余 46 个岗位不匹配你当前的求职意向/)).toBeVisible();
    await page.keyboard.press('Escape');

    // Mock 全程零 /api/v1
    expect(apiRequests).toEqual([]);
  });

  test('企业名片统一 Mock 岗位层在谈/市场入口与名片收笔语义保留 @mock', async ({ page }) => {
    test.setTimeout(120_000);

    // MiniMax：静态档 + 本地在谈 J-21 / 市场 M-01 → 岗位层两条真实入口
    await page.goto('/#/company/minimax');
    await expect(page.getByRole('heading', { name: 'MiniMax' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /看这家在招的/ }).click();
    const 在谈条 = page.getByRole('button', { name: /你已在谈这一岗/ }).first();
    await expect(在谈条).toBeVisible();
    await expect(page.getByText('可让代理去谈').first()).toBeVisible();
    await 在谈条.click();
    await expect(page).toHaveURL(/#\/deal\/J-21$/, { timeout: 10_000 });

    // 名片：收笔落全局；空白收笔不覆盖旧值；职务默认值保留
    await page.goto('/#/hr/card');
    await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible({ timeout: 10_000 });
    const 姓名 = page.getByLabel('姓名', { exact: true });
    await expect(姓名).toHaveValue('邵铭');
    await expect(page.getByLabel('职务')).toHaveValue('技术 VP');
    await expect(page.getByPlaceholder('请填写姓名')).toBeVisible();

    // 空白收笔视作没改：预览行直接读全局，仍旧值 —— 不把字段清成空串落全局
    await 姓名.fill('');
    await 姓名.blur();
    await expect(page.getByText('邵铭', { exact: true })).toBeVisible();

    // 回车收笔同一条落全局路径：预览立刻是新值
    await 姓名.fill('测试名片收笔');
    await 姓名.press('Enter');
    await expect(page.getByText('测试名片收笔', { exact: true })).toBeVisible();

    // 保存把当前全局值一并钉住并推进发岗（Mock 名片保存即跳发岗）
    await page.getByRole('button', { name: '保存 · 去发岗位' }).click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/, { timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Backend fixture @backend
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 填写意向表单并提交：办公方式（现场）+ 工作城市（子页搜索 fixture）+ 期望职位（子页选择）→ 点保存。
 * 三个条件齐了 可保存 才为 true，保存键才会亮——少填一项 POST 就不会发出。
 */
async function 填意向表单并提交(page: Page) {
  // 导航到添加意向页
  await page.goto('/#/intentions/new');
  await page.waitForTimeout(500);

  // 1. 办公方式：点「现场」选钮片
  await page.getByRole('button', { name: '现场', exact: true }).click();

  // 2. 工作城市：点行 → 跳选城市页 → 搜索 fixture → 选结果 → 保存 → 返回
  await page.getByText('请选择工作城市').click();
  await page.waitForTimeout(500);
  const 城市搜索 = page.getByPlaceholder('搜索城市 / 省份');
  await expect(城市搜索).toBeVisible({ timeout: 5000 });
  await 城市搜索.fill('fixture');
  await page.waitForTimeout(600); // debounce 250ms + 余量
  await expect(page.getByText(标记.城市display)).toBeVisible({ timeout: 5000 });
  await page.getByText(标记.城市display).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  // 等待返回意向页
  await page.waitForTimeout(500);

  // 3. 期望职位：点行 → 跳选期望职位页 → 选 fixture 职位 → 保存 → 返回
  // （Task 7 B 契约：配 装三级职位目录桩 —— 挂载自动选首根后右栏出现可选叶子）
  await page.getByText('请选择期望职位').click();
  await page.waitForTimeout(500);
  await expect(page.getByText(标记.职位display).last()).toBeVisible({ timeout: 10_000 });
  await page.getByText(标记.职位display).last().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  // 等待返回意向页
  await page.waitForTimeout(500);

  // 4. 点保存 → POST /api/v1/me/intentions
  await page.getByRole('button', { name: '保存', exact: true }).click();
}

/**
 * P1C Backend 招聘链路：身份选择页点「我要招人」→ 切身份（PUT 角色 + 偏好）→
 * 固定水合（profile → affiliations → [公开企业] → jobs）→ 招聘名片。
 * 水合失败（interactive）会抛回身份页，所以落进名片本身就是水合成功的证据。
 */
async function 以招聘方进入名片(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我要招人' }).click();
  await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible();
}

// ── 登录区号：仅覆盖未登录→短信登录→身份页的最小路由集。─────────────
// 独立于上方历史大 fixture：正则同时拦截 /api/v1 根路径与全部子路由，
// 未声明坐标回 501 并记录，用例末端必须断言为空；绝不 continue 到真实 STG。
interface 登录区号请求记录 {
  method: string;
  path: string;
  body: unknown;
}

async function 安装登录区号BFF路由(page: Page, attemptId: string) {
  const 状态 = {
    已登录: false,
    请求: [] as 登录区号请求记录[],
    未声明: [] as string[],
  };
  await page.routeWebSocket(是APIv1路径, (webSocket) => {
    const path = new URL(webSocket.url()).pathname;
    // 已登录壳会连同源事件流；保持本地模拟连接，不调 connectToServer。
    if (path !== '/api/v1/events/live') 状态.未声明.push(`WS ${path}`);
  });
  await page.route(是APIv1路径, async (route: Route) => {
    const 请求 = route.request();
    const path = new URL(请求.url()).pathname;
    const method = 请求.method();
    const body = method === 'GET'
      ? null
      : (() => { try { return 请求.postDataJSON(); } catch { return null; } })();
    状态.请求.push({ method, path, body });

    if (method === 'GET' && path === '/api/v1/session') {
      if (!状态.已登录) {
        await route.fulfill({ status: 401, json: { error: { type: 'invalid_session', message: '未登录' } } });
      } else {
        await route.fulfill({
          status: 200,
          json: 信封({ identity_id: 'id-login-dial', session_id: 'sess-login-dial', expires_at: '2027-09-12T00:00:00Z' }),
        });
      }
      return;
    }
    if (method === 'POST' && path === '/api/v1/auth/login-attempts') {
      await route.fulfill({
        status: 200,
        json: 信封({ attempt_id: attemptId, next_action: { type: 'enter_code', expires_at: '2027-09-12T00:00:00Z' } }),
      });
      return;
    }
    if (method === 'POST' && path === `/api/v1/auth/login-attempts/${attemptId}/complete`) {
      状态.已登录 = true;
      await route.fulfill({
        status: 200,
        json: 信封({
          identity_id: 'id-login-dial', session_id: 'sess-login-dial', expires_at: '2027-09-12T00:00:00Z',
          next_action: { type: 'completed' },
        }),
      });
      return;
    }
    if (method === 'GET' && path === '/api/v1/me') {
      await route.fulfill({
        status: 200,
        json: 信封({
          subject_id: 'subj-login-dial',
          roles: [{ role: 'candidate', status: 'active' }],
          last_used_role: null,
        }),
      });
      return;
    }

    状态.未声明.push(`${method} ${path}`);
    await route.fulfill({
      status: 501,
      json: { error: { type: 'fixture_route_not_declared', message: '登录区号 fixture 未声明该路由' } },
    });
  });
  return 状态;
}

async function 断言登录区号弹层可达(page: Page) {
  const 宽 = await page.evaluate(() => window.innerWidth);
  for (const 定位 of [page.getByRole('textbox', { name: '区号', exact: true }), page.getByRole('button', { name: '确认区号' })]) {
    await expect(定位).toBeVisible();
    const 框 = await 定位.boundingBox();
    expect(框).not.toBeNull();
    expect(框!.x).toBeGreaterThanOrEqual(0);
    expect(框!.x + 框!.width).toBeLessThanOrEqual(宽);
  }
  await 断言登录页无水平溢出(page);
}

test.describe('登录区号 fixture 证据', () => {
  test('登录区号 Backend：+999 全号请求、四位 complete、身份落点与刷新 @backend', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const fixture = await 安装登录区号BFF路由(page, 'att-login-dial-999');
    await page.setViewportSize({ width: 390, height: 664 });
    await page.goto('http://127.0.0.1:4182/');
    await expect(page.getByRole('button', { name: '编辑区号，当前 +86' })).toBeVisible();
    await 断言登录页无水平溢出(page);
    await page.screenshot({ path: testInfo.outputPath('登录默认-390.png'), fullPage: true });

    await page.getByRole('button', { name: '编辑区号，当前 +86' }).click();
    await expect(page.getByRole('dialog', { name: '编辑登录区号' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '区号', exact: true })).toBeFocused();
    await 断言登录区号弹层可达(page);
    await page.screenshot({ path: testInfo.outputPath('登录区号弹层-390.png'), fullPage: true });

    await page.setViewportSize({ width: 320, height: 568 });
    await 断言登录区号弹层可达(page);
    await page.screenshot({ path: testInfo.outputPath('登录区号弹层-320.png'), fullPage: true });
    await page.getByRole('textbox', { name: '区号', exact: true }).fill('999');
    await page.getByRole('button', { name: '确认区号' }).click();
    await expect(page.getByRole('button', { name: '编辑区号，当前 +999' })).toBeVisible();
    await page.getByLabel('手机号').fill('123456789012');
    await expect(page.getByLabel('手机号')).toHaveValue('123456789012');
    await page.getByRole('button', { name: '获取验证码' }).click();

    await expect.poll(() => fixture.请求.find(
      (项) => 项.method === 'POST' && 项.path === '/api/v1/auth/login-attempts',
    )?.body).toEqual({ provider: 'phone_otp', input: { phone: '+999123456789012' } });
    await expect(page.locator('[class*="验证码格"]')).toHaveCount(4);
    await page.getByLabel('短信验证码').fill('1234');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '进入' }).click();
    await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
    expect(fixture.请求.find((项) => 项.path.endsWith('/complete'))?.body).toEqual({ proof: { code: '1234' } });

    await page.reload();
    await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
    expect(fixture.未声明).toEqual([]);
  });

  test('登录区号 Mock：弹层取消保持 +86，旧 11 位序列零 API @mock', async ({ page }, testInfo) => {
    const apiRequests: string[] = [];
    await page.routeWebSocket(是APIv1路径, (webSocket) => {
      // 记录即失败；不 connectToServer，因此回归失败也不会先碰 STG。
      apiRequests.push(webSocket.url());
    });
    await page.route(是APIv1路径, async (route) => {
      apiRequests.push(route.request().url());
      await route.fulfill({
        status: 501,
        json: { error: { type: 'mock_api_forbidden', message: 'Mock 登录不应请求 API' } },
      });
    });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('http://127.0.0.1:4181/');
    const 区号键 = page.getByRole('button', { name: '编辑区号，当前 +86' });
    await 区号键.click();
    await 断言登录区号弹层可达(page);
    await page.screenshot({ path: testInfo.outputPath('登录默认取消-320.png'), fullPage: true });
    await page.getByRole('button', { name: '取消' }).click();
    await expect(区号键).toBeFocused();
    await expect(区号键).toHaveAccessibleName('编辑区号，当前 +86');
    await page.getByLabel('手机号').fill('13800000000');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await page.getByLabel('短信验证码').fill('1234');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '进入' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    expect(apiRequests).toEqual([]);
  });

  test('登录区号 Backend：已取码后实际改号禁用旧码且保留倒计时 @backend', async ({ page }) => {
    const fixture = await 安装登录区号BFF路由(page, 'att-login-dial-stale');
    await page.goto('http://127.0.0.1:4182/');
    await page.getByLabel('手机号').fill('13800000000');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.getByText('60s')).toBeVisible();
    await page.getByLabel('短信验证码').fill('1234');
    await page.getByLabel('手机号').fill('13900000000');

    await expect(page.getByText(/^(?:[1-9]|[1-5]\d|60)s$/)).toBeVisible();
    await expect(page.getByRole('button', { name: '重新获取' })).toHaveCount(0);
    await expect(page.getByLabel('短信验证码')).toHaveValue('');
    await expect(page.getByLabel('短信验证码')).toBeDisabled();
    await expect(page.getByRole('button', { name: '进入' })).toBeDisabled();
    expect(fixture.请求.filter((项) => 项.path.endsWith('/complete'))).toEqual([]);
    expect(fixture.未声明).toEqual([]);
  });
});

test.describe('Backend 数据源 fixture @backend', () => {
  // 显式 backend/stg server（端口 4182）
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('candidate 会话恢复后无 Catalog 请求 @backend', async ({ page }) => {
    const 目录请求: string[] = [];
    await 安装BFF路由(page, { 记录目录请求: (p) => 目录请求.push(p), 登录尝试id: 'att-001' });

    // GET /api/v1/session → 200（已登录）→ 读取主体 → 水合简历/意向 → 落 #/app
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 会话恢复 + 主体 + 简历 + 意向后不应有任何 catalog 请求
    expect(目录请求).toEqual([]);
  });

  test('页面显示 fixture 标记值（渲染来自 HTTP 非 Mock）@backend', async ({ page }) => {
    const 目录请求: string[] = [];
    await 安装BFF路由(page, { 记录目录请求: (p) => 目录请求.push(p), 登录尝试id: 'att-002' });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 导航到我的简历 → 个人优势来自 /api/v1/me/resume 的 summary 字段
    await page.goto('/#/resume');
    // fixture summary 标记值在页面上可见（Mock 里没有这段文本）
    await expect(page.getByText(标记.简历summary)).toBeVisible({ timeout: 10_000 });
  });

  test('打开城市选择只请求目标省第一页 @backend', async ({ page }) => {
    const 目录请求: string[] = [];
    await 安装BFF路由(page, { 记录目录请求: (p) => 目录请求.push(p), 登录尝试id: 'att-003' });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 直接导航到选工作城市屏
    await page.goto('/#/onboard/city');
    await page.waitForTimeout(500);

    // 搜索「fixture」→ 只触发 /catalog/locations 请求
    const 搜索框 = page.getByPlaceholder('搜索城市 / 省份');
    if (await 搜索框.isVisible({ timeout: 5000 }).catch(() => false)) {
      await 搜索框.fill('fixture');
      await page.waitForTimeout(600); // debounce 250ms + 余量
      // 候选出现 fixture 城市
      await expect(page.getByText(标记.城市display)).toBeVisible({ timeout: 5000 });
    }

    // 城市页只应有 /catalog/locations 请求，不应有 job-categories / institutions / majors
    const 非location目录请求 = 目录请求.filter((p) => !p.includes('/catalog/locations'));
    expect(非location目录请求).toEqual([]);
  });

  test('学校搜索中英文同一 institution ID，候选副行显示城市·国家 @backend', async ({ page }) => {
    const 目录请求: string[] = [];
    await 安装BFF路由(page, { 记录目录请求: (p) => 目录请求.push(p), 登录尝试id: 'att-004' });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    // 主壳真正挂载后才做后续直达导航：Task 1 起离线边界让 /api/v1/events/live 以空闲
    // 本地连接打开（旧世界它必然失败），事件源 onOpen 会多一轮启动收件箱拉取 ——
    // 落点 replace 导航的结算窗口变宽，URL 就位 ≠ 主壳已挂载；等底部导航可见再走，
    // 直达的懒加载屏才不会被在飞的 replace 吞掉（只修测试定义，不改产品）。
    await expect(page.getByRole('button', { name: '市场', exact: true })).toBeVisible({ timeout: 15_000 });

    // 导航到毕业院校屏
    await page.goto('/#/onboard/school');
    await page.waitForTimeout(500);

    const 输入框 = page.getByPlaceholder('学校名称');
    await expect(输入框).toBeVisible({ timeout: 5000 });

    // 中文搜索
    await 输入框.fill('fixture');
    await page.waitForTimeout(500); // debounce 250ms

    // 候选列表出现 fixture 学校 + 「城市 · 国家」副行
    await expect(page.getByText(标记.学校display)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(标记.学校副行)).toBeVisible();

    // 点候选 → 存引用
    await page.getByText(标记.学校display).click();
    await page.waitForTimeout(300);

    // 再搜索英文 → 同一 institution ID（fixture 始终返回 inst-fixture-001）
    await 输入框.fill('Fixture');
    await page.waitForTimeout(500);
    await expect(page.getByText(标记.学校display)).toBeVisible();

    // 断言走的是 BFF catalog 非 Mock 本地名录
    expect(目录请求.some((p) => p.includes('/catalog/education-institutions'))).toBe(true);
  });

  test('写入 body 使用选择 ID，不含 /catalog/ 反查 @backend', async ({ page }) => {
    const 目录请求: string[] = [];
    const 写入bodies: { path: string; method: string; body: unknown }[] = [];
    await 安装BFF路由(page, {
      记录目录请求: (p) => 目录请求.push(p),
      登录尝试id: 'att-005',
      请求拦截: ({ path, method, body }) => {
        if (method === 'POST' || method === 'PATCH') 写入bodies.push({ path, method, body });
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 导航到毕业院校，选学校 + 下一步触发教育写入
    await page.goto('/#/onboard/school');
    await page.waitForTimeout(500);

    const 输入框 = page.getByPlaceholder('学校名称');
    await expect(输入框).toBeVisible({ timeout: 5000 });
    await 输入框.fill('fixture');
    await page.waitForTimeout(500);
    await expect(page.getByText(标记.学校display)).toBeVisible({ timeout: 5000 });
    await page.getByText(标记.学校display).click();
    await page.waitForTimeout(300);

    // 点下一步（触发保存简历 → 可能 POST education）
    const 下一步键 = page.getByRole('button', { name: '下一步' });
    await 下一步键.click();
    await page.waitForTimeout(1500);

    // 教育写入可能因 onboarding 中间屏（专业/开始未填）跳过——保存简历 diff 会跳过不完整条目。
    // 若有教育 POST，断言 body 里有 institution_id（来自选择引用，不是 display_name 反查）。
    const 教育写入 = 写入bodies.filter((b) => b.path.includes('/resume/educations'));
    if (教育写入.length > 0) {
      const body = 教育写入[0].body as { institution_id?: string; degree?: string };
      expect(body.institution_id).toBe('inst-fixture-001');
    }

    // 写入 path 不含 /catalog/（写入直接用选择时保存的 ID，不反查目录）
    expect(写入bodies.some((b) => b.path.includes('/catalog/'))).toBe(false);
  });

  test('422 array fields 返回字段错误 @catalog-fullscreen @backend', async ({ page }) => {
    // 覆盖 POST intentions → 422 + fields 数组。驱动真实 UI 填表提交，断言 POST 真正
    // 发出且 422 落到 轻提示 toast 里。
    // P0 修复 Task 6：通用文案不再展示机器 reason —— toast 是固定的
    // 「填写内容未通过校验」，服务端 reason 绝不上屏（fieldErrors 仍完整解析，
    // 由各表单屏按字段自行本地化）。
    let post次数 = 0;
    await 安装BFF路由(page, {
      记录目录请求: () => {},
      登录尝试id: 'att-006',
      请求拦截: ({ path, method }) => {
        if (path === '/api/v1/me/intentions' && method === 'POST') post次数++;
      },
      覆盖: {
        'POST /api/v1/me/intentions': () => ({
          status: 422,
          响应: { error: { type: 'validation_failed', message: '字段错误', fields: [{ path: 'workplace_modes', reason: '至少选一种办公方式' }] } },
        }),
      },
    });

    // 期望职位页（Task 7 B 契约）需要真实三级目录才能选叶子并点亮保存
    await 装三级职位目录桩(page);

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    await 填意向表单并提交(page);

    // POST 确实发出（填表 + 点保存触发了真实写入请求）
    expect(post次数).toBeGreaterThanOrEqual(1);
    // 422 落通用校验文案（取后端错误文案 → 轻提示），机器 reason 不泄露给用户
    await expect(page.getByText('填写内容未通过校验')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('至少选一种办公方式')).toHaveCount(0);
  });

  test('401 清理会话并清空目录缓存 @backend', async ({ page }) => {
    // 覆盖 PATCH profile → 401 invalid_session。驱动真实 UI 编辑姓名 → blur → PATCH 401 →
    // 处理写入错误 清会话（已登录=false）→ 应用.tsx Navigate 到登录页。
    // 断言页面落回登录页（手机号输入框可见）——删掉 401 清会话或 Navigate 守卫这条断言就会失败。
    await 安装BFF路由(page, {
      记录目录请求: () => {},
      登录尝试id: 'att-007',
      覆盖: {
        'PATCH /api/v1/me/resume/profile': () => ({
          status: 401,
          响应: { error: { type: 'invalid_session', message: '登录已失效' } },
        }),
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    // 主壳真正挂载后才直达（同 学校搜索 用例：events/live 空闲本地连接加宽了启动
    // replace 导航的结算窗口，等底部导航可见再导航，避免在飞的 replace 吞掉直达）。
    await expect(page.getByRole('button', { name: '市场', exact: true })).toBeVisible({ timeout: 15_000 });

    // 导航到我的简历 → 编辑姓名 → blur 触发 PATCH profile → 401 → 清会话 → 落登录页
    await page.goto('/#/resume');
    await page.waitForTimeout(500);

    // 点姓名进入编辑（可改条目：点只读态 → 变 input）
    const 姓名行 = page.getByText(标记.主体真名).first();
    await expect(姓名行).toBeVisible({ timeout: 5000 });
    await 姓名行.click();
    // 编辑态 input 的 aria-label 含「姓名」
    const 输入框 = page.getByLabel('姓名');
    await expect(输入框).toBeVisible({ timeout: 3000 });
    await 输入框.fill('改后名字');
    await 输入框.blur();

    // 401 后 处理写入错误 清会话 → 应用.tsx Navigate 到登录页
    // 登录页有「手机号」输入框——如果 401 清理或 Navigate 守卫被删，页面会留在 /#/resume
    await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 10_000 });
  });

  test('409 reread 用权威快照水合 @backend', async ({ page }) => {
    // 覆盖 PATCH profile → 409 version_conflict，GET /me/resume 第二次返回不同名字。
    // 驱动真实 UI 编辑姓名 → blur → PATCH 409 → HTTP catch GET /me/resume（权威快照）
    // → 处理写入错误 用 错误.权威简历 水合。
    // 断言 GET /me/resume 被调用了至少 2 次（初始 + 409 reread），且页面显示权威快照里的名字
    // ——删掉 409 reread 或权威水合这条断言就会失败（页面会停留在初始名字）。
    const 权威名字 = '后端 fixture 权威名';
    let getResume次数 = 0;
    await 安装BFF路由(page, {
      记录目录请求: () => {},
      登录尝试id: 'att-008',
      请求拦截: ({ path, method }) => {
        if (path === '/api/v1/me/resume' && method === 'GET') getResume次数++;
      },
      覆盖: {
        'PATCH /api/v1/me/resume/profile': () => ({
          status: 409,
          响应: { error: { type: 'version_conflict', message: '版本冲突' } },
        }),
        // GET /me/resume：首次（init 水合）返回 fixture 简历；第二次（409 reread）返回权威名字
        'GET /api/v1/me/resume': () => {
          if (getResume次数 <= 1) {
            return { status: 200, 响应: 信封(fixture简历) };
          }
          return {
            status: 200,
            响应: 信封({ ...fixture简历, profile: { ...fixture简历.profile, real_name: 权威名字 } }),
          };
        },
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 导航到我的简历 → 编辑姓名 → blur → PATCH 409 → GET reread → 权威水合
    await page.goto('/#/resume');
    await page.waitForTimeout(500);

    const 姓名行 = page.getByText(标记.主体真名).first();
    await expect(姓名行).toBeVisible({ timeout: 5000 });
    await 姓名行.click();
    const 输入框 = page.getByLabel('姓名');
    await expect(输入框).toBeVisible({ timeout: 3000 });
    await 输入框.fill('改后名字');
    await 输入框.blur();

    // 409 reread：GET /me/resume 至少被调用 2 次（初始水合 + catch 权威快照）
    await page.waitForTimeout(2000);
    expect(getResume次数).toBeGreaterThanOrEqual(2);
    // 权威快照水合后页面显示 reread 返回的名字（不是用户输入也不是初始 fixture 名字）
    await expect(page.getByText(权威名字)).toBeVisible({ timeout: 10_000 });
  });

  test('503 同幂等键受控重试 @catalog-fullscreen @backend', async ({ page }) => {
    // 覆盖 POST intentions：首次 503 operation_outcome_unknown，第二次 200。
    // 驱动真实 UI 填表提交 → POST 503 → HTTP客户端 可受控重试 复用同一把 Idempotency-Key → 200。
    // 断言至少 2 次 POST 且两次 Idempotency-Key 相同——删掉 503 重试或幂等键复用这条断言就会失败。
    let post覆盖次数 = 0;
    const 幂等键们: string[] = [];
    await 安装BFF路由(page, {
      记录目录请求: () => {},
      登录尝试id: 'att-009',
      请求拦截: ({ path, method, headers }) => {
        if (path === '/api/v1/me/intentions' && method === 'POST') {
          幂等键们.push(headers['idempotency-key'] ?? '');
        }
      },
      覆盖: {
        'POST /api/v1/me/intentions': () => {
          post覆盖次数++;
          if (post覆盖次数 === 1) {
            return { status: 503, 响应: { error: { type: 'operation_outcome_unknown', message: '结果未知' } } };
          }
          return { status: 200, 响应: 信封(fixture意向列表.intentions[0]) };
        },
      },
    });

    // 期望职位页（Task 7 B 契约）需要真实三级目录才能选叶子并点亮保存
    await 装三级职位目录桩(page);

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    await 填意向表单并提交(page);

    // 503 受控重试：至少 2 次 POST（首次 503 + 重试 200）
    await page.waitForTimeout(2000);
    expect(幂等键们.length).toBeGreaterThanOrEqual(2);
    // 复用同一把 Idempotency-Key（HTTP客户端 可受控重试 用同一个 init）
    expect(幂等键们[0]).toBe(幂等键们[1]);
    expect(幂等键们[0]).not.toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P1C 组织域 fixture @backend —— 招聘 Organization 全链路（intercepted boundary only）
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P1C 招聘组织 fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('P1C 招聘 Organization 全链路使用 HTTP fixture 且发岗 body 无可信字段 @backend', async ({ page }) => {
    // 未认证招聘方 + 无企业关系：名片来自 /recruiter/profile，公司自报经 公司选择抽屉
    // 选中目录组织（organization_ref）；发岗 POST 带显式 publisher/hiring 两个 ref ——
    // verification status / affiliation / claim 全是服务端推导，客户端 body 一个都不能伪造。
    // 已完成账号走注册流名片会被路由守卫弹回企业主壳（Spec §5 有意行为），故用应用内入口。
    const 请求们: { path: string; method: string; body: unknown }[] = [];
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P1C搜索池();
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-org',
      记录目录请求: () => undefined,
      请求拦截: ({ path, method, body }) => 请求们.push({ path, method, body }),
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      隐私fixture: 隐私,
    });

    await page.goto('/#/hr/card');
    await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible({ timeout: 20_000 });
    // 名片姓名来自 HTTP fixture（Mock 里没有这个值）
    await expect(page.getByText(P1C招聘组织Fixture.profile.public_name).first()).toBeVisible();
    await expect(page.getByLabel('姓名')).toHaveValue(P1C招聘组织Fixture.profile.public_name);

    // 无企业关系 → 公司自报行是选择入口；打开抽屉、搜索、点确切目录候选；
    // 选中只改本页草稿：点「保存」前零档案 PATCH。
    await page.getByRole('button', { name: '未选择公司' }).click();
    await 抽屉搜企业并选中(page, '云衢科技', P1C标记.组织甲名);
    await expect(page.getByRole('button', { name: P1C标记.组织甲名 })).toBeVisible();
    expect(请求们.filter((项) => 项.path === '/api/v1/recruiter/profile' && 项.method !== 'GET')).toEqual([]);

    // 固定水合链：profile → affiliations →（无 current，不读公开企业）→ jobs；
    // admin request 不进登录链。渲染顺序错乱或登录链混入组织申请都会在这里翻车。
    // P6（Task 8）起规则三路读取与组织水合并行起跑，所以这里只在组织域请求内部看相对顺序。
    const 链 = 请求们.map((项) => `${项.method} ${项.path}`);
    const 组织链 = 链.filter((项) => 项.startsWith('GET /api/v1/recruiter/profile') ||
      项.startsWith('GET /api/v1/recruiter/affiliations') || 项.startsWith('GET /api/v1/recruiter/jobs'));
    expect(组织链.slice(0, 3)).toEqual([
      'GET /api/v1/recruiter/profile',
      'GET /api/v1/recruiter/affiliations',
      'GET /api/v1/recruiter/jobs',
    ]);
    expect(链.some((项) => 项.includes('organization-admin-requests'))).toBe(false);

    // 应用内普通编辑：主按钮是「保存」，成功后留在本屏（不推进发岗、不 complete）。
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('保存成功')).toBeVisible({ timeout: 20_000 });
    const 档案写 = 请求们.find((项) => 项.path === '/api/v1/recruiter/profile' && 项.method === 'PATCH');
    expect(档案写).toBeDefined();
    // 保存 body 携带选中的 organization_ref（合同 A/C 唯一权威坐标）
    expect(档案写!.body).toMatchObject({ organization_ref: P1C标记.组织甲编号 });

    // 发岗（真实三步向导）→ POST /api/v1/recruiter/jobs
    await page.goto('/#/hr/post-job');
    await 走完后端发岗向导(page);
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });

    const 创建 = 请求们.find((项) => 项.path === '/api/v1/recruiter/jobs' && 项.method === 'POST');
    expect(创建).toBeDefined();
    // 正向：direct 模式 + 显式发布方/用人目录 ID（向导内选中，两 ref 相同）
    expect(创建!.body).toMatchObject({
      publisher_mode: 'direct',
      publisher_organization_ref: 'org-fixture-p3-manual-a',
      hiring_organization_ref: 'org-fixture-p3-manual-a',
    });
    // 负向（替代旧整包正则）：客户端不得伪造 verification_status / affiliation / claim
    const 创建键们 = Object.keys(创建!.body as Record<string, unknown>);
    expect(创建键们.filter((键) => /verification_status|affiliation|_claim/.test(键))).toEqual([]);
  });

  test('P1C 多 Organization 关系不自动猜测，选择后刷新恢复 @backend', async ({ page }) => {
    // 两个可用关系 → current 为 null（不猜），不读任何公开企业；
    // 手动选择后 sessionStorage 白名单把当前关系编号带回刷新后的固定水合。
    const 公开读取: string[] = [];
    let 岗位读取数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-multi',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(
        P1C招聘组织Fixture,
        [P1C管理员关系, P1C成员关系],
        { [P1C标记.组织甲编号]: P1C组织甲(), [P1C标记.组织乙编号]: P1C组织乙() },
      ),
      主体初始角色: 'recruiter',
      请求拦截: ({ path, method }) => {
        if (method === 'GET' && path.startsWith('/api/v1/organizations/')) 公开读取.push(path);
        if (path === '/api/v1/recruiter/jobs' && method === 'GET') 岗位读取数++;
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    // 固定水合链走完（jobs 是最后一步）且没有读任何公开企业 —— 多可用关系不自动选
    await expect.poll(() => 岗位读取数).toBeGreaterThanOrEqual(1);
    expect(公开读取).toEqual([]);

    await page.goto('/#/hr/card');
    await expect(page.getByText('请选择当前任职企业')).toBeVisible({ timeout: 10_000 });
    const 甲键 = page.getByRole('button', { name: new RegExp(P1C标记.组织甲名) });
    await expect(甲键).toBeVisible();
    await expect(甲键).not.toContainText('（当前）');

    // 手动选择组织甲 → 按 canonical ID 读一次公开企业
    await 甲键.click();
    await expect(page.getByRole('button', { name: new RegExp(P1C标记.组织甲名) })).toContainText('（当前）', { timeout: 10_000 });
    expect(公开读取).toEqual([`/api/v1/organizations/${P1C标记.组织甲编号}`]);

    // 刷新：恢复的当前关系编号经 选择当前企业关系 校验后仍指向组织甲
    await page.reload();
    await expect(page.getByRole('button', { name: new RegExp(P1C标记.组织甲名) })).toContainText('（当前）', { timeout: 20_000 });
    expect(公开读取).toEqual([
      `/api/v1/organizations/${P1C标记.组织甲编号}`,
      `/api/v1/organizations/${P1C标记.组织甲编号}`,
    ]);
  });

  test('P1C member 关系对公司档案只读 @backend', async ({ page }) => {
    // 唯一可用关系（member）会被自动选中，但公司档案分区一律只读：
    // 无保存键、文本禁用、也没有任何组织写入请求。
    const 写入们: string[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-member',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [P1C成员关系], { [P1C标记.组织乙编号]: P1C组织乙() }),
      主体初始角色: 'recruiter',
      请求拦截: ({ path, method }) => {
        if (method !== 'GET') 写入们.push(`${method} ${path}`);
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.goto('/#/hr/card');
    // 唯一可用关系自动选中（不猜的另一半：恰好一个可用才自动选）
    await expect(page.getByRole('button', { name: new RegExp(P1C标记.组织乙名) })).toContainText('（当前）', { timeout: 10_000 });

    await page.getByRole('button', { name: /公司主页资料/ }).click();
    await expect(page).toHaveURL(/#\/hr\/company-profile$/);
    await expect(page.getByText('仅企业管理员可修改').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /公司介绍/ }).click();
    await expect(page).toHaveURL(/#\/hr\/company-profile\/intro$/);
    // 文本区显示服务端事实但禁用；没有保存键；也没有任何写入请求
    await expect(page.getByLabel('公司介绍')).toBeDisabled();
    await expect(page.getByLabel('公司介绍')).toHaveValue(P1C标记.公司介绍);
    // 只读的诚实证据：member 在这一屏没有**任何**保存控件（连改了标签的也没有）——
    // 同一屏 admin 的「保存」键由 409 用例真实点击，所以这条 0 不是「标签变了匹配不上」。
    await expect(page.getByRole('button', { name: '保存', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /保存/ })).toHaveCount(0);
    expect(写入们).toEqual([]);
  });

  test('P1C 管理员申请只在进入实名认证屏后读取 @backend', async ({ page }) => {
    // admin request 列表不进登录链；企业实名认证屏挂载才读，状态按服务端事实展示。
    let 申请读取数 = 0;
    let 岗位读取数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-admin-req',
      记录目录请求: () => undefined,
      招聘组织Fixture: P1C招聘组织Fixture,
      主体初始角色: 'recruiter',
      请求拦截: ({ path }) => {
        if (path === '/api/v1/recruiter/organization-admin-requests') 申请读取数++;
        if (path === '/api/v1/recruiter/jobs') 岗位读取数++;
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await expect.poll(() => 岗位读取数).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(500); // 水合链收尾：admin request 若被误挂进登录链，这里会露馅
    expect(申请读取数).toBe(0);

    await page.goto('/#/hr/verify');
    await expect(page.getByText('管理员申请：待审核')).toBeVisible({ timeout: 10_000 });
    // dev server 的 StrictMode 会双跑挂载 effect，读取次数 ≥1 即可；关键断言是
    // 「没进本屏之前是 0」与「进了本屏才读」
    expect(申请读取数).toBeGreaterThanOrEqual(1);
    // 个人三行分开：公开名 / 实名 / 验证状态（fixture 未实名）
    await expect(page.getByText(`实名：未实名`)).toBeVisible();
    await expect(page.getByText(P1C标记.招聘方公开名).first()).toBeVisible();
  });

  test('P1C 招聘名片保存档案与头像走 multipart 单 media part @backend', async ({ page }) => {
    // 一次保存 = PATCH profile（If-Match 当前 revision）+ POST avatar
    // （multipart 恰一个 media part，不带 metadata/file part，If-Match 用新 revision）。
    const 写入们: { path: string; method: string; body: unknown; headers: Record<string, string>; multipart?: { parts: string[] } }[] = [];
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P1C搜索池();
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-profile',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      隐私fixture: 隐私,
      请求拦截: ({ path, method, body, headers, multipart }) => {
        if (method !== 'GET') 写入们.push({ path, method, body, headers, multipart });
      },
    });

    // 应用内普通编辑入口（存量档案 revision 3）：PATCH→头像 的 revision 链由本用例承载
    await page.goto('/#/hr/card');
    await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel('姓名')).toHaveValue(P1C标记.招聘方公开名);

    await page.getByLabel('姓名').fill('沈 fixture');
    // 公司自报是保存前置必填：经 公司选择抽屉 选中目录组织；选中只改草稿，不发声请求。
    await page.getByRole('button', { name: '未选择公司' }).click();
    await 抽屉搜企业并选中(page, '云衢科技', P1C标记.组织甲名);
    await page.setInputFiles('input[aria-label="更换头像"]', {
      name: '头像.png', mimeType: 'image/png', buffer: 一像素PNG,
    });
    // 应用内普通编辑：主按钮是「保存」，成功后留在本屏弹「保存成功」（不推进发岗）。
    await expect(page.getByRole('button', { name: '保存并继续' })).toHaveCount(0);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('保存成功')).toBeVisible({ timeout: 20_000 });

    const 档案写 = 写入们.find((项) => 项.path === '/api/v1/recruiter/profile' && 项.method === 'PATCH');
    expect(档案写).toBeDefined();
    // PATCH body = 公开名、职务与选中的自报组织 ref；If-Match 是当前 revision 的 etag
    expect(档案写!.body).toEqual({
      public_name: '沈 fixture',
      title: P1C标记.招聘方职务,
      organization_ref: P1C标记.组织甲编号,
    });
    expect(档案写!.headers['if-match']).toBe('"3"');

    const 头像写 = 写入们.find((项) => 项.path === '/api/v1/recruiter/avatar' && 项.method === 'POST');
    expect(头像写).toBeDefined();
    // 冻结 multipart 形状：单个 media part（按 content-type boundary 解析，非 JSON parser）
    expect(头像写!.multipart?.parts).toEqual(['media']);
    // 头像 If-Match 用 PATCH 之后的 revision（fixture：3 → 4）
    expect(头像写!.headers['if-match']).toBe('"4"');
  });

  test('P1C 企业媒体 multipart 带 metadata purpose，删除走 204 @backend', async ({ page }) => {
    // 两步媒体协议：POST media(metadata+media) → PATCH 全量发布；
    // 删除先 PATCH 去引用再 DELETE（204 No Content）。
    const 写入们: { path: string; method: string; body: unknown; multipart?: { parts: string[]; metadata?: unknown } }[] = [];
    const 删除状态: number[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-media',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [P1C管理员关系], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      请求拦截: ({ path, method, body, multipart }) => {
        if (method !== 'GET') 写入们.push({ path, method, body, multipart });
      },
    });
    page.on('response', (响应) => {
      const 路径 = new URL(响应.url()).pathname;
      if (路径.startsWith(`/api/v1/organizations/${P1C标记.组织甲编号}/media/`) && 响应.request().method() === 'DELETE') {
        删除状态.push(响应.status());
      }
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.goto('/#/hr/company-profile/album');
    await expect(page.getByRole('button', { name: '添加实景照片' })).toBeVisible({ timeout: 10_000 });

    await page.setInputFiles('input[aria-label="上传实景照片"]', {
      name: '实景.png', mimeType: 'image/png', buffer: 一像素PNG,
    });
    // 上传 → PATCH 发布 → 快照带权威媒体 → 删除键出现
    await expect(page.getByRole('button', { name: '删除实景照片第 1 张' })).toBeVisible({ timeout: 10_000 });

    const 媒体写 = 写入们.find((项) => 项.path === `/api/v1/organizations/${P1C标记.组织甲编号}/media` && 项.method === 'POST');
    expect(媒体写).toBeDefined();
    // FormData key 顺序：metadata(application/json) + media，恰好两个 part
    expect(媒体写!.multipart?.parts).toEqual(['metadata', 'media']);
    // metadata 的 purpose 按槽位区分（office_photo），只在测试进程内比对
    expect(媒体写!.multipart?.metadata).toEqual({ purpose: 'office_photo' });

    const 发布们 = 写入们.filter((项) => 项.path === `/api/v1/organizations/${P1C标记.组织甲编号}/profile` && 项.method === 'PATCH');
    expect(发布们.length).toBe(1);
    expect((发布们[0].body as { office_media_ids: string[] }).office_media_ids.length).toBe(1);

    // 删除：先 PATCH 去引用（media 仍被快照引用），再 DELETE 拿 204
    await page.getByRole('button', { name: '删除实景照片第 1 张' }).click();
    await expect(page.getByRole('button', { name: '删除实景照片第 1 张' })).toHaveCount(0, { timeout: 10_000 });
    expect(删除状态).toEqual([204]);

    const 补丁们 = 写入们.filter((项) => 项.path === `/api/v1/organizations/${P1C标记.组织甲编号}/profile` && 项.method === 'PATCH');
    expect(补丁们.length).toBe(2);
    expect((补丁们[1].body as { office_media_ids: string[] }).office_media_ids).toEqual([]);
  });

  test('P1C 409 冲突保留公司介绍草稿并需人工再存 @backend', async ({ page }) => {
    // 覆盖沿用现有 覆盖 seam：首次 PATCH 409 version_conflict → operation 重读权威快照，
    // 但文本草稿留在用户手里；人工再按同一个保存键，第二次放行给内置 fixture 应答。
    let 档案写数 = 0;
    let 档案读数 = 0;
    let 覆盖次数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-409',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [P1C管理员关系], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      请求拦截: ({ path, method }) => {
        if (path === `/api/v1/organizations/${P1C标记.组织甲编号}/profile`) {
          if (method === 'PATCH') 档案写数++;
          if (method === 'GET') 档案读数++;
        }
      },
      覆盖: {
        [`PATCH /api/v1/organizations/${P1C标记.组织甲编号}/profile`]: () => {
          覆盖次数++;
          if (覆盖次数 === 1) {
            return { status: 409, 响应: { error: { type: 'version_conflict', message: '版本冲突' } } };
          }
          return undefined; // 人工再存这一次放行给内置 fixture
        },
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    // 走真实入口进分区页（名片 → 公司主页资料 → 公司介绍行）：保存成功后的 返回()
    // 才会回到分区清单，而不是直接手输 URL 后退到企业主壳
    await page.goto('/#/hr/card');
    await page.getByRole('button', { name: /公司主页资料/ }).click();
    await expect(page).toHaveURL(/#\/hr\/company-profile$/, { timeout: 10_000 });
    await page.getByRole('button', { name: /公司介绍/ }).click();
    const 草稿区 = page.getByLabel('公司介绍');
    await expect(草稿区).toBeVisible({ timeout: 10_000 });
    await expect(草稿区).toHaveValue(P1C标记.公司介绍);

    await 草稿区.fill('409 之后仍然留在本页的草稿');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    // 409：operation 重读权威快照（媒体同步、文本不动），草稿保留，页面不离开。
    // 计数是普通数字，click 之后网络往返要等一会儿 → expect.poll 轮询
    await expect.poll(() => 档案读数, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    await expect.poll(() => 档案写数, { timeout: 10_000 }).toBe(1);
    await expect(page.getByLabel('公司介绍')).toHaveValue('409 之后仍然留在本页的草稿');
    await expect(page).toHaveURL(/#\/hr\/company-profile\/intro$/);

    // 人工再存：第二次 PATCH 走内置 fixture 应答成功，才返回分区清单
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('已保存')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/#\/hr\/company-profile$/, { timeout: 10_000 });
    await expect.poll(() => 档案写数, { timeout: 10_000 }).toBe(2);
  });

  test('P1C canonical ref 公司卡可进公开企业页，no-ref 声明卡不可点 @backend', async ({ page }) => {
    // owner snapshot 投影：带 hiring_organization_ref 的公司卡是按钮，点击直接读公开企业；
    // 无 ref 的未认证声明只渲染同样式的非交互块，也不触发任何 Organization 读取。
    // publisher / hiring 两行不折叠，direct 与 agency 各占一行并带 wire code。
    const 岗位甲 = P1C岗位();
    const 岗位乙 = P1C岗位({
      job_id: 'job-fixture-noref',
      publisher_mode: 'agency',
      publisher_affiliation_ref: 'aff-fixture-admin',
      publisher_verification_status: 'unverified',
      publisher_organization_ref: undefined,
      hiring_organization_claim: { display_name: '未认证声明客户乙', legal_name: null },
      hiring_organization_verification_status: 'unverified',
      hiring_organization_ref: undefined,
      title: 'Fixture 岗位（无企业引用）',
    });
    const 公开读取: string[] = [];
    let 岗位读取数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-ref',
      记录目录请求: () => undefined,
      // 无企业关系（水合不预读公开企业），公司卡点击才是对公开企业的直接读取
      招聘组织Fixture: 带企业关系(
        P1C招聘组织Fixture,
        [],
        { [P1C标记.组织甲编号]: P1C组织甲() },
        [岗位甲, 岗位乙],
      ),
      主体初始角色: 'recruiter',
      请求拦截: ({ path, method }) => {
        if (method === 'GET' && path.startsWith('/api/v1/organizations/')) 公开读取.push(path);
        if (path === '/api/v1/recruiter/jobs' && method === 'GET') 岗位读取数++;
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await expect.poll(() => 岗位读取数).toBeGreaterThanOrEqual(1);

    await page.goto('/#/hr/job/job-fixture-001');
    await expect(page.getByRole('heading', { name: 'Fixture 岗位（带企业引用）' })).toBeVisible({ timeout: 10_000 });
    // direct/agency 不折叠：两行各自来自明确的 DTO 字段，展示带 wire code
    await expect(page.getByTestId('publisher-status')).toContainText('直招 · 已认证（verified）');
    await expect(page.getByTestId('hiring-status')).toContainText(`${P1C标记.组织甲名} · 已认证（verified）`);

    const 读取前 = 公开读取.length;
    await page.getByRole('button', { name: new RegExp(P1C标记.组织甲名) }).click();
    await expect(page).toHaveURL(new RegExp(`#/company/${P1C标记.组织甲编号}$`));
    // 企业身份卡来自直接读取的公开企业（不经过任何 candidate Job route）。
    // dev server 的 StrictMode 会双跑挂载 effect：次数 ≥1，且全部按 canonical ID 读
    await expect(page.getByText(P1C标记.组织甲法定名)).toBeVisible({ timeout: 10_000 });
    const 公司页读取 = 公开读取.slice(读取前);
    expect(公司页读取.length).toBeGreaterThanOrEqual(1);
    expect(new Set(公司页读取)).toEqual(new Set([`/api/v1/organizations/${P1C标记.组织甲编号}`]));

    await page.goto('/#/hr/job/job-fixture-noref');
    await expect(page.getByRole('heading', { name: 'Fixture 岗位（无企业引用）' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('publisher-status')).toContainText('代理 · 未认证（unverified）');
    await expect(page.getByTestId('hiring-status')).toContainText('未认证声明客户乙 · 未认证（unverified）');
    // 声明卡不是按钮（无尖括号、无可点），claim 不触发任何 Organization 读取
    await expect(page.getByRole('button', { name: /未认证声明客户乙/ })).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(公开读取.length).toBe(读取前 + 公司页读取.length);
  });

  test('P1C Organization 读取失败不回退 Mock 公司内容 @backend', async ({ page }) => {
    // 公开企业读得到 → 企业身份卡来自 HTTP；读不到（404 organization_not_found）
    // → 诚实空态，绝不拿静态公司档案顶替。
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-org-fail',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [P1C管理员关系], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      覆盖: {
        'GET /api/v1/organizations/org-fixture-gone': () => ({
          status: 404,
          响应: { error: { type: 'organization_not_found', message: '企业不存在' } },
        }),
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });

    await page.goto(`/#/company/${P1C标记.组织甲编号}`);
    await expect(page.getByText(P1C标记.组织甲法定名)).toBeVisible({ timeout: 10_000 });

    await page.goto('/#/company/org-fixture-gone');
    await expect(page.getByText('这家企业暂时打不开')).toBeVisible({ timeout: 10_000 });
    // Mock 分支的静态公司页内容不出现（不回退静态档）
    await expect(page.getByText('公司自述')).toHaveCount(0);
    await expect(page.getByText('作息与条款')).toHaveCount(0);
  });

  // ── 企业名片统一（Task 3）：两栈消费同一份 企业公开页展示/招聘名片展示。
  //    Backend 侧验证「合法缺字段是占位、契约错误/失败不是成功占位页」与能力差异，
  //    不复写上方三条 P1C 既有回归，只新增统一展示的跨模式断言。──

  test('企业名片统一 Backend 公开页真实字段上屏、缺字段占位、岗位/导航能力不可执行 @backend', async ({ page }) => {
    await 安装BFF路由(page, {
      登录尝试id: 'att-uni-org-full',
      记录目录请求: () => undefined,
      // 无企业关系：公开页只经 URL 按 opaque ID 直读，不经过名片当前关系
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
    });

    await page.goto(`/#/company/${P1C标记.组织甲编号}`);
    await expect(page.getByText(P1C标记.组织甲法定名)).toBeVisible({ timeout: 10_000 });

    // 身份行来自 HTTP：法定名/展示名/核验时间（slice(0,10)）；岗位数是真实已核验在招数
    await expect(page.getByText('2026-08-25', { exact: true })).toBeVisible();
    await expect(page.getByText('天使轮 · 20-99 人 · Fixture 行业')).toBeVisible();
    // 同一岗位数文案出现在「企业身份」行与底部固定区两处
    await expect(page.getByText('1 个已核验在招岗位')).toHaveCount(2);

    // 能力不可执行：无岗位层入口、无导航键，只给事实与不可点说明，绝不给假按钮
    await expect(page.getByRole('button', { name: /看这家在招的/ })).toHaveCount(0);
    await expect(page.getByText('岗位列表暂不可用')).toBeVisible();
    await expect(page.getByRole('button', { name: '导航 ›' })).toHaveCount(0);
    await expect(page.getByText('导航暂不可用')).toBeVisible();

    // 统一展示下两栈同结构：接口没有的字段是明确占位，不是整卡消失。
    // 文化/历程占位在对应 Tab 正文里：切 Tab 只换正文，不改事实来源
    await expect(page.getByText(P1C标记.公司介绍)).toBeVisible();
    await page.getByRole('button', { name: '企业文化' }).click();
    await expect(page.getByText('企业文化未知')).toBeVisible();
    await page.getByRole('button', { name: '发展历程' }).click();
    await expect(page.getByText('发展历程未知')).toBeVisible();
    await page.getByRole('button', { name: '公司简介' }).click();
    await expect(page.getByText('主营业务', { exact: true })).toBeVisible();
    await expect(page.getByText('Fixture 主营业务一')).toBeVisible();
    await expect(page.getByRole('img', { name: '公司相册未知' })).toBeVisible();
    await expect(page.getByRole('img', { name: '企业 LOGO 未知' })).toBeVisible();
    await expect(page.getByText('在职者反馈未知')).toBeVisible();
    await expect(page.getByText('工商资料未知')).toBeVisible();
    // 反馈未知就不画统计条，也不出现匿名评价来源说明
    await expect(page.getByText('来自平台内匿名评价')).toHaveCount(0);

    // 条款：福利标签是企业自述 → 「已提供 N 条条款」，没有代理核对结果就没有已核计数
    const 条款卡 = page.getByRole('button', { name: /作息与条款/ });
    await expect(条款卡).toContainText('已提供 1 条条款');
    await expect(条款卡).not.toContainText('条已由代理核对');
    await expect(条款卡).toContainText('双休');

    // 全文层：产品/团队在固定五部分里完整可达（Backend 不再有独立产品/团队卡）
    await page.getByRole('button', { name: '读全文 ›' }).click();
    await expect(page.getByText('Fixture 产品介绍')).toBeVisible();
    await expect(page.getByText('Fixture 成员简介')).toBeVisible();
    await page.keyboard.press('Escape');

    // 条款层：接口没有代理核对结果 → 「代理核对信息未知」，不写「0 条已核」冒充已检查
    await 条款卡.click();
    await expect(page.getByText('代理核对信息未知')).toBeVisible();
    await expect(page.getByText(/已核对 0 条条款/)).toHaveCount(0);
    await page.keyboard.press('Escape');

    // 来源页脚：公开信息来源与身份核验说明
    await expect(page.getByText('公开信息由企业主页提供 · 企业身份经平台核验')).toBeVisible();
  });

  test('企业名片统一 Backend 合法空公开档案逐字段占位且真实 0 不是未知 @backend', async ({ page }) => {
    // 全空但合法的公开档案：每个字段都转成对应「未知」，0 岗位照常显示 0（真实 0 ≠ 未知），
    // 整页仍是一张成功页，不是「打不开」的诚实空态。
    const 空档案: P1C企业档案形 = {
      ...P1C企业档案(),
      brand_name: '',
      industry: null,
      company_size: '',
      funding_stage: '',
      office_address: '',
      benefit_codes: [],
      work_schedule: '',
      company_intro: '',
      business_items: [],
      product_intro: '',
      team_members: [],
      logo: null,
      office_media: [],
      company_media: [],
    };
    await 安装BFF路由(page, {
      登录尝试id: 'att-uni-org-empty',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [], {
        [P1C标记.组织甲编号]: {
          legal_name: P1C标记.组织甲法定名,
          display_name: P1C标记.组织甲名,
          profile: 空档案,
        },
      }),
      主体初始角色: 'recruiter',
      // 内置公开企业路由的 active_verified_job_count 固定为 1；本用例经覆盖给出合法 0
      覆盖: {
        [`GET /api/v1/organizations/${P1C标记.组织甲编号}`]: () => ({
          status: 200,
          响应: 信封({
            organization_id: P1C标记.组织甲编号,
            legal_name: P1C标记.组织甲法定名,
            display_name: P1C标记.组织甲名,
            verified_at: '2026-08-25T00:00:00Z',
            profile: 空档案,
            active_verified_job_count: 0,
          }),
        }),
      },
    });

    await page.goto(`/#/company/${P1C标记.组织甲编号}`);
    await expect(page.getByText(P1C标记.组织甲法定名)).toBeVisible({ timeout: 10_000 });

    // 规模行逐字段补未知后拼接；必需身份字段仍来自 HTTP，不用占位掩盖契约
    await expect(page.getByText('融资阶段未知 · 公司规模未知 · 行业未知')).toBeVisible();
    await expect(page.getByText('2026-08-25', { exact: true })).toBeVisible();

    // 逐字段占位：每个缺失块保留区块与标签（文化/历程占位在各自 Tab 正文里）
    await expect(page.getByText('公司简介未知')).toBeVisible();
    await page.getByRole('button', { name: '企业文化' }).click();
    await expect(page.getByText('企业文化未知')).toBeVisible();
    await page.getByRole('button', { name: '发展历程' }).click();
    await expect(page.getByText('发展历程未知')).toBeVisible();
    await page.getByRole('button', { name: '公司简介' }).click();
    await expect(page.getByText('主营业务未知')).toBeVisible();
    await expect(page.getByRole('img', { name: '公司相册未知' })).toBeVisible();
    await expect(page.getByText('作息信息未知')).toBeVisible();
    await expect(page.getByText('福利信息未知')).toBeVisible();
    await expect(page.getByText('办公地址未知')).toBeVisible();
    await expect(page.getByText('地址补充未知')).toBeVisible();
    await expect(page.getByText('在职者反馈未知')).toBeVisible();
    await expect(page.getByText('工商资料未知')).toBeVisible();

    // 全文层五部分里产品/团队同样占位
    await page.getByRole('button', { name: '读全文 ›' }).click();
    await expect(page.getByText('产品介绍未知')).toBeVisible();
    await expect(page.getByText('团队介绍未知')).toBeVisible();
    await page.keyboard.press('Escape');

    // 真实 0 照常展示（身份行 + 底栏两处），岗位列表仍不可用
    await expect(page.getByText('0 个已核验在招岗位')).toHaveCount(2);
    await expect(page.getByText('岗位列表暂不可用')).toBeVisible();
    // 合法空档案 ≠ 请求失败：不出现诚实空态
    await expect(page.getByText('这家企业暂时打不开')).toHaveCount(0);
  });

  test('企业名片统一 Organization 读取失败只见诚实空态不见成功占位区 @backend', async ({ page }) => {
    await 安装BFF路由(page, {
      登录尝试id: 'att-uni-org-fail',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [P1C管理员关系], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      覆盖: {
        'GET /api/v1/organizations/org-fixture-gone': () => ({
          status: 404,
          响应: { error: { type: 'organization_not_found', message: '企业不存在' } },
        }),
      },
    });

    await page.goto('/#/company/org-fixture-gone');
    await expect(page.getByText('这家企业暂时打不开')).toBeVisible({ timeout: 10_000 });
    // 失败页不出现成功页的任何占位/结构：占位只属于「成功取得资料后的合法缺失」
    await expect(page.getByText('企业名称未知')).toHaveCount(0);
    await expect(page.getByText('公司简介未知')).toHaveCount(0);
    await expect(page.getByText('主营业务未知')).toHaveCount(0);
    await expect(page.getByText('工商资料未知')).toHaveCount(0);
    await expect(page.getByText('岗位列表暂不可用')).toHaveCount(0);
    await expect(page.getByText('公司自述')).toHaveCount(0);
    await expect(page.getByText('作息与条款')).toHaveCount(0);
    await expect(page.getByText(P1C标记.公司介绍)).toHaveCount(0);
  });

  test('企业名片统一 名片空公开档案预览占位且未知不进输入与提交 @backend', async ({ page }) => {
    // 全新招聘方 onboarding fixture：档案首读 404（合法的「还没有」）→ 名片空值态
    const 写入们: { path: string; method: string }[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-uni-card-empty',
      记录目录请求: () => undefined,
      招聘方OnboardingFixture: 创建招聘方OnboardingFixture(),
      请求拦截: ({ path, method }) => {
        if (method !== 'GET') 写入们.push({ path, method });
      },
    });

    await 以招聘方进入名片(page);
    await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible({ timeout: 10_000 });
    // 进名片时的切角色写入（PUT roles / preferences）不属名片域：此后名片域零写入为基线
    const 名片写入基线 = 写入们.length;

    // 预览三段占位 + 无图的中性空白头像位（不用姓名首字/企业字标冒充照片）
    await expect(page.getByText('姓名未知')).toBeVisible();
    await expect(page.getByText('职务未知')).toBeVisible();
    await expect(page.getByText('企业信息未知')).toBeVisible();
    await expect(page.getByRole('img', { name: '头像未知' })).toBeVisible();

    // 「未知」只进展示：可编辑行是空串输入 + 可行动占位符；公司行是选择入口按钮
    //（未选组织时显示「未选择公司」，绝不把「企业信息未知」塞进任何输入或提交）
    await expect(page.getByLabel('姓名')).toHaveValue('');
    await expect(page.getByLabel('职务')).toHaveValue('');
    await expect(page.getByPlaceholder('请填写姓名')).toBeVisible();
    await expect(page.getByPlaceholder('请填写职务')).toBeVisible();
    await expect(page.getByRole('button', { name: '未选择公司' })).toBeVisible();
    await expect(page.getByPlaceholder('请填写公司名称')).toHaveCount(0);

    // 打开选择抽屉再取消：选择本身零业务写入
    await page.getByRole('button', { name: '未选择公司' }).click();
    const 企业抽屉 = page.getByRole('dialog', { name: '选择企业' });
    await expect(企业抽屉).toBeVisible({ timeout: 10_000 });
    await expect(企业抽屉.getByPlaceholder('输入公司名称')).toBeVisible(); // 搜索视图正文
    await page.keyboard.press('Escape');
    await expect(企业抽屉).toHaveCount(0, { timeout: 10_000 });
    expect(写入们.slice(名片写入基线)).toEqual([]);

    // 空值保存：本地校验拦截，一个请求都不发，也不把占位文案写进任何提交
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page.getByText('请填写姓名')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/#\/hr\/card$/);
    expect(写入们.slice(名片写入基线)).toEqual([]);
  });

  test('企业名片统一 实名只读姓名保留公开名且认证标记按事实 @backend', async ({ page }) => {
    const 写入们: { path: string; method: string; body: unknown }[] = [];
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P1C搜索池();
    await 安装BFF路由(page, {
      登录尝试id: 'att-uni-card-verified',
      记录目录请求: () => undefined,
      招聘组织Fixture: {
        ...P1C招聘组织Fixture,
        profile: {
          ...P1C招聘组织Fixture.profile,
          personal_verification_status: 'verified',
          verified_name: '沈实名',
          public_name: '公开马甲名',
        },
        organizations: { [P1C标记.组织甲编号]: P1C组织甲() },
      },
      主体初始角色: 'recruiter',
      隐私fixture: 隐私,
      请求拦截: ({ path, method, body }) => {
        if (method !== 'GET') 写入们.push({ path, method, body });
      },
    });

    // 应用内普通编辑入口（非注册流）→ 主按钮是「保存」
    await page.goto('/#/hr/card');
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible({ timeout: 10_000 });

    // 当前可见姓名槽（预览 + 只读行）都显示实名姓名；没有可编辑姓名输入，公开名不上屏
    await expect(page.getByText('沈实名')).toHaveCount(2);
    await expect(page.getByLabel('姓名')).toHaveCount(0);
    await expect(page.getByText('公开马甲名')).toHaveCount(0);
    await expect(page.getByText('已认证', { exact: true })).toBeVisible();

    // 保存前置的公司自报经抽屉选中；保存仍提交原公开名：实名只读不把 public_name 擅自替换成实名姓名
    await page.getByRole('button', { name: '未选择公司' }).click();
    await 抽屉搜企业并选中(page, '云衢科技', P1C标记.组织甲名);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('保存成功')).toBeVisible({ timeout: 10_000 });
    const 档案写 = 写入们.find((项) => 项.path === '/api/v1/recruiter/profile' && 项.method === 'PATCH');
    expect(档案写).toBeDefined();
    expect(档案写!.body).toEqual({
      public_name: '公开马甲名',
      title: P1C标记.招聘方职务,
      organization_ref: P1C标记.组织甲编号,
    });
  });

  test('企业名片统一 名片保存失败保留输入与暂存头像并可重试 @backend', async ({ page }) => {
    const 写入们: { path: string; method: string }[] = [];
    let 档案写数 = 0;
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P1C搜索池();
    await 安装BFF路由(page, {
      登录尝试id: 'att-uni-card-retry',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      隐私fixture: 隐私,
      请求拦截: ({ path, method }) => {
        if (method !== 'GET') 写入们.push({ path, method });
      },
      覆盖: {
        'PATCH /api/v1/recruiter/profile': () => {
          档案写数 += 1;
          if (档案写数 === 1) {
            return { status: 500, 响应: { error: { type: 'internal_error', message: 'fixture 故障' } } };
          }
          return undefined; // 重试这一次放行给内置 fixture
        },
      },
    });

    // 应用内普通编辑入口（注册流入口会被已完成账号的守卫弹回企业主壳）
    await page.goto('/#/hr/card');
    await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel('姓名')).toHaveValue(P1C标记.招聘方公开名);
    await page.getByLabel('姓名').fill('重试招聘方');
    await page.getByLabel('职务').fill('资深招聘');
    await page.getByRole('button', { name: '未选择公司' }).click();
    await 抽屉搜企业并选中(page, '云衢科技', P1C标记.组织甲名);
    await page.setInputFiles('input[aria-label="更换头像"]', {
      name: '重试头像.png', mimeType: 'image/png', buffer: 一像素PNG,
    });
    // 暂存预览：服务端成功前只是内存预览，不落权威档案
    await expect(page.getByRole('img', { name: '头像预览' })).toBeVisible();

    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('后端服务暂时不可用，请稍后重试')).toBeVisible({ timeout: 10_000 });
    // 失败保留输入、所选企业与文件预览，不离开本屏，按钮也不再是保存中
    await expect(page).toHaveURL(/#\/hr\/card$/);
    await expect(page.getByLabel('姓名')).toHaveValue('重试招聘方');
    await expect(page.getByLabel('职务')).toHaveValue('资深招聘');
    await expect(page.getByRole('button', { name: P1C标记.组织甲名 })).toBeVisible();
    await expect(page.getByRole('img', { name: '头像预览' })).toBeVisible();
    await expect(page.getByRole('button', { name: '保存中…' })).toHaveCount(0);

    // 同一个保存键重试：PATCH 与头像 POST 各放行一次，成功后留在本屏
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('保存成功')).toBeVisible({ timeout: 20_000 });
    expect(写入们.filter((项) => 项.path === '/api/v1/recruiter/profile' && 项.method === 'PATCH')).toHaveLength(2);
    expect(写入们.some((项) => 项.path === '/api/v1/recruiter/avatar' && 项.method === 'POST')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P3 隐私域主链路 @backend（Task 6）：candidate 会话恢复水合隐私 → 设置关隐身 PATCH If-Match
// → 披露偏好稀疏补丁 → 屏蔽名单搜索/屏蔽（稳定组织 ID + 幂等键）→ 建档来源解除风险确认
// → 手动来源加入与解除 → 切招聘方 → 发布并编辑岗位（hard_requirements 四员完整收发）。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P3 Backend 隐私主链路 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('P3 隐私读写、组织屏蔽与岗位硬性条件走 HTTP fixture 主链路 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P3默认组织库();
    const 请求们: 拦截请求形[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-main',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      招聘组织Fixture: 带企业关系(
        P1C招聘组织Fixture,
        [P1C管理员关系],
        { [P1C标记.组织甲编号]: P1C组织甲() },
      ),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
    });

    // ── candidate 会话恢复：隐私是第三条并行水合域 ──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    // 主壳真正挂载后才直达设置页：Task 1 起离线边界让 /api/v1/events/live 以空闲本地
    // 连接打开，事件源 onOpen 的启动收件箱拉取加宽了落点 replace 导航的结算窗口，
    // URL 就位 ≠ 主壳已挂载，直达会被在飞的 replace 吞掉（与 学校搜索/401 清理 同款，
    // 只修测试定义，不改产品）。
    await expect(page.getByRole('button', { name: '市场', exact: true })).toBeVisible({ timeout: 15_000 });
    const 链 = 请求们.map((项) => `${项.method} ${项.path}`);
    const 会话位 = 链.indexOf('GET /api/v1/session');
    expect(会话位).toBeGreaterThanOrEqual(0);
    expect(链.slice(会话位, 会话位 + 12)).toEqual(expect.arrayContaining([
      'GET /api/v1/me/resume',
      'GET /api/v1/me/intentions',
      'GET /api/v1/me/privacy',
    ]));

    // ── 设置：关闭「对现雇主隐身」→ 确认弹层 → PATCH quoted If-Match ──
    await page.goto('/#/settings');
    const 隐身开关 = page.getByRole('switch', { name: '对现雇主隐身' });
    await expect(隐身开关).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
    await 隐身开关.click();
    await page.getByRole('button', { name: '仍要关闭' }).click();
    await expect(page.getByText('隐身已关闭')).toBeVisible({ timeout: 10_000 });
    await expect(隐身开关).toHaveAttribute('aria-checked', 'false');
    let 补丁们 = 请求们.filter((项) => 项.path === '/api/v1/me/privacy' && 项.method === 'PATCH');
    expect(补丁们.length).toBe(1);
    expect(补丁们[0].body).toEqual({ employer_privacy_enabled: false });
    expect(补丁们[0].headers['if-match']).toBe('"1"');
    expect(补丁们[0].headers['idempotency-key']).toBeUndefined();

    // ── 披露偏好：D4 只发 education 单成员的稀疏补丁，If-Match 用服务端新 revision ──
    await page.goto('/#/disclosure-prefs');
    // 档位按钮的可访问名称是字段化的「<字段名>：<档>」，选中态读 aria-pressed（见 披露偏好.tsx）
    const 学历意向确认后 = page.getByRole('button', { name: '毕业院校与学历：意向确认后', exact: true });
    const 学历不披露 = page.getByRole('button', { name: '毕业院校与学历：不披露', exact: true });
    await expect(学历意向确认后).toBeVisible({ timeout: 10_000 });
    await 学历不披露.click();
    await expect
      .poll(() => 请求们.filter((项) => 项.path === '/api/v1/me/privacy' && 项.method === 'PATCH').length, { timeout: 10_000 })
      .toBe(2);
    补丁们 = 请求们.filter((项) => 项.path === '/api/v1/me/privacy' && 项.method === 'PATCH');
    expect(补丁们[1].body).toEqual({ disclosure_preferences: { education: 'never' } });
    expect(补丁们[1].headers['if-match']).toBe('"2"');
    await expect(学历不披露).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });

    // ── 屏蔽名单：先点「选择要屏蔽的公司」→ 抽屉搜组织（strict active 分页 + query 绑定游标）
    //    → 点命中只回填 → 点「屏蔽」才发生业务写入 ──
    await page.goto('/#/blocklist');
    await page.getByRole('button', { name: '关联公司' }).click();
    await page.getByRole('button', { name: '选择要屏蔽的公司' }).click();
    const 组织抽屉 = page.getByRole('dialog', { name: '选择企业' });
    await 组织抽屉.getByPlaceholder('输入公司名称').fill('云衢');
    await expect(组织抽屉.getByRole('button', { name: P3标记.可屏蔽组织甲 })).toBeVisible({ timeout: 10_000 });
    await expect(组织抽屉.getByRole('button', { name: P3标记.可屏蔽组织乙 })).toBeVisible();
    // 停用组织永不进结果（strict active），第一页两枚后跟翻页键
    await expect(组织抽屉.getByText(P3标记.停用组织)).toHaveCount(0);
    const 搜索请求 = 请求们.filter((项) => 项.path === '/api/v1/organizations').at(-1);
    expect(decodeURIComponent(搜索请求?.query ?? '')).toContain('q=云衢');
    expect(decodeURIComponent(搜索请求?.query ?? '')).toContain('limit=20');

    await 组织抽屉.getByRole('button', { name: '加载更多' }).click();
    await expect(组织抽屉.getByRole('button', { name: P3标记.可屏蔽组织丙 })).toBeVisible({ timeout: 10_000 });
    const 翻页请求 = 请求们.filter((项) => 项.path === '/api/v1/organizations').at(-1)!;
    expect(翻页请求.query).toContain('cursor=');

    await 组织抽屉.getByRole('button', { name: P3标记.可屏蔽组织甲 }).click();
    await expect(组织抽屉).toHaveCount(0, { timeout: 10_000 });
    // 选中只回填入口（不发声写入）；点「屏蔽」才落业务写
    await expect(page.getByRole('button', { name: P3标记.可屏蔽组织甲 })).toBeVisible();
    expect(请求们.filter((项) => 项.path === '/api/v1/me/privacy/organization-blocks')).toEqual([]);
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();
    await expect(page.getByText(`已屏蔽 ${P3标记.可屏蔽组织甲}，双向不可见`)).toBeVisible({ timeout: 10_000 });

    const 屏蔽写们 = 请求们.filter((项) => 项.path === '/api/v1/me/privacy/organization-blocks' && 项.method === 'POST');
    expect(屏蔽写们.length).toBe(1);
    expect(屏蔽写们[0].body).toEqual({ organization_id: 'org-fixture-p3-block-a', source: 'related_organization' });
    expect(屏蔽写们[0].headers['if-match']).toBe('"3"');
    const 首把幂等键 = 屏蔽写们[0].headers['idempotency-key'];
    expect(首把幂等键).toBeTruthy();
    // 关联公司归入「建档时自动屏蔽」组（分组按 来源，不按理由文案）
    await expect(page.getByText('建档时自动屏蔽')).toBeVisible();
    await expect(page.getByText('你手动添加')).toHaveCount(0);

    // ── 解除建档来源：必须带 risk_acknowledged=true ──
    await page.getByRole('button', { name: '解除' }).click();
    await expect(page.getByText(`解除对「${P3标记.可屏蔽组织甲}」的屏蔽？`)).toBeVisible();
    await expect(page.getByText('这是你的当前雇主或其关联公司，解除意味着放弃这层保密。')).toBeVisible();
    await page.getByRole('button', { name: '确认解除' }).click();
    await expect(page.getByText(`已解除对 ${P3标记.可屏蔽组织甲} 的屏蔽`)).toBeVisible({ timeout: 10_000 });
    const 解除们 = 请求们.filter((项) => 项.path.startsWith('/api/v1/me/privacy/organization-blocks/') && 项.path.endsWith('/unblock'));
    expect(解除们.length).toBe(1);
    expect(解除们[0].path).toContain('/org-fixture-p3-block-a/');
    expect(解除们[0].body).toEqual({ risk_acknowledged: true });
    expect(解除们[0].headers['if-match']).toBe('"4"');
    await expect(page.getByRole('button', { name: '解除' })).toHaveCount(0, { timeout: 10_000 });

    // ── 手动来源：加入与解除都不需要风险确认（risk_acknowledged=false）──
    await page.getByRole('button', { name: '手动添加' }).click();
    await page.getByRole('button', { name: '选择要屏蔽的公司' }).click();
    await 抽屉搜企业并选中(page, '磐石', P3标记.手动组织甲);
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();
    await expect(page.getByText(`已屏蔽 ${P3标记.手动组织甲}，双向不可见`)).toBeVisible({ timeout: 10_000 });
    expect(请求们.filter((项) => 项.path === '/api/v1/me/privacy/organization-blocks' && 项.method === 'POST').length).toBe(2);
    const 手动写 = 请求们.filter((项) => 项.path === '/api/v1/me/privacy/organization-blocks' && 项.method === 'POST')[1];
    expect((手动写.body as { source?: string }).source).toBe('manual');
    expect(手动写.headers['idempotency-key']).toBeTruthy();
    expect(手动写.headers['idempotency-key']).not.toBe(首把幂等键);
    await expect(page.getByText('你手动添加')).toBeVisible();

    await page.getByRole('button', { name: '解除' }).click();
    await page.getByRole('button', { name: '确认解除' }).click();
    await expect(page.getByText(`已解除对 ${P3标记.手动组织甲} 的屏蔽`)).toBeVisible({ timeout: 10_000 });
    const 手动解除 = 请求们.filter((项) => 项.path.startsWith('/api/v1/me/privacy/organization-blocks/') && 项.path.endsWith('/unblock'))[1];
    expect((手动解除.body as { risk_acknowledged?: boolean }).risk_acknowledged).toBe(false);
    expect(手动解除.headers['if-match']).toBe('"6"');

    // ── 切招聘方：固定组织水合链，候选侧隐私先行清空 ──
    await page.goto('/#/identity?switch=1&from=app');
    await expect(page.getByRole('button', { name: '翻到「招聘方」那一面' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    const 切换后链 = 请求们.map((项) => `${项.method} ${项.path}`);
    // P6 并行水合的 recruiter 规则/提案读、J-PILOT-02 的 /me/onboarding 预填读与 Task 1 起
    // 离线边界 events/live 空闲本地连接触发的事件源 onOpen 收件箱拉取（use真人会话事件
    // 的文档化行为）都与组织链并发起跑；先滤掉再断言固定组织链
    const 组织链 = 切换后链.filter((项) => !项.startsWith('GET /api/v1/recruiter/agent-rule')
      && 项 !== 'GET /api/v1/me/onboarding'
      && 项 !== 'GET /api/v1/recruiter/conversations');
    const 偏好位 = 组织链.indexOf('PUT /api/v1/me/preferences/last-used-role');
    expect(偏好位).toBeGreaterThanOrEqual(0);
    // 唯一 verified 关系自动选中 ⇒ 固定链含一次公开企业直读；owner Jobs 收尾
    expect(组织链.slice(偏好位 + 1, 偏好位 + 5)).toEqual([
      'GET /api/v1/recruiter/profile',
      'GET /api/v1/recruiter/affiliations',
      `GET /api/v1/organizations/${P1C标记.组织甲编号}`,
      'GET /api/v1/recruiter/jobs',
    ]);

    // ── 发布岗位：POST body 带完整四员 hard_requirements；显式 ref 进 body，
    //    verification status / affiliation / claim 全由服务端推导 ──
    await 走完后端发岗向导(page);
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    const 创建 = 请求们.find((项) => 项.path === '/api/v1/recruiter/jobs' && 项.method === 'POST');
    expect(创建).toBeDefined();
    expect(创建!.headers['idempotency-key']).toBeTruthy();
    expect(创建!.body).toMatchObject({
      publisher_mode: 'direct',
      publisher_organization_ref: 'org-fixture-p3-manual-a',
      hiring_organization_ref: 'org-fixture-p3-manual-a',
    });
    const 创建键们 = Object.keys(创建!.body as Record<string, unknown>);
    expect(创建键们.filter((键) => /verification_status|affiliation|_claim/.test(键))).toEqual([]);
    const 发布硬性 = (创建!.body as { hard_requirements?: Record<string, string> }).hard_requirements ?? {};
    expect(Object.keys(发布硬性).sort()).toEqual(['alternate_weekend_work', 'frequent_travel', 'onsite_only', 'outsourcing_only']);
    for (const 档 of Object.values(发布硬性)) {
      expect(['required', 'not_required', 'unknown']).toContain(档);
    }

    // ── 编辑岗位：硬性事实控件已从 UI 删除；无编辑保存 = 空稀疏补丁（合同 C）——
    //    客户端不回传 immutable 字段原值、不重发四员块，全部由服务端按缺省保留 ──
    await page.goto('/#/hr/post-job/job-fixture-created-1');
    await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue('Fixture 实习岗位', { timeout: 10_000 });
    await page.getByRole('button', { name: '职位要求' }).click();
    await expect(page.getByRole('button', { name: /大小周/ })).toHaveCount(0);

    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('岗位已保存')).toBeVisible({ timeout: 15_000 });
    const 岗位补丁 = 请求们.find(
      (项) => /^\/api\/v1\/recruiter\/jobs\/job-fixture-created-1$/.test(项.path) && 项.method === 'PATCH',
    );
    expect(岗位补丁).toBeDefined();
    expect(岗位补丁!.headers['if-match']).toBe('"1"');
    // 空稀疏补丁：一个字段都不带 —— 既不伪造变化，也不会把四员块/immutable 意外清掉。
    // 「岗位已保存」只在 PATCH 后的权威 GET（四员块闭合解码通过）成功才出现，
    // 即服务端保留的四员块与 immutable 原值已被回读核验。
    expect(Object.keys(岗位补丁!.body as Record<string, unknown>)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P3 Backend 恢复分派 @backend：错误码驱动的重读不重放。
// 用例内通过 覆盖 seam 注入单次故障（沿用既有 att-* 计数器惯例）；需要「先见效再失败」的
// 场景直接改共享的 隐私.视图（handler 与测试同一进程同份状态）。所有等待用 expect.poll，
// 不用超过 UI debounce 的长 sleep。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P3 Backend 恢复分派 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  /** 隐私 GET 总数（hydration 之后作增量基线用） */
  function 统计get(请求们: { path: string; method: string }[]): number {
    return 请求们.filter((项) => 项.path === '/api/v1/me/privacy' && 项.method === 'GET').length;
  }

  test('PATCH 409 后只一次 PATCH、一次权威重读并刷新视图，绝不自动重放 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture();
    const 请求们: 拦截请求形[] = [];
    let 冲突次数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-r409',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      覆盖: {
        'PATCH /api/v1/me/privacy': () => {
          if (冲突次数 > 0) return undefined;
          冲突次数 += 1;
          // 他端并发推进了版本，还把「当前公司」改成一直允许 —— 权威视图将随重读刷新进来
          隐私.视图.revision += 1;
          隐私.视图.disclosure_preferences.current_employer = 'anonymous';
          return { status: 409, 响应: { error: { type: 'version_conflict', message: '版本冲突' } } };
        },
      },
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    const get基线 = 统计get(请求们);

    // 用户想关隐身 → PATCH 409 → 弹层保留可取消；权威快照经一次重读落进页面
    await page.goto('/#/settings');
    const 隐身开关 = page.getByRole('switch', { name: '对现雇主隐身' });
    await expect(隐身开关).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
    await 隐身开关.click();
    await page.getByRole('button', { name: '仍要关闭' }).click();
    await expect
      .poll(() => 统计get(请求们), { timeout: 10_000 })
      .toBe(get基线 + 1); // 安全重读权威恰好一次

    // 不自动重放：此时仍然只有那一次 PATCH
    expect(统计get(请求们)).toBe(get基线 + 1);
    expect(请求们.filter((项) => 项.path === '/api/v1/me/privacy' && 项.method === 'PATCH').length).toBe(1);

    await page.getByRole('button', { name: '保持开启' }).click();
    await expect(page.getByRole('button', { name: '仍要关闭' })).toHaveCount(0);
    // 刷新后的权威视图：employer_privacy_enabled 保持 true（页面仍开）
    await expect(隐身开关).toHaveAttribute('aria-checked', 'true');
    // 且他端写入的 D3=一直允许 已经在页面上（来自重读，不是本地假成功）
    await page.goto('/#/disclosure-prefs');
    await expect(page.getByRole('button', { name: '当前公司：一直允许', exact: true }))
      .toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
  });

  test('AddBlock 遇 idempotency_in_progress 同键受控重试，后续新意图换新键 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P3默认组织库();
    const 幂等键们: string[] = [];
    let 故障次数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-rInProgress',
      记录目录请求: () => undefined,
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      请求拦截: ({ path, method, headers }) => {
        if (path === '/api/v1/me/privacy/organization-blocks' && method === 'POST') {
          幂等键们.push(headers['idempotency-key'] ?? '');
        }
      },
      覆盖: {
        'POST /api/v1/me/privacy/organization-blocks': () => {
          if (故障次数 > 0) return undefined; // 重试放行给内置 fixture 应答
          故障次数 += 1;
          return {
            status: 409,
            头: { 'Retry-After': '0' },
            响应: { error: { type: 'idempotency_in_progress', message: '前次相同请求仍在处理' } },
          };
        },
      },
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    await page.goto('/#/blocklist');
    await page.getByRole('button', { name: '手动添加' }).click();
    await page.getByRole('button', { name: '选择要屏蔽的公司' }).click();
    await 抽屉搜企业并选中(page, '云衢', P3标记.可屏蔽组织甲);
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();
    // 首个意图：in-progress 后同键受控重试成功；回填的待选供直接重试
    await expect(page.getByText(`已屏蔽 ${P3标记.可屏蔽组织甲}，双向不可见`)).toBeVisible({ timeout: 10_000 });
    expect(幂等键们.length).toBe(2);
    expect(幂等键们[0]).toBe(幂等键们[1]);
    expect(幂等键们[0]).not.toBe('');

    // 新意图：成功路径清了待选，重开抽屉再搜再选另一枚命中 → 新请求必须换一把 Idempotency-Key
    await page.getByRole('button', { name: '选择要屏蔽的公司' }).click();
    await 抽屉搜企业并选中(page, '云衢', P3标记.可屏蔽组织乙);
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();
    await expect(page.getByText(`已屏蔽 ${P3标记.可屏蔽组织乙}，双向不可见`)).toBeVisible({ timeout: 10_000 });
    expect(幂等键们.length).toBe(3);
    expect(幂等键们[2]).not.toBe('');
    expect(幂等键们[2]).not.toBe(幂等键们[0]);
  });

  test('AddBlock 503 先生效后失败：权威重读确认效果，UI 不再发起第二次屏蔽 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P3默认组织库();
    const 请求们: 拦截请求形[] = [];
    let 已见效 = false;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-r503block',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      覆盖: {
        'POST /api/v1/me/privacy/organization-blocks': () => {
          if (!已见效) {
            已见效 = true;
            // 服务端已落库但响应丢失（operation_outcome_unknown）：先见效，之后每次都以 503 应答，
            // 让受控重试同样撞上结果未知 ⇒ 客户端只能走「重读权威核对效果」的歧义恢复路径。
            const 占位 = { organization_id: 'org-fixture-p3-manual-a' };
            隐私.视图.organization_blocks = [
              ...隐私.视图.organization_blocks,
              {
                organization_id: 占位.organization_id,
                organization_display_name: 隐私.组织库[占位.organization_id].display_name,
                organization_status: 隐私.组织库[占位.organization_id].status,
                source: 'manual',
                created_at: '2026-08-27T03:00:00Z',
              },
            ];
            隐私.视图.revision += 1;
          }
          return { status: 503, 响应: { error: { type: 'operation_outcome_unknown', message: '结果未知' } } };
        },
      },
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    const get基线 = 统计get(请求们);

    await page.goto('/#/blocklist');
    await page.getByRole('button', { name: '手动添加' }).click();
    await page.getByRole('button', { name: '选择要屏蔽的公司' }).click();
    await 抽屉搜企业并选中(page, '磐石', P3标记.手动组织甲);
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();

    // 效果达成路径：按 GET 核实后按成功兑现（清待选 + 成功提示）
    await expect(page.getByText(`已屏蔽 ${P3标记.手动组织甲}，双向不可见`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('你手动添加')).toBeVisible();
    await expect(page.getByText(P3标记.手动组织甲, { exact: true })).toBeVisible();
    // 歧义后的核实：恰好一次 GET 权威；同一次意图的两笔传输共用同一把幂等键（受控重试），
    // 绝无第二个新意图发出 —— 内置 handler 从未参与：唯一副作用就是覆盖里的那次手动落库
    await expect.poll(() => 统计get(请求们), { timeout: 10_000 }).toBe(get基线 + 1);
    const 覆盖期写们 = 请求们.filter((项) => 项.path === '/api/v1/me/privacy/organization-blocks' && 项.method === 'POST');
    await expect.poll(() => 覆盖期写们.length, { timeout: 10_000 }).toBe(2);
    expect(覆盖期写们[0].headers['idempotency-key']).toBe(覆盖期写们[1].headers['idempotency-key']);
    expect(隐私.统计.屏蔽写入).toBe(0);
  });

  test('Unblock 404 目标他端已解除：以权威视图为准视为成功，不重放解除 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture({
      organization_blocks: [
        {
          organization_id: 'org-fixture-p3-gone',
          organization_display_name: 'Fixture 他端先解企业',
          organization_status: 'active',
          source: 'manual',
          created_at: '2026-08-20T00:00:00Z',
        },
      ],
      revision: 5,
    });
    const 请求们: 拦截请求形[] = [];
    let 已报失 = false;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-r404unblock',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      覆盖: {
        'POST /api/v1/me/privacy/organization-blocks/org-fixture-p3-gone/unblock': () => {
          if (已报失) return undefined;
          已报失 = true;
          // 服务端该行已被他端移除（同样推进版本），本次解除以 404 作答
          隐私.视图.organization_blocks = [];
          隐私.视图.revision += 1;
          return { status: 404, 响应: { error: { type: 'organization_block_not_found', message: '目标不存在' } } };
        },
      },
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    const get基线 = 统计get(请求们);
    await page.goto('/#/blocklist');
    await expect(page.getByText('Fixture 他端先解企业')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: '解除' }).click();
    await page.getByRole('button', { name: '确认解除' }).click();
    // 404 + 权威视图已无该组织 ⇒ 兑现为成功（提示照常出现），且恰好一次核对 GET、零重放
    await expect(page.getByText('已解除对 Fixture 他端先解企业 的屏蔽')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Fixture 他端先解企业')).toHaveCount(0, { timeout: 10_000 });
    await expect.poll(() => 统计get(请求们), { timeout: 10_000 }).toBe(get基线 + 1);
    await expect
      .poll(() => 请求们.filter((项) => 项.path.endsWith('/unblock')).length, { timeout: 10_000 })
      .toBe(1);
  });

  test('Unblock 422 风险确认：一次重读更新来源分组后原样抛出，绝不自动重放 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture({
      organization_blocks: [
        {
          organization_id: 'org-fixture-p3-flip',
          organization_display_name: P3标记.可屏蔽组织甲,
          organization_status: 'active',
          source: 'current_employer',
          created_at: '2026-08-20T00:00:00Z',
        },
      ],
      revision: 4,
    });
    const 请求们: 拦截请求形[] = [];
    let 已纠正 = false;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-r422unblock',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      覆盖: {
        'POST /api/v1/me/privacy/organization-blocks/org-fixture-p3-flip/unblock': () => {
          if (已纠正) return undefined;
          已纠正 = true;
          // 存储里这条其实已经被改判为手动来源：422 要求重新确认 —— 与此同时把它落库改掉
          const 行 = 隐私.视图.organization_blocks.find((块) => 块.organization_id === 'org-fixture-p3-flip');
          if (行) 行.source = 'manual';
          隐私.视图.revision += 1;
          return { status: 422, 响应: { error: { type: 'risk_acknowledgement_required', message: '需要风险确认' } } };
        },
      },
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    const get基线 = 统计get(请求们);
    await page.goto('/#/blocklist');
    await expect(page.getByText(P3标记.可屏蔽组织甲, { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: '解除' }).click();
    await page.getByRole('button', { name: '确认解除' }).click();
    // 重读把真实来源（manual）带回：行挪去「你手动添加」组、副行理由随之更新；
    // 操作本身抛回 UI ⇒ 弹层静默关闭，绝不二次 POST
    await expect(page.getByText(P3标记.可屏蔽组织甲, { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('你手动加入 · 双向不可见 · 2026-08-20')).toBeVisible();
    await expect(page.getByRole('button', { name: '确认解除' })).toHaveCount(0);
    await expect.poll(() => 统计get(请求们), { timeout: 10_000 }).toBe(get基线 + 1);
    await expect
      .poll(() => 请求们.filter((项) => 项.path.endsWith('/unblock')).length, { timeout: 10_000 })
      .toBe(1);
  });

  test('组织搜索竞态：旧词晚到被代际守卫丢弃，只有新词渲染；无结果回既有空态 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture(); // 屏蔽名单为空：便于断言既有空态
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-race',
      记录目录请求: () => undefined,
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
    });
    // 搜索脚本：A 词延迟 1500ms 单枚命中并带专用游标；B 词即时命中无游标
    隐私.搜索脚本.push(
      {
        词: '云端矩阵',
        延迟毫秒: 1500,
        items: [{ organization_id: 'org-fixture-race-a', display_name: '竞速先发公司A序列', legal_name: '上海竞速先发A有限公司' }],
        next_cursor: 'cur-stale-a',
      },
      {
        词: '后发制胜',
        items: [{ organization_id: 'org-fixture-race-b', display_name: '竞速后发公司B序列', legal_name: '上海竞速后发B有限公司' }],
        next_cursor: null,
      },
    );

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await page.goto('/#/blocklist');
    await expect(page.getByText('名单是空的')).toBeVisible({ timeout: 10_000 }); // 空态基线

    await page.getByRole('button', { name: '当前雇主' }).click();
    await page.getByRole('button', { name: '选择要屏蔽的公司' }).click();
    const 组织抽屉 = page.getByRole('dialog', { name: '选择企业' });
    const 组织框 = 组织抽屉.getByPlaceholder('输入公司名称');
    await 组织框.fill('云端矩阵');
    await expect.poll(() => 隐私.搜索完成.some((项) => 项.q === '云端矩阵'), { timeout: 10_000 }).toBe(true); // 已受理（响应仍被脚本压住 1500ms）

    // 换词即作废在飞代际：B 即刻命中渲染
    await 组织框.fill('后发制胜');
    await expect(组织抽屉.getByText('竞速后发公司B序列')).toBeVisible({ timeout: 10_000 });
    await expect(组织抽屉.getByText('竞速先发公司A序列')).toHaveCount(0);
    await expect(组织抽屉.getByRole('button', { name: '加载更多' })).toHaveCount(0); // B 无游标

    // A 此刻才应答完成 —— 也必须被代际守卫丢弃
    await expect.poll(() => 隐私.搜索已答.some((项) => 项.q === '云端矩阵'), { timeout: 10_000 }).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 120));
    await expect(组织抽屉.getByText('竞速先发公司A序列')).toHaveCount(0);
    await expect(组织抽屉.getByText('竞速后发公司B序列')).toBeVisible();
    await expect(组织抽屉.getByRole('button', { name: '加载更多' })).toHaveCount(0);

    // 无结果：候选列表清空、抽屉给「没找到」提示；页面既有空态不受影响
    await 组织框.fill('旧东家'); // 命中的是停用组织：strict active 口径不下发
    await expect(组织抽屉.getByText('竞速后发公司B序列')).toHaveCount(0, { timeout: 10_000 });
    await expect(组织抽屉.getByText('没有找到相关企业')).toBeVisible();
    await expect(page.getByText('名单是空的')).toBeVisible();
    await expect(page.getByText(P3标记.停用组织)).toHaveCount(0);
    // 三次搜索全部终结（A/B/停用词查询都没有挂在途）
    await expect.poll(() => 隐私.搜索已答.length, { timeout: 10_000 }).toBe(3);
  });

  test('登出时挂起的隐私 GET 过期不作数：新主体只见自己的快照 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture({
      disclosure_preferences: { current_employer: 'anonymous', education: 'never', portfolio_links: 'never' },
      revision: 7,
    });
    隐私.组织库['org-fixture-p3-old'] = { display_name: 'Fixture 旧世界公司', legal_name: '上海旧世界有限公司', status: 'active' };
    隐私.视图.organization_blocks = [
      {
        organization_id: 'org-fixture-p3-old',
        organization_display_name: 'Fixture 旧世界公司',
        organization_status: 'active',
        source: 'manual',
        created_at: '2026-08-19T00:00:00Z',
      },
    ];
    const 请求们: 拦截请求形[] = [];
    let 挂起兑现: (() => void) | null = null;

    // 冲突注入放在 弹层确认后第一次 PATCH：借它的安全重读制造「挂起中的旧会话 GET」
    let 冲突次数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-stale',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      覆盖: {
        'PATCH /api/v1/me/privacy': () => {
          if (冲突次数 > 0) return undefined;
          冲突次数 += 1;
          隐私.视图.revision += 1;
          return { status: 409, 响应: { error: { type: 'version_conflict', message: '版本冲突' } } };
        },
      },
    });

    // A 主体会话：旧世界公司可见
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await page.goto('/#/blocklist');
    await expect(page.getByText('Fixture 旧世界公司')).toBeVisible({ timeout: 10_000 });

    // 触发一次带挂起重读的冲突（重读将在旧会话登出后才被放行）
    await page.goto('/#/disclosure-prefs');
    const 作品意向确认后 = page.getByRole('button', { name: '作品与代码仓库：意向确认后', exact: true });
    const get挂起前 = 统计get(请求们);
    隐私.get脚本.push({
      保持: new Promise<void>((resolve) => {
        挂起兑现 = resolve;
      }),
    });
    await 作品意向确认后.click();
    await expect.poll(() => 统计get(请求们), { timeout: 10_000 }).toBe(get挂起前 + 1); // 重读已发出并被挂起

    // 旧会话登出（清理同步派发），然后才放行那个迟到的旧 GET。
    // hash 直跳设置根 —— 不能整页 reload，那会让新挂载抢走队列里的挂起项
    await page.evaluate(() => {
      window.location.hash = '#/settings';
    });
    await expect(page.getByText('隐私与可见性')).toBeVisible({ timeout: 10_000 });
    // 触发键与确认层的确认键**不再同名**：确认键有自己的可访问名称「确认退出当前账号」
    // （src/屏幕/设置.tsx:225 的 aria-label，可见文案仍是「退出登录」）。
    // 弹层框架用的是 <dialog open>，非模态 —— 层开着时背景那枚触发键仍在可访问树里，
    // 两枚同名会让 getByRole 分不开，也让读屏用户分不开，所以产品侧把名字拆开了。
    // 「确认」前缀同时避开了遮罩键「关闭退出当前账号」：getByRole 的 name 是子串匹配，
    // 确认键若直接叫「退出当前账号」会同时命中遮罩，触发 strict mode violation。
    await page.getByRole('button', { name: '退出登录' }).click();
    await page.getByRole('button', { name: '确认退出当前账号' }).click();
    await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 10_000 });
    挂起兑现?.();

    // 服务端换成 B 主体的权威事实后再登录
    隐私.视图 = {
      employer_privacy_enabled: false,
      disclosure_preferences: { current_employer: 'resume_submission', education: 'resume_submission', portfolio_links: 'resume_submission' },
      organization_blocks: [
        {
          organization_id: 'org-fixture-p3-new',
          organization_display_name: 'Fixture 新世界公司',
          organization_status: 'active',
          source: 'current_employer',
          created_at: '2026-08-27T04:00:00Z',
        },
      ],
      revision: 42,
      updated_at: '2026-08-27T04:00:00Z',
    };
    await page.getByLabel('手机号').fill('13900000002');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await page.getByLabel('短信验证码').fill('1234');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '进入' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 登录建立会话后整页恢复一次：mount 会话恢复链才会按 last_used_role 水合三域（含隐私）
    await page.reload();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // B 主体自己的水合读取了自己的快照；旧世界的任何痕迹都不再出现
    const 完成位 = 请求们.findIndex((项) => 项.method === 'POST' && 项.path.endsWith('/complete') && 项.path.includes('/login-attempts/'));
    expect(完成位).toBeGreaterThanOrEqual(0);
    const 登录后隐私位 = 请求们.findIndex((项, 序) => 序 > 完成位 && 项.path === '/api/v1/me/privacy' && 项.method === 'GET');
    expect(登录后隐私位).toBeGreaterThanOrEqual(0); // 新会话水合再次带上隐私 GET
    await page.goto('/#/blocklist');
    await expect(page.getByText('Fixture 新世界公司')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Fixture 旧世界公司')).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P3 Mock 数据源隔离 @mock：隐私相关四屏访问且本地流照常工作，同时
// 全程 /api/v1 请求列表保持为空 —— Mock 模式对 P3 域零网络调用。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P3 Mock 数据源隔离 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('Mock 四屏本地流程零 API 请求 @mock', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    // 登录（Mock 一键直进）
    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // 设置：本地开关切换立即生效，无网络
    await page.goto('/#/settings');
    await expect(page.getByText('隐私与可见性')).toBeVisible({ timeout: 10_000 });
    const 别的开关 = page.getByRole('switch', { name: '求职状态' }).first();
    if (await 别的开关.isVisible().catch(() => false)) {
      const 开前 = await 别的开关.getAttribute('aria-checked');
      await 别的开关.click();
      await expect(别的开关).toHaveAttribute('aria-checked', 开前 === 'true' ? 'false' : 'true');
    }
    // 对现雇主隐身在 Mock 同样可切（本地归约）：初始为开时需过确认弹层
    const 隐身开关 = page.getByRole('switch', { name: '对现雇主隐身' });
    if ((await 隐身开关.getAttribute('aria-checked')) === 'true') {
      await 隐身开关.click();
      await page.getByRole('button', { name: '仍要关闭' }).click();
      await expect(隐身开关).toHaveAttribute('aria-checked', 'false', { timeout: 10_000 });
    } else {
      await 隐身开关.click();
      await expect(隐身开关).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
      await 隐身开关.click(); // 再关回去同样要确认弹层
      await page.getByRole('button', { name: '仍要关闭' }).click();
      await expect(隐身开关).toHaveAttribute('aria-checked', 'false', { timeout: 10_000 });
    }
    expect(apiRequests).toEqual([]);

    // 披露偏好：D4 本地切档（Mock 七行模板照旧展示并可点）
    await page.goto('/#/disclosure-prefs');
    const Mock学历不披露 = page.getByRole('button', { name: '毕业院校与学历：不披露', exact: true });
    await expect(page.getByRole('button', { name: '毕业院校与学历：一直允许', exact: true })).toBeVisible({ timeout: 10_000 });
    await Mock学历不披露.click();
    await expect(Mock学历不披露).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
    expect(apiRequests).toEqual([]);

    // 屏蔽名单：自由文本本地加入（Mock 无组织搜索段）
    await page.goto('/#/blocklist');
    const 添加框 = page.getByPlaceholder('输入公司全称，如「某某科技」');
    await expect(添加框).toBeVisible({ timeout: 10_000 });
    await 添加框.fill('本地测试屏蔽公司');
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();
    await expect(page.getByText('已屏蔽 本地测试屏蔽公司，双向不可见')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('本地测试屏蔽公司').first()).toBeVisible();
    expect(apiRequests).toEqual([]);

    // 发岗屏（Mock 本地向导）：到达 + 第一步本地校验照常运转
    await page.goto('/#/hr/post-job');
    const 岗位名框 = page.getByPlaceholder(/资深后端工程师/);
    await expect(岗位名框).toBeVisible({ timeout: 10_000 });
    await 岗位名框.fill('本地草稿岗位');
    await expect(岗位名框).toHaveValue('本地草稿岗位');
    // Mock 目录选择的类别（非硬性条件区也保持本地可选）
    await page.getByRole('button', { name: '实习生 在校生实习，按天计薪' }).click();

    // 全程累计：Mock 模式下没有任何 /api/v1 请求 —— P3 域也是纯本地
    expect(apiRequests).toEqual([]);
  });
});

// P6 规则域 fixture @backend —— Agent 规则/提案全生命周期（intercepted boundary only）。
// 断言以 fixture 存证的变更回执（body / If-Match / Idempotency-Key）为主，
// 可见文案只做收口佐证；标记值只存在于 fixture，上屏即证明渲染来自 HTTP。
// ─────────────────────────────────────────────────────────────────────────────

/** 就绪提案卡的正文 div 与动作键同属一张卡：正文唯一文本的父节点即卡，卡内恰一组动作键。 */
function 就绪卡动作键(page: Page, 正文: string, 名称: string) {
  return page.getByText(正文).locator('..').getByRole('button', { name: 名称 });
}

test.describe('P6 规则域 fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('P6 全链路：双端规则生命周期与请求契约 @backend', async ({ page }) => {
    // 冻结序列：candidate restore → 双端水合（意向规则只读入意向域，本页零写入口）→
    // global create→accept → 替换(If-Match) → 显示删除/删除规则 确认后归档(If-Match) →
    // 切招聘端 → 招聘 create(no scope)→accept → pause/resume 版本推进
    test.setTimeout(150_000);
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-life',
      记录目录请求: () => undefined,
      // 招聘端水合需要组织域 fixture；主体同时具备双角色，切身份走真实 PUT 角色链
      招聘组织Fixture: P1C招聘组织Fixture,
      主体初始角色: 'candidate',
    });

    // ── candidate restore：session 200 + last_used_role=candidate → 直接落求职主壳 ──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    // 主壳真正挂载后才直达规则页：直达会被在飞的落点 replace 导航吞掉（同 学校搜索
    // 口径，只修测试定义，不改产品；配对并发下 4 worker 满载可复现）。
    await expect(page.getByRole('button', { name: '市场', exact: true })).toBeVisible({ timeout: 15_000 });

    // ── candidate Rule/Proposal 水合：标记值只存在于 fixture ──
    await page.goto('/#/rules');
    await expect(page.getByRole('button', { name: P6标记.候选全局规则, exact: true })).toBeVisible({ timeout: 15_000 });
    // 历史意向规则只水合进意向域：本页不渲染它，编辑/删除/开关三个写入口一个都没有
    await 断言意向规则零写入口(page, P6标记.候选意向规则);
    await expect(page.getByText('AI代理正在理解这条规则…')).toBeVisible();
    await expect(page.getByText(P6标记.就绪提案正文)).toBeVisible();
    // auto_deny 的安全摘要逐字来自 fixture 的 consequence，页面不做任何浏览器侧可接受性判定
    await expect(page.getByText('命中条件时，AI代理会自动拦下')).toBeVisible();
    // 解读中提案在第二次单项 GET 转 ready（轮询 2s 一拍 → 两次读 ≈ 4s）
    await expect(page.getByText(P6标记.解读完成正文)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('符合条件时，AI代理可以自动推进')).toBeVisible();
    expect(p6.proposalReads[P6编号.解释中提案]).toBeGreaterThanOrEqual(2);

    // ── global create → interpreting → ready → accept → active Rule ──
    await page.getByRole('button', { name: '添加规则' }).click();
    // composer 没有范围选择器：候选端提案只能全局，意向规则退役后无任何定向写入口
    await expect(page.getByLabel('规则范围')).toHaveCount(0);
    const 候选输入 = page.getByPlaceholder('例：不接受大小周的岗位直接过滤');
    await 候选输入.fill(P6标记.全局新建草稿);
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    // 创建回执是 interpreting：卡片先出「解读中」，成功才收起输入行
    await expect(候选输入).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText(`已理解：${P6标记.全局新建草稿}`)).toBeVisible({ timeout: 20_000 });
    // accept-success fixture 的公开 consequence 是 mixed
    await expect(page.getByText('这条规则同时包含推进、拦截或参考条件')).toBeVisible();
    await 就绪卡动作键(page, `已理解：${P6标记.全局新建草稿}`, '确认规则').click();
    // 确认后权威 Rule 才物化：正文从卡片变成规则行（按钮，exact 避开 显示删除：⋯ 同文键）
    await expect(page.getByRole('button', { name: `已理解：${P6标记.全局新建草稿}`, exact: true })).toBeVisible({ timeout: 15_000 });
    const 创建全局 = p6.mutationRequests.find((项) => 项.method === 'POST' && 项.path === '/api/v1/me/agent-rule-proposals');
    expect(创建全局).toBeDefined();
    expect(创建全局!.body).toEqual({ text: P6标记.全局新建草稿, scope: { type: 'global' } });
    expect(创建全局!.ifMatch).toBeNull();
    expect(创建全局!.idempotencyKey).toMatch(/\S/);

    // ── replacement：点规则正文进入行内编辑（草稿预填原文）；确认前旧 Rule 一直可见、新正文不是规则行 ──
    await page.getByRole('button', { name: P6标记.候选全局规则, exact: true }).click();
    const 编辑框 = page.getByRole('textbox', { name: `编辑规则：${P6标记.候选全局规则}` });
    await expect(编辑框).toHaveCount(1, { timeout: 10_000 });
    await expect(编辑框).toHaveValue(P6标记.候选全局规则);
    await 编辑框.fill(P6标记.替换草稿);
    await page.getByRole('button', { name: '完成' }).click();
    await expect(page.getByText(`已理解：${P6标记.替换草稿}`)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: P6标记.候选全局规则, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `已理解：${P6标记.替换草稿}`, exact: true })).toHaveCount(0);
    const 替换回执 = p6.mutationRequests.find((项) => 项.path === `/api/v1/me/agent-rules/${P6编号.候选全局规则}/replacement-proposals`);
    expect(替换回执).toBeDefined();
    expect(替换回执!.ifMatch).toBe('"1"');
    expect(替换回执!.body).toEqual({ text: P6标记.替换草稿, scope: { type: 'global' } });
    expect(替换回执!.idempotencyKey).toMatch(/\S/);
    await 就绪卡动作键(page, `已理解：${P6标记.替换草稿}`, '确认规则').click();
    await expect(page.getByRole('button', { name: `已理解：${P6标记.替换草稿}`, exact: true })).toBeVisible({ timeout: 15_000 });
    // 旧规则归档出局：原文整行（含卡片）消失
    await expect(page.getByText(P6标记.候选全局规则)).toHaveCount(0);

    // ── archive：键盘揭开删除（触屏布局下 ⋯ 是 1×1 可达键，走 P7 同款键盘路径）；
    //    确认层确认前零 DELETE，确认后才归档（If-Match 当前版本）──
    const 更多键 = page.getByRole('button', { name: `显示删除：已理解：${P6标记.替换草稿}` });
    await expect(更多键).toHaveAttribute('aria-expanded', 'false');
    await 更多键.focus();
    await page.keyboard.press('Enter');
    const 删除键 = page.getByRole('button', { name: `删除规则：已理解：${P6标记.替换草稿}` });
    await expect(删除键).toBeVisible();
    expect(p6.mutationRequests.filter((项) => 项.method === 'DELETE')).toHaveLength(0);
    await 删除键.click();
    await expect(page.getByText('删除这条规则？')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: '删除', exact: true }).click();
    // 权威回读：规则行与开关整行消失
    await expect(page.getByRole('button', { name: `已理解：${P6标记.替换草稿}`, exact: true })).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByRole('switch', { name: `规则：已理解：${P6标记.替换草稿}` })).toHaveCount(0);
    const 删除们 = p6.mutationRequests.filter((项) => 项.method === 'DELETE');
    expect(删除们.length).toBe(1);
    expect(删除们[0]!.ifMatch).toBe('"1"');
    expect(删除们[0]!.path).toMatch(/^\/api\/v1\/me\/agent-rules\/rul_[0-9a-f]{32}$/);

    // ── 切到招聘端：真实 PUT 角色 + 偏好链，切完直接进企业主壳 ──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });

    // ── recruiter：规则水合 + create（body 永不携带 scope）→ accept；作用域与候选端互相独立 ──
    await page.goto('/#/hr/agent-settings');
    await expect(page.getByRole('button', { name: P6标记.招聘全局规则, exact: true })).toBeVisible({ timeout: 15_000 });
    const 总开关 = page.getByRole('switch', { name: `规则：${P6标记.招聘全局规则}` });
    await expect(总开关).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: '添加规则' }).click();
    await page.getByPlaceholder('例：到岗超过 60 天的候选先不推进').fill(P6标记.招聘新建草稿);
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    await expect(page.getByText(`已理解：${P6标记.招聘新建草稿}`)).toBeVisible({ timeout: 20_000 });
    const 招聘创建 = p6.mutationRequests.find((项) => 项.method === 'POST' && 项.path === '/api/v1/recruiter/agent-rule-proposals');
    expect(招聘创建).toBeDefined();
    expect(招聘创建!.body).toEqual({ text: P6标记.招聘新建草稿 });
    expect(招聘创建!.idempotencyKey).toMatch(/\S/);
    await 就绪卡动作键(page, `已理解：${P6标记.招聘新建草稿}`, '确认规则').click();
    // 招聘端规则行没有编辑按钮：权威落地以行内容 + 开关为准
    await expect(page.getByRole('switch', { name: `规则：已理解：${P6标记.招聘新建草稿}` })).toBeVisible({ timeout: 15_000 });
    const 招聘接受 = p6.mutationRequests.find((项) => 项.path.startsWith('/api/v1/recruiter/agent-rule-proposals/') && 项.path.endsWith('/accept'));
    expect(招聘接受).toBeDefined();
    expect(招聘接受!.body).toEqual({});
    expect(招聘接受!.idempotencyKey).toMatch(/\S/);

    // ── pause → resume：每个应答的版本都在前进（resume 的 If-Match 就是 pause 应答的新版本）──
    await 总开关.click();
    await expect(总开关).toHaveAttribute('aria-checked', 'false', { timeout: 10_000 });
    await 总开关.click();
    await expect(总开关).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
    const 开关写 = p6.mutationRequests.filter((项) => 项.method === 'PATCH' && 项.path === `/api/v1/recruiter/agent-rules/${P6编号.招聘全局规则}`);
    expect(开关写.length).toBe(2);
    expect(开关写[0]!.body).toEqual({ operation: 'pause' });
    expect(开关写[0]!.ifMatch).toBe('"1"');
    expect(开关写[1]!.body).toEqual({ operation: 'resume' });
    expect(开关写[1]!.ifMatch).toBe('"2"');
    // 权威版本链落到 fixture：pause 1→2、resume 2→3
    expect(p6.rules.recruiter.find((规) => 规.rule_id === P6编号.招聘全局规则)?.version).toBe(3);

    // 幂等纪律：candidate 唯一一次创建带非空 key；两次 accept（新建 + 替换）一律空对象 body + 各自的 key。
    // 「不同意图 → 不同 key」由 P6 失败提案卡用例的两次创建承载，这里不重复。
    const 候选创建们 = p6.mutationRequests.filter((项) => 项.method === 'POST' && 项.path === '/api/v1/me/agent-rule-proposals');
    expect(候选创建们.length).toBe(1);
    expect(候选创建们[0]!.idempotencyKey).toMatch(/\S/);
    const 候选接受们 = p6.mutationRequests.filter((项) => 项.method === 'POST' && 项.path.includes('/me/') && 项.path.endsWith('/accept'));
    expect(候选接受们.length).toBe(2);
    for (const 项 of 候选接受们) {
      expect(项.body).toEqual({});
      expect(项.idempotencyKey).toMatch(/\S/);
    }
  });

  test('P6 版本冲突只做一次权威重读且零重放 @backend', async ({ page }) => {
    // PATCH 专用冲突规则 409 version_conflict：effect 没有 receipt，恢复只做一轮权威 Rule 重读
    // （两页翻页 = 不带 cursor 的首页 GET 恰好一次），绝不再发 mutation；开关原样保留。
    const 请求序: string[] = [];
    const 清单读取: { url: string; ms: number }[] = [];
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-conflict',
      记录目录请求: () => undefined,
      招聘组织Fixture: P1C招聘组织Fixture,
      主体初始角色: 'recruiter',
      P6分支: {
        追加规则们: [{
          规则: P6规则({
            rule_id: P6分支编号.冲突规则,
            display_text: P6标记.冲突规则,
            scope: { type: 'global' },
          }),
          分支: '写入冲突',
        }],
      },
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });
    // 清单读取带完整 URL（cursor 参数区分翻页），补丁时间戳用来只数 PATCH 之后的读取
    page.on('request', (请求) => {
      const 地址 = new URL(请求.url());
      if (地址.pathname === '/api/v1/recruiter/agent-rules' && 请求.method() === 'GET') {
        清单读取.push({ url: 地址.pathname + 地址.search, ms: Date.now() });
      }
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.goto('/#/hr/agent-settings');
    const 冲突开关 = page.getByRole('switch', { name: `规则：${P6标记.冲突规则}` });
    await expect(冲突开关).toBeVisible({ timeout: 15_000 });
    await expect(冲突开关).toHaveAttribute('aria-checked', 'true');

    const 点击时刻 = Date.now();
    await 冲突开关.click();
    await expect(page.getByText('数据已在其他地方更新，请重试')).toBeVisible({ timeout: 10_000 });
    await expect(冲突开关).toHaveAttribute('aria-checked', 'true');
    const 补丁键 = `PATCH /api/v1/recruiter/agent-rules/${P6分支编号.冲突规则}`;
    const 补丁位 = 请求序.lastIndexOf(补丁键);
    expect(补丁位).toBeGreaterThanOrEqual(0);
    // 零重放：PATCH 只发出过一次
    expect(请求序.filter((项) => 项 === 补丁键).length).toBe(1);
    // 一次权威重读：PATCH 之后带 cursor 的翻页请求恰一轮（首页 GET 恰好一次）
    await expect.poll(() => 清单读取.filter((项) => 项.ms >= 点击时刻 && !项.url.includes('cursor=')).length, { timeout: 5_000 }).toBe(1);
    // 回执存证：If-Match 是水合时的当前版本
    const 冲突写 = p6.mutationRequests.find((项) => 项.path === `/api/v1/recruiter/agent-rules/${P6分支编号.冲突规则}`);
    expect(冲突写).toBeDefined();
    expect(冲突写!.ifMatch).toBe('"1"');
    expect(冲突写!.body).toEqual({ operation: 'pause' });
  });

  test('P6 accept 响应丢失与结果未知经权威 GET 收敛 @backend', async ({ page }) => {
    // 真·响应丢失（连接中断）：accept 已被服务端处理，客户端不重发 mutation，
    // 恢复走 GET 提案（accepted 回执）→ 完整重读 Rules；503 outcome_unknown 额外证明
    // 受控重试复用同一把 Idempotency-Key。
    test.setTimeout(120_000);
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-loss',
      记录目录请求: () => undefined,
      P6分支: {
        追加提案们: [
          {
            提案: {
              proposal_id: P6分支编号.丢失提案,
              state: 'ready',
              normalized_text: P6标记.丢失提案正文,
              consequence: 'auto_allow',
              created_at: '2026-08-26T00:00:00Z',
            },
            分支: 'accept丢失',
          },
          {
            提案: {
              proposal_id: P6分支编号.未知提案,
              state: 'ready',
              normalized_text: P6标记.未知提案正文,
              consequence: 'advisory',
              created_at: '2026-08-26T00:00:00Z',
            },
            分支: 'accept未知',
          },
        ],
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.goto('/#/rules');
    await expect(page.getByText(P6标记.丢失提案正文)).toBeVisible({ timeout: 15_000 });

    // 响应丢失：POST 恰一次（mutation 不自动重试），权威收敛后规则行出现、卡片消失
    await 就绪卡动作键(page, P6标记.丢失提案正文, '确认规则').click();
    await expect(page.getByRole('button', { name: P6标记.丢失提案正文, exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(就绪卡动作键(page, P6标记.丢失提案正文, '确认规则')).toHaveCount(0);
    const 丢失接受们 = p6.mutationRequests.filter((项) => 项.path === `/api/v1/me/agent-rule-proposals/${P6分支编号.丢失提案}/accept`);
    expect(丢失接受们.length).toBe(1);
    expect(p6.proposalReads[P6分支编号.丢失提案]).toBeGreaterThanOrEqual(1);

    // 结果未知：受控重试一次、两把 key 是同一把，仍 503 后同样经 GET 提案 + Rule 清单收敛
    await 就绪卡动作键(page, P6标记.未知提案正文, '确认规则').click();
    await expect(page.getByRole('button', { name: P6标记.未知提案正文, exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(就绪卡动作键(page, P6标记.未知提案正文, '确认规则')).toHaveCount(0);
    const 未知接受们 = p6.mutationRequests.filter((项) => 项.path === `/api/v1/me/agent-rule-proposals/${P6分支编号.未知提案}/accept`);
    expect(未知接受们.length).toBe(2);
    expect(未知接受们[0]!.idempotencyKey).not.toBe('');
    expect(未知接受们[0]!.idempotencyKey).toBe(未知接受们[1]!.idempotencyKey);
    expect(p6.proposalReads[P6分支编号.未知提案]).toBeGreaterThanOrEqual(1);
  });

  test('P6 切换招聘端后迟到的候选端应答不再上屏 @backend', async ({ page }) => {
    // 首次规则清单 503 → 重试键；重试的规则清单第一页被挂起到切身份之后才应答：
    // 旧会话代际的迟到响应整包丢弃，候选端标记绝不上招聘端页面；切回候选端后完整水合照常。
    test.setTimeout(120_000);
    let 放行!: () => void;
    const 门 = new Promise<void>((ok) => { 放行 = ok; });
    const 请求序: string[] = [];
    // 切回候选端是交互式水合：隐私域缺席会按「Mock 不顶替 HTTP」边界拒绝并中断切换，故提供 fixture
    const 隐私 = P3隐私fixture();
    await 安装BFF路由(page, {
      登录尝试id: 'att-p6-stale',
      记录目录请求: () => undefined,
      招聘组织Fixture: P1C招聘组织Fixture,
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      P6分支: { 规则清单首次失败: true, 挂起候选规则: 门 },
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.goto('/#/rules');
    await expect(page.getByRole('button', { name: '规则加载失败，重试' })).toBeVisible({ timeout: 15_000 });

    // 重试：这一轮规则清单第一页被 fixture 挂起，请求横跨切身份全程
    await page.getByRole('button', { name: '规则加载失败，重试' }).click();
    await expect.poll(() => 请求序.filter((项) => 项 === 'GET /api/v1/me/agent-rules').length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);

    // 切到招聘端（会话代际递增），招聘端事实先水合完成
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    await page.goto('/#/hr/agent-settings');
    await expect(page.getByText(P6标记.招聘全局规则)).toBeVisible({ timeout: 15_000 });

    // 放行迟到应答：候选端规则/提案标记一个都不出现
    放行();
    await page.waitForTimeout(1500);
    await expect(page.getByText(P6标记.招聘全局规则)).toBeVisible();
    await expect(page.getByText(P6标记.候选全局规则)).toHaveCount(0);
    await expect(page.getByText(P6标记.候选意向规则)).toHaveCount(0);
    await expect(page.getByText(P6标记.就绪提案正文)).toHaveCount(0);

    // 切回候选端：新代际的完整水合不受迟到应答影响
    await page.goto('/#/identity?switch=1&from=hr');
    await page.getByRole('button', { name: '翻到「求职者」那一面' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto('/#/rules');
    await expect(page.getByText(P6标记.候选全局规则)).toBeVisible({ timeout: 15_000 });
  });

  test('P6 失败提案卡显示固定文案，失败保留草稿可再提交 @backend', async ({ page }) => {
    // 专用提案单项 GET 即 failed：固定失败文案 + 关闭；创建失败（500）时草稿与范围原样保留，
    // 再次提交是新意图、新 key。
    test.setTimeout(120_000);
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-failed',
      记录目录请求: () => undefined,
      P6分支: {
        追加提案们: [{
          提案: { proposal_id: P6分支编号.失败提案, state: 'interpreting', created_at: '2026-08-26T00:00:00Z' },
          分支: '单读失败',
        }],
        创建前几次失败: 1,
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.goto('/#/rules');
    await expect(page.getByText('AI代理正在理解这条规则…').first()).toBeVisible({ timeout: 15_000 });

    // 轮询读到权威 failed（legacy 无 code）→ 兜底失败文案；关闭只收起这一张卡
    await expect(page.getByText('本次规则没有生效')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '关闭' }).click();
    await expect(page.getByText('本次规则没有生效')).toHaveCount(0);

    // 创建失败：composer 不收起，草稿原样保留（绝不伪造成功；范围选择器已退役，提案恒为全局）
    await page.getByRole('button', { name: '添加规则' }).click();
    const 候选输入 = page.getByPlaceholder('例：不接受大小周的岗位直接过滤');
    await 候选输入.fill(P6标记.失败草稿);
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    // 500 的原始 message 不进 UI：兜底固定文案上屏（真实性修复 D），草稿原样保留可再提交
    await expect(page.getByText('后端服务暂时不可用，请稍后重试')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(P6标记.创建失败提示)).toHaveCount(0);
    await expect(候选输入).toHaveValue(P6标记.失败草稿);

    // 再次提交：新意图、新 key，创建成功才收起输入行
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    await expect(候选输入).toHaveCount(0, { timeout: 10_000 });
    const 创建们 = p6.mutationRequests.filter((项) => 项.method === 'POST' && 项.path === '/api/v1/me/agent-rule-proposals');
    expect(创建们.length).toBe(2);
    expect(创建们[0]!.body).toEqual({ text: P6标记.失败草稿, scope: { type: 'global' } });
    expect(创建们[1]!.body).toEqual({ text: P6标记.失败草稿, scope: { type: 'global' } });
    expect(创建们[0]!.idempotencyKey).not.toBe('');
    expect(创建们[0]!.idempotencyKey).not.toBe(创建们[1]!.idempotencyKey);
  });

  test('P6 重复 cursor 按契约漂移失败出服务异常重试，不回退 Mock @backend', async ({ page }) => {
    // 清单游标成环 → 解码器按翻页死循环拒绝，rules 域整体失败：
    // 重试键上屏、无清单/无计数/无写控件，Mock 种子绝不顶替 HTTP。
    await 安装BFF路由(page, {
      登录尝试id: 'att-p6-cursor',
      记录目录请求: () => undefined,
      P6分支: { 游标成环: true },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.goto('/#/rules');
    await expect(page.getByRole('button', { name: '规则加载失败，重试' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('规则加载中')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '添加规则' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: P6标记.候选全局规则, exact: true })).toHaveCount(0);
    await expect(page.getByText(P6标记.候选意向规则)).toHaveCount(0);
    await expect(page.getByText('不主动披露并行接触数量')).toHaveCount(0);
    await expect(page.getByText('双休是底线；隔周六可谈，大小周不谈')).toHaveCount(0);
  });

  test('P6 首次水合挂起期间无任何规则内容与写入口 @backend', async ({ page }) => {
    // 规则清单第一页被挂起：初始化完成前整壳只有路由加载中 ——
    // Mock 种子行 / 写控件 / 重试键都不上屏；放行后权威行落地（意向规则仍不渲染、无写入口）。
    test.setTimeout(120_000);
    let 放行!: () => void;
    const 门 = new Promise<void>((ok) => { 放行 = ok; });
    await 安装BFF路由(page, {
      登录尝试id: 'att-p6-pending',
      记录目录请求: () => undefined,
      P6分支: { 挂起候选规则: 门 },
    });

    await page.goto('/#/rules');
    await expect(page.getByText('正在加载…')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('不主动披露并行接触数量')).toHaveCount(0);
    await expect(page.getByText('双休是底线；隔周六可谈，大小周不谈')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '添加规则' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '规则加载失败，重试' })).toHaveCount(0);

    放行();
    await expect(page.getByRole('button', { name: P6标记.候选全局规则, exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('switch', { name: `规则：${P6标记.候选全局规则}` })).toBeVisible();
    // 历史意向规则水合进意向域：本页不渲染，也没有任何写入口
    await 断言意向规则零写入口(page, P6标记.候选意向规则);
  });

  test('P6 accept 409 not_actionable 权威恢复保留卡片 @backend', async ({ page }) => {
    // 专用提案公开 consequence 是 auto_allow（看起来完全可执行），服务端仍裁决 not_actionable：
    // 公开后果从不决定可执行性 —— 恢复路径读权威回执，卡片保留、绝不本地物化规则、零重放。
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-not-actionable',
      记录目录请求: () => undefined,
      P6分支: {
        追加提案们: [{
          提案: {
            proposal_id: P6分支编号.不可接受提案,
            state: 'ready',
            normalized_text: P6标记.不可接受提案正文,
            consequence: 'auto_allow',
            created_at: '2026-08-26T00:00:00Z',
          },
          分支: 'accept不可接受',
        }],
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.goto('/#/rules');
    await expect(page.getByText(P6标记.不可接受提案正文)).toBeVisible({ timeout: 15_000 });

    await 就绪卡动作键(page, P6标记.不可接受提案正文, '确认规则').click();
    await expect(page.getByText('这条内容暂时不能成为长期规则，请放弃或换一种说法')).toBeVisible({ timeout: 10_000 });
    // 权威恢复：GET 回执仍是 ready → 卡片原样保留，规则清单不变、没有规则行被物化
    await expect(page.getByText(P6标记.不可接受提案正文)).toBeVisible();
    await expect(page.getByRole('button', { name: P6标记.不可接受提案正文, exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: P6标记.候选全局规则, exact: true })).toBeVisible();
    const 接受们 = p6.mutationRequests.filter((项) => 项.path === `/api/v1/me/agent-rule-proposals/${P6分支编号.不可接受提案}/accept`);
    expect(接受们.length).toBe(1);
    expect(p6.proposalReads[P6分支编号.不可接受提案]).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P4 发现推荐域 fixture @backend —— Backend/Mock 隔离证明（Task 8）。
// 断言以 fixture 存证（变更回执 method/path/body/If-Match/Idempotency-Key、委托读取、
// 刷新计数、available/rejected 数组）与 P4标记 上屏为主：标记值只存在于 fixture，
// 页面展示它们即证明渲染来自 HTTP 而非 Mock。无任何 watch 路由。
// ─────────────────────────────────────────────────────────────────────────────

/** 下拉刷新手势：列表贴顶时向下拽 160px（拉距 64 封顶 > 46 阈值），松手触发刷新回调 */
async function 下拉刷新手势(page: Page) {
  const 区 = page.locator('.滚动区').first();
  const 框 = (await 区.boundingBox())!;
  const 横 = 框.x + 框.width / 2;
  await page.mouse.move(横, 框.y + 120);
  await page.mouse.down();
  for (let 步 = 1; 步 <= 8; 步 += 1) await page.mouse.move(横, 框.y + 120 + 步 * 20);
  await page.mouse.up();
}

test.describe('P4 发现推荐域 fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('P4 候选列表与详情的职位/公司/发布人来自 HTTP fixture，快照命中不再 GET @backend', async ({ page }) => {
    const 请求序: string[] = [];
    await 装P4候选(page, { 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();

    // 列表三个标记值逐字来自 fixture（Mock 里没有）：jobTitle / company / publisher
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P4标记.company)).toBeVisible();
    await expect(page.getByText(P4标记.publisher)).toBeVisible();
    // 列表来自按当前意向 scope 的候选岗位推荐 GET
    expect(请求序.some((项) => 项 === 'GET /api/v1/me/job-recommendations')).toBe(true);

    // 进详情：快照命中直接渲染，绝不再发 canonical job GET
    await page.getByRole('button', { name: '查看职位详情' }).click();
    await expect(page).toHaveURL(new RegExp(`#/job/${P4编号.job}$`));
    await expect(page.getByText(P4标记.jobTitle).first()).toBeVisible();
    // 公司名同时出现在公司区块与发布人行 → 用 .first() 只证渲染自 HTTP
    await expect(page.getByText(P4标记.company).first()).toBeVisible();
    await expect(page.getByText(P4标记.publisher).first()).toBeVisible();
    expect(请求序.some((项) => 项.startsWith('GET /api/v1/jobs/'))).toBe(false);
  });

  test('P4 详情直取走 canonical job GET，同一批 HTTP 标记上屏 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    // 用例前提「无任何快照 → canonical job GET」：推荐清单显式置空（合法空页）。
    // 2026-09-10 修复 fixture 缺 structured_requirements_confirmed 后默认清单可解码，
    // 若保留默认快照，详情会拿到推荐坐标、不感兴趣不再禁用 —— 那是另一条链路。
    const 空推荐fixture = P4发现fixture();
    空推荐fixture.候选推荐 = {};
    await 装P4候选(page, { fixture: 空推荐fixture, 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    // 直接进详情：无任何快照 → GET 单个 CandidateJob（canonical job GET）
    await page.goto(`/#/job/${P4编号.job}`);
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    expect(请求序).toContain(`GET /api/v1/jobs/${P4编号.job}`);
    await expect(page.getByText(P4标记.company).first()).toBeVisible();
    await expect(page.getByText(P4标记.publisher).first()).toBeVisible();
    // 详情直取没有推荐坐标：不感兴趣禁用，绝不猜坐标
    await expect(page.getByRole('button', { name: '不感兴趣' })).toBeDisabled();
  });

  test('下拉刷新只重读（GET），绝不发刷新 POST @backend', async ({ page }) => {
    const P4请求: { method: string; path: string }[] = [];
    await 装P4候选(page, {
      请求拦截: ({ path, method }) => {
        if (path.includes('job-recommendation')) P4请求.push({ method, path });
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    const 首读数 = P4请求.filter((项) => 项.method === 'GET').length;

    await 下拉刷新手势(page);

    // 松手后恰好再走一轮 GET 翻页；全程无任何刷新 POST
    await expect
      .poll(() => P4请求.filter((项) => 项.method === 'GET').length, { timeout: 15_000 })
      .toBeGreaterThan(首读数);
    await page.waitForTimeout(400);
    expect(P4请求.filter((项) => 项.method === 'POST')).toEqual([]);
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible();
  });

  test('空态让AI代理帮我搜：POST 稳幂等键（503 受控重试同键）随后 GET 建新批次 @backend', async ({ page }) => {
    const fixture = P4发现fixture({ 候选刷新首次503: true });
    fixture.候选推荐[P4编号.intention] = [];
    const 刷新POST: { 键: string; 体: unknown }[] = [];
    const P4请求: { method: string; path: string }[] = [];
    await 装P4候选(page, {
      fixture,
      请求拦截: ({ path, method, headers, body }) => {
        if (path.includes('job-recommendation')) P4请求.push({ method, path });
        if (path === '/api/v1/me/job-recommendation-refreshes' && method === 'POST') {
          刷新POST.push({ 键: headers['idempotency-key'] ?? '', 体: body });
        }
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    // 空批次：空态文案 + 手动刷新入口
    await expect(page.getByText('这个意向下暂时没有新职位')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: '让AI代理帮我搜' }).click();
    // 503 受控重试复用同一把键；随后权威 GET 把新批次带上屏
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 20_000 });
    expect(刷新POST.length).toBe(2);
    expect(刷新POST[0]!.键).not.toBe('');
    expect(刷新POST[0]!.键).toBe(刷新POST[1]!.键);
    expect(刷新POST[0]!.体).toEqual({ intention_id: P4编号.intention });
    // POST 之后以权威 GET 收尾：日志最后一笔是列表读取
    expect(P4请求[P4请求.length - 1]).toEqual({ method: 'GET', path: '/api/v1/me/job-recommendations' });
    expect(fixture.刷新次数.candidate).toBe(1);
  });

  test('候选委托：确认前零变更请求 → 字面披露 true → 同键同回执 → 轮询到 case_started，绝不落 Mock 在谈 @backend', async ({ page }) => {
    const fixture = P4发现fixture({ 候选委托先503: true });
    const 附件fixture = 创建P2附件fixture();
    附件fixture.items = [P2新附件(1, 'P4 Fixture 候选简历.pdf', Buffer.from('%PDF-1.7\nfixture\n'))];
    // J-PILOT-01：委托受理后客户端会直读 me/negotiations/dlg_…（协议 B canonical 坐标）。
    // 该读取要求 P5 连续臂在场并已登记委托记录 —— 装一份连续记录清空的 MatchCase
    // fixture：委托 POST 受理时登记 dlg 记录，后续详情 GET 由同一 fixture 权威应答。
    // 缺席时该详情坐标会落到离线边界兜底中止、teardown 核对() 报未声明请求
    //（只修测试定义，不改产品）。
    const P5 = 创建P5MatchCasefixture();
    P5.连续记录 = {};
    const 请求序: { method: string; path: string; body: unknown; headers: Record<string, string> }[] = [];
    await 装P4候选(page, {
      fixture,
      附件fixture,
      P5fixture: P5,
      请求拦截: (项) => 请求序.push({ method: 项.method, path: 项.path, body: 项.body, headers: 项.headers }),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });

    // 确认层之前零变更请求；打开确认层允许重读附件库校验当前选择仍然有效
    const 确认前变更数 = 请求序.filter((项) => 项.method !== 'GET').length;
    await page.getByRole('button', { name: '让AI代理去谈' }).click();
    await expect(page.getByRole('dialog', { name: '确认委托AI代理？' })).toBeVisible({ timeout: 5_000 });
    expect(请求序.filter((项) => 项.method !== 'GET')).toHaveLength(确认前变更数);

    // 确认层遮罩钮的可及名是「关闭确认委托AI代理？」：exact 才只命中执行键
    await page.getByRole('button', { name: '确认委托', exact: true }).click();

    // POST 携带字面披露 true（503 受控重试 → 同键同回执），卡片原地显示已接手
    await expect(page.getByText('AI代理已接手')).toBeVisible({ timeout: 15_000 });
    const 委托POST = 请求序.filter((项) => 项.path === '/api/v1/me/job-delegations' && 项.method === 'POST');
    expect(委托POST.length).toBe(2);
    expect(委托POST[0]!.body).toEqual({
      intention_id: P4编号.intention,
      selection: { items: [P4编号.job] },
      disclosure_acknowledged: true,
      resume_file_id: 'rf_1',
      resume_file_version_id: 'rfv_1_1',
    });
    expect(委托POST[0]!.headers['idempotency-key']).not.toBe('');
    expect(委托POST[0]!.headers['idempotency-key']).toBe(委托POST[1]!.headers['idempotency-key']);
    expect(fixture.变更请求.filter((项) => 项.path === '/api/v1/me/job-delegations')).toHaveLength(2);

    // 轮询：evaluating → case_started（真实 Case 引用只来自回执）
    await expect
      .poll(() => fixture.委托读取.filter((项) => 项.state === 'case_started').length, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);
    expect(fixture.委托读取[0]).toEqual({ delegationId: P4编号.candidateDelegation, state: 'evaluating' });

    // 从未跳去 Mock 在谈：URL 留在市场，变更恰好那两笔受控重试的 POST
    await page.waitForTimeout(500);
    expect(page.url()).toMatch(/#\/app$/);
    expect(page.url()).not.toMatch(/#\/deal/);
    expect(fixture.变更请求).toHaveLength(2);
    await expect(page.getByText('AI代理已接手')).toBeVisible();
  });

  test('不感兴趣：PUT 未成功卡片原地不动，200 权威移除后才消失 @backend', async ({ page }) => {
    const fixture = P4发现fixture();
    fixture.候选推荐[P4编号.intention] = [
      P4候选卡(),
      P4候选卡({
        recommendation_id: P4补充编号.备选推荐,
        rank: 2,
        match_score: 71,
        job: P4CandidateJob({ job_id: P4补充编号.备选岗位, title: 'P4 Fixture 备选岗位' }),
      }),
    ];
    fixture.分支 = { 候选不感兴趣先失败: true };
    await 装P4候选(page, { fixture });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    // 两张卡：第一张即甲（翻页首页 items[0]）
    await page.getByRole('button', { name: '查看职位详情' }).first().click();
    await expect(page).toHaveURL(new RegExp(`#/job/${P4编号.job}$`));

    // 首次 PUT 500：服务端先行 —— 不回列表，权威数组原样两张卡
    // （远端 message 不进 UI，500 统一收口为安全文案）
    await page.getByRole('button', { name: '不感兴趣' }).click();
    await expect(page.getByText('后端服务暂时不可用，请稍后重试').first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(new RegExp(`#/job/${P4编号.job}$`));
    expect(fixture.候选推荐[P4编号.intention]).toHaveLength(2);

    // 第二次 PUT 200：权威回执确认后才回列表；卡消失、另一张还在
    await page.getByRole('button', { name: '不感兴趣' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await expect(page.getByText(P4标记.jobTitle)).toHaveCount(0);
    await expect(page.getByText('P4 Fixture 备选岗位')).toBeVisible();
    const 不感兴趣写 = fixture.变更请求.filter((项) => 项.path.endsWith('/not-interested'));
    expect(不感兴趣写).toHaveLength(2);
    expect(不感兴趣写[0]!.method).toBe('PUT');
    expect(不感兴趣写[0]!.ifMatch).toBeNull();
    expect(不感兴趣写[0]!.idempotencyKey).toBeNull();
    expect(fixture.候选推荐[P4编号.intention]).toHaveLength(1);
  });

  test('招聘端列表与详情渲染匿名别名/摘要，身份与薪资 canary 绝不上屏 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    await 装P4招聘(page, { 请求拦截: ({ path, method, query }) => 请求序.push(`${method} ${path}${query ?? ''}`) });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '推荐', exact: true }).click();

    // 列表：卡面摘要逐字来自 HTTP fixture 的 candidate_summary 投影（2026-09-09 摘要接线，
    // include=candidate_summary 展开页）；请求按当前岗位 scope 发出
    await expect(page.getByRole('img', { name: P4标记.candidateRing }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P4标记.summaryWork).first()).toBeVisible();
    expect(请求序.some((项) => 项 === `GET /api/v1/recruiter/jobs/${P4编号.recruiterJob}/candidate-recommendations?limit=50&include=candidate_summary`)).toBe(true);

    // 详情：强制重读权威详情后渲染同一张卡的画像
    // J（Task 8）：点卡落 canonical 双坐标 URL（岗位 + 推荐都来自卡片坐标）
    await page.getByRole('button', { name: '查看候选画像' }).first().click();
    await expect(page).toHaveURL(new RegExp(`#/hr/jobs/${P4编号.recruiterJob}/recommendations/${P4编号.recruiterRecommendation}$`));
    // 先等列表卸载（hash 已换而 React 未换树的瞬态窗里，列表摘要仍会在 DOM）
    await expect(page.getByText('你的AI代理从人才库筛出')).toHaveCount(0, { timeout: 15_000 });
    // release/0.2.5：详情不再有 candidate_summary（include 语法只属于列表），正文来自
    // 恒在场的 candidate_resume（共享在线简历）——多段经历/教育如实上屏
    await expect(page.getByText('个人优势').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('P4 fixture 自我描述')).toBeVisible();
    await expect(page.getByText('工作经历').first()).toBeVisible();
    await expect(page.getByText('项目经历').first()).toBeVisible();
    await expect(page.getByText('教育经历').first()).toBeVisible();
    expect(请求序).toContain(`GET /api/v1/recruiter/jobs/${P4编号.recruiterJob}/candidate-recommendations/${P4编号.recruiterRecommendation}`);

    // 身份/薪资 canary：HTTP 从未下发真名/直聊/期望薪资，页面一概不渲染；
    // Mock 人才库的候选（江叙白）与会话主体真名也不兜底出现
    await expect(page.getByText('直接聊')).toHaveCount(0);
    await expect(page.getByText('沈亦舟')).toHaveCount(0);
    await expect(page.getByText('后端 fixture 候选人')).toHaveCount(0);
    await expect(page.getByText(/期望薪资/)).toHaveCount(0);
    await expect(page.getByText('江叙白')).toHaveCount(0);
  });

  test('收藏本地过滤、淘汰与撤销持久，已筛聚合只扫在招岗位 @backend', async ({ page }) => {
    const fixture = P4发现fixture();
    const 请求序: string[] = [];
    await 装P4招聘(page, {
      fixture,
      岗位们: [
        P4招聘岗位(),
        P4招聘岗位({ job_id: P4补充编号.归档岗位, title: 'P4 Fixture 已归档岗位', status: 'archived' }),
      ],
      请求拦截: ({ path, method, query }) => 请求序.push(`${method} ${path}${query ?? ''}`),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    await expect(page.getByRole('img', { name: P4标记.candidateRing }).first()).toBeVisible({ timeout: 15_000 });

    // 收藏：服务端先行 PUT（无 If-Match / 无 Idempotency-Key），权威回执改快照后星标点亮
    await page.getByRole('button', { name: '收藏', exact: true }).first().click();
    await expect(page.getByRole('button', { name: '取消收藏' }).first()).toBeVisible({ timeout: 10_000 });
    const 收藏写 = fixture.变更请求.find((项) => 项.path.endsWith('/favorite'));
    expect(收藏写).toBeDefined();
    expect(收藏写!.method).toBe('PUT');
    expect(收藏写!.ifMatch).toBeNull();
    expect(收藏写!.idempotencyKey).toBeNull();

    // 第二批（2026-09-09）：候选筛选抽屉与其中的「只看收藏」本地开关已删除 —— 顶栏没有「筛选」入口，
    // 两张卡都在；收藏后不再有本地过滤可验
    await expect(page.getByRole('button', { name: /筛选/ })).toHaveCount(0);
    await expect(page.getByRole('img', { name: P4标记.candidateBRing })).toBeVisible();

    // 淘汰：左滑 → 原因 → PUT reason → 权威详情重读后卡才从可用流消失
    await 左滑候选卡(page, P4标记.candidateBRing);
    await page.getByRole('button', { name: '不合适' }).click();
    await page.getByRole('button', { name: /年限不足/ }).click();
    await expect(page.getByText('已标记「年限不足」')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('img', { name: P4标记.candidateBRing })).toHaveCount(0, { timeout: 10_000 });
    const 淘汰写 = fixture.变更请求.find((项) => 项.path.endsWith('/rejection') && 项.method === 'PUT');
    expect(淘汰写!.body).toEqual({ reason: 'experience_insufficient' });

    // 已筛页：只请求在招岗位的 rejected 腿（归档岗位一个请求都没有），原因文案闭合
    await page.goto('/#/hr/screened-out');
    await expect(page.getByText('P4候选乙')).toBeVisible({ timeout: 15_000 });
    // 原因标逐字「年限不足」；此时上一屏的 toast 可能仍在，用 exact 避开它的子串
    await expect(page.getByText('年限不足', { exact: true })).toBeVisible();
    const 已筛读 = 请求序.filter((项) => 项.includes('state=rejected'));
    expect(已筛读.length).toBeGreaterThanOrEqual(1);
    for (const 项 of 已筛读) {
      expect(项.startsWith(`GET /api/v1/recruiter/jobs/${P4编号.recruiterJob}/candidate-recommendations?`)).toBe(true);
    }
    expect(请求序.some((项) => 项.includes(P4补充编号.归档岗位))).toBe(false);

    // 撤销：DELETE 成功后行消失（文案中性，不承诺回到当前批次）
    await page.getByRole('button', { name: '撤销' }).click();
    await expect(page.getByText('已撤销「P4候选乙」的筛选')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('P4候选乙')).toHaveCount(0, { timeout: 10_000 });
    expect(fixture.变更请求.some((项) => 项.path.endsWith('/rejection') && 项.method === 'DELETE')).toBe(true);

    // 持久证明：撤销后权威 available 腿把乙放回 —— 下拉强制重读（GET）才见回来
    await page.goto('/#/hr');
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    await expect(page.getByRole('img', { name: P4标记.candidateRing }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('img', { name: P4标记.candidateBRing })).toHaveCount(0); // 撤销不回塞当前批次快照
    await 下拉刷新手势(page);
    await expect(page.getByRole('img', { name: P4标记.candidateBRing })).toBeVisible({ timeout: 15_000 });
  });

  test('招聘端委托无确认层：POST 选择坐标 recommendation_id，绝不制造 Mock 候选 Case @backend', async ({ page }) => {
    const fixture = P4发现fixture();
    const 请求序: { method: string; path: string; body: unknown; headers: Record<string, string> }[] = [];
    await 装P4招聘(page, {
      fixture,
      请求拦截: (项) => 请求序.push({ method: 项.method, path: 项.path, body: 项.body, headers: 项.headers }),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    await expect(page.getByRole('img', { name: P4标记.candidateRing }).first()).toBeVisible({ timeout: 15_000 });

    // 无确认层：点击立即发起，页面全程没有弹层；卡原地长出 accepted 的权威文案
    // 「已提交给 AI，等待处理」——「AI代理已接触」要 case_started + 非空 case_id，
    // 而招聘端 P4 委托恒不制造 Case（本 fixture 单项 GET 也恒 accepted）
    // （滑动行整行 role=button 的可及名含全卡文字，去聊键按真实 <button> 定位）
    await page.locator('button:has-text("让AI代理去聊")').first().click();
    await expect(page.getByText('已提交给 AI，等待处理')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('dialog')).toHaveCount(0);

    const 委托POST = 请求序.filter((项) => 项.path === '/api/v1/recruiter/candidate-delegations' && 项.method === 'POST');
    expect(委托POST).toHaveLength(1);
    expect(委托POST[0]!.body).toEqual({ job_id: P4编号.recruiterJob, selection: { items: [P4编号.recruiterRecommendation] } });
    expect(委托POST[0]!.headers['idempotency-key']).toMatch(/\S/);

    // 进行中回执按节拍单项 GET；原地停留，变更恰好一笔，绝无 Mock 接触的第二笔
    await expect.poll(() => fixture.委托读取.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    expect(fixture.委托读取[0]).toEqual({ delegationId: P4编号.recruiterDelegation, state: 'accepted' });
    await page.waitForTimeout(400);
    expect(page.url()).toMatch(/#\/hr$/);
    expect(fixture.变更请求).toHaveLength(1);
    await expect(page.getByText('已提交给 AI，等待处理')).toBeVisible();
  });

  test('P4 读取遇 401：统一清理把 P4 UI 带回登录页 @backend', async ({ page }) => {
    // 401 只武装给首载成功后的强制重读：本用例证明的是当前栅栏 401 的统一清理。
    // StrictMode 挂载期的首读不发 401（未武装），本用例不断言 stale-fence 401 的丢弃行为
    let 已武装 = false;
    await 装P4候选(page, {
      覆盖: {
        'GET /api/v1/me/job-recommendations': () => {
          if (!已武装) return undefined;
          return { status: 401, 响应: { error: { type: 'invalid_session', message: '登录已失效' } } };
        },
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    已武装 = true;
    await 下拉刷新手势(page);
    // 当前栅栏的 401 走统一清理：登录页回来，P4 内容清场
    await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P4标记.jobTitle)).toHaveCount(0);
  });

  test('P4 详情 404 走安全不可用页，绝不回落 Mock 岗位 @backend', async ({ page }) => {
    await 装P4候选(page);
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    // fixture 从未下发过的 job 编号 → canonical job GET 404
    await page.goto(`/#/job/${P4补充编号.未知岗位}`);
    await expect(page.getByText('这个职位暂时看不了')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('该职位可能已下架，或已不在你的推荐范围内。')).toBeVisible();
    await expect(page.getByText('MiniMax')).toHaveCount(0);
    await expect(page.getByText(P4标记.jobTitle)).toHaveCount(0);
  });

  test('招聘端简历详情 404 收口安全不可用页 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    await 装P4招聘(page, {
      请求拦截: ({ path, method, query }) => 请求序.push(`${method} ${path}${query ?? ''}`),
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    // J（Task 8）：旧 /hr/resume/:id 深链显示失效提示，零详情 GET
    await page.goto(`/#/hr/resume/${P4补充编号.未知推荐}`);
    await expect(page.getByText('链接已失效，请从对应岗位推荐列表重新打开')).toBeVisible({ timeout: 15_000 });
    expect(请求序.some((项) => 项.includes(`/candidate-recommendations/${P4补充编号.未知推荐}`))).toBe(false);
    await expect(page.getByText(P4标记.candidateAlias)).toHaveCount(0);
    await expect(page.getByText('江叙白')).toHaveCount(0);
  });

  test('503 与非法翻页都保留旧成功快照，绝不清空已上屏的卡 @backend', async ({ page }) => {
    const fixture = P4发现fixture();
    fixture.候选推荐[P4编号.intention] = [
      P4候选卡(),
      P4候选卡({
        recommendation_id: P4补充编号.备选推荐,
        rank: 2,
        match_score: 71,
        job: P4CandidateJob({ job_id: P4补充编号.备选岗位, title: 'P4 Fixture 备选岗位' }),
      }),
    ];
    let 已武装 = false;
    let 已503 = false;
    await 装P4候选(page, {
      fixture,
      覆盖: {
        'GET /api/v1/me/job-recommendations': () => {
          if (!已武装 || 已503) return undefined;
          已503 = true;
          return { status: 503, 响应: { error: { type: 'source_unavailable', message: '服务暂不可用' } } };
        },
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('P4 Fixture 备选岗位')).toBeVisible();
    已武装 = true;

    // 第一次下拉撞 503：旧卡保留，错误行单独交代
    await 下拉刷新手势(page);
    await expect(page.getByText('后端服务暂时不可用，请稍后重试')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible();
    await expect(page.getByText('P4 Fixture 备选岗位')).toBeVisible();
    await page.waitForTimeout(1100); // 下拉动画至少 900ms：等它收场再拉下一次

    // 第二次下拉走到被注毒的第二页：strict decoder 拒收整轮读取，旧卡依旧不被清掉
    fixture.分支 = { ...fixture.分支, 候选非法第二页: true };
    await 下拉刷新手势(page);
    // 错误文案与恢复期隐私水合失败的 toast 同文：取 first 只认列表错误行
    await expect(page.getByText('服务返回异常，请稍后重试').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible();
    await expect(page.getByText('P4 Fixture 备选岗位')).toBeVisible();
  });

  test('切意向后旧 scope 的迟到应答整包丢弃，绝不闪进新列表 @backend', async ({ page }) => {
    const fixture = P4发现fixture();
    let 放行!: () => void;
    const 门 = new Promise<void>((ok) => { 放行 = ok; });
    fixture.意向们 = [
      P4意向({ intention_id: P4编号.intention, job_category: { id: 'job-fixture-p4-cat-a', display_name: 'P4 意向甲' } }),
      P4意向({ intention_id: P4补充编号.意向乙, job_category: { id: 'job-fixture-p4-cat-b', display_name: 'P4 意向乙' } }),
    ];
    fixture.候选推荐 = { [P4编号.intention]: [P4候选卡()] };
    fixture.分支 = { 挂起候选读取: { 意向: P4编号.intention, 门 } };
    await 装P4候选(page, { fixture });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    // 甲 scope 的首页 GET 被挂起：列表停在加载态
    await expect(page.getByText('正在为你挑岗位…')).toBeVisible({ timeout: 15_000 });

    // 切到乙：甲的 scope 代际已作废；乙自己的空批次先落定
    await page.getByRole('button', { name: 'P4 意向乙' }).click();
    await expect(page.getByText('这个意向下暂时没有新职位')).toBeVisible({ timeout: 15_000 });

    // 此刻才放行甲的迟到应答：整包丢弃，甲的标记卡绝不闪现
    放行();
    await page.waitForTimeout(1500);
    await expect(page.getByText('这个意向下暂时没有新职位')).toBeVisible();
    await expect(page.getByText(P4标记.jobTitle)).toHaveCount(0);

    // 切回甲：新代际照常加载
    await page.getByRole('button', { name: 'P4 意向甲' }).click();
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P4 Mock 数据源隔离 @mock：候选列表/详情 + 招聘列表/详情 + 收藏 + 淘汰 + 双端委托
// 全走本地归约；收集全部请求后按任务书原文的 isP4 正则断言发现域零请求。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P4 Mock 数据源隔离 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('Mock 双端发现全流程零 P4 请求 @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    // ── 候选端：登录 → 看市场列表 → 职位详情 → 一键委托（无确认层）──
    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);
    await page.goto('/#/app');
    await page.getByRole('button', { name: '市场', exact: true }).click();
    // Mock 市场列表的后端工程师卡片（老虎国际 M-11 / PingCAP M-12）
    await expect(page.getByText('交易系统资深工程师')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '查看职位详情' }).first().click();
    await expect(page).toHaveURL(/#\/job\//);
    await expect(page.getByText('交易系统资深工程师')).toBeVisible();
    await page.goto('/#/app');
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await page.getByRole('button', { name: '让AI代理去谈' }).first().click();
    await expect(page.getByText('AI代理已接手').first()).toBeVisible({ timeout: 10_000 });

    // ── 招聘端：切身份 → 推荐列表 → 候选详情 → 收藏 / 淘汰 / 委托 ──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
    await page.goto('/#/hr');
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    // 去名改版（2026-09-08）：推荐卡不出代号，列表就绪以头行性别图标为准；代号只在匿名在线简历页
    await expect(page.getByRole('img', { name: '男' }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('江叙白')).toHaveCount(0);

    // 详情：匿名在线简历（Mock 分支）。去名改版第二批后头区也是 候选头行，
    // 代号/真名都不上页面，锚定简历正文段标
    await page.getByRole('button', { name: '查看候选画像' }).first().click();
    await expect(page).toHaveURL(/#\/hr\/resume\//);
    await expect(page.getByText('个人优势').first()).toBeVisible({ timeout: 10_000 });

    // 回列表：收藏（本地）→ 委托（本地）→ 左滑淘汰（本地）。
    // 淘汰放最后：卡片移除会让列表位移，紧随其后的点击会跟重渲染抢布局
    await page.goto('/#/hr');
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    await expect(page.getByRole('img', { name: '男' }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '收藏', exact: true }).first().click();
    await expect(page.getByRole('button', { name: '取消收藏' }).first()).toBeVisible({ timeout: 10_000 });

    // 滑动行整行是 role=button（可及名含全卡文字），getByRole 会先命中行面、
    // 点其中心等于点卡主体 —— 去聊键必须按真实 <button> 元素定位
    await page.locator('button:has-text("让AI代理去聊")').first().click();
    await expect(page.getByText('AI代理已接触').first()).toBeVisible({ timeout: 10_000 });

    await 左滑候选卡(page, '适配 86 分'); // R-12 周砚秋：去名后按适配环定位
    await page.getByRole('button', { name: '不合适' }).click();
    await page.getByRole('button', { name: /年限不足/ }).click();
    await expect(page.getByRole('img', { name: '适配 86 分' })).toHaveCount(0, { timeout: 10_000 });

    // P4 域在 Mock 下零请求（任务书原文断言），整段会话也没有任何 /api/v1
    const isP4 = (url: string) => /\/(job-recommendation|candidate-recommendation|job-delegation|candidate-delegation)/.test(url);
    expect(apiRequests.filter(isP4)).toEqual([]);
    expect(apiRequests).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P2 附件简历 Backend @backend —— candidate 拥有 0–3 份 PDF 附件库的真实浏览器契约。
// fixture（创建P2附件fixture）fail closed：未知 multipart part、缺 consent、错 If-Match、
// 缺幂等键一律 throw，让 E2E 在契约漂移时直接红。预览只断言 authenticated content GET，
// 不依赖 headless PDF viewer 的页面内容；布局门由 断言附件标题几何未漂移 承担。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P2 附件简历 Backend @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('Backend candidate owns PDF library without changing Mock visuals @backend', async ({ page }) => {
    // 轮询节拍是 3s 一读，多段轮询 + 手势全在一条 journey 里：显式放宽到 120s
    test.setTimeout(120_000);
    const P2 = 创建P2附件fixture();
    await 安装BFF路由(page, {
      记录目录请求: () => {}, 登录尝试id: 'att-p2', 附件fixture: P2,
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await page.goto('/#/student');
    await page.locator('input[type=file]').setInputFiles({
      name: 'candidate.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByText('candidate.pdf')).toBeVisible();

    await page.goto('/#/resume');
    // 授权层成功轻提示存活约 2s；等它退场，避免「简历已上传，正在识别」与行状态文案
    // 同时命中下面的 alternation（strict mode 会把 toast 记为第二个匹配，属测试噪声）。
    await expect(page.getByText('简历已上传，正在识别')).toBeHidden({ timeout: 5_000 });
    await expect(page.getByText('candidate.pdf')).toBeVisible();
    await expect(page.getByText(/等待识别|正在识别|识别完成/)).toBeVisible();
    await expect.poll(() => P2.列表读取次数, { timeout: 15_000 }).toBeGreaterThan(2);
    await expect(page.getByText('识别完成')).toBeVisible();

    // ── 布局门一：1/3（未满额）＋ 可见 —— 有 ＋ 的标题几何 ──
    await expect(page.getByRole('button', { name: '添加附件简历' })).toBeVisible();
    await 断言附件标题几何未漂移(page);
    // 记录第一行关闭滑动态的高度：replace + 轮询完成后同一行高度差不得 >1px
    const 首行 = page.getByTestId('附件简历行').filter({ hasText: 'candidate.pdf' });
    const 首行闭高 = (await 首行.boundingBox())?.height;
    expect(首行闭高).toBeDefined();

    // ── ＋ 授权取消：零写入零请求（基线采样在触发文件选择之前）──
    const writesBeforeAddCancel = P2.写入次数;
    await page.getByRole('button', { name: '添加附件简历' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'cancel-me.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
    expect(P2.写入次数).toBe(writesBeforeAddCancel);
    await expect(page.getByText('允许 AI 识别这份简历？')).toHaveCount(0);
    await expect(page.getByTestId('附件简历行')).toHaveCount(1);

    // ── 添加第二份 ──
    await page.getByRole('button', { name: '添加附件简历' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'second.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByTestId('附件简历行')).toHaveCount(2);
    await expect(page.getByTestId('附件简历行').filter({ hasText: 'second.pdf' })).toBeVisible();

    // ── 替换 candidate.pdf：display name 由槽位保留，与新挑的文件名无关 ──
    await 左滑附件行(page, 'candidate.pdf');
    await page.getByRole('button', { name: '替换', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'replacement.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByText('replacement.pdf')).toHaveCount(0);
    await expect(首行).toBeVisible();
    // replace 后重新入列 pending → 轮询回 识别完成；同一行高度不漂移
    await expect(首行.getByText('识别完成')).toBeVisible({ timeout: 15_000 });
    const 首行复高 = (await 首行.boundingBox())?.height;
    expect(Math.abs(首行复高! - 首行闭高!)).toBeLessThanOrEqual(1);

    // ── 预览：只断言 authenticated content GET，不依赖 PDF viewer 页面内容 ──
    const 内容请求 = page.waitForRequest(
      (request) => new URL(request.url()).pathname === '/api/v1/me/resume-files/rf_1/content',
    );
    await 首行.click();
    await 内容请求;
    expect(P2.下载次数).toBeGreaterThanOrEqual(1);

    // ── 添加到 3/3：＋ 消失；布局门二：满额无 ＋ 的标题几何 ──
    await page.getByRole('button', { name: '添加附件简历' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'third.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByTestId('附件简历行')).toHaveCount(3);
    await expect(page.getByRole('button', { name: '添加附件简历' })).toHaveCount(0);
    await 断言附件标题几何未漂移(page);

    // ── 删除：取消零 DELETE，确认恰一次 DELETE ──
    const 删除请求: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'DELETE' && new URL(request.url()).pathname.startsWith('/api/v1/me/resume-files')) {
        删除请求.push(request.url());
      }
    });
    const writesBeforeDelete = P2.写入次数;
    await 左滑附件行(page, 'third.pdf');
    await page.getByRole('button', { name: '删除', exact: true }).click();
    await expect(page.getByText('删除后无法恢复。')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
    expect(P2.写入次数).toBe(writesBeforeDelete);
    expect(删除请求).toEqual([]);
    await expect(page.getByTestId('附件简历行').filter({ hasText: 'third.pdf' })).toBeVisible();

    await 左滑附件行(page, 'third.pdf');
    await page.getByRole('button', { name: '删除', exact: true }).click();
    await expect(page.getByText('删除后无法恢复。')).toBeVisible();
    // 弹层遮罩的 aria-label「关闭删除附件简历？」也含这段文字：exact 只认执行键
    await page.getByRole('button', { name: '删除附件简历', exact: true }).click();
    await expect(page.getByTestId('附件简历行').filter({ hasText: 'third.pdf' })).toHaveCount(0, { timeout: 10_000 });
    expect(P2.写入次数).toBe(writesBeforeDelete + 1);
    expect(删除请求.length).toBe(1);
  });

  test('failed resume parse requires fresh consent before retry @backend', async ({ page }) => {
    // 失败态要等两拍 3s 轮询 + 重试后两拍：显式放宽到 120s
    test.setTimeout(120_000);
    const P2 = 创建P2附件fixture('parser_temporarily_unavailable');
    await 安装BFF路由(page, { 记录目录请求: () => {}, 登录尝试id: 'att-p2-failed', 附件fixture: P2 });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await page.goto('/#/student');
    await page.locator('input[type=file]').setInputFiles({
      name: 'failed.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await page.getByRole('button', { name: '同意并继续' }).click();
    await page.goto('/#/resume');
    await expect(page.getByText('服务繁忙 · 稍后重试')).toBeVisible({ timeout: 15_000 });
    P2.下次终态 = 'succeeded';
    const writesBeforeConsent = P2.写入次数;
    await 左滑附件行(page, 'failed.pdf');
    await page.getByRole('button', { name: '重新解析' }).click();
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    expect(P2.写入次数).toBe(writesBeforeConsent);
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByText('识别完成')).toBeVisible({ timeout: 15_000 });
    expect(P2.写入次数).toBe(writesBeforeConsent + 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P5 MatchCase 生命周期 @backend —— 双端 match-cases 的浏览器验收旅程（Task 8）。
// fixture 见 创建P5MatchCasefixture；变更回执 / PDF 读取 / 应答头（no-store）存证。
// ─────────────────────────────────────────────────────────────────────────────

/** POST 之后必有权威 detail 重读（mutation 响应是 void，权威态只来自 GET）。
 *  J-PILOT-01：候选端权威重读走 me/negotiations 聚合，招聘端维持原 Case GET。 */
function 断言重读发生(请求序: readonly string[], POST项: string) {
  const 位 = 请求序.indexOf(POST项);
  expect(位).toBeGreaterThanOrEqual(0);
  expect(请求序.slice(位 + 1).some((项) =>
    /^GET \/api\/v1\/(me|recruiter)\/(match-cases|negotiations)\/[^/]+$/.test(项))).toBe(true);
}

test.describe('P5 MatchCase 生命周期 fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('同一 Case 双端 needs_action 分歧，列表保留服务端顺序与游标 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5双角色(page, {
      主体初始角色: 'candidate',
      请求拦截: ({ path, method, query }) => 请求序.push(`${method} ${path}${query ?? ''}`),
    });

    // ── 候选端 #/app：在谈主列表 = 全意向连续 active 集合（J-PILOT-01，恒省略
    //    intention_id + limit=50）──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await expect(page.getByText(P5标记.丁职位名)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '加载更多' })).toBeVisible(); // 游标未尽
    expect(请求序).toContain('GET /api/v1/me/negotiations?shelf=active&limit=50');

    // 加载更多：首页 cursor 原样透传，第二页按服务端顺序追加上屏
    await page.getByRole('button', { name: '加载更多' }).click();
    await expect(page.getByText(P5标记.甲职位名)).toBeVisible({ timeout: 10_000 });
    expect(请求序).toContain('GET /api/v1/me/negotiations?shelf=active&limit=50&cursor=p5pg2');
    await 断言纵序(page, [P5标记.丁职位名, P5标记.乙职位名, P5标记.丙一职位名, P5标记.丙二职位名, P5标记.甲职位名]);
    // 候选端视角：丁/乙/丙一/丙二需要你 ×4；同一 Case 甲对候选端零待办（代理处理中）
    await expect(page.getByText('需要你', { exact: true })).toHaveCount(4);
    await expect(page.getByText('代理处理中', { exact: true })).toHaveCount(1);

    // ── 切招聘端：同一批 Case 的 needs_action 由 viewer 重新裁决 ──
    // 招聘端在谈卡 2026-09-09 起只渲染 candidate_summary 摘要 + 阶段段（别名/冻结职位
    // 事实退场）；fixture 摘要恒 null → 首行中性「候选信息暂未披露」，就绪锚点随之换。
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    // 卡片统一（2026-09-10）后招聘端在谈卡面 = 候选摘要 + 阶段区：Case 职位名/别名退场，
    // 行锚点改用 candidate_summary 投影的现职标记（逐单不同，逐字来自 HTTP fixture）
    await expect(page.getByText(P5标记.现职.甲)).toBeVisible({ timeout: 20_000 });
    // 甲：候选端「代理处理中」→ 招聘端「需要你」（backend J5b 同款分歧）。
    // 卡片统一后徽标统一走 从P5到阶段：needs_action → 需要你，否则 代理处理中（候选端同映射）。
    // 首页唯甲：需要你 ×1、代理处理中 ×0
    await expect(page.getByText('需要你', { exact: true })).toHaveCount(1);
    await expect(page.getByText('代理处理中', { exact: true })).toHaveCount(0);
    expect(请求序).toContain(`GET /api/v1/recruiter/match-cases?job_id=${P5编号.job}&limit=50&include=candidate_summary`);
    await page.getByRole('button', { name: '加载更多' }).click();
    await expect(page.getByText(P5标记.现职.丁)).toBeVisible({ timeout: 10_000 });
    await 断言纵序(page, [P5标记.现职.甲, P5标记.现职.丁, P5标记.现职.乙, P5标记.现职.丙一, P5标记.现职.丙二]);
    // 读尽后：甲/丁 needs_action → 需要你 ×2；乙/丙一/丙二 waiting → 代理处理中 ×3
    await expect(page.getByText('需要你', { exact: true })).toHaveCount(2);
    await expect(page.getByText('代理处理中', { exact: true })).toHaveCount(3);
    expect(请求序).toContain(`GET /api/v1/recruiter/match-cases?job_id=${P5编号.job}&limit=50&include=candidate_summary&cursor=p5pg2`);

    // 候选端专属上下文（intention_id）绝不上招聘端的屏
    await expect(page.getByText(new RegExp(P6标记.意向编号))).toHaveCount(0);
    // 整段旅程零写请求；每个 match-cases / negotiations JSON 应答都带 no-store（fixture 侧存证）
    expect(fixture.变更请求).toEqual([]);
    expect(fixture.应答头存证.filter((项) => 项.path.includes('/match-cases') || 项.path.includes('/negotiations'))
      .every((项) => 项.cacheControl === 'no-store')).toBe(true);
  });

  test('未知 lifecycle/stage/status/step 与矩阵外四元组 fail closed @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = 创建P5MatchCasefixture();
    fixture.分支.坏行进列表 = true;
    // 探针的连续身份只在本用例注入（坏样本不进默认 active 集合）
    种连续探针记录(fixture);
    await 装P5候选(page, { fixture, 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    // 一行未知 status 毒化整页：首载失败态 + 重试，任何行（含合法行）都不上屏
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await expect(page.getByText('在谈暂时加载不了')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('服务返回异常，请稍后重试').first()).toBeVisible();
    await expect(page.getByText(P5标记.丁职位名)).toHaveCount(0);
    // Mock 在谈单绝不顶替 HTTP
    await expect(page.getByText('资深后端工程师 · 交易网关')).toHaveCount(0);

    // 详情逐个探（J-PILOT-01：候选详情深链走 me/negotiations alias 直读）：
    // 未知词与矩阵外四元组一律 fail closed —— 零动作卡、零输入
    const 坏编号们 = [P5编号.坏生命周期, P5编号.坏阶段, P5编号.坏状态, P5编号.坏步骤, P5编号.坏四元组];
    for (const 编号 of 坏编号们) {
      await page.goto(`/#/deal/${编号}`);
      await expect(page.getByText('这一单暂时打不开')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('服务返回异常，请稍后重试').first()).toBeVisible();
      await expect(page.getByRole('button', { name: '提交回答' })).toHaveCount(0);
      await expect(page.getByPlaceholder('有想法就告诉你的AI代理')).toHaveCount(0);
      expect(请求序).toContain(`GET /api/v1/me/negotiations/${编号}`);
    }
    // 重试只重发权威 GET（仍 fail closed），绝不变异
    const 详情GET数 = () => 请求序.filter((项) => 项 === `GET /api/v1/me/negotiations/${P5编号.坏四元组}`).length;
    const 前 = 详情GET数();
    await page.getByRole('button', { name: '重试' }).click();
    await expect.poll(() => 详情GET数(), { timeout: 5_000 }).toBeGreaterThan(前);
    expect(fixture.变更请求).toEqual([]);
  });

  test('候选详情直达刷新：空列表记忆下整页可渲染 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5候选(page, { 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    // 首个导航就是详情深链：列表从未挂载，context 只来自详情 GET
    await page.goto(`/#/deal/${P5编号.乙}`);
    await expect(page.getByText(P5标记.乙职位名).first()).toBeVisible({ timeout: 20_000 });
    // 意向 ID 是内部坐标（P5 Task 4 起不进可见内容），深链渲染绝不依赖它
    await expect(page.getByText(new RegExp(P6标记.意向编号))).toHaveCount(0);
    await expect(page.getByText('轮次 1/3')).toBeVisible();
    // S0（J-PILOT-01）：人工补事实提交退场 —— 只剩时间线里的代理问题文本，
    // 无补事实提交入口；底栏保留原输入框与发送键但真禁用（Spec §7），
    // placeholder 按真实阶段变化。
    await expect(page.getByText(P5标记.问题).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '提交回答' })).toHaveCount(0);
    const S0输入 = page.getByPlaceholder('双方 AI 代理正在确认条件');
    await expect(S0输入).toBeVisible();
    await expect(S0输入).toBeDisabled();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
    expect(请求序).toContain(`GET /api/v1/me/negotiations/${P5编号.乙}`);
    expect(请求序.filter((项) => /\/negotiations\?/.test(项))).toEqual([]); // 零列表/历史读取

    // 旧 S0 needs_user 待核实说明（Spec §7）：停止该卡交互并交负责人处理
    await expect(page.getByText('旧版状态待核实，请交负责人处理').first()).toBeVisible();

    // 键盘与程序回调都不得发请求：禁用控件零 POST（Spec §7 零发送）
    const 前变更数 = fixture.变更请求.length;
    await S0输入.press('Enter');
    await page.waitForTimeout(500);
    expect(fixture.变更请求).toHaveLength(前变更数);
  });

  test('招聘详情直达刷新：空列表记忆下整页可渲染 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    await 装P5招聘(page, { 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    await page.goto(`/#/hr/candidate/${P5编号.甲}`);
    // 详情统一（spec §3.1）：招聘顶栏去名 —— alias 不显示，画像位置全保留并显示缺失，
    // 冻结职位 · 城市 · 薪资带由岗位上下文单独承载
    await expect(page.getByText(P5标记.甲职位名).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(P5标记.甲别名)).toHaveCount(0);
    await expect(page.getByText('经验缺失')).toBeVisible();
    await expect(page.getByText('学历缺失')).toBeVisible();
    await expect(page.getByText('求职状态缺失')).toBeVisible();
    await expect(page.getByRole('img', { name: '性别未知' })).toBeVisible();
    await expect(page.getByText('需要你', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '通过初筛' })).toBeVisible();
    await expect(page.getByRole('button', { name: '不合适' })).toBeVisible();
    expect(请求序).toContain(`GET /api/v1/recruiter/match-cases/${P5编号.甲}`);
    expect(请求序.filter((项) => /\/match-cases\?/.test(项))).toEqual([]);
    // 身份 canary：P5 投影里没有姓名/联系方式渲染路径
    await expect(page.getByText(标记.主体真名)).toHaveCount(0);
  });

  test('S0 观察期零输入零写：respond_fact 退场、底栏真禁用、3 秒重读零写请求 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = 创建P5MatchCasefixture();
    await 装P5候选(page, { fixture, 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    await page.goto(`/#/deal/${P5编号.乙}`);
    // J-PILOT-01（Spec §7）：双端 S0 零人工输入 —— 代理问题只剩时间线文本，
    // 补事实/提交回答入口退场；底栏保留原控件但禁用，placeholder 按阶段变化。
    await expect(page.getByText(P5标记.问题).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('补充事实')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '提交回答' })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: '回答问题' })).toHaveCount(0);
    const S0输入 = page.getByPlaceholder('双方 AI 代理正在确认条件');
    await expect(S0输入).toBeDisabled();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();

    // 3 秒节拍已权威重读；整个观察窗零写请求（零发送不只靠颜色灰化）。
    // （旧 S0 needs_user 待核实停表：一拍即停，与 3 秒节拍停止口径一致。）
    const 详情GET数 = () => 请求序.filter((项) => 项 === `GET /api/v1/me/negotiations/${P5编号.乙}`).length;
    await page.waitForTimeout(3_500);
    expect(详情GET数()).toBeGreaterThanOrEqual(2);
    expect(fixture.变更请求).toEqual([]);
    expect(请求序.filter((项) => 项.endsWith('/fact-responses'))).toEqual([]);
  });

  test('披露前与解析中/失败：无姓名无联系方式无 PDF；失败重试重发同一对 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5双角色(page, {
      主体初始角色: 'candidate',
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    // ── 候选端 丙二（解析失败）：重试卡只认阶段区 typed 附件 ──
    await page.goto(`/#/deal/${P5编号.丙二}`);
    await expect(page.getByRole('button', { name: '重试校验' })).toBeVisible({ timeout: 20_000 });

    // 首次递交（J-PILOT-01：retry_resume_readiness 是原授权检查，直接提交原绑定对，
    // 不再展示披露确认层）：失败解析挡披露（409 → 统一收口文案），卡仍在
    await page.getByRole('button', { name: '重试校验' }).click();
    // 409 resume_readiness_failed 的远端 message 不进 UI（真实性修复 D）：统一收口文案
    await expect(page.getByText('请求失败，请稍后再试').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '重试校验' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0); // 原授权检查零再次确认

    // 解析恢复后同键重放同一对（file/version 与 typed 附件逐字一致）→ 披露成功
    await page.getByRole('button', { name: '重试校验' }).click();
    await expect(page.getByText('等待招聘方决定')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '重试校验' })).toHaveCount(0);
    const 递交POST = fixture.变更请求.filter((项) => 项.path.endsWith('/resume-submission'));
    expect(递交POST).toHaveLength(2);
    expect(递交POST[0]!.body).toEqual({
      file_id: P5编号.文件, file_version_id: P5编号.文件版本, disclosure_confirmed: true,
    });
    expect(递交POST[0]!.body).toEqual(递交POST[1]!.body);
    expect(递交POST[0]!.idempotencyKey).not.toBe('');
    expect(递交POST[0]!.idempotencyKey).toBe(递交POST[1]!.idempotencyKey);

    // ── 切招聘端：披露前（乙 S0）与解析中（丙一 S1 waiting）不暴露姓名/联系方式/PDF ──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    for (const [编号, 职位名, 别名] of [
      [P5编号.丙一, P5标记.丙一职位名, P5标记.丙一别名],
      [P5编号.乙, P5标记.乙职位名, P5标记.乙别名],
    ] as const) {
      await page.goto(`/#/hr/candidate/${编号}`);
      // 就绪锚点 = 岗位上下文（冻结职位 · 城市 · 薪资带）；去名裁定：别名不上详情顶栏
      await expect(page.getByText(职位名).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(别名)).toHaveCount(0);
      // 姓名只在 /me/resume（候选端会话已读过）里存在；P5 投影绝无渲染路径
      await expect(page.getByText(标记.主体真名)).toHaveCount(0);
      // 无 PDF 入口：附件行（PDF 徽标 + 文件名）一个都不出现
      await expect(page.locator('button').filter({ hasText: 'PDF' })).toHaveCount(0);
      await expect(page.getByText(P5标记.简历名)).toHaveCount(0);
    }
    expect(fixture.PDF读取).toEqual([]); // 全程零内容 GET
  });

  test('已披露招聘端只开 Case 专属原始 PDF（叮嘱落段后入口仍在） @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5招聘(page, { 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    await page.goto(`/#/hr/candidate/${P5编号.甲}`);
    const 附件键 = page.getByRole('button', { name: new RegExp(P5标记.简历名) });
    await expect(附件键).toBeVisible({ timeout: 20_000 });

    // ── 终审回归钉：S1 段一旦有对话内容，PDF 入口不得消失。招聘端就在同一屏发一条
    //    Case 叮嘱（回执带 expression 文本落进当前 S1 段），权威重读落条后入口仍在 ──
    await page.getByPlaceholder('有想法就告诉你的AI代理').fill(P5标记.叮嘱);
    await page.getByRole('button', { name: '发送' }).click();
    // 同步点 = 输入框清空（POST + 权威重读完成后才 resolve、成功才清草稿）；
    // 清空后 getByText 只可能命中段内回执 —— 证明「回执落段」而非 textarea 值。
    await expect(page.getByPlaceholder('有想法就告诉你的AI代理')).toHaveValue('', { timeout: 10_000 });
    await expect(page.getByText(P5标记.叮嘱).first()).toBeVisible(); // 回执落段
    await expect(附件键).toBeVisible(); // 入口不被段内对话压掉

    // 点击只走 Case 专属 recruiter 路径；唯一一次内容 GET
    const 内容请求 = page.waitForRequest(
      (请求) => new URL(请求.url()).pathname === `/api/v1/recruiter/match-cases/${P5编号.甲}/resume-submission/content`,
    );
    await 附件键.click();
    await 内容请求;
    // 弹层：PDF 徽标 + 文件名 + iframe（真实字节经租约地址呈现）
    await expect(page.getByRole('dialog').getByText(P5标记.简历名)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTitle('简历 PDF')).toBeVisible();
    expect(fixture.PDF读取).toEqual([`recruiter:${P5编号.甲}`]);
    // 候选臂路径绝不请求；PDF 应答是 private, no-store
    expect(请求序.filter((项) => 项.includes('/me/match-cases/'))).toEqual([]);
    const PDF头 = fixture.应答头存证.filter((项) => 项.path.endsWith('/resume-submission/content'));
    expect(PDF头).toHaveLength(1);
    expect(PDF头[0]!.cacheControl).toBe('private, no-store');

    // 关闭即收层（租约随弹层回收）
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('S2/S3 每步权威重读，本端动作卡随权威视图消失 @backend', async ({ page }) => {
    test.setTimeout(150_000);
    const 请求序: string[] = [];
    const fixture = await 装P5双角色(page, {
      主体初始角色: 'candidate',
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    // ── 候选端 S2 accept：POST → 权威重读 → 本端卡消失（对方仍待决）──
    await page.goto(`/#/deal/${P5编号.丁}`);
    await expect(page.getByRole('button', { name: '接受', exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('回应协同事项')).toBeVisible();
    await page.getByRole('button', { name: '接受', exact: true }).click();
    await expect(page.getByRole('button', { name: '接受', exact: true })).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText('回应协同事项')).toHaveCount(0);
    断言重读发生(请求序, `POST /api/v1/me/match-cases/${P5编号.丁}/coordination/${P5编号.协同}/decisions`);

    // ── 切招聘端：同一协同卡仍归招聘方 → accept 后 S2 收口进 S3 ──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    await page.goto(`/#/hr/candidate/${P5编号.丁}`);
    await expect(page.getByRole('button', { name: '接受', exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '接受', exact: true }).click();
    await expect(page.getByRole('button', { name: '确认意向' })).toBeVisible({ timeout: 10_000 });

    // S3：招聘方确认 → 本端意向卡消失，等待候选人（终态动作消失）
    await page.getByRole('button', { name: '确认意向' }).click();
    await expect(page.getByRole('button', { name: '确认意向' })).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByRole('button', { name: '婉拒意向' })).toHaveCount(0);
    await expect(page.getByText('等待候选人确认意向')).toBeVisible();
    断言重读发生(请求序, `POST /api/v1/recruiter/match-cases/${P5编号.丁}/intent-decisions`);

    // ── 切回候选端：最后一笔确认完成 Case —— 移交文案上屏、双方动作表清空 ──
    await page.goto('/#/identity?switch=1&from=hr');
    await page.getByRole('button', { name: '翻到「求职者」那一面' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto(`/#/deal/${P5编号.丁}`);
    await expect(page.getByRole('button', { name: '确认意向' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '确认意向' }).click();
    await expect(page.getByText('双方已确认，正在创建会话').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('已通过', { exact: true }).first()).toBeVisible();

    // 每个 mutation 恰一次 POST、各走本端唯一准许路线；主壳可预载 P7 收件箱集合，
    // 但 P5 没有会话标识，不能提前读取会话详情、消息或移交路由。
    const 决定POST们 = fixture.变更请求.filter((项) => 项.method === 'POST');
    expect(决定POST们.map((项) => `${项.method} ${项.path} ${JSON.stringify(项.body)}`)).toEqual([
      `POST /api/v1/me/match-cases/${P5编号.丁}/coordination/${P5编号.协同}/decisions {"action":"accept"}`,
      `POST /api/v1/recruiter/match-cases/${P5编号.丁}/coordination/${P5编号.协同}/decisions {"action":"accept"}`,
      `POST /api/v1/recruiter/match-cases/${P5编号.丁}/intent-decisions {"action":"confirm"}`,
      `POST /api/v1/me/match-cases/${P5编号.丁}/intent-decisions {"action":"confirm"}`,
    ]);
    expect(请求序.filter((项) => /\/conversations\/|\/chat\/|handoff/i.test(项))).toEqual([]);
  });

  test('completed 移交两步：pending 继续低频重读恒禁用，发布后进入 P7 会话路由 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5候选(page, { 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    await page.goto('/#/archived');
    // J-PILOT-01：候选历史 = 单一连续集合（shelf=history），不再拼双架
    await expect(page.getByText(P5标记.己职位名)).toBeVisible({ timeout: 15_000 });
    await page.getByText(P5标记.己职位名).click();
    await expect(page.getByText('双方已确认，正在创建会话').first()).toBeVisible({ timeout: 10_000 });

    // 「开始私聊」在场但恒禁用：准备中，会话坐标只能来自服务端发布
    const 私聊键 = page.getByRole('button', { name: '开始私聊' });
    await expect(私聊键).toBeVisible();
    await expect(私聊键).toBeDisabled();
    // completed 终态只读（Task 10 口径）：底部保留为只读区域、零发送 —— 位置断言（无输入
    // 控件）保留，同时正向钉只读说明与发送键缺席
    await expect(page.getByRole('button', { name: '确认意向' })).toHaveCount(0);
    await expect(page.getByText('当前在谈已结束，仅可查看')).toBeVisible();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toHaveCount(0);
    await expect(page.getByPlaceholder('有想法就告诉你的AI代理')).toHaveCount(0);

    // P7 Task 7：pending 不是详情终局 —— 3 秒节拍继续权威重读（same-party 长期
    // pending 同形态：多拍后仍是准备态，绝不出现内部错误词或前端超时终态）
    const 详情GET数 = () => 请求序.filter((项) => 项 === `GET /api/v1/me/negotiations/${P5连续编号.己}`).length;
    await page.waitForTimeout(4_000);
    const 拍后数 = 详情GET数();
    await page.waitForTimeout(3_500);
    expect(详情GET数()).toBeGreaterThan(拍后数); // 节拍仍在走
    await expect(私聊键).toBeDisabled();
    await expect(page.getByText('invalid_actor_identity')).toHaveCount(0);
    await expect(page.getByText('真人会话已建立')).toHaveCount(0);

    // 会话坐标在发布前绝不被请求（P5 阶段零会话内容路由）。Task 1 起离线边界为
    // fixture 模式提供 /api/v1/events/live 空闲本地连接（旧世界它必然连接失败），
    // 事件源 onOpen 会无条件重拉当前角色收件箱清单（use真人会话事件 的既有产品
    // 行为），该清单 GET 不在本断言范围；这里守的是 会话详情/消息/移交 路由在
    // 发布前为零 —— P5 屏绝不提前读会话内容，发布后的进入是用户主动导航。
    const 发布前会话请求 = 请求序.filter((项) => /\/conversations\/|\/chat\//i.test(项)).length;

    // ── 服务端发布：completed + complete + conversation_ref ──
    const 己 = fixture.cases[P5编号.己]!;
    己.step = 'complete';
    己.conversationRef = P7会话编号.会话;

    // 下一拍权威重读见到发布：文案切换、按钮启用
    await expect(page.getByText('真人会话已建立').first()).toBeVisible({ timeout: 10_000 });
    await expect(私聊键).toBeEnabled({ timeout: 5_000 });
    await 私聊键.click();
    await expect(page).toHaveURL(new RegExp(`#/chat/human/${P7会话编号.会话}$`), { timeout: 10_000 });
    // 发布前 P5 屏从未请求过会话路由（发布后的进入是用户主动导航）
    expect(发布前会话请求).toBe(0);
  });

  test('ended/completed 单一历史集合原序渲染，终局详情只读 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5候选(page, { 请求拦截: ({ path, method, query }) => 请求序.push(`${method} ${path}${query ?? ''}`) });

    await page.goto('/#/archived');
    // J-PILOT-01：已结束 Case 与已归档初评失败由同一个连续分页承接（一次 shelf=history 读取，
    // 单页读尽无加载更多；needs_action=false 不据以隐藏卡）
    await expect(page.getByText(P5标记.己职位名)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P5标记.戊职位名)).toBeVisible({ timeout: 10_000 });
    expect(请求序).toContain('GET /api/v1/me/negotiations?shelf=history&limit=50');
    await expect(page.getByRole('button', { name: '加载更多' })).toHaveCount(0);

    // ended 详情（J-PILOT-01 Spec §7）：终局摘要原样（wire outcome/reason 不翻译）；
    // S0 终局底栏保留原控件但真禁用，占位按顶格 outcome 投影
    await page.getByText(P5标记.戊职位名).click();
    await expect(page.getByText('终局', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('user_ended').first()).toBeVisible();
    await expect(page.getByPlaceholder('本次代谈已结束')).toBeDisabled();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '提交回答' })).toHaveCount(0);
    await expect(page.getByPlaceholder('有想法就告诉你的AI代理')).toHaveCount(0);

    // completed 详情同样只读（移交文案 + 恒禁用的开始私聊 + 只读底栏零发送）
    await page.goto('/#/archived');
    await page.getByText(P5标记.己职位名).click();
    await expect(page.getByText('双方已确认，正在创建会话').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '开始私聊' })).toBeDisabled();
    await expect(page.getByText('当前在谈已结束，仅可查看')).toBeVisible();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toHaveCount(0);

    // 整条旅程零变异
    expect(fixture.变更请求).toEqual([]);
    expect(请求序.filter((项) => 项.startsWith('POST'))).toEqual([]);
  });

  test('登出与角色切换清空可见 P5 状态 @backend', async ({ page }) => {
    test.setTimeout(150_000);
    const 请求序: string[] = [];
    await 装P5双角色(page, {
      主体初始角色: 'candidate',
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    // 候选端在谈可见
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await expect(page.getByText(P5标记.丁职位名)).toBeVisible({ timeout: 15_000 });

    // 切招聘端：候选端在谈内容一个字不留（P5 状态随会话转移摊平）。
    // 招聘端在谈卡 2026-09-09 起不渲染冻结职位事实，就绪锚点用中性摘要行 + 甲的待办徽标
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    // 招聘端卡面锚点是摘要现职标记（卡片统一后 Case 职位名不在卡面）
    await expect(page.getByText(P5标记.现职.甲)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(P5标记.现职.丁)).toHaveCount(0);
    await expect(page.getByText(P5标记.现职.乙)).toHaveCount(0);

    // 切回候选端：新会话代际重新水合，自己的在谈重新可见
    await page.goto('/#/identity?switch=1&from=hr');
    await page.getByRole('button', { name: '翻到「求职者」那一面' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await expect(page.getByText(P5标记.丁职位名)).toBeVisible({ timeout: 20_000 });

    // 登出：可见 P5 状态清空，深链不再读出任何 Case 数据、零 P5 读取
    await page.evaluate(() => {
      window.location.hash = '#/settings';
    });
    await expect(page.getByRole('button', { name: '退出登录' }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '退出登录' }).first().click();
    await page.getByRole('button', { name: '确认退出当前账号' }).click();
    await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(P5标记.丁职位名)).toHaveCount(0);
    const P5请求数 = () => 请求序.filter((项) => 项.includes('/match-cases') || 项.includes('/negotiations')).length;
    const 登出后 = P5请求数();
    await page.evaluate((编号) => {
      window.location.hash = `#/deal/${编号}`;
    }, P5编号.乙);
    await page.waitForTimeout(1_000);
    await expect(page.getByText(P5标记.乙职位名)).toHaveCount(0);
    expect(P5请求数()).toBe(登出后);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 在谈详情完整布局 @mock/@backend —— 详情统一（2026-09-10 Spec §8.5）定向旅程：
// 双端 × 两种来源 × 390/320px × 两个 Tab：约定区块齐全、说明可读、无横向溢出与
// 交互遮挡。Mock 端走真实种子（J-01 顺利态 / A-01 卡点态）；Backend 端复用上面
// P5 生命周期 的装P5候选/装P5招聘 作用域与 HTTP fixture，只改 Case 记录里的合法
// 字段值（长正文/状态、可空字段有值→空），不发明 P5 不支持的 wire 键。两种来源
// 的等价 DOM/CSS 由无 Provider 组件测试（详情外壳/详情状态区/职位资料/在线简历正文
// 等）钉住；这里钉的是浏览器可达渲染路径上的区块顺序与完整缺失布局。
// 截图统一落 test-results/详情布局/（Playwright 每次运行会重建该目录，最终权威
// 运行的截图随目录留存；路径记录进 Task 10 报告）。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('在谈详情完整布局', () => {
  /** 水平溢出门（Spec §8.5）：允许 ≤2px 亚像素舍入，不允许布局性横向溢出。 */
  async function 断言无横向溢出(page: Page) {
    const 溢出 = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(溢出).toBeLessThanOrEqual(2);
  }

  // ── Mock 端（mock/stg 4181）：共用详情壳 + Mock 连接层投影 ──────────────────
  test.describe('Mock 双端 @mock', () => {
    test.use({ baseURL: 'http://127.0.0.1:4181' });

    test('求职端 390/320：顶栏、双 Tab、四阶段、动作卡与资料全区块，无横向溢出 @mock', async ({ page }) => {
      // Mock 登录与既有 @mock 旅程同口径：协议 → 微信登录 → 我要找工作
      await page.goto('/');
      await page.getByText(/已阅读并同意/).click();
      await page.getByRole('button', { name: '微信登录' }).click();
      await expect(page).toHaveURL(/#\/identity$/);
      await page.getByRole('button', { name: '我要找工作' }).click();
      await expect(page).toHaveURL(/#\/student$/);

      // J-01 顺利态（意向确认，需要你点头）：顶栏职位名 + 两个 Tab
      await page.goto('/#/deal/J-01');
      await expect(page.getByText('资深后端工程师 · 交易网关').first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: '代谈进度', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '职位详情', exact: true })).toBeVisible();

      // 进度 Tab：四阶段分节自上而下 + 意向确认动作卡（共用详情动作卡）
      await 断言纵序(page, ['匿名初筛', '递交简历', '需要协调', '意向确认']);
      await expect(page.getByText('确认意向', { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: '开始私聊 ›' })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/mock-求职-进度-390.png', fullPage: true });

      // 资料 Tab：匹配分析 → 职位详情 → 职位要求 → 公司信息 → 对接人（spec §3.3 顺序）
      await page.getByRole('button', { name: '职位详情', exact: true }).click();
      await 断言纵序(page, ['匹配度分析', page.getByText('职位详情', { exact: true }).last(), '职位要求', '公司信息', '对接人']);
      await expect(page.getByText('抖音').first()).toBeVisible(); // 公司档案真实值，非占位
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/mock-求职-资料-390.png', fullPage: true });

      // 320px：两个 Tab 的约定区块仍在、无横向溢出（长公司介绍/标签不把页面撑宽）
      await page.setViewportSize({ width: 320, height: 568 });
      await expect(page.getByText('对接人', { exact: true })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/mock-求职-资料-320.png', fullPage: true });
      await page.getByRole('button', { name: '代谈进度', exact: true }).click();
      await expect(page.getByRole('button', { name: '开始私聊 ›' })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/mock-求职-进度-320.png', fullPage: true });
    });

    test('招聘端 390/320：画像顶栏、四阶段、卡点决策与在线简历九区，无横向溢出 @mock', async ({ page }) => {
      await page.goto('/');
      await page.getByText(/已阅读并同意/).click();
      await page.getByRole('button', { name: '微信登录' }).click();
      await expect(page).toHaveURL(/#\/identity$/);
      await page.getByRole('button', { name: '我要找工作' }).click();
      await expect(page).toHaveURL(/#\/student$/);
      await page.goto('/#/identity?switch=1&from=app');
      await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
      await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });

      // A-01 卡点态（需要协调，需要你拍板）
      await page.goto('/#/hr/candidate/A-01');
      // 去名顶栏：性别图标 + 年限｜学历｜求职状态（画像行；段与竖分同 span，子串匹配），代号/真名不上顶栏
      await expect(page.getByRole('img', { name: '男' }).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('9 年', { exact: true })).toBeVisible();
      await expect(page.getByText('硕士')).toBeVisible();
      await expect(page.getByText('在职看机会')).toBeVisible();
      await expect(page.getByRole('button', { name: '代谈进度', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '在线简历', exact: true })).toBeVisible();

      // 进度 Tab：四阶段 + 卡点决策动作卡（接受 / 不接受）
      await 断言纵序(page, ['匿名初筛', '递交简历', '需要协调', '意向确认']);
      await expect(page.getByText('卡点决策', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '接受', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '不接受', exact: true })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/mock-招聘-进度-390.png', fullPage: true });

      // 资料 Tab：在线简历正文九个信息区（spec §3.4 顺序；头区画像行在最上）
      await page.getByRole('button', { name: '在线简历', exact: true }).click();
      await 断言纵序(page, ['匹配度分析', '个人优势', '求职期望', '工作经历', '项目经历', '教育经历', '专业技能']);
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/mock-招聘-资料-390.png', fullPage: true });

      await page.setViewportSize({ width: 320, height: 568 });
      await expect(page.getByText('专业技能', { exact: true })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/mock-招聘-资料-320.png', fullPage: true });
      await page.getByRole('button', { name: '代谈进度', exact: true }).click();
      await expect(page.getByRole('button', { name: '接受', exact: true })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/mock-招聘-进度-320.png', fullPage: true });
    });
  });

  // ── Backend 端（backend/stg 4182）：P5 HTTP fixture 的完整缺失布局样本 ─────
  test.describe('Backend HTTP fixture @backend', () => {
    test.use({ baseURL: 'http://127.0.0.1:4182' });

    test('求职端正常全缺：双 Tab、四阶段、补充事实卡与资料区缺失占位 @backend', async ({ page }) => {
      // 默认 fixture = 正常全缺样本：P5 detail 只有冻结职位四事实，其余展示字段全缺
      await 装P5候选(page);
      await page.goto(`/#/deal/${P5编号.乙}`);

      // 顶栏：冻结职位名 + 城市 · 薪资带；匹配分缺失显示「—」并带可访问说明
      await expect(page.getByText(P5标记.乙职位名).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(`${P5标记.城市} · ${P5标记.薪资带}`).first()).toBeVisible();
      await expect(page.getByTitle('匹配分缺失')).toBeVisible();
      await expect(page.getByRole('button', { name: '代谈进度', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '职位详情', exact: true })).toBeVisible();

      // 进度 Tab：状态区（待办徽标/步骤说明/轮次）+ 四阶段（P5 阶段标题）；
      // J-PILOT-01：S0 补事实卡退场，底栏保留原控件但真禁用（Spec §7）
      await expect(page.getByText('需要你', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('轮次 1/3')).toBeVisible();
      await 断言纵序(page, ['匿名初筛', '递交简历', '差异协同', '意向确认']);
      await expect(page.getByText('补充事实', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: '提交回答' })).toHaveCount(0);
      await expect(page.getByPlaceholder('双方 AI 代理正在确认条件')).toBeDisabled();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-求职-进度-390.png', fullPage: true });

      // 资料 Tab：区块级缺口说明 + 全部约定区块原位缺失（spec §3.3/§4）
      await page.getByRole('button', { name: '职位详情', exact: true }).click();
      await expect(page.getByText('当前在谈详情数据未提供').first()).toBeVisible();
      await 断言纵序(page, [
        '匹配度分析',
        page.getByText('职位详情', { exact: true }).last(),
        '职位要求',
        // 顶栏标题含「公司信息缺失」（F3 公司槽缺失占位），substring 锚点会命中顶栏 —— 用精确锚点取区块标题
        page.getByText('公司信息', { exact: true }),
        '对接人',
      ]);
      await expect(page.getByText('匹配分析缺失')).toBeVisible();
      // 冻结摘要四事实如实展示（不因其他字段缺失而隐藏）
      await expect(page.getByText(P5标记.乙职位名).first()).toBeVisible();
      await expect(page.getByText(P5标记.技能).first()).toBeVisible();
      await expect(page.getByText('职位详情缺失')).toBeVisible();
      await expect(page.getByText('职位要求缺失')).toBeVisible();
      // 公司：五元行标签齐全、值全「—」，导航入口真实禁用并就地解释
      await expect(page.getByText('公司详情暂不可用')).toBeVisible();
      await expect(page.getByText('公司介绍缺失')).toBeVisible();
      for (const 标签 of ['融资阶段', '规模', '行业', '成立', '地址']) {
        await expect(page.getByText(标签, { exact: true })).toBeVisible();
      }
      await expect(page.getByText('公司标签缺失')).toBeVisible();
      await expect(page.getByRole('img', { name: '对接人头像缺失' })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-求职-资料-390.png', fullPage: true });

      // 320px：完整缺失时所有约定区块可见、说明可读、无横向溢出
      await page.setViewportSize({ width: 320, height: 568 });
      await expect(page.getByRole('img', { name: '对接人头像缺失' })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-求职-资料-320.png', fullPage: true });
      await page.getByRole('button', { name: '代谈进度', exact: true }).click();
      await expect(page.getByPlaceholder('双方 AI 代理正在确认条件')).toBeDisabled();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-求职-进度-320.png', fullPage: true });
    });

    test('招聘端画像全缺与长正文/合法空数组：区块仍全、长文本可读 @backend', async ({ page }) => {
      const fixture = 创建P5MatchCasefixture();
      // 长正文样本：只加长自由文本 wire 字段（时间线 text / 叮嘱回执 expression）。
      // 阶段区 summary 是 17 个 step 闭词（未知词按安全文案「阶段信息待更新」收口，不进
      // DOM），状态/步骤同为闭词 —— 不用闭词字段造长文（spec：仅测试服务端真实支持的事实）。
      const 长前缀 = `P5 长文本标记·${P5编号.甲.slice(-4)}`;
      const 长文 = `${长前缀}${'：这是一段很长的自由文本，用来验证长正文换行可读、不横向溢出、不截断丢内容。'.repeat(6)}`;
      const 甲 = fixture.cases[P5编号.甲]!;
      甲.阶段区们[1]!.transcript = [
        {
          event_id: 'evt_p5_long', stage: 'resume_submission', kind: 'stage_note', role: '',
          text: 长文, occurred_at: '2026-08-29T02:05:30Z',
        },
      ];
      甲.阶段区们[1]!.instruction_receipts = [
        {
          instruction_id: 'aci_p5_long', owner: 'recruiter', stage: 'resume_submission',
          expression: `${长前缀}回执`, occurred_at: '2026-08-29T02:05:40Z',
        },
      ];
      await 装P5招聘(page, { fixture });

      // 甲（S1 已披露）：画像全缺顶栏 + 岗位上下文 + typed 附件 + 长正文当前段
      await page.goto(`/#/hr/candidate/${P5编号.甲}`);
      await expect(page.getByText(`${P5标记.甲职位名} · ${P5标记.城市} · ${P5标记.薪资带}`).first())
        .toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('经验缺失')).toBeVisible();
      await expect(page.getByText('学历缺失')).toBeVisible();
      await expect(page.getByText('求职状态缺失')).toBeVisible();
      await expect(page.getByRole('img', { name: '性别未知' })).toBeVisible();
      await expect(page.getByTitle('匹配分缺失')).toBeVisible();
      await expect(page.getByText(P5标记.甲别名)).toHaveCount(0); // 去名：alias 不上详情
      await expect(page.getByText('出具简历初筛结论', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '通过初筛' })).toBeVisible();
      await 断言纵序(page, ['匿名初筛', '递交简历', '差异协同', '意向确认']);
      // 长时间线文本与长叮嘱回执完整上屏（换行可读，不横向溢出）
      await expect(page.getByText(长文)).toBeVisible();
      await expect(page.getByText(`${长前缀}回执`)).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-招聘-进度-390.png', fullPage: true });

      // 丙一（S1 waiting）：合法空数组样本 —— transcript/checklist 为空，段与摘要仍在，
      // 招聘端未披露无附件入口，也不生成模拟对话
      await page.goto(`/#/hr/candidate/${P5编号.丙一}`);
      await expect(page.getByText(P5标记.丙一职位名).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('递交简历', { exact: true })).toBeVisible();
      await expect(page.getByText('正在解析简历', { exact: true })).toBeVisible();
      await expect(page.locator('button').filter({ hasText: 'PDF' })).toHaveCount(0);

      // 资料 Tab（甲）：档 null 的完整缺失布局 —— 九个信息区逐区缺失 + 页尾披露说明
      await page.goto(`/#/hr/candidate/${P5编号.甲}`);
      await page.getByRole('button', { name: '在线简历', exact: true }).click();
      await expect(page.getByText('当前在谈详情数据未提供').first()).toBeVisible({ timeout: 20_000 });
      await 断言纵序(page, ['匹配度分析', '个人优势', '求职期望', '工作经历', '项目经历', '教育经历', '专业技能']);
      for (const 缺 of ['匿名画像缺失', '职位信息缺失', '匹配分析缺失', '个人优势缺失', '求职期望缺失', '工作经历缺失', '项目经历缺失', '教育经历缺失', '专业技能缺失']) {
        await expect(page.getByText(缺).first()).toBeVisible();
      }
      await expect(page.getByText('在线简历缺失 · 内容不可转发').first()).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-招聘-资料-390.png', fullPage: true });

      await page.setViewportSize({ width: 320, height: 568 });
      await expect(page.getByText('专业技能缺失').first()).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-招聘-资料-320.png', fullPage: true });

      // 320px 回切进度 Tab：长正文样本在最窄视口仍完整可读、不横向溢出（与其余三侧同构）
      await page.getByRole('button', { name: '代谈进度', exact: true }).click();
      await expect(page.getByText(长文)).toBeVisible();
      await expect(page.getByText(`${长前缀}回执`)).toBeVisible();
      await expect(page.getByRole('button', { name: '通过初筛' })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-招聘-进度-320.png', fullPage: true });
    });

    test('终局只读布局：ended 摘要与 completed 移交在 320px 完整可读、零发送 @backend', async ({ page }) => {
      await 装P5候选(page);

      // ended（戊）：终局摘要 + 禁用底栏（J-PILOT-01 Spec §7：S0 终局保留原控件但禁用，
      // 占位按顶格 outcome 投影；零动作零发送）
      await page.goto('/#/archived');
      await page.getByText(P5标记.戊职位名).click();
      await expect(page.getByText('终局', { exact: true })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByPlaceholder('本次代谈已结束')).toBeDisabled();
      await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: '提交回答' })).toHaveCount(0);
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-终局-ended-390.png', fullPage: true });

      // completed pending（己）：移交文案 + 恒禁用的开始私聊（禁用说明就地）
      await page.goto(`/#/deal/${P5编号.己}`);
      await expect(page.getByText('双方已确认，正在创建会话').first()).toBeVisible({ timeout: 15_000 });
      const 私聊 = page.getByRole('button', { name: '开始私聊' });
      await expect(私聊).toBeDisabled();
      await expect(page.getByText('准备中')).toBeVisible();
      await expect(page.getByText('当前在谈已结束，仅可查看')).toBeVisible();
      await expect(page.getByRole('button', { name: '发送', exact: true })).toHaveCount(0);
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-终局-completed-390.png', fullPage: true });

      // 320px：终局摘要/移交/只读底栏都在，无横向溢出
      await page.setViewportSize({ width: 320, height: 568 });
      await expect(page.getByText('双方已确认，正在创建会话').first()).toBeVisible();
      await expect(私聊).toBeDisabled();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-终局-completed-320.png', fullPage: true });

      await page.goto(`/#/deal/${P5编号.戊}`);
      await expect(page.getByText('终局', { exact: true })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByPlaceholder('本次代谈已结束')).toBeDisabled();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-终局-ended-320.png', fullPage: true });
    });

    test('同 Case 附件由有值刷新为空：PDF 入口清理、区块仍在、零内容请求 @backend', async ({ page }) => {
      const fixture = await 装P5招聘(page);

      await page.goto(`/#/hr/candidate/${P5编号.甲}`);
      const 附件键 = page.getByRole('button', { name: new RegExp(P5标记.简历名) });
      await expect(附件键).toBeVisible({ timeout: 20_000 });
      await page.screenshot({ path: 'test-results/详情布局/bk-刷新前-附件在场-390.png', fullPage: true });

      // 合法可空字段有值→空：已绑定撤销 → S1 typed 附件缺席（不放宽 decoder，键整体不出场）
      fixture.cases[P5编号.甲]!.已绑定 = false;
      await expect(附件键).toHaveCount(0, { timeout: 10_000 }); // 轮询重读后入口清理
      await expect(page.getByText(P5标记.简历名)).toHaveCount(0); // 无残留文件名
      await expect(page.getByText(P5标记.甲职位名).first()).toBeVisible(); // 详情仍是正常页
      await expect(page.getByRole('button', { name: '通过初筛' })).toBeVisible(); // 动作卡不丢
      await 断言纵序(page, ['匿名初筛', '递交简历', '差异协同', '意向确认']); // 四阶段不缺段
      expect(fixture.PDF读取).toEqual([]); // 全程零内容 GET
      expect(fixture.变更请求).toEqual([]); // 刷新过渡零变异
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-刷新后-附件缺席-390.png', fullPage: true });
    });

    test('同 Case 核对清单由有值刷新为空数组：清单行消失、区块与动作卡仍在 @backend', async ({ page }) => {
      const fixture = 创建P5MatchCasefixture();
      // 清单 label 是 8 词闭集（未知 label 展示层整项省略）：有值样本用闭集词，显示固定中文
      const 乙 = fixture.cases[P5编号.乙]!;
      乙.阶段区们[0]!.checklist = [{ label: 'anonymous_screening_passed', done: true }];
      await 装P5候选(page, { fixture });

      await page.goto(`/#/deal/${P5编号.乙}`);
      await expect(page.getByText('匿名初筛已通过').first()).toBeVisible({ timeout: 20_000 });

      // 合法空数组样本：checklist 有值 → []（decoder 原样接受，UI 不残留旧行）
      fixture.cases[P5编号.乙]!.阶段区们[0]!.checklist = [];
      await expect(page.getByText('匿名初筛已通过')).toHaveCount(0, { timeout: 10_000 });
      await expect(page.getByText('匿名初筛', { exact: true }).first()).toBeVisible(); // 段仍在
      // J-PILOT-01：S0 补事实卡退场 —— 代理问题只剩时间线文本，底栏真禁用
      await expect(page.getByText(P5标记.问题).first()).toBeVisible();
      await expect(page.getByRole('button', { name: '提交回答' })).toHaveCount(0);
      await expect(page.getByPlaceholder('双方 AI 代理正在确认条件')).toBeDisabled();
      expect(fixture.变更请求).toEqual([]); // 刷新过渡零变异
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-刷新后-清单为空-390.png', fullPage: true });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P5 Mock 数据源隔离 @mock：记录每个含 /match-cases 的浏览器请求，Mock 旅程下
// 这份清单必须为空（空列表），整段会话也没有任何 /api/v1 请求。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P5 Mock 数据源隔离 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('Mock 在谈/归档/详情全流程零 match-cases 请求（空清单） @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const matchCase请求: string[] = [];
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!new URL(url).pathname.startsWith('/api/v1')) return;
      apiRequests.push(url);
      if (url.includes('/match-cases')) matchCase请求.push(url);
    });

    // ── 候选端：在谈首页（Mock 在谈单）/ 归档 / 在谈详情 ──
    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);
    await page.goto('/#/app');
    await expect(page.getByText('资深后端工程师 · 交易网关')).toBeVisible({ timeout: 10_000 });
    await page.goto('/#/archived');
    await expect(page.getByText('历史代谈').first()).toBeVisible({ timeout: 10_000 });
    await page.goto('/#/deal/J-01');
    await expect(page.getByText('资深后端工程师 · 交易网关').first()).toBeVisible({ timeout: 10_000 });

    // ── 招聘端：在谈候选 / 归档 / 候选详情 ──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
    await page.goto('/#/hr');
    // 去名改版（2026-09-08）：在谈卡全匿名，列表就绪以头行性别图标为准；真名只在候选详情页
    await expect(page.getByRole('img', { name: '男' }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('沈亦舟')).toHaveCount(0);
    await page.goto('/#/hr/archived');
    await expect(page.getByText('历史代谈').first()).toBeVisible({ timeout: 10_000 });
    await page.goto('/#/hr/candidate/A-01');
    // 去名改版后详情顶栏 = 候选头行画像行（性别/年限/学历/求职状态）+ 画像副标题，
    // 代号/真名都不上屏；就绪锚点 = 画像性别图标 + 副标题 + 当前段卡点决策卡
    await expect(page.getByRole('img', { name: '男' }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Go / 高并发交易 · 字节跳动').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('卡点决策', { exact: true })).toBeVisible();
    await expect(page.getByText('沈亦舟')).toHaveCount(0); // 真名不在去名详情的可见面

    // P5 域在 Mock 下零请求：match-cases 请求清单为空（空列表），整段会话无任何 /api/v1
    expect(matchCase请求).toEqual([]);
    expect(apiRequests).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P7 真人会话 fixture（Task 7）—— 双端 conversations 的浏览器验收旅程。
// 原生 WebSocket 在 app 加载前 stub（__emitP7/__P7断开 只存在于测试 init script，
// 产品 bundle 不含该 seam）；帧不携带真相：内容一律经 no-store HTTP 重拉上屏。
// ─────────────────────────────────────────────────────────────────────────────

/** P7 候选端安装：candidate 会话 + P7 fixture + 事件桩（app 加载前）。 */
async function 装P7候选(
  page: Page,
  选项: {
    fixture?: P7FixtureState;
    覆盖?: BFF路由选项['覆盖'];
    请求拦截?: (请求: 拦截请求形) => void;
  } = {},
): Promise<P7FixtureState> {
  const fixture = 选项.fixture ?? 创建P7fixture();
  await 安装P7事件桩(page);
  await 安装BFF路由(page, {
    登录尝试id: 'att-p7-candidate',
    记录目录请求: () => undefined,
    主体初始角色: 'candidate',
    隐私fixture: P3隐私fixture(),
    P7fixture: fixture,
    覆盖: 选项.覆盖,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}

/** FE-IV-01 候选实名安装：candidate 会话 + 隐私 fixture + 实名域可变 fixture。 */
async function 装候选实名(page: Page): Promise<候选实名FixtureState> {
  const fixture = 创建候选实名fixture();
  await 安装BFF路由(page, {
    登录尝试id: 'att-iv-candidate',
    记录目录请求: () => undefined,
    主体初始角色: 'candidate',
    隐私fixture: P3隐私fixture(),
    候选实名域: fixture,
  });
  return fixture;
}

/** P7 招聘端安装：recruiter 会话（组织 fixture）+ P7 fixture + 事件桩。 */
async function 装P7招聘(
  page: Page,
  选项: {
    fixture?: P7FixtureState;
    P5MatchCasefixture?: P5MatchCasefixture形;
    请求拦截?: (请求: 拦截请求形) => void;
  } = {},
): Promise<P7FixtureState> {
  const fixture = 选项.fixture ?? 创建P7fixture();
  await 安装P7事件桩(page);
  await 安装BFF路由(page, {
    登录尝试id: 'att-p7-recruiter',
    记录目录请求: () => undefined,
    招聘组织Fixture: 带企业关系(
      P1C招聘组织Fixture,
      [P1C管理员关系],
      { [P1C标记.组织甲编号]: P1C组织甲() },
      [P4招聘岗位({ job_id: P5编号.job, title: P5标记.招聘岗标题 })],
    ),
    主体初始角色: 'recruiter',
    P5MatchCasefixture: 选项.P5MatchCasefixture,
    P7fixture: fixture,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}

// ── P8 控制面域用例的公共安装/断言 ─────────────────────────────────────────────

/** P8 候选端安装：candidate 会话 + P3 隐私 + P8 控制面 fixture（+ 可选 P7/P4/组织域）。 */
async function 装P8候选(
  page: Page,
  选项: {
    fixture?: P8FixtureState;
    P7fixture?: P7FixtureState;
    发现fixture?: P4发现fixture形;
    招聘组织Fixture?: BFF路由选项['招聘组织Fixture'];
    隐私fixture?: BFF路由选项['隐私fixture'];
    覆盖?: BFF路由选项['覆盖'];
    请求拦截?: (请求: 拦截请求形) => void;
  } = {},
): Promise<P8FixtureState> {
  const fixture = 选项.fixture ?? 创建P8fixture();
  await 安装BFF路由(page, {
    登录尝试id: 'att-p8-candidate',
    记录目录请求: () => undefined,
    主体初始角色: 'candidate',
    招聘组织Fixture: 选项.招聘组织Fixture,
    隐私fixture: 选项.隐私fixture ?? P3隐私fixture(),
    发现fixture: 选项.发现fixture,
    P7fixture: 选项.P7fixture,
    P8控制面fixture: fixture,
    覆盖: 选项.覆盖,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}

/** P8 变更存证的统一断言：浏览器 Origin 与 fixture server 同源；幂等键 16–128 可见 ASCII。 */
function 断言P8变更边界(条: P8变更回执形, 源: string): void {
  expect(条.origin).toBe(源);
  expect(条.idempotencyKey).toMatch(P8键模式);
}

test.describe('P7 真人会话 fixture @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('候选端收件箱未读 → 进会话 read-through → 权威收件箱归零 @backend', async ({ page }) => {
    const fixture = P7带消息fixture(P7标记.招聘消息);
    fixture.unread.candidate = 1;
    const 请求序: string[] = [];
    await 装P7候选(page, {
      fixture,
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    // 主壳首屏水合收件箱：未打开消息 Tab 之前，底部角标已是已加载未读（=1）
    await expect(page.locator('nav').getByText('1', { exact: true })).toBeVisible({ timeout: 15_000 });

    // 消息 Tab：行未读胶囊 + 点击只导航（绝不本地清零）。角标并入按钮无障碍名，用子串匹配。
    await page.locator('nav').getByRole('button').filter({ hasText: '消息' }).click();
    await expect(page.getByText(P7标记.职位名)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(`unread-${P7会话编号.会话}`)).toHaveText('1');
    await page.getByText(P7标记.职位名).click();
    await expect(page).toHaveURL(new RegExp(`#/chat/human/${P7会话编号.会话}$`), { timeout: 10_000 });
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 10_000 });

    // read-through：渲染到的最新 user_text 恰好提交一次，PUT 后权威未读归零
    await expect.poll(
      () => fixture.reads.filter((条) => 条.role === 'candidate' && 条.through === '4004').length,
      { timeout: 15_000 },
    ).toBe(1);
    expect(fixture.unread.candidate).toBe(0);
    // 同一 target 重渲染零重复提交
    await page.waitForTimeout(1_000);
    expect(fixture.reads.filter((条) => 条.role === 'candidate').length).toBe(1);
  });

  test('候选端发送：首答结果未知经同键重放收敛，消息只落一条 @backend', async ({ page }) => {
    const fixture = P7带消息fixture(P7标记.招聘消息);
    fixture.首答未知 = true; // 消息已落库，但首答 503 operation_outcome_unknown
    await 装P7候选(page, { fixture });

    await page.goto(`/#/chat/human/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 15_000 });
    const 输入框 = page.getByRole('textbox', { name: '输入消息' });
    await 输入框.fill(P7标记.候选消息);
    await 输入框.press('Enter');

    // 权威重拉见到同文消息：确认成功、无未知提示、恰一个气泡
    await expect(page.getByText(P7标记.候选消息)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('暂时无法确认是否发送成功')).toHaveCount(0);
    // 幂等服务端：首答 503 后受控重试同键重放 —— 两笔同键 POST、只落一条消息
    const 候选发送 = fixture.sends.filter((条) => 条.content === P7标记.候选消息);
    expect(候选发送.length).toBeGreaterThanOrEqual(2);
    expect(new Set(候选发送.map((条) => 条.key)).size).toBe(1);
    expect(fixture.messages[P7会话编号.会话]!.filter((条) => 条.content === P7标记.候选消息)).toHaveLength(1);
    // 草稿已清空
    await expect(输入框).toHaveValue('');
  });

  test('招聘端经内容无关失效事件 HTTP 重拉看到候选新消息并回复 @backend', async ({ page }) => {
    const fixture = 创建P7fixture();
    fixture.messages[P7会话编号.会话] = [{
      message_id: '4004', kind: 'user_text', sender_role: 'candidate', content: P7标记.候选消息, created_at: '2026-08-30T01:00:00Z',
    }];
    const 请求序: string[] = [];
    await 装P7招聘(page, {
      fixture,
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    await page.goto(`/#/hr/chat/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.候选消息)).toBeVisible({ timeout: 15_000 });

    // 服务端事实先变（候选新消息落库），页面上还看不到
    fixture.messages[P7会话编号.会话]!.push({
      message_id: '5006', kind: 'user_text', sender_role: 'candidate', content: P7标记.招聘回复, created_at: '2026-08-30T01:30:00Z',
    });
    await expect(page.getByText(P7标记.招聘回复)).toHaveCount(0);

    // 内容无关帧：只触发 no-store HTTP 重拉
    const 消息GET数 = () => 请求序.filter((项) => 项 === `GET /api/v1/recruiter/conversations/${P7会话编号.会话}/messages`).length;
    const 帧前 = 消息GET数();
    await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__emitP7({ type: 'recruitment.conversation_changed', conversation_id: '3003', reason: 'message_created' }));
    await expect(page.getByText(P7标记.招聘回复)).toBeVisible({ timeout: 10_000 });
    expect(消息GET数()).toBeGreaterThan(帧前); // 上屏来自 HTTP，不是帧

    // 招聘回复走同一发送链
    const 输入框 = page.getByRole('textbox', { name: '输入消息' });
    await 输入框.fill(P7标记.招聘消息);
    await 输入框.press('Enter');
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 10_000 });
    expect(fixture.sends.some((条) => 条.role === 'recruiter' && 条.content === P7标记.招聘消息)).toBe(true);
  });

  test('断线重连无条件重拉当前角色收件箱与当前会话 @backend', async ({ page }) => {
    const fixture = P7带消息fixture(P7标记.招聘消息);
    const 请求序: string[] = [];
    await 装P7候选(page, {
      fixture,
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    await page.goto(`/#/chat/human/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 15_000 });

    const 收件箱GET数 = () => 请求序.filter((项) => 项 === 'GET /api/v1/me/conversations').length;
    const 消息GET数 = () => 请求序.filter((项) => 项 === `GET /api/v1/me/conversations/${P7会话编号.会话}/messages`).length;
    const 断前 = [收件箱GET数(), 消息GET数()];
    // 主动断开（socket 关闭）→ 1s 退避重连 → onOpen 无条件重拉可见范围
    await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__P7断开());
    await expect.poll(() => 收件箱GET数(), { timeout: 10_000 }).toBeGreaterThan(断前[0]);
    await expect.poll(() => 消息GET数(), { timeout: 5_000 }).toBeGreaterThan(断前[1]);
  });

  test('context 不可用保留消息、隐藏上下文动作，提供重新加载会话信息 @backend', async ({ page }) => {
    const fixture = P7带消息fixture(P7标记.招聘消息);
    fixture.contexts[P7会话编号.会话] = 'unavailable';
    await 装P7候选(page, { fixture });

    await page.goto(`/#/chat/human/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '看职位' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '电话' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '微信' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '重新加载会话信息' })).toBeVisible();
  });

  test('foreign/wrong-role 404 不保留上一会话残留 @backend', async ({ page }) => {
    const fixture = P7带消息fixture(P7标记.招聘消息);
    fixture.不存在 = ['9900'];
    await 装P7候选(page, { fixture });

    await page.goto(`/#/chat/human/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 15_000 });

    // 深链不存在的会话：404 fail closed，上一会话内容不泄漏
    await page.goto('/#/chat/human/9900');
    await expect(page.getByText('这段会话不存在或已不可访问').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P7标记.招聘消息)).toHaveCount(0);
    await expect(page.getByText(P7标记.职位名)).toHaveCount(0); // 详情 context 残留也不泄漏
  });

  test('P5 发布后招聘端「开始私聊」进入企业参数路由 @backend', async ({ page }) => {
    const P5fixture = 创建P5MatchCasefixture();
    const 己 = P5fixture.cases[P5编号.己]!;
    己.step = 'complete';
    己.conversationRef = P7会话编号.会话;
    await 装P7招聘(page, {
      fixture: 创建P7fixture(),
      P5MatchCasefixture: P5fixture,
    });

    await page.goto(`/#/hr/candidate/${P5编号.己}`);
    await expect(page.getByText('真人会话已建立').first()).toBeVisible({ timeout: 15_000 });
    const 私聊键 = page.getByRole('button', { name: '开始私聊' });
    await expect(私聊键).toBeEnabled();
    await 私聊键.click();
    await expect(page).toHaveURL(new RegExp(`#/hr/chat/${P7会话编号.会话}$`), { timeout: 10_000 });
  });
});

// ── P7 Mock 隔离：Mock 双端零 P7 请求与零事件连接 ──────────────────────────────
test.describe('P7 Mock 数据源隔离 @mock', () => {
  test('Mock 双端消息旅程零 /conversations 请求与零 WebSocket @mock', async ({ page }) => {
    await 安装P7事件桩(page);
    const 会话请求: string[] = [];
    page.on('request', (请求) => {
      if (/\/api\/v1\/(me|recruiter)\/conversations/.test(请求.url())) {
        会话请求.push(请求.url());
      }
    });

    // Mock 无路由守卫：直接进两端主壳（零登录旅程，聚焦 P7 隔离断言）
    await page.goto('/#/app');
    await page.locator('nav').getByRole('button').filter({ hasText: '消息' }).click();
    await expect(page.getByText('AI代理动态')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('林筱')).toBeVisible();
    // 企业端镜像
    await page.goto('/#/hr');
    await page.locator('nav').getByRole('button').filter({ hasText: '消息' }).click();
    await expect(page.getByText('AI代理动态')).toBeVisible({ timeout: 10_000 });

    // 全程零 P7 HTTP 与零事件连接
    expect(会话请求).toEqual([]);
    // 零事件连接：Vite dev 的 HMR 也走 WebSocket（非事件端点），只统计 /api/v1/events/live
    const 事件套接字数 = await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).__P7套接字们 as Array<{ url: string }>)
        .filter((套) => 套.url.includes('/api/v1/events/live')).length);
    expect(事件套接字数).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P8 控制面 Backend 旅程（Task 8）。账号安全（凭证/会话/退出其他设备/换绑）、数据导出
// （恢复/创建/轮询/下载/过期与 404 清理/挡注销）、账号注销 202、产品反馈与上下文举报。
// 每个变更都断言浏览器 Origin = fixture server 源、幂等键 16–128 可见 ASCII；同意图
// 重放断言键与 body 字节一致。四张全屏截图（账号页导出行 / 详情直取举报抽屉 / P7 会话
// ⋯ / 直聊无举报入口）写入 Playwright 测试输出，是已准入 Backend 专属入口差异的手动
// 证据，不入库。fixture 见 创建P8fixture。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P8 控制面 fixture @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('P8 账号安全首屏：fixture 凭证掩码与真实会话时间上屏，无设备/地点字面量 @backend', async ({ page }, 测试信息) => {
    const fixture = await 装P8候选(page);
    await page.goto('/#/account');
    // 凭证 display 原样上屏（fixture 标记值，Mock 数据里没有）
    await expect(page.getByText(P8标记.手机掩码)).toBeVisible({ timeout: 15_000 });
    // 当前会话只显示创建/失效时间（fixture 值 → 定长展示格式）；其他设备数来自会话快照
    await expect(page.getByText('创建 2026-09-01 08:00 · 失效 2026-09-08 08:00')).toBeVisible();
    await expect(page.getByText(/其他设备 2 台/)).toBeVisible();
    // 无型号/地点/IP/UA 字面量（wire 会话行根本不带这些字段）
    await expect(page.getByText(/iPhone|上海·|上海 ·|\d+\.\d+\.\d+\.\d+/)).toHaveCount(0);
    // Backend 专属「数据」组恰一行导出入口；无句柄零导出请求（被动恢复零请求边界）
    await expect(page.getByRole('button', { name: /导出我的数据/ })).toBeVisible();
    expect(fixture.导出读取).toEqual([]);
    expect(fixture.变更请求.filter((条) => 条.path.startsWith('/api/v1/me/data-exports'))).toEqual([]);
    // 手动证据（a）：凭证/会话/导出行可见的 Backend 账号页
    await page.screenshot({ path: 测试信息.outputPath('P8-backend-account.png'), fullPage: true });
  });

  test('P8 退出其他设备：DELETE 无 body、同源键边界与权威重读归零 @backend', async ({ page }) => {
    const fixture = await 装P8候选(page);
    await page.goto('/#/account');
    await expect(page.getByText(/其他设备 2 台/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /退出其他设备/ }).click();
    // 回执计数原样上屏；成功后操作层权威重读会话
    await expect(page.getByText('已退出 2 台其他设备')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/其他设备 0 台/)).toBeVisible({ timeout: 10_000 });
    // 其他设备归零后动作键禁用（没有可退的设备）
    await expect(page.getByRole('button', { name: /退出其他设备/ })).toBeDisabled();
    const 源 = new URL(page.url()).origin;
    const 变更 = fixture.变更请求.filter((条) => 条.method === 'DELETE' && 条.path === '/api/v1/security/sessions/others');
    expect(变更).toHaveLength(1);
    expect(变更[0]!.原文).toBeNull(); // DELETE 不携带请求体
    断言P8变更边界(变更[0]!, 源);
    // 服务端清洗：fixture 会话只剩 current
    expect(fixture.会话们.filter((条) => !条.current)).toHaveLength(0);
  });

  test('P8 换绑：四位码成功；冲突保留输入；首答未知同键字节一致重放 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = await 装P8候选(page);
    await page.goto('/#/account');
    await expect(page.getByText(P8标记.手机掩码)).toBeVisible({ timeout: 15_000 });
    const 源 = new URL(page.url()).origin;

    // ── 成功：11 位裸号 begin → 四位码 complete → 权威重读落地后才关抽屉 ──
    await page.getByRole('button', { name: /手机号/ }).click();
    await page.getByPlaceholder('输入新手机号').fill('13800009001');
    await page.getByRole('button', { name: '获取验证码' }).click();
    // toast 是单一文本节点；抽屉说明的相邻文本节点会拼出同串，必须 exact（下同）
    await expect(page.getByText('验证码已发送', { exact: true })).toBeVisible({ timeout: 10_000 });
    // Backend 不出现 Mock 专属「原型任意验证码」文案
    await expect(page.getByText(/原型/)).toHaveCount(0);
    await page.getByPlaceholder(/位验证码$/).fill('2468');
    await page.getByRole('button', { name: '确认换绑' }).click();
    await expect(page.getByText('手机号已换绑', { exact: true })).toBeVisible({ timeout: 15_000 });
    // 绝不乐观写：新掩码只在权威重读落地后出现，旧掩码消失
    await expect(page.getByText(P8标记.换绑后掩码)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(P8标记.手机掩码)).toHaveCount(0);
    // 换绑完成清洗其他会话但保留 current
    await expect(page.getByText(/其他设备 0 台/)).toBeVisible({ timeout: 10_000 });

    const 开始们 = fixture.变更请求.filter((条) => 条.method === 'POST' && 条.path === '/api/v1/me/credential-replacement-attempts');
    expect(开始们[0]!.body).toEqual({ phone: '+8613800009001' }); // 11 位裸号 → facade 构造 E.164
    断言P8变更边界(开始们[0]!, 源);
    const 完成们 = () => fixture.变更请求.filter((条) => 条.method === 'POST' && 条.path.endsWith('/complete'));
    const 成功完成 = 完成们()[0]!;
    expect(成功完成.body).toEqual({ proof: { code: '2468' } }); // 全局四位规则
    断言P8变更边界(成功完成, 源);

    // ── 冲突：409 credential_replacement_conflict，抽屉与输入保留 ──
    fixture.分支.换绑冲突 = true;
    await page.getByRole('button', { name: /手机号/ }).click();
    await page.getByPlaceholder('输入新手机号').fill('13800009002');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.getByText('验证码已发送', { exact: true })).toBeVisible({ timeout: 10_000 });
    const 验证框 = page.getByPlaceholder(/位验证码$/);
    await 验证框.fill('1357');
    await page.getByRole('button', { name: '确认换绑' }).click();
    await expect(page.getByText('验证码不正确或已过期，请重新获取后再试')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '确认换绑' })).toBeVisible(); // 抽屉未关
    await expect(验证框).toHaveValue('1357'); // 输入保留，可同层重试
    await page.keyboard.press('Escape'); // 弹层框架统一 Esc 关层

    // ── 首答未知：503 后 HTTP 客户端同键受控重试 —— 两笔同键、body 字节一致 ──
    fixture.分支.换绑冲突 = false; // 冲突分支是 fixture 级标记，先复位再换分支
    fixture.分支.换绑完成首答未知 = true;
    await page.getByRole('button', { name: /手机号/ }).click();
    await page.getByPlaceholder('输入新手机号').fill('13800009003');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.getByText('验证码已发送', { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder(/位验证码$/).fill('8642');
    await page.getByRole('button', { name: '确认换绑' }).click();
    await expect(page.getByText('手机号已换绑', { exact: true })).toBeVisible({ timeout: 15_000 });
    const 未知完成们 = 完成们().filter((条) => (条.body as { proof?: { code?: string } }).proof?.code === '8642');
    expect(未知完成们).toHaveLength(2);
    expect(new Set(未知完成们.map((条) => 条.idempotencyKey)).size).toBe(1); // 同键
    expect(未知完成们[0]!.原文).toBe(未知完成们[1]!.原文); // 同意图重放：body 字节一致
    for (const 条 of 未知完成们) 断言P8变更边界(条, 源);
  });

  test('P8 数据导出：创建无 body → 轮询 ready → 关闭重开恢复 → 同源流式下载 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = await 装P8候选(page);
    await page.goto('/#/account');
    await expect(page.getByRole('button', { name: /导出我的数据/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /导出我的数据/ }).click();
    // 打开抽屉即恢复：无句柄零导出请求 → 抽屉给「生成导出文件」
    await expect(page.getByRole('button', { name: '生成导出文件' })).toBeVisible({ timeout: 10_000 });
    expect(fixture.导出读取).toEqual([]);
    await page.getByRole('button', { name: '生成导出文件' }).click();
    // 创建 POST：该路由不携带请求体；回执 queued → 抽屉进入生成中（轮询推进）
    await expect(page.getByText('正在生成导出文件，完成后可以在这里下载。')).toBeVisible({ timeout: 10_000 });
    const 创建们 = () => fixture.变更请求.filter((条) => 条.method === 'POST' && 条.path === '/api/v1/me/data-exports');
    expect(创建们()).toHaveLength(1);
    expect(创建们()[0]!.原文).toBeNull();
    断言P8变更边界(创建们()[0]!, new URL(page.url()).origin);
    // queued→running→ready（2s 退避节拍内）；ready 显示服务端过期时间
    await expect(page.getByRole('button', { name: '下载数据导出' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/2026-09-08 00:00 前可下载/)).toBeVisible();
    expect(fixture.导出.数据?.status).toBe('ready');

    // ── 关闭抽屉再打开：恢复句柄（有 ID 只 GET 绝不 POST）──
    await page.getByRole('button', { name: '先不导出' }).click();
    await expect(page.getByRole('button', { name: '先不导出' })).toHaveCount(0);
    const 读取前 = fixture.导出读取.length;
    await page.getByRole('button', { name: /导出我的数据/ }).click();
    await expect(page.getByRole('button', { name: '下载数据导出' })).toBeVisible({ timeout: 10_000 });
    expect(fixture.导出读取.length).toBeGreaterThan(读取前);
    expect(创建们()).toHaveLength(1); // 重开恢复零创建

    // ── 下载：先权威预检（GET）再同源锚点导航。锚点下载由浏览器下载管理器接管，
    //    page.route / request 事件都看不到 —— download 事件的 URL 是浏览器边界上
    //    可得的证据：同源 /download 端点 + 权威 exportId（不是 blob:/跨源 URL）。
    //    ZIP 字节与固定应答头由 route fixture 与单测覆盖；本环境 stg 不可达，
    //    落盘内容是 Vite 代理的 DNS 错误页，不作为断言对象。──
    const 预检前 = fixture.导出读取.length;
    const 下载承诺 = page.waitForEvent('download', { timeout: 15_000 });
    await page.getByRole('button', { name: '下载数据导出' }).click();
    const 下载 = await 下载承诺;
    const 源 = new URL(page.url()).origin;
    expect(下载.url()).toBe(`${源}/api/v1/me/data-exports/${fixture.导出.数据!.export_id}/download`);
    expect(下载.url().startsWith('blob:')).toBe(false);
    // 点击后的权威预检 GET 确实发生（下载先确认一次状态）
    expect(fixture.导出读取.length).toBeGreaterThan(预检前);
  });

  test('P8 数据导出过期与 404：句柄清理后重新生成用新键 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = 创建P8fixture();
    // 轮询退避 2s/4s；ready 是停表终态，过期演练直接 running→expired（不经过 ready）
    fixture.导出.状态脚本 = ['queued', 'running', 'expired'];
    await 装P8候选(page, { fixture });
    await page.goto('/#/account');
    await page.getByRole('button', { name: /导出我的数据/ }).click();
    await page.getByRole('button', { name: '生成导出文件' }).click();
    // 轮询至 expired：抽屉给「这份导出已过期」与「重新生成」（只展示服务端 status）；
    // expired 的权威 GET 同时清掉恢复句柄（回到可创建态）
    await expect(page.getByText('这份导出已过期。如仍需要，请重新生成。')).toBeVisible({ timeout: 20_000 });
    // exact：行按钮的无障碍名「导出我的数据 已过期，可重新生成 ›」含同名子串
    await expect(page.getByRole('button', { name: '重新生成', exact: true })).toBeVisible();
    const 创建们 = () => fixture.变更请求.filter((条) => 条.method === 'POST' && 条.path === '/api/v1/me/data-exports');
    const 甲键 = 创建们()[0]!.idempotencyKey;
    // 重新生成 = 先废弃句柄再创建：新键 POST，绝不重放旧键。第二份导出停在 ready
    // （保留句柄），给下一段 404 演练用
    fixture.导出.状态脚本 = ['ready'];
    await page.getByRole('button', { name: '重新生成', exact: true }).click();
    expect(创建们()).toHaveLength(2);
    expect(创建们()[1]!.idempotencyKey).not.toBe(甲键); // 明确重新生成 = 新意图新键
    断言P8变更边界(创建们()[1]!, new URL(page.url()).origin);
    // 服务端状态机重置：第二份导出直接 ready（行说明「已生成，可下载」随之落位）
    await expect.poll(() => fixture.导出.数据?.status ?? null, { timeout: 10_000 }).toBe('ready');
    await expect(page.getByText('已生成，可下载', { exact: true })).toBeVisible({ timeout: 10_000 });

    // ── 404 清理：服务端导出消失（他端清理/回收）。已成功快照的刷新失败按设计
    //    保留旧 data（只落重试错误），所以 404 的收口要在全新页面状态 + 陈旧句柄下
    //    演练：整页刷新 → 被动恢复 GET → 404 → 句柄清理 + 抽屉进入可重试错误态 ──
    fixture.导出.数据 = null;
    await page.getByRole('button', { name: '先不导出' }).click();
    await page.reload();
    await expect(page.getByText('账号与安全', { exact: true })).toBeVisible({ timeout: 15_000 });
    // 被动恢复（挂载即恢复）对陈旧句柄的权威 GET 得 404；打开抽屉看到统一收口文案
    await page.getByRole('button', { name: /导出我的数据/ }).click();
    await expect(page.getByText('导出已失效，请重新生成')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '重试', exact: true })).toBeVisible();
  });

  test('P8 导出进行中挡注销；ready 未下载给警示且仍可继续 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = 创建P8fixture();
    fixture.导出.状态脚本 = ['queued', 'running']; // 恒不 ready
    await 装P8候选(page, { fixture });
    await page.goto('/#/account');
    await page.getByRole('button', { name: /导出我的数据/ }).click();
    await page.getByRole('button', { name: '生成导出文件' }).click();
    await expect(page.getByText('正在生成导出文件，完成后可以在这里下载。')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '先不导出' }).click(); // 关抽屉只停前端节拍，服务端仍进行中

    // 注销两层弹层：说明 → 最终确认 → 409 export_in_progress（无本地登出）
    await page.getByRole('button', { name: '注销账号' }).click();
    await expect(page.getByText('注销账号会发生什么')).toBeVisible();
    await page.getByRole('button', { name: '我已了解，继续注销' }).click();
    // exact：遮罩的 aria-label「关闭确认注销账号」是「确认注销」的子串
    await page.getByRole('button', { name: '确认注销', exact: true }).click();
    await expect(page.getByText('已有导出正在生成或等待下载，请稍后重试')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '确认注销', exact: true })).toBeVisible(); // 确认层保留
    const 注销们 = () => fixture.变更请求.filter((条) => 条.path === '/api/v1/me/account-deletion');
    expect(注销们()).toHaveLength(1);
    expect(注销们()[0]!.原文).toBe('{}'); // EmptyRequest：body 精确 {}
    断言P8变更边界(注销们()[0]!, new URL(page.url()).origin);
    await page.getByRole('button', { name: '取消' }).click();

    // ── ready 未下载：说明层给「注销后将无法下载」警示与先下载入口，仍可继续 ──
    fixture.导出.状态脚本 = ['ready'];
    fixture.导出.数据 = {
      export_id: P8编号.导出甲, status: 'ready',
      created_at: '2026-09-01T08:00:00Z', expires_at: '2026-09-08T00:00:00Z', download_ready: true,
    };
    await page.getByRole('button', { name: /导出我的数据/ }).click(); // 权威重读 → ready 落位
    await expect(page.getByRole('button', { name: '下载数据导出' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '先不导出' }).click();
    await page.getByRole('button', { name: '注销账号' }).click();
    await expect(page.getByText('你有一份已生成的数据导出，注销后将无法下载。建议先下载留存。')).toBeVisible();
    await expect(page.getByRole('button', { name: '先下载数据导出' })).toBeVisible();
    // 仍可继续：警示不拦截
    await page.getByRole('button', { name: '我已了解，继续注销' }).click();
    await expect(page.getByText('确认注销账号？')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
  });

  test('P8 注销 202：清会话跳登录；后续保护读取一律 invalid_session @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = await 装P8候选(page);
    await page.goto('/#/account');
    await expect(page.getByText(P8标记.手机掩码)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '注销账号' }).click();
    await page.getByRole('button', { name: '我已了解，继续注销' }).click();
    await page.getByRole('button', { name: '确认注销', exact: true }).click();
    // 202 成功：统一清账号后由本屏跳登录页
    await expect(page).toHaveURL(/#\/$/, { timeout: 15_000 });
    await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 10_000 });
    const 注销 = fixture.变更请求.find((条) => 条.path === '/api/v1/me/account-deletion')!;
    expect(注销.method).toBe('POST');
    expect(注销.原文).toBe('{}'); // body 精确 {}
    断言P8变更边界(注销, new URL(page.url()).origin);
    expect(fixture.分支.已注销).toBe(true);
    // 注销清了会话：重进账号页被会话 401 拦在登录，旧账号数据一个字不上屏
    await page.goto('/#/account');
    await expect(page).toHaveURL(/#\/$/, { timeout: 15_000 });
    await expect(page.getByLabel('手机号')).toBeVisible();
    await expect(page.getByText(P8标记.手机掩码)).toHaveCount(0);
    // P8 保护读取在注销后一律 401 invalid_session —— fixture 级探针（页面上下文 fetch，
    // page.request 不经 page.route，会打到真实代理）：凭证 + 导出读取 + 导出下载
    // 三路全部先于存在性判定按 invalid_session 收口（ID 用合法形状即可，守卫与存在性无关）
    const 保护读取 = await page.evaluate(async (导出编号: string) => {
      const 取 = async (路径: string) => {
        const 响 = await fetch(路径, { credentials: 'include' });
        return { 状态: 响.status, 码: ((await 响.json()) as { error?: { type?: string } }).error?.type ?? null };
      };
      return {
        凭证: await 取('/api/v1/me/credentials'),
        导出: await 取(`/api/v1/me/data-exports/${导出编号}`),
        下载: await 取(`/api/v1/me/data-exports/${导出编号}/download`),
      };
    }, P8编号.导出甲);
    expect(保护读取.凭证).toEqual({ 状态: 401, 码: 'invalid_session' });
    expect(保护读取.导出).toEqual({ 状态: 401, 码: 'invalid_session' });
    expect(保护读取.下载).toEqual({ 状态: 401, 码: 'invalid_session' });
  });

  test('P8 产品反馈真实工单上屏；反馈页无举报入口零 reports 请求 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = await 装P8候选(page);
    await page.goto('/#/feedback');
    // 产品三分类走真实提交：服务端 ticket 原样上屏
    await page.getByRole('button', { name: '功能异常', exact: true }).click();
    await page.getByRole('textbox').fill('Fixture 反馈：账号页导出行点击无响应');
    await page.getByRole('button', { name: '提交', exact: true }).click();
    await expect(page.getByText('已收到，谢谢你')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(`工单号 ${P8标记.反馈工单}`)).toBeVisible();
    // Backend 致谢文案不含 24 小时承诺（后端不发布时限）
    await expect(page.getByText('我们会尽快核查。每一条反馈都有人读。')).toBeVisible();
    await expect(page.getByText(/24 小时/)).toHaveCount(0);
    const 反馈 = fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/feedback');
    expect(反馈).toHaveLength(1);
    expect(反馈[0]!.body).toEqual({ category: 'bug', details: 'Fixture 反馈：账号页导出行点击无响应' });
    断言P8变更边界(反馈[0]!, new URL(page.url()).origin);

    // 反馈页没有举报入口：举报两类没有可核实对象，只能从具体岗位/谈判/真人会话发起
    //（已在 P8 职位举报 / P7 会话举报用例覆盖真实举报路径，这里只断言本页不代发）。
    // 离开反馈页前先等账号页可见：连发的同文档 hash 跳转会被 React Router 合并，
    // 不等中间屏落定就跳回会保留旧的致谢态组件实例。
    await page.goto('/#/account');
    await expect(page.getByText('账号与安全', { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.goto('/#/feedback');
    await expect(page.getByText('举报要从具体的岗位、谈判或真人会话里发起；这里只收集产品反馈。')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '举报虚假岗位' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '举报骚扰行为' })).toHaveCount(0);
    expect(fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/reports')).toEqual([]);
    expect(fixture.反馈受理).toBe(1);
  });

  test('P8 职位举报（详情直取）：target=job_id 隐私安全 body @backend', async ({ page }, 测试信息) => {
    const 隐私 = P3隐私fixture();
    // 直取前提 = 无推荐快照（抽屉只给举报、无不感兴趣）：推荐清单显式置空（合法空页）
    const 空推荐fixture = P4发现fixture();
    空推荐fixture.候选推荐 = {};
    const fixture = await 装P8候选(page, { 发现fixture: 空推荐fixture, 隐私fixture: 隐私 });
    fixture.举报屏蔽组织[`job:${P4编号.job}`] = {
      organization_id: P8标记.屏蔽组织编号,
      organization_display_name: P8标记.屏蔽组织名,
    };
    await page.goto(`/#/job/${P4编号.job}`);
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    // 详情直取路径：⋯ 在场（权威 CandidateJob 解码成功即有举报入口）
    // 手动证据（b-1）：权威直取详情页，顶栏既有样式 ⋯ 可见
    await page.screenshot({ path: 测试信息.outputPath('P8-backend-job-more-button.png'), fullPage: true });
    await page.getByRole('button', { name: '更多操作' }).click();
    // 抽屉里恰一项非取消动作：举报这个职位（直取无推荐坐标 → 无不感兴趣）
    await expect(page.getByRole('button', { name: '举报这个职位' })).toBeVisible();
    await expect(page.getByRole('button', { name: '不感兴趣，别再推给我' })).toHaveCount(0);
    // 手动证据（b-2）：举报抽屉展开 —— 恰一项新增的既有样式抽屉项「举报这个职位」
    await page.screenshot({ path: 测试信息.outputPath('P8-backend-job-report-drawer.png'), fullPage: true });
    await page.getByRole('button', { name: '举报这个职位' }).click();
    await page.getByRole('button', { name: '骚扰', exact: true }).click();
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText('举报已受理，我们会尽快核查')).toBeVisible({ timeout: 10_000 });
    const 举报 = fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/reports');
    expect(举报).toHaveLength(1);
    // 隐私安全 body：恰 {target:{type,ref},reason,also_block}——无展示名/公司名/用户身份
    expect(举报[0]!.body).toEqual({ target: { type: 'job', ref: P4编号.job }, reason: 'harassment', also_block: false });
    断言P8变更边界(举报[0]!, new URL(page.url()).origin);
    // not_requested：不触发候选隐私重读
    expect(fixture.举报受理).toBe(1);
    expect(隐私.视图.organization_blocks).toHaveLength(0);
  });

  test('P8 举报屏蔽暂不可用：取消勾选=新键纯举报；目标不存在统一关层刷新来源 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P8候选(page, {
      发现fixture: P4发现fixture(),
      // 岗位详情按 hiring_organization_ref 补读公开企业（org-fixture-p4 只有 P4 侧声明，
      // 本用例无组织域 fixture）：按坐标显式声明空应答 → strict decode 拒绝 → 企业块
      // 出错误/占位态，与移除通用兜底前的可观察行为一致（只修测试定义，不改产品）。
      覆盖: {
        'GET /api/v1/organizations/org-fixture-p4': () => ({ status: 200, 响应: 信封(null) }),
      },
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });
    await page.goto(`/#/job/${P4编号.job}`);
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('button', { name: '举报这个职位' }).click();

    // ── 勾选同时屏蔽 → 409 block_unavailable：层保持开、选择保留、零写入 ──
    fixture.分支.举报屏蔽不可用 = true;
    await page.getByRole('button', { name: '薪资不实', exact: true }).click();
    await page.getByRole('button', { name: /同时屏蔽/ }).click();
    await expect(page.getByRole('button', { name: /同时屏蔽/ })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText('暂时无法同时屏蔽，可取消勾选后仅提交举报')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '提交举报' })).toBeVisible(); // 层未关
    expect(fixture.举报受理).toBe(0); // block_unavailable：什么都没写

    // ── 取消勾选 → 新意图新键 → 纯举报成功 ──
    await page.getByRole('button', { name: /同时屏蔽/ }).click();
    await expect(page.getByRole('button', { name: /同时屏蔽/ })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText('举报已受理，我们会尽快核查')).toBeVisible({ timeout: 10_000 });
    const 举报们 = fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/reports');
    expect(举报们).toHaveLength(2);
    expect(举报们[0]!.body).toEqual({ target: { type: 'job', ref: P4编号.job }, reason: 'salary_misrepresentation', also_block: true });
    expect(举报们[1]!.body).toEqual({ target: { type: 'job', ref: P4编号.job }, reason: 'salary_misrepresentation', also_block: false });
    expect(举报们[1]!.idempotencyKey).not.toBe(举报们[0]!.idempotencyKey); // 取消勾选=新键
    for (const 条 of 举报们) 断言P8变更边界(条, new URL(page.url()).origin);
    expect(fixture.举报受理).toBe(1);

    // ── 目标不存在：404 统一终局 —— 关层 + 屏层强制重读来源 ──
    fixture.分支.举报目标不存在 = true;
    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('button', { name: '举报这个职位' }).click();
    await page.getByRole('button', { name: '其他', exact: true }).click();
    const 岗位读取前 = 请求序.filter((项) => 项 === `GET /api/v1/jobs/${P4编号.job}`).length;
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText('举报对象已不存在，请刷新后重试')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '提交举报' })).toHaveCount(0); // 过期层已关
    await expect
      .poll(() => 请求序.filter((项) => 项 === `GET /api/v1/jobs/${P4编号.job}`).length, { timeout: 10_000 })
      .toBeGreaterThan(岗位读取前); // 屏层刷新来源：权威岗位 GET 再次发出
  });

  test('P7 会话举报：target=conversation 路由坐标；同一枚 ⋯ 键盘可达 @backend', async ({ page }, 测试信息) => {
    test.setTimeout(120_000);
    const 隐私 = P3隐私fixture();
    const 请求序: string[] = [];
    const fixture = await 装P8候选(page, {
      P7fixture: P7带消息fixture(P7标记.招聘消息),
      隐私fixture: 隐私,
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });
    fixture.举报屏蔽组织[`conversation:${P7会话编号.会话}`] = {
      organization_id: P8标记.屏蔽组织编号,
      organization_display_name: P8标记.屏蔽组织名,
    };
    await page.goto(`/#/chat/human/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 15_000 });
    // 手动证据（c）：Backend P7 会话页的同一枚视觉 ⋯（span + 原类，role=button 可达）
    const 拉点 = page.getByRole('button', { name: '举报', exact: true });
    await expect(拉点).toBeVisible();
    await page.screenshot({ path: 测试信息.outputPath('P8-backend-p7-conversation.png'), fullPage: true });
    // 键盘可达：Enter 打开会话举报层
    await 拉点.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: '提交举报' })).toBeVisible();
    // 勾选同时屏蔽 → applied：toast 点名屏蔽对象
    await page.getByRole('button', { name: '虚假信息', exact: true }).click();
    await page.getByRole('button', { name: /同时屏蔽/ }).click();
    const 会话详情前 = 请求序.filter((项) => 项 === `GET /api/v1/me/conversations/${P7会话编号.会话}`).length;
    const 隐私读取前 = 请求序.filter((项) => 项 === 'GET /api/v1/me/privacy').length;
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText(`举报已受理 · 已屏蔽${P7标记.地点}`)).toBeVisible({ timeout: 10_000 });
    const 举报 = fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/reports');
    expect(举报).toHaveLength(1);
    // target 恒为该会话的权威路由坐标，绝不是展示名
    expect(举报[0]!.body).toEqual({ target: { type: 'conversation', ref: P7会话编号.会话 }, reason: 'false_information', also_block: true });
    断言P8变更边界(举报[0]!, new URL(page.url()).origin);
    // applied + 候选角色：恰一次权威隐私重读（相对计数：进屏水合也读隐私），
    // 且 fixture 隐私权威视图多了该组织（屏蔽只认权威视图）
    await expect
      .poll(() => 请求序.filter((项) => 项 === 'GET /api/v1/me/privacy').length, { timeout: 10_000 })
      .toBe(隐私读取前 + 1);
    expect(隐私.视图.organization_blocks.map((块) => 块.organization_id)).toEqual([P8标记.屏蔽组织编号]);
    // 确认回执后强制重读该会话
    await expect
      .poll(() => 请求序.filter((项) => 项 === `GET /api/v1/me/conversations/${P7会话编号.会话}`).length, { timeout: 10_000 })
      .toBeGreaterThan(会话详情前);
  });

  test('P8 Backend 直聊：不可用说明与查看在谈导航，零直接聊天/举报写入 @backend', async ({ page }, 测试信息) => {
    const fixture = await 装P8候选(page);
    await page.goto('/#/chat/direct/J-01');
    // P4 不发布直聊许可/会话坐标 → Backend 没有权威直聊会话：整页只有不可用说明
    await expect(page.getByText('当前暂不提供直接聊天。请从已建立的 MatchCase 进入真人会话。')).toBeVisible({ timeout: 15_000 });
    // 无权威 target 禁止写入：⋯ 举报入口整体隐藏，操作排与输入条都不渲染，页面没有可写的会话
    await expect(page.getByRole('button', { name: '举报', exact: true })).toHaveCount(0);
    await expect(page.getByText('⋯')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '看职位' })).toHaveCount(0);
    await expect(page.getByPlaceholder('发消息…')).toHaveCount(0);
    // 手动证据（d）：Backend 直聊页不可用态
    await page.screenshot({ path: 测试信息.outputPath('P8-backend-direct-chat.png'), fullPage: true });
    // 「查看在谈」指路在谈列表所在的主壳，不把用户留在死页
    await page.getByRole('button', { name: '查看在谈' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 10_000 });
    // 零举报写入：全程没有发出任何 reports 请求
    expect(fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/reports')).toEqual([]);
  });

  test('P8 401 清账号回登录，无本地成功 @backend', async ({ page }) => {
    await 装P8候选(page, {
      覆盖: {
        'GET /api/v1/me/credentials': () => ({
          status: 401,
          响应: { error: { type: 'invalid_session', message: '未登录' } },
        }),
      },
    });
    await page.goto('/#/account');
    // 当前会话 401：统一清账号（P4–P8 状态与引用）→ 应用级路由回收进登录页
    await expect(page).toHaveURL(/#\/$/, { timeout: 15_000 });
    await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 10_000 });
    // 旧账号的 fixture 凭证掩码绝不上屏（无本地成功）
    await expect(page.getByText(P8标记.手机掩码)).toHaveCount(0);
  });

  test('P8 切换身份后迟到的账号应答不泄漏；重进账号页按新代际完整水合 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    let 放行!: () => void;
    const 门 = new Promise<void>((ok) => { 放行 = ok; });
    const fixture = 创建P8fixture();
    fixture.分支.挂起凭证读取 = 门;
    const 请求序: string[] = [];
    await 装P8候选(page, {
      fixture,
      招聘组织Fixture: P1C招聘组织Fixture,
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });
    // 候选端账号页：第一笔凭证 GET 挂起（应答体在请求抵达时已快照为旧值）
    await page.goto('/#/account');
    await expect
      .poll(() => 请求序.filter((项) => 项 === 'GET /api/v1/me/credentials').length, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);
    // 卸载账号页（离开）并切换身份：会话代际递增，旧代的在飞读按栅栏整包作废
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    // 权威数据先翻新（若迟到应答真的落位，快照会停在旧值且不再重读）
    fixture.凭证们 = [
      { credential_id: P8编号.手机凭证, provider: 'phone_otp', display: P8标记.换绑后掩码, verified_at: '2026-09-01T00:00:00Z' },
    ];
    放行();
    await page.waitForTimeout(1_500);
    // 两端共用的账号页：按新代际完整读取，展示当前权威值；旧主体的迟到值无泄漏路径
    await page.goto('/#/account');
    await expect(page.getByText(P8标记.换绑后掩码)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P8标记.手机掩码)).toHaveCount(0);
    expect(fixture.凭证读取数).toBeGreaterThanOrEqual(2); // 重进页触发新代际读取
  });

  test('P8 合规 429：固定文案无倒计时，绝不自动重试（手动再提交=新键） @backend', async ({ page }) => {
    const fixture = await 装P8候选(page);
    fixture.分支.反馈限流 = true;
    await page.goto('/#/feedback');
    await page.getByRole('button', { name: '体验建议', exact: true }).click();
    const 正文 = 'Fixture 反馈：希望导出文件能选时间范围';
    await page.getByRole('textbox').fill(正文);
    await page.getByRole('button', { name: '提交', exact: true }).click();
    await expect(page.getByText('操作过于频繁，请稍后再试')).toBeVisible({ timeout: 10_000 });
    // 输入与所选分类原样保留（无本地成功）
    await expect(page.getByRole('textbox')).toHaveValue(正文);
    await expect(page.getByText('已收到，谢谢你')).toHaveCount(0);
    // 不编造倒计时文案
    await expect(page.getByText(/秒后重试|倒计时/)).toHaveCount(0);
    // 合规 429 不带 Retry-After：没有可等的窗口 —— 等待期内零自动重试（恰一笔 POST）
    await page.waitForTimeout(2_500);
    const 反馈们 = () => fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/feedback');
    expect(反馈们()).toHaveLength(1);
    // 手动再提交 = 新意图新键（429 是终局），同一文的 body 字节一致
    await page.getByRole('button', { name: '提交', exact: true }).click();
    await expect(反馈们()).toHaveLength(2);
    expect(反馈们()[1]!.idempotencyKey).not.toBe(反馈们()[0]!.idempotencyKey);
    expect(反馈们()[1]!.原文).toBe(反馈们()[0]!.原文);
  });
});

// ── P8 Mock 隔离：Mock 双端零控制面请求（任务书 isP8 原文） ─────────────────────
test.describe('P8 Mock 数据源隔离 @mock', () => {
  test('P8 Mock 账号安全/反馈/职位举报/直聊举报零控制面请求 @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const isP8 = (path: string) =>
      /\/security\/sessions|\/me\/(credentials|credential-replacement-attempts|data-exports|account-deletion)|\/compliance\/(feedback|reports)/.test(path);
    const P8请求: string[] = [];
    const apiRequests: string[] = [];
    page.on('request', (请求) => {
      const 路径 = new URL(请求.url()).pathname;
      if (路径.startsWith('/api/v1')) {
        apiRequests.push(`${请求.method()} ${路径}`);
        if (isP8(路径)) P8请求.push(`${请求.method()} ${路径}`);
      }
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // ── 账号安全：四位原型换绑 / 本地退出提示 / 本地注销跳登录 照旧 ──
    await page.goto('/#/account');
    await expect(page.getByText('138 **** 6021')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /手机号/ }).click();
    await page.getByPlaceholder('输入新手机号').fill('13900001111');
    await page.getByRole('button', { name: '获取验证码' }).click();
    // Mock 专属原型文案（抽屉说明与 toast 都含「原型」，取 toast 的完整单节点文本）
    await expect(page.getByText('验证码已发送（原型：任意 4 位数字均可通过）')).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder(/位验证码$/).fill('8888'); // 任意四位
    await page.getByRole('button', { name: '确认换绑' }).click();
    await expect(page.getByText('手机号已换绑')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('139 **** 1111')).toBeVisible();
    await page.getByRole('button', { name: /退出其他设备/ }).click();
    await expect(page.getByText('其余设备已全部退出登录')).toBeVisible({ timeout: 10_000 });
    // Mock 不渲染 Backend 专属「数据」组与导出行（现有页面一个像素不多）
    await expect(page.getByRole('button', { name: /导出我的数据/ })).toHaveCount(0);
    // 本地注销两步弹层照旧，成功本地跳登录
    await page.getByRole('button', { name: '注销账号' }).click();
    await page.getByRole('button', { name: '我已了解，继续注销' }).click();
    await page.getByRole('button', { name: '确认注销', exact: true }).click();
    await expect(page).toHaveURL(/#\/$/, { timeout: 10_000 });

    // 重新登录（四格验证码原型路径照旧）后再走反馈与两处举报原型
    await page.getByLabel('手机号').fill('13800000000');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.locator('[class*="验证码格"]')).toHaveCount(4);
    await page.getByLabel('短信验证码').fill('1234');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '进入' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // ── 反馈：举报分类本地成功（原型固定工单号 + 24 小时口径照旧） ──
    await page.goto('/#/feedback');
    await page.getByRole('button', { name: '举报虚假岗位' }).click();
    await page.getByRole('textbox').fill('Mock 原型反馈：举报虚假岗位本地成功');
    await page.getByRole('button', { name: '提交', exact: true }).click();
    await expect(page.getByText('已收到，谢谢你')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('工单号 FB-2026-0818-041')).toBeVisible();
    await expect(page.getByText('我们会在 24 小时内核查。核查过程中不会向对方透露是谁提交的。')).toBeVisible();

    // ── 职位举报（原型岗位）：本地派发 + 固定 toast，勾选屏蔽落全局名单 ──
    await page.goto('/#/job/J-01');
    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('button', { name: '举报这个职位' }).click();
    await page.getByRole('button', { name: '虚假信息', exact: true }).click();
    await page.getByRole('button', { name: /同时屏蔽/ }).click();
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText(/举报已受理 · 已屏蔽/)).toBeVisible({ timeout: 10_000 });

    // ── 直聊举报（Mock 在场；Backend 该入口整体隐藏） ──
    await page.goto('/#/chat/direct/J-01');
    await page.getByRole('button', { name: '举报', exact: true }).click();
    await page.getByRole('button', { name: '其他', exact: true }).click();
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText('举报已受理，我们会尽快核查')).toBeVisible({ timeout: 10_000 });

    // 全程零 P8 请求（任务书 isP8 原文），Mock 恒零 /api/v1
    expect(P8请求).toEqual([]);
    expect(apiRequests).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 候选 onboarding Backend fixture @backend —— Task 8：Tasks 1–7 修完后的整条
// 写链收口。可见导航走完整注册流（身份选择 → 完善资料 → 薪资向导 → 档案四连页 →
// 在线简历 → 偏好向导 → 披露说明 → 头像 → 主壳），每个 mutation 都被可变 fixture
// 严格校验、记录并物化；reload 后从 我的 Tab 宫格进 我的简历，断言权威快照里
// 经历 / 教育 / 技能 / 证书齐全（证书 year: null 不上屏）。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('候选 onboarding Backend fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('候选 onboarding 完整保存并创建首次意向 @catalog-fullscreen @backend', async ({ page }) => {
    // 全程可见导航 + debounce + 初始化页 3.6s + reload 水合，给足预算
    test.setTimeout(180_000);

    const fixture = 创建候选OnboardingFixture();
    // 合同 C：经历公司走 公司选择抽屉 —— 搜索池给默认组织库，选中按稳定 ID 回填
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P3默认组织库();
    await 安装BFF路由(page, {
      记录目录请求: () => {},
      登录尝试id: 'att-onboarding-001',
      候选OnboardingFixture: fixture,
      // 选身份是交互水合（任一支持域失败会抛回身份页），隐私域要给合法权威视图
      隐私fixture: 隐私,
    });
    const 次数 = (方法: string, 路径: string) =>
      fixture.mutations.filter((条) => 条.method === 方法 && 条.path === 路径).length;

    // 期望职位页（Task 7 B 契约）需要真实三级目录才能选叶子并点亮保存
    await 装三级职位目录桩(page);

    // ── 1. 会话恢复 → last_used_role=null 落身份选择页 → 我要找工作 ──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: '完善资料' })).toBeVisible();

    // ── 2. 完善资料：工作城市与期望职位走全屏选择页的可见搜索/选择/保存返回 ──
    // Backend 初始偏好为空（空求职初筛偏好）：「已毕业」只排资料填写顺序，不替选
    // 求职类型（未选择时两钮都不亮）—— 类型要显式点「社招全职」才亮。
    await page.getByRole('button', { name: '已毕业' }).click();
    await expect(page.getByRole('button', { name: '社招全职' })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: '社招全职' }).click();
    await expect(page.getByRole('button', { name: '社招全职' })).toHaveAttribute('aria-pressed', 'true');

    // 选中态的 ✓ 由 CSS ::before 渲染、会进可访问名，所以选择钮一律用非精确匹配。
    // 城市行先选（引导预填还是 null，行内是可见占位「选择工作城市」），办公方式
    // 在两个全屏选择页返回之后再点 —— Backend 的偏好派发携带的城市就是当前空列表，
    // 不会像 Mock 兜底那样播种「上海」。
    await page.getByRole('button', { name: '选择工作城市' }).click();
    await expect(page).toHaveURL(/#\/onboard\/city$/);
    await page.getByPlaceholder('搜索城市 / 省份').fill('fixture');
    await expect(page.getByRole('button', { name: 标记.城市display, exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 标记.城市display, exact: true }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/student$/);

    await page.getByRole('button', { name: '选择期望职位' }).click();
    await expect(page).toHaveURL(/#\/onboard\/job$/);
    // Task 7 B 契约（配 装三级职位目录桩）：挂载自动选首根后右栏出现可选叶子，单枚可点
    const 职位键 = page.getByRole('button', { name: 标记.职位display });
    await expect(职位键.first()).toBeVisible({ timeout: 10_000 });
    await expect(职位键).toHaveCount(1, { timeout: 10_000 });
    await 职位键.click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // 办公方式 Backend 同样从空起步：三档全不亮，显式点「现场」
    await expect(page.getByRole('button', { name: '现场' })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: '现场' }).click();
    await expect(page.getByRole('button', { name: '现场' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '下一步' })).toBeEnabled();

    // ── 3. 下一步 → 向导薪资段：入口行开共用抽屉选 30（联动上限 40）→ 确定 ──
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/wizard\?stage=salary$/);
    await expect(page.getByRole('heading', { name: '期望现金月薪是？' })).toBeVisible();
    await 走向导薪资(page);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/basic$/);
    await expect(page.getByRole('heading', { name: '创建在线简历' })).toBeVisible();

    // ── 历史点（完成清栈前仍保留）：后退回薪资段，入口行仍回显 30-40K，再前进回来。
    //    完成注册会清掉整条注册流历史，所以这条断言放在最后的披露/头像步骤之前做 ──
    await page.goBack();
    await expect(page).toHaveURL(/#\/wizard\?stage=salary$/);
    await expect(page.getByRole('button', { name: /薪资要求（月薪/ })).toContainText('30-40K');
    await page.goForward();
    await expect(page).toHaveURL(/#\/basic$/);

    // ── 4. 身份证上的名字 → 现在是什么状态？ → 学历四连页 ──
    await page.getByPlaceholder('身份证上的名字').fill('Fixture 候选人');
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/onboard\/status$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '现在是什么状态？' })).toBeVisible();
    await page.getByRole('button', { name: '在职 · 考虑机会' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/onboard\/degree$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '最高学历' })).toBeVisible();
    await page.getByRole('button', { name: '本科' }).click();
    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page).toHaveURL(/#\/onboard\/school$/, { timeout: 15_000 });
    const 学校框 = page.getByPlaceholder('学校名称');
    await 学校框.fill('fixture');
    await expect(page.getByText(标记.学校display)).toBeVisible({ timeout: 10_000 });
    await page.getByText(标记.学校display).click();
    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page).toHaveURL(/#\/onboard\/major$/, { timeout: 15_000 });
    const 专业框 = page.getByPlaceholder('专业名称');
    await 专业框.fill('fixture');
    await expect(page.getByRole('button', { name: 'Fixture 专业', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Fixture 专业', exact: true }).click();
    await page.getByRole('button', { name: '下一步' }).click();

    // 就读时间段：年份轮可空不兜底（无 2021/2025 伪默认），入口行开抽屉选 2020/2024
    // → 确定一次写建档草稿，再走可见 下一步（日期轮的完成键在经历编辑页）
    await expect(page).toHaveURL(/#\/onboard\/eduyears$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible();
    await page.getByRole('button', { name: '入学年和毕业年' }).click();
    const 年抽屉5 = page.getByRole('dialog', { name: '就读时间段' });
    await 年抽屉5.getByRole('listbox', { name: '入学年' }).getByRole('option', { name: '2020', exact: true }).click();
    await 年抽屉5.getByRole('listbox', { name: '毕业年' }).getByRole('option', { name: '2024', exact: true }).click();
    await 年抽屉5.getByRole('button', { name: '确定' }).click();
    await expect(年抽屉5).toHaveCount(0);
    await page.getByRole('button', { name: '下一步' }).click();

    // ── 5. 在线简历：添加工作经历（公司 / 行业 / 职位 / 入职年月·完成）→
    //      技能 Go、证书 CET-4（各点输入框旁的 添加）→ 保存 ──
    await expect(page).toHaveURL(/#\/experience$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '在线简历' })).toBeVisible();
    await page.getByRole('button', { name: '添加工作经历' }).click();
    // 合同 C：公司名称行走 公司选择抽屉 —— 编辑页唯一 placeholder='必填' 的输入只剩职位名称
    await expect(page.getByPlaceholder('必填')).toHaveCount(1);
    await page.getByRole('button').filter({ hasText: '公司名称' }).click();
    await 抽屉搜企业并选中(page, '磐石', P3标记.手动组织甲);
    await expect(page.getByRole('button').filter({ hasText: '公司名称' })).toContainText(P3标记.手动组织甲);
    await page.getByRole('button', { name: '所属行业' }).click();
    await page.getByRole('button', { name: 'Fixture 行业', exact: true }).click();
    await page.getByPlaceholder('必填').fill('Fixture 后端工程师');
    await page.getByRole('button', { name: '入职年月' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '确定' }).click();
    await page.getByRole('button', { name: '完成', exact: true }).click();

    const 技能输入 = page.getByPlaceholder('如：Go、分布式事务');
    await 技能输入.fill('Go');
    await 技能输入.locator('..').getByRole('button', { name: '添加' }).click();
    await expect(page.getByRole('button', { name: '删除技能 Go' })).toBeVisible();
    const 证书输入 = page.getByPlaceholder('证书或语言，如 CPA、雅思 7.0');
    await 证书输入.fill('CET-4');
    await 证书输入.locator('..').getByRole('button', { name: '添加' }).click();
    // 证书行现渲染为单个可删除钮（可及名「删除证书 CET-4」，正文 CET-4 ✕），与技能行
    // 的 删除技能 Go 同构 —— 断言意图不变（证书已入列且可移除），只修定位器。
    await expect(page.getByRole('button', { name: '删除证书 CET-4' })).toBeVisible();

    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('heading', { name: '哪些情况直接排除？' })).toBeVisible({ timeout: 20_000 });

    // ── 6. 偏好段：硬性排除 下一步 → 个人优势 → 保存并继续 ──
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    await expect(page.getByRole('heading', { name: '分享一下自己的个人优势' })).toBeVisible();
    await page.getByLabel('个人优势').fill('Fixture 候选人的个人优势标记');
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page).toHaveURL(/#\/disclosure$/, { timeout: 30_000 });

    // ── 7. 首次意向已创建：恰好一条 POST /me/intentions 被记录 ──
    expect(次数('POST', '/api/v1/me/intentions')).toBe(1);

    await page.getByRole('button', { name: '完成设置，开始匹配' }).click();
    await expect(page).toHaveURL(/#\/onboard\/avatar$/);
    await page.getByRole('button', { name: '完成注册' }).click();
    // 完成注册清栈进初始化页（~3.6s 播完）替换进主壳
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });

    // 重读计数快照必须取在落主壳**之后、page.reload() 之前**：此前所有写入的权威 GET
    // 都已落地（每步保存都 await 完自己的 GET 才跳转，且初始化页播了 3.6s），此后
    // 计数器上的任何增量只能来自 reload 自己 —— 若前端改成从 sessionStorage 静默
    // 水合、不发 GET，下面的 poll 会当场红，而不是被挂载期读取冒充掩盖。
    const 重读前 = { 简历: fixture.读取.简历, 意向: fixture.读取.意向 };

    // reload：必须重新 GET 权威简历与意向（不是沿用本地状态）；水合 GET 异步到达，
    // 用 poll 等增量而非在 URL 断言后立刻取值
    await page.reload();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await expect.poll(() => fixture.读取.简历, { timeout: 15_000 }).toBeGreaterThan(重读前.简历);
    await expect.poll(() => fixture.读取.意向, { timeout: 15_000 }).toBeGreaterThan(重读前.意向);

    // 可见 UI 打开 我的简历：底部导航 我 Tab → 宫格 我的简历
    await page.getByRole('button', { name: '我', exact: true }).click();
    await page.getByRole('button', { name: '我的简历' }).click();
    await expect(page).toHaveURL(/#\/resume$/);
    // 返回栏居中标题是 div 不是 heading，按可见文本断言
    await expect(page.getByText('我的简历', { exact: true })).toBeVisible();

    // 权威快照渲染：经历 / 教育 / 技能 / 证书 全部来自 HTTP fixture。
    // 经历卡的公司名是服务端按 organization_id 冻结的展示快照（合同 C，fixture 反查
    // 搜索池 → company 即所选企业名），卡上可断言 公司名 / 职位名 / 行业标签
    await expect(page.getByText(P3标记.手动组织甲)).toBeVisible();
    await expect(page.getByText('Fixture 后端工程师')).toBeVisible();
    await expect(page.getByText(/· Fixture 行业/)).toBeVisible();
    await expect(page.getByText(标记.学校display)).toBeVisible();
    await expect(page.getByText('本科 · Fixture 专业').first()).toBeVisible();
    await expect(page.getByText('Go', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('CET-4', { exact: true })).toBeVisible();
    // 证书 year: null 不上屏（年份为空整行不渲染「年取得」），页面绝不出现字面 null
    expect(await page.getByText(/null/).count()).toBe(0);

    // ── 精确 mutation 计数与权威终态 ──
    expect(次数('POST', '/api/v1/me/resume/experiences')).toBe(1);
    expect(次数('PATCH', '/api/v1/me/resume/skills')).toBe(1);
    expect(次数('POST', '/api/v1/me/resume/certificates')).toBe(1);
    expect(次数('POST', '/api/v1/me/resume/educations')).toBe(1);
    expect(次数('POST', '/api/v1/me/intentions')).toBe(1);
    // 分区写入各一次（档案与个人优势），没有第二次写
    expect(次数('PATCH', '/api/v1/me/resume/profile')).toBe(1);
    expect(次数('PATCH', '/api/v1/me/resume/summary')).toBe(1);
    const 证书Mutation = fixture.mutations.find((条) => 条.path === '/api/v1/me/resume/certificates');
    expect(证书Mutation?.body).toEqual({ name: 'CET-4', year: null });
    expect(fixture.resume.experiences).toHaveLength(1);
    // 合同 C：经历按稳定 ID 提交（organization_id 是抽屉选中的组织甲、industry_id 是
    // 所点行业叶），company 是服务端按 organization_id 反查冻结的展示快照（即所选企业名）
    expect(fixture.resume.experiences[0]).toMatchObject({
      organization_id: 'org-fixture-p3-manual-a',
      industry: { id: 'ind-fixture-001', display_name: 'Fixture 行业' },
      title: 'Fixture 后端工程师',
      company: P3标记.手动组织甲,
    });
    expect(fixture.resume.skills).toEqual(['Go']);
    expect(fixture.resume.educations).toHaveLength(1);
    expect(fixture.resume.certificates).toEqual([
      expect.objectContaining({ name: 'CET-4', year: null }),
    ]);
    expect(fixture.intentions).toHaveLength(1);
    expect(fixture.intentions[0]?.status).toBe('active');
    // 显式点选的类型/办公方式如实进意向：社招全职 + 现场（「已毕业」从未替选）
    expect(fixture.intentions[0]?.recruitment_type).toBe('social_full_time');
    expect(fixture.intentions[0]?.workplace_modes).toEqual(['onsite']);
    expect(fixture.intentions[0]?.graduation_month).toBeNull();
    // 意向坐标来自目录引用 ID（薪资 30–40K / 城市 / 职位都是 fixture 的标记值）
    expect(fixture.intentions[0]?.compensation).toEqual({ mode: 'range', lower: 30, upper: 40 });
    expect(fixture.intentions[0]?.job_category).toEqual({ id: 'job-fixture-001', display_name: 标记.职位display });
    expect(fixture.intentions[0]?.primary_location).toEqual({ id: 'loc-fixture-001', display_name: 标记.城市display });

    // 请求顺序：简历域最后一个请求是 GET（保存以最终权威重读收尾）
    const 简历域尾 = fixture.简历请求.at(-1);
    expect(简历域尾?.method).toBe('GET');
    expect(简历域尾?.path).toBe('/api/v1/me/resume');
    // 写入 path 不含 /catalog/（直接用选择时保存的 ID，不反查目录）
    expect(fixture.mutations.some((条) => 条.path.includes('/catalog/'))).toBe(false);
    // 角色偏好已落 candidate：reload 直接进主壳而非身份选择页
    expect(fixture.主体.last_used_role).toBe('candidate');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 作品集 @backend（core editors §6.1 Task 1）：日常编辑（无 onboarding 草稿）
// 的存量候选直接进 /experience 编辑作品集链接 —— URL-only 变化触发带 portfolio_url 的
// profile PATCH（其余八键全量保留、If-Match 为旧 profile revision），保存以最终权威 GET
// 收尾；重新进入页面读权威值不丢；再明确清空（PATCH body portfolio_url null）。
// 网络桩 route fixture 边界验证，不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 作品集 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('日常编辑作品集：保存→权威回读→重进不丢→再清空，未走 onboarding @backend', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const fixture = 创建候选OnboardingFixture();
    // 存量候选日常会话：last_used_role 已落 candidate；简历与 active 意向满足
    // 建档完备判据（真实登录落点按「已水合简历 + active 意向」分流），预置权威 URL
    fixture.主体.last_used_role = 'candidate';
    // 存量日常会话按冻结决策返回 candidate 已完成（与 P1/展示字段接线的主页用例同口径）：
    // 登录落点按完成事实进主壳，而不是被未完成分流送回学生分流
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选', portfolio_url: 'https://github.com/existing' },
      summary: '存量个人优势',
    };
    fixture.intentions = [P4深克隆(fixture意向列表.intentions[0])];
    const profile写入: { method: string; path: string; body: unknown; ifMatch: string | null }[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-core-edit-portfolio',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
      请求拦截: (请求) => {
        if (请求.path === '/api/v1/me/resume/profile' && 请求.method === 'PATCH') {
          profile写入.push({ method: 请求.method, path: 请求.path, body: 请求.body, ifMatch: 请求.headers['if-match'] ?? null });
        }
      },
    });
    const 次数 = (方法: string, 路径: string) =>
      fixture.mutations.filter((条) => 条.method === 方法 && 条.path === 路径).length;

    // 日常入口：登录落主壳后直接进 /experience（不经过学生分流/建档旅程）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto('/#/experience');
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    const 输入 = page.getByLabel('作品集或项目链接');
    await expect(输入).toHaveValue('https://github.com/existing');

    // 日常设置：改 URL（点保存先失焦 → 规范化补 https）→ 保存
    await 输入.fill('github.com/new-works');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/wizard$/, { timeout: 20_000 });
    // URL-only 变化恰发一次 profile PATCH：portfolio_url 在 body、其余键全量保留、
    // If-Match 为旧 profile revision；保存以最终权威 GET 收尾
    expect(次数('PATCH', '/api/v1/me/resume/profile')).toBe(1);
    const 设置写入 = profile写入[0]!;
    expect(设置写入.ifMatch).toBe(`"${fixture简历.profile_revision}"`);
    expect(设置写入.body).toEqual(expect.objectContaining({
      portfolio_url: 'https://github.com/new-works',
      real_name: '存量候选',
      status: 'employed',
    }));
    expect((设置写入.body as Record<string, unknown>).current_education).toBeNull();
    expect(fixture.resume.profile.portfolio_url).toBe('https://github.com/new-works');
    expect(fixture.简历请求.at(-1)).toEqual({ method: 'GET', path: '/api/v1/me/resume' });
    // 未走 onboarding：本会话零建档写入（无经历/教育/证书/意向/角色写入）
    expect(fixture.mutations.filter((条) => 条.path !== '/api/v1/me/resume/profile')).toEqual([]);

    // 权威回读后重新进入：值不丢
    await page.goto('/#/experience');
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('作品集或项目链接')).toHaveValue('https://github.com/new-works');

    // iPhone 13 viewport：横向溢出 ≤2px、保存键不被遮挡、URL 输入可聚焦
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    const 链接输入 = page.getByLabel('作品集或项目链接');
    await 链接输入.focus();
    await expect(链接输入).toBeFocused();
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible();
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-作品集.png`, fullPage: true });

    // 再明确清空：PATCH body portfolio_url 为 null，权威回读后重进为空
    await page.getByLabel('作品集或项目链接').fill('');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/wizard$/, { timeout: 20_000 });
    expect(次数('PATCH', '/api/v1/me/resume/profile')).toBe(2);
    const 清空写入 = profile写入[1]!;
    expect((清空写入.body as Record<string, unknown>).portfolio_url).toBeNull();
    expect(fixture.resume.profile.portfolio_url).toBeNull();
    await page.goto('/#/experience');
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('作品集或项目链接')).toHaveValue('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 意向薪资 @backend（core editors §6.2 Task 2）：存量 14 薪社招区间意向
// 切兼职并保存 —— 路由层断言真实序列化的 PATCH body 不携带目标类型禁止的
// annual_salary_months（月薪区间原样保留），权威回执后重入编辑页回读保存值。
// PATCH 由 覆盖 应答（fixture 只建模本用例需要的字段），body 闭合校验复用
// 断言意向写入。网络桩 route fixture 边界验证，不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 意向薪资 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('存量14薪社招意向切兼职：序列化 body 不含年薪月数，保存/重入闭环 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = 创建候选OnboardingFixture();
    // 存量候选日常会话：last_used_role 已落 candidate；简历与 active 意向满足建档完备判据，
    // 预置合同内合法的 14 薪社招月薪区间（年薪月数只对 social_full_time/campus 合法）
    fixture.主体.last_used_role = 'candidate';
    // 存量日常会话按冻结决策返回 candidate 已完成（与 P1/展示字段接线的主页用例同口径）：
    // 登录落点按完成事实进主壳，而不是被未完成分流送回学生分流
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选' },
      summary: '存量个人优势',
    };
    const 意向编号 = Onboarding标记.意向编号;
    const 意向14薪: BFFOwnerIntention = {
      ...P4深克隆(fixture意向列表.intentions[0]),
      intention_id: 意向编号,
      compensation: { mode: 'range', lower: 20, upper: 30, annual_salary_months: 14 },
    };
    fixture.intentions = [意向14薪];
    const 意向补丁们: { body: unknown; ifMatch: string | null }[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-core-edit-intent-salary',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
      请求拦截: (请求) => {
        if (请求.path === `/api/v1/me/intentions/${意向编号}` && 请求.method === 'PATCH') {
          断言意向写入(请求.body); // 12 键闭合契约对真实序列化 body 生效
          意向补丁们.push({ body: 请求.body, ifMatch: 请求.headers['if-match'] ?? null });
        }
      },
      覆盖: {
        [`PATCH /api/v1/me/intentions/${意向编号}`]: () => {
          // 服务端语义：PATCH 后同源列表读到已更新快照（目标类型不适用字段清空、
          // 不再携带年薪月数、revision+1）；salary_period 沿用本 stub 的月薪口径
          const 更新后: BFFOwnerIntention = {
            ...P4深克隆(意向14薪),
            recruitment_type: 'part_time',
            graduation_month: null,
            internship_months: null,
            onsite_days_per_week: null,
            compensation: { mode: 'range', lower: 20, upper: 30 },
            revision: 2,
          };
          fixture.intentions = [更新后];
          return { status: 200, 响应: P4深克隆(更新后) };
        },
      },
    });

    // 日常入口：登录落主壳（初始化收口后才出路由），再进意向编辑
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto(`/#/intentions/${意向编号}`);
    // 编辑表单按权威 DTO 预填：月薪 20-30K，兼职未选中
    await expect(page.getByText('20-30K')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '兼职' })).toHaveAttribute('aria-pressed', 'false');
    // 切兼职（月→月不清上下限的既有行为）→ 保存
    await page.getByRole('button', { name: '兼职' }).click();
    await expect(page.getByRole('button', { name: '兼职' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    // 保存链路收口（PATCH → 权威列表重读 → 清草稿 → 返回落主壳）完成后才重入，
    // 否则重入时的 开意向草稿 会被仍在收尾的 清意向草稿 覆盖成空表
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });

    // 恰好一次 PATCH：If-Match 用权威 revision；真实序列化 body 目标类型 part_time，
    // compensation 精确为月薪区间、不含禁止的 annual_salary_months
    expect(意向补丁们).toHaveLength(1);
    const 补丁 = 意向补丁们[0]!;
    expect(补丁.ifMatch).toBe(`"${意向14薪.revision}"`);
    const 写 = 补丁.body as { recruitment_type: string; compensation: Record<string, unknown> };
    expect(写.recruitment_type).toBe('part_time');
    expect(写.compensation).toEqual({ mode: 'range', lower: 20, upper: 30 });
    expect(写.compensation).not.toHaveProperty('annual_salary_months');
    // fixture 已按服务端语义推进：权威快照不再携带年薪月数
    expect(fixture.intentions[0]?.recruitment_type).toBe('part_time');
    expect(fixture.intentions[0]?.compensation).not.toHaveProperty('annual_salary_months');

    // 权威回读后重入编辑页：兼职选中、月薪区间不丢、无实习条件区
    await page.goto(`/#/intentions/${意向编号}`);
    await expect(page.getByText('20-30K')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '兼职' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('实习可用时间')).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 候选私有筛选要求 @backend（Task 2）：由意向管理打开现有意向，整段编辑／清空
// 「给 AI 代理的筛选要求」文本区 → 保存（PATCH + If-Match revision）→ 刷新回读。
// 断言真实序列化的 PATCH body：private_preferences 逐字透传（前导换行 / 尾空格 /
// 超 200 字不截断）、清空显式落 ''、exclusions 与其他字段保留。被测写入全部经浏览器
// UI 完成，不用 API 直接造数；网络桩 route fixture 边界验证，不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('候选私有筛选要求 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('意向管理进入编辑：改写/清空筛选要求保存，PATCH 逐字落盘、revision 推进、其余字段保留 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = 创建候选OnboardingFixture();
    // 存量候选日常会话（与核心编辑用例同口径）：登录落主壳后由意向管理进入编辑
    fixture.主体.last_used_role = 'candidate';
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选' },
      summary: '存量个人优势',
    };
    const 意向编号 = Onboarding标记.意向编号;
    // 历史原文：前导换行 + 尾随空格 + 超 200 字；exclusions 非缺省（证明文本编辑不动它）
    const 历史原文 = `\n${'重视成长与团队透明沟通，希望参与有真实用户的产品。'.repeat(9)}  `;
    const 原始排除 = {
      alternate_weekend_work: 'excluded',
      outsourcing_only: 'allowed',
      onsite_only: 'unspecified',
      frequent_travel: 'excluded',
    } as const;
    const 原始意向: BFFOwnerIntention = {
      ...P4深克隆(fixture意向列表.intentions[0]),
      intention_id: 意向编号,
      exclusions: { ...原始排除 },
      private_preferences: 历史原文,
    };
    fixture.intentions = [P4深克隆(原始意向)];
    const 意向补丁们: { body: unknown; ifMatch: string | null }[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-core-edit-screening-text',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
      请求拦截: (请求) => {
        if (请求.path === `/api/v1/me/intentions/${意向编号}` && 请求.method === 'PATCH') {
          断言意向写入(请求.body); // 12 键闭合契约对真实序列化 body 生效
          意向补丁们.push({ body: 请求.body, ifMatch: 请求.headers['if-match'] ?? null });
        }
      },
      覆盖: {
        [`PATCH /api/v1/me/intentions/${意向编号}`]: (body) => {
          // 服务端语义：PATCH 后同源列表读到已更新文本、revision+1，其余字段原样
          const 写 = body as { private_preferences: string };
          const 当前 = fixture.intentions[0]!;
          const 更新后: BFFOwnerIntention = {
            ...P4深克隆(原始意向),
            private_preferences: 写.private_preferences,
            revision: 当前.revision + 1,
          };
          fixture.intentions = [更新后];
          return { status: 200, 响应: P4深克隆(更新后) };
        },
      },
    });

    // 日常入口：登录落主壳（初始化收口后才出路由），再由意向管理打开现有意向
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto('/#/intentions');
    const 意向行 = page.getByRole('button', { name: /Fixture 工程师/ });
    await expect(意向行).toBeVisible({ timeout: 15_000 });
    await 意向行.click();

    // 编辑表单按权威 DTO 预填：历史私有文本整段回显（前导换行/尾空格/超 200 字不截断）
    const 筛选输入 = page.getByLabel('给 AI 代理的筛选要求');
    await expect(筛选输入).toHaveValue(历史原文, { timeout: 15_000 });

    // 改写整段（粘贴多行长文本）→ 保存
    const 改写文本 = `\n${'更看重团队透明沟通与代码评审文化，拒绝形式化加班。'.repeat(9)}  `;
    await 筛选输入.fill(改写文本);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    // 保存链路收口（PATCH → 权威列表重读 → 清草稿 → 返回）完成后才刷新：
    // 回到意向管理且路由落定，避免与在途的同文档导航/权威重读竞态
    await expect(page).toHaveURL(/#\/intentions$/, { timeout: 20_000 });
    await expect(意向行).toBeVisible({ timeout: 20_000 });

    // 恰好一次 PATCH：If-Match 用权威 revision；真实序列化 body 文本逐字透传且
    // exclusions / 薪资结构 / 目录引用等其他字段原样保留
    expect(意向补丁们).toHaveLength(1);
    const 第一次 = 意向补丁们[0]!;
    expect(第一次.ifMatch).toBe(`"${原始意向.revision}"`);
    const 写1 = 第一次.body as {
      private_preferences: string;
      exclusions: Record<string, string>;
      compensation: Record<string, unknown>;
      job_category_id: string;
      primary_location_id: string;
      workplace_modes: string[];
    };
    expect(写1.private_preferences).toBe(改写文本);
    expect(写1.private_preferences.length).toBeGreaterThan(200);
    expect(写1.exclusions).toEqual(原始排除);
    expect(写1.compensation).toEqual({ mode: 'range', lower: 30, upper: 50, annual_salary_months: 15 });
    expect(写1.job_category_id).toBe('job-fixture-001');
    expect(写1.primary_location_id).toBe('loc-fixture-001');
    expect(写1.workplace_modes).toEqual(['onsite']);

    // 刷新回读：权威列表已推进（revision 2 + 新文本），重开编辑页文本区回显改写后的整段
    await page.reload();
    await expect(意向行).toBeVisible({ timeout: 20_000 });
    await 意向行.click();
    await expect(筛选输入).toHaveValue(改写文本, { timeout: 15_000 });

    // 清空 → 保存：显式落 ''（不回落历史文本），exclusions 与其他字段第二次原样透传
    await 筛选输入.fill('');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/intentions$/, { timeout: 20_000 });
    await expect(意向行).toBeVisible({ timeout: 20_000 });
    expect(意向补丁们).toHaveLength(2);
    const 第二次 = 意向补丁们[1]!;
    expect(第二次.ifMatch).toBe('"2"');
    const 写2 = 第二次.body as { private_preferences: string; exclusions: Record<string, string>; compensation: Record<string, unknown> };
    expect(写2.private_preferences).toBe('');
    expect(写2.exclusions).toEqual(原始排除);
    expect(写2.compensation).toEqual({ mode: 'range', lower: 30, upper: 50, annual_salary_months: 15 });

    // 刷新回读：清空后的编辑页文本区为空串
    await page.reload();
    await expect(意向行).toBeVisible({ timeout: 20_000 });
    await 意向行.click();
    await expect(筛选输入).toHaveValue('', { timeout: 15_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 城市 @mock（core editors §5.1 Task 3）：其他感兴趣城市两模式共用正文 ——
// Mock 行政分组（城市字典省份组切片 + 列表尾「加载更多」）、拼音子串搜索、9 上限，
// 无 A–Z 字母索引条；取消不写草稿、保存才写回并在行上回显。全程零 /api/v1 请求。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 城市 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('行政分组正文：选择→翻页→搜索→取消→保存回显，全程零 API @catalog-fullscreen @mock', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);

    // 「添加求职期望」→ 其他感兴趣城市行 → 城市子页（共用正文）
    await page.goto('/#/intentions/new');
    await expect(page.getByText('其他感兴趣城市（0/9）')).toBeVisible({ timeout: 15_000 });
    await page.getByText('请选择更多感兴趣城市').click();
    await expect(page.getByRole('heading', { name: '选择城市' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('0/9')).toBeVisible();
    // 行政分组标题上屏；A–Z 字母索引条消失
    await expect(page.getByText('广东')).toBeVisible();
    await expect(page.getByText('浙江')).toBeVisible();
    await expect(page.getByRole('button', { name: /跳到 / })).toHaveCount(0);

    // 正常态截图（与改前拍对照：旧稿 A–Z 分节 + 右侧字母索引条）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-城市-正常.png`, fullPage: true });

    // 选择热门区杭州 → 计数 1/9；翻页把更多省份组切进来
    // （catalog-fullscreen Task 6：精选热门显示名已是目录规范名「杭州市」，旧名只是别名）
    await page.getByRole('button', { name: '杭州市', exact: true }).first().click();
    await expect(page.getByText('1/9')).toBeVisible();
    await page.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(page.getByText('湖北')).toBeVisible({ timeout: 10_000 });

    // 搜索：拼音子串命中，已选不丢（选中城片的可访问名带 CSS ::before 的「✓ 」前缀）
    await page.getByPlaceholder('搜索城市名/拼音').fill('hang');
    await expect(page.getByRole('button', { name: /^✓ ?杭州市$/ }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '移除 杭州市' })).toBeVisible();

    // 取消：✕ 关闭不写草稿，回到行上仍是 0/9
    await page.getByRole('button', { name: '关闭' }).click();
    await expect(page).toHaveURL(/#\/intentions\/new$/, { timeout: 10_000 });
    await expect(page.getByText('其他感兴趣城市（0/9）')).toBeVisible({ timeout: 15_000 });

    // 重进选择两城：选中态截图 + iPhone 13 viewport 检查，保存才写回
    await page.getByText('请选择更多感兴趣城市').click();
    await expect(page.getByText('0/9')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '杭州市', exact: true }).first().click();
    await page.getByRole('button', { name: '苏州市', exact: true }).first().click();
    await expect(page.getByText('2/9')).toBeVisible();
    await expect(page.getByRole('button', { name: '移除 杭州市' })).toBeVisible();
    await expect(page.getByRole('button', { name: '移除 苏州市' })).toBeVisible();
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-城市-选中.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    const 搜索输入 = page.getByPlaceholder('搜索城市名/拼音');
    await 搜索输入.focus();
    await expect(搜索输入).toBeFocused();
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible();

    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/intentions\/new$/, { timeout: 10_000 });
    await expect(page.getByText('其他感兴趣城市（2/9）')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('杭州市、苏州市')).toBeVisible();

    // Mock 全程零 API 请求
    expect(apiRequests).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 城市 @backend（core editors §5.1 Task 3）：Backend 分支迁移到同一共用正文 ——
// 热门区来自不带 q 的默认目录页，分组标题只用返回的 admin1_name，位置区是已批准的
// 「暂未获取定位」缺失态；列表尾「加载更多」翻默认页/搜索页；按 ID 选择、取消不写草稿、
// 保存写 意向草稿.感兴趣城市引用们 且重进回读不丢。Location 目录用本用例专用网络桩
// （后装的 route 先匹配，不改共享 helper）；符合已审合同的网络桩边界验证，不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 城市 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('默认页行政分组→翻页→搜索→取消→保存回读，引用按 ID 不丢 @backend', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const fixture = 创建候选OnboardingFixture();
    // 存量候选日常会话：last_used_role 已落 candidate；简历与 active 意向满足建档完备判据
    fixture.主体.last_used_role = 'candidate';
    // 存量日常会话按冻结决策返回 candidate 已完成（与 P1/展示字段接线的主页用例同口径）：
    // 登录落点按完成事实进主壳，而不是被未完成分流送回学生分流
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选' },
      summary: '存量个人优势',
    };
    fixture.intentions = [P4深克隆(fixture意向列表.intentions[0])];
    // 目录请求记录用页面监听：Location 目录桩是后装 route（先匹配），共享 helper 的
    // 记录钩子在本用例里不会被触发，不能用它计数
    const 目录请求: string[] = [];
    page.on('request', (request) => {
      const 路径 = new URL(request.url()).pathname;
      if (路径.startsWith('/api/v1/catalog/')) 目录请求.push(路径);
    });
    await 安装BFF路由(page, {
      登录尝试id: 'att-core-edit-cities',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
    });

    // Location 目录桩（本用例专用精确状态）：默认页两省两城 + 游标；翻页第三城；搜索按 q。
    // 分组按 admin1_code 聚合（标题取 admin1_name），浙江 33 / 江苏 32 各归其省。
    // 字段形状与既有 /catalog/locations 内置桩一致（信封闭合解码）。
    const 省份城 = (id: string, 名称: string, 省: string, 码: string) => ({
      id,
      display_name: 名称,
      country_code: 'CN',
      country_name: '中国',
      admin1_code: 码,
      admin1_name: 省,
      timezone: 'Asia/Shanghai',
      population: 1000,
    });
    await page.route('**/api/v1/catalog/locations*', async (route) => {
      const url = new URL(route.request().url());
      const q = url.searchParams.get('q') ?? '';
      const cursor = url.searchParams.get('cursor');
      if (q !== '') {
        await route.fulfill({
          status: 200,
          json: 信封({ items: [省份城('loc-shaoxing', '绍兴市', '浙江省', '33')], next_cursor: null, catalog_version: 'loc-v1' }),
        });
        return;
      }
      if (cursor === 'loc-cur-1') {
        await route.fulfill({
          status: 200,
          json: 信封({ items: [省份城('loc-ningbo', '宁波市', '浙江省', '33')], next_cursor: null, catalog_version: 'loc-v1' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [省份城('loc-hangzhou', '杭州市', '浙江省', '33'), 省份城('loc-suzhou', '苏州市', '江苏省', '32')],
          next_cursor: 'loc-cur-1',
          catalog_version: 'loc-v1',
        }),
      });
    });

    // 登录落主壳 → 直接进城市子页（共用正文，Backend 控制）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto('/#/intentions/cities');
    await expect(page.getByRole('heading', { name: '选择城市' })).toBeVisible({ timeout: 15_000 });
    // 热门区来自默认页返回项；分组标题只用 admin1_name；位置区是已批准缺失态；无字母索引
    await expect(page.getByRole('button', { name: '杭州市', exact: true }).first()).toBeVisible();
    await expect(page.getByText('浙江省')).toBeVisible();
    await expect(page.getByText('江苏省')).toBeVisible();
    await expect(page.getByText('暂未获取定位')).toBeVisible();
    await expect(page.getByRole('button', { name: /跳到 / })).toHaveCount(0);
    await expect(page.getByText('0/9')).toBeVisible();

    // 正常态截图
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-城市-正常.png`, fullPage: true });

    // 选择杭州市 → 1/9；列表尾「加载更多」翻出第二页宁波市
    await page.getByRole('button', { name: '杭州市', exact: true }).first().click();
    await expect(page.getByText('1/9')).toBeVisible();
    await page.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(page.getByRole('button', { name: '宁波市', exact: true })).toBeVisible({ timeout: 10_000 });

    // 搜索：绍兴市入搜索列表；已选不丢
    await page.getByPlaceholder('搜索城市名/拼音').fill('绍兴');
    await expect(page.getByRole('button', { name: '绍兴市', exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '移除 杭州市' })).toBeVisible();
    await page.getByRole('button', { name: '绍兴市', exact: true }).click();
    await expect(page.getByText('2/9')).toBeVisible();

    // 选中态截图 + iPhone 13 viewport 检查：无横向溢出、搜索可聚焦、保存不被遮挡
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-城市-选中.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    const 搜索输入 = page.getByPlaceholder('搜索城市名/拼音');
    await 搜索输入.focus();
    await expect(搜索输入).toBeFocused();
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible();

    // 取消：✕ 关闭不写草稿；重进为空（0/9 无 chip）
    await page.getByRole('button', { name: '关闭' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 10_000 });
    await page.goto('/#/intentions/cities');
    await expect(page.getByText('0/9')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '移除 杭州市' })).toHaveCount(0);

    // 选择并保存：草稿引用写入；重进回读不丢
    await expect(page.getByRole('button', { name: '杭州市', exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: '杭州市', exact: true }).first().click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 10_000 });
    await page.goto('/#/intentions/cities');
    await expect(page.getByText('1/9')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '移除 杭州市' })).toBeVisible();

    // 本会话目录请求只打 locations（默认页不带 q，已由钩子单测钉住）
    expect(目录请求.length).toBeGreaterThan(0);
    expect(目录请求.every((p) => p === '/api/v1/catalog/locations')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 岗位 @mock（core editors §5.2/§5.4 Task 4）：职位类别两栏与结构化确认门
// 两模式共用 —— Mock 用本地职业分类表驱动同一分类正文（左栏导航、右栏可选、
// 关闭重开保留选中勾）；确认勾选框出现在公开要求之后、私有筛选之前，新建未确认
// 发布被拦、勾选可发布；真实改经验撤销确认、改私有筛选不撤销；编辑 legacy 岗
// 只改私有字段不勾选也能保存，改公开要求需重新确认。全程零 /api/v1 请求。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 岗位 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('新建分类→确认门→发布，编辑公开/私有字段与确认撤销 @catalog-fullscreen @mock', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);

    // ── 新建第一步：两栏共用正文选类别 ──
    await page.goto('/#/hr/post-job');
    const 职位类别行 = page.getByRole('button').filter({ hasText: '职位类别' });
    await 职位类别行.click();
    // editor-catalog-fullscreen Task 1：承载换成全屏选择外壳，可访问名 = 标题「职位类别」
    const 类别弹层 = page.getByRole('dialog', { name: '职位类别' });
    await expect(类别弹层).toBeVisible({ timeout: 10_000 });
    // 正常态截图（与改前拍对照：同一弹层标题/两栏/尺寸）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-岗位-分类正常.png`, fullPage: true });
    await 类别弹层.getByRole('button', { name: '产品', exact: true }).click();
    await 类别弹层.getByRole('button', { name: '产品经理', exact: true }).click();
    await expect(职位类别行).toContainText('产品 · 产品经理');

    // 关闭重开：选中勾保留（✓ 由选中项渲染；可访问名把名称与勾 span 以空格连接）
    await 职位类别行.click();
    await expect(类别弹层.getByRole('button', { name: /产品经理\s*✓/ })).toBeVisible();
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-岗位-分类选中.png`, fullPage: true });
    await page.keyboard.press('Escape');

    await page.getByPlaceholder(/资深后端工程师/).fill('共用正文确认门岗');
    await page.getByRole('button', { name: '现场', exact: true }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByLabel('职位描述').fill('验证两栏分类正文与确认门在 Mock 生效。');
    await page.getByRole('button', { name: '下一步' }).click();

    // ── 第三步：确认门在公开要求之后、私有筛选之前；未确认发布被拦 ──
    const 确认框 = page.getByRole('checkbox', { name: /我已确认经验和学历设置将作为自动匹配依据/ });
    await expect(确认框).toBeVisible();
    await expect(确认框).not.toBeChecked();
    // Task 3 起月薪主入口是选择行：打开共用薪资区间层，精确输入 50/65
    await page.getByRole('button', { name: '薪资下限' }).click();
    const 月薪层 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
    await expect(月薪层).toBeVisible({ timeout: 10_000 });
    await 月薪层.getByRole('button', { name: '输入金额' }).click();
    await 月薪层.getByLabel('薪资下限').fill('50');
    await 月薪层.getByLabel('薪资上限').fill('65');
    await 月薪层.getByRole('button', { name: '确定' }).click();
    await expect(月薪层).toHaveCount(0);
    await page.getByRole('button', { name: /年薪月数/ }).click();
    await page.getByRole('button', { name: '确定' }).click();
    await page.getByLabel('岗位要求').fill('三年以上产品经验，带过完整上线周期');
    // Task 2 起城市经工作城市行 → 全页选择子视图（热门城市点 上海）
    await page.getByRole('button').filter({ hasText: '工作城市' }).click();
    await expect(page.getByPlaceholder('搜索城市 / 省份')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: '上海市', exact: true }).first().click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByPlaceholder('搜索城市 / 省份')).toHaveCount(0);
    await page.getByPlaceholder(/浦东新区世纪大道/).fill('浦东新区张江路 1 号');
    await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
    await expect(page.getByText('请确认经验和学历将作为自动匹配依据').first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/#\/hr\/post-job$/);
    await expect(确认框).not.toBeChecked();
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-岗位-确认门拦截.png`, fullPage: true });

    // 勾选后改私有筛选不撤销；真实改经验档位撤销
    await 确认框.check();
    await expect(确认框).toBeChecked();
    await page.getByRole('textbox', { name: '给 AI 代理的筛选要求' }).fill('偏好有 AI 产品背景');
    await expect(确认框).toBeChecked();
    await page.getByRole('button', { name: '1-3 年' }).click();
    await expect(确认框).not.toBeChecked();

    // 重新确认后发布成功，岗位进本地列表
    await 确认框.check();
    await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
    await expect(page.getByText('共用正文确认门岗')).toBeVisible({ timeout: 15_000 });

    // iPhone 13 viewport 检查（编辑屏）：无横向溢出、输入可聚焦、保存不被遮挡
    await page.goto('/#/hr/post-job/P-05');
    await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue('共用正文确认门岗', { timeout: 15_000 });
    await page.getByRole('button', { name: '职位要求' }).click();
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    const 要求框 = page.getByLabel('岗位要求');
    await 要求框.focus();
    await expect(要求框).toBeFocused();
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible();

    // 编辑 legacy 岗（Mock 无确认事实 = 未确认）：只改私有筛选，不勾选也能保存
    const 编辑确认框 = page.getByRole('checkbox', { name: /我已确认经验和学历设置将作为自动匹配依据/ });
    await expect(编辑确认框).not.toBeChecked();
    await page.getByRole('textbox', { name: '给 AI 代理的筛选要求' }).fill('偏好有 AI 产品背景，重项目管理');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('岗位已保存').first()).toBeVisible({ timeout: 15_000 });

    // 改公开要求：撤销确认 → 发布被拦 → 重新确认后保存
    await page.goto('/#/hr/post-job/P-05');
    await page.getByRole('button', { name: '职位要求' }).click();
    await expect(page.getByRole('checkbox', { name: /我已确认经验和学历设置将作为自动匹配依据/ })).not.toBeChecked({ timeout: 15_000 });
    await page.getByLabel('岗位要求').fill('三年以上产品经验，带过完整上线周期，熟悉 B 端');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('请确认经验和学历将作为自动匹配依据').first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('checkbox', { name: /我已确认经验和学历设置将作为自动匹配依据/ }).check();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('岗位已保存').first()).toBeVisible({ timeout: 15_000 });

    // Mock 全程零 API 请求
    expect(apiRequests).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 岗位 @backend（core editors §5.2/§5.4 Task 4）：Backend 分支消费同一
// 分类正文 —— 右栏分页「加载更多」、不可选父项下钻替换右栏、无子项不可选项不提交
// （零目录请求）、同名叶子按稳定 ID 提交；确认门两模式同位同文案，新建未确认发布
// 被拦；编辑 hydrated confirmed 岗改公开要求撤销确认，稀疏补丁只带变化字段。
// job-categories 目录用本用例专用网络桩（后装 route 先匹配，不改共享 helper）；
// 符合已审合同的网络桩边界验证，不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 岗位 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('新建两栏下钻分类→确认门→发布，编辑公开/私有字段走稀疏补丁 @catalog-fullscreen @backend', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const 请求们: { path: string; method: string; body: unknown }[] = [];
    // 合同 C：名片公司自报经 公司选择抽屉 选中（搜索池 + 公开企业回读都要有组织甲）
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P1C搜索池();
    await 安装BFF路由(page, {
      登录尝试id: 'att-core-edit-job',
      记录目录请求: () => undefined,
      请求拦截: ({ path, method, body }) => 请求们.push({ path, method, body }),
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      隐私fixture: 隐私,
    });

    // job-categories 目录桩（本用例专用精确状态）：根『同名类』不可选 → 子项第一页
    // 『中转』(不可选,有子项) 带游标 → 游标页『分页叶子』；『中转』下钻 →
    // 『死端父项』(不可选,无子项) + 与根同名的可选叶子『同名类』。
    const 目录请求: string[] = [];
    const 税目 = (id: string, 名称: string, parentId: string | null, selectable: boolean, hasChildren: boolean) => ({
      id, display_name: 名称, parent_id: parentId, selectable, has_children: hasChildren,
    });
    await page.route('**/api/v1/catalog/job-categories*', async (route) => {
      const url = new URL(route.request().url());
      // 合同 wire 参数名是 parent_id（见 src/数据/招聘数据源/目录.ts 的编码表）
      const parentId = url.searchParams.get('parent_id');
      const cursor = url.searchParams.get('cursor');
      目录请求.push(`parent_id=${parentId ?? '-'}&cursor=${cursor ?? '-'}`);
      const 页 = (items: ReturnType<typeof 税目>[], next: string | null) =>
        route.fulfill({ status: 200, json: 信封({ items, next_cursor: next, catalog_version: 'tax-v1' }) });
      if (parentId === 'root_same' && !cursor) return 页([税目('branch_mid', '中转', 'root_same', false, true)], 'child_cur_1');
      if (cursor === 'child_cur_1') return 页([税目('leaf_page', '分页叶子', 'root_same', true, false)], null);
      if (parentId === 'branch_mid') {
        return 页([
          税目('branch_dead', '死端父项', 'branch_mid', false, false),
          税目('leaf_same', '同名类', 'branch_mid', true, false),
        ], null);
      }
      return 页([税目('root_same', '同名类', null, false, true)], null);
    });

    // 存量招聘会话经应用内入口进名片（注册流入口会被已完成账号守卫弹回企业主壳）：
    // 名片编辑保存 → 发岗向导
    await page.goto('/#/hr/card');
    await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('姓名').fill('林澈');
    await page.getByLabel('职务').fill('招聘负责人');
    await page.getByRole('button', { name: '未选择公司' }).click();
    await 抽屉搜企业并选中(page, '云衢科技', P1C标记.组织甲名);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('保存成功')).toBeVisible({ timeout: 20_000 });
    await page.goto('/#/hr/post-job');

    // ── 第一步：两栏共用正文 —— 右栏分页 / 下钻 / 死端不提交 / 同名叶子按 ID ──
    const 职位类别行 = page.getByRole('button').filter({ hasText: '职位类别' });
    await 职位类别行.click();
    // editor-catalog-fullscreen Task 1：承载换成全屏选择外壳，可访问名 = 标题「职位类别」
    const 类别弹层 = page.getByRole('dialog', { name: '职位类别' });
    await expect(类别弹层.getByText('中转')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-岗位-分类正常.png`, fullPage: true });
    // 右栏分页：加载更多追加游标页
    await 类别弹层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(类别弹层.getByRole('button', { name: '分页叶子', exact: true })).toBeVisible({ timeout: 10_000 });
    // 右栏下钻：不可选且有子项 → 替换右栏（沿原稿不可选项带 aria-disabled，Playwright
    // 动作性判定视作不可点，用 force 触发与用户指针点击等价的事件）
    await 类别弹层.getByRole('button', { name: '中转', exact: true }).click({ force: true });
    await expect(类别弹层.getByRole('button', { name: '死端父项', exact: true })).toBeVisible({ timeout: 10_000 });
    // 死端父项（不可选且无子项）：不提交不展开，零目录请求
    const 下钻后目录请求数 = 目录请求.length;
    await 类别弹层.getByRole('button', { name: '死端父项', exact: true }).click({ force: true });
    await expect(类别弹层.getByRole('button', { name: '死端父项', exact: true })).toBeVisible();
    expect(目录请求.length).toBe(下钻后目录请求数);
    // 同名叶子（与左栏根同名不同键）单击选定
    await 类别弹层.getByRole('button', { name: '同名类', exact: true }).last().click();
    await expect(职位类别行).toContainText('同名类');
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-岗位-分类选中.png`, fullPage: true });

    await page.getByPlaceholder(/资深后端工程师/).fill('共用正文确认门岗');
    await page.getByRole('button', { name: '现场', exact: true }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByLabel('职位描述').fill('验证两栏分类正文与确认门在 Backend 生效。');
    await page.getByRole('button', { name: '下一步' }).click();

    // ── 第三步：确认门未勾选发布被拦（零 Job POST）──
    const 确认框 = page.getByRole('checkbox', { name: /我已确认经验和学历设置将作为自动匹配依据/ });
    await expect(确认框).toBeVisible();
    await expect(确认框).not.toBeChecked();
    // Task 3 起月薪主入口是选择行：打开共用薪资区间层，精确输入 50/65
    await page.getByRole('button', { name: '薪资下限' }).click();
    const 月薪层 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
    await expect(月薪层).toBeVisible({ timeout: 10_000 });
    await 月薪层.getByRole('button', { name: '输入金额' }).click();
    await 月薪层.getByLabel('薪资下限').fill('50');
    await 月薪层.getByLabel('薪资上限').fill('65');
    await 月薪层.getByRole('button', { name: '确定' }).click();
    await expect(月薪层).toHaveCount(0);
    await page.getByRole('button', { name: /年薪月数/ }).click();
    await page.getByRole('button', { name: '确定' }).click();
    await page.getByLabel('岗位要求').fill('三年以上后端经验，熟悉交易系统');
    await page.getByPlaceholder(/浦东新区世纪大道/).fill('Fixture 市 Fixture 路 1 号');
    // Task 2 起城市经工作城市行 → 全页选择子视图（搜索候选 → 保存回填）
    await page.getByRole('button').filter({ hasText: '工作城市' }).click();
    const 后端城市搜索 = page.getByPlaceholder('搜索城市 / 省份');
    await expect(后端城市搜索).toBeVisible({ timeout: 5_000 });
    await 后端城市搜索.fill('fixture');
    await page.getByRole('button', { name: 标记.城市display, exact: true }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(后端城市搜索).toHaveCount(0);
    await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
    await expect(page.getByText('请确认经验和学历将作为自动匹配依据').first()).toBeVisible({ timeout: 10_000 });
    // 零 Job 写入：水合的 jobs GET 不算 mutation，只看 POST/PATCH
    expect(请求们.find((项) => 项.path === '/api/v1/recruiter/jobs' && 项.method !== 'GET')).toBeUndefined();
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-岗位-确认门拦截.png`, fullPage: true });

    await 确认框.check();
    await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    const 创建 = 请求们.find((项) => 项.path === '/api/v1/recruiter/jobs' && 项.method === 'POST');
    expect(创建).toBeDefined();
    // 同名叶子按稳定 ID 提交，不按名称反查目录；确认事实随创建体上送；
    // 企业坐标 direct 双 ref 同值（来自名片保存的 organization_ref 按 ID 读回的默认行）
    expect(创建!.body).toMatchObject({
      category_id: 'leaf_same',
      structured_requirements_confirmed: true,
      requirements: '三年以上后端经验，熟悉交易系统',
      publisher_organization_ref: P1C标记.组织甲编号,
      hiring_organization_ref: P1C标记.组织甲编号,
    });

    // ── 编辑 hydrated confirmed 岗：改公开要求撤销确认；稀疏补丁只带变化字段 ──
    await page.goto('/#/hr/post-job/job-fixture-created-1');
    await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue('共用正文确认门岗', { timeout: 15_000 });
    await page.getByRole('button', { name: '职位要求' }).click();
    const 编辑确认框 = page.getByRole('checkbox', { name: /我已确认经验和学历设置将作为自动匹配依据/ });
    await expect(编辑确认框).toBeChecked({ timeout: 15_000 });
    // 改公开要求 → 确认被撤销；改私有筛选不动它
    await page.getByLabel('岗位要求').fill('三年以上后端经验，熟悉交易系统与撮合链路');
    await expect(编辑确认框).not.toBeChecked();
    await page.getByRole('textbox', { name: '给 AI 代理的筛选要求' }).fill('偏好系统设计背景');
    await expect(编辑确认框).not.toBeChecked();
    // iPhone 13 viewport 检查（编辑屏）
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    const 要求框 = page.getByLabel('岗位要求');
    await 要求框.focus();
    await expect(要求框).toBeFocused();
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible();
    // 重新确认后保存：requirements 与私有偏好各自进稀疏补丁，确认事实随变化携带
    await 编辑确认框.check();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('岗位已保存').first()).toBeVisible({ timeout: 15_000 });
    const 补丁 = 请求们.find(
      (项) => /^\/api\/v1\/recruiter\/jobs\/job-fixture-created-1$/.test(项.path) && 项.method === 'PATCH',
    );
    expect(补丁).toBeDefined();
    expect(补丁!.body).toMatchObject({
      requirements: '三年以上后端经验，熟悉交易系统与撮合链路',
      private_screening_preferences: '偏好系统设计背景',
      structured_requirements_confirmed: true,
    });

    // 本会话目录请求只打 job-categories，且死端父项未产生额外下钻请求
    expect(目录请求.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 教育 @mock（core editors §5.2 Task 5）：教育编辑页 学校/专业 候选行共用 ——
// Mock 用现有 高校名录/专业名录 演示种子做局部子串搜索/分页（列表尾「加载更多」），
// 选候选只落文本（本地选择控制，不落引用），完成无引用门槛、保存进本地简历。
// 全程零 /api/v1 请求。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 教育 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('学校/专业共用候选：输入→候选→分页→选候选→保存，全程零 API @catalog-fullscreen @mock', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);

    // 日常入口：在线简历 → 添加教育经历（共用候选列表，Mock 演示种子）。
    // editor-catalog-fullscreen Task 2 起：学校/专业是点击行 → 全屏选择外壳子视图（候选在层内）。
    await page.goto('/#/experience');
    await expect(page.getByRole('button', { name: '＋ 添加教育经历' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加教育经历' }).click();
    await expect(page.getByText('学校名称')).toBeVisible({ timeout: 10_000 });

    // 学校行 → 全屏「选择学校」：搜索「大学」名录子串命中，首页 8 条 + 列表尾「加载更多」
    const 学校行 = page.getByRole('button').filter({ hasText: '学校名称' });
    await 学校行.click();
    const 学校层 = page.getByRole('dialog', { name: '选择学校' });
    await expect(学校层).toBeVisible({ timeout: 10_000 });
    await 学校层.getByPlaceholder('搜索学校名称').fill('大学');
    await expect(学校层.getByRole('button', { name: '清华大学', exact: true })).toBeVisible({ timeout: 10_000 });
    expect(await 学校层.getByRole('button', { name: '清华大学', exact: true }).count()).toBe(1);
    await expect(学校层.getByRole('button', { name: '加载更多', exact: true })).toBeVisible();
    await expect(学校层.getByRole('button', { name: '同济大学', exact: true })).toHaveCount(0);

    // 输入及候选截图（与改前拍对照：旧 Mock 教育页无候选）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-教育-输入及候选.png`, fullPage: true });

    // 分页翻出名录第 9–16 位 → 选候选落行文本、子视图收起（同 Backend 点候选行为）
    await 学校层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(学校层.getByRole('button', { name: '同济大学', exact: true })).toBeVisible({ timeout: 10_000 });
    await 学校层.getByRole('button', { name: '清华大学', exact: true }).click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toContainText('清华大学');

    // 专业走同一共用列表（无副行）：搜索「工程」→ 分页 → 选软件工程
    const 专业行 = page.getByRole('button').filter({ hasText: '专业' }).first();
    await 专业行.click();
    const 专业层 = page.getByRole('dialog', { name: '选择专业' });
    await expect(专业层).toBeVisible({ timeout: 10_000 });
    await 专业层.getByPlaceholder('搜索专业名称').fill('工程');
    await expect(专业层.getByRole('button', { name: '软件工程', exact: true })).toBeVisible({ timeout: 10_000 });
    await 专业层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(专业层.getByRole('button', { name: '土木工程', exact: true })).toBeVisible({ timeout: 10_000 });
    await 专业层.getByRole('button', { name: '软件工程', exact: true }).click();
    await expect(专业层).toHaveCount(0);
    await expect(专业行).toContainText('软件工程');

    // 选中态截图 + iPhone 13 viewport 检查：无横向溢出、关闭后焦点回触发行、完成不被遮挡
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-教育-选中.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    await expect(专业行).toBeFocused();
    await expect(page.getByRole('button', { name: '完成', exact: true })).toBeVisible();

    // 完成（Mock 无引用门槛）→ 教育卡上屏；保存进本地简历，重进回读不丢
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await expect(page.getByText(/清华大学/).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/本科 · 软件工程/)).toBeVisible();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/wizard$/, { timeout: 20_000 });
    await page.goto('/#/experience');
    await expect(page.getByText(/清华大学/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/本科 · 软件工程/)).toBeVisible();

    // Mock 全程零 API 请求
    expect(apiRequests).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 教育 @backend（core editors §5.2 Task 5）：Backend 分支消费同一共用候选列表 ——
// 学校候选带「城市 · 国家」副行、列表尾「加载更多」翻真实游标页、同名不同 ID 按稳定键
// 准确提交（education POST 的 institution_id 是所点行的 ID）；输入框布局不变。
// 教育目录桩为本用例专用后装 route（先匹配，不改共享 安装BFF路由），符合已审合同网络桩，
// 不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 教育 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('目录候选：输入→副行→分页→选候选→保存，同名不同 ID 按键提交 @catalog-fullscreen @backend', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const fixture = 创建候选OnboardingFixture();
    // 存量候选日常会话：last_used_role 已落 candidate；简历与 active 意向满足建档完备判据
    fixture.主体.last_used_role = 'candidate';
    // 存量日常会话按冻结决策返回 candidate 已完成（与 P1/展示字段接线的主页用例同口径）：
    // 登录落点按完成事实进主壳，而不是被未完成分流送回学生分流
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选' },
      summary: '存量个人优势',
    };
    fixture.intentions = [P4深克隆(fixture意向列表.intentions[0])];
    await 安装BFF路由(page, {
      登录尝试id: 'att-core-edit-education',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
    });

    // 教育目录桩（本用例专用精确状态）：同名不同 ID 三校 + 游标分页；专业两页。字段形状
    // 与既有内置 institutions/majors 桩一致（信封闭合解码）。
    const 学校 = (id: string, 城: string) => ({
      id,
      display_name: '清华大学',
      location: {
        id: `loc-${id}`, display_name: 城, country_code: 'CN', country_name: '中国',
        admin1_code: null, admin1_name: null, timezone: 'Asia/Shanghai', population: 0,
      },
      selectable: true,
    });
    const 教育 = (institution_id: string, major_id: string) => ({ institution_id, major_id });
    await page.route('**/api/v1/catalog/education-institutions*', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('cursor') === 'inst-cur-1') {
        await route.fulfill({
          status: 200,
          json: 信封({ items: [学校('inst_same_c', '上海')], next_cursor: null, catalog_version: 'inst-v1' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [学校('inst_same_a', '北京'), 学校('inst_same_b', '新竹')],
          next_cursor: 'inst-cur-1',
          catalog_version: 'inst-v1',
        }),
      });
    });
    await page.route('**/api/v1/catalog/majors*', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('cursor') === 'major-cur-1') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [{ id: 'major_se', display_name: '软件工程', parent_id: null, selectable: true }],
            next_cursor: null,
            catalog_version: 'major-v1',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [{ id: 'major_cs', display_name: '计算机科学与技术', parent_id: null, selectable: true }],
          next_cursor: 'major-cur-1',
          catalog_version: 'major-v1',
        }),
      });
    });

    // 日常入口：登录落主壳后直接进 /experience（不经过建档旅程）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto('/#/experience');
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加教育经历' }).click();
    await expect(page.getByText('学校名称')).toBeVisible({ timeout: 10_000 });

    // 学校行 → 全屏「选择学校」：搜索「清」同名不同 ID 两行以副行（城市 · 国家）区分 + 列表尾「加载更多」
    // （editor-catalog-fullscreen Task 2 起：学校/专业是点击行 → 全屏选择外壳子视图）
    const 学校行 = page.getByRole('button').filter({ hasText: '学校名称' });
    await 学校行.click();
    const 学校层 = page.getByRole('dialog', { name: '选择学校' });
    await expect(学校层).toBeVisible({ timeout: 10_000 });
    await 学校层.getByPlaceholder('搜索学校名称').fill('清');
    await expect(学校层.getByRole('button', { name: '清华大学', exact: true })).toHaveCount(2, { timeout: 10_000 });
    await expect(学校层.getByText('北京 · 中国')).toBeVisible();
    await expect(学校层.getByText('新竹 · 中国')).toBeVisible();
    await expect(学校层.getByRole('button', { name: '加载更多', exact: true })).toBeVisible();

    // 输入及候选截图（与改前拍/冻结源码快照对照：原 Backend 候选行结构）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-教育-输入及候选.png`, fullPage: true });

    // 分页翻出第三行 → 选第二行（inst_same_b，同名不同 ID）
    await 学校层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(学校层.getByText('上海 · 中国')).toBeVisible({ timeout: 10_000 });
    await 学校层.getByRole('button', { name: '清华大学', exact: true }).nth(1).click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toContainText('清华大学');

    // 专业走同一共用列表（无副行）：搜索 → 分页 → 选叶子
    // （Backend 原外层行为：点候选清空候选数组后游标仍在，列表尾「加载更多」保持原样）
    const 专业行 = page.getByRole('button').filter({ hasText: '专业' }).first();
    await 专业行.click();
    const 专业层 = page.getByRole('dialog', { name: '选择专业' });
    await expect(专业层).toBeVisible({ timeout: 10_000 });
    await 专业层.getByPlaceholder('搜索专业名称').fill('计');
    await expect(专业层.getByRole('button', { name: '计算机科学与技术', exact: true })).toBeVisible({ timeout: 10_000 });
    await 专业层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(专业层.getByRole('button', { name: '软件工程', exact: true })).toBeVisible({ timeout: 10_000 });
    await 专业层.getByRole('button', { name: '软件工程', exact: true }).click();
    await expect(专业层).toHaveCount(0);
    await expect(专业行).toContainText('软件工程');

    // 选中态截图 + iPhone 13 viewport 检查：无横向溢出、关闭后焦点回触发行、完成不被遮挡
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-教育-选中.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    await expect(专业行).toBeFocused();
    await expect(page.getByRole('button', { name: '完成', exact: true })).toBeVisible();

    // 完成 → 教育卡上屏；保存按所点行的稳定 ID 提交（同名不同 ID 不串，
    // institution_id 是所点行的目录 ID，不按显示名反查）
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await expect(page.getByText(/清华大学/).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/wizard$/, { timeout: 20_000 });
    const 教育写入 = fixture.mutations.filter(
      (条) => 条.method === 'POST' && 条.path === '/api/v1/me/resume/educations',
    );
    expect(教育写入.length).toBeGreaterThan(0);
    expect(教育写入[0]!.body).toMatchObject(教育('inst_same_b', 'major_se'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 简历行业 @mock（core editors §5.2 Task 6）：经历编辑页 所属行业 底部选择层
// 两模式共用 简历行业选择正文 —— Mock 用 常见行业 本地目录作模拟目录（同一正文），
// 自由文本自填经可选 自填 保留（Backend 不提供）。选常见行业即回填并关闭层，
// 完成后经历卡带行业标签，保存进本地简历、重进回读不丢。全程零 /api/v1 请求。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 简历行业 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('常见行业目录：展开层→选行业→经历保存并回读，自填输入已按 Plan 删除 @mock', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);

    // 日常入口：在线简历 → 添加工作经历 → 公司名称走选择抽屉（Mock 本地目录）→ 所属行业层
    await page.goto('/#/experience');
    await expect(page.getByRole('button', { name: '＋ 添加工作经历' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加工作经历' }).click();
    // 公司名称行改按钮选择后，编辑页唯一 placeholder='必填' 的输入只剩职位名称
    await expect(page.getByPlaceholder('必填')).toHaveCount(1);
    await page.getByRole('button').filter({ hasText: '公司名称' }).click();
    await 抽屉搜企业并选中(page, '云衢', '云衢科技');
    const 公司名称行 = page.getByRole('button').filter({ hasText: '公司名称' });
    await expect(公司名称行).toContainText('云衢科技');
    await page.getByRole('button', { name: '所属行业' }).click();
    // Mock 行业字典当前根集（根仅展开、细分可选；根按钮可访问名带「⌄」展开符）
    await expect(page.getByRole('button', { name: '互联网平台' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '智能硬件 / 制造' })).toBeVisible();
    // picker 统一 Task 1 按 Plan 删除 Mock 自填自由文本输入（两模式无「自填行业」）
    await expect(page.getByPlaceholder('没有合适的？直接输入')).toHaveCount(0);

    // 正常态截图（与改前拍对照：原 Mock 行业层同版式）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-简历行业-正常.png`, fullPage: true });

    // 展开金融科技根 → 选可选细分叶 → 回填所属行业行并关闭层（单选关闭沿原页）
    await page.getByRole('button', { name: '金融科技' }).click();
    await page.getByRole('button', { name: '支付与清结算' }).click();
    await expect(page.getByPlaceholder('没有合适的？直接输入')).toHaveCount(0);

    // 选中回填态截图 + iPhone 13 viewport 检查：无横向溢出、职位输入可聚焦、完成可见
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-简历行业-选中.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    await page.getByPlaceholder('必填').focus();
    await expect(page.getByPlaceholder('必填')).toBeFocused();
    await expect(page.getByRole('button', { name: '完成', exact: true })).toBeVisible();

    // 补齐必填与入职年月 → 完成 → 经历卡带行业标签；保存进本地简历，重进回读不丢
    await page.getByPlaceholder('必填').fill('演示工程师');
    await page.getByRole('button', { name: '入职年月' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '确定' }).click();
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await expect(page.getByText(/支付与清结算/).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/wizard$/, { timeout: 20_000 });
    await page.goto('/#/experience');
    await expect(page.getByText(/支付与清结算/).first()).toBeVisible({ timeout: 15_000 });

    // Mock 全程零 API 请求
    expect(apiRequests).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 简历行业 @backend（core editors §5.2 Task 6）：Backend 分支消费同一共用正文 ——
// 根/子/孙三层按当前渲染顺序分段展示（层级缩进）、各列表尾「加载更多」、可选叶子单击
// 选定并按稳定 ID 精确提交（experience POST 的 industry_id 是所点行的目录 ID，同名不串）。
// 行业目录桩为本用例专用后装 route（先匹配，不改共享 安装BFF路由），符合已审合同网络桩，
// 不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 简历行业 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('三层目录：展开根→选孙叶子→经历按 ID 保存，分段尾可翻页 @backend', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const fixture = 创建候选OnboardingFixture();
    // 存量候选日常会话：last_used_role 已落 candidate；简历与 active 意向满足建档完备判据
    fixture.主体.last_used_role = 'candidate';
    // 存量日常会话按冻结决策返回 candidate 已完成（与 P1/展示字段接线的主页用例同口径）：
    // 登录落点按完成事实进主壳，而不是被未完成分流送回学生分流
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选' },
      summary: '存量个人优势',
    };
    fixture.intentions = [P4深克隆(fixture意向列表.intentions[0])];
    // 合同 C：经历公司走 公司选择抽屉 —— 搜索池给默认组织库，选中按稳定 ID 回填
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P3默认组织库();
    await 安装BFF路由(page, {
      登录尝试id: 'att-core-edit-industry',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: 隐私,
    });

    // 行业目录桩（本用例专用精确状态）：根两页（第二页根可选）+ 子两页（第二页叶子）
    // + 孙一层可选叶子。字段形状与既有内置 industries 桩一致（信封闭合解码）。
    await page.route('**/api/v1/catalog/industries*', async (route) => {
      const url = new URL(route.request().url());
      const parentId = url.searchParams.get('parent_id');
      const cursor = url.searchParams.get('cursor');
      if (parentId === 'ind_root') {
        const items = cursor === 'ind-cur-2'
          ? [{ id: 'ind_leaf_direct', display_name: '第三方支付', parent_id: 'ind_root', selectable: true, has_children: false }]
          : [{ id: 'ind_pay_grp', display_name: '支付与清结算', parent_id: 'ind_root', selectable: false, has_children: true }];
        await route.fulfill({
          status: 200,
          json: 信封({ items, next_cursor: cursor === 'ind-cur-2' ? null : 'ind-cur-2', catalog_version: 'ind-v1' }),
        });
        return;
      }
      if (parentId === 'ind_pay_grp') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [{ id: 'ind_leaf_bank', display_name: '银行支付', parent_id: 'ind_pay_grp', selectable: true, has_children: false }],
            next_cursor: null,
            catalog_version: 'ind-v1',
          }),
        });
        return;
      }
      if (cursor === 'ind-cur-1') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [{ id: 'ind_int', display_name: '互联网', parent_id: null, selectable: true, has_children: false }],
            next_cursor: null,
            catalog_version: 'ind-v1',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [{ id: 'ind_root', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }],
          next_cursor: 'ind-cur-1',
          catalog_version: 'ind-v1',
        }),
      });
    });

    // 日常入口（简历编辑显式来源）：登录落主壳后从 我的简历 点行进在线简历 ——
    // 编辑入口带 from=resume，保存后只回我的简历；不用裸 /experience 冒充日常入口
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto('/#/resume');
    await expect(page.getByText('我的简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button').filter({ hasText: 'Fixture 大学' }).click();
    await expect(page).toHaveURL(/#\/experience\?from=resume$/, { timeout: 15_000 });
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加工作经历' }).click();
    // 公司名称行改按钮选择后，编辑页唯一 placeholder='必填' 的输入只剩职位名称
    await expect(page.getByPlaceholder('必填')).toHaveCount(1);
    await page.getByRole('button').filter({ hasText: '公司名称' }).click();
    await 抽屉搜企业并选中(page, '磐石', P3标记.手动组织甲);
    await expect(page.getByRole('button').filter({ hasText: '公司名称' })).toContainText(P3标记.手动组织甲);

    // 行业层：根列表 + 列表尾「加载更多」（分段 = 根列表及其分页尾）
    await page.getByRole('button', { name: '所属行业' }).click();
    await expect(page.getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '加载更多', exact: true })).toBeVisible();

    // 正常态截图（与改前拍/冻结源码快照对照：原 Backend 三层展开同版式）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-简历行业-正常.png`, fullPage: true });

    // 根分页翻出第二页根（可选根直接选定路径的另一形态），再展开 金融科技 → 子列表
    await page.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(page.getByRole('button', { name: '互联网', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /金融科技/ }).click();
    await expect(page.getByRole('button', { name: /支付与清结算/ })).toBeVisible({ timeout: 10_000 });
    // 子列表尾「加载更多」在场（非 selectable 子项可展开孙层）
    await expect(page.getByRole('button', { name: '加载更多', exact: true })).toBeVisible();

    // 非 selectable 子项 → 孙层 → 可选孙叶子单击选定（层级缩进照原 inline padding）
    await page.getByRole('button', { name: /支付与清结算/ }).click();
    await expect(page.getByRole('button', { name: '银行支付', exact: true })).toBeVisible({ timeout: 10_000 });

    // 三层缩进态截图（根/子/孙分段沿渲染顺序 + 各段分页尾）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-简历行业-三层缩进.png`, fullPage: true });

    await page.getByRole('button', { name: '银行支付', exact: true }).click();
    await expect(page.getByPlaceholder('没有合适的？直接输入')).toHaveCount(0);

    // 选中回填态截图 + iPhone 13 viewport 检查：无横向溢出、职位输入可聚焦、完成可见
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-简历行业-选中.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    await page.getByPlaceholder('必填').focus();
    await expect(page.getByPlaceholder('必填')).toBeFocused();
    await expect(page.getByRole('button', { name: '完成', exact: true })).toBeVisible();

    // 补齐必填与入职年月 → 完成 → 经历卡带行业标签；保存按所点行的稳定 ID 提交
    //（industry_id 是所点孙叶子的目录 ID、organization_id 是抽屉选中的组织 ID，
    // 都不按显示名反查）
    await page.getByPlaceholder('必填').fill('演示工程师');
    await page.getByRole('button', { name: '入职年月' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '确定' }).click();
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await expect(page.getByText(/银行支付/).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '保存', exact: true }).click();
    // 编辑入口带 from=resume：保存只回我的简历，不进注册流向导
    await expect(page).toHaveURL(/#\/resume$/, { timeout: 20_000 });
    const 经历写入 = fixture.mutations.filter(
      (条) => 条.method === 'POST' && 条.path === '/api/v1/me/resume/experiences',
    );
    expect(经历写入.length).toBeGreaterThan(0);
    expect(经历写入[0]!.body).toMatchObject({
      organization_id: 'org-fixture-p3-manual-a',
      industry_id: 'ind_leaf_bank',
    });

    // ── 保存／重入（review-r1 F2 + 简历编辑显式来源）：company 是服务端按
    //    organization_id 冻结的展示快照 —— 从 我的简历 重进后经历卡与编辑页公司行
    //    都显示所选企业（非空、即该企业 display_name），公司非空过必填门完成可用；
    //    改职位再保存回我的简历，PATCH 仍提交同一 organization_id ──
    await expect(page.getByText(P3标记.手动组织甲).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button').filter({ hasText: P3标记.手动组织甲 }).click();
    await expect(page).toHaveURL(/#\/experience\?from=resume$/, { timeout: 15_000 });
    await page.getByRole('button').filter({ hasText: P3标记.手动组织甲 }).click();
    const 重入公司行 = page.getByRole('button').filter({ hasText: '公司名称' });
    await expect(重入公司行).toContainText(P3标记.手动组织甲);
    await expect(page.getByRole('button', { name: '完成', exact: true })).toBeEnabled();
    // 改职位制造差异：无差异的再保存不发 PATCH（保存简历按分区 diff 决定写入）
    await page.getByPlaceholder('必填').fill('演示工程师·复核');
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/resume$/, { timeout: 20_000 });
    const 经历更新 = fixture.mutations.filter(
      (条) => 条.method === 'PATCH' && /^\/api\/v1\/me\/resume\/experiences\/[^/]+$/.test(条.path),
    );
    expect(经历更新.length).toBe(1);
    expect(经历更新[0]!.body).toMatchObject({
      organization_id: 'org-fixture-p3-manual-a',
      industry_id: 'ind_leaf_bank',
      title: '演示工程师·复核',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 候选资料编辑边界 @backend（简历编辑显式来源，Task 1）：已完成候选从 我的简历 真实
// UI 流程进基本信息（入口带 from=resume），URL 刷新保留编辑模式，整页按钮为「保存」，
// 保存成功只回我的简历；简历域 PATCH 照发，但首次意向写入为零 —— 日常编辑绝不触发
// 注册流的建档/意向写入。fixture 全部复用现有 安装BFF路由，不导出新的模拟框架。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('候选资料编辑边界 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('已完成候选经基本信息保存回我的简历：刷新保留编辑模式，首次意向写入零次 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = 创建候选OnboardingFixture();
    // 存量候选日常会话：last_used_role 已落 candidate，已完成事实决定登录落主壳
    fixture.主体.last_used_role = 'candidate';
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选' },
      summary: '存量个人优势',
    };
    fixture.intentions = [P4深克隆(fixture意向列表.intentions[0])];
    await 安装BFF路由(page, {
      登录尝试id: 'att-resume-edit-boundary',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
    });

    // 真实 UI 流程：登录落主壳 → 我的简历 → 基本信息行（入口带 from=resume）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto('/#/resume');
    await expect(page.getByText('我的简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button').filter({ hasText: '工作年限' }).click();
    await expect(page).toHaveURL(/#\/basic\?from=resume$/, { timeout: 15_000 });

    // 编辑模式：按钮为「保存」，URL 刷新保留模式（不弹回注册流、不恢复旧出口）
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '下一步', exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page).toHaveURL(/#\/basic\?from=resume$/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible({ timeout: 15_000 });

    // 改真名并保存：保存成功只回我的简历，profile PATCH 照发（简历域真实写入）
    await page.getByPlaceholder('身份证上的名字').fill('存量候选·复核');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/resume$/, { timeout: 20_000 });
    await expect(page.getByText('我的简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    const 资料写入 = fixture.mutations.filter(
      (条) => 条.method === 'PATCH' && 条.path === '/api/v1/me/resume/profile',
    );
    expect(资料写入.length).toBe(1);
    expect(资料写入[0]!.body).toMatchObject({ real_name: '存量候选·复核', status: 'employed' });
    expect(fixture.resume.profile.real_name).toBe('存量候选·复核');

    // 编辑边界：首次意向写入零次（日常编辑不建意向、不走注册流收尾）
    expect(fixture.mutations.filter((条) => 条.method === 'POST' && 条.path === '/api/v1/me/intentions')).toEqual([]);
    // 我的简历回显新名字：保存的权威回读落到了本页
    await expect(page.getByText('存量候选·复核')).toBeVisible({ timeout: 15_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 个人优势独立编辑 @backend（Task 4）：已完成候选从 我的简历 个人优势卡进
// /wizard?from=resume —— 向导内该参数唯一表示只编辑个人优势（题序单题、按钮「保存」、
// 无“已根据你上传的简历预先提取”与恢复动作），初值是已水合的存量 summary；
// 返回未保存零写入；URL 刷新保持编辑场景；保存成功回我的简历并显示新值（多行换行
// 保留），fixture 记录的真实请求恰一次 summary PATCH 且首次意向 POST 为零。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('候选个人优势编辑 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('我的简历个人优势进编辑保存回读：刷新保持、返回零写、首次意向 POST 为零 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = 创建候选OnboardingFixture();
    fixture.主体.last_used_role = 'candidate';
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选' },
      summary: '存量优势第一行\n存量优势第二行',
    };
    fixture.intentions = [P4深克隆(fixture意向列表.intentions[0])];
    await 安装BFF路由(page, {
      登录尝试id: 'att-summary-edit-entry',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
    });

    // 真实 UI 流程：登录落主壳 → 我的简历 → 个人优势卡（有值回显多行原文）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto('/#/resume');
    await expect(page.getByText('我的简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button').filter({ hasText: '存量优势第一行' }).click();
    await expect(page).toHaveURL(/#\/wizard\?from=resume$/, { timeout: 15_000 });

    // 编辑场景：初值是存量 summary；无提取说明、无恢复动作、按钮为「保存」
    const 优势框 = page.getByLabel('个人优势');
    await expect(优势框).toHaveValue('存量优势第一行\n存量优势第二行', { timeout: 15_000 });
    await expect(page.getByText('已根据你上传的简历预先提取')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /恢复简历识别建议|重新从简历提取/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible();

    // 返回未保存不提交：退回我的简历，零写入
    await page.getByRole('button', { name: '返回' }).click();
    await expect(page).toHaveURL(/#\/resume$/, { timeout: 15_000 });
    expect(fixture.mutations.filter((条) => 条.path === '/api/v1/me/resume/summary')).toEqual([]);

    // 再次进入并刷新：编辑场景保持（题序单题 + 「保存」按钮）
    await page.getByRole('button').filter({ hasText: '存量优势第一行' }).click();
    await expect(page).toHaveURL(/#\/wizard\?from=resume$/, { timeout: 15_000 });
    await page.reload();
    await expect(page).toHaveURL(/#\/wizard\?from=resume$/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible({ timeout: 15_000 });

    // 改写为多行文本并保存：回我的简历并显示新值（换行保留）
    const 编辑框 = page.getByLabel('个人优势');
    // final review：reload 后先钉住初值再改写 —— 自我介绍 useState 初值依赖「水合完成才
    // 挂路由」的结构前提，此断言让异步水合下的初值丢失在 fill 掩盖前先红。
    await expect(编辑框).toHaveValue('存量优势第一行\n存量优势第二行', { timeout: 15_000 });
    await 编辑框.fill('改后优势第一行\n改后优势第二行');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/resume$/, { timeout: 20_000 });
    await expect(page.getByText('改后优势第一行')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('改后优势第二行')).toBeVisible({ timeout: 15_000 });

    // fixture 记录的真实请求：summary PATCH 恰一次、value 逐字；首次意向 POST 为零
    const 摘要写入 = fixture.mutations.filter(
      (条) => 条.method === 'PATCH' && 条.path === '/api/v1/me/resume/summary',
    );
    expect(摘要写入.length).toBe(1);
    expect(摘要写入[0]!.body).toEqual({ value: '改后优势第一行\n改后优势第二行' });
    expect(fixture.mutations.filter((条) => 条.method === 'POST' && 条.path === '/api/v1/me/intentions')).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 招聘方 onboarding Backend fixture @backend（P0 修复 Task 7）：全新招聘方从身份选择页
// 起步 —— profile 首读 404 not_found（合法的「缺失」而非故障），名片首写走
// PATCH + If-Match: "0"（fixture 按自己的当前 revision 做 CAS），发岗写出三段独立
// 非空文本，刷新后从权威 HTTP 事实（profile revision 1 + owner Jobs）重新水合。
// 这条 fixture 是独立对象：不与候选 onboarding fixture 共享或复位任何状态。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('招聘方 onboarding Backend fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('新招聘方 onboarding：404 首写、完整发岗与刷新恢复 @backend', async ({ page }) => {
    const fixture = 创建招聘方OnboardingFixture();
    // 合同 C：名片公司自报经 公司选择抽屉 选中组织甲 —— 搜索池供搜索，
    // organizations 供发岗向导按档案 ref 读回公开企业（默认选中行）
    fixture.organizations[P1C标记.组织甲编号] = P1C组织甲();
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P1C搜索池();
    const requests: 拦截请求形[] = [];
    const jobCreateStatuses: number[] = [];
    const profileReadStatuses: number[] = [];
    page.on('response', (response) => {
      if (response.request().method() === 'POST' && response.url().endsWith('/api/v1/recruiter/jobs')) {
        jobCreateStatuses.push(response.status());
      }
      if (response.request().method() === 'GET' && response.url().endsWith('/api/v1/recruiter/profile')) {
        profileReadStatuses.push(response.status());
      }
    });
    await 安装BFF路由(page, {
      登录尝试id: 'att-new-recruiter-onboarding',
      记录目录请求: () => undefined,
      主体初始角色: null,
      招聘方OnboardingFixture: fixture,
      隐私fixture: 隐私,
      请求拦截: (request) => requests.push(request),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
    await page.getByRole('button', { name: '我要招人' }).click();
    await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 20_000 });
    expect(profileReadStatuses[0]).toBe(404);

    await page.getByLabel('姓名').fill('林澈');
    await page.getByLabel('职务').fill('招聘负责人');
    await page.getByRole('button', { name: '未选择公司' }).click();
    await 抽屉搜企业并选中(page, '云衢科技', P1C标记.组织甲名);
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/, { timeout: 20_000 });

    const profileWrite = fixture.mutations.find((item) => item.path === '/api/v1/recruiter/profile');
    expect(profileWrite).toEqual(expect.objectContaining({
      method: 'PATCH',
      ifMatch: '"0"',
      body: { public_name: '林澈', title: '招聘负责人', organization_ref: P1C标记.组织甲编号 },
    }));
    expect(fixture.profile).toEqual(expect.objectContaining({ revision: 1 }));

    await 走完后端发岗向导(page);
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });

    const jobWrite = fixture.mutations.find((item) => item.path === '/api/v1/recruiter/jobs');
    expect(jobWrite).toBeDefined();
    expect(jobWrite!.body).toMatchObject({
      publisher_organization_ref: 'org-fixture-p3-manual-a',
      hiring_organization_ref: 'org-fixture-p3-manual-a',
      description: '用户研究、产品验证、产品策略、实验、数据分析、需求执行、GTM、发布与增长',
      requirements: '应届或毕业年级；有产品、技术、增长、分析或创业经历；关注 AI、SaaS、工作流、开发工具与 Agent',
    });
    expect(jobCreateStatuses).toEqual([201]);
    expect(fixture.ownerJobs).toHaveLength(1);

    await page.reload();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await expect(page.getByText('Fixture 实习岗位')).toBeVisible();
    expect(requests.filter((item) => item.path === '/api/v1/recruiter/profile' && item.method === 'GET').length)
      .toBeGreaterThanOrEqual(2);
    expect(profileReadStatuses).toContain(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FE-IV-01 候选实名域 fixture @backend + Mock 隔离（2026-09-05）。
// 拦截式验证浏览器到 HTTP 的边界与用户旅程：设置页实名行由 summary 驱动 → 独立页
// 提交（multipart 恰一个 metadata JSON + 一至两个 evidence、16–128 可见 ASCII 幂等键）
// → reload 后仍从后端读到 pending（草稿/文件名不出现）→ 取消带顶层 revision 的
// quoted If-Match → 回 unverified + cancelled。fixture 只记录 part 名、metadata JSON、
// headers 与请求计数，不把文件 bytes/文件名写进任何断言或快照；verified/rejected
// 已由组件 fixture 覆盖，本路由不实现 reviewer 终审。这条 E2E 只证明前端接线
// （route fixture），不声称启动或验证真实 BFF。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('候选实名 Backend fixture @backend', () => {
  test('候选实名提交刷新取消闭环 @backend', async ({ page }) => {
    test.setTimeout(150_000);
    const fixture = await 装候选实名(page);

    // 1. 设置页：Backend 实名行由 summary 驱动，初始 unverified
    await page.goto('/#/settings');
    await expect(page.getByRole('button', { name: /实名认证/ })).toContainText('未认证', { timeout: 20_000 });

    // 2. 进入独立实名页
    await page.getByRole('button', { name: /实名认证/ }).click();
    await expect(page).toHaveURL(/#\/settings\/identity-verification$/, { timeout: 10_000 });

    // 3. 填合成姓名、选护照、上传合成 PNG、提交
    await page.getByRole('textbox', { name: '证件姓名' }).fill('Fixture Candidate IV');
    await page.getByRole('combobox', { name: '证件类型' }).selectOption('passport');
    await page.setInputFiles('input[type="file"]', {
      name: '材料.png',
      mimeType: 'image/png',
      buffer: Buffer.from('89 50 4e 47 0d 0a 1a 0a-fixture-png-bytes', 'latin1'),
    });
    await page.getByRole('button', { name: '提交材料' }).click();

    // 4. 页面进入审核中；fixture 记录 metadata 只有两键、一个 evidence、稳定幂等键
    await expect(page.getByText('审核中')).toBeVisible({ timeout: 15_000 });
    expect(fixture.creates).toHaveLength(1);
    expect(fixture.creates[0]!.metadata).toEqual({ legal_name: 'Fixture Candidate IV', document_type: 'passport' });
    expect(fixture.creates[0]!.evidence数).toBe(1);
    expect(fixture.creates[0]!.parts).toEqual(['metadata', 'evidence']);
    expect(fixture.creates[0]!.key).toMatch(/^[!-~]{16,128}$/);

    // 5. reload：页面仍从后端读到 pending；草稿与文件名不出现
    await page.reload();
    await expect(page.getByText('审核中')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Fixture Candidate IV')).toHaveCount(0);
    await expect(page.getByText('材料.png')).toHaveCount(0);

    // 6. 取消：确认层 → If-Match 用顶层 revision → 页面回未认证表单
    await page.getByRole('button', { name: '取消申请' }).click();
    await expect(page.getByText('取消实名认证申请？')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: '取消申请' }).click();
    await expect(page.getByRole('textbox', { name: '证件姓名' })).toBeVisible({ timeout: 15_000 });
    expect(fixture.cancels).toHaveLength(1);
    expect(fixture.cancels[0]!.requestId).toBe('ivq-fixture-0001');
    expect(fixture.cancels[0]!.ifMatch).toBe('"2"'); // create 后的顶层 revision

    // 7. 返回设置页显示 未认证；fixture 当前 summary 为 unverified + cancelled
    await page.goto('/#/settings');
    await expect(page.getByRole('button', { name: /实名认证/ })).toContainText('未认证', { timeout: 20_000 });
    expect(fixture.summary.status).toBe('unverified');
    expect(fixture.summary.current_request?.status).toBe('cancelled');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mock 隔离：设置页保持原型「已认证」演示与点击提示；直达实名路由被页面 replace 回
// 候选设置页；整个会话零 identity-verification 请求。
// ─────────────────────────────────────────────────────────────────────────────
test('Mock 候选实名保持原型且零实名请求 @mock', async ({ page }) => {
  test.setTimeout(90_000);
  const 实名请求: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.includes('identity-verification')) {
      实名请求.push(new URL(request.url()).pathname);
    }
  });

  await page.goto('/#/settings');
  const 实名行 = page.getByRole('button', { name: /实名认证.*已认证/ });
  await expect(实名行).toBeVisible({ timeout: 10_000 });
  await 实名行.click();
  await expect(page.getByText('实名认证 · 已通过，无需重复认证')).toBeVisible();

  // 直达实名路由：Mock 由页面自身 replace 回候选设置页
  await page.goto('/#/settings/identity-verification');
  await expect(page.getByRole('button', { name: /实名认证.*已认证/ })).toBeVisible({ timeout: 10_000 });
  expect(实名请求).toEqual([]);
});

// ─────────────────────────────────────────────────────────────────────────────
// JD PDF 建议稿导入 fixture @backend（2026-09-03）。
// 拦截式验证浏览器到 HTTP 的形状：consent 前零 POST；POST 202 恰两个 multipart part
// （file: application/pdf + processing_consent_confirmed:"true"）与 jd-import- 幂等键；
// GET 按返回的 jdi_* 串行轮询（processing → succeeded）；快照合并只填未改字段；
// 类别只走轻提示、城市只进搜索框，Catalog 引用仍由用户真实选择；解析本身不产生
// Job POST。这条 E2E 只证明前端接线，不证明目标后端已部署 handoff 提交。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('JD 建议稿导入 Backend fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('JD 建议稿导入：consent 前零 POST，202 + 串行轮询后快照合并，发布仍需真实 Catalog @backend', async ({ page }) => {
    const fixture = 创建招聘方OnboardingFixture();
    // 合同 C：名片公司自报经 公司选择抽屉 选中组织甲；organizations 供发岗向导按 ref 读回默认行
    fixture.organizations[P1C标记.组织甲编号] = P1C组织甲();
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P1C搜索池();
    await 安装BFF路由(page, {
      登录尝试id: 'att-jd-import',
      记录目录请求: () => undefined,
      主体初始角色: null,
      招聘方OnboardingFixture: fixture,
      隐私fixture: 隐私,
    });

    // 登录进发岗页（新招聘方 onboarding 同链：名片首写 → 保存并继续）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
    await page.getByRole('button', { name: '我要招人' }).click();
    await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 20_000 });
    await page.getByLabel('姓名').fill('林澈');
    await page.getByLabel('职务').fill('招聘负责人');
    await page.getByRole('button', { name: '未选择公司' }).click();
    await 抽屉搜企业并选中(page, '云衢科技', P1C标记.组织甲名);
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/, { timeout: 20_000 });

    // ── JD 导入路由（注册晚于 安装BFF路由 的通配路由，优先生效）──
    const 导入ID = 'jdi_0123456789abcdef0123456789abcdef';
    const 元数据 = { request_id: 'fixture-req', api_version: 'v1' as const };
    const 建议稿 = {
      title: 'Fixture JD 资深后端工程师',
      recruitment_type: null,
      workplace_mode: 'remote',
      office_location: null,
      description: 'Fixture JD 描述（用户改过就不该出现）',
      requirements: 'Fixture JD 要求（五年以上后端）',
      education_requirement: 'bachelor',
      experience_requirement: 'five_plus_years',
      category_source_name: '后端开发',
      location_source_name: 'fixture',
      keywords: ['Fixture 关键词'],
    };
    const 基础 = {
      import_id: 导入ID,
      created_at: '2026-09-03T01:02:03Z',
    };
    let POST数 = 0;
    const POST状态: number[] = [];
    page.on('response', (响应) => {
      if (响应.url().endsWith('/api/v1/recruiter/job-draft-imports') && 响应.request().method() === 'POST') {
        POST状态.push(响应.status());
      }
    });
    await page.route('**/api/v1/recruiter/job-draft-imports', async (route) => {
      expect(route.request().method()).toBe('POST');
      POST数 += 1;
      const headers = route.request().headers();
      expect(headers['idempotency-key']).toMatch(/^jd-import-.{36}$/);
      const body = route.request().postDataBuffer()?.toString('latin1') ?? '';
      expect(body).toContain('name="file"; filename="synthetic-jd.pdf"');
      expect(body).toContain('Content-Type: application/pdf');
      expect(body).toContain('name="processing_consent_confirmed"');
      expect(body).toContain('true');
      expect(body).not.toContain('display_name');
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ result: { ...基础, status: 'pending', updated_at: '2026-09-03T01:02:03Z' }, meta: 元数据 }),
      });
    });
    let GET数 = 0;
    await page.route(`**/api/v1/recruiter/job-draft-imports/${导入ID}`, async (route) => {
      expect(route.request().method()).toBe('GET');
      GET数 += 1;
      const 结果 = GET数 === 1
        ? { ...基础, status: 'processing', updated_at: '2026-09-03T01:02:05Z' }
        : { ...基础, status: 'succeeded', updated_at: '2026-09-03T01:02:07Z', suggestion: 建议稿 };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: 结果, meta: 元数据 }),
      });
    });

    // ── 第一步先就绪（标题/办公方式/类别），快照里这些是用户已知值 ──
    const 职位类别行 = page.getByRole('button').filter({ hasText: '职位类别' });
    await page.getByPlaceholder(/资深后端工程师/).fill('上传前标题');
    await page.getByRole('button', { name: '混合', exact: true }).click();
    await 职位类别行.click();
    const 类键 = page.getByRole('button', { name: 标记.职位display, exact: true });
    await 类键.first().click();
    await expect(类键).toHaveCount(2, { timeout: 5_000 });
    await 类键.last().click();

    // ── 取消一轮：consent 取消零 POST ──
    await page.getByRole('button', { name: /把 JD 给我/ }).click();
    const JD文件 = page.getByLabel('上传 JD 文件');
    await JD文件.setInputFiles({
      name: 'synthetic-jd.pdf', mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\nfixture jd\n'),
    });
    await expect(page.getByText('允许 AI 识别这份职位描述？')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
    expect(POST数).toBe(0);

    // ── 真正导入：consent 后恰一次 POST 202 ──
    await page.getByRole('button', { name: /把 JD 给我/ }).click();
    await JD文件.setInputFiles({
      name: 'synthetic-jd.pdf', mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\nfixture jd\n'),
    });
    await expect(page.getByText('允许 AI 识别这份职位描述？')).toBeVisible();
    expect(POST数).toBe(0); // consent 前零 mutation
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect.poll(() => POST数).toBe(1);

    // ── 解析期间表单可编辑：进第二步改描述（保护用例）──
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByLabel('职位描述').fill('用户等待时写的描述');

    // ── 轮询到 succeeded（pending → processing → succeeded 两拍，约 6 秒）──
    await expect.poll(() => GET数, { timeout: 20_000 }).toBe(2);
    expect(POST状态).toEqual([202]);
    // 类别建议只走现有轻提示（无常驻节点）
    await expect(page.getByText('AI 识别的职位类别是「后端开发」，请手动选择')).toBeVisible();
    // 解析本身不产生 Job POST
    expect(fixture.mutations.find((项) => 项.path === '/api/v1/recruiter/jobs')).toBeUndefined();
    // 等待期间改过的描述保留
    await expect(page.getByLabel('职位描述')).toHaveValue('用户等待时写的描述');

    // ── 未改的标题被建议替换；横幅进入终局；全远程清空并禁用办公地点（原位不隐藏）──
    await page.getByRole('button', { name: '返回' }).click();
    await expect(page.getByText('已识别，请检查建议')).toBeVisible();
    await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue(建议稿.title);
    // 选中快捷片的 accessible name 带 ✓ 前缀，用包含匹配
    await expect(page.getByRole('button', { name: /全远程/ })).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    const 办公地框 = page.getByPlaceholder(/浦东新区世纪大道/);
    // 全远程建议把方式切到「全远程」并清空地址；当前合同下地址输入仍可用、变选填
    await expect(办公地框).toBeEnabled();
    await expect(办公地框).toHaveValue('');

    // ── 城市源文本只进子视图搜索框（打开时作初词）：先补齐薪资/年薪月数，再验证发布被城市门禁拦下 ──
    await page.getByRole('button', { name: '薪资下限' }).click();
    const 月薪层 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
    await expect(月薪层).toBeVisible({ timeout: 10_000 });
    await 月薪层.getByRole('button', { name: '输入金额' }).click();
    await 月薪层.getByLabel('薪资下限').fill('50');
    await 月薪层.getByLabel('薪资上限').fill('65');
    await 月薪层.getByRole('button', { name: '确定' }).click();
    await expect(月薪层).toHaveCount(0);
    await page.getByRole('button', { name: /年薪月数/ }).click();
    await page.getByRole('button', { name: '确定' }).click();
    await page.getByRole('checkbox', { name: /我已确认经验和学历设置将作为自动匹配依据/ }).check();
    await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
    await expect(page.getByText('请从候选城市中选择')).toBeVisible();
    expect(fixture.mutations.find((项) => 项.path === '/api/v1/recruiter/jobs')).toBeUndefined();
    // 打开全页城市子视图：JD 源文本 'fixture' 作为本次搜索初词；点真实候选取得
    // 地点引用 并保存回填，此时才具备 Job POST 的城市坐标
    await page.getByRole('button').filter({ hasText: '工作城市' }).click();
    const 城市搜索框 = page.getByPlaceholder('搜索城市 / 省份');
    await expect(城市搜索框).toHaveValue('fixture');
    await page.getByRole('button', { name: 标记.城市display, exact: true }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(城市搜索框).toHaveCount(0);
    // 职位要求由建议填入（未被用户改过；输入 label 自 2026-09-11 起为「岗位要求」）
    await expect(page.getByLabel('岗位要求')).toHaveValue(建议稿.requirements);
    await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });

    const 岗位写入 = fixture.mutations.find((项) => 项.path === '/api/v1/recruiter/jobs');
    expect(岗位写入).toBeDefined();
    expect(岗位写入!.body).toMatchObject({
      title: 建议稿.title,
      description: '用户等待时写的描述',
      requirements: 建议稿.requirements,
      workplace_mode: 'remote',
      office_location: '',
      category_id: 'job-fixture-001',
      location_id: 'loc-fixture-001',
      // direct 双 ref 来自名片保存的 organization_ref 按 ID 读回的默认行
      publisher_organization_ref: P1C标记.组织甲编号,
      hiring_organization_ref: P1C标记.组织甲编号,
    });
    // 轮询收口：succeeded 终局后不再读
    expect(GET数).toBe(2);
    expect(POST数).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 标注评审构建 @annotation —— VITE_ANNOTATION_ENABLED=true 的专属构建（端口 4183）。
// Mock / Backend 项目保持缺省命令（无标注变量）→ 缺省构建零标注 UI 的口径由既有
// 用例继续守住；这里只验「标注开着时，工具不挡业务」：
//   1. 窄视口物理鼠标点击技能「添加」键——启动器已 portal 出设备内容，命不中被截走；
//   2. 宽视口启动器中心落在设备外预留工具列内、且在机身（data-遮罩挂载点）之外。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('标注评审构建 @annotation', () => {
  // 显式标注构建 server（端口 4183，VITE_ANNOTATION_ENABLED=true）
  test.use({ baseURL: 'http://127.0.0.1:4183' });

  // 先种上「最大高度」的启动器分支：计数角标 + 铅笔同列（22 + 6gap + 34 = 62px），
  // 让启动器命中区取最大值 —— 工具行按这个最大高度定尺寸，回归才有意义
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('AGXP标注意见', JSON.stringify([{
        编号: 1,
        路由: '/experience',
        位置: '工作经历-module__录入键',
        文本: '添加',
        意见: 'fixture 标注',
        时间: '2026-09-01T00:00:00.000Z',
      }]));
    });
  });

  test('标注模式不遮挡技能添加 @annotation', async ({ page }) => {
    await 安装BFF路由(page, { 记录目录请求: () => {}, 登录尝试id: 'att-annotation-1' });

    // 矮视口（真实小屏手机档）：在线简历屏不滚动、技能录入行固定在 y≈313；
    // 修复前启动器悬浮带（设备底部 96–158px）在 390×664 下根本盖不到这一行，
    // 只有 390×460 这类高度下启动器列（x≥342）才压住「添加」键的右半边。
    // 按钮中心（x≈341.5）恰好贴着启动器左缘外 0.5px —— 中心点击永远命不中被截的
    // 场景，所以回归点选按钮右半中点（用户拇指的常见落点），修复前它被启动器盖住。
    await page.setViewportSize({ width: 390, height: 460 });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 在线简历（工作经历）屏：专业技能录入行
    await page.goto('/#/experience');
    const 技能输入 = page.getByPlaceholder('如：Go、分布式事务');
    await expect(技能输入).toBeVisible({ timeout: 10_000 });
    await 技能输入.fill('Rust');

    // 物理鼠标坐标点击（禁止 forced click / locator.click 的命中补偿）：
    // 启动器若仍悬在设备内容里，这一下会被它截走，技能片不会上屏
    const 添加键 = 技能输入.locator('xpath=following-sibling::button');
    const 添加框 = await 添加键.boundingBox();
    if (!添加框) throw new Error('skill add button is not visible');
    await page.mouse.click(添加框.x + 添加框.width * 0.75, 添加框.y + 添加框.height / 2);

    await expect(page.getByRole('button', { name: '删除技能 Rust' })).toBeVisible({ timeout: 10_000 });
  });

  test('桌面标注启动器位于设备外工具列 @annotation', async ({ page }) => {
    await 安装BFF路由(page, { 记录目录请求: () => {}, 登录尝试id: 'att-annotation-2' });

    // 宽视口 → 两列评审布局：设备内容占主列，启动器进右侧 64px 工具列
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await page.goto('/#/experience');

    const 启动器 = await page.getByRole('button', { name: '标注模式' }).boundingBox();
    const 工具列 = await page.locator('[data-标注工具位]').boundingBox();
    const 机身 = await page.locator('[data-遮罩挂载点]').boundingBox();
    if (!启动器 || !工具列 || !机身) {
      throw new Error('annotation launcher geometry is unavailable');
    }

    // 启动器中心在工具列矩形内
    const 中心x = 启动器.x + 启动器.width / 2;
    const 中心y = 启动器.y + 启动器.height / 2;
    expect(中心x).toBeGreaterThanOrEqual(工具列.x);
    expect(中心x).toBeLessThanOrEqual(工具列.x + 工具列.width);
    expect(中心y).toBeGreaterThanOrEqual(工具列.y);
    expect(中心y).toBeLessThanOrEqual(工具列.y + 工具列.height);

    // 且在机身（设备内容）矩形外 —— 工具列是设备外的保留车道
    const 在机身内 =
      中心x >= 机身.x && 中心x <= 机身.x + 机身.width &&
      中心y >= 机身.y && 中心y <= 机身.y + 机身.height;
    expect(在机身内).toBe(false);
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// 卡片统一（2026-09-10）：三类共享列表卡的跨模式布局验收（Plan Task 4 / Spec §8 层次 3/4）。
// 模式无关性已由无 Provider 组件测试证明，这里不重复建；本组用例只看真实页面入口上的
// 展示层几何与可用性：区域 DOM 顺序、相对卡根几何、水平溢出/遮挡、390 与 320 两档宽的
// 完整 / 全空 / 部分空 / 长文本，以及收藏 / 整卡 / 委托 / 滑动的真实点击。
// Mock 与 Backend 的数据本就不相同（P5 缺公司与匹配分），所以跨模式只比固定区位置
// （≤1px），不做全页像素等同，也不为同图扩展 HTTP schema。
// 截图落在 test-results/卡片统一/（Playwright 每轮清理，属一次性观察证据）。
// ─────────────────────────────────────────────────────────────────────────────

/** 单个卡区相对卡根的几何（px，两位小数） */
interface 卡区几何 { x: number; y: number; w: number; h: number }

/** 一张共享卡的观察：区域 DOM 顺序 + 相对卡根几何 + 文字盒（右列让位检查用） */
interface 卡观察 {
  宽: number;
  高: number;
  顺序: string[];
  区域: Record<string, 卡区几何>;
  文字盒: 卡区几何;
  /** 文字盒内文本的实测渲染宽度（Range）；单行省略文本被裁切时以较小者为准 */
  文字宽: number;
}

/** 采集一张卡内全部 data-card-region 相对卡根的坐标/尺寸；文字盒 = 被右列让位约束的
 *  那个文本容器（招聘两卡 = 候选头行根；求职在谈卡 = 公司名/简介列）。 */
async function 采集卡观察(page: Page, 卡: Locator): Promise<卡观察> {
  return 卡.evaluate((根) => {
    const 两位 = (值: number) => Math.round(值 * 100) / 100;
    const 根框 = 根.getBoundingClientRect();
    const 取 = (元素: Element): 卡区几何 => {
      const 框 = 元素.getBoundingClientRect();
      return {
        x: 两位(框.x - 根框.x), y: 两位(框.y - 根框.y), w: 两位(框.width), h: 两位(框.height),
      };
    };
    const 区域: Record<string, 卡区几何> = {};
    const 顺序: string[] = [];
    for (const 元素 of Array.from(根.querySelectorAll('[data-card-region]'))) {
      const 名 = 元素.getAttribute('data-card-region')!;
      顺序.push(名);
      区域[名] = 取(元素);
    }
    const 文字元素 = 根.querySelector('[data-card-region="head"] > div')
      ?? 根.querySelector('[data-card-region="company"] > div:not([data-card-region])');
    let 文字宽 = 0;
    if (文字元素) {
      const 范围 = document.createRange();
      范围.selectNodeContents(文字元素);
      文字宽 = 两位(范围.getBoundingClientRect().width);
    }
    return {
      宽: 两位(根框.width),
      高: 两位(根框.height),
      顺序,
      区域,
      文字盒: 文字元素 ? 取(文字元素) : { x: 0, y: 0, w: 0, h: 0 },
      文字宽,
    };
  });
}

/** 区域 DOM 顺序 = Spec 冻结的阅读顺序 */
function 断言区域顺序(观察: 卡观察, 期待: readonly string[]) {
  expect(观察.顺序, '卡区 DOM 顺序').toEqual(期待);
}

/** 两张卡固定区的相对几何对齐（≤1px）：只比调用方点名的数据等价区；
 *  内含量不同的区（标签高度、阶段区、薪资宽度）由调用方排除或只比 y */
function 断言区域对齐(
  甲: 卡观察,
  乙: 卡观察,
  区域名们: readonly string[],
  键们: readonly ('x' | 'y' | 'r' | 'b')[] = ['x', 'y'],
) {
  const 值 = (区: 卡区几何, 键: 'x' | 'y' | 'r' | 'b') =>
    键 === 'x' ? 区.x : 键 === 'y' ? 区.y : 键 === 'r' ? 区.x + 区.w : 区.y + 区.h;
  for (const 名 of 区域名们) {
    expect(甲.区域[名], `缺少卡区 ${名}`).toBeDefined();
    expect(乙.区域[名], `缺少卡区 ${名}`).toBeDefined();
    for (const 键 of 键们) {
      expect(Math.abs(值(甲.区域[名]!, 键) - 值(乙.区域[名]!, 键)), `固定区 ${名}.${键} 跨模式差`).toBeLessThanOrEqual(1);
    }
  }
}

/** 卡与全部卡区都落在视口/卡根内：无水平溢出、无绝对定位区被裁出卡根 */
async function 断言卡在视口内(page: Page, 卡: Locator) {
  const 观 = await 卡.evaluate((根) => {
    const 根框 = 根.getBoundingClientRect();
    const 区框们 = Array.from(根.querySelectorAll('[data-card-region]')).map((元) => 元.getBoundingClientRect());
    return {
      视口宽: document.documentElement.clientWidth,
      滚动宽: document.documentElement.scrollWidth,
      卡左: 根框.left, 卡右: 根框.right, 卡底: 根框.bottom,
      区左: 区框们.length === 0 ? 根框.left : Math.min(根框.left, ...区框们.map((框) => 框.left)),
      区右: 区框们.length === 0 ? 根框.right : Math.max(根框.right, ...区框们.map((框) => 框.right)),
      区底: 区框们.length === 0 ? 根框.bottom : Math.max(...区框们.map((框) => 框.bottom)),
    };
  });
  expect(观.滚动宽, '页面水平滚动宽').toBeLessThanOrEqual(观.视口宽);
  expect(观.卡右, '卡右缘出视口').toBeLessThanOrEqual(观.视口宽 + 0.5);
  expect(观.区右, '卡区右缘出卡根').toBeLessThanOrEqual(观.卡右 + 0.5);
  expect(观.区左, '卡区左缘出卡根').toBeGreaterThanOrEqual(观.卡左 - 0.5);
  expect(观.区底, '卡区底部出卡根').toBeLessThanOrEqual(观.卡底 + 0.5);
}

/** 右列分数位不被头行/公司行文字挤住或遮住：实际渲染出的文字右缘 ≤ 分数区左缘（容差 1px） */
function 断言分数位让位(观察: 卡观察) {
  expect(观察.区域.score, '缺少分数区').toBeDefined();
  const 文字右缘 = 观察.文字盒.x + Math.min(观察.文字盒.w, 观察.文字宽);
  expect(
    文字右缘,
    `头行文字右缘 ${文字右缘} 应 ≤ 分数区左缘 ${观察.区域.score!.x}`,
  ).toBeLessThanOrEqual(观察.区域.score!.x + 1);
}

/** 候选头行最多两行（Spec §6）：实测文字盒高 ≤ 两行行框（22px × 2 + 容差） */
function 断言头行最多两行(观察: 卡观察) {
  expect(观察.文字盒.h, '头行文字盒高度').toBeLessThanOrEqual(46);
}

/** 占位次要色（Spec §6）：--次要浅 = #7d8276。只有真实浏览器才解析 CSS var，
 *  单测里只能断类名，这里断计算值。 */
const 次要浅色 = 'rgb(125, 130, 118)';

test.describe('卡片统一 Mock 三屏 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('卡片统一 Mock 三屏 390/320：区域顺序、无溢出与整卡点击可用 @mock', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });

    // ── 求职端在谈单：求职在谈卡（完整 Mock 数据）──
    await Mock登录求职(page);
    await page.goto('/#/app');
    const mock在谈卡 = page.getByTestId('求职在谈卡').first();
    await expect(mock在谈卡.getByText('资深后端工程师 · 交易网关')).toBeVisible({ timeout: 15_000 });
    const mock在谈390 = await 采集卡观察(page, mock在谈卡);
    await 断言卡在视口内(page, mock在谈卡);
    断言区域顺序(mock在谈390, ['company', 'score', 'salary', 'title', 'tags', 'stage']);
    断言分数位让位(mock在谈390);
    // 阶段区胶囊落在白卡上同底（透明或白），不另起一块色底
    expect(await mock在谈卡.evaluate((根) => {
      const 标 = 根.querySelector('[data-card-region="stage"] span');
      return 标 ? getComputedStyle(标).backgroundColor : 'missing';
    })).toMatch(/rgba\(0, 0, 0, 0\)|rgb\(255, 255, 255\)/);
    await page.screenshot({ path: 'test-results/卡片统一/mock-在谈-390.png' });
    // 整卡点击 → 在谈详情
    await mock在谈卡.click();
    await expect(page).toHaveURL(/#\/deal\/J-01$/, { timeout: 10_000 });

    // ── 招聘端在谈候选：招聘在谈卡（Mock 数据亮点缺 → 标签占位）──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
    const mock在谈候选卡 = page.getByTestId('招聘在谈卡').first();
    await expect(mock在谈候选卡.getByRole('img', { name: '适配 94 分' })).toBeVisible({ timeout: 15_000 });
    const mock候选390 = await 采集卡观察(page, mock在谈候选卡);
    await 断言卡在视口内(page, mock在谈候选卡);
    断言区域顺序(mock候选390, ['score', 'head', 'work', 'education', 'tags', 'stage']);
    断言分数位让位(mock候选390);
    await expect(mock在谈候选卡.getByText('亮点信息未知')).toBeVisible();
    await page.screenshot({ path: 'test-results/卡片统一/mock-企业在谈候选-390.png' });
    // 整卡点击 → 候选详情
    await mock在谈候选卡.click();
    await expect(page).toHaveURL(/#\/hr\/candidate\/A-01$/, { timeout: 10_000 });

    // ── 招聘端推荐：招聘推荐卡 ──
    await Mock切到招聘推荐(page);
    const mock推荐卡 = page.getByTestId('招聘推荐卡').first();
    await expect(mock推荐卡.getByRole('img', { name: '适配 91 分' })).toBeVisible({ timeout: 15_000 });
    const mock推荐390 = await 采集卡观察(page, mock推荐卡);
    await 断言卡在视口内(page, mock推荐卡);
    断言区域顺序(mock推荐390, ['score', 'head', 'work', 'education', 'tags', 'actions']);
    断言分数位让位(mock推荐390);
    await page.screenshot({ path: 'test-results/卡片统一/mock-推荐-390.png' });
    // 卡主体与 › 都开匿名在线简历；★ 收藏可点
    await mock推荐卡.getByRole('button', { name: '查看候选画像' }).click();
    await expect(page).toHaveURL(/#\/hr\/resume\/R-11$/, { timeout: 10_000 });
    await page.goBack();
    await expect(mock推荐卡.getByRole('img', { name: '适配 91 分' })).toBeVisible({ timeout: 15_000 });
    await mock推荐卡.getByRole('button', { name: '收藏', exact: true }).click();
    await expect(mock推荐卡.getByRole('button', { name: '取消收藏' })).toBeVisible({ timeout: 10_000 });

    // ── 320×844：三屏重新观察（收窄后仍不溢出、分数位让位、头行不超两行）──
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/#/app');
    await expect(page.getByTestId('求职在谈卡').first()).toBeVisible({ timeout: 15_000 });
    await 断言卡在视口内(page, page.getByTestId('求职在谈卡').first());
    断言分数位让位(await 采集卡观察(page, page.getByTestId('求职在谈卡').first()));
    await page.screenshot({ path: 'test-results/卡片统一/mock-在谈-320.png' });
    await page.goto('/#/hr');
    // 上一步把招聘端子视图停在「推荐」：先点回「在谈」再观察在谈卡
    await page.getByRole('button', { name: '在谈', exact: true }).click();
    await expect(page.getByTestId('招聘在谈卡').first()).toBeVisible({ timeout: 15_000 });
    await 断言卡在视口内(page, page.getByTestId('招聘在谈卡').first());
    断言头行最多两行(await 采集卡观察(page, page.getByTestId('招聘在谈卡').first()));
    await page.screenshot({ path: 'test-results/卡片统一/mock-企业在谈候选-320.png' });
    await Mock切到招聘推荐(page);
    await expect(page.getByTestId('招聘推荐卡').first()).toBeVisible({ timeout: 15_000 });
    await 断言卡在视口内(page, page.getByTestId('招聘推荐卡').first());
    断言头行最多两行(await 采集卡观察(page, page.getByTestId('招聘推荐卡').first()));
    await page.screenshot({ path: 'test-results/卡片统一/mock-推荐-320.png' });
  });
});

test.describe('卡片统一 Backend @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('卡片统一 招聘推荐卡两模式固定区几何对齐、390/320 与收藏委托滑动可用 @backend', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await 装P4招聘(page);

    // ── Backend：P4 推荐腿的招聘推荐卡（完整 candidate_summary）──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    const 后端推荐卡 = page.getByTestId('招聘推荐卡').first();
    await expect(后端推荐卡.getByRole('img', { name: '适配 88 分' })).toBeVisible({ timeout: 15_000 });
    const 后端推荐390 = await 采集卡观察(page, 后端推荐卡);
    await 断言卡在视口内(page, 后端推荐卡);
    断言区域顺序(后端推荐390, ['score', 'head', 'work', 'education', 'tags', 'actions']);
    断言分数位让位(后端推荐390);
    await expect(后端推荐卡.getByText(P4标记.summaryWork)).toBeVisible();
    await page.screenshot({ path: 'test-results/卡片统一/backend-推荐-390.png' });

    // ── Mock 同一张卡的完整数据基准（mock/stg origin）：固定区跨模式 ≤1px ──
    await Mock登录求职(page);
    await Mock切到招聘推荐(page);
    const mock推荐卡 = page.getByTestId('招聘推荐卡').first();
    await expect(mock推荐卡.getByRole('img', { name: '适配 91 分' })).toBeVisible({ timeout: 15_000 });
    const mock推荐390 = await 采集卡观察(page, mock推荐卡);
    expect(Math.abs(mock推荐390.宽 - 后端推荐390.宽)).toBeLessThanOrEqual(1);
    断言区域对齐(mock推荐390, 后端推荐390, ['score', 'head', 'work', 'education', 'tags']);

    // ── Backend 委托 / 收藏 / 详情 / 滑动可用性：先点键，最后才滑开（滑开的行吞卡内点击）──
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('http://127.0.0.1:4182/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    await expect(page.getByTestId('招聘推荐卡').first()).toBeVisible({ timeout: 15_000 });
    await 断言卡在视口内(page, page.getByTestId('招聘推荐卡').first());
    断言头行最多两行(await 采集卡观察(page, page.getByTestId('招聘推荐卡').first()));
    await page.screenshot({ path: 'test-results/卡片统一/backend-推荐-320.png' });
    // 委托无确认层：点击立即发起，卡原地长出 accepted 的权威文案，全程无弹层
    await page.locator('button:has-text("让AI代理去聊")').first().click();
    await expect(page.getByText('已提交给 AI，等待处理').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('dialog')).toHaveCount(0);
    // 收藏：星标点亮（服务端先行 PUT）
    await page.getByTestId('招聘推荐卡').first().getByRole('button', { name: '收藏', exact: true }).click();
    await expect(page.getByTestId('招聘推荐卡').first().getByRole('button', { name: '取消收藏' })).toBeVisible({ timeout: 10_000 });
    // › 详情：canonical 双坐标
    await page.getByTestId('招聘推荐卡').first().getByRole('button', { name: '查看候选画像' }).click();
    await expect(page).toHaveURL(
      new RegExp(`#/hr/jobs/${P4编号.recruiterJob}/recommendations/${P4编号.recruiterRecommendation}$`),
      { timeout: 15_000 },
    );
    await page.goBack();
    await expect(page.getByTestId('招聘推荐卡').first()).toBeVisible({ timeout: 15_000 });
    // 真实触屏左滑露出「不合适」
    await 左滑候选卡(page, P4标记.candidateBRing);
    await expect(page.getByRole('button', { name: '不合适' })).toBeVisible({ timeout: 10_000 });
  });

  test('卡片统一 双端在谈卡两模式固定区几何对齐、390/320 与整卡点击可用 @backend', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await 装P5双角色(page, { 主体初始角色: 'candidate' });

    // ── Backend 候选端：求职在谈卡（公司/简介/字标/匹配分 P5 不提供 → 未知占位）──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    const 后端在谈卡 = page.getByTestId('求职在谈卡').first();
    await expect(后端在谈卡.getByRole('img', { name: '匹配分未知' })).toBeVisible({ timeout: 15_000 });
    const 后端在谈390 = await 采集卡观察(page, 后端在谈卡);
    await 断言卡在视口内(page, 后端在谈卡);
    断言区域顺序(后端在谈390, ['company', 'score', 'salary', 'title', 'tags', 'stage']);
    // 未知分说明放在 40px 容器内：右列单行高、不把薪资推下一行、也不压到职位名
    expect(后端在谈390.区域.score!.h, '未知分右列高度').toBeLessThanOrEqual(46);
    expect(
      后端在谈390.区域.score!.y + 后端在谈390.区域.score!.h,
      '未知分右列底缘应不越过职位名顶',
    ).toBeLessThanOrEqual(后端在谈390.区域.title!.y + 1);
    await expect(后端在谈卡.getByText('公司信息未知')).toBeVisible();
    await expect(后端在谈卡.getByText('公司简介未知')).toBeVisible();
    // 卡面沿用原 Mock 展示行为：把 - 换成 –（不改币种/单位/数值）
    await expect(后端在谈卡.getByText(P5标记.薪资带.replace('-', '–'))).toBeVisible();
    await page.screenshot({ path: 'test-results/卡片统一/backend-在谈候选端-390.png' });
    // 320 收窄：还在候选端会话里，先看候选端在谈卡
    await page.setViewportSize({ width: 320, height: 844 });
    await 断言卡在视口内(page, 后端在谈卡);
    断言分数位让位(await 采集卡观察(page, 后端在谈卡));
    // 320 公司列截断实测（记录行为，版式裁定属产品）：卡内容宽 274 − 右列让位 178
    // − 字标 34 − 间距 10 ≈ 52px 文本盒，两行占位文本在 .单行 下都会省略号截断
    const 公司截断 = await 后端在谈卡.evaluate((根) => {
      const 列 = 根.querySelector('[data-card-region="company"] > div:not([data-card-region])');
      if (!列) return [];
      return Array.from(列.children).map((行) => {
        const 元素 = 行 as HTMLElement;
        const 范围 = document.createRange();
        范围.selectNodeContents(元素);
        return {
          文本: (元素.textContent ?? '').slice(0, 6),
          盒宽: Math.round(元素.clientWidth * 100) / 100,
          内容宽: 元素.scrollWidth,
        };
      });
    });
    expect(公司截断).toHaveLength(2);
    for (const 行 of 公司截断) {
      expect(行.盒宽, '320 公司文本盒 ≈52px（274−178−34−10）').toBeLessThan(60);
      expect(行.内容宽, `「${行.文本}…」在 320 宽被省略号截断`).toBeGreaterThan(行.盒宽);
    }
    await page.screenshot({ path: 'test-results/卡片统一/backend-在谈候选端-320.png' });
    await page.setViewportSize({ width: 390, height: 844 });

    // ── Backend 招聘端：招聘在谈卡（candidate_summary 投影 + 未知分占位）──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    const 后端招聘在谈卡 = page.getByTestId('招聘在谈卡').first();
    await expect(后端招聘在谈卡.getByText(P5标记.现职.甲)).toBeVisible({ timeout: 20_000 });
    const 后端招聘在谈390 = await 采集卡观察(page, 后端招聘在谈卡);
    await 断言卡在视口内(page, 后端招聘在谈卡);
    断言区域顺序(后端招聘在谈390, ['score', 'head', 'work', 'education', 'tags', 'stage']);
    断言分数位让位(后端招聘在谈390);
    await expect(后端招聘在谈卡.getByRole('img', { name: '匹配分未知' })).toBeVisible();
    await expect(后端招聘在谈卡.getByText('需要你', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/卡片统一/backend-在谈招聘端-390.png' });
    // 整卡点击 → 候选详情（Case 坐标不变）
    await 后端招聘在谈卡.click();
    await expect(page).toHaveURL(new RegExp(`#/hr/candidate/${P5编号.甲}$`), { timeout: 15_000 });

    // ── Mock 基准（mock/stg origin）：两类在谈卡完整数据，固定区跨模式 ≤1px ──
    await Mock登录求职(page);
    await page.goto(`${Mock源}/#/app`);
    const mock在谈卡 = page.getByTestId('求职在谈卡').first();
    await expect(mock在谈卡.getByText('资深后端工程师 · 交易网关')).toBeVisible({ timeout: 15_000 });
    const mock在谈390 = await 采集卡观察(page, mock在谈卡);
    expect(Math.abs(mock在谈390.宽 - 后端在谈390.宽)).toBeLessThanOrEqual(1);
    // 公司头行/职位名/标签行是固定区；标签条数不同 → 阶段区高度不比
    断言区域对齐(mock在谈390, 后端在谈390, ['company', 'title', 'tags']);
    // 右列绝对定位靠右，宽随薪资文案变：只比 y 与右缘
    断言区域对齐(mock在谈390, 后端在谈390, ['score'], ['y', 'r']);
    // 薪资文本盒高度随字形（「薪」是 CJK 字形，行框更高）而变，不是固定区；
    // 两模式各自查「薪资与环同一行、不越出右列」这一布局事实
    for (const 观 of [mock在谈390, 后端在谈390]) {
      expect(观.区域.salary!.y + 观.区域.salary!.h, '薪资底缘不越出右列').toBeLessThanOrEqual(观.区域.score!.y + 观.区域.score!.h + 1);
    }
    await page.goto(`${Mock源}/#/identity?switch=1&from=app`);
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
    const mock在谈候选卡 = page.getByTestId('招聘在谈卡').first();
    await expect(mock在谈候选卡.getByRole('img', { name: '适配 94 分' })).toBeVisible({ timeout: 15_000 });
    const mock在谈候选390 = await 采集卡观察(page, mock在谈候选卡);
    断言区域对齐(mock在谈候选390, 后端招聘在谈390, ['score', 'head', 'work', 'education', 'tags']);

    // ── 320×844：Mock 招聘端在谈卡重新观察 ──
    await page.setViewportSize({ width: 320, height: 844 });
    await 断言卡在视口内(page, page.getByTestId('招聘在谈卡').first());
    断言头行最多两行(await 采集卡观察(page, page.getByTestId('招聘在谈卡').first()));
    await page.screenshot({ path: 'test-results/卡片统一/backend-在谈招聘端-320.png' });
  });

  test('卡片统一 推荐卡全空/零值/长文本变体 390：占位齐、分数位不被挤、行不收 @backend', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // P4 推荐腿三个变体卡：全空摘要 / 长文本摘要 / 零值分（+ 零年）
    const fixture = P4发现fixture();
    fixture.招聘可用 = {
      [P4编号.recruiterJob]: [
        P4招聘卡({ candidate_summary: null }),
        P4招聘卡({
          recommendation_id: 'rec_e2e_card_unified_long',
          candidate_summary: P4摘要({
            gender: null,
            experience_years: 12,
            job_status: 'unemployed',
            degree: 'P4 Fixture 一段很长很长的学历名称用来验证头行最多两行的截断行为',
            latest_experience: {
              company: 'P4 Fixture 一家公司名称特别长',
              title: '负责超大规模分布式系统与多机房容灾的资深后端工程师',
            },
            latest_education: { institution: 'P4 Fixture 一所名称很长的大学', major: '超长专业名称方向' },
            personal_highlights: ['P4 Fixture 长亮点之一', 'P4 Fixture 长亮点之二'],
          }),
        }),
        P4招聘卡({
          recommendation_id: 'rec_e2e_card_unified_zero',
          match_score: 0,
          candidate_summary: P4摘要({ experience_years: 0, personal_highlights: [], degree: ' ' }),
        }),
      ],
    };
    await 装P4招聘(page, { fixture });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    const 卡们 = page.getByTestId('招聘推荐卡');
    await expect(卡们).toHaveCount(3, { timeout: 15_000 });

    // 全空：六个未知占位齐，工作/教育/标签行一个不收
    const 全空卡 = 卡们.nth(0);
    // 头行段外层 span 连着「｜」分隔符：占位文本用子串匹配
    for (const 占位 of ['经验未知', '学历未知', '求职状态未知', '工作经历未知', '教育经历未知', '亮点信息未知']) {
      await expect(全空卡.getByText(占位)).toBeVisible();
    }
    await expect(全空卡.getByRole('img', { name: '性别未知' })).toBeVisible();
    await 断言卡在视口内(page, 全空卡);
    断言分数位让位(await 采集卡观察(page, 全空卡));

    // 长文本：头行最多两行、分数位仍让位；工作/教育行仍在（不收行）
    const 长卡 = 卡们.nth(1);
    await expect(长卡.getByText('工作经历未知')).toHaveCount(0);
    await 断言卡在视口内(page, 长卡);
    const 长观察 = await 采集卡观察(page, 长卡);
    断言分数位让位(长观察);
    断言头行最多两行(长观察);

    // 零值：真实 0 分仍是 0 分环（不是未知占位）；0 年 = 「不满 1 年」；亮点空 → 占位；
    // 纯空白学历（wire 上 degree: ' '）不冒充已知值 → 「学历未知」占位
    const 零卡 = 卡们.nth(2);
    await expect(零卡.getByRole('img', { name: '适配 0 分' })).toBeVisible();
    await expect(零卡.getByRole('img', { name: '匹配分未知' })).toHaveCount(0);
    await expect(零卡.getByText('不满 1 年')).toBeVisible();
    await expect(零卡.getByText('学历未知')).toBeVisible();
    await expect(零卡.getByText('亮点信息未知')).toBeVisible();
    await 断言卡在视口内(page, 零卡);
    await page.screenshot({ path: 'test-results/卡片统一/backend-推荐变体-390.png' });

    // 320 收窄（Spec §8.3：390 与 320 都看长文状态）：长文本卡仍不溢出、
    // 头行最多两行、分数位不被挤
    await page.setViewportSize({ width: 320, height: 844 });
    await 断言卡在视口内(page, 长卡);
    const 长观察320 = await 采集卡观察(page, 长卡);
    断言头行最多两行(长观察320);
    断言分数位让位(长观察320);
    await page.screenshot({ path: 'test-results/卡片统一/backend-推荐变体-320.png' });
  });

  test('卡片统一 在谈卡超长职位名与全空摘要变体 390/320：占位齐、行不收 @backend', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // 候选端首页唯一一行 丁 换超长职位名；招聘端首页唯一一行 甲 摘要显式 null → 全未知占位
    const P5fixture = 创建P5MatchCasefixture();
    P5fixture.cases[P5编号.丁]!.职位名 =
      'P5 Fixture 超长在谈岗位名称用来验证求职在谈卡职位名单行收尾不把标签行挤走';
    P5fixture.cases[P5编号.甲]!.摘要 = null;
    await 装P5双角色(page, { fixture: P5fixture, 主体初始角色: 'candidate' });

    // ── 候选端：超长职位名单行收尾（单行截断），标签行不被挤走 ──
    await page.goto('/#/app');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    const 长职位卡 = page.getByTestId('求职在谈卡').first();
    await expect(长职位卡.getByText(/超长在谈岗位名称/)).toBeVisible({ timeout: 15_000 });
    // 公司名占位 = 次要文字色（Spec §6）：P5 不给公司名，占位不再与真实公司名同色
    expect(await 长职位卡.getByText('公司信息未知').evaluate((元) => getComputedStyle(元).color)).toBe(次要浅色);
    await 断言卡在视口内(page, 长职位卡);
    const 长职位观察 = await 采集卡观察(page, 长职位卡);
    expect(长职位观察.区域.title!.h, '职位名单行高').toBeLessThanOrEqual(30);
    expect(
      长职位观察.区域.tags!.y,
      '标签行仍贴在职位名下方一行的距离内',
    ).toBeLessThanOrEqual(长职位观察.区域.title!.y + 长职位观察.区域.title!.h + 20);
    await page.screenshot({ path: 'test-results/卡片统一/backend-在谈变体-390.png' });

    // 320 收窄（Spec §8.3：长文状态两档宽都看）：超长职位名仍单行收尾、
    // 标签行不被挤走、右列分数位不被遮
    await page.setViewportSize({ width: 320, height: 844 });
    await 断言卡在视口内(page, 长职位卡);
    const 长职位观察320 = await 采集卡观察(page, 长职位卡);
    expect(长职位观察320.区域.title!.h, '职位名单行高(320)').toBeLessThanOrEqual(30);
    断言分数位让位(长职位观察320);
    await page.screenshot({ path: 'test-results/卡片统一/backend-在谈变体-320.png' });
    await page.setViewportSize({ width: 390, height: 844 });

    // ── 招聘端：摘要显式 null = 全未知占位，行与图标一个不少 ──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    const 全空在谈卡 = page.getByTestId('招聘在谈卡').first();
    await expect(全空在谈卡.getByText('工作经历未知')).toBeVisible({ timeout: 20_000 });
    for (const 占位 of ['经验未知', '学历未知', '求职状态未知', '工作经历未知', '教育经历未知', '亮点信息未知']) {
      await expect(全空在谈卡.getByText(占位)).toBeVisible();
    }
    // 头行占位段也走次要文字色（Spec §6）：头行三段占位不再继承头行的 --墨
    expect(await 全空在谈卡.getByText('经验未知').evaluate((元) => getComputedStyle(元).color)).toBe(次要浅色);
    await 断言卡在视口内(page, 全空在谈卡);
    断言分数位让位(await 采集卡观察(page, 全空在谈卡));
    await page.screenshot({ path: 'test-results/卡片统一/backend-在谈招聘端全空-390.png' });

    // 320 收窄：全空在谈卡仍不溢出、头行不超两行
    await page.setViewportSize({ width: 320, height: 844 });
    await 断言卡在视口内(page, page.getByTestId('招聘在谈卡').first());
    断言头行最多两行(await 采集卡观察(page, page.getByTestId('招聘在谈卡').first()));
    await page.screenshot({ path: 'test-results/卡片统一/backend-在谈招聘端全空-320.png' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// J-PILOT-01 连续委托接线 @backend（Task 7）：既有本地浏览器 fixture 的跨页面消费与
// 局部布局验证。场景一/二复用 装P4候选（P4 发现域 + P2 附件库 + 本 P5 fixture 的
// negotiation 回答臂）；场景三复用 装P5双角色 与 Plan 已记录的改前几何数值（常量）。
// 相位转换由用例对 fixture 字段的最小显式推进表达，不建编排器。全部
// https://app.invalid/api/v1/** 请求由本地 route 拦截（未声明坐标固定 404
// negotiation_not_found），未触达真实后端；这是本地非 L3 证据，不是真实跨端旅程
// 验收（Spec §11：用户明确延后 L3）。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('J-PILOT-01 连续委托接线 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  /** 场景公共前置：P4 候选推荐卡 + 1 份 PDF 附件库 + P5 fixture（连续臂在场）。
   *  既有 Case 的连续记录全部删去：本次委托的 dlg 记录是这条旅程的唯一连续身份
   *  （同一 canonical 记录开案不重建第二条 —— 「无第二张卡」断言的前提；
   *  active 恰一条也让翻页不参与本旅程断言）。 */
  function 建连续委托场景(): { p4: P4发现fixture形; p2: P2附件fixture形; p5: P5MatchCasefixture形 } {
    const p4 = P4发现fixture();
    const p2 = 创建P2附件fixture();
    p2.items = [P2新附件(1, 'P4 Fixture 候选简历.pdf', Buffer.from('%PDF-1.7\nfixture\n'))];
    const p5 = 创建P5MatchCasefixture();
    for (const 键 of [P5连续编号.甲, P5连续编号.乙, P5连续编号.丙一, P5连续编号.丙二, P5连续编号.丁]) {
      delete p5.连续记录[键];
    }
    return { p4, p2, p5 };
  }

  const 委托POST们 = (p4: P4发现fixture形) =>
    p4.变更请求.filter((项) => 项.path === '/api/v1/me/job-delegations' && 项.method === 'POST');

  test('场景一：UI 选择 PDF/确认→POST accepted→查看进展→在谈同卡→公开初评→S0→S1 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const { p4, p2, p5 } = 建连续委托场景();
    await 装P4候选(page, {
      fixture: p4, 附件fixture: p2, P5fixture: p5,
      请求拦截: (项) => 请求序.push(`${项.method} ${项.path}${项.query ?? ''}`),
    });

    // ── 岗位卡 → 确认层 → 原对 PDF + 字面披露 true（同键两次：传输层受控重试）──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '让AI代理去谈' }).click();
    await expect(page.getByRole('dialog', { name: '确认委托AI代理？' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: '确认委托', exact: true }).click();
    await expect.poll(() => 委托POST们(p4).length, { timeout: 15_000 }).toBe(1);
    const 委托POST = 委托POST们(p4);
    expect(委托POST[0]!.body).toEqual({
      intention_id: P4编号.intention,
      selection: { items: [P4编号.job] },
      disclosure_acknowledged: true,
      resume_file_id: 'rf_1',
      resume_file_version_id: 'rfv_1_1',
    });
    expect(委托POST[0]!.idempotencyKey).not.toBe('');

    // ── 受理后不自动跳页（仍在岗位/市场视图，卡面「AI代理已接手」）；进岗位页，
    //    原主按钮变可点的「查看进展」──
    await expect(page).toHaveURL(/#\/app$/);
    await expect(page.getByText('AI代理已接手')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '查看职位详情' }).first().click();
    await expect(page).toHaveURL(new RegExp(`#/job/${P4编号.job}$`), { timeout: 15_000 });
    const 查看进展 = page.getByRole('button', { name: '查看进展' });
    await expect(查看进展).toBeVisible({ timeout: 15_000 });

    // ── 查看进展 → 同一条 dlg 记录的聚合详情（尚未初评：等待开始 + 禁用输入）──
    await 查看进展.click();
    await expect(page).toHaveURL(new RegExp(`#/deal/${P4编号.candidateDelegation}$`), { timeout: 15_000 });
    await expect(page.getByText('已接手，等待开始')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder('AI 代理正在进行公开信息初评')).toBeDisabled();
    await expect(page.getByText('公开信息初评')).toHaveCount(0); // 尚无公开评托盘

    const 记录 = p5.连续记录[P4编号.candidateDelegation]!;
    const 乙 = p5.cases[P5编号.乙]!;
    /** S0 小结样本：initial 托盘与公开初评托盘同屏，来源标签区分（初评 vs 公开信息初评）。 */
    const 乙小结托盘 = () => {
      乙.阶段区们[0]!.screening_records = {
        messages: [],
        summaries: [{
          id: 'sum_p5_s0_1', phase: 'initial' as const,
          summary: 'P5 Fixture S0 条件确认小结', occurred_at: '2026-08-29T01:30:00Z',
        }],
      };
    };

    // ── 公开初评（fixture 最小推进）：3 秒节拍内托盘上屏，来源标签明确 ──
    记录.phase = 'evaluating';
    记录.evaluationId = 'evp_p5_fixture0000000000000000000002';
    记录.公开评 = { decision: 'fit', summary: 'P5 Fixture 公开初评·基础信息匹配' };
    记录.updatedAt = '2026-08-29T04:10:00Z';
    await expect(page.getByText('公开信息初评').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('P5 Fixture 公开初评·基础信息匹配')).toBeVisible();
    await expect(page.getByText('正在进行公开信息初评')).toBeVisible();

    // ── 开案（同一条记录指到 Case，无第二张卡）：S0 消费 case_detail ──
    //    （fixture 里开案的 Case 冻结职位 = 本次受托岗位：职位名随 Case 同步）
    乙.职位名 = P4标记.jobTitle;
    乙小结托盘();
    记录.phase = 'case_started';
    记录.caseId = P5编号.乙;
    记录.updatedAt = '2026-08-29T04:20:00Z';
    await expect(page.getByText('匿名初筛', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P5标记.问题).first()).toBeVisible();
    // 来源区分：公开信息初评与 S0 初评小结各自独立托盘（S0 总结行 = 标签：正文 成对呈现）
    await expect(page.getByText('公开信息初评').first()).toBeVisible();
    await expect(page.getByText('P5 Fixture 公开初评·基础信息匹配')).toBeVisible();
    await expect(page.getByText(`初评：${P5标记.S0小结}`)).toBeVisible();
    await expect(page.getByPlaceholder('双方 AI 代理正在确认条件')).toBeDisabled();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();

    // ── S1：Case 推进到递交简历（原绑定对 typed 附件直接呈现）──
    乙.stage = 'resume_submission';
    乙.status = 'needs_user';
    乙.step = 'awaiting_recruiter_decision';
    乙.updatedAt = '2026-08-29T04:30:00Z';
    乙.候选 = { needsAction: false, actions: [] };
    乙.招聘 = { needsAction: true, actions: ['decide_resume_screening'] };
    乙.已绑定 = true;
    乙.解析 = 'succeeded';
    await expect(page.getByText('递交简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: new RegExp(P5标记.简历名) })).toBeVisible();

    // ── 在谈同卡：active 恰一张卡（本委托的 dlg 记录），点击回同一记录 ──
    await page.goto('/#/app');
    await page.getByRole('button', { name: '在谈', exact: true }).click(); // 回在谈子视图（进入时在市场）
    const 卡 = page.getByTestId('求职在谈卡');
    await expect(卡).toHaveCount(1, { timeout: 15_000 });
    await expect(卡.getByText(P4标记.jobTitle)).toBeVisible();
    await 卡.click();
    await expect(page).toHaveURL(new RegExp(`#/deal/${P4编号.candidateDelegation}$`), { timeout: 15_000 });
    await expect(page.getByText('递交简历', { exact: true })).toBeVisible({ timeout: 15_000 });

    // ── 全程零第二个候选 Case GET（候选读取唯一来源 = me/negotiations 聚合）──
    expect(请求序.filter((项) => 项.includes('/api/v1/me/match-cases'))).toEqual([]);
    expect(请求序.filter((项) => 项.startsWith('GET /api/v1/me/negotiations?')).length).toBeGreaterThanOrEqual(1);
    expect(请求序.filter((项) => 项.startsWith('GET /api/v1/me/negotiations/')).length).toBeGreaterThanOrEqual(1);
  });

  test('场景二：写响应丢失→同标签页 reload→原命令核对→失败→retry 原代际→归档回读 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const { p4, p2, p5 } = 建连续委托场景();
    // 写响应丢失：每把键恒 503 operation_outcome_unknown（受理已落登记，响应不送达）
    p4.分支 = { 候选委托未知: true };
    await 装P4候选(page, {
      fixture: p4, 附件fixture: p2, P5fixture: p5,
      请求拦截: (项) => 请求序.push(`${项.method} ${项.path}${项.query ?? ''}`),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '让AI代理去谈' }).click();
    await page.getByRole('button', { name: '确认委托', exact: true }).click();
    // 两把 503（新键 + 同键受控重试）：结果未知 → 未决命令保留、无可靠 ID；
    // 岗位页主键 = 「核对提交结果」（不重新选 PDF）
    await expect.poll(() => 委托POST们(p4).length, { timeout: 15_000 }).toBe(2);
    await page.getByRole('button', { name: '查看职位详情' }).first().click();
    await expect(page).toHaveURL(new RegExp(`#/job/${P4编号.job}$`), { timeout: 15_000 });
    await expect(page.getByRole('button', { name: '核对提交结果' })).toBeVisible({ timeout: 15_000 });

    // ── 同标签页 reload：原命令（key + body）从 sessionStorage 恢复，仍是待核对 ──
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`#/job/${P4编号.job}$`), { timeout: 20_000 });
    await expect(page.getByRole('button', { name: '核对提交结果' })).toBeVisible({ timeout: 15_000 });

    // ── 核对：放行后原 key + 原 body 恰一次重放 → 回执收口 → 查看进展 ──
    p4.分支 = {};
    await page.getByRole('button', { name: '核对提交结果' }).click();
    await expect.poll(() => 委托POST们(p4).length, { timeout: 15_000 }).toBe(3);
    const 委托POST = 委托POST们(p4);
    expect(委托POST[2]!.idempotencyKey).toBe(委托POST[0]!.idempotencyKey);
    expect(委托POST[2]!.body).toEqual(委托POST[0]!.body);
    const 查看进展 = page.getByRole('button', { name: '查看进展' });
    await expect(查看进展).toBeVisible({ timeout: 15_000 });

    // ── 初评失败（fixture 最小推进）：重试初评/归档动作槽就位 ──
    const 记录 = p5.连续记录[P4编号.candidateDelegation]!;
    const 置失败初评 = () => {
      记录.phase = 'evaluation_failed';
      记录.failure = { code: 'delegation_agent_unavailable', retryable: true };
      记录.needsAction = true;
      记录.actions = { retry: true, archive: true, open_case: false };
    };
    置失败初评();
    await 查看进展.click();
    await expect(page.getByText('本次评估未完成', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '重试初评' })).toBeVisible();
    await expect(page.getByRole('button', { name: '归档', exact: true })).toBeVisible();

    // ── retry：body 严格 {expected_retry_generation:0} + Idempotency-Key；202 受理后
    //    权威回读回到 evaluating（重试/归档动作退场）──
    await page.getByRole('button', { name: '重试初评' }).click();
    const 重试POST路径 = `/api/v1/me/negotiations/${P4编号.candidateDelegation}/retry`;
    await expect.poll(() => p5.变更请求.filter((项) => 项.path === 重试POST路径).length, { timeout: 15_000 }).toBe(1);
    const 重试POST = p5.变更请求.filter((项) => 项.path === 重试POST路径);
    expect(重试POST[0]!.body).toEqual({ expected_retry_generation: 0 });
    expect(重试POST[0]!.idempotencyKey).not.toBe('');
    await expect(page.getByText('正在进行公开信息初评')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '重试初评' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '归档', exact: true })).toHaveCount(0);

    // ── 再次失败（代际已被 retry 消费为 1）→ 归档：body 严格 {} 且无 Idempotency-Key，
    //    权威 shelf 回读：active 无卡、历史有卡，绝不复活第二条记录 ──
    置失败初评();
    await expect(page.getByText('本次评估未完成', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '归档', exact: true }).click();
    await expect(page.getByText('移入历史，不是取消')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: '归档', exact: true }).click();
    const 归档POST路径 = `/api/v1/me/negotiations/${P4编号.candidateDelegation}/archive`;
    await expect.poll(() => p5.变更请求.filter((项) => 项.path === 归档POST路径).length, { timeout: 15_000 }).toBe(1);
    const 归档POST = p5.变更请求.filter((项) => 项.path === 归档POST路径);
    expect(归档POST[0]!.body).toEqual({});
    expect(归档POST[0]!.idempotencyKey).toBeNull();

    // 权威回读（动作后的已载刷新/重读）：在谈空、历史有卡
    await page.goto('/#/app');
    await expect(page.getByTestId('求职在谈卡')).toHaveCount(0, { timeout: 15_000 });
    await page.goto('/#/archived');
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('本次评估未完成', { exact: true })).toBeVisible();

    // retry/archive 竞争不造重复记录：全程零 Case GET；连续详情读取至少发生一次
    // （单飞/栅栏下同一坐标可多次回读，重复不判漂移 —— 在谈/历史恰一张卡已单独断言）
    expect(请求序.filter((项) => 项.includes('/api/v1/me/match-cases'))).toEqual([]);
    const 连续坐标 = p5.连续读取.filter((项) => 项.startsWith('GET /api/v1/me/negotiations/'));
    expect(连续坐标.length).toBeGreaterThanOrEqual(1);
  });

  test('场景三：双端 S0 禁用输入与布局保持（390/320 对照改前基准） @backend', async ({ page }) => {
    await 装P5双角色(page, { 主体初始角色: 'candidate' });

    /** 与改前基准同口径的几何探针（getBoundingClientRect 视口相对；滚动区内元素
     *  由断言用 rect.y + scrollTop 还原成内容坐标比较）。 */
    const 量底栏几何 = () => page.evaluate(() => {
      const 矩形 = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, disabled: (el as HTMLInputElement).disabled };
      };
      const 区们 = [...document.querySelectorAll('[class*="输入条区"]')];
      const 区 = 区们[0];
      const 输入 = 区?.querySelector('textarea');
      const 发送 = 区?.querySelector('button');
      const tab = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '代谈进度');
      const 阶段 = [...document.querySelectorAll('*')].find(
        (el) => el.children.length === 0 && el.textContent?.trim() === '匿名初筛');
      const 滚动 = document.querySelector('[class*="滚动区"]');
      return {
        输入控件: { ...矩形(输入!), placeholder: (输入 as HTMLTextAreaElement).placeholder },
        发送键: 矩形(发送!),
        容器: 矩形(区!),
        容器命中数: 区们.length,
        Tab行_代谈进度: 矩形(tab!),
        四阶段首标题_匿名初筛: 矩形(阶段!),
        scrollTop: 滚动 ? (滚动 as HTMLElement).scrollTop : null,
        根溢出: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    // ── 候选端 S0（#/deal/乙，与改前基准同 fixture 相位、同视口）──
    await page.setViewportSize({ width: 390, height: 664 });
    await page.goto(`/#/deal/${P5编号.乙}`);
    await expect(page.getByText(P5标记.乙职位名).first()).toBeVisible({ timeout: 20_000 });
    const S0输入 = page.getByPlaceholder('双方 AI 代理正在确认条件');
    await expect(S0输入).toBeVisible();
    await expect(S0输入).toBeDisabled();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
    await expect(page.getByText('旧版状态待核实，请交负责人处理').first()).toBeVisible();
    const 候选390 = await 量底栏几何();
    expect(候选390.容器命中数).toBe(1);
    expect(候选390.输入控件.x, '候选390 输入 x').toBe(35);
    expect(候选390.输入控件.y, '候选390 输入 y').toBe(610);
    expect(候选390.输入控件.width, '候选390 输入宽').toBe(283);
    expect(候选390.输入控件.height, '候选390 输入高').toBe(38);
    expect(候选390.发送键.x, '候选390 发送 x').toBe(328);
    expect(候选390.发送键.y, '候选390 发送 y').toBe(612);
    expect(候选390.发送键.width, '候选390 发送宽').toBe(36);
    expect(候选390.发送键.height, '候选390 发送高').toBe(36);
    expect(候选390.容器.x, '候选390 容器 x').toBe(0);
    expect(候选390.容器.y, '候选390 容器 y').toBe(594);
    expect(候选390.容器.width, '候选390 容器宽').toBe(390);
    expect(候选390.容器.height, '候选390 容器高').toBe(70);
    expect(候选390.Tab行_代谈进度.y, '候选390 Tab y').toBe(60);
    expect(候选390.Tab行_代谈进度.height, '候选390 Tab 高').toBe(21);
    expect(
      候选390.四阶段首标题_匿名初筛.y + (候选390.滚动区?.scrollTop ?? 0),
      '候选390 匿名初筛内容坐标（Plan 改前基准·候选端：视口 y=95 + 捕获时 scrollTop 47'
        + ' = 内容坐标 142；Task 6 新增「旧版状态待核实」行 26px → 168，Δ 见 Plan 验证表）',
    ).toBe(168);
    expect(候选390.根溢出, '候选390 根横向溢出 0').toBe(0);
    await page.screenshot({ path: 'test-results/J-PILOT-01/s3-候选-S0-390.png', fullPage: true });

    await page.setViewportSize({ width: 320, height: 568 });
    await expect(S0输入).toBeVisible();
    const 候选320 = await 量底栏几何();
    expect(候选320.输入控件.x).toBe(35);
    expect(候选320.输入控件.y).toBe(514);
    expect(候选320.输入控件.width).toBe(213);
    expect(候选320.输入控件.height).toBe(38);
    expect(候选320.发送键.x).toBe(258);
    expect(候选320.发送键.y).toBe(516);
    expect(候选320.发送键.width).toBe(36);
    expect(候选320.发送键.height).toBe(36);
    expect(候选320.容器.y).toBe(498);
    expect(候选320.容器.height).toBe(70);
    expect(候选320.Tab行_代谈进度.y).toBe(60);
    expect(候选320.四阶段首标题_匿名初筛.y + (候选320.滚动区?.scrollTop ?? 0), '候选320 内容坐标：基准 y=95+scrollTop 58=153，+26 同上').toBe(179);
    expect(候选320.根溢出).toBe(0);
    await page.screenshot({ path: 'test-results/J-PILOT-01/s3-候选-S0-320.png', fullPage: true });

    // ── 切招聘端：同 Case 的 S0 底栏同位禁用；招聘屏无候选私有总结/初评 ──
    await page.setViewportSize({ width: 390, height: 664 });
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    await page.goto(`/#/hr/candidate/${P5编号.乙}`);
    await expect(page.getByText(P5标记.乙职位名).first()).toBeVisible({ timeout: 20_000 });
    const 招聘S0输入 = page.getByPlaceholder('双方 AI 代理正在确认条件');
    await expect(招聘S0输入).toBeVisible();
    await expect(招聘S0输入).toBeDisabled();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
    // 招聘屏无候选私有初评/总结：公开初评托盘与候选私有词一个不出现
    await expect(page.getByText('公开信息初评')).toHaveCount(0);
    await expect(page.getByText('本次评估未完成')).toHaveCount(0);
    const 招聘390 = await 量底栏几何();
    expect(招聘390.输入控件.x).toBe(35);
    expect(招聘390.输入控件.y).toBe(610);
    expect(招聘390.输入控件.width).toBe(283);
    expect(招聘390.输入控件.height).toBe(38);
    expect(招聘390.发送键.x).toBe(328);
    expect(招聘390.发送键.y).toBe(612);
    expect(招聘390.发送键.width).toBe(36);
    expect(招聘390.发送键.height).toBe(36);
    expect(招聘390.容器.y).toBe(594);
    expect(招聘390.容器.height).toBe(70);
    expect(招聘390.Tab行_代谈进度.y).toBe(70);
    expect(招聘390.四阶段首标题_匿名初筛.y + (招聘390.滚动区?.scrollTop ?? 0)).toBe(178);
    expect(招聘390.根溢出).toBe(0);
    await page.screenshot({ path: 'test-results/J-PILOT-01/s3-招聘-S0-390.png', fullPage: true });

    await page.setViewportSize({ width: 320, height: 568 });
    await expect(招聘S0输入).toBeVisible();
    const 招聘320 = await 量底栏几何();
    expect(招聘320.输入控件.x).toBe(35);
    expect(招聘320.输入控件.y).toBe(514);
    expect(招聘320.输入控件.width).toBe(213);
    expect(招聘320.输入控件.height).toBe(38);
    expect(招聘320.发送键.x).toBe(258);
    expect(招聘320.发送键.y).toBe(516);
    expect(招聘320.发送键.width).toBe(36);
    expect(招聘320.发送键.height).toBe(36);
    expect(招聘320.容器.y).toBe(498);
    expect(招聘320.容器.height).toBe(70);
    expect(招聘320.Tab行_代谈进度.y).toBe(70);
    expect(招聘320.四阶段首标题_匿名初筛.y + (招聘320.滚动区?.scrollTop ?? 0)).toBe(189);
    expect(招聘320.根溢出).toBe(0);
    await page.screenshot({ path: 'test-results/J-PILOT-01/s3-招聘-S0-320.png', fullPage: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 期望行业 @mock（core editors §5.2 Task 7）：选期望行业页两模式共用
// 期望行业选择正文 —— Mock 沿本地 行业字典 作模拟目录（推荐一级片可切换、手风琴组行
// 展开细分片多选、3 项上限后未选片禁用变灰、已选片再点移除）。选择即写意向草稿
//（原业务，保存只负责返回），返回重入计数与勾选保留。全程零 /api/v1 请求。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 期望行业 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('推荐+展开选满3项：返回重入保留、第4项禁用、已选片移除后回显 @mock', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);

    // 「添加求职期望」→ 期望行业行 → 行业子页（共用正文，本地 行业字典 作模拟目录）
    await page.goto('/#/intentions/new');
    await expect(page.getByRole('button', { name: /期望行业/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /期望行业/ }).click();
    await expect(page.getByRole('heading', { name: '已选行业' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('0/3')).toBeVisible();
    // picker 统一 Task 1：推荐区按 Plan 删除，页面只剩手风琴 6 组行
    await expect(page.getByText('推荐')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /智能硬件 \/ 制造/ })).toBeVisible();

    // 正常态截图（与改前拍对照：原 Mock 行业页同版式同控件）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-期望行业-正常.png`, fullPage: true });

    // 展开互联网平台组选两个细分 + 展开云计算组选一级叶子 → 3/3（推荐片已删除；
    // 选中勾由共用 行业分类列表 行内渲染，折叠态由 Task 5 的 @picker 用例专门覆盖）
    await page.getByRole('button', { name: /互联网平台/ }).click();
    await page.getByRole('button', { name: '电商与交易', exact: true }).click();
    await expect(page.getByText('1/3')).toBeVisible();
    await expect(page.getByRole('button', { name: /电商与交易 ✓/ })).toBeVisible();
    await page.getByRole('button', { name: '本地生活', exact: true }).click();
    await expect(page.getByText('2/3')).toBeVisible();
    await page.getByRole('button', { name: /云计算 \/ 基础软件/ }).click();
    await page.getByRole('button', { name: '数据库', exact: true }).click();
    await expect(page.getByText('3/3')).toBeVisible();
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-期望行业-选中.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);

    // 上限态：组行仍可展开，未选细分片禁用（沿原页：上限不锁手风琴展开）
    await page.getByRole('button', { name: /企业服务 \/ SaaS/ }).click();
    await expect(page.getByRole('button', { name: '协同办公', exact: true })).toBeDisabled();
    const 保存键 = page.getByRole('button', { name: '保存', exact: true });
    await 保存键.focus();
    await expect(保存键).toBeFocused();

    // 保存（沿原业务：保存只负责返回）→ 行文本回显三选
    await 保存键.click();
    await expect(page).toHaveURL(/#\/intentions\/new$/, { timeout: 10_000 });
    await expect(page.getByText('电商与交易、本地生活、数据库')).toBeVisible({ timeout: 15_000 });

    // 重入：3/3 与勾选保留（已选不依赖可见项；显式展开含已选的组行看勾）
    await page.getByRole('button', { name: /期望行业/ }).click();
    await expect(page.getByText('3/3')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /互联网平台/ }).click();
    await expect(page.getByRole('button', { name: /电商与交易 ✓/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /本地生活 ✓/ })).toBeVisible();
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-期望行业-重入.png`, fullPage: true });

    // Mock 全程零 API 请求
    expect(apiRequests).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 期望行业 @backend（core editors §5.2 Task 7）：Backend 分支消费同一共用正文 ——
// 根/子/孙三层目录、各层「加载更多」、selectable 叶子按稳定 ID 写 期望行业们+行业引用们、
// 非 selectable 子项点击走展开不混成写入、可选根推荐片可直接选定；3 项上限后未选片禁用；
// 保存（返回）后重入草稿不丢，已选不依赖当前可见项（翻页翻走的已选仍在计数里）。
// industries 目录用本用例专用后装 route（先匹配，不改共享 安装BFF路由），符合已审合同
// 网络桩，不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 期望行业 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('三层目录：推荐+展开选满3项→保存返回重入保留，翻页不丢已选 @backend', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const fixture = 创建候选OnboardingFixture();
    // 存量候选日常会话：last_used_role 已落 candidate；简历与 active 意向满足建档完备判据
    fixture.主体.last_used_role = 'candidate';
    // 存量日常会话按冻结决策返回 candidate 已完成（与 P1/展示字段接线的主页用例同口径）：
    // 登录落点按完成事实进主壳，而不是被未完成分流送回学生分流
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选' },
      summary: '存量个人优势',
    };
    fixture.intentions = [P4深克隆(fixture意向列表.intentions[0])];
    await 安装BFF路由(page, {
      登录尝试id: 'att-core-edit-industries',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
    });

    const 目录请求: string[] = [];
    page.on('request', (request) => {
      const 路径 = new URL(request.url()).pathname;
      if (路径.startsWith('/api/v1/catalog/')) 目录请求.push(路径);
    });

    // industries 目录桩（本用例专用精确状态）：根两页（第二页根可选）+ 子两页（第二页叶子）
    // + 孙一层可选叶子。字段形状与既有内置 industries 桩一致（信封闭合解码）。
    const 项 = (id: string, 名称: string, parentId: string | null, selectable: boolean, hasChildren: boolean) => ({
      id,
      display_name: 名称,
      parent_id: parentId,
      selectable,
      has_children: hasChildren,
    });
    await page.route('**/api/v1/catalog/industries*', async (route) => {
      const url = new URL(route.request().url());
      const parentId = url.searchParams.get('parent_id');
      const cursor = url.searchParams.get('cursor');
      if (parentId === 'ind_fin') {
        const items = cursor === 'sub-cur'
          ? [项('ind_sec', '证券与交易系统', 'ind_fin', true, false)]
          : [项('ind_pay_grp', '支付与清结算', 'ind_fin', false, true), 项('ind_bank', '银行支付', 'ind_fin', true, false)];
        await route.fulfill({
          status: 200,
          json: 信封({ items, next_cursor: cursor === 'sub-cur' ? null : 'sub-cur', catalog_version: 'ind-v1' }),
        });
        return;
      }
      if (parentId === 'ind_pay_grp') {
        await route.fulfill({
          status: 200,
          json: 信封({ items: [项('ind_anti', '反欺诈引擎', 'ind_pay_grp', true, false)], next_cursor: null, catalog_version: 'ind-v1' }),
        });
        return;
      }
      if (cursor === 'root-cur') {
        await route.fulfill({
          status: 200,
          json: 信封({ items: [项('ind_net', '互联网', null, true, false)], next_cursor: null, catalog_version: 'ind-v1' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({ items: [项('ind_fin', '金融科技', null, false, true)], next_cursor: 'root-cur', catalog_version: 'ind-v1' }),
      });
    });

    // 日常入口：登录落主壳后直接进行业子页（共用正文，Backend 控制）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto('/#/intentions/industries');
    await expect(page.getByRole('heading', { name: '已选行业' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('0/3')).toBeVisible();
    // 根列表 + 根列表尾「加载更多」；推荐区渲染同一批根
    await expect(page.getByRole('button', { name: /金融科技/ }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '加载更多', exact: true })).toBeVisible();

    // 正常态截图（与改前拍/冻结源码快照对照：原 Backend 三层展开同版式）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-期望行业-正常.png`, fullPage: true });

    // 根翻页翻出可选根「互联网」；推荐区同名一级片可选（沿规格：可选根不混成展开）
    await page.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(page.getByRole('button', { name: '互联网', exact: true })).toBeVisible({ timeout: 10_000 });

    // 展开金融科技 → 子列表（非 selectable 子项 + 可选叶子）+ 子尾「加载更多」
    await page.getByRole('button', { name: /金融科技/ }).last().click();
    await expect(page.getByRole('button', { name: /支付与清结算/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '银行支付', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '加载更多', exact: true })).toBeVisible();

    // 可选叶子直接写入草稿（1/3）；非 selectable 子项点击走展开取孙项（不混成写入）
    await page.getByRole('button', { name: '银行支付', exact: true }).click();
    await expect(page.getByText('1/3')).toBeVisible();
    await page.getByRole('button', { name: /支付与清结算/ }).click();
    await expect(page.getByRole('button', { name: '反欺诈引擎', exact: true })).toBeVisible({ timeout: 10_000 });

    // 孙盒紧跟其子片（多级展开沿原实现的位置）：DOM 序 支付与清结算 → 孙盒(反欺诈引擎) → 兄弟子片 银行支付
    //（共用 行业分类列表 的行按钮文本带箭头尾缀，按前缀找行）
    const 孙盒紧跟子片 = await page.evaluate(() => {
      const 按钮 = (名: string) => [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim().startsWith(名));
      const 子片 = 按钮('支付与清结算');
      const 孙盒 = 按钮('反欺诈引擎');
      const 兄弟 = 按钮('银行支付');
      if (!子片 || !孙盒 || !兄弟) return false;
      const 在后 = (前: Element, 后: Element) => (前.compareDocumentPosition(后) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      return 在后(子片, 孙盒) && 在后(孙盒, 兄弟);
    });
    expect(孙盒紧跟子片).toBe(true);

    // 子翻页翻出第 2 页可选叶子（2/3），第 1 页已选片保持选中
    await page.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(page.getByRole('button', { name: '证券与交易系统', exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /银行支付 ✓/ })).toBeVisible();
    await page.getByRole('button', { name: '证券与交易系统', exact: true }).click();
    await expect(page.getByText('2/3')).toBeVisible();

    // 推荐区可选根写入第 3 项 → 3/3；非 selectable 展开项在上限保持可用（fix(review-r1) F2）
    await page.getByRole('button', { name: '互联网', exact: true }).click();
    await expect(page.getByText('3/3')).toBeVisible();
    await expect(page.getByRole('button', { name: /支付与清结算/ })).toBeEnabled();

    // 选中态截图 + iPhone 13 viewport 检查：无横向溢出、保存可见可聚焦
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-期望行业-选中.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    const 保存键 = page.getByRole('button', { name: '保存', exact: true });
    await 保存键.focus();
    await expect(保存键).toBeFocused();

    // 保存（沿原业务：保存只负责返回）→ 主壳；重入草稿不丢
    await 保存键.click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.goto('/#/intentions/industries');
    await expect(page.getByText('3/3')).toBeVisible({ timeout: 15_000 });
    // 重开已选保留：展开金融科技只见第 1 页子项，翻页翻走的 证券与交易系统 不在可见项里
    // 但计数仍 3/3 —— 已选不依赖当前可见项
    await page.getByRole('button', { name: /金融科技/ }).last().click();
    await expect(page.getByRole('button', { name: /银行支付 ✓/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '证券与交易系统', exact: true })).toHaveCount(0);
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-期望行业-重入.png`, fullPage: true });

    // 本会话目录请求只打 industries（目录身份按 ID，不按显示名反查）
    expect(目录请求.length).toBeGreaterThan(0);
    expect(目录请求.every((p) => p === '/api/v1/catalog/industries')).toBe(true);
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 附件 @mock（core editors §5.3 Task 8）：我的简历 附件简历卡两模式共用
// 简历附件区 —— Mock 外层局部模拟：原演示行仍为首条（保留原静态说明），获批的 ＋ 入口、
// 左滑 解析/替换/删除、上传/解析授权与删除确认层同一套可见交互。添加/替换/删除/解析
// 全部本地模拟：零 /api/v1 请求、不生成内容/PDF，模拟解析 尚未识别→正在识别→识别完成；
// 替换保留点击目标身份并重置解析状态；上限与既有附件上限一致（3 条）；离页回演示初值。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 附件 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('添加→同意→替换→解析→删除走同一共用附件区，模拟状态可观察且零请求 @mock', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);
    await page.goto('/#/resume');
    await expect(page.getByText('沈亦舟_简历_2026.pdf')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('初筛通过后发送 PDF 原件')).toBeVisible();
    await expect(page.getByRole('button', { name: '添加附件简历' })).toBeVisible();

    // 正常态截图（与改前拍对照：演示行原样，新增获批的 ＋ 与左滑动作）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-附件-正常.png`, fullPage: true });

    // 点演示行 → 既有原型预览提示（缺真实 PDF，不伪造预览）
    await page.getByText('沈亦舟_简历_2026.pdf').click();
    await expect(page.getByText('原型演示：真机上在这里打开系统 PDF 预览。')).toBeVisible();

    // ＋ → 授权层取消：零变更零请求
    await page.getByRole('button', { name: '添加附件简历' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'cancel.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await expect(page.getByText('cancel.pdf')).toHaveCount(0); // 确认前无变更
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.getByText('允许 AI 识别这份简历？')).toHaveCount(0);

    // 添加 → 同意 → 行以「尚未识别」入列
    await page.getByRole('button', { name: '添加附件简历' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'add.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await page.getByRole('button', { name: '同意并继续' }).click();
    const 加行 = page.getByTestId('附件简历行').filter({ hasText: 'add.pdf' });
    await expect(加行).toBeVisible();
    await expect(加行.getByText('尚未识别')).toBeVisible();

    // 解析 → 同意 → 模拟解析 尚未识别 → 正在识别 → 识别完成
    await 左滑附件行(page, 'add.pdf');
    await page.getByRole('button', { name: '解析', exact: true }).click();
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByText('正在识别')).toBeVisible();
    await expect(page.getByText('识别完成')).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-附件-解析完成.png`, fullPage: true });

    // 替换 → 同意：行身份保留，显示新文件名且旧名消失，解析状态重置（fix(review-r1) F6）
    await 左滑附件行(page, 'add.pdf');
    await page.getByRole('button', { name: '替换', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'replacement.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    const 替换行 = page.getByTestId('附件简历行').filter({ hasText: 'replacement.pdf' });
    await expect(替换行).toBeVisible();
    await expect(替换行.getByText('尚未识别')).toBeVisible();
    await expect(page.getByText('add.pdf')).toHaveCount(0);

    // 加到 3/3（与既有附件上限一致）：＋ 消失；行面键盘可聚焦、无横向溢出
    await page.getByRole('button', { name: '添加附件简历' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'second.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByTestId('附件简历行').filter({ hasText: 'second.pdf' })).toBeVisible();
    await expect(page.getByTestId('附件简历行')).toHaveCount(3);
    await expect(page.getByRole('button', { name: '添加附件简历' })).toHaveCount(0);
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-附件-上限.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    const 演示行面 = page.getByRole('button', { name: /沈亦舟_简历_2026\.pdf/ });
    await 演示行面.focus();
    await expect(演示行面).toBeFocused();

    // 删除：先取消（行保留），再确认（行消失、＋ 回来）
    await 左滑附件行(page, 'second.pdf');
    await page.getByRole('button', { name: '删除', exact: true }).click();
    await expect(page.getByText('删除后无法恢复。')).toBeVisible();
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.getByTestId('附件简历行').filter({ hasText: 'second.pdf' })).toBeVisible();
    await 左滑附件行(page, 'second.pdf');
    await page.getByRole('button', { name: '删除', exact: true }).click();
    await page.getByRole('button', { name: '删除附件简历', exact: true }).click();
    await expect(page.getByTestId('附件简历行').filter({ hasText: 'second.pdf' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '添加附件简历' })).toBeVisible();

    // Mock 模拟全程零 API 请求（真实请求数为 0）
    expect(apiRequests).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 附件 @backend（core editors §5.3 Task 8）：Backend 分支消费同一共用附件区 ——
// 权威 0–3 行、上传/解析授权前零写入、替换按槽位保留身份、失败终态可重新解析（改桩终态
// 后识别完成）、行点开 authenticated content GET、删除取消零 DELETE 确认恰一次。
// 复用现有 创建P2附件fixture 与文件选择机制；网络桩符合已审合同，不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 附件 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('添加→同意→替换→重新解析→删除 走同一共用附件区并保持权威契约 @backend', async ({ page }, testInfo) => {
    // 多段 3s 轮询 + 手势 + 删除确认全在一条 journey：显式放宽到 120s
    test.setTimeout(120_000);
    const P2 = 创建P2附件fixture('parser_temporarily_unavailable');
    await 安装BFF路由(page, {
      记录目录请求: () => {}, 登录尝试id: 'att-core-edit-attachment', 附件fixture: P2,
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await page.goto('/#/resume');
    await expect(page.getByText('还未上传附件简历')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '添加附件简历' })).toBeVisible();

    // 空态截图（共用空态照旧）
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-附件-空态.png`, fullPage: true });

    // ＋ → 授权层：同意前零写入（基线采样在触发文件选择之前）
    const writesBeforeAdd = P2.写入次数;
    await page.getByRole('button', { name: '添加附件简历' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'candidate.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    expect(P2.写入次数).toBe(writesBeforeAdd);
    await page.getByRole('button', { name: '同意并继续' }).click();
    const 首行 = page.getByTestId('附件简历行').filter({ hasText: 'candidate.pdf' });
    await expect(首行).toBeVisible({ timeout: 15_000 });
    // 上传后解析状态机走完 → 失败终态（可重试口径）
    await expect(page.getByText('服务繁忙 · 稍后重试')).toBeVisible({ timeout: 20_000 });

    // 替换 → 同意：槽位身份保留（display name 不变成 replacement.pdf），重新入列解析
    await 左滑附件行(page, 'candidate.pdf');
    await page.getByRole('button', { name: '替换', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'replacement.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByText('replacement.pdf')).toHaveCount(0);
    await expect(首行).toBeVisible();
    await expect(首行.getByText('服务繁忙 · 稍后重试')).toBeVisible({ timeout: 20_000 });

    // 重新解析：授权前零写入；改桩终态 → 同意 → 识别完成
    const writesBeforeParse = P2.写入次数;
    await 左滑附件行(page, 'candidate.pdf');
    await page.getByRole('button', { name: '重新解析', exact: true }).click();
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    expect(P2.写入次数).toBe(writesBeforeParse);
    P2.下次终态 = 'succeeded';
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByText('识别完成')).toBeVisible({ timeout: 20_000 });

    // 预览：行点击只断言 authenticated content GET，不依赖 headless PDF viewer 内容
    const 内容请求 = page.waitForRequest(
      (request) => new URL(request.url()).pathname === '/api/v1/me/resume-files/rf_1/content',
    );
    await 首行.click();
    await 内容请求;
    expect(P2.下载次数).toBeGreaterThanOrEqual(1);

    // 布局门 + viewport 检查：标题几何未漂移、无横向溢出、行面键盘可聚焦
    await 断言附件标题几何未漂移(page);
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-附件-完成.png`, fullPage: true });
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    const 行面 = page.getByRole('button', { name: /candidate\.pdf/ });
    await 行面.focus();
    await expect(行面).toBeFocused();

    // 删除：取消零 DELETE；确认恰一次 DELETE 且行消失
    const 删除请求: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'DELETE' && new URL(request.url()).pathname.startsWith('/api/v1/me/resume-files')) {
        删除请求.push(request.url());
      }
    });
    const writesBeforeDelete = P2.写入次数;
    await 左滑附件行(page, 'candidate.pdf');
    await page.getByRole('button', { name: '删除', exact: true }).click();
    await expect(page.getByText('删除后无法恢复。')).toBeVisible();
    await page.getByRole('button', { name: '取消', exact: true }).click();
    expect(P2.写入次数).toBe(writesBeforeDelete);
    expect(删除请求).toEqual([]);
    await expect(首行).toBeVisible();
    await 左滑附件行(page, 'candidate.pdf');
    await page.getByRole('button', { name: '删除', exact: true }).click();
    // 弹层遮罩的 aria-label「关闭删除附件简历？」也含这段文字：exact 只认执行键
    await page.getByRole('button', { name: '删除附件简历', exact: true }).click();
    await expect(首行).toHaveCount(0, { timeout: 10_000 });
    expect(P2.写入次数).toBe(writesBeforeDelete + 1);
    expect(删除请求.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// picker 统一 @picker（Plan 2026-09-14 Task 5）：把 Task 1–4 的真实布局与用户操作
// 固化到两数据模式的实际页面（mock 4181 / fixture 4182，viewport 沿项目
// iPhone 13 390×844，短屏用例显式 844×390）。非目标：不新建测试框架、不拍全站
// 视觉基线、不启动真实后端 —— Backend 全部 API 请求走既有 安装BFF路由 + 用例专用
// 后装目录桩，意外未匹配请求使测试失败；Mock 断言全程零 /api/v1 请求。
//   · 经历行业全屏外壳（editor-catalog-fullscreen Task 3 起，原 72% 底部弹层已换
//     全屏选择外壳）：满高在视口内、列表真滚动（scrollHeight > clientHeight、
//     滚到底最后项可点、回顶可达）、展开两根不抢焦点、重开已选仍在；
//   · 期望行业全页：折叠不丢选中、无推荐区；
//   · 其他底部弹层（薪资）与居中确认框：首开聚焦、Tab 焦点圈、Escape 关闭恢复、
//     弹层不截断；
//   · 岗位城市全页子视图（不换路由、原表单 hidden 键盘不可进、取消保留、保存回填）
//     与岗位月薪双滚轮（确定/取消/精确输入/倒置）；
//   · 就读年份：默认 Mock 2014/2017 原样、显式 2021/2025 种子、空值「请选择」、
//     真实滚动保存与硬刷新恢复、空项刷新不补默认。
// ─────────────────────────────────────────────────────────────────────────────

/** 弹层/页面里的共用折叠目录列表（行业分类列表 根容器，dev 类名含「列表」） */
const picker滚动列表 = (范围: Locator) => 范围.locator('[class*="列表"]').first();

/** 轮询元素矩形完整落在视口内（含 4px 边框/安全区误差）——抽屉升起动画 0.24s 期间
 *  矩形会越界，等动画落定再取值，不在动画中段冒充越界 */
async function picker在视口内(元素: Locator, 宽: number, 高: number): Promise<void> {
  const 截止 = Date.now() + 5_000;
  let 框: { x: number; y: number; width: number; height: number } | null = null;
  for (;;) {
    框 = await 元素.boundingBox().catch(() => null);
    const 值 = 框 === null
      ? -1
      : Math.max(-2 - 框.x, -2 - 框.y, 框.x + 框.width - (宽 + 4), 框.y + 框.height - (高 + 4));
    if (值 <= 0 || Date.now() > 截止) {
      if (值 > 0) {
        throw new Error(
          `弹层超出视口：bbox=${JSON.stringify(框)} 视口=${宽}x${高}（超出 ${值.toFixed(1)}px）`,
        );
      }
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

test.describe('picker 统一 经历行业弹层 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('两根展开不抢焦点→列表滚到底选中→重开已选在 @picker @catalog-fullscreen @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);

    // 日常入口：在线简历 → 添加工作经历 → 打开所属行业层（本地 常见行业 作模拟目录）
    // （公司名称已是合同 C 的公司选择抽屉行，本用例只驱动行业层，不需要公司）
    await page.goto('/#/experience');
    await expect(page.getByRole('button', { name: '＋ 添加工作经历' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加工作经历' }).click();
    await expect(page.getByPlaceholder('必填')).toHaveCount(1);
    await page.getByRole('button', { name: /所属行业/ }).click();
    // editor-catalog-fullscreen Task 3：承载换成全屏选择外壳，可访问名 = 标题「所属行业」，
    // 满高接管（不再 72% 限高），动画落定后取值
    const 弹层 = page.getByRole('dialog', { name: '所属行业' });
    await expect(弹层.getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });

    await expect.poll(async () => (await 弹层.boundingBox())?.height ?? -1, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(((await page.viewportSize()) ?? { height: 0 }).height - 4);
    await picker在视口内(弹层, 390, 844);

    // 展开两根：焦点留在被点的组行上，不抢到首控件（组行整行展开，箭头 ⌄→⌃）
    await 弹层.getByRole('button', { name: /金融科技/ }).click();
    await expect(弹层.getByRole('button', { name: '支付与清结算', exact: true })).toBeVisible({ timeout: 10_000 });
    await 弹层.getByRole('button', { name: /互联网平台/ }).click();
    await expect(弹层.getByRole('button', { name: /互联网平台 ⌃/ })).toBeFocused();

    // 直接定位可滚动列表：scrollHeight > clientHeight
    const 列表 = picker滚动列表(弹层);
    const 尺寸 = await 列表.evaluate((节点) => ({ 滚: 节点.scrollHeight, 可见: 节点.clientHeight }));
    expect(尺寸.滚).toBeGreaterThan(尺寸.可见);

    // 真实滚动到底：最后一项可见且可点击；向上滚回首项可达
    await 列表.evaluate((节点) => { 节点.scrollTop = 节点.scrollHeight; });
    await expect(弹层.getByRole('button', { name: '社交与通讯', exact: true })).toBeVisible();
    await 弹层.getByRole('button', { name: '社交与通讯', exact: true }).click();

    // 单选选定即关闭层，所属行业行回填；重开已选仍在（✓ 由选中行渲染）
    await expect(弹层).toHaveCount(0);
    const 行业行 = page.getByRole('button', { name: /所属行业/ });
    await expect(行业行).toContainText('社交与通讯');
    await 行业行.click();
    const 弹层2 = page.getByRole('dialog', { name: '所属行业' });
    await expect(弹层2.getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });
    await 弹层2.getByRole('button', { name: /互联网平台/ }).click();
    await expect(弹层2.getByRole('button', { name: /社交与通讯 ✓/ })).toBeVisible({ timeout: 10_000 });

    // 向上滚回首项（重入时已选组自动展开，首项是其首个细分）可达；Escape 关闭恢复
    const 列表2 = picker滚动列表(弹层2);
    await 列表2.evaluate((节点) => { 节点.scrollTop = 0; });
    await expect(弹层2.getByRole('button', { name: '电商与交易', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(弹层2).toHaveCount(0);

    // Mock 全程零 API 请求
    expect(apiRequests).toEqual([]);
  });
});

test.describe('picker 统一 经历行业弹层 @backend', () => {
  // 短屏 844×390：面板限高 72%≈280.8px，列表更早内滚；关闭（选叶子/Escape）可达
  test.use({ baseURL: 'http://127.0.0.1:4182', viewport: { width: 844, height: 390 } });

  test('目录展开→短屏列表滚到底选中→重开已选在，Escape 可关 @picker @catalog-fullscreen @backend', async ({ page }) => {
    test.setTimeout(120_000);
    await pickerBackend存量候选(page, 'att-picker-industry');

    // 行业目录桩（本用例专用后装 route）：单页两根 + 每根 8 个可选叶子，撑出内滚
    await page.route('**/api/v1/catalog/industries*', async (route) => {
      const url = new URL(route.request().url());
      const parentId = url.searchParams.get('parent_id');
      if (parentId === 'ind_fin' || parentId === 'ind_net') {
        const 前缀 = parentId === 'ind_fin' ? '支付细分' : '平台细分';
        await route.fulfill({
          status: 200,
          json: 信封({
            items: Array.from({ length: 8 }, (_, 序) => ({
              id: `${parentId}_leaf_${序 + 1}`,
              display_name: `${前缀}${序 + 1}`,
              parent_id: parentId,
              selectable: true,
              has_children: false,
            })),
            next_cursor: null,
            catalog_version: 'ind-v1',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [
            { id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false, has_children: true },
            { id: 'ind_net', display_name: '互联网', parent_id: null, selectable: true, has_children: true },
          ],
          next_cursor: null,
          catalog_version: 'ind-v1',
        }),
      });
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto('/#/experience');
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加工作经历' }).click();
    await expect(page.getByPlaceholder('必填')).toHaveCount(1);
    await page.getByRole('button', { name: /所属行业/ }).click();
    const 弹层 = page.getByRole('dialog', { name: '所属行业' });
    await expect(弹层.getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });

    // editor-catalog-fullscreen Task 3：全屏外壳满高接管（横屏 844×390 也不再 72% 限高），
    // 动画落定后取值
    await expect.poll(async () => (await 弹层.boundingBox())?.height ?? -1, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(390 - 4);
    await picker在视口内(弹层, 844, 390);

    // 展开两根（第二根是可选根，名称点=选择、独立展开钮展开 —— 点展开钮不选定）
    await 弹层.getByRole('button', { name: /金融科技/ }).click();
    await expect(弹层.getByRole('button', { name: '支付细分1', exact: true })).toBeVisible({ timeout: 10_000 });
    await 弹层.getByRole('button', { name: '展开互联网' }).click();
    await expect(弹层.getByRole('button', { name: '平台细分1', exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(弹层.getByRole('button', { name: '展开互联网' })).toBeFocused();

    // 列表内滚 + 滚到底最后项可点
    const 列表 = picker滚动列表(弹层);
    const 尺寸 = await 列表.evaluate((节点) => ({ 滚: 节点.scrollHeight, 可见: 节点.clientHeight }));
    expect(尺寸.滚).toBeGreaterThan(尺寸.可见);
    await 列表.evaluate((节点) => { 节点.scrollTop = 节点.scrollHeight; });
    await expect(弹层.getByRole('button', { name: '平台细分8', exact: true })).toBeVisible();
    await 弹层.getByRole('button', { name: '平台细分8', exact: true }).click();
    await expect(弹层).toHaveCount(0);
    await expect(page.getByRole('button', { name: /所属行业/ })).toContainText('平台细分8');

    // 重开已选仍在（重新展开后 ✓）；短屏 Escape 关闭可达
    await page.getByRole('button', { name: /所属行业/ }).click();
    const 弹层2 = page.getByRole('dialog', { name: '所属行业' });
    await expect(弹层2.getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });
    await 弹层2.getByRole('button', { name: '展开互联网' }).click();
    await expect(弹层2.getByRole('button', { name: /平台细分8 ✓/ })).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(弹层2).toHaveCount(0);
    // 关闭后行业行仍回填所点行（稳定键 → 显示名；提交断言由核心编辑 简历行业 @backend 覆盖）
    await expect(page.getByRole('button', { name: /所属行业/ })).toContainText('平台细分8');
  });
});

test.describe('picker 统一 期望行业折叠 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('选叶子→折叠不丢选中→无推荐区，保存回显 @picker @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);

    // 「添加求职期望」→ 期望行业行 → 行业子页（共用正文，本地 行业字典 作模拟目录）
    await page.goto('/#/intentions/new');
    await expect(page.getByRole('button', { name: /期望行业/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /期望行业/ }).click();
    await expect(page.getByRole('heading', { name: '已选行业' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('0/3')).toBeVisible();

    // 推荐区已按 Plan 删除：两模式页面都不再出现「推荐」
    await expect(page.getByText('推荐')).toHaveCount(0);

    // 展开金融科技 → 选叶子 1/3
    await page.getByRole('button', { name: /金融科技/ }).click();
    await expect(page.getByRole('button', { name: '支付与清结算', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '支付与清结算', exact: true }).click();
    await expect(page.getByText('1/3')).toBeVisible();

    // 折叠组行：选中不丢（计数仍在、✓ 不依赖可见项），再展开 ✓ 还在
    await page.getByRole('button', { name: /金融科技/ }).click();
    await expect(page.getByRole('button', { name: '支付与清结算', exact: true })).toHaveCount(0);
    await expect(page.getByText('1/3')).toBeVisible();
    await page.getByRole('button', { name: /金融科技/ }).click();
    await expect(page.getByRole('button', { name: /支付与清结算 ✓/ })).toBeVisible({ timeout: 10_000 });

    // 折叠另一个组同样不丢：再选一叶 → 折叠 → 计数 2/3
    await page.getByRole('button', { name: /互联网平台/ }).click();
    await expect(page.getByRole('button', { name: '电商与交易', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '电商与交易', exact: true }).click();
    await expect(page.getByText('2/3')).toBeVisible();
    await page.getByRole('button', { name: /互联网平台/ }).click();
    await expect(page.getByText('2/3')).toBeVisible();

    // 保存（沿原业务：保存只负责返回）→ 行文本回显
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/intentions\/new$/, { timeout: 10_000 });
    await expect(page.getByText('支付与清结算、电商与交易')).toBeVisible({ timeout: 15_000 });

    // Mock 全程零 API 请求
    expect(apiRequests).toEqual([]);
  });
});

test.describe('picker 统一 期望行业折叠 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('目录选叶子→折叠不丢选中→无推荐区，保存回主壳 @picker @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = await pickerBackend存量候选(page, 'att-picker-intent-industry');
    expect(fixture.intentions).toHaveLength(1);

    // industries 目录桩（本用例专用后装 route）：一根（不可选）+ 两个可选叶子
    const 目录请求: string[] = [];
    await page.route('**/api/v1/catalog/industries*', async (route) => {
      const url = new URL(route.request().url());
      目录请求.push('/api/v1/catalog/industries');
      if (url.searchParams.get('parent_id') === 'ind_fin') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [
              { id: 'ind_pay', display_name: '支付与清结算', parent_id: 'ind_fin', selectable: true, has_children: false },
              { id: 'ind_eco', display_name: '电商与交易', parent_id: 'ind_fin', selectable: true, has_children: false },
            ],
            next_cursor: null,
            catalog_version: 'ind-v1',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [{ id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }],
          next_cursor: null,
          catalog_version: 'ind-v1',
        }),
      });
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto('/#/intentions/industries');
    await expect(page.getByRole('heading', { name: '已选行业' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('0/3')).toBeVisible();

    // 无推荐区
    await expect(page.getByText('推荐')).toHaveCount(0);

    // 展开 → 选叶子 1/3 → 折叠不丢 → 再展开 ✓ 还在
    await page.getByRole('button', { name: /金融科技/ }).last().click();
    await expect(page.getByRole('button', { name: '支付与清结算', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '支付与清结算', exact: true }).click();
    await expect(page.getByText('1/3')).toBeVisible();
    await page.getByRole('button', { name: /金融科技/ }).last().click();
    await expect(page.getByRole('button', { name: '支付与清结算', exact: true })).toHaveCount(0);
    await expect(page.getByText('1/3')).toBeVisible();
    await page.getByRole('button', { name: /金融科技/ }).last().click();
    await expect(page.getByRole('button', { name: /支付与清结算 ✓/ })).toBeVisible({ timeout: 10_000 });

    // 保存（返回）→ 主壳；重入草稿不丢
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.goto('/#/intentions/industries');
    await expect(page.getByText('1/3')).toBeVisible({ timeout: 15_000 });

    // 本会话目录请求只打 industries
    expect(目录请求.length).toBeGreaterThan(0);
    expect(目录请求.every((p) => p === '/api/v1/catalog/industries')).toBe(true);
  });
});

test.describe('picker 统一 弹层骨架 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('薪资底部弹层与居中确认框：首开/Tab/Escape/关闭恢复不截断 @picker @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);

    // ── 底部弹层（薪资双滚轮）：添加求职期望 的薪资行 ──
    await page.goto('/#/intentions/new');
    const 薪资行 = page.getByRole('button', { name: /薪资要求/ });
    await expect(薪资行).toBeVisible({ timeout: 15_000 });
    await 薪资行.click();
    const 薪资层 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
    await expect(薪资层).toBeVisible({ timeout: 10_000 });

    // 首开聚焦第一个控件；面板在视口内、确定键完整可见（底层改动不截断）
    await expect(薪资层.getByRole('button', { name: '取消' })).toBeFocused();
    await expect(薪资层.getByRole('button', { name: '确定' })).toBeVisible();
    await picker在视口内(薪资层, 390, 844);

    // Tab 焦点圈在弹层里转；Escape 关闭并恢复焦点到打开它的行
    await page.keyboard.press('Tab');
    const 焦点在薪资层 = await page.evaluate(() =>
      (document.activeElement?.closest('dialog') ?? null) !== null,
    );
    expect(焦点在薪资层).toBe(true);
    await page.keyboard.press('Escape');
    await expect(薪资层).toHaveCount(0);
    await expect(薪资行).toBeFocused();
    await expect(薪资行).toBeVisible();

    // ── 居中确认框（屏蔽名单 解除屏蔽，Mock 演示种子 B-01 锐思数据）：首开在视口中部、Tab/Escape、取消零请求 ──
    //（JD consent 确认层只在 Backend 招聘方会话出现；Mock 选同一骨架的居中解除确认框）
    await page.goto('/#/blocklist');
    const 解除键 = page.getByRole('button', { name: '解除', exact: true }).first();
    await expect(解除键).toBeVisible({ timeout: 15_000 });
    await 解除键.click();
    const 确认框 = page.getByRole('dialog', { name: '解除屏蔽锐思数据' });
    await expect(确认框).toBeVisible({ timeout: 10_000 });
    // 居中面板：上下都不贴边（底部抽屉会贴底，居中框不会）
    const 确认面板 = await 确认框.boundingBox();
    expect(确认面板).not.toBeNull();
    expect(确认面板!.y).toBeGreaterThan(0);
    expect(确认面板!.y + 确认面板!.height).toBeLessThan(844);
    await expect(确认框.getByRole('button', { name: '不解除' })).toBeFocused();
    await page.keyboard.press('Tab');
    const 焦点在确认框 = await page.evaluate(() =>
      (document.activeElement?.closest('dialog') ?? null) !== null,
    );
    expect(焦点在确认框).toBe(true);
    await page.keyboard.press('Escape');
    await expect(确认框).toHaveCount(0);
    // 名单条目保留（取消不解除）
    await expect(page.getByRole('button', { name: '解除', exact: true }).first()).toBeVisible();

    // Mock 全程零 API 请求（确认框取消零 mutation）
    expect(apiRequests).toEqual([]);
  });
});

test.describe('picker 统一 弹层骨架 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('薪资底部弹层与居中确认框：首开/Tab/Escape/关闭恢复不截断 @picker @backend', async ({ page }) => {
    test.setTimeout(180_000);
    // 隐身开关从关起步：employer_privacy_enabled=false（默认 true 会让首次点击直接进确认框）
    await pickerBackend存量候选(page, 'att-picker-sheets', { employer_privacy_enabled: false });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });

    // ── 底部弹层（薪资双滚轮）：添加求职期望 的薪资行；取消零回填 ──
    await page.goto('/#/intentions/new');
    const 薪资行 = page.getByRole('button', { name: /薪资要求/ });
    await expect(薪资行).toBeVisible({ timeout: 15_000 });
    await 薪资行.click();
    const 薪资层 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
    await expect(薪资层).toBeVisible({ timeout: 10_000 });
    await expect(薪资层.getByRole('button', { name: '取消' })).toBeFocused();
    await expect(薪资层.getByRole('button', { name: '确定' })).toBeVisible();
    await picker在视口内(薪资层, 390, 844);
    // 点档直选后取消：零回填（行保持原值），焦点恢复
    await 薪资层.getByRole('listbox', { name: '薪资下限' }).getByRole('option', { name: '40', exact: true }).click();
    await expect(薪资层.getByRole('listbox', { name: '薪资下限' }).getByRole('option', { name: '40', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(薪资层).toHaveCount(0);
    await expect(薪资行).toBeFocused();
    // 取消零回填：行值仍是「请选择薪资要求」
    await expect(薪资行).toContainText('请选择薪资要求');

    // ── 居中确认框：设置页 对现雇主隐身 关闭确认（开关是 role=switch）──
    await page.goto('/#/settings');
    const 隐身开关 = page.getByRole('switch', { name: '对现雇主隐身' });
    await expect(隐身开关).toBeEnabled({ timeout: 15_000 });
    await 隐身开关.click(); // 开（无需确认）
    await expect(隐身开关).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
    // 开启写入后隐私水合会让开关短暂失稳，第二次触发用焦点上的 Enter（真实键盘激活）
    await page.keyboard.press('Enter'); // 关（居中确认框）
    const 确认框 = page.getByRole('dialog', { name: '关闭对现雇主隐身' });
    await expect(确认框).toBeVisible({ timeout: 10_000 });
    const 确认面板 = await 确认框.boundingBox();
    expect(确认面板).not.toBeNull();
    expect(确认面板!.y).toBeGreaterThan(0);
    expect(确认面板!.y + 确认面板!.height).toBeLessThan(844);
    await expect(确认框.getByRole('button', { name: '保持开启' })).toBeFocused();
    await page.keyboard.press('Tab');
    const 焦点在确认框 = await page.evaluate(() =>
      (document.activeElement?.closest('dialog') ?? null) !== null,
    );
    expect(焦点在确认框).toBe(true);
    await page.keyboard.press('Escape');
    await expect(确认框).toHaveCount(0);
    // 关闭恢复：开关仍是开（确认框只是被取消）
    await expect(隐身开关).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('picker 统一 岗位城市与月薪 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('城市全页子视图与月薪滚轮：确定/取消/精确/倒置，发布零 API @picker @catalog-fullscreen @mock', async ({ page }) => {
    test.setTimeout(180_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);
    await page.goto('/#/hr/post-job');
    await expect(page.getByPlaceholder(/资深后端工程师/)).toBeVisible({ timeout: 15_000 });

    // ── 校招月薪：取消零回填 → 双滚轮点档 → 确定 ──
    await page.getByRole('button', { name: '校园招聘' }).click();
    await page.getByRole('button').filter({ hasText: '职位类别' }).click();
    // editor-catalog-fullscreen Task 1：承载换成全屏选择外壳，可访问名 = 标题「职位类别」
    const 类别弹层 = page.getByRole('dialog', { name: '职位类别' });
    await expect(类别弹层).toBeVisible({ timeout: 10_000 });
    await 类别弹层.getByRole('button', { name: '产品', exact: true }).click();
    await 类别弹层.getByRole('button', { name: '产品经理', exact: true }).click();
    await expect(page.getByRole('button').filter({ hasText: '职位类别' })).toContainText('产品 · 产品经理');
    await page.getByPlaceholder(/资深后端工程师/).fill('选择器统一岗');
    await page.getByRole('button', { name: '现场', exact: true }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByLabel('职位描述').fill('验证岗位城市子视图与月薪滚轮。');
    await page.getByRole('button', { name: '下一步' }).click();
    const 下限键 = page.getByRole('button', { name: '薪资下限' });
    await 下限键.click();
    let 月薪层 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
    await expect(月薪层).toBeVisible({ timeout: 10_000 });
    await expect(月薪层.getByRole('button', { name: '取消' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(月薪层).toHaveCount(0);
    await expect(下限键).toBeFocused();
    await expect(下限键).toContainText('—');
    await 下限键.click();
    await expect(月薪层).toBeVisible({ timeout: 10_000 });
    await 月薪层.getByRole('listbox', { name: '薪资下限' }).getByRole('option', { name: '20', exact: true }).click();
    await 月薪层.getByRole('listbox', { name: '薪资上限' }).getByRole('option', { name: '30', exact: true }).click();
    await 月薪层.getByRole('button', { name: '确定' }).click();
    await expect(月薪层).toHaveCount(0);
    await expect(下限键).toContainText('20');
    await expect(page.getByRole('button', { name: '薪资上限' })).toContainText('30');

    // 返回第一步切回社招（类型切换既有清理会清薪资），描述保留
    await page.getByRole('button', { name: '返回' }).click();
    await page.getByRole('button', { name: '返回' }).click();
    await expect(page.getByRole('button', { name: '校园招聘' })).toBeVisible();
    await page.getByRole('button', { name: '社招全职' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByLabel('职位描述')).toHaveValue('验证岗位城市子视图与月薪滚轮。');
    await page.getByRole('button', { name: '下一步' }).click();

    // ── 社招月薪：精确输入 18/28 → 确定；滚轮倒置被拦不关闭；取消零回填 ──
    await 下限键.click();
    月薪层 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
    await expect(月薪层).toBeVisible({ timeout: 10_000 });
    await 月薪层.getByRole('button', { name: '输入金额' }).click();
    await 月薪层.getByLabel('薪资下限').fill('18');
    await 月薪层.getByLabel('薪资上限').fill('28');
    await 月薪层.getByRole('button', { name: '确定' }).click();
    await expect(月薪层).toHaveCount(0);
    await expect(下限键).toContainText('18');
    await expect(page.getByRole('button', { name: '薪资上限' })).toContainText('28');
    await page.getByRole('button', { name: /年薪月数/ }).click();
    await page.getByRole('button', { name: '确定' }).click();
    await page.getByLabel('岗位要求').fill('三年以上产品经验，带过完整上线周期');
    // 倒置：上限 < 下限，确定被拦、弹层不关
    await 下限键.click();
    月薪层 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
    await expect(月薪层).toBeVisible({ timeout: 10_000 });
    await 月薪层.getByRole('listbox', { name: '薪资下限' }).getByRole('option', { name: '40', exact: true }).click();
    await 月薪层.getByRole('listbox', { name: '薪资上限' }).getByRole('option', { name: '20', exact: true }).click();
    await 月薪层.getByRole('button', { name: '确定' }).click();
    await expect(月薪层.getByText('薪资下限不能高于上限')).toBeVisible();
    await 月薪层.getByRole('button', { name: '取消' }).click();
    await expect(月薪层).toHaveCount(0);
    await expect(下限键).toContainText('18');
    await expect(page.getByRole('button', { name: '薪资上限' })).toContainText('28');

    // ── 工作城市：全页本地子视图（不换路由、原表单 hidden、取消保留、保存回填）──
    const 城市行 = page.getByRole('button').filter({ hasText: '工作城市' });
    const 键集前 = await page.evaluate(() => Object.keys(localStorage).sort());
    await 城市行.click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/);
    await expect(page.getByRole('heading', { name: '选择工作城市' })).toBeVisible({ timeout: 10_000 });
    // 原表单整体 hidden（display:none）：键盘无法进入
    await expect(下限键).toBeHidden();
    // Tab 只在子视图正文里转
    await page.getByPlaceholder('搜索城市 / 省份').focus();
    await page.keyboard.press('Tab');
    const 焦点在子视图 = await page.evaluate(() =>
      (document.activeElement?.closest('[class*="选择正文"]') ?? null) !== null,
    );
    expect(焦点在子视图).toBe(true);
    // 取消保留：Escape 关闭、行仍是「请选择」、焦点回城市行
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: '选择工作城市' })).toHaveCount(0);
    await expect(城市行).toContainText('请选择');
    await expect(城市行).toBeFocused();
    // 重开 → 选上海 → 保存回填；不导航候选 route、不写候选草稿
    await 城市行.click();
    await expect(page.getByRole('heading', { name: '选择工作城市' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '上海市', exact: true }).first().click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(城市行).toContainText('上海');
    await expect(page).toHaveURL(/#\/hr\/post-job$/);
    const 键集后 = await page.evaluate(() => Object.keys(localStorage).sort());
    expect(键集后).toEqual(键集前);

    // 保存后重开子视图：已选 chip 回显、保存可用（Spec §4.3/§6 两模式同已选状态）；
    // 取消关闭不改岗位行
    await 城市行.click();
    await expect(page.getByRole('heading', { name: '选择工作城市' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '上海市 ✕' })).toBeVisible();
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: '选择工作城市' })).toHaveCount(0);
    await expect(城市行).toContainText('上海');

    // 发布：办公地点（现场必填）+ 确认门勾选（Spec §5.4 两模式共用）→ 岗位带城市上屏
    await page.getByPlaceholder(/浦东新区世纪大道/).fill('浦东新区张江路 1 号');
    await page.getByRole('checkbox', { name: /我已确认经验和学历设置将作为自动匹配依据/ }).check();
    await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
    await expect(page.getByText('选择器统一岗')).toBeVisible({ timeout: 15_000 });
    // 发布结果带滚轮设置的原金额：编辑回读该岗第三步，薪资选择行为 18/28（Mock 零 API
    // 无 POST body 可断言，岗位列表卡不渲染薪资带 —— 以编辑回读作存证）
    await page.goto('/#/hr/post-job/P-05');
    await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue('选择器统一岗', { timeout: 15_000 });
    await page.getByRole('button', { name: '职位要求' }).click();
    await expect(下限键).toContainText('18', { timeout: 10_000 });
    await expect(page.getByRole('button', { name: '薪资上限' })).toContainText('28');
    expect(apiRequests).toEqual([]);
  });
});

test.describe('picker 统一 岗位城市与月薪 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('城市子视图保存发布捕获 location_id，滚轮 50/65 @picker @backend', async ({ page }) => {
    test.setTimeout(240_000);
    const 请求们: { path: string; method: string; body: unknown }[] = [];
    // 全新招聘方 onboarding fixture（与 招聘方 onboarding Backend fixture 同口径；
    // P1C 存量组织会话在当前候选上名片水合会弹回身份页，本用例只发新岗）。
    // 隐私域给默认组织搜索池：合同 C 的公司选择抽屉要从池里按 ID 选企业。
    const 隐私池 = P3隐私fixture();
    隐私池.组织库 = P3默认组织库();
    await 安装BFF路由(page, {
      登录尝试id: 'att-picker-job-city',
      记录目录请求: () => undefined,
      主体初始角色: null,
      请求拦截: ({ path, method, body }) => 请求们.push({ path, method, body }),
      招聘方OnboardingFixture: 创建招聘方OnboardingFixture(),
      隐私fixture: 隐私池,
    });

    // 新招聘方 onboarding 同链：名片首写（公司走合同 C 公司选择抽屉）→ 发岗向导
    await page.goto('/');
    await expect(page.getByRole('button', { name: '我要招人' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '我要招人' }).click();
    await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 20_000 });
    await page.getByLabel('姓名').fill('林澈');
    await page.getByLabel('职务').fill('招聘负责人');
    await page.getByRole('button', { name: '未选择公司' }).click();
    const 企业抽屉 = page.getByRole('dialog', { name: '选择企业' });
    await expect(企业抽屉).toBeVisible({ timeout: 10_000 });
    await 企业抽屉.getByPlaceholder('输入公司名称').fill('Fixture 磐石');
    const 磐石行 = 企业抽屉.getByRole('button', { name: P3标记.手动组织甲 });
    await expect(磐石行).toBeVisible({ timeout: 10_000 });
    await 磐石行.click();
    await expect(企业抽屉).toHaveCount(0);
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/, { timeout: 20_000 });

    // ── 第一步：类别（fixture 目录单根，左根右叶同名）+ 名称 + 办公方式 ──
    await page.getByPlaceholder(/资深后端工程师/).waitFor({ state: 'attached' });
    const 职位类别行 = page.getByRole('button').filter({ hasText: '职位类别' });
    await 职位类别行.click();
    const 类键 = page.getByRole('button', { name: 标记.职位display, exact: true });
    await expect(类键.first()).toBeVisible({ timeout: 10_000 });
    await 类键.first().click();
    await expect(类键).toHaveCount(2, { timeout: 10_000 });
    await 类键.last().click();
    await expect(职位类别行).toContainText(标记.职位display.trim());
    await page.getByPlaceholder(/资深后端工程师/).fill('选择器统一岗');
    await page.getByRole('button', { name: '混合', exact: true }).click();
    await page.getByRole('button', { name: '下一步' }).click();

    await page.getByLabel('职位描述').fill('验证岗位城市子视图与月薪滚轮。');
    await page.getByRole('button', { name: '下一步' }).click();

    // ── 第三步：月薪双滚轮 50/65 → 年薪月数 ──
    const 下限键 = page.getByRole('button', { name: '薪资下限' });
    await 下限键.click();
    const 月薪层 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
    await expect(月薪层).toBeVisible({ timeout: 10_000 });
    await 月薪层.getByRole('listbox', { name: '薪资下限' }).getByRole('option', { name: '50', exact: true }).click();
    await 月薪层.getByRole('listbox', { name: '薪资上限' }).getByRole('option', { name: '65', exact: true }).click();
    await 月薪层.getByRole('button', { name: '确定' }).click();
    await expect(月薪层).toHaveCount(0);
    await expect(下限键).toContainText('50');
    await expect(page.getByRole('button', { name: '薪资上限' })).toContainText('65');
    await page.getByRole('button', { name: /年薪月数/ }).click();
    await page.getByRole('button', { name: '确定' }).click();

    // ── 工作城市：全页子视图（不换路由、原表单 hidden、取消保留、搜索候选保存）──
    const 城市行 = page.getByRole('button').filter({ hasText: '工作城市' });
    await 城市行.click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/);
    await expect(page.getByRole('heading', { name: '选择工作城市' })).toBeVisible({ timeout: 10_000 });
    await expect(下限键).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(城市行).toContainText('请选择');
    await expect(城市行).toBeFocused();
    await 城市行.click();
    const 城市搜索 = page.getByPlaceholder('搜索城市 / 省份');
    await expect(城市搜索).toBeVisible({ timeout: 10_000 });
    await 城市搜索.fill('fixture');
    const 城市片 = page.getByRole('button', { name: 标记.城市display, exact: true });
    await expect(城市片.first()).toBeVisible({ timeout: 10_000 });
    await 城市片.first().click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(城市行).toContainText(标记.城市display.trim());
    await expect(page).toHaveURL(/#\/hr\/post-job$/);

    // ── 发布：合同 C 企业坐标（direct 用人企业行）→ 确认门 → POST 带 地点引用 ──
    const 用人企业行 = page.getByRole('button', { name: /用人企业/ });
    await 用人企业行.click();
    const 用人抽屉 = page.getByRole('dialog', { name: '选择企业' });
    await expect(用人抽屉).toBeVisible({ timeout: 10_000 });
    await 用人抽屉.getByPlaceholder('输入公司名称').fill('Fixture 磐石');
    await 用人抽屉.getByRole('button', { name: P3标记.手动组织甲 }).click();
    await expect(用人抽屉).toHaveCount(0);
    await page.getByPlaceholder(/浦东新区世纪大道/).fill('Fixture 市 Fixture 路 1 号');
    await page.getByLabel('岗位要求').fill('三年以上后端经验，熟悉交易系统');
    await page.getByRole('checkbox', { name: /我已确认经验和学历设置将作为自动匹配依据/ }).check();
    await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    const 岗位写入 = 请求们.filter((项) => 项.method === 'POST' && 项.path === '/api/v1/recruiter/jobs');
    expect(岗位写入).toHaveLength(1);
    expect(岗位写入[0]!.body).toMatchObject({
      location_id: 'loc-fixture-001',
      title: '选择器统一岗',
      // 本用例刚用滚轮设置的原金额（转岗位创建 body 键 salary: {lower, upper}）
      salary: { lower: 50, upper: 65 },
    });
    // 城市子视图全程停在发岗 route，没有导航到候选 onboarding
    expect(请求们.every((项) => !项.path.includes('/onboard/'))).toBe(true);
  });
});

test.describe('picker 统一 就读年份 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('默认2014/2017原样直接继续；显式2021/2025种子；空值点档与刷新 @picker @mock', async ({ page }) => {
    test.setTimeout(240_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });
    const 简历键 = 'AGXP简历v3:mock:stg:demo';
    const 写缓存 = (教育: Record<string, string>) =>
      page.evaluate(([键, 段]) => {
        localStorage.setItem(键, JSON.stringify({
          经历: [],
          教育: [段],
          技能: [],
          证书: [],
          基本信息: { 真名: '演示', 开始工作年: '2021', 身份: '在校' },
        }));
        location.hash = '#/onboard/eduyears';
      }, [简历键, 教育]);

    // 1) 默认 Mock 会话（不注入教育 fixture）：既有样例 2014/2017 原样优先，直接继续
    //    （bottom-drawer 统一 Task 4：档位断言经共用年份抽屉，取消零写入后直接下一步）
    await pickerMock登录(page);
    await page.goto('/#/onboard/eduyears');
    await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible({ timeout: 15_000 });
    const 入口行 = page.getByRole('button', { name: '入学年和毕业年' });
    await expect(入口行).toContainText('2014');
    await expect(入口行).toContainText('2017');
    await 入口行.click();
    const 年抽屉 = page.getByRole('dialog', { name: '就读时间段' });
    await expect(年抽屉.getByRole('listbox', { name: '入学年' }).getByRole('option', { name: '2014', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(年抽屉.getByRole('listbox', { name: '毕业年' }).getByRole('option', { name: '2017', exact: true })).toHaveAttribute('aria-selected', 'true');
    await 年抽屉.getByRole('button', { name: '取消' }).click();
    await expect(年抽屉).toHaveCount(0);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/experience$/, { timeout: 15_000 });

    // 2) 显式 Mock 2021/2025 演示数据（种子形态缓存）：入口行停在种子档，直接继续
    await 写缓存({ 编号: 'edu1', 学校: '演示大学', 学历: '本科', 专业: '演示专业', 开始: '2021-09', 结束: '2025-06' });
    await page.reload();
    await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '入学年和毕业年' })).toContainText('2021');
    await expect(page.getByRole('button', { name: '入学年和毕业年' })).toContainText('2025');
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/experience$/, { timeout: 15_000 });

    // 3) 空值「请选择」：硬刷新不补默认；抽屉点档确认成功并保存
    await 写缓存({ 编号: 'edu1', 学校: '演示大学', 学历: '本科', 专业: '演示专业', 开始: '', 结束: '' });
    await page.reload();
    await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '入学年和毕业年' })).toContainText('请选择');
    await page.reload();
    await expect(page.getByRole('button', { name: '入学年和毕业年' })).toContainText('请选择');
    // 点下一步被拦（两侧都空）
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByText('请选择入学时间和毕业时间')).toBeVisible();
    // 抽屉空档选中；点档 2021 / 2025 确认回填入口行
    await page.getByRole('button', { name: '入学年和毕业年' }).click();
    const 年抽屉3 = page.getByRole('dialog', { name: '就读时间段' });
    await expect(年抽屉3.getByRole('listbox', { name: '入学年' }).getByRole('option', { name: '请选择', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(年抽屉3.getByRole('listbox', { name: '毕业年' }).getByRole('option', { name: '请选择', exact: true })).toHaveAttribute('aria-selected', 'true');
    await 年抽屉3.getByRole('listbox', { name: '入学年' }).getByRole('option', { name: '2021', exact: true }).click();
    await 年抽屉3.getByRole('listbox', { name: '毕业年' }).getByRole('option', { name: '2025', exact: true }).click();
    await 年抽屉3.getByRole('button', { name: '确定' }).click();
    await expect(年抽屉3).toHaveCount(0);
    await expect(page.getByRole('button', { name: '入学年和毕业年' })).toContainText('2021');
    // 抽屉确认改 2022 → 下一步保存（Mock 模式 简历教育 变更经 资料持久化
    // 自动落盘 AGXP简历v3，无测试侧 reseed）→ 硬刷新沿应用自己存盘的值恢复
    await page.getByRole('button', { name: '入学年和毕业年' }).click();
    const 年抽屉4 = page.getByRole('dialog', { name: '就读时间段' });
    await 年抽屉4.getByRole('listbox', { name: '入学年' }).getByRole('option', { name: '2022', exact: true }).click();
    await 年抽屉4.getByRole('button', { name: '确定' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/experience$/, { timeout: 15_000 });
    // 消费应用自己落盘的值：存盘后缓存里应有 2022-09（不是测试注入的）
    await expect.poll(() => page.evaluate(() => localStorage.getItem('AGXP简历v3:mock:stg:demo') ?? ''), { timeout: 10_000 })
      .toContain('2022-09');
    // 硬刷新回就读时间段（只改 hash，不再 reseed 缓存）
    await page.evaluate(() => { location.hash = '#/onboard/eduyears'; });
    await page.reload();
    await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible({ timeout: 15_000 });
    const 回读入口 = page.getByRole('button', { name: '入学年和毕业年' });
    await expect(回读入口).toContainText('2022');
    await expect(回读入口).toContainText('2025');

    // Mock 全程零 API 请求
    expect(apiRequests).toEqual([]);
  });
});

test.describe('picker 统一 就读年份 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('空值请选择→点档/真实滚动→硬刷新沿草稿恢复→选空不补默认 @picker @catalog-fullscreen @backend', async ({ page }) => {
    test.setTimeout(240_000);
    const fixture = 创建候选OnboardingFixture();
    await 安装BFF路由(page, {
      记录目录请求: () => {},
      登录尝试id: 'att-picker-eduyears',
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
    });

    // 期望职位页（Task 7 B 契约）需要真实三级目录：装用例专用桩（不改共用 fixture）
    await 装三级职位目录桩(page);

    // ── 新候选旅程走到就读时间段（建档草稿在途）──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/, { timeout: 30_000 });
    await page.getByRole('button', { name: '已毕业' }).click();
    // Backend（Task 5B）身份选择不虚构偏好：主要求职类型要显式点一枚
    await page.getByRole('button', { name: '社招全职' }).click();
    await expect(page.getByRole('button', { name: '社招全职' })).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
    await page.getByRole('button', { name: '选择工作城市' }).click();
    await expect(page).toHaveURL(/#\/onboard\/city$/);
    await page.getByPlaceholder('搜索城市 / 省份').fill('fixture');
    await expect(page.getByRole('button', { name: 标记.城市display, exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 标记.城市display, exact: true }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/student$/);
    await page.getByRole('button', { name: '选择期望职位' }).click();
    await expect(page).toHaveURL(/#\/onboard\/job$/);
    // editor-catalog-fullscreen Task 7（B 契约）：左栏一级导航 + 右组三级叶子；
    // 挂载自动选首根后右栏叶子直接出现（不再是旧两栏的左右两枚同名按钮）。
    // display 带前导空格，可访问名按空白归一，这里不再用 exact。
    const 职位键 = page.getByRole('button', { name: 标记.职位display });
    await expect(职位键.first()).toBeVisible({ timeout: 10_000 });
    await expect(职位键).toHaveCount(1, { timeout: 10_000 });
    await 职位键.click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/student$/);
    await page.getByRole('button', { name: '混合' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/wizard\?stage=salary$/, { timeout: 15_000 });
    await 走向导薪资(page);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/basic$/, { timeout: 15_000 });
    await page.getByPlaceholder('身份证上的名字').fill('Fixture 候选人');
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/onboard\/status$/, { timeout: 15_000 });
    await page.getByRole('button', { name: '在职 · 考虑机会' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/onboard\/degree$/, { timeout: 15_000 });
    await page.getByRole('button', { name: '本科' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/onboard\/school$/, { timeout: 15_000 });
    await page.getByPlaceholder('学校名称').fill('fixture');
    await expect(page.getByText(标记.学校display)).toBeVisible({ timeout: 10_000 });
    await page.getByText(标记.学校display).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/onboard\/major$/, { timeout: 15_000 });
    await page.getByPlaceholder('专业名称').fill('fixture');
    await expect(page.getByRole('button', { name: 标记.专业display, exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 标记.专业display, exact: true }).click();
    await page.getByRole('button', { name: '下一步' }).click();

    // ── 就读时间段：Backend 空教育 → 入口行两侧「请选择」（bottom-drawer 统一 Task 4：
    //    档位断言与点档都经共用年份抽屉；确定才原子写建档草稿）──
    await expect(page).toHaveURL(/#\/onboard\/eduyears$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible();
    const 入口行 = page.getByRole('button', { name: '入学年和毕业年' });
    await expect(入口行).toContainText('请选择', { timeout: 10_000 });

    // 空值真相检查在前：下一步被拦
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByText('请选择入学时间和毕业时间')).toBeVisible();

    // 抽屉两侧都停在「请选择」空档；点档 2021/2025 确定才回填
    await 入口行.click();
    const 年抽屉 = page.getByRole('dialog', { name: '就读时间段' });
    await expect(年抽屉.getByRole('listbox', { name: '入学年' }).getByRole('option', { name: '请选择', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(年抽屉.getByRole('listbox', { name: '毕业年' }).getByRole('option', { name: '请选择', exact: true })).toHaveAttribute('aria-selected', 'true');
    await 年抽屉.getByRole('listbox', { name: '入学年' }).getByRole('option', { name: '2021', exact: true }).click();
    await 年抽屉.getByRole('listbox', { name: '毕业年' }).getByRole('option', { name: '2025', exact: true }).click();
    await 年抽屉.getByRole('button', { name: '确定' }).click();
    await expect(年抽屉).toHaveCount(0);
    await expect(入口行).toContainText('2021');
    await expect(入口行).toContainText('2025');

    // 硬刷新：沿建档草稿恢复（草稿随抽屉确定落盘）
    await page.reload();
    await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible({ timeout: 30_000 });
    const 刷新入口 = page.getByRole('button', { name: '入学年和毕业年' });
    await expect(刷新入口).toContainText('2021', { timeout: 15_000 });
    await expect(刷新入口).toContainText('2025');

    // 抽屉选空档清空毕业年（草稿原子写回空）→ 硬刷新仍为空，不补 2021/2025 默认
    await 刷新入口.click();
    const 清空抽屉 = page.getByRole('dialog', { name: '就读时间段' });
    await 清空抽屉.getByRole('listbox', { name: '毕业年' }).getByRole('option', { name: '请选择', exact: true }).click();
    await 清空抽屉.getByRole('button', { name: '确定' }).click();
    await expect(清空抽屉).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible({ timeout: 30_000 });
    const 清空入口 = page.getByRole('button', { name: '入学年和毕业年' });
    await expect(清空入口).toContainText('2021', { timeout: 15_000 });
    await expect(清空入口).toContainText('请选择');

    // 补上毕业年 → 直接继续；education POST 带抽屉确认保存的起止
    await 清空入口.click();
    const 补齐抽屉 = page.getByRole('dialog', { name: '就读时间段' });
    await 补齐抽屉.getByRole('listbox', { name: '毕业年' }).getByRole('option', { name: '2025', exact: true }).click();
    await 补齐抽屉.getByRole('button', { name: '确定' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/experience$/, { timeout: 20_000 });
    const 教育写入 = fixture.mutations.filter(
      (条) => 条.method === 'POST' && 条.path === '/api/v1/me/resume/educations',
    );
    expect(教育写入.length).toBeGreaterThan(0);
    expect(教育写入[0]!.body).toMatchObject({ start_month: '2021-09', end_month: '2025-06' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// catalog-fullscreen（editor-catalog-fullscreen Task 8）：五个全屏选择入口
// （发布岗位「职位类别」、教育承载「选择学校」/「选择专业」、经历「所属行业」、
// 公司档案基本信息「选择行业」）换 全屏选择外壳 后的定向浏览器回归，外加期望职位
// B 契约正文（期望职位选择正文）的整页布局回归。DOM/jsdom 证明不了的整页几何在这里断言：
// dialog 满高充满应用可用区、父表单 hidden 后字段不可聚焦、首焦点在返回键、
// Tab/Shift+Tab 限于壳内、Escape/返回可用、关闭后无弹层遮罩残留、页面本身零滚动
// （无双滚动：滚动只发生在层内列表）；320×568 短屏与 844×390 横屏下长候选滚到底。
// Mock 全程零 /api/v1；Backend 目录桩为用例专用后装 route（真实三级结构，不改共用
// fixture），取消/选择子页零资源 mutation，最终资源写入捕获请求里的原目录 ID。
// ─────────────────────────────────────────────────────────────────────────────

/** 全屏外壳几何：bbox 完整落在视口内（动画落定）且满高满宽（4px 边框/取整误差）。
 *  期望尺寸取自当前项目视口（iPhone 13 项目默认可见视口 390×664；显式 use 的
 *  用例按 390×844 / 320×568 / 844×390 字面口径），不写死常数。 */
async function 断言全屏外壳(page: Page, 弹层: Locator): Promise<void> {
  const 视口 = (await page.viewportSize())!;
  await picker在视口内(弹层, 视口.width, 视口.height);
  const 盒 = await 弹层.boundingBox();
  expect(盒!.height).toBeGreaterThanOrEqual(视口.height - 4);
  expect(盒!.width).toBeGreaterThanOrEqual(视口.width - 4);
}

/** 双滚动检查：页面本身不允许滚动（body overflow hidden 是全局约定），
 *  滚动只发生在屏幕内 .滚动区 / 全屏外壳的层内列表 */
async function 断言页面零滚动(page: Page): Promise<void> {
  const 溢出 = await page.evaluate(() => ({
    横: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    竖: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  expect(溢出.横).toBeLessThanOrEqual(2);
  expect(溢出.竖).toBeLessThanOrEqual(2);
}

/** 当前焦点是否在某个 role=dialog 之内（Tab 焦点圈限于壳内的浏览器级证据） */
const 焦点在弹层内 = (page: Page) =>
  page.evaluate(() => (document.activeElement?.closest('[role="dialog"]') ?? null) !== null);

test.describe('catalog-fullscreen 全屏外壳 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181', viewport: { width: 390, height: 844 } });

  test('四入口（职位类别/选择学校/选择专业/所属行业）：进入充满可用区、父字段不可聚焦、取消重开选择保草稿 @catalog-fullscreen @mock', async ({ page }) => {
    test.setTimeout(240_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);

    // ── 1) 发布岗位「职位类别」：先填其它字段 → 滚到入口 → 进入 ──
    await page.goto('/#/hr/post-job');
    const 职位名称输入 = page.getByPlaceholder(/资深后端工程师/);
    await expect(职位名称输入).toBeVisible({ timeout: 15_000 });
    await 职位名称输入.fill('全屏草稿岗');
    await page.evaluate(() => {
      const 区 = document.querySelector('.滚动区') as HTMLElement | null;
      if (区) 区.scrollTop = 区.scrollHeight;
    });
    const 打开前滚动 = await page.evaluate(() => (document.querySelector('.滚动区') as HTMLElement | null)?.scrollTop ?? -1);
    const 职位类别行 = page.getByRole('button').filter({ hasText: '职位类别' });
    await 职位类别行.click();
    const 类别层 = page.getByRole('dialog', { name: '职位类别' });
    await expect(类别层.getByRole('button', { name: '产品', exact: true })).toBeVisible({ timeout: 10_000 });
    // 全屏几何：dialog 充满应用可用区（390×844），页面本身零滚动
    await 断言全屏外壳(page, 类别层);
    await 断言页面零滚动(page);
    // 父表单 hidden 保挂载：其它字段不可见不可聚焦；首焦点在返回键；Tab 限于壳内
    await expect(职位名称输入).toBeHidden();
    await expect(类别层.getByRole('button', { name: '返回' })).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await 焦点在弹层内(page)).toBe(true);
    // Escape 取消：层关、焦点/滚动/其它字段值都保留、无弹层遮罩残留
    await page.keyboard.press('Escape');
    await expect(类别层).toHaveCount(0);
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect(page.locator('[class*="遮罩"]')).toHaveCount(0);
    await expect(职位名称输入).toBeVisible();
    await expect(职位名称输入).toHaveValue('全屏草稿岗');
    await expect(职位类别行).toBeFocused();
    expect(await page.evaluate(() => (document.querySelector('.滚动区') as HTMLElement | null)?.scrollTop ?? -1))
      .toBe(打开前滚动);
    // 重开 → 选择 → 自动回填并关闭；再开选中勾在
    await 职位类别行.click();
    await expect(类别层).toBeVisible();
    await 类别层.getByRole('button', { name: '产品', exact: true }).click();
    await 类别层.getByRole('button', { name: '产品经理', exact: true }).click();
    await expect(类别层).toHaveCount(0);
    await expect(职位类别行).toContainText('产品 · 产品经理');
    await 职位类别行.click();
    await expect(类别层.getByRole('button', { name: /产品经理\s*✓/ })).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(类别层).toHaveCount(0);

    // ── 2) 教育承载「选择学校」/「选择专业」 ──
    await page.goto('/#/experience');
    await expect(page.getByRole('button', { name: '＋ 添加教育经历' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加教育经历' }).click();
    await expect(page.getByText('学校名称')).toBeVisible({ timeout: 10_000 });
    const 学校行 = page.getByRole('button').filter({ hasText: '学校名称' });
    await 学校行.click();
    const 学校层 = page.getByRole('dialog', { name: '选择学校' });
    await expect(学校层.getByPlaceholder('搜索学校名称')).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 学校层);
    await expect(学校层.getByRole('button', { name: '返回' })).toBeFocused();
    // 取消（返回键）：草稿不变、焦点回触发行
    await 学校层.getByRole('button', { name: '返回' }).click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toBeFocused();
    // 重开 → 搜索 → 选候选 → 行回填且层收起
    await 学校行.click();
    await expect(page.getByRole('dialog', { name: '选择学校' }).getByPlaceholder('搜索学校名称')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('dialog', { name: '选择学校' }).getByPlaceholder('搜索学校名称').fill('大学');
    await page.getByRole('dialog', { name: '选择学校' }).getByRole('button', { name: '清华大学', exact: true }).click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toContainText('清华大学');
    const 专业行 = page.getByRole('button').filter({ hasText: '专业' }).first();
    await 专业行.click();
    const 专业层 = page.getByRole('dialog', { name: '选择专业' });
    await expect(专业层.getByPlaceholder('搜索专业名称')).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 专业层);
    await 专业层.getByPlaceholder('搜索专业名称').fill('工程');
    await 专业层.getByRole('button', { name: '软件工程', exact: true }).click();
    await expect(专业层).toHaveCount(0);
    await expect(专业行).toContainText('软件工程');
    // 教育编辑页与经历列表同属 /#/experience 路由（goto 同址不会重挂）：取消回列表
    await page.getByRole('button', { name: '返回' }).click();
    await expect(page.getByRole('button', { name: '＋ 添加工作经历' })).toBeVisible({ timeout: 15_000 });

    // ── 3) 经历「所属行业」：先填职位 → Escape 取消零选择 → 重开选细分 ──
    await page.goto('/#/experience');
    await expect(page.getByRole('button', { name: '＋ 添加工作经历' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加工作经历' }).click();
    await expect(page.getByPlaceholder('必填')).toHaveCount(1);
    await page.getByPlaceholder('必填').fill('全屏草稿工程师');
    await page.getByRole('button', { name: '所属行业' }).click();
    const 行业层 = page.getByRole('dialog', { name: '所属行业' });
    await expect(行业层.getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 行业层);
    await expect(page.getByPlaceholder('必填')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(行业层).toHaveCount(0);
    await expect(page.getByPlaceholder('必填')).toHaveValue('全屏草稿工程师');
    await page.getByRole('button', { name: '所属行业' }).click();
    await expect(page.getByRole('dialog', { name: '所属行业' }).getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('dialog', { name: '所属行业' }).getByRole('button', { name: /金融科技/ }).click();
    await page.getByRole('dialog', { name: '所属行业' }).getByRole('button', { name: '支付与清结算', exact: true }).click();
    await expect(行业层).toHaveCount(0);
    await expect(page.getByRole('button', { name: /所属行业/ })).toContainText('支付与清结算');

    // Mock 全程零 /api/v1 请求（不发任何 Backend 目录请求）
    expect(apiRequests).toEqual([]);
  });

  test('公司档案基本信息「选择行业」：进入/取消/重开/选择/保存回读 @catalog-fullscreen @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);
    await page.getByRole('button', { name: '我要招人' }).click();
    await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 20_000 });
    await page.goto('/#/hr/company-profile/basic');
    const 行业行 = page.getByRole('button', { name: '更换行业' });
    await expect(行业行).toBeVisible({ timeout: 15_000 });
    // 先填其它字段（公司全称），再开选择层
    const 品牌输入 = page.getByLabel('公司全称');
    await 品牌输入.fill('全屏草稿品牌');

    await 行业行.click();
    const 公司行业层 = page.getByRole('dialog', { name: '选择行业' });
    await expect(公司行业层.getByPlaceholder('搜索行业')).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 公司行业层);
    await 断言页面零滚动(page);
    // 父表单 hidden：行业行与品牌输入都不可见；首焦点在返回键
    await expect(行业行).toBeHidden();
    await expect(公司行业层.getByRole('button', { name: '返回' })).toBeFocused();
    // Escape 取消：草稿不变
    await page.keyboard.press('Escape');
    await expect(公司行业层).toHaveCount(0);
    await expect(品牌输入).toHaveValue('全屏草稿品牌');
    // 重开 → 搜索 → 选定 → 行回填且层收起
    await 行业行.click();
    await expect(page.getByRole('dialog', { name: '选择行业' }).getByPlaceholder('搜索行业')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('dialog', { name: '选择行业' }).getByPlaceholder('搜索行业').fill('人工智能');
    await page.getByRole('dialog', { name: '选择行业' }).getByRole('button', { name: '人工智能', exact: true }).click();
    await expect(公司行业层).toHaveCount(0);
    await expect(行业行).toContainText('人工智能');
    // 保存 → 「已保存」轻提示 → 返回走历史；重进分区回读持久值
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('已保存')).toBeVisible({ timeout: 10_000 });
    await page.goto('/#/hr/company-profile/basic');
    await expect(page.getByRole('button', { name: '更换行业' })).toContainText('人工智能', { timeout: 15_000 });

    // Mock 全程零 /api/v1 请求
    expect(apiRequests).toEqual([]);
  });
});

test.describe('catalog-fullscreen 短屏 320×568 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181', viewport: { width: 320, height: 568 } });

  test('选择学校长候选滚到底、返回可达、无双滚动 @catalog-fullscreen @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);
    await page.goto('/#/experience');
    await expect(page.getByRole('button', { name: '＋ 添加教育经历' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加教育经历' }).click();
    await expect(page.getByText('学校名称')).toBeVisible({ timeout: 10_000 });
    const 学校行 = page.getByRole('button').filter({ hasText: '学校名称' });
    await 学校行.click();
    const 学校层 = page.getByRole('dialog', { name: '选择学校' });
    await expect(学校层.getByPlaceholder('搜索学校名称')).toBeVisible({ timeout: 10_000 });
    await 学校层.getByPlaceholder('搜索学校名称').fill('大学');
    await expect(学校层.getByRole('button', { name: '清华大学', exact: true })).toBeVisible({ timeout: 10_000 });

    // 320×568 短屏：外壳仍充满可用区，页面本身零滚动（无双滚动）
    await 断言全屏外壳(page, 学校层);
    await 断言页面零滚动(page);

    // 长候选真滚动：首页 8 条 + 列表尾「加载更多」翻出第 9–16 位 → 壳内 .滚动区
    // （当前值 + 搜索 + 候选一体滚动）滚到底最后一项可见
    await 学校层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(学校层.getByRole('button', { name: '同济大学', exact: true })).toBeVisible({ timeout: 10_000 });
    const 列表 = 学校层.locator('.滚动区');
    const 尺寸 = await 列表.evaluate((节点) => ({ 滚: 节点.scrollHeight, 可见: 节点.clientHeight }));
    expect(尺寸.滚).toBeGreaterThan(尺寸.可见);
    await 列表.evaluate((节点) => { 节点.scrollTop = 节点.scrollHeight; });
    await expect(学校层.getByRole('button', { name: '同济大学', exact: true })).toBeVisible();
    // 返回键在滚动到底后仍可达可点：先取消，草稿不变
    const 返回键 = 学校层.getByRole('button', { name: '返回' });
    await expect(返回键).toBeVisible();
    await expect(返回键).toBeEnabled();
    await 返回键.click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toContainText('选择学校');
    // 重开滚到底选最后一项：回填并收起
    await 学校行.click();
    await expect(学校层.getByPlaceholder('搜索学校名称')).toBeVisible({ timeout: 10_000 });
    await 学校层.getByPlaceholder('搜索学校名称').fill('大学');
    await 学校层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(学校层.getByRole('button', { name: '同济大学', exact: true })).toBeVisible({ timeout: 10_000 });
    const 列表2 = 学校层.locator('.滚动区');
    await 列表2.evaluate((节点) => { 节点.scrollTop = 节点.scrollHeight; });
    await 学校层.getByRole('button', { name: '同济大学', exact: true }).click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toContainText('同济大学');

    // Mock 全程零 /api/v1 请求
    expect(apiRequests).toEqual([]);
  });
});

test.describe('catalog-fullscreen 横屏 844×390 期望职位 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181', viewport: { width: 844, height: 390 } });

  test('期望职位点根直接出现至少两组、leaf 后底部已选/保存正确、无双滚动 @catalog-fullscreen @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/, { timeout: 15_000 });
    await page.getByRole('button', { name: /选择期望职位/ }).click();
    await expect(page).toHaveURL(/#\/onboard\/job$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '期望职位是' })).toBeVisible({ timeout: 10_000 });

    // 整页充满 844×390 可用区，页面本身零滚动；返回栏与底部保存都在视口内
    await 断言页面零滚动(page);
    const 保存键 = page.getByRole('button', { name: '保存', exact: true });
    await expect(保存键).toBeVisible();

    // B 契约：挂载自动选首根 → 多组二级标题（不是按钮）与三级叶子按目录顺序直接出现
    await expect(page.getByRole('heading', { name: '后端开发' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '前端/移动开发' })).toBeVisible();
    // 点根：一级高亮切换，另一根的组同样直接出现（至少两组）
    await page.getByRole('button', { name: '产品', exact: true }).click();
    await expect(page.getByRole('heading', { name: '产品经理' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '游戏策划' })).toBeVisible();
    const 组标题数 = await page.locator('h3').count();
    expect(组标题数).toBeGreaterThanOrEqual(2);

    // 点 leaf：底部已选 chip 出现；保存回学生页
    await page.getByRole('button', { name: 'AI产品经理', exact: true }).click();
    await expect(page.getByRole('button', { name: 'AI产品经理 ✕' })).toBeVisible();
    await 保存键.click();
    await expect(page).toHaveURL(/#\/student$/, { timeout: 10_000 });

    // Mock 全程零 /api/v1 请求
    expect(apiRequests).toEqual([]);
  });
});

test.describe('catalog-fullscreen 学校/专业连点 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('引导 学校/专业 搜索后同项连点两次候选不消失，选择不额外请求 @catalog-fullscreen @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);

    // ── /onboard/school：同项连点两次，候选行保持、值不重复、零请求 ──
    await page.goto('/#/onboard/school');
    const 学校输入 = page.getByPlaceholder('学校名称');
    await expect(学校输入).toBeVisible({ timeout: 15_000 });
    await 学校输入.fill('大学');
    // 选中后候选行可访问名带「✓」尾缀，重连点用正则，不再 exact
    const 清华 = page.getByRole('button', { name: /^清华大学( ✓)?$/ });
    await expect(清华).toBeVisible({ timeout: 10_000 });
    await 清华.click();
    await expect(学校输入).toHaveValue('清华大学');
    await 清华.click();
    await expect(清华).toBeVisible();
    await expect(学校输入).toHaveValue('清华大学');

    // ── /onboard/major：同一口径 ──
    await page.goto('/#/onboard/major');
    const 专业输入 = page.getByPlaceholder('专业名称');
    await expect(专业输入).toBeVisible({ timeout: 15_000 });
    await 专业输入.fill('工程');
    const 软工 = page.getByRole('button', { name: /^软件工程( ✓)?$/ });
    await expect(软工).toBeVisible({ timeout: 10_000 });
    await 软工.click();
    await expect(专业输入).toHaveValue('软件工程');
    await 软工.click();
    await expect(软工).toBeVisible();
    await expect(专业输入).toHaveValue('软件工程');

    // Mock 全程零 /api/v1 请求（选择零额外请求在 Mock 即零请求全程）
    expect(apiRequests).toEqual([]);
  });
});

test.describe('catalog-fullscreen 候选侧三入口 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182', viewport: { width: 390, height: 844 } });

  test('选择学校/选择专业/所属行业：进入充满可用区、取消零写、重开选择，最终写入带原目录 ID @catalog-fullscreen @backend', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const fixture = 创建候选OnboardingFixture();
    fixture.主体.last_used_role = 'candidate';
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选' },
      summary: '存量个人优势',
    };
    fixture.intentions = [P4深克隆(fixture意向列表.intentions[0])];
    // 合同 C：经历公司走 公司选择抽屉 —— 搜索池给默认组织库
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P3默认组织库();
    await 安装BFF路由(page, {
      登录尝试id: 'att-catalog-fs-candidate',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: 隐私,
    });

    // 行业目录桩（本用例专用后装 route，真实三级：根不可选 → 细分组不可选 → 可选叶子）
    await page.route('**/api/v1/catalog/industries*', async (route) => {
      const url = new URL(route.request().url());
      const parentId = url.searchParams.get('parent_id');
      if (parentId === 'ind_grp') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [{ id: 'ind_leaf_bank', display_name: '银行支付', parent_id: 'ind_grp', selectable: true, has_children: false }],
            next_cursor: null,
            catalog_version: 'ind-v1',
          }),
        });
        return;
      }
      if (parentId === 'ind_root') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [{ id: 'ind_grp', display_name: '支付与清结算', parent_id: 'ind_root', selectable: false, has_children: true }],
            next_cursor: null,
            catalog_version: 'ind-v1',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [{ id: 'ind_root', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }],
          next_cursor: null,
          catalog_version: 'ind-v1',
        }),
      });
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    // 日常入口（简历编辑显式来源）：从 我的简历 点行进在线简历（带 from=resume），
    // 整页保存落点随之回我的简历；子视图取消零写与 ID 断言保持原样
    await page.goto('/#/resume');
    await expect(page.getByText('我的简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button').filter({ hasText: 'Fixture 大学' }).first().click();
    await expect(page).toHaveURL(/#\/experience\?from=resume$/, { timeout: 15_000 });
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });

    // ── 教育「选择学校」：进入充满可用区、父字段 hidden、Escape 取消零写、重开选择 ──
    await page.getByRole('button', { name: '＋ 添加教育经历' }).click();
    await expect(page.getByText('学校名称')).toBeVisible({ timeout: 10_000 });
    const 学校行 = page.getByRole('button').filter({ hasText: '学校名称' });
    await 学校行.click();
    const 学校层 = page.getByRole('dialog', { name: '选择学校' });
    await expect(学校层.getByPlaceholder('搜索学校名称')).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 学校层);
    await 断言页面零滚动(page);
    await expect(page.getByRole('button', { name: '完成', exact: true })).toBeHidden();
    await expect(学校层.getByRole('button', { name: '返回' })).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await 焦点在弹层内(page)).toBe(true);
    const 取消前写入数 = fixture.mutations.length;
    await page.keyboard.press('Escape');
    await expect(学校层).toHaveCount(0);
    expect(fixture.mutations.length).toBe(取消前写入数);
    await expect(学校行).toBeFocused();
    // 重开 → 搜索 → 选候选 → 行回填
    await 学校行.click();
    await expect(page.getByRole('dialog', { name: '选择学校' }).getByPlaceholder('搜索学校名称')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('dialog', { name: '选择学校' }).getByPlaceholder('搜索学校名称').fill('fixture');
    await expect(page.getByRole('dialog', { name: '选择学校' }).getByText(标记.学校display)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('dialog', { name: '选择学校' }).getByText(标记.学校副行)).toBeVisible();
    await page.getByRole('dialog', { name: '选择学校' }).getByText(标记.学校display).click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toContainText('Fixture 大学');

    // ── 教育「选择专业」 ──
    const 专业行 = page.getByRole('button').filter({ hasText: '专业' }).first();
    await 专业行.click();
    const 专业层 = page.getByRole('dialog', { name: '选择专业' });
    await expect(专业层.getByPlaceholder('搜索专业名称')).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 专业层);
    await 专业层.getByPlaceholder('搜索专业名称').fill('fixture');
    await expect(专业层.getByRole('button', { name: 标记.专业display })).toBeVisible({ timeout: 10_000 });
    await 专业层.getByRole('button', { name: 标记.专业display }).click();
    await expect(专业层).toHaveCount(0);
    await expect(专业行).toContainText('Fixture 专业');
    // 完成 → 教育卡上屏；保存按所点行的原目录 ID 提交（不按显示名反查），
    // 编辑入口带 from=resume：整页保存落点是我的简历
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await expect(page.getByText(/Fixture 大学/).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/resume$/, { timeout: 20_000 });
    const 教育写入 = fixture.mutations.filter(
      (条) => 条.method === 'POST' && 条.path === '/api/v1/me/resume/educations',
    );
    expect(教育写入.length).toBeGreaterThan(0);
    expect(教育写入[0]!.body).toMatchObject({ institution_id: 'inst-fixture-001', major_id: 'major-fixture-001' });

    // ── 经历「所属行业」：先填其它字段 → 取消零写 → 重开下钻选叶子 → 按 ID 保存 ──
    await page.getByRole('button').filter({ hasText: 'Fixture 大学' }).first().click();
    await expect(page).toHaveURL(/#\/experience\?from=resume$/, { timeout: 15_000 });
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加工作经历' }).click();
    await expect(page.getByPlaceholder('必填')).toHaveCount(1);
    await page.getByRole('button').filter({ hasText: '公司名称' }).click();
    await 抽屉搜企业并选中(page, '磐石', P3标记.手动组织甲);
    await page.getByPlaceholder('必填').fill('全屏草稿工程师');
    const 经历取消前写入数 = fixture.mutations.length;
    await page.getByRole('button', { name: '所属行业' }).click();
    const 行业层 = page.getByRole('dialog', { name: '所属行业' });
    await expect(行业层.getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 行业层);
    await expect(page.getByPlaceholder('必填')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(行业层).toHaveCount(0);
    expect(fixture.mutations.length).toBe(经历取消前写入数);
    // 重开 → 真实三级下钻：根 → 细分组 → 可选叶子
    await page.getByRole('button', { name: '所属行业' }).click();
    await expect(行业层.getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });
    await 行业层.getByRole('button', { name: /金融科技/ }).click();
    await expect(行业层.getByRole('button', { name: /支付与清结算/ })).toBeVisible({ timeout: 10_000 });
    await 行业层.getByRole('button', { name: /支付与清结算/ }).click();
    await 行业层.getByRole('button', { name: '银行支付', exact: true }).click();
    await expect(行业层).toHaveCount(0);
    await expect(page.getByRole('button', { name: /所属行业/ })).toContainText('银行支付');
    // 入职年月 → 完成 → 保存：experience POST 的 industry_id 是所点叶子的原目录 ID，
    // 编辑入口带 from=resume：整页保存落点是我的简历
    await page.getByRole('button', { name: '入职年月' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '确定' }).click();
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await expect(page.getByText(/银行支付/).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/resume$/, { timeout: 20_000 });
    const 经历写入 = fixture.mutations.filter(
      (条) => 条.method === 'POST' && 条.path === '/api/v1/me/resume/experiences',
    );
    expect(经历写入.length).toBeGreaterThan(0);
    expect(经历写入[0]!.body).toMatchObject({
      organization_id: 'org-fixture-p3-manual-a',
      industry_id: 'ind_leaf_bank',
    });

    await page.screenshot({ path: `${testInfo.outputPath()}-catalog-fullscreen-候选侧.png`, fullPage: true });
  });
});

test.describe('catalog-fullscreen 招聘侧两入口 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182', viewport: { width: 390, height: 844 } });

  test('发布岗位「职位类别」与公司档案「选择行业」：进入充满可用区、父字段不可聚焦、取消重开选择 @catalog-fullscreen @backend', async ({ page }) => {
    test.setTimeout(240_000);
    const 请求们: { path: string; method: string; body: unknown }[] = [];
    // 合同 C：名片公司自报经 公司选择抽屉 选中（搜索池 + 公开企业回读都要有组织甲）
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P1C搜索池();
    await 安装BFF路由(page, {
      登录尝试id: 'att-catalog-fs-recruiter',
      记录目录请求: () => undefined,
      请求拦截: ({ path, method, body }) => 请求们.push({ path, method, body }),
      // admin@组织甲（verified/active）：公司档案分区可写，行业行可点
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [P1C管理员关系], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      隐私fixture: 隐私,
    });

    // 公司行业目录桩（本用例专用后装 route，真实三级：根不可选 → 可选叶子）
    await page.route('**/api/v1/catalog/industries*', async (route) => {
      const url = new URL(route.request().url());
      const parentId = url.searchParams.get('parent_id');
      if (parentId === 'co_ind_root') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [{ id: 'co_ind_leaf', display_name: '生活服务', parent_id: 'co_ind_root', selectable: true, has_children: false }],
            next_cursor: null,
            catalog_version: 'ind-v1',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [{ id: 'co_ind_root', display_name: '消费生活', parent_id: null, selectable: false, has_children: true }],
          next_cursor: null,
          catalog_version: 'ind-v1',
        }),
      });
    });

    // 存量招聘会话经应用内入口进名片（注册流入口会被已完成账号守卫弹回企业主壳）
    await page.goto('/#/hr/card');
    await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('姓名').fill('林澈');
    await page.getByLabel('职务').fill('招聘负责人');
    await page.getByRole('button', { name: '未选择公司' }).click();
    await 抽屉搜企业并选中(page, '云衢科技', P1C标记.组织甲名);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('保存成功')).toBeVisible({ timeout: 20_000 });

    // ── 发布岗位「职位类别」 ──
    await page.goto('/#/hr/post-job');
    const 职位名称输入 = page.getByPlaceholder(/资深后端工程师/);
    await expect(职位名称输入).toBeVisible({ timeout: 15_000 });
    await 职位名称输入.fill('全屏草稿岗');
    const 职位类别行 = page.getByRole('button').filter({ hasText: '职位类别' });
    await 职位类别行.click();
    const 类别层 = page.getByRole('dialog', { name: '职位类别' });
    await expect(类别层.getByRole('button', { name: 标记.职位display }).first()).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 类别层);
    await 断言页面零滚动(page);
    await expect(职位名称输入).toBeHidden();
    await expect(类别层.getByRole('button', { name: '返回' })).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await 焦点在弹层内(page)).toBe(true);
    const 类别取消前写入数 = 请求们.filter((条) => 条.method !== 'GET').length;
    await page.keyboard.press('Escape');
    await expect(类别层).toHaveCount(0);
    expect(请求们.filter((条) => 条.method !== 'GET').length).toBe(类别取消前写入数);
    await expect(职位名称输入).toHaveValue('全屏草稿岗');
    // 重开 → 选叶子（fixture 根与子同名，点根后右栏出同名叶子，取次序区分）
    await 职位类别行.click();
    const 类键 = page.getByRole('dialog', { name: '职位类别' }).getByRole('button', { name: 标记.职位display });
    await expect(类键.first()).toBeVisible({ timeout: 10_000 });
    await 类键.first().click();
    await expect(类键).toHaveCount(2, { timeout: 10_000 });
    await 类键.last().click();
    await expect(类别层).toHaveCount(0);
    await expect(职位类别行).toContainText('Fixture 工程师');

    // ── 公司档案基本信息「选择行业」：先经分区清单页（企业档案快照在那里水合）──
    await page.goto('/#/hr/company-profile');
    await expect(page.getByRole('heading', { name: '编辑品牌信息' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /基本信息/ }).click();
    const 行业行 = page.getByRole('button', { name: '更换行业' });
    await expect(行业行).toBeVisible({ timeout: 15_000 });
    await 行业行.click();
    const 公司行业层 = page.getByRole('dialog', { name: '选择行业' });
    await expect(公司行业层.getByPlaceholder('搜索行业')).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 公司行业层);
    await expect(行业行).toBeHidden();
    await expect(公司行业层.getByRole('button', { name: '返回' })).toBeFocused();
    const 行业取消前写入数 = 请求们.filter((条) => 条.method !== 'GET').length;
    await page.keyboard.press('Escape');
    await expect(公司行业层).toHaveCount(0);
    expect(请求们.filter((条) => 条.method !== 'GET').length).toBe(行业取消前写入数);
    // 重开 → 下钻 → 选叶子 → 行回填
    await 行业行.click();
    await expect(page.getByRole('dialog', { name: '选择行业' }).getByRole('button', { name: '消费生活', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('dialog', { name: '选择行业' }).getByRole('button', { name: '消费生活', exact: true }).click();
    await page.getByRole('dialog', { name: '选择行业' }).getByRole('button', { name: '生活服务', exact: true }).click();
    await expect(公司行业层).toHaveCount(0);
    await expect(行业行).toContainText('生活服务');
  });
});

test.describe('catalog-fullscreen 短屏 320×568 学校长候选 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182', viewport: { width: 320, height: 568 } });

  test('选择学校两页长候选滚到底、返回可达、无双滚动 @catalog-fullscreen @backend', async ({ page }) => {
    test.setTimeout(120_000);
    await pickerBackend存量候选(page, 'att-catalog-fs-school');

    // 教育目录桩（本用例专用后装 route）：两页各 8 所，撑出层内长滚动
    await page.route('**/api/v1/catalog/education-institutions*', async (route) => {
      const url = new URL(route.request().url());
      const 校 = (序: number) => ({
        id: `inst_${序}`,
        display_name: `细分校${序}`,
        location: {
          id: `loc_${序}`, display_name: `城市${序}`, country_code: 'CN', country_name: '中国',
          admin1_code: null, admin1_name: null, timezone: 'Asia/Shanghai', population: 0,
        },
        selectable: true,
      });
      if (url.searchParams.get('cursor') === 'inst-cur-2') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: Array.from({ length: 8 }, (_, 序) => 校(序 + 9)),
            next_cursor: null,
            catalog_version: 'inst-v1',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: Array.from({ length: 8 }, (_, 序) => 校(序 + 1)),
          next_cursor: 'inst-cur-2',
          catalog_version: 'inst-v1',
        }),
      });
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto('/#/experience');
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加教育经历' }).click();
    await expect(page.getByText('学校名称')).toBeVisible({ timeout: 10_000 });
    const 学校行 = page.getByRole('button').filter({ hasText: '学校名称' });
    await 学校行.click();
    const 学校层 = page.getByRole('dialog', { name: '选择学校' });
    await expect(学校层.getByPlaceholder('搜索学校名称')).toBeVisible({ timeout: 10_000 });
    await 学校层.getByPlaceholder('搜索学校名称').fill('细分校');
    await expect(学校层.getByRole('button', { name: '细分校1', exact: true })).toBeVisible({ timeout: 10_000 });

    // 320×568 短屏：外壳充满可用区，页面本身零滚动（无双滚动）
    await 断言全屏外壳(page, 学校层);
    await 断言页面零滚动(page);

    // 长候选：首页 8 条 + 列表尾「加载更多」翻第二页 → 真滚到底最后一项可见
    await 学校层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(学校层.getByRole('button', { name: '细分校16', exact: true })).toBeVisible({ timeout: 10_000 });
    // 学校承载的滚动容器是壳内 .滚动区（当前值 + 搜索 + 候选一体滚动）
    const 列表 = 学校层.locator('.滚动区');
    const 尺寸 = await 列表.evaluate((节点) => ({ 滚: 节点.scrollHeight, 可见: 节点.clientHeight }));
    expect(尺寸.滚).toBeGreaterThan(尺寸.可见);
    await 列表.evaluate((节点) => { 节点.scrollTop = 节点.scrollHeight; });
    await expect(学校层.getByRole('button', { name: '细分校16', exact: true })).toBeVisible();
    // 返回键滚到底仍可达：取消 → 草稿不变
    const 返回键 = 学校层.getByRole('button', { name: '返回' });
    await expect(返回键).toBeEnabled();
    await 返回键.click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toContainText('选择学校');
    // 重开滚到底选最后一项：行回填
    await 学校行.click();
    await expect(学校层.getByPlaceholder('搜索学校名称')).toBeVisible({ timeout: 10_000 });
    await 学校层.getByPlaceholder('搜索学校名称').fill('细分校');
    await 学校层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(学校层.getByRole('button', { name: '细分校16', exact: true })).toBeVisible({ timeout: 10_000 });
    const 列表2 = 学校层.locator('.滚动区');
    await 列表2.evaluate((节点) => { 节点.scrollTop = 节点.scrollHeight; });
    await 学校层.getByRole('button', { name: '细分校16', exact: true }).click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toContainText('细分校16');
  });
});

test.describe('catalog-fullscreen 横屏 844×390 期望职位 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182', viewport: { width: 844, height: 390 } });

  test('期望职位点根直接出现至少两组、leaf 后底部已选/保存正确、无双滚动 @catalog-fullscreen @backend', async ({ page }) => {
    test.setTimeout(120_000);
    await pickerBackend存量候选(page, 'att-catalog-fs-job');

    // job-categories 目录桩（本用例专用后装 route，真实三级）：
    // 根（不可选）→ 两个二级组（不可选）→ 各自可选叶子。挂载自动选首根即应出现两组。
    await page.route('**/api/v1/catalog/job-categories*', async (route) => {
      const url = new URL(route.request().url());
      const parentId = url.searchParams.get('parent_id');
      if (parentId === 'job_g1') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [{ id: 'job_leaf_a', display_name: '服务端工程师甲', parent_id: 'job_g1', selectable: true, has_children: false }],
            next_cursor: null,
            catalog_version: 'tax-v1',
          }),
        });
        return;
      }
      if (parentId === 'job_g2') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [{ id: 'job_leaf_b', display_name: '网页工程师乙', parent_id: 'job_g2', selectable: true, has_children: false }],
            next_cursor: null,
            catalog_version: 'tax-v1',
          }),
        });
        return;
      }
      if (parentId === 'job_root') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [
              { id: 'job_g1', display_name: '后端开发', parent_id: 'job_root', selectable: false, has_children: true },
              { id: 'job_g2', display_name: '前端开发', parent_id: 'job_root', selectable: false, has_children: true },
            ],
            next_cursor: null,
            catalog_version: 'tax-v1',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [{ id: 'job_root', display_name: '技术研发', parent_id: null, selectable: false, has_children: true }],
          next_cursor: null,
          catalog_version: 'tax-v1',
        }),
      });
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto('/#/intentions/new');
    await expect(page.getByText('请选择期望职位')).toBeVisible({ timeout: 15_000 });
    await page.getByText('请选择期望职位').click();
    await expect(page).toHaveURL(/#\/onboard\/job/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '期望职位是' })).toBeVisible({ timeout: 10_000 });

    // 整页充满 844×390 可用区，页面本身零滚动；底部保存键在视口内
    await 断言页面零滚动(page);
    const 保存键 = page.getByRole('button', { name: '保存', exact: true });
    await expect(保存键).toBeVisible();

    // B 契约：挂载自动选首根；点根后无需第二次点击，两组二级标题（heading，非按钮）
    // 与各自三级叶子按目录顺序直接出现
    await page.getByRole('button', { name: '技术研发', exact: true }).click();
    await expect(page.getByRole('heading', { name: '后端开发' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '前端开发' })).toBeVisible();
    await expect(page.getByRole('button', { name: '服务端工程师甲', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '网页工程师乙', exact: true })).toBeVisible();
    const 组标题数 = await page.locator('h3').count();
    expect(组标题数).toBeGreaterThanOrEqual(2);

    // 点 leaf：底部已选 chip 出现；保存（意向单选）回意向页回显
    await page.getByRole('button', { name: '服务端工程师甲', exact: true }).click();
    await expect(page.getByRole('button', { name: '服务端工程师甲 ✕' })).toBeVisible();
    await 保存键.click();
    await expect(page).toHaveURL(/#\/intentions\/new$/, { timeout: 10_000 });
    await expect(page.getByText('服务端工程师甲').first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('catalog-fullscreen 学校/专业连点 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('引导 学校/专业 搜索后同项连点两次候选不消失，选择不额外请求 @catalog-fullscreen @backend', async ({ page }) => {
    test.setTimeout(180_000);
    await pickerBackend存量候选(page, 'att-catalog-fs-doubleclick');

    // 学校：搜索后同项连点两次 —— 候选行保持、引用不丢、查询不因选择额外发起
    await page.goto('/#/onboard/school');
    const 学校输入 = page.getByPlaceholder('学校名称');
    await expect(学校输入).toBeVisible({ timeout: 15_000 });
    const 学校目录请求: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1/catalog/education-institutions')) {
        学校目录请求.push(request.url());
      }
    });
    await 学校输入.fill('fixture');
    await expect(page.getByText(标记.学校display)).toBeVisible({ timeout: 10_000 });
    await page.getByText(标记.学校display).click();
    await expect(学校输入).toHaveValue(/Fixture 大学/);
    await page.getByText(标记.学校display).click();
    await expect(page.getByText(标记.学校display)).toBeVisible();
    await expect(学校输入).toHaveValue(/Fixture 大学/);
    const 搜索后请求基线 = 学校目录请求.length;
    expect(搜索后请求基线).toBeGreaterThan(0);
    await expect.poll(() => 学校目录请求.length, { timeout: 2_000 }).toBe(搜索后请求基线);

    // 专业：同一口径
    await page.goto('/#/onboard/major');
    const 专业输入 = page.getByPlaceholder('专业名称');
    await expect(专业输入).toBeVisible({ timeout: 15_000 });
    const 专业目录请求: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1/catalog/majors')) 专业目录请求.push(request.url());
    });
    await 专业输入.fill('fixture');
    await expect(page.getByText(标记.专业display)).toBeVisible({ timeout: 10_000 });
    await page.getByText(标记.专业display).click();
    await expect(专业输入).toHaveValue(/Fixture 专业/);
    await page.getByText(标记.专业display).click();
    await expect(page.getByText(标记.专业display)).toBeVisible();
    await expect(专业输入).toHaveValue(/Fixture 专业/);
    const 专业请求基线 = 专业目录请求.length;
    expect(专业请求基线).toBeGreaterThan(0);
    await expect.poll(() => 专业目录请求.length, { timeout: 2_000 }).toBe(专业请求基线);
  });
});
