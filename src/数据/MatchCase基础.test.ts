import { describe, expect, it } from 'vitest';
import { 取当前补充问题 } from './MatchCase基础';
import type { P5问题阶段输入 } from './MatchCase基础';

function 构造输入(overrides?: Partial<P5问题阶段输入>): P5问题阶段输入 {
  return {
    currentStage: 'supplement',
    availableActions: ['respond_fact'],
    stages: [
      {
        stage: 'resume',
        transcript: [
          { kind: 'question', role: 'candidate', ref: 'prompt_0', text: '简历阶段问题。' },
        ],
      },
      {
        stage: 'supplement',
        transcript: [
          {
            kind: 'supplementary_question',
            role: 'candidate',
            ref: 'prompt_1',
            text: '请补充工作安排。',
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('取当前补充问题', () => {
  it('respond_fact 存在且当前阶段恰好一个全部有效的候选问题时返回 one', () => {
    expect(取当前补充问题(构造输入(), 'candidate')).toEqual({
      kind: 'one',
      promptId: 'prompt_1',
      text: '请补充工作安排。',
    });
  });

  it('availableActions 不含 respond_fact 时返回 none，不看 transcript', () => {
    expect(
      取当前补充问题(构造输入({ availableActions: ['schedule_interview'] }), 'candidate'),
    ).toEqual({ kind: 'none' });
  });

  it('当前阶段没有任何有效候选问题时 fail-closed 返回 contract_error', () => {
    expect(
      取当前补充问题(
        构造输入({
          stages: [
            {
              stage: 'supplement',
              transcript: [{ kind: 'question', role: 'candidate', ref: 'prompt_1', text: '不是补充问题。' }],
            },
          ],
        }),
        'candidate',
      ),
    ).toEqual({ kind: 'contract_error' });
  });

  it('当前阶段有两个有效候选问题时 fail-closed 返回 contract_error，绝不取第一个', () => {
    expect(
      取当前补充问题(
        构造输入({
          stages: [
            {
              stage: 'supplement',
              transcript: [
                {
                  kind: 'supplementary_question',
                  role: 'candidate',
                  ref: 'prompt_1',
                  text: '请补充工作安排。',
                },
                {
                  kind: 'supplementary_question',
                  role: 'candidate',
                  ref: 'prompt_2',
                  text: '请补充离职原因。',
                },
              ],
            },
          ],
        }),
        'candidate',
      ),
    ).toEqual({ kind: 'contract_error' });
  });

  it('非当前阶段的有效问题不参与匹配（找不到阶段也返回 contract_error）', () => {
    expect(取当前补充问题(构造输入({ currentStage: 'offer' }), 'candidate')).toEqual({
      kind: 'contract_error',
    });
  });

  it('非当前阶段的补充问题不算数，当前阶段没有则 contract_error', () => {
    expect(
      取当前补充问题(
        构造输入({
          stages: [
            {
              stage: 'resume',
              transcript: [
                {
                  kind: 'supplementary_question',
                  role: 'candidate',
                  ref: 'prompt_9',
                  text: '别的阶段的问题。',
                },
              ],
            },
            { stage: 'supplement', transcript: [] },
          ],
        }),
        'candidate',
      ),
    ).toEqual({ kind: 'contract_error' });
  });

  it('归属角色不一致的问题不是有效候选', () => {
    expect(
      取当前补充问题(
        构造输入({
          stages: [
            {
              stage: 'supplement',
              transcript: [
                {
                  kind: 'supplementary_question',
                  role: 'recruiter',
                  ref: 'prompt_1',
                  text: '请补充工作安排。',
                },
              ],
            },
          ],
        }),
        'candidate',
      ),
    ).toEqual({ kind: 'contract_error' });
  });

  it('kind 不是 supplementary_question 的问题不是有效候选', () => {
    expect(
      取当前补充问题(
        构造输入({
          stages: [
            {
              stage: 'supplement',
              transcript: [
                { kind: 'note', role: 'candidate', ref: 'prompt_1', text: '请补充工作安排。' },
              ],
            },
          ],
        }),
        'candidate',
      ),
    ).toEqual({ kind: 'contract_error' });
  });

  it('ref 为空白的问题不是有效候选', () => {
    expect(
      取当前补充问题(
        构造输入({
          stages: [
            {
              stage: 'supplement',
              transcript: [
                {
                  kind: 'supplementary_question',
                  role: 'candidate',
                  ref: '   ',
                  text: '请补充工作安排。',
                },
              ],
            },
          ],
        }),
        'candidate',
      ),
    ).toEqual({ kind: 'contract_error' });
  });

  it('缺失或空白 text 的问题不是有效候选', () => {
    const 无文本 = 构造输入({
      stages: [
        {
          stage: 'supplement',
          transcript: [
            { kind: 'supplementary_question', role: 'candidate', ref: 'prompt_1' },
          ],
        },
      ],
    });
    expect(取当前补充问题(无文本, 'candidate')).toEqual({ kind: 'contract_error' });

    const 空白文本 = 构造输入({
      stages: [
        {
          stage: 'supplement',
          transcript: [
            { kind: 'supplementary_question', role: 'candidate', ref: 'prompt_1', text: '  ' },
          ],
        },
      ],
    });
    expect(取当前补充问题(空白文本, 'candidate')).toEqual({ kind: 'contract_error' });
  });

  it('recruiter 视角按 recruiter 归属匹配', () => {
    const 输入 = 构造输入({
      stages: [
        {
          stage: 'supplement',
          transcript: [
            {
              kind: 'supplementary_question',
              role: 'recruiter',
              ref: 'prompt_3',
              text: '请补充面试时间偏好。',
            },
          ],
        },
      ],
    });
    expect(取当前补充问题(输入, 'recruiter')).toEqual({
      kind: 'one',
      promptId: 'prompt_3',
      text: '请补充面试时间偏好。',
    });
  });

  it('一条有效一条无效时仍取唯一有效候选', () => {
    const 输入 = 构造输入({
      stages: [
        {
          stage: 'supplement',
          transcript: [
            { kind: 'supplementary_question', role: 'recruiter', ref: 'prompt_x', text: '别人的。' },
            {
              kind: 'supplementary_question',
              role: 'candidate',
              ref: 'prompt_1',
              text: '请补充工作安排。',
            },
          ],
        },
      ],
    });
    expect(取当前补充问题(输入, 'candidate')).toEqual({
      kind: 'one',
      promptId: 'prompt_1',
      text: '请补充工作安排。',
    });
  });
});
