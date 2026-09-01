// 设备外框：让「手机 App」在浏览器里也是一台手机，而不是被拉宽的网页。
//
// 两种形态，按视口宽度自动切：
//   · 机身模式（桌面 / 平板横屏）—— 居中一台 402×874 的 iPhone 15 Pro，
//     带机身圆角、灵动岛、状态栏和 home 横条，参数取自设计包的 ios-frame.jsx。
//     视口不够高时整机等比缩放，保证一眼看全。
//   · 全屏模式（真手机浏览器）—— 直接铺满，安全区读 env()，不画假状态栏
//     （真机上系统状态栏就在那儿，再画一条会重影）。
//
// 安全区靠 CSS 变量在两种形态间切换：机身模式写死 iPhone 15 Pro 实测值
// （上 59 / 下 34），全屏模式走 env()。屏幕代码只认 var(--安全区上/下)，
// 因此同一套布局在两种形态下都对。

import { useEffect, useState, type ReactNode } from 'react';
import 样式 from './设备外框.module.css';

/** 设计基准尺寸：iPhone 15 Pro 逻辑分辨率，设计稿所有屏都画在这个尺寸里 */
const 机身宽 = 402;
const 机身高 = 874;

/** 低于这个宽度就认为是真手机，直接全屏；留出余量避免小窗浏览器误判 */
const 机身模式最小宽 = 700;
const 机身模式最小高 = 640;

/**
 * 填满父级：标注评审布局（标注层.module.css）里外框交给 grid 槽定高 ——
 * 主槽是 1fr 而不是整个视口，两种形态自带的 100dvh 会被 .填满父级 覆盖（见 CSS 尾部）。
 * 缺省不传：外框继续自己占满视口，缺省构建的布局一像素不动。
 */
export default function 设备外框({ children, 填满父级 }: { children: ReactNode; 填满父级?: boolean }) {
  const 机身模式 = use机身模式();
  const 缩放 = use整机缩放(机身模式);

  if (!机身模式) {
    // 真手机：铺满视口，安全区由 :root 的 env() 提供
    // data-遮罩挂载点：换壳遮罩挂在这里，盖住的就是用户看到的整块屏（见 路由/换壳遮罩.ts）
    return <div className={填满父级 ? `${样式.全屏} ${样式.填满父级}` : 样式.全屏} data-遮罩挂载点>{children}</div>;
  }

  return (
    <div className={填满父级 ? `${样式.画布} ${样式.填满父级}` : 样式.画布}>
      <div className={样式.缩放层} style={{ transform: `scale(${缩放})` }}>
        {/* data-遮罩挂载点 打在机身层而不是屏幕层：换壳遮罩要盖住机身内的一切
            —— 屏幕内容、灵动岛、状态栏、home 横条，一条缝都不留 */}
        <div className={样式.机身} data-遮罩挂载点>
          {/* 灵动岛 */}
          <div className={样式.灵动岛} />
          {/* 状态栏：只在机身模式画，真机上是系统自带的 */}
          <状态栏 />
          {/* 屏幕内容 */}
          <div className={样式.屏幕}>{children}</div>
          {/* home 横条 */}
          <div className={样式.home区}>
            <div className={样式.home条} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 视口够大就用机身模式 */
function use机身模式() {
  const [机身模式, 设机身模式] = useState(() => 判断机身模式());

  useEffect(() => {
    const 重算 = () => 设机身模式(判断机身模式());
    window.addEventListener('resize', 重算);
    window.addEventListener('orientationchange', 重算);
    return () => {
      window.removeEventListener('resize', 重算);
      window.removeEventListener('orientationchange', 重算);
    };
  }, []);

  return 机身模式;
}

function 判断机身模式() {
  if (typeof window === 'undefined') return false;
  // 有粗指针（触屏）且屏幕窄 → 真手机
  const 触屏 = window.matchMedia('(pointer: coarse)').matches;
  const 够宽 = window.innerWidth >= 机身模式最小宽;
  const 够高 = window.innerHeight >= 机身模式最小高;
  return 够宽 && 够高 && !(触屏 && window.innerWidth < 1024);
}

/** 视口不够高时整机等比缩小，保证整台手机可见 */
function use整机缩放(机身模式: boolean) {
  const [缩放, 设缩放] = useState(1);

  useEffect(() => {
    if (!机身模式) return;
    const 重算 = () => {
      const 纵向余量 = 48; // 上下各留 24
      const 横向余量 = 32;
      const 纵向比 = (window.innerHeight - 纵向余量) / 机身高;
      const 横向比 = (window.innerWidth - 横向余量) / 机身宽;
      设缩放(Math.min(1, 纵向比, 横向比));
    };
    重算();
    window.addEventListener('resize', 重算);
    return () => window.removeEventListener('resize', 重算);
  }, [机身模式]);

  return 缩放;
}

/** iOS 状态栏：时间 + 信号 / Wi-Fi / 电池，参数照 ios-frame.jsx */
function 状态栏() {
  return (
    <div className={样式.状态栏}>
      <div className={样式.状态栏左}>
        <span className={样式.时间}>9:41</span>
      </div>
      <div className={样式.状态栏右}>
        {/* 信号 */}
        <svg width="19" height="12" viewBox="0 0 19 12" aria-hidden>
          <rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill="#000" />
          <rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill="#000" />
          <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill="#000" />
          <rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill="#000" />
        </svg>
        {/* Wi-Fi */}
        <svg width="17" height="12" viewBox="0 0 17 12" aria-hidden>
          <path
            d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z"
            fill="#000"
          />
          <path
            d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z"
            fill="#000"
          />
          <circle cx="8.5" cy="10.5" r="1.5" fill="#000" />
        </svg>
        {/* 电池 */}
        <svg width="27" height="13" viewBox="0 0 27 13" aria-hidden>
          <rect
            x="0.5"
            y="0.5"
            width="23"
            height="12"
            rx="3.5"
            stroke="#000"
            strokeOpacity="0.35"
            fill="none"
          />
          <rect x="2" y="2" width="20" height="9" rx="2" fill="#000" />
          <path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill="#000" fillOpacity="0.4" />
        </svg>
      </div>
    </div>
  );
}
