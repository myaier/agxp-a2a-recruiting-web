// e2e/fixtures/bff/真人消息.ts
// P7 真人会话域 fixture（C2）：收件箱/详情/消息分页的 wire 投影与可变 fixture 工厂，
// 从 e2e/数据源模式.spec.ts 原样迁出。可变状态归每次 安装BFF路由 所有。

// ── P7 真人会话域 fixture 与工厂 ──

// ─────────────────────────────────────────────────────────────────────────────
// P7 真人会话域可变 fixture（Task 7）。双端（候选 me / 招聘 recruiter）conversations
// 的收件箱、详情、消息分页、纯文本发送（Idempotency-Key 同键重放只落一条）、
// forward-only 已读（PUT 后该角色未读归零）与 context 投影（available /
// unavailable 演练）。消息分页响应键是实际实现的 { messages, next_cursor }，
// 已读回执是 { read_through_message_id }。会话不能由浏览器创建：fixture 只预置
// 3003 一条会话，9900 可标记不存在（foreign / wrong-role 404 演练）。
// ─────────────────────────────────────────────────────────────────────────────

export const P7会话编号 = {
  会话: '3003',
  案例: 'mc_p7_000000000000000000000001',
  职位: 'job_00112233445566778899aabbccddeeff',
  简历: 'rf_00112233445566778899aabbccddeeff',
} as const;

export const P7标记 = {
  职位名: 'P7 Fixture 后端工程师',
  地点: 'P7 Fixture 市',
  候选代号: 'candidate-p7fixture01',
  候选消息: 'P7 Fixture 候选：想约明天下午聊聊',
  招聘消息: 'P7 Fixture 招聘：可以，下午三点见',
  招聘回复: 'P7 Fixture 招聘：没问题，明天下午三点',
} as const;

export type P7角色词 = 'candidate' | 'recruiter';

export interface P7消息wire形 {
  message_id: string;
  kind: 'user_text';
  sender_role: P7角色词;
  content: string;
  created_at: string;
}

export interface P7FixtureState {
  messages: Record<string, P7消息wire形[]>;
  unread: Record<P7角色词, number>;
  sends: Array<{ role: P7角色词; key: string; content: string }>;
  reads: Array<{ role: P7角色词; through: string }>;
  /** 详情 context 投影：'unavailable' 或显式上下文（ref 可缺省隐藏动作）；缺省 available + 职位上下文 */
  contexts: Record<string, { primary_label: string; secondary_label: string; job_ref?: string; resume_ref?: string } | 'unavailable'>;
  /** 标记为不存在的会话坐标（foreign / wrong-role 404） */
  不存在: string[];
  /** 发送首答 503 operation_outcome_unknown（消息已落库、响应未知）：受控重试同键重放收敛一条 */
  首答未知: boolean;
}

export function 创建P7fixture(): P7FixtureState {
  return {
    messages: { [P7会话编号.会话]: [] },
    unread: { candidate: 0, recruiter: 0 },
    sends: [],
    reads: [],
    contexts: {},
    不存在: [],
    首答未知: false,
  };
}

/** 会话条 wire：双端共用一条 3003；context 不可用只降级展示字段（消息事实仍在）。 */
export function P7会话项wire(P7域: P7FixtureState, id: string, role: P7角色词): Record<string, unknown> {
  const 消息们 = P7域.messages[id] ?? [];
  const 最后 = 消息们.at(-1) ?? null;
  const 上下文 = P7域.contexts[id] ?? {
    primary_label: P7标记.职位名,
    secondary_label: role === 'candidate' ? P7标记.地点 : P7标记.候选代号,
    job_ref: P7会话编号.职位,
    resume_ref: P7会话编号.简历,
  };
  const 条: Record<string, unknown> = {
    conversation_id: id,
    case_id: P7会话编号.案例,
    kind: 'human_handoff',
    last_message: 最后 === null
      ? null
      : { message_id: 最后.message_id, sender_role: 最后.sender_role, preview: 最后.content, created_at: 最后.created_at },
    last_activity_at: 最后?.created_at ?? '2026-08-30T00:00:00Z',
    unread_count: P7域.unread[role],
    context_status: 上下文 === 'unavailable' ? 'unavailable' : 'available',
  };
  if (上下文 !== 'unavailable') 条.context = { ...上下文 };
  return 条;
}
