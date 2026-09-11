// 选期望职位（/onboard/job）—— 2026-08-20 按 BOSS 截图顺序重排：
// 完善资料屏的职位行点进来，替代旧的底部弹层，升级为全屏 + 多选（上限 10）。
//
// 版式：大标题「期望职位是」+ 右上 N/10 计数 → 搜索框（搜 职业分类表 的小类）→
// 左大类栏 + 右小类多选卡 → 底部「已选」chips（点 ✕ 删）+ 保存键。
// 选好的职位落 全局.引导预填.职位（城市们原样带上），保存后返回完善资料屏回显。
//
// Task 4：Backend 分支按需 查询Taxonomy('job-categories')：首次读 roots，
// 展开按 parentId，搜索按 q。Mock 分支保持本地 职业分类树 不变。
// Task 5：删掉 Backend 专属布局，两模式共用上面这一套 Mock JSX ——
// 可下钻看合同的 has_children、可写引用看 selectable，两者独立判断、不写死层数；
// 继续加载只挂在既有左/右栏滚动容器的滚动事件上，不新增「加载更多」节点。

import { useEffect, useRef, useState, type UIEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import 样式 from './选期望职位.module.css';
import { 次级页外壳, 返回栏, 主按钮 } from '../组件/通用';
import { 放大镜图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { 取后端错误文案 } from '../数据/HTTP客户端';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 职业分类树 } from '../数据/职业分类';
import type { BFFTaxonomyItem } from '../数据/BFF契约';
import { 合并目录页 } from '../数据/目录选择';

/** 期望职位上限：与 BOSS 同档（与 学生分流 的快捷片共用同一档）*/
const 职位上限 = 10;
const 搜索防抖毫秒 = 250;
/** 距底多少像素算「滚到底」——只用来判定，不改任何布局 */
const 到底余量 = 64;

/** 小类卡的展示输入：两模式给同样的输入就有同样的 DOM */
interface 小类片 {
  键: string;
  文字: string;
  选中: boolean;
  /** 既不能下钻也不能选的目录项：保留展示，但不响应点击 */
  不可操作?: boolean;
  按下: () => void;
}

export default function 选期望职位() {
  const { 返回 } = use导航();
  const { 状态: 全局, 派发, 数据源模式, 目录查询 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  const [查询参数] = useSearchParams();

  // 「添加求职期望」页的期望职位行点进来时带 ?来源=意向（规格：单选，写 意向草稿.期望职位）。
  // 不带这个参数就是注册引导的原路径 —— 那条路径的多选 + 写 引导预填 行为一个字都没动。
  const 来自意向 = 查询参数.get('来源') === '意向';

  // ── Mock 已选 state（保持原逻辑不变）──
  const [已选, 设已选] = useState<string[]>(() =>
    来自意向
      ? 全局.意向草稿.期望职位 === ''
        ? []
        : [全局.意向草稿.期望职位]
      : 全局.引导预填?.职位 ?? []
  );
  const [当前大类, 设当前大类] = useState(职业分类树[0].大类);
  const [关键词, 设关键词] = useState('');

  // ── Backend 已选 state：完整项（id + display_name），ID 去重 ──
  const [已选引用, 设已选引用] = useState<BFFTaxonomyItem[]>(() => {
    if (!是后端) return [];
    if (来自意向) {
      const 引用 = 全局.意向草稿.职位引用;
      return 引用 ? [{ id: 引用.id, display_name: 引用.display_name, parent_id: null, selectable: true, has_children: false }] : [];
    }
    const 引用们 = 全局.引导预填?.职位引用们 ?? [];
    return 引用们.map((条) => ({ id: 条.id, display_name: 条.display_name, parent_id: null, selectable: true, has_children: false }));
  });
  // Backend 右栏：当前节点的子项（首次取 roots 后默认选第一枚）
  const [根项, 设根项] = useState<BFFTaxonomyItem[]>([]);
  const [当前根, 设当前根] = useState<BFFTaxonomyItem | null>(null);
  const [子项, 设子项] = useState<BFFTaxonomyItem[]>([]);
  const [搜索结果项, 设搜索结果项] = useState<BFFTaxonomyItem[]>([]);
  const 计时 = useRef(0);
  // review-r1 P2-2：代际 ref 守 stale response——慢的旧搜索结果不覆盖新的
  const 搜索代际 = useRef(0);
  // review-r2 R2-M-3：导航代际 ref 守 stale child loading——快速切大类时慢的旧子项不覆盖新的
  const 导航代际 = useRef(0);
  const 方法引用 = useRef(目录查询?.查询Taxonomy);
  方法引用.current = 目录查询?.查询Taxonomy;
  // review-r3 R3-I-8：当前根 ref——子项加载更多提交前确认当前根仍是发起请求的那个根
  const 当前根引用 = useRef(当前根);
  当前根引用.current = 当前根;

  // review-r2 R2-M-1：分页游标 + 加载中状态（root / child / search）
  // review-cx F5（冻结合同 2）：各查询第一页的 catalogVersion —— 追加页返回不同版本时
  // 不跨版本合并，丢弃该查询累计的旧页与游标并从该查询第一页静默重开（版本归各自查询）。
  const [根游标, 设根游标] = useState<string | null>(null);
  const [根加载中, 设根加载中] = useState(false);
  const [子项游标, 设子项游标] = useState<string | null>(null);
  const [子项加载中, 设子项加载中] = useState(false);
  const [搜索游标, 设搜索游标] = useState<string | null>(null);
  const [搜索加载中, 设搜索加载中] = useState(false);
  const [根版本, 设根版本] = useState('');
  const [子项版本, 设子项版本] = useState('');
  const [搜索版本, 设搜索版本] = useState('');

  // Backend mount：读 roots
  useEffect(() => {
    if (!是后端) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    void (async () => {
      try {
        const 页 = await 方法('job-categories', { limit: 50 });
        设根项(页.items);
        设根游标(页.nextCursor);
        设根版本(页.catalogVersion);
        if (页.items.length > 0 && !当前根) {
          设当前根(页.items[0]);
          // 预载第一枚的子项（R2-M-3：导航代际守 stale）
          const 本次 = ++导航代际.current;
          设子项加载中(true);
          try {
            const 子页 = await 方法('job-categories', { parentId: 页.items[0].id, limit: 50 });
            if (本次 !== 导航代际.current) return;
            设子项(子页.items);
            设子项游标(子页.nextCursor);
            设子项版本(子页.catalogVersion);
          } catch (错误) {
            if (本次 !== 导航代际.current) return;
            设子项([]);
            设子项游标(null);
            轻提示(取后端错误文案(错误));
          } finally {
            if (本次 === 导航代际.current) 设子项加载中(false);
          }
        }
      } catch (错误) {
        设根项([]);
        设根游标(null);
        轻提示(取后端错误文案(错误));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [是后端]);

  // Backend 搜索：250ms debounce
  const 搜词 = 关键词.trim();
  useEffect(() => {
    if (!是后端) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    // review-r3 R3-I-7：每次查询词变化都重置分页状态（结果/游标/加载），避免新词带着旧游标请求
    搜索代际.current += 1;
    设搜索结果项([]);
    设搜索游标(null);
    设搜索加载中(false);
    设搜索版本('');
    if (搜词 === '') return;
    window.clearTimeout(计时.current);
    const 本次 = 搜索代际.current;
    计时.current = window.setTimeout(async () => {
      try {
        const 页 = await 方法('job-categories', { q: 搜词, limit: 50 });
        if (本次 !== 搜索代际.current) return;
        设搜索结果项(页.items);
        设搜索游标(页.nextCursor);
        设搜索版本(页.catalogVersion);
      } catch (错误) {
        if (本次 !== 搜索代际.current) return;
        设搜索结果项([]);
        设搜索游标(null);
        轻提示(取后端错误文案(错误));
      }
    }, 搜索防抖毫秒);
    return () => window.clearTimeout(计时.current);
  }, [搜词, 是后端]);

  // review-r2 R2-M-1：根的下一页（滚到底触发）
  const 根加载更多 = async () => {
    if (根游标 === null || 根加载中) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    设根加载中(true);
    try {
      const 页 = await 方法('job-categories', { cursor: 根游标, limit: 50 });
      if (页.catalogVersion !== 根版本) {
        // review-cx F5：目录换代 —— 旧游标是死页，从根查询第一页静默重开
        const 重开 = await 方法('job-categories', { limit: 50 });
        设根项(重开.items);
        设根游标(重开.nextCursor);
        设根版本(重开.catalogVersion);
        return;
      }
      设根项((旧) => 合并目录页(旧, 页.items));
      设根游标(页.nextCursor);
    } catch (错误) {
      // 游标不动，用户再滚一次就是重试
      轻提示(取后端错误文案(错误));
    } finally {
      设根加载中(false);
    }
  };

  // review-r2 R2-M-1：子项的下一页（滚到底触发）
  // review-r3 R3-I-8：提交前确认导航代际未变且当前根仍是发起请求的那个根——
  // 否则 A 的第二页会 append 到 B 的子项里并替换 B 的游标。
  const 子项加载更多 = async () => {
    if (子项游标 === null || 子项加载中 || !当前根) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    const 本次导航 = 导航代际.current;
    const 目标根id = 当前根.id;
    设子项加载中(true);
    try {
      const 页 = await 方法('job-categories', { parentId: 目标根id, cursor: 子项游标, limit: 50 });
      if (本次导航 !== 导航代际.current || 当前根引用.current?.id !== 目标根id) return;
      if (页.catalogVersion !== 子项版本) {
        // review-cx F5：目录换代 —— 子项整组替换为新版本第一页（既有 parentId 路径，静默）
        const 重开 = await 方法('job-categories', { parentId: 目标根id, limit: 50 });
        if (本次导航 !== 导航代际.current || 当前根引用.current?.id !== 目标根id) return;
        设子项(重开.items);
        设子项游标(重开.nextCursor);
        设子项版本(重开.catalogVersion);
        return;
      }
      设子项((旧) => 合并目录页(旧, 页.items));
      设子项游标(页.nextCursor);
    } catch (错误) {
      if (本次导航 !== 导航代际.current || 当前根引用.current?.id !== 目标根id) return;
      轻提示(取后端错误文案(错误));
    } finally {
      if (本次导航 === 导航代际.current && 当前根引用.current?.id === 目标根id) 设子项加载中(false);
    }
  };

  // review-r2 R2-M-1：搜索结果的下一页（滚到底触发）
  const 搜索加载更多 = async () => {
    if (搜索游标 === null || 搜索加载中) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    const 本次 = 搜索代际.current;
    设搜索加载中(true);
    try {
      const 页 = await 方法('job-categories', { q: 搜词, cursor: 搜索游标, limit: 50 });
      if (本次 !== 搜索代际.current) return;
      if (页.catalogVersion !== 搜索版本) {
        // review-cx F5：目录换代 —— 搜索结果整组替换为新版本第一页（静默）
        const 重开 = await 方法('job-categories', { q: 搜词, limit: 50 });
        if (本次 !== 搜索代际.current) return;
        设搜索结果项(重开.items);
        设搜索游标(重开.nextCursor);
        设搜索版本(重开.catalogVersion);
        return;
      }
      设搜索结果项((旧) => 合并目录页(旧, 页.items));
      设搜索游标(页.nextCursor);
    } catch (错误) {
      if (本次 !== 搜索代际.current) return;
      轻提示(取后端错误文案(错误));
    } finally {
      设搜索加载中(false);
    }
  };

  // ── Mock 切换（保持原逻辑不变）──
  const 切换 = (名: string) => {
    设已选((旧) => {
      if (来自意向) return 旧.includes(名) ? [] : [名];
      if (旧.includes(名)) return 旧.filter((条) => 条 !== 名);
      if (旧.length >= 职位上限) {
        轻提示(`最多选 ${职位上限} 个`);
        return 旧;
      }
      return [...旧, 名];
    });
  };

  // Backend 下钻：按 parentId 取该节点的子项，进右栏（左栏保持根列表）
  // review-r2 R2-M-3：导航代际守 stale——快速切换时慢的旧子项不覆盖新的
  const 下钻 = async (项: BFFTaxonomyItem) => {
    // review-r1 P2-3：搜索模式下点命中时清空搜索词退出搜索模式，
    // 否则搜索结果区只渲染 搜索结果项，加载到的 子项 看不见（点像没反应）。
    设当前根(项);
    当前根引用.current = 项;
    设子项([]);
    设子项游标(null);
    设子项版本('');
    设关键词('');
    const 方法 = 方法引用.current;
    if (!方法) return;
    const 本次 = ++导航代际.current;
    设子项加载中(true);
    try {
      const 子页 = await 方法('job-categories', { parentId: 项.id, limit: 50 });
      if (本次 !== 导航代际.current) return;
      设子项(子页.items);
      设子项游标(子页.nextCursor);
      设子项版本(子页.catalogVersion);
    } catch (错误) {
      if (本次 !== 导航代际.current) return;
      设子项([]);
      设子项游标(null);
      轻提示(取后端错误文案(错误));
    } finally {
      if (本次 === 导航代际.current) 设子项加载中(false);
    }
  };

  // ── Backend 切换：可下钻看 has_children，可写引用看 selectable，两者独立判断 ──
  // 两者同真时现有控件表达不了「选此节点 / 继续下钻」，保留导航、不猜选择（见报告 PM 缺口）。
  const 切换后端 = (项: BFFTaxonomyItem) => {
    if (项.has_children) {
      void 下钻(项);
      return;
    }
    if (!项.selectable) return;
    设已选引用((旧) => {
      if (来自意向) return 旧.some((条) => 条.id === 项.id) ? [] : [项];
      if (旧.some((条) => 条.id === 项.id)) return 旧.filter((条) => 条.id !== 项.id);
      if (旧.length >= 职位上限) {
        轻提示(`最多选 ${职位上限} 个`);
        return 旧;
      }
      return [...旧, 项];
    });
  };

  const 保存 = () => {
    if (是后端) {
      if (来自意向) {
        const 选 = 已选引用[0];
        派发({
          型: '改意向草稿',
          补丁: {
            期望职位: 选?.display_name ?? '',
            职位引用: 选 ? { id: 选.id, display_name: 选.display_name } : undefined,
          },
        });
      } else {
        派发({
          型: '存引导预填',
          // review-r3 R3-Minor-1：Backend 无引导预填时城市回落为空（不写 ['上海']），
          // 否则会落一个无引用的「上海」字符串，看起来像选中但下一步按钮因缺 refs 仍禁用。
          城市们: 全局.引导预填?.城市们 ?? [],
          职位: 已选引用.map((条) => 条.display_name),
          城市引用们: 全局.引导预填?.城市引用们 ?? [],
          职位引用们: 已选引用.map((条) => ({ id: 条.id, display_name: 条.display_name })),
        });
      }
      返回();
      return;
    }
    if (来自意向) {
      派发({ 型: '改意向草稿', 补丁: { 期望职位: 已选[0] ?? '' } });
      返回();
      return;
    }
    派发({
      型: '存引导预填',
      城市们: 全局.引导预填?.城市们 ?? ['上海'],
      职位: 已选,
      城市引用们: [],
      职位引用们: [],
    });
    返回();
  };

  const 词 = 关键词.trim();
  // Mock 搜索直接跨所有大类匹配小类名，命中即平铺展示
  const 搜索结果 =
    词 === ''
      ? []
      : 职业分类树.flatMap((组) =>
          组.分组.flatMap((分) => 分.岗位.filter((名) => 名.includes(词)))
        );

  // 右栏按分组分块（截图：分组小标题 + 岗位片两列）
  const 当前分组 = 职业分类树.find((组) => 组.大类 === 当前大类)?.分组 ?? [];

  // ── 两模式的展示输入（下面只有一套 JSX）──
  const 后端片 = (项: BFFTaxonomyItem): 小类片 => ({
    键: 项.id,
    文字: 项.display_name,
    选中: 已选引用.some((条) => 条.id === 项.id),
    不可操作: !项.has_children && !项.selectable,
    按下: () => 切换后端(项),
  });
  const Mock片 = (名: string): 小类片 => ({
    键: 名,
    文字: 名,
    选中: 已选.includes(名),
    按下: () => 切换(名),
  });

  const 左栏项们: { 键: string; 文字: string; 当前: boolean; 按下: () => void }[] = 是后端
    ? 根项.map((项) => ({
        键: 项.id,
        文字: 项.display_name,
        当前: 当前根?.id === 项.id,
        按下: () => void 下钻(项),
      }))
    : 职业分类树.map((组) => ({
        键: 组.大类,
        文字: 组.大类,
        当前: 组.大类 === 当前大类,
        按下: () => 设当前大类(组.大类),
      }));
  // Backend 的目录在这一层没有分组名：传真实空值，不拿 Mock 的分组标题充数
  const 右栏分组们: { 键: string; 组名: string; 片们: 小类片[] }[] = 是后端
    ? 子项.length > 0
      ? [{ 键: 当前根?.id ?? '子项', 组名: '', 片们: 子项.map(后端片) }]
      : []
    : 当前分组.map((分) => ({ 键: 分.组名, 组名: 分.组名, 片们: 分.岗位.map(Mock片) }));
  const 搜索片们: 小类片[] = 是后端 ? 搜索结果项.map(后端片) : 搜索结果.map(Mock片);
  const 已选片们: { 键: string; 文字: string; 按下: () => void }[] = 是后端
    ? 已选引用.map((条) => ({ 键: 条.id, 文字: 条.display_name, 按下: () => 切换后端(条) }))
    : 已选.map((名) => ({ 键: 名, 文字: 名, 按下: () => 切换(名) }));

  // Task 5：继续加载只挂在既有滚动容器上，游标归各自的查询
  const 造滚动加载 = (加载: () => Promise<void>) => (事件: UIEvent<HTMLDivElement>) => {
    if (!是后端) return;
    const 元素 = 事件.currentTarget;
    if (元素.scrollTop + 元素.clientHeight < 元素.scrollHeight - 到底余量) return;
    void 加载();
  };

  const 小类卡 = (片: 小类片) => (
    <button
      key={片.键}
      className={`${样式.职小类} ${片.选中 ? 样式.职小类选中 : ''} 可点`}
      onClick={片.按下}
      aria-disabled={片.不可操作 ? true : undefined}
    >
      {/* 2026-08-24 全站选择风格统一（C1 定稿）：✓ 改由 CSS ::before 前置渲染，去掉文字尾缀避免双勾 */}
      {片.文字}
    </button>
  );

  const 已选数 = 是后端 ? 已选引用.length : 已选.length;

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底改白底
    <次级页外壳 白底>
      <返回栏 返回={返回} />

      {/* 大标题 + 右上 N/10 计数。意向来源是单选，没有 N/10 这回事，计数整枚不渲染 ——
          留着会显示「1/10」，把一个单选说成还能再选九个 */}
      <div className={样式.标题行}>
        <h1 className={样式.大标题}>期望职位是</h1>
        {来自意向 ? null : (
          <span className={`${样式.计数} 等宽数字`}>
            {已选数}/{职位上限}
          </span>
        )}
      </div>

      <div className={样式.搜索条}>
        <放大镜图标 尺寸={15} 色="var(--最弱)" 线宽={2.2} />
        <input
          className={样式.搜索输入}
          placeholder="搜索职位"
          value={关键词}
          onChange={(事件) => 设关键词(事件.target.value)}
        />
      </div>

      {词 === '' ? (
        /* 左大类栏 + 右小类多选卡（沿用 发布岗位 / 旧职位弹层的双栏形态）*/
        <div className={样式.职双栏}>
          <div className={`${样式.职左栏} 滚动区`} onScroll={造滚动加载(根加载更多)}>
            {左栏项们.map((项) => (
              <button
                key={项.键}
                className={`${样式.职大类} ${项.当前 ? 样式.职大类当前 : ''} 可点`}
                onClick={项.按下}
              >
                {项.文字}
              </button>
            ))}
          </div>
          <div className={`${样式.职右栏} 滚动区`} onScroll={造滚动加载(子项加载更多)}>
            {右栏分组们.map((组) => (
              <div key={组.键} className={样式.分组块}>
                {组.组名 === '' ? null : <div className={样式.分组标}>{组.组名}</div>}
                <div className={样式.岗位网}>{组.片们.map(小类卡)}</div>
              </div>
            ))}
            {右栏分组们.length === 0 && 子项加载中 ? (
              <div className={样式.无结果}>加载中…</div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className={`${样式.搜索结果区} 滚动区`} onScroll={造滚动加载(搜索加载更多)}>
          {搜索片们.map(小类卡)}
          {搜索片们.length === 0 ? (
            <div className={样式.无结果}>没有匹配的职位，换个词试试。</div>
          ) : null}
        </div>
      )}

      {/* 底部已选 chips：点标签 ✕ 删除（Backend 按 ID，同名两条互不误删）*/}
      {已选数 > 0 ? (
        <div className={样式.已选条}>
          <span className={样式.已选标}>已选</span>
          <div className={样式.已选标签组}>
            {已选片们.map((条) => (
              <button key={条.键} className={`${样式.已选标签} 可点`} onClick={条.按下}>
                {条.文字} ✕
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <主按钮 文字="保存" 按下={保存} 禁用={已选数 === 0} />
    </次级页外壳>
  );
}
