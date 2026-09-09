import type { BFFS0筛选记录 } from '../数据/BFF契约';

// Source: agxp-monorepo@462367b6571d1bbfc4bb29621a4ea1c741dba762
// apps/recruitment-bff/internal/recruitmentclient/testdata/s0_screening_records.json
export const S0候选完整记录Wire: BFFS0筛选记录 = {
  messages: [
    { id: 's0q_1', kind: 'question', role: 'candidate', round: 1,
      text: '这个岗位是否需要固定晚班？', occurred_at: '2026-08-23T10:01:00Z' },
    { id: 's0a_1', kind: 'answer', role: 'recruiter', round: 1,
      text: '没有固定晚班。', answer_status: 'answered', occurred_at: '2026-08-23T10:02:00Z' },
  ],
  summaries: [
    { id: 's0s_0', phase: 'initial', summary: '需要确认岗位的值班安排。',
      occurred_at: '2026-08-23T10:00:30Z' },
    { id: 's0s_1', phase: 'reevaluation', round: 1,
      summary: '已确认没有固定晚班，仍需了解其它工作安排。', occurred_at: '2026-08-23T10:03:00Z' },
  ],
};

export const S0招聘完整记录Wire: BFFS0筛选记录 = {
  messages: S0候选完整记录Wire.messages.map((item) => ({ ...item })),
  summaries: [],
};

export const S0仅问题记录Wire: BFFS0筛选记录 = {
  messages: [S0候选完整记录Wire.messages[0]!],
  summaries: [],
};

export const S0未知回答记录Wire: BFFS0筛选记录 = {
  messages: [
    S0候选完整记录Wire.messages[0]!,
    { id: 's0a_1', kind: 'answer', role: 'recruiter', round: 1,
      answer_status: 'unknown', occurred_at: '2026-08-23T10:02:00Z' },
  ],
  summaries: S0候选完整记录Wire.summaries.map((item) => ({ ...item })),
};
