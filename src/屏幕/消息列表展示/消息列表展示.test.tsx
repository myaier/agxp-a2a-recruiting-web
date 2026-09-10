// 消息列表展示 · 展示测试（P1 Task 4）：搜索图标聚焦输入、输入/页签受控回调、
// 文字行与数字/红点标记、前置错误+缓存行+后置提示共存、加载更多回调存在才显示、
// 空副标题仍留节点（不生成假姓名/假会话）、超长文本的 class 保留断言、
// 同一行 rerender 有值→空切换无残留。jsdom 不证明几何/截断（Task 5 双宽验证）。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 样式 from '../消息列表.module.css';
import { 会话行, 消息列表展示 } from './消息列表展示';
import type { 会话行数据, 消息列表展示属性 } from './类型';

function 行(覆盖: Partial<会话行数据> = {}): 会话行数据 {
  return {
    键: '3003',
    标题: '后端工程师',
    副标题: '上海·浦东',
    时间: '08-30',
    摘要: '收到！明天下午聊',
    头像: { 种类: '字标', 字: '会', 底色: 'var(--最弱)' },
    未读: { 种类: '无' },
    按下: () => {},
    ...覆盖,
  };
}

function 属性(覆盖: Partial<消息列表展示属性> = {}): 消息列表展示属性 {
  return {
    页签: '全部',
    改页签: () => {},
    搜索词: '',
    改搜索词: () => {},
    搜索提示: '搜索会话 / 公司 / 职位',
    前置提示: [],
    行们: [行()],
    后置提示: [],
    ...覆盖,
  };
}

describe('消息列表展示 · 外壳', () => {
  it('点右上角放大镜把焦点送进搜索输入框（ref 与聚焦留在展示层）', async () => {
    render(<消息列表展示 {...属性()} />);
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(document.activeElement).toBe(screen.getByPlaceholderText('搜索会话 / 公司 / 职位'));
  });

  it('输入与页签都是受控回调；选中页签带选中类，其余带未选类', async () => {
    const 改搜索词 = vi.fn();
    const 改页签 = vi.fn();
    const 视图 = render(<消息列表展示 {...属性({ 改搜索词, 改页签 })} />);
    await userEvent.type(screen.getByPlaceholderText('搜索会话 / 公司 / 职位'), '后');
    expect(改搜索词).toHaveBeenLastCalledWith('后');
    await userEvent.click(screen.getByRole('button', { name: '仅会话' }));
    expect(改页签).toHaveBeenCalledWith('仅会话');

    视图.rerender(<消息列表展示 {...属性({ 页签: '仅会话', 改页签 })} />);
    const 页签按钮 = 视图.getAllByRole('button', { name: /^(全部|仅会话|通知)$/ });
    expect(页签按钮.find((按钮) => 按钮.textContent === '仅会话')!.className).toContain(样式.页签选中);
    expect(页签按钮.find((按钮) => 按钮.textContent === '全部')!.className).toContain(样式.页签未选);
    expect(页签按钮.find((按钮) => 按钮.textContent === '通知')!.className).toContain(样式.页签未选);
  });

  it('搜索提示由连接层给（招聘端换业务视角文案）', () => {
    render(<消息列表展示 {...属性({ 搜索提示: '搜索会话 / 候选 / 岗位' })} />);
    expect(screen.getByPlaceholderText('搜索会话 / 候选 / 岗位')).toBeTruthy();
  });
});

describe('消息列表展示 · 会话行', () => {
  it('文字行齐全，数字徽标带未读测试标识与原数量', () => {
    const 视图 = render(
      <消息列表展示
        {...属性({ 行们: [行({ 未读: { 种类: '数字', 数量: 3 }, 未读测试标识: 'unread-3003' })] })}
      />,
    );
    expect(screen.getByText('后端工程师')).toBeTruthy();
    expect(screen.getByText('上海·浦东')).toBeTruthy();
    expect(screen.getByText('08-30')).toBeTruthy();
    expect(screen.getByText('收到！明天下午聊')).toBeTruthy();
    const 徽标 = screen.getByTestId('unread-3003');
    expect(徽标.textContent).toBe('3');
    expect(徽标.className).toContain(样式.未读徽标);
    expect(视图.container.querySelector(`.${样式.会话行}`)).not.toBeNull();
    expect(视图.container.querySelector(`.${样式.头像}`)!.textContent).toBe('会');
  });

  it('红点行出红点、无标记行两者都不出；Mock 数字行无测试标识也不渲染 data-testid', () => {
    const 有红点 = render(<会话行 数据={行({ 未读: { 种类: '红点' } })} />);
    expect(有红点.container.querySelector(`.${样式.红点}`)).not.toBeNull();
    expect(有红点.container.querySelector(`.${样式.未读徽标}`)).toBeNull();

    const 无标记 = render(<会话行 数据={行()} />);
    expect(无标记.container.querySelector(`.${样式.红点}`)).toBeNull();
    expect(无标记.container.querySelector(`.${样式.未读徽标}`)).toBeNull();

    const Mock数字 = render(<会话行 数据={行({ 未读: { 种类: '数字', 数量: 2 } })} />);
    expect(Mock数字.container.querySelector(`.${样式.未读徽标}`)!.textContent).toBe('2');
    expect(Mock数字.container.querySelector('[data-testid]')).toBeNull();
  });

  it('代理头像与字标头像都落在原 46px 容器 class 上；整行按下透传一次', async () => {
    const 按下 = vi.fn();
    const 字标 = render(<会话行 数据={行({ 按下 })} />);
    expect(字标.container.querySelector(`.${样式.头像}`)!.getAttribute('style')).toContain('var(--最弱)');
    await userEvent.click(字标.container.querySelector(`.${样式.会话行}`)!);
    expect(按下).toHaveBeenCalledTimes(1);

    const 代理 = render(<会话行 数据={行({ 头像: { 种类: '代理' } })} />);
    expect(代理.container.querySelector(`.${样式.代理头像}`)).not.toBeNull();
    expect(代理.container.querySelector(`.${样式.头像}`)).toBeNull();
  });

  it('超长标题/副标题/摘要上屏且共享样式类保留（副标题/摘要仍带单行类）', () => {
    const 长标题 = '资深后端工程师（交易方向·北京/上海·年薪面议·直招不猎头·2026秋招)';
    const 长副标题 = '铨衡人才 · 意向已确认 · 真人沟通 · 流程约 90 分钟 · 面试官是邵铭 + 架构评审组';
    const 长摘要 = '收到！面试官是邵铭 + 架构评审组，流程约 90 分钟，请提前准备系统设计题与项目复盘材料。';
    const 视图 = render(<会话行 数据={行({ 标题: 长标题, 副标题: 长副标题, 摘要: 长摘要 })} />);
    expect(screen.getByText(长标题)).toBeTruthy();
    expect(screen.getByText(长副标题)).toBeTruthy();
    expect(screen.getByText(长摘要)).toBeTruthy();
    expect(视图.container.querySelector(`.${样式.会话标题}`)!.className).toContain(样式.会话标题);
    expect(视图.container.querySelector(`.${样式.会话副标题}`)!.className).toContain('单行');
    expect(视图.container.querySelector(`.${样式.会话摘要}`)!.className).toContain('单行');
    expect(视图.container.querySelector(`.${样式.会话时间}`)!.className).toContain('等宽数字');
  });

  it('空副标题仍留节点，不生成假姓名或假会话文案', () => {
    const 视图 = render(<会话行 数据={行({ 标题: '会话信息暂不可用', 副标题: '' })} />);
    const 副标题节点 = 视图.container.querySelector(`.${样式.会话副标题}`);
    expect(副标题节点).not.toBeNull();
    expect(副标题节点!.textContent).toBe('');
    expect(视图.container.textContent).not.toContain('未知');
    expect(视图.container.textContent).not.toContain('未知会话');
  });

  it('rerender 同一行有值→空切换：旧标题/副标题/摘要/数字徽标不残留，空副标题节点仍在，时间仍可见', () => {
    const 视图 = render(
      <会话行
        数据={行({
          标题: '后端工程师',
          副标题: '上海·浦东',
          摘要: '收到！明天下午聊',
          未读: { 种类: '数字', 数量: 3 },
          未读测试标识: 'unread-3003',
          时间: '08-30',
        })}
      />,
    );
    视图.rerender(
      <会话行
        数据={行({
          标题: '会话信息暂不可用',
          副标题: '',
          摘要: '已建立真人会话',
          未读: { 种类: '无' },
          时间: '08-30',
        })}
      />,
    );
    expect(screen.queryByText('后端工程师')).toBeNull();
    expect(screen.queryByText('上海·浦东')).toBeNull();
    expect(screen.queryByText('收到！明天下午聊')).toBeNull();
    expect(screen.queryByTestId('unread-3003')).toBeNull();
    const 副标题节点 = 视图.container.querySelector(`.${样式.会话副标题}`);
    expect(副标题节点).not.toBeNull();
    expect(副标题节点!.textContent).toBe('');
    expect(screen.getByText('已建立真人会话')).toBeTruthy();
    expect(screen.getByText('08-30')).toBeTruthy();
  });
});

describe('消息列表展示 · 状态区', () => {
  it('前置错误（带重试）+ 缓存行 + 后置提示同时可见', async () => {
    const 重试 = vi.fn();
    const 视图 = render(
      <消息列表展示
        {...属性({
          前置提示: [{ 键: '错误', 行们: ['后端服务暂时不可用，请稍后重试'], 操作: { 文案: '重试', 按下: 重试 } }],
          后置提示: [{ 键: '无匹配', 行们: ['没有匹配的会话。', '换个关键词，或者切到「全部」看看。'] }],
        })}
      />,
    );
    // 多行空态在原实现里是 文案<br/>文案，文本节点合在一个元素里（沿用原结构断言）
    expect(screen.getByText('后端服务暂时不可用，请稍后重试')).toBeTruthy();
    expect(screen.getByText('后端工程师')).toBeTruthy();
    const 空态们 = 视图.container.querySelectorAll(`.${样式.空态}`);
    expect(空态们.length).toBe(2);
    expect(空态们[0].textContent).toContain('后端服务暂时不可用，请稍后重试');
    expect(空态们[1].textContent).toContain('没有匹配的会话。');
    expect(空态们[1].textContent).toContain('换个关键词，或者切到「全部」看看。');
    // 错误块保留原 `{错误文案}<br/><button>重试</button>` 结构：重试按钮独占一行
    expect(空态们[0].lastElementChild!.tagName).toBe('BUTTON');
    expect(空态们[0].lastElementChild!.previousElementSibling!.tagName).toBe('BR');
    await userEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(重试).toHaveBeenCalledTimes(1);
  });

  it('加载更多回调存在才显示，点击透传；不传则不渲染按钮', async () => {
    const 加载更多 = vi.fn();
    const 有 = render(<消息列表展示 {...属性({ 加载更多 })} />);
    await userEvent.click(screen.getByRole('button', { name: '加载更多' }));
    expect(加载更多).toHaveBeenCalledTimes(1);
    有.unmount();

    render(<消息列表展示 {...属性()} />);
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();
  });

  it('多行提示按行渲染，单行提示不夹带多余结构', () => {
    const 视图 = render(
      <消息列表展示 {...属性({ 前置提示: [{ 键: '读入中', 行们: ['正在读入会话…'] }] })} />,
    );
    expect(screen.getByText('正在读入会话…')).toBeTruthy();
    expect(视图.container.querySelector(`.${样式.空态}`)).not.toBeNull();
  });
});