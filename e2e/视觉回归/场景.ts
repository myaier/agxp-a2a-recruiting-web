// 视觉场景与关键元素描述：仅依赖 Playwright 浏览器对象（Locator/Page），
// 不进比较核心（比较核心只吃可序列化的 场景采集结果/元素几何）。
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { 场景状态种子 } from './类型';
import { 打开稳定页面, 注入候选突变 } from './稳定页面';

export interface 关键元素描述 {
  名称: string;
  定位: Locator;
}

export interface 视觉场景 {
  id: string;
  状态: 场景状态种子;
  到达(page: Page): Promise<void>;
  就绪(page: Page): Promise<void>;
  关键元素(page: Page): 关键元素描述[];
  遮罩?(page: Page): Locator[];
}

function 构造场景(参数: {
  id: string;
  状态: 场景状态种子;
  路径: string;
  关键元素(page: Page): 关键元素描述[];
  就绪?(page: Page): Promise<void>;
}): 视觉场景 {
  return {
    id: 参数.id,
    状态: 参数.状态,
    async 到达(page: Page): Promise<void> {
      await 打开稳定页面(page, 参数.路径, 参数.状态);
      await 注入候选突变(page);
    },
    async 就绪(page: Page): Promise<void> {
      // 默认就绪：第一个关键元素可见即认为屏已落定。
      if (参数.就绪) {
        await 参数.就绪(page);
        return;
      }
      const 第一个 = 参数.关键元素(page)[0];
      if (第一个) await expect(第一个.定位).toBeVisible();
    },
    关键元素: 参数.关键元素,
  };
}

// entry-login-default：登录屏，未登录态。
const 登录场景 = 构造场景({
  id: 'entry-login-default',
  状态: '未登录',
  路径: '/#/',
  关键元素(page: Page) {
    return [
      { 名称: '标题 工作蜂', 定位: page.getByRole('heading', { name: '工作蜂' }) },
      { 名称: '标签 手机号', 定位: page.getByLabel('手机号') },
      { 名称: '按钮 进入', 定位: page.getByRole('button', { name: '进入' }) },
    ];
  },
});

// entry-identity：选身份屏，未登录态。
const 身份场景 = 构造场景({
  id: 'entry-identity',
  状态: '未登录',
  路径: '/#/identity',
  关键元素(page: Page) {
    return [
      { 名称: '按钮 我要找工作', 定位: page.getByRole('button', { name: '我要找工作' }) },
      { 名称: '按钮 我要招人', 定位: page.getByRole('button', { name: '我要招人' }) },
    ];
  },
});

// candidate-preferences：完善资料屏，求职端已注册（带 legacy 种子）。
// 注：种子固定写入 职位:['产品经理']，引导预填被预填，本屏「期望的职位」行回显
// 已选值「产品经理 ›」而非占位「选择期望职位」。按 carry-forward 规则改用匹配已选
// 值的定位（产品经理），不改产品代码、不改种子。占位态也一并兼容（用 alternation）。
const 偏好场景 = 构造场景({
  id: 'candidate-preferences',
  状态: '求职端已注册',
  路径: '/#/student',
  关键元素(page: Page) {
    return [
      { 名称: '标题 完善资料', 定位: page.getByRole('heading', { name: '完善资料' }) },
      { 名称: '按钮 期望职位行', 定位: page.getByRole('button', { name: /产品经理|选择期望职位/ }) },
      { 名称: '按钮 下一步', 定位: page.getByRole('button', { name: '下一步' }) },
    ];
  },
});

// candidate-salary：引导问答薪资段，求职端已注册（求职类型=社招全职 → 期望现金月薪）。
const 薪资场景 = 构造场景({
  id: 'candidate-salary',
  状态: '求职端已注册',
  路径: '/#/wizard?stage=salary',
  关键元素(page: Page) {
    return [
      { 名称: '标题 期望现金月薪是？', 定位: page.getByRole('heading', { name: '期望现金月薪是？' }) },
      { 名称: 'listbox 最低月薪', 定位: page.getByRole('listbox', { name: '最低月薪' }) },
      { 名称: '按钮 下一步', 定位: page.getByRole('button', { name: '下一步' }) },
    ];
  },
});

// candidate-resume：创建在线简历屏，求职端已注册。
// 注：产品 JSX 里「姓名」是 div 条目标签，不是 <label>，输入框也没有 aria-label，
// 故 getByLabel('姓名') 取不到。按 carry-forward 规则改用可见标签文本定位（getByText exact），
// 不改产品代码。这是相对计划字面 "label 姓名" 的唯一调整。
const 简历场景 = 构造场景({
  id: 'candidate-resume',
  状态: '求职端已注册',
  路径: '/#/basic',
  关键元素(page: Page) {
    return [
      { 名称: '标题 创建在线简历', 定位: page.getByRole('heading', { name: '创建在线简历' }) },
      { 名称: '标签 姓名', 定位: page.getByText('姓名', { exact: true }) },
      { 名称: '按钮 下一步', 定位: page.getByRole('button', { name: '下一步' }) },
    ];
  },
});

// candidate-market：看市场子视图，求职端已注册。
// 注：计划字面 ready 含 text「告诉AI代理你的硬性要求」，该文案只出现在看市场筛选层弹层内，
// 默认看市场态不可见。按 carry-forward 规则改用默认可见的代理横幅文案作关键元素，不改产品代码。
const 市场场景: 视觉场景 = {
  id: 'candidate-market',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开稳定页面(page, '/#/app', '求职端已注册');
    await 注入候选突变(page);
    await page.getByRole('button', { name: '市场' }).click();
  },
  async 就绪(page: Page): Promise<void> {
    await expect(
      page.getByText(/个职位需要你协调|暂时没有需要你介入/),
    ).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '代理横幅 待协调文案', 定位: page.getByText(/个职位需要你协调|暂时没有需要你介入/) },
      { 名称: '第一张市场卡 查看职位详情', 定位: page.getByRole('button', { name: '查看职位详情' }).first() },
      { 名称: '第一张市场卡 让AI代理去谈', 定位: page.getByRole('button', { name: '让AI代理去谈' }).first() },
    ];
  },
};

// candidate-negotiations：在谈子视图首页，求职端已注册。
const 在谈首页场景: 视觉场景 = {
  id: 'candidate-negotiations',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开稳定页面(page, '/#/app', '求职端已注册');
    await 注入候选突变(page);
  },
  async 就绪(page: Page): Promise<void> {
    await expect(
      page.getByRole('button').filter({ hasText: /匿名初筛|递交简历|需要协调|意向确认/ }).first(),
    ).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '子视图按钮 在谈', 定位: page.getByRole('button', { name: '在谈' }) },
      { 名称: '代理横幅 待协调文案', 定位: page.getByText(/个职位需要你协调|暂时没有需要你介入/) },
      {
        名称: '第一张在谈卡',
        定位: page.getByRole('button').filter({ hasText: /匿名初筛|递交简历|需要协调|意向确认/ }).first(),
      },
    ];
  },
};

// candidate-negotiation-detail：在谈详情的职位详情 Tab，求职端已注册。
// 注：计划步骤只写「打开 /#/deal/J-01」，但该页默认 Tab 是「代谈进度」，ready 中的
// 「匹配度分析」「职位详情」文案在「职位详情」Tab 内。按 carry-forward 规则在到达步骤里
// 点一次「职位详情」Tab 切到该视图，不改产品代码。另：「职位详情」文案同时是 Tab 按钮名与
// 内容标题，getByText 解析到 2 个节点触发 strict mode，故关键元素改用 Tab 按钮定位。
const 在谈详情场景: 视觉场景 = {
  id: 'candidate-negotiation-detail',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开稳定页面(page, '/#/deal/J-01', '求职端已注册');
    await 注入候选突变(page);
    await page.getByRole('button', { name: '职位详情' }).click();
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByText('匹配度分析', { exact: true })).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '文本 匹配度分析', 定位: page.getByText('匹配度分析', { exact: true }) },
      { 名称: '职位详情 Tab 按钮', 定位: page.getByRole('button', { name: '职位详情', exact: true }) },
      { 名称: '返回按钮', 定位: page.getByRole('button', { name: '返回' }) },
    ];
  },
};

// candidate-messages：消息 Tab，求职端已注册。
const 消息场景: 视觉场景 = {
  id: 'candidate-messages',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开稳定页面(page, '/#/app', '求职端已注册');
    await 注入候选突变(page);
    // 底部「消息」导航的角标（未读数）排在文字前，可达名形如「4消息」，用子串匹配。
    await page.getByRole('button', { name: /消息/ }).click();
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByRole('button', { name: '搜索' })).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      // 大标题「消息」与底部导航「消息」文字同形，getByText 解析到 2 个节点；取 DOM 首位（大标题）。
      { 名称: '大标题 消息', 定位: page.getByText('消息', { exact: true }).first() },
      { 名称: '按钮 搜索', 定位: page.getByRole('button', { name: '搜索' }) },
      { 名称: '第一条会话', 定位: page.getByRole('button', { name: /AI代理动态/ }).first() },
    ];
  },
};

// candidate-me-overlay：我入口 → 待你拍 → 在谈筛选层，求职端已注册。
// 证明「我」入口与在谈筛选层连通：最终截图是筛选层打开态，关键元素同时含底部「我」导航与筛选层标题。
const 我筛选层场景: 视觉场景 = {
  id: 'candidate-me-overlay',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开稳定页面(page, '/#/app', '求职端已注册');
    await 注入候选突变(page);
    // 底部「我」导航可达名正好是「我」，但默认子串匹配会同时命中代理横幅里的「我已谈完」，
    // 故用 exact 精确到导航按钮本身。
    await page.getByRole('button', { name: '我', exact: true }).click();
    await expect(page.getByText('我的求职AI代理', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /待你拍/ }).click();
    await page.getByRole('button', { name: /筛选/ }).click();
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByText('看哪几单', { exact: true })).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '筛选层标题 看哪几单', 定位: page.getByText('看哪几单', { exact: true }) },
      { 名称: '范围档 全部意向', 定位: page.getByText('全部意向', { exact: true }) },
      { 名称: '按钮 完成', 定位: page.getByRole('button', { name: '完成' }) },
      { 名称: '底部导航 我', 定位: page.getByRole('button', { name: '我', exact: true }) },
    ];
  },
};

// candidate-profile：个人信息页，求职端已注册。
const 个人信息场景: 视觉场景 = {
  id: 'candidate-profile',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开稳定页面(page, '/#/profile', '求职端已注册');
    await 注入候选突变(page);
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByRole('heading', { name: '个人信息' })).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '标题 个人信息', 定位: page.getByRole('heading', { name: '个人信息' }) },
      { 名称: '按钮 头像', 定位: page.getByRole('button', { name: /头像/ }) },
      { 名称: '标签 姓名', 定位: page.getByText('姓名', { exact: true }) },
      { 名称: '标签 手机号', 定位: page.getByText('手机号', { exact: true }) },
      // 2026-08-26：main 的个人信息页改成可编辑后，原来的「披露偏好」入口行已移除；
      // 改用「邮箱」编辑行作联系方式区底部锚点（carry-forward：跟随产品 UI，不改产品）。
      { 名称: '标签 邮箱', 定位: page.getByText('邮箱', { exact: true }) },
    ];
  },
};

// recruiter-card：招聘名片，招聘端已注册（清空存储，用应用内 Mock 招聘数据）。
const 招聘名片场景 = 构造场景({
  id: 'recruiter-card',
  状态: '招聘端已注册',
  路径: '/#/hr/card',
  关键元素(page: Page) {
    return [
      { 名称: '标题 招聘名片', 定位: page.getByRole('heading', { name: '招聘名片' }) },
      { 名称: '输入框 姓名', 定位: page.getByLabel('姓名', { exact: true }) },
      { 名称: '按钮 保存 · 去发岗位', 定位: page.getByRole('button', { name: '保存 · 去发岗位' }) },
    ];
  },
});

// recruiter-post-job-1：发布岗位第一步基础信息，招聘端已注册。
const 发岗一场景 = 构造场景({
  id: 'recruiter-post-job-1',
  状态: '招聘端已注册',
  路径: '/#/hr/post-job',
  关键元素(page: Page) {
    return [
      { 名称: '标题 岗位基础信息', 定位: page.getByRole('heading', { name: '岗位基础信息' }) },
      { 名称: '类型按钮 实习生', 定位: page.getByRole('button', { name: '实习生 在校生实习，按天计薪' }) },
      { 名称: '按钮 下一步', 定位: page.getByRole('button', { name: '下一步' }) },
    ];
  },
});

// 发布岗位第一步统一必填动作（已由 e2e/onboarding.spec.ts 验证）。
async function 发岗第一步(page: Page): Promise<void> {
  await page.getByRole('button', { name: '实习生 在校生实习，按天计薪' }).click();
  await page.getByRole('button', { name: '提供转正机会' }).click();
  await page.getByPlaceholder(/资深后端工程师/).fill('AI 产品实习生');
  await page.getByRole('button').filter({ hasText: '职位类别' }).click();
  await page.getByRole('button', { name: '产品', exact: true }).click();
  await page.getByRole('button', { name: '产品经理', exact: true }).click();
  await page.getByRole('button', { name: '混合', exact: true }).click();
  await page.getByRole('button', { name: '下一步' }).click();
}

// 发布岗位第二步动作：填职位描述并点下一步。
async function 发岗第二步(page: Page): Promise<void> {
  await page.getByLabel('职位描述').fill('参与 AI 招聘产品的需求分析与原型设计。');
  await page.getByRole('button', { name: '下一步' }).click();
}

// recruiter-post-job-2：发布岗位第二步职位描述，招聘端已注册。
const 发岗二场景: 视觉场景 = {
  id: 'recruiter-post-job-2',
  状态: '招聘端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开稳定页面(page, '/#/hr/post-job', '招聘端已注册');
    await 注入候选突变(page);
    await 发岗第一步(page);
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByRole('heading', { name: '职位描述' })).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '标题 职位描述', 定位: page.getByRole('heading', { name: '职位描述' }) },
      { 名称: '输入框 职位描述', 定位: page.getByLabel('职位描述') },
      { 名称: '按钮 下一步', 定位: page.getByRole('button', { name: '下一步' }) },
    ];
  },
};

// recruiter-post-job-3：发布岗位第三步职位要求，招聘端已注册。
// 注：计划 ready 写「label 薪资下限 或 button — 元/天」。本场景走实习生路径，计薪单位是
// 元/天，薪资录入是「— 元/天」按钮（非 K 路径的 aria-label 薪资下限输入框）。按 carry-forward
// 规则用实际渲染的「元/天」按钮作关键元素，不改产品代码。第三个锚点选两版本均存在的提交按钮，
// 避免把 base 已移除的「AI 初筛条件确认」误报为参考环境基础设施失败。
const 发岗三场景: 视觉场景 = {
  id: 'recruiter-post-job-3',
  状态: '招聘端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开稳定页面(page, '/#/hr/post-job', '招聘端已注册');
    await 注入候选突变(page);
    await 发岗第一步(page);
    await 发岗第二步(page);
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByRole('heading', { name: '职位要求' })).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '标题 职位要求', 定位: page.getByRole('heading', { name: '职位要求' }) },
      { 名称: '薪资下限按钮 元/天', 定位: page.getByRole('button', { name: /元\/天/ }).first() },
      {
        名称: '按钮 发布岗位并开始寻访',
        定位: page.getByRole('button', { name: '发布岗位并开始寻访' }),
      },
    ];
  },
};

// recruiter-home-candidate：企业主壳 → 推荐 → 第一张候选画像，招聘端已注册。
// 注：点「查看候选画像」落到匿名在线简历页（/hr/resume/:id）。计划 ready 写「候选画像标题」，
// 该页无字面「候选画像」标题，最接近的稳定标题是简历正文段标「个人优势」。按 carry-forward
// 规则用「个人优势」作关键元素，不改产品代码。
// 关键元素锚点（c836f30 修）：该页从 c836f30 起同时有栏匹配标「匹配」与匹配对齐卡标题
// 「匹配度分析」，旧锚点 /匹配|在线简历/ 会命中两个元素触发 strict mode violation，采集必失败。
// 改为两个精确锚点，并把「匹配度分析」卡显式纳入几何覆盖——截图像素比较本就覆盖它，
// 这里是把它从「让定位器歧义的新元素」变成「被 harness 盯住的元素」，不是掩盖产品漂移。
const 候选画像场景: 视觉场景 = {
  id: 'recruiter-home-candidate',
  状态: '招聘端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开稳定页面(page, '/#/hr', '招聘端已注册');
    await 注入候选突变(page);
    await page.getByRole('button', { name: '推荐' }).click();
    await page.getByRole('button', { name: '查看候选画像' }).first().click();
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByRole('button', { name: '返回' })).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '返回按钮', 定位: page.getByRole('button', { name: '返回' }) },
      { 名称: '栏匹配标 匹配', 定位: page.getByText('匹配', { exact: true }) },
      { 名称: '匹配对齐卡标题 匹配度分析', 定位: page.getByText('匹配度分析', { exact: true }) },
      { 名称: '简历段标 个人优势', 定位: page.getByText('个人优势', { exact: true }) },
    ];
  },
};

// candidate-account-security：账号与安全页，求职端已注册（P8 Task 8 新增 Mock 场景）。
// 注：本屏标题是 返回栏 标题（div，非 heading），按 carry-forward 规则用可见文本定位，
// 不改产品代码。Backend 专属「数据」组/导出行在 Mock 不渲染 —— 本场景钉住的是
// Mock 页与基线像素/几何兼容（换绑抽屉、注销按钮都在，导出相关一概缺席）。
const 账号安全场景 = 构造场景({
  id: 'candidate-account-security',
  状态: '求职端已注册',
  路径: '/#/account',
  关键元素(page: Page) {
    return [
      { 名称: '标题 账号与安全', 定位: page.getByText('账号与安全', { exact: true }) },
      { 名称: '手机号行', 定位: page.getByRole('button', { name: /手机号/ }) },
      { 名称: '当前设备行', 定位: page.getByText('当前设备', { exact: true }) },
      { 名称: '注销账号按钮', 定位: page.getByRole('button', { name: '注销账号' }) },
    ];
  },
});

// candidate-feedback：反馈与举报页，求职端已注册（P8 Task 8 新增 Mock 场景）。
// 同上：标题是 返回栏 标题（div）；首分类片恰是举报类「举报虚假岗位」，输入区唯一
// textarea，提交键与分类片用 exact 区分。
const 反馈场景 = 构造场景({
  id: 'candidate-feedback',
  状态: '求职端已注册',
  路径: '/#/feedback',
  关键元素(page: Page) {
    return [
      { 名称: '标题 反馈与举报', 定位: page.getByText('反馈与举报', { exact: true }) },
      { 名称: '首分类片 举报虚假岗位', 定位: page.getByRole('button', { name: '举报虚假岗位' }) },
      { 名称: '输入区 textarea', 定位: page.getByRole('textbox') },
      { 名称: '提交按钮', 定位: page.getByRole('button', { name: '提交', exact: true }) },
    ];
  },
});

export const 视觉场景们: 视觉场景[] = [
  登录场景,
  身份场景,
  偏好场景,
  薪资场景,
  简历场景,
  市场场景,
  在谈首页场景,
  在谈详情场景,
  消息场景,
  我筛选层场景,
  个人信息场景,
  招聘名片场景,
  发岗一场景,
  发岗二场景,
  发岗三场景,
  候选画像场景,
  账号安全场景,
  反馈场景,
];
