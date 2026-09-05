// 求职状态 · 显式选择责任（M / Task 5A）：
// 「当前」是 string | null —— 只取 引导预填.到岗，不再按身份推默认档；
// 未选点下一步只提示，零保存零派发零导航；明确选择后才写身份并保存 Context 草稿；
// 从空身份进入时只有保存成功才确认 basic、派发到岗并导航，失败三者都不发生。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 路径 } from '../路由/路径表';
import type { 基本信息 as 基本信息类型 } from '../数据/类型';
import 求职状态 from './求职状态';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());
const mock操作 = vi.hoisted(() => ({
  保存简历: vi.fn(async () => {}),
  确认候选Onboarding预填分区: vi.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

interface 建状态选项 {
  身份?: 基本信息类型['身份'];
  到岗?: string;
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
      引导预填: 选项.到岗 === undefined ? null : { 到岗: 选项.到岗 },
    },
    派发: vi.fn(),
    操作: mock操作,
  };
}

function 渲染(选项: 建状态选项 = {}) {
  置状态(选项);
  return render(
    <MemoryRouter initialEntries={['/onboard/status']}>
      <求职状态 />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mock跳转.mockClear();
  mock返回.mockClear();
  mock轻提示.mockClear();
  mock操作.保存简历.mockClear().mockResolvedValue(undefined);
  mock操作.确认候选Onboarding预填分区.mockClear();
});

describe('求职状态 · 显式选择（M）', () => {
  it('未选时点下一步：只提示，不保存、不派发到岗、不导航', async () => {
    const { } = 渲染({ 身份: '' });
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
    expect(mock跳转).toHaveBeenCalledWith(路径.最高学历);
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
