// 招聘名片 · Backend 双分支组件测试（P1C Task 3 Step 1）。
// Backend：姓名槽 verified_name ?? public_name（verified 即只读）、职务落 title、一次保存调
// 保存招聘方档案；公司槽读 current affiliation / 未认证声明，多个可用关系要求显式选择。
// Mock：三行就地编辑 + 存企业认证 + 去发岗 原样保留。
// 仓库未装 @testing-library/jest-dom，值断言直接读 DOM value。

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 招聘名片 from './招聘名片';
import { BFF企业关系样本, BFF招聘方档案样本 } from '../测试/BFF样本';
import { BFF错误 } from '../数据/HTTP客户端';
import { 路径 } from '../路由/路径表';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock保存招聘方档案 = vi.fn(async () => {});
const mock选择企业关系 = vi.fn(async () => {});
const mock保存未认证公司声明 = vi.fn();
const mock替换头像 = vi.fn(async (_文件: File) => {});
// Mock 分支的既有压缩路径：Backend 分支绝不能走它（只允许 object URL 预览）
const mock压成头像 = vi.fn(async (_文件: File) => 'data:image/jpeg;base64,压缩头像');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }),
}));
vi.mock('../组件/头像处理', () => ({
  // 工厂体内不直接引用外层 vi.fn（hoisting 会踩 TDZ），调用时再转交
  压成头像: (...参数: Parameters<typeof mock压成头像>) => mock压成头像(...参数),
}));

/** Backend 头像槽的合法文件（PNG、小于 10 MiB） */
const pngFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], '头像.png', { type: 'image/png' });

function 置Backend应用状态(
  组织: Record<string, unknown> & { 后端状态?: Record<string, unknown> } = {},
) {
  // 后端状态 顶层单独覆盖（账号变化用例换 subject_id），其余键都进 状态
  const { 后端状态: 覆盖后端状态, ...状态覆盖 } = 组织;
  mock应用状态 = {
    状态: {
      招聘方档案: BFF招聘方档案样本,
      企业关系列表: [],
      当前企业关系编号: null,
      企业管理员申请列表: [],
      未认证公司声明: '',
      招聘头像: null,
      // 现组件无条件读 企业认证：Backend 桩补空值，让 RED 落在行为差异而不是读 undefined
      企业认证: { 姓名: '', 公司: '', 职务: '' },
      ...状态覆盖,
    },
    派发: mock派发,
    操作: {
      保存招聘方档案: mock保存招聘方档案,
      选择企业关系: mock选择企业关系,
      保存未认证公司声明: mock保存未认证公司声明,
      替换招聘方头像: mock替换头像,
    },
    后端状态: { 主体: { subject_id: 'sub_1' }, ...覆盖后端状态 },
    数据源模式: 'backend',
  };
}

function 置Mock应用状态() {
  mock应用状态 = {
    状态: {
      企业认证: { 姓名: '邵铭', 公司: '云衢科技', 职务: '技术 VP' },
      招聘头像: null,
    },
    派发: mock派发,
  };
}

describe('招聘名片 · Backend 诚实身份', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock返回.mockClear();
    mock保存招聘方档案.mockClear();
    mock保存招聘方档案.mockResolvedValue(undefined);
    mock选择企业关系.mockClear();
    mock保存未认证公司声明.mockClear();
    mock替换头像.mockClear();
    mock替换头像.mockResolvedValue(undefined);
    mock压成头像.mockClear();
    置Backend应用状态();
  });

  it('多个有效关系要求显式选择，不把第一项当 current', () => {
    置Backend应用状态({
      企业关系列表: [BFF企业关系样本, { ...BFF企业关系样本, affiliation_id: 'aff_2' }],
      当前企业关系编号: null,
    });
    render(<MemoryRouter><招聘名片 /></MemoryRouter>);
    expect(screen.getByText('请选择当前任职企业')).toBeTruthy();
    expect(mock选择企业关系).not.toHaveBeenCalled();
  });

  it('verified_name 存在时姓名槽只读，公开名不可编辑，职务仍可编辑', () => {
    置Backend应用状态({
      招聘方档案: {
        ...BFF招聘方档案样本,
        personal_verification_status: 'verified',
        verified_name: '林澈真名',
      },
    });
    render(<MemoryRouter><招聘名片 /></MemoryRouter>);
    // 姓名槽是只读展示：没有输入框，预览行与姓名行都显示实名
    expect(screen.queryByLabelText('姓名')).toBeNull();
    expect(screen.getAllByText('林澈真名').length).toBeGreaterThan(0);
    expect(screen.getByText('已认证')).toBeTruthy();
    expect(screen.getByLabelText('职务')).toBeTruthy();
  });

  it('未 verified 时公开名可编辑，不出现认证 badge', () => {
    render(<MemoryRouter><招聘名片 /></MemoryRouter>);
    expect(screen.getByLabelText('姓名')).toBeTruthy();
    expect(screen.queryByText('已认证')).toBeNull();
  });

  it('保存一次携带 public_name 与 title，成功响应后才提示保存成功', async () => {
    const 用户 = userEvent.setup();
    render(<MemoryRouter><招聘名片 /></MemoryRouter>);
    await 用户.clear(screen.getByLabelText('姓名'));
    await 用户.type(screen.getByLabelText('姓名'), '新公开名');
    await 用户.clear(screen.getByLabelText('职务'));
    await 用户.type(screen.getByLabelText('职务'), '技术合伙人');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock保存招聘方档案).toHaveBeenCalledTimes(1);
    expect(mock保存招聘方档案).toHaveBeenCalledWith({
      public_name: '新公开名',
      title: '技术合伙人',
    });
    expect(await screen.findByText('保存成功')).toBeTruthy();
  });

  it('保存失败保留输入并展示该槽位的拒绝理由', async () => {
    mock保存招聘方档案.mockRejectedValue(
      new BFF错误(400, 'validation_failed', '校验未通过', [
        { path: 'title', reason: '职务过长' },
      ]),
    );
    const 用户 = userEvent.setup();
    render(<MemoryRouter><招聘名片 /></MemoryRouter>);
    await 用户.clear(screen.getByLabelText('姓名'));
    await 用户.type(screen.getByLabelText('姓名'), '新公开名');
    await 用户.clear(screen.getByLabelText('职务'));
    await 用户.type(screen.getByLabelText('职务'), '超长职务');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('职务过长')).toBeTruthy();
    // 失败不清输入：两行仍保留用户键入值
    expect((screen.getByLabelText('姓名') as HTMLInputElement).value).toBe('新公开名');
    expect((screen.getByLabelText('职务') as HTMLInputElement).value).toBe('超长职务');
  });

  it('无 current affiliation 时公司输入保存为未认证声明，不创建 Organization', () => {
    render(<MemoryRouter><招聘名片 /></MemoryRouter>);
    const 公司输入 = screen.getByLabelText('公司');
    fireEvent.change(公司输入, { target: { value: '自由身科技' } });
    fireEvent.blur(公司输入);
    expect(mock保存未认证公司声明).toHaveBeenCalledWith('自由身科技');
    // 声明不是组织事实：不派发任何水合/选择动作
    expect(mock派发).not.toHaveBeenCalled();
    expect(mock选择企业关系).not.toHaveBeenCalled();
  });

  it('点可用关系行走选择企业关系，current 关系展示为当前', async () => {
    const 用户 = userEvent.setup();
    置Backend应用状态({
      企业关系列表: [BFF企业关系样本, { ...BFF企业关系样本, affiliation_id: 'aff_2', organization_display_name: '云衢子公司' }],
      当前企业关系编号: 'aff_1',
    });
    render(<MemoryRouter><招聘名片 /></MemoryRouter>);
    expect(screen.getByText(/当前/)).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: /云衢子公司/ }));
    expect(mock选择企业关系).toHaveBeenCalledWith('aff_2');
  });

  it('单个可用关系在无 current 时也等待用户选择（屏内不自动猜）', () => {
    置Backend应用状态({
      企业关系列表: [BFF企业关系样本],
      当前企业关系编号: null,
    });
    render(<MemoryRouter><招聘名片 /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /云衢科技/ })).toBeTruthy();
    expect(mock选择企业关系).not.toHaveBeenCalled();
  });
});

describe('招聘名片 · Backend 头像原子保存', () => {
  // 仓库未装 @testing-library/jest-dom：属性断言直接读 DOM attribute
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock返回.mockClear();
    mock保存招聘方档案.mockClear();
    mock保存招聘方档案.mockResolvedValue(undefined);
    mock选择企业关系.mockClear();
    mock保存未认证公司声明.mockClear();
    mock替换头像.mockClear();
    mock替换头像.mockResolvedValue(undefined);
    mock压成头像.mockClear();
    mock压成头像.mockResolvedValue('data:image/jpeg;base64,压缩头像');
    置Backend应用状态();
  });

  it('Backend 保存成功前只使用 object URL 预览', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:avatar-preview');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const 用户 = userEvent.setup();
    render(<MemoryRouter><招聘名片 /></MemoryRouter>);
    await 用户.upload(screen.getByLabelText('更换头像'), pngFile);
    // 只有内存预览：不压 data URL、不落全局头像
    expect(screen.getByRole('img', { name: '头像预览' }).getAttribute('src')).toBe('blob:avatar-preview');
    expect(mock压成头像).not.toHaveBeenCalled();
    expect(mock派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '存招聘头像' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock替换头像).toHaveBeenCalledWith(pngFile));
    // 服务端成功后预览收口：object URL 被回收，权威头像由 operation 的响应替换
    expect(revoke).toHaveBeenCalledWith('blob:avatar-preview');
    expect(screen.queryByRole('img', { name: '头像预览' })).toBeNull();
  });

  it('409 保留 file 与预览，提示后由用户再按一次保存重试', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:avatar-preview');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    mock替换头像.mockRejectedValueOnce(new BFF错误(409, 'version_conflict', 'conflict'));
    const 用户 = userEvent.setup();
    render(<MemoryRouter><招聘名片 /></MemoryRouter>);
    await 用户.upload(screen.getByLabelText('更换头像'), pngFile);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('数据已在其他地方更新，请重试')).toBeTruthy();
    // 409 重读后的权威档案不顶掉用户手里的文件与预览
    expect(screen.getByRole('img', { name: '头像预览' }).getAttribute('src')).toBe('blob:avatar-preview');
    expect(revoke).not.toHaveBeenCalledWith('blob:avatar-preview');
    mock替换头像.mockResolvedValueOnce(undefined);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock替换头像).toHaveBeenCalledTimes(2));
    expect(revoke).toHaveBeenCalledWith('blob:avatar-preview');
  });

  it('失败不显示「头像已更新」，预览与文件保留', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:avatar-preview');
    mock替换头像.mockRejectedValue(new BFF错误(400, 'validation_failed', '校验未通过'));
    const 用户 = userEvent.setup();
    render(<MemoryRouter><招聘名片 /></MemoryRouter>);
    await 用户.upload(screen.getByLabelText('更换头像'), pngFile);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock替换头像).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('头像已更新')).toBeNull();
    expect(screen.getByRole('img', { name: '头像预览' })).toBeTruthy();
  });

  it('非 PNG/JPEG 或超过 10 MiB 的文件拒绝且不生成预览', async () => {
    const 建预览 = vi.spyOn(URL, 'createObjectURL');
    const 用户 = userEvent.setup();
    render(<MemoryRouter><招聘名片 /></MemoryRouter>);
    await 用户.upload(
      screen.getByLabelText('更换头像'),
      new File([new Uint8Array(8)], '头像.webp', { type: 'image/webp' }),
    );
    expect(await screen.findByText('仅支持 PNG / JPEG 图片')).toBeTruthy();
    建预览.mockClear();
    await 用户.upload(
      screen.getByLabelText('更换头像'),
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], '大图.png', { type: 'image/png' }),
    );
    expect(await screen.findByText('图片不超过 10 MiB')).toBeTruthy();
    expect(建预览).not.toHaveBeenCalled();
    expect(mock替换头像).not.toHaveBeenCalled();
  });

  it('unmount 回收 object URL', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:avatar-unmount');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const 用户 = userEvent.setup();
    const { unmount } = render(<MemoryRouter><招聘名片 /></MemoryRouter>);
    await 用户.upload(screen.getByLabelText('更换头像'), pngFile);
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:avatar-unmount');
  });

  it('账号变化回收上一账号的 object URL 并丢弃未保存文件', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:avatar-switch');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const 用户 = userEvent.setup();
    const 视图 = render(<MemoryRouter><招聘名片 /></MemoryRouter>);
    await 用户.upload(screen.getByLabelText('更换头像'), pngFile);
    // 换账号（新主体水合）：上一账号的预览与待上传文件一并作废
    置Backend应用状态({ 后端状态: { 主体: { subject_id: 'sub_2' } } });
    视图.rerender(<MemoryRouter><招聘名片 /></MemoryRouter>);
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:avatar-switch'));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock保存招聘方档案).toHaveBeenCalledTimes(1));
    expect(mock替换头像).not.toHaveBeenCalled();
  });
});

describe('招聘名片 · Mock 原型保持不变', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock返回.mockClear();
    mock替换头像.mockClear();
    mock压成头像.mockClear();
    mock压成头像.mockResolvedValue('data:image/jpeg;base64,压缩头像');
    置Mock应用状态();
  });

  it('三行就地编辑读企业认证 fixture，保存时落全局并按注册流去发岗', async () => {
    const 用户 = userEvent.setup();
    render(<MemoryRouter><招聘名片 /></MemoryRouter>);
    expect((screen.getByLabelText('姓名') as HTMLInputElement).value).toBe('邵铭');
    expect((screen.getByLabelText('职务') as HTMLInputElement).value).toBe('技术 VP');
    expect((screen.getByLabelText('公司') as HTMLInputElement).value).toBe('云衢科技');
    await 用户.click(screen.getByRole('button', { name: '保存 · 去发岗位' }));
    await waitFor(() =>
      expect(mock派发).toHaveBeenCalledWith({
        型: '存企业认证',
        姓名: '邵铭',
        公司: '云衢科技',
        职务: '技术 VP',
      }),
    );
    expect(mock跳转).toHaveBeenCalledWith(路径.发布岗位, { 从注册流: true });
  });

  it('Mock 选图仍走 压成头像 压缩 data URL 路径并落全局头像', async () => {
    const 建对象 = vi.spyOn(URL, 'createObjectURL');
    const 用户 = userEvent.setup();
    render(<MemoryRouter><招聘名片 /></MemoryRouter>);
    // Mock 原型的隐藏文件框没有 aria-label（标签在按钮上），直接取 input 本体
    const 文件框 = document.querySelector('input[type="file"]') as HTMLInputElement;
    await 用户.upload(文件框, pngFile);
    await waitFor(() => expect(mock压成头像).toHaveBeenCalledWith(pngFile));
    expect(mock派发).toHaveBeenCalledWith({
      型: '存招聘头像',
      图: 'data:image/jpeg;base64,压缩头像',
    });
    expect(await screen.findByText('头像已更新')).toBeTruthy();
    expect(建对象).not.toHaveBeenCalled();
  });
});
