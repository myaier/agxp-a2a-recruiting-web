// 隐私映射层：BFF PrivacyView（wire 全视图）→ 页面隐私快照 的纯函数转换，
// 以及 披露档/披露字段/屏蔽来源 的双向闭合码表。
//
// 七行披露模板的原件搬到这里（模拟数据.ts re-export 同一份引用，老 import 路径不变）：
// 行内 名称/说明/可选档/锁定 是用户可见文案 —— 只许加 可修改 旗标，不许改写任何
// 已显示字符串（字节级快照由 隐私映射.test.ts 冻结）。服务端只驱动 D-03/D-04/D-05 三行。

import type { BFF披露档, BFF披露偏好, BFF屏蔽来源, BFF隐私快照 } from './BFF契约';
import type { 页面隐私快照 } from './招聘数据源类型';
import type { 屏蔽来源, 披露项, 披露档 } from './类型';

// ── 双向闭合码表 ──

const 披露档映射 = { never: '不披露', resume_submission: '意向确认后', anonymous: '一直允许' } as const;
const 披露档反向 = { 不披露: 'never', 意向确认后: 'resume_submission', 一直允许: 'anonymous' } as const;
const 来源映射 = { current_employer: '当前雇主', related_organization: '关联公司', manual: '手动添加' } as const;
const 披露字段映射 = { 'D-03': 'current_employer', 'D-04': 'education', 'D-05': 'portfolio_links' } as const;

/** 页面披露档 → BFF wire 档。 */
export function 披露档到BFF(档: 披露档): BFF披露档 { return 披露档反向[档]; }

/** 服务端可写的三行编号（D-03/D-04/D-05）→ BFF披露偏好 字段名。 */
export function 披露编号到BFF(id: keyof typeof 披露字段映射): keyof BFF披露偏好 { return 披露字段映射[id]; }

/** 页面屏蔽来源 → BFF屏蔽来源。 */
export function 屏蔽来源到BFF(来源: 屏蔽来源): BFF屏蔽来源 {
  return 来源 === '当前雇主' ? 'current_employer' : 来源 === '关联公司' ? 'related_organization' : 'manual';
}

// ── 七行披露模板（文案原件；从 模拟数据.ts 迁入并由其 re-export）──

export const 隐私披露模板: 披露项[] = [
  {
    编号: 'D-01',
    名称: '真实姓名',
    说明: '匿名初筛阶段一律用代号；递交简历（S1）原件时真名即向招聘方显示。对方公司与对接人对你始终实名。',
    档: '意向确认后',
    可选档: ['不披露', '意向确认后'],
    锁定: null,
    可修改: false,
  },
  {
    编号: 'D-02',
    名称: '联系方式',
    说明: '手机号与微信。递交简历（S1）原件时即随原件向招聘方显示；意向确认只表示进入真人沟通，不再承担首次交换联系方式。',
    档: '意向确认后',
    可选档: ['不披露', '意向确认后'],
    锁定: null,
    可修改: false,
  },
  {
    编号: 'D-03',
    名称: '当前公司',
    说明: '写成「同赛道头部公司」还是写实名，由你定。',
    档: '不披露',
    可选档: ['不披露', '意向确认后', '一直允许'],
    锁定: null,
    可修改: true,
  },
  {
    编号: 'D-04',
    名称: '毕业院校与学历',
    说明: '很多岗位的硬性门槛，默认直接展示在匿名简历上，减少无效接触。',
    档: '一直允许',
    可选档: ['不披露', '意向确认后', '一直允许'],
    锁定: null,
    可修改: true,
  },
  {
    编号: 'D-05',
    名称: '作品与代码仓库',
    说明: 'GitHub 等公开链接，技术岗提前给通常是加分项。',
    档: '一直允许',
    可选档: ['不披露', '意向确认后', '一直允许'],
    锁定: null,
    可修改: true,
  },
  {
    编号: 'D-06',
    名称: '具体薪资数字',
    说明: 'AI 只回答「区间是否匹配」，不会自动向对方披露具体数字。',
    档: '不披露',
    可选档: ['不披露'],
    锁定: '机制锁定：AI 不会自动披露具体薪资；意向确认后由你自行决定是否沟通',
    可修改: false,
  },
  {
    编号: 'D-07',
    名称: '并行接触数量',
    说明: '你同时在谈几家。披露会直接削弱你的议价位置。',
    档: '不披露',
    可选档: ['不披露'],
    锁定: '平台默认锁定：并行接触数量属于你的私密信息',
    可修改: false,
  },
];

/**
 * BFF隐私快照 → 页面隐私快照。
 * 对现雇主隐身 直接来自服务端开关；披露偏好 以共享模板为底、只把 D-03/D-04/D-05 的 档
 * 换成服务端值（其余行保持模板自身 档 与 锁定）；屏蔽名单 按 来源 归组出 理由 行。
 */
export function 从BFF隐私(服务端: BFF隐私快照): 页面隐私快照 {
  const 值表 = {
    'D-03': 披露档映射[服务端.disclosure_preferences.current_employer],
    'D-04': 披露档映射[服务端.disclosure_preferences.education],
    'D-05': 披露档映射[服务端.disclosure_preferences.portfolio_links],
  } as const;
  return {
    对现雇主隐身: 服务端.employer_privacy_enabled,
    披露偏好: 隐私披露模板.map((项) => ({
      ...项,
      档: 项.编号 in 值表 ? 值表[项.编号 as keyof typeof 值表] : 项.档,
      可修改: ['D-03', 'D-04', 'D-05'].includes(项.编号),
    })),
    屏蔽名单: 服务端.organization_blocks.map((块) => ({
      编号: 块.organization_id,
      组织编号: 块.organization_id,
      名称: 块.organization_display_name,
      首字: 块.organization_display_name.charAt(0),
      来源: 来源映射[块.source],
      组织状态: 块.organization_status === 'active' ? '有效' : '已停用',
      理由: 块.source === 'manual' ? '你手动加入 · 双向不可见'
        : 块.source === 'current_employer' ? '当前雇主 · 建档时自动屏蔽' : '当前雇主关联公司 · 自动屏蔽',
      时间: 块.created_at.slice(0, 10),
    })),
    服务端,
  };
}
