// 候选 onboarding 预填恢复边界测试（设计 §9 路由恢复边界 / Task 7）。
// 边界只包装可能消费 suggestion 的 onboarding 页面（六个资料页 + 向导偏好段）：
// 刷新后按 exact tuple 恢复一轮未完成预填，恢复期间复用既有 路由加载中、绝不挂载
// 消费表单；恢复结算成 failed 时复用既有 确认层 给「重试 / 继续手填」；内存已有轮
// （ready/manual/…）零恢复调用直接挂载；薪资段与各保状态页零读取零清理。
// 操作层分支（元数据校验 / succeeded 升级 / pending 转 manual / 失配删除）归 Task 3
// 的 简历预填操作.test.ts —— 这里用操作桩钉边界的接线：何时调、调什么参、渲染什么，
// 各分支对内存态的落位由桩直接改 后端状态.候选预填状态 再重渲染（与 学生分流.test 同纪律）。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF附件简历 } from '../数据/BFF契约';
import { 构造映射变体基底 } from '../数据/招聘数据源/简历预填.fixture';
import { 路径 } from '../路由/路径表';
import {
  创建空候选预填状态,
  type 候选预填Eligibility,
  type 候选预填恢复元数据,
  type 候选预填状态,
} from '../状态/后端/类型';
import { Onboarding流程 } from './onboarding配置';
import { 候选Onboarding预填边界, 是活跃Onboarding位置, 是预填消费位置 } from './候选Onboarding预填边界';

const mock操作 = {
  恢复候选Onboarding预填: vi.fn(),
  清候选Onboarding预填: vi.fn(),
  重试候选Onboarding预填: vi.fn(),
  继续手填候选Onboarding: vi.fn(),
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

// ── 坐标与样本（source 三元组与 简历预填操作.test 同一冻结坐标）──

const 文件ID = 'rf_0123456789abcdef0123456789abcdef';
const 版本ID = 'rfv_0123456789abcdef0123456789abcdef';
const 解析ID = 'rp_0123456789abcdef0123456789abcdef';

const limits = {
  max_files: 3,
  max_file_bytes: 2 * 1024 * 1024,
  accepted_media_types: ['application/pdf'] as ['application/pdf'],
};

const 全可填: 候选预填Eligibility = {
  profile: { real_name: true, work_start_year: true, gender: true, birth_year: true, birth_month: true, current_education: true },
  summary: true,
  skills: true,
  experiences: true,
  educations: true,
  certificates: true,
};

/** 刷新前落盘的活跃恢复元数据：auto 轮、stored parse_id 为 null（succeeded 升级前）。 */
function activeRecoveryMetadata(覆盖: Partial<候选预填恢复元数据> = {}): 候选预填恢复元数据 {
  return {
    mode: 'auto',
    source: { file_id: 文件ID, version_id: 版本ID, parse_id: null },
    eligibility: 全可填,
    confirmed: 创建空候选预填状态().confirmed,
    generation: 2,
    ...覆盖,
  };
}

/** 预填轮 fixture：缺省 pristine inactive，测试只覆盖关心的字段。 */
function 预填轮(覆盖: Partial<候选预填状态> = {}): 候选预填状态 {
  return { ...创建空候选预填状态(), ...覆盖 };
}

/** 权威附件行 fixture：file/version 可调（缺省与元数据 source 同坐标），解析状态可调。 */
function 权威附件(
  版本 = 版本ID,
  解析: 'succeeded' | 'processing' | 'pending' = 'succeeded',
): BFF附件简历 {
  return {
    file_id: 文件ID,
    display_name: '沈亦舟_简历_2026.pdf',
    revision: 1,
    current_version: {
      version_id: 版本,
      version: 1,
      size_bytes: 1024,
      media_type: 'application/pdf',
      sha256: 'a'.repeat(64),
      created_at: 't',
      parse: 解析 === 'succeeded'
        ? { status: 'succeeded', parse_id: 解析ID, updated_at: 't' }
        : { status: 解析, updated_at: 't' },
    },
    created_at: 't',
    updated_at: 't',
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

/**
 * 在指定位置挂边界 + consumer-form 测试节点。缺省用与元数据 source 同坐标的权威
 * 附件行（真实恢复操作按它校验 exact tuple；操作桩只钉边界接线，不重复那份判定），
 * 失配用例用 选项.附件 显式给出与元数据不同坐标的权威行。
 */
function renderBoundary(
  路径串: string,
  元数据: 候选预填恢复元数据 | null = activeRecoveryMetadata(),
  选项: {
    预填?: 候选预填状态;
    解析?: 'succeeded' | 'processing' | 'pending';
    附件?: BFF附件简历;
    /** 附件库未水合（后端状态.附件简历库 === null）：消费页首屏必须先出加载屏。 */
    附件库未水合?: boolean;
    数据源模式?: 'backend' | 'mock';
    角色?: 'candidate' | 'recruiter';
  } = {},
) {
  mock应用状态 = {
    数据源模式: (选项.数据源模式 ?? 'backend') as 'backend' | 'mock',
    状态: {},
    派发: vi.fn(),
    后端状态: {
      初始化: '完成' as const,
      已登录: true,
      主体: { subject_id: 'sub_1', roles: [], last_used_role: (选项.角色 ?? 'candidate') as 'candidate' | 'recruiter' },
      附件简历库: 选项.附件库未水合 === true ? null : {
        items: [选项.附件 ?? 权威附件(元数据?.source.version_id ?? 版本ID, 选项.解析 ?? 'succeeded')],
        limits,
      },
      候选预填状态: 选项.预填 ?? 创建空候选预填状态(),
    },
    操作: mock操作,
  };
  const 视图 = render(
    <MemoryRouter initialEntries={[路径串]}>
      <候选Onboarding预填边界>
        <div data-testid="consumer-form">表单</div>
      </候选Onboarding预填边界>
    </MemoryRouter>,
  );
  return {
    /** 直改 mock应用状态.后端状态 后强制重渲染（模拟操作层提交新快照后的渲染） */
    重渲染: () =>
      视图.rerender(
        <MemoryRouter initialEntries={[路径串]}>
          <候选Onboarding预填边界>
            <div data-testid="consumer-form">表单</div>
          </候选Onboarding预填边界>
        </MemoryRouter>,
      ),
    容器: 视图.container,
  };
}

beforeEach(() => {
  mock操作.恢复候选Onboarding预填.mockReset().mockResolvedValue(undefined);
  mock操作.清候选Onboarding预填.mockReset();
  mock操作.重试候选Onboarding预填.mockReset().mockResolvedValue(undefined);
  mock操作.继续手填候选Onboarding.mockReset();
});

// ── 纯位置判定：消费集合与活跃集合 ────────────────────────────────

describe('消费位置判定（向导段写在 query 上，消费必须看 search）', () => {
  it('六个资料页是消费位置', () => {
    for (const 站 of [路径.基本信息, 路径.最高学历, 路径.毕业院校, 路径.选专业, 路径.就读时间段, 路径.工作经历]) {
      expect(是预填消费位置(站, '')).toBe(true);
    }
  });

  it('向导只有偏好段消费，薪资段不消费', () => {
    expect(是预填消费位置(路径.引导问答, '')).toBe(true);
    expect(是预填消费位置(路径.引导问答, '?stage=preference')).toBe(true);
    expect(是预填消费位置(路径.引导问答, '?stage=salary')).toBe(false);
  });

  it('保状态页与其它产品路由都不是消费位置', () => {
    for (const 站 of [路径.求职状态, 路径.披露说明, 路径.选工作城市, 路径.选期望职位, 路径.添加头像, 路径.主壳, 路径.设置]) {
      expect(是预填消费位置(站, '')).toBe(false);
    }
  });
});

describe('活跃 Onboarding 集合：以 Onboarding流程 为唯一事实源', () => {
  it('两条候选合同进主壳前的每一站都保持会话活跃', () => {
    const 站们 = new Set([...Onboarding流程.学生求职, ...Onboarding流程.社招求职]);
    站们.delete(路径.主壳);
    expect(站们.size).toBeGreaterThan(0);
    for (const 站 of 站们) expect(是活跃Onboarding位置(站)).toBe(true);
  });

  it('学生分流 打开的 city/job 子页也在活跃集合内', () => {
    expect(是活跃Onboarding位置(路径.选工作城市)).toBe(true);
    expect(是活跃Onboarding位置(路径.选期望职位)).toBe(true);
  });

  it('向导两段都活跃：段写在 query 上，活跃与否不看 query', () => {
    expect(是活跃Onboarding位置(路径.引导问答)).toBe(true);
    expect(是活跃Onboarding位置(路径.引导问答薪资段)).toBe(true);
  });

  it('主壳 / 登录 / 身份选择 / 其它产品路由与企业端都不活跃', () => {
    for (const 站 of [路径.主壳, 路径.登录, 路径.选身份, 路径.设置, 路径.我的简历, 路径.企业主壳]) {
      expect(是活跃Onboarding位置(站)).toBe(false);
    }
  });
});

// ── 边界行为 ─────────────────────────────────────────────────────

describe('候选Onboarding预填边界：消费页刷新恢复', () => {
  it('restores an exact tuple before mounting the consumer form', async () => {
    const 门 = 可控Promise<void>();
    mock操作.恢复候选Onboarding预填.mockReturnValue(门.promise);
    renderBoundary(路径.基本信息, activeRecoveryMetadata());
    expect(screen.getByText('正在加载…')).toBeTruthy();
    expect(screen.queryByTestId('consumer-form')).toBeNull();
    // 消费页不挂 use附件简历刷新 poller：恢复永远以 允许等待解析:false 发起
    expect(mock操作.恢复候选Onboarding预填).toHaveBeenCalledWith({ 允许等待解析: false });
    expect(mock操作.恢复候选Onboarding预填).toHaveBeenCalledTimes(1);
    门.resolve();
    await waitFor(() => expect(screen.getByTestId('consumer-form')).toBeTruthy());
    expect(screen.queryByText('正在加载…')).toBeNull();
  });

  // review Issue 6：水合落地前不挂消费表单（Spec §9「读取完成前不挂载待预填表单」）——
  // 首帧与附件库水合之间曾直接渲染表单，恢复一旦发起再卸掉它，那一帧里敲进的键全丢。
  // 这里做结构性断言：pristine 轮 + 候选会话 + 消费位置，水合未落地时表单绝不挂载。
  it('附件库未水合的 pristine 消费页先出 路由加载中：表单不挂载、恢复不烧机会；水合落地后再恢复放行', async () => {
    const 门 = 可控Promise<void>();
    mock操作.恢复候选Onboarding预填.mockReturnValue(门.promise);
    const { 重渲染 } = renderBoundary(路径.基本信息, activeRecoveryMetadata(), { 附件库未水合: true });
    expect(screen.getByText('正在加载…')).toBeTruthy();
    expect(screen.queryByTestId('consumer-form')).toBeNull();
    // 等水合的窗口里不发恢复（一次性机会不烧掉），只保持加载屏
    expect(mock操作.恢复候选Onboarding预填).not.toHaveBeenCalled();
    // 水合落地：恢复发起，结算前仍不挂表单
    mock应用状态.后端状态.附件简历库 = { items: [权威附件()], limits };
    重渲染();
    await waitFor(() => expect(mock操作.恢复候选Onboarding预填).toHaveBeenCalledWith({ 允许等待解析: false }));
    expect(screen.getByText('正在加载…')).toBeTruthy();
    expect(screen.queryByTestId('consumer-form')).toBeNull();
    门.resolve();
    await waitFor(() => expect(screen.getByTestId('consumer-form')).toBeTruthy());
    expect(screen.queryByText('正在加载…')).toBeNull();
  });

  it('Mock / 非候选会话即使附件库未水合也不出加载屏：直接挂载、零恢复调用', () => {
    renderBoundary(路径.基本信息, activeRecoveryMetadata(), { 附件库未水合: true, 数据源模式: 'mock' });
    expect(screen.getByTestId('consumer-form')).toBeTruthy();
    expect(screen.queryByText('正在加载…')).toBeNull();
    expect(mock操作.恢复候选Onboarding预填).not.toHaveBeenCalled();
  });

  it('非候选（recruiter）会话同样直接挂载，零恢复调用', () => {
    renderBoundary(路径.基本信息, activeRecoveryMetadata(), { 附件库未水合: true, 角色: 'recruiter' });
    expect(screen.getByTestId('consumer-form')).toBeTruthy();
    expect(screen.queryByText('正在加载…')).toBeNull();
    expect(mock操作.恢复候选Onboarding预填).not.toHaveBeenCalled();
  });

  it('keeps salary wizard active without reading the summary suggestion', () => {
    renderBoundary(路径.引导问答薪资段, activeRecoveryMetadata());
    expect(mock操作.恢复候选Onboarding预填).not.toHaveBeenCalled();
    expect(mock操作.清候选Onboarding预填).not.toHaveBeenCalled();
    // 薪资段不是消费位置：表单照常挂载
    expect(screen.getByTestId('consumer-form')).toBeTruthy();
  });

  it('向导偏好段是消费位置：pristine 内存轮触发恢复', async () => {
    renderBoundary(路径.引导问答, activeRecoveryMetadata());
    await waitFor(() => expect(mock操作.恢复候选Onboarding预填).toHaveBeenCalledWith({ 允许等待解析: false }));
    await waitFor(() => expect(screen.getByTestId('consumer-form')).toBeTruthy());
  });

  it('内存 ready 轮直接挂载：零恢复读取、零状态改动', () => {
    renderBoundary(路径.基本信息, activeRecoveryMetadata(), {
      预填: 预填轮({
        phase: 'ready',
        source: { file_id: 文件ID, version_id: 版本ID, parse_id: 解析ID },
        suggestion: 构造映射变体基底(),
      }),
    });
    expect(screen.getByTestId('consumer-form')).toBeTruthy();
    expect(screen.queryByText('正在加载…')).toBeNull();
    expect(mock操作.恢复候选Onboarding预填).not.toHaveBeenCalled();
    expect(mock操作.清候选Onboarding预填).not.toHaveBeenCalled();
    expect(mock操作.重试候选Onboarding预填).not.toHaveBeenCalled();
    expect(mock操作.继续手填候选Onboarding).not.toHaveBeenCalled();
  });

  it('权威解析在途（pending/processing）的消费页立即转 manual 并挂表单：无 poller、零网络读取', async () => {
    const 取数 = vi.spyOn(globalThis, 'fetch');
    mock操作.恢复候选Onboarding预填.mockImplementation(async () => {
      // 允许等待解析:false 分支的操作层落位：立即 manual，不恢复无人推进的等待轮
      mock应用状态.后端状态.候选预填状态 = 预填轮({
        phase: 'manual',
        source: { file_id: 文件ID, version_id: 版本ID, parse_id: null },
      });
    });
    renderBoundary(路径.基本信息, activeRecoveryMetadata(), { 解析: 'processing' });
    expect(mock操作.恢复候选Onboarding预填).toHaveBeenCalledWith({ 允许等待解析: false });
    await waitFor(() => expect(screen.getByTestId('consumer-form')).toBeTruthy());
    // 不出现永不放行的加载屏，也不靠轮询推进
    expect(screen.queryByText('正在加载…')).toBeNull();
    expect(取数).not.toHaveBeenCalled();
    取数.mockRestore();
  });

  it('元数据与权威附件失配的安全失败：不挂确认层，表单照常挂载', async () => {
    mock操作.恢复候选Onboarding预填.mockImplementation(async () => {
      // 失配分支的操作层落位：删除记录并保持 inactive（这里只体现「仍是无轮」）
    });
    // 元数据指向另一版本，权威附件仍是当前 items[0] —— 恢复无法被当前附件满足
    const 失配元数据 = activeRecoveryMetadata({
      source: { file_id: 文件ID, version_id: 'rfv_00000000000000000000000000000000', parse_id: null },
    });
    renderBoundary(路径.基本信息, 失配元数据, { 附件: 权威附件(版本ID, 'succeeded') });
    await waitFor(() => expect(screen.getByTestId('consumer-form')).toBeTruthy());
    expect(screen.queryByText('正在加载…')).toBeNull();
    expect(screen.queryByRole('button', { name: '重试' })).toBeNull();
  });

  it('内存 manual 轮绕过恢复：直接挂载且零操作调用', () => {
    renderBoundary(路径.基本信息, activeRecoveryMetadata(), {
      预填: 预填轮({
        phase: 'manual',
        source: { file_id: 文件ID, version_id: 版本ID, parse_id: null },
      }),
    });
    expect(screen.getByTestId('consumer-form')).toBeTruthy();
    expect(mock操作.恢复候选Onboarding预填).not.toHaveBeenCalled();
    expect(mock操作.清候选Onboarding预填).not.toHaveBeenCalled();
  });

  it('pristine 且无元数据也只调一次恢复并挂载（不重复触发）', async () => {
    const { 重渲染 } = renderBoundary(路径.基本信息, null);
    await waitFor(() => expect(screen.getByTestId('consumer-form')).toBeTruthy());
    expect(mock操作.恢复候选Onboarding预填).toHaveBeenCalledTimes(1);
    expect(mock操作.清候选Onboarding预填).not.toHaveBeenCalled();
    重渲染();
    expect(mock操作.恢复候选Onboarding预填).toHaveBeenCalledTimes(1);
  });

  it('恢复结算成 failed 复用 确认层：重试再走操作层、继续手填后挂表单', async () => {
    mock操作.恢复候选Onboarding预填.mockImplementation(async () => {
      mock应用状态.后端状态.候选预填状态 = 预填轮({
        phase: 'failed',
        source: { file_id: 文件ID, version_id: 版本ID, parse_id: 解析ID },
        error: '服务暂时不可用，请稍后重试',
      });
    });
    const { 重渲染 } = renderBoundary(路径.基本信息, activeRecoveryMetadata());
    await waitFor(() => expect(screen.getByRole('button', { name: '重试' })).toBeTruthy());
    expect(screen.getByRole('button', { name: '继续手填' })).toBeTruthy();
    // 失败面不挂表单：绝不把空建议冒充恢复成功
    expect(screen.queryByTestId('consumer-form')).toBeNull();

    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(mock操作.重试候选Onboarding预填).toHaveBeenCalledTimes(1));
    // 重试的读取仍由操作层负责；结算后 failed 未解除就回到同一个确认层
    await waitFor(() => expect(screen.getByRole('button', { name: '重试' })).toBeTruthy());
    expect(screen.queryByTestId('consumer-form')).toBeNull();

    mock操作.继续手填候选Onboarding.mockImplementation(() => {
      mock应用状态.后端状态.候选预填状态 = 预填轮({
        phase: 'manual',
        source: { file_id: 文件ID, version_id: 版本ID, parse_id: 解析ID },
      });
    });
    await 用户.click(screen.getByRole('button', { name: '继续手填' }));
    await waitFor(() => expect(mock操作.继续手填候选Onboarding).toHaveBeenCalledTimes(1));
    重渲染();
    await waitFor(() => expect(screen.getByTestId('consumer-form')).toBeTruthy());
  });

  it.each([
    ['薪资段', 路径.引导问答薪资段],
    ['求职状态', 路径.求职状态],
    ['披露说明', 路径.披露说明],
    ['城市子页', 路径.选工作城市],
    ['职位子页', 路径.选期望职位],
    ['头像页', 路径.添加头像],
  ] as const)('保状态页零读取零清理：%s直接挂载', (_名, 站) => {
    renderBoundary(站, activeRecoveryMetadata());
    expect(mock操作.恢复候选Onboarding预填).not.toHaveBeenCalled();
    expect(mock操作.清候选Onboarding预填).not.toHaveBeenCalled();
    expect(screen.getByTestId('consumer-form')).toBeTruthy();
  });

  it('边界不引入任何包裹 DOM：消费节点直接挂在容器下', () => {
    // 内存 ready 轮直接挂载（无异步恢复），DOM 形状最稳定
    const { 容器 } = renderBoundary(路径.基本信息, activeRecoveryMetadata(), {
      预填: 预填轮({
        phase: 'ready',
        source: { file_id: 文件ID, version_id: 版本ID, parse_id: 解析ID },
        suggestion: 构造映射变体基底(),
      }),
    });
    const 节点 = screen.getByTestId('consumer-form');
    expect(节点.parentElement).toBe(容器);
  });
});
