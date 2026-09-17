// 应用路由守卫测试（P0 修复 Task 2）：Backend 招聘方的落点只由两个水合阶段决定 ——
// 组织链聚合阶段报 成功 之后才解释 profile 阶段，缺失 → 注册流名片，成功 → 企业主壳；
// 组织链失败在受保护路径上换成恢复面（真实错误 + 重试 + 切换身份），绝不显示假空列表。
//
// 屏幕一律换成轻量桩：本文件只钉 应用.tsx 自己的守卫与导航决策，不把各屏的数据依赖
// 拖进路由用例（各屏行为由各自的测试覆盖）。

import { useEffect } from 'react';
import { 创建空Onboarding状态 } from './状态/后端/Onboarding操作';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BFF主体样本, BFF简历样本 } from './测试/BFF样本';
import { BFF错误 } from './数据/HTTP客户端';
import type { BFF主体 } from './数据/BFF契约';
import { 初始状态 } from './状态/初始状态';
import { 路径 } from './路由/路径表';
import { 创建空候选预填状态, type 候选预填状态 } from './状态/后端/类型';
import type { 后端状态 } from './状态/后端/类型';
import { 创建空P4发现状态 } from './状态/后端/发现推荐操作';
import { 创建空P5MatchCase状态 } from './状态/后端/MatchCase操作';
import { 创建空P7会话状态 } from './状态/后端/真人会话操作';
import { 创建空P8控制面状态 } from './状态/后端/P8控制面操作';
import { 创建空接触记录状态 } from './状态/后端/接触记录操作';
import 应用 from './应用';
import 通用样式 from './组件/通用.module.css';

const mock应用状态 = vi.hoisted(() => vi.fn());
vi.mock('./状态/应用状态', () => ({ use应用状态: mock应用状态 }));

/** 路由落点桩：只证明「路由到了这一屏」，不带屏自身的数据依赖。 */
function 屏幕桩(名: string) {
  return { default: () => <div data-testid={`屏幕:${名}`}>{名}</div> };
}

/** 角色路由矩阵用挂载计数：被拒路由的防闪挂断言读它，不只看最终 URL。 */
const 屏幕挂载次数 = new Map<string, number>();

/** 可计数屏幕桩：落点断言之外还记录挂载次数。 */
function 可计数屏幕桩(名: string) {
  return {
    default: () => {
      屏幕挂载次数.set(名, (屏幕挂载次数.get(名) ?? 0) + 1);
      return <div data-testid={`屏幕:${名}`}>{名}</div>;
    },
  };
}
vi.mock('./屏幕/登录', () => 屏幕桩('登录'));
vi.mock('./屏幕/选身份', () => 屏幕桩('选身份'));
// J-PILOT-02 Task 9：回访落点测试会真的落到 学生分流（旅程入口），同样换桩 ——
// 本文件只钉 应用.tsx 自己的守卫与导航决策。
vi.mock('./屏幕/学生分流', () => 屏幕桩('学生分流'));
// review-r2：主壳桩可计数 —— 未完成候选的 /app 拦截断言主壳（含其挂载效应
// 加载会话列表）一次都不挂载，与角色路由防闪断言同一手法。
vi.mock('./屏幕/主壳', () => 可计数屏幕桩('主壳'));
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
// 岗位管理桩保留它的「发布新岗位」入口：恢复面接管时这个按钮必须整个不存在；
// 同时计入挂载次数，供角色路由的防闪挂断言使用
vi.mock('./屏幕/岗位管理', () => ({
  default: () => {
    屏幕挂载次数.set('岗位管理', (屏幕挂载次数.get('岗位管理') ?? 0) + 1);
    return (
      <div data-testid="屏幕:岗位管理">
        <button type="button">发布新岗位</button>
      </div>
    );
  },
}));
// 角色路由矩阵需要的其余落点桩（含 shared 路由与候选端 我的简历）
vi.mock('./屏幕/我的简历', () => 可计数屏幕桩('我的简历'));
// FE-IV-01：候选实名认证页换成可计数桩 —— recruiter 深链的防闪挂断言读它
vi.mock('./屏幕/候选实名认证', () => 可计数屏幕桩('候选实名认证'));
vi.mock('./屏幕/企业详情', () => 可计数屏幕桩('企业详情'));
vi.mock('./屏幕/帮助与客服', () => 可计数屏幕桩('帮助与客服'));
vi.mock('./屏幕/反馈', () => 可计数屏幕桩('反馈'));
vi.mock('./屏幕/用户协议', () => 可计数屏幕桩('用户协议'));

// 角色路由边界落地后，recruiter 会话必须真实拥有 active 的 recruiter 角色
//（只改 last_used_role 的旧 fixture 会被守卫正确地拒之门外）
const 招聘主体 = {
  ...BFF主体样本,
  roles: [{ role: 'recruiter' as const, status: 'active' as const }],
  last_used_role: 'recruiter' as const,
};

/** 角色路由矩阵用主体工厂：last_used_role 与两侧角色状态独立拼装。 */
function 主体(
  lastUsedRole: 'candidate' | 'recruiter' | null,
  candidate: 'active' | 'suspended' | null,
  recruiter: 'active' | 'suspended' | null,
): BFF主体 {
  return {
    ...BFF主体样本,
    last_used_role: lastUsedRole,
    roles: [
      ...(candidate === null ? [] : [{ role: 'candidate' as const, status: candidate }]),
      ...(recruiter === null ? [] : [{ role: 'recruiter' as const, status: recruiter }]),
    ],
  };
}

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
    ...创建空接触记录状态(),
    附件简历库: null,
    招聘方档案水合阶段: '未开始',
    招聘方组织水合: { 阶段: '未开始', 错误: null },
    Onboarding: 创建空Onboarding状态(),
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
      // J-PILOT-02 Task 9：注册会话内的位置记录（应用层写入，测试可断言）
      更新候选建档草稿: vi.fn(),
      // 角色路由矩阵只证明守卫不调用它（访问 URL 绝不静默切身份）
      切身份: vi.fn(async () => undefined),
      加载候选实名: vi.fn(async () => undefined),
      // J（Task 8）：canonical 详情挂载即注册范围并强制读取
      设置发现推荐范围: vi.fn(),
      读取招聘候选详情: vi.fn(async () => undefined),
    },
    目录查询: null,
  };
}

/** Task 7 用：候选 onboarding 会话的上下文值（已登录 candidate + 已水合附件库）。 */
const 候选主体 = { ...BFF主体样本, last_used_role: 'candidate' as const };
/** 角色边界回归用：Mock 模式的上下文值 —— 角色守卫完全跳过，无主体 roles 也直接挂目标屏。 */
function Mock应用值() {
  return {
    状态: 初始状态,
    派发: vi.fn(),
    数据源模式: 'mock' as const,
    后端状态: 建后端状态({ 初始化: '跳过' }),
    操作: {
      重新水合招聘方组织: vi.fn(async () => undefined),
      重新水合招聘方数据: vi.fn(async () => undefined),
      恢复候选Onboarding预填: vi.fn(async () => undefined),
      清候选Onboarding预填: vi.fn(),
      切身份: vi.fn(async () => undefined),
    },
    目录查询: null,
  };
}
const 附件limits = {
  max_files: 3,
  max_file_bytes: 2 * 1024 * 1024,
  accepted_media_types: ['application/pdf'] as ['application/pdf'],
};

function 候选后端应用值(覆盖: Partial<后端状态> = {}) {
  return 后端应用值({
    初始化: '完成',
    // 已完成老账号：Task 7/9 的候选用例默认不受分流门拦截（覆盖项按用例显式换档）
    Onboarding: Onboarding已完成('candidate'),
    已登录: true,
    主体: 候选主体,
    附件简历库: { items: [], limits: 附件limits },
    ...覆盖,
  });
}

/** stg 契约对齐：Onboarding 成功快照的两档构造（完成 / 未完成）。 */
function Onboarding已完成(角色: 'candidate' | 'recruiter'): 后端状态['Onboarding'] {
  return {
    阶段: '成功',
    数据: { roles: [{ role: 角色, status: 'active', completed_at: '2026-09-14T08:00:00Z' }] },
  };
}

function Onboarding未完成(角色: 'candidate' | 'recruiter'): 后端状态['Onboarding'] {
  return {
    阶段: '成功',
    数据: { roles: [{ role: 角色, status: 'active', completed_at: null }] },
  };
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
  return (
    <>
      <span data-testid="pathname">{位置.pathname}</span>
      <span data-testid="search">{位置.search}</span>
    </>
  );
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
      // stg 契约对齐：档案缺失 = 注册流引导（未完成）；档案在 = 主页（已完成）
      Onboarding: 阶段 === '缺失' ? Onboarding未完成('recruiter') : Onboarding已完成('recruiter'),
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

  // stg 契约对齐 2026-09-14（Spec §5）：已完成用户不因档案缺失/资料减少退回引导 ——
  // 档案缺失只是资料事实，完成事实才决定主页落点。
  it('已完成 recruiter 即便 profile 缺失也进企业主壳，不退回注册流名片', async () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成',
      Onboarding: Onboarding已完成('recruiter'),
      已登录: true,
      主体: 招聘主体,
      招聘方档案水合阶段: '缺失',
      招聘方组织水合: { 阶段: '成功', 错误: null },
    }));
    render(
      <MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.企业主壳));
  });

  it('组织水合失败在登录路径显示真实错误和重试入口', async () => {
    const 重试 = vi.fn(async () => undefined);
    const 用户 = userEvent.setup();
    const 值 = 后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,      招聘方档案水合阶段: '失败',
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
      初始化: '完成', 已登录: true, 主体: 招聘主体,      招聘方组织水合: { 阶段: '失败', 错误: '企业资料读取失败' },
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
      初始化: '完成', 已登录: true, 主体: 招聘主体,      招聘方组织水合: { 阶段: '失败', 错误: '企业资料读取失败' },
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
      初始化: '完成', 已登录: true, 主体: 招聘主体,      招聘方组织水合: { 阶段: '失败', 错误: '企业资料读取失败' },
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
      初始化: '完成', 已登录: true, 主体: 招聘主体,      招聘方档案水合阶段: '缺失',
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
      Onboarding: Onboarding未完成('recruiter'),
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
      初始化: '完成', 已登录: true, 主体: 招聘主体,      招聘方档案水合阶段: '成功',
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
      Onboarding: Onboarding未完成('recruiter'),
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
      初始化: '完成', 已登录: true,      主体: { ...招聘主体, last_used_role: null },
    }));
    render(
      <MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.选身份));
  });

  it('candidate 仍从登录路径落到求职主壳', async () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true,
      Onboarding: Onboarding已完成('candidate'),
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
      初始化: '完成', 已登录: false, 主体: null,    }));
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
      Onboarding: Onboarding已完成('candidate'),
      主体: { ...BFF主体样本, last_used_role: 'candidate' },
    }));
    rerender(树());
    await waitFor(() => expect(screen.getByTestId('pathname').textContent).toBe(路径.主壳));
    expect(路径记录.mock.calls.filter(([值]) => 值 === 路径.主壳)).toHaveLength(1);
  });
});

// ── baseline-stg-matching Task 2（疑点①）：水合在飞期的用户导航不被落点 replace 吞掉 ──
// README「已知事项」曾按 e2e 偶发翻红记录「hash 直达被在飞水合导航吞回落点路由」。
// 这里用受控事件序给出确定性结论（不靠全量偶然通过）：
//   主序：开始水合（初始化=进行中）→ 用户 hash 直达深链 → 水合返回（已登录 + 分流落定）
//         —— 登录落点 effect 只在「本次渲染的 pathname 仍是登录」时才 replace；
//            用户已导航的深链让该条件不成立，最终路由保留用户目的地。
//   对照：先 resolve（落点 replace 落定进主壳）再导航 —— 正常顺序同样保留目的地。
// 会话层前提（会话操作.test.ts 已有栅栏用例钉住）：过时轮水合在 是当前水合 栅栏整包
// 丢弃，能写 已登录/主体 的只有当前轮 —— 本组只钉 应用.tsx 对「当前轮返回」的导航归属。
describe('应用路由：水合在飞期的用户导航保留（疑点①受控时序）', () => {
  beforeEach(() => {
    mock应用状态.mockReset();
    屏幕挂载次数.clear();
  });

  // 用户导航探针：模拟水合在飞期间的 hash 直达（与真实 hashchange 同走 location 更新）
  function 导航探针() {
    const 导航 = useNavigate();
    return <button type="button" onClick={() => 导航(路径.我的简历)}>探针-去我的简历</button>;
  }

  it('开始水合→用户导航→水合返回：最终路由保留用户目的地，登录落点不吞深链', async () => {
    const 路径记录 = vi.fn();
    function 路径记录探针() {
      const 位置 = useLocation();
      useEffect(() => { 路径记录(位置.pathname); }, [位置.pathname]);
      return <span data-testid="pathname">{位置.pathname}</span>;
    }
    // 开始水合：初始化进行中，应用停在加载屏，路由仍在登录
    mock应用状态.mockReturnValue(后端应用值({ 初始化: '进行中', 已登录: false, 主体: null }));
    const 树 = () => (
      <MemoryRouter initialEntries={[路径.登录]}>
        <应用 />
        <导航探针 />
        <路径记录探针 />
      </MemoryRouter>
    );
    const { rerender } = render(树());
    expect(screen.getByText('正在加载…')).toBeTruthy();
    expect(当前路径()).toBe(路径.登录);

    // 用户导航（水合在飞）：hash 直达深链 /resume
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '探针-去我的简历' }));
    expect(当前路径()).toBe(路径.我的简历);
    expect(screen.getByText('正在加载…')).toBeTruthy(); // 水合仍未返回

    // 水合返回（当前轮收口）：已登录 + 已完成候选 —— 若落点导航不看当前位置，
    // 这一步会把 /resume 吞回主壳（即 README 记录的疑似竞态形态）
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成',
      已登录: true,
      Onboarding: Onboarding已完成('candidate'),
      主体: { ...BFF主体样本, last_used_role: 'candidate' },
    }));
    rerender(树());

    // 最终路由保留用户目的地：深页挂载、主壳一次都没挂、路径从未被改写成落点
    await waitFor(() => expect(screen.getByTestId('屏幕:我的简历')).toBeTruthy());
    expect(当前路径()).toBe(路径.我的简历);
    expect(屏幕挂载次数.get('主壳') ?? 0).toBe(0);
    expect(路径记录.mock.calls.filter(([值]) => 值 === 路径.主壳)).toHaveLength(0);
  });

  it('对照（先 resolve 再导航）：落点 replace 落定后再导航，目的地同样保留', async () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成',
      已登录: true,
      Onboarding: Onboarding已完成('candidate'),
      主体: { ...BFF主体样本, last_used_role: 'candidate' },
    }));
    render(
      <MemoryRouter initialEntries={[路径.登录]}>
        <应用 />
        <导航探针 />
        <位置探针 />
      </MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.主壳));
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '探针-去我的简历' }));
    await waitFor(() => expect(当前路径()).toBe(路径.我的简历));
    expect(屏幕挂载次数.get('主壳') ?? 0).toBe(1);
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

  // codex review-r1 P2：清理栅栏不能按「上次清理过的路径」去重 —— 清过 /app 后重新
  // 进入 onboarding 激活新一轮、再次退出到 /app 时，路径相同但轮是新轮，必须再清一次
  //（否则新 suggestion 与恢复元数据在主壳内存活到刷新）。栅栏应在进入活跃集合时复位。
  it('重新进入 onboarding 后退出：同一路径也再次清理', async () => {
    const 值 = 候选后端应用值({ 候选预填状态: ready预填轮() });
    mock应用状态.mockReturnValue(值);
    const 探针 = () => {
      const 导航 = useNavigate();
      return (
        <>
          <button onClick={() => 导航(路径.基本信息)}>探针-去基本信息</button>
          <button onClick={() => 导航(路径.主壳)}>探针-去主壳</button>
        </>
      );
    };
    render(
      <MemoryRouter initialEntries={[路径.主壳]}>
        <应用 />
        <探针 />
      </MemoryRouter>,
    );
    await waitFor(() => expect(值.操作.清候选Onboarding预填).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', { name: '探针-去基本信息' }));
    await waitFor(() => expect(screen.getByTestId('屏幕:基本信息')).toBeTruthy());
    // ready 轮直接挂载：进入活跃集合本身不清
    expect(值.操作.清候选Onboarding预填).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: '探针-去主壳' }));
    await waitFor(() => expect(screen.getByTestId('屏幕:主壳')).toBeTruthy());
    await waitFor(() => expect(值.操作.清候选Onboarding预填).toHaveBeenCalledTimes(2));
  });

  // 简历编辑显式来源（Task 1）：同 pathname 从无参数切到 from=resume 时，活跃判定必须
  // 吃到完整位置（pathname+search）—— 否则已退出的引导状态被资料编辑路径重新当作活跃
  //（不清理、建档位置还被继续写入）。这里钉调用方接线，防止只改纯函数却漏改 应用.tsx。
  it('同 pathname 从无参数切到 from=resume：退出引导清理执行、编辑位置不再写入建档', async () => {
    const 值 = 候选后端应用值({
      Onboarding: Onboarding未完成('candidate'),
      候选预填状态: ready预填轮(),
    });
    mock应用状态.mockReturnValue({
      ...值,
      状态: {
        ...初始状态,
        引导预填: {
          城市们: ['上海市'],
          职位: ['产品经理'],
          建档: { 资料: { 个人优势: '一半' } },
        },
      } as never,
    });
    const 探针 = () => {
      const 导航 = useNavigate();
      return (
        <button type="button" onClick={() => 导航(`${路径.基本信息}?from=resume`)}>
          探针-带编辑标记进基本信息
        </button>
      );
    };
    render(
      <MemoryRouter initialEntries={[路径.基本信息]}>
        <应用 />
        <探针 />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('屏幕:基本信息')).toBeTruthy());
    // 无参数 /basic 仍是注册会话内：位置照常写入、不做离开清理
    await waitFor(() => expect(值.操作.更新候选建档草稿).toHaveBeenCalledWith(expect.objectContaining({
      位置: { pathname: 路径.基本信息, search: '' },
    })));
    expect(值.操作.清候选Onboarding预填).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: '探针-带编辑标记进基本信息' }));
    // pathname 未变、只多了编辑标记：不再算注册会话 —— 退出引导清理必须执行
    await waitFor(() => expect(值.操作.清候选Onboarding预填).toHaveBeenCalledTimes(1));
    // 编辑位置不再写入建档位置：所有位置写入都停在无参数那次
    const 位置写入 = 值.操作.更新候选建档草稿.mock.calls.filter(
      ([草稿]) => (草稿 as { 位置?: unknown } | undefined)?.位置 !== undefined,
    );
    expect(位置写入.length).toBeGreaterThan(0);
    for (const [草稿] of 位置写入) {
      expect((草稿 as { 位置: { search: string } }).位置.search).not.toContain('from=resume');
    }
  });

  it.each([
    ['旧薪资段地址', 路径.引导问答薪资段, '屏幕:引导问答'],
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
    // 非候选会话用 recruiter 的允许路径（企业主壳）表达：角色路由边界落地后，
    // recruiter 深链候选主壳会被守卫同步拒绝，主壳屏对 recruiter 不再可达
    const 值 = 后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,
      Onboarding: Onboarding已完成('recruiter'),
    });
    mock应用状态.mockReturnValue(值);
    render(
      <MemoryRouter initialEntries={[路径.企业主壳]}><应用 /></MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('屏幕:企业主壳')).toBeTruthy());
    expect(值.操作.清候选Onboarding预填).not.toHaveBeenCalled();
  });
});

describe('应用路由：Backend 角色路由边界', () => {
  beforeEach(() => {
    mock应用状态.mockReset();
    屏幕挂载次数.clear();
  });

  // 拒绝矩阵：错误角色业务屏在 Backend 初始化完成后同步被拒 —— 单角色/目标 suspended/
  // last_used_role 缺失都回身份选择；双 active 只走显式切身份路径，绝不静默调 切身份。
  it.each([
    ['candidate 单角色进招聘页', 主体('candidate', 'active', null), '/hr/jobs', '/identity', ''],
    ['recruiter 单角色进候选页', 主体('recruiter', null, 'active'), '/resume', '/identity', ''],
    ['双 active candidate 进招聘页', 主体('candidate', 'active', 'active'), '/hr/jobs', '/identity', '?switch=1&from=app'],
    ['双 active recruiter 进候选页', 主体('recruiter', 'active', 'active'), '/resume', '/identity', '?switch=1&from=hr'],
    ['目标 candidate suspended', 主体('recruiter', 'suspended', 'active'), '/resume', '/identity', ''],
    ['目标 recruiter suspended', 主体('candidate', 'active', 'suspended'), '/hr/jobs', '/identity', ''],
    ['last_used_role 缺失', 主体(null, 'active', 'active'), '/resume', '/identity', ''],
  ] as const)('%s', async (_名, 当前主体, 初始路径, 期望路径, 期望搜索) => {
    const 当前值 = 后端应用值({
      初始化: '完成',      已登录: true,
      主体: 当前主体,
      招聘方组织水合: { 阶段: '成功', 错误: null },
      招聘方档案水合阶段: '成功',
    });
    mock应用状态.mockReturnValue(当前值);
    render(
      <MemoryRouter initialEntries={[初始路径]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(期望路径));
    expect(screen.getByTestId('search').textContent).toBe(期望搜索);
    expect(当前值.操作.切身份).not.toHaveBeenCalled();
  });

  // shared 路由不受角色守卫改写：账号安全/反馈/用户协议/帮助/企业详情对任意主体开放，
  // /identity 始终可达（身份选择是 suspended/未知角色的恢复出口）。
  it.each([
    ['candidate 单角色', 主体('candidate', 'active', null)],
    ['recruiter 单角色', 主体('recruiter', null, 'active')],
    ['双 active', 主体('candidate', 'active', 'active')],
    ['双 suspended', 主体('candidate', 'suspended', 'suspended')],
    ['角色未知', 主体(null, null, null)],
  ] as const)('%s 访问 shared 路由不被角色守卫改写', async (_名, 当前主体) => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成',      已登录: true,
      主体: 当前主体,
    }));
    const 探针 = () => {
      const 导航 = useNavigate();
      return (
        <>
          <button type="button" onClick={() => 导航('/account')}>探针-去账号安全</button>
          <button type="button" onClick={() => 导航('/feedback')}>探针-去反馈</button>
          <button type="button" onClick={() => 导航('/terms')}>探针-去用户协议</button>
          <button type="button" onClick={() => 导航('/help')}>探针-去帮助与客服</button>
          <button type="button" onClick={() => 导航('/company/org_1')}>探针-去企业详情</button>
          <button type="button" onClick={() => 导航('/identity')}>探针-去选身份</button>
        </>
      );
    };
    render(
      <MemoryRouter initialEntries={['/account']}><应用 /><位置探针 /><探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('屏幕:账号安全')).toBeTruthy());
    expect(当前路径()).toBe('/account');
    for (const [路径值, testid, 按钮] of [
      ['/feedback', '屏幕:反馈', '探针-去反馈'],
      ['/terms', '屏幕:用户协议', '探针-去用户协议'],
      ['/help', '屏幕:帮助与客服', '探针-去帮助与客服'],
      ['/company/org_1', '屏幕:企业详情', '探针-去企业详情'],
      ['/identity', '屏幕:选身份', '探针-去选身份'],
    ] as const) {
      await userEvent.click(screen.getByRole('button', { name: 按钮 }));
      await waitFor(() => expect(screen.getByTestId(testid)).toBeTruthy());
      expect(当前路径()).toBe(路径值);
    }
  });

  // 防闪挂：深链/刷新直达错误角色 URL，对侧业务屏（含其 effect）一次都不能挂载。
  it.each([
    ['candidate 深链招聘页', 主体('candidate', 'active', null), '/hr/jobs'],
    ['recruiter 深链候选页', 主体('recruiter', null, 'active'), '/resume'],
  ] as const)('%s被拒：对侧屏幕 mount 次数为 0', async (_名, 当前主体, 初始路径) => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成',      已登录: true,
      主体: 当前主体,
    }));
    render(
      <MemoryRouter initialEntries={[初始路径]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe('/identity'));
    expect(屏幕挂载次数.get('岗位管理') ?? 0).toBe(0);
    expect(屏幕挂载次数.get('我的简历') ?? 0).toBe(0);
  });

  // 后退行为：被拒路由是 replace，浏览器后退只回到允许页；错误屏从未挂载
  //（允许屏在后退回来时会合法地重新挂载，不计入断言）。
  it.each([
    ['recruiter 误入候选页', 主体('recruiter', null, 'active'), '/hr/jobs', '/resume', '屏幕:岗位管理', '我的简历'],
    ['candidate 误入招聘页', 主体('candidate', 'active', null), '/resume', '/hr/jobs', '屏幕:我的简历', '岗位管理'],
  ] as const)('%s：replace 后退只回允许页', async (_名, 当前主体, 允许路径, 错误路径, testid, 错误屏) => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成',      已登录: true,
      主体: 当前主体,
    }));
    const 探针 = () => {
      const 导航 = useNavigate();
      return (
        <>
          <button type="button" onClick={() => 导航(错误路径)}>探针-去错误页</button>
          <button type="button" onClick={() => 导航(-1)}>探针-后退</button>
        </>
      );
    };
    render(
      <MemoryRouter initialEntries={[允许路径]}><应用 /><位置探针 /><探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId(testid)).toBeTruthy());
    // 允许页自身挂载过一次；误入对侧、被拒、后退全程对侧错误屏 mount 必须仍为 0
    await userEvent.click(screen.getByRole('button', { name: '探针-去错误页' }));
    await waitFor(() => expect(当前路径()).toBe('/identity'));
    await userEvent.click(screen.getByRole('button', { name: '探针-后退' }));
    await waitFor(() => expect(当前路径()).toBe(允许路径));
    expect(屏幕挂载次数.get(错误屏) ?? 0).toBe(0);
  });

  // ── FE-IV-01：候选实名认证路由逐项登记进候选路由表 ──
  // candidate 直达挂载；recruiter 深链在页面 effect 前被角色守卫同步拦截
  //（含 effect 的屏幕一次都不能挂载、零实名读取）；未登录按现有保护逻辑去登录。
  it('candidate 直达实名认证页挂载', async () => {
    const 当前值 = 后端应用值({
      初始化: '完成',      已登录: true,
      主体: 主体('candidate', 'active', null),
    });
    mock应用状态.mockReturnValue(当前值);
    render(
      <MemoryRouter initialEntries={[路径.候选实名认证]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('屏幕:候选实名认证')).toBeTruthy());
    expect(当前路径()).toBe(路径.候选实名认证);
  });

  it('recruiter 深链实名认证页被角色守卫拦截：页面零挂载、实名读取零调用', async () => {
    const 当前值 = 后端应用值({
      初始化: '完成',      已登录: true,
      主体: 主体('recruiter', null, 'active'),
    });
    mock应用状态.mockReturnValue(当前值);
    render(
      <MemoryRouter initialEntries={[路径.候选实名认证]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe('/identity'));
    expect(屏幕挂载次数.get('候选实名认证') ?? 0).toBe(0);
    expect(当前值.操作.加载候选实名).not.toHaveBeenCalled();
  });

  it('未登录直达实名认证页按现有保护逻辑去登录', async () => {
    const 当前值 = 后端应用值({
      初始化: '完成',      已登录: false,
      主体: null,
    });
    mock应用状态.mockReturnValue(当前值);
    render(
      <MemoryRouter initialEntries={[路径.候选实名认证]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.登录));
    expect(屏幕挂载次数.get('候选实名认证') ?? 0).toBe(0);
    expect(当前值.操作.加载候选实名).not.toHaveBeenCalled();
  });
});

describe('应用路由：角色边界下的组织恢复、未知路由与 Mock 回归', () => {
  beforeEach(() => {
    mock应用状态.mockReset();
    屏幕挂载次数.clear();
  });

  // 未知路径不进角色分类器（不用 startsWith('/hr') 之类宽匹配猜角色）：
  // 仍交给现有 * fallback 落登录页，再由既有登录落点 effect 把 candidate 送进主壳。
  it.each(['/hr/not-a-real-screen', '/not-a-real-screen'])(
    '未知路径 %s 交给 * fallback，不被角色守卫拦截',
    async (路径值) => {
      mock应用状态.mockReturnValue(后端应用值({
        初始化: '完成', 已登录: true,
        Onboarding: Onboarding已完成('candidate'),
        主体: 主体('candidate', 'active', null),
      }));
      render(
        <MemoryRouter initialEntries={[路径值]}><应用 /><位置探针 /></MemoryRouter>,
      );
      await waitFor(() => expect(当前路径()).toBe(路径.主壳));
    },
  );

  // 主体快照缺失（已登录但主体未落地）fail closed：角色业务屏不挂载，回身份选择
  it('Backend 已登录但主体快照缺失时不挂载角色业务屏', async () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成',      已登录: true,
      主体: null,
    }));
    render(
      <MemoryRouter initialEntries={['/resume']}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe('/identity'));
    expect(屏幕挂载次数.get('我的简历') ?? 0).toBe(0);
  });

  // 恢复与退出招聘路径对 recruiter 放行（既有 describe 已钉组织失败/档案缺失行为），
  // 这里钉它们对 candidate 是 recruiter-only：不挂载、replace 回身份选择
  it.each([
    [路径.招聘名片, '屏幕:招聘名片'],
    [路径.企业实名认证, '屏幕:企业实名认证'],
    [路径.企业组织申请, '屏幕:企业组织申请'],
    [路径.企业邀请加入, '屏幕:企业邀请加入'],
  ] as const)('恢复/退出招聘路径 %s 仍 recruiter-only', async (路径值, testid) => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成',      已登录: true,
      主体: 主体('candidate', 'active', null),
    }));
    render(
      <MemoryRouter initialEntries={[路径值]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe('/identity'));
    expect(screen.queryByTestId(testid)).toBeNull();
  });

  // Mock 完全跳过角色守卫：无主体 roles 也直接挂目标屏，原型路由行为保持
  it.each(['/resume', '/hr/jobs'])('Mock 不应用主体角色守卫：%s', async (path) => {
    mock应用状态.mockReturnValue(Mock应用值());
    render(
      <MemoryRouter initialEntries={[path]}><应用 /></MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId(path === '/resume' ? '屏幕:我的简历' : '屏幕:岗位管理')).toBeTruthy(),
    );
  });
});

describe('应用路由：Backend 原型消息/往来/初筛深链（工作包 B）', () => {
  beforeEach(() => {
    mock应用状态.mockReset();
    屏幕挂载次数.clear();
  });

  // 五类原型深链在角色路由边界落地后仍按正确角色可达：路由表不删这些路径
  //（Mock 会回归），页面自身在 Backend 的中性退场由本 Plan 的页面测试覆盖。
  // 这里挂的是真实屏幕（未桩化）， Suspense 落定后路径保持原样即证明可达。
  it.each([
    ['candidate', '/chat/direct'],
    ['candidate', '/chat/direct/M-01'],
    ['candidate', '/thread/mc_real'],
    ['recruiter', '/hr/thread/mc_real'],
    ['recruiter', '/hr/screening-log'],
    ['recruiter', '/hr/screening-log/S-01'],
  ] as const)('%s 可以进入已注册的 %s 安全页面', async (role, url) => {
    const 当前主体 = role === 'candidate'
      ? 主体('candidate', 'active', null)
      : 主体('recruiter', null, 'active');
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true, 主体: 当前主体,      招聘方组织水合: { 阶段: '成功', 错误: null },
      招聘方档案水合阶段: '成功',
    }));
    render(
      <MemoryRouter initialEntries={[url]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(url));
  });
});

// ── J（Task 8）：canonical 双坐标路由 ──
describe('应用路由 · 后端匿名在线简历模板（J）', () => {
  beforeEach(() => {
    mock应用状态.mockReset();
  });

  it('builder 编码两段坐标', () => {
    expect(路径.后端匿名在线简历('job/a', 'rec/b')).toBe('/hr/jobs/job%2Fa/recommendations/rec%2Fb');
    expect(路径.后端匿名在线简历模板).toBe('/hr/jobs/:jobId/recommendations/:recommendationId');
    // Mock 旧 builder 保留
    expect(路径.匿名在线简历('A-01')).toBe('/hr/resume/A-01');
  });

  it('canonical URL 注册到 匿名在线简历 页（旧模板仍注册）', async () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成',      已登录: true,
      主体: 招聘主体,
    }));
    render(
      <MemoryRouter initialEntries={[路径.后端匿名在线简历('job_1', 'rec_r1')]}>
        <应用 />
      </MemoryRouter>,
    );
    // Backend canonical 详情挂载：进入加载态（不再是 404 兜底路由）
    await waitFor(() => expect(screen.getByText(/正在加载候选简历|链接已失效|这位候选/)).toBeTruthy());
  });
});

// ── J-PILOT-02 Task 9：候选 onboarding 回访落点（Spec §6 回访按事实分流）──
// 同标签有未完成草稿：刷新任一候选页按草稿恢复（pathname/search/题序/编辑中 随
// 建档草稿水合回来，页面原位挂载不被弹走）；直接打开主壳/初始化不能借直达跳过
// 保存，replace 回草稿记录的恢复落点（无位置记录或白名单外位置回旅程入口）；
// 无草稿的已完成老账号保持原有落点，不因缺「本次 id」重做 onboarding。
describe('应用路由：候选 onboarding 回访落点（Task 9）', () => {
  beforeEach(() => {
    mock应用状态.mockReset();
  });

  /** 位置与编辑中坐标都在的未完成建档草稿。
   *  缺省坐标用**旧薪资段兼容地址**（Task 3 之前社招第一次进向导的地址）：它仍在活跃
   *  集合内，恢复时 search 原样带回；真实挂载后由 引导问答 自己替换回首屏补齐。 */
  function 未完成草稿值(位置?: { pathname: string; search: string; 题序?: number }) {
    const 值 = 候选后端应用值({ Onboarding: Onboarding未完成('candidate') });
    return {
      ...值,
      状态: {
        ...初始状态,
        引导预填: {
          城市们: ['上海市'],
          职位: ['产品经理'],
          建档: {
            资料: { 个人优势: '一半' },
            位置,
            编辑中: { 种类: 'education', 本地编号: 'edu_1', 字段: { 学校: '云衢大学' } },
          },
        },
      } as never,
    };
  }

  const 旧薪资段位置 = { pathname: 路径.引导问答, search: '?stage=salary' };

  it('刷新任一候选页：草稿在场的旧薪资段坐标原位挂载，路径与 query 不被改写', async () => {
    mock应用状态.mockReturnValue(未完成草稿值(旧薪资段位置));
    render(
      <MemoryRouter initialEntries={[路径.引导问答薪资段]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('屏幕:引导问答')).toBeTruthy());
    expect(当前路径()).toBe(路径.引导问答);
    expect(screen.getByTestId('search').textContent).toBe('?stage=salary');
    expect(screen.queryByTestId('屏幕:主壳')).toBeNull();
  });

  it('直接访问主壳且草稿未完成：replace 回草稿记录的位置（pathname+search），主壳不挂载', async () => {
    mock应用状态.mockReturnValue(未完成草稿值(旧薪资段位置));
    render(
      <MemoryRouter initialEntries={[路径.主壳]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.引导问答));
    expect(screen.getByTestId('search').textContent).toBe('?stage=salary');
    expect(screen.queryByTestId('屏幕:主壳')).toBeNull(); // 不先挂主壳又被卸载
  });

  it('直接访问初始化且草稿未完成：同样 replace 回草稿位置，不借直达跳过保存', async () => {
    mock应用状态.mockReturnValue(未完成草稿值(旧薪资段位置));
    render(
      <MemoryRouter initialEntries={[路径.初始化]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.引导问答));
    expect(screen.getByTestId('search').textContent).toBe('?stage=salary');
  });

  it('草稿无位置记录：回旅程入口 学生分流', async () => {
    mock应用状态.mockReturnValue(未完成草稿值(undefined));
    render(
      <MemoryRouter initialEntries={[路径.主壳]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.学生分流));
  });

  it('存储位置在白名单外：不拿存储值任意导航，回旅程入口', async () => {
    mock应用状态.mockReturnValue(未完成草稿值({ pathname: 路径.设置, search: '' }));
    render(
      <MemoryRouter initialEntries={[路径.主壳]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.学生分流));
  });

  it('已完成老账号无草稿：主壳照常挂载，不因缺「本次 id」重做 onboarding', async () => {
    const 值 = 候选后端应用值();
    mock应用状态.mockReturnValue(值);
    render(
      <MemoryRouter initialEntries={[路径.主壳]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('屏幕:主壳')).toBeTruthy());
    expect(当前路径()).toBe(路径.主壳);
    expect(值.操作.更新候选建档草稿).not.toHaveBeenCalled();
  });

  it('注册会话内到达活跃集合每一站：pathname/search 落进建档草稿位置', async () => {
    const 值 = 未完成草稿值(undefined);
    const 写位置 = vi.fn();
    mock应用状态.mockReturnValue({ ...值, 操作: { ...值.操作, 更新候选建档草稿: 写位置 } });
    render(
      <MemoryRouter initialEntries={[路径.学生分流]}><应用 /></MemoryRouter>,
    );
    await waitFor(() => expect(写位置).toHaveBeenCalled());
    expect(写位置).toHaveBeenLastCalledWith(expect.objectContaining({
      位置: { pathname: 路径.学生分流, search: '' },
    }));
  });
});

// ── review-cx F1：无草稿候选的登录落点按已水合权威事实分流（Spec §6 第三分支）──
// 无本轮建档草稿时，「确实未完成者」不能被无条件送进主壳：只用已水合的 简历快照 +
// 意向快照 判完备（与 完成候选Onboarding 同判据：必填 profile + 至少一条完整教育 +
// 至少一条 active 意向），不完备 replace 回旅程入口 学生分流 复用已保存资源；
// 简历快照未水合（水合失败/未结束）不新增路由，保持原主壳落点。
// ── stg 契约对齐 2026-09-14（Spec §5 分流表）：完成事实取代「资料齐备即完成」──
// 旧 review-cx F1 的「已水合简历 + active 意向判完备」回访判定已被明确替代：落点只看
// me/onboarding 成功快照。已完成 → 主壳（不因资料减少退回引导）；未完成且无草稿 →
// 旅程入口（完整资料但 completed=null 仍引导）；查询未完成 → 加载（不闪进主壳）；
// 读取失败 → 恢复面（重试 + 切换身份）；已完成 + 旧草稿 → 完成事实优先，不回访拦截。
describe('应用路由：候选登录落点按 Onboarding 分流（Spec §5）', () => {
  beforeEach(() => {
    mock应用状态.mockReset();
  });

  /** 最小 active/archived 意向快照 —— 落点判据只读 status。 */
  const 意向快照 = (状态: 'active' | 'archived') =>
    ({ itn_1: { status: 状态 } }) as never as 后端状态['意向快照'];

  it('已完成：登录落点主壳，即使教育被改得不完整（不因资料减少退回引导）', async () => {
    mock应用状态.mockReturnValue(候选后端应用值({
      简历快照: { ...BFF简历样本, educations: [{ ...BFF简历样本.educations[0]!, end_month: null }] },
      意向快照: 意向快照('archived'),
    }));
    render(
      <MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.主壳));
    expect(screen.getByTestId('屏幕:主壳')).toBeTruthy();
  });

  it('无草稿且资料完备但 completed=null：仍引导，replace 回旅程入口 学生分流', async () => {
    mock应用状态.mockReturnValue(候选后端应用值({
      Onboarding: Onboarding未完成('candidate'),
      简历快照: BFF简历样本,
      意向快照: 意向快照('active'),
    }));
    render(
      <MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.学生分流));
    expect(screen.getByTestId('屏幕:学生分流')).toBeTruthy();
    expect(screen.queryByTestId('屏幕:主壳')).toBeNull();
  });

  it('未完成且简历快照未水合：同样回旅程入口（完成事实不靠本地资料推导）', async () => {
    mock应用状态.mockReturnValue(候选后端应用值({
      Onboarding: Onboarding未完成('candidate'),
      简历快照: null,
      意向快照: {},
    }));
    render(
      <MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.学生分流));
  });

  it('查询未完成（未读取）：登录路径只出既有加载屏，不闪进主壳也不挂载引导页', async () => {
    mock应用状态.mockReturnValue(候选后端应用值({
      Onboarding: 创建空Onboarding状态(),
    }));
    render(
      <MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>,
    );
    expect(screen.getByText('正在加载…')).toBeTruthy();
    expect(当前路径()).toBe(路径.登录);
    expect(screen.queryByTestId('屏幕:主壳')).toBeNull();
    expect(screen.queryByTestId('屏幕:学生分流')).toBeNull();
  });

  it('读取失败：登录路径显示恢复面（真实错误 + 重试 + 切换身份），不闪进主壳', async () => {
    const 重试 = vi.fn(async () => undefined);
    const 值 = 候选后端应用值({
      Onboarding: { 阶段: '失败', 错误: new BFF错误(503, 'recruitment_service_unavailable', '不可用') },
    });
    mock应用状态.mockReturnValue({ ...值, 操作: { ...值.操作, 刷新Onboarding: 重试 } });
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>,
    );
    expect(当前路径()).toBe(路径.登录);
    expect(screen.getByRole('alert').textContent).toContain('后端服务暂时不可用');
    await 用户.click(screen.getByRole('button', { name: '重试' }));
    expect(重试).toHaveBeenCalledTimes(1);
    await 用户.click(screen.getByRole('button', { name: '切换身份' }));
    await waitFor(() => expect(当前路径()).toBe(路径.选身份));
  });

  it('已完成 + 旧草稿在场：完成事实优先，主壳照常挂载、不回访拦截', async () => {
    const 值 = 候选后端应用值();
    mock应用状态.mockReturnValue({
      ...值,
      状态: {
        ...初始状态,
        引导预填: {
          城市们: ['上海市'],
          职位: ['产品经理'],
          建档: { 资料: { 个人优势: '一半' }, 位置: { pathname: 路径.引导问答, search: '?stage=salary' } },
        },
      } as never,
    });
    render(
      <MemoryRouter initialEntries={[路径.登录]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.主壳));
    expect(screen.getByTestId('屏幕:主壳')).toBeTruthy();
  });

  // closeout：Spec §5 表只定义登录/恢复/切端/受保护入口的落点，不要求把显式深链
  // /student 的已完成用户弹出 —— 旧反弹会挡掉「已完成用户经学生分流传简历」的真实
  // 路径（P2 附件 e2e），按裁决移除；完成事实仍在登录/初始化落点生效。
  it('已完成用户显式进入 学生分流：留在旅程入口，不被弹回主壳', async () => {
    mock应用状态.mockReturnValue(候选后端应用值());
    render(
      <MemoryRouter initialEntries={[路径.学生分流]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('屏幕:学生分流')).toBeTruthy());
    expect(当前路径()).toBe(路径.学生分流);
    expect(screen.queryByTestId('屏幕:主壳')).toBeNull();
  });

  it('未完成用户照常进入 学生分流：不被分流门拦下', async () => {
    mock应用状态.mockReturnValue(候选后端应用值({
      Onboarding: Onboarding未完成('candidate'),
    }));
    render(
      <MemoryRouter initialEntries={[路径.学生分流]}><应用 /></MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('屏幕:学生分流')).toBeTruthy());
  });
});

// ── codex review-r1 F2：candidate 未完成且无草稿不能从 /app 绕过 onboarding ──
// Spec §5 受保护入口与登录/切端同一语义：candidate 的主落点 主壳 也是受保护入口 ——
// active 未完成且无建档草稿时 replace 回旅程入口；有草稿由既有草稿回访路径接手
//（不在此重复拦截）；已完成不因任何资料事实退回引导；查询中由分流门出加载屏。
describe('应用路由：candidate 主壳受保护入口按 Onboarding 分流（review-r1）', () => {
  beforeEach(() => {
    mock应用状态.mockReset();
    屏幕挂载次数.clear();
  });

  it('未完成且无草稿：直达 /app replace 回学生分流，主壳一次都不挂载', async () => {
    mock应用状态.mockReturnValue(候选后端应用值({
      Onboarding: Onboarding未完成('candidate'),
    }));
    render(
      <MemoryRouter initialEntries={[路径.主壳]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.学生分流));
    expect(screen.getByTestId('屏幕:学生分流')).toBeTruthy();
    // review-r2：拦截必须发生在 <Routes> 之前（同步渲染守卫）—— 主壳连同其
    // 挂载效应（加载会话列表 业务请求）一次都不能挂载，不只是一个帧后弹走。
    expect(屏幕挂载次数.get('主壳') ?? 0).toBe(0);
  });

  it('切端落点同样拦截：选身份后导航到 /app（模拟 recruiter→candidate 切换后的落点）被送回学生分流', async () => {
    const 值 = 候选后端应用值({ Onboarding: Onboarding未完成('candidate') });
    mock应用状态.mockReturnValue(值);
    const 探针 = () => {
      const 导航 = useNavigate();
      return <button type="button" onClick={() => 导航(路径.主壳)}>探针-去主壳</button>;
    };
    render(
      <MemoryRouter initialEntries={[路径.选身份]}><应用 /><位置探针 /><探针 /></MemoryRouter>,
    );
    // 切身份成功的主体状态已就位（candidate、未完成、无草稿）；选身份 的 替换跳转(主壳) 由探针表达
    await userEvent.click(screen.getByRole('button', { name: '探针-去主壳' }));
    await waitFor(() => expect(当前路径()).toBe(路径.学生分流));
    expect(screen.getByTestId('屏幕:学生分流')).toBeTruthy();
    expect(屏幕挂载次数.get('主壳') ?? 0).toBe(0);
  });

  it('已完成 candidate 直达 /app：主壳照常挂载，不被送回引导', async () => {
    mock应用状态.mockReturnValue(候选后端应用值());
    render(
      <MemoryRouter initialEntries={[路径.主壳]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('屏幕:主壳')).toBeTruthy());
    expect(当前路径()).toBe(路径.主壳);
  });

  // review-r3：/student 上传简历只激活预填轮（source/suggestion + 恢复元数据），
  // 不建 建档草稿 —— 被拦截的 /app 落点仍算注册会话内，重定向跳变不得把在飞
  // 预填轮烧掉（否则回 /student 后解析流程降级为手动）。
  it('预填轮在场但无建档草稿：/app 拦截重定向不清预填轮（解析建议与恢复元数据存活）', async () => {
    const 值 = 候选后端应用值({
      Onboarding: Onboarding未完成('candidate'),
      候选预填状态: ready预填轮(),
    });
    mock应用状态.mockReturnValue(值);
    render(
      <MemoryRouter initialEntries={[路径.主壳]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.学生分流));
    expect(屏幕挂载次数.get('主壳') ?? 0).toBe(0);
    expect(值.操作.清候选Onboarding预填).not.toHaveBeenCalled();
  });

  it('未完成但草稿在场：/app 由草稿回访路径接手（回草稿位置），不走无草稿分流', async () => {
    const 值 = 候选后端应用值({ Onboarding: Onboarding未完成('candidate') });
    mock应用状态.mockReturnValue({
      ...值,
      状态: {
        ...初始状态,
        引导预填: {
          城市们: ['上海市'],
          职位: ['产品经理'],
          建档: {
            资料: { 个人优势: '一半' },
            位置: { pathname: 路径.引导问答, search: '?stage=salary', 题序: 1 },
          },
        },
      } as never,
    });
    render(
      <MemoryRouter initialEntries={[路径.主壳]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.引导问答));
    expect(screen.getByTestId('search').textContent).toBe('?stage=salary');
    expect(screen.queryByTestId('屏幕:主壳')).toBeNull();
  });

  it('查询未完成（未读取）：/app 只出既有加载屏，不挂主壳也不闪引导', () => {
    mock应用状态.mockReturnValue(候选后端应用值({
      Onboarding: 创建空Onboarding状态(),
    }));
    render(
      <MemoryRouter initialEntries={[路径.主壳]}><应用 /><位置探针 /></MemoryRouter>,
    );
    expect(screen.getByText('正在加载…')).toBeTruthy();
    expect(当前路径()).toBe(路径.主壳);
    expect(screen.queryByTestId('屏幕:主壳')).toBeNull();
    expect(screen.queryByTestId('屏幕:学生分流')).toBeNull();
  });
});

// ── stg 契约对齐：recruiter 引导入口的完成反弹（普通选身份 / 注册流名片）──
describe('应用路由：recruiter 完成反弹（Spec §5）', () => {
  beforeEach(() => {
    mock应用状态.mockReset();
  });

  it('已完成 recruiter 进入注册流名片：replace 回企业主壳（消除完成后反复引导）', async () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,
      Onboarding: Onboarding已完成('recruiter'),
      招聘方档案水合阶段: '成功',
      招聘方组织水合: { 阶段: '成功', 错误: null },
    }));
    render(
      <MemoryRouter initialEntries={[{ pathname: 路径.招聘名片, state: { 从注册流: true } }]}>
        <应用 /><位置探针 />
      </MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe(路径.企业主壳));
  });

  it('已完成 recruiter 普通编辑名片（无注册流标记）：照常挂载名片编辑，不被抢导航', async () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,
      Onboarding: Onboarding已完成('recruiter'),
      招聘方档案水合阶段: '成功',
      招聘方组织水合: { 阶段: '成功', 错误: null },
    }));
    render(
      <MemoryRouter initialEntries={[路径.招聘名片]}><应用 /><位置探针 /></MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('屏幕:招聘名片')).toBeTruthy());
    expect(当前路径()).toBe(路径.招聘名片);
  });

  it('本次注册名片上原地完成（pathname 未变）：完成状态不抢首岗导航', async () => {
    // 进入时未完成 → 名片正常挂载；保存链完成 onboarding 后状态翻已完成，
    // 但 pathname 没变 —— 反弹只认「进入」那次导航，首岗跳转不被截断。
    const 基础值 = () => 后端应用值({
      初始化: '完成', 已登录: true, 主体: 招聘主体,
      Onboarding: Onboarding未完成('recruiter'),
      招聘方档案水合阶段: '成功',
      招聘方组织水合: { 阶段: '成功', 错误: null },
    });
    mock应用状态.mockReturnValue(基础值());
    const 视图 = render(
      <MemoryRouter initialEntries={[{ pathname: 路径.招聘名片, state: { 从注册流: true } }]}>
        <应用 /><位置探针 />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('屏幕:招聘名片')).toBeTruthy());
    // 已完成事实随后到达（同一屏上的 complete 成功；pathname 未变）
    mock应用状态.mockReturnValue({
      ...基础值(),
      后端状态: { ...基础值().后端状态, Onboarding: Onboarding已完成('recruiter') },
    });
    视图.rerender(
      <MemoryRouter initialEntries={[{ pathname: 路径.招聘名片, state: { 从注册流: true } }]}>
        <应用 /><位置探针 />
      </MemoryRouter>,
    );
    // 不被弹去企业主壳：显式首岗导航不被已完成状态抢走
    await waitFor(() => expect(screen.getByTestId('屏幕:招聘名片')).toBeTruthy());
    expect(当前路径()).toBe(路径.招聘名片);
  });
});

// ── review-r1 F2：canonical 招聘详情 URL 必须落在招聘角色边界内 ──
describe('应用路由 · canonical 招聘详情角色边界（review-r1）', () => {
  beforeEach(() => {
    mock应用状态.mockReset();
  });

  it('candidate 打开 canonical 招聘详情 URL 被挡回身份选择（同旧 /hr/resume/:id）', async () => {
    mock应用状态.mockReturnValue(后端应用值({
      初始化: '完成',      已登录: true,
      主体: 主体('candidate', 'active', null),
    }));
    render(
      <MemoryRouter initialEntries={[路径.后端匿名在线简历('job_1', 'rec_1')]}>
        <应用 /><位置探针 />
      </MemoryRouter>,
    );
    await waitFor(() => expect(当前路径()).toBe('/identity'));
  });
});
