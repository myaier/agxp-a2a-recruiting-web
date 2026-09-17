// e2e/suites/发现推荐.spec.ts
// C6：原「P4 发现推荐域 fixture @backend / P4 Mock 数据源隔离 @mock」等价迁入。

import { expect, test } from '../fixtures/test';
import { 装P4候选, 装P4招聘, 左滑候选卡, 断言核心页无横向溢出, 断言纵序, hash直达 } from '../fixtures/数据源交互';
import { 信封 } from '../fixtures/bff/协议';
import { 安装BFF路由 } from '../fixtures/bff/安装BFF路由';
import { P1C标记, P1C招聘组织Fixture, P1C管理员关系, P1C组织甲, 带企业关系 } from '../fixtures/bff/招聘组织';
import { P3隐私fixture } from '../fixtures/bff/隐私与实名';
import { P4编号, P4标记, P4补充编号, P4CandidateJob, P4候选卡, P4意向, P4招聘岗位, P4招聘卡, P4发现fixture } from '../fixtures/bff/发现推荐';
import { P2新附件, 创建P2附件fixture } from '../fixtures/bff/附件';
import { 创建P5MatchCasefixture } from '../fixtures/bff/MatchCase';
import { type Page } from '@playwright/test';

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
    await 装P4候选(page, {
      // 详情页按 hiring_organization_ref 补读公开企业（e8fe4d53 起的既有局部状态）：
      // 本用例原本不声明该坐标 —— 补读在飞时上下文先关闭则边界看不到，赶在 teardown
      // 前到 handler 则记未声明请求（与并行负载相关，间歇翻红）。按 DF-011 同款修法
      // 按坐标显式声明空应答（只修测试定义，不改产品）；公司名断言吃 claim 文案，
      // 不受公开企业补读的空应答影响。
      覆盖: {
        'GET /api/v1/organizations/org-fixture-p4': () => ({ status: 200, 响应: 信封(null) }),
      },
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

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
    await 装P4候选(page, {
      fixture: 空推荐fixture,
      // 岗位详情按 hiring_organization_ref 补读公开企业（org-fixture-p4 只有 P4 侧声明，
      // 无组织域 fixture）：按坐标显式声明空应答 → strict decode 拒绝 → 企业块出错误/占位态
      //（与 账号与支持「P8 举报屏蔽暂不可用」同款修法，只修测试定义，不改产品）。
      覆盖: {
        'GET /api/v1/organizations/org-fixture-p4': () => ({ status: 200, 响应: 信封(null) }),
      },
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    // 直接进详情：无任何快照 → GET 单个 CandidateJob（canonical job GET）
    await hash直达(page, `/#/job/${P4编号.job}`);
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
    await 装P4候选(page, {
      fixture,
      // 岗位详情按 hiring_organization_ref 补读公开企业（org-fixture-p4 只有 P4 侧声明，
      // 无组织域 fixture）：按坐标显式声明空应答 → strict decode 拒绝 → 企业块出错误/占位态
      //（与 账号与支持「P8 举报屏蔽暂不可用」同款修法，只修测试定义，不改产品）。
      覆盖: {
        'GET /api/v1/organizations/org-fixture-p4': () => ({ status: 200, 响应: 信封(null) }),
      },
    });

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
    await hash直达(page, '/#/hr/screened-out');
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
    await hash直达(page, '/#/hr');
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
    await hash直达(page, `/#/job/${P4补充编号.未知岗位}`);
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
    await hash直达(page, `/#/hr/resume/${P4补充编号.未知推荐}`);
    await expect(page.getByText('链接已失效，请从对应岗位推荐列表重新打开')).toBeVisible({ timeout: 15_000 });
    expect(请求序.some((项) => 项.includes(`/candidate-recommendations/${P4补充编号.未知推荐}`))).toBe(false);
    await expect(page.getByText(P4标记.candidateAlias)).toHaveCount(0);
    await expect(page.getByText('江叙白')).toHaveCount(0);
  });

  // ── S0–S3 展示统一 Task 7（原 S0-S3 展示统一 Backend 端用例迁入 P4 域）──
  // 聊天推荐前端修复（Task 5/6 起）：独立匿名简历 Backend 详情的匹配区是唯一
  // 「匹配度分析」+ 六行有限依据（缺码「未提供判定」，无独立「推荐依据」标题、
  // 无「暂无推荐依据 / 暂无逐条匹配证据」空分析区）。
  test('独立匿名简历 Backend canonical 深链：安全简历缺区保留标题、唯一匹配度分析六行在位、遮蔽公司不披露 @backend @s0-s3-display', async ({ page }) => {
    await 装P4招聘(page);
    // P4 独立匿名简历只吃 canonical 双坐标深链（旧 /hr/resume/:id 在 Backend 已是失效页）
    await page.goto(`/#/hr/jobs/${P4编号.recruiterJob}/recommendations/${P4编号.recruiterRecommendation}`);
    await expect(page.getByText('个人优势').first()).toBeVisible({ timeout: 20_000 });

    // S0–S3 展示统一（R1）：显式 完整布局 → 匹配区标题保留，不整区消失；
    // Task 5：默认卡只有薪资 overlap 一个正向码 —— 其余五行「未提供判定」，
    // 附统一说明；原「推荐依据」区与缺失文案随六行模型退役，不伪造分数
    await expect(page.getByText('匹配度分析')).toBeVisible();
    await expect(page.getByText('薪资 · 薪资带有交集')).toBeVisible();
    await expect(page.getByText('方向 · 未提供判定')).toBeVisible();
    await expect(page.getByText('技能 · 未提供判定')).toBeVisible();
    await expect(page.getByText('当前接口仅提供部分匹配依据')).toBeVisible();
    await expect(page.getByText('推荐依据', { exact: true })).toHaveCount(0);
    await expect(page.getByText('暂无推荐依据')).toHaveCount(0);
    await expect(page.getByText('暂无逐条匹配证据')).toHaveCount(0);
    await expect(page.getByText('distributed_systems')).toHaveCount(0);
    // 非空安全简历照旧：项目整区在（后端有项目即出）、遮蔽公司给「未披露」
    await expect(page.getByText('项目经历')).toBeVisible();
    await expect(page.getByText('P4 Fixture 项目')).toBeVisible();
    await expect(page.getByText('未披露')).toBeVisible();
    await expect(page.getByText('P4 fixture 自我描述')).toBeVisible();
    // 页面默认控件：P4 底栏委托键与匿名尾注（无直聊）原样
    await expect(page.getByRole('button', { name: '让AI代理去谈' })).toBeVisible();
    await expect(page.getByText('由AI代理匿名接触 · 意向确认前双方保持匿名 · 不可转发')).toBeVisible();
    await 断言核心页无横向溢出(page);
    await page.screenshot({ path: 'test-results/S0S3展示统一/bk-独立匿名简历-390.png', fullPage: true });
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

  // ── DF-011：双端独立详情匹配区内联「推荐依据」──
  test('DF-011：双端独立详情展示已有中文原因（无原码、无第二分数环、换记录清旧、直取真实缺失）@backend @dogfood-frontend', async ({ page }) => {
    test.setTimeout(120_000);
    const 请求序: string[] = [];
    const fixture = P4发现fixture();
    // 只在本例覆盖原因数据（不改共享默认）：双端各给已知四码（带重复与未知码）；
    // 乙 / 备选岗位没有推荐上下文 —— 用于换记录不残留与直取的真实缺失状态
    fixture.候选推荐 = {
      [P4编号.intention]: [P4候选卡({
        match_reasons: ['category_matched', 'location_matched', 'category_matched', 'direction_match'],
      })],
    };
    fixture.候选岗位 = {
      ...fixture.候选岗位,
      [P4补充编号.备选岗位]: P4CandidateJob({ job_id: P4补充编号.备选岗位, title: 'P4 Fixture 备选岗位' }),
    };
    fixture.招聘可用 = {
      [P4编号.recruiterJob]: [
        P4招聘卡({ highlights: ['category_matched', 'location_matched', 'category_matched', 'distributed_systems'] }),
        P4招聘卡({
          recommendation_id: P4补充编号.招聘候选乙,
          candidate_alias: 'P4候选乙', rank: 2, match_score: 76, highlights: [],
        }),
      ],
    };
    // 双端单用例：与 装P5双角色 同一模式 —— 组织 fixture 的招聘主体起步 + 隐私 fixture
    // （切回候选端要交互式水合，me/privacy 缺席域兜底会让整轮水合被第一错误挡住）
    await 安装BFF路由(page, {
      登录尝试id: 'att-p4-df011',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(
        P1C招聘组织Fixture,
        [P1C管理员关系],
        { [P1C标记.组织甲编号]: P1C组织甲() },
        [P4招聘岗位()],
      ),
      主体初始角色: 'recruiter',
      发现fixture: fixture,
      隐私fixture: P3隐私fixture(),
      // 详情直取按 hiring_organization_ref 补读公开企业：与既有 @backend 用例同一修法，
      // 按坐标显式声明空应答（只修测试定义，不改产品）。
      覆盖: {
        'GET /api/v1/organizations/org-fixture-p4': () => ({ status: 200, 响应: 信封(null) }),
      },
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    // ── 招聘端：推荐列表 → 独立匿名简历 ──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    await expect(page.getByRole('img', { name: P4标记.candidateRing }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '查看候选画像' }).first().click();
    await expect(page).toHaveURL(new RegExp(`#/hr/jobs/${P4编号.recruiterJob}/recommendations/${P4编号.recruiterRecommendation}$`));
    // Task 5：唯一「匹配度分析」+ 六行有限依据（正向码行勾选在位），无独立「推荐依据」区
    await expect(page.getByText('匹配度分析')).toBeVisible({ timeout: 15_000 });
    // 已有中文原因上屏：重复只展示一次、原 token 不透出不猜词义
    await expect(page.getByText('职位方向匹配')).toHaveCount(1);
    await expect(page.getByText('工作地点匹配')).toHaveCount(1);
    await expect(page.getByText('category_matched')).toHaveCount(0);
    await expect(page.getByText('distributed_systems')).toHaveCount(0);
    // 分数只有顶栏一个位置：正文无第二分数环；缺码行「未提供判定」+ 统一说明在位
    await expect(page.getByRole('img', { name: /适配/ })).toHaveCount(0);
    await expect(page.getByText('当前接口仅提供部分匹配依据')).toBeVisible();
    // 位置：匹配区在画像之后、个人优势之前
    await 断言纵序(page, ['P4 本科', '匹配度分析', '职位方向匹配', '个人优势']);

    // 导航另一记录（无已知原因的乙）：旧原因立即清除，六行全部转为未提供判定
    await hash直达(page, `/#/hr/jobs/${P4编号.recruiterJob}/recommendations/${P4补充编号.招聘候选乙}`);
    await expect(page.getByText('匹配度分析')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('方向 · 未提供判定')).toBeVisible();
    await expect(page.getByText('职位方向匹配')).toHaveCount(0);

    // ── 切到求职端：推荐列表 → 独立职位详情 ──
    await hash直达(page, '/#/identity?switch=1&from=hr');
    await page.getByRole('button', { name: '翻到「求职者」那一面' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await expect(page.getByText(P4标记.jobTitle).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '查看职位详情' }).first().click();
    await expect(page).toHaveURL(new RegExp(`#/job/${P4编号.job}$`));
    await expect(page.getByText('推荐依据').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('职位方向匹配')).toHaveCount(1);
    await expect(page.getByText('工作地点匹配')).toHaveCount(1);
    await expect(page.getByText('direction_match')).toHaveCount(0);
    // 候选端核对环是唯一分数环：原因说明不新增第二个环，核对行照常
    await expect(page.getByRole('img', { name: /适配/ })).toHaveCount(1);
    await 断言纵序(page, [P4标记.jobTitle, '职位方向匹配', '岗位信息与职位详情']);

    // 直接详情无推荐上下文：真实缺失状态（暂无推荐依据 + 无分缺位），不借上一条记录的原因
    await hash直达(page, `/#/job/${P4补充编号.备选岗位}`);
    await expect(page.getByText('P4 Fixture 备选岗位').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('暂无推荐依据')).toBeVisible();
    await expect(page.getByRole('img', { name: '匹配分未知' })).toBeVisible();
    await expect(page.getByText('职位方向匹配')).toHaveCount(0);

    // 网络中不增加推荐刷新或 Case 补读请求：Case 域只允许主壳水合的摘要读，
    // 绝无逐 Case 详情补读；推荐刷新 POST 全程为零
    const Case读们 = 请求序.filter((项) => 项.includes('/match-cases') || 项.includes('/negotiations'));
    const 主壳摘要读 = new Set([
      'GET /api/v1/me/match-cases/summary',
      'GET /api/v1/recruiter/match-cases',
      'GET /api/v1/me/negotiations',
    ]);
    for (const 读 of Case读们) expect(主壳摘要读.has(读)).toBe(true);
    expect(请求序.filter((项) => 项.startsWith('POST') && 项.includes('refresh'))).toEqual([]);
  });

  test('聊天推荐前端修复 推荐详情唯一六维有限依据：正向码勾行、未确认经验不冒进、薪资部分匹配 @backend', async ({ page }) => {
    const fixture = P4发现fixture();
    // 五码齐但经验未确认 + 薪资 near_miss：六行各自按契约 C 落态，不拼造一致性
    fixture.招聘可用 = {
      [P4编号.recruiterJob]: [
        P4招聘卡({
          highlights: ['category_matched', 'skills_matched', 'experience_met', 'location_matched', 'workplace_mode_matched'],
          structured_requirements_confirmed: false,
          compensation_relationship: 'near_miss',
        }),
      ],
    };
    await 装P4招聘(page, { fixture });

    await page.goto(`/#/hr/jobs/${P4编号.recruiterJob}/recommendations/${P4编号.recruiterRecommendation}`);
    await expect(page.getByText('个人优势').first()).toBeVisible({ timeout: 20_000 });
    // 唯一「匹配度分析」标题：六行固定在位 —— 正向行按码落文案、skills 只说「有技能命中」、
    // 经验缺确认给「未提供判定」（不把缺确认当不匹配）、near_miss 标部分匹配
    await expect(page.getByText('匹配度分析')).toHaveCount(1);
    await expect(page.getByText('方向 · 职位方向匹配')).toBeVisible();
    await expect(page.getByText('技能 · 有技能命中')).toBeVisible();
    await expect(page.getByText('经验 · 未提供判定')).toBeVisible();
    await expect(page.getByText('地点 · 工作地点匹配')).toBeVisible();
    await expect(page.getByText('办公方式 · 办公方式匹配')).toBeVisible();
    await expect(page.getByText('薪资 · 薪资带接近，部分匹配')).toBeVisible();
    // 行尾统一说明一次；原 token 不透出；无独立「推荐依据」区、无第二分数环
    await expect(page.getByText('当前接口仅提供部分匹配依据')).toHaveCount(1);
    await expect(page.getByText('skills_matched')).toHaveCount(0);
    await expect(page.getByText('experience_met')).toHaveCount(0);
    await expect(page.getByText('compensation_near_miss')).toHaveCount(0);
    await expect(page.getByText('推荐依据', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('img', { name: /适配/ })).toHaveCount(0);
    // 位置：匹配区在画像之后、个人优势之前
    await 断言纵序(page, ['P4 本科', '匹配度分析', '方向 · 职位方向匹配', '个人优势']);
    await 断言核心页无横向溢出(page);
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
    await hash直达(page, '/#/app');
    await page.getByRole('button', { name: '市场', exact: true }).click();
    // Mock 市场列表的后端工程师卡片（老虎国际 M-11 / PingCAP M-12）
    await expect(page.getByText('交易系统资深工程师')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '查看职位详情' }).first().click();
    await expect(page).toHaveURL(/#\/job\//);
    await expect(page.getByText('交易系统资深工程师')).toBeVisible();
    await hash直达(page, '/#/app');
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await page.getByRole('button', { name: '让AI代理去谈' }).first().click();
    await expect(page.getByText('AI代理已接手').first()).toBeVisible({ timeout: 10_000 });

    // ── 招聘端：切身份 → 推荐列表 → 候选详情 → 收藏 / 淘汰 / 委托 ──
    await hash直达(page, '/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
    await hash直达(page, '/#/hr');
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
    await hash直达(page, '/#/hr');
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

  // ── S0–S3 展示统一 Task 7（原 S0-S3 展示统一 Mock 端用例迁入 P4 域）──
  test('独立匿名简历 Mock 默认行为保持：空项目整区不出、无缺失占位、非空照旧 @mock @s0-s3-display', async ({ page }) => {
    // Mock 招聘端登录（与既有 @mock 双端旅程同口径）
    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);
    await hash直达(page, '/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });

    // A-02 档项目为空：独立页默认（不传 完整布局）→ 空项目整区不出，也不出缺失占位
    await page.goto('/#/hr/resume/A-02');
    await expect(page.getByText('工作经历').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('恒生电子').first()).toBeVisible(); // 非空经历照旧上屏
    await expect(page.getByText('项目经历')).toHaveCount(0);
    await expect(page.getByText('暂无项目经历')).toHaveCount(0);
    await expect(page.getByText('项目经历缺失')).toHaveCount(0);
    await expect(page.getByText('匹配分析缺失')).toHaveCount(0); // 缺区保留标题 = false：匹配区不摆缺失说明
    await expect(page.getByRole('button', { name: '让AI代理去谈' })).toBeVisible(); // 页面默认控件原样
    await 断言核心页无横向溢出(page);

    // A-01 档项目非空：同一默认版式下整区照旧渲染（默认行为未被详情统一改动）
    await page.goto('/#/hr/resume/A-01');
    await expect(page.getByText('项目经历').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('交易中台 0→1 重建 · 主导')).toBeVisible();
    await expect(page.getByText('项目经历缺失')).toHaveCount(0);
    await 断言核心页无横向溢出(page);
    await page.screenshot({ path: 'test-results/S0S3展示统一/mock-独立匿名简历-390.png', fullPage: true });
  });
});
