// 添加头像（注册流最后一屏）的收尾清理接线（Task 7 / 设计 §9）：
// 点「完成注册」先作废候选 onboarding 预填轮（内存建议 + 恢复元数据随 清候选Onboarding预填
// 一起清），再走既有「初始化页 → 主壳」导航 —— 完成注册后旧建议绝不再残留。
// 按钮文案 / 位置 / 样式不动（本文件只钉收尾编排）；Mock 模式零预填操作（预填域 Backend-only）。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BFF错误 } from '../数据/HTTP客户端';
import 添加头像 from './添加头像';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock进初始化 = vi.fn();
const mock操作 = {
  清候选Onboarding预填: vi.fn(),
  保存候选头像: vi.fn(async () => undefined),
  更新候选建档草稿: vi.fn(),
  完成候选Onboarding: vi.fn(async () => undefined),
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 跳转: mock跳转, 返回: mock返回, 进初始化: mock进初始化 }),
}));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

function render添加头像(
  数据源: 'backend' | 'mock' = 'backend',
  建档?: Record<string, unknown>,
) {
  const 派发 = vi.fn();
  mock应用状态 = {
    数据源模式: 数据源,
    是后端: 数据源 === 'backend',
    状态: {
      求职头像: null,
      // 注册旅程标记：引导预填 非 null 才接建档草稿（与 引导问答 同款纪律）；
      // Mock 模式也保留该标记，钉住 是后端 门（不是靠预填缺席蒙混）
      ...(建档 !== undefined ? { 引导预填: { 建档 } } : {}),
    },
    派发,
    后端状态: {},
    操作: mock操作,
  };
  render(
    <MemoryRouter>
      <添加头像 />
    </MemoryRouter>,
  );
  return { 派发 };
}

describe('添加头像：完成注册收尾清理（Task 7）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock进初始化.mockClear();
    mock操作.清候选Onboarding预填.mockClear();
    mock操作.保存候选头像.mockClear();
    mock操作.更新候选建档草稿.mockClear();
    mock操作.完成候选Onboarding.mockClear().mockResolvedValue(undefined);
  });

  it('cleanup before “完成注册” navigation：先清候选预填轮再进初始化页', async () => {
    const { 派发 } = render添加头像('backend');
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '完成注册' }));
    expect(mock操作.清候选Onboarding预填).toHaveBeenCalledTimes(1);
    expect(mock操作.清候选Onboarding预填.mock.invocationCallOrder[0]!)
      .toBeLessThan(mock进初始化.mock.invocationCallOrder[0]!);
    // 既有收尾编排保持：切 Tab / 子视图 的派发与初始化导航都还在
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '切Tab', Tab: '职位' }));
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '切子视图', 子视图: '在谈' }));
    expect(mock进初始化).toHaveBeenCalledTimes(1);
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('no old suggestion after completion：清理恰一次，旧建议与恢复元数据不残留到主壳', async () => {
    render添加头像('backend');
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '完成注册' }));
    expect(mock操作.清候选Onboarding预填).toHaveBeenCalledTimes(1);
    // 完成注册是唯一的收尾出口：再次点击也不产生第二份清理之外的路径
    await 用户.click(screen.getByRole('button', { name: '完成注册' }));
    expect(mock进初始化).toHaveBeenCalledTimes(2);
    expect(mock操作.清候选Onboarding预填).toHaveBeenCalledTimes(2);
  });

  it('按钮文案不变：主按钮仍叫「完成注册」', () => {
    render添加头像('backend');
    expect(screen.getByRole('button', { name: '完成注册' })).toBeTruthy();
  });

  it('Mock 模式零预填操作：完成注册只走既有导航', async () => {
    const { 派发 } = render添加头像('mock');
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '完成注册' }));
    expect(mock操作.清候选Onboarding预填).not.toHaveBeenCalled();
    expect(派发).toHaveBeenCalledTimes(2);
    expect(mock进初始化).toHaveBeenCalledTimes(1);
  });

  it('Backend 选择 PNG 走真实上传，上传完成前禁用完成注册', async () => {
    render添加头像('backend');
    const 用户 = userEvent.setup();
    const 文件 = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    await 用户.upload(document.querySelector('input[type="file"]') as HTMLInputElement, 文件);
    expect(mock操作.保存候选头像).toHaveBeenCalledWith(文件);
  });
});

// ── J-PILOT-02 Task 8：头像可选、提交中锁住完成、未知结果的明确放弃出口 ──
// 头像是可选项（设计 §6）：未选始终能完成；未知结果不伪成功 —— 用户要么重选同一张
// 图片按原命令重试，要么点「完成注册」明确放弃本次未确认上传（不添加新按钮/新弹层）。
describe('添加头像：头像可选与未知结果（J-PILOT-02 Task 8）', () => {
  /** 轻提示是 document.body 上的单例容器：上一条用例的提示未到期会串场，逐条清空。 */
  function 清空轻提示(): void {
    const 容器 = Array.from(document.body.children).find(
      (节点) => (节点 as HTMLElement).style?.zIndex === '999',
    ) as HTMLElement | undefined;
    if (容器) 容器.innerHTML = '';
  }

  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock进初始化.mockClear();
    mock操作.清候选Onboarding预填.mockClear();
    mock操作.保存候选头像.mockClear();
    mock操作.更新候选建档草稿.mockClear();
    mock操作.完成候选Onboarding.mockClear().mockResolvedValue(undefined);
    清空轻提示();
  });

  it('未选可完成：建档在场但没有头像写入，完成注册照常进初始化、零头像草稿写', async () => {
    render添加头像('backend', { 资料: { 个人优势: '一半' }, 头像状态: '未选' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '完成注册' }));
    expect(mock操作.更新候选建档草稿).not.toHaveBeenCalled(); // 未选不动头像草稿
    expect(mock进初始化).toHaveBeenCalledTimes(1);
  });

  it('提交中锁住完成：上传在途时完成注册按钮禁用', async () => {
    let 放行!: () => void;
    mock操作.保存候选头像.mockImplementationOnce(
      () => new Promise<undefined>((ok) => { 放行 = () => ok(undefined); }),
    );
    render添加头像('backend', { 资料: {} });
    const 用户 = userEvent.setup();
    const 文件 = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    await 用户.upload(document.querySelector('input[type="file"]') as HTMLInputElement, 文件);
    expect((screen.getByRole('button', { name: '完成注册' }) as HTMLButtonElement).disabled).toBe(true);
    expect(mock进初始化).not.toHaveBeenCalled();
    放行();
    await 用户.click(screen.getByRole('button', { name: '完成注册' }));
    expect(mock进初始化).toHaveBeenCalledTimes(1);
  });

  it('未知结果的头像槽：完成注册是明确放弃出口——释放 avatar 槽、记 已放弃，仍进初始化', async () => {
    render添加头像('backend', {
      资料: { 个人优势: '一半' },
      头像状态: '待核对',
      待写入: {
        种类: 'avatar', 幂等键: 'idem-avatar-unknown-1', ifMatch: 5, 阶段: 'prepared',
        文件核对: { name: 'avatar.png', type: 'image/png', size: 12, lastModified: 123, sha256: 'f'.repeat(64) },
      },
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '完成注册' }));
    // 只释放 avatar 槽并记明确放弃事实（其余草稿字段原样）；不声称上传失败、不发请求
    expect(mock操作.更新候选建档草稿).toHaveBeenCalledWith({
      资料: { 个人优势: '一半' },
      头像状态: '已放弃',
    });
    expect(mock进初始化).toHaveBeenCalledTimes(1); // 无死锁：明确跳过仍可完成
  });

  it('非头像槽不被完成注册释放：其他域的未结算命令留给完成核对（Task 9）', async () => {
    render添加头像('backend', {
      待写入: { 种类: 'education-create', 阶段: 'prepared' },
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '完成注册' }));
    expect(mock操作.更新候选建档草稿).not.toHaveBeenCalled(); // 不越权释放别的域
    expect(mock进初始化).toHaveBeenCalledTimes(1); // 完成门槛由 Task 9 接，本屏不静默拦
  });

  it('头像待核对时用现有轻提示说明恢复操作：重选同一张图片重试，或点完成注册放弃', async () => {
    render添加头像('backend', {
      头像状态: '待核对',
      待写入: { 种类: 'avatar', 阶段: 'prepared' },
    });
    // 刷新回到本屏（槽还在、不在提交中）也能看到恢复说明 —— 现有轻提示是唯一错误出口
    expect(await screen.findByText(/头像上传结果未确认/)).toBeTruthy();
    expect(screen.getByText(/重新选择同一张图片/)).toBeTruthy();
  });

  it('Mock 模式零头像草稿操作：预填在场也不接建档（是后端 门）', async () => {
    render添加头像('mock', { 待写入: { 种类: 'avatar', 阶段: 'prepared' } });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '完成注册' }));
    expect(mock操作.更新候选建档草稿).not.toHaveBeenCalled();
    expect(mock进初始化).toHaveBeenCalledTimes(1);
  });
});

// ── J-PILOT-02 Task 9：完成注册先核对本人真实资源（Spec §6）──
// 「完成注册」先 await 完成候选Onboarding 的资源核对：失败留在本页、经既有轻提示
// 指出缺项、不进初始化也不清预填；成功才沿原 收尾编排（清预填 → 进初始化）。
// 头像的明确放弃（释放 avatar 槽 + 记 已放弃）发生在核对读草稿之前 —— 放弃事实
// 由核对消费，不能被清理顺序吞掉。
describe('添加头像：完成注册先核对真实资源（J-PILOT-02 Task 9）', () => {
  function 清空轻提示(): void {
    const 容器 = Array.from(document.body.children).find(
      (节点) => (节点 as HTMLElement).style?.zIndex === '999',
    ) as HTMLElement | undefined;
    if (容器) 容器.innerHTML = '';
  }

  function 轻提示含(文案: string): boolean {
    const 容器 = Array.from(document.body.children).find(
      (节点) => (节点 as HTMLElement).style?.zIndex === '999',
    ) as HTMLElement | undefined;
    return Array.from(容器?.children ?? []).some((条) => 条.textContent === 文案);
  }

  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock进初始化.mockClear();
    mock操作.清候选Onboarding预填.mockClear();
    mock操作.保存候选头像.mockClear();
    mock操作.更新候选建档草稿.mockClear();
    mock操作.完成候选Onboarding.mockClear().mockResolvedValue(undefined);
    清空轻提示();
  });

  it('核对失败（教育不完整等缺项）不进初始化：留在本页、轻提示指出缺项、不清预填', async () => {
    mock操作.完成候选Onboarding.mockRejectedValueOnce(
      new BFF错误(0, 'invalid_request', '至少需要一条完整的教育经历（含毕业时间）'),
    );
    render添加头像('backend', { 资料: {}, 头像状态: '未选' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '完成注册' }));
    expect(mock操作.完成候选Onboarding).toHaveBeenCalledTimes(1);
    expect(mock进初始化).not.toHaveBeenCalled();
    expect(mock操作.清候选Onboarding预填).not.toHaveBeenCalled(); // 失败不清预填
    expect(轻提示含('至少需要一条完整的教育经历（含毕业时间）')).toBe(true);
  });

  it('核对成功才走原收尾编排：先核对、再清候选预填轮、最后进初始化', async () => {
    render添加头像('backend', { 资料: {}, 头像状态: '未选' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '完成注册' }));
    expect(mock操作.完成候选Onboarding).toHaveBeenCalledTimes(1);
    expect(mock操作.清候选Onboarding预填).toHaveBeenCalledTimes(1);
    expect(mock操作.完成候选Onboarding.mock.invocationCallOrder[0]!)
      .toBeLessThan(mock操作.清候选Onboarding预填.mock.invocationCallOrder[0]!);
    expect(mock操作.清候选Onboarding预填.mock.invocationCallOrder[0]!)
      .toBeLessThan(mock进初始化.mock.invocationCallOrder[0]!);
  });

  it('重复完成只一次导航：核对在途时完成注册按钮禁用，第二次点击不触发', async () => {
    let 放行!: () => void;
    mock操作.完成候选Onboarding.mockImplementationOnce(
      () => new Promise<undefined>((ok) => { 放行 = () => ok(undefined); }),
    );
    render添加头像('backend', { 资料: {}, 头像状态: '未选' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '完成注册' }));
    expect((screen.getByRole('button', { name: '完成注册' }) as HTMLButtonElement).disabled).toBe(true);
    await 用户.click(screen.getByRole('button', { name: '完成注册' })); // 禁用：不触发
    放行();
    await waitFor(() => expect(mock进初始化).toHaveBeenCalledTimes(1));
    expect(mock操作.完成候选Onboarding).toHaveBeenCalledTimes(1);
  });

  it('头像放弃事实先于核对读草稿：释放 avatar 槽记 已放弃 发生在完成核对之前', async () => {
    render添加头像('backend', {
      资料: { 个人优势: '一半' },
      头像状态: '待核对',
      待写入: {
        种类: 'avatar', 幂等键: 'idem-avatar-unknown-9', ifMatch: 5, 阶段: 'prepared',
        文件核对: { name: 'avatar.png', type: 'image/png', size: 12, lastModified: 123, sha256: 'f'.repeat(64) },
      },
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '完成注册' }));
    expect(mock操作.更新候选建档草稿).toHaveBeenCalledWith({
      资料: { 个人优势: '一半' },
      头像状态: '已放弃',
    });
    expect(mock操作.更新候选建档草稿.mock.invocationCallOrder[0]!)
      .toBeLessThan(mock操作.完成候选Onboarding.mock.invocationCallOrder[0]!);
  });
});
