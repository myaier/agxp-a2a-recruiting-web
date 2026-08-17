// R2 选择身份 · 三端分流点。
// 本次只做求职端：猎头 / 企业两张卡可见也可选中，但选中后底部主按钮变成
// 「该端本次未开放」并禁用 —— 让产品形态可见，同时明确走不通，避免用户以为是 bug。

import { useState } from 'react';
import 样式 from './选身份.module.css';
import { 次级页外壳, 页面大标题, 主按钮, 单选点 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';

/** 三端身份键：也直接用作主按钮文案里的身份名 */
type 身份键 = '求职者' | '猎头' | '企业';

interface 身份项 {
  键: 身份键;
  标题: string;
  说明: string;
  /** 本次是否开放；false 的端可选中但不能继续 */
  可用: boolean;
}

const 身份列表: 身份项[] = [
  { 键: '求职者', 标题: '我要找工作', 说明: '授权一个求职AI代理，匿名替你与岗位方谈判', 可用: true },
  { 键: '猎头', 标题: '我是猎头', 说明: '建立寻访AI代理，替委托岗位并行谈人', 可用: false },
  { 键: '企业', 标题: '我要招人', 说明: '发岗位、设薪资带与筛选条件，AI代理替你初筛', 可用: false },
];

export default function 选身份() {
  const { 跳转 } = use导航();
  const [选中, 设选中] = useState<身份键>('求职者');

  const 选中项 = 身份列表.find((项) => 项.键 === 选中) ?? 身份列表[0];

  return (
    <次级页外壳>
      <页面大标题 标题="你想用它做什么？" />

      <div className={样式.列表}>
        {身份列表.map((项) => {
          const 当前 = 选中 === 项.键;
          return (
            <button
              key={项.键}
              className={`${样式.身份卡} ${当前 ? 样式.选中 : ''} 可点`}
              onClick={() => 设选中(项.键)}
            >
              <span className={样式.图标底}>
                <身份图标 键={项.键} />
              </span>
              <span className={样式.身份文字}>
                <span className={样式.身份标题}>{项.标题}</span>
                <span className={样式.身份说明}>{项.说明}</span>
              </span>
              <单选点 选中={当前} />
            </button>
          );
        })}
      </div>

      {/* 弹性空白：把主按钮压到屏幕底部 */}
      <div className={样式.占位} />

      {/* 尾注按用户标注意见（2026-08-17）从选项卡下方挪到底部按钮上方 */}
      <div className={样式.尾注}>求职者即选即用；猎头与企业需认证。</div>

      <主按钮
        文字={选中项.可用 ? `以「${选中项.键}」身份继续` : '该端本次未开放'}
        禁用={!选中项.可用}
        按下={() => 跳转(路径.引导说明)}
      />
    </次级页外壳>
  );
}

/**
 * 三个身份的线性图标。
 * 图标.tsx 里没有「公文包开合 / 猎头放大镜人像 / 写字楼」这三个形状，
 * 按硬性要求就地内联 SVG，路径值照搬 RN 源与设计稿 R2，描边色走 CSS 变量。
 */
function 身份图标({ 键 }: { 键: 身份键 }) {
  const 公共属性 = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 样式.身份图标,
    'aria-hidden': true,
  };

  // 求职者：公文包
  if (键 === '求职者') {
    return (
      <svg {...公共属性}>
        <rect x="2.6" y="7.2" width="18.8" height="13" rx="3" />
        <path d="M8.6 7.2V5.4a2 2 0 0 1 2-2h2.8a2 2 0 0 1 2 2v1.8" />
        <path d="M2.6 12.4h18.8" />
        <path d="M10.6 12.4h2.8" />
      </svg>
    );
  }

  // 猎头：放大镜里套一个人像
  if (键 === '猎头') {
    return (
      <svg {...公共属性}>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <line x1="15.6" y1="15.6" x2="20.5" y2="20.5" />
        <circle cx="10.5" cy="9" r="2.2" />
        <path d="M6.9 13.9a4.4 4.4 0 0 1 7.2 0" />
      </svg>
    );
  }

  // 企业：写字楼
  return (
    <svg {...公共属性}>
      <rect x="4" y="3.6" width="12" height="17.8" rx="2" />
      <path d="M16 9.4h2.6A1.4 1.4 0 0 1 20 10.8v10.6" />
      <path d="M2.6 21.4h18.8" />
      <path d="M7.6 7.4h1.6M11 7.4h1.6M7.6 11h1.6M11 11h1.6M7.6 14.6h1.6M11 14.6h1.6" />
    </svg>
  );
}
