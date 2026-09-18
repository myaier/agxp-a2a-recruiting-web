// 匹配解释展示映射测试：C1 闭表的固定中文说明逐字锁定、Spec §4 四态状态文字与六维
// 固定中文名，以及 C3 展示模型的行推导 —— 只有已解码解释才能产出六行；解释缺席
// （显式 null）返回 null 绝不伪造六条假状态；0 分与 null 分、有限旧依据、三种上下文
// 都原样保留，不从分数大小、旧依据或正文推断状态。

import { describe, expect, it } from 'vitest';
import { 解匹配解释 } from './招聘数据源/匹配解释';
import {
  建匹配分析模型,
  匹配分析行们,
  匹配原因说明,
  匹配解释行们,
  匹配状态文字,
  维度中文名,
  type 匹配分析模型,
} from './匹配解释展示映射';
import { BFF技能部分命中零分解释样本, BFF匹配解释样本 } from '../测试/BFF样本';
import type { BFF匹配解释, BFF匹配原因, BFF匹配维度 } from './BFF契约';

describe('匹配原因说明（C1 冻结闭表逐字）', () => {
  const 闭表: [BFF匹配维度, BFF匹配原因, string][] = [
    ['direction', 'job_category_missing', '岗位方向信息缺失'],
    ['direction', 'candidate_category_missing', '求职方向信息缺失'],
    ['direction', 'category_matched', '求职方向与岗位方向匹配'],
    ['direction', 'category_not_matched', '求职方向与岗位方向不匹配'],
    ['skills', 'job_keywords_missing', '岗位关键词缺失'],
    ['skills', 'candidate_skills_missing', '候选技能信息缺失'],
    ['skills', 'no_keyword_overlap', '未命中岗位关键词'],
    ['skills', 'partial_keyword_overlap', '命中部分岗位关键词'],
    ['skills', 'all_keywords_matched', '已命中全部岗位关键词'],
    ['experience', 'requirements_unconfirmed', '岗位经验要求尚未确认'],
    ['experience', 'candidate_experience_missing', '候选经验信息缺失'],
    ['experience', 'experience_met', '经验满足岗位要求'],
    ['experience', 'experience_not_met', '经验未满足岗位要求'],
    ['location', 'job_location_missing', '岗位地点信息缺失'],
    ['location', 'candidate_locations_missing', '求职地点信息缺失'],
    ['location', 'location_matched', '求职地点与岗位地点匹配'],
    ['location', 'location_not_matched', '求职地点与岗位地点不匹配'],
    ['workplace_mode', 'job_workplace_mode_missing', '岗位办公方式信息缺失'],
    ['workplace_mode', 'candidate_workplace_modes_missing', '求职办公方式信息缺失'],
    ['workplace_mode', 'workplace_mode_matched', '办公方式匹配'],
    ['workplace_mode', 'workplace_mode_not_matched', '办公方式不匹配'],
    ['compensation', 'compensation_overlap', '薪资范围匹配'],
    ['compensation', 'compensation_near_miss', '薪资范围接近'],
    ['compensation', 'compensation_disjoint', '薪资范围不匹配'],
    ['compensation', 'compensation_type_mismatch', '薪资周期不同，无法直接比较'],
    ['compensation', 'compensation_negotiable', '薪资面议，尚未核对'],
    ['compensation', 'candidate_compensation_missing', '求职薪资信息缺失'],
    ['compensation', 'job_compensation_missing', '岗位薪资信息缺失'],
    ['compensation', 'compensation_not_annualizable', '薪资缺少可比口径'],
    ['compensation', 'compensation_type_unsupported', '当前薪资类型无法比较'],
  ];

  it('全部 30 个 reason 词逐一命中固定中文说明', () => {
    for (const [维度, 原因, 说明] of 闭表) {
      expect(匹配原因说明(维度, 原因)).toBe(说明);
    }
  });

  it('跨维组合 fail closed，不输出自由文本', () => {
    expect(() => 匹配原因说明('skills', 'category_matched')).toThrow();
    expect(() => 匹配原因说明('direction', 'no_keyword_overlap')).toThrow();
    expect(() => 匹配原因说明('compensation', 'category_matched')).toThrow();
  });
});

describe('固定状态文字与维度名（Spec §4）', () => {
  it('四态状态文字与图标语义同时存在', () => {
    expect(匹配状态文字('matched')).toBe('匹配');
    expect(匹配状态文字('partially_matched')).toBe('部分匹配');
    expect(匹配状态文字('not_matched')).toBe('不匹配');
    expect(匹配状态文字('unknown')).toBe('未核对');
  });

  it('六维中文名固定：方向、技能、经验、地点、办公方式、薪资', () => {
    expect(维度中文名).toEqual({
      direction: '方向',
      skills: '技能',
      experience: '经验',
      location: '地点',
      workplace_mode: '办公方式',
      compensation: '薪资',
    });
  });
});

describe('匹配解释行们 / 匹配分析行们（C3）', () => {
  it('合法解释产出固定顺序六行，技能行带命中计数，其余行计数为 null', () => {
    const 行们 = 匹配解释行们(BFF匹配解释样本);
    expect(行们.map((行) => 行.维度)).toEqual(['方向', '技能', '经验', '地点', '办公方式', '薪资']);
    expect(行们[0]).toMatchObject({
      状态: 'matched', 状态文字: '匹配', points: 25, max_points: 25,
      说明: '求职方向与岗位方向匹配', 命中: null, 总数: null,
    });
    expect(行们[1]).toMatchObject({
      状态: 'unknown', 状态文字: '未核对', points: 0, max_points: 35,
      说明: '候选技能信息缺失', 命中: 0, 总数: 2,
    });
  });

  it('1/100 命中取整 0 分仍显示部分匹配与真实 0 分', () => {
    const 行们 = 匹配解释行们(BFF技能部分命中零分解释样本);
    expect(行们[1]).toMatchObject({
      状态: 'partially_matched',
      状态文字: '部分匹配',
      points: 0,
      max_points: 35,
      说明: '命中部分岗位关键词',
      命中: 1,
      总数: 100,
    });
  });

  it('真实 0 分解释逐行展示 0 分与真实状态，不当作缺失', () => {
    // 全维零分但状态真实（not_matched→0、skills 0/5 命中、compensation disjoint），
    // 走真实 decoder 解码，证明它是合法解释而非缺源。
    const 全零原始 = {
      schema_version: 'match-explanation.v1',
      ranking_version: 'discovery-ranking.v2',
      basis: 'batch_snapshot',
      total_points: 0,
      max_points: 100,
      dimensions: [
        { dimension: 'direction', status: 'not_matched', points: 0, max_points: 25, reason_code: 'category_not_matched' },
        { dimension: 'skills', status: 'not_matched', points: 0, max_points: 35, reason_code: 'no_keyword_overlap', matched_count: 0, required_count: 5 },
        { dimension: 'experience', status: 'not_matched', points: 0, max_points: 15, reason_code: 'experience_not_met' },
        { dimension: 'location', status: 'not_matched', points: 0, max_points: 10, reason_code: 'location_not_matched' },
        { dimension: 'workplace_mode', status: 'not_matched', points: 0, max_points: 5, reason_code: 'workplace_mode_not_matched' },
        { dimension: 'compensation', status: 'not_matched', points: 0, max_points: 10, reason_code: 'compensation_disjoint' },
      ],
    };
    const 全零 = 解匹配解释(全零原始, 0) as BFF匹配解释;
    const 行们 = 匹配解释行们(全零);
    expect(行们).toHaveLength(6);
    expect(行们.every((行) => 行.points === 0)).toBe(true);
    expect(行们[1]).toMatchObject({ 状态: 'not_matched', 状态文字: '不匹配', 命中: 0, 总数: 5 });
  });

  it('新解释 null 且旧正向依据仍在：返回 null，不返回六行假状态', () => {
    const 模型: 匹配分析模型 = {
      分数: 87,
      解释: null,
      有限依据: ['经验满足岗位要求', '求职方向与岗位方向匹配'],
      上下文: '有来源',
    };
    expect(模型.有限依据).toHaveLength(2);
    expect(匹配分析行们(模型)).toBeNull();
  });

  it('0 分与 null 分、三种上下文都原样保留，不互换', () => {
    const 零分: 匹配分析模型 = { 分数: 0, 解释: BFF技能部分命中零分解释样本, 有限依据: [], 上下文: '有来源' };
    expect(匹配分析行们(零分)).toHaveLength(6);
    const 无分无解释: 匹配分析模型 = { 分数: null, 解释: null, 有限依据: [], 上下文: '无推荐上下文' };
    expect(匹配分析行们(无分无解释)).toBeNull();
    const 原推荐不可用: 匹配分析模型 = { 分数: null, 解释: null, 有限依据: [], 上下文: '原推荐不可用' };
    expect(匹配分析行们(原推荐不可用)).toBeNull();
    const 无分有解释: 匹配分析模型 = { 分数: null, 解释: BFF匹配解释样本, 有限依据: [], 上下文: '有来源' };
    expect(匹配分析行们(无分有解释)).toHaveLength(6);
  });
});

describe('建匹配分析模型（三参数小构造器）', () => {
  it('构造结果与字面量同形：有限依据缺省为空、传入原样保留', () => {
    const 缺省 = 建匹配分析模型(87, null, '有来源');
    expect(缺省).toEqual({ 分数: 87, 解释: null, 有限依据: [], 上下文: '有来源' });
    const 带依据 = 建匹配分析模型(0, BFF技能部分命中零分解释样本, '无推荐上下文', ['经验满足岗位要求']);
    expect(带依据.有限依据).toEqual(['经验满足岗位要求']);
    expect(匹配分析行们(带依据)).toHaveLength(6);
  });
});
