// 选期望行业（/intentions/industries）—— 添加求职期望页的次级页 B（规格截图 5）。
//
// Task 7（core editors §5.2）：两模式的展示收敛到共用正文 期望行业选择正文，
// 本页只保留数据与控制：Backend 按需 查询Taxonomy('industries')（roots → 展开
// parentId → 非 selectable 子项再取孙项，各层独立分页游标），Mock 沿本地 行业字典
// 模拟同样目录行为。页面把两模式状态映射成组件的展示 props；选择身份按稳定 ID
//（Backend = 目录 ID，Mock = 局部模拟键），不再按显示名判定身份。
//
// 选择结果沿原业务直接写进 意向草稿.期望行业们 —— 主屏与本页共用同一份草稿，
// 所以右上「保存」和返回键做的是同一件事（都只是 返回()）：
// 不存在「不点保存就丢」的第二条路径，也就不会出现两个入口结果不一致。
// （与城市不同：本页不做取消回滚事务，保存负责返回。）
//
// Backend selectable=true 叶子原子保存 期望行业们+行业引用们（ID 去重，上限 3）；
// 推荐 chips：Backend 推荐 chips 沿规格按 selectable 决定 可选/可展开（不可选点击走
// 展开不混成写入），Mock 推荐 chips 沿原行为可切换一级行业。

import { useEffect, useRef, useState } from 'react';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 行业字典 } from '../数据/城市与行业';
import type { BFFTaxonomyItem } from '../数据/BFF契约';
import type { 目录选择值 } from '../数据/招聘数据源类型';
import { 合并目录页 } from '../数据/目录选择';
import {
  期望行业选择正文,
  type 期望行业组,
  type 期望行业项,
} from '../组件/期望行业选择正文';

/** 期望行业上限（规格：最多 3 个）*/
const 行业上限 = 3;

/** Mock 稳定模拟键：键 = 目录位置（组下标/细分别下标），与显示名分离，同名条目不互串 */
const Mock键转名 = new Map<string, string>();
行业字典.forEach((组, 组下标) => {
  Mock键转名.set(`mock_ind_${组下标}`, 组.行业);
  组.细分.forEach((名, 细分别下标) => Mock键转名.set(`mock_ind_${组下标}_${细分别下标}`, 名));
});

/** 「推荐」区固定取字典前 3 个一级行业 —— 规格指定的取法，不做额外排序或打分 */
const 推荐行业们 = 行业字典.slice(0, 3);

export default function 选期望行业() {
  const { 返回 } = use导航();
  const { 状态: 全局, 派发, 数据源模式, 目录查询 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';

  // 草稿是唯一数据源：本页不留本地副本，每次点选立刻回写，
  // 这样返回键、保存键、手势返回三条出口拿到的结果必然一致。
  const 已选行业们 = 全局.意向草稿.期望行业们;
  const 已选引用 = 全局.意向草稿.行业引用们 ?? [];
  const 已选满 = 已选行业们.length >= 行业上限;

  // ── Backend：roots + 展开子项（支持 >2 级：非 selectable 子项再展开取孙项）──
  const [根项, 设根项] = useState<BFFTaxonomyItem[]>([]);
  // review-r2 R2-M-1：根行业分页游标 + 子项分页游标
  const [根游标, 设根游标] = useState<string | null>(null);
  const [根加载中, 设根加载中] = useState(false);
  const [展开状态, 设展开状态] = useState<Record<string, { 子项: BFFTaxonomyItem[]; 加载中: boolean; 游标: string | null }>>({});
  const [孙项表, 设孙项表] = useState<Record<string, BFFTaxonomyItem[]>>({});
  const [孙项游标表, 设孙项游标表] = useState<Record<string, string | null>>({});
  const 方法引用 = useRef(目录查询?.查询Taxonomy);
  方法引用.current = 目录查询?.查询Taxonomy;

  // Backend mount：读 roots
  useEffect(() => {
    if (!是后端) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    void (async () => {
      try {
        const 页 = await 方法('industries', { limit: 50 });
        设根项(页.items);
        设根游标(页.nextCursor);
      } catch {
        设根项([]);
        设根游标(null);
      }
    })();
  }, [是后端]);

  // review-r2 R2-M-1：根行业加载更多
  const 根加载更多 = async () => {
    if (根游标 === null || 根加载中) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    设根加载中(true);
    try {
      const 页 = await 方法('industries', { cursor: 根游标, limit: 50 });
      设根项((旧) => 合并目录页(旧, 页.items));
      设根游标(页.nextCursor);
    } catch {
      // 失败不动，用户可再点
    } finally {
      设根加载中(false);
    }
  };

  const 展开根 = async (项: BFFTaxonomyItem) => {
    if (展开状态[项.id]) return;
    设展开状态((旧) => ({ ...旧, [项.id]: { 子项: [], 加载中: true, 游标: null } }));
    const 方法 = 方法引用.current;
    if (!方法) return;
    try {
      const 子页 = await 方法('industries', { parentId: 项.id, limit: 50 });
      设展开状态((旧) => ({ ...旧, [项.id]: { 子项: 子页.items, 加载中: false, 游标: 子页.nextCursor } }));
    } catch {
      设展开状态((旧) => ({ ...旧, [项.id]: { 子项: [], 加载中: false, 游标: null } }));
    }
  };

  // review-r2 R2-M-1：子项加载更多
  const 子项加载更多 = async (项: BFFTaxonomyItem) => {
    const 状态 = 展开状态[项.id];
    if (!状态 || 状态.游标 === null || 状态.加载中) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    设展开状态((旧) => ({ ...旧, [项.id]: { ...旧[项.id], 加载中: true } }));
    try {
      const 子页 = await 方法('industries', { parentId: 项.id, cursor: 状态.游标, limit: 50 });
      设展开状态((旧) => ({
        ...旧,
        [项.id]: { 子项: 合并目录页(旧[项.id].子项, 子页.items), 加载中: false, 游标: 子页.nextCursor },
      }));
    } catch {
      设展开状态((旧) => ({ ...旧, [项.id]: { ...旧[项.id], 加载中: false } }));
    }
  };

  // 非 selectable 子项：按 parentId 取孙项，展开为嵌套列表
  const 展开子 = async (项: BFFTaxonomyItem) => {
    if (孙项表[项.id]) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    try {
      const 孙页 = await 方法('industries', { parentId: 项.id, limit: 50 });
      设孙项表((旧) => ({ ...旧, [项.id]: 孙页.items }));
      设孙项游标表((旧) => ({ ...旧, [项.id]: 孙页.nextCursor }));
    } catch {
      设孙项表((旧) => ({ ...旧, [项.id]: [] }));
      设孙项游标表((旧) => ({ ...旧, [项.id]: null }));
    }
  };

  // review-r2 R2-M-1：孙项加载更多（>2 级 taxonomy 分页）
  const 孙项加载更多 = async (项: BFFTaxonomyItem) => {
    const 游标 = 孙项游标表[项.id];
    if (游标 === null || 游标 === undefined) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    try {
      const 孙页 = await 方法('industries', { parentId: 项.id, cursor: 游标, limit: 50 });
      设孙项表((旧) => ({ ...旧, [项.id]: 合并目录页(旧[项.id] ?? [], 孙页.items) }));
      设孙项游标表((旧) => ({ ...旧, [项.id]: 孙页.nextCursor }));
    } catch {
      // 失败不动
    }
  };

  // ── Mock 手风琴默认全部收起；组里已经有选中的细分时那几组开着进来 ──
  const [展开的行业们, 设展开的行业们] = useState<string[]>(() =>
    行业字典
      .filter((组) => 组.细分.some((细分名) => 已选行业们.includes(细分名)))
      .map((组) => 组.行业),
  );

  /** 名称列表按值摘除首个同名条目：Backend 按 ID 取消时保持 名称↔引用 数量对齐 */
  const 摘除首个 = (们: string[], 名: string) => {
    const 下标 = 们.indexOf(名);
    return 下标 === -1 ? 们 : [...们.slice(0, 下标), ...们.slice(下标 + 1)];
  };

  /** 已选 → 再点取消；未选且没到上限 → 追加。Backend 身份按稳定 ID（同名条目不互串） */
  const 切换行业 = (名: string, 引用?: 目录选择值) => {
    if (是后端 && 引用) {
      if (已选引用.some((条) => 条.id === 引用.id)) {
        // 按 ID 取消：引用去掉该 ID，名称列表只摘除一个同名条目（同名另一条保留）
        派发({
          型: '改意向草稿',
          补丁: {
            期望行业们: 摘除首个(已选行业们, 名),
            行业引用们: 已选引用.filter((条) => 条.id !== 引用.id),
          },
        });
        return;
      }
      if (已选满) return;
      // ID 去重
      派发({
        型: '改意向草稿',
        补丁: {
          期望行业们: [...已选行业们, 名],
          行业引用们: [...已选引用, 引用],
        },
      });
      return;
    }
    if (已选行业们.includes(名)) {
      派发({ 型: '改意向草稿', 补丁: { 期望行业们: 已选行业们.filter((条) => 条 !== 名) } });
      return;
    }
    if (已选满) return;
    派发({ 型: '改意向草稿', 补丁: { 期望行业们: [...已选行业们, 名] } });
  };

  const 切换展开 = (行业名: string) => {
    设展开的行业们((旧) =>
      旧.includes(行业名) ? 旧.filter((条) => 条 !== 行业名) : [...旧, 行业名],
    );
  };

  // ── 组件按稳定键回报点击；本外层负责 键 → 目录引用/名称 映射（不按显示名反查 ID）──
  const 找后端项 = (键: string): BFFTaxonomyItem | undefined =>
    根项.find((项) => 项.id === 键) ??
    Object.values(展开状态).flatMap((状态) => 状态.子项).find((项) => 项.id === 键) ??
    Object.values(孙项表).flat().find((项) => 项.id === 键);

  const 切换键 = (键: string) => {
    if (是后端) {
      const 项 = 找后端项(键);
      if (项) 切换行业(项.display_name, { id: 项.id, display_name: 项.display_name });
      return;
    }
    const 名 = Mock键转名.get(键);
    if (名 !== undefined) 切换行业(名);
  };

  const 展开键 = (键: string) => {
    if (是后端) {
      const 根 = 根项.find((项) => 项.id === 键);
      if (根) {
        void 展开根(根);
        return;
      }
      const 子 = Object.values(展开状态).flatMap((状态) => 状态.子项).find((项) => 项.id === 键);
      if (子) void 展开子(子);
      return;
    }
    const 名 = Mock键转名.get(键);
    if (名 !== undefined) 切换展开(名);
  };

  /** 选中身份按稳定 ID：Backend 勾只落在已选引用的 ID 上（同名条目不互串）；Mock 沿名称草稿 */
  const 后端选中 = (项: BFFTaxonomyItem) => 已选引用.some((条) => 条.id === 项.id);

  /** Backend 目录项 → 展示片（可选/可展开由 selectable 决定，组件不推导） */
  const 片值 = (项: BFFTaxonomyItem): 期望行业项 => ({
    键: 项.id,
    名称: 项.display_name,
    选中: 后端选中(项),
    可选: 项.selectable,
    可展开: !项.selectable,
  });

  // ── 展示映射（分组们 = 展示批次不是新树）：根组 + 其孙项盒紧跟其后 ──
  const 分组们: 期望行业组[] = [];
  if (是后端) {
    根项.forEach((根) => {
      const 状态 = 展开状态[根.id];
      分组们.push({
        键: 根.id,
        标题: 根.display_name,
        层级: 0,
        已展开: Boolean(状态),
        项们: (状态?.子项 ?? []).map(片值),
        加载中: 状态?.加载中 ?? false,
        还有: 状态 ? 状态.游标 !== null : false,
        加载更多: () => void 子项加载更多(根),
      });
      (状态?.子项 ?? []).forEach((子) => {
        const 孙们 = 孙项表[子.id];
        if (!孙们?.length) return;
        分组们.push({
          键: 子.id,
          标题: 子.display_name,
          层级: 1,
          已展开: true,
          项们: 孙们.map(片值),
          加载中: false,
          还有: 孙项游标表[子.id] !== null && 孙项游标表[子.id] !== undefined,
          加载更多: () => void 孙项加载更多(子),
        });
      });
    });
  } else {
    行业字典.forEach((组, 组下标) => {
      分组们.push({
        键: `mock_ind_${组下标}`,
        标题: 组.行业,
        层级: 0,
        已展开: 展开的行业们.includes(组.行业),
        项们: 组.细分.map((名, 细分别下标) => ({
          键: `mock_ind_${组下标}_${细分别下标}`,
          名称: 名,
          选中: 已选行业们.includes(名),
          可选: true,
          可展开: false,
        })),
        加载中: false,
        还有: false,
        加载更多: () => {},
      });
    });
  }

  return (
    <期望行业选择正文
      已选项们={
        是后端 && 已选引用.length > 0
          ? 已选引用.map((条) => ({ 键: 条.id, 名称: 条.display_name, 选中: true, 可选: true, 可展开: false }))
          : 已选行业们.map((名) => ({ 键: 名, 名称: 名, 选中: true, 可选: true, 可展开: false }))
      }
      推荐项们={
        是后端
          ? 根项.slice(0, 3).map((项) => ({
              键: 项.id,
              名称: 项.display_name,
              选中: 后端选中(项),
              可选: 项.selectable,
              可展开: !项.selectable,
            }))
          : 推荐行业们.map((组, 组下标) => ({
              键: `mock_ind_${组下标}`,
              名称: 组.行业,
              选中: 已选行业们.includes(组.行业),
              可选: true,
              可展开: false,
            }))
      }
      分组们={分组们}
      根加载中={根加载中}
      根还有={根游标 !== null}
      根加载更多={() => void 根加载更多()}
      展开={展开键}
      切换={切换键}
      /* 选择即写意向草稿（原业务）：保存与返回同途，都只负责返回 */
      返回={返回}
      保存={返回}
    />
  );
}