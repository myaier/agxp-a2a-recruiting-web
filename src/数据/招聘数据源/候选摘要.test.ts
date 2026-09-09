// 招聘候选摘要 decoder 测试：include=candidate_summary 展开对象的严格解码。
// 锁定：null 原样通过；七键闭合（缺键/未知键/undefined 拒绝）；闭集枚举；非负整数年限；
// 嵌套两键闭合；亮点 1–24 码点且空串拒绝、无数组数量上限、空数组合法；错误透传调用方工厂。

import { describe, expect, it } from 'vitest';
import { 解招聘候选摘要 } from './候选摘要';
import { 招聘候选摘要样本 } from '../../测试/BFF样本';

const 错误工厂 = () => new Error('调用方契约错误');
const 摘要 = 招聘候选摘要样本;

function 删键(base: typeof 摘要, 键: string): unknown {
  const 复制: Record<string, unknown> = { ...base };
  delete 复制[键];
  return 复制;
}

describe('解招聘候选摘要', () => {
  it('null 原样输出 null，不抛错', () => {
    expect(解招聘候选摘要(null, 错误工厂)).toBeNull();
  });

  it('完整样本逐字段通过', () => {
    expect(解招聘候选摘要({ ...摘要 }, 错误工厂)).toEqual(摘要);
  });

  it('0 年与 null 年限结果不同；空数组合法；单条亮点合法', () => {
    expect(解招聘候选摘要({ ...摘要, experience_years: 0, personal_highlights: [] }, 错误工厂)).toEqual({
      ...摘要,
      experience_years: 0,
      personal_highlights: [],
    });
  });

  it('24 个非 BMP 码点亮点合法，25 个拒绝', () => {
    const 长亮点 = '𠀀'.repeat(24);
    expect(解招聘候选摘要({ ...摘要, personal_highlights: [长亮点] }, 错误工厂)?.personal_highlights).toEqual([长亮点]);
    expect(() => 解招聘候选摘要({ ...摘要, personal_highlights: ['𠀀'.repeat(25)] }, 错误工厂)).toThrow('调用方契约错误');
  });

  it.each([
    ['gender', 'male' as const, null],
    ['experience_years', 7, null],
    ['job_status', 'student' as const, null],
    ['degree', '硕士', null],
    ['latest_experience', { company: null, title: null } as const, null],
    ['latest_education', { institution: null, major: null } as const, null],
    ['personal_highlights', ['x'], []],
  ])('显式 null/合法空值字段 %s 通过', (键, 合法值, 空值) => {
    expect(解招聘候选摘要({ ...摘要, [键]: 空值 }, 错误工厂)).toEqual({ ...摘要, [键]: 空值 });
    expect(解招聘候选摘要({ ...摘要, [键]: 合法值 }, 错误工厂)).toEqual({ ...摘要, [键]: 合法值 });
  });

  it('删除每个必返键、显式 undefined、未知键均拒绝', () => {
    for (const 键 of Object.keys(摘要)) {
      expect(() => 解招聘候选摘要(删键(摘要, 键), 错误工厂), `缺 ${键}`).toThrow('调用方契约错误');
      expect(() => 解招聘候选摘要({ ...摘要, [键]: undefined }, 错误工厂), `${键}=undefined`).toThrow('调用方契约错误');
    }
    expect(() => 解招聘候选摘要({ ...摘要, candidate_alias: 'x' }, 错误工厂)).toThrow('调用方契约错误');
    expect(() => 解招聘候选摘要({ ...摘要, 真名: '张三' }, 错误工厂)).toThrow('调用方契约错误');
  });

  it('非法枚举拒绝：gender/job_status 闭集之外与错误类型', () => {
    for (const 非法 of ['MALE', 'man', '', 0, true]) {
      expect(() => 解招聘候选摘要({ ...摘要, gender: 非法 }, 错误工厂), `gender=${String(非法)}`).toThrow('调用方契约错误');
      expect(() => 解招聘候选摘要({ ...摘要, job_status: 非法 }, 错误工厂), `job_status=${String(非法)}`).toThrow('调用方契约错误');
    }
  });

  it('年限只收非负整数：负数/小数/NaN/Infinity/字符串拒绝', () => {
    for (const 非法 of [-1, -0.5, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '5']) {
      expect(() => 解招聘候选摘要({ ...摘要, experience_years: 非法 }, 错误工厂), `years=${String(非法)}`).toThrow('调用方契约错误');
    }
  });

  it('嵌套对象两键全必返且不接受未知键；非闭合类型拒绝', () => {
    expect(() => 解招聘候选摘要({ ...摘要, latest_experience: { company: 'x' } }, 错误工厂)).toThrow('调用方契约错误');
    expect(() => 解招聘候选摘要({ ...摘要, latest_experience: { company: 'x', title: 'y', level: 1 } }, 错误工厂)).toThrow('调用方契约错误');
    expect(() => 解招聘候选摘要({ ...摘要, latest_education: { major: null } }, 错误工厂)).toThrow('调用方契约错误');
    expect(() => 解招聘候选摘要({ ...摘要, latest_education: { institution: 'x', major: 'y', degree: '本科' } }, 错误工厂)).toThrow('调用方契约错误');
    expect(() => 解招聘候选摘要({ ...摘要, latest_experience: '云衢' }, 错误工厂)).toThrow('调用方契约错误');
    // company/title 必须是 string|null，不接受 number
    expect(() => 解招聘候选摘要({ ...摘要, latest_experience: { company: 1, title: null } }, 错误工厂)).toThrow('调用方契约错误');
  });

  it('亮点元素：空串、非字符串、数组本身非数组拒绝', () => {
    expect(() => 解招聘候选摘要({ ...摘要, personal_highlights: [''] }, 错误工厂)).toThrow('调用方契约错误');
    expect(() => 解招聘候选摘要({ ...摘要, personal_highlights: [0] }, 错误工厂)).toThrow('调用方契约错误');
    expect(() => 解招聘候选摘要({ ...摘要, personal_highlights: '带领团队' }, 错误工厂)).toThrow('调用方契约错误');
  });

  it('非对象输入拒绝；null 之外的字面量、数组均不是摘要', () => {
    for (const 非法 of ['x', 5, true, [], {}, undefined]) {
      expect(() => 解招聘候选摘要(非法, 错误工厂), String(非法) || '[]').toThrow('调用方契约错误');
    }
  });

  it('错误来自调用方工厂实例本身', () => {
    const 实例 = new Error('my-factory');
    try {
      解招聘候选摘要({}, () => 实例);
      expect.unreachable();
    } catch (error) {
      expect(error).toBe(实例);
    }
  });
});