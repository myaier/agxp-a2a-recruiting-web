// 在线简历展示映射：BFF候选在线简历（nullable 共享在线简历）→ 在线简历展示资料 的
// 纯函数投影（Task 5）。视图按 在谈详情/在线简历正文 的原信息槽 allowlist 重建，
// wire 上多余的键（industry、internship、identity、候选薪资数字等）一律带不出去 ——
// 真名 / 身份披露 / 公司实名恢复永远不走这条映射。
// 缺失语义逐键冻结（与 BFF 契约同口径）：resume / 区域 null = 数据源未提供（缺失），
// [] = 提供了但一条没有，二者在投影结果里不可互换。

import type { BFF安全简历教育, BFF安全简历经历, BFF安全简历项目, BFF候选在线简历 } from './BFF契约';
import type { 在线简历展示资料 } from '../组件/在谈详情/类型';
import { 办公方式文案, 招聘类型文案, 薪资关系文案 } from './发现推荐映射';
import { 映射招聘候选摘要 } from './招聘候选摘要映射';

/** trim 后无有效字符按缺失处理（同 列表卡片映射 的缺失规则） */
function 非空文本(值: string | null | undefined): string | null {
  const 文 = 值?.trim() ?? '';
  return 文 === '' ? null : 文;
}

function 段行(段们: (string | null)[]): string | null {
  const 非空 = 段们.filter((段): 段 is string => 段 !== null);
  return 非空.length > 0 ? 非空.join(' · ') : null;
}

/** 起止显示文案：有真实开始时间才把 end_month=null 显示为「至今」；起始也缺失给
 *  「日期未知」，不造一段任职。 */
function 起止行(起: string | null, 止: string | null): string {
  if (起 === null) return '日期未知';
  return `${起.replace('-', '.')}—${止 === null ? '至今' : 止.replace('-', '.')}`;
}

/** 展示资料的数组元素槽（数组成员可空，先剥 null 再取元素） */
type 工作槽 = NonNullable<在线简历展示资料['工作']>[number];
type 项目槽 = NonNullable<在线简历展示资料['项目']>[number];
type 教育槽 = NonNullable<在线简历展示资料['教育']>[number];

/** SafeResumeExperience → 工作槽：公司缺失给中性「未披露」，不借 industry 伪装公司名；
 *  行业无原槽不带出。 */
function 工作资料(段: BFF安全简历经历): 工作槽 {
  return {
    公司: 非空文本(段.company) ?? '未披露',
    起止: 起止行(段.start_month, 段.end_month),
    职位: 非空文本(段.title),
    说明: 非空文本(段.description),
  };
}

/** SafeResumeProject → 项目槽：按所属工作顺序平铺，name/role/result 原位；
 *  项目无独立日期，绝不拿所属工作的起止充数。 */
function 项目资料(项: BFF安全简历项目): 项目槽 {
  return {
    名称: 非空文本(项.name) ?? '未披露',
    角色: 非空文本(项.role),
    结果: 非空文本(项.result),
  };
}

/** SafeResumeEducation → 教育条：多条按源顺序，复用既有教育行写法（学校 · 专业 · 学历） */
function 教育资料(段: BFF安全简历教育): 教育槽 {
  return {
    行: 段行([非空文本(段.institution), 非空文本(段.major), 非空文本(段.degree)]) ?? '未披露',
    起止: 起止行(段.start_month, 段.end_month),
  };
}

/** SafeCandidateExpectation + compensation_relationship → 期望槽：只显示招聘类型 /
 *  职位方向 / 地点 / 办公方式；薪资槽只吃既有薪资关系文案，unknown 不作结论（null）。
 *  候选薪资数字不存在于合同上，也不在此合成。全无证据收口为 null。 */
function 期望资料(resume: BFF候选在线简历): 在线简历展示资料['期望'] {
  const 期望 = resume.expectation;
  if (期望 === null) return null;
  const 标题 = 段行([
    期望.recruitment_type === null ? null : 招聘类型文案[期望.recruitment_type],
    非空文本(期望.job_category?.display_name ?? null),
  ]);
  const 地点 = 段行((期望.locations ?? []).map((处) => 非空文本(处.display_name)));
  const 办公 = 段行((期望.workplace_modes ?? []).map((式) => 办公方式文案[式]));
  const 薪资 = resume.compensation_relationship === 'unknown'
    ? null
    : 薪资关系文案[resume.compensation_relationship];
  if (标题 === null && 地点 === null && 办公 === null && 薪资 === null) return null;
  return { 标题, 薪资关系: 薪资, 副行: 段行([地点, 办公]) };
}

/** BFF候选在线简历 | null → 在线简历展示资料 | null：整份 null（详情 candidate_resume
 *  = null）投影为 null，不造空资料；非空档按槽投影，各区缺源保留 null / [] 分界。 */
export function 从BFF到在线简历展示(resume: BFF候选在线简历 | null): 在线简历展示资料 | null {
  if (resume === null) return null;
  // 头行画像复用 招聘候选摘要映射 的冻结口径（0 年「不满 1 年」、闭表求职状态、
  // 工作/教育行 trim 判空）；personal_highlights 保留为候选摘要事实，正文无独立槽不带出。
  const 摘要 = 映射招聘候选摘要(resume.summary);
  return {
    画像: 摘要 === null ? null : {
      性别: 摘要.性别 ?? null,
      年限: 摘要.年限,
      学历: 摘要.学历,
      求职状态: 摘要.求职状态,
      职位行: 摘要.工作,
    },
    个人优势: 非空文本(resume.self_description),
    期望: 期望资料(resume),
    工作: resume.experiences === null ? null : resume.experiences.map(工作资料),
    项目: resume.experiences === null ? null : resume.experiences.flatMap((段) => 段.projects.map(项目资料)),
    教育: resume.educations === null ? null : resume.educations.map(教育资料),
    技能: resume.skills === null ? null : [...resume.skills],
  };
}