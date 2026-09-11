// 账号资料的浏览器缓存边界。
//
// Mock 是单一演示账号，允许在 localStorage 持久化，但键必须带环境和账号。
// Backend 只在 sessionStorage 保留尚未接服务端的页面资料，并以后端环境 + subject_id
// 隔离。这不是“前端加密”，而是缩短留存时间、阻止跨账号/跨环境串读。

import type { 后端环境 } from '../配置/运行配置';
import type { 办公偏好, 求职类型, 求职初筛偏好 } from '../流程/onboarding配置';
import type { 公司自述覆盖, 规则, 先问偏好, 基本信息, 简历经历段, 简历教育段, 简历项目, 简历证书 } from './类型';
import type { 建档待写入 } from './招聘数据源类型';

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
  /** 仅 Mock 本地演示持久化；Backend 始终由 Agent settings 权威接口水合。 */
  求职先问偏好?: 先问偏好;
  /** 仅 Mock 本地演示持久化；Backend 不把它写进浏览器缓存。 */
  企业先问偏好?: 先问偏好;
  /** Mock 规则清单；Backend 规则只来自服务端，不写这里。 */
  排除规则?: 规则[];
  全局规则?: 规则[];
  意向级规则?: 规则[];
  企业规则?: 规则[];
  // ── P1C：可恢复的组织选择（恢复值须经最新 affiliations 校验）──
  当前企业关系编号?: string | null;
  未认证公司声明?: string;
  /** 候选当前意向选择偏好（恢复值须经最新权威意向列表校验）；旧缓存无此字段仍合法。 */
  当前意向编号?: string | null;
}

/** Mock 种子 / 空账号资料：旧字段全量必带的形状（Mock migration 仍显式补齐旧字段）。 */
export type 完整Mock资料快照 = Required<Pick<资料缓存快照,
  '公司自述' | '企业认证' | '招聘头像' | '公司LOGO' | '求职头像' | '飞书已接入' | '企业飞书已接入' |
  '求职先问偏好' | '企业先问偏好'
>> & Pick<资料缓存快照, '全局规则' | '意向级规则' | '企业规则'>;

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

function 是先问偏好(值: unknown): 值 is 先问偏好 {
  if (typeof 值 !== 'object' || 值 === null || Array.isArray(值)) return false;
  const raw = 值 as Record<string, unknown>;
  if (Object.keys(raw).length !== 2) return false;
  return (raw.递交材料 === '先问我' || raw.递交材料 === '自动发送') &&
    (raw.超授权让步 === '先问我' || raw.超授权让步 === '直接回绝');
}

function 是Mock规则数组(值: unknown): 值 is 规则[] {
  if (!Array.isArray(值) || 值.length > 200) return false;
  const 编号们 = new Set<string>();
  for (const 条 of 值) {
    if (typeof 条 !== 'object' || 条 === null || Array.isArray(条)) return false;
    const raw = 条 as Record<string, unknown>;
    const 键们 = Object.keys(raw);
    if (键们.length !== 4 || !['编号', '内容', '来源', '生效'].every((键) => 键 in raw)) return false;
    if (typeof raw.编号 !== 'string' || raw.编号.length === 0 || raw.编号.length > 100 || 编号们.has(raw.编号)) return false;
    if (typeof raw.内容 !== 'string' || raw.内容.length === 0 || raw.内容.length > 10_000) return false;
    if (typeof raw.来源 !== 'string' || raw.来源.length > 1_000 || typeof raw.生效 !== 'boolean') return false;
    编号们.add(raw.编号);
  }
  return true;
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
    if (是先问偏好(值.求职先问偏好)) 快照.求职先问偏好 = 值.求职先问偏好;
    if (是先问偏好(值.企业先问偏好)) 快照.企业先问偏好 = 值.企业先问偏好;
    if (范围.模式 === 'mock' && 是Mock规则数组(值.排除规则)) 快照.排除规则 = 值.排除规则;
    if (是Mock规则数组(值.全局规则)) 快照.全局规则 = 值.全局规则;
    if (是Mock规则数组(值.意向级规则)) 快照.意向级规则 = 值.意向级规则;
    if (是Mock规则数组(值.企业规则)) 快照.企业规则 = 值.企业规则;
    // P1C：组织选择的新键逐键守卫——损坏类型被丢弃，不进入应用状态
    if (值.当前企业关系编号 === null || typeof 值.当前企业关系编号 === 'string') {
      快照.当前企业关系编号 = 值.当前企业关系编号;
    }
    if (typeof 值.未认证公司声明 === 'string') 快照.未认证公司声明 = 值.未认证公司声明;
    // 候选选择偏好同口径逐键守卫：只收 null 或非空字符串，空串/其它类型丢弃
    if (值.当前意向编号 === null || (typeof 值.当前意向编号 === 'string' && 值.当前意向编号 !== '')) {
      快照.当前意向编号 = 值.当前意向编号;
    }
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
      求职先问偏好: { 递交材料: '先问我', 超授权让步: '先问我' },
      企业先问偏好: { 递交材料: '先问我', 超授权让步: '先问我' },
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
  /** 首屏默认（Task 5B）：学生分流「是否在校」的显式选择；缺省 = 未选择 */
  在校选择?: boolean;
  /** J-PILOT-02 Task 2（Global 7）：建档增量（未提交输入/编辑层/单一未结算写入槽）；缺省 = 旧草稿兼容。 */
  建档?: 候选引导建档草稿;
}

export const 候选引导草稿分类 = '候选引导草稿v1';

/** 候选 onboarding 草稿的 sessionStorage 键：与 账号存储键 同口径（模式 + 环境 + 账号）。 */
export const 候选引导草稿键 = (范围: 资料缓存范围): string => 账号存储键(候选引导草稿分类, 范围);

const 候选草稿根键们: readonly string[] = ['城市们', '职位', '城市引用们', '职位引用们', '筛选偏好', '薪资', '到岗', '在校选择', '建档'];
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
  if (候选.在校选择 !== undefined && typeof 候选.在校选择 !== 'boolean') return false;
  if (候选.建档 !== undefined && !是候选引导建档草稿(候选.建档)) return false;
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
  if (草稿.在校选择 !== undefined) 快照.在校选择 = 草稿.在校选择;
  if (草稿.建档 !== undefined) 快照.建档 = 拷贝建档草稿(草稿.建档);
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

// ── J-PILOT-02 Task 2（Global 7）：候选 onboarding 建档草稿的 sessionStorage 白名单 ──
// 只缓存「服务端尚未接管」的建档增量：未提交资料输入、编辑层原表单字段、
// 已存条目/分区身份、单条未结算写入槽与文件核对元数据。未出现字段兼容旧草稿；
// 在场的损坏/未知字段（含凭据、PDF 字节/文本）整条拒绝并删除。
// 文件操作不存字节；回执只存 ID/revision/aggregate_revision/source tuple。

export type 建档条目种类 = 'experience' | 'project' | 'education' | 'certificate';

export interface 建档已存条目 {
  本地编号: string;
  种类: 建档条目种类;
  资源编号: string;
  revision: number;
  父编号?: string;
}

export interface 建档明确删除条目 {
  种类: 建档条目种类;
  资源编号: string;
  revision: number;
  父编号?: string;
}

/** 建档资料草稿：页面简历写入中用户明确输入的字段（各键可缺省 = 未填/未改），不含服务端快照。 */
export interface 建档资料草稿 {
  基本信息?: Partial<基本信息>;
  个人优势?: string;
  技能?: string[];
  经历?: 简历经历段[];
  教育?: 简历教育段[];
  证书?: 简历证书[];
  /** 属性缺省 = 未改；存在（含 null）= 用户已修改（null = 清空）。 */
  作品集链接?: string | null;
}

/** 现有教育/经历/项目/证书编辑器的未完成表单：判别种类 + 本地编号 + 原表单字段（允许不完整字符串）。 */
export type 建档编辑中草稿 =
  | { 种类: 'education'; 本地编号: string; 字段: Omit<Partial<简历教育段>, '编号'> }
  | { 种类: 'experience'; 本地编号: string; 字段: Omit<Partial<简历经历段>, '编号'> }
  | { 种类: 'project'; 本地编号: string; 父编号?: string; 字段: Omit<Partial<简历项目>, '编号'> }
  | { 种类: 'certificate'; 本地编号: string; 字段: Omit<Partial<简历证书>, '编号'> };

export interface 候选引导建档草稿 {
  位置?: { pathname: string; search: string; 题序?: number };
  资料?: 建档资料草稿;
  编辑中?: 建档编辑中草稿;
  排除项?: string[];
  自定义诉求?: string[];
  已存条目?: 建档已存条目[];
  已存分区?: { profile?: number; summary?: number; skills?: number };
  明确删除条目?: 建档明确删除条目[];
  公司待选?: {
    搜索词: string;
    选择?: { organization_id: string; display_name: string; legal_name: string };
  };
  首次意向?: { id: string; revision: number };
  待写入?: 建档待写入;
  头像状态?: '未选' | '待核对' | '已保存' | '已放弃';
}

const 建档键们: readonly string[] = [
  '位置', '资料', '编辑中', '排除项', '自定义诉求', '已存条目', '已存分区',
  '明确删除条目', '公司待选', '首次意向', '待写入', '头像状态',
];
const 建档条目种类们: readonly 建档条目种类[] = ['experience', 'project', 'education', 'certificate'];
const 头像状态们: readonly string[] = ['未选', '待核对', '已保存', '已放弃'];
const 待写入种类们: readonly string[] = [
  'profile', 'summary', 'skills',
  'experience-create', 'experience-update', 'experience-delete',
  'project-create', 'project-update', 'project-delete',
  'education-create', 'education-update', 'education-delete',
  'certificate-create', 'certificate-update', 'certificate-delete',
  'first-intention-create', 'first-intention-update',
  'organization-block', 'organization-unblock',
  'resume-file-create', 'resume-file-replace', 'resume-file-parse',
  'avatar',
];
const 待写入键们: readonly string[] = ['种类', '本地编号', '资源编号', '父编号', '请求体', '幂等键', 'ifMatch', '阶段', '回执', '文件核对'];

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === 'object' && 值 !== null && !Array.isArray(值);
}

function 是键集闭(值: Record<string, unknown>, 允许键: readonly string[]): boolean {
  return Object.keys(值).every((键) => 允许键.includes(键));
}

function 是非负整数(值: unknown): 值 is number {
  return 是有限整数(值) && 值 >= 0;
}

function 是非空串(值: unknown): 值 is string {
  return typeof 值 === 'string' && 值 !== '';
}

function 是建档位置(值: unknown): 值 is 候选引导建档草稿['位置'] {
  if (!是记录(值) || !是键集闭(值, ['pathname', 'search', '题序'])) return false;
  if (typeof 值.pathname !== 'string' || typeof 值.search !== 'string') return false;
  if (值.题序 !== undefined && !是非负整数(值.题序)) return false;
  return true;
}

const 基本信息键们: readonly string[] = ['真名', '开始工作年', '身份', '在读学历', '毕业年', '性别', '出生年', '出生月'];
const 身份们: readonly string[] = ['', '在校', '在职', '离职'];

function 是建档基本信息(值: unknown): 值 is 建档资料草稿['基本信息'] {
  if (!是记录(值) || !是键集闭(值, 基本信息键们)) return false;
  for (const 键 of ['真名', '开始工作年', '在读学历', '毕业年', '出生年', '出生月'] as const) {
    if (值[键] !== undefined && typeof 值[键] !== 'string') return false;
  }
  if (值.身份 !== undefined && (typeof 值.身份 !== 'string' || !身份们.includes(值.身份))) return false;
  if (值.性别 !== undefined && 值.性别 !== '男' && 值.性别 !== '女') return false;
  return true;
}

function 是建档项目(值: unknown): 值 is 简历项目 {
  if (!是记录(值) || !是键集闭(值, ['编号', '名称', '角色', '结果'])) return false;
  return ['编号', '名称', '角色', '结果'].every((键) => typeof 值[键] === 'string');
}

const 经历键们: readonly string[] = ['编号', '公司', '行业', '行业引用', '职位', '开始', '结束', '内容', '隐藏', '实习', '项目'];

function 是建档经历段(值: unknown): 值 is 简历经历段 {
  if (!是记录(值) || !是键集闭(值, 经历键们)) return false;
  for (const 键 of ['编号', '公司', '行业', '职位', '开始', '内容']) {
    if (typeof 值[键] !== 'string') return false;
  }
  if (值.结束 !== null && typeof 值.结束 !== 'string') return false;
  if (typeof 值.隐藏 !== 'boolean') return false;
  if (值.行业引用 !== undefined && !是草稿引用(值.行业引用)) return false;
  if (值.实习 !== undefined && typeof 值.实习 !== 'boolean') return false;
  if (值.项目 !== undefined && !(Array.isArray(值.项目) && 值.项目.every(是建档项目))) return false;
  return true;
}

const 教育键们: readonly string[] = ['编号', '学校', '学校引用', '学历', '专业', '专业引用', '开始', '结束'];

function 是建档教育段(值: unknown): 值 is 简历教育段 {
  if (!是记录(值) || !是键集闭(值, 教育键们)) return false;
  for (const 键 of ['编号', '学校', '学历', '专业', '开始', '结束']) {
    if (typeof 值[键] !== 'string') return false;
  }
  if (值.学校引用 !== undefined && !是草稿引用(值.学校引用)) return false;
  if (值.专业引用 !== undefined && !是草稿引用(值.专业引用)) return false;
  return true;
}

function 是建档证书(值: unknown): 值 is 简历证书 {
  if (!是记录(值) || !是键集闭(值, ['编号', '名称', '年份'])) return false;
  return ['编号', '名称', '年份'].every((键) => typeof 值[键] === 'string');
}

function 是建档资料(值: unknown): 值 is 建档资料草稿 {
  if (!是记录(值) || !是键集闭(值, ['基本信息', '个人优势', '技能', '经历', '教育', '证书', '作品集链接'])) return false;
  if (值.基本信息 !== undefined && !是建档基本信息(值.基本信息)) return false;
  if (值.个人优势 !== undefined && typeof 值.个人优势 !== 'string') return false;
  if (值.技能 !== undefined && !是字符串数组(值.技能)) return false;
  if (值.经历 !== undefined && !(Array.isArray(值.经历) && 值.经历.every(是建档经历段))) return false;
  if (值.教育 !== undefined && !(Array.isArray(值.教育) && 值.教育.every(是建档教育段))) return false;
  if (值.证书 !== undefined && !(Array.isArray(值.证书) && 值.证书.every(是建档证书))) return false;
  if (值.作品集链接 !== undefined && 值.作品集链接 !== null && typeof 值.作品集链接 !== 'string') return false;
  return true;
}

const 教育编辑键们: readonly string[] = ['学校', '学校引用', '学历', '专业', '专业引用', '开始', '结束'];
const 经历编辑键们: readonly string[] = ['公司', '行业', '行业引用', '职位', '开始', '结束', '内容', '隐藏', '实习'];
const 项目编辑键们: readonly string[] = ['名称', '角色', '结果'];
const 证书编辑键们: readonly string[] = ['名称', '年份'];

/** 编辑层的未完成字段集：键在白名单内、值按编辑器原类型（串/引用/布尔/null）逐一校验。 */
function 是编辑字段集(值: unknown, 允许键: readonly string[], 校验: (键: string, 值: unknown) => boolean): 值 is Record<string, unknown> {
  if (!是记录(值)) return false;
  for (const 键 of Object.keys(值)) {
    if (!允许键.includes(键) || !校验(键, 值[键])) return false;
  }
  return true;
}

function 是建档编辑中(值: unknown): 值 is 建档编辑中草稿 {
  if (!是记录(值) || typeof 值.种类 !== 'string' || !是非空串(值.本地编号)) return false;
  switch (值.种类) {
    case 'education':
      if (!是键集闭(值, ['种类', '本地编号', '字段'])) return false;
      return 是编辑字段集(值.字段, 教育编辑键们, (键, 字段值) =>
        (键 === '学校引用' || 键 === '专业引用') ? 是草稿引用(字段值) : typeof 字段值 === 'string');
    case 'experience':
      if (!是键集闭(值, ['种类', '本地编号', '字段'])) return false;
      return 是编辑字段集(值.字段, 经历编辑键们, (键, 字段值) => {
        if (键 === '行业引用') return 是草稿引用(字段值);
        if (键 === '结束') return 字段值 === null || typeof 字段值 === 'string';
        if (键 === '隐藏' || 键 === '实习') return typeof 字段值 === 'boolean';
        return typeof 字段值 === 'string';
      });
    case 'project':
      if (!是键集闭(值, ['种类', '本地编号', '父编号', '字段'])) return false;
      if (值.父编号 !== undefined && typeof 值.父编号 !== 'string') return false;
      return 是编辑字段集(值.字段, 项目编辑键们, (_, 字段值) => typeof 字段值 === 'string');
    case 'certificate':
      if (!是键集闭(值, ['种类', '本地编号', '字段'])) return false;
      return 是编辑字段集(值.字段, 证书编辑键们, (_, 字段值) => typeof 字段值 === 'string');
    default:
      return false;
  }
}

function 是建档已存条目(值: unknown): 值 is 建档已存条目 {
  if (!是记录(值) || !是键集闭(值, ['本地编号', '种类', '资源编号', 'revision', '父编号'])) return false;
  if (!是非空串(值.本地编号) || !是非空串(值.资源编号)) return false;
  if (typeof 值.种类 !== 'string' || !(建档条目种类们 as readonly string[]).includes(值.种类)) return false;
  if (!是非负整数(值.revision)) return false;
  if (值.父编号 !== undefined && typeof 值.父编号 !== 'string') return false;
  return true;
}

function 是建档明确删除条目(值: unknown): 值 is 建档明确删除条目 {
  if (!是记录(值) || !是键集闭(值, ['种类', '资源编号', 'revision', '父编号'])) return false;
  if (!是非空串(值.资源编号)) return false;
  if (typeof 值.种类 !== 'string' || !(建档条目种类们 as readonly string[]).includes(值.种类)) return false;
  if (!是非负整数(值.revision)) return false;
  if (值.父编号 !== undefined && typeof 值.父编号 !== 'string') return false;
  return true;
}

function 是建档已存分区(值: unknown): 值 is NonNullable<候选引导建档草稿['已存分区']> {
  if (!是记录(值) || !是键集闭(值, ['profile', 'summary', 'skills'])) return false;
  for (const 键 of ['profile', 'summary', 'skills'] as const) {
    if (值[键] !== undefined && !是非负整数(值[键])) return false;
  }
  return true;
}

function 是建档公司待选(值: unknown): 值 is NonNullable<候选引导建档草稿['公司待选']> {
  if (!是记录(值) || !是键集闭(值, ['搜索词', '选择'])) return false;
  if (typeof 值.搜索词 !== 'string') return false;
  if (值.选择 !== undefined) {
    const 选 = 值.选择;
    if (!是记录(选) || !是键集闭(选, ['organization_id', 'display_name', 'legal_name'])) return false;
    if (!是非空串(选.organization_id)) return false;
    if (typeof 选.display_name !== 'string' || typeof 选.legal_name !== 'string') return false;
  }
  return true;
}

function 是建档首次意向(值: unknown): 值 is NonNullable<候选引导建档草稿['首次意向']> {
  if (!是记录(值) || !是键集闭(值, ['id', 'revision'])) return false;
  return 是非空串(值.id) && 是非负整数(值.revision);
}

function 是建档写入回执(值: unknown): 值 is NonNullable<建档待写入['回执']> {
  if (!是记录(值) || !是键集闭(值, ['id', 'revision', 'aggregate_revision', 'source'])) return false;
  if (值.id !== undefined && !是非空串(值.id)) return false;
  if (值.revision !== undefined && !是非负整数(值.revision)) return false;
  if (值.aggregate_revision !== undefined && !是非负整数(值.aggregate_revision)) return false;
  if (值.source !== undefined) {
    const 源 = 值.source;
    if (!是记录(源) || !是键集闭(源, ['file_id', 'version_id', 'parse_id'])) return false;
    if (!是非空串(源.file_id) || !是非空串(源.version_id)) return false;
    if (源.parse_id !== null && typeof 源.parse_id !== 'string') return false;
  }
  return true;
}

function 是建档文件核对(值: unknown): 值 is NonNullable<建档待写入['文件核对']> {
  if (!是记录(值) || !是键集闭(值, ['name', 'type', 'size', 'lastModified', 'sha256'])) return false;
  if (typeof 值.name !== 'string' || typeof 值.type !== 'string' || typeof 值.sha256 !== 'string') return false;
  return 是非负整数(值.size) && 是非负整数(值.lastModified);
}

function 是建档待写入(值: unknown): 值 is 建档待写入 {
  if (!是记录(值) || !是键集闭(值, 待写入键们)) return false;
  if (typeof 值.种类 !== 'string' || !待写入种类们.includes(值.种类)) return false;
  for (const 键 of ['本地编号', '资源编号', '父编号', '幂等键'] as const) {
    if (值[键] !== undefined && typeof 值[键] !== 'string') return false;
  }
  if (值.请求体 !== undefined && !是记录(值.请求体)) return false;
  if (值.ifMatch !== undefined && !是非负整数(值.ifMatch)) return false;
  if (值.阶段 !== 'prepared' && 值.阶段 !== 'received') return false;
  if (值.回执 !== undefined && !是建档写入回执(值.回执)) return false;
  if (值.文件核对 !== undefined && !是建档文件核对(值.文件核对)) return false;
  return true;
}

function 是候选引导建档草稿(值: unknown): 值 is 候选引导建档草稿 {
  if (!是记录(值) || !是键集闭(值, 建档键们)) return false;
  if (值.位置 !== undefined && !是建档位置(值.位置)) return false;
  if (值.资料 !== undefined && !是建档资料(值.资料)) return false;
  if (值.编辑中 !== undefined && !是建档编辑中(值.编辑中)) return false;
  if (值.排除项 !== undefined && !是字符串数组(值.排除项)) return false;
  if (值.自定义诉求 !== undefined && !是字符串数组(值.自定义诉求)) return false;
  if (值.已存条目 !== undefined && !(Array.isArray(值.已存条目) && 值.已存条目.every(是建档已存条目))) return false;
  if (值.已存分区 !== undefined && !是建档已存分区(值.已存分区)) return false;
  if (值.明确删除条目 !== undefined && !(Array.isArray(值.明确删除条目) && 值.明确删除条目.every(是建档明确删除条目))) return false;
  if (值.公司待选 !== undefined && !是建档公司待选(值.公司待选)) return false;
  if (值.首次意向 !== undefined && !是建档首次意向(值.首次意向)) return false;
  if (值.待写入 !== undefined && !是建档待写入(值.待写入)) return false;
  if (值.头像状态 !== undefined
    && (typeof 值.头像状态 !== 'string' || !(头像状态们 as readonly string[]).includes(值.头像状态))) return false;
  return true;
}

/** 写入构造全新白名单对象（含 建档 内层），不展开调用方对象，不带未知键落盘。 */
function 拷贝建档草稿(建档: 候选引导建档草稿): 候选引导建档草稿 {
  const 拷贝: 候选引导建档草稿 = {};
  if (建档.位置 !== undefined) {
    拷贝.位置 = { pathname: 建档.位置.pathname, search: 建档.位置.search };
    if (建档.位置.题序 !== undefined) 拷贝.位置.题序 = 建档.位置.题序;
  }
  if (建档.资料 !== undefined) 拷贝.资料 = structuredClone(建档.资料);
  if (建档.编辑中 !== undefined) 拷贝.编辑中 = structuredClone(建档.编辑中);
  if (建档.排除项 !== undefined) 拷贝.排除项 = [...建档.排除项];
  if (建档.自定义诉求 !== undefined) 拷贝.自定义诉求 = [...建档.自定义诉求];
  if (建档.已存条目 !== undefined) 拷贝.已存条目 = structuredClone(建档.已存条目);
  if (建档.已存分区 !== undefined) {
    const 分区: NonNullable<候选引导建档草稿['已存分区']> = {};
    if (建档.已存分区.profile !== undefined) 分区.profile = 建档.已存分区.profile;
    if (建档.已存分区.summary !== undefined) 分区.summary = 建档.已存分区.summary;
    if (建档.已存分区.skills !== undefined) 分区.skills = 建档.已存分区.skills;
    拷贝.已存分区 = 分区;
  }
  if (建档.明确删除条目 !== undefined) 拷贝.明确删除条目 = structuredClone(建档.明确删除条目);
  if (建档.公司待选 !== undefined) {
    拷贝.公司待选 = { 搜索词: 建档.公司待选.搜索词 };
    if (建档.公司待选.选择 !== undefined) {
      拷贝.公司待选.选择 = {
        organization_id: 建档.公司待选.选择.organization_id,
        display_name: 建档.公司待选.选择.display_name,
        legal_name: 建档.公司待选.选择.legal_name,
      };
    }
  }
  if (建档.首次意向 !== undefined) 拷贝.首次意向 = { id: 建档.首次意向.id, revision: 建档.首次意向.revision };
  if (建档.待写入 !== undefined) 拷贝.待写入 = structuredClone(建档.待写入);
  if (建档.头像状态 !== undefined) 拷贝.头像状态 = 建档.头像状态;
  return 拷贝;
}

/** 建档草稿的 subject 绑定读写口（与 候选预填恢复存储 同模式）：只动 建档 子键，不顶掉既有向导答案。 */
export interface 候选建档草稿存储 {
  /** 只回当前 scope 记录里的 建档 子键（记录缺失/损坏/无 建档 → null）。 */
  读取(): 候选引导建档草稿 | null;
  /** 校验入参并把 建档 合并进既有记录（无记录则建最小记录，不虚构向导答案）；失败返回 false。 */
  写入(建档: 候选引导建档草稿): boolean;
}

export function 创建候选建档草稿存储(input: { storage: 资料缓存存储 | null; 范围: 资料缓存范围 }): 候选建档草稿存储 {
  const { storage, 范围 } = input;
  return {
    读取() {
      return 读候选引导草稿(storage, 范围)?.建档 ?? null;
    },
    写入(建档) {
      if (!storage || !是候选引导建档草稿(建档)) return false;
      const 现有 = 读候选引导草稿(storage, 范围) ?? { 城市们: [], 职位: [] };
      return 写候选引导草稿(storage, 范围, { ...现有, 建档 });
    },
  };
}
