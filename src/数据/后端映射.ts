// 简历与目录映射层：BFF DTO <-> 页面领域形状 的纯函数转换。
// 字段重命名 / 默认值 / 协议判断只落在这里，不散进 React 组件；
// 接口失败绝不回退 Mock。新建页面条目的临时编号不是后端 ID，写入后须用服务端响应替换。

import type {
  BFF简历,
  BFF简历资料,
  BFF经历,
  BFF项目,
  BFF教育,
  BFF证书,
  BFF目录引用,
  BFF资料写入,
  BFF经历写入,
  BFF教育写入,
  BFF证书写入,
  BFFOwnerIntention,
  BFFOwnerJob,
  BFF意向写入,
  BFF意向补偿,
  BFF意向排除,
  BFF岗位创建,
  BFF岗位补丁,
} from './BFF契约';
import type { 基本信息, 简历经历段, 简历教育段, 简历证书, 简历项目, 在招岗位, 求职意向 } from './类型';
import type {
  页面简历快照,
  目录索引,
  意向草稿型,
  意向映射上下文,
  首次意向输入,
} from './招聘数据源类型';
import { 迁移主要求职类型 } from '../流程/onboarding配置';

// ── 身份 / 性别 枚举映射（固定）──
const 身份到后端 = { 在校: 'student', 在职: 'employed', 离职: 'unemployed' } as const;
const 后端到身份 = { student: '在校', employed: '在职', unemployed: '离职' } as const;
const 性别到后端 = { 男: 'male', 女: 'female' } as const;
const 后端到性别 = { male: '男', female: '女' } as const;

/**
 * 精确目录匹配：要求 display_name 完全相等且唯一。
 * 不是唯一一条就抛错——前缀 / 模糊匹配会让「产品」误命中「产品经理」，写错行业/职位类别。
 */
export function 精确目录ID(items: BFF目录引用[], 显示名: string, 类别: string): string {
  const 命中 = items.filter((项) => 项.display_name === 显示名);
  if (命中.length !== 1) throw new Error(`无法唯一匹配${类别}：${显示名}`);
  return 命中[0].id;
}

/** 后端 null → 页面可选空字符串；数值年份/月份 → 字符串。 */
function 转基本(资料: BFF简历资料): 基本信息 {
  const 基本: 基本信息 = {
    真名: 资料.real_name,
    开始工作年: 资料.work_start_year !== null ? String(资料.work_start_year) : '',
    // 从未写入过的 profile（status === ''）按注册流默认「在职」展示；用户保存前仍走身份选择页
    身份: 资料.status === '' ? '在职' : 后端到身份[资料.status],
  };
  if (资料.current_education !== null) 基本.在读学历 = 资料.current_education;
  if (资料.graduation_year !== null) 基本.毕业年 = String(资料.graduation_year);
  if (资料.gender !== null) 基本.性别 = 后端到性别[资料.gender];
  if (资料.birth_year !== null) 基本.出生年 = String(资料.birth_year);
  if (资料.birth_month !== null) 基本.出生月 = String(资料.birth_month);
  return 基本;
}

function 转项目(项: BFF项目): 简历项目 {
  return { 编号: 项.id, 名称: 项.name, 角色: 项.role, 结果: 项.result };
}

/** Experience 的 id 直接作页面 编号；industry.display_name → 行业；projects 保留真实 ID。 */
function 转经历(段: BFF经历): 简历经历段 {
  const 经历: 简历经历段 = {
    编号: 段.id,
    公司: 段.company,
    行业: 段.industry.display_name,
    职位: 段.title,
    开始: 段.start_month,
    结束: 段.end_month,
    内容: 段.description,
    隐藏: 段.hidden,
  };
  if (段.internship) 经历.实习 = 段.internship;
  const 项目 = 段.projects ?? [];
  if (项目.length > 0) 经历.项目 = 项目.map(转项目);
  return 经历;
}

/** Education 的 institution/major.display_name 映射学校/专业并保留真实 ID。 */
function 转教育(段: BFF教育): 简历教育段 {
  return {
    编号: 段.id,
    学校: 段.institution.display_name,
    学历: 段.degree,
    专业: 段.major.display_name,
    开始: 段.start_month,
    // 简历教育段.结束 是必填字符串；后端 null（至今在读）落成空串
    结束: 段.end_month ?? '',
  };
}

/** Certificate 的整数 year 转字符串。 */
function 转证书(段: BFF证书): 简历证书 {
  return { 编号: 段.id, 名称: 段.name, 年份: String(段.year) };
}

/**
 * BFF简历 → 页面简历快照。服务端快照保留完整 DTO，使 aggregate_revision 等元数据直达。
 */
export function 从BFF简历(dto: BFF简历): 页面简历快照 {
  return {
    基本信息: 转基本(dto.profile),
    个人优势: dto.summary,
    技能: dto.skills,
    经历: dto.experiences.map(转经历),
    教育: dto.educations.map(转教育),
    证书: dto.certificates.map(转证书),
    服务端快照: dto,
  };
}

/**
 * 页面 基本信息 → 后端资料写入 body。
 * 页面空字符串 → 后端 null（可选字段）；工作开始年 字符串 → 数字；
 * 页面 身份 反映射为后端 status（必为 student/employed/unemployed，不含空串）。
 */
export function 转资料写入(基本: 基本信息): BFF资料写入 {
  return {
    real_name: 基本.真名,
    work_start_year: 基本.开始工作年 !== '' ? Number(基本.开始工作年) : null,
    status: 身份到后端[基本.身份],
    current_education: 基本.在读学历 && 基本.在读学历 !== '' ? 基本.在读学历 : null,
    graduation_year: 基本.毕业年 && 基本.毕业年 !== '' ? Number(基本.毕业年) : null,
    gender: 基本.性别 ? 性别到后端[基本.性别] : null,
    birth_year: 基本.出生年 && 基本.出生年 !== '' ? Number(基本.出生年) : null,
    birth_month: 基本.出生月 && 基本.出生月 !== '' ? Number(基本.出生月) : null,
  };
}

/** 页面经历段 → 后端经历写入 body；行业显示名经 目录.行业 精确匹配回 industry_id。 */
export function 转经历写入(段: 简历经历段, 目录: 目录索引): BFF经历写入 {
  const 写入: BFF经历写入 = {
    company: 段.公司,
    industry_id: 精确目录ID(目录.行业, 段.行业, '行业'),
    title: 段.职位,
    start_month: 段.开始,
    end_month: 段.结束,
    description: 段.内容,
    hidden: 段.隐藏,
  };
  if (段.实习 !== undefined) 写入.internship = 段.实习;
  return 写入;
}

/** 页面教育段 → 后端教育写入 body；院校/专业显示名经目录精确匹配回 id。 */
export function 转教育写入(段: 简历教育段, 目录: 目录索引): BFF教育写入 {
  return {
    institution_id: 精确目录ID(目录.院校, 段.学校, '院校'),
    degree: 段.学历,
    major_id: 精确目录ID(目录.专业, 段.专业, '专业'),
    start_month: 段.开始,
    end_month: 段.结束 === '' ? null : 段.结束,
  };
}

/** 页面证书 → 后端证书写入 body；年份空字符串拒绝写入，不写 NaN。 */
export function 转证书写入(段: 简历证书): BFF证书写入 {
  if (段.年份 === '') throw new Error('证书年份不能为空');
  const 年 = Number(段.年份);
  if (Number.isNaN(年)) throw new Error(`证书年份不是数字：${段.年份}`);
  return { name: 段.名称, year: 年 };
}

// ── 意向映射（BFFOwnerIntention <-> 页面 求职意向 / 意向草稿型）──
//
// 页面只有 全职/兼职 两个单选，校园/实习 的区分只能从后端保留：
// 打开后端意向时 后端招聘类型 写进草稿，用户没点过单选（求职类型已改=false）就保留原类型；
// 用户点过单选则按页面值覆盖（全职→social_full_time，兼职→part_time）。

const 招聘类型到页面 = {
  social_full_time: '全职', campus: '全职', internship: '全职', part_time: '兼职',
} as const;
const 页面招聘类型到后端 = { 全职: 'social_full_time', 兼职: 'part_time' } as const;
const 办公方式到后端 = { 现场: 'onsite', 混合: 'hybrid', 远程: 'remote', 全远程: 'remote' } as const;
export { 招聘类型到页面 };

/** BFF意向 → 页面求职意向表条目（编号/标题/说明），标题沿用 `[城市] 职位` 格式以兼容 拆意向为草稿。 */
export function 从BFF意向(dto: BFFOwnerIntention): 求职意向 {
  const 薪资段 = dto.compensation.mode === 'negotiable'
    ? '面议'
    : `${dto.compensation.lower}-${dto.compensation.upper}${dto.salary_period === 'day' ? ' 元/天' : dto.salary_period === 'hour' ? ' 元/时' : 'K'}`;
  return {
    编号: dto.intention_id,
    标题: `[${dto.primary_location.display_name}] ${dto.job_category.display_name}`,
    说明: 薪资段,
  };
}

function 映射办公方式(页值们: string[]): BFFOwnerIntention['workplace_modes'] {
  if (页值们.length === 0) throw new Error('请先完善办公方式');
  return 页值们.map((值) => 办公方式到后端[值 as keyof typeof 办公方式到后端]);
}

/** 草稿 → BFF意向写入 body。打开已有意向且用户没切招聘类型时保留原 recruitment_type。 */
export function 转意向写入(草稿: 意向草稿型, 上下文: 意向映射上下文): BFF意向写入 {
  const 原始 = 上下文.原始;
  const 保留原类型 = 原始 !== null && !草稿.求职类型已改;
  const recruitment_type = 保留原类型
    ? 原始.recruitment_type
    : 页面招聘类型到后端[草稿.求职类型];
  const 是校园或实习 = recruitment_type === 'campus' || recruitment_type === 'internship';
  // 校园/实习 的 graduation/internship/onsite 字段 UI 未表达，更新已有意向时从服务端快照保留；新建或全职/兼职发 null
  const graduation_month = 是校园或实习 && 原始 !== null ? 原始.graduation_month : null;
  const internship_months = 是校园或实习 && 原始 !== null ? 原始.internship_months : null;
  const onsite_days_per_week = 是校园或实习 && 原始 !== null ? 原始.onsite_days_per_week : null;
  const compensation: BFF意向补偿 =
    草稿.薪资下限 === null || 草稿.薪资上限 === null
      ? { mode: 'negotiable' }
      : { mode: 'range', lower: 草稿.薪资下限, upper: 草稿.薪资上限 };
  // exclusions：更新沿用服务端快照，新建四个均为 unspecified（草稿不带排除项）
  const exclusions: BFF意向排除 = 原始 !== null
    ? 原始.exclusions
    : { alternate_weekend_work: 'unspecified', outsourcing_only: 'unspecified', onsite_only: 'unspecified', frequent_travel: 'unspecified' };
  return {
    recruitment_type,
    job_category_id: 精确目录ID(上下文.目录.职位类别, 草稿.期望职位, '职位类别'),
    primary_location_id: 精确目录ID(上下文.目录.地点, 草稿.工作城市, '地点'),
    alternate_location_ids: 草稿.感兴趣城市们.map((城) => 精确目录ID(上下文.目录.地点, 城, '地点')),
    industry_ids: 草稿.期望行业们.map((行) => 精确目录ID(上下文.目录.行业, 行, '行业')),
    workplace_modes: 映射办公方式(上下文.办公方式),
    compensation,
    graduation_month,
    internship_months,
    onsite_days_per_week,
    exclusions,
    private_preferences: 原始 !== null ? 原始.private_preferences : '',
  };
}

/** 首次注册向导答案 → BFF意向写入 body。用 迁移主要求职类型 取唯一主类型。 */
export function 转首次意向写入(输入: 首次意向输入, 上下文: 意向映射上下文): BFF意向写入 {
  const 主类型偏好 = 迁移主要求职类型(输入.筛选偏好, 输入.薪资.单位);
  const 主要 = 主类型偏好.求职类型[0];
  const recruitment_type = 岗位类型到后端[主要];
  const 是校园 = recruitment_type === 'campus';
  const 是实习 = recruitment_type === 'internship';
  // 五个内置排除项映射四个 BFF exclusion 为 excluded，未选为 unspecified；自定义文本写进 private_preferences
  const 排除集 = new Set(输入.排除项);
  const 内置 = ['大小周', '纯外包', '乙方', '全现场办公', '频繁出差'];
  const exclusions: BFF意向排除 = {
    alternate_weekend_work: 排除集.has('大小周') ? 'excluded' : 'unspecified',
    outsourcing_only: 排除集.has('纯外包') || 排除集.has('乙方') ? 'excluded' : 'unspecified',
    onsite_only: 排除集.has('全现场办公') ? 'excluded' : 'unspecified',
    frequent_travel: 排除集.has('频繁出差') ? 'excluded' : 'unspecified',
  };
  const 自定义 = 输入.排除项.filter((项) => !内置.includes(项));
  const private_preferences = 自定义.length > 0 ? `其他排除：${自定义.join('、')}` : '';
  return {
    recruitment_type,
    job_category_id: 精确目录ID(上下文.目录.职位类别, 输入.职位们[0] ?? '', '职位类别'),
    primary_location_id: 精确目录ID(上下文.目录.地点, 输入.城市们[0] ?? '', '地点'),
    alternate_location_ids: 输入.城市们.slice(1).map((城) => 精确目录ID(上下文.目录.地点, 城, '地点')),
    industry_ids: [],
    workplace_modes: 映射办公方式(上下文.办公方式),
    compensation: { mode: 'range', lower: 输入.薪资.下限, upper: 输入.薪资.上限 },
    graduation_month: 是校园 ? (主类型偏好.毕业时间 ?? null) : null,
    internship_months: 是实习 ? (主类型偏好.实习月数 ?? null) : null,
    onsite_days_per_week: 是实习 ? (主类型偏好.每周到岗天数 ?? null) : null,
    exclusions,
    private_preferences,
  };
}

// ── 岗位映射（BFFOwnerJob <-> 页面 在招岗位）──
//
// 加分关键词/实习转正 只进前端附属存储（按 后端环境+真实岗位ID 为键），不出现在 BFF body。
// 真实岗位 在谈数 固定 0；演示候选仍由未支持演示域自行计算。

const 后端到岗位类型 = { social_full_time: '社招全职', campus: '校园招聘', internship: '实习生', part_time: '兼职' } as const;
const 后端到办公方式 = { onsite: '现场', hybrid: '混合', remote: '远程' } as const;
const 后端到学历 = { none: '不限', associate: '大专', bachelor: '本科', master: '硕士', doctorate: '博士' } as const;
const 岗位类型到后端 = { 社招全职: 'social_full_time', 校园招聘: 'campus', 实习生: 'internship', 兼职: 'part_time' } as const;
const 办公方式到岗位后端 = { 现场: 'onsite', 混合: 'hybrid', 远程: 'remote', 全远程: 'remote' } as const;
const 学历到后端 = { 不限: 'none', 大专: 'associate', 本科: 'bachelor', 硕士: 'master', 博士: 'doctorate' } as const;
const 经验到后端: Record<string, string> = { 不限: 'none' };

/** 薪资带文本 → { lower, upper, period }；解析失败直接抛错（不静默写 NaN）。 */
function 解析薪资带(带: string): { lower: number; upper: number; period: 'month' | 'day' | 'hour' } {
  const m = /^(\d+)\s*-\s*(\d+)\s*(K|元\/天|元\/时)$/.exec(带);
  if (!m) throw new Error(`薪资带解析失败：${带}`);
  const lower = Number(m[1]);
  const upper = Number(m[2]);
  const period = m[3] === 'K' ? 'month' : m[3] === '元/天' ? 'day' : 'hour';
  return { lower, upper, period };
}

function 薪资带到文本(下: number, 上: number, 周期: 'month' | 'day' | 'hour'): string {
  const 后缀 = 周期 === 'month' ? 'K' : 周期 === 'day' ? ' 元/天' : ' 元/时';
  return `${下}-${上}${后缀}`;
}

/** BFF岗位 → 页面 在招岗位。附属字段（加分关键词/实习转正）从 附属 参数注入，不在 BFF body。真实岗位 在谈数 固定 0。 */
export function 从BFF岗位(dto: BFFOwnerJob, 附属: { 加分关键词?: string[]; 实习转正?: boolean }): 在招岗位 {
  const 岗位: 在招岗位 = {
    编号: dto.job_id,
    名称: dto.title,
    薪资带: 薪资带到文本(dto.salary_lower, dto.salary_upper, dto.salary_period),
    状态: dto.status === 'active' ? '在招' : '已归档',
    在谈数: 0,
    城市: dto.location.display_name,
    办公地: dto.office_location,
    办公方式: 后端到办公方式[dto.workplace_mode],
    招聘类型: 后端到岗位类型[dto.recruitment_type],
    职位类别: dto.category.display_name,
    筛选要求: dto.private_screening_preferences,
    经验要求: dto.experience_requirement,
    最低学历: 后端到学历[dto.education_requirement as keyof typeof 后端到学历] ?? dto.education_requirement,
    职位描述: dto.description,
    职位要求: dto.requirements,
    职位关键词: dto.keywords,
    发布于: dto.published_at.slice(0, 10),
  };
  if (dto.internship_months !== null) 岗位.实习月数 = dto.internship_months;
  if (dto.onsite_days_per_week !== null) 岗位.每周天数 = dto.onsite_days_per_week;
  if (dto.annual_salary_months !== null) 岗位.年薪月数 = dto.annual_salary_months;
  if (dto.campus_cohort !== null) 岗位.届别 = `${dto.campus_cohort} 届`;
  if (附属.加分关键词) 岗位.加分关键词 = 附属.加分关键词;
  if (附属.实习转正 !== undefined) 岗位.实习转正 = 附属.实习转正;
  return 岗位;
}

/** 页面岗位 → BFF岗位创建 body。加分关键词/实习转正 不进 body（只进前端附属存储）。 */
export function 转岗位创建(页面岗位: 在招岗位, 目录: 目录索引, 上下文: { 公司: string }): BFF岗位创建 {
  const { lower, upper } = 解析薪资带(页面岗位.薪资带);
  return {
    publisher_mode: 'direct',
    hiring_organization_claim: { display_name: 上下文.公司, legal_name: null },
    title: 页面岗位.名称,
    recruitment_type: 岗位类型到后端[页面岗位.招聘类型 as keyof typeof 岗位类型到后端],
    category_id: 精确目录ID(目录.职位类别, 页面岗位.职位类别 ?? '', '职位类别'),
    location_id: 精确目录ID(目录.地点, 页面岗位.城市 ?? '', '地点'),
    office_location: 页面岗位.办公地 ?? '',
    workplace_mode: 办公方式到岗位后端[页面岗位.办公方式 as keyof typeof 办公方式到岗位后端] ?? 'onsite',
    salary: { lower, upper },
    annual_salary_months: 页面岗位.年薪月数 ?? null,
    campus_cohort: 页面岗位.届别 ? Number(页面岗位.届别.replace(/\D/g, '')) : null,
    internship_months: 页面岗位.实习月数 ?? null,
    onsite_days_per_week: 页面岗位.每周天数 ?? null,
    experience_requirement: 经验到后端[页面岗位.经验要求 ?? '不限'] ?? 'none',
    education_requirement: 学历到后端[页面岗位.最低学历 as keyof typeof 学历到后端] ?? 'none',
    description: 页面岗位.职位描述 ?? '',
    requirements: 页面岗位.职位要求 ?? '',
    keywords: 页面岗位.职位关键词,
    private_screening_preferences: 页面岗位.筛选要求 ?? '',
  };
}

/** 页面岗位 → BFF岗位补丁 body。title/type/category/location 带回服务端原值（immutable-field 契约），其余按编辑表单。 */
export function 转岗位补丁(
  页面岗位: 在招岗位,
  上下文: { 原始: BFFOwnerJob; 公司: string },
): BFF岗位补丁 {
  const { lower, upper } = 解析薪资带(页面岗位.薪资带);
  return {
    publisher_mode: 上下文.原始.publisher_mode,
    hiring_organization_claim: { display_name: 上下文.公司, legal_name: 上下文.原始.hiring_organization_claim.legal_name ?? null },
    title: 上下文.原始.title,
    recruitment_type: 上下文.原始.recruitment_type,
    category_id: 上下文.原始.category.id,
    location_id: 上下文.原始.location.id,
    office_location: 页面岗位.办公地 ?? '',
    workplace_mode: 办公方式到岗位后端[页面岗位.办公方式 as keyof typeof 办公方式到岗位后端] ?? 'onsite',
    salary: { lower, upper },
    annual_salary_months: 页面岗位.年薪月数 ?? null,
    campus_cohort: 页面岗位.届别 ? Number(页面岗位.届别.replace(/\D/g, '')) : null,
    internship_months: 页面岗位.实习月数 ?? null,
    onsite_days_per_week: 页面岗位.每周天数 ?? null,
    experience_requirement: 经验到后端[页面岗位.经验要求 ?? '不限'] ?? 'none',
    education_requirement: 学历到后端[页面岗位.最低学历 as keyof typeof 学历到后端] ?? 'none',
    description: 页面岗位.职位描述 ?? '',
    requirements: 页面岗位.职位要求 ?? '',
    keywords: 页面岗位.职位关键词,
    private_screening_preferences: 页面岗位.筛选要求 ?? '',
  };
}