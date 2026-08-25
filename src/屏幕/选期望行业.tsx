// 选期望行业（/intentions/industries）—— 添加求职期望页的次级页 B（规格截图 5）。
//
// 版式自上而下：返回栏 ‹ + 右上「保存」→ 大标题「已选行业」+ 右上 N/3 计数 →
// 副标题 →「推荐」一行 chips（取 行业字典 前 3 个一级行业）→
// 手风琴清单（一级行业一行，点开展开该行业的 细分 chips 多选）。
//
// 选择结果直接写进 意向草稿.期望行业们 —— 主屏与本页共用同一份草稿，
// 所以右上「保存」和返回键做的是同一件事（都只是 返回()）：
// 不存在「不点保存就丢」的第二条路径，也就不会出现两个入口结果不一致。
//
// Task 4：Backend 分支按需 查询Taxonomy('industries')：roots → 展开 parentId →
// selectable=true 叶子原子保存 期望行业们+行业引用们（ID 去重，上限 3）。
// 推荐 chips 只渲染 BFF-returned 项。Mock 分支保持本地 行业字典 不变。

import { useEffect, useRef, useState } from 'react';
import 样式 from './选期望行业.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 行业字典 } from '../数据/城市与行业';
import type { BFFTaxonomyItem } from '../数据/BFF契约';
import type { 目录选择值 } from '../数据/招聘数据源类型';

/** 期望行业上限（规格：最多 3 个）*/
const 行业上限 = 3;

/** 「推荐」区固定取字典前 3 个一级行业 —— 规格指定的取法，不做额外排序或打分 */
const 推荐行业们 = 行业字典.slice(0, 3).map((组) => 组.行业);

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
  const [展开状态, 设展开状态] = useState<Record<string, { 子项: BFFTaxonomyItem[]; 加载中: boolean }>>({});
  const [孙项表, 设孙项表] = useState<Record<string, BFFTaxonomyItem[]>>({});
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
      } catch {
        设根项([]);
      }
    })();
  }, [是后端]);

  const 展开根 = async (项: BFFTaxonomyItem) => {
    if (展开状态[项.id]) return;
    设展开状态((旧) => ({ ...旧, [项.id]: { 子项: [], 加载中: true } }));
    const 方法 = 方法引用.current;
    if (!方法) return;
    try {
      const 子页 = await 方法('industries', { parentId: 项.id, limit: 50 });
      设展开状态((旧) => ({ ...旧, [项.id]: { 子项: 子页.items, 加载中: false } }));
    } catch {
      设展开状态((旧) => ({ ...旧, [项.id]: { 子项: [], 加载中: false } }));
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
    } catch {
      设孙项表((旧) => ({ ...旧, [项.id]: [] }));
    }
  };

  // ── Mock 手风琴默认全部收起；组里已经有选中的细分时那几组开着进来 ──
  const [展开的行业们, 设展开的行业们] = useState<string[]>(() =>
    行业字典
      .filter((组) => 组.细分.some((细分名) => 已选行业们.includes(细分名)))
      .map((组) => 组.行业),
  );

  /** 已选 → 再点取消；未选且没到上限 → 追加。Backend 同步写 行业引用们 */
  const 切换行业 = (名: string, 引用?: 目录选择值) => {
    if (已选行业们.includes(名)) {
      派发({
        型: '改意向草稿',
        补丁: {
          期望行业们: 已选行业们.filter((条) => 条 !== 名),
          行业引用们: 是后端 ? 已选引用.filter((条) => 条.id !== 引用?.id) : undefined,
        },
      });
      return;
    }
    if (已选满) return;
    if (是后端 && 引用) {
      // ID 去重
      if (已选引用.some((条) => 条.id === 引用.id)) return;
      派发({
        型: '改意向草稿',
        补丁: {
          期望行业们: [...已选行业们, 名],
          行业引用们: [...已选引用, 引用],
        },
      });
    } else {
      派发({ 型: '改意向草稿', 补丁: { 期望行业们: [...已选行业们, 名] } });
    }
  };

  const 切换展开 = (行业名: string) => {
    设展开的行业们((旧) =>
      旧.includes(行业名) ? 旧.filter((条) => 条 !== 行业名) : [...旧, 行业名],
    );
  };

  /** 行业 chip：推荐区（一级行业名）与手风琴展开区（细分名）共用同一枚。
   *  Backend 子项若非 selectable，点击展开取孙项，不进已选 */
  const 行业片 = (名: string, 引用?: 目录选择值, 项?: BFFTaxonomyItem) => {
    const 选中 = 已选行业们.includes(名);
    const 不可点 = !选中 && 已选满;
    return (
      <button
        key={名}
        className={[
          样式.行业片,
          选中 ? 样式.行业片选中 : '',
          不可点 ? 样式.行业片禁用 : '可点',
        ].join(' ')}
        onClick={() => {
          // Backend 非 selectable 子项：展开取孙项，不提交
          if (是后端 && 项 && !项.selectable) {
            void 展开子(项);
            return;
          }
          切换行业(名, 引用);
        }}
        disabled={不可点}
        aria-pressed={选中}
      >
        {名}
      </button>
    );
  };

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底改白底
    <次级页外壳 白底>
      <返回栏
        返回={返回}
        右侧={
          <button className={`${样式.保存键} 可点`} onClick={返回}>
            保存
          </button>
        }
      />

      {/* 大标题 + 右上 N/3 计数（版式同 选工作城市 的标题行）*/}
      <div className={样式.标题行}>
        <h1 className={样式.大标题}>已选行业</h1>
        <span className={`${样式.计数} 等宽数字`}>
          {已选行业们.length}/{行业上限}
        </span>
      </div>
      <p className={样式.副标题}>请选择行业，最多3个</p>

      <滚动区>
        <div className={样式.内容区}>
          <div className={样式.组标}>推荐</div>
          <div className={样式.推荐片组}>
            {是后端
              ? 根项.slice(0, 3).map((项) => (
                  <button
                    key={项.id}
                    className={`${样式.行业片} 可点`}
                    onClick={() => 展开根(项)}
                  >
                    {项.display_name}
                  </button>
                ))
              : 推荐行业们.map((名) => 行业片(名))}
          </div>

          <div className={样式.手风琴}>
            {是后端
              ? 根项.map((项) => {
                  const 状态 = 展开状态[项.id];
                  const 展开 = Boolean(状态);
                  return (
                    <div key={项.id} className={样式.手风琴组}>
                      <button
                        className={`${样式.手风琴行} 可点`}
                        onClick={() => 展开根(项)}
                        aria-expanded={展开}
                      >
                        <span className={样式.手风琴行名}>{项.display_name}</span>
                        <span className={样式.展开箭头}>{展开 ? '⌃' : '⌄'}</span>
                      </button>
                      {展开 ? (
                        <div className={样式.细分片组}>
                          {状态?.加载中 && 状态.子项.length === 0 ? (
                            <div className={样式.无结果}>加载中…</div>
                          ) : null}
                          {状态?.子项.map((子) => (
                            <div key={子.id}>
                              {行业片(子.display_name, { id: 子.id, display_name: 子.display_name }, 子)}
                              {/* 非 selectable 子项展开后的孙项（>2 级 taxonomy）*/}
                              {孙项表[子.id]?.length ? (
                                <div className={样式.细分片组} style={{ paddingLeft: 12 }}>
                                  {孙项表[子.id].map((孙) =>
                                    行业片(孙.display_name, { id: 孙.id, display_name: 孙.display_name }, 孙),
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              : 行业字典.map((组) => {
                  const 展开 = 展开的行业们.includes(组.行业);
                  return (
                    <div key={组.行业} className={样式.手风琴组}>
                      <button
                        className={`${样式.手风琴行} 可点`}
                        onClick={() => 切换展开(组.行业)}
                        aria-expanded={展开}
                      >
                        <span className={样式.手风琴行名}>{组.行业}</span>
                        <span className={样式.展开箭头}>{展开 ? '⌃' : '⌄'}</span>
                      </button>
                      {展开 ? (
                        <div className={样式.细分片组}>{组.细分.map((名) => 行业片(名))}</div>
                      ) : null}
                    </div>
                  );
                })}
          </div>
        </div>
      </滚动区>
    </次级页外壳>
  );
}