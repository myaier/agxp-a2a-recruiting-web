// 单列数字滚轮 + 手填（标注意见 2026-08-18：年薪月数不能是四个快捷片，
// 要能从 12 往上滚，或者用户自己填）。
//
// 快捷片的问题是把可选范围钉死在设计者猜的那几个值上：13–16 薪之外的岗位
// （12 薪、18 薪、24 薪）根本填不了。滚轮给连续范围，手填给范围之外的极端值，
// 两者合起来才是完整可用的输入。滚动手感与薪资轮 / 年月轮同源。

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
  /** 单位后缀，如「薪」。同时用于手填行的提示 */
  单位: string;
  /** 手填允许的上界（超过滚轮范围的极端值走这里） */
  手填上界?: number;
  确认: (值: number) => void;
  取消: () => void;
}

export default function 数字滚轮层({
  标题,
  初值,
  最小,
  最大,
  单位,
  手填上界 = 99,
  确认,
  取消,
}: 属性) {
  const 选项 = Array.from({ length: 最大 - 最小 + 1 }, (_, 序) => 最小 + 序);
  const [值, 设值] = useState(Math.min(Math.max(初值, 最小), 手填上界));
  // 手填草稿：输入过程允许临时非法（空串），失焦/回车时才夹紧
  const [草稿, 设草稿] = useState(String(初值));

  // 滚轮改了值要同步回输入框，否则两处显示打架
  useEffect(() => 设草稿(String(值)), [值]);

  const 提交手填 = () => {
    const 数 = Number.parseInt(草稿.replace(/[^0-9]/g, ''), 10);
    if (Number.isNaN(数)) {
      设草稿(String(值));
      return;
    }
    设值(Math.min(Math.max(数, 最小), 手填上界));
  };

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

        {/* 手填：滚轮范围之外的极端值（如 24 薪）从这里进 */}
        <div className={样式.手填行}>
          <span className={样式.手填标}>直接填</span>
          <input
            className={`${样式.手填框} 等宽数字`}
            value={草稿}
            onChange={(事件) => 设草稿(事件.target.value)}
            onBlur={提交手填}
            onKeyDown={(事件) => {
              if (事件.key === 'Enter') 事件.currentTarget.blur();
            }}
            inputMode="numeric"
            maxLength={2}
            aria-label={`${标题}手填`}
          />
          <span className={样式.手填单位}>{单位}</span>
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
