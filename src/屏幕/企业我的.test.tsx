// 企业我的 · Backend 身份行组件测试（P1C Task 3 Step 1）。
// Backend：头像行只读 从BFF招聘身份() 的 view model（公司 = current affiliation / 未认证声明，
// 个人与任职状态分开、不从公司名非空推导 verified）；Mock：仍读 企业认证 fixture。
// P6 Task 7 追加：代理卡上的规则计数只在 Mock 或 recruiter rules 已水合时显示，
// 未水合不出 Mock 数字；水合后只数 生效:true 的规则。
// Backend MatchCase 真相源修复追加：在谈/待拍板 只读当前 recruiter 主体的 unfiltered
// P5 open 快照（注册 scope + 权威统计），意向达成 Backend 固定 —；
// 企业候选列表 不再进入 Backend 展示；Mock 保留原型统计且零 P5 operation 调用。

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 企业我的 from './企业我的';
import { BFF企业关系样本, BFF招聘方档案样本, BFF主体样本 } from '../测试/BFF样本';
import { P5范围键 } from '../状态/后端/MatchCase操作';
import type { P5列表项 } from '../数据/招聘数据源/MatchCase';
import type { P5列表快照 } from '../状态/后端/类型';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
// 稳定 operation spy：生产 Provider 的 操作 引用稳定，桩宿主同样给恒定表
const mock设置P5范围 = vi.fn();
const mock加载工作区 = vi.fn(async () => undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转 }) }));

/** 规则计数种子：一条生效 + 一条停用 —— 数出 2 就是没按 生效:true 过滤 */
const 招聘规则种子 = [
  { 编号: 'R-01', 内容: '必须双休', 来源: '筛选设定', 生效: true },
  { 编号: 'R-02', 内容: '五年以上经验', 来源: '筛选设定', 生效: false },
];

// ── 完整 recruiter P5列表项 fixture（candidateAlias 而非 intentionId，不删字段）──
function 招聘行(
  caseId: string,
  stage: P5列表项['state']['stage'],
  needsAction: boolean,
  lifecycle: P5列表项['state']['lifecycle'] = 'open',
): P5列表项 {
  return {
    role: 'recruiter',
    state: {
      caseId, lifecycle, stage,
      status: lifecycle === 'open' ? 'running' : lifecycle === 'ended' ? 'ended' : 'passed',
      step: lifecycle === 'open' ? 'policy_check' : 'complete',
      round: 0, roundBudget: 3, needsUser: false,
      outcome: null, outcomeCode: null,
      createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-01T09:00:00Z',
      finalizedAt: lifecycle === 'open' ? null : '2026-09-01T10:00:00Z',
    },
    needsAction,
    candidateAlias: 'candidate-0123456789ab',
    job: {
      jobId: 'job_0123456789abcdef0123456789abcdef',
      job: { title: '后端工程师', location: '上海', publicSalaryRange: '20-30K', requiredSkills: ['Go'] },
    },
  };
}

function 成功P5快照(items: P5列表项[], nextCursor: string | null): P5列表快照 {
  return {
    ownerSubjectId: 'sub_recruiter', 阶段: '成功', 刷新中: false,
    items, nextCursor, 已加载页数: 1, error: null, generation: 1,
  };
}

/** 屏幕消费的共享字段补空数组；组织身份字段由用例按 Backend 事实覆写。 */
function 置Backend应用状态(
  组织: Record<string, unknown> = {},
  招聘规则阶段 = '未开始',
  P5快照?: P5列表快照,
) {
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
    操作: { 设置P5范围: mock设置P5范围, 加载工作区: mock加载工作区 },
    后端状态: {
      主体: { ...BFF主体样本, subject_id: 'sub_recruiter', last_used_role: 'recruiter' },
      Agent规则水合: {
        candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: 招聘规则阶段, proposals: '未开始' },
      },
      P5工作区: P5快照 === undefined ? {} : {
        [P5范围键.open('recruiter', null)]: P5快照,
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
    操作: { 设置P5范围: mock设置P5范围, 加载工作区: mock加载工作区 },
    后端状态: {
      主体: null,
      Agent规则水合: {
        candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
      P5工作区: {},
    },
  };
}

beforeEach(() => {
  mock设置P5范围.mockClear();
  mock加载工作区.mockClear();
});

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

describe('企业我的 · Backend 权威 MatchCase 统计', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
  });

  it('注册 recruiter unfiltered scope：在招岗位照岗位列表数，在谈/待拍板来自 P5 统计，意向达成 —', async () => {
    置Backend应用状态(
      { 岗位列表: [{ 编号: 'J-1', 名称: 'AI 产品实习生', 状态: '在招', 薪资带: '300-500 元/天' }] },
      '未开始',
      成功P5快照([
        招聘行('mc_1', 'anonymous_screening', true),
        招聘行('mc_2', 'needs_coordination', false),
      ], null),
    );
    const { unmount } = render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getAllByText('1')).toHaveLength(2); // 在招岗位 1 + 待拍板 1（needs_action）
    expect(screen.getByText('2')).toBeTruthy(); // 在谈 2（P5 open）
    expect(screen.getByText('—')).toBeTruthy(); // 意向达成固定 —
    await waitFor(() => expect(mock设置P5范围)
      .toHaveBeenCalledWith('recruiter', P5范围键.open('recruiter', null)));
    expect(mock加载工作区).toHaveBeenCalledWith('recruiter', null);
    unmount();
    expect(mock设置P5范围).toHaveBeenLastCalledWith('recruiter', null);
  });

  it('点击待拍板仍派发 企业看全部在谈/待我拍板', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    置Backend应用状态(
      {},
      '未开始',
      成功P5快照([招聘行('mc_1', 'anonymous_screening', true)], null),
    );
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /待拍板/ }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '企业看全部在谈', 档: '待我拍板' });
  });

  it('企业候选列表不再进入 Backend 展示：旧 owner 快照显示 —', () => {
    置Backend应用状态(
      // legacy fixture 故意带 2 行 —— Backend 分支绝不数它们
      { 企业候选列表: [{ 编号: 'A-01' }, { 编号: 'A-02' }] },
      '未开始',
      { ...成功P5快照([招聘行('mc_1', 'anonymous_screening', true)], null), ownerSubjectId: 'sub_old' },
    );
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2); // 在谈/意向达成
    expect(mock派发).not.toHaveBeenCalled();
  });

  it('Mock 统计保持原口径（企业候选列表），零 P5 operation 调用', () => {
    置Mock应用状态({
      企业候选列表: [
        { 编号: 'A-01', 需要你: true, 阶段: '匿名初筛' },
        { 编号: 'A-02', 需要你: false, 阶段: '意向确认' },
      ],
    });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(mock设置P5范围).not.toHaveBeenCalled();
    expect(mock加载工作区).not.toHaveBeenCalled();
    expect(screen.getByText('2')).toBeTruthy(); // 在谈 = 企业候选列表.length
    expect(screen.getAllByText('1')).toHaveLength(2); // 待拍板 = 需要你的 1 条 + 意向达成 = 意向确认 1 条
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
