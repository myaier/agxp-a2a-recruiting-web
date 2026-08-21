// 年月滚轮选择层（标注意见 2026-08-18：在职时间做成滑动的滚轮）。
//
// 原来用 <input type="month">：iOS 上确实弹原生滚轮，但桌面是日历下拉、
// Android 各家实现不一，同一个原型在三个地方长得不一样，评审时对不上。
// 这里自绘一套，滚动手感与 A3c 薪资轮同源（scroll-snap 吸附 + 停下再取值）。
//
// 边界由 最小 / 最大 收口：入职不能选到未来，离职不能早于入职。
// 年份切换后若当前月越界（如最大是 2026-08，年切到 2026 时 9-12 月要消失），
// 月列表会跟着收缩并把选中值夹回范围内。

import { useEffect, useRef, useState } from 'react';
import 样式 from './年月滚轮层.module.css';
import 弹层框架 from './弹层框架';

const 行高 = 40;

interface 属性 {
  标题: string;
  /** 'yyyy-MM'，空串表示还没选过，默认落在最大值那一档 */
  初值: string;
  /** 'yyyy-MM'，可选下界 */
  最小?: string;
  /** 'yyyy-MM'，可选上界 */
  最大?: string;
  确认: (值: string) => void;
  取消: () => void;
}

/** 'yyyy-MM' → [年, 月]，非法输入返回 null */
function 拆(值: string): [number, number] | null {
  const 命中 = /^(\d{4})-(\d{2})$/.exec(值);
  if (!命中) return null;
  return [Number(命中[1]), Number(命中[2])];
}

const 拼 = (年: number, 月: number) => `${年}-${String(月).padStart(2, '0')}`;

export default function 年月滚轮层({ 标题, 初值, 最小, 最大, 确认, 取消 }: 属性) {
  const 下界 = 最小 ? 拆(最小) : null;
  const 上界 = 最大 ? 拆(最大) : null;
  const 今年 = new Date().getFullYear();

  const 起年 = 下界?.[0] ?? 1980;
  const 止年 = 上界?.[0] ?? 今年;
  const 年列表 = Array.from({ length: Math.max(1, 止年 - 起年 + 1) }, (_, 序) => 起年 + 序);

  // 没有初值时落在上界（多数场景是「现在」），比落在 1980 少滚几十下
  const 初 = 拆(初值) ?? 上界 ?? [今年, new Date().getMonth() + 1];
  const [年, 设年] = useState(Math.min(Math.max(初[0], 起年), 止年));
  const [月, 设月] = useState(初[1]);

  // 当前年份下允许的月：贴着下界那年从下界月起，贴着上界那年到上界月止
  const 月起 = 下界 && 年 === 下界[0] ? 下界[1] : 1;
  const 月止 = 上界 && 年 === 上界[0] ? 上界[1] : 12;
  const 月列表 = Array.from({ length: Math.max(1, 月止 - 月起 + 1) }, (_, 序) => 月起 + 序);

  // 年一变，月可能越界（如上界 2026-08，从 2025 切到 2026 时 9 月非法）
  useEffect(() => {
    if (月 < 月起) 设月(月起);
    else if (月 > 月止) 设月(月止);
  }, [月, 月起, 月止]);

  return (
    <弹层框架 标签={标题} 遮罩类名={样式.遮罩} 面板类名={样式.层} 关闭={取消} 层级={71}>
        <div className={样式.顶栏}>
          <button className={`${样式.取消键} 可点`} onClick={取消}>
            取消
          </button>
          <span className={样式.标题}>{标题}</span>
          <button className={`${样式.确认键} 可点`} onClick={() => 确认(拼(年, 月))}>
            完成
          </button>
        </div>

        <div className={样式.轮区}>
          {/* 中间那一档的高亮底，不接收点击 */}
          <div className={样式.高亮带} />
          <滚轮列 选项={年列表} 值={年} 设值={设年} 单位="年" 名称="年份" />
          <滚轮列 选项={月列表} 值={月} 设值={设月} 单位="月" 名称="月份" />
        </div>
    </弹层框架>
  );
}

/** 一列滚轮。上下各垫两行的内边距，首尾档也能滚到正中间 */
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
  // 记住本列自己滚出来的值，区分外部改值和自身滚动，避免两边互相回弹
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
