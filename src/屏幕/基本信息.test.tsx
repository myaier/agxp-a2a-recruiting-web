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
import { 创建候选编辑来路 } from '../流程/候选日常编辑';
import { 创建空候选预填状态, type 候选预填Eligibility, type 候选预填状态 } from '../状态/后端/类型';
import type { 基本信息 as 基本信息类型 } from '../数据/类型';
import type { 候选引导建档草稿 } from '../数据/资料缓存';
import 基本信息 from './基本信息';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock替换跳转 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());
const mock操作 = {
  保存简历: vi.fn().mockResolvedValue(undefined),
  确认候选Onboarding预填分区: vi.fn(),
  更新候选建档草稿: vi.fn(),
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 跳转: mock跳转, 返回: mock返回, 替换跳转: mock替换跳转 }),
}));
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
  /** J-PILOT-02 Task 4：会话里恢复出来的建档草稿（刷新后 Context 是空的，草稿不是）*/
  建档?: 候选引导建档草稿;
}

/**
 * 宿主组件：派发 存简历 就地合并根草稿后触发一次真实重渲染（模拟根 Resume
 * reducer 换新对象后的渲染），否则受控输入会被 React 恢复成上一次渲染的值。
 */
let 触发重渲染: (() => void) | null = null;

/** 位置既可以给裸字符串，也可以给带 state 的完整位置（日常编辑的来路证明走 state）*/
type 入口形 = string | { pathname: string; search?: string; state?: unknown };

function 宿主({ 入口 }: { 入口?: 入口形 } = {}) {
  const [, 设代] = useState(0);
  // 渲染期登记（早于子组件的 useLayoutEffect 种入派发）；设代 在同一挂载内稳定
  触发重渲染 = () => 设代((代) => 代 + 1);
  return (
    <MemoryRouter initialEntries={[入口 ?? '/basic']}>
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
      引导预填: 选项.建档 === undefined ? null : { 城市们: [], 职位: [], 建档: 选项.建档 },
    },
    后端状态: { 候选预填状态: 选项.候选预填 ?? 创建空候选预填状态() },
    操作: mock操作,
    派发,
  };
}

function render基本信息(选项: 建状态参数 & { 状态?: ReturnType<typeof 建状态>; 入口?: 入口形 } = {}) {
  mock应用状态 = 选项.状态 ?? 建状态(选项);
  const 视图 = render(<宿主 入口={选项.入口} />);
  return {
    状态: mock应用状态,
    派发: mock应用状态.派发 as ReturnType<typeof vi.fn>,
    卸载: () => 视图.unmount(),
    /** 同一 Provider 状态换新对象后的整树重渲染（模拟权威快照水合落地）*/
    重渲染: () => 视图.rerender(<宿主 入口={选项.入口} />),
  };
}

/** 滚轮档位断言：指定列（如 出生年）的某档必须是高亮选中档 */
function 选中档(列名: string, 档: string) {
  expect(
    within(screen.getByRole('listbox', { name: 列名 })).getByRole('option', { name: 档 }).getAttribute('aria-selected'),
  ).toBe('true');
}

/** 打开出生年月抽屉（picker 统一 Task 3）：滚轮搬进抽屉，不再常驻页面 */
async function 打开生日抽屉(用户: ReturnType<typeof userEvent.setup>) {
  await 用户.click(screen.getByRole('button', { name: /出生年月/ }));
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
  mock替换跳转.mockClear();
  mock轻提示.mockClear();
  window.history.replaceState(null, '');
});

describe('基本信息 预填种入', () => {
  it('ready 建议种入空白真名/性别/开始工作年与出生抽屉，status（身份）永不映射', async () => {
    const { 派发 } = render基本信息({ 候选预填: readyState(正向基本建议()) });
    expect(姓名框().value).toBe('Synthetic Candidate');
    // 性别：female → 女被预选
    expect(screen.getByRole('button', { name: '女' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '男' }).getAttribute('aria-pressed')).toBe('false');
    // 非学生：开始工作年 2021（既有显示是 当前年 兜底，可区分）
    expect(screen.getByText('2021 年')).toBeTruthy();
    // 出生抽屉：显式打开检查滚轮初值（完整可用预填已确认，父行直接回显）
    expect(screen.getByRole('button', { name: /出生年月/ }).textContent).toContain('1995 年 09 月');
    const 用户 = userEvent.setup();
    await 打开生日抽屉(用户);
    选中档('出生年', '1995');
    选中档('出生月', '9');
    // status：种入派发不写 身份/在读学历/毕业年，草稿身份保持 在职
    const 存简历动作 = 首个存简历(派发);
    expect(存简历动作.基本信息.身份).toBe('在职');
    expect(存简历动作.基本信息).not.toHaveProperty('在读学历');
    expect(存简历动作.基本信息).not.toHaveProperty('毕业年');
  });

  it('出生年/月超出 1970..2010 / 1..12 时保留既有默认（1998/6），其余建议照常种入', async () => {
    render基本信息({ 候选预填: readyState(超界生日建议()) });
    // 超界建议映射层落 undefined：父行不回显（未确认），抽屉里仍是 1998/6 临时落点
    expect(screen.getByRole('button', { name: /出生年月/ }).textContent).toContain('未填写');
    const 用户 = userEvent.setup();
    await 打开生日抽屉(用户);
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

  it('当前页面非空值优先：已填的真名/性别不被建议覆盖，空白生日仍种入', async () => {
    render基本信息({
      基本信息: { 真名: '张三', 性别: '男' },
      候选预填: readyState(正向基本建议()),
    });
    expect(姓名框().value).toBe('张三');
    expect(screen.getByRole('button', { name: '男' }).getAttribute('aria-pressed')).toBe('true');
    const 用户 = userEvent.setup();
    await 打开生日抽屉(用户);
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
  ])('%s 保留旧初始化（零种入派发）', async (_名, 改) => {
    const 轮 = readyState(正向基本建议());
    改(轮);
    const { 派发 } = render基本信息({ 候选预填: 轮 });
    expect(姓名框().value).toBe('');
    expect(screen.getByRole('button', { name: '女' }).getAttribute('aria-pressed')).toBe('false');
    const 用户 = userEvent.setup();
    await 打开生日抽屉(用户);
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
    // 引导旅程不传保存来源（缺省 = onboarding 跟踪语义）
    expect(mock操作.保存简历.mock.calls.at(-1)).toHaveLength(1);
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
    await 用户.click(screen.getByRole('button', { name: '确定' }));
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

  it('Backend 学生 在校 同样先收口求职状态（Task 3 取消学生专属分叉）', async () => {
    render基本信息({ 基本信息: { 真名: '沈', 身份: '在校' } });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.确认候选Onboarding预填分区).toHaveBeenCalledWith('basic');
    expect(mock跳转).toHaveBeenCalledWith(路径.求职状态);
    expect(mock跳转).not.toHaveBeenCalledWith(路径.最高学历);
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

  it('Backend 用户抽屉只改年并确定后保存当前双值（临时月一起落盘）', async () => {
    render基本信息({ 基本信息: { 身份: '在职' } });
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '沈');
    // 打开抽屉只改年、点确定：确认态置位，未动过的月沿用临时落点 6
    await 打开生日抽屉(用户);
    await 用户.click(within(screen.getByRole('listbox', { name: '出生年' })).getByRole('option', { name: '2001' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
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

// ── J-PILOT-02 Task 4：建档草稿接线（刷新不丢输入 / 回带未结算写入槽）──
describe('基本信息 · 建档草稿接线（Task 4）', () => {
  beforeEach(() => {
    mock操作.保存简历.mockClear();
    mock操作.确认候选Onboarding预填分区.mockClear();
    mock操作.更新候选建档草稿.mockClear();
  });

  it('输入真名写进建档草稿，并原样回带未结算的 待写入 槽', async () => {
    const 槽 = { 种类: 'profile' as const, 幂等键: 'k1', 阶段: 'prepared' as const };
    render基本信息({ 基本信息: { 身份: '在职' }, 建档: { 待写入: 槽 } });
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '沈');
    const 末次 = mock操作.更新候选建档草稿.mock.calls.at(-1)![0];
    expect(末次.资料.基本信息.真名).toBe('沈');
    // 省略 待写入 = 清槽：接线漏带就会把在飞命令丢掉，刷新后重复 POST
    expect(末次.待写入).toEqual(槽);
  });

  it('刷新后 Context 为空：草稿里的真名/性别/出生年月回到表单并随保存落盘', async () => {
    render基本信息({
      基本信息: { 真名: '', 身份: '在职' },
      建档: { 资料: { 基本信息: { 真名: '沈星', 性别: '女', 出生年: '2000', 出生月: '9' } } },
    });
    expect(姓名框().value).toBe('沈星');
    expect(screen.getByRole('button', { name: '女' }).getAttribute('aria-pressed')).toBe('true');
    // 草稿里的完整生日已确认：显式打开抽屉核对滚轮回显
    const 打开用户 = userEvent.setup();
    await 打开生日抽屉(打开用户);
    选中档('出生年', '2000');
    选中档('出生月', '9');
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 真名: '沈星', 性别: '女', 出生年: '2000', 出生月: '9' }),
    }));
  });

  it('空身份不保存的那一步也把姓名/生日写进草稿（刷新后由求职状态收口）', async () => {
    // 建档: {} 只表示「注册旅程进行中」（学生分流 的 启程引导 已落 引导预填），草稿还是空的
    render基本信息({ 基本信息: { 身份: '' }, 建档: {} });
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '沈');
    await 打开生日抽屉(用户);
    await 用户.click(within(screen.getByRole('listbox', { name: '出生年' })).getByRole('option', { name: '2001' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(mock操作.保存简历).not.toHaveBeenCalled();
    const 末次 = mock操作.更新候选建档草稿.mock.calls.at(-1)![0];
    expect(末次.资料.基本信息).toEqual(expect.objectContaining({ 真名: '沈', 出生年: '2001', 出生月: '6' }));
  });
});

// ── 出生年月抽屉（picker 统一 Task 3）：内嵌双滚轮改共用 年月滚轮层。
//    父行只有 出生年月已确认 才显示年月，Backend 未确认显示 未填写；
//    打开 / 滚动 / 取消零写入，只有 确定 才成对回填并置确认标志。──
describe('基本信息 · 出生年月抽屉（picker 统一 Task 3）', () => {
  beforeEach(() => {
    mock操作.保存简历.mockClear();
    mock操作.确认候选Onboarding预填分区.mockClear();
    mock操作.更新候选建档草稿.mockClear();
  });

  it('生日未确认：父行显示未填写，打开改值后取消，下一步不写生日', async () => {
    render基本信息({ 基本信息: { 身份: '在职' } });
    const 用户 = userEvent.setup();
    const 行 = screen.getByRole('button', { name: /出生年月/ });
    expect(行.textContent).toContain('未填写');
    await 用户.click(行);
    // 抽屉内沿用 1998/6 临时落点（显示值 ≠ 确认态）
    选中档('出生年', '1998');
    选中档('出生月', '6');
    // 改值后取消：不回填、确认态仍为 false
    await 用户.click(within(screen.getByRole('listbox', { name: '出生月' })).getByRole('option', { name: '3' }));
    await 用户.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /出生年月/ }).textContent).toContain('未填写');
    await 用户.type(姓名框(), '沈');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.not.objectContaining({ 出生年: expect.anything(), 出生月: expect.anything() }),
    }));
  });

  it('确定后成对写入并点亮父行，保存双值', async () => {
    render基本信息({ 基本信息: { 身份: '在职' } });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: /出生年月/ }));
    await 用户.click(within(screen.getByRole('listbox', { name: '出生年' })).getByRole('option', { name: '2001' }));
    await 用户.click(within(screen.getByRole('listbox', { name: '出生月' })).getByRole('option', { name: '9' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /出生年月/ }).textContent).toContain('2001 年 09 月');
    await 用户.type(姓名框(), '沈');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 出生年: '2001', 出生月: '9' }),
    }));
  });
});

// ── 日常编辑（Task 1 / Spec §5）：from=resume 是 /basic 唯一合法的日常来源 ──
// 标题「编辑基本信息」，输入只进局部草稿（零提前 dispatch），明确的「保存」才提交
//（一次 保存简历 + 日常编辑），然后按来路退出；取消/返回退出整链不写；空身份保存
// 在同页切到状态收口子视图（保留局部基本草稿，不 push、不写全局）；刷新丢草稿读权威。
describe('基本信息 · 日常编辑（from=resume）', () => {
  beforeEach(() => {
    mock操作.保存简历.mockClear().mockResolvedValue(undefined);
    mock操作.确认候选Onboarding预填分区.mockClear();
    mock操作.更新候选建档草稿.mockClear();
  });

  it('标题为「编辑基本信息」、按钮为保存（不再叫创建在线简历/下一步）', () => {
    // 建档在场：证明日常来源赢过 引导预填 非空 —— 旅程判定必须为 false
    render基本信息({
      基本信息: { 真名: '沈', 身份: '在职' },
      建档: { 资料: { 个人优势: '旧' } },
      入口: '/basic?from=resume',
    });
    expect(screen.getByRole('heading', { name: '编辑基本信息' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '创建在线简历' })).toBeNull();
    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '下一步' })).toBeNull();
  });

  it('输入只进局部草稿：改名/改性别/改开始工作年都不提前 dispatch 已保存态', async () => {
    const { 派发 } = render基本信息({ 基本信息: { 真名: '沈', 身份: '在职' }, 入口: '/basic?from=resume' });
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '亦舟');
    await 用户.click(screen.getByRole('button', { name: '女' }));
    await 用户.click(screen.getByRole('button', { name: /开始工作年份/ }));
    await 用户.click(within(screen.getByRole('listbox', { name: '开始工作年份' })).getByRole('option', { name: '2019' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(姓名框().value).toBe('沈亦舟');
    expect(screen.getByRole('button', { name: '女' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('2019 年')).toBeTruthy();
    expect(派发).not.toHaveBeenCalled();
    expect(mock操作.保存简历).not.toHaveBeenCalled();
    expect(mock操作.更新候选建档草稿).not.toHaveBeenCalled();
  });

  it('保存：一次 保存简历 带本次输入与 日常编辑，然后退一格回我的简历', async () => {
    window.history.replaceState({ idx: 4 }, '');
    const 来路 = 创建候选编辑来路('resume');
    window.history.replaceState({ idx: 5 }, ''); // 源列表点击 push 一格后的编辑页格号
    const { 派发 } = render基本信息({
      基本信息: { 真名: '沈', 身份: '在职' },
      入口: { pathname: '/basic', search: '?from=resume', state: 来路 },
    });
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '亦舟');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 真名: '沈亦舟', 身份: '在职' }),
    }), '日常编辑'); // fix-r1：日常编辑保存显式绕过 onboarding 跟踪
    expect(派发).not.toHaveBeenCalled();
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    expect(mock操作.更新候选建档草稿).not.toHaveBeenCalled();
    expect(mock返回).toHaveBeenCalledTimes(1);
    expect(mock替换跳转).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('取消（顶部返回）退出整链不写：零派发、零保存调用', async () => {
    const { 派发 } = render基本信息({ 基本信息: { 真名: '沈', 身份: '在职' }, 入口: '/basic?from=resume' });
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '亦舟');
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(派发).not.toHaveBeenCalled();
    expect(mock操作.保存简历).not.toHaveBeenCalled();
    // 无来路证明（测试位置没有 state）→ 安全替换回我的简历，不盲退
    expect(mock替换跳转).toHaveBeenCalledWith(路径.我的简历);
    expect(mock返回).not.toHaveBeenCalled();
  });

  it('学生（在校）日常保存：同样一次 保存简历，不进最高学历', async () => {
    render基本信息({ 基本信息: { 真名: '沈', 身份: '在校' }, 入口: '/basic?from=resume' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 身份: '在校' }),
    }), '日常编辑');
    expect(mock跳转).not.toHaveBeenCalledWith(路径.最高学历);
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
  });

  it('保存失败：轻提示并留在本页，不退出不确认分区', async () => {
    mock操作.保存简历.mockRejectedValueOnce(new Error('offline'));
    render基本信息({ 基本信息: { 真名: '沈', 身份: '在职' }, 入口: '/basic?from=resume' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalled());
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).not.toHaveBeenCalled();
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
  });

  it('必填不跳过：空真名点保存只提示，零派发零保存零退出', async () => {
    render基本信息({ 基本信息: { 真名: '', 身份: '在职' }, 入口: '/basic?from=resume' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock轻提示).toHaveBeenCalledWith('填一下真名，递交简历（S1）原件时即向招聘方显示');
    expect(mock应用状态.派发).not.toHaveBeenCalled();
    expect(mock操作.保存简历).not.toHaveBeenCalled();
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).not.toHaveBeenCalled();
  });

  it('背景权威刷新不覆盖正在编辑的局部输入', async () => {
    const 视图 = render基本信息({ 基本信息: { 真名: '沈', 身份: '在职' }, 入口: '/basic?from=resume' });
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '亦舟');
    // 背景权威快照换新（水合落地/他处写入）后整树重渲染
    视图.状态.状态.基本信息 = { ...视图.状态.状态.基本信息, 真名: '权威新值', 性别: '女' };
    视图.重渲染();
    expect(姓名框().value).toBe('沈亦舟');
    expect(screen.getByRole('button', { name: '女' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('保存 single-flight：在途期间重复点击只发一次', async () => {
    let 放行!: () => void;
    mock操作.保存简历.mockImplementationOnce(() => new Promise<void>((解决) => { 放行 = 解决; }));
    render基本信息({ 基本信息: { 真名: '沈', 身份: '在职' }, 入口: '/basic?from=resume' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock操作.保存简历).toHaveBeenCalledTimes(1);
    放行();
    await waitFor(() => expect(mock替换跳转).toHaveBeenCalledWith(路径.我的简历));
    expect(mock操作.保存简历).toHaveBeenCalledTimes(1);
  });

  it('刷新（同 URL 重挂载）丢未保存输入、读权威值，且零预填种入', async () => {
    const 第一次 = render基本信息({
      基本信息: { 真名: '沈', 身份: '在职' },
      候选预填: readyState(正向基本建议()),
      入口: '/basic?from=resume',
    });
    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy();
    expect(第一次.派发).not.toHaveBeenCalled();
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '亦舟'); // 未保存输入
    expect(姓名框().value).toBe('沈亦舟');
    第一次.卸载();
    // 重挂载 = 刷新：未保存输入不承诺持久化，读回权威值
    const 第二次 = render基本信息({
      基本信息: { 真名: '沈', 身份: '在职' },
      候选预填: readyState(正向基本建议()),
      入口: '/basic?from=resume',
    });
    expect(姓名框().value).toBe('沈');
    expect(第二次.派发).not.toHaveBeenCalled();
  });
});

// ── 错配来源（review fix-1）：/basic 只认 from=resume，其余来源值等同无来源 ──
// 边界层对同一 URL 的判定（消费位/活跃位）与页面层必须同一口径：错配来源不得让页面
// 走注册旅程、而边界层当作已离开活跃集合，也不得反过来让页面按日常渲染。
describe('基本信息 · 错配来源等同无来源（/basic 只认 from=resume）', () => {
  beforeEach(() => {
    mock操作.保存简历.mockClear().mockResolvedValue(undefined);
    mock操作.确认候选Onboarding预填分区.mockClear();
    mock操作.更新候选建档草稿.mockClear();
  });

  it.each(['?from=intentions', '?from=evil'])('%s：按注册旅程语义渲染与保存', async (search) => {
    render基本信息({
      基本信息: { 真名: '沈', 身份: '在职' },
      建档: { 资料: { 个人优势: '旧' } }, // 旅程在场：证明错配来源没有把它挤成日常
      入口: `/basic${search}`,
    });
    expect(screen.getByRole('heading', { name: '创建在线简历' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '编辑基本信息' })).toBeNull();
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    // 注册旅程不传保存来源、确认 basic 分区（日常模式两者都不做）
    expect(mock操作.保存简历.mock.calls.at(-1)).toHaveLength(1);
    expect(mock操作.确认候选Onboarding预填分区).toHaveBeenCalledWith('basic');
  });

  it('错配来源且空身份：落回注册旅程的收口（派发草稿 + 裸跳状态页，不进日常子视图）', async () => {
    const { 派发 } = render基本信息({ 基本信息: { 真名: '沈', 身份: '' }, 入口: '/basic?from=intentions' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({
      型: '存简历',
      基本信息: expect.objectContaining({ 真名: '沈', 身份: '' }),
    }));
    expect(mock跳转).toHaveBeenCalledWith(路径.求职状态);
    // 日常同页收口子视图（from=resume 的路径）一次都不出现
    expect(screen.queryByRole('button', { name: '在校' })).toBeNull();
    expect(mock操作.保存简历).not.toHaveBeenCalled();
  });
});

// ── 空身份日常保存：同一挂载页切状态收口子视图（Task 1 Step 4）──
// 不 push 新页、不写全局；选择合法状态后点保存用合并后的基本信息一次进入保存简历；
// 成功退出原编辑链；返回/取消退出整链不写；失败保留草稿；刷新丢弃未保存输入。
describe('基本信息 · 空身份同页收口（from=resume）', () => {
  beforeEach(() => {
    mock操作.保存简历.mockClear().mockResolvedValue(undefined);
    mock操作.确认候选Onboarding预填分区.mockClear();
    mock操作.更新候选建档草稿.mockClear();
  });

  const 三态 = ['在校', '在职', '离职'] as const;

  it('空身份点保存：同页切到三态收口子视图，保留基本草稿、零写零跳转', async () => {
    const { 派发 } = render基本信息({ 基本信息: { 真名: '沈', 身份: '' }, 入口: '/basic?from=resume' });
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '亦舟');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    // 三态正文进场，空值不假选
    for (const 档 of 三态) {
      expect(screen.getByRole('button', { name: 档 }).getAttribute('aria-pressed')).toBe('false');
    }
    expect(screen.queryByText(/随时到岗|考虑机会|暂不考虑/)).toBeNull();
    expect(派发).not.toHaveBeenCalled();
    expect(mock操作.保存简历).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).not.toHaveBeenCalled();
  });

  it('子视图选合法状态后保存：合并后的基本信息一次进入 保存简历 并退出整链', async () => {
    window.history.replaceState({ idx: 2 }, '');
    const 来路 = 创建候选编辑来路('resume');
    window.history.replaceState({ idx: 3 }, '');
    const { 派发 } = render基本信息({
      基本信息: { 真名: '沈', 身份: '', 出生年: '2000', 出生月: '9' },
      入口: { pathname: '/basic', search: '?from=resume', state: 来路 },
    });
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '亦舟');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await 用户.click(screen.getByRole('button', { name: '在职' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({
        真名: '沈亦舟',
        身份: '在职',
        出生年: '2000',
        出生月: '9',
      }),
    }), '日常编辑');
    expect(派发).not.toHaveBeenCalled();
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    expect(mock操作.更新候选建档草稿).not.toHaveBeenCalled();
    expect(mock返回).toHaveBeenCalledTimes(1);
    expect(mock跳转).not.toHaveBeenCalledWith(路径.求职状态);
  });

  it('子视图未选状态点保存：只提示，零保存零退出（空值不写非法状态）', async () => {
    render基本信息({ 基本信息: { 真名: '沈', 身份: '' }, 入口: '/basic?from=resume' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock轻提示).toHaveBeenCalledWith('请选择当前求职状态');
    expect(mock操作.保存简历).not.toHaveBeenCalled();
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).not.toHaveBeenCalled();
  });

  it('子视图返回退出整链不写：零派发、零保存', async () => {
    const { 派发 } = render基本信息({ 基本信息: { 真名: '沈', 身份: '' }, 入口: '/basic?from=resume' });
    const 用户 = userEvent.setup();
    await 用户.type(姓名框(), '亦舟');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(派发).not.toHaveBeenCalled();
    expect(mock操作.保存简历).not.toHaveBeenCalled();
    expect(mock替换跳转).toHaveBeenCalledWith(路径.我的简历);
  });

  it('子视图保存失败：保留草稿留页可重试，零退出', async () => {
    mock操作.保存简历.mockRejectedValueOnce(new Error('offline'));
    render基本信息({ 基本信息: { 真名: '沈', 身份: '' }, 入口: '/basic?from=resume' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await 用户.click(screen.getByRole('button', { name: '在校' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalled());
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).not.toHaveBeenCalled();
    // 草稿仍在（选项保持选中），重试仍带同一个身份
    expect(screen.getByRole('button', { name: '在校' }).getAttribute('aria-pressed')).toBe('true');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(2));
    expect(mock操作.保存简历).toHaveBeenLastCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 真名: '沈', 身份: '在校' }),
    }), '日常编辑');
  });
});
