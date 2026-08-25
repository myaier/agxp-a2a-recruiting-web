// 选工作城市 Backend 接入测试（Task 3）：
// 守住 Backend 城市选择器按需查 Location（省标题不进入 payload）+ 搜索发 q；
// Mock 分支本地城市字典与 DOM 不变，保存带空引用数组。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 选工作城市 from './选工作城市';

const mock返回 = vi.fn();
// vi.mock 工厂在 import 时执行，用可变 holder 让每个用例注入不同的应用状态值
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any = {};

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

/** 空意向草稿（含 Task 3 新增的可选引用字段）*/
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

function render城市页(选项: {
  数据源: 'backend' | 'mock';
  查询Location?: ReturnType<typeof vi.fn>;
}) {
  const 派发 = vi.fn();
  mock应用状态 = {
    数据源模式: 选项.数据源,
    目录查询:
      选项.数据源 === 'backend'
        ? {
            查询Location: 选项.查询Location ?? vi.fn(),
            查询Taxonomy: vi.fn(),
            查询Institution: vi.fn(),
          }
        : null,
    状态: {
      引导预填: { 城市们: [] as string[], 职位: [] as string[] },
      意向草稿: { ...空草稿 },
    },
    派发,
  };
  render(
    <MemoryRouter>
      <选工作城市 />
    </MemoryRouter>,
  );
  return { 派发 };
}

describe('选工作城市 Backend', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('点击上海保存 Location ID，省标题不进入值', async () => {
    const 查询Location = vi.fn(async () => ({
      items: [
        {
          id: 'loc_sh',
          display_name: '上海市',
          country_code: 'CN',
          country_name: '中国',
          admin1_code: '31',
          admin1_name: '上海市',
          timezone: 'Asia/Shanghai',
          population: 24870000,
        },
      ],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    const { 派发 } = render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('直辖市'));
    expect(查询Location).toHaveBeenCalledWith(
      expect.objectContaining({ countryCode: 'CN', admin1Code: '31' }),
    );
    await 用户.click(await screen.findByText('上海市'));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        城市引用们: [{ id: 'loc_sh', display_name: '上海市' }],
      }),
    );
  });

  it('搜索发送 q 而不扫描本地城市字典', async () => {
    const 查询Location = vi.fn(async () => ({
      items: [],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    render城市页({ 数据源: 'backend', 查询Location });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByPlaceholderText('搜索城市 / 省份'), '杭州市');
    await waitFor(() =>
      expect(查询Location).toHaveBeenCalledWith(
        expect.objectContaining({ q: '杭州市' }),
      ),
    );
  });
});

describe('选工作城市 Mock', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('本地城市字典与 DOM 不变，保存带空引用数组', async () => {
    const { 派发 } = render城市页({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    // 「上海」在当前定位 / 热门城市 / 直辖市 三处都出现，取第一枚点选
    await 用户.click(screen.getAllByText('上海')[0]);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        城市们: ['上海'],
        城市引用们: [],
      }),
    );
  });
});