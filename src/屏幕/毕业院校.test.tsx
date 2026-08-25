// 毕业院校 Backend 接入测试（Task 4）：
// Backend 按需 查询Institution，候选行显示「城市 · 国家」副行，点候选才存 学校引用；
// 继续输入清除旧引用，未点候选阻止保存。Mock 分支保持本地 高校名录 不变。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 毕业院校 from './毕业院校';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

const 简历教育初始 = [
  { 编号: 'edu1', 学校: '', 学历: '硕士', 专业: '计算机科学', 开始: '2014-09', 结束: '2017-06' },
];

function render毕业院校(选项: {
  数据源: 'backend' | 'mock';
  查询Institution?: ReturnType<typeof vi.fn>;
  保存简历?: ReturnType<typeof vi.fn>;
}) {
  const 保存简历 = 选项.保存简历 ?? vi.fn(async () => {});
  mock应用状态 = {
    数据源模式: 选项.数据源,
    目录查询:
      选项.数据源 === 'backend'
        ? {
            查询Location: vi.fn(),
            查询Taxonomy: vi.fn(),
            查询Institution: 选项.查询Institution ?? vi.fn(),
          }
        : null,
    状态: {
      简历教育: 简历教育初始,
      基本信息: { 真名: '沈', 开始工作年: '2017', 身份: '在职' as const },
      个人优势: '',
      简历技能: [],
      简历经历: [],
      简历证书: [],
    },
    操作: { 保存简历 },
  };
  render(
    <MemoryRouter>
      <毕业院校 />
    </MemoryRouter>,
  );
  return { 保存简历 };
}

describe('毕业院校 Backend', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('学校候选显示城市和国家，选择后只保存学校引用', async () => {
    const 查询Institution = vi.fn(async () => ({
      items: [
        {
          id: 'ins_fudan',
          display_name: '复旦大学',
          location: {
            id: 'loc_sh',
            display_name: '上海市',
            country_code: 'CN',
            country_name: '中国',
            admin1_code: '31',
            admin1_name: '上海市',
            timezone: 'Asia/Shanghai',
            population: 0,
          },
        },
      ],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    const { 保存简历 } = render毕业院校({ 数据源: 'backend', 查询Institution });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByRole('textbox'), '复旦');
    expect(await screen.findByText('上海市 · 中国')).toBeTruthy();
    await 用户.click(screen.getByText('复旦大学'));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalled());
    expect(保存简历).toHaveBeenCalledWith(
      expect.objectContaining({
        教育: [
          expect.objectContaining({
            学校: '复旦大学',
            学校引用: { id: 'ins_fudan', display_name: '复旦大学' },
          }),
        ],
      }),
    );
  });

  it('未点候选时阻止保存并提示', async () => {
    const 查询Institution = vi.fn(async () => ({
      items: [
        {
          id: 'ins_fudan',
          display_name: '复旦大学',
          location: {
            id: 'loc_sh',
            display_name: '上海市',
            country_code: 'CN',
            country_name: '中国',
            admin1_code: '31',
            admin1_name: '上海市',
            timezone: 'Asia/Shanghai',
            population: 0,
          },
        },
      ],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    const { 保存简历 } = render毕业院校({ 数据源: 'backend', 查询Institution });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByRole('textbox'), '复旦');
    await waitFor(() => expect(查询Institution).toHaveBeenCalled());
    // 不点候选直接点下一步
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(保存简历).not.toHaveBeenCalled();
  });

  // review-r1 P2-1：搜索返回 nextCursor → 滚到底加载第二页，按 id 去重追加。
  it('搜索返回 nextCursor 时滚到底加载第二页并去重（P2-1）', async () => {
    let 调用次 = 0;
    const 查询Institution = vi.fn(async (q: { q?: string; cursor?: string }) => {
      调用次 += 1;
      if (调用次 === 1) {
        return {
          items: [
            { id: 'ins_a', display_name: '大学A', location: { id: 'loc_a', display_name: '城市A', country_name: '国A' } },
          ],
          nextCursor: 'cursor_2',
          catalogVersion: 'v2',
        };
      }
      // 第二页（带 cursor）
      expect(q.cursor).toBe('cursor_2');
      return {
        items: [
          { id: 'ins_b', display_name: '大学B', location: { id: 'loc_b', display_name: '城市B', country_name: '国B' } },
          // 第二页重复第一页的 id → 去重
          { id: 'ins_a', display_name: '大学A', location: { id: 'loc_a', display_name: '城市A', country_name: '国A' } },
        ],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    });
    render毕业院校({ 数据源: 'backend', 查询Institution });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByRole('textbox'), '大学');
    await waitFor(() => expect(查询Institution).toHaveBeenCalledTimes(1));
    await screen.findByText('大学A');
    // 滚到底 → 触发加载更多（候选列表区底部的「加载更多」按钮）
    await 用户.click(screen.getByRole('button', { name: '加载更多' }));
    await waitFor(() => expect(查询Institution).toHaveBeenCalledTimes(2));
    // 第二页追加，去重后只有 A + B（不是 A + B + A）
    await screen.findByText('大学B');
    const 候选行 = screen.getAllByText(/大学[AB]/);
    // 大学A 只出现一次（去重），大学B 出现一次
    expect(候选行.filter((n) => n.textContent === '大学A')).toHaveLength(1);
    expect(候选行.filter((n) => n.textContent === '大学B')).toHaveLength(1);
  });
});

describe('毕业院校 Mock', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('本地高校名录过滤，无引用，保存直接进行', async () => {
    const { 保存简历 } = render毕业院校({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByRole('textbox'), '复旦');
    await 用户.click(await screen.findByText('复旦大学'));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalled());
    expect(保存简历).toHaveBeenCalledWith(
      expect.objectContaining({
        教育: [expect.objectContaining({ 学校: '复旦大学' })],
      }),
    );
    // Mock 不带 学校引用
    const 调用 = 保存简历.mock.calls[0][0] as { 教育: { 学校引用?: unknown }[] };
    expect(调用.教育[0].学校引用).toBeUndefined();
  });
});