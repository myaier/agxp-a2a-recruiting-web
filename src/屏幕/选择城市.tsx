// 选择城市（/intentions/cities）—— 「添加求职期望」的次级页 A，多选 0/9。
//
// 版式照规格截图 3 自上而下：
//   ✕ 关闭 → 大标题「选择城市」+ 右上 N/9 → 副标题 → 搜索框 →
//   当前/历史访问城市 → 热门城市 → A-Z 分节（右侧字母索引条）→ 底部已选 chips + 保存。
//
// 与 选工作城市（/onboard/city，单选工作城市）的分工：那屏选**一个**主工作城市，
// 这屏选**另外**最多 9 个感兴趣城市，落 意向草稿.感兴趣城市们，互不覆盖。
//
// Task 3：Backend 分支复用 选工作城市 的同一套城市查询钩子（use城市分组/use城市搜索），
// 按 ID 去重，主城市（工作城市引用）不进入备选列表。Mock 分支保持本地 热门城市/A-Z 分节 不变。

import { useMemo, useRef, useState } from 'react';
import 样式 from './选择城市.module.css';
import { 次级页外壳, 主按钮 } from '../组件/通用';
import { 放大镜图标 } from '../组件/图标';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 热门城市, 城市分组 } from '../数据/城市与行业';
import { 城市按首字母, 城市拼音, 全部城市 } from '../数据/城市首字母';
import type { BFFLocationItem } from '../数据/BFF契约';
import { use城市搜索, use城市分组 } from './城市查询钩子';

/** 感兴趣城市多选上限（规格：其他感兴趣城市（N/9））*/
const 城市上限 = 9;

/** 当前/历史访问城市：原型没有定位与浏览历史，固定上海 ——
 *  和 选工作城市 的「当前定位」保持同一个值，两屏别互相打脸。 */
const 当前历史访问城市 = ['上海'];

export default function 选择城市() {
  const { 返回 } = use导航();
  const { 状态: 全局, 派发, 数据源模式, 目录查询 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';

  // ── 已选 state ──
  // Backend：BFFLocationItem[]（完整项，含 id/display_name），ID 去重；Mock：string[]，字符串去重。
  // 保存时映射为 目录选择值（只取 id + display_name）。
  // 进页时取草稿里已有的选择；改动先落本地，点保存才写回 —— 中途 ✕ 退出不留脏数据
  const [已选引用, 设已选引用] = useState<BFFLocationItem[]>(() => {
    if (!是后端) return [];
    const 引用们 = 全局.意向草稿.感兴趣城市引用们 ?? [];
    return 引用们.map((条) => ({ id: 条.id, display_name: 条.display_name } as BFFLocationItem));
  });
  const [已选, 设已选] = useState<string[]>(() =>
    是后端 ? 已选引用.map((条) => 条.display_name) : 全局.意向草稿.感兴趣城市们,
  );

  // 主城市 ID（Backend）：不进入备选列表
  const 主城市Id = 是后端 ? 全局.意向草稿.工作城市引用?.id : undefined;

  // ── 搜索 / 分组查询（Backend 分支，复用 选工作城市 同一套钩子）──
  const { 词, 设词, 结果: 搜索结果项, 搜索中, 下一页游标: 搜索下一页, 加载中: 搜索加载中, 加载更多: 搜索加载更多 } = use城市搜索(
    是后端 ? 目录查询?.查询Location : undefined,
  );
  const { 状态表, 展开集合, 切换展开 } = use城市分组(
    是后端 ? 目录查询?.查询Location : undefined,
  );

  const 选满 = (是后端 ? 已选引用.length : 已选.length) >= 城市上限;

  const 切换后端 = (项: BFFLocationItem) => {
    // 主城市不进入备选列表
    if (项.id === 主城市Id) return;
    设已选引用((旧) => {
      if (旧.some((条) => 条.id === 项.id))
        return 旧.filter((条) => 条.id !== 项.id);
      // 选满后未选中的城片已经 disabled，这里是兜底
      if (旧.length >= 城市上限) return 旧;
      return [...旧, 项];
    });
  };

  // Mock 分支切换（保持原逻辑不变）
  const 切换 = (城: string) => {
    设已选((旧) => {
      if (旧.includes(城)) return 旧.filter((条) => 条 !== 城);
      // 选满后未选中的城片已经 disabled，这里是兜底：宁可什么都不发生，也不越过上限
      if (旧.length >= 城市上限) return 旧;
      return [...旧, 城];
    });
  };

  const 保存 = () => {
    if (是后端) {
      派发({
        型: '改意向草稿',
        补丁: {
          感兴趣城市们: 已选引用.map((条) => 条.display_name),
          感兴趣城市引用们: 已选引用.map((条) => ({ id: 条.id, display_name: 条.display_name })),
        },
      });
    } else {
      派发({ 型: '改意向草稿', 补丁: { 感兴趣城市们: 已选 } });
    }
    返回();
  };

  // 中文名和全拼都算命中：输「杭」「hangzhou」「hang」都出杭州（Mock 分支本地过滤）
  const 搜索词 = 词.trim().toLowerCase();
  const 搜索结果 = useMemo(
    () =>
      搜索词 === ''
        ? []
        : 全部城市.filter((城) => 城.includes(搜索词) || (城市拼音[城] ?? '').includes(搜索词)),
    [搜索词],
  );

  // 字母索引条要把对应分节滚到列表顶部，所以得拿到滚动容器和每个分节的真实节点
  const 列表容器 = useRef<HTMLDivElement>(null);
  const 分节节点 = useRef<Record<string, HTMLDivElement | null>>({});

  const 滚到分节 = (首字母: string) => {
    const 容器 = 列表容器.current;
    const 分节 = 分节节点.current[首字母];
    if (!容器 || !分节) return;
    // 分节相对容器内容顶部的偏移 = 两者视口坐标之差 + 容器当前已滚动的量
    const 偏移 =
      分节.getBoundingClientRect().top - 容器.getBoundingClientRect().top + 容器.scrollTop;
    容器.scrollTo({ top: 偏移, behavior: 'smooth' });
  };

  /** 一枚城市片。三态：未选 / 选中（1.5px 亮绿描边 + 前置 ✓）/ 选满后未选中（变灰不可点）*/
  const 城市片 = (城: string, 键?: string) => {
    const 选中 = 已选.includes(城);
    const 不可点 = 选满 && !选中;
    return (
      <button
        key={键 ?? 城}
        className={[
          样式.城片,
          选中 ? 样式.城片选中 : '',
          不可点 ? 样式.城片变灰 : '可点',
        ].join(' ')}
        onClick={() => 切换(城)}
        disabled={不可点}
      >
        {/* 2026-08-24 全站选择风格统一（C1 定稿）：✓ 改由 CSS ::before 前置渲染，去掉文字尾缀避免双勾 */}
        {城}
      </button>
    );
  };

  /** Backend 城市片：按 ID 去重，主城市不进入备选 */
  const 城市片后端 = (项: BFFLocationItem, 键?: string) => {
    const 选中 = 已选引用.some((条) => 条.id === 项.id);
    const 是主城市 = 项.id === 主城市Id;
    const 不可点 = (选满 && !选中) || 是主城市;
    return (
      <button
        key={键 ?? 项.id}
        className={[
          样式.城片,
          选中 ? 样式.城片选中 : '',
          不可点 ? 样式.城片变灰 : '可点',
        ].join(' ')}
        onClick={() => 切换后端(项)}
        disabled={不可点}
      >
        {项.display_name}
      </button>
    );
  };

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底改白底
    <次级页外壳 白底>
      {/* 顶栏：规格要求左侧是 ✕（关闭）而不是 ‹（返回）。
          通用的 返回栏 把 ‹ 写死了，所以这里按它同一套内边距单独渲染一枚 ✕。 */}
      <div className={样式.顶栏}>
        <button className={`${样式.关闭键} 可点`} onClick={返回} aria-label="关闭">
          ✕
        </button>
      </div>

      {/* 大标题 + 右上 N/9（版式同 选工作城市 的标题行）*/}
      <div className={样式.标题行}>
        <h1 className={样式.大标题}>选择城市</h1>
        <span className={`${样式.计数} 等宽数字`}>
          {是后端 ? 已选引用.length : 已选.length}/{城市上限}
        </span>
      </div>
      <p className={样式.副标题}>添加多个城市，可以获得更多工作机会</p>

      <div className={样式.搜索条}>
        <放大镜图标 尺寸={15} 色="var(--最弱)" 线宽={2.2} />
        <input
          className={样式.搜索输入}
          placeholder="搜索城市名/拼音"
          value={词}
          onChange={(事件) => 设词(事件.target.value)}
        />
      </div>

      <div className={样式.列表包裹}>
        <div className={`${样式.列表区} 滚动区`} ref={列表容器}>
          {是后端 ? (
            /* ── Backend 分支：按需 查询Location，复用 选工作城市 的同一套钩子 ── */
            词.trim() === '' ? (
              <>
                {城市分组.map((组) => (
                  <div key={组.省}>
                    <button
                      className={`${样式.组标} ${样式.组标间距} 可点`}
                      onClick={() => 切换展开(组)}
                    >
                      {组.省}
                    </button>
                    {展开集合.has(组.省) ? (
                      <div className={样式.城网}>
                        {状态表[组.省]?.加载中 && 状态表[组.省]?.items.length === 0 ? (
                          <div className={样式.无结果}>加载中…</div>
                        ) : null}
                        {状态表[组.省]?.items.map((项) =>
                          城市片后端(项, `${组.省}-${项.id}`),
                        )}
                      </div>
                    ) : null}
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className={样式.城网}>
                  {搜索结果项.map((项) => 城市片后端(项))}
                </div>
                {/* review-r2 R2-M-1：搜索返回 nextCursor 时显示「加载更多」 */}
                {搜索下一页 !== null ? (
                  <button className="可点" onClick={搜索加载更多} disabled={搜索加载中} style={{ width: '100%', padding: '10px', color: 'var(--最弱)' }}>
                    {搜索加载中 ? '加载中…' : '加载更多'}
                  </button>
                ) : null}
                {搜索结果项.length === 0 && !搜索中 ? (
                  <div className={样式.无结果}>没有匹配的城市，换个词试试。</div>
                ) : null}
              </>
            )
          ) : (
            /* ── Mock 分支：保持原本地 热门城市 / A-Z 分节 不变 ── */
            搜索词 === '' ? (
              <>
                <div className={样式.组标}>当前/历史访问城市</div>
                <div className={样式.城行}>{当前历史访问城市.map((城) => 城市片(城))}</div>

                <div className={`${样式.组标} ${样式.组标间距}`}>热门城市</div>
                <div className={样式.城网}>{热门城市.map((城) => 城市片(城, `热门-${城}`))}</div>

                {/* A-Z 分节：每个字母一节，右侧索引条点了滚到这里 */}
                {城市按首字母.map((分组) => (
                  <div
                    key={分组.首字母}
                    ref={(节点) => {
                      分节节点.current[分组.首字母] = 节点;
                    }}
                  >
                    <div className={`${样式.组标} ${样式.组标间距}`}>{分组.首字母}</div>
                    <div className={样式.城网}>
                      {分组.城市.map((城) => 城市片(城, `${分组.首字母}-${城}`))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              // 搜索态：只出命中结果，分区和字母条一并收起，免得两套列表打架
              <>
                <div className={样式.城网}>{搜索结果.map((城) => 城市片(城))}</div>
                {搜索结果.length === 0 ? (
                  <div className={样式.无结果}>没有匹配的城市，换个词试试。</div>
                ) : null}
              </>
            )
          )}
        </div>

        {/* 字母索引条只在 Mock 分支无搜索词时渲染 */}
        {!是后端 && 搜索词 === '' ? (
          <div className={样式.字母条}>
            {城市按首字母.map((分组) => (
              <button
                key={分组.首字母}
                className={样式.字母键}
                onClick={() => 滚到分节(分组.首字母)}
                aria-label={`跳到 ${分组.首字母}`}
              >
                {分组.首字母}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* 底部已选 chips：点标签上的 ✕ 移除 */}
      {(是后端 ? 已选引用.length : 已选.length) > 0 ? (
        <div className={样式.已选条}>
          <span className={样式.已选标}>已选</span>
          <div className={样式.已选标签组}>
            {是后端
              ? 已选引用.map((条) => (
                  <button
                    key={条.id}
                    className={`${样式.已选标签} 可点`}
                    onClick={() => 切换后端(条)}
                    aria-label={`移除 ${条.display_name}`}
                  >
                    {条.display_name} ✕
                  </button>
                ))
              : 已选.map((城) => (
                  <button
                    key={城}
                    className={`${样式.已选标签} 可点`}
                    onClick={() => 切换(城)}
                    aria-label={`移除 ${城}`}
                  >
                    {城} ✕
                  </button>
                ))}
          </div>
        </div>
      ) : null}

      <主按钮 文字="保存" 按下={保存} />
    </次级页外壳>
  );
}