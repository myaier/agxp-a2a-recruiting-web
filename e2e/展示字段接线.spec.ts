// e2e/展示字段接线.spec.ts
// 双端展示字段前端接线 · 前置步骤：改动前 Mock 截图基线采集。
//
// 在未改任何产品代码前，为本轮接线涉及的四列表（市场 / 求职在谈 / 招聘推荐 /
// 招聘在谈）、独立职位详情、匿名在线简历、在谈详情资料 Tab（求职职位详情 /
// 招聘在线简历）建立可重复采集的视觉基准。Task 7 的候选采集与本基准按
// sceneId 逐场景走 e2e/视觉回归/比较器 比较。
//
// 边界（与冻结 Spec / Global Constraints 对齐）：
//   · 只采集，不断言产品语义；横向溢出、console/API 诊断忠实写进 JSON，不在采集期
//     拦截 —— Mockup 自身若有溢出，基准如实记录，由报告/对账收口。
//   · 不 import e2e/数据源模式.spec.ts（会触发整套测试注册），不 import
//     e2e/视觉回归/场景.ts；只复用 稳定页面.ts 的 打开稳定页面/安装诊断 与
//     类型.ts 的 场景采集结果 schema（比较器按它读目录）。
//   · 普通 Mock 场景零 /api/v1 请求；apiRequests 只记录不放宽。
//   · 采集用例绝不点击收藏 / 接受 / 不感兴趣等会改状态的动作按钮，只读截图。
//   · 滚动容器：详情类页面与列表页主滚动容器都是全局类 .滚动区
//     （P1 展示统一 spec 同款口径）。
//
// 采集命令（基准，任何产品改动前）：
//   WIRING_CAPTURE_DIR=ui-regression-output/展示接线/reference npm run test:e2e:data-source -- \
//     e2e/展示字段接线.spec.ts --project=mock-stg --grep '展接线 Mock视觉' --workers=1
// 候选采集同一命令换 WIRING_CAPTURE_DIR 目录即可；sceneId 含视口宽度，两个宽度互不覆盖。

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { 安装诊断, 打开稳定页面 } from './视觉回归/稳定页面';
import type { 场景采集结果, 场景状态种子, 元素几何 } from './视觉回归/类型';
import { 路径 } from '../src/路由/路径表';

// ── 采集目录（测试专用环境变量，不新增产品 env）─────────────────────────
const 采集根目录 = process.env.WIRING_CAPTURE_DIR ?? null;

let 采集子目录: { 截图目录: string; 场景目录: string } | null = null;
function 取采集目录(): { 截图目录: string; 场景目录: string } {
  if (采集根目录 === null) {
    throw new Error('WIRING_CAPTURE_DIR 未设置：展接线 Mock视觉 采集需要明确输出目录');
  }
  if (采集子目录 === null) {
    const 截图目录 = join(采集根目录, 'screenshots');
    const 场景目录 = join(采集根目录, 'scenes');
    mkdirSync(截图目录, { recursive: true });
    mkdirSync(场景目录, { recursive: true });
    采集子目录 = { 截图目录, 场景目录 };
  }
  return 采集子目录;
}

function 写结果(结果: 场景采集结果): void {
  const 路径名 = join(取采集目录().场景目录, `${结果.sceneId}.json`);
  mkdirSync(dirname(路径名), { recursive: true });
  writeFileSync(路径名, JSON.stringify(结果, null, 2));
}

// ── 本 spec 内 helper ────────────────────────────────────────────────

/** 关键元素描述：名称 + 定位。与 视觉回归/场景.ts 同形，但独立声明避免整包 import。 */
interface 关键元素描述 {
  名称: string;
  定位: Locator;
}

/** 两帧 rAF + 字体就绪：滚动/点页签/换文本之后让布局与渲染落定，不用固定 sleep。 */
async function 等落定(page: Page): Promise<void> {
  await page.evaluate(() => (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready);
  await page.evaluate(
    () =>
      new Promise<number>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(1))),
      ),
  );
}

/** 把指定滚动容器滚到最底（详情后段）。滚动区 是全局类（非 CSS module）。 */
async function 滚到底(page: Page, 容器选择器 = '.滚动区'): Promise<void> {
  await page.evaluate((选择器) => {
    const 容器 = document.querySelector(选择器);
    if (!容器) throw new Error(`滚动容器未找到：${选择器}`);
    容器.scrollTop = 容器.scrollHeight;
  }, 容器选择器);
}

// ── 场景定义 ──────────────────────────────────────────────────────────

interface 展接线场景 {
  /** sceneId 基名；运行时追加视口宽度（如 wiring-market-320），两个宽度互不覆盖 */
  基名: string;
  状态: 场景状态种子;
  到达(page: Page): Promise<void>;
  就绪(page: Page): Promise<void>;
  关键元素(page: Page): 关键元素描述[];
}

const 求职端: 场景状态种子 = '求职端已注册';
const 招聘端: 场景状态种子 = '招聘端已注册';

// —— 求职端：看市场 / 求职在谈 ——

const 市场场景: 展接线场景 = {
  基名: 'wiring-market',
  状态: 求职端,
  async 到达(page) {
    await 打开稳定页面(page, '/#/app', 求职端);
    await page.getByRole('button', { name: '市场', exact: true }).click();
  },
  async 就绪(page) {
    await expect(page.getByText(/个职位需要你协调|暂时没有需要你介入/)).toBeVisible();
  },
  关键元素(page) {
    return [
      { 名称: '代理横幅', 定位: page.getByText(/个职位需要你协调|暂时没有需要你介入/) },
      { 名称: '首卡 查看职位详情按钮', 定位: page.getByRole('button', { name: '查看职位详情' }).first() },
      { 名称: '首卡 让AI代理去谈按钮', 定位: page.getByRole('button', { name: '让AI代理去谈' }).first() },
      { 名称: '首卡职位名', 定位: page.getByText('交易系统资深工程师', { exact: true }) },
      { 名称: '首卡薪资', 定位: page.getByText('55–70K', { exact: true }) },
      { 名称: '首卡公司名', 定位: page.getByText('老虎国际', { exact: true }) },
      { 名称: '首卡分数环', 定位: page.getByRole('img', { name: /适配 \d+ 分/ }).first() },
    ];
  },
};

const 求职在谈场景: 展接线场景 = {
  基名: 'wiring-candidate-nego',
  状态: 求职端,
  async 到达(page) {
    await 打开稳定页面(page, '/#/app', 求职端);
  },
  async 就绪(page) {
    await expect(page.getByTestId('求职在谈卡').first()).toBeVisible();
  },
  关键元素(page) {
    const 卡 = page.getByTestId('求职在谈卡').first();
    return [
      { 名称: '首卡整卡', 定位: 卡 },
      { 名称: '首卡职位名', 定位: 卡.getByText('资深后端工程师 · 交易网关') },
      { 名称: '子视图 在谈按钮', 定位: page.getByRole('button', { name: '在谈', exact: true }) },
      { 名称: '子视图 市场按钮', 定位: page.getByRole('button', { name: '市场', exact: true }) },
      { 名称: '代理横幅', 定位: page.getByText(/个职位需要你协调|暂时没有需要你介入/) },
    ];
  },
};

// —— 招聘端：推荐 / 在谈 ——

const 招聘推荐场景: 展接线场景 = {
  基名: 'wiring-hr-recommend',
  状态: 招聘端,
  async 到达(page) {
    await 打开稳定页面(page, '/#/hr', 招聘端);
    await page.getByRole('button', { name: '推荐', exact: true }).click();
  },
  async 就绪(page) {
    await expect(page.getByTestId('招聘推荐卡').first()).toBeVisible();
  },
  关键元素(page) {
    const 卡 = page.getByTestId('招聘推荐卡').first();
    return [
      { 名称: '首卡整卡', 定位: 卡 },
      { 名称: '首卡分数环', 定位: 卡.getByRole('img', { name: '适配 91 分' }) },
      { 名称: '首卡公司行', 定位: 卡.getByText('华泰证券 · Go / 交易网关') },
      { 名称: '首卡教育行', 定位: 卡.getByText('上海交通大学 · 计算机科学与技术') },
      { 名称: '首卡 查看候选画像按钮', 定位: 卡.getByRole('button', { name: '查看候选画像' }) },
      { 名称: '子视图 推荐按钮', 定位: page.getByRole('button', { name: '推荐', exact: true }) },
    ];
  },
};

const 招聘在谈场景: 展接线场景 = {
  基名: 'wiring-hr-nego',
  状态: 招聘端,
  async 到达(page) {
    await 打开稳定页面(page, '/#/hr', 招聘端);
    await page.getByRole('button', { name: '在谈', exact: true }).click();
  },
  async 就绪(page) {
    await expect(page.getByTestId('招聘在谈卡').first()).toBeVisible();
  },
  关键元素(page) {
    const 卡 = page.getByTestId('招聘在谈卡').first();
    return [
      { 名称: '首卡整卡', 定位: 卡 },
      { 名称: '首卡分数环', 定位: 卡.getByRole('img', { name: '适配 94 分' }) },
      { 名称: '首卡公司行', 定位: 卡.getByText('字节跳动 · Go / 高并发交易') },
      { 名称: '首卡 亮点信息未知', 定位: 卡.getByText('亮点信息未知') },
      { 名称: '首卡阶段 需要协调', 定位: 卡.getByText('需要协调', { exact: true }) },
      { 名称: '子视图 在谈按钮', 定位: page.getByRole('button', { name: '在谈', exact: true }) },
    ];
  },
};

// —— 独立职位详情（Mock：M-13）——

const 职位详情路径 = `/#${路径.职位详情('M-13')}`;

const 职位详情顶部场景: 展接线场景 = {
  基名: 'wiring-job-top',
  状态: 求职端,
  async 到达(page) {
    await 打开稳定页面(page, 职位详情路径, 求职端);
  },
  async 就绪(page) {
    await expect(page.getByText('交易中台架构师', { exact: true })).toBeVisible();
  },
  关键元素(page) {
    return [
      { 名称: '职位名', 定位: page.getByText('交易中台架构师', { exact: true }) },
      { 名称: '薪资', 定位: page.getByText('60-80K', { exact: true }) },
      { 名称: '分数位 适配环', 定位: page.getByRole('img', { name: /适配 \d+ 分/ }) },
      { 名称: '匹配度分析标题', 定位: page.getByText('匹配度分析', { exact: true }) },
      { 名称: 'JD卡标题 职位详情', 定位: page.getByText('职位详情', { exact: true }) },
      { 名称: '浮动主按钮 让AI代理去谈', 定位: page.getByRole('button', { name: '让AI代理去谈' }) },
    ];
  },
};

const 职位详情底部场景: 展接线场景 = {
  基名: 'wiring-job-bottom',
  状态: 求职端,
  async 到达(page) {
    await 打开稳定页面(page, 职位详情路径, 求职端);
    await expect(page.getByText('交易中台架构师', { exact: true })).toBeVisible();
    await 滚到底(page);
    await 等落定(page);
  },
  async 就绪(page) {
    await expect(page.getByText('梁思远 · 美团', { exact: false })).toBeVisible();
  },
  关键元素(page) {
    return [
      { 名称: '公司卡 美团', 定位: page.getByRole('button', { name: /美团/ }) },
      { 名称: '公司元行 融资阶段', 定位: page.getByText('融资阶段', { exact: true }) },
      { 名称: '发布人名', 定位: page.getByText('梁思远 · 美团', { exact: false }) },
      { 名称: '发布人备注', 定位: page.getByText('企业直招 · 允许直接联系', { exact: true }) },
    ];
  },
};

// —— 匿名在线简历（Mock：R-11）——

const 匿名简历路径 = `/#${路径.匿名在线简历('R-11')}`;

const 匿名简历顶部场景: 展接线场景 = {
  基名: 'wiring-resume-top',
  状态: 招聘端,
  async 到达(page) {
    await 打开稳定页面(page, 匿名简历路径, 招聘端);
  },
  async 就绪(page) {
    await expect(page.getByText('个人优势', { exact: true })).toBeVisible();
  },
  关键元素(page) {
    return [
      { 名称: '返回按钮', 定位: page.getByRole('button', { name: '返回' }) },
      { 名称: '匹配标', 定位: page.getByText('匹配', { exact: true }).first() },
      { 名称: '匹配度分析标题', 定位: page.getByText('匹配度分析', { exact: true }) },
      { 名称: '个人优势标题', 定位: page.getByText('个人优势', { exact: true }) },
      { 名称: '画像 性别标', 定位: page.getByRole('img', { name: '男' }) },
      { 名称: '职位行', 定位: page.getByText('交易网关资深工程师 · 现任华泰证券') },
      { 名称: '求职期望标题', 定位: page.getByText('求职期望', { exact: true }) },
    ];
  },
};

const 匿名简历底部场景: 展接线场景 = {
  基名: 'wiring-resume-bottom',
  状态: 招聘端,
  async 到达(page) {
    await 打开稳定页面(page, 匿名简历路径, 招聘端);
    await expect(page.getByText('个人优势', { exact: true })).toBeVisible();
    await 滚到底(page);
    await 等落定(page);
  },
  async 就绪(page) {
    await expect(page.getByText('专业技能', { exact: true }).first()).toBeVisible();
  },
  关键元素(page) {
    return [
      { 名称: '工作经历标题', 定位: page.getByText('工作经历', { exact: true }).first() },
      { 名称: '教育经历标题', 定位: page.getByText('教育经历', { exact: true }).first() },
      { 名称: '专业技能标题', 定位: page.getByText('专业技能', { exact: true }).first() },
    ];
  },
};

// —— 求职在谈详情 · 职位详情 Tab（Mock：J-01）——

const 在谈看职位路径 = `/#${路径.在谈详情看职位('J-01')}`;

const 求职资料Tab顶部场景: 展接线场景 = {
  基名: 'wiring-deal-jobtab-top',
  状态: 求职端,
  async 到达(page) {
    await 打开稳定页面(page, 在谈看职位路径, 求职端);
  },
  async 就绪(page) {
    await expect(page.getByText('匹配度分析', { exact: true })).toBeVisible();
  },
  关键元素(page) {
    return [
      { 名称: '顶栏职位名', 定位: page.getByText('资深后端工程师 · 交易网关').first() },
      { 名称: 'Tab 代谈进度', 定位: page.getByRole('button', { name: '代谈进度', exact: true }) },
      { 名称: 'Tab 职位详情', 定位: page.getByRole('button', { name: '职位详情', exact: true }) },
      { 名称: '匹配度分析标题', 定位: page.getByText('匹配度分析', { exact: true }) },
      { 名称: '职位要求标题', 定位: page.getByText('职位要求', { exact: true }) },
      { 名称: '返回按钮', 定位: page.getByRole('button', { name: '返回' }) },
    ];
  },
};

const 求职资料Tab底部场景: 展接线场景 = {
  基名: 'wiring-deal-jobtab-bottom',
  状态: 求职端,
  async 到达(page) {
    await 打开稳定页面(page, 在谈看职位路径, 求职端);
    await expect(page.getByText('匹配度分析', { exact: true })).toBeVisible();
    await 滚到底(page);
    await 等落定(page);
  },
  async 就绪(page) {
    await expect(page.getByText('对接人', { exact: true }).first()).toBeVisible();
  },
  关键元素(page) {
    return [
      { 名称: '公司信息标题', 定位: page.getByText('公司信息', { exact: true }).first() },
      { 名称: '公司名 抖音', 定位: page.getByText('抖音', { exact: true }).first() },
      { 名称: '对接人标题', 定位: page.getByText('对接人', { exact: true }).first() },
      { 名称: '对接人 林筱', 定位: page.getByText(/林筱/).first() },
    ];
  },
};

// —— 招聘在谈详情 · 在线简历 Tab（Mock：A-01）——

const 候选看简历路径 = `/#${路径.候选详情看简历('A-01')}`;

const 招聘简历Tab顶部场景: 展接线场景 = {
  基名: 'wiring-hr-case-resume-top',
  状态: 招聘端,
  async 到达(page) {
    await 打开稳定页面(page, 候选看简历路径, 招聘端);
  },
  async 就绪(page) {
    await expect(page.getByText('个人优势', { exact: true })).toBeVisible();
  },
  关键元素(page) {
    return [
      { 名称: 'Tab 代谈进度', 定位: page.getByRole('button', { name: '代谈进度', exact: true }) },
      { 名称: 'Tab 在线简历', 定位: page.getByRole('button', { name: '在线简历', exact: true }) },
      { 名称: '画像 性别标', 定位: page.getByRole('img', { name: '男' }).first() },
      { 名称: '画像 年限', 定位: page.getByText('9 年', { exact: true }).first() },
      { 名称: '匹配度分析标题', 定位: page.getByText('匹配度分析', { exact: true }) },
      { 名称: '个人优势标题', 定位: page.getByText('个人优势', { exact: true }) },
      { 名称: '求职期望标题', 定位: page.getByText('求职期望', { exact: true }) },
    ];
  },
};

const 招聘简历Tab底部场景: 展接线场景 = {
  基名: 'wiring-hr-case-resume-bottom',
  状态: 招聘端,
  async 到达(page) {
    await 打开稳定页面(page, 候选看简历路径, 招聘端);
    await expect(page.getByText('个人优势', { exact: true })).toBeVisible();
    await 滚到底(page);
    await 等落定(page);
  },
  async 就绪(page) {
    await expect(page.getByText('专业技能', { exact: true }).first()).toBeVisible();
  },
  关键元素(page) {
    return [
      { 名称: '工作经历标题', 定位: page.getByText('工作经历', { exact: true }).first() },
      { 名称: '项目经历标题', 定位: page.getByText('项目经历', { exact: true }).first() },
      { 名称: '教育经历标题', 定位: page.getByText('教育经历', { exact: true }).first() },
      { 名称: '专业技能标题', 定位: page.getByText('专业技能', { exact: true }).first() },
    ];
  },
};

const 展接线场景们: 展接线场景[] = [
  市场场景,
  求职在谈场景,
  招聘推荐场景,
  招聘在谈场景,
  职位详情顶部场景,
  职位详情底部场景,
  匿名简历顶部场景,
  匿名简历底部场景,
  求职资料Tab顶部场景,
  求职资料Tab底部场景,
  招聘简历Tab顶部场景,
  招聘简历Tab底部场景,
];

// ── 采集执行：每场景 × 每视口宽度一个 test，sceneId 含宽度 ─────────────

async function 采集场景(page: Page, 场景: 展接线场景, 宽度: number): Promise<void> {
  const sceneId = `${场景.基名}-${宽度}`;
  const 诊断 = 安装诊断(page);
  let 结果: 场景采集结果 = {
    schemaVersion: 1,
    sceneId,
    status: 'captured',
    url: '',
    screenshot: null,
    viewport: { width: 0, height: 0 },
    elements: [],
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    apiRequests: [],
    horizontalOverflow: 0,
    failure: null,
  };

  try {
    await 场景.到达(page);
    await 场景.就绪(page);

    // body 可见文字长度 >= 12（与既有采集口径一致，防主 bundle 缺失白屏假通过）
    const 正文长度 = await page.evaluate(() => {
      const 文 = document.body?.innerText ?? '';
      return 文.replace(/\s+/g, ' ').trim().length;
    });
    if (正文长度 < 12) {
      throw new Error(`body 可见文字长度 ${正文长度} < 12`);
    }

    // 关键元素可见并记录 boundingBox（页面坐标系，与滚动位置无关）
    const 元素们: 元素几何[] = [];
    for (const 描述 of 场景.关键元素(page)) {
      const 可见 = await 描述.定位.isVisible();
      if (!可见) {
        throw new Error(`关键元素不可见：${描述.名称}`);
      }
      const 框 = await 描述.定位.boundingBox();
      if (!框) {
        throw new Error(`关键元素无 boundingBox：${描述.名称}`);
      }
      元素们.push({
        名称: 描述.名称,
        x: Math.round(框.x * 100) / 100,
        y: Math.round(框.y * 100) / 100,
        width: Math.round(框.width * 100) / 100,
        height: Math.round(框.height * 100) / 100,
      });
    }

    // 横向溢出：忠实记录，不在采集期拦截 —— Mockup 自身溢出也是基准的一部分
    const 溢出 = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    const 视窗 = page.viewportSize() ?? { width: 0, height: 0 };
    const 截图文件 = join(取采集目录().截图目录, `${sceneId}.png`);
    await page.screenshot({ path: 截图文件 });

    结果 = {
      schemaVersion: 1,
      sceneId,
      status: 'captured',
      url: page.url(),
      // 存相对 WIRING_CAPTURE_DIR 的路径，与比较器 join(captureDir, screenshot) 契约一致
      screenshot: `screenshots/${sceneId}.png`,
      viewport: 视窗,
      elements: 元素们,
      consoleErrors: [...诊断.consoleErrors],
      pageErrors: [...诊断.pageErrors],
      failedRequests: [...诊断.failedRequests],
      apiRequests: [...诊断.apiRequests],
      horizontalOverflow: 溢出,
      failure: null,
    };
    写结果(结果);
    诊断.detach();
  } catch (原始错误) {
    结果 = {
      ...结果,
      status: 'failed',
      url: page.url(),
      viewport: page.viewportSize() ?? { width: 0, height: 0 },
      consoleErrors: [...诊断.consoleErrors],
      pageErrors: [...诊断.pageErrors],
      failedRequests: [...诊断.failedRequests],
      apiRequests: [...诊断.apiRequests],
      failure: 原始错误 instanceof Error ? 原始错误.message : String(原始错误),
    };
    写结果(结果);
    诊断.detach();
    throw 原始错误;
  }
}

const 视口宽度们 = [320, 390];

for (const 宽度 of 视口宽度们) {
  test.describe(`展接线 Mock视觉 ${宽度} @mock`, () => {
    // 冻结环境：locale / timezone / reducedMotion 基准与候选完全一致
    test.use({
      viewport: { width: 宽度, height: 844 },
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      reducedMotion: 'reduce',
    });

    for (const 场景 of 展接线场景们) {
      test(`采集 ${场景.基名} @mock`, async ({ page }) => {
        test.setTimeout(120_000);
        await 采集场景(page, 场景, 宽度);
      });
    }
  });
}
// ═══════════════════════════════════════════════════════════════════════════
// 展示字段接线 @backend / @mock 数据源（Task 7）
//
// 用 HTTP fixture 路由拦截证明 release/0.2.5 展示字段的端到端接线与请求边界：
//   · 四列表只读其列表/既有必要请求，零逐卡 Job/Resume/公开企业补读；
//   · 独立职位详情有组织坐标才读该公开企业（恰好一次）、claim-only 零请求、
//     主体切换不显示旧数据；
//   · Case 详情无当前 Job/Resume 补读（冻结正文/公司导航只来自 wire 的 job_detail）；
//   · anonymous 与 disclosed 均零候选身份头像请求（响应里已有头像 URL 也只解码不使用）；
//   · 320/390 视口 scrollWidth <= clientWidth、按钮/Tab 可操作、媒体加载失败有回退。
// 全部 /api/v1 请求被 e2e/fixtures/展示字段接线.ts 的 path+method 白名单捕获，
// 白名单外记录并返回受控 503；请求序列来自返回的 { 请求 }，断言不放行真实网络。
// ═══════════════════════════════════════════════════════════════════════════

import { 安装展接线路由 } from './fixtures/展示字段接线';
import type { 展接线角色 } from './fixtures/展示字段接线';

/** 断言页面无横向溢出（320/390 双视口的滚动边界）。 */
async function 期望无溢出(page: Page): Promise<void> {
  const 溢出 = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(溢出, '页面横向溢出').toBeLessThanOrEqual(0);
}

/** 打开后端入口：清空存储 + 关动画 + 等主壳落定（candidate → /#/app，recruiter → /#/hr）。 */
async function 打开后端主壳(page: Page, role: 展接线角色): Promise<void> {
  await 打开稳定页面(page, '/', '未登录');
  await expect(page).toHaveURL(role === 'candidate' ? /#\/app$/ : /#\/hr$/, { timeout: 20_000 });
}

/** 页面上 wiring- 媒体请求记录器（候选身份头像/加载失败探针都在 cdn.fixture.example 下）。 */
function 安装媒体记录(page: Page): string[] {
  const 媒体请求: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('cdn.fixture.example')) 媒体请求.push(req.url());
  });
  return 媒体请求;
}

const 后端宽度们 = [320, 390];

for (const 宽度 of 后端宽度们) {
  test.describe(`展接线 Backend ${宽度} @backend`, () => {
    test.use({
      viewport: { width: 宽度, height: 844 },
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      reducedMotion: 'reduce',
    });

    test('候选 市场列表与独立职位详情：零逐卡补读、公开企业单读、0分/长文/局部空/媒体回退 @backend', async ({ page }) => {
      test.setTimeout(120_000);
      const { 请求 } = await 安装展接线路由(page, { role: 'candidate', 场景: '完整' });
      const 诊断 = 安装诊断(page);
      const 媒体请求 = 安装媒体记录(page);
      await 打开后端主壳(page, 'candidate');

      // 市场列表：只读列表本身（零逐卡 Job / 公开企业 / 简历补读）
      await page.getByRole('button', { name: '市场', exact: true }).click();
      await expect(page.getByText('展接FIX 交易中台架构师').first()).toBeVisible({ timeout: 15_000 });
      expect(请求.some((条) => 条.method === 'GET' && 条.path === '/api/v1/me/job-recommendations')).toBe(true);
      expect(请求.filter((条) => 条.method === 'GET' && 条.path.startsWith('/api/v1/jobs/'))).toEqual([]);
      expect(请求.filter((条) => 条.method === 'GET' && 条.path.startsWith('/api/v1/organizations/'))).toEqual([]);

      // 真实 0 分与推荐分同屏（wire 给 0 就是 0，不重算不省略）
      await expect(page.getByRole('img', { name: '适配 92 分' })).toBeVisible();
      await expect(page.getByRole('img', { name: '适配 0 分' })).toBeVisible();
      // 真实媒体 URL：卡上 logo-ok 加载成功（naturalWidth > 0）；logo-broken 加载失败走回退
      await expect.poll(async () => page.evaluate(() =>
        Array.from(document.querySelectorAll('img')).some(
          (img) => img.src.includes('wiring-logo-ok') && img.complete && img.naturalWidth > 0,
        ),
      )).toBe(true);
      // 加载失败探针：broken logo 已发起加载（组件 onError 后退首字块，img 自身退场），
      // 但任何 img 都不会把它当成功图渲染；且失败只发生在媒体 URL，零 /api/v1 失败
      await expect.poll(() => 媒体请求.filter((url) => url.includes('wiring-logo-broken')).length).toBeGreaterThanOrEqual(1);
      expect(await page.evaluate(() =>
        Array.from(document.querySelectorAll('img')).some(
          (img) => img.src.includes('wiring-logo-broken') && img.complete && img.naturalWidth > 0,
        ),
      )).toBe(false);
      expect(媒体请求.filter((url) => url.includes('/api/'))).toEqual([]);

      // A 卡（有组织坐标）：进详情零 canonical job GET（快照命中），公开企业补读只打 A 自己的坐标
      await page.getByRole('button', { name: '查看职位详情' }).nth(0).click();
      await expect(page).toHaveURL(new RegExp(`#/job/${'job_00112233445566778899aabbccddee01'}$`), { timeout: 10_000 });
      await expect(page.getByText('展接FIX 交易中台架构师', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      expect(请求.filter((条) => 条.method === 'GET' && 条.path.startsWith('/api/v1/jobs/'))).toEqual([]);
      await expect.poll(() =>
        请求.filter((条) => 条.method === 'GET' && 条.path.startsWith('/api/v1/organizations/')).length,
        { timeout: 15_000 },
      ).toBeGreaterThanOrEqual(1);
      expect(
        new Set(请求.filter((条) => 条.method === 'GET' && 条.path.startsWith('/api/v1/organizations/')).map((条) => 条.path)),
      ).toEqual(new Set(['/api/v1/organizations/org-wire-01']));
      await 期望无溢出(page);

      // 主体切换：claim-only B 卡无组织坐标 → 零新增公开企业请求，A 的组织摘要不残留
      await 打开后端主壳(page, 'candidate');
      await page.getByRole('button', { name: '市场', exact: true }).click();
      await expect(page.getByText('展接FIX 交易中台架构师').first()).toBeVisible({ timeout: 15_000 });
      const 公开读前 = 请求.filter((条) => 条.method === 'GET' && 条.path.startsWith('/api/v1/organizations/')).length;
      await page.getByRole('button', { name: '查看职位详情' }).nth(1).click();
      await expect(page).toHaveURL(/#\/job\/job_00112233445566778899aabbccddee02$/, { timeout: 10_000 });
      await expect(page.getByText('展接FIX 缺口补齐工程师', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('img', { name: '适配 0 分' }).first()).toBeVisible();
      expect(请求.filter((条) => 条.method === 'GET' && 条.path.startsWith('/api/v1/organizations/')).length).toBe(公开读前);
      await expect(page.getByText('展接FIX 星河科技').first()).toBeVisible();
      await expect(page.getByText('金融科技')).toHaveCount(0);
      await 期望无溢出(page);

      // 局部空 D 卡：JD 描述有值 + 职位要求合法空；失败回退已在列表阶段断言过
      await 打开后端主壳(page, 'candidate');
      await page.getByRole('button', { name: '市场', exact: true }).click();
      await expect(page.getByText('展接FIX 交易中台架构师').first()).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: '查看职位详情' }).nth(3).click();
      await expect(page).toHaveURL(/#\/job\/job_00112233445566778899aabbccddee04$/, { timeout: 10_000 });
      await expect(page.getByText('展接FIX 局部空岗位：JD 描述这节有值，职位要求这节合法空。', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('职位要求未知', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('职位详情未知', { exact: true })).toHaveCount(0);
      await 期望无溢出(page);

      // 长文 C 卡：长公司名与长文本如实上屏（自然增高，不缩字号不扩容）
      await 打开后端主壳(page, 'candidate');
      await page.getByRole('button', { name: '市场', exact: true }).click();
      await expect(page.getByText('展接FIX 交易中台架构师').first()).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: '查看职位详情' }).nth(2).click();
      await expect(page).toHaveURL(/#\/job\/job_00112233445566778899aabbccddee03$/, { timeout: 10_000 });
      await expect(page.getByText('测'.repeat(80), { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('展'.repeat(48)).first()).toBeVisible();
      await 期望无溢出(page);

      // 无意外诊断：fixture 受控 404（broken logo）之外零 console/页面错误、零失败请求
      expect(诊断.pageErrors).toEqual([]);
      expect(诊断.failedRequests).toEqual([]);
      expect(诊断.consoleErrors.filter((文) => !/the server responded with a status of 404/.test(文))).toEqual([]);
      诊断.detach();
    });

    test('候选 在谈列表与详情：零当前 Job/Resume 补读、冻结正文、pre-Case 与 legacy 全空 @backend', async ({ page }) => {
      test.setTimeout(120_000);
      const { 请求 } = await 安装展接线路由(page, { role: 'candidate', 场景: '完整' });
      const 诊断 = 安装诊断(page);
      await 打开后端主壳(page, 'candidate');

      // 在谈列表（默认子视图）：只读连续集合，零逐记录详情 GET、零 Job/Resume 补读
      const 简历读 = 请求.filter((条) => 条.path === '/api/v1/me/resume').length;
      await expect(page.getByTestId('求职在谈卡').first()).toBeVisible({ timeout: 15_000 });
      expect(请求.some((条) => 条.method === 'GET' && 条.path === '/api/v1/me/negotiations')).toBe(true);
      expect(请求.filter((条) => 条.method === 'GET' && /^\/api\/v1\/me\/negotiations\/[^/]+$/.test(条.path))).toEqual([]);
      expect(请求.filter((条) => 条.method === 'GET' && 条.path.startsWith('/api/v1/jobs/'))).toEqual([]);
      await 期望无溢出(page);

      // 甲（case_started）：详情强制 GET（轮询等它落定），零 canonical Job 补读、零简历补读
      await page.getByTestId('求职在谈卡').first().click();
      await expect(page).toHaveURL(new RegExp(`#/deal/${'mc_00112233445566778899aabbccddee01'}`), { timeout: 10_000 });
      await expect(page.getByText('展接FIX 冻结企业').first()).toBeVisible({ timeout: 15_000 });
      await expect.poll(() =>
        请求.filter((条) => 条.method === 'GET' && /^\/api\/v1\/me\/negotiations\/[^/]+$/.test(条.path)).length,
        { timeout: 15_000 },
      ).toBeGreaterThanOrEqual(1);
      expect(请求.filter((条) => 条.method === 'GET' && 条.path.startsWith('/api/v1/jobs/'))).toEqual([]);
      expect(请求.filter((条) => 条.path === '/api/v1/me/resume').length).toBe(简历读);

      // 资料 Tab（职位详情）：冻结正文与公司导航来自 wire job_detail，按钮可操作不遮挡
      await page.getByRole('button', { name: '职位详情', exact: true }).click();
      await expect(page.getByText('展接FIX 冻结企业').first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('公司信息', { exact: true }).first()).toBeVisible();
      expect(请求.filter((条) => 条.method === 'GET' && 条.path.startsWith('/api/v1/jobs/'))).toEqual([]);
      expect(请求.filter((条) => 条.path.startsWith('/api/v1/organizations/'))).toEqual([]);
      await 期望无溢出(page);

      // 乙（pre-Case delegation）：聚合可渲染、Case 块缺席、零 Case 详情读、零 Job 补读
      await 打开后端主壳(page, 'candidate');
      await expect(page.getByTestId('求职在谈卡').first()).toBeVisible({ timeout: 15_000 });
      const Case读前 = 请求.filter((条) => 条.method === 'GET' && /^\/api\/v1\/me\/negotiations\/[^/]+$/.test(条.path)).length;
      await page.getByTestId('求职在谈卡').nth(1).click();
      await expect(page).toHaveURL(new RegExp(`#/deal/${'dlg_00112233445566778899aabbccddee02'}`), { timeout: 10_000 });
      await expect(page.getByText('展接FIX 缺口补齐工程师').first()).toBeVisible({ timeout: 15_000 });
      // review-r1：job_detail=null 时顶栏公司名回退同一响应外层 job.organization，
      // 资料 Tab 摘要技能消费 job.required_skills —— 已知事实不再折算成缺失/暂无
      await expect(page.getByText('· 展接FIX 企业').first()).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: '职位详情', exact: true }).click();
      await expect(page.getByText('公司信息', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Go', { exact: true }).first()).toBeVisible();
      expect(请求.filter((条) => 条.method === 'GET' && 条.path.startsWith('/api/v1/jobs/'))).toEqual([]);
      await expect.poll(() =>
        请求.filter((条) => 条.method === 'GET' && /^\/api\/v1\/me\/negotiations\/[^/]+$/.test(条.path)).length,
        { timeout: 15_000 },
      ).toBeGreaterThanOrEqual(Case读前 + 1);
      expect(请求.filter((条) => 条.method === 'GET' && 条.path.startsWith('/api/v1/jobs/'))).toEqual([]);
      await 期望无溢出(page);

      // 丙（legacy Case 全空）：match_score / job_detail 双 null → 未知占位，不补读不编造
      await 打开后端主壳(page, 'candidate');
      await expect(page.getByTestId('求职在谈卡').first()).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('求职在谈卡').nth(2).click();
      await expect(page).toHaveURL(new RegExp(`#/deal/${'mc_00112233445566778899aabbccddee03'}`), { timeout: 10_000 });
      await expect(page.getByText('公司信息缺失').first()).toBeVisible({ timeout: 15_000 });
      expect(请求.filter((条) => 条.method === 'GET' && 条.path.startsWith('/api/v1/jobs/'))).toEqual([]);

      expect(诊断.pageErrors).toEqual([]);
      expect(诊断.failedRequests).toEqual([]);
      expect(诊断.consoleErrors).toEqual([]);
      诊断.detach();
    });

    test('数据刷新由有值到空：在谈列表权威刷新后旧卡清空 @backend', async ({ page }) => {
      test.setTimeout(120_000);
      const { 请求 } = await 安装展接线路由(page, { role: 'candidate', 场景: '刷新为空' });
      const 诊断 = 安装诊断(page);
      await 打开后端主壳(page, 'candidate');

      await expect(page.getByTestId('求职在谈卡').first()).toBeVisible({ timeout: 15_000 });
      // 可见 5 秒节拍触发权威刷新：第 2 次读取返回合法空页，旧卡清空不出错误态
      await expect(page.getByText('暂时没有在谈职位。')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('求职在谈卡')).toHaveCount(0);
      expect(
        请求.filter((条) => 条.method === 'GET' && 条.path === '/api/v1/me/negotiations').length,
      ).toBeGreaterThanOrEqual(2);

      expect(诊断.pageErrors).toEqual([]);
      expect(诊断.failedRequests).toEqual([]);
      expect(诊断.consoleErrors).toEqual([]);
      诊断.detach();
    });

    test('招聘 推荐列表与匿名简历：零逐卡补读、多段简历、零候选头像请求 @backend', async ({ page }) => {
      test.setTimeout(120_000);
      const { 请求 } = await 安装展接线路由(page, { role: 'recruiter', 场景: '完整' });
      const 诊断 = 安装诊断(page);
      const 媒体请求 = 安装媒体记录(page);
      await 打开后端主壳(page, 'recruiter');

      // 推荐列表：owner 岗位 + 展开列表（既有必要请求），零逐卡详情/简历补读
      await page.getByRole('button', { name: '推荐', exact: true }).click();
      await expect(page.getByTestId('招聘推荐卡').first()).toBeVisible({ timeout: 15_000 });
      expect(请求.some((条) => 条.method === 'GET' && 条.path === '/api/v1/recruiter/jobs')).toBe(true);
      expect(
        请求.some((条) => 条.method === 'GET' && /^\/api\/v1\/recruiter\/jobs\/[^/]+\/candidate-recommendations$/.test(条.path)),
      ).toBe(true);
      expect(请求.filter((条) => 条.method === 'GET' && /\/candidate-recommendations\/[^/]+$/.test(条.path))).toEqual([]);
      await 期望无溢出(page);

      // 匿名简历详情：展开读取恰好携带 candidate_resume；多段教育/项目如实上屏
      await page.getByRole('button', { name: '查看候选画像' }).first().click();
      await expect(page).toHaveURL(/#\/hr\/jobs\/[^/]+\/recommendations\/[^/]+$/, { timeout: 10_000 });
      await expect(page.getByText('个人优势', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      expect(
        请求.filter((条) => 条.method === 'GET' && /\/candidate-recommendations\/[^/]+$/.test(条.path)).length,
      ).toBeGreaterThanOrEqual(1);
      await expect(page.getByText('展接FIX 多活改造').first()).toBeVisible();
      await expect(page.getByText('教育经历', { exact: true }).first()).toBeVisible();
      // anonymous 域：零候选身份头像请求（响应无身份对象，更不该有头像网络）
      expect(媒体请求.filter((url) => url.includes('wiring-avatar-'))).toEqual([]);
      await 期望无溢出(page);

      expect(诊断.pageErrors).toEqual([]);
      expect(诊断.failedRequests).toEqual([]);
      expect(诊断.consoleErrors).toEqual([]);
      诊断.detach();
    });

    test('招聘 在谈列表与 Case 资料：零当前 Job/Resume 补读、身份头像零请求、legacy 全空 @backend', async ({ page }) => {
      test.setTimeout(120_000);
      const { 请求 } = await 安装展接线路由(page, { role: 'recruiter', 场景: '完整' });
      const 诊断 = 安装诊断(page);
      const 媒体请求 = 安装媒体记录(page);
      await 打开后端主壳(page, 'recruiter');

      // 在谈列表：只读 match-cases 展开列表，零逐 Case 详情 GET
      await page.getByRole('button', { name: '在谈', exact: true }).click();
      await expect(page.getByTestId('招聘在谈卡').first()).toBeVisible({ timeout: 15_000 });
      expect(
        请求.some((条) => 条.method === 'GET' && 条.path === '/api/v1/recruiter/match-cases'),
      ).toBe(true);
      expect(请求.filter((条) => 条.method === 'GET' && /^\/api\/v1\/recruiter\/match-cases\/[^/]+$/.test(条.path))).toEqual([]);
      await 期望无溢出(page);

      // S1 已披露 Case：详情强制 GET（轮询等它落定）；零 Job/Resume 补读；头像 URL 只解码零请求
      await page.getByTestId('招聘在谈卡').first().click();
      await expect(page).toHaveURL(new RegExp(`#/hr/candidate/${'mc-fixture-wire-s1'}`), { timeout: 10_000 });
      await expect(page.getByText('展接FIX 交易中台架构师').first()).toBeVisible({ timeout: 15_000 });
      await expect.poll(() =>
        请求.filter((条) => 条.method === 'GET' && /^\/api\/v1\/recruiter\/match-cases\/[^/]+$/.test(条.path)).length,
        { timeout: 15_000 },
      ).toBeGreaterThanOrEqual(1);
      expect(请求.filter((条) => 条.method === 'GET' && 条.path.startsWith('/api/v1/jobs/'))).toEqual([]);

      // 资料 Tab（在线简历）：多段教育/项目如实上屏；真名与头像 URL 都不落 UI 网络
      await page.getByRole('button', { name: '在线简历', exact: true }).click();
      await expect(page.getByText('个人优势', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('展接FIX 多活改造').first()).toBeVisible();
      await expect(page.getByText('教育经历', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('展接FIX 候选真名')).toHaveCount(0);
      expect(媒体请求.filter((url) => url.includes('wiring-avatar-'))).toEqual([]);
      expect(请求.filter((条) => 条.method === 'GET' && 条.path.startsWith('/api/v1/jobs/'))).toEqual([]);
      await 期望无溢出(page);

      // legacy Case 全空：candidate_resume / job_detail / match_score 全 null → 占位而非补读
      await 打开后端主壳(page, 'recruiter');
      await page.getByRole('button', { name: '在谈', exact: true }).click();
      await expect(page.getByTestId('招聘在谈卡').first()).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('招聘在谈卡').nth(1).click();
      await expect(page).toHaveURL(new RegExp(`#/hr/candidate/${'mc-fixture-wire-legacy'}`), { timeout: 10_000 });
      await expect(page.getByText('学历缺失').first()).toBeVisible({ timeout: 15_000 });
      expect(请求.filter((条) => 条.method === 'GET' && 条.path.startsWith('/api/v1/jobs/'))).toEqual([]);

      expect(诊断.pageErrors).toEqual([]);
      expect(诊断.failedRequests).toEqual([]);
      expect(诊断.consoleErrors).toEqual([]);
      诊断.detach();
    });
  });
}
