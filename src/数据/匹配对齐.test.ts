// 匹配对齐纯函数测试（Plan 5）：
//  · 折算工作年限 —— 空/非法/小数/未来年份一律 null，绝不夹成 0 或用当前年补文本；
//  · 求职侧对齐行 / 求职匹配分析 —— 岗位 none 不生成硬性行，缺证据文案保持事实性。

import { describe, expect, it } from 'vitest';
import { 折算工作年限, 求职侧对齐行 } from './匹配对齐';

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

describe('求职侧对齐行 · none 投影为 null 的对齐事实', () => {
  const 空简历 = { 经历: [], 教育: [], 技能: [] };

  it.each([
    [null, null, 0],
    [null, '本科', 1],
    ['3-5 年', null, 1],
    ['3-5 年', '本科', 2],
  ] as const)('经验=%s 学历=%s → %i 行硬性行', (经验要求, 学历要求, 硬性数) => {
    const 行们 = 求职侧对齐行({ 经验要求, 学历要求 }, 空简历);
    expect(行们.filter((行) => 行.类 === '硬性')).toHaveLength(硬性数);
    // 无约束绝不生成「经验 不限」这类误导行
    expect(行们.some((行) => /不限/.test(行.要求))).toBe(false);
  });

  it('两个约束均 null 时硬性行数为 0（真实约束照常生成）', () => {
    expect(求职侧对齐行({ 经验要求: null, 学历要求: null }, 空简历)).toEqual([]);
    const 有约束 = 求职侧对齐行({ 经验要求: '3-5 年', 学历要求: '本科' }, 空简历);
    expect(有约束.map((行) => 行.要求)).toEqual(['经验 3-5 年', '学历 本科']);
  });
});