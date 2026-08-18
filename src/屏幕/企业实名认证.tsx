// R8 企业实名认证 · 招聘方注册第一步。
// 同构源：选身份.tsx 的次级页版式（通用大标题 / 弹性占位 / 底部主按钮）。
//
// 业务口径：双盲机制是不对称的 —— 候选人在意向确认前只有代号，
// 招聘方却从一开始就实名示人。这一屏核验的「真实姓名 + 任职公司」
// 正是候选人敢把条件交给 AI 代理的前提。
//
// 交互：点「开始人脸识别」→ 按钮变「认证中…」1.2 秒（setTimeout + 本地态）
// → 轻提示('认证通过') → 跳 招聘名片。

import { useEffect, useRef, useState } from 'react';
import 样式 from './企业实名认证.module.css';
import { 次级页外壳, 返回栏, 页面大标题, 主按钮 } from '../组件/通用';
import { 细对勾图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';

/** 认证要点两行：核验什么 + 一句为什么 */
const 认证要点 = [
  { 主: '真实姓名', 副: '与证件一致，向候选人实名示人' },
  { 主: '任职公司', 副: '核验你确在该公司任职' },
];

export default function 企业实名认证() {
  const { 跳转, 返回 } = use导航();
  const [认证中, 设认证中] = useState(false);
  // 计时器句柄：认证中途退出本屏时清掉，避免离屏后仍触发跳转
  const 计时器 = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (计时器.current !== null) window.clearTimeout(计时器.current);
    };
  }, []);

  function 开始识别() {
    if (认证中) return;
    设认证中(true);
    // 原型环境：1.2 秒模拟人脸识别，通过后进入招聘名片
    计时器.current = window.setTimeout(() => {
      轻提示('认证通过');
      跳转(路径.招聘名片);
    }, 1200);
  }

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      {/* 标注 21:59：说明小字删掉，标题自己说得清 */}
      <页面大标题 标题="实名认证" />

      {/* ── 居中人脸识别占位：140px 圆，外圈虚线旋转 ── */}
      <div className={样式.识别区}>
        <div className={`${样式.识别圈} ${认证中 ? 样式.认证中 : ''}`}>
          <svg className={样式.虚线环} viewBox="0 0 140 140" aria-hidden="true">
            <circle
              className={样式.环线}
              cx="70"
              cy="70"
              r="68.5"
              fill="none"
              strokeWidth="1.6"
              strokeDasharray="4.5 7.5"
              strokeLinecap="round"
            />
          </svg>
          <span className={样式.脸底}>
            <人脸占位 />
          </span>
        </div>
      </div>

      {/* ── 认证要点两行 ── */}
      <div className={样式.要点区}>
        {认证要点.map((项) => (
          <div key={项.主} className={样式.要点行}>
            <span className={样式.要点圆}>
              <细对勾图标 尺寸={11} 色="var(--橄榄)" />
            </span>
            <span className={样式.要点主}>{项.主}</span>
            <span className={样式.要点副}>{项.副}</span>
          </div>
        ))}
      </div>

      {/* 弹性空白：把主按钮压到屏幕底部 */}
      <div className={样式.占位} />

      <主按钮
        文字={认证中 ? '认证中…' : '开始人脸识别'}
        禁用={认证中}
        按下={开始识别}
      />
    </次级页外壳>
  );
}

/**
 * 简单人脸线性 SVG：头 + 双眼 + 微笑 + 肩线。
 * 图标.tsx 里没有人脸形状，按硬性要求就地内联，描边色走 module.css 变量。
 */
function 人脸占位() {
  return (
    <svg
      width={56}
      height={56}
      viewBox="0 0 64 64"
      fill="none"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={样式.人脸线}
      aria-hidden="true"
    >
      {/* 头 */}
      <circle cx="32" cy="27" r="15" />
      {/* 双眼 */}
      <path d="M26.4 24.6v3.2" />
      <path d="M37.6 24.6v3.2" />
      {/* 微笑 */}
      <path d="M26.8 33.4c1.5 1.8 8.9 1.8 10.4 0" />
      {/* 肩线 */}
      <path d="M14.5 57c3.3-6.6 10-10.4 17.5-10.4s14.2 3.8 17.5 10.4" />
    </svg>
  );
}
