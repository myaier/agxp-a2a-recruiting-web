// 组织查询钩子（Task 4）：屏蔽名单 Backend 分支的可屏蔽组织搜索。
// 与 城市查询钩子 同一套代际守卫：250ms debounce；设词 / 换源 / 点选 / 显式重查
// 都递增代际，在飞的旧响应只有代际仍最新才允许提交，翻页态随代际一并释放。
// 搜索结果、选中项与游标全部留在本钩子实例里 —— 不进全局状态、不进本地存储；
// Mock 模式不传 search：所有方法退化为空操作，绝不发起搜索。

import { useEffect, useRef, useState } from 'react';
import type { BFF组织搜索项, BFF组织搜索页 } from '../数据/BFF契约';
import type { 组织搜索查询 } from '../数据/招聘数据源类型';
import type { 屏蔽来源 } from '../数据/类型';

const 搜索防抖毫秒 = 250;
const 默认页大小 = 20;

export type 查询组织方法 = (query: 组织搜索查询) => Promise<BFF组织搜索页>;

/** 按 organization_id 去重：跨页合并时同一组织可能出现两次 */
function 去重(项们: BFF组织搜索项[]): BFF组织搜索项[] {
  const seen = new Set<string>();
  const out: BFF组织搜索项[] = [];
  for (const 项 of 项们) {
    if (seen.has(项.organization_id)) continue;
    seen.add(项.organization_id);
    out.push(项);
  }
  return out;
}

export function use组织查询(search?: 查询组织方法) {
  const [来源, 设来源状态] = useState<屏蔽来源 | null>(null);
  const [词, 设词状态] = useState('');
  const [选择, 设选择] = useState<BFF组织搜索项 | null>(null);
  const [结果, 设结果] = useState<BFF组织搜索项[]>([]);
  const [搜索中, 设搜索中] = useState(false);
  const [下一页游标, 设下一页游标] = useState<string | null>(null);
  const [加载中, 设加载中] = useState(false);
  // 重新查询 的再触发通道：词不变也要重跑同一个带 debounce 的首页 effect
  const [刷新计数, 设刷新计数] = useState(0);
  const 计时 = useRef(0);
  const 代际 = useRef(0);
  const 方法引用 = useRef(search);
  方法引用.current = search;

  useEffect(() => () => { 代际.current += 1; }, []); // 卸载即作废一切在飞提交

  useEffect(() => {
    const 方法 = 方法引用.current;
    const trimmed = 词.trim();
    // 刚点选了命中项：词已等于选中项显示名 —— 备选列表保持可见，不再发请求也不清列表
    if (方法 && 来源 !== null && trimmed !== '' && 选择?.display_name === 词) {
      设搜索中(false);
      return;
    }
    // 其余每次变化（输入 / 换源 / 重查）都作废在飞响应并释放翻页加载态
    代际.current += 1;
    设搜索中(false);
    if (!方法 || 来源 === null || trimmed === '') return;
    设搜索中(true);
    const 本次 = 代际.current;
    计时.current = window.setTimeout(async () => {
      try {
        const 页 = await 方法({ q: trimmed, limit: 默认页大小 });
        if (本次 !== 代际.current) return; // stale：已有更新的输入在途/已生效
        设结果(页.items);
        设下一页游标(页.next_cursor);
      } catch {
        // 首页失败：保留输入与任何已展示页面，不请空结果
      } finally {
        if (本次 === 代际.current) 设搜索中(false);
      }
    }, 搜索防抖毫秒);
    return () => window.clearTimeout(计时.current);
    // 选择?.display_name 只作点选回显的护栏：命中 guard 即空操作，入依赖无副作用
  }, [词, 来源, 刷新计数, 选择?.display_name]);

  /** 输入变化：作废一切在飞请求，清空选中与已展示列表/游标 */
  const 设词 = (value: string) => {
    代际.current += 1;
    设词状态(value);
    设选择(null);
    设结果([]);
    设下一页游标(null);
    设加载中(false);
  };

  /** 换源：先前的可屏蔽集合在新来源下不再成立，同样整体作废并清列表 */
  const 设来源 = (value: 屏蔽来源) => {
    代际.current += 1;
    设来源状态(value);
    设选择(null);
    设结果([]);
    设下一页游标(null);
    设加载中(false);
  };

  /** 点选命中项：只记完整项与回显名、释放翻页态；备选列表保持可见供换选 */
  const 选中 = (item: BFF组织搜索项) => {
    代际.current += 1;
    设选择(item);
    设词状态(item.display_name);
    设加载中(false);
  };

  /** 服务端告知所选组织已不存在等场景：弃选中、按同词重查 —— 可见输入文本保持不动 */
  const 重新查询 = () => {
    代际.current += 1;
    设选择(null);
    设结果([]);
    设下一页游标(null);
    设加载中(false);
    设刷新计数((旧) => 旧 + 1);
  };

  /** 翻到下一页：合并去重；双击只发一次（加载中 guard），只提交给仍在同代的视图 */
  const 加载更多 = async () => {
    if (下一页游标 === null || 加载中) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    const 本次 = 代际.current;
    const 游标 = 下一页游标;
    const 本词 = 词.trim();
    设加载中(true);
    try {
      const 页 = await 方法({ q: 本词, cursor: 游标, limit: 默认页大小 });
      if (本次 !== 代际.current) return;
      设结果((旧) => 去重([...旧, ...页.items]));
      设下一页游标(页.next_cursor);
    } catch {
      // 翻页失败：保留已展示页面与游标，仅退出加载态
    } finally {
      if (本次 === 代际.current) 设加载中(false);
    }
  };

  return {
    来源, 设来源,
    词, 设词,
    选择, 选中,
    结果, 搜索中,
    下一页游标, 加载中,
    加载更多, 重新查询,
  };
}
