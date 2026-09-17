// 招聘匹配依据映射（Task 5 / Spec §5、Plan 契约 C）：wire 三键（highlights、
// structured_requirements_confirmed、compensation_relationship）→ 固定六行的
// 有限匹配展示模型。锁定：
//   · 四类正向码（category/experience/location/workplace_mode）为 positive，
//     经验还必须 confirmed；
//   · skills_matched 只说「有技能命中」（some_skills），不声称全部匹配、不推断数量；
//   · 薪资 overlap=positive / near_miss=partial / unknown=unknown；
//     薪资关系与原因矛盾 → not_provided「判定不完整」；disjoint 不自行构造新扣分；
//   · 原因缺席 = not_provided「未提供判定」（missing ≠ unmatched，绝不画成不匹配）；
//   · 重复码按维度归一、未知码丢弃且原 token 不进输出；固定六行、六维顺序不可变。

import { describe, expect, it } from 'vitest';
import { 映射招聘匹配依据 } from './招聘匹配依据映射';
import type { 匹配依据行 } from './招聘匹配依据映射';
import type { BFF招聘候选推荐 } from './BFF契约';

type 薪资关系 = BFF招聘候选推荐['compensation_relationship'];

/** 基础输入：无任何原因码、basis 未确认、薪资未核对 —— 六行全部走缺省 */
const 空输入: {
  highlights: string[];
  structuredRequirementsConfirmed: boolean;
  compensationRelationship: 薪资关系;
} = { highlights: [], structuredRequirementsConfirmed: false, compensationRelationship: 'unknown' };

/** 只取某一维度的行（六行固定，取不到即抛） */
function 取行(行们: 匹配依据行[], 维度: 匹配依据行['维度']): 匹配依据行 {
  const 行 = 行们.find((候选) => 候选.维度 === 维度);
  if (行 === undefined) throw new Error(`输出缺少维度 ${维度}`);
  return 行;
}

describe('映射招聘匹配依据 · 固定六行与顺序', () => {
  it('空输入也是固定六行，顺序为 方向/技能/经验/地点/办公方式/薪资', () => {
    expect(映射招聘匹配依据(空输入).map((行) => 行.维度)).toEqual([
      'category', 'skills', 'experience', 'location', 'workplace_mode', 'compensation',
    ]);
  });

  it('原因缺席显示「未提供判定」（missing ≠ unmatched），说明里没有不匹配措辞', () => {
    const 行们 = 映射招聘匹配依据(空输入);
    for (const 维度 of ['category', 'skills', 'experience', 'location', 'workplace_mode'] as const) {
      expect(取行(行们, 维度)).toEqual({ 维度, 状态: 'not_provided', 说明: '未提供判定' });
    }
    // 薪资关系字段独立于原因码：unknown → 未核对（不是「未提供判定」也不是不匹配）
    expect(取行(行们, 'compensation')).toEqual({ 维度: 'compensation', 状态: 'unknown', 说明: '未核对' });
    const 全文 = JSON.stringify(行们);
    for (const 禁词 of ['不匹配', '未达标', '不符']) expect(全文).not.toContain(禁词);
  });
});

describe('映射招聘匹配依据 · 四类正向码与经验确认门槛', () => {
  it.each([
    ['category_matched', 'category', '职位方向匹配'],
    ['experience_met', 'experience', '经验要求匹配'],
    ['location_matched', 'location', '工作地点匹配'],
    ['workplace_mode_matched', 'workplace_mode', '办公方式匹配'],
  ] as const)('%s → positive，说明沿用共享亮点文案闭表「%s」', (码, 维度, 说明) => {
    const 行 = 取行(
      映射招聘匹配依据({ ...空输入, highlights: [码], structuredRequirementsConfirmed: true }),
      维度,
    );
    expect(行.状态).toBe('positive');
    expect(行.说明).toBe(说明);
  });

  it('skills_matched → some_skills「有技能命中」：不声称全部匹配、不推断命中数量', () => {
    const 行 = 取行(映射招聘匹配依据({ ...空输入, highlights: ['skills_matched'] }), 'skills');
    expect(行).toEqual({ 维度: 'skills', 状态: 'some_skills', 说明: '有技能命中' });
    expect(行.说明).not.toContain('全部');
    expect(行.说明).not.toMatch(/\d/);
  });

  it('经验还必须 confirmed：experience_met 但 basis 未确认 → not_provided，不作正向声明', () => {
    const 行 = 取行(
      映射招聘匹配依据({ ...空输入, highlights: ['experience_met'], structuredRequirementsConfirmed: false }),
      'experience',
    );
    expect(行).toEqual({ 维度: 'experience', 状态: 'not_provided', 说明: '未提供判定' });
    // 确认后同一码恢复 positive
    const 已确认 = 取行(
      映射招聘匹配依据({ ...空输入, highlights: ['experience_met'], structuredRequirementsConfirmed: true }),
      'experience',
    );
    expect(已确认.状态).toBe('positive');
  });

  it('confirmed 只抬高经验门槛：不单独给其他维度造正向', () => {
    const 行们 = 映射招聘匹配依据({ ...空输入, structuredRequirementsConfirmed: true });
    for (const 维度 of ['category', 'skills', 'location', 'workplace_mode'] as const) {
      expect(取行(行们, 维度).状态).toBe('not_provided');
    }
  });
});

describe('映射招聘匹配依据 · 薪资关系三态', () => {
  it.each([
    ['overlap', 'positive', '薪资带有交集'],
    ['near_miss', 'partial', '薪资带接近，部分匹配'],
    ['unknown', 'unknown', '未核对'],
  ] as const)('关系 %s → %s「%s」；partial 标部分匹配', (关系, 状态, 说明) => {
    expect(取行(映射招聘匹配依据({ ...空输入, compensationRelationship: 关系 }), 'compensation'))
      .toEqual({ 维度: 'compensation', 状态, 说明 });
  });

  it('关系与原因码一致时按关系出（compensation_overlap + overlap 同为正向）', () => {
    const 行 = 取行(
      映射招聘匹配依据({
        ...空输入, highlights: ['compensation_overlap'], compensationRelationship: 'overlap',
      }),
      'compensation',
    );
    expect(行).toEqual({ 维度: 'compensation', 状态: 'positive', 说明: '薪资带有交集' });
    const 近 = 取行(
      映射招聘匹配依据({
        ...空输入, highlights: ['compensation_near_miss'], compensationRelationship: 'near_miss',
      }),
      'compensation',
    );
    expect(近).toEqual({ 维度: 'compensation', 状态: 'partial', 说明: '薪资带接近，部分匹配' });
  });

  it('disjoint 非正常推荐不自行构造新扣分：说明原 wire 闭表文案、无新 penalty 措辞', () => {
    const 行 = 取行(映射招聘匹配依据({ ...空输入, compensationRelationship: 'disjoint' }), 'compensation');
    expect(行).toEqual({ 维度: 'compensation', 状态: 'not_provided', 说明: '薪资带无交集' });
    expect(JSON.stringify(行)).not.toContain('不匹配');
  });
});

describe('映射招聘匹配依据 · 关系与原因矛盾', () => {
  it.each([
    [['compensation_overlap'], 'near_miss'],
    [['compensation_overlap'], 'disjoint'],
    [['compensation_overlap'], 'unknown'],
    [['compensation_near_miss'], 'overlap'],
    [['compensation_near_miss'], 'disjoint'],
    [['compensation_near_miss'], 'unknown'],
    [['compensation_overlap', 'compensation_near_miss'], 'overlap'],
  ] as const)('原因 %j × 关系 %s → not_provided「判定不完整」，不拼造一致性', (码们, 关系) => {
    expect(取行(映射招聘匹配依据({ ...空输入, highlights: [...码们], compensationRelationship: 关系 }), 'compensation'))
      .toEqual({ 维度: 'compensation', 状态: 'not_provided', 说明: '判定不完整' });
  });
});

describe('映射招聘匹配依据 · 重复/未知码与 token 卫生', () => {
  it('重复码按维度归一成一行，不产生重复维度', () => {
    const 行们 = 映射招聘匹配依据({
      ...空输入,
      highlights: ['category_matched', 'category_matched', 'skills_matched', 'skills_matched'],
      structuredRequirementsConfirmed: true,
    });
    expect(行们).toHaveLength(6);
    expect(行们.filter((行) => 行.维度 === 'category')).toHaveLength(1);
    expect(取行(行们, 'category').状态).toBe('positive');
    expect(取行(行们, 'skills').状态).toBe('some_skills');
  });

  it('未知开放码与原型键丢弃，原 token 不进输出；空串/空白码同样无效', () => {
    const 行们 = 映射招聘匹配依据({
      ...空输入,
      highlights: ['full_stack', 'direction_match', 'constructor', 'toString', '__proto__', '', '  '],
    });
    const 全文 = JSON.stringify(行们);
    for (const 码 of ['full_stack', 'direction_match', 'constructor', 'toString', '__proto__']) {
      expect(全文).not.toContain(码);
    }
    for (const 维度 of ['category', 'skills', 'experience', 'location', 'workplace_mode'] as const) {
      expect(取行(行们, 维度).状态).toBe('not_provided');
    }
  });

  it('齐备输入：六行各自按契约落位（集成样本）', () => {
    const 行们 = 映射招聘匹配依据({
      highlights: ['category_matched', 'skills_matched', 'experience_met', 'location_matched', 'workplace_mode_matched'],
      structuredRequirementsConfirmed: true,
      compensationRelationship: 'overlap',
    });
    expect(行们).toEqual([
      { 维度: 'category', 状态: 'positive', 说明: '职位方向匹配' },
      { 维度: 'skills', 状态: 'some_skills', 说明: '有技能命中' },
      { 维度: 'experience', 状态: 'positive', 说明: '经验要求匹配' },
      { 维度: 'location', 状态: 'positive', 说明: '工作地点匹配' },
      { 维度: 'workplace_mode', 状态: 'positive', 说明: '办公方式匹配' },
      { 维度: 'compensation', 状态: 'positive', 说明: '薪资带有交集' },
    ]);
  });
});
