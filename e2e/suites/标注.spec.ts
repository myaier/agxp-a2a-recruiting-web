// e2e/suites/标注.spec.ts
// C6：原「标注评审构建 @annotation」describe 等价迁入（annotation 项目，端口 4183）。

import { expect, test } from '../fixtures/test';
import { hash直达 } from '../fixtures/数据源交互';
import { 安装BFF路由 } from '../fixtures/bff/安装BFF路由';

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
    await hash直达(page, '/#/experience');
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
    await hash直达(page, '/#/experience');

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
