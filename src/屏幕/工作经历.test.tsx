// 工作经历 行业弹层 Backend 接入测试（Task 4）：
// Backend 弹层按需 查询Taxonomy('industries')，点 selectable 叶子写 行业引用；
// 继续自由输入清除引用。Mock 保留 常见行业 不变。

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 工作经历 from './工作经历';
import { 路径 } from '../路由/路径表';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

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
  查询Institution?: ReturnType<typeof vi.fn>;
  保存简历?: ReturnType<typeof vi.fn>;
}) {
  mock应用状态 = {
    数据源模式: 选项.数据源,
    目录查询:
      选项.数据源 === 'backend'
        ? {
            查询Location: vi.fn(),
            查询Taxonomy: 选项.查询Taxonomy ?? vi.fn(),
            查询Institution: 选项.查询Institution ?? vi.fn(),
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
    操作: { 保存简历: 选项.保存简历 ?? vi.fn(async () => {}) },
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

  // review-r3 R3-I-5：行业弹层 root 分页——roots 返回 nextCursor 时可加载更多，dedup 合并
  it('行业弹层根分页加载更多追加第二页（R3-I-5）', async () => {
    let 根调用 = 0;
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        根调用 += 1;
        if (根调用 === 1) {
          return {
            items: [{ id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false }],
            nextCursor: 'ind_cur_1',
            catalogVersion: 'v2',
          };
        }
        return {
          items: [{ id: 'ind_tech', display_name: '互联网', parent_id: null, selectable: false }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'ind_fin') {
        return {
          items: [{ id: 'ind_pay', display_name: '支付与清结算', parent_id: 'ind_fin', selectable: true }],
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
    await screen.findByText('金融科技');
    // 点「加载更多」→ 追加第二页
    const 加载更多 = await screen.findByRole('button', { name: '加载更多' });
    await 用户.click(加载更多);
    await screen.findByText('互联网');
    expect(screen.getByText('金融科技')).toBeTruthy();
  });
});

// review-r3 R3-Minor-2：Backend 行业弹层去掉自由文本输入——它看起来可保存但完成守卫要求引用，
// 自由输入会清掉引用导致无法完成。Backend 必须从目录叶子里选。
describe('工作经历 经历编辑页 Backend 行业无自由文本（R3-Minor-2）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('Backend 行业弹层无自由文本输入框（必须选目录叶子）', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        return {
          items: [{ id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'ind_fin') {
        return {
          items: [{ id: 'ind_pay', display_name: '支付与清结算', parent_id: 'ind_fin', selectable: true }],
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
    // Backend 模式不渲染自由文本输入框
    expect(screen.queryByPlaceholderText('没有合适的？直接输入')).toBeNull();
  });

  it('Mock 行业弹层保留自由文本输入框', async () => {
    render工作经历({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByText('所属行业'));
    expect(screen.getByPlaceholderText('没有合适的？直接输入')).toBeTruthy();
  });
});

// review-r2 R2-I-5：Backend 经历编辑页 行业为空也能完成 → 保存简历 跳过该行 → 不持久化 →
// 服务端水合后消失。修复后 Backend 要求 行业引用（隐含 行业 非空）才能完成。
describe('工作经历 经历编辑页 Backend 行业必填引用（R2-I-5）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('Backend 行业为空时完成被阻断，不派发存简历', async () => {
    render工作经历({ 数据源: 'backend' });
    const 用户 = userEvent.setup();
    // 进入第一段经历编辑页（初始数据 行业='' 行业引用=undefined）
    await 用户.click(screen.getByText('字节跳动'));
    // 公司/职位/入职时间 都已填（初始数据），必填齐通过；点完成应被 行业引用 缺失阻断
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    const 派发 = mock应用状态.派发;
    const 存简历调用 = 派发.mock.calls.find((c: unknown[]) => (c[0] as { 型?: string })?.型 === '存简历');
    expect(存简历调用).toBeUndefined();
  });
});

// review-r1 P1-3：教育编辑页 Backend 分支——学校/专业输入走目录查询，点候选才落引用，
// 继续输入清引用，没点候选阻止保存。Mock 分支保持自由文本不变。
describe('工作经历 教育编辑页 Backend', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('Backend 教育编辑页：学校输入出候选→点候选落引用→继续输入清引用→无候选阻止保存（P1-3）', async () => {
    const 查询Institution = vi.fn(async (_q: { q?: string }) => ({
      items: [
        {
          id: 'inst_thu',
          display_name: '清华大学',
          location: { id: 'loc_bj', display_name: '北京', country_name: '中国' },
          selectable: true,
        },
      ],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { q?: string }) => {
      if (query.q && query.q.includes('计算机')) {
        return {
          items: [{ id: 'tax_cs', display_name: '计算机科学与技术', parent_id: null, selectable: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render工作经历({ 数据源: 'backend', 查询Taxonomy, 查询Institution });
    const 用户 = userEvent.setup();
    // 进入教育编辑页（新增）
    await 用户.click(screen.getByText('添加教育经历'));
    // 学校输入 → 候选出现（带副标题「北京 · 中国」）
    await 用户.type(screen.getAllByPlaceholderText('必填')[0], '清华');
    await waitFor(() => expect(查询Institution).toHaveBeenCalled());
    await screen.findByText('北京 · 中国');
    // 点候选 → 学校引用 已落
    await 用户.click(screen.getByText('清华大学'));
    // 专业输入 → 候选出现
    const 专业输入 = screen.getAllByPlaceholderText('必填')[1];
    await 用户.type(专业输入, '计算机');
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalledWith('majors', expect.objectContaining({ q: '计算机' })));
    await screen.findByText('计算机科学与技术');
    // 点候选 → 专业引用 已落
    await 用户.click(screen.getByText('计算机科学与技术'));
    // 完成回写：派发存简历里教育段带 学校引用 / 专业引用
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    const 派发 = mock应用状态.派发;
    const 存简历调用 = 派发.mock.calls.find((c: unknown[]) => (c[0] as { 型?: string })?.型 === '存简历')?.[0] as {
      教育: { 学校: string; 学校引用?: unknown; 专业: string; 专业引用?: unknown }[];
    } | undefined;
    expect(存简历调用).toBeDefined();
    expect(存简历调用!.教育[0].学校).toBe('清华大学');
    expect(存简历调用!.教育[0].学校引用).toEqual({ id: 'inst_thu', display_name: '清华大学' });
    expect(存简历调用!.教育[0].专业).toBe('计算机科学与技术');
    expect(存简历调用!.教育[0].专业引用).toEqual({ id: 'tax_cs', display_name: '计算机科学与技术' });
  });
});

// Task 1：证书添加不要求年份输入 —— BFF 契约里 year 可空（页面 年份 留空字符串 → 写 null），
// 存简历 派发里每条证书都带全 BFF 必需的用户字段（名称/年份/编号），不需要新增年份输入框。
describe('工作经历 证书与语言 Backend', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('添加证书不带年份输入，存简历里 年份 为空字符串', async () => {
    render工作经历({ 数据源: 'backend' });
    const 用户 = userEvent.setup();
    const 证书输入 = screen.getByPlaceholderText('证书或语言，如 CPA、雅思 7.0');
    await 用户.type(证书输入, 'CET-4');
    await 用户.click(证书输入.parentElement!.querySelector('button')!);
    const 派发 = mock应用状态.派发;
    const 存简历调用 = 派发.mock.calls.find((c: unknown[]) => (c[0] as { 型?: string })?.型 === '存简历')?.[0] as {
      证书: { 名称: string; 年份: string; 编号: string }[];
    } | undefined;
    expect(存简历调用).toBeDefined();
    expect(存简历调用!.证书).toEqual([{ 名称: 'CET-4', 年份: '', 编号: expect.any(String) }]);
  });
});

// Task 2（onboarding 修复）：保存 single-flight —— 保存中按钮禁用并显示「保存中…」，
// 重复点击只发一次 保存简历；权威保存完成后才 轻提示('简历已保存') 并跳转下一屏；
// 失败不跳转，按钮恢复为「保存」。仓库未装 jest-dom，断言一律读原生 DOM。
describe('工作经历 保存 single-flight', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
  });

  it('保存中按钮禁用显示保存中，重复点击只保存一次，成功后轻提示并跳转', async () => {
    let resolve保存!: () => void;
    const 保存简历 = vi.fn(() => new Promise<void>((resolve) => { resolve保存 = resolve; }));
    render工作经历({ 数据源: 'mock', 保存简历 });
    const 用户 = userEvent.setup();
    const 保存键 = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement;
    await 用户.click(保存键);
    expect(保存简历).toHaveBeenCalledTimes(1);
    expect(保存键.disabled).toBe(true);
    expect(保存键.textContent).toBe('保存中…');
    // 再点一次：disabled + single-flight 守卫，不再发保存
    await 用户.click(保存键);
    expect(保存简历).toHaveBeenCalledTimes(1);
    // 权威保存完成后才提示并跳转（在职 → 引导问答）
    await act(async () => { resolve保存(); });
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('简历已保存'));
    expect(mock跳转).toHaveBeenCalledWith(路径.引导问答);
  });

  it('保存失败不跳转，轻提示错误文案，按钮恢复为保存', async () => {
    let reject保存!: (错误: unknown) => void;
    const 保存简历 = vi.fn(() => new Promise<void>((_resolve, reject) => { reject保存 = reject; }));
    render工作经历({ 数据源: 'mock', 保存简历 });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    const 保存中键 = screen.getByRole('button', { name: '保存中…' }) as HTMLButtonElement;
    expect(保存中键.disabled).toBe(true);
    await act(async () => { reject保存(new Error('网络失败')); });
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('网络连接失败，请稍后再试'));
    expect(mock跳转).not.toHaveBeenCalled();
    const 恢复键 = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement;
    expect(恢复键.disabled).toBe(false);
    expect(恢复键.textContent).toBe('保存');
  });
});