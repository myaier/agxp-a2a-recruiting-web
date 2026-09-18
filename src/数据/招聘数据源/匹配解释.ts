// 匹配解释 decoder：include=match_explanation 展开对象的六维严格解码（冻结公共合同 C1）。
// 与发现推荐 / MatchCase / 连续代谈各域同一闭合纪律：exact key set、闭集枚举、有限整数，
// 并逐条复核后端冻结验证器的固定版本三元组、六维固定顺序与权重、reason→status 闭表、
// skills 计数约束和分项和=total_points=同响应 match_score。一切损坏输入走
// invalid_response，绝不降级为合法 null —— null 只属于显式 match_explanation=null。
//
// 本模块只校验服务端已给数据的一致性，不从 JD/简历重新评分：skills 分公式仅作为
// v1 解码的一致性校验留在本文件内（不导出、不构成评分入口），展示始终使用返回的
// points；版本变化走契约错误，不悄悄套新权重。默认键必须缺席 / 展开键必须在场的
// 模式区分由调用方各自的闭合键白名单负责（C1），本函数只解码展开键的值。

import { BFF错误 } from '../HTTP客户端';
import type {
  BFF办公方式原因,
  BFF匹配原因,
  BFF匹配状态,
  BFF匹配维度,
  BFF方向原因,
  BFF技能原因,
  BFF地点原因,
  BFF经验原因,
  BFF薪资原因,
  BFF技能维度解释,
  BFF匹配解释,
} from '../BFF契约';

function 契约错误(message = '服务返回了不符合契约的匹配解释数据'): BFF错误 {
  return new BFF错误(200, 'invalid_response', message);
}

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === 'object' && 值 !== null && !Array.isArray(值);
}

/** exact key set：缺必需键、显式 undefined、多出未知键都按契约漂移 fail closed。 */
function 要求闭合对象(input: unknown, 必需键: readonly string[]): Record<string, unknown> {
  if (!是记录(input)) throw 契约错误();
  for (const 键 of 必需键) {
    if (!(键 in input) || input[键] === undefined) throw 契约错误();
  }
  for (const 键 of Object.keys(input)) if (!必需键.includes(键)) throw 契约错误();
  return input;
}

function 要求字符串(值: unknown): string {
  if (typeof 值 !== 'string') throw 契约错误();
  return 值;
}

/** OpenAPI integer：解释里一切数值必须有限安全整数（NaN/Infinity/小数/字符串都是漂移）。 */
function 要求整数(值: unknown): number {
  if (typeof 值 !== 'number' || !Number.isSafeInteger(值)) throw 契约错误();
  return 值;
}

const 状态全表 = ['matched', 'partially_matched', 'not_matched', 'unknown'] as const satisfies readonly BFF匹配状态[];

function 要求状态(值: unknown): BFF匹配状态 {
  if (typeof 值 !== 'string') throw 契约错误();
  for (const 候选 of 状态全表) if (候选 === 值) return 候选;
  throw 契约错误();
}

// ── C1 闭表：每维 reason 词 → 固定状态。satisfies 与 BFF契约.ts 的六个原因联合
// 双向锁定：缺词、多词、状态不在四态闭集内都编不过。──

const 方向原因状态 = {
  job_category_missing: 'unknown',
  candidate_category_missing: 'unknown',
  category_matched: 'matched',
  category_not_matched: 'not_matched',
} as const satisfies Record<BFF方向原因, BFF匹配状态>;

const 技能原因状态 = {
  job_keywords_missing: 'unknown',
  candidate_skills_missing: 'unknown',
  no_keyword_overlap: 'not_matched',
  partial_keyword_overlap: 'partially_matched',
  all_keywords_matched: 'matched',
} as const satisfies Record<BFF技能原因, BFF匹配状态>;

const 经验原因状态 = {
  requirements_unconfirmed: 'unknown',
  candidate_experience_missing: 'unknown',
  experience_met: 'matched',
  experience_not_met: 'not_matched',
} as const satisfies Record<BFF经验原因, BFF匹配状态>;

const 地点原因状态 = {
  job_location_missing: 'unknown',
  candidate_locations_missing: 'unknown',
  location_matched: 'matched',
  location_not_matched: 'not_matched',
} as const satisfies Record<BFF地点原因, BFF匹配状态>;

const 办公方式原因状态 = {
  job_workplace_mode_missing: 'unknown',
  candidate_workplace_modes_missing: 'unknown',
  workplace_mode_matched: 'matched',
  workplace_mode_not_matched: 'not_matched',
} as const satisfies Record<BFF办公方式原因, BFF匹配状态>;

const 薪资原因状态 = {
  compensation_overlap: 'matched',
  compensation_near_miss: 'partially_matched',
  compensation_disjoint: 'not_matched',
  compensation_type_mismatch: 'unknown',
  compensation_negotiable: 'unknown',
  candidate_compensation_missing: 'unknown',
  job_compensation_missing: 'unknown',
  compensation_not_annualizable: 'unknown',
  compensation_type_unsupported: 'unknown',
} as const satisfies Record<BFF薪资原因, BFF匹配状态>;

/** 六维冻结权重（C1：25/35/15/10/5/10）；固定顺序由解匹配解释的逐位调用与
 * BFF匹配解释 的六元组类型共同锁定。 */
const 维度满分: Record<BFF匹配维度, number> = {
  direction: 25,
  skills: 35,
  experience: 15,
  location: 10,
  workplace_mode: 5,
  compensation: 10,
};

/** 词在冻结闭表内才放行，并原样给出该维的闭合 reason 词型（同 候选摘要.ts 的闭集纪律）。 */
function 闭表原因<原因 extends BFF匹配原因>(
  值: unknown,
  表: Readonly<Record<string, BFF匹配状态>>,
): 原因 {
  const 词 = 要求字符串(值);
  if (表[词] === undefined) throw 契约错误();
  return 词 as 原因;
}

/**
 * 状态→分数形状（C1）：matched 必为该维满分；unknown/not_matched 必为 0；
 * 部分匹配仅 skills/compensation —— 非技能维度里只有 compensation 有 P 词且固定 5 分，
 * skills 的分由计数公式在 解技能维度 内另行复核。
 */
function 复核状态分形状(维度: BFF匹配维度, 状态: BFF匹配状态, 分: number, 满分: number): void {
  if (状态 === 'matched' && 分 !== 满分) throw 契约错误();
  if ((状态 === 'unknown' || 状态 === 'not_matched') && 分 !== 0) throw 契约错误();
  if (状态 === 'partially_matched' && 维度 !== 'skills') {
    if (维度 !== 'compensation') throw 契约错误();
    if (分 !== 5) throw 契约错误();
  }
}

const 维度基础键 = ['dimension', 'status', 'points', 'max_points', 'reason_code'] as const;

type 非技能维度名 = Exclude<BFF匹配维度, 'skills'>;

/** 五个非技能维度共用解码：位置定维名、闭表定状态、固定权重定满分、形状定分数。 */
function 解非技能维度<维度 extends 非技能维度名, 原因 extends Exclude<BFF匹配原因, BFF技能原因>>(
  input: unknown,
  期望维度: 维度,
  原因状态表: Readonly<Record<string, BFF匹配状态>>,
): { dimension: 维度; status: BFF匹配状态; points: number; max_points: number; reason_code: 原因 } {
  const raw = 要求闭合对象(input, 维度基础键);
  if (raw['dimension'] !== 期望维度) throw 契约错误();
  const 满分 = 要求整数(raw['max_points']);
  if (满分 !== 维度满分[期望维度]) throw 契约错误();
  const 分 = 要求整数(raw['points']);
  if (分 < 0 || 分 > 满分) throw 契约错误();
  const 状态 = 要求状态(raw['status']);
  const 原因 = 闭表原因<原因>(raw['reason_code'], 原因状态表);
  if (原因状态表[原因] !== 状态) throw 契约错误();
  复核状态分形状(期望维度, 状态, 分, 满分);
  return { dimension: 期望维度, status: 状态, points: 分, max_points: 满分, reason_code: 原因 };
}

/**
 * 冻结 v1 解码一致性：required=0 → 0，否则 floor(35*matched/required)。仅复核服务端
 * 已给的计数与分数自洽（对 skills 维，公式连同计数约束一起蕴含了 matched=满分 /
 * unknown、not_matched=0 / 部分匹配<满分 的全部形状），不是业务评分入口。
 */
function 技能一致分(命中: number, 总数: number): number {
  return 总数 === 0 ? 0 : Math.floor((35 * 命中) / 总数);
}

/** skills 计数与 reason 的组合约束（与后端 validateSkillsReasonCounts 一致）。 */
function 复核技能计数(原因: BFF技能原因, 命中: number, 总数: number): void {
  switch (原因) {
    case 'job_keywords_missing':
      // 命中 ≤ 总数 已保证 matched=0。
      if (总数 !== 0) throw 契约错误();
      break;
    case 'candidate_skills_missing':
    case 'no_keyword_overlap':
      if (总数 <= 0 || 命中 !== 0) throw 契约错误();
      break;
    case 'partial_keyword_overlap':
      if (!(总数 > 0 && 命中 > 0 && 命中 < 总数)) throw 契约错误();
      break;
    case 'all_keywords_matched':
      if (!(总数 > 0 && 命中 === 总数)) throw 契约错误();
      break;
  }
}

function 解技能维度(input: unknown): BFF技能维度解释 {
  const raw = 要求闭合对象(input, [...维度基础键, 'matched_count', 'required_count']);
  if (raw['dimension'] !== 'skills') throw 契约错误();
  const 满分 = 要求整数(raw['max_points']);
  if (满分 !== 维度满分['skills']) throw 契约错误();
  const 分 = 要求整数(raw['points']);
  if (分 < 0 || 分 > 满分) throw 契约错误();
  const 状态 = 要求状态(raw['status']);
  const 原因 = 闭表原因<BFF技能原因>(raw['reason_code'], 技能原因状态);
  if (技能原因状态[原因] !== 状态) throw 契约错误();
  const 命中 = 要求整数(raw['matched_count']);
  const 总数 = 要求整数(raw['required_count']);
  if (命中 < 0 || 命中 > 总数) throw 契约错误();
  复核技能计数(原因, 命中, 总数);
  if (分 !== 技能一致分(命中, 总数)) throw 契约错误();
  return {
    dimension: 'skills',
    status: 状态,
    points: 分,
    max_points: 满分,
    reason_code: 原因,
    matched_count: 命中,
    required_count: 总数,
  };
}

const 顶层键 = ['schema_version', 'ranking_version', 'basis', 'total_points', 'max_points', 'dimensions'] as const;

/**
 * 解匹配解释（C1）：input=null 直接返回 null（matchScore 有值也不看）；undefined 不视为
 * null；对象时 matchScore 必须为有效整数且等于 total_points。展开键的缺席/在场模式由
 * 调用方的闭合键白名单区分后把键值传入；一切损坏输入抛 invalid_response，不降级 null。
 */
export function 解匹配解释(input: unknown, matchScore: number | null): BFF匹配解释 | null {
  if (input === null) return null;
  if (!是记录(input)) throw 契约错误();
  const raw = 要求闭合对象(input, 顶层键);
  if (raw['schema_version'] !== 'match-explanation.v1') throw 契约错误();
  if (raw['ranking_version'] !== 'discovery-ranking.v2') throw 契约错误();
  if (raw['basis'] !== 'batch_snapshot') throw 契约错误();
  const 满分 = 要求整数(raw['max_points']);
  if (满分 !== 100) throw 契约错误();
  const 总分 = 要求整数(raw['total_points']);
  if (总分 < 0 || 总分 > 满分) throw 契约错误();
  if (typeof matchScore !== 'number' || !Number.isSafeInteger(matchScore) || matchScore !== 总分) {
    throw 契约错误();
  }
  const 维度们 = raw['dimensions'];
  if (!Array.isArray(维度们) || 维度们.length !== 6) throw 契约错误();
  // 位置定维名：丢维、乱序、重复都在这里 fail closed。
  const 方向 = 解非技能维度<'direction', BFF方向原因>(维度们[0], 'direction', 方向原因状态);
  const 技能 = 解技能维度(维度们[1]);
  const 经验 = 解非技能维度<'experience', BFF经验原因>(维度们[2], 'experience', 经验原因状态);
  const 地点 = 解非技能维度<'location', BFF地点原因>(维度们[3], 'location', 地点原因状态);
  const 办公方式 = 解非技能维度<'workplace_mode', BFF办公方式原因>(维度们[4], 'workplace_mode', 办公方式原因状态);
  const 薪资 = 解非技能维度<'compensation', BFF薪资原因>(维度们[5], 'compensation', 薪资原因状态);
  const 分项和 = 方向.points + 技能.points + 经验.points + 地点.points + 办公方式.points + 薪资.points;
  if (分项和 !== 总分) throw 契约错误();
  const 解释: BFF匹配解释 = {
    schema_version: 'match-explanation.v1',
    ranking_version: 'discovery-ranking.v2',
    basis: 'batch_snapshot',
    total_points: 总分,
    max_points: 100,
    dimensions: [方向, 技能, 经验, 地点, 办公方式, 薪资],
  };
  return 解释;
}
