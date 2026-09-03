// 发现推荐映射：P4 Discovery* wire DTO → 页面视图（P4候选岗位页面 / P4招聘候选页面）的纯函数投影。
// 视图是 allowlist：只挑展示字段重建，wire 上多余的键（哪怕被污染进 DTO）一律带不出去 ——
// 不带 Mock 查找键（公司 slug 等），不带招聘端禁见字段（candidate subject、真名、联系方式、
// 性别、出生数据、候选薪资数字），也不编造 wire 上不存在的事实（发布人缺席 → null）。
// 公开公司路由 ID 只认 hiring_organization_ref，公司名只认 hiring_organization_claim。

import type {
  BFFCandidateJob,
  BFFOwnerJob,
  BFF候选岗位推荐,
  BFF委托回执,
  BFF委托失败码,
  BFF委托拒绝码,
  BFF委托摘要,
  BFF招聘候选推荐,
  BFF淘汰原因,
} from './BFF契约';
import type { 市场职位 } from './类型';
import type { P4候选岗位页面, P4招聘候选页面 } from './招聘数据源类型';

// ── 闭合文案表：契约内枚举 → 展示文案，无表外键、无默认兜底 ──
const 薪资关系文案 = {
  overlap: '薪资带有交集', near_miss: '薪资带接近',
  disjoint: '薪资带无交集', unknown: '薪资带未核对',
} as const;
const 淘汰文案 = {
  experience_insufficient: '年限不足', direction_mismatch: '方向不符',
  primary_stack_mismatch: '主栈不符', other: '其他',
} as const;
const 办公方式文案 = { onsite: '现场', hybrid: '混合', remote: '全远程' } as const;
const 薪资单位 = { month: 'K', day: '元/天', hour: '元/时' } as const;

// 与 后端映射 的岗位展示同口径的三组展示文案（那些表未导出，这里按同一份文案重申闭合表）
const 招聘类型文案 = { social_full_time: '社招全职', campus: '校园招聘', internship: '实习生', part_time: '兼职' } as const;
const 经验要求文案 = {
  none: '不限', one_to_three_years: '1-3 年', three_to_five_years: '3-5 年',
  five_plus_years: '5 年以上', ten_plus_years: '10 年以上',
} as const;
const 学历要求文案 = { none: '不限', associate: '大专', bachelor: '本科', master: '硕士', doctorate: '博士' } as const;

/** 市场卡 发布人头像 必填配色；wire 不带颜色，统一中性底，不按身份派生 */
const 发布人配色 = { 底色: '#5b7a9a', 字色: '#fff' } as const;

/** 文本首个 Unicode 码点（代理对整个取，不要半个）；空串返回 '' */
function 首字(文本: string): string {
  return Array.from(文本)[0] ?? '';
}

/** JD 文本按行拆条：trim 后丢空行 */
function 拆行(文本: string): string[] {
  return 文本.split(/\r?\n/).map((行) => 行.trim()).filter((行) => 行 !== '');
}

/** 薪资带文案：K 无空格（'20-35K'），元/天、元/时 前留一个空格（'300-500 元/天'），与 后端映射 同口径 */
function 薪资文案(下: number, 上: number, 周期: 'month' | 'day' | 'hour'): string {
  const 单位 = 薪资单位[周期];
  return `${下}-${上}${单位 === 'K' ? 单位 : ` ${单位}`}`;
}

/**
 * CandidateJob → 市场卡。适配分/意向/匹配理由由调用方按 wire 事实供给
 * （推荐卡带真实匹配分与 match_reasons；详情直取 wire 上没有，给 0 与空，不编造）。
 */
function 建卡(job: BFFCandidateJob, 适配分: number, 意向: string, 理由: string[]): 市场职位 {
  const 发布人 = job.publisher_profile ?? null;
  return {
    编号: job.job_id,
    意向,
    职位: job.title,
    公司: job.hiring_organization_claim.display_name,
    公司首字: 首字(job.hiring_organization_claim.display_name),
    // wire 不带 行业/轮次/规模，留空不编造（筛选与展示都只吃公司名/职位/标签，空串安全）
    公司简介: '',
    薪资: 薪资文案(job.salary_lower, job.salary_upper, job.salary_period),
    适配分,
    标签: [
      招聘类型文案[job.recruitment_type],
      job.location.display_name,
      办公方式文案[job.workplace_mode],
      ...(job.annual_salary_months !== null ? [`${job.annual_salary_months} 薪`] : []),
    ],
    办公方式: 办公方式文案[job.workplace_mode],
    城市: job.location.display_name,
    经验要求: 经验要求文案[job.experience_requirement as keyof typeof 经验要求文案] ?? job.experience_requirement,
    学历要求: 学历要求文案[job.education_requirement as keyof typeof 学历要求文案] ?? job.education_requirement,
    对得上: 理由,
    发布于: job.published_at.slice(0, 10),
    发布人首字: 发布人 ? 首字(发布人.public_name) : '',
    发布人底色: 发布人配色.底色,
    发布人字色: 发布人配色.字色,
    // 发布人 absent → 空串（市场卡渲染必填 string）；绝不拿公司声明合成「某某 · 企业直招」
    发布人: 发布人 ? `${发布人.public_name} · ${发布人.title}` : '',
  };
}

function 建候选岗位视图(
  job: BFFCandidateJob,
  建议: {
    recommendationId: string | null;
    intentionId: string | null;
    适配分: number;
    理由: string[];
    /** 匹配依据是否确认：推荐卡取卡顶层 basis；详情直取无推荐批次 → null */
    匹配依据已确认: boolean | null;
    委托: BFF候选岗位推荐['delegation'];
  },
): P4候选岗位页面 {
  // 岗位事实只取已解码 BFFCandidateJob 字段；办公地点 blank（含纯空白）→ null。
  // 经验/学历 BFF 字段是开放字符串而非闭合枚举：未知码原样透传服务端值（不推断不解析），
  // 绝不让展示层拿到 undefined。
  const 办公地点 = job.office_location.trim();
  const 经验要求 = 经验要求文案[
    job.experience_requirement as keyof typeof 经验要求文案
  ] ?? job.experience_requirement;
  const 学历要求 = 学历要求文案[
    job.education_requirement as keyof typeof 学历要求文案
  ] ?? job.education_requirement;

  return {
    recommendationId: 建议.recommendationId,
    intentionId: 建议.intentionId,
    jobId: job.job_id,
    卡: 建卡(job, 建议.适配分, 建议.intentionId ?? '', 建议.理由),
    岗位事实: {
      城市: job.location.display_name,
      办公方式: 办公方式文案[job.workplace_mode],
      办公地点: 办公地点 === '' ? null : 办公地点,
      年薪月数: job.annual_salary_months,
      经验要求,
      学历要求,
      // 当前 CandidateJob 的现状事实，与卡顶层的历史 basis 是两回事，绝不互相覆盖
      结构化要求已确认: job.structured_requirements_confirmed,
    },
    // 历史 basis 只来自调用方给的卡顶层事实，不从分/理由/岗位 revision 推断
    匹配依据已确认: 建议.匹配依据已确认,
    职位详情: 拆行(job.description),
    职位要求: 拆行(job.requirements),
    公司: {
      名称: job.hiring_organization_claim.display_name,
      首字: 首字(job.hiring_organization_claim.display_name),
      简介: '',
      // 公开公司路由 ID 只认 hiring_organization_ref；claim 不是组织坐标，缺 ref 就是 null
      organizationId: job.hiring_organization_ref ?? null,
    },
    发布人: job.publisher_profile
      ? {
          姓名: job.publisher_profile.public_name,
          职务: job.publisher_profile.title,
          首字: 首字(job.publisher_profile.public_name),
          验证状态: job.publisher_profile.personal_verification_status,
        }
      : null,
    委托: 建议.委托,
  };
}

/** 推荐卡 → 候选岗位页视图：匹配分与 match_reasons 是 wire 事实，原样带出。 */
export function 从P4候选岗位(card: BFF候选岗位推荐): P4候选岗位页面 {
  return 建候选岗位视图(card.job, {
    recommendationId: card.recommendation_id,
    intentionId: card.intention_id,
    适配分: card.match_score,
    理由: card.match_reasons,
    匹配依据已确认: card.structured_requirements_confirmed,
    委托: card.delegation,
  });
}

/**
 * 详情直取（直接 URL / 缓存缺失时 GET 单个 CandidateJob）：wire 无推荐坐标、意向与匹配分，
 * 一律置 null / 0，不编造；委托同样无从谈起，恒 null。
 */
export function 从P4CandidateJob(job: BFFCandidateJob): P4候选岗位页面 {
  return 建候选岗位视图(job, {
    recommendationId: null,
    intentionId: null,
    适配分: 0,
    理由: [],
    // 详情直取没有推荐批次：无历史 basis 可言，绝不拿当前 Job 事实伪造
    匹配依据已确认: null,
    委托: null,
  });
}

/** 推荐卡 → 招聘端候选页视图：匿名 allowlist 投影，DTO 上多出来的键一概带不出去。 */
export function 从P4招聘候选(card: BFF招聘候选推荐): P4招聘候选页面 {
  // 空别名（含纯空白）显示 匿名候选；头像字取显示别名的首个码点
  const 代号 = card.candidate_alias.trim() === '' ? '匿名候选' : card.candidate_alias;
  return {
    recommendationId: card.recommendation_id,
    jobId: card.job_id,
    代号,
    头像字: 首字(代号),
    匹配分: card.match_score,
    亮点: card.highlights,
    // 卡顶层的历史 basis：决定亮点整组显示还是收起，不从分/亮点文字推断
    匹配依据已确认: card.structured_requirements_confirmed,
    // wire 给多少年就显示多少年；null → 空串，不折算不编造
    经验: card.experience_years !== null ? `${card.experience_years} 年` : '',
    // job_status 是 open string，原样透传，不猜中文标签
    求职状态: card.job_status,
    摘要: card.summary,
    技能: card.skills,
    教育: card.educations.map((段) => ({
      学校: 段.institution ?? '未披露',
      专业: 段.major ?? '未披露',
      学历: 段.degree,
      // 起止只由 start_month/end_month 推出（'2017.09—2021.06' / '2019.09—至今'）
      起止: `${段.start_month.replace('-', '.')}—${段.end_month === null ? '至今' : 段.end_month.replace('-', '.')}`,
    })),
    薪资关系: 薪资关系文案[card.compensation_relationship],
    收藏: card.favorite,
    已淘汰: card.rejected,
    // 保留 wire 码；中文文案经 P4淘汰原因文案 换取，展示层不自己猜
    淘汰原因: card.rejection_reason,
    委托: card.delegation,
  };
}

/** BFF淘汰原因 → 展示文案（闭合四员，无表外键）。 */
export function P4淘汰原因文案(reason: BFF淘汰原因): '年限不足' | '方向不符' | '主栈不符' | '其他' {
  return 淘汰文案[reason];
}

/** 展示文案 → BFF淘汰原因（反向码）。表外文案当面抛错，不静默落 other。 */
export function P4淘汰原因码(copy: string): BFF淘汰原因 {
  const 命中 = (Object.keys(淘汰文案) as (keyof typeof 淘汰文案)[])
    .find((键) => 淘汰文案[键] === copy);
  if (命中 === undefined) throw new Error(`未映射的淘汰原因文案：${copy}`);
  return 命中;
}

export type P4招聘组织前提 =
  | { kind: 'unknown' }
  | { kind: 'blocked'; reason: 'unverified' | 'missing_ref' }
  | { kind: 'ready'; organizationRef: string };

export function 判断P4招聘组织前提(job: BFFOwnerJob | null | undefined): P4招聘组织前提 {
  if (job == null) return { kind: 'unknown' };
  if (job.hiring_organization_verification_status !== 'verified') {
    return { kind: 'blocked', reason: 'unverified' };
  }
  const organizationRef = job.hiring_organization_ref?.trim() ?? '';
  return organizationRef === ''
    ? { kind: 'blocked', reason: 'missing_ref' }
    : { kind: 'ready', organizationRef };
}

export interface P4委托展示 {
  state: BFF委托摘要['state'];
  copy: string;
  reason: string | null;
  inProgress: boolean;
  caseId: string | null;
}

const P4委托状态文案表 = {
  accepted: '已提交给 AI，等待处理',
  evaluating: 'AI 正在评估',
  case_started: '已创建真实在谈',
  needs_user: '需要你处理',
  refused: '本次未能继续',
  failed: '本次处理未完成',
} as const satisfies Record<BFF委托摘要['state'], string>;

export function P4委托状态文案(state: BFF委托摘要['state']): string {
  return P4委托状态文案表[state];
}

const P4拒绝原因文案表 = {
  recommendation_not_found: '这条推荐当前已不可用，请刷新后查看',
  recommendation_unavailable: '这条推荐当前已不可用，请刷新后查看',
  recommendation_stale: '这条推荐已过期，请刷新后查看',
  delegation_not_allowed: '当前政策或资格不允许发起这次委托',
  active_case_quota_reached: '当前在谈已达到上限，请先处理已有在谈',
  delegation_cooldown: '近期已联系过对方，暂时不能重复发起',
} as const satisfies Record<BFF委托拒绝码, string>;

export function P4拒绝原因文案(code: BFF委托拒绝码): string {
  return P4拒绝原因文案表[code];
}

const P4失败原因文案表 = {
  delegation_agent_unavailable: 'AI 服务暂时不可用，本次没有创建 Case',
  delegation_evaluation_failed: '本次评估未完成，不代表候选或岗位不合适',
  delegation_failed: '本次委托未完成',
} as const satisfies Record<BFF委托失败码, string>;

export function P4失败原因文案(code: BFF委托失败码): string {
  return P4失败原因文案表[code];
}

export function 映射P4委托展示(
  summary: BFF委托摘要 | null,
  receipt: BFF委托回执 | null,
): P4委托展示 | null {
  if (summary === null) return null;
  const caseId = summary.state === 'case_started' && summary.case_id?.trim()
    ? summary.case_id
    : null;
  // reason 只认权威 receipt：delegation_id 与 state 都与摘要对齐才按对应码槽取 owner-safe
  // 文案；错 ID / 错槽 / 无码一律 null，绝不把别的委托的失败原因带到这张卡上。
  const receiptMatches = receipt !== null
    && receipt.delegation_id === summary.delegation_id
    && receipt.state === summary.state;
  const reason = receiptMatches && receipt !== null
    ? summary.state === 'refused' && receipt.refusal_code !== null
      ? P4拒绝原因文案(receipt.refusal_code)
      : summary.state === 'failed' && receipt.failure_code !== null
        ? P4失败原因文案(receipt.failure_code)
        : null
    : null;
  return {
    state: summary.state,
    copy: P4委托状态文案(summary.state),
    reason,
    inProgress: summary.state === 'accepted' || summary.state === 'evaluating',
    caseId,
  };
}
