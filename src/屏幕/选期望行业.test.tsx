// 选期望行业 Backend 接入测试（Task 4）：
// Backend 按需 查询Taxonomy('industries')，selectable=true 的叶子原子保存 期望行业们+行业引用们；
// Mock 分支保持本地 行业字典 不变。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 选期望行业 from './选期望行业';

const mock返回 = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

const 空草稿 = {
  编辑编号: null,
  求职类型: '全职' as const,
  工作城市: '',
  工作城市引用: undefined,
  期望职位: '',
  感兴趣城市们: [] as string[],
  感兴趣城市引用们: [] as string[],
  薪资下限: null,
  薪资上限: null,
  期望行业们: [] as string[],
  后端招聘类型: null,
  求职类型已改: false,
};

function render选期望行业(选项: {
  数据源: 'backend' | 'mock';
  查询Taxonomy?: ReturnType<typeof vi.fn>;
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
      意向草稿: { ...空草稿 },
    },
    派发,
  };
  render(
    <MemoryRouter>
      <选期望行业 />
    </MemoryRouter>,
  );
  return { 派发 };
}

describe('选期望行业 Backend', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('点 selectable 叶子原子保存 行业引用们', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        return {
          items: [
            { id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'ind_fin') {
        return {
          items: [
            { id: 'ind_pay', display_name: '支付与清结算', parent_id: 'ind_fin', selectable: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    const { 派发 } = render选期望行业({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    // 「金融科技」同时出现在推荐区和手风琴表头，推荐 chip 也会触发 展开根
    const 金融科技们 = await screen.findAllByText('金融科技');
    await 用户.click(金融科技们[0]);
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('industries', expect.objectContaining({ parentId: 'ind_fin' })));
    await 用户.click(await screen.findByText('支付与清结算'));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '改意向草稿',
        补丁: expect.objectContaining({
          期望行业们: ['支付与清结算'],
          行业引用们: [{ id: 'ind_pay', display_name: '支付与清结算' }],
        }),
      }),
    );
  });
});

describe('选期望行业 Mock', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('本地行业字典展开细选，保存不带引用', async () => {
    const { 派发 } = render选期望行业({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    // 展开金融科技（推荐区也有同名 chip，取手风琴表头：aria-expanded=false）
    await 用户.click(screen.getAllByText('金融科技')[1]);
    await 用户.click(await screen.findByText('支付与清结算'));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '改意向草稿',
        补丁: expect.objectContaining({ 期望行业们: ['支付与清结算'] }),
      }),
    );
    const 调用 = 派发.mock.calls.find((c) => c[0]?.型 === '改意向草稿')?.[0] as { 补丁: { 行业引用们?: unknown } };
    expect(调用.补丁.行业引用们).toBeUndefined();
  });
});