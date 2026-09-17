// e2e/suites/展示与交互.spec.ts
// C6：原「在谈详情完整布局 / 卡片统一 Mock 三屏 / 卡片统一 Backend / picker 统一 ×7 组 /
// catalog-fullscreen ×9 组」等价迁入（表未单列的 picker/catalog-fullscreen 专题统一归本文件）。
// 本 Suite 家族另含 P1展示统一 / 展示字段接线 / 抽屉稳定性 / 换壳无闪屏 / 问AI代理展示
// 五个保留文件（e2e/ 根）。

import { expect, test } from '../fixtures/test';
import { 装三级职位目录桩, 抽屉搜企业并选中, 装P4招聘, 左滑候选卡, 装P5候选, 装P5招聘, 装P5双角色, 断言纵序, 断言核心页无横向溢出, 走向导薪资, Mock源, Mock登录求职, Mock切到招聘推荐, pickerMock登录, pickerBackend存量候选, hash直达 } from '../fixtures/数据源交互';
import { 信封 } from '../fixtures/bff/协议';
import { 标记, fixture简历, fixture意向列表 } from '../fixtures/bff/账号与目录';
import { P4编号, P4标记, P4摘要, P4深克隆, P4招聘卡, P4发现fixture } from '../fixtures/bff/发现推荐';
import { P1C标记, 创建招聘方OnboardingFixture, P1C招聘组织Fixture, P1C管理员关系, P1C组织甲, 带企业关系 } from '../fixtures/bff/招聘组织';
import { P3标记, P3隐私fixture, P3默认组织库, P1C搜索池 } from '../fixtures/bff/隐私与实名';
import { P5Case, P5编号, P5标记, P5连续编号, P5摘要样本, 创建P5MatchCasefixture, type P5MatchCasefixture形 } from '../fixtures/bff/MatchCase';
import { 创建候选OnboardingFixture } from '../fixtures/bff/候选建档';
import { 安装BFF路由 } from '../fixtures/bff/安装BFF路由';
import { type Locator, type Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// 在谈详情完整布局 @mock/@backend —— 详情统一（2026-09-10 Spec §8.5）定向旅程：
// 双端 × 两种来源 × 390/320px × 两个 Tab：约定区块齐全、说明可读、无横向溢出与
// 交互遮挡。Mock 端走真实种子（J-01 顺利态 / A-01 卡点态）；Backend 端复用上面
// P5 生命周期 的装P5候选/装P5招聘 作用域与 HTTP fixture，只改 Case 记录里的合法
// 字段值（长正文/状态、可空字段有值→空），不发明 P5 不支持的 wire 键。两种来源
// 的等价 DOM/CSS 由无 Provider 组件测试（详情外壳/详情状态区/职位资料/在线简历正文
// 等）钉住；这里钉的是浏览器可达渲染路径上的区块顺序与完整缺失布局。
// 截图统一落 test-results/详情布局/（Playwright 每次运行会重建该目录，最终权威
// 运行的截图随目录留存；路径记录进 Task 10 报告）。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('在谈详情完整布局', () => {
  /** 水平溢出门（Spec §8.5）：允许 ≤2px 亚像素舍入，不允许布局性横向溢出。 */
  async function 断言无横向溢出(page: Page) {
    const 溢出 = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(溢出).toBeLessThanOrEqual(2);
  }

  // ── Mock 端（mock/stg 4181）：共用详情壳 + Mock 连接层投影 ──────────────────
  test.describe('Mock 双端 @mock', () => {
    test.use({ baseURL: 'http://127.0.0.1:4181' });

    test('求职端 390/320：顶栏、双 Tab、四阶段、动作卡与资料全区块，无横向溢出 @mock', async ({ page }) => {
      // Mock 登录与既有 @mock 旅程同口径：协议 → 微信登录 → 我要找工作
      await page.goto('/');
      await page.getByText(/已阅读并同意/).click();
      await page.getByRole('button', { name: '微信登录' }).click();
      await expect(page).toHaveURL(/#\/identity$/);
      await page.getByRole('button', { name: '我要找工作' }).click();
      await expect(page).toHaveURL(/#\/student$/);

      // J-01 顺利态（意向确认，需要你点头）：顶栏职位名 + 两个 Tab
      await hash直达(page, '/#/deal/J-01');
      await expect(page.getByText('资深后端工程师 · 交易网关').first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: '代谈进度', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '职位详情', exact: true })).toBeVisible();

      // 进度 Tab：四阶段分节自上而下 + 意向确认动作卡（共用详情动作卡）
      await 断言纵序(page, ['匿名初筛', '递交简历', '需要协调', '意向确认']);
      await expect(page.getByText('确认意向', { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: '开始私聊 ›' })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/mock-求职-进度-390.png', fullPage: true });

      // 资料 Tab：匹配分析 → 职位详情 → 职位要求 → 公司信息 → 对接人（spec §3.3 顺序）
      await page.getByRole('button', { name: '职位详情', exact: true }).click();
      await 断言纵序(page, ['匹配度分析', page.getByText('职位详情', { exact: true }).last(), '职位要求', '公司信息', '对接人']);
      await expect(page.getByText('抖音').first()).toBeVisible(); // 公司档案真实值，非占位
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/mock-求职-资料-390.png', fullPage: true });

      // 320px：两个 Tab 的约定区块仍在、无横向溢出（长公司介绍/标签不把页面撑宽）
      await page.setViewportSize({ width: 320, height: 568 });
      await expect(page.getByText('对接人', { exact: true })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/mock-求职-资料-320.png', fullPage: true });
      await page.getByRole('button', { name: '代谈进度', exact: true }).click();
      await expect(page.getByRole('button', { name: '开始私聊 ›' })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/mock-求职-进度-320.png', fullPage: true });
    });

    test('招聘端 390/320：画像顶栏、四阶段、卡点决策与在线简历九区，无横向溢出 @mock', async ({ page }) => {
      await page.goto('/');
      await page.getByText(/已阅读并同意/).click();
      await page.getByRole('button', { name: '微信登录' }).click();
      await expect(page).toHaveURL(/#\/identity$/);
      await page.getByRole('button', { name: '我要找工作' }).click();
      await expect(page).toHaveURL(/#\/student$/);
      await hash直达(page, '/#/identity?switch=1&from=app');
      await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
      await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });

      // A-01 卡点态（需要协调，需要你拍板）
      await hash直达(page, '/#/hr/candidate/A-01');
      // 去名顶栏：性别图标 + 年限｜学历｜求职状态（画像行；段与竖分同 span，子串匹配），代号/真名不上顶栏
      await expect(page.getByRole('img', { name: '男' }).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('9 年', { exact: true })).toBeVisible();
      await expect(page.getByText('硕士')).toBeVisible();
      await expect(page.getByText('在职看机会')).toBeVisible();
      await expect(page.getByRole('button', { name: '代谈进度', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '在线简历', exact: true })).toBeVisible();

      // 进度 Tab：四阶段 + 卡点决策动作卡（接受 / 不接受）
      await 断言纵序(page, ['匿名初筛', '递交简历', '需要协调', '意向确认']);
      await expect(page.getByText('卡点决策', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '接受', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '不接受', exact: true })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/mock-招聘-进度-390.png', fullPage: true });

      // 资料 Tab：在线简历正文九个信息区（spec §3.4 顺序；头区画像行在最上）
      await page.getByRole('button', { name: '在线简历', exact: true }).click();
      await 断言纵序(page, ['匹配度分析', '个人优势', '求职期望', '工作经历', '项目经历', '教育经历', '专业技能']);
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/mock-招聘-资料-390.png', fullPage: true });

      await page.setViewportSize({ width: 320, height: 568 });
      await expect(page.getByText('专业技能', { exact: true })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/mock-招聘-资料-320.png', fullPage: true });
      await page.getByRole('button', { name: '代谈进度', exact: true }).click();
      await expect(page.getByRole('button', { name: '接受', exact: true })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/mock-招聘-进度-320.png', fullPage: true });
    });
  });

  // ── Backend 端（backend/stg 4182）：P5 HTTP fixture 的完整缺失布局样本 ─────
  test.describe('Backend HTTP fixture @backend', () => {
    test.use({ baseURL: 'http://127.0.0.1:4182' });

    test('求职端正常全缺：双 Tab、四阶段、补充事实卡与资料区缺失占位 @backend @s0-s3-display', async ({ page }) => {
      // 默认 fixture = 正常全缺样本：P5 detail 只有冻结职位四事实，其余展示字段全缺
      await 装P5候选(page);
      await hash直达(page, `/#/deal/${P5编号.乙}`);

      // 顶栏：冻结职位名 + 城市 · 薪资带；匹配分缺失显示「—」并带可访问说明
      await expect(page.getByText(P5标记.乙职位名).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(`${P5标记.城市} · ${P5标记.薪资带}`).first()).toBeVisible();
      await expect(page.getByTitle('匹配分缺失')).toBeVisible();
      await expect(page.getByRole('button', { name: '代谈进度', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '职位详情', exact: true })).toBeVisible();

      // 进度 Tab：四阶段（P5 阶段标题）；S0–S3 展示统一 Task 4：顶部状态条删除 ——
      // 状态胶囊在 S0 分节条上（v1 needs_action → 需要你），「旧版待核实」说明与轮次提示
      // 都落当前段；J-PILOT-01：S0 补事实卡退场，底栏保留原控件但真禁用（Spec §7）
      await expect(page.getByText('需要你', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('旧版状态待核实，请交负责人处理').first()).toBeVisible();
      await expect(page.getByText('轮次 1/3')).toBeVisible();
      await 断言纵序(page, ['匿名初筛', '递交简历', '差异协同', '意向确认']);
      await expect(page.getByText('补充事实', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: '提交回答' })).toHaveCount(0);
      await expect(page.getByPlaceholder('双方 AI 代理正在确认条件')).toBeDisabled();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-求职-进度-390.png', fullPage: true });

      // 资料 Tab：区块级缺口说明 + 全部约定区块原位缺失（spec §3.3/§4）
      await page.getByRole('button', { name: '职位详情', exact: true }).click();
      await expect(page.getByText('当前在谈详情数据未提供').first()).toBeVisible();
      await 断言纵序(page, [
        '匹配度分析',
        page.getByText('职位详情', { exact: true }).last(),
        '职位要求',
        // 顶栏标题含「公司信息缺失」（F3 公司槽缺失占位），substring 锚点会命中顶栏 —— 用精确锚点取区块标题
        page.getByText('公司信息', { exact: true }),
        '对接人',
      ]);
      await expect(page.getByText('匹配分析缺失')).toBeVisible();
      // 冻结摘要四事实如实展示（不因其他字段缺失而隐藏）
      await expect(page.getByText(P5标记.乙职位名).first()).toBeVisible();
      await expect(page.getByText(P5标记.技能).first()).toBeVisible();
      await expect(page.getByText('职位详情缺失')).toBeVisible();
      await expect(page.getByText('职位要求缺失')).toBeVisible();
      // 公司：五元行标签齐全、值全「—」，导航入口真实禁用并就地解释
      await expect(page.getByText('公司详情暂不可用')).toBeVisible();
      await expect(page.getByText('公司介绍缺失')).toBeVisible();
      for (const 标签 of ['融资阶段', '规模', '行业', '成立', '地址']) {
        await expect(page.getByText(标签, { exact: true })).toBeVisible();
      }
      await expect(page.getByText('公司标签缺失')).toBeVisible();
      await expect(page.getByRole('img', { name: '对接人头像缺失' })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-求职-资料-390.png', fullPage: true });

      // 320px：完整缺失时所有约定区块可见、说明可读、无横向溢出
      await page.setViewportSize({ width: 320, height: 568 });
      await expect(page.getByRole('img', { name: '对接人头像缺失' })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-求职-资料-320.png', fullPage: true });
      await page.getByRole('button', { name: '代谈进度', exact: true }).click();
      await expect(page.getByPlaceholder('双方 AI 代理正在确认条件')).toBeDisabled();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-求职-进度-320.png', fullPage: true });
    });

    test('招聘端画像全缺与长正文/合法空数组：区块仍全、长文本可读 @backend @s0-s3-display', async ({ page }) => {
      const fixture = 创建P5MatchCasefixture();
      // 长正文样本：只加长自由文本 wire 字段（时间线 text / 叮嘱回执 expression）。
      // 阶段区 summary 是 17 个 step 闭词（未知词按安全文案「阶段信息待更新」收口，不进
      // DOM），状态/步骤同为闭词 —— 不用闭词字段造长文（spec：仅测试服务端真实支持的事实）。
      // review-r1 F3 / r2-F1 裁决：role 为空的纯系统事件非空正文保留原文语义（上屏），
      // 结构化问答仍只以 screening records 正式投影 —— 长文本证据=系统注释+叮嘱回执气泡。
      const 长前缀 = `P5 长文本标记·${P5编号.甲.slice(-4)}`;
      const 长文 = `${长前缀}${'：这是一段很长的自由文本，用来验证长正文换行可读、不横向溢出、不截断丢内容。'.repeat(6)}`;
      const 回执长文 = `${长前缀}回执${'：这是一段很长的叮嘱回执，同样要完整上屏、换行可读、不横向溢出。'.repeat(6)}`;
      const 甲 = fixture.cases[P5编号.甲]!;
      甲.阶段区们[1]!.transcript = [
        {
          event_id: 'evt_p5_long', stage: 'resume_submission', kind: 'stage_note', role: '',
          text: 长文, occurred_at: '2026-08-29T02:05:30Z',
        },
      ];
      甲.阶段区们[1]!.instruction_receipts = [
        {
          instruction_id: 'aci_p5_long', owner: 'recruiter', stage: 'resume_submission',
          expression: 回执长文, occurred_at: '2026-08-29T02:05:40Z',
        },
      ];
      await 装P5招聘(page, { fixture });

      // 甲（S1 已披露）：画像全缺顶栏 + 岗位上下文 + typed 附件 + 长正文当前段
      await hash直达(page, `/#/hr/candidate/${P5编号.甲}`);
      await expect(page.getByText(`${P5标记.甲职位名} · ${P5标记.城市} · ${P5标记.薪资带}`).first())
        .toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('经验缺失')).toBeVisible();
      await expect(page.getByText('学历缺失')).toBeVisible();
      await expect(page.getByText('求职状态缺失')).toBeVisible();
      await expect(page.getByRole('img', { name: '性别未知' })).toBeVisible();
      await expect(page.getByTitle('匹配分缺失')).toBeVisible();
      await expect(page.getByText(P5标记.甲别名)).toHaveCount(0); // 去名：alias 不上详情
      await expect(page.getByText('出具简历初筛结论', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '通过初筛' })).toBeVisible();
      await 断言纵序(page, ['匿名初筛', '递交简历', '差异协同', '意向确认']);
      // 纯系统事件（role=''）非空正文按原文上屏；长叮嘱回执气泡完整上屏（换行可读，不横向溢出）
      await expect(page.getByText(长文)).toBeVisible();
      await expect(page.getByText(回执长文)).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-招聘-进度-390.png', fullPage: true });

      // 丙一（S1 waiting）：合法空数组样本 —— transcript/checklist 为空，段与摘要仍在，
      // 招聘端未披露无附件入口，也不生成模拟对话
      await hash直达(page, `/#/hr/candidate/${P5编号.丙一}`);
      await expect(page.getByText(P5标记.丙一职位名).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('递交简历', { exact: true })).toBeVisible();
      await expect(page.getByText('正在解析简历', { exact: true })).toBeVisible();
      await expect(page.locator('button').filter({ hasText: 'PDF' })).toHaveCount(0);

      // 资料 Tab（甲）：档 null 的完整缺失布局 —— 九个信息区逐区缺失 + 页尾披露说明
      await hash直达(page, `/#/hr/candidate/${P5编号.甲}`);
      await page.getByRole('button', { name: '在线简历', exact: true }).click();
      await expect(page.getByText('当前在谈详情数据未提供').first()).toBeVisible({ timeout: 20_000 });
      await 断言纵序(page, ['匹配度分析', '个人优势', '求职期望', '工作经历', '项目经历', '教育经历', '专业技能']);
      for (const 缺 of ['匿名画像缺失', '职位信息缺失', '匹配分析缺失', '个人优势缺失', '求职期望缺失', '工作经历缺失', '项目经历缺失', '教育经历缺失', '专业技能缺失']) {
        await expect(page.getByText(缺).first()).toBeVisible();
      }
      await expect(page.getByText('在线简历缺失 · 内容不可转发').first()).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-招聘-资料-390.png', fullPage: true });

      await page.setViewportSize({ width: 320, height: 568 });
      await expect(page.getByText('专业技能缺失').first()).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-招聘-资料-320.png', fullPage: true });

      // 320px 回切进度 Tab：长正文样本在最窄视口仍完整可读、不横向溢出（与其余三侧同构）
      await page.getByRole('button', { name: '代谈进度', exact: true }).click();
      await expect(page.getByText(长文)).toBeVisible();
      await expect(page.getByText(回执长文)).toBeVisible();
      await expect(page.getByRole('button', { name: '通过初筛' })).toBeVisible();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-招聘-进度-320.png', fullPage: true });
    });

    test('终局只读布局：ended 摘要与 completed 移交在 320px 完整可读、零发送 @backend @s0-s3-display', async ({ page }) => {
      await 装P5候选(page);

      // ended（戊）：S0–S3 展示统一 Task 4：顶部终局卡退场，终局摘要/结束时间落在结束段
      // （S0 ended 默认展开：胶囊「已结束」不用成功勾）+ 禁用底栏（J-PILOT-01 Spec §7）
      await hash直达(page, '/#/archived');
      await page.getByText(P5标记.戊职位名).click();
      await expect(page.getByText('本次代谈已结束').first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('结束时间：', { exact: false }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /匿名初筛/ })).toContainText('已结束');
      await expect(page.getByPlaceholder('本次代谈已结束')).toBeDisabled();
      await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: '提交回答' })).toHaveCount(0);
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-终局-ended-390.png', fullPage: true });

      // completed pending（己）：移交文案 + 恒禁用的开始私聊（禁用说明就地）。
      // completed 全段已通过按已过阶段折叠 —— 移交装在意向确认段尾，点开该段可达。
      await hash直达(page, `/#/deal/${P5编号.己}`);
      await expect(page.getByText('双方已确认，正在创建会话').first()).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: /意向确认/ }).click();
      const 私聊 = page.getByRole('button', { name: '开始私聊' });
      await expect(私聊).toBeDisabled();
      await expect(page.getByText('准备中')).toBeVisible();
      await expect(page.getByText('当前在谈已结束，仅可查看')).toBeVisible();
      await expect(page.getByRole('button', { name: '发送', exact: true })).toHaveCount(0);
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-终局-completed-390.png', fullPage: true });

      // 320px：终局摘要/移交/只读底栏都在，无横向溢出
      await page.setViewportSize({ width: 320, height: 568 });
      await expect(page.getByText('双方已确认，正在创建会话').first()).toBeVisible();
      await expect(私聊).toBeDisabled();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-终局-completed-320.png', fullPage: true });

      await hash直达(page, `/#/deal/${P5编号.戊}`);
      await expect(page.getByText('本次代谈已结束').first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: /匿名初筛/ })).toContainText('已结束');
      await expect(page.getByPlaceholder('本次代谈已结束')).toBeDisabled();
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-终局-ended-320.png', fullPage: true });
    });

    test('同 Case 附件由有值刷新为空：PDF 入口清理、区块仍在、零内容请求 @backend', async ({ page }) => {
      const fixture = await 装P5招聘(page);

      await hash直达(page, `/#/hr/candidate/${P5编号.甲}`);
      const 附件键 = page.getByRole('button', { name: new RegExp(P5标记.简历名) });
      await expect(附件键).toBeVisible({ timeout: 20_000 });
      await page.screenshot({ path: 'test-results/详情布局/bk-刷新前-附件在场-390.png', fullPage: true });

      // 合法可空字段有值→空：已绑定撤销 → S1 typed 附件缺席（不放宽 decoder，键整体不出场）
      fixture.cases[P5编号.甲]!.已绑定 = false;
      await expect(附件键).toHaveCount(0, { timeout: 10_000 }); // 轮询重读后入口清理
      await expect(page.getByText(P5标记.简历名)).toHaveCount(0); // 无残留文件名
      await expect(page.getByText(P5标记.甲职位名).first()).toBeVisible(); // 详情仍是正常页
      await expect(page.getByRole('button', { name: '通过初筛' })).toBeVisible(); // 动作卡不丢
      await 断言纵序(page, ['匿名初筛', '递交简历', '差异协同', '意向确认']); // 四阶段不缺段
      expect(fixture.PDF读取).toEqual([]); // 全程零内容 GET
      expect(fixture.变更请求).toEqual([]); // 刷新过渡零变异
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-刷新后-附件缺席-390.png', fullPage: true });
    });

    test('同 Case 核对清单由有值刷新为空数组：清单行消失、区块与动作卡仍在 @backend @s0-s3-display', async ({ page }) => {
      const fixture = 创建P5MatchCasefixture();
      // 清单 label 是 8 词闭集（未知 label 展示层整项省略）：有值样本用闭集词，显示固定中文
      const 乙 = fixture.cases[P5编号.乙]!;
      乙.阶段区们[0]!.checklist = [{ label: 'anonymous_screening_passed', done: true }];
      await 装P5候选(page, { fixture });

      await hash直达(page, `/#/deal/${P5编号.乙}`);
      await expect(page.getByText('匿名初筛已通过').first()).toBeVisible({ timeout: 20_000 });

      // 合法空数组样本：checklist 有值 → []（decoder 原样接受，UI 不残留旧行）
      fixture.cases[P5编号.乙]!.阶段区们[0]!.checklist = [];
      await expect(page.getByText('匿名初筛已通过')).toHaveCount(0, { timeout: 10_000 });
      await expect(page.getByText('匿名初筛', { exact: true }).first()).toBeVisible(); // 段仍在
      // J-PILOT-01：S0 补事实卡退场；S0–S3 展示统一 Task 4：时间线裸问题文本不再上屏
      // （问答应以 screening records 为准，v1 样本无记录即无问答）—— 底栏真禁用
      await expect(page.getByText(P5标记.问题)).toHaveCount(0);
      await expect(page.getByText('等待人工决定是否继续')).toBeVisible();
      await expect(page.getByRole('button', { name: '提交回答' })).toHaveCount(0);
      await expect(page.getByPlaceholder('双方 AI 代理正在确认条件')).toBeDisabled();
      expect(fixture.变更请求).toEqual([]); // 刷新过渡零变异
      await 断言无横向溢出(page);
      await page.screenshot({ path: 'test-results/详情布局/bk-刷新后-清单为空-390.png', fullPage: true });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// S0–S3 展示统一（Task 7）：双数据源定向浏览器回归 —— 全 HTTP 拦截，只证明前端
// 布局/接线/跨组件行为，不证明真实后端推进（本任务用户覆盖：不是 L3）。
//   · H1/H2 历史卡：双角色双来源同一共享卡/壳（18px 页边距、13/14 卡 padding、gap11、
//     margin10），Backend 无假 total，canonical record_id/case_id 路由，招聘双架失败隔离；
//   · P1–P3 进度：候选 v2 核心样本（S1 ended 默认展开非勾、手开 S0 时序各一次、
//     顶部无公开大段/终局/重复轮次条、灰注释不计条数、手动折叠经受数据刷新与 Tab 来回）；
//   · P4/D/R：冻结职位 20-30K 回退与空/缺简介区分、无公司 ID 禁用；招聘端安全简历
//     同源顶栏、遮蔽公司、无项目日期、不承诺沟通；PDF 租约与动作卡跨 Tab 保留；
//   · X1–X3：320×568/390×844 完整/缺失/长文/终局代表场景无横向溢出（document 与
//     主要滚动容器，1px 取整容差），定向截图只进 test-results，不动视觉基线。
//（原 e2e/数据源模式.spec.ts 的同 describe 按域迁入：pre-Case 用例归 连续委托.spec.ts，
//  独立匿名简历两用例归 发现推荐.spec.ts。）
// ─────────────────────────────────────────────────────────────────────────────

test.describe('S0-S3 展示统一 @s0-s3-display', () => {
  /** 历史卡版式量测（H1，Spec §4.1 视觉基准）：页边距 18px、卡 padding 13px 14px、
   *  横向 gap 11px、卡下 margin 10px —— 只量共享卡这一处版式事实，不逐像素比对不同文本。 */
  async function 断言历史卡版式(卡: Locator) {
    const 版式 = await 卡.evaluate((卡元) => {
      const 样式 = getComputedStyle(卡元);
      const 页 = 卡元.closest('.滚动区');
      return {
        卡padding: 样式.padding,
        卡下间距: 样式.marginBottom,
        卡横向gap: 样式.columnGap,
        页左右边距: 页 ? `${getComputedStyle(页).paddingLeft}/${getComputedStyle(页).paddingRight}` : null,
      };
    });
    expect(版式.卡padding).toBe('13px 14px');
    expect(版式.卡下间距).toBe('10px');
    expect(版式.卡横向gap).toBe('11px');
    expect(版式.页左右边距).toBe('18px/18px');
  }

  /** 共享系统注释胶囊（对话系统注释.module.css）的冻结版式（Spec §9 组件边界 2）：
   *  阶段对话流 与 两个往来记录屏共用同一 module —— 同一输入同一组值。 */
  async function 断言灰注释版式(注: Locator) {
    const 值 = await 注.evaluate((元) => {
      const 样式 = getComputedStyle(元);
      return { 字号: 样式.fontSize, 行高: 样式.lineHeight, 内边距: 样式.padding, 圆角: 样式.borderRadius };
    });
    expect(值.字号).toBe('11.5px');
    expect(值.行高).toBe('17px');
    expect(值.内边距).toBe('4px 11px');
    expect(值.圆角).toBe('9px');
  }

  // ── v2 连续筛选样本（Task 7 合同：显式补全 v2 必需连续字段，不能只改 version）──

  /** 庚：v2 已结束样本（S1 semantic_not_fit 定格）。候选端带候选私有初评/复评与 S0+S1 问答。 */
  function 建v2终局样本(): P5MatchCasefixture形 {
    const fixture = 创建P5MatchCasefixture();
    const 庚 = P5Case({
      caseId: P5编号.庚, lifecycle: 'ended', stage: 'resume_submission', status: 'ended', step: 'complete',
      职位名: P5标记.庚职位名, alias: P5标记.庚别名,
      createdAt: '2026-08-26T01:00:00Z', updatedAt: '2026-08-26T03:00:00Z', finalizedAt: '2026-08-26T03:00:00Z',
      outcome: 'semantic_not_fit', outcomeCode: 'hard_exclusion',
      终局: {
        stage: 'resume_submission', outcome: 'semantic_not_fit', reason_summary: 'hard_exclusion',
        finalized_at: '2026-08-26T03:00:00Z',
      },
      已绑定: true,
      连续块: {
        pending_actions: [],
        dialogue_progress: {
          stage: 'resume_submission', asking_role: 'recruiter',
          recruiter_round: 1, candidate_round: 0, round_budget: 3,
        },
        reconsideration: { eligible: true, deadline: '2026-09-02T03:00:00Z', unavailable_reason: null },
        confirmation_summary: null,
      },
    });
    庚.阶段区们[0]!.screening_records = {
      messages: [
        {
          id: 'msg_p5_g_q1', kind: 'question', role: 'recruiter', stage: 'anonymous_screening',
          asking_role: 'recruiter', round: 1, text: P5标记.庚S0问, occurred_at: '2026-08-26T01:12:00Z',
        },
        {
          id: 'msg_p5_g_a1', kind: 'answer', role: 'candidate', stage: 'anonymous_screening',
          asking_role: 'recruiter', round: 1, answer_status: 'answered', answer_source: 'agent',
          text: P5标记.庚S0答, occurred_at: '2026-08-26T01:14:00Z',
        },
        {
          id: 'msg_p5_g_q2', kind: 'question', role: 'recruiter', stage: 'resume_submission',
          asking_role: 'recruiter', round: 1, text: P5标记.庚S1问, occurred_at: '2026-08-26T02:00:00Z',
        },
        {
          id: 'msg_p5_g_a2', kind: 'answer', role: 'candidate', stage: 'resume_submission',
          asking_role: 'recruiter', round: 1, answer_status: 'unknown', answer_source: 'agent',
          occurred_at: '2026-08-26T02:02:00Z',
        },
      ],
      summaries: [
        { id: 'sum_p5_g_init', phase: 'initial' as const, summary: 'P5 Fixture 庚初评·公开资料核对', occurred_at: '2026-08-26T01:10:00Z' },
        { id: 'sum_p5_g_reev', phase: 'reevaluation' as const, round: 1, summary: P5标记.庚复评长文, occurred_at: '2026-08-26T01:16:00Z' },
      ],
    };
    庚.阶段区们[0]!.checklist = [{ label: 'anonymous_screening_passed', done: true }];
    庚.阶段区们[1]!.checklist = [
      { label: 'resume_bound', done: true },
      { label: 'resume_parse_ready', done: true },
      { label: 'resume_disclosed', done: true },
      { label: 'resume_screened', done: false },
    ];
    fixture.cases[P5编号.庚] = 庚;
    fixture.连续记录[P5连续编号.庚] = {
      recordId: P5连续编号.庚, recordKind: 'case', caseId: P5编号.庚,
      delegationId: null, evaluationId: null, phase: 'case_started',
      needsAction: false, actions: { retry: false, archive: false, open_case: false },
      failure: null, refusalCode: null, retryGeneration: 0,
      职位名: P5标记.庚职位名, createdAt: '2026-08-26T01:00:00Z',
      updatedAt: '2026-08-26T03:00:00Z', archivedAt: null,
      公开评: { decision: 'fit', summary: P5标记.庚公开评 },
    };
    return fixture;
  }

  /** 辛：v2 进行样本（S1 awaiting_recruiter_decision）。招聘方待办在场 → 候选端看到
   *  「等待对方」胶囊、段内待办说明与发问块轮次，而自己零按钮。 */
  function 建v2进行样本(): P5MatchCasefixture形 {
    const fixture = 创建P5MatchCasefixture();
    const 辛 = P5Case({
      caseId: P5编号.辛, lifecycle: 'open', stage: 'resume_submission', status: 'needs_user',
      step: 'awaiting_recruiter_decision',
      职位名: P5标记.辛职位名, alias: P5标记.辛别名, updatedAt: '2026-08-29T02:08:00Z',
      摘要: P5摘要样本('辛'),
      招聘: { needsAction: true, actions: ['decide_resume_screening'] },
      连续块: {
        pending_actions: [{
          id: `cpa_${'0'.repeat(30)}b1`, role: 'recruiter', purpose: 's1_continue',
          created_at: '2026-08-29T02:00:00Z', deadline: '2026-09-01T02:00:00Z',
        }],
        dialogue_progress: {
          stage: 'resume_submission', asking_role: 'recruiter',
          recruiter_round: 1, candidate_round: 0, round_budget: 3,
        },
        reconsideration: null,
        confirmation_summary: null,
      },
    });
    fixture.cases[P5编号.辛] = 辛;
    fixture.连续记录[P5连续编号.辛] = {
      recordId: P5连续编号.辛, recordKind: 'case', caseId: P5编号.辛,
      delegationId: null, evaluationId: null, phase: 'case_started',
      needsAction: false, actions: { retry: false, archive: false, open_case: false },
      failure: null, refusalCode: null, retryGeneration: 0,
      职位名: P5标记.辛职位名, createdAt: '2026-08-29T01:12:00Z',
      updatedAt: '2026-08-29T02:08:00Z', archivedAt: null,
      公开评: null,
    };
    return fixture;
  }

  // ── Mock 端（mock/stg 4181）：共享历史卡 + 共享详情版式，零 /api ──────────────
  test.describe('Mock 端', () => {
    test.use({ baseURL: 'http://127.0.0.1:4181' });

    test('Mock 历史卡共享版式/字段顺序、往来记录默认行为与详情四段版式，零 API 请求 @mock @s0-s3-display', async ({ page }) => {
      const api请求: string[] = [];
      page.on('request', (请求) => {
        if (new URL(请求.url()).pathname.startsWith('/api/v1')) api请求.push(请求.url());
      });

      await page.goto('/');
      await page.getByText(/已阅读并同意/).click();
      await page.getByRole('button', { name: '微信登录' }).click();
      await expect(page).toHaveURL(/#\/identity$/);
      await page.goto('/#/archived');

      // 共享壳（历史代谈外壳）：固定说明条 + Mock 精确总数副标题
      await expect(page.getByText('SHEIN').first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('3 单已结束')).toBeVisible();
      await expect(page.getByText('历史代谈保留往来记录，可回看进度与结果；能否继续以详情页当前可用操作为准。'))
        .toBeVisible();

      // 共享卡字段顺序（H1 阅读顺序）：标题+结果标 → 职位 → 原因 → 阶段说明/时间/回看
      const 卡 = page.getByRole('button').filter({ hasText: 'SHEIN' });
      await 断言历史卡版式(卡);
      const 序 = await 卡.evaluate((元) => {
        const 取 = (文本: string) => {
          const 元们 = [...(元 as HTMLElement).querySelectorAll('*')]
            .filter((子) => 子.children.length === 0 && 子.textContent?.trim() === 文本);
          const 框 = 元们[0]?.getBoundingClientRect();
          return 框 ? { x: 框.x, y: 框.y } : null;
        };
        return {
          标题: 取('SHEIN'), 结果: 取('我方退出'), 职位: 取('高级后端工程师（供应链）'),
          原因: 取('要求全现场办公，与你「每周至少 2 天远程」的底线冲突。'),
          止步: 取('止步于 需要协调'), 回看: 取('回看往来 ›'),
        };
      });
      expect(序.标题).not.toBeNull();
      expect(序.结果!.x).toBeGreaterThan(序.标题!.x); // 结果标与标题同行靠右
      expect(Math.abs(序.结果!.y - 序.标题!.y), '结果标与标题同行').toBeLessThan(2);
      expect(序.职位!.y).toBeGreaterThan(序.标题!.y);
      expect(序.原因!.y).toBeGreaterThan(序.职位!.y);
      expect(序.止步!.y).toBeGreaterThan(序.原因!.y);
      expect(Math.abs(序.回看!.y - 序.止步!.y), '底行同行：阶段说明 | 时间 | 回看').toBeLessThan(2);

      // 320×568：完整历史列表可读、卡可达、无横向溢出
      await page.setViewportSize({ width: 320, height: 568 });
      await expect(page.getByText('星尘互娱').first()).toBeVisible();
      await 断言核心页无横向溢出(page);
      await page.screenshot({ path: 'test-results/S0S3展示统一/mock-历史-320.png', fullPage: true });

      // 点卡开往来记录：默认行为保持（共享卡打开同一单的往来页）
      await page.setViewportSize({ width: 390, height: 844 });
      await 卡.click();
      await expect(page).toHaveURL(/#\/thread\/G-01$/, { timeout: 15_000 });
      await expect(page.getByText('完整往来记录')).toBeVisible();
      await expect(page.getByText('全现场是团队协作的偏好项，能否接受？其余软性条件贵方均符合。')).toBeVisible();
      await 断言核心页无横向溢出(page);

      // 共享详情版式（与 Backend 同一组组件/props 形状）：四段分节 + 底栏
      await page.goto('/#/deal/J-01');
      await expect(page.getByText('资深后端工程师 · 交易网关').first()).toBeVisible({ timeout: 15_000 });
      await 断言纵序(page, ['匿名初筛', '递交简历', '需要协调', '意向确认']);
      await 断言核心页无横向溢出(page);
      await page.screenshot({ path: 'test-results/S0S3展示统一/mock-进度-390.png', fullPage: true });

      // 往来记录的系统胶囊（企业屏有系统条样本）与阶段流灰注释共用同一 module：
      // 同一冻结版式值（Spec §9 组件边界 2）
      await page.goto('/#/identity?switch=1&from=app');
      await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
      await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
      await page.goto('/#/hr/thread/A-01');
      await expect(page.getByText('完整往来记录')).toBeVisible({ timeout: 15_000 });
      const 注 = page.locator('[class*="注释胶囊"]').first();
      await expect(注).toBeVisible();
      await 断言灰注释版式(注);
      await 断言核心页无横向溢出(page);

      // Mock 全程零 /api 请求（X2）：登录、历史、往来记录、详情与切身份整段旅程
      expect(api请求).toEqual([]);
    });
  });

  // ── Backend 端（backend/stg 4182）：P5 HTTP fixture 双角色 ────────────────────
  test.describe('Backend 端', () => {
    test.use({ baseURL: 'http://127.0.0.1:4182' });

    test('候选历史：共享卡/壳、已加载 N 单无假 total、canonical record_id 路由 390/320 @backend @s0-s3-display', async ({ page }) => {
      await 装P5候选(page);
      await page.goto('/#/archived');
      await expect(page.getByText(P5标记.戊职位名).first()).toBeVisible({ timeout: 20_000 });

      // 单一连续集合：已加载 N 单（真实加载数），绝不显示 Mock 的精确总数句式
      await expect(page.getByText('已加载 2 单')).toBeVisible();
      await expect(page.getByText('单已结束')).toHaveCount(0);
      await expect(page.getByText('历史代谈保留往来记录，可回看进度与结果；能否继续以详情页当前可用操作为准。'))
        .toBeVisible();

      // 服务端顺序（created_at DESC）：戊（ended）→ 己（completed）；终局字典文案
      await 断言纵序(page, [P5标记.戊职位名, P5标记.己职位名]);
      const 戊卡 = page.getByRole('button').filter({ hasText: P5标记.戊职位名 });
      await expect(戊卡).toContainText('已结束');
      await expect(戊卡).toContainText('本次代谈已结束');
      await expect(戊卡).toContainText('止步于 匿名初筛');
      const 己卡 = page.getByRole('button').filter({ hasText: P5标记.己职位名 });
      await expect(己卡).toContainText('已谈成');
      await expect(己卡).toContainText('双方已确认意向');
      await expect(己卡).toContainText('完成于 意向确认');
      await 断言历史卡版式(戊卡);

      // 终局卡在 320×568 同样可读、无横向溢出
      await page.setViewportSize({ width: 320, height: 568 });
      await expect(己卡).toContainText('已谈成');
      await 断言核心页无横向溢出(page);
      await page.screenshot({ path: 'test-results/S0S3展示统一/bk-历史-候选-320.png', fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });

      // 点卡按 canonical record_id 开同一在谈详情（历史卡零动作控件，只读回看）
      await 己卡.click();
      await expect(page).toHaveURL(new RegExp(`#/deal/${P5连续编号.己}$`), { timeout: 15_000 });
      await expect(page.getByText(P5标记.己职位名).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('当前在谈已结束，仅可查看')).toBeVisible();
      await expect(page.getByRole('button', { name: '加载更多' })).toHaveCount(0);
      await 断言核心页无横向溢出(page);
      await page.screenshot({ path: 'test-results/S0S3展示统一/bk-历史-详情-390.png', fullPage: true });
    });

    test('招聘历史：completed/ended 双架子、一侧失败只见错误行可重试、case_id 路由 @backend @s0-s3-display', async ({ page }) => {
      const fixture = await 装P5招聘(page);
      // 失败注入只挡 ended 一架（lifecycle=ended 的请求；completed 放行给后注册路由链，
      // unroute 后恢复权威 fixture）
      const ended拦截 = '**/api/v1/recruiter/match-cases/history*';
      await page.route(ended拦截, (路由) => {
        if (new URL(路由.request().url()).searchParams.get('lifecycle') !== 'ended') {
          void 路由.fallback();
          return;
        }
        void 路由.fulfill({
          status: 500, headers: { 'Cache-Control': 'no-store' },
          json: { error: { type: 'internal', message: 'fixture 注入失败' } },
        });
      });
      await page.goto('/#/hr/archived');
      await expect(page.getByText(P5标记.己职位名).first()).toBeVisible({ timeout: 20_000 });

      // 双架同屏：completed 正常渲染、ended 首载失败给失败态 + 重试；数量只计正常记录
      //（架子标题与卡结果标同词：定位取首个）
      await expect(page.getByText('已谈成', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('已结束', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('历史暂时加载不了')).toBeVisible();
      await expect(page.getByText('已加载 1 单')).toBeVisible();
      await expect(page.getByText(P5标记.戊职位名)).toHaveCount(0);
      await 断言核心页无横向溢出(page);
      await page.screenshot({ path: 'test-results/S0S3展示统一/bk-历史-招聘-失败隔离-390.png', fullPage: true });

      // 重试（unroute 后走权威 fixture）：架子恢复、已加载计数跟上
      await page.unroute(ended拦截);
      await page.getByRole('button', { name: '重试' }).click();
      await expect(page.getByText(P5标记.戊职位名).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('已加载 2 单')).toBeVisible();

      // 招聘历史卡：合法匿名别名作标题、画像位置恒保留、共享卡版式一致
      const 戊卡 = page.getByRole('button').filter({ hasText: P5标记.戊职位名 });
      await expect(戊卡).toContainText(P5标记.戊别名);
      await expect(戊卡).toContainText('画像信息暂未提供');
      await expect(戊卡).toContainText('已结束');
      await 断言历史卡版式(戊卡);

      // 点卡按 case_id 开同一候选详情（终局只读：胶囊「已结束」+ 只读底栏）
      await 戊卡.click();
      await expect(page).toHaveURL(new RegExp(`#/hr/candidate/${P5编号.戊}$`), { timeout: 15_000 });
      await expect(page.getByText(P5标记.戊职位名).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button').filter({ hasText: '匿名初筛' })).toContainText('已结束');
      await expect(page.getByPlaceholder('本次代谈已结束')).toBeDisabled();
      expect(fixture.变更请求).toEqual([]);
      await 断言核心页无横向溢出(page);
      await page.screenshot({ path: 'test-results/S0S3展示统一/bk-历史-招聘-详情-390.png', fullPage: true });
    });

    test('候选 v2 终局样本：S1 ended 默认展开非勾、S0 手开时序各一次、顶部干净、灰注释不计条数 @backend @s0-s3-display', async ({ page }) => {
      const fixture = 建v2终局样本();
      await 装P5候选(page, { fixture });
      await page.goto(`/#/deal/${P5连续编号.庚}`);
      await expect(page.getByText(P5标记.庚职位名).first()).toBeVisible({ timeout: 20_000 });

      // 顶部干净（A.8）：无公开初评英文大段、无顶部终局卡、无重复轮次状态条 ——
      // 协议词（outcome/code/英文 summary）一律不透出
      await expect(page.getByText('公开信息初评')).toHaveCount(0);
      await expect(page.getByText(P5标记.庚公开评)).toHaveCount(0);
      await expect(page.getByText('semantic_not_fit')).toHaveCount(0);
      await expect(page.getByText('hard_exclusion')).toHaveCount(0);

      // S1（终局段）默认展开且非成功勾：轴点无 ✓，胶囊按终局字典「不匹配」，
      // 小结=细化原因 + 结束时间 + 七天窗口中性说明（candidate eligible 但零按钮）
      const 段们 = page.locator('[class*="分段"]');
      const S1段 = 段们.filter({ hasText: '递交简历' });
      const S0段 = 段们.filter({ hasText: '匿名初筛' });
      await expect(S1段).toHaveCount(1);
      await expect(S0段).toHaveCount(1);
      await expect(S1段.getByText('必要条件不匹配')).toBeVisible();
      await expect(S1段.getByText('结束时间：', { exact: false })).toBeVisible();
      await expect(S1段.getByText(/招聘方可在 .* 前重新考虑这一单/)).toBeVisible();
      await expect(S1段.locator('[class*="轴勾"]')).toHaveCount(0);
      await expect(S1段.getByRole('button', { name: '重新考虑' })).toHaveCount(0);
      await expect(S1段.getByRole('button', { name: '出具简历初筛结论' })).toHaveCount(0);
      // 条数只计气泡（问 + 未回答 = 2 条），灰注释/附件/小结不计
      await expect(S1段.getByRole('button').filter({ hasText: '递交简历' })).toContainText('2 条');
      // S1 的问与 unknown 答只落 S1（unknown → 「暂时无法回答」，不编造正文）
      await expect(S1段.getByText(P5标记.庚S1问)).toBeVisible();
      await expect(S1段.getByText('暂时无法回答')).toBeVisible();
      // 简历核对行：done=false 在终局为「未完成」，semantic_not_fit 细化「简历初筛未通过」
      await expect(S1段.getByText('简历初筛未通过')).toBeVisible();
      // 候选自己的 PDF 入口常驻（S1 typed 附件）
      await expect(S1段.getByRole('button', { name: new RegExp(P5标记.简历名) })).toBeVisible();

      // S0（已通过）默认折叠 —— 分节条带「已通过」胶囊与一行结论，段内时序不可见
      await expect(page.getByRole('button').filter({ hasText: '匿名初筛' })).toContainText('已通过');
      await expect(S0段.getByText(P5标记.庚S0问)).toHaveCount(0);

      // 手开 S0：初评 → 问 → 答 → 复评各一次（时间序）；中文证据在段底小结
      await page.getByRole('button').filter({ hasText: '匿名初筛' }).click();
      await expect(S0段.getByText(P5标记.庚S0问)).toBeVisible();
      const 断言只出现一次 = async (定位: Locator) => {
        await 定位.waitFor({ state: 'visible' });
        expect(await 定位.count()).toBe(1);
      };
      await 断言只出现一次(S0段.getByText(P5标记.庚S0问));
      await 断言只出现一次(S0段.getByText(P5标记.庚S0答));
      const S0初评注 = S0段.locator('[class*="注释胶囊"]').filter({ hasText: '庚初评' });
      const S0复评注 = S0段.locator('[class*="注释胶囊"]').filter({ hasText: P5标记.庚复评长文 });
      await 断言只出现一次(S0初评注);
      await 断言只出现一次(S0复评注);
      await 断言灰注释版式(S0初评注); // 段内注释与往来记录系统胶囊共用同一 module 版式
      await expect(S0初评注).toContainText('初评 · ');
      await expect(S0复评注).toContainText('第 1 轮复评 · ');
      await 断言纵序(page, [S0初评注, S0段.getByText(P5标记.庚S0问), S0段.getByText(P5标记.庚S0答), S0复评注]);
      // 灰注释不计条数：S0 分节条仍只计两个问答气泡
      await expect(page.getByRole('button').filter({ hasText: '匿名初筛' })).toContainText('2 条');
      // 段底小结：阶段结论 + 公开资料匹配检查中文决定与证据；英文 summary 不在场
      // （小结正文与核对行 label 同词：取首个）
      await expect(S0段.getByText('匿名初筛已通过', { exact: true }).first()).toBeVisible();
      await expect(S0段.getByText('公开资料匹配检查：公开初评匹配')).toBeVisible();
      await expect(S0段.getByText('其他条件：匹配')).toBeVisible();
      await expect(page.getByText(P5标记.庚公开评)).toHaveCount(0);
      // 轮次提示只出现一次（挂当前结束段的段首说明），不是顶部第二条状态条
      await expect(page.getByText('当前由招聘方发问，已问 1/3 轮')).toHaveCount(1);
      await 断言核心页无横向溢出(page);
      await page.screenshot({ path: 'test-results/S0S3展示统一/bk-进度-候选v2终局-390.png', fullPage: true });

      // Tab 来回不丢手动折叠：收起 S1、S0 保持手开 —— 切资料再切回，覆盖值原样
      await page.getByRole('button').filter({ hasText: '递交简历' }).click();
      await expect(S1段.getByText(P5标记.庚S1问)).toHaveCount(0);
      await page.getByRole('button', { name: '职位详情', exact: true }).click();
      await expect(page.getByText('匹配度分析').first()).toBeVisible();
      await page.getByRole('button', { name: '代谈进度', exact: true }).click();
      await expect(S1段.getByText(P5标记.庚S1问)).toHaveCount(0);
      await expect(S0段.getByText(P5标记.庚S0问)).toBeVisible();

      // 320×568（长文/终局代表场景）：复评长灰注释换行可读、按钮可达、无横向溢出
      await page.setViewportSize({ width: 320, height: 568 });
      await expect(S0复评注).toBeVisible();
      const 复评框 = await S0复评注.boundingBox();
      expect(复评框!.height, '长灰注释换行后不止一行').toBeGreaterThan(36);
      await 断言核心页无横向溢出(page);
      await page.screenshot({ path: 'test-results/S0S3展示统一/bk-进度-候选v2终局-320.png', fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(fixture.变更请求).toEqual([]); // 终局只读：整段零变异
    });

    test('候选 v2 进行样本：等待对方胶囊、段内待办零按钮，数据刷新不丢手动折叠 @backend @s0-s3-display', async ({ page }) => {
      const 请求序: string[] = [];
      const fixture = 建v2进行样本();
      await 装P5候选(page, {
        fixture,
        请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
      });
      await page.goto(`/#/deal/${P5连续编号.辛}`);
      await expect(page.getByText(P5标记.辛职位名).first()).toBeVisible({ timeout: 20_000 });

      const S1条 = page.getByRole('button').filter({ hasText: '递交简历' });
      // 当前段默认展开：等待对方胶囊（对端待办）、段内待办说明零按钮、发问块轮次一行
      await expect(page.getByText('等待对方', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('等待招聘方出具简历初筛结论')).toBeVisible();
      await expect(page.getByText('逾期未回应，这一单会自动结束')).toBeVisible();
      await expect(page.getByText('当前由招聘方发问，已问 1/3 轮')).toHaveCount(1);
      await expect(page.getByRole('button', { name: '出具简历初筛结论' })).toHaveCount(0);
      await 断言核心页无横向溢出(page);
      await page.screenshot({ path: 'test-results/S0S3展示统一/bk-进度-候选v2进行-390.png', fullPage: true });

      // 手动收起 S1 → 3 秒权威重读至少一拍 → 手动折叠不被数据刷新冲掉
      const 详情GET数 = () => 请求序.filter((项) => 项 === `GET /api/v1/me/negotiations/${P5连续编号.辛}`).length;
      await S1条.click();
      await expect(page.getByText('等待招聘方出具简历初筛结论')).toHaveCount(0);
      await page.waitForTimeout(4_000);
      expect(详情GET数(), 'open 详情在 3 秒节拍上持续权威重读').toBeGreaterThanOrEqual(2);
      await expect(page.getByText('等待招聘方出具简历初筛结论')).toHaveCount(0);
      // 重新展开：内容原样回来
      await S1条.click();
      await expect(page.getByText('等待招聘方出具简历初筛结论')).toBeVisible();
      expect(fixture.变更请求).toEqual([]); // 观察窗零写请求
    });

    test('job 深链与冻结投影：?tab=job 首挂载定位、20-30K 回退顶栏一致、空/缺简介区分、无公司 ID 禁用 @backend @s0-s3-display', async ({ page }) => {
      const fixture = 创建P5MatchCasefixture();
      const 甲 = fixture.cases[P5编号.甲]!;
      // 摘要薪资置空 + 冻结三元组 20/30/month → 唯一薪资投影回退 20-30K（Spec §6.2）
      甲.职位覆盖 = { 薪资带: '' };
      甲.jobDetail = {
        title: null, recruitment_type: null, category: null, office_location: null,
        workplace_mode: null, annual_salary_months: null, campus_cohort: null,
        internship_months: null, onsite_days_per_week: null, experience_requirement: null,
        education_requirement: null, hard_requirements: null, structured_requirements_confirmed: null,
        keywords: null, benefit_codes: null, office_address: null,
        description: P5标记.冻结岗位描述,
        requirements: P5标记.冻结岗位要求,
        location: { id: 'loc-fixture-001', display_name: P5标记.城市 },
        salary_lower: 20, salary_upper: 30, salary_period: 'month',
        organization: {
          organization_id: null, display_name: P5标记.冻结公司,
          industry: null, company_size: null, funding_stage: null, logo: null,
        },
        // '' 是已知空（暂无公司介绍），null 才是缺失 —— 先给空串样本
        company_intro: '',
        publisher_profile: {
          public_name: P5标记.冻结发布人, title: '招聘负责人',
          personal_verification_status: 'verified', avatar_url: null,
        },
      };
      await 装P5候选(page, { fixture });

      // 深链首挂载直接落在职位详情 Tab（candidate 只认 ?tab=job）；别名坐标被
      // canonical record_id replace 保留 query
      await page.goto(`/#/deal/${P5编号.甲}?tab=job`);
      await expect(page.getByText('匹配度分析').first()).toBeVisible({ timeout: 20_000 });
      expect(page.url()).toContain(`deal/${P5连续编号.甲}`);
      expect(page.url()).toContain('tab=job');

      // 顶栏与资料摘要同吃一份冻结投影：职位/公司、城市 · 20-30K（D1 顶栏一致）
      await expect(page.getByText(`${P5标记.甲职位名} · ${P5标记.冻结公司}`).first()).toBeVisible();
      await expect(page.getByText(`${P5标记.城市} · 20-30K`).first()).toBeVisible();
      await expect(page.getByText('P5 Fixture 冻结岗位描述')).toBeVisible();
      await expect(page.getByText('P5 Fixture 冻结岗位要求')).toBeVisible();
      await expect(page.getByText(P5标记.冻结发布人)).toBeVisible();
      // 公司：冻结组织名上屏；无真实 organization_id → 导航入口真实禁用并就地解释
      await expect(page.getByText(P5标记.冻结公司).first()).toBeVisible();
      const 公司入口 = page.getByRole('button').filter({ hasText: P5标记.冻结公司 });
      await expect(公司入口).toBeDisabled();
      await expect(page.getByText('公司详情暂不可用')).toBeVisible();
      // company_intro '' = 已知空
      await expect(page.getByText('暂无公司介绍')).toBeVisible();
      await 断言核心页无横向溢出(page);
      await page.screenshot({ path: 'test-results/S0S3展示统一/bk-资料-job深链-空简介-390.png', fullPage: true });

      // 手选 Tab 不被 query 抢：切回进度后，权威重读不把深链 query 重新应用
      await page.getByRole('button', { name: '代谈进度', exact: true }).click();
      await expect(page.getByText('递交简历', { exact: true }).first()).toBeVisible();
      await page.waitForTimeout(3_500); // 甲 open：至少一拍 3 秒权威重读
      await expect(page.getByText('递交简历', { exact: true }).first()).toBeVisible();

      // 有值 → 空（'' → null）：下一拍权威重读后区分「缺失」，绝不残留旧内容
      甲.jobDetail!.company_intro = null;
      await page.getByRole('button', { name: '职位详情', exact: true }).click();
      await expect(page.getByText('公司介绍缺失')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('暂无公司介绍')).toHaveCount(0);
      await 断言核心页无横向溢出(page);
      await page.screenshot({ path: 'test-results/S0S3展示统一/bk-资料-job深链-缺简介-390.png', fullPage: true });

      // 320×568：冻结摘要四事实与缺失说明同屏可读
      await page.setViewportSize({ width: 320, height: 568 });
      await expect(page.getByText('20-30K').first()).toBeVisible();
      await expect(page.getByText(P5标记.技能).first()).toBeVisible();
      await 断言核心页无横向溢出(page);
      await page.screenshot({ path: 'test-results/S0S3展示统一/bk-资料-job深链-320.png', fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
    });

    test('resume 深链与安全简历：?tab=resume 定位、顶栏同源画像、遮蔽公司、无项目日期、不承诺沟通 @backend @s0-s3-display', async ({ page }) => {
      const fixture = 创建P5MatchCasefixture();
      const 甲 = fixture.cases[P5编号.甲]!;
      // 甲 S0 公开问答 + 候选私有总结：招聘端必须看到问答但绝不见私有词（wire 在 fixture 收口）
      甲.阶段区们[0]!.screening_records = {
        messages: [
          {
            id: 'msg_p5_jia_q1', kind: 'question', role: 'recruiter', stage: 'anonymous_screening',
            asking_role: 'recruiter', round: 1, text: P5标记.庚S0问, occurred_at: '2026-08-29T01:10:00Z',
          },
          {
            id: 'msg_p5_jia_a1', kind: 'answer', role: 'candidate', stage: 'anonymous_screening',
            asking_role: 'recruiter', round: 1, answer_status: 'answered', answer_source: 'agent',
            text: P5标记.庚S0答, occurred_at: '2026-08-29T01:12:00Z',
          },
        ],
        summaries: [{ id: 'sum_p5_jia_1', phase: 'initial' as const, summary: P5标记.庚私有总结, occurred_at: '2026-08-29T01:08:00Z' }],
      };
      甲.candidateResume = {
        summary: {
          gender: 'female', experience_years: 6, job_status: 'employed',
          degree: 'P5 Fixture 本科',
          latest_experience: { company: 'P5 Fixture 公司', title: 'P5 Fixture 现职·甲' },
          latest_education: { institution: 'P5 Fixture 大学', major: 'P5 Fixture 专业' },
          personal_highlights: [],
        },
        self_description: P5标记.辛自述长文,
        skills: ['P5 Fixture Go', 'P5 Fixture K8s'],
        experiences: [{
          company: null, industry: null, title: 'P5 Fixture 后端工程师',
          start_month: null, end_month: null, description: 'P5 Fixture 经历说明',
          internship: false,
          projects: [{ name: 'P5 Fixture 项目甲', role: '负责人', result: 'P5 Fixture 项目成果' }],
        }],
        educations: [{
          institution: 'P5 Fixture 大学', major: 'P5 Fixture 专业', degree: '本科',
          start_month: '2021-09', end_month: '2025-06',
        }],
        expectation: {
          recruitment_type: 'social_full_time',
          job_category: { id: 'jc-fixture-001', display_name: 'P5 Fixture 方向' },
          locations: [{ id: 'loc-fixture-001', display_name: P5标记.城市 }],
          workplace_modes: ['hybrid'],
        },
        compensation_relationship: 'overlap',
      };
      await 装P5招聘(page, { fixture });

      // 深链首挂载直接落在线简历 Tab（recruiter 只认 ?tab=resume）
      await page.goto(`/#/hr/candidate/${P5编号.甲}?tab=resume`);
      await expect(page.getByText('匹配度分析').first()).toBeVisible({ timeout: 20_000 });
      expect(page.url()).toContain('tab=resume');

      // 顶栏画像与正文同源（R1）：性别/年限/学历/求职状态/最近工作行都来自同一响应
      //（顶栏画像行与正文头区同词：定位取首个）
      await expect(page.getByRole('img', { name: '女' }).first()).toBeVisible();
      await expect(page.getByText('6 年', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('P5 Fixture 本科').first()).toBeVisible();
      await expect(page.getByText('在职看机会').first()).toBeVisible();
      await expect(page.getByText('P5 Fixture 公司 · P5 Fixture 现职·甲').first()).toBeVisible();
      // 匹配区：安全来源无匹配证据 —— 标题在、缺失说明在（R1 不整区消失）
      await expect(page.getByText('匹配分析缺失')).toBeVisible();
      // 遮蔽公司「未披露」；起始缺失「日期未知」；项目无独立日期（全页只有工作行这一个日期占位）
      await expect(page.getByText('未披露').first()).toBeVisible();
      await expect(page.getByText('日期未知')).toHaveCount(1);
      await expect(page.getByText('P5 Fixture 项目甲')).toBeVisible();
      // 长自述换行可读；页尾是无承诺生成声明（未双确认不承诺双向核验/真人沟通）
      await expect(page.getByText(P5标记.辛自述长文)).toBeVisible();
      await expect(page.getByText('由候选人的AI代理生成 · 内容不可转发')).toBeVisible();
      await expect(page.getByText('双向核验')).toHaveCount(0);
      await expect(page.getByText('真人沟通')).toHaveCount(0);
      // 进度 Tab 的 S0：公开问答可见，候选私有总结绝不出现（P2 隐私栅栏）。
      // S0 已通过按已过阶段折叠 —— 点开回看段内时序
      await page.getByRole('button', { name: '代谈进度', exact: true }).click();
      await page.getByRole('button').filter({ hasText: '匿名初筛' }).click();
      await expect(page.getByText(P5标记.庚S0问)).toBeVisible();
      await expect(page.getByText(P5标记.庚S0答)).toBeVisible();
      await expect(page.getByText(P5标记.庚私有总结)).toHaveCount(0);
      await 断言核心页无横向溢出(page);
      await page.screenshot({ path: 'test-results/S0S3展示统一/bk-进度-招聘v2隐私-390.png', fullPage: true });

      // S1 已授权 PDF 入口常驻：打开 → 关闭（租约随弹层回收，revoke 细节归 hook 单测）
      // → 资料来回切，附件入口与动作卡原样保留（Tab 只互斥挂载内容槽，不卸载详情主体）
      const 附件键 = page.getByRole('button', { name: new RegExp(P5标记.简历名) });
      await expect(附件键).toBeVisible();
      await 附件键.click();
      await expect(page.getByRole('dialog').getByText(P5标记.简历名)).toBeVisible({ timeout: 10_000 });
      await page.getByRole('button', { name: '关闭', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.getByRole('button', { name: '在线简历', exact: true }).click();
      await expect(page.getByText('匹配度分析').first()).toBeVisible();
      await page.getByRole('button', { name: '代谈进度', exact: true }).click();
      await expect(page.getByRole('button', { name: '通过初筛' })).toBeVisible(); // 动作卡不丢
      await expect(附件键).toBeVisible();

      // 320×568（长文代表场景）：自述长文换行可读、无横向溢出
      await page.getByRole('button', { name: '在线简历', exact: true }).click();
      await page.setViewportSize({ width: 320, height: 568 });
      await expect(page.getByText(P5标记.辛自述长文)).toBeVisible();
      const 自述框 = await page.getByText(P5标记.辛自述长文).boundingBox();
      expect(自述框!.height, '长自述换行后不止一行').toBeGreaterThan(60);
      await 断言核心页无横向溢出(page);
      await page.screenshot({ path: 'test-results/S0S3展示统一/bk-资料-resume深链-320.png', fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });

      // 有值 → 空：仍在在线简历 Tab，权威重读后整份简历清空缺失，绝不闪留上一份内容
      甲.candidateResume = null;
      await expect(page.getByText('当前在谈详情数据未提供').first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(P5标记.辛自述长文)).toHaveCount(0);
      await expect(page.getByText('6 年', { exact: true })).toHaveCount(0); // 顶栏画像同步清空

      // 切记录（deep link 直达另一单）：缺失档整页可渲染，不见甲的任何内容
      await page.goto(`/#/hr/candidate/${P5编号.丙一}?tab=resume`);
      await expect(page.getByText('当前在谈详情数据未提供').first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(P5标记.甲职位名)).toHaveCount(0);
      await 断言核心页无横向溢出(page);
    });
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// 卡片统一（2026-09-10）：三类共享列表卡的跨模式布局验收（Plan Task 4 / Spec §8 层次 3/4）。
// 模式无关性已由无 Provider 组件测试证明，这里不重复建；本组用例只看真实页面入口上的
// 展示层几何与可用性：区域 DOM 顺序、相对卡根几何、水平溢出/遮挡、390 与 320 两档宽的
// 完整 / 全空 / 部分空 / 长文本，以及收藏 / 整卡 / 委托 / 滑动的真实点击。
// Mock 与 Backend 的数据本就不相同（P5 缺公司与匹配分），所以跨模式只比固定区位置
// （≤1px），不做全页像素等同，也不为同图扩展 HTTP schema。
// 截图落在 test-results/卡片统一/（Playwright 每轮清理，属一次性观察证据）。
// ─────────────────────────────────────────────────────────────────────────────

/** 单个卡区相对卡根的几何（px，两位小数） */
interface 卡区几何 { x: number; y: number; w: number; h: number }

/** 一张共享卡的观察：区域 DOM 顺序 + 相对卡根几何 + 文字盒（右列让位检查用） */
interface 卡观察 {
  宽: number;
  高: number;
  顺序: string[];
  区域: Record<string, 卡区几何>;
  文字盒: 卡区几何;
  /** 文字盒内文本的实测渲染宽度（Range）；单行省略文本被裁切时以较小者为准 */
  文字宽: number;
}

/** 采集一张卡内全部 data-card-region 相对卡根的坐标/尺寸；文字盒 = 被右列让位约束的
 *  那个文本容器（招聘两卡 = 候选头行根；求职在谈卡 = 公司名/简介列）。 */
async function 采集卡观察(page: Page, 卡: Locator): Promise<卡观察> {
  return 卡.evaluate((根) => {
    const 两位 = (值: number) => Math.round(值 * 100) / 100;
    const 根框 = 根.getBoundingClientRect();
    const 取 = (元素: Element): 卡区几何 => {
      const 框 = 元素.getBoundingClientRect();
      return {
        x: 两位(框.x - 根框.x), y: 两位(框.y - 根框.y), w: 两位(框.width), h: 两位(框.height),
      };
    };
    const 区域: Record<string, 卡区几何> = {};
    const 顺序: string[] = [];
    for (const 元素 of Array.from(根.querySelectorAll('[data-card-region]'))) {
      const 名 = 元素.getAttribute('data-card-region')!;
      顺序.push(名);
      区域[名] = 取(元素);
    }
    const 文字元素 = 根.querySelector('[data-card-region="head"] > div')
      ?? 根.querySelector('[data-card-region="company"] > div:not([data-card-region])');
    let 文字宽 = 0;
    if (文字元素) {
      const 范围 = document.createRange();
      范围.selectNodeContents(文字元素);
      文字宽 = 两位(范围.getBoundingClientRect().width);
    }
    return {
      宽: 两位(根框.width),
      高: 两位(根框.height),
      顺序,
      区域,
      文字盒: 文字元素 ? 取(文字元素) : { x: 0, y: 0, w: 0, h: 0 },
      文字宽,
    };
  });
}

/** 区域 DOM 顺序 = Spec 冻结的阅读顺序 */
function 断言区域顺序(观察: 卡观察, 期待: readonly string[]) {
  expect(观察.顺序, '卡区 DOM 顺序').toEqual(期待);
}

/** 两张卡固定区的相对几何对齐（≤1px）：只比调用方点名的数据等价区；
 *  内含量不同的区（标签高度、阶段区、薪资宽度）由调用方排除或只比 y */
function 断言区域对齐(
  甲: 卡观察,
  乙: 卡观察,
  区域名们: readonly string[],
  键们: readonly ('x' | 'y' | 'r' | 'b')[] = ['x', 'y'],
) {
  const 值 = (区: 卡区几何, 键: 'x' | 'y' | 'r' | 'b') =>
    键 === 'x' ? 区.x : 键 === 'y' ? 区.y : 键 === 'r' ? 区.x + 区.w : 区.y + 区.h;
  for (const 名 of 区域名们) {
    expect(甲.区域[名], `缺少卡区 ${名}`).toBeDefined();
    expect(乙.区域[名], `缺少卡区 ${名}`).toBeDefined();
    for (const 键 of 键们) {
      expect(Math.abs(值(甲.区域[名]!, 键) - 值(乙.区域[名]!, 键)), `固定区 ${名}.${键} 跨模式差`).toBeLessThanOrEqual(1);
    }
  }
}

/** 卡与全部卡区都落在视口/卡根内：无水平溢出、无绝对定位区被裁出卡根 */
async function 断言卡在视口内(page: Page, 卡: Locator) {
  const 观 = await 卡.evaluate((根) => {
    const 根框 = 根.getBoundingClientRect();
    const 区框们 = Array.from(根.querySelectorAll('[data-card-region]')).map((元) => 元.getBoundingClientRect());
    return {
      视口宽: document.documentElement.clientWidth,
      滚动宽: document.documentElement.scrollWidth,
      卡左: 根框.left, 卡右: 根框.right, 卡底: 根框.bottom,
      区左: 区框们.length === 0 ? 根框.left : Math.min(根框.left, ...区框们.map((框) => 框.left)),
      区右: 区框们.length === 0 ? 根框.right : Math.max(根框.right, ...区框们.map((框) => 框.right)),
      区底: 区框们.length === 0 ? 根框.bottom : Math.max(...区框们.map((框) => 框.bottom)),
    };
  });
  expect(观.滚动宽, '页面水平滚动宽').toBeLessThanOrEqual(观.视口宽);
  expect(观.卡右, '卡右缘出视口').toBeLessThanOrEqual(观.视口宽 + 0.5);
  expect(观.区右, '卡区右缘出卡根').toBeLessThanOrEqual(观.卡右 + 0.5);
  expect(观.区左, '卡区左缘出卡根').toBeGreaterThanOrEqual(观.卡左 - 0.5);
  expect(观.区底, '卡区底部出卡根').toBeLessThanOrEqual(观.卡底 + 0.5);
}

/** 右列分数位不被头行/公司行文字挤住或遮住：实际渲染出的文字右缘 ≤ 分数区左缘（容差 1px） */
function 断言分数位让位(观察: 卡观察) {
  expect(观察.区域.score, '缺少分数区').toBeDefined();
  const 文字右缘 = 观察.文字盒.x + Math.min(观察.文字盒.w, 观察.文字宽);
  expect(
    文字右缘,
    `头行文字右缘 ${文字右缘} 应 ≤ 分数区左缘 ${观察.区域.score!.x}`,
  ).toBeLessThanOrEqual(观察.区域.score!.x + 1);
}

/** 候选头行最多两行（Spec §6）：实测文字盒高 ≤ 两行行框（22px × 2 + 容差） */
function 断言头行最多两行(观察: 卡观察) {
  expect(观察.文字盒.h, '头行文字盒高度').toBeLessThanOrEqual(46);
}

/** 占位次要色（Spec §6）：--次要浅 = #7d8276。只有真实浏览器才解析 CSS var，
 *  单测里只能断类名，这里断计算值。 */
const 次要浅色 = 'rgb(125, 130, 118)';
test.describe('卡片统一 Mock 三屏 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('卡片统一 Mock 三屏 390/320：区域顺序、无溢出与整卡点击可用 @mock', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });

    // ── 求职端在谈单：求职在谈卡（完整 Mock 数据）──
    await Mock登录求职(page);
    await hash直达(page, '/#/app');
    const mock在谈卡 = page.getByTestId('求职在谈卡').first();
    await expect(mock在谈卡.getByText('资深后端工程师 · 交易网关')).toBeVisible({ timeout: 15_000 });
    const mock在谈390 = await 采集卡观察(page, mock在谈卡);
    await 断言卡在视口内(page, mock在谈卡);
    断言区域顺序(mock在谈390, ['company', 'score', 'salary', 'title', 'tags', 'stage']);
    断言分数位让位(mock在谈390);
    // 阶段区胶囊落在白卡上同底（透明或白），不另起一块色底
    expect(await mock在谈卡.evaluate((根) => {
      const 标 = 根.querySelector('[data-card-region="stage"] span');
      return 标 ? getComputedStyle(标).backgroundColor : 'missing';
    })).toMatch(/rgba\(0, 0, 0, 0\)|rgb\(255, 255, 255\)/);
    await page.screenshot({ path: 'test-results/卡片统一/mock-在谈-390.png' });
    // 整卡点击 → 在谈详情
    await mock在谈卡.click();
    await expect(page).toHaveURL(/#\/deal\/J-01$/, { timeout: 10_000 });

    // ── 招聘端在谈候选：招聘在谈卡（Mock 数据亮点缺 → 标签占位）──
    await hash直达(page, '/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
    const mock在谈候选卡 = page.getByTestId('招聘在谈卡').first();
    await expect(mock在谈候选卡.getByRole('img', { name: '适配 94 分' })).toBeVisible({ timeout: 15_000 });
    const mock候选390 = await 采集卡观察(page, mock在谈候选卡);
    await 断言卡在视口内(page, mock在谈候选卡);
    断言区域顺序(mock候选390, ['score', 'head', 'work', 'education', 'tags', 'stage']);
    断言分数位让位(mock候选390);
    await expect(mock在谈候选卡.getByText('亮点信息未知')).toBeVisible();
    await page.screenshot({ path: 'test-results/卡片统一/mock-企业在谈候选-390.png' });
    // 整卡点击 → 候选详情
    await mock在谈候选卡.click();
    await expect(page).toHaveURL(/#\/hr\/candidate\/A-01$/, { timeout: 10_000 });

    // ── 招聘端推荐：招聘推荐卡 ──
    await Mock切到招聘推荐(page);
    const mock推荐卡 = page.getByTestId('招聘推荐卡').first();
    await expect(mock推荐卡.getByRole('img', { name: '适配 91 分' })).toBeVisible({ timeout: 15_000 });
    const mock推荐390 = await 采集卡观察(page, mock推荐卡);
    await 断言卡在视口内(page, mock推荐卡);
    断言区域顺序(mock推荐390, ['score', 'head', 'work', 'education', 'tags', 'actions']);
    断言分数位让位(mock推荐390);
    await page.screenshot({ path: 'test-results/卡片统一/mock-推荐-390.png' });
    // 卡主体与 › 都开匿名在线简历；★ 收藏可点
    await mock推荐卡.getByRole('button', { name: '查看候选画像' }).click();
    await expect(page).toHaveURL(/#\/hr\/resume\/R-11$/, { timeout: 10_000 });
    await page.goBack();
    await expect(mock推荐卡.getByRole('img', { name: '适配 91 分' })).toBeVisible({ timeout: 15_000 });
    await mock推荐卡.getByRole('button', { name: '收藏', exact: true }).click();
    await expect(mock推荐卡.getByRole('button', { name: '取消收藏' })).toBeVisible({ timeout: 10_000 });

    // ── 320×844：三屏重新观察（收窄后仍不溢出、分数位让位、头行不超两行）──
    await page.setViewportSize({ width: 320, height: 844 });
    await hash直达(page, '/#/app');
    await expect(page.getByTestId('求职在谈卡').first()).toBeVisible({ timeout: 15_000 });
    await 断言卡在视口内(page, page.getByTestId('求职在谈卡').first());
    断言分数位让位(await 采集卡观察(page, page.getByTestId('求职在谈卡').first()));
    await page.screenshot({ path: 'test-results/卡片统一/mock-在谈-320.png' });
    await hash直达(page, '/#/hr');
    // 上一步把招聘端子视图停在「推荐」：先点回「在谈」再观察在谈卡
    await page.getByRole('button', { name: '在谈', exact: true }).click();
    await expect(page.getByTestId('招聘在谈卡').first()).toBeVisible({ timeout: 15_000 });
    await 断言卡在视口内(page, page.getByTestId('招聘在谈卡').first());
    断言头行最多两行(await 采集卡观察(page, page.getByTestId('招聘在谈卡').first()));
    await page.screenshot({ path: 'test-results/卡片统一/mock-企业在谈候选-320.png' });
    await Mock切到招聘推荐(page);
    await expect(page.getByTestId('招聘推荐卡').first()).toBeVisible({ timeout: 15_000 });
    await 断言卡在视口内(page, page.getByTestId('招聘推荐卡').first());
    断言头行最多两行(await 采集卡观察(page, page.getByTestId('招聘推荐卡').first()));
    await page.screenshot({ path: 'test-results/卡片统一/mock-推荐-320.png' });
  });
});
test.describe('卡片统一 Backend @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('卡片统一 招聘推荐卡两模式固定区几何对齐、390/320 与收藏委托滑动可用 @backend', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await 装P4招聘(page);

    // ── Backend：P4 推荐腿的招聘推荐卡（完整 candidate_summary）──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    const 后端推荐卡 = page.getByTestId('招聘推荐卡').first();
    await expect(后端推荐卡.getByRole('img', { name: '适配 88 分' })).toBeVisible({ timeout: 15_000 });
    const 后端推荐390 = await 采集卡观察(page, 后端推荐卡);
    await 断言卡在视口内(page, 后端推荐卡);
    断言区域顺序(后端推荐390, ['score', 'head', 'work', 'education', 'tags', 'actions']);
    断言分数位让位(后端推荐390);
    await expect(后端推荐卡.getByText(P4标记.summaryWork)).toBeVisible();
    await page.screenshot({ path: 'test-results/卡片统一/backend-推荐-390.png' });

    // ── Mock 同一张卡的完整数据基准（mock/stg origin）：固定区跨模式 ≤1px ──
    await Mock登录求职(page);
    await Mock切到招聘推荐(page);
    const mock推荐卡 = page.getByTestId('招聘推荐卡').first();
    await expect(mock推荐卡.getByRole('img', { name: '适配 91 分' })).toBeVisible({ timeout: 15_000 });
    const mock推荐390 = await 采集卡观察(page, mock推荐卡);
    expect(Math.abs(mock推荐390.宽 - 后端推荐390.宽)).toBeLessThanOrEqual(1);
    断言区域对齐(mock推荐390, 后端推荐390, ['score', 'head', 'work', 'education', 'tags']);

    // ── Backend 委托 / 收藏 / 详情 / 滑动可用性：先点键，最后才滑开（滑开的行吞卡内点击）──
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('http://127.0.0.1:4182/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    await expect(page.getByTestId('招聘推荐卡').first()).toBeVisible({ timeout: 15_000 });
    await 断言卡在视口内(page, page.getByTestId('招聘推荐卡').first());
    断言头行最多两行(await 采集卡观察(page, page.getByTestId('招聘推荐卡').first()));
    await page.screenshot({ path: 'test-results/卡片统一/backend-推荐-320.png' });
    // 委托无确认层：点击立即发起，卡原地长出 accepted 的权威文案，全程无弹层
    await page.locator('button:has-text("让AI代理去聊")').first().click();
    await expect(page.getByText('已提交给 AI，等待处理').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('dialog')).toHaveCount(0);
    // 收藏：星标点亮（服务端先行 PUT）
    await page.getByTestId('招聘推荐卡').first().getByRole('button', { name: '收藏', exact: true }).click();
    await expect(page.getByTestId('招聘推荐卡').first().getByRole('button', { name: '取消收藏' })).toBeVisible({ timeout: 10_000 });
    // › 详情：canonical 双坐标
    await page.getByTestId('招聘推荐卡').first().getByRole('button', { name: '查看候选画像' }).click();
    await expect(page).toHaveURL(
      new RegExp(`#/hr/jobs/${P4编号.recruiterJob}/recommendations/${P4编号.recruiterRecommendation}$`),
      { timeout: 15_000 },
    );
    await page.goBack();
    await expect(page.getByTestId('招聘推荐卡').first()).toBeVisible({ timeout: 15_000 });
    // 真实触屏左滑露出「不合适」
    await 左滑候选卡(page, P4标记.candidateBRing);
    await expect(page.getByRole('button', { name: '不合适' })).toBeVisible({ timeout: 10_000 });
  });

  test('卡片统一 双端在谈卡两模式固定区几何对齐、390/320 与整卡点击可用 @backend', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await 装P5双角色(page, { 主体初始角色: 'candidate' });

    // ── Backend 候选端：求职在谈卡（公司/简介/字标/匹配分 P5 不提供 → 未知占位）──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    const 后端在谈卡 = page.getByTestId('求职在谈卡').first();
    await expect(后端在谈卡.getByRole('img', { name: '匹配分未知' })).toBeVisible({ timeout: 15_000 });
    const 后端在谈390 = await 采集卡观察(page, 后端在谈卡);
    await 断言卡在视口内(page, 后端在谈卡);
    断言区域顺序(后端在谈390, ['company', 'score', 'salary', 'title', 'tags', 'stage']);
    // 未知分说明放在 40px 容器内：右列单行高、不把薪资推下一行、也不压到职位名
    expect(后端在谈390.区域.score!.h, '未知分右列高度').toBeLessThanOrEqual(46);
    expect(
      后端在谈390.区域.score!.y + 后端在谈390.区域.score!.h,
      '未知分右列底缘应不越过职位名顶',
    ).toBeLessThanOrEqual(后端在谈390.区域.title!.y + 1);
    await expect(后端在谈卡.getByText('公司信息未知')).toBeVisible();
    await expect(后端在谈卡.getByText('公司简介未知')).toBeVisible();
    // 卡面沿用原 Mock 展示行为：把 - 换成 –（不改币种/单位/数值）
    await expect(后端在谈卡.getByText(P5标记.薪资带.replace('-', '–'))).toBeVisible();
    await page.screenshot({ path: 'test-results/卡片统一/backend-在谈候选端-390.png' });
    // 320 收窄：还在候选端会话里，先看候选端在谈卡
    await page.setViewportSize({ width: 320, height: 844 });
    await 断言卡在视口内(page, 后端在谈卡);
    断言分数位让位(await 采集卡观察(page, 后端在谈卡));
    // 320 公司列截断实测（记录行为，版式裁定属产品）：卡内容宽 274 − 右列让位 178
    // − 字标 34 − 间距 10 ≈ 52px 文本盒，两行占位文本在 .单行 下都会省略号截断
    const 公司截断 = await 后端在谈卡.evaluate((根) => {
      const 列 = 根.querySelector('[data-card-region="company"] > div:not([data-card-region])');
      if (!列) return [];
      return Array.from(列.children).map((行) => {
        const 元素 = 行 as HTMLElement;
        const 范围 = document.createRange();
        范围.selectNodeContents(元素);
        return {
          文本: (元素.textContent ?? '').slice(0, 6),
          盒宽: Math.round(元素.clientWidth * 100) / 100,
          内容宽: 元素.scrollWidth,
        };
      });
    });
    expect(公司截断).toHaveLength(2);
    for (const 行 of 公司截断) {
      expect(行.盒宽, '320 公司文本盒 ≈52px（274−178−34−10）').toBeLessThan(60);
      expect(行.内容宽, `「${行.文本}…」在 320 宽被省略号截断`).toBeGreaterThan(行.盒宽);
    }
    await page.screenshot({ path: 'test-results/卡片统一/backend-在谈候选端-320.png' });
    await page.setViewportSize({ width: 390, height: 844 });

    // ── Backend 招聘端：招聘在谈卡（candidate_summary 投影 + 未知分占位）──
    await hash直达(page, '/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    const 后端招聘在谈卡 = page.getByTestId('招聘在谈卡').first();
    await expect(后端招聘在谈卡.getByText(P5标记.现职.甲)).toBeVisible({ timeout: 20_000 });
    const 后端招聘在谈390 = await 采集卡观察(page, 后端招聘在谈卡);
    await 断言卡在视口内(page, 后端招聘在谈卡);
    断言区域顺序(后端招聘在谈390, ['score', 'head', 'work', 'education', 'tags', 'stage']);
    断言分数位让位(后端招聘在谈390);
    await expect(后端招聘在谈卡.getByRole('img', { name: '匹配分未知' })).toBeVisible();
    await expect(后端招聘在谈卡.getByText('需要你', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/卡片统一/backend-在谈招聘端-390.png' });
    // 整卡点击 → 候选详情（Case 坐标不变）
    await 后端招聘在谈卡.click();
    await expect(page).toHaveURL(new RegExp(`#/hr/candidate/${P5编号.甲}$`), { timeout: 15_000 });

    // ── Mock 基准（mock/stg origin）：两类在谈卡完整数据，固定区跨模式 ≤1px ──
    await Mock登录求职(page);
    await page.goto(`${Mock源}/#/app`);
    const mock在谈卡 = page.getByTestId('求职在谈卡').first();
    await expect(mock在谈卡.getByText('资深后端工程师 · 交易网关')).toBeVisible({ timeout: 15_000 });
    const mock在谈390 = await 采集卡观察(page, mock在谈卡);
    expect(Math.abs(mock在谈390.宽 - 后端在谈390.宽)).toBeLessThanOrEqual(1);
    // 公司头行/职位名/标签行是固定区；标签条数不同 → 阶段区高度不比
    断言区域对齐(mock在谈390, 后端在谈390, ['company', 'title', 'tags']);
    // 右列绝对定位靠右，宽随薪资文案变：只比 y 与右缘
    断言区域对齐(mock在谈390, 后端在谈390, ['score'], ['y', 'r']);
    // 薪资文本盒高度随字形（「薪」是 CJK 字形，行框更高）而变，不是固定区；
    // 两模式各自查「薪资与环同一行、不越出右列」这一布局事实
    for (const 观 of [mock在谈390, 后端在谈390]) {
      expect(观.区域.salary!.y + 观.区域.salary!.h, '薪资底缘不越出右列').toBeLessThanOrEqual(观.区域.score!.y + 观.区域.score!.h + 1);
    }
    await page.goto(`${Mock源}/#/identity?switch=1&from=app`);
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
    const mock在谈候选卡 = page.getByTestId('招聘在谈卡').first();
    await expect(mock在谈候选卡.getByRole('img', { name: '适配 94 分' })).toBeVisible({ timeout: 15_000 });
    const mock在谈候选390 = await 采集卡观察(page, mock在谈候选卡);
    断言区域对齐(mock在谈候选390, 后端招聘在谈390, ['score', 'head', 'work', 'education', 'tags']);

    // ── 320×844：Mock 招聘端在谈卡重新观察 ──
    await page.setViewportSize({ width: 320, height: 844 });
    await 断言卡在视口内(page, page.getByTestId('招聘在谈卡').first());
    断言头行最多两行(await 采集卡观察(page, page.getByTestId('招聘在谈卡').first()));
    await page.screenshot({ path: 'test-results/卡片统一/backend-在谈招聘端-320.png' });
  });

  test('卡片统一 推荐卡全空/零值/长文本变体 390：占位齐、分数位不被挤、行不收 @backend', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // P4 推荐腿三个变体卡：全空摘要 / 长文本摘要 / 零值分（+ 零年）
    const fixture = P4发现fixture();
    fixture.招聘可用 = {
      [P4编号.recruiterJob]: [
        P4招聘卡({ candidate_summary: null }),
        P4招聘卡({
          recommendation_id: 'rec_e2e_card_unified_long',
          candidate_summary: P4摘要({
            gender: null,
            experience_years: 12,
            job_status: 'unemployed',
            degree: 'P4 Fixture 一段很长很长的学历名称用来验证头行最多两行的截断行为',
            latest_experience: {
              company: 'P4 Fixture 一家公司名称特别长',
              title: '负责超大规模分布式系统与多机房容灾的资深后端工程师',
            },
            latest_education: { institution: 'P4 Fixture 一所名称很长的大学', major: '超长专业名称方向' },
            personal_highlights: ['P4 Fixture 长亮点之一', 'P4 Fixture 长亮点之二'],
          }),
        }),
        P4招聘卡({
          recommendation_id: 'rec_e2e_card_unified_zero',
          match_score: 0,
          candidate_summary: P4摘要({ experience_years: 0, personal_highlights: [], degree: ' ' }),
        }),
      ],
    };
    await 装P4招聘(page, { fixture });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    const 卡们 = page.getByTestId('招聘推荐卡');
    await expect(卡们).toHaveCount(3, { timeout: 15_000 });

    // 全空：五个未知占位齐（亮点行按 Task 5 批准语义给「暂无可展示亮点」），
    // 工作/教育/标签行一个不收
    const 全空卡 = 卡们.nth(0);
    // 头行段外层 span 连着「｜」分隔符：占位文本用子串匹配
    for (const 占位 of ['经验未知', '学历未知', '求职状态未知', '工作经历未知', '教育经历未知']) {
      await expect(全空卡.getByText(占位)).toBeVisible();
    }
    await expect(全空卡.getByText('暂无可展示亮点')).toBeVisible();
    await expect(全空卡.getByRole('img', { name: '性别未知' })).toBeVisible();
    await 断言卡在视口内(page, 全空卡);
    断言分数位让位(await 采集卡观察(page, 全空卡));

    // 长文本：头行最多两行、分数位仍让位；工作/教育行仍在（不收行）
    const 长卡 = 卡们.nth(1);
    await expect(长卡.getByText('工作经历未知')).toHaveCount(0);
    await 断言卡在视口内(page, 长卡);
    const 长观察 = await 采集卡观察(page, 长卡);
    断言分数位让位(长观察);
    断言头行最多两行(长观察);

    // 零值：真实 0 分仍是 0 分环（不是未知占位）；0 年 = 「不满 1 年」；亮点合法空 →
    // 「暂无可展示亮点」（Task 5 批准语义）；纯空白学历（wire 上 degree: ' '）不冒充
    // 已知值 → 「学历未知」占位
    const 零卡 = 卡们.nth(2);
    await expect(零卡.getByRole('img', { name: '适配 0 分' })).toBeVisible();
    await expect(零卡.getByRole('img', { name: '匹配分未知' })).toHaveCount(0);
    await expect(零卡.getByText('不满 1 年')).toBeVisible();
    await expect(零卡.getByText('学历未知')).toBeVisible();
    await expect(零卡.getByText('暂无可展示亮点')).toBeVisible();
    await 断言卡在视口内(page, 零卡);
    await page.screenshot({ path: 'test-results/卡片统一/backend-推荐变体-390.png' });

    // 320 收窄（Spec §8.3：390 与 320 都看长文状态）：长文本卡仍不溢出、
    // 头行最多两行、分数位不被挤
    await page.setViewportSize({ width: 320, height: 844 });
    await 断言卡在视口内(page, 长卡);
    const 长观察320 = await 采集卡观察(page, 长卡);
    断言头行最多两行(长观察320);
    断言分数位让位(长观察320);
    await page.screenshot({ path: 'test-results/卡片统一/backend-推荐变体-320.png' });
  });

  test('卡片统一 在谈卡超长职位名与全空摘要变体 390/320：占位齐、行不收 @backend', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // 候选端首页唯一一行 丁 换超长职位名；招聘端首页唯一一行 甲 摘要显式 null → 全未知占位
    const P5fixture = 创建P5MatchCasefixture();
    P5fixture.cases[P5编号.丁]!.职位名 =
      'P5 Fixture 超长在谈岗位名称用来验证求职在谈卡职位名单行收尾不把标签行挤走';
    P5fixture.cases[P5编号.甲]!.摘要 = null;
    await 装P5双角色(page, { fixture: P5fixture, 主体初始角色: 'candidate' });

    // ── 候选端：超长职位名单行收尾（单行截断），标签行不被挤走 ──
    await hash直达(page, '/#/app');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    const 长职位卡 = page.getByTestId('求职在谈卡').first();
    await expect(长职位卡.getByText(/超长在谈岗位名称/)).toBeVisible({ timeout: 15_000 });
    // 公司名占位 = 次要文字色（Spec §6）：P5 不给公司名，占位不再与真实公司名同色
    expect(await 长职位卡.getByText('公司信息未知').evaluate((元) => getComputedStyle(元).color)).toBe(次要浅色);
    await 断言卡在视口内(page, 长职位卡);
    const 长职位观察 = await 采集卡观察(page, 长职位卡);
    expect(长职位观察.区域.title!.h, '职位名单行高').toBeLessThanOrEqual(30);
    expect(
      长职位观察.区域.tags!.y,
      '标签行仍贴在职位名下方一行的距离内',
    ).toBeLessThanOrEqual(长职位观察.区域.title!.y + 长职位观察.区域.title!.h + 20);
    await page.screenshot({ path: 'test-results/卡片统一/backend-在谈变体-390.png' });

    // 320 收窄（Spec §8.3：长文状态两档宽都看）：超长职位名仍单行收尾、
    // 标签行不被挤走、右列分数位不被遮
    await page.setViewportSize({ width: 320, height: 844 });
    await 断言卡在视口内(page, 长职位卡);
    const 长职位观察320 = await 采集卡观察(page, 长职位卡);
    expect(长职位观察320.区域.title!.h, '职位名单行高(320)').toBeLessThanOrEqual(30);
    断言分数位让位(长职位观察320);
    await page.screenshot({ path: 'test-results/卡片统一/backend-在谈变体-320.png' });
    await page.setViewportSize({ width: 390, height: 844 });

    // ── 招聘端：摘要显式 null = 全未知占位，行与图标一个不少 ──
    await hash直达(page, '/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    const 全空在谈卡 = page.getByTestId('招聘在谈卡').first();
    await expect(全空在谈卡.getByText('工作经历未知')).toBeVisible({ timeout: 20_000 });
    for (const 占位 of ['经验未知', '学历未知', '求职状态未知', '工作经历未知', '教育经历未知', '亮点信息未知']) {
      await expect(全空在谈卡.getByText(占位)).toBeVisible();
    }
    // 头行占位段也走次要文字色（Spec §6）：头行三段占位不再继承头行的 --墨
    expect(await 全空在谈卡.getByText('经验未知').evaluate((元) => getComputedStyle(元).color)).toBe(次要浅色);
    await 断言卡在视口内(page, 全空在谈卡);
    断言分数位让位(await 采集卡观察(page, 全空在谈卡));
    await page.screenshot({ path: 'test-results/卡片统一/backend-在谈招聘端全空-390.png' });

    // 320 收窄：全空在谈卡仍不溢出、头行不超两行
    await page.setViewportSize({ width: 320, height: 844 });
    await 断言卡在视口内(page, page.getByTestId('招聘在谈卡').first());
    断言头行最多两行(await 采集卡观察(page, page.getByTestId('招聘在谈卡').first()));
    await page.screenshot({ path: 'test-results/卡片统一/backend-在谈招聘端全空-320.png' });
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// picker 统一 @picker（Plan 2026-09-14 Task 5）：把 Task 1–4 的真实布局与用户操作
// 固化到两数据模式的实际页面（mock 4181 / fixture 4182，viewport 沿项目
// iPhone 13 390×844，短屏用例显式 844×390）。非目标：不新建测试框架、不拍全站
// 视觉基线、不启动真实后端 —— Backend 全部 API 请求走既有 安装BFF路由 + 用例专用
// 后装目录桩，意外未匹配请求使测试失败；Mock 断言全程零 /api/v1 请求。
//   · 经历行业全屏外壳（editor-catalog-fullscreen Task 3 起，原 72% 底部弹层已换
//     全屏选择外壳）：满高在视口内、列表真滚动（scrollHeight > clientHeight、
//     滚到底最后项可点、回顶可达）、展开两根不抢焦点、重开已选仍在；
//   · 期望行业全页：折叠不丢选中、无推荐区；
//   · 其他底部弹层（薪资）与居中确认框：首开聚焦、Tab 焦点圈、Escape 关闭恢复、
//     弹层不截断；
//   · 岗位城市全页子视图（不换路由、原表单 hidden 键盘不可进、取消保留、保存回填）
//     与岗位月薪双滚轮（确定/取消/精确输入/倒置）；
//   · 就读年份：默认 Mock 2014/2017 原样、显式 2021/2025 种子、空值「请选择」、
//     真实滚动保存与硬刷新恢复、空项刷新不补默认。
// ─────────────────────────────────────────────────────────────────────────────

/** 弹层/页面里的共用折叠目录列表（行业分类列表 根容器，dev 类名含「列表」） */
const picker滚动列表 = (范围: Locator) => 范围.locator('[class*="列表"]').first();

/** 轮询元素矩形完整落在视口内（含 4px 边框/安全区误差）——抽屉升起动画 0.24s 期间
 *  矩形会越界，等动画落定再取值，不在动画中段冒充越界 */
async function picker在视口内(元素: Locator, 宽: number, 高: number): Promise<void> {
  const 截止 = Date.now() + 5_000;
  let 框: { x: number; y: number; width: number; height: number } | null = null;
  for (;;) {
    框 = await 元素.boundingBox().catch(() => null);
    const 值 = 框 === null
      ? -1
      : Math.max(-2 - 框.x, -2 - 框.y, 框.x + 框.width - (宽 + 4), 框.y + 框.height - (高 + 4));
    if (值 <= 0 || Date.now() > 截止) {
      if (值 > 0) {
        throw new Error(
          `弹层超出视口：bbox=${JSON.stringify(框)} 视口=${宽}x${高}（超出 ${值.toFixed(1)}px）`,
        );
      }
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
test.describe('picker 统一 经历行业弹层 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('两根展开不抢焦点→列表滚到底选中→重开已选在 @picker @catalog-fullscreen @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);

    // 日常入口：在线简历 → 添加工作经历 → 打开所属行业层（本地 常见行业 作模拟目录）
    // （公司名称已是合同 C 的公司选择抽屉行，本用例只驱动行业层，不需要公司）
    await hash直达(page, '/#/experience');
    await expect(page.getByRole('button', { name: '＋ 添加工作经历' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加工作经历' }).click();
    await expect(page.getByPlaceholder('必填')).toHaveCount(1);
    await page.getByRole('button', { name: /所属行业/ }).click();
    // editor-catalog-fullscreen Task 3：承载换成全屏选择外壳，可访问名 = 标题「所属行业」，
    // 满高接管（不再 72% 限高），动画落定后取值
    const 弹层 = page.getByRole('dialog', { name: '所属行业' });
    await expect(弹层.getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });

    await expect.poll(async () => (await 弹层.boundingBox())?.height ?? -1, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(((await page.viewportSize()) ?? { height: 0 }).height - 4);
    await picker在视口内(弹层, 390, 844);

    // 展开两根：焦点留在被点的组行上，不抢到首控件（组行整行展开，箭头 ⌄→⌃）
    await 弹层.getByRole('button', { name: /金融科技/ }).click();
    await expect(弹层.getByRole('button', { name: '支付与清结算', exact: true })).toBeVisible({ timeout: 10_000 });
    await 弹层.getByRole('button', { name: /互联网平台/ }).click();
    await expect(弹层.getByRole('button', { name: /互联网平台 ⌃/ })).toBeFocused();

    // 直接定位可滚动列表：scrollHeight > clientHeight
    const 列表 = picker滚动列表(弹层);
    const 尺寸 = await 列表.evaluate((节点) => ({ 滚: 节点.scrollHeight, 可见: 节点.clientHeight }));
    expect(尺寸.滚).toBeGreaterThan(尺寸.可见);

    // 真实滚动到底：最后一项可见且可点击；向上滚回首项可达
    await 列表.evaluate((节点) => { 节点.scrollTop = 节点.scrollHeight; });
    await expect(弹层.getByRole('button', { name: '社交与通讯', exact: true })).toBeVisible();
    await 弹层.getByRole('button', { name: '社交与通讯', exact: true }).click();

    // 单选选定即关闭层，所属行业行回填；重开已选仍在（✓ 由选中行渲染）
    await expect(弹层).toHaveCount(0);
    const 行业行 = page.getByRole('button', { name: /所属行业/ });
    await expect(行业行).toContainText('社交与通讯');
    await 行业行.click();
    const 弹层2 = page.getByRole('dialog', { name: '所属行业' });
    await expect(弹层2.getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });
    await 弹层2.getByRole('button', { name: /互联网平台/ }).click();
    await expect(弹层2.getByRole('button', { name: /社交与通讯 ✓/ })).toBeVisible({ timeout: 10_000 });

    // 向上滚回首项（重入时已选组自动展开，首项是其首个细分）可达；Escape 关闭恢复
    const 列表2 = picker滚动列表(弹层2);
    await 列表2.evaluate((节点) => { 节点.scrollTop = 0; });
    await expect(弹层2.getByRole('button', { name: '电商与交易', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(弹层2).toHaveCount(0);

    // Mock 全程零 API 请求
    expect(apiRequests).toEqual([]);
  });
});
test.describe('picker 统一 经历行业弹层 @backend', () => {
  // 短屏 844×390：面板限高 72%≈280.8px，列表更早内滚；关闭（选叶子/Escape）可达
  test.use({ baseURL: 'http://127.0.0.1:4182', viewport: { width: 844, height: 390 } });

  test('目录展开→短屏列表滚到底选中→重开已选在，Escape 可关 @picker @catalog-fullscreen @backend', async ({ page }) => {
    test.setTimeout(120_000);
    await pickerBackend存量候选(page, 'att-picker-industry');

    // 行业目录桩（本用例专用后装 route）：单页两根 + 每根 8 个可选叶子，撑出内滚
    await page.route('**/api/v1/catalog/industries*', async (route) => {
      const url = new URL(route.request().url());
      const parentId = url.searchParams.get('parent_id');
      if (parentId === 'ind_fin' || parentId === 'ind_net') {
        const 前缀 = parentId === 'ind_fin' ? '支付细分' : '平台细分';
        await route.fulfill({
          status: 200,
          json: 信封({
            items: Array.from({ length: 8 }, (_, 序) => ({
              id: `${parentId}_leaf_${序 + 1}`,
              display_name: `${前缀}${序 + 1}`,
              parent_id: parentId,
              selectable: true,
              has_children: false,
            })),
            next_cursor: null,
            catalog_version: 'ind-v1',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [
            { id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false, has_children: true },
            { id: 'ind_net', display_name: '互联网', parent_id: null, selectable: true, has_children: true },
          ],
          next_cursor: null,
          catalog_version: 'ind-v1',
        }),
      });
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await hash直达(page, '/#/experience');
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加工作经历' }).click();
    await expect(page.getByPlaceholder('必填')).toHaveCount(1);
    await page.getByRole('button', { name: /所属行业/ }).click();
    const 弹层 = page.getByRole('dialog', { name: '所属行业' });
    await expect(弹层.getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });

    // editor-catalog-fullscreen Task 3：全屏外壳满高接管（横屏 844×390 也不再 72% 限高），
    // 动画落定后取值
    await expect.poll(async () => (await 弹层.boundingBox())?.height ?? -1, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(390 - 4);
    await picker在视口内(弹层, 844, 390);

    // 展开两根（第二根是可选根，名称点=选择、独立展开钮展开 —— 点展开钮不选定）
    await 弹层.getByRole('button', { name: /金融科技/ }).click();
    await expect(弹层.getByRole('button', { name: '支付细分1', exact: true })).toBeVisible({ timeout: 10_000 });
    await 弹层.getByRole('button', { name: '展开互联网' }).click();
    await expect(弹层.getByRole('button', { name: '平台细分1', exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(弹层.getByRole('button', { name: '展开互联网' })).toBeFocused();

    // 列表内滚 + 滚到底最后项可点
    const 列表 = picker滚动列表(弹层);
    const 尺寸 = await 列表.evaluate((节点) => ({ 滚: 节点.scrollHeight, 可见: 节点.clientHeight }));
    expect(尺寸.滚).toBeGreaterThan(尺寸.可见);
    await 列表.evaluate((节点) => { 节点.scrollTop = 节点.scrollHeight; });
    await expect(弹层.getByRole('button', { name: '平台细分8', exact: true })).toBeVisible();
    await 弹层.getByRole('button', { name: '平台细分8', exact: true }).click();
    await expect(弹层).toHaveCount(0);
    await expect(page.getByRole('button', { name: /所属行业/ })).toContainText('平台细分8');

    // 重开已选仍在（重新展开后 ✓）；短屏 Escape 关闭可达
    await page.getByRole('button', { name: /所属行业/ }).click();
    const 弹层2 = page.getByRole('dialog', { name: '所属行业' });
    await expect(弹层2.getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });
    await 弹层2.getByRole('button', { name: '展开互联网' }).click();
    await expect(弹层2.getByRole('button', { name: /平台细分8 ✓/ })).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(弹层2).toHaveCount(0);
    // 关闭后行业行仍回填所点行（稳定键 → 显示名；提交断言由核心编辑 简历行业 @backend 覆盖）
    await expect(page.getByRole('button', { name: /所属行业/ })).toContainText('平台细分8');
  });
});
test.describe('picker 统一 期望行业折叠 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('选叶子→折叠不丢选中→无推荐区，保存回显 @picker @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);

    // 「添加求职期望」→ 期望行业行 → 行业子页（共用正文，本地 行业字典 作模拟目录）
    await hash直达(page, '/#/intentions/new');
    await expect(page.getByRole('button', { name: /期望行业/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /期望行业/ }).click();
    await expect(page.getByRole('heading', { name: '已选行业' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('0/3')).toBeVisible();

    // 推荐区已按 Plan 删除：两模式页面都不再出现「推荐」
    await expect(page.getByText('推荐')).toHaveCount(0);

    // 展开金融科技 → 选叶子 1/3
    await page.getByRole('button', { name: /金融科技/ }).click();
    await expect(page.getByRole('button', { name: '支付与清结算', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '支付与清结算', exact: true }).click();
    await expect(page.getByText('1/3')).toBeVisible();

    // 折叠组行：选中不丢（计数仍在、✓ 不依赖可见项），再展开 ✓ 还在
    await page.getByRole('button', { name: /金融科技/ }).click();
    await expect(page.getByRole('button', { name: '支付与清结算', exact: true })).toHaveCount(0);
    await expect(page.getByText('1/3')).toBeVisible();
    await page.getByRole('button', { name: /金融科技/ }).click();
    await expect(page.getByRole('button', { name: /支付与清结算 ✓/ })).toBeVisible({ timeout: 10_000 });

    // 折叠另一个组同样不丢：再选一叶 → 折叠 → 计数 2/3
    await page.getByRole('button', { name: /互联网平台/ }).click();
    await expect(page.getByRole('button', { name: '电商与交易', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '电商与交易', exact: true }).click();
    await expect(page.getByText('2/3')).toBeVisible();
    await page.getByRole('button', { name: /互联网平台/ }).click();
    await expect(page.getByText('2/3')).toBeVisible();

    // 保存（沿原业务：保存只负责返回）→ 行文本回显
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/intentions\/new$/, { timeout: 10_000 });
    await expect(page.getByText('支付与清结算、电商与交易')).toBeVisible({ timeout: 15_000 });

    // Mock 全程零 API 请求
    expect(apiRequests).toEqual([]);
  });
});
test.describe('picker 统一 期望行业折叠 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('目录选叶子→折叠不丢选中→无推荐区，保存回主壳 @picker @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = await pickerBackend存量候选(page, 'att-picker-intent-industry');
    expect(fixture.intentions).toHaveLength(1);

    // industries 目录桩（本用例专用后装 route）：一根（不可选）+ 两个可选叶子
    const 目录请求: string[] = [];
    await page.route('**/api/v1/catalog/industries*', async (route) => {
      const url = new URL(route.request().url());
      目录请求.push('/api/v1/catalog/industries');
      if (url.searchParams.get('parent_id') === 'ind_fin') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [
              { id: 'ind_pay', display_name: '支付与清结算', parent_id: 'ind_fin', selectable: true, has_children: false },
              { id: 'ind_eco', display_name: '电商与交易', parent_id: 'ind_fin', selectable: true, has_children: false },
            ],
            next_cursor: null,
            catalog_version: 'ind-v1',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [{ id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }],
          next_cursor: null,
          catalog_version: 'ind-v1',
        }),
      });
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await hash直达(page, '/#/intentions/industries');
    await expect(page.getByRole('heading', { name: '已选行业' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('0/3')).toBeVisible();

    // 无推荐区
    await expect(page.getByText('推荐')).toHaveCount(0);

    // 展开 → 选叶子 1/3 → 折叠不丢 → 再展开 ✓ 还在
    await page.getByRole('button', { name: /金融科技/ }).last().click();
    await expect(page.getByRole('button', { name: '支付与清结算', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '支付与清结算', exact: true }).click();
    await expect(page.getByText('1/3')).toBeVisible();
    await page.getByRole('button', { name: /金融科技/ }).last().click();
    await expect(page.getByRole('button', { name: '支付与清结算', exact: true })).toHaveCount(0);
    await expect(page.getByText('1/3')).toBeVisible();
    await page.getByRole('button', { name: /金融科技/ }).last().click();
    await expect(page.getByRole('button', { name: /支付与清结算 ✓/ })).toBeVisible({ timeout: 10_000 });

    // 保存（返回）→ 主壳；重入草稿不丢
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await hash直达(page, '/#/intentions/industries');
    await expect(page.getByText('1/3')).toBeVisible({ timeout: 15_000 });

    // 本会话目录请求只打 industries
    expect(目录请求.length).toBeGreaterThan(0);
    expect(目录请求.every((p) => p === '/api/v1/catalog/industries')).toBe(true);
  });
});
test.describe('picker 统一 弹层骨架 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('薪资底部弹层与居中确认框：首开/Tab/Escape/关闭恢复不截断 @picker @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);

    // ── 底部弹层（薪资双滚轮）：添加求职期望 的薪资行 ──
    await hash直达(page, '/#/intentions/new');
    const 薪资行 = page.getByRole('button', { name: /薪资要求/ });
    await expect(薪资行).toBeVisible({ timeout: 15_000 });
    await 薪资行.click();
    const 薪资层 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
    await expect(薪资层).toBeVisible({ timeout: 10_000 });

    // 首开聚焦第一个控件；面板在视口内、确定键完整可见（底层改动不截断）
    await expect(薪资层.getByRole('button', { name: '取消' })).toBeFocused();
    await expect(薪资层.getByRole('button', { name: '确定' })).toBeVisible();
    await picker在视口内(薪资层, 390, 844);

    // Tab 焦点圈在弹层里转；Escape 关闭并恢复焦点到打开它的行
    await page.keyboard.press('Tab');
    const 焦点在薪资层 = await page.evaluate(() =>
      (document.activeElement?.closest('dialog') ?? null) !== null,
    );
    expect(焦点在薪资层).toBe(true);
    await page.keyboard.press('Escape');
    await expect(薪资层).toHaveCount(0);
    await expect(薪资行).toBeFocused();
    await expect(薪资行).toBeVisible();

    // ── 居中确认框（屏蔽名单 解除屏蔽，Mock 演示种子 B-01 锐思数据）：首开在视口中部、Tab/Escape、取消零请求 ──
    //（JD consent 确认层只在 Backend 招聘方会话出现；Mock 选同一骨架的居中解除确认框）
    await hash直达(page, '/#/blocklist');
    const 解除键 = page.getByRole('button', { name: '解除', exact: true }).first();
    await expect(解除键).toBeVisible({ timeout: 15_000 });
    await 解除键.click();
    const 确认框 = page.getByRole('dialog', { name: '解除屏蔽锐思数据' });
    await expect(确认框).toBeVisible({ timeout: 10_000 });
    // 居中面板：上下都不贴边（底部抽屉会贴底，居中框不会）
    const 确认面板 = await 确认框.boundingBox();
    expect(确认面板).not.toBeNull();
    expect(确认面板!.y).toBeGreaterThan(0);
    expect(确认面板!.y + 确认面板!.height).toBeLessThan(844);
    await expect(确认框.getByRole('button', { name: '不解除' })).toBeFocused();
    await page.keyboard.press('Tab');
    const 焦点在确认框 = await page.evaluate(() =>
      (document.activeElement?.closest('dialog') ?? null) !== null,
    );
    expect(焦点在确认框).toBe(true);
    await page.keyboard.press('Escape');
    await expect(确认框).toHaveCount(0);
    // 名单条目保留（取消不解除）
    await expect(page.getByRole('button', { name: '解除', exact: true }).first()).toBeVisible();

    // Mock 全程零 API 请求（确认框取消零 mutation）
    expect(apiRequests).toEqual([]);
  });
});
test.describe('picker 统一 弹层骨架 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('薪资底部弹层与居中确认框：首开/Tab/Escape/关闭恢复不截断 @picker @backend', async ({ page }) => {
    test.setTimeout(180_000);
    // 隐身开关从关起步：employer_privacy_enabled=false（默认 true 会让首次点击直接进确认框）
    await pickerBackend存量候选(page, 'att-picker-sheets', { employer_privacy_enabled: false });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });

    // ── 底部弹层（薪资双滚轮）：添加求职期望 的薪资行；取消零回填 ──
    await hash直达(page, '/#/intentions/new');
    const 薪资行 = page.getByRole('button', { name: /薪资要求/ });
    await expect(薪资行).toBeVisible({ timeout: 15_000 });
    await 薪资行.click();
    const 薪资层 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
    await expect(薪资层).toBeVisible({ timeout: 10_000 });
    await expect(薪资层.getByRole('button', { name: '取消' })).toBeFocused();
    await expect(薪资层.getByRole('button', { name: '确定' })).toBeVisible();
    await picker在视口内(薪资层, 390, 844);
    // 点档直选后取消：零回填（行保持原值），焦点恢复
    await 薪资层.getByRole('listbox', { name: '薪资下限' }).getByRole('option', { name: '40', exact: true }).click();
    await expect(薪资层.getByRole('listbox', { name: '薪资下限' }).getByRole('option', { name: '40', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(薪资层).toHaveCount(0);
    await expect(薪资行).toBeFocused();
    // 取消零回填：行值仍是「请选择薪资要求」
    await expect(薪资行).toContainText('请选择薪资要求');

    // ── 居中确认框：设置页 对现雇主隐身 关闭确认（开关是 role=switch）──
    await hash直达(page, '/#/settings');
    const 隐身开关 = page.getByRole('switch', { name: '对现雇主隐身' });
    await expect(隐身开关).toBeEnabled({ timeout: 15_000 });
    await 隐身开关.click(); // 开（无需确认）
    await expect(隐身开关).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
    // 开启写入后隐私水合会让开关短暂失稳，第二次触发用焦点上的 Enter（真实键盘激活）
    await page.keyboard.press('Enter'); // 关（居中确认框）
    const 确认框 = page.getByRole('dialog', { name: '关闭对现雇主隐身' });
    await expect(确认框).toBeVisible({ timeout: 10_000 });
    const 确认面板 = await 确认框.boundingBox();
    expect(确认面板).not.toBeNull();
    expect(确认面板!.y).toBeGreaterThan(0);
    expect(确认面板!.y + 确认面板!.height).toBeLessThan(844);
    await expect(确认框.getByRole('button', { name: '保持开启' })).toBeFocused();
    await page.keyboard.press('Tab');
    const 焦点在确认框 = await page.evaluate(() =>
      (document.activeElement?.closest('dialog') ?? null) !== null,
    );
    expect(焦点在确认框).toBe(true);
    await page.keyboard.press('Escape');
    await expect(确认框).toHaveCount(0);
    // 关闭恢复：开关仍是开（确认框只是被取消）
    await expect(隐身开关).toHaveAttribute('aria-checked', 'true');
  });
});
test.describe('picker 统一 岗位城市与月薪 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('城市全页子视图与月薪滚轮：确定/取消/精确/倒置，发布零 API @picker @catalog-fullscreen @mock', async ({ page }) => {
    test.setTimeout(180_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);
    await hash直达(page, '/#/hr/post-job');
    await expect(page.getByPlaceholder(/资深后端工程师/)).toBeVisible({ timeout: 15_000 });

    // ── 校招月薪：取消零回填 → 双滚轮点档 → 确定 ──
    await page.getByRole('button', { name: '校园招聘' }).click();
    await page.getByRole('button').filter({ hasText: '职位类别' }).click();
    // editor-catalog-fullscreen Task 1：承载换成全屏选择外壳，可访问名 = 标题「职位类别」
    const 类别弹层 = page.getByRole('dialog', { name: '职位类别' });
    await expect(类别弹层).toBeVisible({ timeout: 10_000 });
    await 类别弹层.getByRole('button', { name: '产品', exact: true }).click();
    await 类别弹层.getByRole('button', { name: '产品经理', exact: true }).click();
    await expect(page.getByRole('button').filter({ hasText: '职位类别' })).toContainText('产品 · 产品经理');
    await page.getByPlaceholder(/资深后端工程师/).fill('选择器统一岗');
    await page.getByRole('button', { name: '现场', exact: true }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByLabel('职位描述').fill('验证岗位城市子视图与月薪滚轮。');
    await page.getByRole('button', { name: '下一步' }).click();
    const 下限键 = page.getByRole('button', { name: '薪资下限' });
    await 下限键.click();
    let 月薪层 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
    await expect(月薪层).toBeVisible({ timeout: 10_000 });
    await expect(月薪层.getByRole('button', { name: '取消' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(月薪层).toHaveCount(0);
    await expect(下限键).toBeFocused();
    await expect(下限键).toContainText('—');
    await 下限键.click();
    await expect(月薪层).toBeVisible({ timeout: 10_000 });
    await 月薪层.getByRole('listbox', { name: '薪资下限' }).getByRole('option', { name: '20', exact: true }).click();
    await 月薪层.getByRole('listbox', { name: '薪资上限' }).getByRole('option', { name: '30', exact: true }).click();
    await 月薪层.getByRole('button', { name: '确定' }).click();
    await expect(月薪层).toHaveCount(0);
    await expect(下限键).toContainText('20');
    await expect(page.getByRole('button', { name: '薪资上限' })).toContainText('30');

    // 返回第一步切回社招（类型切换既有清理会清薪资），描述保留
    await page.getByRole('button', { name: '返回' }).click();
    await page.getByRole('button', { name: '返回' }).click();
    await expect(page.getByRole('button', { name: '校园招聘' })).toBeVisible();
    await page.getByRole('button', { name: '社招全职' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByLabel('职位描述')).toHaveValue('验证岗位城市子视图与月薪滚轮。');
    await page.getByRole('button', { name: '下一步' }).click();

    // ── 社招月薪：精确输入 18/28 → 确定；滚轮倒置被拦不关闭；取消零回填 ──
    await 下限键.click();
    月薪层 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
    await expect(月薪层).toBeVisible({ timeout: 10_000 });
    await 月薪层.getByRole('button', { name: '输入金额' }).click();
    await 月薪层.getByLabel('薪资下限').fill('18');
    await 月薪层.getByLabel('薪资上限').fill('28');
    await 月薪层.getByRole('button', { name: '确定' }).click();
    await expect(月薪层).toHaveCount(0);
    await expect(下限键).toContainText('18');
    await expect(page.getByRole('button', { name: '薪资上限' })).toContainText('28');
    await page.getByRole('button', { name: /年薪月数/ }).click();
    await page.getByRole('button', { name: '确定' }).click();
    await page.getByLabel('岗位要求').fill('三年以上产品经验，带过完整上线周期');
    // 倒置：上限 < 下限，确定被拦、弹层不关
    await 下限键.click();
    月薪层 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
    await expect(月薪层).toBeVisible({ timeout: 10_000 });
    await 月薪层.getByRole('listbox', { name: '薪资下限' }).getByRole('option', { name: '40', exact: true }).click();
    await 月薪层.getByRole('listbox', { name: '薪资上限' }).getByRole('option', { name: '20', exact: true }).click();
    await 月薪层.getByRole('button', { name: '确定' }).click();
    await expect(月薪层.getByText('薪资下限不能高于上限')).toBeVisible();
    await 月薪层.getByRole('button', { name: '取消' }).click();
    await expect(月薪层).toHaveCount(0);
    await expect(下限键).toContainText('18');
    await expect(page.getByRole('button', { name: '薪资上限' })).toContainText('28');

    // ── 工作城市：全页本地子视图（不换路由、原表单 hidden、取消保留、保存回填）──
    const 城市行 = page.getByRole('button').filter({ hasText: '工作城市' });
    const 键集前 = await page.evaluate(() => Object.keys(localStorage).sort());
    await 城市行.click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/);
    await expect(page.getByRole('heading', { name: '选择工作城市' })).toBeVisible({ timeout: 10_000 });
    // 原表单整体 hidden（display:none）：键盘无法进入
    await expect(下限键).toBeHidden();
    // Tab 只在子视图正文里转
    await page.getByPlaceholder('搜索城市 / 省份').focus();
    await page.keyboard.press('Tab');
    const 焦点在子视图 = await page.evaluate(() =>
      (document.activeElement?.closest('[class*="选择正文"]') ?? null) !== null,
    );
    expect(焦点在子视图).toBe(true);
    // 取消保留：Escape 关闭、行仍是「请选择」、焦点回城市行
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: '选择工作城市' })).toHaveCount(0);
    await expect(城市行).toContainText('请选择');
    await expect(城市行).toBeFocused();
    // 重开 → 选上海 → 保存回填；不导航候选 route、不写候选草稿
    await 城市行.click();
    await expect(page.getByRole('heading', { name: '选择工作城市' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '上海市', exact: true }).first().click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(城市行).toContainText('上海');
    await expect(page).toHaveURL(/#\/hr\/post-job$/);
    const 键集后 = await page.evaluate(() => Object.keys(localStorage).sort());
    expect(键集后).toEqual(键集前);

    // 保存后重开子视图：已选 chip 回显、保存可用（Spec §4.3/§6 两模式同已选状态）；
    // 取消关闭不改岗位行
    await 城市行.click();
    await expect(page.getByRole('heading', { name: '选择工作城市' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '上海市 ✕' })).toBeVisible();
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: '选择工作城市' })).toHaveCount(0);
    await expect(城市行).toContainText('上海');

    // 发布：办公地点（现场必填）+ 确认门勾选（Spec §5.4 两模式共用）→ 岗位带城市上屏
    await page.getByPlaceholder(/浦东新区世纪大道/).fill('浦东新区张江路 1 号');
    await page.getByRole('checkbox', { name: /我已确认经验和学历设置将作为自动匹配依据/ }).check();
    await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
    await expect(page.getByText('选择器统一岗')).toBeVisible({ timeout: 15_000 });
    // 发布结果带滚轮设置的原金额：编辑回读该岗第三步，薪资选择行为 18/28（Mock 零 API
    // 无 POST body 可断言，岗位列表卡不渲染薪资带 —— 以编辑回读作存证）
    await hash直达(page, '/#/hr/post-job/P-05');
    await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue('选择器统一岗', { timeout: 15_000 });
    await page.getByRole('button', { name: '职位要求' }).click();
    await expect(下限键).toContainText('18', { timeout: 10_000 });
    await expect(page.getByRole('button', { name: '薪资上限' })).toContainText('28');
    expect(apiRequests).toEqual([]);
  });
});
test.describe('picker 统一 岗位城市与月薪 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('城市子视图保存发布捕获 location_id，滚轮 50/65 @picker @backend', async ({ page }) => {
    test.setTimeout(240_000);
    const 请求们: { path: string; method: string; body: unknown }[] = [];
    // 全新招聘方 onboarding fixture（与 招聘方 onboarding Backend fixture 同口径；
    // P1C 存量组织会话在当前候选上名片水合会弹回身份页，本用例只发新岗）。
    // 隐私域给默认组织搜索池：合同 C 的公司选择抽屉要从池里按 ID 选企业。
    const 隐私池 = P3隐私fixture();
    隐私池.组织库 = P3默认组织库();
    await 安装BFF路由(page, {
      登录尝试id: 'att-picker-job-city',
      记录目录请求: () => undefined,
      主体初始角色: null,
      请求拦截: ({ path, method, body }) => 请求们.push({ path, method, body }),
      招聘方OnboardingFixture: 创建招聘方OnboardingFixture(),
      隐私fixture: 隐私池,
    });

    // 新招聘方 onboarding 同链：名片首写（公司走合同 C 公司选择抽屉）→ 发岗向导
    await page.goto('/');
    await expect(page.getByRole('button', { name: '我要招人' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '我要招人' }).click();
    await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 20_000 });
    await page.getByLabel('姓名').fill('林澈');
    await page.getByLabel('职务').fill('招聘负责人');
    await page.getByRole('button', { name: '未选择公司' }).click();
    const 企业抽屉 = page.getByRole('dialog', { name: '选择企业' });
    await expect(企业抽屉).toBeVisible({ timeout: 10_000 });
    await 企业抽屉.getByPlaceholder('输入公司名称').fill('Fixture 磐石');
    const 磐石行 = 企业抽屉.getByRole('button', { name: P3标记.手动组织甲 });
    await expect(磐石行).toBeVisible({ timeout: 10_000 });
    await 磐石行.click();
    await expect(企业抽屉).toHaveCount(0);
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/, { timeout: 20_000 });

    // ── 第一步：类别（fixture 目录单根，左根右叶同名）+ 名称 + 办公方式 ──
    await page.getByPlaceholder(/资深后端工程师/).waitFor({ state: 'attached' });
    const 职位类别行 = page.getByRole('button').filter({ hasText: '职位类别' });
    await 职位类别行.click();
    const 类键 = page.getByRole('button', { name: 标记.职位display, exact: true });
    await expect(类键.first()).toBeVisible({ timeout: 10_000 });
    await 类键.first().click();
    await expect(类键).toHaveCount(2, { timeout: 10_000 });
    await 类键.last().click();
    await expect(职位类别行).toContainText(标记.职位display.trim());
    await page.getByPlaceholder(/资深后端工程师/).fill('选择器统一岗');
    await page.getByRole('button', { name: '混合', exact: true }).click();
    await page.getByRole('button', { name: '下一步' }).click();

    await page.getByLabel('职位描述').fill('验证岗位城市子视图与月薪滚轮。');
    await page.getByRole('button', { name: '下一步' }).click();

    // ── 第三步：月薪双滚轮 50/65 → 年薪月数 ──
    const 下限键 = page.getByRole('button', { name: '薪资下限' });
    await 下限键.click();
    const 月薪层 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
    await expect(月薪层).toBeVisible({ timeout: 10_000 });
    await 月薪层.getByRole('listbox', { name: '薪资下限' }).getByRole('option', { name: '50', exact: true }).click();
    await 月薪层.getByRole('listbox', { name: '薪资上限' }).getByRole('option', { name: '65', exact: true }).click();
    await 月薪层.getByRole('button', { name: '确定' }).click();
    await expect(月薪层).toHaveCount(0);
    await expect(下限键).toContainText('50');
    await expect(page.getByRole('button', { name: '薪资上限' })).toContainText('65');
    await page.getByRole('button', { name: /年薪月数/ }).click();
    await page.getByRole('button', { name: '确定' }).click();

    // ── 工作城市：全页子视图（不换路由、原表单 hidden、取消保留、搜索候选保存）──
    const 城市行 = page.getByRole('button').filter({ hasText: '工作城市' });
    await 城市行.click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/);
    await expect(page.getByRole('heading', { name: '选择工作城市' })).toBeVisible({ timeout: 10_000 });
    await expect(下限键).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(城市行).toContainText('请选择');
    await expect(城市行).toBeFocused();
    await 城市行.click();
    const 城市搜索 = page.getByPlaceholder('搜索城市 / 省份');
    await expect(城市搜索).toBeVisible({ timeout: 10_000 });
    await 城市搜索.fill('fixture');
    const 城市片 = page.getByRole('button', { name: 标记.城市display, exact: true });
    await expect(城市片.first()).toBeVisible({ timeout: 10_000 });
    await 城市片.first().click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(城市行).toContainText(标记.城市display.trim());
    await expect(page).toHaveURL(/#\/hr\/post-job$/);

    // ── 发布：合同 C 企业坐标（direct 用人企业行）→ 确认门 → POST 带 地点引用 ──
    const 用人企业行 = page.getByRole('button', { name: /用人企业/ });
    await 用人企业行.click();
    const 用人抽屉 = page.getByRole('dialog', { name: '选择企业' });
    await expect(用人抽屉).toBeVisible({ timeout: 10_000 });
    await 用人抽屉.getByPlaceholder('输入公司名称').fill('Fixture 磐石');
    await 用人抽屉.getByRole('button', { name: P3标记.手动组织甲 }).click();
    await expect(用人抽屉).toHaveCount(0);
    await page.getByPlaceholder(/浦东新区世纪大道/).fill('Fixture 市 Fixture 路 1 号');
    await page.getByLabel('岗位要求').fill('三年以上后端经验，熟悉交易系统');
    await page.getByRole('checkbox', { name: /我已确认经验和学历设置将作为自动匹配依据/ }).check();
    await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    const 岗位写入 = 请求们.filter((项) => 项.method === 'POST' && 项.path === '/api/v1/recruiter/jobs');
    expect(岗位写入).toHaveLength(1);
    expect(岗位写入[0]!.body).toMatchObject({
      location_id: 'loc-fixture-001',
      title: '选择器统一岗',
      // 本用例刚用滚轮设置的原金额（转岗位创建 body 键 salary: {lower, upper}）
      salary: { lower: 50, upper: 65 },
    });
    // 城市子视图全程停在发岗 route，没有导航到候选 onboarding
    expect(请求们.every((项) => !项.path.includes('/onboard/'))).toBe(true);
  });
});
test.describe('picker 统一 就读年份 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('默认2014/2017原样直接继续；显式2021/2025种子；空值点档与刷新 @picker @mock', async ({ page }) => {
    test.setTimeout(240_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });
    const 简历键 = 'AGXP简历v3:mock:stg:demo';
    const 写缓存 = (教育: Record<string, string>) =>
      page.evaluate(([键, 段]) => {
        localStorage.setItem(键, JSON.stringify({
          经历: [],
          教育: [段],
          技能: [],
          证书: [],
          基本信息: { 真名: '演示', 开始工作年: '2021', 身份: '在校' },
        }));
        location.hash = '#/onboard/eduyears';
      }, [简历键, 教育]);

    // 1) 默认 Mock 会话（不注入教育 fixture）：既有样例 2014/2017 原样优先，直接继续
    //    （bottom-drawer 统一 Task 4：档位断言经共用年份抽屉，取消零写入后直接下一步）
    await pickerMock登录(page);
    await hash直达(page, '/#/onboard/eduyears');
    await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible({ timeout: 15_000 });
    const 入口行 = page.getByRole('button', { name: '入学年和毕业年' });
    await expect(入口行).toContainText('2014');
    await expect(入口行).toContainText('2017');
    await 入口行.click();
    const 年抽屉 = page.getByRole('dialog', { name: '就读时间段' });
    await expect(年抽屉.getByRole('listbox', { name: '入学年' }).getByRole('option', { name: '2014', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(年抽屉.getByRole('listbox', { name: '毕业年' }).getByRole('option', { name: '2017', exact: true })).toHaveAttribute('aria-selected', 'true');
    await 年抽屉.getByRole('button', { name: '取消' }).click();
    await expect(年抽屉).toHaveCount(0);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/experience$/, { timeout: 15_000 });

    // 2) 显式 Mock 2021/2025 演示数据（种子形态缓存）：入口行停在种子档，直接继续
    await 写缓存({ 编号: 'edu1', 学校: '演示大学', 学历: '本科', 专业: '演示专业', 开始: '2021-09', 结束: '2025-06' });
    await page.reload();
    await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '入学年和毕业年' })).toContainText('2021');
    await expect(page.getByRole('button', { name: '入学年和毕业年' })).toContainText('2025');
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/experience$/, { timeout: 15_000 });

    // 3) 空值「请选择」：硬刷新不补默认；抽屉点档确认成功并保存
    await 写缓存({ 编号: 'edu1', 学校: '演示大学', 学历: '本科', 专业: '演示专业', 开始: '', 结束: '' });
    await page.reload();
    await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '入学年和毕业年' })).toContainText('请选择');
    await page.reload();
    await expect(page.getByRole('button', { name: '入学年和毕业年' })).toContainText('请选择');
    // 点下一步被拦（两侧都空）
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByText('请选择入学时间和毕业时间')).toBeVisible();
    // 抽屉空档选中；点档 2021 / 2025 确认回填入口行
    await page.getByRole('button', { name: '入学年和毕业年' }).click();
    const 年抽屉3 = page.getByRole('dialog', { name: '就读时间段' });
    await expect(年抽屉3.getByRole('listbox', { name: '入学年' }).getByRole('option', { name: '请选择', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(年抽屉3.getByRole('listbox', { name: '毕业年' }).getByRole('option', { name: '请选择', exact: true })).toHaveAttribute('aria-selected', 'true');
    await 年抽屉3.getByRole('listbox', { name: '入学年' }).getByRole('option', { name: '2021', exact: true }).click();
    await 年抽屉3.getByRole('listbox', { name: '毕业年' }).getByRole('option', { name: '2025', exact: true }).click();
    await 年抽屉3.getByRole('button', { name: '确定' }).click();
    await expect(年抽屉3).toHaveCount(0);
    await expect(page.getByRole('button', { name: '入学年和毕业年' })).toContainText('2021');
    // 抽屉确认改 2022 → 下一步保存（Mock 模式 简历教育 变更经 资料持久化
    // 自动落盘 AGXP简历v3，无测试侧 reseed）→ 硬刷新沿应用自己存盘的值恢复
    await page.getByRole('button', { name: '入学年和毕业年' }).click();
    const 年抽屉4 = page.getByRole('dialog', { name: '就读时间段' });
    await 年抽屉4.getByRole('listbox', { name: '入学年' }).getByRole('option', { name: '2022', exact: true }).click();
    await 年抽屉4.getByRole('button', { name: '确定' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/experience$/, { timeout: 15_000 });
    // 消费应用自己落盘的值：存盘后缓存里应有 2022-09（不是测试注入的）
    await expect.poll(() => page.evaluate(() => localStorage.getItem('AGXP简历v3:mock:stg:demo') ?? ''), { timeout: 10_000 })
      .toContain('2022-09');
    // 硬刷新回就读时间段（只改 hash，不再 reseed 缓存）
    await page.evaluate(() => { location.hash = '#/onboard/eduyears'; });
    await page.reload();
    await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible({ timeout: 15_000 });
    const 回读入口 = page.getByRole('button', { name: '入学年和毕业年' });
    await expect(回读入口).toContainText('2022');
    await expect(回读入口).toContainText('2025');

    // Mock 全程零 API 请求
    expect(apiRequests).toEqual([]);
  });
});
test.describe('picker 统一 就读年份 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('空值请选择→点档/真实滚动→硬刷新沿草稿恢复→选空不补默认 @picker @catalog-fullscreen @backend', async ({ page }) => {
    test.setTimeout(240_000);
    const fixture = 创建候选OnboardingFixture();
    await 安装BFF路由(page, {
      记录目录请求: () => {},
      登录尝试id: 'att-picker-eduyears',
      候选OnboardingFixture: fixture,
      隐私fixture: P3隐私fixture(),
    });

    // 期望职位页（Task 7 B 契约）需要真实三级目录：装用例专用桩（不改共用 fixture）
    await 装三级职位目录桩(page);

    // ── 新候选旅程走到就读时间段（建档草稿在途）──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/, { timeout: 30_000 });
    await page.getByRole('button', { name: '已毕业' }).click();
    // Backend（Task 5B）身份选择不虚构偏好：主要求职类型要显式点一枚
    await page.getByRole('button', { name: '社招全职' }).click();
    await expect(page.getByRole('button', { name: '社招全职' })).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
    await page.getByRole('button', { name: '选择工作城市' }).click();
    await expect(page).toHaveURL(/#\/onboard\/city$/);
    await page.getByPlaceholder('搜索城市 / 省份').fill('fixture');
    await expect(page.getByRole('button', { name: 标记.城市display, exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 标记.城市display, exact: true }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/student$/);
    await page.getByRole('button', { name: '选择期望职位' }).click();
    await expect(page).toHaveURL(/#\/onboard\/job$/);
    // editor-catalog-fullscreen Task 7（B 契约）：左栏一级导航 + 右组三级叶子；
    // 挂载自动选首根后右栏叶子直接出现（不再是旧两栏的左右两枚同名按钮）。
    // display 带前导空格，可访问名按空白归一，这里不再用 exact。
    const 职位键 = page.getByRole('button', { name: 标记.职位display });
    await expect(职位键.first()).toBeVisible({ timeout: 10_000 });
    await expect(职位键).toHaveCount(1, { timeout: 10_000 });
    await 职位键.click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/student$/);
    await page.getByRole('button', { name: '混合' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/wizard\?stage=salary$/, { timeout: 15_000 });
    await 走向导薪资(page);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/basic$/, { timeout: 15_000 });
    await page.getByPlaceholder('身份证上的名字').fill('Fixture 候选人');
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/onboard\/status$/, { timeout: 15_000 });
    await page.getByRole('button', { name: '在职 · 考虑机会' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/onboard\/degree$/, { timeout: 15_000 });
    await page.getByRole('button', { name: '本科' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/onboard\/school$/, { timeout: 15_000 });
    await page.getByPlaceholder('学校名称').fill('fixture');
    await expect(page.getByText(标记.学校display)).toBeVisible({ timeout: 10_000 });
    await page.getByText(标记.学校display).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/onboard\/major$/, { timeout: 15_000 });
    await page.getByPlaceholder('专业名称').fill('fixture');
    await expect(page.getByRole('button', { name: 标记.专业display, exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 标记.专业display, exact: true }).click();
    await page.getByRole('button', { name: '下一步' }).click();

    // ── 就读时间段：Backend 空教育 → 入口行两侧「请选择」（bottom-drawer 统一 Task 4：
    //    档位断言与点档都经共用年份抽屉；确定才原子写建档草稿）──
    await expect(page).toHaveURL(/#\/onboard\/eduyears$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible();
    const 入口行 = page.getByRole('button', { name: '入学年和毕业年' });
    await expect(入口行).toContainText('请选择', { timeout: 10_000 });

    // 空值真相检查在前：下一步被拦
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByText('请选择入学时间和毕业时间')).toBeVisible();

    // 抽屉两侧都停在「请选择」空档；点档 2021/2025 确定才回填
    await 入口行.click();
    const 年抽屉 = page.getByRole('dialog', { name: '就读时间段' });
    await expect(年抽屉.getByRole('listbox', { name: '入学年' }).getByRole('option', { name: '请选择', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(年抽屉.getByRole('listbox', { name: '毕业年' }).getByRole('option', { name: '请选择', exact: true })).toHaveAttribute('aria-selected', 'true');
    await 年抽屉.getByRole('listbox', { name: '入学年' }).getByRole('option', { name: '2021', exact: true }).click();
    await 年抽屉.getByRole('listbox', { name: '毕业年' }).getByRole('option', { name: '2025', exact: true }).click();
    await 年抽屉.getByRole('button', { name: '确定' }).click();
    await expect(年抽屉).toHaveCount(0);
    await expect(入口行).toContainText('2021');
    await expect(入口行).toContainText('2025');

    // 硬刷新：沿建档草稿恢复（草稿随抽屉确定落盘）
    await page.reload();
    await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible({ timeout: 30_000 });
    const 刷新入口 = page.getByRole('button', { name: '入学年和毕业年' });
    await expect(刷新入口).toContainText('2021', { timeout: 15_000 });
    await expect(刷新入口).toContainText('2025');

    // 抽屉选空档清空毕业年（草稿原子写回空）→ 硬刷新仍为空，不补 2021/2025 默认
    await 刷新入口.click();
    const 清空抽屉 = page.getByRole('dialog', { name: '就读时间段' });
    await 清空抽屉.getByRole('listbox', { name: '毕业年' }).getByRole('option', { name: '请选择', exact: true }).click();
    await 清空抽屉.getByRole('button', { name: '确定' }).click();
    await expect(清空抽屉).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible({ timeout: 30_000 });
    const 清空入口 = page.getByRole('button', { name: '入学年和毕业年' });
    await expect(清空入口).toContainText('2021', { timeout: 15_000 });
    await expect(清空入口).toContainText('请选择');

    // 补上毕业年 → 直接继续；education POST 带抽屉确认保存的起止
    await 清空入口.click();
    const 补齐抽屉 = page.getByRole('dialog', { name: '就读时间段' });
    await 补齐抽屉.getByRole('listbox', { name: '毕业年' }).getByRole('option', { name: '2025', exact: true }).click();
    await 补齐抽屉.getByRole('button', { name: '确定' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/experience$/, { timeout: 20_000 });
    const 教育写入 = fixture.mutations.filter(
      (条) => 条.method === 'POST' && 条.path === '/api/v1/me/resume/educations',
    );
    expect(教育写入.length).toBeGreaterThan(0);
    expect(教育写入[0]!.body).toMatchObject({ start_month: '2021-09', end_month: '2025-06' });
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// catalog-fullscreen（editor-catalog-fullscreen Task 8）：五个全屏选择入口
// （发布岗位「职位类别」、教育承载「选择学校」/「选择专业」、经历「所属行业」、
// 公司档案基本信息「选择行业」）换 全屏选择外壳 后的定向浏览器回归，外加期望职位
// B 契约正文（期望职位选择正文）的整页布局回归。DOM/jsdom 证明不了的整页几何在这里断言：
// dialog 满高充满应用可用区、父表单 hidden 后字段不可聚焦、首焦点在返回键、
// Tab/Shift+Tab 限于壳内、Escape/返回可用、关闭后无弹层遮罩残留、页面本身零滚动
// （无双滚动：滚动只发生在层内列表）；320×568 短屏与 844×390 横屏下长候选滚到底。
// Mock 全程零 /api/v1；Backend 目录桩为用例专用后装 route（真实三级结构，不改共用
// fixture），取消/选择子页零资源 mutation，最终资源写入捕获请求里的原目录 ID。
// ─────────────────────────────────────────────────────────────────────────────

/** 全屏外壳几何：bbox 完整落在视口内（动画落定）且满高满宽（4px 边框/取整误差）。
 *  期望尺寸取自当前项目视口（iPhone 13 项目默认可见视口 390×664；显式 use 的
 *  用例按 390×844 / 320×568 / 844×390 字面口径），不写死常数。 */
async function 断言全屏外壳(page: Page, 弹层: Locator): Promise<void> {
  const 视口 = (await page.viewportSize())!;
  await picker在视口内(弹层, 视口.width, 视口.height);
  const 盒 = await 弹层.boundingBox();
  expect(盒!.height).toBeGreaterThanOrEqual(视口.height - 4);
  expect(盒!.width).toBeGreaterThanOrEqual(视口.width - 4);
}

/** 双滚动检查：页面本身不允许滚动（body overflow hidden 是全局约定），
 *  滚动只发生在屏幕内 .滚动区 / 全屏外壳的层内列表 */
async function 断言页面零滚动(page: Page): Promise<void> {
  const 溢出 = await page.evaluate(() => ({
    横: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    竖: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  expect(溢出.横).toBeLessThanOrEqual(2);
  expect(溢出.竖).toBeLessThanOrEqual(2);
}

/** 当前焦点是否在某个 role=dialog 之内（Tab 焦点圈限于壳内的浏览器级证据） */
const 焦点在弹层内 = (page: Page) =>
  page.evaluate(() => (document.activeElement?.closest('[role="dialog"]') ?? null) !== null);
test.describe('catalog-fullscreen 全屏外壳 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181', viewport: { width: 390, height: 844 } });

  test('四入口（职位类别/选择学校/选择专业/所属行业）：进入充满可用区、父字段不可聚焦、取消重开选择保草稿 @catalog-fullscreen @mock', async ({ page }) => {
    test.setTimeout(240_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);

    // ── 1) 发布岗位「职位类别」：先填其它字段 → 滚到入口 → 进入 ──
    await hash直达(page, '/#/hr/post-job');
    const 职位名称输入 = page.getByPlaceholder(/资深后端工程师/);
    await expect(职位名称输入).toBeVisible({ timeout: 15_000 });
    await 职位名称输入.fill('全屏草稿岗');
    await page.evaluate(() => {
      const 区 = document.querySelector('.滚动区') as HTMLElement | null;
      if (区) 区.scrollTop = 区.scrollHeight;
    });
    const 打开前滚动 = await page.evaluate(() => (document.querySelector('.滚动区') as HTMLElement | null)?.scrollTop ?? -1);
    const 职位类别行 = page.getByRole('button').filter({ hasText: '职位类别' });
    await 职位类别行.click();
    const 类别层 = page.getByRole('dialog', { name: '职位类别' });
    await expect(类别层.getByRole('button', { name: '产品', exact: true })).toBeVisible({ timeout: 10_000 });
    // 全屏几何：dialog 充满应用可用区（390×844），页面本身零滚动
    await 断言全屏外壳(page, 类别层);
    await 断言页面零滚动(page);
    // 父表单 hidden 保挂载：其它字段不可见不可聚焦；首焦点在返回键；Tab 限于壳内
    await expect(职位名称输入).toBeHidden();
    await expect(类别层.getByRole('button', { name: '返回' })).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await 焦点在弹层内(page)).toBe(true);
    // Escape 取消：层关、焦点/滚动/其它字段值都保留、无弹层遮罩残留
    await page.keyboard.press('Escape');
    await expect(类别层).toHaveCount(0);
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect(page.locator('[class*="遮罩"]')).toHaveCount(0);
    await expect(职位名称输入).toBeVisible();
    await expect(职位名称输入).toHaveValue('全屏草稿岗');
    await expect(职位类别行).toBeFocused();
    expect(await page.evaluate(() => (document.querySelector('.滚动区') as HTMLElement | null)?.scrollTop ?? -1))
      .toBe(打开前滚动);
    // 重开 → 选择 → 自动回填并关闭；再开选中勾在
    await 职位类别行.click();
    await expect(类别层).toBeVisible();
    await 类别层.getByRole('button', { name: '产品', exact: true }).click();
    await 类别层.getByRole('button', { name: '产品经理', exact: true }).click();
    await expect(类别层).toHaveCount(0);
    await expect(职位类别行).toContainText('产品 · 产品经理');
    await 职位类别行.click();
    await expect(类别层.getByRole('button', { name: /产品经理\s*✓/ })).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(类别层).toHaveCount(0);

    // ── 2) 教育承载「选择学校」/「选择专业」 ──
    await hash直达(page, '/#/experience');
    await expect(page.getByRole('button', { name: '＋ 添加教育经历' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加教育经历' }).click();
    await expect(page.getByText('学校名称')).toBeVisible({ timeout: 10_000 });
    const 学校行 = page.getByRole('button').filter({ hasText: '学校名称' });
    await 学校行.click();
    const 学校层 = page.getByRole('dialog', { name: '选择学校' });
    await expect(学校层.getByPlaceholder('搜索学校名称')).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 学校层);
    await expect(学校层.getByRole('button', { name: '返回' })).toBeFocused();
    // 取消（返回键）：草稿不变、焦点回触发行
    await 学校层.getByRole('button', { name: '返回' }).click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toBeFocused();
    // 重开 → 搜索 → 选候选 → 行回填且层收起
    await 学校行.click();
    await expect(page.getByRole('dialog', { name: '选择学校' }).getByPlaceholder('搜索学校名称')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('dialog', { name: '选择学校' }).getByPlaceholder('搜索学校名称').fill('大学');
    await page.getByRole('dialog', { name: '选择学校' }).getByRole('button', { name: '清华大学', exact: true }).click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toContainText('清华大学');
    const 专业行 = page.getByRole('button').filter({ hasText: '专业' }).first();
    await 专业行.click();
    const 专业层 = page.getByRole('dialog', { name: '选择专业' });
    await expect(专业层.getByPlaceholder('搜索专业名称')).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 专业层);
    await 专业层.getByPlaceholder('搜索专业名称').fill('工程');
    await 专业层.getByRole('button', { name: '软件工程', exact: true }).click();
    await expect(专业层).toHaveCount(0);
    await expect(专业行).toContainText('软件工程');
    // 教育编辑页与经历列表同属 /#/experience 路由（goto 同址不会重挂）：取消回列表
    await page.getByRole('button', { name: '返回' }).click();
    await expect(page.getByRole('button', { name: '＋ 添加工作经历' })).toBeVisible({ timeout: 15_000 });

    // ── 3) 经历「所属行业」：先填职位 → Escape 取消零选择 → 重开选细分 ──
    await hash直达(page, '/#/experience');
    await expect(page.getByRole('button', { name: '＋ 添加工作经历' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加工作经历' }).click();
    await expect(page.getByPlaceholder('必填')).toHaveCount(1);
    await page.getByPlaceholder('必填').fill('全屏草稿工程师');
    await page.getByRole('button', { name: '所属行业' }).click();
    const 行业层 = page.getByRole('dialog', { name: '所属行业' });
    await expect(行业层.getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 行业层);
    await expect(page.getByPlaceholder('必填')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(行业层).toHaveCount(0);
    await expect(page.getByPlaceholder('必填')).toHaveValue('全屏草稿工程师');
    await page.getByRole('button', { name: '所属行业' }).click();
    await expect(page.getByRole('dialog', { name: '所属行业' }).getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('dialog', { name: '所属行业' }).getByRole('button', { name: /金融科技/ }).click();
    await page.getByRole('dialog', { name: '所属行业' }).getByRole('button', { name: '支付与清结算', exact: true }).click();
    await expect(行业层).toHaveCount(0);
    await expect(page.getByRole('button', { name: /所属行业/ })).toContainText('支付与清结算');

    // Mock 全程零 /api/v1 请求（不发任何 Backend 目录请求）
    expect(apiRequests).toEqual([]);
  });

  test('公司档案基本信息「选择行业」：进入/取消/重开/选择/保存回读 @catalog-fullscreen @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);
    await page.getByRole('button', { name: '我要招人' }).click();
    await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 20_000 });
    await hash直达(page, '/#/hr/company-profile/basic');
    const 行业行 = page.getByRole('button', { name: '更换行业' });
    await expect(行业行).toBeVisible({ timeout: 15_000 });
    // 先填其它字段（公司全称），再开选择层
    const 品牌输入 = page.getByLabel('公司全称');
    await 品牌输入.fill('全屏草稿品牌');

    await 行业行.click();
    const 公司行业层 = page.getByRole('dialog', { name: '选择行业' });
    await expect(公司行业层.getByPlaceholder('搜索行业')).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 公司行业层);
    await 断言页面零滚动(page);
    // 父表单 hidden：行业行与品牌输入都不可见；首焦点在返回键
    await expect(行业行).toBeHidden();
    await expect(公司行业层.getByRole('button', { name: '返回' })).toBeFocused();
    // Escape 取消：草稿不变
    await page.keyboard.press('Escape');
    await expect(公司行业层).toHaveCount(0);
    await expect(品牌输入).toHaveValue('全屏草稿品牌');
    // 重开 → 搜索 → 选定 → 行回填且层收起
    await 行业行.click();
    await expect(page.getByRole('dialog', { name: '选择行业' }).getByPlaceholder('搜索行业')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('dialog', { name: '选择行业' }).getByPlaceholder('搜索行业').fill('人工智能');
    await page.getByRole('dialog', { name: '选择行业' }).getByRole('button', { name: '人工智能', exact: true }).click();
    await expect(公司行业层).toHaveCount(0);
    await expect(行业行).toContainText('人工智能');
    // 保存 → 「已保存」轻提示 → 返回走历史；重进分区回读持久值
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('已保存')).toBeVisible({ timeout: 10_000 });
    await hash直达(page, '/#/hr/company-profile/basic');
    await expect(page.getByRole('button', { name: '更换行业' })).toContainText('人工智能', { timeout: 15_000 });

    // Mock 全程零 /api/v1 请求
    expect(apiRequests).toEqual([]);
  });
});
test.describe('catalog-fullscreen 短屏 320×568 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181', viewport: { width: 320, height: 568 } });

  test('选择学校长候选滚到底、返回可达、无双滚动 @catalog-fullscreen @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);
    await hash直达(page, '/#/experience');
    await expect(page.getByRole('button', { name: '＋ 添加教育经历' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加教育经历' }).click();
    await expect(page.getByText('学校名称')).toBeVisible({ timeout: 10_000 });
    const 学校行 = page.getByRole('button').filter({ hasText: '学校名称' });
    await 学校行.click();
    const 学校层 = page.getByRole('dialog', { name: '选择学校' });
    await expect(学校层.getByPlaceholder('搜索学校名称')).toBeVisible({ timeout: 10_000 });
    await 学校层.getByPlaceholder('搜索学校名称').fill('大学');
    await expect(学校层.getByRole('button', { name: '清华大学', exact: true })).toBeVisible({ timeout: 10_000 });

    // 320×568 短屏：外壳仍充满可用区，页面本身零滚动（无双滚动）
    await 断言全屏外壳(page, 学校层);
    await 断言页面零滚动(page);

    // 长候选真滚动：首页 8 条 + 列表尾「加载更多」翻出第 9–16 位 → 壳内 .滚动区
    // （当前值 + 搜索 + 候选一体滚动）滚到底最后一项可见
    await 学校层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(学校层.getByRole('button', { name: '同济大学', exact: true })).toBeVisible({ timeout: 10_000 });
    const 列表 = 学校层.locator('.滚动区');
    const 尺寸 = await 列表.evaluate((节点) => ({ 滚: 节点.scrollHeight, 可见: 节点.clientHeight }));
    expect(尺寸.滚).toBeGreaterThan(尺寸.可见);
    await 列表.evaluate((节点) => { 节点.scrollTop = 节点.scrollHeight; });
    await expect(学校层.getByRole('button', { name: '同济大学', exact: true })).toBeVisible();
    // 返回键在滚动到底后仍可达可点：先取消，草稿不变
    const 返回键 = 学校层.getByRole('button', { name: '返回' });
    await expect(返回键).toBeVisible();
    await expect(返回键).toBeEnabled();
    await 返回键.click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toContainText('选择学校');
    // 重开滚到底选最后一项：回填并收起
    await 学校行.click();
    await expect(学校层.getByPlaceholder('搜索学校名称')).toBeVisible({ timeout: 10_000 });
    await 学校层.getByPlaceholder('搜索学校名称').fill('大学');
    await 学校层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(学校层.getByRole('button', { name: '同济大学', exact: true })).toBeVisible({ timeout: 10_000 });
    const 列表2 = 学校层.locator('.滚动区');
    await 列表2.evaluate((节点) => { 节点.scrollTop = 节点.scrollHeight; });
    await 学校层.getByRole('button', { name: '同济大学', exact: true }).click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toContainText('同济大学');

    // Mock 全程零 /api/v1 请求
    expect(apiRequests).toEqual([]);
  });
});
test.describe('catalog-fullscreen 横屏 844×390 期望职位 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181', viewport: { width: 844, height: 390 } });

  test('期望职位点根直接出现至少两组、leaf 后底部已选/保存正确、无双滚动 @catalog-fullscreen @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/, { timeout: 15_000 });
    await page.getByRole('button', { name: /选择期望职位/ }).click();
    await expect(page).toHaveURL(/#\/onboard\/job$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '期望职位是' })).toBeVisible({ timeout: 10_000 });

    // 整页充满 844×390 可用区，页面本身零滚动；返回栏与底部保存都在视口内
    await 断言页面零滚动(page);
    const 保存键 = page.getByRole('button', { name: '保存', exact: true });
    await expect(保存键).toBeVisible();

    // B 契约：挂载自动选首根 → 多组二级标题（不是按钮）与三级叶子按目录顺序直接出现
    await expect(page.getByRole('heading', { name: '后端开发' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '前端/移动开发' })).toBeVisible();
    // 点根：一级高亮切换，另一根的组同样直接出现（至少两组）
    await page.getByRole('button', { name: '产品', exact: true }).click();
    await expect(page.getByRole('heading', { name: '产品经理' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '游戏策划' })).toBeVisible();
    const 组标题数 = await page.locator('h3').count();
    expect(组标题数).toBeGreaterThanOrEqual(2);

    // 点 leaf：底部已选 chip 出现；保存回学生页
    await page.getByRole('button', { name: 'AI产品经理', exact: true }).click();
    await expect(page.getByRole('button', { name: 'AI产品经理 ✕' })).toBeVisible();
    await 保存键.click();
    await expect(page).toHaveURL(/#\/student$/, { timeout: 10_000 });

    // Mock 全程零 /api/v1 请求
    expect(apiRequests).toEqual([]);
  });
});
test.describe('catalog-fullscreen 学校/专业连点 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('引导 学校/专业 搜索后同项连点两次候选不消失，选择不额外请求 @catalog-fullscreen @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await pickerMock登录(page);

    // ── /onboard/school：同项连点两次，候选行保持、值不重复、零请求 ──
    await hash直达(page, '/#/onboard/school');
    const 学校输入 = page.getByPlaceholder('学校名称');
    await expect(学校输入).toBeVisible({ timeout: 15_000 });
    await 学校输入.fill('大学');
    // 选中后候选行可访问名带「✓」尾缀，重连点用正则，不再 exact
    const 清华 = page.getByRole('button', { name: /^清华大学( ✓)?$/ });
    await expect(清华).toBeVisible({ timeout: 10_000 });
    await 清华.click();
    await expect(学校输入).toHaveValue('清华大学');
    await 清华.click();
    await expect(清华).toBeVisible();
    await expect(学校输入).toHaveValue('清华大学');

    // ── /onboard/major：同一口径 ──
    await hash直达(page, '/#/onboard/major');
    const 专业输入 = page.getByPlaceholder('专业名称');
    await expect(专业输入).toBeVisible({ timeout: 15_000 });
    await 专业输入.fill('工程');
    const 软工 = page.getByRole('button', { name: /^软件工程( ✓)?$/ });
    await expect(软工).toBeVisible({ timeout: 10_000 });
    await 软工.click();
    await expect(专业输入).toHaveValue('软件工程');
    await 软工.click();
    await expect(软工).toBeVisible();
    await expect(专业输入).toHaveValue('软件工程');

    // Mock 全程零 /api/v1 请求（选择零额外请求在 Mock 即零请求全程）
    expect(apiRequests).toEqual([]);
  });
});
test.describe('catalog-fullscreen 候选侧三入口 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182', viewport: { width: 390, height: 844 } });

  test('选择学校/选择专业/所属行业：进入充满可用区、取消零写、重开选择，最终写入带原目录 ID @catalog-fullscreen @backend', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const fixture = 创建候选OnboardingFixture();
    fixture.主体.last_used_role = 'candidate';
    fixture.完成.candidate = '2026-08-25T10:00:00Z';
    fixture.resume = {
      ...P4深克隆(fixture简历),
      profile: { ...fixture简历.profile, real_name: '存量候选' },
      summary: '存量个人优势',
    };
    fixture.intentions = [P4深克隆(fixture意向列表.intentions[0])];
    // 合同 C：经历公司走 公司选择抽屉 —— 搜索池给默认组织库
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P3默认组织库();
    await 安装BFF路由(page, {
      登录尝试id: 'att-catalog-fs-candidate',
      记录目录请求: () => {},
      候选OnboardingFixture: fixture,
      隐私fixture: 隐私,
    });

    // 行业目录桩（本用例专用后装 route，真实三级：根不可选 → 细分组不可选 → 可选叶子）
    await page.route('**/api/v1/catalog/industries*', async (route) => {
      const url = new URL(route.request().url());
      const parentId = url.searchParams.get('parent_id');
      if (parentId === 'ind_grp') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [{ id: 'ind_leaf_bank', display_name: '银行支付', parent_id: 'ind_grp', selectable: true, has_children: false }],
            next_cursor: null,
            catalog_version: 'ind-v1',
          }),
        });
        return;
      }
      if (parentId === 'ind_root') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [{ id: 'ind_grp', display_name: '支付与清结算', parent_id: 'ind_root', selectable: false, has_children: true }],
            next_cursor: null,
            catalog_version: 'ind-v1',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [{ id: 'ind_root', display_name: '金融科技', parent_id: null, selectable: false, has_children: true }],
          next_cursor: null,
          catalog_version: 'ind-v1',
        }),
      });
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    // 日常入口（简历编辑显式来源）：从 我的简历 点行进在线简历（带 from=resume），
    // 整页保存落点随之回我的简历；子视图取消零写与 ID 断言保持原样
    await hash直达(page, '/#/resume');
    await expect(page.getByText('我的简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button').filter({ hasText: 'Fixture 大学' }).first().click();
    await expect(page).toHaveURL(/#\/experience\?from=resume$/, { timeout: 15_000 });
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });

    // ── 教育「选择学校」：进入充满可用区、父字段 hidden、Escape 取消零写、重开选择 ──
    await page.getByRole('button', { name: '＋ 添加教育经历' }).click();
    await expect(page.getByText('学校名称')).toBeVisible({ timeout: 10_000 });
    const 学校行 = page.getByRole('button').filter({ hasText: '学校名称' });
    await 学校行.click();
    const 学校层 = page.getByRole('dialog', { name: '选择学校' });
    await expect(学校层.getByPlaceholder('搜索学校名称')).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 学校层);
    await 断言页面零滚动(page);
    await expect(page.getByRole('button', { name: '完成', exact: true })).toBeHidden();
    await expect(学校层.getByRole('button', { name: '返回' })).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await 焦点在弹层内(page)).toBe(true);
    const 取消前写入数 = fixture.mutations.length;
    await page.keyboard.press('Escape');
    await expect(学校层).toHaveCount(0);
    expect(fixture.mutations.length).toBe(取消前写入数);
    await expect(学校行).toBeFocused();
    // 重开 → 搜索 → 选候选 → 行回填
    await 学校行.click();
    await expect(page.getByRole('dialog', { name: '选择学校' }).getByPlaceholder('搜索学校名称')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('dialog', { name: '选择学校' }).getByPlaceholder('搜索学校名称').fill('fixture');
    await expect(page.getByRole('dialog', { name: '选择学校' }).getByText(标记.学校display)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('dialog', { name: '选择学校' }).getByText(标记.学校副行)).toBeVisible();
    await page.getByRole('dialog', { name: '选择学校' }).getByText(标记.学校display).click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toContainText('Fixture 大学');

    // ── 教育「选择专业」 ──
    const 专业行 = page.getByRole('button').filter({ hasText: '专业' }).first();
    await 专业行.click();
    const 专业层 = page.getByRole('dialog', { name: '选择专业' });
    await expect(专业层.getByPlaceholder('搜索专业名称')).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 专业层);
    await 专业层.getByPlaceholder('搜索专业名称').fill('fixture');
    await expect(专业层.getByRole('button', { name: 标记.专业display })).toBeVisible({ timeout: 10_000 });
    await 专业层.getByRole('button', { name: 标记.专业display }).click();
    await expect(专业层).toHaveCount(0);
    await expect(专业行).toContainText('Fixture 专业');
    // 完成 → 教育卡上屏；保存按所点行的原目录 ID 提交（不按显示名反查），
    // 编辑入口带 from=resume：整页保存落点是我的简历
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await expect(page.getByText(/Fixture 大学/).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/resume$/, { timeout: 20_000 });
    const 教育写入 = fixture.mutations.filter(
      (条) => 条.method === 'POST' && 条.path === '/api/v1/me/resume/educations',
    );
    expect(教育写入.length).toBeGreaterThan(0);
    expect(教育写入[0]!.body).toMatchObject({ institution_id: 'inst-fixture-001', major_id: 'major-fixture-001' });

    // ── 经历「所属行业」：先填其它字段 → 取消零写 → 重开下钻选叶子 → 按 ID 保存 ──
    await page.getByRole('button').filter({ hasText: 'Fixture 大学' }).first().click();
    await expect(page).toHaveURL(/#\/experience\?from=resume$/, { timeout: 15_000 });
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加工作经历' }).click();
    await expect(page.getByPlaceholder('必填')).toHaveCount(1);
    await page.getByRole('button').filter({ hasText: '公司名称' }).click();
    await 抽屉搜企业并选中(page, '磐石', P3标记.手动组织甲);
    await page.getByPlaceholder('必填').fill('全屏草稿工程师');
    const 经历取消前写入数 = fixture.mutations.length;
    await page.getByRole('button', { name: '所属行业' }).click();
    const 行业层 = page.getByRole('dialog', { name: '所属行业' });
    await expect(行业层.getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 行业层);
    await expect(page.getByPlaceholder('必填')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(行业层).toHaveCount(0);
    expect(fixture.mutations.length).toBe(经历取消前写入数);
    // 重开 → 真实三级下钻：根 → 细分组 → 可选叶子
    await page.getByRole('button', { name: '所属行业' }).click();
    await expect(行业层.getByRole('button', { name: /金融科技/ })).toBeVisible({ timeout: 10_000 });
    await 行业层.getByRole('button', { name: /金融科技/ }).click();
    await expect(行业层.getByRole('button', { name: /支付与清结算/ })).toBeVisible({ timeout: 10_000 });
    await 行业层.getByRole('button', { name: /支付与清结算/ }).click();
    await 行业层.getByRole('button', { name: '银行支付', exact: true }).click();
    await expect(行业层).toHaveCount(0);
    await expect(page.getByRole('button', { name: /所属行业/ })).toContainText('银行支付');
    // 入职年月 → 完成 → 保存：experience POST 的 industry_id 是所点叶子的原目录 ID，
    // 编辑入口带 from=resume：整页保存落点是我的简历
    await page.getByRole('button', { name: '入职年月' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '确定' }).click();
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await expect(page.getByText(/银行支付/).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/resume$/, { timeout: 20_000 });
    const 经历写入 = fixture.mutations.filter(
      (条) => 条.method === 'POST' && 条.path === '/api/v1/me/resume/experiences',
    );
    expect(经历写入.length).toBeGreaterThan(0);
    expect(经历写入[0]!.body).toMatchObject({
      organization_id: 'org-fixture-p3-manual-a',
      industry_id: 'ind_leaf_bank',
    });

    await page.screenshot({ path: `${testInfo.outputPath()}-catalog-fullscreen-候选侧.png`, fullPage: true });
  });
});
test.describe('catalog-fullscreen 招聘侧两入口 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182', viewport: { width: 390, height: 844 } });

  test('发布岗位「职位类别」与公司档案「选择行业」：进入充满可用区、父字段不可聚焦、取消重开选择 @catalog-fullscreen @backend', async ({ page }) => {
    test.setTimeout(240_000);
    const 请求们: { path: string; method: string; body: unknown }[] = [];
    // 合同 C：名片公司自报经 公司选择抽屉 选中（搜索池 + 公开企业回读都要有组织甲）
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P1C搜索池();
    await 安装BFF路由(page, {
      登录尝试id: 'att-catalog-fs-recruiter',
      记录目录请求: () => undefined,
      请求拦截: ({ path, method, body }) => 请求们.push({ path, method, body }),
      // admin@组织甲（verified/active）：公司档案分区可写，行业行可点
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [P1C管理员关系], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      隐私fixture: 隐私,
    });

    // 公司行业目录桩（本用例专用后装 route，真实三级：根不可选 → 可选叶子）
    await page.route('**/api/v1/catalog/industries*', async (route) => {
      const url = new URL(route.request().url());
      const parentId = url.searchParams.get('parent_id');
      if (parentId === 'co_ind_root') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [{ id: 'co_ind_leaf', display_name: '生活服务', parent_id: 'co_ind_root', selectable: true, has_children: false }],
            next_cursor: null,
            catalog_version: 'ind-v1',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: [{ id: 'co_ind_root', display_name: '消费生活', parent_id: null, selectable: false, has_children: true }],
          next_cursor: null,
          catalog_version: 'ind-v1',
        }),
      });
    });

    // 存量招聘会话经应用内入口进名片（注册流入口会被已完成账号守卫弹回企业主壳）
    await hash直达(page, '/#/hr/card');
    await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('姓名').fill('林澈');
    await page.getByLabel('职务').fill('招聘负责人');
    await page.getByRole('button', { name: '未选择公司' }).click();
    await 抽屉搜企业并选中(page, '云衢科技', P1C标记.组织甲名);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('保存成功')).toBeVisible({ timeout: 20_000 });

    // ── 发布岗位「职位类别」 ──
    await hash直达(page, '/#/hr/post-job');
    const 职位名称输入 = page.getByPlaceholder(/资深后端工程师/);
    await expect(职位名称输入).toBeVisible({ timeout: 15_000 });
    await 职位名称输入.fill('全屏草稿岗');
    const 职位类别行 = page.getByRole('button').filter({ hasText: '职位类别' });
    await 职位类别行.click();
    const 类别层 = page.getByRole('dialog', { name: '职位类别' });
    await expect(类别层.getByRole('button', { name: 标记.职位display }).first()).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 类别层);
    await 断言页面零滚动(page);
    await expect(职位名称输入).toBeHidden();
    await expect(类别层.getByRole('button', { name: '返回' })).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await 焦点在弹层内(page)).toBe(true);
    const 类别取消前写入数 = 请求们.filter((条) => 条.method !== 'GET').length;
    await page.keyboard.press('Escape');
    await expect(类别层).toHaveCount(0);
    expect(请求们.filter((条) => 条.method !== 'GET').length).toBe(类别取消前写入数);
    await expect(职位名称输入).toHaveValue('全屏草稿岗');
    // 重开 → 选叶子（fixture 根与子同名，点根后右栏出同名叶子，取次序区分）
    await 职位类别行.click();
    const 类键 = page.getByRole('dialog', { name: '职位类别' }).getByRole('button', { name: 标记.职位display });
    await expect(类键.first()).toBeVisible({ timeout: 10_000 });
    await 类键.first().click();
    await expect(类键).toHaveCount(2, { timeout: 10_000 });
    await 类键.last().click();
    await expect(类别层).toHaveCount(0);
    await expect(职位类别行).toContainText('Fixture 工程师');

    // ── 公司档案基本信息「选择行业」：先经分区清单页（企业档案快照在那里水合）──
    await hash直达(page, '/#/hr/company-profile');
    await expect(page.getByRole('heading', { name: '编辑品牌信息' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /基本信息/ }).click();
    const 行业行 = page.getByRole('button', { name: '更换行业' });
    await expect(行业行).toBeVisible({ timeout: 15_000 });
    await 行业行.click();
    const 公司行业层 = page.getByRole('dialog', { name: '选择行业' });
    await expect(公司行业层.getByPlaceholder('搜索行业')).toBeVisible({ timeout: 10_000 });
    await 断言全屏外壳(page, 公司行业层);
    await expect(行业行).toBeHidden();
    await expect(公司行业层.getByRole('button', { name: '返回' })).toBeFocused();
    const 行业取消前写入数 = 请求们.filter((条) => 条.method !== 'GET').length;
    await page.keyboard.press('Escape');
    await expect(公司行业层).toHaveCount(0);
    expect(请求们.filter((条) => 条.method !== 'GET').length).toBe(行业取消前写入数);
    // 重开 → 下钻 → 选叶子 → 行回填
    await 行业行.click();
    await expect(page.getByRole('dialog', { name: '选择行业' }).getByRole('button', { name: '消费生活', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('dialog', { name: '选择行业' }).getByRole('button', { name: '消费生活', exact: true }).click();
    await page.getByRole('dialog', { name: '选择行业' }).getByRole('button', { name: '生活服务', exact: true }).click();
    await expect(公司行业层).toHaveCount(0);
    await expect(行业行).toContainText('生活服务');
  });
});
test.describe('catalog-fullscreen 短屏 320×568 学校长候选 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182', viewport: { width: 320, height: 568 } });

  test('选择学校两页长候选滚到底、返回可达、无双滚动 @catalog-fullscreen @backend', async ({ page }) => {
    test.setTimeout(120_000);
    await pickerBackend存量候选(page, 'att-catalog-fs-school');

    // 教育目录桩（本用例专用后装 route）：两页各 8 所，撑出层内长滚动
    await page.route('**/api/v1/catalog/education-institutions*', async (route) => {
      const url = new URL(route.request().url());
      const 校 = (序: number) => ({
        id: `inst_${序}`,
        display_name: `细分校${序}`,
        location: {
          id: `loc_${序}`, display_name: `城市${序}`, country_code: 'CN', country_name: '中国',
          admin1_code: null, admin1_name: null, timezone: 'Asia/Shanghai', population: 0,
        },
        selectable: true,
      });
      if (url.searchParams.get('cursor') === 'inst-cur-2') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: Array.from({ length: 8 }, (_, 序) => 校(序 + 9)),
            next_cursor: null,
            catalog_version: 'inst-v1',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: 信封({
          items: Array.from({ length: 8 }, (_, 序) => 校(序 + 1)),
          next_cursor: 'inst-cur-2',
          catalog_version: 'inst-v1',
        }),
      });
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await hash直达(page, '/#/experience');
    await expect(page.getByText('在线简历', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '＋ 添加教育经历' }).click();
    await expect(page.getByText('学校名称')).toBeVisible({ timeout: 10_000 });
    const 学校行 = page.getByRole('button').filter({ hasText: '学校名称' });
    await 学校行.click();
    const 学校层 = page.getByRole('dialog', { name: '选择学校' });
    await expect(学校层.getByPlaceholder('搜索学校名称')).toBeVisible({ timeout: 10_000 });
    await 学校层.getByPlaceholder('搜索学校名称').fill('细分校');
    await expect(学校层.getByRole('button', { name: '细分校1', exact: true })).toBeVisible({ timeout: 10_000 });

    // 320×568 短屏：外壳充满可用区，页面本身零滚动（无双滚动）
    await 断言全屏外壳(page, 学校层);
    await 断言页面零滚动(page);

    // 长候选：首页 8 条 + 列表尾「加载更多」翻第二页 → 真滚到底最后一项可见
    await 学校层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(学校层.getByRole('button', { name: '细分校16', exact: true })).toBeVisible({ timeout: 10_000 });
    // 学校承载的滚动容器是壳内 .滚动区（当前值 + 搜索 + 候选一体滚动）
    const 列表 = 学校层.locator('.滚动区');
    const 尺寸 = await 列表.evaluate((节点) => ({ 滚: 节点.scrollHeight, 可见: 节点.clientHeight }));
    expect(尺寸.滚).toBeGreaterThan(尺寸.可见);
    await 列表.evaluate((节点) => { 节点.scrollTop = 节点.scrollHeight; });
    await expect(学校层.getByRole('button', { name: '细分校16', exact: true })).toBeVisible();
    // 返回键滚到底仍可达：取消 → 草稿不变
    const 返回键 = 学校层.getByRole('button', { name: '返回' });
    await expect(返回键).toBeEnabled();
    await 返回键.click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toContainText('选择学校');
    // 重开滚到底选最后一项：行回填
    await 学校行.click();
    await expect(学校层.getByPlaceholder('搜索学校名称')).toBeVisible({ timeout: 10_000 });
    await 学校层.getByPlaceholder('搜索学校名称').fill('细分校');
    await 学校层.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(学校层.getByRole('button', { name: '细分校16', exact: true })).toBeVisible({ timeout: 10_000 });
    const 列表2 = 学校层.locator('.滚动区');
    await 列表2.evaluate((节点) => { 节点.scrollTop = 节点.scrollHeight; });
    await 学校层.getByRole('button', { name: '细分校16', exact: true }).click();
    await expect(学校层).toHaveCount(0);
    await expect(学校行).toContainText('细分校16');
  });
});
test.describe('catalog-fullscreen 横屏 844×390 期望职位 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182', viewport: { width: 844, height: 390 } });

  test('期望职位点根直接出现至少两组、leaf 后底部已选/保存正确、无双滚动 @catalog-fullscreen @backend', async ({ page }) => {
    test.setTimeout(120_000);
    await pickerBackend存量候选(page, 'att-catalog-fs-job');

    // job-categories 目录桩（本用例专用后装 route，真实三级）：
    // 根（不可选）→ 两个二级组（不可选）→ 各自可选叶子。挂载自动选首根即应出现两组。
    await page.route('**/api/v1/catalog/job-categories*', async (route) => {
      const url = new URL(route.request().url());
      const parentId = url.searchParams.get('parent_id');
      if (parentId === 'job_g1') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [{ id: 'job_leaf_a', display_name: '服务端工程师甲', parent_id: 'job_g1', selectable: true, has_children: false }],
            next_cursor: null,
            catalog_version: 'tax-v1',
          }),
        });
        return;
      }
      if (parentId === 'job_g2') {
        await route.fulfill({
          status: 200,
          json: 信封({
            items: [{ id: 'job_leaf_b', display_name: '网页工程师乙', parent_id: 'job_g2', selectable: true, has_children: false }],
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
            items: [
              { id: 'job_g1', display_name: '后端开发', parent_id: 'job_root', selectable: false, has_children: true },
              { id: 'job_g2', display_name: '前端开发', parent_id: 'job_root', selectable: false, has_children: true },
            ],
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

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await hash直达(page, '/#/intentions/new');
    await expect(page.getByText('请选择期望职位')).toBeVisible({ timeout: 15_000 });
    await page.getByText('请选择期望职位').click();
    await expect(page).toHaveURL(/#\/onboard\/job/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '期望职位是' })).toBeVisible({ timeout: 10_000 });

    // 整页充满 844×390 可用区，页面本身零滚动；底部保存键在视口内
    await 断言页面零滚动(page);
    const 保存键 = page.getByRole('button', { name: '保存', exact: true });
    await expect(保存键).toBeVisible();

    // B 契约：挂载自动选首根；点根后无需第二次点击，两组二级标题（heading，非按钮）
    // 与各自三级叶子按目录顺序直接出现
    await page.getByRole('button', { name: '技术研发', exact: true }).click();
    await expect(page.getByRole('heading', { name: '后端开发' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '前端开发' })).toBeVisible();
    await expect(page.getByRole('button', { name: '服务端工程师甲', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '网页工程师乙', exact: true })).toBeVisible();
    const 组标题数 = await page.locator('h3').count();
    expect(组标题数).toBeGreaterThanOrEqual(2);

    // 点 leaf：底部已选 chip 出现；保存（意向单选）回意向页回显
    await page.getByRole('button', { name: '服务端工程师甲', exact: true }).click();
    await expect(page.getByRole('button', { name: '服务端工程师甲 ✕' })).toBeVisible();
    await 保存键.click();
    await expect(page).toHaveURL(/#\/intentions\/new$/, { timeout: 10_000 });
    await expect(page.getByText('服务端工程师甲').first()).toBeVisible({ timeout: 15_000 });
  });
});
test.describe('catalog-fullscreen 学校/专业连点 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('引导 学校/专业 搜索后同项连点两次候选不消失，选择不额外请求 @catalog-fullscreen @backend', async ({ page }) => {
    test.setTimeout(180_000);
    await pickerBackend存量候选(page, 'att-catalog-fs-doubleclick');

    // 学校：搜索后同项连点两次 —— 候选行保持、引用不丢、查询不因选择额外发起
    await hash直达(page, '/#/onboard/school');
    const 学校输入 = page.getByPlaceholder('学校名称');
    await expect(学校输入).toBeVisible({ timeout: 15_000 });
    const 学校目录请求: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1/catalog/education-institutions')) {
        学校目录请求.push(request.url());
      }
    });
    await 学校输入.fill('fixture');
    await expect(page.getByText(标记.学校display)).toBeVisible({ timeout: 10_000 });
    await page.getByText(标记.学校display).click();
    await expect(学校输入).toHaveValue(/Fixture 大学/);
    await page.getByText(标记.学校display).click();
    await expect(page.getByText(标记.学校display)).toBeVisible();
    await expect(学校输入).toHaveValue(/Fixture 大学/);
    const 搜索后请求基线 = 学校目录请求.length;
    expect(搜索后请求基线).toBeGreaterThan(0);
    await expect.poll(() => 学校目录请求.length, { timeout: 2_000 }).toBe(搜索后请求基线);

    // 专业：同一口径
    await hash直达(page, '/#/onboard/major');
    const 专业输入 = page.getByPlaceholder('专业名称');
    await expect(专业输入).toBeVisible({ timeout: 15_000 });
    const 专业目录请求: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1/catalog/majors')) 专业目录请求.push(request.url());
    });
    await 专业输入.fill('fixture');
    await expect(page.getByText(标记.专业display)).toBeVisible({ timeout: 10_000 });
    await page.getByText(标记.专业display).click();
    await expect(专业输入).toHaveValue(/Fixture 专业/);
    await page.getByText(标记.专业display).click();
    await expect(page.getByText(标记.专业display)).toBeVisible();
    await expect(专业输入).toHaveValue(/Fixture 专业/);
    const 专业请求基线 = 专业目录请求.length;
    expect(专业请求基线).toBeGreaterThan(0);
    await expect.poll(() => 专业目录请求.length, { timeout: 2_000 }).toBe(专业请求基线);
  });
});
