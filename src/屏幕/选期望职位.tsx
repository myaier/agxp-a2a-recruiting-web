// 选期望职位（/onboard/job）—— 2026-08-20 按 BOSS 截图顺序重排：
// 完善资料屏的职位行点进来，替代旧的底部弹层，升级为全屏 + 多选（上限 10）。
//
// 版式：大标题「期望职位是」+ 右上 N/10 计数 → 搜索框（搜 职业分类表 的小类）→
// 左大类栏 + 右小类多选卡 → 底部「已选」chips（点 ✕ 删）+ 保存键。
// 选好的职位落 全局.引导预填.职位（城市们原样带上），保存后返回完善资料屏回显。

import { useState } from 'react';
import 样式 from './选期望职位.module.css';
import { 次级页外壳, 返回栏, 主按钮 } from '../组件/通用';
import { 放大镜图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 职业分类表 } from '../数据/职业分类';

/** 期望职位上限：与 BOSS 同档（与 学生分流 的快捷片共用同一档）*/
const 职位上限 = 10;

export default function 选期望职位() {
  const { 返回 } = use导航();
  const { 状态: 全局, 派发 } = use应用状态();

  // 进页时取全局已选，保存前只改本地 —— 中途退出不写脏数据
  const [已选, 设已选] = useState<string[]>(全局.引导预填?.职位 ?? []);
  const [当前大类, 设当前大类] = useState(职业分类表[0].大类);
  const [关键词, 设关键词] = useState('');

  const 切换 = (名: string) => {
    设已选((旧) => {
      if (旧.includes(名)) return 旧.filter((条) => 条 !== 名);
      if (旧.length >= 职位上限) {
        轻提示(`最多选 ${职位上限} 个`);
        return 旧;
      }
      return [...旧, 名];
    });
  };

  const 保存 = () => {
    派发({ 型: '存引导预填', 城市们: 全局.引导预填?.城市们 ?? ['上海'], 职位: 已选 });
    返回();
  };

  const 词 = 关键词.trim();
  // 搜索直接跨全部大类匹配小类名，命中即平铺展示
  const 搜索结果 =
    词 === '' ? [] : 职业分类表.flatMap((组) => 组.小类.filter((名) => 名.includes(词)));

  const 小类列表 = 职业分类表.find((组) => 组.大类 === 当前大类)?.小类 ?? [];

  const 小类卡 = (名: string) => (
    <button
      key={名}
      className={`${样式.职小类} ${已选.includes(名) ? 样式.职小类选中 : ''} 可点`}
      onClick={() => 切换(名)}
    >
      {已选.includes(名) ? `${名} ✓` : 名}
    </button>
  );

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      {/* 大标题 + 右上 N/10 计数 */}
      <div className={样式.标题行}>
        <h1 className={样式.大标题}>期望职位是</h1>
        <span className={`${样式.计数} 等宽数字`}>
          {已选.length}/{职位上限}
        </span>
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
          <div className={`${样式.职左栏} 滚动区`}>
            {职业分类表.map((组) => (
              <button
                key={组.大类}
                className={`${样式.职大类} ${组.大类 === 当前大类 ? 样式.职大类当前 : ''} 可点`}
                onClick={() => 设当前大类(组.大类)}
              >
                {组.大类}
              </button>
            ))}
          </div>
          <div className={`${样式.职右栏} 滚动区`}>{小类列表.map(小类卡)}</div>
        </div>
      ) : (
        <div className={`${样式.搜索结果区} 滚动区`}>
          {搜索结果.map(小类卡)}
          {搜索结果.length === 0 ? (
            <div className={样式.无结果}>没有匹配的职位，换个词试试。</div>
          ) : null}
        </div>
      )}

      {/* 底部已选 chips：点标签 ✕ 删除 */}
      {已选.length > 0 ? (
        <div className={样式.已选条}>
          <span className={样式.已选标}>已选</span>
          <div className={样式.已选标签组}>
            {已选.map((名) => (
              <button key={名} className={`${样式.已选标签} 可点`} onClick={() => 切换(名)}>
                {名} ✕
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <主按钮 文字="保存" 按下={保存} 禁用={已选.length === 0} />
    </次级页外壳>
  );
}
