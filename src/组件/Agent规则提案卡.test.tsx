// P6 Task 5：Agent规则提案卡 的闭合展示契约。
// 状态机逐条对齐设计 §7.3：interpreting 只有进度文案、无任何动作键；
// ready 展示 normalized_text + 冻结的 consequence 安全摘要 + 「放弃/确认规则」；
// failed 是固定失败文案 + 关闭；accepted|dismissed 整卡不渲染。
// 卡片不显示 confidence / clauses / parameters / effect / Agent task / 影响人数。
// 注：仓库未装 @testing-library/jest-dom，不用 toBeInTheDocument；
// 用 getByText/getByRole（找不到即抛）+ toBeTruthy 等价断言。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BFFAgent规则后果 } from '../数据/BFF契约';
import { BFFAgent规则解释中提案样本, BFFAgent规则就绪提案样本 } from '../测试/BFF样本';
import Agent规则提案卡, { Agent规则后果文案 } from './Agent规则提案卡';

const 无动作 = { 忙: false, 接受: vi.fn(), 放弃: vi.fn(), 关闭失败: vi.fn() };

describe('Agent规则提案卡', () => {
  it('renders the four frozen consequence summaries and explicit actions', async () => {
    const user = userEvent.setup();
    const 接受 = vi.fn();
    const 放弃 = vi.fn();
    render(<Agent规则提案卡 提案={{
      ...BFFAgent规则就绪提案样本,
      normalized_text: '不考虑大小周岗位',
      consequence: 'auto_deny',
    }} 忙={false} 接受={接受} 放弃={放弃} 关闭失败={vi.fn()} />);
    expect(screen.getByText('不考虑大小周岗位')).toBeTruthy();
    expect(screen.getByText('命中条件时，AI代理会自动拦下')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '确认规则' }));
    await user.click(screen.getByRole('button', { name: '放弃' }));
    expect(接受).toHaveBeenCalledTimes(1);
    expect(放弃).toHaveBeenCalledTimes(1);
  });

  it('每种 consequence 都上屏对应的安全摘要，不缺项', () => {
    const 后果们: BFFAgent规则后果[] = ['auto_allow', 'auto_deny', 'advisory', 'mixed'];
    for (const 后果 of 后果们) {
      const { unmount } = render(
        <Agent规则提案卡
          提案={{ ...BFFAgent规则就绪提案样本, consequence: 后果 }}
          忙={false} 接受={vi.fn()} 放弃={vi.fn()} 关闭失败={vi.fn()}
        />,
      );
      expect(screen.getByText(Agent规则后果文案[后果])).toBeTruthy();
      unmount();
    }
  });

  // advisory 是唯一没在别处逐字钉过的冻结摘要：不借 Agent规则后果文案 映射，直接钉字面量
  it('advisory 的安全摘要逐字冻结', () => {
    render(
      <Agent规则提案卡
        提案={{ ...BFFAgent规则就绪提案样本, consequence: 'advisory' }}
        忙={false} 接受={vi.fn()} 放弃={vi.fn()} 关闭失败={vi.fn()}
      />,
    );
    expect(screen.getByText('这是一条参考偏好，不会单独触发自动决定')).toBeTruthy();
  });

  it('interpreting 只显示进度文案，不给任何动作键', () => {
    render(<Agent规则提案卡 提案={BFFAgent规则解释中提案样本} {...无动作} />);
    expect(screen.getByText('AI代理正在理解这条规则…')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('failed 显示固定失败文案，关闭走 关闭失败', async () => {
    const user = userEvent.setup();
    const 关闭失败 = vi.fn();
    render(
      <Agent规则提案卡
        提案={{ ...BFFAgent规则解释中提案样本, state: 'failed' }}
        忙={false} 接受={vi.fn()} 放弃={vi.fn()} 关闭失败={关闭失败}
      />,
    );
    expect(screen.getByText('本次规则没有生效')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '关闭' }));
    expect(关闭失败).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['agent_unavailable', 'AI 暂时不可用，本次规则没有生效'],
    ['interpretation_failed', '内容无法可靠转换为规则，可编辑后重新提交'],
    [undefined, '本次规则没有生效'],
  ] as const)('failed code %s 使用安全文案', (failure_code, copy) => {
    render(<Agent规则提案卡
      提案={{ proposal_id: 'arp_ffffffffffffffffffffffffffffffff', state: 'failed', failure_code }}
      忙={false}
      接受={vi.fn()}
      放弃={vi.fn()}
      关闭失败={vi.fn()}
    />);
    expect(screen.getByText(copy)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '确认规则' })).toBeNull();
  });

  it('accepted 与 dismissed 整卡不渲染任何内容', () => {
    const 通过 = render(
      <Agent规则提案卡 提案={{ ...BFFAgent规则就绪提案样本, state: 'accepted' }} {...无动作} />,
    );
    expect(通过.container.textContent).toBe('');
    通过.unmount();
    const 舍弃 = render(
      <Agent规则提案卡 提案={{ ...BFFAgent规则就绪提案样本, state: 'dismissed' }} {...无动作} />,
    );
    expect(舍弃.container.textContent).toBe('');
  });

  it('忙 时放弃与确认规则都被禁用且点不出动作', async () => {
    const user = userEvent.setup();
    const 接受 = vi.fn();
    const 放弃 = vi.fn();
    const { rerender } = render(
      <Agent规则提案卡 提案={BFFAgent规则就绪提案样本} 忙 接受={接受} 放弃={放弃} 关闭失败={vi.fn()} />,
    );
    const 确认键 = screen.getByRole('button', { name: '确认规则' });
    const 放弃键 = screen.getByRole('button', { name: '放弃' });
    expect(确认键.hasAttribute('disabled')).toBe(true);
    expect(放弃键.hasAttribute('disabled')).toBe(true);
    await user.click(确认键);
    await user.click(放弃键);
    expect(接受).not.toHaveBeenCalled();
    expect(放弃).not.toHaveBeenCalled();
    // 操作收口后 忙 翻回 false：两个键恢复可用
    rerender(
      <Agent规则提案卡 提案={BFFAgent规则就绪提案样本} 忙={false} 接受={接受} 放弃={放弃} 关闭失败={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: '确认规则' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: '放弃' }).hasAttribute('disabled')).toBe(false);
  });
});
