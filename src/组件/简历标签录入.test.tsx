// 简历标签录入 · 共用受控标签录入组件（candidate-profile-edit-boundaries Task 3）：
// 在线简历 专业技能 / 证书与语言 两个区块共用的 标签墙 + 行内录入行 正文。
// 契约冻结为轻量受控组件：无内部持久化（标签与输入草稿全由调用方持有）、
// 不查询后端、不创建条目 ID；Enter 且非输入法组合（isComposing）才回调 添加；
// 逐项删除按该项 键 回调（技能 = 原字符串、证书 = 原编号）。
// 仓库未装 @testing-library/jest-dom，用原生 DOM 属性断言。

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { 简历标签录入, type 简历标签项 } from './简历标签录入';

function 挂组件(选项: {
  项们?: 简历标签项[];
  草稿?: string;
  占位?: string;
  删除名称?: (项: 简历标签项) => string;
} = {}) {
  const 改草稿 = vi.fn();
  const 添加 = vi.fn();
  const 删除 = vi.fn();
  render(
    <简历标签录入
      项们={选项.项们 ?? []}
      草稿={选项.草稿 ?? ''}
      占位={选项.占位 ?? '如：Go、分布式事务'}
      删除名称={选项.删除名称 ?? ((项: 简历标签项) => `删除 ${项.名称}`)}
      改草稿={改草稿}
      添加={添加}
      删除={删除}
    />,
  );
  return { 改草稿, 添加, 删除 };
}

describe('简历标签录入 · 受控录入与回调契约', () => {
  it('占位上屏；点添加按钮回调 添加', async () => {
    const { 添加 } = 挂组件({ 占位: '证书或语言，如 CPA、雅思 7.0' });
    expect(screen.getByPlaceholderText('证书或语言，如 CPA、雅思 7.0')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '添加' }));
    expect(添加).toHaveBeenCalledTimes(1);
  });

  it('输入只回调 改草稿（受控）：草稿 prop 不变则输入框值不变，无内部持久化', () => {
    const { 改草稿 } = 挂组件({ 草稿: '' });
    const 框 = screen.getByPlaceholderText('如：Go、分布式事务') as HTMLInputElement;
    fireEvent.change(框, { target: { value: 'Go' } });
    expect(改草稿).toHaveBeenCalledWith('Go');
    expect(框.value).toBe('');
  });

  it('Enter 且非组合输入才回调 添加；中文输入法组合回车（isComposing）不回调', () => {
    const { 添加 } = 挂组件();
    const 框 = screen.getByPlaceholderText('如：Go、分布式事务');
    // 组合期的回车是选字，不当提交
    fireEvent.keyDown(框, { key: 'Enter', isComposing: true });
    expect(添加).not.toHaveBeenCalled();
    // 非组合回车才提交
    fireEvent.keyDown(框, { key: 'Enter' });
    expect(添加).toHaveBeenCalledTimes(1);
    // 其它按键不触发
    fireEvent.keyDown(框, { key: 'a' });
    expect(添加).toHaveBeenCalledTimes(1);
  });
});

describe('简历标签录入 · 标签展示与删除', () => {
  it('逐项删除回调带该项 键（技能 = 原字符串、证书 = 原编号），不是名称或下标', async () => {
    const { 删除 } = 挂组件({
      项们: [
        { 键: 'Go', 名称: 'Go' },
        { 键: 'cert_cpa_2020', 名称: 'CPA', 补充: '2020 年取得' },
      ],
      删除名称: (项) => `删除 ${项.名称}`,
    });
    await userEvent.click(screen.getByRole('button', { name: '删除 CPA' }));
    expect(删除).toHaveBeenCalledTimes(1);
    expect(删除).toHaveBeenCalledWith('cert_cpa_2020');
  });

  it('补充文本（既有年份展示）原样可见；无补充的项不渲染空补充', () => {
    挂组件({
      项们: [
        { 键: 'cert_a', 名称: 'CPA', 补充: '2019 年取得' },
        { 键: 'cert_b', 名称: 'CET-6' },
      ],
    });
    expect(screen.getByText('2019 年取得')).toBeTruthy();
    // 无年份的标签只有名称与删除叉
    expect(screen.getByRole('button', { name: '删除 CET-6' }).textContent).toBe('CET-6✕');
  });

  it('长标签换行：长名称标签完整展示（不截断）且与短标签同处一个换行容器', () => {
    const 长名 = '分布式事务一致性协议设计与落地实践（跨机房多活版）';
    挂组件({
      项们: [
        { 键: '长', 名称: 长名 },
        { 键: '短', 名称: 'Go' },
      ],
      删除名称: (项) => `删除 ${项.名称}`,
    });
    const 长标签 = screen.getByRole('button', { name: `删除 ${长名}` });
    // 长名称一字不少（不截断、不上「单行」省略类）；实际折行由换行容器承载，
    // 浏览器布局检查随 Task 1/最终资料编辑路径执行
    expect(长标签.textContent).toBe(`${长名}✕`);
    expect(长标签.className).not.toContain('单行');
    const 容器 = 长标签.parentElement!;
    expect(容器).toBe(screen.getByRole('button', { name: '删除 Go' }).parentElement);
    expect(容器.childElementCount).toBe(2);
  });

  it('空列表不渲染标签组，只渲染录入行', () => {
    挂组件({ 项们: [] });
    expect(screen.queryByRole('button', { name: /删除/ })).toBeNull();
    expect(screen.getByPlaceholderText('如：Go、分布式事务')).toBeTruthy();
  });
});
