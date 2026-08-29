// MatchCase 域数据源测试：冻结 P5 双端每个 browser call 的 method/path/query/body/调用方幂等键
// （GET 全部 不缓存: true，mutation 只带 幂等+幂等键），并锁定 strict decode（exact key set、
// 闭合 enum、17 行 lifecycle+stage+status→step 状态矩阵、viewer 专属 available_actions、
// 四阶段区固定 S0→S3、条件可空块不接受显式 null、open/history 架子规则、cursor 前置校验
// 与响应 cursor 闭合）。mutation 一律 void，权威态由后续 detail 重读提供。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF客户端, BFF请求选项, BFF响应 } from '../HTTP客户端';
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
} from '../../测试/BFF样本';
import { 创建MatchCase数据源, 解P5详情, type MatchCase数据源 } from './MatchCase';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;
type 二进制函数 = Pick<BFF客户端, '请求二进制'>['请求二进制'];

function 响应<T>(result: T): BFF响应<T> {
  return { result, etag: null, requestId: 'fixture-request' };
}

const 意向ID = 'int_0123456789abcdef0123456789abcdef';
const 职位ID = 'job_0123456789abcdef0123456789abcdef';
const 协同问题ID = 'cdi_0123456789abcdef0123456789abcdef';
const 契约漂移 = '服务返回了不符合契约的 MatchCase 数据';

const 候选Open路径 = '/api/v1/me/match-cases?limit=50';
const 候选过滤Open路径 = `/api/v1/me/match-cases?intention_id=${意向ID}&limit=50`;
const 招聘过滤Open路径 = `/api/v1/recruiter/match-cases?job_id=${职位ID}&limit=50`;
const 候选已终止历史路径 = '/api/v1/me/match-cases/history?lifecycle=ended&limit=50';
const 招聘已完成历史路径 = `/api/v1/recruiter/match-cases/history?lifecycle=completed&job_id=${职位ID}&limit=50`;

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

  // ── 列表 / 历史读取 ──

  it('双端 open 列表固定 limit=50、角色过滤器与 cursor 只编码一次，GET 全部不缓存', async () => {
    const 第二行 = { ...P5候选工作区项Wire, state: { ...P5状态视图Wire, case_id: 'mc_2' } };
    请求Mock
      .mockResolvedValueOnce(响应({ items: [P5候选工作区项Wire, 第二行], next_cursor: 'Pg2_-1' }))
      .mockResolvedValueOnce(响应({ items: [], next_cursor: null }))
      .mockResolvedValueOnce(响应({ items: [P5招聘工作区项Wire], next_cursor: null }));
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
    请求Mock.mockResolvedValueOnce(响应({ items: [{ ...P5招聘工作区项Wire, intention_id: 意向ID }], next_cursor: null }));
    await expect(source.读取P5Open列表('recruiter', null, null))
      .rejects.toMatchObject({ code: 'invalid_response' });
    expect(请求Mock).toHaveBeenCalledTimes(7);
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

  // ── 请求路径 / body ──

  it('详情 GET 走角色前缀的 case 路径并解码 role 详情', async () => {
    请求Mock
      .mockResolvedValueOnce(响应(P5候选详情Wire))
      .mockResolvedValueOnce(响应(P5招聘详情Wire));
    await expect(source.读取P5详情('candidate', 'mc_1'))
      .resolves.toMatchObject({ role: 'candidate', context: { intentionId: 意向ID } });
    await expect(source.读取P5详情('recruiter', 'mc_2'))
      .resolves.toMatchObject({ role: 'recruiter', state: { caseId: 'mc_1' } });
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      { path: '/api/v1/me/match-cases/mc_1', 不缓存: true },
      { path: '/api/v1/recruiter/match-cases/mc_2', 不缓存: true },
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
});
