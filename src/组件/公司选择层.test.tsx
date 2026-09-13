// 公司选择层 组件测试（Task 2 合同 B）：七页共用的「选择企业」底部抽屉正文。
// 纯展示契约逐字覆盖：零输入提示、结果主副行与认证文字、返回／遮罩／Escape 取消、
// 同抽屉添加与失败保留、创建在途禁用、名称 1–80 Unicode 码点／控制字符校验，
// 以及 关闭 回调稳定化 —— 父层重渲染不得把焦点收回首个控件打断输入。

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { 公司选择层, type 公司选择层属性, type 公司选择行 } from './公司选择层';

function 行(覆盖: Partial<Omit<公司选择行, '键'>> & { 键: string }): 公司选择行 {
  return { 名称: '云衢科技', 正式名: null, 已认证: false, 选中: false, ...覆盖 };
}

function 基础Props(覆盖: Partial<公司选择层属性> = {}): 公司选择层属性 {
  return {
    搜索词: '',
    修改搜索词: vi.fn(),
    项们: [],
    搜索中: false,
    搜索错误: null,
    重试搜索: vi.fn(),
    还有: false,
    加载中: false,
    加载错误: null,
    加载更多: vi.fn(),
    选定: vi.fn(),
    关闭: vi.fn(),
    创建中: false,
    创建错误: null,
    添加: vi.fn(),
    ...覆盖,
  };
}

describe('公司选择层 展示契约', () => {
  it('零输入不虚构结果：正文提示「输入公司名称」，不渲染候选行与加载更多', () => {
    render(<公司选择层 {...基础Props()} />);
    expect(screen.getByText('输入公司名称')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '云衢科技' })).toBeNull();
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();
  });

  it('结果主行显示常用名，正式名/认证文字映射为副文；选中行带 ✓；点击按 键 交回', async () => {
    const 选定 = vi.fn();
    const 用户 = userEvent.setup();
    render(
      <公司选择层
        {...基础Props({
          搜索词: '云衢',
          项们: [
            行({ 键: 'org_1', 名称: '云衢科技', 正式名: '云衢网络科技有限公司', 已认证: true }),
            行({ 键: 'org_2', 名称: '星桥传媒', 已认证: false }),
            行({ 键: 'org_3', 名称: '澜舟数据', 已认证: true, 选中: true }),
          ],
          选定,
        })}
      />,
    );
    expect(screen.getByText('云衢网络科技有限公司 · 已认证')).toBeTruthy();
    expect(screen.getByText('未认证')).toBeTruthy();
    expect(screen.getByRole('button', { name: '澜舟数据' }).textContent).toContain('✓');
    await 用户.click(screen.getByRole('button', { name: '云衢科技' }));
    expect(选定).toHaveBeenCalledWith('org_1');
  });

  it('零结果与失败分开：空结果提示「没有找到相关企业」；失败给错误与重试且不假称没有企业', async () => {
    const 重试搜索 = vi.fn();
    const { rerender } = render(<公司选择层 {...基础Props({ 搜索词: '不存在' })} />);
    expect(screen.getByText('没有找到相关企业')).toBeTruthy();

    rerender(
      <公司选择层
        {...基础Props({ 搜索词: '云衢', 搜索错误: '无法连接后端服务，请检查网络或稍后重试', 重试搜索 })}
      />,
    );
    expect(screen.getByText('无法连接后端服务，请检查网络或稍后重试')).toBeTruthy();
    expect(screen.queryByText('没有找到相关企业')).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: '重试' }));
    expect(重试搜索).toHaveBeenCalledTimes(1);
  });

  it('分页失败保留已加载结果并展示加载错误', () => {
    render(
      <公司选择层
        {...基础Props({
          搜索词: '云衢',
          项们: [行({ 键: 'org_1', 名称: '云衢科技', 已认证: true })],
          还有: true,
          加载错误: '后端服务暂时不可用，请稍后重试',
        })}
      />,
    );
    expect(screen.getByText('后端服务暂时不可用，请稍后重试')).toBeTruthy();
    // 已加载结果仍在，可继续重试翻页
    expect(screen.getByRole('button', { name: '云衢科技' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '加载更多' })).toBeTruthy();
  });

  it('分页尾沿用原控件：还有 才渲染，点击交给 加载更多，忙时「加载中…」并禁用', async () => {
    const 加载更多 = vi.fn();
    const { rerender } = render(
      <公司选择层 {...基础Props({ 搜索词: '云衢', 项们: [行({ 键: 'org_1' })], 还有: true, 加载更多 })} />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: '加载更多' }));
    expect(加载更多).toHaveBeenCalledTimes(1);
    rerender(
      <公司选择层
        {...基础Props({ 搜索词: '云衢', 项们: [行({ 键: 'org_1' })], 还有: true, 加载中: true, 加载更多 })}
      />,
    );
    expect((screen.getByRole('button', { name: '加载更多' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: '加载更多' }).textContent).toContain('加载中…');
  });

  it('Escape 与遮罩点击都经 关闭 回调关闭', async () => {
    const 关闭 = vi.fn();
    const 用户 = userEvent.setup();
    const { rerender } = render(<公司选择层 {...基础Props({ 关闭 })} />);
    await 用户.keyboard('{Escape}');
    expect(关闭).toHaveBeenCalledOnce();
    rerender(<公司选择层 {...基础Props({ 关闭 })} />);
    await 用户.click(screen.getByRole('button', { name: '关闭选择企业' }));
    expect(关闭).toHaveBeenCalledTimes(2);
  });

  it('同一抽屉切到添加：预填搜索词，提交交给 添加；返回搜索不丢原父页选择', async () => {
    const 添加 = vi.fn();
    const 用户 = userEvent.setup();
    const 基础 = 基础Props({
      搜索词: '星桥',
      项们: [行({ 键: 'org_2', 名称: '星桥传媒', 已认证: false })],
      添加,
    });
    const { rerender } = render(<公司选择层 {...基础} />);
    await 用户.click(screen.getByRole('button', { name: '添加新企业' }));
    const 名称框 = screen.getByPlaceholderText('输入公司名称') as HTMLInputElement;
    expect(名称框.value).toBe('星桥');
    await 用户.type(名称框, '传媒');
    await 用户.click(screen.getByRole('button', { name: '添加并选择' }));
    expect(添加).toHaveBeenCalledWith('星桥传媒');

    await 用户.click(screen.getByRole('button', { name: '返回搜索' }));
    expect(screen.getByRole('button', { name: '星桥传媒' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '添加新企业' })).toBeTruthy();
    // 父层重渲染（新 props 标识）后原选择仍在
    rerender(<公司选择层 {...基础Props({ ...基础, 修改搜索词: vi.fn() })} />);
    expect(screen.getByRole('button', { name: '星桥传媒' })).toBeTruthy();
  });

  it('创建失败保留名称与错误；创建在途禁用「添加并选择」且关闭仍可用', async () => {
    const 关闭 = vi.fn();
    const 添加 = vi.fn();
    const 用户 = userEvent.setup();
    const 基础 = 基础Props({ 搜索词: '', 添加, 关闭 });
    const { rerender } = render(<公司选择层 {...基础} />);
    await 用户.click(screen.getByRole('button', { name: '添加新企业' }));
    const 名称框 = screen.getByPlaceholderText('输入公司名称') as HTMLInputElement;
    await 用户.type(名称框, '新大陆科技');
    await 用户.click(screen.getByRole('button', { name: '添加并选择' }));
    expect(添加).toHaveBeenCalledTimes(1);

    rerender(<公司选择层 {...基础Props({ 搜索词: '', 添加, 关闭, 创建错误: '企业名称已存在' })} />);
    expect(screen.getByText('企业名称已存在')).toBeTruthy();
    expect((screen.getByPlaceholderText('输入公司名称') as HTMLInputElement).value).toBe('新大陆科技');

    rerender(<公司选择层 {...基础Props({ 搜索词: '', 添加, 关闭, 创建中: true })} />);
    expect((screen.getByRole('button', { name: '添加并选择' }) as HTMLButtonElement).disabled).toBe(true);
    await 用户.click(screen.getByRole('button', { name: '关闭选择企业' }));
    expect(关闭).toHaveBeenCalledOnce();
  });

  it('名称校验：拒纯空白与控制字符；81 字拒；80 个中文字可提交并按原样交给 添加', async () => {
    const 添加 = vi.fn();
    render(<公司选择层 {...基础Props({ 添加 })} />);
    await userEvent.setup().click(screen.getByRole('button', { name: '添加新企业' }));
    const 名称框 = screen.getByPlaceholderText('输入公司名称') as HTMLInputElement;
    const 提交键 = () => screen.getByRole('button', { name: '添加并选择' }) as HTMLButtonElement;

    // 纯空白：去首尾空白后为空，不可提交
    fireEvent.change(名称框, { target: { value: '   ' } });
    expect(提交键().disabled).toBe(true);

    // 81 个码点：超长拒绝
    fireEvent.change(名称框, { target: { value: '企'.repeat(81) } });
    expect(提交键().disabled).toBe(true);
    expect(screen.getByText('公司名称需为 1–80 个字符')).toBeTruthy();

    // 控制字符拒绝（\u0007 响铃为控制字符）
    fireEvent.change(名称框, { target: { value: '公司\u0007' } });
    expect(提交键().disabled).toBe(true);
    expect(screen.getByText('公司名称不能包含控制字符')).toBeTruthy();

    // 合法边界：80 个中文码点可提交
    fireEvent.change(名称框, { target: { value: '企'.repeat(80) } });
    expect(提交键().disabled).toBe(false);
    await userEvent.setup().click(提交键());
    expect(添加).toHaveBeenCalledWith('企'.repeat(80));
  });

  it('关闭回调稳定：父层重渲染（新 关闭 标识）不把焦点收回首个控件，连续输入不被打断', async () => {
    const 用户 = userEvent.setup();
    const { rerender } = render(<公司选择层 {...基础Props()} />);
    await 用户.click(screen.getByRole('button', { name: '添加新企业' }));
    const 名称框 = screen.getByPlaceholderText('输入公司名称') as HTMLInputElement;
    await 用户.click(名称框);
    await 用户.type(名称框, '新');
    // 父层重渲染：每次都传入全新的 关闭 标识（模拟页面每渲染新建回调）
    rerender(<公司选择层 {...基础Props({ 关闭: vi.fn() })} />);
    rerender(<公司选择层 {...基础Props({ 关闭: vi.fn() })} />);
    expect(document.activeElement).toBe(名称框);
    expect(名称框.value).toBe('新');
    await 用户.type(名称框, '大陆');
    expect(名称框.value).toBe('新大陆');
  });

  it('中文输入法组词期间 Enter 不触发首行选择或创建', async () => {
    const 选定 = vi.fn();
    const 添加 = vi.fn();
    const 用户 = userEvent.setup();
    const { rerender } = render(
      <公司选择层
        {...基础Props({ 搜索词: '云衢', 项们: [行({ 键: 'org_1', 名称: '云衢科技', 已认证: true })], 选定, 添加 })}
      />,
    );
    const 搜索框 = screen.getByPlaceholderText('输入公司名称') as HTMLInputElement;
    await 用户.click(搜索框);
    // 组词期间的 Enter（isComposing）不应选中首行 —— 组件不给 Enter 绑定任何提交/选择
    搜索框.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
    );
    await 用户.keyboard('{Enter}');
    expect(选定).not.toHaveBeenCalled();

    await 用户.click(screen.getByRole('button', { name: '添加新企业' }));
    rerender(
      <公司选择层
        {...基础Props({ 搜索词: '云衢', 项们: [行({ 键: 'org_1', 名称: '云衢科技', 已认证: true })], 选定, 添加 })}
      />,
    );
    const 名称框 = screen.getByPlaceholderText('输入公司名称') as HTMLInputElement;
    await 用户.click(名称框);
    名称框.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
    );
    await 用户.keyboard('{Enter}');
    expect(添加).not.toHaveBeenCalled();
  });
});