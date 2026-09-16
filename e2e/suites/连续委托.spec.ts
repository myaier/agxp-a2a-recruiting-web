// e2e/suites/连续委托.spec.ts
// C6：原「J-PILOT-01 连续委托接线 @backend」等价迁入。
// 本 Suite 家族另含 e2e/J-PILOT-02接线.spec.ts（文件保留在 e2e/ 根）。

import { expect, test } from '../fixtures/test';
import { 信封 } from '../fixtures/bff/协议';
import { 装P4候选, 装P5双角色, hash直达 } from '../fixtures/数据源交互';
import { P4编号, P4标记, P4发现fixture, type P4发现fixture形 } from '../fixtures/bff/发现推荐';
import { P2新附件, 创建P2附件fixture, type P2附件fixture形 } from '../fixtures/bff/附件';
import { P5编号, P5标记, P5连续编号, 创建P5MatchCasefixture, type P5MatchCasefixture形 } from '../fixtures/bff/MatchCase';

// ─────────────────────────────────────────────────────────────────────────────
// J-PILOT-01 连续委托接线 @backend（Task 7）：既有本地浏览器 fixture 的跨页面消费与
// 局部布局验证。场景一/二复用 装P4候选（P4 发现域 + P2 附件库 + 本 P5 fixture 的
// negotiation 回答臂）；场景三复用 装P5双角色 与 Plan 已记录的改前几何数值（常量）。
// 相位转换由用例对 fixture 字段的最小显式推进表达，不建编排器。全部
// https://app.invalid/api/v1/** 请求由本地 route 拦截（未声明坐标固定 404
// negotiation_not_found），未触达真实后端；这是本地非 L3 证据，不是真实跨端旅程
// 验收（Spec §11：用户明确延后 L3）。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('J-PILOT-01 连续委托接线 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  /** 场景公共前置：P4 候选推荐卡 + 1 份 PDF 附件库 + P5 fixture（连续臂在场）。
   *  既有 Case 的连续记录全部删去：本次委托的 dlg 记录是这条旅程的唯一连续身份
   *  （同一 canonical 记录开案不重建第二条 —— 「无第二张卡」断言的前提；
   *  active 恰一条也让翻页不参与本旅程断言）。 */
  function 建连续委托场景(): { p4: P4发现fixture形; p2: P2附件fixture形; p5: P5MatchCasefixture形 } {
    const p4 = P4发现fixture();
    const p2 = 创建P2附件fixture();
    p2.items = [P2新附件(1, 'P4 Fixture 候选简历.pdf', Buffer.from('%PDF-1.7\nfixture\n'))];
    const p5 = 创建P5MatchCasefixture();
    for (const 键 of [P5连续编号.甲, P5连续编号.乙, P5连续编号.丙一, P5连续编号.丙二, P5连续编号.丁]) {
      delete p5.连续记录[键];
    }
    return { p4, p2, p5 };
  }

  const 委托POST们 = (p4: P4发现fixture形) =>
    p4.变更请求.filter((项) => 项.path === '/api/v1/me/job-delegations' && 项.method === 'POST');

  test('场景一：UI 选择 PDF/确认→POST accepted→查看进展→在谈同卡→公开初评→S0→S1 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const { p4, p2, p5 } = 建连续委托场景();
    await 装P4候选(page, {
      fixture: p4, 附件fixture: p2, P5fixture: p5,
      // 岗位详情按 hiring_organization_ref 补读公开企业（org-fixture-p4 只有 P4 侧声明，
      // 无组织域 fixture）：按坐标显式声明空应答 → strict decode 拒绝 → 企业块出错误/占位态
      //（与 账号与支持「P8 举报屏蔽暂不可用」同款修法，只修测试定义，不改产品）。
      覆盖: {
        'GET /api/v1/organizations/org-fixture-p4': () => ({ status: 200, 响应: 信封(null) }),
      },
      请求拦截: (项) => 请求序.push(`${项.method} ${项.path}${项.query ?? ''}`),
    });

    // ── 岗位卡 → 确认层 → 原对 PDF + 字面披露 true（同键两次：传输层受控重试）──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '让AI代理去谈' }).click();
    await expect(page.getByRole('dialog', { name: '确认委托AI代理？' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: '确认委托', exact: true }).click();
    await expect.poll(() => 委托POST们(p4).length, { timeout: 15_000 }).toBe(1);
    const 委托POST = 委托POST们(p4);
    expect(委托POST[0]!.body).toEqual({
      intention_id: P4编号.intention,
      selection: { items: [P4编号.job] },
      disclosure_acknowledged: true,
      resume_file_id: 'rf_1',
      resume_file_version_id: 'rfv_1_1',
    });
    expect(委托POST[0]!.idempotencyKey).not.toBe('');

    // ── 受理后不自动跳页（仍在岗位/市场视图，卡面「AI代理已接手」）；进岗位页，
    //    原主按钮变可点的「查看进展」──
    await expect(page).toHaveURL(/#\/app$/);
    await expect(page.getByText('AI代理已接手')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '查看职位详情' }).first().click();
    await expect(page).toHaveURL(new RegExp(`#/job/${P4编号.job}$`), { timeout: 15_000 });
    const 查看进展 = page.getByRole('button', { name: '查看进展' });
    await expect(查看进展).toBeVisible({ timeout: 15_000 });

    // ── 查看进展 → 同一条 dlg 记录的聚合详情（尚未初评：等待开始 + 禁用输入）──
    await 查看进展.click();
    await expect(page).toHaveURL(new RegExp(`#/deal/${P4编号.candidateDelegation}$`), { timeout: 15_000 });
    await expect(page.getByText('已接手，等待开始')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder('AI 代理正在进行公开信息初评')).toBeDisabled();
    await expect(page.getByText('公开信息初评')).toHaveCount(0); // 尚无公开评托盘

    const 记录 = p5.连续记录[P4编号.candidateDelegation]!;
    const 乙 = p5.cases[P5编号.乙]!;
    /** S0 小结样本：initial 托盘与公开初评托盘同屏，来源标签区分（初评 vs 公开信息初评）。 */
    const 乙小结托盘 = () => {
      乙.阶段区们[0]!.screening_records = {
        messages: [],
        summaries: [{
          id: 'sum_p5_s0_1', phase: 'initial' as const,
          summary: 'P5 Fixture S0 条件确认小结', occurred_at: '2026-08-29T01:30:00Z',
        }],
      };
    };

    // ── 公开初评（fixture 最小推进）：3 秒节拍内托盘上屏，来源标签明确 ──
    记录.phase = 'evaluating';
    记录.evaluationId = 'evp_p5_fixture0000000000000000000002';
    记录.公开评 = { decision: 'fit', summary: 'P5 Fixture 公开初评·基础信息匹配' };
    记录.updatedAt = '2026-08-29T04:10:00Z';
    await expect(page.getByText('公开信息初评').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('P5 Fixture 公开初评·基础信息匹配')).toBeVisible();
    await expect(page.getByText('正在进行公开信息初评')).toBeVisible();

    // ── 开案（同一条记录指到 Case，无第二张卡）：S0 消费 case_detail ──
    //    （fixture 里开案的 Case 冻结职位 = 本次受托岗位：职位名随 Case 同步）
    乙.职位名 = P4标记.jobTitle;
    乙小结托盘();
    记录.phase = 'case_started';
    记录.caseId = P5编号.乙;
    记录.updatedAt = '2026-08-29T04:20:00Z';
    await expect(page.getByText('匿名初筛', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P5标记.问题).first()).toBeVisible();
    // 来源区分：公开信息初评与 S0 初评小结各自独立托盘（S0 总结行 = 标签：正文 成对呈现）
    await expect(page.getByText('公开信息初评').first()).toBeVisible();
    await expect(page.getByText('P5 Fixture 公开初评·基础信息匹配')).toBeVisible();
    await expect(page.getByText(`初评：${P5标记.S0小结}`)).toBeVisible();
    await expect(page.getByPlaceholder('双方 AI 代理正在确认条件')).toBeDisabled();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();

    // ── S1：Case 推进到递交简历（原绑定对 typed 附件直接呈现）──
    乙.stage = 'resume_submission';
    乙.status = 'needs_user';
    乙.step = 'awaiting_recruiter_decision';
    乙.updatedAt = '2026-08-29T04:30:00Z';
    乙.候选 = { needsAction: false, actions: [] };
    乙.招聘 = { needsAction: true, actions: ['decide_resume_screening'] };
    乙.已绑定 = true;
    乙.解析 = 'succeeded';
    await expect(page.getByText('递交简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: new RegExp(P5标记.简历名) })).toBeVisible();

    // ── 在谈同卡：active 恰一张卡（本委托的 dlg 记录），点击回同一记录 ──
    await hash直达(page, '/#/app');
    await page.getByRole('button', { name: '在谈', exact: true }).click(); // 回在谈子视图（进入时在市场）
    const 卡 = page.getByTestId('求职在谈卡');
    await expect(卡).toHaveCount(1, { timeout: 15_000 });
    await expect(卡.getByText(P4标记.jobTitle)).toBeVisible();
    await 卡.click();
    await expect(page).toHaveURL(new RegExp(`#/deal/${P4编号.candidateDelegation}$`), { timeout: 15_000 });
    await expect(page.getByText('递交简历', { exact: true })).toBeVisible({ timeout: 15_000 });

    // ── 全程零第二个候选 Case GET（候选读取唯一来源 = me/negotiations 聚合）──
    expect(请求序.filter((项) => 项.includes('/api/v1/me/match-cases'))).toEqual([]);
    expect(请求序.filter((项) => 项.startsWith('GET /api/v1/me/negotiations?')).length).toBeGreaterThanOrEqual(1);
    expect(请求序.filter((项) => 项.startsWith('GET /api/v1/me/negotiations/')).length).toBeGreaterThanOrEqual(1);
  });

  test('场景二：写响应丢失→同标签页 reload→原命令核对→失败→retry 原代际→归档回读 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const { p4, p2, p5 } = 建连续委托场景();
    // 写响应丢失：每把键恒 503 operation_outcome_unknown（受理已落登记，响应不送达）
    p4.分支 = { 候选委托未知: true };
    await 装P4候选(page, {
      fixture: p4, 附件fixture: p2, P5fixture: p5,
      // 岗位详情按 hiring_organization_ref 补读公开企业（org-fixture-p4 只有 P4 侧声明，
      // 无组织域 fixture）：按坐标显式声明空应答 → strict decode 拒绝 → 企业块出错误/占位态
      //（与 账号与支持「P8 举报屏蔽暂不可用」同款修法，只修测试定义，不改产品）。
      覆盖: {
        'GET /api/v1/organizations/org-fixture-p4': () => ({ status: 200, 响应: 信封(null) }),
      },
      请求拦截: (项) => 请求序.push(`${项.method} ${项.path}${项.query ?? ''}`),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '让AI代理去谈' }).click();
    await page.getByRole('button', { name: '确认委托', exact: true }).click();
    // 两把 503（新键 + 同键受控重试）：结果未知 → 未决命令保留、无可靠 ID；
    // 岗位页主键 = 「核对提交结果」（不重新选 PDF）
    await expect.poll(() => 委托POST们(p4).length, { timeout: 15_000 }).toBe(2);
    await page.getByRole('button', { name: '查看职位详情' }).first().click();
    await expect(page).toHaveURL(new RegExp(`#/job/${P4编号.job}$`), { timeout: 15_000 });
    await expect(page.getByRole('button', { name: '核对提交结果' })).toBeVisible({ timeout: 15_000 });

    // ── 同标签页 reload：原命令（key + body）从 sessionStorage 恢复，仍是待核对 ──
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`#/job/${P4编号.job}$`), { timeout: 20_000 });
    await expect(page.getByRole('button', { name: '核对提交结果' })).toBeVisible({ timeout: 15_000 });

    // ── 核对：放行后原 key + 原 body 恰一次重放 → 回执收口 → 查看进展 ──
    p4.分支 = {};
    await page.getByRole('button', { name: '核对提交结果' }).click();
    await expect.poll(() => 委托POST们(p4).length, { timeout: 15_000 }).toBe(3);
    const 委托POST = 委托POST们(p4);
    expect(委托POST[2]!.idempotencyKey).toBe(委托POST[0]!.idempotencyKey);
    expect(委托POST[2]!.body).toEqual(委托POST[0]!.body);
    const 查看进展 = page.getByRole('button', { name: '查看进展' });
    await expect(查看进展).toBeVisible({ timeout: 15_000 });

    // ── 初评失败（fixture 最小推进）：重试初评/归档动作槽就位 ──
    const 记录 = p5.连续记录[P4编号.candidateDelegation]!;
    const 置失败初评 = () => {
      记录.phase = 'evaluation_failed';
      记录.failure = { code: 'delegation_agent_unavailable', retryable: true };
      记录.needsAction = true;
      记录.actions = { retry: true, archive: true, open_case: false };
    };
    置失败初评();
    await 查看进展.click();
    await expect(page.getByText('本次评估未完成', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '重试初评' })).toBeVisible();
    await expect(page.getByRole('button', { name: '归档', exact: true })).toBeVisible();

    // ── retry：body 严格 {expected_retry_generation:0} + Idempotency-Key；202 受理后
    //    权威回读回到 evaluating（重试/归档动作退场）──
    await page.getByRole('button', { name: '重试初评' }).click();
    const 重试POST路径 = `/api/v1/me/negotiations/${P4编号.candidateDelegation}/retry`;
    await expect.poll(() => p5.变更请求.filter((项) => 项.path === 重试POST路径).length, { timeout: 15_000 }).toBe(1);
    const 重试POST = p5.变更请求.filter((项) => 项.path === 重试POST路径);
    expect(重试POST[0]!.body).toEqual({ expected_retry_generation: 0 });
    expect(重试POST[0]!.idempotencyKey).not.toBe('');
    await expect(page.getByText('正在进行公开信息初评')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '重试初评' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '归档', exact: true })).toHaveCount(0);

    // ── 再次失败（代际已被 retry 消费为 1）→ 归档：body 严格 {} 且无 Idempotency-Key，
    //    权威 shelf 回读：active 无卡、历史有卡，绝不复活第二条记录 ──
    置失败初评();
    await expect(page.getByText('本次评估未完成', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '归档', exact: true }).click();
    await expect(page.getByText('移入历史，不是取消')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: '归档', exact: true }).click();
    const 归档POST路径 = `/api/v1/me/negotiations/${P4编号.candidateDelegation}/archive`;
    await expect.poll(() => p5.变更请求.filter((项) => 项.path === 归档POST路径).length, { timeout: 15_000 }).toBe(1);
    const 归档POST = p5.变更请求.filter((项) => 项.path === 归档POST路径);
    expect(归档POST[0]!.body).toEqual({});
    expect(归档POST[0]!.idempotencyKey).toBeNull();

    // 权威回读（动作后的已载刷新/重读）：在谈空、历史有卡
    await hash直达(page, '/#/app');
    await expect(page.getByTestId('求职在谈卡')).toHaveCount(0, { timeout: 15_000 });
    await hash直达(page, '/#/archived');
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('本次评估未完成', { exact: true })).toBeVisible();

    // retry/archive 竞争不造重复记录：全程零 Case GET；连续详情读取至少发生一次
    // （单飞/栅栏下同一坐标可多次回读，重复不判漂移 —— 在谈/历史恰一张卡已单独断言）
    expect(请求序.filter((项) => 项.includes('/api/v1/me/match-cases'))).toEqual([]);
    const 连续坐标 = p5.连续读取.filter((项) => 项.startsWith('GET /api/v1/me/negotiations/'));
    expect(连续坐标.length).toBeGreaterThanOrEqual(1);
  });

  test('场景三：双端 S0 禁用输入与布局保持（390/320 对照改前基准） @backend', async ({ page }) => {
    await 装P5双角色(page, { 主体初始角色: 'candidate' });

    /** 与改前基准同口径的几何探针（getBoundingClientRect 视口相对；滚动区内元素
     *  由断言用 rect.y + scrollTop 还原成内容坐标比较）。 */
    const 量底栏几何 = () => page.evaluate(() => {
      const 矩形 = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, disabled: (el as HTMLInputElement).disabled };
      };
      const 区们 = [...document.querySelectorAll('[class*="输入条区"]')];
      const 区 = 区们[0];
      const 输入 = 区?.querySelector('textarea');
      const 发送 = 区?.querySelector('button');
      const tab = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '代谈进度');
      const 阶段 = [...document.querySelectorAll('*')].find(
        (el) => el.children.length === 0 && el.textContent?.trim() === '匿名初筛');
      const 滚动 = document.querySelector('[class*="滚动区"]');
      return {
        输入控件: { ...矩形(输入!), placeholder: (输入 as HTMLTextAreaElement).placeholder },
        发送键: 矩形(发送!),
        容器: 矩形(区!),
        容器命中数: 区们.length,
        Tab行_代谈进度: 矩形(tab!),
        四阶段首标题_匿名初筛: 矩形(阶段!),
        scrollTop: 滚动 ? (滚动 as HTMLElement).scrollTop : null,
        根溢出: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    // ── 候选端 S0（#/deal/乙，与改前基准同 fixture 相位、同视口）──
    await page.setViewportSize({ width: 390, height: 664 });
    await hash直达(page, `/#/deal/${P5编号.乙}`);
    await expect(page.getByText(P5标记.乙职位名).first()).toBeVisible({ timeout: 20_000 });
    const S0输入 = page.getByPlaceholder('双方 AI 代理正在确认条件');
    await expect(S0输入).toBeVisible();
    await expect(S0输入).toBeDisabled();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
    await expect(page.getByText('旧版状态待核实，请交负责人处理').first()).toBeVisible();
    const 候选390 = await 量底栏几何();
    expect(候选390.容器命中数).toBe(1);
    expect(候选390.输入控件.x, '候选390 输入 x').toBe(35);
    expect(候选390.输入控件.y, '候选390 输入 y').toBe(610);
    expect(候选390.输入控件.width, '候选390 输入宽').toBe(283);
    expect(候选390.输入控件.height, '候选390 输入高').toBe(38);
    expect(候选390.发送键.x, '候选390 发送 x').toBe(328);
    expect(候选390.发送键.y, '候选390 发送 y').toBe(612);
    expect(候选390.发送键.width, '候选390 发送宽').toBe(36);
    expect(候选390.发送键.height, '候选390 发送高').toBe(36);
    expect(候选390.容器.x, '候选390 容器 x').toBe(0);
    expect(候选390.容器.y, '候选390 容器 y').toBe(594);
    expect(候选390.容器.width, '候选390 容器宽').toBe(390);
    expect(候选390.容器.height, '候选390 容器高').toBe(70);
    expect(候选390.Tab行_代谈进度.y, '候选390 Tab y').toBe(60);
    expect(候选390.Tab行_代谈进度.height, '候选390 Tab 高').toBe(21);
    expect(
      候选390.四阶段首标题_匿名初筛.y + (候选390.滚动区?.scrollTop ?? 0),
      '候选390 匿名初筛内容坐标（Plan 改前基准·候选端：视口 y=95 + 捕获时 scrollTop 47'
        + ' = 内容坐标 142；Task 6 新增「旧版状态待核实」行 26px → 168，Δ 见 Plan 验证表）',
    ).toBe(168);
    expect(候选390.根溢出, '候选390 根横向溢出 0').toBe(0);
    await page.screenshot({ path: 'test-results/J-PILOT-01/s3-候选-S0-390.png', fullPage: true });

    await page.setViewportSize({ width: 320, height: 568 });
    await expect(S0输入).toBeVisible();
    const 候选320 = await 量底栏几何();
    expect(候选320.输入控件.x).toBe(35);
    expect(候选320.输入控件.y).toBe(514);
    expect(候选320.输入控件.width).toBe(213);
    expect(候选320.输入控件.height).toBe(38);
    expect(候选320.发送键.x).toBe(258);
    expect(候选320.发送键.y).toBe(516);
    expect(候选320.发送键.width).toBe(36);
    expect(候选320.发送键.height).toBe(36);
    expect(候选320.容器.y).toBe(498);
    expect(候选320.容器.height).toBe(70);
    expect(候选320.Tab行_代谈进度.y).toBe(60);
    expect(候选320.四阶段首标题_匿名初筛.y + (候选320.滚动区?.scrollTop ?? 0), '候选320 内容坐标：基准 y=95+scrollTop 58=153，+26 同上').toBe(179);
    expect(候选320.根溢出).toBe(0);
    await page.screenshot({ path: 'test-results/J-PILOT-01/s3-候选-S0-320.png', fullPage: true });

    // ── 切招聘端：同 Case 的 S0 底栏同位禁用；招聘屏无候选私有总结/初评 ──
    await page.setViewportSize({ width: 390, height: 664 });
    await hash直达(page, '/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    await hash直达(page, `/#/hr/candidate/${P5编号.乙}`);
    await expect(page.getByText(P5标记.乙职位名).first()).toBeVisible({ timeout: 20_000 });
    const 招聘S0输入 = page.getByPlaceholder('双方 AI 代理正在确认条件');
    await expect(招聘S0输入).toBeVisible();
    await expect(招聘S0输入).toBeDisabled();
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
    // 招聘屏无候选私有初评/总结：公开初评托盘与候选私有词一个不出现
    await expect(page.getByText('公开信息初评')).toHaveCount(0);
    await expect(page.getByText('本次评估未完成')).toHaveCount(0);
    const 招聘390 = await 量底栏几何();
    expect(招聘390.输入控件.x).toBe(35);
    expect(招聘390.输入控件.y).toBe(610);
    expect(招聘390.输入控件.width).toBe(283);
    expect(招聘390.输入控件.height).toBe(38);
    expect(招聘390.发送键.x).toBe(328);
    expect(招聘390.发送键.y).toBe(612);
    expect(招聘390.发送键.width).toBe(36);
    expect(招聘390.发送键.height).toBe(36);
    expect(招聘390.容器.y).toBe(594);
    expect(招聘390.容器.height).toBe(70);
    expect(招聘390.Tab行_代谈进度.y).toBe(70);
    expect(招聘390.四阶段首标题_匿名初筛.y + (招聘390.滚动区?.scrollTop ?? 0)).toBe(178);
    expect(招聘390.根溢出).toBe(0);
    await page.screenshot({ path: 'test-results/J-PILOT-01/s3-招聘-S0-390.png', fullPage: true });

    await page.setViewportSize({ width: 320, height: 568 });
    await expect(招聘S0输入).toBeVisible();
    const 招聘320 = await 量底栏几何();
    expect(招聘320.输入控件.x).toBe(35);
    expect(招聘320.输入控件.y).toBe(514);
    expect(招聘320.输入控件.width).toBe(213);
    expect(招聘320.输入控件.height).toBe(38);
    expect(招聘320.发送键.x).toBe(258);
    expect(招聘320.发送键.y).toBe(516);
    expect(招聘320.发送键.width).toBe(36);
    expect(招聘320.发送键.height).toBe(36);
    expect(招聘320.容器.y).toBe(498);
    expect(招聘320.容器.height).toBe(70);
    expect(招聘320.Tab行_代谈进度.y).toBe(70);
    expect(招聘320.四阶段首标题_匿名初筛.y + (招聘320.滚动区?.scrollTop ?? 0)).toBe(189);
    expect(招聘320.根溢出).toBe(0);
    await page.screenshot({ path: 'test-results/J-PILOT-01/s3-招聘-S0-320.png', fullPage: true });
  });
});
