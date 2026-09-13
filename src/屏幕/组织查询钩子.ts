// 组织查询钩子（合同 B）：七页共用的实例内 公司 搜索/创建 控制，一个钩子承担
// 搜索与创建，不新增 controller/service 层。与 城市查询钩子 同一套代际守卫：
// 250ms debounce；设词 / 重查 / 作用域切换 都递增代际，在飞的旧响应只有代际仍最新
// 才允许提交，翻页态随代际一并释放。搜索结果与游标全部留在本钩子实例里 ——
// 不进全局状态、不进本地存储；钩子不读 env、Context 或路由，作用域键由页面按
// JSON.stringify([数据源模式, subject_id, last_used_role, 页面资源ID]) 传入。
//
// 选中 ID 只来自父页面：钩子不再持有 选择/选中，也不再有「选中名等于词」的回显守卫。
// 添加（创建）同步单飞：每个提交名称意图保存一个 UUID 幂等键，失败重试同名同键、
// 改名新键；页面关闭/作用域变更后（作废已递增代际）旧创建返回 null，不回填。

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BFF组织创建结果, BFF组织搜索项, BFF组织搜索页 } from '../数据/BFF契约';
import type { 组织搜索查询 } from '../数据/招聘数据源类型';
import { 取后端错误文案 } from '../数据/HTTP客户端';

const 搜索防抖毫秒 = 250;
const 默认页大小 = 20;

export type 查询组织方法 = (query: 组织搜索查询) => Promise<BFF组织搜索页>;
export type 创建组织方法 = (displayName: string, idempotencyKey: string) => Promise<BFF组织创建结果>;

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

export function use组织查询({
  搜索,
  创建,
  作用域键,
}: {
  搜索?: 查询组织方法;
  创建?: 创建组织方法;
  作用域键: string;
}) {
  const [词, 设词状态] = useState('');
  const [结果, 设结果] = useState<BFF组织搜索项[]>([]);
  const [搜索中, 设搜索中] = useState(false);
  const [下一页游标, 设下一页游标] = useState<string | null>(null);
  const [加载中, 设加载中] = useState(false);
  const [搜索错误, 设搜索错误] = useState<string | null>(null);
  const [加载错误, 设加载错误] = useState<string | null>(null);
  const [创建中, 设创建中] = useState(false);
  const [创建错误, 设创建错误] = useState<string | null>(null);
  // 重新查询 的再触发通道：词不变也要重跑同一个带 debounce 的首页 effect
  const [刷新计数, 设刷新计数] = useState(0);
  const 计时 = useRef(0);
  const 代际 = useRef(0);
  const 搜索引用 = useRef(搜索);
  搜索引用.current = 搜索;
  const 创建引用 = useRef(创建);
  创建引用.current = 创建;
  const 创建在飞引用 = useRef(false);
  /** 提交名称 → 幂等键：失败重试同名同键，改名新键（本实例内存，不持久化） */
  const 意图键表 = useRef(new Map<string, string>());

  useEffect(() => () => { 代际.current += 1; }, []); // 卸载即作废一切在飞提交

  /** 作废：同步增加代际并清理定时器与本实例状态。父页面在关闭抽屉
      （取消、Escape、遮罩或成功回填）时先调用作废再隐藏 —— 之后的在飞搜索响应
      与创建回执都因代际已变被丢弃，旧创建返回 null 不回填。 */
  const 作废 = useCallback(() => {
    代际.current += 1;
    window.clearTimeout(计时.current);
    设词状态('');
    设结果([]);
    设下一页游标(null);
    设搜索中(false);
    设加载中(false);
    设搜索错误(null);
    设加载错误(null);
    设创建中(false);
    设创建错误(null);
    创建在飞引用.current = false;
    意图键表.current.clear();
  }, []);

  // 作用域切换：清理本实例并作废在飞请求。只用于清除尚挂载页面已展示的上一主体结果
  // —— 钩子自己的迟到响应栅栏只丢弃过期提交，不清理已经显示的列表。
  const 作用域引用 = useRef(作用域键);
  useEffect(() => {
    if (作用域引用.current === 作用域键) return;
    作用域引用.current = 作用域键;
    作废();
  }, [作用域键, 作废]);

  useEffect(() => {
    const 方法 = 搜索引用.current;
    const trimmed = 词.trim();
    // 每次词变化（输入 / 重查）都作废在飞响应并释放翻页加载态
    代际.current += 1;
    设搜索中(false);
    设搜索错误(null);
    if (!方法 || trimmed === '') return; // 空输入不请求，不虚构热门企业
    设搜索中(true);
    const 本次 = 代际.current;
    计时.current = window.setTimeout(async () => {
      try {
        const 页 = await 方法({ q: trimmed, limit: 默认页大小 });
        if (本次 !== 代际.current) return; // stale：已有更新的输入在途/已生效
        设结果(页.items);
        设下一页游标(页.next_cursor);
      } catch (错误) {
        // 首页失败：置错误文案（与零结果分开，展示层据此给重试），保留输入
        if (本次 !== 代际.current) return;
        设搜索错误(取后端错误文案(错误));
      } finally {
        if (本次 === 代际.current) 设搜索中(false);
      }
    }, 搜索防抖毫秒);
    return () => window.clearTimeout(计时.current);
  }, [词, 刷新计数]);

  /** 输入变化：作废一切在飞请求，清空已展示列表/游标与错误。
      代际递增会把在飞创建一并搁浅（回执只返回 null）—— 这里同步复位创建守卫与
      创建中，否则在飞创建的 finally 两个清理都会被跳过，后续创建被永久卡死。 */
  const 设词 = (value: string) => {
    代际.current += 1;
    设词状态(value);
    设结果([]);
    设下一页游标(null);
    设加载中(false);
    设搜索错误(null);
    设加载错误(null);
    创建在飞引用.current = false;
    设创建中(false);
  };

  /** 同词重查（首页失败重试 / 服务端告知所选组织已不存在等）：清态后重跑首页 effect。
      与 设词 同理：代际递增搁浅在飞创建，同步复位创建守卫。 */
  const 重新查询 = () => {
    代际.current += 1;
    设结果([]);
    设下一页游标(null);
    设加载中(false);
    设搜索错误(null);
    设加载错误(null);
    创建在飞引用.current = false;
    设创建中(false);
    设刷新计数((旧) => 旧 + 1);
  };

  /** 翻到下一页：合并去重；双击只发一次（加载中 guard），只提交给仍在同代的视图 */
  const 加载更多 = async () => {
    if (下一页游标 === null || 加载中) return;
    const 方法 = 搜索引用.current;
    if (!方法) return;
    const 本次 = 代际.current;
    const 游标 = 下一页游标;
    const 本词 = 词.trim();
    设加载中(true);
    try {
      const 页 = await 方法({ q: 本词, cursor: 游标, limit: 默认页大小 });
      if (本次 !== 代际.current) return;
      设加载错误(null);
      设结果((旧) => 去重([...旧, ...页.items]));
      设下一页游标(页.next_cursor);
    } catch (错误) {
      // 翻页失败：保留已展示页面与游标，置加载错误并可再次重试
      if (本次 !== 代际.current) return;
      设加载错误(取后端错误文案(错误));
    } finally {
      if (本次 === 代际.current) 设加载中(false);
    }
  };

  /** 创建（添加并选择）：同步单飞 —— 在途时再点只被挡下；每个提交名称意图保存
      UUID 幂等键，失败重试同名同键、改名新键。作用域变更/作废后返回 null，不回填。
      名称校验（1–80 码点/控制字符）在展示层（公司选择层）把守，这里只透传。 */
  const 添加 = useCallback(async (displayName: string): Promise<BFF组织搜索项 | null> => {
    const 创建方法 = 创建引用.current;
    if (!创建方法 || 创建在飞引用.current) return null;
    const 名称 = displayName.trim();
    if (名称 === '') return null;
    const 本次 = 代际.current;
    let 键 = 意图键表.current.get(名称);
    if (键 === undefined) {
      键 = globalThis.crypto.randomUUID();
      意图键表.current.set(名称, 键);
    }
    创建在飞引用.current = true;
    设创建中(true);
    设创建错误(null);
    try {
      const 回执 = await 创建方法(名称, 键);
      if (本次 !== 代际.current) return null; // 页面关闭/作用域变更后旧创建返回 null
      return 回执.organization;
    } catch (错误) {
      if (本次 !== 代际.current) return null;
      设创建错误(取后端错误文案(错误));
      return null;
    } finally {
      if (本次 === 代际.current) {
        创建在飞引用.current = false;
        设创建中(false);
      }
    }
  }, []);

  return {
    词, 设词,
    结果, 搜索中,
    下一页游标, 加载中,
    加载更多, 重新查询,
    搜索错误, 加载错误,
    创建中, 创建错误,
    添加, 作废,
  };
}