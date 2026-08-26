// 企业详情 · P1C Task 5：Backend canonical public company page 测试。
// route param 仅当 opaque organization_id：进入调 操作.读取公开企业(id)，
// 缓存 DTO 经 从BFF公开企业() 渲染（legal/display identity、verified_at、
// Profile 七个已批准分区、public media、active verified job count）。
// 不调 公司路由键()/取公司档案()；404/suspended/网络错误都进诚实空态，无 Mock 回退、
// 无 unhandled rejection。Mock 分支继续按原 slug 渲染静态档。

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 企业详情 from './企业详情';
import { BFF公开企业样本 } from '../测试/BFF样本';

const mock返回 = vi.fn();
const mock跳转 = vi.fn();
const mock读取公开企业 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: mock返回, 跳转: mock跳转 }),
}));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

const { mock公司路由键, mock取公司档案 } = vi.hoisted(() => {
  // Mock 分支会读全部分区字段，样本补齐
  const 静态档案 = {
    键: 'pingcap',
    名称: '云衢科技',
    首字: '云',
    规模行: 'C 轮 · 500-1000 人 · 金融科技',
    作息: '双休',
    地址: '上海市张江路 1 号',
    地址补充: '',
    简介: ['做可靠的技术产品'],
    企业文化: '把事做对',
    发展历程: [],
    主营业务: ['智能招聘平台'],
    福利: [],
    在职感受: [],
    工商信息: [{ 项: '成立日期', 值: '2015-03-02' }],
    在招岗位数: 3,
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

function 渲染(键 = 'org_9') {
  return render(
    <MemoryRouter initialEntries={[`/company/${键}`]}>
      <Routes>
        <Route path="/company/:id" element={<企业详情 />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Backend 桩：数据源模式 'backend' + 操作.读取公开企业 seam + 公开企业表 缓存 */
function 置Backend(公开企业表: Record<string, unknown> = {}) {
  mock应用状态 = {
    状态: { 在谈列表: [], 公开企业表 },
    派发: vi.fn(),
    操作: { 读取公开企业: mock读取公开企业 },
    数据源模式: 'backend',
  };
}

/** 等微任务与 effect 的 promise rejection 都落定 */
async function 等待落定() {
  await new Promise((好) => setTimeout(好, 0));
  await new Promise((好) => setTimeout(好, 0));
}

describe('企业详情 · Backend 公共企业页', () => {
  beforeEach(() => {
    mock返回.mockClear();
    mock跳转.mockClear();
    mock读取公开企业.mockReset();
    mock读取公开企业.mockResolvedValue(undefined);
    mock公司路由键.mockClear();
    mock取公司档案.mockClear();
    置Backend();
  });

  it('route param 原样作为 opaque ID 读取公开企业，不读静态档', async () => {
    渲染('org_9');
    await waitFor(() => expect(mock读取公开企业).toHaveBeenCalledWith('org_9'));
    expect(mock公司路由键).not.toHaveBeenCalled();
    expect(mock取公司档案).not.toHaveBeenCalled();
  });

  it('缓存 DTO 经 从BFF公开企业 渲染：身份/七分区/公开媒体/在招数', async () => {
    置Backend({ org_9: BFF公开企业样本 });
    const { container } = 渲染();
    await waitFor(() => expect(screen.getByText('做可靠的技术产品')).toBeTruthy());
    // legal/display identity 与 verified_at
    expect(screen.getByText('上海云衢科技有限公司')).toBeTruthy();
    expect(screen.getAllByText('云衢科技').length).toBeGreaterThan(0);
    expect(screen.getByText('2026-08-24')).toBeTruthy();
    // Profile 七个已批准分区
    expect(screen.getByText('公司简介')).toBeTruthy();
    expect(screen.getByText('主营业务')).toBeTruthy();
    expect(screen.getByText('智能招聘平台')).toBeTruthy();
    expect(screen.getByText('产品介绍')).toBeTruthy();
    expect(screen.getByText('AI 简历助手')).toBeTruthy();
    expect(screen.getByText('团队介绍')).toBeTruthy();
    expect(screen.getByText('林澈')).toBeTruthy();
    expect(screen.getByText('招聘负责人')).toBeTruthy();
    expect(screen.getByText('上海市张江路 1 号')).toBeTruthy();
    expect(screen.getByText('五险一金')).toBeTruthy();
    expect(screen.getByText('双休')).toBeTruthy();
    // public media（logo/办公实景）与 active verified job count
    expect(container.querySelector('img[src="https://cdn.example.com/org_1/media_1.png"]')).not.toBeNull();
    expect(screen.getByText('2 个已核验在招岗位')).toBeTruthy();
    // 线上无来源的 Mock 分区不出现
    expect(screen.queryByText('企业文化')).toBeNull();
    expect(screen.queryByText('发展历程')).toBeNull();
    expect(screen.queryByText('在职者反馈')).toBeNull();
    expect(mock取公司档案).not.toHaveBeenCalled();
  });

  it('404 → 诚实空态，无 Mock 回退，无 unhandled rejection', async () => {
    // 用可观察 thenable 记录页面是否对 operation 的 promise 挂了 catch：
    // effect 消费了 rejection，它就不会向上游（测试进程）逃逸成 unhandled rejection
    let 已挂接 = false;
    const 底层 = Promise.reject(
      Object.assign(new Error('not found'), { code: 'organization_not_found' }),
    );
    mock读取公开企业.mockImplementation(
      () =>
        ({
          catch(处理: (理由: unknown) => void) {
            已挂接 = true;
            return 底层.catch(处理);
          },
        }) as unknown as Promise<void>,
    );
    渲染();
    await 等待落定();
    expect(screen.getByText('这家企业暂时打不开')).toBeTruthy();
    expect(mock取公司档案).not.toHaveBeenCalled();
    expect(mock公司路由键).not.toHaveBeenCalled();
    expect(已挂接).toBe(true);
  });

  it('suspended → 同一诚实空态，不从静态表回退', async () => {
    mock读取公开企业.mockRejectedValue(
      Object.assign(new Error('suspended'), { code: 'organization_suspended' }),
    );
    渲染();
    await 等待落定();
    expect(screen.getByText('这家企业暂时打不开')).toBeTruthy();
    expect(mock取公司档案).not.toHaveBeenCalled();
  });

  it('普通网络错误也进空态，页面不崩', async () => {
    mock读取公开企业.mockRejectedValue(new Error('network down'));
    渲染();
    await 等待落定();
    expect(screen.getByText('这家企业暂时打不开')).toBeTruthy();
  });

  it('同一 ID 后续读取成功后恢复渲染', async () => {
    const 视图 = 渲染();
    expect(screen.getByText('这家企业暂时打不开')).toBeTruthy();
    // 组织操作 读取公开企业 成功后派发 缓存公开企业：表里有了，页面随之恢复
    mock应用状态 = {
      ...mock应用状态,
      状态: { ...mock应用状态.状态, 公开企业表: { org_9: BFF公开企业样本 } },
    };
    视图.rerender(
      <MemoryRouter initialEntries={['/company/org_9']}>
        <Routes>
          <Route path="/company/:id" element={<企业详情 />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('做可靠的技术产品')).toBeTruthy());
  });
});

describe('企业详情 · Mock 分支保持原 slug 渲染', () => {
  beforeEach(() => {
    mock返回.mockClear();
    mock跳转.mockClear();
    mock读取公开企业.mockReset();
    mock读取公开企业.mockResolvedValue(undefined);
    mock公司路由键.mockClear();
    mock取公司档案.mockClear();
    mock应用状态 = {
      状态: { 在谈列表: [] },
      派发: vi.fn(),
    };
  });

  it('按 slug 读静态档渲染，不触发 读取公开企业', () => {
    渲染('pingcap');
    expect(mock取公司档案).toHaveBeenCalledWith('pingcap');
    expect(screen.getByText('公司自述')).toBeTruthy();
    expect(screen.getByText('做可靠的技术产品')).toBeTruthy();
    expect(mock读取公开企业).not.toHaveBeenCalled();
  });
});
