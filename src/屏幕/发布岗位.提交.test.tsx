// 发布岗位 · 提交（错误文案与确认门 / A→B 生命周期 / 硬性条件展示）
// 由 src/屏幕/发布岗位.test.tsx 按冻结归属拆出：错误文案与确认门→提交；消歧：无效编辑坐标与 A→B 生命周期、职位要求 Tab 删「硬性条件」展示→提交；Mock 发岗（公司声明前置校验）按主要断言主体（提交被拦与派发内容）就近归提交。

import {
  mock返回,
  mock进企业主壳,
  mock替换跳转,
  mock跳转,
  mock更新岗位,
  mock发布岗位,
  mock删除岗位,
  结构化确认文案,
  mock应用状态,
  清空轻提示,
  deferred,
  设月薪带,
  置Mock应用状态,
  置Backend应用状态,
} from './发布岗位.测试辅助';
import { render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 页面岗位样本 } from '../测试/BFF样本';
import { 在招岗位列表 } from '../数据/企业端模拟数据';
import { BFF错误 } from '../数据/HTTP客户端';
import userEvent from '@testing-library/user-event';
import 发布岗位, { 取岗位提交错误文案 } from './发布岗位';

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({
    返回: mock返回,
    进企业主壳: mock进企业主壳,
    替换跳转: mock替换跳转,
    跳转: mock跳转,
  }),
}));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

describe('发布岗位页 Backend 提交', () => {
  beforeEach(() => {
    mock返回.mockClear();
    mock进企业主壳.mockClear();
    mock替换跳转.mockClear();
    mock跳转.mockClear();
    mock更新岗位.mockClear();
    mock发布岗位.mockClear();
    mock删除岗位.mockClear();
    清空轻提示();
    // 默认 Mock 桩：原有编辑保存测试不依赖 数据源模式/目录查询
    置Mock应用状态();
  });

  it('Backend 编辑保存成功前不导航', async () => {
    const 完成 = deferred<void>();
    mock更新岗位.mockReturnValue(完成.promise);
    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes>
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(mock返回).not.toHaveBeenCalled();
    完成.resolve();
    await waitFor(() => expect(mock返回).toHaveBeenCalled());
  });

  // P1C Task 5：Backend 页面保存必须走这条 operation（claim 在 operation 内决定），
  // 不能绕过 操作.更新岗位 直接写数据源/派发 Mock action。
  it('Backend 编辑保存走 操作.更新岗位', async () => {
    mock更新岗位.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes>
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({ 编号: 'job_1' });
  });

  // Task 5：编辑回环必须原样带走三态四员，存量 硬性条件 字符串不被触碰。
  it('editing round-trips required/not-required/unknown without touching legacy strings', async () => {
    mock更新岗位.mockResolvedValue(undefined);
    mock应用状态.状态.岗位列表 = [{ ...页面岗位样本,
      硬性条件: ['本科及以上'],
      硬性事实: { 大小周: '必须', 纯外包乙方: '不要求', 全现场办公: '未说明', 频繁出差: '必须' },
    }];
    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: '职位要求' }));
    // 四问钮 2026-08-26 随录入 UI 删除；第三批 2026-09-09 连「硬性条件」只读展示区块也删：
    // 存量手动条不再上屏（无标题、无胶囊），三态值与 legacy 数组仍不经 UI 原样回环
    expect(screen.queryByText('硬性条件')).toBeNull();
    expect(screen.queryByText('本科及以上')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0].硬性事实).toEqual({
      大小周: '必须', 纯外包乙方: '不要求', 全现场办公: '未说明', 频繁出差: '必须',
    });
    // 存量合同字符串不改写：三态块是独立新增字段，legacy 数组原样随对象提交
    expect(mock更新岗位.mock.calls[0][0].硬性条件).toContain('本科及以上');
  });

  // Task 5：保存失败（如 409）后留在本屏 toast 报错，四个本地选择一格都不动，
  // 用户改完再点「保存」时仍是自己刚才选的档 —— 操作层重读服务端快照，不回滚表单。
  it('failed save keeps the four local selections unchanged for the next explicit save', async () => {
    const 用户 = userEvent.setup();
    mock更新岗位.mockRejectedValue(new BFF错误(409, 'version_conflict', '版本冲突'));
    mock应用状态.状态.岗位列表 = [{ ...页面岗位样本,
      硬性条件: [],
      硬性事实: { 大小周: '未说明', 纯外包乙方: '未说明', 全现场办公: '未说明', 频繁出差: '未说明' },
    }];
    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: '职位要求' }));
    // 四问钮 2026-08-26 已删,本例只验「保存失败 toast 报错且不导航」
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    // 失败只弹现有轻提示（409 → 「数据已在其他地方更新」），不导航
    expect(await screen.findByText('数据已在其他地方更新，请重试')).toBeTruthy();
    expect(mock返回).not.toHaveBeenCalled();
  });

  // ── 岗位办公方式 round-trip（backend 数据真相源 Task C）──
  // remote owner job 经 从BFF岗位 回显「全远程」：编辑态快捷片精确选中（aria-pressed），
  // 用户什么都不改直接保存，提交对象仍带 办公方式:'全远程'（补丁映射层发回 wire 'remote'）。
  it('remote owner job 编辑时选中全远程，无修改保存仍提交全远程', async () => {
    const 用户 = userEvent.setup();
    mock更新岗位.mockResolvedValue(undefined);
    const 查询Taxonomy = vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' }));
    const 查询Location = vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' }));
    置Backend应用状态(查询Taxonomy, 查询Location);
    // Backend 编辑守卫口径：编辑目标按存量岗位带 类别引用/地点引用（同「照常保存」用例）
    mock应用状态.状态.岗位列表 = [{
      ...页面岗位样本,
      办公方式: '全远程',
      类别引用: { id: 'tax_product', display_name: '产品经理' },
      地点引用: { id: 'loc_shanghai', display_name: '上海' },
    }];

    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );

    const remote = screen.getByRole('button', { name: '全远程' });
    expect(remote.getAttribute('aria-pressed')).toBe('true');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({
      编号: 'job_1',
      办公方式: '全远程',
    });
  });

  // onsite/hybrid 镜像用例：选中与保存不因 remote 修复回归。
  it.each(['现场', '混合'] as const)('%s owner job 编辑选中与保存不回归', async (方式) => {
    const 用户 = userEvent.setup();
    mock更新岗位.mockResolvedValue(undefined);
    const 查询Taxonomy = vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' }));
    const 查询Location = vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' }));
    置Backend应用状态(查询Taxonomy, 查询Location);
    mock应用状态.状态.岗位列表 = [{
      ...页面岗位样本,
      办公方式: 方式,
      类别引用: { id: 'tax_product', display_name: '产品经理' },
      地点引用: { id: 'loc_shanghai', display_name: '上海' },
    }];

    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 方式 }).getAttribute('aria-pressed')).toBe('true');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({
      编号: 'job_1',
      办公方式: 方式,
    });
  });
});

// ── P0 修复 Task 4：Mock 发岗语义冻结 —— 公司声明前置校验只在 Backend 生效 ──
describe('发布岗位页 Mock 发岗（公司声明前置校验不生效）', () => {
  beforeEach(() => {
    mock返回.mockClear();
    mock进企业主壳.mockClear();
    mock替换跳转.mockClear();
    mock跳转.mockClear();
    mock更新岗位.mockClear();
    mock发布岗位.mockClear();
    mock删除岗位.mockClear();
    清空轻提示();
    mock发布岗位.mockResolvedValue(undefined);
  });

  it('Mock 手工新建可发布空公开要求，私有偏好不能替代', async () => {
    // Backend 专属的 未认证公司声明 为空，Mock 仍按 企业认证.公司 走原有发布流程
    置Mock应用状态({ 未认证公司声明: '', 企业认证: { 姓名: '林澈', 公司: 'Mock 公司' } });
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );

    // 第一步：基础信息（Mock 走本地职业分类表）
    await 用户.type(
      screen.getByPlaceholderText('必填，如：资深后端工程师 · 交易网关'),
      'AI 产品实习生',
    );
    await 用户.click(screen.getByRole('button', { name: '现场' }));
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    await 用户.click(screen.getByRole('button', { name: '产品' }));
    await 用户.click(screen.getByRole('button', { name: '产品经理' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));

    // 第二步：职位描述
    await 用户.type(screen.getByRole('textbox', { name: '职位描述' }), '描述正文');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));

    // 第三步：职位要求 + 薪资 + 城市 + 办公地
    await 用户.type(screen.getByRole('textbox', { name: '给 AI 代理的筛选要求' }), '私有偏好');
    await 设月薪带(用户, 20, 30);
    await 用户.click(screen.getByRole('button', { name: /年薪月数/ }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    // 工作城市：Mock 同样走全页选择正文（本地字典，不发请求）→ 选 上海 → 保存
    await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
    await screen.findByText('选择工作城市');
    await 用户.click((await screen.findAllByRole('button', { name: '上海市' }))[0]);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await 用户.type(
      screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层'),
      '张江路 1 号',
    );
    // P4 互认 Task 3 + Spec §5.4：确认勾选框两模式共用同一位置（公开要求之后、
    // 私有筛选之前），Mock 同样走「未确认不得发布」的门。
    const 勾选框 = () => screen.getByRole('checkbox', { name: 结构化确认文案 }) as HTMLInputElement;
    expect(勾选框()).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    expect(await screen.findByText('请确认经验和学历将作为自动匹配依据')).toBeTruthy();
    expect(mock发布岗位).not.toHaveBeenCalled();
    // 勾上后同一份草稿可发布：Mock 载荷仍不带确认事实（OwnerJob truth 仅 Backend）
    await 用户.click(勾选框());
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));

    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    expect(mock发布岗位.mock.calls[0][0]).toMatchObject({ 职位要求: '', 筛选要求: '私有偏好', 年薪月数: 12 });
    expect(mock发布岗位.mock.calls[0][0]).not.toHaveProperty('结构化要求已确认');
    expect(screen.queryByText('请填写职位要求')).toBeNull();
    expect(screen.queryByText('请先在招聘名片填写公司名称')).toBeNull();
  });

  it('Mock 保存城市后重开子视图回显已选 chip 且保存可用，取消不回填（Spec §4.3/§6）', async () => {
    // 缺陷（review Important finding）：Mock 保存只写 工作城市 文本、不设 地点引用，
    // 重开城市子视图时 初始已选 恒空 → 无已选 chip、保存禁用，岗位行与选择页状态不一致
    置Mock应用状态();
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
    await 用户.type(screen.getByPlaceholderText('必填，如：资深后端工程师 · 交易网关'), 'AI 产品实习生');
    await 用户.click(screen.getByRole('button', { name: '现场' }));
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    await 用户.click(screen.getByRole('button', { name: '产品' }));
    await 用户.click(screen.getByRole('button', { name: '产品经理' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await 用户.type(screen.getByRole('textbox', { name: '职位描述' }), '描述正文');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));

    // 选 上海 → 保存：岗位行回填（Mock 城名归一到规范名）
    await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
    await screen.findByText('选择工作城市');
    await 用户.click((await screen.findAllByRole('button', { name: '上海市' }))[0]);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByRole('button', { name: /工作城市/ }).textContent).toContain('上海');

    // 重开城市子视图：已选 chip 在场、保存可用
    await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
    await screen.findByText('选择工作城市');
    expect(screen.getByRole('button', { name: '上海市 ✕' })).toBeTruthy();
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(false);
    // 取消关闭：岗位行仍是 上海，不回填临时态
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.queryByText('选择工作城市')).toBeNull();
    expect(screen.getByRole('button', { name: /工作城市/ }).textContent).toContain('上海');
    // 零候选草稿派发不变
    const 类型们 = mock应用状态.派发.mock.calls.map((调用: unknown[]) => (调用[0] as { 型: string }).型);
    expect(类型们).not.toContain('存引导预填');
    expect(类型们).not.toContain('改意向草稿');
  });
});

// ── Spec §5.4：确认门覆盖两模式 —— Mock 用页面草稿/原始岗位状态模拟，保持
// 新建与 legacy 编辑区别：新建一律未确认起步；legacy 编辑未真实改三处不拦，
// 真实改经验/学历/公开要求撤销确认；重复点同值或改私有筛选不撤销；
// 校招/实习隐藏残留经验档按最终 wire 语义判断，不误触发确认。──
describe('发布岗位页 确认门覆盖两模式（Mock 模拟）', () => {
  const 勾选框 = () => screen.getByRole('checkbox', { name: 结构化确认文案 }) as HTMLInputElement;

  beforeEach(() => {
    mock返回.mockClear();
    mock进企业主壳.mockClear();
    mock替换跳转.mockClear();
    mock跳转.mockClear();
    mock更新岗位.mockClear();
    mock发布岗位.mockClear();
    mock删除岗位.mockClear();
    清空轻提示();
    mock更新岗位.mockResolvedValue(undefined);
  });

  /** Mock 编辑态打开第三步；岗位覆盖由用例注入，缺省社招全职带足可保存字段 */
  async function 打开Mock编辑第三步(岗位覆盖: Record<string, unknown> = {}) {
    const 用户 = userEvent.setup();
    mock应用状态.状态.岗位列表 = [
      {
        ...页面岗位样本,
        招聘类型: '社招全职',
        年薪月数: 12,
        ...岗位覆盖,
      },
    ];
    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: '职位要求' }));
    return { 用户 };
  }

  it('legacy 编辑未真实改三处时不勾选也能保存；改私有筛选不撤销已勾确认', async () => {
    const { 用户 } = await 打开Mock编辑第三步();
    expect(勾选框().checked).toBe(false);
    await 用户.type(screen.getByRole('textbox', { name: '给 AI 代理的筛选要求' }), '只改私有偏好');
    expect(勾选框().checked).toBe(false);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({ 编号: 'job_1' });

    // 勾上后再改私有筛选：确认不被撤销
    await 用户.click(勾选框());
    await 用户.type(screen.getByRole('textbox', { name: '给 AI 代理的筛选要求' }), '再补一句');
    expect(勾选框().checked).toBe(true);
  });

  it('真实改公开要求/经验/学历撤销确认；重复点同值不撤销', async () => {
    const { 用户 } = await 打开Mock编辑第三步();
    await 用户.click(勾选框());

    // 公开要求真实变化 → 撤销
    await 用户.type(screen.getByRole('textbox', { name: '岗位要求' }), '（改）');
    expect(勾选框().checked).toBe(false);

    // 经验档位真实变化 → 撤销
    await 用户.click(勾选框());
    await 用户.click(screen.getByRole('button', { name: '1-3 年' }));
    expect(勾选框().checked).toBe(false);

    // 重复点同一档位（no-op）不撤销
    await 用户.click(勾选框());
    await 用户.click(screen.getByRole('button', { name: '1-3 年' }));
    expect(勾选框().checked).toBe(true);

    // 学历档位真实变化 → 撤销
    await 用户.click(screen.getByRole('button', { name: '硕士' }));
    expect(勾选框().checked).toBe(false);

    await 用户.click(勾选框());
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
  });

  it('校招隐藏残留经验档按最终 wire 语义判断：不改三处保存不误拦', async () => {
    // 存量校招岗残留经验档（旧数据形态）：第三步经验整块隐藏，落库一律「不限」，
    // 这份残留不构成用户可见的变化，不得把 legacy 无关字段保存拦成「需确认」
    const { 用户 } = await 打开Mock编辑第三步({
      招聘类型: '校园招聘',
      届别: '2027 届',
      经验要求: '5 年以上',
      职位要求: '原岗位要求',
    });
    expect(screen.queryByRole('button', { name: '1-3 年' })).toBeNull();
    expect(勾选框().checked).toBe(false);
    await 用户.type(screen.getByRole('textbox', { name: '给 AI 代理的筛选要求' }), '偏好有项目经历');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    // 最终 wire 语义：校招落库一律「不限」
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({ 经验要求: '不限' });
  });
});

// ── P0 修复 Task 6：岗位表单的服务端校验投影 ────────────────────────
// 只有「已知字段路径 × 已知空值类 reason」才本地化；未知路径或未知 reason
// 一律落通用岗位文案，绝不把机器 reason 原样上屏。点分与 JSON Pointer 两种
// 路径写法都要归一。
describe('取岗位提交错误文案', () => {
  it.each([
    ['/office_location', 'required', '请填写办公地点'],
    ['description', 'blank', '请填写职位描述'],
    ['/requirements', 'must_not_be_blank', '请填写职位要求'],
  ] as const)('把字段错误 %s 本地化', (path, reason, expected) => {
    expect(取岗位提交错误文案(
      new BFF错误(422, 'validation_failed', 'bad', [{ path, reason }]),
    )).toBe(expected);
  });

  // 合同 C：双企业坐标的服务端校验（未知/停用企业等）不看 reason，统一指回企业选择行。
  it.each([
    ['publisher_organization_ref', 'organization_unknown', '请重新选择发布方企业'],
    ['/hiring_organization_ref', 'blank', '请重新选择用人企业'],
  ] as const)('把企业坐标错误 %s 指回选择行', (path, reason, expected) => {
    expect(取岗位提交错误文案(
      new BFF错误(422, 'validation_failed', 'bad', [{ path, reason }]),
    )).toBe(expected);
  });

  // 注：vitest 4 对象/单参 it.each 不把参数带进标题时两条 Case 同名（清单身份重复），
  // 给 %s 加区分标签（2026-09-16 清单验证发现，只改标题形式，断言不变）。
  it.each([
    ['未知字段 path', new BFF错误(422, 'validation_failed', 'bad', [{ path: 'unknown', reason: 'required' }])],
    ['未知 reason', new BFF错误(422, 'validation_failed', 'bad', [{ path: 'requirements', reason: 'unsupported_code' }])],
  ] as const)('未知字段或 reason 使用通用岗位文案（%s）', (_标签, error) => {
    expect(取岗位提交错误文案(error)).toBe('请检查岗位信息');
  });
});

// ── D4/D4a：Backend 无效编辑坐标 fail closed；A→B 路由切换销毁旧草稿 ──
describe('发布岗位页 Backend 无效编辑坐标与 A→B 生命周期', () => {
  // 社招全职：薪资是带 label 的数字框（实习岗是滚轮按钮，getByLabelText 取不到）
  const 岗位A = {
    ...页面岗位样本,
    编号: 'job_a',
    名称: '岗位 A',
    招聘类型: '社招全职' as const,
    年薪月数: 12,
    类别引用: { id: 'tax_product', display_name: '产品经理' },
    地点引用: { id: 'loc_shanghai', display_name: '上海' },
  };
  const 岗位B = {
    ...页面岗位样本,
    编号: 'job_b',
    名称: '岗位 B',
    招聘类型: '社招全职' as const,
    年薪月数: 12,
    类别引用: { id: 'tax_product', display_name: '产品经理' },
    地点引用: { id: 'loc_shanghai', display_name: '上海' },
  };

  beforeEach(() => {
    mock返回.mockClear();
    mock进企业主壳.mockClear();
    mock替换跳转.mockClear();
    mock跳转.mockClear();
    mock更新岗位.mockClear();
    mock发布岗位.mockClear();
    mock删除岗位.mockClear();
    清空轻提示();
    mock更新岗位.mockResolvedValue(undefined);
    置Backend应用状态(
      vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
      vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
    );
    mock应用状态.状态.岗位列表 = [岗位A, 岗位B];
  });

  function render发布岗位(路由 = '/hr/post-job') {
    return render(
      <MemoryRouter initialEntries={[路由]}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('Backend 有路由 ID 但 owner 列表未命中时不进入新建', () => {
    render发布岗位('/hr/post-job/missing');
    expect(screen.getByText('岗位不存在或已不可编辑')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '发布岗位并开始寻访' })).toBeNull();
    expect(screen.queryByText(/上传 JD/)).toBeNull();
    expect(mock发布岗位).not.toHaveBeenCalled();
    expect(mock更新岗位).not.toHaveBeenCalled();
  });

  it('A→B 路由切换销毁 A 的草稿再以 B 初始化', async () => {
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_a']}>
        {/* 测试导航按钮：A→B 路由切换必须销毁 A 的全部草稿（D4a） */}
        <Link to="/hr/post-job/job_b">前往岗位 B</Link>
        <Routes>
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
    // 编辑态岗位名称 readOnly（发布后不可改）：A 的草稿用描述与薪资承载；
    // 编辑态三步是分段切换按钮，不走「下一步」
    await 用户.click(screen.getByRole('button', { name: '职位描述' }));
    const 描述框 = screen.getByLabelText('职位描述');
    await 用户.clear(描述框);
    await 用户.type(描述框, '被修改的岗位 A');
    await 用户.click(screen.getByRole('button', { name: '职位要求' }));
    await 设月薪带(用户, 99, 500);
    // 由测试导航按钮进入 job_b：以 B 重新初始化（回到基础信息步）
    await 用户.click(screen.getByText('前往岗位 B'));
    expect(screen.getByDisplayValue('岗位 B')).toBeTruthy();
    expect(screen.queryByDisplayValue('被修改的岗位 A')).toBeNull();
    // 再进职位要求步：B 的预填在场，A 会话的 99 与描述草稿已销毁
    await 用户.click(screen.getByRole('button', { name: '职位要求' }));
    expect(screen.getByRole('button', { name: '薪资下限' }).textContent).toContain('300');
    await 用户.click(screen.getByRole('button', { name: '职位描述' }));
    expect((screen.getByLabelText('职位描述') as HTMLTextAreaElement).value).toBe('参与产品工作');
    // 编辑态底部保存键：提交的是 B 的当前值，不是 A 的残留草稿
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位).toHaveBeenCalledWith(
      expect.objectContaining({ 编号: 'job_b', 名称: '岗位 B' }),
    );
    expect(mock发布岗位).not.toHaveBeenCalled();
  });
});

// ── 第三批（2026-09-09）：「编辑岗位 › 职位要求」删「硬性条件」只读展示区块 ──
// 产品负责人原话：「把这个硬性要求的部分删掉，下面的这个补充加分偏好实际上是加到了 AI 代理的规则里，这个保留一下」。
// 删的只是展示：岗位.硬性条件 合同（学历档 / 经验档 / 存量手动条写回，代理匿名初筛靠它）
// 与「补充加分偏好（可选）」（筛选要求 状态及其保存）都不动。
describe('发布岗位页 第三批：职位要求 Tab 删「硬性条件」展示', () => {
  /** Mock P-01：带存量手动条「Go 主栈 / 常驻上海 / 可混合办公」的社招岗，编辑它最能暴露展示区块 */
  const P01 = 在招岗位列表.find((岗) => 岗.编号 === 'P-01');
  if (!P01) throw new Error('Mock 在招岗位列表 缺 P-01，第三批用例以它为底');
  /** 改前（删展示之前）Mock P-01 不改任何内容直接保存时，合同组装写回的 硬性条件：
   *  学历档（最低学历 本科 → 本科及以上）+ 经验档（经验要求 5 年以上 → 5 年以上经验）+ 存量手动条原样。
   *  删展示后这条必须一字不差 —— 合同没丢。 */
  const P01改前合同 = ['本科及以上', '5 年以上经验', 'Go 主栈', '常驻上海', '可混合办公'];
  /** 存量手动条：删展示后不得以胶囊上屏（'5 年以上' 与经验档选项同文，不拿它当胶囊信号） */
  const P01存量手动条 = ['Go 主栈', '常驻上海', '可混合办公'];
  const 预填偏好 = '有交易系统经验优先';
  const 追加偏好 = '，有大促峰值经验加分';

  beforeEach(() => {
    mock返回.mockClear();
    mock进企业主壳.mockClear();
    mock更新岗位.mockClear();
    mock发布岗位.mockClear();
    清空轻提示();
    置Mock应用状态();
    mock更新岗位.mockResolvedValue(undefined);
    mock应用状态.状态.岗位列表 = [{ ...P01, 筛选要求: 预填偏好 }];
  });

  /** 以编辑态进 Mock P-01 */
  function 渲染编辑P01() {
    return render(
      <MemoryRouter initialEntries={['/hr/post-job/P-01']}>
        <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );
  }

  // 验收 1：职位要求 Tab 上无「硬性条件」标题、无对应胶囊
  it('编辑 Mock P-01：职位要求 Tab 无「硬性条件」标题、无存量手动条胶囊', async () => {
    const 用户 = userEvent.setup();
    渲染编辑P01();
    await 用户.click(screen.getByRole('button', { name: '职位要求' }));
    expect(screen.queryByText('硬性条件')).toBeNull();
    for (const 手动条 of P01存量手动条) {
      expect(screen.queryByText(手动条)).toBeNull();
    }
  });

  // 验收 2：「补充加分偏好（可选）」输入区仍在，可编辑可保存
  it('编辑 Mock P-01：「补充加分偏好（可选）」仍在、可编辑、随保存写入 筛选要求', async () => {
    const 用户 = userEvent.setup();
    渲染编辑P01();
    await 用户.click(screen.getByRole('button', { name: '职位要求' }));
    expect(screen.getByText('给 AI 代理的筛选要求')).toBeTruthy();
    // 输入框以岗位.筛选要求 预填，证明它就是「补充加分偏好」的承载
    const 偏好框 = screen.getByDisplayValue(预填偏好);
    expect(偏好框.tagName).toBe('TEXTAREA');
    await 用户.type(偏好框, 追加偏好);
    expect((偏好框 as HTMLTextAreaElement).value).toBe(`${预填偏好}${追加偏好}`);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({
      编号: 'P-01',
      筛选要求: `${预填偏好}${追加偏好}`,
      职位要求: P01.职位要求,
      年薪月数: P01.年薪月数,
    });
  });

  // 验收 3 + 5：不改任何内容直接保存，合同组装（学历档 / 经验档 / 存量手动条写回）原样保留
  it('编辑 Mock P-01：不改任何内容直接保存，硬性条件 合同与改前一致', async () => {
    const 用户 = userEvent.setup();
    渲染编辑P01();
    await 用户.click(screen.getByRole('button', { name: '职位要求' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0].硬性条件).toEqual(P01改前合同);
  });

  // 验收 1 + 3 同一会话：展示删了、数据没删 —— 屏上无胶囊，保存仍把存量手动条原样写回
  it('编辑 Mock P-01：展示删除后同一会话保存，存量手动条仍随合同提交', async () => {
    const 用户 = userEvent.setup();
    渲染编辑P01();
    await 用户.click(screen.getByRole('button', { name: '职位要求' }));
    for (const 手动条 of P01存量手动条) {
      expect(screen.queryByText(手动条)).toBeNull();
    }
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    const 提交的合同: string[] = mock更新岗位.mock.calls[0][0].硬性条件;
    for (const 手动条 of P01存量手动条) {
      expect(提交的合同).toContain(手动条);
    }
    expect(提交的合同).toEqual(P01改前合同);
  });
});
