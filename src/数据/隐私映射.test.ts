// 隐私映射测试：D-03/D-04/D-05 三个可配置字段双向映射、派生/手动屏蔽来源的归组元数据、
// 以及七行披露模板的字节级快照 —— 模板搬家不能改任何一个用户可见字符串。

import { describe, expect, it } from 'vitest';
import { 披露档到BFF, 披露编号到BFF, 屏蔽来源到BFF, 从BFF隐私, 隐私披露模板 } from './隐私映射';
import type { BFF隐私快照, BFF披露档, BFF披露偏好 } from './BFF契约';
import { 披露偏好初始 } from './模拟数据';

function 构造快照(覆盖: Partial<BFF隐私快照>): BFF隐私快照 {
  return {
    employer_privacy_enabled: true,
    disclosure_preferences: { current_employer: 'never', education: 'never', portfolio_links: 'never' },
    organization_blocks: [],
    revision: 1,
    ...覆盖,
  };
}

/** 某个披露字段取指定 wire 档、其余字段保持 never 的服务端快照 */
function 含字段快照(字段: keyof BFF披露偏好, 值: BFF披露档): BFF隐私快照 {
  const 基础 = 构造快照({});
  const 偏好 = { ...基础.disclosure_preferences };
  偏好[字段] = 值;
  return 构造快照({ disclosure_preferences: 偏好 });
}

describe('隐私映射', () => {
  it('三个可配置字段的双向映射：D-03↔current_employer、D-04↔education、D-05↔portfolio_links', () => {
    expect(披露编号到BFF('D-03')).toBe('current_employer');
    expect(披露编号到BFF('D-04')).toBe('education');
    expect(披露编号到BFF('D-05')).toBe('portfolio_links');

    // 每个字段 × 每个档位，从服务端值落到对应模板行的 档
    const 字段与编号 = [
      ['current_employer', 'D-03'],
      ['education', 'D-04'],
      ['portfolio_links', 'D-05'],
    ] as const;
    for (const [字段, 编号] of 字段与编号) {
      for (const [页档, 线档] of [['不披露', 'never'], ['意向确认后', 'resume_submission'], ['一直允许', 'anonymous']] as const) {
        expect(披露档到BFF(页档)).toBe(线档);
        expect(从BFF隐私(含字段快照(字段, 线档)).披露偏好.find((项) => 项.编号 === 编号)?.档).toBe(页档);
      }
    }
  });

  it('页面不可配置的行保持模板自身 档 与 锁定，服务端值不外溢', () => {
    const 页面 = 从BFF隐私(构造快照({
      disclosure_preferences: { current_employer: 'anonymous', education: 'resume_submission', portfolio_links: 'never' },
    }));
    expect(页面.对现雇主隐身).toBe(true);
    // D-01/D-02/D-06/D-07 不由服务端驱动
    expect(页面.披露偏好.find((项) => 项.编号 === 'D-01')?.档).toBe('意向确认后');
    expect(页面.披露偏好.find((项) => 项.编号 === 'D-02')?.档).toBe('意向确认后');
    expect(页面.披露偏好.find((项) => 项.编号 === 'D-06')?.档).toBe('不披露');
    expect(页面.披露偏好.find((项) => 项.编号 === 'D-07')?.档).toBe('不披露');
    // 可修改旗标只落在 D-03/D-04/D-05
    expect(页面.披露偏好.filter((项) => 项.可修改 === true).map((项) => 项.编号)).toEqual(['D-03', 'D-04', 'D-05']);
    expect(页面.披露偏好.filter((项) => 项.可修改 === false).map((项) => 项.编号)).toEqual(['D-01', 'D-02', 'D-06', 'D-07']);
  });

  it('屏蔽来源按 manual/current_employer/related_organization 归组并带元数据', () => {
    expect(屏蔽来源到BFF('当前雇主')).toBe('current_employer');
    expect(屏蔽来源到BFF('关联公司')).toBe('related_organization');
    expect(屏蔽来源到BFF('手动添加')).toBe('manual');

    const 页面 = 从BFF隐私(构造快照({
      organization_blocks: [
        { organization_id: 'org_a', organization_display_name: '锐思数据', organization_status: 'active', source: 'current_employer', created_at: '2026-08-24T09:30:00Z' },
        { organization_id: 'org_b', organization_display_name: '锐思杭州', organization_status: 'suspended', source: 'related_organization', created_at: '2026-08-24T10:00:00Z' },
        { organization_id: 'org_c', organization_display_name: '恒达外包', organization_status: 'active', source: 'manual', created_at: '2026-08-24T11:20:00Z' },
      ],
    }));
    expect(页面.屏蔽名单).toEqual([
      { 编号: 'org_a', 组织编号: 'org_a', 名称: '锐思数据', 首字: '锐', 来源: '当前雇主', 组织状态: '有效',
        理由: '当前雇主 · 建档时自动屏蔽', 时间: '2026-08-24' },
      { 编号: 'org_b', 组织编号: 'org_b', 名称: '锐思杭州', 首字: '锐', 来源: '关联公司', 组织状态: '已停用',
        理由: '当前雇主关联公司 · 自动屏蔽', 时间: '2026-08-24' },
      { 编号: 'org_c', 组织编号: 'org_c', 名称: '恒达外包', 首字: '恒', 来源: '手动添加', 组织状态: '有效',
        理由: '你手动加入 · 双向不可见', 时间: '2026-08-24' },
    ]);
  });

  it('七行披露模板逐字节冻结；模拟数据 re-export 同一份引用', () => {
    expect(隐私披露模板).toEqual([
      {
        编号: 'D-01', 名称: '真实姓名',
        说明: '匿名初筛阶段一律用代号；递交简历（S1）原件时真名即向招聘方显示。对方公司与对接人对你始终实名。',
        档: '意向确认后', 可选档: ['不披露', '意向确认后'], 锁定: null, 可修改: false,
      },
      {
        编号: 'D-02', 名称: '联系方式',
        说明: '手机号与微信。递交简历（S1）原件时即随原件向招聘方显示；意向确认只表示进入真人沟通，不再承担首次交换联系方式。',
        档: '意向确认后', 可选档: ['不披露', '意向确认后'], 锁定: null, 可修改: false,
      },
      {
        编号: 'D-03', 名称: '当前公司',
        说明: '写成「同赛道头部公司」还是写实名，由你定。',
        档: '不披露', 可选档: ['不披露', '意向确认后', '一直允许'], 锁定: null, 可修改: true,
      },
      {
        编号: 'D-04', 名称: '毕业院校与学历',
        说明: '很多岗位的硬性门槛，默认直接展示在匿名简历上，减少无效接触。',
        档: '一直允许', 可选档: ['不披露', '意向确认后', '一直允许'], 锁定: null, 可修改: true,
      },
      {
        编号: 'D-05', 名称: '作品与代码仓库',
        说明: 'GitHub 等公开链接，技术岗提前给通常是加分项。',
        档: '一直允许', 可选档: ['不披露', '意向确认后', '一直允许'], 锁定: null, 可修改: true,
      },
      {
        编号: 'D-06', 名称: '具体薪资数字',
        说明: 'AI 只回答「区间是否匹配」，不会自动向对方披露具体数字。',
        档: '不披露', 可选档: ['不披露'],
        锁定: '机制锁定：AI 不会自动披露具体薪资；意向确认后由你自行决定是否沟通', 可修改: false,
      },
      {
        编号: 'D-07', 名称: '并行接触数量',
        说明: '你同时在谈几家。披露会直接削弱你的议价位置。',
        档: '不披露', 可选档: ['不披露'],
        锁定: '平台默认锁定：并行接触数量属于你的私密信息', 可修改: false,
      },
    ]);
    // 模拟数据 的 披露偏好初始 就是这份模板（re-export），老 import 路径不改文案
    expect(披露偏好初始).toBe(隐私披露模板);
  });
});
