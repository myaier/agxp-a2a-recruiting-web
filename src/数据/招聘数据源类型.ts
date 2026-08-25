// 页面快照与后端元数据类型：数据源层把 BFF DTO 映射成页面用的领域形状，
// 再把页面写入拆回 BFF 闭合 body。字段重命名 / 默认值 / 协议判断只落在映射层，
// 不散进 React 组件。意向草稿型 从 应用状态.tsx 迁入此处，避免数据层反向 import React Context。
//
// 注：意向草稿型 当前形态与原 应用状态.tsx 中完全一致；Task 4 会再给它加
// 后端招聘类型 / 求职类型已改 两个字段并改归约，本任务不动那两项。

import type { 基本信息, 简历经历段, 简历教育段, 简历证书, 在招岗位, 求职意向 } from './类型';
import type { 求职初筛偏好, 求职薪资单位 } from '../流程/onboarding配置';
import type { BFF简历, BFF主体, BFF目录引用, BFFOwnerIntention, BFFOwnerJob } from './BFF契约';

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

export interface 目录索引 {
  职位类别: BFF目录引用[];
  地点: BFF目录引用[];
  行业: BFF目录引用[];
  院校: BFF目录引用[];
  专业: BFF目录引用[];
}

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
}

export interface 意向映射上下文 {
  原始: BFFOwnerIntention | null;
  办公方式: string[];
  目录: 目录索引;
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

export interface 岗位映射上下文 {
  公司: string;
  目录: 目录索引;
}

export interface 页面意向快照 {
  列表: 求职意向[];
  服务端: Record<string, BFFOwnerIntention>;
}

export interface 页面岗位快照 {
  列表: 在招岗位[];
  服务端: Record<string, BFFOwnerJob>;
}

export interface 后端会话快照 {
  已登录: boolean;
  主体: BFF主体 | null;
}