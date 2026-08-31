// Task 3：企业披露策略 —— 企业口径从此固定，不再是可变根状态。
// 屏幕直接迭代既有的 企业披露策略初始 常量渲染（不依赖应用状态提供器），
// 五个既有行的文案字节不变，且每颗分段按钮都不可写 —— 不再派发本地 设企业披露档 假状态。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import 企业披露策略 from './企业披露策略';

describe('企业披露策略 · 固定口径', () => {
  it('企业披露策略所有分段不再写本地假状态且字样不变', () => {
    render(<MemoryRouter><企业披露策略 /></MemoryRouter>);
    expect(screen.getByText('完整 JD 与职级')).toBeTruthy();
    expect(screen.getByText('团队规模与汇报线')).toBeTruthy();
    // 仓库未装 @testing-library/jest-dom：disabled 用原生属性断言
    for (const 档 of ['不披露', '意向确认后', '一直允许']) {
      for (const button of screen.getAllByRole('button', { name: 档 })) {
        expect((button as HTMLButtonElement).disabled).toBe(true);
      }
    }
  });
});
