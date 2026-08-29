// P6 Task 7：非规范规则入口隔离（招聘端）。
// 候选筛选抽屉：Backend 只读（权威企业规则按行展示为纯文本，无输入 / 无删除 / 无新增，
// 管理规则 › 跳 企业代理设置）；Mock 原样可编辑。招聘端演示页（企业问AI代理 /
// 企业往来记录 / 候选详情）：记成规则 只在 Mock 派发 企业新增规则，Backend 只给中性提示。
// P5 Task 5 起 候选详情 的 Backend 分支改渲染共享 P5 详情 —— Mock 决策/记成规则入口在
// Backend 模式结构上不存在（详见该用例注释），规则写入边界由「Mock 体一概不挂载」保证。
// 测试宿主：mock 应用状态 / 导航钩子（同 企业我的.test.tsx 惯例）。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 候选筛选抽屉 from './候选筛选抽屉';
import 企业问AI代理 from '../屏幕/企业问AI代理';
import 企业往来记录 from '../屏幕/企业往来记录';
import 候选详情 from '../屏幕/候选详情';
import 候选推荐 from '../屏幕/候选推荐';
import { 路径 } from '../路由/路径表';
import { 企业日报, 在谈候选列表 } from '../数据/企业端模拟数据';
import { P5范围键 } from '../状态/后端/MatchCase操作';
import type { BFF招聘候选推荐 } from '../数据/BFF契约';
import { BFF招聘候选推荐样本, BFF岗位样本, 页面岗位样本 } from '../测试/BFF样本';
import { 发现推荐操作桩 } from '../测试/操作桩';

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
// P5 Task 5：候选详情 Backend 分支的 P5 详情域操作桩（no-op，用例只断言调用坐标）
const mock设置P5范围 = vi.fn();
const mock读取详情 = vi.fn(async (): Promise<void> => undefined);
const mock新增叮嘱 = vi.fn(async (): Promise<void> => undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

const mock加载招聘候选 = vi.fn(async () => undefined);
const mock设置候选收藏 = vi.fn(async () => undefined);

vi.mock('../状态/应用状态', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  use应用状态: () => mock应用状态,
}));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: vi.fn(), 跳转: mock跳转 }) }));
// 轻提示 是挂在 document.body 上的全局 DOM 容器，跨用例不清理 —— 换成间谍逐例断言
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

/** 招聘端规则种子：一条生效 + 一条停用 —— 纯文本行按权威数组如实展示，不在此处过滤 */
const 招聘规则种子 = [
  { 编号: 'R-01', 内容: '必须双休', 来源: '筛选设定', 生效: true },
  { 编号: 'R-02', 内容: '五年以上经验', 来源: '筛选设定', 生效: false },
];

/** 共用状态底座：mode + 招聘端水合阶段 + 页面字段由用例给；P5 用例按需补 操作/后端状态 */
function 置应用状态(选项: {
  模式: 'mock' | 'backend';
  招聘规则阶段?: string;
  状态?: Record<string, unknown>;
  操作?: Record<string, unknown>;
  后端状态补丁?: Record<string, unknown>;
}) {
  const { 模式, 招聘规则阶段 = '成功', 状态 = { 企业规则: 招聘规则种子 },
    操作, 后端状态补丁 } = 选项;
  mock应用状态 = {
    状态,
    派发: mock派发,
    数据源模式: 模式,
    ...(操作 === undefined ? {} : { 操作 }),
    后端状态: {
      Agent规则水合: {
        candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: 招聘规则阶段, proposals: '未开始' },
      },
      ...(后端状态补丁 ?? {}),
    },
  };
}

function renderRecruiterDrawer(选项: { mode: 'mock' | 'backend'; rulesStage?: string } = {
  mode: 'backend',
}) {
  置应用状态({ 模式: 选项.mode, 招聘规则阶段: 选项.rulesStage });
  return render(<候选筛选抽屉 关闭={() => undefined} />);
}

/** 给 rerender 用：先切回 Mock 状态，再返回同一组件的元素 */
function mockRecruiterDrawer() {
  置应用状态({ 模式: 'mock', 招聘规则阶段: '未开始' });
  return <候选筛选抽屉 关闭={() => undefined} />;
}

/** 招聘端演示页的页面字段（不含企业规则） */
function 招聘页状态(): Record<string, unknown> {
  return { 企业认证: { 姓名: '邵铭', 公司: '云衢科技', 职务: '技术 VP' }, 招聘头像: null };
}

describe('候选筛选抽屉 · Backend 只读，Mock 可编辑', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock轻提示.mockClear();
  });

  it('Backend recruiter drawer is read-only while Mock stays editable', () => {
    const { rerender } = renderRecruiterDrawer({ mode: 'backend' });
    expect(screen.queryByRole('textbox')).toBeNull();
    rerender(mockRecruiterDrawer());
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
  });

  it('Backend 抽屉把权威企业规则按行展示为纯文本，且不出现任何写入口', () => {
    renderRecruiterDrawer({ mode: 'backend' });
    expect(screen.getByText('必须双休')).toBeTruthy();
    expect(screen.getByText('五年以上经验')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /删除规则/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '＋ 添加规则' })).toBeNull();
    expect(mock派发).not.toHaveBeenCalled();
  });

  it('Backend 抽屉的 管理规则 › 跳企业代理设置', async () => {
    const user = userEvent.setup();
    renderRecruiterDrawer({ mode: 'backend' });
    await user.click(screen.getByRole('button', { name: '管理规则 ›' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.企业代理设置);
  });

  it('Mock 抽屉保留原交互：规则行、删除键与 ＋ 添加规则 都在', () => {
    renderRecruiterDrawer({ mode: 'mock' });
    expect(screen.getByDisplayValue('必须双休')).toBeTruthy();
    expect(screen.getByRole('button', { name: '删除规则 必须双休' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '＋ 添加规则' })).toBeTruthy();
  });
});

describe('招聘端演示页 · 记成规则的模式边界', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock轻提示.mockClear();
    mock设置P5范围.mockClear();
    mock读取详情.mockClear();
    mock新增叮嘱.mockClear();
  });

  it('企业问AI代理：Backend 点「放宽薪资带」不派发 企业新增规则，只提示去AI代理设置', async () => {
    置应用状态({ 模式: 'backend', 状态: 招聘页状态() });
    render(<企业问AI代理 />);
    await userEvent.click(screen.getByRole('button', { name: '放宽薪资带' }));
    expect(mock派发).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock轻提示).toHaveBeenCalledWith('请到AI代理设置确认并添加长期规则');
  });

  it('企业问AI代理：Mock 仍派发 企业新增规则 并跳企业代理设置', async () => {
    置应用状态({ 模式: 'mock', 状态: 招聘页状态() });
    render(<企业问AI代理 />);
    await userEvent.click(screen.getByRole('button', { name: '放宽薪资带' }));
    expect(mock派发).toHaveBeenCalledWith({
      型: '企业新增规则',
      内容: 企业日报.松一档.规则内容,
      来源: 企业日报.松一档.规则来源,
    });
    expect(mock跳转).toHaveBeenCalledWith(路径.企业代理设置);
  });

  it('企业往来记录：Backend 记成规则不派发 企业新增规则，只提示去AI代理设置', async () => {
    置应用状态({ 模式: 'backend', 状态: {} });
    render(
      <MemoryRouter initialEntries={['/hr/thread/A-01']}>
        <Routes>
          <Route path="/hr/thread/:id" element={<企业往来记录 />} />
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
    expect(mock轻提示).toHaveBeenCalledWith('请到AI代理设置确认并添加长期规则');
  });

  it('企业往来记录：Mock 记成规则仍派发 企业新增规则 并跳企业代理设置', async () => {
    置应用状态({ 模式: 'mock', 状态: {} });
    render(
      <MemoryRouter initialEntries={['/hr/thread/A-01']}>
        <Routes>
          <Route path="/hr/thread/:id" element={<企业往来记录 />} />
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
      型: '企业新增规则',
      内容: '只要双休',
      来源: '来自「陈屿」单的叮嘱 · 刚刚',
    });
    expect(mock跳转).toHaveBeenCalledWith(路径.企业代理设置);
  });

  it('候选详情：Backend 只渲染 P5 详情 —— Mock 拍板/记成规则入口整体退场，零规则派发', async () => {
    // P5 Task 5 起 Backend 分支不再渲染 Mock 候选体（旧「Backend 借 Mock 剧情拍板、
    // 只拦规则写入」的妥协面随之后退场）：决策卡/拿不准弹层/记成规则在 Backend 模式
    // 结构上不存在，规则写入边界由「Mock 体一概不挂载」结构性保证。
    置应用状态({
      模式: 'backend',
      状态: { 企业候选列表: 在谈候选列表, 候选决策: {}, 候选决策快照: {}, 叮嘱表: {} },
      操作: {
        设置P5范围: mock设置P5范围,
        读取详情: mock读取详情,
        新增叮嘱: mock新增叮嘱,
      },
      后端状态补丁: {
        已登录: true,
        主体: {
          subject_id: 'sub_1',
          roles: [{ role: 'recruiter', status: 'active' }],
          last_used_role: 'recruiter',
        },
        P5详情: {},
      },
    });
    render(
      <MemoryRouter initialEntries={['/hr/candidate/A-01']}>
        <Routes>
          <Route path="/hr/candidate/:id" element={<候选详情 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(mock设置P5范围).toHaveBeenCalledWith('recruiter', P5范围键.detail('recruiter', 'A-01'));
    expect(mock读取详情).toHaveBeenCalledWith('recruiter', 'A-01', true);
    expect(await screen.findByText('正在读入这一单…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '接受' })).toBeNull(); // Mock 决策卡不进 Backend 视图
    expect(screen.queryByRole('button', { name: '记成规则' })).toBeNull();
    expect(
      mock派发.mock.calls.some(
        ([动作]) => (动作 as { 型?: string } | undefined)?.型 === '企业新增规则',
      ),
    ).toBe(false);
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock轻提示).not.toHaveBeenCalled();
  });

  it('候选详情：Mock 拍板后记成规则仍派发 企业新增规则 并跳企业代理设置', async () => {
    置应用状态({
      模式: 'mock',
      状态: { 企业候选列表: 在谈候选列表, 候选决策: {}, 候选决策快照: {}, 叮嘱表: {} },
    });
    render(
      <MemoryRouter initialEntries={['/hr/candidate/A-01']}>
        <Routes>
          <Route path="/hr/candidate/:id" element={<候选详情 />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('button', { name: '接受' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '记成规则' })).toBeTruthy(),
    );
    await userEvent.click(screen.getByRole('button', { name: '记成规则' }));
    expect(mock派发).toHaveBeenCalledWith(
      expect.objectContaining({ 型: '企业新增规则', 内容: expect.any(String) }),
    );
    expect(mock跳转).toHaveBeenCalledWith(路径.企业代理设置);
  });
});

// ── P4 Task 7：抽屉的「只看收藏」本地开关（Backend 才有；切开关零请求）──

/** P4 招聘状态底座：当前岗位/岗位列表都携带 BFF job_id（生产水合口径，见 从BFF岗位） */
function 置P4招聘状态(items: BFF招聘候选推荐[]) {
  mock应用状态 = {
    数据源模式: 'backend', 派发: vi.fn(),
    状态: {
      当前岗位编号: BFF岗位样本.job_id,
      岗位列表: [{ ...页面岗位样本, 编号: BFF岗位样本.job_id, 状态: '在招' }],
      企业规则: [], 推荐列表: [], 收藏候选: [], 不合适候选: {}, 已接触推荐: [],
    },
    后端状态: {
      Agent规则水合: { candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '成功', proposals: '成功' } },
      招聘可用候选: { [BFF岗位样本.job_id]: {
        阶段: '成功', 刷新中: false, items, error: null, generation: 1,
      } },
      P4委托回执: {},
    },
    // 生产 Provider 恒注入全表：桩宿主同样给全表，用例只覆盖自己要断言的 spy
    操作: 发现推荐操作桩({ 加载招聘候选: mock加载招聘候选, 设置候选收藏: mock设置候选收藏 }),
  };
}

describe('候选筛选抽屉 · 只看收藏本地开关（P4）', () => {
  beforeEach(() => {
    mock加载招聘候选.mockClear();
    mock设置候选收藏.mockClear();
    mock轻提示.mockClear();
    mock跳转.mockClear();
  });

  it('Backend favorite filter is local and feedback is server-first', async () => {
    const user = userEvent.setup();
    置P4招聘状态([{ ...BFF招聘候选推荐样本, favorite: true }, { ...BFF招聘候选推荐样本,
      recommendation_id: 'rec_other', candidate_alias: '匿名乙', favorite: false }]);
    render(<候选推荐 />);
    await user.click(screen.getByRole('button', { name: /筛选.*▾/ }));
    await user.click(screen.getByRole('switch', { name: '只看收藏' }));
    expect(screen.getByText(BFF招聘候选推荐样本.candidate_alias)).toBeTruthy();
    expect(screen.queryByText('匿名乙')).toBeNull();
    expect(mock加载招聘候选).toHaveBeenCalledTimes(1);
    expect(mock设置候选收藏).not.toHaveBeenCalled();
  });
});
