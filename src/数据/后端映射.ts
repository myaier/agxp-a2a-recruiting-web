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
  BFF硬性条件,
} from './BFF契约';
import type { 基本信息, 简历经历段, 简历教育段, 简历证书, 简历项目, 在招岗位, 求职意向, 岗位硬性事实 } from './类型';
import type {
  页面简历快照,
  目录选择值,
  意向草稿型,
  意向映射上下文,
  岗位创建上下文,
  首次意向输入,
} from './招聘数据源类型';
import { 迁移主要求职类型 } from '../流程/onboarding配置';

// ── 身份 / 性别 枚举映射（固定）──
const 身份到后端 = { 在校: 'student', 在职: 'employed', 离职: 'unemployed' } as const;
const 后端到身份 = { student: '在校', employed: '在职', unemployed: '离职' } as const;
const 性别到后端 = { 男: 'male', 女: 'female' } as const;
const 后端到性别 = { male: '男', female: '女' } as const;

/**
 * 简历写入用：取选择器保存的目录引用 id。没有引用说明用户手输了显示名而没从候选选，
 * 直接抛客户端校验错——不回退按显示名反查目录（那是意向/岗位的 legacy 路径）。
 */
function 必需引用(value: 目录选择值 | undefined, label: string): string {
  if (!value) throw new Error(`请从候选${label}中选择`);
  return value.id;
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

/** Experience 的 id 直接作页面 编号；industry.display_name → 行业，industry 本体作 行业引用；projects 保留真实 ID。 */
function 转经历(段: BFF经历): 简历经历段 {
  const 经历: 简历经历段 = {
    编号: 段.id,
    公司: 段.company,
    行业: 段.industry.display_name,
    // owner DTO 的 industry 即 BFF目录引用，写入时直接用 引用.id，不再反查目录
    行业引用: 段.industry,
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

/** Education 的 institution/major.display_name 映射学校/专业并保留真实 ID；owner DTO 本体作引用。 */
function 转教育(段: BFF教育): 简历教育段 {
  return {
    编号: 段.id,
    学校: 段.institution.display_name,
    // owner DTO 的 institution/major 即 BFF目录引用，写入时直接用 引用.id，不再反查目录
    学校引用: 段.institution,
    学历: 段.degree,
    专业: 段.major.display_name,
    专业引用: 段.major,
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

/** 页面经历段 → 后端经历写入 body；行业引用.id 直接作 industry_id，不再按显示名反查目录。 */
export function 转经历写入(段: 简历经历段): BFF经历写入 {
  const 写入: BFF经历写入 = {
    company: 段.公司,
    industry_id: 必需引用(段.行业引用, '行业'),
    title: 段.职位,
    start_month: 段.开始,
    end_month: 段.结束,
    description: 段.内容,
    hidden: 段.隐藏,
  };
  if (段.实习 !== undefined) 写入.internship = 段.实习;
  return 写入;
}

/** 页面教育段 → 后端教育写入 body；学校/专业引用.id 直接作 id，不再按显示名反查目录。 */
export function 转教育写入(段: 简历教育段): BFF教育写入 {
  return {
    institution_id: 必需引用(段.学校引用, '学校'),
    major_id: 必需引用(段.专业引用, '专业'),
    degree: 段.学历,
    start_month: 段.开始,
    // 简历教育段.结束 是必填字符串；'' 表示至今，写入时落 null
    end_month: 段.结束 || null,
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

/**
 * BFF意向（完整 BFFOwnerIntention DTO）→ 意向草稿，供编辑已有意向时预填。
 * 列表条目（从BFF意向）只带 编号/标题/说明 三个稀疏字段，从它拆草稿会丢
 * alternate_locations / industries / 薪资结构 / 后端招聘类型 ——
 * 打开+原样保存一条已有意向就会清掉这些字段（真实数据丢失）。
 * 这里从 读取意向() 保留的服务端 DTO 重建完整草稿，字段与 意向草稿型 一一对应。
 * Task 6：同时填充 目录选择值 引用（职位/工作城市/感兴趣城市/行业）与 办公方式（中文标签），
 * 保存时映射层直接用引用.id，不再按显示名反查目录。
 */
export function 从BFF意向草稿(dto: BFFOwnerIntention): 意向草稿型 {
  const 是区间 = dto.compensation.mode === 'range';
  return {
    编辑编号: dto.intention_id,
    求职类型: 招聘类型到页面[dto.recruitment_type],
    工作城市: dto.primary_location.display_name,
    工作城市引用: dto.primary_location,
    期望职位: dto.job_category.display_name,
    职位引用: dto.job_category,
    感兴趣城市们: dto.alternate_locations.map((a) => a.display_name),
    感兴趣城市引用们: dto.alternate_locations,
    薪资下限: 是区间 ? (dto.compensation.lower ?? null) : null,
    薪资上限: 是区间 ? (dto.compensation.upper ?? null) : null,
    期望行业们: dto.industries.map((i) => i.display_name),
    行业引用们: dto.industries,
    办公方式: dto.workplace_modes.map((w) => 后端到办公方式[w]),
    后端招聘类型: dto.recruitment_type,
    求职类型已改: false,
  };
}

function 映射办公方式(页值们: string[]): BFFOwnerIntention['workplace_modes'] {
  if (页值们.length === 0) throw new Error('请先完善办公方式');
  // 兼容两种来源：引导预填.筛选偏好.办公方式 存的是中文标签（现场/混合/远程/全远程），
  // 而 已有意向的服务端快照 workplace_modes 存的是 BFF wire code（onsite/hybrid/remote）。
  // 原来只查中文表，wire code 进来 → undefined → workplace_modes:[null] 被 BFF 拒。
  // 这里先查中文表，查不到再当作 wire code 原样透传（仍是非法时返回 undefined 由上层校验）。
  const 合法wire = new Set(['onsite', 'hybrid', 'remote']);
  return 页值们.map((值) => 办公方式到后端[值 as keyof typeof 办公方式到后端] ?? (合法wire.has(值) ? 值 : undefined)) as BFFOwnerIntention['workplace_modes'];
}

/**
 * 去重目录引用：按 id 去重，保留首次出现的顺序。
 * 意向草稿的 感兴趣城市引用们 / 城市引用们 可能含重复 id（不同来源合并），
 * 写入前按 id 去重，primary_location 从 alternates 中剔除（Task 6）。
 */
export function 去重引用(refs: 目录选择值[]): 目录选择值[] {
  const seen = new Set<string>();
  const out: 目录选择值[] = [];
  for (const 项 of refs) {
    if (seen.has(项.id)) continue;
    seen.add(项.id);
    out.push(项);
  }
  return out;
}

/** 草稿 → BFF意向写入 body。打开已有意向且用户没切招聘类型时保留原 recruitment_type。
 *  Task 6：目录字段直接读草稿里的引用（Tasks 3-4 已原子保存），不再按显示名反查目录；
 *  办公方式 从草稿.办公方式 读（必填草稿字段），不再从上下文取。 */
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
  // annual_salary_months：新建时不存在就省略（不填 12）；编辑时从服务端快照保留（#4）。
  // salary_period 是 BFF 根据 recruitment_type 派生的只读字段（不在 IntentionWrite body 里），
  // 保留原 recruitment_type 即保留了 period —— 草稿不能表达 period，但保存不会丢它。
  const alternate_location_ids = 去重引用(草稿.感兴趣城市引用们 ?? [])
    .filter((item) => item.id !== 草稿.工作城市引用?.id)
    .map((item) => item.id);
  const compensation: BFF意向补偿 =
    草稿.薪资下限 === null || 草稿.薪资上限 === null
      ? { mode: 'negotiable' }
      : {
          mode: 'range',
          lower: 草稿.薪资下限,
          upper: 草稿.薪资上限,
          ...(原始?.compensation.annual_salary_months == null ? {} : { annual_salary_months: 原始.compensation.annual_salary_months }),
        };
  // exclusions：更新沿用服务端快照，新建四个均为 unspecified（草稿不带排除项）
  const exclusions: BFF意向排除 = 原始 !== null
    ? 原始.exclusions
    : { alternate_weekend_work: 'unspecified', outsourcing_only: 'unspecified', onsite_only: 'unspecified', frequent_travel: 'unspecified' };
  return {
    recruitment_type,
    job_category_id: 必需引用(草稿.职位引用, '职位'),
    primary_location_id: 必需引用(草稿.工作城市引用, '工作城市'),
    alternate_location_ids,
    industry_ids: (草稿.行业引用们 ?? []).map((item) => item.id),
    workplace_modes: 映射办公方式(草稿.办公方式 ?? []),
    compensation,
    graduation_month,
    internship_months,
    onsite_days_per_week,
    exclusions,
    private_preferences: 原始 !== null ? 原始.private_preferences : '',
  };
}

/** 首次注册向导答案 → BFF意向写入 body。用 迁移主要求职类型 取唯一主类型。
 *  Task 6：目录字段直接读输入里的引用（职位引用/城市引用们），不再按显示名反查目录；
 *  办公方式 从输入.筛选偏好.办公方式 读（向导答案里的中文标签）。 */
export function 转首次意向写入(输入: 首次意向输入): BFF意向写入 {
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
  const [primary, ...alternate] = 去重引用(输入.城市引用们 ?? []);
  if (!primary) throw new Error('请从候选城市中选择');
  return {
    recruitment_type,
    job_category_id: 必需引用(输入.职位引用, '职位'),
    primary_location_id: primary.id,
    alternate_location_ids: alternate.map((item) => item.id),
    industry_ids: [],
    workplace_modes: 映射办公方式(输入.筛选偏好.办公方式),
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
// 经验要求：页面五档（发布岗位.tsx 的 经验要求选项）与 BFF enum 一一对应。
// 未在映射里的页值（如演示域的「3 年以上」）直接抛错——契约漂移要当面暴露，不能静默落成 'none' 丢数据。
const 经验要求到后端 = {
  不限: 'none', '1-3 年': 'one_to_three_years', '3-5 年': 'three_to_five_years',
  '5 年以上': 'five_plus_years', '10 年以上': 'ten_plus_years',
} as const;
const 后端到经验要求 = {
  none: '不限', one_to_three_years: '1-3 年', three_to_five_years: '3-5 年',
  five_plus_years: '5 年以上', ten_plus_years: '10 年以上',
} as const;
// P3：四问硬性事实 双向闭合表。服务端 OwnerJob 必返完整四员（数据源层 fail closed 校验），
// 映射层不做 `?? unknown` 兜底 —— 契约漂移要当面暴露。
const 后端到硬性事实档 = { required: '必须', not_required: '不要求', unknown: '未说明' } as const;
const 硬性事实档到后端 = { 必须: 'required', 不要求: 'not_required', 未说明: 'unknown' } as const;

/** BFF四员硬性条件 → 页面 硬性事实；四个成员一一对应，无默认值。 */
export function 从BFF硬性条件(dto: BFF硬性条件): 岗位硬性事实 {
  return {
    大小周: 后端到硬性事实档[dto.alternate_weekend_work],
    纯外包乙方: 后端到硬性事实档[dto.outsourcing_only],
    全现场办公: 后端到硬性事实档[dto.onsite_only],
    频繁出差: 后端到硬性事实档[dto.frequent_travel],
  };
}

/** 页面 硬性事实 → BFF四员硬性条件；写入方向同样无默认值。 */
function 硬性事实到后端(事实: 岗位硬性事实): BFF硬性条件 {
  return {
    alternate_weekend_work: 硬性事实档到后端[事实.大小周],
    outsourcing_only: 硬性事实档到后端[事实.纯外包乙方],
    onsite_only: 硬性事实档到后端[事实.全现场办公],
    frequent_travel: 硬性事实档到后端[事实.频繁出差],
  };
}

/** 页面 经验要求 → BFF enum；未映射的页值抛错，绝不静默降级为 'none'。 */
function 映射经验要求(页值: string | undefined): string {
  const 键 = (页值 ?? '') as keyof typeof 经验要求到后端;
  if (!(键 in 经验要求到后端)) throw new Error(`未映射的经验要求：${页值 ?? '(空)'}`);
  return 经验要求到后端[键];
}

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

/**
 * 页面 届别（校园招聘）→ BFF campus_cohort 年份数字。
 * '不限'（UI 默认不限届别）/ 空 / 非数字 一律落 null：原来 '不限'.replace(/\D/g,'')=''
 * → Number('')=0 被当成 0 届发出，0 不是合法届别年份。
 */
function 解析届别(届别: string | undefined): number | null {
  if (!届别 || 届别 === '不限') return null;
  const 数 = Number(届别.replace(/\D/g, ''));
  return Number.isFinite(数) && 数 > 0 ? 数 : null;
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
    // owner DTO 的 category/location 同时落到 类别引用/地点引用，写入时直接用 引用.id（Task 7）
    类别引用: dto.category,
    地点引用: dto.location,
    办公地: dto.office_location,
    办公方式: 后端到办公方式[dto.workplace_mode],
    招聘类型: 后端到岗位类型[dto.recruitment_type],
    职位类别: dto.category.display_name,
    筛选要求: dto.private_screening_preferences,
    经验要求: 后端到经验要求[dto.experience_requirement as keyof typeof 后端到经验要求] ?? dto.experience_requirement,
    最低学历: 后端到学历[dto.education_requirement as keyof typeof 后端到学历] ?? dto.education_requirement,
    // P3：四问硬性事实随 owner DTO 必返；缺员/坏档由数据源层在映射前拒绝
    硬性事实: 从BFF硬性条件(dto.hard_requirements),
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

/** 页面岗位 → BFF岗位创建 body。加分关键词/实习转正 不进 body（只进前端附属存储）。
 *  Task 7：category_id/location_id 直接读 类别引用/地点引用（选择器保存的引用），不再按显示名反查目录。
 *  P1C Task 5：claim 只吃显式 岗位创建上下文（direct + 声明）；refs/verification status 由服务端推导，不进 body。 */
export function 转岗位创建(页面岗位: 在招岗位, 上下文: 岗位创建上下文): BFF岗位创建 {
  const { lower, upper } = 解析薪资带(页面岗位.薪资带);
  return {
    publisher_mode: 上下文.publisherMode,
    hiring_organization_claim: 上下文.hiringOrganizationClaim,
    title: 页面岗位.名称,
    recruitment_type: 岗位类型到后端[页面岗位.招聘类型 as keyof typeof 岗位类型到后端],
    category_id: 必需引用(页面岗位.类别引用, '类别'),
    location_id: 必需引用(页面岗位.地点引用, '地点'),
    office_location: 页面岗位.办公地 ?? '',
    workplace_mode: 办公方式到岗位后端[页面岗位.办公方式 as keyof typeof 办公方式到岗位后端] ?? 'onsite',
    salary: { lower, upper },
    annual_salary_months: 页面岗位.年薪月数 ?? null,
    // '不限'(UI 默认不限届别) / 空 / 非数字 一律落 null：原来 '不限'.replace(/\D/g,'')=''
    // → Number('')=0，会被当成 0 届发出去。0 不是合法届别年份。
    campus_cohort: 解析届别(页面岗位.届别),
    internship_months: 页面岗位.实习月数 ?? null,
    onsite_days_per_week: 页面岗位.每周天数 ?? null,
    experience_requirement: 映射经验要求(页面岗位.经验要求),
    education_requirement: 学历到后端[页面岗位.最低学历 as keyof typeof 学历到后端] ?? 'none',
    // P3：四员块整体可选；页面没有 硬性事实（老 Mock 岗）时不硬造缺省对象
    ...(页面岗位.硬性事实 ? { hard_requirements: 硬性事实到后端(页面岗位.硬性事实) } : {}),
    description: 页面岗位.职位描述 ?? '',
    requirements: 页面岗位.职位要求 ?? '',
    keywords: 页面岗位.职位关键词,
    private_screening_preferences: 页面岗位.筛选要求 ?? '',
  };
}

/** 页面岗位 → BFF岗位补丁 body。title/type/category/location 带回服务端原值（immutable-field 契约），其余按编辑表单。
 *  P1C Task 5：不接公司 context —— publisher_mode 与 hiring_organization_claim 直接沿用 previous
 *  owner DTO，普通 JD 编辑不拿当前自由文本改 claim。 */
export function 转岗位补丁(
  页面岗位: 在招岗位,
  previous: BFFOwnerJob,
): BFF岗位补丁 {
  const { lower, upper } = 解析薪资带(页面岗位.薪资带);
  return {
    publisher_mode: previous.publisher_mode,
    hiring_organization_claim: {
      display_name: previous.hiring_organization_claim.display_name,
      legal_name: previous.hiring_organization_claim.legal_name ?? null,
    },
    title: previous.title,
    recruitment_type: previous.recruitment_type,
    category_id: previous.category.id,
    location_id: previous.location.id,
    office_location: 页面岗位.办公地 ?? '',
    workplace_mode: 办公方式到岗位后端[页面岗位.办公方式 as keyof typeof 办公方式到岗位后端] ?? 'onsite',
    salary: { lower, upper },
    annual_salary_months: 页面岗位.年薪月数 ?? null,
    campus_cohort: 解析届别(页面岗位.届别),
    internship_months: 页面岗位.实习月数 ?? null,
    onsite_days_per_week: 页面岗位.每周天数 ?? null,
    experience_requirement: 映射经验要求(页面岗位.经验要求),
    education_requirement: 学历到后端[页面岗位.最低学历 as keyof typeof 学历到后端] ?? 'none',
    // P3：页面带 硬性事实 才写四员块；缺省（absent）= 服务端保持存储值
    ...(页面岗位.硬性事实 ? { hard_requirements: 硬性事实到后端(页面岗位.硬性事实) } : {}),
    description: 页面岗位.职位描述 ?? '',
    requirements: 页面岗位.职位要求 ?? '',
    keywords: 页面岗位.职位关键词,
    private_screening_preferences: 页面岗位.筛选要求 ?? '',
  };
}