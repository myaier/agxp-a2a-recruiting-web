// e2e/suites/岗位编辑.spec.ts
// C6：原「核心编辑 岗位 @mock / @backend」两 describe 迁入；两 Case 各按 C4 拆出
// 「编辑公开/私有字段与确认撤销」独立日常编辑 Case（各自构造目标状态）。

import { expect, test } from '../fixtures/test';
import { 抽屉搜企业并选中, hash直达 } from '../fixtures/数据源交互';
import { 信封 } from '../fixtures/bff/协议';
import { 标记 } from '../fixtures/bff/账号与目录';
import { P1C标记, P1C岗位, P1C招聘组织Fixture, P1C管理员关系, P1C组织甲, 带企业关系 } from '../fixtures/bff/招聘组织';
import { P3隐私fixture, P1C搜索池 } from '../fixtures/bff/隐私与实名';
import { 安装BFF路由 } from '../fixtures/bff/安装BFF路由';

// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 岗位 @mock（core editors §5.2/§5.4 Task 4）：职位类别两栏与结构化确认门
// 两模式共用 —— Mock 用本地职业分类树驱动同一分类正文（左栏一级导航、右栏二级分组
// 标题 + 三级可选岗位、关闭重开保留选中勾）；确认勾选框出现在公开要求之后、私有筛选之前，新建未确认
// 发布被拦、勾选可发布；真实改经验撤销确认、改私有筛选不撤销；编辑 legacy 岗
// 只改私有字段不勾选也能保存，改公开要求需重新确认。全程零 /api/v1 请求。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 岗位 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('新建分类→确认门→发布进本地列表 @catalog-fullscreen @mock', async ({ page }, testInfo) => {
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
    await hash直达(page, '/#/hr/post-job');
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
  });

  // C4 拆分：日常编辑目标是 Mock 既有 legacy 岗 P-01（无确认事实 = 未确认），
  // 不依赖上一 Case 发布出的新岗位。
  test('编辑 legacy 岗：私有筛选不撤确认、改公开要求撤销、重新确认后保存 @mock', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要招人' }).click();
    await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 15_000 });

    // 编辑 legacy 岗 P-01（Mock 无确认事实 = 未确认）：只改私有筛选，不勾选也能保存
    await hash直达(page, '/#/hr/post-job/P-01');
    await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue('资深后端工程师 · 交易网关', { timeout: 15_000 });
    await page.getByRole('button', { name: '职位要求' }).click();
    // iPhone 13 viewport 检查（编辑屏）：无横向溢出、输入可聚焦、保存不被遮挡
    //（原长 Case :6262-6267 的既有断言，随 C4 拆分在本 Case 恢复）
    const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(溢出).toBeLessThanOrEqual(2);
    const 要求框 = page.getByLabel('岗位要求');
    await 要求框.focus();
    await expect(要求框).toBeFocused();
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible();
    const 编辑确认框 = page.getByRole('checkbox', { name: /我已确认经验和学历设置将作为自动匹配依据/ });
    await expect(编辑确认框).not.toBeChecked({ timeout: 15_000 });
    await page.getByRole('textbox', { name: '给 AI 代理的筛选要求' }).fill('偏好有 AI 产品背景，重项目管理');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('岗位已保存').first()).toBeVisible({ timeout: 15_000 });

    // 改公开要求：撤销确认 → 保存被拦 → 重新确认后保存
    await hash直达(page, '/#/hr/post-job/P-01');
    await page.getByRole('button', { name: '职位要求' }).click();
    await expect(page.getByRole('checkbox', { name: /我已确认经验和学历设置将作为自动匹配依据/ })).not.toBeChecked({ timeout: 15_000 });
    await page.getByLabel('岗位要求').fill('5 年以上后端经验，熟悉交易系统与撮合链路');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('请确认经验和学历将作为自动匹配依据').first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('checkbox', { name: /我已确认经验和学历设置将作为自动匹配依据/ }).check();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('岗位已保存').first()).toBeVisible({ timeout: 15_000 });
    // 重进回读：改过的岗位要求与私有筛选都保留
    await hash直达(page, '/#/hr/post-job/P-01');
    await page.getByRole('button', { name: '职位要求' }).click();
    await expect(page.getByLabel('岗位要求')).toHaveValue('5 年以上后端经验，熟悉交易系统与撮合链路', { timeout: 15_000 });
    await expect(page.getByRole('textbox', { name: '给 AI 代理的筛选要求' })).toHaveValue('偏好有 AI 产品背景，重项目管理');

    // Mock 全程零 API 请求
    expect(apiRequests).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 核心编辑 岗位 @backend（core editors §5.2/§5.4 Task 4；2026-09-17 Spec §4.2 三级
// 自动展开）：Backend 分支消费同一分类正文 —— 打开一级即自动出现该一级的二级分组
// 标题（h3，不是按钮）与各组三级可选职位；组内「加载更多」按组续页；无子项的分组
// 呈现空态且零目录请求（与「失败 + 重试」可区分）；禁用叶子保留展示但不提交；同名
// 叶子按稳定 ID 提交。确认门两模式同位同文案，新建未确认发布被拦；编辑 hydrated
// confirmed 岗改公开要求撤销确认，稀疏补丁只带变化字段。
// job-categories 目录用本用例专用网络桩（后装 route 先匹配，不改共享 helper）；
// 符合已审合同的网络桩边界验证，不是 live 验收。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('核心编辑 岗位 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('新建三级分类（一级自动展开/组内分页/空组零请求/禁用叶不提交）→确认门→发布，同名叶子按稳定 ID 提交 @catalog-fullscreen @backend', async ({ page }, testInfo) => {
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

    // job-categories 目录桩（本用例专用精确状态，真三级）：根『同名类』不可选 →
    // 二级两组：『中转分组』(不可选,有子项,组内还有下一页) 与『死端分组』
    // (不可选,无子项 → 空态且零请求)；『中转分组』三级第一页 = 与根同名的可选叶子
    // 『同名类』+ 禁用叶子『禁用职位』(不可选) → 游标页『分页叶子』。
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
      if (parentId === 'root_same') {
        return 页([
          税目('branch_mid', '中转分组', 'root_same', false, true),
          税目('branch_dead', '死端分组', 'root_same', false, false),
        ], null);
      }
      if (parentId === 'branch_mid' && cursor === 'leaf_cur_1') {
        return 页([税目('leaf_page', '分页叶子', 'branch_mid', true, false)], null);
      }
      if (parentId === 'branch_mid') {
        return 页([
          税目('leaf_same', '同名类', 'branch_mid', true, false),
          税目('leaf_disabled', '禁用职位', 'branch_mid', false, false),
        ], 'leaf_cur_1');
      }
      return 页([税目('root_same', '同名类', null, false, true)], null);
    });

    // 存量招聘会话经应用内入口进名片（注册流入口会被已完成账号守卫弹回企业主壳）：
    // 名片编辑保存 → 发岗向导
    await hash直达(page, '/#/hr/card');
    await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('姓名').fill('林澈');
    await page.getByLabel('职务').fill('招聘负责人');
    await page.getByRole('button', { name: '未选择公司' }).click();
    await 抽屉搜企业并选中(page, '云衢科技', P1C标记.组织甲名);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('保存成功')).toBeVisible({ timeout: 20_000 });
    await hash直达(page, '/#/hr/post-job');

    // ── 第一步：共用正文的三级语义 —— 一级打开即出二级标题与三级叶子；组内分页；
    //    无子项分组零请求的空态；禁用叶不提交；同名叶子按稳定 ID ──
    const 职位类别行 = page.getByRole('button').filter({ hasText: '职位类别' });
    await 职位类别行.click();
    // editor-catalog-fullscreen Task 1：承载换成全屏选择外壳，可访问名 = 标题「职位类别」
    const 类别弹层 = page.getByRole('dialog', { name: '职位类别' });
    // 一级自动展开：二级分组以 h3 标题呈现（绝不是按钮），组内三级叶子同屏可选
    const 分组标题 = 类别弹层.getByRole('heading', { level: 3, name: '中转分组' });
    await expect(分组标题).toBeVisible({ timeout: 10_000 });
    expect(await 分组标题.evaluate((元) => 元.closest('button') !== null)).toBe(false);
    await expect(类别弹层.getByRole('button', { name: '同名类', exact: true }).last()).toBeVisible();
    await page.screenshot({ path: `${testInfo.outputPath()}-核心编辑-岗位-分类正常.png`, fullPage: true });
    // 无子项分组（has_children=false）：空态与「失败 + 重试」可区分，且从不发该组的目录请求
    await expect(类别弹层.getByRole('heading', { level: 3, name: '死端分组' })).toBeVisible();
    await expect(类别弹层.getByText('该分组暂无职位')).toBeVisible();
    expect(目录请求.filter((条) => 条.includes('parent_id=branch_dead'))).toEqual([]);
    // 禁用叶（不可选）保留展示但不提交：force 触发与用户指针点击等价的事件后仍在层内，
    // 且整层没有出现选中勾（全屏子视图期间父页字段整体 hidden，回填断言在关层后做）
    const 禁用叶 = 类别弹层.getByRole('button', { name: '禁用职位', exact: true });
    await expect(禁用叶).toHaveAttribute('aria-disabled', 'true');
    await 禁用叶.click({ force: true });
    await expect(类别弹层).toBeVisible();
    await expect(类别弹层.locator('[class*="小类勾"]')).toHaveCount(0);
    // 组内分页：该组自己的「加载更多」按组续页追加游标页（右栏整栏无多余分页键）
    await expect(类别弹层.getByRole('button', { name: '加载更多', exact: true })).toHaveCount(1);
    await 类别弹层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(类别弹层.getByRole('button', { name: '分页叶子', exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(类别弹层.getByRole('button', { name: '加载更多', exact: true })).toHaveCount(0);
    // 同名叶子（与左栏根同名不同键）单击选定：单选、回填并关闭
    await 类别弹层.getByRole('button', { name: '同名类', exact: true }).last().click();
    await expect(类别弹层).toHaveCount(0);
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


    // 本会话目录请求只打 job-categories（根 → 当前一级二级 → 该组三级首页与续页），
    // 且无子项分组从未产生请求（断言见上方）
    expect(目录请求.length).toBeGreaterThan(0);
  });

  // C4 拆分：日常编辑目标是独立 fixture 预置的 hydrated confirmed 岗（P1C岗位()，
  // structured_requirements_confirmed=true、revision 1），不再依赖本文件上一 Case 的发布产物。
  test('编辑 hydrated confirmed 岗：改公开要求撤销确认，稀疏补丁只带变化字段 @backend', async ({ page }) => {
    const 请求们: { path: string; method: string; body: unknown; ifMatch: string | null }[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-core-edit-job-edit',
      记录目录请求: () => undefined,
      请求拦截: ({ path, method, body, headers }) =>
        请求们.push({ path, method, body, ifMatch: headers['if-match'] ?? null }),
      招聘组织Fixture: 带企业关系(
        P1C招聘组织Fixture,
        [P1C管理员关系],
        { [P1C标记.组织甲编号]: P1C组织甲() },
        // 社招月薪岗（与原链路里经向导发布的岗同形）：实习生岗编辑屏离开第一步需
        // 「转正机会」事实，seed 里没有该字段，会被第一步门禁拦下切不了 Tab
        [P1C岗位({
          recruitment_type: 'social_full_time',
          salary_period: 'month',
          salary_lower: 50,
          salary_upper: 65,
          annual_salary_months: 12,
          campus_cohort: null,
          internship_months: null,
          onsite_days_per_week: null,
        })],
      ),
      主体初始角色: 'recruiter',
    });

    // 存量招聘会话：登录落企业主壳后直达编辑屏（岗位来自 owner Jobs 水合）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await hash直达(page, '/#/hr/post-job/job-fixture-001');
    await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue('Fixture 岗位（带企业引用）', { timeout: 15_000 });
    // 编辑屏挂载期（StrictMode 双跑 + 岗位水合）切 Tab 可能被重挂载复位：以「岗位要求」
    // 区块可见为准重试切换（Tab 切换幂等，只修测试定义）
    const 职位要求键 = page.getByRole('button', { name: '职位要求' });
    await expect(async () => {
      await 职位要求键.click();
      await expect(page.getByLabel('岗位要求')).toBeVisible();
    }).toPass({ timeout: 10_000 });
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
      (项) => /^\/api\/v1\/recruiter\/jobs\/job-fixture-001$/.test(项.path) && 项.method === 'PATCH',
    );
    expect(补丁).toBeDefined();
    expect(补丁!.ifMatch).toBe('"1"'); // 稀疏补丁带当前 revision 的 quoted If-Match
    expect(补丁!.body).toMatchObject({
      requirements: '三年以上后端经验，熟悉交易系统与撮合链路',
      private_screening_preferences: '偏好系统设计背景',
      structured_requirements_confirmed: true,
    });
  });
});
