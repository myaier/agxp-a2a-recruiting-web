// P7 Task 2：真人会话运行时状态的行为测试 —— 收件箱/详情/消息页的 scope 快照、
// 从第一页重建已载窗口、游标追加（收件箱 append / 更早消息 prepend）、单飞与读锁接管、
// 发送意图键生命周期（同文同键、结果未知三分支对账、显式放弃、in_progress 不可放弃、
// conflict 终局换键）、forward-only 已读位置（decimal 单飞去重 + role_* 终局拒绝）、
// 401/会话清理与引用复位。受控 deferred promise 证明原子提交与迟到丢弃；
// 派发 只是 spy，全部断言读 最新状态()。快照只进内存（后端状态），绝不进持久化。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF主体 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import type { P7会话项, P7会话页, P7消息, P7消息页 } from '../../数据/招聘数据源/真人会话';
import { BFF错误 } from '../../数据/HTTP客户端';
import { BFF主体样本 } from '../../测试/BFF样本';
import { 初始状态 } from '../初始状态';
import type { 动作 } from '../应用状态';
import { 创建空P4发现状态 } from './发现推荐操作';
import { 创建空P5MatchCase状态 } from './MatchCase操作';
import {
  P7范围键,
  创建真人会话操作,
  创建空P7会话状态,
  取P7错误文案,
  清P7会话引用,
} from './真人会话操作';
import { 创建空P8控制面状态 } from './P8控制面操作';
import type {
  P7待定意图,
  P7已读位置记录,
  P7运行时引用,
  后端操作依赖,
  后端状态,
  真人会话操作,
} from './类型';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const 候选主体: BFF主体 = { ...BFF主体样本, last_used_role: 'candidate' };
const 招聘主体: BFF主体 = { ...BFF主体样本, last_used_role: 'recruiter' };

// ── DTO 样本：在 facade 边界直接给已 decode 的归一化 P7 DTO（decode 归 Task 1）──

function 会话项(conversationId: string, unreadCount = 0): P7会话项 {
  return {
    conversationId,
    caseId: `mc_${conversationId}`,
    kind: 'human_handoff',
    lastMessage: null,
    lastActivityAt: '2026-08-30T01:00:00Z',
    unreadCount,
    contextStatus: 'available',
    context: {
      primaryLabel: '后端工程师',
      secondaryLabel: '上海·浦东',
      jobRef: 'job_00112233445566778899aabbccddeeff',
      resumeRef: 'rf_00112233445566778899aabbccddeeff',
    },
  };
}

function 会话页(items: P7会话项[], nextCursor: string | null): P7会话页 {
  return { items, nextCursor };
}

const 系统行: P7消息 = {
  messageId: 'system:3003',
  kind: 'conversation_started',
  senderRole: 'system',
  createdAt: '2026-08-30T00:00:00Z',
};

function 文本消息(messageId: string, senderRole: 'candidate' | 'recruiter', content: string): P7消息 {
  return { messageId, kind: 'user_text', senderRole, content, createdAt: '2026-08-30T01:00:00Z' };
}

function 消息页(messages: P7消息[], nextCursor: string | null): P7消息页 {
  return { messages, nextCursor };
}

/** 本文件内的数据源桩：桩 P7 facade 全部方法 + 清空目录缓存，默认全成功，逐测试覆盖替换。 */
function 创建P7数据源(覆盖: Record<string, unknown> = {}): HTTP招聘数据源 {
  return {
    读取会话列表: vi.fn(async (): Promise<P7会话页> => 会话页([], null)),
    读取会话: vi.fn(async (): Promise<P7会话项> => 会话项('3003')),
    读取消息: vi.fn(async (): Promise<P7消息页> => 消息页([系统行], null)),
    发送消息: vi.fn(async (): Promise<P7消息> => 文本消息('4005', 'candidate', '你好')),
    标为已读: vi.fn(async (): Promise<string> => '4004'),
    清空目录缓存: vi.fn(),
    ...覆盖,
  } as unknown as HTTP招聘数据源;
}

interface P7操作测试环境 {
  数据源: HTTP招聘数据源;
  deps: 后端操作依赖 & P7运行时引用;
  派发: ReturnType<typeof vi.fn>;
  操作: 真人会话操作;
  最新状态(): 后端状态;
}

function 创建P7操作测试环境(是后端 = true, 源 = 创建P7数据源()): P7操作测试环境 {
  const 状态引用 = { current: 初始状态 };
  const 派发 = vi.fn<(动作: 动作) => void>();
  let 后端值: 后端状态 = {
    初始化: '完成',
    已登录: true,
    主体: 候选主体,
    简历快照: null,
    意向快照: {},
    岗位快照: {},
    隐私快照: null,
    附件简历库: null,
    候选规则快照: {},
    招聘规则快照: {},
    候选规则提案: {},
    招聘规则提案: {},
    Agent规则水合: {
      candidate: { rules: '未开始', proposals: '未开始' },
      recruiter: { rules: '未开始', proposals: '未开始' },
    },
    ...创建空P4发现状态(),
    ...创建空P5MatchCase状态(),
    ...创建空P7会话状态(),
    // P8：Task 3 起 后端状态 extends P8控制面状态（这里的用例不触达它们）
    ...创建空P8控制面状态(),
  };
  const deps: 后端操作依赖 & P7运行时引用 = {
    是后端,
    后端: 是后端 ? 源 : null,
    派发,
    设后端状态: vi.fn((更新: (旧: 后端状态) => 后端状态): 后端状态 => {
      后端值 = 更新(后端值);
      return 后端值;
    }),
    后端状态引用: {
      get current() {
        return 后端值;
      },
      set current(值: 后端状态) {
        后端值 = 值;
      },
    },
    状态引用,
    锁: { current: new Set<string>() },
    尝试引用: { current: null },
    主体标识引用: { current: 'sub_1' },
    会话代际: { current: 1 },
    读取恢复企业关系编号: vi.fn(() => null),
    P4范围代际: { current: new Map<string, number>() },
    P4幂等意图: { current: new Map<string, string>() },
    P4可见范围: { current: { candidate: null, recruiter: null } },
    P5范围代际: { current: new Map<string, number>() },
    P5幂等意图: { current: new Map<string, string>() },
    P5可见范围: { current: { candidate: null, recruiter: null } },
    P5对象租约: { current: new Set() },
    P7范围代际: { current: new Map<string, number>() },
    P7待定意图: { current: new Map<string, P7待定意图>() },
    P7可见收件箱: { current: { candidate: false, recruiter: false } },
    P7可见会话: { current: { candidate: null, recruiter: null } },
    P7已读位置: { current: new Map<string, P7已读位置记录>() },
  };
  return {
    数据源: 源,
    deps,
    派发,
    操作: 创建真人会话操作(deps),
    最新状态: () => 后端值,
  };
}

let env: P7操作测试环境;

beforeEach(() => {
  env = 创建P7操作测试环境();
});

// ── 收件箱与分页 ──

describe('P7 真人会话运行时', () => {
  it('首读收件箱落成功快照，非 force 的重复加载零请求', async () => {
    vi.mocked(env.数据源.读取会话列表).mockResolvedValueOnce(会话页([会话项('3003', 1)], 'Pg1_1'));
    await env.操作.加载会话列表('candidate');
    expect(env.最新状态().P7收件箱.candidate).toMatchObject({
      阶段: '成功', 刷新中: false, nextCursor: 'Pg1_1', 已加载页数: 1,
      items: [{ conversationId: '3003', unreadCount: 1 }],
    });
    await env.操作.加载会话列表('candidate');
    expect(env.数据源.读取会话列表).toHaveBeenCalledTimes(1);
  });

  it('force 刷新保留旧成功内容直至新页原子替换', async () => {
    vi.mocked(env.数据源.读取会话列表).mockResolvedValueOnce(会话页([会话项('3003')], null));
    await env.操作.加载会话列表('candidate');
    const 门 = deferred<P7会话页>();
    vi.mocked(env.数据源.读取会话列表).mockReturnValueOnce(门.promise);
    const run = env.操作.加载会话列表('candidate', true);
    // 途中：仍是成功快照 + 轻量刷新态 + 旧 items 不降级
    expect(env.最新状态().P7收件箱.candidate).toMatchObject({
      阶段: '成功', 刷新中: true, items: [{ conversationId: '3003' }], error: null,
    });
    门.resolve(会话页([会话项('3001')], null));
    await run;
    expect(env.最新状态().P7收件箱.candidate).toMatchObject({
      阶段: '成功', 刷新中: false, items: [{ conversationId: '3001' }],
    });
  });

  it('追加会话列表透传 cursor 并 append；游标已尽零请求；稀疏页也推进页数', async () => {
    vi.mocked(env.数据源.读取会话列表)
      .mockResolvedValueOnce(会话页([会话项('3003')], 'Pg1_1'))
      .mockResolvedValueOnce(会话页([], 'Pg2_1'))
      .mockResolvedValueOnce(会话页([会话项('3001')], null));
    await env.操作.加载会话列表('candidate');
    await env.操作.追加会话列表('candidate');
    // 稀疏页（items 空但 next_cursor 在）：页数推进、cursor 前进
    expect(env.最新状态().P7收件箱.candidate).toMatchObject({
      items: [{ conversationId: '3003' }], nextCursor: 'Pg2_1', 已加载页数: 2,
    });
    expect(vi.mocked(env.数据源.读取会话列表).mock.calls[1]).toEqual(['candidate', 'Pg1_1']);
    await env.操作.追加会话列表('candidate');
    expect(env.最新状态().P7收件箱.candidate).toMatchObject({
      items: [{ conversationId: '3003' }, { conversationId: '3001' }],
      nextCursor: null, 已加载页数: 3,
    });
    // 游标已尽：再追加零请求
    const 之前 = vi.mocked(env.数据源.读取会话列表).mock.calls.length;
    await env.操作.追加会话列表('candidate');
    expect(env.数据源.读取会话列表).toHaveBeenCalledTimes(之前);
  });

  it('同 scope 收件箱读单飞：并发两次只发一次请求', async () => {
    const 门 = deferred<P7会话页>();
    vi.mocked(env.数据源.读取会话列表).mockReturnValueOnce(门.promise);
    const a = env.操作.加载会话列表('candidate');
    const b = env.操作.加载会话列表('candidate', true);
    expect(env.数据源.读取会话列表).toHaveBeenCalledTimes(1);
    门.resolve(会话页([], null));
    await Promise.all([a, b]);
  });

  it('会话代际变化后迟到的成功整包丢弃', async () => {
    const 门 = deferred<P7会话页>();
    vi.mocked(env.数据源.读取会话列表).mockReturnValueOnce(门.promise);
    const run = env.操作.加载会话列表('candidate', true);
    env.deps.会话代际.current += 1;
    门.resolve(会话页([会话项('3003')], null));
    await run;
    expect(env.最新状态().P7收件箱.candidate.items).toEqual([]);
  });

  it('换主体 / 换角色后迟到的成败都不写快照', async () => {
    const 门 = deferred<P7会话页>();
    vi.mocked(env.数据源.读取会话列表).mockReturnValueOnce(门.promise);
    const run = env.操作.加载会话列表('candidate', true);
    env.deps.主体标识引用.current = 'sub_2';
    门.resolve(会话页([会话项('3003')], null));
    await run;
    expect(env.最新状态().P7收件箱.candidate.items).toEqual([]);

    const 门2 = deferred<P7会话页>();
    vi.mocked(env.数据源.读取会话列表).mockReset()
      .mockReturnValueOnce(门2.promise);
    const run2 = env.操作.加载会话列表('candidate', true);
    env.deps.设后端状态((旧) => ({ ...旧, 主体: 招聘主体 }));
    门2.reject(new BFF错误(503, 'message_service_unavailable', 'down'));
    await run2;
    expect(env.最新状态().P7收件箱.candidate.阶段).not.toBe('失败');
  });

  it('读取真人会话并行读取详情与最新消息页，直达不依赖收件箱', async () => {
    vi.mocked(env.数据源.读取消息).mockResolvedValueOnce(消息页([系统行, 文本消息('4004', 'candidate', '在吗')], null));
    await env.操作.读取真人会话('candidate', '3003');
    expect(env.数据源.读取会话列表).not.toHaveBeenCalled();
    expect(env.数据源.读取会话).toHaveBeenCalledWith('candidate', '3003');
    expect(env.数据源.读取消息).toHaveBeenCalledWith('candidate', '3003');
    expect(env.最新状态().P7会话详情[P7范围键.详情('candidate', '3003')]).toMatchObject({
      阶段: '成功', detail: { conversationId: '3003' },
    });
    expect(env.最新状态().P7消息页[P7范围键.消息('candidate', '3003')]).toMatchObject({
      阶段: '成功', items: [系统行, 文本消息('4004', 'candidate', '在吗')], 已加载页数: 1,
    });
  });

  it('详情 404 清空旧内容，503 保留旧成功快照只落重试错误', async () => {
    vi.mocked(env.数据源.读取消息).mockResolvedValue(消息页([系统行], null));
    await env.操作.读取真人会话('candidate', '3003');
    vi.mocked(env.数据源.读取会话).mockRejectedValueOnce(
      new BFF错误(404, 'conversation_not_found', 'The conversation does not exist.'));
    await env.操作.读取真人会话('candidate', '3003', true);
    expect(env.最新状态().P7会话详情[P7范围键.详情('candidate', '3003')]).toEqual({
      阶段: '失败', 刷新中: false, detail: null,
      error: '这段会话不存在或已不可访问', generation: expect.any(Number),
    });
    // 消息页保留旧成功内容，只落错误
    vi.mocked(env.数据源.读取消息).mockRejectedValueOnce(
      new BFF错误(503, 'message_service_unavailable', 'down'));
    await env.操作.读取真人会话('candidate', '3003', true);
    const 消息快照 = env.最新状态().P7消息页[P7范围键.消息('candidate', '3003')];
    expect(消息快照.阶段).toBe('成功');
    expect(消息快照.items).toEqual([系统行]);
    expect(消息快照.error).toBe('消息服务暂时不可用，请重试');
  });

  it('追加更早消息把旧页 prepend、页数 +1，且重建窗口保持已载深度', async () => {
    vi.mocked(env.数据源.读取消息)
      .mockResolvedValueOnce(消息页([系统行, 文本消息('4004', 'candidate', '在吗')], 'older_1'))
      .mockResolvedValueOnce(消息页([文本消息('4001', 'recruiter', '你好')], null));
    await env.操作.读取真人会话('candidate', '3003');
    await env.操作.追加更早消息('candidate', '3003');
    expect(env.最新状态().P7消息页[P7范围键.消息('candidate', '3003')]).toMatchObject({
      items: [
        文本消息('4001', 'recruiter', '你好'),
        系统行,
        文本消息('4004', 'candidate', '在吗'),
      ],
      nextCursor: null, 已加载页数: 2,
    });
    expect(vi.mocked(env.数据源.读取消息).mock.calls[1]).toEqual(['candidate', '3003', 'older_1']);
  });

  it('设置P7会话范围换会话时作废在飞读取，卸载重挂不留旧快照回写', async () => {
    env.操作.设置P7会话范围('candidate', '3003');
    const 门 = deferred<P7会话项>();
    vi.mocked(env.数据源.读取会话).mockReturnValueOnce(门.promise);
    const run = env.操作.读取真人会话('candidate', '3003');
    env.操作.设置P7会话范围('candidate', '3004');
    门.resolve(会话项('3003'));
    await run;
    expect(env.最新状态().P7会话详情[P7范围键.详情('candidate', '3003')]?.detail ?? null).toBeNull();
    // 收件箱可见范围登记与注销只写引用，不发请求
    expect(env.数据源.读取会话列表).not.toHaveBeenCalled();
  });

  // ── 发送意图与未知结果对账 ──

  it('发送成功不乐观追加：权威重读后才出现，键释放、草稿语义交给屏层', async () => {
    const 门 = deferred<P7消息>();
    vi.mocked(env.数据源.发送消息).mockReturnValueOnce(门.promise);
    vi.mocked(env.数据源.读取消息).mockResolvedValue(
      消息页([系统行, 文本消息('4005', 'candidate', '你好')], null));
    const run = env.操作.发送真人消息('candidate', '3003', '  你好  ');
    // 在飞：不乐观追加，快照里没有 4005
    expect(env.最新状态().P7消息页[P7范围键.消息('candidate', '3003')]?.items ?? [])
      .not.toContainEqual(文本消息('4005', 'candidate', '你好'));
    门.resolve(文本消息('4005', 'candidate', '你好'));
    await expect(run).resolves.toEqual({ status: 'confirmed' });
    // 成功后：权威消息页/详情/收件箱重读，快照出现新消息
    expect(env.最新状态().P7消息页[P7范围键.消息('candidate', '3003')].items)
      .toContainEqual(文本消息('4005', 'candidate', '你好'));
    expect(env.数据源.读取会话).toHaveBeenCalled();
    expect(env.数据源.读取会话列表).toHaveBeenCalled();
    // POST 只带 trim 后正文与同一把键
    expect(vi.mocked(env.数据源.发送消息).mock.calls[0]).toEqual(
      ['candidate', '3003', '你好', expect.stringMatching(/^[!-~]{16,128}$/)]);
    expect(env.deps.P7待定意图.current.size).toBe(0);
  });

  it('结果未知：重拉在水位后看到本端同文消息即收敛 confirmed', async () => {
    // 预载权威消息快照（只有系统行 → 权威空水位）：对账的比对基准必须真实在场
    vi.mocked(env.数据源.读取消息).mockResolvedValueOnce(消息页([系统行], null));
    await env.操作.读取真人会话('candidate', '3003');
    vi.mocked(env.数据源.发送消息).mockRejectedValueOnce(
      new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    vi.mocked(env.数据源.读取消息).mockResolvedValue(
      消息页([系统行, 文本消息('4005', 'candidate', '你好')], null));
    await expect(env.操作.发送真人消息('candidate', '3003', '你好'))
      .resolves.toEqual({ status: 'confirmed' });
    expect(env.deps.P7待定意图.current.size).toBe(0);
  });

  it('结果未知：重拉成功无证据 → outcome_unknown 可放弃，同文重试沿用同一把键', async () => {
    vi.mocked(env.数据源.发送消息).mockRejectedValue(
      new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    vi.mocked(env.数据源.读取消息).mockResolvedValue(消息页([系统行], null));
    const first = await env.操作.发送真人消息('candidate', '3003', '  你好  ');
    expect(first).toEqual({
      status: 'unknown', reason: 'outcome_unknown', canAbandon: true, pendingContent: '你好',
    });
    // 意图仍在 Map：不可变中文正文只留在内存 Map 的意图里，键参数是纯可见 ASCII
    expect([...env.deps.P7待定意图.current.values()].some((意图) => 意图.content === '你好')).toBe(true);
    expect(vi.mocked(env.数据源.发送消息).mock.calls[0][3]).toMatch(/^[!-~]{16,128}$/);
    await env.操作.发送真人消息('candidate', '3003', '你好');
    const 调用 = vi.mocked(env.数据源.发送消息).mock.calls;
    expect(调用[0][3]).toBe(调用[1][3]);
    expect(调用[1][2]).toBe('你好');
  });

  it('结果未知：重拉失败 → outcome_unknown 不可放弃（只允许同键重试）', async () => {
    vi.mocked(env.数据源.发送消息).mockRejectedValueOnce(
      new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    vi.mocked(env.数据源.读取消息).mockRejectedValueOnce(new Error('网络断了'));
    await expect(env.操作.发送真人消息('candidate', '3003', '你好')).resolves.toEqual({
      status: 'unknown', reason: 'outcome_unknown', canAbandon: false, pendingContent: '你好',
    });
    // 收件箱重拉也照发（unknown 时立即重拉消息与收件箱）
    expect(env.数据源.读取会话列表).toHaveBeenCalled();
  });

  it('非空水位不在重拉窗口时绝不宣称成功', async () => {
    vi.mocked(env.数据源.读取消息).mockResolvedValueOnce(
      消息页([系统行, 文本消息('4004', 'candidate', '在吗')], null));
    await env.操作.读取真人会话('candidate', '3003');
    vi.mocked(env.数据源.发送消息).mockRejectedValueOnce(
      new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    // 重拉页里确实有本端同文消息 4005，但水位 4004 不在窗口内 —— 不确认
    vi.mocked(env.数据源.读取消息).mockResolvedValueOnce(
      消息页([文本消息('4005', 'candidate', '你好'), 文本消息('4006', 'recruiter', '好')], null));
    await expect(env.操作.发送真人消息('candidate', '3003', '你好')).resolves.toEqual({
      status: 'unknown', reason: 'outcome_unknown', canAbandon: true, pendingContent: '你好',
    });
  });

  it('显式放弃只清该不可变正文键；下一次同文发送铸新键', async () => {
    vi.mocked(env.数据源.发送消息).mockRejectedValueOnce(
      new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    vi.mocked(env.数据源.读取消息).mockResolvedValue(消息页([系统行], null));
    const first = await env.操作.发送真人消息('candidate', '3003', '你好');
    expect(first.status).toBe('unknown');
    const 旧键 = vi.mocked(env.数据源.发送消息).mock.calls[0][3];
    env.操作.放弃真人消息意图('candidate', '3003', '你好');
    expect(env.deps.P7待定意图.current.size).toBe(0);
    vi.mocked(env.数据源.发送消息).mockResolvedValueOnce(文本消息('4005', 'candidate', '你好'));
    await env.操作.发送真人消息('candidate', '3003', '你好');
    expect(vi.mocked(env.数据源.发送消息).mock.calls[1][3]).not.toBe(旧键);
  });

  it('最终 idempotency_in_progress 保留原键并返回不可放弃的 in_progress，零重拉', async () => {
    vi.mocked(env.数据源.发送消息).mockRejectedValueOnce(
      new BFF错误(409, 'idempotency_in_progress', 'in progress'));
    const 读调用前 = vi.mocked(env.数据源.读取消息).mock.calls.length;
    const first = await env.操作.发送真人消息('candidate', '3003', '你好');
    expect(first).toEqual({
      status: 'unknown', reason: 'in_progress', canAbandon: false, pendingContent: '你好',
    });
    expect(vi.mocked(env.数据源.读取消息).mock.calls.length).toBe(读调用前);
    // 同键重试：仍可用同一把键稍后再试
    vi.mocked(env.数据源.发送消息).mockRejectedValueOnce(
      new BFF错误(409, 'idempotency_in_progress', 'in progress'));
    await env.操作.发送真人消息('candidate', '3003', '你好');
    const 调用 = vi.mocked(env.数据源.发送消息).mock.calls;
    expect(调用[0][3]).toBe(调用[1][3]);
    expect(env.deps.P7待定意图.current.size).toBe(1);
  });

  it('idempotency_conflict 终局：原样抛出、刷新权威消息、换内容铸新键', async () => {
    vi.mocked(env.数据源.发送消息).mockRejectedValueOnce(
      new BFF错误(409, 'idempotency_conflict', 'conflict'));
    vi.mocked(env.数据源.读取消息).mockResolvedValue(消息页([系统行], null));
    await expect(env.操作.发送真人消息('candidate', '3003', '你好'))
      .rejects.toMatchObject({ code: 'idempotency_conflict' });
    // 冲突后刷新了权威消息
    expect(env.数据源.读取消息).toHaveBeenCalled();
    const 旧键 = vi.mocked(env.数据源.发送消息).mock.calls[0][3];
    vi.mocked(env.数据源.发送消息).mockResolvedValueOnce(文本消息('4006', 'candidate', '换个说法'));
    await env.操作.发送真人消息('candidate', '3003', '换个说法');
    expect(vi.mocked(env.数据源.发送消息).mock.calls[1][3]).not.toBe(旧键);
  });

  it('明确拒绝释放键；role_required 不清会话、不代重试；空/超长正文零请求拦截', async () => {
    vi.mocked(env.数据源.发送消息).mockRejectedValueOnce(
      new BFF错误(403, 'role_required', 'role missing'));
    await expect(env.操作.发送真人消息('candidate', '3003', '你好'))
      .rejects.toMatchObject({ code: 'role_required' });
    // 会话未失效（未走 401 清理）
    expect(env.最新状态().已登录).toBe(true);
    expect(env.deps.P7待定意图.current.size).toBe(0);
    // 下一次同文发送是全新意图（新键）
    vi.mocked(env.数据源.发送消息).mockResolvedValueOnce(文本消息('4005', 'candidate', '你好'));
    const 旧键 = vi.mocked(env.数据源.发送消息).mock.calls[0][3];
    await env.操作.发送真人消息('candidate', '3003', '你好');
    expect(vi.mocked(env.数据源.发送消息).mock.calls[1][3]).not.toBe(旧键);

    // 空/纯空白/超长正文：发送前拦截，零 facade 调用、零意图
    const 发送调用数 = vi.mocked(env.数据源.发送消息).mock.calls.length;
    for (const 正文 of ['', '   ', '你'.repeat(2001), '😀'.repeat(2001)]) {
      await expect(env.操作.发送真人消息('candidate', '3003', 正文))
        .rejects.toMatchObject({ code: 'invalid_request' });
    }
    expect(env.数据源.发送消息).toHaveBeenCalledTimes(发送调用数);
    expect(env.deps.P7待定意图.current.size).toBe(0);
  });

  // ── forward-only 已读 ──

  it('已读只接受 decimal 坐标：system 行与非规范 ID 零请求', async () => {
    await env.操作.提交真人已读('candidate', '3003', 'system:3003');
    await env.操作.提交真人已读('candidate', '3003', '04004');
    await env.操作.提交真人已读('candidate', '3003', '');
    expect(env.数据源.标为已读).not.toHaveBeenCalled();
  });

  it('同一 target 单飞去重，成功后刷新详情与收件箱且不再重发', async () => {
    vi.mocked(env.数据源.读取消息).mockResolvedValue(
      消息页([系统行, 文本消息('4004', 'candidate', '在吗')], null));
    await env.操作.读取真人会话('candidate', '3003');
    const 门 = deferred<string>();
    vi.mocked(env.数据源.标为已读).mockReturnValueOnce(门.promise);
    const a = env.操作.提交真人已读('candidate', '3003', '4004');
    const b = env.操作.提交真人已读('candidate', '3003', '4004');
    expect(env.数据源.标为已读).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env.数据源.标为已读).mock.calls[0]).toEqual(['candidate', '3003', '4004']);
    门.resolve('4004');
    await Promise.all([a, b]);
    // 成功刷新详情与收件箱
    expect(env.数据源.读取会话).toHaveBeenCalled();
    expect(env.数据源.读取会话列表).toHaveBeenCalled();
    // 已成功 target 再提交：零请求
    const 读调用数 = vi.mocked(env.数据源.读取会话).mock.calls.length;
    await env.操作.提交真人已读('candidate', '3003', '4004');
    expect(env.数据源.标为已读).toHaveBeenCalledTimes(1);
    expect(vi.mocked(env.数据源.读取会话).mock.calls.length).toBe(读调用数);
    // 更新的 target 仍会提交（forward-only，十进制 ID 不转 number 比大小）
    vi.mocked(env.数据源.标为已读).mockResolvedValueOnce('4005');
    await env.操作.提交真人已读('candidate', '3003', '4005');
    expect(vi.mocked(env.数据源.标为已读).mock.calls.at(-1)).toEqual(['candidate', '3003', '4005']);
  });

  it('role_required / role_suspended 把 target 记终局拒绝：同 target 零重发、新 target 可试、清理后复位', async () => {
    vi.mocked(env.数据源.标为已读).mockRejectedValueOnce(
      new BFF错误(403, 'role_required', 'role missing'));
    await env.操作.提交真人已读('candidate', '3003', '4004');
    // 同 target 重渲染：零进一步 read 调用
    await env.操作.提交真人已读('candidate', '3003', '4004');
    expect(env.数据源.标为已读).toHaveBeenCalledTimes(1);
    // 不同 target 仍可尝试一次
    vi.mocked(env.数据源.标为已读).mockRejectedValueOnce(
      new BFF错误(403, 'role_suspended', 'suspended'));
    await env.操作.提交真人已读('candidate', '3003', '4005');
    expect(env.数据源.标为已读).toHaveBeenCalledTimes(2);
    await env.操作.提交真人已读('candidate', '3003', '4005');
    expect(env.数据源.标为已读).toHaveBeenCalledTimes(2);
    // 主体/角色/会话清理复位终局拒绝：target 重新可试
    清P7会话引用(env.deps);
    vi.mocked(env.数据源.标为已读).mockResolvedValueOnce('4004');
    await env.操作.提交真人已读('candidate', '3003', '4004');
    expect(vi.mocked(env.数据源.标为已读).mock.calls.at(-1)).toEqual(['candidate', '3003', '4004']);
  });

  // ── 错误文案 ──

  it('取P7错误文案 冻结 P7 表并覆盖未知后端错误的英文 message', () => {
    expect(取P7错误文案(new BFF错误(404, 'conversation_not_found', 'The conversation does not exist.')))
      .toBe('这段会话不存在或已不可访问');
    expect(取P7错误文案(new BFF错误(422, 'invalid_request_body', 'bad'))).toBe('当前消息无法发送，请检查内容后重试');
    expect(取P7错误文案(new BFF错误(409, 'idempotency_conflict', 'x'))).toBe('发送状态发生冲突，请刷新后确认');
    expect(取P7错误文案(new BFF错误(503, 'operation_outcome_unknown', 'x'))).toBe('暂时无法确认是否发送成功');
    expect(取P7错误文案(new BFF错误(413, 'request_too_large', 'x'))).toBe('消息太长，请缩短后再发送');
    expect(取P7错误文案(new BFF错误(409, 'idempotency_in_progress', 'x'))).toBe('消息仍在处理中，请稍后重试');
    expect(取P7错误文案(new BFF错误(403, 'role_required', 'x'))).toBe('当前身份不可用，请切换身份或重新登录');
    expect(取P7错误文案(new BFF错误(403, 'role_suspended', 'x'))).toBe('当前身份不可用，请切换身份或重新登录');
    expect(取P7错误文案(new BFF错误(503, 'message_service_unavailable', 'x'))).toBe('消息服务暂时不可用，请重试');
    expect(取P7错误文案(new BFF错误(503, 'identity_service_unavailable', 'x'))).toBe('账号服务暂时不可用，请重试');
    // status 0 保留既有的有用断网文案；未知错误码覆盖英文 message，不透传
    expect(取P7错误文案(new BFF错误(0, 'network_error', '网络连接失败，请稍后再试')))
      .toBe('无法连接后端服务，请检查网络或稍后重试');
    expect(取P7错误文案(new BFF错误(400, 'some_unknown_code', 'English backend message')))
      .toBe('请求失败，请稍后重试');
    expect(取P7错误文案(new Error('plain network error'))).toBe('网络连接失败，请稍后再试');
  });

  // ── 会话清理 ──

  it('读取 401 统一清账号并摊平 P7 域', async () => {
    await env.操作.加载会话列表('candidate');
    env.deps.P7待定意图.current.set('p7:意图:x', { key: 'k', content: 'x', watermark: null });
    vi.mocked(env.数据源.读取会话列表).mockRejectedValueOnce(
      new BFF错误(401, 'invalid_session', 'expired'));
    await env.操作.加载会话列表('candidate', true);
    expect(env.最新状态().已登录).toBe(false);
    expect(env.最新状态().P7收件箱.candidate.阶段).toBe('未开始');
    expect(env.deps.主体标识引用.current).toBeNull();
    expect(env.deps.P7范围代际.current.size).toBe(0);
    expect(env.deps.P7待定意图.current.size).toBe(0);
  });

  it('清P7会话引用 清空范围代际、待定意图、已读位置并复位可见引用', () => {
    env.deps.P7范围代际.current.set('k', 1);
    env.deps.P7待定意图.current.set('k', { key: 'k', content: 'x', watermark: null });
    env.deps.P7已读位置.current.set('k', { lastSuccessful: '1', inFlight: null, terminalRejected: null });
    env.deps.P7可见收件箱.current = { candidate: true, recruiter: false };
    env.deps.P7可见会话.current = { candidate: '3003', recruiter: null };
    清P7会话引用(env.deps);
    expect(env.deps.P7范围代际.current.size).toBe(0);
    expect(env.deps.P7待定意图.current.size).toBe(0);
    expect(env.deps.P7已读位置.current.size).toBe(0);
    expect(env.deps.P7可见收件箱.current).toEqual({ candidate: false, recruiter: false });
    expect(env.deps.P7可见会话.current).toEqual({ candidate: null, recruiter: null });
  });

  it('使真人会话失效 作废对应会话在飞读；未指定坐标时作废收件箱读', async () => {
    const 门 = deferred<P7会话项>();
    vi.mocked(env.数据源.读取会话).mockReturnValueOnce(门.promise);
    const run = env.操作.读取真人会话('candidate', '3003');
    env.操作.使真人会话失效('candidate', '3003');
    门.resolve(会话项('3003'));
    await run;
    expect(env.最新状态().P7会话详情[P7范围键.详情('candidate', '3003')]?.detail ?? null).toBeNull();

    const 门2 = deferred<P7会话页>();
    vi.mocked(env.数据源.读取会话列表).mockReturnValueOnce(门2.promise);
    const run2 = env.操作.加载会话列表('candidate', true);
    env.操作.使真人会话失效('candidate');
    门2.resolve(会话页([会话项('3003')], null));
    await run2;
    expect(env.最新状态().P7收件箱.candidate.items).toEqual([]);
  });

  it('Mock 模式零请求：全部操作早退', async () => {
    const mock环境 = 创建P7操作测试环境(false);
    await mock环境.操作.加载会话列表('candidate');
    await mock环境.操作.读取真人会话('candidate', '3003');
    await mock环境.操作.提交真人已读('candidate', '3003', '4004');
    await expect(mock环境.操作.发送真人消息('candidate', '3003', '你好'))
      .resolves.toEqual({ status: 'confirmed' });
    expect(mock环境.数据源.读取会话列表).not.toHaveBeenCalled();
    expect(mock环境.数据源.读取会话).not.toHaveBeenCalled();
    expect(mock环境.数据源.读取消息).not.toHaveBeenCalled();
    expect(mock环境.数据源.发送消息).not.toHaveBeenCalled();
    expect(mock环境.数据源.标为已读).not.toHaveBeenCalled();
  });
});

// ── review-r1：栅栏与对账纪律（Codex Round 1 发现）──────────────────────────────
describe('P7 review-r1 修复', () => {
  it('F1：已读 401 在会话换代后到达只丢弃，绝不登出新会话', async () => {
    vi.mocked(env.数据源.读取消息).mockResolvedValue(
      消息页([系统行, 文本消息('4004', 'recruiter', '你好')], null));
    await env.操作.读取真人会话('candidate', '3003');
    await env.操作.提交真人已读('candidate', '3003', '4004');
    const 门 = deferred<string>();
    vi.mocked(env.数据源.标为已读).mockReturnValueOnce(门.promise);
    const run = env.操作.提交真人已读('candidate', '3003', '4005');
    // 途中换账号换代（B 已登录），旧会话 A 的已读 401 迟到到达
    env.deps.主体标识引用.current = 'sub_2';
    env.deps.会话代际.current += 1;
    门.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await run;
    // 新会话未被登出、已成功的快照不被摊平
    expect(env.最新状态().已登录).toBe(true);
    expect(env.最新状态().P7消息页[P7范围键.消息('candidate', '3003')].阶段).toBe('成功');
    expect(env.最新状态().P7收件箱.candidate.阶段).not.toBe('未开始');
  });

  it('F2：无权威消息快照时水位不可用，重拉见同文历史消息也不确认', async () => {
    // 初始消息 GET 失败/未完成（快照不在场）：发送前水位不可用，不是权威空
    vi.mocked(env.数据源.发送消息).mockRejectedValueOnce(
      new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    vi.mocked(env.数据源.读取消息).mockResolvedValueOnce(
      消息页([系统行, 文本消息('4004', 'candidate', '你好')], null)); // 历史同文消息（发送前就有）
    await expect(env.操作.发送真人消息('candidate', '3003', '你好')).resolves.toEqual({
      status: 'unknown', reason: 'outcome_unknown', canAbandon: true, pendingContent: '你好',
    });
    // 意图保留（绝不凭不可验证的水位宣称成功）
    expect(env.deps.P7待定意图.current.size).toBe(1);
  });

  it('F3：对账 GET 在飞期间换会话，迟到证据不写新会话快照', async () => {
    vi.mocked(env.数据源.读取消息).mockResolvedValueOnce(消息页([系统行], null));
    await env.操作.读取真人会话('candidate', '3003');
    // POST 的拒绝先被处理（catch 进入、对账 GET 挂起），会话切换落在对账 await 期间
    const 发送门 = deferred<never>();
    vi.mocked(env.数据源.发送消息).mockReturnValueOnce(发送门.promise as never);
    const 门 = deferred<P7消息页>();
    vi.mocked(env.数据源.读取消息).mockReturnValueOnce(门.promise);
    const run = env.操作.发送真人消息('candidate', '3003', '你好');
    发送门.reject(new BFF错误(503, 'operation_outcome_unknown', 'unknown'));
    await Promise.resolve(); // 让 catch 的同步段（含栅栏检查）先跑完，对账 allSettled 挂起中
    env.deps.主体标识引用.current = 'sub_2';
    env.deps.会话代际.current += 1;
    // 迟到的重拉带着本端同文消息到达 —— 栅栏已换代，绝不按已生效收口
    门.resolve(消息页([系统行, 文本消息('4005', 'candidate', '你好')], null));
    await expect(run).resolves.toEqual({
      status: 'unknown', reason: 'outcome_unknown', canAbandon: false, pendingContent: '你好',
    });
    // 新会话的旧会话消息快照不被旧 scope 的权威重读污染
    expect(env.最新状态().P7消息页[P7范围键.消息('candidate', '3003')].items).toEqual([系统行]);
  });

  it('F4：窗口重建按时间序 prepend 更早页，深窗口强制刷新不乱序', async () => {
    vi.mocked(env.数据源.读取消息)
      .mockResolvedValueOnce(消息页([系统行, 文本消息('4004', 'candidate', '在吗')], 'older_1'))
      .mockResolvedValueOnce(消息页([文本消息('4001', 'recruiter', '你好')], null))
      .mockResolvedValueOnce(消息页([系统行, 文本消息('4004', 'candidate', '在吗')], 'older_1'))
      .mockResolvedValueOnce(消息页([文本消息('4001', 'recruiter', '你好')], null));
    await env.操作.读取真人会话('candidate', '3003');
    await env.操作.追加更早消息('candidate', '3003');
    // 强制刷新重建同深（2 页）窗口：更早页必须 prepend，保持时间序
    await env.操作.读取真人会话('candidate', '3003', true);
    expect(env.最新状态().P7消息页[P7范围键.消息('candidate', '3003')].items).toEqual([
      文本消息('4001', 'recruiter', '你好'),
      系统行,
      文本消息('4004', 'candidate', '在吗'),
    ]);
  });

  it('F5：会话失效同时作废收件箱读，事件后的强制收件箱刷新可接管在飞旧读', async () => {
    // 旧收件箱读在飞（慢响应）
    const 门 = deferred<P7会话页>();
    vi.mocked(env.数据源.读取会话列表).mockReturnValueOnce(门.promise);
    const 旧读 = env.操作.加载会话列表('candidate', true);
    // conversation_changed 到达：失效（带会话坐标）+ 事件层强制收件箱刷新。
    // 新响应先入队（新读的 facade 调用是同步发起的，入队晚了会被缺省空页截走）。
    vi.mocked(env.数据源.读取会话列表).mockResolvedValueOnce(会话页([会话项('3001')], null));
    env.操作.使真人会话失效('candidate', '3003');
    const 新读 = env.操作.加载会话列表('candidate', true);
    // 旧响应（3003，含过期未读）先到达：属主栅栏已换代，整包丢弃
    门.resolve(会话页([会话项('3003', 5)], null));
    await Promise.all([旧读, 新读]);
    // 强制刷新接管读锁：最终快照是新响应（3001），不是旧响应的过期投影
    expect(env.最新状态().P7收件箱.candidate.items.map((条) => 条.conversationId)).toEqual(['3001']);
  });
});


// ── review-r2：结算归属与换会话残留（Codex Round 2 发现）────────────────────────
describe('P7 review-r2 修复', () => {
  it('R2-1：已读结算只动自己捕获的记录，换会话后不碰新会话的同名记录', async () => {
    vi.mocked(env.数据源.读取消息).mockResolvedValue(
      消息页([系统行, 文本消息('4004', 'recruiter', '你好')], null));
    await env.操作.读取真人会话('candidate', '3003');
    const 门A = deferred<string>();
    vi.mocked(env.数据源.标为已读).mockReturnValueOnce(门A.promise);
    const 读A = env.操作.提交真人已读('candidate', '3003', '4005');
    await Promise.resolve(); // 读A 进入在飞
    // 会话换代：引用清理（新会话同 scope 同 target 重新提交）
    清P7会话引用(env.deps);
    env.deps.会话代际.current += 1;
    const 门B = deferred<string>();
    vi.mocked(env.数据源.标为已读).mockReturnValueOnce(门B.promise);
    const 读B = env.操作.提交真人已读('candidate', '3003', '4005');
    门A.resolve('4005'); // A 迟到成功：绝不碰 B 捕获前建立的新记录
    await 读A;
    const 位置B = env.deps.P7已读位置.current.get('p7:read:candidate:3003');
    expect(位置B?.inFlight).toBe('4005'); // B 的在飞标记不被 A 的结算清掉
    expect(位置B?.lastSuccessful).toBeNull(); // A 的成功不冒充 B 的成功
    门B.resolve('4005');
    await 读B;
    expect(env.deps.P7已读位置.current.get('p7:read:candidate:3003')?.lastSuccessful).toBe('4005');
  });
});
