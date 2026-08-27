// 企业我的 · Backend 身份行组件测试（P1C Task 3 Step 1）。
// Backend：头像行只读 从BFF招聘身份() 的 view model（公司 = current affiliation / 未认证声明，
// 个人与任职状态分开、不从公司名非空推导 verified）；Mock：仍读 企业认证 fixture。
// P6 Task 7 追加：代理卡上的规则计数只在 Mock 或 recruiter rules 已水合时显示，
// 未水合不出 Mock 数字；水合后只数 生效:true 的规则。

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

/** 规则计数种子：一条生效 + 一条停用 —— 数出 2 就是没按 生效:true 过滤 */
const 招聘规则种子 = [
  { 编号: 'R-01', 内容: '必须双休', 来源: '筛选设定', 生效: true },
  { 编号: 'R-02', 内容: '五年以上经验', 来源: '筛选设定', 生效: false },
];

/** 屏幕消费的共享字段补空数组；组织身份字段由用例按 Backend 事实覆写。 */
function 置Backend应用状态(组织: Record<string, unknown> = {}, 招聘规则阶段 = '未开始') {
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
    后端状态: {
      Agent规则水合: {
        candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: 招聘规则阶段, proposals: '未开始' },
      },
    },
  };
}

function 置Mock应用状态(组织: Record<string, unknown> = {}) {
  mock应用状态 = {
    状态: {
      岗位列表: [],
      企业候选列表: [],
      企业规则: [],
      企业认证: { 姓名: '邵铭', 公司: '云衢科技', 职务: '技术 VP' },
      ...组织,
    },
    派发: mock派发,
    数据源模式: 'mock',
    后端状态: {
      Agent规则水合: {
        candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
    },
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

describe('企业我的 · 代理卡规则计数的水合门控（P6 Task 7）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
  });

  it('Backend rules 未水合时不出 Mock 规则计数', () => {
    置Backend应用状态({ 企业规则: 招聘规则种子 });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.queryByText(/规则 \d+ 条生效/)).toBeNull();
  });

  it('Backend rules 水合成功后只数 生效:true 的规则', () => {
    置Backend应用状态({ 企业规则: 招聘规则种子 }, '成功');
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText(/规则 1 条生效/)).toBeTruthy();
  });

  it('Mock 计数保持原口径：同样只数 生效:true 的规则', () => {
    置Mock应用状态({ 企业规则: 招聘规则种子 });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText(/规则 1 条生效/)).toBeTruthy();
  });
});
