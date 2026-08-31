// 举报层 · P8 Task 7 双模式行为线测试。
//
// Mock（不传 target）：本地路径字节不变 —— 派发 {型:'拉黑'} / 固定 toast / 关层，
// 零 P8 操作（三个 Mock 调用点 职位详情 / 直聊会话 / 真人会话 都不传 target）。
// Backend（必传 target）：不可变目标 + 线协议原因 + 屏蔽布尔进 操作.提交P8举报（键归
// 操作层）；提交期间锁原因/屏蔽行/提交键；只有确认回执才关层；block_unavailable 与
// 结果未知保持层开且选择保留（取消勾选屏蔽后重试是新的提交）；report_target_not_found
// 统一关层并回调 目标失效；绝不本地派发 拉黑；绝不新增正文 textarea。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 举报层 from './举报层';
import 样式 from './举报层.module.css';
// 仓库既有的 ?raw 源码合同模式（无新增 textarea / 无新增样式 props）
import 举报层源码 from './举报层.tsx?raw';
import { BFF错误 } from '../数据/HTTP客户端';
import type { P8ReportReceipt } from '../数据/招聘数据源/P8控制面';

const mock轻提示 = vi.hoisted(() => vi.fn());
vi.mock('./轻提示', () => ({ 轻提示: mock轻提示 }));

const mock派发 = vi.fn();
const mock提交P8举报 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

const 回执: P8ReportReceipt = { ticketId: 'TICKET-P8-RPT-001', status: 'received', blockStatus: 'not_requested' };
const 屏蔽回执: P8ReportReceipt = { ticketId: 'TICKET-P8-RPT-002', status: 'received', blockStatus: 'applied' };

/** 挂 Mock 宿主（无 target、无操作表 —— Mock 路径零 P8 触达）。 */
function 挂Mock() {
  mock应用状态 = { 数据源模式: 'mock', 派发: mock派发 };
  return render(<举报层 对象名="林筱 · 铨衡人才" 屏蔽名称="铨衡人才" 关闭={mock关闭} />);
}

const mock关闭 = vi.fn();
const mock已确认 = vi.fn();
const mock目标失效 = vi.fn();

/** 挂 Backend 宿主：必传不可变 target 与确认/失效回调。 */
function 挂Backend(覆盖: { 提交?: typeof mock提交P8举报 } = {}) {
  mock应用状态 = {
    数据源模式: 'backend',
    派发: mock派发,
    操作: { 提交P8举报: 覆盖.提交 ?? mock提交P8举报 },
  };
  return render(
    <举报层
      对象名="林筱 · 铨衡人才"
      屏蔽名称="铨衡人才"
      关闭={mock关闭}
      target={{ type: 'job', ref: 'job_001' }}
      已确认={mock已确认}
      目标失效={mock目标失效}
    />,
  );
}

/** 选原因（默认 虚假信息）→ 勾/不勾同时屏蔽 → 点提交举报。 */
async function 选并提交(
  用户: ReturnType<typeof userEvent.setup>,
  选项: { 原因?: string; 屏蔽?: boolean } = {},
) {
  await 用户.click(screen.getByRole('button', { name: 选项.原因 ?? '虚假信息' }));
  if (选项.屏蔽) await 用户.click(screen.getByRole('button', { name: /同时屏蔽铨衡人才/ }));
  await 用户.click(screen.getByRole('button', { name: '提交举报' }));
}

beforeEach(() => {
  mock轻提示.mockClear();
  mock派发.mockClear();
  mock提交P8举报.mockReset().mockResolvedValue(回执);
  mock关闭.mockClear();
  mock已确认.mockClear();
  mock目标失效.mockClear();
});

describe('举报层 · Mock 本地路径（不传 target）', () => {
  it('未选原因：固定提示，层不关、零派发', async () => {
    const 用户 = userEvent.setup();
    挂Mock();
    await 用户.click(screen.getByRole('button', { name: '提交举报' }));
    expect(mock轻提示).toHaveBeenCalledWith('先选一个举报原因');
    expect(mock关闭).not.toHaveBeenCalled();
    expect(mock派发).not.toHaveBeenCalled();
  });

  it('仅举报：零拉黑派发，toast 固定文案，关层', async () => {
    const 用户 = userEvent.setup();
    const 视图 = 挂Mock();
    await 选并提交(用户);
    expect(mock派发).not.toHaveBeenCalled();
    expect(mock轻提示).toHaveBeenCalledWith('举报已受理，我们会尽快核查');
    expect(mock关闭).toHaveBeenCalledTimes(1);
    视图.unmount();
  });

  it('同时屏蔽：本地派发 拉黑（Mock 原型行为原样），toast 带屏蔽名', async () => {
    const 用户 = userEvent.setup();
    const 视图 = 挂Mock();
    await 选并提交(用户, { 屏蔽: true });
    expect(mock派发).toHaveBeenCalledWith({ 型: '拉黑', 名称: '铨衡人才' });
    expect(mock轻提示).toHaveBeenCalledWith('举报已受理 · 已屏蔽铨衡人才');
    expect(mock关闭).toHaveBeenCalledTimes(1);
    视图.unmount();
  });
});

describe('举报层 · Backend 真实举报（必传 target）', () => {
  it('提交带不可变目标 + 线协议原因 + 屏蔽布尔，绝不本地派发拉黑', async () => {
    const 用户 = userEvent.setup();
    const 视图 = 挂Backend();
    await 选并提交(用户, { 屏蔽: true });
    expect(mock提交P8举报).toHaveBeenCalledWith(
      { type: 'job', ref: 'job_001' }, 'false_information', true,
    );
    expect(mock派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '拉黑' }));
    视图.unmount();
  });

  it('四个中文原因的 UI→线协议映射冻结：薪资不实/骚扰/其他', async () => {
    const 用户 = userEvent.setup();
    const 映射: Array<[string, string]> = [
      ['虚假信息', 'false_information'],
      ['薪资不实', 'salary_misrepresentation'],
      ['骚扰', 'harassment'],
      ['其他', 'other'],
    ];
    for (const [屏原因, 线原因] of 映射) {
      const 视图 = 挂Backend();
      await 选并提交(用户, { 原因: 屏原因 });
      expect(mock提交P8举报).toHaveBeenLastCalledWith({ type: 'job', ref: 'job_001' }, 线原因, false);
      视图.unmount();
    }
  });

  it('提交期间锁原因/屏蔽行/提交键；确认回执到达才关层并回调 已确认', async () => {
    let 放行!: (回执: P8ReportReceipt) => void;
    const 提交 = vi.fn((): Promise<P8ReportReceipt> => new Promise((完成) => { 放行 = 完成; }));
    const 用户 = userEvent.setup();
    const 视图 = 挂Backend({ 提交 });
    await 选并提交(用户, { 屏蔽: true });
    expect((screen.getByRole('button', { name: '提交举报' }) as HTMLButtonElement).disabled).toBe(true);
    // 选中项的可访问名会带上 ✓（如「虚假信息✓」），按包含匹配
    for (const 原因 of ['虚假信息', '薪资不实', '骚扰', '其他']) {
      expect((screen.getByRole('button', { name: new RegExp(原因) }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect((screen.getByRole('button', { name: /同时屏蔽铨衡人才/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(mock已确认).not.toHaveBeenCalled();
    expect(mock关闭).not.toHaveBeenCalled();
    放行(屏蔽回执);
    await vi.waitFor(() => expect(mock已确认).toHaveBeenCalledWith(屏蔽回执));
    expect(mock轻提示).toHaveBeenCalledWith('举报已受理 · 已屏蔽铨衡人才');
    expect(mock关闭).toHaveBeenCalledTimes(1);
    视图.unmount();
  });

  it('block_unavailable：无半成功，层保持开、选择保留；取消勾选后重试是不带屏蔽的新提交', async () => {
    const 提交 = vi.fn()
      .mockRejectedValueOnce(new BFF错误(409, 'block_unavailable', 'cannot block'))
      .mockResolvedValueOnce(回执);
    const 用户 = userEvent.setup();
    const 视图 = 挂Backend({ 提交 });
    await 选并提交(用户, { 屏蔽: true });
    expect(mock轻提示).toHaveBeenCalledWith('暂时无法同时屏蔽，可取消勾选后仅提交举报');
    expect(mock关闭).not.toHaveBeenCalled();
    expect(mock已确认).not.toHaveBeenCalled();
    // 原因选择保留在层里（同层直接重试，不要求重选）
    expect(screen.getByRole('button', { name: /虚假信息/ }).className).toContain(样式.原因项选中);
    // 用户取消勾选「同时屏蔽」再提交：新的提交（alsoBlock=false）
    await 用户.click(screen.getByRole('button', { name: /同时屏蔽铨衡人才/ }));
    await 用户.click(screen.getByRole('button', { name: '提交举报' }));
    expect(提交).toHaveBeenLastCalledWith({ type: 'job', ref: 'job_001' }, 'false_information', false);
    expect(mock关闭).toHaveBeenCalledTimes(1);
    视图.unmount();
  });

  it('结果未知：层保持开、选择保留、固定中文文案，可同层重试', async () => {
    const 提交 = vi.fn()
      .mockRejectedValueOnce(new BFF错误(503, 'operation_outcome_unknown', 'unknown'))
      .mockResolvedValueOnce(回执);
    const 用户 = userEvent.setup();
    const 视图 = 挂Backend({ 提交 });
    await 选并提交(用户);
    expect(mock轻提示).toHaveBeenCalledWith('暂时无法确认操作是否成功，请稍后重试');
    expect(mock关闭).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /虚假信息/ }).className).toContain(样式.原因项选中);
    await 用户.click(screen.getByRole('button', { name: '提交举报' }));
    expect(提交).toHaveBeenCalledTimes(2);
    expect(mock关闭).toHaveBeenCalledTimes(1);
    视图.unmount();
  });

  it('report_target_not_found：统一关层并回调 目标失效（屏层自行刷新来源）', async () => {
    const 提交 = vi.fn().mockRejectedValue(new BFF错误(404, 'report_target_not_found', 'gone'));
    const 用户 = userEvent.setup();
    const 视图 = 挂Backend({ 提交 });
    await 选并提交(用户);
    expect(mock轻提示).toHaveBeenCalledWith('举报对象已不存在，请刷新后重试');
    expect(mock目标失效).toHaveBeenCalledTimes(1);
    expect(mock关闭).toHaveBeenCalledTimes(1);
    视图.unmount();
  });

  it('未选原因同样零操作调用；绝不透传原始 error.message', async () => {
    const 提交 = vi.fn().mockRejectedValue(new BFF错误(500, 'weird_code', 'English backend message'));
    const 用户 = userEvent.setup();
    const 视图 = 挂Backend({ 提交 });
    await 用户.click(screen.getByRole('button', { name: '提交举报' }));
    expect(mock轻提示).toHaveBeenCalledWith('先选一个举报原因');
    expect(提交).not.toHaveBeenCalled();
    // 未知码兜底固定文案：英文 message 绝不上屏
    await 选并提交(用户);
    expect(mock轻提示).toHaveBeenLastCalledWith('请求失败，请稍后重试');
    视图.unmount();
  });

  it('Backend 缺 target 是接线缺陷：fail closed —— 零提交、零本地拉黑、不伪造成功', async () => {
    mock应用状态 = { 数据源模式: 'backend', 派发: mock派发, 操作: { 提交P8举报: mock提交P8举报 } };
    const 用户 = userEvent.setup();
    const 视图 = render(
      <举报层 对象名="林筱 · 铨衡人才" 屏蔽名称="铨衡人才" 关闭={mock关闭} />,
    );
    await 选并提交(用户);
    expect(mock提交P8举报).not.toHaveBeenCalled();
    expect(mock派发).not.toHaveBeenCalled();
    expect(mock轻提示).not.toHaveBeenCalled();
    expect(mock关闭).not.toHaveBeenCalled();
    视图.unmount();
  });

  it('源码合同：不新增正文 textarea（本层没有获批的自由文本框）', () => {
    expect(举报层源码).not.toMatch(/textarea/i);
  });
});
