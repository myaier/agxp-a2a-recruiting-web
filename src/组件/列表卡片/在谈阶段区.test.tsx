// 在谈阶段区：两类在谈卡共用的卡底阶段区（Spec §5.4）。
// 一行 = 阶段标签 → 可选归属徽标 → 下一步/状态文本 → 详情箭头；注意说明单独在这一行下方。
// 标题/色系/待办/徽标/文本/注意说明 都是显式展示参数（Plan 公共展示契约）：组件不判断
// mock/backend，也不根据标题文本猜状态 —— 色系只走 阶段配色 的四语义闭表，标题原样带出。
// 无 Provider 宿主：卡片不 import Context/路由/HTTP。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { 阶段配色 } from '../通用';
import 在谈阶段区 from './在谈阶段区';
import type { 在谈阶段信息 } from './类型';

function 阶段信息(覆盖: Partial<在谈阶段信息> = {}): 在谈阶段信息 {
  return {
    标题: '匿名初筛',
    色系: '匿名初筛',
    待办: false,
    徽标: null,
    文本: '系统正在核对投递政策',
    注意说明: null,
    ...覆盖,
  };
}

/** 阶段标签胶囊：标题文字所在的那一枚 */
function 阶段胶囊(标题: string): HTMLElement {
  const 文 = screen.getByText(标题);
  const 胶囊 = 文.closest('[class*="阶段标"]');
  if (!(胶囊 instanceof HTMLElement)) throw new Error('标题不在阶段标签胶囊内');
  return 胶囊;
}

describe('在谈阶段区 · 结构（Spec §5.4）', () => {
  it('一行 = 阶段标题 + 状态文本 + 详情箭头；徽标与注意说明缺省不渲染', () => {
    const { container } = render(<在谈阶段区 信息={阶段信息()} />);
    expect(container.querySelector('[data-card-region="stage"]')).toBeTruthy();
    expect(screen.getByText('系统正在核对投递政策')).toBeTruthy();
    expect(screen.getByText('›')).toBeTruthy();
    for (const 徽标文案 of ['需要你', '需注意', '代理处理中']) {
      expect(screen.queryByText(徽标文案)).toBeNull();
    }
    expect(screen.queryByText(/尚未继续/)).toBeNull();
  });

  it('归属徽标按显式参数渲染，三种文案占同一槽位', () => {
    const { rerender } = render(<在谈阶段区 信息={阶段信息({ 徽标: '需要你' })} />);
    expect(screen.getByText('需要你')).toBeTruthy();
    rerender(<在谈阶段区 信息={阶段信息({ 徽标: '需注意' })} />);
    expect(screen.getByText('需注意')).toBeTruthy();
    rerender(<在谈阶段区 信息={阶段信息({ 徽标: '代理处理中' })} />);
    expect(screen.getByText('代理处理中')).toBeTruthy();
  });

  it('注意说明单独放在阶段行下方（Hosted Agent 失败合同的 owner-safe 说明原样带出）', () => {
    render(<在谈阶段区 信息={阶段信息({ 注意说明: 'AI 服务暂时不可用，本 Case 尚未继续' })} />);
    expect(screen.getByText('AI 服务暂时不可用，本 Case 尚未继续')).toBeTruthy();
  });
});

describe('在谈阶段区 · 色系与待办', () => {
  it.each(['匿名初筛', '递交简历', '需要协调', '意向确认'] as const)(
    '色系 %s 用 阶段配色 的同一语义色，不按标题文本猜色',
    (色系) => {
      render(<在谈阶段区 信息={阶段信息({ 色系 })} />);
      expect(阶段胶囊('匿名初筛').style.color).toBe(阶段配色[色系].文字);
    },
  );

  it('标题按显式参数原样渲染（Backend 保留 P5 阶段标题原文），色系独立于标题', () => {
    render(<在谈阶段区 信息={阶段信息({ 标题: '简历提交', 色系: '递交简历' })} />);
    expect(screen.getByText('简历提交')).toBeTruthy();
    expect(screen.queryByText('递交简历')).toBeNull();
    expect(阶段胶囊('简历提交').style.color).toBe(阶段配色['递交简历'].文字);
  });

  it('待办 true 有呼吸点（Mock 需要你），false 无呼吸点（Backend 只留徽标）', () => {
    const { container, rerender } = render(<在谈阶段区 信息={阶段信息({ 待办: true })} />);
    expect(container.querySelector('[class*="阶段点呼吸"]')).toBeTruthy();
    rerender(<在谈阶段区 信息={阶段信息({ 待办: false, 徽标: '代理处理中' })} />);
    expect(container.querySelector('[class*="阶段点呼吸"]')).toBeNull();
  });
});
