import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 可编辑规则行 from './可编辑规则行';

function 装载() {
  const 保存 = vi.fn(async () => {}); const 删除 = vi.fn(async () => {}); const 切换 = vi.fn(async () => {});
  function 宿主() {
    const [条, 设条] = useState({ 编号: '测试规则', 内容: '不接受频繁出差', 来源: '不展示的历史来源', 生效: true });
    return <可编辑规则行 条={条} 保存={async 内容 => { await 保存(); 设条({ ...条, 内容 }); }} 删除={删除}
      切换={async () => { await 切换(); 设条({ ...条, 生效: !条.生效 }); }} />;
  }
  render(<宿主 />); return { 保存, 删除, 切换 };
}
describe('共享规则真实交互', () => {
  it('失焦不保存、取消弃稿，启停不进入编辑', async () => {
    const user = userEvent.setup(); const 调用 = 装载();
    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByRole('textbox')).toBeNull();
    await user.click(screen.getByText('不接受频繁出差'));
    await user.clear(screen.getByRole('textbox')); await user.type(screen.getByRole('textbox'), '不出差');
    fireEvent.blur(screen.getByRole('textbox'));
    expect(调用.保存).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '取消' }));
    await user.click(screen.getByText('不接受频繁出差'));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('不接受频繁出差');
    expect(调用.切换).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('不展示的历史来源')).toBeNull();
  });
  it('组合输入和229键不提交，普通回车只提交一次', async () => {
    const user = userEvent.setup(); const 调用 = 装载();
    await user.click(screen.getByText('不接受频繁出差')); const 输入 = screen.getByRole('textbox');
    fireEvent.compositionStart(输入); fireEvent.change(输入, { target: { value: '只接受月度出差' } });
    fireEvent.keyDown(输入, { key: 'Enter' }); expect(调用.保存).not.toHaveBeenCalled();
    fireEvent.compositionEnd(输入); fireEvent.keyDown(输入, { key: 'Enter', keyCode: 229 }); expect(调用.保存).not.toHaveBeenCalled();
    await user.keyboard('{Enter}'); expect(调用.保存).toHaveBeenCalledTimes(1);
    expect(screen.getByText('只接受月度出差')).toBeTruthy();
  });
  it('全幅左滑仅揭开删除，右滑收起；取消确认不删除', async () => {
    const user = userEvent.setup(); const 调用 = 装载();
    const 行 = screen.getByText('不接受频繁出差').parentElement!;
    fireEvent.touchStart(行, { touches: [{ clientX: 350, clientY: 50 }] });
    fireEvent.touchEnd(行, { changedTouches: [{ clientX: 0, clientY: 50 }] });
    expect(调用.删除).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '删除规则：不接受频繁出差' })).toBeTruthy();
    fireEvent.touchStart(行, { touches: [{ clientX: 0, clientY: 50 }] });
    fireEvent.touchEnd(行, { changedTouches: [{ clientX: 120, clientY: 50 }] });
    expect(screen.queryByRole('button', { name: '删除规则：不接受频繁出差' })).toBeNull();
    // 新一轮指针点击，不继承触摸合成 click 的抑制标记。
    fireEvent.touchStart(行, { touches: [{ clientX: 120, clientY: 50 }] });
    fireEvent.touchEnd(行, { changedTouches: [{ clientX: 120, clientY: 50 }] });
    await user.click(screen.getByRole('button', { name: '显示删除：不接受频繁出差' }));
    await user.click(screen.getByRole('button', { name: '删除规则：不接受频繁出差' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '取消' }));
    expect(调用.删除).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '删除规则：不接受频繁出差' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '删除' }));
    expect(调用.删除).toHaveBeenCalledTimes(1);
  });
});
