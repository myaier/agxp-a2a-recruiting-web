// J-PILOT-01 Task 3（Spec §8 / Plan 协议 B）：create/retry 未决命令的最小恢复记录。
//
// 纯 helper（无 React）：只读写本域的 sessionStorage 键
//   AGXP委托待核对v1:<encoded environment>:<encoded subject>:candidate
// 值为有限未决命令数组，按后端环境 + 已认证 subject/role 隔离（同标签页）。
// 只保存恢复原命令所需且仅需的标识 —— create：原 operation/key、intention_id、原有序
// 单岗位 selection、准确 PDF pair、当次 disclosure_acknowledged=true，已知后补
// delegation_id / canonical record_id；retry：原 operation/key、原 record_id、原
// expected_retry_generation。绝不保存 PDF 正文、文件名、私有诉求、消息、token 或 cookie。
//
// 纪律（与 候选Onboarding预填恢复 同口径）：
//   · 序列化/反序列化严格按恰好闭合键集校验；坏 JSON、越权键集（可能是敏感数据）或
//     坏类型的旧值整笔丢弃并删除（fail closed）；
//   · storage 为 null、owner 缺席或抛异常一律返回持久化失败标记（读：空命令 + 失败；
//     写：false；删：no-op），绝不把存储故障抛进页面 —— 同页恢复能力由调用方的内存
//     兜底（发现推荐操作 持有内存表，存储失败仍能核对），本模块不吞业务记录、不写正文。

/** opaque 段的键内转义：与 发现推荐操作/MatchCase操作 同一纪律，含 `:` 的 id 逐段转义绝不撞键。 */
function 段(值: string): string {
  return encodeURIComponent(值);
}

/** 恢复目标主体：按后端环境 + 已认证 subject/role 隔离；本域恒为 candidate。 */
export interface 委托待核对owner {
  environment: string;
  subjectId: string;
  role: 'candidate';
}

/** 恢复所需的存储面：生产注入 sessionStorage 的三方法子集（或降级后的 null）。 */
export type 委托待核对存储接口 = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * owner 绑定的存储会话：Provider 在渲染期按 Backend + candidate 主体换绑（与
 * P8导出恢复/候选预填恢复 同一纪律），操作方法在调用时解引用 .current —— 主体离开
 * candidate 或未登录时为 null，此时内存表兜底同页核对、存储读写收口为持久化失败。
 */
export interface 委托待核对会话 {
  storage: 委托待核对存储接口 | null;
  owner: 委托待核对owner;
}

/**
 * 未决命令（协议 B 冻结形状）：create 冻结原 operation/key 与完整语义 body；
 * retry 冻结原 operation/key、原 record_id 与原 expected_retry_generation。
 * 有回执后 create 可补 delegation_id/canonical record_id；已确认回执只说明 write 已
 * 确认（GET 失败后不再重发已确认 write）。绝不出现第二套扩展字段。
 */
export type 待核对命令 =
  | {
      operation: 'create';
      key: string;
      intention_id: string;
      selection: { items: [{ job_id: string }] };
      resume_file_id: string;
      resume_file_version_id: string;
      disclosure_acknowledged: true;
      delegation_id?: string;
      record_id?: string;
      已确认回执?: true;
    }
  | {
      operation: 'retry';
      key: string;
      record_id: string;
      expected_retry_generation: number;
      已确认回执?: true;
    };

/** 冻结的物理键：前缀 + 逐段转义 environment/subject + role。 */
export function 委托待核对键(owner: 委托待核对owner): string {
  return `AGXP委托待核对v1:${段(owner.environment)}:${段(owner.subjectId)}:${owner.role}`;
}

/** create 的命令目标键（intention + job 逐段转义）；内存 pending 表按它去重。 */
export function 委托创建目标键(intentionId: string, jobId: string): string {
  return `create:${段(intentionId)}:${段(jobId)}`;
}

/** retry 的命令目标键（record 坐标逐段转义）。 */
export function 委托重试目标键(recordId: string): string {
  return `retry:${段(recordId)}`;
}

/** 任一命令的目标键：同一目标的未决命令只留一份（未决时不另起命令）。 */
export function 委托待核对目标键(命令: 待核对命令): string {
  return 命令.operation === 'create'
    ? 委托创建目标键(命令.intention_id, 命令.selection.items[0].job_id)
    : 委托重试目标键(命令.record_id);
}

// ── 恰好闭合键集的白名单（缺键或多出未知键都整笔拒绝）──

const create必需键 = [
  'operation', 'key', 'intention_id', 'selection',
  'resume_file_id', 'resume_file_version_id', 'disclosure_acknowledged',
] as const;
const create可选键 = ['delegation_id', 'record_id', '已确认回执'] as const;
const retry必需键 = ['operation', 'key', 'record_id', 'expected_retry_generation'] as const;
const retry可选键 = ['已确认回执'] as const;

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === 'object' && 值 !== null && !Array.isArray(值);
}

function 键集恰好(值: Record<string, unknown>, 必需: readonly string[], 可选: readonly string[]): boolean {
  const 允许 = new Set([...必需, ...可选]);
  for (const 键 of 必需) if (!(键 in 值)) return false;
  for (const 键 of Object.keys(值)) if (!允许.has(键)) return false;
  return true;
}

function 是非空串(值: unknown): 值 is string {
  return typeof 值 === 'string' && 值.length > 0;
}

/** 可选补 ID 字段：在场必须是非空串（回执已到手才有 ID；空串不是可恢复坐标）。 */
function 是可选非空串(值: unknown): 值 is string {
  return 值 === undefined || (typeof 值 === 'string' && 值.length > 0);
}

function 是可选真(值: unknown): 值 is true {
  return 值 === undefined || 值 === true;
}

/** 协议 B 的冻结形状守卫：写前与读后共用，越权字段（可能是敏感数据）整笔拒绝。 */
export function 是待核对命令(值: unknown): 值 is 待核对命令 {
  if (!是记录(值)) return false;
  if (值.operation === 'create') {
    if (!键集恰好(值, create必需键, create可选键)) return false;
    if (!是非空串(值.key) || !是非空串(值.intention_id)) return false;
    if (!是非空串(值.resume_file_id) || !是非空串(值.resume_file_version_id)) return false;
    if (值.disclosure_acknowledged !== true) return false;
    if (!是记录(值.selection) || !Array.isArray(值.selection.items)) return false;
    // create 冻结的是原有序单岗位 selection：恰好一项，绝不用 top/最新推荐求值
    if (值.selection.items.length !== 1) return false;
    const 项 = 值.selection.items[0];
    if (!是记录(项) || !是非空串(项.job_id)) return false;
    if (Object.keys(项).length !== 1) return false;
    return 是可选非空串(值.delegation_id) && 是可选非空串(值.record_id) && 是可选真(值.已确认回执);
  }
  if (值.operation === 'retry') {
    if (!键集恰好(值, retry必需键, retry可选键)) return false;
    if (!是非空串(值.key) || !是非空串(值.record_id)) return false;
    if (typeof 值.expected_retry_generation !== 'number' ||
      !Number.isSafeInteger(值.expected_retry_generation) ||
      值.expected_retry_generation < 0) return false;
    return 是可选真(值.已确认回执);
  }
  return false;
}

/** 读结果：持久化失败=true 表示该 owner 的恢复记录不可依赖（无存储/坏值/读异常）。 */
export interface 待核对读取结果 {
  命令: 待核对命令[];
  持久化失败: boolean;
}

/** 读 owner 的未决命令；无值时命令为空且失败为 false（没存过不是故障）。 */
export function 读取待核对(
  storage: 委托待核对存储接口 | null,
  owner: 委托待核对owner | null,
): 待核对读取结果 {
  if (storage === null || owner === null) return { 命令: [], 持久化失败: true };
  let 原文: string | null;
  try {
    原文 = storage.getItem(委托待核对键(owner));
  } catch {
    // 读不出来按没有处理，但不删除：还没看到值，不能凭空清掉别人的数据。
    return { 命令: [], 持久化失败: true };
  }
  if (原文 === null) return { 命令: [], 持久化失败: false };
  let 值: unknown;
  try {
    值 = JSON.parse(原文);
  } catch {
    丢弃(storage, owner);
    return { 命令: [], 持久化失败: true };
  }
  if (!Array.isArray(值) || !值.every(是待核对命令)) {
    丢弃(storage, owner);
    return { 命令: [], 持久化失败: true };
  }
  return { 命令: 值 as 待核对命令[], 持久化失败: false };
}

/** 整批保存：入参先过同一套白名单（带越权字段整笔拒绝，零写入），异常返回 false。 */
export function 保存待核对(
  storage: 委托待核对存储接口 | null,
  owner: 委托待核对owner | null,
  commands: 待核对命令[],
): boolean {
  if (storage === null || owner === null) return false;
  if (!commands.every(是待核对命令)) return false;
  try {
    storage.setItem(委托待核对键(owner), JSON.stringify(commands));
    return true;
  } catch {
    return false;
  }
}

/** 清 owner 的恢复记录（退出/切主体）；删除异常吞掉，不把存储故障抛进页面。 */
export function 清除待核对(
  storage: 委托待核对存储接口 | null,
  owner: 委托待核对owner | null,
): void {
  if (storage === null || owner === null) return;
  丢弃(storage, owner);
}

function 丢弃(storage: 委托待核对存储接口, owner: 委托待核对owner): void {
  try {
    storage.removeItem(委托待核对键(owner));
  } catch {
    // 删除失败也只能保持 fail closed。
  }
}
