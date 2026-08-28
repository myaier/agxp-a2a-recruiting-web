// 下拉刷新（2026-08-19 用户：主页下滑要能刷新）。
//
// 两端主页共用：把列表包进来即可 —— 列表贴顶时向下拽出刷新槽，
// 松手到位转圈再收回。Pointer 事件，鼠标与触屏都能拖。
//
// P4：刷新回调可以是异步的（真请求）—— 松手仍同步调用回调（两个同步 Mock 调用方
// 时序不变，只 await 它的返回值），动画与请求 settle 取较晚者收场，且至少转 900ms。

import { useRef, useState, type ReactNode } from 'react';
import 样式 from './下拉刷新.module.css';

/** 松手触发刷新的阈值（px）；拉到 64 封顶 */
const 触发距 = 46;
const 最大距 = 64;
/** 收圈前的最短动画时长（ms），与真实请求 settle 取较晚 */
const 最短动画 = 900;

export default function 下拉刷新({
  children,
  刷新,
}: {
  children: ReactNode;
  /** 触发一次刷新；可返回 Promise，动画会等到它 settle（同步回调时序不变）*/
  刷新?: () => void | Promise<void>;
}) {
  const 容器 = useRef<HTMLDivElement>(null);
  const 起点Y = useRef<number | null>(null);
  const [拉距, 设拉距] = useState(0);
  const [刷新中, 设刷新中] = useState(false);

  const 拉住 = (事件: React.PointerEvent) => {
    // 只在列表已经贴顶时接管手势，否则让给正常滚动
    const 滚 = 容器.current?.querySelector('.滚动区');
    if (滚 && 滚.scrollTop <= 0 && !刷新中) 起点Y.current = 事件.clientY;
  };

  const 拉动 = (事件: React.PointerEvent) => {
    if (起点Y.current === null || 刷新中) return;
    const 位移 = 事件.clientY - 起点Y.current;
    设拉距(位移 > 0 ? Math.min(位移 / 2, 最大距) : 0);
  };

  const 松手 = async () => {
    if (起点Y.current === null) return;
    起点Y.current = null;
    if (拉距 < 触发距) { 设拉距(0); return; }
    设刷新中(true);
    设拉距(触发距);
    const 结果 = 刷新?.();
    await Promise.allSettled([
      Promise.resolve(结果),
      new Promise<void>((resolve) => window.setTimeout(resolve, 最短动画)),
    ]);
    设刷新中(false);
    设拉距(0);
  };

  return (
    <div
      ref={容器}
      className={样式.包}
      onPointerDown={拉住}
      onPointerMove={拉动}
      onPointerUp={松手}
      onPointerCancel={松手}
    >
      <div className={样式.刷新槽} style={{ height: 拉距 }}>
        <span className={`${样式.刷新圈} ${刷新中 ? 样式.刷新转 : ''}`} />
      </div>
      {children}
    </div>
  );
}
