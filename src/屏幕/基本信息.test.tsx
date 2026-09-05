// 基本信息 页面预填接线测试（Spec §8 分页应用 /basic，Task 5）：
// 首挂载同步用 取基本信息预填 种入空白根字段（真名/性别/开始工作年）与页本地出生滚轮；
// 优先级：当前页面/服务端值 > eligible 建议 > 既有 UI 默认；status（身份）永不映射；
// 出生超界保留既有默认；确认 basic 分区只在既有 保存简历 resolve 之后、跳转之前，
// 拒绝时分区不确认。种入是挂载域的（非持久 touched）：basic 未确认前清空建议字段、
// 离开再回来会再次建议；非空编辑总是赢；manual 轮完全不再种 —— 这里逐条钉住。

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF简历预填建议 } from '../数据/BFF契约';
import { 性别已填变体 } from '../数据/招聘数据源/简历预填.fixture';
import { 路径 } from '../路由/路径表';
import { 创建空候选预填状态, type 候选预填Eligibility, type 候选预填状态 } from '../状态/后端/类型';
import type { 基本信息 as 基本信息类型 } from '../数据/类型';
import 基本信息 from './基本信息';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());
const mock操作 = {
  保存简历: vi.fn().mockResolvedValue(undefined),
  确认候选Onboarding预填分区: vi.fn(),
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

const 全可预填: 候选预填Eligibility = {
  profile: { real_name: true, work_start_year: true, gender: true, birth_year: true, birth_month: true, current_education: true },
  summary: true,
  skills: true,
  experiences: true,
  educations: true,
  certificates: true,
};

/** ready 轮 fixture（与 Task 2 映射测试同款形状）；深拷贝变体绝不改回不可变 wire fixture。 */
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

/** 全正向基本建议：真名/开始工作年来自 wire 基底，性别用 性别已填变体（female→女）；
 *  生日给与页面默认（1998/6）可区分的界内值。 */
function 正向基本建议(出生年 = 1995, 出生月 = 9): BFF简历预填建议 {
  const 建议 = 性别已填变体();
  建议.draft.profile.birth_year = { value: 出生年, confidence: 'medium' };
  建议.draft.profile.birth_month = { value: 出生月, confidence: 'medium' };
  return 建议;
}

/** 出生超界建议：年 2011 / 月 13（滚轮范围 1970..2010 / 1..12 之外）。 */
function 超界生日建议(): BFF简历预填建议 {
  return 正向基本建议(2011, 13);
}

interface 建状态参数 {
  基本信息?: Partial<基本信息类型>;
  候选预填?: 候选预填状态;
}

/**
 * 宿主组件：派发 存简历 就地合并根草稿后触发一次真实重渲染（模拟根 Resume
 * reducer 换新对象后的渲染），否则受控输入会被 React 恢复成上一次渲染的值。
 */
let 触发重渲染: (() => void) | null = null;

function 宿主() {
  const [, 设代] = useState(0);
  // 渲染期登记（早于子组件的 useLayoutEffect 种入派发）；设代 在同一挂载内稳定
  触发重渲染 = () => 设代((代) => 代 + 1);
  return (
    <MemoryRouter>
      <基本信息 />
    </MemoryRouter>
  );
}

/**
 * 可变的根草稿 mock：派发 存简历 就地合并 基本信息 并重渲染，
 * 让「离开再回来」的再挂载读到编辑后的草稿。
 */
function 建状态(选项: 建状态参数 = {}) {
  const 草稿: 基本信息类型 = { 真名: '', 开始工作年: '', 身份: '在职', ...选项.基本信息 };
  const 派发 = vi.fn((动作: { 型: string; 基本信息?: 基本信息类型 }) => {
    if (动作.型 === '存简历' && 动作.基本信息 !== undefined) {
      Object.assign(草稿, 动作.基本信息);
      触发重渲染?.();
    }
  });
  return {
    数据源模式: 'backend',
    状态: {
      基本信息: 草稿,
      简历经历: [],
      简历教育: [],
      简历技能: [],
      简历证书: [],
      个人优势: '',
    },
    后端状态: { 候选预填状态: 选项.候选预填 ?? 创建空候选预填状态() },
    操作: mock操作,
    派发,
  };
}

function render基本信息(选项: 建状态参数 & { 状态?: ReturnType<typeof 建状态> } = {}) {
  mock应用状态 = 选项.状态 ?? 建状态(选项);
  const 视图 = render(<宿主 />);
  return { 状态: mock应用状态, 派发: mock应用状态.派发 as ReturnType<typeof vi.fn>, 卸载: () => 视图.unmount() };
}

/** 滚轮档位断言：指定列（如 出生年）的某档必须是高亮选中档 */
function 选中档(列名: string, 档: string) {
  expect(
    within(screen.getByRole('listbox', { name: 列名 })).getByRole('option', { name: 档 }).getAttribute('aria-selected'),
  ).toBe('true');
}

/** 姓名输入框 */
function 姓名框(): HTMLInputElement {
  return screen.getByPlaceholderText('身份证上的名字') as HTMLInputElement;
}

/** 从派发记录里取第一条 存简历 动作（mock应用状态 是 any，这里手动补类型） */
function 首个存简历(派发: ReturnType<typeof vi.fn>): { 型: string; 基本信息: 基本信息类型 } {
  return (派发.mock.calls as { 型: string; 基本信息: 基本信息类型 }[][])
    .find(([动作]) => 动作.型 === '存简历')![0];
}

beforeEach(() => {
  mock跳转.mockClear();
  mock返回.mockClear();
  mock轻提示.mockClear();
});

describe('基本信息 预填种入', () => {
  it('ready 建议种入空白真名/性别/开始工作年与出生滚轮，status（身份）永不映射', () => {
    const { 派发 } = render基本信息({ 候选预填: readyState(正向基本建议()) });
    expect(姓名框().value).toBe('Synthetic Candidate');
    // 性别：female → 女被预选
    expect(screen.getByRole('button', { name: '女' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '男' }).getAttribute('aria-pressed')).toBe('false');
    // 非学生：开始工作年 2021（既有显示是 当前年 兜底，可区分）
    expect(screen.getByText('2021 年')).toBeTruthy();
    // 出生滚轮：页本地数字态初值
    选中档('出生年', '1995');
    选中档('出生月', '9');
    // status：种入派发不写 身份/在读学历/毕业年，草稿身份保持 在职
    const 存简历动作 = 首个存简历(派发);
    expect(存简历动作.基本信息.身份).toBe('在职');
    expect(存简历动作.基本信息).not.toHaveProperty('在读学历');
    expect(存简历动作.基本信息).not.toHaveProperty('毕业年');
  });

  it('出生年/月超出 1970..2010 / 1..12 时保留既有默认（1998/6），其余建议照常种入', () => {
    render基本信息({ 候选预填: readyState(超界生日建议()) });
    选中档('出生年', '1998');
    选中档('出生月', '6');
    expect(姓名框().value).toBe('Synthetic Candidate');
  });

  it('学生不种开始工作年（在校分支不显示该行）', () => {
    const { 派发 } = render基本信息({ 基本信息: { 身份: '在校' }, 候选预填: readyState(正向基本建议()) });
    expect(screen.queryByText(/开始工作年份/)).toBeNull();
    const 存简历动作 = 首个存简历(派发);
    expect(存简历动作.基本信息.开始工作年).toBe('');
  });

  it('当前页面非空值优先：已填的真名/性别不被建议覆盖，空白生日仍种入', () => {
    render基本信息({
      基本信息: { 真名: '张三', 性别: '男' },
      候选预填: readyState(正向基本建议()),
    });
    expect(姓名框().value).toBe('张三');
    expect(screen.getByRole('button', { name: '男' }).getAttribute('aria-pressed')).toBe('true');
    选中档('出生年', '1995');
    选中档('出生月', '9');
  });

  it.each([
    ['manual 轮', (状态: 候选预填状态) => { 状态.phase = 'manual'; }],
    ['inactive 轮', (状态: 候选预填状态) => { 状态.phase = 'inactive'; }],
    ['basic 已确认', (状态: 候选预填状态) => { 状态.confirmed.basic = true; }],
    ['eligibility 记录服务端已有值', (状态: 候选预填状态) => {
      状态.eligibility = {
        ...全可预填,
        profile: { real_name: false, work_start_year: false, gender: false, birth_year: false, birth_month: false, current_education: false },
      };
    }],
  ])('%s 保留旧初始化（零种入派发）', (_名, 改) => {
    const 轮 = readyState(正向基本建议());
    改(轮);
    const { 派发 } = render基本信息({ 候选预填: 轮 });
    expect(姓名框().value).toBe('');
    expect(screen.getByRole('button', { name: '女' }).getAttribute('aria-pressed')).toBe('false');
    选中档('出生年', '1998');
    选中档('出生月', '6');
    expect(派发).not.toHaveBeenCalled();
  });
});

describe('基本信息 分区确认时序', () => {
  it('确认 basic 只在既有保存 resolve 之后、跳转之前', async () => {
    let 解决!: () => void;
    const 门 = new Promise<void>((就绪) => { 解决 = 就绪; });
    mock操作.保存简历.mockReturnValueOnce(门);
    render基本信息({ 候选预填: readyState(正向基本建议()) });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(mock操作.保存简历).toHaveBeenCalledTimes(1);
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    解决();
    await waitFor(() => expect(mock操作.确认候选Onboarding预填分区).toHaveBeenCalledWith('basic'));
    expect(mock操作.确认候选Onboarding预填分区.mock.invocationCallOrder[0]!)
      .toBeLessThan(mock跳转.mock.invocationCallOrder[0]!);
    expect(mock跳转).toHaveBeenCalledWith(路径.求职状态);
  });

  it('保存被拒时 basic 分区不确认、不跳转', async () => {
    mock操作.保存简历.mockRejectedValueOnce(new Error('保存失败'));
    render基本信息({ 候选预填: readyState(正向基本建议()) });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalled());
    expect(mock操作.保存简历).toHaveBeenCalledTimes(1);
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('保存携带根草稿与页本地出生滚轮值', async () => {
    render基本信息({ 候选预填: readyState(正向基本建议()) });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalled());
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({
        真名: 'Synthetic Candidate',
        性别: '女',
        开始工作年: '2021',
        出生年: '1995',
        出生月: '9',
        身份: '在职',
      }),
    }));
  });
});

describe('基本信息 根草稿保持（离开再回来）', () => {
  it('编辑过的真名/性别/开始工作年在返回再进入后保留（非空编辑赢过建议）', async () => {
    const 第一次 = render基本信息({ 候选预填: readyState(正向基本建议()) });
    const 用户 = userEvent.setup();
    await 用户.clear(姓名框());
    await 用户.type(姓名框(), '李四');
    await 用户.click(screen.getByRole('button', { name: '男' }));
    // 开始工作年走既有数字滚轮层：打开 → 直选 2019 → 完成
    await 用户.click(screen.getByRole('button', { name: /开始工作年份/ }));
    const 年轮 = screen.getByRole('listbox', { name: '开始工作年份' });
    await 用户.click(within(年轮).getByRole('option', { name: '2019' }));
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    第一次.卸载();
    // 只统计再进入这一程的种入派发（第一程的键入/种入已结算）
    第一次.派发.mockClear();

    // 同一 ready 且 basic 未确认的轮在场：再进入也不覆盖非空编辑
    const 第二次 = render基本信息({ 状态: 第一次.状态 });
    expect(姓名框().value).toBe('李四');
    expect(screen.getByRole('button', { name: '男' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('2019 年')).toBeTruthy();
    // 再进入的种入派发为空：当前值优先，不再写根草稿
    const 种入派发 = 第二次.派发.mock.calls.filter(([动作]) => 动作.型 === '存简历');
    expect(种入派发).toHaveLength(0);
  });

  it('basic 未确认时清空建议字段、离开再回来会再次建议（挂载域 touched，接受的边界）', async () => {
    const 第一次 = render基本信息({ 候选预填: readyState(正向基本建议()) });
    const 用户 = userEvent.setup();
    await 用户.clear(姓名框());
    第一次.卸载();
    render基本信息({ 状态: 第一次.状态 });
    expect(姓名框().value).toBe('Synthetic Candidate');
  });

  it('manual 轮清空后离开再回来不再种入', async () => {
    const 轮 = readyState(正向基本建议());
    轮.phase = 'manual';
    const 第一次 = render基本信息({ 候选预填: 轮 });
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '王五');
    await 用户.clear(姓名框());
    第一次.卸载();
    render基本信息({ 状态: 第一次.状态 });
    expect(姓名框().value).toBe('');
  });
});

// ── M：空身份 —— /basic 延迟 profile 写入，状态页收口 ──
describe('基本信息 · 空身份延迟 profile（M）', () => {
  beforeEach(() => {
    mock操作.保存简历.mockClear();
    mock操作.确认候选Onboarding预填分区.mockClear();
  });

  it('Backend 非学生空身份：下一步只存页面草稿、零保存、跳求职状态、不确认 basic', async () => {
    const { 派发 } = render基本信息({ 基本信息: { 身份: '' } });
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '沈');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({
      型: '存简历',
      基本信息: expect.objectContaining({ 真名: '沈', 身份: '' }),
    }));
    expect(mock操作.保存简历).not.toHaveBeenCalled();
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    expect(mock跳转).toHaveBeenCalledWith(路径.求职状态);
  });

  it('Backend 已有身份（在职）仍走既有 operation，成功后确认 basic', async () => {
    render基本信息({ 基本信息: { 真名: '沈', 身份: '在职' } });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.确认候选Onboarding预填分区).toHaveBeenCalledWith('basic');
    expect(mock跳转).toHaveBeenCalledWith(路径.求职状态);
  });

  it('Backend 学生 在校 仍走既有 operation 并跳最高学历', async () => {
    render基本信息({ 基本信息: { 真名: '沈', 身份: '在校' } });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.确认候选Onboarding预填分区).toHaveBeenCalledWith('basic');
    expect(mock跳转).toHaveBeenCalledWith(路径.最高学历);
  });
});

// ── L：空生日不保存显示落点 —— 滚轮显示值与确认态分离 ──
// 未确认时保存 null 语义（不向草稿加入出生年月）；已有值/真实建议/用户滚动才落双值。
describe('基本信息 · 空生日确认分离（L）', () => {
  beforeEach(() => {
    mock操作.保存简历.mockClear();
    mock操作.确认候选Onboarding预填分区.mockClear();
  });

  it('空生日直接下一步不写 1998-06', async () => {
    render基本信息({ 基本信息: { 身份: '在职' } });
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '沈');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.not.objectContaining({ 出生年: '1998', 出生月: '6' }),
    }));
  });

  it('已有完整 2000/9 保存对应双值', async () => {
    render基本信息({ 基本信息: { 身份: '在职', 出生年: '2000', 出生月: '9' } });
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '沈');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 出生年: '2000', 出生月: '9' }),
    }));
  });

  it('完整真实预填建议保存建议双值（1995/9）', async () => {
    render基本信息({ 基本信息: { 身份: '在职' }, 候选预填: readyState(正向基本建议(1995, 9)) });
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '沈');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 出生年: '1995', 出生月: '9' }),
    }));
  });

  it('只有单边已有年份时不保存两项', async () => {
    render基本信息({ 基本信息: { 身份: '在职', 出生年: '2000' } });
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '沈');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.not.objectContaining({ 出生年: expect.anything(), 出生月: expect.anything() }),
    }));
  });

  it('Backend 用户滚动任一轮后保存当前双值', async () => {
    render基本信息({ 基本信息: { 身份: '在职' } });
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '沈');
    // 滚动出生年轮：确认态置位
    const 年轮 = screen.getByRole('listbox', { name: '出生年' });
    await 用户.click(within(年轮).getByRole('option', { name: '2001' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 出生年: '2001', 出生月: '6' }),
    }));
  });
});

describe('基本信息 · Mock 空资料生日演示默认（L 对照）', () => {
  it('Mock 空资料仍保存既有 1998/6 演示默认', async () => {
    mock操作.保存简历.mockClear();
    mock应用状态 = {
      数据源模式: 'mock',
      状态: {
        基本信息: { 真名: '沈', 开始工作年: '', 身份: '在职' as const },
        简历经历: [], 简历教育: [], 简历技能: [], 简历证书: [], 个人优势: '',
      },
      后端状态: { 候选预填状态: 创建空候选预填状态() },
      操作: mock操作,
      派发: vi.fn(),
    };
    render(<宿主 />);
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 出生年: '1998', 出生月: '6' }),
    }));
  });
});
