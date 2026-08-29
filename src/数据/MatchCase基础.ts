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
