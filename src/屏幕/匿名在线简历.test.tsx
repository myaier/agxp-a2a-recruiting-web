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
import type { BFF招聘候选推荐, BFF委托回执 } from '../数据/BFF契约';
import { BFF招聘候选推荐样本, BFF岗位样本 } from '../测试/BFF样本';
import { 发现推荐操作桩 } from '../测试/操作桩';
import { 路径 } from '../路由/路径表';

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
  /** P4 委托回执表（terminal 补读用例给）；缺省空表 = 回执缺位 */
  委托回执?: Record<string, BFF委托回执>;
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
      P4委托回执: 选项.委托回执 ?? {},
    },
    // 生产 Provider 恒注入全表：桩宿主同样给全表，用例只覆盖自己要断言的 spy
    操作: 发现推荐操作桩(选项.操作),
  };
}

function 渲染详情() {
  // J（Task 8）：Backend canonical 双坐标 —— 岗位与推荐都来自 URL
  return render(
    <MemoryRouter initialEntries={[`/hr/jobs/${岗位编号}/recommendations/rec_r1`]}>
      <Routes>
        <Route path="/hr/jobs/:jobId/recommendations/:recommendationId" element={<匿名在线简历 />} />
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
    // 2026-09-01 定稿:披露胶囊删除,真名本身即披露状态
    expect(screen.queryByText('已披露身份')).toBeNull();
  });

  it('真名为空（S0）仍显示代号与「匿名」', () => {
    const 档 = 匿名简历表['A-07'];
    render(<简历正文 档={档} />);
    expect(screen.getByText(档.代号)).toBeTruthy();
    expect(screen.queryByText('匿名')).toBeNull();
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

  it('basis 已确认（控制组）：匹配分与推荐亮点整组照常渲染', () => {
    置P4详情状态({ 详情: BFF招聘候选推荐样本 });
    渲染详情();
    expect(screen.getByText('full_stack')).toBeTruthy();
    expect(screen.queryByText('经验与学历尚未核对')).toBeNull();
  });

  it('basis 未确认：匹配分保留，推荐亮点整组收起且文档里不留任何亮点，改显中性句', async () => {
    置P4详情状态({
      详情: {
        ...BFF招聘候选推荐样本,
        structured_requirements_confirmed: false,
        highlights: ['full_stack', 'react_depth'],
      },
    });
    渲染详情();
    // 后端历史分保留（返回栏 匹配 N）
    expect(await screen.findByText('87')).toBeTruthy();
    expect(screen.getByText('经验与学历尚未核对')).toBeTruthy();
    // 整组收起：文档任何位置都不残留亮点文案，不做选择性过滤
    expect(screen.queryByText('full_stack')).toBeNull();
    expect(screen.queryByText('react_depth')).toBeNull();
    expect(document.body.textContent).not.toContain('full_stack');
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

  // fail closed：上一轮 200 的详情还热在缓存里、这一轮重读 404 时，页面必须让不可用赢，
  // 绝不把旧画像连同 ★收藏 / 让AI代理去谈 继续渲染成活页
  it('缓存仍在但已标记不可用：仍走安全不可用页，收藏与委托入口都不出现', () => {
    置P4详情状态({ 详情: BFF招聘候选推荐样本, 不可用: ['rec_r1'] });
    渲染详情();
    expect(screen.getByText('这位候选暂时看不了')).toBeTruthy();
    expect(screen.queryByText('候选人甲')).toBeNull();
    expect(screen.queryByRole('button', { name: '收藏' })).toBeNull();
    expect(screen.queryByRole('button', { name: '取消收藏' })).toBeNull();
    expect(screen.queryByRole('button', { name: '让AI代理去谈' })).toBeNull();
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
      <MemoryRouter initialEntries={[`/hr/jobs/${岗位编号}/recommendations/rec_r1`]}>
        <Routes>
          <Route path="/hr/jobs/:jobId/recommendations/:recommendationId" element={<匿名在线简历 />} />
          <Route path="/hr/resume/:id" element={<匿名在线简历 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: '取消收藏' })).toBeTruthy();
  });

  it('委托无确认层：点击立即调用，成功后原地停留显示进行中状态文案', async () => {
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
    // 回执落详情缓存后：原地切成进行中状态条
    置P4详情状态({
      详情: {
        ...BFF招聘候选推荐样本,
        delegation: { delegation_id: 'del_r1', state: 'accepted', case_id: null },
      },
      操作: { 委托招聘候选: mock委托招聘候选 },
    });
    页.rerender(
      <MemoryRouter initialEntries={[`/hr/jobs/${岗位编号}/recommendations/rec_r1`]}>
        <Routes>
          <Route path="/hr/jobs/:jobId/recommendations/:recommendationId" element={<匿名在线简历 />} />
          <Route path="/hr/resume/:id" element={<匿名在线简历 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('已提交给 AI，等待处理')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '让AI代理去谈' })).toBeNull();
    // 已退役的自创文案绝不在 Backend 详情上复活
    expect(screen.queryByText('AI代理已接手')).toBeNull();
    expect(screen.queryByText('已开始沟通')).toBeNull();
  });

  it('recruiter case_started navigates only by server case_id', async () => {
    置P4详情状态({
      详情: {
        ...BFF招聘候选推荐样本,
        delegation: { delegation_id: 'del_r1', state: 'case_started', case_id: 'case_server_r1' },
      },
    });
    渲染详情();
    await waitFor(() => expect(screen.getByRole('button', { name: '查看进展' })).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: '查看进展' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.候选详情('case_server_r1'));
  });

  it('case_started 无服务端 case_id 时只给不可点状态条，绝不拿 job/recommendation/delegation ID 或别名充当 Case', () => {
    置P4详情状态({
      详情: {
        ...BFF招聘候选推荐样本,
        delegation: { delegation_id: 'del_r2', state: 'case_started', case_id: null },
      },
    });
    渲染详情();
    expect(screen.getByText('已创建真实在谈')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '查看进展' })).toBeNull();
    expect(mock跳转).not.toHaveBeenCalled();
  });

  // 六个闭合委托状态的权威文案（与 发现推荐映射 的 P4委托状态文案表 逐字一致）
  const 状态文案 = [
    ['accepted', '已提交给 AI，等待处理'],
    ['evaluating', 'AI 正在评估'],
    ['case_started', '已创建真实在谈'],
    ['needs_user', '需要你处理'],
    ['refused', '本次未能继续'],
    ['failed', '本次处理未完成'],
  ] as const;

  it.each(状态文案)('%s 委托按闭合表显示「%s」且不可点', (state, 文案) => {
    置P4详情状态({
      详情: {
        ...BFF招聘候选推荐样本,
        delegation: { delegation_id: `del_${state}`, state, case_id: null },
      },
    });
    渲染详情();
    expect(screen.getByText(文案)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '让AI代理去谈' })).toBeNull();
    expect(screen.queryByRole('button', { name: '查看进展' })).toBeNull();
    expect(screen.queryByText('AI代理已接手')).toBeNull();
    expect(screen.queryByText('已开始沟通')).toBeNull();
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
      <MemoryRouter initialEntries={[`/hr/jobs/${岗位编号}/recommendations/rec_r1`]}>
        <Routes>
          <Route path="/hr/jobs/:jobId/recommendations/:recommendationId" element={<匿名在线简历 />} />
          <Route path="/hr/resume/:id" element={<匿名在线简历 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('已提交给 AI，等待处理')).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(mock刷新委托).toHaveBeenCalledWith('recruiter', 'del_r1');
    await act(() => vi.advanceTimersByTimeAsync(8000));
    expect(screen.getByText('暂时无法确认进度，请稍后刷新')).toBeTruthy();
    expect(screen.queryByText('已提交给 AI，等待处理')).toBeNull();
  });

  // ── Hosted Agent 失败合同 Task 3：terminal summary 单次权威补读 ──
  //   重载/跨端恢复进详情时摘要可能已 refused/failed 而权威回执表缺这条 ID：
  //   拒绝/失败码只活在 GET 回执里 —— 进屏立即补读一次（无 interval、无 retry），
  //   rerender 不重发；回执表已有同 ID receipt（七键齐全）就一个都不发。
  const failedReceipt: BFF委托回执 = {
    delegation_id: 'del_terminal', recommendation_id: 'rec_1', state: 'failed',
    evaluation_id: null, case_id: null, refusal_code: null,
    failure_code: 'delegation_agent_unavailable',
  };
  const refusedReceipt: BFF委托回执 = {
    delegation_id: 'del_terminal', recommendation_id: 'rec_1', state: 'refused',
    evaluation_id: null, case_id: null, refusal_code: 'delegation_cooldown',
    failure_code: null,
  };

  it('terminal summary 缺 receipt：进屏立即补读一次，rerender 不重发', async () => {
    置P4详情状态({
      详情: {
        ...BFF招聘候选推荐样本,
        delegation: { delegation_id: 'del_terminal', state: 'failed', case_id: null },
      },
      操作: { 刷新委托: mock刷新委托 },
    });
    const 页 = 渲染详情();
    await waitFor(() => expect(mock刷新委托).toHaveBeenCalledTimes(1));
    expect(mock刷新委托).toHaveBeenCalledWith('recruiter', 'del_terminal');
    页.rerender(
      <MemoryRouter initialEntries={[`/hr/jobs/${岗位编号}/recommendations/rec_r1`]}>
        <Routes>
          <Route path="/hr/jobs/:jobId/recommendations/:recommendationId" element={<匿名在线简历 />} />
          <Route path="/hr/resume/:id" element={<匿名在线简历 />} />
        </Routes>
      </MemoryRouter>,
    );
    await act(async () => {});
    expect(mock刷新委托).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['refused', refusedReceipt],
    ['failed', failedReceipt],
  ] as const)('%s 摘要已有同 ID receipt：零补读', async (state, receipt) => {
    置P4详情状态({
      详情: {
        ...BFF招聘候选推荐样本,
        delegation: { delegation_id: 'del_terminal', state, case_id: null },
      },
      委托回执: { del_terminal: receipt },
      操作: { 刷新委托: mock刷新委托 },
    });
    渲染详情();
    await act(async () => {});
    expect(mock刷新委托).not.toHaveBeenCalled();
  });
});
// ── J（Task 8）：canonical 双坐标 —— 所有读写与 scope 只取 URL ──
describe('匿名在线简历 · canonical 坐标（J）', () => {
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

  function 渲染URL(路径值: string) {
    return render(
      <MemoryRouter initialEntries={[路径值]}>
        <Routes>
          <Route path="/hr/jobs/:jobId/recommendations/:recommendationId" element={<匿名在线简历 />} />
          <Route path="/hr/resume/:id" element={<匿名在线简历 />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('刷新后所有 scope 只读 URL：当前岗位编号被干扰成 job_b 也用 URL 的 job_a', async () => {
    置P4详情状态({
      详情: BFF招聘候选推荐样本,
      操作: {
        设置发现推荐范围: mock设置发现推荐范围,
        读取招聘候选详情: mock读取招聘候选详情,
        设置候选收藏: mock设置候选收藏,
        委托招聘候选: mock委托招聘候选,
      },
    });
    // 状态.当前岗位编号 故意设成 job_b（J 的核心症状）；详情缓存键对齐 URL 的 rec_1
    mock应用状态.状态.当前岗位编号 = 'job_b';
    mock应用状态.后端状态.招聘候选详情 = { rec_1: BFF招聘候选推荐样本 };
    渲染URL('/hr/jobs/job_a/recommendations/rec_1');
    await waitFor(() => expect(mock读取招聘候选详情).toHaveBeenCalledWith('job_a', 'rec_1', true));
    expect(mock设置发现推荐范围).toHaveBeenCalledWith('recruiter', 'recruiter:detail:job_a:rec_1');
    const 收藏键 = await screen.findByRole('button', { name: /收藏/ });
    await userEvent.click(收藏键);
    await waitFor(() => expect(mock设置候选收藏).toHaveBeenCalledWith('job_a', 'rec_1', expect.any(Boolean)));
    const 委托键 = screen.getByRole('button', { name: /让AI代理去谈/ });
    await userEvent.click(委托键);
    await waitFor(() => expect(mock委托招聘候选).toHaveBeenCalledWith('job_a', 'rec_1'));
  });

  it('随机 recommendation 仍收口为安全不可用页', () => {
    置P4详情状态({ 详情: null, 不可用: ['rec_random'] });
    渲染URL(`/hr/jobs/${岗位编号}/recommendations/rec_random`);
    expect(screen.getByText('这位候选暂时看不了')).toBeTruthy();
  });

  it('Backend 旧 /hr/resume/:id 显示失效提示且零详情请求', async () => {
    置P4详情状态({
      详情: BFF招聘候选推荐样本,
      操作: { 读取招聘候选详情: mock读取招聘候选详情, 设置发现推荐范围: mock设置发现推荐范围 },
    });
    渲染URL('/hr/resume/rec_1');
    expect(screen.getByText('链接已失效，请从对应岗位推荐列表重新打开')).toBeTruthy();
    // effect、scope 与读取全部零调用
    await act(async () => { await Promise.resolve(); });
    expect(mock读取招聘候选详情).not.toHaveBeenCalled();
    expect(mock设置发现推荐范围).not.toHaveBeenCalled();
    expect(screen.queryByText('候选人甲')).toBeNull();
  });

  it('Mock 旧 /hr/resume/:id 原型详情仍可用', () => {
    mock应用状态 = {
      数据源模式: 'mock', 派发: mock派发,
      状态: { 岗位列表: [], 收藏候选: [], 不合适候选: {}, 已接触推荐: [], 企业候选列表: [] },
      操作: {},
    };
    渲染URL('/hr/resume/A-01');
    // Mock 原型分支照常渲染静态简历表
    expect(screen.queryByText('链接已失效，请从对应岗位推荐列表重新打开')).toBeNull();
  });
});
