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
import type { 在招岗位, 披露档, 屏蔽来源, 屏蔽项 } from '../../数据/类型';
import type { 资料形 } from '../../数据/公司主页资料';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import type { 动作, 状态 } from '../应用状态';

export interface 后端状态 extends P4发现状态 {
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

export type 应用操作 = 会话操作 & 候选操作 & 岗位操作 & 组织操作 & 隐私操作 & Agent规则操作 & 发现推荐操作 & 附件简历操作;
