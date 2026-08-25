// 发布岗位页 Backend 提交测试（Task 7）：
// 编辑保存成功前不导航；await 操作.更新岗位 落定后才返回。
// Backend 选择器：选类别候选 + 选城市候选 → 发布带 类别引用/地点引用（id+display_name）；
// 手输城市不选候选 → 发布被拦（操作.发布岗位 不调用）。
// Mock 下 操作 内部同步 dispatch，DOM/流程由现有 onboarding E2E 覆盖。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 发布岗位 from './发布岗位';
import { 页面岗位样本 } from '../测试/BFF样本';

const mock返回 = vi.fn();
const mock进企业主壳 = vi.fn();
const mock替换跳转 = vi.fn();
const mock跳转 = vi.fn();
const mock更新岗位 = vi.fn();
const mock发布岗位 = vi.fn();
const mock删除岗位 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({
    返回: mock返回,
    进企业主壳: mock进企业主壳,
    替换跳转: mock替换跳转,
    跳转: mock跳转,
  }),
}));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** 默认 Mock 模式桩：数据源模式 undefined → 是后端=false，与原 Mock 测试同形 */
function 置Mock应用状态() {
  mock应用状态 = {
    状态: { 岗位列表: [页面岗位样本], 企业候选列表: [] },
    派发: vi.fn(),
    操作: { 更新岗位: mock更新岗位, 发布岗位: mock发布岗位, 删除岗位: mock删除岗位 },
  };
}

/** Backend 桩：数据源模式 'backend' + 目录查询 seam（查询Taxonomy/查询Location 可注入） */
function 置Backend应用状态(查询Taxonomy: ReturnType<typeof vi.fn>, 查询Location: ReturnType<typeof vi.fn>) {
  mock应用状态 = {
    状态: { 岗位列表: [页面岗位样本], 企业候选列表: [] },
    派发: vi.fn(),
    操作: { 更新岗位: mock更新岗位, 发布岗位: mock发布岗位, 删除岗位: mock删除岗位 },
    数据源模式: 'backend',
    目录查询: {
      查询Taxonomy,
      查询Location,
      查询Institution: vi.fn(),
    },
  };
}

describe('发布岗位页 Backend 提交', () => {
  beforeEach(() => {
    mock返回.mockClear();
    mock进企业主壳.mockClear();
    mock替换跳转.mockClear();
    mock跳转.mockClear();
    mock更新岗位.mockClear();
    mock发布岗位.mockClear();
    mock删除岗位.mockClear();
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
});

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

  const 查询Location = vi.fn(async () => ({
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
  }));

  beforeEach(() => {
    mock返回.mockClear();
    mock进企业主壳.mockClear();
    mock替换跳转.mockClear();
    mock跳转.mockClear();
    mock更新岗位.mockClear();
    mock发布岗位.mockClear();
    mock删除岗位.mockClear();
    查询Taxonomy.mockClear();
    查询Location.mockClear();
    mock发布岗位.mockResolvedValue(undefined);
    置Backend应用状态(查询Taxonomy, 查询Location);
  });

  /** 把三步向导填到「只差点发布」的状态，返回候选城市按钮（已出现但未点）。
   *  选城市=false 时只输入不选；选城市=true 时点候选，落 地点引用。 */
  async function 填到发布前(选城市: boolean) {
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );

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

    // ── 第二步：职位描述 ──
    await 用户.type(screen.getByLabelText('职位描述'), '负责交易网关与撮合核心');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));

    // ── 第三步：职位要求 ──
    await 用户.type(screen.getByLabelText('薪资下限'), '50');
    await 用户.type(screen.getByLabelText('薪资上限'), '65');
    // 年薪月数（社招全职必填）：打开滚轮 → 完成（默认 12）
    await 用户.click(screen.getByRole('button', { name: /年薪月数/ }));
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    // 办公地点
    await 用户.type(
      screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层'),
      '张江路 1 号',
    );
    // 职位要求
    await 用户.type(screen.getByLabelText('职位要求'), '五年以上后端经验');
    // 工作城市：输入触发 250ms debounce 候选查询
    await 用户.type(
      screen.getByPlaceholderText('搜索城市名，从下方候选选择'),
      '上海',
    );
    const 候选键 = await screen.findByRole('button', { name: '上海' }, { timeout: 2000 });
    if (选城市) {
      await 用户.click(候选键);
    }
    return { 用户 };
  }

  it('选类别候选 + 选城市候选 → 发布带 类别引用/地点引用', async () => {
    const { 用户 } = await 填到发布前(true);
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));

    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    const 传入 = mock发布岗位.mock.calls[0][0];
    expect(传入.类别引用).toEqual({ id: 'job_be', display_name: '后端开发' });
    expect(传入.地点引用).toEqual({ id: 'loc_shanghai', display_name: '上海' });
  });

  it('手输城市不选候选 → 发布被拦（操作.发布岗位 不调用）', async () => {
    const { 用户 } = await 填到发布前(false);
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));

    expect(mock发布岗位).not.toHaveBeenCalled();
    expect(await screen.findByText('请从候选城市中选择')).toBeTruthy();
  });
});