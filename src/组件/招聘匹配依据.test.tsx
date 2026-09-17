// 招聘匹配依据组件（Task 5 / Spec §5、契约 C）：六行只读展示的纯渲染契约。
// 锁定：六维标签按序在场；positive 用勾、其余状态无勾；不画缺项不匹配叉；
// 不展示逐项分值/满分（正文无数字分数）；统一说明「当前接口仅提供部分匹配依据」；
// 状态与说明由映射层给定，组件不猜词义、不读应用状态。

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { 招聘匹配依据 } from './招聘匹配依据';
import { 映射招聘匹配依据 } from '../数据/招聘匹配依据映射';
import type { 匹配依据行 } from '../数据/招聘匹配依据映射';

/** 齐备样本：四正向 + 技能有命中 + 薪资交集（真实映射产出，不手抄第二份文案） */
const 齐备行们 = 映射招聘匹配依据({
  highlights: ['category_matched', 'skills_matched', 'experience_met', 'location_matched', 'workplace_mode_matched'],
  structuredRequirementsConfirmed: true,
  compensationRelationship: 'overlap',
});

/** 全缺省样本：原因缺席 + 薪资未核对 */
const 缺省行们 = 映射招聘匹配依据({
  highlights: [],
  structuredRequirementsConfirmed: false,
  compensationRelationship: 'unknown',
});

describe('招聘匹配依据 · 六行布局', () => {
  it('六维标签按 方向/技能/经验/地点/办公方式/薪资 顺序渲染，行文 = 维度 · 说明', () => {
    const { container } = render(<招聘匹配依据 行们={齐备行们} />);
    const 根 = container.firstElementChild;
    if (!(根 instanceof HTMLElement)) throw new Error('组件根节点缺失');
    const 全文 = 根.textContent ?? '';
    const 期望序 = ['方向', '技能', '经验', '地点', '办公方式', '薪资'];
    let 上一位 = -1;
    for (const 标签 of 期望序) {
      const 位 = 全文.indexOf(标签);
      expect(位, `缺少维度标签「${标签}」`).toBeGreaterThan(上一位);
      上一位 = 位;
    }
    expect(screen.getByText('方向 · 职位方向匹配')).toBeTruthy();
    expect(screen.getByText('技能 · 有技能命中')).toBeTruthy();
    expect(screen.getByText('薪资 · 薪资带有交集')).toBeTruthy();
  });

  it('统一说明「当前接口仅提供部分匹配依据」恒在（含齐备样本）', () => {
    render(<招聘匹配依据 行们={齐备行们} />);
    expect(screen.getByText('当前接口仅提供部分匹配依据')).toBeTruthy();
  });
});

describe('招聘匹配依据 · 状态记号', () => {
  it('positive 行用勾（✓），一行一勾', () => {
    const { container } = render(<招聘匹配依据 行们={齐备行们} />);
    const 勾们 = Array.from(container.querySelectorAll('span')).filter((节点) => 节点.textContent === '✓');
    expect(勾们).toHaveLength(5); // 四类正向 + 薪资交集
  });

  it('缺原因行无勾也无叉：not_provided/unknown 只出文字，不画不匹配', () => {
    const { container } = render(<招聘匹配依据 行们={缺省行们} />);
    expect(Array.from(container.querySelectorAll('span')).filter((节点) => 节点.textContent === '✓')).toHaveLength(0);
    const 全文 = container.textContent ?? '';
    for (const 禁词 of ['不匹配', '✗', '×']) expect(全文).not.toContain(禁词);
    expect(screen.getByText('技能 · 未提供判定')).toBeTruthy();
    expect(screen.getByText('薪资 · 未核对')).toBeTruthy();
  });

  it('不展示逐项分值/满分：全文没有数字分数', () => {
    const { container } = render(<招聘匹配依据 行们={齐备行们} />);
    expect((container.textContent ?? '')).not.toMatch(/\d+\s*分|\/\s*\d+|满分/);
  });

  it('空行数组：只出统一说明，不崩溃', () => {
    render(<招聘匹配依据 行们={[]} />);
    expect(screen.getByText('当前接口仅提供部分匹配依据')).toBeTruthy();
  });

  it('渲染不改变输入行（只读消费）', () => {
    const 原样 = [...缺省行们];
    render(<招聘匹配依据 行们={缺省行们} />);
    expect(缺省行们).toEqual(原样);
  });
});

/** 直接喂手工行的边角状态（partial/判定不完整）—— 组件按映射层的说明原样显示 */
describe('招聘匹配依据 · partial 与判定不完整', () => {
  it('partial 行无勾，说明含「部分匹配」', () => {
    const 行们: 匹配依据行[] = [
      { 维度: 'compensation', 状态: 'partial', 说明: '薪资带接近，部分匹配' },
    ];
    const { container } = render(<招聘匹配依据 行们={行们} />);
    expect(screen.getByText('薪资 · 薪资带接近，部分匹配')).toBeTruthy();
    expect(Array.from(container.querySelectorAll('span')).filter((节点) => 节点.textContent === '✓')).toHaveLength(0);
  });
});
