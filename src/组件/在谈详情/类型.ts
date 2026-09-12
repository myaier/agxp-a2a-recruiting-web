// 在谈详情共用的局部展示类型（Plan 契约 A）。
//
// 只描述本页实际需要的展示输入：text/null 的语义由每个区块的明确文案决定，
// 不建立通用 reason 枚举；ReactNode 槽只用于组合本页的共享子组件，
// 禁止传入旧 Mock/Backend 整页 JSX 逃避复用。不输出全局业务 DTO。
import type { ComponentProps, ReactNode } from 'react';
// 职位资料信息 的对齐行只借用既有类型（契约 B：type import，来源 src/数据/匹配对齐.ts）；
// 在线简历正文属性 的 档 同样只 type import（来源 src/数据/企业端模拟数据.ts，
// 不导入 Mock 简历表或任何值，也不重建第二种完整简历模型）
import type { 对齐行 } from '../../数据/匹配对齐';
import type { 匿名简历档 } from '../../数据/企业端模拟数据';
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

export interface 详情动作卡信息 {
  键: string; 标题: string; 说明: string | null;
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
  摘要: { 职位: string; 城市: string; 薪资: string; 技能: readonly string[] } | null;
  分析: { 分: number | null; 行们: 对齐行[] | null; 文案: { 墨句: string; 灰句: string } | null };
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

/** 在线简历正文（契约 B）：现有 屏幕/匿名在线简历 `简历正文` 的 props 抽成具名 ——
 *  字段名与非空分支类型原样保留，只有 `档` 扩为 `匿名简历档 | null`；新增的
 *  完整布局 / 缺失说明 只由详情调用显式传，独立匿名简历页不传（保持原行为）。 */
export interface 在线简历正文属性 {
  /** 匿名简历档；null = 数据源未提供结构化在线简历（各信息区在同一组 JSX 里显示缺失） */
  档: 匿名简历档 | null;
  /** Backend 共享正文的展示资料（数据/在线简历展示映射 的产出）。不传（undefined）=
   *  走既有 Mock 档；显式传（含 null = 整份缺源档）时正文只吃资料、档 保持 null。
   *  不承载 identity / 候选薪资 / 公司实名恢复字段 —— 真名恢复永远不走这条路。 */
  资料?: 在线简历展示资料 | null;
  /** 匹配对齐行(岗位硬性条件 × 简历证据);调用方按所属岗位算好传入,null = 不渲染该区 */
  对齐行们?: 对齐行[] | null;
  /** 候选人真名（S1 原件递交后非空）。非空时按 spec §3.2 还原公司实名（头区不显示真名，
   *  2026-09-09 第二批去名）；为空仍走匿名版 */
  真名?: string | null;
  /** 头行第三段的求职状态（如「在职看机会」）：简历档本身没有这个字段，由调用方按在谈单 在找
   *  后半段 / 推荐候选 求职状态 算好传入；不传就只出 年限｜学历 */
  求职状态?: string | null;
  /** 双方意向确认（S3）完成事实，只用于意向确认文案，不兼任身份披露权限（spec §3.2） */
  已确认?: boolean;
  薪资结论?: string;
  /** 详情第二 Tab 的完整缺失布局：缺失/空区保留标题与空状态；默认 false = 旧版式 */
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
