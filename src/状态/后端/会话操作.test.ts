// P1C Task 2：同 Provider 账号 A→B 的 subject-change 清理必须覆盖组织权威状态，
// A 的未认证公司声明 / 公开企业缓存 / current 选择不能串进 B。
// P3 Task 2：候选隐私成为第三个并行水合域 —— 水合 / 清理 / 过时响应丢弃的用例也在本文件。

import { describe, expect, it, vi } from 'vitest';
import { 创建空P7会话状态 } from './真人会话操作';
import { 创建空P5MatchCase状态 } from './MatchCase操作';
import type { BFF主体, BFF角色, BFF附件简历库 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { BFF错误 } from '../../数据/HTTP客户端';
import {
  BFF公开企业样本,
  BFF企业关系样本,
  BFF主体样本,
  BFF简历样本,
  BFF隐私快照样本,
  BFFAgent规则就绪提案样本,
  BFFAgent规则解释中提案样本,
  BFFAgent规则样本,
  BFF岗位样本,
  BFF招聘方档案样本,
  BFF候选委托回执样本,
} from '../../测试/BFF样本';
import { 从BFF简历 } from '../../数据/后端映射';
import { 从BFF隐私 } from '../../数据/隐私映射';
import type { 页面隐私快照 } from '../../数据/招聘数据源类型';
import { 创建初始状态, 初始状态 } from '../初始状态';
import { 归约 } from '../应用状态';
import { 创建空P4发现状态 } from './发现推荐操作';
import type { 后端操作依赖, 后端状态, P4运行时引用, P7运行时引用 } from './类型';
import { 创建会话操作, 清账号状态, 水合角色数据 } from './会话操作';

/** 依赖 helper：派发重放 归约 到可变 状态引用，断言可以读最终 state。 */
function 创建会话测试依赖(后端: HTTP招聘数据源) {
  const 状态引用 = { current: 初始状态 };
  const 动作流: unknown[] = [];
  const 派发 = vi.fn((动作: Parameters<typeof 归约>[1]) => {
    动作流.push(动作);
    状态引用.current = 归约(状态引用.current, 动作);
  });
  const deps = {
    是后端: true,
    后端,
    派发,
    设后端状态: vi.fn(),
    后端状态引用: { current: {
      初始化: '完成' as const, 已登录: true, 主体: null, 简历快照: null, 意向快照: {}, 岗位快照: {},
      隐私快照: null,
      // P6：Task 3 起 后端状态 携带 Agent 规则原始快照与水合阶段（这里的用例不触达它们）
      候选规则快照: {}, 招聘规则快照: {}, 候选规则提案: {}, 招聘规则提案: {},
      Agent规则水合: {
        candidate: { rules: '未开始' as const, proposals: '未开始' as const },
        recruiter: { rules: '未开始' as const, proposals: '未开始' as const },
      },
      // P4 Task 3 起 后端状态 extends P4发现状态（这里的用例不触达它们）
      ...创建空P4发现状态(),
      // P5：Task 3 起 后端状态 extends P5MatchCase状态（这里的用例不触达它们）
      ...创建空P5MatchCase状态(),
    // P7：Task 2 起 后端状态 extends P7会话状态（这里的用例不触达它们）
    ...创建空P7会话状态(),
      // P2：附件库权威快照（只追加，不动 P6 字段）
      附件简历库: null,
    } },
    状态引用,
    锁: { current: new Set<string>() },
    尝试引用: { current: null as string | null },
    主体标识引用: { current: null as string | null },
    会话代际: { current: 0 },
    读取恢复企业关系编号: vi.fn(() => null),
  };
  return { deps, 动作流 };
}

/** 断言用：把 设后端状态 收到的功能式更新依序折叠到 ref 上，取最终 后端状态。 */
function 最终后端状态(deps: ReturnType<typeof 创建会话测试依赖>['deps']): 后端状态 {
  let 最新: 后端状态 = deps.后端状态引用.current;
  for (const 调用 of deps.设后端状态.mock.calls) {
    最新 = (调用[0] as (旧: 后端状态) => 后端状态)(最新);
  }
  return 最新;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function 主体(subject_id: string): BFF主体 {
  return { ...BFF主体样本, subject_id };
}

describe('完成手机登录 subject-change 组织清理', () => {
  it('A→B 登录派发 清后端组织状态，A 的 claim/公开缓存/current 不进 B', async () => {
    const 后端 = {
      完成手机登录: vi.fn(async () => undefined),
      读取主体: vi.fn()
        .mockResolvedValueOnce(主体('sub_a'))
        .mockResolvedValueOnce(主体('sub_b')),
      清空目录缓存: vi.fn(),
    } as unknown as HTTP招聘数据源;
    const { deps, 动作流 } = 创建会话测试依赖(后端);
    // A 已在 state 里留下组织痕迹：current 选择 + 公开缓存 + 未认证公司声明
    deps.状态引用.current = 归约(归约(归约(初始状态, {
      型: '水合企业关系', 关系: [BFF企业关系样本], 当前编号: BFF企业关系样本.affiliation_id,
    }), { 型: '缓存公开企业', 企业: BFF公开企业样本 }), { 型: '存未认证公司声明', 公司: 'A 的声明' });

    const 操作 = 创建会话操作(deps);
    // A 登录：主体标识引用 从 null → sub_a，不触发清理
    await 操作.完成手机登录('1111');
    expect(动作流).not.toContainEqual({ 型: '清后端组织状态' });
    expect(deps.主体标识引用.current).toBe('sub_a');
    expect(deps.状态引用.current.未认证公司声明).toBe('A 的声明');

    // B 在同一 Provider 登录（读取主体 返回 sub_b）→ subject-change 清理
    await 操作.完成手机登录('2222');
    expect(deps.主体标识引用.current).toBe('sub_b');
    expect(动作流).toContainEqual({ 型: '清后端组织状态' });
    // B 水合前 state 中已无 A 的组织痕迹
    expect(deps.状态引用.current.未认证公司声明).toBe('');
    expect(deps.状态引用.current.公开企业表).toEqual({});
    expect(deps.状态引用.current.当前企业关系编号).toBeNull();
    expect(deps.状态引用.current.企业关系列表).toEqual([]);
  });

  it('同 subject_id 再次登录不触发组织清理', async () => {
    const 后端 = {
      完成手机登录: vi.fn(async () => undefined),
      读取主体: vi.fn().mockResolvedValue(主体('sub_a')),
      清空目录缓存: vi.fn(),
    } as unknown as HTTP招聘数据源;
    const { deps, 动作流 } = 创建会话测试依赖(后端);
    const 操作 = 创建会话操作(deps);
    await 操作.完成手机登录('1111');
    await 操作.完成手机登录('2222');
    expect(动作流).not.toContainEqual({ 型: '清后端组织状态' });
    expect(deps.主体标识引用.current).toBe('sub_a');
  });
});

// ── P3 Task 2：候选隐私水合与全路径清理 ─────────────────────────────

describe('P3 候选隐私水合与清理', () => {
  const 隐私页面样本 = 从BFF隐私(BFF隐私快照样本);

  function 简历意向隐私数据源(覆盖: Record<string, unknown>): HTTP招聘数据源 {
    return {
      读取简历: vi.fn().mockResolvedValue(从BFF简历(BFF简历样本)),
      读取意向: vi.fn(async () => ({ 列表: [], 服务端: {} })),
      读取隐私: vi.fn().mockResolvedValue(从BFF隐私(BFF隐私快照样本)),
      读取Agent规则: vi.fn().mockResolvedValue([]),
      读取Agent规则提案列表: vi.fn().mockResolvedValue([]),
      // P2 Task 3 起候选水合并行读第四个支持域（附件库）：默认空库成功
      读取附件简历库: vi.fn().mockResolvedValue(空附件库样本),
      ...覆盖,
    } as unknown as HTTP招聘数据源;
  }

  it('candidate hydration settles Resume, Intention, and Privacy independently', async () => {
    const 隐私页面样本2 = 从BFF隐私(BFF隐私快照样本);
    const 后端 = {
      读取简历: vi.fn().mockRejectedValue(new Error('resume unavailable')),
      读取意向: vi.fn().mockRejectedValue(new Error('intention unavailable')),
      读取隐私: vi.fn().mockResolvedValue(隐私页面样本2),
      读取Agent规则: vi.fn().mockResolvedValue([]),
      读取Agent规则提案列表: vi.fn().mockResolvedValue([]),
      // P2 Task 3 起候选水合并行读第四个支持域（附件库）：默认空库成功
      读取附件简历库: vi.fn().mockResolvedValue(空附件库样本),
    } as unknown as HTTP招聘数据源;
    const { deps } = 创建会话测试依赖(后端);
    const candidate主体 = { ...BFF主体样本, last_used_role: 'candidate' as const };
    await expect(水合角色数据(deps, candidate主体, false, 1)).resolves.toBe(false);
    expect(deps.派发).toHaveBeenCalledWith({ 型: '水合后端隐私', 快照: 隐私页面样本2 });
    expect(deps.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '水合后端简历' }));
  });

  it('候选任一读取 401 走统一清理时也派发 清后端隐私', async () => {
    const 后端 = 简历意向隐私数据源({
      读取简历: vi.fn().mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired')),
      清空目录缓存: vi.fn(),
    });
    const { deps, 动作流 } = 创建会话测试依赖(后端);
    const 会话失效 = await 水合角色数据(deps, 主体('sub_1'), false, 0);
    expect(会话失效).toBe(true);
    expect(动作流).toContainEqual({ 型: '清后端隐私' });
    expect(最终后端状态(deps).隐私快照).toBeNull();
  });

  it('隐私读取在会话代际变化后到达时被丢弃，不派发 水合后端隐私', async () => {
    const 隐私门 = deferred<页面隐私快照>();
    const 后端 = 简历意向隐私数据源({ 读取隐私: vi.fn(() => 隐私门.promise) });
    const { deps, 动作流 } = 创建会话测试依赖(后端);
    const 水合 = 水合角色数据(deps, 主体('sub_1'), false, 0);
    deps.会话代际.current += 1; // 读在飞期间换了会话
    隐私门.resolve(隐私页面样本);
    await expect(水合).resolves.toBe(false);
    expect(动作流).not.toContainEqual(expect.objectContaining({ 型: '水合后端隐私' }));
  });

  it('隐私读取在主体标识变化后到达时被丢弃，不派发 水合后端隐私', async () => {
    const 隐私门 = deferred<页面隐私快照>();
    const 后端 = 简历意向隐私数据源({ 读取隐私: vi.fn(() => 隐私门.promise) });
    const { deps, 动作流 } = 创建会话测试依赖(后端);
    const 水合 = 水合角色数据(deps, 主体('sub_1'), false, 0);
    deps.主体标识引用.current = 'sub_other'; // 读在飞期间换了账号
    隐私门.resolve(隐私页面样本);
    await expect(水合).resolves.toBe(false);
    expect(动作流).not.toContainEqual(expect.objectContaining({ 型: '水合后端隐私' }));
  });

  it('清账号状态 派发 清后端隐私 并把 后端状态.隐私快照 清成 null', () => {
    const { deps, 动作流 } = 创建会话测试依赖(
      { 清空目录缓存: vi.fn() } as unknown as HTTP招聘数据源,
    );
    清账号状态(deps);
    expect(动作流).toContainEqual({ 型: '清后端隐私' });
    expect(最终后端状态(deps).隐私快照).toBeNull();
  });

  it('跨主体登录 A→B 时清上个账号的隐私快照', async () => {
    const 后端 = {
      完成手机登录: vi.fn(async () => undefined),
      读取主体: vi.fn()
        .mockResolvedValueOnce(主体('sub_a'))
        .mockResolvedValueOnce(主体('sub_b')),
      清空目录缓存: vi.fn(),
    } as unknown as HTTP招聘数据源;
    const { deps, 动作流 } = 创建会话测试依赖(后端);
    const 操作 = 创建会话操作(deps);
    await 操作.完成手机登录('1111');
    expect(动作流).not.toContainEqual({ 型: '清后端隐私' }); // 首次登录不触发
    await 操作.完成手机登录('2222');
    expect(动作流).toContainEqual({ 型: '清后端隐私' });
    expect(最终后端状态(deps).隐私快照).toBeNull();
  });

  it('退出登录 清空隐私快照', async () => {
    const 后端 = {
      退出登录: vi.fn(async () => undefined),
      清空目录缓存: vi.fn(),
    } as unknown as HTTP招聘数据源;
    const { deps, 动作流 } = 创建会话测试依赖(后端);
    await 创建会话操作(deps).退出登录();
    expect(动作流).toContainEqual({ 型: '清后端隐私' });
    expect(最终后端状态(deps).隐私快照).toBeNull();
  });

  it('切身份到招聘方先清隐私再水合招聘方域', async () => {
    const 后端 = {
      确保角色: vi.fn(async (role: string) => ({ ...BFF主体样本, last_used_role: role })),
      记录当前角色: vi.fn(async (role: string) => ({ ...BFF主体样本, last_used_role: role })),
      读取招聘方档案: vi.fn(async () => BFF招聘方档案样本),
      读取我的企业关系: vi.fn(async () => []),
      读取企业管理员申请: vi.fn(async () => []),
      读取岗位: vi.fn(async () => ({ 列表: [], 服务端: {} })),
      清空目录缓存: vi.fn(),
      读取Agent规则: vi.fn().mockResolvedValue([]),
      读取Agent规则提案列表: vi.fn().mockResolvedValue([]),
    } as unknown as HTTP招聘数据源;
    const { deps, 动作流 } = 创建会话测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    await 创建会话操作(deps).切身份('招聘方');
    expect(动作流).toContainEqual({ 型: '清后端隐私' });
    // 清后端隐私 必须先于招聘方组织水合的第一个请求
    const 清序号 = 动作流.findIndex((条) => (条 as { 型: string }).型 === '清后端隐私');
    const 档案序号 = (后端.读取招聘方档案 as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const 派发序号 = deps.派发.mock.invocationCallOrder[清序号];
    expect(派发序号).toBeLessThan(档案序号);
    expect(最终后端状态(deps).隐私快照).toBeNull();
    // 招聘方自有水合照常进行
    expect(后端.读取岗位).toHaveBeenCalled();
  });
});

// ── P6 Task 4：会话水合 / 转移清理与 Backend 种子 ─────────────────────
// 登录/恢复/切身份 把 P6 完整水合并进角色分支；401 / 退出 / 换主体 / 切角色
// 统一清规则域（原始字典 + 双端阶段 + 页面数组），非 401 的 P6 失败不回滚已提交域。

const backend数据源 = { 模式: 'backend' as const, 后端环境: 'stg' as const, 后端: {} as HTTP招聘数据源 };

const candidate主体: BFF主体 = { ...BFF主体样本, subject_id: 'sub_c', last_used_role: 'candidate' };
const recruiter主体: BFF主体 = { ...BFF主体样本, subject_id: 'sub_r', last_used_role: 'recruiter' };

/** P2 附件域的空权威库样本：与数据源 decoder 的闭合 limits 同形。 */
const 空附件库样本: BFF附件简历库 = {
  items: [],
  limits: { max_files: 3, max_file_bytes: 10485760, accepted_media_types: ['application/pdf'] },
};

/** P6 会话用例的完整数据源桩：支持域 + 组织域 + Agent 规则域默认全成功（空集）。 */
function 创建P6数据源桩(): HTTP招聘数据源 {
  return {
    完成手机登录: vi.fn(async () => undefined),
    读取主体: vi.fn(async () => ({ ...BFF主体样本, subject_id: 'sub_1' })),
    退出登录: vi.fn(async () => undefined),
    确保角色: vi.fn(async (role: BFF角色) => ({ ...BFF主体样本, subject_id: 'sub_1', last_used_role: role })),
    记录当前角色: vi.fn(async (role: BFF角色) => ({ ...BFF主体样本, subject_id: 'sub_1', last_used_role: role })),
    读取简历: vi.fn(async () => ({
      基本信息: { 真名: '', 开始工作年: '', 身份: '在职' },
      个人优势: '',
      技能: [],
      经历: [],
      教育: [],
      证书: [],
      服务端快照: {} as never,
    })),
    读取意向: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    读取岗位: vi.fn(async () => ({ 列表: [{ 编号: BFF岗位样本.job_id }], 服务端: { [BFF岗位样本.job_id]: BFF岗位样本 } })),
    读取隐私: vi.fn(async () => 从BFF隐私(BFF隐私快照样本)),
    读取招聘方档案: vi.fn(async () => BFF招聘方档案样本),
    读取我的企业关系: vi.fn(async () => [BFF企业关系样本]),
    读取公开企业: vi.fn(async () => BFF公开企业样本),
    清空目录缓存: vi.fn(),
    读取Agent规则: vi.fn(async () => [] as never[]),
    读取Agent规则提案列表: vi.fn(async () => [] as never[]),
    // P2 Task 3 起候选水合并行读第四个支持域（附件库）：默认空库成功
    读取附件简历库: vi.fn(async () => 空附件库样本),
  } as unknown as HTTP招聘数据源;
}

/** P6 会话依赖：派发重放 归约、设后端状态 镜像到可变值，断言可读最终 后端状态。 */
function 创建P6会话依赖(后端: HTTP招聘数据源) {
  const 状态引用 = { current: 创建初始状态(backend数据源) };
  const 动作流: unknown[] = [];
  const 派发 = vi.fn((动作: Parameters<typeof 归约>[1]) => {
    动作流.push(动作);
    状态引用.current = 归约(状态引用.current, 动作);
  });
  let 后端值: 后端状态 = {
    初始化: '完成',
    已登录: true,
    主体: null,
    简历快照: null,
    意向快照: {},
    岗位快照: {},
    隐私快照: null,
    候选规则快照: {},
    招聘规则快照: {},
    候选规则提案: {},
    招聘规则提案: {},
    Agent规则水合: {
      candidate: { rules: '未开始', proposals: '未开始' },
      recruiter: { rules: '未开始', proposals: '未开始' },
    },
    ...创建空P4发现状态(),
    // P5：Task 3 起 后端状态 extends P5MatchCase状态（这里的用例不触达它们）
    ...创建空P5MatchCase状态(),
    // P7：Task 2 起 后端状态 extends P7会话状态（这里的用例不触达它们）
    ...创建空P7会话状态(),
    // P2：附件库权威快照（只追加，不动 P6 字段）
    附件简历库: null,
  };
  const deps = {
    是后端: true,
    后端,
    派发,
    设后端状态: (更新: (旧: 后端状态) => 后端状态) => {
      后端值 = 更新(后端值);
    },
    后端状态引用: {
      get current() {
        return 后端值;
      },
      set current(值: 后端状态) {
        后端值 = 值;
      },
    },
    状态引用,
    锁: { current: new Set<string>() },
    尝试引用: { current: null as string | null },
    主体标识引用: { current: null as string | null },
    会话代际: { current: 0 },
    读取恢复企业关系编号: vi.fn(() => null),
    P4范围代际: { current: new Map<string, number>() },
    P4幂等意图: { current: new Map<string, string>() },
    P4可见范围: { current: { candidate: null, recruiter: null } },
    P7范围代际: { current: new Map<string, number>() },
    P7待定意图: { current: new Map<string, never>() },
    P7可见收件箱: { current: { candidate: false, recruiter: false } },
    P7可见会话: { current: { candidate: null, recruiter: null } },
    P7已读位置: { current: new Map<string, never>() },
  };
  return {
    deps: deps as unknown as 后端操作依赖 & P4运行时引用 & P7运行时引用 & { 后端: HTTP招聘数据源 },
    动作流,
    状态引用,
    最新后端状态: () => 后端值,
  };
}

function 空水合阶段(): 后端状态['Agent规则水合'] {
  return {
    candidate: { rules: '未开始', proposals: '未开始' },
    recruiter: { rules: '未开始', proposals: '未开始' },
  };
}

describe('P6 会话水合、清理与 Backend 种子', () => {
  it('backend seed contains no Mock Rule rows', () => {
    const state = 创建初始状态(backend数据源);
    expect(state.全局规则).toEqual([]);
    expect(state.意向级规则).toEqual([]);
    expect(state.企业规则).toEqual([]);
  });

  it('candidate hydration commits Rules and both actionable Proposal states', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取Agent规则).mockResolvedValue([BFFAgent规则样本]);
    vi.mocked(后端.读取Agent规则提案列表)
      .mockResolvedValueOnce([BFFAgent规则解释中提案样本])
      .mockResolvedValueOnce([BFFAgent规则就绪提案样本]);
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.会话代际.current = 7;
    await 水合角色数据(deps, candidate主体, true, 7);
    expect(后端.读取Agent规则).toHaveBeenCalledWith('candidate');
    expect(vi.mocked(后端.读取Agent规则提案列表).mock.calls).toEqual([
      ['candidate', 'interpreting'],
      ['candidate', 'ready'],
    ]);
    expect(最新后端状态().Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' });
    expect(最新后端状态().候选规则快照[BFFAgent规则样本.rule_id]).toEqual(BFFAgent规则样本);
    expect(最新后端状态().候选规则提案[BFFAgent规则就绪提案样本.proposal_id]).toEqual(BFFAgent规则就绪提案样本);
  });

  it('each initially incomplete P6 domain is 进行中 while its reads are outstanding', async () => {
    const 后端 = 创建P6数据源桩();
    const 规则门 = deferred<typeof BFFAgent规则样本[]>();
    const 清单门 = deferred<never[]>();
    vi.mocked(后端.读取Agent规则).mockReturnValue(规则门.promise as never);
    vi.mocked(后端.读取Agent规则提案列表).mockReturnValue(清单门.promise as never);
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.会话代际.current = 7;
    const 运行 = 水合角色数据(deps, candidate主体, false, 7);
    // 读取未落定时两域都在 进行中，另一角色的种子不受影响
    expect(最新后端状态().Agent规则水合.candidate).toEqual({ rules: '进行中', proposals: '进行中' });
    expect(最新后端状态().Agent规则水合.recruiter).toEqual({ rules: '未开始', proposals: '未开始' });
    规则门.resolve([BFFAgent规则样本]);
    清单门.resolve([] as never);
    await 运行;
    expect(最新后端状态().Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' });
  });

  it('role switch clears old P6 state before target hydration and discards late responses', async () => {
    const 后端 = 创建P6数据源桩();
    const lateCandidate = deferred<typeof BFFAgent规则样本[]>();
    vi.mocked(后端.读取Agent规则).mockReturnValueOnce(lateCandidate.promise);
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.会话代际.current = 10;
    const candidateRun = 水合角色数据(deps, candidate主体, true, 10);
    deps.主体标识引用.current = recruiter主体.subject_id;
    deps.会话代际.current = 11;
    await 水合角色数据(deps, recruiter主体, true, 11);
    lateCandidate.resolve([BFFAgent规则样本]);
    await candidateRun;
    expect(最新后端状态().候选规则快照).toEqual({});
  });

  it('a rejected Rule read marks rules 失败 without rolling back Resume/Intentions', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取Agent规则).mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    const 简历快照 = {
      基本信息: { 真名: '沈亦舟', 开始工作年: '2017', 身份: '在职' as const },
      个人优势: '优势文本',
      技能: [],
      经历: [],
      教育: [],
      证书: [],
      服务端快照: { profile_revision: 5 } as never,
    };
    vi.mocked(后端.读取简历).mockResolvedValue(简历快照 as never);
    const { deps, 最新后端状态, 状态引用 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.会话代际.current = 7;
    // mount-init：非 401 失败只 轻提示，不抛出，初始化照常完成
    const 会话失效 = await 水合角色数据(deps, candidate主体, false, 7);
    expect(会话失效).toBe(false);
    expect(最新后端状态().Agent规则水合.candidate.rules).toBe('失败');
    // P6 失败不回滚已成功提交的简历/意向
    expect(最新后端状态().简历快照).toEqual({ profile_revision: 5 });
    expect(状态引用.current.个人优势).toBe('优势文本');
  });

  it('interactive P6 Rule failure surfaces with the existing error strategy', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取Agent规则).mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    const { deps } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.会话代际.current = 7;
    await expect(水合角色数据(deps, candidate主体, true, 7)).rejects.toMatchObject({ status: 503 });
  });

  it('either Proposal-list rejection marks proposals 失败 while the successful sibling stays 成功', async () => {
    for (const 落败清单 of ['interpreting', 'ready'] as const) {
      const 后端 = 创建P6数据源桩();
      vi.mocked(后端.读取Agent规则).mockResolvedValue([BFFAgent规则样本]);
      vi.mocked(后端.读取Agent规则提案列表).mockImplementation(async (_role: BFF角色, state: 'interpreting' | 'ready') => {
        if (state === 落败清单) throw new BFF错误(503, 'downstream_unavailable', 'down');
        return [] as never;
      });
      const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
      deps.主体标识引用.current = candidate主体.subject_id;
      deps.会话代际.current = 7;
      const 会话失效 = await 水合角色数据(deps, candidate主体, false, 7);
      expect(会话失效).toBe(false);
      expect(最新后端状态().Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '失败' });
      // 任一清单失败就不提交半份提案表
      expect(最新后端状态().候选规则提案).toEqual({});
    }
  });

  it('a refresh starting from 成功 keeps both stages 成功 while reads are outstanding', async () => {
    const 后端 = 创建P6数据源桩();
    const 规则门 = deferred<typeof BFFAgent规则样本[]>();
    const 清单门 = deferred<never[]>();
    vi.mocked(后端.读取Agent规则).mockReturnValueOnce(规则门.promise as never);
    vi.mocked(后端.读取Agent规则提案列表)
      .mockReturnValueOnce(清单门.promise as never)
      .mockReturnValueOnce(清单门.promise as never);
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.会话代际.current = 7;
    deps.设后端状态((旧) => ({
      ...旧,
      候选规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
      Agent规则水合: {
        candidate: { rules: '成功', proposals: '成功' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
    }));
    const 运行 = 水合角色数据(deps, candidate主体, false, 7);
    // 刷新途中已 成功 的域不得降级，快照行不闪退
    expect(最新后端状态().Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' });
    expect(最新后端状态().候选规则快照[BFFAgent规则样本.rule_id]).toEqual(BFFAgent规则样本);
    规则门.resolve([BFFAgent规则样本]);
    清单门.resolve([] as never);
    await 运行;
    expect(最新后端状态().Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' });
  });

  it('P6 读取 401 时统一清账号：原始字典清空、双端回 未开始、页面数组清空', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取Agent规则).mockRejectedValue(new BFF错误(401, 'invalid_session', '过期'));
    const { deps, 最新后端状态, 状态引用, 动作流 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.会话代际.current = 7;
    // 先埋上个会话的 P6 残留
    deps.设后端状态((旧) => ({
      ...旧,
      候选规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
      招聘规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
      候选规则提案: { [BFFAgent规则就绪提案样本.proposal_id]: BFFAgent规则就绪提案样本 },
      Agent规则水合: {
        candidate: { rules: '成功', proposals: '成功' },
        recruiter: { rules: '成功', proposals: '成功' },
      },
    }));
    const 会话失效 = await 水合角色数据(deps, candidate主体, false, 7);
    expect(会话失效).toBe(true);
    const 最新 = 最新后端状态();
    expect(最新.已登录).toBe(false);
    expect(最新.主体).toBeNull();
    expect(最新.候选规则快照).toEqual({});
    expect(最新.招聘规则快照).toEqual({});
    expect(最新.候选规则提案).toEqual({});
    expect(最新.招聘规则提案).toEqual({});
    expect(最新.Agent规则水合).toEqual(空水合阶段());
    expect(deps.主体标识引用.current).toBeNull();
    expect(动作流).toContainEqual({ 型: '清后端Agent规则' });
    expect(状态引用.current.全局规则).toEqual([]);
    expect(状态引用.current.意向级规则).toEqual([]);
    expect(状态引用.current.企业规则).toEqual([]);
    expect(后端.清空目录缓存).toHaveBeenCalled();
  });

  it('recruiter P6 failure keeps Organization/Jobs commits intact', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取Agent规则).mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    const { deps, 最新后端状态, 状态引用 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = recruiter主体.subject_id;
    deps.会话代际.current = 7;
    const 会话失效 = await 水合角色数据(deps, recruiter主体, false, 7);
    expect(会话失效).toBe(false);
    expect(最新后端状态().Agent规则水合.recruiter.rules).toBe('失败');
    // P6 失败不回滚已成功提交的组织与岗位
    expect(状态引用.current.招聘方档案).toEqual(BFF招聘方档案样本);
    expect(状态引用.current.企业关系列表).toEqual([BFF企业关系样本]);
    expect(最新后端状态().岗位快照).toEqual({ [BFF岗位样本.job_id]: BFF岗位样本 });
  });

  it('退出登录 clears P6 raw dicts, resets both roles, and clears page arrays', async () => {
    const 后端 = 创建P6数据源桩();
    const { deps, 最新后端状态, 状态引用, 动作流 } = 创建P6会话依赖(后端);
    const 操作 = 创建会话操作(deps);
    deps.设后端状态((旧) => ({
      ...旧,
      候选规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
      Agent规则水合: {
        candidate: { rules: '成功', proposals: '成功' },
        recruiter: { rules: '成功', proposals: '成功' },
      },
    }));
    状态引用.current = 归约(初始状态, {
      型: '水合后端候选规则',
      全局: [{
        编号: BFFAgent规则样本.rule_id, 内容: BFFAgent规则样本.display_text, 来源: '测试', 生效: true,
        作用域: { 类型: '全局' as const }, 服务端版本: BFFAgent规则样本.version, 服务端状态: 'active' as const,
      }],
      意向级: [],
    });
    await 操作.退出登录();
    expect(动作流).toContainEqual({ 型: '清后端Agent规则' });
    expect(最新后端状态().候选规则快照).toEqual({});
    expect(最新后端状态().Agent规则水合).toEqual(空水合阶段());
    expect(状态引用.current.全局规则).toEqual([]);
    expect(状态引用.current.意向级规则).toEqual([]);
    expect(状态引用.current.企业规则).toEqual([]);
  });

  it('完成手机登录 new subject clears P6 raw dicts and resets both roles to 未开始', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取主体)
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_a' })
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_b' });
    const { deps, 最新后端状态, 动作流 } = 创建P6会话依赖(后端);
    const 操作 = 创建会话操作(deps);
    await 操作.完成手机登录('1111');
    // A 留下 P6 残留
    deps.设后端状态((旧) => ({
      ...旧,
      候选规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
      Agent规则水合: {
        candidate: { rules: '成功', proposals: '成功' },
        recruiter: { rules: '成功', proposals: '成功' },
      },
    }));
    await 操作.完成手机登录('2222');
    expect(动作流).toContainEqual({ 型: '清后端Agent规则' });
    expect(最新后端状态().候选规则快照).toEqual({});
    expect(最新后端状态().招聘规则快照).toEqual({});
    expect(最新后端状态().Agent规则水合).toEqual(空水合阶段());
  });

  it('切身份 resets P6 before target hydration, advances generation, and runs the full path', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_1' });
    const { deps, 最新后端状态, 动作流 } = 创建P6会话依赖(后端);
    const 操作 = 创建会话操作(deps);
    // 上个候选会话留下 成功 + 卡死的 进行中 与残留
    deps.主体标识引用.current = 'sub_1';
    deps.设后端状态((旧) => ({
      ...旧,
      主体: candidate主体,
      候选规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
      Agent规则水合: {
        candidate: { rules: '成功', proposals: '进行中' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
    }));
    await 操作.切身份('招聘方');
    expect(动作流).toContainEqual({ 型: '清后端Agent规则' });
    // 切角色 = 角色转移：会话代际前进，上个角色的在飞响应整包作废
    expect(deps.会话代际.current).toBe(1);
    const 最新 = 最新后端状态();
    // 上个角色的状态被清、阶段回 未开始，绝不粘住 进行中
    expect(最新.候选规则快照).toEqual({});
    expect(最新.Agent规则水合.candidate).toEqual({ rules: '未开始', proposals: '未开始' });
    // 目标角色完整水合收口
    expect(最新.Agent规则水合.recruiter).toEqual({ rules: '成功', proposals: '成功' });
    expect(后端.读取Agent规则).toHaveBeenCalledWith('recruiter');
  });

  it('last_used_role null keeps the identity screen: no P6 hydration, no reads', async () => {
    const 后端 = 创建P6数据源桩();
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = 'sub_null';
    deps.会话代际.current = 3;
    const 会话失效 = await 水合角色数据(
      deps, { ...BFF主体样本, subject_id: 'sub_null', last_used_role: null }, false, 3,
    );
    expect(会话失效).toBe(false);
    expect(后端.读取Agent规则).not.toHaveBeenCalled();
    expect(后端.读取Agent规则提案列表).not.toHaveBeenCalled();
    expect(后端.读取简历).not.toHaveBeenCalled();
    expect(最新后端状态().Agent规则水合).toEqual(空水合阶段());
  });
});

// ── P4 Task 3：discovery 域加入会话边界清理 ─────────────────────────
// 清账号状态 / 登录换主体 / 切身份 三个转移口都要：raw 快照回空底座 +
// 双 Map（范围代际 / 幂等意图）清空 + 双端可见范围回 null。

describe('P4 discovery 会话清理', () => {
  /** 在 后端状态 与三个 P4 引用里播上如上个会话残留的痕迹。 */
  function 播P4残留(deps: ReturnType<typeof 创建P6会话依赖>['deps']): void {
    deps.设后端状态((旧) => ({
      ...旧,
      候选岗位推荐: { int_old: { 阶段: '成功', 刷新中: false, items: [], error: null, generation: 1 } },
      候选岗位不可用: ['job_gone'],
      招聘已筛聚合: { 阶段: '成功', jobKey: 'recruiter:rejected:job_1', error: null },
      P4委托回执: { del_1: BFF候选委托回执样本 },
    }));
    deps.P4范围代际.current.set('candidate:list:int_1', 3);
    deps.P4幂等意图.current.set('candidate:list:int_1:refresh', 'idem_1');
    deps.P4可见范围.current = { candidate: 'candidate:list:int_1', recruiter: 'recruiter:list:job_1' };
  }

  function 断言P4已清空(deps: ReturnType<typeof 创建P6会话依赖>['deps']): void {
    const 最新 = deps.后端状态引用.current;
    expect(最新.候选岗位推荐).toEqual({});
    expect(最新.候选岗位详情).toEqual({});
    expect(最新.候选岗位不可用).toEqual([]);
    expect(最新.招聘可用候选).toEqual({});
    expect(最新.招聘已筛候选).toEqual({});
    expect(最新.招聘已筛聚合).toEqual({ 阶段: '未开始', jobKey: '', error: null });
    expect(最新.招聘候选详情).toEqual({});
    expect(最新.招聘候选不可用).toEqual([]);
    expect(最新.P4委托回执).toEqual({});
    expect(最新.P4真实Case引用).toEqual({});
    expect(deps.P4范围代际.current.size).toBe(0);
    expect(deps.P4幂等意图.current.size).toBe(0);
    expect(deps.P4可见范围.current).toEqual({ candidate: null, recruiter: null });
  }

  it('清账号状态 清空 P4 发现快照并复位双 Map 与可见范围', () => {
    const { deps } = 创建P6会话依赖(创建P6数据源桩());
    播P4残留(deps);
    清账号状态(deps);
    断言P4已清空(deps);
    expect(deps.主体标识引用.current).toBeNull();
    expect(deps.会话代际.current).toBe(1);
  });

  it('退出登录 清空 P4 discovery 残留', async () => {
    const { deps } = 创建P6会话依赖(创建P6数据源桩());
    const 操作 = 创建会话操作(deps);
    播P4残留(deps);
    await 操作.退出登录();
    断言P4已清空(deps);
    expect(deps.后端状态引用.current.已登录).toBe(false);
  });

  it('完成手机登录 换主体时清 P4 discovery 残留', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取主体)
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_a' })
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_b' });
    const { deps } = 创建P6会话依赖(后端);
    const 操作 = 创建会话操作(deps);
    await 操作.完成手机登录('1111');
    播P4残留(deps);
    await 操作.完成手机登录('2222');
    断言P4已清空(deps);
    expect(deps.主体标识引用.current).toBe('sub_b');
  });

  it('切身份 清 P4 discovery 残留后才水合目标角色', async () => {
    const { deps, 动作流 } = 创建P6会话依赖(创建P6数据源桩());
    const 操作 = 创建会话操作(deps);
    deps.主体标识引用.current = 'sub_1';
    await 操作.完成手机登录('1111');
    播P4残留(deps);
    await 操作.切身份('招聘方');
    断言P4已清空(deps);
    // 目标角色的支持域水合照常跑完
    expect(动作流).toContainEqual({ 型: '切身份', 到: '招聘方' });
  });
});

// ── P2 Task 3：附件简历第四支持域水合与清理 ─────────────────────────
// 候选支持域由三路扩成四路（简历/意向/隐私/附件库）且各域独立提交；
// P6 三路并发与错误扫描断言不回归；所有账号清理路径同时清附件快照。

describe('P2 附件支持域水合与清理', () => {
  it('candidate 水合并行读四个支持域，附件独立提交且 P6 三路照旧', async () => {
    const 后端 = 创建P6数据源桩();
    // 隐私失败不牵连附件：支持域各域独立提交
    vi.mocked(后端.读取隐私).mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    const 有附件库: BFF附件简历库 = {
      items: [{
        file_id: 'rf_1', display_name: '沈亦舟_简历_2026.pdf', revision: 1,
        current_version: {
          version_id: 'rfv_1', version: 1, size_bytes: 1, media_type: 'application/pdf',
          sha256: 'a'.repeat(64), created_at: '2026-08-28T00:00:00Z', parse: { status: 'not_started' },
        },
        created_at: '2026-08-28T00:00:00Z', updated_at: '2026-08-28T00:00:00Z',
      }],
      limits: { max_files: 3, max_file_bytes: 10485760, accepted_media_types: ['application/pdf'] },
    };
    vi.mocked(后端.读取附件简历库).mockResolvedValue(有附件库);
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.会话代际.current = 7;
    const 会话失效 = await 水合角色数据(deps, candidate主体, false, 7);
    expect(会话失效).toBe(false);
    // 四个支持域各读一次
    expect(后端.读取简历).toHaveBeenCalledTimes(1);
    expect(后端.读取意向).toHaveBeenCalledTimes(1);
    expect(后端.读取隐私).toHaveBeenCalledTimes(1);
    expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
    // P6 三路并发照旧
    expect(后端.读取Agent规则).toHaveBeenCalledWith('candidate');
    expect(vi.mocked(后端.读取Agent规则提案列表).mock.calls).toEqual([
      ['candidate', 'interpreting'],
      ['candidate', 'ready'],
    ]);
    // 附件独立提交：隐私失败不撤销附件
    expect(最新后端状态().附件简历库).toEqual(有附件库);
    // P6 阶段照常收口，不因附件域改变
    expect(最新后端状态().Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' });
  });

  it('附件读取 401 走统一登出清理：附件与 P6 一起清空', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取附件简历库).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const { deps, 最新后端状态, 状态引用, 动作流 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.会话代际.current = 7;
    const 会话失效 = await 水合角色数据(deps, candidate主体, false, 7);
    expect(会话失效).toBe(true);
    const 最新 = 最新后端状态();
    expect(最新.已登录).toBe(false);
    expect(最新.主体).toBeNull();
    expect(最新.附件简历库).toBeNull();
    expect(最新.Agent规则水合).toEqual(空水合阶段());
    expect(deps.主体标识引用.current).toBeNull();
    expect(动作流).toContainEqual({ 型: '清后端Agent规则' });
    expect(状态引用.current.全局规则).toEqual([]);
  });

  it('附件读取非 401 失败只影响该域：mount 不抛、只提示该域一次、其它支持域与 P6 阶段保留', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取附件简历库).mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    const { deps, 最新后端状态, 状态引用 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.会话代际.current = 7;
    // 轻提示 是纯 DOM 单例容器：清掉此前用例的残留条目，水合后应恰好新增该域一条
    const 提示容器 = Array.from(document.body.children).find(
      (节点) => (节点 as HTMLElement).style?.zIndex === '999',
    ) as HTMLElement | undefined;
    if (提示容器) 提示容器.innerHTML = '';
    const 会话失效 = await 水合角色数据(deps, candidate主体, false, 7);
    expect(会话失效).toBe(false);
    expect(提示容器?.childElementCount).toBe(1);
    expect(最新后端状态().附件简历库).toBeNull();
    // 其它支持域照常提交
    expect(状态引用.current.求职意向表).toEqual([]);
    // P6 阶段不被附件失败改变
    expect(最新后端状态().Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' });
  });

  it('交互水合附件失败时抛出该错误', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取附件简历库).mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    const { deps } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.会话代际.current = 7;
    await expect(水合角色数据(deps, candidate主体, true, 7)).rejects.toMatchObject({ status: 503 });
  });

  it('附件读取在会话代际变化后到达时被丢弃，不写附件快照', async () => {
    const 后端 = 创建P6数据源桩();
    const 附件门 = deferred<BFF附件简历库>();
    vi.mocked(后端.读取附件简历库).mockReturnValue(附件门.promise);
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.会话代际.current = 7;
    const 水合 = 水合角色数据(deps, candidate主体, false, 7);
    deps.会话代际.current += 1; // 读在飞期间换了会话
    附件门.resolve(空附件库样本);
    await expect(水合).resolves.toBe(false);
    expect(最新后端状态().附件简历库).toBeNull();
  });

  it('附件读取在主体标识变化后到达时被丢弃，不写附件快照', async () => {
    const 后端 = 创建P6数据源桩();
    const 附件门 = deferred<BFF附件简历库>();
    vi.mocked(后端.读取附件简历库).mockReturnValue(附件门.promise);
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.会话代际.current = 7;
    const 水合 = 水合角色数据(deps, candidate主体, false, 7);
    deps.主体标识引用.current = 'sub_other'; // 读在飞期间换了账号
    附件门.resolve(空附件库样本);
    await expect(水合).resolves.toBe(false);
    expect(最新后端状态().附件简历库).toBeNull();
  });

  it('recruiter 水合不读附件并把候选附件快照清成 null', async () => {
    const 后端 = 创建P6数据源桩();
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = recruiter主体.subject_id;
    deps.会话代际.current = 7;
    // 上个候选会话留下的附件残留
    deps.设后端状态((旧) => ({ ...旧, 附件简历库: 空附件库样本 }));
    const 会话失效 = await 水合角色数据(deps, recruiter主体, false, 7);
    expect(会话失效).toBe(false);
    expect(后端.读取附件简历库).not.toHaveBeenCalled();
    expect(最新后端状态().附件简历库).toBeNull();
    // P6 招聘方水合照常
    expect(后端.读取Agent规则).toHaveBeenCalledWith('recruiter');
  });

  it('last_used_role null 不读附件，附件快照保持 null', async () => {
    const 后端 = 创建P6数据源桩();
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = 'sub_null';
    deps.会话代际.current = 3;
    const 会话失效 = await 水合角色数据(
      deps, { ...BFF主体样本, subject_id: 'sub_null', last_used_role: null }, false, 3,
    );
    expect(会话失效).toBe(false);
    expect(后端.读取附件简历库).not.toHaveBeenCalled();
    expect(最新后端状态().附件简历库).toBeNull();
  });

  it('退出登录清空附件快照且 P6 清理断言不回归', async () => {
    const 后端 = 创建P6数据源桩();
    const { deps, 最新后端状态, 状态引用, 动作流 } = 创建P6会话依赖(后端);
    const 操作 = 创建会话操作(deps);
    deps.设后端状态((旧) => ({ ...旧, 附件简历库: 空附件库样本 }));
    状态引用.current = 归约(初始状态, {
      型: '水合后端候选规则',
      全局: [{
        编号: BFFAgent规则样本.rule_id, 内容: BFFAgent规则样本.display_text, 来源: '测试', 生效: true,
        作用域: { 类型: '全局' as const }, 服务端版本: BFFAgent规则样本.version, 服务端状态: 'active' as const,
      }],
      意向级: [],
    });
    await 操作.退出登录();
    expect(最新后端状态().附件简历库).toBeNull();
    expect(动作流).toContainEqual({ 型: '清后端Agent规则' });
    expect(最新后端状态().候选规则快照).toEqual({});
    expect(最新后端状态().Agent规则水合).toEqual(空水合阶段());
    expect(状态引用.current.全局规则).toEqual([]);
  });

  it('完成手机登录换主体清空附件快照且 P6 清理不回归', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取主体)
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_a' })
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_b' });
    const { deps, 最新后端状态, 动作流 } = 创建P6会话依赖(后端);
    const 操作 = 创建会话操作(deps);
    await 操作.完成手机登录('1111');
    // A 留下附件与 P6 残留
    deps.设后端状态((旧) => ({
      ...旧,
      附件简历库: 空附件库样本,
      候选规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
    }));
    await 操作.完成手机登录('2222');
    expect(动作流).toContainEqual({ 型: '清后端Agent规则' });
    expect(最新后端状态().附件简历库).toBeNull();
    expect(最新后端状态().候选规则快照).toEqual({});
    expect(最新后端状态().Agent规则水合).toEqual(空水合阶段());
  });

  it('清账号状态 同时清附件快照与 P6 域', () => {
    const { deps, 最新后端状态, 动作流 } = 创建P6会话依赖(创建P6数据源桩());
    deps.设后端状态((旧) => ({
      ...旧,
      附件简历库: 空附件库样本,
      候选规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
    }));
    清账号状态(deps);
    expect(最新后端状态().附件简历库).toBeNull();
    expect(最新后端状态().候选规则快照).toEqual({});
    expect(最新后端状态().已登录).toBe(false);
    expect(动作流).toContainEqual({ 型: '清后端Agent规则' });
  });

  it('切身份到招聘方清空附件快照且招聘方水合不读附件', async () => {
    const 后端 = 创建P6数据源桩();
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    const 操作 = 创建会话操作(deps);
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.设后端状态((旧) => ({ ...旧, 附件简历库: 空附件库样本 }));
    await 操作.切身份('招聘方');
    expect(后端.读取附件简历库).not.toHaveBeenCalled();
    expect(最新后端状态().附件简历库).toBeNull();
  });
});

// ── P7 Task 2：真人会话域加入会话边界清理 ─────────────────────────
// 清账号状态 / 登录换主体 / 切身份 三个转移口都要：raw 快照回空底座 +
// 五个引用（范围代际 / 待定意图 / 可见收件箱 / 可见会话 / 已读位置）复位。
// 已读位置含 成功 / 在飞 / 终局拒绝 三态，任何 P7 值都不落持久化。

describe('P7 真人会话会话清理', () => {
  /** 在 后端状态 与五个 P7 引用里播上上个会话残留的痕迹。 */
  function 播P7残留(deps: ReturnType<typeof 创建P6会话依赖>['deps']): void {
    deps.设后端状态((旧) => ({
      ...旧,
      P7收件箱: {
        candidate: {
          阶段: '成功', 刷新中: false, items: [{
            conversationId: '3003', caseId: 'mc_3003', kind: 'human_handoff',
            lastMessage: null, lastActivityAt: '2026-08-30T01:00:00Z', unreadCount: 2,
            contextStatus: 'available',
            context: { primaryLabel: '后端工程师', secondaryLabel: '上海', jobRef: null, resumeRef: null },
          }],
          nextCursor: null, 已加载页数: 1, error: null, generation: 2,
        },
        recruiter: { 阶段: '未开始', 刷新中: false, items: [], nextCursor: null, 已加载页数: 0, error: null, generation: 0 },
      },
      P7会话详情: {
        'p7:detail:candidate:3003': {
          阶段: '成功', 刷新中: false, detail: null, error: null, generation: 1,
        },
      },
      P7消息页: {
        'p7:messages:candidate:3003': {
          阶段: '成功', 刷新中: false, items: [], nextCursor: null, 已加载页数: 1, error: null, generation: 1,
        },
      },
    }));
    deps.P7范围代际.current.set('p7:detail:candidate:3003', 2);
    deps.P7待定意图.current.set('p7:意图:candidate:3003', {
      key: 'idem-p7-residue', content: '你好', watermark: '4004',
    } as never);
    deps.P7可见收件箱.current = { candidate: true, recruiter: true };
    deps.P7可见会话.current = { candidate: '3003', recruiter: '3003' };
    deps.P7已读位置.current.set('p7:read:candidate:3003', {
      lastSuccessful: '4004', inFlight: '4005', terminalRejected: '4003',
    } as never);
  }

  function 断言P7已清空(deps: ReturnType<typeof 创建P6会话依赖>['deps']): void {
    const 最新 = deps.后端状态引用.current;
    expect(最新.P7收件箱.candidate).toEqual({
      阶段: '未开始', 刷新中: false, items: [], nextCursor: null, 已加载页数: 0,
      error: null, generation: 0,
    });
    expect(最新.P7收件箱.recruiter.阶段).toBe('未开始');
    expect(最新.P7会话详情).toEqual({});
    expect(最新.P7消息页).toEqual({});
    expect(deps.P7范围代际.current.size).toBe(0);
    expect(deps.P7待定意图.current.size).toBe(0);
    expect(deps.P7已读位置.current.size).toBe(0);
    expect(deps.P7可见收件箱.current).toEqual({ candidate: false, recruiter: false });
    expect(deps.P7可见会话.current).toEqual({ candidate: null, recruiter: null });
  }

  it('清账号状态 清空 P7 真人会话快照并复位全部引用', () => {
    const { deps } = 创建P6会话依赖(创建P6数据源桩());
    播P7残留(deps);
    清账号状态(deps);
    断言P7已清空(deps);
    expect(deps.主体标识引用.current).toBeNull();
    expect(deps.会话代际.current).toBe(1);
  });

  it('退出登录 清空 P7 真人会话残留', async () => {
    const { deps } = 创建P6会话依赖(创建P6数据源桩());
    const 操作 = 创建会话操作(deps);
    播P7残留(deps);
    await 操作.退出登录();
    断言P7已清空(deps);
    expect(deps.后端状态引用.current.已登录).toBe(false);
  });

  it('完成手机登录 换主体时清 P7 真人会话残留', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取主体)
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_a' })
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_b' });
    const { deps } = 创建P6会话依赖(后端);
    const 操作 = 创建会话操作(deps);
    await 操作.完成手机登录('1111');
    播P7残留(deps);
    await 操作.完成手机登录('2222');
    断言P7已清空(deps);
    expect(deps.主体标识引用.current).toBe('sub_b');
  });

  it('切身份 清 P7 真人会话残留后才水合目标角色', async () => {
    const { deps, 动作流 } = 创建P6会话依赖(创建P6数据源桩());
    const 操作 = 创建会话操作(deps);
    deps.主体标识引用.current = 'sub_1';
    await 操作.完成手机登录('1111');
    播P7残留(deps);
    await 操作.切身份('招聘方');
    断言P7已清空(deps);
    expect(动作流).toContainEqual({ 型: '切身份', 到: '招聘方' });
  });
});
