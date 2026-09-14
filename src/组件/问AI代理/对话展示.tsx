// 问AI代理 两端（求职 A27 / 招聘 D14）共用的对话展示件：
// 代理气泡框 / 代理气泡 / 我方气泡 / 快捷操作行。
//
// 只做受控展示：数据与动作全部来自内存 props，这里不认识 fixture、Context、
// 路由、API、存储或业务操作；收到新 props 直接更新，不把初值复制成 state。
//
// 外观（'求职' | '招聘'）只选择 CSS，按原声明保留两端差异：
//   · 求职代理气泡抱内容（flex: 0 1 auto，短句就是短气泡）；招聘代理气泡伸展（flex: 1，上限 86%）
//   · 求气泡文字 13.5px/1.45；招聘 14px/1.7
//   · 求职快捷行单行横滑；招聘换行堆叠
// 简报=true 时只有求职端采用原 .简报气泡 的整行放宽，招聘端保持基础气泡宽度
// （Task 3 提取简报卡时复用 代理气泡框）。

import type { ReactNode } from 'react';
import 样式 from './对话展示.module.css';
import 代理标 from '../代理标';

export type 代理外观 = '求职' | '招聘';
export type 快捷操作项 = { 键: string; 文案: string; 按下: () => void };

export type 代理气泡框属性 = {
  外观: 代理外观;
  简报?: boolean;
  children: ReactNode;
};

export type 代理气泡属性 = { 外观: 代理外观; 内容: string };

export type 我方气泡属性 = {
  外观: 代理外观;
  内容: string;
  头像URL: string | null;
  首字: string;
};

export type 快捷操作行属性 = { 外观: 代理外观; 项们: readonly 快捷操作项[] };

// 外观类挂在各组件自己的根元素上，后代选择器按端取差异 —— 不新增任何影响 flex 的 DOM 层
const 外观类 = (外观: 代理外观) => (外观 === '求职' ? 样式.求职 : 样式.招聘);

// ── 代理侧一行：裸代理标头像（与主页横幅同款，无圆底）+ 左上角切平的气泡外壳。
// 文字排版由调用方内容负责；普通文本走 代理气泡 里的文字容器。 ──
export function 代理气泡框({ 外观, 简报 = false, children }: 代理气泡框属性) {
  return (
    <div className={`${样式.代理行} ${外观类(外观)}`}>
      <span className={样式.小盾牌}>
        <代理标 尺寸={30} 脸色="var(--荧光绿)" 眼色="var(--墨)" 描边色="var(--墨)" 描边宽={2.6} />
      </span>
      <div className={`${样式.代理气泡} ${简报 && 外观 === '求职' ? 样式.简报气泡 : ''}`}>
        {children}
      </div>
    </div>
  );
}

// ── 普通代理文本气泡：框 + 文字容器。与迁移前结构等价（文字容器为气泡内层子元素，
// 原实现是气泡自带 气泡文字 类），无新增影响 flex 的外层 ──
export function 代理气泡({ 外观, 内容 }: 代理气泡属性) {
  return (
    <代理气泡框 外观={外观}>
      <div className={样式.气泡文字}>{内容}</div>
    </代理气泡框>
  );
}

// ── 我方（右）：荧光绿浅底气泡、右下角切角，头像列与左侧代理头像对称。
// 有头像图用图，否则落首字；换 props 立即跟着换 ──
export function 我方气泡({ 外观, 内容, 头像URL, 首字 }: 我方气泡属性) {
  return (
    <div className={`${样式.我行} ${外观类(外观)}`}>
      <div className={`${样式.我气泡} ${样式.气泡文字}`}>{内容}</div>
      <span className={样式.我头像}>
        {头像URL ? (
          <img
            src={头像URL}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          首字
        )}
      </span>
    </div>
  );
}

// ── 快捷问句 / 快捷导航胶囊行：求职单行横滑、招聘换行。点击只触发被点那一项的回调 ──
export function 快捷操作行({ 外观, 项们 }: 快捷操作行属性) {
  return (
    <div className={`${样式.快捷行} ${外观类(外观)}`}>
      {项们.map((项) => (
        <button key={项.键} className={`${样式.快捷键} 可点`} onClick={项.按下}>
          {项.文案}
        </button>
      ))}
    </div>
  );
}
