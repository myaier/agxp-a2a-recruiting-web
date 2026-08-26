// 后端组织域操作：固定水合（profile → affiliations → 校验/选择 current → 公开企业）
// 与页面会调用的组织操作方法。stale 响应守卫（subject fence + 会话代际）在核心实现内部，
// 不留给调用方；任一 401 走统一 清账号状态；接口失败绝不回退 Mock。

import { BFF错误, 取后端错误文案 } from '../../数据/HTTP客户端';
import type {
  BFF企业档案,
  BFF企业档案替换,
  BFF企业媒体,
  BFF企业媒体用途,
  BFF公开企业,
  BFF招聘方档案,
} from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import type { 资料形 } from '../../数据/公司主页资料';
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

/** 409 version_conflict / 503 operation_outcome_unknown：并发或结果不确定的写入。
 *  头像替换与企业档案/媒体 CAS 共用这一个判定，不在各方法里复制谓词。 */
export function 是并发或不确定写入(error: unknown): error is BFF错误 {
  return error instanceof BFF错误 &&
    ((error.status === 409 && error.code === 'version_conflict') ||
     (error.status === 503 && error.code === 'operation_outcome_unknown'));
}

async function 重读企业档案(
  deps: 后端操作依赖, organizationId: string,
): Promise<BFF企业档案 | null> {
  const profile = await deps.后端!.读取企业档案(organizationId);
  return 发布档案收口(deps, organizationId, profile) ? profile : null;
}

/** 写成功后以**最新 state**派发快照：current 已被 401 清理或切到别的企业时静默跳过 ——
 *  写已落库（组织号固定），但不能用 pre-await 身份派发，否则清空的组织切片被复活、
 *  public cache 拼出错误键（镜像 选择企业关系 的 `当前企业关系编号 !== id` 守卫）。 */
function 发布档案收口(
  deps: 后端操作依赖, organizationId: string, next: BFF企业档案,
): boolean {
  const now = deps.状态引用.current;
  const relation = now.企业关系列表.find((item) => item.affiliation_id === now.当前企业关系编号);
  if (relation?.organization_id !== organizationId || now.当前企业身份?.organization_id !== organizationId) {
    return false;
  }
  deps.派发({ 型: '水合当前企业', 身份: now.当前企业身份, 档案: next });
  // 复用 缓存公开企业 覆盖同 ID 旧 public cache，避免公共页首帧显示旧 profile
  deps.派发({ 型: '缓存公开企业', 企业: { ...now.当前企业身份!, profile: next } });
  return true;
}

function 企业档案匹配替换(profile: BFF企业档案, expected: BFF企业档案替换): boolean {
  try {
    const actual = 转BFF企业档案替换(从BFF企业档案(profile), profile);
    return JSON.stringify(actual) === JSON.stringify(expected);
  } catch {
    return false; // 确认比较本身失败也不能吞掉原始 503
  }
}

/** 403 权限/状态类组织错误：重读 affiliations 切只读，或标记不可用并清 current selection。
 *  恢复动作自身的失败不顶替原始错误。 */
async function 处理组织权限变化(
  deps: 后端操作依赖, organizationId: string, error: BFF错误,
): Promise<void> {
  try {
    if (error.code === 'organization_admin_required') {
      const affiliations = await deps.后端!.读取我的企业关系();
      const currentId = 选择当前企业关系(affiliations, deps.状态引用.current.当前企业关系编号);
      deps.派发({ 型: '水合企业关系', 关系: affiliations, 当前编号: currentId });
    } else if (error.code === 'organization_suspended' || error.code === 'organization_not_found') {
      deps.派发({ 型: '标记公开企业不可用', 编号: organizationId });
      const now = deps.状态引用.current;
      const current = now.企业关系列表.find((item) => item.affiliation_id === now.当前企业关系编号);
      if (current?.organization_id === organizationId) deps.派发({ 型: '选择当前企业关系', 编号: null });
    }
  } catch {
    // 恢复失败不吞原始错误
  }
}

function 是组织权限变化(error: unknown): error is BFF错误 {
  return error instanceof BFF错误 && (
    error.code === 'organization_admin_required' ||
    error.code === 'organization_suspended' ||
    error.code === 'organization_not_found'
  );
}

// ── 两步媒体协议的纯映射：媒体只在「draft 的权威媒体对象」里进/出，URL 一律来自 DTO ──

function 并入媒体(draft: 资料形, purpose: BFF企业媒体用途, media: BFF企业媒体): 资料形 {
  switch (purpose) {
    case 'organization_logo':
      return { ...draft, LOGO媒体: media };
    case 'office_photo':
      return {
        ...draft,
        实景媒体: [...(draft.实景媒体 ?? []), media],
        实景照片: [...(draft.实景照片 ?? []), media.url],
      };
    case 'company_photo':
      return {
        ...draft,
        公司媒体: [...(draft.公司媒体 ?? []), media],
        公司照片: [...(draft.公司照片 ?? []), media.url],
      };
  }
}

function 摘除媒体(draft: 资料形, purpose: BFF企业媒体用途, mediaId: string): 资料形 {
  switch (purpose) {
    case 'organization_logo':
      return { ...draft, LOGO媒体: draft.LOGO媒体?.media_id === mediaId ? null : draft.LOGO媒体 };
    case 'office_photo': {
      const 余 = (draft.实景媒体 ?? []).filter((媒) => 媒.media_id !== mediaId);
      return { ...draft, 实景媒体: 余, 实景照片: 余.map((媒) => 媒.url) };
    }
    case 'company_photo': {
      const 余 = (draft.公司媒体 ?? []).filter((媒) => 媒.media_id !== mediaId);
      return { ...draft, 公司媒体: 余, 公司照片: 余.map((媒) => 媒.url) };
    }
  }
}

function 媒体仍被引用(profile: BFF企业档案, purpose: BFF企业媒体用途, mediaId: string): boolean {
  switch (purpose) {
    case 'organization_logo': return profile.logo?.media_id === mediaId;
    case 'office_photo': return profile.office_media.some((媒) => 媒.media_id === mediaId);
    case 'company_photo': return profile.company_media.some((媒) => 媒.media_id === mediaId);
  }
}

/** 上传已成功、但 PATCH 发布未完成时随错误抛回的脱离媒体收据：
 *  页面据此给用户「放弃（best-effort DELETE）或重试」的选择，operation 不代删。 */
export interface 企业媒体脱离错误 extends BFF错误 {
  脱离媒体?: { purpose: BFF企业媒体用途; media_id: string };
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
        // 一次原子替换：multipart + If-Match 当前 revision，响应即权威档案
        const after = await 后端.替换招聘方头像(file, before.revision);
        派发({ 型: '水合招聘方档案', 档案: after });
      } catch (error) {
        if (error instanceof BFF错误 && error.status === 401) {
          清账号状态(deps);
        } else if (是并发或不确定写入(error)) {
          // 409/503：重读权威档案覆盖本地（页面保留 file/预览自行重试）；重读失败或
          // 主体已换都不能确认，只能把原始错误抛回 UI，不用别的错误顶替、不自动重发
          const 起始主体 = deps.主体标识引用.current;
          let current: BFF招聘方档案;
          try {
            const profile = await 后端.读取招聘方档案();
            if (deps.主体标识引用.current !== 起始主体) throw error;
            派发({ 型: '水合招聘方档案', 档案: profile });
            current = profile;
          } catch {
            throw error; // 重读失败不能替换原始 409/503
          }
          // 503 只有 avatar_url 与 revision 都已前进时才视作 confirmed success
          if (error.status === 503 &&
              current.revision !== before.revision && current.avatar_url !== before.avatar_url) {
            return;
          }
        }
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
        发布档案收口(deps, relation.organization_id, next);
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

    async 上传并发布企业媒体(purpose, file) {
      if (!是后端 || !后端) return;
      const state = 状态引用.current;
      const relation = state.企业关系列表.find((item) => item.affiliation_id === state.当前企业关系编号);
      if (!relation || state.当前企业身份?.organization_id !== relation.organization_id || !state.企业档案快照) {
        throw new Error('当前企业档案尚未水合');
      }
      const before = state.企业档案快照;
      // 第一步：POST media(metadata+media, 幂等键) → media_id/url（幂等重试由数据源负责）
      let media: BFF企业媒体;
      try {
        media = await 后端.上传企业媒体(relation.organization_id, purpose, file);
      } catch (error) {
        if (error instanceof BFF错误 && error.status === 401) 清账号状态(deps);
        throw error; // 上传没成功：没有 PATCH、没有脱离收据
      }
      // 第二步：PATCH full profile（If-Match 当前 revision，加入 media_id），响应用作新快照
      const body = 转BFF企业档案替换(并入媒体(从BFF企业档案(before), purpose, media), before);
      try {
        const next = await 后端.替换企业档案(relation.organization_id, body, before.revision);
        发布档案收口(deps, relation.organization_id, next);
      } catch (error) {
        if (error instanceof BFF错误 && error.status === 401) {
          清账号状态(deps);
        } else if (是组织权限变化(error)) {
          await 处理组织权限变化(deps, relation.organization_id, error);
        } else if (是并发或不确定写入(error)) {
          let current: BFF企业档案 | null = null;
          try {
            current = await 重读企业档案(deps, relation.organization_id);
          } catch {
            // 重读失败不能替换原始 409/503
          }
          if (error.status === 503 && current && 企业档案匹配替换(current, body)) return;
        }
        if (error instanceof BFF错误) {
          // 发布未完成：媒体已上传但未被引用 —— 收据随错误抛回，放弃或重试由用户决定
          (error as 企业媒体脱离错误).脱离媒体 = { purpose, media_id: media.media_id };
        }
        throw error;
      }
    },

    async 移除企业媒体(purpose, mediaId) {
      if (!是后端 || !后端) return;
      const state = 状态引用.current;
      const relation = state.企业关系列表.find((item) => item.affiliation_id === state.当前企业关系编号);
      if (!relation || state.当前企业身份?.organization_id !== relation.organization_id || !state.企业档案快照) {
        throw new Error('当前企业档案尚未水合');
      }
      const before = state.企业档案快照;
      /** DELETE 阶段：204 正常完成；media_in_use 重读权威档案、不伪造删除 */
      const 删除已脱离 = async () => {
        try {
          await 后端.删除企业媒体(relation.organization_id, mediaId);
        } catch (error) {
          if (error instanceof BFF错误 && error.status === 401) {
            清账号状态(deps);
          } else if (error instanceof BFF错误 && error.code === 'media_in_use') {
            try {
              await 重读企业档案(deps, relation.organization_id);
            } catch {
              // 重读失败不能替换原始 media_in_use
            }
          }
          throw error;
        }
      };
      // 快照里仍被本槽位引用 → 先 PATCH 去引用（full profile, If-Match）再 DELETE；
      // 已不被引用（放弃收据 / 他端已移除）→ 直接 DELETE，不发多余 PATCH
      if (媒体仍被引用(before, purpose, mediaId)) {
        const body = 转BFF企业档案替换(摘除媒体(从BFF企业档案(before), purpose, mediaId), before);
        try {
          const next = await 后端.替换企业档案(relation.organization_id, body, before.revision);
          发布档案收口(deps, relation.organization_id, next);
        } catch (error) {
          if (error instanceof BFF错误 && error.status === 401) {
            清账号状态(deps);
            throw error;
          }
          if (是组织权限变化(error)) {
            await 处理组织权限变化(deps, relation.organization_id, error);
            throw error;
          }
          if (是并发或不确定写入(error)) {
            let current: BFF企业档案 | null;
            try {
              current = await 重读企业档案(deps, relation.organization_id);
            } catch {
              throw error; // 重读失败不能替换原始 409/503
            }
            if (!(error.status === 503 && current && 企业档案匹配替换(current, body))) {
              throw error; // 去引用未确认：不 DELETE，原错误抛回（重试时已见新快照）
            }
            // 503 但重读确认去引用已落库 → 落到下方 DELETE 完成收口
          } else {
            throw error;
          }
        }
      }
      await 删除已脱离();
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
