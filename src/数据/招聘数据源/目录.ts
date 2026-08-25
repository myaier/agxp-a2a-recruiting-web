// 目录域数据源：BFF /api/v1/catalog 的分页查询与缓存。
// 从 HTTP招聘数据源 按真实后端 owner 拆出，协议代码（path / method / 分页循环 / in-flight 去重 / .catch）
// 原样搬移，不改 URL、query 编码、DTO 校验或错误透传。接口失败绝不回退 Mock。

import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type { BFF目录引用, BFFTaxonomyItem, BFFLocationItem, BFFInstitutionItem } from '../BFF契约';
import type { 目录页, Taxonomy查询, Location查询, Institution查询 } from '../招聘数据源类型';

interface BFF目录页<T extends { id: string; display_name: string }> {
  items: T[];
  next_cursor: string | null;
  catalog_version: string;
}

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

export interface 目录数据源 {
  查询Taxonomy(kind: 'job-categories' | 'industries' | 'majors', query: Taxonomy查询): Promise<目录页<BFFTaxonomyItem>>;
  查询Location(query: Location查询): Promise<目录页<BFFLocationItem>>;
  查询Institution(query: Institution查询): Promise<目录页<BFFInstitutionItem>>;
  清空目录缓存(): void;
}

export function 创建目录数据源(请求: 请求函数): 目录数据源 {
  // 目录页面缓存：分页查询的 in-flight 去重 + 已请求页面缓存。key = endpoint?normalizedQuery。
  // 只缓存当前 session 已请求页面；清空目录缓存 清空它。
  const 目录页面缓存 = new Map<string, Promise<unknown>>();

  /** 把查询参数编码成稳定 query string：丢掉 undefined 与空串，limit:20 与缺省都稳定。 */
  function 编码查询(entries: [string, string | number | undefined][]): string {
    const params = new URLSearchParams();
    for (const [key, value] of entries) if (value !== undefined && value !== '') params.set(key, String(value));
    return params.toString();
  }

  /** 一页查询：同 key in-flight 去重；失败时从缓存里删掉这个 key 再抛。 */
  async function 查询一页<T extends BFF目录引用>(path: `/api/v1/catalog/${string}`, query: string): Promise<目录页<T>> {
    const key = `${path}?${query}`;
    const existing = 目录页面缓存.get(key) as Promise<目录页<T>> | undefined;
    if (existing) return existing;
    const pending = 请求<BFF目录页<T>>({ path: `${path}${query ? `?${query}` : ''}` as `/api/v1/${string}` })
      .then(({ result }) => ({ items: result.items, nextCursor: result.next_cursor, catalogVersion: result.catalog_version }))
      .catch((error) => { 目录页面缓存.delete(key); throw error; });
    目录页面缓存.set(key, pending);
    return pending;
  }

  return {
    查询Taxonomy(kind, query) {
      const path = `/api/v1/catalog/${kind}` as `/api/v1/catalog/${string}`;
      const query_string = 编码查询([
        ['parent_id', query.parentId],
        ['q', query.q],
        ['cursor', query.cursor],
        ['limit', query.limit],
      ]);
      return 查询一页<BFFTaxonomyItem>(path, query_string);
    },
    查询Location(query) {
      const path = '/api/v1/catalog/locations';
      const query_string = 编码查询([
        ['q', query.q],
        ['country_code', query.countryCode],
        ['admin1_code', query.admin1Code],
        ['cursor', query.cursor],
        ['limit', query.limit],
      ]);
      return 查询一页<BFFLocationItem>(path, query_string);
    },
    查询Institution(query) {
      const path = '/api/v1/catalog/education-institutions';
      const query_string = 编码查询([
        ['q', query.q],
        ['country_code', query.countryCode],
        ['location_id', query.locationId],
        ['cursor', query.cursor],
        ['limit', query.limit],
      ]);
      return 查询一页<BFFInstitutionItem>(path, query_string);
    },
    清空目录缓存() {
      目录页面缓存.clear();
    },
  };
}