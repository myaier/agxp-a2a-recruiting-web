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
} from './BFF契约';
import type { 基本信息, 简历经历段, 简历教育段, 简历证书, 简历项目 } from './类型';
import type { 页面简历快照, 目录索引 } from './招聘数据源类型';

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