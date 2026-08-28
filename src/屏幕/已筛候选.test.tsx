// P4 Task 7：已筛掉的候选接上发现推荐（Backend）。
// 在招岗位全部请求、归档岗位排除；服务端把全部腿原子提交后才展示（任一腿失败不落半份）；
// 淘汰原因文案闭合四员；撤销等服务端成功、失败行保留、页面文案绝不承诺回到当前批次；
// Mock 分支继续读 状态.不合适候选 与既有归约，零 P4 请求。
// 测试宿主：mock 应用状态 / 导航钩子（同 看市场.test.tsx 惯例）。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 已筛候选 from './已筛候选';
import { BFF错误 } from '../数据/HTTP客户端';
import type { BFF淘汰原因, BFF招聘候选推荐 } from '../数据/BFF契约';
import { BFF招聘候选推荐样本 } from '../测试/BFF样本';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());
const mock设置发现推荐范围 = vi.fn();
const mock加载招聘已筛 = vi.fn(async () => undefined);
const mock撤销淘汰候选 = vi.fn(async () => undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  use应用状态: () => mock应用状态,
}));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: vi.fn(), 返回名: '', 跳转: mock跳转 }) }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

/** 换码/换岗的已筛卡 */
function 淘汰卡(选项: { 推荐ID: string; 别名: string; 原因: BFF淘汰原因; 岗位?: string }): BFF招聘候选推荐 {
  return {
    ...BFF招聘候选推荐样本,
    recommendation_id: 选项.推荐ID,
    candidate_alias: 选项.别名,
    job_id: 选项.岗位 ?? 'job_1',
    rejected: true,
    rejection_reason: 选项.原因,
  };
}

/** P4 已筛状态底座：岗位列表与聚合/快照按用例给 */
function 置已筛状态(选项: {
  岗位们: { 编号: string; 状态: '在招' | '已归档' }[];
  聚合?: { 阶段: string; jobKey: string; error: string | null };
  快照?: { 阶段: string; items: BFF招聘候选推荐[]; error: string | null };
  操作?: Record<string, unknown>;
}) {
  mock应用状态 = {
    数据源模式: 'backend', 派发: mock派发,
    状态: {
      当前岗位编号: 选项.岗位们[0]?.编号 ?? '',
      岗位列表: 选项.岗位们.map((岗) => ({
        ...{ 编号: 岗.编号, 名称: `岗位 ${岗.编号}`, 状态: 岗.状态 },
      })),
      企业规则: [], 推荐列表: [], 收藏候选: [], 不合适候选: {}, 已接触推荐: [],
    },
    后端状态: {
      Agent规则水合: { candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '成功', proposals: '成功' } },
      招聘可用候选: {},
      招聘已筛候选: 选项.快照 && 选项.聚合
        ? { [选项.聚合.jobKey]: { ...选项.快照, 刷新中: false, generation: 1 } }
        : {},
      招聘已筛聚合: 选项.聚合 ?? { 阶段: '未开始', jobKey: '', error: null },
      P4委托回执: {},
    },
    操作: 选项.操作 ?? {},
  };
}

/** Mock 模式底座：与接线前一致的原型字段 */
function 置Mock状态() {
  mock应用状态 = {
    数据源模式: 'mock', 派发: mock派发,
    状态: {
      当前岗位编号: 'P-01', 岗位列表: [],
      企业规则: [], 推荐列表: [], 收藏候选: [], 已接触推荐: [],
      不合适候选: { 'R-11': '年限不足' },
    },
    后端状态: {},
  };
}

function 渲染已筛() {
  return render(
    <MemoryRouter>
      <已筛候选 />
    </MemoryRouter>,
  );
}

describe('已筛候选 · P4 跨岗位淘汰史（Backend）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock轻提示.mockClear();
    mock设置发现推荐范围.mockClear();
    mock加载招聘已筛.mockClear();
    mock撤销淘汰候选.mockClear();
  });

  it('全部在招岗位都请求，归档岗位排除；先注册后加载，离开即清', () => {
    置已筛状态({
      岗位们: [{ 编号: 'job_2', 状态: '在招' }, { 编号: 'job_1', 状态: '在招' }, { 编号: 'job_3', 状态: '已归档' }],
      操作: { 设置发现推荐范围: mock设置发现推荐范围, 加载招聘已筛: mock加载招聘已筛 },
    });
    const 页 = 渲染已筛();
    expect(mock设置发现推荐范围).toHaveBeenCalledWith('recruiter', 'recruiter:rejected:job_1,job_2');
    expect(mock加载招聘已筛).toHaveBeenCalledWith(['job_2', 'job_1']);
    expect(mock设置发现推荐范围.mock.invocationCallOrder[0]).toBeLessThan(
      mock加载招聘已筛.mock.invocationCallOrder[0]);
    页.unmount();
    expect(mock设置发现推荐范围).toHaveBeenCalledWith('recruiter', null);
  });

  it('任一腿失败整体不提交：无半份聚合，给错误与重试', async () => {
    const user = userEvent.setup();
    置已筛状态({
      岗位们: [{ 编号: 'job_1', 状态: '在招' }],
      聚合: { 阶段: '失败', jobKey: 'recruiter:rejected:job_1', error: '服务暂时不可用，请稍后再试' },
      快照: { 阶段: '失败', items: [], error: '服务暂时不可用，请稍后再试' },
      操作: { 加载招聘已筛: mock加载招聘已筛 },
    });
    渲染已筛();
    expect(screen.getByText('筛掉的候选暂时加载不了')).toBeTruthy();
    expect(screen.getByText('服务暂时不可用，请稍后再试')).toBeTruthy();
    expect(screen.queryByText('候选人甲')).toBeNull();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock加载招聘已筛).toHaveBeenLastCalledWith(['job_1'], true);
  });

  it('原因文案闭合四员：只出中文枚举词，不出 wire 码', () => {
    置已筛状态({
      岗位们: [{ 编号: 'job_1', 状态: '在招' }],
      聚合: { 阶段: '成功', jobKey: 'recruiter:rejected:job_1', error: null },
      快照: {
        阶段: '成功', error: null,
        items: [
          淘汰卡({ 推荐ID: 'rec_1', 别名: '候选人甲', 原因: 'experience_insufficient' }),
          淘汰卡({ 推荐ID: 'rec_2', 别名: '候选人乙', 原因: 'direction_mismatch' }),
          淘汰卡({ 推荐ID: 'rec_3', 别名: '候选人丙', 原因: 'primary_stack_mismatch' }),
          淘汰卡({ 推荐ID: 'rec_4', 别名: '候选人丁', 原因: 'other' }),
        ],
      },
    });
    渲染已筛();
    expect(screen.getByText('年限不足')).toBeTruthy();
    expect(screen.getByText('方向不符')).toBeTruthy();
    expect(screen.getByText('主栈不符')).toBeTruthy();
    expect(screen.getByText('其他')).toBeTruthy();
    expect(screen.queryByText('experience_insufficient')).toBeNull();
    expect(screen.queryByText('direction_mismatch')).toBeNull();
  });

  it('撤销等服务端成功：成功前按钮禁用，成功后行消失且文案中性', async () => {
    const user = userEvent.setup();
    let 解除!: () => void;
    mock撤销淘汰候选.mockImplementation(
      () => new Promise<undefined>((解决) => { 解除 = () => 解决(undefined); }));
    置已筛状态({
      岗位们: [{ 编号: 'job_1', 状态: '在招' }],
      聚合: { 阶段: '成功', jobKey: 'recruiter:rejected:job_1', error: null },
      快照: {
        阶段: '成功', error: null,
        items: [淘汰卡({ 推荐ID: 'rec_1', 别名: '候选人甲', 原因: 'direction_mismatch' })],
      },
      操作: { 撤销淘汰候选: mock撤销淘汰候选 },
    });
    const 页 = 渲染已筛();
    await user.click(screen.getByRole('button', { name: '撤销' }));
    expect(mock撤销淘汰候选).toHaveBeenCalledWith('job_1', 'rec_1');
    // 服务端未回执前按钮保持禁用：撤销不等本地假装成功
    const 撤销键 = screen.getByRole('button', { name: '撤销' }) as HTMLButtonElement;
    expect(撤销键.disabled).toBe(true);
    解除();
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '撤销' }) as HTMLButtonElement).disabled).toBe(false));
    expect(mock轻提示).toHaveBeenCalledWith('已撤销「候选人甲」的筛选');
    // 权威快照摘掉该行后卡片不残留
    置已筛状态({
      岗位们: [{ 编号: 'job_1', 状态: '在招' }],
      聚合: { 阶段: '成功', jobKey: 'recruiter:rejected:job_1', error: null },
      快照: { 阶段: '成功', items: [], error: null },
      操作: { 撤销淘汰候选: mock撤销淘汰候选 },
    });
    页.rerender(
      <MemoryRouter>
        <已筛候选 />
      </MemoryRouter>,
    );
    expect(screen.queryByText('候选人甲')).toBeNull();
    // 文案中性：不承诺「立刻回到推荐流」
    expect(mock轻提示).toHaveBeenCalledWith('已撤销「候选人甲」的筛选');
    expect(screen.queryByText(/立刻回到推荐流/)).toBeNull();
  });

  it('撤销失败行保留并提示 P4 文案', async () => {
    const user = userEvent.setup();
    mock撤销淘汰候选.mockRejectedValueOnce(
      new BFF错误(503, 'recruitment_service_unavailable', 'x'));
    置已筛状态({
      岗位们: [{ 编号: 'job_1', 状态: '在招' }],
      聚合: { 阶段: '成功', jobKey: 'recruiter:rejected:job_1', error: null },
      快照: {
        阶段: '成功', error: null,
        items: [淘汰卡({ 推荐ID: 'rec_1', 别名: '候选人甲', 原因: 'other' })],
      },
      操作: { 撤销淘汰候选: mock撤销淘汰候选 },
    });
    渲染已筛();
    await user.click(screen.getByRole('button', { name: '撤销' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('服务暂时不可用，请稍后再试'));
    expect(screen.getByText('候选人甲')).toBeTruthy();
  });

  it('Mock 分支原样读 不合适候选 且零 P4 请求', async () => {
    置Mock状态();
    渲染已筛();
    expect(screen.getByText('江叙白')).toBeTruthy();
    expect(screen.getByText('年限不足')).toBeTruthy();
    expect(mock设置发现推荐范围).not.toHaveBeenCalled();
    expect(mock加载招聘已筛).not.toHaveBeenCalled();
    expect(mock撤销淘汰候选).not.toHaveBeenCalled();
  });
});
