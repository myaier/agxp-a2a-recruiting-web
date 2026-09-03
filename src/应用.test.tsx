// 应用路由守卫测试（P0 修复 Task 2）：Backend 招聘方的落点只由两个水合阶段决定 ——
// 组织链聚合阶段报 成功 之后才解释 profile 阶段，缺失 → 注册流名片，成功 → 企业主壳；
// 组织链失败在受保护路径上换成恢复面（真实错误 + 重试 + 切换身份），绝不显示假空列表。
//
// 屏幕一律换成轻量桩：本文件只钉 应用.tsx 自己的守卫与导航决策，不把各屏的数据依赖
// 拖进路由用例（各屏行为由各自的测试覆盖）。

import { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BFF主体样本 } from './测试/BFF样本';
import { 初始状态 } from './状态/初始状态';
import { 路径 } from './路由/路径表';
import { 创建空候选预填状态, type 候选预填状态 } from './状态/后端/类型';
import type { 后端状态 } from './状态/后端/类型';
import { 创建空P4发现状态 } from './状态/后端/发现推荐操作';
import { 创建空P5MatchCase状态 } from './状态/后端/MatchCase操作';
import { 创建空P7会话状态 } from './状态/后端/真人会话操作';
import { 创建空P8控制面状态 } from './状态/后端/P8控制面操作';
import 应用 from './应用';
import 通用样式 from './组件/通用.module.css';

const mock应用状态 = vi.hoisted(() => vi.fn());
vi.mock('./状态/应用状态', () => ({ use应用状态: mock应用状态 }));

/** 路由落点桩：只证明「路由到了这一屏」，不带屏自身的数据依赖。 */
function 屏幕桩(名: string) {
  return { default: () => <div data-testid={`屏幕:${名}`}>{名}</div> };
}
vi.mock('./屏幕/登录', () => 屏幕桩('登录'));
vi.mock('./屏幕/选身份', () => 屏幕桩('选身份'));
vi.mock('./屏幕/主壳', () => 屏幕桩('主壳'));
vi.mock('./屏幕/企业主壳', () => 屏幕桩('企业主壳'));
vi.mock('./屏幕/招聘名片', () => 屏幕桩('招聘名片'));
vi.mock('./屏幕/企业实名认证', () => 屏幕桩('企业实名认证'));
vi.mock('./屏幕/企业组织申请', () => 屏幕桩('企业组织申请'));
vi.mock('./屏幕/企业邀请加入', () => 屏幕桩('企业邀请加入'));
vi.mock('./屏幕/账号安全', () => 屏幕桩('账号安全'));
// Task 7：候选 onboarding 消费页与注册流经过页换成同款桩 —— 本组用例只钉
// 边界接线与位置清理决策，各屏自身行为由各自的测试覆盖。
vi.mock('./屏幕/基本信息', () => 屏幕桩('基本信息'));
vi.mock('./屏幕/工作经历', () => 屏幕桩('工作经历'));
vi.mock('./屏幕/引导问答', () => 屏幕桩('引导问答'));
vi.mock('./屏幕/求职状态', () => 屏幕桩('求职状态'));
vi.mock('./屏幕/最高学历', () => 屏幕桩('最高学历'));
vi.mock('./屏幕/毕业院校', () => 屏幕桩('毕业院校'));
vi.mock('./屏幕/选专业', () => 屏幕桩('选专业'));
vi.mock('./屏幕/就读时间段', () => 屏幕桩('就读时间段'));
vi.mock('./屏幕/添加头像', () => 屏幕桩('添加头像'));
vi.mock('./屏幕/披露说明', () => 屏幕桩('披露说明'));
vi.mock('./屏幕/选工作城市', () => 屏幕桩('选工作城市'));
vi.mock('./屏幕/选期望职位', () => 屏幕桩('选期望职位'));
vi.mock('./屏幕/设置', () => 屏幕桩('设置'));
// 岗位管理桩保留它的「发布新岗位」入口：恢复面接管时这个按钮必须整个不存在
vi.mock('./屏幕/岗位管理', () => ({
  default: () => (
    <div data-testid="屏幕:岗位管理">
      <button type="button">发布新岗位</button>
    </div>
  ),
}));

const 招聘主体 = { ...BFF主体样本, last_used_role: 'recruiter' as const };

function 建后端状态(覆盖: Partial<后端状态> = {}): 后端状态 {
  return {
    初始化: '进行中', 已登录: false, 主体: null, 简历快照: null, 意向快照: {}, 岗位快照: {},
    隐私快照: null,
    候选规则快照: {}, 招聘规则快照: {}, 候选规则提案: {}, 招聘规则提案: {},
    Agent规则水合: {
      candidate: { rules: '未开始', proposals: '未开始' },
      recruiter: { rules: '未开始', proposals: '未开始' },
    },
    ...创建空P4发现状态(),
    ...创建空P5MatchCase状态(),
    ...创建空P7会话状态(),
    ...创建空P8控制面状态(),
    附件简历库: null,
    招聘方档案水合阶段: '未开始',
    招聘方组织水合: { 阶段: '未开始', 错误: null },
    ...覆盖,
  };
}

/**
 * Backend 模式的上下文值。屏幕已全部换成桩，应用 自身只消费
 * 操作.重新水合招聘方数据 与 Task 7 的候选预填恢复/清理；方法都显式给出，用例可整体替换 操作。
 */
function 后端应用值(后端覆盖: Partial<后端状态> = {}) {
  return {
    状态: 初始状态,
    派发: vi.fn(),
    数据源模式: 'backend' as const,
    后端状态: 建后端状态(后端覆盖),
    操作: {
      重新水合招聘方组织: vi.fn(async () => undefined),
      重新水合招聘方数据: vi.fn(async () => undefined),
      恢复候选Onboarding预填: vi.fn(async () => undefined),
      清候选Onboarding预填: vi.fn(),
    },
    目录查询: null,
  };
}

/** Task 7 用：候选 onboarding 会话的上下文值（已登录 candidate + 已水合附件库）。 */
const 候选主体 = { ...BFF主体样本, last_used_role: 'candidate' as const };
const 附件limits = {
  max_files: 3,
  max_file_bytes: 2 * 1024 * 1024,
  accepted_media_types: ['application/pdf'] as ['application/pdf'],
};

function 候选后端应用值(覆盖: Partial<后端状态> = {}) {
  return 后端应用值({
    初始化: '完成',
    已登录: true,
    主体: 候选主体,
    附件简历库: { items: [], limits: 附件limits },
    ...覆盖,
  });
}

/** Task 7 用：已绑定 source 的 ready 内存轮（非 pristine，边界零恢复调用）。 */
function ready预填轮(): 候选预填状态 {
  return {
    ...创建空候选预填状态(2),
    phase: 'ready',
    source: { file_id: 'rf_0123456789abcdef0123456789abcdef', version_id: 'rfv_0123456789abcdef0123456789abcdef', parse_id: 'rp_0123456789abcdef0123456789abcdef' },
  };
}

/** 标准 deferred helper：手动控制一次恢复的结算时机。 */
function 可控Promise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function 位置探针() {
  const 位置 = useLocation();
  return <span data-testid="pathname">{位置.pathname}</span>;
}

function 位置与状态探针() {
  const 位置 = useLocation();
  return (
    <>
      <span data-testid="pathname">{位置.pathname}</span>
      <span data-testid="location-state">{JSON.stringify(位置.state ?? null)}</span>
    </>
  );
}

/** 仓库未装 @testing-library/jest-dom：断言直接读 textContent / disabled。 */
function 当前路径(): string {
  return screen.getByTestId('pathname').textContent ?? '';
}

describe('应用路由：招聘方水合阶段决定落点', () => {
  beforeEach(() => {
    mock应用状态.mockReset();
  });

  it.each([
    ['缺失', 路径.招聘名片],
    ['成功', 路径.企业主壳],
  ] as const)('恢复 recruiter 且 profile %s 时进入 %s', async (阶段, 期望) => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成',
      已登录: true,
      主体: 招聘主体,
      招聘方档案水合阶段: 阶段,
      招聘方组织水合: { 阶段: '成功', 错误: null },
    }));
    render(
      <MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(期望));
  });

  it('组织水合失败在登录路径显示真实错误和重试入口', async () => {
    const 重试 = vi.fn(async () => undefined);
    const 用户 = userEvent.setup();
    const 值 = 后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,
      招聘方档案水合阶段: '失败',
      招聘方组织水合: { 阶段: '失败', 错误: '企业资料读取失败' },
    });
    mock应用状态.mockReturnValue({
      ...值,
      操作: { ...值.操作, 重新水合招聘方数据: 重试 },
    });
    render(
      <MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>,
    );
    expect(当前路径()).toBe(路径.登录);
    expect(screen.getByRole('alert').textContent).toContain('企业资料读取失败');

    // 重试只钉「调用一次」：重新水合招聘方数据 在第一个 await 之前就同步写下
    // 初始化='进行中'，恢复面随即让位给 路由加载中 —— 真实运行里 重试中 的
    // 禁用态在本面上根本观察不到（失败后是一块**新**的恢复面重新挂载）。
    // 这里的 mock 初始化 恒为 完成，任何 disabled 迁移断言都只是在复述冻结的 mock。
    await 用户.click(screen.getByRole('button', { name: '重试' }));
    expect(重试).toHaveBeenCalledTimes(1);

    // 退出口不依赖重试结果：切换身份 始终把人送回身份选择，不会被锁在恢复面
    await 用户.click(screen.getByRole('button', { name: '切换身份' }));
    expect(当前路径()).toBe(路径.选身份);
  });

  // review-final 修复 2：恢复面 return 掉整个路由，它就是 设备外框 里的一整屏。
  // 旧实现是没有页底、没有安全区、按钮走浏览器默认样式（全局 reset 后等于一行裸文字）
  // 的裸块，读起来像应用崩了而不是一次可重试的失败。这里钉住外壳与主按钮，
  // 免得以后又被改回裸 <div>。
  it('恢复面渲染成带页底与安全区的整屏，重试走主按钮', () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,
      招聘方组织水合: { 阶段: '失败', 错误: '企业资料读取失败' },
    }));
    render(
      <MemoryRouter initialEntries={[路径.岗位管理]}><应用 /><位置探针 /></MemoryRouter>,
    );
    const 面 = screen.getByRole('alert');
    expect(面.style.height).toBe('100%');
    expect(面.style.background).toContain('--页面底');
    expect(面.style.paddingTop).toContain('--安全区上');
    expect(screen.getByRole('button', { name: '重试' }).className).toContain(通用样式.主按钮);
  });

  // 初始化='进行中' 由 重新水合招聘方数据 在第一个 await 之前同步写下，恢复面当场
  // 让位给加载屏 —— 「重试中…」这个标签在真实运行里永远渲染不出来，是死文案。
  it('重试后不出现不可达的「重试中…」文案', async () => {
    const 用户 = userEvent.setup();
    let 放行: () => void = () => {};
    const 重试 = vi.fn(() => new Promise<void>((resolve) => { 放行 = () => resolve(); }));
    const 值 = 后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,
      招聘方组织水合: { 阶段: '失败', 错误: '企业资料读取失败' },
    });
    mock应用状态.mockReturnValue({ ...值, 操作: { ...值.操作, 重新水合招聘方数据: 重试 } });
    render(
      <MemoryRouter initialEntries={[路径.岗位管理]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: '重试' }));
    expect(screen.queryByText('重试中…')).toBeNull();
    // 重入守卫仍在：飞行中再点一次不会重复触发水合
    await 用户.click(screen.getByRole('button', { name: '重试' }));
    expect(重试).toHaveBeenCalledTimes(1);
    放行();
  });

  it('组织水合失败时直接岗位路径显示恢复面而不是假空列表', () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,
      招聘方组织水合: { 阶段: '失败', 错误: '企业资料读取失败' },
    }));
    render(
      <MemoryRouter initialEntries={[路径.岗位管理]}><应用 /><位置探针 /></MemoryRouter>,
    );
    expect(screen.getByRole('alert').textContent).toContain('企业资料读取失败');
    expect(screen.queryByRole('button', { name: '发布新岗位' })).toBeNull();
  });

  // 聚合阶段闸门的回归：profile 已判定 缺失、但组织链随后失败时，缺失 绝不能被
  // 当成 onboarding —— 去掉 应用.tsx 里「组织水合.阶段 === '成功' 才解释 profile 阶段」
  // 这一句，用户会被 replace 到 /hr/card（恢复面在那条路径上不设防），真实错误就此消失。
  it('profile 缺失但组织链失败时留在恢复面，不被伪装成注册流', () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,
      招聘方档案水合阶段: '缺失',
      招聘方组织水合: { 阶段: '失败', 错误: '企业资料读取失败' },
    }));
    render(
      <MemoryRouter initialEntries={[路径.岗位管理]}><应用 /><位置探针 /></MemoryRouter>,
    );
    expect(当前路径()).toBe(路径.岗位管理);
    expect(screen.getByRole('alert').textContent).toContain('企业资料读取失败');
    expect(screen.queryByTestId('屏幕:招聘名片')).toBeNull();
  });

  it('直接打开招聘端且 profile 缺失时 replace 到注册流名片', async () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,
      招聘方档案水合阶段: '缺失',
      招聘方组织水合: { 阶段: '成功', 错误: null },
    }));
    render(
      <MemoryRouter initialEntries={[路径.岗位管理]}><应用 /><位置与状态探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.招聘名片));
    expect(screen.getByTestId('location-state').textContent).toContain('从注册流');
  });

  it('已有 profile 直接编辑招聘名片时不被改送企业主壳', () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,
      招聘方档案水合阶段: '成功',
      招聘方组织水合: { 阶段: '成功', 错误: null },
    }));
    render(
      <MemoryRouter initialEntries={[路径.招聘名片]}><应用 /><位置探针 /></MemoryRouter>,
    );
    expect(当前路径()).toBe(路径.招聘名片);
  });

  it.each([
    路径.账号安全,
    路径.选身份,
    路径.招聘名片,
    路径.企业实名认证,
    路径.企业组织申请,
    路径.企业邀请加入,
  ])('缺失 profile 时放行恢复与退出路径 %s', (路径值) => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,
      招聘方档案水合阶段: '缺失',
      招聘方组织水合: { 阶段: '成功', 错误: null },
    }));
    render(
      <MemoryRouter initialEntries={[路径值]}><应用 /><位置探针 /></MemoryRouter>,
    );
    expect(当前路径()).toBe(路径值);
  });

  it('未知或缺失 last_used_role 保持现有身份选择兜底', async () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true,
      主体: { ...招聘主体, last_used_role: null },
    }));
    render(
      <MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.选身份));
  });

  it('candidate 仍从登录路径落到求职主壳', async () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true,
      主体: { ...BFF主体样本, last_used_role: 'candidate' as const },
    }));
    render(
      <MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.主壳));
  });

  // P0 修复 Task 3：登录页不再自己导航后，candidate 的落点只由这里的守卫提交一次 ——
  // 水合态从「未登录」翻到「已登录」时 replace 恰好一次，守卫重跑不得重复前往。
  it('candidate 只在水合后登录态提交时 replace 一次', async () => {
    const 路径记录 = vi.fn();
    function 路径记录探针() {
      const 位置 = useLocation();
      useEffect(() => { 路径记录(位置.pathname); }, [位置.pathname]);
      return <span data-testid="pathname">{位置.pathname}</span>;
    }
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: false, 主体: null,
    }));
    const 树 = () => (
      <MemoryRouter initialEntries={[路径.登录]}>
        <应用 />
        <路径记录探针 />
      </MemoryRouter>
    );
    const { rerender } = render(树());
    expect(screen.getByTestId('pathname').textContent).toBe(路径.登录);

    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true,
      主体: { ...BFF主体样本, last_used_role: 'candidate' },
    }));
    rerender(树());
    await waitFor(() => expect(screen.getByTestId('pathname').textContent).toBe(路径.主壳));
    expect(路径记录.mock.calls.filter(([值]) => 值 === 路径.主壳)).toHaveLength(1);
  });
});

describe('应用路由：候选 onboarding 预填恢复与退出清理（Task 7）', () => {
  beforeEach(() => {
    mock应用状态.mockReset();
  });

  it('消费页在恢复在途时只渲染既有 路由加载中，结算后再挂表单屏', async () => {
    const 门 = 可控Promise<void>();
    const 恢复 = vi.fn().mockReturnValue(门.promise);
    const 值 = 候选后端应用值();
    mock应用状态.mockReturnValue({
      ...值,
      操作: { ...值.操作, 恢复候选Onboarding预填: 恢复 },
    });
    render(
      <MemoryRouter initialEntries={[路径.基本信息]}><应用 /></MemoryRouter>,
    );
    // 懒加载屏幕经 Suspense 落定、边界挂载后恢复才发起；此后加载屏必须一直占位
    await waitFor(() => expect(恢复).toHaveBeenCalledWith({ 允许等待解析: false }));
    expect(screen.getByText('正在加载…')).toBeTruthy();
    expect(screen.queryByTestId('屏幕:基本信息')).toBeNull();
    门.resolve();
    await waitFor(() => expect(screen.getByTestId('屏幕:基本信息')).toBeTruthy());
  });

  it('内存 ready 轮的消费页直接挂载：零恢复调用', async () => {
    const 值 = 候选后端应用值({ 候选预填状态: ready预填轮() });
    mock应用状态.mockReturnValue(值);
    render(
      <MemoryRouter initialEntries={[路径.基本信息]}><应用 /></MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('屏幕:基本信息')).toBeTruthy());
    expect(值.操作.恢复候选Onboarding预填).not.toHaveBeenCalled();
    expect(值.操作.清候选Onboarding预填).not.toHaveBeenCalled();
  });

  it('进入主壳时清理候选预填轮，同屏重渲染不重复清', async () => {
    const 值 = 候选后端应用值({ 候选预填状态: ready预填轮() });
    mock应用状态.mockReturnValue(值);
    const 树 = () => (
      <MemoryRouter initialEntries={[路径.主壳]}><应用 /></MemoryRouter>
    );
    const { rerender } = render(树());
    await waitFor(() => expect(screen.getByTestId('屏幕:主壳')).toBeTruthy());
    await waitFor(() => expect(值.操作.清候选Onboarding预填).toHaveBeenCalledTimes(1));
    rerender(树());
    expect(值.操作.清候选Onboarding预填).toHaveBeenCalledTimes(1);
  });

  it('进入其它产品路由同样清理（离开注册会话即作废旧轮）', async () => {
    const 值 = 候选后端应用值({ 候选预填状态: ready预填轮() });
    mock应用状态.mockReturnValue(值);
    render(
      <MemoryRouter initialEntries={[路径.设置]}><应用 /></MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('屏幕:设置')).toBeTruthy());
    await waitFor(() => expect(值.操作.清候选Onboarding预填).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['薪资段', 路径.引导问答薪资段, '屏幕:引导问答'],
    ['求职状态', 路径.求职状态, '屏幕:求职状态'],
    ['披露说明', 路径.披露说明, '屏幕:披露说明'],
    ['城市子页', 路径.选工作城市, '屏幕:选工作城市'],
    ['职位子页', 路径.选期望职位, '屏幕:选期望职位'],
    ['头像页', 路径.添加头像, '屏幕:添加头像'],
  ] as const)('注册流经过 %s只保状态：零恢复、零清理', async (_名, 站, testid) => {
    const 值 = 候选后端应用值({ 候选预填状态: ready预填轮() });
    mock应用状态.mockReturnValue(值);
    render(
      <MemoryRouter initialEntries={[站]}><应用 /></MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId(testid)).toBeTruthy());
    expect(值.操作.恢复候选Onboarding预填).not.toHaveBeenCalled();
    expect(值.操作.清候选Onboarding预填).not.toHaveBeenCalled();
  });

  it.each([
    [路径.基本信息, '屏幕:基本信息'],
    [路径.工作经历, '屏幕:工作经历'],
    [路径.引导问答, '屏幕:引导问答'],
    [路径.引导问答薪资段, '屏幕:引导问答'],
    [路径.最高学历, '屏幕:最高学历'],
    [路径.毕业院校, '屏幕:毕业院校'],
    [路径.选专业, '屏幕:选专业'],
    [路径.就读时间段, '屏幕:就读时间段'],
    [路径.添加头像, '屏幕:添加头像'],
  ] as const)('路由表映射与顺序未变：%s 仍落在原屏', async (站, testid) => {
    mock应用状态.mockReturnValue(候选后端应用值({ 候选预填状态: ready预填轮() }));
    render(
      <MemoryRouter initialEntries={[站]}><应用 /></MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId(testid)).toBeTruthy());
  });

  it('边界不引入任何包裹 DOM：屏幕节点直接挂在容器下', async () => {
    mock应用状态.mockReturnValue(候选后端应用值({ 候选预填状态: ready预填轮() }));
    const { container } = render(
      <MemoryRouter initialEntries={[路径.基本信息]}><应用 /></MemoryRouter>,
    );
    const 屏幕 = await waitFor(() => screen.getByTestId('屏幕:基本信息'));
    expect(屏幕.parentElement).toBe(container);
  });

  it('未登录或非候选会话不触发位置清理（等水合，不烧恢复元数据）', async () => {
    const 值 = 后端应用值({ 初始化: '完成', 已登录: true, 主体: 招聘主体 });
    mock应用状态.mockReturnValue(值);
    render(
      <MemoryRouter initialEntries={[路径.主壳]}><应用 /></MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('屏幕:主壳')).toBeTruthy());
    expect(值.操作.清候选Onboarding预填).not.toHaveBeenCalled();
  });
});
