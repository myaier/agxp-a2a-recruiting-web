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
import { BFF安全职位资料样本, BFF公司摘要样本 } from '../测试/展示资料样本';

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
  组织?: NegotiationCard['job']['organization'];
  技能?: string[] | null;
  办公方式?: NegotiationCard['job']['workplace_mode'];
  薪资月数?: number | null;
  匹配分?: number | null;
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
      organization: 选项.组织 ?? null,
      required_skills: 选项.技能 ?? null,
      recruitment_type: null,
      workplace_mode: 选项.办公方式 ?? null,
      annual_salary_months: 选项.薪资月数 ?? null,
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
    match_score: 选项.匹配分 ?? null,
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
  /** Task 6：详情响应的冻结职位资料与权威分（旧记录合法 null 档）。 */
  jobDetail?: NegotiationDetail['job_detail'];
  匹配分?: number | null;
  /** review-r1：外层 NegotiationJob 的公司摘要与技能（同响应权威事实）。 */
  组织?: NegotiationCard['job']['organization'];
  技能?: string[] | null;
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
      组织: 选项.组织,
      技能: 选项.技能,
      匹配分: 选项.匹配分,
    }),
    evaluation: null,
    case_detail: 选项.caseDetail ?? null,
    failure_history: [],
    agent_summary: {
      public_evaluation: 选项.publicEvaluation === undefined ? null : 选项.publicEvaluation,
      condition_confirmation: null,
    },
    job_detail: 选项.jobDetail ?? null,
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
      公司: null,
      公司简介: null,
      公司字标: null,
      公司图片URL: null,
      匹配分: null,
      标签们: ['上海'],
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

  // Task 6：顶栏取同一响应的 match_score 与 job_detail 公司名（列表/详情、pre-case/case 一致）
  it('冻结组织与权威分在场：标题公司名用 job_detail 组织名，右侧 0 是合法值；无溯源不造 0', () => {
    const 完整 = 从连续到详情顶栏(
      连续详情({ phase: 'accepted', jobDetail: BFF安全职位资料样本, 匹配分: 73 }),
    );
    expect(完整.标题).toBe('AI 产品实习生 · 云衢科技');
    expect(完整.右侧).toEqual({ kind: '分数', 值: 73 });
    const 零分 = 从连续到详情顶栏(连续详情({ phase: 'accepted', 匹配分: 0 }));
    expect(零分.右侧).toEqual({ kind: '分数', 值: 0 });
    const 无分 = 从连续到详情顶栏(连续详情({ phase: 'accepted' }));
    expect(无分.右侧).toEqual({ kind: '分数', 值: null });
    expect(无分.标题).toBe('AI 产品实习生 · 公司信息缺失');
  });

  it('职位资料：negotiation.job 只给实际字段，其余全缺失，缺口说明沿用约定句；技能 null/[]/有值三态如实区分', () => {
    // required_skills=null 是「未知」，不得折算成「已知为空」
    const 资料 = 从连续到职位资料(连续详情({ phase: 'accepted' }));
    expect(资料.摘要).toEqual({ 职位: 'AI 产品实习生', 城市: '上海', 薪资: '300-500 元/天', 技能: null });
    expect(从连续到职位资料(连续详情({ phase: 'accepted', 技能: ['Go', '高并发'] })).摘要?.技能)
      .toEqual(['Go', '高并发']);
    expect(从连续到职位资料(连续详情({ phase: 'accepted', 技能: [] })).摘要?.技能).toEqual([]);
    expect(资料.职位详情).toBeNull();
    expect(资料.公司.元行.map((行) => 行.标签)).toEqual(['融资阶段', '规模', '行业', '成立', '地址']);
    expect(资料.接口缺口说明).toBe('当前在谈详情数据未提供');
    // 权威分只进分析分数槽，无对齐证据不给行（与 Case 详情同一底座）
    expect(从连续到职位资料(连续详情({ phase: 'accepted', 匹配分: 73 })).分析).toEqual({
      分: 73, 行们: null, 文案: null,
    });
  });

  // Task 6：pre-case 也用它自身 job_detail —— 不因为没有 case_id 不显示已给的冻结职位
  it('pre-case job_detail 在场：JD/公司/发布人照常投影（case_id 为 null 不是隐藏理由）', () => {
    const 资料 = 从连续到职位资料(
      连续详情({ phase: 'accepted', jobDetail: BFF安全职位资料样本 }),
    );
    expect(资料.职位详情).toEqual(['参与产品工作']);
    expect(资料.公司.名称).toBe('云衢科技');
    expect(资料.公司.编号).toBe('org_1');
    expect(资料.对接人.姓名).toBe('林澈');
    expect(资料.接口缺口说明).toBeNull();
    expect(资料.摘要).toEqual({ 职位: 'AI 产品实习生', 城市: '上海', 薪资: '300-500 元/天', 技能: null });
  });

  // review-r1：job_detail 缺组织/缺席时，顶栏公司名回退到同一响应外层 job.organization（同语义，
  // 不补读）；双方都缺才给「公司信息缺失」。job_detail 在场时冻结组织名优先。
  it('顶栏公司名：job_detail 组织名优先，缺席时回退外层 job.organization，双缺才给缺失槽', () => {
    const 回退 = 从连续到详情顶栏(连续详情({ phase: 'accepted', 组织: BFF公司摘要样本 }));
    expect(回退.标题).toBe('AI 产品实习生 · 云衢科技');
    const 优先 = 从连续到详情顶栏(连续详情({
      phase: 'accepted',
      组织: { ...BFF公司摘要样本, display_name: '外层在谈企业' },
      jobDetail: BFF安全职位资料样本,
    }));
    expect(优先.标题).toBe('AI 产品实习生 · 云衢科技');
    const 双缺 = 从连续到详情顶栏(连续详情({
      phase: 'accepted',
      组织: { ...BFF公司摘要样本, display_name: null },
    }));
    expect(双缺.标题).toBe('AI 产品实习生 · 公司信息缺失');
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

describe('映射连续列表项 · 组织摘要与匹配分落位（Spec §5.2）', () => {
  it('固定 null 替换为 job.organization 与 match_score：公司三件套 + 字标 + 真实 Logo', () => {
    const 卡 = 映射连续列表项(连续卡({
      recordId: 'dlg_org', phase: 'evaluating',
      组织: BFF公司摘要样本, 匹配分: 73,
    }));
    expect(卡.公司).toBe('云衢科技');
    expect(卡.公司简介).toBe('C 轮 · 500-1000 人 · 金融科技');
    expect(卡.公司图片URL).toBe(BFF公司摘要样本.logo!.url);
    expect(卡.公司字标).toEqual({ 首字: '云', 公司名: '云衢科技' });
    expect(卡.匹配分).toBe(73);
  });

  it('真实 0 分照常带出，无溯源 null 不造 0', () => {
    expect(映射连续列表项(连续卡({ recordId: 'dlg_z', phase: 'accepted', 匹配分: 0 })).匹配分).toBe(0);
    expect(映射连续列表项(连续卡({ recordId: 'dlg_n', phase: 'accepted' })).匹配分).toBeNull();
  });

  it('organization 缺席或缺名：公司/简介/字标/图位全未知，不拿 claim 造已知公司', () => {
    const 无组织 = 映射连续列表项(连续卡({ recordId: 'dlg_x', phase: 'accepted' }));
    expect(无组织.公司).toBeNull();
    expect(无组织.公司简介).toBeNull();
    expect(无组织.公司图片URL).toBeNull();
    expect(无组织.公司字标).toBeNull();
    const 缺名 = 映射连续列表项(连续卡({
      recordId: 'dlg_y', phase: 'accepted',
      组织: { ...BFF公司摘要样本, display_name: null },
    }));
    expect(缺名.公司).toBeNull();
    expect(缺名.公司字标).toBeNull();
    // 图位语义跟组织对象走：名称缺失但 Logo 在场仍是已知媒体
    expect(缺名.公司图片URL).toBe(BFF公司摘要样本.logo!.url);
    const 无Logo = 映射连续列表项(连续卡({
      recordId: 'dlg_l', phase: 'accepted',
      组织: { ...BFF公司摘要样本, logo: null },
    }));
    expect(无Logo.公司).toBe('云衢科技');
    expect(无Logo.公司图片URL).toBeNull();
    expect(无Logo.公司字标).toBeNull(); // 无真实媒体不出字标，保留中性空位
  });

  it('标签行沿 Mock 岗位属性顺序：地点 → N 薪 → 办公方式 → 技能；未知成员不补默认', () => {
    const 完整 = 映射连续列表项(连续卡({
      recordId: 'dlg_t1', phase: 'accepted',
      城市: '徐汇区漕河泾', 办公方式: 'hybrid', 薪资月数: 15, 技能: ['Go', '高并发'],
    }));
    expect(完整.标签们).toEqual(['徐汇区漕河泾', '15 薪', '混合', 'Go', '高并发']);
    // 未知成员不补默认：无薪资月数/办公方式/技能时只留地点
    const 只有地点 = 映射连续列表项(连续卡({ recordId: 'dlg_t2', phase: 'accepted' }));
    expect(只有地点.标签们).toEqual(['上海']);
    const 全缺 = 映射连续列表项(连续卡({
      recordId: 'dlg_t3', phase: 'accepted', 城市: '  ', 技能: [],
    }));
    expect(全缺.标签们).toEqual([]);
    // 技能保留源顺序与重复；空字符串技能按缺失段丢弃
    const 技能 = 映射连续列表项(连续卡({
      recordId: 'dlg_t4', phase: 'accepted', 技能: ['Python', '', 'Python'],
    }));
    expect(技能.标签们).toEqual(['上海', 'Python', 'Python']);
    // 地点保持服务端原文：办公地点语义不推断成行政城市
    const 原文 = 映射连续列表项(连续卡({
      recordId: 'dlg_t5', phase: 'accepted', 城市: '张江科学城 · 2F',
    }));
    expect(原文.标签们).toEqual(['张江科学城 · 2F']);
  });

  it('组织短行经现有码表拼装：开放码不展示，只留已知段；组织对象缺失给 null', () => {
    const 部分 = 映射连续列表项(连续卡({
      recordId: 'dlg_s1', phase: 'accepted',
      组织: { ...BFF公司摘要样本, funding_stage: 'pre_a', company_size: null },
    }));
    expect(部分.公司简介).toBe('金融科技');
    const 无组织 = 映射连续列表项(连续卡({ recordId: 'dlg_s2', phase: 'accepted' }));
    expect(无组织.公司简介).toBeNull();
  });
});
