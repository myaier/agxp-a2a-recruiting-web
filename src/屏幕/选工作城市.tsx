// 选工作城市（/onboard/city）—— 2026-08-20 按 BOSS 截图顺序重排：
// 完善资料屏的城市行点进来，替代旧的底部弹层，升级为全屏 + 多选（上限 10）。
//
// 版式：大标题「你理想的工作城市是」+ 右上 N/10 计数 → 搜索框 →
// 当前定位（上海）/ 热门城市 / 按省铺开 → 底部「已选」chips（点 ✕ 删）+ 保存键。
// 选好的城市落 全局.引导预填.城市们（职位原样带上），保存后返回完善资料屏回显。
//
// Task 3：Backend 分支按需 查询Location（省标题不进入 payload，只发 countryCode/admin1Code），
// 已选改为 目录选择值[]，ID 去重；搜索 250ms debounce。Mock 分支保持本地 城市字典 不变。

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import 样式 from './选工作城市.module.css';
import { 次级页外壳, 返回栏, 主按钮 } from '../组件/通用';
import { 放大镜图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 城市字典, 热门城市, 城市分组 } from '../数据/城市与行业';
import type { BFFLocationItem } from '../数据/BFF契约';
import { use城市搜索, use城市分组 } from './城市查询钩子';

/** 城市多选上限：与 BOSS 同档 */
const 城市上限 = 10;

export default function 选工作城市() {
  const { 返回 } = use导航();
  const { 状态: 全局, 派发, 数据源模式, 目录查询 } = use应用状态();
  const [查询参数] = useSearchParams();
  const 是后端 = 数据源模式 === 'backend';

  // 「添加求职期望」页的工作城市行点进来时带 ?来源=意向（规格：单选，写 意向草稿.工作城市）。
  // 不带这个参数就是注册引导的原路径 —— 那条路径的多选 + 写 引导预填 行为一个字都没动。
  const 来自意向 = 查询参数.get('来源') === '意向';

  // ── 已选 state ──
  // Backend：BFFLocationItem[]（完整项，含 id/display_name），ID 去重；Mock：string[]，字符串去重。
  // 保存时映射为 目录选择值（只取 id + display_name）。
  // 进页时取全局已选，保存前只改本地 —— 中途退出不写脏数据
  const [已选引用, 设已选引用] = useState<BFFLocationItem[]>(() => {
    if (!是后端) return [];
    if (来自意向) {
      const 引用 = 全局.意向草稿.工作城市引用;
      return 引用 ? [{ id: 引用.id, display_name: 引用.display_name } as BFFLocationItem] : [];
    }
    const 引用们 = 全局.引导预填?.城市引用们 ?? [];
    return 引用们.map((条) => ({ id: 条.id, display_name: 条.display_name } as BFFLocationItem));
  });
  const [已选名, 设已选名] = useState<string[]>(() => {
    if (是后端) return 已选引用.map((条) => 条.display_name);
    if (来自意向)
      return 全局.意向草稿.工作城市 === '' ? [] : [全局.意向草稿.工作城市];
    return 全局.引导预填?.城市们 ?? ['上海'];
  });

  // ── 搜索 / 分组查询（Backend 分支）──
  const { 词, 设词, 结果: 搜索结果项, 搜索中 } = use城市搜索(
    是后端 ? 目录查询?.查询Location : undefined,
  );
  const { 状态表, 展开集合, 切换展开 } = use城市分组(
    是后端 ? 目录查询?.查询Location : undefined,
  );

  const 已选数 = 是后端 ? 已选引用.length : 已选名.length;

  const 切换后端 = (项: BFFLocationItem) => {
    设已选引用((旧) => {
      // 意向来源是单选：点新的直接取代旧的，点自己则取消。
      if (来自意向) return 旧.some((条) => 条.id === 项.id) ? [] : [项];
      if (旧.some((条) => 条.id === 项.id))
        return 旧.filter((条) => 条.id !== 项.id);
      if (旧.length >= 城市上限) {
        轻提示(`最多选 ${城市上限} 个`);
        return 旧;
      }
      return [...旧, 项];
    });
  };

  // Mock 分支切换（保持原逻辑不变）
  const 切换 = (城: string) => {
    设已选名((旧) => {
      if (来自意向) return 旧.includes(城) ? [] : [城];
      if (旧.includes(城)) return 旧.filter((条) => 条 !== 城);
      if (旧.length >= 城市上限) {
        轻提示(`最多选 ${城市上限} 个`);
        return 旧;
      }
      return [...旧, 城];
    });
  };

  const 保存 = () => {
    if (来自意向) {
      if (是后端) {
        const 选 = 已选引用[0];
        派发({
          型: '改意向草稿',
          补丁: {
            工作城市: 选?.display_name ?? '',
            工作城市引用: 选 ? { id: 选.id, display_name: 选.display_name } : undefined,
          },
        });
      } else {
        派发({ 型: '改意向草稿', 补丁: { 工作城市: 已选名[0] ?? '' } });
      }
      返回();
      return;
    }
    if (是后端) {
      派发({
        型: '存引导预填',
        城市们: 已选引用.map((条) => 条.display_name),
        职位: 全局.引导预填?.职位 ?? [],
        城市引用们: 已选引用.map((条) => ({ id: 条.id, display_name: 条.display_name })),
        // 本屏不选职位，保留原职位引用们（Task 4 R10：替换语义，原值带过）
        职位引用们: 全局.引导预填?.职位引用们 ?? [],
      });
    } else {
      派发({
        型: '存引导预填',
        城市们: 已选名,
        职位: 全局.引导预填?.职位 ?? [],
        // 没有 refs 时显式写空数组，禁止保留旧 refs
        城市引用们: [],
        职位引用们: [],
      });
    }
    返回();
  };

  // 省名也算命中：输「浙」出浙江全省（Mock 分支本地过滤）
  const 搜索词 = 词.trim();
  const 搜索结果 =
    搜索词 === ''
      ? []
      : 城市字典.flatMap((组) =>
          组.省.includes(搜索词) ? 组.城市 : 组.城市.filter((城) => 城.includes(搜索词)),
        );

  // Backend 城市片：按 ID 去重
  const 城市键后端 = (项: BFFLocationItem, 键?: string) => (
    <button
      key={键 ?? 项.id}
      className={`${样式.城片} ${已选引用.some((条) => 条.id === 项.id) ? 样式.城片选中 : ''} 可点`}
      onClick={() => 切换后端(项)}
    >
      {项.display_name}
    </button>
  );

  // Mock 城市片（保持原逻辑不变）
  const 城市键 = (城: string, 键?: string) => (
    <button
      key={键 ?? 城}
      className={`${样式.城片} ${已选名.includes(城) ? 样式.城片选中 : ''} 可点`}
      onClick={() => 切换(城)}
    >
      {/* 2026-08-24 全站选择风格统一（C1 定稿）：✓ 改由 CSS ::before 前置渲染，去掉文字尾缀避免双勾 */}
      {城}
    </button>
  );

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底改白底
    <次级页外壳 白底>
      <返回栏 返回={返回} />

      {/* 大标题 + 右上 N/10 计数。意向来源是单选，没有 N/10 这回事，计数整枚不渲染 ——
          留着会显示「1/10」，把一个单选说成还能再选九个 */}
      <div className={样式.标题行}>
        <h1 className={样式.大标题}>你理想的工作城市是</h1>
        {来自意向 ? null : (
          <span className={`${样式.计数} 等宽数字`}>
            {已选数}/{城市上限}
          </span>
        )}
      </div>

      <div className={样式.搜索条}>
        <放大镜图标 尺寸={15} 色="var(--最弱)" 线宽={2.2} />
        <input
          className={样式.搜索输入}
          placeholder="搜索城市 / 省份"
          value={词}
          onChange={(事件) => 设词(事件.target.value)}
        />
      </div>

      <div className={`${样式.列表区} 滚动区`}>
        {是后端 ? (
          /* ── Backend 分支：按需 查询Location，省标题不进入 payload ── */
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
                      {状态表[组.省]?.items.map((项) => 城市键后端(项, `${组.省}-${项.id}`))}
                    </div>
                  ) : null}
                </div>
              ))}
            </>
          ) : (
            <>
              <div className={样式.组标}>搜 索 结 果</div>
              <div className={样式.城网}>
                {搜索结果项.map((项) => 城市键后端(项))}
              </div>
              {搜索结果项.length === 0 && !搜索中 ? (
                <div className={样式.无结果}>没有匹配的城市，换个词试试。</div>
              ) : null}
            </>
          )
        ) : (
          /* ── Mock 分支：保持原本地城市字典逻辑不变 ── */
          词.trim() === '' ? (
            <>
              <div className={样式.组标}>当 前 定 位</div>
              <div className={样式.城网}>{城市键('上海')}</div>

              <div className={`${样式.组标} ${样式.组标间距}`}>热 门 城 市</div>
              <div className={样式.城网}>{热门城市.map((城) => 城市键(城))}</div>

              {/* 按省份铺开：一省一组，省名当分组标 */}
              {城市字典.map((组) => (
                <div key={组.省}>
                  <div className={`${样式.组标} ${样式.组标间距}`}>{组.省}</div>
                  <div className={样式.城网}>
                    {组.城市.map((城) => 城市键(城, `${组.省}-${城}`))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className={样式.组标}>搜 索 结 果</div>
              <div className={样式.城网}>{搜索结果.map((城) => 城市键(城))}</div>
              {搜索结果.length === 0 ? (
                <div className={样式.无结果}>没有匹配的城市，换个词试试。</div>
              ) : null}
            </>
          )
        )}
      </div>

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
              : 已选名.map((城) => (
                  <button
                    key={城}
                    className={`${样式.已选标签} 可点`}
                    onClick={() => 切换(城)}
                  >
                    {城} ✕
                  </button>
                ))}
          </div>
        </div>
      ) : null}

      <主按钮 文字="保存" 按下={保存} 禁用={已选数 === 0} />
    </次级页外壳>
  );
}