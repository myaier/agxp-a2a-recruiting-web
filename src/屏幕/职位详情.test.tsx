// 职位详情 · 两个契约：
//  1. 委托入谈一次点击（P0，校准 S1/S3 语义后交互流程不变）；
//  2. P1C Task 5：Backend 下公司槽只读 —— 候选入口仍来自静态市场列表，没有 CandidateJob/
//     canonical ref，公司卡不可点、不调 路径.企业详情、不把 'yunqu' 当 opaque Organization ID；
//     Mock 仍按原 slug 导航。匹配对齐卡 在接线前后都位于职位条件段与公司区块之前。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 职位详情 from './职位详情';

const mock派发 = vi.fn();
const mock替换跳转 = vi.fn();
const mock返回 = vi.fn();
const mock跳转 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: mock返回, 替换跳转: mock替换跳转, 跳转: mock跳转 }),
}));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

const { mock公司路由键, mock取公司档案 } = vi.hoisted(() => {
  const 静态档案 = {
    键: 'pingcap',
    名称: 'PingCAP',
    首字: 'P',
    规模行: 'D 轮 · 500-1000 人 · 基础软件',
    地址: '上海市张江路 2 号',
    简介: ['分布式数据库'],
    工商信息: [{ 项: '成立日期', 值: '2015-04-01' }],
  };
  return {
    mock公司路由键: vi.fn((名称: string) => `slug-${名称}`),
    mock取公司档案: vi.fn(() => 静态档案),
  };
});
vi.mock('../数据/公司档案', () => ({
  公司路由键: mock公司路由键,
  取公司档案: mock取公司档案,
}));

function 渲染(编号 = 'M-12') {
  return render(
    <MemoryRouter initialEntries={[`/job/${编号}`]}>
      <Routes>
        <Route path="/job/:id" element={<职位详情 />} />
      </Routes>
    </MemoryRouter>,
  );
}

function 断言匹配卡在条件段与公司之前() {
  const 匹配卡标题 = screen.getByText('匹配度分析');
  const 职位要求 = screen.getByText('职位要求');
  const 公司名 = screen.getByText('PingCAP');
  expect(匹配卡标题).toBeTruthy();
  // 匹配卡先于 JD 条件段，也先于公司区块（DOCUMENT_POSITION_FOLLOWING = 目标在参数节点之后）
  expect(匹配卡标题.compareDocumentPosition(职位要求) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(匹配卡标题.compareDocumentPosition(公司名) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe('职位详情 · 让 AI 代理去谈', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock替换跳转.mockClear();
    mock返回.mockClear();
    mock跳转.mockClear();
    mock公司路由键.mockClear();
    mock取公司档案.mockClear();
    mock应用状态 = { 状态: { 已委托: [], 简历技能: [] }, 派发: mock派发 };
  });

  it('让 AI 代理去谈保持一次点击，不增加确认层', async () => {
    const 用户 = userEvent.setup();
    渲染('M-12');
    await 用户.click(screen.getByRole('button', { name: /让AI代理去谈/ }));
    expect(mock派发).toHaveBeenCalledWith({
      型: '委托入谈',
      岗: expect.objectContaining({ 编号: 'M-12' }),
    });
    expect(mock替换跳转).toHaveBeenCalledTimes(1);
    // 没有新增的二次确认入口
    expect(screen.queryByText('同意并去谈')).toBeNull();
  });

  it('Mock 公司卡仍按原 slug 导航', async () => {
    const 用户 = userEvent.setup();
    渲染('M-12');
    断言匹配卡在条件段与公司之前();
    await 用户.click(screen.getByRole('button', { name: /PingCAP/ }));
    expect(mock跳转).toHaveBeenCalledWith('/company/slug-PingCAP');
  });
});

describe('职位详情 · Backend 公司槽只读', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock替换跳转.mockClear();
    mock返回.mockClear();
    mock跳转.mockClear();
    mock公司路由键.mockClear();
    mock取公司档案.mockClear();
    mock应用状态 = {
      状态: { 已委托: [], 简历技能: [], 简历经历: [], 简历教育: [] },
      派发: mock派发,
      数据源模式: 'backend',
    };
  });

  it('公司槽只读不可点，不调 路径.企业详情，也不把 yunqu 当 opaque ID 请求', () => {
    渲染('M-12');
    // 公司名来自未接线演示域，仍完整展示
    expect(screen.getByText('PingCAP')).toBeTruthy();
    // 没有 button/link 形态的公司卡
    expect(screen.queryByRole('button', { name: /PingCAP/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /PingCAP/ })).toBeNull();
    // 不创建 slug、不读静态档（Backend 无 canonical ref）
    expect(mock公司路由键).not.toHaveBeenCalled();
    expect(mock取公司档案).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalledWith('/company/yunqu');
    expect(mock跳转.mock.calls.every(([目标]) => !String(目标).startsWith('/company/'))).toBe(true);
  });

  it('匹配对齐卡 仍在且位于职位条件段与公司区块之前', () => {
    渲染('M-12');
    断言匹配卡在条件段与公司之前();
  });
});
