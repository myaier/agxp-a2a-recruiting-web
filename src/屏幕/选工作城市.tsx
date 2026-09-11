// 选工作城市（/onboard/city）—— 2026-08-20 按 BOSS 截图顺序重排：
// 完善资料屏的城市行点进来，替代旧的底部弹层，升级为全屏 + 多选（上限 10）。
//
// 版式：大标题「你理想的工作城市是」+ 右上 N/10 计数 → 搜索框 →
// 当前定位 / 热门城市 / 按省铺开 → 底部「已选」chips（点 ✕ 删）+ 保存键。
// 选好的城市落 全局.引导预填.城市们（职位原样带上），保存后返回完善资料屏回显。
//
// Task 3：Backend 分支按需 查询Location，已选改为 目录选择值[]，ID 去重；搜索 250ms debounce。
// Task 5：删掉 Backend 专属的省份折叠布局，两模式共用上面这一套 Mock JSX ——
// Backend 的当前定位是已批准的「暂未获取定位」缺失态（不假选上海），热门区是不带 q 的
// 默认目录页，分组标题只用返回的行政区/国家字段（未知的不编造省份、不造「其他地区」），
// 继续加载只挂在既有 列表区 滚动容器的滚动事件上，不新增「加载更多」节点。

import { useState, type UIEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import 样式 from './选工作城市.module.css';
import { 次级页外壳, 返回栏, 主按钮 } from '../组件/通用';
import { 放大镜图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 城市字典, 热门城市 } from '../数据/城市与行业';
import type { BFFLocationItem } from '../数据/BFF契约';
import { use城市搜索, use城市默认页, 按行政区分组 } from './城市查询钩子';

/** 城市多选上限：与 BOSS 同档 */
const 城市上限 = 10;
/** 距底多少像素算「滚到底」——只用来判定，不改任何布局 */
const 到底余量 = 64;

/** 城市片的展示输入：两模式给同样的输入就有同样的 DOM */
interface 城市片 {
  键: string;
  文字: string;
  选中: boolean;
  禁用?: boolean;
  按下: () => void;
}

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

  // ── 搜索 / 默认目录页查询（Backend 分支）──
  const { 词, 设词, 结果: 搜索结果项, 搜索中, 加载更多: 搜索加载更多 } = use城市搜索(
    是后端 ? 目录查询?.查询Location : undefined,
  );
  // Task 5：不带 q 的默认目录页 —— 首页进热门区，全部已加载项按返回字段分行政区
  const { 热门项们, 项们: 默认项们, 加载更多: 默认加载更多 } = use城市默认页(
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

  // ── 两模式的展示输入（下面只有一套 JSX）──
  const 后端片 = (项: BFFLocationItem, 键?: string): 城市片 => ({
    键: 键 ?? 项.id,
    文字: 项.display_name,
    选中: 已选引用.some((条) => 条.id === 项.id),
    按下: () => 切换后端(项),
  });
  const Mock片 = (城: string, 键?: string): 城市片 => ({
    键: 键 ?? 城,
    文字: 城,
    选中: 已选名.includes(城),
    按下: () => 切换(城),
  });

  // 当前定位：Backend 用已批准的缺失态，不假选上海
  const 定位片: 城市片 = 是后端
    ? { 键: '当前定位', 文字: '暂未获取定位', 选中: false, 禁用: true, 按下: () => {} }
    : Mock片('上海');
  const 热门片们: 城市片[] = 是后端
    ? 热门项们.map((项) => 后端片(项, `热门-${项.id}`))
    : 热门城市.map((城) => Mock片(城));
  const 分组们: { 键: string; 标题: string; 片们: 城市片[] }[] = 是后端
    ? 按行政区分组(默认项们).map((组) => ({
        键: 组.键,
        标题: 组.键,
        片们: 组.城市们.map((项) => 后端片(项, `${组.键}-${项.id}`)),
      }))
    : 城市字典.map((组) => ({
        键: 组.省,
        标题: 组.省,
        片们: 组.城市.map((城) => Mock片(城, `${组.省}-${城}`)),
      }));
  const 搜索片们: 城市片[] = 是后端
    ? 搜索结果项.map((项) => 后端片(项))
    : 搜索结果.map((城) => Mock片(城));
  const 已选片们: { 键: string; 文字: string; 按下: () => void }[] = 是后端
    ? 已选引用.map((条) => ({ 键: 条.id, 文字: 条.display_name, 按下: () => 切换后端(条) }))
    : 已选名.map((城) => ({ 键: 城, 文字: 城, 按下: () => 切换(城) }));

  // Task 5：继续加载只挂在既有滚动容器上 —— 游标归各自的查询（搜索态翻搜索页，默认态翻默认页）
  const 滚动加载 = (事件: UIEvent<HTMLDivElement>) => {
    if (!是后端) return;
    const 元素 = 事件.currentTarget;
    if (元素.scrollTop + 元素.clientHeight < 元素.scrollHeight - 到底余量) return;
    void (搜索词 === '' ? 默认加载更多() : 搜索加载更多());
  };

  const 城市键 = (片: 城市片) => (
    <button
      key={片.键}
      className={`${样式.城片} ${片.选中 ? 样式.城片选中 : ''} 可点`}
      onClick={片.按下}
      disabled={片.禁用}
    >
      {/* 2026-08-24 全站选择风格统一（C1 定稿）：✓ 改由 CSS ::before 前置渲染，去掉文字尾缀避免双勾 */}
      {片.文字}
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

      <div className={`${样式.列表区} 滚动区`} onScroll={滚动加载}>
        {搜索词 === '' ? (
          <>
            <div className={样式.组标}>当 前 定 位</div>
            <div className={样式.城网}>{城市键(定位片)}</div>

            <div className={`${样式.组标} ${样式.组标间距}`}>热 门 城 市</div>
            <div className={样式.城网}>{热门片们.map(城市键)}</div>

            {/* 按省份铺开：一省一组，省名当分组标 */}
            {分组们.map((组) => (
              <div key={组.键}>
                <div className={`${样式.组标} ${样式.组标间距}`}>{组.标题}</div>
                <div className={样式.城网}>{组.片们.map(城市键)}</div>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className={样式.组标}>搜 索 结 果</div>
            <div className={样式.城网}>{搜索片们.map(城市键)}</div>
            {搜索片们.length === 0 && !搜索中 ? (
              <div className={样式.无结果}>没有匹配的城市，换个词试试。</div>
            ) : null}
          </>
        )}
      </div>

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
