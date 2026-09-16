// e2e/fixtures/bff/账号与目录.ts
// 账号与目录域 fixture（C2）：fixture 标记值与静态主体/简历/意向样本，
// 从 e2e/数据源模式.spec.ts 原样迁出。可变路由 handler 见同文件的
// 处理账号与目录域（阶段二迁入）。

import { P6标记 } from './Agent规则';

// ── fixture 标记值 ──

// 只存在于 fixture 的标记值：Mock 里没有，断言页面展示它们即证明渲染来自 HTTP。
export const 标记 = {
  主体真名: '后端 fixture 候选人',
  城市display: ' Fixture 市',
  学校display: ' Fixture 大学',
  专业display: ' Fixture 专业',
  学校副行: 'Fixture City · Fixtureland',
  职位display: ' Fixture 工程师',
  简历summary: '后端 fixture 个人优势标记',
  意向标题城市: 'Fixture 市',
} as const;

// ── 静态主体/简历/意向样本 ──

export const fixture主体 = {
  subject_id: 'subj-fixture-001',
  roles: [{ role: 'candidate' as const, status: 'active' as const }],
  last_used_role: 'candidate' as const,
};

export const fixture简历 = {
  profile: {
    real_name: 标记.主体真名,
    work_start_year: 2019,
    status: 'employed' as const,
    current_education: null,
    graduation_year: null,
    gender: null,
    birth_year: null,
    birth_month: null,
  },
  profile_revision: 1,
  summary: 标记.简历summary,
  summary_revision: 1,
  skills: ['Go', '分布式事务'],
  skills_revision: 1,
  experiences: [],
  // J-PILOT-02 起登录落点按「已水合简历 + active 意向」判建档完备（至少一条含毕业时间的
  // 完整教育经历）；educations 空会把候选打回 /student 学生分流，主壳用例全部落空。
  educations: [
    {
      id: 'edu-fixture-001',
      institution: { id: 'inst-fixture-001', display_name: 标记.学校display },
      degree: '本科',
      major: { id: 'major-fixture-001', display_name: 标记.专业display },
      start_month: '2015-09',
      end_month: '2019-06',
      revision: 1,
    },
  ],
  certificates: [],
  aggregate_revision: 1,
};

export const fixture意向列表 = {
  intentions: [
    {
      // Task 8：用 P6 契约形的真实 intention_id（int_ + 32 hex），意向级规则 scope 与
      // 意向级创建 body 引用的都是这一个权威 ID
      intention_id: P6标记.意向编号,
      recruitment_type: 'social_full_time' as const,
      job_category: { id: 'job-fixture-001', display_name: 标记.职位display },
      primary_location: { id: 'loc-fixture-001', display_name: 标记.意向标题城市 },
      alternate_locations: [],
      industries: [],
      workplace_modes: ['onsite' as const],
      compensation: { mode: 'range' as const, lower: 30, upper: 50, annual_salary_months: 15 },
      salary_period: 'month' as const,
      graduation_month: null,
      internship_months: null,
      onsite_days_per_week: null,
      exclusions: {
        alternate_weekend_work: 'unspecified' as const,
        outsourcing_only: 'unspecified' as const,
        onsite_only: 'unspecified' as const,
        frequent_travel: 'unspecified' as const,
      },
      private_preferences: '',
      status: 'active' as const,
      revision: 1,
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
  ],
};
