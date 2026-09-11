// P2 Task 3：附件简历域操作的行为边界 —— 用真实 factory + fake deps 驱动 创建附件简历操作(deps)。
// 铁律（Spec §10）：不做乐观写，mutation 后只信一次权威 GET；GET 立即发出不等 stalled poll，
// 成功响应按读取序号经 factory 内短队列串行提交（迟到旧成功复用最近提交快照，失败不入队列）；
// 401 统一 清账号状态；权威重读码 / 结果未知按目标核对后才收口，绝不重放 mutation；
// 会话换代（读取并提交 返回 null）一律静默 return '已换代'，不读 items、不抛错。
// fixture 把 setter 冻结为与真实 Provider 同步更新 ref 的语义：最终断言统一读 后端状态引用.current。

import { describe, expect, it, vi } from 'vitest';
import type { BFF附件简历, BFF附件简历库 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { BFF错误 } from '../../数据/HTTP客户端';
import { 初始状态 } from '../初始状态';
import type { 后端操作依赖, 后端状态, 候选预填恢复存储 } from './类型';
import type { 候选引导建档草稿, 候选建档草稿存储 } from '../../数据/资料缓存';
import type { 建档写入跟踪 } from '../../数据/招聘数据源类型';
import { 创建附件简历操作 } from './附件简历操作';

const limits: BFF附件简历库['limits'] = {
  max_files: 3,
  max_file_bytes: 10485760,
  accepted_media_types: ['application/pdf'],
};

function 版本(parse: BFF附件简历['current_version']['parse'], id = 'rfv_1'): BFF附件简历['current_version'] {
  return {
    version_id: id,
    version: 1,
    size_bytes: 1024,
    media_type: 'application/pdf',
    sha256: 'a'.repeat(64),
    created_at: '2026-08-28T00:00:00Z',
    parse,
  };
}

const 文件A: BFF附件简历 = {
  file_id: 'rf_1',
  display_name: '沈亦舟_简历_2026.pdf',
  revision: 2,
  current_version: 版本({ status: 'not_started' }),
  created_at: '2026-08-28T00:00:00Z',
  updated_at: '2026-08-28T00:00:00Z',
};

const 文件B: BFF附件简历 = { ...文件A, file_id: 'rf_2', display_name: '第二份.pdf', revision: 1 };

/** 与 文件A 同 version、parse 为 processing 的完整 DTO。 */
const 文件处理中: BFF附件简历 = {
  ...文件A,
  current_version: 版本({ status: 'processing', updated_at: '2026-08-28T00:01:00Z' }),
};

/** 与 文件A 同 version、parse 为 succeeded 的完整 DTO。 */
const 文件已完成: BFF附件简历 = {
  ...文件A,
  current_version: 版本({ status: 'succeeded', parse_id: 'ps_1', updated_at: '2026-08-28T00:02:00Z' }),
};

const pdf = new File(['%PDF-1.7'], '新挑的文件名.pdf', { type: 'application/pdf' });

/** 标准 deferred helper：手动控制一次 GET / mutation 的结算时机。 */
function 可控Promise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** fake deps：setter 冻结为与真实 Provider 同步更新 ref 的语义。 */
function 创建附件测试依赖(后端: HTTP招聘数据源, 是后端 = true) {
  const 后端状态引用 = { current: {
    初始化: '完成' as const, 已登录: true, 主体: null, 简历快照: null, 意向快照: {}, 岗位快照: {},
    隐私快照: null,
    // P6 字段只追加不重建：这里的用例不触达它们
    候选规则快照: {}, 招聘规则快照: {}, 候选规则提案: {}, 招聘规则提案: {},
    Agent规则水合: {
      candidate: { rules: '未开始' as const, proposals: '未开始' as const },
      recruiter: { rules: '未开始' as const, proposals: '未开始' as const },
    },
    // P2：附件库权威快照
    附件简历库: null,
  } as 后端状态 };
  const 设后端状态 = vi.fn((更新: (old: 后端状态) => 后端状态) => {
    后端状态引用.current = 更新(后端状态引用.current);
  });
  // codex review-r1 P2：候选预填引用随行 —— 本域 401 的统一清理必须同样清预填代际/读锁/
  // 恢复元数据（子集缺引用时旧 subject 的 session key 会跨登出残留）。
  const 候选预填代际 = { current: 3 };
  const 候选预填读取锁 = { current: new Map<string, Promise<void>>() };
  const 候选预填恢复 = {
    current: {
      读取: vi.fn(() => null),
      写入: vi.fn(),
      删除: vi.fn(),
    } as 候选预填恢复存储,
  };
  // J-PILOT-02 Task 6：建档草稿运行时引用（onboarding 上传的单槽登记落点）。
  // 缺省 null = 没有 active 建档草稿（日常 我的简历 上传），操作层必须零草稿写、零跟踪。
  const 建档草稿引用 = { current: null as 候选引导建档草稿 | null };
  const 草稿写入 = vi.fn((建档: 候选引导建档草稿) => {
    建档草稿引用.current = 建档;
    return true;
  });
  const 候选建档草稿 = { current: { 读取: () => 建档草稿引用.current, 写入: 草稿写入 } as 候选建档草稿存储 };
  const deps = {
    是后端,
    后端,
    派发: vi.fn(),
    设后端状态,
    后端状态引用,
    状态引用: { current: 初始状态 },
    锁: { current: new Set<string>() },
    尝试引用: { current: null as string | null },
    主体标识引用: { current: 'sub_1' as string | null },
    会话代际: { current: 1 },
    读取恢复企业关系编号: vi.fn(() => null),
    候选预填代际,
    候选预填读取锁,
    候选预填恢复,
    建档草稿引用,
    候选建档草稿,
  } satisfies 后端操作依赖;
  return {
    deps, 设后端状态, 后端状态引用,
    会话代际: deps.会话代际, 主体标识引用: deps.主体标识引用,
    候选预填代际, 候选预填读取锁, 候选预填恢复,
    建档草稿引用, 草稿写入, 派发: deps.派发,
  };
}

function 创建场景() {
  const 后端 = {
    读取附件简历库: vi.fn(),
    创建附件简历: vi.fn(),
    替换附件简历: vi.fn(),
    删除附件简历: vi.fn(),
    请求附件解析: vi.fn(),
    下载附件简历: vi.fn(),
    清空目录缓存: vi.fn(),
  };
  const { deps, 设后端状态, 后端状态引用, 会话代际, 主体标识引用, 候选预填代际, 候选预填读取锁, 候选预填恢复,
    建档草稿引用, 草稿写入, 派发 } = 创建附件测试依赖(后端 as unknown as HTTP招聘数据源);
  const 操作 = 创建附件简历操作(deps);
  return {
    后端, 操作, 设后端状态, 后端状态引用, 会话代际, 主体标识引用,
    候选预填代际, 候选预填读取锁, 候选预填恢复, 建档草稿引用, 草稿写入, 派发,
  };
}

describe('创建附件简历操作 · 成功路径（mutation 后只信权威 GET）', () => {
  it('create uses a library lock, then commits only the authoritative reread', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    const created = { ...文件A, file_id: 'rf_created' };
    const authority = { items: [created], limits };
    后端.创建附件简历.mockResolvedValue(created);
    后端.读取附件简历库.mockResolvedValue(authority);
    const promise = 操作.创建附件简历(pdf, true);
    await expect(promise).resolves.toBe('已提交');
    expect(后端.创建附件简历).toHaveBeenCalledWith(pdf, true);
    expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
    expect(后端状态引用.current.附件简历库).toEqual(authority);
  });

  it('replace reads current revision from snapshot and never sends the picked filename as a display name', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    后端.替换附件简历.mockResolvedValue(文件A);
    后端.读取附件简历库.mockResolvedValue({ items: [文件B], limits });
    await 操作.替换附件简历('rf_1', pdf, true);
    expect(后端.替换附件简历).toHaveBeenCalledWith('rf_1', 文件A.revision, pdf, true);
    expect(后端.替换附件简历.mock.calls[0]).toHaveLength(4); // 不携带 display_name
    expect(后端状态引用.current.附件简历库?.items).toEqual([文件B]);
  });

  it('delete 成功后权威 GET 收口并携带快照 revision', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    后端.删除附件简历.mockResolvedValue({ deleted: true });
    后端.读取附件简历库.mockResolvedValue({ items: [], limits });
    await expect(操作.删除附件简历('rf_1')).resolves.toBe('已提交');
    expect(后端.删除附件简历).toHaveBeenCalledWith('rf_1', 文件A.revision);
    expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
    expect(后端状态引用.current.附件简历库?.items).toEqual([]);
  });

  it('parse 成功后权威 GET 收口并携带当前 version_id', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    后端.请求附件解析.mockResolvedValue(文件处理中.current_version.parse);
    后端.读取附件简历库.mockResolvedValue({ items: [文件处理中], limits });
    await expect(操作.请求附件解析('rf_1', true)).resolves.toBe('已提交');
    expect(后端.请求附件解析).toHaveBeenCalledWith('rf_1', 'rfv_1', true);
    expect(后端状态引用.current.附件简历库?.items).toEqual([文件处理中]);
  });

  it('download 成功透传 Blob 且不发写锁', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    const blob = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    后端.下载附件简历.mockResolvedValue(blob);
    await expect(操作.下载附件简历('rf_1')).resolves.toBe(blob);
    expect(后端.下载附件简历).toHaveBeenCalledWith('rf_1');
    expect(后端状态引用.current.附件简历库).toBeNull();
  });
});

describe('创建附件简历操作 · 并发锁（同 key 只发一次）', () => {
  it('并发同 key 的 create 只发一次，被压制的调用静默返回', async () => {
    const { 后端, 操作 } = 创建场景();
    const 门 = 可控Promise<BFF附件简历>();
    后端.创建附件简历.mockImplementation(() => 门.promise);
    后端.读取附件简历库.mockResolvedValue({ items: [], limits });
    const 第一 = 操作.创建附件简历(pdf, true);
    const 第二 = 操作.创建附件简历(pdf, true);
    expect(后端.创建附件简历).toHaveBeenCalledTimes(1);
    门.resolve(文件A);
    await expect(第一).resolves.toBe('已提交');
    await expect(第二).resolves.toBe('已换代');
    expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
  });

  it('文件锁下并发 replace 只发一次', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    const 门 = 可控Promise<BFF附件简历>();
    后端.替换附件简历.mockImplementation(() => 门.promise);
    const 第一 = 操作.替换附件简历('rf_1', pdf, true);
    const 第二 = 操作.替换附件简历('rf_1', pdf, true);
    expect(后端.替换附件简历).toHaveBeenCalledTimes(1);
    门.resolve(文件A);
    后端.读取附件简历库.mockResolvedValue({ items: [文件A], limits });
    await expect(第一).resolves.toBe('已提交');
    await expect(第二).resolves.toBe('已换代');
  });
});

describe('创建附件简历操作 · 缺本地行的安全 GET', () => {
  it('missing local file 先安全 GET 再抛 resume_file_selection_stale，绝不重放 mutation', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端.读取附件简历库.mockResolvedValue({ items: [文件B], limits });
    await expect(操作.替换附件简历('rf_missing', pdf, true)).rejects.toMatchObject({
      code: 'resume_file_selection_stale',
    });
    expect(后端.替换附件简历).not.toHaveBeenCalled();
    expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
    // 安全 GET 的权威视图照常提交
    expect(后端状态引用.current.附件简历库?.items).toEqual([文件B]);
  });

  it('missing local file 的安全 GET 失败时原样抛出 GET 错误', async () => {
    const { 后端, 操作 } = 创建场景();
    后端.读取附件简历库.mockRejectedValue(new BFF错误(0, 'network_error', 'offline'));
    await expect(操作.删除附件简历('rf_missing')).rejects.toMatchObject({ code: 'network_error' });
    expect(后端.删除附件简历).not.toHaveBeenCalled();
  });
});

describe('创建附件简历操作 · 权威重读码（重读提交，不重放）', () => {
  it.each(['resume_file_version_conflict', 'resume_file_selection_stale', 'resume_file_not_found'])
  ('conflict %s rereads once, commits authority, does not replay and rethrows', async (code) => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    后端.替换附件简历.mockRejectedValue(new BFF错误(409, code, code));
    后端.读取附件简历库.mockResolvedValue({ items: [文件B], limits });
    await expect(操作.替换附件简历('rf_1', pdf, true)).rejects.toMatchObject({ code });
    expect(后端.替换附件简历).toHaveBeenCalledTimes(1);
    expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
    expect(后端状态引用.current.附件简历库?.items).toEqual([文件B]);
  });

  it('delete 404 重读后目标不存在才收口成功', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    后端.删除附件简历.mockRejectedValue(new BFF错误(404, 'resume_file_not_found', 'gone'));
    后端.读取附件简历库.mockResolvedValue({ items: [], limits });
    await expect(操作.删除附件简历('rf_1')).resolves.toBe('已提交');
    expect(后端.删除附件简历).toHaveBeenCalledTimes(1);
    expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
    expect(后端状态引用.current.附件简历库?.items).toEqual([]);
  });

  it('delete 404 但权威视图仍有目标时原样抛出', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    后端.删除附件简历.mockRejectedValue(new BFF错误(404, 'resume_file_not_found', 'gone'));
    后端.读取附件简历库.mockResolvedValue({ items: [文件A], limits });
    await expect(操作.删除附件简历('rf_1')).rejects.toMatchObject({ status: 404 });
    expect(后端.删除附件简历).toHaveBeenCalledTimes(1);
  });

  it('安全重读失败保留原错误', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    后端.替换附件简历.mockRejectedValue(new BFF错误(409, 'resume_file_version_conflict', 'conflict'));
    后端.读取附件简历库.mockRejectedValue(new BFF错误(0, 'network_error', 'offline'));
    await expect(操作.替换附件简历('rf_1', pdf, true)).rejects.toMatchObject({
      code: 'resume_file_version_conflict',
    });
    expect(后端.替换附件简历).toHaveBeenCalledTimes(1);
    expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
  });

  it('恢复重读撞上当前会话 401 仍统一登出清理，原错误照抛', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    后端.替换附件简历.mockRejectedValue(new BFF错误(409, 'resume_file_version_conflict', 'conflict'));
    后端.读取附件简历库.mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(操作.替换附件简历('rf_1', pdf, true)).rejects.toMatchObject({
      code: 'resume_file_version_conflict',
    });
    expect(后端状态引用.current.已登录).toBe(false);
    expect(后端状态引用.current.附件简历库).toBeNull();
  });
});

describe('创建附件简历操作 · 结果未知（Spec 10.3 一次 GET 核对）', () => {
  it('delete 后目标已不存在收口成功', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    后端.删除附件简历.mockRejectedValue(new BFF错误(0, 'network_error', 'offline'));
    后端.读取附件简历库.mockResolvedValue({ items: [], limits });
    await expect(操作.删除附件简历('rf_1')).resolves.toBe('已提交');
    expect(后端.删除附件简历).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['network_error', { items: [文件已完成], limits }],
    ['operation_outcome_unknown', { items: [文件处理中], limits }],
  ])('parse %s 后同 version 变 active/succeeded 收口', async (_名称, 权威) => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    后端.请求附件解析.mockRejectedValue(
      _名称 === 'network_error'
        ? new BFF错误(0, 'network_error', 'offline')
        : new BFF错误(503, 'operation_outcome_unknown', 'unknown'),
    );
    后端.读取附件简历库.mockResolvedValue(权威);
    await expect(操作.请求附件解析('rf_1', true)).resolves.toBe('已提交');
    expect(后端.请求附件解析).toHaveBeenCalledTimes(1);
  });

  it('parse 最终 idempotency_in_progress 后同 version 已 succeeded 收口', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    后端.请求附件解析.mockRejectedValue(new BFF错误(409, 'idempotency_in_progress', 'busy'));
    后端.读取附件简历库.mockResolvedValue({ items: [文件已完成], limits });
    await expect(操作.请求附件解析('rf_1', true)).resolves.toBe('已提交');
  });

  it('parse 结果未知但 terminal updated_at 已变化时收口', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    const 失败中的文件: BFF附件简历 = {
      ...文件A,
      current_version: 版本({ status: 'failed', failure_code: 'document_unreadable', updated_at: '2026-08-28T00:00:00Z' }),
    };
    后端状态引用.current.附件简历库 = { items: [失败中的文件], limits };
    后端.请求附件解析.mockRejectedValue(new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    const 失败已更新: BFF附件简历 = {
      ...文件A,
      current_version: 版本({ status: 'failed', failure_code: 'document_unreadable', updated_at: '2026-08-28T01:00:00Z' }),
    };
    后端.读取附件简历库.mockResolvedValue({ items: [失败已更新], limits });
    await expect(操作.请求附件解析('rf_1', true)).resolves.toBe('已提交');
  });

  it('parse 结果未知且同 version 维持原 failed 时原样抛出', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    const 失败中的文件: BFF附件简历 = {
      ...文件A,
      current_version: 版本({ status: 'failed', failure_code: 'document_unreadable', updated_at: '2026-08-28T00:00:00Z' }),
    };
    后端状态引用.current.附件简历库 = { items: [失败中的文件], limits };
    后端.请求附件解析.mockRejectedValue(new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    后端.读取附件简历库.mockResolvedValue({ items: [失败中的文件], limits });
    await expect(操作.请求附件解析('rf_1', true)).rejects.toMatchObject({ status: 503 });
    expect(后端.请求附件解析).toHaveBeenCalledTimes(1);
  });

  it('parse 结果未知但目标 version 已被替换出 current 时原样抛出', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    后端.请求附件解析.mockRejectedValue(new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    const 换版本 = { ...文件A, current_version: 版本({ status: 'not_started' }, 'rfv_2') };
    后端.读取附件简历库.mockResolvedValue({ items: [换版本], limits });
    await expect(操作.请求附件解析('rf_1', true)).rejects.toMatchObject({ status: 503 });
  });

  it('create 结果未知且库集合有变化时抛 attachment_state_changed 让 UI 提示确认', async () => {
    const { 后端, 操作 } = 创建场景();
    后端.创建附件简历.mockRejectedValue(new BFF错误(0, 'network_error', 'offline'));
    后端.读取附件简历库.mockResolvedValue({ items: [{ ...文件A, file_id: 'rf_other' }], limits });
    await expect(操作.创建附件简历(pdf, true)).rejects.toMatchObject({
      status: 0,
      code: 'attachment_state_changed',
    });
    expect(后端.创建附件简历).toHaveBeenCalledTimes(1);
  });

  it('create 结果未知且库集合无变化时保留原错误', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    后端.创建附件简历.mockRejectedValue(new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    后端.读取附件简历库.mockResolvedValue({ items: [文件A], limits });
    await expect(操作.创建附件简历(pdf, true)).rejects.toMatchObject({ status: 503 });
  });

  it('replace 结果未知重读后出现新 version 时抛 attachment_state_changed', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    后端.替换附件简历.mockRejectedValue(new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    const 新版本 = {
      ...文件A,
      revision: 3,
      current_version: 版本({ status: 'not_started' }, 'rfv_2'),
    };
    后端.读取附件简历库.mockResolvedValue({ items: [新版本], limits });
    await expect(操作.替换附件简历('rf_1', pdf, true)).rejects.toMatchObject({
      code: 'attachment_state_changed',
    });
    expect(后端.替换附件简历).toHaveBeenCalledTimes(1);
  });
});

describe('创建附件简历操作 · 命名恢复码（Spec 10.4）', () => {
  it('parse_not_allowed only closes as success when authority is succeeded', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    后端.请求附件解析.mockRejectedValue(new BFF错误(409, 'parse_not_allowed', 'not allowed'));
    后端.读取附件简历库.mockResolvedValueOnce({ items: [文件处理中], limits });
    await expect(操作.请求附件解析('rf_1', true)).rejects.toMatchObject({ code: 'parse_not_allowed' });
    后端.读取附件简历库.mockResolvedValueOnce({ items: [文件已完成], limits });
    await expect(操作.请求附件解析('rf_1', true)).resolves.toBe('已提交');
  });

  it('parse_already_in_progress 在 active/succeeded 时按目标达成，否则原样抛出', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    后端.请求附件解析.mockRejectedValue(new BFF错误(409, 'parse_already_in_progress', 'busy'));
    后端.读取附件简历库.mockResolvedValueOnce({ items: [文件处理中], limits });
    await expect(操作.请求附件解析('rf_1', true)).resolves.toBe('已提交');
    const 失败的文件: BFF附件简历 = {
      ...文件A,
      current_version: 版本({ status: 'failed', failure_code: 'parser_invalid_output', updated_at: '2026-08-28T00:05:00Z' }),
    };
    后端.读取附件简历库.mockResolvedValueOnce({ items: [失败的文件], limits });
    await expect(操作.请求附件解析('rf_1', true)).rejects.toMatchObject({ code: 'parse_already_in_progress' });
  });

  it('upload_in_progress rereads but preserves its own code', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [], limits };
    后端.创建附件简历.mockRejectedValue(new BFF错误(409, 'upload_in_progress', 'busy'));
    后端.读取附件简历库.mockResolvedValue({ items: [文件A], limits });
    await expect(操作.创建附件简历(pdf, true)).rejects.toMatchObject({ code: 'upload_in_progress' });
    // 只重读，不做集合差异效果判定
    expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
    expect(后端状态引用.current.附件简历库?.items).toEqual([文件A]);
  });
});

describe('创建附件简历操作 · 401 与会话换代', () => {
  it('401 clears every account snapshot including attachments', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端.读取附件简历库.mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(操作.刷新附件简历()).rejects.toMatchObject({ status: 401 });
    expect(后端状态引用.current).toEqual(expect.objectContaining({
      已登录: false, 主体: null, 附件简历库: null,
    }));
    expect(后端.清空目录缓存).toHaveBeenCalled();
  });

  // codex review-r1 P2：本域 401 的统一清理必须带着候选预填引用 —— 只摊平内存状态而
  // 不删 subject 绑定的恢复元数据时，登出渲染会把恢复适配器解绑成 null，旧 session key
  // 就再没有人删：同账号重登后恢复边界会复活上一轮预填。
  it('401 统一清理同时清候选预填引用：代际递增、读锁清空、恢复元数据删除', async () => {
    const { 后端, 操作, 候选预填代际, 候选预填读取锁, 候选预填恢复 } = 创建场景();
    候选预填读取锁.current.set('rf_1|rfv_1|rp_1', Promise.resolve());
    后端.读取附件简历库.mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(操作.刷新附件简历()).rejects.toMatchObject({ status: 401 });
    expect(候选预填代际.current).toBe(4);
    expect(候选预填读取锁.current.size).toBe(0);
    expect(候选预填恢复.current!.删除).toHaveBeenCalledTimes(1);
  });

  it('mutation 401 在会话换代后到达时不登出新会话，原错误照抛', async () => {
    const { 后端, 操作, 设后端状态, 后端状态引用, 会话代际 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    const 门 = 可控Promise<never>();
    后端.替换附件简历.mockImplementation(() => 门.promise);
    设后端状态.mockClear();
    const 请求 = 操作.替换附件简历('rf_1', pdf, true);
    await vi.waitFor(() => expect(后端.替换附件简历).toHaveBeenCalledTimes(1));
    // mutation 在飞期间用户已登出并重新登录（会话代际已前进）
    会话代际.current += 1;
    门.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(请求).rejects.toMatchObject({ status: 401 });
    // 迟到的旧会话 401 绝不能清掉新一代：零清理、零提交（mirror stale-response 零提交断言）
    expect(设后端状态).not.toHaveBeenCalled();
    expect(后端.清空目录缓存).not.toHaveBeenCalled();
    expect(后端状态引用.current.已登录).toBe(true);
    expect(后端状态引用.current.附件简历库?.items).toEqual([文件A]);
  });

  it('mutation 401 在主体标识变化后到达时同样不清新账号', async () => {
    const { 后端, 操作, 设后端状态, 后端状态引用, 主体标识引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    const 门 = 可控Promise<never>();
    后端.删除附件简历.mockImplementation(() => 门.promise);
    设后端状态.mockClear();
    const 请求 = 操作.删除附件简历('rf_1');
    await vi.waitFor(() => expect(后端.删除附件简历).toHaveBeenCalledTimes(1));
    // 只换主体、代际不动：fence 两个分量任一失效都算换代
    主体标识引用.current = 'sub_other';
    门.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(请求).rejects.toMatchObject({ status: 401 });
    expect(设后端状态).not.toHaveBeenCalled();
    expect(后端.清空目录缓存).not.toHaveBeenCalled();
    expect(后端状态引用.current.已登录).toBe(true);
  });

  it('刷新的非 401 错误原样抛出且不清账号', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端.读取附件简历库.mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    await expect(操作.刷新附件简历()).rejects.toMatchObject({ status: 503 });
    expect(后端状态引用.current.已登录).toBe(true);
  });

  it('download 401 清账号并原样抛出', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端.下载附件简历.mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(操作.下载附件简历('rf_1')).rejects.toMatchObject({ status: 401 });
    expect(后端状态引用.current.已登录).toBe(false);
    expect(后端状态引用.current.附件简历库).toBeNull();
  });

  it('download 非 401 错误原样抛出且不清账号', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端.下载附件简历.mockRejectedValue(new BFF错误(404, 'resume_file_not_found', 'gone'));
    await expect(操作.下载附件简历('rf_1')).rejects.toMatchObject({ status: 404 });
    expect(后端状态引用.current.已登录).toBe(true);
  });

  it('a stale refresh response after generation changes is silently discarded', async () => {
    const { 后端, 操作, 设后端状态, 会话代际 } = 创建场景();
    const deferred = 可控Promise<BFF附件简历库>();
    后端.读取附件简历库.mockReturnValue(deferred.promise);
    设后端状态.mockClear();
    const promise = 操作.刷新附件简历();
    会话代际.current += 1;
    deferred.resolve({ items: [文件B], limits });
    await promise;
    expect(设后端状态).not.toHaveBeenCalled();
  });

  it('刷新在会话换代后失败的响应被静默丢弃，不登出新会话', async () => {
    const { 后端, 操作, 后端状态引用, 会话代际 } = 创建场景();
    const deferred = 可控Promise<BFF附件简历库>();
    后端.读取附件简历库.mockReturnValue(deferred.promise);
    const polling = 操作.刷新附件简历();
    会话代际.current += 1;
    deferred.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(polling).resolves.toBeUndefined();
    expect(后端.清空目录缓存).not.toHaveBeenCalled();
    expect(后端状态引用.current.已登录).toBe(true);
  });

  it('mutation 成功后的权威 GET 撞上换代时返回 已换代 且不提交', async () => {
    const { 后端, 操作, 设后端状态, 后端状态引用, 会话代际 } = 创建场景();
    const created = { ...文件A, file_id: 'rf_created' };
    后端.创建附件简历.mockResolvedValue(created);
    const 权威门 = 可控Promise<BFF附件简历库>();
    后端.读取附件简历库.mockReturnValue(权威门.promise);
    设后端状态.mockClear();
    const promise = 操作.创建附件简历(pdf, true);
    await vi.waitFor(() => expect(后端.读取附件简历库).toHaveBeenCalledTimes(1));
    会话代际.current += 1;
    权威门.resolve({ items: [created], limits });
    await expect(promise).resolves.toBe('已换代');
    expect(设后端状态).not.toHaveBeenCalled();
    expect(后端状态引用.current.附件简历库).toBeNull();
  });

  it('a stale generation during error recovery resolves silently without inspecting null', async () => {
    const { 后端, 操作, 设后端状态, 后端状态引用, 会话代际 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    const reread = 可控Promise<BFF附件简历库>();
    后端.请求附件解析.mockRejectedValue(new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    后端.读取附件简历库.mockReturnValue(reread.promise);
    设后端状态.mockClear();
    const parsing = 操作.请求附件解析(文件A.file_id, true);
    await vi.waitFor(() => expect(后端.读取附件简历库).toHaveBeenCalledTimes(1));
    会话代际.current += 1;
    reread.resolve({ items: [], limits });
    await expect(parsing).resolves.toBe('已换代');
    expect(设后端状态).not.toHaveBeenCalled();
    expect(后端状态引用.current.附件简历库?.items).toEqual([文件A]);
  });
});

describe('创建附件简历操作 · 提交序号协调器', () => {
  it('an older polling GET cannot overwrite the authoritative GET after a delete', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    const oldPoll = 可控Promise<BFF附件简历库>();
    后端.读取附件简历库
      .mockReturnValueOnce(oldPoll.promise)
      .mockResolvedValueOnce({ items: [], limits });
    后端.删除附件简历.mockResolvedValue({ deleted: true });
    const polling = 操作.刷新附件简历();
    const deleting = 操作.删除附件简历(文件A.file_id);
    await vi.waitFor(() => expect(后端.删除附件简历).toHaveBeenCalledTimes(1));
    oldPoll.resolve({ items: [文件A], limits });
    await Promise.all([polling, deleting]);
    expect(后端状态引用.current.附件简历库?.items).toEqual([]);
  });

  it('a later failed poll cannot make a successful delete reject', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    const authority = 可控Promise<BFF附件简历库>();
    后端.读取附件简历库
      .mockReturnValueOnce(authority.promise)
      .mockRejectedValueOnce(new BFF错误(0, 'network_error', 'offline'));
    后端.删除附件简历.mockResolvedValue({ deleted: true });
    const deleting = 操作.删除附件简历(文件A.file_id);
    await vi.waitFor(() => expect(后端.读取附件简历库).toHaveBeenCalledTimes(1));
    const pollingRejection = expect(操作.刷新附件简历()).rejects.toMatchObject({ code: 'network_error' });
    expect(后端.读取附件简历库).toHaveBeenCalledTimes(2);
    authority.resolve({ items: [], limits });
    await expect(deleting).resolves.toBe('已提交');
    await pollingRejection;
    expect(后端状态引用.current.附件简历库?.items).toEqual([]);
  });

  it('a stalled poll does not delay delete authority GET or let the old result overwrite it', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端状态引用.current.附件简历库 = { items: [文件A], limits };
    const stalledPoll = 可控Promise<BFF附件简历库>();
    后端.读取附件简历库
      .mockReturnValueOnce(stalledPoll.promise)
      .mockResolvedValueOnce({ items: [], limits });
    后端.删除附件简历.mockResolvedValue({ deleted: true });
    const polling = 操作.刷新附件简历();
    const deleting = 操作.删除附件简历(文件A.file_id);
    await expect(deleting).resolves.toBe('已提交');
    expect(后端.读取附件简历库).toHaveBeenCalledTimes(2);
    expect(后端状态引用.current.附件简历库?.items).toEqual([]);
    stalledPoll.resolve({ items: [文件A], limits });
    await polling;
    expect(后端状态引用.current.附件简历库?.items).toEqual([]);
  });
});

describe('创建附件简历操作 · Mock / 无后端', () => {
  it('无后端时 mutation 返回 已换代、read 静默、download 抛 backend_unavailable', async () => {
    const 后端 = {
      读取附件简历库: vi.fn(),
      创建附件简历: vi.fn(),
      替换附件简历: vi.fn(),
      删除附件简历: vi.fn(),
      请求附件解析: vi.fn(),
      下载附件简历: vi.fn(),
      清空目录缓存: vi.fn(),
    };
    const { deps, 后端状态引用 } = 创建附件测试依赖(后端 as unknown as HTTP招聘数据源, false);
    const 操作 = 创建附件简历操作(deps);
    await expect(操作.创建附件简历(pdf, true)).resolves.toBe('已换代');
    await expect(操作.替换附件简历('rf_1', pdf, true)).resolves.toBe('已换代');
    await expect(操作.删除附件简历('rf_1')).resolves.toBe('已换代');
    await expect(操作.请求附件解析('rf_1', true)).resolves.toBe('已换代');
    await 操作.刷新附件简历();
    await expect(操作.下载附件简历('rf_1')).rejects.toMatchObject({
      status: 0,
      code: 'backend_unavailable',
    });
    expect(后端.读取附件简历库).not.toHaveBeenCalled();
    expect(后端.创建附件简历).not.toHaveBeenCalled();
    expect(后端.下载附件简历).not.toHaveBeenCalled();
    expect(后端状态引用.current.附件简历库).toBeNull();
  });
});

// ── P5 Task 3：委托前的权威库准备（准备候选委托简历）──────────────────────────
//   不新增第二套读取：走 factory 既有的 读取并提交 协调器，屏拿到的就是已提交的权威快照。
//   换代（读途中 / 失败迟到）一律 null 静默；当前会话 401 与 刷新附件简历 同口径清账号。
describe('创建附件简历操作 · 委托前的权威库准备', () => {
  it('返回协调器已提交的权威快照本体，只发一次 GET', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    const 权威附件库: BFF附件简历库 = { items: [文件A, 文件B], limits };
    后端.读取附件简历库.mockResolvedValue(权威附件库);
    await expect(操作.准备候选委托简历()).resolves.toEqual(权威附件库);
    expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
    // 读到的同时照常提交进全局快照（同一协调器，不是屏外的第二份真相）
    expect(后端状态引用.current.附件简历库).toEqual(权威附件库);
  });

  it('读途中会话换代：返回 null 且不提交，绝不当成空库', async () => {
    const { 后端, 操作, 设后端状态, 会话代际 } = 创建场景();
    const 门 = 可控Promise<BFF附件简历库>();
    后端.读取附件简历库.mockReturnValue(门.promise);
    设后端状态.mockClear();
    const promise = 操作.准备候选委托简历();
    会话代际.current += 1;
    门.resolve({ items: [], limits });
    await expect(promise).resolves.toBeNull();
    expect(设后端状态).not.toHaveBeenCalled();
  });

  it('读途中主体标识变化同样返回 null（fence 任一分量失效即换代）', async () => {
    const { 后端, 操作, 设后端状态, 主体标识引用 } = 创建场景();
    const 门 = 可控Promise<BFF附件简历库>();
    后端.读取附件简历库.mockReturnValue(门.promise);
    设后端状态.mockClear();
    const promise = 操作.准备候选委托简历();
    主体标识引用.current = 'sub_other';
    门.resolve({ items: [文件B], limits });
    await expect(promise).resolves.toBeNull();
    expect(设后端状态).not.toHaveBeenCalled();
  });

  it('当前会话 401：统一清账号后原样抛出', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端.读取附件简历库.mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(操作.准备候选委托简历()).rejects.toMatchObject({ status: 401 });
    expect(后端状态引用.current).toEqual(expect.objectContaining({
      已登录: false, 主体: null, 附件简历库: null,
    }));
    expect(后端.清空目录缓存).toHaveBeenCalled();
  });

  it('会话换代后到达的读失败静默返回 null，不清新会话', async () => {
    const { 后端, 操作, 后端状态引用, 会话代际 } = 创建场景();
    const 门 = 可控Promise<BFF附件简历库>();
    后端.读取附件简历库.mockReturnValue(门.promise);
    const promise = 操作.准备候选委托简历();
    会话代际.current += 1;
    门.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(promise).resolves.toBeNull();
    expect(后端状态引用.current.已登录).toBe(true);
    expect(后端.清空目录缓存).not.toHaveBeenCalled();
  });

  it('当前会话的非 401 失败原样抛出且不清账号', async () => {
    const { 后端, 操作, 后端状态引用 } = 创建场景();
    后端.读取附件简历库.mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    await expect(操作.准备候选委托简历()).rejects.toMatchObject({ status: 503 });
    expect(后端状态引用.current.已登录).toBe(true);
  });

  it('Mock / 无后端返回 null 且不发任何请求', async () => {
    const 后端 = {
      读取附件简历库: vi.fn(),
      创建附件简历: vi.fn(),
      替换附件简历: vi.fn(),
      删除附件简历: vi.fn(),
      请求附件解析: vi.fn(),
      下载附件简历: vi.fn(),
      清空目录缓存: vi.fn(),
    };
    const { deps } = 创建附件测试依赖(后端 as unknown as HTTP招聘数据源, false);
    const 操作 = 创建附件简历操作(deps);
    await expect(操作.准备候选委托简历()).resolves.toBeNull();
    expect(后端.读取附件简历库).not.toHaveBeenCalled();
  });
});

// ── J-PILOT-02 Task 6：onboarding 单槽跟踪与 exact source 回执 ──────────
// 铁律（Global 4/5/6 + 设计 §4.2）：文件命令只登记坐标与核对元数据（name/type/size/
// lastModified/SHA-256），PDF 字节与解析正文绝不进 请求体/文件核对；本次上传回执的
// exact source 立刻交给调用方（权威 GET 失败也不丢 file/version/parse）；一个槽未结算
// 时另一份字节的 mutation 零发送；同字节重放沿用原幂等键/原 ifMatch，绝不自动重传。

/**
 * 数据源桩：按真实 附件简历数据源 的同序行为驱动跟踪 —— 发送前固定命令 → 发请求 →
 * 成功后立刻 已确认 交回执（失败则只固定过命令）。操作层的单槽/回执语义必须在这条
 * 真实次序下成立，而不是靠桩额外配合。
 */
function 创建桩(文件: BFF附件简历, 抛出?: unknown) {
  return async (_file: File, _consent: true, 跟踪?: 建档写入跟踪) => {
    const 定 = 跟踪?.发送前({ 种类: 'resume-file-create', 阶段: 'prepared' });
    if (抛出 !== undefined) throw 抛出;
    if (跟踪 && 定) {
      跟踪.已确认(定, {
        id: 文件.file_id,
        revision: 文件.revision,
        source: { file_id: 文件.file_id, version_id: 文件.current_version.version_id, parse_id: null },
      });
    }
    return 文件;
  };
}

function 替换桩(文件: BFF附件简历, 抛出?: unknown) {
  return async (fileId: string, revision: number, _file: File, _consent: true, 跟踪?: 建档写入跟踪) => {
    const 定 = 跟踪?.发送前({ 种类: 'resume-file-replace', 资源编号: fileId, ifMatch: revision, 阶段: 'prepared' });
    if (抛出 !== undefined) throw 抛出;
    if (跟踪 && 定) {
      跟踪.已确认(定, {
        id: 文件.file_id,
        revision: 文件.revision,
        source: { file_id: 文件.file_id, version_id: 文件.current_version.version_id, parse_id: null },
      });
    }
    return 文件;
  };
}

function 解析桩(状态: BFF附件简历['current_version']['parse']) {
  return async (fileId: string, versionId: string, consent: true, 跟踪?: 建档写入跟踪) => {
    const 定 = 跟踪?.发送前({
      种类: 'resume-file-parse',
      资源编号: fileId,
      请求体: { version_id: versionId, processing_consent_confirmed: consent },
      阶段: 'prepared',
    });
    if (跟踪 && 定) {
      跟踪.已确认(定, {
        source: {
          file_id: fileId,
          version_id: versionId,
          parse_id: 状态.status === 'succeeded' ? 状态.parse_id : null,
        },
      });
    }
    return 状态;
  };
}

/** 与生产同口径的十六进制 SHA-256（测试侧独立实现，用来钉死落盘的核对元数据）。 */
async function 摘要(file: File): Promise<string> {
  const 缓冲 = await file.arrayBuffer();
  const 摘 = await globalThis.crypto.subtle.digest('SHA-256', 缓冲);
  return [...new Uint8Array(摘)].map((字节) => 字节.toString(16).padStart(2, '0')).join('');
}

describe('创建附件简历操作 · onboarding 建档跟踪与 exact source（Task 6）', () => {
  /**
   * 「旅程中返回上传页」场景：建档草稿已经存在，于是这一次上传会登记单槽。
   *
   * 这是生产上真实可达的状态，不是为测试捏造的（review r1 #5 的可达性核对）：
   * 学生分流.启程并跳转() 派发 启程引导 建出 引导预填 后 跳转(基本信息)（push，不清栈）；
   * 基本信息.存基本信息 在 旅程中 时调 更新候选建档草稿(并入建档草稿(...))，于是
   * 引导预填.建档 出现；应用状态.tsx 每次渲染把 建档草稿引用.current 绑成
   * 状态.引导预填?.建档 ?? null；基本信息 的 返回栏 走 前往(-1) 退回 学生分流 ——
   * 此时再上传/替换，草稿在场、单槽登记生效。
   * 反过来，**首次**上传时 引导预填.建档 还不存在（启程引导 不种 建档），
   * 走的是 要登记单槽()=false 的零登记路径 —— 下面「没有 active 建档草稿」用例钉住它。
   */
  function 建档场景() {
    const 场景 = 创建场景();
    场景.建档草稿引用.current = { 资料: { 个人优势: '已写了一半' } };
    return 场景;
  }

  it('create：槽只登记坐标与文件核对（零字节、零请求体），成功后清槽并交出 exact source', async () => {
    const 场景 = 建档场景();
    const created = { ...文件A, file_id: 'rf_created' };
    场景.后端.创建附件简历.mockImplementation(创建桩(created));
    场景.后端.读取附件简历库.mockResolvedValue({ items: [created], limits });
    const 绑定来源 = vi.fn();
    const 结果 = await 场景.操作.创建附件简历(pdf, true, 绑定来源);
    expect(结果).toBe('已提交');
    // 数据源收到跟踪（第三参）
    expect(场景.后端.创建附件简历.mock.calls[0][2]).toBeTruthy();
    // 发送前落过一条 prepared 槽：五键文件核对、无请求体
    const 落过的槽 = 场景.草稿写入.mock.calls
      .map(([建档]) => 建档.待写入)
      .filter((槽): 槽 is NonNullable<typeof 槽> => 槽 !== undefined);
    expect(落过的槽).toHaveLength(1);
    expect(落过的槽[0].种类).toBe('resume-file-create');
    expect(落过的槽[0].阶段).toBe('prepared');
    expect(落过的槽[0].请求体).toBeUndefined();
    expect(typeof 落过的槽[0].幂等键).toBe('string');
    expect(Object.keys(落过的槽[0].文件核对!).sort())
      .toEqual(['lastModified', 'name', 'sha256', 'size', 'type']);
    expect(落过的槽[0].文件核对).toEqual({
      name: pdf.name, type: pdf.type, size: pdf.size, lastModified: pdf.lastModified,
      sha256: await 摘要(pdf),
    });
    // 已确认：槽清空（received 槽绝不留给后续 resume 域命令）
    expect(场景.建档草稿引用.current?.待写入).toBeUndefined();
    expect(场景.建档草稿引用.current?.资料).toEqual({ 个人优势: '已写了一半' });
    // exact source 交给调用方（parse 尚未开始 → parse_id null）
    expect(绑定来源).toHaveBeenCalledTimes(1);
    expect(绑定来源).toHaveBeenCalledWith({
      file_id: 'rf_created', version_id: created.current_version.version_id, parse_id: null,
    });
  });

  it('receipt 之后权威 GET 失败：exact source 已交出、槽已结算，错误原样抛给调用方', async () => {
    const 场景 = 建档场景();
    const created = { ...文件A, file_id: 'rf_created' };
    场景.后端.创建附件简历.mockImplementation(创建桩(created));
    场景.后端.读取附件简历库.mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    const 绑定来源 = vi.fn();
    await expect(场景.操作.创建附件简历(pdf, true, 绑定来源)).rejects.toMatchObject({ status: 503 });
    expect(绑定来源).toHaveBeenCalledWith({
      file_id: 'rf_created', version_id: created.current_version.version_id, parse_id: null,
    });
    expect(场景.建档草稿引用.current?.待写入).toBeUndefined();
  });

  it('槽未结算 + 另一份字节：零 mutation，提示按原步骤重选同一份文件', async () => {
    const 场景 = 建档场景();
    场景.建档草稿引用.current = {
      待写入: {
        种类: 'resume-file-create', 阶段: 'prepared', 幂等键: 'key-of-the-first-upload',
        文件核对: { name: '第一份.pdf', type: 'application/pdf', size: 8, lastModified: 1, sha256: 'f'.repeat(64) },
      },
    };
    场景.后端.创建附件简历.mockImplementation(创建桩({ ...文件A, file_id: 'rf_created' }));
    await expect(场景.操作.创建附件简历(pdf, true, vi.fn())).rejects.toMatchObject({
      message: '上一条写入结果未确认，请先重试或核对原步骤',
    });
    expect(场景.后端.读取附件简历库).not.toHaveBeenCalled(); // 本地拦截不是结果未知，不做歧义恢复
    expect(场景.建档草稿引用.current?.待写入?.幂等键).toBe('key-of-the-first-upload');
  });

  it('槽未结算 + 重选同一份字节：沿用原幂等键重放，绝不铸新键', async () => {
    const 场景 = 建档场景();
    const 原键 = 'key-of-the-first-upload';
    场景.建档草稿引用.current = {
      待写入: {
        种类: 'resume-file-create', 阶段: 'prepared', 幂等键: 原键,
        文件核对: {
          name: pdf.name, type: pdf.type, size: pdf.size, lastModified: pdf.lastModified,
          sha256: await 摘要(pdf),
        },
      },
    };
    const created = { ...文件A, file_id: 'rf_created' };
    场景.后端.创建附件简历.mockImplementation(创建桩(created));
    场景.后端.读取附件简历库.mockResolvedValue({ items: [created], limits });
    const 跟踪收口 = vi.fn();
    await expect(场景.操作.创建附件简历(pdf, true, 跟踪收口)).resolves.toBe('已提交');
    const 跟踪 = 场景.后端.创建附件简历.mock.calls[0][2] as { 发送前: (命令: unknown) => { 幂等键?: string } };
    expect(跟踪).toBeTruthy();
    expect(场景.建档草稿引用.current?.待写入).toBeUndefined();
    const 重放槽 = 场景.草稿写入.mock.calls
      .map(([建档]) => 建档.待写入)
      .filter((槽): 槽 is NonNullable<typeof 槽> => 槽 !== undefined);
    expect(重放槽.every((槽) => 槽.幂等键 === 原键)).toBe(true);
  });

  // review r1 #3：清槽与「结果未知」必须出自同一处分类。503 storage_unavailable /
  // downstream_unavailable 都会走歧义恢复重读 —— 结果不确定，槽与原幂等键必须留着；
  // 丢掉它等于丢掉幂等键，用户再试会铸新键，造出重复的附件简历。
  it('503 storage_unavailable：保留槽与原幂等键（不铸新键造重复文件）', async () => {
    const 场景 = 建档场景();
    场景.后端.创建附件简历.mockImplementation(创建桩(文件A, new BFF错误(503, 'storage_unavailable', 'down')));
    场景.后端.读取附件简历库.mockResolvedValue({ items: [], limits }); // 库集合未变：无从判定已达成
    await expect(场景.操作.创建附件简历(pdf, true, vi.fn())).rejects.toMatchObject({ code: 'storage_unavailable' });
    const 槽 = 场景.建档草稿引用.current?.待写入;
    expect(槽?.种类).toBe('resume-file-create');
    expect(槽?.阶段).toBe('prepared');
    const 登记时的键 = 场景.草稿写入.mock.calls[0][0].待写入?.幂等键;
    expect(槽?.幂等键).toBe(登记时的键);
    expect(场景.后端.创建附件简历).toHaveBeenCalledTimes(1); // 绝不自动重传
  });

  // review r1 #2：摘要拿不到就不能登记 —— 没有 文件核对 的两条 create 会被判成同一条，
  // 把原幂等键用到另一份字节上（Global 6 明令禁止）。上传本身照常进行。
  it('SHA-256 不可用：本次不登记单槽（也就不会拿原幂等键配另一份字节），上传照常', async () => {
    const 场景 = 建档场景();
    const 摘要桩 = vi.spyOn(globalThis.crypto.subtle, 'digest')
      .mockRejectedValue(new Error('SubtleCrypto unavailable'));
    try {
      const created = { ...文件A, file_id: 'rf_created' };
      场景.后端.创建附件简历.mockImplementation(创建桩(created));
      场景.后端.读取附件简历库.mockResolvedValue({ items: [created], limits });
      const 绑定来源 = vi.fn();
      await expect(场景.操作.创建附件简历(pdf, true, 绑定来源)).resolves.toBe('已提交');
      expect(场景.草稿写入).not.toHaveBeenCalled();
      expect(场景.建档草稿引用.current?.待写入).toBeUndefined();
      expect(场景.后端.创建附件简历.mock.calls[0][2]).toBeUndefined(); // 数据源没拿到跟踪
      expect(绑定来源).toHaveBeenCalledWith({
        file_id: 'rf_created', version_id: created.current_version.version_id, parse_id: null,
      });
    } finally {
      摘要桩.mockRestore();
    }
  });

  it('服务端确定拒绝（400）：清槽，不把后续上传永久锁死', async () => {
    const 场景 = 建档场景();
    场景.后端.创建附件简历.mockImplementation(创建桩(文件A, new BFF错误(400, 'invalid_pdf', 'bad pdf')));
    await expect(场景.操作.创建附件简历(pdf, true, vi.fn())).rejects.toMatchObject({ code: 'invalid_pdf' });
    expect(场景.建档草稿引用.current?.待写入).toBeUndefined();
  });

  it('结果未知（503 operation_outcome_unknown）：槽保留待核对，绝不自动重传 multipart', async () => {
    const 场景 = 建档场景();
    场景.后端.创建附件简历.mockImplementation(创建桩(文件A, new BFF错误(503, 'operation_outcome_unknown', 'unknown')));
    场景.后端.读取附件简历库.mockResolvedValue({ items: [], limits });
    await expect(场景.操作.创建附件简历(pdf, true, vi.fn())).rejects.toMatchObject({ status: 503 });
    expect(场景.建档草稿引用.current?.待写入?.种类).toBe('resume-file-create');
    expect(场景.建档草稿引用.current?.待写入?.阶段).toBe('prepared');
    expect(场景.后端.创建附件简历).toHaveBeenCalledTimes(1); // 只发过一次
  });

  it('replace：槽带资源编号与原 revision 的 ifMatch，回执交出新版本坐标', async () => {
    const 场景 = 建档场景();
    场景.后端状态引用.current.附件简历库 = { items: [文件A], limits };
    const 新版本 = { ...文件A, revision: 3, current_version: { ...文件A.current_version, version_id: 'rfv_2' } };
    场景.后端.替换附件简历.mockImplementation(替换桩(新版本));
    场景.后端.读取附件简历库.mockResolvedValue({ items: [新版本], limits });
    const 绑定来源 = vi.fn();
    await expect(场景.操作.替换附件简历('rf_1', pdf, true, 绑定来源)).resolves.toBe('已提交');
    const 槽 = 场景.草稿写入.mock.calls.map(([建档]) => 建档.待写入).find((项) => 项 !== undefined)!;
    expect(槽.种类).toBe('resume-file-replace');
    expect(槽.资源编号).toBe('rf_1');
    expect(槽.ifMatch).toBe(文件A.revision);
    expect(槽.请求体).toBeUndefined();
    expect(绑定来源).toHaveBeenCalledWith({ file_id: 'rf_1', version_id: 'rfv_2', parse_id: null });
  });

  it('parse：槽的请求体恰为 wire 两键，回执按真实解析状态交 parse_id', async () => {
    const 场景 = 建档场景();
    场景.后端状态引用.current.附件简历库 = { items: [文件A], limits };
    场景.后端.请求附件解析.mockImplementation(解析桩(文件已完成.current_version.parse));
    场景.后端.读取附件简历库.mockResolvedValue({ items: [文件已完成], limits });
    const 绑定来源 = vi.fn();
    await expect(场景.操作.请求附件解析('rf_1', true, 绑定来源)).resolves.toBe('已提交');
    const 槽 = 场景.草稿写入.mock.calls.map(([建档]) => 建档.待写入).find((项) => 项 !== undefined)!;
    expect(槽.种类).toBe('resume-file-parse');
    expect(槽.请求体).toEqual({ version_id: 'rfv_1', processing_consent_confirmed: true });
    expect(槽.文件核对).toBeUndefined();
    expect(绑定来源).toHaveBeenCalledWith({ file_id: 'rf_1', version_id: 'rfv_1', parse_id: 'ps_1' });
  });

  it('日常上传（无 onboarding 绑定）：数据源不收跟踪、草稿零写入', async () => {
    const 场景 = 建档场景();
    const created = { ...文件A, file_id: 'rf_created' };
    场景.后端.创建附件简历.mockImplementation(创建桩(created));
    场景.后端.读取附件简历库.mockResolvedValue({ items: [created], limits });
    await expect(场景.操作.创建附件简历(pdf, true)).resolves.toBe('已提交');
    expect(场景.后端.创建附件简历).toHaveBeenCalledWith(pdf, true);
    expect(场景.草稿写入).not.toHaveBeenCalled();
  });

  it('没有 active 建档草稿时即使带绑定也零草稿写入，来源照常交出', async () => {
    const 场景 = 创建场景(); // 建档草稿引用.current === null
    const created = { ...文件A, file_id: 'rf_created' };
    场景.后端.创建附件简历.mockImplementation(创建桩(created));
    场景.后端.读取附件简历库.mockResolvedValue({ items: [created], limits });
    const 绑定来源 = vi.fn();
    await expect(场景.操作.创建附件简历(pdf, true, 绑定来源)).resolves.toBe('已提交');
    expect(场景.草稿写入).not.toHaveBeenCalled();
    expect(绑定来源).toHaveBeenCalledWith({
      file_id: 'rf_created', version_id: created.current_version.version_id, parse_id: null,
    });
  });

  it('会话换代后到达的回执不交来源、不写草稿（迟到整包丢弃）', async () => {
    const 场景 = 建档场景();
    const 门 = 可控Promise<BFF附件简历>();
    场景.后端.创建附件简历.mockImplementation(() => 门.promise);
    场景.后端.读取附件简历库.mockResolvedValue({ items: [], limits });
    const 绑定来源 = vi.fn();
    const 在飞 = 场景.操作.创建附件简历(pdf, true, 绑定来源);
    场景.会话代际.current += 1;
    门.resolve({ ...文件A, file_id: 'rf_created' });
    await expect(在飞).resolves.toBe('已换代');
    expect(绑定来源).not.toHaveBeenCalled();
  });
});
