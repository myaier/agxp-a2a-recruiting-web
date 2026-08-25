// 引导问答 存引导预填测试：
// Mock 分支：期望职位题落盘带 职位引用们 占位空数组（Task 4）。
// Backend 分支（Task 6）：
//   (a) 默认字符串不会提交 —— 无选中时 refs 为空；
//   (b) 点远程候选后字符串+refs 原子写入 —— 存引导预填 带 职位引用们 含 ID；
//   (c) 同名职位不同 ID：选中 tax_selected 后 保存首次意向 body 用 tax_selected。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 引导问答 from './引导问答';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

function render引导问答Mock() {
  const 派发 = vi.fn();
  const 保存个人优势 = vi.fn(async () => {});
  const 保存首次意向 = vi.fn(async () => {});
  mock应用状态 = {
    数据源模式: 'mock',
    目录查询: null,
    状态: {
      引导预填: null,
      个人优势: '',
      简历作品集链接: '',
      简历经历: [],
      基本信息: { 真名: '沈', 开始工作年: '2017', 身份: '在职' as const },
    },
    派发,
    操作: { 保存个人优势, 保存首次意向 },
  };
  render(
    <MemoryRouter initialEntries={['/onboard/wizard?stage=salary']}>
      <引导问答 />
    </MemoryRouter>,
  );
  return { 派发, 保存个人优势, 保存首次意向 };
}

describe('引导问答 Mock 存引导预填', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('期望职位题存盘带 职位引用们 占位', async () => {
    const { 派发 } = render引导问答Mock();
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: /保存/ }));
    await waitFor(() =>
      expect(派发).toHaveBeenCalledWith(
        expect.objectContaining({
          型: '存引导预填',
          职位引用们: [],
        }),
      ),
    );
  });
});

// ── Backend 分支（Task 6）──

/** Backend 期望职位题的 mock：roots 非可选，展开 roots 出两个同名不同 ID 的可选叶子 */
function 后端查询Taxonomy桩(子项: { id: string; display_name: string; selectable: boolean }[]) {
  return vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
    if (query.parentId === 'tax_root') {
      return { items: 子项.map((项) => ({ ...项, parent_id: 'tax_root' })), nextCursor: null, catalogVersion: 'v2' };
    }
    return {
      items: [{ id: 'tax_root', display_name: '技术', parent_id: null, selectable: false }],
      nextCursor: null,
      catalogVersion: 'v2',
    };
  });
}

function render引导问答后端(选项: {
  引导预填?: object;
  查询Taxonomy?: ReturnType<typeof 后端查询Taxonomy桩>;
  查询Location?: ReturnType<typeof vi.fn>;
}) {
  const 派发 = vi.fn();
  const 保存个人优势 = vi.fn(async () => {});
  const 保存首次意向 = vi.fn(async () => {});
  mock应用状态 = {
    数据源模式: 'backend',
    目录查询: {
      查询Taxonomy: 选项.查询Taxonomy ?? 后端查询Taxonomy桩([]),
      查询Location: 选项.查询Location ?? vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
      查询Institution: vi.fn(),
    },
    状态: {
      引导预填: 选项.引导预填 ?? null,
      个人优势: '',
      简历作品集链接: '',
      简历经历: [],
      基本信息: { 真名: '沈', 开始工作年: '2017', 身份: '在校' as const },
    },
    派发,
    操作: { 保存个人优势, 保存首次意向 },
  };
  render(
    <MemoryRouter initialEntries={['/onboard/wizard?stage=salary']}>
      <引导问答 />
    </MemoryRouter>,
  );
  return { 派发, 保存个人优势, 保存首次意向 };
}

describe('引导问答 Backend 分支', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  // (a) 默认字符串不会提交：Backend 进入时已选职位 初始为空，
  // 未点候选就落盘 → 职位引用们 为空数组（不是 stale 默认）。
  it('默认字符串不会提交：无选中时 refs 为空', async () => {
    const { 派发 } = render引导问答后端({});
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: /保存/ }));
    await waitFor(() =>
      expect(派发).toHaveBeenCalledWith(
        expect.objectContaining({
          型: '存引导预填',
          职位引用们: [],
          职位: [],
        }),
      ),
    );
  });

  // (b) 点远程候选后字符串+refs 原子写入：点一个职位候选 → 存引导预填 同时带 职位（字符串）和 职位引用们（refs）。
  it('点远程候选后字符串+refs 原子写入', async () => {
    const 查询Taxonomy = 后端查询Taxonomy桩([
      { id: 'tax_selected', display_name: '产品经理', selectable: true },
      { id: 'tax_other', display_name: '产品经理', selectable: true },
    ]);
    const { 派发 } = render引导问答后端({ 查询Taxonomy });
    const 用户 = userEvent.setup();
    // 等待子项加载（两个同名「产品经理」按钮，选第一个 tax_selected）
    const 按钮 = await waitFor(() => {
      const 所有 = screen.getAllByRole('button', { name: '产品经理' });
      expect(所有.length).toBeGreaterThanOrEqual(1);
      return 所有[0];
    });
    await 用户.click(按钮);
    // 点保存落盘
    await 用户.click(screen.getByRole('button', { name: /保存/ }));
    // 字符串 和 refs 原子写入：职位 有 display_name，职位引用们 有 id
    await waitFor(() =>
      expect(派发).toHaveBeenCalledWith(
        expect.objectContaining({
          型: '存引导预填',
          职位: ['产品经理'],
          职位引用们: [{ id: 'tax_selected', display_name: '产品经理' }],
        }),
      ),
    );
  });

  // (c) 同名职位不同 ID：选中 tax_selected 后 保存首次意向 body 用 tax_selected。
  // 引导预填=null + preference 段（非在校）→ 题序 = 期望职位 → 工作城市 → 硬性排除 → 个人优势。
  it('同名职位不同 ID：完整向导流保存首次意向 用选中 ID', async () => {
    const 查询Taxonomy = 后端查询Taxonomy桩([
      { id: 'tax_selected', display_name: '产品经理', selectable: true },
      { id: 'tax_other', display_name: '产品经理', selectable: true },
    ]);
    const 查询Location = vi.fn(async (query: { q?: string }) => ({
      items: query.q && query.q.includes('上海')
        ? [{ id: 'loc_sh', display_name: '上海市', country_code: 'CN', country_name: '中国', admin1_code: '31', admin1_name: '上海市', timezone: 'Asia/Shanghai', population: 0 }]
        : [],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    const 派发 = vi.fn();
    const 保存个人优势 = vi.fn(async () => {});
    const 保存首次意向 = vi.fn(async () => {});
    mock应用状态 = {
      数据源模式: 'backend',
      目录查询: { 查询Taxonomy, 查询Location, 查询Institution: vi.fn() },
      状态: {
        引导预填: null,
        个人优势: '',
        简历作品集链接: '',
        简历经历: [],
        // 非在校 + preference 段 → 题序 = 期望职位 → 工作城市 → 硬性排除 → 个人优势
        基本信息: { 真名: '沈', 开始工作年: '2017', 身份: '离职' as const },
      },
      派发,
      操作: { 保存个人优势, 保存首次意向 },
    };
    render(
      <MemoryRouter initialEntries={['/onboard/wizard?stage=preference']}>
        <引导问答 />
      </MemoryRouter>,
    );
    const 用户 = userEvent.setup();
    // 第一题期望职位：等子项加载，选 tax_selected（第一个产品经理）
    const 职位按钮 = await waitFor(() => {
      const 所有 = screen.getAllByRole('button', { name: '产品经理' });
      expect(所有.length).toBeGreaterThanOrEqual(1);
      return 所有[0];
    });
    await 用户.click(职位按钮);
    await 用户.click(screen.getByRole('button', { name: /保存/ }));
    // 第二题工作城市：搜索 '上海'，等 debounce 后结果出现，点选
    await waitFor(() => expect(screen.getByPlaceholderText('搜索城市')).toBeDefined());
    await 用户.type(screen.getByPlaceholderText('搜索城市'), '上海');
    // 等待 250ms debounce + 查询结果
    const 城市按钮 = await waitFor(() => {
      const 所有 = screen.getAllByRole('button', { name: '上海市' });
      expect(所有.length).toBeGreaterThanOrEqual(1);
      return 所有[0];
    }, { timeout: 3000 });
    await 用户.click(城市按钮);
    await 用户.click(screen.getByRole('button', { name: /保存/ }));
    // 第三题硬性排除：下一步
    await waitFor(() => expect(screen.getByRole('button', { name: '下一步' })).toBeDefined());
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    // 第四题个人优势：保存并继续
    await waitFor(() => expect(screen.getByRole('button', { name: '保存并继续' })).toBeDefined());
    await 用户.click(screen.getByRole('button', { name: '保存并继续' }));
    await waitFor(() => expect(保存首次意向).toHaveBeenCalled());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const 传入 = (保存首次意向.mock.calls[0] as any[])[0];
    expect(传入.职位引用).toEqual({ id: 'tax_selected', display_name: '产品经理' });
    expect(传入.城市引用们).toEqual([{ id: 'loc_sh', display_name: '上海市' }]);
  });
});