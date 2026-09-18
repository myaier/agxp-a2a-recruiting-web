// 在谈详情共用的局部展示类型（Plan 契约 A）。
//
// 只描述本页实际需要的展示输入：text/null 的语义由每个区块的明确文案决定，
// 不建立通用 reason 枚举；ReactNode 槽只用于组合本页的共享子组件，
// 禁止传入旧 Mock/Backend 整页 JSX 逃避复用。不输出全局业务 DTO。
import type { ComponentProps, ReactNode } from 'react';
// 职位资料信息 / 在线简历正文属性 的对齐行只借用既有类型（契约 B：type import，
// 来源 src/数据/匹配对齐.ts）；在线简历正文内容 不 import Mock 简历档或任何值，
// 也不重建第二种完整简历模型 —— Mock/安全两来源由 数据/在线简历正文映射 归一成本模型。
import type { 对齐行 } from '../../数据/匹配对齐';
import type { 匹配依据行 } from '../../数据/招聘匹配依据映射';
import type { 匹配分析模型 } from '../../数据/匹配解释展示映射';
// 确认属性（契约 C）只是既有 确认层 组件 props 的类型别名 —— 只 type import 组件
// 本体，展示与控制两侧都不因此产生第二种确认层实现。
import type 确认层 from '../确认层';

export type 详情Tab = '进度' | '资料';

export interface 顶栏信息 {
  端: '求职' | '招聘';
  标题: string | null;
  副标题: string | null;
  画像: { 性别: '男' | '女' | null; 年限: string | null; 学历: string | null; 求职状态: string | null } | null;
  右侧: { kind: '分数'; 值: number | null } | { kind: '薪资'; 值: string | null };
  岗位上下文: string | null;
}

export interface 详情外壳属性 {
  信息: 顶栏信息;
  返回: () => void;
  当前Tab: 详情Tab;
  切Tab: (tab: 详情Tab) => void;
  进度: ReactNode;
  资料: ReactNode;
  底栏: ReactNode;
  弹层?: ReactNode;
}

export interface 状态区信息 {
  阶段: string; 状态: string; 步骤: string | null;
  轮次: { 当前: number; 预算: number } | null;
  徽标: '需要你' | '需注意' | '代理处理中' | null;
  注意说明: string | null;
}

export interface 详情按钮 {
  键: string; 文案: string; 外观: '主要' | '次要' | '危险';
  禁用说明: string | null;
  执行: (() => void) | null;
}

/**
 * 卡内文本输入位（S0/S1 的「给我的 AI 一句说明（选填）」、S2 的公开回答）：控制层持草稿，
 * 展示层只摆放。说明 是这条输入的可见口径（例如「只发给你自己的 AI，对方看不到」）。
 */
export interface 详情输入位 {
  键: string; 标签: string; 占位: string; 值: string; 多行: boolean;
  说明: string | null; 禁用说明: string | null;
  改变: (值: string) => void;
}

/** 卡内勾选位（S2 的「暂时无法回答」）：勾上即改成 status=unknown，不是同意。 */
export interface 详情勾选位 {
  键: string; 标签: string; 选中: boolean; 说明: string | null;
  切换: (选中: boolean) => void;
}

export interface 详情动作卡信息 {
  键: string; 标题: string; 说明: string | null;
  /** 卡上的只读补充行（如待办截止时刻、状态变化提示）：纯文本，控制层给定。 */
  提示们?: readonly string[];
  输入们?: readonly 详情输入位[];
  勾选们?: readonly 详情勾选位[];
  正文?: ReactNode; 按钮们: readonly 详情按钮[];
}

/** 确认属性（契约 C）：不可逆动作二次确认的展示合同 —— 类型即既有 确认层 的 props
 *  （组件来源 src/组件/确认层.tsx），控制 hook 组装，确认层只接收已有 props。 */
export type 确认属性 = ComponentProps<typeof 确认层>;

/** 简历选择属性（契约 C）：S1 递交单选的展示合同。展示不持 BFF 文件 —— 只认控制层发的
 *  键；控制层维护 键→原 {file_id,file_version_id,displayName} 选择的映射（用既有
 *  从附件行取选择值），不得以文件名作身份。Task 5 只声明合同（值恒 null），Task 6 交付。 */
export interface 简历选择属性 {
  职位名: string;
  文件们: readonly { 键: string; 文件名: string; 状态文: string; 禁用说明: string | null }[];
  选中键: string | null;
  选择: (key: string) => void;
  取消: () => void;
  确认: 详情按钮;
}

export type 详情底栏信息 =
  | { kind: '输入'; 占位: string; 值: string; 改变: (value: string) => void; 发送: (() => void) | null; 禁用说明: string | null }
  | { kind: '只读'; 说明: string };

export interface 终局区信息 {
  摘要: { 结束语: string; 原因: string; 定格于: string } | null;
  移交: { 说明: string; 开始私聊: 详情按钮 } | null;
}

/** 第二 Tab（资料）自己的输入（契约 B）：只为本页当前字段服务，不输出全局业务 DTO。
 *  null = 数据源未提供（缺失）；空数组 = 提供了但一条没有（「暂无…」）。 */
export interface 职位资料信息 {
  摘要: { 职位: string; 城市: string; 薪资: string; 技能: readonly string[] | null } | null;
  /**
   * Task 6（Spec §3.4）：匹配分析区唯一输入 = C3 展示模型（分数/解释/有限依据/上下文），
   * 由各详情入口从同一响应的 match_score + match_explanation 构建 —— 组件不再消费旧
   * 「JD 三态核对行」版式（求职核对块 已随 Task 6 删除）。解释合法缺失（null）由
   * 匹配分析块 显示「暂无该次匹配的详细分析」+ 有限依据，绝不补六条假状态。
   */
  分析: 匹配分析模型;
  职位详情: readonly string[] | null;
  职位要求: readonly string[] | null;
  公司: {
    名称: string | null; 字标: string | null; 简介: string | null;
    元行: readonly { 标签: '融资阶段' | '规模' | '行业' | '成立' | '地址'; 值: string | null }[];
    标签: readonly string[] | null;
    /** Task 6：真实组织编号 —— 公司导航唯一坐标（有值才允许入口启用，绝不从公司名推 ID）。
     *  缺省（undefined）= 既有调用方未提供该输入（Mock 沿用调用方自给的坐标）。 */
    编号?: string | null;
    /** Task 6：真实 Logo 媒体（Task 4 图位模式）：null = 无媒体（既有中性空位）；
     *  缺省（undefined）= 既有调用方行为不变。 */
    图片URL?: string | null;
  };
  对接人: { 姓名: string | null; 职务: string | null; 字标: string | null;
    /** Task 6：发布人真实头像媒体；缺省（undefined）= 既有调用方行为不变。 */
    头像URL?: string | null };
  接口缺口说明: string | null;
}

/**
 * 在线简历正文（S0–S3 展示统一 Task 6，Spec §7.1）：唯一正文模型。两种来源
 * （Mock 简历档 / Backend 安全展示资料）先经 数据/在线简历正文映射 归一成本模型，
 * 再进正文 JSX —— 正文不再通过「传了档/传了资料」识别数据源。
 * 区级 null = 数据源未提供（缺失），[] = 提供了但一条没有，二者不互换。
 */
/** 头区内容：性别/年限/学历/求职状态 + 最近工作组合职位行（安全来源取 resume.summary） */
export interface 在线简历头区内容 {
  性别: '男' | '女' | null;
  年限: string | null;
  学历: string | null;
  求职状态: string | null;
  职位行: string | null;
}

/** 期望槽：薪资结论是显示文案（安全来源=薪资关系文案，unknown → null 不出）；
 *  一致性条只有 Mock 演示事实有，安全来源无证据恒 null */
export interface 在线简历期望内容 {
  标题: string | null;
  薪资结论: string | null;
  带宽行: string | null;
  偏好: string | null;
  一致性: string | null;
}

/** 工作段：公司是已授权显示的公司名（Mock 的真名→实名恢复在适配层执行完毕，
 *  安全来源被遮蔽时即「未披露」）—— renderer 不做实名决定 */
export interface 在线简历经历段内容 {
  公司: string | null;
  起止: string | null;
  职位: string | null;
  说明: string | null;
  批注: string | null;
}

/** 项目段：安全来源无独立日期，起止恒 null（不借所属工作的起止充数） */
export interface 在线简历项目段内容 {
  名称: string | null;
  起止: string | null;
  角色: string | null;
  说明: string | null;
  批注: string | null;
}

/** 正文内容；null = 整份缺源档（各区原位显示缺失） */
export interface 在线简历正文内容 {
  头区: 在线简历头区内容 | null;
  /** 匹配对齐卡的分数槽：只有 Mock 档有；安全来源无分数证据，不画卡只按布局出缺失 */
  适配分: number | null;
  自述: string | null;
  期望: 在线简历期望内容 | null;
  经历: 在线简历经历段内容[] | null;
  项目: 在线简历项目段内容[] | null;
  教育: { 行: string; 起止: string | null }[] | null;
  技能: string[] | null;
  /** 页尾说明的 Mock 演示事实槽（S1 原件披露说明 / 双向核验声明）：由 Mock 适配层依据
   *  演示事实提供（Spec §7.3）；安全适配恒不填 —— Backend 没有核验/披露证据，
   *  正文回退到「由候选人的AI代理生成 · 内容不可转发」，绝不由展示组件按模式推断授权。 */
  页尾说明?: string | null;
}

/** 在线简历正文属性：唯一正文输入（替换旧 档/资料 双源 props）。来源归连接器决定，
 *  Mock 真名/薪资结论等适配参数不进 Backend 链路。 */
export interface 在线简历正文属性 {
  /** 归一后的正文内容（数据/在线简历正文映射 的产出）；null = 整份缺源档 */
  内容: 在线简历正文内容 | null;
  /** 匹配对齐行(岗位硬性条件 × 简历证据);调用方按所属岗位算好传入,null = 不渲染该区 */
  对齐行们?: 对齐行[] | null;
  /**
   * Task 5 匹配依据行们：推荐详情的有限匹配展示（契约 C 六行，由 数据/招聘匹配依据映射
   * 从 wire 三键算好传入）。传入即启用唯一「匹配度分析」六行版式（标题唯一、无独立
   * 「推荐依据」区、无重复空分析区、正文无第二分数环）；undefined = 消费者不启用
   * （Case 正文 / 旧消费者保持对齐卡或「匹配分析缺失」原展示，不随本任务改变）。
   *  注意（Task 5 起）：include=match_explanation 已展开的推荐详情不再走本 prop，
   *  改传 匹配分析（六维解释模型）—— 两者互斥，同时传入时 匹配分析 优先。
   */
  匹配依据行们?: readonly 匹配依据行[];
  /**
   * Task 5（Spec §3.3）：已展开批次解释的六维分析模型（由调用方从同记录 wire 事实算好
   * 传入）。在场时分析区 = 匹配分析块（藏环：总分唯一在顶栏），替换有限六行依据版式，
   * 不再显示「当前接口仅提供部分匹配依据」；解释合法缺失（模型.解释 = null）由组件显示
   * 「暂无该次匹配的详细分析」+ 有限依据。
   */
  匹配分析?: 匹配分析模型;
  /** 双方意向确认完成事实（Backend = lifecycle completed；Mock = 既有双方状态），
   *  只用于意向确认页尾文案，不兼任身份披露权限（Spec §7.3，不能 stage===S3） */
  已确认?: boolean;
  /** 详情第二 Tab 的完整缺失布局：缺失/空区保留标题与空状态；默认 false = 独立页旧版式 */
  完整布局?: boolean;
  /** 完整布局顶部的区块级缺口说明（如「当前在谈详情数据未提供」）；默认不渲染 */
  缺失说明?: string | null;
}

/** Backend 共享在线简历的展示资料（Task 5）：按 在线简历正文 的原信息槽组织，由
 *  数据/在线简历展示映射 从 BFF候选在线简历（可 null）纯投影而来。语义逐槽冻结：
 *  顶层各槽 null = 数据源未提供（缺失），数组 [] = 提供了但一条没有，二者不互换；
 *  工作起止 / 教育起止是显示文案（有开始时间才给「至今」，起始缺失给「日期未知」）；
 *  项目无独立日期，不借所属工作的起止充数。不承载 identity / 候选薪资 / 公司实名
 *  恢复字段。 */
export interface 在线简历展示资料 {
  /** 头部画像 + 最近工作组合职位行；null = 摘要缺失（头区原位显示缺失） */
  画像: {
    性别: '男' | '女' | null;
    年限: string | null;
    学历: string | null;
    求职状态: string | null;
    职位行: string | null;
  } | null;
  /** self_description；null = 缺失 */
  个人优势: string | null;
  /** 求职期望原槽：标题（招聘类型 · 职位方向）、薪资关系文案（unknown 不作结论 → null）、
   *  副行（地点 · 办公方式）；整段无证据收口为 null */
  期望: { 标题: string | null; 薪资关系: string | null; 副行: string | null } | null;
  /** 工作经历：公司为空给中性「未披露」，不借行业伪装；industry 无原槽不带出 */
  工作: { 公司: string; 起止: string; 职位: string | null; 说明: string | null }[] | null;
  /** 项目按所属工作顺序平铺（name/role/result 原位） */
  项目: { 名称: string; 角色: string | null; 结果: string | null }[] | null;
  /** 教育从旧单条适配为多条，保持源序 */
  教育: { 行: string; 起止: string }[] | null;
  /** skills；null = 整区未知，[] = 无条目 */
  技能: string[] | null;
}
