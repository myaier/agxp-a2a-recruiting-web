// 就读时间段 页面预填接线测试（Spec §8 分页应用 /onboard/eduyears）：
// 首挂载同步用 取就读年份预填 预选年份（仅 2000..2030 界内年份才预选，
// 缺席就是空值）；学生 end month 缺失可回退 graduation_year；
// 确认 education_period 分区只在既有保存 resolve 之后、跳转之前，拒绝时分区不确认。
// Task 4：2021/2025 演示预填迁到数据层显式 Mock 种子（就读年份演示预填）。
// bottom-drawer 统一 Task 4：页内双滚轮改年份区间抽屉入口 —— 预填/空态断言通过
// 打开共用抽屉查看两列档位；确定才原子回填并写草稿，取消零写入。

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF简历预填建议 } from '../数据/BFF契约';
import { 就读年份演示预填 } from '../数据/模拟数据';
import { 构造映射变体基底 } from '../数据/招聘数据源/简历预填.fixture';
import { 路径 } from '../路由/路径表';
import { 创建空候选预填状态, type 候选预填Eligibility, type 候选预填状态 } from '../状态/后端/类型';
import { 创建初始状态 } from '../状态/初始状态';
import type { 简历教育段 } from '../数据/类型';
import type { 候选引导建档草稿 } from '../数据/资料缓存';
import 就读时间段 from './就读时间段';
import 样式 from './入职引导.module.css';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());
const mock操作 = {
  保存简历: vi.fn().mockResolvedValue(undefined),
  确认候选Onboarding预填分区: vi.fn(),
  更新候选建档草稿: vi.fn(),
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

/** 前三页走完后的空教育段（开始/结束为空 → 入口两侧「请选择」占位） */
function 空白首段(): 简历教育段[] {
  return [{ 编号: 'edu1', 学校: 'Example University', 学历: '本科', 专业: 'Computer Science', 开始: '', 结束: '' }];
}

/** 深拷贝 wire 基底改写出映射边界样本（超界/缺席），不触碰不可变 fixture */
function 映射变体(改写: (建议: BFF简历预填建议) => void): BFF简历预填建议 {
  const 副本 = 构造映射变体基底();
  改写(副本);
  return 副本;
}

interface 建状态参数 {
  身份?: '在校' | '在职';
  简历教育?: 简历教育段[];
  候选预填?: 候选预填状态;
  /** J-PILOT-02 Task 4：会话恢复出的建档草稿 */
  建档?: 候选引导建档草稿;
}

function 建状态(选项: 建状态参数 = {}) {
  return {
    数据源模式: 'backend',
    状态: {
      基本信息: { 真名: '沈', 开始工作年: '2017', 身份: 选项.身份 ?? '在校' },
      简历教育: 选项.简历教育 ?? 空白首段(),
      简历技能: [],
      简历经历: [],
      简历证书: [],
      个人优势: '',
      引导预填: 选项.建档 === undefined ? null : { 城市们: [], 职位: [], 建档: 选项.建档 },
    },
    后端状态: { 候选预填状态: 选项.候选预填 ?? 创建空候选预填状态() },
    操作: mock操作,
    派发: vi.fn(),
  };
}

function render就读时间段(选项: 建状态参数 = {}) {
  mock应用状态 = 建状态(选项);
  render(
    <MemoryRouter>
      <就读时间段 />
    </MemoryRouter>,
  );
  return { 派发: mock应用状态.派发 as ReturnType<typeof vi.fn> };
}

/** 年份区间入口（沿滚轮卡样式）：点开共用抽屉。档位断言都在抽屉里做。 */
async function 开抽屉(用户: UserEvent) {
  await 用户.click(screen.getByRole('button', { name: /入学年/ }));
}

/** 滚轮档位断言：指定列（入学年/毕业年）的某档必须高亮选中（须已打开抽屉） */
function 选中档(列名: string, 档: string) {
  expect(
    within(screen.getByRole('listbox', { name: 列名 })).getByRole('option', { name: 档 }).getAttribute('aria-selected'),
  ).toBe('true');
}

/** Task 4 空值真相：指定列只有「请选择」空档选中，所有数字档都未选中（须已打开抽屉） */
function 无数字选中(列名: string) {
  const 列 = screen.getByRole('listbox', { name: 列名 });
  const 空档 = within(列).getByRole('option', { name: '请选择' });
  expect(空档.getAttribute('aria-selected')).toBe('true');
  for (const 档 of within(列).getAllByRole('option')) {
    if (档 === 空档) continue;
    expect(档.getAttribute('aria-selected')).toBe('false');
  }
}

beforeEach(() => {
  mock跳转.mockClear();
  mock返回.mockClear();
  mock轻提示.mockClear();
});

describe('就读时间段 预填预选', () => {
  it('从 educations[0] 起止月预选（wire fixture 2017-09 / 2021-06，替代默认 2021/2025）', async () => {
    render就读时间段({ 候选预填: readyState(构造映射变体基底()) });
    const 用户 = userEvent.setup();
    await 开抽屉(用户);
    选中档('入学年', '2017');
    选中档('毕业年', '2021');
  });

  it('年份超出 2000..2030 时不补默认：只选中「请选择」空档', async () => {
    render就读时间段({
      候选预填: readyState(映射变体((建议) => {
        建议.draft.educations[0].start_month = { value: '1999-09', confidence: 'high' };
        建议.draft.educations[0].end_month = { value: '2031-06', confidence: 'high' };
      })),
    });
    const 用户 = userEvent.setup();
    await 开抽屉(用户);
    无数字选中('入学年');
    无数字选中('毕业年');
  });

  it('学生 end month 缺失时回退 graduation_year（仍须界内）', async () => {
    render就读时间段({
      候选预填: readyState(映射变体((建议) => {
        建议.draft.educations[0].end_month = { value: null, confidence: null };
        建议.draft.profile.graduation_year = { value: 2024, confidence: 'high' };
      })),
    });
    const 用户 = userEvent.setup();
    await 开抽屉(用户);
    选中档('入学年', '2017');
    选中档('毕业年', '2024');
  });

  it.each([
    ['manual 轮', (状态: 候选预填状态) => { 状态.phase = 'manual'; }],
    ['education_period 已确认', (状态: 候选预填状态) => { 状态.confirmed.education_period = true; }],
    ['educations 非空（服务端已有教育）', (状态: 候选预填状态) => {
      状态.eligibility = { ...全可预填, educations: false };
    }],
  ])('%s 不补建议也不补默认（空档选中）', async (_名, 改) => {
    const 轮 = readyState(构造映射变体基底());
    改(轮);
    render就读时间段({ 候选预填: 轮 });
    const 用户 = userEvent.setup();
    await 开抽屉(用户);
    无数字选中('入学年');
    无数字选中('毕业年');
  });
});

describe('就读时间段 分区确认时序', () => {
  it('确认 education_period 只在既有保存 resolve 之后、跳转之前', async () => {
    let 解决!: () => void;
    const 门 = new Promise<void>((就绪) => { 解决 = 就绪; });
    mock操作.保存简历.mockReturnValueOnce(门);
    render就读时间段({ 候选预填: readyState(构造映射变体基底()) });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(mock操作.保存简历).toHaveBeenCalledTimes(1);
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    解决();
    await waitFor(() => expect(mock操作.确认候选Onboarding预填分区).toHaveBeenCalledWith('education_period'));
    expect(mock操作.确认候选Onboarding预填分区.mock.invocationCallOrder[0]!)
      .toBeLessThan(mock跳转.mock.invocationCallOrder[0]!);
    expect(mock跳转).toHaveBeenCalledWith(路径.工作经历);
  });

  it('保存被拒时 education_period 分区不确认、不跳转', async () => {
    mock操作.保存简历.mockRejectedValueOnce(new Error('保存失败'));
    render就读时间段({ 候选预填: readyState(构造映射变体基底()) });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalled());
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('预选年份随既有保存落盘（教育[0] 起止 + 学生毕业年入基本信息）', async () => {
    render就读时间段({ 候选预填: readyState(构造映射变体基底()) });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalled());
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 毕业年: '2021' }),
      教育: [expect.objectContaining({ 开始: '2017-09', 结束: '2021-06' })],
    }));
  });
});

// ── R（Task 7）：空就读时间不保存显示落点 —— 显示值与确认态分离 ──
describe('就读时间段 · 空时间显式确认（R）', () => {
  beforeEach(() => {
    mock操作.保存简历.mockClear().mockResolvedValue(undefined);
    mock操作.确认候选Onboarding预填分区.mockClear();
  });

  it('Backend 教育段起止为空且无建议：下一步提示且零保存', async () => {
    render就读时间段({ 身份: '在校', 简历教育: 空白首段() });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(mock轻提示).toHaveBeenCalledWith('请选择入学时间和毕业时间');
    expect(mock操作.保存简历).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('只有一侧已有（开始 2017-09、结束空）：仍不保存', async () => {
    render就读时间段({
      身份: '在校',
      简历教育: [{ ...空白首段()[0], 开始: '2017-09', 结束: '' }],
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(mock轻提示).toHaveBeenCalledWith('请选择入学时间和毕业时间');
    expect(mock操作.保存简历).not.toHaveBeenCalled();
  });

  it('已有完整年月原样保存', async () => {
    render就读时间段({
      身份: '在校',
      简历教育: [{ ...空白首段()[0], 开始: '2017-09', 结束: '2021-06' }],
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      教育: [expect.objectContaining({ 开始: '2017-09', 结束: '2021-06' })],
    }));
  });

  it('抽屉确认补缺失侧后保存对应双值（2017-09 / 2024-06）', async () => {
    render就读时间段({
      身份: '在校',
      简历教育: [{ ...空白首段()[0], 开始: '2017-09', 结束: '' }],
    });
    const 用户 = userEvent.setup();
    // 毕业年缺失（入口占位）：开抽屉选 2024，确定才回填
    await 开抽屉(用户);
    await 用户.click(within(screen.getByRole('listbox', { name: '毕业年' })).getByRole('option', { name: '2024' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      教育: [expect.objectContaining({ 开始: '2017-09', 结束: '2024-06' })],
    }));
  });
});

// ── Task 4：空值真相（无伪默认）、持续字段错误与显式 Mock 种子；
//    bottom-drawer 统一 Task 4：预填/空态断言经共用抽屉，确认后才可下一步 ──
describe('就读时间段 · 空值真相与显式种子（Task 4）', () => {
  beforeEach(() => {
    mock操作.保存简历.mockClear().mockResolvedValue(undefined);
    mock操作.确认候选Onboarding预填分区.mockClear();
    mock操作.更新候选建档草稿.mockClear();
  });

  function 演示种子教育(): 简历教育段[] {
    return [{
      编号: 'edu1',
      学校: '演示大学',
      学历: '本科',
      专业: '演示专业',
      开始: 就读年份演示预填.开始,
      结束: 就读年份演示预填.结束,
    }];
  }

  it('Mock 生产种子 2021/2025 是有效当前值：抽屉可见选中，直接下一步就保存', async () => {
    mock应用状态 = {
      ...建状态({ 身份: '在校', 简历教育: 演示种子教育() }),
      数据源模式: 'mock',
    };
    render(
      <MemoryRouter>
        <就读时间段 />
      </MemoryRouter>,
    );
    const 用户 = userEvent.setup();
    await 开抽屉(用户);
    选中档('入学年', '2021');
    选中档('毕业年', '2025');
    // 已填当前值可直接下一步，无需强制重开确认（取消零写入）
    await 用户.click(screen.getByRole('button', { name: '取消' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      教育: [expect.objectContaining({ 开始: '2021-09', 结束: '2025-06' })],
    }));
  });

  it('创建初始状态 默认 Mock 教育是既有样例 2014/2017：直接下一步就保存', async () => {
    const 默认状态 = 创建初始状态({ 模式: 'mock', 后端环境: 'stg' });
    expect(默认状态.简历教育[0]?.开始).toBe('2014-09');
    expect(默认状态.简历教育[0]?.结束).toBe('2017-06');
    mock应用状态 = {
      ...建状态({ 身份: '在职', 简历教育: 默认状态.简历教育 }),
      数据源模式: 'mock',
    };
    render(
      <MemoryRouter>
        <就读时间段 />
      </MemoryRouter>,
    );
    const 用户 = userEvent.setup();
    await 开抽屉(用户);
    选中档('入学年', '2014');
    选中档('毕业年', '2017');
    await 用户.click(screen.getByRole('button', { name: '取消' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      教育: [expect.objectContaining({ 开始: '2014-09', 结束: '2017-06' })],
    }));
  });

  it.each([
    ['Mock', 'mock'],
    ['Backend', 'backend'],
  ] as const)('%s 空输入无数字选中；抽屉点 2021/2025 确认后可直接下一步', async (_名, 模式) => {
    mock应用状态 = {
      ...建状态({ 身份: '在校', 简历教育: 空白首段() }),
      数据源模式: 模式,
    };
    render(
      <MemoryRouter>
        <就读时间段 />
      </MemoryRouter>,
    );
    const 用户 = userEvent.setup();
    await 开抽屉(用户);
    无数字选中('入学年');
    无数字选中('毕业年');
    await 用户.click(within(screen.getByRole('listbox', { name: '入学年' })).getByRole('option', { name: '2021' }));
    await 用户.click(within(screen.getByRole('listbox', { name: '毕业年' })).getByRole('option', { name: '2025' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      教育: [expect.objectContaining({ 开始: '2021-09', 结束: '2025-06' })],
    }));
  });

  it('空输入下一步标持续字段错误：确认修一侧清一侧，另一侧仍拦', async () => {
    render就读时间段({ 身份: '在校', 简历教育: 空白首段() });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(mock轻提示).toHaveBeenCalledWith('请选择入学时间和毕业时间');
    expect(mock操作.保存简历).not.toHaveBeenCalled();
    const 入学年头 = screen.getByText('入学年');
    const 毕业年头 = screen.getByText('毕业年');
    expect(入学年头.className).toContain(样式.滚轮头文字错误);
    expect(毕业年头.className).toContain(样式.滚轮头文字错误);
    // 抽屉确认只改入学年：该项错误清除，毕业年错误持续（只对发生变化的侧清错）
    await 开抽屉(用户);
    await 用户.click(within(screen.getByRole('listbox', { name: '入学年' })).getByRole('option', { name: '2021' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(入学年头.className).not.toContain(样式.滚轮头文字错误);
    expect(毕业年头.className).toContain(样式.滚轮头文字错误);
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(mock轻提示).toHaveBeenLastCalledWith('请选择入学时间和毕业时间');
    expect(mock操作.保存简历).not.toHaveBeenCalled();
    // 毕业年也修好：不再拦截
    await 开抽屉(用户);
    await 用户.click(within(screen.getByRole('listbox', { name: '毕业年' })).getByRole('option', { name: '2025' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
  });

  it('抽屉确认选空档写回草稿空字符串（原子双值）；重开不补回种子', async () => {
    const 教育 = [{ ...空白首段()[0], 开始: '2017-09', 结束: '2021-06' }];
    render就读时间段({
      身份: '在校',
      简历教育: 教育,
      建档: { 资料: { 教育 } },
    });
    const 用户 = userEvent.setup();
    await 开抽屉(用户);
    await 用户.click(
      within(screen.getByRole('listbox', { name: '入学年' })).getByRole('option', { name: '请选择' }),
    );
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(mock操作.更新候选建档草稿).toHaveBeenCalledTimes(1);
    const 末次 = mock操作.更新候选建档草稿.mock.calls.at(-1)![0];
    expect(末次.资料.教育[0].开始).toBe('');
    expect(末次.资料.教育[0].结束).toBe('2021-06');
    // 「重开」：把草稿落盘结果回灌进全局状态再挂一次 —— 清空是真相，不补回 2021/2025
    cleanup();
    mock应用状态 = 建状态({
      身份: '在校',
      建档: { 资料: { 教育: [{ ...教育[0], 开始: '', 结束: '2021-06' }] } },
    });
    render(
      <MemoryRouter>
        <就读时间段 />
      </MemoryRouter>,
    );
    await 开抽屉(userEvent.setup());
    无数字选中('入学年');
    选中档('毕业年', '2021');
  });

  it('倒置显示错误且零提交', async () => {
    render就读时间段({
      身份: '在校',
      简历教育: [{ ...空白首段()[0], 开始: '2025-09', 结束: '' }],
    });
    const 用户 = userEvent.setup();
    // 抽屉允许倒置确认；起止合法性由下一步校验拦截
    await 开抽屉(用户);
    await 用户.click(within(screen.getByRole('listbox', { name: '毕业年' })).getByRole('option', { name: '2020' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(mock轻提示).toHaveBeenCalledWith('毕业时间不能早于入学时间');
    expect(mock操作.保存简历).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
  });
});

// ── J-PILOT-02 Task 4：就读时间落草稿的同一条教育段；学生的毕业时间是「预计毕业」。
//    bottom-drawer 统一 Task 4：旧「每次滚动即时写草稿」移除 —— 确定才原子写双值，
//    取消零写入；刷新恢复仍走原建档草稿。──
describe('就读时间段 · 建档草稿接线（Task 4）', () => {
  beforeEach(() => {
    mock操作.保存简历.mockClear().mockResolvedValue(undefined);
    mock操作.更新候选建档草稿.mockClear();
  });

  /** 建档草稿在途的空教育段（复旦大学示例） */
  function 草稿教育(改: Partial<简历教育段> = {}): 简历教育段[] {
    return [{ 编号: 'edu草稿', 学校: '复旦大学', 学历: '硕士', 专业: '计算机', 开始: '', 结束: '', ...改 }];
  }

  it('学生预计毕业（毕业年在未来）照常保存：教育来自草稿段，毕业年入基本信息', async () => {
    const 未来年 = String(new Date().getFullYear() + 3);
    render就读时间段({
      身份: '在校',
      简历教育: [],
      建档: { 资料: { 教育: 草稿教育() } },
    });
    const 用户 = userEvent.setup();
    await 开抽屉(用户);
    await 用户.click(within(screen.getByRole('listbox', { name: '入学年' })).getByRole('option', { name: '2023' }));
    await 用户.click(within(screen.getByRole('listbox', { name: '毕业年' })).getByRole('option', { name: 未来年 }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 毕业年: 未来年 }),
      教育: [expect.objectContaining({
        编号: 'edu草稿', 学校: '复旦大学', 专业: '计算机', 开始: '2023-09', 结束: `${未来年}-06`,
      })],
    }));
  });

  it('确定原子写草稿：仅一次 更新候选建档草稿 同时带开始与结束', async () => {
    render就读时间段({
      身份: '在校',
      简历教育: [],
      建档: { 资料: { 教育: 草稿教育() } },
    });
    const 用户 = userEvent.setup();
    await 开抽屉(用户);
    await 用户.click(within(screen.getByRole('listbox', { name: '入学年' })).getByRole('option', { name: '2023' }));
    await 用户.click(within(screen.getByRole('listbox', { name: '毕业年' })).getByRole('option', { name: '2027' }));
    await 用户.click(screen.getByRole('button', { name: '确定' }));
    expect(mock操作.更新候选建档草稿).toHaveBeenCalledTimes(1);
    const 末次 = mock操作.更新候选建档草稿.mock.calls.at(-1)![0];
    expect(末次.资料.教育[0].开始).toBe('2023-09');
    expect(末次.资料.教育[0].结束).toBe('2027-06');
  });

  it('抽屉里改两轮后取消：不改值、零草稿写入', async () => {
    const 教育 = 草稿教育({ 开始: '2017-09', 结束: '2021-06' });
    render就读时间段({ 身份: '在校', 简历教育: 教育, 建档: { 资料: { 教育 } } });
    const 用户 = userEvent.setup();
    // 第一轮：改入学年 → 取消
    await 开抽屉(用户);
    await 用户.click(within(screen.getByRole('listbox', { name: '入学年' })).getByRole('option', { name: '2019' }));
    await 用户.click(screen.getByRole('button', { name: '取消' }));
    expect(mock操作.更新候选建档草稿).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /入学年/ }).textContent).toContain('2017');
    // 第二轮：改毕业年 → 取消，同样零写入、原值不变
    await 开抽屉(用户);
    await 用户.click(within(screen.getByRole('listbox', { name: '毕业年' })).getByRole('option', { name: '2025' }));
    await 用户.click(screen.getByRole('button', { name: '取消' }));
    expect(mock操作.更新候选建档草稿).not.toHaveBeenCalled();
    const 入口 = screen.getByRole('button', { name: /入学年/ });
    expect(入口.textContent).toContain('2017');
    expect(入口.textContent).toContain('2021');
  });

  it('草稿里已有起止：进屏即算已确认，直接下一步就保存', async () => {
    render就读时间段({
      身份: '在校',
      简历教育: [],
      建档: { 资料: { 教育: 草稿教育({ 开始: '2019-09', 结束: '2023-06' }) } },
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      教育: [expect.objectContaining({ 开始: '2019-09', 结束: '2023-06' })],
    }));
  });
});
