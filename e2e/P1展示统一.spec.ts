// e2e/P1展示统一.spec.ts
// P1 职位详情与双端消息列表展示统一 · Task 1：冻结 Mockup 与采集基线。
//
// 在未改任何产品代码前，为当前 Mockup 的三页（职位详情、求职端消息、招聘端消息）
// 与直聊嵌入职位正文建立可重复采集的视觉基准。后续 Task 2–4 的改造候选采集与
// 本基准按 sceneId 逐场景走 e2e/视觉回归/比较器 比较。
//
// 边界（与冻结 Spec / Global Constraints 对齐）：
//   · 只采集，不断言产品语义；横向溢出、console/API 诊断忠实写进 JSON，不在采集期
//     拦截 —— 若当前 Mockup 自身有溢出，基准如实记录，由报告/对账收口。
//   · 不 import e2e/数据源模式.spec.ts（会触发整套测试注册），不 import
//     e2e/视觉回归/场景.ts；只复用 稳定页面.ts 的 打开稳定页面/安装诊断 与 类型.ts 的
//     场景采集结果 schema（比较器按它读目录）。
//   · 普通 Mock 场景零 /api/v1 请求；apiRequests 只记录不放宽。
//   · 极长标题隔离布局样本：在测试端把同一会话标题 DOM 文本替换为固定 80 个汉字，
//     基准/候选执行完全相同的替换；不改 class/style、不改产品 fixture。
//     该样本只证明布局不退化，不作为 HTTP 接线证据。
//   · 招聘端真人会话行通过原 Mock 用户动作（接受方案 → 确认意向）推进到 S3 再进消息，
//     不用「姓名已存在」假作完成；就绪断言钉住 S3 之后的真人行。
//
// 采集命令（基准）：
//   P1_CAPTURE_DIR=ui-regression-output/p1/reference npm run test:e2e:data-source -- \
//     e2e/P1展示统一.spec.ts --project=mock-stg --grep 'P1 Mock视觉' --workers=1
// 候选采集同一命令换 P1_CAPTURE_DIR 即可；sceneId 含视口宽度，两个宽度互不覆盖。

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { 安装诊断, 打开稳定页面 } from './视觉回归/稳定页面';
import type { 场景采集结果, 场景状态种子, 元素几何 } from './视觉回归/类型';
import { 路径 } from '../src/路由/路径表';

// ── 采集目录（测试专用环境变量，不新增产品 env）─────────────────────────
const 输出目录 = process.env.P1_CAPTURE_DIR;
if (!输出目录) {
  throw new Error('P1_CAPTURE_DIR 未设置：P1 采集 spec 需要明确输出目录');
}

const 截图目录 = join(输出目录, 'screenshots');
const 场景目录 = join(输出目录, 'scenes');
mkdirSync(截图目录, { recursive: true });
mkdirSync(场景目录, { recursive: true });

function 写结果(结果: 场景采集结果): void {
  const 路径名 = join(场景目录, `${结果.sceneId}.json`);
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

/** 把指定滚动容器滚到最底（公司/发布人段）。选择器必须是该屏唯一的滚动容器；
 *  滚动区 是全局类（非 CSS module），详情正文区是 CSS module 类名（带哈希，用包含匹配）。 */
async function 滚到底(page: Page, 容器选择器: string): Promise<void> {
  await page.evaluate((选择器) => {
    const 容器 = document.querySelector(选择器);
    if (!容器) throw new Error(`滚动容器未找到：${选择器}`);
    容器.scrollTop = 容器.scrollHeight;
  }, 容器选择器);
}

/** 极长标题样本的固定 80 个汉字。基准与候选执行同一常量，一字不差。 */
const 极长标题 = '测'.repeat(80);

/**
 * 测试端 DOM 文本替换：把「标题文本 = 原标题」的会话行标题替换为 极长标题，
 * 随后记录 标题 / 时间 / 行框 三块几何。只动 textContent，不改 class/style、
 * 不写回任何状态 —— 基准与候选跑同一替换，样本只证明布局不退化。
 */
async function 记长标题几何(page: Page, 原标题: string, 时间: string): Promise<元素几何[]> {
  return page.evaluate(
    ([原标题, 新标题, 时间文本]) => {
      const 取框 = (节点: Element, 名称: string) => {
        const 框 = 节点.getBoundingClientRect();
        return {
          名称,
          x: Math.round(框.x * 100) / 100,
          y: Math.round(框.y * 100) / 100,
          width: Math.round(框.width * 100) / 100,
          height: Math.round(框.height * 100) / 100,
        };
      };
      const 行 = Array.from(document.querySelectorAll('button')).find((按钮) =>
        按钮.textContent?.includes(原标题),
      );
      if (!行) throw new Error(`长标题样本未找到会话行：${原标题}`);
      const span们 = Array.from(行.querySelectorAll('span'));
      const 标题节点 = span们.find((节点) => 节点.textContent?.trim() === 原标题);
      if (!标题节点) throw new Error(`长标题样本未找到标题节点：${原标题}`);
      const 时间节点 = span们.find((节点) => 节点.textContent?.trim() === 时间文本);
      标题节点.textContent = 新标题;
      const 结果们: 元素几何[] = [];
      结果们.push(取框(标题节点, '长标题样本 标题'));
      if (时间节点) 结果们.push(取框(时间节点, '长标题样本 时间'));
      结果们.push(取框(行, '长标题样本 会话行'));
      return 结果们;
    },
    [原标题, 极长标题, 时间],
  );
}

// ── 场景定义 ──────────────────────────────────────────────────────────

interface P1场景 {
  /** sceneId 基名；运行时追加视口宽度（如 p1-job-top-320），两个宽度互不覆盖 */
  基名: string;
  状态: 场景状态种子;
  到达(page: Page): Promise<void>;
  就绪(page: Page): Promise<void>;
  关键元素(page: Page): 关键元素描述[];
  /** 长标题样本等测试端 DOM 变更后的补充几何（locator 拿不到的替换后文本） */
  追加几何?(page: Page): Promise<元素几何[]>;
}

const 求职端: 场景状态种子 = '求职端已注册';
const 招聘端: 场景状态种子 = '招聘端已注册';

/** Mock 职位详情：高匹配演示岗 M-13（JD / 公司 / 发布人 fixture 齐全） */
const 职位路径 = `/#${路径.职位详情('M-13')}`;
/** Mock 直聊（带岗位编号）：同一岗位 M-13 的直聊页 + 看职位覆盖层 */
const 直聊路径 = `/#${路径.直聊会话岗位('M-13')}`;

// —— 职位详情（Mock）——

const 职位顶部场景: P1场景 = {
  基名: 'p1-job-top',
  状态: 求职端,
  async 到达(page) {
    await 打开稳定页面(page, 职位路径, 求职端);
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
      { 名称: '浮动次按钮 不感兴趣', 定位: page.getByRole('button', { name: '不感兴趣' }) },
    ];
  },
};

const 职位公司发布人场景: P1场景 = {
  基名: 'p1-job-company-publisher',
  状态: 求职端,
  async 到达(page) {
    await 打开稳定页面(page, 职位路径, 求职端);
    await expect(page.getByText('交易中台架构师', { exact: true })).toBeVisible();
    await 滚到底(page, '.滚动区');
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
      { 名称: '直接聊按钮', 定位: page.getByRole('button', { name: '直接聊' }) },
      { 名称: '浮动主按钮 让AI代理去谈', 定位: page.getByRole('button', { name: '让AI代理去谈' }) },
    ];
  },
};

const 职位更多层场景: P1场景 = {
  基名: 'p1-job-more-drawer',
  状态: 求职端,
  async 到达(page) {
    await 打开稳定页面(page, 职位路径, 求职端);
    await expect(page.getByText('交易中台架构师', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '更多操作' }).click();
  },
  async 就绪(page) {
    await expect(page.getByRole('button', { name: '取消', exact: true })).toBeVisible();
  },
  关键元素(page) {
    return [
      { 名称: '抽屉项 不感兴趣别再推给我', 定位: page.getByRole('button', { name: '不感兴趣，别再推给我' }) },
      { 名称: '抽屉项 举报这个职位', 定位: page.getByRole('button', { name: '举报这个职位' }) },
      { 名称: '抽屉项 取消', 定位: page.getByRole('button', { name: '取消', exact: true }) },
    ];
  },
};

// —— 求职端消息列表（Mock）——

const 求职消息页 = async (page: Page): Promise<void> => {
  await 打开稳定页面(page, '/#/app', 求职端);
  await expect(page.locator('nav').getByRole('button', { name: /消息/ })).toBeVisible();
  await page.locator('nav').getByRole('button', { name: /消息/ }).click();
};

const 求职消息全部场景: P1场景 = {
  基名: 'p1-candidate-msg-all',
  状态: 求职端,
  async 到达(page) {
    await 求职消息页(page);
  },
  async 就绪(page) {
    await expect(page.getByRole('button', { name: /AI代理动态/ }).first()).toBeVisible();
  },
  关键元素(page) {
    return [
      { 名称: '大标题 消息', 定位: page.getByText('消息', { exact: true }).first() },
      { 名称: '页签 全部', 定位: page.getByRole('button', { name: '全部', exact: true }) },
      { 名称: '搜索放大镜', 定位: page.getByRole('button', { name: '搜索' }) },
      { 名称: '搜索输入', 定位: page.getByPlaceholder('搜索会话 / 公司 / 职位') },
      { 名称: '首行 AI代理动态', 定位: page.getByRole('button', { name: /AI代理动态/ }).first() },
      { 名称: '首行未读徽标', 定位: page.getByRole('button', { name: /AI代理动态/ }).first().getByText('4', { exact: true }) },
      { 名称: '直聊行 陆知遥', 定位: page.getByRole('button', { name: /陆知遥/ }) },
      { 名称: '真人行 林筱', 定位: page.getByRole('button', { name: /林筱/ }) },
    ];
  },
};

const 求职消息通知场景: P1场景 = {
  基名: 'p1-candidate-msg-notice',
  状态: 求职端,
  async 到达(page) {
    await 求职消息页(page);
    await page.getByRole('button', { name: '通知', exact: true }).click();
  },
  async 就绪(page) {
    await expect(page.getByRole('button', { name: /AI代理动态/ }).first()).toBeVisible();
  },
  关键元素(page) {
    return [
      { 名称: '页签 通知', 定位: page.getByRole('button', { name: '通知', exact: true }) },
      { 名称: '首行 AI代理动态', 定位: page.getByRole('button', { name: /AI代理动态/ }).first() },
      { 名称: '首行未读徽标', 定位: page.getByRole('button', { name: /AI代理动态/ }).first().getByText('4', { exact: true }) },
    ];
  },
};

const 求职消息搜索场景: P1场景 = {
  基名: 'p1-candidate-msg-search',
  状态: 求职端,
  async 到达(page) {
    await 求职消息页(page);
    await page.getByPlaceholder('搜索会话 / 公司 / 职位').fill('MiniMax');
  },
  async 就绪(page) {
    await expect(page.getByRole('button', { name: /陆知遥/ })).toBeVisible();
  },
  关键元素(page) {
    return [
      { 名称: '搜索输入', 定位: page.getByPlaceholder('搜索会话 / 公司 / 职位') },
      { 名称: '过滤后首行 陆知遥', 定位: page.getByRole('button', { name: /陆知遥/ }) },
    ];
  },
};

const 求职消息长标题场景: P1场景 = {
  基名: 'p1-candidate-msg-longtitle',
  状态: 求职端,
  async 到达(page) {
    await 求职消息页(page);
  },
  async 就绪(page) {
    // 文本被测试端替换，标题按摘要定位；替换后仍可见即样本成立
    await expect(page.getByRole('button', { name: /替你拒绝了薪资带无交集/ })).toBeVisible();
    await 等落定(page);
  },
  关键元素(page) {
    return [
      { 名称: '样本会话行', 定位: page.getByRole('button', { name: /替你拒绝了薪资带无交集/ }) },
      { 名称: '页签 全部', 定位: page.getByRole('button', { name: '全部', exact: true }) },
    ];
  },
  async 追加几何(page) {
    return 记长标题几何(page, 'AI代理动态', '刚刚');
  },
};

// —— 直聊（Mock）：聊天页 + 看职位覆盖层（嵌入职位正文）——

const 直聊默认场景: P1场景 = {
  基名: 'p1-chat-default',
  状态: 求职端,
  async 到达(page) {
    await 打开稳定页面(page, 直聊路径, 求职端);
  },
  async 就绪(page) {
    await expect(page.getByRole('button', { name: '看职位' })).toBeVisible();
  },
  关键元素(page) {
    return [
      { 名称: '返回栏标题 梁思远', 定位: page.getByText('梁思远', { exact: true }) },
      { 名称: '操作排主项 看职位', 定位: page.getByRole('button', { name: '看职位' }) },
      { 名称: '旁听条', 定位: page.getByText('你选择了自己聊，AI代理在旁听：只提醒、不插话') },
      { 名称: '输入条', 定位: page.getByPlaceholder('发消息…') },
    ];
  },
};

const 直聊看职位层场景: P1场景 = {
  基名: 'p1-chat-job-overlay',
  状态: 求职端,
  async 到达(page) {
    await 打开稳定页面(page, 直聊路径, 求职端);
    await expect(page.getByRole('button', { name: '看职位' })).toBeVisible();
    await page.getByRole('button', { name: '看职位' }).click();
  },
  async 就绪(page) {
    await expect(page.getByRole('button', { name: '继续沟通' })).toBeVisible();
    await expect(page.getByText('交易中台架构师', { exact: true })).toBeVisible();
  },
  关键元素(page) {
    return [
      { 名称: '职位名', 定位: page.getByText('交易中台架构师', { exact: true }) },
      { 名称: '分数位 适配环', 定位: page.getByRole('img', { name: /适配 \d+ 分/ }) },
      { 名称: 'JD卡标题 职位详情', 定位: page.getByText('职位详情', { exact: true }) },
      { 名称: '继续沟通按钮', 定位: page.getByRole('button', { name: '继续沟通' }) },
    ];
  },
};

const 直聊看职位层公司段场景: P1场景 = {
  基名: 'p1-chat-job-overlay-company',
  状态: 求职端,
  async 到达(page) {
    await 打开稳定页面(page, 直聊路径, 求职端);
    await expect(page.getByRole('button', { name: '看职位' })).toBeVisible();
    await page.getByRole('button', { name: '看职位' }).click();
    await expect(page.getByRole('button', { name: '继续沟通' })).toBeVisible();
    await 滚到底(page, '[class*="详情正文区"]');
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
      { 名称: '继续沟通按钮', 定位: page.getByRole('button', { name: '继续沟通' }) },
    ];
  },
};

// —— 招聘端消息列表（Mock）——
// 真人行通过原 Mock 用户动作推进到 S3：接受方案 → 收起记忆弹层 → 确认意向（开始私聊）。
// 就绪断言钉住 S3 之后的沈亦舟真人行，不用「姓名已存在」假作完成。

const 招聘推进S3进消息 = async (page: Page): Promise<void> => {
  await 打开稳定页面(page, '/#/hr/candidate/A-01', 招聘端);
  await expect(page.getByRole('button', { name: '接受', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '接受', exact: true }).click();
  await expect(page.getByRole('button', { name: '只这一次' })).toBeVisible();
  await page.getByRole('button', { name: '只这一次' }).click();
  await expect(page.getByRole('button', { name: '开始私聊 ›' })).toBeVisible();
  await page.getByRole('button', { name: '开始私聊 ›' }).click();
  await expect(page).toHaveURL(/#\/hr\/chat$/);
  // 同文档 hash 导航不重载：S3 的 reducer 状态保留
  await page.goto('/#/hr');
  await expect(page.locator('nav').getByRole('button', { name: /消息/ })).toBeVisible();
  await page.locator('nav').getByRole('button', { name: /消息/ }).click();
};

const 招聘消息全部场景: P1场景 = {
  基名: 'p1-hr-msg-all',
  状态: 招聘端,
  async 到达(page) {
    await 招聘推进S3进消息(page);
  },
  async 就绪(page) {
    await expect(page.getByRole('button', { name: /沈亦舟/ })).toBeVisible();
  },
  关键元素(page) {
    return [
      { 名称: '大标题 消息', 定位: page.getByText('消息', { exact: true }).first() },
      { 名称: '页签 全部', 定位: page.getByRole('button', { name: '全部', exact: true }) },
      { 名称: '搜索输入', 定位: page.getByPlaceholder('搜索会话 / 候选 / 岗位') },
      { 名称: '首行 AI代理动态', 定位: page.getByRole('button', { name: /AI代理动态/ }).first() },
      { 名称: '首行未读徽标', 定位: page.getByRole('button', { name: /AI代理动态/ }).first().getByText('2', { exact: true }) },
      { 名称: '真人行 沈亦舟', 定位: page.getByRole('button', { name: /沈亦舟/ }) },
    ];
  },
};

const 招聘消息通知场景: P1场景 = {
  基名: 'p1-hr-msg-notice',
  状态: 招聘端,
  async 到达(page) {
    await 招聘推进S3进消息(page);
    await page.getByRole('button', { name: '通知', exact: true }).click();
  },
  async 就绪(page) {
    await expect(page.getByRole('button', { name: /AI代理动态/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /沈亦舟/ })).toHaveCount(0);
  },
  关键元素(page) {
    return [
      { 名称: '页签 通知', 定位: page.getByRole('button', { name: '通知', exact: true }) },
      { 名称: '首行 AI代理动态', 定位: page.getByRole('button', { name: /AI代理动态/ }).first() },
      { 名称: '首行未读徽标', 定位: page.getByRole('button', { name: /AI代理动态/ }).first().getByText('2', { exact: true }) },
    ];
  },
};

const 招聘消息搜索场景: P1场景 = {
  基名: 'p1-hr-msg-search',
  状态: 招聘端,
  async 到达(page) {
    await 招聘推进S3进消息(page);
    await page.getByPlaceholder('搜索会话 / 候选 / 岗位').fill('沈亦舟');
  },
  async 就绪(page) {
    await expect(page.getByRole('button', { name: /沈亦舟/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /AI代理动态/ })).toHaveCount(0);
  },
  关键元素(page) {
    return [
      { 名称: '搜索输入', 定位: page.getByPlaceholder('搜索会话 / 候选 / 岗位') },
      { 名称: '过滤后首行 沈亦舟', 定位: page.getByRole('button', { name: /沈亦舟/ }) },
    ];
  },
};

const 招聘消息长标题场景: P1场景 = {
  基名: 'p1-hr-msg-longtitle',
  状态: 招聘端,
  async 到达(page) {
    await 招聘推进S3进消息(page);
  },
  async 就绪(page) {
    await expect(page.getByRole('button', { name: /本周替你初筛 23 人/ })).toBeVisible();
    await 等落定(page);
  },
  关键元素(page) {
    return [
      { 名称: '样本会话行', 定位: page.getByRole('button', { name: /本周替你初筛 23 人/ }) },
      { 名称: '页签 全部', 定位: page.getByRole('button', { name: '全部', exact: true }) },
    ];
  },
  async 追加几何(page) {
    return 记长标题几何(page, 'AI代理动态', '刚刚');
  },
};

const P1场景们: P1场景[] = [
  职位顶部场景,
  职位公司发布人场景,
  职位更多层场景,
  求职消息全部场景,
  求职消息通知场景,
  求职消息搜索场景,
  求职消息长标题场景,
  直聊默认场景,
  直聊看职位层场景,
  直聊看职位层公司段场景,
  招聘消息全部场景,
  招聘消息通知场景,
  招聘消息搜索场景,
  招聘消息长标题场景,
];

// ── 采集执行：每场景 × 每视口宽度一个 test，sceneId 含宽度 ─────────────

async function 采集场景(page: Page, 场景: P1场景, 宽度: number): Promise<void> {
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
    if (场景.追加几何) {
      元素们.push(...(await 场景.追加几何(page)));
      await 等落定(page);
    }

    // 横向溢出：忠实记录，不在采集期拦截 —— Mockup 自身溢出也是基准的一部分
    const 溢出 = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    const 视窗 = page.viewportSize() ?? { width: 0, height: 0 };
    const 截图文件 = join(截图目录, `${sceneId}.png`);
    await page.screenshot({ path: 截图文件 });

    结果 = {
      schemaVersion: 1,
      sceneId,
      status: 'captured',
      url: page.url(),
      // 存相对 P1_CAPTURE_DIR 的路径，与比较器 join(captureDir, screenshot) 契约一致
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
  test.describe(`P1 Mock视觉 ${宽度} @mock`, () => {
    // 冻结环境：locale / timezone / reducedMotion 基准与候选完全一致
    test.use({
      viewport: { width: 宽度, height: 844 },
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      reducedMotion: 'reduce',
    });

    for (const 场景 of P1场景们) {
      test(`采集 ${场景.基名} @mock`, async ({ page }) => {
        test.setTimeout(120_000);
        await 采集场景(page, 场景, 宽度);
      });
    }
  });
}