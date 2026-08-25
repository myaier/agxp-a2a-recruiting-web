// 引导问答 Mock 存引导预填测试（Task 4 R9）：
// 只验证 Mock 分支 存引导预填 现在带 职位引用们: []（Task 4 占位）。
// 不迁移 引导问答 内联选择器到 Backend（Task 6 接管）。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 引导问答 from './引导问答';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

function render引导问答() {
  const 派发 = vi.fn();
  const 保存个人优势 = vi.fn(async () => {});
  const 保存首次意向 = vi.fn(async () => {});
  mock应用状态 = {
    数据源模式: 'mock',
    目录查询: null,
    状态: {
      // 引导预填 为 null：向导第一题落到「期望职位」，其落盘走 存引导预填
      引导预填: null,
      个人优势: '',
      简历作品集链接: '',
      基本信息: { 真名: '沈', 开始工作年: '2017', 身份: '在职' as const },
    },
    派发,
    操作: { 保存个人优势, 保存首次意向 },
  };
  render(
    <MemoryRouter initialEntries={['/onboard/wizard?stage=salary']}>
      <引导问答 />
    </MemoryRouter>,
  );
  return { 派发 };
}

describe('引导问答 Mock 存引导预填', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('期望职位题存盘带 职位引用们 占位', async () => {
    const { 派发 } = render引导问答();
    const 用户 = userEvent.setup();
    // 第一题是期望职位，点「下一步」落盘当前题
    await 用户.click(screen.getByRole('button', { name: /保存/ }));
    await waitFor(() =>
      expect(派发).toHaveBeenCalledWith(
        expect.objectContaining({
          型: '存引导预填',
          职位引用们: [],
        }),
      ),
    );
  });
});