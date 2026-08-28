// 匿名在线简历 · 身份显示规则契约（spec §3.2 / review-r3）：
// 招聘方视图只消费真名事实——真名非空即显示真名、还原公司实名，不等到 S3；
// 已确认（S3）只承担意向确认文案，不兼任披露权限。
// P4 Task 7：Backend 分支只吃权威详情（每次进屏强制重读），只渲染映射后的
// 匿名 allowlist 画像（别名/匹配分/经验/求职状态/小结/技能/教育/薪资关系），
// 绝不回退 Mock 简历档，也没有直聊/年龄/性别/候选薪资任何入口。

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 匿名在线简历, { 简历正文 } from './匿名在线简历';
import { 匿名简历表 } from '../数据/企业端模拟数据';
import { BFF错误 } from '../数据/HTTP客户端';
import type { BFF招聘候选推荐 } from '../数据/BFF契约';
import { BFF招聘候选推荐样本, BFF岗位样本 } from '../测试/BFF样本';

// jsdom 不实现 scrollIntoView / scrollTo：详情页挂载自动定位、会话页滚到底都会调用
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}
if (!HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = () => {};
}

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());
const mock设置发现推荐范围 = vi.fn();
const mock读取招聘候选详情 = vi.fn(async () => BFF招聘候选推荐样本);
const mock设置候选收藏 = vi.fn(async () => undefined);
const mock委托招聘候选 = vi.fn(async () => undefined);
const mock刷新委托 = vi.fn(async () => undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  use应用状态: () => mock应用状态,
}));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: vi.fn(), 替换跳转: mock跳转, 跳转: mock跳转 }) }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

const 岗位编号 = BFF岗位样本.job_id;

/** P4 详情状态底座：详情缓存 / 不可用标记 / 委托按用例给 */
function 置P4详情状态(选项: {
  详情?: BFF招聘候选推荐 | null;
  不可用?: string[];
  操作?: Record<string, unknown>;
}) {
  mock应用状态 = {
    数据源模式: 'backend', 派发: mock派发,
    状态: {
      当前岗位编号: 岗位编号,
      岗位列表: [{ 编号: 岗位编号, 名称: 'AI 产品实习生', 状态: '在招' }],
      企业规则: [], 推荐列表: [], 收藏候选: [], 不合适候选: {}, 已接触推荐: [],
      企业候选列表: [],
    },
    后端状态: {
      Agent规则水合: { candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '成功', proposals: '成功' } },
      招聘候选详情: 选项.详情 ? { rec_r1: 选项.详情 } : {},
      招聘候选不可用: 选项.不可用 ?? [],
      P4委托回执: {},
    },
    操作: 选项.操作 ?? {},
  };
}

function 渲染详情() {
  return render(
    <MemoryRouter initialEntries={['/hr/resume/rec_r1']}>
      <Routes>
        <Route path="/hr/resume/:id" element={<匿名在线简历 />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('简历正文 · 身份显示规则（spec §3.2）', () => {
  it('真名非空（S1）即显示真名与「已披露身份」，不等到 S3', () => {
    const 档 = 匿名简历表['A-01'];
    render(<简历正文 档={档} 真名="沈亦舟" 已确认={false} />);
    expect(screen.getByText('沈亦舟')).toBeTruthy();
    // 代号不应再作为大代号出现
    expect(screen.queryByText(档.代号)).toBeNull();
    expect(screen.getByText('已披露身份')).toBeTruthy();
  });

  it('真名为空（S0）仍显示代号与「匿名」', () => {
    const 档 = 匿名简历表['A-07'];
    render(<简历正文 档={档} />);
    expect(screen.getByText(档.代号)).toBeTruthy();
    expect(screen.getByText('匿名')).toBeTruthy();
  });

  it('S3 完成时页尾注说双方已确认意向，S1 已披露但未到 S3 时提示意向确认后进入真人沟通', () => {
    const 档 = 匿名简历表['A-01'];
    const { rerender } = render(<简历正文 档={档} 真名="沈亦舟" 已确认={false} />);
    expect(screen.getByText(/候选人身份已随 S1 原件披露/)).toBeTruthy();
    rerender(<简历正文 档={档} 真名="沈亦舟" 已确认={true} />);
    expect(screen.getByText('双方已确认意向，可进入真人沟通 · 内容不可转发')).toBeTruthy();
  });
});

describe('匿名在线简历 · P4 招聘端详情（Backend）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock轻提示.mockClear();
    mock设置发现推荐范围.mockClear();
    mock读取招聘候选详情.mockClear();
    mock设置候选收藏.mockClear();
    mock委托招聘候选.mockClear();
    mock刷新委托.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('每次进屏都强制重读权威详情，先注册详情范围，离开即清', async () => {
    置P4详情状态({
      详情: BFF招聘候选推荐样本,
      操作: { 设置发现推荐范围: mock设置发现推荐范围, 读取招聘候选详情: mock读取招聘候选详情 },
    });
    const 页 = 渲染详情();
    await waitFor(() =>
      expect(mock读取招聘候选详情).toHaveBeenCalledWith(岗位编号, 'rec_r1', true));
    expect(mock设置发现推荐范围).toHaveBeenCalledWith(
      'recruiter', `recruiter:detail:${岗位编号}:rec_r1`);
    expect(mock设置发现推荐范围.mock.invocationCallOrder[0]).toBeLessThan(
      mock读取招聘候选详情.mock.invocationCallOrder[0]);
    页.unmount();
    expect(mock设置发现推荐范围).toHaveBeenCalledWith('recruiter', null);

    // 再进屏：缓存命中也照样 GET（screens always force）
    置P4详情状态({
      详情: BFF招聘候选推荐样本,
      操作: { 设置发现推荐范围: mock设置发现推荐范围, 读取招聘候选详情: mock读取招聘候选详情 },
    });
    渲染详情();
    await waitFor(() => expect(mock读取招聘候选详情).toHaveBeenCalledTimes(2));
  });

  it('只渲染映射后的匿名画像：别名/匹配分/经验/求职状态/小结/技能/教育/薪资关系', () => {
    置P4详情状态({ 详情: BFF招聘候选推荐样本 });
    渲染详情();
    expect(screen.getByText('候选人甲')).toBeTruthy();
    expect(screen.getByText('匿名')).toBeTruthy();
    expect(screen.getByText('87')).toBeTruthy(); // 返回栏 匹配 N
    expect(screen.getByText('4 年')).toBeTruthy();
    expect(screen.getByText('employed')).toBeTruthy();
    expect(screen.getByText('四年全栈经验')).toBeTruthy();
    expect(screen.getByText('TypeScript')).toBeTruthy();
    expect(screen.getByText('复旦大学 · 计算机科学 · 本科')).toBeTruthy();
    expect(screen.getByText('薪资带有交集')).toBeTruthy();
    expect(screen.getByText('本科')).toBeTruthy();
  });

  it('身份与薪资 Canary：无真名/无直接聊/无工作经历段/无年龄性别/无 Mock 简历兜底', () => {
    置P4详情状态({ 详情: BFF招聘候选推荐样本 });
    渲染详情();
    expect(screen.queryByText('直接聊')).toBeNull();
    expect(screen.queryByText('工作经历')).toBeNull();
    expect(screen.queryByText('沈亦舟')).toBeNull();
    expect(screen.queryByText(/期望薪资/)).toBeNull();
    // Mock 简历档（匿名简历表）绝不兜底出现
    expect(screen.queryByText('云衢科技')).toBeNull();
    expect(screen.queryByText('对方允许直接联系')).toBeNull();
    expect(screen.queryByText('对方未开放直接联系')).toBeNull();
  });

  it('404 已收口给安全不可用页，不再渲染任何画像', () => {
    置P4详情状态({ 详情: null, 不可用: ['rec_r1'] });
    渲染详情();
    expect(screen.getByText('这位候选暂时看不了')).toBeTruthy();
    expect(screen.queryByText('候选人甲')).toBeNull();
  });

  it('详情读取的非 404 失败给文案与重试（重试走 force GET）', async () => {
    const user = userEvent.setup();
    mock读取招聘候选详情.mockRejectedValueOnce(
      new BFF错误(503, 'source_unavailable', '服务暂时不可用'));
    置P4详情状态({
      详情: null,
      操作: { 读取招聘候选详情: mock读取招聘候选详情 },
    });
    渲染详情();
    await waitFor(() => expect(screen.getByText('候选简历暂时加载不了')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock读取招聘候选详情).toHaveBeenLastCalledWith(岗位编号, 'rec_r1', true);
  });

  it('★收藏：服务端先行，权威快照回改后星标点亮', async () => {
    const user = userEvent.setup();
    置P4详情状态({
      详情: BFF招聘候选推荐样本,
      操作: { 设置候选收藏: mock设置候选收藏 },
    });
    const 页 = 渲染详情();
    await waitFor(() => expect(screen.getByRole('button', { name: '收藏' })).toBeTruthy());
    await user.click(screen.getByRole('button', { name: '收藏' }));
    expect(mock设置候选收藏).toHaveBeenCalledWith(岗位编号, 'rec_r1', true);
    // 操作层 PUT 成功回改详情缓存后的权威重渲染
    置P4详情状态({
      详情: { ...BFF招聘候选推荐样本, favorite: true },
      操作: { 设置候选收藏: mock设置候选收藏 },
    });
    页.rerender(
      <MemoryRouter initialEntries={['/hr/resume/rec_r1']}>
        <Routes>
          <Route path="/hr/resume/:id" element={<匿名在线简历 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: '取消收藏' })).toBeTruthy();
  });

  it('委托无确认层：点击立即调用，成功后原地停留显示「AI代理已接手」', async () => {
    const user = userEvent.setup();
    置P4详情状态({
      详情: BFF招聘候选推荐样本,
      操作: { 委托招聘候选: mock委托招聘候选 },
    });
    const 页 = 渲染详情();
    await waitFor(() => expect(screen.getByRole('button', { name: '让AI代理去谈' })).toBeTruthy());
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await waitFor(() => expect(mock委托招聘候选).toHaveBeenCalledWith(岗位编号, 'rec_r1'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mock跳转).not.toHaveBeenCalled();
    // 回执落详情缓存后：原地切成已接手状态标
    置P4详情状态({
      详情: {
        ...BFF招聘候选推荐样本,
        delegation: { delegation_id: 'del_r1', state: 'accepted', case_id: null },
      },
      操作: { 委托招聘候选: mock委托招聘候选 },
    });
    页.rerender(
      <MemoryRouter initialEntries={['/hr/resume/rec_r1']}>
        <Routes>
          <Route path="/hr/resume/:id" element={<匿名在线简历 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('AI代理已接手')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '让AI代理去谈' })).toBeNull();
  });

  it('终态/拒绝回执给闭合文案，不导航', async () => {
    const user = userEvent.setup();
    mock委托招聘候选.mockRejectedValueOnce(
      new BFF错误(200, 'delegation_cooldown', '近期已联系过对方，暂时不能重复发起'));
    置P4详情状态({
      详情: BFF招聘候选推荐样本,
      操作: { 委托招聘候选: mock委托招聘候选 },
    });
    渲染详情();
    await waitFor(() => expect(screen.getByRole('button', { name: '让AI代理去谈' })).toBeTruthy());
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await waitFor(() =>
      expect(mock轻提示).toHaveBeenCalledWith('近期已联系过对方，暂时不能重复发起'));
    expect(mock跳转).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '让AI代理去谈' })).toBeTruthy();
  });

  it('进行中委托按节拍轮询；暂停时「已接手」被中性文案覆盖', async () => {
    vi.useFakeTimers();
    mock刷新委托.mockRejectedValue(new BFF错误(503, 'source_unavailable', 'x'));
    置P4详情状态({
      详情: {
        ...BFF招聘候选推荐样本,
        delegation: { delegation_id: 'del_r1', state: 'accepted', case_id: null },
      },
      操作: { 刷新委托: mock刷新委托 },
    });
    render(
      <MemoryRouter initialEntries={['/hr/resume/rec_r1']}>
        <Routes>
          <Route path="/hr/resume/:id" element={<匿名在线简历 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('AI代理已接手')).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(mock刷新委托).toHaveBeenCalledWith('recruiter', 'del_r1');
    await act(() => vi.advanceTimersByTimeAsync(8000));
    expect(screen.getByText('暂时无法确认进度，请稍后刷新')).toBeTruthy();
  });
});