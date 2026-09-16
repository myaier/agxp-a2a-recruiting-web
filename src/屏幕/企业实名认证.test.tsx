// 企业实名认证 · 身份诚实性组件测试（P1C Task 3 Step 1）。
// Backend：本屏是只读身份摘要 —— 个人 / 任职 / 管理员申请三条分开按服务端事实展示，
// 不再用 1.2 秒计时器伪造「认证通过」；Mock 分支的原型交互原样保留。
// 仓库未装 @testing-library/jest-dom，断言一律用 DOM 属性 / truthy，不用 toHaveValue。

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 企业实名认证 from './企业实名认证';
import {
  BFF企业关系样本,
  BFF企业管理员申请样本,
  BFF招聘方档案样本,
  BFF组织搜索项样本,
  BFF组织搜索页样本,
} from '../测试/BFF样本';
import type { BFF企业管理员申请 } from '../数据/BFF契约';
import { 路径 } from '../路由/路径表';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock读取企业管理员申请 = vi.fn(async () => {});
const mock读取目录企业 = vi.fn(async (编号: string) => ({
  organization_id: 编号,
  display_name: '星河控股',
  legal_name: null,
  verification_status: 'unverified' as const,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }),
}));

/** Backend 桩：只补本屏消费的组织身份字段，其余键与真实 状态 形状无关（本屏不读）。 */
function 置Backend应用状态(
  组织: Record<string, unknown> = {},
  操作覆盖: Record<string, unknown> = {},
  主体: { subject_id: string; last_used_role?: string } | null = { subject_id: 'sub_1', last_used_role: 'recruiter' },
) {
  mock应用状态 = {
    状态: {
      招聘方档案: BFF招聘方档案样本,
      企业关系列表: [],
      当前企业关系编号: null,
      企业管理员申请列表: [],
      ...组织,
    },
    派发: mock派发,
    操作: {
      读取企业管理员申请: mock读取企业管理员申请,
      读取目录企业: mock读取目录企业,
      ...操作覆盖,
    },
    后端状态: { 主体 },
    数据源模式: 'backend',
  };
}

/** Mock 桩：数据源模式 undefined → Mock 分支，读旧 企业认证 fixture（公司可覆盖）。 */
function 置Mock应用状态(公司 = '云衢科技') {
  mock应用状态 = {
    状态: { 企业认证: { 姓名: '邵铭', 公司, 职务: '技术 VP' } },
    派发: mock派发,
  };
}

describe('企业实名认证 · Backend 身份诚实性', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock返回.mockClear();
    mock读取企业管理员申请.mockClear();
    mock读取企业管理员申请.mockResolvedValue(undefined);
    mock读取目录企业.mockClear();
    mock读取目录企业.mockImplementation(async (编号: string) => ({
      organization_id: 编号,
      display_name: '星河控股',
      legal_name: null,
      verification_status: 'unverified' as const,
    }));
    置Backend应用状态();
  });

  it('Backend 未 verified 不用计时器伪造认证通过', () => {
    const 定时 = vi.spyOn(window, 'setTimeout');
    置Backend应用状态({ 招聘方档案: BFF招聘方档案样本, 企业关系列表: [] });
    render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    expect(screen.getByText('个人身份：未认证')).toBeTruthy();
    expect(screen.queryByText(/人脸识别将核对|认证通过/)).toBeNull();
    expect(定时).not.toHaveBeenCalled();
    定时.mockRestore();
  });

  it('personal 状态与 Organization/Affiliation 状态分开显示，不折叠成一个布尔', () => {
    // 个人未认证 + 任职关系已认证：两个事实都按服务端数据各说各的
    置Backend应用状态({
      企业关系列表: [BFF企业关系样本],
      当前企业关系编号: 'aff_1',
    });
    render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    expect(screen.getByText('个人身份：未认证')).toBeTruthy();
    expect(screen.getByText('任职：云衢科技 · 管理员 · 已认证')).toBeTruthy();
  });

  it('未 verified 不出现认证 badge，verified_name 缺省如实展示为未实名', () => {
    render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    // badge 文案是独立的「已认证」元素；摘要行是「个人身份：…」整行，不会被误匹配
    expect(screen.queryByText('已认证')).toBeNull();
    expect(screen.getByText('实名：未实名')).toBeTruthy();
  });

  it('verified 时展示认证状态与实名，Organization admin 身份不升级个人姓名', () => {
    置Backend应用状态({
      招聘方档案: {
        ...BFF招聘方档案样本,
        personal_verification_status: 'verified',
        verified_name: '林澈真名',
      },
    });
    render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    expect(screen.getByText('个人身份：已认证')).toBeTruthy();
    expect(screen.getByText('实名：林澈真名')).toBeTruthy();
  });

  it('管理员申请按服务端事实展示四种状态', () => {
    const 状态表: [BFF企业管理员申请['status'], string][] = [
      ['pending', '管理员申请：待审核'],
      ['approved', '管理员申请：已通过'],
      ['rejected', '管理员申请：已驳回'],
      ['cancelled', '管理员申请：已取消'],
    ];
    for (const [状态, 文案] of 状态表) {
      置Backend应用状态({ 企业管理员申请列表: [{ ...BFF企业管理员申请样本, status: 状态 }] });
      const { unmount } = render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
      expect(screen.getByText(文案)).toBeTruthy();
      unmount();
    }
  });

  it('无申请时显示暂无；读取失败只影响本屏申请行，不弹计时器类提示', async () => {
    const { rerender } = render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    expect(screen.getByText('管理员申请：暂无')).toBeTruthy();

    mock读取企业管理员申请.mockRejectedValue(new Error('网络断开'));
    置Backend应用状态();
    rerender(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    expect(await screen.findByText('管理员申请：读取失败')).toBeTruthy();
    // 失败收敛在本屏申请状态里：没有触发跳转，也没有把 Mock 的认证结论带出来
    expect(mock跳转).not.toHaveBeenCalled();
    expect(screen.queryByText(/认证通过/)).toBeNull();
  });

  it('空选择时申请入口引导先选（打开抽屉不跳转）；邀请入口照旧', async () => {
    const 用户 = userEvent.setup();
    render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    await 用户.click(screen.getByRole('button', { name: /申请企业管理员/ }));
    // 空选择引导先选：不跳转，直接给本页选择抽屉
    expect(mock跳转).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: '选择企业' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '关闭选择企业' }));
    await 用户.click(screen.getByRole('button', { name: /输入邀请口令加入企业/ }));
    expect(mock跳转).toHaveBeenCalledWith(路径.企业邀请加入);
  });

  it('申请入口默认展示档案自报企业并携带 encoded organization_id（合同 C）', async () => {
    const 用户 = userEvent.setup();
    置Backend应用状态({
      招聘方档案: { ...BFF招聘方档案样本, organization_ref: 'org/9&x' },
    });
    render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    expect(mock读取目录企业).toHaveBeenCalledWith('org/9&x');
    expect(await screen.findByText('星河控股')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: /申请企业管理员/ }));
    // 公开 ID 走 encodeURIComponent，不是邀请 token
    expect(mock跳转).toHaveBeenCalledWith('/hr/organization-application?organization_id=org%2F9%26x');
  });
});

// ── Backend 本页待申请企业选择（Spec §4.1）：默认 = 档案坐标，更换是本页本地选择，
//    申请入口携带本页所选 encoded ID，不 PATCH 档案、不改 affiliation；刷新恢复档案默认 ──

/** 抽屉内查询域（弹层框架 dialog，标签「选择企业」） */
function 抽屉() {
  return within(screen.getByRole('dialog', { name: '选择企业' }));
}

/** 打开本页选择抽屉并输入搜索词，推进过 250ms debounce。
 *  受控时钟：原为 300ms 实睡（计时证实的真实等待），改在防抖窗口内局部 fake timers 推进后
 *  立即恢复真实时钟 —— describe 内其余 findBy 等待不受影响。 */
async function 打开抽屉并搜索(用户: ReturnType<typeof userEvent.setup>, 词: string) {
  await 用户.click(screen.getByRole('button', { name: /待申请企业/ }));
  vi.useFakeTimers();
  fireEvent.change(抽屉().getByPlaceholderText('输入公司名称'), { target: { value: 词 } });
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  vi.useRealTimers();
}

describe('企业实名认证 · Backend 本页待申请企业选择', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock读取企业管理员申请.mockClear();
    mock读取企业管理员申请.mockResolvedValue(undefined);
    mock读取目录企业.mockClear();
    mock读取目录企业.mockImplementation(async (编号: string) => ({
      organization_id: 编号,
      display_name: '星河控股',
      legal_name: null,
      verification_status: 'unverified' as const,
    }));
    置Backend应用状态({
      招聘方档案: { ...BFF招聘方档案样本, organization_ref: 'org/9&x' },
    });
  });

  it('本页改选后申请入口携带新 ID；不 PATCH 档案、不改关系', async () => {
    const 用户 = userEvent.setup();
    const 搜索组织 = vi.fn(async () => BFF组织搜索页样本);
    置Backend应用状态({
      招聘方档案: { ...BFF招聘方档案样本, organization_ref: 'org/9&x' },
    }, { 搜索组织 });
    render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    expect(await screen.findByText('星河控股')).toBeTruthy();

    await 打开抽屉并搜索(用户, '云衢');
    fireEvent.click(抽屉().getByRole('button', { name: '云衢科技' }));
    // 本页选择已更新；申请入口携带新 encoded ID
    expect(screen.getByText('云衢科技')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: /申请企业管理员/ }));
    expect(mock跳转).toHaveBeenCalledWith('/hr/organization-application?organization_id=org_1');
    // 不 PATCH 档案、不改 affiliation：本屏不发任何写请求、不派发任何动作
    expect(mock派发).not.toHaveBeenCalled();
    expect(搜索组织).toHaveBeenCalledWith({ q: '云衢', limit: 20 });
  });

  it('取消抽屉保持原选择', async () => {
    const 用户 = userEvent.setup();
    置Backend应用状态({
      招聘方档案: { ...BFF招聘方档案样本, organization_ref: 'org/9&x' },
    }, { 搜索组织: vi.fn(async () => BFF组织搜索页样本) });
    render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    expect(await screen.findByText('星河控股')).toBeTruthy();

    await 打开抽屉并搜索(用户, '云衢');
    fireEvent.click(screen.getByRole('button', { name: '关闭选择企业' }));
    // 取消：本页选择不变，申请入口仍携带档案默认
    expect(screen.getByText('星河控股')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: /申请企业管理员/ }));
    expect(mock跳转).toHaveBeenCalledWith('/hr/organization-application?organization_id=org%2F9%26x');
  });

  it('抽屉内创建企业后选定，入口携带创建回执的 encoded ID', async () => {
    const 用户 = userEvent.setup();
    const 创建组织 = vi.fn(async () => ({ organization: BFF组织搜索项样本, created: true }));
    置Backend应用状态({
      招聘方档案: { ...BFF招聘方档案样本, organization_ref: 'org/9&x' },
    }, { 创建组织 });
    render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    await screen.findByText('星河控股');

    await 用户.click(screen.getByRole('button', { name: /待申请企业/ }));
    await 用户.click(抽屉().getByRole('button', { name: '添加新企业' }));
    await 用户.type(抽屉().getByPlaceholderText('输入公司名称'), '云衢科技');
    await 用户.click(抽屉().getByRole('button', { name: '添加并选择' }));
    expect(await screen.findByText('云衢科技')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: /申请企业管理员/ }));
    expect(mock跳转).toHaveBeenCalledWith('/hr/organization-application?organization_id=org_1');
  });

  it('重新挂载（刷新）恢复档案默认选择', async () => {
    const 用户 = userEvent.setup();
    置Backend应用状态({
      招聘方档案: { ...BFF招聘方档案样本, organization_ref: 'org/9&x' },
    }, { 搜索组织: vi.fn(async () => BFF组织搜索页样本) });
    const 视图 = render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    expect(await screen.findByText('星河控股')).toBeTruthy();

    await 打开抽屉并搜索(用户, '云衢');
    fireEvent.click(抽屉().getByRole('button', { name: '云衢科技' }));
    expect(screen.getByText('云衢科技')).toBeTruthy();

    视图.unmount();
    render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    // 本地选择不持久化：重挂载回到档案默认
    expect(await screen.findByText('星河控股')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: /申请企业管理员/ }));
    expect(mock跳转).toHaveBeenCalledWith('/hr/organization-application?organization_id=org%2F9%26x');
  });

  it('档案无自报企业时入口引导先选；选定后携带所选 ID，任职行照旧独立', async () => {
    const 用户 = userEvent.setup();
    置Backend应用状态({
      招聘方档案: BFF招聘方档案样本,
      企业关系列表: [BFF企业关系样本],
      当前企业关系编号: BFF企业关系样本.affiliation_id,
    }, { 搜索组织: vi.fn(async () => BFF组织搜索页样本) });
    render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    expect(screen.getByText('未选择')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: /申请企业管理员/ }));
    expect(mock跳转).not.toHaveBeenCalled(); // 空选择引导先选
    expect(screen.getByRole('dialog', { name: '选择企业' })).toBeTruthy();

    // 受控时钟：同 打开抽屉并搜索 —— 防抖窗口局部 fake timers 推进后恢复真实时钟
    vi.useFakeTimers();
    fireEvent.change(抽屉().getByPlaceholderText('输入公司名称'), { target: { value: '云衢' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    vi.useRealTimers();
    fireEvent.click(抽屉().getByRole('button', { name: '云衢科技' }));
    expect(screen.getByText('云衢科技')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: /申请企业管理员/ }));
    expect(mock跳转).toHaveBeenCalledWith('/hr/organization-application?organization_id=org_1');
    // 任职（管理 relation）行照旧独立展示，不与待申请企业混排
    expect(screen.getByText('任职：云衢科技 · 管理员 · 已认证')).toBeTruthy();
  });

  // review r2：同挂载切主体 —— A 改选后 已改选 不能永久钉住本页选择；
  // 切到 B 必须复位改选并按 B 的档案坐标恢复（否则 B 的申请目标串成 A 的 organization ID）
  it('同挂载切主体：A 改选的选择复位，恢复 B 的档案坐标与名称，入口只携带 B 的 ID', async () => {
    const 用户 = userEvent.setup();
    置Backend应用状态({
      招聘方档案: { ...BFF招聘方档案样本, organization_ref: 'org/9&x' },
    }, { 搜索组织: vi.fn(async () => BFF组织搜索页样本) });
    const 视图 = render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    expect(await screen.findByText('星河控股')).toBeTruthy();

    await 打开抽屉并搜索(用户, '云衢');
    fireEvent.click(抽屉().getByRole('button', { name: '云衢科技' }));
    expect(screen.getByText('云衢科技')).toBeTruthy();

    // 切到主体 B：档案坐标 org_b2，名称按 ID 区分返回
    mock读取目录企业.mockImplementation(async (编号: string) => ({
      organization_id: 编号,
      display_name: 编号 === 'org_b2' ? '北斗集团' : '星河控股',
      legal_name: null,
      verification_status: 'unverified' as const,
    }));
    置Backend应用状态({
      招聘方档案: { ...BFF招聘方档案样本, organization_ref: 'org_b2' },
    }, { 搜索组织: vi.fn(async () => BFF组织搜索页样本) }, { subject_id: 'sub_b', last_used_role: 'recruiter' });
    视图.rerender(<MemoryRouter><企业实名认证 /></MemoryRouter>);

    expect(await screen.findByText('北斗集团')).toBeTruthy();
    expect(screen.queryByText('云衢科技')).toBeNull();
    await 用户.click(screen.getByRole('button', { name: /申请企业管理员/ }));
    expect(mock跳转).toHaveBeenCalledWith('/hr/organization-application?organization_id=org_b2');
  });

  it('同挂载切主体：两主体档案坐标相同也强制复位改选，恢复档案默认而非 A 的选择', async () => {
    const 用户 = userEvent.setup();
    置Backend应用状态({
      招聘方档案: { ...BFF招聘方档案样本, organization_ref: 'org/9&x' },
    }, { 搜索组织: vi.fn(async () => BFF组织搜索页样本) });
    const 视图 = render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    expect(await screen.findByText('星河控股')).toBeTruthy();

    await 打开抽屉并搜索(用户, '云衢');
    fireEvent.click(抽屉().getByRole('button', { name: '云衢科技' }));
    expect(screen.getByText('云衢科技')).toBeTruthy();

    // B 的 organization_ref 与 A 相同（org/9&x）：仍要复位改选，恢复档案默认
    置Backend应用状态({
      招聘方档案: { ...BFF招聘方档案样本, organization_ref: 'org/9&x' },
    }, { 搜索组织: vi.fn(async () => BFF组织搜索页样本) }, { subject_id: 'sub_b', last_used_role: 'recruiter' });
    视图.rerender(<MemoryRouter><企业实名认证 /></MemoryRouter>);

    expect(await screen.findByText('星河控股')).toBeTruthy();
    expect(screen.queryByText('云衢科技')).toBeNull();
    await 用户.click(screen.getByRole('button', { name: /申请企业管理员/ }));
    expect(mock跳转).toHaveBeenCalledWith('/hr/organization-application?organization_id=org%2F9%26x');
  });

  it('同挂载切主体：两主体档案均无自报企业时恢复未选择，入口引导先选', async () => {
    const 用户 = userEvent.setup();
    置Backend应用状态({
      招聘方档案: { ...BFF招聘方档案样本, organization_ref: null },
    }, { 搜索组织: vi.fn(async () => BFF组织搜索页样本) });
    const 视图 = render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    expect(screen.getByText('未选择')).toBeTruthy();

    await 打开抽屉并搜索(用户, '云衢');
    fireEvent.click(抽屉().getByRole('button', { name: '云衢科技' }));
    expect(screen.getByText('云衢科技')).toBeTruthy();

    // B 的 organization_ref 同为 null：复位后回到 未选择，入口不再携带 A 的选择
    置Backend应用状态({
      招聘方档案: { ...BFF招聘方档案样本, organization_ref: null },
    }, { 搜索组织: vi.fn(async () => BFF组织搜索页样本) }, { subject_id: 'sub_b', last_used_role: 'recruiter' });
    视图.rerender(<MemoryRouter><企业实名认证 /></MemoryRouter>);

    expect(await screen.findByText('未选择')).toBeTruthy();
    expect(screen.queryByText('云衢科技')).toBeNull();
    mock跳转.mockClear();
    await 用户.click(screen.getByRole('button', { name: /申请企业管理员/ }));
    expect(mock跳转).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: '选择企业' })).toBeTruthy();
  });
});

describe('企业实名认证 · Mock 原型保持不变', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock返回.mockClear();
    置Mock应用状态();
  });

  // 受控时钟：Mock 分支 1.2 秒认证计时器是计时证实的真实等待（原 findByText 实等 3 秒窗口），
  // 改在计时窗口内局部 fake timers 推进后立即恢复真实时钟；原不变量保持：计时器未到不提前
  // 落全局（断言保留在 认证中 态），到点才 认证通过 并进招聘名片。抽屉候选的 250ms 防抖
  // 走真实时钟（userEvent 在 fake 时钟下不可用），由 findByRole 自然等出。
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Mock 公司输入换成同一选择抽屉，1.2 秒后仍落全局并进招聘名片', async () => {
    const 用户 = userEvent.setup();
    render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    // 原布局：姓名输入 + 公司选择行 + 人脸占位说明；自由文本公司输入已撤
    const 姓名框 = screen.getByPlaceholderText('与证件一致，向候选人实名示人');
    expect(screen.getByText('人脸识别将核对上面两项')).toBeTruthy();
    expect(screen.queryByPlaceholderText('如：上海云衢信息科技有限公司')).toBeNull();
    fireEvent.change(姓名框, { target: { value: '邵铭' } });
    // 公司行默认显示 fixture 里的公司；打开抽屉改选 澜舟数据（250ms 防抖后出候选行）
    await 用户.click(screen.getByRole('button', { name: '云衢科技' }));
    await 用户.type(screen.getAllByPlaceholderText('输入公司名称')[0], '澜舟');
    await 用户.click(await screen.findByRole('button', { name: /澜舟数据/ }));
    expect(screen.getByRole('button', { name: '澜舟数据' })).toBeTruthy();
    // 受控时钟：1.2 秒认证计时器是本用例的实等主体 —— fake 时钟要在触发点击前启用，
    // 才能推进该计时器（原 findByText 实等 3 秒窗口）
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: '开始人脸识别' }));
    expect(mock派发).not.toHaveBeenCalled(); // 计时器未到，不提前落全局
    expect(screen.getByRole('button', { name: '认证中…' })).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    vi.useRealTimers();
    expect(screen.getByText('认证通过')).toBeTruthy();
    expect(mock派发).toHaveBeenCalledWith({
      型: '存企业认证',
      姓名: '邵铭',
      公司: '澜舟数据',
    });
    expect(mock跳转).toHaveBeenCalledWith(路径.招聘名片);
  });

  it('Mock 未选公司时人脸识别拦下：请填写营业执照上的公司全称', () => {
    置Mock应用状态('');
    render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText('与证件一致，向候选人实名示人'), { target: { value: '邵铭' } });
    fireEvent.click(screen.getByRole('button', { name: '开始人脸识别' }));
    expect(screen.getByText('请填写营业执照上的公司全称')).toBeTruthy();
    expect(mock派发).not.toHaveBeenCalled();
  });
});
