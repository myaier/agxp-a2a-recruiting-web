// 后端会话域操作：登录 / 退出 / 切身份 + 统一账号清理 + 角色水合。
// 从 应用状态提供者 的 useMemo 操作体按真实后端 owner 拆出，行为逐字保持：
// 401 / 409 / 503 / stale response / revision / 主体标识变化清理 / 会话代际守卫全部原样。
// 不改变加载、错误、stale response guard、revision 或水合时序；接口失败绝不回退 Mock。

import { BFF错误, 客户端校验错误, 取后端错误文案 } from '../../数据/HTTP客户端';
import type { BFF主体, BFF角色 } from '../../数据/BFF契约';
import type { 页面简历快照, 页面意向快照, 页面岗位快照 } from '../../数据/招聘数据源类型';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { 轻提示 } from '../../组件/轻提示';
import type { 后端状态, 后端操作依赖, 会话操作 } from './类型';
import { 创建空招聘方组织水合状态 } from './类型';
import { 水合Agent规则角色数据 } from './Agent规则操作';
import { 水合招聘方组织数据 } from './组织操作';
import { 创建空P4发现状态 } from './发现推荐操作';
import { 创建空P7会话状态, 清P7会话引用 } from './真人会话操作';
import { 创建空P8控制面状态, 清P8控制面引用 } from './P8控制面操作';

/** 退出登录 / 401 清理时把支持域重置为空：与 后端种子状态 的支持域一致，但不触达未支持演示域。 */
const 空BFF简历 = {
  profile: {
    real_name: '',
    work_start_year: null,
    status: '',
    current_education: null,
    graduation_year: null,
    gender: null,
    birth_year: null,
    birth_month: null,
  },
  profile_revision: 0,
  summary: '',
  summary_revision: 0,
  skills: [] as never[],
  skills_revision: 0,
  experiences: [] as never[],
  educations: [] as never[],
  certificates: [] as never[],
  aggregate_revision: 0,
};

const 空简历快照: 页面简历快照 = {
  基本信息: { 真名: '', 开始工作年: '', 身份: '在职' },
  个人优势: '',
  技能: [],
  经历: [],
  教育: [],
  证书: [],
  服务端快照: 空BFF简历 as never,
};

const 空意向快照: 页面意向快照 = { 列表: [], 服务端: {} };
const 空岗位快照: 页面岗位快照 = { 列表: [], 服务端: {} };

/** review-r2 R2-I-3：检测 401 —— 水合途中会话过期时需要走统一登出清理，不能只 轻提示。 */
function 是会话失效错误(错误: unknown): boolean {
  return 错误 instanceof BFF错误 && 错误.status === 401;
}

/** 401 扫描用的结算结果谓词：拒绝原因里含 401 即会话失效。 */
function 是会话失效落败(落点: PromiseSettledResult<unknown>): boolean {
  return 落点.status === 'rejected' && 是会话失效错误(落点.reason);
}

/**
 * P6 Task 4：会话边界把规则域重置回干净底座 —— 原始规则字典/提案表清空，
 * 双端水合阶段回 未开始。与 清后端Agent规则（清页面数组）配套，在 清账号状态 /
 * 登录换主体 / 切身份 / mount 恢复 四个转移口共用同一形状，保证任何转移后的
 * 水合都跑完整链路，阶段不可能粘住上个会话残留的 进行中|成功。
 */
export function 重置Agent规则后端状态(旧: 后端状态): 后端状态 {
  return {
    ...旧,
    候选规则快照: {},
    招聘规则快照: {},
    候选规则提案: {},
    招聘规则提案: {},
    Agent规则水合: {
      candidate: { rules: '未开始', proposals: '未开始' },
      recruiter: { rules: '未开始', proposals: '未开始' },
    },
  };
}

/**
 * P4 Task 3：discovery 的引用级清理 —— scope 代际与 pending 幂等意图双 Map 清空、
 * 双端可见范围回 null。与 清账号状态 / 登录换主体 / 切身份 三个转移口共用同一形状。
 * Provider 恒注入三个引用；可选成员缺省时（旧依赖桩）静默跳过，raw 快照仍由
 * 创建空P4发现状态() 的状态摊平兜底。
 */
export function 清P4发现引用(
  deps: Partial<Pick<后端操作依赖, 'P4范围代际' | 'P4幂等意图' | 'P4可见范围'>>,
): void {
  deps.P4范围代际?.current.clear();
  deps.P4幂等意图?.current.clear();
  if (deps.P4可见范围) deps.P4可见范围.current = { candidate: null, recruiter: null };
}

/**
 * review-r3 R3-I-2：统一的账号状态清理——把所有 401 路径（资源写 / 目录 facade / 水合 / 登录读主体）
 * 收口到这里，避免某个 401 只清自己的域而把别的域的快照/草稿留给下一个登录。
 *
 * 清空内容：简历/意向/岗位三个支持域快照 + 后端状态登出 + 目录缓存 + Backend 专属草稿
 * （引导预填 + 意向草稿）+ P6 规则域（页面数组 + 原始字典 + 双端阶段，Task 4）
 * + P4 发现推荐域（raw 快照回空底座 + 双 Map 与可见范围引用复位，Task 3）
 * + P8 控制面域（三块账号快照回空底座 + 读锁/待定意图清空 + 范围代际递增，Task 3）
 * + 主体标识 + 会话代际递增（让在飞的目录 401 成为 stale）。
 * 409 的「重读权威资源」语义不经过这里——409 不清会话，只让该域落回服务端最新值。
 */
export function 清账号状态(
  deps: Pick<后端操作依赖, '派发' | '设后端状态' | '后端' | '主体标识引用' | '会话代际'> &
    Partial<Pick<后端操作依赖,
      'P4范围代际' | 'P4幂等意图' | 'P4可见范围' |
      'P7范围代际' | 'P7待定意图' | 'P7可见收件箱' | 'P7可见会话' | 'P7已读位置' |
      'P8范围代际' | 'P8账号可见' | 'P8读取锁' | 'P8待定意图'>>,
): void {
  const { 派发, 设后端状态, 后端, 主体标识引用, 会话代际 } = deps;
  派发({ 型: '水合后端简历', 快照: 空简历快照 });
  派发({ 型: '水合后端意向', 快照: 空意向快照 });
  派发({ 型: '水合后端岗位', 快照: 空岗位快照 });
  // P3 Task 2：隐私域一并清理 —— 隐私快照不跨主体 / 不跨会话存活
  派发({ 型: '清后端隐私' });
  派发({ 型: '清后端草稿' });
  // P1C：组织权威事实一起清（profile/affiliations/current/申请/公开缓存/未认证 claim），
  // 但不清 Mock fixture（企业认证/招聘头像/公司LOGO/公司自述 维持 Mock consumer）。
  派发({ 型: '清后端组织状态' });
  // P6：规则域同口径清理 —— 清后端Agent规则 清空三个页面数组，raw 快照/提案表与
  // 双端水合阶段一并回干净底座（Task 3 review ⚠️：这里此前漏清 P6 成员）。
  派发({ 型: '清后端Agent规则' });
  // P4 Task 3：discovery raw 快照（scope 快照 / 详情 / 不可用标记 / 委托回执 / 聚合）回空底座
  // P2 Task 3：附件库快照同口径清理 —— 不跨主体 / 不跨会话存活
  设后端状态((旧) => ({
    ...重置Agent规则后端状态(旧),
    ...创建空P4发现状态(),
    // P7 Task 2：真人会话 raw 快照（收件箱/详情/消息页）一并回空底座，不跨主体 / 不跨会话存活
    ...创建空P7会话状态(),
    // P8 Task 3：控制面三块账号快照（凭证/会话/导出）一并回空底座，不跨主体 / 不跨会话存活
    ...创建空P8控制面状态(),
    // P0 修复 Task 1：招聘方档案 / 组织链两个水合阶段回 未开始，不把上个会话的
    // 缺失/失败判定留给下一个登录
    ...创建空招聘方组织水合状态(),
    初始化: '完成',
    已登录: false,
    主体: null,
    简历快照: null,
    意向快照: {},
    岗位快照: {},
    隐私快照: null,
    附件简历库: null,
  }));
  后端?.清空目录缓存();
  主体标识引用.current = null;
  会话代际.current += 1;
  // P4 引用级清理：双 Map 清空 + 可见范围回 null（与代际递增一起让在飞 P4 读写整包作废）
  清P4发现引用(deps);
  // P7 引用级清理：范围代际 / 待定发送意图 / 已读位置清空 + 双端可见引用复位
  清P7会话引用(deps);
  // P8 引用级清理：范围代际递增 + 读锁/待定意图清空 + 账号可见复位（导出恢复句柄跨登出保留）
  清P8控制面引用(deps);
}

/** 角色水合的依赖形状：会话五个必需键 + 全部 P4/P7/P8 清理引用（可选，随 清账号状态 一起清）。 */
type 角色水合依赖 = Pick<后端操作依赖,
  '后端' | '派发' | '设后端状态' | '主体标识引用' | '会话代际' |
  '读取恢复企业关系编号' |
  'P4范围代际' | 'P4幂等意图' | 'P4可见范围' |
  'P7范围代际' | 'P7待定意图' | 'P7可见收件箱' | 'P7可见会话' | 'P7已读位置' |
  'P8范围代际' | 'P8账号可见' | 'P8读取锁' | 'P8待定意图'
> & { 后端: HTTP招聘数据源 };

/** 唯一的外层水合栅栏：主体与代际都还是发起水合时的那一对，本轮结算才算数。 */
const 是当前水合 = (
  deps: Pick<后端操作依赖, '主体标识引用' | '会话代际'>,
  subjectId: string,
  generation: number,
) => deps.主体标识引用.current === subjectId && deps.会话代际.current === generation;

/**
 * 按主体.last_used_role 水合支持域：
 *   candidate → 简历 + 意向 + 隐私 + 附件库（P2 起四路并行 allSettled，各域独立提交）
 *               + P6 规则三路读取（Task 4）；
 *   recruiter → 先清候选侧隐私与附件库，再固定组织水合（profile → affiliations → current → 公开企业）→ owner Jobs
 *   + P6 规则三路读取（Task 4，与组织/岗位并行起跑）；
 *   null → 保持身份选择页不水合。
 * 会话栅栏（本文件唯一外层）：调用方（mount / 切身份）先写 subject fence 并捕获当前会话代际，
 * 全部读取结算后统一过 是当前水合 —— 主体或代际任一已变（登出 / 换号 / 新会话建立）时，
 * 本轮简历/意向/隐私/附件/岗位/P6 的一切结算整包丢弃：不派发、不提示、不触发清理，
 * 上个会话的任何快照绝不落进下个会话（P6 核另有自己的逐响应 fence，双层同口径）。
 * 401：只有过栅栏后的当前轮 401 才走 清账号状态(deps)（P4/P7/P8 引用随行）并返回 会话失效=true；
 * 迟到的旧会话 401 与其它过时结果一样整包丢弃。401 不逐域 轻提示 —— 多个支持域一起 401
 * 时不弹一串重复的过期提示，交互失败语义交由调用方按 会话失效 统一呈现。
 * mount-init（交互=false）：任一 rejected（非 401）只 轻提示 该资源，不抛出 —— 初始化仍要落成「完成」。
 * 切身份（交互=true）：任一 rejected 直接抛出第一个错误 —— 让 选身份.tsx catch 显示 轻提示并留在原地，
 *   不导航进一个空壳（支持域没水合成功，进去也是空盘）。
 * @returns 会话失效 —— true 表示水合途中遇到当前轮 401 并已执行登出清理，调用方不应再落 已登录=true
 */
export async function 水合角色数据(
  deps: 角色水合依赖,
  主体: BFF主体,
  交互: boolean,
  generation: number,
): Promise<boolean> {
  const { 后端, 派发, 设后端状态, 主体标识引用, 会话代际 } = deps;
  const 角色 = 主体.last_used_role;
  if (角色 === 'candidate') {
    // P6 Task 4：规则三路读取与简历/意向并行起跑，结算后统一扫 401；
    // 非 401 的规则失败按既有错误策略呈现（各资源 轻提示 / 交互抛第一个），
    // 与简历/意向互不牵连 —— 规则失败不回滚已提交的支持域。
    const p6Promise = 水合Agent规则角色数据(
      { 后端, 派发, 设后端状态, 主体标识引用, 会话代际 },
      角色,
      主体.subject_id,
      generation,
    );
    // 四个支持域并行 allSettled（简历/意向/隐私/附件库），各域独立提交。
    const 结果 = await Promise.allSettled([
      后端.读取简历(), 后端.读取意向(), 后端.读取隐私(), 后端.读取附件简历库(),
    ]);
    const p6结果 = await p6Promise;
    // 单一外层栅栏管整批结算：主体或代际任一已变，本轮一切结果整包丢弃。
    if (!是当前水合(deps, 主体.subject_id, generation)) return false;
    const 错误们: unknown[] = [];
    let 会话失效 = false;
    const 简历结果 = 结果[0];
    if (简历结果.status === 'fulfilled') {
      派发({ 型: '水合后端简历', 快照: 简历结果.value });
      设后端状态((旧) => ({ ...旧, 简历快照: 简历结果.value.服务端快照 }));
    } else {
      错误们.push(简历结果.reason);
      // 401 只标记会话失效（下面统一 清账号状态 收口），不逐域 轻提示 ——
      // 多个支持域一起 401 时不会弹一串重复的过期提示。
      if (是会话失效错误(简历结果.reason)) 会话失效 = true;
      else 轻提示(取后端错误文案(简历结果.reason));
    }
    const 意向结果 = 结果[1];
    if (意向结果.status === 'fulfilled') {
      派发({ 型: '水合后端意向', 快照: 意向结果.value });
      设后端状态((旧) => ({ ...旧, 意向快照: 意向结果.value.服务端 }));
    } else {
      错误们.push(意向结果.reason);
      if (是会话失效错误(意向结果.reason)) 会话失效 = true;
      else 轻提示(取后端错误文案(意向结果.reason));
    }
    const 隐私结果 = 结果[2];
    if (隐私结果.status === 'fulfilled') {
      派发({ 型: '水合后端隐私', 快照: 隐私结果.value });
      设后端状态((旧) => ({ ...旧, 隐私快照: 隐私结果.value.服务端 }));
    } else {
      错误们.push(隐私结果.reason);
      if (是会话失效错误(隐私结果.reason)) 会话失效 = true;
      else 轻提示(取后端错误文案(隐私结果.reason));
    }
    // P2 Task 3：附件库第四支持域 —— 只写 后端状态.附件简历库（不进页面 reducer，附件 UI 直读快照）；
    // 附件失败不撤销其它已提交支持域，也不改变 P6 阶段。
    const 附件结果 = 结果[3];
    if (附件结果.status === 'fulfilled') {
      设后端状态((旧) => ({ ...旧, 附件简历库: 附件结果.value }));
    } else {
      错误们.push(附件结果.reason);
      if (是会话失效错误(附件结果.reason)) 会话失效 = true;
      else 轻提示(取后端错误文案(附件结果.reason));
    }
    // P6 的拒绝并入同一错误策略（P6 内部已按 fence 提交/丢弃，这里只管呈现与会话）
    for (const 落点 of p6结果) {
      if (落点.status === 'rejected') {
        错误们.push(落点.reason);
        if (是会话失效错误(落点.reason)) 会话失效 = true;
        else 轻提示(取后端错误文案(落点.reason));
      }
    }
    // review-r2 R2-I-3：水合途中 401 → 统一登出清理，不把上个会话的快照/草稿留给已失效的登录态
    // review-r3 R3-I-2：收口到 清账号状态，支持域与 P6 规则域一起清，避免只清自己域留下别的域的快照；
    // deps 直传 —— P4/P7/P8 运行时引用随当前 401 一起复位。
    if (会话失效) {
      清账号状态(deps);
      return true;
    }
    if (交互 && 错误们.length > 0) throw 错误们[0];
  } else if (角色 === 'recruiter') {
    // P3 Task 2：切到招聘方先清候选侧隐私 —— 隐私快照不跨角色存活，
    // 必须在招聘方自有水合（组织 → owner Jobs）开始前落地。
    // P2 Task 3：候选侧附件库快照同口径清空 —— 招聘方不读附件，候选残留不跨角色存活。
    派发({ 型: '清后端隐私' });
    设后端状态((旧) => ({ ...旧, 隐私快照: null, 附件简历库: null }));
    // P1C：current relation 恢复值只在最新 Affiliations 返回后经 选择当前企业关系() 校验进 state
    const restoredId = deps.读取恢复企业关系编号(主体.subject_id);
    // P6 Task 4：规则三路读取先行起跑，与组织/岗位解耦；组织水合保持 P1C 固定顺序 ——
    // P0 修复 Task 1：owner Jobs 只在整条组织链成功之后读取 —— 组织链失败（401 或非 401）
    // 一律不发 Jobs，不在失败的组织事实上继续拼岗位盘。
    const p6Promise = 水合Agent规则角色数据(
      { 后端, 派发, 设后端状态, 主体标识引用, 会话代际 },
      角色,
      主体.subject_id,
      generation,
    );
    const [组织岗位落点] = await Promise.allSettled([
      (async (): Promise<{ sessionExpired: boolean; 岗位快照?: 页面岗位快照 }> => {
        const organizationResult = await 水合招聘方组织数据(
          deps,
          主体.subject_id,
          generation,
          restoredId,
        );
        if (organizationResult.sessionExpired) return organizationResult;
        return { sessionExpired: false, 岗位快照: await 后端.读取岗位() };
      })(),
    ]);
    const p6结果 = await p6Promise;
    // 组织水合的当前轮 401 已在 水合招聘方组织数据 内部完成清理（阶段回底座 + 清账号状态），
    // 即使本轮随后过时也照常早退 —— 不能把「已清理」误判成「过时丢弃」。
    if (
      组织岗位落点.status === 'fulfilled' &&
      组织岗位落点.value.sessionExpired
    ) return true;
    // 外层栅栏：主体或代际任一已变，本轮组织/岗位/P6 的结算整包丢弃 ——
    // 两条 401 扫描都在栅栏之后，迟到的旧会话 401 绝不登出新一代。
    if (!是当前水合(deps, 主体.subject_id, generation)) return false;
    if (组织岗位落点.status === 'rejected' && 是会话失效错误(组织岗位落点.reason)) {
      // review-r2 R2-I-3：recruiter 水合 401 同口径登出清理（R3-I-2 收口到 清账号状态）
      清账号状态(deps);
      return true;
    }
    if (p6结果.some(是会话失效落败)) {
      // P6 Task 4：规则读取的 401 与支持域共享同一登出收口 —— 会话已失效时清理优先于交互抛错
      清账号状态(deps);
      return true;
    }
    if (组织岗位落点.status === 'fulfilled') {
      const 岗位快照 = 组织岗位落点.value.岗位快照;
      // 过时轮的岗位不提交：栅栏不过（登出清理已清空主体标识 / 会话已换代）就整包丢弃
      if (岗位快照 && 是当前水合(deps, 主体.subject_id, generation)) {
        派发({ 型: '水合后端岗位', 快照: 岗位快照 });
        设后端状态((旧) => ({ ...旧, 岗位快照: 岗位快照.服务端 }));
      }
    } else if (交互) {
      // 交互模式：组织链或 Jobs 的非 401 失败原样抛回（helper 一律 reject，不吞非 401）
      throw 组织岗位落点.reason;
    } else {
      // mount 模式：组织链或 Jobs 的非 401 失败都在这里提示一次；helper 只记录阶段并 reject。
      轻提示(取后端错误文案(组织岗位落点.reason));
    }
    // P6 非 401 失败：既有错误策略（mount 只 轻提示；交互抛第一个），不回滚已提交的组织/岗位
    const p6错误们 = p6结果.flatMap((落点) => (落点.status === 'rejected' ? [落点.reason] : []));
    if (p6错误们.length > 0) {
      if (交互) throw p6错误们[0];
      for (const 错误 of p6错误们) 轻提示(取后端错误文案(错误));
    }
  }
  // last_used_role === null → 保持身份选择页，不水合
  return false;
}

export function 创建会话操作(deps: 后端操作依赖): 会话操作 {
  const {
    是后端, 后端, 派发, 设后端状态, 尝试引用, 主体标识引用, 会话代际, 读取恢复企业关系编号,
    P4范围代际, P4幂等意图, P4可见范围,
    P7范围代际, P7待定意图, P7可见收件箱, P7可见会话, P7已读位置,
    P8范围代际, P8账号可见, P8读取锁, P8待定意图,
  } = deps;
  /** 清账号状态 需要的子集（与 退出登录 共用，保持口径一致；含 P4/P7/P8 引用做三域清理） */
  const 账号清理依赖 = {
    派发, 设后端状态, 后端, 主体标识引用, 会话代际, P4范围代际, P4幂等意图, P4可见范围,
    P7范围代际, P7待定意图, P7可见收件箱, P7可见会话, P7已读位置,
    P8范围代际, P8账号可见, P8读取锁, P8待定意图,
  };

  return {
    async 开始手机登录(phone) {
      if (!是后端 || !后端) return;
      try {
        const 尝试 = await 后端.开始手机登录(phone);
        尝试引用.current = 尝试.attempt_id;
      } catch (错误) {
        // 发送失败时清除旧 attempt_id，防止 完成手机登录 用过期 attempt 提交
        尝试引用.current = null;
        throw 错误;
      }
    },
    async 完成手机登录(code) {
      if (!是后端 || !后端) return;
      await 后端.完成手机登录(尝试引用.current ?? '', code);
      let 主体: BFF主体;
      try {
        主体 = await 后端.读取主体();
      } catch (错误) {
        // review-r3 R3-I-3：读取主体 失败时不能落 已登录=true。
        // 401（会话刚建立就已过期）→ 统一账号清理，不设已登录；
        // 其他失败（网络等）→ 留未登录 + 轻提示，不顶着一个 null 主体当登录态。
        if (是会话失效错误(错误)) {
          清账号状态(账号清理依赖);
        } else {
          轻提示(取后端错误文案(错误));
          设后端状态((旧) => ({ ...旧, 已登录: false }));
        }
        return;
      }
      // review-r2 R2-I-4：主体 subject_id 变化时先清上个账号的草稿/快照/缓存，
      // 不让 A 的引导预填/意向草稿串到 B（同 Provider 实例的跨账号泄漏）。
      // 同 subject_id（如刷新后重新登录）保留草稿。
      if (主体标识引用.current !== null && 主体标识引用.current !== 主体.subject_id) {
        派发({ 型: '水合后端简历', 快照: 空简历快照 });
        派发({ 型: '水合后端意向', 快照: 空意向快照 });
        派发({ 型: '水合后端岗位', 快照: 空岗位快照 });
        // P3 Task 2：A 的隐私偏好同样不能串进 B
        派发({ 型: '清后端隐私' });
        派发({ 型: '清后端草稿' });
        // P1C：A 的组织权威事实（claim/公开缓存/current 选择）同样不能串进 B
        派发({ 型: '清后端组织状态' });
        // P6 Task 4：A 的规则域（原始字典/提案表/双端阶段/页面数组）同样不能串进 B
        派发({ 型: '清后端Agent规则' });
        // P4 Task 3：A 的 discovery raw 快照同样不能串进 B，双 Map 与可见范围一并复位
        // P2 Task 3：A 的附件库快照同样不能串进 B
        // P7 Task 2：A 的真人会话快照与待定发送意图 / 已读位置同样不能串进 B
        // P8 Task 3：A 的账号控制面快照（凭证/会话/导出）与待定意图同样不能串进 B
        设后端状态((旧) => ({
          ...重置Agent规则后端状态(旧),
          ...创建空P4发现状态(),
          ...创建空P7会话状态(),
          ...创建空P8控制面状态(),
          // P0 修复 Task 1：A 的招聘方水合阶段同样不能串进 B
          ...创建空招聘方组织水合状态(),
          简历快照: null,
          意向快照: {},
          岗位快照: {},
          隐私快照: null,
          附件简历库: null,
        }));
        清P4发现引用({ P4范围代际, P4幂等意图, P4可见范围 });
        清P7会话引用({ P7范围代际, P7待定意图, P7可见收件箱, P7可见会话, P7已读位置 });
        清P8控制面引用({ P8范围代际, P8账号可见, P8读取锁, P8待定意图 });
        后端.清空目录缓存();
      }
      主体标识引用.current = 主体.subject_id;
      // review-r2 R2-M-4：新会话建立，递增代际（让在飞的旧会话目录请求 401 成为 stale）
      会话代际.current += 1;
      设后端状态((旧) => ({ ...旧, 已登录: true, 主体 }));
    },
    async 微信登录() {
      if (!是后端 || !后端) return null;
      const 尝试 = await 后端.开始微信登录();
      return 尝试.next_action.redirect_url ?? null;
    },
    async 退出登录() {
      if (!是后端 || !后端) return;
      // 服务端会话可能已过期：退出登录请求返回 401 时，本地其实已经是登出态，
      // 必须照常清本地会话，否则两端的设置屏会捕获 reject 卡在已登录壳里出不来。
      // 401（或 invalid_session）视同成功；其他错误原样抛给屏去 轻提示。
      // 清空本地会话 = 统一 清账号状态 + 清登录尝试号（尝试引用 不在 清账号状态 子集内）。
      const 清空本地会话 = () => {
        清账号状态(账号清理依赖);
        尝试引用.current = null;
      };
      try {
        await 后端.退出登录();
      } catch (错误) {
        if (错误 instanceof BFF错误 && (错误.status === 401 || 错误.code === 'invalid_session')) {
          清空本地会话();
          return;
        }
        throw 错误;
      }
      清空本地会话();
    },
    async 切身份(to) {
      // review-r3 R3-I-4：先在后端落角色 + 记录当前角色，全部成功后再派发本地 切身份；
      // 旧实现先派发本地切身份，若 确保角色/记录当前角色 401 就会留下本地已切但会话未清的撕裂态。
      if (!是后端 || !后端) {
        派发({ 型: '切身份', 到: to });
        return;
      }
      const 角色: BFF角色 = to === '求职者' ? 'candidate' : 'recruiter';
      let 最新主体: BFF主体;
      try {
        await 后端.确保角色(角色);
        最新主体 = await 后端.记录当前角色(角色);
      } catch (错误) {
        // review-r3 R3-I-4：确保角色/记录当前角色 401 → 走统一账号清理（会话已失效），
        // 本地角色不切（派发 演示域 切身份 在 await 之后，401 时未执行），避免撕裂。
        if (是会话失效错误(错误)) {
          清账号状态(账号清理依赖);
        }
        throw 错误;
      }
      // 后端落角色成功后再派发本地 UI 落点
      派发({ 型: '切身份', 到: to });
      设后端状态((旧) => ({ ...旧, 主体: 最新主体 }));
      // review-r1 P1-5：切身份前清掉上一个角色的 Backend 草稿（引导预填 + 意向草稿），
      // 否则候选选的目录引用会串到招聘方账号（同 Provider 实例的跨账号泄漏）。
      派发({ 型: '清后端草稿' });
      // P6 Task 4：切角色 = 角色转移 —— 清掉上个角色的规则域（原始字典 + 页面数组 +
      // 双端阶段回 未开始）并递增会话代际，上个角色还在飞的水合响应按旧代际整包丢弃，
      // 阶段不可能粘住 进行中|成功；目标角色从干净底座重跑完整水合。
      派发({ 型: '清后端Agent规则' });
      // P4 Task 3：切角色同为角色转移 —— discovery raw 快照回空底座，双 Map 与可见范围复位，
      // 上个角色还在飞的 P4 读写按新会话代际整包作废。
      // P2 Task 3：切角色 = 数据转移，候选侧附件库快照随 P6 底座一并清空。
      // P7 Task 2：切角色同样是主体基串变化 —— 真人会话快照回空底座，五个引用一并复位。
      设后端状态((旧) => ({
        ...重置Agent规则后端状态(旧),
        ...创建空P4发现状态(),
        ...创建空P7会话状态(),
        // P0 修复 Task 1：切角色是角色转移 —— 招聘方两个水合阶段回干净底座，
        // 目标角色从 未开始 重跑完整链路，阶段不粘住上个角色的 缺失/失败
        ...创建空招聘方组织水合状态(),
        附件简历库: null,
      }));
      清P4发现引用({ P4范围代际, P4幂等意图, P4可见范围 });
      清P7会话引用({ P7范围代际, P7待定意图, P7可见收件箱, P7可见会话, P7已读位置 });
      // P8 Task 3：切角色 ≠ P8 会话边界 —— 账号快照按 subject 隔离，同主体切角色保留
      // 已确认快照；但范围代际递增 + 读锁/待定意图清空，上个角色的在飞读写与
      // 未收口命令按新代整包作废（P8 的 Provider 清理键只认主体，不含角色）。
      清P8控制面引用({ P8范围代际, P8账号可见, P8读取锁, P8待定意图 });
      会话代际.current += 1;
      // 切身份后水合目标角色的支持域：mount-init 只按上次角色水合，
      // 不补这一步，候选切到招聘方会顶着一个空岗位盘，招聘方切到候选看到的是空简历/意向。
      // 交互模式：水合失败直接抛出，让 选身份.tsx catch 显示 轻提示并留在原地，
      // 不导航进一个空壳（支持域没水合成功，进去也是空盘）。
      // review-r2 R2-I-3：水合 401 时 水合角色数据 内部已走登出清理并返回 会话失效=true，
      // 不再抛出（会话已失效，用户需要重新登录，抛出反而让 选身份 屏显示错误却留在原地）。
      // P1C：切角色仍是同一个登录会话；Task 4 起切角色也递增 generation（见上），
      // 捕获递增后的当前值传入水合 —— 目录 401 被误判成旧会话的代价可接受：
      // 会话真过期时下一个请求仍会 401 并走统一清理。
      主体标识引用.current = 最新主体.subject_id;
      const 本次代际 = 会话代际.current;
      // P7/P8 引用随行：水合途中撞上当前轮 401 时，清账号状态 一并复位全部运行时引用
      const 会话失效 = await 水合角色数据({
        后端, 派发, 设后端状态, 主体标识引用, 会话代际, 读取恢复企业关系编号,
        P4范围代际, P4幂等意图, P4可见范围,
        P7范围代际, P7待定意图, P7可见收件箱, P7可见会话, P7已读位置,
        P8范围代际, P8账号可见, P8读取锁, P8待定意图,
      }, 最新主体, true, 本次代际);
      if (会话失效) {
        // review-r3 R3-I-2：清账号状态 已在 水合角色数据 内部清完（含主体标识 + 会话代际）
        return;
      }
    },
    /**
     * P0 修复 Task 2：招聘方数据的显式重试（恢复面的「重试」按钮）。
     * 只重跑招聘方自有的两步 —— 组织链（profile → affiliations → current organization）
     * 成功后才读一次 owner jobs，不重跑 P6 规则等无关角色域，也没有互斥锁。
     * 初始化 先落 进行中、收口时回 完成：现有加载屏在整个重试期间保持可见。
     * 401 → 统一 清账号状态；其余失败 轻提示 后原样 reject（组织链的失败阶段由
     * 水合招聘方组织数据 记录，调用方据此回到恢复面）。接口失败绝不回退 Mock。
     */
    async 重新水合招聘方数据() {
      if (!是后端 || !后端) return;
      const subject = deps.后端状态引用.current.主体;
      if (!subject || subject.last_used_role !== 'recruiter') {
        throw new 客户端校验错误('session', '当前不是招聘方会话');
      }
      const subjectId = subject.subject_id;
      const generation = 会话代际.current;
      设后端状态((旧) => ({ ...旧, 初始化: '进行中' }));
      try {
        const restoredId = 读取恢复企业关系编号(subjectId);
        const result = await 水合招聘方组织数据({ ...deps, 后端 }, subjectId, generation, restoredId);
        // 401 已在组织链内部收口（清账号状态 自己把 初始化 落回 完成）
        if (result.sessionExpired) return;
        const 快照 = await 后端.读取岗位();
        // 岗位响应同样过 subject + generation fence：过时响应不提交
        if (主体标识引用.current !== subjectId || 会话代际.current !== generation) return;
        派发({ 型: '水合后端岗位', 快照 });
        设后端状态((旧) => ({ ...旧, 初始化: '完成', 岗位快照: 快照.服务端 }));
      } catch (错误) {
        if (错误 instanceof BFF错误 && 错误.status === 401) {
          清账号状态(账号清理依赖);
        } else if (主体标识引用.current === subjectId && 会话代际.current === generation) {
          设后端状态((旧) => ({ ...旧, 初始化: '完成' }));
          轻提示(取后端错误文案(错误));
        }
        throw 错误;
      }
    },
  };
}