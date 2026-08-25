// 选专业 Backend 接入测试（Task 4）：
// Backend 按需 查询Taxonomy('majors')，点候选才存 专业引用；
// 继续输入清除旧引用，未点候选阻止保存。Mock 分支保持本地 专业名录 不变。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 选专业 from './选专业';

/** deferred promise：测试可控制异步 resolve 的时机（用于模拟慢响应到达） */
function deferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((ok) => { resolve = ok; });
  return { promise, resolve };
}

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

const 简历教育初始 = [
  { 编号: 'edu1', 学校: '复旦大学', 学历: '硕士', 专业: '', 开始: '2014-09', 结束: '2017-06' },
];

function render选专业(选项: {
  数据源: 'backend' | 'mock';
  查询Taxonomy?: ReturnType<typeof vi.fn>;
  保存简历?: ReturnType<typeof vi.fn>;
}) {
  const 保存简历 = 选项.保存简历 ?? vi.fn(async () => {});
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
      <选专业 />
    </MemoryRouter>,
  );
  return { 保存简历 };
}

describe('选专业 Backend', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('点候选保存专业引用', async () => {
    const 查询Taxonomy = vi.fn(async () => ({
      items: [
        { id: 'maj_cs', display_name: '计算机科学与技术', parent_id: null, selectable: true },
      ],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    const { 保存简历 } = render选专业({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByRole('textbox'), '计算机');
    expect(await screen.findByText('计算机科学与技术')).toBeTruthy();
    await 用户.click(screen.getByText('计算机科学与技术'));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalled());
    expect(保存简历).toHaveBeenCalledWith(
      expect.objectContaining({
        教育: [
          expect.objectContaining({
            专业: '计算机科学与技术',
            专业引用: { id: 'maj_cs', display_name: '计算机科学与技术' },
          }),
        ],
      }),
    );
    expect(查询Taxonomy).toHaveBeenCalledWith('majors', expect.objectContaining({ q: '计算机' }));
  });

  it('未点候选时阻止保存', async () => {
    const 查询Taxonomy = vi.fn(async () => ({
      items: [
        { id: 'maj_cs', display_name: '计算机科学与技术', parent_id: null, selectable: true },
      ],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    const { 保存简历 } = render选专业({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByRole('textbox'), '计算机');
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(保存简历).not.toHaveBeenCalled();
  });

  // review-r2 R2-M-1：搜索返回 nextCursor 时显示「加载更多」，点击追加下一页
  it('搜索返回 nextCursor 时可加载更多（R2-M-1）', async () => {
    let 调用次数 = 0;
    const 查询Taxonomy = vi.fn(async (_kind: string, _query: { q?: string; cursor?: string }) => {
      调用次数 += 1;
      if (调用次数 === 1) {
        return {
          items: [{ id: 'maj_1', display_name: '经济学', parent_id: null, selectable: true }],
          nextCursor: 'cur_1',
          catalogVersion: 'v2',
        };
      }
      return {
        items: [{ id: 'maj_2', display_name: '经济统计学', parent_id: null, selectable: true }],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    });
    render选专业({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByRole('textbox'), '经济');
    await screen.findByText('经济学');
    // 第一页有 nextCursor → 显示「加载更多」
    const 加载更多 = await screen.findByRole('button', { name: '加载更多' });
    await 用户.click(加载更多);
    await screen.findByText('经济统计学');
    // 两页都在（去重合并）
    expect(screen.getByText('经济学')).toBeTruthy();
    expect(screen.getByText('经济统计学')).toBeTruthy();
    expect(查询Taxonomy).toHaveBeenLastCalledWith('majors', expect.objectContaining({ cursor: 'cur_1' }));
  });

  // review-r2 R2-M-2：清空输入后旧响应不覆盖空结果（代际递增守 stale）
  it('清空输入后旧响应不覆盖空结果（R2-M-2）', async () => {
    const { promise, resolve } = deferredPromise<{ items: unknown[]; nextCursor: null; catalogVersion: string }>();
    const 查询Taxonomy = vi.fn(async () => promise);
    render选专业({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByRole('textbox'), '经济');
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    // 清空输入（应递增代际，使在飞请求成为 stale）
    await 用户.clear(screen.getByRole('textbox'));
    // 旧响应到达——不应写入结果
    resolve({ items: [{ id: 'maj_stale', display_name: '过期结果', parent_id: null, selectable: true }], nextCursor: null, catalogVersion: 'v2' });
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    // 过期结果不应出现
    expect(screen.queryByText('过期结果')).toBeNull();
  });
});

describe('选专业 Mock', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('本地专业名录过滤，无引用', async () => {
    const { 保存简历 } = render选专业({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByRole('textbox'), '经济');
    // 专业名录里有「经济学」（输入「经济」时「经济学」作为候选出现，因为 名 !== 词）
    await 用户.click(await screen.findByText('经济学'));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalled());
    const 调用 = 保存简历.mock.calls[0][0] as { 教育: { 专业引用?: unknown }[] };
    expect(调用.教育[0].专业引用).toBeUndefined();
  });
});