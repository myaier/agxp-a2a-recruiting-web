// 公司档案编辑 · Backend/Mock 双分支测试（P1C Task 4 Step 3）。
// Backend：分区清单从 企业档案快照 构造 资料形，绝不读静态 取公司档案；admin+verified+active
// 才可编辑，member/pending/revoked/suspended 一律只读（清单页无保存入口）。
// Mock：仍读静态档 + 公司自述，分区行照旧。仓库未装 jest-dom，断言直接读 DOM。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 公司档案编辑 from './公司档案编辑';
import { BFF企业关系样本, BFF企业档案样本, BFF公开企业样本 } from '../测试/BFF样本';
import { 本公司键 } from '../数据/公司主页资料';
import { 路径 } from '../路由/路径表';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock保存企业档案 = vi.fn(async () => {});
const mock上传媒体 = vi.fn(async () => {});
const mock移除媒体 = vi.fn(async () => {});
const mock查询Taxonomy = vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v1' }));
// 取公司档案 的调用记录：工厂委托真实实现（Mock 分支测试仍要真档），Backend 分支断言零调用
const mock取公司档案 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }),
}));
vi.mock('../数据/公司档案', async (导入原模块) => {
  const 实际 = await 导入原模块() as typeof import('../数据/公司档案');
  return {
    ...实际,
    取公司档案: (...参数: unknown[]) => {
      mock取公司档案(...参数);
      return 实际.取公司档案(...参数 as [string]);
    },
  };
});

const { profile: _档案, ...身份样本 } = BFF公开企业样本;

function 置Backend应用状态(覆盖: Record<string, unknown> = {}) {
  mock应用状态 = {
    状态: {
      企业关系列表: [BFF企业关系样本],
      当前企业关系编号: BFF企业关系样本.affiliation_id,
      企业档案快照: BFF企业档案样本,
      当前企业身份: 身份样本,
      公司自述: null,
      公司LOGO: null,
      ...覆盖,
    },
    派发: mock派发,
    操作: {
      保存企业档案: mock保存企业档案,
      上传并发布企业媒体: mock上传媒体,
      移除企业媒体: mock移除媒体,
    },
    目录查询: { 查询Taxonomy: mock查询Taxonomy },
    数据源模式: 'backend',
  };
}

function 置Mock应用状态() {
  mock应用状态 = {
    状态: { 公司自述: null, 公司LOGO: null },
    派发: mock派发,
  };
}

describe('公司档案编辑 · Backend 权威快照清单', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock返回.mockClear();
    mock保存企业档案.mockClear();
    mock保存企业档案.mockResolvedValue(undefined);
    mock上传媒体.mockClear();
    mock移除媒体.mockClear();
    mock查询Taxonomy.mockClear();
    mock取公司档案.mockClear();
    置Backend应用状态();
  });

  it('计数来自 企业档案快照，不读静态公司档案', () => {
    render(<MemoryRouter><公司档案编辑 /></MemoryRouter>);
    // 样本档案六项基本信息齐 + LOGO 有媒体 → 6/6；实景 1 组已填 → 1/2
    expect(screen.getByText('6/6')).toBeTruthy();
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(screen.getByText('做可靠的技术产品')).toBeTruthy();
    expect(mock取公司档案).not.toHaveBeenCalled();
  });

  it('快照未水合时给加载占位，仍不读静态档', () => {
    置Backend应用状态({ 企业档案快照: null, 当前企业身份: null });
    render(<MemoryRouter><公司档案编辑 /></MemoryRouter>);
    expect(screen.getByText('正在加载企业资料')).toBeTruthy();
    expect(mock取公司档案).not.toHaveBeenCalled();
  });

  it('点分区行跳对应分区页', async () => {
    const 用户 = userEvent.setup();
    render(<MemoryRouter><公司档案编辑 /></MemoryRouter>);
    await 用户.click(screen.getByRole('button', { name: /基本信息/ }));
    expect(mock跳转).toHaveBeenCalledWith(路径.公司档案分区('basic'));
  });

  it.each([
    ['member 权限不足', { role: 'member' as const }],
    ['pending 尚未核验', { status: 'pending' as const }],
    ['revoked 已撤销', { status: 'revoked' as const }],
    ['suspended 企业停用', { organization_status: 'suspended' as const }],
  ])('%s：只读清单，无保存入口，行仍可进只读页', async (_名, 关系覆盖) => {
    置Backend应用状态({
      企业关系列表: [{ ...BFF企业关系样本, ...关系覆盖 }],
    });
    const 用户 = userEvent.setup();
    render(<MemoryRouter><公司档案编辑 /></MemoryRouter>);
    expect(screen.getByText('仅企业管理员可修改')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull();
    // 只读是「不能改」，不是「不能看」：分区行照常进入只读分区页
    await 用户.click(screen.getByRole('button', { name: /基本信息/ }));
    expect(mock跳转).toHaveBeenCalledWith(路径.公司档案分区('basic'));
  });
});

describe('公司档案编辑 · Mock 原型保持不变', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock取公司档案.mockClear();
    置Mock应用状态();
  });

  it('清单仍读静态公司档案（本公司键）', () => {
    render(<MemoryRouter><公司档案编辑 /></MemoryRouter>);
    expect(mock取公司档案).toHaveBeenCalledWith(本公司键);
    // 七个分区行照旧
    for (const 名 of ['基本信息', '公司福利', '公司介绍', '主营业务', '公司相册', '产品介绍', '团队介绍']) {
      expect(screen.getByRole('button', { name: new RegExp(名) })).toBeTruthy();
    }
  });
});
