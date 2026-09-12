// 添加意向页 Backend 提交测试（Task 7）：
// 保存意向成功后才返回，失败复用轻提示。
// Mock 下 操作 内部同步 dispatch，DOM/流程由现有 onboarding E2E 覆盖。
//
// 办公方式必填校验（truthfulness Task 1）：保存键不再因缺字段置灰 ——
// 点保存走 校验必填，按 工作城市 → 期望职位 → 办公方式 顺序轻提示，
// 办公方式那组还要 scrollIntoView + 聚焦首个选钮 + aria-invalid/aria-description。
// 新建（/intentions/new）与编辑（/intentions/:id）两条路由都要可达，所以 it.each 双跑。
// 轻提示 是纯 DOM 单例组件，这里 mock 掉既不碰真实组件也能断言文案。

import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFFOwnerIntention } from '../数据/BFF契约';
import type { 意向草稿型 } from '../数据/招聘数据源类型';
import { 转意向写入 } from '../数据/后端映射';
import { 归约候选资料 } from '../状态/领域/候选资料';
import { 初始状态 } from '../状态/初始状态';
import { BFF意向样本 } from '../测试/BFF样本';
import 添加意向 from './添加意向';

const mock返回 = vi.fn();
const mock跳转 = vi.fn();
const mock保存意向 = vi.fn();
const mock删除意向 = vi.fn();
const mock派发 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());

vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => undefined;
}

const 基础草稿: 意向草稿型 = {
  编辑编号: null,
  求职类型: '全职',
  工作城市: '上海',
  期望职位: '产品经理',
  感兴趣城市们: [],
  薪资下限: 10,
  薪资上限: 20,
  期望行业们: [],
  办公方式: ['混合'],
  后端招聘类型: null,
  求职类型已改: false,
};

let 当前草稿: 意向草稿型 = { ...基础草稿, 办公方式: [...基础草稿.办公方式] };
// E0：Backend route gate 需要的可变桩（数据源模式 + 后端意向字典）；Mock 用例保持缺席
let mock数据源模式: 'backend' | undefined;
let mock状态扩展: Record<string, unknown> = {};

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }) }));
// 真实归约路径（core editors §6.2 Task 2）：组件渲染时登记一个 setState 通知器，
// 真实 reducer 归约后回调它触发重渲染，下一次 render 才能读到新草稿 —— 与真实
// Provider 的「派发→重渲染」时序一致；不登记时保持原有单次渲染行为（零干扰）。
let 通知重渲染: (() => void) | null = null;

vi.mock('../状态/应用状态', () => ({
  use应用状态: () => {
    const [, 设渲染序号] = useState(0);
    通知重渲染 = () => 设渲染序号((序) => 序 + 1);
    return {
      状态: { 意向草稿: 当前草稿, ...mock状态扩展 },
      派发: mock派发,
      操作: { 保存意向: mock保存意向, 删除意向: mock删除意向 },
      数据源模式: mock数据源模式,
    };
  },
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** 新建 / 编辑两条路由都挂在同一屏组件下，测试里按 path 选入口 */
function 渲染意向(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/intentions/new" element={<添加意向 />} />
        <Route path="/intentions/:id" element={<添加意向 />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── E0：Backend 无效意向编辑不能变成新增 ──
describe('添加意向页 Backend 无效编辑坐标', () => {
  beforeEach(() => {
    当前草稿 = { ...基础草稿, 办公方式: [...基础草稿.办公方式] };
    mock返回.mockClear();
    mock跳转.mockClear();
    mock保存意向.mockClear();
    mock删除意向.mockClear();
    mock派发.mockClear();
    mock轻提示.mockClear();
    mock数据源模式 = 'backend';
    // 字典里只有 active 的 int_1；archived / missing / other_subject 一律未命中
    mock状态扩展 = {
      后端意向服务端: {
        int_1: BFF意向样本,
        int_archived: { ...BFF意向样本, intention_id: 'int_archived', status: 'archived' as const },
      },
      求职意向表: [],
    };
  });

  it.each(['missing', 'archived', 'other_subject'])(
    'Backend 无效意向 %s 不打开空草稿',
    (id) => {
      渲染意向(`/intentions/${id}`);
      expect(screen.getByText('这条求职意向不存在或已不可编辑')).toBeTruthy();
      expect(screen.queryByRole('button', { name: '保存' })).toBeNull();
      expect(mock保存意向).not.toHaveBeenCalled();
      expect(mock派发).not.toHaveBeenCalledWith(
        expect.objectContaining({ 型: '开意向草稿' }),
      );
    },
  );

  it('有效 active ID 正常打开编辑表单并可保存', async () => {
    mock保存意向.mockResolvedValue(undefined);
    渲染意向('/intentions/int_1');
    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock保存意向).toHaveBeenCalled());
  });

  it('/intentions/new 不受 Backend gate 影响，仍可新建保存', async () => {
    mock保存意向.mockResolvedValue(undefined);
    渲染意向('/intentions/new');
    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock保存意向).toHaveBeenCalled());
  });
});

describe('添加意向页 Backend 提交', () => {
  beforeEach(() => {
    当前草稿 = { ...基础草稿, 办公方式: [...基础草稿.办公方式] };
    mock返回.mockClear();
    mock保存意向.mockClear();
    mock删除意向.mockClear();
    mock派发.mockClear();
    mock轻提示.mockClear();
    mock数据源模式 = undefined;
    mock状态扩展 = {};
  });

  it('保存 Backend 意向成功后才返回，失败复用轻提示', async () => {
    const 完成 = deferred<void>();
    mock保存意向.mockReturnValue(完成.promise);
    渲染意向('/intentions/new');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(mock返回).not.toHaveBeenCalled();
    完成.resolve();
    await waitFor(() => expect(mock返回).toHaveBeenCalled());
  });
});

describe('添加意向页 办公方式必填校验', () => {
  beforeEach(() => {
    当前草稿 = { ...基础草稿, 办公方式: [...基础草稿.办公方式] };
    mock返回.mockClear();
    mock保存意向.mockClear();
    mock删除意向.mockClear();
    mock派发.mockClear();
    mock轻提示.mockClear();
    mock数据源模式 = undefined;
    mock状态扩展 = {};
  });

  it.each([
    ['/intentions/new', null],
    ['/intentions/int_1', 'int_1'],
  ])('办公方式为空时 %s 可点击保存、提示并聚焦，且零 mutation', async (path, 编辑编号) => {
    当前草稿 = { ...基础草稿, 编辑编号, 办公方式: [] };
    const user = userEvent.setup();
    渲染意向(path);

    const 保存 = screen.getByRole('button', { name: '保存' });
    expect((保存 as HTMLButtonElement).disabled).toBe(false);
    await user.click(保存);

    expect(mock轻提示).toHaveBeenCalledWith('请选择办公方式');
    expect(mock保存意向).not.toHaveBeenCalled();
    const 组 = screen.getByRole('group', { name: '办公方式' });
    expect(组.getAttribute('aria-invalid')).toBe('true');
    expect(组.getAttribute('aria-description')).toBe('请选择办公方式');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '现场' }));
  });

  it('选择任一办公方式立即清除 invalid 状态', async () => {
    当前草稿 = { ...基础草稿, 办公方式: [] };
    const user = userEvent.setup();
    渲染意向('/intentions/new');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await user.click(screen.getByRole('button', { name: '远程' }));
    const 组 = screen.getByRole('group', { name: '办公方式' });
    expect(组.getAttribute('aria-invalid')).toBeNull();
    expect(组.getAttribute('aria-description')).toBeNull();
  });
});

describe('四类型与原引导排除接入', () => {
  beforeEach(() => {
    当前草稿 = { ...基础草稿 };
    mock数据源模式 = undefined;
    mock状态扩展 = {};
    vi.clearAllMocks();
  });
  it.each(['社招全职', '校园招聘', '实习生', '兼职'])('展示并接入类型%s', async 名称 => {
    渲染意向('/intentions/new');
    await userEvent.click(screen.getByRole('button', { name: 名称 }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '改意向草稿', 补丁: { 求职类型: 名称 === '社招全职' ? '全职' : 名称 } });
  });
  it('校园毕业月必填，完成滚轮才写值', async () => {
    当前草稿 = { ...基础草稿, 求职类型: '校园招聘' };
    渲染意向('/intentions/new');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(mock轻提示).toHaveBeenCalledWith('请填写预计毕业时间');
    expect(mock保存意向).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /预计毕业年月/ }));
    expect(mock派发).not.toHaveBeenCalledWith(expect.objectContaining({ 补丁: expect.objectContaining({ 毕业时间: expect.any(String) }) }));
    await userEvent.click(screen.getByRole('button', { name: '完成' }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '改意向草稿', 补丁: { 毕业时间: `${new Date().getFullYear() + 1}-06` } });
  });
  it('实习时间必填并显示日薪；选项分别写草稿', async () => {
    当前草稿 = { ...基础草稿, 求职类型: '实习生' };
    渲染意向('/intentions/new');
    expect(screen.getByText('薪资要求（日薪 · 元/天）')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(mock保存意向).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '至少 3 个月' }));
    await userEvent.click(screen.getByRole('button', { name: '每周 4 天' }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '改意向草稿', 补丁: { 实习月数: 3 } });
    expect(mock派发).toHaveBeenCalledWith({ 型: '改意向草稿', 补丁: { 每周到岗天数: 4 } });
  });
  it('兼职保持月薪、无副标题和屏蔽公司；合并外包项正确映射', async () => {
    当前草稿 = { ...基础草稿, 求职类型: '兼职' };
    渲染意向('/intentions/new');
    expect(screen.getByText('薪资要求（月薪 · K）')).toBeTruthy();
    expect(screen.queryByText('屏蔽公司')).toBeNull();
    expect(screen.queryByText('求职期望的不同，推荐的职位也会不同')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '纯外包 / 乙方' }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '改意向草稿', 补丁: { 排除项: { alternate_weekend_work: 'unspecified', outsourcing_only: 'excluded', onsite_only: 'unspecified', frequent_travel: 'unspecified' } } });
  });
  it('新增自定义保留历史原文；重复或空白添加均清空输入且不派发修改', async () => {
    当前草稿 = { ...基础草稿, 私有偏好: '\n历史原文  \n不加班' };
    渲染意向('/intentions/new');
    const 输入 = screen.getByPlaceholderText('用你自己的话写') as HTMLInputElement;
    await userEvent.type(输入, '不加班');
    await userEvent.click(screen.getByRole('button', { name: '添加' }));
    expect(输入.value).toBe('');
    expect(mock派发).not.toHaveBeenCalled();
    await userEvent.type(输入, '   ');
    await userEvent.click(screen.getByRole('button', { name: '添加' }));
    expect(输入.value).toBe('');
    expect(mock派发).not.toHaveBeenCalled();
    await userEvent.type(输入, '不出差');
    await userEvent.click(screen.getByRole('button', { name: '添加' }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '改意向草稿', 补丁: { 私有偏好: '\n历史原文  \n不加班\n不出差' } });
  });
});

// ── core editors §6.2（Task 2）：跨类型年薪月数按最终类型过滤 ──
// 页面级反例走真实链路：类型选钮 / 薪资弹层 / 毕业滚轮 → 真实 归约候选资料
// （跨周期清上下限、同类型不清值的既有行为原样生效）→ 真实 转意向写入 序列化。
// 不 mock mapper、不手工构造期望草稿；保存后对落盘草稿跑真实映射断言 wire body。
describe('添加意向页 跨类型年薪月数（core editors §6.2 Task 2）', () => {
  /** 合同内合法的 14 薪社招区间来源（年薪月数只对 social_full_time/campus 合法） */
  const 原始14薪: BFFOwnerIntention = {
    ...BFF意向样本,
    intention_id: 'int_14',
    recruitment_type: 'social_full_time',
    salary_period: 'month',
    job_category: { id: 'job_pm', display_name: '产品经理' },
    primary_location: { id: 'loc_sh', display_name: '上海' },
    internship_months: null,
    onsite_days_per_week: null,
    compensation: { mode: 'range', lower: 20, upper: 30, annual_salary_months: 14 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mock数据源模式 = 'backend';
    // 真实候选域 reducer 驱动草稿：后端意向字典预置权威快照，开草稿走 从BFF意向草稿
    const 候选状态 = { ...初始状态, 后端意向服务端: { int_14: 原始14薪 }, 求职意向表: [] };
    当前草稿 = 候选状态.意向草稿;
    mock状态扩展 = { 后端意向服务端: 候选状态.后端意向服务端, 求职意向表: [] };
    mock派发.mockImplementation((动作: Parameters<typeof 归约候选资料>[1]) => {
      候选状态.意向草稿 = 归约候选资料(候选状态, 动作).意向草稿;
      当前草稿 = 候选状态.意向草稿;
      通知重渲染?.();
    });
    mock保存意向.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // 还原共享 mock：真实归约实现不得泄漏进本文件其他 describe
    mock派发.mockReset();
  });

  it('14薪社招切兼职：保留月薪区间，序列化 body 不带 annual_salary_months', async () => {
    渲染意向('/intentions/int_14');
    await waitFor(() => expect(screen.getByText('20-30K')).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: '兼职' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '兼职' }).getAttribute('aria-pressed')).toBe('true'));
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock保存意向).toHaveBeenCalled());
    const body = 转意向写入(mock保存意向.mock.calls[0][0] as 意向草稿型, { 原始: 原始14薪 });
    expect(body.recruitment_type).toBe('part_time');
    expect(body.compensation).toEqual({ mode: 'range', lower: 20, upper: 30 });
    expect(body.compensation).not.toHaveProperty('annual_salary_months');
  });

  it('14薪社招切实习并重填日薪区间：序列化 body 不带 annual_salary_months', async () => {
    渲染意向('/intentions/int_14');
    await waitFor(() => expect(screen.getByText('20-30K')).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: '实习生' }));
    // 跨周期既有行为：切型清上下限，薪资行回落占位
    await waitFor(() => expect(screen.getByText('请选择薪资要求')).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: '至少 3 个月' }));
    await userEvent.click(screen.getByRole('button', { name: '每周 4 天' }));
    // 页面真实路径重填区间：底部弹层 确定（日薪默认 150/200）
    await userEvent.click(screen.getByText('薪资要求（日薪 · 元/天）'));
    await userEvent.click(screen.getByRole('button', { name: '确定' }));
    await waitFor(() => expect(screen.getByText('150-200 元/天')).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock保存意向).toHaveBeenCalled());
    const body = 转意向写入(mock保存意向.mock.calls[0][0] as 意向草稿型, { 原始: 原始14薪 });
    expect(body.recruitment_type).toBe('internship');
    expect(body.compensation).toEqual({ mode: 'range', lower: 150, upper: 200 });
    expect(body.compensation).not.toHaveProperty('annual_salary_months');
  });

  it('14薪社招切实习且不重填区间：序列化面议精确为 { mode: negotiable }', async () => {
    渲染意向('/intentions/int_14');
    await waitFor(() => expect(screen.getByText('20-30K')).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: '实习生' }));
    await waitFor(() => expect(screen.getByText('请选择薪资要求')).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: '至少 3 个月' }));
    await userEvent.click(screen.getByRole('button', { name: '每周 4 天' }));
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock保存意向).toHaveBeenCalled());
    const body = 转意向写入(mock保存意向.mock.calls[0][0] as 意向草稿型, { 原始: 原始14薪 });
    expect(body.recruitment_type).toBe('internship');
    expect(body.compensation).toEqual({ mode: 'negotiable' });
  });

  it('切校招并填毕业月保存：合法 14 薪保留', async () => {
    渲染意向('/intentions/int_14');
    await waitFor(() => expect(screen.getByText('20-30K')).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: '校园招聘' }));
    await userEvent.click(screen.getByText('请选择毕业年月'));
    await userEvent.click(screen.getByRole('button', { name: '完成' }));
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock保存意向).toHaveBeenCalled());
    const body = 转意向写入(mock保存意向.mock.calls[0][0] as 意向草稿型, { 原始: 原始14薪 });
    expect(body.recruitment_type).toBe('campus');
    expect(body.compensation).toEqual({ mode: 'range', lower: 20, upper: 30, annual_salary_months: 14 });
  });

  it('同类型重复点击社招全职不清值：序列化仍带合法 14 薪', async () => {
    渲染意向('/intentions/int_14');
    await waitFor(() => expect(screen.getByText('20-30K')).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: '社招全职' }));
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock保存意向).toHaveBeenCalled());
    const body = 转意向写入(mock保存意向.mock.calls[0][0] as 意向草稿型, { 原始: 原始14薪 });
    expect(body.recruitment_type).toBe('social_full_time');
    expect(body.compensation.annual_salary_months).toBe(14);
  });
});
