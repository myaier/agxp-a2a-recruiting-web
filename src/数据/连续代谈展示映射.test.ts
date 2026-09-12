// J-PILOT-01 Task 4：候选连续列表卡的展示投影（映射连续列表项 + 从连续到阶段）的行为测试。
// fixture 覆盖五个 phase（accepted / evaluating / evaluation_failed / refused / case_started）：
//   · pre-Case 阶段无需 Case 即出卡：阶段标题/状态文案/待办徽标由权威字段投影；
//   · case_started 依据非空 case_state 复用既有 P5 阶段/状态文案与 owner-safe 注意说明；
//   · case_state=null 的 case_started 卡照常投影（不依据 case_state=null 隐藏卡）；
//   · history 的 needs_action=false 只影响徽标，绝不据此禁止渲染或恢复（按钮权限读取 actions.retry）；
//   · 职位事实缺失（title/薪资/城市可空段）按既有缺失规则处理，不跨 API 拼资料。
// 连续快照里的 NegotiationCard 已由 facade fail-closed decode（连续代谈.ts），投影是全函数：
// 不再有第二层契约错误分支，也不重排顺序（顺序权威在服务端）。

import { describe, expect, it } from 'vitest';
import type { P5状态视图 } from './招聘数据源/MatchCase';
import type { NegotiationCard, NegotiationDetail, NegotiationPublicEvaluation } from './招聘数据源/连续代谈';
import {
  从连续到详情分段,
  从连续到详情顶栏,
  从连续到详情状态,
  从连续到职位资料,
  映射公开初评,
  映射连续失败动作,
  映射连续底栏,
  映射连续列表项,
} from './连续代谈展示映射';
import { 从连续到阶段 } from './列表卡片映射';

const 意向ID = 'int_0123456789abcdef0123456789abcdef';
const 职位ID = 'job_0123456789abcdef0123456789abcdef';

/** 已 decode 的 NegotiationCard 样本（decode 归 连续代谈.ts，此处直接喂领域 DTO）。 */
function 连续卡(选项: {
  recordId: string;
  phase: NegotiationCard['phase'];
  needsAction?: boolean;
  shelf?: NegotiationCard['shelf'];
  caseState?: P5状态视图 | null;
  failure?: NegotiationCard['failure'];
  refusalCode?: NegotiationCard['refusal_code'];
  actions?: Partial<NegotiationCard['actions']>;
  职位名?: string | null;
  城市?: string | null;
  薪资?: string | null;
}): NegotiationCard {
  const recordKind = 选项.recordId.startsWith('dlg_') ? 'delegation' : 'case';
  return {
    needs_action: 选项.needsAction ?? false,
    record_id: 选项.recordId,
    record_kind: recordKind,
    intention_id: 意向ID,
    job: {
      job_id: 职位ID,
      title: 选项.职位名 === undefined ? 'AI 产品实习生' : 选项.职位名,
      location: 选项.城市 === undefined ? '上海' : 选项.城市,
      public_salary_range: 选项.薪资 === undefined ? '300-500 元/天' : 选项.薪资,
      availability: 'available',
      organization: null,
      required_skills: null,
      recruitment_type: null,
      workplace_mode: null,
      annual_salary_months: null,
    },
    delegation_id: recordKind === 'delegation' ? 'dlg_rcpt_01' : null,
    evaluation_id: 选项.phase === 'accepted' || 选项.phase === 'evaluating' ? 'ev_01' : null,
    case_id: 选项.phase === 'case_started' ? 'mc_0123456789abcdef0123456789abcdef' : null,
    shelf: 选项.shelf ?? 'active',
    phase: 选项.phase,
    case_state: 选项.caseState === undefined ? null : 选项.caseState,
    failure: 选项.failure ?? null,
    refusal_code: 选项.refusalCode ?? null,
    actions: { retry: false, archive: false, open_case: false, ...选项.actions },
    retry_generation: 0,
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T09:00:00Z',
    archived_at: null,
    match_score: null,
  };
}

function 案例状态(覆盖: Partial<P5状态视图> = {}): P5状态视图 {
  return {
    caseId: 'mc_0123456789abcdef0123456789abcdef', lifecycle: 'open',
    stage: 'anonymous_screening', status: 'running', step: 'policy_check',
    round: 0, roundBudget: 3, needsUser: false,
    outcome: null, outcomeCode: null,
    createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-01T09:00:00Z',
    finalizedAt: null, agentAttention: null,
    ...覆盖,
  };
}

/** 已 decode 的 NegotiationDetail 样本（J-PILOT-01 Task 5：详情页 pre-Case/retention 投影用）。 */
function 连续详情(选项: {
  recordId?: string;
  phase?: NegotiationCard['phase'];
  needsAction?: boolean;
  shelf?: NegotiationCard['shelf'];
  caseState?: P5状态视图 | null;
  failure?: NegotiationCard['failure'];
  refusalCode?: NegotiationCard['refusal_code'];
  actions?: Partial<NegotiationCard['actions']>;
  caseDetail?: NegotiationDetail['case_detail'];
  publicEvaluation?: NegotiationPublicEvaluation | null;
  职位名?: string | null;
  城市?: string | null;
  薪资?: string | null;
} = {}): NegotiationDetail {
  return {
    ...连续卡({
      recordId: 选项.recordId ?? 'dlg_0123456789abcdef0123456789abcdef',
      phase: 选项.phase ?? 'accepted',
      needsAction: 选项.needsAction,
      shelf: 选项.shelf,
      caseState: 选项.caseState,
      failure: 选项.failure,
      refusalCode: 选项.refusalCode,
      actions: 选项.actions,
      职位名: 选项.职位名,
      城市: 选项.城市,
      薪资: 选项.薪资,
    }),
    evaluation: null,
    case_detail: 选项.caseDetail ?? null,
    failure_history: [],
    agent_summary: {
      public_evaluation: 选项.publicEvaluation === undefined ? null : 选项.publicEvaluation,
      condition_confirmation: null,
    },
    job_detail: null,
  };
}

describe('映射连续列表项 · 五阶段投影', () => {
  it('accepted / evaluating：代理处理中，无需 Case 即出卡', () => {
    const 受理 = 映射连续列表项(连续卡({ recordId: 'dlg_1', phase: 'accepted' }));
    expect(受理).toEqual({
      recordId: 'dlg_1',
      recordKind: 'delegation',
      intentionId: 意向ID,
      职位名: 'AI 产品实习生',
      城市: '上海',
      薪资带: '300-500 元/天',
      阶段标题: '已受理',
      状态文案: '已提交给 AI，等待处理',
      待办: false,
      徽标: '代理处理中',
      注意说明: null,
    });
    const 评估中 = 映射连续列表项(连续卡({ recordId: 'dlg_2', phase: 'evaluating' }));
    expect(评估中.阶段标题).toBe('初评中');
    expect(评估中.状态文案).toBe('AI 正在评估');
    expect(评估中.徽标).toBe('代理处理中');
  });

  it('evaluation_failed：待办给「需要你」，失败原因进注意说明；needs_action 不否决 retry', () => {
    const 待办 = 映射连续列表项(连续卡({
      recordId: 'dlg_f1',
      phase: 'evaluation_failed',
      needsAction: true,
      failure: { code: 'delegation_agent_unavailable', retryable: true },
      actions: { retry: true },
    }));
    expect(待办.阶段标题).toBe('初评失败');
    expect(待办.状态文案).toBe('本次评估未完成');
    expect(待办.待办).toBe(true);
    expect(待办.徽标).toBe('需要你');
    expect(待办.注意说明).toBe('AI 服务暂时不可用，本次没有创建 Case');

    // needs_action=false 不等于禁止 retry：卡照常渲染，恢复按钮的权限只读 actions.retry
    const 非待办 = 映射连续列表项(连续卡({
      recordId: 'dlg_f2',
      phase: 'evaluation_failed',
      needsAction: false,
      failure: { code: 'delegation_evaluation_failed', retryable: true },
      actions: { retry: true },
    }));
    expect(非待办.徽标).toBe('需注意');
    expect(非待办.注意说明).toBe('本次评估未完成，不代表候选或岗位不合适');
  });

  it('refused：显示拒绝原因，终态不出归属徽标', () => {
    const 拒绝 = 映射连续列表项(连续卡({
      recordId: 'dlg_r1',
      phase: 'refused',
      refusalCode: 'recommendation_stale',
    }));
    expect(拒绝.阶段标题).toBe('已拒绝');
    expect(拒绝.状态文案).toBe('这条推荐已过期，请刷新后查看');
    expect(拒绝.徽标).toBeNull();
    // 无码（契约允许 null）：安全兜底，不猜具体原因
    const 无码 = 映射连续列表项(连续卡({ recordId: 'dlg_r2', phase: 'refused', refusalCode: null }));
    expect(无码.状态文案).toBe('本次未能继续');
    expect(无码.徽标).toBeNull();
  });

  it('case_started：非空 case_state 复用既有 P5 阶段标题与状态文案', () => {
    const 运行中 = 映射连续列表项(连续卡({
      recordId: 'mc_1', phase: 'case_started', caseState: 案例状态(),
    }));
    expect(运行中.阶段标题).toBe('匿名初筛');
    expect(运行中.状态文案).toBe('进行中');
    expect(运行中.徽标).toBe('代理处理中');

    // 待办（Case 需要用户处理）→ 「需要你」徽标；needs_user 概念仍只来自 viewer 的 needs_action
    const 待办 = 映射连续列表项(连续卡({
      recordId: 'mc_2', phase: 'case_started', needsAction: true,
      caseState: 案例状态({ status: 'needs_user', step: 'human_decision', needsUser: true }),
    }));
    expect(待办.徽标).toBe('需要你');

    // attention 行：owner-safe 说明进注意说明，徽标「需注意」
    const 需注意 = 映射连续列表项(连续卡({
      recordId: 'mc_3', phase: 'case_started',
      caseState: 案例状态({
        stage: 'resume_submission', status: 'attention_required', step: 'screening_resume',
        agentAttention: { code: 'agent_unavailable', retryable: false },
      }),
    }));
    expect(需注意.注意说明).toBe('AI 服务暂时不可用，本 Case 尚未继续');
    expect(需注意.徽标).toBe('需注意');
  });

  it('case_state=null 的 case_started 卡照常渲染：已开案标题 + 安全进度文案，不隐藏卡', () => {
    const 卡 = 映射连续列表项(连续卡({ recordId: 'mc_3', phase: 'case_started', caseState: null }));
    expect(卡.阶段标题).toBe('已开案');
    expect(卡.状态文案).toBe('暂时无法确认进度，请稍后刷新');
    expect(卡.徽标).toBeNull(); // Case 坐标未确认，不冒充「代理处理中」
  });

  it('history 架子：needs_action 恒 false 只影响徽标，行照常投影', () => {
    const 已结束 = 映射连续列表项(连续卡({
      recordId: 'mc_e1', phase: 'case_started', shelf: 'history',
      caseState: 案例状态({
        lifecycle: 'ended', status: 'ended', step: 'complete',
        outcome: 'user_ended', outcomeCode: 'user_ended',
        finalizedAt: '2026-09-01T10:00:00Z',
      }),
    }));
    expect(已结束.阶段标题).toBe('匿名初筛');
    expect(已结束.状态文案).toBe('已结束');
    expect(已结束.待办).toBe(false);
    expect(已结束.徽标).toBeNull();

    // 已归档初评失败：显示结果/失败原因（同详情恢复由 actions.retry 权威决定）
    const 已归档失败 = 映射连续列表项(连续卡({
      recordId: 'dlg_h1', phase: 'evaluation_failed', shelf: 'history',
      failure: { code: 'delegation_failed', retryable: true },
      actions: { retry: true, archive: true },
    }));
    expect(已归档失败.阶段标题).toBe('初评失败');
    expect(已归档失败.状态文案).toBe('本次评估未完成');
    expect(已归档失败.注意说明).toBe('本次委托未完成');
  });

  it('职位可空段按既有缺失规则处理：缺失给占位文案，城市缺失由卡面出标签占位', () => {
    const 卡 = 映射连续列表项(连续卡({
      recordId: 'dlg_j1', phase: 'accepted', 职位名: null, 薪资: null, 城市: null,
    }));
    expect(卡.职位名).toBe('职位信息未知');
    expect(卡.薪资带).toBe('薪资未知');
    expect(卡.城市).toBeNull();
  });
});

describe('从连续到阶段 · 阶段区信息', () => {
  it('case_started 复用既有 P5 标题→色系闭表；pre-Case 阶段归初评色系；徽标/文本/说明原样透传', () => {
    const S0 = 从连续到阶段(映射连续列表项(连续卡({
      recordId: 'mc_1', phase: 'case_started', caseState: 案例状态(),
    })));
    expect(S0).toEqual({
      标题: '匿名初筛', 色系: '匿名初筛', 待办: false,
      徽标: '代理处理中', 文本: '进行中', 注意说明: null,
    });

    const S1 = 从连续到阶段(映射连续列表项(连续卡({
      recordId: 'mc_s1', phase: 'case_started',
      caseState: 案例状态({ stage: 'resume_submission', status: 'needs_user', step: 'awaiting_resume_parse', needsUser: true }),
    })));
    expect(S1.色系).toBe('递交简历');

    const 受理 = 从连续到阶段(映射连续列表项(连续卡({ recordId: 'dlg_1', phase: 'accepted' })));
    expect(受理.色系).toBe('匿名初筛');
    expect(受理.待办).toBe(false); // Backend 只保留徽标，不新增 Mock 的待办呼吸点

    const 待办失败 = 从连续到阶段(映射连续列表项(连续卡({
      recordId: 'dlg_f1', phase: 'evaluation_failed', needsAction: true,
      failure: { code: 'delegation_failed', retryable: true },
    })));
    expect(待办失败.徽标).toBe('需要你');
    expect(待办失败.注意说明).toBe('本次委托未完成');
  });
});
// ── J-PILOT-01 Task 5：详情页 pre-Case / retention 封闭的展示投影（Spec §6/§7/§8）──
// pre-Case 状态与四个未到达阶段是展示数据（不构造假 P5 详情）；公开初评只进现有总结托盘，
// 来源标签「公开信息初评」；底栏 placeholder 与禁用标记成对产出（Task 6 换真控件时零改数据）。

describe('Task 5 · 从连续到详情状态（pre-Case 状态区）', () => {
  it('accepted / evaluating：Spec §6 冻结文案（已接手，等待开始 / 正在进行公开信息初评），轮次恒 null（无轮次不造 0/3）', () => {
    expect(从连续到详情状态(连续详情({ phase: 'accepted' }))).toEqual({
      阶段: '已受理',
      状态: '已接手，等待开始',
      步骤: null,
      轮次: null,
      徽标: '代理处理中',
      注意说明: null,
    });
    const 评估中 = 从连续到详情状态(连续详情({ phase: 'evaluating' }));
    expect(评估中.状态).toBe('正在进行公开信息初评');
    expect(评估中.阶段).toBe('初评中');
    expect(评估中.轮次).toBeNull();
    expect(评估中.步骤).toBeNull();
  });

  it('evaluation_failed：短状态 + 失败原因进注意说明；needs_action 决定徽标', () => {
    const 待办 = 从连续到详情状态(连续详情({
      phase: 'evaluation_failed', needsAction: true,
      failure: { code: 'delegation_agent_unavailable', retryable: true },
    }));
    expect(待办.状态).toBe('本次评估未完成');
    expect(待办.注意说明).toBe('AI 服务暂时不可用，本次没有创建 Case');
    expect(待办.徽标).toBe('需要你');
    const 非待办 = 从连续到详情状态(连续详情({
      phase: 'evaluation_failed',
      failure: { code: 'delegation_failed', retryable: true },
    }));
    expect(非待办.徽标).toBe('需注意');
  });

  it('refused：拒绝原因照列表口径；case_started 封闭（case_detail=null）沿用安全进度文案', () => {
    const 拒绝 = 从连续到详情状态(连续详情({ phase: 'refused', refusalCode: 'recommendation_stale' }));
    expect(拒绝.状态).toBe('这条推荐已过期，请刷新后查看');
    expect(拒绝.徽标).toBeNull();
    const 封闭 = 从连续到详情状态(连续详情({ phase: 'case_started', caseState: null }));
    expect(封闭.状态).toBe('暂时无法确认进度，请稍后刷新');
    expect(封闭.轮次).toBeNull();
  });
});

describe('Task 5 · 从连续到详情顶栏 / 从连续到职位资料', () => {
  it('顶栏：标题带公司缺失槽，副标题 = 城市 · 薪资带；可空段缺失给占位，不猜公司', () => {
    expect(从连续到详情顶栏(连续详情({ phase: 'accepted' }))).toEqual({
      端: '求职',
      标题: 'AI 产品实习生 · 公司信息缺失',
      副标题: '上海 · 300-500 元/天',
      画像: null,
      右侧: { kind: '分数', 值: null },
      岗位上下文: null,
    });
    const 缺失 = 从连续到详情顶栏(连续详情({ phase: 'accepted', 职位名: null, 城市: null, 薪资: null }));
    expect(缺失.标题).toBe('职位信息未知 · 公司信息缺失');
    expect(缺失.副标题).toBe('城市未知 · 薪资未知');
  });

  it('职位资料：negotiation.job 只给实际字段，其余全缺失，缺口说明沿用约定句；技能段恒空', () => {
    const 资料 = 从连续到职位资料(连续详情({ phase: 'accepted' }));
    expect(资料.摘要).toEqual({ 职位: 'AI 产品实习生', 城市: '上海', 薪资: '300-500 元/天', 技能: [] });
    expect(资料.职位详情).toBeNull();
    expect(资料.公司.元行.map((行) => 行.标签)).toEqual(['融资阶段', '规模', '行业', '成立', '地址']);
    expect(资料.接口缺口说明).toBe('当前在谈详情数据未提供');
  });
});

describe('Task 5 · 从连续到详情分段（四阶段均未到达）', () => {
  it('四段一段不缺、全未到达、共用阶段名；不造轮次/对话/清单（不给 pre-Case 伪造阶段数据）', () => {
    const 分段 = 从连续到详情分段();
    expect(分段).toHaveLength(4);
    expect(分段.map((段) => 段.阶段)).toEqual(['匿名初筛', '递交简历', '需要协调', '意向确认']);
    expect(分段.every((段) => 段.态 === '未到达')).toBe(true);
    expect(分段.every((段) => 段.默认展开 === undefined)).toBe(true);
    expect(分段.every((段) => 段.对话 === undefined && 段.核对清单 === undefined)).toBe(true);
  });
});

describe('Task 5 · 映射连续底栏（Spec §7 输入框表）', () => {
  it('初评运行中：占位与禁用说明都是「AI 代理正在进行公开信息初评」，发送恒 null（无 Case 叮嘱）', () => {
    const 底栏 = 映射连续底栏(连续详情({ phase: 'evaluating' }));
    expect(底栏).toEqual({
      kind: '输入',
      占位: 'AI 代理正在进行公开信息初评',
      值: '',
      改变: expect.any(Function),
      发送: null,
      禁用说明: 'AI 代理正在进行公开信息初评',
    });
  });

  it('失败/拒绝后的真实文案：不冒充初评仍在运行', () => {
    const 失败 = 映射连续底栏(连续详情({
      phase: 'evaluation_failed',
      failure: { code: 'delegation_failed', retryable: true },
    }));
    expect(失败.kind).toBe('输入');
    if (失败.kind !== '输入') throw new Error('unreachable');
    expect(失败.占位).not.toBe('AI 代理正在进行公开信息初评');
    expect(失败.发送).toBeNull();
    expect(失败.禁用说明).toBeTruthy();

    const 拒绝 = 映射连续底栏(连续详情({ phase: 'refused', refusalCode: 'delegation_not_allowed' }));
    expect(拒绝.kind).toBe('输入');
    if (拒绝.kind !== '输入') throw new Error('unreachable');
    expect(拒绝.禁用说明).not.toBe('AI 代理正在进行公开信息初评');
  });

  it('retention 封闭（case_started 且 case_detail=null）：只读口径，不承诺可输入', () => {
    expect(映射连续底栏(连续详情({ phase: 'case_started', caseState: null }))).toEqual({
      kind: '只读',
      说明: '当前在谈已结束，仅可查看',
    });
  });
});

describe('Task 5 · 映射公开初评（现有总结托盘数据）', () => {
  const 公开初评: NegotiationPublicEvaluation = {
    evaluation_id: 'ev_pub_1',
    decision: 'fit',
    summary: '公开信息看，经验方向与岗位大体相符。',
    coverage: 'public_job_and_candidate_data',
    evidence: {
      matches: [{ dimension: 'city', code: 'city_match', source: 'structured_precheck' }],
      conflicts: [{ dimension: 'salary', code: 'below_expectation', source: 'candidate_agent' }],
      unknowns: [{ dimension: 'education', code: 'not_disclosed', source: 'candidate_agent' }],
    },
    next_action: 'promote_to_a2a',
    completed_at: '2026-09-01T09:00:00Z',
  };

  it('缺席给 null；在场给标签数据：决定/内容/证据行全以源数据呈现，不生成评分或条件裁决', () => {
    expect(映射公开初评(连续详情({ phase: 'evaluating' }))).toBeNull();
    const 视图 = 映射公开初评(连续详情({ phase: 'case_started', publicEvaluation: 公开初评 }));
    expect(视图).toEqual({
      编号: 'ev_pub_1',
      决定: 'fit',
      内容: '公开信息看，经验方向与岗位大体相符。',
      证据行们: [
        '匹配｜city｜city_match｜structured_precheck',
        '冲突｜salary｜below_expectation｜candidate_agent',
        '待确认｜education｜not_disclosed｜candidate_agent',
      ],
    });
  });
});

describe('Task 5 · 映射连续失败动作（Spec §8：只有 actions 允许时出按钮）', () => {
  it('非失败 phase 或权威不允许时给 null：refused/Case 阶段不出 Agent 重跑或归档', () => {
    expect(映射连续失败动作(连续详情({ phase: 'accepted' }))).toBeNull();
    expect(映射连续失败动作(连续详情({ phase: 'refused', refusalCode: 'delegation_not_allowed' }))).toBeNull();
    expect(映射连续失败动作(连续详情({ phase: 'case_started', caseState: null }))).toBeNull();
    expect(映射连续失败动作(连续详情({
      phase: 'evaluation_failed',
      failure: { code: 'delegation_failed', retryable: true },
    }))).toBeNull(); // actions.retry/archive 均不允许
  });

  it('失败卡：说明 = 失败原因闭表文案；重试/归档文案只在权威允许时在场；归档确认描述「移入历史，不是取消」', () => {
    const 视图 = 映射连续失败动作(连续详情({
      phase: 'evaluation_failed', needsAction: true,
      failure: { code: 'delegation_agent_unavailable', retryable: true },
      actions: { retry: true, archive: true },
    }));
    expect(视图).not.toBeNull();
    expect(视图!.卡.标题).toBe('公开信息初评未完成');
    expect(视图!.卡.说明).toBe('AI 服务暂时不可用，本次没有创建 Case');
    expect(视图!.重试文案).toBe('重试初评');
    expect(视图!.归档文案).toBe('归档');
    expect(视图!.归档确认).toEqual({
      标题: '归档这条记录？',
      正文: '移入历史，不是取消',
      执行文: '归档',
      取消文: '取消',
    });

    // 只允许重试：归档文案缺席
    const 仅重试 = 映射连续失败动作(连续详情({
      phase: 'evaluation_failed',
      failure: { code: 'delegation_failed', retryable: true },
      actions: { retry: true },
    }));
    expect(仅重试!.重试文案).toBe('重试初评');
    expect(仅重试!.归档文案).toBeNull();
  });
});
