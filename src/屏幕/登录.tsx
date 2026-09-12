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

import { useCallback, useEffect, useRef, useState } from 'react';
import 样式 from './登录.module.css';
import { 次级页外壳 } from '../组件/通用';
import 代理标 from '../组件/代理标';
import { 对勾图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { 取后端错误文案 } from '../数据/HTTP客户端';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 路径 } from '../路由/路径表';
import { 短信验证码位数 } from '../数据/验证码规则';
import { 构造登录手机号, 规范化登录区号 } from '../数据/登录手机号';
import 弹层框架 from '../组件/弹层框架';

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
  const [区号, 设区号] = useState('+86');
  const [区号层开, 设区号层开] = useState(false);
  const [区号草稿, 设区号草稿] = useState('+86');
  const [区号错误, 设区号错误] = useState('');
  const [验证码, 设验证码] = useState('');
  const [已同意, 设已同意] = useState(false);
  // 倒计时剩余秒数：null = 还没发过验证码；0 = 跑完可重发
  const [剩余秒, 设剩余秒] = useState<number | null>(null);
  // Backend 登录提交的可见等待态：按钮换字并禁用（同步 ref 守卫之外的用户反馈）
  const [正在进入, 设正在进入] = useState(false);
  const [正在取码, 设正在取码] = useState(false);
  const [有效取码, 设有效取码] = useState(false);
  const 验证码输入引用 = useRef<HTMLInputElement>(null);
  // Backend 三个按钮的重复点击守卫（取码/微信仍纯 ref 不动 UI；登录提交另有 正在进入 可见态）
  const 取码中 = useRef(false);
  const 进入中 = useRef(false);
  const 微信中 = useRef(false);
  const 已取码号码 = useRef<string | null>(null);
  const 挂载中 = useRef(true);
  const 聚焦定时 = useRef<ReturnType<typeof setTimeout> | null>(null);

  let 完整手机号: string | null = null;
  try {
    完整手机号 = 构造登录手机号(手机号数字, 区号);
  } catch {
    完整手机号 = null;
  }
  const 手机号齐 = 完整手机号 !== null;
  const 验证码齐 = 验证码.length === 验证码格数;
  const 有可用挑战 = 数据源模式 === 'mock' || 有效取码;
  const 可进入 = 手机号齐 && 验证码齐 && 已同意 && 有可用挑战;
  const 交互锁定 = 正在取码 || 正在进入;

  const 取消区号编辑 = useCallback(() => {
    设区号错误('');
    设区号层开(false);
  }, []);

  const 作废已取码 = useCallback(() => {
    if (已取码号码.current === null) return;
    已取码号码.current = null;
    设有效取码(false);
    设验证码('');
    if (数据源模式 === 'backend') 操作.取消手机登录尝试();
  }, [数据源模式, 操作]);

  // 真倒计时：每秒 -1，归零停
  useEffect(() => {
    if (剩余秒 === null || 剩余秒 <= 0) return;
    const 定时 = setTimeout(() => 设剩余秒(剩余秒 - 1), 1000);
    return () => clearTimeout(定时);
  }, [剩余秒]);

  useEffect(() => {
    挂载中.current = true;
    return () => {
      挂载中.current = false;
      if (聚焦定时.current !== null) clearTimeout(聚焦定时.current);
      // begin 退出后必须作废；已提交的 complete 则继续由 Provider 水合并提交登录态。
      if (数据源模式 === 'backend' && !进入中.current) {
        操作.取消手机登录尝试();
      }
    };
  }, [数据源模式, 操作]);

  const 更新手机号 = (原始值: string) => {
    const 下一值 = /^[0-9 ()-]*$/.test(原始值) ? 原始值.replace(/[ ()-]/g, '') : 原始值;
    if (已取码号码.current !== null) {
      let 下一完整号码: string | null = null;
      try {
        下一完整号码 = 构造登录手机号(下一值, 区号);
      } catch {
        下一完整号码 = null;
      }
      if (下一完整号码 !== 已取码号码.current) 作废已取码();
    }
    设手机号数字(下一值);
  };

  const 打开区号编辑 = () => {
    设区号草稿(区号);
    设区号错误('');
    设区号层开(true);
  };

  const 确认区号 = () => {
    try {
      const 下一区号 = 规范化登录区号(区号草稿);
      if (下一区号 !== 区号) {
        作废已取码();
        设区号(下一区号);
      }
      取消区号编辑();
    } catch (错误) {
      设区号错误(错误 instanceof Error ? 错误.message : '区号不正确');
    }
  };

  const 发验证码 = () => {
    if (!手机号齐) {
      轻提示(区号 === '+86' ? '先输入 11 位手机号' : '请输入有效的手机号');
      return;
    }
    if (剩余秒 !== null && 剩余秒 > 0) return; // 倒计时中不可重发
    if (数据源模式 === 'backend') {
      if (取码中.current) return;
      取码中.current = true;
      设正在取码(true);
      设有效取码(false);
      已取码号码.current = null;
      // 验证码格先亮起来（视觉反馈），但倒计时等请求成功才启动：
      // 原来先设 剩余秒 再发请求，请求失败时 60s 倒计时仍在跑、用户无法重发，
      // 且验证码格亮着却没有合法 attempt_id。失败时把视觉反馈复位以便重试。
      设验证码('');
      操作.开始手机登录(手机号数字, 区号)
        .then(() => {
          if (!挂载中.current) return;
          已取码号码.current = 完整手机号;
          设有效取码(true);
          设剩余秒(倒计时秒数);
          轻提示('验证码已发送');
          // 验证码格在 剩余秒 非 null 后才渲染，焦点等成功后再送进去，
          // 避免网络延迟下输入格还没渲染就 focus（#8）。
          聚焦定时.current = setTimeout(() => 验证码输入引用.current?.focus(), 80);
        })
        .catch((错误) => {
          if (!挂载中.current) return;
          // 失败时复位视觉反馈：剩余秒 归 null（可重发），验证码清空，
          // 不留 0 秒 + 旧 attempt 的脏态（#6）
          设剩余秒(null);
          设验证码('');
          设有效取码(false);
          轻提示(取后端错误文案(错误));
        })
        .finally(() => {
          取码中.current = false;
          if (挂载中.current) 设正在取码(false);
        });
      return;
    }
    设剩余秒(倒计时秒数);
    设验证码('');
    设有效取码(true);
    已取码号码.current = 完整手机号;
    轻提示('验证码已发送（原型不校验，任意 4 位数字即可）');
    // 发完码直接把焦点送进验证码格，弹数字键盘
    聚焦定时.current = setTimeout(() => 验证码输入引用.current?.focus(), 80);
  };

  const 进入下一步 = async () => {
    if (!可进入) {
      if (!手机号齐) 轻提示(区号 === '+86' ? '先输入 11 位手机号' : '请输入有效的手机号');
      else if (!验证码齐) 轻提示('输入 4 位验证码');
      else 轻提示('先勾选用户协议');
      return;
    }
    if (数据源模式 === 'backend') {
      if (进入中.current) return;
      进入中.current = true;
      设正在进入(true);
      try {
        // 完成登录原样发送 4 位 code；attempt_id 由 Provider 保存。
        // P0 修复 Task 3：登录页不再自己导航 —— 会话在 操作.完成手机登录 内部
        // 水合完角色才提交，落点（主壳/选身份/注册流名片）归 应用.tsx 的水合守卫独占。
        await 操作.完成手机登录(验证码);
      } catch (错误) {
        if (!挂载中.current) return;
        轻提示(取后端错误文案(错误));
      } finally {
        进入中.current = false;
        if (挂载中.current) 设正在进入(false);
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
      {/* 整页渐变底（登录改版「工作证」，2026-09-03 用户定稿）：
          主页渐变头的同一笔 —— 荧光绿斜向渐变 + 右上天蓝光斑，铺满整屏后落到淡绿底，
          登录完进主页不跳戏 */}
      <div className={样式.渐变底} aria-hidden />

      {/* 工牌卡：整个登录表单装在一张挂着的「工作证」里。
          用户 2026-09-03 定的尺度：一张卡 + 卡顶一条槽孔暗示是工牌，不要挂绳、金属夹、
          照片位这些装饰（「找工作的软件不该太花哨，但不能没有记号」）。
          「进入」做成卡底的荧光绿色带，和 App 主按钮同色。 */}
      <div className={样式.证卡}>
        <span className={样式.穿孔} aria-hidden />

        {/* 卡头：代理标线描小标 + 产品名同一行。
            2026-08-24 定名「工作蜂」；slogan 由产品负责人 2026-09-03 定为「AI找工作，就用工作蜂」，不自拟文案 */}
        <div className={样式.品牌行}>
          <代理标
            尺寸={22}
            脸色="#ffffff"
            眼色="var(--深绿文字)"
            描边色="var(--深绿文字)"
            描边宽={3}
          />
          <h1 className={样式.产品名}>工作蜂</h1>
        </div>
        <p className={样式.主张}>AI找工作，就用工作蜂</p>

        {/* 表单：上一行手机号、下一行验证码四格 + 获取验证码 */}
        <div className={样式.手机行}>
          <button
            className={`${样式.区号} 可点`}
            onClick={打开区号编辑}
            aria-label={`编辑区号，当前 ${区号}`}
            disabled={交互锁定}
          >
            {区号} <span className={样式.区号箭头}>▾</span>
          </button>
          <span className={样式.竖线} />
          <input
            className={`${样式.手机输入} 等宽数字`}
            value={区号 === '+86' && /^\d{0,11}$/.test(手机号数字) ? 格式化手机号(手机号数字) : 手机号数字}
            placeholder="输入手机号"
            // 只留数字：粘贴带空格 / 横线 / 括号的号码自动洗干净
            onChange={(事件) => 更新手机号(事件.target.value)}
            disabled={交互锁定}
            inputMode="tel"
            autoComplete="tel"
            aria-label="手机号"
          />
        </div>

        {/* 没取码时这一行只有一条底线 + 右侧「获取验证码」，读起来是第二个输入行；
            取码后四格各带自己的短底线，长线让位 */}
        <div className={`${样式.验证码行} ${剩余秒 === null ? 样式.待取码 : ''}`}>
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
              disabled={交互锁定 || !有可用挑战}
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
              disabled={交互锁定}
            >
              {正在取码 ? '正在发送…' : 剩余秒 === 0 ? '重新获取' : '获取验证码'}
            </button>
          )}
        </div>

        {/* 协议勾选：未勾则卡底「进入」禁用 */}
        <button
          className={`${样式.同意行} 可点`}
          onClick={() => 设已同意((旧) => !旧)}
          aria-pressed={已同意}
          disabled={交互锁定}
        >
          <span className={`${样式.勾选圈} ${已同意 ? '' : 样式.未选}`}>
            {已同意 ? <对勾图标 尺寸={9} 色="#fff" 线宽={3.6} /> : null}
          </span>
          <span className={样式.同意文字}>
            已阅读并同意 <span className={样式.链接}>《用户协议》</span> 与{' '}
            <span className={样式.链接}>《隐私与分层披露政策》</span>
          </span>
        </button>

        {/* 卡底色带 = 主按钮「进入」。Backend 提交中换字并禁用；Mock 分支即点即进 */}
        <button
          className={`${样式.进入带} 可点`}
          onClick={进入下一步}
          disabled={!可进入 || 正在进入}
        >
          <span>{正在进入 ? '正在进入…' : '进入'}</span>
          <span className={样式.进入箭头} aria-hidden>
            →
          </span>
        </button>
      </div>

      <div className={样式.分割行}>
        <span className={样式.分割线} />
        <span className={样式.分割文字}>或通过以下方式登录</span>
        <span className={样式.分割线} />
      </div>

      <div className={样式.微信区}>
        <button className={`${样式.微信键} 可点`} onClick={微信登录按下} disabled={交互锁定}>
          微信登录
        </button>
      </div>

      {区号层开 ? (
        <弹层框架
          标签="编辑登录区号"
          遮罩类名={样式.区号遮罩}
          面板类名={样式.区号层}
          位置="居中"
          关闭={取消区号编辑}
        >
          <h2 className={样式.区号标题}>编辑登录区号</h2>
          <label className={样式.区号标签}>
            区号
            <input
              className={`${样式.区号输入} 等宽数字`}
              value={区号草稿}
              onChange={(事件) => {
                设区号草稿(事件.target.value);
                设区号错误('');
              }}
              aria-label="区号"
              inputMode="tel"
            />
          </label>
          {区号错误 ? <p className={样式.区号错误} role="alert">{区号错误}</p> : null}
          <div className={样式.区号操作}>
            <button type="button" className={样式.区号取消} onClick={取消区号编辑}>取消</button>
            <button type="button" className={样式.区号确认} onClick={确认区号}>确认区号</button>
          </div>
        </弹层框架>
      ) : null}
    </次级页外壳>
  );
}
