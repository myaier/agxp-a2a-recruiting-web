// 匹配解释 decoder 测试：冻结公共合同 C1 的六维解码边界 —— input=null 合法（score
// 有值也不看）、undefined 不当 null、顶层与维度 exact key set、固定版本三元组与
// max_points=100、六维固定顺序与权重、闭表 reason→status、skills 计数约束与分公式
// 一致性（含 1/100=0 仍部分匹配）、分项和=total_points=同响应 match_score。一切损坏
// 输入（未知 reason、跨维 reason、错状态、额外键、计数/分数矛盾、版本漂移、非有限
// 整数）都走 invalid_response，绝不降级为合法 null。

import { describe, expect, it } from 'vitest';
import { 解匹配解释 } from './匹配解释';
import { BFF技能部分命中零分解释样本, BFF匹配解释样本 } from '../../测试/BFF样本';

const 契约漂移 = '服务返回了不符合契约的匹配解释数据';

type 原始维度 = Record<string, unknown>;

/** 单字段破坏：按下标覆盖一个维度字段，其余保持合法并重算分项和，隔离出目标违约。 */
function 改第(下标: number, 覆盖: Record<string, unknown>): (表: 原始维度[]) => void {
  return (表) => {
    表[下标] = { ...表[下标], ...覆盖 };
  };
}

/** 以共享合法样本为底座生成整包；默认 total_points=重算后的分项和（合法基线 50）。 */
function 整包(改维?: (表: 原始维度[]) => void, 覆盖顶层: Record<string, unknown> = {}): {
  输入: unknown;
  总分: number;
} {
  const 表: 原始维度[] = BFF匹配解释样本.dimensions.map((维度) => ({ ...维度 }));
  改维?.(表);
  const 总分 = 表.reduce((和, 维度) => 和 + (维度['points'] as number), 0);
  return {
    输入: {
      ...BFF匹配解释样本,
      ...覆盖顶层,
      total_points: 覆盖顶层['total_points'] ?? 总分,
      dimensions: 表,
    },
    总分,
  };
}

describe('解匹配解释：解码边界（C1）', () => {
  it('input=null 直接返回 null；matchScore 有值或为 null 都不看', () => {
    expect(解匹配解释(null, 87)).toBeNull();
    expect(解匹配解释(null, null)).toBeNull();
  });

  it('undefined 不视为 null；原始类型与数组都拒绝', () => {
    expect(() => 解匹配解释(undefined, null)).toThrow(契约漂移);
    expect(() => 解匹配解释('null', 50)).toThrow(契约漂移);
    expect(() => 解匹配解释(50, 50)).toThrow(契约漂移);
    expect(() => 解匹配解释(true, null)).toThrow(契约漂移);
    expect(() => 解匹配解释([], null)).toThrow(契约漂移);
  });

  it('合法样本原样解码（snake_case wire 字段原样保留）', () => {
    expect(解匹配解释(BFF匹配解释样本, 50)).toEqual(BFF匹配解释样本);
  });

  it('1/100 技能部分命中 0 分合法，仍为部分匹配且分项和自洽', () => {
    const 解释 = 解匹配解释(BFF技能部分命中零分解释样本, 65);
    expect(解释).toEqual(BFF技能部分命中零分解释样本);
    expect(解释?.dimensions[1]).toMatchObject({
      status: 'partially_matched',
      points: 0,
      max_points: 35,
      matched_count: 1,
      required_count: 100,
    });
  });

  it('matchScore 与 total_points 不等、非有效数字或 null（对象非 null）都拒绝', () => {
    expect(() => 解匹配解释(BFF匹配解释样本, 51)).toThrow(契约漂移);
    expect(() => 解匹配解释(BFF匹配解释样本, null)).toThrow(契约漂移);
    expect(() => 解匹配解释(BFF匹配解释样本, 50.5)).toThrow(契约漂移);
    expect(() => 解匹配解释(BFF匹配解释样本, Number.NaN)).toThrow(契约漂移);
    expect(() => 解匹配解释(BFF匹配解释样本, Number.POSITIVE_INFINITY)).toThrow(契约漂移);
  });

  it('顶层额外键与六个必需键缺一都拒绝', () => {
    expect(() => 解匹配解释({ ...BFF匹配解释样本, extra: 1 }, 50)).toThrow(契约漂移);
    for (const 键 of ['schema_version', 'ranking_version', 'basis', 'total_points', 'max_points', 'dimensions']) {
      const 缺键 = { ...BFF匹配解释样本 } as Record<string, unknown>;
      delete 缺键[键];
      expect(() => 解匹配解释(缺键, 50)).toThrow(契约漂移);
    }
  });

  it('版本三元组与 max_points 漂移走契约错误，不悄悄兼容新版本', () => {
    for (const 覆盖 of [
      { schema_version: 'match-explanation.v2' },
      { ranking_version: 'discovery-ranking.v1' },
      { basis: 'live_recompute' },
      { max_points: 90 },
    ]) {
      expect(() => 解匹配解释({ ...BFF匹配解释样本, ...覆盖 }, 50)).toThrow(契约漂移);
    }
  });

  it('dimensions 非数组、丢维、多一维、乱序、重复维度都拒绝', () => {
    expect(() => 解匹配解释({ ...BFF匹配解释样本, dimensions: 'x' }, 50)).toThrow(契约漂移);
    const 少一维 = 整包((表) => {
      表.pop();
    });
    expect(() => 解匹配解释(少一维.输入, 少一维.总分)).toThrow(契约漂移);
    const 多一维 = 整包((表) => {
      表.push({ ...表[0] });
    });
    expect(() => 解匹配解释(多一维.输入, 多一维.总分)).toThrow(契约漂移);
    const 乱序 = 整包((表) => {
      const 首 = 表[0];
      表[0] = 表[5];
      表[5] = 首;
    });
    expect(() => 解匹配解释(乱序.输入, 乱序.总分)).toThrow(契约漂移);
    const 重复 = 整包((表) => {
      表[5] = { ...表[1] };
    });
    expect(() => 解匹配解释(重复.输入, 重复.总分)).toThrow(契约漂移);
  });

  it('维度额外键拒绝：非技能带 matched_count/required_count 或未知键都放不开', () => {
    const 额外键 = 整包(改第(0, { extra: 1 }));
    expect(() => 解匹配解释(额外键.输入, 额外键.总分)).toThrow(契约漂移);
    const 非技能带计数 = 整包(改第(0, { matched_count: 0, required_count: 0 }));
    expect(() => 解匹配解释(非技能带计数.输入, 非技能带计数.总分)).toThrow(契约漂移);
    const 缺命中数 = 整包((表) => {
      delete (表[1] as Record<string, unknown>)['matched_count'];
    });
    expect(() => 解匹配解释(缺命中数.输入, 缺命中数.总分)).toThrow(契约漂移);
    const 缺总数 = 整包((表) => {
      delete (表[1] as Record<string, unknown>)['required_count'];
    });
    expect(() => 解匹配解释(缺总数.输入, 缺总数.总分)).toThrow(契约漂移);
  });

  it('维度必需键缺一拒绝', () => {
    for (const 键 of ['dimension', 'status', 'points', 'max_points', 'reason_code']) {
      const 缺键 = 整包((表) => {
        delete (表[2] as Record<string, unknown>)[键];
      });
      expect(() => 解匹配解释(缺键.输入, 缺键.总分)).toThrow(契约漂移);
    }
  });

  it('未知 reason、跨维 reason、status 与闭表不符、未知 status 都拒绝', () => {
    const 未知词 = 整包(改第(2, { reason_code: 'some_new_reason', status: 'unknown' }));
    expect(() => 解匹配解释(未知词.输入, 未知词.总分)).toThrow(契约漂移);
    const 跨维 = 整包(改第(2, { reason_code: 'no_keyword_overlap', status: 'not_matched' }));
    expect(() => 解匹配解释(跨维.输入, 跨维.总分)).toThrow(契约漂移);
    const 状态不符 = 整包(改第(0, { status: 'not_matched' }));
    expect(() => 解匹配解释(状态不符.输入, 状态不符.总分)).toThrow(契约漂移);
    const 未知状态 = 整包(改第(0, { status: 'partial' }));
    expect(() => 解匹配解释(未知状态.输入, 未知状态.总分)).toThrow(契约漂移);
  });
});

describe('解匹配解释：C1 闭表逐格合法组合', () => {
  // 30 个 reason 词全部覆盖（skills 的 partial 加一行为 1/2=17 分与 1/100=0 分两格）。
  const 合法格: [number, Record<string, unknown>][] = [
    [0, { reason_code: 'job_category_missing', status: 'unknown', points: 0 }],
    [0, { reason_code: 'candidate_category_missing', status: 'unknown', points: 0 }],
    [0, { reason_code: 'category_matched', status: 'matched', points: 25 }],
    [0, { reason_code: 'category_not_matched', status: 'not_matched', points: 0 }],
    [1, { reason_code: 'job_keywords_missing', status: 'unknown', points: 0, matched_count: 0, required_count: 0 }],
    [1, { reason_code: 'candidate_skills_missing', status: 'unknown', points: 0, matched_count: 0, required_count: 3 }],
    [1, { reason_code: 'no_keyword_overlap', status: 'not_matched', points: 0, matched_count: 0, required_count: 3 }],
    [1, { reason_code: 'partial_keyword_overlap', status: 'partially_matched', points: 17, matched_count: 1, required_count: 2 }],
    [1, { reason_code: 'partial_keyword_overlap', status: 'partially_matched', points: 0, matched_count: 1, required_count: 100 }],
    [1, { reason_code: 'all_keywords_matched', status: 'matched', points: 35, matched_count: 7, required_count: 7 }],
    [2, { reason_code: 'requirements_unconfirmed', status: 'unknown', points: 0 }],
    [2, { reason_code: 'candidate_experience_missing', status: 'unknown', points: 0 }],
    [2, { reason_code: 'experience_met', status: 'matched', points: 15 }],
    [2, { reason_code: 'experience_not_met', status: 'not_matched', points: 0 }],
    [3, { reason_code: 'job_location_missing', status: 'unknown', points: 0 }],
    [3, { reason_code: 'candidate_locations_missing', status: 'unknown', points: 0 }],
    [3, { reason_code: 'location_matched', status: 'matched', points: 10 }],
    [3, { reason_code: 'location_not_matched', status: 'not_matched', points: 0 }],
    [4, { reason_code: 'job_workplace_mode_missing', status: 'unknown', points: 0 }],
    [4, { reason_code: 'candidate_workplace_modes_missing', status: 'unknown', points: 0 }],
    [4, { reason_code: 'workplace_mode_matched', status: 'matched', points: 5 }],
    [4, { reason_code: 'workplace_mode_not_matched', status: 'not_matched', points: 0 }],
    [5, { reason_code: 'compensation_overlap', status: 'matched', points: 10 }],
    [5, { reason_code: 'compensation_near_miss', status: 'partially_matched', points: 5 }],
    [5, { reason_code: 'compensation_disjoint', status: 'not_matched', points: 0 }],
    [5, { reason_code: 'compensation_type_mismatch', status: 'unknown', points: 0 }],
    [5, { reason_code: 'compensation_negotiable', status: 'unknown', points: 0 }],
    [5, { reason_code: 'candidate_compensation_missing', status: 'unknown', points: 0 }],
    [5, { reason_code: 'job_compensation_missing', status: 'unknown', points: 0 }],
    [5, { reason_code: 'compensation_not_annualizable', status: 'unknown', points: 0 }],
    [5, { reason_code: 'compensation_type_unsupported', status: 'unknown', points: 0 }],
  ];

  it('31 格 reason→status→分数组合全部解码并原样回显', () => {
    for (const [下标, 覆盖] of 合法格) {
      const 样本 = 整包(改第(下标, 覆盖));
      const 解释 = 解匹配解释(样本.输入, 样本.总分);
      expect(解释?.dimensions[下标]).toMatchObject(覆盖);
    }
  });

  it('matched 非满分、unknown/not_matched 非零、薪资接近非 5 分都拒绝', () => {
    const 欠满分 = 整包(改第(0, { points: 24 }));
    expect(() => 解匹配解释(欠满分.输入, 欠满分.总分)).toThrow(契约漂移);
    const 未知有分 = 整包(改第(4, { points: 1 }));
    expect(() => 解匹配解释(未知有分.输入, 未知有分.总分)).toThrow(契约漂移);
    const 不匹配有分 = 整包(改第(5, { reason_code: 'compensation_disjoint', status: 'not_matched', points: 1 }));
    expect(() => 解匹配解释(不匹配有分.输入, 不匹配有分.总分)).toThrow(契约漂移);
    const 方向部分 = 整包(改第(0, { reason_code: 'category_matched', status: 'partially_matched' }));
    expect(() => 解匹配解释(方向部分.输入, 方向部分.总分)).toThrow(契约漂移);
    const 薪资接近4分 = 整包(改第(5, { reason_code: 'compensation_near_miss', status: 'partially_matched', points: 4 }));
    expect(() => 解匹配解释(薪资接近4分.输入, 薪资接近4分.总分)).toThrow(契约漂移);
  });

  it('skills 计数与 reason 矛盾都拒绝', () => {
    const 矛盾格: Record<string, unknown>[] = [
      // matched > required
      { reason_code: 'partial_keyword_overlap', status: 'partially_matched', matched_count: 5, required_count: 3, points: 0 },
      // job_keywords_missing 只许 required=0
      { reason_code: 'job_keywords_missing', status: 'unknown', matched_count: 0, required_count: 2, points: 0 },
      // candidate_skills_missing 要求 required>0 且 matched=0
      { reason_code: 'candidate_skills_missing', status: 'unknown', matched_count: 0, required_count: 0, points: 0 },
      { reason_code: 'candidate_skills_missing', status: 'unknown', matched_count: 1, required_count: 3, points: 0 },
      // no_keyword_overlap 要求 required>0 且 matched=0
      { reason_code: 'no_keyword_overlap', status: 'not_matched', matched_count: 1, required_count: 3, points: 0 },
      // partial 要求 0<matched<required
      { reason_code: 'partial_keyword_overlap', status: 'partially_matched', matched_count: 0, required_count: 3, points: 0 },
      { reason_code: 'partial_keyword_overlap', status: 'partially_matched', matched_count: 3, required_count: 3, points: 0 },
      // all 要求 matched=required>0
      { reason_code: 'all_keywords_matched', status: 'matched', matched_count: 2, required_count: 3, points: 35 },
      { reason_code: 'all_keywords_matched', status: 'matched', matched_count: 0, required_count: 0, points: 35 },
      // 负计数
      { reason_code: 'partial_keyword_overlap', status: 'partially_matched', matched_count: -1, required_count: 3, points: 0 },
      { reason_code: 'all_keywords_matched', status: 'matched', matched_count: 3, required_count: -3, points: 35 },
    ];
    for (const 覆盖 of 矛盾格) {
      const 样本 = 整包(改第(1, 覆盖));
      expect(() => 解匹配解释(样本.输入, 样本.总分)).toThrow(契约漂移);
    }
  });

  it('skills 分与计数公式不符拒绝（公式只是解码一致性校验，非评分入口）', () => {
    const 多给 = 整包(改第(1, {
      reason_code: 'partial_keyword_overlap',
      status: 'partially_matched',
      matched_count: 1,
      required_count: 2,
      points: 18,
    }));
    expect(() => 解匹配解释(多给.输入, 多给.总分)).toThrow(契约漂移);
    const 少给 = 整包(改第(1, {
      reason_code: 'all_keywords_matched',
      status: 'matched',
      matched_count: 7,
      required_count: 7,
      points: 34,
    }));
    expect(() => 解匹配解释(少给.输入, 少给.总分)).toThrow(契约漂移);
  });

  it('分项和 ≠ total_points 拒绝', () => {
    expect(() => 解匹配解释(整包(undefined, { total_points: 49 }).输入, 49)).toThrow(契约漂移);
    expect(() => 解匹配解释(整包(undefined, { total_points: 51 }).输入, 51)).toThrow(契约漂移);
  });

  it('非有限整数数值（小数/NaN/Infinity/字符串）都拒绝', () => {
    expect(() => 解匹配解释({ ...BFF匹配解释样本, total_points: 50.5 }, 50)).toThrow(契约漂移);
    expect(() => 解匹配解释({ ...BFF匹配解释样本, total_points: Number.NaN }, 50)).toThrow(契约漂移);
    expect(() => 解匹配解释({ ...BFF匹配解释样本, total_points: Number.POSITIVE_INFINITY }, 50)).toThrow(契约漂移);
    const 小数分 = 整包(改第(0, { points: 24.5 }));
    expect(() => 解匹配解释(小数分.输入, 小数分.总分)).toThrow(契约漂移);
    const 非数分 = 整包(改第(2, { points: Number.NaN }));
    expect(() => 解匹配解释(非数分.输入, 非数分.总分)).toThrow(契约漂移);
    const 字符串满分 = 整包(改第(0, { max_points: '25' }));
    expect(() => 解匹配解释(字符串满分.输入, 字符串满分.总分)).toThrow(契约漂移);
    const 小数计数 = 整包(改第(1, { matched_count: 0.5 }));
    expect(() => 解匹配解释(小数计数.输入, 小数计数.总分)).toThrow(契约漂移);
  });
});
