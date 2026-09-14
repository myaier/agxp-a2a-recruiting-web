// 简报展示 的受控展示契约：换 props 直接换内容（统计 / 正文 / 漏斗 / 处理文案），
// 维持 / 放宽点击只调用对应回调、组件不自持「已处理」状态（父级不送 处理文案 就不换按钮）。
// 纯内存组件，无需任何 Provider，props 全部自造（不 import fixture）。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { 简报展示, 规则建议 } from './简报展示';
import type { 简报展示属性, 规则建议属性 } from './简报展示';
import 样式 from './简报展示.module.css';

// 自造建议 props：维持 / 放宽 默认各给新 spy，逐条测试再覆盖
const 造建议 = (覆盖: Partial<规则建议属性> = {}): 规则建议属性 => ({
  标题: '要不要松一档？',
  正文前: '近 7 天有 ',
  数值1: '4 个',
  正文中: '岗位卡在',
  数值2: '3 个',
  正文后: '可谈。',
  维持文案: '维持红线',
  放宽文案: '改成可谈',
  处理文案: null,
  维持: vi.fn(),
  放宽: vi.fn(),
  ...覆盖,
});

// 自造漏斗：一档不可点 + 一档可点（动作说明=读屏整句）；人数/宽度可覆盖供 rerender 断言
const 造漏斗 = (可点: { 人数: number; 宽度: number; 按下: () => void }) => [
  { 名称: '触达', 人数: 3, 宽度: 40, 动作: null },
  {
    名称: '硬性匹配',
    人数: 可点.人数,
    宽度: 可点.宽度,
    动作: { 说明: '硬性匹配 12，打开本周初筛记录', 按下: 可点.按下 },
  },
];

const 造属性 = (覆盖: Partial<简报展示属性> = {}): 简报展示属性 => ({
  外观: '求职',
  标题: '今日简报',
  更新时间: '09:00 更新',
  统计: [{ 名称: '在谈', 数值: '0', 强调: false }],
  正文前: '旧正文：',
  正文强调: '0 件事',
  正文后: '等你定。',
  脚注: '每天 09:00 更新',
  建议: 造建议(),
  漏斗: 造漏斗({ 人数: 12, 宽度: 62, 按下: vi.fn() }),
  ...覆盖,
});

describe('规则建议', () => {
  it('处理文案 null 出双按钮；点维持只调维持，且一次点击不自动替换按钮', () => {
    const 维持 = vi.fn();
    const 放宽 = vi.fn();
    render(<规则建议 {...造建议({ 维持, 放宽 })} />);
    expect(screen.getByRole('button', { name: '维持红线' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '改成可谈' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '维持红线' }));
    expect(维持).toHaveBeenCalledTimes(1);
    expect(放宽).not.toHaveBeenCalled();
    // 父级没送 处理文案，组件不得自行变「已处理」
    expect(screen.getByRole('button', { name: '维持红线' })).toBeTruthy();
    expect(screen.queryByText(/规则不变/)).toBeNull();
  });

  it('点放宽只调放宽，同样不自动替换按钮', () => {
    const 维持 = vi.fn();
    const 放宽 = vi.fn();
    render(<规则建议 {...造建议({ 维持, 放宽 })} />);
    fireEvent.click(screen.getByRole('button', { name: '改成可谈' }));
    expect(放宽).toHaveBeenCalledTimes(1);
    expect(维持).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '改成可谈' })).toBeTruthy();
  });

  it('父级送来处理文案才替换：只显示该文案，双按钮退场；送回 null 恢复双按钮', () => {
    const 页 = render(<规则建议 {...造建议()} />);
    expect(screen.getByRole('button', { name: '维持红线' })).toBeTruthy();
    页.rerender(
      <规则建议 {...造建议({ 处理文案: '已维持红线 · 规则不变，我会继续替你挡掉。' })} />,
    );
    expect(screen.getByText('已维持红线 · 规则不变，我会继续替你挡掉。')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '维持红线' })).toBeNull();
    expect(screen.queryByRole('button', { name: '改成可谈' })).toBeNull();
    页.rerender(<规则建议 {...造建议()} />);
    expect(screen.getByRole('button', { name: '维持红线' })).toBeTruthy();
    expect(screen.queryByText(/规则不变/)).toBeNull();
  });
});

describe('简报展示', () => {
  it('外壳是代理气泡框：内容包在气泡里，端差外观容器挂在本模块外观类上', () => {
    const 页 = render(<简报展示 {...造属性()} />);
    // 气泡壳来自 对话展示 module（类名跨文件不同，按「代理气泡」子串匹配），简报内容是其后代
    const 气泡 = 页.container.querySelector('div[class*="代理气泡"]');
    expect(气泡).toBeTruthy();
    expect(气泡?.textContent).toContain('今日简报');
    expect(气泡?.textContent).toContain('09:00 更新');
    // 端差后代选择器依赖的外观容器（本模块的 求职 类）真实挂在 DOM 上
    expect(页.container.querySelector(`.${样式.求职}`)).toBeTruthy();
  });

  it('同实例 rerender：统计 0→12、正文、漏斗人数/宽度依次直接更新', () => {
    const 页 = render(<简报展示 {...造属性()} />);
    expect(screen.getByText('0')).toBeTruthy();
    // 正文是一段里嵌 <b> 强调（getByText 只拼直接文本节点），用正文前缀正则断言段落
    expect(screen.getByText(/旧正文：/)).toBeTruthy();

    页.rerender(
      <简报展示
        {...造属性({
          统计: [{ 名称: '在谈', 数值: '12', 强调: true }],
          正文前: '新正文：',
          正文强调: '12 件事',
          正文后: '等你拍板。',
          漏斗: 造漏斗({ 人数: 5, 宽度: 22, 按下: vi.fn() }),
        })}
      />,
    );
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText(/新正文：/)).toBeTruthy();
    expect(screen.queryByText(/旧正文：/)).toBeNull();
    // 漏斗人数与宽度：宽度是数据原样传入的百分比，不从人数推算
    expect(screen.getByText('5')).toBeTruthy();
    const 可点行 = screen.getByRole('button', { name: '硬性匹配 12，打开本周初筛记录' });
    const 漏斗条 = 可点行.querySelector(`[class*="${样式.漏斗条}"]`) as HTMLElement;
    expect(漏斗条.style.width).toBe('22%');
  });

  it('处理文案 null 与数值 0 不混淆：null 出双按钮，文案送入才替换，统计 0 不受牵连', () => {
    const 页 = render(<简报展示 {...造属性()} />);
    // 统计数值 0 照常显示，同时 处理文案 null 出双按钮
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByRole('button', { name: '维持红线' })).toBeTruthy();

    页.rerender(<简报展示 {...造属性({ 建议: 造建议({ 处理文案: '已维持红线 · 规则不变。' }) })} />);
    expect(screen.getByText('已维持红线 · 规则不变。')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '维持红线' })).toBeNull();
    // 处理文案变化不牵连统计：数值 0 仍在场
    expect(screen.getByText('0')).toBeTruthy();

    页.rerender(<简报展示 {...造属性()} />);
    expect(screen.getByRole('button', { name: '维持红线' })).toBeTruthy();
  });

  it('漏斗只有动作非 null 的档是 button（aria-label=说明、内部 span 不嵌按钮），其余档是 div', () => {
    const 页 = render(<简报展示 {...造属性()} />);
    const 可点行 = screen.getByRole('button', { name: '硬性匹配 12，打开本周初筛记录' });
    expect(可点行.querySelector('button')).toBeNull(); // button 内容模型只允许短语内容
    expect(可点行.querySelector('span')).toBeTruthy();
    // 整份简报里按钮只有 3 个：漏斗可点行 1 + 建议双按钮 2 —— 不可点档没有按钮语义
    expect(页.container.querySelectorAll('button').length).toBe(3);
    const 触达行 = screen.getByText('触达').closest('div') as HTMLElement;
    expect(触达行.tagName).toBe('DIV');
  });

  it('点击漏斗可点行只调用该行动作回调', () => {
    const 按下 = vi.fn();
    render(
      <简报展示
        {...造属性({
          漏斗: 造漏斗({ 人数: 12, 宽度: 62, 按下 }),
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '硬性匹配 12，打开本周初筛记录' }));
    expect(按下).toHaveBeenCalledTimes(1);
  });

  it('漏斗为 null 不渲染漏斗块（求职端），招聘端照常渲染', () => {
    const 页 = render(<简报展示 {...造属性({ 漏斗: null, 外观: '求职' })} />);
    expect(页.container.querySelector(`[class*="${样式.漏斗块}"]`)).toBeNull();
    expect(screen.queryByText('触达')).toBeNull();

    const 招聘页 = render(<简报展示 {...造属性({ 外观: '招聘' })} />);
    expect(招聘页.container.querySelector(`[class*="${样式.漏斗块}"]`)!.tagName).toBe('DIV');
  });
});
