import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 真人会话操作栏 from './真人会话操作栏';
// ?raw 把这三个屏的源码当字符串取进来，用于下方「双盲边界」的源码级断言。
// 走 Vite 的 raw 导入而不是 node:fs —— 应用这边的 tsconfig 只挂了 vite/client 类型，
// 为一条测试把 node 类型塞进来会顺带放宽整个前端代码的类型检查。
import 直聊会话源码 from './直聊会话.tsx?raw';
import 真人会话源码 from './真人会话.tsx?raw';
import 企业真人会话源码 from './企业真人会话.tsx?raw';

const 联系方式 = { 电话: '138 0013 2046', 微信: 'shenyz_88' };

function 渲染企业端(主项打开 = vi.fn()) {
  render(
    <真人会话操作栏
      主项名="看简历"
      主项图标={<span />}
      主项打开={主项打开}
      联系方式={联系方式}
    />
  );
  return 主项打开;
}

describe('真人会话操作栏', () => {
  it('三项横铺：主项 + 电话 + 微信', () => {
    渲染企业端();
    expect(screen.getByRole('button', { name: '看简历' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '电话' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '微信' })).not.toBeNull();
  });

  it('主项是跳转不是展开：点一下就把落点回调交出去', async () => {
    const 用户 = userEvent.setup();
    const 打开 = 渲染企业端();
    await 用户.click(screen.getByRole('button', { name: '看简历' }));
    expect(打开).toHaveBeenCalledOnce();
  });

  it('电话点开直接看到号码，再点一次收起', async () => {
    const 用户 = userEvent.setup();
    渲染企业端();
    expect(screen.queryByText('138 0013 2046')).toBeNull();

    await 用户.click(screen.getByRole('button', { name: '电话' }));
    expect(screen.getByText('138 0013 2046')).not.toBeNull();

    await 用户.click(screen.getByRole('button', { name: '电话' }));
    expect(screen.queryByText('138 0013 2046')).toBeNull();
  });

  it('同时最多展开一项：点微信会把电话换下去', async () => {
    const 用户 = userEvent.setup();
    渲染企业端();
    await 用户.click(screen.getByRole('button', { name: '电话' }));
    await 用户.click(screen.getByRole('button', { name: '微信' }));
    expect(screen.getByText('shenyz_88')).not.toBeNull();
    expect(screen.queryByText('138 0013 2046')).toBeNull();
  });

  it('展开的联系行复用直聊会话的联系卡：点一下复制到剪贴板', async () => {
    const 用户 = userEvent.setup();
    // navigator.clipboard 是只读访问器，Object.assign 装不上去；而且 userEvent.setup()
    // 自己也会挂一份桩，所以必须 setup 之后再用 defineProperty 覆盖
    const 写剪贴板 = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: 写剪贴板 },
      configurable: true,
    });
    渲染企业端();

    await 用户.click(screen.getByRole('button', { name: '电话' }));
    await 用户.click(screen.getByText('138 0013 2046'));
    // 号码里的空格是给人看的，复制出去必须是可直接拨的纯数字
    expect(写剪贴板).toHaveBeenCalledWith('13800132046');
  });

  it('文案只放操作名，不出现「换 / 申请 / 求」这类请求语义', async () => {
    const 用户 = userEvent.setup();
    渲染企业端();
    await 用户.click(screen.getByRole('button', { name: '电话' }));
    const 全文 = document.body.textContent ?? '';
    for (const 禁词 of ['换', '申请', '求']) {
      expect(全文.includes(禁词)).toBe(false);
    }
  });
});

// ── 双盲铁律的静态守卫 ────────────────────────────────────────────
// 意向确认前的匿名直聊挂上这一排 = 当场破盲，而这种错误在跑起来之前看不出来，
// 所以在这里做源码级断言：直聊会话.tsx 一旦 import 真人会话操作栏，这条测试就红。
describe('双盲边界', () => {
  it('匿名直聊（直聊会话.tsx）不得引入顶部操作排', () => {
    expect(直聊会话源码.includes('真人会话操作栏')).toBe(false);
  });

  it('两屏真人会话都挂了顶部操作排', () => {
    expect(真人会话源码.includes('真人会话操作栏')).toBe(true);
    expect(企业真人会话源码.includes('真人会话操作栏')).toBe(true);
  });
});
