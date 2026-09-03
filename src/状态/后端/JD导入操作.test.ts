// JD 导入操作的行为边界 —— 真实 factory + fake refs 驱动 创建JD导入操作(deps)
// （与 简历预填操作.test.ts 同一纪律：设后端状态 冻结为与真实 Provider 同步更新 ref 的语义）。
// 铁律（plan Task 2 / 设计 §5.2）：
//   · Mock / 无后端 / 非 recruiter：零 JD 请求；
//   · 请求前捕获 subject + 会话代际；主体 / 角色 / 代际任一失配的迟到成败整包丢弃（已换代）；
//   · 当前栅栏 401 只走统一 清账号状态 且页面收到已换代；迟到 401 绝不清理新会话；
//   · 当前栅栏的非 401 错误原样抛给页面的 JD 闭合文案映射；参数原样透传。

import { describe, expect, it, vi } from 'vitest';
import type { BFFJD导入 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { BFF错误 } from '../../数据/HTTP客户端';
import { 初始状态 } from '../初始状态';
import { 创建空P4发现状态 } from './发现推荐操作';
import { 创建空P5MatchCase状态 } from './MatchCase操作';
import { 创建空P7会话状态 } from './真人会话操作';
import { 创建空P8控制面状态 } from './P8控制面操作';
import type { 后端操作依赖, 后端状态, JD导入操作 } from './类型';
import { 创建JD导入操作 } from './JD导入操作';

const 合法ID = 'jdi_0123456789abcdef0123456789abcdef';
const 幂等键 = 'jd-import-01234567-89ab-cdef-0123-456789abcdef';
const PDF文件 = () => new File(['%PDF-1.7'], 'role.pdf', { type: 'application/pdf' });

const 成功结果: BFFJD导入 = {
  import_id: 合法ID,
  status: 'succeeded',
  created_at: '2026-09-03T01:02:03Z',
  updated_at: '2026-09-03T01:02:06Z',
  suggestion: {
    title: 'Senior Backend Engineer',
    recruitment_type: 'social_full_time',
    workplace_mode: 'hybrid',
    office_location: '上海市浦东新区世纪大道 1568 号',
    description: '负责核心招聘服务。',
    requirements: '五年以上后端经验。',
    education_requirement: 'bachelor',
    experience_requirement: 'five_plus_years',
    category_source_name: '后端开发',
    location_source_name: '上海',
    keywords: ['Go', 'PostgreSQL'],
  },
};

/** 标准 deferred helper：手动控制一次请求的结算时机。 */
function 延迟结果<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

interface JD操作场景 {
  操作: JD导入操作;
  后端: { 创建JD导入: ReturnType<typeof vi.fn>; 读取JD导入: ReturnType<typeof vi.fn>; 清空目录缓存: ReturnType<typeof vi.fn> };
  派发: ReturnType<typeof vi.fn>;
  设后端状态: ReturnType<typeof vi.fn>;
  后端状态引用: { current: 后端状态 };
  主体标识引用: { current: string | null };
  会话代际: { current: number };
}

function 创建测试依赖(选项: {
  是后端?: boolean;
  角色?: 'candidate' | 'recruiter' | null;
} = {}): JD操作场景 {
  const { 是后端 = true, 角色 = 'recruiter' } = 选项;
  const 桩 = {
    创建JD导入: vi.fn(),
    读取JD导入: vi.fn(),
    清空目录缓存: vi.fn(),
  };
  const 数据源 = 桩 as unknown as HTTP招聘数据源;
  const 主体 = 角色 === null ? null : { subject_id: 'sub_1', roles: [], last_used_role: 角色 };
  const 后端状态引用 = { current: {
    初始化: '完成' as const,
    已登录: true,
    主体,
    简历快照: null,
    意向快照: {},
    岗位快照: {},
    隐私快照: null,
    候选规则快照: {},
    招聘规则快照: {},
    候选规则提案: {},
    招聘规则提案: {},
    Agent规则水合: {
      candidate: { rules: '未开始' as const, proposals: '未开始' as const },
      recruiter: { rules: '未开始' as const, proposals: '未开始' as const },
    },
    ...创建空P4发现状态(),
    ...创建空P5MatchCase状态(),
    ...创建空P7会话状态(),
    ...创建空P8控制面状态(),
    附件简历库: null,
    招聘方档案水合阶段: '未开始' as const,
    招聘方组织水合: { 阶段: '未开始' as const, 错误: null },
    候选预填状态: undefined,
  } as 后端状态 };
  const 设后端状态 = vi.fn((更新: (旧: 后端状态) => 后端状态) => {
    后端状态引用.current = 更新(后端状态引用.current);
  });
  const 依赖 = {
    是后端,
    后端: 数据源,
    派发: vi.fn(),
    设后端状态,
    后端状态引用,
    状态引用: { current: 初始状态 },
    锁: { current: new Set<string>() },
    尝试引用: { current: null as string | null },
    主体标识引用: { current: 'sub_1' as string | null },
    会话代际: { current: 1 },
    读取恢复企业关系编号: vi.fn(() => null),
  } satisfies 后端操作依赖;
  return {
    操作: 创建JD导入操作(依赖),
    后端: 桩,
    派发: 依赖.派发,
    设后端状态,
    后端状态引用,
    主体标识引用: 依赖.主体标识引用,
    会话代际: 依赖.会话代际,
  };
}

// ── Mock / 无后端 / 非 recruiter：零请求 ─────────────────────────

describe('创建JD导入操作 · Mock / 无后端 / 非 recruiter', () => {
  it.each([
    ['无后端', { 是后端: false }],
    ['角色错误', { 角色: 'candidate' as const }],
  ])('%s 时两方法零请求并返回已换代', async (_名, 选项) => {
    const 场景 = 创建测试依赖(选项);
    await expect(场景.操作.创建JD导入(PDF文件(), 幂等键)).resolves.toBe('已换代');
    await expect(场景.操作.读取JD导入(合法ID)).resolves.toBe('已换代');
    expect(场景.后端.创建JD导入).not.toHaveBeenCalled();
    expect(场景.后端.读取JD导入).not.toHaveBeenCalled();
  });

  it('主体未水合（主体 null）时零请求并返回已换代', async () => {
    const 场景 = 创建测试依赖({ 角色: null });
    await expect(场景.操作.读取JD导入(合法ID)).resolves.toBe('已换代');
    expect(场景.后端.读取JD导入).not.toHaveBeenCalled();
  });
});

// ── 参数透传与成功路径 ──────────────────────────────────────────

describe('创建JD导入操作 · 参数原样透传', () => {
  it('两个方法把 File/幂等键/import ID 逐字传给数据源并返回结果', async () => {
    const 场景 = 创建测试依赖();
    const file = PDF文件();
    场景.后端.创建JD导入.mockResolvedValue(成功结果);
    场景.后端.读取JD导入.mockResolvedValue(成功结果);
    await expect(场景.操作.创建JD导入(file, 幂等键)).resolves.toBe(成功结果);
    await expect(场景.操作.读取JD导入(合法ID)).resolves.toBe(成功结果);
    expect(场景.后端.创建JD导入).toHaveBeenCalledWith(file, 幂等键);
    expect(场景.后端.读取JD导入).toHaveBeenCalledWith(合法ID);
  });
});

// ── 迟到栅栏：主体 / 角色 / 会话代际任一失配整包丢弃 ────────────────

describe('创建JD导入操作 · 迟到栅栏（整包丢弃）', () => {
  it('迟到成功在 subject 或 session generation 已变化时整包丢弃', async () => {
    const 门 = 延迟结果<BFFJD导入>();
    const 场景 = 创建测试依赖();
    场景.后端.读取JD导入.mockReturnValue(门.promise);
    const pending = 场景.操作.读取JD导入(合法ID);
    场景.会话代际.current += 1;
    门.resolve(成功结果);
    await expect(pending).resolves.toBe('已换代');
  });

  it('起飞后换主体的迟到成功被丢弃', async () => {
    const 门 = 延迟结果<BFFJD导入>();
    const 场景 = 创建测试依赖();
    场景.后端.读取JD导入.mockReturnValue(门.promise);
    const pending = 场景.操作.读取JD导入(合法ID);
    场景.主体标识引用.current = 'sub_other';
    门.resolve(成功结果);
    await expect(pending).resolves.toBe('已换代');
  });

  it('起飞后角色切离 recruiter 的迟到成功被丢弃', async () => {
    const 门 = 延迟结果<BFFJD导入>();
    const 场景 = 创建测试依赖();
    场景.后端.读取JD导入.mockReturnValue(门.promise);
    const pending = 场景.操作.读取JD导入(合法ID);
    场景.后端状态引用.current = {
      ...场景.后端状态引用.current,
      主体: { subject_id: 'sub_1', roles: [], last_used_role: 'candidate' },
    };
    门.resolve(成功结果);
    await expect(pending).resolves.toBe('已换代');
  });

  it('起飞后会话代际递增的迟到失败也被丢弃（不落页面错误）', async () => {
    const 门 = 延迟结果<never>();
    const 场景 = 创建测试依赖();
    场景.后端.创建JD导入.mockReturnValue(门.promise);
    const pending = 场景.操作.创建JD导入(PDF文件(), 幂等键);
    场景.会话代际.current += 1;
    门.reject(new BFF错误(503, 'operation_outcome_unknown', 'down'));
    await expect(pending).resolves.toBe('已换代');
  });
});

// ── 401：当前栅栏统一清账号，迟到 401 只丢弃 ─────────────────────

describe('创建JD导入操作 · 401 与会话换代', () => {
  it('迟到 401 不清理新会话，当前 401 只走统一清理且页面收到已换代', async () => {
    // 第一段：会话代际已换代后到达的 401 —— 只丢弃，零派发、不清缓存、新会话原样
    const 迟到场景 = 创建测试依赖();
    const 门 = 延迟结果<never>();
    迟到场景.后端.读取JD导入.mockReturnValue(门.promise);
    const 迟到 = 迟到场景.操作.读取JD导入(合法ID);
    const 清理前 = 迟到场景.派发.mock.calls.length;
    迟到场景.会话代际.current += 1;
    门.reject(new BFF错误(401, 'unauthorized', ''));
    await expect(迟到).resolves.toBe('已换代');
    expect(迟到场景.派发.mock.calls.length).toBe(清理前);
    expect(迟到场景.后端状态引用.current.已登录).toBe(true);
    expect(迟到场景.后端.清空目录缓存).not.toHaveBeenCalled();

    // 第二段：当前栅栏 401 —— 统一 清账号状态（内存摊平 + 主体清空 + 代际递增 + 目录缓存清空）
    const 当前场景 = 创建测试依赖();
    当前场景.后端.创建JD导入.mockRejectedValue(new BFF错误(401, 'unauthorized', ''));
    await expect(当前场景.操作.创建JD导入(PDF文件(), 幂等键)).resolves.toBe('已换代');
    expect(当前场景.后端状态引用.current.已登录).toBe(false);
    expect(当前场景.后端状态引用.current.主体).toBeNull();
    expect(当前场景.主体标识引用.current).toBeNull();
    expect(当前场景.会话代际.current).toBeGreaterThan(1);
    expect(当前场景.后端.清空目录缓存).toHaveBeenCalledTimes(1);
    expect(当前场景.派发).toHaveBeenCalled();
  });
});

// ── 当前栅栏的非 401 错误原样抛出 ────────────────────────────────

describe('创建JD导入操作 · 非 401 错误原样抛出', () => {
  it.each([
    ['400 invalid_request_body', new BFF错误(400, 'invalid_request_body', 'bad')],
    ['503 operation_outcome_unknown', new BFF错误(503, 'operation_outcome_unknown', 'down')],
    ['network_error', new BFF错误(0, 'network_error', 'offline')],
    ['invalid_response', new BFF错误(200, 'invalid_response', 'drift')],
    ['普通 Error', new Error('boom')],
  ])('%s：当前栅栏原样抛给页面', async (_名, 错误) => {
    const 场景 = 创建测试依赖();
    场景.后端.读取JD导入.mockRejectedValue(错误);
    await expect(场景.操作.读取JD导入(合法ID)).rejects.toBe(错误);
    expect(场景.后端状态引用.current.已登录).toBe(true);
  });
});
