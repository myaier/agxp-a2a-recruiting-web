// 招聘名片展示 组件测：一份 JSX 吃 招聘名片展示属性 + 业务回调（接口 B）。
// fixture 全部用本文件接口构造，不读 Mock 表、不读应用状态、不发请求。
// 断言钉住 Spec §5：受控/收笔两套持久化时机共用一份输入 JSX、IME 合成态回车不收笔、
// 预览缺值占位只出现在展示、原始输入不写「未知」、关系/声明是连接层算好的 props。

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 招聘名片展示 from './招聘名片展示';
import type { 招聘名片展示属性, 名片输入 } from './招聘名片展示';

function 受控输入(值: string, 修改 = (_值: string) => {}): 名片输入 {
  return { 模式: '受控', 值, 修改 };
}

function 收笔输入(值: string, 收笔: (值: string) => void = () => {}): 名片输入 {
  return { 模式: '收笔', 值, 收笔 };
}

/** Mock 原型形态：三行都收笔落全局、总是有声明输入 */
function Mock属性(覆盖: Partial<招聘名片展示属性> = {}): 招聘名片展示属性 {
  return {
    预览: { 姓名: '邵铭', 职务: '技术 VP', 公司: '云衢科技', 图片: null, 暂存图片: false, 已认证: false },
    姓名: { 类型: '姓名', 输入: 收笔输入('邵铭') },
    职务: 收笔输入('技术 VP'),
    公司: {
      关系: [],
      选择: () => {},
      待选提示: false,
      声明: { 标签: '公司', 输入: 收笔输入('云衢科技') },
    },
    选照片: () => {},
    保存: () => {},
    保存文字: '保存 · 去发岗位',
    保存中: false,
    返回: () => {},
    打开公司资料: () => {},
    ...覆盖,
  };
}

describe('招聘名片展示 · 输入行共用外壳', () => {
  it('受控模式：change 回调收到用户原始值，不能以预览占位替换', async () => {
    const 修改姓名 = vi.fn();
    const 用户 = userEvent.setup();
    render(
      <招聘名片展示
        {...Mock属性({
          预览: { 姓名: '', 职务: '技术 VP', 公司: '云衢科技', 图片: null, 暂存图片: false, 已认证: false },
          姓名: { 类型: '公开名', 输入: 受控输入('', 修改姓名) },
          保存文字: '保存',
        })}
      />,
    );
    const 姓名 = screen.getByLabelText('姓名');
    await 用户.type(姓名, '林');
    expect(修改姓名).toHaveBeenCalledWith('林');
  });

  it('渲染空公开名后输入值是空串，不是「姓名未知」；占位只出现在 placeholder', () => {
    render(
      <招聘名片展示
        {...Mock属性({
          预览: { 姓名: '', 职务: '', 公司: '', 图片: null, 暂存图片: false, 已认证: false },
          姓名: { 类型: '公开名', 输入: 受控输入('') },
          职务: 受控输入(''),
          公司: { 关系: [], 选择: () => {}, 待选提示: false, 声明: { 标签: '公司', 输入: 受控输入('') } },
        })}
      />,
    );
    const 姓名 = screen.getByLabelText('姓名') as HTMLInputElement;
    expect(姓名.value).toBe('');
    expect(姓名.getAttribute('placeholder')).toBe('请填写姓名');
    expect((screen.getByLabelText('职务') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('公司') as HTMLInputElement).value).toBe('');
    // 预览占位在展示层，不进输入
    expect(screen.getByText('姓名未知')).toBeTruthy();
    expect(screen.getByText(/职务未知/)).toBeTruthy();
    expect(screen.getByText(/企业信息未知/)).toBeTruthy();
  });

  it('空输入的提示分别为请填写姓名/请填写职务/请填写公司名称', () => {
    render(
      <招聘名片展示
        {...Mock属性({
          姓名: { 类型: '姓名', 输入: 收笔输入('') },
          职务: 收笔输入(''),
          公司: { 关系: [], 选择: () => {}, 待选提示: false, 声明: { 标签: '公司', 输入: 收笔输入('') } },
        })}
      />,
    );
    expect(screen.getByLabelText('姓名').getAttribute('placeholder')).toBe('请填写姓名');
    expect(screen.getByLabelText('职务').getAttribute('placeholder')).toBe('请填写职务');
    expect(screen.getByLabelText('公司').getAttribute('placeholder')).toBe('请填写公司名称');
  });

  it('收笔模式：失焦收笔一次并携带输入值', async () => {
    const 收笔姓名 = vi.fn();
    const 用户 = userEvent.setup();
    render(<招聘名片展示 {...Mock属性({ 姓名: { 类型: '姓名', 输入: 收笔输入('邵铭', 收笔姓名) } })} />);
    const 姓名 = screen.getByLabelText('姓名');
    await 用户.clear(姓名);
    await 用户.type(姓名, '邵大铭');
    fireEvent.blur(姓名);
    expect(收笔姓名).toHaveBeenCalledTimes(1);
    expect(收笔姓名).toHaveBeenCalledWith('邵大铭');
  });

  it('收笔模式：输入法合成态回车保持焦点且不收笔不保存；非合成回车失焦且收笔仅一次、保存仍未调用', () => {
    const 收笔姓名 = vi.fn();
    const 保存 = vi.fn();
    render(
      <招聘名片展示
        {...Mock属性({ 姓名: { 类型: '姓名', 输入: 收笔输入('邵铭', 收笔姓名) }, 保存 })}
      />,
    );
    const 姓名 = screen.getByLabelText('姓名');
    姓名.focus();
    // 中文输入法「回车上屏候选词」那一下：不是收笔
    fireEvent.keyDown(姓名, { key: 'Enter', isComposing: true });
    expect(document.activeElement).toBe(姓名);
    expect(收笔姓名).not.toHaveBeenCalled();
    expect(保存).not.toHaveBeenCalled();
    // 合成结束后的回车：走 blur 一条路径，收笔只提交一次
    fireEvent.keyDown(姓名, { key: 'Enter', isComposing: false });
    expect(document.activeElement).not.toBe(姓名);
    expect(收笔姓名).toHaveBeenCalledTimes(1);
    expect(保存).not.toHaveBeenCalled();
  });

  it('受控模式：普通回车不触发保存', () => {
    const 保存 = vi.fn();
    render(
      <招聘名片展示
        {...Mock属性({ 姓名: { 类型: '公开名', 输入: 受控输入('邵铭') }, 保存 })}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText('姓名'), { key: 'Enter', isComposing: false });
    expect(保存).not.toHaveBeenCalled();
  });

  it('aria-label 稳定为姓名/职务/公司，不随标签文案改变', () => {
    render(
      <招聘名片展示
        {...Mock属性({
          姓名: { 类型: '公开名', 输入: 受控输入('邵铭') },
          公司: {
            关系: [],
            选择: () => {},
            待选提示: false,
            声明: { 标签: '公司（未认证声明）', 输入: 受控输入('云衢科技') },
          },
        })}
      />,
    );
    expect(screen.getByText('姓名（公开名）')).toBeTruthy();
    expect(screen.getByLabelText('姓名')).toBeTruthy();
    expect(screen.getByText('公司（未认证声明）')).toBeTruthy();
    expect(screen.getByLabelText('公司')).toBeTruthy();
    expect(screen.getByLabelText('职务')).toBeTruthy();
  });

  it('只读姓名用文本元素：没有姓名输入框，职务仍可编辑', () => {
    render(
      <招聘名片展示
        {...Mock属性({ 姓名: { 类型: '只读', 值: '林澈真名' }, 职务: 受控输入('技术合伙人') })}
      />,
    );
    expect(screen.queryByLabelText('姓名')).toBeNull();
    expect(screen.getByText('姓名（已实名，不可修改）')).toBeTruthy();
    expect(screen.getByText('林澈真名')).toBeTruthy();
    expect(screen.getByLabelText('职务')).toBeTruthy();
  });
});

describe('招聘名片展示 · 预览', () => {
  it('缺值显示姓名未知/职务未知/企业信息未知，不用姓名首字冒充头像', () => {
    const { container } = render(
      <招聘名片展示
        {...Mock属性({
          预览: { 姓名: '', 职务: '', 公司: '', 图片: null, 暂存图片: false, 已认证: false },
          姓名: { 类型: '公开名', 输入: 受控输入('') },
        })}
      />,
    );
    expect(screen.getByText('姓名未知')).toBeTruthy();
    expect(screen.getByText(/职务未知/)).toBeTruthy();
    expect(screen.getByText(/企业信息未知/)).toBeTruthy();
    // 无图：中性空白图位 + 可访问说明，不是姓氏字标
    const 空白头像 = screen.getByRole('img', { name: '头像未知' });
    expect(空白头像.tagName).toBe('SPAN');
    expect(screen.queryByText('邵')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('暂存预览 alt 为头像预览；实际图沿用空 alt；认证标记按事实', () => {
    const { container, rerender } = render(
      <招聘名片展示
        {...Mock属性({
          预览: { 姓名: '邵铭', 职务: '技术 VP', 公司: '云衢科技', 图片: 'blob:avatar-preview', 暂存图片: true, 已认证: false },
        })}
      />,
    );
    expect(screen.getByRole('img', { name: '头像预览' }).getAttribute('src')).toBe('blob:avatar-preview');
    expect(screen.queryByText('已认证')).toBeNull();

    rerender(
      <招聘名片展示
        {...Mock属性({
          预览: { 姓名: '邵铭', 职务: '技术 VP', 公司: '云衢科技', 图片: 'https://cdn.example.com/a.png', 暂存图片: false, 已认证: true },
        })}
      />,
    );
    const 实际图 = container.querySelector('img') as HTMLImageElement;
    expect(实际图.getAttribute('alt')).toBe('');
    expect(screen.getByText('已认证')).toBeTruthy();
  });
});

describe('招聘名片展示 · 公司区', () => {
  it('可选关系行点击触发选择并携带 id，当前行有标记，不可选行如实展示', async () => {
    const 选择 = vi.fn();
    const 用户 = userEvent.setup();
    render(
      <招聘名片展示
        {...Mock属性({
          公司: {
            关系: [
              { id: 'aff_1', 名称: '云衢科技', 角色: '成员', 状态: '已批准', 可选: true, 当前: true },
              { id: 'aff_2', 名称: '云衢子公司', 角色: '管理员', 状态: '待审', 可选: true, 当前: false },
              { id: 'aff_3', 名称: '停用企业', 角色: '成员', 状态: '已撤销', 可选: false, 当前: false },
            ],
            选择,
            待选提示: true,
            声明: null,
          },
        })}
      />,
    );
    expect(screen.getByText('请选择当前任职企业')).toBeTruthy();
    expect(screen.getByText(/云衢科技 · 成员 · 已批准（当前）/)).toBeTruthy();
    expect(screen.getByText(/停用企业 · 成员 · 已撤销（不可选）/)).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: /云衢子公司/ }));
    expect(选择).toHaveBeenCalledWith('aff_2');
  });

  it('声明为 null 时不渲染公司输入（有可用关系未选当前的态）', () => {
    render(
      <招聘名片展示
        {...Mock属性({
          公司: { 关系: [], 选择: () => {}, 待选提示: false, 声明: null },
        })}
      />,
    );
    expect(screen.queryByLabelText('公司')).toBeNull();
  });
});

describe('招聘名片展示 · 操作', () => {
  it('保存中禁用主按钮并显示「保存中…」；非保存中按保存文字渲染并触发保存', async () => {
    const 保存 = vi.fn();
    const 用户 = userEvent.setup();
    const { rerender } = render(
      <招聘名片展示 {...Mock属性({ 保存文字: '保存并继续', 保存中: true, 保存 })} />,
    );
    const 按钮 = screen.getByRole('button', { name: '保存中…' }) as HTMLButtonElement;
    expect(按钮.disabled).toBe(true);
    rerender(<招聘名片展示 {...Mock属性({ 保存文字: '保存并继续', 保存中: false, 保存 })} />);
    await 用户.click(screen.getByRole('button', { name: '保存并继续' }));
    expect(保存).toHaveBeenCalledTimes(1);
  });

  it('上传后清空文件框 value，重复选同一文件也逐次交给外层', async () => {
    const 选照片 = vi.fn();
    const 文件 = new File([new Uint8Array([1])], '头像.png', { type: 'image/png' });
    const 用户 = userEvent.setup();
    render(<招聘名片展示 {...Mock属性({ 选照片 })} />);
    const 文件框 = screen.getByLabelText('更换头像') as HTMLInputElement;
    await 用户.upload(文件框, 文件);
    expect(选照片).toHaveBeenCalledTimes(1);
    expect(选照片).toHaveBeenCalledWith(文件);
    expect(文件框.value).toBe('');
    await 用户.upload(文件框, 文件);
    expect(选照片).toHaveBeenCalledTimes(2);
  });

  it('头像键打开文件框，返回与公司主页资料走外层回调', async () => {
    const 返回 = vi.fn();
    const 打开公司资料 = vi.fn();
    const 用户 = userEvent.setup();
    const { container } = render(
      <招聘名片展示 {...Mock属性({ 返回, 打开公司资料 })} />,
    );
    await 用户.click(screen.getByRole('button', { name: '上传头像' }));
    await 用户.click(screen.getByRole('button', { name: /公司主页资料/ }));
    expect(打开公司资料).toHaveBeenCalledTimes(1);
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(返回).toHaveBeenCalledTimes(1);
    expect(container).toBeTruthy();
  });
});
