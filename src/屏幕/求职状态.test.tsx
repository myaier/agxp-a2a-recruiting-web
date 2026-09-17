// 求职状态 · 显式选择责任（M / Task 5A）：
// 「当前」是 string | null —— 只取 引导预填.到岗，不再按身份推默认档；
// 未选点下一步只提示，零保存零派发零导航；明确选择后才写身份并保存 Context 草稿；
// 从空身份进入时只有保存成功才确认 basic、派发到岗并导航，失败三者都不发生。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 路径 } from '../路由/路径表';
import { 创建候选编辑来路 } from '../流程/候选日常编辑';
import type { 基本信息 as 基本信息类型 } from '../数据/类型';
import type { 候选引导建档草稿 } from '../数据/资料缓存';
import 求职状态 from './求职状态';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock替换跳转 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());
const mock操作 = vi.hoisted(() => ({
  保存简历: vi.fn(async () => {}),
  确认候选Onboarding预填分区: vi.fn(),
  更新候选建档草稿: vi.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 跳转: mock跳转, 返回: mock返回, 替换跳转: mock替换跳转 }),
}));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

interface 建状态选项 {
  身份?: 基本信息类型['身份'];
  到岗?: string;
  /** J-PILOT-02 Task 4：会话恢复出的建档草稿 */
  建档?: 候选引导建档草稿;
}

function 置状态(选项: 建状态选项 = {}) {
  const 基本: 基本信息类型 = {
    真名: '沈', 开始工作年: '', 身份: 选项.身份 ?? '', ...{},
  };
  mock应用状态 = {
    数据源模式: 'backend',
    状态: {
      基本信息: 基本,
      个人优势: '',
      简历经历: [],
      简历教育: [],
      简历技能: [],
      简历证书: [],
      引导预填: 选项.到岗 === undefined && 选项.建档 === undefined
        ? null
        : { 城市们: [], 职位: [], 到岗: 选项.到岗, 建档: 选项.建档 },
    },
    派发: vi.fn(),
    操作: mock操作,
  };
}

type 入口形 = string | { pathname: string; search?: string; state?: unknown };

function 渲染(选项: 建状态选项 & { 入口?: 入口形 } = {}) {
  置状态(选项);
  return render(
    <MemoryRouter initialEntries={[选项.入口 ?? '/onboard/status']}>
      <求职状态 />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mock跳转.mockClear();
  mock返回.mockClear();
  mock替换跳转.mockClear();
  mock轻提示.mockClear();
  mock操作.保存简历.mockClear().mockResolvedValue(undefined);
  mock操作.确认候选Onboarding预填分区.mockClear();
  mock操作.更新候选建档草稿.mockClear();
  window.history.replaceState(null, '');
});

describe('求职状态 · 显式选择（M）', () => {
  it('未选时点下一步：只提示，不保存、不派发到岗、不导航', async () => {
    渲染({ 身份: '' });
    const 用户 = userEvent.setup();
    // 所有档位 aria-pressed = false
    for (const 键 of ['离职 · 随时到岗', '在职 · 月内到岗', '在职 · 考虑机会', '在职 · 暂不考虑']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${键}`) }).getAttribute('aria-pressed')).toBe('false');
    }
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(mock轻提示).toHaveBeenCalledWith('请选择当前求职状态');
    expect(mock应用状态.派发).not.toHaveBeenCalled();
    expect(mock操作.保存简历).not.toHaveBeenCalled();
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('选择「离职 · 随时到岗」后下一步：保存 身份:离职 并导航最高学历', async () => {
    渲染({ 身份: '' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: /离职 · 随时到岗/ }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 身份: '离职' }),
    }));
    // 引导旅程不传保存来源（缺省 = onboarding 跟踪语义）
    expect(mock操作.保存简历.mock.calls[0]).toHaveLength(1);
    expect(mock跳转).toHaveBeenCalledWith(路径.最高学历);
  });

  it('学生（在校）同样先进学历四页：状态不再直接跳向导（Task 3 同一主序）', async () => {
    渲染({ 身份: '在校' });
    const 用户 = userEvent.setup();
    // 学生档位全程「在校 ·」措辞，身份保持 在校 不动
    await 用户.click(screen.getByRole('button', { name: /在校 · 考虑机会/ }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 身份: '在校' }),
    }));
    expect(mock跳转).toHaveBeenCalledWith(路径.最高学历);
    expect(mock跳转).not.toHaveBeenCalledWith(路径.引导问答);
  });

  it('选择「在职 · 考虑机会」后下一步：保存 身份:在职', async () => {
    渲染({ 身份: '' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: /在职 · 考虑机会/ }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 身份: '在职' }),
    }));
  });

  it('从空身份进入：保存成功后才确认 basic、派发到岗并导航', async () => {
    渲染({ 身份: '' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: /在职 · 考虑机会/ }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock跳转).toHaveBeenCalled());
    expect(mock操作.保存简历).toHaveBeenCalledTimes(1);
    expect(mock操作.确认候选Onboarding预填分区).toHaveBeenCalledWith('basic');
    expect(mock应用状态.派发).toHaveBeenCalledWith(expect.objectContaining({
      型: '存到岗预填',
      到岗: '在职 · 考虑机会',
    }));
  });

  it('保存失败：不确认、不派发到岗、不导航', async () => {
    mock操作.保存简历.mockRejectedValue(new Error('offline'));
    渲染({ 身份: '' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: /离职 · 随时到岗/ }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalled());
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    expect(mock应用状态.派发).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('已有身份（在职）进入：保存成功后不确认 basic（非空身份收口路径）', async () => {
    渲染({ 身份: '在职' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: /在职 · 暂不考虑/ }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock跳转).toHaveBeenCalled());
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
  });
});

// ── J-PILOT-02 Task 4：身份收口读草稿（/basic 的姓名只在草稿里时不能写空 profile）──
describe('求职状态 · 建档草稿接线（Task 4）', () => {
  it('刷新后 Context 姓名为空：保存携带草稿姓名与本次身份，不发空名 profile', async () => {
    渲染({ 身份: '', 建档: { 资料: { 基本信息: { 真名: '沈星', 出生年: '2000', 出生月: '9' } } } });
    // 渲染() 内部按选项重建状态：这里直接把 Context 姓名清空
    mock应用状态.状态.基本信息.真名 = '';
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: /离职 · 随时到岗/ }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 真名: '沈星', 出生年: '2000', 身份: '离职' }),
    }));
  });

  it('本次身份写回草稿并回带未结算写入槽', async () => {
    const 槽 = { 种类: 'profile' as const, 幂等键: 'k1', 阶段: 'prepared' as const };
    渲染({ 身份: '', 建档: { 待写入: 槽, 资料: { 基本信息: { 真名: '沈星' } } } });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: /在职 · 考虑机会/ }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    const 末次 = mock操作.更新候选建档草稿.mock.calls.at(-1)![0];
    expect(末次.资料.基本信息).toEqual(expect.objectContaining({ 真名: '沈星', 身份: '在职' }));
    expect(末次.待写入).toEqual(槽);
  });
});

// ── 日常编辑来源（Task 1 / Spec §6）：resume 与 intentions 是同一份三态编辑 ──
// 页面只读已水合 profile 身份（不再用到岗档位），保存 single-flight、传 日常编辑、
// 按来源退出；不派发到岗、不确认 basic、零建档草稿；失败留页。
describe('求职状态 · 日常编辑（from=resume / from=intentions）', () => {
  it('按钮为保存，三态选项取代到岗档位；空值不假选', () => {
    渲染({ 身份: '', 入口: '/onboard/status?from=resume' });
    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '下一步' })).toBeNull();
    for (const 档 of ['在校', '在职', '离职']) {
      expect(screen.getByRole('button', { name: 档 }).getAttribute('aria-pressed')).toBe('false');
    }
    expect(screen.queryByText(/随时到岗|考虑机会|暂不考虑/)).toBeNull();
  });

  it.each(['在校', '在职', '离职'] as const)('当前身份 %s 预选同一档', (身份) => {
    渲染({ 身份, 入口: '/onboard/status?from=resume' });
    for (const 档 of ['在校', '在职', '离职']) {
      expect(screen.getByRole('button', { name: 档 }).getAttribute('aria-pressed')).toBe(String(档 === 身份));
    }
  });

  it('from=resume 保存：一次 保存简历 带 日常编辑，然后退一格回我的简历', async () => {
    window.history.replaceState({ idx: 4 }, '');
    const 来路 = 创建候选编辑来路('resume');
    window.history.replaceState({ idx: 5 }, '');
    渲染({
      身份: '在职',
      入口: { pathname: '/onboard/status', search: '?from=resume', state: 来路 },
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '离职' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 身份: '离职' }),
    }), '日常编辑'); // fix-r1：日常编辑保存显式绕过 onboarding 跟踪
    expect(mock返回).toHaveBeenCalledTimes(1);
    expect(mock替换跳转).not.toHaveBeenCalled();
    // 日常分支在 到岗预填/分区确认 之前收口：三者一次都不发生
    expect(mock应用状态.派发).not.toHaveBeenCalled();
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    expect(mock操作.更新候选建档草稿).not.toHaveBeenCalled();
  });

  it('from=intentions 保存：无来路证明时安全替换回求职意向管理', async () => {
    渲染({ 身份: '在校', 入口: '/onboard/status?from=intentions' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '在职' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(1));
    expect(mock操作.保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 身份: '在职' }),
    }), '日常编辑');
    expect(mock替换跳转).toHaveBeenCalledWith(路径.求职意向管理);
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock应用状态.派发).not.toHaveBeenCalled();
  });

  it('空身份点保存：只提示，零保存零退出（空值不写非法状态）', async () => {
    渲染({ 身份: '', 入口: '/onboard/status?from=resume' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock轻提示).toHaveBeenCalledWith('请选择当前求职状态');
    expect(mock操作.保存简历).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).not.toHaveBeenCalled();
  });

  it('保存 single-flight：在途期间重复点击只发一次', async () => {
    let 放行!: () => void;
    mock操作.保存简历.mockImplementationOnce(() => new Promise<void>((解决) => { 放行 = 解决; }));
    渲染({ 身份: '在职', 入口: '/onboard/status?from=resume' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock操作.保存简历).toHaveBeenCalledTimes(1);
    放行();
    await waitFor(() => expect(mock替换跳转).toHaveBeenCalledWith(路径.我的简历));
    expect(mock操作.保存简历).toHaveBeenCalledTimes(1);
  });

  it('保存失败：轻提示留页，零派发零退出，可重试', async () => {
    mock操作.保存简历.mockRejectedValueOnce(new Error('offline'));
    渲染({ 身份: '离职', 入口: '/onboard/status?from=resume' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalled());
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).not.toHaveBeenCalled();
    expect(mock应用状态.派发).not.toHaveBeenCalled();
    // 失败后仍可重试（锁已释放）
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock操作.保存简历).toHaveBeenCalledTimes(2));
  });
});
