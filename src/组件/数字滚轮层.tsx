// 单列数字滚轮（标注 2026-08-18：年薪月数从 12 往上滚；同日「直接填」手填行
// 按标注删除 —— 滚轮范围放宽到 12-36，极端值也在轮内，不再需要手填）。
// 滚动手感与薪资轮 / 年月轮同源。

import { useEffect, useRef, useState } from 'react';
import 样式 from './数字滚轮层.module.css';
import 弹层框架 from './弹层框架';

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
  /** 相邻两档的间隔，默认 1。日薪/时薪用 10 —— 标注 2026-08-22：
   *  「这个根据一次 10 块来加，而不是现在的 1 块」。
   *  50→800 按 1 递增是 751 档，滚到目标价要划半天，而薪资本来就不需要精确到个位。 */
  步长?: number;
  确认: (值: number) => void;
  取消: () => void;
}

export default function 数字滚轮层({ 标题, 初值, 最小, 最大, 单位, 步长 = 1, 确认, 取消 }: 属性) {
  const 选项 = Array.from(
    { length: Math.floor((最大 - 最小) / 步长) + 1 },
    (_, 序) => 最小 + 序 * 步长,
  );
  // 初值可能不在档上（老数据、或步长改过之后）：夹进范围后再吸附到最近的档，
  // 否则 档表.indexOf(值) 返回 -1，滚轮定位不到、停在第一档而显示值是另一个数。
  const 吸附 = (原: number) => {
    const 夹后 = Math.min(Math.max(原, 最小), 最大);
    return 最小 + Math.round((夹后 - 最小) / 步长) * 步长;
  };
  const [值, 设值] = useState(() => 吸附(初值));

  return (
    <弹层框架 标签={标题} 遮罩类名={样式.遮罩} 面板类名={样式.层} 关闭={取消} 层级={71}>
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
    </弹层框架>
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
    <div className={样式.列包}>
      <div
        ref={引用}
        className={`${样式.列} 滚动区`}
        onScroll={处理滚动}
        role="listbox"
        aria-label={名称}
      >
        {选项.map((项) => (
          <div key={项} className={样式.档} role="option" aria-selected={项 === 值}>
            {/* 档里只留数字。标注 2026-08-22：「不用每个滚轮数字后面都带有年和月」*/}
            <span className={`${项 === 值 ? 样式.档选中 : 样式.档未选} 等宽数字`}>{项}</span>
          </div>
        ))}
      </div>
      {/* 单位钉在滚动区外、垂直居中正对高亮带，滚动时不动 */}
      <span className={样式.固定单位}>{单位}</span>
    </div>
  );
}
