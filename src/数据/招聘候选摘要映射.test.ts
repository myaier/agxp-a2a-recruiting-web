// 招聘候选摘要映射测试：BFF招聘候选摘要 → 招聘候选摘要视图 的格式化规则。
// 锁定：两个性别、0/正/null 年限、三种求职状态、trim 判空与「 · 」拼接、
// 只取摘要不回查旧字段、亮点按 wire 顺序保留、多余身份 canary 不进入输出。

import { describe, expect, it } from 'vitest';
import { 映射招聘候选摘要 } from './招聘候选摘要映射';
import type { BFF招聘候选摘要 } from './BFF契约';
import { 招聘候选摘要样本 } from '../测试/BFF样本';

const 摘要 = 招聘候选摘要样本;

describe('映射招聘候选摘要', () => {
  it('null 输入输出 null（未披露摘要，卡片层显示中性文案）', () => {
    expect(映射招聘候选摘要(null)).toBeNull();
  });

  it('完整样本按 Spec §4 固定文案映射', () => {
    expect(映射招聘候选摘要(摘要)).toEqual({
      性别: '女', 年限: '5 年', 学历: '本科', 求职状态: '在职看机会',
      工作: '示例公司 · 软件工程师', 教育: '示例大学 · 计算机科学',
      个人亮点: ['带领5人团队交付'],
    });
  });

  it('两个性别映射，null 不出现性别键', () => {
    expect(映射招聘候选摘要({ ...摘要, gender: 'male' })?.性别).toBe('男');
    expect(映射招聘候选摘要({ ...摘要, gender: 'female' })?.性别).toBe('女');
    expect('性别' in (映射招聘候选摘要({ ...摘要, gender: null }) ?? {})).toBe(false);
  });

  it('0 年「不满 1 年」，正数「n 年」，null 隐藏', () => {
    expect(映射招聘候选摘要({ ...摘要, experience_years: 0 })?.年限).toBe('不满 1 年');
    expect(映射招聘候选摘要({ ...摘要, experience_years: 12 })?.年限).toBe('12 年');
    expect(映射招聘候选摘要({ ...摘要, experience_years: null })?.年限).toBeNull();
  });

  it('三种求职状态固定文案，null 隐藏', () => {
    expect(映射招聘候选摘要({ ...摘要, job_status: 'employed' })?.求职状态).toBe('在职看机会');
    expect(映射招聘候选摘要({ ...摘要, job_status: 'unemployed' })?.求职状态).toBe('离职可到岗');
    expect(映射招聘候选摘要({ ...摘要, job_status: 'student' })?.求职状态).toBe('在校');
    expect(映射招聘候选摘要({ ...摘要, job_status: null })?.求职状态).toBeNull();
  });

  it('degree trim 后判空；空白字符串隐藏该项', () => {
    expect(映射招聘候选摘要({ ...摘要, degree: '  硕士  ' })?.学历).toBe('硕士');
    expect(映射招聘候选摘要({ ...摘要, degree: '   ' })?.学历).toBeNull();
    expect(映射招聘候选摘要({ ...摘要, degree: null })?.学历).toBeNull();
  });

  it('company=null/title 有值只显示岗位，禁止回查或推断', () => {
    expect(映射招聘候选摘要({ ...摘要, latest_experience: { company: null, title: '软件工程师' } })?.工作).toBe('软件工程师');
    expect(映射招聘候选摘要({ ...摘要, latest_experience: { company: '示例公司', title: null } })?.工作).toBe('示例公司');
    expect(映射招聘候选摘要({ ...摘要, latest_experience: null })?.工作).toBeNull();
  });

  it('工作/教育行 trim 判空、双方都有才加「 · 」、都空收为 null', () => {
    expect(映射招聘候选摘要({ ...摘要, latest_experience: { company: ' 示例公司 ', title: '  ' } })?.工作).toBe('示例公司');
    expect(映射招聘候选摘要({ ...摘要, latest_experience: { company: null, title: null } })?.工作).toBeNull();
    expect(映射招聘候选摘要({ ...摘要, latest_education: { institution: null, major: '计算机科学' } })?.教育).toBe('计算机科学');
    expect(映射招聘候选摘要({ ...摘要, latest_education: { institution: ' 示例大学 ', major: ' 计算机科学 ' } })?.教育).toBe('示例大学 · 计算机科学');
    expect(映射招聘候选摘要({ ...摘要, latest_education: null })?.教育).toBeNull();
  });

  it('完全空的摘要：头行与两行信息全 null，亮点空数组保留', () => {
    const 空: BFF招聘候选摘要 = {
      gender: null, experience_years: null, job_status: null, degree: null,
      latest_experience: null, latest_education: null, personal_highlights: [],
    };
    expect(映射招聘候选摘要(空)).toEqual({
      年限: null, 学历: null, 求职状态: null, 工作: null, 教育: null, 个人亮点: [],
    });
  });

  it('亮点按 wire 顺序原样保留，不与旧 highlights 混合', () => {
    const 亮点 = ['职位方向匹配', '经验要求匹配'];
    expect(映射招聘候选摘要({ ...摘要, personal_highlights: 亮点 })?.个人亮点).toEqual(亮点);
  });

  it('输入多余身份 canary 不进入输出（白名单投影）', () => {
    const 污染 = { ...摘要, 真名: '张三', candidate_alias: 'alias-1', birth_year: 1998 } as BFF招聘候选摘要;
    const 视图 = 映射招聘候选摘要(污染);
    expect(视图 && Object.keys(视图).sort()).toEqual(['个人亮点', '学历', '工作', '教育', '年限', '性别', '求职状态'].sort());
    expect(视图).not.toHaveProperty('真名');
    expect(JSON.stringify(视图)).not.toContain('张三');
  });
});