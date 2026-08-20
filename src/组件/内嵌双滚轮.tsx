// 页面内嵌的双列滚轮（2026-08-20 按 BOSS 截图顺序重排新增）。
// 创建在线简历的「出生年月」（年 1970–2010 / 月 1–12）与
// 就读时间段的「入学年 / 毕业年」（2000–2030）共用。
//
// 滚动手感与 引导问答 的薪资轮同源：scroll-snap-type: y mandatory 让浏览器
// 负责吸附，停下（90ms 无新事件）后算一次落点；中间一行有高亮底。
// 与 数字滚轮层 的区别：那是底部弹层，这里直接铺在页面卡片里（截图形态）。

import { useEffect, useRef } from 'react';
import 样式 from './内嵌双滚轮.module.css';

const 行高 = 46;

export default function 内嵌双滚轮({
  左档,
  右档,
  左值,
  右值,
  设左值,
  设右值,
  左名,
  右名,
  左单位 = '',
  右单位 = '',
}: {
  左档: number[];
  右档: number[];
  左值: number;
  右值: number;
  设左值: (值: number) => void;
  设右值: (值: number) => void;
  /** 无障碍名，如「出生年」/「出生月」 */
  左名: string;
  右名: string;
  /** 档位后缀，如「年」「月」 */
  左单位?: string;
  右单位?: string;
}) {
  return (
    <div className={样式.轮容器}>
      {/* 中间档高亮底：不接收点击 */}
      <div className={样式.轮高亮} />
      <单列 档表={左档} 值={左值} 设值={设左值} 名称={左名} 单位={左单位} />
      <单列 档表={右档} 值={右值} 设值={设右值} 名称={右名} 单位={右单位} />
    </div>
  );
}

function 单列({
  档表,
  值,
  设值,
  名称,
  单位,
}: {
  档表: number[];
  值: number;
  设值: (值: number) => void;
  名称: string;
  单位: string;
}) {
  const 轮引用 = useRef<HTMLDivElement>(null);
  const 防抖计时 = useRef(0);
  // 记住「本列自己滚出来的值」，区分外部改值与自身滚动，避免回滚打架
  const 自报值 = useRef(值);
  const 当前序 = 档表.indexOf(值);

  useEffect(() => {
    // scroll-snap 只管吸附、不管初始位置：挂载时手动把初值滚到正中间
    if (轮引用.current) 轮引用.current.scrollTop = Math.max(0, 当前序) * 行高;
    return () => window.clearTimeout(防抖计时.current);
    // 只在挂载时定位一次，之后由用户滑动主导
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (值 === 自报值.current) return; // 自己滚出来的，不再滚一次
    自报值.current = 值;
    if (当前序 >= 0 && 轮引用.current) 轮引用.current.scrollTop = 当前序 * 行高;
  }, [值, 当前序]);

  /** 滚动中连续触发，防抖到停下再算落点，避免每帧 setState */
  const 处理滚动 = () => {
    const 位置 = 轮引用.current?.scrollTop ?? 0;
    window.clearTimeout(防抖计时.current);
    防抖计时.current = window.setTimeout(() => {
      const 落点 = Math.min(Math.max(Math.round(位置 / 行高), 0), 档表.length - 1);
      自报值.current = 档表[落点];
      设值(档表[落点]);
    }, 90);
  };

  return (
    <div
      ref={轮引用}
      className={`${样式.滚轮} 滚动区`}
      onScroll={处理滚动}
      role="listbox"
      aria-label={名称}
    >
      {档表.map((档) => (
        <div key={档} className={样式.档} role="option" aria-selected={档 === 值}>
          <span className={`${档 === 值 ? 样式.档选中 : 样式.档未选} 等宽数字`}>
            {档}
            {单位 ? <span className={样式.单位}>{单位}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}
