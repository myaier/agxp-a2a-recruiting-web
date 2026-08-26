// P1C Task 5：公司区块 的显式资料 / 可选按下 契约。
// Backend 页面一律传 资料（映射后的 view 内容），组件不得再读静态公司档案；
// 按下 缺省时根元素是同样 class 的非交互 div——不渲染尖括号、不带 可点、不伪造链接。
// 资料 缺省时保持旧 Mock 行为：按名称走 公司路由键/取公司档案，整块可点。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 公司区块 } from './公司区块';

const { mock公司路由键, mock取公司档案 } = vi.hoisted(() => {
  // 只补组件实际读取的字段；静态档规模行三段 → 元行组按内容认段
  const 静态档案 = {
    键: 'yunqu',
    名称: '云衢科技',
    首字: '云',
    规模行: 'C 轮 · 500-1000 人 · 金融科技',
    地址: '上海市张江路 1 号',
    简介: ['做可靠的技术产品'],
    工商信息: [{ 项: '成立日期', 值: '2015-03-02' }],
  };
  return {
    静态档案,
    mock公司路由键: vi.fn((名称: string) => `slug-${名称}`),
    mock取公司档案: vi.fn(() => 静态档案),
  };
});

vi.mock('../数据/公司档案', () => ({
  公司路由键: mock公司路由键,
  取公司档案: mock取公司档案,
}));

describe('公司区块 · 显式资料（Backend 路径）', () => {
  beforeEach(() => {
    mock公司路由键.mockClear();
    mock取公司档案.mockClear();
  });

  it('显式资料且无 canonical ref 时不读取静态档也不伪造按钮', () => {
    render(
      <公司区块
        名称="声明公司"
        首字="声"
        一行简介=""
        资料={{ 介绍段: null, 元行组: [{ 标签: '核验', 值: '未认证声明' }] }}
      />,
    );
    expect(mock取公司档案).not.toHaveBeenCalled();
    expect(mock公司路由键).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    // 调用方传入的元行原样上屏
    expect(screen.getByText('核验')).toBeTruthy();
    expect(screen.getByText('未认证声明')).toBeTruthy();
  });

  it('注入资料时渲染调用方的介绍段与元行，不调 公司路由键/取公司档案', () => {
    render(
      <公司区块
        名称="批审科技"
        首字="批"
        一行简介="一行兜底不该出现"
        资料={{
          介绍段: '已通过企业核验的在招企业',
          元行组: [
            { 标签: '规模', 值: '500-1000 人' },
            { 标签: '成立', 值: '2015 年' },
          ],
        }}
      />,
    );
    expect(mock取公司档案).not.toHaveBeenCalled();
    expect(mock公司路由键).not.toHaveBeenCalled();
    expect(screen.getByText('已通过企业核验的在招企业')).toBeTruthy();
    expect(screen.getByText('规模')).toBeTruthy();
    expect(screen.getByText('500-1000 人')).toBeTruthy();
    expect(screen.getByText('成立')).toBeTruthy();
    expect(screen.queryByText('一行兜底不该出现')).toBeNull();
  });

  it('按下 存在时即使带资料也是 button', async () => {
    const 按下 = vi.fn();
    render(
      <公司区块
        名称="批审科技"
        首字="批"
        一行简介=""
        资料={{ 介绍段: null, 元行组: [] }}
        按下={按下}
      />,
    );
    // canonical ref 由调用方决定 按下；组件不因资料存在而降级为 div
    await userEvent.click(screen.getByRole('button', { name: /批审科技/ }));
    expect(按下).toHaveBeenCalledTimes(1);
  });
});

describe('公司区块 · 旧 Mock props（资料 缺省）', () => {
  beforeEach(() => {
    mock公司路由键.mockClear();
    mock取公司档案.mockClear();
  });

  it('无资料仍可点击并显示静态档案', async () => {
    const 按下 = vi.fn();
    render(
      <公司区块 名称="云衢科技" 首字="云" 一行简介="C 轮 · 500-1000 人 · 金融科技" 按下={按下} />,
    );
    const 键 = screen.getByRole('button', { name: /云衢科技/ });
    expect(键.className).toMatch(/可点/);
    await userEvent.click(键);
    expect(按下).toHaveBeenCalledTimes(1);
    // 静态档按 名称→键 读取，介绍段与元行来自档案本身
    expect(mock公司路由键).toHaveBeenCalledWith('云衢科技');
    expect(mock取公司档案).toHaveBeenCalledWith('slug-云衢科技');
    expect(screen.getByText('做可靠的技术产品')).toBeTruthy();
    expect(screen.getByText('融资阶段')).toBeTruthy();
    expect(screen.getByText('规模')).toBeTruthy();
    expect(screen.getByText('行业')).toBeTruthy();
    expect(screen.getByText('成立')).toBeTruthy();
    expect(screen.getByText('地址')).toBeTruthy();
  });

  it('无资料且无 按下 时同样 class 的非交互 div，不渲染尖括号', () => {
    const { container } = render(
      <公司区块 名称="云衢科技" 首字="云" 一行简介="C 轮 · 500-1000 人 · 金融科技" />,
    );
    const 根 = container.firstChild as HTMLElement;
    expect(根.tagName).toBe('DIV');
    expect(根.className).not.toMatch(/可点/);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText('›')).toBeNull();
    // Mock 分支照旧读静态档
    expect(mock取公司档案).toHaveBeenCalledWith('slug-云衢科技');
    expect(screen.getByText('做可靠的技术产品')).toBeTruthy();
  });
});
