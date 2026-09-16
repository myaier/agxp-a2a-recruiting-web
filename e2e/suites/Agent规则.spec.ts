// e2e/suites/Agent规则.spec.ts
// C6：原「P6 规则域 fixture @backend」describe 等价迁入。P6 双端全链路按 C4 拆为
// 候选创建→确认 / 候选编辑→替换 / 候选归档 / 招聘创建→确认→暂停恢复四个独立 Case
//（各 Case 自建账号与 fixture 状态）。

import { expect, test } from '../fixtures/test';
import { 断言意向规则零写入口, hash直达 } from '../fixtures/数据源交互';
import { 标记 } from '../fixtures/bff/账号与目录';
import { P6标记, P6编号, P6分支编号, P6规则 } from '../fixtures/bff/Agent规则';
import { P1C招聘组织Fixture } from '../fixtures/bff/招聘组织';
import { P3隐私fixture } from '../fixtures/bff/隐私与实名';
import { 安装BFF路由 } from '../fixtures/bff/安装BFF路由';
import { type Page } from '@playwright/test';

// P6 规则域 fixture @backend —— Agent 规则/提案全生命周期（intercepted boundary only）。
// 断言以 fixture 存证的变更回执（body / If-Match / Idempotency-Key）为主，
// 可见文案只做收口佐证；标记值只存在于 fixture，上屏即证明渲染来自 HTTP。
// ─────────────────────────────────────────────────────────────────────────────

/** 就绪提案卡的正文 div 与动作键同属一张卡：正文唯一文本的父节点即卡，卡内恰一组动作键。 */
function 就绪卡动作键(page: Page, 正文: string, 名称: string) {
  return page.getByText(正文).locator('..').getByRole('button', { name: 名称 });
}

test.describe('P6 规则域 fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  // C4 拆分：原「P6 全链路」195 行长链按职责拆为四个独立 Case（各自初始化账号与
  // fixture 状态）；跨操作的版本链与物化断言保留在 accept 所在 Case。
  test('P6 候选创建提案→确认：解读轮询转 ready，accept 才物化规则（body/scope/幂等键） @backend', async ({ page }) => {
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-create',
      记录目录请求: () => undefined,
    });

    // ── candidate restore：session 200 + last_used_role=candidate → 直接落求职主壳 ──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    // 主壳真正挂载后才直达规则页：直达会被在飞的落点 replace 导航吞掉（同 学校搜索
    // 口径，只修测试定义，不改产品；配对并发下 4 worker 满载可复现）。
    await expect(page.getByRole('button', { name: '市场', exact: true })).toBeVisible({ timeout: 15_000 });

    // ── candidate Rule/Proposal 水合：标记值只存在于 fixture ──
    await hash直达(page, '/#/rules');
    await expect(page.getByRole('button', { name: P6标记.候选全局规则, exact: true })).toBeVisible({ timeout: 15_000 });
    // 历史意向规则只水合进意向域：本页不渲染它，编辑/删除/开关三个写入口一个都没有
    await 断言意向规则零写入口(page, P6标记.候选意向规则);
    await expect(page.getByText('AI代理正在理解这条规则…')).toBeVisible();
    await expect(page.getByText(P6标记.就绪提案正文)).toBeVisible();
    // auto_deny 的安全摘要逐字来自 fixture 的 consequence，页面不做任何浏览器侧可接受性判定
    await expect(page.getByText('命中条件时，AI代理会自动拦下')).toBeVisible();
    // 解读中提案在第二次单项 GET 转 ready（轮询 2s 一拍 → 两次读 ≈ 4s）
    await expect(page.getByText(P6标记.解读完成正文)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('符合条件时，AI代理可以自动推进')).toBeVisible();
    expect(p6.proposalReads[P6编号.解释中提案]).toBeGreaterThanOrEqual(2);

    // ── global create → interpreting → ready → accept → active Rule ──
    await page.getByRole('button', { name: '添加规则' }).click();
    // composer 没有范围选择器：候选端提案只能全局，意向规则退役后无任何定向写入口
    await expect(page.getByLabel('规则范围')).toHaveCount(0);
    const 候选输入 = page.getByPlaceholder('例：不接受大小周的岗位直接过滤');
    await 候选输入.fill(P6标记.全局新建草稿);
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    // 创建回执是 interpreting：卡片先出「解读中」，成功才收起输入行
    await expect(候选输入).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText(`已理解：${P6标记.全局新建草稿}`)).toBeVisible({ timeout: 20_000 });
    // accept-success fixture 的公开 consequence 是 mixed
    await expect(page.getByText('这条规则同时包含推进、拦截或参考条件')).toBeVisible();
    await 就绪卡动作键(page, `已理解：${P6标记.全局新建草稿}`, '确认规则').click();
    // 确认后权威 Rule 才物化：正文从卡片变成规则行（按钮，exact 避开 显示删除：⋯ 同文键）
    await expect(page.getByRole('button', { name: `已理解：${P6标记.全局新建草稿}`, exact: true })).toBeVisible({ timeout: 15_000 });
    const 创建全局 = p6.mutationRequests.find((项) => 项.method === 'POST' && 项.path === '/api/v1/me/agent-rule-proposals');
    expect(创建全局).toBeDefined();
    expect(创建全局!.body).toEqual({ text: P6标记.全局新建草稿, scope: { type: 'global' } });
    expect(创建全局!.ifMatch).toBeNull();
    expect(创建全局!.idempotencyKey).toMatch(/\S/);
    // 幂等纪律（本 Case 内）：唯一一次创建带非空 key；accept 一律空对象 body + 自己的 key
    const 候选创建们 = p6.mutationRequests.filter((项) => 项.method === 'POST' && 项.path === '/api/v1/me/agent-rule-proposals');
    expect(候选创建们.length).toBe(1);
    const 候选接受们 = p6.mutationRequests.filter((项) => 项.method === 'POST' && 项.path.includes('/me/') && 项.path.endsWith('/accept'));
    expect(候选接受们.length).toBe(1);
    expect(候选接受们[0]!.body).toEqual({});
    expect(候选接受们[0]!.idempotencyKey).toMatch(/\S/);
  });

  test('P6 候选替换提案：行内编辑草稿预填，确认前旧规则在场，accept 后旧规则归档 @backend', async ({ page }) => {
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-replace',
      记录目录请求: () => undefined,
    });

    // 权威规则行就绪后进编辑（本 Case 独立 fixture：默认全局规则在场即可替换）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await hash直达(page, '/#/rules');
    await expect(page.getByRole('button', { name: P6标记.候选全局规则, exact: true })).toBeVisible({ timeout: 15_000 });

    // ── replacement：点规则正文进入行内编辑（草稿预填原文）；确认前旧 Rule 一直可见、新正文不是规则行 ──
    await page.getByRole('button', { name: P6标记.候选全局规则, exact: true }).click();
    const 编辑框 = page.getByRole('textbox', { name: `编辑规则：${P6标记.候选全局规则}` });
    await expect(编辑框).toHaveCount(1, { timeout: 10_000 });
    await expect(编辑框).toHaveValue(P6标记.候选全局规则);
    await 编辑框.fill(P6标记.替换草稿);
    await page.getByRole('button', { name: '完成' }).click();
    await expect(page.getByText(`已理解：${P6标记.替换草稿}`)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: P6标记.候选全局规则, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `已理解：${P6标记.替换草稿}`, exact: true })).toHaveCount(0);
    const 替换回执 = p6.mutationRequests.find((项) => 项.path === `/api/v1/me/agent-rules/${P6编号.候选全局规则}/replacement-proposals`);
    expect(替换回执).toBeDefined();
    expect(替换回执!.ifMatch).toBe('"1"');
    expect(替换回执!.body).toEqual({ text: P6标记.替换草稿, scope: { type: 'global' } });
    expect(替换回执!.idempotencyKey).toMatch(/\S/);
    await 就绪卡动作键(page, `已理解：${P6标记.替换草稿}`, '确认规则').click();
    await expect(page.getByRole('button', { name: `已理解：${P6标记.替换草稿}`, exact: true })).toBeVisible({ timeout: 15_000 });
    // accept 幂等纪律（替换意图）：空对象 body + 非空 key；与创建意图的 key 不同
    const 替换接受 = p6.mutationRequests.filter((项) => 项.method === 'POST' && 项.path.includes('/me/') && 项.path.endsWith('/accept'));
    expect(替换接受.length).toBe(1);
    expect(替换接受[0]!.body).toEqual({});
    expect(替换接受[0]!.idempotencyKey).toMatch(/\S/);
    // 旧规则归档出局：原文整行（含卡片）消失
    await expect(page.getByText(P6标记.候选全局规则)).toHaveCount(0);
  });

  test('P6 候选归档：键盘揭开删除，确认层前零 DELETE，If-Match 当前版本恰一次 @backend', async ({ page }) => {
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-archive',
      记录目录请求: () => undefined,
    });

    // 本 Case 独立 fixture：归档默认全局规则（版本 1），不依赖先创建/替换
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await hash直达(page, '/#/rules');
    await expect(page.getByRole('button', { name: P6标记.候选全局规则, exact: true })).toBeVisible({ timeout: 15_000 });

    // ── archive：键盘揭开删除（触屏布局下 ⋯ 是 1×1 可达键，走 P7 同款键盘路径）；
    //    确认层确认前零 DELETE，确认后才归档（If-Match 当前版本）──
    const 更多键 = page.getByRole('button', { name: `显示删除：${P6标记.候选全局规则}` });
    await expect(更多键).toHaveAttribute('aria-expanded', 'false');
    await 更多键.focus();
    await page.keyboard.press('Enter');
    const 删除键 = page.getByRole('button', { name: `删除规则：${P6标记.候选全局规则}` });
    await expect(删除键).toBeVisible();
    expect(p6.mutationRequests.filter((项) => 项.method === 'DELETE')).toHaveLength(0);
    await 删除键.click();
    await expect(page.getByText('删除这条规则？')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: '删除', exact: true }).click();
    // 权威回读：规则行与开关整行消失
    await expect(page.getByRole('button', { name: P6标记.候选全局规则, exact: true })).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByRole('switch', { name: `规则：${P6标记.候选全局规则}` })).toHaveCount(0);
    const 删除们 = p6.mutationRequests.filter((项) => 项.method === 'DELETE');
    expect(删除们.length).toBe(1);
    expect(删除们[0]!.ifMatch).toBe('"1"');
    expect(删除们[0]!.path).toMatch(/^\/api\/v1\/me\/agent-rules\/rul_[0-9a-f]{32}$/);
  });

  test('P6 招聘端：创建不带 scope→确认物化→pause/resume 版本推进 1→2→3 @backend', async ({ page }) => {
    // 独立招聘方账号：主体直接以 recruiter 起步（组织域 fixture 支撑水合；双角色切换链
    // 由 P3 岗位硬性条件 Case 承载，此处不重复）
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-recruiter',
      记录目录请求: () => undefined,
      招聘组织Fixture: P1C招聘组织Fixture,
      主体初始角色: 'recruiter',
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    // 主壳真正挂载后才直达规则页（同候选端口径：直达会被在飞的落点 replace 导航吞掉）
    await expect(page.getByRole('button', { name: '推荐', exact: true })).toBeVisible({ timeout: 15_000 });

    // ── recruiter：规则水合 + create（body 永不携带 scope）→ accept；作用域与候选端互相独立 ──
    await hash直达(page, '/#/hr/agent-settings');
    await expect(page.getByRole('button', { name: P6标记.招聘全局规则, exact: true })).toBeVisible({ timeout: 15_000 });
    const 总开关 = page.getByRole('switch', { name: `规则：${P6标记.招聘全局规则}` });
    await expect(总开关).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: '添加规则' }).click();
    await page.getByPlaceholder('例：到岗超过 60 天的候选先不推进').fill(P6标记.招聘新建草稿);
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    await expect(page.getByText(`已理解：${P6标记.招聘新建草稿}`)).toBeVisible({ timeout: 20_000 });
    const 招聘创建 = p6.mutationRequests.find((项) => 项.method === 'POST' && 项.path === '/api/v1/recruiter/agent-rule-proposals');
    expect(招聘创建).toBeDefined();
    expect(招聘创建!.body).toEqual({ text: P6标记.招聘新建草稿 });
    expect(招聘创建!.idempotencyKey).toMatch(/\S/);
    await 就绪卡动作键(page, `已理解：${P6标记.招聘新建草稿}`, '确认规则').click();
    // 招聘端规则行没有编辑按钮：权威落地以行内容 + 开关为准
    await expect(page.getByRole('switch', { name: `规则：已理解：${P6标记.招聘新建草稿}` })).toBeVisible({ timeout: 15_000 });
    const 招聘接受 = p6.mutationRequests.find((项) => 项.path.startsWith('/api/v1/recruiter/agent-rule-proposals/') && 项.path.endsWith('/accept'));
    expect(招聘接受).toBeDefined();
    expect(招聘接受!.body).toEqual({});
    expect(招聘接受!.idempotencyKey).toMatch(/\S/);

    // ── pause → resume：每个应答的版本都在前进（resume 的 If-Match 就是 pause 应答的新版本）──
    await 总开关.click();
    await expect(总开关).toHaveAttribute('aria-checked', 'false', { timeout: 10_000 });
    await 总开关.click();
    await expect(总开关).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
    const 开关写 = p6.mutationRequests.filter((项) => 项.method === 'PATCH' && 项.path === `/api/v1/recruiter/agent-rules/${P6编号.招聘全局规则}`);
    expect(开关写.length).toBe(2);
    expect(开关写[0]!.body).toEqual({ operation: 'pause' });
    expect(开关写[0]!.ifMatch).toBe('"1"');
    expect(开关写[1]!.body).toEqual({ operation: 'resume' });
    expect(开关写[1]!.ifMatch).toBe('"2"');
    // 权威版本链落到 fixture：pause 1→2、resume 2→3
    expect(p6.rules.recruiter.find((规) => 规.rule_id === P6编号.招聘全局规则)?.version).toBe(3);
  });

  test('P6 版本冲突只做一次权威重读且零重放 @backend', async ({ page }) => {
    // PATCH 专用冲突规则 409 version_conflict：effect 没有 receipt，恢复只做一轮权威 Rule 重读
    // （两页翻页 = 不带 cursor 的首页 GET 恰好一次），绝不再发 mutation；开关原样保留。
    const 请求序: string[] = [];
    const 清单读取: { url: string; ms: number }[] = [];
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-conflict',
      记录目录请求: () => undefined,
      招聘组织Fixture: P1C招聘组织Fixture,
      主体初始角色: 'recruiter',
      P6分支: {
        追加规则们: [{
          规则: P6规则({
            rule_id: P6分支编号.冲突规则,
            display_text: P6标记.冲突规则,
            scope: { type: 'global' },
          }),
          分支: '写入冲突',
        }],
      },
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });
    // 清单读取带完整 URL（cursor 参数区分翻页），补丁时间戳用来只数 PATCH 之后的读取
    page.on('request', (请求) => {
      const 地址 = new URL(请求.url());
      if (地址.pathname === '/api/v1/recruiter/agent-rules' && 请求.method() === 'GET') {
        清单读取.push({ url: 地址.pathname + 地址.search, ms: Date.now() });
      }
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await hash直达(page, '/#/hr/agent-settings');
    const 冲突开关 = page.getByRole('switch', { name: `规则：${P6标记.冲突规则}` });
    await expect(冲突开关).toBeVisible({ timeout: 15_000 });
    await expect(冲突开关).toHaveAttribute('aria-checked', 'true');

    const 点击时刻 = Date.now();
    await 冲突开关.click();
    await expect(page.getByText('数据已在其他地方更新，请重试')).toBeVisible({ timeout: 10_000 });
    await expect(冲突开关).toHaveAttribute('aria-checked', 'true');
    const 补丁键 = `PATCH /api/v1/recruiter/agent-rules/${P6分支编号.冲突规则}`;
    const 补丁位 = 请求序.lastIndexOf(补丁键);
    expect(补丁位).toBeGreaterThanOrEqual(0);
    // 零重放：PATCH 只发出过一次
    expect(请求序.filter((项) => 项 === 补丁键).length).toBe(1);
    // 一次权威重读：PATCH 之后带 cursor 的翻页请求恰一轮（首页 GET 恰好一次）
    await expect.poll(() => 清单读取.filter((项) => 项.ms >= 点击时刻 && !项.url.includes('cursor=')).length, { timeout: 5_000 }).toBe(1);
    // 回执存证：If-Match 是水合时的当前版本
    const 冲突写 = p6.mutationRequests.find((项) => 项.path === `/api/v1/recruiter/agent-rules/${P6分支编号.冲突规则}`);
    expect(冲突写).toBeDefined();
    expect(冲突写!.ifMatch).toBe('"1"');
    expect(冲突写!.body).toEqual({ operation: 'pause' });
  });

  test('P6 accept 响应丢失与结果未知经权威 GET 收敛 @backend', async ({ page }) => {
    // 真·响应丢失（连接中断）：accept 已被服务端处理，客户端不重发 mutation，
    // 恢复走 GET 提案（accepted 回执）→ 完整重读 Rules；503 outcome_unknown 额外证明
    // 受控重试复用同一把 Idempotency-Key。
    test.setTimeout(120_000);
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-loss',
      记录目录请求: () => undefined,
      P6分支: {
        追加提案们: [
          {
            提案: {
              proposal_id: P6分支编号.丢失提案,
              state: 'ready',
              normalized_text: P6标记.丢失提案正文,
              consequence: 'auto_allow',
              created_at: '2026-08-26T00:00:00Z',
            },
            分支: 'accept丢失',
          },
          {
            提案: {
              proposal_id: P6分支编号.未知提案,
              state: 'ready',
              normalized_text: P6标记.未知提案正文,
              consequence: 'advisory',
              created_at: '2026-08-26T00:00:00Z',
            },
            分支: 'accept未知',
          },
        ],
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await hash直达(page, '/#/rules');
    await expect(page.getByText(P6标记.丢失提案正文)).toBeVisible({ timeout: 15_000 });

    // 响应丢失：POST 恰一次（mutation 不自动重试），权威收敛后规则行出现、卡片消失
    await 就绪卡动作键(page, P6标记.丢失提案正文, '确认规则').click();
    await expect(page.getByRole('button', { name: P6标记.丢失提案正文, exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(就绪卡动作键(page, P6标记.丢失提案正文, '确认规则')).toHaveCount(0);
    const 丢失接受们 = p6.mutationRequests.filter((项) => 项.path === `/api/v1/me/agent-rule-proposals/${P6分支编号.丢失提案}/accept`);
    expect(丢失接受们.length).toBe(1);
    expect(p6.proposalReads[P6分支编号.丢失提案]).toBeGreaterThanOrEqual(1);

    // 结果未知：受控重试一次、两把 key 是同一把，仍 503 后同样经 GET 提案 + Rule 清单收敛
    await 就绪卡动作键(page, P6标记.未知提案正文, '确认规则').click();
    await expect(page.getByRole('button', { name: P6标记.未知提案正文, exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(就绪卡动作键(page, P6标记.未知提案正文, '确认规则')).toHaveCount(0);
    const 未知接受们 = p6.mutationRequests.filter((项) => 项.path === `/api/v1/me/agent-rule-proposals/${P6分支编号.未知提案}/accept`);
    expect(未知接受们.length).toBe(2);
    expect(未知接受们[0]!.idempotencyKey).not.toBe('');
    expect(未知接受们[0]!.idempotencyKey).toBe(未知接受们[1]!.idempotencyKey);
    expect(p6.proposalReads[P6分支编号.未知提案]).toBeGreaterThanOrEqual(1);
  });

  test('P6 切换招聘端后迟到的候选端应答不再上屏 @backend', async ({ page }) => {
    // 首次规则清单 503 → 重试键；重试的规则清单第一页被挂起到切身份之后才应答：
    // 旧会话代际的迟到响应整包丢弃，候选端标记绝不上招聘端页面；切回候选端后完整水合照常。
    test.setTimeout(120_000);
    let 放行!: () => void;
    const 门 = new Promise<void>((ok) => { 放行 = ok; });
    const 请求序: string[] = [];
    // 切回候选端是交互式水合：隐私域缺席会按「Mock 不顶替 HTTP」边界拒绝并中断切换，故提供 fixture
    const 隐私 = P3隐私fixture();
    await 安装BFF路由(page, {
      登录尝试id: 'att-p6-stale',
      记录目录请求: () => undefined,
      招聘组织Fixture: P1C招聘组织Fixture,
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      P6分支: { 规则清单首次失败: true, 挂起候选规则: 门 },
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await hash直达(page, '/#/rules');
    await expect(page.getByRole('button', { name: '规则加载失败，重试' })).toBeVisible({ timeout: 15_000 });

    // 重试：这一轮规则清单第一页被 fixture 挂起，请求横跨切身份全程
    await page.getByRole('button', { name: '规则加载失败，重试' }).click();
    await expect.poll(() => 请求序.filter((项) => 项 === 'GET /api/v1/me/agent-rules').length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);

    // 切到招聘端（会话代际递增），招聘端事实先水合完成
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    await hash直达(page, '/#/hr/agent-settings');
    await expect(page.getByText(P6标记.招聘全局规则)).toBeVisible({ timeout: 15_000 });

    // 放行迟到应答：候选端规则/提案标记一个都不出现
    放行();
    await page.waitForTimeout(1500);
    await expect(page.getByText(P6标记.招聘全局规则)).toBeVisible();
    await expect(page.getByText(P6标记.候选全局规则)).toHaveCount(0);
    await expect(page.getByText(P6标记.候选意向规则)).toHaveCount(0);
    await expect(page.getByText(P6标记.就绪提案正文)).toHaveCount(0);

    // 切回候选端：新代际的完整水合不受迟到应答影响
    await page.goto('/#/identity?switch=1&from=hr');
    await page.getByRole('button', { name: '翻到「求职者」那一面' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await hash直达(page, '/#/rules');
    await expect(page.getByText(P6标记.候选全局规则)).toBeVisible({ timeout: 15_000 });
  });

  test('P6 失败提案卡显示固定文案，失败保留草稿可再提交 @backend', async ({ page }) => {
    // 专用提案单项 GET 即 failed：固定失败文案 + 关闭；创建失败（500）时草稿与范围原样保留，
    // 再次提交是新意图、新 key。
    test.setTimeout(120_000);
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-failed',
      记录目录请求: () => undefined,
      P6分支: {
        追加提案们: [{
          提案: { proposal_id: P6分支编号.失败提案, state: 'interpreting', created_at: '2026-08-26T00:00:00Z' },
          分支: '单读失败',
        }],
        创建前几次失败: 1,
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await hash直达(page, '/#/rules');
    await expect(page.getByText('AI代理正在理解这条规则…').first()).toBeVisible({ timeout: 15_000 });

    // 轮询读到权威 failed（legacy 无 code）→ 兜底失败文案；关闭只收起这一张卡
    await expect(page.getByText('本次规则没有生效')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '关闭' }).click();
    await expect(page.getByText('本次规则没有生效')).toHaveCount(0);

    // 创建失败：composer 不收起，草稿原样保留（绝不伪造成功；范围选择器已退役，提案恒为全局）
    await page.getByRole('button', { name: '添加规则' }).click();
    const 候选输入 = page.getByPlaceholder('例：不接受大小周的岗位直接过滤');
    await 候选输入.fill(P6标记.失败草稿);
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    // 500 的原始 message 不进 UI：兜底固定文案上屏（真实性修复 D），草稿原样保留可再提交
    await expect(page.getByText('后端服务暂时不可用，请稍后重试')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(P6标记.创建失败提示)).toHaveCount(0);
    await expect(候选输入).toHaveValue(P6标记.失败草稿);

    // 再次提交：新意图、新 key，创建成功才收起输入行
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    await expect(候选输入).toHaveCount(0, { timeout: 10_000 });
    const 创建们 = p6.mutationRequests.filter((项) => 项.method === 'POST' && 项.path === '/api/v1/me/agent-rule-proposals');
    expect(创建们.length).toBe(2);
    expect(创建们[0]!.body).toEqual({ text: P6标记.失败草稿, scope: { type: 'global' } });
    expect(创建们[1]!.body).toEqual({ text: P6标记.失败草稿, scope: { type: 'global' } });
    expect(创建们[0]!.idempotencyKey).not.toBe('');
    expect(创建们[0]!.idempotencyKey).not.toBe(创建们[1]!.idempotencyKey);
  });

  test('P6 重复 cursor 按契约漂移失败出服务异常重试，不回退 Mock @backend', async ({ page }) => {
    // 清单游标成环 → 解码器按翻页死循环拒绝，rules 域整体失败：
    // 重试键上屏、无清单/无计数/无写控件，Mock 种子绝不顶替 HTTP。
    await 安装BFF路由(page, {
      登录尝试id: 'att-p6-cursor',
      记录目录请求: () => undefined,
      P6分支: { 游标成环: true },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await hash直达(page, '/#/rules');
    await expect(page.getByRole('button', { name: '规则加载失败，重试' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('规则加载中')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '添加规则' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: P6标记.候选全局规则, exact: true })).toHaveCount(0);
    await expect(page.getByText(P6标记.候选意向规则)).toHaveCount(0);
    await expect(page.getByText('不主动披露并行接触数量')).toHaveCount(0);
    await expect(page.getByText('双休是底线；隔周六可谈，大小周不谈')).toHaveCount(0);
  });

  test('P6 首次水合挂起期间无任何规则内容与写入口 @backend', async ({ page }) => {
    // 规则清单第一页被挂起：初始化完成前整壳只有路由加载中 ——
    // Mock 种子行 / 写控件 / 重试键都不上屏；放行后权威行落地（意向规则仍不渲染、无写入口）。
    test.setTimeout(120_000);
    let 放行!: () => void;
    const 门 = new Promise<void>((ok) => { 放行 = ok; });
    await 安装BFF路由(page, {
      登录尝试id: 'att-p6-pending',
      记录目录请求: () => undefined,
      P6分支: { 挂起候选规则: 门 },
    });

    await page.goto('/#/rules'); // 首航无在飞 replace；本用例断言首航即加载态
    await expect(page.getByText('正在加载…')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('不主动披露并行接触数量')).toHaveCount(0);
    await expect(page.getByText('双休是底线；隔周六可谈，大小周不谈')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '添加规则' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '规则加载失败，重试' })).toHaveCount(0);

    放行();
    await expect(page.getByRole('button', { name: P6标记.候选全局规则, exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('switch', { name: `规则：${P6标记.候选全局规则}` })).toBeVisible();
    // 历史意向规则水合进意向域：本页不渲染，也没有任何写入口
    await 断言意向规则零写入口(page, P6标记.候选意向规则);
  });

  test('P6 accept 409 not_actionable 权威恢复保留卡片 @backend', async ({ page }) => {
    // 专用提案公开 consequence 是 auto_allow（看起来完全可执行），服务端仍裁决 not_actionable：
    // 公开后果从不决定可执行性 —— 恢复路径读权威回执，卡片保留、绝不本地物化规则、零重放。
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-not-actionable',
      记录目录请求: () => undefined,
      P6分支: {
        追加提案们: [{
          提案: {
            proposal_id: P6分支编号.不可接受提案,
            state: 'ready',
            normalized_text: P6标记.不可接受提案正文,
            consequence: 'auto_allow',
            created_at: '2026-08-26T00:00:00Z',
          },
          分支: 'accept不可接受',
        }],
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await hash直达(page, '/#/rules');
    await expect(page.getByText(P6标记.不可接受提案正文)).toBeVisible({ timeout: 15_000 });

    await 就绪卡动作键(page, P6标记.不可接受提案正文, '确认规则').click();
    await expect(page.getByText('这条内容暂时不能成为长期规则，请放弃或换一种说法')).toBeVisible({ timeout: 10_000 });
    // 权威恢复：GET 回执仍是 ready → 卡片原样保留，规则清单不变、没有规则行被物化
    await expect(page.getByText(P6标记.不可接受提案正文)).toBeVisible();
    await expect(page.getByRole('button', { name: P6标记.不可接受提案正文, exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: P6标记.候选全局规则, exact: true })).toBeVisible();
    const 接受们 = p6.mutationRequests.filter((项) => 项.path === `/api/v1/me/agent-rule-proposals/${P6分支编号.不可接受提案}/accept`);
    expect(接受们.length).toBe(1);
    expect(p6.proposalReads[P6分支编号.不可接受提案]).toBeGreaterThanOrEqual(1);
  });
});
