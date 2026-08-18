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
import { 次级页外壳, 返回栏, 页面大标题, 滚动区, 主按钮 } from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 路径 } from '../路由/路径表';

/** 公司全称输入上限（对照 BOSS 的 46 字；营业执照名称不会超过这个长度） */
const 公司全称上限 = 46;

/** 公司全称的注意事项（BOSS 截图三条，换成我们的口径） */
const 公司注意事项 = [
  '填写营业执照上的公司全称，注意区分总公司与分公司',
  '全称用于核验你确实在该公司任职，请确保准确',
  '认证通过后，姓名与公司会写进你的招聘名片，候选人从第一轮起可见',
];

export default function 企业实名认证() {
  const { 跳转, 返回 } = use导航();
  const { 状态, 派发 } = use应用状态();
  // 预填上次认证的结果：老用户重走认证是「改」不是「重填」
  const [姓名, 设姓名] = useState(状态.企业认证.姓名);
  const [公司全称, 设公司全称] = useState(状态.企业认证.公司);
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
    // 人脸识别核对的就是这两项，缺一项识别无从谈起
    if (姓名.trim() === '') {
      轻提示('请填写与证件一致的真实姓名');
      return;
    }
    if (公司全称.trim() === '') {
      轻提示('请填写营业执照上的公司全称');
      return;
    }
    设认证中(true);
    // 原型环境：1.2 秒模拟人脸识别，通过后把结果落进全局再进招聘名片
    计时器.current = window.setTimeout(() => {
      派发({ 型: '存企业认证', 姓名: 姓名.trim(), 公司: 公司全称.trim() });
      轻提示('认证通过');
      跳转(路径.招聘名片);
    }, 1200);
  }

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      {/* 标注 21:59：说明小字删掉，标题自己说得清 */}
      <页面大标题 标题="实名认证" />

      <滚动区 样式覆盖={{ padding: '0 0 8px' }}>
        {/* ── 核验的两项就在这里填：真实姓名 + 营业执照公司全称（BOSS 截图 1/2 对照）── */}
        <div className={样式.表单区}>
          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>真实姓名</div>
            <input
              className={样式.条目输入}
              value={姓名}
              placeholder="与证件一致，向候选人实名示人"
              onChange={(事件) => 设姓名(事件.target.value)}
            />
          </div>

          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>任职公司（营业执照全称）</div>
            <div className={样式.条目输入行}>
              <input
                className={样式.条目输入}
                value={公司全称}
                placeholder="如：上海云衢信息科技有限公司"
                maxLength={公司全称上限}
                onChange={(事件) => 设公司全称(事件.target.value)}
              />
              <span className={`${样式.计数} 等宽数字`}>
                {公司全称.length}/{公司全称上限}
              </span>
            </div>
          </div>

          <div className={样式.注意事项}>
            {公司注意事项.map((行, 序) => (
              <div key={行} className={样式.注意行}>
                {序 + 1}. {行}
              </div>
            ))}
          </div>
        </div>

        {/* ── 居中人脸识别占位：外圈虚线旋转 ── */}
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
          <div className={样式.识别注}>人脸识别将核对上面两项</div>
        </div>
      </滚动区>

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
