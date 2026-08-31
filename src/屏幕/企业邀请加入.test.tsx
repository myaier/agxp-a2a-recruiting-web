// 企业邀请加入 · raw token 生命周期组件测试（P1C Task 3 Step 3）。
// token 只进接受操作与 POST body：不进 URL / history state / reducer action / storage /
// 错误文案；提交完成、失败、离页、subject 变更即清空。
// 仓库未装 @testing-library/jest-dom，值断言直接读 DOM value。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 企业邀请加入 from './企业邀请加入';
import { BFF错误 } from '../数据/HTTP客户端';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock接受企业邀请 = vi.fn(async () => {});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }),
}));

/** Storage 对象 JSON.stringify 不可靠（返回 undefined），按 key 枚举拼接检查。
 *  本 jsdom 环境未暴露 localStorage/sessionStorage（typeof 为 undefined）时无可残留之处。 */
function 桶内全文(桶: Storage | undefined): string {
  if (!桶) return '';
  return Array.from({ length: 桶.length }, (_, 序) => 桶.getItem(桶.key(序) ?? '') ?? '').join('|');
}

function 置Backend应用状态(主体编号: string | null = 'sub_1') {
  mock应用状态 = {
    状态: {},
    派发: mock派发,
    操作: { 接受企业邀请: mock接受企业邀请 },
    数据源模式: 'backend',
    后端状态: { 主体: 主体编号 === null ? null : { subject_id: 主体编号 } },
  };
}

describe('企业邀请加入 · token 只进接受操作', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock返回.mockClear();
    mock接受企业邀请.mockClear();
    mock接受企业邀请.mockResolvedValue(undefined);
    置Backend应用状态();
  });

  it('邀请 token 只进入接受操作，成功后立即清空', async () => {
    mock接受企业邀请.mockResolvedValue(undefined);
    render(<MemoryRouter initialEntries={['/hr/organization-invitation']}><企业邀请加入 /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText('邀请口令'), 'secret-token');
    await userEvent.click(screen.getByRole('button', { name: '加入企业' }));
    expect(mock接受企业邀请).toHaveBeenCalledWith('secret-token');
    expect((screen.getByLabelText('邀请口令') as HTMLInputElement).value).toBe('');
    expect(JSON.stringify(mock派发.mock.calls)).not.toContain('secret-token');
    expect(window.location.href).not.toContain('secret-token');
    expect(window.history.state == null ? '' : JSON.stringify(window.history.state)).not.toContain('secret-token');
  });

  it('失败清空口令；not_found 用统一文案，错误详情不回显 token', async () => {
    mock接受企业邀请.mockRejectedValue(new BFF错误(404, 'not_found', 'invitation not found'));
    const 用户 = userEvent.setup();
    render(<MemoryRouter><企业邀请加入 /></MemoryRouter>);
    await 用户.type(screen.getByLabelText('邀请口令'), 'secret-token');
    await 用户.click(screen.getByRole('button', { name: '加入企业' }));
    expect(await screen.findByText('邀请口令无效或已过期')).toBeTruthy();
    expect((screen.getByLabelText('邀请口令') as HTMLInputElement).value).toBe('');
    expect(document.body.textContent ?? '').not.toContain('secret-token');
  });

  it('invitation_used 单独提示，同样不回显 token', async () => {
    mock接受企业邀请.mockRejectedValue(new BFF错误(409, 'invitation_used', 'already used'));
    const 用户 = userEvent.setup();
    render(<MemoryRouter><企业邀请加入 /></MemoryRouter>);
    await 用户.type(screen.getByLabelText('邀请口令'), 'secret-token');
    await 用户.click(screen.getByRole('button', { name: '加入企业' }));
    expect(await screen.findByText('该邀请已被使用')).toBeTruthy();
    expect(document.body.textContent ?? '').not.toContain('secret-token');
  });

  it('空口令不调 operation', async () => {
    const 用户 = userEvent.setup();
    render(<MemoryRouter><企业邀请加入 /></MemoryRouter>);
    await 用户.click(screen.getByRole('button', { name: '加入企业' }));
    expect(mock接受企业邀请).not.toHaveBeenCalled();
    expect(screen.getByText('请输入邀请口令')).toBeTruthy();
  });

  it('离页（卸载）后 token 不残留在 DOM 与任何 storage', async () => {
    const 用户 = userEvent.setup();
    const { unmount } = render(<MemoryRouter><企业邀请加入 /></MemoryRouter>);
    await 用户.type(screen.getByLabelText('邀请口令'), 'secret-token');
    unmount();
    expect(document.body.textContent ?? '').not.toContain('secret-token');
    expect(桶内全文(window.localStorage)).not.toContain('secret-token');
    expect(桶内全文(window.sessionStorage)).not.toContain('secret-token');
  });

  it('subject 变更即清空口令', async () => {
    const 用户 = userEvent.setup();
    const { rerender } = render(<MemoryRouter><企业邀请加入 /></MemoryRouter>);
    await 用户.type(screen.getByLabelText('邀请口令'), 'secret-token');
    置Backend应用状态('sub_2'); // 换账号：上个主体键入的口令必须立刻消失
    rerender(<MemoryRouter><企业邀请加入 /></MemoryRouter>);
    expect((screen.getByLabelText('邀请口令') as HTMLInputElement).value).toBe('');
  });
});
