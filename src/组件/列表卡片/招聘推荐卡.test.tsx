// 招聘推荐卡：Mock / Backend 两模式共用的唯一卡面（Spec §5.1）。
// 无 Provider 宿主：卡片不 import Context/路由/HTTP，回调全部走 props ——
// 这里只验证卡片自身的行为契约：占位与分数位、来源标保留、底部操作的动作归属
// （callback 次数 / 滑开零动作 / 禁用零动作 / 回执不渲染委托按钮）。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 招聘推荐卡 from './招聘推荐卡';
import type { 候选卡信息, 招聘推荐卡属性 } from './类型';

const 全未知: 候选卡信息 = {
  性别: null, 年限: null, 学历: null, 求职状态: null, 工作: null, 教育: null, 亮点: [],
};

/** 默认卡：全未知字段 + 已知 87 分，逐用例覆盖自己关心的槽位 */
function 渲染卡(覆盖: Partial<招聘推荐卡属性> = {}): 招聘推荐卡属性 {
  const 属性: 招聘推荐卡属性 = {
    信息: 全未知,
    匹配分: 87,
    收藏: false,
    收藏禁用: false,
    滑开: false,
    操作状态: { kind: '可委托', 提交中: false },
    打开: vi.fn(),
    切收藏: vi.fn(),
    委托: vi.fn(),
    ...覆盖,
  };
  render(<招聘推荐卡 {...属性} />);
  return 属性;
}

/** 卡主体按钮（卡内第一个 button；★ / › / 去聊键都在它外面） */
const 卡主体 = () => screen.getByTestId('招聘推荐卡').querySelector('button') as HTMLButtonElement;

describe('招聘推荐卡 · 占位与卡面', () => {
  it('字段全未知 + 分数未知：占位可读，两模式固定的来源标保留，回执态不渲染委托按钮', () => {
    render(
      <招聘推荐卡
        信息={全未知}
        匹配分={null}
        收藏={false}
        收藏禁用={false}
        滑开={false}
        操作状态={{ kind: '回执', 文案: '委托失败' }}
        打开={vi.fn()}
        切收藏={vi.fn()}
        委托={vi.fn()}
      />,
    );
    expect(screen.getByText('工作经历未知')).toBeTruthy();
    expect(screen.getByLabelText('匹配分未知')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '让AI代理去聊' })).toBeNull();
    // 来源标是两模式现有固定文案，随卡面搬移，不新增来源 prop
    expect(screen.getByText('你的AI代理从人才库筛出')).toBeTruthy();
    expect(screen.getByTestId('招聘推荐卡')).toBeTruthy();
  });

  it('已知分数复用适配环：40px 原展示，不出未知位', () => {
    渲染卡();
    expect(screen.getByRole('img', { name: '适配 87 分' })).toBeTruthy();
    expect(screen.queryByLabelText('匹配分未知')).toBeNull();
  });

  it('Task 5：总分原样显示不拆分 —— 50 分就是 50 分环，卡上无逐维得分/满分拆解', () => {
    渲染卡({ 匹配分: 50 });
    expect(screen.getByRole('img', { name: '适配 50 分' })).toBeTruthy();
    expect(screen.queryByLabelText('匹配分未知')).toBeNull();
    // 卡面不出现逐项分值 / 满分（"50/55" 这类拆分不存在）
    expect(document.body.textContent ?? '').not.toMatch(/\/\s*\d+|满分|逐维/);
  });

  it('Task 5：个人亮点合法空给「暂无可展示亮点」，不冒充未知，也不混入匹配原因', () => {
    渲染卡({ 信息: { ...全未知, 亮点: [] } });
    expect(screen.getByText('暂无可展示亮点')).toBeTruthy();
    expect(screen.queryByText('亮点信息未知')).toBeNull();
    // 匹配原因（highlights 码的中文文案）不冒充个人亮点上标签行
    expect(screen.queryByText('职位方向匹配')).toBeNull();
    expect(screen.queryByText('经验要求匹配')).toBeNull();
  });

  it('Task 5：个人亮点有值原样逐条展示（personal_highlights 接线保留）', () => {
    渲染卡({ 信息: { ...全未知, 亮点: ['带领5人团队交付', '交易域直接对口'] } });
    expect(screen.getByText('带领5人团队交付')).toBeTruthy();
    expect(screen.getByText('交易域直接对口')).toBeTruthy();
    expect(screen.queryByText('暂无可展示亮点')).toBeNull();
  });

  it('wire 带来的真实 0 分照常画 0 分环，不落未知占位（release/0.2.5）', () => {
    渲染卡({ 匹配分: 0 });
    expect(screen.getByRole('img', { name: '适配 0 分' })).toBeTruthy();
    expect(screen.queryByLabelText('匹配分未知')).toBeNull();
  });

  it('收藏态：★ 实心 + 可访问名切换为 取消收藏', () => {
    渲染卡({ 收藏: true });
    expect(screen.getByRole('button', { name: '取消收藏' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '收藏' })).toBeNull();
  });
});

describe('招聘推荐卡 · 底部行为', () => {
  it('卡主体与 › 只调 打开；★ 只调 切收藏；去聊键只调 委托', () => {
    const 属性 = 渲染卡();
    fireEvent.click(卡主体());
    expect(属性.打开).toHaveBeenCalledTimes(1);
    expect(属性.切收藏).not.toHaveBeenCalled();
    expect(属性.委托).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '查看候选画像' }));
    expect(属性.打开).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: '收藏' }));
    expect(属性.切收藏).toHaveBeenCalledTimes(1);
    expect(属性.打开).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: '让AI代理去聊' }));
    expect(属性.委托).toHaveBeenCalledTimes(1);
    expect(属性.打开).toHaveBeenCalledTimes(2);
  });

  it('滑开时卡内点击全部让位：打开/切收藏/委托 全部零动作', () => {
    const 属性 = 渲染卡({ 滑开: true });
    fireEvent.click(卡主体());
    fireEvent.click(screen.getByRole('button', { name: '收藏' }));
    fireEvent.click(screen.getByRole('button', { name: '查看候选画像' }));
    fireEvent.click(screen.getByRole('button', { name: '让AI代理去聊' }));
    expect(属性.打开).not.toHaveBeenCalled();
    expect(属性.切收藏).not.toHaveBeenCalled();
    expect(属性.委托).not.toHaveBeenCalled();
  });

  it('收藏禁用：★ 不可点，切收藏零动作', () => {
    const 属性 = 渲染卡({ 收藏禁用: true });
    const 键 = screen.getByRole('button', { name: '收藏' }) as HTMLButtonElement;
    expect(键.disabled).toBe(true);
    fireEvent.click(键);
    expect(属性.切收藏).not.toHaveBeenCalled();
  });

  it('提交中：去聊键禁用、委托零动作；打开与收藏不受影响', () => {
    const 属性 = 渲染卡({ 操作状态: { kind: '可委托', 提交中: true } });
    const 键 = screen.getByRole('button', { name: '让AI代理去聊' }) as HTMLButtonElement;
    expect(键.disabled).toBe(true);
    fireEvent.click(键);
    expect(属性.委托).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '收藏' }));
    expect(属性.切收藏).toHaveBeenCalledTimes(1);
    fireEvent.click(卡主体());
    expect(属性.打开).toHaveBeenCalledTimes(1);
  });

  it('回执态：只渲染权威文案状态标，状态标不可点、委托零动作', () => {
    const 属性 = 渲染卡({ 操作状态: { kind: '回执', 文案: '本次未能继续' } });
    expect(screen.getByText('本次未能继续')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '让AI代理去聊' })).toBeNull();
    fireEvent.click(screen.getByText('本次未能继续'));
    expect(属性.委托).not.toHaveBeenCalled();
  });
});

describe('招聘推荐卡 · 查看匹配分析入口（C3 / Spec §3.1：仅指定入口传回调）', () => {
  it('有回调：分数环变为独立入口——点击只调回调，不触发打开/切收藏/委托；键盘可达', async () => {
    const 用户 = userEvent.setup();
    const 查看匹配分析 = vi.fn();
    const 属性 = 渲染卡({ 查看匹配分析 });
    const 入口 = screen.getByRole('button', { name: '查看匹配分析' }) as HTMLButtonElement;
    // 只有圆环可见：入口内是原适配环；44px 触摸区类（环 40 + padding 2）
    expect(within(入口).getByRole('img', { name: '适配 87 分' })).toBeTruthy();
    expect(入口.className).toContain('分数入口');
    fireEvent.click(入口);
    expect(查看匹配分析).toHaveBeenCalledTimes(1);
    expect(属性.打开).not.toHaveBeenCalled();
    expect(属性.切收藏).not.toHaveBeenCalled();
    expect(属性.委托).not.toHaveBeenCalled();
    // 键盘可达（原生 button 语义）：Enter 与 Space 都触发回调
    入口.focus();
    await 用户.keyboard('{Enter}');
    await 用户.keyboard(' ');
    expect(查看匹配分析).toHaveBeenCalledTimes(3);
    // 不嵌套原生按钮：卡主体（第一个 button）内没有第二层 button，入口不在其内
    const 卡主体键 = screen.getByTestId('招聘推荐卡').querySelector('button') as HTMLButtonElement;
    expect(卡主体键.contains(入口)).toBe(false);
    expect(卡主体键.querySelectorAll('button')).toHaveLength(0);
  });

  it('滑开时入口让位滑动行：点击不触发回调，也不触发打开（卡内点击全部让位的既有约定）', () => {
    const 查看匹配分析 = vi.fn();
    const 属性 = 渲染卡({ 滑开: true, 查看匹配分析 });
    fireEvent.click(screen.getByRole('button', { name: '查看匹配分析' }));
    expect(查看匹配分析).not.toHaveBeenCalled();
    expect(属性.打开).not.toHaveBeenCalled();
  });

  it('匹配分 null 仍保留入口：— 占位在入口内（仍可查看缺失说明），不画假 0 分环', () => {
    渲染卡({ 匹配分: null, 查看匹配分析: vi.fn() });
    const 入口 = screen.getByRole('button', { name: '查看匹配分析' });
    expect(within(入口).getByLabelText('匹配分未知')).toBeTruthy();
    expect(within(入口).queryByRole('img', { name: /适配/ })).toBeNull();
  });

  it('无回调：完全没有分析入口，按钮位与既有卡面一致（卡主体/★/›/去聊）', () => {
    渲染卡();
    expect(screen.queryByRole('button', { name: '查看匹配分析' })).toBeNull();
    expect(screen.getByTestId('招聘推荐卡').querySelectorAll('button')).toHaveLength(4);
  });
});
