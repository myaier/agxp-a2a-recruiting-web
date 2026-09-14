// 后端 Onboarding 域操作：me/onboarding 读取与角色完成（stg 契约对齐 2026-09-14，Spec §4/§5）。
// 铁律：
//   · Backend 才发请求；Mock 不发网络、状态恒 未读取（Mock 分流不消费本域）。
//   · 运行态判别 union（未读取/加载中/成功/失败）：GET 失败绝不以默认 null 合成「未完成」；
//     404（部署不匹配）与坏响应同样落 失败。
//   · 栅栏 = subject_id + 会话代际 + 本域最小请求序号：迟到的旧 scope 成败整包丢弃，
//     同 scope 旧 GET 不能把较新 complete 登记的已完成覆盖回 null；会话边界（清账号 /
//     换主体 / 切身份）经 清Onboarding引用 递增序号作废在飞读。
//   · 当前栅栏 401 统一 清账号状态（状态摊平为 未读取）；迟到旧会话 401 不清新会话。
//   · 完成调用 body 恒 {}（数据源冻结），不修改角色偏好 / last_used_role；成功回执
//     按 candidate→recruiter 顺序合并进 成功 快照。
//   · 前端不重新实现永久「完成」判定；分流判断只消费本域成功快照（判定Onboarding分流）。
// 本模块不 import React 或模拟数据。

import { BFF错误 } from '../../数据/HTTP客户端';
import type { BFFOnboarding角色状态, BFFOnboarding状态, BFF主体, BFF角色 } from '../../数据/BFF契约';
import { 清账号状态 } from './会话操作';
import type { Onboarding运行态, Onboarding操作, 后端操作依赖, 后端状态 } from './类型';

/** pristine 运行态：Provider 首帧与全部会话转移口共用同一形状。 */
export function 创建空Onboarding状态(): Onboarding运行态 {
  return { 阶段: '未读取' };
}

/**
 * Onboarding 运行态的唯一读取回退：后端状态.Onboarding 在共享类型上为 required，
 * 但聚焦其它域的既有测试桩可能构造部分对象 —— 读取方统一走本回退，不构造第二种默认形状。
 */
export function 取Onboarding状态(状态: 后端状态): Onboarding运行态 {
  return 状态.Onboarding ?? 创建空Onboarding状态();
}

/** 引用级清理：会话边界（登出 / 401 / 换主体 / 切身份）递增本域请求序号，作废在飞读。 */
export function 清Onboarding引用(
  deps: Partial<Pick<后端操作依赖, 'Onboarding请求序号'>>,
): void {
  if (deps.Onboarding请求序号) deps.Onboarding请求序号.current += 1;
}

/** Onboarding 域读取/登记需要的依赖子集（清账号状态 的必需键都在内）。 */
type Onboarding域依赖 = Pick<后端操作依赖,
  '后端' | '派发' | '设后端状态' | '主体标识引用' | '会话代际' | 'Onboarding请求序号'
>;

/**
 * 本域请求序号：deps 恒注入；旧依赖桩缺席时退回模块级共享计数（同一进程内的旧桩
 * 之间仍防乱序；生产 Provider 恒注入独立引用，不共享）。
 */
const 共享序号: { current: number } = { current: 0 };
function 取序号引用(deps: Onboarding域依赖): { current: number } {
  return deps.Onboarding请求序号 ?? 共享序号;
}

/** 401 统一判据：会话失效一律 清账号状态（与其它域同口径）。 */
function 是401(错误: unknown): boolean {
  return 错误 instanceof BFF错误 && 错误.status === 401;
}

/** 非 BFF错误 的意外异常收口为 network_error（不泄露实现细节进状态）。 */
function 收口错误(错误: unknown): BFF错误 {
  return 错误 instanceof BFF错误 ? 错误 : new BFF错误(0, 'network_error', '网络异常');
}

/**
 * Spec §5 分流表的共享纯判定（应用落点与选身份消费；不重写 router）：
 *   未登录/无角色或 last_used_role=null → 选择身份；
 *   查询未完成（未读取/加载中）→ 查询中（显示加载/重试，不挂载会自动保存的引导页）；
 *   读取失败 → 读取失败（提示与恢复，不猜完成/未完成）；
 *   GET 缺所选角色、或 GET/主体任一侧停用 → 角色不可用（显示重试，不自动 ensure 停用角色）；
 *   active 未完成 → 未完成（对应引导）；active 已完成 → 已完成（正常主页）。
 */
export type Onboarding分流判定 =
  | { 型: '查询中' }
  | { 型: '读取失败'; 错误: BFF错误 }
  | { 型: '选择身份' }
  | { 型: '未完成'; 角色: BFF角色 }
  | { 型: '已完成'; 角色: BFF角色 }
  | { 型: '角色不可用'; 角色: BFF角色 };

export function 判定Onboarding分流(
  主体: BFF主体 | null,
  onboarding: Onboarding运行态,
): Onboarding分流判定 {
  if (主体 === null || 主体.last_used_role === null) return { 型: '选择身份' };
  const 角色 = 主体.last_used_role;
  if (onboarding.阶段 === '未读取' || onboarding.阶段 === '加载中') return { 型: '查询中' };
  if (onboarding.阶段 === '失败') return { 型: '读取失败', 错误: onboarding.错误 };
  const 条 = onboarding.数据.roles.find((行) => 行.role === 角色);
  // 查询中的 role 状态与所选主体角色明显矛盾（一侧停用/缺失）→ 显示重试，不自动激活
  if (
    条 === undefined
    || 条.status !== 'active'
    || !主体.roles.some((行) => 行.role === 角色 && 行.status === 'active')
  ) {
    return { 型: '角色不可用', 角色 };
  }
  return 条.completed_at === null
    ? { 型: '未完成', 角色 }
    : { 型: '已完成', 角色 };
}

/**
 * 422 validation_failed 按冻结 path 给可行动中文提示（Spec §4）：
 * 引导用户导航到相应现有页面补全，不后台补写；未知字段/非 422 返回 null（交一般错误文案）。
 */
export function Onboarding422提示(错误: unknown): string | null {
  if (!(错误 instanceof BFF错误) || 错误.status !== 422) return null;
  const 路径们 = 错误.fieldErrors.map((条) => 条.path);
  const 命中 = (前缀: string): boolean =>
    路径们.some((路径) => 路径 === 前缀 || 路径.startsWith(`${前缀}.`));
  if (命中('resume.profile.real_name')) return '姓名还没保存成功：请回「基本信息」填写姓名后重试';
  if (命中('resume.profile.status')) return '求职状态还没保存成功：请回「基本信息」选择求职状态后重试';
  if (命中('resume.educations')) return '还缺一条完整的教育经历：请回「最高学历」补全学校、专业与毕业时间后重试';
  if (命中('intentions')) return '求职意向还没保存成功：请回「引导问答」完成首次求职意向后重试';
  if (命中('recruiter.profile')) return '招聘名片还没保存成功：请回「招聘名片」完善姓名后重试';
  return null;
}

/** 读取的内部结果：过时（栅栏/序号破防）只释放，不写状态。 */
type Onboarding读取结果 =
  | { 型: '成功'; 数据: BFFOnboarding状态 }
  | { 型: '失败'; 错误: BFF错误 }
  | { 型: '会话失效' }
  | { 型: '过时' };

/**
 * GET me/onboarding 并原子提交运行态；返回本次读取的分类结果（绝不 reject）。
 * 历史最小数据源没有 读取Onboarding 方法时按过时跳过（状态保持，兼容旧测试桩；
 * 生产 HTTP facade 恒提供 —— 与 读取候选账号档案 同一口径）。
 */
async function 运行Onboarding读取(
  deps: Onboarding域依赖,
  subjectId: string,
  generation: number,
): Promise<Onboarding读取结果> {
  const { 后端, 设后端状态 } = deps;
  if (后端 === null || typeof 后端.读取Onboarding !== 'function') return { 型: '过时' };
  const 序号 = 取序号引用(deps);
  序号.current += 1;
  const 本次 = 序号.current;
  const 栅栏仍立 = () =>
    deps.主体标识引用.current === subjectId
    && deps.会话代际.current === generation
    && 序号.current === 本次;
  设后端状态((旧) => ({ ...旧, Onboarding: { 阶段: '加载中' } }));
  try {
    const 数据 = await 后端.读取Onboarding();
    if (!栅栏仍立()) return { 型: '过时' };
    设后端状态((旧) => ({ ...旧, Onboarding: { 阶段: '成功', 数据 } }));
    return { 型: '成功', 数据 };
  } catch (错误) {
    if (!栅栏仍立()) return { 型: '过时' };
    if (是401(错误)) {
      清账号状态(deps);
      设后端状态((旧) => ({ ...旧, Onboarding: 创建空Onboarding状态() }));
      return { 型: '会话失效' };
    }
    const 收口 = 收口错误(错误);
    设后端状态((旧) => ({ ...旧, Onboarding: { 阶段: '失败', 错误: 收口 } }));
    return { 型: '失败', 错误: 收口 };
  }
}

/**
 * 会话水合入口（mount / 登录 / 切身份 经 水合角色数据 调用）：
 * 读取结果已全部落在状态里；返回 true = 当前栅栏 401 已执行统一清账号（会话失效）。
 */
export async function 水合Onboarding(
  deps: Onboarding域依赖,
  subjectId: string,
  generation: number,
): Promise<boolean> {
  const 结果 = await 运行Onboarding读取(deps, subjectId, generation);
  return 结果.型 === '会话失效';
}

/** POST 结果未知后的 GET 查证：明确已完成 / 仍未完成（可安全重试）/ 读取失败（留错误）。 */
export async function 查证Onboarding角色(
  deps: Onboarding域依赖,
  subjectId: string,
  generation: number,
  role: BFF角色,
): Promise<'已完成' | '未完成' | '读取失败'> {
  const 结果 = await 运行Onboarding读取(deps, subjectId, generation);
  if (结果.型 !== '成功') return '读取失败';
  const 条 = 结果.数据.roles.find((行) => 行.role === role);
  if (条 === undefined || 条.completed_at === null) return '未完成';
  return '已完成';
}

/** 完成回执的合并顺序：契约固定 candidate→recruiter。 */
const 角色顺序: Record<BFF角色, number> = { candidate: 0, recruiter: 1 };

/** 把完成回执登记进 成功 快照：序号推进（旧 GET 不覆盖本次结果），同名条目整体替换。 */
export function 登记Onboarding完成(
  deps: Onboarding域依赖,
  subjectId: string,
  generation: number,
  结果: BFFOnboarding角色状态,
): void {
  const 序号 = 取序号引用(deps);
  序号.current += 1;
  const 本次 = 序号.current;
  if (
    deps.主体标识引用.current !== subjectId
    || deps.会话代际.current !== generation
    || 序号.current !== 本次
  ) return;
  deps.设后端状态((旧) => {
    const 当前 = 取Onboarding状态(旧);
    const 现有 = 当前.阶段 === '成功' ? 当前.数据.roles : [];
    const 其余 = 现有.filter((行) => 行.role !== 结果.role);
    const roles = [...其余, 结果].sort((a, b) => 角色顺序[a.role] - 角色顺序[b.role]);
    return { ...旧, Onboarding: { 阶段: '成功', 数据: { roles } } };
  });
}

/**
 * POST /me/onboarding/{role}/complete 并登记成功回执（body 由数据源冻结为 {}，
 * 不携带任何前端草稿字段）。当前栅栏 401 统一清账号；其余失败原样抛出
 * （422 的可行动提示由 Onboarding422提示 消费）。
 */
export async function 完成Onboarding角色(
  deps: Onboarding域依赖,
  role: BFF角色,
): Promise<BFFOnboarding角色状态> {
  const { 后端 } = deps;
  if (后端 === null) throw new BFF错误(0, 'invalid_request', '后端数据源未初始化');
  const subjectId = deps.主体标识引用.current;
  if (subjectId === null) throw new BFF错误(0, 'invalid_request', '当前没有可完成的登录会话');
  const generation = deps.会话代际.current;
  try {
    const 结果 = await 后端.完成Onboarding(role);
    登记Onboarding完成(deps, subjectId, generation, 结果);
    return 结果;
  } catch (错误) {
    if (是401(错误)
      && deps.主体标识引用.current === subjectId
      && deps.会话代际.current === generation) {
      清账号状态(deps);
    }
    throw 错误;
  }
}

export function 创建Onboarding操作(deps: 后端操作依赖): Onboarding操作 {
  const { 是后端 } = deps;
  return {
    async 刷新Onboarding() {
      if (!是后端) throw new BFF错误(0, 'invalid_request', 'Mock 模式不读取 onboarding 状态');
      const subjectId = deps.主体标识引用.current;
      if (subjectId === null) throw new BFF错误(0, 'invalid_request', '当前没有可读取的登录会话');
      const generation = deps.会话代际.current;
      const 结果 = await 运行Onboarding读取(deps, subjectId, generation);
      if (结果.型 === '成功') return 结果.数据;
      if (结果.型 === '失败') throw 结果.错误;
      if (结果.型 === '会话失效') throw new BFF错误(401, 'invalid_session', 'expired');
      throw new BFF错误(0, 'invalid_request', '会话已变化，本次读取未生效');
    },
    async 完成角色Onboarding(role) {
      if (!是后端) throw new BFF错误(0, 'invalid_request', 'Mock 模式不发送完成请求');
      return 完成Onboarding角色(deps, role);
    },
  };
}
