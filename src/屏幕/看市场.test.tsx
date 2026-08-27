// P6 Task 7：非规范规则入口隔离（候选端）。
// 看市场筛选层：Backend 只读（无输入 / 无删除、管理规则 › 跳 规则库）；筛选角标只认
// 已水合的权威规则（未水合不出 Mock 数字，水合后只数 生效:true）；Mock 原样可编辑。
// 候选端演示页（问AI代理 / 往来记录 / 在谈详情）：记成规则 只在 Mock 派发 新增规则，
// Backend 只给中性提示，不落规则、不冒充已生效。
// 测试宿主：mock 应用状态 / 导航钩子（同 企业我的.test.tsx 惯例）。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 看市场 from './看市场';
import 问AI代理 from './问AI代理';
import 往来记录 from './往来记录';
import 在谈详情 from './在谈详情';
import { 路径 } from '../路由/路径表';
import { 今日简报, 在谈列表 } from '../数据/模拟数据';

// jsdom 不实现 scrollIntoView / scrollTo：详情页挂载自动定位、会话页滚到底都会调用
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}
if (!HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = () => {};
}

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
// vi.mock 工厂被提升到文件顶 —— 间谍必须用 vi.hoisted 声明才能在工厂里引用
const mock轻提示 = vi.hoisted(() => vi.fn());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', async (importOriginal) => ({
  // 顶部意向栏 还消费本模块的 取意向名：保留其余真实导出，只替换 use应用状态
  ...(await importOriginal<Record<string, unknown>>()),
  use应用状态: () => mock应用状态,
}));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: vi.fn(), 跳转: mock跳转 }) }));
// 轻提示 是挂在 document.body 上的全局 DOM 容器，跨用例不清理 —— 换成间谍逐例断言
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

/** 候选端规则种子：一条生效 + 一条停用 —— 角标若数出 2 就是没按 生效:true 过滤 */
const 候选规则种子 = [
  { 编号: 'R-01', 内容: '只看双休的岗位', 来源: '你手动添加 · 刚刚', 生效: true },
  { 编号: 'R-02', 内容: '薪资低于 20K 不谈', 来源: '你手动添加 · 刚刚', 生效: false },
];

/** 共用状态底座：mode + 双端水合阶段由用例给，页面字段按需补 */
function 置应用状态(选项: {
  模式?: 'mock' | 'backend';
  候选规则阶段?: string;
  状态?: Record<string, unknown>;
}) {
  const { 模式 = 'mock', 候选规则阶段 = '未开始', 状态 = {} } = 选项;
  mock应用状态 = {
    状态,
    派发: mock派发,
    数据源模式: 模式,
    后端状态: {
      Agent规则水合: {
        candidate: { rules: 候选规则阶段, proposals: '未开始' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
    },
  };
}

/** 渲染看市场并点开筛选层（与真实入口一致：顶栏「筛选 ▾」升起底部层） */
async function renderMarketFilter(选项: { mode: 'mock' | 'backend'; rulesStage: string }) {
  置应用状态({
    模式: 选项.mode,
    候选规则阶段: 选项.rulesStage,
    状态: {
      子视图: '看市场',
      当前意向: '后端工程师',
      求职意向表: [{ 编号: 'I-01', 标题: '后端工程师 · 45-55K' }],
      在谈列表: [],
      屏蔽名单: [],
      不感兴趣岗位: [],
      已委托: [],
      全局规则: 候选规则种子,
      意向级规则: [],
    },
  });
  render(<看市场 />);
  await userEvent.click(screen.getByRole('button', { name: /筛选/ }));
}

describe('看市场 · Backend 筛选层只读与角标门控', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock轻提示.mockClear();
  });

  it('Backend candidate filter layer is read-only and navigates to canonical rules', async () => {
    const user = userEvent.setup();
    await renderMarketFilter({ mode: 'backend', rulesStage: '成功' });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /删除规则/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: '管理规则 ›' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.规则库);
  });

  it('Backend rules 未水合时角标不出 Mock 数字', async () => {
    await renderMarketFilter({ mode: 'backend', rulesStage: '未开始' });
    expect(screen.queryByText(/筛选 · /)).toBeNull();
    expect(screen.getByRole('button', { name: '筛选 ▾' })).toBeTruthy();
  });

  it('Backend rules 水合成功后角标只数 生效:true 的规则', async () => {
    await renderMarketFilter({ mode: 'backend', rulesStage: '成功' });
    expect(screen.getByRole('button', { name: '筛选 · 1 ▾' })).toBeTruthy();
  });

  it('Mock 角标计数与可编辑筛选层保持原样', async () => {
    await renderMarketFilter({ mode: 'mock', rulesStage: '未开始' });
    expect(screen.getByRole('button', { name: '筛选 · 1 ▾' })).toBeTruthy();
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '管理规则 ›' })).toBeTruthy();
  });
});

describe('候选端演示页 · 记成规则的模式边界', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock轻提示.mockClear();
  });

  it('问AI代理：Backend 点「改成可谈」不派发 新增规则，只提示去规则库', async () => {
    置应用状态({ 模式: 'backend', 状态: { 基本信息: { 真名: '测试' } } });
    render(<问AI代理 />);
    await userEvent.click(screen.getByRole('button', { name: '改成可谈' }));
    expect(mock派发).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock轻提示).toHaveBeenCalledWith('请到规则库确认并添加长期规则');
  });

  it('问AI代理：Mock 仍派发 新增规则 并跳规则库', async () => {
    置应用状态({ 模式: 'mock', 状态: { 基本信息: { 真名: '测试' } } });
    render(<问AI代理 />);
    await userEvent.click(screen.getByRole('button', { name: '改成可谈' }));
    expect(mock派发).toHaveBeenCalledWith({
      型: '新增规则',
      内容: 今日简报.松一档.规则内容,
      来源: 今日简报.松一档.规则来源,
    });
    expect(mock跳转).toHaveBeenCalledWith(路径.规则库);
  });

  it('往来记录：Backend 记成规则不派发 新增规则，只提示去规则库', async () => {
    置应用状态({ 模式: 'backend', 状态: { 在谈列表: [] } });
    render(
      <MemoryRouter initialEntries={['/thread/J-02']}>
        <Routes>
          <Route path="/thread/:id" element={<往来记录 />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.type(
      screen.getByPlaceholderText('对进展有疑问？告诉你的AI代理…'),
      '只要双休',
    );
    await userEvent.click(screen.getByRole('button', { name: '发送' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '记成规则' })).toBeTruthy(),
    );
    await userEvent.click(screen.getByRole('button', { name: '记成规则' }));
    expect(mock派发).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock轻提示).toHaveBeenCalledWith('请到规则库确认并添加长期规则');
  });

  it('往来记录：Mock 记成规则仍派发 新增规则 并跳规则库', async () => {
    置应用状态({ 模式: 'mock', 状态: { 在谈列表: [] } });
    render(
      <MemoryRouter initialEntries={['/thread/J-02']}>
        <Routes>
          <Route path="/thread/:id" element={<往来记录 />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.type(
      screen.getByPlaceholderText('对进展有疑问？告诉你的AI代理…'),
      '只要双休',
    );
    await userEvent.click(screen.getByRole('button', { name: '发送' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '记成规则' })).toBeTruthy(),
    );
    await userEvent.click(screen.getByRole('button', { name: '记成规则' }));
    expect(mock派发).toHaveBeenCalledWith({
      型: '新增规则',
      内容: '只要双休',
      来源: '来自小红书单的叮嘱 · 刚刚',
    });
    expect(mock跳转).toHaveBeenCalledWith(路径.规则库);
  });

  it('在谈详情：Backend 决策后记成规则不派发 新增规则，只提示去规则库', async () => {
    置应用状态({
      模式: 'backend',
      状态: {
        在谈列表,
        决策: {},
        决策快照: {},
        叮嘱表: {},
        简历文件名: '',
        简历经历: [],
        简历教育: [],
        简历技能: [],
      },
    });
    render(
      <MemoryRouter initialEntries={['/deal/J-02']}>
        <Routes>
          <Route path="/deal/:id" element={<在谈详情 />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('button', { name: '接受' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '记成规则' })).toBeTruthy(),
    );
    await userEvent.click(screen.getByRole('button', { name: '记成规则' }));
    expect(
      mock派发.mock.calls.some(([动作]) => (动作 as { 型?: string } | undefined)?.型 === '新增规则'),
    ).toBe(false);
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock轻提示).toHaveBeenCalledWith('请到规则库确认并添加长期规则');
  });

  it('在谈详情：Mock 决策后记成规则仍派发 新增规则 并跳规则库', async () => {
    置应用状态({
      模式: 'mock',
      状态: {
        在谈列表,
        决策: {},
        决策快照: {},
        叮嘱表: {},
        简历文件名: '',
        简历经历: [],
        简历教育: [],
        简历技能: [],
      },
    });
    render(
      <MemoryRouter initialEntries={['/deal/J-02']}>
        <Routes>
          <Route path="/deal/:id" element={<在谈详情 />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('button', { name: '接受' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '记成规则' })).toBeTruthy(),
    );
    await userEvent.click(screen.getByRole('button', { name: '记成规则' }));
    expect(mock派发).toHaveBeenCalledWith(
      expect.objectContaining({ 型: '新增规则', 内容: expect.any(String) }),
    );
    expect(mock跳转).toHaveBeenCalledWith(路径.规则库);
  });
});
