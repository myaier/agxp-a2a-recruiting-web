// 目录选择 helper（Task 4）：分页目录查询的纯函数。
//
// 选择器（职位 / 行业 / 专业 / 学校 / 经历行业弹层）在 Backend 模式按需查询 BFF catalog，
// 查询返回 { items, nextCursor }。合并目录页 按 id 去重累积；
// 可提交Taxonomy 判定 selectable 叶子；学校副标题 拼出「城市 · 国家」副行文案。

import type { BFFTaxonomyItem, BFFInstitutionItem } from './BFF契约';

/** 按 id 去重合并两页：旧表已有的不再进。保留导航节点（selectable=false）—— 它们是展开入口 */
export function 合并目录页<T extends { id: string }>(oldItems: T[], newItems: T[]): T[] {
  const seen = new Set(oldItems.map((item) => item.id));
  return [...oldItems, ...newItems.filter((item) => !seen.has(item.id))];
}

/** taxonomy 项只有 selectable=true 才能被选中提交（非 selectable 只做展开导航）*/
export function 可提交Taxonomy(item: BFFTaxonomyItem): boolean {
  return item.selectable;
}

/** 学校候选副行：`城市 · 国家`。institution 嵌套 location，复用其 display_name / country_name */
export function 学校副标题(item: BFFInstitutionItem): string {
  return `${item.location.display_name} · ${item.location.country_name}`;
}