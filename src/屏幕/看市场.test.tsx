// P6 Task 7：非规范规则入口隔离（候选端）。
// 看市场筛选层：Backend 只读（无输入 / 无删除、管理规则 › 跳 规则库）；筛选角标只认
// 已水合的权威规则（未水合不出 Mock 数字，水合后只数 生效:true）；Mock 原样可编辑。
// 候选端演示页（问AI代理 / 往来记录 / 在谈详情）：记成规则 只在 Mock 派发 新增规则，
// Backend 只给中性提示，不落规则、不冒充已生效。
// P4 Task 6：候选看市场接上发现推荐 —— Backend 列表只来自当前活跃意向的候选岗位
// 快照（本地搜索、下拉 GET 重读、空态建新批次），委托一律先过 确认层 的披露确认；
// Mock 保持一键派发 委托入谈 的原型行为。
// 测试宿主：mock 应用状态 / 导航钩子（同 企业我的.test.tsx 惯例）。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 看市场 from './看市场';
import 问AI代理 from './问AI代理';
import 往来记录 from './往来记录';
import 在谈详情 from './在谈详情';
import { 路径 } from '../路由/路径表';
import { 今日简报, 在谈列表 } from '../数据/模拟数据';
import { BFF错误 } from '../数据/HTTP客户端';
import type { BFF候选岗位推荐, BFF附件简历, BFF附件简历库 } from '../数据/BFF契约';
import { BFF候选岗位推荐样本, BFF意向样本 } from '../测试/BFF样本';
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
// P4 操作桩：屏幕只经上下文操作表触达后端，逐例注入需要的子集
const mock委托候选岗位 = vi.fn();
const mock加载候选岗位 = vi.fn(async () => undefined);
const mock刷新候选岗位 = vi.fn(async () => undefined);
const mock设置发现推荐范围 = vi.fn();
const mock刷新委托 = vi.fn(async () => undefined);
// P5 Task 3：委托前的权威附件库准备（附件简历操作 域的桩）
const mock准备候选委托简历 = vi.fn();
// P5 Task 5：在谈详情 Backend 分支改渲染共享 P5 详情 —— 详情域操作桩
const mock设置P5范围 = vi.fn();
const mock读取详情 = vi.fn(async () => undefined);
const mock新增叮嘱 = vi.fn(async () => undefined);

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

/** 共用状态底座：mode + 双端水合阶段由用例给，页面字段、P4 后端状态补丁与操作桩按需补 */
function 置应用状态(选项: {
  模式?: 'mock' | 'backend'; 候选规则阶段?: string;
  状态?: Record<string, unknown>; 后端状态?: Record<string, unknown>;
  操作?: Record<string, unknown>;
}) {
  const { 模式 = 'mock', 候选规则阶段 = '未开始', 状态 = {},
    后端状态 = {}, 操作 = {} } = 选项;
  mock应用状态 = {
    // 生产 Provider 恒注入全表：桩宿主同样给全表，用例只覆盖自己要断言的 spy
    // 准备候选委托简历 属附件域，同样默认给桩，用例再用 mockResolvedValue 定行为
    状态, 派发: mock派发, 数据源模式: 模式,
    操作: 发现推荐操作桩({ 准备候选委托简历: mock准备候选委托简历, ...操作 }),
    后端状态: {
      Agent规则水合: {
        candidate: { rules: 候选规则阶段, proposals: '未开始' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
      ...后端状态,
    },
  };
}

/** P4 候选状态底座：按生产口径播种 —— 当前意向 是意向名（标题职位段），编号载体
 *  当前意向编号 才是 intention_id；快照与操作桩由用例给（操作补丁在缺省委托桩之后展开）*/
function 置P4候选状态(items: BFF候选岗位推荐[], 操作补丁: Record<string, unknown> = {}) {
  置应用状态({
    模式: 'backend', 候选规则阶段: '成功',
    状态: {
      子视图: '看市场', 当前意向: P4意向名, 当前意向编号: BFF意向样本.intention_id,
      后端意向服务端: { [BFF意向样本.intention_id]: BFF意向样本 },
      求职意向表: [], 在谈列表: [], 屏蔽名单: [], 不感兴趣岗位: [], 已委托: [],
      全局规则: [], 意向级规则: [], 简历经历: [], 简历教育: [], 简历技能: [],
    },
    后端状态: {
      候选岗位推荐: {
        [BFF意向样本.intention_id]: {
          阶段: '成功', 刷新中: false, items, error: null, generation: 1,
        },
      },
    },
    操作: { 委托候选岗位: mock委托候选岗位, ...操作补丁 },
  });
}

/** BFF意向样本 的意向名（顶部意向栏派发的口径：标题 `[城市] 职位` 的职位段）*/
const P4意向名 = '产品经理';

/** 换意向时的第二份快照底座：同一份字段结构，只换意向 ID、快照键与操作桩。
 *  两条意向共用同一个意向名（同城市同职位 = 现实的重名场景），编号载体才分得开。 */
function 置P4候选意向(选项: {
  意向ID: string;
  阶段: string;
  items: BFF候选岗位推荐[];
  操作?: Record<string, unknown>;
}) {
  const 意向 = { ...BFF意向样本, intention_id: 选项.意向ID };
  置应用状态({
    模式: 'backend', 候选规则阶段: '成功',
    状态: {
      子视图: '看市场', 当前意向: P4意向名, 当前意向编号: 选项.意向ID,
      后端意向服务端: { [选项.意向ID]: 意向 },
      求职意向表: [], 在谈列表: [], 屏蔽名单: [], 不感兴趣岗位: [], 已委托: [],
      全局规则: [], 意向级规则: [], 简历经历: [], 简历教育: [], 简历技能: [],
    },
    后端状态: {
      候选岗位推荐: {
        [选项.意向ID]: {
          阶段: 选项.阶段, 刷新中: false, items: 选项.items, error: null, generation: 1,
        },
      },
    },
    操作: 选项.操作 ?? { 委托候选岗位: mock委托候选岗位 },
  });
}

/** 便捷卡：换 ID/标题的候选推荐卡 */
function 换卡卡(选项: { 推荐ID: string; 岗位ID: string; 职位: string }): BFF候选岗位推荐 {
  return {
    ...BFF候选岗位推荐样本,
    recommendation_id: 选项.推荐ID,
    intention_id: BFF意向样本.intention_id,
    job: { ...BFF候选岗位推荐样本.job, job_id: 选项.岗位ID, title: 选项.职位 },
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
    mock委托候选岗位.mockClear();
    mock加载候选岗位.mockClear();
    mock刷新候选岗位.mockClear();
    mock设置发现推荐范围.mockClear();
    mock刷新委托.mockClear();
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
    mock设置P5范围.mockClear();
    mock读取详情.mockClear();
    mock新增叮嘱.mockClear();
  });

  it('问AI代理：Backend 不挂载模拟规则动作，Mock 仍可改成可谈', async () => {
    // Backend 模式下 Mock 体一概不挂载，「改成可谈」在结构上不存在（零派发零跳转）；
    // 同页切回 Mock 后原型动作原样可用 —— 派发 新增规则、留在本页、轻提示告知。
    置应用状态({ 模式: 'backend', 状态: { 基本信息: { 真名: '测试' } } });
    const page = render(<问AI代理 />);
    expect(screen.queryByRole('button', { name: '改成可谈' })).toBeNull();
    expect(mock派发).not.toHaveBeenCalled();

    置应用状态({ 模式: 'mock', 状态: { 基本信息: { 真名: '测试' } } });
    page.rerender(<问AI代理 />);
    await userEvent.click(screen.getByRole('button', { name: '改成可谈' }));
    expect(mock派发).toHaveBeenCalledWith({
      型: '新增规则',
      内容: 今日简报.松一档.规则内容,
      来源: 今日简报.松一档.规则来源,
    });
    // 2026-08-31 用户:「点记成规则不应该跳到规则库」—— 留在本页,轻提示告知
    expect(mock跳转).not.toHaveBeenCalledWith(路径.规则库);
    expect(mock轻提示).toHaveBeenCalledWith('已记成规则');
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

  it('往来记录：Mock 记成规则派发 新增规则 后留在本页并轻提示', async () => {
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
    // 2026-08-31 用户:「点记成规则不应该跳到规则库」—— 留在本页,轻提示告知
    expect(mock跳转).not.toHaveBeenCalledWith(路径.规则库);
    expect(mock轻提示).toHaveBeenCalledWith('已记成规则');
  });

  it('在谈详情：Backend 只渲染 P5 详情 —— Mock 决策/记成规则入口整体退场，零规则派发', async () => {
    // P5 Task 5 起 Backend 分支不再渲染 Mock 在谈体（旧「Backend 借 Mock 剧情做决策、
    // 只拦规则写入」的妥协面随之后退场）：决策卡/拿不准弹层/记成规则在 Backend 模式
    // 结构上不存在，规则写入边界由「Mock 体一概不挂载」结构性保证。
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
      后端状态: {
        已登录: true,
        主体: {
          subject_id: 'sub_1',
          roles: [{ role: 'candidate', status: 'active' }],
          last_used_role: 'candidate',
        },
        P5详情: {},
      },
      操作: {
        设置P5范围: mock设置P5范围,
        读取详情: mock读取详情,
        新增叮嘱: mock新增叮嘱,
      },
    });
    render(
      <MemoryRouter initialEntries={['/deal/J-02']}>
        <Routes>
          <Route path="/deal/:id" element={<在谈详情 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(mock读取详情).toHaveBeenCalledWith('candidate', 'J-02', true);
    expect(await screen.findByText('正在读入这一单…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '接受' })).toBeNull(); // Mock 决策卡不进 Backend 视图
    expect(screen.queryByRole('button', { name: '记成规则' })).toBeNull();
    expect(mock派发).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock轻提示).not.toHaveBeenCalled();
  });

  it('在谈详情：Mock 决策后记成规则派发 新增规则 后留在本页并轻提示', async () => {
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
    // 2026-08-31 用户:「点记成规则不应该跳到规则库」—— 留在本页,轻提示告知
    expect(mock跳转).not.toHaveBeenCalledWith(路径.规则库);
    expect(mock轻提示).toHaveBeenCalledWith('已记成规则');
  });
});

// ── P4 Task 6：候选看市场的发现推荐接线 ──────────────────────────

/** P4 状态字段的复用底座（换阶段/快照时局部覆盖） */
const P4状态底座 = (覆盖: Record<string, unknown> = {}) => ({
  子视图: '看市场', 当前意向: P4意向名, 当前意向编号: BFF意向样本.intention_id,
  后端意向服务端: { [BFF意向样本.intention_id]: BFF意向样本 },
  求职意向表: [], 在谈列表: [], 屏蔽名单: [], 不感兴趣岗位: [], 已委托: [],
  全局规则: [], 意向级规则: [], 简历经历: [], 简历教育: [], 简历技能: [],
  ...覆盖,
});

/** P4 scope 快照构造器（阶段/error/刷新中 按用例给） */
const P4快照 = (选项: {
  阶段: string; items?: BFF候选岗位推荐[]; error?: string | null; 刷新中?: boolean;
}) => ({
  阶段: 选项.阶段,
  刷新中: 选项.刷新中 ?? false,
  items: 选项.items ?? [],
  error: 选项.error ?? null,
  generation: 1,
});

/** 已接手卡：delegation 摘要 accepted，卡 state delegating */
const 接手卡: BFF候选岗位推荐 = {
  ...BFF候选岗位推荐样本,
  state: 'delegating',
  delegation: { delegation_id: 'del_1', state: 'accepted', case_id: null },
};

// ── P5 Task 3：委托前必须显式选定的附件简历坐标（零 / 一 / 多 表驱动底座）──

/** 便捷附件版本行：坐标只认 current_version.version_id，parse 与本任务无关 */
function 附件版本(id: string): BFF附件简历['current_version'] {
  return {
    version_id: id,
    version: 1,
    size_bytes: 1024,
    media_type: 'application/pdf',
    sha256: 'a'.repeat(64),
    created_at: '2026-08-28T00:00:00Z',
    parse: { status: 'not_started' },
  };
}

const 附件文件甲: BFF附件简历 = {
  file_id: 'rf_1',
  display_name: '沈亦舟_简历_2026.pdf',
  revision: 2,
  current_version: 附件版本('rfv_1'),
  created_at: '2026-08-28T00:00:00Z',
  updated_at: '2026-08-28T00:00:00Z',
};

const 附件文件乙: BFF附件简历 = {
  ...附件文件甲,
  file_id: 'rf_2',
  display_name: '产品简历_2026.pdf',
  current_version: 附件版本('rfv_2'),
};

function 附件库(items: BFF附件简历[]): BFF附件简历库 {
  return {
    items,
    limits: { max_files: 3, max_file_bytes: 10485760, accepted_media_types: ['application/pdf'] },
  };
}

/** 单文件库：既有委托用例的缺省准备结果 —— 一份文件仍要披露确认点名它 */
const 单文件附件库 = 附件库([附件文件甲]);
const 双文件附件库 = 附件库([附件文件甲, 附件文件乙]);

describe('看市场 · P4 候选发现（Backend）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock轻提示.mockClear();
    mock委托候选岗位.mockClear();
    mock加载候选岗位.mockClear();
    mock刷新候选岗位.mockClear();
    mock设置发现推荐范围.mockClear();
    mock刷新委托.mockClear();
    // 委托前的权威库准备缺省给单文件库：一份文件也必须披露确认点名后才发委托
    mock准备候选委托简历.mockReset();
    mock准备候选委托简历.mockResolvedValue(单文件附件库);
  });

  afterEach(() => {
    // 假时钟每个用例后恢复，避免泄漏进其它测试文件
    vi.useRealTimers();
  });

  it('Backend delegation requires fresh disclosure confirmation and never dispatches Mock Case actions', async () => {
    const user = userEvent.setup();
    置P4候选状态([BFF候选岗位推荐样本]);
    render(<看市场 />);
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    expect(screen.getByRole('dialog', { name: '确认委托AI代理？' }).textContent).toContain(
      '沈亦舟_简历_2026.pdf');
    expect(screen.getByRole('dialog', { name: '确认委托AI代理？' }).textContent).toContain(
      '仅对这一次委托生效');
    expect(mock委托候选岗位).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '确认委托' }));
    expect(mock委托候选岗位).toHaveBeenCalledWith({
      intentionId: BFF候选岗位推荐样本.intention_id,
      recommendationId: BFF候选岗位推荐样本.recommendation_id,
      jobId: BFF候选岗位推荐样本.job.job_id,
      resumeFileId: 附件文件甲.file_id,
      resumeFileVersionId: 附件文件甲.current_version.version_id,
      disclosureAcknowledged: true,
    });
    expect(mock派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '委托入谈' }));
  });

  it('取消确认零请求零状态变化', async () => {
    const user = userEvent.setup();
    置P4候选状态([BFF候选岗位推荐样本]);
    render(<看市场 />);
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    expect(screen.getByRole('dialog', { name: '确认委托AI代理？' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '暂不委托' }));
    expect(screen.queryByRole('dialog', { name: '确认委托AI代理？' })).toBeNull();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
  });

  it('委托失败即收层并提示，下一次点击必须重新确认', async () => {
    const user = userEvent.setup();
    mock委托候选岗位.mockRejectedValueOnce(new Error('委托被拒'));
    置P4候选状态([BFF候选岗位推荐样本]);
    render(<看市场 />);
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await user.click(screen.getByRole('button', { name: '确认委托' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalled());
    expect(screen.queryByRole('dialog', { name: '确认委托AI代理？' })).toBeNull();
    // 再点必须重新过确认层：上一次的授权不能复用
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    expect(screen.getByRole('dialog', { name: '确认委托AI代理？' })).toBeTruthy();
    expect(mock委托候选岗位).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: '确认委托' }));
    await waitFor(() => expect(mock委托候选岗位).toHaveBeenCalledTimes(2));
  });

  it('进屏按当前真实意向注册可见范围并懒加载（先注册后加载，离开即清）', () => {
    置P4候选意向({
      意向ID: BFF意向样本.intention_id, 阶段: '未开始', items: [],
      操作: { 设置发现推荐范围: mock设置发现推荐范围, 加载候选岗位: mock加载候选岗位 },
    });
    const 页 = render(<看市场 />);
    expect(mock设置发现推荐范围).toHaveBeenCalledWith('candidate', `candidate:list:${BFF意向样本.intention_id}`);
    expect(mock加载候选岗位).toHaveBeenCalledWith(BFF意向样本.intention_id);
    expect(mock设置发现推荐范围.mock.invocationCallOrder[0]).toBeLessThan(
      mock加载候选岗位.mock.invocationCallOrder[0]);
    页.unmount();
    expect(mock设置发现推荐范围).toHaveBeenCalledWith('candidate', null);
  });

  it('切意向即换 scope：旧范围先清、新范围后注册，旧数据不闪进新列表', () => {
    // 两条意向共用同一个意向名（重名场景）：列表跟着编号载体走，不跟着名字走
    置P4候选意向({
      意向ID: BFF意向样本.intention_id, 阶段: '成功', items: [BFF候选岗位推荐样本],
      操作: { 设置发现推荐范围: mock设置发现推荐范围, 加载候选岗位: mock加载候选岗位 },
    });
    const { rerender } = render(<看市场 />);
    expect(screen.getByText('AI 产品实习生')).toBeTruthy();
    置P4候选意向({
      意向ID: 'int_2', 阶段: '成功',
      items: [换卡卡({ 推荐ID: 'rec_c2', 岗位ID: 'job_2', 职位: '数据工程师' })],
      操作: { 设置发现推荐范围: mock设置发现推荐范围, 加载候选岗位: mock加载候选岗位 },
    });
    rerender(<看市场 />);
    expect(screen.queryByText('AI 产品实习生')).toBeNull();
    expect(screen.getByText('数据工程师')).toBeTruthy();
    expect(mock设置发现推荐范围.mock.calls).toEqual([
      ['candidate', `candidate:list:${BFF意向样本.intention_id}`],
      ['candidate', null],
      ['candidate', 'candidate:list:int_2'],
    ]);
  });

  it('编号载体缺席（意向未水合完）时不 admits、不发任何 P4 请求', () => {
    置应用状态({
      模式: 'backend', 候选规则阶段: '成功',
      状态: { ...P4状态底座(), 当前意向编号: null },
      后端状态: {
        候选岗位推荐: { [BFF意向样本.intention_id]: P4快照({ 阶段: '成功', items: [BFF候选岗位推荐样本] }) },
      },
      操作: { 设置发现推荐范围: mock设置发现推荐范围, 加载候选岗位: mock加载候选岗位 },
    });
    render(<看市场 />);
    expect(screen.getByText('还没有进行中的求职意向')).toBeTruthy();
    expect(mock加载候选岗位).not.toHaveBeenCalled();
    expect(mock设置发现推荐范围).not.toHaveBeenCalled();
  });

  it('编号载体指向非 active 意向时不 admits（宁空勿错）', () => {
    const 停用意向 = { ...BFF意向样本, status: 'archived' as const };
    置应用状态({
      模式: 'backend', 候选规则阶段: '成功',
      状态: {
        ...P4状态底座(),
        后端意向服务端: { [BFF意向样本.intention_id]: 停用意向 },
      },
      后端状态: {
        候选岗位推荐: { [BFF意向样本.intention_id]: P4快照({ 阶段: '成功', items: [BFF候选岗位推荐样本] }) },
      },
      操作: { 设置发现推荐范围: mock设置发现推荐范围, 加载候选岗位: mock加载候选岗位 },
    });
    render(<看市场 />);
    expect(screen.getByText('还没有进行中的求职意向')).toBeTruthy();
    expect(screen.queryByText('AI 产品实习生')).toBeNull();
    expect(mock加载候选岗位).not.toHaveBeenCalled();
  });

  it('本地搜索只在已加载卡上过滤', async () => {
    const user = userEvent.setup();
    置P4候选状态([
      BFF候选岗位推荐样本,
      换卡卡({ 推荐ID: 'rec_c2', 岗位ID: 'job_2', 职位: '数据工程师' }),
    ]);
    render(<看市场 />);
    expect(screen.getByText('AI 产品实习生')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '搜索职位' }));
    await user.type(screen.getByPlaceholderText('搜职位、公司或关键词'), '数据');
    expect(screen.getByText('数据工程师')).toBeTruthy();
    expect(screen.queryByText('AI 产品实习生')).toBeNull();
  });

  it('初次载入给加载态；失败态给错误文案与重试（重试走 force GET）', async () => {
    const user = userEvent.setup();
    置P4候选意向({ 意向ID: BFF意向样本.intention_id, 阶段: '进行中', items: [], 操作: {} });
    const 页 = render(<看市场 />);
    expect(screen.getByText('正在为你挑岗位…')).toBeTruthy();
    页.unmount();

    置应用状态({
      模式: 'backend', 候选规则阶段: '成功',
      状态: P4状态底座(),
      后端状态: {
        候选岗位推荐: {
          [BFF意向样本.intention_id]: P4快照({ 阶段: '失败', error: '服务暂时不可用，请稍后再试' }),
        },
      },
      操作: { 加载候选岗位: mock加载候选岗位 },
    });
    render(<看市场 />);
    expect(screen.getByText('推荐暂时加载不了')).toBeTruthy();
    expect(screen.getByText('服务暂时不可用，请稍后再试')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock加载候选岗位).toHaveBeenCalledWith(BFF意向样本.intention_id, true);
  });

  it('空快照给「没有新职位」空态；让AI代理帮我搜建新批次（POST+GET）', async () => {
    const user = userEvent.setup();
    置P4候选意向({
      意向ID: BFF意向样本.intention_id, 阶段: '成功', items: [],
      操作: { 刷新候选岗位: mock刷新候选岗位 },
    });
    render(<看市场 />);
    expect(screen.getByText('这个意向下暂时没有新职位')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '让AI代理帮我搜' }));
    expect(mock刷新候选岗位).toHaveBeenCalledWith(BFF意向样本.intention_id);
    expect(mock加载候选岗位).not.toHaveBeenCalled();
  });

  it('下拉刷新只重读当前 scope（GET），不建新批次', () => {
    置P4候选意向({
      意向ID: BFF意向样本.intention_id, 阶段: '成功', items: [BFF候选岗位推荐样本],
      操作: { 加载候选岗位: mock加载候选岗位, 刷新候选岗位: mock刷新候选岗位 },
    });
    render(<看市场 />);
    const root = document.querySelector('.滚动区')!.parentElement!;
    fireEvent.pointerDown(root, { clientY: 0 });
    fireEvent.pointerMove(root, { clientY: 120 });
    fireEvent.pointerUp(root, { clientY: 120 });
    expect(mock加载候选岗位).toHaveBeenCalledWith(BFF意向样本.intention_id, true);
    expect(mock刷新候选岗位).not.toHaveBeenCalled();
  });

  // Task 6 的异步接缝必须真的接上：下拉把 GET 的 Promise 交回 下拉刷新，
  // 转圈等真实 settle，而不是恒定 900ms 就收
  it('下拉转圈等真实 GET settle：过了最短动画仍在转，GET 回来才收', async () => {
    vi.useFakeTimers();
    置P4候选意向({
      意向ID: BFF意向样本.intention_id, 阶段: '成功', items: [BFF候选岗位推荐样本],
      操作: { 加载候选岗位: mock加载候选岗位, 刷新候选岗位: mock刷新候选岗位 },
    });
    render(<看市场 />);
    // 进屏懒加载那一发先走完，下拉这一发才是被卡住的那个 GET
    let 放行!: () => void;
    mock加载候选岗位.mockImplementationOnce(
      () => new Promise<undefined>((resolve) => {
        放行 = () => resolve(undefined);
      }),
    );
    const root = document.querySelector('.滚动区')!.parentElement!;
    fireEvent.pointerDown(root, { clientY: 0 });
    fireEvent.pointerMove(root, { clientY: 120 });
    fireEvent.pointerUp(root, { clientY: 120 });
    expect(mock加载候选岗位).toHaveBeenLastCalledWith(BFF意向样本.intention_id, true);
    // 最短动画 900ms 早过了：GET 还没回来就不许收圈
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(document.querySelector('[class*="刷新转"]')).not.toBeNull();
    await act(async () => {
      放行();
    });
    expect(document.querySelector('[class*="刷新转"]')).toBeNull();
  });

  it('刷新失败保留旧卡并给出未决文案', () => {
    置P4候选状态([BFF候选岗位推荐样本]);
    const { rerender } = render(<看市场 />);
    expect(screen.getByText('AI 产品实习生')).toBeTruthy();
    置应用状态({
      模式: 'backend', 候选规则阶段: '成功',
      状态: P4状态底座(),
      后端状态: {
        候选岗位推荐: {
          [BFF意向样本.intention_id]: P4快照({
            阶段: '成功', items: [BFF候选岗位推荐样本], error: '已发起新一轮，结果暂未刷新',
          }),
        },
      },
      操作: { 委托候选岗位: mock委托候选岗位 },
    });
    rerender(<看市场 />);
    expect(screen.getByText('AI 产品实习生')).toBeTruthy();
    expect(screen.getByText('已发起新一轮，结果暂未刷新')).toBeTruthy();
  });

  it('不感兴趣服务端移除后，列表只按权威快照出卡', () => {
    置P4候选状态([
      BFF候选岗位推荐样本,
      换卡卡({ 推荐ID: 'rec_c2', 岗位ID: 'job_2', 职位: '数据工程师' }),
    ]);
    const { rerender } = render(<看市场 />);
    expect(screen.getByText('AI 产品实习生')).toBeTruthy();
    // 操作层 PUT 成功并从 scope 移除之后的权威快照：卡不残留、不靠本地过滤
    置P4候选状态([换卡卡({ 推荐ID: 'rec_c2', 岗位ID: 'job_2', 职位: '数据工程师' })]);
    rerender(<看市场 />);
    expect(screen.queryByText('AI 产品实习生')).toBeNull();
    expect(screen.getByText('数据工程师')).toBeTruthy();
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
  const 候选卡态 = {
    accepted: 'delegating', evaluating: 'delegating', case_started: 'delegated',
    needs_user: 'available', refused: 'available', failed: 'available',
  } as const;

  it.each(状态文案)('%s 委托按闭合表显示「%s」，去谈键不在', (state, 文案) => {
    置P4候选状态([{
      ...BFF候选岗位推荐样本,
      state: 候选卡态[state],
      delegation: { delegation_id: `del_${state}`, state, case_id: null },
    }]);
    render(<看市场 />);
    expect(screen.getByText(文案)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '让AI代理去谈' })).toBeNull();
    // 已退役的自创文案绝不在 Backend 卡上复活
    expect(screen.queryByText('AI代理已接手')).toBeNull();
    expect(screen.queryByText('已开始沟通')).toBeNull();
  });

  it('candidate case_started navigates only by server case_id', async () => {
    置P4候选状态([{
      ...BFF候选岗位推荐样本,
      state: 'delegated',
      delegation: { delegation_id: 'del_c1', state: 'case_started', case_id: 'case_server_c1' },
    }]);
    render(<看市场 />);
    await userEvent.click(screen.getByRole('button', { name: '查看进展' }));
    expect(mock跳转).toHaveBeenCalledTimes(1);
    expect(mock跳转).toHaveBeenCalledWith(路径.在谈详情('case_server_c1'));
  });

  it('case_started 无服务端 case_id 时只给禁用状态标，绝不拿任何本地 ID 充当 Case', () => {
    置P4候选状态([{
      ...BFF候选岗位推荐样本,
      state: 'delegated',
      delegation: { delegation_id: 'del_c2', state: 'case_started', case_id: null },
    }]);
    render(<看市场 />);
    expect(screen.getByText('已创建真实在谈')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '查看进展' })).toBeNull();
    // job_id / recommendation_id / delegation_id 一个都不进导航
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock跳转.mock.calls.flat().map(String))
      .not.toEqual(expect.arrayContaining([expect.stringContaining('job_1')]));
    expect(mock跳转.mock.calls.flat().map(String))
      .not.toEqual(expect.arrayContaining([expect.stringContaining('rec_c1')]));
    expect(mock跳转.mock.calls.flat().map(String))
      .not.toEqual(expect.arrayContaining([expect.stringContaining('del_c2')]));
  });

  it.each(['accepted', 'evaluating'] as const)('%s remains the only polling state', async (state) => {
    vi.useFakeTimers();
    置P4候选状态([{
      ...BFF候选岗位推荐样本,
      state: 'delegating',
      delegation: { delegation_id: `del_${state}`, state, case_id: null },
    }], { 刷新委托: mock刷新委托 });
    render(<看市场 />);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(mock刷新委托).toHaveBeenCalledWith('candidate', `del_${state}`);
  });

  it.each(['case_started', 'needs_user', 'refused', 'failed'] as const)(
    '%s does not poll or render an in-progress label',
    async (state) => {
      vi.useFakeTimers();
      置P4候选状态([{
        ...BFF候选岗位推荐样本,
        state: state === 'case_started' ? 'delegated' : 'available',
        delegation: { delegation_id: `del_${state}`, state, case_id: null },
      }], { 刷新委托: mock刷新委托 });
      render(<看市场 />);
      await act(() => vi.advanceTimersByTimeAsync(10000));
      expect(mock刷新委托).not.toHaveBeenCalled();
      expect(screen.queryByText('AI 正在评估')).toBeNull();
    },
  );

  it('重载进屏只有权威摘要、回执表为空：状态照常出现，不依赖本地归约历史', () => {
    置P4候选状态([{
      ...BFF候选岗位推荐样本,
      state: 'delegating',
      delegation: { delegation_id: 'del_reload', state: 'evaluating', case_id: null },
    }]);
    render(<看市场 />);
    expect(screen.getByText('AI 正在评估')).toBeTruthy();
    expect(screen.queryByText('AI代理已接手')).toBeNull();
    expect(screen.queryByText('已开始沟通')).toBeNull();
  });

  it('页面挂载时对进行中委托按节拍刷新回执', async () => {
    vi.useFakeTimers();
    mock刷新委托.mockResolvedValue(undefined);
    置应用状态({
      模式: 'backend', 候选规则阶段: '成功',
      状态: P4状态底座(),
      后端状态: {
        候选岗位推荐: { [BFF意向样本.intention_id]: P4快照({ 阶段: '成功', items: [接手卡] }) },
      },
      操作: { 委托候选岗位: mock委托候选岗位, 刷新委托: mock刷新委托 },
    });
    render(<看市场 />);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(mock刷新委托).toHaveBeenCalledWith('candidate', 'del_1');
  });

  it('委托成功后原地停留：不跳在谈详情、不派发任何 Mock 动作', async () => {
    const user = userEvent.setup();
    置P4候选状态([BFF候选岗位推荐样本]);
    render(<看市场 />);
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await user.click(screen.getByRole('button', { name: '确认委托' }));
    await waitFor(() => expect(mock委托候选岗位).toHaveBeenCalledTimes(1));
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock派发).not.toHaveBeenCalled();
  });

  it('Backend 市场卡进详情带来源标记，详情页才能安全返回本屏；Mock 卡不带', async () => {
    const user = userEvent.setup();
    置P4候选状态([BFF候选岗位推荐样本]);
    const 页 = render(<看市场 />);
    await user.click(screen.getByRole('button', { name: '查看职位详情' }));
    expect(mock跳转).toHaveBeenCalledWith(
      路径.职位详情(BFF候选岗位推荐样本.job.job_id),
      { 来源: 'candidate-market' },
    );
    页.unmount();

    // Mock 卡的按下导航保持原样：不带任何 location state
    置应用状态({
      模式: 'mock',
      状态: {
        子视图: '看市场', 当前意向: 'AI 产品经理',
        求职意向表: [{ 编号: 'I-01', 标题: '[上海] AI 产品经理' }],
        在谈列表: [], 屏蔽名单: [], 不感兴趣岗位: [], 已委托: [],
        全局规则: [], 意向级规则: [], 简历经历: [], 简历教育: [], 简历技能: [],
      },
    });
    const Mock页 = render(<看市场 />);
    await user.click(screen.getAllByRole('button', { name: '查看职位详情' })[0]!);
    // 只有一个参数：目标路径 + 无任何 location state（Mock 行为逐字不变）
    expect(mock跳转.mock.lastCall).toHaveLength(1);
    expect(String(mock跳转.mock.lastCall![0])).toMatch(/^\/job\//);
    Mock页.unmount();
  });

  it('Mock 保持一键委托：立即派发 委托入谈，无确认层', async () => {
    const user = userEvent.setup();
    置应用状态({
      模式: 'mock',
      状态: {
        子视图: '看市场', 当前意向: 'AI 产品经理',
        求职意向表: [{ 编号: 'I-01', 标题: '[上海] AI 产品经理' }],
        在谈列表: [], 屏蔽名单: [], 不感兴趣岗位: [], 已委托: [],
        全局规则: [], 意向级规则: [], 简历经历: [], 简历教育: [], 简历技能: [],
      },
    });
    render(<看市场 />);
    const 去谈键 = screen.getAllByRole('button', { name: '让AI代理去谈' });
    expect(去谈键.length).toBeGreaterThan(0);
    await user.click(去谈键[0]!);
    expect(mock派发).toHaveBeenCalledWith({
      型: '委托入谈',
      岗: expect.objectContaining({ 意向: 'AI 产品经理' }),
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    // Mock 委托不读附件库：一键派发的原型行为保持原样
    expect(mock准备候选委托简历).not.toHaveBeenCalled();
  });

  it('Backend 列表零 Mock 兜底：空快照也不回退市场列表', () => {
    置P4候选意向({ 意向ID: BFF意向样本.intention_id, 阶段: '成功', items: [], 操作: {} });
    render(<看市场 />);
    expect(screen.getByText('这个意向下暂时没有新职位')).toBeTruthy();
    expect(screen.queryByText('MiniMax')).toBeNull();
    expect(screen.queryByText('AI 产品经理（Agent 方向）')).toBeNull();
  });

  it('顶栏胶囊在 Backend 随切意向带上编号；Mock 不带（载体只在 Backend 写入）', async () => {
    const user = userEvent.setup();
    const 顶栏状态 = {
      子视图: '看市场', 当前意向: P4意向名, 当前意向编号: BFF意向样本.intention_id,
      求职意向表: [{ 编号: BFF意向样本.intention_id, 标题: '[上海] 产品经理', 说明: '' }],
      在谈列表: [], 屏蔽名单: [], 不感兴趣岗位: [], 已委托: [],
      全局规则: [], 意向级规则: [], 简历经历: [], 简历教育: [], 简历技能: [],
    };
    置应用状态({ 模式: 'backend', 状态: 顶栏状态 });
    const 页 = render(<看市场 />);
    await user.click(screen.getByRole('button', { name: P4意向名 }));
    expect(mock派发).toHaveBeenCalledWith({
      型: '切意向', 意向: P4意向名, 编号: BFF意向样本.intention_id,
    });
    页.unmount();

    置应用状态({ 模式: 'mock', 状态: 顶栏状态 });
    render(<看市场 />);
    await user.click(screen.getByRole('button', { name: P4意向名 }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '切意向', 意向: P4意向名 });
  });
});

// ── P5 Task 3：委托前的显式简历选择（零 / 一 / 多 表驱动）────────────────────
//   委托第一跳先拿权威附件库：零份 → 提示去上传并跳 我的简历（零委托）；
//   一份 → 披露确认点名该文件；多份 → 附件简历选择层 必须单选。
//   读被拒 → P4 失败 toast（零导航零委托）；null（会话/角色换代）→ 静默返回，
//   绝不进零文件的跳转分支。
describe('看市场 · 委托前必须显式选定简历坐标（Backend）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock轻提示.mockClear();
    mock委托候选岗位.mockClear();
    mock准备候选委托简历.mockReset();
  });

  it.each([
    {
      名称: '0 份：提示先上传并跳 我的简历，零委托',
      库: 附件库([]),
      场景: '零',
    },
    {
      名称: '1 份：披露确认点名该文件，确认只发它的当前 file/version',
      库: 单文件附件库,
      场景: '单',
    },
    {
      名称: '2 份：必须单选后才可确认，只发所选行的当前 file/version',
      库: 双文件附件库,
      场景: '多',
    },
  ])('$名称', async ({ 库, 场景 }) => {
    const user = userEvent.setup();
    mock准备候选委托简历.mockResolvedValue(库);
    置P4候选状态([BFF候选岗位推荐样本]);
    render(<看市场 />);
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await waitFor(() => expect(mock准备候选委托简历).toHaveBeenCalledTimes(1));
    expect(mock委托候选岗位).not.toHaveBeenCalled();

    if (场景 === '零') {
      await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('请先上传一份 PDF 简历'));
      expect(mock跳转).toHaveBeenCalledWith(路径.我的简历);
      expect(screen.queryByRole('dialog')).toBeNull();
      return;
    }

    if (场景 === '单') {
      const 确认框 = screen.getByRole('dialog', { name: '确认委托AI代理？' });
      expect(确认框.textContent).toContain(附件文件甲.display_name);
      await user.click(screen.getByRole('button', { name: '确认委托' }));
      await waitFor(() => expect(mock委托候选岗位).toHaveBeenCalledTimes(1));
      expect(mock委托候选岗位).toHaveBeenCalledWith({
        intentionId: BFF候选岗位推荐样本.intention_id,
        recommendationId: BFF候选岗位推荐样本.recommendation_id,
        jobId: BFF候选岗位推荐样本.job.job_id,
        resumeFileId: 附件文件甲.file_id,
        resumeFileVersionId: 附件文件甲.current_version.version_id,
        disclosureAcknowledged: true,
      });
      return;
    }

    // 多份：单选层先出，确认键未选禁用
    expect(screen.getByRole('dialog', { name: '选择委托简历' })).toBeTruthy();
    const 确认键 = screen.getByRole('button', { name: '确认并委托' }) as HTMLButtonElement;
    expect(确认键.disabled).toBe(true);
    await user.click(screen.getByRole('radio', { name: 附件文件乙.display_name }));
    await user.click(确认键);
    await waitFor(() => expect(mock委托候选岗位).toHaveBeenCalledTimes(1));
    expect(mock委托候选岗位).toHaveBeenCalledWith({
      intentionId: BFF候选岗位推荐样本.intention_id,
      recommendationId: BFF候选岗位推荐样本.recommendation_id,
      jobId: BFF候选岗位推荐样本.job.job_id,
      resumeFileId: 附件文件乙.file_id,
      resumeFileVersionId: 附件文件乙.current_version.version_id,
      disclosureAcknowledged: true,
    });
  });

  it('准备读被拒：P4 失败 toast，零导航零委托零弹层', async () => {
    const user = userEvent.setup();
    mock准备候选委托简历.mockRejectedValue(new BFF错误(503, 'source_unavailable', 'down'));
    置P4候选状态([BFF候选岗位推荐样本]);
    render(<看市场 />);
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await waitFor(() =>
      expect(mock轻提示).toHaveBeenCalledWith('服务暂时不可用，请稍后再试'));
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('null（会话/角色换代）：静默无操作，绝不进零文件跳转分支', async () => {
    const user = userEvent.setup();
    mock准备候选委托简历.mockResolvedValue(null);
    置P4候选状态([BFF候选岗位推荐样本]);
    render(<看市场 />);
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await waitFor(() => expect(mock准备候选委托简历).toHaveBeenCalledTimes(1));
    expect(mock轻提示).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('取消即清捕获：下一次点击重读权威库，绝不复用旧授权', async () => {
    const user = userEvent.setup();
    mock准备候选委托简历.mockResolvedValue(双文件附件库);
    置P4候选状态([BFF候选岗位推荐样本]);
    render(<看市场 />);
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: '选择委托简历' })).toBeTruthy());
    await user.click(screen.getByRole('radio', { name: 附件文件乙.display_name }));
    await user.click(screen.getByRole('button', { name: '暂不委托' }));
    expect(screen.queryByRole('dialog', { name: '选择委托简历' })).toBeNull();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
    // 再点是一次全新的准备：选择与推荐捕获都不带走
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await waitFor(() => expect(mock准备候选委托简历).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('dialog', { name: '选择委托简历' })).toBeTruthy();
    const 确认键 = screen.getByRole('button', { name: '确认并委托' }) as HTMLButtonElement;
    expect(确认键.disabled).toBe(true);
  });

  // 准备读在途时换 scope / 离开本屏：迟到的权威库结果必须被栅栏丢弃 ——
  // 不许在新意向下弹旧岗位的确认层，更不许离屏后还提示并跳 我的简历
  //（plan：选择不跨 cancel/完成/卸载/scope 变化存活）。
  it('准备读在途切换意向：迟到结果被丢弃，不提示不弹层不跳转零委托', async () => {
    const user = userEvent.setup();
    let 解决!: (库: BFF附件简历库) => void;
    mock准备候选委托简历.mockImplementation(
      () => new Promise<BFF附件简历库>((res) => { 解决 = res; }),
    );
    置P4候选状态([BFF候选岗位推荐样本]);
    const 视图 = render(<看市场 />);
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    expect(mock准备候选委托简历).toHaveBeenCalledTimes(1);
    // 读取仍在途时切到另一条意向（同名意向、不同编号载体，同生产切换路径）
    置P4候选意向({
      意向ID: 'int_乙', 阶段: '成功',
      items: [换卡卡({ 推荐ID: 'rec_乙', 岗位ID: 'job_乙', 职位: '产品经理' })],
    });
    视图.rerender(<看市场 />);
    // 零文件是后果最重的分支：本该提示去上传 + 跳 我的简历
    解决(附件库([]));
    await act(async () => {});
    expect(mock轻提示).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('准备读在途离开本屏（卸载）：迟到结果不提示不跳转零委托', async () => {
    const user = userEvent.setup();
    let 解决!: (库: BFF附件简历库) => void;
    mock准备候选委托简历.mockImplementation(
      () => new Promise<BFF附件简历库>((res) => { 解决 = res; }),
    );
    置P4候选状态([BFF候选岗位推荐样本]);
    const 视图 = render(<看市场 />);
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    视图.unmount();
    // 迟到的零文件结果不许再触发提示 / 跳 我的简历
    解决(附件库([]));
    await act(async () => {});
    expect(mock轻提示).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
  });

  // 评审 R2：入口在 StrictMode 下跑（effect 会 setup→cleanup→setup 双执行），
  // 挂载栅栏若只在 cleanup 里落 false 而不在 setup 里回 true，dev 下全部委托都会
  // 被误判成「已离屏」而静默丢弃 —— 弹层必须照常出现。
  it('StrictMode 双重挂载不误判离屏：准备结果照常弹层', async () => {
    const user = userEvent.setup();
    mock准备候选委托简历.mockResolvedValue(双文件附件库);
    置P4候选状态([BFF候选岗位推荐样本]);
    render(
      <StrictMode>
        <看市场 />
      </StrictMode>,
    );
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: '选择委托简历' })).toBeTruthy());
  });

  it('意向 A→B→A 往返：跨 scope 的迟到结果同样作废，不弹层零委托', async () => {
    const user = userEvent.setup();
    let 解决!: (库: BFF附件简历库) => void;
    mock准备候选委托简历.mockImplementation(
      () => new Promise<BFF附件简历库>((res) => { 解决 = res; }),
    );
    置P4候选状态([BFF候选岗位推荐样本]);
    const 视图 = render(<看市场 />);
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    // 切去乙再切回甲：坐标相等但 scope 已换过两轮，迟到结果必须作废
    置P4候选意向({
      意向ID: 'int_乙', 阶段: '成功',
      items: [换卡卡({ 推荐ID: 'rec_乙', 岗位ID: 'job_乙', 职位: '产品经理' })],
    });
    视图.rerender(<看市场 />);
    置P4候选状态([BFF候选岗位推荐样本]);
    视图.rerender(<看市场 />);
    解决(双文件附件库);
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
  });

  it('准备读被拒同样过栅栏：切意向后的迟到拒绝不提示', async () => {
    const user = userEvent.setup();
    let 拒绝!: (错误: unknown) => void;
    mock准备候选委托简历.mockImplementation(
      () => new Promise<BFF附件简历库>((_, rej) => { 拒绝 = rej; }),
    );
    置P4候选状态([BFF候选岗位推荐样本]);
    const 视图 = render(<看市场 />);
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    置P4候选意向({
      意向ID: 'int_乙', 阶段: '成功',
      items: [换卡卡({ 推荐ID: 'rec_乙', 岗位ID: 'job_乙', 职位: '产品经理' })],
    });
    视图.rerender(<看市场 />);
    拒绝(new BFF错误(503, 'source_unavailable', 'down'));
    await act(async () => {});
    expect(mock轻提示).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
  });

  it('准备读被拒同样过栅栏：离屏后的迟到拒绝不提示', async () => {
    const user = userEvent.setup();
    let 拒绝!: (错误: unknown) => void;
    mock准备候选委托简历.mockImplementation(
      () => new Promise<BFF附件简历库>((_, rej) => { 拒绝 = rej; }),
    );
    置P4候选状态([BFF候选岗位推荐样本]);
    const 视图 = render(<看市场 />);
    await user.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    视图.unmount();
    拒绝(new BFF错误(503, 'source_unavailable', 'down'));
    await act(async () => {});
    expect(mock轻提示).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
  });
});
