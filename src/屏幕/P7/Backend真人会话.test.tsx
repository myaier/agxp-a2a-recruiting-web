// P7 Task 4：Backend 真人会话（双角色共用）的行为测试 —— 直达读取与可见会话注册、
// 双端 sender 对齐与中性 system 行、时间序渲染与「加载更早」、404 清空旧内容 /
// 503 保留旧成功、Enter 发送与 Shift+Enter 换行、code point 上限、无乐观气泡、
// unknown 三分支（重新确认 / 可放弃 / in_progress 不可放弃）与放弃保留在编草稿、
// read-through 只认最新渲染的 user_text、候选端「看职位」按 job_ref 导航与
// 招聘端「看简历」按 case_id 取 PDF 租约（关闭/卸载即回收）。绝不 import Mock
// 联系人或 Mock 消息 fixture。

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { P7会话项, P7消息 } from '../../数据/招聘数据源/真人会话';
import type { P7发送结果, P7分页快照, P7详情快照 } from '../../状态/后端/类型';
/** F6 测试内的发送结果别名（避免与导入名冲突的行内形状）。 */
type P7发送ResultShape = { status: 'confirmed' } | { status: 'unknown'; reason: string; canAbandon: boolean; pendingContent: string };
import Backend真人会话 from './Backend真人会话';
// 仓库既有的 ?raw 源码合同模式（⋯ 控件形态 / 举报目标类型）
import Backend真人会话tsx源码 from './Backend真人会话.tsx?raw';
import { 轻提示 } from '../../组件/轻提示';
import type { P8ReportReceipt } from '../../数据/招聘数据源/P8控制面';

const 导航 = vi.hoisted(() => ({ 跳转: vi.fn(), 返回: vi.fn() }));
vi.mock('../../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../../路由/导航钩子', () => ({ use导航: () => 导航 }));
vi.mock('../../组件/轻提示', () => ({ 轻提示: vi.fn() }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

const PDF租约 = vi.hoisted(() => ({
  url: 'blob:pdf-lease',
  revoke: vi.fn(),
}));

function 会话详情(覆盖: Partial<P7会话项> = {}): P7会话项 {
  return {
    conversationId: '3003',
    caseId: 'mc_3003',
    kind: 'human_handoff',
    lastMessage: null,
    lastActivityAt: '2026-08-30T01:00:00Z',
    unreadCount: 0,
    contextStatus: 'available',
    context: {
      primaryLabel: '后端工程师',
      secondaryLabel: '上海·浦东',
      jobRef: 'job_00112233445566778899aabbccddeeff',
      resumeRef: 'rf_00112233445566778899aabbccddeeff',
    },
    ...覆盖,
  };
}

function 详情快照(覆盖: Partial<P7详情快照> = {}): P7详情快照 {
  return { 阶段: '成功', 刷新中: false, detail: 会话详情(), error: null, generation: 1, ...覆盖 };
}

function 空分页<T>(): P7分页快照<T> {
  return { 阶段: '未开始', 刷新中: false, items: [], nextCursor: null, 已加载页数: 0, error: null, generation: 0 };
}

const 系统行: P7消息 = {
  messageId: 'system:3003', kind: 'conversation_started', senderRole: 'system', createdAt: '2026-08-30T00:00:00Z',
};

function 文本(id: string, senderRole: 'candidate' | 'recruiter', content: string): P7消息 {
  return { messageId: id, kind: 'user_text', senderRole, content, createdAt: '2026-08-30T01:00:00Z' };
}

function 环境(input: {
  role?: 'candidate' | 'recruiter';
  详情?: P7详情快照;
  消息?: P7分页快照<P7消息>;
  发送?: (role: string, id: string, content: string) => Promise<P7发送结果>;
  读取简历PDF?: () => Promise<typeof PDF租约>;
  提交P8举报?: (target: unknown, reason: unknown, alsoBlock: unknown) => Promise<P8ReportReceipt>;
}) {
  const role = input.role ?? 'candidate';
  mock应用状态 = {
    数据源模式: 'backend',
    派发: 派发spy,
    后端状态: {
      P7收件箱: { candidate: 空分页(), recruiter: 空分页() },
      P7会话详情: { 'p7:detail:candidate:3003': input.详情 ?? 详情快照(), 'p7:detail:recruiter:3003': input.详情 ?? 详情快照() },
      P7消息页: {
        'p7:messages:candidate:3003': input.消息 ?? 空分页(),
        'p7:messages:recruiter:3003': input.消息 ?? 空分页(),
      },
    },
    操作: {
      设置P7会话范围: vi.fn(),
      读取真人会话: vi.fn().mockResolvedValue(undefined),
      追加更早消息: vi.fn().mockResolvedValue(undefined),
      发送真人消息: input.发送 ?? vi.fn().mockResolvedValue({ status: 'confirmed' }),
      放弃真人消息意图: vi.fn(),
      提交真人已读: vi.fn().mockResolvedValue(undefined),
      读取简历PDF: input.读取简历PDF ?? vi.fn().mockResolvedValue(PDF租约),
      提交P8举报: input.提交P8举报 ?? vi.fn().mockResolvedValue(举报回执),
    },
  };
  return role;
}

/** 举报层断言用的全局 spy（举报绝不本地拉黑）。 */
const 派发spy = vi.fn();
const 举报回执: P8ReportReceipt = { ticketId: 'TICKET-P8-RPT-001', status: 'received', blockStatus: 'not_requested' };

beforeEach(() => {
  导航.跳转.mockClear();
  PDF租约.revoke.mockClear();
  vi.mocked(轻提示).mockClear();
});

describe('Backend真人会话', () => {
  it('直达注册可见会话并读取详情+最新消息，卸载注销', () => {
    环境({});
    const { unmount } = render(<Backend真人会话 role="candidate" conversationId="3003" />);
    expect(mock应用状态.操作.设置P7会话范围).toHaveBeenCalledWith('candidate', '3003');
    expect(mock应用状态.操作.读取真人会话).toHaveBeenCalledWith('candidate', '3003');
    unmount();
    expect(mock应用状态.操作.设置P7会话范围).toHaveBeenCalledWith('candidate', null);
  });

  it('sender 对齐：本端右侧气泡、对端左侧气泡、system 行中性胶囊（双端各验一次）', () => {
    const 消息: P7分页快照<P7消息> = {
      阶段: '成功', 刷新中: false, nextCursor: null, 已加载页数: 1, error: null, generation: 1,
      items: [系统行, 文本('4004', 'recruiter', '你好，想约时间聊聊'), 文本('4005', 'candidate', '可以的')],
    };
    环境({ 消息 });
    const { unmount } = render(<Backend真人会话 role="candidate" conversationId="3003" />);
    expect(screen.getByText('双方已确认意向，现在可以直接沟通')).toBeTruthy();
    expect(screen.getByText('你好，想约时间聊聊').closest('[data-侧]')?.getAttribute('data-侧')).toBe('左');
    expect(screen.getByText('可以的').closest('[data-侧]')?.getAttribute('data-侧')).toBe('右');
    unmount();

    // 招聘端视角：同一条 recruiter 消息落在右侧
    环境({ role: 'recruiter', 消息 });
    render(<Backend真人会话 role="recruiter" conversationId="3003" />);
    expect(screen.getByText('你好，想约时间聊聊').closest('[data-侧]')?.getAttribute('data-侧')).toBe('右');
    expect(screen.getByText('可以的').closest('[data-侧]')?.getAttribute('data-侧')).toBe('左');
  });

  it('时间序渲染 + next_cursor 在场时提供「加载更早」；游标已尽不渲染', async () => {
    const 消息: P7分页快照<P7消息> = {
      阶段: '成功', 刷新中: false, nextCursor: 'older_1', 已加载页数: 1, error: null, generation: 1,
      items: [系统行, 文本('4004', 'candidate', '在吗')],
    };
    环境({ 消息 });
    render(<Backend真人会话 role="candidate" conversationId="3003" />);
    await userEvent.click(screen.getByRole('button', { name: '加载更早' }));
    expect(mock应用状态.操作.追加更早消息).toHaveBeenCalledWith('candidate', '3003');
  });

  it('详情 404 清空旧内容；消息 503 保留旧成功快照只落错误', () => {
    const 成功消息: P7分页快照<P7消息> = {
      阶段: '成功', 刷新中: false, nextCursor: null, 已加载页数: 1,
      error: '消息服务暂时不可用，请重试', generation: 2,
      items: [系统行, 文本('4004', 'candidate', '在吗')],
    };
    环境({
      详情: { 阶段: '失败', 刷新中: false, detail: null, error: '这段会话不存在或已不可访问', generation: 2 },
      消息: 成功消息,
    });
    render(<Backend真人会话 role="candidate" conversationId="3003" />);
    expect(screen.getByText('这段会话不存在或已不可访问')).toBeTruthy();
    // 消息保留旧成功内容 + 错误行
    expect(screen.getByText('在吗')).toBeTruthy();
    expect(screen.getByText('消息服务暂时不可用，请重试')).toBeTruthy();
  });

  it('Enter 发送 trim 后正文、Shift+Enter 换行不发送、code point 上限按 Array.from 计', async () => {
    const 发送 = vi.fn().mockResolvedValue({ status: 'confirmed' } as P7发送结果);
    环境({ 发送 });
    const 用户 = userEvent.setup();
    render(<Backend真人会话 role="candidate" conversationId="3003" />);
    const 输入框 = screen.getByRole('textbox', { name: '输入消息' });
    await 用户.type(输入框, '  你好  ');
    await 用户.type(输入框, '{Enter}');
    expect(发送).toHaveBeenCalledWith('candidate', '3003', '你好');
    // Shift+Enter 只是换行，不发送
    await 用户.type(输入框, '第二行{Shift>}{Enter}{/Shift}');
    expect(发送).toHaveBeenCalledTimes(1);
    // 2000 个 emoji（4000 个 UTF-16 单位）仍是合法 2000 code point：可发送
    fireEvent.change(输入框, { target: { value: '😀'.repeat(2000) } });
    await 用户.type(输入框, '{Enter}');
    expect(发送).toHaveBeenCalledTimes(2);
    expect(发送).toHaveBeenLastCalledWith('candidate', '3003', '😀'.repeat(2000));
    // 2001 个 code point：拦截 + 轻提示，零请求
    fireEvent.change(输入框, { target: { value: '😀'.repeat(2001) } });
    await 用户.type(输入框, '{Enter}');
    expect(发送).toHaveBeenCalledTimes(2);
    expect(轻提示).toHaveBeenCalledWith('消息太长，请缩短后再发送');
  });

  it('发送不乐观追加：确认后清草稿，权威快照出现新消息；无确认弹窗文案', async () => {
    let 应答!: (结果: P7发送结果) => void;
    const 发送 = vi.fn().mockImplementation(() => new Promise<P7发送结果>((完成) => { 应答 = 完成; }));
    环境({
      发送,
      消息: { 阶段: '成功', 刷新中: false, nextCursor: null, 已加载页数: 1, error: null, generation: 1, items: [系统行] },
    });
    const 用户 = userEvent.setup();
    render(<Backend真人会话 role="candidate" conversationId="3003" />);
    await 用户.type(screen.getByRole('textbox', { name: '输入消息' }), '在吗');
    await 用户.type(screen.getByRole('textbox', { name: '输入消息' }), '{Enter}');
    // 在飞：不乐观追加
    expect(screen.queryByText('在吗')).toBeNull();
    应答({ status: 'confirmed' });
    await waitFor(() => expect((screen.getByRole('textbox', { name: '输入消息' }) as HTMLTextAreaElement).value).toBe(''));
  });

  it('unknown/outcome_unknown 可放弃：显示重新确认与放弃；放弃保留在编草稿并清该意图', async () => {
    const 发送 = vi.fn().mockResolvedValue({
      status: 'unknown', reason: 'outcome_unknown', canAbandon: true, pendingContent: '你好',
    } as P7发送结果);
    环境({ 发送 });
    const 用户 = userEvent.setup();
    render(<Backend真人会话 role="candidate" conversationId="3003" />);
    await 用户.type(screen.getByRole('textbox', { name: '输入消息' }), '你好{Enter}');
    expect(screen.getByText('暂时无法确认是否发送成功')).toBeTruthy();
    // 用户在结果未知时继续编辑新草稿，点「放弃本次发送」只清那条不可变正文键
    const 输入框 = screen.getByRole('textbox', { name: '输入消息' }) as HTMLTextAreaElement;
    await 用户.type(输入框, '改成这句');
    await 用户.click(screen.getByRole('button', { name: '放弃本次发送' }));
    expect(mock应用状态.操作.放弃真人消息意图).toHaveBeenCalledWith('candidate', '3003', '你好');
    expect((screen.getByRole('textbox', { name: '输入消息' }) as HTMLTextAreaElement).value).toBe('改成这句');
    expect(screen.queryByText('暂时无法确认是否发送成功')).toBeNull();
    // 重新确认：按不可变待定正文同键重试（不是在编草稿）
    await 用户.clear(输入框);
    await 用户.type(输入框, '你好{Enter}');
    await waitFor(() => expect(screen.getByText('暂时无法确认是否发送成功')).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: '重新确认发送结果' }));
    expect(发送).toHaveBeenLastCalledWith('candidate', '3003', '你好');
  });

  it('reason=in_progress 显示「消息仍在处理中，请稍后重试」，不提供放弃', async () => {
    const 发送 = vi.fn().mockResolvedValue({
      status: 'unknown', reason: 'in_progress', canAbandon: false, pendingContent: '你好',
    } as P7发送结果);
    环境({ 发送 });
    const 用户 = userEvent.setup();
    render(<Backend真人会话 role="candidate" conversationId="3003" />);
    await 用户.type(screen.getByRole('textbox', { name: '输入消息' }), '你好{Enter}');
    expect(screen.getByText('消息仍在处理中，请稍后重试')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '放弃本次发送' })).toBeNull();
    expect(screen.getByRole('button', { name: '重新确认发送结果' })).toBeTruthy();
  });

  it('read-through：只提交最新渲染的 user_text，重渲染不重复提交；system 行零提交', () => {
    const 消息: P7分页快照<P7消息> = {
      阶段: '成功', 刷新中: false, nextCursor: null, 已加载页数: 1, error: null, generation: 1,
      items: [系统行, 文本('4004', 'recruiter', '你好'), 文本('4005', 'candidate', '在吗')],
    };
    环境({ 消息 });
    const { rerender } = render(<Backend真人会话 role="candidate" conversationId="3003" />);
    expect(mock应用状态.操作.提交真人已读).toHaveBeenCalledTimes(1);
    expect(mock应用状态.操作.提交真人已读).toHaveBeenCalledWith('candidate', '3003', '4005');
    // 同批消息重渲染：零新调用（操作层单飞去重 + effect 依赖不变）
    rerender(<Backend真人会话 role="candidate" conversationId="3003" />);
    expect(mock应用状态.操作.提交真人已读).toHaveBeenCalledTimes(1);
  });

  it('read-through：只有 system 行时零提交', () => {
    const 消息: P7分页快照<P7消息> = {
      阶段: '成功', 刷新中: false, nextCursor: null, 已加载页数: 1, error: null, generation: 1,
      items: [系统行],
    };
    环境({ 消息 });
    render(<Backend真人会话 role="candidate" conversationId="3003" />);
    expect(mock应用状态.操作.提交真人已读).not.toHaveBeenCalled();
  });

  it('候选端「看职位」只在 context available 且 job_ref 在场时出现，点击走权威岗位路由', async () => {
    环境({});
    const 用户 = userEvent.setup();
    const { unmount } = render(<Backend真人会话 role="candidate" conversationId="3003" />);
    await 用户.click(screen.getByRole('button', { name: '看职位' }));
    expect(导航.跳转).toHaveBeenCalledWith('/job/job_00112233445566778899aabbccddeeff');
    expect(mock应用状态.操作.读取简历PDF).not.toHaveBeenCalled();
    // Backend 不渲染电话/微信
    expect(screen.queryByRole('button', { name: '电话' })).toBeNull();
    expect(screen.queryByRole('button', { name: '微信' })).toBeNull();
    unmount();

    // job_ref 缺席：隐藏「看职位」
    环境({ 详情: 详情快照({ detail: 会话详情({ context: { primaryLabel: '后端工程师', secondaryLabel: '上海', jobRef: null, resumeRef: null } }) }) });
    render(<Backend真人会话 role="candidate" conversationId="3003" />);
    expect(screen.queryByRole('button', { name: '看职位' })).toBeNull();
  });

  it('context 不可用：隐藏上下文动作，保留「重新加载会话信息」，消息仍渲染', async () => {
    环境({
      详情: 详情快照({ detail: 会话详情({ contextStatus: 'unavailable', context: null }) }),
      消息: { 阶段: '成功', 刷新中: false, nextCursor: null, 已加载页数: 1, error: null, generation: 1, items: [系统行, 文本('4004', 'recruiter', '你好')] },
    });
    const 用户 = userEvent.setup();
    render(<Backend真人会话 role="candidate" conversationId="3003" />);
    expect(screen.getByText('真人会话')).toBeTruthy();
    expect(screen.getByText('你好')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '看职位' })).toBeNull();
    await 用户.click(screen.getByRole('button', { name: '重新加载会话信息' }));
    expect(mock应用状态.操作.读取真人会话).toHaveBeenCalledWith('candidate', '3003', true);
  });

  it('招聘端「看简历」只在 resume_ref 在场时出现：点击才取 Case PDF，关闭/卸载回收租约', async () => {
    const 读取简历PDF = vi.fn().mockResolvedValue(PDF租约);
    环境({ role: 'recruiter', 读取简历PDF });
    const 用户 = userEvent.setup();
    const { unmount } = render(<Backend真人会话 role="recruiter" conversationId="3003" />);
    // 点击前零请求
    expect(读取简历PDF).not.toHaveBeenCalled();
    await 用户.click(screen.getByRole('button', { name: '看简历' }));
    await waitFor(() => expect(读取简历PDF).toHaveBeenCalledWith('recruiter', 'mc_3003'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(screen.getByTitle('简历 PDF')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '关闭' }));
    expect(PDF租约.revoke).toHaveBeenCalled();
    unmount();
    // resume_ref 缺席：隐藏「看简历」
    环境({
      role: 'recruiter',
      详情: 详情快照({ detail: 会话详情({ context: { primaryLabel: '后端工程师', secondaryLabel: 'candidate-0123', jobRef: null, resumeRef: null } }) }),
    });
    render(<Backend真人会话 role="recruiter" conversationId="3003" />);
    expect(screen.queryByRole('button', { name: '看简历' })).toBeNull();
  });
});

// ── review-r1：屏层发送与取件生命周期（Codex Round 1 发现）──────────────────────
describe('Backend真人会话 review-r1 修复', () => {
  it('F6：明确拒绝的发送恢复草稿且不覆盖在途编辑', async () => {
    let 应答!: (值: P7发送结果) => void;
    const 发送 = vi.fn().mockImplementation(
      () => new Promise<P7发送结果>((完成, 拒绝) => { 应答 = 拒绝 as typeof 应答; void 完成; }));
    环境({ 发送 });
    const 用户 = userEvent.setup();
    render(<Backend真人会话 role="candidate" conversationId="3003" />);
    const 输入框 = screen.getByRole('textbox', { name: '输入消息' }) as HTMLTextAreaElement;
    await 用户.type(输入框, '这条发不出去');
    await 用户.type(输入框, '{Enter}');
    expect(输入框.value).toBe(''); // 在飞清空
    // 在途期间用户已开始编辑新草稿
    await 用户.type(输入框, '新草稿');
    应答(new Error('明确拒绝') as never);
    await waitFor(() => expect(轻提示).toHaveBeenCalled());
    // 拒绝到达：草稿恢复为失败正文？不 —— 在途编辑优先，绝不覆盖用户已输入的新草稿
    await waitFor(() => expect((screen.getByRole('textbox', { name: '输入消息' }) as HTMLTextAreaElement).value).toBe('新草稿'));
  });

  it('F6b：拒绝到达时若用户未再编辑，失败正文原样回填草稿', async () => {
    let 失败!: (原因: unknown) => void;
    const 发送 = vi.fn().mockImplementation(
      () => new Promise<P7发送ResultShape>((完成, 拒绝) => { 失败 = 拒绝; void 完成; }));
    环境({ 发送 });
    const 用户 = userEvent.setup();
    render(<Backend真人会话 role="candidate" conversationId="3003" />);
    const 输入框 = screen.getByRole('textbox', { name: '输入消息' }) as HTMLTextAreaElement;
    await 用户.type(输入框, '这条发不出去');
    await 用户.type(输入框, '{Enter}');
    失败(new Error('明确拒绝'));
    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: '输入消息' }) as HTMLTextAreaElement).value).toBe('这条发不出去'));
  });

  it('F7：离开会话后迟到的 PDF 租约立即回收，不悬挂到会话边界', async () => {
    let 应答!: (租约: typeof PDF租约) => void;
    const 读取简历PDF = vi.fn().mockImplementation(() => new Promise<typeof PDF租约>((完成) => { 应答 = 完成; }));
    环境({ role: 'recruiter', 读取简历PDF });
    const 用户 = userEvent.setup();
    const { unmount } = render(<Backend真人会话 role="recruiter" conversationId="3003" />);
    await 用户.click(screen.getByRole('button', { name: '看简历' }));
    expect(读取简历PDF).toHaveBeenCalledWith('recruiter', 'mc_3003');
    // 取件在飞时离开：卸载清理先跑（当时无租约），迟到租约必须当场回收
    unmount();
    应答(PDF租约);
    await waitFor(() => expect(PDF租约.revoke).toHaveBeenCalled());
  });
});


// ── review-r2：屏层发送/PDF 的换会话归属（Codex Round 2 发现）───────────────────
describe('Backend真人会话 review-r2 修复', () => {
  it('R2-2：发送结算绑当前会话——换会话后迟到结果不进新会话', async () => {
    let 应答!: (值: P7发送结果) => void;
    const 发送 = vi.fn().mockImplementation(
      () => new Promise<P7发送结果>((完成) => { 应答 = 完成; }));
    环境({ 发送 });
    const 用户 = userEvent.setup();
    const { rerender } = render(<Backend真人会话 role="candidate" conversationId="3003" />);
    await 用户.type(screen.getByRole('textbox', { name: '输入消息' }), '旧会话的话');
    await 用户.type(screen.getByRole('textbox', { name: '输入消息' }), '{Enter}');
    // 发送在飞期间换会话
    rerender(<Backend真人会话 role="candidate" conversationId="3001" />);
    应答({ status: 'unknown', reason: 'outcome_unknown', canAbandon: true, pendingContent: '旧会话的话' });
    await act(async () => {});
    // 迟到的旧会话结果不进新会话：无未知提示、草稿不被旧正文回填
    expect(screen.queryByText('暂时无法确认是否发送成功')).toBeNull();
    expect((screen.getByRole('textbox', { name: '输入消息' }) as HTMLTextAreaElement).value).toBe('');
  });

  it('R2-3：重新确认按不可变待定正文重试，不清在编草稿', async () => {
    const 发送 = vi.fn()
      .mockResolvedValueOnce({
        status: 'unknown', reason: 'outcome_unknown', canAbandon: true, pendingContent: '你好',
      } as P7发送结果)
      .mockResolvedValueOnce({ status: 'confirmed' } as P7发送结果);
    环境({ 发送 });
    const 用户 = userEvent.setup();
    render(<Backend真人会话 role="candidate" conversationId="3003" />);
    await 用户.type(screen.getByRole('textbox', { name: '输入消息' }), '你好{Enter}');
    await waitFor(() => expect(screen.getByText('暂时无法确认是否发送成功')).toBeTruthy());
    // 结果未知期间用户编辑了新草稿
    const 输入框 = screen.getByRole('textbox', { name: '输入消息' }) as HTMLTextAreaElement;
    await 用户.type(输入框, '新草稿');
    await 用户.click(screen.getByRole('button', { name: '重新确认发送结果' }));
    // 重试按待定正文（你好），在编草稿原样保留
    await waitFor(() => expect(发送).toHaveBeenLastCalledWith('candidate', '3003', '你好'));
    expect((screen.getByRole('textbox', { name: '输入消息' }) as HTMLTextAreaElement).value).toBe('新草稿');
  });

  it('R2-4：换会话后旧会话的在飞取件不挡新会话，迟到失败不提示', async () => {
    let 失败A!: (原因: unknown) => void;
    const 读取简历PDF = vi.fn()
      .mockImplementationOnce(() => new Promise<typeof PDF租约>((_, 拒绝) => { 失败A = 拒绝; }))
      .mockResolvedValueOnce(PDF租约);
    环境({ role: 'recruiter', 读取简历PDF });
    // 新会话坐标也要有可看简历的详情快照（context available + resume_ref 在场）
    mock应用状态.后端状态.P7会话详情['p7:detail:recruiter:3001'] = 详情快照();
    const 用户 = userEvent.setup();
    const { rerender } = render(<Backend真人会话 role="recruiter" conversationId="3003" />);
    await 用户.click(screen.getByRole('button', { name: '看简历' }));
    expect(读取简历PDF).toHaveBeenCalledTimes(1);
    // 旧会话取件在飞期间换会话：新会话的取件不被旧锁挡住
    rerender(<Backend真人会话 role="recruiter" conversationId="3001" />);
    await 用户.click(screen.getByRole('button', { name: '看简历' }));
    await waitFor(() => expect(读取简历PDF).toHaveBeenCalledTimes(2));
    expect(读取简历PDF).toHaveBeenLastCalledWith('recruiter', 'mc_3003'); // 详情快照仍是 fixture 的 3003 详情
    // 旧会话的迟到失败：不提示（新会话视角下是无关错误）
    失败A(new Error('旧会话取件失败'));
    await act(async () => {});
    expect(轻提示).not.toHaveBeenCalled();
  });
});

// ── P8 Task 7：会话上下文举报 ──────────────────────────────────────
//   ⋯ 保持原 span 与 class，补键盘可达（role=button + tabIndex + Enter/Space）；
//   举报 target 恒为 {type:'conversation', ref:conversationId}（路由坐标，不是
//   展示名）；确认回执后强制重读该会话；绝不本地拉黑、绝不用 match_case 目标。
describe('Backend真人会话 · P8 会话举报', () => {
  beforeEach(() => {
    派发spy.mockClear();
  });

  it('⋯ 是键盘可达控件：点击 / Enter / Space 都打开同一个举报层', async () => {
    const 用户 = userEvent.setup();
    环境({});
    const 视图 = render(<Backend真人会话 role="candidate" conversationId="3003" />);
    const 点号 = screen.getByRole('button', { name: '举报' });
    // 视觉合同：仍是那枚 ⋯ 文本（不是换成重置过字体的原生按钮）
    expect(点号.textContent).toBe('⋯');
    await 用户.click(点号);
    expect(screen.getByRole('dialog', { name: '举报' })).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '取消' }));
    // Enter 打开
    fireEvent.keyDown(screen.getByRole('button', { name: '举报' }), { key: 'Enter' });
    expect(screen.getByRole('dialog', { name: '举报' })).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '取消' }));
    // Space 打开
    fireEvent.keyDown(screen.getByRole('button', { name: '举报' }), { key: ' ' });
    expect(screen.getByRole('dialog', { name: '举报' })).toBeTruthy();
    视图.unmount();
  });

  it('提交举报：target 是不可变会话坐标，确认后强制重读该会话', async () => {
    const 提交P8举报 = vi.fn().mockResolvedValue(举报回执);
    环境({ 提交P8举报 });
    const 读取真人会话 = mock应用状态.操作.读取真人会话;
    const 用户 = userEvent.setup();
    const 视图 = render(<Backend真人会话 role="candidate" conversationId="3003" />);
    await 用户.click(screen.getByRole('button', { name: '举报' }));
    await 用户.click(screen.getByRole('button', { name: '骚扰' }));
    await 用户.click(screen.getByRole('button', { name: /同时屏蔽/ }));
    await 用户.click(screen.getByRole('button', { name: '提交举报' }));
    await waitFor(() => expect(提交P8举报).toHaveBeenCalledWith(
      { type: 'conversation', ref: '3003' }, 'harassment', true));
    await waitFor(() => expect(读取真人会话).toHaveBeenCalledWith('candidate', '3003', true));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '举报' })).toBeNull());
    视图.unmount();
  });

  it('举报绝不本地拉黑；目标不是 match_case（P8 没有为 MatchCase 加举报按钮）', async () => {
    const 提交P8举报 = vi.fn().mockResolvedValue(举报回执);
    环境({ role: 'recruiter', 提交P8举报 });
    const 用户 = userEvent.setup();
    const 视图 = render(<Backend真人会话 role="recruiter" conversationId="3003" />);
    await 用户.click(screen.getByRole('button', { name: '举报' }));
    await 用户.click(screen.getByRole('button', { name: '其他' }));
    await 用户.click(screen.getByRole('button', { name: '提交举报' }));
    await waitFor(() => expect(提交P8举报).toHaveBeenCalledTimes(1));
    expect(提交P8举报.mock.calls[0][0]).toEqual({ type: 'conversation', ref: '3003' });
    expect(派发spy).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '拉黑' }));
    视图.unmount();
    // 源码合同：⋯ 仍是共用样式类的那枚 span，绝无 match_case 目标
    expect(Backend真人会话tsx源码).toContain('className={共用样式.更多}');
    expect(Backend真人会话tsx源码).not.toContain("type: 'match_case'");
  });
});
