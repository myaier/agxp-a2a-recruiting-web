// 页面快照与后端元数据类型：数据源层把 BFF DTO 映射成页面用的领域形状，
// 再把页面写入拆回 BFF 闭合 body。字段重命名 / 默认值 / 协议判断只落在映射层，
// 不散进 React 组件。意向草稿型 从 应用状态.tsx 迁入此处，避免数据层反向 import React Context。
//
// 注：意向草稿型 当前形态与原 应用状态.tsx 中完全一致；Task 4 会再给它加
// 后端招聘类型 / 求职类型已改 两个字段并改归约，本任务不动那两项。

import type { 基本信息, 简历经历段, 简历教育段, 简历证书, 在招岗位, 求职意向, 披露项, 屏蔽项, 市场职位 } from './类型';
import type { 求职初筛偏好, 求职薪资单位 } from '../流程/onboarding配置';
import type { BFF简历, BFF主体, BFF目录引用, BFFOwnerIntention, BFFOwnerJob, BFF隐私快照, BFF委托摘要, BFF淘汰原因, BFF附件简历库 } from './BFF契约';

// ── 分页目录查询（Task 1）：页面层只拿已选目录项的引用，不再全量预取 ──
// 目录选择值 仍是 BFF目录引用，写入 body 里只带 id；页面层不感知后端返回的额外字段。
// 具体后端项类型（BFFTaxonomyItem 等）由 HTTP招聘数据源 在方法签名里约束，页面层用 目录页<T> 消费。

export type 目录选择值 = BFF目录引用;
export interface 目录页<T> { items: T[]; nextCursor: string | null; catalogVersion: string }
export interface Taxonomy查询 { parentId?: string; q?: string; cursor?: string; limit?: number }
export interface Location查询 { q?: string; countryCode?: string; admin1Code?: string; cursor?: string; limit?: number }
export interface Institution查询 { q?: string; countryCode?: string; locationId?: string; cursor?: string; limit?: number }

export interface 页面简历快照 {
  基本信息: 基本信息;
  个人优势: string;
  技能: string[];
  经历: 简历经历段[];
  教育: 简历教育段[];
  证书: 简历证书[];
  /** 保留完整 BFF简历，使 aggregate_revision 等元数据直达：页面.服务端快照.aggregate_revision */
  服务端快照: BFF简历;
}

export type 页面简历写入 = Omit<页面简历快照, '服务端快照'>;

/**
 * 意向草稿：添加/编辑求职期望页与次级页共用的临时表单态。
 * 从 应用状态.tsx 迁入数据层；应用状态.tsx 以 `export type { 意向草稿型 }` 再导出，
 * 现有屏幕 `import { type 意向草稿型 } from '../状态/应用状态'` 不变。
 */
export interface 意向草稿型 {
  /** null = 新建；非空 = 正在编辑 求职意向表 里的这一条 */
  编辑编号: string | null;
  求职类型: '全职' | '兼职';
  工作城市: string;
  /** Backend 城市选择器选中的 Location 引用（id + display_name）；Mock 模式为 undefined。
   *  保存意向时映射层用它取 primary_location_id；Task 6 的 从BFF意向草稿 会填充它。*/
  工作城市引用?: 目录选择值;
  期望职位: string;
  /** 其他感兴趣城市，规格上限 9（计数与置灰由页面把关，归约层只做浅合并，不悄悄截断用户的选择）*/
  感兴趣城市们: string[];
  /** Backend 感兴趣城市引用们（id + display_name）；Mock 模式为空数组。
   *  保存意向时映射层用它们取 alternate_location_ids。*/
  感兴趣城市引用们?: 目录选择值[];
  /** 薪资下限，单位千元；null = 还没选 */
  薪资下限: number | null;
  /** 薪资上限，单位千元；null = 还没选 */
  薪资上限: number | null;
  /** 期望行业，规格上限 3（同 感兴趣城市们，上限在页面把关）*/
  期望行业们: string[];
  /** Backend 期望行业选择器选中的目录引用们；Mock 模式为空数组。
   *  保存意向时映射层用它们取 industry_ids；Tasks 5–6 接入 BFF 写入。*/
  行业引用们?: 目录选择值[];
  /** Backend 期望职位选择器选中的目录引用（单选，意向来源）；Mock 模式为 undefined。
   *  保存意向时映射层用它取 job_category_id；Tasks 5–6 接入 BFF 写入。*/
  职位引用?: 目录选择值;
  /** 后端真实招聘类型；编辑已有意向时从服务端快照带入，新建为 null。
   *  不渲染：页面只有 全职/兼职 两个单选，校园/实习 的区分只能从后端保留。*/
  后端招聘类型: 'social_full_time' | 'campus' | 'internship' | 'part_time' | null;
  /** 用户是否实际点过 全职/兼职 单选；false 时保留 后端招聘类型，true 时按页面值覆盖。*/
  求职类型已改: boolean;
  /** 办公方式（中文标签：现场/混合/远程/全远程）；必填草稿字段，保存时映射为 BFF wire code。
   *  新建意向默认空数组，由 添加意向 页的办公方式行选择写入。*/
  办公方式: string[];
}

/**
 * 意向映射上下文：写入时只需要服务端原始 DTO（编辑已有意向时保留 owner 未表达字段）。
 * Task 6 简化：目录/办公方式 不再从上下文取 —— 目录引用直接落在草稿里（Tasks 3-4），
 * 办公方式 从草稿.办公方式 取（Task 6 新增必填草稿字段）。
 */
export interface 意向映射上下文 {
  原始: BFFOwnerIntention | null;
}

export interface 首次意向输入 {
  职位们: string[];
  城市们: string[];
  薪资: { 下限: number; 上限: number; 单位: 求职薪资单位 };
  筛选偏好: 求职初筛偏好;
  排除项: string[];
  /** Backend 期望职位选择器选中的目录引用们（Task 4 占位字段，Task 6 接入实际填充）*/
  职位引用?: 目录选择值;
  /** Backend 工作城市选择器选中的目录引用们（Task 4 占位字段，Task 6 接入实际填充）*/
  城市引用们?: 目录选择值[];
}

/**
 * P1C Task 5：Job 创建的显式 claim 输入。页面/操作层只声明 direct 直发与
 * 用人企业声明（display_name + legal_name），服务端专有的 refs 与 verification status
 * 一律由后端推导，不进创建 body。更新（补丁）不再接上下文：沿用 previous 的
 * publisher_mode 与 hiring_organization_claim，普通 JD 编辑不改 claim。
 */
export interface 岗位创建上下文 {
  publisherMode: 'direct';
  hiringOrganizationClaim: { display_name: string; legal_name: string | null };
}

export interface 页面意向快照 {
  列表: 求职意向[];
  服务端: Record<string, BFFOwnerIntention>;
}

export interface 页面岗位快照 {
  列表: 在招岗位[];
  服务端: Record<string, BFFOwnerJob>;
}

// ── P2：候选人附件简历库 —— wire 形状原样作为页面别名，Task 3 映射层与 Task 4 数据源消费 ──
export type 页面附件简历库 = BFF附件简历库;

/**
 * P3：隐私页快照 —— wire PrivacyView 去掉 updated_at 后的页面投影。
 * 状态层（Task 3）只认这四项页面自有字段；_revision 走 服务端.revision。
 */
export interface 页面隐私快照 {
  对现雇主隐身: boolean;
  披露偏好: 披露项[];
  屏蔽名单: 屏蔽项[];
  服务端: BFF隐私快照;
}

/** P3：候选人组织搜索查询。q 必填（trim 后 1–200 码点），limit 1–50，cursor ≤4096 字节 */
export interface 组织搜索查询 { q: string; limit?: number; cursor?: string }

export interface 后端会话快照 {
  已登录: boolean;
  主体: BFF主体 | null;
}

// ── P4 发现推荐页面投影（Task 2）：发现推荐映射.ts 把 Discovery* wire DTO 收成这两份
// owner-safe 视图供屏幕直用 —— 不带 Mock 查找键（公司 slug / Mock 编号）；招聘端视图
// 不带 candidate subject、真名、联系方式、性别、出生数据、候选薪资数字。

/**
 * P4 候选岗位卡/详情页视图。发布人 absent → null，绝不拿公司声明合成招聘人；
 * 公开公司路由 ID 只认 公司.organizationId（= wire 的 hiring_organization_ref）。
 */
export interface P4候选岗位页面 {
  recommendationId: string | null;
  intentionId: string | null;
  jobId: string;
  卡: 市场职位;
  职位详情: string[];
  职位要求: string[];
  公司: {
    名称: string; 首字: string; 简介: string;
    organizationId: string | null;
  };
  发布人: {
    姓名: string; 职务: string; 首字: string;
    验证状态: 'unverified' | 'verified';
  } | null;
  委托: BFF委托摘要 | null;
}

/** P4 招聘端候选卡/详情页视图：匿名 allowlist 投影，淘汰原因保留 wire 码（文案经 P4淘汰原因文案 换取） */
export interface P4招聘候选页面 {
  recommendationId: string;
  jobId: string;
  代号: string;
  头像字: string;
  匹配分: number;
  亮点: string[];
  经验: string;
  求职状态: string;
  摘要: string;
  技能: string[];
  教育: { 学校: string; 专业: string; 学历: string; 起止: string }[];
  薪资关系: '薪资带有交集' | '薪资带接近' | '薪资带无交集' | '薪资带未核对';
  收藏: boolean;
  已淘汰: boolean;
  淘汰原因: BFF淘汰原因 | null;
  委托: BFF委托摘要 | null;
}