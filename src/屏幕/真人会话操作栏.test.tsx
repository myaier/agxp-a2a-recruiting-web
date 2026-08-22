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
/** 层里铺什么由调用方决定，测试只需要一段能被找到的正文 */
const 简历正文占位 = '交易网关重建 32 万 QPS';

function 渲染企业端() {
  render(
    <真人会话操作栏
      主项名="看简历"
      主项图标={<span />}
      主项内容={<p>{简历正文占位}</p>}
      联系方式={联系方式}
    />
  );
}

describe('真人会话操作栏', () => {
  it('三项横铺：主项 + 电话 + 微信', () => {
    渲染企业端();
    expect(screen.getByRole('button', { name: '看简历' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '电话' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '微信' })).not.toBeNull();
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

// ── 主项：盖一层，不跳走 ──────────────────────────────────────────
// 产品负责人 2026-08-22 的反馈就是这条：看职位/看简历点了不该整屏换掉。
describe('主项的全屏详情层', () => {
  it('点主项就地盖一层，正文是调用方传进来的那份档案', async () => {
    const 用户 = userEvent.setup();
    渲染企业端();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(简历正文占位)).toBeNull();

    await 用户.click(screen.getByRole('button', { name: '看简历' }));
    expect(screen.getByRole('dialog', { name: '看简历' })).not.toBeNull();
    expect(screen.getByText(简历正文占位)).not.toBeNull();
  });

  it('底部「继续沟通」关掉层，回到聊天', async () => {
    const 用户 = userEvent.setup();
    渲染企业端();
    await 用户.click(screen.getByRole('button', { name: '看简历' }));

    await 用户.click(screen.getByRole('button', { name: '继续沟通' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(简历正文占位)).toBeNull();
    // 层关掉后操作排还在原处，会话没有被换走
    expect(screen.getByRole('button', { name: '看简历' })).not.toBeNull();
  });

  it('层关掉后电话的展开状态原样保留：盖一层不动会话本身', async () => {
    const 用户 = userEvent.setup();
    渲染企业端();
    await 用户.click(screen.getByRole('button', { name: '电话' }));
    await 用户.click(screen.getByRole('button', { name: '看简历' }));
    await 用户.click(screen.getByRole('button', { name: '继续沟通' }));
    expect(screen.getByText('138 0013 2046')).not.toBeNull();
  });

  it('焦点落在「继续沟通」上，不被正文里的控件拽着往下滚', async () => {
    const 用户 = userEvent.setup();
    渲染企业端();
    await 用户.click(screen.getByRole('button', { name: '看简历' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '继续沟通' }));
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
