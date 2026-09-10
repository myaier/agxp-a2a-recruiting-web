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
// P1_CAPTURE_DIR 只在 Mock视觉 采集用例里需要；P1 Backend展示 用例（Task 5）不采集
// 也能跑（brief 的 backend 命令不带该变量），所以这里从模块加载期断言改成用例期断言，
// 采集行为（目录结构 / 文件名 / JSON schema）与 Task 1 基准逐字一致。
const P1采集根目录 = process.env.P1_CAPTURE_DIR ?? null;

let 采集子目录: { 截图目录: string; 场景目录: string } | null = null;
function 取采集目录(): { 截图目录: string; 场景目录: string } {
  if (P1采集根目录 === null) {
    throw new Error('P1_CAPTURE_DIR 未设置：P1 Mock视觉 采集需要明确输出目录');
  }
  if (采集子目录 === null) {
    const 截图目录 = join(P1采集根目录, 'screenshots');
    const 场景目录 = join(P1采集根目录, 'scenes');
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
    const 截图文件 = join(取采集目录().截图目录, `${sceneId}.png`);
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
// ═══════════════════════════════════════════════════════════════════════════
// P1 Backend展示 @backend（Task 5）
//
// 用 HTTP fixture 路由拦截证明：实际页面加载的是共享展示（职位正文/页面外壳、消息
// 列表/会话行）与同一份 CSS，Backend 数据接线（P4 岗位/P7 会话）如实上屏。零真实栈
// 访问：全部 /api/v1 请求被 e2e/fixtures/P1展示统一.ts 的 path+method 白名单捕获，
// 白名单外记录并返回受控 503 —— 请求序列来自返回的 { 请求 }，测试断言不放行真实网络。
//
// 数据场景 × 视口：完整 / 缺失 / 长文 / 错误带缓存 各在 320 与 390 宽检查无旧值残留
// （Mock 独有文案零残留、Backend 未读 0 不误套 Mock 红点语义）；职位与普通消息场景
// 断言卡片/按钮不溢出。极长标题沿用 Task 1 的隔离布局样本纪律：HTTP 长标题字段
// 如实上屏（不用测试端 DOM 替换冒充接线）；Task 1 同文本 DOM 样本只做「几何不退化」
// 检查（非收缩 / 时间被挤出视口右沿的旧有限制原样保留，如实记录，不新增绝对门禁）。
// 两栈几何对照（≤1px）由 P1_BACKEND_CAPTURE_DIR 采集 + 报告里的一次性比较完成，
// 默认命令（不带该变量）零落盘、纯断言。
// ═══════════════════════════════════════════════════════════════════════════

import { 安装P1路由 } from './fixtures/P1展示统一';
import type { P1角色 } from './fixtures/P1展示统一';

// ── Backend 采集目录（可选；只服务于两栈几何对照，默认命令零落盘）─────────────
const 后端采集根目录 = process.env.P1_BACKEND_CAPTURE_DIR ?? null;
let 后端子目录: { 截图目录: string; 场景目录: string } | null = null;
function 取后端采集目录(): { 截图目录: string; 场景目录: string } {
  if (后端采集根目录 === null) {
    throw new Error('P1_BACKEND_CAPTURE_DIR 未设置：两栈对照采集需要明确输出目录');
  }
  if (后端子目录 === null) {
    const 截图目录 = join(后端采集根目录, 'screenshots');
    const 场景目录 = join(后端采集根目录, 'scenes');
    mkdirSync(截图目录, { recursive: true });
    mkdirSync(场景目录, { recursive: true });
    后端子目录 = { 截图目录, 场景目录 };
  }
  return 后端子目录;
}

function 写后端结果(结果: 场景采集结果): void {
  const 路径名 = join(取后端采集目录().场景目录, `${结果.sceneId}.json`);
  mkdirSync(dirname(路径名), { recursive: true });
  writeFileSync(路径名, JSON.stringify(结果, null, 2));
}

// ── Backend 用例 helper ─────────────────────────────────────────────────────────

/** 采集（可选落盘）：截图 + 与 Mock 基准同 schema 的场景 JSON，供一次性两栈几何比较。 */
async function 采集后端场景(
  page: Page,
  诊断: ReturnType<typeof 安装诊断>,
  sceneId: string,
  元素们: 元素几何[],
): Promise<void> {
  if (后端采集根目录 === null) return;
  const 溢出 = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  const 截图文件 = join(取后端采集目录().截图目录, `${sceneId}.png`);
  await page.screenshot({ path: 截图文件 });
  写后端结果({
    schemaVersion: 1,
    sceneId,
    status: 'captured',
    url: page.url(),
    screenshot: `screenshots/${sceneId}.png`,
    viewport: page.viewportSize() ?? { width: 0, height: 0 },
    elements: 元素们,
    consoleErrors: [...诊断.consoleErrors],
    pageErrors: [...诊断.pageErrors],
    failedRequests: [...诊断.failedRequests],
    apiRequests: [...诊断.apiRequests],
    horizontalOverflow: 溢出,
    failure: null,
  });
}

/** 单元素几何（页面坐标系，与滚动位置无关），四舍五入到 0.01px，与 Mock 基准同精度。 */
async function 取几何(定位: Locator, 名称: string): Promise<元素几何> {
  const 框 = await 定位.boundingBox();
  if (框 === null) throw new Error(`关键元素无 boundingBox：${名称}`);
  return {
    名称,
    x: Math.round(框.x * 100) / 100,
    y: Math.round(框.y * 100) / 100,
    width: Math.round(框.width * 100) / 100,
    height: Math.round(框.height * 100) / 100,
  };
}

/** 会话行内节点的几何：标题 / 副标题 / 时间（class 由 CSS module 哈希，用包含匹配）。 */
async function 取行节点几何(
  行: Locator,
  前缀: string,
): Promise<元素几何[]> {
  const 结果们: 元素几何[] = [];
  for (const [名称, 选择器] of [
    ['标题', 'span[class*="会话标题"]'],
    ['副标题', 'span[class*="会话副标题"]'],
    ['时间', 'span[class*="会话时间"]'],
    ['摘要', 'span[class*="会话摘要"]'],
  ] as const) {
    const 节点 = 行.locator(选择器).first();
    if (await 节点.count() === 0) continue;
    结果们.push(await 取几何(节点, `${前缀} ${名称}`));
  }
  return 结果们;
}

/** 重试按钮独占一行：提示块里重试按钮的上一兄弟必须是 <br/>（Task 4 修复的独占一行结构）。 */
function 期望重试独占一行(page: Page): Promise<void> {
  return page.evaluate(() => {
    const 按钮 = Array.from(document.querySelectorAll('button')).find(
      (项) => 项.textContent?.trim() === '重试' && 项.closest('[class*="空态"]') !== null,
    );
    if (!按钮) throw new Error('未找到重试按钮');
    if (按钮.previousSibling?.nodeName !== 'BR') {
      throw new Error('重试按钮未独占一行（上一兄弟不是 <br/>）');
    }
  });
}

/** 无意外诊断：页面错误为零；console error 允许且仅允许预期的 500 资源日志（fixture 受控错误）。 */
function 期望无意外诊断(诊断: ReturnType<typeof 安装诊断>): void {
  expect(诊断.pageErrors).toEqual([]);
  expect(诊断.failedRequests).toEqual([]);
  expect(诊断.consoleErrors.filter((文) => !/the server responded with a status of 500/.test(文))).toEqual([]);
}

/** 断言页面无横向溢出（卡片/按钮不溢出；极长标题的旧有限制不在本断言范围）。 */
async function 期望无溢出(page: Page): Promise<void> {
  const 溢出 = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(溢出, '页面横向溢出').toBe(0);
}

/** 打开后端入口：清空存储 + 关动画 + 等主壳落定（candidate → /#/app，recruiter → /#/hr）。 */
async function 打开后端主壳(page: Page, role: P1角色): Promise<void> {
  await 打开稳定页面(page, '/', '未登录');
  await expect(page).toHaveURL(role === 'candidate' ? /#\/app$/ : /#\/hr$/, { timeout: 20_000 });
}

/** 等待真实后端数据上屏的关键等待都由 toBeVisible 的 15s 超时承担，不用固定 sleep。 */

const 消息定位 = (page: Page) => page.locator('nav').getByRole('button', { name: /消息/ });

const 后端宽度们 = [320, 390];

// ── 职位（candidate）──────────────────────────────────────────────────────────

for (const 宽度 of 后端宽度们) {
  test.describe(`P1 Backend展示 ${宽度} @backend`, () => {
    test.use({
      viewport: { width: 宽度, height: 844 },
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      reducedMotion: 'reduce',
    });

    // 完整：推荐缓存路径 + 双栈同文对照场景 + 更多/举报入口 + 公司有 ref
    test('完整 同文职位缓存路径、分数与页面动作 @backend', async ({ page }) => {
      test.setTimeout(120_000);
      const { 请求 } = await 安装P1路由(page, { role: 'candidate', 场景: '完整' });
      const 诊断 = 安装诊断(page);
      await 打开后端主壳(page, 'candidate');

      // 看市场列表：推荐来自按当前意向 scope 的 GET；标记文本与 Mock 基准同文（对照用）
      await page.getByRole('button', { name: '市场', exact: true }).click();
      await expect(page.getByText('交易中台架构师').first()).toBeVisible({ timeout: 15_000 });
      expect(请求.some((条) => 条.method === 'GET' && 条.path === '/api/v1/me/job-recommendations')).toBe(true);

      // 进详情：快照命中直接渲染，绝不再发 canonical job GET（P4 缓存路径回归）
      await page.getByRole('button', { name: '查看职位详情' }).first().click();
      await expect(page).toHaveURL(/#\/job\/job_00112233445566778899aabbccddee01$/, { timeout: 10_000 });
      // 等详情正文上屏（列表卡与详情都有同文职位名，先等详情独有标题避免竞态）
      await expect(page.getByText('岗位信息与职位详情', { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('交易中台架构师', { exact: true }).first()).toBeVisible();
      expect(请求.some((条) => 条.path.startsWith('/api/v1/jobs/'))).toBe(false);

      // 双栈同文对照场景：顶部区域几何与 Mock 基准同源同文
      const 顶部几何 = [
        await 取几何(page.getByText('交易中台架构师', { exact: true }).first(), '职位名'),
        await 取几何(page.getByText('60-80K', { exact: true }), '薪资'),
        await 取几何(page.getByRole('img', { name: /适配 \d+ 分/ }), '分数位 适配环'),
        await 取几何(page.getByText('匹配度分析', { exact: true }), '匹配度分析标题'),
        await 取几何(page.getByRole('button', { name: '让AI代理去谈' }), '浮动主按钮 让AI代理去谈'),
        await 取几何(page.getByRole('button', { name: '不感兴趣' }), '浮动次按钮 不感兴趣'),
      ];
      await 采集后端场景(page, 诊断, `p1-backend-job-top-${宽度}`, 顶部几何);

      // 公司有 ref：公司卡可点（有组织坐标才有打开回调）
      await expect(page.getByRole('button', { name: /美团/ }).first()).toBeVisible();

      // 更多/举报入口：⋯ → 抽屉（有推荐坐标才有「不感兴趣」项）→ 举报层
      await page.getByRole('button', { name: '更多操作' }).click();
      await expect(page.getByRole('button', { name: '不感兴趣，别再推给我' })).toBeVisible();
      await expect(page.getByRole('button', { name: '举报这个职位' })).toBeVisible();
      await page.getByRole('button', { name: '举报这个职位' }).click();
      await expect(page.getByText('交易中台架构师 · 美团')).toBeVisible();
      await page.getByRole('button', { name: '取消', exact: true }).click();
      await expect(page.getByText('交易中台架构师 · 美团')).toHaveCount(0);

      // 真实分 0：wire 给 0 就是 0 分环，不重算不省略
      await 打开后端主壳(page, 'candidate');
      await page.getByRole('button', { name: '市场', exact: true }).click();
      await expect(page.getByText('交易中台架构师').first()).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: '查看职位详情' }).nth(1).click();
      await expect(page).toHaveURL(/#\/job\/job_00112233445566778899aabbccddee02$/, { timeout: 10_000 });
      await expect(page.getByText('岗位信息与职位详情', { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('img', { name: '适配 0 分' })).toBeVisible();

      // 卡片/按钮不溢出 + 无意外诊断
      await 期望无溢出(page);
      期望无意外诊断(诊断);
      诊断.detach();
    });

    // 缺失：详情直取缺分/缺发布人/合法空正文 + 无 ref 公司不可点 + 无推荐坐标禁用
    test('缺失 详情直取缺失投影与禁用态 @backend', async ({ page }) => {
      test.setTimeout(120_000);
      const { 请求 } = await 安装P1路由(page, { role: 'candidate', 场景: '缺失' });
      const 诊断 = 安装诊断(page);
      await 打开后端主壳(page, 'candidate');

      // 直链进详情：无任何快照 → canonical job GET（P4 详情直取路径回归）
      await page.goto('/#/job/job_00112233445566778899aabbccddee03');
      await expect(page.getByText('P1FIX 缺口补齐工程师', { exact: true })).toBeVisible({ timeout: 15_000 });
      expect(请求).toContainEqual(expect.objectContaining({ method: 'GET', path: '/api/v1/jobs/job_00112233445566778899aabbccddee03' }));

      // 缺分：直取 wire 无匹配分 → 中性未知分数位，不伪造 0 分
      await expect(page.getByRole('img', { name: '匹配分未知' })).toBeVisible();
      // 合法空正文：保留原标题 + 未知占位，不出空白 JD 卡
      await expect(page.getByText('职位详情未知', { exact: true })).toBeVisible();
      await expect(page.getByText('职位要求未知', { exact: true })).toBeVisible();
      await expect(page.getByText('岗位信息与职位详情', { exact: true })).toBeVisible();
      await expect(page.getByText('职位要求（补充说明，不自动解析）', { exact: true })).toBeVisible();
      // 缺发布人：原卡位保留 + 逐字段未知占位，绝不拿公司声明合成「某某 · 企业直招」
      await expect(page.getByText('发布人姓名未知 · 企业信息未知', { exact: false })).toBeVisible();
      await expect(page.getByText('职务未知', { exact: true })).toBeVisible();
      await expect(page.getByText('发布人备注未知', { exact: true })).toBeVisible();
      await expect(page.getByRole('img', { name: '发布人图片未知' })).toBeVisible();
      // 无 ref：公司区块没有打开回调 → 不渲染按钮
      await expect(page.getByText('P1FIX 星河科技', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /P1FIX 星河科技/ })).toHaveCount(0);

      // 无推荐坐标：不感兴趣禁用，主按钮禁用且不猜坐标
      await expect(page.getByRole('button', { name: '不感兴趣' })).toBeDisabled();
      await expect(page.getByRole('button', { name: '当前求职意向暂无这条推荐' })).toBeDisabled();
      // 直取路径的更多抽屉没有「不感兴趣」项，举报是唯一非取消动作
      await page.getByRole('button', { name: '更多操作' }).click();
      await expect(page.getByRole('button', { name: '不感兴趣，别再推给我' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: '举报这个职位' })).toBeVisible();

      // 部分空：JD 描述有值、职位要求合法空 —— 一节保留原文、另一节给未知占位（Spec §6.1）
      await page.goto('/#/job/job_00112233445566778899aabbccddee06');
      await expect(page.getByText('P1FIX 部分空岗位：JD 描述这节有值，职位要求这节合法空。', { exact: true })).toBeVisible({ timeout: 15_000 });
      expect(请求).toContainEqual(expect.objectContaining({ method: 'GET', path: '/api/v1/jobs/job_00112233445566778899aabbccddee06' }));
      // 描述节保留 wire 原文，双空场景的「职位详情未知」占位不出现
      await expect(page.getByText('职位详情未知', { exact: true })).toHaveCount(0);
      // 空的职位要求节仍给未知占位，原标题不丢
      await expect(page.getByText('职位要求未知', { exact: true })).toBeVisible();
      await expect(page.getByText('职位要求（补充说明，不自动解析）', { exact: true })).toBeVisible();

      await 期望无溢出(page);
      期望无意外诊断(诊断);
      诊断.detach();
    });

    // 长文：HTTP 长标题/长正文如实上屏 + 卡片不溢出（溢出值如实记录，不设零溢出绝对门禁）
    test('长文 岗位长文如实上屏 @backend', async ({ page }) => {
      test.setTimeout(120_000);
      await 安装P1路由(page, { role: 'candidate', 场景: '长文' });
      const 诊断 = 安装诊断(page);
      await 打开后端主壳(page, 'candidate');

      await page.goto('/#/job/job_00112233445566778899aabbccddee04');
      const 长标题文本 = '测'.repeat(80);
      await expect(page.getByText(长标题文本, { exact: true })).toBeVisible({ timeout: 15_000 });

      // HTTP 接线证据：长标题与长正文段落都来自 fixture，如实上屏
      await expect(page.getByText('岗位信息与职位详情', { exact: true })).toBeVisible();
      const 正文行数 = await page.locator('[class*="卡正文"]').count();
      expect(正文行数).toBeGreaterThanOrEqual(9);
      await expect(page.getByText(/P1FIX 长文段落/).first()).toBeVisible();

      // 溢出如实记录（极长标题属既有限制；这里只在诊断 JSON 里留证，不设门禁）
      const 溢出 = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      const 诊断溢出记录 = 溢出;
      expect(Number.isInteger(诊断溢出记录)).toBe(true);
      await 采集后端场景(page, 诊断, `p1-backend-job-longtext-${宽度}`, [
        await 取几何(page.getByText(长标题文本, { exact: true }), '职位名 长标题'),
        await 取几何(page.getByRole('button', { name: '让AI代理去谈' }), '浮动主按钮'),
      ]);

      期望无意外诊断(诊断);
      诊断.detach();
    });

    // 错误带缓存：canonical job GET 500 → 失败不正常占位 + 重试独占一行
    test('错误带缓存 岗位失败不正常占位 @backend', async ({ page }) => {
      test.setTimeout(120_000);
      await 安装P1路由(page, { role: 'candidate', 场景: '错误带缓存' });
      const 诊断 = 安装诊断(page);
      await 打开后端主壳(page, 'candidate');

      await page.goto('/#/job/job_00112233445566778899aabbccddee05');
      await expect(page.getByText('职位暂时加载不了', { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('后端服务暂时不可用，请稍后重试')).toBeVisible();

      // 失败不正常占位：正常页一个字段都不出现
      await expect(page.getByText('交易中台架构师')).toHaveCount(0);
      await expect(page.getByText('P1FIX 星河科技')).toHaveCount(0);
      await expect(page.getByText('发布人姓名未知')).toHaveCount(0);
      await expect(page.getByRole('button', { name: '让AI代理去谈' })).toHaveCount(0);

      // 重试按钮独占一行：按钮顶沿不低于错误说明的底沿，且不与说明同排
      const 说明框 = await page.getByText('后端服务暂时不可用，请稍后重试').boundingBox();
      const 重试框 = await page.getByRole('button', { name: '重试', exact: true }).boundingBox();
      expect(说明框).not.toBeNull();
      expect(重试框).not.toBeNull();
      expect(重试框!.y).toBeGreaterThanOrEqual(说明框!.y + 说明框!.height);

      期望无意外诊断(诊断);
      诊断.detach();
    });

    // ── 消息（candidate + recruiter 双角色）──────────────────────────────────

    // 完整：双端行映射/未读语义/分页/搜索聚焦/页签/点击参数路由/点击前零读消息请求/read-through
    test('完整 双端消息行、分页与点击路由 @backend', async ({ page }) => {
      test.setTimeout(120_000);
      const 角色: P1角色 = 'candidate';
      const { 请求 } = await 安装P1路由(page, { role: 角色, 场景: '完整' });
      const 诊断 = 安装诊断(page);
      await 打开后端主壳(page, 角色);

      await 消息定位(page).click();
      await expect(page.getByRole('button', { name: /陆知遥/ })).toBeVisible({ timeout: 15_000 });

      // 行映射（candidate：标题=职位、副标题=地点）与 HTTP 标记值
      await expect(page.getByText('MiniMax · 直聊中 · 未走AI代理', { exact: true })).toBeVisible();
      await expect(page.getByText('新建岗，产品这边你是第一个，配 6 个工程师')).toBeVisible();
      // Mock 独有文案零残留；Backend 未读 0 不误套 Mock 红点语义（无红点无数字）
      await expect(page.getByText('AI代理动态')).toHaveCount(0);
      await expect(page.getByTestId('unread-3001')).toHaveCount(0);
      await expect(page.getByTestId('unread-3002')).toHaveCount(0);

      // 双栈同文对照场景：行框几何与 Mock 基准同源
      const 行陆 = page.getByRole('button', { name: /陆知遥/ }).first();
      const 行林 = page.getByRole('button', { name: /林筱/ }).first();
      await 采集后端场景(page, 诊断, `p1-backend-msg-all-${宽度}`, [
        await 取几何(page.getByText('消息', { exact: true }).first(), '大标题 消息'),
        await 取几何(page.getByRole('button', { name: '全部', exact: true }), '页签 全部'),
        await 取几何(page.getByRole('button', { name: '搜索' }), '搜索放大镜'),
        await 取几何(page.getByPlaceholder('搜索会话 / 公司 / 职位'), '搜索输入'),
        await 取几何(行陆, '会话行 陆知遥'),
        await 取几何(行林, '会话行 林筱'),
        ...(await 取行节点几何(行陆, '会话行 陆知遥')),
      ]);

      // 点击前不产生读消息请求
      expect(请求.filter((条) => 条.path.includes('/conversations/3001/messages'))).toEqual([]);

      // 页签：通知=明确空态，仅会话=同一已加载集合
      await page.getByRole('button', { name: '通知', exact: true }).click();
      await expect(page.getByText('还没有通知', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /陆知遥/ })).toHaveCount(0);
      await page.getByRole('button', { name: '仅会话', exact: true }).click();
      await expect(page.getByRole('button', { name: /陆知遥/ })).toBeVisible();
      await page.getByRole('button', { name: '全部', exact: true }).click();

      // 搜索聚焦（放大镜把焦点送进搜索框）+ 输入过滤
      await page.getByRole('button', { name: '搜索' }).click();
      await expect(page.getByPlaceholder('搜索会话 / 公司 / 职位')).toBeFocused();
      await page.getByPlaceholder('搜索会话 / 公司 / 职位').fill('陆知遥');
      await expect(page.getByRole('button', { name: /陆知遥/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /林筱/ })).toHaveCount(0);
      await page.getByPlaceholder('搜索会话 / 公司 / 职位').fill('');

      // 点击参数路由 → 真人会话页 read-through；点击前零读消息请求（回看）
      expect(请求.filter((条) => 条.path.includes('/conversations/3001/messages'))).toEqual([]);
      await 行陆.click();
      await expect(page).toHaveURL(/#\/chat\/human\/3001$/, { timeout: 10_000 });
      await expect(page.getByText('P1FIX 招聘：可以，下午三点见')).toBeVisible({ timeout: 10_000 });
      // read-through：渲染到的最新 user_text 恰好提交一次（属原页面行为，不算列表违规）
      await expect.poll(
        () => 请求.filter((条) => 条.method === 'PUT' && 条.path === '/api/v1/me/conversations/3001/read').length,
        { timeout: 15_000 },
      ).toBe(1);

      // 返回列表：权威刷新后行仍在（read-through 后未读归零，不本地清零也不误判违规）
      await page.getByRole('button', { name: '返回' }).click();
      await expect(page.getByRole('button', { name: /陆知遥/ })).toBeVisible({ timeout: 15_000 });

      // 分页：游标第二页经「加载更多」追加，未读正数有数字胶囊
      const 列表读前 = 请求.filter((条) => 条.method === 'GET' && 条.path === '/api/v1/me/conversations').length;
      await page.getByRole('button', { name: '加载更多' }).click();
      const 未读行 = page.getByTestId('unread-3003');
      await expect(未读行).toHaveText('2', { timeout: 15_000 });
      // 追加读恰好多一次（追加模式必带游标；窗口重建才走无游标读）
      await expect.poll(
        () => 请求.filter((条) => 条.method === 'GET' && 条.path === '/api/v1/me/conversations').length,
        { timeout: 15_000 },
      ).toBe(列表读前 + 1);

      await 期望无溢出(page);
      期望无意外诊断(诊断);
      诊断.detach();
    });

    // 完整（招聘端）：标题/副标题反转 + 点击企业参数路由 + 未读角标
    test('完整 招聘端消息行与点击路由 @backend', async ({ page }) => {
      test.setTimeout(120_000);
      const 角色: P1角色 = 'recruiter';
      const { 请求 } = await 安装P1路由(page, { role: 角色, 场景: '完整' });
      const 诊断 = 安装诊断(page);
      await 打开后端主壳(page, 角色);

      // 招聘端标题=候选侧 secondary_label（反转映射），行几何与候选端同一展示
      await 消息定位(page).click();
      const 行甲 = page.getByRole('button', { name: /MiniMax · 直聊中 · 未走AI代理/ }).first();
      await expect(行甲).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('AI代理动态')).toHaveCount(0);
      await expect(page.getByTestId('unread-3001')).toHaveCount(0);

      await 采集后端场景(page, 诊断, `p1-backend-hr-msg-all-${宽度}`, [
        await 取几何(page.getByText('消息', { exact: true }).first(), '大标题 消息'),
        await 取几何(page.getByRole('button', { name: '全部', exact: true }), '页签 全部'),
        await 取几何(page.getByPlaceholder('搜索会话 / 候选 / 岗位'), '搜索输入'),
        await 取几何(行甲, '会话行 甲'),
        await 取几何(page.getByRole('button', { name: /林筱/ }).first(), '会话行 乙'),
        ...(await 取行节点几何(行甲, '会话行 甲')),
      ]);

      // 招聘端收件箱读取与点击企业参数路由；read-through 属会话页行为
      expect(请求.some((条) => 条.method === 'GET' && 条.path === '/api/v1/recruiter/conversations')).toBe(true);
      await 行甲.click();
      await expect(page).toHaveURL(/#\/hr\/chat\/3001$/, { timeout: 10_000 });
      await expect(page.getByText('P1FIX 招聘：可以，下午三点见')).toBeVisible({ timeout: 10_000 });

      await 期望无溢出(page);
      期望无意外诊断(诊断);
      诊断.detach();
    });

    // 缺失：无上下文降级、无 lastMessage 缺省、未读正数
    test('缺失 无上下文、无 lastMessage 与未读 @backend', async ({ page }) => {
      test.setTimeout(120_000);
      const { 请求 } = await 安装P1路由(page, { role: 'candidate', 场景: '缺失' });
      const 诊断 = 安装诊断(page);
      await 打开后端主壳(page, 'candidate');

      await 消息定位(page).click();
      const 降级行 = page.getByRole('button', { name: /会话信息暂不可用/ }).first();
      await expect(降级行).toBeVisible({ timeout: 15_000 });
      // context 不可用只降级展示：标题统一降级、副标题留空（不生成会被误当身份的未知姓名）；
      // 消息事实仍在 —— last_message 在场，摘要照常上屏
      const 降级节点 = await 取行节点几何(降级行, '降级行');
      const 副标题 = 降级节点.find((条) => 条.名称 === '降级行 副标题');
      expect(副标题).toBeDefined();
      await expect(降级行).toContainText('P1FIX 摘要：可以，下午三点见');
      // 无 lastMessage 行：摘要缺省「已建立真人会话」，不生成假预览
      const 无lastMessage行 = page.getByRole('button', { name: /P1FIX 职位 3002/ }).first();
      await expect(无lastMessage行).toContainText('已建立真人会话');
      // 未读正数行：数字胶囊
      await expect(page.getByTestId('unread-3003')).toHaveText('3');
      await expect(page.getByText('AI代理动态')).toHaveCount(0);

      // 降级行仍可点进会话：消息事实仍在，读写不受影响
      await 降级行.click();
      await expect(page).toHaveURL(/#\/chat\/human\/3001$/, { timeout: 10_000 });
      await expect(page.getByText('P1FIX 招聘：可以，下午三点见')).toBeVisible({ timeout: 10_000 });
      expect(请求.some((条) => 条.method === 'GET' && 条.path === '/api/v1/me/conversations/3001')).toBe(true);

      await 期望无溢出(page);
      期望无意外诊断(诊断);
      诊断.detach();
    });

    // 长文：HTTP 长标题如实上屏 + 长副标题/长摘要既有单行截断 + Task 1 同文本样本几何不退化
    test('长文 长标题与截断限制如实记录 @backend', async ({ page }) => {
      test.setTimeout(120_000);
      await 安装P1路由(page, { role: 'candidate', 场景: '长文' });
      const 诊断 = 安装诊断(page);
      await 打开后端主壳(page, 'candidate');

      await 消息定位(page).click();
      const 长标题文本 = '测'.repeat(80);
      const 长标题行 = page.getByRole('button', { name: /P1FIX 市/ }).first();
      await expect(长标题行).toBeVisible({ timeout: 15_000 });

      // HTTP 长标题字段如实上屏（fixture 数据，非 DOM 替换）
      await expect(page.getByText(长标题文本, { exact: true })).toBeVisible();
      const 长标题几何 = await 取几何(page.getByText(长标题文本, { exact: true }), '长标题 HTTP 标题');
      // 旧有限制如实记录：标题不收缩不换行（宽度超出视口），时间被挤出视口右沿 —— 不修不门禁
      expect(长标题几何.width).toBeGreaterThan(宽度);

      // 正常长度标题 + 长副标题/长摘要：既有单行截断生效，时间不被挤出或遮住
      const 长副标题行 = page.getByRole('button', { name: /P1FIX 正常长度标题/ }).first();
      await expect(长副标题行).toBeVisible();
      const 节点 = await 取行节点几何(长副标题行, '长副标题行');
      const 标题节点 = 节点.find((条) => 条.名称 === '长副标题行 标题');
      const 副标题节点 = 节点.find((条) => 条.名称 === '长副标题行 副标题');
      const 时间节点 = 节点.find((条) => 条.名称 === '长副标题行 时间');
      expect(标题节点 && 副标题节点 && 时间节点).toBeTruthy();
      expect(副标题节点!.x + 副标题节点!.width).toBeLessThanOrEqual(时间节点!.x);
      expect(时间节点!.x + 时间节点!.width).toBeLessThanOrEqual(宽度);

      // Task 1 同文本隔离布局样本：对正常行做同一 80 汉字 DOM 替换，几何不退化
      const 样本 = await 记长标题几何(page, 'P1FIX 正常长度标题', '08-30');
      const 样本标题 = 样本.find((条) => 条.名称 === '长标题样本 标题');
      const 样本时间 = 样本.find((条) => 条.名称 === '长标题样本 时间');
      const 样本行 = 样本.find((条) => 条.名称 === '长标题样本 会话行');
      expect(样本标题 && 样本时间 && 样本行).toBeTruthy();
      // 与 Mock 基准同行为：标题非收缩（宽度超视口）、时间被挤出视口右沿、行框 73 高不变
      expect(样本标题!.width).toBeGreaterThan(宽度);
      expect(样本时间!.x).toBeGreaterThan(宽度);
      expect(样本行!.height).toBeCloseTo(73, 1);

      await 采集后端场景(page, 诊断, `p1-backend-msg-longtitle-${宽度}`, [
        长标题几何,
        ...节点,
        ...样本,
      ]);

      await 期望无溢出(page);
      期望无意外诊断(诊断);
      诊断.detach();
    });

    // 错误带缓存：错误行与缓存行共存（重试按钮独占一行）→ 再重试为合法空页，无旧值残留
    test('错误带缓存 错误缓存共存与刷新为空 @backend', async ({ page }) => {
      test.setTimeout(120_000);
      const { 请求 } = await 安装P1路由(page, { role: 'candidate', 场景: '错误带缓存' });
      const 诊断 = 安装诊断(page);
      await 打开后端主壳(page, 'candidate');

      // 相位 1–2（主壳首屏水合 + 进消息 Tab force）：缓存行就绪
      await 消息定位(page).click();
      const 缓存行 = page.getByRole('button', { name: /P1FIX 职位 3001/ }).first();
      await expect(缓存行).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('unread-3001')).toHaveText('1');

      // 相位 3（离 Tab 再进 → force 重读）：500 → 错误行 + 缓存行共存；重试按钮独占一行
      await page.locator('nav').getByRole('button', { name: '职位', exact: true }).click();
      await 消息定位(page).click();
      await expect(缓存行).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('请求失败，请稍后重试').first()).toBeVisible({ timeout: 15_000 });
      await expect(缓存行).toBeVisible();
      // 错误行与缓存行共存，且重试按钮独占一行（Task 4 修复的列表提示结构）
      await 期望重试独占一行(page);
      const 重试框 = await page.getByRole('button', { name: '重试', exact: true }).boundingBox();
      expect(重试框).not.toBeNull();
      expect(重试框!.x + 重试框!.width).toBeLessThanOrEqual(宽度);

      // 相位 4（再重试）：合法空页 → 行与未读标记全部消失，无旧文本残留
      await page.getByRole('button', { name: '重试', exact: true }).click();
      await expect(page.getByText('还没有真人会话', { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: /P1FIX 职位 3001/ })).toHaveCount(0);
      // 相位证据：无游标列表读恰好 4 次（水合 / Tab force / 重试 / 重试），带游标零次
      const 无游标读 = 请求.filter((条) => 条.method === 'GET' && 条.path === '/api/v1/me/conversations');
      expect(无游标读.length).toBe(4);
      await expect(page.getByTestId('unread-3001')).toHaveCount(0);
      await expect(page.getByText('请求失败，请稍后重试')).toHaveCount(0);

      await 期望无溢出(page);
      期望无意外诊断(诊断);
      诊断.detach();
    });
  });
}
