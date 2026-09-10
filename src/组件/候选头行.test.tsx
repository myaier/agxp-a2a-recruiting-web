// 候选头行：本文件只锚定「未知段上色」这一可选能力（Spec §6）。列表卡把预格式化好的
// 占位文案传进来，并用 未知段们 点名哪些段是占位 —— 头行只给这些段上次要文字色；
// 不传（候选详情 / 匿名在线简历等既有消费者）时渲染一字不变，占位与真实数据同色同粗。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。
// 注：jsdom 不解析 CSS var，次要色断类（class 含「未知段」）即可，真实色由 e2e 断计算值。
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import 候选头行 from './候选头行';

describe('候选头行 · 未知段上色（Spec §6）', () => {
  it('不传 未知段们：三段照常渲染、任何段都不带 未知段 类（详情/匿名简历零差异）', () => {
    render(<候选头行 年限="9 年" 学历="硕士" 求职状态="在职看机会" />);
    for (const 文 of ['9 年', '硕士', '在职看机会']) {
      expect(screen.getByText(文)).toBeTruthy();
      expect(screen.getByText(文).getAttribute('class')).toBeNull();
    }
  });

  it('传入 未知段们：点名段带 未知段 类，已知段不带；占位文案仍由调用方传入并原样渲染', () => {
    render(
      <候选头行
        年限="经验未知"
        学历="硕士"
        求职状态="求职状态未知"
        未知段们={['年限', '求职状态']}
      />,
    );
    for (const 文 of ['经验未知', '求职状态未知']) {
      expect(screen.getByText(文)).toBeTruthy();
      expect((screen.getByText(文).getAttribute('class') ?? '').includes('未知段')).toBe(true);
    }
    expect((screen.getByText('硕士').getAttribute('class') ?? '').includes('未知段')).toBe(false);
  });

  it('空白段照旧不渲染（空白值不给占位色，也不出孤立竖分）', () => {
    render(<候选头行 年限="  " 学历={null} 求职状态="在校" />);
    expect(screen.queryByText(/^\s+$/)).toBeNull();
    expect(screen.getByText('在校')).toBeTruthy();
    expect(screen.queryByText('学历未知')).toBeNull(); // 占位文案不归头行造
    expect(screen.getByText('在校').getAttribute('class')).toBeNull();
  });
});
