// P1C Task 5：owner 岗位详情 的 publisher/hiring 投影与 canonical 公司导航测试。
// Backend 分支消费 后端状态.岗位快照 的 server DTO（经 从BFF岗位发布方 投影），
// 发布人身份读当前 从BFF招聘身份() view；Mock 分支保持 静态档案 + /company/yunqu 原路由。
// 公司卡可点与否由 canonical ref 与 不可用公开企业编号 共同决定，不按公司名猜。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 岗位详情, { 岗位发布方区 } from './岗位详情';
import { 从BFF岗位发布方, 从BFF招聘身份 } from '../数据/组织映射';
import type { BFFOwnerJob } from '../数据/BFF契约';
import { BFF岗位样本, BFF招聘方档案样本, 页面岗位样本 } from '../测试/BFF样本';
import type { 在招岗位 } from '../数据/类型';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock更新岗位 = vi.fn(async () => undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: mock返回, 跳转: mock跳转 }),
}));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

const { mock公司路由键, mock取公司档案 } = vi.hoisted(() => {
  const 静态档案 = {
    键: 'yunqu',
    名称: '云衢科技',
    首字: '云',
    规模行: 'C 轮 · 500-1000 人 · 金融科技',
    地址: '上海市张江路 1 号',
    简介: ['做可靠的技术产品'],
    工商信息: [{ 项: '成立日期', 值: '2015-03-02' }],
  };
  return {
    mock公司路由键: vi.fn((名称: string) => `slug-${名称}`),
    mock取公司档案: vi.fn(() => 静态档案),
  };
});
vi.mock('../数据/公司档案', () => ({
  公司路由键: mock公司路由键,
  取公司档案: mock取公司档案,
}));

// ── 三组矩阵样本（本文件内最小完整对象，基于 BFF样本 的基础样本）──

const directVerifiedJob: BFFOwnerJob = {
  ...BFF岗位样本,
  publisher_verification_status: 'verified',
  publisher_organization_ref: 'org_direct',
  hiring_organization_verification_status: 'verified',
  hiring_organization_ref: 'org_direct',
  hiring_organization_claim: { display_name: '批审科技', legal_name: '上海批审科技有限公司' },
};

const directUnverifiedJob: BFFOwnerJob = {
  ...BFF岗位样本,
  publisher_verification_status: 'unverified',
  hiring_organization_verification_status: 'unverified',
  hiring_organization_claim: { display_name: '示例客户公司', legal_name: null },
};

const agencyVerifiedPublisherJob: BFFOwnerJob = {
  ...BFF岗位样本,
  publisher_mode: 'agency',
  publisher_verification_status: 'verified',
  publisher_organization_ref: 'org_agency',
  hiring_organization_verification_status: 'unverified',
  hiring_organization_claim: { display_name: '客户甲公司', legal_name: null },
};

const 档案 = {
  ...BFF招聘方档案样本,
  personal_verification_status: 'verified' as const,
  verified_name: '林澈',
  avatar_url: 'https://cdn.example.com/avatar.png',
};

const 身份样本 = 从BFF招聘身份(档案, [], null, []);

// 仓库未装 @testing-library/jest-dom：文本断言直接读 DOM textContent
function 含文本(元素: HTMLElement, 文本: string) {
  expect(elementText(元素)).toContain(文本);
}
function 不含文本(元素: HTMLElement, 文本: string) {
  expect(elementText(元素)).not.toContain(文本);
}
function elementText(元素: HTMLElement): string {
  return 元素.textContent ?? '';
}

function 渲染岗位详情(编号 = 'job_1') {
  return render(
    <MemoryRouter initialEntries={[`/hr/job/${编号}`]}>
      <Routes>
        <Route path="/hr/job/:id" element={<岗位详情 />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Backend 桩：owner snapshot（server DTO）+ 组织状态；数据源模式 'backend' */
function 置Backend(dto: BFFOwnerJob, 额外状态: Record<string, unknown> = {}) {
  mock应用状态 = {
    状态: {
      岗位列表: [页面岗位样本],
      当前岗位编号: 'job_1',
      企业候选列表: [],
      推荐列表: [],
      公司自述: null,
      公司LOGO: null,
      招聘方档案: 档案,
      企业关系列表: [],
      当前企业关系编号: null,
      企业管理员申请列表: [],
      不可用公开企业编号: [],
      ...额外状态,
    },
    派发: vi.fn(),
    操作: { 归档岗位: vi.fn(async () => undefined), 重开岗位: vi.fn(async () => undefined) },
    数据源模式: 'backend',
    后端状态: { 岗位快照: { job_1: dto } },
  };
}

// ── 岗位发布方区：只吃两个 view，两行不折叠 ──

describe('岗位发布方区 · 投影矩阵', () => {
  it.each([
    ['direct verified', directVerifiedJob],
    ['direct unverified', directUnverifiedJob],
    ['agency verified publisher', agencyVerifiedPublisherJob],
  ])('%s 分开显示 publisher 与 hiring', (_名, dto) => {
    const view = 从BFF岗位发布方(dto);
    render(<岗位发布方区 view={view} 身份={身份样本} />);
    const 发布方行 = screen.getByTestId('publisher-status');
    const 用人行 = screen.getByTestId('hiring-status');
    // 两个独立元素：publisher 与 hiring 不折叠成一行
    expect(发布方行).not.toBe(用人行);
    含文本(发布方行, view.发布方验证);
    含文本(用人行, view.用人企业验证);
    含文本(用人行, view.用人企业声明.display_name);
  });

  it('agency publisher verified 不把客户 hiring claim 标 verified', () => {
    const view = 从BFF岗位发布方(agencyVerifiedPublisherJob);
    render(<岗位发布方区 view={view} 身份={身份样本} />);
    含文本(screen.getByTestId('publisher-status'), '已认证');
    const 用人行 = screen.getByTestId('hiring-status');
    含文本(用人行, '未认证');
    不含文本(用人行, '已认证');
  });

  it('direct verified 两个 ref 相同仍各自显示', () => {
    const view = 从BFF岗位发布方(directVerifiedJob);
    render(<岗位发布方区 view={view} 身份={身份样本} />);
    含文本(screen.getByTestId('publisher-status'), '已认证');
    含文本(screen.getByTestId('hiring-status'), '已认证');
    含文本(screen.getByTestId('hiring-status'), '批审科技');
  });

  it('发布人姓名/职务/个人核验读 招聘身份视图，不读 DTO', () => {
    const view = 从BFF岗位发布方(directVerifiedJob);
    const { container } = render(<岗位发布方区 view={view} 身份={身份样本} />);
    expect(screen.getByText('林澈')).toBeTruthy();
    expect(screen.getByText('招聘负责人')).toBeTruthy();
    expect(screen.getByText('已认证')).toBeTruthy();
    expect(container.querySelector('img[src="https://cdn.example.com/avatar.png"]')).not.toBeNull();
  });
});

// ── owner 岗位详情 · Backend 分支 ──

describe('岗位详情 · Backend owner snapshot', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock公司路由键.mockClear();
    mock取公司档案.mockClear();
  });

  it('有 hiring ref 且不在不可用编号 → 公司卡可点导航 /company/{opaque-id}', async () => {
    置Backend(directVerifiedJob);
    渲染岗位详情();
    const 公司卡 = screen.getByRole('button', { name: /批审科技/ });
    await userEvent.click(公司卡);
    expect(mock跳转).toHaveBeenCalledWith('/company/org_direct');
    // Backend 不读静态公司档案，也不按公司名造 slug
    expect(mock取公司档案).not.toHaveBeenCalled();
    expect(mock公司路由键).not.toHaveBeenCalled();
    // 发布人身份与两行投影同屏
    expect(screen.getByText('林澈')).toBeTruthy();
    含文本(screen.getByTestId('publisher-status'), 'verified');
    含文本(screen.getByTestId('hiring-status'), 'verified');
  });

  it('无 ref 时仍显示 claim+unverified，但不是 button/link，不创建 slug', () => {
    置Backend(directUnverifiedJob);
    渲染岗位详情();
    expect(screen.getByText('示例客户公司')).toBeTruthy();
    含文本(screen.getByTestId('hiring-status'), 'unverified');
    expect(screen.queryByRole('button', { name: /示例客户公司/ })).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(mock公司路由键).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('ref 在 不可用公开企业编号 中 → 同卡保留 claim 文案但无导航', () => {
    置Backend(directVerifiedJob, { 不可用公开企业编号: ['org_direct'] });
    渲染岗位详情();
    expect(screen.getByText('批审科技')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /批审科技/ })).toBeNull();
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('后续成功读取同一 ID（编号移出不可用表）后同卡恢复导航', () => {
    置Backend(directVerifiedJob, { 不可用公开企业编号: ['org_direct'] });
    const 视图 = 渲染岗位详情();
    expect(screen.queryByRole('button', { name: /批审科技/ })).toBeNull();
    // 组织操作读取成功 → 缓存公开企业 会把该 ID 移出 不可用公开企业编号
    mock应用状态 = {
      ...mock应用状态,
      状态: { ...mock应用状态.状态, 不可用公开企业编号: [] },
    };
    视图.rerender(
      <MemoryRouter initialEntries={['/hr/job/job_1']}>
        <Routes>
          <Route path="/hr/job/:id" element={<岗位详情 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /批审科技/ })).toBeTruthy();
  });

  it('Backend 不读取 本公司键=yunqu 的静态档案', () => {
    置Backend(directVerifiedJob);
    渲染岗位详情();
    expect(mock取公司档案).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalledWith('/company/yunqu');
  });
});

// ── D3：Backend 无效深链 fail closed —— 不回退首项、零 mutation ──

const 岗位A: 在招岗位 = { ...页面岗位样本, 编号: 'job_a', 名称: '岗位 A' };
const 岗位B: 在招岗位 = { ...页面岗位样本, 编号: 'job_b', 名称: '岗位 B' };

describe('岗位详情 · Backend 无效深链', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock更新岗位.mockClear();
    mock应用状态 = {
      状态: {
        岗位列表: [岗位A, 岗位B],
        当前岗位编号: 'job_a',
        企业候选列表: [],
        推荐列表: [],
        公司自述: null,
        公司LOGO: null,
        不可用公开企业编号: [],
      },
      派发: vi.fn(),
      操作: {
        归档岗位: vi.fn(async () => undefined),
        重开岗位: vi.fn(async () => undefined),
        更新岗位: mock更新岗位,
      },
      数据源模式: 'backend',
      后端状态: { 岗位快照: {} },
    };
  });

  it.each(['missing', 'deleted_from_previous_snapshot'])(
    'Backend 无效岗位 %s 不回退首项',
    (id) => {
      渲染岗位详情(id);
      expect(screen.getByText('岗位不存在或已不可用')).toBeTruthy();
      expect(screen.queryByText('岗位 A')).toBeNull();
      expect(screen.queryByText('岗位 B')).toBeNull();
      expect(screen.queryByRole('button', { name: /编辑|关闭职位|重新开放/ })).toBeNull();
      expect(mock更新岗位).not.toHaveBeenCalled();
    },
  );

  it('Mock 随机 ID 仍显示原型首项', () => {
    // Mock 分支：数据源模式缺席 → 是后端 为 false，随机 ID 仍回退列表首项
    mock应用状态 = {
      ...mock应用状态,
      数据源模式: undefined,
      后端状态: undefined,
    };
    渲染岗位详情('missing');
    expect(screen.getByText('岗位 A')).toBeTruthy();
  });
});

// ── owner 岗位详情 · Mock 分支保持原样 ──

describe('岗位详情 · Mock 静态路由', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock公司路由键.mockClear();
    mock取公司档案.mockClear();
    mock应用状态 = {
      状态: {
        岗位列表: [页面岗位样本],
        当前岗位编号: 'job_1',
        企业候选列表: [],
        推荐列表: [],
        公司自述: null,
        公司LOGO: null,
      },
      派发: vi.fn(),
      操作: { 归档岗位: vi.fn(async () => undefined), 重开岗位: vi.fn(async () => undefined) },
    };
  });

  it('Mock 公司卡仍读静态档案并跳 /company/yunqu', async () => {
    渲染岗位详情();
    const 公司卡 = screen.getByRole('button', { name: /云衢科技/ });
    await userEvent.click(公司卡);
    expect(mock取公司档案).toHaveBeenCalledWith('yunqu');
    expect(mock跳转).toHaveBeenCalledWith('/company/yunqu');
    // Mock 分支不渲染 owner 投影两行
    expect(screen.queryByTestId('publisher-status')).toBeNull();
    expect(screen.queryByTestId('hiring-status')).toBeNull();
  });
});
