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