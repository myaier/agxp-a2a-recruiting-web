// e2e/suites/助手会话.spec.ts
// 求职端助手聊天聚焦旅程：完整页面 HTTP 接线、三类卡片与原生导航（展示增量后含
// Markdown 正文、中文类型标题与数量、卡内中文匹配理由、消息时间源对照）。
//
// 在真实组装（主壳 → 消息列表 → 固定 AI 入口 → /agent 聊天页）上证明页面：
//   · 空历史发送 → 202 受理（幂等键）→ processing 锁输入 → 轮询换终态 → 三类卡片按
//     原序各带中文类型标题与实际数量；查询时间不上屏（Spec §10.2）；
//   · 卡片点原生职位/在谈详情并返回（candidate-assistant 窄来源），不可用目标吃真实
//     404 页（不补假数据）；
//   · 加载更早（游标页 + 阅读位置保持）；切页重进恢复 processing 轮询；失败重试同
//     message_id 原位替换，用户消息不重复；
//   · 消息时间：两个显式 timezoneId describe 各一条聚焦用例，同条 created_at 本地时区
//     呈现、不取 queried_at（Spec §10.4）。
// fixture：e2e/fixtures/P1展示统一.ts 白名单之上叠 e2e/fixtures/助手会话.ts 覆盖层；
// 白名单外一律受控错误，绝不放行真实网络。
// 边界：模拟回复只证明前端承载与请求（202/轮询/渲染/导航），不证明真实模型理解 ——
// 真实模型旅程归 final gate 人工验收（Plan 收尾）。同名项目只准备数据并断言各自
// record_id 接线，不声称任何「模型澄清」能力。

import { expect, test } from '../fixtures/test';
import { type Page, type TestInfo } from '@playwright/test';
import { 安装诊断, 打开稳定页面 } from '../视觉回归/稳定页面';
import {
  创建助手会话状态,
  安装助手会话路由,
  助手消息,
  岗位项,
  岗位推荐卡,
  岗位推荐页,
  在谈详情应答,
  在谈详情卡,
  在谈详情卡数据,
  在谈列表卡,
  在谈项,
  在谈页,
} from '../fixtures/助手会话';
import type { AssistantReply } from '../../src/数据/招聘数据源/助手会话';
import type { NegotiationPublicEvaluation } from '../../src/数据/招聘数据源/连续代谈';

// ── 编号（fixture 同族：int_/job_/dlg_ + 32 hex；消息/轮次按 assistant 契约 pattern）──
const 编号 = {
  消息一: `asm_${'a1'.repeat(16)}`,
  轮次一: `ast_${'b1'.repeat(16)}`,
  消息二: `asm_${'a2'.repeat(16)}`,
  轮次二: `ast_${'c1'.repeat(16)}`,
  消息三: `asm_${'a3'.repeat(16)}`,
  轮次三: `ast_${'d1'.repeat(16)}`,
  轮次三新轮: `ast_${'d2'.repeat(16)}`,
  记录甲: `dlg_${'11'.repeat(16)}`,
  记录乙: `dlg_${'22'.repeat(16)}`,
  岗位一: 'job_00112233445566778899aabbccddee01',
  岗位下架: `job_${'f'.repeat(32)}`,
} as const;

const 空会话说明 =
  '你可以直接问我岗位推荐和在谈进展，结果里的项目可以点开原生详情。自由筛选、修改规则和日报暂不支持，请用下方的市场、在谈与规则库入口。';
const 输入占位 = '问问岗位推荐或在谈进展…';

/** 公开初评（与连续代谈域 evidence 三组同 schema；判断词保留 wire 原词）。 */
const 初评: NegotiationPublicEvaluation = {
  evaluation_id: 'eval_assistant_fixture_001',
  decision: 'fit',
  summary: 'P1FIX 初评：结构化预检通过',
  coverage: 'public_job_and_candidate_data',
  evidence: {
    matches: [{ dimension: '薪资带', code: 'salary_overlap', source: 'structured_precheck' }],
    conflicts: [],
    unknowns: [],
  },
  next_action: 'promote_to_a2a',
  completed_at: '2026-09-12T10:00:00Z',
};

/** 纯文本回复（cards=[] → 现有代理气泡）。 */
function 文本回复(正文: string): AssistantReply {
  return { text: 正文, visibility: 'available', cards: [] };
}

/** 用户气泡用长文：让历史内容撑出滚动，阅读位置保持的检查才有意义。 */
const 长消息文 = (标记: string) => `${标记}：${'占位内容，验证多行气泡与阅读位置。'.repeat(60)}`;

// ── 共用 helper ─────────────────────────────────────────────────────────────────

/** 底部导航里的消息 Tab（与既有 spec 同口径）。 */
const 消息按钮 = (page: Page) => page.locator('nav').getByRole('button', { name: /消息/ });

/** 固定 AI 入口行（键 agent-entry:candidate，唯一入口行）。 */
const AI入口行 = (page: Page) => page.getByRole('button', { name: /AI代理动态/ });

/** 聊天输入条：占位即 aria-label。 */
const 输入框 = (page: Page) => page.getByPlaceholder(输入占位);

/** 主壳 → 消息 → 固定 AI 入口 → /agent。零守卫绕过，与既有 Backend spec 同一机制。 */
async function 进入助手聊天(page: Page): Promise<void> {
  await 打开稳定页面(page, '/', '未登录');
  await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
  await expect(消息按钮(page)).toBeVisible({ timeout: 20_000 });
  await 消息按钮(page).click();
  await expect(AI入口行(page)).toBeVisible({ timeout: 15_000 });
  await AI入口行(page).click();
  await expect(page).toHaveURL(/#\/agent$/, { timeout: 10_000 });
}

/** 聊天页布局不变式：输入可见、单一消息滚动容器、无按钮嵌套、无横向溢出。 */
async function 期望聊天布局(page: Page): Promise<void> {
  await expect(输入框(page)).toBeVisible();
  const 滚动容器数 = await page.evaluate(() => document.querySelectorAll('.滚动区').length);
  expect(滚动容器数, '消息滚动容器唯一').toBe(1);
  const 嵌套按钮数 = await page.evaluate(() => document.querySelectorAll('button button').length);
  expect(嵌套按钮数, '整条回复不包成按钮（无按钮嵌套）').toBe(0);
  const 溢出 = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(溢出, '页面横向溢出').toBe(0);
}

/** 元素相对消息滚动容器顶沿的位置（阅读位置保持检查用）。 */
function 取容器相对顶部(page: Page, 标记: string): Promise<number> {
  return page.evaluate((片段) => {
    const 容器 = document.querySelector('.滚动区');
    const 节点 = Array.from(document.querySelectorAll('[class*="气泡文字"]'))
      .find((元) => 元.textContent?.includes(片段));
    if (!(容器 instanceof HTMLElement) || !(节点 instanceof HTMLElement)) return Number.NaN;
    return 节点.getBoundingClientRect().top - 容器.getBoundingClientRect().top;
  }, 标记);
}

/** 截图到 testInfo.outputPath 并 attach（同视口证据，Runner 输出目录内，不另建报告文件）。 */
async function 存截图(testInfo: TestInfo, page: Page, 名称: string): Promise<void> {
  const 文件 = testInfo.outputPath(名称);
  await page.screenshot({ path: 文件 });
  await testInfo.attach(名称, { path: 文件, contentType: 'image/png' });
}

// ── 旅程用例（390 基准视口）──────────────────────────────────────────────────────

test.describe('助手会话 Backend 390 @backend', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    reducedMotion: 'reduce',
  });

  // 空历史发送 → 202 受理 → processing 锁输入 → 轮询终态 → 三类卡片与各自查询时间。
  // 模拟回复只证明前端承载与请求，不是模型理解测试。
  test('空历史发送到三类卡片 @backend', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const 状态 = 创建助手会话状态();
    const 受理 = 助手消息(
      { 编号: 编号.消息一, 轮次: 编号.轮次一, 文本: '推荐几个岗位，顺便看看在谈' },
      { status: 'processing' },
    );
    状态.发送受理 = 受理;
    状态.轮询队列[编号.轮次一] = [受理];
    const { 覆盖请求 } = await 安装助手会话路由(page, { 状态 });
    const 诊断 = 安装诊断(page);

    await 进入助手聊天(page);

    // 空历史：能力说明气泡（首读完成后才出现）+ 真输入可用
    await expect(page.getByText(空会话说明)).toBeVisible({ timeout: 15_000 });
    await expect(输入框(page)).toBeEnabled();
    await 期望聊天布局(page);

    // 发送：我方气泡上屏、草稿清空、processing 锁输入与发送
    await 输入框(page).fill('推荐几个岗位，顺便看看在谈');
    await page.getByRole('button', { name: '发送' }).click();
    await expect(page.getByText('推荐几个岗位，顺便看看在谈')).toBeVisible();
    await expect(输入框(page)).toHaveValue('');
    await expect(page.getByText('正在处理…')).toBeVisible({ timeout: 5_000 });
    await expect(输入框(page)).toBeDisabled();
    await expect(page.getByRole('button', { name: '发送' })).toBeDisabled();

    // 请求证据：恰好一个 POST，Idempotency-Key 为调用方 UUID（202 合同）
    const 发送们 = 覆盖请求.filter(
      (条) => 条.method === 'POST' && 条.path === '/api/v1/me/assistant/messages',
    );
    expect(发送们, '快速单击只一个 POST').toHaveLength(1);
    expect(发送们[0]!.幂等键).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    // 推进剧本：下一次 2 秒轮询换终态 —— 三类卡片与中文类型标题
    状态.轮询队列[编号.轮次一]!.push(助手消息(
      { 编号: 编号.消息一, 轮次: 编号.轮次一, 文本: '推荐几个岗位，顺便看看在谈' },
      {
        reply: {
          text: 'P1FIX 助手正文：这是岗位推荐与在谈进展。',
          visibility: 'available',
          cards: [
            岗位推荐卡('2026-09-16T09:52:00Z', 岗位推荐页([
              岗位项({ 岗位编号: 编号.岗位一, 职位: '交易中台架构师' }, {
                organization_name: '美团',
                safe_reasons: ['category_matched', 'experience_met', 'location_matched'],
              }),
              岗位项({ 岗位编号: 编号.岗位下架, 职位: '数据平台工程师' }, {
                safe_reasons: ['category_matched', 'experience_met', 'location_matched', 'workplace_mode_matched'],
              }),
            ], null)),
            在谈列表卡('2026-09-16T10:38:00Z', 在谈页([
              在谈项({ 记录编号: 编号.记录甲, 职位: '同名在谈项目' }, { phase: 'accepted' }),
              在谈项({ 记录编号: 编号.记录乙, 职位: '同名在谈项目' }, {
                phase: 'evaluating',
                needs_action: true,
                job: { public_salary_range: null },
              }),
            ], null)),
            在谈详情卡('2026-09-16T11:24:00Z', 在谈详情卡数据(
              在谈项({ 记录编号: 编号.记录甲, 职位: '同名在谈项目' }),
              { 公开初评: 初评 },
            )),
          ],
        },
      },
    ));
    await expect(page.getByText('P1FIX 助手正文：这是岗位推荐与在谈进展。')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('正在处理…')).toHaveCount(0);
    await expect(输入框(page)).toBeEnabled();

    // 三类卡片按原序，各带中文类型标题与实际数量；查询时间不上屏（§10.2）
    await expect(page.getByText('推荐岗位', { exact: true })).toBeVisible();
    await expect(page.getByText('2 个岗位')).toBeVisible();
    await expect(page.getByText('在谈列表', { exact: true })).toBeVisible();
    await expect(page.getByText('2 条在谈')).toBeVisible();
    await expect(page.getByText('在谈详情', { exact: true })).toBeVisible();
    await expect(page.getByText(/查询于/)).toHaveCount(0);
    // 岗位推荐：原市场卡组件 + 卡内中文匹配理由（真实样本组合）；委托槽禁用
    await expect(page.getByTestId('求职推荐卡')).toHaveCount(2);
    await expect(page.getByRole('button', { name: '让AI代理去谈' })).toHaveCount(2);
    for (const 键 of await page.getByRole('button', { name: '让AI代理去谈' }).all()) {
      await expect(键).toBeDisabled();
    }
    // 用户明确取消的按钮下脚注不再出现
    await expect(page.getByText('请进入岗位详情操作')).toHaveCount(0);
    // 卡内理由：已知码译中文（两卡各有职位方向/经验/地点，第二张多办公方式），原码不透出
    await expect(page.getByText('职位方向匹配')).toHaveCount(2);
    await expect(page.getByText('经验要求匹配')).toHaveCount(2);
    await expect(page.getByText('工作地点匹配')).toHaveCount(2);
    await expect(page.getByText('办公方式匹配')).toHaveCount(1);
    await expect(page.getByText(/category_matched|experience_met|location_matched|workplace_mode_matched/)).toHaveCount(0);
    // 在谈列表：两个同名项目各自成卡（稳定内序号由卡序号承担）；needs_action 才出「需要你」；
    // 薪资 nullable 出既有「薪资未知」占位；详情卡同一张在谈卡 + 公开初评/条件确认段
    await expect(page.getByTestId('求职在谈卡')).toHaveCount(3);
    await expect(page.getByText('同名在谈项目')).toHaveCount(3);
    await expect(page.getByText('薪资未知')).toHaveCount(1);
    await expect(page.getByText('需要你')).toHaveCount(1);
    await expect(page.getByRole('button', { name: '让 AI 解读' })).toHaveCount(3);
    await expect(page.getByText('公开信息初评')).toBeVisible();
    await expect(page.getByText('结论：fit')).toBeVisible();
    await expect(page.getByText('薪资带 · salary_overlap · structured_precheck')).toBeVisible();
    await expect(page.getByText('建议：继续推进')).toBeVisible();
    await expect(page.getByText('暂无条件确认')).toBeVisible();

    await 期望聊天布局(page);
    await 存截图(testInfo, page, 'assistant-three-cards-390.png');

    // 零意外诊断：全 200/202，白名单外零请求
    expect(诊断.pageErrors).toEqual([]);
    expect(诊断.failedRequests).toEqual([]);
    expect(诊断.consoleErrors).toEqual([]);
    诊断.detach();
  });

  // 卡片点原生职位/在谈详情并返回；不可用目标给真实 404 页。历史每次重进都从服务端恢复。
  test('卡片点原生详情并返回 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const 状态 = 创建助手会话状态();
    const 会话正文 = 'P1FIX 助手正文：项目卡片可点开原生详情。';
    状态.首页 = {
      items: [助手消息(
        { 编号: 编号.消息一, 轮次: 编号.轮次一, 文本: '打开刚才的两个项目看看' },
        {
          reply: {
            text: 会话正文,
            visibility: 'available',
            cards: [
              岗位推荐卡('2026-09-10T08:00:00Z', 岗位推荐页([
                岗位项({ 岗位编号: 编号.岗位一, 职位: '交易中台架构师' }, { organization_name: '美团' }),
                岗位项({ 岗位编号: 编号.岗位下架, 职位: '已下架占位岗' }, { organization_name: null }),
              ], null)),
              在谈列表卡('2026-09-11T09:30:00Z', 在谈页([
                在谈项({ 记录编号: 编号.记录甲, 职位: '同名在谈项目' }),
              ], null)),
            ],
          },
        },
      )],
      next_cursor: null,
    };
    状态.在谈详情[编号.记录甲] = 在谈详情应答(
      在谈项({ 记录编号: 编号.记录甲, 职位: '同名在谈项目' }),
      { 公开初评: 初评 },
    );
    const { 请求 } = await 安装助手会话路由(page, { 状态 });
    const 诊断 = 安装诊断(page);

    await 进入助手聊天(page);
    await expect(page.getByText(会话正文)).toBeVisible({ timeout: 15_000 });

    // 岗位卡 → 原生职位详情 → 返回聊天（candidate-assistant 窄来源）。基座场景『完整』
    // 的推荐水合已带 job_...01 快照：详情走 P4 缓存路径渲染，不再发 canonical job GET
    //（与 P1展示统一 的缓存路径回归同一行为；直取 GET 路径由下方不可用目标覆盖）。
    await page.getByTestId('求职推荐卡').first().getByRole('button', { name: '查看职位详情' }).click();
    await expect(page).toHaveURL(/#\/job\/job_00112233445566778899aabbccddee01$/, { timeout: 10_000 });
    await expect(page.getByText('交易中台架构师', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(请求.filter((条) => 条.path.startsWith('/api/v1/jobs/')), '快照命中零 canonical GET').toEqual([]);
    await page.getByRole('button', { name: '返回' }).click();
    await expect(page).toHaveURL(/#\/agent$/, { timeout: 10_000 });
    await expect(page.getByText(会话正文)).toBeVisible({ timeout: 15_000 });

    // 在谈卡 → 原生在谈详情（record_id，pre-Case 可达，不要求 case_id）→ 返回聊天
    await page.getByTestId('求职在谈卡').first().locator('button').first().click();
    await expect(page).toHaveURL(new RegExp(`#/deal/${编号.记录甲}$`), { timeout: 10_000 });
    await expect(page.getByText('同名在谈项目', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    // 初评已本地化（94be6952：S0 小结 = 决定中文文案，不再渲染「结论：fit」原词）
    await expect(page.getByText('公开初评匹配')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '返回' }).click();
    await expect(page).toHaveURL(/#\/agent$/, { timeout: 10_000 });
    await expect(page.getByText(会话正文)).toBeVisible({ timeout: 15_000 });

    // 不可用目标：fixture 不认识的 job_id → 原生详情直取 canonical job GET 吃真实 404
    //（不可查看态），不补假数据
    await page.getByTestId('求职推荐卡').nth(1).getByRole('button', { name: '查看职位详情' }).click();
    await expect(page).toHaveURL(new RegExp(`#/job/${编号.岗位下架}$`), { timeout: 10_000 });
    await expect(page.getByText('这个职位暂时看不了')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('该职位可能已下架，或已不在你的推荐范围内。')).toBeVisible();
    await expect(page.getByText('交易中台架构师')).toHaveCount(0);
    expect(请求).toContainEqual(expect.objectContaining({ method: 'GET', path: `/api/v1/jobs/${编号.岗位下架}` }));
    await page.getByRole('button', { name: '返回' }).click();
    await expect(page).toHaveURL(/#\/agent$/, { timeout: 10_000 });
    await expect(page.getByText(会话正文)).toBeVisible({ timeout: 15_000 });

    // 三次进出聊天，历史都从服务端恢复（StrictMode 双挂载计数从宽：≥3）
    expect(状态.历史读数).toBeGreaterThanOrEqual(3);
    expect(诊断.pageErrors).toEqual([]);
    expect(诊断.failedRequests).toEqual([]);
    诊断.detach();
  });

  // 加载更早：游标页追加更早消息、按钮随 next_cursor 消失、阅读位置保持不跳动。
  test('加载更早消息保持阅读位置 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const 状态 = 创建助手会话状态();
    const 页消息 = (标记: string, 消息编号: string, 轮次: string) => 助手消息(
      { 编号: 消息编号, 轮次, 文本: 长消息文(标记) },
      { reply: 文本回复('P1FIX 助手正文') },
    );
    // wire 顺序：最新在前
    状态.首页 = {
      items: [
        页消息('P1FIX 较新消息二', 编号.消息二, 编号.轮次二),
        页消息('P1FIX 较新消息一', 编号.消息一, 编号.轮次一),
      ],
      next_cursor: '2',
    };
    状态.更早页['2'] = {
      items: [页消息('P1FIX 更早消息零', 编号.消息三, 编号.轮次三)],
      next_cursor: null,
    };
    const { 覆盖请求 } = await 安装助手会话路由(page, { 状态 });
    const 诊断 = 安装诊断(page);

    await 进入助手聊天(page);
    await expect(page.getByRole('button', { name: '查看更早消息' })).toBeVisible({ timeout: 15_000 });
    await expect(输入框(page)).toBeEnabled();
    await 期望聊天布局(page);

    // 首读落底定位后，手动把容器滚回顶部（查看更早按钮随流内置顶），量取加载窗口顶部
    // 那条消息的容器相对位置；按钮已在视口内，Playwright 不再代劳滚动，前后才可比
    await page.evaluate(() => {
      const 容器 = document.querySelector('.滚动区');
      if (容器 instanceof HTMLElement) 容器.scrollTop = 0;
    });
    const 前 = await 取容器相对顶部(page, 'P1FIX 较新消息一');
    expect(Number.isNaN(前)).toBe(false);
    await page.getByRole('button', { name: '查看更早消息' }).click();
    await expect(page.getByText('P1FIX 更早消息零', { exact: false })).toBeVisible({ timeout: 15_000 });

    // 追加更早后原阅读位置不跳动；游标耗尽按钮消失；带游标读取恰好一次
    const 后 = await 取容器相对顶部(page, 'P1FIX 较新消息一');
    expect(Math.abs(后 - 前), '加载更早保持阅读位置').toBeLessThanOrEqual(2);
    await expect(page.getByRole('button', { name: '查看更早消息' })).toHaveCount(0);
    expect(
      覆盖请求.filter((条) => 条.method === 'GET' && 条.游标 === '2'),
      '带游标历史读取恰好一次',
    ).toHaveLength(1);

    expect(诊断.pageErrors).toEqual([]);
    expect(诊断.failedRequests).toEqual([]);
    expect(诊断.consoleErrors).toEqual([]);
    诊断.detach();
  });

  // 切页重进：重新读历史，processing 恢复展示并续轮询，终态照常落地。
  test('切页重进恢复processing轮询 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const 状态 = 创建助手会话状态();
    const 处理中 = 助手消息(
      { 编号: 编号.消息一, 轮次: 编号.轮次一, 文本: 'P1FIX 第二个问题' },
      { status: 'processing' },
    );
    状态.首页 = { items: [处理中], next_cursor: null };
    状态.轮询队列[编号.轮次一] = [处理中];
    await 安装助手会话路由(page, { 状态 });
    const 诊断 = 安装诊断(page);

    await 进入助手聊天(page);
    await expect(page.getByText('正在处理…')).toBeVisible({ timeout: 15_000 });
    await expect(输入框(page)).toBeDisabled();

    // 切回主壳再进：历史重读，processing 恢复（输入仍锁）
    await page.getByRole('button', { name: '返回' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 10_000 });
    await AI入口行(page).click();
    await expect(page).toHaveURL(/#\/agent$/, { timeout: 10_000 });
    await expect(page.getByText('正在处理…')).toBeVisible({ timeout: 15_000 });
    await expect(输入框(page)).toBeDisabled();
    expect(状态.历史读数, '重进后重新读历史').toBeGreaterThanOrEqual(2);

    // 推进终态：恢复的轮询拿到成功回复，输入解锁
    状态.轮询队列[编号.轮次一]!.push(助手消息(
      { 编号: 编号.消息一, 轮次: 编号.轮次一, 文本: 'P1FIX 第二个问题' },
      { reply: 文本回复('P1FIX 助手正文：第二个已处理完。') },
    ));
    await expect(page.getByText('P1FIX 助手正文：第二个已处理完。')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('正在处理…')).toHaveCount(0);
    await expect(输入框(page)).toBeEnabled();
    expect(
      (状态.轮询读数[编号.轮次一] ?? 0),
      '重进后至少一次轮询取到终态',
    ).toBeGreaterThanOrEqual(1);

    expect(诊断.pageErrors).toEqual([]);
    expect(诊断.failedRequests).toEqual([]);
    expect(诊断.consoleErrors).toEqual([]);
    诊断.detach();
  });

  // 失败且可重试：显式重试用新幂等键换新轮次，同 message_id 原位替换，用户消息不重复。
  test('失败重试不重复用户消息 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const 状态 = 创建助手会话状态();
    状态.首页 = {
      items: [助手消息(
        { 编号: 编号.消息三, 轮次: 编号.轮次三, 文本: 'P1FIX 失败的追问' },
        { status: 'failed', retryable: true, error_code: 'assistant_turn_failed' },
      )],
      next_cursor: null,
    };
    const 重试受理 = 助手消息(
      { 编号: 编号.消息三, 轮次: 编号.轮次三新轮, 文本: 'P1FIX 失败的追问' },
      { status: 'processing' },
    );
    状态.重试受理[编号.轮次三] = 重试受理;
    状态.轮询队列[编号.轮次三新轮] = [重试受理];
    const { 覆盖请求 } = await 安装助手会话路由(page, { 状态 });
    const 诊断 = 安装诊断(page);

    await 进入助手聊天(page);
    await expect(page.getByText('这条消息处理失败')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[class*="我方"]')).toHaveCount(1);

    // 重试：POST 新幂等键 → 202 同 message_id 新轮次；原位替换，不多出用户气泡
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await expect(page.getByText('正在处理…')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('P1FIX 失败的追问')).toHaveCount(1);
    await expect(page.locator('[class*="我方"]')).toHaveCount(1);
    const 重试们 = 覆盖请求.filter(
      (条) => 条.method === 'POST' && 条.path === `/api/v1/me/assistant/turns/${编号.轮次三}/retry`,
    );
    expect(重试们, '重试 POST 恰好一次').toHaveLength(1);
    expect(重试们[0]!.幂等键).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    // 终态：失败行与重试键退场，成功回复上屏，用户消息仍只有一条
    状态.轮询队列[编号.轮次三新轮]!.push(助手消息(
      { 编号: 编号.消息三, 轮次: 编号.轮次三新轮, 文本: 'P1FIX 失败的追问' },
      { reply: 文本回复('P1FIX 助手正文：重试已成功。') },
    ));
    await expect(page.getByText('P1FIX 助手正文：重试已成功。')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('这条消息处理失败')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '重试', exact: true })).toHaveCount(0);
    await expect(page.getByText('P1FIX 失败的追问')).toHaveCount(1);
    await expect(page.locator('[class*="我方"]')).toHaveCount(1);

    expect(诊断.pageErrors).toEqual([]);
    expect(诊断.failedRequests).toEqual([]);
    expect(诊断.consoleErrors).toEqual([]);
    诊断.detach();
  });
});

// ── 布局回归（320/390）：富卡片 + 同名/长职位名/缺图片/薪资 nullable/各自查询时间 ──
// 嵌入的是原市场卡/在谈卡区域与占位（不改设计）；0 分等原生卡事实回归留在 P1 原生卡用例。

for (const 宽度 of [320, 390]) {
  test.describe(`助手会话 布局回归 ${宽度} @backend`, () => {
    test.use({
      viewport: { width: 宽度, height: 844 },
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      reducedMotion: 'reduce',
    });

    test('富卡片布局不变式 @backend', async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      const 状态 = 创建助手会话状态();
      const 长职位名 = '测'.repeat(80);
      // 更早一条：无卡 Markdown 回复（Spec §10.5 用户提供的完整样本正文节选），
      // 覆盖「无卡也是 Markdown + 长内容不撑破气泡」
      const 无卡Markdown = [
        '为你找到 **产品经理（北京市）** 的 2 个推荐岗位：',
        '',
        '### 📌 产品经理 · 北京市',
        '',
        '**1. Project Star — 产品经理**',
        '- 📍 **地点：** 远程办公；每月北京线下协作 2 天（具体地点另行通知）',
        '- 💰 **薪资：** 20–30K/月（12 薪）',
        '',
        '两个岗位薪资一致（20–30K/月），区别主要在工作模式：',
        '- **Project Star** 是**远程为主**，灵活度高',
        '- **快手**是**三里屯办公**，现场协作',
      ].join('\n');
      状态.首页 = {
        items: [
          助手消息(
            { 编号: 编号.消息一, 轮次: 编号.轮次一, 文本: 'P1FIX 再看一遍这些项目' },
            {
              created_at: '2026-09-16T09:07:33Z',
              reply: {
                text: 'P1FIX 助手正文：同名、长名与缺失字段都按既有卡面呈现。',
                visibility: 'available',
                cards: [
                  岗位推荐卡('2026-09-16T10:52:00Z', 岗位推荐页([
                    岗位项({ 岗位编号: 编号.岗位一, 职位: 长职位名 }, {
                      annual_salary_months: 15,
                      safe_reasons: ['category_matched', 'experience_met', 'location_matched'],
                    }),
                    岗位项({ 岗位编号: 编号.岗位下架, 职位: '数据平台工程师' }, {
                      organization_name: null,
                      safe_reasons: ['category_matched', 'experience_met', 'location_matched', 'workplace_mode_matched'],
                    }),
                  ], null)),
                  在谈列表卡('2026-09-16T11:38:00Z', 在谈页([
                    在谈项({ 记录编号: 编号.记录甲, 职位: '同名在谈项目' }),
                    在谈项({ 记录编号: 编号.记录乙, 职位: '同名在谈项目' }, {
                      needs_action: true,
                      job: { public_salary_range: null },
                    }),
                  ], '3')),
                  在谈详情卡('2026-09-16T12:24:00Z', 在谈详情卡数据(
                    在谈项({ 记录编号: 编号.记录甲, 职位: '同名在谈项目' }),
                    { 公开初评: 初评 },
                  )),
                ],
              },
            },
          ),
          助手消息(
            { 编号: 编号.消息二, 轮次: 编号.轮次二, 文本: 'P1FIX 更早的一条纯文字追问' },
            { created_at: '2026-09-16T08:07:33Z', reply: { text: 无卡Markdown, visibility: 'available', cards: [] } },
          ),
        ],
        next_cursor: null,
      };
      await 安装助手会话路由(page, { 状态 });
      const 诊断 = 安装诊断(page);

      await 进入助手聊天(page);
      await expect(page.getByText('P1FIX 助手正文：同名、长名与缺失字段都按既有卡面呈现。')).toBeVisible({ timeout: 15_000 });

      // 布局不变式：无横向溢出（无卡长 Markdown 与多卡两条路径都覆盖）、输入可见、
      // 单一消息滚动容器、无按钮嵌套
      await 期望聊天布局(page);

      // 无卡 Markdown：标题/加粗/列表渲染成真实元素（不是纯文本）
      await expect(page.locator('h3').filter({ hasText: '产品经理 · 北京市' })).toHaveCount(1);
      await expect(page.locator('strong').filter({ hasText: '产品经理（北京市）' })).toHaveCount(1);

      // 嵌入的是原卡区域：市场卡结构类 + 在谈卡阶段区都在自己的 testid 根内，无重设计
      const 卡结构 = await page.evaluate(() => {
        const 市场卡 = document.querySelector('[data-testid="求职推荐卡"]');
        const 在谈卡 = document.querySelector('[data-testid="求职在谈卡"]');
        return {
          市场卡主体: 市场卡?.querySelector('[class*="卡主体"]') !== null,
          市场卡头行: 市场卡?.querySelector('[class*="公司头行"]') !== null,
          理由区: 市场卡?.querySelector('[class*="理由区"]') !== null,
          在谈阶段区: 在谈卡?.querySelector('[data-card-region="stage"]') !== null,
        };
      });
      expect(卡结构.市场卡主体, '复用原市场卡卡主体').toBe(true);
      expect(卡结构.市场卡头行, '复用原市场卡公司头行').toBe(true);
      expect(卡结构.理由区, '卡内匹配理由区在场').toBe(true);
      expect(卡结构.在谈阶段区, '复用原在谈卡阶段区').toBe(true);

      // 长职位名如实上屏（单行截断不横向溢出）；缺图片走中性空位占位，无外部图请求
      await expect(page.getByText(长职位名)).toHaveCount(1);
      await expect(page.getByRole('img', { name: '公司图片未知' })).toHaveCount(5);
      await expect(page.getByText('发布人未知')).toHaveCount(2);
      // nullable 与占位：公司名缺失、在谈薪资缺失、同名项目两卡、需要你徽标、月薪月数并入薪资后缀（§8A）
      await expect(page.getByTestId('求职推荐卡').filter({ hasText: '公司信息未知' })).toHaveCount(1);
      await expect(page.getByText('薪资未知')).toHaveCount(1);
      await expect(page.getByText('同名在谈项目')).toHaveCount(3);
      await expect(page.getByText('需要你')).toHaveCount(1);
      await expect(page.getByText('25–40K x 15')).toHaveCount(1);
      await expect(page.getByText('15 薪')).toHaveCount(0);
      // 在谈列表卡 next_cursor='3' 非空：既有「下一批」提示照常上屏（静态提示，非分页入口）
      await expect(page.getByText(/下一批/)).toBeVisible();
      // 类型标题与数量；查询时间不上屏
      await expect(page.getByText('推荐岗位', { exact: true })).toBeVisible();
      await expect(page.getByText('2 个岗位')).toBeVisible();
      await expect(page.getByText('在谈列表', { exact: true })).toBeVisible();
      await expect(page.getByText('2 条在谈')).toBeVisible();
      await expect(page.getByText('在谈详情', { exact: true })).toBeVisible();
      await expect(page.getByText(/查询于/)).toHaveCount(0);
      // 卡内中文理由（真实样本组合）；机器码不透出
      await expect(page.getByText('职位方向匹配')).toHaveCount(2);
      await expect(page.getByText('办公方式匹配')).toHaveCount(1);
      await expect(page.getByText(/category_matched|workplace_mode_matched/)).toHaveCount(0);
      // 消息时间：每条消息用户+Agent 各一次（多卡 Agent 也只有一次），dateTime 保留原串
      await expect(page.locator('time')).toHaveCount(4);
      await expect(page.locator('time[datetime="2026-09-16T09:07:33Z"]')).toHaveCount(2);
      await expect(page.locator('time[datetime="2026-09-16T08:07:33Z"]')).toHaveCount(2);

      await 存截图(testInfo, page, `assistant-layout-${宽度}.png`);

      expect(诊断.pageErrors).toEqual([]);
      expect(诊断.failedRequests).toEqual([]);
      expect(诊断.consoleErrors).toEqual([]);
      诊断.detach();
    });
  });
}

// ── 消息时间源对照（Spec §10.4 / Plan Task 2）：两个原生 describe 各一条聚焦用例，
//    不为时区复制整个导航旅程。clock 冻结当前年为 2026；created_at 与 queried_at 跨分钟。 ──

for (const 时区 of ['Asia/Shanghai', 'UTC'] as const) {
  test.describe(`助手会话 消息时间源 ${时区} @backend`, () => {
    test.use({
      viewport: { width: 390, height: 844 },
      locale: 'zh-CN',
      timezoneId: 时区,
      reducedMotion: 'reduce',
    });

    test(`消息时间取 created_at 而非 queried_at（${时区}） @backend`, async ({ page }) => {
      test.setTimeout(120_000);
      const 创建时间 = '2026-09-16T09:07:33.348845Z';
      const 状态 = 创建助手会话状态();
      状态.首页 = {
        items: [助手消息(
          { 编号: 编号.消息一, 轮次: 编号.轮次一, 文本: 'P1FIX 时间源对照' },
          {
            created_at: 创建时间,
            reply: {
              text: 'P1FIX 助手正文：时间源对照。',
              visibility: 'available',
              cards: [岗位推荐卡('2026-09-16T09:52:38Z', 岗位推荐页([
                岗位项({ 岗位编号: 编号.岗位一, 职位: '时间源对照岗' }),
              ], null))],
            },
          },
        )],
        next_cursor: null,
      };
      await 安装助手会话路由(page, { 状态 });
      const 诊断 = 安装诊断(page);
      // 冻结「当前年」为 2026：跨年显示口径不依赖运行机器的真实日期
      await page.clock.install({ time: new Date('2026-09-16T12:00:00Z') });

      await 进入助手聊天(page);
      await expect(page.getByText('时间源对照岗')).toBeVisible({ timeout: 15_000 });

      const 期望文 = 时区 === 'Asia/Shanghai' ? '09-16 17:07' : '09-16 09:07';
      // 用户 + Agent 两侧各一次，同条 created_at、设备本地时区
      await expect(page.getByText(期望文, { exact: true })).toHaveCount(2);
      await expect(page.locator('time')).toHaveCount(2);
      await expect(page.locator(`time[datetime="${创建时间}"]`)).toHaveCount(2);
      // queried_at（09:52，与创建跨分钟）不冒充消息时间
      const 错误文 = 时区 === 'Asia/Shanghai' ? '09-16 17:52' : '09-16 09:52';
      await expect(page.getByText(错误文, { exact: true })).toHaveCount(0);
      await expect(page.getByText(/查询于/)).toHaveCount(0);

      expect(诊断.pageErrors).toEqual([]);
      expect(诊断.failedRequests).toEqual([]);
      expect(诊断.consoleErrors).toEqual([]);
      诊断.detach();
    });
  });
}
