// R1 手机号进入 · 三端共同入口。未注册自动创建账号。
//
// 真实交互流程（按用户标注意见 2026-08-17 重做，不再预填演示数据）：
//   1. 自己输手机号（自动 3-4-4 分组），满 11 位后「获取验证码」可点
//   2. 点「获取验证码」→ 60 秒真倒计时，归零变「重新获取」
//   3. 点任意验证码格弹数字键盘，自己输 4 位（原型不校验数字本身）
//   4. 手机号 + 4 位验证码 + 勾协议 三者齐 →「进入」点亮
// 微信登录保持一键直进，但与手机号登录共用协议勾选门槛。
//
// 版式意图（2026-08-17 用户提议）：原来中间一大片空白 —— 现在上方放产品名
// 建立身份，空白处交给**代理随输入实时引导**：代理的话跟着你填到哪一步换一句，
// 于是「注册」本身就是代理第一次替你干活，顺带把产品最核心的承诺
// （替你看市场 / 底线只有我知道）在第一屏就说清。

import { useEffect, useRef, useState } from 'react';
import 样式 from './登录.module.css';
import { 次级页外壳, 主按钮 } from '../组件/通用';
import { 对勾图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { 取后端错误文案 } from '../数据/HTTP客户端';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 路径 } from '../路由/路径表';
import { 短信验证码位数 } from '../数据/验证码规则';

/** 验证码格数：与登录、换绑等短信验证入口共享同一产品规则。 */
const 验证码格数 = 短信验证码位数;

/** 倒计时时长（秒）。设计稿里画的是 47s 中间态，真流程从 60 起跑 */
const 倒计时秒数 = 60;

/** 把纯数字手机号格式化成「138 0013 2046」的 3-4-4 分组 */
function 格式化手机号(数字串: string): string {
  const 段 = [数字串.slice(0, 3), 数字串.slice(3, 7), 数字串.slice(7, 11)].filter(Boolean);
  return 段.join(' ');
}

export default function 登录() {
  const { 跳转 } = use导航();
  const { 数据源模式, 操作 } = use应用状态();
  const [手机号数字, 设手机号数字] = useState('');
  const [验证码, 设验证码] = useState('');
  const [已同意, 设已同意] = useState(false);
  // 倒计时剩余秒数：null = 还没发过验证码；0 = 跑完可重发
  const [剩余秒, 设剩余秒] = useState<number | null>(null);
  const 验证码输入引用 = useRef<HTMLInputElement>(null);
  // Backend 三个按钮的重复点击守卫：不增加 disabled class 或 Loading 文案
  const 取码中 = useRef(false);
  const 进入中 = useRef(false);
  const 微信中 = useRef(false);

  const 手机号齐 = 手机号数字.length === 11;
  const 验证码齐 = 验证码.length === 验证码格数;
  const 可进入 = 手机号齐 && 验证码齐 && 已同意;

  // 真倒计时：每秒 -1，归零停
  useEffect(() => {
    if (剩余秒 === null || 剩余秒 <= 0) return;
    const 定时 = setTimeout(() => 设剩余秒(剩余秒 - 1), 1000);
    return () => clearTimeout(定时);
  }, [剩余秒]);

  const 发验证码 = () => {
    if (!手机号齐) {
      轻提示('先输入 11 位手机号');
      return;
    }
    if (剩余秒 !== null && 剩余秒 > 0) return; // 倒计时中不可重发
    if (数据源模式 === 'backend') {
      if (取码中.current) return;
      取码中.current = true;
      // 验证码格先亮起来（视觉反馈），但倒计时等请求成功才启动：
      // 原来先设 剩余秒 再发请求，请求失败时 60s 倒计时仍在跑、用户无法重发，
      // 且验证码格亮着却没有合法 attempt_id。失败时把视觉反馈复位以便重试。
      设验证码('');
      操作.开始手机登录(手机号数字)
        .then(() => {
          设剩余秒(倒计时秒数);
          轻提示('验证码已发送');
          // 验证码格在 剩余秒 非 null 后才渲染，焦点等成功后再送进去，
          // 避免网络延迟下输入格还没渲染就 focus（#8）。
          setTimeout(() => 验证码输入引用.current?.focus(), 80);
        })
        .catch((错误) => {
          // 失败时复位视觉反馈：剩余秒 归 null（可重发），验证码清空，
          // 不留 0 秒 + 旧 attempt 的脏态（#6）
          设剩余秒(null);
          设验证码('');
          轻提示(取后端错误文案(错误));
        })
        .finally(() => {
          取码中.current = false;
        });
      return;
    }
    设剩余秒(倒计时秒数);
    设验证码('');
    轻提示('验证码已发送（原型不校验，任意 4 位数字即可）');
    // 发完码直接把焦点送进验证码格，弹数字键盘
    setTimeout(() => 验证码输入引用.current?.focus(), 80);
  };

  const 进入下一步 = async () => {
    if (!可进入) {
      if (!手机号齐) 轻提示('先输入 11 位手机号');
      else if (!验证码齐) 轻提示('输入 4 位验证码');
      else 轻提示('先勾选用户协议');
      return;
    }
    if (数据源模式 === 'backend') {
      if (进入中.current) return;
      进入中.current = true;
      try {
        // 完成登录原样发送 4 位 code；attempt_id 由 Provider 保存
        await 操作.完成手机登录(验证码);
        跳转(路径.选身份);
      } catch (错误) {
        轻提示(取后端错误文案(错误));
      } finally {
        进入中.current = false;
      }
      return;
    }
    跳转(路径.选身份);
  };

  const 微信登录按下 = async () => {
    if (!已同意) {
      轻提示('先勾选用户协议');
      return;
    }
    if (数据源模式 === 'backend') {
      if (微信中.current) return;
      微信中.current = true;
      try {
        const url = await 操作.微信登录();
        if (url) window.location.assign(url);
        else 跳转(路径.选身份);
      } catch (错误) {
        轻提示(取后端错误文案(错误));
      } finally {
        微信中.current = false;
      }
      return;
    }
    跳转(路径.选身份);
  };

  return (
    <次级页外壳>
      {/* 顶部渐变（登录改版乙，2026-08-24 参考 BOSS 布局 + 品牌色）：
          主页同款渐变头减淡到 55%，给「上面太空」的区域铺上颜色 */}
      <div className="顶部渐变头" style={{ opacity: 0.55 }} />

      {/* 品牌区：只剩产品名。
          图标先撤（2026-08-18 用户：现有图标都不满意，等定了新的再放回来）；
          主张「条件对上了，再开始聊」按标注 2026-08-23「这个文案不对」撤掉。
          这句和图标、代理引导气泡是同一次重构（7e43683）加的自创文案，
          三样现在都撤干净了。要放标语请由产品负责人给词，不自拟。 */}
      <div className={样式.品牌区}>
        {/* 2026-08-24 定名「工作蜂」；slogan 二改为产品负责人自拟版「找工作，上工作蜂」（名字复读 +
            避开与 BOSS「找工作，跟老板谈」的结构撞车）；机制句「蜂替你谈」退到产品内部—— 不是自拟文案 */}
        <h1 className={样式.产品名}>工作蜂</h1>
        <p className={样式.主张}>找AI工作，上工作蜂</p>
      </div>

      {/* 表单卡：上半手机号行、下半验证码四格 + 获取验证码 */}
      <div className={样式.表单卡}>
        <div className={样式.手机行}>
          <button className={`${样式.区号} 可点`} onClick={() => 轻提示('原型暂只支持 +86')}>
            +86 <span className={样式.区号箭头}>▾</span>
          </button>
          <span className={样式.竖线} />
          <input
            className={`${样式.手机输入} 等宽数字`}
            value={格式化手机号(手机号数字)}
            placeholder="输入手机号"
            // 只留数字：粘贴带空格 / 横线 / 括号的号码自动洗干净
            onChange={(事件) =>
              设手机号数字(事件.target.value.replace(/\D/g, '').slice(0, 11))
            }
            inputMode="tel"
            autoComplete="tel"
            aria-label="手机号"
          />
        </div>

        <div className={样式.验证码行}>
          {/*
            四个格子只是展示层，键盘输入落在覆盖其上的透明 input 上。
            点任意一格都会聚焦到透明 input（数字键盘），不必给四格各写光标 / 退格逻辑。
            标注 2026-08-19 18:30：四格初始不显示，点过「获取验证码」（剩余秒非 null）才出现。
          */}
          {剩余秒 !== null ? (
          <div className={样式.验证码组}>
            {Array.from({ length: 验证码格数 }, (_, 位) => {
              const 字 = 验证码[位];
              // 「聚焦格」= 下一个待输入的格，与设计稿同一判定
              const 聚焦 = 验证码.length === 位;
              return (
                <span key={位} className={`${样式.验证码格} ${聚焦 ? 样式.聚焦 : ''}`}>
                  {字 ? (
                    <span className={`${样式.验证码字} 等宽数字`}>{字}</span>
                  ) : 聚焦 ? (
                    <span className={样式.光标} />
                  ) : null}
                </span>
              );
            })}
            <input
              ref={验证码输入引用}
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
          ) : null}

          {/* 获取验证码 / 倒计时 / 重新获取 三态 */}
          {剩余秒 !== null && 剩余秒 > 0 ? (
            <span className={`${样式.倒计时} 等宽数字`}>{剩余秒}s</span>
          ) : (
            <button
              className={`${样式.取码键} 可点 ${手机号齐 ? '' : 样式.取码键灰}`}
              onClick={发验证码}
            >
              {剩余秒 === 0 ? '重新获取' : '获取验证码'}
            </button>
          )}
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

      {/* 表单与登录方式之间留空：代理引导气泡按标注意见（2026-08-18）撤掉 */}
      <div className={样式.留白区} />

      <div className={样式.分割行}>
        <span className={样式.分割线} />
        <span className={样式.分割文字}>或通过以下方式登录</span>
        <span className={样式.分割线} />
      </div>

      <div className={样式.微信区}>
        <button className={`${样式.微信键} 可点`} onClick={微信登录按下}>
          微信登录
        </button>
      </div>

      <主按钮 文字="进入" 按下={进入下一步} 禁用={!可进入} />
    </次级页外壳>
  );
}
