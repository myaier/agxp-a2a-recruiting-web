// e2e/suites/候选建档.spec.ts
// C6：原「候选 onboarding Backend fixture @backend」等价迁入。
// 本 Suite 家族另含 e2e/onboarding.spec.ts 的候选侧叶子（文件级并集，见该文件头）。

import { expect, test } from '../fixtures/test';
import { 装三级职位目录桩, 抽屉搜企业并选中, 走向导薪资 } from '../fixtures/数据源交互';
import { 标记 } from '../fixtures/bff/账号与目录';
import { P3标记, P3隐私fixture, P3默认组织库 } from '../fixtures/bff/隐私与实名';
import { 创建候选OnboardingFixture, type 候选OnboardingFixture } from '../fixtures/bff/候选建档';
import { 安装BFF路由 } from '../fixtures/bff/安装BFF路由';

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
