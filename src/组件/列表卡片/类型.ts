// 三类列表卡片公共展示契约（Plan「公共展示契约」冻结签名；本 Task 只实现招聘推荐卡、
// 候选信息主体与卡片分数，在谈两卡的组件由后续 Task 消费这些类型）。
//
// 展示数据是内存 props，不是 BFF schema，不持久化。卡片不 import Context / fixture /
// HTTP / 路由 / 持久化：不派发、不请求、不计算业务分数 —— ID、范围、分数与操作仍由
// 各页面连接层负责（Plan Global Constraints）。
//
// 类型来源：阶段 — src/数据/类型.ts（type-only import，不把领域层拖进组件运行时）。
import type { 阶段 } from '../../数据/类型';

/** 候选卡头行 + 工作/教育/亮点的展示字段。合法 null ≠ 0 ≠ 隐私未披露（Spec §4.4） */
export interface 候选卡信息 {
  性别: '男' | '女' | null;
  年限: string | null;
  学历: string | null;
  求职状态: string | null;
  工作: string | null;
  教育: string | null;
  亮点: readonly string[];
}

/** 两类在谈卡共用的阶段区展示字段（招聘在谈卡 / 求职在谈卡 的组件在后续 Task） */
export interface 在谈阶段信息 {
  标题: string;
  色系: 阶段;
  待办: boolean;
  徽标: '需要你' | '需注意' | '代理处理中' | null;
  文本: string;
  注意说明: string | null;
}

/** 推荐卡底部操作槽：可委托（含本次提交忙态）或已给权威回执文案 */
export type 推荐操作状态 =
  | { kind: '可委托'; 提交中: boolean }
  | { kind: '回执'; 文案: string };

export interface 招聘推荐卡属性 {
  信息: 候选卡信息;
  匹配分: number | null;
  收藏: boolean;
  收藏禁用: boolean;
  滑开: boolean;
  操作状态: 推荐操作状态;
  打开: () => void;
  切收藏: () => void;
  委托: () => void;
}

export interface 招聘在谈卡属性 {
  信息: 候选卡信息;
  匹配分: number | null;
  阶段: 在谈阶段信息;
  打开: () => void;
}

export interface 求职在谈卡属性 {
  公司: string | null;
  公司简介: string | null;
  公司字标: { 首字: string; 公司名: string } | null;
  /**
   * release/0.2.5 真实公司图位：organization.logo 的 BFF 媒体 URL。可选 prop：
   * 既有 Mock 调用方不传 → 原公司名查静态标分支逐字不变；传 null = 无权威媒体 →
   * 中性空位；传 URL = 真实图，加载失败回既有中性图位，换 URL 清除失败状态。
   */
  公司图片URL?: string | null;
  匹配分: number | null;
  薪资: string;
  职位: string;
  标签: readonly string[];
  阶段: 在谈阶段信息;
  打开: () => void;
}
