// 匹配解释展示映射（冻结公共合同 C3）：已解码的 BFF匹配解释 → 固定中文展示模型。
// 只有已解码响应才能进入本文件：函数只收 BFF匹配解释 / BFF匹配维度 / BFF匹配原因 /
// BFF匹配状态 这些闭合类型，不收 unknown、不收自由文本 —— 不从正文、分数大小或旧
// 依据推断任何状态。reason→说明是 C1 冻结闭表的逐字中文，不展示原始码、不生成模型
// 文案。解释缺席（显式 null）是合法缺失：模型原样保留 null 与有限旧依据，行推导在
// 解释缺席时返回 null，类型与运行时都不可能补出六条假状态。

import type {
  BFF匹配原因,
  BFF匹配状态,
  BFF匹配维度,
  BFF匹配解释,
} from './BFF契约';

/** Spec §4 固定顺序与中文名：方向、技能、经验、地点、办公方式、薪资。 */
export const 维度中文名: Readonly<Record<BFF匹配维度, string>> = {
  direction: '方向',
  skills: '技能',
  experience: '经验',
  location: '地点',
  workplace_mode: '办公方式',
  compensation: '薪资',
};

/** Spec §4 四态状态文字：与图标语义同时出现，不只靠颜色区别。 */
const 状态文字表 = {
  matched: '匹配',
  partially_matched: '部分匹配',
  not_matched: '不匹配',
  unknown: '未核对',
} as const satisfies Record<BFF匹配状态, string>;

export function 匹配状态文字(状态: BFF匹配状态): string {
  return 状态文字表[状态];
}

// ── C1 闭表的固定中文说明（逐字，含全半角标点）。satisfies 与 BFF契约.ts 的原因联合
// 双向锁定：漏词、多词都编不过。──

const 方向说明表 = {
  job_category_missing: '岗位方向信息缺失',
  candidate_category_missing: '求职方向信息缺失',
  category_matched: '求职方向与岗位方向匹配',
  category_not_matched: '求职方向与岗位方向不匹配',
} as const satisfies Record<string, string>;

const 技能说明表 = {
  job_keywords_missing: '岗位关键词缺失',
  candidate_skills_missing: '候选技能信息缺失',
  no_keyword_overlap: '未命中岗位关键词',
  partial_keyword_overlap: '命中部分岗位关键词',
  all_keywords_matched: '已命中全部岗位关键词',
} as const satisfies Record<string, string>;

const 经验说明表 = {
  requirements_unconfirmed: '岗位经验要求尚未确认',
  candidate_experience_missing: '候选经验信息缺失',
  experience_met: '经验满足岗位要求',
  experience_not_met: '经验未满足岗位要求',
} as const satisfies Record<string, string>;

const 地点说明表 = {
  job_location_missing: '岗位地点信息缺失',
  candidate_locations_missing: '求职地点信息缺失',
  location_matched: '求职地点与岗位地点匹配',
  location_not_matched: '求职地点与岗位地点不匹配',
} as const satisfies Record<string, string>;

const 办公方式说明表 = {
  job_workplace_mode_missing: '岗位办公方式信息缺失',
  candidate_workplace_modes_missing: '求职办公方式信息缺失',
  workplace_mode_matched: '办公方式匹配',
  workplace_mode_not_matched: '办公方式不匹配',
} as const satisfies Record<string, string>;

const 薪资说明表 = {
  compensation_overlap: '薪资范围匹配',
  compensation_near_miss: '薪资范围接近',
  compensation_disjoint: '薪资范围不匹配',
  compensation_type_mismatch: '薪资周期不同，无法直接比较',
  compensation_negotiable: '薪资面议，尚未核对',
  candidate_compensation_missing: '求职薪资信息缺失',
  job_compensation_missing: '岗位薪资信息缺失',
  compensation_not_annualizable: '薪资缺少可比口径',
  compensation_type_unsupported: '当前薪资类型无法比较',
} as const satisfies Record<string, string>;

const 说明表: Readonly<Record<BFF匹配维度, Readonly<Record<string, string>>>> = {
  direction: 方向说明表,
  skills: 技能说明表,
  experience: 经验说明表,
  location: 地点说明表,
  workplace_mode: 办公方式说明表,
  compensation: 薪资说明表,
};

/**
 * C1 冻结闭表的固定说明查询。跨维组合是调用方类型 misuse：闭表必不命中，fail closed
 * 抛错而非输出自由文本。
 */
export function 匹配原因说明(维度: BFF匹配维度, 原因: BFF匹配原因): string {
  const 说明 = 说明表[维度][原因];
  if (说明 === undefined) throw new Error('匹配解释原因词不在冻结闭表内');
  return 说明;
}

/** 一行六维展示数据（Spec §4 行样式的内容面：图标语义 + points/max + 固定说明 + 状态文字）。 */
export interface 匹配解释行 {
  维度: string;
  状态: BFF匹配状态;
  状态文字: string;
  points: number;
  max_points: number;
  说明: string;
  /** 仅技能行携带：命中/岗位关键词总数（“命中X/Y个岗位关键词”）；其他行恒 null。 */
  命中: number | null;
  总数: number | null;
}

/** 已解码解释 → 固定顺序六行；输入恒为已解码对象，行内容全部来自对象自身字段。 */
export function 匹配解释行们(解释: BFF匹配解释): readonly 匹配解释行[] {
  return 解释.dimensions.map((维度) => ({
    维度: 维度中文名[维度.dimension],
    状态: 维度.status,
    状态文字: 匹配状态文字(维度.status),
    points: 维度.points,
    max_points: 维度.max_points,
    说明: 匹配原因说明(维度.dimension, 维度.reason_code),
    命中: 维度.dimension === 'skills' ? 维度.matched_count : null,
    总数: 维度.dimension === 'skills' ? 维度.required_count : null,
  }));
}

export type 匹配分析上下文 = '有来源' | '无推荐上下文' | '原推荐不可用';

/**
 * C3 展示模型：匹配分析块组件 props 的核心。解释只在已解码时非空；合法缺失
 * （match_explanation=null）保留分数与有限旧依据，绝不伪造六行 —— 分数 0 是合法
 * 真实分、null 是无溯源，二者不互换。
 */
export interface 匹配分析模型 {
  分数: number | null;
  解释: BFF匹配解释 | null;
  /** 同来源旧正向依据（仅解释缺失时由展示层标注「有限依据」，不做负向推断）。 */
  有限依据: readonly string[];
  上下文: 匹配分析上下文;
}

/**
 * 模型 → 行推导：解释缺席返回 null（调用方显示「暂无该次匹配的详细分析」，有旧依据
 * 标「有限依据」），绝不从分数、旧依据或正文补出六条假状态。
 */
export function 匹配分析行们(模型: 匹配分析模型): readonly 匹配解释行[] | null {
  return 模型.解释 === null ? null : 匹配解释行们(模型.解释);
}

/**
 * 三参数小构造器：分数 + 解释 + 上下文（有限依据缺省为空）。模型字面量在双端消费者里
 * 已超过半打，收拢成单一构造点防止字段漏填/顺序漂移；不改变模型本身的形状与语义。
 */
export function 建匹配分析模型(
  分数: number | null,
  解释: BFF匹配解释 | null,
  上下文: 匹配分析上下文,
  有限依据: readonly string[] = [],
): 匹配分析模型 {
  return { 分数, 解释, 有限依据, 上下文 };
}
