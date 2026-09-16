// e2e/fixtures/bff/MatchCase.ts
// P5 MatchCase 域 fixture（C2）：双端 match-cases 的 wire 投影、17 行准入矩阵样本、
// J-PILOT-01 连续代谈记录与可变 fixture 工厂，从 e2e/数据源模式.spec.ts 原样迁出。
// 可变状态归每次 安装BFF路由 所有。

import { P6标记 } from './Agent规则';
import { P4编号, type P4摘要形 } from './发现推荐';
import { 信封, type 路由上下文形 } from './协议';

// ── P5 MatchCase 域样本与工厂 ──

// ─────────────────────────────────────────────────────────────────────────────
// P5 MatchCase 域可变 fixture（Task 8）。双端（候选 me / 招聘 recruiter）match-cases
// 的 open 工作区、ended/completed 历史架子、四阶段详情、S0–S3 命令、Case 叮嘱与
// 披露后的原始简历 PDF。状态元组只取已准入 17 行矩阵（backend local-e2e J1–J6 的
// 真实迁移：S2 双角色 accept 才进 S3、第二笔 confirm 才 completed、失败解析挡披露
// 后同键重放同一对即披露、invitation decline = decisions action:end）；编号与标记值
// （P5编号 / P5标记）只存在于 fixture，Mock 数据里没有，断言页面展示它们即证明
// 渲染来自 HTTP 而非 Mock。列表两页翻页（首页 1 条 + cursor，游标原样透传）；
// 变更回执（method/path/body/Idempotency-Key）原样存 变更请求，同键重放回 200、
// 决过再发新键答 409；每个 Case JSON 应答带 Cache-Control: no-store、PDF 应答
// private, no-store —— 应答头逐笔存 应答头存证（fixture 侧 no-store 证据）。
// ─────────────────────────────────────────────────────────────────────────────

export const P5编号 = {
  job: 'job_00112233445566778899aabbccdde5a1',
  甲: 'mccase_p5_0000000000000000000000a1',
  乙: 'mccase_p5_0000000000000000000000a2',
  丙一: 'mccase_p5_0000000000000000000000a3',
  丙二: 'mccase_p5_0000000000000000000000a4',
  丁: 'mccase_p5_0000000000000000000000a5',
  戊: 'mccase_p5_0000000000000000000000a6',
  己: 'mccase_p5_0000000000000000000000a7',
  // S0–S3 展示统一 Task 7：v2 连续筛选样本（只在需要的用例里种进 fixture，
  // 不进默认集合 —— 列表/历史顺序断言不因新样本漂移）
  庚: 'mccase_p5_0000000000000000000000a8',
  辛: 'mccase_p5_0000000000000000000000a9',
  坏生命周期: 'mccase_p5_bad_lifecycle',
  坏阶段: 'mccase_p5_bad_stage',
  坏状态: 'mccase_p5_bad_status',
  坏步骤: 'mccase_p5_bad_step',
  坏四元组: 'mccase_p5_bad_tuple',
  坏行: 'mccase_p5_bad_row',
  问题: 'p5prompt_0001',
  协同: 'cdi_00112233445566778899aabbccddee50',
  文件: 'rf_00112233445566778899aabbccddee51',
  文件版本: 'rfv_00112233445566778899aabbccddee52',
} as const;

export const P5标记 = {
  招聘岗标题: 'P5 Fixture 招聘岗',
  甲职位名: 'P5 Fixture 在谈岗位·甲',
  乙职位名: 'P5 Fixture 在谈岗位·乙',
  丙一职位名: 'P5 Fixture 在谈岗位·丙一',
  丙二职位名: 'P5 Fixture 在谈岗位·丙二',
  丁职位名: 'P5 Fixture 在谈岗位·丁',
  戊职位名: 'P5 Fixture 终局岗位·戊',
  己职位名: 'P5 Fixture 终局岗位·己',
  城市: 'P5 Fixture 市',
  薪资带: 'P5 30-45K·15薪',
  技能: 'P5FixtureGo',
  甲别名: 'candidate-00000000a5a1',
  乙别名: 'candidate-00000000a5a2',
  丙一别名: 'candidate-00000000a5a3',
  丙二别名: 'candidate-00000000a5a4',
  丁别名: 'candidate-00000000a5a5',
  戊别名: 'candidate-00000000a5a6',
  己别名: 'candidate-00000000a5a7',
  简历名: 'P5 Fixture 原始简历.pdf',
  // J-PILOT-01（Task 7）：场景一 S0 初评小结正文（initial 托盘；与公开初评同屏做来源区分）
  S0小结: 'P5 Fixture S0 条件确认小结',
  问题: 'P5 Fixture 每周可以到岗几天？',
  回答: 'P5 Fixture 回答：每周可以到岗 3 天',
  叮嘱: 'P5 Fixture 只在工作日 10:00-19:00 联系',
  // S0–S3 展示统一 Task 7：v2 连续筛选样本标记（庚=终局架、辛=进行架）
  庚职位名: 'P5 Fixture 终局岗位·庚',
  辛职位名: 'P5 Fixture 在谈岗位·辛',
  庚别名: 'candidate-00000000a5a8',
  辛别名: 'candidate-00000000a5a9',
  庚公开评: 'P5 Fixture 公开初评·庚样本',
  庚S0问: 'P5 Fixture 庚：方便到岗的时间？',
  庚S0答: 'P5 Fixture 庚：每周可以到岗 4 天',
  庚复评长文: `P5 Fixture 庚复评·${'复评结论逐条核对岗位条件与公开资料，这一段刻意写得很长，用来验证灰色注释换行可读、不撑破布局。'.repeat(5)}`,
  庚S1问: 'P5 Fixture 庚：可以接受偶尔出差吗？',
  庚私有总结: 'P5 Fixture 候选私有小结（招聘端不可见）',
  辛自述长文: `P5 Fixture 辛自述·${'候选人个人优势的长句样本，验证在线简历正文长文本换行可读、不横向溢出。'.repeat(6)}`,
  冻结公司: 'P5 Fixture 冻结公司',
  冻结岗位描述: 'P5 Fixture 冻结岗位描述',
  冻结岗位要求: 'P5 Fixture 冻结岗位要求',
  冻结发布人: 'P5 Fixture 发布人',
  // open 工作区 recruiter 展开行的摘要标记（卡上工作行的现职段，逐单不同，可当行锚点）
  现职: {
    甲: 'P5 Fixture 现职·甲',
    乙: 'P5 Fixture 现职·乙',
    丙一: 'P5 Fixture 现职·丙一',
    丙二: 'P5 Fixture 现职·丙二',
    丁: 'P5 Fixture 现职·丁',
  },
} as const;

export type P5生命周期词 = 'open' | 'ended' | 'completed';
export type P5阶段词 = 'anonymous_screening' | 'resume_submission' | 'needs_coordination' | 'intent_confirmation';
export type P5状态词 = 'running' | 'needs_user' | 'passed' | 'attention_required' | 'ended' | 'waiting';
export type P5角色词 = 'candidate' | 'recruiter';
export type P5意向词 = '' | 'confirm' | 'decline';

export interface P5时间线wire形 {
  event_id: string;
  stage: P5阶段词;
  kind: string;
  role: '' | P5角色词;
  reason_code?: string;
  ref?: string;
  text?: string;
  occurred_at: string;
}

export interface P5筛选记录wire形 { messages: unknown[]; summaries: unknown[] }

export interface P5阶段区wire形 {
  stage: P5阶段词;
  state: 'pending' | 'active' | 'passed' | 'ended';
  occurred_at: string | null;
  summary: string;
  checklist: { label: string; done: boolean }[];
  transcript: P5时间线wire形[];
  instruction_receipts: { instruction_id: string; owner: P5角色词; stage: P5阶段词; expression?: string; occurred_at: string }[];
  /** S0 展开块（include=screening_records）：匿名初筛区必在且必为对象，其余阶段带键即漂移 */
  screening_records?: P5筛选记录wire形;
}

export interface P5Case记录形 {
  caseId: string;
  lifecycle: P5生命周期词;
  stage: P5阶段词;
  status: P5状态词;
  step: string;
  round: number;
  roundBudget: number;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  outcome: string | null;
  outcomeCode: string | null;
  候选: { needsAction: boolean; actions: string[] };
  招聘: { needsAction: boolean; actions: string[] };
  intentionId: string;
  alias: string;
  职位名: string;
  阶段区们: P5阶段区wire形[];
  协同?: { issue_id: string; kind: string; required_roles: P5角色词[]; candidate_decided: boolean; recruiter_decided: boolean };
  意向词: { candidate: P5意向词; recruiter: P5意向词 };
  终局?: { stage: P5阶段词; outcome: string; reason_summary: string; finalized_at: string };
  /** 已绑定递交对（阶段区 typed 附件的来源；候选端恒可见，招聘端要 已披露） */
  已绑定: boolean;
  已披露: boolean;
  /** S1 readiness 状态机：pending/failed 挡披露（409），succeeded 才接受递交 */
  解析: 'none' | 'pending' | 'failed' | 'succeeded';
  /** 非法分支：原样覆盖 state wire（未知词 / 矩阵外四元组），decode 必须 fail closed */
  state覆盖?: Record<string, unknown>;
  /** open 工作区 recruiter 展开行的 candidate_summary（七键闭合对象或显式 null）；缺省 = 显式 null */
  摘要?: P4摘要形 | null;
  /** S0–S3 展示统一 Task 7：摘要四事实的定点覆盖（如空薪资带验证冻结三元组回退） */
  职位覆盖?: { 薪资带?: string };
  /** 连续筛选块在场 = continuity_version 2（四成员按 v2 合同必在；缺省 = v1 整组缺席） */
  连续块?: {
    pending_actions?: unknown[];
    dialogue_progress?: Record<string, unknown> | null;
    reconsideration?: Record<string, unknown> | null;
    confirmation_summary?: Record<string, unknown> | null;
  };
  /** Case 创建时冻结的 SafeJobDetail wire（缺省 = legacy 显式 null，绝不补读） */
  jobDetail?: Record<string, unknown>;
  /** 招聘端候选在线简历 wire（缺省 = 显式 null：无冻结区/授权拒绝） */
  candidateResume?: Record<string, unknown>;
  /** release/0.2.5：招聘行/详情恒在场的可溯源推荐分；缺省 = 显式 null（无溯源） */
  matchScore?: number | null;
  /** release/0.2.5：Case 作用域候选身份；缺省 = anonymous 三 null，'disclosed' 才给真名/头像 */
  身份?: 'anonymous' | 'disclosed';
  /** P7（Task 7）：completed + complete 时的已发布会话坐标；handoff_pending 恒 null。 */
  conversationRef: string | null;
}

export const P5阶段顺序 = ['anonymous_screening', 'resume_submission', 'needs_coordination', 'intent_confirmation'] as const;

export function P5阶段序(stage: P5阶段词): number {
  return P5阶段顺序.indexOf(stage);
}

/** 阶段区自身 state 的服务端语义：open 以当前阶段为 active、前段 passed、后段 pending；
 *  ended 在定格段收 ended；completed 全 passed。随 Case 当前 stage 动态求值 —— 命令推进
 *  stage 后，已过段立刻转 passed、新当前段转 active（服务端真相，绝不冻结在建造时刻）。 */
export function P5区态(c: P5Case记录形, 序: number): { state: P5阶段区wire形['state']; occurred_at: string | null } {
  const 定格序 = c.lifecycle === 'open'
    ? P5阶段序(c.stage)
    : P5阶段序((c.终局?.stage ?? c.stage) as P5阶段词);
  if (c.lifecycle === 'completed') return { state: 'passed', occurred_at: c.createdAt };
  if (序 < 定格序) return { state: 'passed', occurred_at: c.createdAt };
  if (序 === 定格序) return { state: c.lifecycle === 'open' ? 'active' : 'ended', occurred_at: c.createdAt };
  return { state: 'pending', occurred_at: null };
}

/** 四阶段区固定 S0→S3 的存储底座（summary/checklist/transcript/回执按段累积）。 */
export function P5阶段区组(c: P5Case记录形): P5阶段区wire形[] {
  return P5阶段顺序.map((stage, 序) => ({
    stage,
    ...P5区态(c, 序),
    summary: `P5 Fixture ${stage} 段摘要·${c.caseId.slice(-4)}`,
    checklist: [],
    transcript: [],
    instruction_receipts: [],
    // S0 展开块只随匿名初筛区（详情 GET 带 include=screening_records，decoder 必查）
    ...(stage === 'anonymous_screening' ? { screening_records: { messages: [], summaries: [] } } : {}),
  }));
}

/** P5 open 招聘展开行的摘要样本：fixture 专属标记值，`词` 进现职/亮点，逐单可区分 */
export function P5摘要样本(词: string, 覆盖: Partial<P4摘要形> = {}): P4摘要形 {
  return {
    gender: 'male',
    experience_years: 6,
    job_status: 'employed',
    degree: 'P5 本科',
    latest_experience: { company: 'P5 Fixture 公司', title: `P5 Fixture 现职·${词}` },
    latest_education: { institution: 'P5 Fixture 大学', major: 'P5 Fixture 专业' },
    personal_highlights: [`P5 Fixture 亮点·${词}`],
    ...覆盖,
  };
}

export function P5Case(基: Partial<P5Case记录形> & Pick<
  P5Case记录形, 'caseId' | 'lifecycle' | 'stage' | 'status' | 'step' | '职位名' | 'alias'
>): P5Case记录形 {
  const c = {
    round: 1,
    roundBudget: 3,
    createdAt: '2026-08-29T01:00:00Z',
    updatedAt: '2026-08-29T02:00:00Z',
    finalizedAt: null,
    outcome: null,
    outcomeCode: null,
    候选: { needsAction: false, actions: [] },
    招聘: { needsAction: false, actions: [] },
    intentionId: P6标记.意向编号,
    意向词: { candidate: '' as P5意向词, recruiter: '' as P5意向词 },
    已绑定: false,
    已披露: false,
    解析: 'none' as P5Case记录形['解析'],
    conversationRef: null,
    ...基,
  } as P5Case记录形;
  c.阶段区们 = 基.阶段区们 ?? P5阶段区组(c);
  return c;
}

export function P5状态wire(c: P5Case记录形): Record<string, unknown> {
  const 视图: Record<string, unknown> = {
    case_id: c.caseId,
    lifecycle: c.lifecycle,
    stage: c.stage,
    status: c.status,
    step: c.step,
    round: c.round,
    round_budget: c.roundBudget,
    needs_user: c.status === 'needs_user',
    outcome: c.outcome,
    outcome_code: c.outcomeCode,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
  if (c.finalizedAt !== null) 视图.finalized_at = c.finalizedAt;
  return { ...视图, ...(c.state覆盖 ?? {}) };
}

export function P5职位wire(c: P5Case记录形): Record<string, unknown> {
  return {
    job_id: P5编号.job,
    job: {
      title: c.职位名,
      location: P5标记.城市,
      public_salary_range: c.职位覆盖?.薪资带 ?? P5标记.薪资带,
      required_skills: [P5标记.技能],
    },
  };
}

/** release/0.2.5：招聘行恒在场的 CaseCandidateIdentity。默认 anonymous 三 null；用例把
 *  P5Case记录形.身份 置 'disclosed' 才给姓名/头像/时间（头像 URL 只是解码事实，UI 零请求）。 */
export function P5身份wire(c: P5Case记录形): Record<string, unknown> {
  if (c.身份 !== 'disclosed') return { state: 'anonymous', name: null, avatar_url: null, disclosed_at: null };
  return {
    state: 'disclosed',
    name: 'P5 Fixture 候选真名',
    avatar_url: `https://cdn.fixture.example/wiring-avatar-${c.caseId.slice(-4)}.png`,
    disclosed_at: c.updatedAt,
  };
}

/** 列表行 wire：招聘端 open 展开读取（include=candidate_summary）必须携带 candidate_summary
 *  （null 合法 —— 摘要字段缺席语义）；历史行必不携带。候选端行只带 intention_id。 */
export function P5列表项wire(c: P5Case记录形, 角色: P5角色词): Record<string, unknown> {
  const 项: Record<string, unknown> = {
    state: P5状态wire(c),
    needs_action: 角色 === 'candidate' ? c.候选.needsAction : c.招聘.needsAction,
    job: P5职位wire(c),
  };
  项[角色 === 'candidate' ? 'intention_id' : 'candidate_alias'] = 角色 === 'candidate' ? c.intentionId : c.alias;
  // 2026-09-09 摘要接线：recruiter open 展开行必带 candidate_summary（显式 null 也合法）；
  // candidate 行与历史行的闭合白名单没有这个键，多带即契约漂移，所以只在 open+recruiter 装配。
  if (角色 === 'recruiter' && c.lifecycle === 'open') 项.candidate_summary = c.摘要 ?? null;
  // release/0.2.5：招聘行（默认页与历史页都）恒带可溯源推荐分与 Case 作用域候选身份
  if (角色 === 'recruiter') {
    项.match_score = c.matchScore ?? null;
    项.candidate_identity = P5身份wire(c);
  }
  return 项;
}

export function P5递交结果wire(c: P5Case记录形): Record<string, unknown> {
  return {
    state: P5状态wire(c),
    resume_submission: {
      submission_id: 'rs_00112233445566778899aabbccddee53',
      display_name: P5标记.简历名,
      size_bytes: 1024,
      media_type: 'application/pdf',
      sha256: 'c'.repeat(64),
      submitted_at: c.updatedAt,
    },
  };
}

/** 详情 wire：候选端只带 intention_id、招聘端只带 candidate_alias；附件只落在 S1 段且
 *  招聘端必须已披露（匿名初筛段永不携带 —— 披露栅栏）；协同/终局块只接受缺席语义。
 *  S0 展开块（88a5948e 起）：详情 GET 恒带 include=screening_records，S0 段必须携带
 *  screening_records 对象（空 messages/summaries 合法；招聘端携带候选小结会被解码拒绝）。 */
export function P5详情wire(c: P5Case记录形, 角色: P5角色词): Record<string, unknown> {
  const 附件可见 = c.已绑定 && (角色 === 'candidate' || c.已披露);
  const 详情: Record<string, unknown> = {
    state: P5状态wire(c),
    needs_action: 角色 === 'candidate' ? c.候选.needsAction : c.招聘.needsAction,
    available_actions: 角色 === 'candidate' ? [...c.候选.actions] : [...c.招聘.actions],
    stages: c.阶段区们.map((区, 序) => ({
      ...区,
      ...P5区态(c, 序), // 段态随当前 stage 动态求值（推进后已过段转 passed、新当前段转 active）
      ...(区.stage === 'anonymous_screening'
        // S0 展开块：默认空包；场景用例可给 段.screening_records 种问答/小结（J-PILOT-01）。
        // 隐私栅栏（decoder 同款合同）：候选私有总结只下发候选端，招聘端恒同批 messages
        // 且 summaries=[] —— wire 在此收口，绝不让测试样本把私有词漏给招聘端 decode。
        ? {
            screening_records: {
              messages: 区.screening_records?.messages ?? [],
              summaries: 角色 === 'recruiter' ? [] : 区.screening_records?.summaries ?? [],
            },
          }
        : {}),
      ...(区.stage === 'resume_submission' && 附件可见
        ? { attachment: { file_id: P5编号.文件, file_version_id: P5编号.文件版本, display_name: P5标记.简历名 } }
        : {}),
    })),
    intent_confirmations: { ...c.意向词 },
    job: P5职位wire(c),
    // release/0.2.5：详情 required match_score/job_detail。缺省 legacy 快照（显式 null =
    // 冻结正文缺席合法档），不补读当前 Job/Resume；样本用例可自带冻结职位 wire。
    match_score: c.matchScore ?? null,
    job_detail: c.jobDetail ?? null,
    // S0–S3 连续筛选合并（2026-09-15）：continuity_version 是详情 required 键。
    // 缺省 v1（历史 Case）：连续块四成员整组缺席即合法档，命令层也因此保持 v1 纯
    // {action} body（不冒充 v2 待办语义）；Task 7 样本显式给 v2 四员齐备 wire。
    ...(c.连续块 === undefined
      ? { continuity_version: 1 as const }
      : {
          continuity_version: 2 as const,
          pending_actions: c.连续块.pending_actions ?? [],
          dialogue_progress: c.连续块.dialogue_progress ?? null,
          reconsideration: c.连续块.reconsideration ?? null,
          confirmation_summary: c.连续块.confirmation_summary ?? null,
        }),
  };
  // 招聘端详情 required 私有展示二键：恒在场的共享在线简历正文与候选身份
  if (角色 === 'recruiter') {
    详情.candidate_resume = c.candidateResume ?? null;
    详情.candidate_identity = P5身份wire(c);
  }
  if (c.协同 && c.lifecycle === 'open' && c.stage === 'needs_coordination') {
    详情.current_coordination = { ...c.协同, required_roles: [...c.协同.required_roles] };
  }
  if (c.终局 && c.lifecycle !== 'open') 详情.terminal_summary = { ...c.终局 };
  // P7（Task 7）：completed + complete 才携带已发布会话坐标；pending/open/ended 必缺席
  if (c.lifecycle === 'completed' && c.step === 'complete' && c.conversationRef !== null) {
    详情.conversation_ref = c.conversationRef;
  }
  详情[角色 === 'candidate' ? 'intention_id' : 'candidate_alias'] = 角色 === 'candidate' ? c.intentionId : c.alias;
  return 详情;
}

// ─────────────────────────────────────────────────────────────────────────────
// J-PILOT-01（Task 7）：候选连续代谈记录（me/negotiations，候选专属）。同一份 P5 Case
// 经此表进入候选连续集合：record_id 是协议 B canonical 坐标（合同 pattern
// ^(dlg_|mc_)[0-9a-f]{32}$ —— 原候选委托 id；无候选委托的 Case 记录用 mc_ 坐标），
// case_state/case_detail/needs_action 全部随 Case 当前事实动态求值（服务端真相，绝不
// 冻结在建造时刻）。场景测试只显式改本表字段做最小相位转换，不建编排器。
// ─────────────────────────────────────────────────────────────────────────────

/** mc_ 坐标合成：32 位十六进制（合同 pattern），28 个 0 + 4 位尾部保证逐单可区分。 */
export function P5连续ID(后缀: string): string {
  return `mc_${'0'.repeat(28)}${后缀}`;
}

export const P5连续编号 = {
  甲: P5连续ID('a1a1'),
  乙: P5连续ID('a2a2'),
  丙一: P5连续ID('a3a3'),
  丙二: P5连续ID('a4a4'),
  丁: P5连续ID('a5a5'),
  戊: P5连续ID('a6a6'),
  己: P5连续ID('a7a7'),
  庚: P5连续ID('a8a8'),
  辛: P5连续ID('a9a9'),
  坏生命周期: P5连续ID('b1b1'),
  坏阶段: P5连续ID('b2b2'),
  坏状态: P5连续ID('b3b3'),
  坏步骤: P5连续ID('b4b4'),
  坏四元组: P5连续ID('b5b5'),
  坏行: P5连续ID('b6b6'),
} as const;

export type P5连续相位词 = 'accepted' | 'evaluating' | 'evaluation_failed' | 'refused' | 'case_started';

/** J-PILOT-01 连续代谈记录：键 = canonical record_id；wire 逐请求求值。 */
export interface P5连续记录形 {
  recordId: string;
  recordKind: 'delegation' | 'case';
  /** 关联 P5 Case（case_started 起非空；case_state/case_detail 随 Case 动态投影） */
  caseId: string | null;
  delegationId: string | null;
  evaluationId: string | null;
  phase: P5连续相位词;
  /** pre-Case 记录的 viewer 待办（case 在场时由 Case 的候选视角动态镜像） */
  needsAction: boolean;
  actions: { retry: boolean; archive: boolean; open_case: boolean };
  failure: { code: string; retryable: boolean } | null;
  refusalCode: string | null;
  retryGeneration: number;
  职位名: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  /** 公开信息初评（agent_summary.public_evaluation）；null = 尚无 */
  公开评: { decision: 'fit' | 'not_fit' | 'uncertain'; summary: string } | null;
  /** release/0.2.5：可溯源原始推荐分；缺省 = 显式 null（无溯源） */
  matchScore?: number | null;
}

/** 连续记录的动态事实：shelf、needs_action、case_state/case_detail 全部按当前 fixture 求值。 */
export function P5连续动态(
  cases: Record<string, P5Case记录形>,
  r: P5连续记录形,
): {
  c: P5Case记录形 | null;
  shelf: 'active' | 'history';
  needsAction: boolean;
} {
  const c = r.caseId === null ? null : cases[r.caseId] ?? null;
  const shelf: 'active' | 'history' = r.archivedAt !== null || (c !== null && c.lifecycle !== 'open')
    ? 'history'
    : 'active';
  // history 恒无待办（decoder 钉住）；active 的 pre-Case 用记录值，case 在场时镜像候选视角
  const needsAction = shelf === 'history'
    ? false
    : c !== null ? c.候选.needsAction : r.needsAction;
  return { c, shelf, needsAction };
}

/** J-PILOT-01：decode 探针用例自行种坏样本的连续身份（不进默认 active 集合）。 */
export function 种连续探针记录(fixture: P5MatchCasefixture形): void {
  for (const [连续编号, caseId] of [
    [P5连续编号.坏生命周期, P5编号.坏生命周期],
    [P5连续编号.坏阶段, P5编号.坏阶段],
    [P5连续编号.坏状态, P5编号.坏状态],
    [P5连续编号.坏步骤, P5编号.坏步骤],
    [P5连续编号.坏四元组, P5编号.坏四元组],
    [P5连续编号.坏行, P5编号.坏行],
  ] as const) {
    fixture.连续记录[连续编号] = {
      recordId: 连续编号,
      recordKind: 'case',
      caseId,
      delegationId: null,
      evaluationId: null,
      phase: 'case_started',
      needsAction: true,
      actions: { retry: false, archive: false, open_case: false },
      failure: null,
      refusalCode: null,
      retryGeneration: 0,
      职位名: fixture.cases[caseId]?.职位名 ?? 'P5 Fixture 非法样本',
      createdAt: '2026-08-29T01:00:00Z',
      updatedAt: '2026-08-29T01:00:00Z',
      archivedAt: null,
      公开评: null,
    };
  }
}

/** NegotiationCard wire：键集与 连续代谈.ts 的 卡片必需键 一一对应。 */
export function P5连续卡wire(
  cases: Record<string, P5Case记录形>,
  r: P5连续记录形,
): Record<string, unknown> {
  const 动态 = P5连续动态(cases, r);
  return {
    needs_action: 动态.needsAction,
    record_id: r.recordId,
    record_kind: r.recordKind,
    intention_id: P6标记.意向编号,
    job: {
      job_id: r.caseId === null ? P4编号.job : P5编号.job,
      // 职位名随 Case 当前值动态求值（用例可改 Case 记录的职位名，卡面即时跟随）
      title: 动态.c !== null ? 动态.c.职位名 : r.职位名,
      location: P5标记.城市,
      public_salary_range: P5标记.薪资带,
      availability: 'available',
      // release/0.2.5：NegotiationJob 五个展示成员全 required（null 与 []/0 不互换）；
      // display_name 显式 null（无权威公司名）→ 卡面公司名占位与旧行为一致
      organization: { organization_id: null, display_name: null, industry: null, company_size: null, funding_stage: null, logo: null },
      required_skills: [P5标记.技能],
      recruitment_type: 'social_full_time',
      workplace_mode: 'hybrid',
      annual_salary_months: 15,
    },
    delegation_id: r.delegationId,
    evaluation_id: r.evaluationId,
    case_id: 动态.c === null ? null : 动态.c.caseId,
    shelf: 动态.shelf,
    phase: r.phase,
    case_state: 动态.c === null ? null : P5状态wire(动态.c),
    failure: r.failure === null ? null : { ...r.failure },
    refusal_code: r.refusalCode,
    actions: { ...r.actions },
    retry_generation: r.retryGeneration,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    archived_at: r.archivedAt,
    // release/0.2.5：可溯源原始推荐分（0 是合法真实分，null 是无溯源）
    match_score: r.matchScore ?? null,
  };
}

/** NegotiationDetail wire：卡体 + evaluation/case_detail/failure_history/agent_summary。
 *  case_detail 复用候选 P5详情wire；condition_confirmation 恒 null（S0 总结由 case_detail
 *  的 screening_records 承接，不重复出第二份托盘）。 */
export function P5连续详情wire(
  cases: Record<string, P5Case记录形>,
  r: P5连续记录形,
): Record<string, unknown> {
  const 动态 = P5连续动态(cases, r);
  return {
    ...P5连续卡wire(cases, r),
    evaluation: null,
    case_detail: 动态.c === null ? null : P5详情wire(动态.c, 'candidate'),
    failure_history: [],
    agent_summary: {
      public_evaluation: r.公开评 === null ? null : {
        evaluation_id: r.evaluationId ?? 'evp_p5_fixture0000000000000000000001',
        decision: r.公开评.decision,
        summary: r.公开评.summary,
        coverage: 'public_job_and_candidate_data',
        evidence: {
          matches: [{ dimension: 'skill', code: 'python_match', source: 'candidate_agent' }],
          conflicts: [],
          unknowns: [],
        },
        next_action: 'review',
        completed_at: r.updatedAt,
      },
      condition_confirmation: null,
    },
    // release/0.2.5：详情专属冻结岗位展示（fixture 走 legacy 显式 null，绝不补读当前 Job）
    job_detail: null,
  };
}

export interface P5MatchCasefixture形 {
  cases: Record<string, P5Case记录形>;
  /** open 列表服务端顺序（needs_action DESC, updated_at DESC）：翻页按此切两页 */
  候选open顺序: string[];
  招聘open顺序: string[];
  历史顺序: Record<'ended' | 'completed', string[]>;
  变更请求: { method: string; path: string; body: unknown; idempotencyKey: string | null }[];
  PDF读取: string[];
  应答头存证: { path: string; cacheControl: string }[];
  /** 事实首答 503 分支的每 Case 计数（前两把键都 503：第一把被传输层受控重试消耗，
   *  第二把把失败递到屏层 —— 意图键保留，用户再提交即同键重放成功） */
  已503: Map<string, number>;
  叮嘱序: number;
  分支: { 坏行进列表?: boolean; 事实首答503?: boolean };
  /** J-PILOT-01：候选连续代谈记录（me/negotiations；键 = canonical record_id） */
  连续记录: Record<string, P5连续记录形>;
  /** 连续臂读取存证（`METHOD path`，逐笔追加；场景断言候选侧零重复 GET 用） */
  连续读取: string[];
}

export function 创建P5MatchCasefixture(): P5MatchCasefixture形 {
  // 乙：S0 待答事实行（open/anonymous_screening/needs_user·human_decision）—— 候选端
  // 独占 respond_fact/end_screening 卡；transcript 唯一一条 supplementary_question。
  const 乙 = P5Case({
    caseId: P5编号.乙, lifecycle: 'open', stage: 'anonymous_screening', status: 'needs_user', step: 'human_decision',
    职位名: P5标记.乙职位名, alias: P5标记.乙别名, updatedAt: '2026-08-29T02:06:00Z',
    摘要: P5摘要样本('乙'),
    候选: { needsAction: true, actions: ['respond_fact', 'end_screening'] },
  });
  乙.阶段区们[0]!.transcript = [
    {
      event_id: 'evt_p5_q1', stage: 'anonymous_screening', kind: 'supplementary_question',
      role: 'candidate', ref: P5编号.问题, text: P5标记.问题, occurred_at: '2026-08-29T01:10:00Z',
    },
    {
      event_id: 'evt_p5_n1', stage: 'anonymous_screening', kind: 'stage_note',
      role: '', reason_code: 'policy_checked', occurred_at: '2026-08-29T01:20:00Z',
    },
  ];
  乙.阶段区们[0]!.checklist = [{ label: 'P5 Fixture 基础事实已核对', done: true }];

  // 丙一/丙二：S1 解析等待行（open/resume_submission/waiting·awaiting_resume_parse）。
  // 丙一解析中（递交答 409 not_started 挡披露）、丙二解析失败（首答 409 failed，随后
  // 转 succeeded —— 同键重放同一对即披露，backend J4 语义）。候选端有重试卡与 typed 附件。
  const 丙一 = P5Case({
    caseId: P5编号.丙一, lifecycle: 'open', stage: 'resume_submission', status: 'waiting', step: 'awaiting_resume_parse',
    职位名: P5标记.丙一职位名, alias: P5标记.丙一别名, updatedAt: '2026-08-29T02:04:00Z',
    摘要: P5摘要样本('丙一'),
    候选: { needsAction: true, actions: ['retry_resume_readiness'] },
    已绑定: true, 解析: 'pending',
  });
  const 丙二 = P5Case({
    caseId: P5编号.丙二, lifecycle: 'open', stage: 'resume_submission', status: 'waiting', step: 'awaiting_resume_parse',
    职位名: P5标记.丙二职位名, alias: P5标记.丙二别名, updatedAt: '2026-08-29T02:03:00Z',
    摘要: P5摘要样本('丙二'),
    候选: { needsAction: true, actions: ['retry_resume_readiness'] },
    已绑定: true, 解析: 'failed',
  });

  // 甲：同一 Case 的双端分歧主角（open/resume_submission/needs_user·awaiting_recruiter_decision）
  // —— 候选端零待办零卡、招聘端独占 decide_resume_screening 卡（backend J5b 同款）。
  // 已披露：招聘端 S1 段带 typed 附件（唯一 PDF 入口）。
  const 甲 = P5Case({
    caseId: P5编号.甲, lifecycle: 'open', stage: 'resume_submission', status: 'needs_user', step: 'awaiting_recruiter_decision',
    职位名: P5标记.甲职位名, alias: P5标记.甲别名, updatedAt: '2026-08-29T02:05:00Z',
    摘要: P5摘要样本('甲'),
    招聘: { needsAction: true, actions: ['decide_resume_screening'] },
    已绑定: true, 已披露: true, 解析: 'succeeded',
  });

  // 丁：S2 协同行（open/needs_coordination/needs_user·coordinating）—— 双端各持
  // decide_coordination 卡，双角色 accept 才进 S3，第二笔 confirm 才 completed。
  const 丁 = P5Case({
    caseId: P5编号.丁, lifecycle: 'open', stage: 'needs_coordination', status: 'needs_user', step: 'coordinating',
    职位名: P5标记.丁职位名, alias: P5标记.丁别名, updatedAt: '2026-08-29T02:07:00Z',
    摘要: P5摘要样本('丁'),
    候选: { needsAction: true, actions: ['decide_coordination'] },
    招聘: { needsAction: true, actions: ['decide_coordination'] },
    协同: {
      issue_id: P5编号.协同, kind: 'work_mode', required_roles: ['candidate', 'recruiter'],
      candidate_decided: false, recruiter_decided: false,
    },
  });

  // 戊：ended 架（S0 用户终止）；己：completed 移交架（S3 双确认 + handoff_pending）。
  const 戊 = P5Case({
    caseId: P5编号.戊, lifecycle: 'ended', stage: 'anonymous_screening', status: 'ended', step: 'complete',
    职位名: P5标记.戊职位名, alias: P5标记.戊别名,
    createdAt: '2026-08-28T01:00:00Z', updatedAt: '2026-08-28T03:00:00Z', finalizedAt: '2026-08-28T03:00:00Z',
    outcome: 'user_ended', outcomeCode: 'user_ended',
    终局: { stage: 'anonymous_screening', outcome: 'user_ended', reason_summary: 'user_ended', finalized_at: '2026-08-28T03:00:00Z' },
  });
  const 己 = P5Case({
    caseId: P5编号.己, lifecycle: 'completed', stage: 'intent_confirmation', status: 'passed', step: 'handoff_pending',
    职位名: P5标记.己职位名, alias: P5标记.己别名,
    createdAt: '2026-08-27T01:00:00Z', updatedAt: '2026-08-27T05:00:00Z', finalizedAt: '2026-08-27T05:00:00Z',
    意向词: { candidate: 'confirm' as P5意向词, recruiter: 'confirm' as P5意向词 },
    终局: { stage: 'intent_confirmation', outcome: '', reason_summary: '', finalized_at: '2026-08-27T05:00:00Z' },
  });
  己.阶段区们[3]!.summary = 'handoff_pending';
  己.阶段区们[3]!.transcript = [
    {
      event_id: 'evt_p5_done', stage: 'intent_confirmation', kind: 'case_completed',
      role: '', reason_code: 'handoff_pending', occurred_at: '2026-08-27T05:00:00Z',
    },
  ];

  // 非法分支探针：基行合法、只覆盖一个词（未知枚举词 / 矩阵外四元组），decode 必须 fail closed
  const 坏Case = (caseId: string, 覆盖: Record<string, unknown>) => P5Case({
    caseId, lifecycle: 'open', stage: 'anonymous_screening', status: 'needs_user', step: 'human_decision',
    职位名: `P5 Fixture 非法样本·${caseId}`, alias: 'candidate-00000000bad0', state覆盖: 覆盖,
  });

  // J-PILOT-01：同一批 Case 的候选连续记录（active：needs_action DESC, created_at DESC,
  // record_id DESC；createdAt 逐单调开保证 active 顺序 = 丁,乙,丙一,丙二,甲；history 按
  // created_at DESC = 戊,己）。needs_action/case_state 不冻结 —— wire 逐请求按 Case 求值。
  const cases: Record<string, P5Case记录形> = {
    [P5编号.甲]: 甲,
    [P5编号.乙]: 乙,
    [P5编号.丙一]: 丙一,
    [P5编号.丙二]: 丙二,
    [P5编号.丁]: 丁,
    [P5编号.戊]: 戊,
    [P5编号.己]: 己,
    [P5编号.坏生命周期]: 坏Case(P5编号.坏生命周期, { lifecycle: 'frozen' }),
    [P5编号.坏阶段]: 坏Case(P5编号.坏阶段, { stage: 'teleporting' }),
    [P5编号.坏状态]: 坏Case(P5编号.坏状态, { status: 'fluffy' }),
    [P5编号.坏步骤]: 坏Case(P5编号.坏步骤, { step: 'warp' }),
    [P5编号.坏四元组]: 坏Case(P5编号.坏四元组, { step: 'handoff_pending' }),
    [P5编号.坏行]: 坏Case(P5编号.坏行, { status: 'fluffy' }),
  };
  const 建连续记录 = (recordId: string, caseId: string, createdAt: string): P5连续记录形 => {
    const c = cases[caseId]!;
    return {
      recordId,
      recordKind: 'case',
      caseId,
      delegationId: null,
      evaluationId: null,
      phase: 'case_started',
      needsAction: c.候选.needsAction,
      actions: { retry: false, archive: false, open_case: false },
      failure: null,
      refusalCode: null,
      retryGeneration: 0,
      职位名: c.职位名,
      createdAt,
      updatedAt: c.updatedAt,
      archivedAt: null,
      公开评: null,
    };
  };
  const 连续记录: Record<string, P5连续记录形> = {
    [P5连续编号.甲]: 建连续记录(P5连续编号.甲, P5编号.甲, '2026-08-29T01:06:00Z'),
    [P5连续编号.乙]: 建连续记录(P5连续编号.乙, P5编号.乙, '2026-08-29T01:09:00Z'),
    [P5连续编号.丙一]: 建连续记录(P5连续编号.丙一, P5编号.丙一, '2026-08-29T01:08:00Z'),
    [P5连续编号.丙二]: 建连续记录(P5连续编号.丙二, P5编号.丙二, '2026-08-29T01:07:00Z'),
    [P5连续编号.丁]: 建连续记录(P5连续编号.丁, P5编号.丁, '2026-08-29T01:10:00Z'),
    [P5连续编号.戊]: 建连续记录(P5连续编号.戊, P5编号.戊, '2026-08-28T01:00:00Z'),
    [P5连续编号.己]: 建连续记录(P5连续编号.己, P5编号.己, '2026-08-27T01:00:00Z'),
    // 坏样本探针不进默认连续集合（它们是 decode 反例，进 active 首页会毒化其它用例的列表）；
    // 探针用例（未知词 fail closed）自行种连续身份后经深链直读详情。
  };

  return {
    cases,
    候选open顺序: [P5编号.丁, P5编号.乙, P5编号.丙一, P5编号.丙二, P5编号.甲],
    招聘open顺序: [P5编号.甲, P5编号.丁, P5编号.乙, P5编号.丙一, P5编号.丙二],
    历史顺序: { ended: [P5编号.戊], completed: [P5编号.己] },
    变更请求: [],
    PDF读取: [],
    应答头存证: [],
    已503: new Map(),
    叮嘱序: 0,
    分支: {},
    连续记录,
    连续读取: [],
  };
}


// ── 路由 handler（C2 阶段二迁入）──

export async function 处理MatchCase域(
  P5域: P5MatchCasefixture形 | null,
  上下文: 路由上下文形,
): Promise<boolean> {
  if (P5域 === null) return false;
  const { route, 请求, url, path, method, body } = 上下文;

  // ── P5 MatchCase 域（Task 8：可变 fixture 在场才应答；缺席走兜底空信封 → strict
  //    decode 拒绝，正是「Mock 内容不顶替 HTTP」的既有边界）。路由匹配顺序：列表 →
  //    历史 → PDF 内容 → 各命令 → 详情（详情的 [^/]+ 不吞子路径，history 先挡）。
  //    每个 Case JSON 应答带 no-store、PDF 带 private, no-store，应答头逐笔存证；
  //    变更回执原样存 变更请求；同键重放回 200、决过再发新键答 409。──
  const P5答复 = async (路径: string, 状态: number, json: unknown, 头: Record<string, string> = {}) => {
    const 合并 = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...头 };
    P5域.应答头存证.push({ path: 路径, cacheControl: 合并['Cache-Control']! });
    await route.fulfill({ status: 状态, json, headers: 合并 });
  };
  const P5记变更 = (路径: string) => {
    P5域.变更请求.push({
      method, path: 路径, body,
      idempotencyKey: 请求.headers()['idempotency-key'] ?? null,
    });
  };
  const P5取Case = (编号: string): P5Case记录形 | undefined => P5域.cases[编号];
  const P5键 = () => 请求.headers()['idempotency-key'] ?? '';
  // 已生效键登记：路由键 → 首把生效的 Idempotency-Key（同键 200 重放 / 新键 409）
  const P5生效键 = new Map<string, string>();
  // J-PILOT-01 连续臂：retry 的同键重放登记（路由键 → 键 + 已受理回执，202 同回执重放）
  const P5连续重放 = new Map<string, { 键: string; 回执: { record_id: string; retry_generation: number } }>();
  const P5重放检查 = async (路由键: string, 路径: string, c: P5Case记录形): Promise<boolean> => {
    const 键 = P5键();
    const 生效键 = P5生效键.get(路由键);
    if (生效键 === 键 && 键 !== '') {
      await P5答复(路径, 200, 信封(P5状态wire(c)));
      return true;
    }
    return false;
  };
  const P5冲突 = async (路径: string, 类型: string, 文案: string) =>
    P5答复(路径, 409, { error: { type: 类型, message: 文案 } });
  const P5终局化 = (c: P5Case记录形, 结果词: string) => {
    c.lifecycle = 'ended';
    c.status = 'ended';
    c.step = 'complete';
    c.outcome = 结果词;
    c.outcomeCode = 结果词;
    c.finalizedAt = '2026-08-29T04:00:00Z';
    c.updatedAt = c.finalizedAt;
    c.终局 = { stage: c.stage, outcome: 结果词, reason_summary: 结果词, finalized_at: c.finalizedAt };
    c.候选 = { needsAction: false, actions: [] };
    c.招聘 = { needsAction: false, actions: [] };
    c.协同 = undefined;
  };

  // open 工作区列表：两页翻页（首页 1 条 + cursor）；查询 at-most-once 违例答公开 400
  const P5列表路径 = path === '/api/v1/me/match-cases' || path === '/api/v1/recruiter/match-cases';
  if (P5列表路径 && method === 'GET') {
    for (const 参数键 of new Set(url.searchParams.keys())) {
      if (url.searchParams.getAll(参数键).length > 1) {
        await P5答复(path, 400, { error: { type: 'invalid_request', message: '重复查询参数' } });
        return true;
      }
    }
    const 限 = Number(url.searchParams.get('limit') ?? '50');
    if (!Number.isInteger(限) || 限 < 1 || 限 > 50) {
      await P5答复(path, 400, { error: { type: 'invalid_request', message: 'limit 越界' } });
      return true;
    }
    const 游标 = url.searchParams.get('cursor');
    if (游标 !== null && !/^[A-Za-z0-9_-]+$/.test(游标)) {
      await P5答复(path, 400, { error: { type: 'invalid_request', message: 'cursor 非法' } });
      return true;
    }
    const 角色: P5角色词 = path.startsWith('/api/v1/me/') ? 'candidate' : 'recruiter';
    let 序列 = (角色 === 'candidate' ? P5域.候选open顺序 : P5域.招聘open顺序)
      .map((编号) => P5域.cases[编号]!)
      .filter((c) => c.lifecycle === 'open');
    if (角色 === 'candidate' && P5域.分支.坏行进列表) {
      序列 = [P5域.cases[P5编号.坏行]!, ...序列]; // 毒行进首页：整页 decode 拒绝
    }
    const 页 = 游标 === null
      ? { items: 序列.slice(0, 1), next_cursor: 序列.length > 1 ? 'p5pg2' : null }
      : { items: 序列.slice(1), next_cursor: null };
    await P5答复(path, 200, 信封({
      items: 页.items.map((c) => P5列表项wire(c, 角色)),
      next_cursor: 页.next_cursor,
    }));
    return true;
  }

  // 历史架子：lifecycle 查询词只认两个终态词，行只装对应终态
  const P5历史路径 = path === '/api/v1/me/match-cases/history' || path === '/api/v1/recruiter/match-cases/history';
  if (P5历史路径 && method === 'GET') {
    const 架子词 = url.searchParams.get('lifecycle');
    if (架子词 !== 'ended' && 架子词 !== 'completed') {
      await P5答复(path, 400, { error: { type: 'invalid_request', message: 'lifecycle 只认 ended/completed' } });
      return true;
    }
    const 角色: P5角色词 = path.startsWith('/api/v1/me/') ? 'candidate' : 'recruiter';
    const items = P5域.历史顺序[架子词]
      .map((编号) => P5域.cases[编号]!)
      .filter((c) => c.lifecycle === 架子词);
    await P5答复(path, 200, 信封({ items: items.map((c) => P5列表项wire(c, 角色)), next_cursor: null }));
    return true;
  }

  // 披露后的原始简历 PDF：只认 Case 专属 role 路径；未披露答 409 resume_submission_not_allowed
  const P5内容 = /^\/api\/v1\/(me|recruiter)\/match-cases\/([^/]+)\/resume-submission\/content$/.exec(path);
  if (P5内容 && method === 'GET') {
    const 角色: P5角色词 = P5内容[1] === 'me' ? 'candidate' : 'recruiter';
    const c = P5取Case(decodeURIComponent(P5内容[2]!));
    if (!c || !c.已披露) {
      await P5答复(path, 409, { error: { type: 'resume_submission_not_allowed', message: '简历尚未披露' } });
      return true;
    }
    P5域.PDF读取.push(`${角色}:${c.caseId}`);
    P5域.应答头存证.push({ path, cacheControl: 'private, no-store' });
    await route.fulfill({
      status: 200,
      body: Buffer.from('%PDF-1.7\nP5 fixture raw resume\n'),
      contentType: 'application/pdf',
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `attachment; filename="${P5标记.简历名}"`,
      },
    });
    return true;
  }

  // S0 补充事实：body 只认 {prompt_id, response}，prompt_id 必须是 transcript 的 ref
  const P5事实 = /^\/api\/v1\/(me|recruiter)\/match-cases\/([^/]+)\/fact-responses$/.exec(path);
  if (P5事实 && method === 'POST') {
    P5记变更(path);
    const c = P5取Case(decodeURIComponent(P5事实[2]!));
    if (!c) {
      await P5答复(path, 404, { error: { type: 'case_not_found', message: 'Case 不存在' } });
      return true;
    }
    if (JSON.stringify(body) !== JSON.stringify({ prompt_id: P5编号.问题, response: P5标记.回答 })) {
      await P5答复(path, 400, { error: { type: 'invalid_request_body', message: 'fact-responses body 不合契约' } });
      return true;
    }
    const 路由键 = `${method} ${path}`;
    if (await P5重放检查(路由键, path, c)) return true;
    if (P5生效键.has(路由键)) {
      await P5冲突(path, 'fact_response_not_allowed', '该问题已回答');
      return true;
    }
    if (P5域.分支.事实首答503 && (P5域.已503.get(c.caseId) ?? 0) < 2) {
      P5域.已503.set(c.caseId, (P5域.已503.get(c.caseId) ?? 0) + 1);
      P5域.应答头存证.push({ path, cacheControl: 'no-store' });
      await route.fulfill({
        status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '0' },
        json: { error: { type: 'operation_outcome_unknown', message: '结果未知' } },
      });
      return true;
    }
    P5生效键.set(路由键, P5键());
    // 事实已答 → 复评等待行；候选端待办与 respond_fact/end_screening 卡一并撤下
    c.status = 'waiting';
    c.step = 'candidate_reevaluation';
    c.updatedAt = '2026-08-29T03:00:00Z';
    c.候选 = { needsAction: false, actions: [] };
    await P5答复(path, 201, 信封(P5状态wire(c)));
    return true;
  }

  // S1 简历递交：字面披露 true + 精确 file/version 对；pending/failed 挡披露（409），
  // failed 首答后解析转 succeeded —— 同键重放同一对即披露（backend J4 语义）
  const P5递交 = /^\/api\/v1\/me\/match-cases\/([^/]+)\/resume-submission$/.exec(path);
  if (P5递交 && method === 'POST') {
    P5记变更(path);
    const c = P5取Case(decodeURIComponent(P5递交[1]!));
    if (!c) {
      await P5答复(path, 404, { error: { type: 'case_not_found', message: 'Case 不存在' } });
      return true;
    }
    const 递交 = body as { file_id?: string; file_version_id?: string; disclosure_confirmed?: boolean };
    if (递交.file_id !== P5编号.文件 || 递交.file_version_id !== P5编号.文件版本 || 递交.disclosure_confirmed !== true) {
      await P5答复(path, 400, { error: { type: 'invalid_request_body', message: 'resume-submission body 不合契约' } });
      return true;
    }
    const 路由键 = `${method} ${path}`;
    if (await P5重放检查(路由键, path, c)) return true;
    if (P5生效键.has(路由键)) {
      await P5冲突(path, 'resume_submission_conflict', '本 Case 已递交');
      return true;
    }
    if (c.解析 === 'pending') {
      await P5冲突(path, 'resume_readiness_not_started', '简历解析尚未完成');
      return true;
    }
    if (c.解析 === 'failed') {
      c.解析 = 'succeeded'; // 解析随后恢复：同键重放同一对即可披露
      await P5冲突(path, 'resume_readiness_failed', '简历解析未通过，请重试');
      return true;
    }
    P5生效键.set(路由键, P5键());
    c.已披露 = true;
    c.stage = 'resume_submission';
    c.status = 'needs_user';
    c.step = 'awaiting_recruiter_decision';
    c.updatedAt = '2026-08-29T03:10:00Z';
    c.候选 = { needsAction: false, actions: [] };
    c.招聘 = { needsAction: true, actions: ['decide_resume_screening'] };
    await P5答复(path, 201, 信封(P5递交结果wire(c)), { ETag: '"2"' });
    return true;
  }

  // S0 决定（invitation decline = decisions action:end，backend J2 语义）
  const P5决定 = /^\/api\/v1\/me\/match-cases\/([^/]+)\/decisions$/.exec(path);
  if (P5决定 && method === 'POST') {
    P5记变更(path);
    const c = P5取Case(decodeURIComponent(P5决定[1]!));
    if (!c) {
      await P5答复(path, 404, { error: { type: 'case_not_found', message: 'Case 不存在' } });
      return true;
    }
    const 动作 = (body as { action?: string }).action;
    if (动作 !== 'continue' && 动作 !== 'end') {
      await P5答复(path, 400, { error: { type: 'invalid_request_body', message: 'decisions body 不合契约' } });
      return true;
    }
    const 路由键 = `${method} ${path}`;
    if (await P5重放检查(路由键, path, c)) return true;
    if (P5生效键.has(路由键)) {
      await P5冲突(path, 'lifecycle_conflict', '本 Case 已决定');
      return true;
    }
    P5生效键.set(路由键, P5键());
    if (动作 === 'end') {
      P5终局化(c, 'user_ended');
    } else {
      c.status = 'running';
      c.step = 'candidate_evaluation';
      c.updatedAt = '2026-08-29T03:20:00Z';
      c.候选 = { needsAction: false, actions: [] };
    }
    await P5答复(path, 201, 信封(P5状态wire(c)));
    return true;
  }

  // S1 简历初筛结论：continue 无遗留分歧直进 S3（backend J5b），not_fit 终结
  const P5初筛 = /^\/api\/v1\/recruiter\/match-cases\/([^/]+)\/resume-screening-decisions$/.exec(path);
  if (P5初筛 && method === 'POST') {
    P5记变更(path);
    const c = P5取Case(decodeURIComponent(P5初筛[1]!));
    if (!c) {
      await P5答复(path, 404, { error: { type: 'case_not_found', message: 'Case 不存在' } });
      return true;
    }
    const 动作 = (body as { action?: string }).action;
    if (动作 !== 'continue' && 动作 !== 'not_fit') {
      await P5答复(path, 400, { error: { type: 'invalid_request_body', message: 'screening body 不合契约' } });
      return true;
    }
    const 路由键 = `${method} ${path}`;
    if (await P5重放检查(路由键, path, c)) return true;
    if (P5生效键.has(路由键)) {
      await P5冲突(path, 'resume_screening_decision_not_allowed', '本 Case 已出结论');
      return true;
    }
    P5生效键.set(路由键, P5键());
    if (动作 === 'not_fit') {
      P5终局化(c, 'semantic_not_fit');
    } else {
      c.stage = 'intent_confirmation';
      c.status = 'needs_user';
      c.step = 'awaiting_confirmations';
      c.updatedAt = '2026-08-29T03:30:00Z';
      c.意向词 = { candidate: '', recruiter: '' };
      c.候选 = { needsAction: true, actions: ['confirm_intent', 'decline_intent'] };
      c.招聘 = { needsAction: true, actions: ['confirm_intent', 'decline_intent'] };
    }
    await P5答复(path, 201, 信封(P5状态wire(c)));
    return true;
  }

  // S2 协同决定：单角色 accept 留对方卡，双 accept 进 S3；任一 reject 终结（backend J6）
  const P5协同决定 = /^\/api\/v1\/(me|recruiter)\/match-cases\/([^/]+)\/coordination\/([^/]+)\/decisions$/.exec(path);
  if (P5协同决定 && method === 'POST') {
    P5记变更(path);
    const 角色: P5角色词 = P5协同决定[1] === 'me' ? 'candidate' : 'recruiter';
    const c = P5取Case(decodeURIComponent(P5协同决定[2]!));
    if (!c) {
      await P5答复(path, 404, { error: { type: 'case_not_found', message: 'Case 不存在' } });
      return true;
    }
    const 动作 = (body as { action?: string }).action;
    if (动作 !== 'accept' && 动作 !== 'reject') {
      await P5答复(path, 400, { error: { type: 'invalid_request_body', message: 'coordination body 不合契约' } });
      return true;
    }
    if (!c.协同 || c.协同.issue_id !== decodeURIComponent(P5协同决定[3]!) || c.stage !== 'needs_coordination') {
      await P5冲突(path, 'coordination_decision_not_allowed', '该协同事项不再待决');
      return true;
    }
    const 路由键 = `${method} ${path}`;
    if (await P5重放检查(路由键, path, c)) return true;
    if (P5生效键.has(路由键)) {
      await P5冲突(path, 'coordination_decision_not_allowed', '该协同事项已决定');
      return true;
    }
    P5生效键.set(路由键, P5键());
    if (动作 === 'reject') {
      P5终局化(c, 'user_ended');
    } else {
      if (角色 === 'candidate') c.协同.candidate_decided = true;
      else c.协同.recruiter_decided = true;
      if (c.协同.candidate_decided && c.协同.recruiter_decided) {
        // 双 accept 才收口进 S3（backend J1：单角色 accept 留下对方卡）
        c.协同 = undefined;
        c.stage = 'intent_confirmation';
        c.status = 'needs_user';
        c.step = 'awaiting_confirmations';
        c.updatedAt = '2026-08-29T03:40:00Z';
        c.意向词 = { candidate: '', recruiter: '' };
        c.候选 = { needsAction: true, actions: ['confirm_intent', 'decline_intent'] };
        c.招聘 = { needsAction: true, actions: ['confirm_intent', 'decline_intent'] };
      } else {
        c.updatedAt = '2026-08-29T03:35:00Z';
        c.候选 = 角色 === 'candidate'
          ? { needsAction: false, actions: [] }
          : { needsAction: true, actions: ['decide_coordination'] };
        c.招聘 = 角色 === 'recruiter'
          ? { needsAction: false, actions: [] }
          : { needsAction: true, actions: ['decide_coordination'] };
      }
    }
    await P5答复(path, 201, 信封(P5状态wire(c)));
    return true;
  }

  // S3 意向决定：第一笔 confirm 留对方卡，第二笔 confirm 才 completed；decline 终结
  const P5意向决定 = /^\/api\/v1\/(me|recruiter)\/match-cases\/([^/]+)\/intent-decisions$/.exec(path);
  if (P5意向决定 && method === 'POST') {
    P5记变更(path);
    const 角色: P5角色词 = P5意向决定[1] === 'me' ? 'candidate' : 'recruiter';
    const c = P5取Case(decodeURIComponent(P5意向决定[2]!));
    if (!c) {
      await P5答复(path, 404, { error: { type: 'case_not_found', message: 'Case 不存在' } });
      return true;
    }
    const 动作 = (body as { action?: string }).action;
    if (动作 !== 'confirm' && 动作 !== 'decline') {
      await P5答复(path, 400, { error: { type: 'invalid_request_body', message: 'intent body 不合契约' } });
      return true;
    }
    const 路由键 = `${method} ${path}`;
    if (await P5重放检查(路由键, path, c)) return true;
    if (P5生效键.has(路由键) || c.意向词[角色] !== '') {
      await P5冲突(path, 'idempotency_conflict', '本端意向已决定');
      return true;
    }
    P5生效键.set(路由键, P5键());
    if (动作 === 'decline') {
      c.意向词[角色] = 'decline';
      P5终局化(c, 'user_ended');
    } else {
      c.意向词[角色] = 'confirm';
      if (c.意向词.candidate === 'confirm' && c.意向词.recruiter === 'confirm') {
        // 第二笔确认完成 Case：completed + handoff_pending，双方零动作（backend J1）
        c.lifecycle = 'completed';
        c.stage = 'intent_confirmation';
        c.status = 'passed';
        c.step = 'handoff_pending';
        c.outcome = null;
        c.outcomeCode = null;
        c.finalizedAt = '2026-08-29T05:00:00Z';
        c.updatedAt = c.finalizedAt;
        c.终局 = { stage: 'intent_confirmation', outcome: '', reason_summary: '', finalized_at: c.finalizedAt };
        c.候选 = { needsAction: false, actions: [] };
        c.招聘 = { needsAction: false, actions: [] };
        c.协同 = undefined;
      } else {
        c.status = 'needs_user';
        c.step = 角色 === 'candidate' ? 'awaiting_recruiter_confirmation' : 'awaiting_candidate_confirmation';
        c.updatedAt = '2026-08-29T03:50:00Z';
        c.候选 = 角色 === 'candidate'
          ? { needsAction: false, actions: [] }
          : { needsAction: true, actions: ['confirm_intent', 'decline_intent'] };
        c.招聘 = 角色 === 'recruiter'
          ? { needsAction: false, actions: [] }
          : { needsAction: true, actions: ['confirm_intent', 'decline_intent'] };
      }
    }
    await P5答复(path, 201, 信封(P5状态wire(c)));
    return true;
  }

  // Case 叮嘱：回执即刻落当前段（权威重读对账用），202 受理
  const P5叮嘱 = /^\/api\/v1\/(me|recruiter)\/match-cases\/([^/]+)\/agent-instructions$/.exec(path);
  if (P5叮嘱 && method === 'POST') {
    P5记变更(path);
    const 角色: P5角色词 = P5叮嘱[1] === 'me' ? 'candidate' : 'recruiter';
    const c = P5取Case(decodeURIComponent(P5叮嘱[2]!));
    if (!c) {
      await P5答复(path, 404, { error: { type: 'case_not_found', message: 'Case 不存在' } });
      return true;
    }
    const 文本 = (body as { text?: string }).text;
    if (typeof 文本 !== 'string' || 文本.length < 1 || 文本.length > 2000) {
      await P5答复(path, 400, { error: { type: 'invalid_request_body', message: '叮嘱 body 不合契约' } });
      return true;
    }
    P5域.叮嘱序 += 1;
    const 回执号 = `aci_p5_${P5域.叮嘱序}`;
    c.阶段区们.find((区) => 区.stage === c.stage)?.instruction_receipts.push({
      instruction_id: 回执号, owner: 角色, stage: c.stage, expression: 文本, occurred_at: '2026-08-29T03:55:00Z',
    });
    await P5答复(path, 202, 信封({ instruction_id: 回执号, text: 文本, state: 'executable', created_at: '2026-08-29T03:55:00Z' }));
    return true;
  }
  if (P5叮嘱 && method === 'GET') {
    await P5答复(path, 200, 信封({ instructions: [] }));
    return true;
  }

  // ── J-PILOT-01（Task 7）：候选连续代谈臂（me/negotiations，候选专属）──
  //    wire 由同一份 P5 Case 动态投影（见 P5连续卡wire/详情wire）；列表查询参数只认
  //    shelf/limit/cursor（intention_id 等不支持参数按公开 400 拒绝）；详情 GET 另收
  //    Case 坐标与 delegation_id 坐标（后端 alias 归一），应答一律返回 canonical
  //    record_id —— 深链坐标对照正是 Spec §4 的既有行为。未声明坐标固定 404
  //    negotiation_not_found（合同：foreign/missing 同一固定 404）。retry/archive 的
  //    请求契约（body / 幂等键）按冻结 mobile-v1 逐项校验。──
  const P5找连续 = (坐标: string): P5连续记录形 | undefined =>
    P5域.连续记录[坐标] ??
    Object.values(P5域.连续记录).find((r) => r.delegationId === 坐标 || r.caseId === 坐标);

  if (path === '/api/v1/me/negotiations' && method === 'GET') {
    const shelf词 = url.searchParams.get('shelf');
    if (shelf词 !== 'active' && shelf词 !== 'history') {
      await P5答复(path, 400, { error: { type: 'invalid_request', message: 'shelf 只认 active/history' } });
      return true;
    }
    const 限 = Number(url.searchParams.get('limit') ?? '50');
    if (!Number.isInteger(限) || 限 < 1 || 限 > 50) {
      await P5答复(path, 400, { error: { type: 'invalid_request', message: 'limit 越界' } });
      return true;
    }
    const 游标 = url.searchParams.get('cursor');
    if (游标 !== null && !/^[A-Za-z0-9_-]+$/.test(游标)) {
      await P5答复(path, 400, { error: { type: 'invalid_request', message: 'cursor 非法' } });
      return true;
    }
    // intention_id 不是本接口的公开参数：客户端不得自行发送（Spec §5/§10）
    if (url.searchParams.has('intention_id')) {
      await P5答复(path, 400, { error: { type: 'invalid_request', message: '不支持的查询参数 intention_id' } });
      return true;
    }
    P5域.连续读取.push(`GET ${path}${url.search}`);
    const 全部 = Object.values(P5域.连续记录)
      .map((r) => ({ r, 动态: P5连续动态(P5域.cases, r) }))
      .filter(({ 动态 }) => 动态.shelf === shelf词);
    // 服务端排序权威：active (needs_action DESC, created_at DESC, record_id DESC)；
    // history (created_at DESC, record_id DESC)。同 created_at 由 record_id DESC 收口。
    全部.sort((甲行, 乙行) => {
      if (shelf词 === 'active') {
        const 待办差 = (乙行.动态.needsAction ? 1 : 0) - (甲行.动态.needsAction ? 1 : 0);
        if (待办差 !== 0) return 待办差;
      }
      const 时间差 = 乙行.r.createdAt.localeCompare(甲行.r.createdAt);
      if (时间差 !== 0) return 时间差;
      return 乙行.r.recordId.localeCompare(甲行.r.recordId);
    });
    let 行们 = 全部.map(({ r }) => r);
    if (P5域.分支.坏行进列表 && shelf词 === 'active' && P5域.连续记录[P5连续编号.坏行]) {
      行们 = [P5域.连续记录[P5连续编号.坏行]!, ...行们]; // 毒行进首页：整页 decode 拒绝
    }
    // active 两页翻页与 Case 列表臂同构（首页 1 条 + cursor，游标原样透传）；
    // history 单页读尽（既有用例口径：终局架无加载更多）
    const 页 = 游标 === null
      ? { 行们: shelf词 === 'active' ? 行们.slice(0, 1) : 行们, 下一页: shelf词 === 'active' && 行们.length > 1 ? 'p5pg2' : null }
      : { 行们: 行们.slice(1), 下一页: null };
    await P5答复(path, 200, 信封({
      items: 页.行们.map((r) => P5连续卡wire(P5域.cases, r)),
      next_cursor: 页.下一页,
    }));
    return true;
  }

  const P5连续详情 = /^\/api\/v1\/me\/negotiations\/([^/]+)$/.exec(path);
  if (P5连续详情 && method === 'GET') {
    const 坐标 = decodeURIComponent(P5连续详情[1]!);
    P5域.连续读取.push(`GET ${path}`);
    const r = P5找连续(坐标);
    if (!r) {
      await P5答复(path, 404, { error: { type: 'negotiation_not_found', message: '记录不存在' } });
      return true;
    }
    await P5答复(path, 200, 信封(P5连续详情wire(P5域.cases, r)));
    return true;
  }

  // 失败初评重试：body 严格 {expected_retry_generation}（缺键≠0）＋ Idempotency-Key；
  // 202 受理（同键重放同一张回执），成功即相位回 evaluating、代际推进
  const P5连续重试 = /^\/api\/v1\/me\/negotiations\/([^/]+)\/retry$/.exec(path);
  if (P5连续重试 && method === 'POST') {
    P5记变更(path);
    const r = P5找连续(decodeURIComponent(P5连续重试[1]!));
    if (!r) {
      await P5答复(path, 404, { error: { type: 'negotiation_not_found', message: '记录不存在' } });
      return true;
    }
    const 体 = body as { expected_retry_generation?: unknown } | null;
    const 键组 = 体 !== null && typeof 体 === 'object' ? Object.keys(体) : [];
    const 代际 = 体 !== null && typeof 体 === 'object' ? (体 as { expected_retry_generation?: unknown }).expected_retry_generation : undefined;
    if (键组.length !== 1 || 键组[0] !== 'expected_retry_generation' ||
      typeof 代际 !== 'number' || !Number.isSafeInteger(代际) || 代际 < 0) {
      await P5答复(path, 400, { error: { type: 'invalid_request_body', message: 'retry body 不合契约' } });
      return true;
    }
    if (代际 !== r.retryGeneration) {
      await P5答复(path, 409, { error: { type: 'negotiation_retry_conflict', message: 'expected_retry_generation 不匹配' } });
      return true;
    }
    const 路由键 = `${method} ${path}`;
    const 既有回执 = P5连续重放.get(路由键);
    if (既有回执 !== undefined && P5键() === 既有回执.键) {
      await P5答复(path, 202, 信封({ ...既有回执.回执 }));
      return true;
    }
    if (P5生效键.has(路由键)) {
      await P5冲突(path, 'negotiation_retry_not_allowed', '该记录的恢复已受理过');
      return true;
    }
    const 回执 = { record_id: r.recordId, retry_generation: 代际 };
    P5连续重放.set(路由键, { 键: P5键(), 回执 });
    P5生效键.set(路由键, P5键());
    r.phase = 'evaluating';
    r.failure = null;
    r.needsAction = false;
    r.actions = { retry: false, archive: false, open_case: false };
    r.retryGeneration = 代际 + 1;
    r.updatedAt = '2026-08-29T05:00:00Z';
    await P5答复(path, 202, 信封({ ...回执 }));
    return true;
  }

  // 失败初评归档：body 严格 {} 且无 Idempotency-Key；成功后回读权威 shelf（历史架）
  const P5连续归档 = /^\/api\/v1\/me\/negotiations\/([^/]+)\/archive$/.exec(path);
  if (P5连续归档 && method === 'POST') {
    P5记变更(path);
    const r = P5找连续(decodeURIComponent(P5连续归档[1]!));
    if (!r) {
      await P5答复(path, 404, { error: { type: 'negotiation_not_found', message: '记录不存在' } });
      return true;
    }
    if (JSON.stringify(body) !== '{}' || P5键() !== '') {
      await P5答复(path, 400, { error: { type: 'invalid_request_body', message: 'archive body 不合契约' } });
      return true;
    }
    if (r.archivedAt !== null) {
      // 天然幂等：重复归档答原 archived_at
      await P5答复(path, 200, 信封({ record_id: r.recordId, archived_at: r.archivedAt }));
      return true;
    }
    r.archivedAt = '2026-08-29T06:00:00Z';
    r.needsAction = false;
    r.actions = { retry: false, archive: false, open_case: false };
    r.updatedAt = r.archivedAt;
    await P5答复(path, 200, 信封({ record_id: r.recordId, archived_at: r.archivedAt }));
    return true;
  }

  // 详情（最后匹配）：unknown case 一律固定 404 case_not_found
  const P5详情 = /^\/api\/v1\/(me|recruiter)\/match-cases\/([^/]+)$/.exec(path);
  if (P5详情 && method === 'GET') {
    const 角色: P5角色词 = P5详情[1] === 'me' ? 'candidate' : 'recruiter';
    const c = P5取Case(decodeURIComponent(P5详情[2]!));
    if (!c) {
      await P5答复(path, 404, { error: { type: 'case_not_found', message: 'Case 不存在' } });
      return true;
    }
    await P5答复(path, 200, 信封(P5详情wire(c, 角色)));
    return true;
  }
  return false;
}
