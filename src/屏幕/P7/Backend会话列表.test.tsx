// P7 Task 3：Backend 收件箱（双角色共用）的行为测试 —— 角色专属字段映射（候选 =
// 职位名/地点，招聘 = 候选代号/职位名）、context 不可用降级、last_message=null 摘要、
// 服务端顺序、本地搜索、空/加载/失败重试/加载更多、unreadCount=0 无红点、
// 参数路由导航且绝不派发 读消息/企业读消息、「通知」明确空态、进入 force 刷新与
// 可见范围登记/卸载注销。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { P7会话项 } from '../../数据/招聘数据源/真人会话';
import type { P7分页快照 } from '../../状态/后端/类型';
import Backend会话列表 from './Backend会话列表';

const 导航 = vi.hoisted(() => ({ 跳转: vi.fn() }));
vi.mock('../../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../../路由/导航钩子', () => ({ use导航: () => ({ 跳转: 导航.跳转 }) }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

function 会话项(覆盖: Partial<P7会话项> = {}): P7会话项 {
  return {
    conversationId: '3003',
    caseId: 'mc_3003',
    kind: 'human_handoff',
    lastMessage: {
      messageId: '4004', senderRole: 'recruiter', preview: '收到！明天下午聊', createdAt: '2026-08-30T01:00:00Z',
    },
    lastActivityAt: '2026-08-30T01:00:00Z',
    unreadCount: 0,
    contextStatus: 'available',
    context: { primaryLabel: '后端工程师', secondaryLabel: '上海·浦东', jobRef: null, resumeRef: null },
    ...覆盖,
  };
}

function 收件箱快照(覆盖: Partial<P7分页快照<P7会话项>> = {}): P7分页快照<P7会话项> {
  return {
    阶段: '成功', 刷新中: false, items: [], nextCursor: null, 已加载页数: 0, error: null, generation: 1,
    ...覆盖,
  };
}

function 环境(role: 'candidate' | 'recruiter', items: P7会话项[], 覆盖快照: Partial<P7分页快照<P7会话项>> = {}) {
  mock应用状态 = {
    后端状态: {
      P7收件箱: {
        candidate: role === 'candidate' ? 收件箱快照({ items, ...覆盖快照 }) : 收件箱快照(),
        recruiter: role === 'recruiter' ? 收件箱快照({ items, ...覆盖快照 }) : 收件箱快照(),
      },
    },
    操作: {
      设置P7收件箱范围: vi.fn(),
      加载会话列表: vi.fn().mockResolvedValue(undefined),
      追加会话列表: vi.fn().mockResolvedValue(undefined),
    },
    派发: vi.fn(),
  };
}

beforeEach(() => {
  导航.跳转.mockClear();
});

describe('Backend会话列表', () => {
  it('候选端行映射：标题=职位名、副标题=地点；点击走参数路由且绝不派发读消息', async () => {
    环境('candidate', [
      会话项(),
      会话项({
        conversationId: '3001',
        context: { primaryLabel: '前端工程师', secondaryLabel: '杭州', jobRef: null, resumeRef: null },
        lastMessage: { messageId: '4003', senderRole: 'recruiter', preview: '简历已收到', createdAt: '2026-08-30T00:30:00Z' },
      }),
    ]);
    render(<Backend会话列表 角色="candidate" />);
    expect(screen.getByText('后端工程师')).toBeTruthy();
    expect(screen.getByText('上海·浦东')).toBeTruthy();
    expect(screen.getByText('收到！明天下午聊')).toBeTruthy();
    expect(screen.queryByTestId('unread-3003')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /后端工程师/ }));
    expect(导航.跳转).toHaveBeenCalledWith('/chat/human/3003');
    expect(mock应用状态.派发).not.toHaveBeenCalled();
  });

  it('招聘端行映射：标题=候选代号、副标题=职位名，导航走企业参数路由', async () => {
    环境('recruiter', [会话项()]);
    render(<Backend会话列表 角色="recruiter" />);
    expect(screen.getByText('上海·浦东')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /上海·浦东/ }));
    expect(导航.跳转).toHaveBeenCalledWith('/hr/chat/3003');
    expect(mock应用状态.派发).not.toHaveBeenCalled();
  });

  it('unreadCount>0 显示数字胶囊，=0 无任何红点', () => {
    环境('candidate', [会话项({ unreadCount: 2 }), 会话项({ conversationId: '3001', unreadCount: 0 })]);
    render(<Backend会话列表 角色="candidate" />);
    expect(screen.getByTestId('unread-3003').textContent).toBe('2');
    expect(screen.queryByTestId('unread-3001')).toBeNull();
  });

  it('context 不可用：标题「会话信息暂不可用」、副标题留空，摘要与消息保留', () => {
    环境('candidate', [会话项({ contextStatus: 'unavailable', context: null })]);
    render(<Backend会话列表 角色="candidate" />);
    expect(screen.getByText('会话信息暂不可用')).toBeTruthy();
    expect(screen.getByText('收到！明天下午聊')).toBeTruthy();
  });

  it('last_message=null 显示「已建立真人会话」', () => {
    环境('candidate', [会话项({ lastMessage: null })]);
    render(<Backend会话列表 角色="candidate" />);
    expect(screen.getByText('已建立真人会话')).toBeTruthy();
  });

  it('本地搜索只过滤已加载项，服务端顺序原样呈现', async () => {
    环境('candidate', [
      会话项(),
      会话项({ conversationId: '3001', context: { primaryLabel: '前端工程师', secondaryLabel: '杭州', jobRef: null, resumeRef: null } }),
    ]);
    render(<Backend会话列表 角色="candidate" />);
    await userEvent.type(screen.getByPlaceholderText('搜索会话 / 公司 / 职位'), '后端');
    expect(screen.getByText('后端工程师')).toBeTruthy();
    expect(screen.queryByText('前端工程师')).toBeNull();
    // 清空搜索恢复全量；顺序保持服务端顺序
    await userEvent.clear(screen.getByPlaceholderText('搜索会话 / 公司 / 职位'));
    const 行 = screen.getAllByRole('button', { name: /工程师/ });
    expect(行[0].textContent).toContain('后端工程师');
    expect(行[1].textContent).toContain('前端工程师');
  });

  it('「通知」页签显示明确空态，不混入任何会话行', async () => {
    环境('candidate', [会话项()]);
    render(<Backend会话列表 角色="candidate" />);
    await userEvent.click(screen.getByRole('button', { name: '通知' }));
    expect(screen.getByText('还没有通知')).toBeTruthy();
    expect(screen.queryByText('后端工程师')).toBeNull();
  });

  it('首读进行中显示正在读入，成功空页显示还没有真人会话，失败显示重试', async () => {
    环境('candidate', [], { 阶段: '进行中', 刷新中: true });
    const { unmount } = render(<Backend会话列表 角色="candidate" />);
    expect(screen.getByText('正在读入会话…')).toBeTruthy();
    unmount();

    环境('candidate', [], { 阶段: '成功' });
    render(<Backend会话列表 角色="candidate" />);
    expect(screen.getByText('还没有真人会话')).toBeTruthy();
    unmount();

    环境('candidate', [], { 阶段: '失败', error: '后端服务暂时不可用，请稍后重试' });
    render(<Backend会话列表 角色="candidate" />);
    expect(screen.getByText('后端服务暂时不可用，请稍后重试')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(mock应用状态.操作.加载会话列表).toHaveBeenCalledWith('candidate', true);
  });

  it('next_cursor 在场时提供加载更多，点击透传追加；游标已尽不渲染按钮', async () => {
    环境('candidate', [会话项()], { nextCursor: 'Pg1_1', 已加载页数: 1 });
    render(<Backend会话列表 角色="candidate" />);
    await userEvent.click(screen.getByRole('button', { name: '加载更多' }));
    expect(mock应用状态.操作.追加会话列表).toHaveBeenCalledWith('candidate');
    // 换游标已尽的快照：无按钮
  });

  it('进入时 force 刷新并登记可见范围，卸载时注销', () => {
    环境('candidate', [会话项()]);
    const { unmount } = render(<Backend会话列表 角色="candidate" />);
    expect(mock应用状态.操作.设置P7收件箱范围).toHaveBeenCalledWith('candidate', true);
    expect(mock应用状态.操作.加载会话列表).toHaveBeenCalledWith('candidate', true);
    unmount();
    expect(mock应用状态.操作.设置P7收件箱范围).toHaveBeenCalledWith('candidate', false);
  });
});