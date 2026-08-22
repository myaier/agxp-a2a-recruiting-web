// 换壳遮罩的回归测试。守的是产品负责人 2026-08-22 报的那条：
// 「上传头像之后……突然会有一个配置页面闪出来，然后才是主页」。
//
// 这里测的是时序，不是外观 —— 闪屏 bug 的本质就是时序，只断言「最后落在主页」验不出来。

import { afterEach, describe, expect, it, vi } from 'vitest';

/** 每条用例都重新载入模块：换壳遮罩用模块级变量记「当前那一单」，不隔离会串味 */
async function 载入换壳遮罩() {
  vi.resetModules();
  return import('./换壳遮罩');
}

function 查遮罩() {
  return document.querySelector('[data-换壳遮罩]');
}

function 造挂载点() {
  const 节点 = document.createElement('div');
  节点.setAttribute('data-遮罩挂载点', '');
  document.body.appendChild(节点);
  return 节点;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('换壳遮罩', () => {
  it('遮罩必须在 history.go 之前就挂进 DOM —— 晚一帧就会闪出中间那一屏', async () => {
    const { 遮住退栈换壳 } = await 载入换壳遮罩();
    造挂载点();

    /** 记录 history.go 被调用的「那一刻」DOM 里有没有遮罩 */
    let 退栈时已有遮罩: boolean | null = null;
    const 退栈 = vi.spyOn(window.history, 'go').mockImplementation(() => {
      退栈时已有遮罩 = Boolean(查遮罩());
    });

    遮住退栈换壳('/app', 13, vi.fn());

    expect(退栈).toHaveBeenCalledWith(-13);
    expect(退栈时已有遮罩).toBe(true);
  });

  it('遮罩挂在设备外框标出的挂载点里，且不带任何文字', async () => {
    const { 遮住退栈换壳 } = await 载入换壳遮罩();
    const 挂载点 = 造挂载点();
    vi.spyOn(window.history, 'go').mockImplementation(() => {});

    遮住退栈换壳('/app', 3, vi.fn());

    const 遮罩 = 查遮罩();
    expect(遮罩?.parentElement).toBe(挂载点);
    // 产品负责人明令禁止自创小文案：遮罩上一个字都不能有
    expect(遮罩?.textContent).toBe('');
    expect(遮罩?.getAttribute('aria-hidden')).toBe('true');
  });

  it('popstate 落定就 replace 到目标，但遮罩要留到目标屏真的渲染出来', async () => {
    const { 遮住退栈换壳, 落点抵达 } = await 载入换壳遮罩();
    造挂载点();
    vi.spyOn(window.history, 'go').mockImplementation(() => {});
    const 前往 = vi.fn();

    遮住退栈换壳('/app', 5, 前往);
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(前往).toHaveBeenCalledWith('/app', { replace: true });
    // 关键：replace 发出去了不等于目标屏出现了（主壳是 lazy 分包，transition 还没提交）
    expect(查遮罩()).not.toBeNull();

    落点抵达('/app');
    expect(查遮罩()).toBeNull();
  });

  it('中途落到别的地址不撤遮罩 —— 退栈落点本身就是一个「别的地址」', async () => {
    const { 遮住退栈换壳, 落点抵达 } = await 载入换壳遮罩();
    造挂载点();
    vi.spyOn(window.history, 'go').mockImplementation(() => {});

    遮住退栈换壳('/app', 5, vi.fn());
    落点抵达('/'); // 退栈落到注册流第一格（登录屏 / 完善资料）
    expect(查遮罩()).not.toBeNull();
  });

  it('popstate 一直不来：到点也要把人送到目标，不能干等', async () => {
    vi.useFakeTimers();
    const { 遮住退栈换壳 } = await 载入换壳遮罩();
    造挂载点();
    vi.spyOn(window.history, 'go').mockImplementation(() => {});
    const 前往 = vi.fn();

    遮住退栈换壳('/app', 5, 前往);
    expect(前往).not.toHaveBeenCalled();

    vi.advanceTimersByTime(800);
    expect(前往).toHaveBeenCalledWith('/app', { replace: true });
  });

  it('目标屏一直不出现：兜底超时无条件撤遮罩，绝不永久卡白屏', async () => {
    vi.useFakeTimers();
    const { 遮住退栈换壳 } = await 载入换壳遮罩();
    造挂载点();
    vi.spyOn(window.history, 'go').mockImplementation(() => {});
    const 前往 = vi.fn();

    遮住退栈换壳('/app', 5, 前往);
    vi.advanceTimersByTime(2500);

    expect(查遮罩()).toBeNull();
    expect(前往).toHaveBeenCalledWith('/app', { replace: true });
  });

  it('replace 只发一次：popstate 与超时抢着触发也不会重复跳', async () => {
    vi.useFakeTimers();
    const { 遮住退栈换壳 } = await 载入换壳遮罩();
    造挂载点();
    vi.spyOn(window.history, 'go').mockImplementation(() => {});
    const 前往 = vi.fn();

    遮住退栈换壳('/app', 5, 前往);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
    vi.advanceTimersByTime(2500);

    expect(前往).toHaveBeenCalledTimes(1);
  });

  it('收尾之后摘掉 popstate 监听，不再影响后续的后退键', async () => {
    const { 遮住退栈换壳, 落点抵达 } = await 载入换壳遮罩();
    造挂载点();
    vi.spyOn(window.history, 'go').mockImplementation(() => {});
    const 前往 = vi.fn();

    遮住退栈换壳('/app', 5, 前往);
    window.dispatchEvent(new PopStateEvent('popstate'));
    落点抵达('/app');
    前往.mockClear();

    // 用户后来自己按后退键：不该再被这次换壳的监听劫持
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(前往).not.toHaveBeenCalled();
  });

  it('没有设备外框时退到 body，并改用铺满视口的定位（单测 / 裸渲染场景）', async () => {
    const { 遮住退栈换壳 } = await 载入换壳遮罩();
    vi.spyOn(window.history, 'go').mockImplementation(() => {});

    遮住退栈换壳('/app', 2, vi.fn());

    const 遮罩 = 查遮罩();
    expect(遮罩?.parentElement).toBe(document.body);
    expect(遮罩?.className).toContain('铺满视口');
  });
});
