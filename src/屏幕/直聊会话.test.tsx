// 直聊会话 · P8 Task 7 双模式行为线测试。
//
// Backend：整条直聊路由没有权威 P8 举报目标（P4 不发布直聊许可/会话坐标）——
// 「⋯」举报按钮与举报层整体隐藏，绝不出现一个点了无处可发的死入口。
// Mock：原型行为原样 —— 「⋯」打开共用举报层，本地拉黑 + 固定 toast + 关层，
// 零 P8 操作。举报层 的可选 target 扩展对本屏 Mock 调用点零影响。

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 直聊会话 from './直聊会话';
import 样式 from './直聊会话.module.css';
// 仓库既有的 ?raw 源码合同模式（Backend 隐藏分支必须在源里真实存在）
import 直聊会话tsx源码 from './直聊会话.tsx?raw';
import { 取直聊对象 } from '../数据/模拟数据';

const mock派发 = vi.fn();
const mock返回 = vi.fn();
const mock跳转 = vi.fn();
const mock提交P8举报 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: mock返回, 跳转: mock跳转 }) }));

// jsdom 不实现 scrollIntoView（消息流自动滚到底会调用）
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

/** 消息流渲染所需的最小简历事实（匹配对齐行只做展示投影）。 */
function 状态底座() {
  return {
    已委托: [], 简历经历: [], 简历教育: [], 简历技能: [],
    基本信息: { 真名: '', 开始工作年: '', 身份: '在职' },
  };
}

function 渲染(模式: 'mock' | 'backend', 路径 = '/chat/direct') {
  mock应用状态 = 模式 === 'mock'
    ? { 数据源模式: 'mock', 状态: 状态底座(), 派发: mock派发 }
    : {
      数据源模式: 'backend',
      状态: 状态底座(),
      派发: mock派发,
      操作: { 提交P8举报: mock提交P8举报 },
    };
  return render(
    <MemoryRouter initialEntries={[路径]}>
      <Routes>
        <Route path="/chat/direct" element={<直聊会话 />} />
        <Route path="/chat/direct/:id" element={<直聊会话 />} />
      </Routes>
    </MemoryRouter>,
  );
}

const 对方 = 取直聊对象(undefined);

beforeEach(() => {
  mock派发.mockClear();
  mock返回.mockClear();
  mock跳转.mockClear();
  mock提交P8举报.mockReset().mockResolvedValue({
    ticketId: 'TICKET-P8-RPT-001', status: 'received', blockStatus: 'not_requested',
  });
});

describe('直聊会话 · Backend 无权威举报目标', () => {
  it('无参直聊路由：⋯ 举报按钮与举报层整体隐藏，零 P8 举报调用', () => {
    渲染('backend');
    expect(screen.queryByRole('button', { name: '举报' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: '举报' })).toBeNull();
    expect(screen.queryByText('提交举报')).toBeNull();
    expect(mock提交P8举报).not.toHaveBeenCalled();
    expect(mock派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '拉黑' }));
  });

  it('带 :id 的直聊路由同样隐藏（P4 从不发布直聊会话坐标）', () => {
    渲染('backend', '/chat/direct/M-01');
    expect(screen.queryByRole('button', { name: '举报' })).toBeNull();
    expect(mock提交P8举报).not.toHaveBeenCalled();
  });

  // 工作包 B：Backend 直聊整条原型面退场 —— 无参和带岗位 ID 的深链都不读 fixture，
  // 不建本地消息/输入，也不留任何写入口
  it.each(['/chat/direct', '/chat/direct/M-01'])(
    'Backend %s 不展示原型消息或写入口',
    (url) => {
      const { container } = 渲染('backend', url);
      // review-r2：完整句子精确落在唯一的 旁听文字 槽位 —— 不拆成两个 flex 列
      expect(
        screen.getByText('当前暂不提供直接聊天。请从已建立的 MatchCase 进入真人会话。'),
      ).toBeTruthy();
      expect(container.querySelectorAll(`.${样式.旁听文字}`)).toHaveLength(1);
      expect(screen.queryByText(对方.姓名)).toBeNull();
      expect(screen.queryByText(对方.岗位公司)).toBeNull();
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.queryByRole('button', { name: /发送/ })).toBeNull();
      expect(mock派发).not.toHaveBeenCalled();
      expect(mock提交P8举报).not.toHaveBeenCalled();
    },
  );

  it('Backend 渲染后推进 fake timers 不产生延迟回执或弹层', () => {
    vi.useFakeTimers();
    try {
      渲染('backend');
      act(() => {
        vi.runAllTimers();
      });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByText(/已交换/)).toBeNull();
      expect(mock派发).not.toHaveBeenCalled();
      expect(mock提交P8举报).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('源码合同：举报按钮与举报层都按 数据源模式 门控（不是只藏按钮留死层）', () => {
    expect(直聊会话tsx源码).toMatch(/数据源模式 === 'backend'/);
    expect(直聊会话tsx源码).not.toMatch(/提交P8举报/);
  });
});

describe('直聊会话 · Mock 原型行为原样', () => {
  it('⋯ 打开共用举报层：本地拉黑岗位所属公司 + 固定 toast + 关层，零 P8 操作', async () => {
    const 用户 = userEvent.setup();
    渲染('mock');
    await 用户.click(screen.getByRole('button', { name: '举报' }));
    expect(screen.getByRole('dialog', { name: '举报' })).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '骚扰' }));
    await 用户.click(screen.getByRole('button', { name: new RegExp(`同时屏蔽${对方.岗位公司}`) }));
    await 用户.click(screen.getByRole('button', { name: '提交举报' }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '拉黑', 名称: 对方.岗位公司 });
    expect(mock提交P8举报).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: '举报' })).toBeNull();
  });

  it('原型消息流与本地发送行为保持', async () => {
    const 用户 = userEvent.setup();
    渲染('mock');
    expect(screen.getByText(对方.姓名)).toBeTruthy();
    expect(screen.getByText(对方.消息[1]!.内容)).toBeTruthy();
    await 用户.type(screen.getByRole('textbox'), '今天下午方便电话');
    await 用户.click(screen.getByRole('button', { name: '发送' }));
    expect(screen.getByText('今天下午方便电话')).toBeTruthy();
    expect(mock派发).not.toHaveBeenCalled();
  });
});
