// P7 Task 3：消息列表的模式分支测试 —— Backend 只渲染候选端 P7 收件箱（Mock 消息
// fixture 不进 Backend 分支）；Mock 保留 AI/直聊/真人三行与 reducer 语义
// （点击行派发 读消息 并导航既有无参路由）。Mock 模式零 P7 请求由操作层早退保证。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 样式 from './消息列表.module.css';
import 消息列表 from './消息列表';

const 导航 = vi.hoisted(() => ({ 跳转: vi.fn() }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: 导航.跳转 }) }));
vi.mock('./P7/Backend会话列表', () => ({
  default: ({ 角色 }: { 角色: string }) => <div data-testid="backend-inbox" data-role={角色} />,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

beforeEach(() => {
  导航.跳转.mockClear();
});

describe('消息列表 · 模式分支', () => {
  it('Backend 模式只渲染候选端 P7 收件箱', () => {
    mock应用状态 = { 数据源模式: 'backend', 状态: { 消息未读: {} }, 派发: vi.fn() };
    render(<消息列表 />);
    expect(screen.getByTestId('backend-inbox').getAttribute('data-role')).toBe('candidate');
    // Mock 消息 fixture 不进 Backend 分支
    expect(screen.queryByText('林筱')).toBeNull();
  });

  it('Mock 模式保留 AI/直聊/真人三行与 reducer 语义', async () => {
    mock应用状态 = { 数据源模式: 'mock', 状态: { 消息未读: { 'X-03': 2 } }, 派发: vi.fn() };
    render(<消息列表 />);
    expect(screen.getByText('AI代理动态')).toBeTruthy();
    expect(screen.getByText('陆知遥')).toBeTruthy();
    expect(screen.getByText('林筱')).toBeTruthy();
    expect(screen.queryByTestId('backend-inbox')).toBeNull();
    // 点行 = 读掉再进会话（reducer 语义），真人行走既有无参路由
    await userEvent.click(screen.getByRole('button', { name: /林筱/ }));
    expect(mock应用状态.派发).toHaveBeenCalledWith({ 型: '读消息', 编号: 'X-03' });
    expect(导航.跳转).toHaveBeenCalledWith('/chat/human');
  });

  it('Mock 行真实消费共享展示：页签/搜索过滤、未读三态与共享行 class（P1 Task 4）', async () => {
    // undefined = 已读（无标记）、0 = 红点、正数 = 数字；与 reducer 未读语义一致
    mock应用状态 = {
      数据源模式: 'mock',
      状态: { 消息未读: { 'X-02': 0, 'X-03': 2 } },
      派发: vi.fn(),
    };
    const 视图 = render(<消息列表 />);
    // AI代理行走代理头像容器，真人行走字标头像容器，都是共享展示的原 46px class
    expect(视图.container.querySelector(`.${样式.代理头像}`)).not.toBeNull();
    const 林筱行 = screen.getByRole('button', { name: /林筱/ });
    expect(林筱行.className).toContain(样式.会话行);
    expect(林筱行.querySelector(`.${样式.头像}`)!.textContent).toBe('林');
    // 未读数字胶囊（X-03 = 2）与红点（X-02 = 0）各在其行
    expect(林筱行.querySelector(`.${样式.未读徽标}`)!.textContent).toBe('2');
    const 陆知遥行 = screen.getByRole('button', { name: /陆知遥/ });
    expect(陆知遥行.querySelector(`.${样式.红点}`)).not.toBeNull();
    // AI代理动态（X-01）未读 undefined → 无任何标记
    const AI行 = screen.getByRole('button', { name: /AI代理动态/ });
    expect(AI行.querySelector(`.${样式.未读徽标}`)).toBeNull();
    expect(AI行.querySelector(`.${样式.红点}`)).toBeNull();

    // 页签过滤走共享外壳的受控页签
    await userEvent.click(screen.getByRole('button', { name: '仅会话' }));
    expect(screen.queryByText('AI代理动态')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '通知' }));
    expect(screen.queryByText('林筱')).toBeNull();
    expect(screen.getByText('AI代理动态')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '全部' }));

    // 搜索过滤走共享外壳的受控输入
    await userEvent.type(screen.getByPlaceholderText('搜索会话 / 公司 / 职位'), '林');
    expect(screen.queryByText('陆知遥')).toBeNull();
    expect(screen.getByText('林筱')).toBeTruthy();

    // 搜索无命中走共享后置提示
    await userEvent.clear(screen.getByPlaceholderText('搜索会话 / 公司 / 职位'));
    await userEvent.type(screen.getByPlaceholderText('搜索会话 / 公司 / 职位'), '不存在的词');
    // 多行空态是 文案<br/>文案（原结构），文本合在一个元素里
    const 空态 = 视图.container.querySelector(`.${样式.空态}`);
    expect(空态!.textContent).toContain('没有匹配的会话。');
    expect(空态!.textContent).toContain('换个关键词，或者切到「全部」看看。');
    expect(screen.queryByRole('button', { name: /林筱/ })).toBeNull();
  });
});
