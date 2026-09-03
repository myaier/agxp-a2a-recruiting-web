// MatchCase展示映射 表测：17 行已准入状态矩阵逐行逐 step 钉住 阶段标题/状态文案/步骤说明/
// 终局/可出动作卡，运行时未知词与矩阵外四元组一律 fail closed 成契约错误视图 + 空动作表；
// respond_fact 在场时经 Plan 1 取当前补充问题 接入补充问题视图（唯一匹配才放行提交控件）。
// 文案期望全部用本文件字面量钉死，Tasks 3–7 与 E2E 按此引用。

import { describe, expect, it } from 'vitest';
import { 映射P5列表项, 映射P5详情, P5展示矩阵行数, P5展示状态矩阵 } from './MatchCase展示映射';
import type { P5详情视图, P5列表视图, P5阶段, P5状态 } from './MatchCase展示映射';
import type {
  P5动作,
  P5详情,
  P5列表项,
  P5阶段区,
  P5状态视图,
  P5时间线项,
  P5步骤,
  P5角色,
} from './招聘数据源/MatchCase';

// ── 文案期望（字面量钉死，映射器漂移即红）──

const 期望阶段标题 = {
  anonymous_screening: '匿名初筛',
  resume_submission: '简历提交',
  needs_coordination: '差异协同',
  intent_confirmation: '意向确认',
} as const satisfies Record<P5阶段, string>;

const 期望状态文案 = {
  running: '进行中',
  needs_user: '待处理',
  passed: '已通过',
  attention_required: '需注意',
  ended: '已结束',
  waiting: '等待中',
} as const satisfies Record<P5状态, string>;

const 期望步骤说明 = {
  policy_check: '系统正在核对投递政策',
  candidate_evaluation: '候选方 AI 正在评估岗位',
  candidate_question: '等待候选人补充事实',
  recruiter_answer: '等待招聘方 AI 回答补充问题',
  candidate_reevaluation: '系统正在复评候选信息',
  human_decision: '等待人工决定是否继续',
  complete: '本阶段已完成',
  awaiting_candidate_resume_invitation: '等待候选人回应简历邀请',
  awaiting_resume_parse: '正在解析简历',
  screening_resume: '招聘方 AI 正在初筛已提交简历',
  awaiting_recruiter_decision: '等待招聘方决定',
  coordinating: '双方 AI 正在核对剩余差异',
  awaiting_candidate_decision: '等待候选人确认协同事项',
  awaiting_confirmations: '等待双方确认意向',
  awaiting_candidate_confirmation: '等待候选人确认意向',
  awaiting_recruiter_confirmation: '等待招聘方确认意向',
  handoff_pending: '双方已确认，正在创建会话',
} as const satisfies Record<P5步骤, string>;

const 期望动作卡文案 = {
  respond_fact: { 标题: '补充事实', 说明: '回答当前阶段待补充的问题' },
  end_screening: { 标题: '结束初筛', 说明: '结束本次匿名初筛' },
  accept_resume_invitation: { 标题: '接受简历邀请', 说明: '同意披露简历并进入简历评估' },
  decline_resume_invitation: { 标题: '婉拒简历邀请', 说明: '拒绝本次简历披露邀请' },
  retry_resume_readiness: { 标题: '重试简历校验', 说明: '简历校验未通过时重新尝试' },
  replace_resume: { 标题: '更换简历', 说明: '改用另一份简历重新提交' },
  decide_resume_screening: { 标题: '出具简历初筛结论', 说明: '决定简历是否通过初筛' },
  decide_coordination: { 标题: '回应协同事项', 说明: '对当前协同事项作出接受或拒绝' },
  confirm_intent: { 标题: '确认意向', 说明: '确认匹配并进入会话创建' },
  decline_intent: { 标题: '婉拒意向', 说明: '拒绝本次匹配' },
} as const satisfies Record<P5动作, { 标题: string; 说明: string }>;

const 动作全表 = Object.keys(期望动作卡文案) as P5动作[];

/**
 * 每行可出的动作卡（按钮可见性 = 行侧白名单 ∩ available_actions）；顺序即 wire 枚举顺序。
 * 每格 = 已准入投影器 lifecycleViewerActions 在该行一切事实组合下的角色无关并集
 * （respond_fact/end_screening 只在 S0 needs_user：预算内双卡、预算尽仅 end_screening，
 * 并集双卡；邀请二卡只在 S0 passed；S1 waiting 仅 retry_resume_readiness、needs_user 三卡
 * 并集、attention_required 落空；S2 三行皆 decide_coordination；S3 意向二卡；终态恒空）。
 */
const 期望可出动作: Record<string, readonly P5动作[]> = {
  'open|anonymous_screening|running': [],
  'open|anonymous_screening|waiting': [],
  'open|anonymous_screening|needs_user': ['respond_fact', 'end_screening'],
  'open|anonymous_screening|passed': ['accept_resume_invitation', 'decline_resume_invitation'],
  'open|anonymous_screening|attention_required': [],
  'open|resume_submission|waiting': ['retry_resume_readiness'],
  'open|resume_submission|needs_user':
    ['retry_resume_readiness', 'replace_resume', 'decide_resume_screening'],
  'open|resume_submission|attention_required': [],
  'open|needs_coordination|waiting': ['decide_coordination'],
  'open|needs_coordination|needs_user': ['decide_coordination'],
  'open|needs_coordination|attention_required': ['decide_coordination'],
  'open|intent_confirmation|needs_user': ['confirm_intent', 'decline_intent'],
  'ended|anonymous_screening|ended': [],
  'ended|resume_submission|ended': [],
  'ended|needs_coordination|ended': [],
  'ended|intent_confirmation|ended': [],
  'completed|intent_confirmation|passed': [],
};

const 期望错误提示 = '该 Case 数据不符合契约，已停用全部操作';
const 期望移交文案 = '双方已确认，正在创建会话';

// ── 样本构造（直接构造 Task 1 归一化 DTO；非法样本用 cast 越过类型）──

const 岗位样本 = {
  jobId: 'job_0123456789abcdef0123456789abcdef',
  job: {
    title: 'AI 产品实习生',
    location: '上海',
    publicSalaryRange: '300-500 元/天',
    requiredSkills: ['Python', 'SQL'],
  },
};

function 造状态(覆盖: Partial<P5状态视图> = {}): P5状态视图 {
  return {
    caseId: 'mc_1',
    lifecycle: 'open',
    stage: 'anonymous_screening',
    status: 'running',
    step: 'policy_check',
    round: 1,
    roundBudget: 3,
    needsUser: false,
    outcome: null,
    outcomeCode: null,
    createdAt: '2026-08-29T01:00:00Z',
    updatedAt: '2026-08-29T02:00:00Z',
    finalizedAt: null,
    agentAttention: null,
    ...覆盖,
  };
}

/** 矩阵行 → 合法状态（终局列按生命周期补齐，needs_user 镜像 status）。 */
function 造行状态(lifecycle: 'open' | 'ended' | 'completed', stage: P5阶段, status: P5状态, step: P5步骤): P5状态视图 {
  const 终局 = lifecycle === 'ended'
    ? { outcome: 'user_ended', outcomeCode: 'user_ended', finalizedAt: '2026-08-29T03:00:00Z' }
    : lifecycle === 'completed'
      ? { outcome: null, outcomeCode: null, finalizedAt: '2026-08-29T03:00:00Z' }
      : {};
  return 造状态({ lifecycle, stage, status, step, needsUser: status === 'needs_user', ...终局 });
}

function 造时间线项(覆盖: Partial<P5时间线项> = {}): P5时间线项 {
  return {
    eventId: 'evt_1',
    stage: 'anonymous_screening',
    kind: 'supplementary_question',
    role: 'candidate',
    ref: 'prompt_1',
    text: '每周可以到岗几天？',
    occurredAt: '2026-08-29T01:10:00Z',
    ...覆盖,
  };
}

type 各阶段时间线 = Record<P5阶段, P5时间线项[]>;

function 默认时间线(viewer: P5角色): 各阶段时间线 {
  return {
    anonymous_screening: [造时间线项({ role: viewer })],
    resume_submission: [],
    needs_coordination: [],
    intent_confirmation: [],
  };
}

function 造阶段区组(时间线: 各阶段时间线): P5阶段区[] {
  const 阶段顺序 = ['anonymous_screening', 'resume_submission', 'needs_coordination', 'intent_confirmation'] as const;
  return 阶段顺序.map((stage, 下标) => ({
    stage,
    state: (下标 === 0 ? 'active' : 'pending') as 'active' | 'pending',
    occurredAt: 下标 === 0 ? '2026-08-29T01:10:00Z' : null,
    summary: `${stage} 摘要`,
    checklist: [{ label: '清单条目', done: true }],
    transcript: 时间线[stage],
    instructionReceipts: [],
    attachment: null,
  }));
}

function 造详情(选项: {
  state?: P5状态视图;
  availableActions?: P5动作[];
  时间线?: 各阶段时间线;
  阶段区组?: P5阶段区[];
  role?: P5角色;
  intentionId?: string;
  candidateAlias?: string;
  terminalSummary?: P5详情['terminalSummary'];
  /** P7 Task 6：completed + complete 的已发布会话坐标。 */
  conversationRef?: string | null;
} = {}): P5详情 {
  const role = 选项.role ?? 'candidate';
  const state = 选项.state ?? 造状态();
  const availableActions = 选项.availableActions ?? [];
  const 主体 = {
    state,
    needsAction: state.lifecycle === 'open' && availableActions.length > 0,
    availableActions,
    stages: 选项.阶段区组 ?? 造阶段区组(选项.时间线 ?? 默认时间线(role)),
    currentCoordination: null,
    intentConfirmations: { candidate: '', recruiter: '' } as { candidate: ''; recruiter: '' },
    terminalSummary: 选项.terminalSummary ?? null,
    conversationRef: 选项.conversationRef ?? null,
  };
  if (role === 'candidate') {
    return {
      ...主体,
      role,
      context: {
        intentionId: 选项.intentionId ?? 'int_0123456789abcdef0123456789abcdef',
        job: 岗位样本,
      },
    };
  }
  return {
    ...主体,
    role,
    context: { candidateAlias: 选项.candidateAlias ?? 'candidate-0123456789ab', job: 岗位样本 },
  };
}

function 造列表项(选项: {
  state?: P5状态视图;
  needsAction?: boolean;
  role?: P5角色;
} = {}): P5列表项 {
  const role = 选项.role ?? 'candidate';
  const 主体 = { state: 选项.state ?? 造状态(), needsAction: 选项.needsAction ?? false, job: 岗位样本 };
  if (role === 'candidate') {
    return { ...主体, role, intentionId: 'int_0123456789abcdef0123456789abcdef' };
  }
  return { ...主体, role, candidateAlias: 'candidate-0123456789ab' };
}

type 正常视图 = { kind: '正常' };
type 契约错误视图 = { kind: '契约错误'; 错误提示: string };

function 断言正常<T extends 正常视图 | 契约错误视图>(视图: T): Exclude<T, 契约错误视图> {
  if (视图.kind !== '正常') throw new Error(`期望正常视图，得到 ${视图.kind}`);
  return 视图 as Exclude<T, 契约错误视图>;
}

function 断言契约错误(视图: P5详情视图 | P5列表视图): string {
  if (视图.kind !== '契约错误') throw new Error('期望契约错误视图');
  return 视图.错误提示;
}

// ── 矩阵数据钉子 ──

describe('P5展示状态矩阵数据', () => {
  it('恰好 17 行，三元组不重复，编译期行数钉子一致', () => {
    expect(P5展示状态矩阵).toHaveLength(17);
    expect(P5展示矩阵行数).toBe(17);
    const 三元组 = P5展示状态矩阵.map((行) => `${行.lifecycle}|${行.stage}|${行.status}`);
    expect(new Set(三元组).size).toBe(17);
  });

  it('每行 steps 覆盖期望行；可出动作与期望表一致、 ⊆ 十个闭词且按枚举序', () => {
    for (const 行 of P5展示状态矩阵) {
      const 键 = `${行.lifecycle}|${行.stage}|${行.status}`;
      expect(行.steps, 键).toHaveLength(new Set(行.steps).size);
      expect(行.可出动作, 键).toEqual(期望可出动作[键]);
      const 有序 = 动作全表.filter((动作) => 行.可出动作.includes(动作));
      expect(行.可出动作, 键).toEqual(有序);
    }
  });

  it('17 个 step 闭词每个都落在至少一行；文案表长度四向钉死', () => {
    const 步骤并集 = new Set(P5展示状态矩阵.flatMap((行) => [...行.steps]));
    expect([...步骤并集].sort()).toEqual(Object.keys(期望步骤说明).sort());
    expect(Object.keys(期望阶段标题)).toHaveLength(4);
    expect(Object.keys(期望状态文案)).toHaveLength(6);
    expect(Object.keys(期望步骤说明)).toHaveLength(17);
    expect(Object.keys(期望动作卡文案)).toHaveLength(10);
  });
});

// ── 详情：17 行逐行逐 step 表测 ──

const 行用例 = P5展示状态矩阵.flatMap((行) =>
  行.steps.map((step) => ({ ...行, step })),
);

describe('映射P5详情：17 行状态矩阵表测', () => {
  it.each(行用例)('$lifecycle / $stage / $status / $step', (行) => {
    // open 行把十个动作全部提供：只有行侧白名单内的卡可渲染（交集语义）；
    // 终态行按契约只提供空动作表。
    const 提供 = 行.lifecycle === 'open' ? 动作全表 : [];
    const 视图 = 断言正常(映射P5详情(造详情({
      state: 造行状态(行.lifecycle, 行.stage, 行.status, 行.step),
      availableActions: 提供,
      // P7 Task 6：completed + complete 行需要已发布会话坐标才能产出 ready 视图
      conversationRef: 行.lifecycle === 'completed' && 行.step === 'complete' ? '3003' : null,
    })));
    const 键 = `${行.lifecycle}|${行.stage}|${行.status}`;
    expect(视图.caseId).toBe('mc_1');
    expect(视图.role).toBe('candidate');
    expect(视图.intentionId).toBe('int_0123456789abcdef0123456789abcdef');
    expect(视图.阶段标题).toBe(期望阶段标题[行.stage]);
    expect(视图.状态文案).toBe(期望状态文案[行.status]);
    expect(视图.步骤说明).toBe(期望步骤说明[行.step]);
    expect(视图.终局).toBe(行.lifecycle !== 'open');
    expect(视图.actions.map((卡) => 卡.action)).toEqual(期望可出动作[键]);
    for (const 卡 of 视图.actions) {
      expect(卡).toEqual({ action: 卡.action, ...期望动作卡文案[卡.action] });
    }
    expect(视图.handoff).toEqual(行.lifecycle === 'completed'
      ? (行.step === 'complete'
        ? { state: 'ready', copy: '真人会话已建立', conversationId: '3003' }
        : { state: 'pending', copy: 期望移交文案 })
      : null);
    expect(视图.补充问题).toEqual(期望可出动作[键].includes('respond_fact')
      ? { promptId: 'prompt_1', text: '每周可以到岗几天？' }
      : null);
  });

  it('completed handoff is preparation-only', () => {
    const 视图 = 断言正常(映射P5详情(造详情({
      state: 造行状态('completed', 'intent_confirmation', 'passed', 'handoff_pending'),
      availableActions: [],
    })));
    expect(视图.handoff).toEqual({
      state: 'pending',
      copy: '双方已确认，正在创建会话',
    });
    expect(视图.actions).toEqual([]);
    // pending 不是详情终局：轮询继续（详情终局 = ended 或 已发布会话）
    expect(视图.详情终局).toBe(false);
  });

  // P7 Task 6：completed 行两步移交 —— pending 只读等会话；ready 启用「开始私聊」并带权威会话坐标
  it('completed 两步移交：pending 禁用待会话、ready 已建立且详情终局=true；ended 保持终局', () => {
    const pending视图 = 断言正常(映射P5详情(造详情({
      state: 造行状态('completed', 'intent_confirmation', 'passed', 'handoff_pending'),
    })));
    expect(pending视图.handoff).toEqual({ state: 'pending', copy: '双方已确认，正在创建会话' });
    expect(pending视图.详情终局).toBe(false);

    const ready视图 = 断言正常(映射P5详情(造详情({
      state: 造行状态('completed', 'intent_confirmation', 'passed', 'complete'),
      conversationRef: '3003',
    })));
    expect(ready视图.handoff).toEqual({ state: 'ready', copy: '真人会话已建立', conversationId: '3003' });
    expect(ready视图.详情终局).toBe(true);

    const ended视图 = 断言正常(映射P5详情(造详情({
      state: 造行状态('ended', 'intent_confirmation', 'ended', 'complete'),
      terminalSummary: { stage: 'intent_confirmation', outcome: 'user_ended', reasonSummary: 'user_ended', finalizedAt: '2026-08-29T03:00:00Z' },
    })));
    expect(ended视图.handoff).toBe(null);
    expect(ended视图.终局).toBe(true);
    expect(ended视图.详情终局).toBe(true);

    // completed + complete 但无 conversation_ref（decode 已挡，映射再守一层）：契约错误
    const 漂移视图 = 映射P5详情(造详情({
      state: { ...造行状态('completed', 'intent_confirmation', 'passed', 'handoff_pending'), step: 'complete' },
    }));
    expect(漂移视图.kind).toBe('契约错误');
  });

  it('招聘端同一行同样映射，别名原样带出且不带意向 ID', () => {
    const 视图 = 断言正常(映射P5详情(造详情({
      role: 'recruiter',
      state: 造行状态('open', 'anonymous_screening', 'needs_user', 'human_decision'),
      availableActions: ['respond_fact', 'end_screening'],
    })));
    expect(视图.candidateAlias).toBe('candidate-0123456789ab');
    expect(视图.intentionId).toBe(null);
    expect(视图.actions.map((卡) => 卡.action)).toEqual(['respond_fact', 'end_screening']);
    expect(视图.补充问题).toEqual({ promptId: 'prompt_1', text: '每周可以到岗几天？' });
  });

  // Task 5：S1 三态语义钉死 —— 解析中/AI 初筛中/人工初筛决定三条文案互不混用，
  // 且 waiting 行的初筛决策卡交集落空（动作只在 needs_user 人工决定行出现）。
  it('S1 解析中 / AI 初筛中 / 人工决定：步骤说明逐词钉死且动作按行侧白名单交集', () => {
    const 解析中 = 断言正常(映射P5详情(造详情({
      state: 造行状态('open', 'resume_submission', 'waiting', 'awaiting_resume_parse'),
      availableActions: [],
    })));
    const AI初筛中 = 断言正常(映射P5详情(造详情({
      state: 造行状态('open', 'resume_submission', 'waiting', 'screening_resume'),
      availableActions: ['decide_resume_screening'],
    })));
    const 等人工决定 = 断言正常(映射P5详情(造详情({
      state: 造行状态(
        'open', 'resume_submission', 'needs_user', 'awaiting_recruiter_decision',
      ),
      availableActions: ['decide_resume_screening'],
    })));

    expect(解析中.步骤说明).toBe('正在解析简历');
    expect(AI初筛中.步骤说明).toBe('招聘方 AI 正在初筛已提交简历');
    expect(AI初筛中.actions).toEqual([]);
    expect(等人工决定.步骤说明).toBe('等待招聘方决定');
    expect(等人工决定.actions.map((action) => action.action))
      .toEqual(['decide_resume_screening']);
  });
});

describe('映射P5详情：动作卡', () => {
  const 动作可行行: Record<P5动作, Parameters<typeof 造行状态>> = {
    respond_fact: ['open', 'anonymous_screening', 'needs_user', 'human_decision'],
    end_screening: ['open', 'anonymous_screening', 'needs_user', 'human_decision'],
    accept_resume_invitation: ['open', 'anonymous_screening', 'passed', 'awaiting_candidate_resume_invitation'],
    decline_resume_invitation: ['open', 'anonymous_screening', 'passed', 'awaiting_candidate_resume_invitation'],
    retry_resume_readiness: ['open', 'resume_submission', 'waiting', 'awaiting_resume_parse'],
    replace_resume: ['open', 'resume_submission', 'needs_user', 'awaiting_resume_parse'],
    decide_resume_screening: ['open', 'resume_submission', 'needs_user', 'awaiting_recruiter_decision'],
    decide_coordination: ['open', 'needs_coordination', 'needs_user', 'coordinating'],
    confirm_intent: ['open', 'intent_confirmation', 'needs_user', 'awaiting_confirmations'],
    decline_intent: ['open', 'intent_confirmation', 'needs_user', 'awaiting_confirmations'],
  };

  it('十个动作闭词全部有卡：标题与说明文案齐全', () => {
    for (const 动作 of 动作全表) {
      const 视图 = 断言正常(映射P5详情(造详情({
        state: 造行状态(...动作可行行[动作]),
        availableActions: [动作],
      })));
      expect(视图.actions, 动作).toEqual([{ action: 动作, ...期望动作卡文案[动作] }]);
    }
  });

  it('动作卡按 wire 枚举顺序渲染，不按 available_actions 顺序', () => {
    const 视图 = 断言正常(映射P5详情(造详情({
      state: 造行状态('open', 'anonymous_screening', 'needs_user', 'human_decision'),
      availableActions: ['end_screening', 'respond_fact'],
    })));
    expect(视图.actions.map((卡) => 卡.action)).toEqual(['respond_fact', 'end_screening']);
  });

  it('时间线文本、对方决定与 needs_user 永不 infer 出动作：未提供的动作不出卡', () => {
    const 时间线: 各阶段时间线 = {
      anonymous_screening: [
        造时间线项({ kind: 'candidate_ended', role: 'recruiter', text: '对方已同意推进' }),
      ],
      resume_submission: [],
      needs_coordination: [],
      intent_confirmation: [],
    };
    const 视图 = 断言正常(映射P5详情(造详情({
      state: { ...造行状态('open', 'needs_coordination', 'waiting', 'awaiting_recruiter_decision'), needsUser: true },
      availableActions: [],
      时间线,
    })));
    expect(视图.actions).toEqual([]);
    expect(视图.待办).toBe(false);
  });
});

describe('映射P5详情：运行时未知词与矩阵外四元组 fail closed', () => {
  const 非法详情样本: Record<string, () => P5详情> = {
    '未知 lifecycle': () => ({ ...造详情(), state: { ...造状态(), lifecycle: 'paused' } }) as never,
    '未知 stage': () => ({ ...造详情(), state: { ...造状态(), stage: 'offer' } }) as never,
    '未知 status': () => ({ ...造详情(), state: { ...造状态(), status: 'blocked' } }) as never,
    '未知 step（含已退役词）': () => ({ ...造详情(), state: { ...造状态(), step: 'awaiting_recruiter' } }) as never,
    '未知 action': () => 造详情({ availableActions: ['schedule_interview'] as unknown as P5动作[] }),
    'open + handoff_pending': () => 造详情({
      state: 造行状态('open', 'intent_confirmation', 'passed', 'handoff_pending'),
    }) as never,
    'completed + complete': () => 造详情({
      state: { ...造行状态('completed', 'intent_confirmation', 'passed', 'handoff_pending'), step: 'complete' },
    }) as never,
    '合法 step 落错行': () => 造详情({ state: { ...造状态(), step: 'coordinating' } }),
    '终态携带动作': () => 造详情({
      state: 造行状态('ended', 'anonymous_screening', 'ended', 'complete'),
      availableActions: ['respond_fact'],
    }),
    '阶段区数量不足': () => 造详情({ 阶段区组: 造阶段区组(默认时间线('candidate')).slice(0, 3) }),
    '阶段区顺序漂移': () => {
      const 组 = 造阶段区组(默认时间线('candidate'));
      return 造详情({ 阶段区组: [组[1], 组[0], 组[2], 组[3]] });
    },
    '角色与上下文不匹配': () => ({
      ...造详情(),
      role: 'recruiter',
      context: { intentionId: 'int_0123456789abcdef0123456789abcdef', job: 岗位样本 },
    }) as never,
    '上下文 ID 不是字符串': () => ({
      ...造详情(),
      context: { intentionId: undefined, job: 岗位样本 },
    }) as never,
    'case_id 缺席': () => 造详情({ state: { ...造状态(), caseId: '' } }),
  };

  it.each(Object.entries(非法详情样本))('%s → 契约错误视图 + 空动作表', (_名, 样本) => {
    const 视图 = 映射P5详情(样本());
    expect(视图.kind).toBe('契约错误');
    expect(断言契约错误(视图)).toBe(期望错误提示);
    expect(视图.actions).toEqual([]);
    expect(视图.handoff).toBe(null);
    expect(视图.补充问题).toBe(null);
  });
});

describe('映射P5详情：别名与键纪律', () => {
  it('P5 别名是不透明展示文本：原样带出，不解析不截断', () => {
    const 别名 = 'candidate-abcdef012345';
    const 视图 = 断言正常(映射P5详情(造详情({ role: 'recruiter', candidateAlias: 别名 })));
    expect(视图.candidateAlias).toBe(别名);
  });

  it('case_id 独占键与导航：视图键集合钉死，不含 P5.1 占位字段', () => {
    const 视图 = 断言正常(映射P5详情(造详情({ state: { ...造状态(), caseId: 'mc_42' } })));
    expect(视图.caseId).toBe('mc_42');
    expect(Object.keys(视图).sort()).toEqual([
      'actions', 'caseId', 'candidateAlias', '详情终局', 'handoff', 'intentionId', 'kind', 'role',
      '补充问题', '状态文案', '终局', '终局摘要', '职位', '轮次', '阶段标题', '阶段区块', '步骤说明', '更新于', '待办', '注意说明',
    ].sort());
    const 序列化 = JSON.stringify(视图);
    expect(序列化).not.toMatch(/匹配分|评分|推荐理由|亮点|公司简介|公司档案|在线简历|score|highlights|match_reasons/);
  });

  it('职位快照四事实原样投影；终局摘要原样带出不改写', () => {
    const 视图 = 断言正常(映射P5详情(造详情({
      state: 造行状态('ended', 'anonymous_screening', 'ended', 'complete'),
      terminalSummary: {
        stage: 'anonymous_screening',
        outcome: 'user_ended',
        reasonSummary: 'user_ended',
        finalizedAt: '2026-08-29T03:00:00Z',
      },
    })));
    expect(视图.职位).toEqual({
      jobId: 'job_0123456789abcdef0123456789abcdef',
      职位名: 'AI 产品实习生',
      城市: '上海',
      薪资带: '300-500 元/天',
      技能: ['Python', 'SQL'],
    });
    expect(视图.终局摘要).toEqual({ 结束语: 'user_ended', 原因: 'user_ended', 定格于: '2026-08-29T03:00:00Z' });
    expect(视图.轮次).toEqual({ 当前: 1, 预算: 3 });
    expect(视图.更新于).toBe('2026-08-29T02:00:00Z');
  });

  it('四个阶段区块按 S0→S3 投影，时间线/叮嘱/附件原样透传且仅作展示', () => {
    const 叮嘱 = [{
      instructionId: 'aci_0123456789abcdef0123456789abcdef',
      owner: 'candidate' as const,
      stage: 'anonymous_screening' as const,
      expression: '工作日 10:00-19:00 联系',
      occurredAt: '2026-08-29T01:05:00Z',
    }];
    const 附件 = {
      fileId: 'rf_0123456789abcdef0123456789abcdef',
      fileVersionId: 'rfv_0123456789abcdef0123456789abcdef',
      displayName: '简历.pdf',
    };
    const 组 = 造阶段区组(默认时间线('candidate'));
    组[0].instructionReceipts = 叮嘱;
    组[1].attachment = 附件;
    const 视图 = 断言正常(映射P5详情(造详情({ 阶段区组: 组 })));
    expect(视图.阶段区块).toHaveLength(4);
    expect(视图.阶段区块.map((区) => 区.stage)).toEqual([
      'anonymous_screening', 'resume_submission', 'needs_coordination', 'intent_confirmation',
    ]);
    expect(视图.阶段区块.map((区) => 区.标题)).toEqual([
      '匿名初筛', '简历提交', '差异协同', '意向确认',
    ]);
    expect(视图.阶段区块[0].状态文案).toBe('进行中');
    expect(视图.阶段区块[1].状态文案).toBe('未开始');
    expect(视图.阶段区块[0].清单).toEqual([{ 文本: '清单条目', 完成: true }]);
    expect(视图.阶段区块[0].时间线).toBe(组[0].transcript);
    expect(视图.阶段区块[0].叮嘱).toBe(叮嘱);
    expect(视图.阶段区块[1].附件).toBe(附件);
    expect(视图.阶段区块[0].附件).toBe(null);
  });
});

// ── 补充问题接入（Plan 1 取当前补充问题）──

describe('映射P5详情：respond_fact 补充问题接入', () => {
  // respond_fact 只在 S0 needs_user 行出卡（投影器：预算内双卡），补充问题接入挂在该卡上。
  const 提问行 = { state: 造行状态('open', 'anonymous_screening', 'needs_user', 'human_decision') };

  it('respond_fact 在场且当前阶段恰好一个有效问题 → 补充问题视图 + 提交卡', () => {
    const 视图 = 断言正常(映射P5详情(造详情({
      ...提问行,
      availableActions: ['respond_fact'],
    })));
    expect(视图.补充问题).toEqual({ promptId: 'prompt_1', text: '每周可以到岗几天？' });
    expect(视图.actions.map((卡) => 卡.action)).toEqual(['respond_fact']);
  });

  it('当前阶段零个有效问题 → 契约错误视图，无提交控件', () => {
    const 视图 = 映射P5详情(造详情({
      ...提问行,
      availableActions: ['respond_fact'],
      时间线: { anonymous_screening: [], resume_submission: [], needs_coordination: [], intent_confirmation: [] },
    }));
    expect(断言契约错误(视图)).toBe(期望错误提示);
    expect(视图.actions).toEqual([]);
  });

  it('两个有效问题 → 契约错误视图，绝不取第一个', () => {
    const 视图 = 映射P5详情(造详情({
      ...提问行,
      availableActions: ['respond_fact'],
      时间线: {
        anonymous_screening: [
          造时间线项({ ref: 'prompt_1', text: '每周可以到岗几天？' }),
          造时间线项({ eventId: 'evt_2', ref: 'prompt_2', text: '请补充到岗日期。' }),
        ],
        resume_submission: [],
        needs_coordination: [],
        intent_confirmation: [],
      },
    }));
    expect(断言契约错误(视图)).toBe(期望错误提示);
    expect(视图.actions).toEqual([]);
  });

  it.each([
    ['text 空白', 造时间线项({ text: '   ' })],
    ['ref 空白', 造时间线项({ ref: '   ' })],
    ['kind 不是补充问题', 造时间线项({ kind: 'note' })],
    ['归属对方的问题', 造时间线项({ role: 'recruiter' })],
  ])('无效候选（%s）→ 契约错误视图', (_名, 项) => {
    const 视图 = 映射P5详情(造详情({
      ...提问行,
      availableActions: ['respond_fact'],
      时间线: { anonymous_screening: [项], resume_submission: [], needs_coordination: [], intent_confirmation: [] },
    }));
    expect(断言契约错误(视图)).toBe(期望错误提示);
    expect(视图.actions).toEqual([]);
  });

  it('问题只出现在非当前阶段 → 契约错误视图', () => {
    const 视图 = 映射P5详情(造详情({
      state: 造行状态('open', 'anonymous_screening', 'needs_user', 'human_decision'),
      availableActions: ['respond_fact'],
      时间线: {
        anonymous_screening: [],
        resume_submission: [造时间线项({ stage: 'resume_submission', eventId: 'evt_9' })],
        needs_coordination: [],
        intent_confirmation: [],
      },
    }));
    expect(断言契约错误(视图)).toBe(期望错误提示);
  });

  it('respond_fact 不在场时即便有有效问题也不出补充问题与提交控件', () => {
    const 视图 = 断言正常(映射P5详情(造详情({
      ...提问行,
      availableActions: ['end_screening'],
    })));
    expect(视图.补充问题).toBe(null);
    expect(视图.actions.map((卡) => 卡.action)).toEqual(['end_screening']);
  });

  it('respond_fact 被提供但本行不允许 → 交集语义隐藏卡片，不出补充问题，视图保持正常', () => {
    const 视图 = 断言正常(映射P5详情(造详情({
      state: 造行状态('open', 'intent_confirmation', 'needs_user', 'awaiting_confirmations'),
      availableActions: [...动作全表],
    })));
    expect(视图.actions.map((卡) => 卡.action)).toEqual(['confirm_intent', 'decline_intent']);
    expect(视图.补充问题).toBe(null);
  });

  it('招聘端按 recruiter 归属匹配当前阶段问题', () => {
    const 视图 = 断言正常(映射P5详情(造详情({
      role: 'recruiter',
      state: 造行状态('open', 'anonymous_screening', 'needs_user', 'human_decision'),
      availableActions: ['respond_fact'],
      时间线: {
        anonymous_screening: [造时间线项({ role: 'recruiter', ref: 'prompt_9', text: '请补充面试时间偏好。' })],
        resume_submission: [],
        needs_coordination: [],
        intent_confirmation: [],
      },
    })));
    expect(视图.补充问题).toEqual({ promptId: 'prompt_9', text: '请补充面试时间偏好。' });
  });
});

// ── owner-safe agent_attention 投影（Hosted Agent 失败合同）──

describe('映射P5列表项/映射P5详情：attention 投影统一安全说明', () => {
  it.each([
    [{ code: 'agent_unavailable', retryable: false } as const, 'AI 服务暂时不可用，本 Case 尚未继续'],
    [{ code: 'agent_result_invalid', retryable: false } as const, '本次 AI 结果无法安全用于推进 Case'],
    [null, '本阶段需要注意'],
  ])('attention 投影统一安全说明', (agentAttention, copy) => {
    const state = 造状态({
      lifecycle: 'open', stage: 'resume_submission', status: 'attention_required',
      step: 'screening_resume', needsUser: false, agentAttention,
    });
    expect(映射P5列表项(造列表项({ state }))).toMatchObject({
      kind: '正常', 注意说明: copy,
    });
    expect(映射P5详情(造详情({ state }))).toMatchObject({
      kind: '正常', 注意说明: copy,
    });
  });

  it('attention 行仍优先显示 viewer 待办归属', () => {
    const state = 造状态({
      lifecycle: 'open', stage: 'needs_coordination', status: 'attention_required',
      step: 'coordinating', needsUser: false,
      agentAttention: { code: 'agent_unavailable', retryable: false },
    });
    expect(映射P5列表项(造列表项({ state, needsAction: true }))).toMatchObject({
      kind: '正常', 待办: true, 注意说明: 'AI 服务暂时不可用，本 Case 尚未继续',
    });
  });

  it('非 attention 状态注意说明恒 null（是否需注意由 注意说明!==null 唯一推导）', () => {
    const 行 = 造行状态('open', 'anonymous_screening', 'needs_user', 'human_decision');
    // 行侧 status=needs_user 且带 agentAttention 是 decode 已挡的组合：映射层不读该块
    const 带块 = { ...行, agentAttention: { code: 'agent_unavailable', retryable: false } as const };
    expect(映射P5列表项(造列表项({ state: 带块 }))).toMatchObject({ kind: '正常', 注意说明: null });
    expect(映射P5详情(造详情({ state: 带块 }))).toMatchObject({ kind: '正常', 注意说明: null });
  });
});

// ── 列表项 ──

describe('映射P5列表项', () => {
  it('候选端行：case_id、意向 ID、职位快照、阶段标题与状态文案', () => {
    const 视图 = 断言正常(映射P5列表项(造列表项({
      state: 造行状态('open', 'anonymous_screening', 'needs_user', 'human_decision'),
      needsAction: true,
    })));
    expect(视图.caseId).toBe('mc_1');
    expect(视图.role).toBe('candidate');
    expect(视图.intentionId).toBe('int_0123456789abcdef0123456789abcdef');
    expect(视图.candidateAlias).toBe(null);
    expect(视图.职位).toEqual({
      jobId: 'job_0123456789abcdef0123456789abcdef',
      职位名: 'AI 产品实习生',
      城市: '上海',
      薪资带: '300-500 元/天',
      技能: ['Python', 'SQL'],
    });
    expect(视图.阶段标题).toBe('匿名初筛');
    expect(视图.状态文案).toBe('待处理');
    expect(视图.待办).toBe(true);
    expect(视图.终局).toBe(false);
    expect(视图.更新于).toBe('2026-08-29T02:00:00Z');
  });

  it.each([
    { lifecycle: 'ended', stage: 'anonymous_screening', status: 'ended', step: 'complete' },
    { lifecycle: 'completed', stage: 'intent_confirmation', status: 'passed', step: 'handoff_pending' },
  ] as const)('历史架子 $lifecycle 行带终局标记且无待办', (行) => {
    const 视图 = 断言正常(映射P5列表项(造列表项({
      state: 造行状态(行.lifecycle, 行.stage, 行.status, 行.step),
    })));
    expect(视图.终局).toBe(true);
    expect(视图.待办).toBe(false);
    expect(视图.阶段标题).toBe(期望阶段标题[行.stage]);
    expect(视图.状态文案).toBe(期望状态文案[行.status]);
  });

  it('招聘端行：别名原样带出，意向 ID 恒空；键集合钉死且无 P5.1 占位字段', () => {
    const 视图 = 断言正常(映射P5列表项(造列表项({ role: 'recruiter' })));
    expect(视图.candidateAlias).toBe('candidate-0123456789ab');
    expect(视图.intentionId).toBe(null);
    expect(Object.keys(视图).sort()).toEqual([
      'caseId', 'candidateAlias', 'intentionId', 'kind', 'role',
      '待办', '更新于', '状态文案', '终局', '职位', '阶段标题', '注意说明',
    ].sort());
    expect(JSON.stringify(视图)).not.toMatch(/匹配分|评分|推荐理由|亮点|公司简介|在线简历|score|highlights/);
  });

  it.each([
    ['未知 lifecycle', () => ({ ...造列表项(), state: { ...造状态(), lifecycle: 'paused' } }) as never],
    ['矩阵外四元组 open+handoff_pending', () => 造列表项({
      state: 造行状态('open', 'intent_confirmation', 'passed', 'handoff_pending'),
    }) as never],
    ['上下文 ID 缺席', () => ({ ...造列表项(), intentionId: undefined }) as never],
    ['职位快照缺失', () => ({ ...造列表项(), job: undefined }) as never],
  ])('%s → 契约错误视图', (_名, 样本) => {
    const 视图 = 映射P5列表项(样本());
    expect(断言契约错误(视图)).toBe(期望错误提示);
  });
});
