// 单列数字滚轮（标注 2026-08-18：年薪月数从 12 往上滚；同日「直接填」手填行
// 按标注删除 —— 滚轮范围放宽到 12-36，极端值也在轮内，不再需要手填）。
// 滚动手感与薪资轮 / 年月轮同源。

import { useEffect, useRef, useState } from 'react';
import 样式 from './数字滚轮层.module.css';

const 行高 = 40;

interface 属性 {
  标题: string;
  /** 当前值（纯数字，不带单位） */
  初值: number;
  /** 滚轮的连续范围，闭区间 */
  最小: number;
  最大: number;
  /** 单位后缀，如「薪」 */
  单位: string;
  确认: (值: number) => void;
  取消: () => void;
}

export default function 数字滚轮层({ 标题, 初值, 最小, 最大, 单位, 确认, 取消 }: 属性) {
  const 选项 = Array.from({ length: 最大 - 最小 + 1 }, (_, 序) => 最小 + 序);
  const [值, 设值] = useState(Math.min(Math.max(初值, 最小), 最大));

  return (
    <div className={样式.遮罩} onClick={取消}>
      <div className={样式.层} onClick={(事件) => 事件.stopPropagation()}>
        <div className={样式.顶栏}>
          <button className={`${样式.取消键} 可点`} onClick={取消}>
            取消
          </button>
          <span className={样式.标题}>{标题}</span>
          <button className={`${样式.确认键} 可点`} onClick={() => 确认(值)}>
            完成
          </button>
        </div>

        <div className={样式.轮区}>
          <div className={样式.高亮带} />
          <滚轮列 选项={选项} 值={值} 设值={设值} 单位={单位} 名称={标题} />
        </div>
      </div>
    </div>
  );
}

/** 一列滚轮。上下各垫两行内边距，首尾档也能滚到正中间 */
function 滚轮列({
  选项,
  值,
  设值,
  单位,
  名称,
}: {
  选项: number[];
  值: number;
  设值: (值: number) => void;
  单位: string;
  名称: string;
}) {
  const 引用 = useRef<HTMLDivElement>(null);
  const 防抖 = useRef(0);
  // 记住本列自己滚出来的值，区分外部改值（手填）与自身滚动，避免互相回弹
  const 自报值 = useRef(值);
  const 当前序 = 选项.indexOf(值);

  useEffect(() => {
    if (引用.current) 引用.current.scrollTop = Math.max(0, 当前序) * 行高;
    return () => window.clearTimeout(防抖.current);
    // 挂载定位一次，之后交给用户滑动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (值 === 自报值.current) return;
    自报值.current = 值;
    // 手填了范围之外的数时 当前序 为 -1，滚轮保持原位，由手填框显示
    if (当前序 >= 0 && 引用.current) 引用.current.scrollTop = 当前序 * 行高;
  }, [值, 当前序]);

  /** 滚动中连续触发，防抖到停下（90ms 无新事件）再取落点 */
  const 处理滚动 = () => {
    const 位置 = 引用.current?.scrollTop ?? 0;
    window.clearTimeout(防抖.current);
    防抖.current = window.setTimeout(() => {
      const 落点 = Math.min(Math.max(Math.round(位置 / 行高), 0), 选项.length - 1);
      自报值.current = 选项[落点];
      设值(选项[落点]);
    }, 90);
  };

  return (
    <div
      ref={引用}
      className={`${样式.列} 滚动区`}
      onScroll={处理滚动}
      role="listbox"
      aria-label={名称}
    >
      {选项.map((项) => (
        <div key={项} className={样式.档} role="option" aria-selected={项 === 值}>
          <span className={`${项 === 值 ? 样式.档选中 : 样式.档未选} 等宽数字`}>
            {项}
            <span className={样式.单位}>{单位}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
