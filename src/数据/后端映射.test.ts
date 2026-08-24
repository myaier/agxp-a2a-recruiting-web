import { describe, expect, it } from 'vitest';
import { 从BFF简历, 精确目录ID, 转资料写入, 从BFF岗位, 转岗位创建, 转意向写入 } from './后端映射';
import { BFF意向样本, BFF岗位样本, 页面岗位样本 } from '../测试/BFF样本';

describe('候选人后端映射', () => {
  it('完整映射 profile 并保留四类条目的真实 ID', () => {
    const 页面 = 从BFF简历({
      profile: { real_name: '沈亦舟', work_start_year: 2021, status: 'employed', current_education: null, graduation_year: null, gender: 'male', birth_year: 1998, birth_month: 6 },
      profile_revision: 2, summary: '优势', summary_revision: 1, skills: ['TypeScript'], skills_revision: 3,
      experiences: [{ id: 'exp_1', company: '云衢', industry: { id: 'tax_i', display_name: '互联网' }, title: '工程师', start_month: '2021-01', end_month: null, description: '平台', hidden: true, internship: false, revision: 4, projects: [] }],
      educations: [{ id: 'edu_1', institution: { id: 'ins_1', display_name: '复旦大学' }, degree: '本科', major: { id: 'tax_m', display_name: '计算机科学' }, start_month: '2017-09', end_month: '2021-06', revision: 2 }],
      certificates: [{ id: 'cert_1', name: 'PMP', year: 2024, revision: 1 }], aggregate_revision: 9,
    });
    expect(页面.基本信息).toMatchObject({ 真名: '沈亦舟', 开始工作年: '2021', 身份: '在职', 性别: '男', 出生年: '1998', 出生月: '6' });
    expect(页面.经历[0].编号).toBe('exp_1');
    expect(页面.教育[0].编号).toBe('edu_1');
    expect(页面.证书[0].编号).toBe('cert_1');
    expect(页面.服务端快照.aggregate_revision).toBe(9);
  });

  it('把页面 profile 转成闭合后端 body', () => {
    expect(转资料写入({ 真名: '沈亦舟', 开始工作年: '2021', 身份: '离职', 性别: '男', 出生年: '1998', 出生月: '6' }))
      .toEqual({ real_name: '沈亦舟', work_start_year: 2021, status: 'unemployed', current_education: null, graduation_year: null, gender: 'male', birth_year: 1998, birth_month: 6 });
  });

  it('目录显示名必须唯一精确匹配', () => {
    const items = [{ id: 'tax_1', display_name: '产品经理' }];
    expect(精确目录ID(items, '产品经理', '职位类别')).toBe('tax_1');
    expect(() => 精确目录ID(items, '产品', '职位类别')).toThrow('无法唯一匹配职位类别：产品');
  });

  it('把后端岗位映射为现有页面模型', () => {
    expect(从BFF岗位(BFF岗位样本, { 加分关键词: ['课程项目'], 实习转正: true })).toMatchObject({
      编号: 'job_1', 名称: 'AI 产品实习生', 城市: '上海', 办公方式: '混合',
      招聘类型: '实习生', 职位类别: '产品经理', 职位关键词: ['Python'],
      加分关键词: ['课程项目'], 实习转正: true, 状态: '在招', 在谈数: 0,
    });
  });

  it('职位创建只发送 BFF 支持字段', () => {
    const 目录 = {
      职位类别: [{ id: 'tax_product', display_name: '产品经理' }],
      地点: [{ id: 'loc_shanghai', display_name: '上海' }],
      行业: [], 院校: [], 专业: [],
    };
    const body = 转岗位创建(页面岗位样本, 目录, { 公司: '云衢科技' });
    expect(body).toMatchObject({
      publisher_mode: 'direct', hiring_organization_claim: { display_name: '云衢科技', legal_name: null },
      title: 页面岗位样本.名称, category_id: 'tax_product', location_id: 'loc_shanghai',
      keywords: 页面岗位样本.职位关键词, private_screening_preferences: 页面岗位样本.筛选要求,
    });
    expect(body).not.toHaveProperty('加分关键词');
    expect(body).not.toHaveProperty('实习转正');
  });

  it('已加载的校园/实习意向在用户没切招聘类型时保留原类型', () => {
    const 草稿 = {
      编辑编号: BFF意向样本.intention_id, 求职类型: '全职' as const, 工作城市: '上海', 期望职位: '产品经理',
      感兴趣城市们: [], 薪资下限: 10, 薪资上限: 20, 期望行业们: [],
      求职类型已改: false, 后端招聘类型: 'internship' as const,
    };
    const context = {
      原始: BFF意向样本,
      办公方式: ['混合'],
      目录: { 职位类别: [{ id: 'tax_product', display_name: '产品经理' }], 地点: [{ id: 'loc_shanghai', display_name: '上海' }], 行业: [], 院校: [], 专业: [] },
    };
    expect(转意向写入(草稿, context).recruitment_type)
      .toBe('internship');
  });
});