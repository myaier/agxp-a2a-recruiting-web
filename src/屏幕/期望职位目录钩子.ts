// 期望职位目录钩子（Task 7 / B 契约）：选期望职位页（/onboard/job 与 ?来源=意向）
// 页面局部的 Backend 目录控制器，只在本页使用，不创建通用树服务。
//
// 输入：注入现有 查询Taxonomy 方法（沿用现有类型与 { 强制刷新: true } 第三参数口径）+
// 搜索词 + 已选键们（选中集合仍由页面持有，这里只按键回填选中标记）。
// 输出：B 契约的 根项们/组们/各级尾态 与 按键取项(id) 的真实目录项查找。
//
// 加载与边界（Plan Task 7 冻结）：
//   · 挂载读根 → 自动选第一根 → 读其二级首屏 → 按目录顺序串行自动加载各二级组的
//     三级首屏（无第二次点击；不加并发池、不后台预热全树；只加载当前根）；
//   · 根列表、当前根二级列表、各组三级列表各自保存 游标/版本/加载/错误；
//     根/二级「加载更多」按钮加载新增项（二级新增组自动启动三级首屏），组「加载更多」
//     仅追加该组；ID 去重保序；追加失败保留旧项、独立重试；
//   · 视图 generation：切换根/搜索词变化/卸载都升代际，旧响应凭代际作废不回写；
//   · 版本换代（追加页 catalogVersion 变化）：放弃旧游标与缓存，沿既有
//     { 强制刷新: true } 从本查询第一页重开（组只重开自己、二级重开整个右栏视图，
//     根换版同时重置右视图并按新版首根或仍在的当前根重载），不跨版本合并，
//     不清页面已选 refs；
//   · 搜索仍全局、保留 API 次序与分页：可选叶子进空标题直接结果组（全部页同口径）；
//     命中的根
//     （parent_id 为空）自动查二级再查三级；命中的二级自动查三级；非可选命中只作
//     同名组标题（不提供展开按钮、不改左栏当前根）；相同 ID 只展示一次可选项，
//     同名组不合并；清空搜索恢复最近根并使旧搜索响应作废。
//
// 状态实现：目录数据以 ref 为真相（提交时先写 ref 再镜像进 state），在飞响应回写时
// 读到的永远是最新数据；回调身份稳定（经 ref 读最新），展示组件不持游标。

import { useEffect, useRef, useState } from 'react';
import type { BFFTaxonomyItem } from '../数据/BFF契约';
import type { 目录页, Taxonomy查询 } from '../数据/招聘数据源类型';
import type { 目录查询选项 } from '../数据/招聘数据源/目录';
import { 取后端错误文案 } from '../数据/HTTP客户端';
import type { 目录尾态, 期望职位组, 期望职位项 } from '../组件/期望职位选择正文';

/** 页面局部查询方法：沿用现有 查询Taxonomy 类型（kind 固定 job-categories） */
export type 期望职位目录查询 = (
  kind: 'job-categories',
  query: Taxonomy查询,
  选项?: 目录查询选项,
) => Promise<目录页<BFFTaxonomyItem>>;

export interface 期望职位目录参数 {
  /** 已注入的 查询Taxonomy 取值；Mock 模式为 undefined（不发请求，输出恒空） */
  查询: 期望职位目录查询 | undefined;
  搜索词: string;
  /** 页面持有的已选键集合（Backend = 目录 ID），只用于回填 选中 标记 */
  已选键们: readonly string[];
}

export interface 期望职位目录状态 {
  根项们: { 键: string; 名称: string; 选中: boolean }[];
  切换根: (键: string) => void;
  根尾态: 目录尾态;
  组们: 期望职位组[];
  右尾态: 目录尾态;
  /** 键（目录 ID）→ 真实目录项；预填/已选引用可能不在当前目录缓存里，取不到返回 undefined */
  按键取项: (键: string) => BFFTaxonomyItem | undefined;
}

const 每页限量 = 50;
const 搜索防抖毫秒 = 250;

/** 一个二级分组的三级列表缓存：累计项 + 游标 + 首页版本 + 在飞/失败态 */
interface 组态 {
  项: BFFTaxonomyItem[];
  游标: string | null;
  版本: string;
  加载中: boolean;
  错误: string | null;
  /** 发起本条在飞请求的请求号（0 = 空闲）：收尾与换代重开只认自己名下 */
  序: number;
}

/** 一个搜索命中的非可选节点展开成的同名标题组 */
interface 搜索组态 {
  节点: BFFTaxonomyItem;
  项: BFFTaxonomyItem[];
  加载中: boolean;
  错误: string | null;
  序: number;
}

interface 目录数据 {
  // ── 浏览视图 ──
  根项: BFFTaxonomyItem[];
  根游标: string | null;
  根版本: string;
  根加载中: boolean;
  根错误: string | null;
  当前根id: string | null;
  二级项: BFFTaxonomyItem[];
  二级游标: string | null;
  二级版本: string;
  右加载中: boolean;
  右错误: string | null;
  组表: Record<string, 组态>;
  // ── 搜索视图（生效词 = 搜索词.trim()）──
  搜索词: string;
  直接项: BFFTaxonomyItem[];
  直接游标: string | null;
  直接版本: string;
  直接加载中: boolean;
  直接错误: string | null;
  搜索组们: 搜索组态[];
}

const 空目录 = (): 目录数据 => ({
  根项: [], 根游标: null, 根版本: '', 根加载中: false, 根错误: null, 当前根id: null,
  二级项: [], 二级游标: null, 二级版本: '', 右加载中: false, 右错误: null, 组表: {},
  搜索词: '', 直接项: [], 直接游标: null, 直接版本: '', 直接加载中: false, 直接错误: null,
  搜索组们: [],
});

/** 按 id 去重合并两页（沿 合并目录页 口径：旧表已有的不再进，保序） */
function 合并项们(旧项: BFFTaxonomyItem[], 新项: BFFTaxonomyItem[]): BFFTaxonomyItem[] {
  const 已见 = new Set(旧项.map((项) => 项.id));
  return [...旧项, ...新项.filter((项) => !已见.has(项.id))];
}

export function use期望职位目录({ 查询, 搜索词, 已选键们 }: 期望职位目录参数): 期望职位目录状态 {
  const [数据, 设数据] = useState<目录数据>(空目录);
  // 目录数据以 ref 为真相：在飞回写/同步回调读它，提交时先写 ref 再镜像进 state
  const 数据引用 = useRef(数据);
  数据引用.current = 数据;
  const 查询引用 = useRef(查询);
  查询引用.current = 查询;

  // 代际：换根/搜索词变化/卸载各升各的，在飞响应回写前核对，不符即静默作废
  const 浏览代际 = useRef(0);
  const 搜索代际 = useRef(0);
  const 请求序 = useRef(0);
  // 在飞根页请求所属的代际：StrictMode（dev）挂载→清理→再挂载时，卸载已把代际 +1
  // 作废了第一次的在飞响应，重入的第二次载入若被「根加载中」挡住，第一次响应又被
  // 代际作废 —— 根列将永久停在加载中。只拦「属于当前代际」的在飞重入。
  const 根页在飞代际 = useRef(0);

  /** 提交一次目录数据变更（真相先落 ref，state 镜像供渲染） */
  const 提交 = (下一: 目录数据) => {
    数据引用.current = 下一;
    设数据(下一);
  };

  const 写组态 = (组键: string, 组: 组态) => {
    const 现在 = 数据引用.current;
    提交({ ...现在, 组表: { ...现在.组表, [组键]: 组 } });
  };

  const 更新搜索组 = (组键: string, 补丁: Partial<搜索组态>) => {
    const 现在 = 数据引用.current;
    提交({
      ...现在,
      搜索组们: 现在.搜索组们.map((组) => (组.节点.id === 组键 ? { ...组, ...补丁 } : 组)),
    });
  };

  // ── 浏览：根列表 ──────────────────────────────────────────────

  const 载入根页 = async () => {
    const 方法 = 查询引用.current;
    if (!方法) return;
    if (数据引用.current.根加载中 && 根页在飞代际.current === 浏览代际.current) return;
    const 本次 = ++浏览代际.current;
    根页在飞代际.current = 本次;
    提交({ ...数据引用.current, 根加载中: true, 根错误: null });
    try {
      const 页 = await 方法('job-categories', { limit: 每页限量 });
      if (浏览代际.current !== 本次) return;
      提交({ ...数据引用.current, 根项: 页.items, 根游标: 页.nextCursor, 根版本: 页.catalogVersion, 根加载中: false });
      const 首根 = 页.items[0];
      if (首根 && 数据引用.current.当前根id === null) await 载入右视图(首根.id);
    } catch (错误) {
      if (浏览代际.current !== 本次) return;
      // 失败不动既有根列表（不把失败缓存成空目录），错误进 根尾态 由重试恢复
      提交({ ...数据引用.current, 根加载中: false, 根错误: 取后端错误文案(错误) });
    }
  };

  const 根加载更多 = async () => {
    const 现在 = 数据引用.current;
    if (现在.根游标 === null || 现在.根加载中) return;
    const 方法 = 查询引用.current;
    if (!方法) return;
    const 本次 = 浏览代际.current; // 追加不升代际：不作废其它在飞浏览请求
    提交({ ...现在, 根加载中: true, 根错误: null });
    try {
      const 页 = await 方法('job-categories', { cursor: 现在.根游标, limit: 每页限量 });
      if (浏览代际.current !== 本次) return;
      const 现在2 = 数据引用.current;
      if (现在2.根版本 !== '' && 页.catalogVersion !== 现在2.根版本) {
        // 目录换代：旧游标是死页，强制刷新从根第一页重开，不跨版本合并
        const 重开 = await 方法('job-categories', { limit: 每页限量 }, { 强制刷新: true });
        if (浏览代际.current !== 本次) return;
        提交({ ...数据引用.current, 根项: 重开.items, 根游标: 重开.nextCursor, 根版本: 重开.catalogVersion, 根加载中: false });
        // 换版同时作废旧版目录的全部在飞浏览请求（review-r2 F3）：旧根的二级/组请求
        // 与新右视图同代际，晚到会回写旧版二级项/组。先递增代际再重载右视图（载入右视图
        // 捕获新代际）；此后 本次 已过期，本分支直接收尾，不再依赖 旧守卫
        浏览代际.current += 1;
        // 换版同时重置右视图（review-r1 F6）：旧 当前根id/二级/组表 属于旧版目录，
        // 新版首页不含原根时不能留着旧版右树。当前根仍在新版 → 只清缓存重载当前根；
        // 否则镜像 载入根页 的自动选首根。两条路都作废旧二级/组表与游标（载入右视图 内）
        const 旧根 = 数据引用.current.当前根id;
        const 仍在 = 旧根 !== null && 重开.items.some((项) => 项.id === 旧根);
        const 目标根 = 仍在 ? 旧根 : (重开.items[0]?.id ?? null);
        if (目标根 !== null) {
          await 载入右视图(目标根);
        } else {
          提交({
            ...数据引用.current,
            当前根id: null, 二级项: [], 二级游标: null, 二级版本: '',
            右加载中: false, 右错误: null, 组表: {},
          });
        }
        return;
      }
      提交({ ...数据引用.current, 根项: 合并项们(现在2.根项, 页.items), 根游标: 页.nextCursor, 根加载中: false });
    } catch (错误) {
      if (浏览代际.current !== 本次) return;
      // 失败不动既有根列表，游标不动，错误进根尾态由重试恢复
      提交({ ...数据引用.current, 根加载中: false, 根错误: 取后端错误文案(错误) });
    }
  };

  // ── 浏览：当前根的二级 + 各组三级 ─────────────────────────────

  /** 按目录顺序串行载入各组三级首屏；一组失败不阻塞其余组 */
  const 串行载入组们 = async (节点们: BFFTaxonomyItem[], 本次: number) => {
    for (const 节点 of 节点们) {
      if (浏览代际.current !== 本次) return;
      if (!节点.has_children) continue; // 无子项组：不发请求，直接呈现空态
      await 载入组页(节点.id, true);
    }
  };

  const 载入右视图 = async (根id: string) => {
    const 方法 = 查询引用.current;
    if (!方法) return;
    const 本次 = 浏览代际.current;
    提交({
      ...数据引用.current,
      当前根id: 根id,
      二级项: [], 二级游标: null, 二级版本: '',
      右加载中: true, 右错误: null, 组表: {},
    });
    try {
      const 页 = await 方法('job-categories', { parentId: 根id, limit: 每页限量 });
      if (浏览代际.current !== 本次) return;
      提交({ ...数据引用.current, 二级项: 页.items, 二级游标: 页.nextCursor, 二级版本: 页.catalogVersion, 右加载中: false });
      await 串行载入组们(页.items, 本次);
    } catch (错误) {
      if (浏览代际.current !== 本次) return;
      提交({ ...数据引用.current, 右加载中: false, 右错误: 取后端错误文案(错误) });
    }
  };

  const 二级加载更多 = async () => {
    const 现在 = 数据引用.current;
    const 根id = 现在.当前根id;
    if (根id === null || 现在.二级游标 === null || 现在.右加载中) return;
    const 方法 = 查询引用.current;
    if (!方法) return;
    const 本次 = 浏览代际.current;
    提交({ ...现在, 右加载中: true, 右错误: null });
    try {
      const 页 = await 方法('job-categories', { parentId: 根id, cursor: 现在.二级游标, limit: 每页限量 });
      if (浏览代际.current !== 本次) return;
      const 现在2 = 数据引用.current;
      if (现在2.二级版本 !== '' && 页.catalogVersion !== 现在2.二级版本) {
        // 目录换代：右栏活动视图整体重置，强制刷新从二级第一页重开再自动分组
        const 重开 = await 方法('job-categories', { parentId: 根id, limit: 每页限量 }, { 强制刷新: true });
        if (浏览代际.current !== 本次) return;
        提交({
          ...数据引用.current,
          二级项: 重开.items, 二级游标: 重开.nextCursor, 二级版本: 重开.catalogVersion,
          右加载中: false, 右错误: null, 组表: {},
        });
        await 串行载入组们(重开.items, 本次);
        return;
      }
      const 新增 = 页.items.filter((项) => !现在2.二级项.some((旧) => 旧.id === 项.id));
      提交({ ...数据引用.current, 二级项: [...现在2.二级项, ...新增], 二级游标: 页.nextCursor, 右加载中: false });
      // 只对新增组启动三级首屏
      await 串行载入组们(新增, 本次);
    } catch (错误) {
      if (浏览代际.current !== 本次) return;
      // 失败不动既有二级项与游标（旧组保留），错误进右尾态由重试恢复
      提交({ ...数据引用.current, 右加载中: false, 右错误: 取后端错误文案(错误) });
    }
  };

  /** 载入某组的三级页：首页=true 从第一页（重试/自动首屏），false 走既有游标（游标不动 = 可再点重试） */
  const 载入组页 = async (组键: string, 首页: boolean) => {
    const 方法 = 查询引用.current;
    if (!方法) return;
    const 缓存 = 数据引用.current.组表[组键];
    if (缓存?.加载中) return;
    if (!首页 && (缓存?.游标 ?? null) === null) return;
    const 本次 = 浏览代际.current;
    const 旧项 = 缓存?.项 ?? [];
    const 旧版本 = 缓存?.版本 ?? '';
    const 游标 = 首页 ? null : (缓存?.游标 ?? null);
    const 序号 = ++请求序.current;
    写组态(组键, { 项: 首页 ? [] : 旧项, 游标, 版本: 首页 ? '' : 旧版本, 加载中: true, 错误: null, 序: 序号 });
    try {
      const 页 = await 方法(
        'job-categories',
        { parentId: 组键, ...(首页 ? {} : { cursor: 游标 ?? undefined }), limit: 每页限量 },
      );
      if (浏览代际.current !== 本次 || 数据引用.current.组表[组键]?.序 !== 序号) return;
      if (!首页 && 旧版本 !== '' && 页.catalogVersion !== 旧版本) {
        // 目录换代：旧游标是死页，强制刷新从该组第一页重开（只动这一组，不伤兄弟组）
        const 重开 = await 方法('job-categories', { parentId: 组键, limit: 每页限量 }, { 强制刷新: true });
        if (浏览代际.current !== 本次 || 数据引用.current.组表[组键]?.序 !== 序号) return;
        写组态(组键, { 项: 重开.items, 游标: 重开.nextCursor, 版本: 重开.catalogVersion, 加载中: false, 错误: null, 序: 0 });
        return;
      }
      写组态(组键, {
        项: 首页 || 旧版本 === '' ? 页.items : 合并项们(旧项, 页.items),
        游标: 页.nextCursor,
        版本: 页.catalogVersion,
        加载中: false,
        错误: null,
        序: 0,
      });
    } catch (错误) {
      if (浏览代际.current !== 本次 || 数据引用.current.组表[组键]?.序 !== 序号) return;
      // 首页失败：错误 + 重试入口（区别成功空页），不缓存成空结果；
      // 追加失败：旧项与游标原样保留，用户再点就是重试
      写组态(组键, { ...(数据引用.current.组表[组键] as 组态), 加载中: false, 错误: 取后端错误文案(错误), 序: 0 });
    }
  };

  const 切换根 = (键: string) => {
    const 现在 = 数据引用.current;
    if (现在.当前根id === 键) return;
    if (!现在.根项.some((项) => 项.id === 键)) return;
    浏览代际.current += 1; // 换根：旧根的二级/三级迟到响应全部作废
    void 载入右视图(键);
  };

  // ── 搜索：全局词，250ms 防抖；词变化即作废旧搜索视图 ──────────

  const 写搜索首页 = (页: 目录页<BFFTaxonomyItem>, 本次: number) => {
    if (搜索代际.current !== 本次) return;
    提交({
      ...数据引用.current,
      直接项: 页.items.filter((项) => 项.selectable),
      直接游标: 页.nextCursor,
      直接版本: 页.catalogVersion,
      直接加载中: false,
      直接错误: null,
      搜索组们: 页.items
        .filter((项) => !项.selectable)
        .map((节点) => ({ 节点, 项: [], 加载中: true, 错误: null, 序: ++请求序.current })),
    });
  };

  const 生效词 = 搜索词.trim();

  useEffect(() => {
    const 本次 = ++搜索代际.current;
    // 词变化：旧搜索视图（结果/命中组/游标）整体作废；清空即恢复最近根的浏览视图
    提交({
      ...数据引用.current,
      搜索词: 生效词,
      直接项: [], 直接游标: null, 直接版本: '',
      直接加载中: 生效词 !== '', 直接错误: null, 搜索组们: [],
    });
    if (生效词 === '') return;
    const 计时 = window.setTimeout(async () => {
      const 方法 = 查询引用.current;
      if (!方法) return;
      提交({ ...数据引用.current, 直接加载中: true, 直接错误: null });
      try {
        const 页 = await 方法('job-categories', { q: 生效词, limit: 每页限量 });
        if (搜索代际.current !== 本次) return;
        写搜索首页(页, 本次);
        await 展开搜索组们(本次, false);
      } catch (错误) {
        if (搜索代际.current !== 本次) return;
        提交({ ...数据引用.current, 直接加载中: false, 直接错误: 取后端错误文案(错误) });
      }
    }, 搜索防抖毫秒);
    return () => window.clearTimeout(计时);
    // 查询 经引用读取；生效词 是唯一触发键
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [生效词]);

  /** 逐个展开搜索命中的非可选节点（目录顺序串行）；重开过=true 的重跑带强制刷新。
   *  仅限键们 传入时只展开这批键（追加页新增的命中组按需展开，不重跑全部组） */
  const 展开搜索组们 = async (本次: number, 重开过: boolean, 仅限键们?: readonly string[]) => {
    for (const 组 of 数据引用.current.搜索组们) {
      if (搜索代际.current !== 本次) return;
      if (仅限键们 !== undefined && !仅限键们.includes(组.节点.id)) continue;
      await 展开搜索组(组.节点.id, 本次, 重开过);
    }
  };

  /** 展开一个命中组：根命中（parent_id 空）先查二级再逐组查三级；二级命中直接查三级。
   *  组内项增量呈现；子查询换版时整组以强制刷新重开一次（重开过=true 防循环）。 */
  const 展开搜索组 = async (命中id: string, 本次: number, 重开过: boolean) => {
    const 方法 = 查询引用.current;
    if (!方法) return;
    const 命中 = 数据引用.current.搜索组们.find((组) => 组.节点.id === 命中id);
    if (!命中) return;
    const 序号 = 命中.序;
    const 落败 = (文案: string) => {
      if (搜索代际.current !== 本次) return;
      if (数据引用.current.搜索组们.find((组) => 组.节点.id === 命中id)?.序 !== 序号) return;
      更新搜索组(命中id, { 加载中: false, 错误: 文案 });
    };
    let 期望版本: string | null = null;
    /** 取一个父项的子页；换版返回 '换代'，作废/失败返回 null */
    const 收集子项 = async (父id: string): Promise<BFFTaxonomyItem[] | '换代' | null> => {
      let 页: 目录页<BFFTaxonomyItem>;
      try {
        页 = await 方法(
          'job-categories',
          { parentId: 父id, limit: 每页限量 },
          重开过 ? { 强制刷新: true } : undefined,
        );
      } catch (错误) {
        落败(取后端错误文案(错误));
        return null;
      }
      if (搜索代际.current !== 本次) return null;
      if (数据引用.current.搜索组们.find((组) => 组.节点.id === 命中id)?.序 !== 序号) return null;
      if (期望版本 !== null && 页.catalogVersion !== 期望版本) return '换代';
      if (期望版本 === null) 期望版本 = 页.catalogVersion;
      return 页.items;
    };
    const 重开本组 = async () => {
      if (重开过) {
        落败('目录版本已更新，请重试');
        return;
      }
      const 新序 = ++请求序.current;
      更新搜索组(命中id, { 项: [], 加载中: true, 错误: null, 序: 新序 });
      await 展开搜索组(命中id, 本次, true);
    };

    更新搜索组(命中id, { 项: [], 加载中: true, 错误: null });
    const 收集 = async (父id: string) => {
      const 结果 = await 收集子项(父id);
      if (结果 === null) return null;
      if (结果 === '换代') {
        await 重开本组();
        return null;
      }
      return 结果;
    };
    let 叶子们: BFFTaxonomyItem[] = [];
    if (命中.节点.parent_id === null) {
      // 命中的根：先查二级，再按目录顺序逐组查三级
      const 二级们 = await 收集(命中id);
      if (二级们 === null) return;
      for (const 二级 of 二级们) {
        if (搜索代际.current !== 本次) return;
        if (!二级.has_children) continue;
        const 子项们 = await 收集(二级.id);
        if (子项们 === null) return;
        叶子们 = 合并项们(叶子们, 子项们.filter((项) => 项.selectable));
        // 各二级组独立增量呈现：取完一组就提交一次
        更新搜索组(命中id, { 项: [...叶子们] });
      }
    } else {
      const 子项们 = await 收集(命中id);
      if (子项们 === null) return;
      叶子们 = 子项们.filter((项) => 项.selectable);
      更新搜索组(命中id, { 项: [...叶子们] });
    }
    if (搜索代际.current !== 本次) return;
    if (数据引用.current.搜索组们.find((组) => 组.节点.id === 命中id)?.序 !== 序号) return;
    更新搜索组(命中id, { 项: [...叶子们], 加载中: false, 错误: null, 序: 0 });
  };

  /** 搜索命中组的重试/换代重开：整组以强制刷新从它的首查询重跑一次 */
  const 重开搜索组 = (命中id: string) => {
    if (数据引用.current.搜索词 === '') return;
    const 新序 = ++请求序.current;
    更新搜索组(命中id, { 项: [], 加载中: true, 错误: null, 序: 新序 });
    void 展开搜索组(命中id, 搜索代际.current, true);
  };

  const 搜索加载更多 = async () => {
    const 现在 = 数据引用.current;
    if (现在.直接游标 === null || 现在.直接加载中) return;
    const 方法 = 查询引用.current;
    if (!方法) return;
    const 本次 = 搜索代际.current;
    提交({ ...现在, 直接加载中: true, 直接错误: null });
    try {
      const 页 = await 方法('job-categories', { q: 现在.搜索词, cursor: 现在.直接游标, limit: 每页限量 });
      if (搜索代际.current !== 本次) return;
      const 现在2 = 数据引用.current;
      if (现在2.直接版本 !== '' && 页.catalogVersion !== 现在2.直接版本) {
        // 搜索视图换代：整视图重置，强制刷新从搜索第一页重开并重新展开命中组
        const 重开 = await 方法('job-categories', { q: 现在.搜索词, limit: 每页限量 }, { 强制刷新: true });
        if (搜索代际.current !== 本次) return;
        写搜索首页(重开, 本次);
        await 展开搜索组们(本次, true);
        return;
      }
      // 追加页沿用首页（写搜索首页）的分类口径（review-r1 F4）：可选叶子进直接结果组；
      // 非可选命中登记为同名标题组（不渲染成禁用职位卡），只对新增组按需启动首屏展开
      const 新组们: 搜索组态[] = 页.items
        .filter((项) => !项.selectable)
        .map((节点) => ({ 节点, 项: [], 加载中: true, 错误: null, 序: ++请求序.current }));
      提交({
        ...数据引用.current,
        直接项: 合并项们(现在2.直接项, 页.items.filter((项) => 项.selectable)),
        直接游标: 页.nextCursor,
        直接加载中: false,
        搜索组们: [...现在2.搜索组们, ...新组们],
      });
      await 展开搜索组们(本次, false, 新组们.map((组) => 组.节点.id));
    } catch (错误) {
      if (搜索代际.current !== 本次) return;
      // 失败不动既有直接结果，游标不动，错误进直接组尾态
      提交({ ...数据引用.current, 直接加载中: false, 直接错误: 取后端错误文案(错误) });
    }
  };

  const 搜索重试 = async () => {
    const 现在 = 数据引用.current;
    const 方法 = 查询引用.current;
    if (!方法 || 现在.搜索词 === '' || 现在.直接加载中) return;
    const 本次 = 搜索代际.current;
    提交({ ...现在, 直接项: [], 直接游标: null, 直接加载中: true, 直接错误: null, 搜索组们: [] });
    try {
      const 页 = await 方法('job-categories', { q: 现在.搜索词, limit: 每页限量 });
      if (搜索代际.current !== 本次) return;
      写搜索首页(页, 本次);
      await 展开搜索组们(本次, false);
    } catch (错误) {
      if (搜索代际.current !== 本次) return;
      提交({ ...数据引用.current, 直接加载中: false, 直接错误: 取后端错误文案(错误) });
    }
  };

  // ── 挂载：读根并自动选首根；卸载：作废两视图的在飞响应 ─────────
  useEffect(() => {
    void 载入根页();
    return () => {
      浏览代际.current += 1;
      搜索代际.current += 1;
    };
    // 查询 经引用读取；挂载生命周期只走一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 展示映射 ─────────────────────────────────────────────────
  const 转项 = (项: BFFTaxonomyItem): 期望职位项 => ({
    键: 项.id,
    名称: 项.display_name,
    选中: 已选键们.includes(项.id),
    禁用: !项.selectable,
  });

  const 按键取项 = (键: string): BFFTaxonomyItem | undefined => {
    const 现在 = 数据引用.current;
    return (
      现在.根项.find((项) => 项.id === 键) ??
      现在.二级项.find((项) => 项.id === 键) ??
      现在.直接项.find((项) => 项.id === 键) ??
      Object.values(现在.组表).flatMap((组) => 组.项).find((项) => 项.id === 键) ??
      现在.搜索组们.flatMap((组) => 组.项).find((项) => 项.id === 键)
    );
  };

  const 组重试 = (组键: string) => {
    const 缓存 = 数据引用.current.组表[组键];
    // 有累计项说明失败发生在追加页：重试沿游标续传，不清旧项
    void 载入组页(组键, (缓存?.项.length ?? 0) === 0);
  };

  // 浏览组们：当前根的二级为标题组，各组带自己的三级项与尾态
  const 浏览组们: 期望职位组[] = 数据.二级项.map((二级) => {
    const 组 = 数据.组表[二级.id];
    return {
      键: 二级.id,
      标题: 二级.display_name,
      项们: (组?.项 ?? []).filter((项) => !项.has_children).map(转项),
      尾态: {
        加载中: 组?.加载中 ?? false,
        错误: 组?.错误 ?? null,
        还有: (组?.游标 ?? null) !== null,
        加载更多: () => void 载入组页(二级.id, false),
        重试: () => 组重试(二级.id),
      },
    };
  });

  // 搜索组们：空标题直接结果组 + 命中节点同名标题组；相同 ID 只展示一次可选项（按展示次序）
  const 已见 = new Set<string>();
  const 收可选项 = (项们: BFFTaxonomyItem[]): BFFTaxonomyItem[] => {
    const 结果: BFFTaxonomyItem[] = [];
    for (const 项 of 项们) {
      if (已见.has(项.id)) continue;
      已见.add(项.id);
      结果.push(项);
    }
    return 结果;
  };
  const 搜索组们: 期望职位组[] =
    数据.搜索词 === ''
      ? []
      : [
          {
            键: '搜索直接',
            标题: '',
            项们: 收可选项(数据.直接项).map(转项),
            尾态: {
              加载中: 数据.直接加载中,
              错误: 数据.直接错误,
              还有: 数据.直接游标 !== null,
              加载更多: () => void 搜索加载更多(),
              重试: () => void 搜索重试(),
            },
          },
          ...数据.搜索组们.map((组): 期望职位组 => ({
            键: 组.节点.id,
            标题: 组.节点.display_name,
            项们: 收可选项(组.项).map(转项),
            尾态: {
              加载中: 组.加载中,
              错误: 组.错误,
              还有: false,
              加载更多: () => undefined,
              重试: () => void 重开搜索组(组.节点.id),
            },
          })),
        ];

  return {
    根项们: 数据.根项.map((项) => ({ 键: 项.id, 名称: 项.display_name, 选中: 项.id === 数据.当前根id })),
    切换根,
    根尾态: {
      加载中: 数据.根加载中,
      错误: 数据.根错误,
      还有: 数据.根游标 !== null,
      加载更多: () => void 根加载更多(),
      重试: () => void 载入根页(),
    },
    组们: 数据.搜索词 === '' ? 浏览组们 : 搜索组们,
    右尾态: {
      加载中: 数据.右加载中,
      错误: 数据.右错误,
      还有: 数据.二级游标 !== null,
      加载更多: () => void 二级加载更多(),
      重试: () => {
        const 根id = 数据引用.current.当前根id;
        if (根id !== null) void 载入右视图(根id);
      },
    },
    按键取项,
  };
}
