// 详情状态区 · 无 Provider 展示测试：「代谈进度」的状态行（徽标 + 闭词状态 + 步骤说明 +
// 轮次 + 注意说明）。内容全部由 状态区信息 给定，组件不做任何业务推导：
//   · 徽标三值各有既有样式位，终局（null）徽标退场但状态行仍在（不隐藏信息区）；
//   · 轮次真实值原样（0 是合法值），null（Mock 等没有轮次字段的来源）显示「轮次 —」
//     并带可访问的缺失说明，绝不编造数字；
//   · 注意说明只在有值时出现；步骤缺失不编说明。
// 仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { 详情状态区 } from './详情状态区';
import 样式 from './详情外壳.module.css';
import type { 状态区信息 } from './类型';

function 信息(覆盖: Partial<状态区信息> = {}): 状态区信息 {
  return {
    阶段: '匿名初筛',
    状态: '待处理',
    步骤: '等待人工决定是否继续',
    轮次: { 当前: 1, 预算: 3 },
    徽标: '需要你',
    注意说明: null,
    ...覆盖,
  };
}

describe('详情状态区 · 徽标与状态行', () => {
  it('待办：徽标「需要你」用待办样式位，闭词状态/步骤说明/轮次原样在场', () => {
    render(<详情状态区 信息={信息()} />);
    expect(screen.getByText('需要你').className).toContain(样式.徽标待办);
    expect(screen.getByText('待处理').className).toContain(样式.状态标);
    expect(screen.getByText('等待人工决定是否继续')).toBeTruthy();
    expect(screen.getByText('轮次 1/3')).toBeTruthy();
  });

  it('「需注意」与「代理处理中」走各自的既有样式位（owner-safe，不混用警示色）', () => {
    const 注意 = render(<详情状态区 信息={信息({ 徽标: '需注意', 状态: '进行中', 注意说明: '本阶段需要注意' })} />);
    expect(screen.getByText('需注意').className).toContain(样式.徽标待办);
    注意.unmount();
    const 代理 = render(<详情状态区 信息={信息({ 徽标: '代理处理中', 状态: '进行中' })} />);
    expect(screen.getByText('代理处理中').className).toContain(样式.徽标代理);
    expect(screen.getByText('代理处理中').className).not.toContain(样式.徽标待办);
    代理.unmount();
  });

  it('终局（徽标 null）：徽标位退场，状态行与轮次仍在，不隐藏整个信息区', () => {
    render(<详情状态区 信息={信息({ 徽标: null, 状态: '已结束' })} />);
    expect(screen.queryByText('需要你')).toBeNull();
    expect(screen.queryByText('代理处理中')).toBeNull();
    expect(screen.getByText('已结束')).toBeTruthy();
    expect(screen.getByText('轮次 1/3')).toBeTruthy();
  });

  it('注意说明只在有值时渲染（不人为制造注意提示）', () => {
    const 无说明 = render(<详情状态区 信息={信息()} />);
    expect(screen.queryByText('本阶段需要注意')).toBeNull();
    无说明.unmount();
    render(<详情状态区 信息={信息({ 注意说明: 'AI 服务暂时不可用，本 Case 尚未继续' })} />);
    expect(screen.getByText('AI 服务暂时不可用，本 Case 尚未继续').className).toContain(样式.注意说明);
  });
});

describe('详情状态区 · 轮次与缺失', () => {
  it('轮次 0/0 是合法数值：显示 0，不显示缺失', () => {
    render(<详情状态区 信息={信息({ 轮次: { 当前: 0, 预算: 0 } })} />);
    expect(screen.getByText('轮次 0/0')).toBeTruthy();
    expect(screen.queryByTitle('轮次缺失')).toBeNull();
  });

  it('轮次缺失（Mock 等没有该字段的来源）：显示「轮次 —」并带可访问说明，不编造数字', () => {
    render(<详情状态区 信息={信息({ 轮次: null })} />);
    expect(screen.getByText('轮次 —')).toBeTruthy();
    expect(screen.getByTitle('轮次缺失')).toBeTruthy();
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('步骤缺失：位置留白不编说明（信息区本体仍在）', () => {
    render(<详情状态区 信息={信息({ 步骤: null, 状态: '进行中' })} />);
    expect(screen.getByText('进行中')).toBeTruthy();
    expect(screen.queryByText('等待人工决定是否继续')).toBeNull();
  });
});
