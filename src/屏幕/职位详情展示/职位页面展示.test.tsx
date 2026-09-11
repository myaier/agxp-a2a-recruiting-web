// 职位页面展示 · 展示回调测试（P1 Task 3）。
//
// 展示只承载返回栏 / 正文 / 浮动条 / 更多菜单这一份 JSX：每个动作各调用指定回调一次、
// 禁用不触发；抽屉的收层 / toast / 返回顺序由连接层的 菜单按下/举报 回调承载
//（本组件不改更多打开 来收层）。不拼路由、不读 Context、不区分数据来源。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 样式 from '../职位详情.module.css';
import { 职位页面展示 } from './职位页面展示';
import type { 职位页面展示属性, 职位正文数据 } from './类型';

const 样本数据: 职位正文数据 = {
  职位: '交易中台架构师',
  薪资: '60-80K',
  匹配: { 种类: '核对', 分: 50, 行们: [], 分析: null },
  职位详情标题: '职位详情',
  职位事实行: [],
  职位详情行: ['1、负责交易中台的架构演进；'],
  职位要求标题: '职位要求',
  职位要求行: ['1、5 年以上后端经验。'],
  公司: {
    名称: '美团',
    图: { 种类: '字标', 字: '美' },
    简介: '本地生活',
    资料: { 介绍段: null, 元行组: [] },
  },
  发布人: {
    图: { 种类: '字标', 字: '梁' },
    姓名: '梁思远',
    公司: '美团',
    职务: '招聘负责人',
    备注: '企业直招',
  },
};

/** 基础属性：所有回调都是独立 spy，用例按名取用 */
function 基础属性(覆盖: Partial<职位页面展示属性> = {}): 职位页面展示属性 {
  return {
    数据: 样本数据,
    返回: vi.fn(),
    更多打开: false,
    改更多打开: vi.fn(),
    主按钮: { 文案: '让AI代理去谈', 已委托样式: false, 禁用: false, 按下: vi.fn() },
    不感兴趣: { 禁用: false, 按下: vi.fn(), 菜单可见: true, 菜单按下: vi.fn() },
    举报: vi.fn(),
    ...覆盖,
  };
}

describe('职位页面展示 · 外壳与操作回调', () => {
  it('返回栏返回与「⋯」打开入口各调用一次；更多关闭时不渲染抽屉', async () => {
    const 用户 = userEvent.setup();
    const 属性 = 基础属性();
    render(<职位页面展示 {...属性} />);
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(属性.返回).toHaveBeenCalledTimes(1);
    await 用户.click(screen.getByRole('button', { name: '更多操作' }));
    expect(属性.改更多打开).toHaveBeenCalledTimes(1);
    expect(属性.改更多打开).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('dialog', { name: '职位更多操作' })).toBeNull();
    expect(screen.queryByRole('button', { name: '取消' })).toBeNull();
  });

  it('更多打开=true 渲染抽屉三项与遮罩；取消 / 遮罩各以 false 收层一次', async () => {
    const 用户 = userEvent.setup();
    const 属性 = 基础属性({ 更多打开: true });
    render(<职位页面展示 {...属性} />);
    expect(screen.getByRole('dialog', { name: '职位更多操作' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '不感兴趣，别再推给我' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '举报这个职位' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '取消' })).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '取消' }));
    expect(属性.改更多打开).toHaveBeenCalledTimes(1);
    expect(属性.改更多打开).toHaveBeenCalledWith(false);
    await 用户.click(screen.getByRole('button', { name: '关闭职位更多操作' }));
    expect(属性.改更多打开).toHaveBeenCalledTimes(2);
    expect(属性.改更多打开).toHaveBeenLastCalledWith(false);
  });

  it('抽屉「不感兴趣」调用 菜单按下 一次；收层顺序由回调承载，展示不改更多打开', async () => {
    const 用户 = userEvent.setup();
    const 属性 = 基础属性({ 更多打开: true });
    render(<职位页面展示 {...属性} />);
    await 用户.click(screen.getByRole('button', { name: '不感兴趣，别再推给我' }));
    expect(属性.不感兴趣.菜单按下).toHaveBeenCalledTimes(1);
    expect(属性.不感兴趣.按下).not.toHaveBeenCalled();
    expect(属性.改更多打开).not.toHaveBeenCalled();
  });

  it('抽屉「举报这个职位」调用 举报 一次；收层与开举报层由回调承载', async () => {
    const 用户 = userEvent.setup();
    const 属性 = 基础属性({ 更多打开: true });
    render(<职位页面展示 {...属性} />);
    await 用户.click(screen.getByRole('button', { name: '举报这个职位' }));
    expect(属性.举报).toHaveBeenCalledTimes(1);
    expect(属性.改更多打开).not.toHaveBeenCalled();
  });

  it('浮动条主按钮与不感兴趣圆钮各调用指定回调一次', async () => {
    const 用户 = userEvent.setup();
    const 属性 = 基础属性();
    render(<职位页面展示 {...属性} />);
    await 用户.click(screen.getByRole('button', { name: /让AI代理去谈/ }));
    expect(属性.主按钮.按下).toHaveBeenCalledTimes(1);
    await 用户.click(screen.getByRole('button', { name: '不感兴趣' }));
    expect(属性.不感兴趣.按下).toHaveBeenCalledTimes(1);
    expect(属性.不感兴趣.菜单按下).not.toHaveBeenCalled();
  });

  it('禁用不触发：主按钮 / 不感兴趣（浮动钮与菜单项）禁用时点击零回调', async () => {
    const 用户 = userEvent.setup();
    const 属性 = 基础属性({
      更多打开: true,
      主按钮: { 文案: '正在恢复推荐信息…', 已委托样式: false, 禁用: true, 按下: vi.fn() },
      不感兴趣: { 禁用: true, 按下: vi.fn(), 菜单可见: true, 菜单按下: vi.fn() },
    });
    render(<职位页面展示 {...属性} />);
    const 主键 = screen.getByRole('button', { name: /正在恢复推荐信息…/ }) as HTMLButtonElement;
    const 圆钮 = screen.getByRole('button', { name: '不感兴趣' }) as HTMLButtonElement;
    const 菜单不感兴趣 = screen.getByRole('button', {
      name: '不感兴趣，别再推给我',
    }) as HTMLButtonElement;
    expect(主键.disabled).toBe(true);
    expect(圆钮.disabled).toBe(true);
    expect(菜单不感兴趣.disabled).toBe(true);
    await 用户.click(主键);
    await 用户.click(圆钮);
    await 用户.click(菜单不感兴趣);
    expect(属性.主按钮.按下).not.toHaveBeenCalled();
    expect(属性.不感兴趣.按下).not.toHaveBeenCalled();
    expect(属性.不感兴趣.菜单按下).not.toHaveBeenCalled();
  });

  it('菜单可见=false（详情直取无推荐坐标）：抽屉只有举报与取消', () => {
    const 属性 = 基础属性({ 更多打开: true, 不感兴趣: { 禁用: true, 按下: vi.fn(), 菜单可见: false, 菜单按下: vi.fn() } });
    render(<职位页面展示 {...属性} />);
    expect(screen.queryByRole('button', { name: '不感兴趣，别再推给我' })).toBeNull();
    expect(screen.getByRole('button', { name: '举报这个职位' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '取消' })).toBeTruthy();
  });

  it('正文与主按钮透传：数据渲染、已委托样式走 已委托态 类并禁用、能力回调照常', async () => {
    const 用户 = userEvent.setup();
    const 打开公司 = vi.fn();
    const 直接聊 = vi.fn();
    const 属性 = 基础属性({
      数据: { ...样本数据, 职位: '交易中台架构师' },
      打开公司,
      直接聊,
      主按钮: { 文案: 'AI代理已接手', 已委托样式: true, 禁用: true, 按下: vi.fn() },
    });
    render(<职位页面展示 {...属性} />);
    expect(screen.getByText('交易中台架构师')).toBeTruthy();
    expect(screen.getByText('1、负责交易中台的架构演进；')).toBeTruthy();
    const 主键 = screen.getByRole('button', { name: /AI代理已接手/ });
    expect(主键.className).toContain(样式.已委托态);
    expect(主键.className).not.toContain('可点');
    expect((主键 as HTMLButtonElement).disabled).toBe(true);
    // 可用态主按钮带全局 可点 类（Mock 原样）；能力回调透传给正文
    const 圆钮 = screen.getByRole('button', { name: '不感兴趣' });
    expect(圆钮.className).toContain('可点');
    await 用户.click(screen.getByRole('button', { name: '直接聊' }));
    expect(直接聊).toHaveBeenCalledTimes(1);
    await 用户.click(screen.getByRole('button', { name: /美团/ }));
    expect(打开公司).toHaveBeenCalledTimes(1);
  });
});