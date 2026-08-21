import { describe, expect, it } from 'vitest';
import { 路径 } from '../路由/路径表';
import { Onboarding流程, 初筛字段矩阵, 判断求职薪资单位, 求职初筛缺失项, 身份首次入口 } from './onboarding配置';

describe('多角色 onboarding 合同', () => {
  it('招聘方首次注册必须先认证，再填写名片和岗位', () => {
    expect(身份首次入口('企业')).toBe(路径.企业实名认证);
    expect(Onboarding流程.招聘方.slice(0, 3)).toEqual([路径.企业实名认证, 路径.招聘名片, 路径.发布岗位]);
  });

  it('学生路径不会跳过实习经历、技能与证书所在页', () => {
    const 流程 = Onboarding流程.学生求职;
    expect(流程.indexOf(路径.工作经历)).toBeGreaterThan(流程.indexOf(路径.就读时间段));
    expect(流程.indexOf(路径.工作经历)).toBeLessThan(流程.indexOf(路径.求职状态));
  });

  it('学生和社招的配置顺序明确不同', () => {
    expect(Onboarding流程.学生求职).not.toEqual(Onboarding流程.社招求职);
    expect(Onboarding流程.学生求职.indexOf(路径.基本信息)).toBeLessThan(Onboarding流程.学生求职.indexOf(路径.引导问答));
    expect(Onboarding流程.社招求职.indexOf(路径.引导问答)).toBeLessThan(Onboarding流程.社招求职.indexOf(路径.基本信息));
  });

  it('选择实习时必须补齐时长和每周到岗天数', () => {
    expect(求职初筛缺失项({ 求职类型: ['实习生'], 办公方式: ['混合'] })).toEqual(['可实习月数', '每周可到岗天数']);
    expect(求职初筛缺失项({ 求职类型: ['实习生'], 办公方式: ['混合'], 实习月数: 3, 每周到岗天数: 4 })).toEqual([]);
  });

  it('初筛合同同时覆盖通用、社招、学生与实习字段', () => {
    expect(Object.keys(初筛字段矩阵)).toEqual(['通用', '社招', '学生', '实习']);
  });

  it('实习求职统一按日薪采集，其他类型保持月薪', () => {
    expect(判断求职薪资单位({ 求职类型: ['校园招聘', '实习生'], 办公方式: ['混合'] })).toBe('元/天');
    expect(判断求职薪资单位({ 求职类型: ['社招全职'], 办公方式: ['现场'] })).toBe('月薪K');
  });
});
