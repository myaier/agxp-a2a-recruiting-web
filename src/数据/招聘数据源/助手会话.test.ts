// 助手会话域数据源测试：冻结 assistant 四个 browser call 的 method/path/query/body/幂等键
// （两个 GET 不缓存、历史 cursor 为非零十进制最多 19 位且调用方先校验、发送 body 严格 {text}
// 且 trim 后按 UTF-8 字节 1–4096 预检、retry 无正文、两个 POST 都带调用方原样幂等键），
// 并锁定 strict decode（exact key set、闭合 enum、asm_/ast_/dlg_|mc_ ID pattern、RFC3339、
// succeeded↔reply、retryable↔failed、unavailable cards 空、三种已知 card 闭合解码、
// 未知 kind 整卡跳过、已知 kind 非法 data 拒绝、agent_summary 复用连续代谈真实 decoder）。
// 用受控请求桩记录参数，不连接后端；全部 fixture 内联自造，不引用任何后端文件路径。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import { 创建助手会话数据源 } from './助手会话';
import type { 助手会话数据源 } from './助手会话';
import { 解NegotiationAgentSummary } from './连续代谈';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

function 响应<T>(result: T): BFF响应<T> {
  return { result, etag: null, requestId: 'fixture-request' };
}

const 消息ID = 'asm_a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1';
const 轮次ID = 'ast_a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1';
const 重试轮次ID = 'ast_0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b';
const 意向ID = 'int_0123456789abcdef0123456789abcdef';
const 职位ID = 'job_0123456789abcdef0123456789abcdef';
const 案件记录ID = 'mc_0123456789abcdef0123456789abcdef';

// ── 冻结 schema 的完整 wire fixture ──

function 岗位项Wire(覆盖: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    job_id: 职位ID,
    title: '后端工程师',
    organization_name: '星河科技',
    office_location: '上海市浦东新区',
    salary_lower: 25000,
    salary_upper: 40000,
    salary_period: 'month',
    annual_salary_months: 14,
    safe_reasons: ['技能与岗位要求匹配', '期望城市一致'],
    ...覆盖,
  };
}

function 岗位推荐数据Wire(覆盖: Record<string, unknown> = {}): Record<string, unknown> {
  return { intention_id: 意向ID, items: [岗位项Wire()], next_cursor: null, ...覆盖 };
}

function 在谈职位Wire(覆盖: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    job_id: 职位ID,
    title: '后端工程师',
    location: '上海',
    public_salary_range: '25-40K·14薪',
    availability: 'available',
    ...覆盖,
  };
}

function 在谈项Wire(覆盖: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    record_id: 案件记录ID,
    record_kind: 'case',
    intention_id: 意向ID,
    job: 在谈职位Wire(),
    case_id: 案件记录ID,
    phase: 'case_started',
    needs_action: true,
    ...覆盖,
  };
}

function 在谈列表数据Wire(覆盖: Record<string, unknown> = {}): Record<string, unknown> {
  return { items: [在谈项Wire()], next_cursor: null, ...覆盖 };
}

const 公开初评Wire = {
  evaluation_id: 'eva_0123456789abcdef0123456789abcdef',
  decision: 'fit',
  summary: '公开信息与岗位要求相符。',
  coverage: 'public_job_and_candidate_data',
  evidence: {
    matches: [{ dimension: 'skills', code: 'skill_match', source: 'candidate_agent' }],
    conflicts: [],
    unknowns: [],
  },
  next_action: 'promote_to_a2a',
  completed_at: '2026-09-15T08:30:05Z',
};

const 条件确认Wire = {
  case_id: 案件记录ID,
  stage_status: 'active',
  latest_summary: {
    id: 's0s_0', phase: 'initial', summary: '需要确认值班安排。', occurred_at: '2026-09-15T08:30:06Z',
  },
  summaries: [
    { id: 's0s_0', phase: 'initial', summary: '需要确认值班安排。', occurred_at: '2026-09-15T08:30:06Z' },
  ],
};

function 在谈详情数据Wire(覆盖: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...在谈项Wire(),
    agent_summary: { public_evaluation: 公开初评Wire, condition_confirmation: 条件确认Wire },
    ...覆盖,
  };
}

function 卡片Wire(
  kind: string,
  数据: unknown,
  覆盖: Record<string, unknown> = {},
): Record<string, unknown> {
  return { kind, queried_at: '2026-09-15T08:30:04Z', data: 数据, ...覆盖 };
}

function 回复Wire(覆盖: Record<string, unknown> = {}): Record<string, unknown> {
  return { text: '为你找到 1 个匹配岗位。', visibility: 'available', cards: [], ...覆盖 };
}

function 消息Wire(覆盖: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    message_id: 消息ID,
    turn_id: 轮次ID,
    text: '帮我看看最近有什么合适的岗位',
    created_at: '2026-09-15T08:00:00Z',
    status: 'succeeded',
    retryable: false,
    error_code: null,
    reply: 回复Wire(),
    ...覆盖,
  };
}

const 处理中消息Wire = 消息Wire({ status: 'processing', reply: null });

function 历史页Wire(覆盖: Record<string, unknown> = {}): Record<string, unknown> {
  return { items: [消息Wire()], next_cursor: null, ...覆盖 };
}

/** 真实缺键（键不在场，而不是 undefined 值）。 */
function 略键(值: Record<string, unknown>, 键: string): Record<string, unknown> {
  const { [键]: _略, ...其余 } = 值;
  return 其余;
}

describe('助手会话数据源', () => {
  let 请求Mock: ReturnType<typeof vi.fn>;
  let source: 助手会话数据源;

  beforeEach(() => {
    请求Mock = vi.fn();
    source = 创建助手会话数据源(请求Mock as 请求函数);
  });

  // ── 请求捕获：四条路由的 path / method / query / body / 幂等键 ──

  it('历史首页请求恰为 GET /api/v1/me/assistant/messages 且不缓存，cursor 为空时省略', async () => {
    请求Mock.mockResolvedValueOnce(响应(历史页Wire()));
    await expect(source.读取助手历史())
      .resolves.toMatchObject({ items: [{ message_id: 消息ID }], next_cursor: null });
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      { path: '/api/v1/me/assistant/messages', 不缓存: true },
    ]);
    expect(请求Mock.mock.calls[0][0].path).not.toContain('cursor');
  });

  it('历史续页把调用方 cursor 逐字编码进 query 恰一次', async () => {
    请求Mock.mockResolvedValueOnce(响应(历史页Wire({ next_cursor: null })));
    await source.读取助手历史('21');
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/me/assistant/messages?cursor=21',
      不缓存: true,
    });
  });

  it('调用方 cursor 在任何 fetch 前按非零十进制最多 19 位校验：非法即拒绝且零请求', async () => {
    for (const 坏游标 of ['', '0', '021', '21a', '-3', '1 2', 'Pg2', '9'.repeat(20)]) {
      await expect(source.读取助手历史(坏游标)).rejects.toMatchObject({ code: 'invalid_request' });
    }
    expect(请求Mock).not.toHaveBeenCalled();
    请求Mock.mockResolvedValueOnce(响应(历史页Wire({ items: [] })));
    await expect(source.读取助手历史('9'.repeat(19))).resolves.toMatchObject({ items: [] });
    expect(请求Mock).toHaveBeenCalledTimes(1);
    expect(请求Mock.mock.calls[0][0].path).toBe(`/api/v1/me/assistant/messages?cursor=${'9'.repeat(19)}`);
  });

  it('发送请求恰为 POST /messages、body 严格 {text} 且调用方幂等键原样', async () => {
    请求Mock.mockResolvedValueOnce(响应(处理中消息Wire));
    await expect(source.发送助手消息('帮我看看最近有什么合适的岗位', 'assistant-send-key-00000001'))
      .resolves.toMatchObject({ status: 'processing', reply: null });
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/me/assistant/messages',
      method: 'POST',
      body: { text: '帮我看看最近有什么合适的岗位' },
      幂等: true,
      幂等键: 'assistant-send-key-00000001',
    });
    expect(Object.keys(请求Mock.mock.calls[0][0].body)).toEqual(['text']);
  });

  it('轮询请求恰为 GET /api/v1/me/assistant/turns/{turn_id} 且不缓存', async () => {
    请求Mock.mockResolvedValueOnce(响应(消息Wire()));
    await source.读取助手轮次(轮次ID);
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: `/api/v1/me/assistant/turns/${轮次ID}`,
      不缓存: true,
    });
  });

  it('重试请求恰为 POST /turns/{turn_id}/retry：无正文，调用方新幂等键原样', async () => {
    请求Mock.mockResolvedValueOnce(响应(消息Wire({ turn_id: 重试轮次ID, status: 'processing', reply: null })));
    await expect(source.重试助手轮次(轮次ID, 'assistant-retry-key-0000001'))
      .resolves.toMatchObject({ message_id: 消息ID, turn_id: 重试轮次ID });
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: `/api/v1/me/assistant/turns/${轮次ID}/retry`,
      method: 'POST',
      幂等: true,
      幂等键: 'assistant-retry-key-0000001',
    });
    expect('body' in 请求Mock.mock.calls[0][0]).toBe(false);
  });

  it('调用方轮次 ID 在任何 fetch 前按 ast_+32 位小写十六进制校验：读取与重试都拒绝且零请求', async () => {
    for (const 坏ID of ['', 'ast_short', `ast_${'A'.repeat(32)}`, `ast_${'g1'.repeat(16)}`, 案件记录ID]) {
      await expect(source.读取助手轮次(坏ID)).rejects.toMatchObject({ code: 'invalid_request' });
      await expect(source.重试助手轮次(坏ID, 'assistant-retry-key-0000001'))
        .rejects.toMatchObject({ code: 'invalid_request' });
    }
    expect(请求Mock).not.toHaveBeenCalled();
  });

  // ── 发送文本：trim 后按 UTF-8 字节 1–4096 预检（不用 UTF-16 字符数）──

  it('发送文本按字节预检：1366 个“中”（4098 字节）请求前失败，1365 个（4095 字节）合法', async () => {
    await expect(source.发送助手消息('中'.repeat(1366), 'assistant-send-key-00000001'))
      .rejects.toMatchObject({ code: 'invalid_request' });
    expect(请求Mock).not.toHaveBeenCalled();
    请求Mock.mockResolvedValueOnce(响应(处理中消息Wire));
    await expect(source.发送助手消息('中'.repeat(1365), 'assistant-send-key-00000001'))
      .resolves.toMatchObject({ status: 'processing' });
    expect(请求Mock).toHaveBeenCalledTimes(1);
    const 正文 = (请求Mock.mock.calls[0][0].body as { text: string }).text;
    expect(new TextEncoder().encode(正文)).toHaveLength(4095);
  });

  it('发送文本 trim 后发出；trim 后为空或 4097 字节 ASCII 请求前失败，恰 4096 合法', async () => {
    请求Mock.mockResolvedValue(响应(处理中消息Wire));
    await source.发送助手消息('  帮我看看最近有什么合适的岗位  ', 'assistant-send-key-00000001');
    expect((请求Mock.mock.calls[0][0].body as { text: string }).text).toBe('帮我看看最近有什么合适的岗位');
    await expect(source.发送助手消息('   ', 'assistant-send-key-00000001'))
      .rejects.toMatchObject({ code: 'invalid_request' });
    await expect(source.发送助手消息('a'.repeat(4097), 'assistant-send-key-00000001'))
      .rejects.toMatchObject({ code: 'invalid_request' });
    await expect(source.发送助手消息('a'.repeat(4096), 'assistant-send-key-00000001'))
      .resolves.toMatchObject({ status: 'processing' });
    expect(请求Mock).toHaveBeenCalledTimes(2);
  });

  // ── 历史页与消息解码：200 页 / 202 消息同一闭合纪律 ──

  it('历史页解出最新在前消息：失败可重试与成功带回复同页共存，next_cursor 原样', async () => {
    const 失败消息 = 消息Wire({
      message_id: 'asm_d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4',
      turn_id: 'ast_d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4',
      status: 'failed',
      retryable: true,
      error_code: 'deadline_expired',
      reply: null,
    });
    请求Mock.mockResolvedValueOnce(响应(历史页Wire({ items: [失败消息, 消息Wire()], next_cursor: '21' })));
    const 页 = await source.读取助手历史();
    expect(页.items).toHaveLength(2);
    expect(页.items[0]).toMatchObject({
      status: 'failed', retryable: true, error_code: 'deadline_expired', reply: null,
    });
    expect(页.items[1]).toMatchObject({
      status: 'succeeded', retryable: false, reply: { visibility: 'available', cards: [] },
    });
    expect(页.next_cursor).toBe('21');
  });

  it('202 受理与重试都解为同一条消息闭合 DTO：message_id 稳定、turn_id 更新', async () => {
    请求Mock
      .mockResolvedValueOnce(响应(处理中消息Wire))
      .mockResolvedValueOnce(响应(消息Wire({ turn_id: 重试轮次ID, status: 'processing', reply: null })));
    const 受理 = await source.发送助手消息('帮我看看', 'assistant-send-key-00000001');
    expect(受理).toMatchObject({
      message_id: 消息ID, turn_id: 轮次ID, status: 'processing', retryable: false, error_code: null, reply: null,
    });
    const 重试 = await source.重试助手轮次(轮次ID, 'assistant-retry-key-0000001');
    expect(重试).toMatchObject({ message_id: 消息ID, turn_id: 重试轮次ID, status: 'processing', reply: null });
  });

  it('合法状态边界：failed+retryable、uncertain 不可重试、processing 双空都原样解出', async () => {
    请求Mock
      .mockResolvedValueOnce(响应(消息Wire({ status: 'failed', retryable: true, error_code: 'deadline_expired', reply: null })))
      .mockResolvedValueOnce(响应(消息Wire({ status: 'uncertain', error_code: 'remote_state_unknown', reply: null })))
      .mockResolvedValueOnce(响应(处理中消息Wire));
    await expect(source.读取助手轮次(轮次ID)).resolves.toMatchObject({ status: 'failed', retryable: true });
    await expect(source.读取助手轮次(轮次ID)).resolves.toMatchObject({ status: 'uncertain', retryable: false });
    await expect(source.读取助手轮次(轮次ID)).resolves.toMatchObject({ status: 'processing', reply: null });
  });

  it('消息联合不变式反例（表驱动）：成功无 reply、failed 带 reply、处理中 retryable、坏响应 ID、缺 required 键', async () => {
    const 破损列表 = [
      消息Wire({ reply: null }),
      消息Wire({ status: 'processing' }),
      消息Wire({ status: 'processing', reply: null, retryable: true }),
      消息Wire({ message_id: 'asm_a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a' }),
      消息Wire({ turn_id: `AST_${'a'.repeat(32)}` }),
      消息Wire({ text: '' }),
      消息Wire({ created_at: '昨天' }),
      消息Wire({ status: 'done' }),
      消息Wire({ error_code: 7 }),
      略键(消息Wire(), 'error_code'),
      略键(消息Wire(), 'reply'),
      略键(消息Wire(), 'retryable'),
      消息Wire({ extra: 1 }),
    ];
    for (const 破损 of 破损列表) {
      请求Mock.mockResolvedValueOnce(响应(破损));
      await expect(source.读取助手轮次(轮次ID)).rejects.toMatchObject({ code: 'invalid_response' });
    }
    expect(请求Mock).toHaveBeenCalledTimes(破损列表.length);
  });

  it('回复形状反例：缺 cards、visibility 表外、空 text、cards 非数组、多未知键', async () => {
    for (const 破损回复 of [
      略键(回复Wire(), 'cards'),
      回复Wire({ visibility: 'hidden' }),
      回复Wire({ text: '' }),
      回复Wire({ cards: null }),
      回复Wire({ extra: 1 }),
    ]) {
      请求Mock.mockResolvedValueOnce(响应(消息Wire({ reply: 破损回复 })));
      await expect(source.读取助手轮次(轮次ID)).rejects.toMatchObject({ code: 'invalid_response' });
    }
    expect(请求Mock).toHaveBeenCalledTimes(5);
  });

  // ── 三种已知 card 与未知 kind 边界 ──

  it('三种已知卡按原序解码，各自保留 queried_at 与真实字段', async () => {
    const 回复 = 回复Wire({
      cards: [
        卡片Wire('job_recommendations', 岗位推荐数据Wire(), { queried_at: '2026-09-15T08:00:03.123456Z' }),
        卡片Wire('negotiation_list', 在谈列表数据Wire(), { queried_at: '2026-09-15T08:20:02.5Z' }),
        卡片Wire('negotiation_detail', 在谈详情数据Wire(), { queried_at: '2026-09-15T08:30:04Z' }),
      ],
    });
    请求Mock.mockResolvedValueOnce(响应(消息Wire({ reply: 回复 })));
    const 消息 = await source.读取助手轮次(轮次ID);
    const cards = 消息.reply?.cards ?? [];
    expect(cards.map((卡片) => 卡片.kind))
      .toEqual(['job_recommendations', 'negotiation_list', 'negotiation_detail']);
    expect(cards.map((卡片) => 卡片.queried_at))
      .toEqual(['2026-09-15T08:00:03.123456Z', '2026-09-15T08:20:02.5Z', '2026-09-15T08:30:04Z']);
    const [岗位卡, 列表卡, 详情卡] = cards;
    expect(岗位卡.kind).toBe('job_recommendations');
    expect(岗位卡.data).toEqual(岗位推荐数据Wire());
    expect(列表卡.kind).toBe('negotiation_list');
    expect(列表卡.data).toEqual(在谈列表数据Wire());
    expect(详情卡.kind).toBe('negotiation_detail');
    // agent_summary 经连续代谈真实 decoder：S0 小结归一化后与 wire 不逐字同形
    expect(详情卡.data).toEqual({
      ...在谈详情数据Wire(),
      agent_summary: 解NegotiationAgentSummary(在谈详情数据Wire().agent_summary),
    });
  });

  it('未知 card.kind 是唯一前向兼容边界：整卡跳过、未知 data 不强转，相邻已知卡不受影响', async () => {
    const 回复 = 回复Wire({
      cards: [
        { kind: 'weather_snapshot', queried_at: '2026-09-15T08:31:00Z', data: { 任意: { 嵌套: 7 } }, extra: true },
        卡片Wire('job_recommendations', 岗位推荐数据Wire()),
      ],
    });
    请求Mock.mockResolvedValueOnce(响应(消息Wire({ reply: 回复 })));
    const 消息 = await source.读取助手轮次(轮次ID);
    const cards = 消息.reply?.cards ?? [];
    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe('job_recommendations');
  });

  it('已知 kind 的非法 data 按契约漂移拒绝（表驱动），不静默占位', async () => {
    const 破损卡片 = [
      卡片Wire('job_recommendations', 略键(岗位推荐数据Wire(), 'items')),
      卡片Wire('job_recommendations', { intention_id: null, items: [], next_cursor: null, extra: 1 }),
      卡片Wire('job_recommendations', 岗位推荐数据Wire({ items: [岗位项Wire({ salary_period: 'week' })] })),
      卡片Wire('job_recommendations', 岗位推荐数据Wire({ items: [岗位项Wire({ salary_lower: 25000.5 })] })),
      卡片Wire('job_recommendations', 岗位推荐数据Wire({ items: [略键(岗位项Wire(), 'safe_reasons')] })),
      卡片Wire('job_recommendations', 岗位推荐数据Wire({ items: [岗位项Wire({ job_id: '' })] })),
      卡片Wire('negotiation_list', 在谈列表数据Wire({ items: [在谈项Wire({ record_id: 'dlg_1' })] })),
      卡片Wire('negotiation_list', 在谈列表数据Wire({ items: [在谈项Wire({ phase: 'negotiating' })] })),
      卡片Wire('negotiation_list', 在谈列表数据Wire({ items: [在谈项Wire({ job: 略键(在谈职位Wire(), 'availability') })] })),
      卡片Wire('negotiation_detail', 略键(在谈详情数据Wire(), 'agent_summary')),
      卡片Wire('negotiation_detail', 在谈详情数据Wire({
        agent_summary: {
          public_evaluation: { ...公开初评Wire, evidence: { matches: null, conflicts: [], unknowns: [] } },
          condition_confirmation: null,
        },
      })),
      卡片Wire('job_recommendations', 岗位推荐数据Wire(), { extra: 1 }),
      { kind: 'job_recommendations', queried_at: '2026-09-15T08:30:04Z' },
      卡片Wire('job_recommendations', 岗位推荐数据Wire(), { queried_at: '下午三点' }),
      { kind: 7, queried_at: '2026-09-15T08:30:04Z', data: {} },
    ];
    for (const 破损卡 of 破损卡片) {
      请求Mock.mockResolvedValueOnce(响应(消息Wire({ reply: 回复Wire({ cards: [破损卡] }) })));
      await expect(source.读取助手轮次(轮次ID)).rejects.toMatchObject({ code: 'invalid_response' });
    }
    expect(请求Mock).toHaveBeenCalledTimes(破损卡片.length);
  });

  it('unavailable 回复只允许空 cards；带已知卡即拒绝', async () => {
    请求Mock.mockResolvedValueOnce(响应(消息Wire({
      reply: 回复Wire({
        visibility: 'unavailable',
        text: '这条回复引用的信息当前已不可查看。',
        cards: [卡片Wire('job_recommendations', 岗位推荐数据Wire())],
      }),
    })));
    await expect(source.读取助手轮次(轮次ID)).rejects.toMatchObject({ code: 'invalid_response' });
    请求Mock.mockResolvedValueOnce(响应(消息Wire({
      reply: 回复Wire({ visibility: 'unavailable', text: '这条回复引用的信息当前已不可查看。', cards: [] }),
    })));
    const 消息 = await source.读取助手轮次(轮次ID);
    expect(消息.reply).toEqual({
      text: '这条回复引用的信息当前已不可查看。',
      visibility: 'unavailable',
      cards: [],
    });
  });

  it('岗位空列表：intention_id null 且 items 空是合法空态', async () => {
    请求Mock.mockResolvedValueOnce(响应(消息Wire({
      reply: 回复Wire({ cards: [卡片Wire('job_recommendations', { intention_id: null, items: [], next_cursor: null })] }),
    })));
    const 消息 = await source.读取助手轮次(轮次ID);
    const cards = 消息.reply?.cards ?? [];
    expect(cards[0]).toMatchObject({ kind: 'job_recommendations', data: { intention_id: null, items: [] } });
  });

  it('在谈列表解出 pre-Case 委托项：unavailable 岗位三个显示字段 null、case_id null', async () => {
    const 委托项 = 在谈项Wire({
      record_id: 'dlg_0123456789abcdef0123456789abcdef',
      record_kind: 'delegation',
      case_id: null,
      phase: 'evaluating',
      needs_action: false,
      job: 在谈职位Wire({ title: null, location: null, public_salary_range: null, availability: 'unavailable' }),
    });
    请求Mock.mockResolvedValueOnce(响应(消息Wire({
      reply: 回复Wire({ cards: [卡片Wire('negotiation_list', 在谈列表数据Wire({ items: [委托项] }))] }),
    })));
    const 消息 = await source.读取助手轮次(轮次ID);
    const cards = 消息.reply?.cards ?? [];
    expect(cards[0]).toMatchObject({
      kind: 'negotiation_list',
      data: {
        items: [{
          record_kind: 'delegation', case_id: null, phase: 'evaluating', needs_action: false,
          job: { availability: 'unavailable', title: null, location: null, public_salary_range: null },
        }],
      },
    });
  });

  it('agent_summary 复用连续代谈真实 decoder：嵌套证据闭合，S0 小结归一化为页面形状', async () => {
    请求Mock.mockResolvedValueOnce(响应(消息Wire({
      reply: 回复Wire({ cards: [卡片Wire('negotiation_detail', 在谈详情数据Wire())] }),
    })));
    const 消息 = await source.读取助手轮次(轮次ID);
    const cards = 消息.reply?.cards ?? [];
    const 详情卡 = cards[0];
    if (详情卡.kind !== 'negotiation_detail') throw new Error('不应到达');
    expect(详情卡.data.agent_summary).toEqual(解NegotiationAgentSummary(在谈详情数据Wire().agent_summary));
    expect(详情卡.data.agent_summary.condition_confirmation?.latest_summary).toEqual({
      id: 's0s_0', phase: 'initial', summary: '需要确认值班安排。', occurredAt: '2026-09-15T08:30:06Z',
    });
    expect(详情卡.data.agent_summary.public_evaluation?.evidence.matches).toEqual([
      { dimension: 'skills', code: 'skill_match', source: 'candidate_agent' },
    ]);
  });

  // ── 历史 cursor：响应侧同样只认非零十进制最多 19 位 ──

  it('历史 next_cursor 只认 null 或非零十进制最多 19 位（表驱动）', async () => {
    for (const 坏游标 of ['', '0', '021', '21x', '9'.repeat(20), 7, '-1']) {
      请求Mock.mockResolvedValueOnce(响应(历史页Wire({ next_cursor: 坏游标 })));
      await expect(source.读取助手历史()).rejects.toMatchObject({ code: 'invalid_response' });
    }
    expect(请求Mock).toHaveBeenCalledTimes(7);
    请求Mock.mockResolvedValueOnce(响应(历史页Wire({ next_cursor: '9'.repeat(19) })));
    await expect(source.读取助手历史()).resolves.toMatchObject({ next_cursor: '9'.repeat(19) });
  });
});
