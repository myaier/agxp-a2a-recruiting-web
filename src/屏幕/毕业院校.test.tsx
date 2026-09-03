// 毕业院校 Backend 接入测试（Task 4）：
// Backend 按需 查询Institution，候选行显示「城市 · 国家」副行，点候选才存 学校引用；
// 继续输入清除旧引用，未点候选阻止保存。Mock 分支保持本地 高校名录 不变。
//
// 候选 onboarding 预填（Spec §8 /onboard/school，Task 5）：exact Catalog 命中种入
// 文本 + canonical 引用；unresolved 只落 source_name 文本，既有选择器守卫（未点候选
// 下一步禁用 + 提交守卫）保持关闭；当前文本非空原样保留；确认 institution 分区只在
// 既有保存 resolve 之后、跳转之前。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF简历预填建议 } from '../数据/BFF契约';
import { 目录精确命中变体, 构造映射变体基底 } from '../数据/招聘数据源/简历预填.fixture';
import { 路径 } from '../路由/路径表';
import { 创建空候选预填状态, type 候选预填Eligibility, type 候选预填状态 } from '../状态/后端/类型';
import type { 简历教育段 } from '../数据/类型';
import 毕业院校 from './毕业院校';

/** deferred promise：测试可控制异步 resolve 的时机（用于模拟慢响应到达） */
function deferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((ok) => { resolve = ok; });
  return { promise, resolve };
}

/** 一页只含复旦的学校搜索结果（location 与现有用例同款精简形态） */
function 复旦结果页() {
  return {
    items: [
      {
        id: 'ins_fudan',
        display_name: '复旦大学',
        location: { id: 'loc_sh', display_name: '上海市', country_name: '中国' },
      },
    ],
    nextCursor: null,
    catalogVersion: 'v2',
  };
}

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());
const mock确认分区 = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

const 简历教育初始 = [
  { 编号: 'edu1', 学校: '', 学历: '硕士', 专业: '计算机科学', 开始: '2014-09', 结束: '2017-06' },
];

const 全可预填: 候选预填Eligibility = {
  profile: { real_name: true, work_start_year: true, gender: true, birth_year: true, birth_month: true },
  summary: true,
  skills: true,
  experiences: true,
  educations: true,
  certificates: true,
};

/** ready 轮 fixture（与 Task 2 映射测试同款形状） */
function readyState(建议: BFF简历预填建议, 覆盖: Partial<候选预填状态> = {}): 候选预填状态 {
  return {
    ...创建空候选预填状态(),
    phase: 'ready',
    source: 建议.source,
    eligibility: 全可预填,
    suggestion: 建议,
    ...覆盖,
  };
}

function render毕业院校(选项: {
  数据源: 'backend' | 'mock';
  查询Institution?: ReturnType<typeof vi.fn>;
  保存简历?: ReturnType<typeof vi.fn>;
  预填?: 候选预填状态;
  简历教育?: 简历教育段[];
}) {
  const 保存简历 = 选项.保存简历 ?? vi.fn(async () => {});
  mock应用状态 = {
    数据源模式: 选项.数据源,
    目录查询:
      选项.数据源 === 'backend'
        ? {
            查询Location: vi.fn(),
            查询Taxonomy: vi.fn(),
            查询Institution: 选项.查询Institution ?? vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
          }
        : null,
    状态: {
      简历教育: 选项.简历教育 ?? 简历教育初始,
      基本信息: { 真名: '沈', 开始工作年: '2017', 身份: '在职' as const },
      个人优势: '',
      简历技能: [],
      简历经历: [],
      简历证书: [],
    },
    后端状态: { 候选预填状态: 选项.预填 ?? 创建空候选预填状态() },
    操作: { 保存简历, 确认候选Onboarding预填分区: mock确认分区 },
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

  // Task 5：Backend 未点候选 → 下一步禁用；点候选 → 启用；继续输入 → 引用清除又禁用
  // 注：仓库未装 @testing-library/jest-dom，disabled 用原生属性断言
  it('未点候选时下一步禁用，点候选启用，再输入又禁用', async () => {
    const 查询Institution = vi.fn(async () => 复旦结果页());
    render毕业院校({ 数据源: 'backend', 查询Institution });
    const 用户 = userEvent.setup();
    const 下一步 = () => screen.getByRole('button', { name: '下一步' }) as HTMLButtonElement;
    await 用户.type(screen.getByPlaceholderText('学校名称'), '复旦');
    expect(下一步().disabled).toBe(true);
    await 用户.click(await screen.findByRole('button', { name: /复旦大学/ }));
    expect(下一步().disabled).toBe(false);
    await 用户.type(screen.getByPlaceholderText('学校名称'), '新');
    expect(下一步().disabled).toBe(true);
  });

  // Task 5：搜索在途时显示「加载中…」（请求挂起，不 resolve）
  it('搜索进行中显示 加载中…', async () => {
    const { promise } = deferredPromise<{ items: unknown[]; nextCursor: string | null; catalogVersion: string }>();
    const 查询Institution = vi.fn(async () => promise);
    render毕业院校({ 数据源: 'backend', 查询Institution });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByPlaceholderText('学校名称'), '复旦');
    await waitFor(() => expect(查询Institution).toHaveBeenCalled());
    expect(screen.getByRole('status').textContent).toBe('加载中…');
  });

  // Task 5：空结果 → 「没有匹配结果，试试缩短关键词」
  it('空结果显示 没有匹配结果，试试缩短关键词', async () => {
    const 查询Institution = vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' }));
    render毕业院校({ 数据源: 'backend', 查询Institution });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByPlaceholderText('学校名称'), '复旦');
    // 加载中 → 空结果：等状态文案切换成「没有匹配结果」
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('没有匹配结果，试试缩短关键词'),
    );
  });

  // Task 5：请求失败 → 「加载失败，请重试」
  it('请求失败显示 加载失败，请重试', async () => {
    const 查询Institution = vi.fn(async () => {
      throw new Error('网络错误');
    });
    render毕业院校({ 数据源: 'backend', 查询Institution });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByPlaceholderText('学校名称'), '复旦');
    expect((await screen.findByRole('alert')).textContent).toBe('加载失败，请重试');
  });

  // Task 5：旧关键词的慢响应晚于新关键词到达 → 不覆盖当前结果
  it('旧关键词的慢响应不覆盖新关键词的结果', async () => {
    type 页 = { items: { id: string; display_name: string; location: { id: string; display_name: string; country_name: string } }[]; nextCursor: null; catalogVersion: string };
    const 待决: { promise: Promise<页>; resolve: (值: 页) => void }[] = [];
    const 查询Institution = vi.fn(() => {
      const 延迟 = deferredPromise<页>();
      待决.push(延迟);
      return 延迟.promise;
    });
    render毕业院校({ 数据源: 'backend', 查询Institution });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByPlaceholderText('学校名称'), '复');
    await waitFor(() => expect(查询Institution).toHaveBeenCalledTimes(1));
    await 用户.type(screen.getByPlaceholderText('学校名称'), '旦');
    await waitFor(() => expect(查询Institution).toHaveBeenCalledTimes(2));
    // 新关键词（复旦）先返回 → 渲染
    待决[1].resolve(复旦结果页() as 页);
    await screen.findByText('复旦大学');
    // 旧关键词（复）后返回 → 不得覆盖
    待决[0].resolve({
      items: [{ id: 'ins_old', display_name: '过期学校', location: { id: 'loc_old', display_name: '旧城', country_name: '旧国' } }],
      nextCursor: null,
      catalogVersion: 'v2',
    });
    await new Promise((就绪) => setTimeout(就绪, 0));
    expect(screen.queryByText('过期学校')).toBeNull();
    expect(screen.getByText('复旦大学')).toBeTruthy();
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

describe('毕业院校 候选 onboarding 预填（Spec §8）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
    mock确认分区.mockClear();
  });

  it('exact 学校建议种入文本与 canonical 引用，下一步直接保存并携带引用', async () => {
    const { 保存简历 } = render毕业院校({ 数据源: 'backend', 预填: readyState(目录精确命中变体()) });
    const 用户 = userEvent.setup();
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Example University');
    // exact 命中带引用：下一步不被守卫禁用
    expect((screen.getByRole('button', { name: '下一步' }) as HTMLButtonElement).disabled).toBe(false);
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalled());
    expect(保存简历).toHaveBeenCalledWith(
      expect.objectContaining({
        教育: [
          expect.objectContaining({
            学校: 'Example University',
            学校引用: { id: 'ins_bbbbbbbbbbbbbbbbbbbbbbbbbb', display_name: 'Example University' },
          }),
        ],
      }),
    );
    // 确认 institution 在保存之后、跳转之前
    await waitFor(() => expect(mock确认分区).toHaveBeenCalledWith('institution'));
    expect(mock确认分区.mock.invocationCallOrder[0]!).toBeLessThan(mock跳转.mock.invocationCallOrder[0]!);
    expect(mock跳转).toHaveBeenCalledWith(路径.选专业);
  });

  it('unresolved 学校只落文本：既有选择器守卫保持关闭，保存不发生', async () => {
    const 保存简历 = vi.fn(async () => {});
    render毕业院校({ 数据源: 'backend', 预填: readyState(构造映射变体基底()), 保存简历 });
    const 用户 = userEvent.setup();
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Example University');
    // 未点候选（无 canonical 引用）：下一步保持禁用，点了也不保存不跳转
    const 下一步 = screen.getByRole('button', { name: '下一步' }) as HTMLButtonElement;
    expect(下一步.disabled).toBe(true);
    await 用户.click(下一步);
    expect(保存简历).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock确认分区).not.toHaveBeenCalled();
  });

  it('当前文本非空优先：已有学校与引用不被建议覆盖', async () => {
    const 已有引用 = { id: 'ins_qinghua', display_name: '清华大学' };
    const { 保存简历 } = render毕业院校({
      数据源: 'backend',
      预填: readyState(目录精确命中变体()),
      简历教育: [
        { 编号: 'edu1', 学校: '清华大学', 学历: '硕士', 专业: '', 开始: '', 结束: '', 学校引用: 已有引用 },
      ],
    });
    const 用户 = userEvent.setup();
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('清华大学');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalled());
    expect(保存简历).toHaveBeenCalledWith(
      expect.objectContaining({
        教育: [expect.objectContaining({ 学校: '清华大学', 学校引用: 已有引用 })],
      }),
    );
  });

  it.each([
    ['manual 轮', (状态: 候选预填状态) => { 状态.phase = 'manual'; }],
    ['institution 已确认', (状态: 候选预填状态) => { 状态.confirmed.institution = true; }],
    ['educations 非空（服务端已有教育）', (状态: 候选预填状态) => {
      状态.eligibility = { ...全可预填, educations: false };
    }],
  ])('%s 保留旧初始化（文本为空）', (_名, 改) => {
    const 轮 = readyState(目录精确命中变体());
    改(轮);
    render毕业院校({ 数据源: 'backend', 预填: 轮 });
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  });

  it('保存被拒时 institution 分区不确认、不跳转', async () => {
    const 保存简历 = vi.fn(async () => {
      throw new Error('保存失败');
    });
    render毕业院校({ 数据源: 'backend', 预填: readyState(目录精确命中变体()), 保存简历 });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(mock确认分区).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
  });
});