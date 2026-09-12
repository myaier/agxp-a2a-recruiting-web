// 登录页短信登录测试（Task 6 + P0 修复 Task 3）：
// 守住四格验证码不被改成六格；Backend 成功后**不**在登录页导航 —— 落点归根路由守卫，
// 登录页只负责把按钮摆成「正在进入…」的禁用态；Mock 分支保留即点即进身份选择。

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, StrictMode } from 'react';
import 登录 from './登录';
import { 路径 } from '../路由/路径表';
import { BFF错误 } from '../数据/HTTP客户端';

const mock跳转 = vi.fn();
const mock操作 = {
  开始手机登录: vi.fn(),
  取消手机登录尝试: vi.fn(),
  完成手机登录: vi.fn(),
  微信登录: vi.fn(),
};
// 数据源模式做成可变的：Mock 分支的即时导航也要在本文件钉住（P0 修复 Task 3）
const mock环境 = vi.hoisted(() => ({ 数据源模式: 'backend' as 'backend' | 'mock' }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转 }) }));
vi.mock('../状态/应用状态', () => ({
  use应用状态: () => ({ 操作: mock操作, 数据源模式: mock环境.数据源模式 }),
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function 轻提示文案条数(文案: string): number {
  const 容器 = Array.from(document.body.children).find(
    (节点) => (节点 as HTMLElement).style?.zIndex === '999',
  );
  return Array.from(容器?.children ?? []).filter((节点) => 节点.textContent === 文案).length;
}

describe('登录页 Backend', () => {
  beforeEach(() => {
    mock环境.数据源模式 = 'backend';
    mock跳转.mockClear();
    mock操作.开始手机登录.mockClear();
    mock操作.取消手机登录尝试.mockClear();
    mock操作.完成手机登录.mockClear();
    mock操作.微信登录.mockClear();
  });

  it('保持四格验证码，Backend 登录成功后停在登录页并复位按钮', async () => {
    const 完成 = deferred<void>();
    mock操作.开始手机登录.mockResolvedValue(undefined);
    mock操作.完成手机登录.mockReturnValue(完成.promise);
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter>
        <登录 />
      </MemoryRouter>,
    );
    await 用户.type(screen.getByLabelText('手机号'), '13800000000');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    await waitFor(() => expect(screen.getByText('验证码已发送')).toBeDefined());
    expect(screen.queryByText(/原型不校验/)).toBeNull();
    expect(document.querySelectorAll('[class*="验证码格"]')).toHaveLength(4);
    await 用户.type(screen.getByLabelText('短信验证码'), '1234');
    await 用户.click(screen.getByText(/已阅读并同意/));
    await 用户.click(screen.getByRole('button', { name: '进入' }));
    // 请求飞行中：按钮换成「正在进入…」且禁用（比 ref 守卫多一层可见反馈）
    const 等待按钮 = screen.getByRole('button', { name: '正在进入…' });
    expect((等待按钮 as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('手机号') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '编辑区号，当前 +86' }) as HTMLButtonElement).disabled).toBe(true);
    expect(mock操作.完成手机登录).toHaveBeenCalledWith('1234');
    expect(mock跳转).not.toHaveBeenCalled();

    完成.resolve();
    await act(async () => { await 完成.promise; });
    // 登录页绝不自己导航：落点归 应用.tsx 的水合守卫
    expect(mock跳转).not.toHaveBeenCalled();
    const 恢复按钮 = screen.getByRole('button', { name: '进入' });
    expect((恢复按钮 as HTMLButtonElement).disabled).toBe(false);
  });

  // P0 修复 Task 3：Mock 分支没有水合阶段可言，仍由登录页直接进身份选择
  it('Mock 短信登录仍由登录页进入身份选择', async () => {
    mock环境.数据源模式 = 'mock';
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter>
        <登录 />
      </MemoryRouter>,
    );
    await 用户.type(screen.getByLabelText('手机号'), '13800000000');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    await 用户.type(screen.getByLabelText('短信验证码'), '1234');
    await 用户.click(screen.getByText(/已阅读并同意/));
    await 用户.click(screen.getByRole('button', { name: '进入' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.选身份);
    expect(mock操作.开始手机登录).not.toHaveBeenCalled();
    expect(mock操作.取消手机登录尝试).not.toHaveBeenCalled();
    expect(mock操作.完成手机登录).not.toHaveBeenCalled();
  });

  // 会话失效（401 invalid_session）：登录页只提示一次，不复位成可重试的假象之外还导航
  it('Backend 水合 401 显示一次会话失效且不导航', async () => {
    mock操作.开始手机登录.mockResolvedValue(undefined);
    mock操作.完成手机登录.mockRejectedValueOnce(
      new BFF错误(401, 'invalid_session', 'expired'),
    );
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter>
        <登录 />
      </MemoryRouter>,
    );
    await 用户.type(screen.getByLabelText('手机号'), '13800000000');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    await 用户.type(screen.getByLabelText('短信验证码'), '1234');
    await 用户.click(screen.getByText(/已阅读并同意/));
    await 用户.click(screen.getByRole('button', { name: '进入' }));

    await waitFor(() => expect(screen.getByText('登录已失效，请重新登录')).toBeTruthy());
    expect(mock跳转).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: '进入' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('微信登录必须先勾选协议', async () => {
    mock操作.微信登录.mockResolvedValue(null);
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter>
        <登录 />
      </MemoryRouter>,
    );

    await 用户.click(screen.getByRole('button', { name: '微信登录' }));
    expect(mock操作.微信登录).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();

    await 用户.click(screen.getByText(/已阅读并同意/));
    await 用户.click(screen.getByRole('button', { name: '微信登录' }));
    await waitFor(() => expect(mock操作.微信登录).toHaveBeenCalledTimes(1));
    expect(mock跳转).toHaveBeenCalledWith(路径.选身份);
  });

  // F11：开始手机登录失败时倒计时不启动，用户可重试（按钮不被倒计时锁住）
  it('开始手机登录失败时不进入倒计时，按钮仍是「获取验证码」可重试', async () => {
    mock操作.开始手机登录.mockRejectedValue(new Error('短信通道异常'));
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter>
        <登录 />
      </MemoryRouter>,
    );
    await 用户.type(screen.getByLabelText('手机号'), '13800000000');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    // 失败后：倒计时文案（Ns）不应出现，按钮仍是「获取验证码」（不是「重新获取」也不是倒计时）
    await waitFor(() => expect(screen.getByRole('button', { name: '获取验证码' })).toBeDefined());
    // 四格验证码区不应出现（剩余秒仍是 null，剩余秒 !== null 才渲染四格）
    expect(document.querySelectorAll('[class*="验证码格"]')).toHaveLength(0);
  });

  // #6：倒计时归零后重发失败，剩余秒归 null（不留在 0），按钮回到「获取验证码」可干净重试。
  it('倒计时归零后重发失败，剩余秒归 null 不留在 0（#6）', async () => {
    vi.useFakeTimers();
    try {
      mock操作.开始手机登录
        .mockResolvedValueOnce(undefined)   // 第一次成功
        .mockRejectedValueOnce(new Error('down')); // 第二次失败
      render(
        <MemoryRouter>
          <登录 />
        </MemoryRouter>,
      );
      // 输入手机号（fireEvent 避免 userEvent 逐字输入与 fake timer 冲突）
      await act(async () => {
        fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800000000' } });
      });
      // 点击获取验证码 → 第一次成功
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));
      });
      // 倒计时启动 → 60s
      expect(screen.getByText(/60s/)).toBeDefined();
      // 逐秒快进到倒计时归零（每秒 effect 重新注册定时器，需逐秒推进让 re-render 发生）
      for (let i = 0; i < 60; i++) {
        await act(async () => { vi.advanceTimersByTime(1000); });
      }
      expect(screen.getByRole('button', { name: '重新获取' })).toBeDefined();
      // 重发失败 → 剩余秒归 null → 按钮回到「获取验证码」
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '重新获取' }));
      });
      expect(screen.getByRole('button', { name: '获取验证码' })).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('新挂载默认 +86，区号弹层取消与 Escape 都恢复触发焦点', async () => {
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter>
        <登录 />
      </MemoryRouter>,
    );
    const 区号键 = screen.getByRole('button', { name: '编辑区号，当前 +86' });
    expect((screen.getByLabelText('手机号') as HTMLInputElement).value).toBe('');

    await 用户.click(区号键);
    expect(screen.getByRole('dialog', { name: '编辑登录区号' })).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('区号'));
    await 用户.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog', { name: '编辑登录区号' })).toBeNull();
    expect(document.activeElement).toBe(区号键);

    await 用户.click(区号键);
    await 用户.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '编辑登录区号' })).toBeNull();
    expect(document.activeElement).toBe(区号键);
    expect(mock操作.取消手机登录尝试).not.toHaveBeenCalled();
  });

  it('非法区号在弹层内显示错误且不提交', async () => {
    const 用户 = userEvent.setup();
    render(<MemoryRouter><登录 /></MemoryRouter>);
    await 用户.click(screen.getByRole('button', { name: '编辑区号，当前 +86' }));
    const 输入 = screen.getByLabelText('区号');
    await 用户.clear(输入);
    await 用户.type(输入, '8x6');
    await 用户.click(screen.getByRole('button', { name: '确认区号' }));
    expect(screen.getByText('区号必须是 1 到 3 位数字且首位不能为 0')).toBeDefined();
    expect(screen.getByRole('dialog', { name: '编辑登录区号' })).toBeDefined();
    expect(mock操作.取消手机登录尝试).not.toHaveBeenCalled();
  });

  it('+999 保留 12 位本地号码并将区号透传给 begin', async () => {
    mock操作.开始手机登录.mockResolvedValue(undefined);
    const 用户 = userEvent.setup();
    render(<MemoryRouter><登录 /></MemoryRouter>);
    await 用户.click(screen.getByRole('button', { name: '编辑区号，当前 +86' }));
    const 区号输入 = screen.getByLabelText('区号');
    await 用户.clear(区号输入);
    await 用户.type(区号输入, '999');
    await 用户.click(screen.getByRole('button', { name: '确认区号' }));
    const 手机号 = screen.getByLabelText('手机号');
    await 用户.type(手机号, '123456789012');
    expect((手机号 as HTMLInputElement).value).toBe('123456789012');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    await waitFor(() => expect(mock操作.开始手机登录).toHaveBeenCalledWith('123456789012', '+999'));
  });

  it('已取码后实际换号清除验证码和 attempt，但保留未到期倒计时', async () => {
    mock操作.开始手机登录.mockResolvedValue(undefined);
    const 用户 = userEvent.setup();
    render(<MemoryRouter><登录 /></MemoryRouter>);
    await 用户.type(screen.getByLabelText('手机号'), '13800000000');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    await waitFor(() => expect(screen.getByText('60s')).toBeDefined());
    await 用户.type(screen.getByLabelText('短信验证码'), '1234');
    await 用户.clear(screen.getByLabelText('手机号'));
    await 用户.type(screen.getByLabelText('手机号'), '13900000000');

    expect((screen.getByLabelText('短信验证码') as HTMLInputElement).value).toBe('');
    expect(screen.getByText('60s')).toBeDefined();
    expect(mock操作.取消手机登录尝试).toHaveBeenCalled();
  });

  it('确认相同区号不作废已取码状态', async () => {
    mock操作.开始手机登录.mockResolvedValue(undefined);
    const 用户 = userEvent.setup();
    render(<MemoryRouter><登录 /></MemoryRouter>);
    await 用户.type(screen.getByLabelText('手机号'), '13800000000');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    await waitFor(() => expect(screen.getByText('60s')).toBeDefined());
    await 用户.type(screen.getByLabelText('短信验证码'), '1234');
    await 用户.click(screen.getByRole('button', { name: '编辑区号，当前 +86' }));
    await 用户.click(screen.getByRole('button', { name: '确认区号' }));

    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '(138) 0000-0000' } });

    expect((screen.getByLabelText('短信验证码') as HTMLInputElement).value).toBe('1234');
    expect(mock操作.取消手机登录尝试).not.toHaveBeenCalled();
  });

  it('非 +86 超长输入完整可见但不能发送，改回 +86 也不截断', async () => {
    const 用户 = userEvent.setup();
    render(<MemoryRouter><登录 /></MemoryRouter>);
    await 用户.click(screen.getByRole('button', { name: '编辑区号，当前 +86' }));
    await 用户.clear(screen.getByLabelText('区号'));
    await 用户.type(screen.getByLabelText('区号'), '999');
    await 用户.click(screen.getByRole('button', { name: '确认区号' }));
    const 手机号 = screen.getByLabelText('手机号');
    await 用户.type(手机号, '1234567890123');
    expect((手机号 as HTMLInputElement).value).toBe('1234567890123');
    expect((screen.getByRole('button', { name: '获取验证码' }) as HTMLButtonElement).disabled).toBe(true);

    await 用户.click(screen.getByRole('button', { name: '编辑区号，当前 +999' }));
    await 用户.clear(screen.getByLabelText('区号'));
    await 用户.type(screen.getByLabelText('区号'), '86');
    await 用户.click(screen.getByRole('button', { name: '确认区号' }));
    expect((手机号 as HTMLInputElement).value).toBe('1234567890123');
    expect(mock操作.开始手机登录).not.toHaveBeenCalled();
  });

  it('begin 飞行期禁用手机号、区号和重复取码', async () => {
    const begin = deferred<void>();
    mock操作.开始手机登录.mockReturnValue(begin.promise);
    const 用户 = userEvent.setup();
    render(<MemoryRouter><登录 /></MemoryRouter>);
    await 用户.type(screen.getByLabelText('手机号'), '13800000000');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));

    expect((screen.getByLabelText('手机号') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '编辑区号，当前 +86' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '正在发送…' }) as HTMLButtonElement).disabled).toBe(true);
    expect(mock操作.开始手机登录).toHaveBeenCalledTimes(1);

    begin.resolve();
    await act(async () => { await begin.promise; });
  });

  it('未完成的 begin 在卸载时作废，迟到响应不更新新页面', async () => {
    const begin = deferred<void>();
    mock操作.开始手机登录.mockReturnValue(begin.promise);
    const 用户 = userEvent.setup();
    const 结果 = render(<MemoryRouter><登录 /></MemoryRouter>);
    await 用户.type(screen.getByLabelText('手机号'), '13800000000');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    结果.unmount();
    expect(mock操作.取消手机登录尝试).toHaveBeenCalledTimes(1);

    render(<MemoryRouter><登录 /></MemoryRouter>);
    begin.resolve();
    await act(async () => { await begin.promise; });
    expect(document.querySelectorAll('[class*="验证码格"]')).toHaveLength(0);
  });

  it('complete 飞行期卸载也作废本轮手机登录', async () => {
    const complete = deferred<void>();
    mock操作.开始手机登录.mockResolvedValue(undefined);
    mock操作.完成手机登录.mockReturnValue(complete.promise);
    const 用户 = userEvent.setup();
    const 结果 = render(<MemoryRouter><登录 /></MemoryRouter>);
    await 用户.type(screen.getByLabelText('手机号'), '13800000000');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    await 用户.type(screen.getByLabelText('短信验证码'), '1234');
    await 用户.click(screen.getByText(/已阅读并同意/));
    await 用户.click(screen.getByRole('button', { name: '进入' }));

    结果.unmount();

    expect(mock操作.取消手机登录尝试).toHaveBeenCalledTimes(1);
    complete.resolve();
    await act(async () => { await complete.promise; });
  });

  it('complete 在卸载后迟到失败不污染新页面提示', async () => {
    const complete = deferred<void>();
    mock操作.开始手机登录.mockResolvedValue(undefined);
    mock操作.完成手机登录.mockReturnValue(complete.promise);
    const 用户 = userEvent.setup();
    const 结果 = render(<MemoryRouter><登录 /></MemoryRouter>);
    await 用户.type(screen.getByLabelText('手机号'), '13800000000');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    await 用户.type(screen.getByLabelText('短信验证码'), '1234');
    await 用户.click(screen.getByText(/已阅读并同意/));
    await 用户.click(screen.getByRole('button', { name: '进入' }));
    结果.unmount();

    render(<MemoryRouter><登录 /></MemoryRouter>);
    const 旧错误提示数 = 轻提示文案条数('请求失败，请稍后再试');
    complete.reject(new Error('旧页登录失败'));
    await act(async () => { await expect(complete.promise).rejects.toThrow('旧页登录失败'); });
    expect(轻提示文案条数('请求失败，请稍后再试')).toBe(旧错误提示数);
  });

  it('StrictMode effect cleanup→setup 后仍接纳当前 begin 响应', async () => {
    const begin = deferred<void>();
    mock操作.开始手机登录.mockReturnValue(begin.promise);
    const 用户 = userEvent.setup();
    render(<StrictMode><MemoryRouter><登录 /></MemoryRouter></StrictMode>);
    await 用户.type(screen.getByLabelText('手机号'), '13800000000');
    await 用户.click(screen.getByRole('button', { name: '获取验证码' }));
    begin.resolve();
    await act(async () => { await begin.promise; });
    await waitFor(() => expect(screen.getByText('60s')).toBeDefined());
  });
});
