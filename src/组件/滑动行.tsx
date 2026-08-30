// 滑动行：左滑露出操作按钮（标注意见 2026-08-18：岗位要能滑动删除并二次确认）。
//
// 手势实现要点：
//   · 用 pointer 事件而不是 touch，桌面鼠标拖拽与手机触摸同一套代码；
//     —— 但两者有一处不同必须自己抹平：触摸移动过后浏览器会抑制兼容 click，鼠标不会。
//     不抹平的话鼠标滑开这一行之后，紧跟着那个合成 click 会落回行面，
//     把刚打开的行立刻关掉（行本来关着时更糟：直接当成点行进了详情）。
//     所以判定为「横向」的手势结束时武装一次性抑制，吞掉紧随其后的那一个 click。
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
  /** 调用方有在飞写时置真：按钮与页内其它动作键同一处置（禁用 + 去掉按压反馈）*/
  禁用?: boolean;
  按下: () => void;
}

export default function 滑动行({
  操作,
  打开,
  请求打开,
  按下,
  名称,
  children,
}: {
  操作: 滑动操作[];
  打开: boolean;
  /** 传 true 表示这一行要打开（其它行应关闭），false 表示关闭 */
  请求打开: (开: boolean) => void;
  /** 点行本身。行处于打开态时点击只做关闭，不触发这个回调 */
  按下?: () => void;
  /** 行面的可访问名称。不给时读屏念到的是行内容拼起来的一长串，
   *  给了就能被「这一行是哪一条」的业务名直接念出来、也能被按名称定位 */
  名称?: string;
  children: ReactNode;
}) {
  const 起点 = useRef<{ x: number; y: number } | null>(null);
  const 判定 = useRef<'未定' | '横向' | '纵向'>('未定');
  // 刚完成一次横向手势：吞掉浏览器紧接着合成的那一个 click，且只吞一次
  const 吞下次点击 = useRef(false);
  // 每个操作按钮 76px 宽
  const 操作区宽 = 操作.length * 76;

  const 按下开始 = (事件: React指针事件<HTMLDivElement>) => {
    起点.current = { x: 事件.clientX, y: 事件.clientY };
    判定.current = '未定';
    // 新手势开始：上一次没被消费掉的抑制作废，不许泄漏到这一次
    吞下次点击.current = false;
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
    // 只有真被判成横向的手势才武装抑制：普通点按（判定 仍是「未定」）走上面那条早退，
    // 一个字都没改，仍然是原来的点按行为
    吞下次点击.current = true;
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
            className={`${样式.操作键} ${项.危险 ? 样式.危险 : ''} ${项.禁用 ? '' : '可点'}`}
            disabled={项.禁用}
            onClick={() => {
              if (项.禁用) return;
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
        aria-label={名称}
        aria-expanded={打开}
        style={{ transform: `translateX(${打开 ? -操作区宽 : 0}px)` }}
        onPointerDown={按下开始}
        onPointerMove={移动}
        onPointerUp={松手}
        onPointerCancel={() => {
          起点.current = null;
          吞下次点击.current = false;
        }}
        onClick={() => {
          // 刚滑完的那一次合成 click 不是用户的「点」，吞掉并复位
          if (吞下次点击.current) {
            吞下次点击.current = false;
            return;
          }
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
