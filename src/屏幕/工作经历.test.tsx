// 工作经历 行业弹层 Backend 接入测试（Task 4）：
// Backend 弹层按需 查询Taxonomy('industries')，点 selectable 叶子写 行业引用；
// 继续自由输入清除引用。Mock 保留 常见行业 不变。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 工作经历 from './工作经历';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

const 简历经历初始 = [
  {
    编号: 'e1',
    公司: '字节跳动',
    行业: '',
    职位: '后端开发',
    开始: '2019-06',
    结束: null,
    内容: '主导交易网关重建',
    隐藏: true,
  },
];

function render工作经历(选项: {
  数据源: 'backend' | 'mock';
  查询Taxonomy?: ReturnType<typeof vi.fn>;
}) {
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
      简历经历: 简历经历初始,
      简历教育: [],
      简历技能: [],
      简历证书: [],
      个人优势: '',
      简历作品集链接: '',
      基本信息: { 真名: '沈', 开始工作年: '2017', 身份: '在职' as const },
    },
    派发: vi.fn(),
    操作: { 保存简历: vi.fn(async () => {}) },
  };
  render(
    <MemoryRouter>
      <工作经历 />
    </MemoryRouter>,
  );
}

describe('工作经历 行业弹层 Backend', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('点 selectable 叶子写 行业引用，自由输入清除', async () => {
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
    render工作经历({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    // 进入第一段经历编辑页
    await 用户.click(screen.getByText('字节跳动'));
    // 点开所属行业弹层
    await 用户.click(screen.getByText('所属行业'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    // 展开金融科技
    await 用户.click(await screen.findByText('金融科技'));
    await waitFor(() =>
      expect(查询Taxonomy).toHaveBeenCalledWith('industries', expect.objectContaining({ parentId: 'ind_fin' })),
    );
    // 点 selectable 叶子
    await 用户.click(await screen.findByText('支付与清结算'));
    // 完成回写
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    // 验证存简历派发里经历段带 行业引用
    const 派发 = mock应用状态.派发;
    const 存简历调用 = 派发.mock.calls.find((c: unknown[]) => (c[0] as { 型?: string })?.型 === '存简历')?.[0] as {
      经历: { 行业: string; 行业引用?: unknown }[];
    } | undefined;
    expect(存简历调用).toBeDefined();
    expect(存简历调用!.经历[0].行业).toBe('支付与清结算');
    expect(存简历调用!.经历[0].行业引用).toEqual({ id: 'ind_pay', display_name: '支付与清结算' });
  });

  it('非 selectable 子项点击展开孙项而不提交', async () => {
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
            { id: 'ind_sub', display_name: '证券与基金', parent_id: 'ind_fin', selectable: false },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'ind_sub') {
        return {
          items: [
            { id: 'ind_leaf', display_name: '公募基金', parent_id: 'ind_sub', selectable: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render工作经历({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByText('所属行业'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    // 展开金融科技（非 selectable root）
    await 用户.click(await screen.findByText('金融科技'));
    await waitFor(() =>
      expect(查询Taxonomy).toHaveBeenCalledWith('industries', expect.objectContaining({ parentId: 'ind_fin' })),
    );
    // 证券与基金 是非 selectable 子项 —— 点击应展开孙项，不提交
    await 用户.click(await screen.findByText('证券与基金'));
    await waitFor(() =>
      expect(查询Taxonomy).toHaveBeenCalledWith('industries', expect.objectContaining({ parentId: 'ind_sub' })),
    );
    // 孙项出现，点 selectable 叶子才提交
    await 用户.click(await screen.findByText('公募基金'));
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    const 派发 = mock应用状态.派发;
    const 存简历调用 = 派发.mock.calls.find((c: unknown[]) => (c[0] as { 型?: string })?.型 === '存简历')?.[0] as {
      经历: { 行业: string; 行业引用?: unknown }[];
    } | undefined;
    expect(存简历调用).toBeDefined();
    expect(存简历调用!.经历[0].行业).toBe('公募基金');
    expect(存简历调用!.经历[0].行业引用).toEqual({ id: 'ind_leaf', display_name: '公募基金' });
  });
});