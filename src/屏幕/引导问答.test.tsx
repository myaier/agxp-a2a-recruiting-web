// 引导问答 存引导预填测试：
// Mock 分支：期望职位题落盘带 职位引用们 占位空数组（Task 4）。
// Backend 分支（Task 6）：
//   (a) 默认字符串不会提交 —— 无选中时 refs 为空；
//   (b) 点远程候选后字符串+refs 原子写入 —— 存引导预填 带 职位引用们 含 ID；
//   (c) 同名职位不同 ID：选中 tax_selected 后 保存首次意向 body 用 tax_selected。

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 引导问答 from './引导问答';
import { 路径 } from '../路由/路径表';
import type { 向导段 } from '../流程/onboarding配置';
import { 构造映射变体基底 } from '../数据/招聘数据源/简历预填.fixture';
import { 创建空候选预填状态, type 候选预填Eligibility, type 候选预填状态 } from '../状态/后端/类型';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock操作 = vi.hoisted(() => ({
  保存个人优势: vi.fn(async () => {}),
  保存首次意向: vi.fn(async () => {}),
  确认候选Onboarding预填分区: vi.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

/** deferred promise：测试可控制异步 resolve 的时机（用于模拟慢响应到达） */
function deferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((ok) => { resolve = ok; });
  return { promise, resolve };
}

/** 引导预填 可选：传非 null 时已有预填（题序塌到只剩当前段），不传就是全量五题 */
function render引导问答Mock(引导预填: object | null = null) {
  const 派发 = vi.fn();
  const 保存个人优势 = vi.fn(async () => {});
  const 保存首次意向 = vi.fn(async () => {});
  mock应用状态 = {
    数据源模式: 'mock',
    目录查询: null,
    状态: {
      引导预填,
      个人优势: '',
      简历作品集链接: '',
      简历经历: [],
      基本信息: { 真名: '沈', 开始工作年: '2017', 身份: '在职' as const },
    },
    派发,
    操作: { 保存个人优势, 保存首次意向, 确认候选Onboarding预填分区: vi.fn() },
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

// ── 期望薪资 双滚轮的可访问合同（Task 3）──
// 传「无 薪资 键」的预填：已有引导预填 让题序塌到只剩 期望薪资，缺的薪资仍以 面议(0/0) 起步。
// 这三条用例守住 onboarding 薪资的状态合同；内嵌双滚轮.test.tsx 继续守住共享 Hook 的
// 键盘 / 滚动 / 重复写值矩阵。

const 月薪题预填 = {
  城市们: [], 职位: [], 城市引用们: [], 职位引用们: [],
  筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['现场'] },
};

describe('引导问答 期望薪资 双滚轮 可访问合同', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('onboarding 薪资双轮支持键盘和直接点选并保存同一值', async () => {
    const { 派发 } = render引导问答Mock(月薪题预填);
    const 用户 = userEvent.setup();
    const 下限列 = screen.getByRole('listbox', { name: '最低月薪' });

    下限列.focus();
    await 用户.keyboard('{ArrowDown}');
    expect(within(下限列).getByRole('option', { name: '1' }).getAttribute('aria-selected'))
      .toBe('true');
    await 用户.click(within(下限列).getByRole('option', { name: '20' }));
    expect(document.activeElement).toBe(下限列);

    const 上限列 = screen.getByRole('listbox', { name: '最高月薪' });
    await 用户.click(within(上限列).getByRole('option', { name: '30' }));
    await 用户.click(screen.getByRole('button', { name: /下一步/ }));
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({
      型: '存薪资预填', 下限: 20, 上限: 30, 单位: '月薪K',
    }));
  });

  it('onboarding 下限回到面议时保持现有 0/0 与隐藏上限合同', async () => {
    const { 派发 } = render引导问答Mock(月薪题预填);
    const 用户 = userEvent.setup();
    const 下限列 = screen.getByRole('listbox', { name: '最低月薪' });
    await 用户.click(within(下限列).getByRole('option', { name: '20' }));
    expect(screen.getByRole('listbox', { name: '最高月薪' })).toBeTruthy();
    await 用户.click(within(下限列).getByRole('option', { name: '面议' }));
    expect(screen.queryByRole('listbox', { name: '最高月薪' })).toBeNull();
    await 用户.click(screen.getByRole('button', { name: /下一步/ }));
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({
      型: '存薪资预填', 下限: 0, 上限: 0, 单位: '月薪K',
    }));
  });

  it('onboarding 日薪档继续使用元每天单位并接入同一键盘合同', async () => {
    const { 派发 } = render引导问答Mock({
      城市们: [], 职位: [], 城市引用们: [], 职位引用们: [],
      筛选偏好: { 求职类型: ['实习生'], 办公方式: ['混合'] },
      薪资: { 下限: 300, 上限: 500, 单位: '元/天' },
    });
    const 用户 = userEvent.setup();
    const 下限列 = screen.getByRole('listbox', { name: '最低日薪' });
    下限列.focus();
    await 用户.keyboard('{ArrowDown}');
    expect(within(下限列).getByRole('option', { name: '320' }).getAttribute('aria-selected'))
      .toBe('true');
    await 用户.click(screen.getByRole('button', { name: /下一步/ }));
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({
      型: '存薪资预填', 下限: 320, 单位: '元/天',
    }));
  });
});

// ── Backend 分支（Task 6）──

/** Backend 期望职位题的 mock：roots 非可选，展开 roots 出两个同名不同 ID 的可选叶子 */
function 后端查询Taxonomy桩(子项: { id: string; display_name: string; selectable: boolean }[]) {
  return vi.fn(async (_kind: string, query: { parentId?: string; q?: string; cursor?: string }) => {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  查询Taxonomy?: any;
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
    操作: { 保存个人优势, 保存首次意向, 确认候选Onboarding预填分区: vi.fn() },
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
      操作: { 保存个人优势, 保存首次意向, 确认候选Onboarding预填分区: vi.fn() },
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

// ── review-r3 R3-I-5/I-6/I-7：期望职位题 分页 + 代际守 stale + 查询重置 ──

describe('引导问答 Backend 期望职位题 分页与代际（review-r3）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  // review-r3 R3-I-5：roots 返回 nextCursor 时可加载更多，第二页 dedup 合并
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
    render引导问答后端({ 查询Taxonomy });
    const 用户 = userEvent.setup();
    await screen.findByText('大类A');
    const 加载更多 = await screen.findByRole('button', { name: '加载更多' });
    await 用户.click(加载更多);
    await screen.findByText('大类B');
    expect(screen.getByText('大类A')).toBeTruthy();
  });

  // review-r3 R3-I-6：搜索 stale——输 A 慢响应在飞行中，再输 B 快响应到达 → B 胜
  it('搜索 stale：A 慢响应不覆盖 B 结果（R3-I-6）', async () => {
    const { promise: 慢Promise, resolve: 慢Resolve } = deferredPromise<{ items: unknown[]; nextCursor: string | null; catalogVersion: string }>();
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string; cursor?: string }) => {
      if (!query.parentId && !query.q && !query.cursor) {
        return {
          items: [{ id: 'cat_root', display_name: '技术', parent_id: null, selectable: false }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_root') {
        return {
          items: [{ id: 'job_r1', display_name: '后端', parent_id: 'cat_root', selectable: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.q === 'A') {
        return 慢Promise;
      }
      if (query.q === 'AB') {
        return {
          items: [{ id: 'job_ab', display_name: 'AB岗位', parent_id: null, selectable: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render引导问答后端({ 查询Taxonomy });
    const 用户 = userEvent.setup();
    await screen.findByText('技术');
    // 搜索「A」——慢响应在飞行中
    await 用户.type(screen.getByPlaceholderText('搜索职位 / 方向'), 'A');
    // 等 debounce 触发
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ q: 'A' })));
    // 快速续输成「AB」——快响应到达
    await 用户.type(screen.getByPlaceholderText('搜索职位 / 方向'), 'B');
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ q: 'AB' })), { timeout: 3000 });
    await screen.findByText('AB岗位');
    // A 的慢响应到达——不应覆盖 AB 的结果
    慢Resolve({
      items: [{ id: 'job_a', display_name: 'A岗位（过期）', parent_id: null, selectable: true }],
      nextCursor: null,
      catalogVersion: 'v2',
    });
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    expect(screen.getByText('AB岗位')).toBeTruthy();
    expect(screen.queryByText('A岗位（过期）')).toBeNull();
  });

  // review-r3 R3-I-6 P2-3：搜索模式下点非 selectable 命中 → 清空搜索词 → 子项可见
  it('搜索点非 selectable 命中后退出搜索模式显示子项（R3-I-6 P2-3）', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string; cursor?: string }) => {
      if (!query.parentId && !query.q && !query.cursor) {
        return {
          items: [{ id: 'cat_tech', display_name: '互联网', parent_id: null, selectable: false }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.q === '互联') {
        return {
          items: [{ id: 'cat_tech', display_name: '互联网', parent_id: null, selectable: false }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_tech') {
        return {
          items: [{ id: 'job_be', display_name: '后端开发', parent_id: 'cat_tech', selectable: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render引导问答后端({ 查询Taxonomy });
    const 用户 = userEvent.setup();
    await screen.findByText('互联网');
    await 用户.type(screen.getByPlaceholderText('搜索职位 / 方向'), '互联');
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ q: '互联' })));
    await screen.findByText('互联网');
    // 点非 selectable 命中 → 退出搜索模式 → 子项「后端开发」出现
    await 用户.click(screen.getByText('互联网'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ parentId: 'cat_tech' })));
    await screen.findByText('后端开发');
  });

  // review-r3 R3-I-7：查询变化时重置分页状态——搜索 A 有结果+游标 → 搜索 B → A 的结果/游标清空
  it('查询变化重置分页状态：A 结果被 B 替换（R3-I-7）', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string; cursor?: string }) => {
      if (!query.parentId && !query.q && !query.cursor) {
        return {
          items: [{ id: 'cat_root', display_name: '技术', parent_id: null, selectable: false }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_root') {
        return {
          items: [{ id: 'job_r1', display_name: '后端', parent_id: 'cat_root', selectable: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.q === 'A') {
        return {
          items: [{ id: 'job_a', display_name: 'A岗位', parent_id: null, selectable: true }],
          nextCursor: 'a_cur_1',
          catalogVersion: 'v2',
        };
      }
      if (query.q === 'B') {
        return {
          items: [{ id: 'job_b', display_name: 'B岗位', parent_id: null, selectable: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render引导问答后端({ 查询Taxonomy });
    const 用户 = userEvent.setup();
    await screen.findByText('技术');
    // 搜索 A → 结果 + 游标
    await 用户.type(screen.getByPlaceholderText('搜索职位 / 方向'), 'A');
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ q: 'A' })));
    await screen.findByText('A岗位');
    expect(screen.getByRole('button', { name: '加载更多' })).toBeTruthy();
    // 清空并搜索 B → A 的结果和游标被重置
    await 用户.clear(screen.getByPlaceholderText('搜索职位 / 方向'));
    await 用户.type(screen.getByPlaceholderText('搜索职位 / 方向'), 'B');
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ q: 'B' })), { timeout: 3000 });
    await screen.findByText('B岗位');
    expect(screen.queryByText('A岗位')).toBeNull();
    // B 无游标 → 不应出现「加载更多」
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();
  });
});

// ── 候选 onboarding 简历预填的个人优势（Spec §8 /wizard 偏好段，Task 6）──
// draft.summary 只在偏好段的个人优势题作为初值；确认 summary 分区紧跟 保存个人优势
// 成功，与随后的首次意向请求成败无关。

const 全可预填: 候选预填Eligibility = {
  profile: { real_name: true, work_start_year: true, gender: true, birth_year: true, birth_month: true, current_education: true },
  summary: true,
  skills: true,
  experiences: true,
  educations: true,
  certificates: true,
};

/** ready 轮 fixture（与 Task 2 映射测试同款形状）：wire fixture 深拷贝基底。 */
function readySummary(): 候选预填状态 {
  const 建议 = 构造映射变体基底();
  return {
    ...创建空候选预填状态(),
    phase: 'ready',
    source: 建议.source,
    eligibility: 全可预填,
    suggestion: 建议,
  };
}

/** 非空 引导预填：偏好段题序塌到 硬性排除 → 个人优势（期望职位/工作城市 已在完善资料采过） */
const 已采前两题 = {
  城市们: [], 职位: [], 城市引用们: [], 职位引用们: [],
  筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['现场'] },
};

function render引导问答(选项: { 段: 向导段; 预填?: 候选预填状态; 个人优势?: string }) {
  mock应用状态 = {
    数据源模式: 'backend',
    目录查询: {
      查询Taxonomy: vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
      查询Location: vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
      查询Institution: vi.fn(),
    },
    状态: {
      引导预填: 已采前两题,
      个人优势: 选项.个人优势 ?? '',
      简历作品集链接: '',
      简历经历: [],
      // 非在校：偏好段题序 = 硬性排除 → 个人优势
      基本信息: { 真名: '沈', 开始工作年: '2017', 身份: '离职' as const },
    },
    后端状态: { 候选预填状态: 选项.预填 ?? 创建空候选预填状态() },
    派发: vi.fn(),
    操作: mock操作,
  };
  render(
    <MemoryRouter initialEntries={[`/onboard/wizard?stage=${选项.段 === '薪资段' ? 'salary' : 'preference'}`]}>
      <引导问答 />
    </MemoryRouter>,
  );
}

/** 个人优势题 textarea */
function 优势框(): HTMLTextAreaElement {
  return screen.getByLabelText('个人优势') as HTMLTextAreaElement;
}

/** 从偏好段首题（硬性排除）推进到个人优势题并提交 */
async function 提交到个人优势题() {
  const 用户 = userEvent.setup();
  await 用户.click(screen.getByRole('button', { name: '下一步' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '保存并继续' })).toBeDefined());
  await 用户.click(screen.getByRole('button', { name: '保存并继续' }));
  await waitFor(() => expect(mock操作.保存首次意向).toHaveBeenCalled());
}

describe('引导问答 个人优势预填（Spec §8 偏好段）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock操作.保存个人优势.mockReset().mockResolvedValue(undefined);
    mock操作.保存首次意向.mockReset().mockResolvedValue(undefined);
    mock操作.确认候选Onboarding预填分区.mockReset();
  });

  it('偏好段空白时种入 summary 作为个人优势初值，保存个人优势携带预填文本', async () => {
    render引导问答({ 段: '偏好段', 预填: readySummary() });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(优势框().value).toBe('Builds reliable synthetic systems.');
    await 用户.click(screen.getByRole('button', { name: '保存并继续' }));
    await waitFor(() => expect(mock操作.保存个人优势).toHaveBeenCalledWith('Builds reliable synthetic systems.'));
  });

  it('薪资段不问个人优势题（summary 不在社招首次薪资段应用）', () => {
    render引导问答({ 段: '薪资段', 预填: readySummary() });
    expect(screen.queryByLabelText('个人优势')).toBeNull();
  });

  it('当前已有个人优势时保留（页面现值优先）', async () => {
    render引导问答({ 段: '偏好段', 预填: readySummary(), 个人优势: '我自己写的介绍' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(优势框().value).toBe('我自己写的介绍');
  });

  it.each([
    ['manual 轮', (轮: 候选预填状态) => { 轮.phase = 'manual'; }],
    ['summary 已确认', (轮: 候选预填状态) => { 轮.confirmed.summary = true; }],
    ['inactive 轮（无建议）', null],
  ])('%s 保留旧初始化（个人优势为空）', async (_名, 改) => {
    const 轮 = readySummary();
    if (改) 改(轮);
    render引导问答({ 段: '偏好段', 预填: 改 ? 轮 : undefined });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(优势框().value).toBe('');
  });

  it('confirms summary after summary save even when first intention fails', async () => {
    mock操作.保存个人优势.mockResolvedValue(undefined);
    mock操作.保存首次意向.mockRejectedValue(new Error('offline'));
    render引导问答({ 段: '偏好段', 预填: readySummary() });
    await 提交到个人优势题();
    expect(mock操作.确认候选Onboarding预填分区).toHaveBeenCalledWith('summary');
    // 确认发生在 保存个人优势 成功之后、首次意向尝试之前；首次意向失败不回滚
    expect(mock操作.保存个人优势.mock.invocationCallOrder[0])
      .toBeLessThan(mock操作.确认候选Onboarding预填分区.mock.invocationCallOrder[0]);
    expect(mock操作.确认候选Onboarding预填分区.mock.invocationCallOrder[0])
      .toBeLessThan(mock操作.保存首次意向.mock.invocationCallOrder[0]);
    // 首次意向失败：不跳转，错误走 轻提示
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('保存个人优势被拒时 summary 不确认、不发首次意向', async () => {
    mock操作.保存个人优势.mockRejectedValue(new Error('保存失败'));
    render引导问答({ 段: '偏好段', 预填: readySummary() });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await 用户.click(screen.getByRole('button', { name: '保存并继续' }));
    await waitFor(() => expect(mock操作.保存个人优势).toHaveBeenCalledTimes(1));
    // catch 分支已跑完（真实 轻提示 落错误文案）后再做否定断言
    await waitFor(() => expect(document.body.textContent).toContain('请求失败，请稍后再试'));
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    expect(mock操作.保存首次意向).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('成功路径：summary 确认后保存首次意向并跳转披露说明', async () => {
    render引导问答({ 段: '偏好段', 预填: readySummary() });
    await 提交到个人优势题();
    await waitFor(() => expect(mock跳转).toHaveBeenCalledWith(路径.披露说明));
    expect(mock操作.确认候选Onboarding预填分区).toHaveBeenCalledTimes(1);
  });
});