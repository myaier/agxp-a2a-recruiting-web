// MatchCase展示映射 表测：17 行已准入状态矩阵逐行逐 step 钉住 阶段标题/状态文案/步骤说明/
// 终局/可出动作卡，运行时未知词与矩阵外四元组一律 fail closed 成契约错误视图 + 空动作表。
// J-PILOT-01（Spec §7）：S0 不再提供 respond_fact 输入/提交（白名单摘除，旧后端返回由
// 交集惰性挡下），底栏禁用说明按 映射S0底栏说明 五行闭表；新终局 semantic_uncertain_stop
// 成对映射为冻结文案，原始码不进视图。文案期望全部用本文件字面量钉死，Tasks 3–7 与 E2E 按此引用。

import { describe, expect, it } from 'vitest';
import { 映射P5详情, 映射P5列表项, 映射S0底栏说明, P5展示矩阵行数, P5展示状态矩阵 } from './MatchCase展示映射';
import type { P5详情视图, P5列表视图, P5阶段, P5状态 } from './MatchCase展示映射';
import { 招聘候选摘要样本 } from '../测试/BFF样本';
import { BFF安全职位资料样本 } from '../测试/展示资料样本';
import type {
  P5S0筛选记录,
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
  resume_submission: '递交简历',
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
  // candidate_question 是 AI 侧生成动作，不是候选人的人工待办（spec §10.2）
  candidate_question: '候选方 AI 正在生成补充问题',
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
 * （J-PILOT-01 review-r1：S0 needs_user 白名单已摘除 respond_fact 与 end_screening ——
 * 旧 S0 needs_user/human_decision 卡按 Spec §7 停止交互（待核实交负责人）；
 * 邀请二卡只在 S0 passed；S1 waiting 仅 retry_resume_readiness、needs_user 三卡
 * 并集、attention_required 落空；S2 三行皆 decide_coordination；S3 意向二卡；终态恒空）。
 */
const 期望可出动作: Record<string, readonly P5动作[]> = {
  'open|anonymous_screening|running': [],
  'open|anonymous_screening|waiting': [],
  'open|anonymous_screening|needs_user': [],
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

/** 8 个 checklist label 闭词的固定中文（后端确认词表，spec §2.4）。 */
const 期望清单文案 = {
  anonymous_screening_passed: '匿名初筛已通过',
  resume_bound: '简历已绑定',
  resume_parse_ready: '简历已解析',
  resume_disclosed: '简历已披露',
  resume_screened: '简历初筛已完成',
  differences_resolved: '分歧已核对',
  candidate_confirmed: '候选人已确认',
  recruiter_confirmed: '招聘方已确认',
} as const;

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

/** S0 展开块可注入（Task 2 投影测试）；缺省为合法空块，S1–S3 恒为 null。 */
function 造阶段区组(时间线: 各阶段时间线, S0记录: P5S0筛选记录 | null = { messages: [], summaries: [] }): P5阶段区[] {
  const 阶段顺序 = ['anonymous_screening', 'resume_submission', 'needs_coordination', 'intent_confirmation'] as const;
  return 阶段顺序.map((stage, 下标) => ({
    stage,
    state: (下标 === 0 ? 'active' : 'pending') as 'active' | 'pending',
    occurredAt: 下标 === 0 ? '2026-08-29T01:10:00Z' : null,
    // 真实 wire token：summary 是阶段最后一个 step word，未开始阶段为空串（spec §2.4）
    summary: 下标 === 0 ? 'candidate_reevaluation' : '',
    checklist: 下标 === 0
      ? [{ label: 'resume_bound', done: true }, { label: 'differences_resolved', done: false }]
      : [],
    transcript: 时间线[stage],
    instructionReceipts: [],
    attachment: null,
    // S0 展开块归一化形状：仅 S0 可为对象，其余段一律 null
    screeningRecords: 下标 === 0 ? S0记录 : null,
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
  /** Task 2：注入 S0 展开块的归一化记录（缺省为合法空块）。 */
  S0记录?: P5S0筛选记录 | null;
  /** Task 6：同一响应的权威分与冻结职位资料（旧 Case 合法 null 档）。 */
  matchScore?: number | null;
  jobDetail?: P5详情['jobDetail'];
} = {}): P5详情 {
  const role = 选项.role ?? 'candidate';
  const state = 选项.state ?? 造状态();
  const availableActions = 选项.availableActions ?? [];
  const 主体 = {
    state,
    needsAction: state.lifecycle === 'open' && availableActions.length > 0,
    availableActions,
    stages: 选项.阶段区组 ?? 造阶段区组(选项.时间线 ?? 默认时间线(role), 选项.S0记录),
    currentCoordination: null,
    intentConfirmations: { candidate: '', recruiter: '' } as { candidate: ''; recruiter: '' },
    terminalSummary: 选项.terminalSummary ?? null,
    conversationRef: 选项.conversationRef ?? null,
    // release/0.2.5：展示字段是解码层的 required 成员；Task 6 起透传进视图（旧 Case null 档）
    matchScore: 选项.matchScore ?? null,
    jobDetail: 选项.jobDetail ?? null,
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
    candidateResume: null,
    candidateIdentity: { state: 'anonymous', name: null, avatar_url: null, disclosed_at: null },
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
  return {
    ...主体,
    role,
    candidateAlias: 'candidate-0123456789ab',
    matchScore: null,
    candidateIdentity: { state: 'anonymous', name: null, avatar_url: null, disclosed_at: null },
  };
}

type 正常视图 = { kind: '正常' };
type 契约错误视图 = { kind: '契约错误'; 错误提示: string };

/**
 * 终局时间的期望值：用 Date 的本地 getter 独立推出 `YYYY-MM-DD HH:mm`，
 * 不复用被测的 Intl 路径 —— 期望和实现各算各的才算得上断言。
 */
function 本地终局期望(原文: string): string {
  const 时刻 = new Date(原文);
  const 补 = (数: number) => String(数).padStart(2, '0');
  return `${时刻.getFullYear()}-${补(时刻.getMonth() + 1)}-${补(时刻.getDate())}`
    + ` ${补(时刻.getHours())}:${补(时刻.getMinutes())}`;
}

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
  });

  it('attention_required 展示安全失败文案，不给未开放的重试入口', () => {
    const 视图 = 断言正常(映射P5详情(造详情({
      state: 造状态({
        status: 'attention_required',
        step: 'candidate_evaluation',
        agentAttention: { code: 'agent_result_invalid', retryable: false },
      }),
    })));
    expect(视图.注意说明).toBe('本次 AI 结果无法安全用于推进 Case');
    expect(视图.actions).toEqual([]);
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
    // J-PILOT-01 review-r1：双端 S0 均不再出 respond_fact，旧 needs_user 行的
    // end_screening 也已摘除（Spec §7 停止该卡交互）
    expect(视图.actions.map((卡) => 卡.action)).toEqual([]);
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
  const 动作可行行: Record<Exclude<P5动作, 'respond_fact' | 'end_screening'>, Parameters<typeof 造行状态>> = {
    accept_resume_invitation: ['open', 'anonymous_screening', 'passed', 'awaiting_candidate_resume_invitation'],
    decline_resume_invitation: ['open', 'anonymous_screening', 'passed', 'awaiting_candidate_resume_invitation'],
    retry_resume_readiness: ['open', 'resume_submission', 'waiting', 'awaiting_resume_parse'],
    replace_resume: ['open', 'resume_submission', 'needs_user', 'awaiting_resume_parse'],
    decide_resume_screening: ['open', 'resume_submission', 'needs_user', 'awaiting_recruiter_decision'],
    decide_coordination: ['open', 'needs_coordination', 'needs_user', 'coordinating'],
    confirm_intent: ['open', 'intent_confirmation', 'needs_user', 'awaiting_confirmations'],
    decline_intent: ['open', 'intent_confirmation', 'needs_user', 'awaiting_confirmations'],
  };

  it('除 respond_fact / end_screening 外的八个动作闭词全部有卡：标题与说明文案齐全', () => {
    for (const 动作 of 动作全表) {
      // J-PILOT-01 review-r1：S0 needs_user 行白名单已摘除 respond_fact 与 end_screening
      //（后者随旧 S0 行停止交互一并摘除，见下方旧响应双端零动作用例）
      if (动作 === 'respond_fact' || 动作 === 'end_screening') continue;
      const 视图 = 断言正常(映射P5详情(造详情({
        state: 造行状态(...动作可行行[动作]),
        availableActions: [动作],
      })));
      expect(视图.actions, 动作).toEqual([{ action: 动作, ...期望动作卡文案[动作] }]);
    }
  });

  it('动作卡按 wire 枚举顺序渲染，不按 available_actions 顺序', () => {
    // S0 passed 行邀请二卡（wire 枚举序 accept < decline）倒序提供，渲染仍按枚举序
    const 视图 = 断言正常(映射P5详情(造详情({
      state: 造行状态('open', 'anonymous_screening', 'passed', 'awaiting_candidate_resume_invitation'),
      availableActions: ['decline_resume_invitation', 'accept_resume_invitation'],
    })));
    expect(视图.actions.map((卡) => 卡.action))
      .toEqual(['accept_resume_invitation', 'decline_resume_invitation']);
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
      '状态文案', '终局', '终局摘要', '职位', '轮次', '阶段标题', '阶段区块', '步骤说明', '更新于', '待办', '注意说明',
      '匹配分', '冻结职位资料',
    ].sort());
    const 序列化 = JSON.stringify(视图);
    // Task 6 后 匹配分/冻结职位资料 是同一响应的权威投影；在线简历仍不进视图（映射归控制层）
    expect(序列化).not.toMatch(/评分|推荐理由|亮点|公司简介|公司档案|在线简历|score|highlights|match_reasons/);
  });

  // Task 6：同一响应的 match_score 与 job_detail 透传（顶栏分数与资料区同源）
  it('权威分与冻结职位资料原样透传：真实 0 合法，无溯源 null；旧 Case 双 null 档照常', () => {
    expect(断言正常(映射P5详情(造详情())).匹配分).toBeNull();
    expect(断言正常(映射P5详情(造详情())).冻结职位资料).toBeNull();
    expect(断言正常(映射P5详情(造详情({ matchScore: 0 }))).匹配分).toBe(0);
    expect(断言正常(映射P5详情(造详情({ matchScore: 73 }))).匹配分).toBe(73);
    expect(断言正常(映射P5详情(造详情({ jobDetail: BFF安全职位资料样本 }))).冻结职位资料)
      .toBe(BFF安全职位资料样本);
  });

  it('职位快照四事实原样投影；终局摘要 定格于 换成本地展示值', () => {
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
    // 定格于 是展示值：按运行环境本地时区格式化，绝不把原始 RFC3339 摊到屏上
    expect(视图.终局摘要?.结束语).toBe('user_ended');
    expect(视图.终局摘要?.原因).toBe('user_ended');
    expect(视图.终局摘要?.定格于).toBe(本地终局期望('2026-08-29T03:00:00Z'));
    expect(视图.终局摘要?.定格于).not.toContain('T');
    expect(视图.终局摘要?.定格于).not.toContain('Z');
    expect(视图.轮次).toEqual({ 当前: 1, 预算: 3 });
    expect(视图.更新于).toBe('2026-08-29T02:00:00Z');
  });

  // Task 4：终局时间用运行环境本地时区显示，不设固定产品时区、不硬编码加八小时。
  // 期望值按当前进程时区现算（CI 与本地都按同一规则），Asia/Shanghai 下
  // '2026-08-29T03:00:00Z' 就是 '2026-08-29 11:00'。
  describe('终局 定格于 的本地格式化', () => {
    const 定格 = (finalizedAt: string) => 断言正常(映射P5详情(造详情({
      state: 造行状态('ended', 'anonymous_screening', 'ended', 'complete'),
      terminalSummary: {
        stage: 'anonymous_screening', outcome: 'user_ended',
        reasonSummary: 'user_ended', finalizedAt,
      },
    })))?.终局摘要?.定格于;

    it('形状恒为 YYYY-MM-DD HH:mm，且与运行环境本地时区一致', () => {
      for (const 原文 of ['2026-08-29T03:00:00Z', '2026-01-01T23:30:00Z', '2026-12-31T16:00:00Z']) {
        const 显示 = 定格(原文);
        expect(显示).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
        expect(显示).toBe(本地终局期望(原文));
      }
    });

    it('跨日与午夜：24 小时制，午夜是 00 不是 24', () => {
      // 本地午夜整点（用当前时区反推一个必然落在 00:00 的 UTC 时刻）
      const 本地午夜 = new Date('2026-08-29T00:00:00Z');
      本地午夜.setHours(0, 0, 0, 0);
      const 显示 = 定格(本地午夜.toISOString());
      expect(显示?.slice(11)).toBe('00:00');
      expect(显示).toBe(本地终局期望(本地午夜.toISOString()));
    });

    it('两个固定执行时区的具体快照：Asia/Shanghai 是 11:00，UTC 是 03:00', () => {
      const 显示 = 定格('2026-08-29T03:00:00Z');
      const 时区 = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // 生产不设 timeZone（跟随用户环境）；这里按测试进程实际的 TZ 给期望
      if (时区 === 'Asia/Shanghai') expect(显示).toBe('2026-08-29 11:00');
      else if (时区 === 'UTC') expect(显示).toBe('2026-08-29 03:00');
      else expect(显示).toBe(本地终局期望('2026-08-29T03:00:00Z'));
    });

    it('异常值绕过 decoder 抵达 mapper：显示 时间待确认，不抛错也不回原文', () => {
      for (const 坏值 of ['', 'not-a-date', '2026-13-45T99:99:99Z']) {
        expect(定格(坏值)).toBe('时间待确认');
      }
    });

    // review-r1 [2]：非字符串同样会绕过 decoder。new Date(null) / new Date(0) 是合法的
    // 1970 时间，直接格式化会把「没有终局时间」显示成 1970-01-01，属于编造事实。
    it('非字符串终局时间（null / 数字 / 对象）也降级成 时间待确认，不显示 1970', () => {
      for (const 坏值 of [null, 0, 1767225600000, {}, []] as unknown[]) {
        const 显示 = 定格(坏值 as string);
        expect(显示).toBe('时间待确认');
        expect(显示).not.toContain('1970');
      }
    });
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
      '匿名初筛', '递交简历', '差异协同', '意向确认',
    ]);
    expect(视图.阶段区块[0].状态文案).toBe('进行中');
    expect(视图.阶段区块[1].状态文案).toBe('未开始');
    expect(视图.阶段区块[0].清单).toEqual([
      { 文本: 期望清单文案.resume_bound, 完成: true },
      { 文本: 期望清单文案.differences_resolved, 完成: false },
    ]);
    expect(视图.阶段区块[0].时间线).toBe(组[0].transcript);
    expect(视图.阶段区块[0].叮嘱).toBe(叮嘱);
    expect(视图.阶段区块[1].附件).toBe(附件);
    expect(视图.阶段区块[0].附件).toBe(null);
  });
});

// ── 阶段区 summary/checklist 闭词展示 allowlist（spec §10.2：未知词不进视图/DOM）──

describe('映射P5详情：阶段区 summary 与 checklist 闭词展示', () => {
  /** 只改 S0 阶段区的 summary/checklist，其余用默认四阶段组（合法详情形态）。 */
  function 造单区详情(summary: string, checklist: { label: string; done: boolean }[]): P5详情 {
    const 组 = 造阶段区组(默认时间线('candidate'));
    const 区 = 组[0];
    if (区 === undefined) throw new Error('阶段区组为空');
    区.summary = summary;
    区.checklist = checklist;
    return 造详情({ 阶段区组: 组 });
  }

  it.each(Object.entries(期望步骤说明))('summary token「%s」→ 固定中文且原 token 不进视图', (token, 文案) => {
    const 视图 = 断言正常(映射P5详情(造单区详情(token, [])));
    expect(视图.阶段区块[0].摘要).toBe(文案);
    expect(JSON.stringify(视图.阶段区块[0])).not.toContain(token);
  });

  it.each(Object.entries(期望清单文案))('checklist token「%s」→ 固定中文且保留完成位', (token, 文案) => {
    const 视图 = 断言正常(映射P5详情(造单区详情('human_decision', [{ label: token, done: false }])));
    expect(视图.阶段区块[0].清单).toEqual([{ 文本: 文案, 完成: false }]);
    expect(JSON.stringify(视图.阶段区块[0])).not.toContain(token);
  });

  it('未知 summary 显示安全兜底文案，未知 checklist 整项省略；state 与 available_actions 与输入完全相同', () => {
    const 详情 = 造单区详情('secret_internal_step', [{ label: 'secret_internal_check', done: true }]);
    const 视图 = 断言正常(映射P5详情(详情));
    expect(视图.阶段区块[0].摘要).toBe('阶段信息待更新');
    expect(视图.阶段区块[0].清单).toEqual([]);
    expect(JSON.stringify(视图.阶段区块)).not.toMatch(/secret_internal_step|secret_internal_check/);
    // 展示映射不反向参与状态/动作判定：权威字段与输入逐字一致
    expect(详情.state).toEqual(造状态());
    expect(详情.availableActions).toEqual([]);
    expect(视图.caseId).toBe('mc_1');
    expect(视图.状态文案).toBe(期望状态文案.running);
    expect(视图.步骤说明).toBe(期望步骤说明.policy_check);
    expect(视图.actions).toEqual([]);
  });

  it('空 summary 使用阶段状态中性文案（active→进行中、pending→未开始）', () => {
    const 组 = 造阶段区组(默认时间线('candidate'));
    组[0].summary = '';
    组[1].summary = '';
    const 视图 = 断言正常(映射P5详情(造详情({ 阶段区组: 组 })));
    expect(视图.阶段区块[0].摘要).toBe('进行中');
    expect(视图.阶段区块[1].摘要).toBe('未开始');
  });
});

// ── J-PILOT-01（Spec §7）：S0 respond_fact 不再出输入/提交 ──

describe('映射P5详情：S0 respond_fact 零输入（J-PILOT-01）', () => {
  // 白名单摘除后，旧后端若仍返回 respond_fact 也被交集惰性挡下：任何 S0 行都不出卡、
  // 不出补充问题视图，人工待核实说明走 注意说明（见 旧 S0 needs_user 待核实提示）。
  // review-r1：旧 S0 needs_user 行同时携带 end_screening 时同样双端零动作卡
  //（Spec §7「停止该卡交互」——end_screening 是该卡上的交互，必须停）。

  it('旧 S0 needs_user 行同时提供 respond_fact/end_screening：双端零动作卡、零输入；待核实说明在场', () => {
    const 视图 = 断言正常(映射P5详情(造详情({
      state: 造行状态('open', 'anonymous_screening', 'needs_user', 'human_decision'),
      availableActions: ['respond_fact', 'end_screening'],
    })));
    expect(视图.actions.map((卡) => 卡.action)).toEqual([]);
    expect(JSON.stringify(视图)).not.toContain('promptId'); // 无补充问题视图（零提交控件）
    expect(视图.注意说明).toBe('旧版状态待核实，请交负责人处理'); // 旧状态待核实，交负责人处理
  });

  it('S0 running 行不提供 respond_fact：无动作卡、注意说明恒 null（运行中无人工待办）', () => {
    const 视图 = 断言正常(映射P5详情(造详情({
      state: 造行状态('open', 'anonymous_screening', 'running', 'candidate_reevaluation'),
      availableActions: [...动作全表],
    })));
    expect(视图.actions).toEqual([]);
    expect(视图.注意说明).toBeNull();
  });
});

// ── J-PILOT-01（Spec §7）：S0 底栏禁用说明五行闭表 + 新终局成对映射 ──

describe('映射S0底栏说明（Spec §7 输入框表）', () => {
  const S0 = 造行状态('open', 'anonymous_screening', 'running', 'policy_check');
  const S0等待 = 造行状态('open', 'anonymous_screening', 'waiting', 'candidate_reevaluation');
  const S0需注意 = 造状态({
    status: 'attention_required', step: 'candidate_evaluation',
    agentAttention: { code: 'agent_unavailable', retryable: false },
  });
  const S0终局 = (outcome: string): P5状态视图 => 造状态({
    lifecycle: 'ended', status: 'ended', step: 'complete', needsUser: false,
    outcome, outcomeCode: outcome, finalizedAt: '2026-08-29T03:00:00Z',
  });

  it('S0 open 行：运行中/等待给「双方 AI 代理正在确认条件」', () => {
    expect(映射S0底栏说明(S0)).toBe('双方 AI 代理正在确认条件');
    expect(映射S0底栏说明(S0等待)).toBe('双方 AI 代理正在确认条件');
  });

  it('S0 技术故障（attention）：「条件确认遇到问题，待排查」，不承诺刷新可重跑', () => {
    expect(映射S0底栏说明(S0需注意)).toBe('条件确认遇到问题，待排查');
  });

  it('S0 终局按顶格 outcome 分行：信息不足/不适配/其它（user_ended、权限终止、未知词）', () => {
    expect(映射S0底栏说明(S0终局('semantic_uncertain_stop'))).toBe('信息不足，未能确认条件');
    expect(映射S0底栏说明(S0终局('semantic_not_fit'))).toBe('条件不适配，本次代谈已结束');
    expect(映射S0底栏说明(S0终局('user_ended'))).toBe('本次代谈已结束');
    expect(映射S0底栏说明(S0终局('party_account_deleted'))).toBe('本次代谈已结束');
    expect(映射S0底栏说明(S0终局('未知词'))).toBe('本次代谈已结束');
  });

  it('非 S0 阶段返回 null：底栏不落 S0 文案，恢复既有叮嘱/终局只读口径', () => {
    expect(映射S0底栏说明(造行状态('open', 'resume_submission', 'running', 'awaiting_resume_parse'))).toBeNull();
    expect(映射S0底栏说明(造行状态('open', 'intent_confirmation', 'needs_user', 'awaiting_confirmations'))).toBeNull();
  });
});

describe('映射P5详情：新终局成对映射（semantic_uncertain_stop 不露原始码）', () => {
  it('终局摘要结束语/原因都是冻结文案，wire 原词不进视图', () => {
    const 视图 = 断言正常(映射P5详情(造详情({
      state: 造状态({
        lifecycle: 'ended', stage: 'anonymous_screening', status: 'ended', step: 'complete',
        needsUser: false, outcome: 'semantic_uncertain_stop', outcomeCode: 'semantic_uncertain_stop',
        finalizedAt: '2026-08-29T03:00:00Z',
      }),
      terminalSummary: {
        stage: 'anonymous_screening', outcome: 'semantic_uncertain_stop',
        reasonSummary: 'semantic_uncertain_stop', finalizedAt: '2026-08-29T03:00:00Z',
      },
    })));
    expect(视图.终局摘要?.结束语).toBe('信息不足，未能确认条件');
    expect(视图.终局摘要?.原因).toBe('信息不足，未能确认条件');
    expect(JSON.stringify(视图)).not.toContain('semantic_uncertain_stop');
  });

  it('其它终局沿用 wire 原词（user_ended 等既有口径不变）', () => {
    const 视图 = 断言正常(映射P5详情(造详情({
      state: 造行状态('ended', 'intent_confirmation', 'ended', 'complete'),
      terminalSummary: {
        stage: 'intent_confirmation', outcome: 'user_ended', reasonSummary: 'user_ended',
        finalizedAt: '2026-08-29T03:00:00Z',
      },
    })));
    expect(视图.终局摘要?.结束语).toBe('user_ended');
    expect(视图.终局摘要?.原因).toBe('user_ended');
  });
});

// ── 旧 S0 needs_user 待核实说明（Spec §7：不自动结束、不伪装新终局）──

describe('映射P5详情：旧 S0 needs_user 待核实说明', () => {
  it('S0 needs_user 行给待核实说明，徽标投影随之退「需注意」；其它行不受影响', () => {
    expect(映射P5详情(造详情({
      state: 造行状态('open', 'anonymous_screening', 'needs_user', 'human_decision'),
    }))).toMatchObject({ 注意说明: '旧版状态待核实，请交负责人处理' });
    // 非 S0 行不携带该说明
    expect(映射P5详情(造详情({
      state: 造行状态('open', 'resume_submission', 'waiting', 'awaiting_resume_parse'),
    }))).toMatchObject({ 注意说明: null });
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

  it('非 attention 状态：S0 needs_user 给待核实说明，其余行恒 null（需注意由 注意说明!==null 唯一推导）', () => {
    const 行 = 造行状态('open', 'anonymous_screening', 'needs_user', 'human_decision');
    // 行侧 status=needs_user 且带 agentAttention 是 decode 已挡的组合：映射层不读该块
    const 带块 = { ...行, agentAttention: { code: 'agent_unavailable', retryable: false } as const };
    // J-PILOT-01：旧 S0 needs_user 是人工补事实遗留行 —— 详情固定给待核实说明（不读块）
    expect(映射P5列表项(造列表项({ state: 带块 }))).toMatchObject({ kind: '正常', 注意说明: null });
    expect(映射P5详情(造详情({ state: 带块 }))).toMatchObject({
      kind: '正常', 注意说明: '旧版状态待核实，请交负责人处理',
    });
    // S1 非行/非 needs_user 的行侧仍恒 null
    const 解析中 = 造行状态('open', 'resume_submission', 'waiting', 'awaiting_resume_parse');
    expect(映射P5详情(造详情({ state: 解析中 }))).toMatchObject({ kind: '正常', 注意说明: null });
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
      '待办', '更新于', '状态文案', '终局', '职位', '阶段标题', '注意说明', '匹配分',
    ].sort());
    expect(JSON.stringify(视图)).not.toMatch(/评分|推荐理由|亮点|公司简介|在线简历|score|highlights/);
  });

  it('匹配分取该行 match_score：真实 0 照常，无溯源 null；identity 即使 disclosed 也不进视图', () => {
    const 行 = 造列表项({ role: 'recruiter' }) as Extract<P5列表项, { role: 'recruiter' }>;
    expect(断言正常(映射P5列表项({ ...行, matchScore: 0 })).匹配分).toBe(0);
    expect(断言正常(映射P5列表项(行)).匹配分).toBeNull();
    const 披露名 = '内部姓名不得上卡';
    const 文本 = JSON.stringify(映射P5列表项({
      ...行,
      matchScore: 61,
      candidateIdentity: { state: 'disclosed', name: 披露名, avatar_url: 'https://x/avatar.png', disclosed_at: '2026-09-01T00:00:00Z' },
    }));
    expect(文本).not.toContain(披露名);
    expect(文本).not.toContain('avatar');
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

  it('已展开 recruiter 行把 candidateSummary 映为候选摘要视图；其余事实原样保留', () => {
    const 行 = 造列表项({ role: 'recruiter' }) as Extract<P5列表项, { role: 'recruiter' }>;
    const 视图 = 断言正常(映射P5列表项({ ...行, candidateSummary: 招聘候选摘要样本 }));
    expect(视图.候选摘要).toEqual({
      性别: '女', 年限: '5 年', 学历: '本科', 求职状态: '在职看机会',
      工作: '示例公司 · 软件工程师', 教育: '示例大学 · 计算机科学',
      个人亮点: ['带领5人团队交付'],
    });
    expect(视图.待办).toBe(false);
    expect(视图.阶段标题).toBe('匿名初筛');
    expect(视图.状态文案).toBe('进行中');
  });

  it('摘要 null 与键缺席在视图上区分；默认 history 行不凭空加字段', () => {
    const 行 = 造列表项({ role: 'recruiter' }) as Extract<P5列表项, { role: 'recruiter' }>;
    expect('候选摘要' in (映射P5列表项(行) as unknown as Record<string, unknown>)).toBe(false);
    expect('候选摘要' in (映射P5列表项({ ...行, candidateSummary: null }) as unknown as Record<string, unknown>)).toBe(true);
    expect((映射P5列表项({ ...行, candidateSummary: null }) as unknown as { 候选摘要: unknown }).候选摘要).toBeNull();
  });
});

// ── S0 展开块投影与结果语义（Task 2）：新记录只作展示，不参与状态/动作判定 ──

/** 与 src/测试/S0筛选记录样本.ts 的 S0候选完整记录Wire 同源（Task 1 decode 后的归一化形状）。 */
const S0候选完整记录: P5S0筛选记录 = {
  messages: [
    { id: 's0q_1', kind: 'question', role: 'candidate', round: 1,
      text: '这个岗位是否需要固定晚班？', occurredAt: '2026-08-23T10:01:00Z' },
    { id: 's0a_1', kind: 'answer', role: 'recruiter', round: 1,
      text: '没有固定晚班。', answerStatus: 'answered', occurredAt: '2026-08-23T10:02:00Z' },
  ],
  summaries: [
    { id: 's0s_0', phase: 'initial', summary: '需要确认岗位的值班安排。',
      occurredAt: '2026-08-23T10:00:30Z' },
    { id: 's0s_1', phase: 'reevaluation', round: 1,
      summary: '已确认没有固定晚班，仍需了解其它工作安排。', occurredAt: '2026-08-23T10:03:00Z' },
  ],
};

describe('映射P5详情：S0 展开块投影', () => {
  it('Agent 问答与候选总结按原文投影：技术字段保留、顺序不重排、不截断', () => {
    const 视图 = 断言正常(映射P5详情(造详情({ S0记录: S0候选完整记录 })));
    expect(视图.阶段区块[0].Agent消息).toEqual([
      { id: 's0q_1', kind: 'question', role: 'candidate', round: 1,
        answerStatus: null, occurredAt: '2026-08-23T10:01:00Z',
        内容: '这个岗位是否需要固定晚班？' },
      { id: 's0a_1', kind: 'answer', role: 'recruiter', round: 1,
        answerStatus: 'answered', occurredAt: '2026-08-23T10:02:00Z',
        内容: '没有固定晚班。' },
    ]);
    expect(视图.阶段区块[0].Agent总结).toEqual([
      { id: 's0s_0', phase: 'initial', round: null,
        occurredAt: '2026-08-23T10:00:30Z', 标签: '初评', 内容: '需要确认岗位的值班安排。' },
      { id: 's0s_1', phase: 'reevaluation', round: 1,
        occurredAt: '2026-08-23T10:03:00Z', 标签: '第 1 轮复评',
        内容: '已确认没有固定晚班，仍需了解其它工作安排。' },
    ]);
    // S1–S3 不带展开块
    expect(视图.阶段区块.slice(1).every((区) => 区.Agent消息.length === 0 && 区.Agent总结.length === 0)).toBe(true);
  });

  it.each([
    ['declined', '已拒绝回答'],
    ['unknown', '暂无法确认'],
    ['not_available', '暂无可用信息'],
  ] as const)('未回答 answer_status「%s」→ 固定文案「%s」，不编造正文', (answerStatus, 文案) => {
    const 记录: P5S0筛选记录 = {
      messages: [
        { id: 's0q_1', kind: 'question', role: 'candidate', round: 1,
          text: '这个岗位是否需要固定晚班？', occurredAt: '2026-08-23T10:01:00Z' },
        { id: 's0a_2', kind: 'answer', role: 'recruiter', round: 1,
          answerStatus, occurredAt: '2026-08-23T10:02:00Z' },
      ],
      summaries: [],
    };
    const 视图 = 断言正常(映射P5详情(造详情({ S0记录: 记录 })));
    expect(视图.阶段区块[0].Agent消息).toEqual([
      { id: 's0q_1', kind: 'question', role: 'candidate', round: 1,
        answerStatus: null, occurredAt: '2026-08-23T10:01:00Z', 内容: '这个岗位是否需要固定晚班？' },
      { id: 's0a_2', kind: 'answer', role: 'recruiter', round: 1,
        answerStatus, occurredAt: '2026-08-23T10:02:00Z', 内容: 文案 },
    ]);
  });

  it('招聘端正常输入展示相同问答且 Agent总结=[]，无失败或权限占位', () => {
    const 视图 = 断言正常(映射P5详情(造详情({
      role: 'recruiter',
      S0记录: { messages: S0候选完整记录.messages, summaries: [] },
    })));
    expect(视图.阶段区块[0].Agent消息).toHaveLength(2);
    expect(视图.阶段区块[0].Agent总结).toEqual([]);
  });

  it('Agent 记录只作展示：不覆盖旧 摘要，清单/时间线/叮嘱/附件语义不变', () => {
    const 组 = 造阶段区组(默认时间线('candidate'), S0候选完整记录);
    const 视图 = 断言正常(映射P5详情(造详情({ 阶段区组: 组 })));
    const S0区 = 视图.阶段区块[0];
    // 旧 摘要 仍是阶段 summary 的步骤码投影，不被 Agent 总结正文替换
    expect(S0区.摘要).toBe(期望步骤说明.candidate_reevaluation);
    expect(JSON.stringify(S0区.Agent总结)).toContain('需要确认岗位的值班安排。');
    expect(S0区.清单).toEqual([
      { 文本: 期望清单文案.resume_bound, 完成: true },
      { 文本: 期望清单文案.differences_resolved, 完成: false },
    ]);
    expect(S0区.时间线).toBe(组[0].transcript);
    expect(S0区.叮嘱).toEqual([]);
    expect(S0区.附件).toBe(null);
  });

  it.each([
    ['S1 递交简历', 1],
    ['S2 差异协同', 2],
    ['S3 意向确认', 3],
  ] as const)('绕过 decoder 注入 %s 非 null records → 契约错误，不静默过滤', (_名, 下标) => {
    const 组 = 造阶段区组(默认时间线('candidate'));
    组[下标].screeningRecords = { messages: [], summaries: [] };
    expect(断言契约错误(映射P5详情(造详情({ 阶段区组: 组 })))).toBe(期望错误提示);
  });

  it('绕过 decoder 注入 recruiter 非空总结 → 契约错误，不静默过滤', () => {
    expect(断言契约错误(映射P5详情(造详情({ role: 'recruiter', S0记录: S0候选完整记录 }))))
      .toBe(期望错误提示);
  });
});

describe('映射P5详情：S0 结果语义', () => {
  /**
   * 旧 summary 一律给终局真实词 complete（本阶段已完成）：它与 不匹配／已结束 语义相反或无关，
   * 证明结果文案只读权威 outcome，不读阶段区 summary。
   */
  function 造S0语义详情(区状态: P5阶段区['state'], 区摘要: string, 根: P5状态视图, 提供: P5动作[]): P5详情 {
    const 组 = 造阶段区组(默认时间线('candidate'));
    const 区 = 组[0];
    if (区 === undefined) throw new Error('阶段区组为空');
    区.state = 区状态;
    区.summary = 区摘要;
    return 造详情({ 阶段区组: 组, state: 根, availableActions: 提供 });
  }

  /** ended at S0：lifecycle/stage/status/step 落在 ended S0 行，outcome 按用例注入。 */
  const 造S0终局根 = (outcome: string): P5状态视图 => 造状态({
    lifecycle: 'ended', stage: 'anonymous_screening', status: 'ended', step: 'complete',
    needsUser: false, outcome, outcomeCode: outcome, finalizedAt: '2026-08-29T03:00:00Z',
  });

  const S0结果用例: {
    名: string;
    区状态: P5阶段区['state'];
    区摘要: string;
    根: P5状态视图;
    提供: P5动作[];
    期望动作: P5动作[];
    期望文案: string;
  }[] = [
    { 名: 'S0 needs_user（遗留行）→ 待处理；respond_fact/end_screening 都不再出卡', 区状态: 'active', 区摘要: 'candidate_reevaluation',
      根: 造行状态('open', 'anonymous_screening', 'needs_user', 'human_decision'),
      提供: ['respond_fact', 'end_screening'], 期望动作: [], 期望文案: '进行中' },
    { 名: 'S0 passed 且 top-level outcome=null → 已通过', 区状态: 'passed', 区摘要: 'complete',
      根: 造行状态('open', 'anonymous_screening', 'passed', 'complete'),
      提供: ['accept_resume_invitation'], 期望动作: ['accept_resume_invitation'], 期望文案: '已通过' },
    { 名: 'ended at S0 + policy_rejected → 不匹配', 区状态: 'ended', 区摘要: 'complete',
      根: 造S0终局根('policy_rejected'), 提供: [], 期望动作: [], 期望文案: '不匹配' },
    { 名: 'ended at S0 + semantic_not_fit → 不匹配', 区状态: 'ended', 区摘要: 'complete',
      根: 造S0终局根('semantic_not_fit'), 提供: [], 期望动作: [], 期望文案: '不匹配' },
    { 名: 'ended at S0 + user_ended → 已结束', 区状态: 'ended', 区摘要: 'complete',
      根: 造S0终局根('user_ended'), 提供: [], 期望动作: [], 期望文案: '已结束' },
    { 名: 'ended at S0 + party_account_deleted → 已结束', 区状态: 'ended', 区摘要: 'complete',
      根: 造S0终局根('party_account_deleted'), 提供: [], 期望动作: [], 期望文案: '已结束' },
  ];

  // vitest 的 $字段 插值只认 ASCII 词，这里用 [名, 用例] 元组 + %s 保持用例名可读
  it.each(S0结果用例.map((用例) => [用例.名, 用例] as const))('%s', (_名, 用例) => {
    const 视图 = 断言正常(映射P5详情(造S0语义详情(用例.区状态, 用例.区摘要, 用例.根, 用例.提供)));
    expect(视图.阶段区块[0].状态文案).toBe(用例.期望文案);
    // 结果文案分支不改变动作交集的原合同结果
    expect(视图.actions.map((卡) => 卡.action)).toEqual(用例.期望动作);
  });
});
