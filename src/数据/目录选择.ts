// 目录选择 helper（Task 4）：分页目录查询的纯函数 + 通用分页选择 hook。
//
// 选择器（职位 / 行业 / 专业 / 学校 / 经历行业弹层）在 Backend 模式按需查询 BFF catalog，
// 查询返回 { items, nextCursor }。合并目录页 按 id 去重累积；
// 可提交Taxonomy 判定 selectable 叶子；学校副标题 拼出「城市 · 国家」副行文案。
// 创建分页选择 是一个 React hook：管理单个选择器当前会话的累积 items / loading / error / 加载更多，
// 不持久化、不跨 session（卸载即丢）。

import { useCallback, useEffect, useRef, useState } from 'react';
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

/** 分页查询方法签名：传 cursor 翻页，返回累积前的单页 + 下一页游标 */
export type 加载一页<T> = (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>;

export interface 分页选择状态<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  /** 还有下一页（nextCursor 非空）*/
  还有: boolean;
  /** 加载下一页：无 cursor 时请求首页（重置累积）*/
  加载更多: () => Promise<void>;
  /** 重置回空，下次 加载更多 重新取首页 */
  重置: () => void;
}

/**
 * 通用分页选择 hook：管理当前选择器会话的累积 items / loading / error / 加载更多。
 * 不持久化、不跨 session：卸载时 state 自然丢弃。
 *
 * 用法：选择器组件调 `const { items, loading, 加载更多, 重置 } = 创建分页选择(加载一页)`，
 * mount 时按需触发 加载更多() 取首页，展开/搜索切换时 重置() 再取。
 */
export function 创建分页选择<T extends { id: string }>(loadPage: 加载一页<T>): 分页选择状态<T> {
  const [items, 设items] = useState<T[]>([]);
  const [loading, 设loading] = useState(false);
  const [error, 设error] = useState<string | null>(null);
  const [cursor, 设cursor] = useState<string | null>(null);
  const [还有, 设还有] = useState(false);
  // 首页请求标识：避免重复首页请求
  const 已请求首页 = useRef(false);
  const 方法引用 = useRef(loadPage);
  方法引用.current = loadPage;
  const 取消引用 = useRef(false);

  const 加载更多 = useCallback(async () => {
    const 方法 = 方法引用.current;
    if (!方法) return;
    设loading(true);
    设error(null);
    try {
      const 页 = await 方法(cursor ?? undefined);
      if (取消引用.current) return;
      设items((旧) => 合并目录页(旧, 页.items));
      设cursor(页.nextCursor);
      设还有(页.nextCursor !== null);
      已请求首页.current = true;
    } catch (e) {
      if (取消引用.current) return;
      设error(e instanceof Error ? e.message : '加载失败');
    } finally {
      if (!取消引用.current) 设loading(false);
    }
  }, [cursor]);

  const 重置 = useCallback(() => {
    取消引用.current = false;
    设items([]);
    设cursor(null);
    设还有(false);
    设error(null);
    设loading(false);
    已请求首页.current = false;
  }, []);

  useEffect(() => {
    取消引用.current = false;
    return () => {
      取消引用.current = true;
    };
  }, []);

  return { items, loading, error, 还有, 加载更多, 重置 };
}