// 代谈结果文案 表测（S0–S3 展示统一 Task 1；字典权威 = 批准 Spec 附录 A.2/A.4）：
//   · 三 decision、四 evaluation.state、13 维度 × 三组、五特殊证据 code；
//   · 七 outcome、四附加终局 code、未知维度/未知码安全兜底（原词绝不进视图）；
//   · 六种完整句各出现一次且无重复「通过/待确认」后缀；技术失败（agent_failed）无成功勾。
// 期望值全部用本文件字面量钉死，实现漂移即红；同一输入恒同一输出（纯函数，不读时间/Context）。

import { describe, expect, it } from 'vitest';
import {
  代谈终局文案,
  公开初评决定文案,
  公开初评过程文案,
  初评证据文案,
} from './代谈结果文案';

describe('公开初评决定文案（Spec A.2.1 evaluation.decision 三闭词）', () => {
  it.each([
    ['fit', '公开初评匹配'],
    ['not_fit', '公开初评不匹配'],
    ['uncertain', '公开初评待确认'],
  ] as const)('decision=%s → %s', (decision, 期望) => {
    expect(公开初评决定文案(decision)).toBe(期望);
  });

  it('未知或缺失 decision 给安全兜底「初评结果暂未提供」，原词不透出', () => {
    expect(公开初评决定文案(null)).toBe('初评结果暂未提供');
    expect(公开初评决定文案('sort_of_fit')).toBe('初评结果暂未提供');
    expect(公开初评决定文案('sort_of_fit')).not.toContain('sort_of_fit');
  });
});

describe('公开初评过程文案（Spec A.2.1 evaluation.state 四闭词）', () => {
  it.each([
    ['pending', '初评中'],
    ['completed', '初评完成'],
    ['failed', '初评未完成'],
    ['expired', '初评超时'],
  ] as const)('state=%s → %s', (state, 期望) => {
    expect(公开初评过程文案(state)).toBe(期望);
  });

  it('未知或缺失 state 给安全兜底「初评状态暂未提供」，原词不透出', () => {
    expect(公开初评过程文案(null)).toBe('初评状态暂未提供');
    expect(公开初评过程文案('halfway')).toBe('初评状态暂未提供');
    expect(公开初评过程文案('halfway')).not.toContain('halfway');
  });
});

describe('初评证据文案（Spec A.4 维度/code 字典）', () => {
  // 13 个维度闭词的期望中文逐行钉死（不复用实现的表，期望与实现各算各的）
  const 维度期望: readonly (readonly [string, string])[] = [
    ['recruitment_type', '招聘类型'],
    ['job_category', '职位方向'],
    ['location', '工作地点'],
    ['workplace_mode', '办公方式'],
    ['compensation', '薪资条件'],
    ['campus_cohort', '毕业届别'],
    ['internship_months', '实习时长'],
    ['skills', '专业技能'],
    ['experience', '工作经验'],
    ['education', '学历要求'],
    ['work_arrangement', '工作安排'],
    ['job_requirements', '岗位要求'],
    ['information', '信息完整性'],
  ];

  it('13 维度 × 三组：完整句 = 「维度：组态」，结果只由组决定（matches=通过/conflicts=不匹配/unknowns=待确认）', () => {
    for (const [维度, 中文] of 维度期望) {
      expect(初评证据文案('matches', { dimension: 维度, code: 'sample_match' }))
        .toEqual({ 项: `${中文}：匹配`, 结果: '通过' });
      expect(初评证据文案('conflicts', { dimension: 维度, code: 'sample_gap' }))
        .toEqual({ 项: `${中文}：不匹配`, 结果: '不匹配' });
      expect(初评证据文案('unknowns', { dimension: 维度, code: 'sample_unknown' }))
        .toEqual({ 项: `${中文}：待确认`, 结果: '待确认' });
    }
  });

  it('五个特殊证据 code 优先于组态：三组输入同句同果，组态不二次拼接', () => {
    const 特殊码期望: readonly (readonly [string, string, string])[] = [
      ['compensation_not_comparable', '薪资条件：暂无法比较', '待确认'],
      ['campus_cohort_unrestricted', '毕业届别：不限', '通过'],
      ['experience_requirement_unconfirmed', '经验要求：待招聘方确认', '待确认'],
      ['education_requirement_unconfirmed', '学历要求：待招聘方确认', '待确认'],
      ['insufficient_information', '信息不足，待确认', '待确认'],
    ];
    for (const [code, 句, 结果] of 特殊码期望) {
      for (const 组 of ['matches', 'conflicts', 'unknowns'] as const) {
        expect(初评证据文案(组, { dimension: 'compensation', code })).toEqual({ 项: 句, 结果 });
      }
    }
  });

  it('六种完整句各出现一次，特殊句不带「：匹配/：待确认」重复后缀', () => {
    const 句们 = [
      初评证据文案('matches', { dimension: 'recruitment_type', code: 'recruitment_type_match' }).项,
      初评证据文案('unknowns', { dimension: 'compensation', code: 'compensation_not_comparable' }).项,
      初评证据文案('unknowns', { dimension: 'campus_cohort', code: 'campus_cohort_unrestricted' }).项,
      初评证据文案('unknowns', { dimension: 'experience', code: 'experience_requirement_unconfirmed' }).项,
      初评证据文案('unknowns', { dimension: 'education', code: 'education_requirement_unconfirmed' }).项,
      初评证据文案('unknowns', { dimension: 'information', code: 'insufficient_information' }).项,
    ];
    expect(句们).toEqual([
      '招聘类型：匹配',
      '薪资条件：暂无法比较',
      '毕业届别：不限',
      '经验要求：待招聘方确认',
      '学历要求：待招聘方确认',
      '信息不足，待确认',
    ]);
    expect(new Set(句们).size).toBe(6); // 六句互不相同，各出现一次
    for (const 句 of 句们.slice(1)) {
      expect(句.endsWith('：匹配')).toBe(false);
      expect(句.endsWith('：待确认')).toBe(false);
    }
  });

  it('未知维度不透出原词：显示「其他条件」+ 组态；未知 code 原词不进句', () => {
    expect(初评证据文案('matches', { dimension: 'city', code: 'city_match' }))
      .toEqual({ 项: '其他条件：匹配', 结果: '通过' });
    expect(初评证据文案('conflicts', { dimension: 'city', code: 'city_gap' }).项).toBe('其他条件：不匹配');
    const 未知 = 初评证据文案('unknowns', { dimension: 'mystery_dimension', code: 'mystery_code' });
    expect(未知.项).toBe('其他条件：待确认');
    expect(JSON.stringify(未知)).not.toContain('mystery_dimension');
    expect(JSON.stringify(未知)).not.toContain('mystery_code');
  });

  it('同一输入恒同一输出（纯函数）：连两次调用结果相等', () => {
    const 输入 = { dimension: 'compensation', code: 'compensation_not_comparable' } as const;
    expect(初评证据文案('unknowns', 输入)).toEqual(初评证据文案('unknowns', 输入));
  });
});

describe('代谈终局文案（Spec A.2.1 outcome 表 + 附加 code 闭词）', () => {
  it.each([
    ['semantic_not_fit', '不匹配', '本阶段评估不匹配，代谈已结束', '提醒'],
    ['policy_rejected', '未通过', '条件核对未通过', '提醒'],
    ['semantic_uncertain_stop', '信息不足', '信息不足，未能确认条件', '提醒'],
    ['agent_failed', '筛选未完成', '自动筛选未完成，不表示候选人不匹配', '提醒'],
    ['response_timeout', '逾期结束', '逾期未回应，已自动结束', '提醒'],
    ['user_ended', '已结束', '本次代谈已结束', '中性'],
    ['party_account_deleted', '已结束', '相关账号已注销，本次代谈已结束', '中性'],
  ] as const)('outcome=%s → 状态文「%s」/ 原因「%s」/ 色调 %s', (outcome, 状态文, 原因, 色调) => {
    expect(代谈终局文案(outcome, null)).toEqual({ 状态文, 原因, 色调 });
  });

  it('技术失败无成功勾：agent_failed 不是「成功」色调，原因注明不表示候选人不匹配', () => {
    const 文 = 代谈终局文案('agent_failed', null);
    expect(文.色调).not.toBe('成功');
    expect(文.原因).toContain('不表示候选人不匹配');
    expect(文.状态文).toBe('筛选未完成');
  });

  it('outcome 缺失或未知：已结束 / 结束原因暂未提供 / 中性，原词不透出', () => {
    expect(代谈终局文案(null, null)).toEqual({
      状态文: '已结束', 原因: '结束原因暂未提供', 色调: '中性',
    });
    const 未知 = 代谈终局文案('神秘结局', null);
    expect(未知).toEqual({ 状态文: '已结束', 原因: '结束原因暂未提供', 色调: '中性' });
    expect(JSON.stringify(未知)).not.toContain('神秘结局');
  });

  it('四个附加终局 code：已知安全码细化原因；与 outcome 同义时保留完整句不缩水', () => {
    // 细因保留：policy_rejected 有安全 code 时细化原因（known policy 细因不丢）
    expect(代谈终局文案('policy_rejected', 'compensation_incompatible').原因).toBe('薪资条件不匹配');
    expect(代谈终局文案('policy_rejected', 'hard_exclusion').原因).toBe('必要条件不匹配');
    // 同义去重：码义已含在 outcome 说明句里时，保留完整句，不替换成裸码词
    expect(代谈终局文案('agent_failed', 'screening_incomplete')).toEqual({
      状态文: '筛选未完成', 原因: '自动筛选未完成，不表示候选人不匹配', 色调: '提醒',
    });
    expect(代谈终局文案('response_timeout', 'human_response_timeout')).toEqual({
      状态文: '逾期结束', 原因: '逾期未回应，已自动结束', 色调: '提醒',
    });
  });

  it('未知 code 绝不原词兜底：回落 outcome 本句；缺省 outcome 仍可用已知安全码细化', () => {
    const 未知码 = 代谈终局文案('policy_rejected', ' threshold>42 ');
    expect(未知码.状态文).toBe('未通过');
    expect(未知码.原因).toBe('条件核对未通过');
    expect(JSON.stringify(未知码)).not.toContain('threshold');
    expect(代谈终局文案(null, 'compensation_incompatible')).toEqual({
      状态文: '已结束', 原因: '薪资条件不匹配', 色调: '中性',
    });
  });
});
