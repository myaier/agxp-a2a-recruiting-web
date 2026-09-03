// 候选 onboarding 简历预填域运行时 owner（Task 3）：一轮建议的生命周期操作。
// 铁律（设计 §6–§10 与 Task 1/2 冻结契约）：
//   · Backend + candidate 才动作：Mock / 无后端 / 非候选一律零预填请求、零恢复元数据
//     触碰；日常 我的简历 上传不调用激活，解析推进只经 同步候选Onboarding解析。
//   · suggestion 只在内存（resume-prefill.v1 响应 no-store 且敏感）；浏览器存储只落
//     控制面五元组 {mode, source 三元组, eligibility 快照, confirmed, generation}
//     （数据/候选Onboarding预填恢复 的严格 decoder），刷新后按 exact tuple 重读。
//   · 读栅栏 = subject + candidate 角色 + 会话代际 + 预填代际 + exact tuple
//     （file|version|parse），每次读取发送前捕获；任一失配的迟到成败只释放本轮单飞锁
//     —— 不提交建议、不落 failed、迟到的 401 绝不能登出新会话。提交还要求当前内存轮
//     仍是 auto（manual/inactive/failed 不消费迟到建议）且当前附件仍指向同一
//     succeeded parse。单飞键 = fileId|versionId|parseId，finally 释放，同 tuple 并发
//     调用并入同一 Promise。
//   · 权威附件（附件简历库 items[0] 的 parse 状态）是解析真相源：succeeded 先把真实
//     parse_id 写进内存 source 与恢复元数据（先于读取起飞，读取途中刷新仍可恢复），
//     再进入 loading 读取；pending/processing 零预填读取停在 waiting_parse；parse
//     failed 进入 failed 不请求建议；source 换新（替换上传）重绑并把尚未确认分区清零。
//   · 错误分派（设计 §10）：401 → 统一 清账号状态（预填内存/锁/元数据随行清理）；
//     404/409 → 一次权威附件库刷新后按新 current source 重派，同 tuple 仍不可读即
//     终局 failed 绝不循环；400/403/invalid_response 终局 failed（在线简历数据不动，
//     绝不应用半份解码数据 —— 严格 decoder 已在数据层 fail closed）；503/网络失败
//     failed 但保留 source/eligibility/confirmed 供显式重试或继续手填。所有失败都
//     不清表单、不回退 Mock。
//   · 清账号状态 / 换主体登录 / 切离 candidate 统一走 清候选预填引用：预填代际递增
//     （在飞读整包作废）+ 单飞读锁清空 + outgoing subject 的恢复元数据删除。

import { BFF错误, 取后端错误文案 } from '../../数据/HTTP客户端';
import type {
  BFF附件简历,
  BFF附件简历库,
  BFF简历,
  BFF简历预填来源,
} from '../../数据/BFF契约';
import { 清账号状态 } from './会话操作';
import type {
  候选预填Eligibility,
  候选预填绑定来源,
  候选预填恢复元数据,
  候选预填状态,
  候选预填运行时引用,
  候选预填分区,
  后端操作依赖,
  简历预填操作,
} from './类型';
import { 创建空候选预填状态 } from './类型';

/**
 * 候选预填引用级清理：预填代际递增（在飞读按旧代整包作废）+ 单飞读锁清空 +
 * outgoing subject 的恢复元数据删除。登出 / 401 / 换主体 / 切离 candidate /
 * Provider 清理口统一走这里；可选成员缺省时（旧依赖桩）静默跳过，
 * 状态仍由 创建空候选预填状态() 的摊平兜底。
 */
export function 清候选预填引用(
  deps: Partial<Pick<后端操作依赖, '候选预填代际' | '候选预填读取锁' | '候选预填恢复'>>,
): void {
  if (deps.候选预填代际) deps.候选预填代际.current += 1;
  deps.候选预填读取锁?.current.clear();
  deps.候选预填恢复?.current?.删除();
}

/** 401 统一判据：会话失效一律走 清账号状态（与其它域同口径）。 */
function 是401(错误: unknown): boolean {
  return 错误 instanceof BFF错误 && 错误.status === 401;
}

/** 404 / 409：按设计 §10 走一次权威附件刷新后重派的分支。 */
function 是404或409(错误: unknown): boolean {
  return 错误 instanceof BFF错误 && (错误.status === 404 || 错误.status === 409);
}

/**
 * source 绑定时从权威简历快照（原始 BFF DTO）记录服务端空白（设计 §6.2）：
 * true = 该字段/列表当时为空，可被建议填充。不能只看页面中文模型 —— 它含有
 * 「在职」「本科」等 UI 默认值，默认值不等于服务端已有事实。快照缺席（未水合）
 * 一律不可填：没有权威事实就不给建议授权任何覆盖。
 */
function 取预填Eligibility(简历: BFF简历 | null): 候选预填Eligibility {
  if (简历 === null) {
    return {
      profile: {
        real_name: false, work_start_year: false, gender: false, birth_year: false, birth_month: false,
      },
      summary: false, skills: false, experiences: false, educations: false, certificates: false,
    };
  }
  return {
    profile: {
      real_name: 简历.profile.real_name === '',
      work_start_year: 简历.profile.work_start_year === null,
      gender: 简历.profile.gender === null,
      birth_year: 简历.profile.birth_year === null,
      birth_month: 简历.profile.birth_month === null,
    },
    summary: 简历.summary === '',
    skills: 简历.skills.length === 0,
    experiences: 简历.experiences.length === 0,
    educations: 简历.educations.length === 0,
    certificates: 简历.certificates.length === 0,
  };
}

/** 每次读取发送前捕获的栅栏（设计 §6.5）：六个坐标全对上才允许提交。 */
interface 预填栅栏 {
  subject: string | null;
  session: number;
  prefill: number;
  fileId: string;
  versionId: string;
  parseId: string;
}

/** Provider 恒注入三个候选预填引用；缺引用是接线缺陷，在工厂入口尽早暴露而不是静默错栅栏。 */
function 取候选预填引用(deps: 后端操作依赖): 后端操作依赖 & 候选预填运行时引用 {
  if (!deps.候选预填代际 || !deps.候选预填读取锁 || !deps.候选预填恢复) {
    throw new Error('候选预填运行时引用未初始化（Provider 必须一次性注入）');
  }
  return deps as 后端操作依赖 & 候选预填运行时引用;
}

export function 创建简历预填操作(deps: 后端操作依赖): 简历预填操作 {
  const 引用 = 取候选预填引用(deps);
  const { 是后端, 后端, 派发, 设后端状态, 后端状态引用, 主体标识引用, 会话代际 } = 引用;
  const { 候选预填代际, 候选预填读取锁, 候选预填恢复 } = 引用;
  // 清账号状态 需要的子集（与其它域同口径；P4/P7/P8 + 候选预填引用一起做清理）
  const 账号清理依赖 = {
    派发, 设后端状态, 后端, 主体标识引用, 会话代际,
    P4范围代际: 引用.P4范围代际, P4幂等意图: 引用.P4幂等意图, P4可见范围: 引用.P4可见范围,
    P7范围代际: 引用.P7范围代际, P7待定意图: 引用.P7待定意图,
    P7可见收件箱: 引用.P7可见收件箱, P7可见会话: 引用.P7可见会话, P7已读位置: 引用.P7已读位置,
    P8范围代际: 引用.P8范围代际, P8账号可见: 引用.P8账号可见, P8读取锁: 引用.P8读取锁,
    P8待定意图: 引用.P8待定意图,
    候选预填代际, 候选预填读取锁, 候选预填恢复,
  };

  // ── 小工具 ──

  /** 字段缺席一律视为 pristine inactive（与 Task 2 落下的读取方口径一致）。 */
  function 当前预填状态(): 候选预填状态 {
    return 后端状态引用.current.候选预填状态 ?? 创建空候选预填状态();
  }

  function 设预填状态(下一: 候选预填状态): void {
    设后端状态((旧) => ({ ...旧, 候选预填状态: 下一 }));
  }

  /** Backend + candidate 会话才动作：Mock / 无后端 / 非候选零请求零元数据。 */
  function 是候选会话(): boolean {
    return 是后端 === true && 后端 !== null && 后端状态引用.current.主体?.last_used_role === 'candidate';
  }

  /** 权威附件 = 附件简历库 items[0]（onboarding 上传绑定的那一行）。 */
  function 当前附件(): BFF附件简历 | null {
    return 后端状态引用.current.附件简历库?.items[0] ?? null;
  }

  /** 控制面五元组落盘（suggestion 绝不落盘）；适配器缺席（Mock/非候选/未绑定）零触碰。 */
  function 持久化恢复元数据(状态: 候选预填状态): void {
    if (状态.source === null || 状态.eligibility === null) return;
    const 元数据: 候选预填恢复元数据 = {
      mode: 状态.phase === 'manual' ? 'manual' : 'auto',
      source: 状态.source,
      eligibility: 状态.eligibility,
      confirmed: 状态.confirmed,
      generation: 状态.generation,
    };
    候选预填恢复.current?.写入(元数据);
  }

  /** 失败落位：本轮 source/eligibility/confirmed 全保留（可显式重试或继续手填）。 */
  function 落失败(错误: unknown): void {
    设预填状态({ ...当前预填状态(), phase: 'failed', suggestion: null, error: 取后端错误文案(错误) });
  }

  // ── 栅栏 ──

  function 捕获栅栏(来源: BFF简历预填来源): 预填栅栏 {
    return {
      subject: 主体标识引用.current,
      session: 会话代际.current,
      prefill: 候选预填代际.current,
      fileId: 来源.file_id,
      versionId: 来源.version_id,
      parseId: 来源.parse_id,
    };
  }

  /** 除当前附件外的全部分量：subject + 会话代际 + 预填代际 + candidate 角色 +
   *  内存轮仍是 auto 且绑定同一 tuple（manual/inactive/failed 不消费迟到结算）。 */
  function 会话预填栅栏仍当前(fence: 预填栅栏): boolean {
    if (主体标识引用.current !== fence.subject) return false;
    if (会话代际.current !== fence.session) return false;
    if (候选预填代际.current !== fence.prefill) return false;
    if (后端状态引用.current.主体?.last_used_role !== 'candidate') return false;
    const 状态 = 当前预填状态();
    if (状态.phase !== 'arming' && 状态.phase !== 'waiting_parse' && 状态.phase !== 'loading') return false;
    return 状态.source !== null
      && 状态.source.file_id === fence.fileId
      && 状态.source.version_id === fence.versionId
      && 状态.source.parse_id === fence.parseId;
  }

  /** 读路径全量判定：再加当前附件仍指向同一 file/version 且 parse succeeded 同 parse_id。 */
  function 栅栏仍当前(fence: 预填栅栏): boolean {
    if (!会话预填栅栏仍当前(fence)) return false;
    const 附件 = 当前附件();
    if (附件 === null
      || 附件.file_id !== fence.fileId
      || 附件.current_version.version_id !== fence.versionId) return false;
    const 解析 = 附件.current_version.parse;
    return 解析.status === 'succeeded' && 解析.parse_id === fence.parseId;
  }

  // ── 单飞读取 ──

  async function 执行读取(来源: BFF简历预填来源): Promise<void> {
    const fence = 捕获栅栏(来源);
    try {
      const 建议 = await 后端!.读取简历预填(来源);
      if (!栅栏仍当前(fence)) return; // 迟到成功：整包作废，只释放单飞锁
      设预填状态({ ...当前预填状态(), phase: 'ready', suggestion: 建议, error: null });
    } catch (错误) {
      if (!栅栏仍当前(fence)) return; // 迟到失败（含 401）只丢弃：绝不登出新会话
      if (是401(错误)) {
        // 当前会话 401：统一清账号（候选预填状态/锁/元数据随 清账号状态 一起清）；读路径不抛出
        清账号状态(账号清理依赖);
        return;
      }
      if (是404或409(错误)) {
        await 一次性刷新并重派(fence, 错误);
        return;
      }
      // 400/403/invalid_response 终局与 503/网络可重试都进 failed；本轮元数据保留
      落失败(错误);
    }
  }

  /** exact tuple 单飞：同 tuple 重复调用并入同一 Promise；finally 只释放自己的键。 */
  function 单飞读取(来源: BFF简历预填来源): Promise<void> {
    const 键 = `${来源.file_id}|${来源.version_id}|${来源.parse_id}`;
    const 在飞 = 候选预填读取锁.current.get(键);
    if (在飞) return 在飞;
    const 本次 = 执行读取(来源).finally(() => {
      if (候选预填读取锁.current.get(键) === 本次) 候选预填读取锁.current.delete(键);
    });
    候选预填读取锁.current.set(键, 本次);
    return 本次;
  }

  /**
   * 404/409 的一次性权威刷新（设计 §10）：刷新一次附件库并提交权威视图；同 tuple 仍
   * 不可读 → 终局 failed（绝不循环请求）；source 已变 → 按新 current source 与权威
   * parse 状态重派（waiting/loading/failed）；刷新失败 → failed 保留原错误语义 ——
   * 唯独当前栅栏的 401 走统一 清账号状态（会话已在刷新途中失效，可重试 failed 无意义），
   * 迟到的失配 401 与读路径同口径只丢弃。
   * 重派以本轮栅栏为界 —— 本轮已换代（新手填/新轮/清理）就不再动新轮。
   */
  async function 一次性刷新并重派(fence: 预填栅栏, 原错误: unknown): Promise<void> {
    if (!会话预填栅栏仍当前(fence)) return;
    let 库: BFF附件简历库;
    try {
      库 = await 后端!.读取附件简历库();
    } catch (错误) {
      // 迟到失败（含 401）只丢弃：栅栏已失配的 401 绝不能登出新会话（与读路径同口径）
      if (!会话预填栅栏仍当前(fence)) return;
      // 当前栅栏 401：会话在刷新途中失效 —— 统一 清账号状态，不落成可重试 failed
      if (是401(错误)) {
        清账号状态(账号清理依赖);
        return;
      }
      落失败(原错误); // 其它失败保留原 404/409 语义：failed 可显式重试
      return;
    }
    // 权威库是 subject 级事实：subject + 会话代际仍立就提交（供页面与后续推进消费）
    if (主体标识引用.current !== fence.subject || 会话代际.current !== fence.session) return;
    设后端状态((旧) => ({ ...旧, 附件简历库: 库 }));
    if (!会话预填栅栏仍当前(fence)) return;
    const 附件 = 库.items[0] ?? null;
    const 解析 = 附件?.current_version.parse ?? null;
    const 同元组 = 附件 !== null
      && 附件.file_id === fence.fileId
      && 附件.current_version.version_id === fence.versionId
      && (解析?.status !== 'succeeded' || 解析.parse_id === fence.parseId);
    if (!同元组) {
      await 按权威附件推进(); // source 已变：重绑新 current source 并按新 parse 状态推进
      return;
    }
    落失败(原错误); // 同 tuple 仍不可读：终局 failed，不循环请求
  }

  /**
   * 权威解析推进核（同步候选Onboarding解析 与 404/409 重派共用）：当前附件 items[0]
   * 的 parse 状态是唯一真相源。succeeded 先把真实 parse_id 写进内存 source 与恢复
   * 元数据（先于读取起飞），再以完整 tuple 单飞读取；pending/processing/not_started
   * 停在 waiting_parse 零预填读取；parse failed 进入 failed 不请求建议。source 换新
   * （arming 首绑 / 替换上传 / 防御性漂移）重绑并把尚未确认分区与旧建议清零。
   */
  async function 按权威附件推进(): Promise<void> {
    const 状态 = 当前预填状态();
    if (状态.phase === 'inactive' || 状态.phase === 'manual' || 状态.phase === 'failed') return;
    const 附件 = 当前附件();
    if (附件 === null) return; // 附件未水合：零动作，等权威库在场
    const 换绑 = 状态.source === null
      || 状态.source.file_id !== 附件.file_id
      || 状态.source.version_id !== 附件.current_version.version_id;
    const 基底: 候选预填状态 = 换绑
      ? {
        ...创建空候选预填状态(候选预填代际.current),
        eligibility: 取预填Eligibility(后端状态引用.current.简历快照),
      }
      : 状态;
    const 解析 = 附件.current_version.parse;
    const 来源: 候选预填绑定来源 = {
      file_id: 附件.file_id,
      version_id: 附件.current_version.version_id,
      parse_id: 解析.status === 'succeeded' ? 解析.parse_id : null,
    };
    if (解析.status === 'succeeded' && 来源.parse_id !== null) {
      // 同 tuple 已 ready：幂等零重读，已提交建议保留
      if (!换绑 && 状态.phase === 'ready' && 状态.source?.parse_id === 来源.parse_id) return;
      const 装填: 候选预填状态 = { ...基底, phase: 'loading', source: 来源, suggestion: null, error: null };
      设预填状态(装填);
      持久化恢复元数据(装填); // parse_id 先落内存与元数据，再起飞读取（关闭读取途中刷新窗口）
      await 单飞读取({ file_id: 来源.file_id, version_id: 来源.version_id, parse_id: 来源.parse_id });
      return;
    }
    const 目标阶段 = 解析.status === 'failed' ? 'failed' : 'waiting_parse';
    // 已停在该阶段且未升级过 parse_id：零请求零写入（轮询每拍都进这里是常态路径）
    if (!换绑 && 状态.phase === 目标阶段 && 状态.source !== null && 状态.source.parse_id === null) return;
    const 下一: 候选预填状态 = { ...基底, phase: 目标阶段, source: 来源, suggestion: null, error: null };
    设预填状态(下一);
    持久化恢复元数据(下一);
  }

  // ── 公开操作 ──

  return {
    async 恢复候选Onboarding预填(options) {
      if (!是候选会话()) return;
      // 内存轮已在场（arming/waiting_parse/loading/ready/failed/manual）：恢复零替换零重读
      const 状态 = 当前预填状态();
      if (状态.phase !== 'inactive' || 状态.source !== null || 状态.suggestion !== null) return;
      const 存储 = 候选预填恢复.current;
      if (存储 === null) return; // Mock / 非候选 / 未绑定：零元数据触碰
      const 元数据 = 存储.读取();
      if (元数据 === null) return; // 无记录：保持 inactive
      // 等 candidate / 附件水合：主体不在场或库未落地就静默等下一次调用（绝不删记录）
      if (后端状态引用.current.附件简历库 === null) return;
      const 附件 = 当前附件();
      if (附件 === null
        || 元数据.source.file_id !== 附件.file_id
        || 元数据.source.version_id !== 附件.current_version.version_id) {
        存储.删除(); // 失配记录（文件/版本已被换掉）：删除并保持 inactive
        return;
      }
      const 起底 = (phase: 候选预填状态['phase'], source: 候选预填绑定来源): 候选预填状态 => ({
        ...创建空候选预填状态(元数据.generation),
        phase,
        source,
        eligibility: 元数据.eligibility,
        confirmed: 元数据.confirmed,
      });
      if (元数据.mode === 'manual') {
        设预填状态(起底('manual', 元数据.source)); // 显式 manual 元数据恢复为 manual：零读取
        return;
      }
      const 解析 = 附件.current_version.parse;
      if (解析.status === 'succeeded' && 解析.parse_id !== null) {
        // 权威 succeeded：把真实 parse_id 升级进内存与元数据（存储 parse_id:null 绝不
        // 强制 manual），先落盘再进入 loading 读取 —— 读取途中刷新仍可按 exact tuple 恢复
        const 升级来源: BFF简历预填来源 = {
          file_id: 元数据.source.file_id,
          version_id: 元数据.source.version_id,
          parse_id: 解析.parse_id,
        };
        设预填状态(起底('loading', 升级来源));
        存储.写入({
          mode: 'auto',
          source: 升级来源,
          eligibility: 元数据.eligibility,
          confirmed: 元数据.confirmed,
          generation: 元数据.generation,
        });
        await 单飞读取(升级来源);
        return;
      }
      if (解析.status === 'pending' || 解析.status === 'processing' || 解析.status === 'not_started') {
        if (options.允许等待解析) {
          // 路由挂着 use附件简历刷新 poller：恢复 waiting_parse，零次预填读取
          设预填状态(起底('waiting_parse', 元数据.source));
          return;
        }
        // 无 poller 的消费页面：立即转为 manual 并落盘，绝不恢复一个无人推进的等待轮
        设预填状态(起底('manual', 元数据.source));
        存储.写入({
          mode: 'manual',
          source: 元数据.source,
          eligibility: 元数据.eligibility,
          confirmed: 元数据.confirmed,
          generation: 元数据.generation,
        });
        return;
      }
      // 权威 parse failed：记录无法被当前附件满足 → 删除并保持 inactive
      存储.删除();
    },

    激活候选Onboarding预填() {
      if (!是候选会话()) return;
      候选预填代际.current += 1; // 旧轮在飞读取按旧代整包作废，旧建议立即不可提交
      候选预填恢复.current?.删除(); // 旧轮恢复元数据随之作废（新元数据由绑定后落盘）
      const 代际 = 候选预填代际.current;
      设预填状态({
        ...创建空候选预填状态(代际),
        phase: 'arming',
        eligibility: 取预填Eligibility(后端状态引用.current.简历快照),
      });
    },

    async 同步候选Onboarding解析() {
      if (!是候选会话()) return;
      await 按权威附件推进();
    },

    async 重试候选Onboarding预填() {
      if (!是候选会话()) return;
      const 状态 = 当前预填状态();
      const 来源 = 状态.source;
      if (来源 === null || 来源.parse_id === null) return; // 无已成功解析的 tuple 可重读
      const 完整来源: BFF简历预填来源 = {
        file_id: 来源.file_id,
        version_id: 来源.version_id,
        parse_id: 来源.parse_id,
      };
      if (状态.phase === 'loading') return 单飞读取(完整来源); // 在飞：并入同一单飞
      if (状态.phase !== 'failed') return;
      const 装填: 候选预填状态 = { ...状态, phase: 'loading', error: null };
      设预填状态(装填);
      持久化恢复元数据(装填);
      await 单飞读取(完整来源);
    },

    继续手填候选Onboarding() {
      if (!是候选会话()) return;
      const 状态 = 当前预填状态();
      if (状态.phase === 'inactive' || 状态.phase === 'manual') return;
      const 手填 = { ...状态, phase: 'manual' as const, suggestion: null };
      设预填状态(手填);
      持久化恢复元数据(手填); // mode:'manual'：本轮明确 opt-out，迟到建议不再应用
    },

    确认候选Onboarding预填分区(section: 候选预填分区) {
      if (!是候选会话()) return;
      const 状态 = 当前预填状态();
      if (状态.source === null) return; // 无本轮可确认
      const 下一 = { ...状态, confirmed: { ...状态.confirmed, [section]: true } };
      设预填状态(下一);
      持久化恢复元数据(下一);
    },

    清候选Onboarding预填() {
      清候选预填引用({ 候选预填代际, 候选预填读取锁, 候选预填恢复 });
      设后端状态((旧) => ({ ...旧, 候选预填状态: 创建空候选预填状态(候选预填代际.current) }));
    },
  };
}
