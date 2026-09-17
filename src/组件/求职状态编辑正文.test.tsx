// 求职状态三态受控正文（合同 B / Spec §6）：只画三个真实身份选项，保存/取消/路由由页面承担。
// 这里钉三态绘制、aria-pressed 预选、点击回传，以及「不出现 onboarding 到岗语义」的边界 ——
// 到岗节奏等档位是注册旅程的另一种采集，不映射成 profile 的三个合法状态值。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 求职状态编辑正文 from './求职状态编辑正文';

const 三态 = ['在校', '在职', '离职'] as const;

describe('求职状态编辑正文 · 三态绘制', () => {
  it('只画 在校/在职/离职 三个选项，不含到岗节奏等 onboarding 语义', () => {
    render(<求职状态编辑正文 值="" 修改={() => {}} />);
    for (const 档 of 三态) expect(screen.getByRole('button', { name: 档 })).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByText(/到岗/)).toBeNull();
    expect(screen.queryByText(/看机会|保密求职|随便看看|随时到岗/)).toBeNull();
  });

  it('空值不假选：三个选项都是 aria-pressed=false', () => {
    render(<求职状态编辑正文 值="" 修改={() => {}} />);
    for (const 档 of 三态) {
      expect(screen.getByRole('button', { name: 档 }).getAttribute('aria-pressed')).toBe('false');
    }
  });

  it.each(['在校', '在职', '离职'] as const)('值 %s 时只有它被预选', (当前) => {
    render(<求职状态编辑正文 值={当前} 修改={() => {}} />);
    for (const 档 of 三态) {
      expect(screen.getByRole('button', { name: 档 }).getAttribute('aria-pressed')).toBe(String(档 === 当前));
    }
  });

  it('点击回传三态之一，组件自己不保存不导航', async () => {
    const 修改 = vi.fn();
    render(<求职状态编辑正文 值="在职" 修改={修改} />);
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '离职' }));
    expect(修改).toHaveBeenCalledWith('离职');
    expect(修改).toHaveBeenCalledTimes(1);
  });
});
