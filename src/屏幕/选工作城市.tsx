// 选工作城市（/onboard/city）—— 2026-08-20 按 BOSS 截图顺序重排：
// 完善资料屏的城市行点进来，替代旧的底部弹层，升级为全屏 + 多选（上限 10）。
//
// 版式：大标题「你理想的工作城市是」+ 右上 N/10 计数 → 搜索框 →
// 当前定位（上海）/ 热门城市 / 按省铺开 → 底部「已选」chips（点 ✕ 删）+ 保存键。
// 选好的城市落 全局.引导预填.城市们（职位原样带上），保存后返回完善资料屏回显。

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import 样式 from './选工作城市.module.css';
import { 次级页外壳, 返回栏, 主按钮 } from '../组件/通用';
import { 放大镜图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 城市字典, 热门城市 } from '../数据/城市与行业';

/** 城市多选上限：与 BOSS 同档 */
const 城市上限 = 10;

export default function 选工作城市() {
  const { 返回 } = use导航();
  const { 状态: 全局, 派发 } = use应用状态();
  const [查询参数] = useSearchParams();

  // 「添加求职期望」页的工作城市行点进来时带 ?来源=意向（规格：单选，写 意向草稿.工作城市）。
  // 不带这个参数就是注册引导的原路径 —— 那条路径的多选 + 写 引导预填 行为一个字都没动。
  const 来自意向 = 查询参数.get('来源') === '意向';

  // 进页时取全局已选，保存前只改本地 —— 中途退出不写脏数据
  const [已选, 设已选] = useState<string[]>(() =>
    来自意向
      ? 全局.意向草稿.工作城市 === ''
        ? []
        : [全局.意向草稿.工作城市]
      : 全局.引导预填?.城市们 ?? ['上海']
  );
  const [关键词, 设关键词] = useState('');

  const 切换 = (城: string) => {
    设已选((旧) => {
      // 意向来源是单选：点新的直接取代旧的，点自己则取消（底部已选 chip 的 ✕ 也走这一支）。
      // 单选没有上限概念，所以走不到下面那句「最多选 N 个」的提示。
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
      派发({ 型: '改意向草稿', 补丁: { 工作城市: 已选[0] ?? '' } });
      返回();
      return;
    }
    派发({ 型: '存引导预填', 城市们: 已选, 职位: 全局.引导预填?.职位 ?? [] });
    返回();
  };

  // 省名也算命中：输「浙」出浙江全省
  const 词 = 关键词.trim();
  const 搜索结果 =
    词 === ''
      ? []
      : 城市字典.flatMap((组) =>
          组.省.includes(词) ? 组.城市 : 组.城市.filter((城) => 城.includes(词))
        );

  const 城市键 = (城: string, 键?: string) => (
    <button
      key={键 ?? 城}
      className={`${样式.城片} ${已选.includes(城) ? 样式.城片选中 : ''} 可点`}
      onClick={() => 切换(城)}
    >
      {已选.includes(城) ? `${城} ✓` : 城}
    </button>
  );

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      {/* 大标题 + 右上 N/10 计数。意向来源是单选，没有 N/10 这回事，计数整枚不渲染 ——
          留着会显示「1/10」，把一个单选说成还能再选九个 */}
      <div className={样式.标题行}>
        <h1 className={样式.大标题}>你理想的工作城市是</h1>
        {来自意向 ? null : (
          <span className={`${样式.计数} 等宽数字`}>
            {已选.length}/{城市上限}
          </span>
        )}
      </div>

      <div className={样式.搜索条}>
        <放大镜图标 尺寸={15} 色="var(--最弱)" 线宽={2.2} />
        <input
          className={样式.搜索输入}
          placeholder="搜索城市 / 省份"
          value={关键词}
          onChange={(事件) => 设关键词(事件.target.value)}
        />
      </div>

      <div className={`${样式.列表区} 滚动区`}>
        {词 === '' ? (
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
        )}
      </div>

      {/* 底部已选 chips：点标签 ✕ 删除 */}
      {已选.length > 0 ? (
        <div className={样式.已选条}>
          <span className={样式.已选标}>已选</span>
          <div className={样式.已选标签组}>
            {已选.map((城) => (
              <button key={城} className={`${样式.已选标签} 可点`} onClick={() => 切换(城)}>
                {城} ✕
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <主按钮 文字="保存" 按下={保存} 禁用={已选.length === 0} />
    </次级页外壳>
  );
}
