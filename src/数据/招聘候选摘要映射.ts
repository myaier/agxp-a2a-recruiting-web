// 招聘候选摘要映射：BFF招聘候选摘要 → 卡片摘要视图（招聘候选推荐卡与在谈 open 卡共用）。
// 视图是 allowlist：只挑展示字段重建，wire 上多余的键带不出去。
// 文案与空值规则按 Spec §4 冻结：0 年「不满 1 年」、null 隐藏；求职状态闭表；
// 工作/教育行 trim 判空后 join(' · ')，无部分则 null；亮点按 wire 顺序原样保留。

import type { BFF招聘候选摘要 } from './BFF契约';

export interface 招聘候选摘要视图 {
  性别?: '男' | '女';
  年限: string | null;
  学历: string | null;
  求职状态: string | null;
  工作: string | null;
  教育: string | null;
  个人亮点: string[];
}

const 求职状态文案 = {
  employed: '在职看机会', unemployed: '离职可到岗', student: '在校',
} as const;

function 已有键<T extends object>(表: T, 键: PropertyKey): 键 is keyof T {
  return Object.prototype.hasOwnProperty.call(表, 键);
}

function 非空段(值: string | null): string | null {
  const 段 = 值?.trim() ?? '';
  return 段.length > 0 ? 段 : null;
}

function 两段行(第一段: string | null, 第二段: string | null): string | null {
  const 非空 = [第一段, 第二段].filter((段): 段 is string => 段 !== null);
  return 非空.length > 0 ? 非空.join(' · ') : null;
}

export function 映射招聘候选摘要(
  摘要: BFF招聘候选摘要 | null,
): 招聘候选摘要视图 | null {
  if (摘要 === null) return null;
  const 年限 = 摘要.experience_years === null ? null : 摘要.experience_years === 0 ? '不满 1 年' : `${摘要.experience_years} 年`;
  const 求职状态 = 摘要.job_status !== null && 已有键(求职状态文案, 摘要.job_status) ? 求职状态文案[摘要.job_status] : null;
  return {
    ...(摘要.gender === null ? {} : { 性别: 摘要.gender === 'male' ? '男' : '女' }),
    年限,
    学历: 非空段(摘要.degree),
    求职状态,
    工作: 两段行(非空段(摘要.latest_experience?.company ?? null), 非空段(摘要.latest_experience?.title ?? null)),
    教育: 两段行(非空段(摘要.latest_education?.institution ?? null), 非空段(摘要.latest_education?.major ?? null)),
    个人亮点: [...摘要.personal_highlights],
  };
}