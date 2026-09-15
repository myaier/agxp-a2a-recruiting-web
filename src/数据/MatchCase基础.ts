/**
 * P5 复合对话（MatchCase）里仅依赖已批准 S0 规则的基础契约：当前阶段的补充问题。
 * 只读 transcript 的 kind/role/ref/text 与 stages 的 stage 字段，不认识其它线缆结构。
 */

export type P5基础角色 = 'candidate' | 'recruiter';

export interface P5问题阶段输入 {
  currentStage: string;
  availableActions: readonly string[];
  stages: readonly {
    stage: string;
    transcript: readonly {
      kind: string;
      role: string;
      ref?: string;
      text?: string;
    }[];
  }[];
}

export type P5当前问题结果 =
  | { kind: 'none' }
  | { kind: 'one'; promptId: string; text: string }
  | { kind: 'contract_error' };

/** 取当前补充问题 */
export function 取当前补充问题(
  input: P5问题阶段输入,
  role: P5基础角色,
): P5当前问题结果 {
  if (!input.availableActions.includes('respond_fact')) {
    return { kind: 'none' };
  }
  const section = input.stages.find((stageSection) => stageSection.stage === input.currentStage);
  if (!section) {
    return { kind: 'contract_error' };
  }
  const 候选 = section.transcript.filter(
    (item) =>
      item.kind === 'supplementary_question' &&
      item.role === role &&
      item.ref !== undefined &&
      item.ref.trim() !== '' &&
      item.text !== undefined &&
      item.text.trim() !== '',
  );
  if (候选.length !== 1) {
    return { kind: 'contract_error' };
  }
  return { kind: 'one', promptId: 候选[0].ref as string, text: 候选[0].text as string };
}

// ── S0–S3 连续筛选（continuity_version 2）的待办与 S2 待答问题（冻结合同 §6.2/§6.5）──
// 纯查找：只按服务端给的 role/purpose/id 取，绝不按「Case 停在哪一步」猜目标。

/** 本人这一用途的开放待办（没有就是没有：命令层据此零控件零请求）。 */
export function 取本人待办<T extends { role: P5基础角色; purpose: string }>(
  待办们: readonly T[],
  viewer: P5基础角色,
  purpose: T['purpose'],
): T | null {
  return 待办们.find((待办) => 待办.role === viewer && 待办.purpose === purpose) ?? null;
}

/** 正在等对端的那条待办（展示「在等谁、到几时」用；对端卡没有按钮）。 */
export function 取对方待办<T extends { role: P5基础角色 }>(
  待办们: readonly T[],
  viewer: P5基础角色,
): T | null {
  return 待办们.find((待办) => 待办.role !== viewer) ?? null;
}

/**
 * S2 待办要回答的那个公开问题：按两侧的 exchange_ref 精确相等取（记录的 exchange_ref 与
 * 该待办的同值，服务端给定），不解析任何编码、不碰不透明的记录 id、不按「最后一条问题」
 * 推断。取不到就取不到 —— 调用方退回只展示对话流本身，绝不编造一个问题正文。
 */
export function 取S2待答问题<T extends { kind: string; exchangeRef: string | null }>(
  消息们: readonly T[],
  exchangeRef: string | null,
): T | null {
  if (exchangeRef === null) return null;
  return 消息们.find((条) => 条.kind === 'question' && 条.exchangeRef === exchangeRef) ?? null;
}
