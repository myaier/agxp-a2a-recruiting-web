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

/** 查看匹配分析入口（冻结公共合同 C3 / Spec §3.1）：仅指定列表入口传入的可选回调。
 *  给了回调 → 分数环位变成独立可操作按钮（可访问名「查看匹配分析」，键盘 Enter/Space
 *  可达，40px 环补成 44px 触摸区，不嵌套原生按钮），点击只调本回调、不触发卡片导航/
 *  收藏/淘汰/委托/滑动行动作；不传 → 完全没有分析入口，卡面与既有消费逐字不变。
 *  历史卡永不传此回调；弹层的打开与模型查询由页面层负责（page-local 选中记录）。 */
type 可查看匹配分析 = () => void;

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
  查看匹配分析?: 可查看匹配分析;
}

export interface 招聘在谈卡属性 {
  信息: 候选卡信息;
  匹配分: number | null;
  阶段: 在谈阶段信息;
  打开: () => void;
  查看匹配分析?: 可查看匹配分析;
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
  /** true = 整卡不可点进详情（助手查询快照里 job.availability=unavailable 的不可查看项目）。
   *  可选 prop：既有调用方不传 → 默认可点，原行为逐字不变。 */
  禁用?: boolean;
  打开: () => void;
  查看匹配分析?: 可查看匹配分析;
}

/** 求职推荐卡（Plan 合同 D）：看市场 原市场卡 JSX 的共享提取签名，求职端 Backend
 *  推荐列表与助手查询结果共用的同一张原生卡面。纯展示 props：真实/Mock 匹配分由
 *  调用方（看市场 薄包装：Backend = wire 分，Mock = 快照分）算好传入，卡内不算分、不请求。合法 null ≠ 空串 ≠ 0
 *  —— 占位只由显式 null 控制（Mock 页面既有空段渲染不变），非空分含 0 不误判未知。 */
export interface 求职推荐卡属性 {
  公司: string | null;
  公司简介: string | null;
  公司首字: string | null;
  公司图片URL?: string | null;
  职位: string;
  薪资: string;
  标签: readonly string[];
  匹配分: number | null;
  发布人: string | null;
  发布人首字: string | null;
  发布人图片URL?: string | null;
  发布人底色: string;
  发布人字色: string;
  已委托: boolean;
  已委托文字?: string;
  委托禁用: boolean;
  委托: () => void;
  打开: () => void;
  查看匹配分析?: 可查看匹配分析;
  /** 卡内匹配理由（Spec §10.3，仅助手查询结果传入）：不传时完全没有新区域（市场页原样）；
   *  空数组显示「暂无推荐理由」；已匹配=true 为绿色勾加文字，false 为自然语言普通说明。 */
  匹配理由?: readonly { 文案: string; 已匹配: boolean }[];
}
