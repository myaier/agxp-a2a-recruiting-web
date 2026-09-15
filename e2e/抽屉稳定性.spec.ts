// e2e/抽屉稳定性.spec.ts —— 抽屉（弹层框架）稳定性回归（picker 统一 Task 1）。
//
// 缺陷：弹层框架挂载就 .focus() 首个控件，此刻底部抽屉还停在入场动画的
// translateY(100%) 起点，浏览器为了露出焦点目标，把 overflow:hidden 的外壳
// （次级页外壳 / body 这类「不可滚但程序可滚」的容器）整体滚下去 —— 背景先
// 跳上去再随入场动画逐帧滑回来，用户看到「背景抖一下」。
//
// 为什么必须逐帧：动画结束后背景已回原位，只看终态验不出这个缺陷 —— 与
// e2e/换壳无闪屏.spec.ts 同一方法论：requestAnimationFrame 回调跑在本帧绘制
// 之前，此刻量到的就是这一帧画出来的东西。采样窗口取点击捕获起 ~450ms
// （入场动画 240ms + 余量），不是 await 动画结束再取一次值。
//
// 阈值即断言本身：<1 CSS px。2026-09-15 调查期在旧代码上实测位移约 236px
// （390×844）/ 263px（1280×900 机身缩放后可见坐标），那只是调查证据，
// 不写进期望 —— 换设备、换内容高度后具体数字会变，「动没动」不会。
//
// 视口 390×844 = 真手机全屏；1280×900 = 桌面机身模式（设备外框整机等比缩放）。

import { writeFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

interface 帧样本 {
  /** 距点击捕获的毫秒数 */
  t: number;
  /** h1 的视口 y（本帧画出来的位置；祖先一滚它就动） */
  标题y: number;
  /** h1 各祖先 + scrollingElement 的 [scrollTop, scrollLeft]，顺序同 祖先链 */
  滚动: number[][];
  焦点: string | null;
}

interface 采样结果 {
  祖先链: string[];
  打开前: { 标题y: number; 滚动: number[][] };
  帧们: 帧样本[];
}

/** Mock 数据源下角色守卫不生效，直接按真实路由进入 添加意向 */
async function 进添加意向(page: Page) {
  await page.goto('/#/intentions/new');
  await expect(page.getByRole('heading', { name: '添加求职期望' })).toBeVisible();
  // 等首屏布局/字体稳定再取基线，避免采样撞上首次布局抖动
  await page.waitForTimeout(300);
}

/** 薪资入口（添加意向页第 5 行） */
const 薪资入口 = (page: Page): Locator => page.getByRole('button', { name: /薪资要求/ });

/** 从点击入口行的捕获阶段起逐帧采样到 ~450ms（入口按行内文本匹配）。
 *  rAF 循环在 click 捕获监听器里启动：捕获先于 React 处理，一帧都不会漏。 */
function 采抽屉打开帧(page: Page, 入口文本: string): Promise<采样结果> {
  return page.evaluate((文本) => new Promise<采样结果>((resolve, reject) => {
    const 标题 = document.querySelector('h1');
    const 入口 = [...document.querySelectorAll('button')].find((钮) => 钮.textContent?.includes(文本));
    if (!标题 || !入口) {
      reject(new Error(`找不到 h1 或入口行（${文本}）`));
      return;
    }
    const 祖先们: Element[] = [];
    for (let 节: Element | null = 标题; 节; 节 = 节.parentElement) 祖先们.push(节);
    const 祖先链 = [...祖先们.map((节, 序) => `${序}:${节.tagName}.${(节.className || '').toString().slice(0, 24)}`), 'scrollingElement'];
    const 收滚动 = () => [
      ...祖先们.map((节) => [节.scrollTop, 节.scrollLeft] as number[]),
      [document.scrollingElement?.scrollTop ?? -1, document.scrollingElement?.scrollLeft ?? -1] as number[],
    ];
    const 打开前 = { 标题y: 标题.getBoundingClientRect().top, 滚动: 收滚动() };
    const 帧们: 帧样本[] = [];
    const 起点 = { 瞬: 0 };
    const 记一帧 = () => {
      帧们.push({
        t: Math.round(performance.now() - 起点.瞬),
        标题y: 标题.getBoundingClientRect().top,
        滚动: 收滚动(),
        焦点: document.activeElement?.textContent?.slice(0, 6) ?? null,
      });
      if (performance.now() - 起点.瞬 < 450) requestAnimationFrame(记一帧);
      else resolve({ 祖先链, 打开前, 帧们 });
    };
    // 真实点击会把焦点带给入口行，合成 click() 不会 —— 先补上，
    // 「Escape/取消后焦点回入口」这条断言才对应真机上的行为。
    // 也要 preventScroll：短屏上入口行半露时裸 focus 自己就会滚背景，
    // 那是被测缺陷之外的噪音
    入口.focus({ preventScroll: true });
    入口.addEventListener('click', () => {
      起点.瞬 = performance.now();
      requestAnimationFrame(记一帧);
    }, { capture: true, once: true });
    入口.click();
  }), 入口文本);
}

/** 逐帧断言：标题位移 < 1 CSS px，所有背景祖先滚动值与打开前一致。
 *  违规聚成一张清单一次断言，失败输出可读而不是几百条 expect。 */
function 断背景纹丝不动(结果: 采样结果) {
  expect(
    结果.帧们.length,
    '逐帧采样至少要抓到 5 帧（含动画窗口），否则用例退化成一次性取样',
  ).toBeGreaterThanOrEqual(5);
  expect(
    结果.帧们.at(-1)!.t,
    '采样窗口要盖过整段入场动画（~450ms）',
  ).toBeGreaterThanOrEqual(300);

  let 最大位移 = 0;
  let 最重帧 = '';
  const 违规滚动: string[] = [];
  for (const 帧 of 结果.帧们) {
    const 位移 = Math.abs(帧.标题y - 结果.打开前.标题y);
    if (位移 > 最大位移) {
      最大位移 = 位移;
      最重帧 = `${帧.t}ms 处偏了 ${位移.toFixed(2)}px`;
    }
    帧.滚动.forEach(([顶, 左], 序) => {
      const [基顶, 基左] = 结果.打开前.滚动[序];
      if (顶 !== 基顶 || 左 !== 基左) {
        违规滚动.push(`${帧.t}ms：背景祖先 ${结果.祖先链[序]} scrollTop/Left ${[基顶, 基左]}→${[顶, 左]}`);
      }
    });
  }
  expect(最大位移, `页面标题被带动：${最重帧}`).toBeLessThan(1);
  expect(违规滚动, '背景祖先被焦点滚动带动').toEqual([]);
}

async function 附采样证据(testInfo: TestInfo, 标签: string, 结果: 采样结果, page: Page) {
  // 用 outputPath 落文件再 attach：附件实体留在现有 test-results 的用例目录里
  const 样本文件 = testInfo.outputPath(`抽屉逐帧样本-${标签}.json`);
  await writeFile(样本文件, JSON.stringify(结果, null, 2), 'utf8');
  await testInfo.attach(`抽屉逐帧样本-${标签}.json`, { path: 样本文件, contentType: 'application/json' });
  const 截图文件 = testInfo.outputPath(`抽屉入场后-${标签}.png`);
  await page.screenshot({ path: 截图文件 });
  await testInfo.attach(`抽屉入场后-${标签}.png`, { path: 截图文件, contentType: 'image/png' });
}

test.describe('390×844 真手机全屏', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('390×844 逐帧：抽屉打开背景不跳动，焦点落取消，Escape 后焦点回薪资入口', async ({ page }, testInfo) => {
    await 进添加意向(page);
    const 结果 = await 采抽屉打开帧(page, '薪资要求');
    await 附采样证据(testInfo, '390x844', 结果, page);
    断背景纹丝不动(结果);

    // 弹层正常入场：面板完整落在视口内，焦点在取消键上
    const 取消 = page.getByRole('button', { name: '取消' });
    await expect(取消).toBeVisible();
    expect(
      await 取消.evaluate((钮) => {
        const 形 = 钮.getBoundingClientRect();
        return 形.top >= 0 && 形.bottom <= window.innerHeight;
      }),
    ).toBe(true);
    await expect(取消).toBeFocused();

    // Escape 关闭后焦点恢复到触发入口（背景不能因恢复焦点再动一次）
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(薪资入口(page)).toBeFocused();
  });

  test('390×844 已滚动页重复打开与取消：背景不二次跳动', async ({ page }, testInfo) => {
    await 进添加意向(page);
    // 把页内滚动区滚到底：恢复焦点若不带 preventScroll，此刻最容易二次跳
    await page.evaluate(() => {
      const 区 = document.querySelector('.滚动区');
      区!.scrollTop = 区!.scrollHeight;
    });
    const 滚动前 = await page.evaluate(() => document.querySelector('.滚动区')!.scrollTop);
    expect(滚动前).toBeGreaterThan(0);

    // 第一次打开：逐帧验证背景（含已滚动的滚动区）不动
    const 首开 = await 采抽屉打开帧(page, '薪资要求');
    await 附采样证据(testInfo, '390x844-已滚动-首开', 首开, page);
    断背景纹丝不动(首开);

    // 用户点取消（不是 Escape）：焦点恢复也不能带动滚动
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(薪资入口(page)).toBeFocused();
    expect(
      await page.evaluate(() => document.querySelector('.滚动区')!.scrollTop),
      '取消恢复焦点后滚动区位置变了',
    ).toBe(滚动前);

    // 重复打开再取消：同样的合同一个字不改
    const 重开 = await 采抽屉打开帧(page, '薪资要求');
    断背景纹丝不动(重开);
    await expect(page.getByRole('button', { name: '取消' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(薪资入口(page)).toBeFocused();
    expect(
      await page.evaluate(() => document.querySelector('.滚动区')!.scrollTop),
    ).toBe(滚动前);
  });

  test('长滚轮列表键盘可见：Tab 圈、滚轮方向键与 Home/End 目标可见，背景不动', async ({ page }) => {
    await 进添加意向(page);
    const 打开前标题y = await page.evaluate(() => document.querySelector('h1')!.getBoundingClientRect().top);
    // 薪资抽屉的滚轮列是 98 档的长列表（138px 视口只露 ~3 档）：
    // 首开聚焦禁止背景滚动，但 Tab 圈与轮内滚动仍必须把目标滚进可见区
    await 薪资入口(page).click();
    const 取消 = page.getByRole('button', { name: '取消' });
    const 确定 = page.getByRole('button', { name: '确定' });
    const 下限轮 = page.getByRole('listbox', { name: '薪资下限' });
    const 上限轮 = page.getByRole('listbox', { name: '薪资上限' });

    const 断在视口内 = async (定位符: Locator, 名: string) => {
      await expect(定位符).toBeFocused();
      expect(
        await 定位符.evaluate((节) => {
          const 形 = 节.getBoundingClientRect();
          return 形.top >= 0 && 形.left >= 0 && 形.bottom <= window.innerHeight && 形.right <= window.innerWidth;
        }),
        `${名} 聚焦后不可见`,
      ).toBe(true);
    };

    // 等入场动画（240ms）落定再开始 Tab：动画途中面板还停在视口下方，
    // 浏览器为露出 Tab 目标滚动外壳是入场窗口自身的暂态，不是本用例的对象；
    // 这里要钉住的是动画结束后键盘圈动不再带动背景
    await page.waitForTimeout(350);
    // DOM 序 Tab 圈：取消 → 确定 → 下限轮 → 上限轮 → 回取消（Shift+Tab 反向同样通）
    await page.keyboard.press('Tab');
    await 断在视口内(确定, '确定');
    await page.keyboard.press('Tab');
    await 断在视口内(下限轮, '薪资下限滚轮');
    await page.keyboard.press('Tab');
    await 断在视口内(上限轮, '薪资上限滚轮');
    await page.keyboard.press('Tab');
    await 断在视口内(取消, '取消（圈回首）');
    await page.keyboard.press('Shift+Tab');
    await 断在视口内(上限轮, '薪资上限滚轮（反向圈）');

    // 轮内键盘：方向键连按 + Home/End，选中档必须被轮子自己的内部滚动露出来
    await page.keyboard.press('Tab'); // 上限轮 → 圈回首控件 取消
    await page.keyboard.press('Tab'); // 取消 → 确定
    await page.keyboard.press('Tab'); // 确定 → 下限轮
    await expect(下限轮).toBeFocused();
    for (let 次 = 0; 次 < 3; 次++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    const 选中档可见 = await page.evaluate(() => {
      const 轮 = [...document.querySelectorAll('[role="listbox"]')].find((列) => 列.getAttribute('aria-label') === '薪资下限')!;
      const 选中 = 轮.querySelector('[aria-selected="true"]')!;
      const 轮形 = 轮.getBoundingClientRect();
      const 档形 = 选中.getBoundingClientRect();
      return 档形.top >= 轮形.top - 1 && 档形.bottom <= 轮形.bottom + 1 && 轮.scrollTop > 0;
    });
    expect(选中档可见, 'End 后选中档不在滚轮可见区内（内部滚动被误禁）').toBe(true);
    await page.keyboard.press('Home');

    // 整段键盘操作里背景照样纹丝不动
    expect(
      await page.evaluate(() => document.querySelector('h1')!.getBoundingClientRect().top),
    ).toBe(打开前标题y);
  });
});

test.describe('短屏 390×500', () => {
  test.use({ viewport: { width: 390, height: 500 } });

  test('390×500 短屏回归：抽屉打开背景不跳动、取消与焦点恢复可用', async ({ page }, testInfo) => {
    await 进添加意向(page);
    const 结果 = await 采抽屉打开帧(page, '薪资要求');
    await 附采样证据(testInfo, '390x500', 结果, page);
    断背景纹丝不动(结果);
    await expect(page.getByRole('button', { name: '取消' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(薪资入口(page)).toBeFocused();
  });
});

test.describe('1280×900 桌面机身模式', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('1280×900 机身缩放逐帧：抽屉打开背景不跳动', async ({ page }, testInfo) => {
    await 进添加意向(page);
    // 前置：这台视口确实走了机身模式（整机等比缩放），别让用例悄悄测错形态
    await expect(page.locator('[class*="机身"]').first()).toBeVisible();
    const 结果 = await 采抽屉打开帧(page, '薪资要求');
    await 附采样证据(testInfo, '1280x900', 结果, page);
    断背景纹丝不动(结果);
    await expect(page.getByRole('button', { name: '取消' })).toBeFocused();
  });
});

// ── 数字抽屉实习档位（picker 统一 Task 2）：求职侧 实习时长 / 每周到岗 改共用
//    数字滚轮层，只开放离散档 [1,3,6] / [2,3,4,5] —— 发布岗的连续 1-24 / 1-7 档
//    不得泄漏到求职侧；打开与 取消 / Escape 零写入，确定才回填页面草稿。 ──
test.describe('数字抽屉实习档位（picker 统一 Task 2）', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  /** 进添加意向后切到 实习生：两行实习数值入口出现 */
  async function 进实习生意向(page: Page) {
    await 进添加意向(page);
    await page.getByRole('button', { name: '实习生', exact: true }).click();
    await expect(page.getByRole('button', { name: '实习时长' })).toBeVisible();
  }

  test('数字档位只开放产品档：实习月数 1/3/6、每周到岗 2-5，岗位连续档不泄漏', async ({ page }) => {
    await 进实习生意向(page);
    await page.getByRole('button', { name: '实习时长' }).click();
    const 月数轮 = page.getByRole('listbox', { name: '实习时长' });
    await expect(月数轮).toBeVisible();
    for (const 档 of ['1', '3', '6']) {
      await expect(月数轮.getByRole('option', { name: 档, exact: true })).toHaveCount(1);
    }
    // 2/4/5 个月是求职侧未开放的档；24 个月是发布岗连续档的尽头 —— 都不许出现
    for (const 泄漏档 of ['2', '4', '5', '24']) {
      await expect(月数轮.getByRole('option', { name: 泄漏档, exact: true })).toHaveCount(0);
    }
    await page.getByRole('button', { name: '取消' }).click();

    await page.getByRole('button', { name: '每周到岗' }).click();
    const 天数轮 = page.getByRole('listbox', { name: '每周到岗' });
    await expect(天数轮).toBeVisible();
    for (const 档 of ['2', '3', '4', '5']) {
      await expect(天数轮.getByRole('option', { name: 档, exact: true })).toHaveCount(1);
    }
    // 1/6/7 天是求职侧未开放的档；7 天是发布岗连续档的尽头
    for (const 泄漏档 of ['1', '6', '7']) {
      await expect(天数轮.getByRole('option', { name: 泄漏档, exact: true })).toHaveCount(0);
    }
  });

  test('数字实习抽屉取消与 Escape 零写入，确定才回填', async ({ page }) => {
    await 进实习生意向(page);
    const 月数行 = page.getByRole('button', { name: '实习时长' });
    await expect(月数行).toContainText('请选择');

    // 改到 6 再取消：不写草稿，行未填，重开也不是 6（缺值临时落首档）
    await 月数行.click();
    await page.getByRole('listbox', { name: '实习时长' }).getByRole('option', { name: '6', exact: true }).click();
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(月数行).toContainText('请选择');
    await 月数行.click();
    await expect(
      page.getByRole('listbox', { name: '实习时长' }).getByRole('option', { name: '1', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    // Escape 同样零写入
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(月数行).toContainText('请选择');

    // 确定才回填一次
    await 月数行.click();
    await page.getByRole('button', { name: '确定' }).click();
    await expect(月数行).toContainText('至少 1 个月');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

// ── 年月抽屉（picker 统一 Task 3）：出生年月 / 预计毕业时间 复用 年月滚轮层。
//    已滚动表单上打开与取消：背景稳定、滚动位置不动、取消零写入；
//    毕业抽屉缺值临时落「次年 6 月」，未来 8 年档不被夹掉。 ──
test.describe('年月抽屉（picker 统一 Task 3）', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  /** 把页内滚动区滚到底并返回原 scrollTop（恢复焦点若带动滚动，这里最先暴露） */
  async function 滚到底(page: Page): Promise<number> {
    await page.evaluate(() => {
      const 区 = document.querySelector('.滚动区');
      区!.scrollTop = 区!.scrollHeight;
    });
    const 滚动前 = await page.evaluate(() => document.querySelector('.滚动区')!.scrollTop);
    expect(滚动前).toBeGreaterThan(0);
    return 滚动前;
  }

  test('基本信息 生日抽屉：已滚动打开背景稳定，取消零写入、确定成对回填', async ({ page }, testInfo) => {
    // 短屏 390×500：双滚轮改选择行后 /basic 在 390×844 正好一屏放得下，
    // 短屏才滚得动；「已滚动 + 短屏」也正对焦点滚动的最坏场景（同 短屏 describe 的取舍）
    await page.setViewportSize({ width: 390, height: 500 });
    // Mock 数据源直接进 /basic：演示默认 1998/6 已确认（Mock 显式演示值合同保留）
    await page.goto('/#/basic');
    await expect(page.getByRole('heading', { name: '创建在线简历' })).toBeVisible();
    await page.waitForTimeout(300);
    const 生日行 = page.getByRole('button', { name: /出生年月/ });
    await expect(生日行).toContainText('1998 年 06 月');
    const 滚动前 = await 滚到底(page);

    // 已滚动表单打开抽屉：逐帧背景纹丝不动
    const 结果 = await 采抽屉打开帧(page, '出生年月');
    await 附采样证据(testInfo, '年月-生日-390x844', 结果, page);
    断背景纹丝不动(结果);

    // 取消：零写入，行值与滚动位置都不动
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(生日行).toContainText('1998 年 06 月');
    expect(await page.evaluate(() => document.querySelector('.滚动区')!.scrollTop)).toBe(滚动前);

    // 重开改 2001/3 确定：成对回填到父行
    await 生日行.click();
    await page.getByRole('listbox', { name: '出生年' }).getByRole('option', { name: '2001' }).click();
    await page.getByRole('listbox', { name: '出生月' }).getByRole('option', { name: '3', exact: true }).click();
    await page.getByRole('button', { name: '确定' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(生日行).toContainText('2001 年 03 月');
  });

  test('添加意向 毕业抽屉：缺值临时落次年6月、未来8年在档，已滚动打开取消稳定零写入', async ({ page }, testInfo) => {
    await 进添加意向(page);
    await page.getByRole('button', { name: '校园招聘', exact: true }).click();
    const 毕业行 = page.getByRole('button', { name: /预计毕业年月/ });
    await expect(毕业行).toContainText('请选择毕业年月');
    const 滚动前 = await 滚到底(page);

    // 已滚动表单打开抽屉：逐帧背景纹丝不动
    const 结果 = await 采抽屉打开帧(page, '预计毕业年月');
    await 附采样证据(testInfo, '年月-毕业-390x844', 结果, page);
    断背景纹丝不动(结果);

    // 缺值临时落「次年 6 月」；未来 8 年在档、月份到 12 月不被上界夹掉
    const 抽屉 = page.getByRole('dialog', { name: '预计毕业时间' });
    const 年列 = 抽屉.getByRole('listbox', { name: '毕业年' });
    await expect(年列.getByRole('option', { name: String(new Date().getFullYear() + 1) })).toHaveAttribute('aria-selected', 'true');
    await expect(年列.getByRole('option', { name: String(new Date().getFullYear() + 7) })).toHaveCount(1);
    await expect(抽屉.getByRole('listbox', { name: '毕业月' }).getByRole('option', { name: '12', exact: true })).toHaveCount(1);

    // 取消：零写入，行仍占位、滚动位置不动；Escape 重开同样只关层
    await 抽屉.getByRole('button', { name: '取消' }).click();
    await expect(抽屉).toHaveCount(0);
    await expect(毕业行).toContainText('请选择毕业年月');
    expect(await page.evaluate(() => document.querySelector('.滚动区')!.scrollTop)).toBe(滚动前);
    await 毕业行.click();
    await expect(page.getByRole('dialog', { name: '预计毕业时间' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '预计毕业时间' })).toHaveCount(0);
    await expect(毕业行).toContainText('请选择毕业年月');
  });
});
