// R1 手机号进入 · 三端共同入口。未注册自动创建账号。
//
// 原型层面的三条交互（与 RN 源 应用/屏幕/登录.js 一致）：
//   · 手机号可真实输入（只保留数字与空格，最长 13 位 = 3+4+4 加两个空格）
//   · 验证码四格随输入点亮：已输入的格显示数字，下一个待输入的格描深绿边并画竖光标
//   · 不校验验证码，只要勾了协议就能进下一步 —— 原型不接短信通道

import { useState } from 'react';
import 样式 from './登录.module.css';
import { 次级页外壳, 主按钮 } from '../组件/通用';
import { 对勾图标 } from '../组件/图标';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';

/** 验证码格数：四格，与设计稿 R1 一致 */
const 验证码格数 = 4;

/** 手机号最长长度：11 位数字 + 两个分组空格 */
const 手机号最长 = 13;

export default function 登录() {
  const { 跳转 } = use导航();
  const [手机号, 设手机号] = useState('138 0013 2046');
  const [验证码, 设验证码] = useState('73');
  const [已同意, 设已同意] = useState(true);

  // 原型不校验验证码，只要勾了协议就能进；四格光点仍随输入推进
  const 可进入 = 已同意;

  // 手机号与微信两条路径都进「选身份」——三端分流在下一屏做
  const 进入下一步 = () => 跳转(路径.选身份);

  return (
    <次级页外壳>
      <div className={样式.标题区}>
        <h1 className={样式.大标题}>登录/注册</h1>
        <p className={样式.说明}>手机号进入，未注册将自动创建账号。</p>
      </div>

      {/* 表单卡：上半手机号行、下半验证码四格 */}
      <div className={样式.表单卡}>
        <div className={样式.手机行}>
          <span className={样式.区号}>
            +86 <span className={样式.区号箭头}>▾</span>
          </span>
          <span className={样式.竖线} />
          <input
            className={`${样式.手机输入} 等宽数字`}
            value={手机号}
            // 只允许数字和空格：粘贴带括号 / 横线的号码时自动洗干净
            onChange={(事件) =>
              设手机号(事件.target.value.replace(/[^\d ]/g, '').slice(0, 手机号最长))
            }
            inputMode="tel"
            maxLength={手机号最长}
            aria-label="手机号"
          />
        </div>

        <div className={样式.验证码行}>
          {/*
            四个格子只是展示层，键盘输入落在覆盖其上的透明 input 上。
            这样点任意一格都能唤起键盘，且不必给四个格子各写一份光标 / 退格逻辑。
          */}
          <div className={样式.验证码组}>
            {Array.from({ length: 验证码格数 }, (_, 位) => {
              const 字 = 验证码[位];
              // 「聚焦格」= 下一个待输入的格，与 RN 源同一判定
              const 聚焦 = 验证码.length === 位;
              return (
                <span
                  key={位}
                  className={`${样式.验证码格} ${聚焦 ? 样式.聚焦 : ''}`}
                >
                  {字 ? (
                    <span className={`${样式.验证码字} 等宽数字`}>{字}</span>
                  ) : 聚焦 ? (
                    <span className={样式.光标} />
                  ) : null}
                </span>
              );
            })}
            <input
              className={样式.验证码输入}
              value={验证码}
              onChange={(事件) =>
                设验证码(事件.target.value.replace(/\D/g, '').slice(0, 验证码格数))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={验证码格数}
              aria-label="短信验证码"
            />
          </div>
          <span className={`${样式.倒计时} 等宽数字`}>47s</span>
        </div>
      </div>

      {/* 协议勾选：未勾则底部主按钮禁用 */}
      <button
        className={`${样式.同意行} 可点`}
        onClick={() => 设已同意((旧) => !旧)}
        aria-pressed={已同意}
      >
        <span className={`${样式.勾选圈} ${已同意 ? '' : 样式.未选}`}>
          {已同意 ? <对勾图标 尺寸={9} 色="#fff" 线宽={3.6} /> : null}
        </span>
        <span className={样式.同意文字}>
          已阅读并同意 <span className={样式.链接}>《用户协议》</span> 与{' '}
          <span className={样式.链接}>《隐私与分层披露政策》</span>
        </span>
      </button>

      {/* 中间弹性空白：分割行垂直居中，把微信登录压到底部按钮上方 */}
      <div className={样式.分割区}>
        <div className={样式.分割行}>
          <span className={样式.分割线} />
          <span className={样式.分割文字}>或通过以下方式登录</span>
          <span className={样式.分割线} />
        </div>
      </div>

      <div className={样式.微信区}>
        <button className={`${样式.微信键} 可点`} onClick={进入下一步}>
          微信登录
        </button>
      </div>

      <主按钮 文字="进入" 按下={进入下一步} 禁用={!可进入} />
    </次级页外壳>
  );
}
