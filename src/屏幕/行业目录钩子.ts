// 行业目录钩子（picker 统一 Task 1）：两处行业选择（选期望行业 / 工作经历行业弹层）共用的
// 具体行业目录控制器。查询适配也放在本文件（Plan 裁定不另建适配文件）：
//   · 创建模拟行业查询 —— 本地 行业字典（src/数据/城市与行业）转 行业页；根仅展开、细分可选，
//     稳定模拟键 mock:industry:<根序>[:<子序>] 与名称分离，不发真实请求；
//   · 创建目录行业查询 —— 注入现有 查询Taxonomy 操作（签名不变），仅转换
//     id/display_name/selectable/has_children、分页游标与 catalogVersion；
//     追加页换版时沿既有 { 强制刷新: true } 口径重开该父项第一页（不跨版本合并）。
// 本文件不读 Context / 数据源模式；页面把 数据源模式+主体身份 拼进 目录身份 注入。
//
// hook 行为契约（Plan 2026-09-14 Task 1）：
//   · 根页挂载拉取；展开/缓存/分页共用；请求去重（同步双击与在飞重复都以在飞集合挡下）；
//   · 收起递归清掉后代可见展开状态但保留缓存和已选；在飞收起可缓存不重开；
//   · 目录换代（页版本变化）：该父项整组重开、后代缓存与展开状态作废，代际作废迟到响应，
//     新版本页成为新缓存起点；目录身份（模式+主体）变更作废全部缓存并重拉根页；
//   · 首载失败=错误+重试入口；分页失败保留游标可再点；成功空页与失败区分。
//
// 状态实现：目录数据以 ref 为真相（提交时先写 ref 再镜像进 state），在飞响应回写时
// 读到的永远是最新缓存，不依赖渲染时机；回调身份稳定（不随渲染换引用）。

import { useEffect, useRef, useState } from 'react';
import type { 行业行, 行业页, 查询行业页 } from '../组件/行业分类列表';
import type { 行业目录状态 } from '../组件/行业分类列表';
import { 行业字典 } from '../数据/城市与行业';
import type { BFFTaxonomyItem } from '../数据/BFF契约';
import type { 目录页, Taxonomy查询 } from '../数据/招聘数据源类型';
import type { 目录查询选项 } from '../数据/招聘数据源/目录';
import { 取后端错误文案 } from '../数据/HTTP客户端';

// ── Mock 适配：本地 行业字典 → 行业页 ─────────────────────────────

const Mock键前缀 = 'mock:industry';

/** 稳定模拟键：根 mock:industry:<根序>；细分 mock:industry:<根序>:<子序>（局部使用，不按名称作 ID） */
function 解析Mock键(键: string): { 根序: number; 子序?: number } | undefined {
  const 匹配 = /^mock:industry:(\d+)(?::(\d+))?$/.exec(键);
  if (!匹配) return undefined;
  const 根序 = Number(匹配[1]);
  return 匹配[2] === undefined ? { 根序 } : { 根序, 子序: Number(匹配[2]) };
}

export const 创建模拟行业查询 = (): 查询行业页 => async (父键) => {
  if (父键 === null) {
    return {
      项: 行业字典.map((组, 序) => ({ 键: `${Mock键前缀}:${序}`, 名称: 组.行业, 可选: false, 有子项: true })),
      下一页: null,
      版本: 'mock',
    };
  }
  const 解析 = 解析Mock键(父键);
  if (!解析 || 解析.子序 !== undefined) return { 项: [], 下一页: null, 版本: 'mock' };
  return {
    项: (行业字典[解析.根序]?.细分 ?? []).map((名, 子序) => ({
      键: `${Mock键前缀}:${解析.根序}:${子序}`,
      名称: 名,
      可选: true,
      有子项: false,
    })),
    下一页: null,
    版本: 'mock',
  };
};

/** 稳定模拟键 → 业务名称（两页引用映射表用：点击选项按键取得原值，不从名称重建） */
export const 模拟行业名 = (键: string): string | undefined => {
  const 解析 = 解析Mock键(键);
  if (!解析) return undefined;
  if (解析.子序 === undefined) return 行业字典[解析.根序]?.行业;
  return 行业字典[解析.根序]?.细分[解析.子序];
};

/** 业务名称 → 稳定模拟键们（已选回显用：同名条目各自成键，互不串） */
export const 模拟行业键们 = (名: string): string[] => {
  const 键们: string[] = [];
  行业字典.forEach((组, 根序) => {
    组.细分.forEach((细分名, 子序) => {
      if (细分名 === 名) 键们.push(`${Mock键前缀}:${根序}:${子序}`);
    });
  });
  return 键们;
};

// ── HTTP 适配：现有 查询Taxonomy('industries') → 行业页 ────────────

type Taxonomy查询方法 = (
  kind: 'industries',
  query: Taxonomy查询,
  选项?: 目录查询选项,
) => Promise<目录页<BFFTaxonomyItem>>;

function 转行业页(页: 目录页<BFFTaxonomyItem>): 行业页 {
  return {
    项: 页.items.map((项) => ({
      键: 项.id,
      名称: 项.display_name,
      可选: 项.selectable === true,
      有子项: 项.has_children === true,
    })),
    下一页: 页.nextCursor,
    版本: 页.catalogVersion,
  };
}

/**
 * HTTP 目录查询适配：接收已注入的 查询Taxonomy 取值（页面以 getter 读最新操作，不传 Context）。
 * 底层调用保持现有操作签名（含 { 强制刷新: true }），仅做 DTO 转换。
 * 各父项记录期望版本（键 = 父键，根用 '<根>'）：追加页换版说明旧游标是死页，
 * 以强制刷新重开该父项第一页作为新缓存起点 —— 重开与否的判定只在本适配内，
 * 上层 hook 只按返回页的版本做缓存作废。
 */
export const 创建目录行业查询 = (取得查询方法: () => Taxonomy查询方法 | undefined): 查询行业页 => {
  const 期望版本 = new Map<string, string>();
  return async (父键, 游标) => {
    const 方法 = 取得查询方法();
    if (!方法) throw new Error('目录查询不可用');
    const 页 = await 方法('industries', {
      ...(父键 !== null ? { parentId: 父键 } : {}),
      ...(游标 !== null ? { cursor: 游标 } : {}),
      limit: 50,
    });
    const 页签 = 父键 ?? '<根>';
    const 期望 = 期望版本.get(页签);
    if (期望 !== undefined && 页.catalogVersion !== 期望) {
      // 目录换代：旧游标是死页，不跨版本合并，强制刷新重开本父项第一页
      const 重开 = await 方法(
        'industries',
        { ...(父键 !== null ? { parentId: 父键 } : {}), limit: 50 },
        { 强制刷新: true },
      );
      期望版本.set(页签, 重开.catalogVersion);
      return 转行业页(重开);
    }
    期望版本.set(页签, 页.catalogVersion);
    return 转行业页(页);
  };
};

// ── 目录控制器 hook ──────────────────────────────────────────────

/** 一个父项（根用 '<根>'）的子列表缓存：累计页 + 游标 + 首页版本 + 在飞/失败态。
 *  序 = 发起本条缓存在飞请求的请求号（0 = 空闲），收尾只清自己名下的加载中 */
interface 子缓存 {
  项: 行业页['项'];
  下一页: string | null;
  版本: string;
  加载中: boolean;
  错误: string | null;
  序: number;
}

/** 目录数据真相：根页 + 展开状态 + 子缓存（ref 持有，state 镜像供渲染） */
interface 目录数据 {
  根项: 行业页['项'];
  根游标: string | null;
  根版本: string;
  根加载中: boolean;
  根错误: string | null;
  /** 在飞根请求的请求号（0 = 空闲）：收尾只清自己名下的加载态 */
  根序: number;
  展开键们: Record<string, boolean>;
  子表: Record<string, 子缓存>;
}

const 根页签 = '<根>';

const 空目录 = (): 目录数据 => ({
  根项: [], 根游标: null, 根版本: '', 根加载中: false, 根错误: null, 根序: 0,
  展开键们: {}, 子表: {},
});

export function use行业目录({ 查询, 目录身份 }: { 查询: 查询行业页; 目录身份: string }): 行业目录状态 {
  const [数据, 设数据] = useState<目录数据>(空目录);
  // 目录数据以 ref 为真相：在飞回写/同步回调读它，提交时先写 ref 再镜像进 state
  const 数据引用 = useRef(数据);
  数据引用.current = 数据;

  // 代际：目录身份变更/换代清理时 +1，在飞响应回写前核对，不符即静默作废
  const 代际 = useRef(0);
  const 在飞 = useRef(new Set<string>());
  const 请求序 = useRef(0);
  const 查询引用 = useRef(查询);
  查询引用.current = 查询;

  /** 提交一次目录数据变更（真相先落 ref，state 镜像供渲染） */
  const 提交 = (下一: 目录数据) => {
    数据引用.current = 下一;
    设数据(下一);
  };

  const 收集后代 = (父键: string, 集合: Set<string>, 表: Record<string, 子缓存>) => {
    集合.add(父键);
    const 缓存 = 表[父键];
    for (const 项 of 缓存?.项 ?? []) 收集后代(项.键, 集合, 表);
  };

  const 摘除键们 = <T,>(表: Record<string, T>, 摘: Set<string>): Record<string, T> =>
    Object.fromEntries(Object.entries(表).filter(([键]) => !摘.has(键)));

  /** 按 键 去重合并两页（沿 合并目录页 口径：旧表已有的不再进） */
  const 合并行业项 = (旧项: 行业页['项'], 新项: 行业页['项']): 行业页['项'] => {
    const 已见 = new Set(旧项.map((项) => 项.键));
    return [...旧项, ...新项.filter((项) => !已见.has(项.键))];
  };

  /** 写回某父项子页；追加页换版时该父项整组重开、旧子项名下的后代展开与缓存作废 */
const 写子页 = (父键: string, 页: 行业页, 首页: boolean) => {
    const 现在 = 数据引用.current;
    const 旧缓存 = 现在.子表[父键];
    if (!旧缓存) return;
    if (旧缓存.版本 !== '' && 页.版本 !== 旧缓存.版本) {
      // 目录换代：新版本页成为该父项新缓存起点；旧子项名下的后代展开与缓存一并失效，
      // 代际作废在飞的旧代请求（迟到回写对不上代际即整包静默作废）
      代际.current += 1;
      const 摘 = new Set<string>();
      for (const 项 of 旧缓存.项) 收集后代(项.键, 摘, 现在.子表);
      提交({
        ...现在,
        子表: {
          ...摘除键们(现在.子表, 摘),
          [父键]: { 项: 页.项, 下一页: 页.下一页, 版本: 页.版本, 加载中: false, 错误: null, 序: 0 },
        },
        展开键们: 摘除键们(现在.展开键们, 摘),
      });
      return;
    }
    const 合并项 = 首页 || 旧缓存.版本 === '' ? 页.项 : 合并行业项(旧缓存.项, 页.项);
    提交({
      ...现在,
      子表: {
        ...现在.子表,
        [父键]: { 项: 合并项, 下一页: 页.下一页, 版本: 页.版本, 加载中: false, 错误: null, 序: 0 },
      },
    });
  };

  /** 载入某父项的子页：首页=false 走既有游标（游标不动 = 分页失败可再点重试） */
  const 载入子页 = async (父键: string, 首页: boolean) => {
    const 缓存 = 数据引用.current.子表[父键];
    if (在飞.current.has(父键) || 缓存?.加载中) return; // 请求去重
    const 游标 = 首页 ? null : (缓存?.下一页 ?? null);
    if (!首页 && 游标 === null) return;
    在飞.current.add(父键);
    const 本次 = 代际.current;
    const 序号 = ++请求序.current;
    const 现在 = 数据引用.current;
    提交({
      ...现在,
      子表: {
        ...现在.子表,
        [父键]: {
          项: 首页 ? [] : (缓存?.项 ?? []),
          下一页: 首页 ? null : (缓存?.下一页 ?? null),
          版本: 首页 ? '' : (缓存?.版本 ?? ''),
          加载中: true,
          错误: null,
          序: 序号,
        },
      },
    });
    try {
      const 页 = await 查询引用.current(父键, 游标);
      if (代际.current !== 本次) return;
      写子页(父键, 页, 首页);
    } catch (错误) {
      if (代际.current !== 本次) return;
      const 当前 = 数据引用.current;
      const 本条 = 当前.子表[父键];
      if (!本条) return;
      if (首页) {
        // 首载失败：错误 + 重试入口（区别成功空页），不缓存成空结果
        提交({
          ...当前,
          子表: { ...当前.子表, [父键]: { ...本条, 加载中: false, 错误: 取后端错误文案(错误), 序: 0 } },
        });
        return;
      }
      // 分页失败：游标不动，用户再点一次就是重试
      提交({
        ...当前,
        子表: { ...当前.子表, [父键]: { ...本条, 加载中: false, 序: 0 } },
      });
    } finally {
      在飞.current.delete(父键);
      // 收尾只清自己名下的在飞标记：缓存已被换代清理/新请求接手（序号不符）时不动
      const 收尾 = 数据引用.current.子表[父键];
      if (收尾?.序 === 序号 && 收尾.加载中) {
        const 现在 = 数据引用.current;
        提交({ ...现在, 子表: { ...现在.子表, [父键]: { ...收尾, 加载中: false, 序: 0 } } });
      }
    }
  }

  /** 写根页（含换代：根列表整组重开 + 全部派生缓存/展开作废） */
  const 写根页 = (页: 行业页) => {
    const 现在 = 数据引用.current;
    if (现在.根版本 !== '' && 页.版本 !== 现在.根版本) {
      // 目录换代：新版本根页成为新缓存起点，旧根下的子/孙展开与缓存一并作废
      代际.current += 1;
      const 摘 = new Set<string>();
      for (const 项 of 现在.根项) 收集后代(项.键, 摘, 现在.子表);
      提交({
        ...现在,
        根项: 页.项,
        根游标: 页.下一页,
        根版本: 页.版本,
        根加载中: false,
        根序: 0,
        子表: 摘除键们(现在.子表, 摘),
        展开键们: 摘除键们(现在.展开键们, 摘),
      });
      return;
    }
    提交({
      ...现在,
      根项: 合并行业项(现在.根项, 页.项),
      根游标: 页.下一页,
      根版本: 页.版本,
    });
  };

  /** 载入根首页（重试入口；挂载/身份变更走下方 effect） */
  const 载入根页 = async () => {
    const 现在 = 数据引用.current;
    if (在飞.current.has(根页签) || 现在.根加载中) return;
    在飞.current.add(根页签);
    const 本次 = 代际.current;
    const 序号 = ++请求序.current;
    提交({ ...现在, 根加载中: true, 根错误: null, 根序: 序号 });
    try {
      const 页 = await 查询引用.current(null, null);
      if (代际.current !== 本次) return;
      写根页(页);
    } catch (错误) {
      if (代际.current !== 本次) return;
      // 失败不动既有列表（不把失败缓存成空目录），保留重试入口
      提交({ ...数据引用.current, 根加载中: false, 根错误: 取后端错误文案(错误), 根序: 0 });
    } finally {
      在飞.current.delete(根页签);
      // 收尾只清自己名下的在飞标记（序号不符 = 已被换代清理/新请求接手）
      const 收尾 = 数据引用.current;
      if (收尾.根序 === 序号 && 收尾.根加载中) 提交({ ...收尾, 根加载中: false, 根序: 0 });
    }
  };

  // 目录身份（模式+主体）变更：作废旧缓存/游标/在飞响应，重拉根页；已选业务值不受影响
  useEffect(() => {
    代际.current += 1;
    const 本次 = 代际.current;
    在飞.current.delete(根页签);
    提交({ ...空目录(), 根加载中: true });
    在飞.current.add(根页签);
    void (async () => {
      try {
        const 页 = await 查询引用.current(null, null);
        if (代际.current !== 本次) return;
        const 现在 = 数据引用.current;
        提交({ ...现在, 根项: 页.项, 根游标: 页.下一页, 根版本: 页.版本, 根加载中: false, 根序: 0 });
      } catch (错误) {
        if (代际.current !== 本次) return;
        // 失败不动既有列表（不把失败缓存成空目录），保留重试入口
        提交({ ...数据引用.current, 根加载中: false, 根错误: 取后端错误文案(错误), 根序: 0 });
      } finally {
        在飞.current.delete(根页签);
      }
    })();
    return () => {
      代际.current += 1;
    };
    // 查询 经引用读取；目录身份 是唯一的生命周期键
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [目录身份]);

  // ── 回调（身份稳定，经 ref 读最新目录数据）────────────────────
  const 切换展开 = (键: string) => {
    const 现在 = 数据引用.current;
    if (现在.展开键们[键]) {
      // 收起：递归清掉后代可见展开状态，缓存保留（再展开不重发请求）
      const 摘 = new Set<string>([键]);
      收集后代(键, 摘, 现在.子表);
      提交({ ...现在, 展开键们: 摘除键们(现在.展开键们, 摘) });
      return;
    }
    提交({ ...现在, 展开键们: { ...现在.展开键们, [键]: true } });
    const 缓存 = 数据引用.current.子表[键];
    if (!缓存 || 缓存.错误) void 载入子页(键, true);
  };

  const 加载更多 = (父键: string | null) => {
    if (父键 === null) {
      const 现在 = 数据引用.current;
      if (现在.根游标 === null || 现在.根加载中 || 在飞.current.has(根页签)) return;
      在飞.current.add(根页签);
      const 本次 = 代际.current;
      const 序号 = ++请求序.current;
      提交({ ...现在, 根加载中: true, 根序: 序号 });
      void (async () => {
        try {
          const 页 = await 查询引用.current(null, 数据引用.current.根游标);
          if (代际.current !== 本次) return;
          写根页(页);
        } catch {
          // 失败不动：游标仍在，用户可再点
        } finally {
          在飞.current.delete(根页签);
          // 收尾只清自己名下的在飞标记（换代清理/身份变更接手时序号不符，不回写）
          const 收尾 = 数据引用.current;
          if (收尾.根序 === 序号 && 收尾.根加载中) 提交({ ...收尾, 根加载中: false, 根序: 0 });
        }
      })();
      return;
    }
    void 载入子页(父键, false);
  };

  const 重试 = (父键: string | null) => {
    if (父键 === null) {
      void 载入根页();
      return;
    }
    void 载入子页(父键, true);
  };

  // ── 展示行推导：根 + 展开父项的可见子/孙（父行后紧跟其可见后代）──
  const 行: 行业行[] = [];
  const 走 = (项们: 行业页['项'], 层级: 行业行['层级']) => {
    for (const 项 of 项们) {
      const 缓存 = 数据.子表[项.键];
      行.push({
        ...项,
        层级,
        展开: Boolean(数据.展开键们[项.键]),
        加载中: 缓存?.加载中 ?? false,
        错误: 缓存?.错误 ?? null,
        空: Boolean(缓存 && !缓存.加载中 && 缓存.错误 === null && 缓存.项.length === 0),
        可加载更多: (缓存?.下一页 ?? null) !== null,
        达深度上限: 层级 === 2 && 项.有子项,
      });
      if (数据.展开键们[项.键] && 缓存) 走(缓存.项, (层级 + 1) as 行业行['层级']);
    }
  };
  走(数据.根项, 0);

  return {
    行,
    根加载中: 数据.根加载中,
    根错误: 数据.根错误,
    根空: !数据.根加载中 && 数据.根错误 === null && 数据.根项.length === 0,
    根可加载更多: 数据.根游标 !== null,
    切换展开,
    加载更多,
    重试,
  };
}