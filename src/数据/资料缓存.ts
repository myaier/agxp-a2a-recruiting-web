// 账号资料的浏览器缓存边界。
//
// Mock 是单一演示账号，允许在 localStorage 持久化，但键必须带环境和账号。
// Backend 只在 sessionStorage 保留尚未接服务端的页面资料，并以后端环境 + subject_id
// 隔离。这不是“前端加密”，而是缩短留存时间、阻止跨账号/跨环境串读。

import type { 后端环境 } from '../配置/运行配置';
import type { 办公偏好, 求职类型, 求职初筛偏好 } from '../流程/onboarding配置';
import type { 公司自述覆盖 } from './类型';

export type 资料缓存存储 = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface 资料缓存范围 {
  模式: 'mock' | 'backend';
  环境: 后端环境;
  账号: string;
}

/**
 * P1C：字段全部可选 —— Backend 白名单快照只带 服务端尚未接管 的键
 * （当前企业关系编号/未认证公司声明/求职头像/飞书已接入/企业飞书已接入）；
 * 企业认证/招聘头像/公司LOGO/公司自述 已被 P1C 服务端事实取代，只走 Mock 路径。
 * Mock migration 仍显式补齐全量旧字段。
 */
export interface 资料缓存快照 {
  公司自述?: 公司自述覆盖 | null;
  企业认证?: { 姓名: string; 公司: string; 职务?: string };
  招聘头像?: string | null;
  公司LOGO?: string | null;
  求职头像?: string | null;
  飞书已接入?: boolean;
  企业飞书已接入?: boolean;
  // ── P1C：可恢复的组织选择（恢复值须经最新 affiliations 校验）──
  当前企业关系编号?: string | null;
  未认证公司声明?: string;
}

/** Mock 种子 / 空账号资料：旧字段全量必带的形状（Mock migration 仍显式补齐旧字段）。 */
export type 完整Mock资料快照 = Required<Pick<资料缓存快照,
  '公司自述' | '企业认证' | '招聘头像' | '公司LOGO' | '求职头像' | '飞书已接入' | '企业飞书已接入'
>>;

const 前缀 = 'AGXP账号资料v2';

export function 资料缓存键(范围: 资料缓存范围): string {
  return `${前缀}:${范围.模式}:${范围.环境}:${encodeURIComponent(范围.账号)}`;
}

/** 给简历/引导等独立快照生成同口径的隔离键。 */
export function 账号存储键(分类: string, 范围: 资料缓存范围): string {
  return `AGXP${分类}:${范围.模式}:${范围.环境}:${encodeURIComponent(范围.账号)}`;
}

function 是公司自述(值: unknown): 值 is 公司自述覆盖 {
  if (!值 || typeof 值 !== 'object') return false;
  return Array.isArray((值 as { 简介?: unknown }).简介);
}

function 是企业认证(值: unknown): 值 is 资料缓存快照['企业认证'] {
  if (!值 || typeof 值 !== 'object') return false;
  const 候选 = 值 as { 姓名?: unknown; 公司?: unknown; 职务?: unknown };
  return typeof 候选.姓名 === 'string'
    && typeof 候选.公司 === 'string'
    && (候选.职务 === undefined || typeof 候选.职务 === 'string');
}

function 是招聘头像(值: unknown): 值 is string | null {
  return 值 === null || (typeof 值 === 'string' && 值.startsWith('data:image/'));
}

function 是求职头像(值: unknown): 值 is string | null {
  return 值 === null || (typeof 值 === 'string' && (值.startsWith('data:image/') || 值.startsWith('章:')));
}

function 安全解析JSON(原文: string | null): unknown {
  if (!原文) return null;
  try {
    return JSON.parse(原文);
  } catch {
    return null;
  }
}

export function 读资料缓存(存储: 资料缓存存储 | null, 范围: 资料缓存范围): Partial<资料缓存快照> {
  if (!存储) return {};
  try {
    const 原文 = 存储.getItem(资料缓存键(范围));
    if (!原文) return {};
    const 值 = JSON.parse(原文) as Record<string, unknown>;
    const 快照: Partial<资料缓存快照> = {};
    if (值.公司自述 === null || 是公司自述(值.公司自述)) 快照.公司自述 = 值.公司自述;
    if (是企业认证(值.企业认证)) 快照.企业认证 = 值.企业认证;
    if (是招聘头像(值.招聘头像)) 快照.招聘头像 = 值.招聘头像;
    if (是招聘头像(值.公司LOGO)) 快照.公司LOGO = 值.公司LOGO;
    if (是求职头像(值.求职头像)) 快照.求职头像 = 值.求职头像;
    if (typeof 值.飞书已接入 === 'boolean') 快照.飞书已接入 = 值.飞书已接入;
    if (typeof 值.企业飞书已接入 === 'boolean') 快照.企业飞书已接入 = 值.企业飞书已接入;
    // P1C：组织选择的新键逐键守卫——损坏类型被丢弃，不进入应用状态
    if (值.当前企业关系编号 === null || typeof 值.当前企业关系编号 === 'string') {
      快照.当前企业关系编号 = 值.当前企业关系编号;
    }
    if (typeof 值.未认证公司声明 === 'string') 快照.未认证公司声明 = 值.未认证公司声明;
    return 快照;
  } catch {
    return {};
  }
}

export function 写资料缓存(存储: 资料缓存存储 | null, 范围: 资料缓存范围, 快照: Partial<资料缓存快照>): boolean {
  if (!存储) return false;
  try {
    存储.setItem(资料缓存键(范围), JSON.stringify(快照));
    return true;
  } catch {
    return false;
  }
}

const 旧键 = {
  公司自述: 'AGXP公司自述v1',
  企业认证: 'AGXP企业认证v1',
  招聘头像: 'AGXP招聘头像v1',
  公司LOGO: 'AGXP公司LOGOv1',
  求职头像: 'AGXP求职头像v1',
  飞书已接入: 'AGXP飞书接入v1',
  企业飞书已接入: 'AGXP企业飞书接入v1',
} as const;

/** 仅供 Mock 升级：旧的全局键成功写入新命名空间后才删除。 */
export function 迁移旧资料缓存(存储: 资料缓存存储 | null, 范围: 资料缓存范围): Partial<资料缓存快照> {
  if (!存储) return {};
  const 已有 = 读资料缓存(存储, 范围);
  if (Object.keys(已有).length > 0) return 已有;
  try {
    const 快照: Partial<资料缓存快照> = {};
    const 公司自述 = 安全解析JSON(存储.getItem(旧键.公司自述));
    const 企业认证 = 安全解析JSON(存储.getItem(旧键.企业认证));
    const 招聘头像 = 存储.getItem(旧键.招聘头像);
    const 公司LOGO = 存储.getItem(旧键.公司LOGO);
    const 求职头像 = 存储.getItem(旧键.求职头像);
    const 飞书 = 存储.getItem(旧键.飞书已接入);
    const 企业飞书 = 存储.getItem(旧键.企业飞书已接入);
    if (是公司自述(公司自述)) 快照.公司自述 = 公司自述;
    if (是企业认证(企业认证)) 快照.企业认证 = 企业认证;
    if (是招聘头像(招聘头像) && 招聘头像 !== null) 快照.招聘头像 = 招聘头像;
    if (是招聘头像(公司LOGO) && 公司LOGO !== null) 快照.公司LOGO = 公司LOGO;
    if (是求职头像(求职头像) && 求职头像 !== null) 快照.求职头像 = 求职头像;
    if (飞书 === '0' || 飞书 === '1') 快照.飞书已接入 = 飞书 === '1';
    if (企业飞书 === '0' || 企业飞书 === '1') 快照.企业飞书已接入 = 企业飞书 === '1';
    if (Object.keys(快照).length === 0) return {};
    const 完整: 资料缓存快照 = {
      公司自述: null,
      企业认证: { 姓名: '邵铭', 公司: '云衢科技', 职务: '技术 VP' },
      招聘头像: null,
      公司LOGO: null,
      求职头像: null,
      飞书已接入: false,
      企业飞书已接入: false,
      ...快照,
    };
    if (!写资料缓存(存储, 范围, 完整)) return {};
    for (const 键 of Object.values(旧键)) 存储.removeItem(键);
    return 快照;
  } catch {
    return {};
  }
}

// ── Task 4：候选 onboarding 草稿的 sessionStorage 白名单编解码 ──────────────────
// 只缓存「服务端尚未接管的 onboarding 答案」：城市/职位字符串、目录引用、初筛偏好、
// 薪资区间、到岗状态。简历正文、凭据、PDF 字节/文本、未脱敏联系方式、模型输出、
// 任何未知字段一律不落盘；解码是闭合规则，任何在场的损坏字段整条拒绝并删除整条记录。

export interface 候选引导草稿快照 {
  城市们: string[];
  职位: string[];
  城市引用们?: { id: string; display_name: string }[];
  职位引用们?: { id: string; display_name: string }[];
  筛选偏好?: 求职初筛偏好;
  薪资?: { 下限: number; 上限: number; 单位?: '月薪K' | '元/天' };
  到岗?: string;
}

export const 候选引导草稿分类 = '候选引导草稿v1';

/** 候选 onboarding 草稿的 sessionStorage 键：与 账号存储键 同口径（模式 + 环境 + 账号）。 */
export const 候选引导草稿键 = (范围: 资料缓存范围): string => 账号存储键(候选引导草稿分类, 范围);

const 候选草稿根键们: readonly string[] = ['城市们', '职位', '城市引用们', '职位引用们', '筛选偏好', '薪资', '到岗'];
const 筛选偏好键们: readonly string[] = ['求职类型', '办公方式', '毕业时间', '实习月数', '每周到岗天数'];
const 求职类型们: readonly 求职类型[] = ['社招全职', '校园招聘', '实习生', '兼职'];
const 办公方式们: readonly 办公偏好[] = ['现场', '混合', '全远程'];
const 毕业时间样式 = /^\d{4}-(0[1-9]|1[0-2])$/;

function 是字符串数组(值: unknown): 值 is string[] {
  return Array.isArray(值) && 值.every((条) => typeof 条 === 'string');
}

function 是有限数(值: unknown): 值 is number {
  return typeof 值 === 'number' && Number.isFinite(值);
}

function 是有限整数(值: unknown): 值 is number {
  return 是有限数(值) && Number.isInteger(值);
}

/** 引用必须恰好是 非空字符串 id + 非空字符串 display_name，不多不少。 */
function 是草稿引用(值: unknown): 值 is { id: string; display_name: string } {
  if (!值 || typeof 值 !== 'object') return false;
  const 键们 = Object.keys(值);
  if (键们.length !== 2) return false;
  const 候选 = 值 as { id?: unknown; display_name?: unknown };
  if (typeof 候选.id !== 'string' || 候选.id === '') return false;
  if (typeof 候选.display_name !== 'string' || 候选.display_name === '') return false;
  return true;
}

function 是草稿引用数组(值: unknown): 值 is { id: string; display_name: string }[] {
  return Array.isArray(值) && 值.every(是草稿引用);
}

function 是草稿筛选偏好(值: unknown): 值 is 求职初筛偏好 {
  if (!值 || typeof 值 !== 'object') return false;
  const 候选 = 值 as Record<string, unknown>;
  for (const 键 of Object.keys(候选)) {
    if (!筛选偏好键们.includes(键)) return false;
  }
  if (!Array.isArray(候选.求职类型)
    || !候选.求职类型.every((条) => 求职类型们.includes(条 as 求职类型))) return false;
  if (!Array.isArray(候选.办公方式)
    || !候选.办公方式.every((条) => 办公方式们.includes(条 as 办公偏好))) return false;
  if (候选.毕业时间 !== undefined
    && (typeof 候选.毕业时间 !== 'string' || !毕业时间样式.test(候选.毕业时间))) return false;
  if (候选.实习月数 !== undefined && !是有限整数(候选.实习月数)) return false;
  if (候选.每周到岗天数 !== undefined && !是有限整数(候选.每周到岗天数)) return false;
  return true;
}

function 是草稿薪资(值: unknown): 值 is 候选引导草稿快照['薪资'] {
  if (!值 || typeof 值 !== 'object') return false;
  const 候选 = 值 as Record<string, unknown>;
  for (const 键 of Object.keys(候选)) {
    if (键 !== '下限' && 键 !== '上限' && 键 !== '单位') return false;
  }
  if (!是有限数(候选.下限) || !是有限数(候选.上限)) return false;
  if (候选.单位 !== undefined && 候选.单位 !== '月薪K' && 候选.单位 !== '元/天') return false;
  return true;
}

function 是候选引导草稿快照(值: unknown): 值 is 候选引导草稿快照 {
  if (!值 || typeof 值 !== 'object' || Array.isArray(值)) return false;
  const 候选 = 值 as Record<string, unknown>;
  for (const 键 of Object.keys(候选)) {
    if (!候选草稿根键们.includes(键)) return false;
  }
  if (!是字符串数组(候选.城市们) || !是字符串数组(候选.职位)) return false;
  if (候选.城市引用们 !== undefined && !是草稿引用数组(候选.城市引用们)) return false;
  if (候选.职位引用们 !== undefined && !是草稿引用数组(候选.职位引用们)) return false;
  if (候选.筛选偏好 !== undefined && !是草稿筛选偏好(候选.筛选偏好)) return false;
  if (候选.薪资 !== undefined && !是草稿薪资(候选.薪资)) return false;
  if (候选.到岗 !== undefined && typeof 候选.到岗 !== 'string') return false;
  return true;
}

/**
 * 读取候选 onboarding 草稿。任何在场的损坏字段（含非 JSON 原文）→ 返回 null 并
 * 删除整条记录，保证重复 mount 不会反复撞同一条损坏数据。
 */
export function 读候选引导草稿(存储: 资料缓存存储 | null, 范围: 资料缓存范围): 候选引导草稿快照 | null {
  if (!存储) return null;
  const 键 = 候选引导草稿键(范围);
  let 原文: string | null;
  try {
    原文 = 存储.getItem(键);
  } catch {
    return null;
  }
  if (原文 === null) return null;
  let 值: unknown;
  try {
    值 = JSON.parse(原文);
  } catch {
    值 = null;
  }
  if (!是候选引导草稿快照(值)) {
    try {
      存储.removeItem(键);
    } catch {
      // 删除失败只影响下一次读取（会再次被拒绝），不抛错。
    }
    return null;
  }
  return 值;
}

/** 写入候选 onboarding 草稿：构造全新白名单对象，绝不展开调用方对象。 */
export function 写候选引导草稿(存储: 资料缓存存储 | null, 范围: 资料缓存范围, 草稿: 候选引导草稿快照): boolean {
  if (!存储) return false;
  const 快照: 候选引导草稿快照 = {
    城市们: [...草稿.城市们],
    职位: [...草稿.职位],
  };
  if (草稿.城市引用们 !== undefined) {
    快照.城市引用们 = 草稿.城市引用们.map((引) => ({ id: 引.id, display_name: 引.display_name }));
  }
  if (草稿.职位引用们 !== undefined) {
    快照.职位引用们 = 草稿.职位引用们.map((引) => ({ id: 引.id, display_name: 引.display_name }));
  }
  if (草稿.筛选偏好 !== undefined) {
    const 偏好 = 草稿.筛选偏好;
    const 拷贝: 求职初筛偏好 = { 求职类型: [...偏好.求职类型], 办公方式: [...偏好.办公方式] };
    if (偏好.毕业时间 !== undefined) 拷贝.毕业时间 = 偏好.毕业时间;
    if (偏好.实习月数 !== undefined) 拷贝.实习月数 = 偏好.实习月数;
    if (偏好.每周到岗天数 !== undefined) 拷贝.每周到岗天数 = 偏好.每周到岗天数;
    快照.筛选偏好 = 拷贝;
  }
  if (草稿.薪资 !== undefined) {
    const 薪资: NonNullable<候选引导草稿快照['薪资']> = {
      下限: 草稿.薪资.下限,
      上限: 草稿.薪资.上限,
    };
    if (草稿.薪资.单位 !== undefined) 薪资.单位 = 草稿.薪资.单位;
    快照.薪资 = 薪资;
  }
  if (草稿.到岗 !== undefined) 快照.到岗 = 草稿.到岗;
  try {
    存储.setItem(候选引导草稿键(范围), JSON.stringify(快照));
    return true;
  } catch {
    return false;
  }
}

/** 删除候选 onboarding 草稿（登出 / 401 / 切角色 / 换主体的统一清理口）。 */
export function 删候选引导草稿(存储: 资料缓存存储 | null, 范围: 资料缓存范围): void {
  if (!存储) return;
  try {
    存储.removeItem(候选引导草稿键(范围));
  } catch {
    // 存储不可用时无键可清。
  }
}
