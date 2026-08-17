// R2 选择身份 · 三端分流点。
// 两端可用：求职者 → 引导流程；招聘方 → 实名认证 → 招聘名片 → 发岗。
// 猎头端已按用户指令（2026-08-17）整个移除。原注释：
// 「该端本次未开放」并禁用 —— 让产品形态可见，同时明确走不通，避免用户以为是 bug。

import { useState } from 'react';
import 样式 from './选身份.module.css';
import { 次级页外壳, 页面大标题, 主按钮, 单选点 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';

/** 三端身份键：也直接用作主按钮文案里的身份名 */
type 身份键 = '求职者' | '企业';

interface 身份项 {
  键: 身份键;
  标题: string;
  /** 本次是否开放；false 的端可选中但不能继续 */
  可用: boolean;
}

const 身份列表: 身份项[] = [
  // 说明小字已按直达标注意见（2026-08-17 21:13）删除，卡片只留标题
  { 键: '求职者', 标题: '我要找工作', 可用: true },
  { 键: '企业', 标题: '我要招人', 可用: true },
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
              </span>
              <单选点 选中={当前} />
            </button>
          );
        })}
      </div>

      {/* 尾注按用户标注意见（2026-08-17）从选项卡下方挪到底部按钮上方 */}
      <div className={样式.尾注}>求职者即选即用；招聘方需实名认证。</div>

      <主按钮
        文字={选中 === '企业' ? '以「招聘方」身份继续' : '以「求职者」身份继续'}
        禁用={!选中项.可用}
        按下={() => 跳转(选中 === '企业' ? 路径.企业实名认证 : 路径.引导说明)}
      />
    </次级页外壳>
  );
}

/**
 * 三个身份的线性图标。
 * 图标.tsx 里没有「公文包开合 / 写字楼」这两个形状，
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
