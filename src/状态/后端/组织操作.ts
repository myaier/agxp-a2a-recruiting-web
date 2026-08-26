// 后端组织域操作：固定水合（profile → affiliations → 校验/选择 current → 公开企业）
// 与页面会调用的组织操作方法。stale 响应守卫（subject fence + 会话代际）在核心实现内部，
// 不留给调用方；任一 401 走统一 清账号状态；接口失败绝不回退 Mock。

import { BFF错误, 取后端错误文案 } from '../../数据/HTTP客户端';
import type {
  BFF企业档案,
  BFF企业档案替换,
  BFF公开企业,
} from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { 可用企业关系, 选择当前企业关系, 从BFF企业档案, 转BFF企业档案替换 } from '../../数据/组织映射';
import { 轻提示 } from '../../组件/轻提示';
import type { 后端操作依赖, 组织操作 } from './类型';
import { 清账号状态 } from './会话操作';

export type 组织水合依赖 = Pick<后端操作依赖,
  '后端' | '派发' | '设后端状态' | '主体标识引用' | '会话代际'> &
  { 后端: HTTP招聘数据源 };

/**
 * 固定顺序水合 Organization 权威事实：
 *   读取招聘方档案 → 读取我的企业关系 → 选择当前企业关系(affiliations, restoredId)
 *   → 有 current 时读取一次公开企业（其 profile 同时成为唯一 企业档案快照）。
 * 每步响应到达后都过 subject + generation fence；过时响应直接丢弃（不派发）。
 * 401 → 统一 清账号状态 并返回 会话失效=true；非 401：mount-init 只 轻提示，交互模式抛回 UI。
 * admin request 列表不进登录链（企业实名认证 屏显式调用 读取企业管理员申请()）。
 */
export async function 水合招聘方组织数据(
  deps: 组织水合依赖,
  subjectId: string,
  generation: number,
  restoredAffiliationId: string | null,
  interactive: boolean,
): Promise<{ sessionExpired: boolean }> {
  const 仍有效 = () => deps.主体标识引用.current === subjectId && deps.会话代际.current === generation;
  try {
    const profile = await deps.后端.读取招聘方档案();
    if (!仍有效()) return { sessionExpired: false };
    deps.派发({ 型: '水合招聘方档案', 档案: profile });
    const affiliations = await deps.后端.读取我的企业关系();
    if (!仍有效()) return { sessionExpired: false };
    const currentId = 选择当前企业关系(affiliations, restoredAffiliationId);
    deps.派发({ 型: '水合企业关系', 关系: affiliations, 当前编号: currentId });
    if (currentId) {
      const relation = affiliations.find((item) => item.affiliation_id === currentId)!;
      const organization = await deps.后端.读取公开企业(relation.organization_id);
      if (!仍有效()) return { sessionExpired: false };
      const { profile: organizationProfile, ...identity } = organization;
      deps.派发({ 型: '水合当前企业', 身份: identity, 档案: organizationProfile });
    }
    return { sessionExpired: false };
  } catch (error) {
    if (error instanceof BFF错误 && error.status === 401) {
      清账号状态(deps);
      return { sessionExpired: true };
    }
    if (interactive) throw error;
    轻提示(取后端错误文案(error));
    return { sessionExpired: false };
  }
}

/** 409 version_conflict / 503 operation_outcome_unknown：并发或结果不确定的写入。 */
function 是并发或不确定写入(error: unknown): error is BFF错误 {
  return error instanceof BFF错误 &&
    ((error.status === 409 && error.code === 'version_conflict') ||
     (error.status === 503 && error.code === 'operation_outcome_unknown'));
}

async function 重读企业档案(
  deps: 后端操作依赖, organizationId: string,
): Promise<BFF企业档案 | null> {
  const profile = await deps.后端!.读取企业档案(organizationId);
  const state = deps.状态引用.current;
  const relation = state.企业关系列表.find((item) => item.affiliation_id === state.当前企业关系编号);
  if (relation?.organization_id !== organizationId || state.当前企业身份?.organization_id !== organizationId) return null;
  deps.派发({ 型: '水合当前企业', 身份: state.当前企业身份, 档案: profile });
  deps.派发({ 型: '缓存公开企业', 企业: { ...state.当前企业身份, profile } });
  return profile;
}

function 企业档案匹配替换(profile: BFF企业档案, expected: BFF企业档案替换): boolean {
  try {
    const actual = 转BFF企业档案替换(从BFF企业档案(profile), profile);
    return JSON.stringify(actual) === JSON.stringify(expected);
  } catch {
    return false; // 确认比较本身失败也不能吞掉原始 503
  }
}

export function 创建组织操作(deps: 后端操作依赖): 组织操作 {
  const { 是后端, 后端, 派发, 状态引用 } = deps;

  /** 统一组织域 401：走 清账号状态（含 清后端组织状态，但不触 Mock fixture）。 */
  function 处理组织401(error: unknown): void {
    if (error instanceof BFF错误 && error.status === 401) 清账号状态(deps);
  }

  return {
    async 选择企业关系(id) {
      if (!是后端 || !后端) return;
      if (id === null) {
        派发({ 型: '选择当前企业关系', 编号: null });
        return;
      }
      const relation = 状态引用.current.企业关系列表.find((item) => item.affiliation_id === id);
      if (!relation || !可用企业关系(relation)) throw new Error('企业关系已不可用');
      // 先清旧 snapshot（reducer 置空 当前企业身份/企业档案快照），再按 canonical ID 重读
      派发({ 型: '选择当前企业关系', 编号: id });
      let organization: BFF公开企业;
      try {
        organization = await 后端.读取公开企业(relation.organization_id);
      } catch (error) {
        if (error instanceof BFF错误 && error.status === 401) 清账号状态(deps);
        else if (error instanceof BFF错误 &&
          (error.code === 'organization_suspended' || error.code === 'organization_not_found')) {
          派发({ 型: '标记公开企业不可用', 编号: relation.organization_id });
          派发({ 型: '选择当前企业关系', 编号: null });
        }
        throw error;
      }
      // 快速二次选择时用当前 state ref 丢弃先前响应
      if (状态引用.current.当前企业关系编号 !== id) return;
      const { profile, ...identity } = organization;
      派发({ 型: '水合当前企业', 身份: identity, 档案: profile });
    },

    保存未认证公司声明(company) {
      派发({ 型: '存未认证公司声明', 公司: company });
    },

    async 保存招聘方档案(patch) {
      if (!是后端 || !后端) return;
      const before = 状态引用.current.招聘方档案;
      if (!before) throw new Error('招聘方档案尚未水合');
      try {
        const next = await 后端.保存招聘方档案(patch, before.revision);
        派发({ 型: '水合招聘方档案', 档案: next });
      } catch (error) {
        处理组织401(error);
        throw error;
      }
    },

    async 读取企业管理员申请() {
      if (!是后端 || !后端) return;
      try {
        const 申请 = await 后端.读取企业管理员申请();
        派发({ 型: '水合企业管理员申请', 申请 });
      } catch (error) {
        处理组织401(error);
        throw error;
      }
    },

    async 创建企业管理员申请(metadata, evidence) {
      if (!是后端 || !后端) return;
      try {
        await 后端.创建企业管理员申请(metadata, evidence);
        const 申请 = await 后端.读取企业管理员申请();
        派发({ 型: '水合企业管理员申请', 申请 });
      } catch (error) {
        处理组织401(error);
        throw error;
      }
    },

    async 取消企业管理员申请(id) {
      if (!是后端 || !后端) return;
      const 原始 = 状态引用.current.企业管理员申请列表.find((项) => 项.request_id === id);
      if (!原始) return;
      try {
        await 后端.取消企业管理员申请(id, 原始.revision);
        const 申请 = await 后端.读取企业管理员申请();
        派发({ 型: '水合企业管理员申请', 申请 });
      } catch (error) {
        处理组织401(error);
        throw error;
      }
    },

    async 接受企业邀请(token) {
      // raw invitation token 只进入本操作，从不进入任何 reducer action
      if (!是后端 || !后端) return;
      try {
        await 后端.接受企业邀请(token);
        const affiliations = await 后端.读取我的企业关系();
        const currentId = 选择当前企业关系(affiliations, 状态引用.current.当前企业关系编号);
        派发({ 型: '水合企业关系', 关系: affiliations, 当前编号: currentId });
        if (currentId) {
          const relation = affiliations.find((item) => item.affiliation_id === currentId)!;
          const organization = await 后端.读取公开企业(relation.organization_id);
          const { profile, ...identity } = organization;
          派发({ 型: '水合当前企业', 身份: identity, 档案: profile });
        }
      } catch (error) {
        处理组织401(error);
        throw error;
      }
    },

    async 替换招聘方头像(file) {
      if (!是后端 || !后端) return;
      const before = 状态引用.current.招聘方档案;
      if (!before) throw new Error('招聘方档案尚未水合');
      try {
        const after = await 后端.替换招聘方头像(file, before.revision);
        派发({ 型: '水合招聘方档案', 档案: after });
      } catch (error) {
        // 409/503 重读恢复由 Task 4 接入；本 Task 只保证 401 统一清理 + 原样抛出
        处理组织401(error);
        throw error;
      }
    },

    async 保存企业档案(draft) {
      if (!是后端 || !后端) return;
      const state = 状态引用.current;
      const relation = state.企业关系列表.find((item) => item.affiliation_id === state.当前企业关系编号);
      if (!relation || state.当前企业身份?.organization_id !== relation.organization_id || !state.企业档案快照) {
        throw new Error('当前企业档案尚未水合');
      }
      const before = state.企业档案快照;
      const body = 转BFF企业档案替换(draft, before);
      try {
        const next = await 后端.替换企业档案(
          relation.organization_id, body, before.revision,
        );
        派发({ 型: '水合当前企业', 身份: state.当前企业身份, 档案: next });
        // 复用 缓存公开企业 覆盖同 ID 旧 public cache，避免公共页首帧显示旧 profile
        派发({ 型: '缓存公开企业', 企业: { ...state.当前企业身份, profile: next } });
      } catch (error) {
        if (error instanceof BFF错误 && error.status === 401) {
          清账号状态(deps);
        } else if (是并发或不确定写入(error)) {
          let current: BFF企业档案 | null;
          try {
            current = await 重读企业档案(deps, relation.organization_id);
          } catch {
            throw error; // 重读失败不能替换原始 409/503
          }
          if (error.status === 503 && current && 企业档案匹配替换(current, body)) return;
        }
        throw error;
      }
    },

    async 上传并发布企业媒体(_purpose, _file) {
      // 两步媒体协议（upload receipt → PATCH full profile）由 Task 4 实现并配测试；
      // 本 Task 先冻结方法表，不伪造成功。
      throw new Error('企业媒体两步发布协议尚未接入');
    },

    async 移除企业媒体(_purpose, _mediaId) {
      throw new Error('企业媒体两步发布协议尚未接入');
    },

    async 读取公开企业(id) {
      if (!是后端 || !后端) return;
      try {
        const organization = await 后端.读取公开企业(id);
        派发({ 型: '缓存公开企业', 企业: organization });
      } catch (error) {
        if (error instanceof BFF错误 && error.status === 401) {
          清账号状态(deps);
        } else if (error instanceof BFF错误 &&
          (error.code === 'organization_suspended' || error.code === 'organization_not_found')) {
          派发({ 型: '标记公开企业不可用', 编号: id });
          const state = 状态引用.current;
          const current = state.企业关系列表.find((item) => item.affiliation_id === state.当前企业关系编号);
          if (current?.organization_id === id) 派发({ 型: '选择当前企业关系', 编号: null });
        }
        throw error;
      }
    },
  };
}
