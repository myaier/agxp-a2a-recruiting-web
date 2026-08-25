import { describe, expect, it } from 'vitest';
import { 从BFF简历, 精确目录ID, 转资料写入, 转经历写入, 转教育写入, 从BFF岗位, 转岗位创建, 转岗位补丁, 转意向写入, 转首次意向写入, 从BFF意向草稿 } from './后端映射';
import { BFF意向样本, BFF岗位样本, 页面岗位样本 } from '../测试/BFF样本';
import type { 意向草稿型 } from './招聘数据源类型';

/** 构造空草稿（含 Task 6 新增的 办公方式 字段），测试用展开覆盖个别字段 */
const 空草稿: 意向草稿型 = {
  编辑编号: null,
  求职类型: '全职',
  工作城市: '',
  工作城市引用: undefined,
  期望职位: '',
  职位引用: undefined,
  感兴趣城市们: [],
  感兴趣城市引用们: [],
  薪资下限: null,
  薪资上限: null,
  期望行业们: [],
  行业引用们: [],
  办公方式: [],
  后端招聘类型: null,
  求职类型已改: false,
};

/** 目录引用构造助手 */
function ref(id: string, display_name: string) {
  return { id, display_name };
}

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
    // BFF-hydrated 已有条目必须带上 owner DTO 的目录引用，写入时直接用引用.id，不再反查目录
    expect(页面.经历[0].行业引用).toEqual({ id: 'tax_i', display_name: '互联网' });
    expect(页面.教育[0].学校引用).toEqual({ id: 'ins_1', display_name: '复旦大学' });
    expect(页面.教育[0].专业引用).toEqual({ id: 'tax_m', display_name: '计算机科学' });
  });

  // Task 5：简历写入直接使用表单目录引用，不再按显示名反查目录。
  it('Education 直接使用选择时保存的 ID', () => {
    expect(转教育写入({
      编号: 'edu_local', 学校: '同名大学', 学校引用: { id: 'ins_cn', display_name: '同名大学' },
      专业: '计算机科学', 专业引用: { id: 'maj_cs', display_name: '计算机科学' },
      学历: '本科', 开始: '2020-09', 结束: '2024-06',
    })).toMatchObject({ institution_id: 'ins_cn', major_id: 'maj_cs' });
  });

  it('Experience 直接使用选择时保存的行业引用 ID', () => {
    expect(转经历写入({
      编号: 'exp_local', 公司: '云衢', 行业: '互联网', 行业引用: { id: 'tax_i', display_name: '互联网' },
      职位: '工程师', 开始: '2021-01', 结束: null, 内容: '平台', 隐藏: true,
    })).toMatchObject({ industry_id: 'tax_i' });
  });

  it('没有候选引用时抛出请从候选选择，不反查目录', () => {
    expect(() => 转教育写入({
      编号: 'edu_local', 学校: '手输学校', 学历: '本科', 专业: '计算机科学', 开始: '2020-09', 结束: '2024-06',
    })).toThrow('请从候选学校中选择');
    expect(() => 转经历写入({
      编号: 'exp_local', 公司: '云衢', 行业: '互联网', 职位: '工程师', 开始: '2021-01', 结束: null, 内容: '', 隐藏: false,
    })).toThrow('请从候选行业中选择');
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

  it('经验要求按 BFF enum 映射，不静默降级为 none', () => {
    const 目录 = {
      职位类别: [{ id: 'tax_product', display_name: '产品经理' }],
      地点: [{ id: 'loc_shanghai', display_name: '上海' }],
      行业: [], 院校: [], 专业: [],
    };
    // 页面岗位样本.经验要求 = '不限'；覆盖成 '3-5 年' 验证不被吞成 'none'
    const body = 转岗位创建({ ...页面岗位样本, 经验要求: '3-5 年' }, 目录, { 公司: '云衢科技' });
    expect(body.experience_requirement).toBe('three_to_five_years');
    // 不限 仍映射为 none
    expect(转岗位创建(页面岗位样本, 目录, { 公司: '云衢科技' }).experience_requirement).toBe('none');
    // 未映射的页值（演示域「3 年以上」）必须抛错，不静默落成 'none'
    expect(() => 转岗位创建({ ...页面岗位样本, 经验要求: '3 年以上' }, 目录, { 公司: '云衢科技' }))
      .toThrow('未映射的经验要求：3 年以上');
  });

  it('已加载的校园/实习意向在用户没切招聘类型时保留原类型', () => {
    const 草稿: 意向草稿型 = {
      ...空草稿,
      编辑编号: BFF意向样本.intention_id, 求职类型: '全职', 工作城市: '上海', 期望职位: '产品经理',
      工作城市引用: ref('loc_shanghai', '上海'), 职位引用: ref('tax_product', '产品经理'),
      感兴趣城市们: [], 薪资下限: 10, 薪资上限: 20, 期望行业们: [],
      求职类型已改: false, 后端招聘类型: 'internship' as const,
      办公方式: ['混合'],
    };
    expect(转意向写入(草稿, { 原始: BFF意向样本 }).recruitment_type)
      .toBe('internship');
  });

  // F9：campus_cohort '不限'/空/非数字 → null，不再被 Number('') 误判成 0 届
  it('校园招聘 campus_cohort：不限/空/非数字 落 null，数字年份保留', () => {
    const 目录 = {
      职位类别: [{ id: 'tax_product', display_name: '产品经理' }],
      地点: [{ id: 'loc_shanghai', display_name: '上海' }],
      行业: [], 院校: [], 专业: [],
    };
    expect(转岗位创建({ ...页面岗位样本, 招聘类型: '校园招聘', 届别: '不限' }, 目录, { 公司: '云衢科技' }).campus_cohort).toBe(null);
    expect(转岗位创建({ ...页面岗位样本, 招聘类型: '校园招聘', 届别: undefined }, 目录, { 公司: '云衢科技' }).campus_cohort).toBe(null);
    expect(转岗位创建({ ...页面岗位样本, 招聘类型: '校园招聘', 届别: '本周' }, 目录, { 公司: '云衢科技' }).campus_cohort).toBe(null);
    expect(转岗位创建({ ...页面岗位样本, 招聘类型: '校园招聘', 届别: '2027 届' }, 目录, { 公司: '云衢科技' }).campus_cohort).toBe(2027);
    // 补丁同样
    expect(转岗位补丁({ ...页面岗位样本, 招聘类型: '校园招聘', 届别: '不限' }, { 原始: BFF岗位样本, 公司: '云衢科技' }).campus_cohort).toBe(null);
    expect(转岗位补丁({ ...页面岗位样本, 招聘类型: '校园招聘', 届别: '2027 届' }, { 原始: BFF岗位样本, 公司: '云衢科技' }).campus_cohort).toBe(2027);
  });

  // F4：办公方式 既接受中文标签（引导预填来源），也接受 wire code（已有意向快照来源）
  it('映射办公方式：中文标签与 wire code 都能映射，不再产出 [null]', () => {
    const 草稿 = {
      ...空草稿,
      求职类型: '全职' as const, 工作城市: '上海', 期望职位: '产品经理',
      工作城市引用: ref('loc_shanghai', '上海'), 职位引用: ref('tax_product', '产品经理'),
      感兴趣城市们: [], 薪资下限: 10, 薪资上限: 20, 期望行业们: [],
    };
    // 中文标签（引导预填来源）
    expect(转意向写入({ ...草稿, 办公方式: ['混合'] }, { 原始: null }).workplace_modes).toEqual(['hybrid']);
    expect(转意向写入({ ...草稿, 办公方式: ['现场', '全远程'] }, { 原始: null }).workplace_modes).toEqual(['onsite', 'remote']);
    // wire code（已有意向快照 workplace_modes 来源）—— 原来这里产出 [undefined] 被 BFF 拒
    expect(转意向写入({ ...草稿, 办公方式: ['hybrid'] }, { 原始: BFF意向样本 }).workplace_modes).toEqual(['hybrid']);
    expect(转意向写入({ ...草稿, 办公方式: ['onsite'] }, { 原始: BFF意向样本 }).workplace_modes).toEqual(['onsite']);
  });

  it('首次意向写入用向导答案的办公方式（中文标签），不再硬编码 onsite', () => {
    const 输入 = {
      职位们: ['产品经理'],
      城市们: ['上海'],
      薪资: { 下限: 10, 上限: 20, 单位: '月薪K' as const },
      筛选偏好: { 求职类型: ['社招全职'] as ['社招全职'], 办公方式: ['混合', '全远程'] as ['混合', '全远程'] },
      排除项: [],
      职位引用: ref('tax_product', '产品经理'),
      城市引用们: [ref('loc_shanghai', '上海')],
    };
    expect(转首次意向写入(输入).workplace_modes).toEqual(['hybrid', 'remote']);
  });

  // F6：编辑已有意向的草稿必须从完整 BFFOwnerIntention 重建，不能从稀疏列表条目拆回，
  // 否则打开+原样保存会清掉 alternate_locations / industries / 薪资结构 / 后端招聘类型。
  // Task 6：同时填充 目录选择值 引用与 办公方式（中文标签），保存时直接用引用.id。
  it('从BFF意向草稿 从完整 DTO 重建草稿，保留 alternate_locations/industries/薪资/招聘类型/refs/办公方式', () => {
    const dto = {
      ...BFF意向样本,
      recruitment_type: 'internship' as const,
      primary_location: { id: 'loc_shanghai', display_name: '上海' },
      job_category: { id: 'tax_product', display_name: '产品经理' },
      alternate_locations: [
        { id: 'loc_bj', display_name: '北京' },
        { id: 'loc_hz', display_name: '杭州' },
      ],
      industries: [
        { id: 'ind_fin', display_name: '金融' },
        { id: 'ind_ai', display_name: '人工智能' },
      ],
      workplace_modes: ['hybrid', 'remote'] as ('onsite' | 'hybrid' | 'remote')[],
      compensation: { mode: 'range' as const, lower: 300, upper: 500, annual_salary_months: null },
      salary_period: 'day' as const,
    };
    const 草稿 = 从BFF意向草稿(dto);
    expect(草稿).toEqual({
      编辑编号: dto.intention_id,
      求职类型: '全职',
      工作城市: '上海',
      工作城市引用: { id: 'loc_shanghai', display_name: '上海' },
      期望职位: '产品经理',
      职位引用: { id: 'tax_product', display_name: '产品经理' },
      感兴趣城市们: ['北京', '杭州'],
      感兴趣城市引用们: [
        { id: 'loc_bj', display_name: '北京' },
        { id: 'loc_hz', display_name: '杭州' },
      ],
      薪资下限: 300,
      薪资上限: 500,
      期望行业们: ['金融', '人工智能'],
      行业引用们: [
        { id: 'ind_fin', display_name: '金融' },
        { id: 'ind_ai', display_name: '人工智能' },
      ],
      办公方式: ['混合', '远程'],
      后端招聘类型: 'internship',
      求职类型已改: false,
    });
  });

  it('从BFF意向草稿 对面议薪资落成 null/null', () => {
    const 草稿 = 从BFF意向草稿({ ...BFF意向样本, compensation: { mode: 'negotiable' } });
    expect(草稿.薪资下限).toBeNull();
    expect(草稿.薪资上限).toBeNull();
  });

  // #4：编辑已有意向时 annual_salary_months 从服务端快照保留（草稿不能表达此字段）。
  // salary_period 是 BFF 从 recruitment_type 派生的只读字段，不在 IntentionWrite body 里，
  // 保留 recruitment_type 即保留了 period —— 草稿不能表达 period，但保存不会丢它。
  it('转意向写入 更新时保留服务端 annual_salary_months', () => {
    const 草稿: 意向草稿型 = {
      ...空草稿,
      编辑编号: BFF意向样本.intention_id, 求职类型: '全职', 工作城市: '上海', 期望职位: '产品经理',
      工作城市引用: ref('loc_shanghai', '上海'), 职位引用: ref('tax_product', '产品经理'),
      感兴趣城市们: [], 薪资下限: 10, 薪资上限: 20, 期望行业们: [],
      求职类型已改: false, 后端招聘类型: 'internship' as const,
      办公方式: ['hybrid'],
    };
    const 原始 = { ...BFF意向样本, compensation: { mode: 'range' as const, lower: 300, upper: 500, annual_salary_months: 14 } };
    const body = 转意向写入(草稿, { 原始 });
    expect(body.compensation.annual_salary_months).toBe(14);
  });

  it('转意向写入 新建时省略 annual_salary_months（不填 12）', () => {
    const 草稿: 意向草稿型 = {
      ...空草稿,
      求职类型: '全职', 工作城市: '上海', 期望职位: '产品经理',
      工作城市引用: ref('loc_shanghai', '上海'), 职位引用: ref('tax_product', '产品经理'),
      感兴趣城市们: [], 薪资下限: 10, 薪资上限: 20, 期望行业们: [],
      办公方式: ['onsite'],
    };
    const body = 转意向写入(草稿, { 原始: null });
    expect(body.compensation).toEqual({ mode: 'range', lower: 10, upper: 20 });
    expect(body.compensation).not.toHaveProperty('annual_salary_months');
  });

  // Task 6 Step 1：新建意向不默认 onsite、不补 12、按 ID 去重地点
  it('新建意向不默认 onsite、不补 12、按 ID 去重地点', () => {
    const body = 转意向写入({
      ...空草稿,
      求职类型: '全职', 职位引用: ref('tax_pm', '产品经理'),
      工作城市引用: ref('loc_sh', '上海市'),
      感兴趣城市引用们: [ref('loc_sh', '上海市'), ref('loc_hz', '杭州市')],
      行业引用们: [ref('tax_it', '互联网')], 办公方式: ['hybrid'],
      薪资下限: 20, 薪资上限: 30,
    }, { 原始: null });
    expect(body).toMatchObject({
      job_category_id: 'tax_pm', primary_location_id: 'loc_sh',
      alternate_location_ids: ['loc_hz'], industry_ids: ['tax_it'], workplace_modes: ['hybrid'],
    });
    expect(body.compensation).toEqual({ mode: 'range', lower: 20, upper: 30 });
  });

  // Task 6 Step 1：编辑只改可见字段并保留 owner 未表达字段
  it('编辑只改可见字段并保留 owner 未表达字段', () => {
    const ownerCampus = {
      ...BFF意向样本,
      recruitment_type: 'campus' as const,
      job_category: { id: 'tax_pm', display_name: '产品经理' },
      primary_location: { id: 'loc_sh', display_name: '上海市' },
      alternate_locations: [{ id: 'loc_hz', display_name: '杭州市' }],
      industries: [{ id: 'tax_it', display_name: '互联网' }],
      workplace_modes: ['hybrid'] as ('onsite' | 'hybrid' | 'remote')[],
      compensation: { mode: 'range' as const, lower: 20, upper: 30, annual_salary_months: 15 },
      graduation_month: '2026-07',
      internship_months: null,
      onsite_days_per_week: null,
      exclusions: {
        alternate_weekend_work: 'excluded' as const,
        outsourcing_only: 'unspecified' as const,
        onsite_only: 'excluded' as const,
        frequent_travel: 'unspecified' as const,
      },
      private_preferences: '自定义偏好',
    };
    const body = 转意向写入(从BFF意向草稿(ownerCampus), { 原始: ownerCampus });
    expect(body).toMatchObject({
      recruitment_type: 'campus', graduation_month: ownerCampus.graduation_month,
      exclusions: ownerCampus.exclusions, private_preferences: ownerCampus.private_preferences,
    });
    expect(body.compensation.annual_salary_months).toBe(ownerCampus.compensation.annual_salary_months);
  });
});