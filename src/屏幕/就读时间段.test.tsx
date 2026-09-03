// 就读时间段 页面预填接线测试（Spec §8 分页应用 /onboard/eduyears，Task 5）：
// 首挂载同步用 取就读年份预填 预选双滚轮：仅 2000..2030 界内年份才预选，
// 超界/缺席保留页面既有默认（2021/2025）；学生 end month 缺失可回退 graduation_year；
// 确认 education_period 分区只在既有保存 resolve 之后、跳转之前，拒绝时分区不确认。

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF简历预填建议 } from '../数据/BFF契约';
import { 构造映射变体基底 } from '../数据/招聘数据源/简历预填.fixture';
import { 路径 } from '../路由/路径表';
import { 创建空候选预填状态, type 候选预填Eligibility, type 候选预填状态 } from '../状态/后端/类型';
import type { 简历教育段 } from '../数据/类型';
import 就读时间段 from './就读时间段';

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
  profile: { real_name: true, work_start_year: true, gender: true, birth_year: true, birth_month: true },
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

/** 前三页走完后的空教育段（开始/结束为空 → 页面默认 2021/2025） */
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

/** 滚轮档位断言：指定列（入学年/毕业年）的某档必须高亮选中 */
function 选中档(列名: string, 档: string) {
  expect(
    within(screen.getByRole('listbox', { name: 列名 })).getByRole('option', { name: 档 }).getAttribute('aria-selected'),
  ).toBe('true');
}

beforeEach(() => {
  mock跳转.mockClear();
  mock返回.mockClear();
  mock轻提示.mockClear();
});

describe('就读时间段 预填预选', () => {
  it('从 educations[0] 起止月预选滚轮（wire fixture 2017-09 / 2021-06，替代默认 2021/2025）', () => {
    render就读时间段({ 候选预填: readyState(构造映射变体基底()) });
    选中档('入学年', '2017');
    选中档('毕业年', '2021');
  });

  it('年份超出 2000..2030 时保留页面既有默认（2021/2025）', () => {
    render就读时间段({
      候选预填: readyState(映射变体((建议) => {
        建议.draft.educations[0].start_month = { value: '1999-09', confidence: 'high' };
        建议.draft.educations[0].end_month = { value: '2031-06', confidence: 'high' };
      })),
    });
    选中档('入学年', '2021');
    选中档('毕业年', '2025');
  });

  it('学生 end month 缺失时回退 graduation_year（仍须界内）', () => {
    render就读时间段({
      候选预填: readyState(映射变体((建议) => {
        建议.draft.educations[0].end_month = { value: null, confidence: null };
        建议.draft.profile.graduation_year = { value: 2024, confidence: 'high' };
      })),
    });
    选中档('入学年', '2017');
    选中档('毕业年', '2024');
  });

  it.each([
    ['manual 轮', (状态: 候选预填状态) => { 状态.phase = 'manual'; }],
    ['education_period 已确认', (状态: 候选预填状态) => { 状态.confirmed.education_period = true; }],
    ['educations 非空（服务端已有教育）', (状态: 候选预填状态) => {
      状态.eligibility = { ...全可预填, educations: false };
    }],
  ])('%s 保留旧初始化', (_名, 改) => {
    const 轮 = readyState(构造映射变体基底());
    改(轮);
    render就读时间段({ 候选预填: 轮 });
    选中档('入学年', '2021');
    选中档('毕业年', '2025');
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
