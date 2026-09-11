// 连续代谈域数据源测试：冻结 J-PILOT-01 protocol B 四个 browser call 的
// method/path/query/body/幂等键（GET 不缓存、恒省略 intention_id、cursor 为 null 时省略、
// 详情不带 include、retry body 严格 {expected_retry_generation}＋key、archive 严格 {} 无 key），
// 并锁定 strict decode（exact key set、闭合 enum、record_id pattern、history needs_action=false、
// 嵌套 case_state/case_detail 复用既有 Case decoder 的权限栅栏、全量 evaluation/evidence 闭合、
// S0 信息不足终局成对 outcome/code）。用受控请求桩记录参数，不连接后端。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import { P5候选详情Wire, P5招聘详情Wire, P5状态视图Wire, P5工作区职位Wire } from '../../测试/BFF样本';
import {
  创建连续代谈数据源,
  解JobEvaluationView,
  解NegotiationCard,
  解NegotiationDetail,
  解NegotiationPage,
  解NegotiationArchiveReceipt,
  解NegotiationRetryReceipt,
  type 连续代谈数据源,
} from './连续代谈';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

function 响应<T>(result: T): BFF响应<T> {
  return { result, etag: null, requestId: 'fixture-request' };
}

const 意向ID = 'int_0123456789abcdef0123456789abcdef';
const 职位ID = 'job_0123456789abcdef0123456789abcdef';
const 记录ID = 'dlg_0123456789abcdef0123456789abcdef';
const 案件记录ID = 'mc_0123456789abcdef0123456789abcdef';

// ── 冻结 schema 的完整 wire fixture ──

/** S0 信息不足终局的合法 case_state（MatchCaseView 条件分支全部成立）。 */
const 信息不足终局Wire = {
  ...P5状态视图Wire,
  lifecycle: 'ended',
  status: 'ended',
  step: 'complete',
  needs_user: false,
  outcome: 'semantic_uncertain_stop',
  outcome_code: 'semantic_uncertain_stop',
  finalized_at: '2026-09-10T03:00:00Z',
};

/** 旧合法其它终局：语义未定，仍须可读。 */
const 用户结束终局Wire = {
  ...P5状态视图Wire,
  lifecycle: 'ended',
  status: 'ended',
  step: 'complete',
  needs_user: false,
  outcome: 'user_ended',
  outcome_code: 'user_ended',
  finalized_at: '2026-09-10T03:00:00Z',
};

function 连续卡片Wire(覆盖: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    needs_action: false,
    record_id: 记录ID,
    record_kind: 'delegation',
    intention_id: 意向ID,
    job: {
      job_id: 职位ID,
      title: 'AI 产品实习生',
      location: '上海',
      public_salary_range: '300-500 元/天',
      availability: 'available',
    },
    delegation_id: 记录ID,
    evaluation_id: 'eva_0123456789abcdef0123456789abcdef',
    case_id: null,
    shelf: 'active',
    phase: 'evaluating',
    case_state: null,
    failure: null,
    refusal_code: null,
    actions: { retry: false, archive: false, open_case: false },
    retry_generation: 0,
    created_at: '2026-09-10T01:00:00Z',
    updated_at: '2026-09-10T02:00:00Z',
    archived_at: null,
    ...覆盖,
  };
}

/** 初评失败的 active 卡：待办来自 actions.retry/archive。 */
const 失败卡片Wire = 连续卡片Wire({
  needs_action: true,
  evaluation_id: null,
  phase: 'evaluation_failed',
  failure: { code: 'delegation_evaluation_failed', retryable: true },
  actions: { retry: true, archive: true, open_case: false },
});

/** 已开案的 active 卡：待办来自 Case 阶段动作，open_case 不计作待办。 */
const 开案卡片Wire = 连续卡片Wire({
  needs_action: true,
  record_id: 案件记录ID,
  record_kind: 'case',
  delegation_id: null,
  evaluation_id: null,
  case_id: 'mc_1',
  phase: 'case_started',
  case_state: P5状态视图Wire,
});

/** 已终局归档的 history 卡：needs_action 恒 false。 */
const 历史卡片Wire = 连续卡片Wire({
  record_id: 案件记录ID,
  record_kind: 'case',
  delegation_id: null,
  evaluation_id: null,
  case_id: 'mc_1',
  shelf: 'history',
  phase: 'case_started',
  case_state: 信息不足终局Wire,
  archived_at: '2026-09-10T04:00:00Z',
});

const 初评Wire = {
  evaluation_id: 'eva_0123456789abcdef0123456789abcdef',
  state: 'completed',
  source: 'candidate_agent',
  inputs: {
    resume_revision: 2,
    intention_id: 意向ID,
    intention_revision: 1,
    job_id: 职位ID,
    job_revision: 3,
    contract_version: 'candidate_job_evaluation.v1',
  },
  input_warnings: ['resume_skills_missing'],
  result: {
    decision: 'fit',
    summary: '公开信息与岗位要求相符。',
    coverage: 'public_job_and_candidate_data',
    evidence: {
      matches: [{ dimension: 'skills', code: 'skill_match', source: 'candidate_agent' }],
      conflicts: [],
      unknowns: [],
    },
    next_action: 'promote_to_a2a',
  },
  failure: null,
  promotion: null,
  created_at: '2026-09-10T01:05:00Z',
  updated_at: '2026-09-10T01:06:00Z',
};

const 条件确认Wire = {
  case_id: 'mc_1',
  stage_status: 'active',
  latest_summary: {
    id: 's0s_0', phase: 'initial', summary: '需要确认值班安排。', occurred_at: '2026-09-10T01:09:00Z',
  },
  summaries: [
    { id: 's0s_0', phase: 'initial', summary: '需要确认值班安排。', occurred_at: '2026-09-10T01:09:00Z' },
  ],
};

/** pre-Case 详情：卡片键 + evaluation/case_detail/failure_history/agent_summary。 */
function 连续详情Wire(覆盖: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...连续卡片Wire(),
    evaluation: 初评Wire,
    case_detail: null,
    failure_history: [],
    agent_summary: { public_evaluation: null, condition_confirmation: null },
    ...覆盖,
  };
}

const 开案详情Wire = {
  ...开案卡片Wire,
  evaluation: null,
  case_detail: P5候选详情Wire,
  failure_history: [],
  agent_summary: { public_evaluation: null, condition_confirmation: 条件确认Wire },
};

const 信息不足历史详情Wire = {
  ...历史卡片Wire,
  evaluation: null,
  case_detail: null,
  failure_history: [
    { retry_generation: 0, evaluation_id: null, code: 'delegation_agent_unavailable', occurred_at: '2026-09-10T01:30:00Z' },
  ],
  agent_summary: { public_evaluation: null, condition_confirmation: null },
};

/** 真实缺键（键不在场，而不是 undefined 值）。 */
function 略键(值: Record<string, unknown>, 键: string): Record<string, unknown> {
  const { [键]: _略, ...其余 } = 值;
  return 其余;
}

describe('连续代谈数据源', () => {
  let 请求Mock: ReturnType<typeof vi.fn>;
  let source: 连续代谈数据源;

  beforeEach(() => {
    请求Mock = vi.fn();
    source = 创建连续代谈数据源(请求Mock as 请求函数);
  });

  // ── 请求捕获：path / query / body / 幂等键 正反例 ──

  it('active 首页请求恰为 shelf+limit=50，恒无 intention_id 且 cursor 为 null 时省略', async () => {
    请求Mock.mockResolvedValueOnce(响应({ items: [], next_cursor: null }));
    await expect(source.读取候选连续列表('active', null)).resolves.toEqual({ items: [], next_cursor: null });
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      { path: '/api/v1/me/negotiations?shelf=active&limit=50', 不缓存: true },
    ]);
    expect(请求Mock.mock.calls[0][0].path).not.toContain('intention_id');
    expect(请求Mock.mock.calls[0][0].path).not.toContain('cursor');
  });

  it('history 带下一页 cursor 只编码一次，shelf 恒在场', async () => {
    请求Mock.mockResolvedValueOnce(响应({ items: [], next_cursor: null }));
    await source.读取候选连续列表('history', 'Pg2_-1');
    expect(请求Mock).toHaveBeenCalledWith({
      path: '/api/v1/me/negotiations?shelf=history&limit=50&cursor=Pg2_-1',
      不缓存: true,
    });
  });

  it('调用方 cursor 在任何 fetch 前校验：空/坏形状/超长即拒绝且零请求，恰 4096 合法', async () => {
    for (const 坏游标 of ['', 'bad/cursor+eq=', 'a'.repeat(4097), 7 as unknown as string]) {
      await expect(source.读取候选连续列表('active', 坏游标))
        .rejects.toMatchObject({ code: 'invalid_request' });
    }
    expect(请求Mock).not.toHaveBeenCalled();
    请求Mock.mockResolvedValueOnce(响应({ items: [], next_cursor: null }));
    await expect(source.读取候选连续列表('active', 'a'.repeat(4096)))
      .resolves.toEqual({ items: [], next_cursor: null });
    expect(请求Mock.mock.calls[0][0].path)
      .toBe(`/api/v1/me/negotiations?shelf=active&limit=50&cursor=${'a'.repeat(4096)}`);
  });

  it('详情 GET 不带 include、恒不缓存，并按 candidate 解码嵌套 Case', async () => {
    请求Mock.mockResolvedValueOnce(响应(开案详情Wire));
    const 详情 = await source.读取候选连续详情(案件记录ID);
    expect(详情.record_id).toBe(案件记录ID);
    expect(详情.case_detail).toMatchObject({ role: 'candidate', context: { intentionId: 意向ID } });
    expect(请求Mock).toHaveBeenCalledWith({
      path: `/api/v1/me/negotiations/${案件记录ID}`,
      不缓存: true,
    });
    expect(请求Mock.mock.calls[0][0].path).not.toContain('include');
  });

  it('retry 严格 body 为 {expected_retry_generation} 且带 Idempotency-Key；0 是合法第一代', async () => {
    请求Mock.mockResolvedValueOnce(响应({ record_id: 记录ID, retry_generation: 1 }));
    await expect(source.重试候选连续记录(记录ID, 0, 'neg-retry-key-00000001'))
      .resolves.toEqual({ record_id: 记录ID, retry_generation: 1 });
    expect(请求Mock).toHaveBeenCalledWith({
      path: `/api/v1/me/negotiations/${记录ID}/retry`,
      method: 'POST',
      body: { expected_retry_generation: 0 },
      幂等: true,
      幂等键: 'neg-retry-key-00000001',
    });
    请求Mock.mockClear();
    请求Mock.mockResolvedValueOnce(响应({ record_id: 记录ID, retry_generation: 3 }));
    await source.重试候选连续记录(记录ID, 3, 'neg-retry-key-00000002');
    expect(请求Mock.mock.calls[0][0].body).toEqual({ expected_retry_generation: 3 });
    expect(Object.keys(请求Mock.mock.calls[0][0].body)).toEqual(['expected_retry_generation']);
  });

  it('archive 严格 body 为 {} 且无 Idempotency-Key', async () => {
    请求Mock.mockResolvedValueOnce(响应({ record_id: 记录ID, archived_at: '2026-09-10T04:00:00Z' }));
    await expect(source.归档候选连续记录(记录ID))
      .resolves.toEqual({ record_id: 记录ID, archived_at: '2026-09-10T04:00:00Z' });
    expect(请求Mock).toHaveBeenCalledWith({
      path: `/api/v1/me/negotiations/${记录ID}/archive`,
      method: 'POST',
      body: {},
    });
  });

  it('路径中的 record ID 逐字编码，不解析、不改写', async () => {
    请求Mock.mockResolvedValue(响应(开案详情Wire));
    await source.读取候选连续详情(案件记录ID);
    expect(请求Mock.mock.calls[0][0].path).toBe(`/api/v1/me/negotiations/${案件记录ID}`);
    请求Mock.mockClear();
    请求Mock.mockResolvedValue(响应({ record_id: 记录ID, retry_generation: 0 }));
    await source.重试候选连续记录(案件记录ID, 0, 'neg-retry-key-00000003');
    expect(请求Mock.mock.calls[0][0].path).toBe(`/api/v1/me/negotiations/${案件记录ID}/retry`);
  });

  // ── 列表页解码 ──

  it('active 页解出 pre-Case 卡片原字段名与失败块', async () => {
    请求Mock
      .mockResolvedValueOnce(响应({ items: [失败卡片Wire], next_cursor: 'Pg2_-1' }))
      .mockResolvedValueOnce(响应({ items: [], next_cursor: null }));
    const 首页 = await source.读取候选连续列表('active', null);
    expect(首页).toMatchObject({
      items: [{
        needs_action: true,
        record_id: 记录ID,
        record_kind: 'delegation',
        intention_id: 意向ID,
        job: {
          job_id: 职位ID,
          title: 'AI 产品实习生',
          location: '上海',
          public_salary_range: '300-500 元/天',
          availability: 'available',
        },
        case_id: null,
        shelf: 'active',
        phase: 'evaluation_failed',
        case_state: null,
        failure: { code: 'delegation_evaluation_failed', retryable: true },
        refusal_code: null,
        actions: { retry: true, archive: true, open_case: false },
        retry_generation: 0,
        archived_at: null,
      }],
      next_cursor: 'Pg2_-1',
    });
    const 次页 = await source.读取候选连续列表('active', 'Pg2_-1');
    expect(次页).toEqual({ items: [], next_cursor: null });
    expect(请求Mock).toHaveBeenCalledTimes(2);
  });

  it('开案卡待办来自 Case 阶段动作；history 页解出信息不足终局卡', async () => {
    请求Mock
      .mockResolvedValueOnce(响应({ items: [开案卡片Wire], next_cursor: null }))
      .mockResolvedValueOnce(响应({ items: [历史卡片Wire], next_cursor: null }));
    const 开案页 = await source.读取候选连续列表('active', null);
    expect(开案页.items[0]).toMatchObject({
      needs_action: true,
      phase: 'case_started',
      record_kind: 'case',
      case_id: 'mc_1',
      actions: { retry: false, archive: false, open_case: false },
      case_state: { caseId: 'mc_1', lifecycle: 'open', status: 'running', step: 'policy_check' },
    });
    const 历史页 = await source.读取候选连续列表('history', null);
    expect(历史页.items[0]).toMatchObject({
      shelf: 'history',
      needs_action: false,
      phase: 'case_started',
      case_state: {
        lifecycle: 'ended',
        stage: 'anonymous_screening',
        status: 'ended',
        step: 'complete',
        needsUser: false,
        outcome: 'semantic_uncertain_stop',
        outcomeCode: 'semantic_uncertain_stop',
        finalizedAt: '2026-09-10T03:00:00Z',
      },
      archived_at: '2026-09-10T04:00:00Z',
    });
  });

  it('页 wrapper 缺 next_cursor / items 为 null / 行为 null / 多未知键都按契约漂移拒绝', async () => {
    for (const 坏页 of [
      { items: [] },
      { items: null, next_cursor: null },
      { items: [null], next_cursor: null },
      { items: [], next_cursor: 7 },
      { items: [], next_cursor: '' },
      { items: [], next_cursor: 'bad/cursor' },
      { items: [], next_cursor: null, total: 3 },
      { items: [略键(连续卡片Wire(), 'actions')], next_cursor: null },
      { items: [连续卡片Wire()], next_cursor: null, extra: 1 },
    ]) {
      请求Mock.mockResolvedValueOnce(响应(坏页));
      await expect(source.读取候选连续列表('active', null))
        .rejects.toMatchObject({ code: 'invalid_response' });
    }
    expect(请求Mock).toHaveBeenCalledTimes(9);
  });

  it('卡片反例：漏 required、history 待办 true、record_id 形状、坏枚举、坏时间与负代际', () => {
    for (const 破损 of [
      略键(连续卡片Wire(), 'needs_action'),
      略键(连续卡片Wire(), 'record_id'),
      略键(连续卡片Wire(), 'retry_generation'),
      略键(连续卡片Wire(), 'archived_at'),
      连续卡片Wire({ extra: 1 }),
      连续卡片Wire({ shelf: 'history', needs_action: true }),
      连续卡片Wire({ record_id: 'dlg_1' }),
      连续卡片Wire({ record_id: 'xx_0123456789abcdef0123456789abcdef' }),
      连续卡片Wire({ record_kind: 'negotiation' }),
      连续卡片Wire({ phase: 'needs_user' }),
      连续卡片Wire({ intention_id: '' }),
      连续卡片Wire({ job: { ...(连续卡片Wire().job as Record<string, unknown>), availability: 'maybe' } }),
      连续卡片Wire({ job: 略键(连续卡片Wire().job as Record<string, unknown>, 'title') }),
      连续卡片Wire({ job: { ...(连续卡片Wire().job as Record<string, unknown>), title: undefined } }),
      连续卡片Wire({ failure: { code: 'delegation_evaluation_failed', retryable: 'yes' } }),
      连续卡片Wire({ failure: { code: 'semantic_not_fit', retryable: true } }),
      连续卡片Wire({ refusal_code: 'not_a_code' }),
      连续卡片Wire({ delegation_id: undefined }),
      连续卡片Wire({ actions: { retry: false, archive: false } }),
      连续卡片Wire({ actions: { retry: false, archive: false, open_case: false, extend: true } }),
      连续卡片Wire({ retry_generation: -1 }),
      连续卡片Wire({ retry_generation: 1.5 }),
      连续卡片Wire({ created_at: '昨天' }),
      连续卡片Wire({ archived_at: '2026-09-10T04:00:00' }),
      连续卡片Wire({ case_state: {} }),
      连续卡片Wire({ case_state: { ...信息不足终局Wire, lifecycle: 'open' } }),
    ]) {
      expect(() => 解NegotiationCard(破损)).toThrow();
    }
    // history 恒无待办；旧合法其它终局仍可读；三显示字段全 null 合法
    expect(解NegotiationCard(连续卡片Wire({ shelf: 'history', needs_action: false })).shelf).toBe('history');
    expect(解NegotiationCard(连续卡片Wire({
      shelf: 'history', record_id: 案件记录ID, record_kind: 'case', case_id: 'mc_1',
      delegation_id: null, evaluation_id: null, phase: 'case_started', case_state: 用户结束终局Wire,
      archived_at: '2026-09-10T04:00:00Z',
    })).case_state).toMatchObject({ outcomeCode: 'user_ended' });
    expect(解NegotiationCard(连续卡片Wire({
      job: { job_id: 职位ID, title: null, location: null, public_salary_range: null, availability: 'unavailable' },
    })).job).toEqual({
      job_id: 职位ID, title: null, location: null, public_salary_range: null, availability: 'unavailable',
    });
  });

  // ── 详情解码：卡片一致性与嵌套 Case / 初评 / 失败史 / agent summary ──

  it('详情解出卡片全部键且与同值列表卡逐字段一致', () => {
    const 详情 = 解NegotiationDetail(开案详情Wire);
    const 卡片 = 解NegotiationCard(开案卡片Wire);
    const { evaluation: _评估, case_detail: _案件, failure_history: _失败史, agent_summary: _总结, ...详情卡片部分 } = 详情;
    expect(详情卡片部分).toEqual(卡片);
    expect(详情.case_detail).toMatchObject({ role: 'candidate', context: { intentionId: 意向ID } });
    expect(详情.failure_history).toEqual([]);
    expect(详情.agent_summary).toEqual({
      public_evaluation: null,
      condition_confirmation: {
        case_id: 'mc_1',
        stage_status: 'active',
        latest_summary: {
          id: 's0s_0', phase: 'initial', summary: '需要确认值班安排。', occurredAt: '2026-09-10T01:09:00Z',
        },
        summaries: [{
          id: 's0s_0', phase: 'initial', summary: '需要确认值班安排。', occurredAt: '2026-09-10T01:09:00Z',
        }],
      },
    });
  });

  it('公开初评整包解码：decision/coverage/next_action 闭合、evidence 三数组严格、promotion 复用 Case 视图', () => {
    const 详情 = 解NegotiationDetail(连续详情Wire());
    expect(详情.evaluation).toMatchObject({
      evaluation_id: 'eva_0123456789abcdef0123456789abcdef',
      state: 'completed',
      source: 'candidate_agent',
      inputs: {
        resume_revision: 2,
        intention_id: 意向ID,
        intention_revision: 1,
        job_id: 职位ID,
        job_revision: 3,
        contract_version: 'candidate_job_evaluation.v1',
      },
      input_warnings: ['resume_skills_missing'],
      result: {
        decision: 'fit',
        summary: '公开信息与岗位要求相符。',
        coverage: 'public_job_and_candidate_data',
        evidence: {
          matches: [{ dimension: 'skills', code: 'skill_match', source: 'candidate_agent' }],
          conflicts: [],
          unknowns: [],
        },
        next_action: 'promote_to_a2a',
      },
      failure: null,
      promotion: null,
    });
    // promotion 复用既有 MatchCaseView decoder
    const 带晋升 = 解NegotiationDetail(连续详情Wire({
      evaluation: { ...初评Wire, promotion: 用户结束终局Wire },
    }));
    expect(带晋升.evaluation?.promotion).toMatchObject({ caseId: 'mc_1', lifecycle: 'ended' });
    // pending 评估的 result/failure 双空合法
    expect(解NegotiationDetail(连续详情Wire({
      evaluation: { ...初评Wire, state: 'pending', result: null },
    })).evaluation).toMatchObject({ state: 'pending', result: null });
  });

  it('失败史逐事件闭合且原样保序', () => {
    const 详情 = 解NegotiationDetail(信息不足历史详情Wire);
    expect(详情.failure_history).toEqual([
      { retry_generation: 0, evaluation_id: null, code: 'delegation_agent_unavailable', occurred_at: '2026-09-10T01:30:00Z' },
    ]);
    expect(详情.agent_summary).toEqual({ public_evaluation: null, condition_confirmation: null });
  });

  it('agent_summary 与条件确认：双半可空、latest_summary 可空、S0 小结复用既有 decoder', () => {
    // 聚合携带条件确认必须先有外层 Case 坐标（见 聚合身份一致 用例），故用开案详情底座
    expect(解NegotiationDetail({
      ...开案详情Wire,
      agent_summary: {
        public_evaluation: null,
        condition_confirmation: { ...条件确认Wire, latest_summary: null, summaries: [] },
      },
    }).agent_summary.condition_confirmation).toMatchObject({ latest_summary: null, summaries: [] });
    // 复评小结轮次必须 ≥1（MatchCaseScreeningSummary 的 minimum:1）
    expect(() => 解NegotiationDetail({
      ...开案详情Wire,
      agent_summary: {
        public_evaluation: null,
        condition_confirmation: {
          ...条件确认Wire,
          summaries: [{ id: 's0s_1', phase: 'reevaluation', round: 0, summary: '复评。', occurred_at: '2026-09-10T01:10:00Z' }],
        },
      },
    })).toThrow();
  });

  it('agent_summary / 失败史反例：缺键、坏枚举与非法事件', () => {
    const 合法公开初评 = {
      evaluation_id: 'eva_1', decision: 'fit', summary: 's', coverage: 'public_job_and_candidate_data',
      evidence: { matches: [], conflicts: [], unknowns: [] }, next_action: 'stop',
      completed_at: '2026-09-10T01:06:00Z',
    };
    for (const 破损 of [
      连续详情Wire({ agent_summary: {} }),
      连续详情Wire({ agent_summary: { public_evaluation: null } }),
      连续详情Wire({ agent_summary: { public_evaluation: {}, condition_confirmation: null } }),
      连续详情Wire({ agent_summary: { public_evaluation: { ...合法公开初评, decision: 'maybe' }, condition_confirmation: null } }),
      连续详情Wire({ agent_summary: { public_evaluation: { ...合法公开初评, coverage: 'private_data' }, condition_confirmation: null } }),
      连续详情Wire({ agent_summary: { public_evaluation: { ...合法公开初评, next_action: 'nudge' }, condition_confirmation: null } }),
      连续详情Wire({ agent_summary: { public_evaluation: { ...合法公开初评, evidence: { matches: null, conflicts: [], unknowns: [] } }, condition_confirmation: null } }),
      连续详情Wire({ agent_summary: { public_evaluation: null, condition_confirmation: { ...条件确认Wire, stage_status: 'paused' } } }),
      连续详情Wire({ agent_summary: { public_evaluation: null, condition_confirmation: { ...条件确认Wire, summaries: null } } }),
      连续详情Wire({ agent_summary: { public_evaluation: null, condition_confirmation: 略键(条件确认Wire, 'case_id') } }),
      连续详情Wire({ failure_history: null }),
      连续详情Wire({ failure_history: [{ retry_generation: 0, occurred_at: '2026-09-10T01:30:00Z' }] }),
      连续详情Wire({ failure_history: [{ retry_generation: 0, evaluation_id: null, code: 'semantic_not_fit', occurred_at: '2026-09-10T01:30:00Z' }] }),
      连续详情Wire({ failure_history: [{ retry_generation: -1, evaluation_id: null, code: 'delegation_failed', occurred_at: '2026-09-10T01:30:00Z' }] }),
      连续详情Wire({ failure_history: [{ retry_generation: 0, evaluation_id: null, code: 'delegation_failed', occurred_at: '昨天' }] }),
      连续详情Wire({ failure_history: [{ retry_generation: 0, evaluation_id: null, code: 'delegation_failed', occurred_at: '2026-09-10T01:30:00Z', extra: 1 }] }),
    ]) {
      expect(() => 解NegotiationDetail(破损)).toThrow();
    }
    expect(解NegotiationDetail(连续详情Wire({
      agent_summary: { public_evaluation: 合法公开初评, condition_confirmation: null },
    })).agent_summary.public_evaluation).toEqual({
      evaluation_id: 'eva_1', decision: 'fit', summary: 's', coverage: 'public_job_and_candidate_data',
      evidence: { matches: [], conflicts: [], unknowns: [] }, next_action: 'stop',
      completed_at: '2026-09-10T01:06:00Z',
    });
  });

  it('初评 evaluation 反例：漏 required、坏 state/source、warnings 与 evidence 非 null、state↔result/failure 耦合', () => {
    for (const 破损 of [
      略键(初评Wire, 'input_warnings'),
      略键(初评Wire, 'promotion'),
      略键(初评Wire, 'result'),
      { ...初评Wire, extra: 1 },
      { ...初评Wire, state: 'running' },
      { ...初评Wire, source: 'recruiter_agent' },
      { ...初评Wire, inputs: { ...初评Wire.inputs, contract_version: 'candidate_job_evaluation.v2' } },
      { ...初评Wire, inputs: { ...初评Wire.inputs, resume_revision: -1 } },
      { ...初评Wire, input_warnings: ['resume_height_missing'] },
      { ...初评Wire, input_warnings: null },
      { ...初评Wire, result: { ...初评Wire.result, decision: 'maybe' } },
      { ...初评Wire, result: { ...初评Wire.result, coverage: 'private_data' } },
      { ...初评Wire, result: { ...初评Wire.result, next_action: 'nudge' } },
      { ...初评Wire, result: { ...初评Wire.result, evidence: { ...初评Wire.result.evidence, conflicts: null } } },
      { ...初评Wire, result: { ...初评Wire.result, evidence: { ...初评Wire.result.evidence, matches: [{ dimension: 'skills' }] } } },
      { ...初评Wire, result: { ...初评Wire.result, evidence: { ...初评Wire.result.evidence, matches: [{ ...初评Wire.result.evidence.matches[0], source: 'recruiter_agent' }] } } },
      { ...初评Wire, promotion: {} },
      { ...初评Wire, created_at: '昨天' },
      { ...初评Wire, terminal_at: '昨天' },
    ]) {
      expect(() => 解JobEvaluationView(破损)).toThrow();
    }
    expect(() => 解JobEvaluationView({ ...初评Wire, result: null })).toThrow();
    expect(() => 解JobEvaluationView({
      ...初评Wire, state: 'failed', failure: { code: 'agent_execution_failed', retryable: true },
    })).toThrow();
    expect(() => 解JobEvaluationView({ ...初评Wire, state: 'pending' })).toThrow();
    expect(() => 解JobEvaluationView({
      ...初评Wire, state: 'pending', result: null,
    })).not.toThrow();
    const 失败评估 = 解JobEvaluationView({
      ...初评Wire, state: 'failed', result: null,
      failure: { code: 'agent_execution_failed', retryable: true },
    });
    expect(失败评估.failure).toEqual({ code: 'agent_execution_failed', retryable: true });
    expect(解JobEvaluationView({ ...初评Wire, terminal_at: '2026-09-10T01:06:00Z' })).toMatchObject({
      terminal_at: '2026-09-10T01:06:00Z',
    });
  });

  it('详情漏 required / 多未知键 / 嵌套 Case 权限漂移都拒绝', () => {
    for (const 破损 of [
      略键(连续详情Wire(), 'evaluation'),
      略键(连续详情Wire(), 'case_detail'),
      略键(连续详情Wire(), 'failure_history'),
      略键(连续详情Wire(), 'agent_summary'),
      连续详情Wire({ extra: 1 }),
      // 招聘端 Case 详情不能充当候选 case_detail（缺 intention_id 即漂移）
      { ...开案详情Wire, case_detail: P5招聘详情Wire },
      // 候选详情收到招聘端专属动作即漂移
      { ...开案详情Wire, case_detail: { ...P5候选详情Wire, available_actions: ['decide_resume_screening'] } },
      // case_detail 携带白名单外键
      { ...开案详情Wire, case_detail: { ...P5候选详情Wire, candidate_summary: {} } },
      // S0 信息不足终局混入语义不适配的 outcome（成对约束）
      {
        ...信息不足历史详情Wire,
        case_state: { ...信息不足终局Wire, outcome: 'semantic_not_fit' },
      },
    ]) {
      expect(() => 解NegotiationDetail(破损)).toThrow();
    }
    // 合法对照：同一信息不足终局在详情内可读
    expect(解NegotiationDetail(信息不足历史详情Wire).case_state)
      .toMatchObject({ outcomeCode: 'semantic_uncertain_stop' });
  });

  it('卡片 job 不接受缺键变体；既有 P5 工作区职位样本键集与卡片 job 不同形', () => {
    expect(() => 解NegotiationCard(连续卡片Wire({
      job: { ...P5工作区职位Wire, availability: undefined } as unknown as Record<string, unknown>,
    }))).toThrow();
  });

  it('聚合身份一致：外层无 Case 时内层 Case 块必缺席；外层有 Case 时在场内层坐标必与之一致', () => {
    // 外层 case_id=null（pre-Case）而任一内层 Case 块在场 → 跨记录聚合，整包拒绝
    for (const 破损 of [
      连续详情Wire({ case_state: P5状态视图Wire }),
      连续详情Wire({ case_detail: P5候选详情Wire }),
      连续详情Wire({ agent_summary: { public_evaluation: null, condition_confirmation: 条件确认Wire } }),
      { ...开案详情Wire, case_id: null },
    ]) {
      expect(() => 解NegotiationDetail(破损)).toThrow();
    }
    // 外层 mc_1 而任一内层块来自另一 Case（mc_2）→ 各字段单独合法但归属不一致，拒绝
    for (const 破损 of [
      { ...开案详情Wire, case_state: { ...P5状态视图Wire, case_id: 'mc_2' } },
      { ...开案详情Wire, case_detail: { ...P5候选详情Wire, state: { ...P5状态视图Wire, case_id: 'mc_2' } } },
      {
        ...开案详情Wire,
        agent_summary: { public_evaluation: null, condition_confirmation: { ...条件确认Wire, case_id: 'mc_2' } },
      },
    ]) {
      expect(() => 解NegotiationDetail(破损)).toThrow();
    }
    // 合法对照：开案详情全部内层坐标同为 mc_1，pre-Case 详情三块全空，均可读
    expect(() => 解NegotiationDetail(开案详情Wire)).not.toThrow();
    expect(() => 解NegotiationDetail(连续详情Wire())).not.toThrow();
  });

  // ── 回执解码 ──

  it('retry/archive 回执逐字段闭合', () => {
    expect(解NegotiationRetryReceipt({ record_id: 记录ID, retry_generation: 1 }))
      .toEqual({ record_id: 记录ID, retry_generation: 1 });
    expect(解NegotiationArchiveReceipt({ record_id: 案件记录ID, archived_at: '2026-09-10T04:00:00Z' }))
      .toEqual({ record_id: 案件记录ID, archived_at: '2026-09-10T04:00:00Z' });
    for (const 坏回执 of [
      { record_id: 记录ID },
      { record_id: 记录ID, retry_generation: -1 },
      { record_id: '', retry_generation: 1 },
      { record_id: 记录ID, retry_generation: 1, extra: 1 },
    ]) {
      expect(() => 解NegotiationRetryReceipt(坏回执)).toThrow();
    }
    for (const 坏回执 of [
      { record_id: 记录ID },
      { record_id: 记录ID, archived_at: '2026-09-10T04:00:00' },
      { record_id: 记录ID, archived_at: null },
      { record_id: 记录ID, archived_at: '2026-09-10T04:00:00Z', extra: 1 },
    ]) {
      expect(() => 解NegotiationArchiveReceipt(坏回执)).toThrow();
    }
  });

  it('页 decoder 与 facade 返回同一闭合形状', () => {
    const 页Wire = { items: [连续卡片Wire()], next_cursor: null };
    expect(解NegotiationPage(页Wire)).toEqual({
      items: [解NegotiationCard(连续卡片Wire())],
      next_cursor: null,
    });
  });
});