// 后端附件简历域操作（P2）：resume-files 库快照的权威提交、六个页面操作与歧义恢复。
// 铁律（Spec §10）：不做乐观写 —— mutation 后只信一次权威 GET；
//   · 列表 GET 立即并发发出，绝不等 stalled poll；只有成功响应的同步 commit 通过
//     factory 内短队列按读取序号串行落地：序号新于最近提交才提交，迟到旧成功复用
//     最近提交快照，失败不推进提交序号、不进入队列、不污染其它读取。
//   · 会话 fence（subject + generation）与 P3/P6 共用：过时成败整包丢弃；
//     读取并提交 返回 null（换代）一律静默 return '已换代'，不读 items、不抛错。
//   · 错误按 Spec 10.2–10.4 分派：401 统一 清账号状态；权威重读码 / 结果未知码
//     GET+commit 后按目标核对，delete 目标消失、parse 达成态才收口成功；
//     create/replace 库集合变化抛 attachment_state_changed；upload_in_progress 只重读；
//     任何分支都不得自动重放 mutation，安全重读失败保留原错误。
//   · 键位（冻结）：库锁 resume-files:create，文件锁 resume-file:${fileId}。
// Mock / 无 backend：mutation 返回 已换代、read 静默、download 抛 backend_unavailable，
// 绝不生成假 Blob 或错误成功提示。接口失败绝不回退 Mock。

import { BFF错误 } from '../../数据/HTTP客户端';
import type { BFF附件解析状态, BFF附件简历, BFF附件简历库 } from '../../数据/BFF契约';
import type { 后端操作依赖, 附件简历操作, 附件变更结果 } from './类型';
import { 清账号状态 } from './会话操作';

function 捕获栅栏(deps: 后端操作依赖) {
  return { subject: deps.主体标识引用.current, generation: deps.会话代际.current };
}

function 仍有效(deps: 后端操作依赖, fence: ReturnType<typeof 捕获栅栏>): boolean {
  return deps.主体标识引用.current === fence.subject && deps.会话代际.current === fence.generation;
}

function 提交附件库(deps: 后端操作依赖, fence: ReturnType<typeof 捕获栅栏>, value: BFF附件简历库): void {
  if (!仍有效(deps, fence)) return;
  deps.设后端状态((old) => ({ ...old, 附件简历库: value }));
}

/** 权威重读码（Spec 10.2）：重读提交权威列表，不重放 mutation；只有 delete 且目标消失才收口成功。 */
const 权威重读码 = new Set([
  'resume_file_version_conflict', 'resume_file_selection_stale', 'resume_file_not_found', 'resume_file_limit_reached',
]);

/** create/replace 的库集合签名：file_id + current version_id 的排序串，用于结果未知时的「状态已变」判定。 */
function 库集合签名(库: BFF附件简历库 | null): string {
  return (库?.items ?? [])
    .map((条) => `${条.file_id}:${条.current_version.version_id}`)
    .sort()
    .join('|');
}

/**
 * 权威视图里同一 current version 的解析是否已达成目标态。
 * active|succeeded 直接算达成；failed 只有 terminal updated_at 相对发送前发生了变化才算
 * （同一条旧失败不算本次意图的结果）。
 */
function 解析达成(
  库: BFF附件简历库,
  fileId: string,
  versionId: string,
  发送前更新时间: string | null,
): boolean {
  const 文件 = 库.items.find((条) => 条.file_id === fileId);
  if (!文件 || 文件.current_version.version_id !== versionId) return false;
  const 解析: BFF附件解析状态 = 文件.current_version.parse;
  if (解析.status === 'pending' || 解析.status === 'processing' || 解析.status === 'succeeded') return true;
  if (解析.status === 'failed') return 解析.updated_at !== 发送前更新时间;
  return false;
}

/** already_in_progress 的达成态：active / succeeded。 */
function 解析在途或成功(库: BFF附件简历库, fileId: string, versionId: string): boolean {
  const 文件 = 库.items.find((条) => 条.file_id === fileId);
  if (!文件 || 文件.current_version.version_id !== versionId) return false;
  const 状态 = 文件.current_version.parse.status;
  return 状态 === 'pending' || 状态 === 'processing' || 状态 === 'succeeded';
}

/** not_allowed 的达成态：只有 succeeded。 */
function 解析已成功(库: BFF附件简历库, fileId: string, versionId: string): boolean {
  const 文件 = 库.items.find((条) => 条.file_id === fileId);
  return !!文件 && 文件.current_version.version_id === versionId &&
    文件.current_version.parse.status === 'succeeded';
}

export function 创建附件简历操作(deps: 后端操作依赖): 附件简历操作 {
  const { 是后端, 后端, 派发, 设后端状态, 后端状态引用, 锁, 主体标识引用, 会话代际 } = deps;
  // 清账号状态 需要的子集（与会话/隐私域共用口径）
  const 账号清理依赖 = { 派发, 设后端状态, 后端, 主体标识引用, 会话代际 };

  // ── 提交协调器（factory 闭包私有，不是公共 state / dependency）────────────
  // GET 立即发出；只有成功响应的同步 commit 排进 附件提交队列，串行按读取序号落地。
  let 下一个读取序号 = 0;
  let 最近提交序号 = 0;
  let 最近提交快照: BFF附件简历库 | null = null;
  let 附件提交队列: Promise<void> = Promise.resolve();
  function 读取并提交(fence: ReturnType<typeof 捕获栅栏>): Promise<BFF附件简历库 | null> {
    const reading = ++下一个读取序号;
    const request = deps.后端!.读取附件简历库(); // 立即发出；不等 stalled poll
    return request.then((value) => {
      let committed: BFF附件简历库 | null = null;
      const commit = 附件提交队列.then(() => {
        if (!仍有效(deps, fence)) return;
        if (reading <= 最近提交序号) { committed = 最近提交快照; return; }
        最近提交序号 = reading;
        最近提交快照 = value;
        committed = value;
        提交附件库(deps, fence, value);
      });
      附件提交队列 = commit.then(() => undefined, () => undefined);
      return commit.then(() => committed);
    });
  }

  /** mutation 成功收尾 / 缺行安全 GET 用的权威读取：当前会话 401 走统一登出清理。 */
  async function 确认权威(fence: ReturnType<typeof 捕获栅栏>): Promise<BFF附件简历库 | null> {
    try {
      return await 读取并提交(fence);
    } catch (错误) {
      if (错误 instanceof BFF错误 && 错误.status === 401 && 仍有效(deps, fence)) {
        清账号状态(账号清理依赖);
      }
      throw 错误;
    }
  }

  type 重读结果 = { kind: '达成'; 库: BFF附件简历库 } | { kind: '换代' } | { kind: '失败' };

  /** 歧义恢复用的安全重读：失败一律由调用方保留原错误（这里只区分 换代 / 达成 / 失败）。 */
  async function 恢复重读(fence: ReturnType<typeof 捕获栅栏>): Promise<重读结果> {
    try {
      const 库 = await 读取并提交(fence);
      if (库 === null) return { kind: '换代' };
      return { kind: '达成', 库 };
    } catch (重读错误) {
      // 恢复读撞上当前会话 401 = 会话在读途中失效：统一登出清理（过 fence，已换代绝不清新会话），
      // 原始错误仍由调用方抛出，恢复失败永不顶替。
      if (重读错误 instanceof BFF错误 && 重读错误.status === 401 && 仍有效(deps, fence)) {
        清账号状态(账号清理依赖);
      }
      return { kind: '失败' };
    }
  }

  /**
   * 变更效果目标：歧义恢复时用它和权威视图核对「是否真的达成」。
   * create/replace 带 动作前 snapshot 的集合签名；parse 带 目标 version 与发送前的 terminal updated_at。
   */
  type 变更效果 =
    | { kind: 'create'; 动作前: BFF附件简历库 | null }
    | { kind: 'replace'; 动作前: BFF附件简历库 | null }
    | { kind: 'delete'; fileId: string }
    | { kind: 'parse'; fileId: string; versionId: string; 发送前更新时间: string | null };

  function 目标已消失(库: BFF附件简历库, fileId: string): boolean {
    return !库.items.some((条) => 条.file_id === fileId);
  }

  /**
   * mutation 错误统一分派（Spec 10.2–10.4，顺序即优先级）：
   *   非 BFF 错误 → 原样抛出；
   *   401 → 清账号状态后抛原错误；
   *   权威重读码 → GET+commit；delete 且目标消失才 return '已提交'，其余抛原错误；
   *   status 0 / 503 / idempotency_in_progress → GET+commit；按 Spec 10.3 核对目标是否已达成；
   *     · delete：目标已不存在 → 收口成功；
   *     · parse：同 version 变 active/succeeded，或 terminal updated_at 已变化 → 收口成功；
   *     · create/replace：库与动作前 snapshot 的 file/version 集合不同 →
   *       throw new BFF错误(error.status, 'attachment_state_changed', '附件状态已更新，请确认')；
   *   upload_in_progress → GET+commit 后始终抛原 code，不做集合差异效果判定；
   *   parse_already_in_progress → GET+commit；active/succeeded 按目标达成，否则抛原错误；
   *   parse_not_allowed → GET+commit；只有 succeeded 按目标达成，否则抛原错误；
   *   读取并提交 返回 null（会话换代）→ 不读 items、不抛错、不提示，return '已换代'；
   *   无法确认或安全 GET 失败 → 抛原错误。任何分支都不得自动重放 mutation。
   */
  async function 收口变更错误(
    错误: unknown,
    fence: ReturnType<typeof 捕获栅栏>,
    效果: 变更效果,
  ): Promise<附件变更结果> {
    if (!(错误 instanceof BFF错误)) throw 错误;
    if (错误.status === 401) {
      // 过会话 fence：mutation 在飞期间已换代（登出/重登/切身份，转移路径自己清过账号）时，
      // 迟到的旧会话 401 绝不能顺手登出新一代 —— 跳过清理即可，错误语义不变（同 P6 收口写入错误）。
      if (仍有效(deps, fence)) 清账号状态(账号清理依赖);
      throw 错误;
    }
    if (权威重读码.has(错误.code)) {
      const 重读 = await 恢复重读(fence);
      if (重读.kind === '换代') return '已换代';
      if (重读.kind === '失败') throw 错误;
      if (效果.kind === 'delete' && 目标已消失(重读.库, 效果.fileId)) return '已提交';
      throw 错误;
    }
    if (错误.status === 0 || 错误.status === 503 || 错误.code === 'idempotency_in_progress') {
      const 重读 = await 恢复重读(fence);
      if (重读.kind === '换代') return '已换代';
      if (重读.kind === '失败') throw 错误;
      const 权威 = 重读.库;
      if (效果.kind === 'delete') {
        if (目标已消失(权威, 效果.fileId)) return '已提交';
        throw 错误;
      }
      if (效果.kind === 'parse') {
        if (解析达成(权威, 效果.fileId, 效果.versionId, 效果.发送前更新时间)) return '已提交';
        throw 错误;
      }
      // create/replace：只有库集合确实变了才能提示确认，仍不声称一定是本设备成功
      if (库集合签名(效果.动作前) !== 库集合签名(权威)) {
        throw new BFF错误(错误.status, 'attachment_state_changed', '附件状态已更新，请确认');
      }
      throw 错误;
    }
    if (错误.code === 'upload_in_progress') {
      const 重读 = await 恢复重读(fence);
      if (重读.kind === '换代') return '已换代';
      throw 错误;
    }
    if (错误.code === 'parse_already_in_progress') {
      const 重读 = await 恢复重读(fence);
      if (重读.kind === '换代') return '已换代';
      if (重读.kind === '失败') throw 错误;
      if (效果.kind === 'parse' && 解析在途或成功(重读.库, 效果.fileId, 效果.versionId)) return '已提交';
      throw 错误;
    }
    if (错误.code === 'parse_not_allowed') {
      const 重读 = await 恢复重读(fence);
      if (重读.kind === '换代') return '已换代';
      if (重读.kind === '失败') throw 错误;
      if (效果.kind === 'parse' && 解析已成功(重读.库, 效果.fileId, 效果.versionId)) return '已提交';
      throw 错误;
    }
    throw 错误;
  }

  /** 快照里按 id 取最新行：revision / version 一律以快照为准。 */
  function 快照行(fileId: string): BFF附件简历 | undefined {
    return 后端状态引用.current.附件简历库?.items.find((条) => 条.file_id === fileId);
  }

  return {
    /**
     * 委托前的权威库准备（P5 Task 3）：立即 GET 一次并经既有 读取并提交 协调器落地，
     * 把已提交的权威快照本体还给屏 —— 屏只依据这一份决定零/一/多文件的委托走向，
     * 不再另起第二套读取。换代（读途中 / 失败迟到）一律返回 null 由屏静默返回；
     * 当前 fence 的 401 与 刷新附件简历 同口径清账号后原样抛。
     */
    async 准备候选委托简历(): Promise<BFF附件简历库 | null> {
      if (!是后端 || !后端) return null;
      const fence = 捕获栅栏(deps);
      try {
        return await 读取并提交(fence);
      } catch (错误) {
        // 迟到的旧会话失败静默丢弃（null 交屏静默）；当前 fence 的 401 才清账号，其余原样抛
        if (!仍有效(deps, fence)) return null;
        if (错误 instanceof BFF错误 && 错误.status === 401) 清账号状态(账号清理依赖);
        throw 错误;
      }
    },

    async 刷新附件简历() {
      if (!是后端 || !后端) return;
      const fence = 捕获栅栏(deps);
      try {
        await 读取并提交(fence);
      } catch (错误) {
        // 迟到的旧会话失败静默丢弃；当前 fence 的 401 才清账号，其余原样抛
        if (!仍有效(deps, fence)) return;
        if (错误 instanceof BFF错误 && 错误.status === 401) 清账号状态(账号清理依赖);
        throw 错误;
      }
    },

    async 创建附件简历(file, consent) {
      if (!是后端 || !后端) return '已换代';
      const 键 = 'resume-files:create';
      if (锁.current.has(键)) return '已换代';
      锁.current.add(键);
      const fence = 捕获栅栏(deps);
      try {
        const 动作前 = 后端状态引用.current.附件简历库;
        try {
          await 后端.创建附件简历(file, consent);
        } catch (错误) {
          return await 收口变更错误(错误, fence, { kind: 'create', 动作前 });
        }
        const 权威 = await 确认权威(fence);
        if (权威 === null) return '已换代';
        return '已提交';
      } finally {
        锁.current.delete(键);
      }
    },

    async 替换附件简历(fileId, file, consent) {
      if (!是后端 || !后端) return '已换代';
      const 键 = `resume-file:${fileId}`;
      if (锁.current.has(键)) return '已换代';
      锁.current.add(键);
      const fence = 捕获栅栏(deps);
      try {
        // display_name 由槽位保留：replace 只发 file + consent，绝不把新挑的文件名当显示名
        const 目标 = 快照行(fileId);
        if (!目标) {
          const 权威 = await 确认权威(fence); // 只安全 GET 一次，不自动重放
          if (权威 === null) return '已换代';
          throw new BFF错误(409, 'resume_file_selection_stale', '附件状态已更新，请重新选择');
        }
        const 动作前 = 后端状态引用.current.附件简历库;
        try {
          await 后端.替换附件简历(fileId, 目标.revision, file, consent);
        } catch (错误) {
          return await 收口变更错误(错误, fence, { kind: 'replace', 动作前 });
        }
        const 权威 = await 确认权威(fence);
        if (权威 === null) return '已换代';
        return '已提交';
      } finally {
        锁.current.delete(键);
      }
    },

    async 删除附件简历(fileId) {
      if (!是后端 || !后端) return '已换代';
      const 键 = `resume-file:${fileId}`;
      if (锁.current.has(键)) return '已换代';
      锁.current.add(键);
      const fence = 捕获栅栏(deps);
      try {
        const 目标 = 快照行(fileId);
        if (!目标) {
          const 权威 = await 确认权威(fence); // 只安全 GET 一次，不自动重放
          if (权威 === null) return '已换代';
          throw new BFF错误(409, 'resume_file_selection_stale', '附件状态已更新，请重新选择');
        }
        try {
          await 后端.删除附件简历(fileId, 目标.revision);
        } catch (错误) {
          return await 收口变更错误(错误, fence, { kind: 'delete', fileId });
        }
        const 权威 = await 确认权威(fence);
        if (权威 === null) return '已换代';
        return '已提交';
      } finally {
        锁.current.delete(键);
      }
    },

    async 请求附件解析(fileId, consent) {
      if (!是后端 || !后端) return '已换代';
      const 键 = `resume-file:${fileId}`;
      if (锁.current.has(键)) return '已换代';
      锁.current.add(键);
      const fence = 捕获栅栏(deps);
      try {
        const 目标 = 快照行(fileId);
        if (!目标) {
          const 权威 = await 确认权威(fence); // 只安全 GET 一次，不自动重放
          if (权威 === null) return '已换代';
          throw new BFF错误(409, 'resume_file_selection_stale', '附件状态已更新，请重新选择');
        }
        const versionId = 目标.current_version.version_id;
        // terminal updated_at 的发送前基线：not_started 没有 updated_at
        const 发送前解析 = 目标.current_version.parse;
        const 发送前更新时间 = 'updated_at' in 发送前解析 ? 发送前解析.updated_at : null;
        try {
          await 后端.请求附件解析(fileId, versionId, consent);
        } catch (错误) {
          return await 收口变更错误(错误, fence, { kind: 'parse', fileId, versionId, 发送前更新时间 });
        }
        const 权威 = await 确认权威(fence);
        if (权威 === null) return '已换代';
        return '已提交';
      } finally {
        锁.current.delete(键);
      }
    },

    async 下载附件简历(fileId) {
      if (!是后端 || !后端) {
        throw new BFF错误(0, 'backend_unavailable', '附件仅在后端模式可用');
      }
      const fence = 捕获栅栏(deps);
      try {
        return await 后端.下载附件简历(fileId);
      } catch (错误) {
        // 只读不落锁：当前 fence 的 401 才清账号，其余原样抛
        if (错误 instanceof BFF错误 && 错误.status === 401 && 仍有效(deps, fence)) {
          清账号状态(账号清理依赖);
        }
        throw 错误;
      }
    },
  };
}
