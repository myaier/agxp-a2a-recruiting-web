// 发现推荐映射测试：P4 Discovery* wire DTO → 页面视图 的投影收口。
// 两条隐私金丝雀是本文件的门槛：候选岗位视图不带 Mock 查找键（公司 slug），
// 招聘候选视图把 wire 里多出来的禁见字段投进去也必须原样丢弃（allowlist 投影）。

import { describe, expect, it } from 'vitest';
import {
  BFFCandidateJob样本,
  BFF岗位样本,
  BFF候选岗位推荐样本,
  BFF招聘候选推荐样本,
  BFF招聘委托回执样本,
} from '../测试/BFF样本';
import type { BFFCandidateJob, BFF候选岗位推荐, BFF招聘候选推荐 } from './BFF契约';
import {
  P4委托状态文案,
  P4拒绝原因文案,
  P4淘汰原因文案,
  P4淘汰原因码,
  判断P4招聘组织前提,
  从P4CandidateJob,
  从P4候选岗位,
  从P4招聘候选,
  映射P4委托展示,
} from './发现推荐映射';

describe('从P4候选岗位 / 从P4CandidateJob', () => {
  it('CandidateJob maps public company and publisher facts without a Mock slug', () => {
    const view = 从P4候选岗位(BFF候选岗位推荐样本);
    expect(view).toMatchObject({
      recommendationId: BFF候选岗位推荐样本.recommendation_id,
      intentionId: BFF候选岗位推荐样本.intention_id,
      jobId: BFFCandidateJob样本.job_id,
      卡: { 编号: BFFCandidateJob样本.job_id, 职位: BFFCandidateJob样本.title,
        公司: BFFCandidateJob样本.hiring_organization_claim.display_name,
        适配分: BFF候选岗位推荐样本.match_score },
      公司: { organizationId: BFFCandidateJob样本.hiring_organization_ref ?? null },
    });
    expect(JSON.stringify(view)).not.toContain('yunqu');
  });

  it('publisher_profile 缺席时 发布人 为 null，卡面不拿公司声明合成招聘人', () => {
    const view = 从P4候选岗位(BFF候选岗位推荐样本);
    expect(view.发布人).toBeNull();
    expect(view.卡.发布人).toBe('');
    expect(view.卡.发布人首字).toBe('');
  });

  it('publisher_profile 在场时只投影 姓名/职务/首字/验证状态', () => {
    const card: BFF候选岗位推荐 = {
      ...BFF候选岗位推荐样本,
      job: {
        ...BFFCandidateJob样本,
        publisher_profile: {
          public_name: '林澈',
          title: '招聘负责人',
          personal_verification_status: 'verified',
          avatar_url: null,
        },
      },
    };
    const view = 从P4候选岗位(card);
    expect(view.发布人).toEqual({
      姓名: '林澈', 职务: '招聘负责人', 首字: '林', 验证状态: 'verified',
    });
  });

  it('unverified 组织：公司名只取声明、简介不编造，路由 ID 只认 hiring_organization_ref', () => {
    const view = 从P4候选岗位(BFF候选岗位推荐样本);
    expect(view.公司.名称).toBe('云衢科技');
    expect(view.公司.首字).toBe('云');
    expect(view.公司.简介).toBe('');
    expect(view.公司.organizationId).toBeNull();
    expect(JSON.stringify(view)).not.toContain('已认证');
    const 带引用: BFF候选岗位推荐 = {
      ...BFF候选岗位推荐样本,
      job: { ...BFFCandidateJob样本, hiring_organization_ref: 'org_pub_1' },
    };
    expect(从P4候选岗位(带引用).公司.organizationId).toBe('org_pub_1');
  });

  it('薪资带按 period 闭合单位表格式化（K 无空格，元/天、元/时 前留空格）', () => {
    const 月薪: BFF候选岗位推荐 = {
      ...BFF候选岗位推荐样本,
      job: { ...BFFCandidateJob样本, salary_period: 'month', salary_lower: 20, salary_upper: 35 },
    };
    const 时薪: BFF候选岗位推荐 = {
      ...BFF候选岗位推荐样本,
      job: { ...BFFCandidateJob样本, salary_period: 'hour', salary_lower: 40, salary_upper: 60 },
    };
    expect(从P4候选岗位(月薪).卡.薪资).toBe('20-35K');
    expect(从P4候选岗位(BFF候选岗位推荐样本).卡.薪资).toBe('300-500 元/天');
    expect(从P4候选岗位(时薪).卡.薪资).toBe('40-60 元/时');
  });

  it('办公方式 / 招聘类型标签与硬性要求（经验/学历）按闭合文案表投影', () => {
    const view = 从P4候选岗位(BFF候选岗位推荐样本);
    expect(view.卡.办公方式).toBe('混合');
    expect(view.卡.标签).toContain('实习生');
    expect(view.卡.标签).toContain('上海');
    expect(view.卡.经验要求).toBe('不限');
    expect(view.卡.学历要求).toBe('本科');
  });

  it('职位详情/职位要求按行拆分：trim 后丢空行', () => {
    const card: BFF候选岗位推荐 = {
      ...BFF候选岗位推荐样本,
      job: {
        ...BFFCandidateJob样本,
        description: '  参与产品工作 \n\n 跟进 Agent 评测 \n',
        requirements: '在校生\n\n',
      },
    };
    const view = 从P4候选岗位(card);
    expect(view.职位详情).toEqual(['参与产品工作', '跟进 Agent 评测']);
    expect(view.职位要求).toEqual(['在校生']);
  });

  it('CandidateJob allowlist projects city, mode, office, months, experience and education', () => {
    const view = 从P4CandidateJob({
      ...BFFCandidateJob样本,
      location: { ...BFFCandidateJob样本.location, display_name: '上海' },
      workplace_mode: 'hybrid',
      office_location: '浦东新区世纪大道 1 号',
      annual_salary_months: 15,
      experience_requirement: 'three_to_five_years',
      education_requirement: 'bachelor',
    });
    expect(view.岗位事实).toEqual({
      城市: '上海',
      办公方式: '混合',
      办公地点: '浦东新区世纪大道 1 号',
      年薪月数: 15,
      经验要求: '3-5 年',
      学历要求: '本科',
      结构化要求已确认: true,
    });
  });

  it.each([
    ['remote', '', null, null],
    ['remote', '   ', null, null],
    ['onsite', '徐汇区漕河泾', 12, '徐汇区漕河泾'],
    ['hybrid', '静安区南京西路', 14, '静安区南京西路'],
  ] as const)('mode=%s office/months preserve null boundaries', (mode, office, months, expectedOffice) => {
    const view = 从P4CandidateJob({
      ...BFFCandidateJob样本,
      workplace_mode: mode,
      office_location: office,
      annual_salary_months: months,
    });
    expect(view.岗位事实.办公地点).toBe(expectedOffice);
    expect(view.岗位事实.年薪月数).toBe(months);
  });

  it('unknown structured requirement codes remain visible instead of becoming undefined', () => {
    // P4 互认闭合经验/学历枚举后，未知码已过不了 decoder，类型上不复存在；
    // 这里的断言探针只验证映射层 `??` 兜底仍原样透传，绝不让展示层拿到 undefined。
    const view = 从P4CandidateJob({
      ...BFFCandidateJob样本,
      experience_requirement: 'backend_specific_experience' as BFFCandidateJob['experience_requirement'],
      education_requirement: 'backend_specific_education' as BFFCandidateJob['education_requirement'],
    });
    expect(view.岗位事实.经验要求).toBe('backend_specific_experience');
    expect(view.岗位事实.学历要求).toBe('backend_specific_education');
  });

  it('allowlist 顶层键逐一对齐：岗位事实在册，DTO 注入键带不出去', () => {
    const poisoned = {
      ...BFFCandidateJob样本,
      company_slug: 'yunqu',
      candidate_subject: 'sub_secret',
    } as BFFCandidateJob & Record<string, unknown>;
    const view = 从P4CandidateJob(poisoned);
    expect(Object.keys(view)).toEqual([
      'recommendationId', 'intentionId', 'jobId', '卡', '岗位事实',
      '匹配依据已确认', '职位详情', '职位要求', '公司', '发布人', '委托',
    ]);
    const text = JSON.stringify(view);
    expect(text).not.toContain('yunqu');
    expect(text).not.toContain('sub_secret');
  });

  it('详情直取：无推荐/意向坐标，匹配分与委托不编造', () => {
    const view = 从P4CandidateJob(BFFCandidateJob样本);
    expect(view.recommendationId).toBeNull();
    expect(view.intentionId).toBeNull();
    expect(view.jobId).toBe('job_1');
    expect(view.卡.编号).toBe('job_1');
    expect(view.卡.适配分).toBe(0);
    expect(view.卡.对得上).toEqual([]);
    expect(view.委托).toBeNull();
  });

  it('历史 basis 只认卡顶层，嵌入 Job 的当前确认值不覆盖它（两个方向的矛盾夹具）', () => {
    // 历史未确认 + 当前 Job 已确认：推荐结论收口到卡顶层 false
    const 历史未确认 = 从P4候选岗位({
      ...BFF候选岗位推荐样本,
      structured_requirements_confirmed: false,
      job: { ...BFFCandidateJob样本, structured_requirements_confirmed: true },
    });
    expect(历史未确认.匹配依据已确认).toBe(false);
    expect(历史未确认.岗位事实.结构化要求已确认).toBe(true);
    // 历史已确认 + 当前 Job 未确认：同理反向
    const 历史已确认 = 从P4候选岗位({
      ...BFF候选岗位推荐样本,
      structured_requirements_confirmed: true,
      job: { ...BFFCandidateJob样本, structured_requirements_confirmed: false },
    });
    expect(历史已确认.匹配依据已确认).toBe(true);
    expect(历史已确认.岗位事实.结构化要求已确认).toBe(false);
  });

  it('匹配分是 wire 事实：basis 确认与否都不改写它', () => {
    for (const basis of [true, false]) {
      const view = 从P4候选岗位({ ...BFF候选岗位推荐样本, structured_requirements_confirmed: basis });
      expect(view.卡.适配分).toBe(BFF候选岗位推荐样本.match_score);
      expect(view.卡.对得上).toEqual(BFF候选岗位推荐样本.match_reasons);
    }
  });

  it('详情直取：当前 Job 确认事实落在 岗位事实，匹配依据已确认 恒 null', () => {
    for (const 确认 of [true, false]) {
      const view = 从P4CandidateJob({ ...BFFCandidateJob样本, structured_requirements_confirmed: 确认 });
      expect(view.匹配依据已确认).toBeNull();
      expect(view.岗位事实.结构化要求已确认).toBe(确认);
      expect(view.卡.适配分).toBe(0);
    }
  });

  it('委托摘要原样透传（含真实 case 坐标）', () => {
    const card: BFF候选岗位推荐 = {
      ...BFF候选岗位推荐样本,
      delegation: { delegation_id: 'del_c1', state: 'case_started', case_id: 'case_9' },
    };
    expect(从P4候选岗位(card).委托).toEqual({
      delegation_id: 'del_c1', state: 'case_started', case_id: 'case_9',
    });
  });
});

describe('从P4招聘候选', () => {
  it('recruiter projection emits only allowlisted anonymous facts and relationship copy', () => {
    const poisoned = {
      ...BFF招聘候选推荐样本,
      candidate_subject: 'sub_secret', real_name: '真实姓名', phone: '13800000000',
      gender: 'female', birth_year: 1990, salary_lower: 55000,
    } as BFF招聘候选推荐 & Record<string, unknown>;
    const clean = 从P4招聘候选(poisoned);
    const text = JSON.stringify(clean);
    expect(clean.薪资关系).toBe('薪资带有交集');
    for (const forbidden of ['sub_secret', '真实姓名', '13800000000', 'female', '1990', '55000']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('allowlist 形状逐字段对齐，不携带任何多余字段', () => {
    expect(从P4招聘候选(BFF招聘候选推荐样本)).toEqual({
      recommendationId: 'rec_r1',
      jobId: 'job_1',
      代号: '候选人甲',
      头像字: '候',
      匹配分: 87,
      亮点: ['full_stack'],
      匹配依据已确认: true,
      经验: '4 年',
      求职状态: 'employed',
      摘要: '四年全栈经验',
      技能: ['TypeScript', 'React'],
      教育: [{ 学校: '复旦大学', 专业: '计算机科学', 学历: '本科', 起止: '2017.09—2021.06' }],
      薪资关系: '薪资带有交集',
      收藏: false,
      已淘汰: false,
      淘汰原因: null,
      委托: null,
    });
  });

  it('招聘卡匹配依据只认卡顶层 basis，匹配分与亮点原样带出', () => {
    for (const basis of [true, false]) {
      const view = 从P4招聘候选({ ...BFF招聘候选推荐样本, structured_requirements_confirmed: basis });
      expect(view.匹配依据已确认).toBe(basis);
      expect(view.匹配分).toBe(BFF招聘候选推荐样本.match_score);
      expect(view.亮点).toEqual(BFF招聘候选推荐样本.highlights);
    }
  });

  it('四种薪资关系按闭合文案表投影', () => {
    expect(从P4招聘候选({ ...BFF招聘候选推荐样本, compensation_relationship: 'overlap' }).薪资关系).toBe('薪资带有交集');
    expect(从P4招聘候选({ ...BFF招聘候选推荐样本, compensation_relationship: 'near_miss' }).薪资关系).toBe('薪资带接近');
    expect(从P4招聘候选({ ...BFF招聘候选推荐样本, compensation_relationship: 'disjoint' }).薪资关系).toBe('薪资带无交集');
    expect(从P4招聘候选({ ...BFF招聘候选推荐样本, compensation_relationship: 'unknown' }).薪资关系).toBe('薪资带未核对');
  });

  it('空教育/技能/摘要显示为空，null 经验不折算年数', () => {
    const card: BFF招聘候选推荐 = {
      ...BFF招聘候选推荐样本,
      experience_years: null, summary: '', skills: [], educations: [],
    };
    const view = 从P4招聘候选(card);
    expect(view.经验).toBe('');
    expect(view.摘要).toBe('');
    expect(view.技能).toEqual([]);
    expect(view.教育).toEqual([]);
  });

  it('多段教育逐行映射：null 学校/专业显示 未披露，学历保留，起止只由 start/end_month 推出', () => {
    const card: BFF招聘候选推荐 = {
      ...BFF招聘候选推荐样本,
      educations: [
        { institution: null, major: null, degree: '硕士', start_month: '2019-09', end_month: null },
        { institution: '复旦大学', major: '计算机科学', degree: '本科', start_month: '2015-09', end_month: '2019-06' },
      ],
    };
    expect(从P4招聘候选(card).教育).toEqual([
      { 学校: '未披露', 专业: '未披露', 学历: '硕士', 起止: '2019.09—至今' },
      { 学校: '复旦大学', 专业: '计算机科学', 学历: '本科', 起止: '2015.09—2019.06' },
    ]);
  });

  it('空代号显示 匿名候选，头像字取显示别名的首个 Unicode 码点', () => {
    const 空 = 从P4招聘候选({ ...BFF招聘候选推荐样本, candidate_alias: '   ' });
    expect(空.代号).toBe('匿名候选');
    expect(空.头像字).toBe('匿');
    const 星徽 = 从P4招聘候选({ ...BFF招聘候选推荐样本, candidate_alias: '𝕏甲' });
    expect(星徽.头像字).toBe('𝕏');
  });

  it('收藏/淘汰标记与淘汰原因 wire 码、委托摘要原样透传', () => {
    const card: BFF招聘候选推荐 = {
      ...BFF招聘候选推荐样本,
      favorite: true,
      rejected: true,
      rejection_reason: 'direction_mismatch',
      delegation: { delegation_id: 'del_r1', state: 'evaluating', case_id: null },
    };
    const view = 从P4招聘候选(card);
    expect(view.收藏).toBe(true);
    expect(view.已淘汰).toBe(true);
    expect(view.淘汰原因).toBe('direction_mismatch');
    expect(view.委托).toEqual({ delegation_id: 'del_r1', state: 'evaluating', case_id: null });
  });
});

describe('淘汰原因 文案与反向码', () => {
  it('四种淘汰原因文案按闭合表输出', () => {
    expect(P4淘汰原因文案('experience_insufficient')).toBe('年限不足');
    expect(P4淘汰原因文案('direction_mismatch')).toBe('方向不符');
    expect(P4淘汰原因文案('primary_stack_mismatch')).toBe('主栈不符');
    expect(P4淘汰原因文案('other')).toBe('其他');
  });

  it('反向码把四条文案一一映射回 wire 码', () => {
    expect(P4淘汰原因码('年限不足')).toBe('experience_insufficient');
    expect(P4淘汰原因码('方向不符')).toBe('direction_mismatch');
    expect(P4淘汰原因码('主栈不符')).toBe('primary_stack_mismatch');
    expect(P4淘汰原因码('其他')).toBe('other');
  });

  it('表外文案当面抛错，不静默落 other', () => {
    expect(() => P4淘汰原因码('不合适')).toThrow();
  });
});

describe('判断P4招聘组织前提', () => {
  it('missing owner snapshot is unknown, not unverified', () => {
    expect(判断P4招聘组织前提(undefined)).toEqual({ kind: 'unknown' });
  });

  it.each([
    [{ ...BFF岗位样本, hiring_organization_verification_status: 'unverified' }, 'unverified'],
    [{ ...BFF岗位样本, hiring_organization_verification_status: 'verified', hiring_organization_ref: undefined }, 'missing_ref'],
    [{ ...BFF岗位样本, hiring_organization_verification_status: 'verified', hiring_organization_ref: '   ' }, 'missing_ref'],
  ] as const)('blocks only from owner Job evidence', (job, reason) => {
    expect(判断P4招聘组织前提(job)).toEqual({ kind: 'blocked', reason });
  });

  it('requires verified plus a non-blank opaque ref', () => {
    expect(判断P4招聘组织前提({
      ...BFF岗位样本,
      hiring_organization_verification_status: 'verified',
      hiring_organization_ref: 'org_9',
    })).toEqual({ kind: 'ready', organizationRef: 'org_9' });
  });
});

describe('映射P4委托展示', () => {
  it.each([
    ['accepted', '已提交给 AI，等待处理', true, null],
    ['evaluating', 'AI 正在评估', true, null],
    ['case_started', '已创建真实在谈', false, 'case_server_1'],
    ['needs_user', '需要你处理', false, null],
    ['refused', '本次未能继续', false, null],
    ['failed', '本次处理未完成', false, null],
  ] as const)('%s maps to closed copy and navigation', (state, copy, inProgress, caseId) => {
    expect(映射P4委托展示({
      delegation_id: 'del_1',
      state,
      case_id: state === 'case_started' ? 'case_server_1' : null,
    }, null)).toEqual({ state, copy, reason: null, inProgress, caseId });
  });

  it('case_started with a blank case_id exposes no navigation', () => {
    expect(映射P4委托展示({
      delegation_id: 'del_1', state: 'case_started', case_id: '   ',
    }, null)?.caseId).toBeNull();
  });

  it('null summary stays null', () => {
    expect(映射P4委托展示(null, null)).toBeNull();
  });

  it('uses a refusal reason only from the same authoritative receipt', () => {
    const summary = { delegation_id: 'del_1', state: 'refused' as const, case_id: null };
    const receipt = {
      ...BFF招聘委托回执样本,
      delegation_id: 'del_1', state: 'refused' as const,
      refusal_code: 'active_case_quota_reached' as const, case_id: null,
    };
    expect(映射P4委托展示(summary, receipt)?.reason)
      .toBe('当前在谈已达到上限，请先处理已有在谈');
    expect(映射P4委托展示(summary, { ...receipt, delegation_id: 'del_other' })?.reason)
      .toBeNull();
  });
});

describe('P4委托状态文案', () => {
  it('pins the shared closed copy accessor directly', () => {
    expect(P4委托状态文案('accepted')).toBe('已提交给 AI，等待处理');
    expect(P4委托状态文案('failed')).toBe('本次处理未完成');
    expect(P4拒绝原因文案('active_case_quota_reached')).toBe('当前在谈已达到上限，请先处理已有在谈');
  });
});
