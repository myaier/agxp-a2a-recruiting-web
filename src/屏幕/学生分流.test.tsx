// 学生分流 Backend onboarding 测试（review-r2 R2-I-1）：
// Backend 引导预填=null 时 城市们 不再回落到 ['上海']（无引用的默认串），
// 未选城市/职位引用时「下一步」被阻断，不派发带默认串无引用的 启程引导。
// Mock 分支保留 ['上海'] 默认。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 学生分流 from './学生分流';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

function render学生分流(选项: {
  数据源: 'backend' | 'mock';
  引导预填?: unknown;
  基本信息?: { 身份: '在校' | '在职' };
}) {
  const 派发 = vi.fn();
  mock应用状态 = {
    数据源模式: 选项.数据源,
    状态: {
      引导预填: 选项.引导预填 ?? null,
      基本信息: 选项.基本信息 ?? { 身份: '在职' },
      简历经历: [],
      简历教育: [],
      简历技能: [],
      简历证书: [],
      简历文件名: '',
      个人优势: '',
      简历作品集链接: '',
    },
    派发,
  };
  render(
    <MemoryRouter>
      <学生分流 />
    </MemoryRouter>,
  );
  return { 派发 };
}

/** 仓库未装 @testing-library/jest-dom，用 DOM 属性直接断言禁用态 */
function 禁用(按钮: HTMLElement): boolean {
  return (按钮 as HTMLButtonElement).disabled;
}

describe('学生分流 Backend onboarding（R2-I-1）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('Backend 引导预填=null 时城市行显示占位（不显示默认上海）', () => {
    render学生分流({ 数据源: 'backend' });
    // 城市行显示「选择工作城市」占位，而非默认串「上海」
    expect(screen.getByText('选择工作城市')).toBeTruthy();
  });

  it('Backend 引导预填=null 时下一步按钮禁用，不派发启程引导', async () => {
    const { 派发 } = render学生分流({ 数据源: 'backend' });
    const 用户 = userEvent.setup();
    const 下一步 = screen.getByRole('button', { name: '下一步' });
    expect(禁用(下一步)).toBe(true);
    await 用户.click(下一步);
    expect(派发).not.toHaveBeenCalled();
  });

  it('Backend 选了职位但没选城市时下一步仍禁用（城市引用们为空）', () => {
    const { 派发 } = render学生分流({
      数据源: 'backend',
      引导预填: {
        城市们: [],
        职位: ['产品经理'],
        职位引用们: [{ id: 'tax_pm', display_name: '产品经理' }],
        城市引用们: [],
        筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['现场'] },
      },
    });
    const 下一步 = screen.getByRole('button', { name: '下一步' });
    expect(禁用(下一步)).toBe(true);
    expect(派发).not.toHaveBeenCalled();
  });

  it('Backend 城市与职位引用齐备时下一步可点且派发携带引用的启程引导', async () => {
    const { 派发 } = render学生分流({
      数据源: 'backend',
      引导预填: {
        城市们: ['上海'],
        职位: ['产品经理'],
        城市引用们: [{ id: 'loc_sh', display_name: '上海' }],
        职位引用们: [{ id: 'tax_pm', display_name: '产品经理' }],
        筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['现场'] },
      },
    });
    const 用户 = userEvent.setup();
    const 下一步 = screen.getByRole('button', { name: '下一步' });
    expect(禁用(下一步)).toBe(false);
    await 用户.click(下一步);
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '启程引导',
        城市引用们: [{ id: 'loc_sh', display_name: '上海' }],
        职位引用们: [{ id: 'tax_pm', display_name: '产品经理' }],
      }),
    );
  });
});

describe('学生分流 Mock onboarding（R2-I-1 回归）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('Mock 引导预填=null 时城市行仍显示默认上海（Mock 保留旧默认）', () => {
    render学生分流({ 数据源: 'mock' });
    // Mock 保留 ['上海'] 默认：城市行不显示占位
    expect(screen.queryByText('选择工作城市')).toBeNull();
    // 城市行里有「上海」
    const 城市按钮 = screen.getByText('上海');
    expect(城市按钮).toBeTruthy();
  });
});