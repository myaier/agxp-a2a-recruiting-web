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

  it('三项互斥：点主项开层会把展开的联系卡收掉（标注 2026-08-24）', async () => {
    const 用户 = userEvent.setup();
    渲染企业端();
    await 用户.click(screen.getByRole('button', { name: '电话' }));
    expect(screen.getByText('138 0013 2046')).not.toBeNull();

    await 用户.click(screen.getByRole('button', { name: '看简历' }));
    await 用户.click(screen.getByRole('button', { name: '继续沟通' }));
    // 层关掉后联系卡不复原 —— 同时最多亮一项
    expect(screen.queryByText('138 0013 2046')).toBeNull();
  });

  it('焦点落在「继续沟通」上，不被正文里的控件拽着往下滚', async () => {
    const 用户 = userEvent.setup();
    渲染企业端();
    await 用户.click(screen.getByRole('button', { name: '看简历' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '继续沟通' }));
  });
});

// ── 交换模式（直聊）────────────────────────────────────────────
describe('交换模式', () => {
  function 渲染直聊端(已换: ('电话' | '微信')[], 换 = vi.fn()) {
    render(
      <真人会话操作栏
        主项名="看职位"
        主项图标={<span />}
        主项内容={<p>岗位正文占位</p>}
        联系方式={联系方式}
        交换={{ 已换, 换 }}
      />
    );
    return 换;
  }

  it('没换过时按钮带「换」字，首次点先回调 换 并当场展开号码', async () => {
    const 用户 = userEvent.setup();
    const 换 = 渲染直聊端([]);
    expect(screen.getByRole('button', { name: '换电话' })).not.toBeNull();

    await 用户.click(screen.getByRole('button', { name: '换电话' }));
    expect(换).toHaveBeenCalledWith('电话');
    expect(screen.getByText('138 0013 2046')).not.toBeNull();
  });

  it('换过之后名字落回「电话」，行为与看模式一致（点开点收）', async () => {
    const 用户 = userEvent.setup();
    const 换 = 渲染直聊端(['电话']);
    const 钮 = screen.getByRole('button', { name: '电话' });
    await 用户.click(钮);
    expect(screen.getByText('138 0013 2046')).not.toBeNull();
    await 用户.click(钮);
    expect(screen.queryByText('138 0013 2046')).toBeNull();
    expect(换).not.toHaveBeenCalled();
  });
});

// ── 双盲铁律的静态守卫 ────────────────────────────────────────────
// 意向确认前的直聊挂上「看」模式的这一排 = 当场破盲（实值直陈、没有交换动作）。
// 2026-08-24 边界收窄：直聊有了自己的顶部交换排（「换」语义，点了才换才展开），
// 它复用本组件的 CSS 与联系卡是允许的 —— 禁的只是把组件本身挂过去。
describe('双盲边界', () => {
  it('直聊会话挂操作排必须带 交换 模式 —— 「看」模式（实值直陈）会当场破盲', () => {
    expect(直聊会话源码.includes('import 真人会话操作栏 from')).toBe(true);
    expect(直聊会话源码.includes('交换={{')).toBe(true);
  });

  it('确认后的两屏真人会话不许带 交换 —— 双盲已解除，再让用户「换」是造假环节', () => {
    expect(真人会话源码.includes('交换={{')).toBe(false);
    expect(企业真人会话源码.includes('交换={{')).toBe(false);
  });

  it('两屏真人会话都挂了顶部操作排', () => {
    expect(真人会话源码.includes('真人会话操作栏')).toBe(true);
    expect(企业真人会话源码.includes('真人会话操作栏')).toBe(true);
  });
});

// ── P7 Task 4：判别联合属性 —— Backend 只带主项按下（导航/取件回调），不带联系方式 ──
describe('P7 判别联合属性', () => {
  it('Backend：无联系方式时不渲染电话/微信；主项按下直接回调，不盖层', async () => {
    const 用户 = userEvent.setup();
    const 主项按下 = vi.fn();
    render(
      <真人会话操作栏
        主项名="看职位"
        主项图标={<span />}
        主项按下={主项按下}
      />
    );
    expect(screen.queryByRole('button', { name: '电话' })).toBeNull();
    expect(screen.queryByRole('button', { name: '微信' })).toBeNull();
    expect(screen.queryByText('138 0013 2046')).toBeNull();
    await 用户.click(screen.getByRole('button', { name: '看职位' }));
    expect(主项按下).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('主项内容（Mock）仍盖全屏层且行为不变', async () => {
    const 用户 = userEvent.setup();
    render(
      <真人会话操作栏
        主项名="看简历"
        主项图标={<span />}
        主项内容={<p>{简历正文占位}</p>}
        联系方式={联系方式}
      />
    );
    await 用户.click(screen.getByRole('button', { name: '看简历' }));
    expect(screen.getByRole('dialog', { name: '看简历' })).not.toBeNull();
    expect(screen.getByText(简历正文占位)).not.toBeNull();
  });
});
