// 历史代谈展示映射：NegotiationCard / P5列表项 → 共享历史卡信息的纯函数投影反例（Task 2）。
// 权威规则 = 批准 Spec §4：结果色调按明确事实（completed 成功 / ended 终局字典 / 未知不着成功）、
// 原因位置恒在（结束原因无源给「结束原因暂未提供」、completed 给「双方已确认意向」）、
// 阶段前缀 ended=止步于 / completed=完成于 / 尚无 Case=初评阶段、
// 时间三级标签 结束于/归档于/更新于（不以更新时间冒充结束时间）、
// 招聘历史卡不取 candidateIdentity、画像位置恒保留为「画像信息暂未提供」。
import { describe, expect, it, vi } from 'vitest';
import { 从候选历史到卡, 从招聘历史到卡 } from './历史代谈展示映射';
import type { NegotiationCard } from './招聘数据源/连续代谈';
import type { P5列表项, P5状态视图 } from './招聘数据源/MatchCase';
import type { BFF候选身份 } from './BFF契约';

const 意向ID = 'int_0123456789abcdef0123456789abcdef';
const 职位ID = 'job_0123456789abcdef0123456789abcdef';

interface 连续行选项 {
  recordId: string;
  phase: NegotiationCard['phase'];
  caseState?: P5状态视图 | null;
  failure?: NegotiationCard['failure'];
  refusalCode?: NegotiationCard['refusal_code'];
  组织名?: string | null;
  logoURL?: string | null;
  finalizedAt?: string | null;
  archivedAt?: string | null;
  updatedAt?: string;
}

function 连续行(选项: 连续行选项): NegotiationCard {
  const recordKind = 选项.recordId.startsWith('dlg_') ? 'delegation' : 'case';
  return {
    needs_action: false,
    record_id: 选项.recordId,
    record_kind: recordKind,
    intention_id: 意向ID,
    job: {
      job_id: 职位ID,
      title: '平台工程师',
      location: '上海',
      public_salary_range: '25-40K·16薪',
      availability: 'available',
      organization: 选项.组织名 === undefined && 选项.logoURL === undefined ? null : {
        organization_id: null,
        display_name: 选项.组织名 ?? null,
        industry: null,
        company_size: null,
        funding_stage: null,
        logo: 选项.logoURL === undefined || 选项.logoURL === null ? null : {
          media_id: 'med_1', media_type: 'image/png' as const,
          size_bytes: 1, width: 1, height: 1, url: 选项.logoURL,
        },
      },
      required_skills: null,
      recruitment_type: null,
      workplace_mode: null,
      annual_salary_months: null,
    },
    delegation_id: recordKind === 'delegation' ? 'dlg_rcpt_01' : null,
    evaluation_id: null,
    case_id: 选项.phase === 'case_started' ? 'mc_0123456789abcdef0123456789abcdef' : null,
    shelf: 'history',
    phase: 选项.phase,
    case_state: 选项.caseState === undefined ? null : 选项.caseState,
    failure: 选项.failure ?? null,
    refusal_code: 选项.refusalCode ?? null,
    actions: { retry: false, archive: false, open_case: false },
    retry_generation: 0,
    created_at: '2026-08-20T01:00:00Z',
    updated_at: 选项.updatedAt ?? '2026-08-29T02:00:00Z',
    archived_at: 选项.archivedAt ?? null,
    match_score: null,
  };
}

function Case状态(覆盖: Partial<P5状态视图>): P5状态视图 {
  return {
    caseId: 'mc_0123456789abcdef0123456789abcdef',
    lifecycle: 'ended',
    stage: 'anonymous_screening',
    status: 'ended',
    step: 'complete',
    round: 2, roundBudget: 3, needsUser: false,
    outcome: 'user_ended',
    outcomeCode: null,
    createdAt: '2026-08-20T01:00:00Z', updatedAt: '2026-08-29T02:00:00Z',
    finalizedAt: null,
    agentAttention: null,
    ...覆盖,
  };
}

interface 招聘行选项 {
  caseId?: string;
  lifecycle?: 'completed' | 'ended';
  stage?: P5状态视图['stage'];
  status?: P5状态视图['status'];
  outcome?: string | null;
  outcomeCode?: string | null;
  finalizedAt?: string | null;
  别名?: string;
  身份?: BFF候选身份;
}

function 招聘行(选项: 招聘行选项 = {}): P5列表项 {
  const 是完成 = (选项.lifecycle ?? 'ended') === 'completed';
  return {
    role: 'recruiter',
    state: Case状态({
      caseId: 选项.caseId ?? 'mc_0123456789abcdef0123456789abcdef',
      lifecycle: 选项.lifecycle ?? 'ended',
      stage: 选项.stage ?? (是完成 ? 'intent_confirmation' : 'anonymous_screening'),
      status: 选项.status ?? (是完成 ? 'passed' : 'ended'),
      step: 是完成 ? 'handoff_pending' : 'complete',
      outcome: 选项.outcome ?? (是完成 ? null : 'user_ended'),
      outcomeCode: 选项.outcomeCode ?? null,
      finalizedAt: 选项.finalizedAt === undefined ? '2026-08-29T03:00:00Z' : 选项.finalizedAt,
    }),
    needsAction: false,
    candidateAlias: 选项.别名 ?? 'candidate-0123456789ab',
    job: {
      jobId: 职位ID,
      job: { title: '平台工程师', location: '上海', publicSalaryRange: '25-40K·16薪', requiredSkills: ['Go'] },
    },
    matchScore: null,
    candidateIdentity: 选项.身份 ?? { state: 'anonymous', name: null, avatar_url: null, disclosed_at: null },
  };
}

describe('从候选历史到卡 · NegotiationCard → 历史卡（Spec §4）', () => {
  it('completed：结果=已谈成/成功，无额外原因给「双方已确认意向」，阶段前缀「完成于」，时间=结束于', () => {
    const 卡 = 从候选历史到卡(连续行({
      recordId: 'mc_c1',
      phase: 'case_started',
      caseState: Case状态({
        lifecycle: 'completed', stage: 'intent_confirmation', status: 'passed',
        outcome: null, outcomeCode: null, finalizedAt: '2026-08-28T10:00:00Z',
      }),
      archivedAt: '2026-08-28T11:00:00Z',
    }), () => undefined);
    expect(卡.结果).toEqual({ 文案: '已谈成', 色调: '成功' });
    expect(卡.原因).toBe('双方已确认意向');
    expect(卡.阶段说明).toBe('完成于 意向确认');
    expect(卡.时间说明?.startsWith('结束于 2026-')).toBe(true); // finalizedAt 优先，不冒充
    expect(卡.键).toBe('mc_c1');
  });

  it('ended semantic_not_fit：结果=不匹配/提醒，字典原因，「止步于」前缀；协议词不透出', () => {
    const 卡 = 从候选历史到卡(连续行({
      recordId: 'mc_e1',
      phase: 'case_started',
      caseState: Case状态({ outcome: 'semantic_not_fit', outcomeCode: null, finalizedAt: '2026-08-27T09:00:00Z' }),
    }), () => undefined);
    expect(卡.结果).toEqual({ 文案: '不匹配', 色调: '提醒' });
    expect(卡.原因).toBe('本阶段评估不匹配，代谈已结束');
    expect(卡.阶段说明).toBe('止步于 匿名初筛');
    expect(卡.时间说明?.startsWith('结束于 2026-')).toBe(true);
    expect(JSON.stringify(卡)).not.toContain('semantic_not_fit');
  });

  it('未知 outcome/code：安全兜底「已结束/结束原因暂未提供」中性色，原词绝不带出', () => {
    const 卡 = 从候选历史到卡(连续行({
      recordId: 'mc_u1',
      phase: 'case_started',
      caseState: Case状态({ outcome: 'mystery_outcome', outcomeCode: 'mystery_code' }),
    }), () => undefined);
    expect(卡.结果).toEqual({ 文案: '已结束', 色调: '中性' });
    expect(卡.原因).toBe('结束原因暂未提供');
    const 全文 = JSON.stringify(卡);
    expect(全文).not.toContain('mystery_outcome');
    expect(全文).not.toContain('mystery_code');
  });

  it('无 Case 的已归档初评失败：阶段说明=「初评阶段」，原因=现有安全失败说明；failure 无源给缺失占位', () => {
    const 有码 = 从候选历史到卡(连续行({
      recordId: 'dlg_f1',
      phase: 'evaluation_failed',
      failure: { code: 'delegation_failed', retryable: true },
    }), () => undefined);
    expect(有码.阶段说明).toBe('初评阶段');
    expect(有码.原因).toBe('本次委托未完成');
    expect(有码.结果.色调).toBe('提醒');
    expect(有码.时间说明?.startsWith('更新于 ')).toBe(true); // 无 finalized/archived → 更新于

    const 无源 = 从候选历史到卡(连续行({ recordId: 'dlg_f2', phase: 'evaluation_failed' }), () => undefined);
    expect(无源.原因).toBe('结束原因暂未提供');
  });

  it('时间三级标签：finalizedAt→结束于；仅 archived_at→归档于；仅 updated_at→更新于', () => {
    const 只归档 = 从候选历史到卡(连续行({
      recordId: 'dlg_a1', phase: 'refused', refusalCode: 'delegation_cooldown',
      archivedAt: '2026-08-25T08:00:00Z',
    }), () => undefined);
    expect(只归档.时间说明?.startsWith('归档于 2026-')).toBe(true);

    const 只更新 = 从候选历史到卡(连续行({
      recordId: 'dlg_a2', phase: 'refused', refusalCode: 'delegation_cooldown', archivedAt: null,
    }), () => undefined);
    expect(只更新.时间说明?.startsWith('更新于 2026-')).toBe(true);
  });

  it('标题=公司、职位=冻结职位名；公司/Logo 走同响应组织摘要，缺失给既有占位', () => {
    const 有组织 = 从候选历史到卡(连续行({
      recordId: 'mc_c2', phase: 'case_started',
      caseState: Case状态({ lifecycle: 'completed', stage: 'intent_confirmation', status: 'passed', outcome: null }),
      组织名: '快手', logoURL: 'https://cdn.example.test/ks.png',
    }), () => undefined);
    expect(有组织.标题).toBe('快手');
    expect(有组织.职位).toBe('平台工程师');
    expect(有组织.图片URL).toBe('https://cdn.example.test/ks.png');
    expect(有组织.画像).toBeNull(); // 求职历史卡无画像行
    expect(有组织.字标).toBeNull(); // Backend 不造演示字标

    const 无组织 = 从候选历史到卡(连续行({ recordId: 'mc_c3', phase: 'case_started' }), () => undefined);
    expect(无组织.标题).toBe('公司信息缺失');
    expect(无组织.图片URL).toBeNull();
  });

  it('打开回调原样接通：调用卡信息的 打开 即触发传入回调', () => {
    const 打开 = vi.fn();
    从候选历史到卡(连续行({ recordId: 'mc_c4', phase: 'case_started' }), 打开).打开();
    expect(打开).toHaveBeenCalledTimes(1);
  });
});

describe('从招聘历史到卡 · P5列表项 → 历史卡（Spec §4）', () => {
  it('completed：结果=已谈成/成功，「完成于」，无额外原因', () => {
    const 卡 = 从招聘历史到卡(招聘行({ lifecycle: 'completed' }), () => undefined);
    expect(卡.结果).toEqual({ 文案: '已谈成', 色调: '成功' });
    expect(卡.原因).toBe('双方已确认意向');
    expect(卡.阶段说明).toBe('完成于 意向确认');
    expect(卡.键).toBe('mc_0123456789abcdef0123456789abcdef');
  });

  it('ended：结果与原因走终局字典，「止步于」；合法别名作标题但不猜头像字', () => {
    const 卡 = 从招聘历史到卡(招聘行({ outcome: 'user_ended' }), () => undefined);
    expect(卡.标题).toBe('candidate-0123456789ab');
    expect(卡.结果).toEqual({ 文案: '已结束', 色调: '中性' });
    expect(卡.原因).toBe('本次代谈已结束');
    expect(卡.阶段说明).toBe('止步于 匿名初筛');
    expect(卡.字标).toBeNull();
  });

  it('画像位置恒保留：「画像信息暂未提供」（历史行无 candidate_summary，不补读）', () => {
    const 卡 = 从招聘历史到卡(招聘行(), () => undefined);
    expect(卡.画像).toBe('画像信息暂未提供');
  });

  it('不取 candidateIdentity：带姓名/头像的在场身份也不进卡（无身份图标、无图片）', () => {
    const 卡 = 从招聘历史到卡(招聘行({
      身份: { state: 'anonymous', name: '张三', avatar_url: 'https://cdn.example.test/zs.png', disclosed_at: null },
    }), () => undefined);
    expect(卡.图片URL).toBeNull();
    expect(卡.字标).toBeNull();
    const 全文 = JSON.stringify(卡);
    expect(全文).not.toContain('张三');
    expect(全文).not.toContain('zs.png');
  });

  it('时间说明：finalizedAt 有值=结束于；无 finalizedAt 不拿更新时间冒充', () => {
    const 有终局 = 从招聘历史到卡(招聘行({ finalizedAt: '2026-08-28T10:00:00Z' }), () => undefined);
    expect(有终局.时间说明?.startsWith('结束于 2026-')).toBe(true);

    const 无终局 = 从招聘历史到卡(招聘行({ finalizedAt: null }), () => undefined);
    expect(无终局.时间说明?.startsWith('更新于 2026-')).toBe(true);
  });

  it('职位与打开回调：冻结职位名直出，回调原样接通', () => {
    const 打开 = vi.fn();
    const 卡 = 从招聘历史到卡(招聘行({ caseId: 'mc_x1' }), 打开);
    expect(卡.职位).toBe('平台工程师');
    卡.打开();
    expect(打开).toHaveBeenCalledTimes(1);
  });
});
