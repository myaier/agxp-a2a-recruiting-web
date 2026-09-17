// P7 Backend 真人会话（双角色共用）的行为测试 —— 直达读取与可见会话注册、
// 双端 sender 对齐与中性 system 行、时间序渲染与「加载更早」、404 清空旧内容 /
// 503 保留旧成功、Enter 发送与 Shift+Enter 换行、code point 上限、无乐观气泡、
// unknown 三分支（重新确认 / 可放弃 / in_progress 不可放弃）与放弃保留在编草稿、
// read-through 只认最新渲染的 user_text；展示增量（Spec §11）：操作栏三项恢复
// Mock 同款（主项盖全屏层、电话/微信缺失占位）、页头读 Case 身份、消息行共用
// 气泡 + markdown + 每条 createdAt 本地时间。Task 4（Spec §4）：招聘主项改
// 「看在线简历」——打开同 Case 身份 + candidate_resume 的纯展示纸身，本入口
// 零 PDF lease 请求（读取简历PDF 桩只用于断言绝不被调用）；加载/失败/重试在
// 消费页面管理；失权/换会话关闭旧层。绝不 import Mock 联系人或 Mock 消息 fixture。

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { P7会话项, P7消息 } from '../../数据/招聘数据源/真人会话';
import type { P7发送结果, P7分页快照, P7详情快照 } from '../../状态/后端/类型';
/** F6 测试内的发送结果别名（避免与导入名冲突的行内形状）。 */
type P7发送ResultShape = { status: 'confirmed' } | { status: 'unknown'; reason: string; canAbandon: boolean; pendingContent: string };
import Backend真人会话 from './Backend真人会话';
// 仓库既有的 ?raw 源码合同模式（⋯ 控件形态 / 举报目标类型）
import Backend真人会话tsx源码 from './Backend真人会话.tsx?raw';
// Task 3：头像几何走 共用气泡对侧留白 的源码合同（jsdom 不做版式，Task 6 浏览器证明；
// 仓库既有 readFileSync 读 CSS 源码的合同模式，见 聊天气泡.test.tsx）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import 共用样式 from '../直聊会话.module.css';
import { 轻提示 } from '../../组件/轻提示';
import { 格式化聊天时间 } from '../../组件/聊天气泡';
import { 候选详情DTO, 招聘详情DTO, 状态 } from '../P5/MatchCase详情.测试辅助';
import { BFF招聘方档案样本 } from '../../测试/BFF样本';
import { BFF候选在线简历样本, BFF候选身份披露样本, BFF候选身份匿名样本 } from '../../测试/展示资料样本';
import type { P8ReportReceipt } from '../../数据/招聘数据源/P8控制面';

const 导航 = vi.hoisted(() => ({ 跳转: vi.fn(), 返回: vi.fn() }));
vi.mock('../../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../../路由/导航钩子', () => ({ use导航: () => 导航 }));
vi.mock('../../组件/轻提示', () => ({ 轻提示: vi.fn() }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

/** 真人会话.module.css 源码（对侧留白镜像净空的源码合同）。 */
const 真人会话css源码 = readFileSync(join(process.cwd(), 'src', '屏幕', '真人会话.module.css'), 'utf8');

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
  提交P8举报?: (target: unknown, reason: unknown, alsoBlock: unknown) => Promise<P8ReportReceipt>;
  /** P5 详情快照（use真人会话资料 消费；键 = P5范围键.detail(role, caseId)） */
  P5详情?: Record<string, unknown>;
  /** Task 3：我方头像来源覆盖（候选账号图 / 招聘方档案）。 */
  求职头像?: string | null;
  招聘方档案?: Record<string, unknown> | null;
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
      P5详情: input.P5详情 ?? {},
      候选岗位详情: {},
    },
    状态: {
      基本信息: { 真名: '沈亦舟' },
      求职头像: input.求职头像 ?? null,
      招聘方档案: input.招聘方档案 ?? null,
      公开企业表: {},
      不可用公开企业编号: [],
    },
    操作: {
      设置P7会话范围: vi.fn(),
      读取真人会话: vi.fn().mockResolvedValue(undefined),
      追加更早消息: vi.fn().mockResolvedValue(undefined),
      发送真人消息: input.发送 ?? vi.fn().mockResolvedValue({ status: 'confirmed' }),
      放弃真人消息意图: vi.fn(),
      提交真人已读: vi.fn().mockResolvedValue(undefined),
      // Task 4：招聘聊天简历入口零 PDF lease 请求 —— 桩只用于「绝不被调用」的反例断言
      读取简历PDF: vi.fn(),
      提交P8举报: input.提交P8举报 ?? vi.fn().mockResolvedValue(举报回执),
      读取详情: vi.fn().mockResolvedValue(undefined),
      读取候选岗位详情: vi.fn().mockResolvedValue(undefined),
      读取公开企业: vi.fn().mockResolvedValue(undefined),
    },
  };
  return role;
}

/** 举报层断言用的全局 spy（举报绝不本地拉黑）。 */
const 派发spy = vi.fn();
const 举报回执: P8ReportReceipt = { ticketId: 'TICKET-P8-RPT-001', status: 'received', blockStatus: 'not_requested' };

/**
 * Task 4：招聘端 P5 详情快照 —— 同 Case candidate_resume + candidate_identity。
 * 默认 = 展示资料域完整样本（disclosed 沈亦舟）；按覆盖换简历/身份/别名。
 */
function 披露简历详情(覆盖: {
  candidateResume?: typeof BFF候选在线简历样本 | null;
  candidateIdentity?: typeof BFF候选身份披露样本;
  别名?: string;
} = {}): Record<string, unknown> {
  return {
    阶段: '成功', 刷新中: false, error: null, generation: 1,
    detail: {
      ...招聘详情DTO({ 别名: 覆盖.别名 ?? 'C-07' }),
      state: 状态({ caseId: 'mc_3003' }),
      candidateResume: 覆盖.candidateResume !== undefined ? 覆盖.candidateResume : BFF候选在线简历样本,
      candidateIdentity: 覆盖.candidateIdentity ?? { ...BFF候选身份披露样本, avatar_url: null },
    },
  };
}

beforeEach(() => {
  导航.跳转.mockClear();
  vi.mocked(轻提示).mockClear();
});

describe('Backend真人会话', () => {
  it('直达注册可见会话并读取详情+最新消息，卸载注销', () => {
    环境({});
    const { unmount } = render(<Backend真人会话 角色="candidate" conversationId="3003" />);
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
    const { unmount } = render(<Backend真人会话 角色="candidate" conversationId="3003" />);
    expect(screen.getByText('双方已确认意向，现在可以直接沟通')).toBeTruthy();
    expect(screen.getByText('你好，想约时间聊聊').closest('[data-侧]')?.getAttribute('data-侧')).toBe('左');
    expect(screen.getByText('可以的').closest('[data-侧]')?.getAttribute('data-侧')).toBe('右');
    unmount();

    // 招聘端视角：同一条 recruiter 消息落在右侧
    环境({ role: 'recruiter', 消息 });
    render(<Backend真人会话 角色="recruiter" conversationId="3003" />);
    expect(screen.getByText('你好，想约时间聊聊').closest('[data-侧]')?.getAttribute('data-侧')).toBe('右');
    expect(screen.getByText('可以的').closest('[data-侧]')?.getAttribute('data-侧')).toBe('左');
  });

  it('时间序渲染 + next_cursor 在场时提供「加载更早」；游标已尽不渲染', async () => {
    const 消息: P7分页快照<P7消息> = {
      阶段: '成功', 刷新中: false, nextCursor: 'older_1', 已加载页数: 1, error: null, generation: 1,
      items: [系统行, 文本('4004', 'candidate', '在吗')],
    };
    环境({ 消息 });
    render(<Backend真人会话 角色="candidate" conversationId="3003" />);
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
    render(<Backend真人会话 角色="candidate" conversationId="3003" />);
    expect(screen.getByText('这段会话不存在或已不可访问')).toBeTruthy();
    // 消息保留旧成功内容 + 错误行
    expect(screen.getByText('在吗')).toBeTruthy();
    expect(screen.getByText('消息服务暂时不可用，请重试')).toBeTruthy();
  });

  it('Enter 发送 trim 后正文、Shift+Enter 换行不发送、code point 上限按 Array.from 计', async () => {
    const 发送 = vi.fn().mockResolvedValue({ status: 'confirmed' } as P7发送结果);
    环境({ 发送 });
    const 用户 = userEvent.setup();
    render(<Backend真人会话 角色="candidate" conversationId="3003" />);
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
    render(<Backend真人会话 角色="candidate" conversationId="3003" />);
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
    render(<Backend真人会话 角色="candidate" conversationId="3003" />);
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
    render(<Backend真人会话 角色="candidate" conversationId="3003" />);
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
    const { rerender } = render(<Backend真人会话 角色="candidate" conversationId="3003" />);
    expect(mock应用状态.操作.提交真人已读).toHaveBeenCalledTimes(1);
    expect(mock应用状态.操作.提交真人已读).toHaveBeenCalledWith('candidate', '3003', '4005');
    // 同批消息重渲染：零新调用（操作层单飞去重 + effect 依赖不变）
    rerender(<Backend真人会话 角色="candidate" conversationId="3003" />);
    expect(mock应用状态.操作.提交真人已读).toHaveBeenCalledTimes(1);
  });

  it('read-through：只有 system 行时零提交', () => {
    const 消息: P7分页快照<P7消息> = {
      阶段: '成功', 刷新中: false, nextCursor: null, 已加载页数: 1, error: null, generation: 1,
      items: [系统行],
    };
    环境({ 消息 });
    render(<Backend真人会话 角色="candidate" conversationId="3003" />);
    expect(mock应用状态.操作.提交真人已读).not.toHaveBeenCalled();
  });

  it('候选端「看职位」盖全屏层（不再路由跳转）：电话/微信诚实缺失占位，无复制', async () => {
    // P5 补读成功但冻结 jobDetail 缺席：层内诚实显示「职位资料暂不可用」+ 定向重读
    环境({
      P5详情: {
        'p5:detail:candidate:mc_3003': {
          阶段: '成功', 刷新中: false, error: null, generation: 1,
          detail: { ...候选详情DTO(), state: 状态({ caseId: 'mc_3003' }) },
        },
      },
    });
    const 用户 = userEvent.setup();
    const { unmount } = render(<Backend真人会话 角色="candidate" conversationId="3003" />);
    // 三项排列恢复 Mock 同款；电话/微信是缺失占位（Spec §11.4）
    expect(screen.getByRole('button', { name: '看职位' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '电话' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '微信' })).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '电话' }));
    expect(screen.getByText('电话暂未提供')).toBeTruthy();
    // 主项开层：不再跳岗位路由，也不取 PDF
    await 用户.click(screen.getByRole('button', { name: '看职位' }));
    expect(screen.getByRole('dialog', { name: '看职位' })).toBeTruthy();
    expect(导航.跳转).not.toHaveBeenCalled();
    expect(mock应用状态.操作.读取简历PDF).not.toHaveBeenCalled();
    // 职位资料缺冻结 jobDetail：层内显示不可用 + 定向重读（不拿当前岗位替代）
    expect(screen.getByText('职位资料暂不可用')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '继续沟通' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    unmount();
  });

  it('context 不可用：主项占位禁用、保留「重新加载会话信息」，消息仍渲染', async () => {
    环境({
      详情: 详情快照({ detail: 会话详情({ contextStatus: 'unavailable', context: null }) }),
      消息: { 阶段: '成功', 刷新中: false, nextCursor: null, 已加载页数: 1, error: null, generation: 1, items: [系统行, 文本('4004', 'recruiter', '你好')] },
    });
    const 用户 = userEvent.setup();
    render(<Backend真人会话 角色="candidate" conversationId="3003" />);
    expect(screen.getByText('真人会话')).toBeTruthy();
    expect(screen.getByText('你好')).toBeTruthy();
    const 主项 = screen.getByRole('button', { name: '看职位' }) as HTMLButtonElement;
    expect(主项.disabled).toBe(true);
    await 用户.click(主项);
    expect(screen.queryByRole('dialog')).toBeNull();
    await 用户.click(screen.getByRole('button', { name: '重新加载会话信息' }));
    expect(mock应用状态.操作.读取真人会话).toHaveBeenCalledWith('candidate', '3003', true);
  });

  it('招聘端「看在线简历」打开纸身：同 Case 身份 + candidate_resume，零 PDF lease 请求，继续沟通关闭', async () => {
    环境({ role: 'recruiter', P5详情: { 'p5:detail:recruiter:mc_3003': 披露简历详情() } });
    const 用户 = userEvent.setup();
    const { unmount } = render(<Backend真人会话 角色="recruiter" conversationId="3003" />);
    await 用户.click(screen.getByRole('button', { name: '看在线简历' }));
    const 层 = within(screen.getByRole('dialog', { name: '看在线简历' }));
    // 纸身：姓名来自同 Case disclosed 身份，区段来自同 Case candidate_resume
    await waitFor(() => expect(层.getByText('沈亦舟')).toBeTruthy());
    expect(层.getByText('软件工程师 · 5 年经验')).toBeTruthy();
    expect(层.getByText('手机：—')).toBeTruthy();
    expect(层.getByText('邮箱：—')).toBeTruthy();
    expect(层.getByText('云衢')).toBeTruthy();
    expect(层.getByText('2021.01 — 至今')).toBeTruthy();
    expect(层.getByText('复旦大学')).toBeTruthy();
    expect(层.getByText('四年全栈经验')).toBeTruthy();
    // 联系方式绝不取 Mock 演示值
    expect(screen.queryByText('138 0217 6021')).toBeNull();
    // 本入口零 PDF lease 请求（Task 4 删除该入口租约代码）
    expect(mock应用状态.操作.读取简历PDF).not.toHaveBeenCalled();
    // 继续沟通关层回到聊天
    await 用户.click(screen.getByRole('button', { name: '继续沟通' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    unmount();
    // resume_ref 缺席但结构化资料可读：主项仍可打开（不再以附件坐标为门）
    环境({
      role: 'recruiter',
      详情: 详情快照({ detail: 会话详情({ context: { primaryLabel: '后端工程师', secondaryLabel: 'candidate-0123', jobRef: null, resumeRef: null } }) }),
      P5详情: { 'p5:detail:recruiter:mc_3003': 披露简历详情() },
    });
    render(<Backend真人会话 角色="recruiter" conversationId="3003" />);
    const 主项 = screen.getByRole('button', { name: '看在线简历' }) as HTMLButtonElement;
    expect(主项.disabled).toBe(false);
    await 用户.click(主项);
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: '看在线简历' })).getByText('沈亦舟')).toBeTruthy());
    expect(mock应用状态.操作.读取简历PDF).not.toHaveBeenCalled();
  });

  it('招聘页头读 Case 身份：disclosed 有名显真名、副标题为 Case 职位名', async () => {
    环境({
      role: 'recruiter',
      P5详情: {
        'p5:detail:recruiter:mc_3003': {
          阶段: '成功', 刷新中: false, error: null, generation: 1,
          detail: {
            ...招聘详情DTO({ 别名: 'C-07' }),
            state: 状态({ caseId: 'mc_3003' }),
            candidateIdentity: { state: 'disclosed', name: '陈屿', avatar_url: null, disclosed_at: null },
          },
        },
      },
    });
    render(<Backend真人会话 角色="recruiter" conversationId="3003" />);
    await waitFor(() => expect(screen.getByText('陈屿')).toBeTruthy());
    expect(screen.getByText('平台工程师')).toBeTruthy();
  });

  it('review-r1 F1：同会话 context 失权 —— 弹层关闭（授权 key 重挂），消息仍可读', async () => {
    环境({ role: 'recruiter', P5详情: { 'p5:detail:recruiter:mc_3003': 披露简历详情() } });
    const 用户 = userEvent.setup();
    const 页 = render(<Backend真人会话 角色="recruiter" conversationId="3003" />);
    await 用户.click(screen.getByRole('button', { name: '看在线简历' }));
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: '看在线简历' })).getByText('沈亦舟')).toBeTruthy());
    // context 变 unavailable：层关闭（授权 key 重挂），旧纸身不残留
    mock应用状态.后端状态.P7会话详情['p7:detail:recruiter:3003'] = 详情快照({
      detail: 会话详情({ contextStatus: 'unavailable', context: null }),
    });
    页.rerender(<Backend真人会话 角色="recruiter" conversationId="3003" />);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText('沈亦舟')).toBeNull();
    // 主项占位禁用、消息区仍渲染
    expect((screen.getByRole('button', { name: '看在线简历' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('消息行共用气泡与 markdown：时间取每条 createdAt 本地格式化，不再 UTC 截取', () => {
    const 消息: P7分页快照<P7消息> = {
      阶段: '成功', 刷新中: false, nextCursor: null, 已加载页数: 1, error: null, generation: 1,
      items: [
        文本('4004', 'recruiter', '收到，**今天到岗**可以'),
        { ...文本('4005', 'candidate', 'HiHi'), createdAt: '2026-09-16T01:09:00Z' },
      ],
    };
    环境({ 消息 });
    const 页 = render(<Backend真人会话 角色="candidate" conversationId="3003" />);
    // markdown 正文：**今天到岗** 解析为 strong
    expect(页.container.querySelector('strong')?.textContent).toBe('今天到岗');
    // 每条各用各的时间（01:00Z / 01:09Z 本地时区分辨分钟差；与 格式化聊天时间 同源）
    const 时间节点们 = 页.container.querySelectorAll('time');
    expect(时间节点们).toHaveLength(2);
    expect(时间节点们[0]?.textContent).toBe(格式化聊天时间('2026-08-30T01:00:00Z'));
    expect(时间节点们[1]?.textContent).toBe(格式化聊天时间('2026-09-16T01:09:00Z'));
    // data-侧 回归锚点保留
    expect(页.container.querySelector('[data-侧="左"]')).toBeTruthy();
    expect(页.container.querySelector('[data-侧="右"]')).toBeTruthy();
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
    render(<Backend真人会话 角色="candidate" conversationId="3003" />);
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
    render(<Backend真人会话 角色="candidate" conversationId="3003" />);
    const 输入框 = screen.getByRole('textbox', { name: '输入消息' }) as HTMLTextAreaElement;
    await 用户.type(输入框, '这条发不出去');
    await 用户.type(输入框, '{Enter}');
    失败(new Error('明确拒绝'));
    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: '输入消息' }) as HTMLTextAreaElement).value).toBe('这条发不出去'));
  });

  it('F7（Task 4 改写）：离开会话后重开不残留旧纸身 —— 简历纸身来自当前 Case 快照，无跨会话租约/缓存', async () => {
    环境({ role: 'recruiter', P5详情: { 'p5:detail:recruiter:mc_3003': 披露简历详情() } });
    const 用户 = userEvent.setup();
    const 页 = render(<Backend真人会话 角色="recruiter" conversationId="3003" />);
    await 用户.click(screen.getByRole('button', { name: '看在线简历' }));
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: '看在线简历' })).getByText('沈亦舟')).toBeTruthy());
    // 离开会话（卸载）后再进新会话：纸身内容随会话坐标走，绝不闪现旧会话正文
    页.unmount();
    mock应用状态.后端状态.P7会话详情['p7:detail:recruiter:3001'] = 详情快照({
      detail: 会话详情({ conversationId: '3001', caseId: 'mc_3001' }),
    });
    render(<Backend真人会话 角色="recruiter" conversationId="3001" />);
    expect(mock应用状态.操作.读取简历PDF).not.toHaveBeenCalled();
    await 用户.click(screen.getByRole('button', { name: '看在线简历' }));
    // 新会话无 P5 快照：层内是读取中占位，旧会话纸身内容不闪现
    expect(within(screen.getByRole('dialog', { name: '看在线简历' })).getByText('正在读取在线简历…')).toBeTruthy();
    expect(screen.queryByText('沈亦舟')).toBeNull();
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
    const { rerender } = render(<Backend真人会话 角色="candidate" conversationId="3003" />);
    await 用户.type(screen.getByRole('textbox', { name: '输入消息' }), '旧会话的话');
    await 用户.type(screen.getByRole('textbox', { name: '输入消息' }), '{Enter}');
    // 发送在飞期间换会话
    rerender(<Backend真人会话 角色="candidate" conversationId="3001" />);
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
    render(<Backend真人会话 角色="candidate" conversationId="3003" />);
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

  it('R2-4（Task 4 改写）：换会话关闭旧层 —— 授权 key 随会话坐标重挂，旧纸身不进新会话', async () => {
    环境({ role: 'recruiter', P5详情: { 'p5:detail:recruiter:mc_3003': 披露简历详情() } });
    mock应用状态.后端状态.P7会话详情['p7:detail:recruiter:3001'] = 详情快照({
      detail: 会话详情({ conversationId: '3001', caseId: 'mc_3001' }),
    });
    const 用户 = userEvent.setup();
    const { rerender } = render(<Backend真人会话 角色="recruiter" conversationId="3003" />);
    await 用户.click(screen.getByRole('button', { name: '看在线简历' }));
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: '看在线简历' })).getByText('沈亦舟')).toBeTruthy());
    // 换会话（层开着）：层随授权 key 关闭，旧会话纸身不闪现
    rerender(<Backend真人会话 角色="recruiter" conversationId="3001" />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('沈亦舟')).toBeNull();
    // 新会话重新打开：零 PDF 请求；旧会话的迟到结果无从谈起（纸身无在飞请求）
    await 用户.click(screen.getByRole('button', { name: '看在线简历' }));
    expect(within(screen.getByRole('dialog', { name: '看在线简历' })).getByText('正在读取在线简历…')).toBeTruthy();
    expect(mock应用状态.操作.读取简历PDF).not.toHaveBeenCalled();
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
    const 视图 = render(<Backend真人会话 角色="candidate" conversationId="3003" />);
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
    const 视图 = render(<Backend真人会话 角色="candidate" conversationId="3003" />);
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
    const 视图 = render(<Backend真人会话 角色="recruiter" conversationId="3003" />);
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

// ── Task 3：真人消息 32px 头像与本人照片（Spec §3）────────────────────────────
// 我方按角色读已有账号资料（候选 = 求职头像（commit 即带 ?v=revision 缓存戳）、
// 招聘 = 档案 avatar_url + revision 缓存戳），直达会话即渲染；双方图片加载失败回退
// 各自真实姓名首字（取姓名首字：trim 后首个 Unicode 码点，缺名「·」—— 绝不从回退
// 标题/占位/alias 取字）；换 URL 整点重挂重新尝试；删图/换账号清掉旧图与失败状态，
// 绝不串图。绝不拿演示人像填 Backend 缺图（本屏不 import Mock 数据）。

/** 双端各一条 user_text：左右行同时在场，头像断言两侧都能落点。 */
const 双方消息: P7分页快照<P7消息> = {
  阶段: '成功', 刷新中: false, nextCursor: null, 已加载页数: 1, error: null, generation: 1,
  items: [文本('4004', 'recruiter', '你好'), 文本('4005', 'candidate', '可以')],
};

/** 候选端视角的对方（发布人）授权档案：其余 jobDetail 键全 null（映射只消费
 *  publisher_profile 的姓名/头像）。 */
function 发布人档案详情(发布人: { 姓名: string; 头像: string | null }): Record<string, unknown> {
  return {
    阶段: '成功', 刷新中: false, error: null, generation: 1,
    detail: {
      ...候选详情DTO(),
      state: 状态({ caseId: 'mc_3003' }),
      jobDetail: {
        title: '后端工程师', description: null, requirements: null, recruitment_type: null,
        category: null, location: null, office_location: null, workplace_mode: null,
        salary_lower: null, salary_upper: null, salary_period: null, annual_salary_months: null,
        campus_cohort: null, internship_months: null, onsite_days_per_week: null,
        experience_requirement: null, education_requirement: null, hard_requirements: null,
        structured_requirements_confirmed: null, keywords: null, organization: null,
        company_intro: null, office_address: null, benefit_codes: null,
        publisher_profile: {
          public_name: 发布人.姓名, title: '招聘负责人',
          personal_verification_status: 'verified', avatar_url: 发布人.头像,
        },
      },
    },
  };
}

/** 招聘端视角的对方（候选人）disclosed 身份详情：姓名/头像独立给值。 */
function 披露身份详情(身份: { name: string | null; 头像: string | null }): Record<string, unknown> {
  return {
    阶段: '成功', 刷新中: false, error: null, generation: 1,
    detail: {
      ...招聘详情DTO({ 别名: 'C-07' }),
      state: 状态({ caseId: 'mc_3003' }),
      candidateIdentity: { state: 'disclosed', name: 身份.name, avatar_url: 身份.头像, disclosed_at: null },
    },
  };
}

function 我方头像图(容器: HTMLElement): HTMLImageElement | null {
  return 容器.querySelector('[data-侧="右"] img');
}
function 对方头像图(容器: HTMLElement): HTMLImageElement | null {
  return 容器.querySelector('[data-侧="左"] img');
}
function 我方头像字(容器: HTMLElement): string {
  return 容器.querySelector(`[data-侧="右"] .${共用样式.我头像}`)?.textContent ?? '';
}
function 对方头像字(容器: HTMLElement): string {
  return 容器.querySelector(`[data-侧="左"] .${共用样式.对方头像}`)?.textContent ?? '';
}

describe('Backend真人会话 · 真人消息头像（Spec §3）', () => {
  it('候选直达会话：我方头像直接读当前账号求职头像（?v=revision 缓存戳原样）', async () => {
    环境({ 求职头像: '/api/v1/me/avatar/content?v=7', 消息: 双方消息 });
    const 页 = render(<Backend真人会话 角色="candidate" conversationId="3003" />);
    await waitFor(() => expect(我方头像图(页.container)).toBeTruthy());
    expect(我方头像图(页.container)?.getAttribute('src')).toBe('/api/v1/me/avatar/content?v=7');
  });

  it('招聘端我方头像读档案 avatar_url，并按 revision 组同样的缓存戳', async () => {
    环境({
      role: 'recruiter',
      招聘方档案: { ...BFF招聘方档案样本, avatar_url: '/api/v1/recruiter/avatar/content', revision: 5 },
      消息: 双方消息,
    });
    const 页 = render(<Backend真人会话 角色="recruiter" conversationId="3003" />);
    await waitFor(() =>
      expect(我方头像图(页.container)?.getAttribute('src')).toBe('/api/v1/recruiter/avatar/content?v=5'));
  });

  it('双方图片加载失败回退各自真实姓名首字（不从回退标题/占位取字）', async () => {
    环境({
      求职头像: '/api/v1/me/avatar/content?v=7',
      P5详情: { 'p5:detail:candidate:mc_3003': 发布人档案详情({ 姓名: '林澈', 头像: 'https://cdn.example.com/p.png' }) },
      消息: 双方消息,
    });
    const 页 = render(<Backend真人会话 角色="candidate" conversationId="3003" />);
    await waitFor(() => expect(对方头像图(页.container)).toBeTruthy());
    fireEvent.error(我方头像图(页.container)!);
    fireEvent.error(对方头像图(页.container)!);
    // 我方回退本人真名（沈亦舟）首字；对方回退其真名（林澈）首字 —— 各取各的
    expect(我方头像图(页.container)).toBeNull();
    expect(我方头像字(页.container)).toBe('沈');
    expect(对方头像字(页.container)).toBe('林');
  });

  it('有图无名仍显示图；坏图回退为「·」而不是页头占位文案或 alias 首字', async () => {
    环境({
      role: 'recruiter',
      P5详情: { 'p5:detail:recruiter:mc_3003': 披露身份详情({ name: null, 头像: 'https://cdn.example.com/c.png' }) },
      消息: 双方消息,
    });
    const 页 = render(<Backend真人会话 角色="recruiter" conversationId="3003" />);
    // 头像独立于姓名：disclosed 无名时页头是占位文案，头像仍是授权图
    await waitFor(() => expect(screen.getByText('候选人姓名暂未提供')).toBeTruthy());
    expect(对方头像图(页.container)?.getAttribute('src')).toBe('https://cdn.example.com/c.png');
    // 坏图回退取原始姓名首字（缺名 = 「·」），绝不取「候选人姓名暂未提供」或 C-07 的首字
    fireEvent.error(对方头像图(页.container)!);
    expect(对方头像图(页.container)).toBeNull();
    expect(对方头像字(页.container)).toBe('·');
  });

  it('本轮缺图缺名：头像为「·」，绝不拿 alias 代真名首字', async () => {
    环境({
      role: 'recruiter',
      P5详情: { 'p5:detail:recruiter:mc_3003': 披露身份详情({ name: null, 头像: null }) },
      消息: 双方消息,
    });
    const 页 = render(<Backend真人会话 角色="recruiter" conversationId="3003" />);
    await waitFor(() => expect(screen.getByText('候选人姓名暂未提供')).toBeTruthy());
    expect(对方头像图(页.container)).toBeNull();
    expect(对方头像字(页.container)).toBe('·');
  });

  it('换 URL 整点重挂重新尝试加载（失败状态不粘住新图）', async () => {
    环境({
      P5详情: { 'p5:detail:candidate:mc_3003': 发布人档案详情({ 姓名: '林澈', 头像: 'https://cdn.example.com/p.png' }) },
      消息: 双方消息,
    });
    const 页 = render(<Backend真人会话 角色="candidate" conversationId="3003" />);
    await waitFor(() => expect(对方头像图(页.container)?.getAttribute('src')).toBe('https://cdn.example.com/p.png'));
    fireEvent.error(对方头像图(页.container)!);
    expect(对方头像图(页.container)).toBeNull();
    // 对方头像换新 URL（如服务端替换头像）：重挂重新加载，不沿用旧失败状态
    mock应用状态.后端状态.P5详情['p5:detail:candidate:mc_3003']
      = 发布人档案详情({ 姓名: '林澈', 头像: 'https://cdn.example.com/p2.png' });
    页.rerender(<Backend真人会话 角色="candidate" conversationId="3003" />);
    await waitFor(() => expect(对方头像图(页.container)?.getAttribute('src')).toBe('https://cdn.example.com/p2.png'));
  });

  it('删图/换账号：旧图与失败状态一并清掉，回落本人首字，绝不串图', async () => {
    环境({ 求职头像: '/api/v1/me/avatar/content?v=7', 消息: 双方消息 });
    const 页 = render(<Backend真人会话 角色="candidate" conversationId="3003" />);
    await waitFor(() => expect(我方头像图(页.container)?.getAttribute('src')).toBe('/api/v1/me/avatar/content?v=7'));
    fireEvent.error(我方头像图(页.container)!);
    expect(我方头像字(页.container)).toBe('沈');
    // 账号切换清空账号资料（求职头像 → null）：旧图 URL 不再出现在页面任何位置
    mock应用状态.状态.求职头像 = null;
    页.rerender(<Backend真人会话 角色="candidate" conversationId="3003" />);
    expect(我方头像图(页.container)).toBeNull();
    expect(页.container.querySelector('img[src="/api/v1/me/avatar/content?v=7"]')).toBeNull();
    expect(我方头像字(页.container)).toBe('沈');
    // 换成另一账号的图：整点重挂显示新账号的图（不残留旧失败态）
    mock应用状态.状态.求职头像 = '/api/v1/me/avatar/content?v=9';
    页.rerender(<Backend真人会话 角色="candidate" conversationId="3003" />);
    await waitFor(() => expect(我方头像图(页.container)?.getAttribute('src')).toBe('/api/v1/me/avatar/content?v=9'));
  });

  it('源码合同：Backend 行对侧镜像净空按 32px 调整；不 import Mock 演示人像', () => {
    // 我方头像 26 → 32 后，对方侧让出 32+gap9=41（原 35）；我方侧不变（对方头像 32+9）
    expect(真人会话css源码).toMatch(/\.我方消息行 \.对侧留白 \{\s*max-width: calc\(100% - 41px\);/);
    expect(真人会话css源码).toMatch(/\.对方消息行 \.对侧留白 \{\s*max-width: calc\(100% - 41px\);/);
    // Step 4：绝不拿演示人像填 Backend 缺图 —— 本屏不 import Mock 数据
    expect(Backend真人会话tsx源码).not.toContain('模拟数据');
  });
});

// ── Task 4：招聘聊天在线简历纸身（Spec §4）────────────────────────────────────
//   「看简历原件」改为「看在线简历」：同 Case candidate_identity + candidate_resume 的
//   纯展示纸身；不以 PDF 坐标缺失判定不可读；区段 null=暂未提供、[]=暂无；加载/失败/
//   重试在消费页面管理；联系字段恒「—」，不取登录手机号或 Mock 联系方式。

describe('Backend真人会话 · 在线简历纸身（Task 4）', () => {
  it('区段 null 与 [] 不互换：experiences null → 暂未提供、educations [] → 暂无', async () => {
    环境({
      role: 'recruiter',
      P5详情: {
        'p5:detail:recruiter:mc_3003': 披露简历详情({
          candidateResume: { ...BFF候选在线简历样本, experiences: null, educations: [] },
        }),
      },
    });
    const 用户 = userEvent.setup();
    render(<Backend真人会话 角色="recruiter" conversationId="3003" />);
    await 用户.click(screen.getByRole('button', { name: '看在线简历' }));
    const 层 = within(screen.getByRole('dialog', { name: '看在线简历' }));
    await waitFor(() => expect(层.getByText('沈亦舟')).toBeTruthy());
    expect(层.getByText('工作经历').nextElementSibling?.textContent).toBe('暂未提供');
    expect(层.getByText('教育经历').nextElementSibling?.textContent).toBe('暂无');
  });

  it('candidate_resume = null（无冻结简历）：层照常打开，各区段「暂未提供」', async () => {
    环境({
      role: 'recruiter',
      P5详情: { 'p5:detail:recruiter:mc_3003': 披露简历详情({ candidateResume: null }) },
    });
    const 用户 = userEvent.setup();
    render(<Backend真人会话 角色="recruiter" conversationId="3003" />);
    await 用户.click(screen.getByRole('button', { name: '看在线简历' }));
    const 层 = within(screen.getByRole('dialog', { name: '看在线简历' }));
    await waitFor(() => expect(层.getByText('沈亦舟')).toBeTruthy());
    expect(层.getByText('工作经历').nextElementSibling?.textContent).toBe('暂未提供');
    expect(层.getByText('教育经历').nextElementSibling?.textContent).toBe('暂未提供');
    expect(层.getByText('个人优势').nextElementSibling?.textContent).toBe('暂未提供');
    // 抬头只有身份，没有编造的职位/年限
    expect(层.queryByText(/年经验/)).toBeNull();
  });

  it('匿名身份回落 Case 代号显示，不冒充真名；有真名才显真名', async () => {
    环境({
      role: 'recruiter',
      P5详情: {
        'p5:detail:recruiter:mc_3003': 披露简历详情({
          candidateIdentity: BFF候选身份匿名样本,
          别名: 'C-07',
        }),
      },
    });
    const 用户 = userEvent.setup();
    render(<Backend真人会话 角色="recruiter" conversationId="3003" />);
    await 用户.click(screen.getByRole('button', { name: '看在线简历' }));
    // 纸身抬头 = Case 代号（candidate_resume 的区段照常展示）
    const 层 = within(screen.getByRole('dialog', { name: '看在线简历' }));
    await waitFor(() => expect(层.getByText('C-07')).toBeTruthy());
    expect(层.getByText('云衢')).toBeTruthy();
  });

  it('加载/失败/重试在消费页面管理：读取中占位、失败给定向重试', async () => {
    // 本轮 P5 读取未落地：层内显示读取中，不给任何纸身
    环境({ role: 'recruiter', P5详情: {} });
    const 用户 = userEvent.setup();
    const 页 = render(<Backend真人会话 角色="recruiter" conversationId="3003" />);
    await 用户.click(screen.getByRole('button', { name: '看在线简历' }));
    expect(within(screen.getByRole('dialog', { name: '看在线简历' })).getByText('正在读取在线简历…')).toBeTruthy();
    页.unmount();

    // 读取失败：定向重试走本 Case 的强制重读
    环境({
      role: 'recruiter',
      P5详情: {
        'p5:detail:recruiter:mc_3003': {
          阶段: '失败', 刷新中: false, detail: null, error: '暂时读不到这份简历', generation: 1,
        },
      },
    });
    render(<Backend真人会话 角色="recruiter" conversationId="3003" />);
    await 用户.click(screen.getByRole('button', { name: '看在线简历' }));
    await waitFor(() => expect(screen.getByText('在线简历暂不可用')).toBeTruthy());
    await 用户.click(screen.getByRole('button', { name: '重试' }));
    expect(mock应用状态.操作.读取详情).toHaveBeenCalledWith('recruiter', 'mc_3003', true);
  });

  it('源码合同：本入口零 PDF 租约 —— 屏源码不再出现 读取简历PDF/原始PDF正文', () => {
    expect(Backend真人会话tsx源码).not.toContain('读取简历PDF');
    expect(Backend真人会话tsx源码).not.toContain('原始PDF正文');
    expect(Backend真人会话tsx源码).not.toContain('PDF对象租约');
  });
});
