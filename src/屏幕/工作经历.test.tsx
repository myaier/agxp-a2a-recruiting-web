// 工作经历 行业弹层 Backend 接入测试（Task 4）：
// Backend 弹层按需 查询Taxonomy('industries')，点 selectable 叶子写 行业引用；
// 继续自由输入清除引用。Mock 保留 常见行业 不变。
//
// 候选 onboarding 简历预填（Spec §8 /experience，Task 6）：首挂载同步用 取工作页预填
// 一次物化四分区（空服务端且空页面才物化；附加教育只在前四页形成的 educations[0] 之后
// 追加 slice(1)），临时编号 prefill: 前缀、隐私默认 隐藏:true、internship 缺席不设置、
// 证书年份空串；unresolvedCount 只进保存点击的 轻提示（还有 N 处需要选择目录或补充必填项），
// 不渲染任何提示节点；确认 work 分区只在既有保存成功后。

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 工作经历 from './工作经历';
import { 路径 } from '../路由/路径表';
import type { BFF简历预填建议 } from '../数据/BFF契约';
import { 构造映射变体基底, 多条教育变体 } from '../数据/招聘数据源/简历预填.fixture';
import { 创建空候选预填状态, type 候选预填Eligibility, type 候选预填状态 } from '../状态/后端/类型';
import type { 简历经历段, 简历教育段, 简历证书 } from '../数据/类型';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());
const mock确认分区 = vi.hoisted(() => vi.fn());
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

// Task 6：宿主组件——派发 存简历 就地合并列表并触发一次真实重渲染（模拟根 Resume
// reducer 换新对象后的渲染），否则物化种入后受控列表不更新、卡片不出现。
let 触发重渲染: (() => void) | null = null;

function 宿主() {
  const [, 设代] = useState(0);
  // 渲染期登记（早于子组件的 useLayoutEffect 种入派发）；设代 在同一挂载内稳定
  触发重渲染 = () => 设代((代) => 代 + 1);
  return (
    <MemoryRouter>
      <工作经历 />
    </MemoryRouter>
  );
}

function render工作经历(选项: {
  数据源?: 'backend' | 'mock';
  查询Taxonomy?: ReturnType<typeof vi.fn>;
  查询Institution?: ReturnType<typeof vi.fn>;
  保存简历?: ReturnType<typeof vi.fn>;
  预填?: 候选预填状态;
  经历?: 简历经历段[];
  教育?: 简历教育段[];
  技能?: string[];
  证书?: 简历证书[];
  基本信息?: { 真名: string; 开始工作年: string; 身份: '在校' | '在职' | '离职' | '' };
}) {
  const 数据源 = 选项.数据源 ?? 'backend';
  mock应用状态 = {
    数据源模式: 数据源,
    目录查询:
      数据源 === 'backend'
        ? {
            查询Location: vi.fn(),
            查询Taxonomy: 选项.查询Taxonomy ?? vi.fn(),
            查询Institution: 选项.查询Institution ?? vi.fn(),
          }
        : null,
    状态: {
      简历经历: 选项.经历 ?? 简历经历初始,
      简历教育: 选项.教育 ?? [],
      简历技能: 选项.技能 ?? [],
      简历证书: 选项.证书 ?? [],
      个人优势: '',
      简历作品集链接: '',
      基本信息: 选项.基本信息 ?? { 真名: '沈', 开始工作年: '2017', 身份: '在职' as const },
    },
    后端状态: { 候选预填状态: 选项.预填 ?? 创建空候选预填状态() },
    派发: vi.fn((动作: { 型?: string; 经历?: 简历经历段[]; 教育?: 简历教育段[]; 技能?: string[]; 证书?: 简历证书[] }) => {
      if (动作.型 === '存简历') {
        mock应用状态.状态.简历经历 = 动作.经历 ?? mock应用状态.状态.简历经历;
        mock应用状态.状态.简历教育 = 动作.教育 ?? mock应用状态.状态.简历教育;
        mock应用状态.状态.简历技能 = 动作.技能 ?? mock应用状态.状态.简历技能;
        mock应用状态.状态.简历证书 = 动作.证书 ?? mock应用状态.状态.简历证书;
        触发重渲染?.();
      }
    }),
    操作: {
      保存简历: 选项.保存简历 ?? vi.fn(async () => {}),
      确认候选Onboarding预填分区: mock确认分区,
    },
  };
  render(<宿主 />);
  return { 派发: mock应用状态.派发 as ReturnType<typeof vi.fn>, 重渲染: () => 触发重渲染?.() };
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
    // P0 修复 Task 6：普通本地 Error 落通用请求失败文案（不冒充网络，也不泄露 message）
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('请求失败，请稍后再试'));
    expect(mock轻提示).not.toHaveBeenCalledWith('网络失败');
    expect(mock跳转).not.toHaveBeenCalled();
    const 恢复键 = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement;
    expect(恢复键.disabled).toBe(false);
    expect(恢复键.textContent).toBe('保存');
  });
});

// ── 候选 onboarding 简历预填（Spec §8 /experience，Task 6）──

const 全可预填: 候选预填Eligibility = {
  profile: { real_name: true, work_start_year: true, gender: true, birth_year: true, birth_month: true, current_education: true },
  summary: true,
  skills: true,
  experiences: true,
  educations: true,
  certificates: true,
};

/** ready 轮 fixture（与 Task 2 映射测试同款形状）；建议默认是 wire fixture 深拷贝基底。 */
function readyWork(
  覆盖: {
    experiencesEligible?: boolean;
    educationsEligible?: boolean;
    skillsEligible?: boolean;
    certificatesEligible?: boolean;
  } = {},
  建议: BFF简历预填建议 = 构造映射变体基底(),
): 候选预填状态 {
  return {
    ...创建空候选预填状态(),
    phase: 'ready',
    source: 建议.source,
    eligibility: {
      ...全可预填,
      ...(覆盖.experiencesEligible !== undefined ? { experiences: 覆盖.experiencesEligible } : {}),
      ...(覆盖.educationsEligible !== undefined ? { educations: 覆盖.educationsEligible } : {}),
      ...(覆盖.skillsEligible !== undefined ? { skills: 覆盖.skillsEligible } : {}),
      ...(覆盖.certificatesEligible !== undefined ? { certificates: 覆盖.certificatesEligible } : {}),
    },
    suggestion: 建议,
  };
}

/** 深拷贝 wire fixture 的 result 改写出映射边界样本（unresolved / 缺席），不触碰不可变 fixture。 */
function 映射变体(改写: (建议: BFF简历预填建议) => void): BFF简历预填建议 {
  const 副本 = 构造映射变体基底();
  改写(副本);
  return 副本;
}

/** 从派发记录里取 存简历 动作（预填种入与页面编辑共用这一条通道） */
function 存简历调用们(派发: ReturnType<typeof vi.fn>) {
  return (派发.mock.calls as { 型: string; 经历: 简历经历段[]; 教育: 简历教育段[]; 技能: string[]; 证书: 简历证书[] }[][])
    .filter(([动作]) => 动作.型 === '存简历')
    .map(([动作]) => 动作);
}

/** 空页面（四列表全空）——预填物化的正向用例基线；每次返回新数组，测试间互不影响 */
function 空列表页(): { 经历: 简历经历段[]; 教育: 简历教育段[]; 技能: string[]; 证书: 简历证书[] } {
  return { 经历: [], 教育: [], 技能: [], 证书: [] };
}

describe('工作经历 候选 onboarding 预填（Spec §8）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
    mock确认分区.mockClear();
  });

  it('空服务端且空页面时物化四分区：经历卡（隐私默认隐藏）/技能标签/证书行（年份空不渲染）', () => {
    render工作经历({ 预填: readyWork(), ...空列表页() });
    // 经历卡：公司/职位来自建议；结束 null + 隐藏 true → 已对该公司隐身 徽标
    expect(screen.getByText('Example Systems')).toBeTruthy();
    expect(screen.getByText('Backend Engineer')).toBeTruthy();
    expect(screen.getByText('已对该公司隐身')).toBeTruthy();
    // 技能标签 / 证书行（year:null → 页面空串 → 不渲染「年取得」）
    expect(screen.getByText('Go')).toBeTruthy();
    expect(screen.getByText('Synthetic Cloud Certificate')).toBeTruthy();
    expect(screen.queryByText(/年取得/)).toBeNull();
  });

  it('物化条目带 prefill: 临时编号（不匹配服务端 ID grammar）、exact 行业引用、证书空年份', () => {
    const { 派发 } = render工作经历({ 预填: readyWork(), ...空列表页() });
    const 种入 = 存简历调用们(派发);
    expect(种入).toHaveLength(1);
    const 段 = 种入[0].经历[0];
    expect(段.编号).toBe('prefill:exp:0');
    expect(段.编号.startsWith('prefill:')).toBe(true);
    expect(/^[a-z]{2,4}_[0-9a-f]{32}$/.test(段.编号)).toBe(false);
    expect(段.行业引用).toEqual({ id: 'tax_aaaaaaaaaaaaaaaaaaaaaaaaaa', display_name: 'Software' });
    expect(段.隐藏).toBe(true);
    expect(种入[0].技能).toEqual(['Go']);
    expect(种入[0].证书).toEqual([{ 编号: 'prefill:cer:0', 名称: 'Synthetic Cloud Certificate', 年份: '' }]);
  });

  it('internship 缺席保持未设置', () => {
    const { 派发 } = render工作经历({
      预填: readyWork({}, 映射变体((建议) => {
        建议.draft.experiences[0].internship = { value: null, confidence: null };
      })),
      ...空列表页(),
    });
    const 段 = 存简历调用们(派发)[0].经历[0];
    expect('实习' in 段).toBe(false);
  });

  it('parser 顺序保持：多条经历按原顺序物化', () => {
    render工作经历({
      预填: readyWork({}, 映射变体((建议) => {
        建议.draft.experiences.push(structuredClone(建议.draft.experiences[0]));
        建议.draft.experiences[1].company = { value: 'Second Corp', confidence: 'high' };
        建议.draft.experiences[1].industry = {
          source_name: { value: 'Finance', confidence: 'medium' },
          resolution: 'unresolved',
          match: null,
        };
      })),
      ...空列表页(),
    });
    const 第一 = screen.getByText('Example Systems');
    const 第二 = screen.getByText('Second Corp');
    expect(第一.compareDocumentPosition(第二) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not append parsed experiences to an existing server list', () => {
    const existing: 简历经历段 = {
      编号: 'exp_server_1', 公司: '现有公司', 行业: '软件', 职位: '工程师',
      开始: '2024-01', 结束: null, 内容: '', 隐藏: true,
    };
    render工作经历({ 预填: readyWork({ experiencesEligible: false }), 经历: [existing] });
    expect(screen.getByText(existing.公司)).toBeTruthy();
    expect(screen.queryByText('Example Systems')).toBeNull();
  });

  it('附加教育：保留前四页形成的第 0 条并追加 slice(1)（eligibility true 且无既有附加条）', () => {
    const 主段: 简历教育段 = { 编号: 'edu_local_0', 学校: '清华大学', 学历: '本科', 专业: '计算机', 开始: '2017-09', 结束: '2021-06' };
    const { 派发 } = render工作经历({ 预填: readyWork({}, 多条教育变体()), 经历: [], 教育: [主段], 技能: [], 证书: [] });
    // 第 0 条原样保留，附加教育物化为第二张卡
    expect(screen.getByText('清华大学')).toBeTruthy();
    expect(screen.getByText('Example Graduate School')).toBeTruthy();
    expect(screen.getByText('硕士 · Distributed Systems')).toBeTruthy();
    const 教育 = 存简历调用们(派发)[0].教育;
    expect(教育).toHaveLength(2);
    expect(教育[0]).toEqual(主段);
    expect(教育[1].编号).toBe('prefill:edu:1');
  });

  it('当前已有任何附加教育时不追加（非空页面列表不合并）', () => {
    const 主段: 简历教育段 = { 编号: 'edu_local_0', 学校: 'A 大学', 学历: '本科', 专业: 'B', 开始: '2017-09', 结束: '2021-06' };
    const 附加: 简历教育段 = { 编号: 'edu_local_1', 学校: 'C 大学', 学历: '硕士', 专业: 'D', 开始: '2021-09', 结束: '' };
    const { 派发 } = render工作经历({
      预填: readyWork({}, 多条教育变体()),
      经历: [], 教育: [主段, 附加], 技能: [], 证书: [],
    });
    expect(screen.queryByText('Example Graduate School')).toBeNull();
    // 教育分区无变化：种入派发不发生（技能/证书仍物化，但教育列表原样）
    const 种入 = 存简历调用们(派发);
    expect(种入[0].教育).toEqual([主段, 附加]);
  });

  it('educations 非空（服务端已有教育）时附加教育不追加', () => {
    const 主段: 简历教育段 = { 编号: 'edu_local_0', 学校: 'A 大学', 学历: '本科', 专业: 'B', 开始: '2017-09', 结束: '2021-06' };
    render工作经历({
      预填: readyWork({ educationsEligible: false }, 多条教育变体()),
      经历: [], 教育: [主段], 技能: [], 证书: [],
    });
    expect(screen.queryByText('Example Graduate School')).toBeNull();
    expect(screen.getByText('A 大学')).toBeTruthy();
  });

  it('unresolved 行业只留 source_name 文本并无引用；保存点击只用 轻提示 报「还有 1 处」', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({
      预填: readyWork({}, 映射变体((建议) => {
        建议.draft.experiences[0].industry = {
          source_name: { value: 'Software', confidence: 'medium' },
          resolution: 'unresolved',
          match: null,
        };
      })),
      ...空列表页(),
      保存简历,
    });
    const 用户 = userEvent.setup();
    // unresolved 条目仍按原文显示（不静默丢弃）
    expect(screen.getByText('Software')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    // unresolvedCount 只进既有保存点击的 轻提示：拦下保存，不渲染任何提示节点
    expect(mock轻提示).toHaveBeenCalledWith('还有 1 处需要选择目录或补充必填项');
    expect(保存简历).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    // 物化条目无 canonical 引用（不猜 ID）
    const 段 = 存简历调用们(mock应用状态.派发)[0].经历[0];
    expect('行业引用' in 段).toBe(false);
  });

  // review Issue 1：保存拦截必须对当前列表实时重数 —— 挂载时冻结的 unresolvedCount
  // 在用户补齐物化条目后仍非零，会把已经无未完成项的保存一直拦到离开页面为止。
  it('补齐建议条目（编辑页选 canonical 行业）后再保存放行：重数当前列表而非挂载冻结值', async () => {
    const 保存简历 = vi.fn(async () => {});
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
    render工作经历({
      预填: readyWork({}, 映射变体((建议) => {
        建议.draft.experiences[0].industry = {
          source_name: { value: 'Software', confidence: 'medium' },
          resolution: 'unresolved',
          match: null,
        };
      })),
      ...空列表页(),
      保存简历,
      查询Taxonomy,
    });
    const 用户 = userEvent.setup();
    // 第一次保存：确实还有 1 处未完成，被拦
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock轻提示).toHaveBeenCalledWith('还有 1 处需要选择目录或补充必填项');
    expect(保存简历).not.toHaveBeenCalled();
    // 第一次保存的拦截提示已断言过；清零后再走补齐流程，断言只看后续调用
    mock轻提示.mockClear();
    // 进编辑页补 canonical 行业（完成守卫要求 行业引用）
    await 用户.click(screen.getByText('Example Systems'));
    await 用户.click(screen.getByText('所属行业'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    await 用户.click(await screen.findByText('金融科技'));
    await 用户.click(await screen.findByText('支付与清结算'));
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    // 回列表再保存：无未完成项，放行（不再被挂载时冻结的计数拦下）
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(mock轻提示).not.toHaveBeenCalledWith('还有 1 处需要选择目录或补充必填项');
  });

  it('删除未完成的建议条目后重数清零：保存不再被冻结计数拦下', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({
      预填: readyWork({}, 映射变体((建议) => {
        建议.draft.experiences.push(structuredClone(建议.draft.experiences[0]));
        建议.draft.experiences[1].company = { value: 'Second Corp', confidence: 'high' };
        建议.draft.experiences[1].industry = {
          source_name: { value: 'Finance', confidence: 'medium' },
          resolution: 'unresolved',
          match: null,
        };
      })),
      ...空列表页(),
      保存简历,
    });
    const 用户 = userEvent.setup();
    // 第一条 exact 完整、第二条 unresolved：还有 1 处，先被拦
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock轻提示).toHaveBeenCalledWith('还有 1 处需要选择目录或补充必填项');
    // 删除未完成的第二条
    await 用户.click(screen.getByText('Second Corp'));
    await 用户.click(screen.getByText('删除这段经历'));
    // 回列表再保存：剩下的第一条完整，放行
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    const 存入 = 存简历调用们(mock应用状态.派发);
    expect(存入.at(-1)!.经历).toHaveLength(1);
    expect(存入.at(-1)!.经历[0].公司).toBe('Example Systems');
  });

  it('exact 引用齐全时保存照常发生：unresolvedCount 为 0 不拦截', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({ 预填: readyWork(), ...空列表页(), 保存简历 });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(mock轻提示).not.toHaveBeenCalledWith(expect.stringContaining('需要选择目录'));
    // 保存携带物化条目（prefill: 临时编号 + 隐私默认）与物化技能
    expect(保存简历).toHaveBeenCalledWith(expect.objectContaining({
      经历: [expect.objectContaining({ 编号: 'prefill:exp:0', 隐藏: true })],
      技能: ['Go'],
    }));
  });

  it('正常流程只物化一次：种入派发恰好一条，重渲染不重复种入', async () => {
    const { 派发, 重渲染 } = render工作经历({ 预填: readyWork(), ...空列表页() });
    expect(存简历调用们(派发)).toHaveLength(1);
    // 列表更新引发的自动重渲染之外，再显式触发一次重渲染：仍只有一条种入
    await act(async () => { 重渲染(); });
    expect(存简历调用们(派发)).toHaveLength(1);
  });

  it('保存成功后确认 work 分区（先于跳转），保存携带物化条目', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({ 预填: readyWork(), ...空列表页(), 保存简历 });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock确认分区).toHaveBeenCalledWith('work'));
    expect(mock确认分区.mock.invocationCallOrder[0]).toBeLessThan(mock跳转.mock.invocationCallOrder[0]);
    expect(mock跳转).toHaveBeenCalledWith(路径.引导问答);
  });

  it('保存被拒时 work 分区不确认、不跳转', async () => {
    const 保存简历 = vi.fn(async () => {
      throw new Error('保存失败');
    });
    render工作经历({ 预填: readyWork(), ...空列表页(), 保存简历 });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalled());
    expect(保存简历).toHaveBeenCalledTimes(1);
    expect(mock确认分区).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it.each([
    ['manual 轮', (轮: 候选预填状态) => { 轮.phase = 'manual'; }],
    ['work 已确认', (轮: 候选预填状态) => { 轮.confirmed.work = true; }],
    ['inactive 轮（无建议）', null],
  ])('%s 保留旧初始化（零种入派发）', (_名, 改) => {
    const 轮 = readyWork();
    if (改) 改(轮);
    const { 派发 } = render工作经历({ 预填: 改 ? 轮 : undefined, ...空列表页() });
    expect(screen.queryByText('Example Systems')).toBeNull();
    expect(screen.queryByText('Go')).toBeNull();
    expect(派发).not.toHaveBeenCalled();
  });
});
// ── M：空身份 + /basic 本地姓名草稿 —— 完整经历保存仍交给 操作.保存简历，
//    页面不自行把身份补成「在职」（profile 分区由数据源跳过，身份在状态页收口） ──
describe('工作经历 · 空身份经历保存（M）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
  });

  it('空身份 + 本地姓名草稿：保存简历 携带空身份原样，不虚构在职', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({
      数据源: 'backend',
      保存简历,
      基本信息: { 真名: '沈', 开始工作年: '', 身份: '' },
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 真名: '沈', 身份: '' }),
      经历: [expect.objectContaining({ 编号: 'e1', 公司: '字节跳动' })],
    }));
  });
});
