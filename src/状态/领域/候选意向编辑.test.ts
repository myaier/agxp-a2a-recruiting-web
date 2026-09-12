// 四类型编辑合同：模拟保存、缓存恢复、历史字段和跨周期变更。
import { describe, expect, it } from 'vitest';
import { 归约候选资料, 空意向草稿 } from './候选资料';
import { 初始状态, 演示范围, 读模拟意向缓存 } from '../初始状态';
import { 账号存储键 } from '../../数据/资料缓存';
import { 从BFF意向草稿, 转意向写入 } from '../../数据/后端映射';
import { BFF意向样本 } from '../../测试/BFF样本';
import type { 意向草稿型 } from '../../数据/招聘数据源类型';

const 完整草稿: 意向草稿型 = {
  ...空意向草稿, 求职类型: '实习生', 工作城市: '上海', 期望职位: '产品经理',
  工作城市引用: { id: 'sh', display_name: '上海' }, 职位引用: { id: 'pm', display_name: '产品经理' },
  感兴趣城市们: ['杭州'], 感兴趣城市引用们: [{ id: 'hz', display_name: '杭州' }],
  期望行业们: ['金融'], 行业引用们: [{ id: 'fin', display_name: '金融' }], 办公方式: ['混合'],
  实习月数: 3, 每周到岗天数: 4, 毕业时间: '2027-06', 薪资周期: 'day', 薪资下限: 300, 薪资上限: 500,
  排除项: { alternate_weekend_work: 'allowed', outsourcing_only: 'excluded', onsite_only: 'unspecified', frequent_travel: 'excluded' },
  私有偏好: '历史原文\n其他排除：不接受夜班',
};

describe('意向完整本地数据链路', () => {
  it.each(['全职', '校园招聘', '实习生', '兼职'] as const)('%s 保存、编辑、缓存重载保留所有字段', 类型 => {
    const 草稿 = { ...完整草稿, 求职类型: 类型 };
    let 状态 = 归约候选资料({ ...初始状态, 求职意向表: [] }, { 型: '新增意向', 标题: '[上海] 产品经理', 说明: '300-500', 草稿 });
    const 编号 = 状态.求职意向表[0].编号;
    状态 = 归约候选资料(状态, { 型: '开意向草稿', 编号 });
    expect(状态.意向草稿).toEqual({ ...草稿, 编辑编号: 编号, 求职类型已改: false });
    状态 = 归约候选资料(状态, { 型: '改意向草稿', 补丁: { 工作城市: '深圳', 期望职位: '后端开发' } });
    expect(状态.意向草稿.实习月数).toBe(3);
    状态 = 归约候选资料(状态, { 型: '改意向', 编号, 标题: '[深圳] 后端开发', 说明: '', 草稿: 状态.意向草稿 });
    const 范围 = 演示范围('stg');
    const 原文 = JSON.stringify(状态.求职意向表);
    const 表 = 读模拟意向缓存({ getItem: 键 => 键 === 账号存储键('求职意向v1', 范围) ? 原文 : null, setItem() {}, removeItem() {} }, 范围);
    expect(表).toEqual(状态.求职意向表);
    const 重开 = 归约候选资料({ ...初始状态, 求职意向表: 表! }, { 型: '开意向草稿', 编号 });
    expect(重开.意向草稿).toEqual(状态.意向草稿);
  });
  it('重复点击历史实习类型不误改；跨周期明确清薪资但保留其它选择', () => {
    const 状态 = { ...初始状态, 意向草稿: 完整草稿 };
    const 同类 = 归约候选资料(状态, { 型: '改意向草稿', 补丁: { 求职类型: '实习生' } });
    expect(同类.意向草稿).toEqual(完整草稿);
    const 跨类 = 归约候选资料(状态, { 型: '改意向草稿', 补丁: { 求职类型: '兼职' } });
    expect(跨类.意向草稿).toMatchObject({ 薪资周期: 'month', 薪资下限: null, 薪资上限: null, 求职类型已改: true, 工作城市: '上海', 感兴趣城市们: ['杭州'] });
  });
  it('后端历史薪资、年薪月数、排除三态和私有原文无损提交', () => {
    // core editors §6.2（Task 2）：年薪月数只对 social_full_time/campus 合法，
    // 无损来源改为合同内合法的社招月薪区间（原 internship 携带 13 薪是合同外状态）。
    const 原始 = {
      ...BFF意向样本,
      recruitment_type: 'social_full_time' as const,
      salary_period: 'month' as const,
      internship_months: null,
      onsite_days_per_week: null,
      compensation: { mode: 'range' as const, lower: 300.5, upper: 500, annual_salary_months: 13 },
      exclusions: 完整草稿.排除项!,
      private_preferences: '\n原文  不要清空\n',
    };
    const 草稿 = 从BFF意向草稿(原始);
    const 写入 = 转意向写入(草稿, { 原始 });
    expect(写入).toMatchObject({ recruitment_type: 原始.recruitment_type, compensation: 原始.compensation, exclusions: 原始.exclusions, private_preferences: 原始.private_preferences, internship_months: 原始.internship_months, onsite_days_per_week: 原始.onsite_days_per_week });
  });
  it.each([['全职', 'social_full_time'], ['校园招聘', 'campus'], ['实习生', 'internship'], ['兼职', 'part_time']] as const)('%s 新建请求仅一个职位并接入对应条件', (类型, 后端类型) => {
    const 写入 = 转意向写入({ ...完整草稿, 求职类型: 类型 }, { 原始: null });
    expect(写入).toMatchObject({ recruitment_type: 后端类型, job_category_id: 'pm', primary_location_id: 'sh', alternate_location_ids: ['hz'], industry_ids: ['fin'], workplace_modes: ['hybrid'], graduation_month: 类型 === '校园招聘' ? '2027-06' : null, internship_months: 类型 === '实习生' ? 3 : null, onsite_days_per_week: 类型 === '实习生' ? 4 : null });
    expect(写入).not.toHaveProperty('salary_period');
  });
  it('新建不继承；旧稀疏记录兼容；合法空表不恢复演示记录', () => {
    const 新建 = 归约候选资料({ ...初始状态, 意向草稿: 完整草稿 }, { 型: '开意向草稿', 编号: null });
    expect(新建.意向草稿).toEqual(空意向草稿);
    const 旧表 = [{ 编号: 'old', 标题: '[上海] 研发', 说明: '20-30K｜金融' }];
    expect(归约候选资料({ ...初始状态, 求职意向表: 旧表 }, { 型: '开意向草稿', 编号: 'old' }).意向草稿).toMatchObject({ 工作城市: '上海', 期望职位: '研发', 薪资下限: 20, 薪资上限: 30 });
    const 存储 = { getItem: () => '[]', setItem() {}, removeItem() {} };
    expect(读模拟意向缓存(存储, 演示范围('stg'))).toEqual([]);
    expect(读模拟意向缓存({ ...存储, getItem: () => '{broken' }, 演示范围('stg'))).toBeNull();
    expect(读模拟意向缓存({ ...存储, getItem: () => JSON.stringify([{ ...旧表[0], 完整草稿: { ...完整草稿, 感兴趣城市们: null } }]) }, 演示范围('stg'))).toBeNull();
  });
});

describe('已有意向隐藏条件无损保存', () => {
  it.each(['internship', 'campus', 'social_full_time', 'part_time'] as const)('%s 未改类型保留全部历史条件，修改城市也不清空', recruitment_type => {
    const 原始 = { ...BFF意向样本, recruitment_type, graduation_month: '2027-06', internship_months: 6, onsite_days_per_week: 5 };
    const 草稿 = 从BFF意向草稿(原始);
    for (const 补丁 of [{}, { 工作城市: '深圳', 工作城市引用: { id: 'sz', display_name: '深圳' } }]) {
      expect(转意向写入({ ...草稿, ...补丁 }, { 原始 })).toMatchObject({ recruitment_type, graduation_month: '2027-06', internship_months: 6, onsite_days_per_week: 5 });
    }
  });
  it('显示中的条件仍可修改；明确改型才清除不适用条件', () => {
    const 原始 = { ...BFF意向样本, recruitment_type: 'internship' as const, graduation_month: '2027-06', internship_months: 6, onsite_days_per_week: 5 };
    const 草稿 = 从BFF意向草稿(原始);
    expect(转意向写入({ ...草稿, 实习月数: 3 }, { 原始 })).toMatchObject({ graduation_month: '2027-06', internship_months: 3, onsite_days_per_week: 5 });
    expect(转意向写入({ ...草稿, 求职类型: '校园招聘', 求职类型已改: true }, { 原始 })).toMatchObject({ recruitment_type: 'campus', graduation_month: '2027-06', internship_months: null, onsite_days_per_week: null });
    expect(转意向写入({ ...草稿, 求职类型: '全职', 求职类型已改: true }, { 原始 })).toMatchObject({ graduation_month: null, internship_months: null, onsite_days_per_week: null });
  });
});
