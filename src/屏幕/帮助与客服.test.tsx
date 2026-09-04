// 帮助与客服 · Backend 角色 FAQ 隔离（工作包 C）。
//
// Backend：不读 Mock 常见问答，按当前 active role 只显示一份角色正确的最小 FAQ
// （未知角色不猜测，FAQ 为空）；不显示占位热线、工作时间、许可证或资质证照，
// 也不渲染「转人工客服」——客服键位槽改显「人工客服暂未开放」的不可点击说明。
// Agent 功能按钮按角色分别进入 /agent 或 /hr/agent。role/mode 变化时分类复位
// 「全部」、展开项回到新表首项，旧表选择不残留。
// Mock：常见问答、人工客服按钮和演示信息原样。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 帮助与客服 from './帮助与客服';
import 样式 from './我的功能页.module.css';
import { 路径 } from '../路由/路径表';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: mock返回, 跳转: mock跳转 }) }));

function 渲染Backend(role: 'candidate' | 'recruiter' | null) {
  mock应用状态 = { 数据源模式: 'backend', 后端状态: { 主体: { last_used_role: role } } };
  return render(
    <MemoryRouter>
      <帮助与客服 />
    </MemoryRouter>,
  );
}

function 渲染Mock() {
  mock应用状态 = { 数据源模式: 'mock', 后端状态: { 主体: null } };
  return render(
    <MemoryRouter>
      <帮助与客服 />
    </MemoryRouter>,
  );
}

/** 用新的 mock应用状态 重渲当前视图（模拟 role/mode 变化） */
function 重渲Backend(视图: ReturnType<typeof render>, role: 'candidate' | 'recruiter' | null) {
  mock应用状态 = { 数据源模式: 'backend', 后端状态: { 主体: { last_used_role: role } } };
  视图.rerender(
    <MemoryRouter>
      <帮助与客服 />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mock跳转.mockClear();
  mock返回.mockClear();
});

describe('帮助与客服 · Backend 角色 FAQ 隔离', () => {
  it('Backend candidate 只显示候选 FAQ', () => {
    渲染Backend('candidate');
    expect(screen.getByText('企业什么时候能看到我的资料？')).toBeTruthy();
    expect(screen.queryByText('怎样发布和管理岗位？')).toBeNull();
  });

  it('Backend recruiter 只显示招聘 FAQ', () => {
    渲染Backend('recruiter');
    expect(screen.getByText('怎样发布和管理岗位？')).toBeTruthy();
    expect(screen.queryByText('企业什么时候能看到我的资料？')).toBeNull();
  });

  it('Backend 未知角色不猜测：FAQ 为空，也不提供 Agent 功能入口', () => {
    渲染Backend(null);
    expect(screen.queryByText('企业什么时候能看到我的资料？')).toBeNull();
    expect(screen.queryByText('怎样发布和管理岗位？')).toBeNull();
    expect(screen.queryByText('对方能看到我的薪资期望吗？')).toBeNull();
    // Agent CTA 不猜目标：未知角色下不渲染入口（角色守卫会把 /agent、/hr/agent 深链弹回 /identity）
    expect(screen.queryByRole('button', { name: '查看 AI 代理功能' })).toBeNull();
    expect(screen.getByText('人工客服暂未开放')).toBeTruthy();
  });

  it.each(['400-000-0000', '8:00–22:00', '人力资源服务许可证', '资质证照'])(
    'Backend 不显示占位运营事实 %s',
    (text) => {
      渲染Backend('candidate');
      expect(screen.queryByText(new RegExp(text))).toBeNull();
      expect(screen.queryByRole('button', { name: '转人工客服' })).toBeNull();
    },
  );

  it('Backend 客服键位是「人工客服暂未开放」的不可点击说明', () => {
    渲染Backend('candidate');
    expect(screen.getByText('人工客服暂未开放')).toBeTruthy();
    expect(screen.getByText('人工客服暂未开放').closest('button')).toBeNull();
  });

  it('Backend candidate 的 Agent 功能按钮进入 /agent', async () => {
    const 用户 = userEvent.setup();
    渲染Backend('candidate');
    await 用户.click(screen.getByRole('button', { name: '查看 AI 代理功能' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.问AI代理);
  });

  it('Backend recruiter 的 Agent 功能按钮进入 /hr/agent', async () => {
    const 用户 = userEvent.setup();
    渲染Backend('recruiter');
    await 用户.click(screen.getByRole('button', { name: '查看 AI 代理功能' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.企业问AI代理);
  });

  it('Backend 角色切换后分类复位全部且展开项回到新表首项', async () => {
    const 用户 = userEvent.setup();
    const 视图 = 渲染Backend('candidate');
    // 在候选表里选一个分类、展开另一条，制造会跨表残留的本地选择
    await 用户.click(screen.getByRole('button', { name: '阶段进展' }));
    await 用户.click(screen.getByText('在哪里查看匹配进展？'));
    expect(screen.getByText('在“在谈”中打开对应 MatchCase 查看阶段和待处理动作。')).toBeTruthy();
    expect(screen.queryByText('怎样发布和管理岗位？')).toBeNull();

    重渲Backend(视图, 'recruiter');
    // 分类复位「全部」：两张招聘 FAQ 都可见；展开项是招聘表首项
    expect(screen.getByText('怎样发布和管理岗位？')).toBeTruthy();
    expect(screen.getByText('在哪里查看候选进展？')).toBeTruthy();
    expect(screen.getByText('从招聘端“我的”进入发布岗位或岗位管理。')).toBeTruthy();
    expect(screen.queryByText('在“在谈”中打开对应 MatchCase 查看阶段和待处理动作。')).toBeNull();
    expect(
      (screen.getByRole('button', { name: '全部' }) as HTMLButtonElement).className,
    ).toContain(样式.分类片选中);
  });

  it('从 Mock 切到 Backend 后原型问答不残留', () => {
    const 视图 = 渲染Mock();
    expect(screen.getByText('对方能看到我的薪资期望吗？')).toBeTruthy();
    重渲Backend(视图, 'candidate');
    expect(screen.queryByText('对方能看到我的薪资期望吗？')).toBeNull();
    expect(screen.getByText('企业什么时候能看到我的资料？')).toBeTruthy();
  });
});

describe('帮助与客服 · Mock 原型保持', () => {
  it('显示常见问答、人工客服按钮和演示信息，Agent 入口照旧', async () => {
    const 用户 = userEvent.setup();
    渲染Mock();
    expect(screen.getByText('对方能看到我的薪资期望吗？')).toBeTruthy();
    expect(screen.getByRole('button', { name: '转人工客服' })).toBeTruthy();
    expect(screen.getByText(/服务热线 400-000-0000/)).toBeTruthy();
    expect(screen.queryByText('人工客服暂未开放')).toBeNull();
    await 用户.click(screen.getByRole('button', { name: '问我的 AI 代理' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.问AI代理);
  });
});