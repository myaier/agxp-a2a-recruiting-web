// e2e/suites/MatchCase.spec.ts
// C6：原「P5 MatchCase 生命周期 fixture / P5 Mock 数据源隔离」等价迁入
//（在谈详情完整布局归 展示与交互.spec.ts）。

import { expect, test } from '../fixtures/test';
import { 装P5候选, 装P5招聘, 装P5双角色, 断言纵序, hash直达 } from '../fixtures/数据源交互';
import { 标记 } from '../fixtures/bff/账号与目录';
import { P6标记 } from '../fixtures/bff/Agent规则';
import { P5编号, P5标记, P5连续编号, 种连续探针记录, 创建P5MatchCasefixture } from '../fixtures/bff/MatchCase';
import { P7会话编号 } from '../fixtures/bff/真人消息';

// ─────────────────────────────────────────────────────────────────────────────
// P5 MatchCase 生命周期 @backend —— 双端 match-cases 的浏览器验收旅程（Task 8）。
// fixture 见 创建P5MatchCasefixture；变更回执 / PDF 读取 / 应答头（no-store）存证。
// ─────────────────────────────────────────────────────────────────────────────

/** POST 之后必有权威 detail 重读（mutation 响应是 void，权威态只来自 GET）。
 *  J-PILOT-01：候选端权威重读走 me/negotiations 聚合，招聘端维持原 Case GET。 */
function 断言重读发生(请求序: readonly string[], POST项: string) {
  const 位 = 请求序.indexOf(POST项);
  expect(位).toBeGreaterThanOrEqual(0);
  expect(请求序.slice(位 + 1).some((项) =>
    /^GET \/api\/v1\/(me|recruiter)\/(match-cases|negotiations)\/[^/]+$/.test(项))).toBe(true);
}
test.describe('P5 MatchCase 生命周期 fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('同一 Case 双端 needs_action 分歧，列表保留服务端顺序与游标 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5双角色(page, {
      主体初始角色: 'candidate',
      请求拦截: ({ path, method, query }) => 请求序.push(`${method} ${path}${query ?? ''}`),
    });

    // ── 候选端 #/app：在谈主列表 = 全意向连续 active 集合（J-PILOT-01，恒省略
    //    intention_id + limit=50）──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await expect(page.getByText(P5标记.丁职位名)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '加载更多' })).toBeVisible(); // 游标未尽
    expect(请求序).toContain('GET /api/v1/me/negotiations?shelf=active&limit=50');

    // 加载更多：首页 cursor 原样透传，第二页按服务端顺序追加上屏
    await page.getByRole('button', { name: '加载更多' }).click();
    await expect(page.getByText(P5标记.甲职位名)).toBeVisible({ timeout: 10_000 });
    expect(请求序).toContain('GET /api/v1/me/negotiations?shelf=active&limit=50&cursor=p5pg2');
    await 断言纵序(page, [P5标记.丁职位名, P5标记.乙职位名, P5标记.丙一职位名, P5标记.丙二职位名, P5标记.甲职位名]);
    // 候选端视角：丁/乙/丙一/丙二需要你 ×4；同一 Case 甲对候选端零待办（代理处理中）
    await expect(page.getByText('需要你', { exact: true })).toHaveCount(4);
    await expect(page.getByText('代理处理中', { exact: true })).toHaveCount(1);

    // ── 切招聘端：同一批 Case 的 needs_action 由 viewer 重新裁决 ──
    // 招聘端在谈卡 2026-09-09 起只渲染 candidate_summary 摘要 + 阶段段（别名/冻结职位
    // 事实退场）；fixture 摘要恒 null → 首行中性「候选信息暂未披露」，就绪锚点随之换。
    await hash直达(page, '/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    // 卡片统一（2026-09-10）后招聘端在谈卡面 = 候选摘要 + 阶段区：Case 职位名/别名退场，
    // 行锚点改用 candidate_summary 投影的现职标记（逐单不同，逐字来自 HTTP fixture）
    await expect(page.getByText(P5标记.现职.甲)).toBeVisible({ timeout: 20_000 });
    // 甲：候选端「代理处理中」→ 招聘端「需要你」（backend J5b 同款分歧）。
    // 卡片统一后徽标统一走 从P5到阶段：needs_action → 需要你，否则 代理处理中（候选端同映射）。
    // 首页唯甲：需要你 ×1、代理处理中 ×0
    await expect(page.getByText('需要你', { exact: true })).toHaveCount(1);
    await expect(page.getByText('代理处理中', { exact: true })).toHaveCount(0);
    expect(请求序).toContain(`GET /api/v1/recruiter/match-cases?job_id=${P5编号.job}&limit=50&include=candidate_summary`);
    await page.getByRole('button', { name: '加载更多' }).click();
    await expect(page.getByText(P5标记.现职.丁)).toBeVisible({ timeout: 10_000 });
    await 断言纵序(page, [P5标记.现职.甲, P5标记.现职.丁, P5标记.现职.乙, P5标记.现职.丙一, P5标记.现职.丙二]);
    // 读尽后：甲/丁 needs_action → 需要你 ×2；乙/丙一/丙二 waiting → 代理处理中 ×3
    await expect(page.getByText('需要你', { exact: true })).toHaveCount(2);
    await expect(page.getByText('代理处理中', { exact: true })).toHaveCount(3);
    expect(请求序).toContain(`GET /api/v1/recruiter/match-cases?job_id=${P5编号.job}&limit=50&include=candidate_summary&cursor=p5pg2`);

    // 候选端专属上下文（intention_id）绝不上招聘端的屏
    await expect(page.getByText(new RegExp(P6标记.意向编号))).toHaveCount(0);
    // 整段旅程零写请求；每个 match-cases / negotiations JSON 应答都带 no-store（fixture 侧存证）
    expect(fixture.变更请求).toEqual([]);
    expect(fixture.应答头存证.filter((项) => 项.path.includes('/match-cases') || 项.path.includes('/negotiations'))
      .every((项) => 项.cacheControl === 'no-store')).toBe(true);
  });

  test('未知 lifecycle/stage/status/step 与矩阵外四元组 fail closed @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = 创建P5MatchCasefixture();
    fixture.分支.坏行进列表 = true;
    // 探针的连续身份只在本用例注入（坏样本不进默认 active 集合）
    种连续探针记录(fixture);
    await 装P5候选(page, { fixture, 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    // 一行未知 status 毒化整页：首载失败态 + 重试，任何行（含合法行）都不上屏
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await expect(page.getByText('在谈暂时加载不了')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('服务返回异常，请稍后重试').first()).toBeVisible();
    await expect(page.getByText(P5标记.丁职位名)).toHaveCount(0);
    // Mock 在谈单绝不顶替 HTTP
    await expect(page.getByText('资深后端工程师 · 交易网关')).toHaveCount(0);

    // 详情逐个探（J-PILOT-01：候选详情深链走 me/negotiations alias 直读）：
    // 未知词与矩阵外四元组一律 fail closed —— 零动作卡、零输入
    const 坏编号们 = [P5编号.坏生命周期, P5编号.坏阶段, P5编号.坏状态, P5编号.坏步骤, P5编号.坏四元组];
    for (const 编号 of 坏编号们) {
      await hash直达(page, `/#/deal/${编号}`);
      await expect(page.getByText('这一单暂时打不开')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('服务返回异常，请稍后重试').first()).toBeVisible();
      await expect(page.getByRole('button', { name: '提交回答' })).toHaveCount(0);
      await expect(page.getByPlaceholder('有想法就告诉你的AI代理')).toHaveCount(0);
      expect(请求序).toContain(`GET /api/v1/me/negotiations/${编号}`);
    }
    // 重试只重发权威 GET（仍 fail closed），绝不变异
    const 详情GET数 = () => 请求序.filter((项) => 项 === `GET /api/v1/me/negotiations/${P5编号.坏四元组}`).length;
    const 前 = 详情GET数();
    await page.getByRole('button', { name: '重试' }).click();
    await expect.poll(() => 详情GET数(), { timeout: 5_000 }).toBeGreaterThan(前);
    expect(fixture.变更请求).toEqual([]);
  });

  test('候选详情直达刷新：空列表记忆下整页可渲染 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5候选(page, { 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    // 首个导航就是详情深链：列表从未挂载，context 只来自详情 GET
    await hash直达(page, `/#/deal/${P5编号.乙}`);
    await expect(page.getByText(P5标记.乙职位名).first()).toBeVisible({ timeout: 20_000 });
    // 意向 ID 是内部坐标（P5 Task 4 起不进可见内容），深链渲染绝不依赖它
    await expect(page.getByText(new RegExp(P6标记.意向编号))).toHaveCount(0);
    await expect(page.getByText('轮次 1/3')).toBeVisible();
    // S0（J-PILOT-01）：人工补事实提交退场 —— 只剩时间线里的代理问题文本，
    // 无补事实提交入口；底栏保留原输入框与发送键但真禁用（Spec §7），
    // placeholder 按真实阶段变化。
    await expect(page.getByText(P5标记.问题).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '提交回答' })).toHaveCount(0);
    const S0输入 = page.getByPlaceholder('双方 AI 代理正在确认条件');
    await expect(S0输入).toBeVisible();
    await expect(S0输入).toBeDisabled();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
    expect(请求序).toContain(`GET /api/v1/me/negotiations/${P5编号.乙}`);
    expect(请求序.filter((项) => /\/negotiations\?/.test(项))).toEqual([]); // 零列表/历史读取

    // 旧 S0 needs_user 待核实说明（Spec §7）：停止该卡交互并交负责人处理
    await expect(page.getByText('旧版状态待核实，请交负责人处理').first()).toBeVisible();

    // 键盘与程序回调都不得发请求：禁用控件零 POST（Spec §7 零发送）
    const 前变更数 = fixture.变更请求.length;
    await S0输入.press('Enter');
    await page.waitForTimeout(500);
    expect(fixture.变更请求).toHaveLength(前变更数);
  });

  test('招聘详情直达刷新：空列表记忆下整页可渲染 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    await 装P5招聘(page, { 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    await hash直达(page, `/#/hr/candidate/${P5编号.甲}`);
    // 详情统一（spec §3.1）：招聘顶栏去名 —— alias 不显示，画像位置全保留并显示缺失，
    // 冻结职位 · 城市 · 薪资带由岗位上下文单独承载
    await expect(page.getByText(P5标记.甲职位名).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(P5标记.甲别名)).toHaveCount(0);
    await expect(page.getByText('经验缺失')).toBeVisible();
    await expect(page.getByText('学历缺失')).toBeVisible();
    await expect(page.getByText('求职状态缺失')).toBeVisible();
    await expect(page.getByRole('img', { name: '性别未知' })).toBeVisible();
    await expect(page.getByText('需要你', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '通过初筛' })).toBeVisible();
    await expect(page.getByRole('button', { name: '不合适' })).toBeVisible();
    expect(请求序).toContain(`GET /api/v1/recruiter/match-cases/${P5编号.甲}`);
    expect(请求序.filter((项) => /\/match-cases\?/.test(项))).toEqual([]);
    // 身份 canary：P5 投影里没有姓名/联系方式渲染路径
    await expect(page.getByText(标记.主体真名)).toHaveCount(0);
  });

  test('S0 观察期零输入零写：respond_fact 退场、底栏真禁用、3 秒重读零写请求 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = 创建P5MatchCasefixture();
    await 装P5候选(page, { fixture, 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    await hash直达(page, `/#/deal/${P5编号.乙}`);
    // J-PILOT-01（Spec §7）：双端 S0 零人工输入 —— 代理问题只剩时间线文本，
    // 补事实/提交回答入口退场；底栏保留原控件但禁用，placeholder 按阶段变化。
    await expect(page.getByText(P5标记.问题).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('补充事实')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '提交回答' })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: '回答问题' })).toHaveCount(0);
    const S0输入 = page.getByPlaceholder('双方 AI 代理正在确认条件');
    await expect(S0输入).toBeDisabled();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();

    // 3 秒节拍已权威重读；整个观察窗零写请求（零发送不只靠颜色灰化）。
    // （旧 S0 needs_user 待核实停表：一拍即停，与 3 秒节拍停止口径一致。）
    const 详情GET数 = () => 请求序.filter((项) => 项 === `GET /api/v1/me/negotiations/${P5编号.乙}`).length;
    await page.waitForTimeout(3_500);
    expect(详情GET数()).toBeGreaterThanOrEqual(2);
    expect(fixture.变更请求).toEqual([]);
    expect(请求序.filter((项) => 项.endsWith('/fact-responses'))).toEqual([]);
  });

  test('披露前与解析中/失败：无姓名无联系方式无 PDF；失败重试重发同一对 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5双角色(page, {
      主体初始角色: 'candidate',
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    // ── 候选端 丙二（解析失败）：重试卡只认阶段区 typed 附件 ──
    await hash直达(page, `/#/deal/${P5编号.丙二}`);
    await expect(page.getByRole('button', { name: '重试校验' })).toBeVisible({ timeout: 20_000 });

    // 首次递交（J-PILOT-01：retry_resume_readiness 是原授权检查，直接提交原绑定对，
    // 不再展示披露确认层）：失败解析挡披露（409 → 统一收口文案），卡仍在
    await page.getByRole('button', { name: '重试校验' }).click();
    // 409 resume_readiness_failed 的远端 message 不进 UI（真实性修复 D）：统一收口文案
    await expect(page.getByText('请求失败，请稍后再试').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '重试校验' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0); // 原授权检查零再次确认

    // 解析恢复后同键重放同一对（file/version 与 typed 附件逐字一致）→ 披露成功
    await page.getByRole('button', { name: '重试校验' }).click();
    await expect(page.getByText('等待招聘方决定')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '重试校验' })).toHaveCount(0);
    const 递交POST = fixture.变更请求.filter((项) => 项.path.endsWith('/resume-submission'));
    expect(递交POST).toHaveLength(2);
    expect(递交POST[0]!.body).toEqual({
      file_id: P5编号.文件, file_version_id: P5编号.文件版本, disclosure_confirmed: true,
    });
    expect(递交POST[0]!.body).toEqual(递交POST[1]!.body);
    expect(递交POST[0]!.idempotencyKey).not.toBe('');
    expect(递交POST[0]!.idempotencyKey).toBe(递交POST[1]!.idempotencyKey);

    // ── 切招聘端：披露前（乙 S0）与解析中（丙一 S1 waiting）不暴露姓名/联系方式/PDF ──
    await hash直达(page, '/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    for (const [编号, 职位名, 别名] of [
      [P5编号.丙一, P5标记.丙一职位名, P5标记.丙一别名],
      [P5编号.乙, P5标记.乙职位名, P5标记.乙别名],
    ] as const) {
      await hash直达(page, `/#/hr/candidate/${编号}`);
      // 就绪锚点 = 岗位上下文（冻结职位 · 城市 · 薪资带）；去名裁定：别名不上详情顶栏
      await expect(page.getByText(职位名).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(别名)).toHaveCount(0);
      // 姓名只在 /me/resume（候选端会话已读过）里存在；P5 投影绝无渲染路径
      await expect(page.getByText(标记.主体真名)).toHaveCount(0);
      // 无 PDF 入口：附件行（PDF 徽标 + 文件名）一个都不出现
      await expect(page.locator('button').filter({ hasText: 'PDF' })).toHaveCount(0);
      await expect(page.getByText(P5标记.简历名)).toHaveCount(0);
    }
    expect(fixture.PDF读取).toEqual([]); // 全程零内容 GET
  });

  test('已披露招聘端只开 Case 专属原始 PDF（叮嘱落段后入口仍在） @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5招聘(page, { 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    await hash直达(page, `/#/hr/candidate/${P5编号.甲}`);
    const 附件键 = page.getByRole('button', { name: new RegExp(P5标记.简历名) });
    await expect(附件键).toBeVisible({ timeout: 20_000 });

    // ── 终审回归钉：S1 段一旦有对话内容，PDF 入口不得消失。招聘端就在同一屏发一条
    //    Case 叮嘱（回执带 expression 文本落进当前 S1 段），权威重读落条后入口仍在 ──
    await page.getByPlaceholder('有想法就告诉你的AI代理').fill(P5标记.叮嘱);
    await page.getByRole('button', { name: '发送' }).click();
    // 同步点 = 输入框清空（POST + 权威重读完成后才 resolve、成功才清草稿）；
    // 清空后 getByText 只可能命中段内回执 —— 证明「回执落段」而非 textarea 值。
    await expect(page.getByPlaceholder('有想法就告诉你的AI代理')).toHaveValue('', { timeout: 10_000 });
    await expect(page.getByText(P5标记.叮嘱).first()).toBeVisible(); // 回执落段
    await expect(附件键).toBeVisible(); // 入口不被段内对话压掉

    // 点击只走 Case 专属 recruiter 路径；唯一一次内容 GET
    const 内容请求 = page.waitForRequest(
      (请求) => new URL(请求.url()).pathname === `/api/v1/recruiter/match-cases/${P5编号.甲}/resume-submission/content`,
    );
    await 附件键.click();
    await 内容请求;
    // 弹层：PDF 徽标 + 文件名 + iframe（真实字节经租约地址呈现）
    await expect(page.getByRole('dialog').getByText(P5标记.简历名)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTitle('简历 PDF')).toBeVisible();
    expect(fixture.PDF读取).toEqual([`recruiter:${P5编号.甲}`]);
    // 候选臂路径绝不请求；PDF 应答是 private, no-store
    expect(请求序.filter((项) => 项.includes('/me/match-cases/'))).toEqual([]);
    const PDF头 = fixture.应答头存证.filter((项) => 项.path.endsWith('/resume-submission/content'));
    expect(PDF头).toHaveLength(1);
    expect(PDF头[0]!.cacheControl).toBe('private, no-store');

    // 关闭即收层（租约随弹层回收）
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('S2/S3 每步权威重读，本端动作卡随权威视图消失 @backend', async ({ page }) => {
    test.setTimeout(150_000);
    const 请求序: string[] = [];
    const fixture = await 装P5双角色(page, {
      主体初始角色: 'candidate',
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    // ── 候选端 S2 accept：POST → 权威重读 → 本端卡消失（对方仍待决）──
    await hash直达(page, `/#/deal/${P5编号.丁}`);
    await expect(page.getByRole('button', { name: '接受', exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('回应协同事项')).toBeVisible();
    await page.getByRole('button', { name: '接受', exact: true }).click();
    await expect(page.getByRole('button', { name: '接受', exact: true })).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText('回应协同事项')).toHaveCount(0);
    断言重读发生(请求序, `POST /api/v1/me/match-cases/${P5编号.丁}/coordination/${P5编号.协同}/decisions`);

    // ── 切招聘端：同一协同卡仍归招聘方 → accept 后 S2 收口进 S3 ──
    await hash直达(page, '/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    await hash直达(page, `/#/hr/candidate/${P5编号.丁}`);
    await expect(page.getByRole('button', { name: '接受', exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '接受', exact: true }).click();
    await expect(page.getByRole('button', { name: '确认意向' })).toBeVisible({ timeout: 10_000 });

    // S3：招聘方确认 → 本端意向卡消失，等待候选人（终态动作消失）
    await page.getByRole('button', { name: '确认意向' }).click();
    await expect(page.getByRole('button', { name: '确认意向' })).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByRole('button', { name: '婉拒意向' })).toHaveCount(0);
    await expect(page.getByText('等待候选人确认意向')).toBeVisible();
    断言重读发生(请求序, `POST /api/v1/recruiter/match-cases/${P5编号.丁}/intent-decisions`);

    // ── 切回候选端：最后一笔确认完成 Case —— 移交文案上屏、双方动作表清空 ──
    await hash直达(page, '/#/identity?switch=1&from=hr');
    await page.getByRole('button', { name: '翻到「求职者」那一面' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await hash直达(page, `/#/deal/${P5编号.丁}`);
    await expect(page.getByRole('button', { name: '确认意向' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '确认意向' }).click();
    await expect(page.getByText('双方已确认，正在创建会话').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('已通过', { exact: true }).first()).toBeVisible();

    // 每个 mutation 恰一次 POST、各走本端唯一准许路线；主壳可预载 P7 收件箱集合，
    // 但 P5 没有会话标识，不能提前读取会话详情、消息或移交路由。
    const 决定POST们 = fixture.变更请求.filter((项) => 项.method === 'POST');
    expect(决定POST们.map((项) => `${项.method} ${项.path} ${JSON.stringify(项.body)}`)).toEqual([
      `POST /api/v1/me/match-cases/${P5编号.丁}/coordination/${P5编号.协同}/decisions {"action":"accept"}`,
      `POST /api/v1/recruiter/match-cases/${P5编号.丁}/coordination/${P5编号.协同}/decisions {"action":"accept"}`,
      `POST /api/v1/recruiter/match-cases/${P5编号.丁}/intent-decisions {"action":"confirm"}`,
      `POST /api/v1/me/match-cases/${P5编号.丁}/intent-decisions {"action":"confirm"}`,
    ]);
    expect(请求序.filter((项) => /\/conversations\/|\/chat\/|handoff/i.test(项))).toEqual([]);
  });

  test('completed 移交两步：pending 继续低频重读恒禁用，发布后进入 P7 会话路由 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5候选(page, { 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    await hash直达(page, '/#/archived');
    // J-PILOT-01：候选历史 = 单一连续集合（shelf=history），不再拼双架
    await expect(page.getByText(P5标记.己职位名)).toBeVisible({ timeout: 15_000 });
    await page.getByText(P5标记.己职位名).click();
    await expect(page.getByText('双方已确认，正在创建会话').first()).toBeVisible({ timeout: 10_000 });

    // 「开始私聊」在场但恒禁用：准备中，会话坐标只能来自服务端发布
    const 私聊键 = page.getByRole('button', { name: '开始私聊' });
    await expect(私聊键).toBeVisible();
    await expect(私聊键).toBeDisabled();
    // completed 终态只读（Task 10 口径）：底部保留为只读区域、零发送 —— 位置断言（无输入
    // 控件）保留，同时正向钉只读说明与发送键缺席
    await expect(page.getByRole('button', { name: '确认意向' })).toHaveCount(0);
    await expect(page.getByText('当前在谈已结束，仅可查看')).toBeVisible();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toHaveCount(0);
    await expect(page.getByPlaceholder('有想法就告诉你的AI代理')).toHaveCount(0);

    // P7 Task 7：pending 不是详情终局 —— 3 秒节拍继续权威重读（same-party 长期
    // pending 同形态：多拍后仍是准备态，绝不出现内部错误词或前端超时终态）
    const 详情GET数 = () => 请求序.filter((项) => 项 === `GET /api/v1/me/negotiations/${P5连续编号.己}`).length;
    await page.waitForTimeout(4_000);
    const 拍后数 = 详情GET数();
    await page.waitForTimeout(3_500);
    expect(详情GET数()).toBeGreaterThan(拍后数); // 节拍仍在走
    await expect(私聊键).toBeDisabled();
    await expect(page.getByText('invalid_actor_identity')).toHaveCount(0);
    await expect(page.getByText('真人会话已建立')).toHaveCount(0);

    // 会话坐标在发布前绝不被请求（P5 阶段零会话内容路由）。Task 1 起离线边界为
    // fixture 模式提供 /api/v1/events/live 空闲本地连接（旧世界它必然连接失败），
    // 事件源 onOpen 会无条件重拉当前角色收件箱清单（use真人会话事件 的既有产品
    // 行为），该清单 GET 不在本断言范围；这里守的是 会话详情/消息/移交 路由在
    // 发布前为零 —— P5 屏绝不提前读会话内容，发布后的进入是用户主动导航。
    const 发布前会话请求 = 请求序.filter((项) => /\/conversations\/|\/chat\//i.test(项)).length;

    // ── 服务端发布：completed + complete + conversation_ref ──
    const 己 = fixture.cases[P5编号.己]!;
    己.step = 'complete';
    己.conversationRef = P7会话编号.会话;

    // 下一拍权威重读见到发布：文案切换、按钮启用
    await expect(page.getByText('真人会话已建立').first()).toBeVisible({ timeout: 10_000 });
    await expect(私聊键).toBeEnabled({ timeout: 5_000 });
    await 私聊键.click();
    await expect(page).toHaveURL(new RegExp(`#/chat/human/${P7会话编号.会话}$`), { timeout: 10_000 });
    // 发布前 P5 屏从未请求过会话路由（发布后的进入是用户主动导航）
    expect(发布前会话请求).toBe(0);
  });

  test('ended/completed 单一历史集合原序渲染，终局详情只读 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5候选(page, { 请求拦截: ({ path, method, query }) => 请求序.push(`${method} ${path}${query ?? ''}`) });

    await hash直达(page, '/#/archived');
    // J-PILOT-01：已结束 Case 与已归档初评失败由同一个连续分页承接（一次 shelf=history 读取，
    // 单页读尽无加载更多；needs_action=false 不据以隐藏卡）
    await expect(page.getByText(P5标记.己职位名)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P5标记.戊职位名)).toBeVisible({ timeout: 10_000 });
    expect(请求序).toContain('GET /api/v1/me/negotiations?shelf=history&limit=50');
    await expect(page.getByRole('button', { name: '加载更多' })).toHaveCount(0);

    // ended 详情（J-PILOT-01 Spec §7）：终局摘要原样（wire outcome/reason 不翻译）；
    // S0 终局底栏保留原控件但真禁用，占位按顶格 outcome 投影
    await page.getByText(P5标记.戊职位名).click();
    await expect(page.getByText('终局', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('user_ended').first()).toBeVisible();
    await expect(page.getByPlaceholder('本次代谈已结束')).toBeDisabled();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '提交回答' })).toHaveCount(0);
    await expect(page.getByPlaceholder('有想法就告诉你的AI代理')).toHaveCount(0);

    // completed 详情同样只读（移交文案 + 恒禁用的开始私聊 + 只读底栏零发送）
    await hash直达(page, '/#/archived');
    await page.getByText(P5标记.己职位名).click();
    await expect(page.getByText('双方已确认，正在创建会话').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '开始私聊' })).toBeDisabled();
    await expect(page.getByText('当前在谈已结束，仅可查看')).toBeVisible();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toHaveCount(0);

    // 整条旅程零变异
    expect(fixture.变更请求).toEqual([]);
    expect(请求序.filter((项) => 项.startsWith('POST'))).toEqual([]);
  });

  test('登出与角色切换清空可见 P5 状态 @backend', async ({ page }) => {
    test.setTimeout(150_000);
    const 请求序: string[] = [];
    await 装P5双角色(page, {
      主体初始角色: 'candidate',
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    // 候选端在谈可见
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await expect(page.getByText(P5标记.丁职位名)).toBeVisible({ timeout: 15_000 });

    // 切招聘端：候选端在谈内容一个字不留（P5 状态随会话转移摊平）。
    // 招聘端在谈卡 2026-09-09 起不渲染冻结职位事实，就绪锚点用中性摘要行 + 甲的待办徽标
    await hash直达(page, '/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    // 招聘端卡面锚点是摘要现职标记（卡片统一后 Case 职位名不在卡面）
    await expect(page.getByText(P5标记.现职.甲)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(P5标记.现职.丁)).toHaveCount(0);
    await expect(page.getByText(P5标记.现职.乙)).toHaveCount(0);

    // 切回候选端：新会话代际重新水合，自己的在谈重新可见
    await hash直达(page, '/#/identity?switch=1&from=hr');
    await page.getByRole('button', { name: '翻到「求职者」那一面' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await expect(page.getByText(P5标记.丁职位名)).toBeVisible({ timeout: 20_000 });

    // 登出：可见 P5 状态清空，深链不再读出任何 Case 数据、零 P5 读取
    await page.evaluate(() => {
      window.location.hash = '#/settings';
    });
    await expect(page.getByRole('button', { name: '退出登录' }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '退出登录' }).first().click();
    await page.getByRole('button', { name: '确认退出当前账号' }).click();
    await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(P5标记.丁职位名)).toHaveCount(0);
    const P5请求数 = () => 请求序.filter((项) => 项.includes('/match-cases') || 项.includes('/negotiations')).length;
    const 登出后 = P5请求数();
    await page.evaluate((编号) => {
      window.location.hash = `#/deal/${编号}`;
    }, P5编号.乙);
    await page.waitForTimeout(1_000);
    await expect(page.getByText(P5标记.乙职位名)).toHaveCount(0);
    expect(P5请求数()).toBe(登出后);
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// P5 Mock 数据源隔离 @mock：记录每个含 /match-cases 的浏览器请求，Mock 旅程下
// 这份清单必须为空（空列表），整段会话也没有任何 /api/v1 请求。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('P5 Mock 数据源隔离 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('Mock 在谈/归档/详情全流程零 match-cases 请求（空清单） @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const matchCase请求: string[] = [];
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!new URL(url).pathname.startsWith('/api/v1')) return;
      apiRequests.push(url);
      if (url.includes('/match-cases')) matchCase请求.push(url);
    });

    // ── 候选端：在谈首页（Mock 在谈单）/ 归档 / 在谈详情 ──
    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);
    await hash直达(page, '/#/app');
    await expect(page.getByText('资深后端工程师 · 交易网关')).toBeVisible({ timeout: 10_000 });
    await hash直达(page, '/#/archived');
    await expect(page.getByText('历史代谈').first()).toBeVisible({ timeout: 10_000 });
    await hash直达(page, '/#/deal/J-01');
    await expect(page.getByText('资深后端工程师 · 交易网关').first()).toBeVisible({ timeout: 10_000 });

    // ── 招聘端：在谈候选 / 归档 / 候选详情 ──
    await hash直达(page, '/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
    await hash直达(page, '/#/hr');
    // 去名改版（2026-09-08）：在谈卡全匿名，列表就绪以头行性别图标为准；真名只在候选详情页
    await expect(page.getByRole('img', { name: '男' }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('沈亦舟')).toHaveCount(0);
    await hash直达(page, '/#/hr/archived');
    await expect(page.getByText('历史代谈').first()).toBeVisible({ timeout: 10_000 });
    await hash直达(page, '/#/hr/candidate/A-01');
    // 去名改版后详情顶栏 = 候选头行画像行（性别/年限/学历/求职状态）+ 画像副标题，
    // 代号/真名都不上屏；就绪锚点 = 画像性别图标 + 副标题 + 当前段卡点决策卡
    await expect(page.getByRole('img', { name: '男' }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Go / 高并发交易 · 字节跳动').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('卡点决策', { exact: true })).toBeVisible();
    await expect(page.getByText('沈亦舟')).toHaveCount(0); // 真名不在去名详情的可见面

    // P5 域在 Mock 下零请求：match-cases 请求清单为空（空列表），整段会话无任何 /api/v1
    expect(matchCase请求).toEqual([]);
    expect(apiRequests).toEqual([]);
  });
});
