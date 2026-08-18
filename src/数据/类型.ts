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
  /** 归属的求职意向；顶栏切意向时列表按此过滤 */
  意向: string;
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
  意向: string;
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

// ══════════════ 企业端（招人方视角）══════════════
// 与求职端同构：候选卡 = 在谈卡的镜像。双盲语义 —— 意向确认前企业只见
// 匿名代号（A-01）与画像，确认后才互换姓名与联系方式。

/** 在谈候选（企业视角）。字段与 在谈单 对齐，方便复用卡片版式 */
export interface 候选 {
  编号: string;
  /** 归属的在招岗位；切岗位时列表按此过滤 */
  岗位编号: string;
  /** 匿名代号，如「候选 A-01」。意向确认前的对外称呼 */
  代号: string;
  /** 画像行：年限 · 技术栈 · 当前公司类型 */
  画像: string;
  /** 意向确认后互换的真名；未确认为 null */
  真名: string | null;
  头像字: string;
  阶段: 阶段;
  轮次: string;
  下一步: string;
  辅助文案: string | null;
  需要你: boolean;
  分歧: 分歧 | null;
  匹配分: number;
  顶部横幅: string | null;
  横幅时长: string | null;
  接受方案?: string;
}

/** 人才漏斗一档（D14 日报 / 首页概览） */
export interface 漏斗档 {
  名称: string;
  人数: number;
  宽度: number;
}

/** 推荐候选（D11 人才 Tab 第二视图） */
export interface 推荐候选 {
  编号: string;
  岗位编号: string;
  代号: string;
  画像: string;
  头像字: string;
  匹配分: number;
  亮点: string[];
  评语: string;
}

/** 代理对候选的四维评估（D11·A 在线简历批注版） */
export interface 评估维度 {
  维度: string;
  分: number;
  批注: string;
}

/** 在招岗位（D17 岗位管理 / 顶栏切换） */
export interface 在招岗位 {
  编号: string;
  名称: string;
  薪资带: string;
  状态: '在招' | '已归档';
  在谈数: number;
}

// ── 「我的」下属功能页的数据类型（通知 / 屏蔽 / 披露 / 归档 / 帮助）──

/** 通知中心一条。目标 = 点开后跳去的路由，null 表示纯告知型通知 */
export interface 通知条 {
  编号: string;
  类型: '需要你' | '进展' | '新机会' | '系统';
  标题: string;
  正文: string;
  时间: string;
  分组: '今天' | '本周' | '更早';
  已读: boolean;
  目标: string | null;
}

/** 屏蔽名单一条。屏蔽是双向的：对方也看不到你（业务约束 6）*/
export interface 屏蔽项 {
  编号: string;
  名称: string;
  首字: string;
  理由: string;
  时间: string;
}

/** 披露档位：代理在什么时机可以把这项信息交出去 */
export type 披露档 = '不披露' | '意向确认后' | '一直允许';

/**
 * 一条披露偏好。锁定 有值时该项被业务机制钉死、不可改，值就是给用户看的原因 ——
 * 双盲机制下薪资数字这一项永远锁在「不披露」，不能靠开关放开。
 */
export interface 披露项 {
  编号: string;
  名称: string;
  说明: string;
  档: 披露档;
  可选档: 披露档[];
  锁定: string | null;
}

/** 归档谈判一条：谈崩 / 退出 / 未通过之后落到这里，可回看全程往来 */
export interface 归档条 {
  编号: string;
  公司: string;
  公司首字: string;
  职位: string;
  止步阶段: string;
  结果: '我方退出' | '对方未通过' | '双方未达成';
  原因: string;
  时间: string;
}

/** 帮助中心一条问答 */
export interface 问答条 {
  编号: string;
  分类: string;
  问: string;
  答: string;
}
