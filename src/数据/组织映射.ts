// 组织映射：Organization wire DTO → 页面 view model 的纯函数转换。
// React 只消费本文件冻结的三个 view（招聘身份视图/公开企业视图/岗位发布方视图）与 资料形，
// 不直接解释 wire enum / optional field；本文件不 import React、Mock 或静态公司档案。
// 公开企业视图 是 P1C 独立小类型，不复用要求企业文化/发展历程/在职感受的 Mock 公司档案 大类型。

import type {
  BFF企业关系,
  BFF企业规模,
  BFF企业档案,
  BFF企业档案替换,
  BFF企业管理员申请,
  BFF作息,
  BFF公开企业,
  BFFOwnerJob,
  BFF福利码,
  BFF融资阶段,
  BFF验证状态,
  BFF团队成员,
  BFF招聘方档案,
} from './BFF契约';
import type { 资料形 } from './公司主页资料';

// ── closed code↔中文 表（与 BFF契约 的闭合 union 一一对应）──

export const 公司规模文案 = {
  '': '', under_20: '20 人以下', '20_99': '20-99 人', '100_499': '100-499 人',
  '500_1000': '500-1000 人', '1000_9999': '1000-9999 人', '10000_plus': '10000 人以上',
} as const;
export const 融资阶段文案 = {
  '': '', unfunded: '未融资', angel: '天使轮', series_a: 'A 轮', series_b: 'B 轮',
  series_c: 'C 轮', series_d_plus: 'D 轮及以上', public: '已上市', self_funded: '不需要融资',
} as const;
export const 作息文案 = {
  '': '', two_day_weekend: '双休', alternate_saturday: '大小周', flexible: '弹性',
} as const;

/** benefit_codes ↔ 福利标签池 的 17 项一一映射（同序）。未知 closed code 在 组织.ts decoder 处 fail closed。 */
export const 福利文案: Record<BFF福利码, string> = {
  social_insurance_housing_fund: '五险一金',
  supplementary_medical: '补充医疗',
  stock_options: '股票期权',
  flexible_work: '弹性工作',
  annual_physical_exam: '年度体检',
  regular_physical_exam: '定期体检',
  paid_annual_leave: '带薪年假',
  meal_allowance: '餐补',
  transport_allowance: '交通补助',
  housing_allowance: '住房补贴',
  holiday_benefits: '节日福利',
  team_building_meals: '团建聚餐',
  snacks_afternoon_tea: '零食下午茶',
  overtime_allowance: '加班补助',
  year_end_bonus: '年终奖',
  shuttle_bus: '免费班车',
  regular_training: '定期培训',
};

const 反规模 = new Map<string, BFF企业规模>(
  Object.entries(公司规模文案).map(([code, 文]) => [文, code as BFF企业规模]));
const 反融资 = new Map<string, BFF融资阶段>(
  Object.entries(融资阶段文案).map(([code, 文]) => [文, code as BFF融资阶段]));
const 反作息 = new Map<string, BFF作息>(
  Object.entries(作息文案).map(([code, 文]) => [文, code as BFF作息]));
const 反福利 = new Map<string, BFF福利码>(
  Object.entries(福利文案).map(([code, 文]) => [文, code as BFF福利码]));

const 企业关系状态文案 = { pending: '待认证', verified: '已认证', revoked: '已解除' } as const;
const 管理员申请状态文案 = { pending: '待审核', approved: '已通过', rejected: '已驳回', cancelled: '已取消' } as const;
const 验证状态文案 = { unverified: '未认证', verified: '已认证' } as const;

// ── 页面 view：React 只能消费这些字段，不得另起别名解释 DTO ──

export interface 招聘企业关系视图 {
  id: string; organizationId: string; organizationName: string;
  status: BFF企业关系['status']; statusLabel: string;
  role: BFF企业关系['role']; roleLabel: '成员' | '管理员'; selectable: boolean;
}

export interface 招聘身份视图 {
  publicName: string;
  title: string;
  personalVerification: { code: BFF验证状态; label: '未认证' | '已认证' };
  verifiedName: string | null; // DTO 缺键与 null 均归一到 null
  avatarUrl: string | null;
  affiliations: readonly 招聘企业关系视图[];
  currentAffiliation: 招聘企业关系视图 | null;
  latestAdminRequest: {
    id: string; status: BFF企业管理员申请['status']; statusLabel: string; revision: number;
  } | null;
}

export interface 公开企业视图 {
  organizationId: string; legalName: string; displayName: string; verifiedAt: string;
  brandName: string; industryName: string | null; companySizeLabel: string; fundingStageLabel: string;
  officeAddress: string; benefitLabels: readonly string[]; workScheduleLabel: string;
  companyIntro: string; businessItems: readonly string[]; productIntro: string;
  teamMembers: readonly BFF团队成员[]; logoUrl: string | null;
  officeMediaUrls: readonly string[]; companyMediaUrls: readonly string[];
  activeVerifiedJobCount: number; revision: number;
}

export interface 岗位发布方视图 {
  发布方模式: BFFOwnerJob['publisher_mode'];
  发布方验证: BFF验证状态; 发布方企业编号: string | null;
  用人企业验证: BFF验证状态; 用人企业编号: string | null;
  用人企业声明: BFFOwnerJob['hiring_organization_claim'];
}

// ── current Affiliation 选择规则（固定）──

/** 可用 = Organization active 且关系 verified；pending/revoked/suspended 都不可发岗。 */
export function 可用企业关系(affiliation: BFF企业关系): boolean {
  return affiliation.organization_status === 'active' && affiliation.status === 'verified';
}

/** 恢复值只有在最新列表中仍指向可用关系时才保留；无恢复值且恰好一个可用才自动选；0 或多个返回 null。
 *  恢复值失效（revoke/suspend）时清空且不自动切到另一家替用户发岗。 */
export function 选择当前企业关系(
  affiliations: BFF企业关系[],
  restoredId: string | null,
): string | null {
  if (restoredId !== null) {
    const 恢复项 = affiliations.find((项) => 项.affiliation_id === restoredId);
    return 恢复项 !== undefined && 可用企业关系(恢复项) ? restoredId : null;
  }
  const 可用者 = affiliations.filter(可用企业关系);
  return 可用者.length === 1 ? 可用者[0].affiliation_id : null;
}

// ── 企业档案 wire ↔ 页面资料 ──

export function 从BFF企业档案(profile: BFF企业档案): 资料形 {
  return {
    公司全称: profile.brand_name,
    行业: profile.industry?.display_name ?? '',
    规模: 公司规模文案[profile.company_size],
    融资阶段: 融资阶段文案[profile.funding_stage],
    办公地址: profile.office_address,
    福利标签: profile.benefit_codes.map((码) => 福利文案[码]),
    作息档: 作息文案[profile.work_schedule],
    公司介绍: profile.company_intro,
    主营业务: profile.business_items.join('\n'),
    实景照片: profile.office_media.map((媒体) => 媒体.url),
    公司照片: profile.company_media.map((媒体) => 媒体.url),
    产品介绍: profile.product_intro,
    团队介绍: profile.team_members.map(({ name, title, summary }) => ({
      姓名: name, 职务: title, 简介: summary,
    })),
    // 完整 replacement 所需的可选元数据（不产生新表单槽位）
    行业引用: profile.industry ?? undefined,
    LOGO媒体: profile.logo,
    实景媒体: profile.office_media,
    公司媒体: profile.company_media,
  };
}

export function 转BFF企业档案替换(draft: 资料形, server: BFF企业档案): BFF企业档案替换 {
  // industry_id 三分支：引用存在发其 ID；显示名与引用都空发空字符串（未设置）；只有显示名拒绝保存。
  let industry_id: string;
  if (draft.行业引用) industry_id = draft.行业引用.id;
  else if (draft.行业.trim() === '') industry_id = '';
  else throw new Error('请从候选行业中选择');

  return {
    brand_name: draft.公司全称,
    industry_id,
    company_size: 反规模.get(draft.规模) ?? '',
    funding_stage: 反融资.get(draft.融资阶段) ?? '',
    office_address: draft.办公地址,
    // 未知中文标签不回写（replacement 只收 closed code），与 读资料 的池过滤一致
    benefit_codes: draft.福利标签.flatMap((标签) => {
      const 码 = 反福利.get(标签);
      return 码 === undefined ? [] : [码];
    }),
    work_schedule: 反作息.get(draft.作息档) ?? '',
    company_intro: draft.公司介绍,
    business_items: draft.主营业务.split('\n').map((行) => 行.trim()).filter(Boolean),
    // 媒体 ID 只从草稿里的权威媒体对象（server snapshot 或显式上传结果）取，不从 URL 解析；
    // 草稿未带元数据（Mock 构造）时回退最新 server snapshot。
    office_media_ids: (draft.实景媒体 ?? server.office_media).map((媒体) => 媒体.media_id),
    company_media_ids: (draft.公司媒体 ?? server.company_media).map((媒体) => 媒体.media_id),
    product_intro: draft.产品介绍,
    team_members: draft.团队介绍.map(({ 姓名, 职务, 简介 }) => ({
      name: 姓名, title: 职务, summary: 简介,
    })),
    // LOGO媒体 === null 是权威的“无 LOGO”（用户已移除），undefined 才回退 server snapshot。
    // 空 = 无 LOGO：P1B runtime 的完整 replacement 约定，不能改成 null。
    logo_media_id: ((draft.LOGO媒体 !== undefined ? draft.LOGO媒体 : server.logo)?.media_id) ?? '',
  };
}

// ── 招聘身份视图 ──

function 转企业关系视图(关系: BFF企业关系): 招聘企业关系视图 {
  return {
    id: 关系.affiliation_id,
    organizationId: 关系.organization_id,
    organizationName: 关系.organization_display_name,
    status: 关系.status,
    statusLabel: 企业关系状态文案[关系.status],
    role: 关系.role,
    roleLabel: 关系.role === 'admin' ? '管理员' : '成员',
    selectable: 可用企业关系(关系),
  };
}

function 转最新申请视图(requests: BFF企业管理员申请[]): 招聘身份视图['latestAdminRequest'] {
  // 服务端列表按最新在前返回；DTO 无时间戳字段，取首条作为“最新状态”。
  const 最新 = requests[0];
  if (最新 === undefined) return null;
  return {
    id: 最新.request_id,
    status: 最新.status,
    statusLabel: 管理员申请状态文案[最新.status],
    revision: 最新.revision,
  };
}

export function 从BFF招聘身份(
  profile: BFF招聘方档案 | null,
  affiliations: BFF企业关系[],
  currentAffiliationId: string | null,
  requests: BFF企业管理员申请[],
): 招聘身份视图 {
  const 关系视图 = affiliations.map(转企业关系视图);
  const 状态: BFF验证状态 = profile?.personal_verification_status ?? 'unverified';
  return {
    publicName: profile?.public_name ?? '',
    title: profile?.title ?? '',
    personalVerification: { code: 状态, label: 验证状态文案[状态] },
    verifiedName: profile?.verified_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    affiliations: 关系视图,
    // 投影只反映传入的 current 编号（由 选择当前企业关系 的规则在上游决定），不在视图里再猜
    currentAffiliation: 关系视图.find((项) => 项.id === currentAffiliationId) ?? null,
    latestAdminRequest: 转最新申请视图(requests),
  };
}

// ── 公开企业视图（P1C 独立小类型，只含线上字段）──

export function 从BFF公开企业(dto: BFF公开企业): 公开企业视图 {
  const { profile } = dto;
  return {
    organizationId: dto.organization_id,
    legalName: dto.legal_name,
    displayName: dto.display_name,
    verifiedAt: dto.verified_at,
    brandName: profile.brand_name,
    industryName: profile.industry?.display_name ?? null,
    companySizeLabel: 公司规模文案[profile.company_size],
    fundingStageLabel: 融资阶段文案[profile.funding_stage],
    officeAddress: profile.office_address,
    benefitLabels: profile.benefit_codes.map((码) => 福利文案[码]),
    workScheduleLabel: 作息文案[profile.work_schedule],
    companyIntro: profile.company_intro,
    businessItems: profile.business_items,
    productIntro: profile.product_intro,
    teamMembers: profile.team_members,
    logoUrl: profile.logo?.url ?? null,
    officeMediaUrls: profile.office_media.map((媒体) => 媒体.url),
    companyMediaUrls: profile.company_media.map((媒体) => 媒体.url),
    activeVerifiedJobCount: dto.active_verified_job_count,
    // 明确来自 dto.profile.revision；BFF公开企业 没有也不得新增顶层 revision
    revision: profile.revision,
  };
}

// ── Job publisher/hiring 投影（不折叠）──

export function 从BFF岗位发布方(dto: BFFOwnerJob): 岗位发布方视图 {
  return {
    发布方模式: dto.publisher_mode,
    发布方验证: dto.publisher_verification_status,
    发布方企业编号: dto.publisher_organization_ref ?? null,
    用人企业验证: dto.hiring_organization_verification_status,
    用人企业编号: dto.hiring_organization_ref ?? null,
    用人企业声明: dto.hiring_organization_claim,
  };
}
