// 选期望职位（/onboard/job）—— 2026-08-20 按 BOSS 截图顺序重排：
// 完善资料屏的职位行点进来，替代旧的底部弹层，升级为全屏 + 多选（上限 10）。
//
// 版式：大标题「期望职位是」+ 右上 N/10 计数 → 搜索框（搜 职业分类表 的小类）→
// 左大类栏 + 右小类多选卡 → 底部「已选」chips（点 ✕ 删）+ 保存键。
// 选好的职位落 全局.引导预填.职位（城市们原样带上），保存后返回完善资料屏回显。
//
// Task 4：Backend 分支按需 查询Taxonomy('job-categories')：首次读 roots，
// 展开按 parentId，搜索按 q；非 selectable 只展开，selectable=true 叶子原子保存
// {id,display_name}+字符串。Mock 分支保持本地 职业分类树 不变。

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import 样式 from './选期望职位.module.css';
import { 次级页外壳, 返回栏, 主按钮 } from '../组件/通用';
import { 放大镜图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 职业分类树 } from '../数据/职业分类';
import type { BFFTaxonomyItem } from '../数据/BFF契约';
import { 合并目录页 } from '../数据/目录选择';

/** 期望职位上限：与 BOSS 同档（与 学生分流 的快捷片共用同一档）*/
const 职位上限 = 10;
const 搜索防抖毫秒 = 250;

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
      return 引用 ? [{ id: 引用.id, display_name: 引用.display_name, parent_id: null, selectable: true }] : [];
    }
    const 引用们 = 全局.引导预填?.职位引用们 ?? [];
    return 引用们.map((条) => ({ id: 条.id, display_name: 条.display_name, parent_id: null, selectable: true }));
  });
  // Backend 右栏：当前选中大类的子项（首次取 roots 后默认选第一枚）
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
  const [根游标, 设根游标] = useState<string | null>(null);
  const [根加载中, 设根加载中] = useState(false);
  const [子项游标, 设子项游标] = useState<string | null>(null);
  const [子项加载中, 设子项加载中] = useState(false);
  const [搜索游标, 设搜索游标] = useState<string | null>(null);
  const [搜索加载中, 设搜索加载中] = useState(false);

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
        if (页.items.length > 0 && !当前根) {
          设当前根(页.items[0]);
          // 预载第一枚的子项（R2-M-3：导航代际守 stale）
          const 本次 = ++导航代际.current;
          try {
            const 子页 = await 方法('job-categories', { parentId: 页.items[0].id, limit: 50 });
            if (本次 !== 导航代际.current) return;
            设子项(子页.items);
            设子项游标(子页.nextCursor);
          } catch {
            if (本次 !== 导航代际.current) return;
            设子项([]);
            设子项游标(null);
          }
        }
      } catch {
        设根项([]);
        设根游标(null);
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
    if (搜词 === '') return;
    window.clearTimeout(计时.current);
    const 本次 = 搜索代际.current;
    计时.current = window.setTimeout(async () => {
      try {
        const 页 = await 方法('job-categories', { q: 搜词, limit: 50 });
        if (本次 !== 搜索代际.current) return;
        设搜索结果项(页.items);
        设搜索游标(页.nextCursor);
      } catch {
        if (本次 !== 搜索代际.current) return;
        设搜索结果项([]);
        设搜索游标(null);
      }
    }, 搜索防抖毫秒);
    return () => window.clearTimeout(计时.current);
  }, [搜词, 是后端]);

  // review-r2 R2-M-1：根加载更多
  const 根加载更多 = async () => {
    if (根游标 === null || 根加载中) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    设根加载中(true);
    try {
      const 页 = await 方法('job-categories', { cursor: 根游标, limit: 50 });
      设根项((旧) => 合并目录页(旧, 页.items));
      设根游标(页.nextCursor);
    } catch {
      // 失败不动，用户可再点
    } finally {
      设根加载中(false);
    }
  };

  // review-r2 R2-M-1：子项加载更多
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
      设子项((旧) => 合并目录页(旧, 页.items));
      设子项游标(页.nextCursor);
    } catch {
      if (本次导航 !== 导航代际.current || 当前根引用.current?.id !== 目标根id) return;
      // 失败不动，用户可再点
    } finally {
      if (本次导航 === 导航代际.current && 当前根引用.current?.id === 目标根id) 设子项加载中(false);
    }
  };

  // review-r2 R2-M-1：搜索结果加载更多
  const 搜索加载更多 = async () => {
    if (搜索游标 === null || 搜索加载中) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    const 本次 = 搜索代际.current;
    设搜索加载中(true);
    try {
      const 页 = await 方法('job-categories', { q: 搜词, cursor: 搜索游标, limit: 50 });
      if (本次 !== 搜索代际.current) return;
      设搜索结果项((旧) => 合并目录页(旧, 页.items));
      设搜索游标(页.nextCursor);
    } catch {
      if (本次 !== 搜索代际.current) return;
      // 失败不动
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

  // ── Backend 切换：非 selectable 只展开（按 parentId 取子项），selectable=true 才进已选 ──
  const 切换后端 = (项: BFFTaxonomyItem) => {
    if (!项.selectable) {
      // review-r1 P2-3：搜索模式下点非 selectable 命中时，清空搜索词退出搜索模式，
      // 否则搜索结果区只渲染 搜索结果项，加载到的 子项 看不见（点像没反应）。
      // 清词后回到双栏视图，左栏高亮该项，右栏显示其子项。
      // review-r2 R2-M-3：导航代际守 stale——快速切大类时慢的旧子项不覆盖新的
      设当前根(项);
      设子项([]);
      设子项游标(null);
      设关键词('');
      const 方法 = 方法引用.current;
      if (方法) {
        const 本次 = ++导航代际.current;
        void (async () => {
          try {
            const 子页 = await 方法('job-categories', { parentId: 项.id, limit: 50 });
            if (本次 !== 导航代际.current) return;
            设子项(子页.items);
            设子项游标(子页.nextCursor);
          } catch {
            if (本次 !== 导航代际.current) return;
            设子项([]);
            设子项游标(null);
          }
        })();
      }
      return;
    }
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

  // Backend 左栏点大类：加载该根的子项
  // review-r2 R2-M-3：导航代际守 stale——快速切大类时慢的旧子项不覆盖新的
  const 选根 = async (项: BFFTaxonomyItem) => {
    设当前根(项);
    设子项([]);
    设子项游标(null);
    const 方法 = 方法引用.current;
    if (!方法) return;
    const 本次 = ++导航代际.current;
    try {
      const 子页 = await 方法('job-categories', { parentId: 项.id, limit: 50 });
      if (本次 !== 导航代际.current) return;
      设子项(子页.items);
      设子项游标(子页.nextCursor);
    } catch {
      if (本次 !== 导航代际.current) return;
      设子项([]);
      设子项游标(null);
    }
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

  // Mock 小类卡
  const 小类卡 = (名: string) => (
    <button
      key={名}
      className={`${样式.职小类} ${已选.includes(名) ? 样式.职小类选中 : ''} 可点`}
      onClick={() => 切换(名)}
    >
      {/* 2026-08-24 全站选择风格统一（C1 定稿）：✓ 改由 CSS ::before 前置渲染，去掉文字尾缀避免双勾 */}
      {名}
    </button>
  );

  // Backend 小类卡：selectable=true 才进已选，非 selectable 提示但本任务不展开二级（保留导航语义）
  const 小类卡后端 = (项: BFFTaxonomyItem) => (
    <button
      key={项.id}
      className={`${样式.职小类} ${已选引用.some((条) => 条.id === 项.id) ? 样式.职小类选中 : ''} 可点`}
      onClick={() => 切换后端(项)}
      aria-disabled={!项.selectable ? true : undefined}
    >
      {项.display_name}
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

      {是后端 ? (
        /* ── Backend 分支：按需 查询Taxonomy('job-categories') ── */
        词 === '' ? (
          <div className={样式.职双栏}>
            <div className={`${样式.职左栏} 滚动区`}>
              {根项.map((项) => (
                <button
                  key={项.id}
                  className={`${样式.职大类} ${(当前根?.id === 项.id) ? 样式.职大类当前 : ''} 可点`}
                  onClick={() => 选根(项)}
                >
                  {项.display_name}
                </button>
              ))}
              {/* review-r2 R2-M-1：根分页加载更多 */}
              {根游标 !== null ? (
                <button
                  className="可点"
                  onClick={根加载更多}
                  disabled={根加载中}
                  style={{ width: '100%', padding: '10px', color: 'var(--最弱)' }}
                >
                  {根加载中 ? '加载中…' : '加载更多'}
                </button>
              ) : null}
            </div>
            <div className={`${样式.职右栏} 滚动区`}>
              {子项.length > 0 ? (
                <div className={样式.分组块}>
                  <div className={样式.岗位网}>{子项.map(小类卡后端)}</div>
                  {/* review-r2 R2-M-1：子项分页加载更多 */}
                  {子项游标 !== null ? (
                    <button
                      className="可点"
                      onClick={子项加载更多}
                      disabled={子项加载中}
                      style={{ width: '100%', padding: '10px', color: 'var(--最弱)' }}
                    >
                      {子项加载中 ? '加载中…' : '加载更多'}
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className={样式.无结果}>加载中…</div>
              )}
            </div>
          </div>
        ) : (
          <div className={`${样式.搜索结果区} 滚动区`}>
            {搜索结果项.map(小类卡后端)}
            {搜索结果项.length === 0 ? (
              <div className={样式.无结果}>没有匹配的职位，换个词试试。</div>
            ) : null}
            {/* review-r2 R2-M-1：搜索结果分页加载更多 */}
            {搜索游标 !== null ? (
              <button
                className="可点"
                onClick={搜索加载更多}
                disabled={搜索加载中}
                style={{ width: '100%', padding: '10px', color: 'var(--最弱)' }}
              >
                {搜索加载中 ? '加载中…' : '加载更多'}
              </button>
            ) : null}
          </div>
        )
      ) : (
        /* ── Mock 分支：保持本地 职业分类树 逻辑不变 ── */
        词 === '' ? (
          /* 左大类栏 + 右小类多选卡（沿用 发布岗位 / 旧职位弹层的双栏形态）*/
          <div className={样式.职双栏}>
            <div className={`${样式.职左栏} 滚动区`}>
              {职业分类树.map((组) => (
                <button
                  key={组.大类}
                  className={`${样式.职大类} ${组.大类 === 当前大类 ? 样式.职大类当前 : ''} 可点`}
                  onClick={() => 设当前大类(组.大类)}
                >
                  {组.大类}
                </button>
              ))}
            </div>
            <div className={`${样式.职右栏} 滚动区`}>
              {当前分组.map((分) => (
                <div key={分.组名} className={样式.分组块}>
                  <div className={样式.分组标}>{分.组名}</div>
                  <div className={样式.岗位网}>{分.岗位.map(小类卡)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={`${样式.搜索结果区} 滚动区`}>
            {搜索结果.map(小类卡)}
            {搜索结果.length === 0 ? (
              <div className={样式.无结果}>没有匹配的职位，换个词试试。</div>
            ) : null}
          </div>
        )
      )}

      {/* 底部已选 chips：点标签 ✕ 删除 */}
      {已选数 > 0 ? (
        <div className={样式.已选条}>
          <span className={样式.已选标}>已选</span>
          <div className={样式.已选标签组}>
            {是后端
              ? 已选引用.map((条) => (
                  <button
                    key={条.id}
                    className={`${样式.已选标签} 可点`}
                    onClick={() => 切换后端(条)}
                  >
                    {条.display_name} ✕
                  </button>
                ))
              : 已选.map((名) => (
                  <button key={名} className={`${样式.已选标签} 可点`} onClick={() => 切换(名)}>
                    {名} ✕
                  </button>
                ))}
          </div>
        </div>
      ) : null}

      <主按钮 文字="保存" 按下={保存} 禁用={已选数 === 0} />
    </次级页外壳>
  );
}