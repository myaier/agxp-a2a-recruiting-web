// 把「还没修的问题」逐条截图，配合说明给产品负责人看。
// 用户原话：「你能不能打开给我看看，我看文字不知道你说的是哪里」。
//
// 无头跑（本机 Chrome），不在用户屏幕上弹窗 —— 用户明确要求过。

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const 基址 = 'http://127.0.0.1:8083';
const 出图目录 = process.argv[2] || '/tmp/问题图';
mkdirSync(出图目录, { recursive: true });

const 浏览器 = await chromium.launch({ headless: true, channel: 'chrome' });

/** 每条问题：编号、标题、怎么走到那一屏、截图文件名 */
async function 拍(编号, 标题, 走法, { 种子 } = {}) {
  const 上下文 = await 浏览器.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const 页 = await 上下文.newPage();
  if (种子) await 页.addInitScript(种子);
  try {
    await 走法(页);
    const 文件 = join(出图目录, `${编号}.png`);
    await 页.screenshot({ path: 文件, fullPage: false });
    console.log(`${编号} ✓ ${标题}`);
  } catch (错) {
    console.log(`${编号} ✗ ${标题} —— ${String(错).slice(0, 120)}`);
  }
  await 上下文.close();
}

const 停 = (页, 毫秒 = 800) => 页.waitForTimeout(毫秒);

/**
 * 切 Tab：Tab 存在全局 store，点底部导航第 序 个按钮（0 职位/人才、1 消息、2 我）。
 * 不按文字找 —— 导航项显示的是「我」而不是「我的」，按文字匹配会静默点不中，
 * 结果拍出来还是上一屏（第一版就这么拍歪了三张）。
 */
async function 切Tab(页, 序) {
  const 点到 = await 页.evaluate((序) => {
    const 们 = [...document.querySelectorAll('nav button')];
    if (!们[序]) return false;
    们[序].click();
    return true;
  }, 序);
  if (!点到) throw new Error(`底部导航第 ${序} 项点不到`);
  await 停(页);
}

// 5 · 企业「等我拍板」算对了但点不动
await 拍('问题5-企业待拍板不可点', '企业「我的」四个统计数，待拍板那个是死数字', async (页) => {
  await 页.goto(`${基址}/#/hr`, { waitUntil: 'domcontentloaded' });
  await 停(页);
  await 切Tab(页, 2);
});

// 6 · 「我的」写在谈 8，职位 Tab 只有 5 张卡（实测数，原报告的 5 对 3 是意向栏改前的旧数）
await 拍('问题6a-我的写在谈5', '求职端「我的」统计：在谈写 8', async (页) => {
  await 页.goto(`${基址}/#/app`, { waitUntil: 'domcontentloaded' });
  await 停(页);
  await 切Tab(页, 2);
});
await 拍('问题6b-职位Tab只有3张', '切回职位 Tab，在谈列表只有 5 张卡', async (页) => {
  await 页.goto(`${基址}/#/app`, { waitUntil: 'domcontentloaded' });
  await 停(页, 1000);
});

// 7 · 顶栏岗位切换 3 个岗就超宽
await 拍('问题7-顶栏岗位超宽', '招聘端顶栏：3 个在招岗位已挤坏，不滚不换行', async (页) => {
  await 页.goto(`${基址}/#/hr`, { waitUntil: 'domcontentloaded' });
  await 停(页, 1000);
});

// 8 · 两屏写完了但零入口
await 拍('问题8a-未通过说明零入口', '求职端「代理凭什么替我拒了」——屏做好了，走不到', async (页) => {
  await 页.goto(`${基址}/#/rejected`, { waitUntil: 'domcontentloaded' });
  await 停(页);
});
await 拍('问题8b-候选未通过零入口', '招聘端「代理凭什么替我筛掉他」——同样零入口', async (页) => {
  await 页.goto(`${基址}/#/hr/rejected`, { waitUntil: 'domcontentloaded' });
  await 停(页);
});

// 9 · 委托过的岗位不移出市场流
await 拍('问题9-委托后仍堵在市场', '看市场：已委托的岗位还堵在流里', async (页) => {
  await 页.goto(`${基址}/#/app`, { waitUntil: 'domcontentloaded' });
  await 停(页);
  // 切到「看市场」子视图
  await 页.evaluate(() => {
    const 项 = [...document.querySelectorAll('button')].find((元) => (元.innerText || '').trim() === '看市场');
    项?.click();
  });
  await 停(页, 1000);
}, {
  // 种子：把前两个市场岗标成已委托，好看出它们仍然留在列表里
  种子: () => {
    localStorage.setItem('AGXP已委托v1', JSON.stringify(['M-01', 'M-02']));
  },
});

// 10 · 消息未读写死
await 拍('问题10-消息未读写死', '消息 Tab：未读红点写死在假数据里，点进去出来还在', async (页) => {
  await 页.goto(`${基址}/#/app`, { waitUntil: 'domcontentloaded' });
  await 停(页);
  await 切Tab(页, 1);
});

// 11 · 岗位管理在谈数两处打架
await 拍('问题11-在谈数打架', '岗位管理：行上写「在谈 N 人」，是静态假字段', async (页) => {
  await 页.goto(`${基址}/#/hr/jobs`, { waitUntil: 'domcontentloaded' });
  await 停(页, 1000);
});

// 12 · 企业通知红点不亮 + 点进去纯白
await 拍('问题12-企业通知空白', '招聘端通知中心：两条都是已读，右上「全部已读」灰掉 —— 红点永远不亮', async (页) => {
  await 页.goto(`${基址}/#/hr/notifications`, { waitUntil: 'domcontentloaded' });
  await 停(页, 1000);
});

// 对照组：求职端通知中心的空态是做了的
await 拍('对照-求职端通知空态', '对照：求职端同一屏，有未读红点', async (页) => {
  await 页.goto(`${基址}/#/notifications`, { waitUntil: 'domcontentloaded' });
  await 停(页, 1000);
});

await 浏览器.close();
console.log(`\n图存在 ${出图目录}`);
