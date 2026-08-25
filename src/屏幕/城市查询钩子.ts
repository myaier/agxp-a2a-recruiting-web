// 城市查询钩子（Task 3）：选工作城市 / 选择城市 共用的按需 Location 查询。
// 搜索 250ms debounce；分组初次展开请求第一页，直辖市多 filter 聚合后按 ID 去重。
// Mock 分支不调用此钩子（查询Location 传 undefined 时所有方法空操作）。

import { useEffect, useRef, useState } from 'react';
import type { 目录页, Location查询 } from '../数据/招聘数据源类型';
import type { BFFLocationItem } from '../数据/BFF契约';
import type { 城市分组配置 } from '../数据/城市与行业';

const 搜索防抖毫秒 = 250;
const 默认页大小 = 20;

export type 查询Location方法 = (q: Location查询) => Promise<目录页<BFFLocationItem>>;

export interface 分组查询状态 {
  items: BFFLocationItem[];
  加载中: boolean;
  cursor: string | null;
  还有: boolean;
  已请求: boolean;
}

/** 按 ID 去重 BFFLocationItem */
function 去重(项们: BFFLocationItem[]): BFFLocationItem[] {
  const seen = new Set<string>();
  const out: BFFLocationItem[] = [];
  for (const 项 of 项们) {
    if (seen.has(项.id)) continue;
    seen.add(项.id);
    out.push(项);
  }
  return out;
}

/** 按分组展开查询：初次展开请求第一页，直辖市四码合并后去重。 */
export function use城市分组(查询Location: 查询Location方法 | undefined) {
  const [状态表, 设状态表] = useState<Record<string, 分组查询状态>>({});
  const [展开集合, 设展开集合] = useState<Set<string>>(new Set());
  const 方法引用 = useRef(查询Location);
  方法引用.current = 查询Location;

  const 请求首页 = async (组: 城市分组配置) => {
    const 方法 = 方法引用.current;
    const 键 = 组.省;
    // 海外组：filters 为空，不发请求，直接标记已请求（展示组不制造可提交值）
    if (组.filters.length === 0) {
      设状态表((旧) => ({
        ...旧,
        [键]: { items: [], 加载中: false, cursor: null, 还有: false, 已请求: true },
      }));
      return;
    }
    if (!方法) return;
    设状态表((旧) => ({
      ...旧,
      [键]: { items: [], 加载中: true, cursor: null, 还有: false, 已请求: true },
    }));
    try {
      const 页们 = await Promise.all(
        组.filters.map((f) =>
          方法({ countryCode: f.countryCode, admin1Code: f.admin1Code, limit: 默认页大小 }),
        ),
      );
      const 合并 = 去重(页们.flatMap((页) => 页.items));
      const 还有 = 页们.some((页) => 页.nextCursor !== null);
      const cursor = 页们.map((页) => 页.nextCursor).find((c) => c !== null) ?? null;
      设状态表((旧) => ({
        ...旧,
        [键]: { items: 合并, 加载中: false, cursor, 还有, 已请求: true },
      }));
    } catch {
      设状态表((旧) => ({
        ...旧,
        [键]: { items: [], 加载中: false, cursor: null, 还有: false, 已请求: true },
      }));
    }
  };

  const 切换展开 = (组: 城市分组配置) => {
    const 键 = 组.省;
    if (展开集合.has(键)) return;
    设展开集合((旧) => new Set(旧).add(键));
    if (!状态表[键]?.已请求) void 请求首页(组);
  };

  const 加载更多 = async (组: 城市分组配置) => {
    const 键 = 组.省;
    const 状态 = 状态表[键];
    if (!状态 || !状态.还有 || 状态.加载中 || !状态.cursor) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    设状态表((旧) => ({ ...旧, [键]: { ...旧[键], 加载中: true } }));
    try {
      const 页 = await 方法({
        countryCode: 组.filters[0]?.countryCode,
        admin1Code: 组.filters[0]?.admin1Code,
        cursor: 状态.cursor,
        limit: 默认页大小,
      });
      设状态表((旧) => ({
        ...旧,
        [键]: {
          ...旧[键],
          items: 去重([...旧[键].items, ...页.items]),
          加载中: false,
          cursor: 页.nextCursor,
          还有: 页.nextCursor !== null,
        },
      }));
    } catch {
      设状态表((旧) => ({ ...旧, [键]: { ...旧[键], 加载中: false } }));
    }
  };

  return { 状态表, 展开集合, 切换展开, 加载更多 };
}

/** 搜索查询：250ms debounce 后调 查询Location({ q })。 */
export function use城市搜索(查询Location: 查询Location方法 | undefined) {
  const [词, 设词] = useState('');
  const [结果, 设结果] = useState<BFFLocationItem[]>([]);
  const [搜索中, 设搜索中] = useState(false);
  const 计时 = useRef(0);
  const 方法引用 = useRef(查询Location);
  方法引用.current = 查询Location;

  useEffect(() => {
    const 方法 = 方法引用.current;
    const trimmed = 词.trim();
    if (!方法 || trimmed === '') {
      设结果([]);
      设搜索中(false);
      return;
    }
    设搜索中(true);
    window.clearTimeout(计时.current);
    计时.current = window.setTimeout(async () => {
      try {
        const 页 = await 方法({ q: trimmed });
        设结果(页.items);
      } catch {
        设结果([]);
      } finally {
        设搜索中(false);
      }
    }, 搜索防抖毫秒);
    return () => window.clearTimeout(计时.current);
  }, [词]);

  return { 词, 设词, 结果, 搜索中 };
}