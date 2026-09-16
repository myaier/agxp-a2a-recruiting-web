// 发布岗位 · 目录（Backend 选择器 / 职业分类正文与子视图）
// 由 src/屏幕/发布岗位.test.tsx 按冻结归属拆出：消歧规则「Backend 选择器」整个 describe→目录（保留其混合提交/城市断言）；两模式共用职业分类正文/职位类别全屏子视图/职业分类层分页与代际按目录职责归目录。

import {
  mock返回,
  mock进企业主壳,
  mock替换跳转,
  mock跳转,
  mock更新岗位,
  mock发布岗位,
  mock删除岗位,
  mock创建JD导入,
  mock读取目录企业,
  结构化确认文案,
  mock应用状态,
  清空轻提示,
  deferred,
  经抽屉选企业,
  设月薪带,
  置Mock应用状态,
  置Backend应用状态,
  导入公开要求,
} from './发布岗位.测试辅助';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 页面岗位样本, BFF岗位样本, BFF招聘方档案样本 } from '../测试/BFF样本';
import { 转岗位创建, 转岗位补丁 } from '../数据/后端映射';
import { BFF错误 } from '../数据/HTTP客户端';
import { type BFFTaxonomyItem } from '../数据/BFF契约';
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

describe('发布岗位页 Backend 选择器', () => {
  const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
    if (!query.parentId && !query.q) {
      return {
        items: [
          { id: 'cat_tech', display_name: '互联网/AI', parent_id: null, selectable: false },
        ],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    }
    if (query.parentId === 'cat_tech') {
      return {
        items: [
          { id: 'job_be', display_name: '后端开发', parent_id: 'cat_tech', selectable: true },
        ],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    }
    return { items: [], nextCursor: null, catalogVersion: 'v2' };
  });

  // merge 调和（2026-09-14）：默认目录按四支分页 —— 桩按 countryCode 分发，
  // CN 支返回 上海，TW/HK/MO 返回空页（避免跨国响应被拒收产生无关噪声）
  const 查询Location = vi.fn(async (query: { countryCode?: string }) => {
    if (query.countryCode !== 'CN') {
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    }
    return {
      items: [
        {
          id: 'loc_shanghai',
          display_name: '上海',
          country_code: 'CN',
          country_name: '中国',
          admin1_code: 'SH',
          admin1_name: '上海',
          timezone: 'Asia/Shanghai',
          population: 24000000,
        },
      ],
      nextCursor: null,
      catalogVersion: 'v2',
    };
  });

  beforeEach(() => {
    mock返回.mockClear();
    mock进企业主壳.mockClear();
    mock替换跳转.mockClear();
    mock跳转.mockClear();
    mock更新岗位.mockClear();
    mock发布岗位.mockClear();
    mock删除岗位.mockClear();
    清空轻提示();
    查询Taxonomy.mockClear();
    查询Location.mockClear();
    mock发布岗位.mockResolvedValue(undefined);
    置Backend应用状态(查询Taxonomy, 查询Location);
  });

  /** 把三步向导填到「只差点发布」的状态。
   *  城市='选'（默认）打开全页选择正文选 上海 并保存；'开不存' 只打开又直接返回
   *  （无 引用，发布被拦）；'不开' 不打开（供城市子视图专测用例自己操作）。
   *  P0 修复 Task 4：公开要求从既有 JD 导入取得，默认与描述不同；
   *  职位要求=null 时故意留空，用来验前置校验。
   *  合同 C：企业选择行（direct 单行）默认一并选好 —— 缺省桩无 招聘方档案，
   *  不选企业时发布被「请选择用人企业」拦下；选企业=false 用于验该前置校验。 */
  async function 填到发布前(
    选城市: boolean,
    选项: { 职位描述?: string | null; 职位要求?: string | null; 勾选确认?: boolean; 从注册流?: boolean; 选企业?: boolean; 城市?: '选' | '开不存' | '不开' } = {},
  ) {
    const 用户 = userEvent.setup();
    const 视图 = render(
      <MemoryRouter initialEntries={[{ pathname: '/hr/post-job', state: { 从注册流: 选项.从注册流 === true } }]}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );

    const 职位要求文本 = 选项.职位要求 === undefined ? '有分布式系统与撮合引擎经验' : 选项.职位要求;
    if (职位要求文本 !== null) await 导入公开要求(职位要求文本);
    // ── 第一步：基础信息 ──
    await 用户.type(
      screen.getByPlaceholderText('必填，如：资深后端工程师 · 交易网关'),
      '资深后端',
    );
    // 招聘类型默认 社招全职，办公方式待选
    await 用户.click(screen.getByRole('button', { name: '现场' }));
    // 职位类别：打开 Backend 两级选择层 → 选根 → 选 selectable 叶子（原子写 职位类别+类别引用）
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    await 用户.click(await screen.findByRole('button', { name: '互联网/AI' }));
    await waitFor(() =>
      expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ parentId: 'cat_tech' })),
    );
    await 用户.click(await screen.findByRole('button', { name: '后端开发' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));

    // ── 第二步：职位描述 ── 职位描述=null 时故意留空，用来验校验失败的跨步回跳
    const 职位描述文本 = 选项.职位描述 === undefined ? '负责交易网关与撮合核心' : 选项.职位描述;
    if (职位描述文本 !== null) {
      await 用户.type(screen.getByLabelText('职位描述'), 职位描述文本);
    }
    await 用户.click(screen.getByRole('button', { name: '下一步' }));

    // ── 第三步：职位要求 ──
    await 设月薪带(用户, 50, 65);
    // 年薪月数（社招全职必填）：打开滚轮 → 完成（默认 12）
    await 用户.click(screen.getByRole('button', { name: /年薪月数/ }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    // 办公地点
    await 用户.type(
      screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层'),
      '张江路 1 号',
    );
    // 工作城市：Task 2 起为全页选择正文 —— 打开 → 选 上海 → 保存回填 id+name
    const 城市流程 = 选项.城市 ?? (选城市 ? '选' : '开不存');
    if (城市流程 === '选' || 城市流程 === '开不存') {
      await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
      await screen.findByText('选择工作城市');
      if (城市流程 === '选') {
        // Task 6：精选区首位是目录规范名「上海市」（canonical ID）
        await 用户.click((await screen.findAllByRole('button', { name: '上海市' }))[0]);
        await 用户.click(screen.getByRole('button', { name: '保存' }));
      } else {
        // 未保存引用直接返回
        await 用户.click(screen.getByRole('button', { name: '返回' }));
      }
    }
    // 合同 C：direct 新建的用人企业选择行 —— 默认经抽屉选一家（两 refs 同值）；
    // 选企业=false 时留空，发布被前置校验拦下
    if (选项.选企业 !== false) {
      await 用户.click(screen.getByRole('button', { name: /用人企业/ }));
      await 经抽屉选企业(用户, { organization_id: 'org_xinghe', display_name: '星河控股' });
    }
    // P4 互认 Task 3：Backend 发岗必须显式确认结构化要求。默认勾上，
    // 让既有用例继续走「表单填完即可发布」的主路径；确认语义本身的用例传 勾选确认:false 自己控制
    if (选项.勾选确认 !== false) {
      await 用户.click(screen.getByRole('checkbox', { name: 结构化确认文案 }));
    }
    return { 用户, 视图, unmount: 视图.unmount };
  }

  /** P4 互认 Task 3：打开 Backend 编辑态并切到第三步（勾选框所在步）。
   *  编辑目标按存量岗位带 地点引用（城市守卫要求），覆盖项由用例注入。 */
  async function 打开编辑第三步(岗位覆盖: Record<string, unknown> = {}) {
    const 用户 = userEvent.setup();
    mock应用状态.状态.岗位列表 = [
      {
        ...页面岗位样本,
        类别引用: { id: 'tax_product', display_name: '产品经理' },
        地点引用: { id: 'loc_shanghai', display_name: '上海' },
        ...岗位覆盖,
      },
    ];
    const 视图 = render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: '职位要求' }));
    return { 用户, unmount: 视图.unmount };
  }

  it('选类别 + 全页选城市 + 选企业 → 发布带 类别引用/地点引用与同值双 refs', async () => {
    const { 用户 } = await 填到发布前(true);
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));

    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    const 传入 = mock发布岗位.mock.calls[0][0];
    expect(传入.类别引用).toEqual({ id: 'job_be', display_name: '后端开发' });
    // merge 调和：默认视图首位是精选配置的 上海（canonical ID），点它保存按 ID 提交
    // Task 6：显示名为目录规范名「上海市」，ID 不变
    expect(传入.地点引用).toEqual({ id: 'loc_ugt5s3vsvxs3fvd2llx7zc6fqe', display_name: '上海市' });
    // 合同 C：direct 一次选择同时产生相同的发布方与用人企业 ID
    expect(传入.发布模式).toBe('direct');
    expect(传入.发布方企业编号).toBe('org_xinghe');
    expect(传入.用人企业编号).toBe('org_xinghe');
  });

  // ── Task 6：发布成功后按服务端返回的真实 job_id 选中新岗 ────────────────────
  it('Backend 发布成功：用响应的真实 job_id 派发 切当前岗位，再走既有导航', async () => {
    mock发布岗位.mockResolvedValueOnce('job_new_9');
    const { 用户 } = await 填到发布前(true);
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mock应用状态.派发)
      .toHaveBeenCalledWith({ 型: '切当前岗位', 编号: 'job_new_9' }));
    // 选中先于导航：进主壳时当前岗已经是新岗
    const 切岗序 = mock应用状态.派发.mock.calls
      .findIndex((调用: unknown[]) => (调用[0] as { 型: string }).型 === '切当前岗位');
    const 切Tab序 = mock应用状态.派发.mock.calls
      .findIndex((调用: unknown[]) => (调用[0] as { 型: string }).型 === '企业切Tab');
    expect(切岗序).toBeGreaterThanOrEqual(0);
    expect(切岗序).toBeLessThan(切Tab序);
    expect(mock进企业主壳).toHaveBeenCalledTimes(1);
    // 页面组装的 P-xx 占位绝不进选择
    expect(mock应用状态.派发).not.toHaveBeenCalledWith(
      expect.objectContaining({ 型: '切当前岗位', 编号: expect.stringMatching(/^P-/) }));
  });

  it('Backend 返回 null（未执行／已过时）：不选中、不提示成功、不导航', async () => {
    mock发布岗位.mockResolvedValueOnce(null);
    const { 用户 } = await 填到发布前(true);
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    expect(mock应用状态.派发).not.toHaveBeenCalledWith(
      expect.objectContaining({ 型: '切当前岗位' }));
    expect(mock进企业主壳).not.toHaveBeenCalled();
    expect(screen.queryByText('岗位已发布')).toBeNull();
  });

  it('发布失败：保留旧选择，不导航，只给错误文案', async () => {
    mock发布岗位.mockRejectedValueOnce(new Error('boom'));
    const { 用户 } = await 填到发布前(true);
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    // 具体文案由 取后端错误文案 给；这里只钉「不宣称发布成功」
    expect(screen.queryByText('岗位已发布')).toBeNull();
    expect(mock应用状态.派发).not.toHaveBeenCalledWith(
      expect.objectContaining({ 型: '切当前岗位' }));
    expect(mock进企业主壳).not.toHaveBeenCalled();
  });

  it('响应回来前已卸载：迟到成功不抢选、不导航', async () => {
    let 放行!: (值: string) => void;
    mock发布岗位.mockReturnValueOnce(new Promise((ok) => { 放行 = ok; }));
    const { 用户, unmount } = await 填到发布前(true);
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => { 放行('job_new_9'); await Promise.resolve(); });
    expect(mock应用状态.派发).not.toHaveBeenCalledWith(
      expect.objectContaining({ 型: '切当前岗位' }));
    expect(mock进企业主壳).not.toHaveBeenCalled();
  });

  it('响应回来前主体/角色已换：迟到成功不抢选、不导航', async () => {
    let 放行!: (值: string) => void;
    mock发布岗位.mockReturnValueOnce(new Promise((ok) => { 放行 = ok; }));
    const { 用户, 视图 } = await 填到发布前(true);
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    mock应用状态.后端状态 = {
      主体: { subject_id: 'sub_2', roles: [], last_used_role: 'recruiter' },
    };
    视图.rerender(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes><Route path="/hr/post-job" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );
    await act(async () => { 放行('job_new_9'); await Promise.resolve(); });
    expect(mock应用状态.派发).not.toHaveBeenCalledWith(
      expect.objectContaining({ 型: '切当前岗位' }));
    expect(mock进企业主壳).not.toHaveBeenCalled();
  });

  it('城市正文打开但未保存引用 → 发布被拦（操作.发布岗位 不调用）', async () => {
    const { 用户 } = await 填到发布前(false);
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));

    expect(mock发布岗位).not.toHaveBeenCalled();
    expect(await screen.findByText('请从候选城市中选择')).toBeTruthy();
  });

  // ── Task 2：全页城市选择正文 —— 本地子视图、临时选择与过期隔离 ──

  it('打开子视图时原表单退出无障碍树，Escape 关闭恢复城市行焦点且不离开岗位页', async () => {
    const { 用户 } = await 填到发布前(true, { 城市: '不开' });
    await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
    await screen.findByText('选择工作城市');
    // 原步骤/操作区 hidden：退出角色查询（Tab 同理不可达），但保持挂载。
    // Task 3：月薪已是选择行（本就没有 textbox），选择行按钮同样只活在 hidden 区
    expect(screen.queryByRole('button', { name: '薪资下限' })).toBeNull();
    expect(screen.queryByRole('button', { name: /工作城市/ })).toBeNull();
    const 隐藏区 = document.querySelector('div[hidden]');
    expect(隐藏区).toBeTruthy();
    expect(隐藏区!.querySelector('button[aria-label="薪资下限"]')).toBeTruthy();
    // Escape 关闭：不离开岗位页面（返回导航 0 次调用），城市行重新可见并恢复焦点
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('选择工作城市')).toBeNull());
    expect(mock返回).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /工作城市/ }));
  });

  it('空选择保存禁用；选择/取消后再选择保存原子回填 id+name 且其他字段不丢', async () => {
    mock发布岗位.mockResolvedValue('job_new_9');
    const { 用户 } = await 填到发布前(true, { 城市: '不开' });
    await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
    await screen.findByText('选择工作城市');
    // 空选择：保存禁用
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true);
    // 选择后可保存；已选芯片可取消回到空态
    const 城市键们 = await screen.findAllByRole('button', { name: '上海市' });
    await 用户.click(城市键们[0]);
    expect(screen.getByRole('button', { name: '上海市 ✕' })).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '上海市 ✕' }));
    expect(screen.queryByText('已选')).toBeNull();
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true);
    await 用户.click(城市键们[0]);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    // 原字段不丢：第三步上的薪资 / 公开要求 / 企业选择都保持（标题在第一步、描述在第二步）
    expect(screen.getByRole('button', { name: '薪资下限' }).textContent).toContain('50');
    expect((screen.getByRole('textbox', { name: '岗位要求' }) as HTMLTextAreaElement).value).toBe('有分布式系统与撮合引擎经验');
    expect(screen.getByRole('button', { name: /用人企业/ }).textContent).toContain('星河控股');
    // 行回填：城市显示名在场；发布只写 location_id 的目录引用
    // （点击的是精选区 上海，merge 后保存其 canonical ID）
    expect(screen.getByRole('button', { name: /工作城市/ }).textContent).toContain('上海');
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    expect(mock发布岗位.mock.calls[0][0]).toMatchObject({
      城市: '上海市',
      地点引用: { id: 'loc_ugt5s3vsvxs3fvd2llx7zc6fqe', display_name: '上海市' },
    });
  });

  it('同名不同 ID：选第二枚保存带第二枚 ID，不按名称反查', async () => {
    // merge 调和：四支分页 —— CN 支返回同名两枚（不同 admin1 分组），其他支空页
    const 同名Location = vi.fn(async (query: { countryCode?: string }) => {
      if (query.countryCode !== 'CN') {
        return { items: [], nextCursor: null, catalogVersion: 'v2' };
      }
      return {
        items: [
          { id: 'loc_a', display_name: '朝阳', country_code: 'CN', country_name: '中国', admin1_code: '11', admin1_name: '北京市', timezone: 'Asia/Shanghai', population: 0 },
          { id: 'loc_b', display_name: '朝阳', country_code: 'CN', country_name: '中国', admin1_code: '21', admin1_name: '辽宁省', timezone: 'Asia/Shanghai', population: 0 },
        ],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    });
    置Backend应用状态(查询Taxonomy, 同名Location);
    mock发布岗位.mockResolvedValue('job_new_9');
    const { 用户 } = await 填到发布前(true, { 城市: '不开' });
    await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
    await screen.findByText('选择工作城市');
    // 同名两枚各在两个行政区分组渲染（merge 后热门区来自精选配置，不再回显返回项），选第 b 枚
    const 全部 = await screen.findAllByRole('button', { name: '朝阳' });
    expect(全部.length).toBeGreaterThanOrEqual(2);
    await 用户.click(全部[1]);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    expect(mock发布岗位.mock.calls[0][0].地点引用).toEqual({ id: 'loc_b', display_name: '朝阳' });
  });

  it('目录失败显示错误与重试（失败不装成无结果）；搜索成功 0 条显示无结果', async () => {
    // 行内错误行（正文列表区）；同一错误文案也会出现在全局轻提示里，用行内容器定位
    const 错误行 = () => document.querySelector('[class*="错误行"]');
    let 目录调用 = 0;
    // merge 调和：四支分页 —— CN 支首页先失败后成功，其他支恒成功空页；搜索恒空页
    const 时好时坏 = vi.fn(async (query: { q?: string; countryCode?: string }) => {
      if (query.q !== undefined) return { items: [], nextCursor: null, catalogVersion: 'v2' };
      if (query.countryCode !== 'CN') return { items: [], nextCursor: null, catalogVersion: 'v2' };
      目录调用 += 1;
      if (目录调用 === 1) throw new Error('boom');
      return {
        items: [{
          id: 'loc_shanghai', display_name: '上海', country_code: 'CN', country_name: '中国',
          admin1_code: 'SH', admin1_name: '上海', timezone: 'Asia/Shanghai', population: 24000000,
        }],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    });
    置Backend应用状态(查询Taxonomy, 时好时坏);
    const { 用户 } = await 填到发布前(true, { 城市: '不开' });
    await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
    await waitFor(() => expect(错误行()).toBeTruthy());
    expect(screen.queryByText('没有匹配的城市，换个词试试。')).toBeNull();
    // 重试用当前词（默认页重发首页）
    await 用户.click(screen.getByRole('button', { name: '重试' }));
    expect((await screen.findAllByRole('button', { name: '上海' })).length).toBeGreaterThan(0);
    await waitFor(() => expect(错误行()).toBeNull());
    // 搜索成功 0 条：无结果文案，错误不出场
    await 用户.type(screen.getByPlaceholderText('搜索城市 / 省份'), '不存在城');
    expect(await screen.findByText('没有匹配的城市，换个词试试。')).toBeTruthy();
    expect(错误行()).toBeNull();
  });

  it('关闭重开：未保存的临时选择随子视图销毁', async () => {
    const { 用户 } = await 填到发布前(true, { 城市: '不开' });
    await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
    await screen.findByText('选择工作城市');
    await 用户.click((await screen.findAllByRole('button', { name: '上海市' }))[0]);
    expect(screen.getByRole('button', { name: '上海市 ✕' })).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.getByRole('button', { name: /工作城市/ }).textContent).toContain('请选择');
    // 重开：上一次未保存的选中不保留，初始已选为空
    await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
    await screen.findByText('选择工作城市');
    expect(screen.queryByText('已选')).toBeNull();
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('切主体作废在飞查询：旧主体的响应不落新子视图，新查询重新发出', async () => {
    // 每次调用的门都单独记录：门[0]=旧主体 CN 首页（在飞），门[4]=新主体 CN 首页
    // （merge 调和：四支分页，一轮默认页 = CN/TW/HK/MO 四次请求）
    const 门们: ((value: { items: unknown[]; nextCursor: string | null; catalogVersion: string }) => void)[] = [];
    const 慢Location = vi.fn(async () => new Promise<{ items: unknown[]; nextCursor: string | null; catalogVersion: string }>((ok) => { 门们.push(ok); }));
    置Backend应用状态(查询Taxonomy, 慢Location);
    const { 用户, 视图 } = await 填到发布前(true, { 城市: '不开' });
    await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
    await screen.findByText('选择工作城市');
    expect(慢Location).toHaveBeenCalledTimes(4);
    // 换主体：子视图按主体身份重挂（旧在飞查询随卸载作废），新一轮默认页请求发出
    mock应用状态.后端状态 = { 主体: { subject_id: 'sub_2', roles: [], last_used_role: 'recruiter' } };
    视图.rerender(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes><Route path="/hr/post-job" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(慢Location).toHaveBeenCalledTimes(8));
    // 旧主体首页此刻才回：旧子视图已卸载，响应被作废，不得落进新子视图
    await act(async () => {
      门们[0]({ items: [{ id: 'loc_old', display_name: '旧主体城' }], nextCursor: null, catalogVersion: 'v2' });
      await Promise.resolve();
    });
    expect(screen.queryByText('旧主体城')).toBeNull();
  });

  it('岗位城市全程零候选草稿派发', async () => {
    mock发布岗位.mockResolvedValue('job_new_9');
    const { 用户 } = await 填到发布前(true);
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    const 类型们 = mock应用状态.派发.mock.calls.map((调用: unknown[]) => (调用[0] as { 型: string }).型);
    expect(类型们).not.toContain('存引导预填');
    expect(类型们).not.toContain('改意向草稿');
  });

  // review Important：子视图占位区关闭时必须接管外壳的满高 flex 链，否则 .发布壳 的
  // flex:1 相对内容高解析、高度链断裂。jsdom 不证布局，这里只钉结构契约。
  it('城市子视图占位区关闭时保持外壳满高 flex 链，打开时退出无障碍树', async () => {
    await 填到发布前(true);
    const 占位区 = document.querySelector('[aria-busy]')!.parentElement as HTMLElement;
    // 关闭态：接管 .次级页外壳 的满高语义（display:flex + flex:1 + min-height:0），
    // .发布壳 的 flex:1 继续有效
    expect(占位区.hidden).toBe(false);
    expect(占位区.style.display).toBe('flex');
    // jsdom 把 flex:1 展开成完整缩写
    expect(占位区.style.flex).toBe('1 1 0%');
    expect(占位区.style.minHeight).toBe('0px');
    expect(占位区.style.flexDirection).toBe('column');
    // 打开态：display 显式 none + hidden 仍置位（author display 不压过折叠）
    await userEvent.click(screen.getByRole('button', { name: /工作城市/ }));
    await screen.findByText('选择工作城市');
    expect(占位区.hidden).toBe(true);
    expect(占位区.style.display).toBe('none');
    await userEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(占位区.hidden).toBe(false);
    expect(占位区.style.display).toBe('flex');
  });

  // ── P0 修复 Task 4：JobCreate 的三条独立必填文本 ──

  it('第三步公开岗位要求与私有筛选要求各有独立空白多行输入', async () => {
    await 填到发布前(true, { 职位要求: null });
    expect(screen.queryByRole('textbox', { name: /给候选人看的职位要求/ })).toBeNull();
    const 偏好框 = screen.getByRole('textbox', { name: '给 AI 代理的筛选要求' });
    expect(偏好框.getAttribute('placeholder')).toBe('');
    expect((screen.getByRole('textbox', { name: '岗位要求' }) as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByRole('textbox', { name: '岗位要求' }).getAttribute('placeholder')).toBe('');
    expect(document.querySelectorAll('textarea')).toHaveLength(2);
    expect(screen.getByText('选填')).toBeTruthy();
    expect(screen.getByText('写下你的要求和偏好，AI 代理会据此筛选候选人。')).toBeTruthy();
    expect(screen.getByText('薪资仅判断双方区间是否匹配，不询问或协商具体金额。')).toBeTruthy();
  });

  it('页面提交空公开要求，真实后端映射仍按现有契约拒绝空值', async () => {
    const { 用户 } = await 填到发布前(true, { 职位要求: null });
    await 用户.type(screen.getByRole('textbox', { name: '给 AI 代理的筛选要求' }), '只给代理');
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    const 岗位 = mock发布岗位.mock.calls[0][0];
    expect(岗位).toMatchObject({ 职位要求: '', 筛选要求: '只给代理' });
    expect(() => 转岗位创建(岗位, {
      publisherMode: 'direct', publisherOrganizationRef: 'org_xinghe', hiringOrganizationRef: 'org_xinghe',
    })).toThrow('请填写职位要求');
  });

  // 校验失败必须把用户带回出问题的那一步 —— 只弹 toast 不切步，用户当前屏上根本
  // 看不见那个控件。职位描述是唯一会跨步回跳（第三步 → 第一步）的那条。
  it('职位描述为空时从第三步跳回第二步的描述输入并零 mutation', async () => {
    const { 用户 } = await 填到发布前(true, { 职位描述: null });
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    expect(await screen.findByText('请填写职位描述')).toBeTruthy();
    expect(mock发布岗位).not.toHaveBeenCalled();
    // 真的换了步：描述输入回到屏上，第三步的职位要求输入与提交键都不在了
    expect(screen.getByRole('textbox', { name: '职位描述' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: '给候选人看的职位要求（补充文字，不自动解析为硬门槛）' })).toBeNull();
    expect(screen.queryByRole('button', { name: '发布岗位并开始寻访' })).toBeNull();
  });

  // 合同 C：无企业默认（招聘方档案为 null，读取无效）时必须用户选择 ——
  // 发布被拦并带回企业选择行所在的第三步；不再有「去招聘名片填写名称」的指路文案。
  it('新建未选企业时零 mutation，并带回企业选择行', async () => {
    置Backend应用状态(查询Taxonomy, 查询Location, {
      企业关系列表: [], 当前企业关系编号: null, 未认证公司声明: '   ',
    });
    const { 用户 } = await 填到发布前(true, { 选企业: false });
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    expect(await screen.findByText('请选择用人企业')).toBeTruthy();
    expect(mock发布岗位).not.toHaveBeenCalled();
    // 真的还在企业选择行所在的第三步
    expect(screen.getByRole('button', { name: /用人企业/ })).toBeTruthy();
    expect(screen.queryByText('请先在招聘名片填写公司名称')).toBeNull();
  });

  // 合同 C：编辑不强制补企业坐标 —— 旧岗位缺 refs 且用户只改无关字段时照常保存
  // （补丁不带 refs/mode/claim）；也不再有「去招聘名片填写名称」的阻挡。
  it('编辑态缺企业 refs 且只改无关字段时照常保存，不带企业坐标', async () => {
    const 用户 = userEvent.setup();
    mock更新岗位.mockResolvedValue(undefined);
    置Backend应用状态(查询Taxonomy, 查询Location, {
      企业关系列表: [], 当前企业关系编号: null, 未认证公司声明: '   ',
    });
    // Backend 编辑态的城市守卫（地点引用）不在本次修复范围内：编辑目标按存量岗位带引用；
    // 类别引用同口径补齐（Task 4 起 Backend 第一步要求真实 类别引用）
    mock应用状态.状态.岗位列表 = [
      {
        ...页面岗位样本,
        类别引用: { id: 'job_be', display_name: '产品经理' },
        地点引用: { id: 'loc_shanghai', display_name: '上海' },
      },
    ];
    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({ 编号: 'job_1' });
    expect(screen.queryByText('请先在招聘名片填写公司名称')).toBeNull();
    expect(screen.queryByText('请选择用人企业')).toBeNull();
  });

  it.each([false, true])('手工发布公开岗位要求无需JD导入，从注册流=%s', async 从注册流 => {
    const { 用户 } = await 填到发布前(true, { 职位要求: null, 勾选确认: false, 从注册流 });
    const 输入 = screen.getByRole('textbox', { name: '岗位要求' }) as HTMLTextAreaElement;
    expect(输入.value).toBe('');
    expect(输入.placeholder).toBe('');
    expect(输入.tagName).toBe('TEXTAREA');
    await 用户.type(输入, '熟悉交易系统\n能够独立排查问题');
    await 用户.type(screen.getByRole('textbox', { name: '给 AI 代理的筛选要求' }), '优先金融经验');
    await 用户.click(screen.getByRole('checkbox', { name: 结构化确认文案 }));
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    const 请求 = 转岗位创建(mock发布岗位.mock.calls[0][0], { publisherMode: 'direct', publisherOrganizationRef: 'org_xinghe', hiringOrganizationRef: 'org_xinghe' });
    expect(请求.requirements).toBe('熟悉交易系统\n能够独立排查问题');
    expect(请求.private_screening_preferences).toBe('优先金融经验');
    expect(mock创建JD导入).not.toHaveBeenCalled();
  });

  it('编辑岗位要求完整回填，改动撤销确认并按现有补丁保存', async () => {
    mock更新岗位.mockResolvedValue(undefined);
    const { 用户 } = await 打开编辑第三步({ 职位要求: '原岗位要求\n第二行', 结构化要求已确认: true });
    const 输入 = screen.getByRole('textbox', { name: '岗位要求' });
    expect((输入 as HTMLTextAreaElement).value).toBe('原岗位要求\n第二行');
    await 用户.clear(输入);
    await 用户.type(输入, '新岗位要求\n仍保留多行');
    expect((screen.getByRole('checkbox', { name: 结构化确认文案 }) as HTMLInputElement).checked).toBe(false);
    await 用户.click(screen.getByRole('checkbox', { name: 结构化确认文案 }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(转岗位补丁(mock更新岗位.mock.calls[0][0], BFF岗位样本).requirements).toBe('新岗位要求\n仍保留多行');
  });

  it('全远程编辑地址回填且修改保存不被清空，城市行保持锁定不开子视图', async () => {
    mock更新岗位.mockResolvedValue(undefined);
    const { 用户 } = await 打开编辑第三步({ 办公方式: '全远程', 办公地: '远程原地址', 结构化要求已确认: true });
    const 地址 = screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层') as HTMLInputElement;
    expect(地址.value).toBe('远程原地址');
    expect(地址.disabled).toBe(false);
    // Task 2：编辑态城市行锁定 —— 点击只提示不可改，全页选择正文不出现
    await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
    expect(await screen.findByText('发布后不可修改，如需变更请新发一个岗位')).toBeTruthy();
    expect(screen.queryByText('选择工作城市')).toBeNull();
    await 用户.clear(地址); await 用户.type(地址, '远程新地址');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(转岗位补丁(mock更新岗位.mock.calls[0][0], { ...BFF岗位样本, workplace_mode: 'remote', office_location: '远程原地址' }).office_location).toBe('远程新地址');
  });

  it('完整表单把独立 description 和 requirements 交给 operation', async () => {
    const { 用户 } = await 填到发布前(true, { 职位要求: '  应届或毕业年级；关注 AI 与开发工具  ' });
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    expect(mock发布岗位.mock.calls[0][0]).toMatchObject({
      职位描述: '负责交易网关与撮合核心',
      职位要求: '应届或毕业年级；关注 AI 与开发工具',
    });
  });

  // Task 4（frontend truthfulness）：结构化档位（自动匹配读取）与补充文字（不自动解析）
  // 的文案边界 —— 只改可见/可访问文案，不改 payload：用户选的结构化值原样、手打补充文字原样。
  it('新建保留导入公开要求，私有输入不流入公开字段', async () => {
    const { 用户 } = await 填到发布前(true, { 职位要求: '至少 3 年经验，本科优先' });
    await 用户.type(screen.getByRole('textbox', { name: '给 AI 代理的筛选要求' }), '交易系统经验优先');
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    expect(mock发布岗位.mock.calls[0][0]).toMatchObject({
      职位要求: '至少 3 年经验，本科优先', 筛选要求: '交易系统经验优先',
      经验要求: '不限', 最低学历: '不限', 年薪月数: 12,
    });
    const 请求体 = 转岗位创建(mock发布岗位.mock.calls[0][0], {
      publisherMode: 'direct', publisherOrganizationRef: 'org_xinghe', hiringOrganizationRef: 'org_xinghe',
    });
    expect(请求体).toMatchObject({ requirements: '至少 3 年经验，本科优先', private_screening_preferences: '交易系统经验优先', annual_salary_months: 12 });
  });

  // Task 5：新岗四问全部从未说明起步；没点过的三问也必须以 未说明 随完整对象提交，
  // 绝不允许缺员 —— 服务端 hard_requirements 四员必返/必收。
  it('new job starts with four unknown facts and submits the complete object', async () => {
    const { 用户 } = await 填到发布前(true);
    // 四问钮 2026-08-26 已删:服务端合同不变——新岗仍以完整四员(全「未说明」)随对象提交
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    expect(mock发布岗位).toHaveBeenCalledWith(expect.objectContaining({
      硬性事实: { 大小周: '未说明', 纯外包乙方: '未说明', 全现场办公: '未说明', 频繁出差: '未说明' },
    }));
  });
  // ── P4 互认 Task 3：结构化要求确认（仅 Backend）──

  const 勾选框 = () => screen.getByRole('checkbox', { name: 结构化确认文案 }) as HTMLInputElement;

  it('未勾选确认时发岗被拦：留在第三步、显示文案且零 mutation', async () => {
    const { 用户 } = await 填到发布前(true, { 勾选确认: false });
    expect(勾选框().checked).toBe(false);
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    expect(await screen.findByText('请确认经验和学历将作为自动匹配依据')).toBeTruthy();
    expect(mock发布岗位).not.toHaveBeenCalled();
    expect(mock更新岗位).not.toHaveBeenCalled();
    // 留在第三步：确认勾选框仍在屏上，用户看得见该勾哪儿
    expect(勾选框()).toBeTruthy();
  });

  it('经验学历保持不限时勾选确认即可发岗并带 结构化要求已确认: true', async () => {
    const { 用户 } = await 填到发布前(true, { 勾选确认: false });
    await 用户.click(勾选框());
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    expect(mock发布岗位.mock.calls[0][0]).toMatchObject({
      结构化要求已确认: true,
      经验要求: '不限',
      最低学历: '不限',
    });
  });

  it('Backend 编辑按存量 Owner Job 水合勾选态：已确认勾上、legacy-false 不勾', async () => {
    const 已确认 = await 打开编辑第三步({ 结构化要求已确认: true });
    expect(勾选框().checked).toBe(true);
    已确认.unmount();

    await 打开编辑第三步({ 结构化要求已确认: false });
    expect(勾选框().checked).toBe(false);
  });

  it('legacy-false 编辑勾选后不改动三处文本也能保存：update 带 结构化要求已确认: true', async () => {
    mock更新岗位.mockResolvedValue(undefined);
    const { 用户 } = await 打开编辑第三步({ 结构化要求已确认: false });
    await 用户.click(勾选框());
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({
      编号: 'job_1',
      结构化要求已确认: true,
      经验要求: '不限',
      最低学历: '本科',
      职位要求: '在校生',
    });
  });

  it('勾选后改经验学历取消勾选，改私有偏好不取消', async () => {
    const { 用户 } = await 填到发布前(true, { 勾选确认: false });

    await 用户.click(勾选框());
    await 用户.click(screen.getByRole('button', { name: '1-3 年' }));
    expect(勾选框().checked).toBe(false);

    await 用户.click(勾选框());
    await 用户.click(screen.getByRole('button', { name: '本科' }));
    expect(勾选框().checked).toBe(false);

    await 用户.click(勾选框());
    await 用户.type(screen.getByRole('textbox', { name: '给 AI 代理的筛选要求' }), '私有偏好');
    expect(勾选框().checked).toBe(true);
  });

  it('改薪资、办公地点、筛选偏好、年薪月数或描述不取消勾选', async () => {
    const { 用户 } = await 填到发布前(true, { 勾选确认: false });
    await 用户.click(勾选框());

    await 设月薪带(用户, 52, 65);
    await 用户.type(
      screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层'),
      '（改）',
    );
    await 用户.type(
      screen.getByRole('textbox', { name: '给 AI 代理的筛选要求' }),
      '重点看系统设计',
    );
    // 年薪月数滚轮也是无关控件
    await 用户.click(screen.getByRole('button', { name: /年薪月数/ }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(勾选框().checked).toBe(true);

    // 描述在第二步：返回 → 改描述 → 下一步回第三步，确认态不能被跨步编辑冲掉
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    await 用户.type(screen.getByRole('textbox', { name: '职位描述' }), '（改）');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(勾选框().checked).toBe(true);
  });

  it('后端编辑私有偏好保留历史公开要求，补丁不重写公开字段', async () => {
    mock更新岗位.mockResolvedValue(undefined);
    const { 用户 } = await 打开编辑第三步({ 职位要求: BFF岗位样本.requirements });
    const 输入 = screen.getByRole('textbox', { name: '给 AI 代理的筛选要求' });
    await 用户.clear(输入);
    await 用户.type(输入, '私有偏好只给代理');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    const 岗位 = mock更新岗位.mock.calls[0][0];
    expect(岗位.职位要求).toBe(BFF岗位样本.requirements);
    const 补丁 = 转岗位补丁(岗位, BFF岗位样本);
    expect(补丁.private_screening_preferences).toBe('私有偏好只给代理');
    expect(补丁).not.toHaveProperty('requirements');
  });

  it('legacy-false 编辑只改无关字段时不勾选也能保存', async () => {
    mock更新岗位.mockResolvedValue(undefined);
    const { 用户 } = await 打开编辑第三步({ 结构化要求已确认: false });
    expect(勾选框().checked).toBe(false);
    await 用户.type(
      screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层'),
      '（改）',
    );
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({
      编号: 'job_1',
      结构化要求已确认: false,
    });
  });

  // ── 合同 C：企业选择行 / 档案默认 / 编辑按岗位自身 ID 恢复 ──────────────

  it('新建默认读取档案所选企业，读取有效后才选中', async () => {
    let 放行档案默认!: (项: { organization_id: string; display_name: string }) => void;
    置Backend应用状态(查询Taxonomy, 查询Location, {
      招聘方档案: { ...BFF招聘方档案样本, organization_ref: 'org_default' },
    });
    // 档案默认读取挂起（置桩会 reset，所以放在置桩之后）：行保持未选
    mock读取目录企业.mockImplementationOnce(() => new Promise((ok) => { 放行档案默认 = ok; }));
    const { 用户 } = await 填到发布前(true, { 选企业: false });
    // 默认读取未回：行保持未选
    expect(screen.getByRole('button', { name: /用人企业/ }).textContent).toContain('未选');
    await act(async () => {
      放行档案默认({ organization_id: 'org_default', display_name: '档案默认企业' });
      await Promise.resolve();
    });
    // 读取有效才选中：行落到档案企业名
    expect(screen.getByRole('button', { name: /用人企业/ }).textContent).toContain('档案默认企业');
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    // 直招单行选一次：两个 refs 相等
    expect(mock发布岗位.mock.calls[0][0]).toMatchObject({
      发布模式: 'direct', 发布方企业编号: 'org_default', 用人企业编号: 'org_default',
    });
  });

  it('用户触碰后迟到档案默认读取不能覆盖草稿', async () => {
    let 放行档案默认!: (项: { organization_id: string; display_name: string }) => void;
    置Backend应用状态(查询Taxonomy, 查询Location, {
      招聘方档案: { ...BFF招聘方档案样本, organization_ref: 'org_default' },
    });
    mock读取目录企业.mockImplementationOnce(() => new Promise((ok) => { 放行档案默认 = ok; }));
    const { 用户 } = await 填到发布前(true); // 用户经抽屉改选 星河控股
    expect(screen.getByRole('button', { name: /用人企业/ }).textContent).toContain('星河控股');
    await act(async () => {
      放行档案默认({ organization_id: 'org_default', display_name: '档案默认企业' });
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: /用人企业/ }).textContent).toContain('星河控股');
    expect(screen.getByRole('button', { name: /用人企业/ }).textContent).not.toContain('档案默认企业');
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    expect(mock发布岗位.mock.calls[0][0]).toMatchObject({
      发布方企业编号: 'org_xinghe', 用人企业编号: 'org_xinghe',
    });
  });

  it('JD 解析建议只填正文等字段，不创造或覆盖企业 ID', async () => {
    // 无档案默认且用户未选企业：建议（公开要求）应用后企业行仍是未选，发布被拦
    const { 用户 } = await 填到发布前(true, { 选企业: false });
    expect(screen.getByRole('textbox', { name: '岗位要求' }).textContent.length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /用人企业/ }).textContent).toContain('未选');
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    expect(await screen.findByText('请选择用人企业')).toBeTruthy();
    expect(mock发布岗位).not.toHaveBeenCalled();
  });

  it('取消抽屉保持原值，选中只改本岗草稿', async () => {
    const { 用户 } = await 填到发布前(true, { 选企业: false });
    await 用户.click(screen.getByRole('button', { name: /用人企业/ }));
    await 用户.type(await screen.findByPlaceholderText('输入公司名称'), '星河');
    // 不点候选，直接按遮罩关闭
    await 用户.click(screen.getByRole('button', { name: '关闭选择企业' }));
    expect(screen.getByRole('button', { name: /用人企业/ }).textContent).toContain('未选');
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    expect(await screen.findByText('请选择用人企业')).toBeTruthy();
  });

  // 编辑恢复：每个企业按其 ID 读取，不按当前名片猜；无效企业行不显示成已成功保存。
  const 按ID回名 = (名称表: Record<string, string>) => mock读取目录企业.mockImplementation(async (id: string) => ({
    organization_id: id,
    display_name: 名称表[id] ?? `企业${id}`,
    legal_name: null,
    verification_status: 'unverified' as const,
  }));

  it('direct 编辑按岗位自身 ID 恢复名称；未改企业保存补丁不带 refs', async () => {
    mock更新岗位.mockResolvedValue(undefined);
    按ID回名({ org_own: '自报企业' });
    const previous = {
      ...BFF岗位样本,
      publisher_organization_ref: 'org_own',
      hiring_organization_ref: 'org_own',
    };
    const { 用户 } = await 打开编辑第三步({
      发布模式: 'direct',
      发布方企业编号: 'org_own',
      用人企业编号: 'org_own',
    });
    expect(await screen.findByRole('button', { name: /用人企业.*自报企业/ })).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({
      发布模式: 'direct', 发布方企业编号: 'org_own', 用人企业编号: 'org_own',
    });
    expect(转岗位补丁(mock更新岗位.mock.calls[0][0], previous)).toEqual({});
  });

  it('direct 编辑改选后两个相同 refs 同时在场', async () => {
    mock更新岗位.mockResolvedValue(undefined);
    按ID回名({ org_own: '自报企业' });
    const previous = {
      ...BFF岗位样本,
      publisher_organization_ref: 'org_own',
      hiring_organization_ref: 'org_own',
    };
    const { 用户 } = await 打开编辑第三步({
      发布模式: 'direct',
      发布方企业编号: 'org_own',
      用人企业编号: 'org_own',
    });
    await 用户.click(screen.getByRole('button', { name: /用人企业/ }));
    await 经抽屉选企业(用户, { organization_id: 'org_xinghe', display_name: '星河控股' });
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({
      发布方企业编号: 'org_xinghe', 用人企业编号: 'org_xinghe',
    });
    expect(转岗位补丁(mock更新岗位.mock.calls[0][0], previous))
      .toEqual({ publisher_organization_ref: 'org_xinghe', hiring_organization_ref: 'org_xinghe' });
  });

  it('agency 编辑显示两行并各自按 ID 恢复；改用人侧保存只带该 ref', async () => {
    mock更新岗位.mockResolvedValue(undefined);
    按ID回名({ org_pub: '代理发布企业', org_client: '客户企业' });
    const previous = {
      ...BFF岗位样本,
      publisher_mode: 'agency' as const,
      publisher_organization_ref: 'org_pub',
      hiring_organization_ref: 'org_client',
    };
    const { 用户 } = await 打开编辑第三步({
      发布模式: 'agency',
      发布方企业编号: 'org_pub',
      用人企业编号: 'org_client',
    });
    expect(await screen.findByRole('button', { name: /发布方企业.*代理发布企业/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /用人企业.*客户企业/ })).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: /用人企业/ }));
    await 经抽屉选企业(用户, { organization_id: 'org_xinghe', display_name: '星河控股' });
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({
      发布模式: 'agency', 发布方企业编号: 'org_pub', 用人企业编号: 'org_xinghe',
    });
    expect(转岗位补丁(mock更新岗位.mock.calls[0][0], previous))
      .toEqual({ hiring_organization_ref: 'org_xinghe' });
  });

  it('agency 改用人侧但发布方缺失：要求先补齐两侧，零 mutation', async () => {
    mock更新岗位.mockResolvedValue(undefined);
    按ID回名({ org_client: '客户企业' });
    const { 用户 } = await 打开编辑第三步({
      发布模式: 'agency',
      用人企业编号: 'org_client',
    });
    await 用户.click(screen.getByRole('button', { name: /用人企业/ }));
    await 经抽屉选企业(用户, { organization_id: 'org_xinghe', display_name: '星河控股' });
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('请选择发布方企业')).toBeTruthy();
    expect(mock更新岗位).not.toHaveBeenCalled();
  });

  it('编辑企业读取失败：行显示未选允许更换，不显示成已成功保存', async () => {
    mock更新岗位.mockResolvedValue(undefined);
    mock读取目录企业.mockRejectedValue(new BFF错误(503, 'unavailable', 'x'));
    const { 用户 } = await 打开编辑第三步({
      发布模式: 'direct',
      发布方企业编号: 'org_invalid',
      用人企业编号: 'org_invalid',
    });
    expect(await screen.findByRole('button', { name: /用人企业/ }).then((行) => 行.textContent?.includes('未选'))).toBe(true);
    // 未改企业（草稿保持岗位自身 ID）直接保存：零 mutation 于企业坐标
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({
      发布方企业编号: 'org_invalid', 用人企业编号: 'org_invalid',
    });
  });

  it('agency 无关编辑（两侧缺 refs 未改企业）照常保存，补丁不带企业坐标', async () => {
    mock更新岗位.mockResolvedValue(undefined);
    const previous = {
      ...BFF岗位样本,
      publisher_mode: 'agency' as const,
    };
    const { 用户 } = await 打开编辑第三步({ 发布模式: 'agency' });
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    const 岗位 = mock更新岗位.mock.calls[0][0];
    expect(岗位.发布模式).toBe('agency');
    expect(岗位.发布方企业编号).toBeUndefined();
    expect(岗位.用人企业编号).toBeUndefined();
    expect(转岗位补丁(岗位, previous)).toEqual({});
  });
});

// ── Spec §5.2：两模式消费共用分类正文 —— Mock 本地表映射同一 props（左栏导航、
// 右栏可选、关闭重开保留选中勾）；Backend 右栏分页/下钻、无子项不可选项不提交、
// 同名叶子按稳定 ID 提交。Backend hooks 外层（分页/代际守卫）保持原样。──
describe('发布岗位页 两模式共用职业分类正文', () => {
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

  it('Mock：左栏大类换右栏、右栏选定写回职位类别，关闭重开保留选中勾', async () => {
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
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    expect(screen.getByRole('dialog', { name: '职位类别' })).toBeTruthy();
    // 左栏点大类换右栏（本地职业分类表照旧）
    await 用户.click(screen.getByRole('button', { name: '产品' }));
    await 用户.click(await screen.findByRole('button', { name: '产品经理' }));
    // 层关闭，行上回显
    await screen.findByText('产品 · 产品经理');

    // 关闭重开：选中勾保留（✓ 由选中项内的 勾 span 渲染，可访问名带 ✓ 尾缀；
    // 在弹层对话框内查，避开第一步那行「产品 · 产品经理」回显）
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    const 弹层 = await screen.findByRole('dialog', { name: '职位类别' });
    const 重开项 = within(弹层).getByRole('button', { name: /产品经理✓/ });
    expect(重开项.textContent).toContain('✓');
  });

  it('Backend：右栏分页追加、下钻不可选父项、死端父项不提交，同名叶子按 ID 提交', async () => {
    // 目录桩：根『同名类』(不可选) → 子项第一页只有『中转』(不可选,有子项,带游标)
    // → 游标页『分页叶子』；『中转』下钻 → 『死端父项』(不可选,无子项) + 『同名类』叶子。
    const 大类A: BFFTaxonomyItem = { id: 'root_same', display_name: '同名类', parent_id: null, selectable: false, has_children: true };
    const 中转: BFFTaxonomyItem = { id: 'branch_mid', display_name: '中转', parent_id: 'root_same', selectable: false, has_children: true };
    const 分页叶子: BFFTaxonomyItem = { id: 'leaf_page', display_name: '分页叶子', parent_id: 'root_same', selectable: true, has_children: false };
    const 死端父项: BFFTaxonomyItem = { id: 'branch_dead', display_name: '死端父项', parent_id: 'branch_mid', selectable: false, has_children: false };
    const 同名叶子: BFFTaxonomyItem = { id: 'leaf_same', display_name: '同名类', parent_id: 'branch_mid', selectable: true, has_children: false };
    const 页 = (items: BFFTaxonomyItem[], nextCursor: string | null) => ({ items, nextCursor, catalogVersion: 'v2' });
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string; q?: string }) => {
      if (!query.parentId && !query.cursor) return 页([大类A], null);
      if (query.parentId === 'root_same' && !query.cursor) return 页([中转], 'child_cur_1');
      if (query.cursor === 'child_cur_1') return 页([分页叶子], null);
      if (query.parentId === 'branch_mid') return 页([死端父项, 同名叶子], null);
      return 页([], null);
    });
    const 查询Location = vi.fn(async () => ({
      items: [{
        id: 'loc_shanghai', display_name: '上海', country_code: 'CN', country_name: '中国',
        admin1_code: 'SH', admin1_name: '上海', timezone: 'Asia/Shanghai', population: 24000000,
      }],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    置Backend应用状态(查询Taxonomy, 查询Location);
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );

    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    // mount 预选第一根并载其子项第一页
    await screen.findByText('中转');
    // 右栏分页：加载更多追加第二页
    await 用户.click(await screen.findByRole('button', { name: '加载更多' }));
    await screen.findByText('分页叶子');
    // 右栏下钻：不可选且有子项 → 替换右栏
    await 用户.click(screen.getByText('中转'));
    await screen.findByText('死端父项');
    // 死端父项（不可选且无子项）：不提交不展开，零目录请求
    const 下钻后调用数 = 查询Taxonomy.mock.calls.length;
    await 用户.click(screen.getByText('死端父项'));
    expect(查询Taxonomy.mock.calls.length).toBe(下钻后调用数);
    expect(screen.getByText('死端父项')).toBeTruthy();
    // 同名叶子（与根同名不同键）单击选定：层关闭，行上回显
    const 同名们 = screen.getAllByText('同名类');
    await 用户.click(同名们[同名们.length - 1]!);
    await screen.findByText('互联网/AI · 同名类');

    // 把剩余表单填完并发布：类别引用必须是叶子的稳定 ID，不是按名称反查
    await 用户.type(screen.getByPlaceholderText('必填，如：资深后端工程师 · 交易网关'), '共用正文岗');
    await 用户.click(screen.getByRole('button', { name: '现场' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await 用户.type(screen.getByRole('textbox', { name: '职位描述' }), '验证两栏共用正文');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await 设月薪带(用户, 50, 65);
    await 用户.click(screen.getByRole('button', { name: /年薪月数/ }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    await 用户.type(screen.getByRole('textbox', { name: '岗位要求' }), '三年以上后端经验');
    await 用户.type(screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层'), '张江路 1 号');
    // 工作城市：全页选择正文 → 选 上海 → 保存
    await 用户.click(screen.getByRole('button', { name: /工作城市/ }));
    await screen.findByText('选择工作城市');
    await 用户.click((await screen.findAllByRole('button', { name: '上海市' }))[0]);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    // 合同 C：企业坐标经抽屉选好
    await 用户.click(screen.getByRole('button', { name: /用人企业/ }));
    await 经抽屉选企业(用户, { organization_id: 'org_xinghe', display_name: '星河控股' });
    await 用户.click(screen.getByRole('checkbox', { name: 结构化确认文案 }));
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    expect(mock发布岗位.mock.calls[0][0]).toMatchObject({
      职位类别: '同名类',
      类别引用: { id: 'leaf_same', display_name: '同名类' },
    });
  });
});

// ── Task 1：职位类别从底部抽屉改为全屏子视图（A 契约）──
// 全屏正文是 次级页外壳 的内容兄弟：打开时父表单 wrapper hidden + 显式 display:none
// 保持挂载，正文不在 hidden 祖先里；关闭（返回/Escape）只关闭，父页按 A 的时序
// 先回触发行焦点（preventScroll）再还原打开前记录的父滚动位置；首次挂载不抢焦点。
// 草稿语义沿用原抽屉：取消零回填；选定合法叶子原子写 职位类别；
// 名称预填只跟「为空 / 等于旧类别」的名称，手改过的名称绝不覆盖。
describe('发布岗位页 职位类别全屏子视图（Task 1）', () => {
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
  });

  function render新建页() {
    return render(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('改过岗位名称后进入类别：返回/Escape 只关闭，草稿、步骤、字段原值不变', async () => {
    const 用户 = userEvent.setup();
    render新建页();
    const 名称框 = screen.getByPlaceholderText('必填，如：资深后端工程师 · 交易网关') as HTMLInputElement;
    await 用户.type(名称框, '手改的岗位名');
    await 用户.click(screen.getByRole('button', { name: '现场' }));

    // 返回键关闭
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    await screen.findByRole('dialog', { name: '职位类别' });
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.queryByRole('dialog', { name: '职位类别' })).toBeNull();
    // Escape 关闭
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    await screen.findByRole('dialog', { name: '职位类别' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '职位类别' })).toBeNull();

    // 草稿与字段原值不变，仍在第一步（没有跨步、没有丢字）
    expect(名称框.value).toBe('手改的岗位名');
    expect(screen.getByRole('button', { name: '现场' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /职位类别/ }).textContent).toContain('请选择');
    expect(screen.getByRole('button', { name: '下一步' })).toBeTruthy();
  });

  it('选择合法项只更新类别：手改名称不覆盖；名称为空或等于旧类别才跟随', async () => {
    const 用户 = userEvent.setup();
    render新建页();
    const 名称框 = screen.getByPlaceholderText('必填，如：资深后端工程师 · 交易网关') as HTMLInputElement;

    // 手改名称后选择：类别回填，名称不覆盖
    await 用户.type(名称框, '手改岗');
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    await 用户.click(await screen.findByRole('button', { name: '产品' }));
    await 用户.click(await screen.findByRole('button', { name: '产品经理' }));
    await screen.findByText('产品 · 产品经理');
    expect(名称框.value).toBe('手改岗');

    // 名称既非空也不等于旧类别：再选不跟随
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    await 用户.click(await screen.findByRole('button', { name: '客服/运营' }));
    await 用户.click(await screen.findByRole('button', { name: '用户运营' }));
    await screen.findByText('客服/运营 · 用户运营');
    expect(名称框.value).toBe('手改岗');

    // 名称清空（为空）：跟随新叶子
    await 用户.clear(名称框);
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    await 用户.click(await screen.findByRole('button', { name: '产品' }));
    await 用户.click(await screen.findByRole('button', { name: 'AI产品经理' }));
    await screen.findByText('产品 · AI产品经理');
    expect(名称框.value).toBe('AI产品经理');

    // 名称等于旧类别：跟随
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    await 用户.click(await screen.findByRole('button', { name: '产品经理' }));
    await screen.findByText('产品 · 产品经理');
    expect(名称框.value).toBe('产品经理');
  });

  it('打开时父表单 hidden 且正文在 wrapper 外；关闭后先回触发行焦点再还原滚动；首次挂载不抢焦点', async () => {
    const 用户 = userEvent.setup();
    render新建页();
    // 首次挂载不恢复焦点
    expect(document.activeElement).toBe(document.body);
    const 触发行 = screen.getByRole('button', { name: /职位类别/ });
    const 滚动节点 = 触发行.closest('.滚动区') as HTMLElement;
    expect(滚动节点).toBeTruthy();
    滚动节点.scrollTop = 120;
    await 用户.click(触发行);
    const 对话框 = await screen.findByRole('dialog', { name: '职位类别' });
    // 父表单 wrapper hidden + 显式 display:none；全屏正文不在 hidden 祖先里
    const 隐藏区 = document.querySelector('div[hidden]') as HTMLElement;
    expect(隐藏区).toBeTruthy();
    expect(隐藏区.style.display).toBe('none');
    expect(隐藏区.contains(对话框)).toBe(false);
    expect(screen.queryByRole('button', { name: /职位类别/ })).toBeNull();
    // Escape 关闭：wrapper 恢复显示后，焦点回触发行、滚动还原
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '职位类别' })).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /职位类别/ }));
    expect(滚动节点.scrollTop).toBe(120);
  });

  it('已发布岗位的类别行保持锁定：点击只提示，不开全屏子视图', async () => {
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    expect(await screen.findByText('发布后不可修改，如需变更请新发一个岗位')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: '职位类别' })).toBeNull();
  });
});

// ── review-r3 R3-I-5：职业分类层后端 分页 + R3-I-6 导航代际守 stale ──
describe('发布岗位页 Backend 职业分类层分页与代际（review-r3）', () => {
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

  it('根分页加载更多追加第二页（R3-I-5）', async () => {
    let 根调用 = 0;
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        根调用 += 1;
        if (根调用 === 1) {
          return {
            items: [{ id: 'cat_a', display_name: '大类A', parent_id: null, selectable: false }],
            nextCursor: 'root_cur_1',
            catalogVersion: 'v2',
          };
        }
        return {
          items: [{ id: 'cat_b', display_name: '大类B', parent_id: null, selectable: false }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_a') {
        return {
          items: [{ id: 'job_a1', display_name: 'A岗位1', parent_id: 'cat_a', selectable: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    置Backend应用状态(查询Taxonomy, vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })));
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
    // 打开职位类别弹层
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    // 等 roots 加载
    await screen.findByText('大类A');
    // 点「加载更多」→ 追加第二页
    const 加载更多 = await screen.findByRole('button', { name: '加载更多' });
    await 用户.click(加载更多);
    await screen.findByText('大类B');
    expect(screen.getByText('大类A')).toBeTruthy();
  });

  // review-r1 F5：根栏追加页返回不同 catalogVersion —— 不跨版本合并，整组从第一页静默重开
  it('根栏追加页换版本：列表重置为新版本第一页，后续游标是新版本的', async () => {
    const 页 = (items: unknown[], nextCursor: string | null, 版本: string) => ({ items, nextCursor, catalogVersion: 版本 });
    const 查询Taxonomy = vi.fn(async (
      _kind: string,
      query: { parentId?: string; cursor?: string; q?: string },
      选项?: { 强制刷新?: boolean },
    ) => {
      if (!query.parentId && !query.cursor) {
        return 选项?.强制刷新
          ? 页([{ id: 'cat_v2', display_name: '大类V2', parent_id: null, selectable: false, has_children: true }], 'root_cur_v2', 'v2')
          : 页([{ id: 'cat_a', display_name: '大类A', parent_id: null, selectable: false, has_children: true }], 'root_cur_v1', 'v1');
      }
      if (query.cursor === 'root_cur_v1') {
        // 追加页来自新快照：触发重开
        return 页([{ id: 'cat_old', display_name: '旧版本追加类', parent_id: null, selectable: false, has_children: false }], null, 'v2');
      }
      if (query.parentId === 'cat_a') {
        return 页([{ id: 'job_a1', display_name: 'A岗位1', parent_id: 'cat_a', selectable: true, has_children: false }], null, 'v2');
      }
      if (query.parentId === 'cat_v2') {
        return 页([{ id: 'job_v2', display_name: 'V2岗位', parent_id: 'cat_v2', selectable: true, has_children: false }], null, 'v2');
      }
      return 页([], null, 'v2');
    });
    置Backend应用状态(查询Taxonomy, vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })));
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    await screen.findByText('大类A');
    // 追加页换版本 → 不做 v1∪v2 合并，重开出 v2 第一页
    await 用户.click(await screen.findByRole('button', { name: '加载更多' }));
    await screen.findByText('大类V2');
    expect(screen.queryByText('旧版本追加类')).toBeNull();
    expect(screen.queryByText('大类A')).toBeNull();
    // 后续翻页用 v2 的游标
    const 重开调用数 = 查询Taxonomy.mock.calls.length;
    await 用户.click(await screen.findByRole('button', { name: '加载更多' }));
    await waitFor(() => expect(查询Taxonomy.mock.calls.length).toBeGreaterThan(重开调用数));
    expect(查询Taxonomy).toHaveBeenNthCalledWith(
      重开调用数 + 1,
      'job-categories',
      expect.objectContaining({ cursor: 'root_cur_v2' }),
    );
  });

  // review-r2：根栏追加页换版本重开时，旧版本根下的右栏子项（派生状态）同步失效，
  // 右栏按新版本第一根重新展开，不再残留旧版本子项可提交
  it('根栏追加页换版本：右栏旧版本子项失效，按新版本第一根重新展开', async () => {
    const 页 = (items: unknown[], nextCursor: string | null, 版本: string) => ({ items, nextCursor, catalogVersion: 版本 });
    const 查询Taxonomy = vi.fn(async (
      _kind: string,
      query: { parentId?: string; cursor?: string; q?: string },
      选项?: { 强制刷新?: boolean },
    ) => {
      if (!query.parentId && !query.cursor) {
        return 选项?.强制刷新
          ? 页([{ id: 'cat_v2', display_name: '大类V2', parent_id: null, selectable: false, has_children: true }], null, 'v2')
          : 页([{ id: 'cat_a', display_name: '大类A', parent_id: null, selectable: false, has_children: true }], 'root_cur_v1', 'v1');
      }
      if (query.cursor === 'root_cur_v1') {
        // 追加页来自新快照：触发根列表重开
        return 页([{ id: 'cat_old', display_name: '旧版本追加类', parent_id: null, selectable: false, has_children: false }], null, 'v2');
      }
      if (query.parentId === 'cat_a') {
        return 页([{ id: 'job_a1', display_name: 'A岗位1', parent_id: 'cat_a', selectable: true, has_children: false }], null, 'v2');
      }
      if (query.parentId === 'cat_v2') {
        return 页([{ id: 'job_v2', display_name: 'V2岗位', parent_id: 'cat_v2', selectable: true, has_children: false }], null, 'v2');
      }
      return 页([], null, 'v2');
    });
    置Backend应用状态(查询Taxonomy, vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })));
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    await screen.findByText('大类A');
    // 旧版本根的子项已载入右栏
    await screen.findByText('A岗位1');
    // 追加页换版本 → 根列表重开，右栏旧版本子项一并失效，按新版本第一根重新展开
    await 用户.click(await screen.findByRole('button', { name: '加载更多' }));
    await screen.findByText('大类V2');
    expect(screen.queryByText('A岗位1')).toBeNull();
    await screen.findByText('V2岗位');
  });

  it('快速切大类时旧响应不覆盖新子项（R3-I-6）', async () => {
    const { promise: 慢Promise, resolve: 慢Resolve } = deferred<{ items: unknown[]; nextCursor: string | null; catalogVersion: string }>();
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        return {
          items: [
            { id: 'cat_a', display_name: '大类A', parent_id: null, selectable: false },
            { id: 'cat_b', display_name: '大类B', parent_id: null, selectable: false },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_a') {
        return 慢Promise;
      }
      if (query.parentId === 'cat_b') {
        return {
          items: [{ id: 'job_b1', display_name: 'B岗位1', parent_id: 'cat_b', selectable: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    置Backend应用状态(查询Taxonomy, vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })));
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
    // 打开职位类别弹层
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    // 等 roots 加载（mount 预选大类A并触发其子项请求，但 A 的响应是慢的）
    await screen.findByText('大类A');
    // 快速切到大类B
    await 用户.click(screen.getByText('大类B'));
    // B 的子项立刻出现
    await screen.findByText('B岗位1');
    // A 的慢响应到达——不应覆盖 B 的子项
    慢Resolve({
      items: [{ id: 'job_a1', display_name: 'A岗位1（过期）', parent_id: 'cat_a', selectable: true }],
      nextCursor: null,
      catalogVersion: 'v2',
    });
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    expect(screen.getByText('B岗位1')).toBeTruthy();
    expect(screen.queryByText('A岗位1（过期）')).toBeNull();
  });

  // review-r3（Codex r3 F3）：右栏分页在飞时根换代走 选根 —— 选根 同步清 子项加载中，
  // 旧请求的 finally 因代际不符跳过清理也不至于把右栏分页永久留在 loading。
  it('右栏加载更多在飞时根换代：选根清 子项加载中，新根分页仍可用', async () => {
    const 页 = (items: unknown[], nextCursor: string | null, 版本: string) => ({ items, nextCursor, catalogVersion: 版本 });
    const { promise: 慢Promise, resolve: 慢Resolve } = deferred<{
      items: unknown[];
      nextCursor: string | null;
      catalogVersion: string;
    }>();
    const 查询Taxonomy = vi.fn(async (
      _kind: string,
      query: { parentId?: string; cursor?: string; q?: string },
      选项?: { 强制刷新?: boolean },
    ) => {
      if (!query.parentId && !query.cursor) {
        return 选项?.强制刷新
          ? 页([{ id: 'cat_v2', display_name: '大类V2', parent_id: null, selectable: false, has_children: true }], null, 'v2')
          : 页([{ id: 'cat_a', display_name: '大类A', parent_id: null, selectable: false, has_children: true }], 'root_cur_v1', 'v1');
      }
      if (query.cursor === 'root_cur_v1') {
        // 追加页来自新快照：触发根列表重开
        return 页([{ id: 'cat_old', display_name: '旧版本追加类', parent_id: null, selectable: false, has_children: false }], null, 'v2');
      }
      if (query.parentId === 'cat_a' && query.cursor === 'sub_cur_v1') {
        // 右栏分页在飞（慢响应）
        return 慢Promise;
      }
      if (query.parentId === 'cat_a') {
        return 页([{ id: 'job_a1', display_name: 'A岗位1', parent_id: 'cat_a', selectable: true, has_children: false }], 'sub_cur_v1', 'v2');
      }
      if (query.parentId === 'cat_v2' && query.cursor === 'sub_cur_v2') {
        return 页([{ id: 'job_v2_2', display_name: 'V2岗位2', parent_id: 'cat_v2', selectable: true, has_children: false }], null, 'v2');
      }
      if (query.parentId === 'cat_v2') {
        return 页([{ id: 'job_v2', display_name: 'V2岗位', parent_id: 'cat_v2', selectable: true, has_children: false }], 'sub_cur_v2', 'v2');
      }
      return 页([], null, 'v2');
    });
    置Backend应用状态(查询Taxonomy, vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })));
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    await screen.findByText('大类A');
    await screen.findByText('A岗位1');
    // 右栏分页在飞（[0]=左栏根分页，[1]=右栏子项分页）
    await 用户.click(screen.getAllByRole('button', { name: '加载更多' })[1]);
    // 根栏追加页换版本 → 重开 + 选根(新根) —— 右栏 loading 必须被同步清掉
    await 用户.click(screen.getAllByRole('button', { name: '加载更多' })[0]);
    await screen.findByText('大类V2');
    await screen.findByText('V2岗位');
    // 右栏分页键可用（不再卡在「加载中…」禁用态）
    const 右加载更多 = await waitFor(() => {
      const 键 = screen.getByRole('button', { name: '加载更多' }) as HTMLButtonElement;
      expect(键.disabled).toBe(false);
      return 键;
    });
    // 旧代右栏分页迟到写回：被导航代际作废
    慢Resolve(页([{ id: 'job_a2_old', display_name: 'A岗位2（旧）', parent_id: 'cat_a', selectable: true, has_children: false }], null, 'v2'));
    await waitFor(() => expect(screen.queryByText('A岗位2（旧）')).toBeNull());
    // 新根的右栏分页继续可用：翻页用新根的新游标
    await 用户.click(右加载更多);
    await screen.findByText('V2岗位2');
    expect(查询Taxonomy).toHaveBeenCalledWith(
      'job-categories',
      expect.objectContaining({ parentId: 'cat_v2', cursor: 'sub_cur_v2' }),
    );
  });
});
