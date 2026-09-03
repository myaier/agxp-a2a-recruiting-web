// 最高学历 页面预填接线测试（Spec §8 分页应用 /onboard/degree，Task 5）：
// 首挂载同步用 取最高学历预填 预选档位：eligible 且未确认的 degree 分区才建议，
// 词表外（如 Bachelor）不翻译不猜档、保留既有选择；确认 degree 分区只在既有
// 保存简历 resolve 之后、跳转之前，拒绝时分区不确认。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF简历预填建议 } from '../数据/BFF契约';
import { 构造映射变体基底, 受支持学历变体 } from '../数据/招聘数据源/简历预填.fixture';
import { 路径 } from '../路由/路径表';
import { 创建空候选预填状态, type 候选预填Eligibility, type 候选预填状态 } from '../状态/后端/类型';
import type { 简历教育段 } from '../数据/类型';
import 最高学历 from './最高学历';

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

/** 硕士档正向建议（与学生默认 本科在读、非学生默认 本科 都可区分） */
function 硕士学历建议(): BFF简历预填建议 {
  const 建议 = 受支持学历变体();
  建议.draft.profile.current_education = { value: '硕士', confidence: 'high' };
  建议.draft.educations[0].degree = { value: '硕士', confidence: 'high' };
  return 建议;
}

interface 建状态参数 {
  身份?: '在校' | '在职';
  在读学历?: string;
  简历教育?: 简历教育段[];
  候选预填?: 候选预填状态;
}

function 建状态(选项: 建状态参数 = {}) {
  const 基本: Record<string, unknown> = { 真名: '沈', 开始工作年: '2017', 身份: 选项.身份 ?? '在职' };
  if (选项.在读学历 !== undefined) 基本.在读学历 = 选项.在读学历;
  return {
    数据源模式: 'backend',
    状态: {
      基本信息: 基本,
      简历教育: 选项.简历教育 ?? [],
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

function render最高学历(选项: 建状态参数 = {}) {
  mock应用状态 = 建状态(选项);
  render(
    <MemoryRouter>
      <最高学历 />
    </MemoryRouter>,
  );
  return { 派发: mock应用状态.派发 as ReturnType<typeof vi.fn> };
}

/** 档位按钮选中态断言（仓库未装 jest-dom，用原生属性） */
function 档位(名: string): HTMLElement {
  return screen.getByRole('button', { name: 名 });
}

beforeEach(() => {
  mock跳转.mockClear();
  mock返回.mockClear();
  mock轻提示.mockClear();
});

describe('最高学历 预填预选', () => {
  it('学生：current_education 命中基词 → 预选「硕士在读」（默认是 本科在读）', () => {
    render最高学历({ 身份: '在校', 候选预填: readyState(硕士学历建议()) });
    expect(档位('硕士在读').getAttribute('aria-pressed')).toBe('true');
    expect(档位('本科在读').getAttribute('aria-pressed')).toBe('false');
  });

  // codex review-r1 P1：既有选择来自服务端已保存在读学历时与 UI 默认无法区分 ——
  // source 时服务端 current_education 非空（eligibility 键 false）就整条不建议，
  // 防止新一轮上传的 PDF 建议覆盖已保存值（设计 §8 服务端值优先）。
  it('服务端已有在读学历：建议不同也不覆盖，既有选择保留', () => {
    render最高学历({
      身份: '在校',
      在读学历: '大专在读',
      候选预填: readyState(硕士学历建议(), {
        eligibility: { ...全可预填, profile: { ...全可预填.profile, current_education: false } },
      }),
    });
    expect(档位('大专在读').getAttribute('aria-pressed')).toBe('true');
    expect(档位('硕士在读').getAttribute('aria-pressed')).toBe('false');
  });

  it('非学生：只认 education[0].degree 命中七档 → 预选（默认是 本科）', () => {
    render最高学历({ 身份: '在职', 候选预填: readyState(硕士学历建议()) });
    expect(档位('硕士').getAttribute('aria-pressed')).toBe('true');
    expect(档位('本科').getAttribute('aria-pressed')).toBe('false');
  });

  it('非学生忽略 current_education（博士档只看 degree 大专）', () => {
    const 建议 = 构造映射变体基底();
    建议.draft.profile.current_education = { value: '博士', confidence: 'high' };
    建议.draft.educations[0].degree = { value: '大专', confidence: 'high' };
    render最高学历({ 身份: '在职', 候选预填: readyState(建议) });
    expect(档位('大专').getAttribute('aria-pressed')).toBe('true');
    expect(档位('博士').getAttribute('aria-pressed')).toBe('false');
  });

  it('不支持的学历词汇（Bachelor）保留既有默认选择', () => {
    render最高学历({ 身份: '在校', 候选预填: readyState(构造映射变体基底()) });
    expect(档位('本科在读').getAttribute('aria-pressed')).toBe('true');
    render最高学历({ 身份: '在职', 候选预填: readyState(构造映射变体基底()) });
    expect(档位('本科').getAttribute('aria-pressed')).toBe('true');
  });

  it.each([
    ['manual 轮', (状态: 候选预填状态) => { 状态.phase = 'manual'; }],
    ['degree 已确认', (状态: 候选预填状态) => { 状态.confirmed.degree = true; }],
    ['educations 非空（服务端已有教育）', (状态: 候选预填状态) => {
      状态.eligibility = { ...全可预填, educations: false };
    }],
  ])('%s 保留旧初始化', (_名, 改) => {
    const 轮 = readyState(硕士学历建议());
    改(轮);
    render最高学历({ 身份: '在校', 候选预填: 轮 });
    expect(档位('本科在读').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('最高学历 分区确认时序', () => {
  it('确认 degree 只在既有保存 resolve 之后、跳转之前', async () => {
    let 解决!: () => void;
    const 门 = new Promise<void>((就绪) => { 解决 = 就绪; });
    mock操作.保存简历.mockReturnValueOnce(门);
    render最高学历({ 身份: '在校', 候选预填: readyState(硕士学历建议()) });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(mock操作.保存简历).toHaveBeenCalledTimes(1);
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    解决();
    await waitFor(() => expect(mock操作.确认候选Onboarding预填分区).toHaveBeenCalledWith('degree'));
    expect(mock操作.确认候选Onboarding预填分区.mock.invocationCallOrder[0]!)
      .toBeLessThan(mock跳转.mock.invocationCallOrder[0]!);
    expect(mock跳转).toHaveBeenCalledWith(路径.毕业院校);
  });

  it('保存被拒时 degree 分区不确认、不跳转', async () => {
    mock操作.保存简历.mockRejectedValueOnce(new Error('保存失败'));
    render最高学历({ 身份: '在职', 候选预填: readyState(硕士学历建议()) });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalled());
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('预选档随既有保存落盘（学生在读学历 + 教育[0].学历）', async () => {
    render最高学历({ 身份: '在校', 候选预填: readyState(硕士学历建议()) });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalled());
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 在读学历: '硕士在读' }),
      教育: [expect.objectContaining({ 学历: '硕士' })],
    }));
  });
});
