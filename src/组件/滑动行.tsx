// 滑动行：左滑露出操作按钮（标注意见 2026-08-18：岗位要能滑动删除并二次确认）。
//
// 手势实现要点：
//   · 用 pointer 事件而不是 touch，桌面鼠标拖拽与手机触摸同一套代码；
//   · 只有横向位移明显大于纵向时才认定为滑动（否则会把纵向滚动吃掉）；
//   · 松手按位移过半吸附到「全开 / 全关」，不停在中间；
//   · 打开状态下点行本身 = 先关闭，避免误触内容区。
// 同一时刻只允许一行处于打开态由调用方通过 打开 / 请求打开 受控管理。

import { useRef, type KeyboardEvent, type PointerEvent as React指针事件, type ReactNode } from 'react';
import 样式 from './滑动行.module.css';

export interface 滑动操作 {
  文字: string;
  /** 危险操作用红底（删除），常规用灰底（停止招聘 / 重新开放）*/
  危险?: boolean;
  按下: () => void;
}

export default function 滑动行({
  操作,
  打开,
  请求打开,
  按下,
  children,
}: {
  操作: 滑动操作[];
  打开: boolean;
  /** 传 true 表示这一行要打开（其它行应关闭），false 表示关闭 */
  请求打开: (开: boolean) => void;
  /** 点行本身。行处于打开态时点击只做关闭，不触发这个回调 */
  按下?: () => void;
  children: ReactNode;
}) {
  const 起点 = useRef<{ x: number; y: number } | null>(null);
  const 判定 = useRef<'未定' | '横向' | '纵向'>('未定');
  // 每个操作按钮 76px 宽
  const 操作区宽 = 操作.length * 76;

  const 按下开始 = (事件: React指针事件<HTMLDivElement>) => {
    起点.current = { x: 事件.clientX, y: 事件.clientY };
    判定.current = '未定';
  };

  const 移动 = (事件: React指针事件<HTMLDivElement>) => {
    if (!起点.current) return;
    const 横移 = 事件.clientX - 起点.current.x;
    const 纵移 = 事件.clientY - 起点.current.y;
    if (判定.current === '未定') {
      // 位移还太小时不下判断，避免手指刚落下就误判方向
      if (Math.abs(横移) < 6 && Math.abs(纵移) < 6) return;
      判定.current = Math.abs(横移) > Math.abs(纵移) ? '横向' : '纵向';
    }
    if (判定.current !== '横向') return;
    // 横向滑动确认后接管事件，防止页面跟着横向滚
    事件.preventDefault();
  };

  const 松手 = (事件: React指针事件<HTMLDivElement>) => {
    if (!起点.current || 判定.current !== '横向') {
      起点.current = null;
      return;
    }
    const 横移 = 事件.clientX - 起点.current.x;
    起点.current = null;
    // 左滑超过操作区一半 → 打开；右滑同理关闭
    if (横移 < -操作区宽 / 2) 请求打开(true);
    else if (横移 > 操作区宽 / 2) 请求打开(false);
  };

  return (
    <div className={样式.外壳}>
      {/* 操作按钮压在行下面，行左移后露出来 */}
      <div className={样式.操作区} style={{ width: 操作区宽 }} aria-hidden={!打开}>
        {操作.map((项) => (
          <button
            key={项.文字}
            className={`${样式.操作键} ${项.危险 ? 样式.危险 : ''} 可点`}
            onClick={() => {
              请求打开(false);
              项.按下();
            }}
            tabIndex={打开 ? 0 : -1}
          >
            {项.文字}
          </button>
        ))}
      </div>

      <div
        className={样式.行面}
        role="button"
        tabIndex={0}
        aria-expanded={打开}
        style={{ transform: `translateX(${打开 ? -操作区宽 : 0}px)` }}
        onPointerDown={按下开始}
        onPointerMove={移动}
        onPointerUp={松手}
        onPointerCancel={() => {
          起点.current = null;
        }}
        onClick={() => {
          // 打开态下点击只收起，不进详情 —— 否则用户想关掉却误入了下一屏
          if (打开) {
            请求打开(false);
            return;
          }
          按下?.();
        }}
        onKeyDown={(事件: KeyboardEvent<HTMLDivElement>) => {
          if (事件.key !== 'Enter' && 事件.key !== ' ') return;
          事件.preventDefault();
          if (打开) 请求打开(false);
          else 按下?.();
        }}
      >
        {children}
      </div>
    </div>
  );
}
