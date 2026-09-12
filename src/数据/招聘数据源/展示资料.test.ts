// 展示资料域 decoder 测试：release/0.2.5 展示字段的严格解码纪律 ——
// exact key set（缺键/多键/显式 undefined 拒绝）、闭集枚举、integer 不收小数、
// 合法 null / [] / 0 / false 原样保留区分、anonymous 身份夹带姓名拒绝、
// company_size/funding_stage/experience_requirement 开放 string 不套闭集。
// 外层可空成员由调用方分支：四个导出接非空对象，null/undefined 一律契约漂移。

import { describe, expect, it } from 'vitest';
import {
  BFF公司摘要样本,
  BFF安全职位资料样本,
  BFF候选身份披露样本,
  BFF候选在线简历样本,
} from '../../测试/展示资料样本';
import { 解候选身份, 解候选在线简历, 解公司摘要, 解职位资料 } from './展示资料';

const 契约漂移 = { code: 'invalid_response' };

describe('解公司摘要', () => {
  it('完整六键样本逐字段原样解码', () => {
    expect(解公司摘要(BFF公司摘要样本)).toEqual(BFF公司摘要样本);
  });

  it('claim-only 档（全 null 成员）合法保留', () => {
    const 摘要 = {
      organization_id: null,
      display_name: '云衢科技',
      industry: null,
      company_size: null,
      funding_stage: null,
      logo: null,
    };
    expect(解公司摘要(摘要)).toEqual(摘要);
  });

  it('company_size / funding_stage 是开放 string：表外码原样保留，不强转枚举', () => {
    expect(解公司摘要({ ...BFF公司摘要样本, company_size: '约 800 人', funding_stage: 'pre_ipo' }))
      .toMatchObject({ company_size: '约 800 人', funding_stage: 'pre_ipo' });
  });

  it.each([
    ['缺 organization_id', 'organization_id'],
    ['缺 display_name', 'display_name'],
    ['缺 industry', 'industry'],
    ['缺 company_size', 'company_size'],
    ['缺 funding_stage', 'funding_stage'],
    ['缺 logo', 'logo'],
  ] as const)('%s按契约漂移拒绝', (_label, 键) => {
    const { [键]: _省略, ...缺键 } = BFF公司摘要样本;
    expect(() => 解公司摘要(缺键)).toThrowError(expect.objectContaining(契约漂移));
  });

  it('多出未知键、显式 undefined 值都拒绝', () => {
    expect(() => 解公司摘要({ ...BFF公司摘要样本, legal_name: '上海云衢' })).toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解公司摘要({ ...BFF公司摘要样本, company_size: undefined })).toThrowError(expect.objectContaining(契约漂移));
  });

  it('industry / logo 的嵌套合同不合法即拒绝', () => {
    expect(() => 解公司摘要({ ...BFF公司摘要样本, industry: { id: 'tax_x' } })).toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解公司摘要({ ...BFF公司摘要样本, logo: { ...BFF公司摘要样本.logo, width: 0 } })).toThrowError(expect.objectContaining(契约漂移));
  });

  it('外层 null / undefined / 非对象都拒绝：可空由调用方分支', () => {
    expect(() => 解公司摘要(null)).toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解公司摘要(undefined)).toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解公司摘要('org')).toThrowError(expect.objectContaining(契约漂移));
  });
});

describe('解职位资料', () => {
  it('完整 25 键样本逐字段原样解码，false 与 [] 原样保留', () => {
    expect(解职位资料(BFF安全职位资料样本)).toEqual(BFF安全职位资料样本);
  });

  it('全 null 档合法：每个成员都允许显式 null', () => {
    const 全空 = {
      title: null, description: null, requirements: null, recruitment_type: null,
      category: null, location: null, office_location: null, workplace_mode: null,
      salary_lower: null, salary_upper: null, salary_period: null,
      annual_salary_months: null, campus_cohort: null, internship_months: null,
      onsite_days_per_week: null, experience_requirement: null, education_requirement: null,
      hard_requirements: null, structured_requirements_confirmed: null, keywords: null,
      organization: null, company_intro: null, office_address: null,
      benefit_codes: null, publisher_profile: null,
    };
    expect(解职位资料(全空)).toEqual(全空);
  });

  it('枚举沿 CandidateJob：null 合法，枚举外拒绝', () => {
    expect(() => 解职位资料({ ...BFF安全职位资料样本, recruitment_type: 'contract' })).toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解职位资料({ ...BFF安全职位资料样本, workplace_mode: 'anywhere' })).toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解职位资料({ ...BFF安全职位资料样本, salary_period: 'year' })).toThrowError(expect.objectContaining(契约漂移));
  });

  it('experience_requirement / education_requirement 是开放 string：表外码原样保留', () => {
    expect(解职位资料({ ...BFF安全职位资料样本, experience_requirement: '十年以上' }))
      .toMatchObject({ experience_requirement: '十年以上' });
  });

  it.each([
    ['salary_lower 小数', { salary_lower: 300.5 }],
    ['salary_upper 非数字', { salary_upper: '500' }],
    ['annual_salary_months 小数', { annual_salary_months: 13.5 }],
    ['structured_requirements_confirmed 字符串', { structured_requirements_confirmed: 'false' }],
    ['keywords 含非串', { keywords: ['Python', 3] }],
    ['benefit_codes 非数组', { benefit_codes: 'social_insurance_housing_fund' }],
  ] as const)('%s按契约漂移拒绝', (_label, 覆盖) => {
    expect(() => 解职位资料({ ...BFF安全职位资料样本, ...覆盖 })).toThrowError(expect.objectContaining(契约漂移));
  });

  it('0 与 false 是合法值，不得与 null 互换', () => {
    const 解出 = 解职位资料({
      ...BFF安全职位资料样本,
      salary_lower: 0,
      structured_requirements_confirmed: false,
      keywords: [],
      benefit_codes: [],
    });
    expect(解出.salary_lower).toBe(0);
    expect(解出.structured_requirements_confirmed).toBe(false);
    expect(解出.keywords).toEqual([]);
    expect(解出.benefit_codes).toEqual([]);
  });

  it('缺任一键与多出未知键都拒绝', () => {
    const { company_intro: _省略, ...缺键 } = BFF安全职位资料样本;
    expect(() => 解职位资料(缺键)).toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解职位资料({ ...BFF安全职位资料样本, hiring_organization_claim: {} })).toThrowError(expect.objectContaining(契约漂移));
  });

  it('嵌套 organization / hard_requirements / publisher_profile 不合法即拒绝', () => {
    expect(() => 解职位资料({ ...BFF安全职位资料样本, organization: { display_name: '云衢' } }))
      .toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解职位资料({
      ...BFF安全职位资料样本,
      hard_requirements: { alternate_weekend_work: 'unknown', outsourcing_only: 'unknown', onsite_only: 'unknown' },
    })).toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解职位资料({
      ...BFF安全职位资料样本,
      publisher_profile: { public_name: '林澈', title: '招聘负责人', personal_verification_status: 'pending', avatar_url: null },
    })).toThrowError(expect.objectContaining(契约漂移));
  });
});

describe('解候选在线简历', () => {
  it('完整七键样本逐字段原样解码', () => {
    expect(解候选在线简历(BFF候选在线简历样本)).toEqual(BFF候选在线简历样本);
  });

  it('全 null 与空数组档合法且互相区分', () => {
    const 空 = {
      summary: null,
      self_description: null,
      skills: [],
      experiences: null,
      educations: [],
      expectation: null,
      compensation_relationship: 'unknown' as const,
    };
    expect(解候选在线简历(空)).toEqual(空);
    expect(解候选在线简历(空).skills).toEqual([]);
    expect(解候选在线简历({ ...空, skills: null }).skills).toBeNull();
  });

  it('compensation_relationship 是非空闭集：null 与表外码都拒绝', () => {
    expect(() => 解候选在线简历({ ...BFF候选在线简历样本, compensation_relationship: 'equal' }))
      .toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解候选在线简历({ ...BFF候选在线简历样本, compensation_relationship: null }))
      .toThrowError(expect.objectContaining(契约漂移));
  });

  it('summary 复用七键摘要解码：缺键/未知键按契约漂移拒绝', () => {
    expect(() => 解候选在线简历({ ...BFF候选在线简历样本, summary: { gender: 'female' } }))
      .toThrowError(expect.objectContaining(契约漂移));
  });

  it('经历条目八键闭合：缺 internship、缺 projects、project 缺 result 都拒绝', () => {
    const { internship: _省略, ...缺实习 } = BFF候选在线简历样本.experiences![0];
    expect(() => 解候选在线简历({ ...BFF候选在线简历样本, experiences: [缺实习] }))
      .toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解候选在线简历({
      ...BFF候选在线简历样本,
      experiences: [{ ...BFF候选在线简历样本.experiences![0], projects: [{ name: 'x', role: 'y' }] }],
    })).toThrowError(expect.objectContaining(契约漂移));
  });

  it('internship false 与 0/[] 原样保留，不折算成 null', () => {
    const 解出 = 解候选在线简历({
      ...BFF候选在线简历样本,
      experiences: [{ ...BFF候选在线简历样本.experiences![0], internship: false, projects: [] }],
    });
    expect(解出.experiences![0].internship).toBe(false);
    expect(解出.experiences![0].projects).toEqual([]);
  });

  it('expectation 嵌套闭合：locations 引用不合法或 workplace_modes 表外码都拒绝', () => {
    expect(() => 解候选在线简历({
      ...BFF候选在线简历样本,
      expectation: { ...BFF候选在线简历样本.expectation!, locations: [{ id: 'loc_x' }] },
    })).toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解候选在线简历({
      ...BFF候选在线简历样本,
      expectation: { ...BFF候选在线简历样本.expectation!, workplace_modes: ['anywhere'] },
    })).toThrowError(expect.objectContaining(契约漂移));
  });

  it('缺任一键与多出未知键都拒绝；外层 null/undefined 由调用方分支', () => {
    const { expectation: _省略, ...缺键 } = BFF候选在线简历样本;
    expect(() => 解候选在线简历(缺键)).toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解候选在线简历({ ...BFF候选在线简历样本, salary_lower: 300 }))
      .toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解候选在线简历(null)).toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解候选在线简历(undefined)).toThrowError(expect.objectContaining(契约漂移));
  });
});

describe('解候选身份', () => {
  it('disclosed 完整档逐字段原样解码', () => {
    expect(解候选身份(BFF候选身份披露样本)).toEqual(BFF候选身份披露样本);
  });

  it('anonymous 恒三 null 合法', () => {
    expect(解候选身份({ state: 'anonymous', name: null, avatar_url: null, disclosed_at: null }))
      .toEqual({ state: 'anonymous', name: null, avatar_url: null, disclosed_at: null });
  });

  it('anonymous 夹带姓名 / 头像 / 时间都拒绝', () => {
    for (const 夹带 of [
      { name: '沈亦舟' },
      { avatar_url: 'https://cdn.example.com/a.png' },
      { disclosed_at: '2026-08-24T00:00:00Z' },
    ]) {
      expect(() => 解候选身份({ state: 'anonymous', name: null, avatar_url: null, disclosed_at: null, ...夹带 }))
        .toThrowError(expect.objectContaining(契约漂移));
    }
  });

  it('disclosed 缺值不降级：三值皆 null 合法且 state 保持 disclosed', () => {
    expect(解候选身份({ state: 'disclosed', name: null, avatar_url: null, disclosed_at: null }))
      .toEqual({ state: 'disclosed', name: null, avatar_url: null, disclosed_at: null });
  });

  it('disclosed_at 沿 date-time 合同：非 RFC3339 拒绝', () => {
    expect(() => 解候选身份({ ...BFF候选身份披露样本, disclosed_at: '2026-08-24 00:00:00' }))
      .toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解候选身份({ ...BFF候选身份披露样本, disclosed_at: '昨天' }))
      .toThrowError(expect.objectContaining(契约漂移));
  });

  it('缺键、多键、state 枚举外都拒绝', () => {
    const { name: _省略, ...缺键 } = BFF候选身份披露样本;
    expect(() => 解候选身份(缺键)).toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解候选身份({ ...BFF候选身份披露样本, subject_id: 'sub_9' }))
      .toThrowError(expect.objectContaining(契约漂移));
    expect(() => 解候选身份({ ...BFF候选身份披露样本, state: 'hidden' }))
      .toThrowError(expect.objectContaining(契约漂移));
  });
});