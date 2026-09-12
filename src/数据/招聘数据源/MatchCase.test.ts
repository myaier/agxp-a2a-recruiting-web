// MatchCase 域数据源测试：冻结 P5 双端每个 browser call 的 method/path/query/body/调用方幂等键
// （GET 全部 不缓存: true，mutation 只带 幂等+幂等键），并锁定 strict decode（exact key set、
// 闭合 enum、17 行 lifecycle+stage+status→step 状态矩阵、viewer 专属 available_actions、
// 四阶段区固定 S0→S3、条件可空块不接受显式 null、open/history 架子规则、cursor 前置校验
// 与响应 cursor 闭合）。mutation 一律 void，权威态由后续 detail 重读提供。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF客户端, BFF请求选项, BFF响应 } from '../HTTP客户端';
import type { BFF候选MatchCase详情, BFF招聘MatchCase详情 } from '../BFF契约';
import {
  P5候选工作区项Wire,
  P5招聘工作区项Wire,
  P5候选详情Wire,
  P5招聘详情Wire,
  P5状态视图Wire,
  P5已终止状态Wire,
  P5已完成状态Wire,
  P5阶段区组Wire,
  P5终局摘要Wire,
  P5工作区职位Wire,
  招聘候选摘要样本,
} from '../../测试/BFF样本';
import { 创建MatchCase数据源, 解MatchCaseSummary, 解P5详情, 解P5状态视图, type MatchCase数据源 } from './MatchCase';
import {
  S0候选完整记录Wire,
  S0招聘完整记录Wire,
  S0仅问题记录Wire,
  S0未知回答记录Wire,
} from '../../测试/S0筛选记录样本';
import {
  BFF安全职位资料样本,
  BFF候选身份匿名样本,
  BFF候选身份披露样本,
  BFF候选在线简历样本,
} from '../../测试/展示资料样本';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;
type 二进制函数 = Pick<BFF客户端, '请求二进制'>['请求二进制'];

function 响应<T>(result: T): BFF响应<T> {
  return { result, etag: null, requestId: 'fixture-request' };
}

const 意向ID = 'int_0123456789abcdef0123456789abcdef';
const 职位ID = 'job_0123456789abcdef0123456789abcdef';
const 协同问题ID = 'cdi_0123456789abcdef0123456789abcdef';
const 契约漂移 = '服务返回了不符合契约的 MatchCase 数据';

/** recruiter open 展开样本：工作区查询携带 include，每个 item 必带 candidate_summary。 */
const 招聘展开工作区项 = { ...P5招聘工作区项Wire, candidate_summary: 招聘候选摘要样本 };

const 候选Open路径 = '/api/v1/me/match-cases?limit=50';
const 候选过滤Open路径 = `/api/v1/me/match-cases?intention_id=${意向ID}&limit=50`;
const 招聘过滤Open路径 = `/api/v1/recruiter/match-cases?job_id=${职位ID}&limit=50&include=candidate_summary`;
const 候选已终止历史路径 = '/api/v1/me/match-cases/history?lifecycle=ended&limit=50';
const 招聘已完成历史路径 = `/api/v1/recruiter/match-cases/history?lifecycle=completed&job_id=${职位ID}&limit=50`;

// ── S0 展开块样本构造（include=screening_records）：共享块以对象展开放进唯一 S0，state.round=1 ──

/** S0 轮次基态：round 1、预算 3（P5状态视图Wire），让展开块的轮次约束有真实预算可比。 */
const S0基态Wire = { ...P5状态视图Wire, round: 1 };

/** 把给定块放进唯一 S0（其余三段不带键），其余 wire 原样；块类型放宽以便构造非法 wire。 */
function 带S0记录(
  详情: BFF候选MatchCase详情 | BFF招聘MatchCase详情,
  块: unknown,
): Record<string, unknown> {
  return {
    ...详情,
    state: S0基态Wire,
    stages: P5阶段区组Wire.map((区, 下标): Record<string, unknown> =>
      (下标 === 0
        ? { ...(区 as unknown as Record<string, unknown>), screening_records: 块 }
        : (区 as unknown as Record<string, unknown>))),
  };
}

function 造S0消息(覆盖: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 's0q_x', kind: 'question', role: 'candidate', round: 1,
    text: '每周可以到岗几天？', occurred_at: '2026-08-29T01:10:00Z', ...覆盖,
  };
}

function 造S0回答(覆盖: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 's0a_x', kind: 'answer', role: 'recruiter', round: 1,
    text: '每周三天。', answer_status: 'answered', occurred_at: '2026-08-29T01:11:00Z', ...覆盖,
  };
}

function 造S0小结(覆盖: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 's0s_x', phase: 'initial', summary: '需要确认值班安排。',
    occurred_at: '2026-08-29T01:09:00Z', ...覆盖,
  };
}

function S0块(覆盖: { messages?: unknown; summaries?: unknown } = {}): Record<string, unknown> {
  return {
    messages: 覆盖.messages === undefined ? [造S0消息()] : 覆盖.messages,
    summaries: 覆盖.summaries === undefined ? [] : 覆盖.summaries,
  };
}

/** 真实缺键（键不在场，而不是 undefined 值）。 */
function 略S0键(值: Record<string, unknown>, 键: string): Record<string, unknown> {
  const { [键]: _略, ...其余 } = 值;
  return 其余;
}

describe('MatchCase数据源', () => {
  let 请求Mock: ReturnType<typeof vi.fn>;
  let 二进制Mock: ReturnType<typeof vi.fn>;
  let source: MatchCase数据源;

  beforeEach(() => {
    请求Mock = vi.fn();
    二进制Mock = vi.fn();
    source = 创建MatchCase数据源({
      请求: 请求Mock as 请求函数,
      请求二进制: 二进制Mock as unknown as 二进制函数,
    });
  });

  // ── summary 读取 ──

  const 合法摘要Wire = {
    open_total: 51,
    open_anonymous_screening_total: 17,
    open_needs_action_total: 9,
    ended_total: 4,
    completed_total: 3,
  };

  it('双端 summary 走角色 endpoint、no-store，并返回精确归一化值', async () => {
    请求Mock
      .mockResolvedValueOnce(响应(合法摘要Wire))
      .mockResolvedValueOnce(响应({
        open_total: 0,
        open_anonymous_screening_total: 0,
        open_needs_action_total: 0,
        ended_total: 0,
        completed_total: 0,
      }));
    await expect(source.读取P5摘要('candidate')).resolves.toEqual({
      openTotal: 51,
      openAnonymousScreeningTotal: 17,
      openNeedsActionTotal: 9,
      endedTotal: 4,
      completedTotal: 3,
    });
    await expect(source.读取P5摘要('recruiter')).resolves.toEqual({
      openTotal: 0,
      openAnonymousScreeningTotal: 0,
      openNeedsActionTotal: 0,
      endedTotal: 0,
      completedTotal: 0,
    });
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      { path: '/api/v1/me/match-cases/summary', 不缓存: true },
      { path: '/api/v1/recruiter/match-cases/summary', 不缓存: true },
    ]);
  });

  it.each([
    { open_total: 1, open_anonymous_screening_total: 0, open_needs_action_total: 0, ended_total: 0 },
    { ...合法摘要Wire, unknown_total: 1 },
    { ...合法摘要Wire, open_total: '51' },
    { ...合法摘要Wire, open_total: 1.5 },
    { ...合法摘要Wire, open_total: -1 },
    { ...合法摘要Wire, open_total: Number.NaN },
    { ...合法摘要Wire, open_total: Number.POSITIVE_INFINITY },
    { ...合法摘要Wire, open_total: Number.MAX_SAFE_INTEGER + 1 },
  ])('summary 拒绝缺键、多键与坏整数：%j', (wire) => {
    expect(() => 解MatchCaseSummary(wire)).toThrow(契约漂移);
  });

  it('ended 与 completed 的和不是安全整数时整包拒绝', () => {
    expect(() => 解MatchCaseSummary({
      ...合法摘要Wire,
      ended_total: Number.MAX_SAFE_INTEGER,
      completed_total: 1,
    })).toThrow(契约漂移);
  });

  // ── 列表 / 历史读取 ──

  it('双端 open 列表固定 limit=50、角色过滤器与 cursor 只编码一次，GET 全部不缓存', async () => {
    const 第二行 = { ...P5候选工作区项Wire, state: { ...P5状态视图Wire, case_id: 'mc_2' } };
    请求Mock
      .mockResolvedValueOnce(响应({ items: [P5候选工作区项Wire, 第二行], next_cursor: 'Pg2_-1' }))
      .mockResolvedValueOnce(响应({ items: [], next_cursor: null }))
      .mockResolvedValueOnce(响应({ items: [招聘展开工作区项], next_cursor: null }));
    const 首页 = await source.读取P5Open列表('candidate', 意向ID, null);
    const 次页 = await source.读取P5Open列表('candidate', null, 'Pg2_-1');
    const 招聘页 = await source.读取P5Open列表('recruiter', 职位ID, null);
    // 服务端顺序原样保留；opaque cursor 只透传不解读
    expect(首页.items.map((项) => 项.state.caseId)).toEqual(['mc_1', 'mc_2']);
    expect(首页).toMatchObject({ role: 'candidate', nextCursor: 'Pg2_-1' });
    expect(首页.items[0]).toMatchObject({
      role: 'candidate',
      needsAction: true,
      intentionId: 意向ID,
      state: { step: 'policy_check' },
    });
    expect(次页).toEqual({ role: 'candidate', items: [], nextCursor: null });
    expect(招聘页.items[0]).toMatchObject({ role: 'recruiter', candidateAlias: 'candidate-0123456789ab', needsAction: false });
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      { path: 候选过滤Open路径, 不缓存: true },
      { path: `${候选Open路径}&cursor=Pg2_-1`, 不缓存: true },
      { path: 招聘过滤Open路径, 不缓存: true },
    ]);
  });

  it('双端历史各自只装对应终态架子，行级 lifecycle 与 shelf 不符或终态行带待办都漂移', async () => {
    请求Mock
      .mockResolvedValueOnce(响应({
        items: [{ ...P5候选工作区项Wire, state: P5已终止状态Wire, needs_action: false }],
        next_cursor: null,
      }))
      .mockResolvedValueOnce(响应({ items: [{ ...P5招聘工作区项Wire, state: P5已完成状态Wire }], next_cursor: null }))
      .mockResolvedValueOnce(响应({ items: [], next_cursor: null }));
    const ended页 = await source.读取P5历史('candidate', 'ended', null, null);
    const completed页 = await source.读取P5历史('recruiter', 'completed', 职位ID, null);
    const 次页 = await source.读取P5历史('recruiter', 'completed', 职位ID, 'Pg2_-2');
    expect(ended页.items[0]).toMatchObject({ state: { lifecycle: 'ended', step: 'complete' }, needsAction: false });
    expect(completed页.items[0]).toMatchObject({ state: { lifecycle: 'completed', step: 'handoff_pending' } });
    expect(次页).toEqual({ role: 'recruiter', items: [], nextCursor: null });
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      { path: 候选已终止历史路径, 不缓存: true },
      { path: 招聘已完成历史路径, 不缓存: true },
      { path: `${招聘已完成历史路径}&cursor=Pg2_-2`, 不缓存: true },
    ]);

    请求Mock.mockResolvedValue(响应({ items: [P5候选工作区项Wire], next_cursor: null }));
    await expect(source.读取P5历史('candidate', 'ended', null, null))
      .rejects.toMatchObject({ code: 'invalid_response' });
    请求Mock.mockResolvedValue(响应({
      items: [{ ...P5候选工作区项Wire, state: P5已终止状态Wire, needs_action: false }],
      next_cursor: null,
    }));
    await expect(source.读取P5Open列表('candidate', null, null))
      .rejects.toMatchObject({ code: 'invalid_response' });
    请求Mock.mockResolvedValue(响应({ items: [{ ...P5候选工作区项Wire, state: P5已终止状态Wire }], next_cursor: null }));
    await expect(source.读取P5历史('candidate', 'ended', null, null))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('调用方 cursor 在任何 fetch 前校验：空/坏形状/超长即拒绝且零请求，恰 4096 合法', async () => {
    for (const 坏游标 of ['', 'bad/cursor+eq=', 'a'.repeat(4097), 7 as unknown as string]) {
      await expect(source.读取P5Open列表('candidate', null, 坏游标))
        .rejects.toMatchObject({ code: 'invalid_request' });
      await expect(source.读取P5历史('recruiter', 'ended', null, 坏游标))
        .rejects.toMatchObject({ code: 'invalid_request' });
    }
    expect(请求Mock).not.toHaveBeenCalled();

    const 边界游标 = 'a'.repeat(4096);
    请求Mock.mockResolvedValueOnce(响应({ items: [], next_cursor: null }));
    await expect(source.读取P5Open列表('candidate', null, 边界游标)).resolves.toMatchObject({ nextCursor: null });
    expect(请求Mock.mock.calls[0][0].path).toBe(`${候选Open路径}&cursor=${边界游标}`);
  });

  it('页 wrapper 缺 next_cursor / cursor 坏类型 / 空 / 超长 / 坏形状 / 多未知键都按契约漂移拒绝', async () => {
    for (const 坏页 of [
      { items: [] },
      { items: [], next_cursor: 7 },
      { items: [], next_cursor: '' },
      { items: [], next_cursor: 'a'.repeat(4097) },
      { items: [], next_cursor: 'bad/cursor' },
      { items: [], next_cursor: null, total: 3 },
      { items: null, next_cursor: null },
    ]) {
      请求Mock.mockResolvedValueOnce(响应(坏页));
      await expect(source.读取P5Open列表('candidate', null, null))
        .rejects.toMatchObject({ code: 'invalid_response' });
    }
    expect(请求Mock).toHaveBeenCalledTimes(7);
  });

  it('列表行跨角色键或携带 resume_submission 投影（含显式 null）都漂移', async () => {
    for (const 破损行 of [
      { ...P5候选工作区项Wire, candidate_alias: 'candidate-0123456789ab' },
      { ...P5候选工作区项Wire, resume_submission: null },
      { ...P5候选工作区项Wire, intention_id: 'int_1' },
      { ...P5候选工作区项Wire, job: { ...P5工作区职位Wire, job_id: 'job_1' } },
      { ...P5候选工作区项Wire, job: { ...P5工作区职位Wire, job: { ...P5工作区职位Wire.job, required_skills: [] } } },
      { ...P5候选工作区项Wire, needs_action: null },
    ]) {
      请求Mock.mockResolvedValueOnce(响应({ items: [破损行], next_cursor: null }));
      await expect(source.读取P5Open列表('candidate', null, null))
        .rejects.toMatchObject({ code: 'invalid_response' });
    }
    请求Mock.mockResolvedValueOnce(响应({ items: [{ ...招聘展开工作区项, intention_id: 意向ID }], next_cursor: null }));
    await expect(source.读取P5Open列表('recruiter', null, null))
      .rejects.toMatchObject({ code: 'invalid_response' });
    expect(请求Mock).toHaveBeenCalledTimes(7);
  });

  // ── candidate_summary 展开合同：仅 recruiter open 携带 include 且 item 必带摘要键 ──

  it('仅 recruiter open 工作区查询附加一次 include（首页/带 job_id/cursor），candidate open 与历史不携带', async () => {
    请求Mock
      .mockResolvedValueOnce(响应({ items: [招聘展开工作区项], next_cursor: 'Pg2_-1' }))
      .mockResolvedValueOnce(响应({ items: [P5候选工作区项Wire], next_cursor: null }))
      .mockResolvedValueOnce(响应({ items: [{ ...P5招聘工作区项Wire, state: P5已完成状态Wire }], next_cursor: null }))
      .mockResolvedValueOnce(响应({ items: [], next_cursor: null }));
    await source.读取P5Open列表('recruiter', 职位ID, null);
    await source.读取P5Open列表('candidate', 意向ID, null);
    await source.读取P5历史('recruiter', 'completed', 职位ID, null);
    await source.读取P5Open列表('candidate', null, null);
    expect(请求Mock.mock.calls.map(([选项]) => 选项.path as string)).toEqual([
      `${招聘过滤Open路径}`,
      候选过滤Open路径,
      `${招聘已完成历史路径}`,
      候选Open路径,
    ]);
    for (const 路径 of 请求Mock.mock.calls.map(([选项]) => 选项.path as string).slice(0, 1)) {
      expect(路径.match(/include=candidate_summary/g)).toHaveLength(1);
    }
    for (const 路径 of [候选过滤Open路径, 招聘已完成历史路径, 候选Open路径]) {
      expect(路径).not.toContain('include=');
    }
  });

  it('recruiter open 每项缺 candidate_summary 拒绝，显式 null 成功，非法摘要拒绝', async () => {
    const { candidate_summary: _缺, ...缺摘要 } = 招聘展开工作区项;
    请求Mock.mockResolvedValueOnce(响应({ items: [缺摘要], next_cursor: null }));
    await expect(source.读取P5Open列表('recruiter', 职位ID, null))
      .rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce(响应({ items: [{ ...招聘展开工作区项, candidate_summary: null }], next_cursor: null }));
    await expect(source.读取P5Open列表('recruiter', 职位ID, null))
      .resolves.toMatchObject({ items: [{ candidateSummary: null }] });

    请求Mock.mockResolvedValueOnce(响应({ items: [{ ...招聘展开工作区项, candidate_summary: { gender: 'x' } }], next_cursor: null }));
    await expect(source.读取P5Open列表('recruiter', 职位ID, null))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('candidate open / 招聘历史 / 详情按原白名单：响应携带 candidate_summary 键即拒绝', async () => {
    请求Mock.mockResolvedValueOnce(响应({ items: [{ ...P5候选工作区项Wire, candidate_summary: 招聘候选摘要样本 }], next_cursor: null }));
    await expect(source.读取P5Open列表('candidate', 意向ID, null))
      .rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce(响应({ items: [{ ...P5招聘工作区项Wire, state: P5已完成状态Wire, candidate_summary: 招聘候选摘要样本 }], next_cursor: null }));
    await expect(source.读取P5历史('recruiter', 'completed', 职位ID, null))
      .rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce(响应({ ...P5招聘详情Wire, candidate_summary: 招聘候选摘要样本 }));
    await expect(source.读取P5详情('recruiter', 'mc_1'))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });

  // ── 详情 decoder ──

  it('候选详情解出 intention 上下文，招聘详情解出 alias 上下文', () => {
    expect(解P5详情(P5候选详情Wire, 'candidate')).toMatchObject({
      role: 'candidate',
      context: { intentionId: 意向ID },
      state: { caseId: 'mc_1' },
    });
    expect(解P5详情(P5招聘详情Wire, 'recruiter')).toMatchObject({
      role: 'recruiter',
      context: { candidateAlias: 'candidate-0123456789ab' },
      state: { caseId: 'mc_1' },
    });
  });

  it('跨角色上下文键按契约漂移拒绝', () => {
    expect(() => 解P5详情({ ...P5候选详情Wire, candidate_alias: 'candidate-x' }, 'candidate'))
      .toThrow(契约漂移);
    expect(() => 解P5详情({ ...P5招聘详情Wire, intention_id: 意向ID }, 'recruiter'))
      .toThrow(契约漂移);
  });

  it('详情解出固定 S0→S3 四阶段区与 checklist/transcript/receipts typed 块', () => {
    const 详情 = 解P5详情(P5候选详情Wire, 'candidate');
    expect(详情.stages.map((区) => 区.stage)).toEqual([
      'anonymous_screening', 'resume_submission', 'needs_coordination', 'intent_confirmation',
    ]);
    expect(详情.stages[0]).toMatchObject({
      state: 'active',
      occurredAt: '2026-08-29T01:10:00Z',
      checklist: [{ label: '基础事实已答', done: true }],
      transcript: [{ eventId: 'evt_1', kind: 'supplementary_question', role: 'candidate', ref: 'prompt_1' }],
      instructionReceipts: [{ owner: 'candidate', expression: '工作日 10:00-19:00 联系' }],
      attachment: null,
    });
    expect(详情.availableActions).toEqual(['respond_fact', 'end_screening']);
    expect(详情.currentCoordination).toBeNull();
    expect(详情.terminalSummary).toBeNull();
    expect(详情.intentConfirmations).toEqual({ candidate: '', recruiter: '' });
  });

  it('阶段区数量不是四或顺序不是 S0→S3 即漂移', () => {
    expect(() => 解P5详情({ ...P5候选详情Wire, stages: P5阶段区组Wire.slice(0, 3) }, 'candidate'))
      .toThrow(契约漂移);
    const 乱序 = [P5阶段区组Wire[1], P5阶段区组Wire[0], P5阶段区组Wire[2], P5阶段区组Wire[3]];
    expect(() => 解P5详情({ ...P5候选详情Wire, stages: 乱序 }, 'candidate')).toThrow(契约漂移);
  });

  it('详情缺必需键、多未知键、必需数组为 null 或可选对象块显式 null 都漂移', () => {
    const { intention_id: _intention_id, ...缺上下文 } = P5候选详情Wire;
    const { stages: _stages, ...缺阶段 } = P5候选详情Wire;
    for (const 破损 of [
      缺上下文,
      缺阶段,
      { ...P5候选详情Wire, extra: 1 },
      { ...P5候选详情Wire, stages: null },
      { ...P5候选详情Wire, available_actions: null },
      { ...P5候选详情Wire, current_coordination: null },
      { ...P5候选详情Wire, terminal_summary: null },
      { ...P5候选详情Wire, stages: [{ ...P5阶段区组Wire[0], checklist: null }, ...P5阶段区组Wire.slice(1)] },
      { ...P5候选详情Wire, stages: [{ ...P5阶段区组Wire[0], transcript: null }, ...P5阶段区组Wire.slice(1)] },
      { ...P5候选详情Wire, stages: [{ ...P5阶段区组Wire[0], instruction_receipts: null }, ...P5阶段区组Wire.slice(1)] },
    ]) {
      expect(() => 解P5详情(破损, 'candidate')).toThrow(契约漂移);
    }
  });

  it('transcript 事件只能属于它所在的阶段区', () => {
    const 跨区 = [{ ...P5阶段区组Wire[0].transcript[0], stage: 'needs_coordination' }];
    const 坏区组 = [{ ...P5阶段区组Wire[0], transcript: 跨区 }, ...P5阶段区组Wire.slice(1)];
    expect(() => 解P5详情({ ...P5候选详情Wire, stages: 坏区组 }, 'candidate')).toThrow(契约漂移);
  });

  it('unknown lifecycle/stage/status/step、矩阵外四元组与矛盾终局列一律漂移', () => {
    const 变体们: Record<string, unknown>[] = [
      { lifecycle: 'paused' },
      { stage: 's4' },
      { status: 'paused' },
      { step: 'awaiting_recruiter' },
      { step: 'complete' },
      { lifecycle: 'completed', stage: 'intent_confirmation', status: 'passed', step: 'complete' },
      { lifecycle: 'open', stage: 'intent_confirmation', status: 'needs_user', step: 'handoff_pending' },
      { needs_user: true },
      { outcome: 'user_ended' },
      { finalized_at: '2026-08-29T03:00:00Z' },
      { round: 4 },
      { created_at: '昨天' },
    ];
    for (const 变体 of 变体们) {
      expect(() => 解P5详情({ ...P5候选详情Wire, state: { ...P5状态视图Wire, ...变体 } }, 'candidate'))
        .toThrow(契约漂移);
    }
    // ended 缺任一终局列同样矛盾
    expect(() => 解P5详情({ ...P5候选详情Wire, state: { ...P5已终止状态Wire, outcome: null } }, 'candidate'))
      .toThrow(契约漂移);
  });

  it.each(['agent_unavailable', 'agent_result_invalid'] as const)(
    'attention 解码合法 code %s',
    (code) => {
      const result = 解P5详情({
        ...P5候选详情Wire,
        state: {
          ...P5状态视图Wire,
          lifecycle: 'open', stage: 'resume_submission', status: 'attention_required',
          step: 'screening_resume', needs_user: false,
          agent_attention: { code, retryable: false },
        },
        needs_action: false,
        available_actions: [],
      }, 'candidate');
      expect(result.state.agentAttention).toEqual({ code, retryable: false });
    },
  );

  it.each([
    { code: 'future', retryable: false },
    { code: 'agent_unavailable', retryable: true },
    { code: 'agent_unavailable', retryable: false, task_id: 'secret' },
    null,
  ] as const)('非法 agent_attention %s fail closed', (agent_attention) => {
    expect(() => 解P5详情({
      ...P5候选详情Wire,
      state: {
        ...P5状态视图Wire,
        lifecycle: 'open', stage: 'resume_submission', status: 'attention_required',
        step: 'screening_resume', needs_user: false, agent_attention,
      },
      needs_action: false,
      available_actions: [],
    }, 'candidate')).toThrow(契约漂移);
  });

  it('非 attention 状态携带对象 fail closed；legacy attention 缺字段合法', () => {
    expect(() => 解P5详情({
      ...P5候选详情Wire,
      state: {
        ...P5状态视图Wire,
        agent_attention: { code: 'agent_unavailable', retryable: false },
      },
    }, 'candidate')).toThrow(契约漂移);

    const legacy = 解P5详情({
      ...P5候选详情Wire,
      state: {
        ...P5状态视图Wire,
        lifecycle: 'open', stage: 'resume_submission', status: 'attention_required',
        step: 'screening_resume', needs_user: false,
      },
      needs_action: false,
      available_actions: [],
    }, 'candidate');
    expect(legacy.state.agentAttention).toBeNull();
  });

  it('available_actions 闭合十词、不重复、按 viewer 归属，且与 needs_action 精确耦合', () => {
    // 候选端收到招聘端专属 decide_resume_screening → 漂移
    expect(() => 解P5详情({ ...P5候选详情Wire, available_actions: ['decide_resume_screening'] }, 'candidate'))
      .toThrow(契约漂移);
    // 招聘端收到候选端专属 replace_resume → 漂移
    expect(() => 解P5详情({ ...P5招聘详情Wire, needs_action: true, available_actions: ['replace_resume'] }, 'recruiter'))
      .toThrow(契约漂移);
    expect(() => 解P5详情({ ...P5候选详情Wire, available_actions: ['nudge'] }, 'candidate')).toThrow(契约漂移);
    expect(() => 解P5详情({ ...P5候选详情Wire, available_actions: ['respond_fact', 'respond_fact'] }, 'candidate'))
      .toThrow(契约漂移);
    expect(() => 解P5详情({ ...P5候选详情Wire, needs_action: false }, 'candidate')).toThrow(契约漂移);
    // 招聘端自己的 S1 筛选卡合法
    expect(解P5详情({ ...P5招聘详情Wire, needs_action: true, available_actions: ['decide_resume_screening'] }, 'recruiter')
      .availableActions).toEqual(['decide_resume_screening']);
  });

  it('终态详情零动作零待办，并解出与 state 对齐的终局摘要；open 不得携带摘要', () => {
    const 终态详情 = {
      ...P5候选详情Wire,
      state: P5已终止状态Wire,
      needs_action: false,
      available_actions: [],
      terminal_summary: P5终局摘要Wire,
    };
    const 详情 = 解P5详情(终态详情, 'candidate');
    expect(详情.needsAction).toBe(false);
    expect(详情.availableActions).toEqual([]);
    expect(详情.terminalSummary).toEqual({
      stage: 'anonymous_screening',
      outcome: 'user_ended',
      reasonSummary: 'user_ended',
      finalizedAt: '2026-08-29T03:00:00Z',
    });
    // 终态详情不得 needs_action=true 或携带任何动作
    expect(() => 解P5详情({ ...终态详情, needs_action: true }, 'candidate')).toThrow(契约漂移);
    expect(() => 解P5详情({ ...终态详情, available_actions: ['respond_fact'] }, 'candidate')).toThrow(契约漂移);
    // 终态缺摘要、open 带摘要、摘要与 state 不对齐都漂移
    const { terminal_summary: _ts, ...终态无摘要 } = 终态详情;
    expect(() => 解P5详情(终态无摘要, 'candidate')).toThrow(契约漂移);
    expect(() => 解P5详情({ ...P5候选详情Wire, terminal_summary: P5终局摘要Wire }, 'candidate')).toThrow(契约漂移);
    expect(() => 解P5详情({ ...终态详情, terminal_summary: { ...P5终局摘要Wire, finalized_at: '2026-08-29T04:00:00Z' } }, 'candidate'))
      .toThrow(契约漂移);

    // completed 详情：双方 confirm、空 outcome 词的摘要
    const 完成详情 = {
      ...P5候选详情Wire,
      state: P5已完成状态Wire,
      needs_action: false,
      available_actions: [],
      intent_confirmations: { candidate: 'confirm', recruiter: 'confirm' },
      terminal_summary: { ...P5终局摘要Wire, stage: 'intent_confirmation', outcome: '', reason_summary: '' },
    };
    expect(解P5详情(完成详情, 'candidate').terminalSummary).toMatchObject({ stage: 'intent_confirmation', outcome: '' });
    expect(() => 解P5详情({ ...完成详情, terminal_summary: { ...P5终局摘要Wire, stage: 'intent_confirmation', outcome: 'user_ended', reason_summary: '' } }, 'candidate'))
      .toThrow(契约漂移);
  });

  it('completed 行的两步移交：handoff_pending 必无 conversation_ref，complete 必带规范 ref', async () => {
    const 已完成Wire = {
      ...P5候选详情Wire,
      state: P5已完成状态Wire,
      needs_action: false,
      available_actions: [],
      intent_confirmations: { candidate: 'confirm', recruiter: 'confirm' },
      terminal_summary: { ...P5终局摘要Wire, stage: 'intent_confirmation', outcome: '', reason_summary: '' },
    };
    const completeWire = (覆盖: Record<string, unknown> = {}) => ({
      ...已完成Wire,
      state: { ...P5已完成状态Wire, step: 'complete' },
      ...覆盖,
    });
    // pending（handoff_pending）带 ref 即漂移；缺席时 conversationRef 归一为 null
    expect(() => 解P5详情({ ...已完成Wire, conversation_ref: '3003' }, 'candidate')).toThrow(契约漂移);
    expect(解P5详情(已完成Wire, 'candidate')).toMatchObject({ state: { step: 'handoff_pending' }, conversationRef: null });
    // complete 必带规范 decimal ref；无 ref / 空 / 前导零 / 超长都漂移，64 位仍合法
    expect(解P5详情(completeWire({ conversation_ref: '3003' }), 'candidate')).toMatchObject({
      state: { step: 'complete' }, conversationRef: '3003',
    });
    expect(() => 解P5详情(completeWire(), 'candidate')).toThrow(契约漂移);
    expect(() => 解P5详情(completeWire({ conversation_ref: '' }), 'candidate')).toThrow(契约漂移);
    expect(() => 解P5详情(completeWire({ conversation_ref: '03003' }), 'candidate')).toThrow(契约漂移);
    expect(() => 解P5详情(completeWire({ conversation_ref: '3'.repeat(65) }), 'candidate')).toThrow(契约漂移);
    expect(解P5详情(completeWire({ conversation_ref: '3'.repeat(64) }), 'candidate'))
      .toMatchObject({ conversationRef: '3'.repeat(64) });
    // 合成 published 字段 = 白名单外多键，一并漂移
    expect(() => 解P5详情(completeWire({ conversation_ref: '3003', published: true }), 'candidate'))
      .toThrow(契约漂移);
    // open / ended 详情带 ref 即漂移（发布事实只落在 completed 行）
    expect(() => 解P5详情({ ...P5候选详情Wire, conversation_ref: '3003' }, 'candidate')).toThrow(契约漂移);
    expect(() => 解P5详情({
      ...P5候选详情Wire, state: P5已终止状态Wire, needs_action: false, available_actions: [],
      terminal_summary: P5终局摘要Wire, conversation_ref: '3003',
    }, 'candidate')).toThrow(契约漂移);
    // 列表/历史行不携带会话标识（spec §9.2）：多键即漂移（经 facade 列表读拒绝）
    请求Mock.mockClear();
    请求Mock.mockResolvedValueOnce(响应({
      items: [{ ...P5候选工作区项Wire, conversation_ref: '3003' as unknown as string }],
      next_cursor: null,
    }));
    await expect(source.读取P5Open列表('candidate', null, null))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('current_coordination 只在 open 的 S2 出现，issue/kind/required_roles 闭合', () => {
    const 协同Wire = {
      issue_id: 协同问题ID,
      kind: 'work_mode',
      required_roles: ['candidate', 'recruiter'],
      candidate_decided: false,
      recruiter_decided: false,
    };
    const S2状态 = { ...P5状态视图Wire, stage: 'needs_coordination', status: 'waiting', step: 'coordinating' };
    expect(解P5详情({ ...P5候选详情Wire, state: S2状态, current_coordination: 协同Wire }, 'candidate')
      .currentCoordination).toEqual({
      issueId: 协同问题ID,
      kind: 'work_mode',
      requiredRoles: ['candidate', 'recruiter'],
      candidateDecided: false,
      recruiterDecided: false,
    });
    for (const 破损 of [
      { ...P5候选详情Wire, current_coordination: 协同Wire },
      { ...P5候选详情Wire, state: S2状态, current_coordination: { ...协同Wire, kind: 'salary' } },
      { ...P5候选详情Wire, state: S2状态, current_coordination: { ...协同Wire, required_roles: [] } },
      { ...P5候选详情Wire, state: S2状态, current_coordination: { ...协同Wire, required_roles: ['candidate', 'candidate'] } },
      { ...P5候选详情Wire, state: S2状态, current_coordination: { ...协同Wire, issue_id: 'issue_1' } },
    ]) {
      expect(() => 解P5详情(破损, 'candidate')).toThrow(契约漂移);
    }
  });

  it('intent confirmations 闭词且与 stage/lifecycle 对齐', () => {
    const S3状态 = {
      ...P5状态视图Wire,
      stage: 'intent_confirmation',
      status: 'needs_user',
      step: 'awaiting_confirmations',
      needs_user: true,
    };
    expect(解P5详情({ ...P5候选详情Wire, state: S3状态, intent_confirmations: { candidate: 'confirm', recruiter: '' } }, 'candidate')
      .intentConfirmations).toEqual({ candidate: 'confirm', recruiter: '' });
    // 非 S3 携带已记录词、闭词外取值、decline 未见 ended 都漂移
    expect(() => 解P5详情({ ...P5候选详情Wire, intent_confirmations: { candidate: 'confirm', recruiter: '' } }, 'candidate'))
      .toThrow(契约漂移);
    expect(() => 解P5详情({ ...P5候选详情Wire, state: S3状态, intent_confirmations: { candidate: 'maybe', recruiter: '' } }, 'candidate'))
      .toThrow(契约漂移);
    expect(() => 解P5详情({ ...P5候选详情Wire, state: S3状态, intent_confirmations: { candidate: 'decline', recruiter: '' } }, 'candidate'))
      .toThrow(契约漂移);
  });

  it('attachment 坐标按声明 pattern 闭合，招聘端的匿名初筛区不得携带附件', () => {
    const 附件 = {
      file_id: 'rf_0123456789abcdef0123456789abcdef',
      file_version_id: 'rfv_0123456789abcdef0123456789abcdef',
      display_name: 'resume.pdf',
    };
    const S1带附件 = [...P5阶段区组Wire];
    S1带附件[1] = { ...S1带附件[1], attachment: 附件 };
    expect(解P5详情({ ...P5候选详情Wire, stages: S1带附件 }, 'candidate').stages[1].attachment).toEqual({
      fileId: 'rf_0123456789abcdef0123456789abcdef',
      fileVersionId: 'rfv_0123456789abcdef0123456789abcdef',
      displayName: 'resume.pdf',
    });
    const S0带附件 = [{ ...P5阶段区组Wire[0], attachment: 附件 }, ...P5阶段区组Wire.slice(1)];
    expect(() => 解P5详情({ ...P5招聘详情Wire, stages: S0带附件 }, 'recruiter')).toThrow(契约漂移);
    const 坏坐标区 = [...P5阶段区组Wire];
    坏坐标区[1] = { ...坏坐标区[1], attachment: { ...附件, file_id: 'rf_1' } };
    expect(() => 解P5详情({ ...P5候选详情Wire, stages: 坏坐标区 }, 'candidate')).toThrow(契约漂移);
    const 显式null附件区 = P5阶段区组Wire.map((区, 下标) => (下标 === 1 ? { ...区, attachment: null } : 区));
    expect(() => 解P5详情({ ...P5候选详情Wire, stages: 显式null附件区 }, 'candidate')).toThrow(契约漂移);
  });

  it('附件双端仅归 S1 递交简历段：候选端 S0/S2 区携带附件也漂移', () => {
    const 附件 = {
      file_id: 'rf_0123456789abcdef0123456789abcdef',
      file_version_id: 'rfv_0123456789abcdef0123456789abcdef',
      display_name: 'resume.pdf',
    };
    for (const 下标 of [0, 2]) {
      const 错位区组 = P5阶段区组Wire.map((区, i) => (i === 下标 ? { ...区, attachment: 附件 } : 区));
      expect(() => 解P5详情({ ...P5候选详情Wire, stages: 错位区组 }, 'candidate')).toThrow(契约漂移);
      expect(() => 解P5详情({ ...P5招聘详情Wire, stages: 错位区组 }, 'recruiter')).toThrow(契约漂移);
    }
  });

  // ── S0 筛选记录：include=screening_records 的整包运输与严格解码 ──

  it('候选完整记录与招聘空总结按角色严格解码', () => {
    const 候选 = 解P5详情(带S0记录(P5候选详情Wire, S0候选完整记录Wire), 'candidate');
    const 招聘 = 解P5详情(带S0记录(P5招聘详情Wire, S0招聘完整记录Wire), 'recruiter');
    expect(候选.stages[0].screeningRecords?.messages).toEqual([
      { id: 's0q_1', kind: 'question', role: 'candidate', round: 1,
        text: '这个岗位是否需要固定晚班？', occurredAt: '2026-08-23T10:01:00Z' },
      { id: 's0a_1', kind: 'answer', role: 'recruiter', round: 1,
        text: '没有固定晚班。', answerStatus: 'answered', occurredAt: '2026-08-23T10:02:00Z' },
    ]);
    expect(候选.stages[0].screeningRecords?.summaries).toEqual([
      { id: 's0s_0', phase: 'initial', summary: '需要确认岗位的值班安排。',
        occurredAt: '2026-08-23T10:00:30Z' },
      { id: 's0s_1', phase: 'reevaluation', round: 1,
        summary: '已确认没有固定晚班，仍需了解其它工作安排。', occurredAt: '2026-08-23T10:03:00Z' },
    ]);
    expect(招聘.stages[0].screeningRecords?.summaries).toEqual([]);
  });

  it('双角色解出同一批 messages（招聘端恒无小结）', () => {
    const 候选 = 解P5详情(带S0记录(P5候选详情Wire, S0候选完整记录Wire), 'candidate');
    const 招聘 = 解P5详情(带S0记录(P5招聘详情Wire, S0招聘完整记录Wire), 'recruiter');
    expect(招聘.stages[0].screeningRecords?.messages).toEqual(候选.stages[0].screeningRecords?.messages);
    expect(招聘.stages[0].screeningRecords?.summaries).toEqual([]);
  });

  it('only-question、unknown／declined／not_available、空 messages＋initial、两数组空与轮次空档都按原样解码', () => {
    const 仅问题 = 解P5详情(带S0记录(P5候选详情Wire, S0仅问题记录Wire), 'candidate');
    expect(仅问题.stages[0].screeningRecords?.messages).toEqual([
      { id: 's0q_1', kind: 'question', role: 'candidate', round: 1,
        text: '这个岗位是否需要固定晚班？', occurredAt: '2026-08-23T10:01:00Z' },
    ]);
    expect(仅问题.stages[0].screeningRecords?.summaries).toEqual([]);
    // 未回答分支不带正文（unknown fixture 已省略 text）
    const 未知 = 解P5详情(带S0记录(P5候选详情Wire, S0未知回答记录Wire), 'candidate');
    expect(未知.stages[0].screeningRecords?.messages[1]).toEqual({
      id: 's0a_1', kind: 'answer', role: 'recruiter', round: 1,
      answerStatus: 'unknown', occurredAt: '2026-08-23T10:02:00Z',
    });
    // declined 与 not_available 只从 unknown fixture 替换 answer_status，不添加 text
    for (const 回答状态 of ['declined', 'not_available'] as const) {
      const 块 = {
        messages: [
          S0未知回答记录Wire.messages[0],
          { ...S0未知回答记录Wire.messages[1], answer_status: 回答状态 },
        ],
        summaries: [],
      };
      const 详情 = 解P5详情(带S0记录(P5候选详情Wire, 块), 'candidate');
      expect(详情.stages[0].screeningRecords?.messages[1]).toEqual({
        id: 's0a_1', kind: 'answer', role: 'recruiter', round: 1,
        answerStatus: 回答状态, occurredAt: '2026-08-23T10:02:00Z',
      });
    }
    // 空 messages + initial 小结
    const 仅小结 = 解P5详情(
      带S0记录(P5候选详情Wire, S0块({ messages: [], summaries: [造S0小结()] })), 'candidate',
    );
    expect(仅小结.stages[0].screeningRecords?.messages).toEqual([]);
    expect(仅小结.stages[0].screeningRecords?.summaries).toEqual([
      { id: 's0s_x', phase: 'initial', summary: '需要确认值班安排。', occurredAt: '2026-08-29T01:09:00Z' },
    ]);
    // 两数组全空（共享样本的默认块）
    expect(解P5详情(P5候选详情Wire, 'candidate').stages[0].screeningRecords)
      .toEqual({ messages: [], summaries: [] });
    // 轮次 1→3 空档：缺口保留、绝不重编号
    const 空档 = 解P5详情(带S0记录(P5候选详情Wire, S0块({
      messages: [
        造S0消息(), 造S0回答(),
        造S0消息({ id: 's0q_3', round: 3 }), 造S0回答({ id: 's0a_3', round: 3 }),
      ],
    })), 'candidate');
    expect(空档.stages[0].screeningRecords?.messages.map((消息) => 消息.round)).toEqual([1, 1, 3, 3]);
  });

  it('详情路径编码 case ID 且 include 精确一次并保持 no-store', async () => {
    请求Mock.mockResolvedValueOnce(响应(带S0记录(P5候选详情Wire, S0候选完整记录Wire)));
    await source.读取P5详情('candidate', 'mc/一?');
    expect(请求Mock).toHaveBeenCalledWith({
      path: '/api/v1/me/match-cases/mc%2F%E4%B8%80%3F?include=screening_records',
      不缓存: true,
    });
  });

  it('S0 块缺失／null、messages 或 summaries 为 null、S1–S3 错带块都漂移', () => {
    const { screening_records: _略, ...缺块区 } = P5阶段区组Wire[0];
    expect(() => 解P5详情({
      ...P5候选详情Wire,
      state: S0基态Wire,
      stages: [缺块区, ...P5阶段区组Wire.slice(1)],
    }, 'candidate')).toThrow(契约漂移);
    expect(() => 解P5详情(带S0记录(P5候选详情Wire, null), 'candidate')).toThrow(契约漂移);
    expect(() => 解P5详情(带S0记录(P5候选详情Wire, S0块({ messages: null })), 'candidate')).toThrow(契约漂移);
    expect(() => 解P5详情(带S0记录(P5候选详情Wire, S0块({ summaries: null })), 'candidate')).toThrow(契约漂移);
    for (const 错位 of [1, 2, 3]) {
      const 错位区组 = P5阶段区组Wire.map((区, 下标): Record<string, unknown> =>
        (下标 === 错位
          ? { ...(区 as unknown as Record<string, unknown>), screening_records: S0块() }
          : (区 as unknown as Record<string, unknown>)));
      expect(() => 解P5详情({ ...P5候选详情Wire, state: S0基态Wire, stages: 错位区组 }, 'candidate'))
        .toThrow(契约漂移);
    }
  });

  it('消息／小结的缺键、未知键与空或跨数组重复 ID 都漂移', () => {
    for (const 块 of [
      S0块({ messages: [略S0键(造S0消息(), 'text')] }),
      S0块({ messages: [{ ...造S0消息(), extra: 1 }] }),
      S0块({ messages: [造S0消息({ id: '' })] }),
      S0块({ messages: [造S0消息({ kind: 'note' })] }),
      S0块({ summaries: [略S0键(造S0小结(), 'summary')] }),
      S0块({ summaries: [{ ...造S0小结(), extra: 1 }] }),
      S0块({ summaries: [造S0小结({ id: '' })] }),
      S0块({ summaries: [造S0小结({ phase: 'final' })] }),
      // 小结 ID 与消息 ID 跨两数组撞车
      S0块({ summaries: [造S0小结({ id: 's0q_x' })] }),
      // messages 内部同 ID 异轮重复
      S0块({ messages: [造S0消息(), 造S0消息({ round: 2 })] }),
    ]) {
      expect(() => 解P5详情(带S0记录(P5候选详情Wire, 块), 'candidate')).toThrow(契约漂移);
    }
  });

  it('question 错 role 或带 answer_status、answered 缺 text、未回答带 text／text:null 都漂移', () => {
    for (const 块 of [
      S0块({ messages: [造S0消息({ role: 'recruiter' })] }),
      S0块({ messages: [造S0回答({ role: 'candidate' })] }),
      S0块({ messages: [造S0消息({ answer_status: 'answered' })] }),
      S0块({ messages: [造S0消息(), 略S0键(造S0回答(), 'text')] }),
      S0块({ messages: [造S0消息(), 造S0回答({ answer_status: 'unknown', text: '迟到的正文' })] }),
      S0块({ messages: [造S0消息(), 造S0回答({ answer_status: 'declined', text: null })] }),
      S0块({ messages: [造S0消息(), 造S0回答({ answer_status: 'not_available', text: null })] }),
    ]) {
      expect(() => 解P5详情(带S0记录(P5候选详情Wire, 块), 'candidate')).toThrow(契约漂移);
    }
  });

  it('text／summary 空白或有首尾空白、initial 带 round、reevaluation 缺 round 都漂移', () => {
    for (const 块 of [
      S0块({ messages: [造S0消息({ text: '   ' })] }),
      S0块({ messages: [造S0消息({ text: ' 每周几天 ' })] }),
      S0块({ messages: [造S0消息(), 造S0回答({ text: ' 三天 ' })] }),
      S0块({ summaries: [造S0小结({ summary: ' ' })] }),
      S0块({ summaries: [造S0小结({ summary: ' 小结 ' })] }),
      S0块({ summaries: [造S0小结({ round: 1 })] }),
      S0块({ summaries: [造S0小结({ phase: 'reevaluation' })] }),
    ]) {
      expect(() => 解P5详情(带S0记录(P5候选详情Wire, 块), 'candidate')).toThrow(契约漂移);
    }
  });

  it('round 为 0／超预算／数字字符串／小数、同轮重复、孤立 answer 与顺序漂移都拒绝', () => {
    for (const 块 of [
      S0块({ messages: [造S0消息({ round: 0 })] }),
      S0块({ messages: [造S0消息({ round: 4 })] }),
      S0块({ messages: [造S0消息({ round: '1' })] }),
      S0块({ messages: [造S0消息({ round: 1.5 })] }),
      // 同轮各最多一条问／答
      S0块({ messages: [造S0消息(), 造S0消息({ id: 's0q_y' })] }),
      S0块({ messages: [造S0消息(), 造S0回答(), 造S0回答({ id: 's0a_y' })] }),
      // 孤立 answer 与 answer 在同轮 question 之前
      S0块({ messages: [造S0回答()] }),
      S0块({ messages: [造S0回答(), 造S0消息()] }),
      // messages 轮次倒序
      S0块({
        messages: [
          造S0消息({ id: 's0q_2', round: 2 }), 造S0回答({ id: 's0a_2', round: 2 }),
          造S0消息({ id: 's0q_1', round: 1 }),
        ],
      }),
      // 复评小结轮次倒序／同轮重复
      S0块({
        summaries: [
          造S0小结({ id: 'r2', phase: 'reevaluation', round: 2 }),
          造S0小结({ id: 'r1', phase: 'reevaluation', round: 1 }),
        ],
      }),
      S0块({
        summaries: [
          造S0小结({ id: 'a', phase: 'reevaluation', round: 1 }),
          造S0小结({ id: 'b', phase: 'reevaluation', round: 1 }),
        ],
      }),
      // initial 晚于复评
      S0块({
        summaries: [造S0小结({ id: 'r1', phase: 'reevaluation', round: 1 }), 造S0小结()],
      }),
      // initial 最多一条：两条不同 ID 的 initial 即使都在复评之前也漂移
      S0块({ summaries: [造S0小结(), 造S0小结({ id: 's0s_y' })] }),
    ]) {
      expect(() => 解P5详情(带S0记录(P5候选详情Wire, 块), 'candidate')).toThrow(契约漂移);
    }
  });

  it('occurred_at 只收 Z 结尾的 RFC3339：小写 z、时区偏移、缺 Z 与无效日期都漂移', () => {
    for (const 坏时间 of [
      '2026-08-29T01:10:00z',
      '2026-08-29T01:10:00+00:00',
      '2026-08-29T01:10:00',
      '2026-08-29T25:10:00Z',
    ]) {
      expect(() => 解P5详情(
        带S0记录(P5候选详情Wire, S0块({ messages: [造S0消息({ occurred_at: 坏时间 })] })), 'candidate',
      )).toThrow(契约漂移);
      expect(() => 解P5详情(
        带S0记录(P5候选详情Wire, S0块({ summaries: [造S0小结({ occurred_at: 坏时间 })] })), 'candidate',
      )).toThrow(契约漂移);
    }
  });

  it('occurred_at 拒绝 RFC3339 不允许的 24 时与不存在的日历日，真闰日与秒内精度仍合法', () => {
    // Date.parse 会把这些滚动到下一天／下一个月，必须在字段域上拒绝
    for (const 坏时间 of [
      '2026-08-23T24:00:00Z',
      '2026-02-30T10:00:00Z',
      '2023-02-29T10:00:00Z', // 非闰年
      '2026-04-31T10:00:00Z',
    ]) {
      expect(() => 解P5详情(
        带S0记录(P5候选详情Wire, S0块({ messages: [造S0消息({ occurred_at: 坏时间 })] })), 'candidate',
      )).toThrow(契约漂移);
      expect(() => 解P5详情(
        带S0记录(P5候选详情Wire, S0块({ summaries: [造S0小结({ occurred_at: 坏时间 })] })), 'candidate',
      )).toThrow(契约漂移);
    }
    const 闰日 = '2024-02-29T10:00:00Z';
    expect(解P5详情(
      带S0记录(P5候选详情Wire, S0块({ messages: [造S0消息({ occurred_at: 闰日 })] })), 'candidate',
    ).stages[0].screeningRecords?.messages[0]?.occurredAt).toBe(闰日);
    const 带毫秒 = '2026-08-23T10:01:00.123Z';
    expect(解P5详情(
      带S0记录(P5候选详情Wire, S0块({ summaries: [造S0小结({ occurred_at: 带毫秒 })] })), 'candidate',
    ).stages[0].screeningRecords?.summaries[0]?.occurredAt).toBe(带毫秒);
  });

  it('招聘端展开详情带非空 summaries 即漂移（候选端小结绝不下发招聘端）', () => {
    expect(() => 解P5详情(带S0记录(P5招聘详情Wire, S0候选完整记录Wire), 'recruiter')).toThrow(契约漂移);
    expect(解P5详情(带S0记录(P5招聘详情Wire, S0招聘完整记录Wire), 'recruiter')
      .stages[0].screeningRecords?.summaries).toEqual([]);
  });

  it('解码不 trim、不修改输入 wire', () => {
    const 块 = S0块({ messages: [造S0消息({ text: ' 需要空白的问题 ' })] });
    expect(() => 解P5详情(带S0记录(P5候选详情Wire, 块), 'candidate')).toThrow(契约漂移);
    expect((块.messages as Record<string, unknown>[])[0].text).toBe(' 需要空白的问题 ');
  });

  // ── release/0.2.5 展示字段：match_score / job_detail / candidate_resume / candidate_identity ──

  /** 展示字段齐全的详情 wire（共享样本展开非 null；嵌套形状与 wire 同名同形）。 */
  const 候选展示详情Wire = { ...P5候选详情Wire, job_detail: BFF安全职位资料样本 };
  const 招聘展示详情Wire = {
    ...P5招聘详情Wire,
    job_detail: BFF安全职位资料样本,
    candidate_resume: BFF候选在线简历样本,
    candidate_identity: BFF候选身份披露样本,
  };

  /** 展示资料嵌套漂移由 展示资料.ts 抛错（本域消息不同，按协议错误码断言）。 */
  function 漂移码(执行: () => unknown): string | null {
    try {
      执行();
    } catch (错误) {
      return (错误 as { code?: string }).code ?? null;
    }
    return null;
  }

  it('两端详情解出 match_score 与 job_detail；合法 0 分与 null 快照原样保留', () => {
    expect(解P5详情(候选展示详情Wire, 'candidate')).toMatchObject({
      matchScore: 92,
      jobDetail: BFF安全职位资料样本,
    });
    expect(解P5详情(招聘展示详情Wire, 'recruiter')).toMatchObject({
      matchScore: 87,
      jobDetail: BFF安全职位资料样本,
    });
    // 合法 0 分：真实评分原样保留，绝不漂移成 null
    expect(解P5详情({ ...P5候选详情Wire, match_score: 0 }, 'candidate').matchScore).toBe(0);
    // 合法 null：legacy Case 冻结展示缺席，原样保留，不补读当前 Job
    expect(解P5详情({ ...P5候选详情Wire, job_detail: null }, 'candidate')).toMatchObject({
      matchScore: 92, jobDetail: null,
    });
    expect(解P5详情({ ...P5招聘详情Wire, match_score: null, job_detail: null }, 'recruiter')).toMatchObject({
      matchScore: null, jobDetail: null,
    });
  });

  it('招聘详情解出 candidate_resume/candidate_identity：完整档、匿名档与 disclosed 缺姓名头像不降级', () => {
    expect(解P5详情(招聘展示详情Wire, 'recruiter')).toMatchObject({
      candidateResume: BFF候选在线简历样本,
      candidateIdentity: BFF候选身份披露样本,
    });
    // 匿名档：恒三 null
    expect(解P5详情({ ...P5招聘详情Wire, candidate_identity: BFF候选身份匿名样本 }, 'recruiter'))
      .toMatchObject({ candidateIdentity: BFF候选身份匿名样本 });
    // disclosed 缺姓名头像不降级：三值全 null 仍 disclosed
    const 缺值披露 = { state: 'disclosed', name: null, avatar_url: null, disclosed_at: null } as const;
    expect(解P5详情({ ...P5招聘详情Wire, candidate_identity: 缺值披露 }, 'recruiter'))
      .toMatchObject({ candidateIdentity: 缺值披露 });
  });

  it('candidate 角色拒绝混入招聘私有键；recruiter 缺展示键或缺私有键都漂移', () => {
    expect(() => 解P5详情({ ...P5候选详情Wire, candidate_resume: BFF候选在线简历样本 }, 'candidate'))
      .toThrow(契约漂移);
    expect(() => 解P5详情({ ...P5候选详情Wire, candidate_identity: BFF候选身份匿名样本 }, 'candidate'))
      .toThrow(契约漂移);
    const { candidate_resume: _简历, ...缺简历 } = 招聘展示详情Wire;
    const { candidate_identity: _身份, ...缺身份 } = 招聘展示详情Wire;
    const { job_detail: _展示, ...缺展示 } = 候选展示详情Wire;
    const { match_score: _评分, ...缺评分 } = 候选展示详情Wire;
    expect(() => 解P5详情(缺简历, 'recruiter')).toThrow(契约漂移);
    expect(() => 解P5详情(缺身份, 'recruiter')).toThrow(契约漂移);
    expect(() => 解P5详情(缺展示, 'candidate')).toThrow(契约漂移);
    expect(() => 解P5详情(缺评分, 'candidate')).toThrow(契约漂移);
  });

  it('match_score 出域（负数/101/小数/字符串）按契约漂移拒绝', () => {
    for (const 坏评分 of [-1, 101, 1.5, '92']) {
      expect(() => 解P5详情({ ...P5候选详情Wire, match_score: 坏评分 }, 'candidate')).toThrow(契约漂移);
      expect(() => 解P5详情({ ...P5招聘详情Wire, match_score: 坏评分 }, 'recruiter')).toThrow(契约漂移);
    }
  });

  it('job_detail/candidate_resume/candidate_identity 嵌套漂移按协议错误码整包拒绝', () => {
    expect(漂移码(() => 解P5详情({ ...候选展示详情Wire, job_detail: { title: 'x' } }, 'candidate')))
      .toBe('invalid_response');
    expect(漂移码(() => 解P5详情({ ...招聘展示详情Wire, candidate_resume: { summary: 7 } }, 'recruiter')))
      .toBe('invalid_response');
    expect(漂移码(() => 解P5详情({
      ...P5招聘详情Wire,
      candidate_identity: { state: 'anonymous', name: '夹带姓名', avatar_url: null, disclosed_at: null },
    }, 'recruiter'))).toBe('invalid_response');
    expect(漂移码(() => 解P5详情({
      ...P5招聘详情Wire,
      candidate_identity: { state: 'maybe', name: null, avatar_url: null, disclosed_at: null },
    }, 'recruiter'))).toBe('invalid_response');
  });

  it('招聘列表行与历史行解出 match_score/candidate_identity；0 分、null 评分与匿名身份合法', async () => {
    请求Mock
      .mockResolvedValueOnce(响应({ items: [招聘展开工作区项], next_cursor: null }))
      .mockResolvedValueOnce(响应({
        items: [{ ...P5招聘工作区项Wire, state: P5已完成状态Wire, match_score: null }],
        next_cursor: null,
      }))
      .mockResolvedValueOnce(响应({
        items: [{ ...招聘展开工作区项, match_score: 0 }],
        next_cursor: null,
      }));
    const 首页 = await source.读取P5Open列表('recruiter', 职位ID, null);
    expect(首页.items[0]).toMatchObject({ matchScore: 87, candidateIdentity: BFF候选身份匿名样本 });
    const 历史页 = await source.读取P5历史('recruiter', 'completed', 职位ID, null);
    expect(历史页.items[0]).toMatchObject({ matchScore: null, candidateIdentity: BFF候选身份匿名样本 });
    const 零分页 = await source.读取P5Open列表('recruiter', null, null);
    expect(零分页.items[0]).toMatchObject({ matchScore: 0 });
    expect(请求Mock).toHaveBeenCalledTimes(3);
  });

  it('招聘列表/历史行缺 match_score 或 candidate_identity 漂移；候选行携带招聘私有键漂移', async () => {
    const { match_score: _评分, ...缺评分 } = P5招聘工作区项Wire;
    const { candidate_identity: _身份, ...缺身份 } = P5招聘工作区项Wire;
    for (const 破损行 of [缺评分, 缺身份]) {
      请求Mock.mockResolvedValueOnce(响应({ items: [破损行], next_cursor: null }));
      await expect(source.读取P5Open列表('recruiter', 职位ID, null))
        .rejects.toMatchObject({ code: 'invalid_response' });
      请求Mock.mockResolvedValueOnce(响应({ items: [破损行], next_cursor: null }));
      await expect(source.读取P5历史('recruiter', 'completed', 职位ID, null))
        .rejects.toMatchObject({ code: 'invalid_response' });
    }
    // 候选列表行不在合同内：携带 match_score / candidate_identity 键即漂移
    for (const 私有键 of [
      { ...P5候选工作区项Wire, match_score: 87 },
      { ...P5候选工作区项Wire, candidate_identity: BFF候选身份匿名样本 },
    ]) {
      请求Mock.mockResolvedValueOnce(响应({ items: [私有键], next_cursor: null }));
      await expect(source.读取P5Open列表('candidate', 意向ID, null))
        .rejects.toMatchObject({ code: 'invalid_response' });
    }
    expect(请求Mock).toHaveBeenCalledTimes(6);
  });

  it('招聘列表行 candidate_identity 嵌套漂移按协议错误码拒绝', async () => {
    请求Mock.mockResolvedValueOnce(响应({
      items: [{ ...P5招聘工作区项Wire, candidate_identity: { state: 'anonymous', name: '夹带', avatar_url: null, disclosed_at: null } }],
      next_cursor: null,
    }));
    await expect(source.读取P5Open列表('recruiter', 职位ID, null))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });

  // ── 请求路径 / body ──

  it('详情 GET 走角色前缀的 case 路径、恒带唯一 include 并解码 role 详情', async () => {
    请求Mock
      .mockResolvedValueOnce(响应(P5候选详情Wire))
      .mockResolvedValueOnce(响应(P5招聘详情Wire));
    await expect(source.读取P5详情('candidate', 'mc_1'))
      .resolves.toMatchObject({ role: 'candidate', context: { intentionId: 意向ID } });
    await expect(source.读取P5详情('recruiter', 'mc_2'))
      .resolves.toMatchObject({ role: 'recruiter', state: { caseId: 'mc_1' } });
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      { path: '/api/v1/me/match-cases/mc_1?include=screening_records', 不缓存: true },
      { path: '/api/v1/recruiter/match-cases/mc_2?include=screening_records', 不缓存: true },
    ]);
  });

  it('事实应答走角色前缀的 fact-responses 且 body 只带 prompt_id/response', async () => {
    请求Mock.mockResolvedValue(响应({ result: 'ok' }));
    await source.回答P5事实('candidate', 'mc_1', 'prompt_1', '四天远程', 'p5-fact-key-0001');
    expect(请求Mock).toHaveBeenCalledWith({
      path: '/api/v1/me/match-cases/mc_1/fact-responses',
      method: 'POST',
      body: { prompt_id: 'prompt_1', response: '四天远程' },
      幂等: true,
      幂等键: 'p5-fact-key-0001',
    });
    await source.回答P5事实('recruiter', 'mc_1', 'prompt_1', '每周两天到岗', 'p5-fact-key-0002');
    expect(请求Mock).toHaveBeenLastCalledWith({
      path: '/api/v1/recruiter/match-cases/mc_1/fact-responses',
      method: 'POST',
      body: { prompt_id: 'prompt_1', response: '每周两天到岗' },
      幂等: true,
      幂等键: 'p5-fact-key-0002',
    });
  });

  it('简历提交 body 逐字携带所选坐标与 literal true 披露确认，回执不进任何 DTO', async () => {
    请求Mock.mockResolvedValue(响应({ state: {}, resume_submission: {} }));
    await source.提交P5简历(
      'mc_1',
      'rf_0123456789abcdef0123456789abcdef',
      'rfv_0123456789abcdef0123456789abcdef',
      true,
      'p5-resume-key-0001',
    );
    expect(请求Mock).toHaveBeenCalledWith({
      path: '/api/v1/me/match-cases/mc_1/resume-submission',
      method: 'POST',
      body: {
        file_id: 'rf_0123456789abcdef0123456789abcdef',
        file_version_id: 'rfv_0123456789abcdef0123456789abcdef',
        disclosure_confirmed: true,
      },
      幂等: true,
      幂等键: 'p5-resume-key-0001',
    });
    await expect(source.提交P5简历(
      'mc_1',
      'rf_0123456789abcdef0123456789abcdef',
      'rfv_0123456789abcdef0123456789abcdef',
      true,
      'p5-resume-key-0002',
    )).resolves.toBeUndefined();
  });

  it('S0–S3 决策各自走冻结路径，body 只带 action，幂等键原样透传', async () => {
    请求Mock.mockResolvedValue(响应({}));
    await source.决定P5S0('mc_1', 'continue', 'p5-s0-key-00000001');
    expect(请求Mock).toHaveBeenNthCalledWith(1, {
      path: '/api/v1/me/match-cases/mc_1/decisions',
      method: 'POST',
      body: { action: 'continue' },
      幂等: true,
      幂等键: 'p5-s0-key-00000001',
    });
    await source.决定P5S1('mc_1', 'not_fit', 'p5-s1-key-00000001');
    expect(请求Mock).toHaveBeenNthCalledWith(2, {
      path: '/api/v1/recruiter/match-cases/mc_1/resume-screening-decisions',
      method: 'POST',
      body: { action: 'not_fit' },
      幂等: true,
      幂等键: 'p5-s1-key-00000001',
    });
    await source.决定P5S2('candidate', 'mc_1', 协同问题ID, 'accept', 'p5-s2-key-00000001');
    expect(请求Mock).toHaveBeenNthCalledWith(3, {
      path: `/api/v1/me/match-cases/mc_1/coordination/${协同问题ID}/decisions`,
      method: 'POST',
      body: { action: 'accept' },
      幂等: true,
      幂等键: 'p5-s2-key-00000001',
    });
    await source.决定P5S2('recruiter', 'mc_1', 协同问题ID, 'reject', 'p5-s2-key-00000002');
    expect(请求Mock).toHaveBeenNthCalledWith(4, {
      path: `/api/v1/recruiter/match-cases/mc_1/coordination/${协同问题ID}/decisions`,
      method: 'POST',
      body: { action: 'reject' },
      幂等: true,
      幂等键: 'p5-s2-key-00000002',
    });
    await source.决定P5S3('candidate', 'mc_1', 'confirm', 'p5-s3-key-00000001');
    expect(请求Mock).toHaveBeenNthCalledWith(5, {
      path: '/api/v1/me/match-cases/mc_1/intent-decisions',
      method: 'POST',
      body: { action: 'confirm' },
      幂等: true,
      幂等键: 'p5-s3-key-00000001',
    });
    await source.决定P5S3('recruiter', 'mc_1', 'decline', 'p5-s3-key-00000002');
    expect(请求Mock).toHaveBeenNthCalledWith(6, {
      path: '/api/v1/recruiter/match-cases/mc_1/intent-decisions',
      method: 'POST',
      body: { action: 'decline' },
      幂等: true,
      幂等键: 'p5-s3-key-00000002',
    });
    await source.决定P5S0('mc_1', 'end', 'p5-s0-key-00000002');
    expect(请求Mock).toHaveBeenNthCalledWith(7, {
      path: '/api/v1/me/match-cases/mc_1/decisions',
      method: 'POST',
      body: { action: 'end' },
      幂等: true,
      幂等键: 'p5-s0-key-00000002',
    });
  });

  it('Case 叮嘱走双端 agent-instructions，body 只有 text', async () => {
    请求Mock.mockResolvedValue(响应({}));
    await source.新增P5叮嘱('candidate', 'mc_1', '只在工作日联系', 'p5-instr-key-0001');
    expect(请求Mock).toHaveBeenNthCalledWith(1, {
      path: '/api/v1/me/match-cases/mc_1/agent-instructions',
      method: 'POST',
      body: { text: '只在工作日联系' },
      幂等: true,
      幂等键: 'p5-instr-key-0001',
    });
    await source.新增P5叮嘱('recruiter', 'mc_1', '工作日 10:00-19:00 联系', 'p5-instr-key-0002');
    expect(请求Mock).toHaveBeenNthCalledWith(2, {
      path: '/api/v1/recruiter/match-cases/mc_1/agent-instructions',
      method: 'POST',
      body: { text: '工作日 10:00-19:00 联系' },
      幂等: true,
      幂等键: 'p5-instr-key-0002',
    });
  });

  it('PDF 走角色前缀的 resume-submission/content 二进制 GET，显式不缓存且只认 PDF', async () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    二进制Mock
      .mockResolvedValueOnce({ blob, contentType: 'application/pdf', contentDisposition: 'inline', requestId: 'r-pdf' })
      .mockResolvedValueOnce({ blob, contentType: 'text/html', contentDisposition: null, requestId: 'r-bad' });
    await expect(source.读取P5简历PDF('candidate', 'mc_1')).resolves.toEqual({
      blob, contentType: 'application/pdf', contentDisposition: 'inline', requestId: 'r-pdf',
    });
    await expect(source.读取P5简历PDF('recruiter', 'mc_1'))
      .rejects.toMatchObject({ code: 'invalid_response', status: 200 });
    expect(二进制Mock.mock.calls.map(([path, 选项]) => [path, 选项])).toEqual([
      ['/api/v1/me/match-cases/mc_1/resume-submission/content', { 不缓存: true }],
      ['/api/v1/recruiter/match-cases/mc_1/resume-submission/content', { 不缓存: true }],
    ]);
    expect(请求Mock).not.toHaveBeenCalled();
  });

  // ── S0 信息不足终局（semantic_uncertain_stop）的成对条件约束（J-PILOT-01 C1）──

  const 信息不足状态Wire = {
    ...P5状态视图Wire,
    lifecycle: 'ended',
    status: 'ended',
    step: 'complete',
    needs_user: false,
    outcome: 'semantic_uncertain_stop',
    outcome_code: 'semantic_uncertain_stop',
    finalized_at: '2026-09-10T03:00:00Z',
  };

  it('S0 信息不足终局合法可读，且终态详情动作空、零待办', () => {
    expect(解P5状态视图(信息不足状态Wire)).toMatchObject({
      lifecycle: 'ended',
      stage: 'anonymous_screening',
      status: 'ended',
      step: 'complete',
      needsUser: false,
      outcome: 'semantic_uncertain_stop',
      outcomeCode: 'semantic_uncertain_stop',
      finalizedAt: '2026-09-10T03:00:00Z',
    });
    // 详情侧：终态行永无 viewer 待办与动作（含 S0 信息不足出口）
    const 详情 = 解P5详情({
      ...P5候选详情Wire,
      state: 信息不足状态Wire,
      needs_action: false,
      available_actions: [],
      terminal_summary: {
        ...P5终局摘要Wire,
        finalized_at: '2026-09-10T03:00:00Z',
        outcome: 'semantic_uncertain_stop',
        reason_summary: 'semantic_uncertain_stop',
      },
    }, 'candidate');
    expect(详情).toMatchObject({ needsAction: false, availableActions: [] });
  });

  it('新终局约束：outcome 必须与 outcome_code 同词（双向），混入其它终局词、非匿名初筛行或坏时间都漂移', () => {
    for (const 变体 of [
      { ...信息不足状态Wire, outcome: 'semantic_not_fit' },
      { ...信息不足状态Wire, outcome: 'user_ended' },
      // 反向漂移：outcome 已是 semantic_uncertain_stop 而 outcome_code 是其它终局词。
      // 冻结契约的 outcome 是 oneOf [string,null]（无枚举），只有 outcome_code→outcome
      // 单向 allOf —— 成对要求（Spec §7）必须在此双向钉死，否则展示层按 outcome 映射
      // 「信息不足」会掩盖真实 code 不一致。
      { ...信息不足状态Wire, outcome_code: 'semantic_not_fit' },
      { ...信息不足状态Wire, outcome_code: 'user_ended' },
      { ...信息不足状态Wire, stage: 'resume_submission' },
      { ...信息不足状态Wire, step: 'human_decision' },
      { ...信息不足状态Wire, status: 'waiting' },
      { ...信息不足状态Wire, finalized_at: '2026-09-10T03:00:00' },
      { ...信息不足状态Wire, finalized_at: null },
    ]) {
      expect(() => 解P5状态视图(变体)).toThrow(契约漂移);
    }
    // 旧合法其它终局仍可读（语义未定的新约束不追溯）
    expect(解P5状态视图(P5已终止状态Wire).outcomeCode).toBe('user_ended');
  });

  it('反向不配对的完整 ended 详情变体同样拒绝：成对校验不得被终局摘要的对齐绕过', () => {
    // 终局摘要逐字段与 state 对齐（outcome/outcome_code 各自复述），只靠摘要对齐无法暴露
    // 反向漂移 —— decoder 必须在 state 层成对拒绝
    expect(() => 解P5详情({
      ...P5候选详情Wire,
      state: { ...信息不足状态Wire, outcome_code: 'semantic_not_fit' },
      needs_action: false,
      available_actions: [],
      terminal_summary: {
        stage: 'anonymous_screening',
        outcome: 'semantic_uncertain_stop',
        reason_summary: 'semantic_not_fit',
        finalized_at: '2026-09-10T03:00:00Z',
      },
    }, 'candidate')).toThrow(契约漂移);
    // 合法成对对照仍通过（冻结文案映射由 展示映射 测试钉死）
    expect(解P5状态视图(信息不足状态Wire)).toMatchObject({
      outcome: 'semantic_uncertain_stop',
      outcomeCode: 'semantic_uncertain_stop',
    });
  });
});
