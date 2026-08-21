// 全流程爬测：把每个页面上的每个可点元素都点一遍，机械穷举「点了会怎样」。
//
// 为什么要爬虫而不是派人逐屏点：用户报的那类 bug（返回一步再前进就白屏）
// 是**状态 bug** —— 要撞上它得走特定顺序，人工点容易漏，单元测试根本抓不到。
// 机械穷举能保证「每个按钮都被点过、每次点完都返回验过一次」，覆盖率可核对。
//
// 无头跑（用本机 Chrome，headless），不会在用户屏幕上弹窗口。
//
// 每个 (页面, 元素) 组合都开一个**全新页面**并重灌种子状态再点：
// 否则前一次点击留下的脏状态会污染后面所有结论，跑出来的 bug 分不清是真是假。
//
// 用法：node 脚本/全流程爬测.mjs [输出目录]

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const 基址 = 'http://127.0.0.1:8083';
const 输出目录 = process.argv[2] || '/tmp/爬测';
mkdirSync(输出目录, { recursive: true });

/** 种子状态：让 app 认为「已登录 + 已走完注册引导」，否则大半屏进不去 */
const 种子 = {
  // 字段名必须与 应用状态.tsx 的 基本信息初始 一致（真名 / 开始工作年 / 身份）。
  // 曾经这里错写成「姓名」，导致 /agent 与 /resume 直接白屏 —— 顺带暴露了那两屏
  // 对缺字段没有任何兜底（问AI代理.tsx:37 的 真名.charAt(0)、我的简历.tsx:43 的 真名.trim()）。
  AGXP简历v2: JSON.stringify({
    基本信息: { 真名: '沈亦舟', 开始工作年: '2017', 身份: '在职' },
    经历: [], 教育: [], 技能: [], 个人优势: '九年后端，主导过交易网关重建。',
  }),
  AGXP求职筛选v1: JSON.stringify({
    职位: ['后端开发'], 城市们: ['上海'],
    薪资: { 下限: 50, 上限: 65, 单位: '月薪K' },
    筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['混合'] },
  }),
};

const 静态路由 = [
  '/', '/identity', '/identity?switch=1&from=app', '/identity?switch=1&from=hr',
  '/student', '/basic', '/experience', '/wizard', '/wizard?stage=salary', '/disclosure',
  '/onboard/city', '/onboard/job', '/onboard/status', '/onboard/degree', '/onboard/school',
  '/onboard/major', '/onboard/eduyears', '/onboard/avatar',
  '/app', '/agent', '/agent/me', '/chat/direct', '/chat/human',
  '/intentions', '/intentions/new', '/intentions/cities', '/intentions/industries',
  '/rules', '/resume', '/rejected', '/notifications', '/settings', '/blocklist',
  '/disclosure-prefs', '/archived', '/help', '/account', '/feedback', '/terms', '/visitors',
  '/hr/verify', '/hr/card', '/hr/post-job', '/hr/company-profile', '/hr', '/hr/rejected',
  '/hr/agent', '/hr/chat', '/hr/jobs', '/hr/agent/me', '/hr/agent-settings',
  '/hr/notifications', '/hr/settings', '/hr/disclosure', '/hr/screened-out', '/hr/screening-log',
];

/** 带参路由用真实存在的编号各展一条 —— 详情页是 bug 高发区，不能因为带参就跳过 */
const 带参路由 = [
  '/deal/J-01', '/thread/J-01', '/job/J-01', '/company/C-01', '/intentions/I-01',
  '/hr/candidate/A-01', '/hr/thread/A-01', '/hr/job/P-01', '/hr/resume/A-01',
  '/hr/company-profile/basic', '/hr/company-profile/welfare', '/hr/company-profile/intro',
  '/hr/company-profile/album', '/hr/company-profile/product', '/hr/company-profile/team',
  '/hr/screening-log/A-07', '/hr/screening-log/A-09', '/hr/post-job/P-01',
];

const 全部路由 = [...静态路由, ...带参路由];

/** 一屏「是不是空的」：可见文字太少就当渲染失败（白屏 bug 的机器判据） */
const 空屏阈值 = 12;

async function 开页(浏览器) {
  const 上下文 = await 浏览器.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const 页 = await 上下文.newPage();
  const 报错 = [];
  页.on('console', (条) => {
    if (条.type() === 'error') 报错.push(条.text().slice(0, 200));
  });
  页.on('pageerror', (错) => 报错.push('PAGEERROR: ' + String(错).slice(0, 200)));
  // 种子必须在任何脚本跑之前灌进去，否则 useState 惰性初值已经读过空的 localStorage
  await 页.addInitScript((种) => {
    for (const [键, 值] of Object.entries(种)) localStorage.setItem(键, 值);
  }, 种子);
  return { 上下文, 页, 报错 };
}

/**
 * 打开目标路由，并且**先垫一层历史**。
 *
 * 第一版直接 goto 目标路由，于是它成了历史里的第一条，点返回键 `‹` 就退出整个 App
 * 到空白页 —— 883 次点击里 85 个「白屏」有 70 个是这么来的，全是方法学假象，
 * 真实用户永远是从上一屏走过来的。先落一次首页再进目标，返回才有地方可去。
 */
async function 到(页, 路由) {
  await 页.goto(`${基址}/#/app`, { waitUntil: 'domcontentloaded' });
  await 页.waitForTimeout(250);
  await 页.goto(`${基址}/#${路由}`, { waitUntil: 'domcontentloaded' });
  await 页.waitForTimeout(600);
}

async function 快照(页) {
  return 页.evaluate(() => {
    const 文 = (document.body.innerText || '').trim();
    // 指纹要能反映「选中态变了但文字没变」—— 选项 chip（五险一金 / 本科 / 男女）
    // 点了只换 class，路由和文字总数纹丝不动。只比文字数的话这些全成了「点了没反应」，
    // 第一版 162 条误报就是这么来的。
    const 选中类数 = document.querySelectorAll(
      '[class*="选中"], [class*="当前"], [aria-pressed="true"], [aria-checked="true"], input:checked'
    ).length;
    return {
      路由: location.hash.replace(/^#/, '') || '/',
      文字数: 文.length,
      // 标注层的铅笔按钮自己带 data-标注，不算页面内容
      可点数: document.querySelectorAll('button:not([data-标注]), a[href], [role="button"]').length,
      选中类数,
      结构长度: document.body.innerHTML.length,
      首屏文字: 文.replace(/\s+/g, ' ').slice(0, 90),
    };
  });
}

/** 两次快照是不是「什么都没发生」：路由、文字、选中态、DOM 结构四项全同才算 */
function 毫无变化(前, 后) {
  return (
    前.路由 === 后.路由 &&
    前.文字数 === 后.文字数 &&
    前.选中类数 === 后.选中类数 &&
    前.结构长度 === 后.结构长度
  );
}

/** 收集这一屏所有可点元素的稳定标识（文字 + 类名），用于逐个点 */
async function 列可点(页) {
  return 页.evaluate(() => {
    const 元素们 = [...document.querySelectorAll('button, a[href], [role="button"]')];
    return 元素们
      .filter((元) => !元.closest('[data-标注]')) // 排除标注层自己的 UI
      .map((元, 序) => ({
        序,
        文字: (元.innerText ||元.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30),
        类: (元.className || '').toString().split(/\s+/).find((类) => 类.includes('__')) || '',
        禁用: element_disabled(元),
      }));
    function element_disabled(元) {
      return Boolean(元.disabled) || 元.getAttribute('aria-disabled') === 'true';
    }
  });
}

const 结果 = { 页面: [], 点击: [], 生成于: new Date().toISOString() };

const 浏览器 = await chromium.launch({ headless: true, channel: 'chrome' });

// ── 第一遍：每个路由能不能打开、有没有报错、是不是白屏 ──
for (const 路由 of 全部路由) {
  const { 上下文, 页, 报错 } = await 开页(浏览器);
  try {
    await 到(页, 路由);
    const 快 = await 快照(页);
    结果.页面.push({
      请求路由: 路由,
      ...快,
      空屏: 快.文字数 < 空屏阈值,
      跳走: 快.路由 !== 路由,
      报错: [...报错],
    });
  } catch (错) {
    结果.页面.push({ 请求路由: 路由, 崩溃: String(错).slice(0, 200) });
  }
  await 上下文.close();
}
writeFileSync(join(输出目录, '页面可达.json'), JSON.stringify(结果.页面, null, 1));
console.log(`第一遍完成：${结果.页面.length} 个路由`);
console.log(`  白屏 ${结果.页面.filter((条) => 条.空屏).length} · 跳走 ${结果.页面.filter((条) => 条.跳走).length} · 有报错 ${结果.页面.filter((条) => 条.报错?.length).length}`);

// ── 第二遍：逐个点每一屏的每个可点元素，点完再返回验一次 ──
// 每个组合都开新页重灌种子：不这么做的话前一次点击的脏状态会污染后面全部结论。
for (const 路由 of 全部路由) {
  const { 上下文: 探, 页: 探页 } = await 开页(浏览器);
  let 元素们 = [];
  try {
    await 到(探页, 路由);
    元素们 = await 列可点(探页);
  } catch { /* 打不开的页第一遍已记录，这里跳过 */ }
  await 探.close();

  for (const 元 of 元素们) {
    // 开页本身也可能失败（浏览器被外部信号关掉等）—— 放进 try 里，
    // 一个组合出事不能让整轮几百次点击白跑。
    let 上下文, 页, 报错;
    try {
      ({ 上下文, 页, 报错 } = await 开页(浏览器));
    } catch (错) {
      结果.点击.push({ 起始路由: 路由, 元素: 元.文字 || `#${元.序}`, 崩溃: '开页失败 ' + String(错).slice(0, 120) });
      continue;
    }
    try {
      await 到(页, 路由);
      const 点前 = await 快照(页);
      const 命中 = await 页.evaluate((序) => {
        const 们 = [...document.querySelectorAll('button, a[href], [role="button"]')]
          .filter((元) => !元.closest('[data-标注]'));
        const 目标 = 们[序];
        if (!目标) return false;
        目标.click();
        return true;
      }, 元.序);
      if (!命中) { await 上下文.close(); continue; }
      await 页.waitForTimeout(700);
      const 点后 = await 快照(页);

      // 返回一步，看落点对不对 —— 用户报的 bug 正是死在这一步
      let 返回后 = null;
      if (点后.路由 !== 点前.路由) {
        await 页.goBack();
        await 页.waitForTimeout(700);
        返回后 = await 快照(页);
      }

      结果.点击.push({
        起始路由: 路由,
        元素: 元.文字 || 元.类 || `#${元.序}`,
        禁用: 元.禁用,
        点后路由: 点后.路由,
        点后文字数: 点后.文字数,
        点后空屏: 点后.文字数 < 空屏阈值,
        无反应: 毫无变化(点前, 点后),
        返回后路由: 返回后?.路由 ?? null,
        返回后空屏: 返回后 ? 返回后.文字数 < 空屏阈值 : null,
        返回落错: 返回后 ? 返回后.路由 !== 点前.路由 : null,
        报错: [...报错],
      });
    } catch (错) {
      结果.点击.push({ 起始路由: 路由, 元素: 元.文字 || `#${元.序}`, 崩溃: String(错).slice(0, 160) });
    }
    await 上下文.close();
  }
  process.stdout.write('.');
}

writeFileSync(join(输出目录, '点击结果.json'), JSON.stringify(结果.点击, null, 1));
await 浏览器.close();

const 点 = 结果.点击;
console.log(`\n第二遍完成：${点.length} 次点击`);
console.log(`  点后白屏 ${点.filter((条) => 条.点后空屏).length}`);
console.log(`  点了没反应（非禁用）${点.filter((条) => 条.无反应 && !条.禁用).length}`);
console.log(`  返回落错页 ${点.filter((条) => 条.返回落错).length}`);
console.log(`  返回后白屏 ${点.filter((条) => 条.返回后空屏).length}`);
console.log(`  有控制台报错 ${点.filter((条) => 条.报错?.length).length}`);
console.log(`  崩溃 ${点.filter((条) => 条.崩溃).length}`);
console.log(`结果写入 ${输出目录}`);
