// 后端操作组合的纯类型文件（无 React 依赖、无运行时副作用）。
// Provider 把稳定 ref 与 React setter 组成 后端操作依赖 传给各域操作工厂，工厂返回操作方法；
// 根 应用操作 是各域操作子接口的交集（会话/候选/岗位/组织 + P3 隐私 + P6 Agent 规则 + P4 发现推荐），
// 公开 shape 与拆分前逐字一致。
//
// 对根 状态 / 动作 只使用 type-only import，运行时依赖方向保持「根组合 → 域实现」，
// 不建立互相调用的域模块。

import type {
  BFF主体,
  BFF简历,
  BFFOwnerIntention,
  BFFOwnerJob,
  BFF招聘方档案,
  BFF招聘方档案补丁,
  BFF企业管理员申请元数据,
  BFF企业媒体用途,
  BFF隐私快照,
  BFF组织搜索页,
  BFF角色,
  BFFAgent规则,
  BFFAgent规则提案,
  BFFAgent规则作用域,
  BFFCandidateJob,
  BFF淘汰原因,
  BFF委托回执,
  BFF候选岗位推荐,
  BFF招聘候选推荐,
  BFF附件简历库,
} from '../../数据/BFF契约';
import type { 页面简历写入, 意向草稿型, 首次意向输入, 组织搜索查询 } from '../../数据/招聘数据源类型';
import type { P5角色, P5历史生命周期 } from '../../数据/BFF契约';
import type { P5列表项, P5详情 } from '../../数据/招聘数据源/MatchCase';
import type { P7角色, P7会话项, P7消息 } from '../../数据/招聘数据源/真人会话';
import type {
  P8Credential,
  P8Session,
  P8DataExport,
  P8ReplacementAttempt,
  P8ReplacementResult,
} from '../../数据/招聘数据源/P8控制面';
import type { P8导出恢复存储 } from '../../数据/P8导出恢复';
import type { PDF对象租约 } from '../../数据/PDF对象租约';
import type { 在招岗位, 披露档, 屏蔽来源, 屏蔽项 } from '../../数据/类型';
import type { 资料形 } from '../../数据/公司主页资料';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import type { 动作, 状态 } from '../应用状态';

export interface 后端状态 extends P4发现状态, P5MatchCase状态, P7会话状态, P8控制面状态 {
  初始化: '跳过' | '进行中' | '完成';
  已登录: boolean;
  主体: BFF主体 | null;
  简历快照: BFF简历 | null;
  意向快照: Record<string, BFFOwnerIntention>;
  岗位快照: Record<string, BFFOwnerJob>;
  /** P3：隐私视图投影（PrivacySnapshot 四字段，无 updated_at）；未登录 / 已清理时为 null。 */
  隐私快照: BFF隐私快照 | null;
  // ── P6：Agent 规则域的 raw owner snapshot 与水合阶段 ──
  /** 双端规则字典按 role 隔离：refresh 只替换对应角色的键，不清另一端的已隔离快照。 */
  候选规则快照: Record<string, BFFAgent规则>;
  招聘规则快照: Record<string, BFFAgent规则>;
  /** actionable 提案（interpreting + ready 合并）按 proposal_id 索引。 */
  候选规则提案: Record<string, BFFAgent规则提案>;
  招聘规则提案: Record<string, BFFAgent规则提案>;
  /**
   * 每个 P6 子域独立维护 未开始|进行中|成功|失败：
   * 进行中 只允许从 未开始|失败 推进，已 成功 的域在刷新期间不得降级（设计 §6）。
   */
  Agent规则水合: Record<BFF角色, Agent规则角色水合状态>;
  // ── P2：候选人附件简历库的权威快照（0–3 行 + limits）；未登录 / 已清理时为 null。 ──
  附件简历库: BFF附件简历库 | null;
}

/** P6 单个水合子域的生命周期阶段。 */
export type Agent规则水合阶段 = '未开始' | '进行中' | '成功' | '失败';

export interface Agent规则角色水合状态 {
  rules: Agent规则水合阶段;
  proposals: Agent规则水合阶段;
}

// ── P4：发现推荐域的 raw scope 快照（仅 Backend；Mock 发现页继续走 归约发现推荐，不触达这里）──

/** P4 scope 快照的生命周期阶段；已 成功 的快照在刷新途中保持 成功，不降级成空白。 */
export type P4加载阶段 = '未开始' | '进行中' | '成功' | '失败';

export interface P4ScopeSnapshot<T> {
  阶段: P4加载阶段;
  刷新中: boolean;
  items: T[];
  error: string | null;
  generation: number;
}

export interface P4发现状态 {
  候选岗位推荐: Record<string, P4ScopeSnapshot<BFF候选岗位推荐>>;
  候选岗位详情: Record<string, BFFCandidateJob>;
  候选岗位不可用: string[];
  招聘可用候选: Record<string, P4ScopeSnapshot<BFF招聘候选推荐>>;
  招聘已筛候选: Record<string, P4ScopeSnapshot<BFF招聘候选推荐>>;
  招聘已筛聚合: { 阶段: P4加载阶段; jobKey: string; error: string | null };
  招聘候选详情: Record<string, BFF招聘候选推荐>;
  招聘候选不可用: string[];
  P4委托回执: Record<string, BFF委托回执>;
  P4真实Case引用: Record<string, string>;
}

export type 更新后端状态 = (更新: (旧: 后端状态) => 后端状态) => void;

// ── P7：真人会话域的内存态 scope 快照（仅 Backend；快照绝不进 资料持久化 / 浏览器存储）──

/** P7 scope 快照的生命周期阶段；已 成功 的快照在刷新途中保持 成功（旧 items/detail 不降级）。 */
export type P7加载阶段 = '未开始' | '进行中' | '成功' | '失败';

/**
 * 收件箱 / 消息页共用 的分页快照：收件箱 key 是角色、消息页 key 是
 * P7范围键.消息(role, conversationId)。已加载页数 是「已载窗口」深度：
 * 刷新从第一页重建同样深度的窗口，收件箱 append / 更早消息 prepend 逐页 +1。
 */
export interface P7分页快照<T> {
  阶段: P7加载阶段;
  刷新中: boolean;
  items: T[];
  nextCursor: string | null;
  已加载页数: number;
  error: string | null;
  generation: number;
}

/** 会话详情快照：key 是 P7范围键.详情(role, conversationId)；detail 只来自权威 GET。 */
export interface P7详情快照 {
  阶段: P7加载阶段;
  刷新中: boolean;
  detail: P7会话项 | null;
  error: string | null;
  generation: number;
}

export interface P7会话状态 {
  P7收件箱: Record<P7角色, P7分页快照<P7会话项>>;
  P7会话详情: Record<string, P7详情快照>;
  P7消息页: Record<string, P7分页快照<P7消息>>;
}

/**
 * 发送结果：confirmed = 权威证据已确认；unknown 携带不可变待定正文，
 * outcome_unknown 在重拉成功时可放弃、重拉失败只允许同键重试，
 * in_progress 表示同一 effect 仍在执行、不可放弃。
 */
export type P7发送结果 =
  | { status: 'confirmed' }
  | {
      status: 'unknown';
      reason: 'outcome_unknown' | 'in_progress';
      canAbandon: boolean;
      pendingContent: string;
    };

/** 每个待定发送意图：Idempotency-Key、不可变 trim 后正文与发送前水位。
 *  watermark 缺席（undefined）＝快照不在场/未成功，无权威水位 —— 对账不得据此确认；
 *  null ＝权威空水位（成功快照里没有任何 user_text）。 */
export interface P7待定意图 {
  key: string;
  content: string;
  watermark?: string | null;
}

/** 每会话的已读位置：上次成功 / 在飞 / 已被终局拒绝（role_*）的 decimal target。 */
export interface P7已读位置记录 {
  lastSuccessful: string | null;
  inFlight: string | null;
  terminalRejected: string | null;
}

// ── P5：MatchCase 域的内存态 scope 快照（仅 Backend；快照绝不进 资料持久化 / 浏览器存储）──

/** P5 scope 快照的生命周期阶段；已 成功 的快照在刷新途中保持 成功（旧 items/detail 不降级）。 */
export type P5加载阶段 = '未开始' | '进行中' | '成功' | '失败';

/**
 * 工作区 / 历史架子的列表快照：key 是 P5范围键.open / .history（role + 角色专属过滤）。
 * 已加载页数 是「已载窗口」的深度：刷新从第一页重建同样深度的窗口，追加逐页 +1。
 */
export interface P5列表快照 {
  阶段: P5加载阶段;
  刷新中: boolean;
  items: P5列表项[];
  nextCursor: string | null;
  已加载页数: number;
  error: string | null;
  generation: number;
}

/** 详情快照：key 是 P5范围键.detail(role, caseId)；detail 只来自权威 GET，mutation 响应绝不写入。 */
export interface P5详情快照 {
  阶段: P5加载阶段;
  刷新中: boolean;
  detail: P5详情 | null;
  error: string | null;
  generation: number;
}

export interface P5MatchCase状态 {
  P5工作区: Record<string, P5列表快照>;
  P5历史: Record<string, P5列表快照>;
  P5详情: Record<string, P5详情快照>;
}

// ── P8：控制面域的内存态资源快照（仅 Backend；快照绝不进 资料持久化 / 浏览器存储）──

/** P8 资源快照的生命周期；已 success 的快照在刷新途中保持 success（旧 data 不降级）。 */
export type P8阶段 = 'idle' | 'loading' | 'success' | 'error';

export interface P8资源快照<T> {
  phase: P8阶段;
  refreshing: boolean;
  data: T | null;
  error: string | null;
  generation: number;
}

/**
 * P8 控制面三块资源快照：credentials / sessions / dataExport。账号资源以
 * subject_id + 会话代际为隔离边界（不按 candidate/recruiter 重复保存）：
 * 同一主体切角色可以复用已确认快照；登出 / 401 / 换主体整域摊平。
 */
export interface P8控制面状态 {
  credentials: P8资源快照<P8Credential[]>;
  sessions: P8资源快照<P8Session[]>;
  dataExport: P8资源快照<P8DataExport>;
}

/** 每个 P8 待定意图：Idempotency-Key + 不可变请求（坐标只作内存 Map 键，绝不进请求参数）。 */
export interface P8待定意图<T> {
  key: string;
  request: T;
}

export type 可变引用<T> = { current: T };

export interface 后端操作依赖 {
  是后端: boolean;
  后端: HTTP招聘数据源 | null;
  派发: (动作: 动作) => void;
  设后端状态: 更新后端状态;
  后端状态引用: 可变引用<后端状态>;
  状态引用: 可变引用<状态>;
  锁: 可变引用<Set<string>>;
  尝试引用: 可变引用<string | null>;
  主体标识引用: 可变引用<string | null>;
  会话代际: 可变引用<number>;
  /**
   * P1C：读取 subject-scoped sessionStorage 里恢复的 current relation 候选值。
   * 只作为 选择当前企业关系(affiliations, restoredId) 的输入；读取本身不派发选择 action。
   */
  读取恢复企业关系编号: (subjectId: string) => string | null;
  /**
   * P4 Task 3：discovery 运行时引用 —— scope 代际 / pending 幂等意图 / 双端可见范围。
   * Provider 恒一次性初始化并传入；可选成员只为既有 测试依赖桩 与 清账号状态 子集调用方的
   * 编译兼容，发现推荐操作 在工厂入口显式收窄，缺引用即接线缺陷。
   */
  P4范围代际?: 可变引用<Map<string, number>>;
  P4幂等意图?: 可变引用<Map<string, string>>;
  P4可见范围?: 可变引用<Record<BFF角色, string | null>>;
  /**
   * P5 Task 3：MatchCase 运行时引用 —— scope 代际 / pending 幂等意图 / 双端可见范围 /
   * 在途 PDF 对象租约。与 P4 同一纪律：Provider 恒一次性注入；可选成员只为既有
   * 测试依赖桩 的编译兼容，MatchCase操作 在工厂入口显式收窄。
   */
  P5范围代际?: 可变引用<Map<string, number>>;
  P5幂等意图?: 可变引用<Map<string, string>>;
  P5可见范围?: 可变引用<Record<P5角色, string | null>>;
  P5对象租约?: 可变引用<Set<PDF对象租约>>;
  /**
   * P7 Task 2：真人会话运行时引用 —— scope 代际 / 待定发送意图 / 双端可见范围 /
   * 已读位置。与 P4/P5 同一纪律：Provider 恒一次性注入；可选成员只为既有
   * 测试依赖桩 的编译兼容，真人会话操作 在工厂入口显式收窄。
   */
  P7范围代际?: 可变引用<Map<string, number>>;
  P7待定意图?: 可变引用<Map<string, P7待定意图>>;
  P7可见收件箱?: 可变引用<Record<P7角色, boolean>>;
  P7可见会话?: 可变引用<Record<P7角色, string | null>>;
  P7已读位置?: 可变引用<Map<string, P7已读位置记录>>;
  /**
   * P8 Task 3：控制面运行时引用 —— 范围代际 / 账号可见 / 读锁 / 待定意图 /
   * 导出恢复。与 P4–P7 同一纪律：Provider 恒一次性注入；可选成员只为既有
   * 测试依赖桩 的编译兼容，P8控制面操作 在工厂入口显式收窄。
   */
  P8范围代际?: 可变引用<number>;
  P8账号可见?: 可变引用<boolean>;
  P8读取锁?: 可变引用<Map<'credentials' | 'sessions' | 'export', Promise<void>>>;
  P8待定意图?: 可变引用<Map<string, P8待定意图<unknown>>>;
  P8导出恢复?: 可变引用<P8导出恢复存储 | null>;
}

/** P7 真人会话的五个运行时引用（Provider 一次性初始化；域内按必选语义收窄）。 */
export interface P7运行时引用 {
  P7范围代际: 可变引用<Map<string, number>>;
  P7待定意图: 可变引用<Map<string, P7待定意图>>;
  P7可见收件箱: 可变引用<Record<P7角色, boolean>>;
  P7可见会话: 可变引用<Record<P7角色, string | null>>;
  P7已读位置: 可变引用<Map<string, P7已读位置记录>>;
}

/** P5 MatchCase 的四个运行时引用（Provider 一次性初始化；域内按必选语义收窄）。 */
export interface P5运行时引用 {
  P5范围代际: 可变引用<Map<string, number>>;
  P5幂等意图: 可变引用<Map<string, string>>;
  P5可见范围: 可变引用<Record<P5角色, string | null>>;
  P5对象租约: 可变引用<Set<PDF对象租约>>;
}

/** P8 控制面的五个运行时引用（Provider 一次性初始化；域内按必选语义收窄）。 */
export interface P8运行时引用 {
  /** P8 范围代际：唯一的域级栅栏计数，force 刷新与引用级清理递增。 */
  P8范围代际: 可变引用<number>;
  /** 账号 UI 是否可见：只影响迟到提示的抑制，绝不参与快照提交栅栏。 */
  P8账号可见: 可变引用<boolean>;
  /** 每资源一把单飞读锁（export 资源 Task 5 接线，锁表先收录）。 */
  P8读取锁: 可变引用<Map<'credentials' | 'sessions' | 'export', Promise<void>>>;
  P8待定意图: 可变引用<Map<string, P8待定意图<unknown>>>;
  /** 按 subject 隔离的导出恢复坐标；Provider 先置 null，Task 5 供给 subject 绑定适配器。 */
  P8导出恢复: 可变引用<P8导出恢复存储 | null>;
}

/** P4 discovery 的三个运行时引用（Provider 一次性初始化；域内按必选语义收窄）。 */
export interface P4运行时引用 {
  P4范围代际: 可变引用<Map<string, number>>;
  P4幂等意图: 可变引用<Map<string, string>>;
  P4可见范围: 可变引用<Record<BFF角色, string | null>>;
}

export interface 会话操作 {
  开始手机登录(phone: string): Promise<void>;
  完成手机登录(code: string): Promise<void>;
  微信登录(): Promise<string | null>;
  退出登录(): Promise<void>;
  切身份(to: '求职者' | '招聘方'): Promise<void>;
}

export interface 候选操作 {
  保存简历(next: 页面简历写入): Promise<void>;
  保存个人优势(text: string): Promise<void>;
  保存意向(draft: 意向草稿型): Promise<void>;
  保存首次意向(input: 首次意向输入): Promise<void>;
  删除意向(id: string): Promise<void>;
}

export interface 岗位操作 {
  发布岗位(job: 在招岗位): Promise<void>;
  更新岗位(job: 在招岗位): Promise<void>;
  归档岗位(id: string): Promise<void>;
  重开岗位(id: string): Promise<void>;
  删除岗位(id: string): Promise<void>;
}

/** P1C Task 2：页面会调用的组织操作方法表（页面不得直接调用数据源）。 */
export interface 组织操作 {
  选择企业关系(id: string | null): Promise<void>;
  保存未认证公司声明(company: string): void;
  /** 返回保存后的权威档案：同一次保存里紧跟的 CAS 写入（头像）必须用响应里的新 revision。 */
  保存招聘方档案(patch: BFF招聘方档案补丁): Promise<BFF招聘方档案>;
  读取企业管理员申请(): Promise<void>;
  创建企业管理员申请(metadata: BFF企业管理员申请元数据, evidence: File[]): Promise<void>;
  取消企业管理员申请(id: string): Promise<void>;
  接受企业邀请(token: string): Promise<void>;
  /** revision 缺省读 state ref；紧跟 保存招聘方档案 的调用必须显式传响应 revision
   *  （dispatch 后 ref 要到下一个 React 提交才更新，读 ref 会拿旧值被 BFF 409）。 */
  替换招聘方头像(file: File, revision?: number): Promise<void>;
  保存企业档案(draft: 资料形): Promise<void>;
  上传并发布企业媒体(purpose: BFF企业媒体用途, file: File): Promise<void>;
  移除企业媒体(purpose: BFF企业媒体用途, mediaId: string): Promise<void>;
  读取公开企业(id: string): Promise<void>;
}

/**
 * P3 Task 2：页面会调用的隐私操作方法表（页面不得直接调用数据源）。
 * 五个方法都没有乐观写：服务端成功（或一次 GET 确认达成）先于任何本地提交；
 * 冲突/风控按 BFF code 分派「重读权威视图 + 原样抛出」，绝不重放变更。
 */
export interface 隐私操作 {
  设置雇主隐私(enabled: boolean): Promise<void>;
  设置披露偏好(id: 'D-03' | 'D-04' | 'D-05', 档: 披露档): Promise<void>;
  搜索可屏蔽组织(query: 组织搜索查询): Promise<BFF组织搜索页>;
  添加组织屏蔽(organizationId: string, source: 屏蔽来源): Promise<void>;
  /** 解除带完整 屏蔽项：组织编号来自 item.组织编号，risk_acknowledged 由 来源 推导。 */
  解除组织屏蔽(item: 屏蔽项): Promise<void>;
}

/**
 * P5：候选委托的精确输入 —— 屏层带用户选中的附件简历坐标（file + version）进来，
 * 操作层原样透传到 BFF，绝不代选文件；单飞/幂等坐标仍是 intention-job，与简历坐标解耦。
 */
export interface 候选P4委托输入 {
  intentionId: string;
  recommendationId: string;
  jobId: string;
  resumeFileId: string;
  resumeFileVersionId: string;
  disclosureAcknowledged: true;
}

/**
 * P4 Task 3/4/5：页面会调用的发现推荐操作方法表（页面不得直接调用数据源）。
 * Task 4 落 refresh/feedback mutation、Task 5 落委托（真实回执）与轮询的操作层半边；
 * 本表即完整闭合面（watch、委托列表 GET、top 选择不存在）。
 */
export interface 发现推荐操作 {
  设置发现推荐范围(role: BFF角色, scopeKey: string | null): void;
  加载候选岗位(intentionId: string, force?: boolean): Promise<void>;
  读取候选岗位详情(jobId: string, force?: boolean): Promise<void>;
  加载招聘候选(jobId: string, force?: boolean): Promise<void>;
  加载招聘已筛(jobIds: string[], force?: boolean): Promise<void>;
  读取招聘候选详情(jobId: string, recommendationId: string, force?: boolean): Promise<void>;
  刷新候选岗位(intentionId: string): Promise<void>;
  标记岗位不感兴趣(intentionId: string, recommendationId: string): Promise<void>;
  刷新招聘候选(jobId: string): Promise<void>;
  设置候选收藏(jobId: string, recommendationId: string, favorite: boolean): Promise<void>;
  淘汰候选(jobId: string, recommendationId: string, reason: BFF淘汰原因): Promise<void>;
  撤销淘汰候选(jobId: string, recommendationId: string): Promise<void>;
  委托候选岗位(input: 候选P4委托输入): Promise<BFF委托回执>;
  委托招聘候选(jobId: string, recommendationId: string): Promise<BFF委托回执>;
  刷新委托(role: BFF角色, delegationId: string): Promise<void>;
}

export interface Agent规则操作 {
  /** 对当前角色重跑完整 水合Agent规则角色数据（Rules + interpreting + ready，更新两个阶段）。 */
  刷新Agent规则(): Promise<void>;
  /** candidate 必填 作用域；返回服务端 proposal_id。Mock 模式派发现有同步动作并返回合成空串。 */
  创建Agent规则提案(input: { 文本: string; 作用域?: BFFAgent规则作用域 }): Promise<string>;
  /** 用原始当前 Rule（含 version）发起替换提案；编辑文本留在组件里，不进任何快照。 */
  创建Agent规则替换提案(ruleId: string, text: string): Promise<string>;
  /** 权威 GET：提交/移除 addressed 提案；不取 提案 写锁（接受/放弃恢复要用它）。 */
  刷新Agent规则提案(proposalId: string): Promise<void>;
  接受Agent规则提案(proposalId: string): Promise<void>;
  放弃Agent规则提案(proposalId: string): Promise<void>;
  /** pause/resume 用当前 version 做 If-Match；冲突/丢失后重读全部 Rules，绝不重发 mutation。 */
  切换Agent规则(ruleId: string, operation: 'pause' | 'resume'): Promise<void>;
  删除Agent规则(ruleId: string): Promise<void>;
}

/**
 * P2 Task 3：页面会调用的附件简历操作方法表（页面不得直接调用数据源）。
 * 四个 mutation 都不做乐观写：mutation 成功 / 歧义恢复后统一权威 GET 列表再 resolve，
 * 返回 已提交 表示「当前会话已拿到非 null 权威快照」，已换代 只表示会话已换代（不提示、不抛错）。
 * 冲突 / 结果未知 / 401 按 Spec 10.2–10.4 分派：重读提交权威视图后按目标核对，
 * 绝不重放 mutation。Mock 模式 mutation 返回 已换代、read 静默、download 抛 backend_unavailable。
 * P5 Task 3 追加 准备候选委托简历：委托前的一次权威库读取，走同一提交协调器。
 */
export interface 附件简历操作 {
  /**
   * 委托前的权威库准备（P5）：立即 GET 一次并经既有提交协调器落地，
   * 返回已提交的权威快照本体；会话/角色换代（读途中或失败迟到）返回 null，
   * 由屏静默处理 —— null 不是空库，绝不进「去上传」分支。
   * 当前会话 401 与 刷新附件简历 同口径清账号后原样抛；Mock / 无后端返回 null 不发请求。
   */
  准备候选委托简历(): Promise<BFF附件简历库 | null>;
  刷新附件简历(): Promise<void>;
  创建附件简历(file: File, consent: true): Promise<附件变更结果>;
  替换附件简历(fileId: string, file: File, consent: true): Promise<附件变更结果>;
  删除附件简历(fileId: string): Promise<附件变更结果>;
  请求附件解析(fileId: string, consent: true): Promise<附件变更结果>;
  下载附件简历(fileId: string): Promise<Blob>;
}

export type 附件变更结果 = '已提交' | '已换代';

/**
 * P5 Task 3：页面会调用的 MatchCase 操作方法表（页面不得直接调用数据源）。
 * 铁律：调用方不携带幂等键 —— 每个 mutation 由域内按 role + case_id + action + target/ref
 * 派生一把稳定意图键（spec §12）；mutation 一律服务端先行 + 成功（或确认重放）后权威
 * detail 重读 + 已载列表/历史刷新，响应本体绝不替换详情快照。
 */
export interface MatchCase操作 {
  /** 屏幕注册当前可见 P5 scope（列表键 / 详情键 / null 卸载）；换键递增旧新 scope 代际。 */
  设置P5范围(role: P5角色, 范围键: string | null): void;
  加载工作区(role: P5角色, filterRef: string | null, force?: boolean): Promise<void>;
  /** 已载窗口向后追加一页（透传快照里的 next_cursor）；游标已尽时零请求。 */
  追加工作区(role: P5角色, filterRef: string | null): Promise<void>;
  /** 从第一页重建已载窗口（同深度），轮询与手动刷新共用。 */
  刷新工作区(role: P5角色, filterRef: string | null): Promise<void>;
  加载历史(role: P5角色, lifecycle: P5历史生命周期, filterRef: string | null, force?: boolean): Promise<void>;
  追加历史(role: P5角色, lifecycle: P5历史生命周期, filterRef: string | null): Promise<void>;
  刷新历史(role: P5角色, lifecycle: P5历史生命周期, filterRef: string | null): Promise<void>;
  /** 直读详情：URL case_id + 已认证角色，绝不读列表记忆填上下文；force=true 恒权威重读。 */
  读取详情(role: P5角色, caseId: string, force?: boolean): Promise<void>;
  回答事实(role: P5角色, caseId: string, promptId: string, response: string): Promise<void>;
  /**
   * 候选端 S1 简历提交：disclosureConfirmed 是字面 true —— 只有屏层每次提交前新做的
   * Case 专属披露确认才把它传进来（确认不复用）；操作层只透传，绝不代确认、绝无缺省。
   * 与 候选P4委托输入.disclosureAcknowledged: true 同一纪律。
   */
  提交简历(caseId: string, fileId: string, fileVersionId: string, disclosureConfirmed: true): Promise<void>;
  决定S0(caseId: string, action: 'continue' | 'end'): Promise<void>;
  决定S1(caseId: string, action: 'continue' | 'not_fit'): Promise<void>;
  决定S2(role: P5角色, caseId: string, issueId: string, action: 'accept' | 'reject'): Promise<void>;
  决定S3(role: P5角色, caseId: string, action: 'confirm' | 'decline'): Promise<void>;
  新增叮嘱(role: P5角色, caseId: string, text: string): Promise<void>;
  /** 披露后的原始简历 PDF：返回 Plan 1 对象租约（登记在域内，会话边界统一回收）。 */
  读取简历PDF(role: P5角色, caseId: string): Promise<PDF对象租约>;
}

/**
 * P7 Task 2：页面会调用的真人会话操作方法表（页面不得直接调用数据源）。
 * 铁律：调用方不携带幂等键 —— 每个 (role + conversation + trim 后正文) 意图
 * 由域内持有一把稳定 Idempotency-Key（crypto.randomUUID 铸造，同意图沿用）；
 * 发送不乐观追加，成功 / 未知对账后一律权威 no-store 重拉消息/详情/收件箱。
 */
export interface 真人会话操作 {
  /** 屏幕登记当前角色收件箱是否可见（消息 Tab 挂载/卸载）；事件层据此决定重拉范围。 */
  设置P7收件箱范围(role: P7角色, visible: boolean): void;
  /** 屏幕登记当前可见会话坐标（null = 卸载）；换会话递增旧新 scope 代际作废在飞读。 */
  设置P7会话范围(role: P7角色, conversationId: string | null): void;
  加载会话列表(role: P7角色, force?: boolean): Promise<void>;
  /** 已载收件箱向后追加一页（透传快照里的 next_cursor）；游标已尽时零请求。 */
  追加会话列表(role: P7角色): Promise<void>;
  /** 直读会话详情 + 最新消息页（并行）；force=true 恒权威重读，直达不依赖收件箱。 */
  读取真人会话(role: P7角色, conversationId: string, force?: boolean): Promise<void>;
  /** 已载消息窗口向更早 prepend 一页；游标已尽时零请求。 */
  追加更早消息(role: P7角色, conversationId: string): Promise<void>;
  发送真人消息(role: P7角色, conversationId: string, content: string): Promise<P7发送结果>;
  /** 显式放弃：只清该不可变正文对应的待定意图键，保留屏层当前编辑中的草稿。 */
  放弃真人消息意图(role: P7角色, conversationId: string, pendingContent: string): void;
  /**
   * forward-only 已读：同 target 与 上次成功/在飞/终局拒绝 相同时零请求；
   * 只接受 decimal user_text 坐标；成功后刷新详情与收件箱。
   */
  提交真人已读(role: P7角色, conversationId: string, messageId: string): Promise<void>;
  /** 事件层入口：作废对应会话（或未指定坐标时的收件箱）的在飞读，随后由调用方 force 重拉。 */
  使真人会话失效(role: P7角色, conversationId?: string): void;
}

/**
 * P8 Task 3+5：页面会调用的账号控制面操作方法表（页面不得直接调用数据源）。
 * 铁律：调用方不携带幂等键 —— 每个 mutation 由域内按意图坐标（换绑开始=手机号、
 * 换绑完成=attempt+验证码、退出其他设备=恒定、创建导出=落盘 createKey、注销=恒定）
 * 铸造一把 crypto.randomUUID 键，同意图的所有重试沿用同一把键；mutation 一律
 * 服务端先行，成功（或确认重放）后权威重读，响应本体绝不替换快照。
 * 导出创建的幂等键即恢复句柄里的 createKey：先落盘 {exportId:null} 再 POST，
 * 响应丢失/刷新后按句柄同键重放。Task 6–7 在本表上再加合规两法。
 */
export interface P8账号控制面操作 {
  /** 登记账号 UI 可见性：只影响迟到提示抑制与 UI 可见，绝不递增 P8 栅栏、不清快照。 */
  设置P8账号范围(visible: boolean): void;
  /** 按需读取凭证（设置页只读凭证，零会话请求）；非 force 且已成功时零请求。 */
  加载P8凭证(force?: boolean): Promise<void>;
  /** 按需读取会话（账号安全页与凭证并行）；非 force 且已成功时零请求。 */
  加载P8会话(force?: boolean): Promise<void>;
  /** 11 位中国大陆裸号进 facade（facade 构造 +86 E.164）；返回 attempt 供完成步使用。 */
  开始P8手机号换绑(phone: string): Promise<P8ReplacementAttempt>;
  /** 证明执行产品全局 4 位规则；成功后强制重读凭证+会话再 resolve，绝不乐观写掩码手机号。 */
  完成P8手机号换绑(attemptId: string, code: string): Promise<P8ReplacementResult>;
  /** 退出其他设备：返回 revoked_sessions 回执计数；成功后权威重读会话，不影响当前会话。 */
  退出P8其他设备(): Promise<number>;
  /**
   * 被动恢复（进屏/打开抽屉）：读当前 subject 句柄 —— 无适配器或无句柄零导出请求；
   * exportId:null 用落盘 createKey 同键重放 POST；有 ID 只权威 GET。
   */
  恢复P8数据导出(): Promise<void>;
  /**
   * 显式创建/续接：无句柄先落盘 {subjectId, createKey, exportId:null} 再 POST
   * （适配器缺席或写入失败 → 固定「数据导出暂不可用」文案 + 零请求）；有 ID 句柄时
   * 退化为权威 GET（绝不向已有导出再 POST）。
   */
  创建P8数据导出(): Promise<void>;
  /** 权威 GET 导出状态（'export' 单飞）；无已知 exportId 零请求；404/expired 清句柄。 */
  刷新P8数据导出(): Promise<void>;
  /** 清当前 subject 句柄并摊平导出快照：404/expired/明确重新生成用，下次创建铸新键。 */
  废弃P8数据导出(): void;
  /** ready+downloadReady 是唯一可下载组合，其余一律 null；URL 委托 facade 严格校验构造。 */
  取P8数据导出下载地址(): string | null;
  /**
   * 注销：终局确认单飞（body {} 由 facade 冻结）；未知结果同键 1s/2s 显式重放至多
   * 两次，持续不确定原样抛出且保留意图供手动重试；202 的本地收口以会话栅栏为界 ——
   * 栅栏仍立时先统一清 P4–P8 再 resolve 并删当前 subject 导出句柄（尽力而为）；
   * 重放窗内换会话/换主体的迟到 202 固定文案抛出，绝不摊平新会话或删新主体句柄；
   * 成功后的导航归屏幕。
   */
  请求P8账号注销(): Promise<void>;
}

export type 应用操作 = 会话操作 & 候选操作 & 岗位操作 & 组织操作 & 隐私操作 & Agent规则操作 & 发现推荐操作 & 附件简历操作 & MatchCase操作 & 真人会话操作 & P8账号控制面操作;
