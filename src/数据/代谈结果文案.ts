// 代谈结果文案 —— 公开初评决定/过程/证据与代谈终局的中文字典（S0–S3 展示统一 Task 1）。
// 字典权威 = 批准 Spec 附录 A.2.1（decision/state/outcome/outcome_code 闭表）与 A.4
// （维度与证据 code）。同仓库局部纯函数：同一输入恒同一输出，不读时间、Context 或全局表，
// 不接 raw response、不发请求、不 import React。三层事实（A.2）只由调用者区分 —— 本模块
// 不把公开初评当 S0 结论，也不从 outcome 猜 completed 的成功事实（成功勾由调用者按
// lifecycle 处理，故本模块对 ended 终局只给 提醒/中性，绝不返回 成功）。
// 未知词安全兜底且原词绝不带出：未知 decision/state/outcome/code 一律给「暂未提供」句，
// 不做英文替换、不猜业务含义；原 decoder 对闭合结构的拒绝规则不受本模块影响。

export type 核对结果 = '通过' | '不匹配' | '待确认' | '未完成' | '核对中';

function 已有键<T extends object>(表: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(表, key);
}

// ── 公开初评决定（A.2.1 evaluation.decision：开案前对公开资料的评估，只是建议）──

const 初评决定文案表 = {
  fit: '公开初评匹配',
  not_fit: '公开初评不匹配',
  uncertain: '公开初评待确认',
} as const;

const 初评结果未提供文案 = '初评结果暂未提供';

export function 公开初评决定文案(decision: string | null): string {
  return decision !== null && 已有键(初评决定文案表, decision)
    ? 初评决定文案表[decision]
    : 初评结果未提供文案;
}

// ── 公开初评过程（A.2.1 evaluation.state，仅尚未开案的初评过程需要）──
// completed 只说明过程完成：具体结论读取 decision，不在此句里代答。

const 初评过程文案表 = {
  pending: '初评中',
  completed: '初评完成',
  failed: '初评未完成',
  expired: '初评超时',
} as const;

const 初评状态未提供文案 = '初评状态暂未提供';

export function 公开初评过程文案(state: string | null): string {
  return state !== null && 已有键(初评过程文案表, state)
    ? 初评过程文案表[state]
    : 初评状态未提供文案;
}

// ── 初评证据（A.4：维度 13 闭词；三组决定 bullet 外观；具体 code 优先于通用维度后缀）──

const 维度文案表 = {
  recruitment_type: '招聘类型',
  job_category: '职位方向',
  location: '工作地点',
  workplace_mode: '办公方式',
  compensation: '薪资条件',
  campus_cohort: '毕业届别',
  internship_months: '实习时长',
  skills: '专业技能',
  experience: '工作经验',
  education: '学历要求',
  work_arrangement: '工作安排',
  job_requirements: '岗位要求',
  information: '信息完整性',
} as const;

/** 未知维度不透出原词：统一显示「其他条件」及组态，不从英文替换下划线猜业务含义。 */
const 未知维度文案 = '其他条件';

/** 组 → 完整句的组态词与核对结果（核对结果只决定图标/色调，不作为句尾自动拼接以外的用途）。 */
const 组文案表: Record<'matches' | 'conflicts' | 'unknowns', { 组态: string; 结果: 核对结果 }> = {
  matches: { 组态: '匹配', 结果: '通过' },
  conflicts: { 组态: '不匹配', 结果: '不匹配' },
  unknowns: { 组态: '待确认', 结果: '待确认' },
};

/**
 * 五个特殊证据 code 的冻结完整句（A.4「具体 code 优先于通用维度后缀」）：
 * 句子本身已承载检查状态，调用者不得再给它追加「匹配/待确认」后缀。
 */
const 证据码文案表: Record<string, { 项: string; 结果: 核对结果 }> = {
  compensation_not_comparable: { 项: '薪资条件：暂无法比较', 结果: '待确认' },
  campus_cohort_unrestricted: { 项: '毕业届别：不限', 结果: '通过' },
  experience_requirement_unconfirmed: { 项: '经验要求：待招聘方确认', 结果: '待确认' },
  education_requirement_unconfirmed: { 项: '学历要求：待招聘方确认', 结果: '待确认' },
  insufficient_information: { 项: '信息不足，待确认', 结果: '待确认' },
};

/** 一条证据 → 完整可见句 + 核对结果（结果只决定图标/色调；证据项无 source，不透出 code）。 */
export function 初评证据文案(
  group: 'matches' | 'conflicts' | 'unknowns',
  evidence: { dimension: string; code: string },
): { 项: string; 结果: 核对结果 } {
  if (已有键(证据码文案表, evidence.code)) return 证据码文案表[evidence.code];
  const 维度 = 已有键(维度文案表, evidence.dimension) ? 维度文案表[evidence.dimension] : 未知维度文案;
  const 组 = 组文案表[group];
  return { 项: `${维度}：${组.组态}`, 结果: 组.结果 };
}

// ── 代谈终局（A.2.1 outcome 七闭表 + outcome_code 四附加闭词）──

const 终局状态文案表 = {
  semantic_not_fit: '不匹配',
  policy_rejected: '未通过',
  semantic_uncertain_stop: '信息不足',
  agent_failed: '筛选未完成',
  response_timeout: '逾期结束',
  user_ended: '已结束',
  party_account_deleted: '已结束',
} as const;

const 终局原因文案表: Record<keyof typeof 终局状态文案表, string> = {
  semantic_not_fit: '本阶段评估不匹配，代谈已结束',
  policy_rejected: '条件核对未通过',
  semantic_uncertain_stop: '信息不足，未能确认条件',
  agent_failed: '自动筛选未完成，不表示候选人不匹配',
  response_timeout: '逾期未回应，已自动结束',
  user_ended: '本次代谈已结束',
  party_account_deleted: '相关账号已注销，本次代谈已结束',
};

/**
 * outcome_code 的附加闭词：只消费查看者已获准返回的安全码，细化「哪一条没对上」；
 * 不能展开隐藏阈值，绝不原词兜底。与 outcome 说明同义的码（句中已含其义）不再重复。
 */
const 终局码文案表 = {
  compensation_incompatible: '薪资条件不匹配',
  hard_exclusion: '必要条件不匹配',
  screening_incomplete: '自动筛选未完成',
  human_response_timeout: '逾期未回应',
} as const;

const 终局状态缺省文案 = '已结束';
const 终局原因缺省文案 = '结束原因暂未提供';

/**
 * 终局 → 阶段胶囊词 + 一句说明 + 色调。状态文/原因取 A.2.1 七闭表；已知安全 code 细化原因
 * （同义时保留完整句，不缩水成裸码词）；未知 outcome/code 给「已结束/结束原因暂未提供」。
 * 色调只分两档：否定性/异常终局给 提醒，自愿或中性闭场（已结束）给 中性；技术失败
 * （agent_failed）同样是 提醒，绝不给成功勾 —— 成功事实由调用者按 lifecycle 处理。
 */
export function 代谈终局文案(
  outcome: string | null, code: string | null,
): { 状态文: string; 原因: string; 色调: '成功' | '提醒' | '中性' } {
  const 已知 = outcome !== null && 已有键(终局状态文案表, outcome);
  const 状态文 = 已知 ? 终局状态文案表[outcome] : 终局状态缺省文案;
  let 原因 = 已知 ? 终局原因文案表[outcome] : 终局原因缺省文案;
  if (code !== null && 已有键(终局码文案表, code) && !原因.includes(终局码文案表[code])) {
    原因 = 终局码文案表[code];
  }
  return { 状态文, 原因, 色调: 状态文 === 终局状态缺省文案 ? '中性' : '提醒' };
}
