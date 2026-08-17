// 领域类型：先把原型里的数据结构定死，后端接上来时按这份契约对齐字段。
// 方案里「整理原型 → 补齐路由、状态管理与 API 层」的类型部分就在这里。

/** 谈判四阶段。顺序即推进顺序，配色见 设计令牌.css 的 --初筛/--递简历/--协调/--意向 */
export type 阶段 = '匿名初筛' | '递交简历' | '需要协调' | '意向确认';

export const 阶段顺序: 阶段[] = ['匿名初筛', '递交简历', '需要协调', '意向确认'];

/** 分歧对比轴：双方数值互不披露，只呈现差额 */
export interface 分歧 {
  我方: string;
  差值: string;
  对方: string;
}

/** 在谈职位（求职端视角） */
export interface 在谈单 {
  编号: string;
  公司: string;
  公司首字: string;
  公司简介: string;
  薪资: string;
  职位: string;
  标签: string[];
  阶段: 阶段;
  轮次: string;
  下一步: string;
  辅助文案: string | null;
  /** true = 等你行动：卡片红描边并置顶，详情页出紧急横幅 */
  需要你: boolean;
  分歧: 分歧 | null;
  适配分: number;
  顶部横幅: string | null;
  横幅时长: string | null;
  接受方案?: string;
}

/** 看市场的职位卡 */
export interface 市场职位 {
  编号: string;
  职位: string;
  公司行: string;
  薪资: string;
  适配分: number;
  标签: string[];
  发布人首字: string;
  发布人底色: string;
  发布人字色: string;
  发布人: string;
}

/** 消息列表条目 */
export interface 消息条目 {
  编号: string;
  类型: 'AI代理' | '直聊' | '真人';
  标题: string;
  副标题: string;
  时间: string;
  摘要: string;
  首字?: string;
  底色?: string;
  未读数?: number;
  红点?: boolean;
}

/** 代理间往来记录的一条 */
export type 往来条目 =
  | { 编号: number | string; 类型: '折叠' | '日期' | '系统' | '叮嘱' | '意向'; 内容: string }
  | { 编号: number | string; 类型: '对方' | '我方'; 时间: string; 内容: string };

/** 详情页某个已完成阶段的代理小结 */
export interface 阶段小结 {
  阶段: 阶段;
  状态: '通过' | '达成' | '进行中';
  时间: string;
  小结: string;
  链接?: string | null;
  附件?: { 文件名: string; 说明: string } | null;
}

/** 代理规则（叮嘱沉淀下来的长期约束） */
export interface 规则 {
  编号: string;
  内容: string;
  来源: string;
  生效: boolean;
}

/** 求职意向 */
export interface 求职意向 {
  编号: string;
  标题: string;
  说明: string;
}

/** 与 AI 代理对话的一条 */
export interface 代理对话条 {
  编号: number | string;
  角色: '简报' | '我' | '代理';
  内容?: string;
}

/** 真人 / 直聊会话的一条 */
export type 会话条 =
  | { 编号: number | string; 类型: '系统' | '日期' | '代理提醒'; 内容: string }
  | { 编号: number | string; 角色: '我' | '对方'; 时间?: string; 内容: string };
