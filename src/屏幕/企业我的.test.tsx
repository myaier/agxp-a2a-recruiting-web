// 企业我的 · Backend 身份行组件测试（P1C Task 3 Step 1）。
// Backend：头像行只读 从BFF招聘身份() 的 view model（公司 = current affiliation / 未认证声明，
// 个人与任职状态分开、不从公司名非空推导 verified）；Mock：仍读 企业认证 fixture。

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 企业我的 from './企业我的';
import { BFF企业关系样本, BFF招聘方档案样本 } from '../测试/BFF样本';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转 }) }));

/** 屏幕消费的共享字段补空数组；组织身份字段由用例按 Backend 事实覆写。 */
function 置Backend应用状态(组织: Record<string, unknown> = {}) {
  mock应用状态 = {
    状态: {
      岗位列表: [],
      企业候选列表: [],
      企业规则: [],
      招聘方档案: BFF招聘方档案样本,
      企业关系列表: [],
      当前企业关系编号: null,
      企业管理员申请列表: [],
      未认证公司声明: '',
      ...组织,
    },
    派发: mock派发,
    数据源模式: 'backend',
  };
}

function 置Mock应用状态() {
  mock应用状态 = {
    状态: {
      岗位列表: [],
      企业候选列表: [],
      企业规则: [],
      企业认证: { 姓名: '邵铭', 公司: '云衢科技', 职务: '技术 VP' },
    },
    派发: mock派发,
  };
}

describe('企业我的 · Backend 映射身份行', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    置Backend应用状态();
  });

  it('只显示映射后的公司与个人/任职状态，公司来自 current affiliation', () => {
    置Backend应用状态({
      企业关系列表: [
        { ...BFF企业关系样本, organization_display_name: '后端映射科技' },
      ],
      当前企业关系编号: 'aff_1',
    });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText('后端映射科技')).toBeTruthy();
    expect(screen.getByText('个人：未认证')).toBeTruthy();
    expect(screen.getByText('任职：已认证')).toBeTruthy();
  });

  it('不从公司名非空推导 verified：无关系时显示声明公司与未认证事实', () => {
    置Backend应用状态({ 企业关系列表: [], 未认证公司声明: '声明科技' });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText('声明科技')).toBeTruthy();
    expect(screen.getByText('个人：未认证')).toBeTruthy();
    expect(screen.getByText('任职：无')).toBeTruthy();
  });

  it('verified 个人与 pending 任职各自如实展示', () => {
    置Backend应用状态({
      招聘方档案: {
        ...BFF招聘方档案样本,
        personal_verification_status: 'verified',
        verified_name: '林澈真名',
      },
      企业关系列表: [{ ...BFF企业关系样本, status: 'pending' }],
      当前企业关系编号: null,
    });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText('个人：已认证')).toBeTruthy();
    expect(screen.getByText('任职：无')).toBeTruthy();
  });
});

describe('企业我的 · Mock 保持原 fixture', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    置Mock应用状态();
  });

  it('Mock 仍读企业认证 fixture，不出现 Backend 状态行', () => {
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText('云衢科技')).toBeTruthy();
    expect(screen.getByText('招聘名片 ✎')).toBeTruthy();
    expect(screen.queryByText('个人：未认证')).toBeNull();
    expect(screen.queryByText('任职：已认证')).toBeNull();
  });
});
