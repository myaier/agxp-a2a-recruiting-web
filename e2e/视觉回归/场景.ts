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

export const 视觉场景们: 视觉场景[] = [登录场景, 身份场景, 偏好场景, 薪资场景, 简历场景];