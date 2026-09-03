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
  BFF意向样本,
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
import type { 页面简历快照, 页面岗位快照, 页面隐私快照 } from '../../数据/招聘数据源类型';
import { 创建初始状态, 初始状态 } from '../初始状态';
import { 归约 } from '../应用状态';
import { 创建空P4发现状态 } from './发现推荐操作';
import type {
  后端操作依赖, 后端状态, 候选预填恢复存储, 候选预填状态, 候选预填运行时引用,
  P4运行时引用, P7运行时引用, P8运行时引用,
} from './类型';
import { 创建空候选预填状态 } from './类型';
import { 创建会话操作, 清账号状态, 水合角色数据 } from './会话操作';
import { 创建空P8控制面状态 } from './P8控制面操作';

/** 本测试文件内的 后端状态 底座：用例按 覆盖 换掉自己要钉的字段（如招聘方水合阶段）。 */
function 创建测试后端状态(覆盖: Partial<后端状态> = {}): 后端状态 {
  return {
    初始化: '完成', 已登录: true, 主体: null, 简历快照: null, 意向快照: {}, 岗位快照: {},
    隐私快照: null,
    // P6：Task 3 起 后端状态 携带 Agent 规则原始快照与水合阶段（这里的用例不触达它们）
    候选规则快照: {}, 招聘规则快照: {}, 候选规则提案: {}, 招聘规则提案: {},
    Agent规则水合: {
      candidate: { rules: '未开始', proposals: '未开始' },
      recruiter: { rules: '未开始', proposals: '未开始' },
    },
    // P4 Task 3 起 后端状态 extends P4发现状态（这里的用例不触达它们）
    ...创建空P4发现状态(),
    // P5：Task 3 起 后端状态 extends P5MatchCase状态（这里的用例不触达它们）
    ...创建空P5MatchCase状态(),
    // P7：Task 2 起 后端状态 extends P7会话状态（这里的用例不触达它们）
    ...创建空P7会话状态(),
    // P8：Task 3 起 后端状态 extends P8控制面状态（这里的用例不触达它们）
    ...创建空P8控制面状态(),
    // P2：附件库权威快照（只追加，不动 P6 字段）
    附件简历库: null,
    // P0 修复 Task 1：招聘方档案 / 组织链两个水合阶段的干净底座
    招聘方档案水合阶段: '未开始',
    招聘方组织水合: { 阶段: '未开始', 错误: null },
    ...覆盖,
  };
}

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
    后端状态引用: { current: 创建测试后端状态() },
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

/** 动态取轻提示条数：每次断言都重查单例容器，新创建的容器逃不出 undefined 的捕获引用。 */
function 轻提示条数(): number {
  return (Array.from(document.body.children).find(
    (节点) => (节点 as HTMLElement).style?.zIndex === '999',
  ) as HTMLElement | undefined)?.childElementCount ?? 0;
}

function 清空轻提示(): void {
  const 容器 = Array.from(document.body.children).find(
    (节点) => (节点 as HTMLElement).style?.zIndex === '999',
  ) as HTMLElement | undefined;
  if (容器) 容器.innerHTML = '';
}

function 主体(subject_id: string): BFF主体 {
  return { ...BFF主体样本, subject_id };
}

describe('完成手机登录 subject-change 组织清理', () => {
  it('A→B 登录派发 清后端组织状态，A 的 claim/公开缓存/current 不进 B', async () => {
    const 后端 = {
      完成手机登录: vi.fn(async () => undefined),
      // last_used_role null：本用例只断言组织域清理，登录水合不进角色分支
      读取主体: vi.fn()
        .mockResolvedValueOnce({ ...主体('sub_a'), last_used_role: null })
        .mockResolvedValueOnce({ ...主体('sub_b'), last_used_role: null }),
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
      // last_used_role null：只看组织清理口径，登录水合不进角色分支
      读取主体: vi.fn().mockResolvedValue({ ...主体('sub_a'), last_used_role: null }),
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
    // 会话栅栏：调用方（mount / 切身份）先写 subject fence 并捕获当前会话代际再进入水合
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.会话代际.current = 1;
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
    // 会话栅栏：调用方（mount / 切身份）先写 subject fence 再进入水合
    deps.主体标识引用.current = 'sub_1';
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
      // last_used_role null：本用例断言清理后的隐私快照为 null，B 不带角色就不会
      // 被登录水合的 水合后端隐私 重新填上（candidate B 会读回自己的隐私）
      读取主体: vi.fn()
        .mockResolvedValueOnce({ ...主体('sub_a'), last_used_role: null })
        .mockResolvedValueOnce({ ...主体('sub_b'), last_used_role: null }),
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
    // P8：Task 3 起 后端状态 extends P8控制面状态（P8 清理用例会播残留）
    ...创建空P8控制面状态(),
    // P2：附件库权威快照（只追加，不动 P6 字段）
    附件简历库: null,
    // P0 修复 Task 1：招聘方档案 / 组织链两个水合阶段的干净底座
    招聘方档案水合阶段: '未开始',
    招聘方组织水合: { 阶段: '未开始', 错误: null },
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
    // P8 Task 3：控制面运行时引用（范围代际 / 可见 / 读锁 / 待定意图；导出恢复 Task 5 接线）
    P8范围代际: { current: 0 },
    P8账号可见: { current: false },
    P8读取锁: { current: new Map<'credentials' | 'sessions' | 'export', Promise<void>>() },
    P8待定意图: { current: new Map<string, { key: string; request: unknown }>() },
    // 候选预填运行时引用（预填代际 / 单飞读锁 / 恢复元数据适配器；适配器按用例注入）
    候选预填代际: { current: 3 },
    候选预填读取锁: { current: new Map<string, Promise<void>>() },
    候选预填恢复: { current: null as 候选预填恢复存储 | null },
  };
  return {
    deps: deps as unknown as 后端操作依赖 & P4运行时引用 & P7运行时引用 & P8运行时引用 &
      候选预填运行时引用 & { 后端: HTTP招聘数据源 },
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
      // B 无角色：登录只做清理不进角色水合，断言停在「两个角色都回 未开始」
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_b', last_used_role: null });
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

// ── 会话栅栏：过时结算整包丢弃 + 当前轮 401 的全量清理 ─────────────
// 主体 + 代际任一已变（登出 / 换号 / 新会话建立）时，水合的一切结算结果
// （简历/意向/隐私/附件/岗位/P6 规则）整包丢弃：不派发、不提示、不触发清理；
// 只有仍是当前轮的 401 才走 清账号状态，且清理要带上 P4/P7/P8 全部运行时引用。

describe('水合会话栅栏', () => {
  it('candidate 简历和意向在 generation 变化后结算时整包丢弃', async () => {
    const 后端 = 创建P6数据源桩();
    const 简历门 = deferred<Awaited<ReturnType<typeof 后端.读取简历>>>();
    const 意向门 = deferred<Awaited<ReturnType<typeof 后端.读取意向>>>();
    vi.mocked(后端.读取简历).mockReturnValue(简历门.promise);
    vi.mocked(后端.读取意向).mockReturnValue(意向门.promise);
    const { deps, 动作流 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.会话代际.current = 7;

    const 运行 = 水合角色数据(deps, candidate主体, false, 7);
    deps.会话代际.current = 8;
    简历门.resolve(await 创建P6数据源桩().读取简历());
    意向门.resolve({ 列表: [{ 编号: 'stale', 标题: '旧意向', 说明: '' }], 服务端: {} });
    await expect(运行).resolves.toBe(false);

    expect(动作流).not.toContainEqual(expect.objectContaining({ 型: '水合后端简历' }));
    expect(动作流).not.toContainEqual(expect.objectContaining({ 型: '水合后端意向' }));
  });

  it('candidate 迟到 401 不清更新会话也不提示', async () => {
    清空轻提示();
    const 后端 = 创建P6数据源桩();
    const 简历门 = deferred<never>();
    vi.mocked(后端.读取简历).mockReturnValue(简历门.promise);
    const { deps } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.会话代际.current = 7;

    const 运行 = 水合角色数据(deps, candidate主体, false, 7);
    deps.主体标识引用.current = 'sub_new';
    deps.会话代际.current = 8;
    简历门.reject(new BFF错误(401, 'invalid_session', '旧会话过期'));
    await expect(运行).resolves.toBe(false);

    expect(deps.主体标识引用.current).toBe('sub_new');
    expect(deps.会话代际.current).toBe(8);
    expect(deps.后端状态引用.current.已登录).toBe(true);
    expect(轻提示条数()).toBe(0);
  });

  it('candidate 当前轮水合 401 清 P7 与 P8 运行时引用', async () => {
    清空轻提示();
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取简历).mockRejectedValue(
      new BFF错误(401, 'invalid_session', 'expired'),
    );
    const { deps } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = candidate主体.subject_id;
    deps.会话代际.current = 7;
    deps.P7范围代际.current.set('candidate:inbox', 3);
    deps.P7可见收件箱.current.candidate = true;
    deps.P8读取锁.current.set('sessions', Promise.resolve());
    deps.P8账号可见.current = true;

    await expect(水合角色数据(deps, candidate主体, false, 7)).resolves.toBe(true);
    expect(deps.P7范围代际.current.size).toBe(0);
    expect(deps.P7可见收件箱.current.candidate).toBe(false);
    expect(deps.P8读取锁.current.size).toBe(0);
    expect(deps.P8账号可见.current).toBe(false);
    expect(轻提示条数()).toBe(0);
  });

  it('recruiter owner jobs 在 generation 变化后结算时不提交', async () => {
    const 后端 = 创建P6数据源桩();
    const 岗位门 = deferred<页面岗位快照>();
    vi.mocked(后端.读取岗位).mockReturnValue(岗位门.promise);
    const { deps, 动作流 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = recruiter主体.subject_id;
    deps.会话代际.current = 11;

    const 运行 = 水合角色数据(deps, recruiter主体, false, 11);
    await vi.waitFor(() => expect(后端.读取岗位).toHaveBeenCalledTimes(1));
    deps.会话代际.current = 12;
    岗位门.resolve({ 列表: [{ 编号: 'stale-job' }], 服务端: {} } as 页面岗位快照);
    await expect(运行).resolves.toBe(false);
    expect(动作流).not.toContainEqual(expect.objectContaining({ 型: '水合后端岗位' }));
  });

  it('recruiter owner jobs 的迟到 401 不清更新会话也不提示', async () => {
    清空轻提示();
    const 后端 = 创建P6数据源桩();
    const 岗位门 = deferred<页面岗位快照>();
    vi.mocked(后端.读取岗位).mockReturnValue(岗位门.promise);
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = recruiter主体.subject_id;
    deps.会话代际.current = 11;

    const 运行 = 水合角色数据(deps, recruiter主体, false, 11);
    await vi.waitFor(() => expect(后端.读取岗位).toHaveBeenCalledTimes(1));
    deps.会话代际.current = 12;
    岗位门.reject(new BFF错误(401, 'invalid_session', '旧岗位轮过期'));
    await expect(运行).resolves.toBe(false);

    expect(最新后端状态().已登录).toBe(true);
    expect(deps.主体标识引用.current).toBe(recruiter主体.subject_id);
    expect(deps.会话代际.current).toBe(12);
    expect(轻提示条数()).toBe(0);
  });

  it('recruiter Agent 规则的迟到 401 不清更新会话也不提示', async () => {
    清空轻提示();
    const 后端 = 创建P6数据源桩();
    const 规则门 = deferred<Awaited<ReturnType<typeof 后端.读取Agent规则>>>();
    vi.mocked(后端.读取Agent规则).mockReturnValue(规则门.promise);
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = recruiter主体.subject_id;
    deps.会话代际.current = 11;

    const 运行 = 水合角色数据(deps, recruiter主体, false, 11);
    await vi.waitFor(() => expect(后端.读取Agent规则).toHaveBeenCalledTimes(1));
    deps.会话代际.current = 12;
    规则门.reject(new BFF错误(401, 'invalid_session', '旧规则轮过期'));
    await expect(运行).resolves.toBe(false);

    expect(最新后端状态().已登录).toBe(true);
    expect(deps.主体标识引用.current).toBe(recruiter主体.subject_id);
    expect(deps.会话代际.current).toBe(12);
    expect(轻提示条数()).toBe(0);
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
      // B 无角色：登录只做清理不进角色水合，附件快照停在清理后的 null
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_b', last_used_role: null });
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

/** 在 后端状态 与五个 P7 引用里播上上个会话残留的痕迹（P7 / P8 清理用例共用）。 */
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

describe('P7 真人会话会话清理', () => {
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

// ── P8 Task 3：控制面域加入会话边界清理 ────────────────────────────
// 普通登出 / 401 / 换主体三个转移口：三块 P8 快照回空底座 + 读锁与待定意图清空 +
// 范围代际递增（在飞读写按旧代整包作废）。同主体切角色不同：P8 的清理键只认主体 ——
// 已确认的共享账号快照保留，只递增范围代际并清待定意图。

describe('P8 控制面会话清理', () => {
  const 手机凭证DTO = {
    credentialId: 'cred_0000000000000001',
    provider: 'phone_otp' as const,
    display: '+86 138 **** 0000',
    verifiedAt: '2026-08-20T10:00:00Z',
  };
  const 会话DTO = {
    sessionId: 'sess_0000000000000001',
    createdAt: '2026-08-30T00:00:00Z',
    expiresAt: '2026-09-05T00:00:00Z',
    current: true,
  };

  /** 在 后端状态 与四个 P8 引用里播上上个会话残留的痕迹。 */
  function 播P8残留(deps: ReturnType<typeof 创建P6会话依赖>['deps']): void {
    deps.设后端状态((旧) => ({
      ...旧,
      credentials: { phase: 'success', refreshing: false, data: [手机凭证DTO], error: null, generation: 3 },
      sessions: { phase: 'success', refreshing: false, data: [会话DTO], error: null, generation: 3 },
      dataExport: { phase: 'idle', refreshing: false, data: null, error: null, generation: 0 },
    }));
    deps.P8读取锁.current.set('sessions', Promise.resolve());
    deps.P8待定意图.current.set('p8:退出其他设备', { key: 'idem-p8-residue', request: {} });
    deps.P8账号可见.current = true;
  }

  function 断言P8已清空(deps: ReturnType<typeof 创建P6会话依赖>['deps']): void {
    const 空 = { phase: 'idle', refreshing: false, data: null, error: null, generation: 0 };
    const 最新 = deps.后端状态引用.current;
    expect(最新.credentials).toEqual(空);
    expect(最新.sessions).toEqual(空);
    expect(最新.dataExport).toEqual(空);
    expect(deps.P8读取锁.current.size).toBe(0);
    expect(deps.P8待定意图.current.size).toBe(0);
    expect(deps.P8账号可见.current).toBe(false);
    expect(deps.P8范围代际.current).toBeGreaterThan(0); // 范围代际递增：迟到读写按旧代作废
  }

  it('清账号状态 清空三块 P8 快照与引用；P4/P7/隐私/规则/附件清理恰好各一次', () => {
    const { deps, 动作流 } = 创建P6会话依赖(创建P6数据源桩());
    播P7残留(deps);
    播P8残留(deps);
    清账号状态(deps);
    断言P7已清空(deps);
    断言P8已清空(deps);
    expect(deps.后端状态引用.current.附件简历库).toBeNull();
    expect(deps.后端状态引用.current.隐私快照).toBeNull();
    expect(deps.后端状态引用.current.候选规则快照).toEqual({});
    expect(deps.后端状态引用.current.候选岗位推荐).toEqual({});
    // 加 P8 不重复派发任何清理动作（各恰好一次）
    const 次数 = (型: string) => 动作流.filter((条) => (条 as { 型: string }).型 === 型).length;
    expect(次数('清后端隐私')).toBe(1);
    expect(次数('清后端组织状态')).toBe(1);
    expect(次数('清后端Agent规则')).toBe(1);
    expect(次数('清后端草稿')).toBe(1);
    expect(deps.主体标识引用.current).toBeNull();
    expect(deps.会话代际.current).toBe(1);
  });

  it('退出登录 清空 P8 控制面残留', async () => {
    const { deps } = 创建P6会话依赖(创建P6数据源桩());
    const 操作 = 创建会话操作(deps);
    播P8残留(deps);
    await 操作.退出登录();
    断言P8已清空(deps);
    expect(deps.后端状态引用.current.已登录).toBe(false);
  });

  it('完成手机登录 换主体时清 P8 控制面残留', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取主体)
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_a' })
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_b' });
    const { deps } = 创建P6会话依赖(后端);
    const 操作 = 创建会话操作(deps);
    await 操作.完成手机登录('1111');
    播P8残留(deps);
    await 操作.完成手机登录('2222');
    断言P8已清空(deps);
    expect(deps.主体标识引用.current).toBe('sub_b');
  });

  it('切身份 保留已确认 P8 快照：只递增范围代际并清待定意图（清理键只认主体）', async () => {
    const { deps, 动作流 } = 创建P6会话依赖(创建P6数据源桩());
    const 操作 = 创建会话操作(deps);
    deps.主体标识引用.current = 'sub_1';
    await 操作.完成手机登录('1111');
    播P8残留(deps);
    播P7残留(deps);
    const 代际前 = deps.P8范围代际.current;
    await 操作.切身份('招聘方');
    // P7 照旧整域清空（角色基串变化）
    断言P7已清空(deps);
    // P8：三块快照保留（同主体共享账号事实不因切角色丢失）
    const 最新 = deps.后端状态引用.current;
    expect(最新.credentials).toMatchObject({ phase: 'success', data: [手机凭证DTO] });
    expect(最新.sessions).toMatchObject({ phase: 'success', data: [会话DTO] });
    expect(最新.dataExport).toEqual({ phase: 'idle', refreshing: false, data: null, error: null, generation: 0 });
    // 但范围代际递增、读锁与待定意图清空：上个角色的在飞读写与未收口命令不再作数
    expect(deps.P8范围代际.current).toBeGreaterThan(代际前);
    expect(deps.P8读取锁.current.size).toBe(0);
    expect(deps.P8待定意图.current.size).toBe(0);
    expect(动作流).toContainEqual({ 型: '切身份', 到: '招聘方' });
  });

  // P8 Task 5：导出恢复句柄跨登出保留 —— 清理口绝不触碰 P8导出恢复 引用。
  // 普通 logout / 401 只清内存与在飞操作；按 subject 隔离的句柄留给同主体重登恢复
  // （spec §5.3/§8.3）。只有注销 202 与 export 404/expired/明确重新生成才删句柄
  // （归 P8控制面操作 的注销/废弃路径，不在会话清理口）。
  it('清账号状态 / 退出登录 / 换主体登录都不触碰 P8导出恢复 引用（句柄跨登出保留）', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取主体)
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_a' })
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_b' });
    const { deps } = 创建P6会话依赖(后端);
    const 恢复适配器 = {
      读取: vi.fn(() => null),
      写入: vi.fn(() => false),
      删除: vi.fn(),
    };
    (deps as unknown as { P8导出恢复: { current: unknown } }).P8导出恢复 = { current: 恢复适配器 };
    const 操作 = 创建会话操作(deps);
    await 操作.完成手机登录('1111'); // sub_a
    清账号状态(deps); // 401 统一清理口
    expect(deps.P8导出恢复?.current).toBe(恢复适配器);
    expect(恢复适配器.删除).not.toHaveBeenCalled();
    await 操作.退出登录();
    expect(deps.P8导出恢复?.current).toBe(恢复适配器);
    expect(恢复适配器.删除).not.toHaveBeenCalled();
    await 操作.完成手机登录('2222'); // 换主体 sub_b：句柄坐标仍归操作层换绑
    expect(deps.P8导出恢复?.current).toBe(恢复适配器);
    expect(恢复适配器.写入).not.toHaveBeenCalled();
    expect(恢复适配器.删除).not.toHaveBeenCalled();
  });
});

// ── 候选 onboarding 简历预填：会话边界清理 ──────────────────────────
// 登出 / 401 / 换主体 / 切离 candidate 四个转移口都要：内存轮摊平 pristine +
// 预填代际递增（在飞读整包作废）+ 单飞读锁清空 + outgoing subject 的恢复元数据删除。

describe('候选 onboarding 预填会话清理', () => {
  /** 在 后端状态 与预填引用里播上上个候选会话的活轮痕迹。 */
  function 播预填残留(deps: ReturnType<typeof 创建P6会话依赖>['deps']): 候选预填状态 {
    const 活轮: 候选预填状态 = {
      ...创建空候选预填状态(5),
      phase: 'ready',
      source: { file_id: 'rf_1', version_id: 'rfv_1', parse_id: 'rp_1' },
      eligibility: {
        profile: { real_name: true, work_start_year: true, gender: true, birth_year: true, birth_month: true, current_education: true },
        summary: true, skills: true, experiences: true, educations: true, certificates: true,
      },
      suggestion: { schema_version: 'resume-prefill.v1' } as never,
    };
    deps.设后端状态((旧) => ({ ...旧, 候选预填状态: 活轮 }));
    deps.候选预填读取锁.current.set('rf_1|rfv_1|rp_1', Promise.resolve());
    return 活轮;
  }

  /** 注入 subject 绑定的假恢复适配器（删除 spy 可断言）。 */
  function 注入恢复适配器(deps: ReturnType<typeof 创建P6会话依赖>['deps']) {
    const 适配器 = {
      读取: vi.fn(() => null),
      写入: vi.fn(() => false),
      删除: vi.fn(),
    };
    deps.候选预填恢复.current = 适配器;
    return 适配器;
  }

  function 断言预填已清空(
    deps: ReturnType<typeof 创建P6会话依赖>['deps'],
    适配器: ReturnType<typeof 注入恢复适配器>,
  ): void {
    expect(deps.后端状态引用.current.候选预填状态).toEqual(创建空候选预填状态());
    expect(deps.候选预填读取锁.current.size).toBe(0);
    expect(deps.候选预填代际.current).toBeGreaterThan(3); // 预填代际递增：迟到读按旧代作废
    expect(适配器.删除).toHaveBeenCalledTimes(1); // outgoing subject 的恢复元数据删除
  }

  it('清账号状态 摊平预填内存、递增代际、清读锁并删恢复元数据', () => {
    const { deps } = 创建P6会话依赖(创建P6数据源桩());
    播预填残留(deps);
    const 适配器 = 注入恢复适配器(deps);
    清账号状态(deps);
    断言预填已清空(deps, 适配器);
    expect(deps.主体标识引用.current).toBeNull();
    expect(deps.会话代际.current).toBe(1);
  });

  it('退出登录 清空候选预填残留', async () => {
    const { deps } = 创建P6会话依赖(创建P6数据源桩());
    const 操作 = 创建会话操作(deps);
    播预填残留(deps);
    const 适配器 = 注入恢复适配器(deps);
    await 操作.退出登录();
    断言预填已清空(deps, 适配器);
    expect(deps.后端状态引用.current.已登录).toBe(false);
  });

  it('完成手机登录 换主体时清上个账号的候选预填残留', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取主体)
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_a' })
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_b', last_used_role: null });
    const { deps } = 创建P6会话依赖(后端);
    const 操作 = 创建会话操作(deps);
    await 操作.完成手机登录('1111');
    播预填残留(deps);
    const 适配器 = 注入恢复适配器(deps);
    await 操作.完成手机登录('2222');
    断言预填已清空(deps, 适配器);
    expect(deps.主体标识引用.current).toBe('sub_b');
  });

  it('切身份 离开 candidate 时清预填残留（预填会话键不跨角色存活）', async () => {
    const { deps } = 创建P6会话依赖(创建P6数据源桩());
    const 操作 = 创建会话操作(deps);
    deps.主体标识引用.current = 'sub_1';
    播预填残留(deps);
    const 适配器 = 注入恢复适配器(deps);
    await 操作.切身份('招聘方');
    断言预填已清空(deps, 适配器);
  });
});

// ── P0 修复 Task 1：缺失招聘方档案 / 组织链聚合阶段 在会话编排与三个转移口的行为 ──

describe('招聘方组织水合生命周期', () => {
  it('招聘方 profile 缺失时 jobs 在完整组织链成功后读取，交互切身份 resolve', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取招聘方档案).mockRejectedValue(new BFF错误(404, 'not_found', 'missing'));
    vi.mocked(后端.读取我的企业关系).mockResolvedValue([]);
    const { deps, 最新后端状态, 状态引用 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = recruiter主体.subject_id;
    deps.会话代际.current = 4;
    await expect(水合角色数据(deps, recruiter主体, true, 4)).resolves.toBe(false);
    expect(后端.读取岗位).toHaveBeenCalledTimes(1);
    // 缺失档案不阻断 onboarding：档案落 缺失，聚合链仍成功，岗位盘照常起来
    expect(状态引用.current.招聘方档案).toBeNull();
    expect(最新后端状态().招聘方档案水合阶段).toBe('缺失');
    expect(最新后端状态().招聘方组织水合).toEqual({ 阶段: '成功', 错误: null });
    expect(最新后端状态().岗位快照).toEqual({ [BFF岗位样本.job_id]: BFF岗位样本 });
  });

  it.each([500, 503])('招聘方组织链 %i 失败时不读取 jobs 且交互调用 reject', async (status) => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取招聘方档案).mockRejectedValue(new BFF错误(status, 'service_error', '失败'));
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = recruiter主体.subject_id;
    deps.会话代际.current = 4;
    await expect(水合角色数据(deps, recruiter主体, true, 4)).rejects.toBeInstanceOf(BFF错误);
    expect(后端.读取岗位).not.toHaveBeenCalled();
    expect(最新后端状态().招聘方档案水合阶段).toBe('失败');
    expect(最新后端状态().招聘方组织水合.阶段).toBe('失败');
  });

  it('401 统一清账号把招聘方两个阶段恢复到未开始', () => {
    const 后端 = 创建P6数据源桩();
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.后端状态引用.current = {
      ...deps.后端状态引用.current,
      招聘方档案水合阶段: '成功',
      招聘方组织水合: { 阶段: '失败', 错误: '上个账号错误' },
    };
    清账号状态(deps);
    expect(最新后端状态().招聘方档案水合阶段).toBe('未开始');
    expect(最新后端状态().招聘方组织水合).toEqual({ 阶段: '未开始', 错误: null });
  });

  it('换主体登录把招聘方两个阶段恢复到未开始', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取主体)
      .mockResolvedValueOnce(主体('sub_a'))
      .mockResolvedValueOnce(主体('sub_b'));
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    const 操作 = 创建会话操作(deps);
    await 操作.完成手机登录('1111');
    deps.后端状态引用.current = {
      ...deps.后端状态引用.current,
      招聘方档案水合阶段: '缺失',
      招聘方组织水合: { 阶段: '失败', 错误: 'A 的错误' },
    };
    await 操作.完成手机登录('2222');
    expect(deps.主体标识引用.current).toBe('sub_b');
    expect(最新后端状态().招聘方档案水合阶段).toBe('未开始');
    expect(最新后端状态().招聘方组织水合).toEqual({ 阶段: '未开始', 错误: null });
  });

  it('切身份到求职者把招聘方两个阶段恢复到未开始', async () => {
    const 后端 = 创建P6数据源桩();
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    deps.后端状态引用.current = {
      ...deps.后端状态引用.current,
      招聘方档案水合阶段: '失败',
      招聘方组织水合: { 阶段: '失败', 错误: '上个角色错误' },
    };
    const 操作 = 创建会话操作(deps);
    await 操作.切身份('求职者');
    // 切角色是角色转移：招聘方两个阶段回干净底座，不粘住上个角色的 失败
    expect(最新后端状态().招聘方档案水合阶段).toBe('未开始');
    expect(最新后端状态().招聘方组织水合).toEqual({ 阶段: '未开始', 错误: null });
  });
});

// ── P0 修复 Task 2：招聘方数据的显式重试（组织链 → owner jobs）──

describe('重新水合招聘方数据', () => {
  const 招聘主体 = { ...BFF主体样本, subject_id: 'sub_1', last_used_role: 'recruiter' as const };
  const 权威岗位快照 = { 列表: [], 服务端: { [BFF岗位样本.job_id]: BFF岗位样本 } };

  it('显式招聘方数据重试按组织链后 owner jobs 的顺序恢复', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取我的企业关系).mockResolvedValue([]);
    vi.mocked(后端.读取岗位).mockResolvedValue(权威岗位快照);
    const { deps, 动作流, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    deps.后端状态引用.current = {
      ...deps.后端状态引用.current,
      已登录: true,
      主体: 招聘主体,
      招聘方档案水合阶段: '失败',
      招聘方组织水合: { 阶段: '失败', 错误: '企业资料读取失败' },
    };

    await 创建会话操作(deps).重新水合招聘方数据();

    // 组织链先跑完再读 owner jobs：失败的组织事实上不拼岗位盘
    expect(vi.mocked(后端.读取招聘方档案).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(后端.读取岗位).mock.invocationCallOrder[0]);
    expect(后端.读取岗位).toHaveBeenCalledTimes(1);
    expect(动作流).toContainEqual({ 型: '水合后端岗位', 快照: 权威岗位快照 });
    const 最终 = 最新后端状态();
    expect(最终.岗位快照).toEqual(权威岗位快照.服务端);
    expect(最终.招聘方档案水合阶段).toBe('成功');
    expect(最终.招聘方组织水合).toEqual({ 阶段: '成功', 错误: null });
    // 重试期间 初始化 走 进行中 → 完成，加载屏全程可见
    expect(最终.初始化).toBe('完成');
  });
});

// ── 交互短信登录的水合编排 ────────────────────────────────────────
// 完成手机登录 在提交 已登录=true 之前先按 last_used_role 水合全部支持域：
// 导航可见时权威资料已在；当前轮 401 统一清理后以标准 invalid_session 拒绝一次；
// 同 subject 后一轮登录让前一轮的迟到水合整包作废，不得重复提交登录态。

describe('交互短信登录水合编排', () => {
  it('已有 candidate 短信登录在五类支持域结算后才提交登录态', async () => {
    const 后端 = 创建P6数据源桩();
    const 附件门 = deferred<BFF附件简历库>();
    vi.mocked(后端.读取主体).mockResolvedValue(candidate主体);
    vi.mocked(后端.读取简历).mockResolvedValue(从BFF简历(BFF简历样本));
    vi.mocked(后端.读取意向).mockResolvedValue({
      列表: [{ 编号: 'int_1', 标题: 'AI 产品经理', 说明: '20–30K' }],
      服务端: { int_1: BFF意向样本 },
    });
    vi.mocked(后端.读取附件简历库).mockReturnValue(附件门.promise);
    const { deps, 状态引用, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.设后端状态((旧) => ({ ...旧, 已登录: false, 主体: null }));

    const 登录 = 创建会话操作(deps).完成手机登录('1234');
    await vi.waitFor(() => expect(后端.读取附件简历库).toHaveBeenCalledTimes(1));
    expect(最新后端状态().已登录).toBe(false);
    expect(后端.读取简历).toHaveBeenCalledTimes(1);
    expect(后端.读取意向).toHaveBeenCalledTimes(1);
    expect(后端.读取隐私).toHaveBeenCalledTimes(1);
    expect(后端.读取Agent规则).toHaveBeenCalledWith('candidate');
    expect(后端.读取Agent规则提案列表).toHaveBeenCalledTimes(2);

    附件门.resolve(空附件库样本);
    await 登录;
    expect(最新后端状态().已登录).toBe(true);
    expect(最新后端状态().主体).toEqual(candidate主体);
    expect(状态引用.current.求职意向表).toHaveLength(1);
    expect(状态引用.current.基本信息).toEqual(expect.objectContaining({
      真名: BFF简历样本.profile.real_name,
    }));
  });

  it('已有 recruiter 短信登录执行组织、岗位和规则链', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取主体).mockResolvedValue(recruiter主体);
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.设后端状态((旧) => ({ ...旧, 已登录: false, 主体: null }));

    await 创建会话操作(deps).完成手机登录('1234');

    expect(后端.读取招聘方档案).toHaveBeenCalledTimes(1);
    expect(后端.读取我的企业关系).toHaveBeenCalledTimes(1);
    expect(后端.读取岗位).toHaveBeenCalledTimes(1);
    expect(后端.读取Agent规则).toHaveBeenCalledWith('recruiter');
    expect(最新后端状态()).toMatchObject({
      已登录: true,
      主体: recruiter主体,
      招聘方组织水合: { 阶段: '成功', 错误: null },
    });
  });

  it('last_used_role null 登录不读取角色域', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, last_used_role: null });
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.设后端状态((旧) => ({ ...旧, 已登录: false, 主体: null }));
    await 创建会话操作(deps).完成手机登录('1234');
    expect(后端.读取简历).not.toHaveBeenCalled();
    expect(后端.读取岗位).not.toHaveBeenCalled();
    expect(后端.读取Agent规则).not.toHaveBeenCalled();
    expect(最新后端状态().已登录).toBe(true);
  });

  it('交互登录水合 401 不落登录态并统一清理', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取主体).mockResolvedValue(candidate主体);
    vi.mocked(后端.读取意向).mockRejectedValue(
      new BFF错误(401, 'invalid_session', 'expired'),
    );
    const { deps, 最新后端状态, 状态引用 } = 创建P6会话依赖(后端);
    deps.设后端状态((旧) => ({ ...旧, 已登录: false, 主体: null }));
    await expect(创建会话操作(deps).完成手机登录('1234')).rejects.toMatchObject({
      status: 401,
      code: 'invalid_session',
    });
    expect(最新后端状态()).toMatchObject({ 已登录: false, 主体: null });
    expect(状态引用.current.求职意向表).toEqual([]);
    expect(最新后端状态().附件简历库).toBeNull();
  });

  it('recruiter 组织水合 401 同样拒绝并保持未登录', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取主体).mockResolvedValue(recruiter主体);
    vi.mocked(后端.读取招聘方档案).mockRejectedValue(
      new BFF错误(401, 'invalid_session', 'expired'),
    );
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.设后端状态((旧) => ({ ...旧, 已登录: false, 主体: null }));

    await expect(创建会话操作(deps).完成手机登录('1234')).rejects.toMatchObject({
      status: 401,
      code: 'invalid_session',
    });

    expect(最新后端状态()).toMatchObject({ 已登录: false, 主体: null });
  });

  it('切身份水合 401 拒绝，让身份页阻止成功导航', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取简历).mockRejectedValue(
      new BFF错误(401, 'invalid_session', 'expired'),
    );
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    deps.主体标识引用.current = candidate主体.subject_id;

    await expect(创建会话操作(deps).切身份('求职者')).rejects.toMatchObject({
      status: 401,
      code: 'invalid_session',
    });
    expect(最新后端状态()).toMatchObject({ 已登录: false, 主体: null });
  });

  it('单域非 401 失败保留兄弟域并完成登录', async () => {
    const 后端 = 创建P6数据源桩();
    vi.mocked(后端.读取主体).mockResolvedValue(candidate主体);
    vi.mocked(后端.读取简历).mockResolvedValue(从BFF简历(BFF简历样本));
    vi.mocked(后端.读取附件简历库).mockRejectedValue(
      new BFF错误(503, 'storage_unavailable', 'down'),
    );
    const { deps, 最新后端状态, 状态引用 } = 创建P6会话依赖(后端);
    deps.设后端状态((旧) => ({ ...旧, 已登录: false, 主体: null }));
    await expect(创建会话操作(deps).完成手机登录('1234')).resolves.toBeUndefined();
    expect(最新后端状态().已登录).toBe(true);
    expect(最新后端状态().附件简历库).toBeNull();
    expect(状态引用.current.基本信息.真名).toBe(BFF简历样本.profile.real_name);
  });

  it('同 subject 后一轮登录完成后前一轮迟到水合不能再次提交登录态', async () => {
    const 后端 = 创建P6数据源桩();
    const 第一简历门 = deferred<页面简历快照>();
    vi.mocked(后端.读取主体)
      .mockResolvedValueOnce(candidate主体)
      .mockResolvedValueOnce(candidate主体);
    vi.mocked(后端.读取简历)
      .mockReturnValueOnce(第一简历门.promise)
      .mockResolvedValue(从BFF简历(BFF简历样本));
    const { deps, 最新后端状态 } = 创建P6会话依赖(后端);
    const 原设后端状态 = deps.设后端状态;
    const 登录提交 = vi.fn();
    deps.设后端状态 = (更新) => {
      const 之前 = 最新后端状态();
      原设后端状态(更新);
      const 之后 = 最新后端状态();
      if (!之前.已登录 && 之后.已登录) 登录提交(之后.主体?.subject_id);
    };
    deps.设后端状态((旧) => ({ ...旧, 已登录: false, 主体: null }));
    const 操作 = 创建会话操作(deps);

    const 第一轮 = 操作.完成手机登录('1111');
    await vi.waitFor(() => expect(后端.读取简历).toHaveBeenCalledTimes(1));
    const 第二轮 = 操作.完成手机登录('2222');
    await 第二轮;
    expect(登录提交).toHaveBeenCalledTimes(1);
    expect(最新后端状态()).toMatchObject({ 已登录: true, 主体: candidate主体 });

    第一简历门.resolve(从BFF简历(BFF简历样本));
    await 第一轮;
    expect(登录提交).toHaveBeenCalledTimes(1);
    expect(deps.会话代际.current).toBe(2);
  });
});
