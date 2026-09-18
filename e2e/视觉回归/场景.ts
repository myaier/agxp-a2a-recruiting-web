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

// candidate-preferences：完善资料（首屏）屏，求职端已注册（带 legacy 种子）。
// 2026-09-17（Task 5 / Spec §3.2）：期望薪资并入本屏求职意向区域，本场景因此**展示新首屏**
// —— 关键元素补上「期望薪资」选择行（可访问名被 aria-label="期望薪资" 覆盖，行内值不是
// 可访问名的一部分，故按 aria-label 定位；值文本另由功能 Case 断言）。
// 注：种子固定写入 职位:['产品经理']，引导预填被预填，本屏「期望的职位」行回显
// 已选值「产品经理 ›」而非占位「选择期望职位」。按 carry-forward 规则改用匹配已选
// 值的定位（产品经理），不改产品代码、不改种子。占位态也一并兼容（用 alternation）。
const 偏好场景: 视觉场景 = {
  id: 'candidate-preferences',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开稳定页面(page, '/#/student', '求职端已注册');
    await 注入候选突变(page);
    // 首屏比一屏高：把期望薪资行滚进可视区，截图才能核对这一行的实际版式
    //（节问 + 选择行）。确定性滚动，不依赖像素坐标。
    await page.getByRole('button', { name: '期望薪资', exact: true }).scrollIntoViewIfNeeded();
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByRole('heading', { name: '完善资料' })).toBeVisible();
    await expect(page.getByRole('button', { name: '期望薪资', exact: true })).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '标题 完善资料', 定位: page.getByRole('heading', { name: '完善资料' }) },
      { 名称: '按钮 期望职位行', 定位: page.getByRole('button', { name: /产品经理|选择期望职位/ }) },
      { 名称: '选择行 期望薪资', 定位: page.getByRole('button', { name: '期望薪资', exact: true }) },
      { 名称: '按钮 下一步', 定位: page.getByRole('button', { name: '下一步' }) },
    ];
  },
};

// candidate-salary：首屏期望薪资（合同 C / Spec §3.2），求职端已注册。
// 2026-09-17（Task 5）：独立薪资页与向导薪资段已取消，薪资在首屏同一区域采集；本场景改为
// **首屏打开薪资抽屉** —— 到达时点开共用 薪资区间层（与发布岗位同一份档位与面议语义），
// 截图即抽屉形态。关键元素只用抽屉内的稳定锚点（选择行被抽屉遮住，不作为关键元素）。
const 薪资场景: 视觉场景 = {
  id: 'candidate-salary',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开稳定页面(page, '/#/student', '求职端已注册');
    await 注入候选突变(page);
    await page.getByRole('button', { name: '期望薪资', exact: true }).click();
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' })).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    const 抽屉 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
    return [
      { 名称: '抽屉 薪资要求（月薪）', 定位: 抽屉 },
      { 名称: '抽屉 薪资下限轮', 定位: 抽屉.getByRole('listbox', { name: '薪资下限' }) },
      { 名称: '抽屉 确定', 定位: 抽屉.getByRole('button', { name: '确定' }) },
    ];
  },
};

// candidate-resume：日常简历分区编辑的布局（合同 A），求职端已注册。
// 2026-09-17（Task 5 / Spec §5.1）：日常入口不再展示整份聚合页 —— 点区进该区列表、
// 点条目直达该条编辑器；本场景明确落**日常新编辑布局**（工作分区列表：返回栏 + 分区标题
// + 添加行，列表没有第二次「总保存」）。种子无经历，故列表只有添加行。
const 简历场景 = 构造场景({
  id: 'candidate-resume',
  状态: '求职端已注册',
  路径: '/#/experience?from=resume&section=work',
  关键元素(page: Page) {
    return [
      { 名称: '返回按钮', 定位: page.getByRole('button', { name: '返回' }) },
      { 名称: '分区标题 工作经历', 定位: page.getByText('工作经历', { exact: true }).first() },
      { 名称: '按钮 添加工作经历', 定位: page.getByRole('button', { name: '＋ 添加工作经历' }) },
    ];
  },
});

// onboarding-resume-basic-edit：基本信息日常编辑屏（/basic?from=resume，合同 A），
// 求职端已注册。标题按模式区分（不得写「创建在线简历」），整页一个「保存」= 一次提交。
const 基本编辑场景 = 构造场景({
  id: 'onboarding-resume-basic-edit',
  状态: '求职端已注册',
  路径: '/#/basic?from=resume',
  关键元素(page: Page) {
    return [
      { 名称: '标题 编辑基本信息', 定位: page.getByRole('heading', { name: '编辑基本信息' }) },
      { 名称: '标签 姓名', 定位: page.getByText('姓名', { exact: true }) },
      { 名称: '按钮 保存', 定位: page.getByRole('button', { name: '保存' }) },
    ];
  },
});

// onboarding-resume-status-edit：共用求职状态编辑（/onboard/status?from=resume，Spec §6），
// 求职端已注册。三态真实选项（在校/在职/离职）+ 空值不假选 + 保存 single-flight。
// 注：选中态的可访问名带 ✓ 前缀，按 carry-forward 用非精确匹配。
const 状态编辑场景 = 构造场景({
  id: 'onboarding-resume-status-edit',
  状态: '求职端已注册',
  路径: '/#/onboard/status?from=resume',
  关键元素(page: Page) {
    return [
      { 名称: '标题 现在是什么状态？', 定位: page.getByRole('heading', { name: '现在是什么状态？' }) },
      { 名称: '选项 在职', 定位: page.getByRole('button', { name: '在职' }) },
      { 名称: '按钮 保存', 定位: page.getByRole('button', { name: '保存' }) },
    ];
  },
});

// onboarding-recruiter-category：发布岗位的职位类别全屏选择（三级自动展开，Spec §4.2），
// 招聘端已注册。一级打开即出现该一级的二级分组标题（h3，不是按钮）与三级可选岗位 ——
// 不需要再点二级；本场景取首屏（首根 互联网/AI 的第一组 后端开发 与首个岗位 Java）。
const 招聘类别场景: 视觉场景 = {
  id: 'onboarding-recruiter-category',
  状态: '招聘端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开稳定页面(page, '/#/hr/post-job', '招聘端已注册');
    await 注入候选突变(page);
    await page.getByRole('button').filter({ hasText: '职位类别' }).click();
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByRole('dialog', { name: '职位类别' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: '后端开发' })).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    const 弹层 = page.getByRole('dialog', { name: '职位类别' });
    return [
      { 名称: '左栏一级 互联网/AI', 定位: 弹层.getByRole('button', { name: '互联网/AI', exact: true }) },
      { 名称: '右栏二级分组标题 后端开发', 定位: 弹层.getByRole('heading', { level: 3, name: '后端开发' }) },
      { 名称: '右栏三级岗位 Java', 定位: 弹层.getByRole('button', { name: 'Java', exact: true }).first() },
      { 名称: '返回按钮', 定位: 弹层.getByRole('button', { name: '返回' }) },
    ];
  },
};

// candidate-market：看市场子视图，求职端已注册。
// 注：计划字面 ready 含 text「告诉AI代理你的硬性要求」，该文案原只出现在看市场筛选层弹层内
// （筛选层已在第二批 2026-09-09 删除）。按 carry-forward 规则改用默认可见的代理横幅文案作关键元素。
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

// candidate-negotiation-detail：在谈详情的第二 Tab「职位详情」（资料槽），求职端已注册。
// 详情统一（2026-09-10）曾把两个 Tab 改叫 进度/资料；review-r1（同日）按 spec §1/§3.1
// 恢复产品名（第一 Tab 代谈进度、求职端第二 Tab 职位详情）—— 基线与当前同名，
// 锚点收回精确 Tab 按钮名，不再需要跨版本 alternation。到达方式仍用深链 ?tab=job
//（旧页直开 职位详情 Tab、新外壳直开 资料 槽，两端同落点）。「职位详情」同时是 Tab
// 按钮名与内容区块标题，继续用 role=button 锚点避开 strict mode 歧义。
const 在谈详情场景: 视觉场景 = {
  id: 'candidate-negotiation-detail',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开稳定页面(page, '/#/deal/J-01?tab=job', '求职端已注册');
    await 注入候选突变(page);
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

// （原 candidate-me-overlay：我入口 → 待你拍 → 在谈筛选层。在谈筛选层与顶栏「筛选 ▾」已在第二批
//   2026-09-09 整体删除，该场景随之移除；「我」入口与「待你拍」跳转由 我.test.tsx / 在谈首页.test.tsx 覆盖。）

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
// 关键元素锚点（c836f30 修）：该页从 c836f30 起同时有栏匹配标「匹配」与匹配分析卡标题
// 「匹配度分析」，旧锚点 /匹配|在线简历/ 会命中两个元素触发 strict mode violation，采集必失败。
// 改为两个精确锚点，并把「匹配度分析」卡显式纳入几何覆盖——截图像素比较本就覆盖它，
// 这里是把它从「让定位器歧义的新元素」变成「被 harness 盯住的元素」，不是掩盖产品漂移。
// （Task 10 更名：旧组件「匹配对齐卡」已退役，共享卡现名「匹配分析块」，锚点注释随实改名。）
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
      { 名称: '匹配分析卡标题 匹配度分析', 定位: page.getByText('匹配度分析', { exact: true }) },
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

// enterprise-public：企业公开页（Mock 静态档 yunqu），求职端已注册（企业名片统一 Task 3 新增）。
// 统一展示后本页相对基线有 Spec §7 列明的批准差异（缺图字标改空白图位、原先隐藏的缺字段
// 区块出现占位、工商区改名并容纳身份行、主营业务加标签、条款摘要文案），由 ui:check 的
// 逐差异人工对账收口，不在采集口径里掩盖。关键元素只选新旧两版都存在的稳定锚点；
// 新增的占位/空白图位刻意不设为关键元素 —— 基线侧本来就没有这些元素。
const 企业公开页场景 = 构造场景({
  id: 'enterprise-public',
  状态: '求职端已注册',
  路径: '/#/company/yunqu',
  关键元素(page: Page) {
    return [
      { 名称: '公司标题 云衢科技', 定位: page.getByRole('heading', { name: '云衢科技' }) },
      { 名称: '卡标题 公司自述', 定位: page.getByText('公司自述', { exact: true }) },
      { 名称: '文字键 读全文', 定位: page.getByRole('button', { name: '读全文 ›' }) },
      { 名称: '卡标题 办公地', 定位: page.getByText('办公地', { exact: true }) },
      { 名称: '岗位入口 看这家在招', 定位: page.getByRole('button', { name: /看这家在招的/ }) },
    ];
  },
});

// ── 聊天推荐前端修复（Task 6）：两端消息列表 / 真人聊天 / 招聘在线简历纸身的
//    Mock 视觉场景。全部走 Mock 数据源（采集 spec 固定 mock 模式），按独立版式
//    失败面拆分：三行列表、气泡对齐与 32px 头像槽、纸身版式。关键元素记录
//    boundingBox —— 头像槽宽高即「图与首字同尺寸」的采集期几何证据。 ──

// chat-recommend-frontend-candidate-messages：求职端消息列表三行版式（姓名/副标题/摘要）。
const 修复候选消息场景: 视觉场景 = {
  id: 'chat-recommend-frontend-candidate-messages',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开稳定页面(page, '/#/app', '求职端已注册');
    await page.locator('nav').getByRole('button').filter({ hasText: '消息' }).click();
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByRole('button', { name: '搜索' })).toBeVisible();
    await expect(page.getByText('林筱')).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '搜索按钮', 定位: page.getByRole('button', { name: '搜索' }) },
      { 名称: 'AI代理动态行', 定位: page.getByRole('button', { name: /AI代理动态/ }).first() },
      { 名称: '真人会话行 林筱', 定位: page.getByRole('button', { name: /林筱/ }).first() },
      { 名称: '真人会话行头像', 定位: page.getByRole('button', { name: /林筱/ }).first().locator('span[class*="头像"]') },
    ];
  },
};

// chat-recommend-frontend-candidate-chat：求职端真人聊天（Mock 剧情林筱），气泡对齐 + 头像槽。
const 修复候选聊天场景: 视觉场景 = {
  id: 'chat-recommend-frontend-candidate-chat',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开稳定页面(page, '/#/app', '求职端已注册');
    await page.locator('nav').getByRole('button').filter({ hasText: '消息' }).click();
    await page.getByRole('button', { name: /林筱/ }).first().click();
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.locator('span[class*="对方头像"]').first()).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '返回按钮', 定位: page.getByRole('button', { name: '返回' }) },
      { 名称: '对方头像槽', 定位: page.locator('span[class*="对方头像"]').first() },
      { 名称: '我方头像槽', 定位: page.locator('span[class*="我头像"]').first() },
    ];
  },
};

// chat-recommend-frontend-recruiter-messages：招聘端消息列表（去名后列表 + 搜索）。
const 修复招聘消息场景: 视觉场景 = {
  id: 'chat-recommend-frontend-recruiter-messages',
  状态: '招聘端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开稳定页面(page, '/#/hr', '招聘端已注册');
    await page.locator('nav').getByRole('button').filter({ hasText: '消息' }).click();
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByRole('button', { name: '搜索' })).toBeVisible();
    await expect(page.getByText('AI代理动态')).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '搜索按钮', 定位: page.getByRole('button', { name: '搜索' }) },
      { 名称: '搜索输入行', 定位: page.getByRole('textbox', { name: '搜索会话 / 候选 / 岗位' }) },
      { 名称: 'AI代理动态行', 定位: page.getByRole('button', { name: /AI代理动态/ }).first() },
    ];
  },
};

// chat-recommend-frontend-recruiter-chat：招聘端真人聊天（A-01 沈亦舟）+ 操作栏。
const 修复招聘聊天场景: 视觉场景 = 构造场景({
  id: 'chat-recommend-frontend-recruiter-chat',
  状态: '招聘端已注册',
  路径: '/#/hr/chat/A-01',
  就绪(page: Page): Promise<void> {
    return (async () => {
      await expect(page.locator('span[class*="对方头像"]').first()).toBeVisible();
      await expect(page.getByRole('button', { name: '看在线简历' })).toBeVisible();
    })();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '返回按钮', 定位: page.getByRole('button', { name: '返回' }) },
      { 名称: '对方头像槽', 定位: page.locator('span[class*="对方头像"]').first() },
      { 名称: '我方头像槽', 定位: page.locator('span[class*="我头像"]').first() },
      { 名称: '主项 看在线简历', 定位: page.getByRole('button', { name: '看在线简历' }) },
    ];
  },
});

// chat-recommend-frontend-recruiter-resume-paper：招聘端在线简历纸身（Task 4 统一纸身）。
const 修复招聘纸身场景: 视觉场景 = {
  id: 'chat-recommend-frontend-recruiter-resume-paper',
  状态: '招聘端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开稳定页面(page, '/#/hr/chat/A-01', '招聘端已注册');
    await page.getByRole('button', { name: '看在线简历' }).click();
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByText('个人优势').first()).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '纸身姓名 沈亦舟', 定位: page.getByText('沈亦舟', { exact: true }).first() },
      { 名称: '联系方式占位 手机', 定位: page.getByText('手机：—', { exact: true }) },
      { 名称: '段标 工作经历', 定位: page.getByText('工作经历', { exact: true }).first() },
      { 名称: '段标 教育经历', 定位: page.getByText('教育经历', { exact: true }).first() },
      { 名称: '段标 个人优势', 定位: page.getByText('个人优势', { exact: true }).first() },
      { 名称: '继续沟通按钮', 定位: page.getByRole('button', { name: '继续沟通' }) },
    ];
  },
};


// ── 六维展示对齐（Task 10）：匹配解释展示的 Mock 视觉场景。全部走 Mock 数据源
//    （采集 spec 固定 mock 模式），记录快照来自 Mock匹配快照 固定表。 ──

/** 六维场景通用：按视口宽打开页面（采集默认 390；窄屏变体在到达前改视口） */
async function 打开六维页面(page: Page, 路径串: string, 种子: 场景状态种子, 宽?: number): Promise<void> {
  if (宽 !== undefined) await page.setViewportSize({ width: 宽, height: 844 });
  await 打开稳定页面(page, 路径串, 种子);
  await 注入候选突变(page);
}

// match-explanation-detail-four-states：M-11 一条记录四态齐备（matched/partial/
// unknown/not_matched 各一行），总分 52 —— 详情唯一环 + 六维行版式。
const 六维四态场景: 视觉场景 = {
  id: 'match-explanation-detail-four-states',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开六维页面(page, '/#/job/M-11', '求职端已注册');
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByText('匹配度分析', { exact: true })).toBeVisible();
    await expect(page.getByText('命中2/4个岗位关键词')).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '分析标题 匹配度分析', 定位: page.getByText('匹配度分析', { exact: true }) },
      { 名称: '方向行 匹配', 定位: page.getByText('求职方向与岗位方向匹配', { exact: true }) },
      { 名称: '技能行 部分匹配计数', 定位: page.getByText('命中2/4个岗位关键词', { exact: true }) },
      { 名称: '经验行 未核对', 定位: page.getByText('岗位经验要求尚未确认', { exact: true }) },
      { 名称: '薪资行 面议未核对', 定位: page.getByText('薪资面议，尚未核对', { exact: true }) },
      { 名称: '办公方式行 不匹配', 定位: page.getByText('办公方式不匹配', { exact: true }) },
      { 名称: '技能口径说明', 定位: page.getByText('技能按关键词命中核对，不代表能力认证。', { exact: true }) },
    ];
  },
};

// match-explanation-detail-four-states-320：同一四态记录在 320 窄屏 —— 行注长说明
// 换行可读、分项分数列可用（Spec §4 窄屏检查）。
const 六维四态窄屏场景: 视觉场景 = {
  id: 'match-explanation-detail-four-states-320',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开六维页面(page, '/#/job/M-11', '求职端已注册', 320);
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByText('匹配度分析', { exact: true })).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '分析标题 匹配度分析', 定位: page.getByText('匹配度分析', { exact: true }) },
      { 名称: '技能行 部分匹配计数', 定位: page.getByText('命中2/4个岗位关键词', { exact: true }) },
      { 名称: '办公方式行 不匹配', 定位: page.getByText('办公方式不匹配', { exact: true }) },
    ];
  },
};

// match-explanation-skills-partial-zero：M-02 冻结反例 —— 技能 1/100 命中 floor 后
// 0 分仍为部分匹配（0 与缺失不互换），总分 60。
const 六维技能部分零场景: 视觉场景 = {
  id: 'match-explanation-skills-partial-zero',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开六维页面(page, '/#/job/M-02', '求职端已注册');
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByText('命中1/100个岗位关键词')).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '分析标题 匹配度分析', 定位: page.getByText('匹配度分析', { exact: true }) },
      { 名称: '技能行 1/100 命中', 定位: page.getByText('命中1/100个岗位关键词', { exact: true }) },
      { 名称: '技能行 0/35 分', 定位: page.getByText('0/35', { exact: true }) },
      { 名称: '技能行 部分匹配态', 定位: page.getByText('命中部分岗位关键词', { exact: true }) },
      { 名称: '薪资行 接近', 定位: page.getByText('薪资范围接近', { exact: true }) },
    ];
  },
};

// match-explanation-missing：M-04 不在快照表 —— 唯一的「无快照与总分缺失」演示：
// 环位「—」+ 暂无该次匹配的详细分析 + 无推荐上下文，不造 0 分。
const 六维缺失场景: 视觉场景 = {
  id: 'match-explanation-missing',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开六维页面(page, '/#/job/M-04', '求职端已注册');
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByText('暂无该次匹配的详细分析')).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '分析标题 匹配度分析', 定位: page.getByText('匹配度分析', { exact: true }) },
      { 名称: '缺失说明', 定位: page.getByText('暂无该次匹配的详细分析', { exact: true }) },
      { 名称: '缺分位 匹配分未知', 定位: page.getByRole('img', { name: '匹配分未知' }) },
    ];
  },
};

// match-explanation-list-popup：市场列表 → 原分数环位的独立分析入口 → 共享分析弹层
//（岗位上下文行 + 藏环文本总分 + 六维行），关闭键可见。
const 六维列表弹层场景: 视觉场景 = {
  id: 'match-explanation-list-popup',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开六维页面(page, '/#/app', '求职端已注册');
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await page.getByRole('button', { name: '查看匹配分析' }).first().click();
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByRole('dialog', { name: '匹配度分析' })).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    const 弹层 = page.getByRole('dialog', { name: '匹配度分析' });
    return [
      { 名称: '弹层 匹配度分析', 定位: 弹层 },
      { 名称: '弹层关闭键', 定位: 弹层.getByRole('button', { name: '关闭', exact: true }) },
      { 名称: '弹层文本总分', 定位: 弹层.getByText(/分$/, { exact: false }) },
      { 名称: '弹层六维行 技能计数', 定位: 弹层.getByText(/命中\d+\/\d+个岗位关键词/) },
    ];
  },
};

// match-explanation-recruiter-resume-analysis：招聘端聊天「看在线简历」层 ——
// 简历纸身之后是本会话 Case 的独立分析区（A-01 总分 94，不混入纸身正文）。
const 六维招聘纸身分析场景: 视觉场景 = {
  id: 'match-explanation-recruiter-resume-analysis',
  状态: '招聘端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开六维页面(page, '/#/hr/chat/A-01', '招聘端已注册');
    await page.getByRole('button', { name: '看在线简历' }).click();
  },
  async 就绪(page: Page): Promise<void> {
    const 层 = page.getByRole('dialog', { name: '看在线简历' });
    await expect(层).toBeVisible();
    await expect(层.getByText('匹配度分析', { exact: true })).toBeVisible();
    // 独立分析区在纸身之后：滚动进可视区再截图（采集是视口截图）
    await 层.getByText('匹配度分析', { exact: true }).scrollIntoViewIfNeeded();
  },
  关键元素(page: Page): 关键元素描述[] {
    const 层 = page.getByRole('dialog', { name: '看在线简历' });
    return [
      { 名称: '层 看在线简历', 定位: 层 },
      { 名称: '纸身段标 工作经历', 定位: 层.getByText('工作经历', { exact: true }).first() },
      { 名称: '分析标题 匹配度分析', 定位: 层.getByText('匹配度分析', { exact: true }) },
      { 名称: '分析技能计数', 定位: 层.getByText('命中35/36个岗位关键词', { exact: true }) },
      { 名称: '层关闭/继续沟通键', 定位: 层.getByRole('button', { name: '继续沟通' }) },
    ];
  },
};

// ── Task 4 视觉义务：四张共享列表卡「传回调态」的可点击环（44px 触摸区）与
//    不挤薪资/不破行 —— 普通宽度 390 全覆盖，带薪资串的两卡另加 360/320 窄屏。──

// match-explanation-card-market-*：求职推荐卡（市场列表，薪资 + 环同列）。
const 六维市场卡场景: 视觉场景 = {
  id: 'match-explanation-card-market-390',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开六维页面(page, '/#/app', '求职端已注册');
    await page.getByRole('button', { name: '市场', exact: true }).click();
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByRole('button', { name: '查看匹配分析' }).first()).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    const 卡 = page.locator('[data-testid="市场卡"], [class*="市场卡"]').first();
    return [
      { 名称: '首卡分析入口 查看匹配分析', 定位: page.getByRole('button', { name: '查看匹配分析' }).first() },
      { 名称: '首卡薪资', 定位: page.locator('[class*="薪资"]').first() },
    ];
  },
};

const 六维市场卡360场景: 视觉场景 = {
  id: 'match-explanation-card-market-360',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开六维页面(page, '/#/app', '求职端已注册', 360);
    await page.getByRole('button', { name: '市场', exact: true }).click();
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByRole('button', { name: '查看匹配分析' }).first()).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '首卡分析入口 查看匹配分析', 定位: page.getByRole('button', { name: '查看匹配分析' }).first() },
      { 名称: '首卡薪资', 定位: page.locator('[class*="薪资"]').first() },
    ];
  },
};

const 六维市场卡320场景: 视觉场景 = {
  id: 'match-explanation-card-market-320',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开六维页面(page, '/#/app', '求职端已注册', 320);
    await page.getByRole('button', { name: '市场', exact: true }).click();
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByRole('button', { name: '查看匹配分析' }).first()).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '首卡分析入口 查看匹配分析', 定位: page.getByRole('button', { name: '查看匹配分析' }).first() },
      { 名称: '首卡薪资', 定位: page.locator('[class*="薪资"]').first() },
    ];
  },
};

// match-explanation-card-deals-*：求职在谈卡（在谈首页，薪资 + 环同列）。
const 六维在谈卡场景: 视觉场景 = {
  id: 'match-explanation-card-deals-390',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开六维页面(page, '/#/app', '求职端已注册');
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByRole('button', { name: '查看匹配分析' }).first()).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '首卡分析入口 查看匹配分析', 定位: page.getByRole('button', { name: '查看匹配分析' }).first() },
      { 名称: '首卡薪资', 定位: page.locator('[class*="薪资"]').first() },
    ];
  },
};

const 六维在谈卡320场景: 视觉场景 = {
  id: 'match-explanation-card-deals-320',
  状态: '求职端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开六维页面(page, '/#/app', '求职端已注册', 320);
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByRole('button', { name: '查看匹配分析' }).first()).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '首卡分析入口 查看匹配分析', 定位: page.getByRole('button', { name: '查看匹配分析' }).first() },
      { 名称: '首卡薪资', 定位: page.locator('[class*="薪资"]').first() },
    ];
  },
};

// match-explanation-card-hr-deals-390：招聘在谈卡（Mock 在谈候选，环独立入口）。
const 六维招聘在谈卡场景: 视觉场景 = {
  id: 'match-explanation-card-hr-deals-390',
  状态: '招聘端已注册',
  async 到达(page: Page): Promise<void> {
    await 打开六维页面(page, '/#/hr', '招聘端已注册');
  },
  async 就绪(page: Page): Promise<void> {
    await expect(page.getByRole('button', { name: '查看匹配分析' }).first()).toBeVisible();
  },
  关键元素(page: Page): 关键元素描述[] {
    return [
      { 名称: '首卡分析入口 查看匹配分析', 定位: page.getByRole('button', { name: '查看匹配分析' }).first() },
      { 名称: '首卡阶段徽标', 定位: page.locator('[data-card-region="stage"]').first() },
    ];
  },
};

export const 视觉场景们: 视觉场景[] = [
  登录场景,
  身份场景,
  偏好场景,
  薪资场景,
  简历场景,
  基本编辑场景,
  状态编辑场景,
  市场场景,
  在谈首页场景,
  在谈详情场景,
  消息场景,
  个人信息场景,
  招聘名片场景,
  发岗一场景,
  发岗二场景,
  发岗三场景,
  招聘类别场景,
  候选画像场景,
  账号安全场景,
  反馈场景,
  企业公开页场景,
  修复候选消息场景,
  修复候选聊天场景,
  修复招聘消息场景,
  修复招聘聊天场景,
  修复招聘纸身场景,
  // 六维展示对齐（Task 10）
  六维四态场景,
  六维四态窄屏场景,
  六维技能部分零场景,
  六维缺失场景,
  六维列表弹层场景,
  六维招聘纸身分析场景,
  六维市场卡场景,
  六维市场卡360场景,
  六维市场卡320场景,
  六维在谈卡场景,
  六维在谈卡320场景,
  六维招聘在谈卡场景,
];
