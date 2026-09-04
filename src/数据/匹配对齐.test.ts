// 匹配对齐纯函数测试（Plan 5）：
//  · 折算工作年限 —— 空/非法/小数/未来年份一律 null，绝不夹成 0 或用当前年补文本；
//  · 求职侧对齐行 / 求职匹配分析 —— 岗位 none 不生成硬性行，缺证据文案保持事实性。

import { describe, expect, it } from 'vitest';
import { 折算工作年限 } from './匹配对齐';

describe('折算工作年限', () => {
  it.each([
    ['', 2026, null],
    ['abc', 2026, null],
    ['0', 2026, null],
    ['2024.5', 2026, null],
    ['2027', 2026, null],
    ['2026', 2026, 0],
    ['2018', 2026, 8],
  ] as const)('%s / %i → %s', (input, currentYear, expected) => {
    expect(折算工作年限(input, currentYear)).toBe(expected);
  });

  it('currentYear 缺省取当前年（生产路径同语义）', () => {
    expect(折算工作年限(String(new Date().getFullYear() - 3))).toBe(3);
  });
});