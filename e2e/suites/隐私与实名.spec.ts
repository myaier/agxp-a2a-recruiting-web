// e2e/suites/隐私与实名.spec.ts
// C6：原「P3 Backend 隐私主链路 / P3 Backend 恢复分派 / P3 Mock 数据源隔离 /
// 候选实名 Backend fixture」与裸 test「Mock 候选实名保持原型且零实名请求」迁入。
// P3 主链路按 C4 拆为披露读改回读 / 组织屏蔽解除 / 岗位硬性条件三个独立 Case。

import { expect, test } from '../fixtures/test';
import { 抽屉搜企业并选中, 走完后端发岗向导, 装三级职位目录桩, hash直达 } from '../fixtures/数据源交互';
import { P1C标记, P1C招聘组织Fixture, P1C管理员关系, P1C组织甲, 带企业关系 } from '../fixtures/bff/招聘组织';
import { P3标记, P3隐私fixture, P3默认组织库, 创建候选实名fixture, type 候选实名FixtureState } from '../fixtures/bff/隐私与实名';
import { 创建候选OnboardingFixture } from '../fixtures/bff/候选建档';
import { fixture简历, fixture意向列表 } from '../fixtures/bff/账号与目录';
import { P4深克隆 } from '../fixtures/bff/发现推荐';
import { 安装BFF路由 } from '../fixtures/bff/安装BFF路由';
import { type Page } from '@playwright/test';
import { type 拦截请求形 } from '../fixtures/bff/协议';


// ─────────────────────────────────────────────────────────────────────────────
// P3 隐私域主链路 @backend（Task 6；C4 拆分）：原单条 195 行长链按责任拆为三个独立
// Case —— 披露读改回读（会话水合 + 隐身开关 + 披露偏好稀疏补丁）、组织屏蔽与解除
// （真实目录 ID 搜索分页、选回填零写、幂等键与风险确认）、岗位硬性条件（切招聘方
// 固定水合链 + 发布四员完整 + 编辑空稀疏补丁）。各自初始化账号与 fixture 状态，
// 屏蔽链的 If-Match 从各自 fixture 的 revision 1 起算（原链内 3/4/6 是前序补丁累计）。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('P3 Backend 隐私主链路 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('P3 披露读改回读：会话水合并行读隐私，隐身开关与披露偏好走 If-Match 稀疏补丁 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture();
    const 请求们: 拦截请求形[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-disclosure',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
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
    await hash直达(page, '/#/settings');
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
    await hash直达(page, '/#/disclosure-prefs');
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
  });

  test('P3 组织屏蔽与解除：真实目录 ID 搜索分页、选回填零写、屏蔽幂等与风险确认 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P3默认组织库();
    const 请求们: 拦截请求形[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-blocklist',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    // 主壳挂载后再直达屏蔽名单（同披露 Case 口径：直达会被在飞的落点 replace 吞掉）
    await expect(page.getByRole('button', { name: '市场', exact: true })).toBeVisible({ timeout: 15_000 });

    // ── 屏蔽名单：先点「选择要屏蔽的公司」→ 抽屉搜组织（strict active 分页 + query 绑定游标）
    //    → 点命中只回填 → 点「屏蔽」才发生业务写入 ──
    await hash直达(page, '/#/blocklist');
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
    expect(屏蔽写们[0].headers['if-match']).toBe('"1"'); // 本 Case 独立 fixture：屏蔽是第一笔变更，If-Match 即当前 revision
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
    expect(解除们[0].headers['if-match']).toBe('"2"');
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
    expect(手动解除.headers['if-match']).toBe('"4"');
  });

  // ── 聊天推荐前端修复（Task 6 / 契约B 浏览器接线）：经历企业屏蔽开关跨页与部分保存
  //    失败。共享装配：存量候选（一条完整经历，挂手动组织甲）+ 隐私组织池。
  //    2026-09-17（Task 2/5，合同 A/B）：日常条目一次点击直达 `?section=work&item=…`
  //    编辑器（不再「点两次经历 → 完成 → 外层保存」），开关随同一次「保存」的完整链
  //    （隐私写 → 权威回读 → 存简历）落地；保护断言（写次数、来源/If-Match、跨页一致、
  //    partial failure 不重复）逐条保留。──
  const 组织甲编号 = 'org-fixture-p3-manual-a';
  async function 装存量候选并进经历编辑(
    page: Page,
    选项: { 登录尝试id: string; 覆盖?: Record<string, (body: unknown) => { status: number; 响应: unknown } | undefined>; 请求拦截?: (项: 拦截请求形) => void },
  ): Promise<{ fixture: ReturnType<typeof 创建候选OnboardingFixture>; 隐私: ReturnType<typeof P3隐私fixture> }> {
    const fixture = 创建候选OnboardingFixture();
    fixture.主体.last_used_role = 'candidate';
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选' },
      summary: '存量个人优势',
      experiences: [{
        id: 'exp-fixture-legacy',
        organization_id: 组织甲编号,
        company: P3标记.手动组织甲,
        industry: { id: 'ind-fixture-001', display_name: 'Fixture 行业' },
        title: '旧职务',
        start_month: '2019-01',
        end_month: '2021-12',
        description: '',
        hidden: true,
        internship: false,
        revision: 1,
        projects: null,
      }],
    };
    fixture.intentions = [P4深克隆(fixture意向列表.intentions[0])];
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P3默认组织库();
    await 安装BFF路由(page, {
      登录尝试id: 选项.登录尝试id,
      记录目录请求: () => undefined,
      候选OnboardingFixture: fixture,
      隐私fixture: 隐私,
      覆盖: 选项.覆盖,
      请求拦截: 选项.请求拦截,
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    // Task 1 契约B：旧经历 hidden=true 但无有效企业屏蔽 → 工作分区折叠卡不出「已隐身」徽标
    await hash直达(page, '/#/experience?from=resume&section=work');
    await expect(page.getByRole('button', { name: '工作经历' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('已对该公司隐身')).toHaveCount(0);
    // 日常条目直达（真实入口）：我的简历 → 经历行 → 该条编辑器（带合同 A 来路证明，
    // 保存/取消后退一格回我的简历）。不再经过聚合页，也没有第二次「总保存」。
    await hash直达(page, '/#/resume');
    await expect(page.getByText('我的简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button').filter({ hasText: P3标记.手动组织甲 }).click();
    await expect(page).toHaveURL(/#\/experience\?from=resume&section=work&item=exp-fixture-legacy$/, { timeout: 15_000 });
    await expect(page.getByRole('switch', { name: '对这家公司隐藏我的信息' })).toBeVisible({ timeout: 15_000 });
    return { fixture, 隐私 };
  }

  test('聊天推荐前端修复 经历企业屏蔽开关跨页：取消零写、保存走完整链、徽标与屏蔽名单同权威 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const 请求们: 拦截请求形[] = [];
    const { fixture, 隐私 } = await 装存量候选并进经历编辑(page, { 登录尝试id: 'att-cr-fix-block-cross', 请求拦截: (项) => 请求们.push(项) });

    // 开关绑定有效企业屏蔽：先开 → 「待保存」注记（不用「已」字样冒充生效）
    const 开关 = page.getByRole('switch', { name: '对这家公司隐藏我的信息' });
    await expect(开关).toHaveAttribute('aria-checked', 'false', { timeout: 15_000 });
    await 开关.click();
    await expect(page.getByText('待保存')).toBeVisible();
    // 取消（返回）：意图逐条还原、退一格回我的简历 —— 零隐私写、零简历写
    await page.getByRole('button', { name: '返回' }).click();
    await expect(page).toHaveURL(/#\/resume$/);
    expect(隐私.统计.屏蔽写入).toBe(0);
    expect(隐私.统计.补丁).toBe(0);
    expect(fixture.mutations).toEqual([]);

    // 重进该条：未提交意图不落权威，开关仍关（列表卡也不冒充已生效）
    await page.getByRole('button').filter({ hasText: P3标记.手动组织甲 }).click();
    const 开关二 = page.getByRole('switch', { name: '对这家公司隐藏我的信息' });
    await expect(开关二).toHaveAttribute('aria-checked', 'false', { timeout: 15_000 });
    await 开关二.click();
    await expect(page.getByText('待保存')).toBeVisible();

    // 保存：一次完整链（隐私写 → 权威回读 → 存简历）→ 回我的简历；简历本身零差异
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/resume$/, { timeout: 30_000 });
    expect(隐私.统计.屏蔽写入).toBe(1);
    expect(fixture.mutations).toEqual([]);
    // 屏蔽写的来源与并发控制逐字保留：manual 来源 + 幂等键 + 当前 revision 的 quoted If-Match
    const 屏蔽写 = 请求们.filter((项) => 项.path === '/api/v1/me/privacy/organization-blocks' && 项.method === 'POST');
    expect(屏蔽写).toHaveLength(1);
    expect(屏蔽写[0].body).toEqual({ organization_id: 组织甲编号, source: 'manual' });
    expect(屏蔽写[0].headers['idempotency-key']).toBeTruthy();
    expect(屏蔽写[0].headers['if-match']).toBe('"1"');
    // 折叠卡徽标按权威屏蔽派生（工作分区列表渲染同一份 经历区）
    await hash直达(page, '/#/experience?from=resume&section=work');
    await expect(page.getByText('已对该公司隐身')).toBeVisible({ timeout: 15_000 });
    // 跨页一致：屏蔽名单页读同一份权威事实 —— 手动分组在该公司在场
    await hash直达(page, '/#/blocklist');
    await expect(page.getByText(P3标记.手动组织甲).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('你手动添加')).toBeVisible();
  });

  test('聊天推荐前端修复 屏蔽部分保存失败：失败保留意图与简历草稿、零简历写，重试补齐不重复 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    let 拦屏蔽 = true;
    const { fixture, 隐私 } = await 装存量候选并进经历编辑(page, {
      登录尝试id: 'att-cr-fix-block-partial',
      覆盖: {
        // 首把屏蔽 POST 被 500 挡下（覆盖在域 handler 之前，不落 屏蔽写入 统计）
        'POST /api/v1/me/privacy/organization-blocks': () => {
          if (!拦屏蔽) return undefined;
          拦屏蔽 = false;
          return { status: 500, 响应: { error: { type: 'internal_error', message: '服务开小差了' } } };
        },
      },
    });

    const 开关 = page.getByRole('switch', { name: '对这家公司隐藏我的信息' });
    await expect(开关).toHaveAttribute('aria-checked', 'false', { timeout: 15_000 });
    await 开关.click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    // 失败就地提示：意图与简历草稿保留、未成功不假报成功；简历分区零写、按钮回到可重试
    await expect(page.getByText(/企业屏蔽未保存/)).toBeVisible({ timeout: 15_000 });
    await expect(page).not.toHaveURL(/#\/resume$/);
    await expect(page.getByText('待保存')).toBeVisible();
    expect(隐私.统计.屏蔽写入).toBe(0);
    expect(fixture.mutations).toEqual([]);
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();

    // 重试：核对权威后补齐唯一未达成项 → 成功回我的简历，徽标按权威派生
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/resume$/, { timeout: 30_000 });
    expect(隐私.统计.屏蔽写入).toBe(1);
    await hash直达(page, '/#/experience?from=resume&section=work');
    await expect(page.getByText('已对该公司隐身')).toBeVisible({ timeout: 15_000 });
    expect(fixture.mutations).toEqual([]); // 简历本身零差异：整链不写简历
  });

  // Step 4 required 反例（Spec §11.2.4/§11.2.5）：屏蔽已成功、简历写失败 —— 已成功项不得
  // 被撤销或重放，留页可重试，重试只补未达成的那一项（经历 PATCH）。
  test('Onboarding简历修正 屏蔽成功但经历 PATCH 失败：留页保留待重试，重试只补经历 PATCH @backend', async ({ page }) => {
    test.setTimeout(120_000);
    let 拦经历 = true;
    const { fixture, 隐私 } = await 装存量候选并进经历编辑(page, {
      登录尝试id: 'att-onr-block-ok-resume-fail',
      覆盖: {
        // 首把经历 PATCH 被 500 挡下（屏蔽 POST 先成功，本反例考的是「写简历失败」）
        'PATCH /api/v1/me/resume/experiences/exp-fixture-legacy': () => {
          if (!拦经历) return undefined;
          拦经历 = false;
          return { status: 500, 响应: { error: { type: 'internal_error', message: '服务开小差了' } } };
        },
      },
    });

    const 开关 = page.getByRole('switch', { name: '对这家公司隐藏我的信息' });
    await expect(开关).toHaveAttribute('aria-checked', 'false', { timeout: 15_000 });
    await 开关.click();
    // 改职位制造简历差异：这次保存必须真的尝试写简历
    await page.getByPlaceholder('必填').fill('旧职务·屏蔽后写失败');
    await page.getByRole('button', { name: '保存', exact: true }).click();

    // 屏蔽已成功（恰一次）、简历写失败：留页、提示失败、按钮可重试
    await expect(page.getByText(/后端服务暂时不可用/)).toBeVisible({ timeout: 15_000 });
    await expect(page).not.toHaveURL(/#\/resume$/);
    expect(隐私.统计.屏蔽写入).toBe(1);
    const 经历写们 = () => fixture.mutations.filter(
      (条) => 条.method === 'PATCH' && 条.path === '/api/v1/me/resume/experiences/exp-fixture-legacy',
    );
    expect(经历写们()).toHaveLength(0); // 500 不落 fixture 写入
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
    // 已成功的屏蔽不冒充「待保存」，也不被回滚：权威回读后开关仍是开、意图已移除
    await expect(page.getByText('待保存')).toHaveCount(0);
    await expect(开关).toHaveAttribute('aria-checked', 'true');

    // 重试：只补经历 PATCH —— 屏蔽写次数不增（不重放已成功项），成功后回我的简历
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/resume$/, { timeout: 30_000 });
    expect(隐私.统计.屏蔽写入).toBe(1);
    const 成功写 = 经历写们();
    expect(成功写).toHaveLength(1);
    expect(成功写[0]!.body).toMatchObject({ hidden: true, title: '旧职务·屏蔽后写失败' });
    // 权威派生：分区列表徽标仍显示已隐身（成功事实保留）
    await hash直达(page, '/#/experience?from=resume&section=work');
    await expect(page.getByText('已对该公司隐身')).toBeVisible({ timeout: 15_000 });
  });

  test('P3 岗位硬性条件：切招聘方固定水合链，发布四员完整、编辑空稀疏补丁 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P3默认组织库();
    const 请求们: 拦截请求形[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-job-hard-reqs',
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
    // 发布岗位的职位类别走真三级目录（一级自动展开 → 二级标题 + 三级叶子）
    await 装三级职位目录桩(page);
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: '市场', exact: true })).toBeVisible({ timeout: 15_000 });

    // ── 切招聘方：固定组织水合链，候选侧隐私先行清空 ──
    await hash直达(page, '/#/identity?switch=1&from=app');
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
    await hash直达(page, '/#/hr/post-job/job-fixture-created-1');
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
    await hash直达(page, '/#/settings');
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
    await hash直达(page, '/#/disclosure-prefs');
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

    await hash直达(page, '/#/blocklist');
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

    await hash直达(page, '/#/blocklist');
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
    await hash直达(page, '/#/blocklist');
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
    await hash直达(page, '/#/blocklist');
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
    await hash直达(page, '/#/blocklist');
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
    await hash直达(page, '/#/blocklist');
    await expect(page.getByText('Fixture 旧世界公司')).toBeVisible({ timeout: 10_000 });

    // 触发一次带挂起重读的冲突（重读将在旧会话登出后才被放行）
    await hash直达(page, '/#/disclosure-prefs');
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
    await hash直达(page, '/#/blocklist');
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
    await hash直达(page, '/#/settings');
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
    await hash直达(page, '/#/disclosure-prefs');
    const Mock学历不披露 = page.getByRole('button', { name: '毕业院校与学历：不披露', exact: true });
    await expect(page.getByRole('button', { name: '毕业院校与学历：一直允许', exact: true })).toBeVisible({ timeout: 10_000 });
    await Mock学历不披露.click();
    await expect(Mock学历不披露).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
    expect(apiRequests).toEqual([]);

    // 屏蔽名单：自由文本本地加入（Mock 无组织搜索段）
    await hash直达(page, '/#/blocklist');
    const 添加框 = page.getByPlaceholder('输入公司全称，如「某某科技」');
    await expect(添加框).toBeVisible({ timeout: 10_000 });
    await 添加框.fill('本地测试屏蔽公司');
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();
    await expect(page.getByText('已屏蔽 本地测试屏蔽公司，双向不可见')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('本地测试屏蔽公司').first()).toBeVisible();
    expect(apiRequests).toEqual([]);

    // 发岗屏（Mock 本地向导）：到达 + 第一步本地校验照常运转
    await hash直达(page, '/#/hr/post-job');
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
    await hash直达(page, '/#/settings');
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
    await hash直达(page, '/#/settings');
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

  await hash直达(page, '/#/settings');
  const 实名行 = page.getByRole('button', { name: /实名认证.*已认证/ });
  await expect(实名行).toBeVisible({ timeout: 10_000 });
  await 实名行.click();
  await expect(page.getByText('实名认证 · 已通过，无需重复认证')).toBeVisible();

  // 直达实名路由：Mock 由页面自身 replace 回候选设置页（预期重定向，不用 hash直达）
  await page.goto('/#/settings/identity-verification');
  await expect(page.getByRole('button', { name: /实名认证.*已认证/ })).toBeVisible({ timeout: 10_000 });
  expect(实名请求).toEqual([]);
});
