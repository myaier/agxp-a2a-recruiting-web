// 发布岗位 · 薪资与地点（全远程 Catalog 门禁 / 全页城市 / 薪资区间层）
// 由 src/屏幕/发布岗位.test.tsx 按冻结归属拆出：消歧「全远程地址与 Catalog 门禁」→薪资地点；全页城市选择与薪资区间层按地点/薪资职责归薪资地点。

import {
  mock返回,
  mock进企业主壳,
  mock替换跳转,
  mock跳转,
  mock更新岗位,
  mock发布岗位,
  mock删除岗位,
  mock创建JD导入,
  mock读取JD导入,
  结构化确认文案,
  mock应用状态,
  清空轻提示,
  经抽屉选企业,
  设月薪带,
  置Mock应用状态,
  置Backend应用状态,
  导入公开要求,
} from './发布岗位.测试辅助';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 页面岗位样本 } from '../测试/BFF样本';
import { 转岗位创建 } from '../数据/后端映射';
import userEvent from '@testing-library/user-event';
import 发布岗位 from './发布岗位';

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({
    返回: mock返回,
    进企业主壳: mock进企业主壳,
    替换跳转: mock替换跳转,
    跳转: mock跳转,
  }),
}));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

// ── Task 4：全远程办公地址合同与类别/地点发布门禁（真实时钟走完整发布流）──
describe('发布岗位页 全远程地址与 Catalog 门禁', () => {
  const 分类查询 = vi.fn(async (_kind: 'job-categories', query: { parentId?: string }) => {
    if (!query.parentId) {
      return {
        items: [{ id: 'cat_tech', display_name: '互联网/AI', parent_id: null, selectable: false, has_children: true }],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    }
    // Task 4（brief 清单外的必要桩适配）：目录改成三级结构 —— 二级是分组标题（不可选、有子项），
    // 可选叶子只在三级；用例体与断言不变（仍点击『后端开发』这枚叶子）
    if (query.parentId === 'cat_tech') {
      return {
        items: [{ id: 'grp_tech', display_name: '技术', parent_id: 'cat_tech', selectable: false, has_children: true }],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    }
    if (query.parentId === 'grp_tech') {
      return {
        items: [{ id: 'job_be', display_name: '后端开发', parent_id: 'grp_tech', selectable: true, has_children: false }],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    }
    return { items: [], nextCursor: null, catalogVersion: 'v2' };
  });
  // merge 调和：四支分页 —— CN 支与搜索（JD 初词走 q）返回 上海，其他支空页
  const 地点查询 = vi.fn(async (query: { q?: string; countryCode?: string }) => {
    if (query.q === undefined && query.countryCode !== 'CN') {
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    }
    return {
      items: [{
        id: 'loc_shanghai', display_name: '上海', country_code: 'CN', country_name: '中国',
        admin1_code: 'SH', admin1_name: '上海', timezone: 'Asia/Shanghai', population: 24000000,
      }],
      nextCursor: null,
      catalogVersion: 'v2',
    };
  });

  beforeEach(() => {
    mock创建JD导入.mockReset();
    mock读取JD导入.mockReset();
    mock发布岗位.mockClear();
    mock更新岗位.mockClear();
    分类查询.mockClear();
    地点查询.mockClear();
    mock发布岗位.mockResolvedValue(undefined);
    置Backend应用状态(分类查询, 地点查询);
    清空轻提示();
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

  /** 三步填到发布前；办公方式与办公地可覆盖（全远程用例不填地址）。 */
  async function 填到发布前(用户: ReturnType<typeof userEvent.setup>, 选项: { 办公方式?: '现场' | '混合' | '全远程'; 办公地?: string | null; JD建议地点?: string | null } = {}) {
    const { 办公方式 = '现场', 办公地 = '张江路 1 号', JD建议地点 = null } = 选项;
    await 导入公开要求('有分布式系统经验');
    await 用户.type(screen.getByPlaceholderText('必填，如：资深后端工程师 · 交易网关'), '资深后端');
    fireEvent.click(screen.getByRole('button', { name: 办公方式 }));
    fireEvent.click(screen.getByRole('button', { name: /职位类别/ }));
    await screen.findByText('后端开发');
    fireEvent.click(screen.getByText('后端开发'));
    if (JD建议地点 !== null) {
      mock创建JD导入.mockResolvedValue({
        import_id: 'jdi_0123456789abcdef0123456789abcdef', status: 'succeeded',
        created_at: '2026-09-03T01:02:03Z', updated_at: '2026-09-03T01:02:06Z',
        suggestion: {
          title: null, recruitment_type: null, workplace_mode: null, office_location: null,
          description: null, requirements: null, education_requirement: null,
          experience_requirement: null, category_source_name: '后端开发',
          location_source_name: JD建议地点, keywords: [],
        },
      });
      await 用户.upload(screen.getByLabelText('上传 JD 文件'), new File(['%PDF-1.7'], 'role.pdf', { type: 'application/pdf' }));
      await 用户.click(screen.getByRole('button', { name: '同意并继续' }));
    }
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await 用户.type(screen.getByLabelText('职位描述'), '负责交易网关与撮合核心');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await 设月薪带(用户, 50, 65);
    await 用户.click(screen.getByRole('button', { name: /年薪月数/ }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    if (办公地 !== null) {
      await 用户.type(screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层'), 办公地);
    }
    // 工作城市：全页选择正文 → 选 上海 → 保存（JD 建议给了初词的用例只验行与拦截，自选）
    if (JD建议地点 === null) {
      await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
      await screen.findByText('选择工作城市');
      await 用户.click((await screen.findAllByRole('button', { name: '上海' }))[0]);
      await 用户.click(screen.getByRole('button', { name: '保存' }));
    }
    // 合同 C：这两条用例聚焦地址/地点门禁，企业坐标在这里统一经抽屉选好
    await 用户.click(screen.getByRole('button', { name: /用人企业/ }));
    await 经抽屉选企业(用户, { organization_id: 'org_xinghe', display_name: '星河控股' });
    // Backend 发岗要求显式确认结构化匹配依据（确认框只在第三步渲染）；
    // 这两条用例聚焦地址/地点门禁，确认在这里统一补齐，不引入第二个变量。
    await 用户.click(screen.getByRole('checkbox', { name: '我已确认经验和学历设置将作为自动匹配依据；补充要求不会被自动解析。修改上述内容后需要重新确认。' }));
  }

  it('手动全远程：办公地点可填但非必填，留空发布仍为空串', async () => {
    const 用户 = userEvent.setup();
    render发布岗位();
    await 填到发布前(用户, { 办公方式: '全远程', 办公地: null });
    // 办公地点可输入；不填仍可发布
    const 地址框 = screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层') as HTMLInputElement;
    expect(地址框.disabled).toBe(false);
    expect(地址框.value).toBe('');
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    expect(mock发布岗位.mock.calls[0][0].办公地).toBe('');
    // 切回现场：恢复可填必填，不恢复旧地址
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    fireEvent.click(screen.getByRole('button', { name: '现场' }));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect((screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层') as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层') as HTMLInputElement).value).toBe('');
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    expect(await screen.findByText('请填写办公地点')).toBeTruthy();
    expect(mock发布岗位).toHaveBeenCalledTimes(1);
  });

  it('全远程手填地址跨步保留并写入公开创建请求', async () => {
    const 用户 = userEvent.setup();
    render发布岗位();
    await 填到发布前(用户, { 办公方式: '全远程', 办公地: null });
    const 取地址 = () => screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层') as HTMLInputElement;
    await 用户.type(取地址(), '远程团队联络点\n上海张江');
    const 录入值 = 取地址().value;
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(取地址().value).toBe(录入值);
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    const 请求 = 转岗位创建(mock发布岗位.mock.calls[0][0], { publisherMode: 'direct', publisherOrganizationRef: 'org_xinghe', hiringOrganizationRef: 'org_xinghe' });
    expect(请求.workplace_mode).toBe('remote');
    expect(请求.office_location).toBe(录入值);
  });

  it('JD 城市源文本只作打开时的搜索初词：未保存引用发布被拦，保存后带地点引用发布', async () => {
    const 用户 = userEvent.setup();
    render发布岗位();
    await 填到发布前(用户, { JD建议地点: '上海' });
    // 打开子视图：初词来自 JD 源文本；不保存引用 → 发布被拦
    await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
    const 搜索框 = await screen.findByPlaceholderText('搜索城市 / 省份') as HTMLInputElement;
    expect(搜索框.value).toBe('上海');
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    expect(await screen.findByText('请从候选城市中选择')).toBeTruthy();
    expect(mock发布岗位).not.toHaveBeenCalled();
    // 重新打开并保存真实候选：类别引用仍是用户选择的，地点引用来自候选
    await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
    await 用户.click((await screen.findAllByRole('button', { name: '上海' }))[0]);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    const 传入 = mock发布岗位.mock.calls[0][0];
    expect(传入.类别引用).toEqual({ id: 'job_be', display_name: '后端开发' });
    expect(传入.地点引用).toEqual({ id: 'loc_shanghai', display_name: '上海' });
    expect(传入.城市).toBe('上海');
  });

  it('Backend 第一步要求真实类别引用；Mock 保持自由文本', async () => {
    // Backend：编辑岗位无 类别引用（老数据）→ 保存被拦在第一步
    置Backend应用状态(分类查询, 地点查询);
    mock应用状态.状态.岗位列表 = [{ ...页面岗位样本 }];
    const 用户 = userEvent.setup();
    const 后端页 = render发布岗位('/hr/post-job/job_1');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('请选择职位类别')).toBeTruthy();
    expect(mock更新岗位).not.toHaveBeenCalled();
    // Mock：同样数据照常保存（自由文本类别）
    后端页.unmount();
    mock更新岗位.mockClear();
    置Mock应用状态();
    mock应用状态.状态.岗位列表 = [{ ...页面岗位样本 }];
    render发布岗位('/hr/post-job/job_1');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
  });
});

// ── Task 2：Mock 模式的全页城市选择 —— 与 Backend 同一正文、本地字典，零目录请求、零候选草稿派发 ──
describe('发布岗位页 全页城市选择（Mock 模式）', () => {
  beforeEach(() => {
    mock返回.mockClear();
    mock进企业主壳.mockClear();
    mock更新岗位.mockClear();
    mock发布岗位.mockClear();
    清空轻提示();
    置Mock应用状态();
    mock发布岗位.mockResolvedValue(undefined);
  });

  it('Mock：全页正文选城市回填城市文本，无候选请求，岗位城市零候选草稿派发', async () => {
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
    await 用户.type(screen.getByPlaceholderText('必填，如：资深后端工程师 · 交易网关'), 'Mock 城市岗');
    await 用户.click(screen.getByRole('button', { name: '现场' }));
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    await 用户.click(screen.getByRole('button', { name: '产品' }));
    await 用户.click(screen.getByRole('button', { name: '产品经理' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await 用户.type(screen.getByRole('textbox', { name: '职位描述' }), '描述正文');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    // 打开全页正文：本地热门 + 省份字典，无任何目录请求可发
    await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
    await screen.findByText('选择工作城市');
    await 用户.click((await screen.findAllByRole('button', { name: '上海市' }))[0]);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByRole('button', { name: /工作城市/ }).textContent).toContain('上海');
    await 设月薪带(用户, 20, 30);
    await 用户.click(screen.getByRole('button', { name: /年薪月数/ }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    await 用户.type(screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层'), '张江路 1 号');
    await 用户.click(screen.getByRole('checkbox', { name: 结构化确认文案 }));
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    // Mock 无目录引用概念：城市即文本（Task 6 归一到规范名），不构造引用
    expect(mock发布岗位.mock.calls[0][0]).toMatchObject({ 城市: '上海市' });
    expect(mock发布岗位.mock.calls[0][0].地点引用).toBeUndefined();
    const 类型们 = mock应用状态.派发.mock.calls.map((调用: unknown[]) => (调用[0] as { 型: string }).型);
    expect(类型们).not.toContain('存引导预填');
    expect(类型们).not.toContain('改意向草稿');
  });
});

// ── Task 3：岗位月薪复用薪资区间层 —— 月薪主入口改选择行，弹层内临时值，
// 确定才回填原字符串字段；金额域（K，不乘 1000）、取消语义与提交映射不变。──
describe('发布岗位页 月薪选择行（薪资区间层）', () => {
  beforeEach(() => {
    mock返回.mockClear();
    mock进企业主壳.mockClear();
    mock替换跳转.mockClear();
    mock跳转.mockClear();
    mock更新岗位.mockClear();
    mock发布岗位.mockClear();
    mock删除岗位.mockClear();
    清空轻提示();
    置Mock应用状态();
    mock发布岗位.mockResolvedValue(undefined);
    mock更新岗位.mockResolvedValue(undefined);
  });

  function render新建() {
    return render(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  function render编辑(岗位: typeof 页面岗位样本) {
    mock应用状态.状态.岗位列表 = [岗位];
    return render(
      <MemoryRouter initialEntries={[`/hr/post-job/${岗位.编号}`]}>
        <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );
  }

  /** 新建社招岗填到第三步（薪资/城市/确认之前的公共路径） */
  async function 填到第三步(用户: ReturnType<typeof userEvent.setup>, 类型: '社招全职' | '校园招聘' = '社招全职') {
    await 用户.type(
      screen.getByPlaceholderText('必填，如：资深后端工程师 · 交易网关'),
      '月薪选择行岗',
    );
    await 用户.click(screen.getByRole('button', { name: new RegExp(类型) }));
    await 用户.click(screen.getByRole('button', { name: '现场' }));
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    await 用户.click(screen.getByRole('button', { name: '产品' }));
    await 用户.click(screen.getByRole('button', { name: '产品经理' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await 用户.type(screen.getByRole('textbox', { name: '职位描述' }), '描述正文');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
  }

  it('月薪主入口是选择行：打开双滚轮确定回填，请求薪资带与原映射相同', async () => {
    const 用户 = userEvent.setup();
    render新建();
    await 填到第三步(用户);
    // 两输入改选择行：月薪不再有数字输入框
    expect(screen.queryByRole('textbox', { name: '薪资下限' })).toBeNull();
    await 设月薪带(用户, 20, 30);
    expect(screen.getByRole('button', { name: '薪资下限' }).textContent).toContain('20');
    expect(screen.getByRole('button', { name: '薪资上限' }).textContent).toContain('30');
    await 用户.click(screen.getByRole('button', { name: /年薪月数/ }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
    await screen.findByText('选择工作城市');
    await 用户.click((await screen.findAllByRole('button', { name: '上海市' }))[0]);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await 用户.type(screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层'), '张江路 1 号');
    await 用户.click(screen.getByRole('checkbox', { name: 结构化确认文案 }));
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    // 上下限与单位（K）与原映射逐字相同：不乘 1000、不加小数
    expect(mock发布岗位.mock.calls[0][0]).toMatchObject({ 薪资带: '20-30K' });
  });

  it('空弹层打开取消不填值：草稿仍空，发布被「请填写薪资带」拦下', async () => {
    const 用户 = userEvent.setup();
    render新建();
    await 填到第三步(用户);
    await 用户.click(screen.getByRole('button', { name: '薪资下限' }));
    await screen.findByRole('listbox', { name: '薪资下限' });
    // 空弹层可见默认 10/11，但取消零回填
    await 用户.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.getByRole('button', { name: '薪资下限' }).textContent).toContain('—');
    await 用户.click(screen.getByRole('button', { name: /年薪月数/ }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
    await screen.findByText('选择工作城市');
    await 用户.click((await screen.findAllByRole('button', { name: '上海市' }))[0]);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    expect(await screen.findByText('请填写薪资带')).toBeTruthy();
    expect(mock发布岗位).not.toHaveBeenCalled();
  });

  it('倒置 30/20 确定停留报错；修正 20/30 才回填', async () => {
    const 用户 = userEvent.setup();
    render新建();
    await 填到第三步(用户);
    await 用户.click(screen.getByRole('button', { name: '薪资下限' }));
    await screen.findByRole('listbox', { name: '薪资下限' });
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资下限' })).getByRole('option', { name: '30' }));
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资上限' })).getByRole('option', { name: '20' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    // 弹层不关闭，显示字段错误
    expect(screen.getByText('薪资下限不能高于上限')).toBeTruthy();
    expect(screen.getByRole('listbox', { name: '薪资下限' })).toBeTruthy();
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资下限' })).getByRole('option', { name: '20' }));
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资上限' })).getByRole('option', { name: '30' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(screen.queryByRole('listbox', { name: '薪资下限' })).toBeNull();
    expect(screen.getByRole('button', { name: '薪资下限' }).textContent).toContain('20');
    expect(screen.getByRole('button', { name: '薪资上限' }).textContent).toContain('30');
  });

  it('校园招聘月薪同样走薪资区间层并回填选择行', async () => {
    const 用户 = userEvent.setup();
    render新建();
    await 填到第三步(用户, '校园招聘');
    expect(screen.queryByRole('textbox', { name: '薪资下限' })).toBeNull();
    await 设月薪带(用户, 15, 25);
    expect(screen.getByRole('button', { name: '薪资下限' }).textContent).toContain('15');
    expect(screen.getByRole('button', { name: '薪资上限' }).textContent).toContain('25');
  });

  it('编辑态 123/234 超常用档原样往返，保存请求薪资带不变', async () => {
    const 用户 = userEvent.setup();
    render编辑({
      ...页面岗位样本,
      编号: 'job_k',
      名称: '大额月薪岗',
      招聘类型: '社招全职' as const,
      薪资带: '123-234K',
      年薪月数: 12,
      类别引用: { id: 'tax_product', display_name: '产品经理' },
      地点引用: { id: 'loc_shanghai', display_name: '上海' },
    });
    await 用户.click(screen.getByRole('button', { name: '职位要求' }));
    // 预填选择行显示原带
    expect(screen.getByRole('button', { name: '薪资下限' }).textContent).toContain('123');
    expect(screen.getByRole('button', { name: '薪资上限' }).textContent).toContain('234');
    // 打开即原样定位，直接确定金额往返不变
    await 用户.click(screen.getByRole('button', { name: '薪资下限' }));
    await screen.findByRole('listbox', { name: '薪资下限' });
    expect(within(screen.getByRole('listbox', { name: '薪资下限' }))
      .getByRole('option', { name: '123' }).getAttribute('aria-selected')).toBe('true');
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({ 编号: 'job_k', 薪资带: '123-234K' });
  });
});

// ── Task 5：岗位日薪/时薪改同一 薪资区间层 双轮 —— 两个金额按钮开同一弹层，
// 缺值临时 200/40、初值沿旧数字轮吸附、确定同步两字段、取消零回填；抽屉内
// 不新增倒置拦截，倒置校验仍由既有表单提交规则负责。──
describe('发布岗位页 日薪/时薪双轮（薪资区间层）', () => {
  beforeEach(() => {
    mock返回.mockClear();
    mock进企业主壳.mockClear();
    mock替换跳转.mockClear();
    mock跳转.mockClear();
    mock更新岗位.mockClear();
    mock发布岗位.mockClear();
    mock删除岗位.mockClear();
    清空轻提示();
    置Mock应用状态();
    mock发布岗位.mockResolvedValue(undefined);
    mock更新岗位.mockResolvedValue(undefined);
  });

  function render新建() {
    return render(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  async function 填到第三步(用户: ReturnType<typeof userEvent.setup>, 类型: '实习生' | '兼职') {
    await 用户.type(
      screen.getByPlaceholderText('必填，如：资深后端工程师 · 交易网关'),
      '日薪双轮岗',
    );
    await 用户.click(screen.getByRole('button', { name: new RegExp(类型) }));
    if (类型 === '实习生') await 用户.click(screen.getByRole('button', { name: '提供转正机会' }));
    await 用户.click(screen.getByRole('button', { name: '现场' }));
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    await 用户.click(screen.getByRole('button', { name: '产品' }));
    await 用户.click(screen.getByRole('button', { name: '产品经理' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await 用户.type(screen.getByRole('textbox', { name: '职位描述' }), '描述正文');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
  }

  it('实习生日薪：两个金额按钮开同一双轮，缺值临时 200/200，确定同步两字段', async () => {
    const 用户 = userEvent.setup();
    render新建();
    await 填到第三步(用户, '实习生');
    // 布局不重排：仍是两个金额选择键（textContent 未填占位）
    const 金额键 = () => screen.getAllByRole('button', { name: /元\/天/ });
    expect(金额键().length).toBe(2);
    expect(金额键()[0].textContent).toContain('—');
    await 用户.click(金额键()[0]);
    const 下限列 = screen.getByRole('listbox', { name: '薪资下限' });
    expect(within(下限列).getByRole('option', { name: '200' }).getAttribute('aria-selected')).toBe('true');
    expect(within(screen.getByRole('listbox', { name: '薪资上限' }))
      .getByRole('option', { name: '200' }).getAttribute('aria-selected')).toBe('true');
    await 用户.click(within(下限列).getByRole('option', { name: '300' }));
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资上限' })).getByRole('option', { name: '400' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(screen.queryByRole('listbox', { name: '薪资下限' })).toBeNull();
    expect(金额键()[0].textContent).toContain('300');
    expect(金额键()[1].textContent).toContain('400');
  });

  it('取消零回填：缺值行仍为占位，重开吸附初值不写草稿', async () => {
    const 用户 = userEvent.setup();
    render新建();
    await 填到第三步(用户, '实习生');
    await 用户.click(screen.getAllByRole('button', { name: /元\/天/ })[0]);
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资下限' })).getByRole('option', { name: '300' }));
    await 用户.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('listbox', { name: '薪资下限' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /元\/天/ })[0].textContent).toContain('—');
  });

  it('倒置 300/200 确定仍回填两字段；提交被既有表单校验拦下', async () => {
    const 用户 = userEvent.setup();
    render新建();
    await 填到第三步(用户, '实习生');
    await 用户.click(screen.getAllByRole('button', { name: /元\/天/ })[0]);
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资下限' })).getByRole('option', { name: '300' }));
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资上限' })).getByRole('option', { name: '200' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    // 抽屉内无倒置拦截：两值原样回填
    expect(screen.queryByRole('listbox', { name: '薪资下限' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /元\/天/ })[0].textContent).toContain('300');
    expect(screen.getAllByRole('button', { name: /元\/天/ })[1].textContent).toContain('200');
    // 倒置校验仍归表单提交规则
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    expect(await screen.findByText('薪资下限不能高于上限')).toBeTruthy();
    expect(mock发布岗位).not.toHaveBeenCalled();
  });

  it('兼职时薪：缺值临时 40/40，档 20–200 步 10，确定同步两字段', async () => {
    const 用户 = userEvent.setup();
    render新建();
    await 填到第三步(用户, '兼职');
    await 用户.click(screen.getAllByRole('button', { name: /元\/时/ })[0]);
    const 下限列 = screen.getByRole('listbox', { name: '薪资下限' });
    expect(within(下限列).getAllByRole('option').length).toBe(19);
    expect(within(下限列).getByRole('option', { name: '40' }).getAttribute('aria-selected')).toBe('true');
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(screen.getAllByRole('button', { name: /元\/时/ })[0].textContent).toContain('40');
    expect(screen.getAllByRole('button', { name: /元\/时/ })[1].textContent).toContain('40');
  });

  it('重开从已存值定位，取消后行值原样（吸附只影响确定回填）', async () => {
    const 用户 = userEvent.setup();
    render新建();
    await 填到第三步(用户, '实习生');
    // 先用双轮写入合法带 300/400
    await 用户.click(screen.getAllByRole('button', { name: /元\/天/ })[0]);
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资下限' })).getByRole('option', { name: '300' }));
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资上限' })).getByRole('option', { name: '400' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    // 重开从已存值定位；改 55→60 的档外吸附与超范围夹紧由 薪资区间层.test.tsx 冻结
    await 用户.click(screen.getAllByRole('button', { name: /元\/天/ })[0]);
    expect(within(screen.getByRole('listbox', { name: '薪资下限' }))
      .getByRole('option', { name: '300' }).getAttribute('aria-selected')).toBe('true');
    await 用户.click(within(screen.getByRole('listbox', { name: '薪资下限' })).getByRole('option', { name: '60' }));
    await 用户.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.getAllByRole('button', { name: /元\/天/ })[0].textContent).toContain('300');
  });
});
