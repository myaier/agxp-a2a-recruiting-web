// 选期望职位 Backend 接入测试（Task 4）：
// Backend 按需 查询Taxonomy('job-categories')：首次读 roots，展开按 parentId，搜索按 q；
// selectable=true 的叶子原子保存 {id,display_name}+字符串。
// Mock 分支保持本地 职业分类树 不变。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 选期望职位 from './选期望职位';

const mock返回 = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

function render选期望职位(选项: {
  数据源: 'backend' | 'mock';
  来源?: '意向' | null;
  查询Taxonomy?: ReturnType<typeof vi.fn>;
  引导预填?: { 城市们: string[]; 职位: string[]; 城市引用们?: unknown[] };
  意向草稿?: { 期望职位: string };
}) {
  const 派发 = vi.fn();
  mock应用状态 = {
    数据源模式: 选项.数据源,
    目录查询:
      选项.数据源 === 'backend'
        ? {
            查询Location: vi.fn(),
            查询Taxonomy: 选项.查询Taxonomy ?? vi.fn(),
            查询Institution: vi.fn(),
          }
        : null,
    状态: {
      引导预填: 选项.引导预填 ?? { 城市们: ['上海'], 职位: [] },
      意向草稿: 选项.意向草稿 ?? { 期望职位: '' },
    },
    派发,
  };
  const 初始 = 选项.来源 ? [`/onboard/job?来源=${选项.来源}`] : ['/onboard/job'];
  render(
    <MemoryRouter initialEntries={初始}>
      <选期望职位 />
    </MemoryRouter>,
  );
  return { 派发 };
}

describe('选期望职位 Backend', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('意向来源点 selectable 叶子保存 职位引用', async () => {
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
    const { 派发 } = render选期望职位({ 数据源: 'backend', 来源: '意向', 查询Taxonomy });
    const 用户 = userEvent.setup();
    // 展开大类
    await 用户.click(await screen.findByText('互联网/AI'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ parentId: 'cat_tech' })));
    // 点 selectable 叶子
    await 用户.click(await screen.findByText('后端开发'));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '改意向草稿',
        补丁: expect.objectContaining({
          期望职位: '后端开发',
          职位引用: { id: 'job_be', display_name: '后端开发' },
        }),
      }),
    );
  });

  it('多选来源保存 职位引用们', async () => {
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
    const { 派发 } = render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.click(await screen.findByText('互联网/AI'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ parentId: 'cat_tech' })));
    await 用户.click(await screen.findByText('后端开发'));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        职位: ['后端开发'],
        职位引用们: [{ id: 'job_be', display_name: '后端开发' }],
      }),
    );
  });

  // review-r1 P2-3：搜索模式下点非 selectable 命中 → 清空搜索词退出搜索模式 →
  // 双栏视图显示其子项，子项可选。
  it('搜索点非 selectable 命中后退出搜索模式显示子项（P2-3）', async () => {
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
      if (query.q && query.q.includes('互联') && !query.parentId) {
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
    const { 派发 } = render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    // 等待 roots 加载
    await screen.findByText('互联网/AI');
    // 搜索「互联」→ 搜索结果里出现「互联网/AI」（非 selectable）
    await 用户.type(screen.getByPlaceholderText('搜索职位'), '互联');
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ q: '互联' })));
    await screen.findByText('互联网/AI');
    // 点非 selectable 命中 → 退出搜索模式 → 子项「后端开发」出现且可选
    await 用户.click(screen.getByText('互联网/AI'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ parentId: 'cat_tech' })));
    await screen.findByText('后端开发');
    // 点 selectable 子项 → 保存
    await 用户.click(screen.getByText('后端开发'));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        职位: ['后端开发'],
        职位引用们: [{ id: 'job_be', display_name: '后端开发' }],
      }),
    );
  });
});

describe('选期望职位 Mock', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('本地职业分类树渲染，保存带空引用数组', async () => {
    const { 派发 } = render选期望职位({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    // 左栏第一枚大类按钮
    await 用户.click(screen.getByText('互联网/AI'));
    // 右栏点一个岗位
    await 用户.click(await screen.findByText('Java'));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        职位: ['Java'],
        职位引用们: [],
      }),
    );
  });
});