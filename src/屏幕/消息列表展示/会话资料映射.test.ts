// 会话资料映射（Task 2 契约A）：P5详情 → 真人对方资料 的纯映射反例 ——
// 两角色、hiring≠publisher、匿名/已披露、缺图/缺名、失败缺值互不串联。
// 招聘企业 = 同 Case jobDetail 的用人企业 display_name（代招不取发布方/猎头）；
// 候选企业 = 调用方本轮解析的发布企业名（绝不拿用人企业顶替）。
// 匿名 candidateIdentity 不返回 name/avatar；disclosed 两字段独立，有图无名仍是图。
// 取姓名首字 只从真实姓名取首个 Unicode 码点，缺名为「·」，不从 alias/文案推导。

import { describe, expect, it } from 'vitest';
import { 从P5详情取对方资料, 取姓名首字 } from './会话资料映射';
import type { 真人对方资料 } from './会话资料映射';
import type { P5详情 } from '../../数据/招聘数据源/MatchCase';
import { 候选详情DTO, 招聘详情DTO, 状态 } from '../P5/MatchCase详情.测试辅助';
import { BFF安全职位资料样本, BFF公司摘要样本 } from '../../测试/展示资料样本';

const 用人企业摘要 = { ...BFF公司摘要样本, display_name: '云衢科技' };

function 招聘详情(覆盖: { 身份?: unknown; jobDetail?: unknown } = {}): P5详情 {
  return {
    ...招聘详情DTO({ 别名: 'C-07' }),
    state: 状态({ caseId: 'mc_1' }),
    jobDetail: (覆盖.jobDetail !== undefined
      ? 覆盖.jobDetail
      : { ...BFF安全职位资料样本, organization: 用人企业摘要 }),
    candidateIdentity: 覆盖.身份 ?? {
      state: 'disclosed' as const, name: '陈屿',
      avatar_url: 'https://cdn.example.com/chen-yu.png', disclosed_at: '2026-09-01T00:00:00Z',
    },
  } as P5详情;
}

function 候选详情(覆盖: { jobDetail?: unknown } = {}): P5详情 {
  return {
    ...候选详情DTO(),
    state: 状态({ caseId: 'mc_1' }),
    jobDetail: 覆盖.jobDetail ?? BFF安全职位资料样本,
  } as P5详情;
}

describe('从P5详情取对方资料 · 招聘端（candidateIdentity + 用人企业 · 投递岗位）', () => {
  it('disclosed：姓名/头像取身份，企业 = jobDetail 用人企业 display_name，职位 = 冻结 context 岗位；代招发布方不得顶替用人企业', () => {
    const 资料 = 从P5详情取对方资料(招聘详情(), 'recruiter', '星桥猎头');
    expect(资料).toEqual({
      姓名: '陈屿',
      头像URL: 'https://cdn.example.com/chen-yu.png',
      企业: '云衢科技',
      职位: '平台工程师',
    } satisfies 真人对方资料);
  });

  it('匿名：姓名/头像恒 null（不返回 Case 代号充真名）；副标题坐标照常给出', () => {
    const 资料 = 从P5详情取对方资料(招聘详情({
      身份: { state: 'anonymous', name: null, avatar_url: null, disclosed_at: null },
    }), 'recruiter', null);
    expect(资料.姓名).toBeNull();
    expect(资料.头像URL).toBeNull();
    expect(资料.企业).toBe('云衢科技');
    expect(资料.职位).toBe('平台工程师');
  });

  it('disclosed 缺名有图：姓名 null、头像保留（两字段独立）；空白姓名同样按缺名处理', () => {
    const 缺名有图 = 从P5详情取对方资料(招聘详情({
      身份: { state: 'disclosed', name: null, avatar_url: 'https://cdn.example.com/a.png', disclosed_at: null },
    }), 'recruiter', null);
    expect(缺名有图.姓名).toBeNull();
    expect(缺名有图.头像URL).toBe('https://cdn.example.com/a.png');
    const 空白名 = 从P5详情取对方资料(招聘详情({
      身份: { state: 'disclosed', name: '   ', avatar_url: null, disclosed_at: null },
    }), 'recruiter', null);
    expect(空白名.姓名).toBeNull();
  });

  it('缺企业/缺岗位互不串联：jobDetail 缺席或 organization/display_name 为空 → 企业 null；冻结岗位缺题 → 职位 null', () => {
    expect(从P5详情取对方资料(招聘详情({ jobDetail: null }), 'recruiter', null).企业).toBeNull();
    expect(从P5详情取对方资料(招聘详情({
      jobDetail: { ...BFF安全职位资料样本, organization: null },
    }), 'recruiter', null).企业).toBeNull();
    expect(从P5详情取对方资料(招聘详情({
      jobDetail: { ...BFF安全职位资料样本, organization: { ...用人企业摘要, display_name: '  ' } },
    }), 'recruiter', null).企业).toBeNull();
    const 缺题 = {
      ...招聘详情(),
      context: { candidateAlias: 'C-07', job: { jobId: 'job_1', job: { title: '', location: '上海', publicSalaryRange: '', requiredSkills: [] } } },
    } as P5详情;
    expect(从P5详情取对方资料(缺题, 'recruiter', null).职位).toBeNull();
  });
});

describe('从P5详情取对方资料 · 候选端（publisher_profile + 发布企业 · 职务）', () => {
  it('姓名/头像/职务取 jobDetail.publisher_profile，企业 = 本轮解析的发布企业名；用人企业（jobDetail.organization）不得顶替发布方', () => {
    const 资料 = 从P5详情取对方资料(候选详情(), 'candidate', '星桥猎头');
    expect(资料).toEqual({
      姓名: '林澈',
      头像URL: null,
      企业: '星桥猎头', // 发布方；jobDetail.organization 的「云衢科技」是用人企业，绝不混用
      职位: '招聘负责人',
    } satisfies 真人对方资料);
    expect(资料.企业).not.toBe(BFF公司摘要样本.display_name);
  });

  it('发布人档案缺席：姓名/头像/职务 null；发布企业名缺省同样 null，不互相顶替', () => {
    const 资料 = 从P5详情取对方资料(候选详情({
      jobDetail: { ...BFF安全职位资料样本, publisher_profile: null },
    }), 'candidate', null);
    expect(资料.姓名).toBeNull();
    expect(资料.头像URL).toBeNull();
    expect(资料.职位).toBeNull();
    expect(资料.企业).toBeNull();
  });

  it('发布企业名空白按 null 处理', () => {
    expect(从P5详情取对方资料(候选详情(), 'candidate', '  ').企业).toBeNull();
  });
});

describe('取姓名首字', () => {
  it('真实姓名 trim 后首个 Unicode 码点；空白/null/空串都是「·」；emoji 不拆代理对', () => {
    expect(取姓名首字('陈屿')).toBe('陈');
    expect(取姓名首字('  李慕白  ')).toBe('李');
    expect(取姓名首字('')).toBe('·');
    expect(取姓名首字('   ')).toBe('·');
    expect(取姓名首字(null)).toBe('·');
    // 契约：Array.from(trim)[0] ?? '·' —— 星形 emoji 是代理对，取首个码点不拆成半个
    expect(取姓名首字('🖥️运维')).toBe('🖥');
  });
});
