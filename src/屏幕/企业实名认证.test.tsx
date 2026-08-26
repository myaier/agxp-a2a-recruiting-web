// 企业实名认证 · 身份诚实性组件测试（P1C Task 3 Step 1）。
// Backend：本屏是只读身份摘要 —— 个人 / 任职 / 管理员申请三条分开按服务端事实展示，
// 不再用 1.2 秒计时器伪造「认证通过」；Mock 分支的原型交互原样保留。
// 仓库未装 @testing-library/jest-dom，断言一律用 DOM 属性 / truthy，不用 toHaveValue。

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 企业实名认证 from './企业实名认证';
import {
  BFF企业关系样本,
  BFF企业管理员申请样本,
  BFF招聘方档案样本,
} from '../测试/BFF样本';
import type { BFF企业管理员申请 } from '../数据/BFF契约';
import { 路径 } from '../路由/路径表';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock读取企业管理员申请 = vi.fn(async () => {});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }),
}));

/** Backend 桩：只补本屏消费的组织身份字段，其余键与真实 状态 形状无关（本屏不读）。 */
function 置Backend应用状态(组织: Record<string, unknown> = {}) {
  mock应用状态 = {
    状态: {
      招聘方档案: BFF招聘方档案样本,
      企业关系列表: [],
      当前企业关系编号: null,
      企业管理员申请列表: [],
      ...组织,
    },
    派发: mock派发,
    操作: { 读取企业管理员申请: mock读取企业管理员申请 },
    数据源模式: 'backend',
  };
}

/** Mock 桩：数据源模式 undefined → Mock 分支，读旧 企业认证 fixture。 */
function 置Mock应用状态() {
  mock应用状态 = {
    状态: { 企业认证: { 姓名: '邵铭', 公司: '云衢科技', 职务: '技术 VP' } },
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

  it('两个入口分别去组织申请页与邀请加入页', async () => {
    const 用户 = userEvent.setup();
    render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
    await 用户.click(screen.getByRole('button', { name: /申请企业管理员/ }));
    expect(mock跳转).toHaveBeenCalledWith(路径.企业组织申请);
    await 用户.click(screen.getByRole('button', { name: /输入邀请口令加入企业/ }));
    expect(mock跳转).toHaveBeenCalledWith(路径.企业邀请加入);
  });
});

describe('企业实名认证 · Mock 原型保持不变', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock返回.mockClear();
    置Mock应用状态();
  });

  it('Mock 分支保留表单与人脸文案，1.2 秒后落全局并进招聘名片', () => {
    vi.useFakeTimers();
    try {
      render(<MemoryRouter><企业实名认证 /></MemoryRouter>);
      // 原布局：两个输入 + 人脸占位说明
      const 姓名框 = screen.getByPlaceholderText('与证件一致，向候选人实名示人');
      const 公司框 = screen.getByPlaceholderText('如：上海云衢信息科技有限公司');
      expect(screen.getByText('人脸识别将核对上面两项')).toBeTruthy();
      fireEvent.change(姓名框, { target: { value: '邵铭' } });
      fireEvent.change(公司框, { target: { value: '云衢科技' } });
      fireEvent.click(screen.getByRole('button', { name: '开始人脸识别' }));
      expect(mock派发).not.toHaveBeenCalled(); // 计时器未到，不提前落全局
      expect(screen.getByRole('button', { name: '认证中…' })).toBeTruthy();
      vi.advanceTimersByTime(1200);
      expect(mock派发).toHaveBeenCalledWith({
        型: '存企业认证',
        姓名: '邵铭',
        公司: '云衢科技',
      });
      expect(screen.getByText('认证通过')).toBeTruthy();
      expect(mock跳转).toHaveBeenCalledWith(路径.招聘名片);
    } finally {
      vi.useRealTimers();
    }
  });
});
