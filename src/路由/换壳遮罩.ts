// 换壳遮罩 —— 注册流走完切主壳的那一瞬间，用一层不透明底色把「退历史栈」的中间态盖住。
//
// ── 为什么需要它 ──
// 产品负责人 2026-08-22 原话：「我在 onboarding 上传头像之后，应该会进到主页。
// 但是突然会有一个配置页面闪出来，然后才是主页，把这个 bug 修一下」。
//
// 那一闪来自 导航钩子.清栈进()：它先 history.go(-当前格) 退回本次会话第一格，
// 再等 popstate 落定，把那一格 replace 成主壳。问题在于退栈的落点是一屏真实存在的页面
// （本次会话从哪一格开始就是哪一屏：从头走是登录页，中途刷新过就是刷新时停的那一屏，
// 比如「完善资料」—— 产品负责人看到的「配置页面」就是它），React 会老老实实把它渲染出来。
// 逐帧录屏实测：中间有约 150ms 画的就是那一屏，肉眼一清二楚。
//
// 退栈本身不能取消 —— 51b6f20 那条修复（进主壳后按后退键不能退回 #/disclosure）
// 正是靠退栈实现的，取消退栈等于把那个 bug 放回来。所以这里的做法是把退栈这段时间遮住：
// 遮罩在 history.go() 之前就已经挂进 DOM（晚一帧就还是会闪），
// 等目标屏真正渲染并画到屏幕上之后才撤。用户看到的就是「头像页 → 主页」。
//
// ── 为什么遮罩是命令式插 DOM，而不是一个 React 状态 ──
// 触发退栈和渲染中间屏是同一个事件循环里的事：走 React 状态的话，遮罩最快也只能和
// 中间屏在同一次渲染里出现，赶不上「先盖住再退栈」。命令式 appendChild 是唯一能保证
// 「遮罩已经在 DOM 里，React 才开始重渲染」的做法。
//
// ── 为什么撤遮罩要交给 React ──
// react-router 的 HashRouter 把地址变更包在 startTransition 里，而主壳 / 企业主壳都是
// lazy 分包：分包没拉回来之前 React 不提交这次 transition，屏幕上留着的仍然是中间那一屏。
// 所以「replace 发出去了」不等于「目标屏出现了」，只能等 useLocation 真的读到目标地址
// （见 换壳遮罩看守）才撤。定时器只作兜底，不作正常路径。

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import 样式 from './换壳遮罩.module.css';

/** 遮罩节点上的标记属性。逐帧验证脚本靠它判断「这一帧是被遮住的」 */
const 遮罩标记 = 'data-换壳遮罩';

/** 设备外框在机身层（真机形态下是全屏层）标出的挂载点，遮罩挂进去正好盖住机身内的一切 */
const 挂载点选择器 = '[data-遮罩挂载点]';

/**
 * 等 popstate 的上限。
 *
 * history.go() 是异步的：浏览器把「回退 N 格」排进任务队列，主线程忙的时候要几十毫秒
 * 才落定（本机逐帧实测约 40ms）。800ms 给到实测值的 20 倍余量，正常情况下永远用不到。
 * 真的等到 800ms 还没来，基本只剩「history.state 被外部改写、格号算错，退栈根本不会发生」
 * 这一种可能 —— 这时继续干等只会让用户对着一块纯色，不如直接 replace 到目标先把人送进主页。
 */
const 等退栈毫秒 = 800;

/**
 * 遮罩存在的绝对上限。
 *
 * 退栈落定之后还要等目标屏渲染出来：主壳 / 企业主壳都是 lazy 分包，冷启动要现拉 chunk，
 * 弱网下几百毫秒很常见，所以这个上限必须明显大于 等退栈毫秒 + 一次分包请求。
 * 2500ms 是「弱网拉一个分包」的宽裕上限；同时它短到即使前面所有机制全部失效，
 * 用户最多看 2.5 秒纯色就会回到可用界面 —— 绝不会出现永久卡白屏。
 */
const 遮罩上限毫秒 = 2500;

/** 当前挂在 DOM 上的遮罩节点。同一时刻最多一个 */
let 遮罩节点: HTMLDivElement | null = null;

/** 正在进行的一次换壳。同一时刻最多一单，新的一单会先把旧的结掉 */
let 进行中: { 目标: string; 收尾: () => void } | null = null;

/**
 * 找遮罩的挂载点。
 *
 * 拿不到就退到 document.body：单测里直接渲染某一屏、外面没有设备外框时会走到这条。
 * 这是有意的降级而不是被吞掉的错误 —— 那种场景下页面本来就没有机身，body 就是整屏。
 */
function 找挂载点(): HTMLElement {
  return document.querySelector<HTMLElement>(挂载点选择器) ?? document.body;
}

function 盖上遮罩(): void {
  if (遮罩节点) return;
  const 挂载点 = 找挂载点();
  const 节点 = document.createElement('div');
  节点.setAttribute(遮罩标记, '');
  节点.className = 样式.遮罩;
  // body 兜底路径上挂载点不是定位祖先，absolute 铺不满，得换 fixed
  if (挂载点 === document.body) 节点.classList.add(样式.铺满视口);
  // 遮罩是纯视觉的一层，读屏软件不该念它，上面也不该有任何文字
  节点.setAttribute('aria-hidden', 'true');
  挂载点.appendChild(节点);
  遮罩节点 = 节点;
}

function 撤下遮罩(): void {
  遮罩节点?.remove();
  遮罩节点 = null;
}

/**
 * 遮住退栈换壳：盖上遮罩 → 退到本次会话第一格 → 把那一格 replace 成目标 → 目标画出来后撤遮罩。
 *
 * @param 目标 换完壳要落在哪个地址（主壳 / 企业主壳）
 * @param 后退格数 要弹掉几格历史，取自 react-router 写在 history.state 上的 idx
 * @param 前往 useNavigate() 返回的跳转函数，由调用方（导航钩子）传进来
 */
export function 遮住退栈换壳(
  目标: string,
  后退格数: number,
  前往: (目标: string, 选项?: { replace?: boolean }) => void,
): void {
  // 上一单还没结（用户连点两下之类）先结掉，避免两单抢同一个遮罩
  进行中?.收尾();

  盖上遮罩();

  let 已发replace = false;
  /** replace 是幂等的：谁先到谁发，后到的直接跳过 */
  const 发replace = () => {
    if (已发replace) return;
    已发replace = true;
    前往(目标, { replace: true });
  };

  const 收到退栈 = () => 发replace();
  window.addEventListener('popstate', 收到退栈);

  let 等退栈定时器 = 0;
  let 兜底定时器 = 0;

  const 收尾 = () => {
    window.clearTimeout(等退栈定时器);
    window.clearTimeout(兜底定时器);
    window.removeEventListener('popstate', 收到退栈);
    撤下遮罩();
    进行中 = null;
  };

  等退栈定时器 = window.setTimeout(() => {
    // popstate 迟迟不来：不再干等，先把人送到目标。
    // 这里刻意不摘 popstate 监听 —— 万一退栈只是迟到，它落地时会把地址打回第一格，
    // 留着监听就能再 replace 回来（发replace 幂等，重复触发无副作用）。
    发replace();
  }, 等退栈毫秒);

  兜底定时器 = window.setTimeout(() => {
    // 最后一道闸：目标屏迟迟不出现（分包拉不回来、transition 一直不提交……）
    // 也必须把遮罩撤掉并保证 replace 已经发出，绝不让用户永久卡在一块纯色上。
    发replace();
    收尾();
  }, 遮罩上限毫秒);

  进行中 = { 目标, 收尾 };

  window.history.go(-后退格数);
}

/**
 * 地址落到目标屏了没？到了就收尾（撤遮罩 + 清定时器 + 摘监听）。
 *
 * 退栈过程中会先落到注册流第一格，那也是一次地址变更 —— 所以必须比对目标，
 * 不能「地址一变就撤」。
 */
export function 落点抵达(当前路径: string): void {
  if (!进行中) return;
  if (当前路径 !== 进行中.目标) return;
  进行中.收尾();
}

/**
 * 看守：挂在路由里（不在 Routes 内，换屏时不会被卸载），
 * 地址每次真正提交就检查一次「是不是已经落到目标屏了」。
 *
 * 用 useEffect（被动副作用）而不是 useLayoutEffect：被动副作用跑在浏览器把这一帧画完之后，
 * 也就是目标屏已经实实在在画在屏幕上了，这时候撤遮罩不会露出任何中间态。
 */
export function 换壳遮罩看守(): null {
  const 位置 = useLocation();

  useEffect(() => {
    落点抵达(位置.pathname + 位置.search);
  }, [位置]);

  return null;
}
