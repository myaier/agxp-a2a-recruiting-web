// e2e/fixtures/数据源交互.ts
// 数据源模式 spec 的跨 describe 共用交互 helper（C2）：按既有调用点从
// e2e/数据源模式.spec.ts 逐字迁出（仅加 export），不新包装业务流程。内容分三类：
//   · BFF fixture 的分端安装（装P4/装P5/…：调 安装BFF路由 并返回测试自持 fixture）；
//   · 数据源边界的小件（装三级职位目录桩 / 安装P7事件桩 / 是APIv1路径 / Mock 源登录）；
//   · 多 describe 复用的页面交互与断言（抽屉搜企业并选中 / 左滑 / 断言纵序 等）。
// 单一 describe 专用的 helper 留在原 spec，不提前下沉。

import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { 信封, type 拦截请求形 } from './bff/协议';
import { 标记, fixture简历, fixture意向列表 } from './bff/账号与目录';
import { P4深克隆, P4招聘岗位, P4发现fixture, type P4发现fixture形 } from './bff/发现推荐';
import { P1C标记, P1C招聘组织Fixture, P1C管理员关系, P1C组织甲, 带企业关系, type P1C岗位形 } from './bff/招聘组织';
import { P3标记, P3隐私fixture, type P3隐私形 } from './bff/隐私与实名';
import type { P2附件fixture形 } from './bff/附件';
import { P5编号, P5标记, 创建P5MatchCasefixture, type P5MatchCasefixture形 } from './bff/MatchCase';
import { P7会话编号, 创建P7fixture, type P7FixtureState } from './bff/真人消息';
import { 创建候选OnboardingFixture, type 候选OnboardingFixture } from './bff/候选建档';
import { 安装BFF路由, type BFF路由选项 } from './bff/安装BFF路由';

/**
 * Task 7 B 契约下的 job-categories 用例专用桩（后装 route 先匹配，不改共用 fixture）：
 * 根（不可选）→ 二级组（不可选）→ 三级可选叶子（叶子名用共用 标记.职位display，
 * ID 仍是 job-fixture-001，与既有意向写入/回读断言兼容）。共用 fixture 的单根可选目录
 * 在 期望职位选择正文（B 契约）里只会成为二级标题、没有可点叶子，期望职位页需要真三级。
 */
export async function 装三级职位目录桩(page: Page): Promise<void> {
  await page.route('**/api/v1/catalog/job-categories*', async (route) => {
    const url = new URL(route.request().url());
    const parentId = url.searchParams.get('parent_id');
    if (parentId === 'job_g') {
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [{ id: 'job-fixture-001', display_name: 标记.职位display, parent_id: 'job_g', selectable: true, has_children: false }],
          next_cursor: null,
          catalog_version: 'tax-v1',
        }),
      });
      return;
    }
    if (parentId === 'job_root') {
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [{ id: 'job_g', display_name: 'Fixture 工程', parent_id: 'job_root', selectable: false, has_children: true }],
          next_cursor: null,
          catalog_version: 'tax-v1',
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      json: 信封({
        items: [{ id: 'job_root', display_name: '技术研发', parent_id: null, selectable: false, has_children: true }],
        next_cursor: null,
        catalog_version: 'tax-v1',
      }),
    });
  });
}

/**
 * 合同 C：在已打开的「选择企业」抽屉里按词搜索并点确切目录候选（所有公司控件的
 * 弹层正文是同一份 公司选择层；打开抽屉的入口按钮各页不同，由用例自带）。
 * 选中回填后抽屉自动关闭，断言关闭即证明回填路径走完。
 */
export async function 抽屉搜企业并选中(page: Page, 搜索词: string, 候选名: string) {
  const 抽屉 = page.getByRole('dialog', { name: '选择企业' });
  await 抽屉.getByPlaceholder('输入公司名称').fill(搜索词);
  await 抽屉.getByRole('button', { name: 候选名 }).click({ timeout: 10_000 });
  await expect(抽屉).toHaveCount(0, { timeout: 10_000 });
}

/**
 * P1C Backend 发岗向导（实习生档，与 Mock onboarding 同一真实 UI）：
 * 类别走 catalog job-categories（左栏 root → 右栏 selectable 叶子），
 * 城市走 catalog locations 搜索候选，最后一步提交 POST /api/v1/recruiter/jobs。
 */
export async function 走完后端发岗向导(page: Page) {
  await hash直达(page, '/#/hr/post-job');
  const 职位类别行 = page.getByRole('button').filter({ hasText: '职位类别' });
  await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue('');
  await page.getByRole('button', { name: '实习生 在校生实习，按天计薪' }).click();
  await page.getByRole('button', { name: '提供转正机会' }).click();
  await page.getByPlaceholder(/资深后端工程师/).fill('Fixture 实习岗位');
  await 职位类别行.click();
  // fixture 目录只有一项 selectable root；点左栏 root 后右栏出现同名叶子，用次序区分
  const 类键 = page.getByRole('button', { name: 标记.职位display, exact: true });
  await 类键.first().click();
  await expect(类键).toHaveCount(2, { timeout: 5_000 });
  await 类键.last().click();
  await page.getByRole('button', { name: '混合', exact: true }).click();
  await page.getByRole('button', { name: '下一步' }).click();

  await page.getByLabel('职位描述').fill(
    '用户研究、产品验证、产品策略、实验、数据分析、需求执行、GTM、发布与增长',
  );
  await page.getByRole('button', { name: '下一步' }).click();

  // P0 修复 Task 4/7：职位要求是与描述互相独立的必填文本，第三步不填就发不出岗
  // （2026-09-11 起该输入 label 从「职位要求」改回「岗位要求」，与代理私有筛选要求区分，
  // 与 onboarding.spec 同口径 —— 只修选择器）
  await page.getByLabel('岗位要求').fill(
    '应届或毕业年级；有产品、技术、增长、分析或创业经历；关注 AI、SaaS、工作流、开发工具与 Agent',
  );

  // bottom-drawer 统一 Task 5：日薪两个金额按钮开同一双轮抽屉 —— 一次打开、
  // 点一次「确定」同步上下限两字段（缺值临时落 200/200），不再有第二轮点击。
  await page.getByRole('button', { name: '— 元/天' }).first().click();
  await page.getByRole('button', { name: '确定' }).click();
  // picker 统一 Task 2：城市改经工作城市行 → 全页选择子视图（搜索候选 → 保存回填）
  await page.getByRole('button').filter({ hasText: '工作城市' }).click();
  const picker城市搜索 = page.getByPlaceholder('搜索城市 / 省份');
  await expect(picker城市搜索).toBeVisible({ timeout: 5_000 });
  await picker城市搜索.fill('fixture');
  await page.getByRole('button', { name: 标记.城市display, exact: true }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByPlaceholder('搜索城市 / 省份')).toHaveCount(0);
  // 合同 C：岗位企业坐标是显式选择（新建 direct = 用人企业一行，两 ref 同值），
  // 不再读名片/未认证声明 —— 缺 ref 的「发布岗位并开始寻访」会被「请选择用人企业」拦下。
  // 用例需给 隐私fixture.组织库 供抽屉搜索；此处显式选中，覆盖档案默认读取之外的路径。
  await page.getByRole('button', { name: /用人企业/ }).click();
  await 抽屉搜企业并选中(page, '磐石', P3标记.手动组织甲);
  await page.getByPlaceholder(/浦东新区世纪大道/).fill('Fixture 市 Fixture 路 1 号');
  // 产品当前要求：改过硬性条件（学历/薪资）后必须勾选确认项才能发布（缺这步只弹
  // 「请先勾选上面的确认项」，发布键不生效）。这是既有 fixture helper 补当前 UI 必需步骤，
  // 不放宽任何断言。
  await page.getByLabel(/我已确认经验和学历设置将作为自动匹配依据/).check();
  await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
}


/** 已知时序类（README「已知事项」）：主壳水合期的在飞 replace 会把紧随其后的 hash 直达
 *  吞回落点路由。重试直达直到路由真正落定（只修测试导航，不放宽任何断言）。
 *  Task 3（C4）：从 隐私与实名/Agent规则 两个 Suite 下沉为共享 helper。 */
export async function hash直达(page: Page, 哈希: string): Promise<void> {
  // 路由段形（首段 + 段数）：P5 详情等深链会被应用改写成 canonical ID（段值变、段形不变），
  // 被吞则落回落点路由（段数变少），按段形判定比整串相等既不误伤改写也不放过吞没。
  const 段形 = (u: string) => {
    const 路径 = u.split('#')[1]?.split('?')[0] ?? '';
    const 段们 = 路径.split('/').filter(Boolean);
    return `${段们[0] ?? ''}(${段们.length})`;
  };
  for (let 次 = 0; 次 < 5; 次 += 1) {
    await page.goto(哈希);
    await page.waitForTimeout(400);
    if (段形(page.url()) === 段形(哈希)) return;
  }
  throw new Error(`hash 直达被在飞水合导航连续吞掉：${哈希}`);
}

export const 是APIv1路径 = (url: URL) => /^\/api\/v1(?:\/|$)/.test(url.pathname);

export async function 断言登录页无水平溢出(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    root: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }))).toEqual({ root: 0, body: 0 });
}

/** 历史意向规则的零写入口承诺：正文不渲染，行内 编辑/删除/开关 三个写入口一个都没有。 */
export async function 断言意向规则零写入口(page: Page, 正文: string) {
  await expect(page.getByText(正文)).toHaveCount(0);
  await expect(page.getByRole('button', { name: `编辑规则：${正文}` })).toHaveCount(0);
  await expect(page.getByRole('button', { name: `删除规则：${正文}` })).toHaveCount(0);
  await expect(page.getByRole('switch', { name: `规则：${正文}` })).toHaveCount(0);
}

/** P4 候选端安装：candidate 会话恢复 + 发现 fixture（意向列表可用 fixture 的 意向们 覆盖） */
export async function 装P4候选(
  page: Page,
  选项: {
    fixture?: P4发现fixture形;
    附件fixture?: P2附件fixture形;
    /** J-PILOT-01（Task 7）：场景安装可同时带 P5 fixture（连续臂 + Case 臂） */
    P5fixture?: P5MatchCasefixture形;
    覆盖?: BFF路由选项['覆盖'];
    请求拦截?: (请求: 拦截请求形) => void;
  } = {},
): Promise<P4发现fixture形> {
  const fixture = 选项.fixture ?? P4发现fixture();
  await 安装BFF路由(page, {
    登录尝试id: 'att-p4-candidate',
    记录目录请求: () => undefined,
    发现fixture: fixture,
    附件fixture: 选项.附件fixture,
    P5MatchCasefixture: 选项.P5fixture,
    覆盖: 选项.覆盖,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}

/** P4 招聘端安装：recruiter 会话（组织 fixture + P4 owner 岗位）+ 发现 fixture */
export async function 装P4招聘(
  page: Page,
  选项: {
    fixture?: P4发现fixture形;
    岗位们?: P1C岗位形[];
    请求拦截?: (请求: 拦截请求形) => void;
  } = {},
): Promise<P4发现fixture形> {
  const fixture = 选项.fixture ?? P4发现fixture();
  await 安装BFF路由(page, {
    登录尝试id: 'att-p4-recruiter',
    记录目录请求: () => undefined,
    招聘组织Fixture: 带企业关系(
      P1C招聘组织Fixture,
      [P1C管理员关系],
      { [P1C标记.组织甲编号]: P1C组织甲() },
      选项.岗位们 ?? [P4招聘岗位()],
    ),
    主体初始角色: 'recruiter',
    发现fixture: fixture,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}

/** 触屏左滑候选卡露出「不合适」。走 CDP touch 而不是鼠标拖拽：真实触屏手势在大幅移动后
 *  浏览器不会合成 click，行面的「打开态点击即收起」不会被拖拽尾随的 click 误触。 */
export async function 左滑候选卡(page: Page, 适配环名: string) {
  // 去名改版后卡上没有别名，按卡内适配环的可及名（如「适配 76 分」）定位那一张
  const 行面 = page.locator('[role="group"][aria-expanded="false"]')
    .filter({ has: page.getByRole('img', { name: 适配环名 }) }).first();
  const 框 = (await 行面.boundingBox())!;
  const 纵 = 框.y + 框.height / 2;
  const 起 = 框.x + 框.width - 30;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 起, y: 纵 }] });
  for (let 步 = 1; 步 <= 5; 步 += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 起 - 步 * ((框.width - 60) / 5), y: 纵 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** 左滑附件行露出操作键：真实 pointer 手势驱动 滑动行，绝不直接调 operation。
    一处浏览器实况补偿（手势路径与位移仍是「右缘 → 左缘」的左滑本体）：
    · 早期还有第二处补偿：附件卡贴在长页底部、容器已滚到底时，行的右缘中点会
      落进右下角常驻 ✎ 标注钮（zIndex 90、pointerEvents auto）的命中区，
      手势线被钳到行顶部 12px —— Task 7 后启动器 portal 出设备（缺省构建更是
      整个不渲染标注层），设备内不再有悬浮命中区，钳制已删除（见函数体内注释）；
    · 真实触摸左滑不会派生 click，桌面鼠标拖拽会派生一发 click 落回行面，
      触发「打开态点行 = 收起」把刚打开的行立刻关上 —— 手势期间在 document
      捕获段拦掉这一发派生 click，随后撤掉拦截，不碰任何真实交互。 */
export async function 左滑附件行(page: Page, name: string): Promise<void> {
  const row = page.getByTestId('附件简历行').filter({ hasText: name });
  await row.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const box = await row.boundingBox();
  if (!box) throw new Error(`resume row is not visible: ${name}`);
  // 行中点本位：早期因右下角常驻 ✎ 标注钮的命中区钳到过行顶 12px ——
  // Task 7 后启动器 portal 出设备（缺省构建不渲染标注层），设备内无悬浮命中区
  const 手势y = box.y + box.height / 2;
  await page.evaluate(() => {
    const 拦 = (事件: Event) => 事件.stopPropagation();
    document.addEventListener('click', 拦, { capture: true, once: true });
    (window as unknown as { __撤滑动派生click拦截: () => void }).__撤滑动派生click拦截 = () =>
      document.removeEventListener('click', 拦, { capture: true });
  });
  await page.mouse.move(box.x + box.width - 10, 手势y);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, 手势y, { steps: 5 });
  await page.mouse.up();
  await page.evaluate(() => (window as unknown as { __撤滑动派生click拦截?: () => void }).__撤滑动派生click拦截?.());
}

/** 附件简历标题几何门：与「基本信息」标题同高、同下间距，且无全局 loading / 骨架残留。 */
export async function 断言附件标题几何未漂移(page: Page): Promise<void> {
  const 附件标题 = page.getByTestId('附件简历标题');
  const 基本标题 = page.getByText('基本信息', { exact: true });
  const 附件后继 = 附件标题.locator('xpath=following-sibling::*[1]');
  const 基本后继 = 基本标题.locator('xpath=following-sibling::*[1]');
  const [附件框, 基本框, 附件后继框, 基本后继框] = await Promise.all([
    附件标题.boundingBox(), 基本标题.boundingBox(), 附件后继.boundingBox(), 基本后继.boundingBox(),
  ]);
  if (!附件框 || !基本框 || !附件后继框 || !基本后继框) {
    throw new Error('resume title geometry is unavailable');
  }
  expect(Math.abs(附件框.height - 基本框.height)).toBeLessThanOrEqual(1);
  const 附件下间距 = 附件后继框.y - (附件框.y + 附件框.height);
  const 基本下间距 = 基本后继框.y - (基本框.y + 基本框.height);
  expect(Math.abs(附件下间距 - 基本下间距)).toBeLessThanOrEqual(1);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.locator('[class*="骨架"], [class*="badge"]')).toHaveCount(0);
}

/** P5 候选端安装：candidate 会话恢复 + MatchCase fixture（列表进 #/app 即读） */
export async function 装P5候选(
  page: Page,
  选项: {
    fixture?: P5MatchCasefixture形;
    覆盖?: BFF路由选项['覆盖'];
    请求拦截?: (请求: 拦截请求形) => void;
  } = {},
): Promise<P5MatchCasefixture形> {
  const fixture = 选项.fixture ?? 创建P5MatchCasefixture();
  await 安装BFF路由(page, {
    登录尝试id: 'att-p5-candidate',
    记录目录请求: () => undefined,
    P5MatchCasefixture: fixture,
    覆盖: 选项.覆盖,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}

/** P5 招聘端安装：recruiter 会话（组织 fixture + P5 专属 owner 岗）+ MatchCase fixture */
export async function 装P5招聘(
  page: Page,
  选项: { fixture?: P5MatchCasefixture形; 请求拦截?: (请求: 拦截请求形) => void } = {},
): Promise<P5MatchCasefixture形> {
  const fixture = 选项.fixture ?? 创建P5MatchCasefixture();
  await 安装BFF路由(page, {
    登录尝试id: 'att-p5-recruiter',
    记录目录请求: () => undefined,
    招聘组织Fixture: 带企业关系(
      P1C招聘组织Fixture,
      [P1C管理员关系],
      { [P1C标记.组织甲编号]: P1C组织甲() },
      [P4招聘岗位({ job_id: P5编号.job, title: P5标记.招聘岗标题 })],
    ),
    主体初始角色: 'recruiter',
    P5MatchCasefixture: fixture,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}

/** P5 双角色安装：双角色主体 + 隐私 fixture（切回候选端要交互式水合）—— 旅程内可切端 */
export async function 装P5双角色(
  page: Page,
  选项: {
    fixture?: P5MatchCasefixture形;
    主体初始角色: 'candidate' | 'recruiter';
    请求拦截?: (请求: 拦截请求形) => void;
  },
): Promise<P5MatchCasefixture形> {
  const fixture = 选项.fixture ?? 创建P5MatchCasefixture();
  await 安装BFF路由(page, {
    登录尝试id: 'att-p5-dual',
    记录目录请求: () => undefined,
    招聘组织Fixture: 带企业关系(
      P1C招聘组织Fixture,
      [P1C管理员关系],
      { [P1C标记.组织甲编号]: P1C组织甲() },
      [P4招聘岗位({ job_id: P5编号.job, title: P5标记.招聘岗标题 })],
    ),
    主体初始角色: 选项.主体初始角色,
    隐私fixture: P3隐私fixture(),
    P5MatchCasefixture: fixture,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}

/** 纵序断言：各标记文本按给定顺序自上而下（服务端顺序原样保留，无客户端重排） */
export async function 断言纵序(page: Page, 项们: readonly (string | Locator)[]) {
  const 纵们: number[] = [];
  for (const 项 of 项们) {
    // string = 文本锚点（.first()）；Locator = 同词多元素时的显式定位（如「职位详情」
    // 既是 Tab 按钮名又是区块标题，取内容侧的 .last()）
    const 定位 = typeof 项 === 'string' ? page.getByText(项).first() : 项;
    await 定位.waitFor({ state: 'visible', timeout: 10_000 });
    const 框 = await 定位.boundingBox();
    if (!框) throw new Error(`P5 标记不可见：${项}`);
    纵们.push(框.y);
  }
  for (let 序 = 1; 序 < 纵们.length; 序 += 1) {
    expect(纵们[序]!).toBeGreaterThan(纵们[序 - 1]!);
  }
}

/** app 加载前 stub 原生 WebSocket；测试 seam：__emitP7(帧) / __P7断开() / __P7套接字数()。
 *  只替换业务 WebSocket（pathname 前两段 api/v1）：非业务连接透传原生实现，不屏蔽 Vite HMR。 */
export async function 安装P7事件桩(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const 原生 = window.WebSocket;
    // 业务路径判定与 e2e/fixtures/离线边界.ts 同口径：URL 前两个非空路径段为 api、v1
    const 是业务地址 = (地址: string): boolean => {
      try {
        const 段们 = new URL(地址, location.href).pathname.split('/').filter((段) => 段 !== '');
        return 段们[0] === 'api' && 段们[1] === 'v1';
      } catch {
        return false;
      }
    };
    const 套接字们: Array<{
      url: string;
      onopen: (() => void) | null;
      onmessage: ((事件: { data: string }) => void) | null;
      onclose: (() => void) | null;
      onerror: (() => void) | null;
      已关: boolean;
    }> = [];
    class 假WebSocket {
      url: string;
      onopen: (() => void) | null = null;
      onmessage: ((事件: { data: string }) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      已关 = false;
      constructor(url: string | URL) {
        const 地址 = String(url);
        if (!是业务地址(地址)) {
          // 非业务连接（如 Vite HMR）透传原生浏览器实现
          return new 原生(url) as unknown as 假WebSocket;
        }
        this.url = 地址;
        套接字们.push(this);
        // 模拟真实连接成功：构造后的下一轮事件循环触发 onopen（handlers 已由 adapter 挂好）
        setTimeout(() => {
          if (!this.已关) this.onopen?.();
        }, 0);
      }
      close() {
        if (this.已关) return;
        this.已关 = true;
        this.onclose?.();
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).WebSocket = 假WebSocket;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__P7套接字们 = 套接字们;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__emitP7 = (帧: unknown) => {
      for (const 套 of 套接字们) {
        if (!套.已关) 套.onmessage?.({ data: JSON.stringify(帧) });
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__P7断开 = () => {
      for (const 套 of [...套接字们]) 套.onclose?.();
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__P7套接字数 = () => 套接字们.filter((套) => !套.已关).length;
  });
}

/** 预置一条 recruiter 消息的候选会话（read-through 旅程用）。 */
export function P7带消息fixture(消息: string): P7FixtureState {
  const fixture = 创建P7fixture();
  fixture.messages[P7会话编号.会话] = [{
    message_id: '4004', kind: 'user_text', sender_role: 'recruiter', content: 消息, created_at: '2026-08-30T01:00:00Z',
  }];
  return fixture;
}

/**
 * 向导薪资段（bottom-drawer 统一 Task 5）：点薪资入口行开共用 薪资区间层，
 * 点 薪资下限 30 档 —— 引导联动自动把上限抬到 40（不单独碰上限轮）——
 * 点 确定回填，入口行显示 30-40K。
 */
export async function 走向导薪资(page: Page): Promise<void> {
  const 入口行 = page.getByRole('button', { name: /薪资要求（月薪/ });
  await 入口行.click();
  const 抽屉 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
  await 抽屉.getByRole('listbox', { name: '薪资下限' }).getByRole('option', { name: '30', exact: true }).click();
  await 抽屉.getByRole('button', { name: '确定' }).click();
  await expect(抽屉).toHaveCount(0);
  await expect(入口行).toContainText('30-40K');
}

/** Mock 源（@mock describe 的 baseURL；Backend 用例跨源比较时显式传 4181 绝对地址） */
export const Mock源 = 'http://127.0.0.1:4181';

/** Mock 登录到求职端在谈单（零 API）。page.goto 的相对路径按项目 baseURL 解析，
 *  跨源比较必须传绝对地址，否则会回到 Backend origin。 */
export async function Mock登录求职(page: Page, 源: string = Mock源) {
  await page.goto(`${源}/`);
  await page.getByText(/已阅读并同意/).click();
  await page.getByRole('button', { name: '微信登录' }).click();
  await expect(page).toHaveURL(/#\/identity$/);
  await page.getByRole('button', { name: '我要找工作' }).click();
  await expect(page).toHaveURL(/#\/student$/);
}

/** Mock 切到招聘端推荐屏（零 API）：切身份 → 推荐子视图 */
export async function Mock切到招聘推荐(page: Page, 源: string = Mock源) {
  await page.goto(`${源}/#/identity?switch=1&from=app`);
  await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
  await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
  await page.getByRole('button', { name: '推荐', exact: true }).click();
}

/** Mock 登录最小入口：协议同意 → 微信登录 → 身份页 */
export async function pickerMock登录(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByText(/已阅读并同意/).click();
  await page.getByRole('button', { name: '微信登录' }).click();
  await expect(page).toHaveURL(/#\/identity$/);
}

/** Backend 存量候选日常会话（与核心编辑用例同口径）：登录落主壳 */
export async function pickerBackend存量候选(
  page: Page,
  登录尝试id: string,
  隐私覆盖: Partial<P3隐私形> = {},
): Promise<候选OnboardingFixture> {
  const fixture = 创建候选OnboardingFixture();
  fixture.主体.last_used_role = 'candidate';
  // 存量日常会话按冻结决策返回 candidate 已完成（与核心编辑用例同口径，final-gate
  // merge 追平）：登录落点按完成事实进主壳，而不是被未完成分流送回学生分流
  fixture.完成.candidate = '2026-08-25T10:00:00Z';
  fixture.resume = {
    ...P4深克隆(fixture简历),
    profile: { ...fixture简历.profile, real_name: '存量候选' },
    summary: '存量个人优势',
  };
  fixture.intentions = [P4深克隆(fixture意向列表.intentions[0])];
  await 安装BFF路由(page, {
    登录尝试id,
    记录目录请求: () => {},
    候选OnboardingFixture: fixture,
    隐私fixture: P3隐私fixture(隐私覆盖),
  });
  return fixture;
}
