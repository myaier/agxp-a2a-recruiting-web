// 选择城市（/intentions/cities）—— 「添加求职期望」的次级页 A，多选 0/9。
//
// 版式照规格截图 3 自上而下：
//   ✕ 关闭 → 大标题「选择城市」+ 右上 N/9 → 副标题 → 搜索框 →
//   当前/历史访问城市 → 热门城市 → A-Z 分节（右侧字母索引条）→ 底部已选 chips + 保存。
//
// 与 选工作城市（/onboard/city，单选工作城市）的分工：那屏选**一个**主工作城市，
// 这屏选**另外**最多 9 个感兴趣城市，落 意向草稿.感兴趣城市们，互不覆盖。

import { useMemo, useRef, useState } from 'react';
import 样式 from './选择城市.module.css';
import { 次级页外壳, 主按钮 } from '../组件/通用';
import { 放大镜图标 } from '../组件/图标';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 热门城市 } from '../数据/城市与行业';
import { 城市按首字母, 城市拼音, 全部城市 } from '../数据/城市首字母';

/** 感兴趣城市多选上限（规格：其他感兴趣城市（N/9））*/
const 城市上限 = 9;

/** 当前/历史访问城市：原型没有定位与浏览历史，固定上海 ——
 *  和 选工作城市 的「当前定位」保持同一个值，两屏别互相打脸。 */
const 当前历史访问城市 = ['上海'];

export default function 选择城市() {
  const { 返回 } = use导航();
  const { 状态: 全局, 派发 } = use应用状态();

  // 进页时取草稿里已有的选择；改动先落本地，点保存才写回 —— 中途 ✕ 退出不留脏数据
  const [已选, 设已选] = useState<string[]>(() => 全局.意向草稿.感兴趣城市们);
  const [关键词, 设关键词] = useState('');

  const 选满 = 已选.length >= 城市上限;

  const 切换 = (城: string) => {
    设已选((旧) => {
      if (旧.includes(城)) return 旧.filter((条) => 条 !== 城);
      // 选满后未选中的城片已经 disabled，这里是兜底：宁可什么都不发生，也不越过上限
      if (旧.length >= 城市上限) return 旧;
      return [...旧, 城];
    });
  };

  const 保存 = () => {
    派发({ 型: '改意向草稿', 补丁: { 感兴趣城市们: 已选 } });
    返回();
  };

  // 中文名和全拼都算命中：输「杭」「hangzhou」「hang」都出杭州
  const 词 = 关键词.trim().toLowerCase();
  const 搜索结果 = useMemo(
    () =>
      词 === ''
        ? []
        : 全部城市.filter((城) => 城.includes(词) || (城市拼音[城] ?? '').includes(词)),
    [词]
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
          {已选.length}/{城市上限}
        </span>
      </div>
      <p className={样式.副标题}>添加多个城市，可以获得更多工作机会</p>

      <div className={样式.搜索条}>
        <放大镜图标 尺寸={15} 色="var(--最弱)" 线宽={2.2} />
        <input
          className={样式.搜索输入}
          placeholder="搜索城市名/拼音"
          value={关键词}
          onChange={(事件) => 设关键词(事件.target.value)}
        />
      </div>

      <div className={样式.列表包裹}>
        <div className={`${样式.列表区} 滚动区`} ref={列表容器}>
          {词 === '' ? (
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
          )}
        </div>

        {词 === '' ? (
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
      {已选.length > 0 ? (
        <div className={样式.已选条}>
          <span className={样式.已选标}>已选</span>
          <div className={样式.已选标签组}>
            {已选.map((城) => (
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
