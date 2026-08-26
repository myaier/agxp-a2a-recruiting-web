// 账号资料的浏览器缓存边界。
//
// Mock 是单一演示账号，允许在 localStorage 持久化，但键必须带环境和账号。
// Backend 只在 sessionStorage 保留尚未接服务端的页面资料，并以后端环境 + subject_id
// 隔离。这不是“前端加密”，而是缩短留存时间、阻止跨账号/跨环境串读。

import type { 后端环境 } from '../配置/运行配置';
import type { 公司自述覆盖 } from './类型';

export type 资料缓存存储 = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface 资料缓存范围 {
  模式: 'mock' | 'backend';
  环境: 后端环境;
  账号: string;
}

export interface 资料缓存快照 {
  公司自述: 公司自述覆盖 | null;
  企业认证: { 姓名: string; 公司: string; 职务?: string };
  招聘头像: string | null;
  公司LOGO: string | null;
  求职头像: string | null;
  飞书已接入: boolean;
  企业飞书已接入: boolean;
}

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
    return 快照;
  } catch {
    return {};
  }
}

export function 写资料缓存(存储: 资料缓存存储 | null, 范围: 资料缓存范围, 快照: 资料缓存快照): boolean {
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
