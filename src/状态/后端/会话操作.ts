// 后端会话域操作：登录 / 退出 / 切身份 + 统一账号清理 + 角色水合。
// 从 应用状态提供者 的 useMemo 操作体按真实后端 owner 拆出，行为逐字保持：
// 401 / 409 / 503 / stale response / revision / 主体标识变化清理 / 会话代际守卫全部原样。
// 不改变加载、错误、stale response guard、revision 或水合时序；接口失败绝不回退 Mock。

import { BFF错误, 取后端错误文案 } from '../../数据/HTTP客户端';
import type { BFF主体, BFF角色 } from '../../数据/BFF契约';
import type { 页面简历快照, 页面意向快照, 页面岗位快照 } from '../../数据/招聘数据源类型';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { 轻提示 } from '../../组件/轻提示';
import type { 后端操作依赖, 会话操作 } from './类型';

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

/**
 * review-r3 R3-I-2：统一的账号状态清理——把所有 401 路径（资源写 / 目录 facade / 水合 / 登录读主体）
 * 收口到这里，避免某个 401 只清自己的域而把别的域的快照/草稿留给下一个登录。
 *
 * 清空内容：简历/意向/岗位三个支持域快照 + 后端状态登出 + 目录缓存 + Backend 专属草稿
 * （引导预填 + 意向草稿）+ 主体标识 + 会话代际递增（让在飞的目录 401 成为 stale）。
 * 409 的「重读权威资源」语义不经过这里——409 不清会话，只让该域落回服务端最新值。
 */
export function 清账号状态(
  deps: Pick<后端操作依赖, '派发' | '设后端状态' | '后端' | '主体标识引用' | '会话代际'>,
): void {
  const { 派发, 设后端状态, 后端, 主体标识引用, 会话代际 } = deps;
  派发({ 型: '水合后端简历', 快照: 空简历快照 });
  派发({ 型: '水合后端意向', 快照: 空意向快照 });
  派发({ 型: '水合后端岗位', 快照: 空岗位快照 });
  派发({ 型: '清后端草稿' });
  设后端状态((旧) => ({
    ...旧,
    初始化: '完成',
    已登录: false,
    主体: null,
    简历快照: null,
    意向快照: {},
    岗位快照: {},
  }));
  后端?.清空目录缓存();
  主体标识引用.current = null;
  会话代际.current += 1;
}

/**
 * 按主体.last_used_role 水合支持域：
 *   candidate → 简历 + 意向（并行读取，各自独立派发）；recruiter → 岗位；null → 保持身份选择页不水合。
 * mount-init（交互=false）：candidate 两条并行 allSettled，任一 rejected 只 轻提示 该资源，不抛出 —— 初始化仍要落成「完成」。
 *   review-r2 R2-I-3：若任一 rejected 是 401（会话在水合途中过期），走统一登出清理并返回 会话失效=true，
 *   mount-init 据此不落 已登录=true。
 * 切身份（交互=true）：任一 rejected 直接抛出第一个错误 —— 让 选身份.tsx catch 显示 轻提示并留在原地，
 *   不导航进一个空壳（支持域没水合成功，进去也是空盘）。
 * Task 2：不再在初始化/切身份时预取目录。Task 7 起岗位写入用选择器保存的引用，目录预取彻底删除。
 * @returns 会话失效 —— true 表示水合途中遇到 401 并已执行登出清理，调用方不应再落 已登录=true
 */
export async function 水合角色数据(
  deps: Pick<后端操作依赖, '后端' | '派发' | '设后端状态' | '主体标识引用' | '会话代际'> & { 后端: HTTP招聘数据源 },
  主体: BFF主体,
  交互: boolean,
): Promise<boolean> {
  const { 后端, 派发, 设后端状态, 主体标识引用, 会话代际 } = deps;
  const 角色 = 主体.last_used_role;
  if (角色 === 'candidate') {
    const 结果 = await Promise.allSettled([后端.读取简历(), 后端.读取意向()]);
    const 错误们: unknown[] = [];
    let 会话失效 = false;
    const 简历结果 = 结果[0];
    if (简历结果.status === 'fulfilled') {
      派发({ 型: '水合后端简历', 快照: 简历结果.value });
      设后端状态((旧) => ({ ...旧, 简历快照: 简历结果.value.服务端快照 }));
    } else {
      错误们.push(简历结果.reason);
      if (是会话失效错误(简历结果.reason)) 会话失效 = true;
      轻提示(取后端错误文案(简历结果.reason));
    }
    const 意向结果 = 结果[1];
    if (意向结果.status === 'fulfilled') {
      派发({ 型: '水合后端意向', 快照: 意向结果.value });
      设后端状态((旧) => ({ ...旧, 意向快照: 意向结果.value.服务端 }));
    } else {
      错误们.push(意向结果.reason);
      if (是会话失效错误(意向结果.reason)) 会话失效 = true;
      轻提示(取后端错误文案(意向结果.reason));
    }
    // review-r2 R2-I-3：水合途中 401 → 统一登出清理，不把上个会话的快照/草稿留给已失效的登录态
    // review-r3 R3-I-2：收口到 清账号状态，三个支持域一起清，避免只清自己域留下别的域的快照
    if (会话失效) {
      清账号状态({ 派发, 设后端状态, 后端, 主体标识引用, 会话代际 });
      return true;
    }
    if (交互 && 错误们.length > 0) throw 错误们[0];
  } else if (角色 === 'recruiter') {
    try {
      const 岗位快照 = await 后端.读取岗位();
      派发({ 型: '水合后端岗位', 快照: 岗位快照 });
      设后端状态((旧) => ({ ...旧, 岗位快照: 岗位快照.服务端 }));
    } catch (错误) {
      if (是会话失效错误(错误)) {
        // review-r2 R2-I-3：recruiter 水合 401 同口径登出清理（R3-I-2 收口到 清账号状态）
        清账号状态({ 派发, 设后端状态, 后端, 主体标识引用, 会话代际 });
        return true;
      }
      if (交互) throw 错误;
      轻提示(取后端错误文案(错误));
    }
  }
  // last_used_role === null → 保持身份选择页，不水合
  return false;
}

export function 创建会话操作(deps: 后端操作依赖): 会话操作 {
  const { 是后端, 后端, 派发, 设后端状态, 尝试引用, 主体标识引用, 会话代际 } = deps;
  /** 清账号状态 需要的子集（与 退出登录 共用，保持口径一致） */
  const 账号清理依赖 = { 派发, 设后端状态, 后端, 主体标识引用, 会话代际 };

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
        派发({ 型: '清后端草稿' });
        设后端状态((旧) => ({
          ...旧,
          简历快照: null,
          意向快照: {},
          岗位快照: {},
        }));
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
      // 切身份后水合目标角色的支持域：mount-init 只按上次角色水合，
      // 不补这一步，候选切到招聘方会顶着一个空岗位盘，招聘方切到候选看到的是空简历/意向。
      // 交互模式：水合失败直接抛出，让 选身份.tsx catch 显示 轻提示并留在原地，
      // 不导航进一个空壳（支持域没水合成功，进去也是空盘）。
      // review-r2 R2-I-3：水合 401 时 水合角色数据 内部已走登出清理并返回 会话失效=true，
      // 不再抛出（会话已失效，用户需要重新登录，抛出反而让 选身份 屏显示错误却留在原地）。
      const 会话失效 = await 水合角色数据({ 后端, 派发, 设后端状态, 主体标识引用, 会话代际 }, 最新主体, true);
      if (会话失效) {
        // review-r3 R3-I-2：清账号状态 已在 水合角色数据 内部清完（含主体标识 + 会话代际）
        return;
      }
    },
  };
}