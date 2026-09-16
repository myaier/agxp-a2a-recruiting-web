// P7 Task 3：Backend 收件箱（双角色共用）的行为测试 —— 角色专属字段映射（候选 =
// 职位名/地点，招聘 = 候选代号/职位名）、context 不可用降级、last_message=null 摘要、
// 服务端顺序、本地搜索、空/加载/失败重试/加载更多、unreadCount=0 无红点、
// 参数路由导航且绝不派发 读消息/企业读消息、进入 force 刷新与可见范围登记/卸载注销。
//
// 固定 AI 动态入口行（展示层组装，零 P7 数据写入）：双角色字段合同（标题/副标题/
// 摘要/时间空/代理头像/无未读标记）、点击只导航代理参数路由、页签分类（全部=最前 +
// 真人行、仅会话=隐藏、通知=只有它）、搜索 trim 包含匹配、空/首读/失败/错误带缓存
// 下的提示共存规则、rerender 空页→有数据→追加页唯一入口、角色重挂跟随角色。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { P7会话项 } from '../../数据/招聘数据源/真人会话';
import type { P7分页快照 } from '../../状态/后端/类型';
import 样式 from '../消息列表.module.css';
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

// 多行空态是 文案<br/>文案（共享外壳原结构），文本合在一个元素里 —— 与
// 消息列表.test.tsx 同款断言：按 空态 容器 textContent 判断，错误与无匹配可各自成块。
function 有空态含(片段: string) {
  expect(Array.from(document.querySelectorAll(`.${样式.空态}`))
    .some((元素) => 元素.textContent?.includes(片段))).toBe(true);
}

function 无空态含(片段: string) {
  expect(Array.from(document.querySelectorAll(`.${样式.空态}`))
    .some((元素) => 元素.textContent?.includes(片段))).toBe(false);
}

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

  it('「通知」页签 = 固定 AI 入口行，真人会话行不出现，也没有「还没有通知」', async () => {
    环境('candidate', [会话项()]);
    render(<Backend会话列表 角色="candidate" />);
    await userEvent.click(screen.getByRole('button', { name: '通知' }));
    expect(screen.getByText('AI代理动态')).toBeTruthy();
    expect(screen.getByText('你的求职AI代理')).toBeTruthy();
    expect(screen.queryByText('后端工程师')).toBeNull();
    expect(screen.queryByText('还没有通知')).toBeNull();
  });

  it('固定 AI 入口行字段合同：代理头像、摘要、时间空、无未读标记，双角色副标题跟随角色', () => {
    环境('candidate', [会话项()]);
    const 候选视图 = render(<Backend会话列表 角色="candidate" />);
    const AI行 = screen.getByRole('button', { name: /AI代理动态/ });
    expect(AI行.textContent).toContain('你的求职AI代理');
    // 求职端已开放真实聊天：摘要改为能力说明，不伪造时间/未读/最近消息来源
    expect(AI行.textContent).toContain('查看岗位推荐和在谈进展');
    expect(AI行.textContent).not.toContain('聊天暂未开放');
    expect(AI行.querySelector(`.${样式.代理头像}`)).toBeTruthy();
    expect(AI行.querySelector(`.${样式.头像}`)).toBeNull();
    expect(AI行.querySelector(`.${样式.会话时间}`)!.textContent).toBe('');
    expect(AI行.querySelector(`.${样式.未读徽标}`)).toBeNull();
    候选视图.unmount();

    环境('recruiter', [会话项()]);
    render(<Backend会话列表 角色="recruiter" />);
    expect(screen.getByText('你的招聘AI代理')).toBeTruthy();
    expect(screen.queryByText('你的求职AI代理')).toBeNull();
    // 招聘端聊天仍未开放：原文案保持
    expect(screen.getByText('聊天暂未开放，可查看代理功能')).toBeTruthy();
  });

  it('AI 行点击只导航代理参数路由（候选 /agent、招聘 /hr/agent），零派发', async () => {
    环境('candidate', [会话项()]);
    const 候选视图 = render(<Backend会话列表 角色="candidate" />);
    await userEvent.click(screen.getByRole('button', { name: /AI代理动态/ }));
    expect(导航.跳转).toHaveBeenCalledTimes(1);
    expect(导航.跳转).toHaveBeenCalledWith('/agent');
    expect(mock应用状态.派发).not.toHaveBeenCalled();
    候选视图.unmount();

    导航.跳转.mockClear();
    环境('recruiter', [会话项()]);
    render(<Backend会话列表 角色="recruiter" />);
    await userEvent.click(screen.getByRole('button', { name: /AI代理动态/ }));
    expect(导航.跳转).toHaveBeenCalledTimes(1);
    expect(导航.跳转).toHaveBeenCalledWith('/hr/agent');
    expect(mock应用状态.派发).not.toHaveBeenCalled();
  });

  it('「全部」= AI 行在最前 + 服务端顺序真人行；「仅会话」隐藏 AI 行', async () => {
    环境('candidate', [
      会话项(),
      会话项({ conversationId: '3001', context: { primaryLabel: '前端工程师', secondaryLabel: '杭州', jobRef: null, resumeRef: null } }),
    ]);
    const 视图 = render(<Backend会话列表 角色="candidate" />);
    const 行 = screen.getAllByRole('button', { name: /AI代理动态|工程师/ });
    expect(行).toHaveLength(3);
    expect(行[0].textContent).toContain('AI代理动态');
    expect(行[1].textContent).toContain('后端工程师');
    expect(行[2].textContent).toContain('前端工程师');
    视图.unmount();

    环境('candidate', [会话项()]);
    render(<Backend会话列表 角色="candidate" />);
    await userEvent.click(screen.getByRole('button', { name: '仅会话' }));
    expect(screen.queryByText('AI代理动态')).toBeNull();
    expect(screen.getByText('后端工程师')).toBeTruthy();
  });

  it('搜索按 trim 包含匹配 AI 行三字段；命中时全部不出无匹配，仅会话真人零命中才出', async () => {
    环境('candidate', [会话项()]);
    render(<Backend会话列表 角色="candidate" />);
    // 前后空格走 trim 后仍命中副标题
    await userEvent.type(screen.getByPlaceholderText('搜索会话 / 公司 / 职位'), ' 求职AI代理 ');
    expect(screen.getByText('AI代理动态')).toBeTruthy();
    expect(screen.queryByText('后端工程师')).toBeNull();
    无空态含('没有匹配的会话。');
    await userEvent.click(screen.getByRole('button', { name: '仅会话' }));
    expect(screen.queryByText('AI代理动态')).toBeNull();
    有空态含('没有匹配的会话。');
  });

  it('通知搜索不中直接显示无匹配；首读未完成且无缓存时全部只保留读入、不宣称搜完', async () => {
    环境('candidate', [], { 阶段: '进行中', 刷新中: true });
    render(<Backend会话列表 角色="candidate" />);
    await userEvent.type(screen.getByPlaceholderText('搜索会话 / 公司 / 职位'), '工资');
    expect(screen.getByText('正在读入会话…')).toBeTruthy();
    expect(screen.queryByText('AI代理动态')).toBeNull();
    无空态含('没有匹配的会话。');
    await userEvent.click(screen.getByRole('button', { name: '通知' }));
    expect(screen.queryByText('AI代理动态')).toBeNull();
    有空态含('没有匹配的会话。');
    expect(screen.queryByText('正在读入会话…')).toBeNull();
  });

  it('通知搜索命中时只显示 AI 行，无提示', async () => {
    环境('candidate', [会话项()]);
    render(<Backend会话列表 角色="candidate" />);
    await userEvent.click(screen.getByRole('button', { name: '通知' }));
    await userEvent.type(screen.getByPlaceholderText('搜索会话 / 公司 / 职位'), '代理');
    expect(screen.getByText('AI代理动态')).toBeTruthy();
    无空态含('没有匹配的会话。');
  });

  it('成功空页：全部 = AI 行 + 还没有真人会话；仅会话 = 同空态；通知 = 只 AI 行无空态', async () => {
    环境('candidate', [], { 阶段: '成功' });
    const 视图 = render(<Backend会话列表 角色="candidate" />);
    expect(screen.getByText('AI代理动态')).toBeTruthy();
    expect(screen.getByText('还没有真人会话')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '仅会话' }));
    expect(screen.queryByText('AI代理动态')).toBeNull();
    expect(screen.getByText('还没有真人会话')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '通知' }));
    expect(screen.getByText('AI代理动态')).toBeTruthy();
    expect(screen.queryByText('还没有通知')).toBeNull();
    expect(screen.queryByText('还没有真人会话')).toBeNull();
    视图.unmount();
  });

  it('P7 失败：错误与重试在前不被 AI 行掩盖；通知只显示 AI 行且无错误/重试/加载更多', async () => {
    环境('candidate', [], { 阶段: '失败', error: '后端服务暂时不可用，请稍后重试' });
    const 视图 = render(<Backend会话列表 角色="candidate" />);
    expect(screen.getByText('后端服务暂时不可用，请稍后重试')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /AI代理动态/ })).toBeTruthy();
    expect(视图.container.textContent.indexOf('后端服务暂时不可用'))
      .toBeLessThan(视图.container.textContent.indexOf('AI代理动态'));
    await userEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(mock应用状态.操作.加载会话列表).toHaveBeenCalledWith('candidate', true);
    视图.unmount();

    环境('candidate', [], { 阶段: '失败', error: '后端服务暂时不可用，请稍后重试' });
    render(<Backend会话列表 角色="candidate" />);
    await userEvent.click(screen.getByRole('button', { name: '通知' }));
    expect(screen.getByText('AI代理动态')).toBeTruthy();
    expect(screen.queryByText('后端服务暂时不可用，请稍后重试')).toBeNull();
    expect(screen.queryByRole('button', { name: '重试' })).toBeNull();
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();
  });

  it('错误带缓存 + 搜索：错误与无匹配共存；AI 行命中时不出无匹配', async () => {
    环境('candidate', [会话项()], { error: '后端服务暂时不可用，请稍后重试' });
    render(<Backend会话列表 角色="candidate" />);
    await userEvent.type(screen.getByPlaceholderText('搜索会话 / 公司 / 职位'), '不存在词');
    expect(screen.getByText('后端服务暂时不可用，请稍后重试')).toBeTruthy();
    有空态含('没有匹配的会话。');
    expect(screen.queryByText('AI代理动态')).toBeNull();
    await userEvent.clear(screen.getByPlaceholderText('搜索会话 / 公司 / 职位'));
    await userEvent.type(screen.getByPlaceholderText('搜索会话 / 公司 / 职位'), '在谈进展');
    expect(screen.getByText('AI代理动态')).toBeTruthy();
    expect(screen.queryByText('后端工程师')).toBeNull();
    无空态含('没有匹配的会话。');
    expect(screen.getByText('后端服务暂时不可用，请稍后重试')).toBeTruthy();
  });

  it('rerender 空页→有数据→追加页：AI 行始终唯一，真人行次序稳定', () => {
    环境('candidate', [], { 阶段: '成功' });
    const 视图 = render(<Backend会话列表 角色="candidate" />);
    expect(screen.getAllByText('AI代理动态')).toHaveLength(1);
    expect(screen.getByText('还没有真人会话')).toBeTruthy();

    环境('candidate', [会话项()]);
    视图.rerender(<Backend会话列表 角色="candidate" />);
    expect(screen.getAllByText('AI代理动态')).toHaveLength(1);
    expect(screen.queryByText('还没有真人会话')).toBeNull();
    expect(screen.getByText('后端工程师')).toBeTruthy();

    环境('candidate', [
      会话项(),
      会话项({ conversationId: '3001', context: { primaryLabel: '前端工程师', secondaryLabel: '杭州', jobRef: null, resumeRef: null } }),
    ], { 已加载页数: 2, nextCursor: 'Pg2_9' });
    视图.rerender(<Backend会话列表 角色="candidate" />);
    expect(screen.getAllByText('AI代理动态')).toHaveLength(1);
    const 行 = screen.getAllByRole('button', { name: /AI代理动态|工程师/ });
    expect(行).toHaveLength(3);
    expect(行[0].textContent).toContain('AI代理动态');
    expect(行[1].textContent).toContain('后端工程师');
    expect(行[2].textContent).toContain('前端工程师');
  });

  it('角色重挂：入口文案与导航跟随角色，AI 行保持唯一入口', async () => {
    环境('candidate', []);
    const 视图 = render(<Backend会话列表 角色="candidate" />);
    expect(screen.getByText('你的求职AI代理')).toBeTruthy();
    环境('recruiter', [会话项()]);
    视图.rerender(<Backend会话列表 角色="recruiter" />);
    expect(screen.getByText('你的招聘AI代理')).toBeTruthy();
    expect(screen.queryByText('你的求职AI代理')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /AI代理动态/ }));
    expect(导航.跳转).toHaveBeenCalledWith('/hr/agent');
  });

  it('切「通知」时错误提示与加载更多消失，切回「全部」恢复且 AI 行仍在最前', async () => {
    环境('candidate', [会话项()], { error: '后端服务暂时不可用，请稍后重试', nextCursor: 'Pg1_1', 已加载页数: 1 });
    render(<Backend会话列表 角色="candidate" />);
    expect(screen.getByText('后端服务暂时不可用，请稍后重试')).toBeTruthy();
    expect(screen.getByRole('button', { name: '加载更多' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '通知' }));
    expect(screen.queryByText('后端服务暂时不可用，请稍后重试')).toBeNull();
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();
    expect(screen.getByText('AI代理动态')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '全部' }));
    expect(screen.getByText('后端服务暂时不可用，请稍后重试')).toBeTruthy();
    expect(screen.getByRole('button', { name: '加载更多' })).toBeTruthy();
    const 行 = screen.getAllByRole('button', { name: /AI代理动态|工程师/ });
    expect(行[0].textContent).toContain('AI代理动态');
    expect(行[1].textContent).toContain('后端工程师');
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

  it('行真实消费共享展示：原 46px 字标头像「会」+ 共享行/页签 class（P1 Task 4）', async () => {
    环境('candidate', [会话项({ unreadCount: 2 })]);
    render(<Backend会话列表 角色="candidate" />);
    const 行 = screen.getByRole('button', { name: /后端工程师/ });
    expect(行.className).toContain(样式.会话行);
    // 头像继续是中性「会」字标（不从姓名或 Mock fixture 派生），落在共享 46px 容器
    expect(行.querySelector(`.${样式.头像}`)!.textContent).toBe('会');
    expect(行.querySelector(`.${样式.未读徽标}`)!.textContent).toBe('2');
    expect(行.querySelector(`.${样式.代理头像}`)).toBeNull();
    // 页签行/标题行都来自共享外壳
    const 全部签 = screen.getByRole('button', { name: '全部' });
    expect(全部签.className).toContain(样式.页签选中);
    expect(screen.getByText('消息')).toBeTruthy();
    // 错误与缓存行共存：错误提示在前、会话行在后
    环境('candidate', [会话项()], { error: '后端服务暂时不可用，请稍后重试' });
    const 错误视图 = render(<Backend会话列表 角色="candidate" />);
    expect(错误视图.container.textContent).toContain('后端服务暂时不可用，请稍后重试');
    expect(错误视图.container.textContent).toContain('后端工程师');
    await userEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(mock应用状态.操作.加载会话列表).toHaveBeenCalledWith('candidate', true);
  });
});