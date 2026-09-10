// 企业详情：Backend canonical public company page 与 Mock 静态档共用的连接层测试。
// route param 仅当 opaque organization_id：进入调 操作.读取公开企业(id)，缓存 DTO 经
// 从BFF公开企业() 投影后交给共用的 企业公开页展示 渲染。不调 公司路由键()/取公司档案()；
// 404/suspended/网络错误都进诚实空态，无 Mock 回退、无 unhandled rejection。
// Mock 分支继续按原 slug 渲染静态档 + 自述覆盖，两条成功路径 return 同一个展示。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 企业详情 from './企业详情';
import { BFF公开企业样本, BFF企业档案样本 } from '../测试/BFF样本';
import type { BFF公开企业 } from '../数据/BFF契约';

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

/** 合法「全空」公开档案：closed 枚举含 ''，列表允许空 —— 缺字段不是读取失败 */
const 空公开企业样本: BFF公开企业 = {
  ...BFF公开企业样本,
  active_verified_job_count: 0,
  profile: {
    ...BFF企业档案样本,
    industry: null,
    company_size: '',
    funding_stage: '',
    office_address: '',
    benefit_codes: [],
    work_schedule: '',
    company_intro: '',
    business_items: [],
    product_intro: '',
    team_members: [],
    logo: null,
    office_media: [],
    company_media: [],
  },
};

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

  it('缓存 DTO 经 从BFF公开企业 渲染：身份/公开媒体/在招数，契约没有的分区显示未知占位', async () => {
    置Backend({ org_9: BFF公开企业样本 });
    const { container } = 渲染();
    await waitFor(() => expect(screen.getByText('做可靠的技术产品')).toBeTruthy());
    // legal/display identity 与 verified_at：必需身份字段原样，不用占位掩盖
    expect(screen.getByText('上海云衢科技有限公司')).toBeTruthy();
    expect(screen.getAllByText('云衢科技').length).toBeGreaterThan(0);
    expect(screen.getByText('2026-08-24')).toBeTruthy();
    // 公开契约没有的分区：出现明确占位，而不是整块消失或拿静态档补
    expect(screen.getByText('在职者反馈未知')).toBeTruthy();
    expect(screen.getByText('工商资料未知')).toBeTruthy();
    // public media 与 active verified job count（身份区 + 底部不可用说明各一次）
    expect(
      container.querySelector('img[src="https://cdn.example.com/org_1/media_1.png"]'),
    ).not.toBeNull();
    expect(screen.getAllByText('2 个已核验在招岗位').length).toBe(2);
    expect(screen.getByText('岗位列表暂不可用')).toBeTruthy();
    // 没有岗位列表能力：不提供可点开的假入口
    expect(screen.queryByRole('button', { name: /看这家在招的/ })).toBeNull();
    expect(mock取公司档案).not.toHaveBeenCalled();
  });

  it('产品/团队在全文层完整可达，福利标签在条款层且不带已核标记', async () => {
    置Backend({ org_9: BFF公开企业样本 });
    const 用户 = userEvent.setup();
    渲染();
    await waitFor(() => expect(screen.getByText('做可靠的技术产品')).toBeTruthy());
    await 用户.click(screen.getByRole('button', { name: '读全文 ›' }));
    // 文化/历程在全文层里也有明确占位（公开契约没有这两段），产品/团队完整可达
    expect(screen.getByText('企业文化未知')).toBeTruthy();
    expect(screen.getByText('发展历程未知')).toBeTruthy();
    expect(screen.getByText('产品介绍')).toBeTruthy();
    expect(screen.getByText('AI 简历助手')).toBeTruthy();
    expect(screen.getByText('团队介绍')).toBeTruthy();
    expect(screen.getByText('林澈')).toBeTruthy();
    expect(screen.getByText('招聘负责人')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '关闭' }));
    await 用户.click(screen.getByText('作息与条款'));
    expect(screen.getByText('五险一金')).toBeTruthy();
    expect(screen.getByText('股票期权')).toBeTruthy();
    // 接口没有代理核对结果：显示未知，不写 0 条已核来宣称已完成检查
    expect(screen.getByText('代理核对信息未知')).toBeTruthy();
    expect(screen.queryByText(/条已由代理核对/)).toBeNull();
  });

  it('合法空档案不是请求失败：渲染成功占位页，真实 0 保留，不落诚实空态', async () => {
    置Backend({ org_9: 空公开企业样本 });
    渲染();
    await waitFor(() => expect(screen.getByText('公司简介未知')).toBeTruthy());
    expect(screen.queryByText('这家企业暂时打不开')).toBeNull();
    expect(screen.getByText('融资阶段未知 · 公司规模未知 · 行业未知')).toBeTruthy();
    expect(screen.getByText('主营业务未知')).toBeTruthy();
    expect(screen.getByText('公司相册未知')).toBeTruthy();
    expect(screen.getByText('福利信息未知')).toBeTruthy();
    expect(screen.getByText('作息信息未知')).toBeTruthy();
    expect(screen.getByText('办公地址未知')).toBeTruthy();
    expect(screen.getAllByText('0 个已核验在招岗位').length).toBe(2);
    // 必需身份字段不因其他分区缺失而消失
    expect(screen.getByText('上海云衢科技有限公司')).toBeTruthy();
    expect(screen.getByText('2026-08-24')).toBeTruthy();
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
    expect(screen.getByText('法定名称未知')).toBeTruthy();
    expect(screen.getByText('看这家在招的 3 个岗位')).toBeTruthy();
    expect(mock读取公开企业).not.toHaveBeenCalled();
  });
});
