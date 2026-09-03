// P6 Task 3：Agent 规则 / 提案操作边界的行为测试。
// 直接调用 创建Agent规则操作() 与导出的 水合Agent规则角色数据，逐条钉住设计 §6/§8：
// 快照权威提交 / 阶段不降级 / 锁与代际 / 幂等冲突恢复 / 401 收口 / 文案映射。
// 约束：失败恢复一律重读权威资源，绝不自动重放 mutation。

import { describe, expect, it, vi } from 'vitest';
import { 创建空P7会话状态 } from './真人会话操作';
import { 创建空P8控制面状态 } from './P8控制面操作';
import { 创建空接触记录状态 } from './接触记录操作';
import { 创建空P5MatchCase状态 } from './MatchCase操作';
import type { BFF角色 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { 轻提示 } from '../../组件/轻提示';
import {
  BFF主体样本,
  BFFAgent规则就绪提案样本,
  BFFAgent规则解释中提案样本,
  BFFAgent规则样本,
  BFF意向Agent规则样本,
  BFF意向样本,
} from '../../测试/BFF样本';
import { BFF错误, 取后端错误文案 } from '../../数据/HTTP客户端';
import { 初始状态 } from '../初始状态';
import { 归约, type 动作 } from '../应用状态';
import type { 页面意向快照 } from '../../数据/招聘数据源类型';
import type { 后端操作依赖, 后端状态 } from './类型';
import { 创建空P4发现状态 } from './发现推荐操作';
import { 创建Agent规则操作, 取Agent规则错误文案, 水合Agent规则角色数据 } from './Agent规则操作';

// 轻提示 是纯 DOM 单例：操作层测试只断言「是否提示、提示什么」，桩掉 DOM 副作用
vi.mock('../../组件/轻提示', () => ({ 轻提示: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

/** 本文件内的完整数据源桩：默认全成功（返回空集），各测试按需 mockResolvedValue*。 */
function 创建数据源桩(): HTTP招聘数据源 {
  return {
    读取Agent规则: vi.fn(async () => [] as never[]),
    读取单条Agent规则: vi.fn(async () => BFFAgent规则样本),
    修改Agent规则: vi.fn(async () => BFFAgent规则样本),
    删除Agent规则: vi.fn(async () => undefined),
    创建Agent规则提案: vi.fn(async () => BFFAgent规则解释中提案样本),
    读取Agent规则提案: vi.fn(async () => BFFAgent规则就绪提案样本),
    读取Agent规则提案列表: vi.fn(async () => [] as never[]),
    接受Agent规则提案: vi.fn(async () => BFFAgent规则样本),
    放弃Agent规则提案: vi.fn(async () =>
      ({ ...BFFAgent规则就绪提案样本, state: 'dismissed' as const })),
    创建Agent规则替换提案: vi.fn(async () => BFFAgent规则解释中提案样本),
    // scope_denied 恢复链会重读意向
    读取意向: vi.fn(async (): Promise<页面意向快照> => ({ 列表: [], 服务端: {} })),
    清空目录缓存: vi.fn(),
  } as unknown as HTTP招聘数据源;
}

/** 页面 state 引用包装：派发真实过 归约，断言可以拿引用对比（toBe 语义）。 */
interface 测试环境 {
  deps: 后端操作依赖;
  数据源: HTTP招聘数据源;
  页面状态: { current: typeof 初始状态 };
  最新后端状态: () => 后端状态;
}

function 创建测试依赖(input: {
  数据源: HTTP招聘数据源;
  角色?: BFF角色 | null;
  预置锁?: string[];
}): 测试环境 {
  const 页面状态 = { current: 初始状态 };
  let 后端值: 后端状态 = 种子后端状态(input.角色 === undefined ? 'candidate' : input.角色);
  const deps = {
    是后端: true,
    后端: input.数据源,
    派发: vi.fn((动作: 动作) => {
      页面状态.current = 归约(页面状态.current, 动作);
    }),
    // 与 Provider 的 useState 更新同构：把 updater 应用到可变镜像上
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
    状态引用: 页面状态,
    锁: { current: new Set<string>(input.预置锁 ?? []) },
    尝试引用: { current: null },
    主体标识引用: { current: 'sub_1' as string | null },
    会话代际: { current: 7 },
    读取恢复企业关系编号: vi.fn(() => null),
  };
  return {
    deps: deps as unknown as 后端操作依赖,
    数据源: input.数据源,
    页面状态,
    最新后端状态: () => 后端值,
  };
}

function 种子后端状态(role: BFF角色 | null): 后端状态 {
  return {
    初始化: '完成',
    已登录: role !== null,
    主体: role === null ? null : ({ ...BFF主体样本, last_used_role: role }),
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
    // P0 修复 Task 1：招聘方档案 / 组织链两个水合阶段（这里的用例不触达它们）
    招聘方档案水合阶段: '未开始' as const,
    招聘方组织水合: { 阶段: '未开始' as const, 错误: null },
    // P4：Task 3 起 后端状态 extends P4发现状态（这里的用例不触达它们）
    ...创建空P4发现状态(),
    // P5：Task 3 起 后端状态 extends P5MatchCase状态（这里的用例不触达它们）
    ...创建空P5MatchCase状态(),
    // P7：Task 2 起 后端状态 extends P7会话状态（这里的用例不触达它们）
    ...创建空P7会话状态(),
    // P8：Task 3 起 后端状态 extends P8控制面状态（这里的用例不触达它们）
    ...创建空P8控制面状态(),
    ...创建空接触记录状态(),
    // P2：附件库权威快照（只追加，不动 P6 字段）
    附件简历库: null,
  };
}

describe('创建Agent规则操作 · 权威提交与不做乐观追加', () => {
  it('create stores a Proposal and does not append a Rule', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.创建Agent规则提案).mockResolvedValue(BFFAgent规则解释中提案样本);
    const 操作 = 创建Agent规则操作(环境.deps);
    const before = 环境.页面状态.current.全局规则;
    const id = await 操作.创建Agent规则提案({ 文本: '大小周不谈', 作用域: { type: 'global' } });
    expect(id).toBe(BFFAgent规则解释中提案样本.proposal_id);
    expect(环境.deps.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '新增规则' }));
    expect(环境.页面状态.current.全局规则).toBe(before);
    expect(环境.最新后端状态().候选规则提案[id]).toEqual(BFFAgent规则解释中提案样本);
  });

  it('accept refreshes authoritative Rules and removes terminal Proposal', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.接受Agent规则提案).mockResolvedValue(BFFAgent规则样本);
    vi.mocked(环境.数据源.读取Agent规则).mockResolvedValue([BFFAgent规则样本]);
    vi.mocked(环境.数据源.读取Agent规则提案列表)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    // 先放一张 ready 卡在原始快照里
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      候选规则提案: { [BFFAgent规则就绪提案样本.proposal_id]: BFFAgent规则就绪提案样本 },
    };
    const 操作 = 创建Agent规则操作(环境.deps);
    await 操作.接受Agent规则提案(BFFAgent规则就绪提案样本.proposal_id);
    expect(环境.数据源.接受Agent规则提案)
      .toHaveBeenCalledWith('candidate', BFFAgent规则就绪提案样本.proposal_id);
    expect(环境.deps.派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '水合后端候选规则' }));
    expect(环境.最新后端状态().候选规则提案).toEqual({});
  });

  it('version conflict re-reads but never replays the mutation', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.修改Agent规则).mockRejectedValue(new BFF错误(409, 'version_conflict', 'conflict'));
    vi.mocked(环境.数据源.读取Agent规则)
      .mockResolvedValue([{ ...BFFAgent规则样本, version: 4, state: 'paused' }]);
    const 操作 = 创建Agent规则操作(环境.deps);
    await expect(操作.切换Agent规则(BFFAgent规则样本.rule_id, 'pause')).rejects.toMatchObject({ code: 'version_conflict' });
    expect(环境.数据源.修改Agent规则).toHaveBeenCalledTimes(1);
    expect(环境.数据源.读取Agent规则).toHaveBeenCalledTimes(1);
  });

  it('对账读取遇 401 也统一清账号，原始错误照抛不顶替', async () => {
    // mutation 409 → 对账重读权威 Rules → 恢复读自己撞上会话过期：
    // 恢复失败不顶替原始错误，但 401 必须走统一登出清理，不能顶着已登录壳吞掉。
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.修改Agent规则).mockRejectedValue(new BFF错误(409, 'version_conflict', 'conflict'));
    vi.mocked(环境.数据源.读取Agent规则).mockRejectedValue(new BFF错误(401, 'invalid_session', '过期'));
    const 操作 = 创建Agent规则操作(环境.deps);
    await expect(操作.切换Agent规则(BFFAgent规则样本.rule_id, 'pause'))
      .rejects.toMatchObject({ status: 409 });
    expect(环境.数据源.修改Agent规则).toHaveBeenCalledTimes(1);
    const 最新 = 环境.最新后端状态();
    expect(最新.已登录).toBe(false);
    expect(最新.主体).toBeNull();
    expect(环境.deps.主体标识引用.current).toBeNull();
    expect(环境.deps.会话代际.current).toBe(8);
  });

  it('回执对账读自身撞 401 也统一清账号，原始错误照抛不顶替', async () => {
    // accept 409（可恢复码）→ 恢复读权威回执 → 回执 GET 自己撞上会话过期：
    // 与 规则/清单对账 同口径统一登出；恢复失败不顶替原始 409。
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.接受Agent规则提案)
      .mockRejectedValue(new BFF错误(409, 'agent_rule_proposal_not_ready', '还没好'));
    vi.mocked(环境.数据源.读取Agent规则提案).mockRejectedValue(new BFF错误(401, 'invalid_session', '过期'));
    const 操作 = 创建Agent规则操作(环境.deps);
    await expect(操作.接受Agent规则提案(BFFAgent规则就绪提案样本.proposal_id))
      .rejects.toMatchObject({ status: 409 });
    expect(环境.数据源.接受Agent规则提案).toHaveBeenCalledTimes(1);
    expect(环境.数据源.读取Agent规则提案).toHaveBeenCalledTimes(1);
    const 最新 = 环境.最新后端状态();
    expect(最新.已登录).toBe(false);
    expect(最新.主体).toBeNull();
    expect(环境.deps.主体标识引用.current).toBeNull();
    expect(环境.deps.会话代际.current).toBe(8);
  });

  it('恢复读撞 401 但会话已换代时不清新会话，原始错误照抛', async () => {
    // 迟到的 401 属于旧会话：转移路径（登出/重登）自己清过账号，恢复收口绝不能
    // 顺手登出新一代；原始错误照抛，throw 契约不变。
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩(), 角色: 'recruiter' });
    const 恢复门 = deferred<never>();
    vi.mocked(环境.数据源.修改Agent规则).mockRejectedValue(new BFF错误(409, 'version_conflict', 'conflict'));
    vi.mocked(环境.数据源.读取Agent规则).mockReturnValue(恢复门.promise as never);
    const 操作 = 创建Agent规则操作(环境.deps);
    const 切换 = 操作
      .切换Agent规则(BFFAgent规则样本.rule_id, 'pause')
      .catch((错误: unknown) => 错误);
    await vi.waitFor(() => expect(环境.数据源.读取Agent规则).toHaveBeenCalledTimes(1));
    // 与 完成手机登录 同主体重登同构：subject 不变、代际 +1
    环境.deps.会话代际.current += 1;
    恢复门.reject(new BFF错误(401, 'invalid_session', '过期'));
    expect(await 切换).toMatchObject({ status: 409 });
    const 最新 = 环境.最新后端状态();
    expect(最新.已登录).toBe(true);
    expect(最新.主体).not.toBeNull();
    expect(环境.deps.主体标识引用.current).toBe('sub_1');
    expect(环境.deps.会话代际.current).toBe(8);
  });

  it('切换成功用响应 Rule 并入原始快照并投影页面数组，不改其它行', async () => {
    const 另一条 = { ...BFFAgent规则样本, rule_id: 'rul_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', version: 1 };
    const 环境 = 创建测试依赖({
      数据源: 创建数据源桩(),
      角色: 'recruiter',
    });
    vi.mocked(环境.数据源.修改Agent规则)
      .mockResolvedValue({ ...BFFAgent规则样本, version: 4, state: 'paused' });
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      招聘规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本, [另一条.rule_id]: 另一条 },
    };
    const 操作 = 创建Agent规则操作(环境.deps);
    await 操作.切换Agent规则(BFFAgent规则样本.rule_id, 'pause');
    const 快照 = 环境.最新后端状态().招聘规则快照;
    expect(快照[BFFAgent规则样本.rule_id]).toMatchObject({ version: 4, state: 'paused' });
    expect(快照[另一条.rule_id]).toEqual(另一条);
    // 投影即时可见：paused → 生效 false（Provider effect 用同一张表推导，这里验证提前落位）
    expect(环境.页面状态.current.企业规则.find((条) => 条.编号 === BFFAgent规则样本.rule_id)?.生效).toBe(false);
  });

  it('删除成功只移除目标 Rule 并投影', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩(), 角色: 'recruiter' });
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      招聘规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
    };
    const 操作 = 创建Agent规则操作(环境.deps);
    await 操作.删除Agent规则(BFFAgent规则样本.rule_id);
    expect(环境.数据源.删除Agent规则)
      .toHaveBeenCalledWith('recruiter', BFFAgent规则样本.rule_id, BFFAgent规则样本.version);
    expect(环境.最新后端状态().招聘规则快照).toEqual({});
    expect(环境.页面状态.current.企业规则).toEqual([]);
  });

  it('replacement 把原始当前 Rule 交给 facade，编辑文本不落任何原始快照', async () => {
    const 替换回执 = { ...BFFAgent规则就绪提案样本, normalized_text: '服务端归一化后的新文本' };
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.创建Agent规则替换提案).mockResolvedValue(替换回执);
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      候选规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
    };
    const 操作 = 创建Agent规则操作(环境.deps);
    const id = await 操作.创建Agent规则替换提案(BFFAgent规则样本.rule_id, '用户屏幕上的未归一化草稿 v2');
    expect(id).toBe(替换回执.proposal_id);
    expect(环境.数据源.创建Agent规则替换提案).toHaveBeenCalledWith(
      'candidate', BFFAgent规则样本, '用户屏幕上的未归一化草稿 v2',
    );
    // 第二个参数必须是原始当前 Rule 对象本身
    expect(vi.mocked(环境.数据源.创建Agent规则替换提案).mock.calls[0][1])
      .toBe(环境.deps.后端状态引用.current.候选规则快照[BFFAgent规则样本.rule_id]);
    // 编辑文本只进提案流程，原始状态里没有它的副本
    expect(JSON.stringify(环境.最新后端状态())).not.toContain('未归一化草稿');
    expect(环境.最新后端状态().候选规则提案[替换回执.proposal_id]).toEqual(替换回执);
  });

  it('dismiss 成功只移除终态的那一张卡', async () => {
    const 另一提案 = { ...BFFAgent规则就绪提案样本, proposal_id: 'arp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      候选规则提案: {
        [BFFAgent规则就绪提案样本.proposal_id]: BFFAgent规则就绪提案样本,
        [另一提案.proposal_id]: 另一提案,
      },
    };
    const 操作 = 创建Agent规则操作(环境.deps);
    await 操作.放弃Agent规则提案(BFFAgent规则就绪提案样本.proposal_id);
    expect(环境.数据源.放弃Agent规则提案)
      .toHaveBeenCalledWith('candidate', BFFAgent规则就绪提案样本.proposal_id);
    const 表 = 环境.最新后端状态().候选规则提案;
    expect(Object.keys(表)).toEqual([另一提案.proposal_id]);
  });

  it('Mock 分支派发现有同步动作并返回合成空串，accept/dismiss 为 no-op', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩(), 角色: null });
    (环境.deps as { 是后端: boolean }).是后端 = false;
    (环境.deps as { 后端: unknown }).后端 = null;
    const 操作 = 创建Agent规则操作(环境.deps);
    // candidate 入口（带作用域）
    await expect(操作.创建Agent规则提案({ 文本: '不考虑大小周', 作用域: { type: 'global' } })).resolves.toBe('');
    expect(环境.deps.派发).toHaveBeenCalledWith({ 型: '新增规则', 内容: '不考虑大小周', 来源: '你手动添加 · 刚刚' });
    // recruiter 入口（无作用域）
    await expect(操作.创建Agent规则提案({ 文本: '不透露 HC 数量' })).resolves.toBe('');
    expect(环境.deps.派发).toHaveBeenCalledWith({ 型: '企业新增规则', 内容: '不透露 HC 数量', 来源: '手动添加' });
    // 按 企业规则 归属区分镜像动作
    环境.页面状态.current = 归约(初始状态, { 型: '企业新增规则', 内容: '临时', 来源: '手动添加' });
    const 编号 = 环境.页面状态.current.企业规则.at(-1)!.编号;
    await 操作.切换Agent规则(编号, 'pause');
    expect(环境.deps.派发).toHaveBeenCalledWith({ 型: '企业切规则开关', 编号 });
    await 操作.删除Agent规则(编号);
    expect(环境.deps.派发).toHaveBeenCalledWith({ 型: '企业删规则', 编号 });
    await 操作.创建Agent规则替换提案(BFFAgent规则样本.rule_id, '改稿');
    expect(环境.deps.派发).toHaveBeenCalledWith({ 型: '改规则', 编号: BFFAgent规则样本.rule_id, 内容: '改稿' });
    // accept/dismiss 不伪造 Mock 异步状态，也不读任何资源
    await 操作.接受Agent规则提案(BFFAgent规则就绪提案样本.proposal_id);
    await 操作.放弃Agent规则提案(BFFAgent规则就绪提案样本.proposal_id);
    expect(环境.数据源.接受Agent规则提案).not.toHaveBeenCalled();
    expect(环境.数据源.放弃Agent规则提案).not.toHaveBeenCalled();
    expect(环境.数据源.读取Agent规则).not.toHaveBeenCalled();
  });
});

describe('创建Agent规则操作 · 作用域守卫与冲突恢复', () => {
  it('candidate 必须带作用域：facade 的 invalid_request 原样抛出且锁释放', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.创建Agent规则提案).mockImplementation(
      async (_role: BFF角色, _text: string, scope?: { type: string }) => {
        if (!scope) throw new BFF错误(0, 'invalid_request', '候选人的 Agent 规则提案需要选择范围');
        return BFFAgent规则解释中提案样本;
      },
    );
    const 操作 = 创建Agent规则操作(环境.deps);
    await expect(操作.创建Agent规则提案({ 文本: '大小周不谈' })).rejects.toMatchObject({ code: 'invalid_request' });
    expect(环境.deps.锁.current.has('Agent规则:new:candidate')).toBe(false);
    expect(环境.最新后端状态().候选规则提案).toEqual({});
  });

  it('recruiter 带作用域在进入 facade 之前就被拒绝', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩(), 角色: 'recruiter' });
    const 操作 = 创建Agent规则操作(环境.deps);
    await expect(
      操作.创建Agent规则提案({ 文本: '不限行业', 作用域: { type: 'intention', intention_id: 'int_1' } }),
    ).rejects.toMatchObject({ code: 'invalid_request' });
    expect(环境.数据源.创建Agent规则提案).not.toHaveBeenCalled();
  });

  it('agent_rule_scope_denied 保留文本并刷新权威意向', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.创建Agent规则提案)
      .mockRejectedValue(new BFF错误(403, 'agent_rule_scope_denied', 'gone'));
    vi.mocked(环境.数据源.读取意向).mockResolvedValue({ 列表: [], 服务端: { int_x: BFF意向样本 } } as never);
    const 操作 = 创建Agent规则操作(环境.deps);
    await expect(
      操作.创建Agent规则提案({ 文本: '保留给我的文本', 作用域: { type: 'intention', intention_id: 'int_1' } }),
    ).rejects.toMatchObject({ code: 'agent_rule_scope_denied' });
    // 意向经捕获的 fence 刷新：dispatch + raw 意向快照
    expect(环境.deps.派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '水合后端意向' }));
    expect(环境.最新后端状态().意向快照).toEqual({ int_x: BFF意向样本 });
    // 文本没有变成任何乐观提案，也没有 Mock 规则行兜底
    expect(JSON.stringify(环境.最新后端状态())).not.toContain('保留给我的文本');
    expect(环境.页面状态.current.全局规则.some((条) => 条.内容.includes('保留给我的文本'))).toBe(false);
  });

  it('意向重读响应在 subject/generation 已变时一个字节都不落地', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    const 意向门 = deferred<{ 列表: []; 服务端: Record<string, unknown> }>();
    vi.mocked(环境.数据源.创建Agent规则提案)
      .mockRejectedValue(new BFF错误(403, 'agent_rule_scope_denied', 'gone'));
    vi.mocked(环境.数据源.读取意向).mockReturnValue(意向门.promise as never);
    const 操作 = 创建Agent规则操作(环境.deps);
    const 请求 = 操作
      .创建Agent规则提案({ 文本: '迟到验证', 作用域: { type: 'intention', intention_id: 'int_1' } })
      .catch((错误: unknown) => 错误);
    // 会话已换代后再到的意向响应必须整包丢弃
    环境.deps.主体标识引用.current = 'sub_2';
    环境.deps.会话代际.current = 8;
    意向门.resolve({ 列表: [], 服务端: { int_x: BFF意向样本 } });
    await expect(请求).resolves.toMatchObject({ code: 'agent_rule_scope_denied' });
    expect(环境.deps.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '水合后端意向' }));
    expect(环境.最新后端状态().意向快照).toEqual({});
  });

  it('切换/删除 在 409 版本冲突外还会对 404/503/network 各重读一次 Rules 且绝不重发 mutation', async () => {
    for (const 错误 of [
      new BFF错误(404, 'agent_rule_not_found', '没了'),
      new BFF错误(503, 'downstream_unavailable', '抖'),
      new BFF错误(0, 'network_error', '断'),
    ]) {
      const 环境 = 创建测试依赖({ 数据源: 创建数据源桩(), 角色: 'recruiter' });
      环境.deps.后端状态引用.current = {
        ...环境.deps.后端状态引用.current,
        招聘规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
      };
      vi.mocked(环境.数据源.修改Agent规则).mockRejectedValue(错误);
      vi.mocked(环境.数据源.删除Agent规则).mockRejectedValue(错误);
      vi.mocked(环境.数据源.读取Agent规则).mockResolvedValue([]);
      const 操作 = 创建Agent规则操作(环境.deps);
      await expect(操作.切换Agent规则(BFFAgent规则样本.rule_id, 'resume')).rejects.toBe(错误);
      expect(环境.数据源.修改Agent规则).toHaveBeenCalledTimes(1);
      expect(环境.数据源.读取Agent规则).toHaveBeenCalledTimes(1);
      await expect(操作.删除Agent规则(BFFAgent规则样本.rule_id)).rejects.toBe(错误);
      expect(环境.数据源.删除Agent规则).toHaveBeenCalledTimes(1);
      expect(环境.数据源.读取Agent规则).toHaveBeenCalledTimes(2);
    }
  });

  it('accept/dismiss 的 401 统一走 清账号状态', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.接受Agent规则提案)
      .mockRejectedValue(new BFF错误(401, 'invalid_session', '过期'));
    const 操作 = 创建Agent规则操作(环境.deps);
    await expect(操作.接受Agent规则提案(BFFAgent规则就绪提案样本.proposal_id))
      .rejects.toMatchObject({ status: 401 });
    const 最新 = 环境.最新后端状态();
    expect(最新.已登录).toBe(false);
    expect(最新.主体).toBeNull();
    expect(环境.deps.主体标识引用.current).toBeNull();
    expect(环境.deps.会话代际.current).toBe(8);
  });

  it('mutation 直接 401 在会话已换代时不清新会话，错误照抛', async () => {
    // 发送后用户已换代（登出/重登/切身份），迟到的 401 属于旧会话：
    // 绝不能把新会话登出；错误本身仍原样抛出（throw 契约不变）。
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    const 过期门 = deferred<never>();
    vi.mocked(环境.数据源.接受Agent规则提案).mockReturnValue(过期门.promise as never);
    const 操作 = 创建Agent规则操作(环境.deps);
    const 接受 = 操作
      .接受Agent规则提案(BFFAgent规则就绪提案样本.proposal_id)
      .catch((错误: unknown) => 错误);
    await vi.waitFor(() => expect(环境.数据源.接受Agent规则提案).toHaveBeenCalledTimes(1));
    // 与 完成手机登录 同主体重登同构：subject 不变、代际 +1
    环境.deps.会话代际.current += 1;
    过期门.reject(new BFF错误(401, 'invalid_session', '过期'));
    expect(await 接受).toMatchObject({ status: 401 });
    const 最新 = 环境.最新后端状态();
    expect(最新.已登录).toBe(true);
    expect(最新.主体).not.toBeNull();
    expect(环境.deps.主体标识引用.current).toBe('sub_1');
    // 代际只被本测试手动 +1：清账号状态 若被误触发会再递增到 9
    expect(环境.deps.会话代际.current).toBe(8);
  });

  it('同主体下 会话代际 前进的迟到 toggle 响应不落地（raw 快照与投影都不动）', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩(), 角色: 'recruiter' });
    const 响应门 = deferred<typeof BFFAgent规则样本>();
    vi.mocked(环境.数据源.修改Agent规则).mockReturnValue(响应门.promise as never);
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      招聘规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
    };
    const 操作 = 创建Agent规则操作(环境.deps);
    const 请求 = 操作.切换Agent规则(BFFAgent规则样本.rule_id, 'pause');
    await vi.waitFor(() => expect(环境.数据源.修改Agent规则).toHaveBeenCalledTimes(1));
    // 与 完成手机登录 同主体重登同构：subject 不变、代际 +1
    环境.deps.会话代际.current += 1;
    响应门.resolve({ ...BFFAgent规则样本, version: 4, state: 'paused' as const });
    await 请求;
    // 迟到的成功响应属于旧会话：快照保持 version 3，页面数组也没被重投
    expect(环境.最新后端状态().招聘规则快照[BFFAgent规则样本.rule_id]).toEqual(BFFAgent规则样本);
    expect(环境.deps.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '水合后端招聘规则' }));
  });

  it('同键并发只发一次，不同键互不影响', async () => {
    const 闸门 = deferred<void>();
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩(), 角色: 'recruiter' });
    vi.mocked(环境.数据源.修改Agent规则)
      .mockImplementation(() => 闸门.promise.then(() => BFFAgent规则样本));
    vi.mocked(环境.数据源.删除Agent规则).mockResolvedValue(undefined);
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      招聘规则快照: {
        [BFFAgent规则样本.rule_id]: BFFAgent规则样本,
        rul_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb: {
          ...BFFAgent规则样本,
          rule_id: 'rul_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
      },
    };
    const 操作 = 创建Agent规则操作(环境.deps);
    const 第一次 = 操作.切换Agent规则(BFFAgent规则样本.rule_id, 'pause');
    const 第二次 = 操作.切换Agent规则(BFFAgent规则样本.rule_id, 'pause');
    const 别的键 = 操作.删除Agent规则('rul_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    // 等取原始规则的微任务落地后：同键被压制、不同键照发
    await vi.waitFor(() => {
      expect(环境.数据源.修改Agent规则).toHaveBeenCalledTimes(1);
      expect(环境.数据源.删除Agent规则).toHaveBeenCalledTimes(1);
    });
    闸门.resolve();
    await Promise.all([第一次, 第二次, 别的键]);
    // 全部结算后也仍然各只有一次 —— 同键第二次从未出发
    expect(环境.数据源.修改Agent规则).toHaveBeenCalledTimes(1);
    expect(环境.数据源.删除Agent规则).toHaveBeenCalledTimes(1);
  });
});

describe('创建Agent规则操作 · accept/dismiss 错误恢复', () => {
  const 恢复码 = [
    'agent_rule_proposal_not_ready',
    'agent_rule_proposal_not_actionable',
    'agent_rule_proposal_terminal',
  ] as const;

  for (const 码 of 恢复码) {
    it(`accept 遇 ${码} 通过 GET Proposal 按权威状态恢复并原样抛出`, async () => {
      const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
      vi.mocked(环境.数据源.接受Agent规则提案).mockRejectedValue(new BFF错误(409, 码, 码));
      vi.mocked(环境.数据源.读取Agent规则提案).mockResolvedValue(BFFAgent规则就绪提案样本);
      const 操作 = 创建Agent规则操作(环境.deps);
      await expect(操作.接受Agent规则提案(BFFAgent规则就绪提案样本.proposal_id))
        .rejects.toMatchObject({ code: 码 });
      // 读提案一次，mutation 从不重放
      expect(环境.数据源.接受Agent规则提案).toHaveBeenCalledTimes(1);
      expect(环境.数据源.读取Agent规则提案)
        .toHaveBeenCalledWith('candidate', BFFAgent规则就绪提案样本.proposal_id);
      // 回执仍是 ready → 卡片保留（写回归执本身）
      expect(环境.最新后端状态().候选规则提案[BFFAgent规则就绪提案样本.proposal_id])
        .toEqual(BFFAgent规则就绪提案样本);
    });
  }

  it('GET 显示 accepted 时刷新 Rules 并收口卡片', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.接受Agent规则提案)
      .mockRejectedValue(new BFF错误(503, 'operation_outcome_unknown', '?'));
    vi.mocked(环境.数据源.读取Agent规则提案)
      .mockResolvedValue({ ...BFFAgent规则就绪提案样本, state: 'accepted' as const });
    vi.mocked(环境.数据源.读取Agent规则).mockResolvedValue([BFFAgent规则样本]);
    const 操作 = 创建Agent规则操作(环境.deps);
    await expect(操作.接受Agent规则提案(BFFAgent规则就绪提案样本.proposal_id))
      .rejects.toMatchObject({ code: 'operation_outcome_unknown' });
    expect(环境.数据源.接受Agent规则提案).toHaveBeenCalledTimes(1);
    expect(环境.数据源.读取Agent规则).toHaveBeenCalledTimes(1);
    expect(环境.最新后端状态().候选规则提案).toEqual({});
    expect(环境.最新后端状态().候选规则快照[BFFAgent规则样本.rule_id]).toEqual(BFFAgent规则样本);
  });

  it('GET 显示 dismissed 时从 actionable 表移除', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.放弃Agent规则提案).mockRejectedValue(new BFF错误(0, 'network_error', '断网'));
    vi.mocked(环境.数据源.读取Agent规则提案)
      .mockResolvedValue({ ...BFFAgent规则就绪提案样本, state: 'dismissed' as const });
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      候选规则提案: { [BFFAgent规则就绪提案样本.proposal_id]: BFFAgent规则解释中提案样本 },
    };
    const 操作 = 创建Agent规则操作(环境.deps);
    await expect(操作.放弃Agent规则提案(BFFAgent规则就绪提案样本.proposal_id))
      .rejects.toMatchObject({ code: 'network_error' });
    expect(环境.数据源.放弃Agent规则提案).toHaveBeenCalledTimes(1);
    expect(环境.最新后端状态().候选规则提案).toEqual({});
  });

  it('已知 proposal ID 的 idempotency_conflict 先经 刷新Agent规则提案 更新快照再重抛', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.放弃Agent规则提案).mockRejectedValue(new BFF错误(409, 'idempotency_conflict', 'dup'));
    const 最新回执 = { ...BFFAgent规则就绪提案样本, normalized_text: '重读到的最新文本' };
    vi.mocked(环境.数据源.读取Agent规则提案).mockResolvedValue(最新回执);
    vi.mocked(环境.数据源.读取Agent规则).mockResolvedValue([]);
    // 完整重读的 ready 清单必须仍能看到这张卡（服务端权威视图），否则后续断言无从谈起
    vi.mocked(环境.数据源.读取Agent规则提案列表)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([最新回执]);
    const 操作 = 创建Agent规则操作(环境.deps);
    await expect(操作.放弃Agent规则提案(BFFAgent规则就绪提案样本.proposal_id))
      .rejects.toMatchObject({ code: 'idempotency_conflict' });
    // 权威 GET 先提交 addressed 快照 —— 回执仍是 ready 也绝不能伪装成成功
    expect(环境.数据源.读取Agent规则提案).toHaveBeenCalledTimes(1);
    expect(环境.最新后端状态().候选规则提案[BFFAgent规则就绪提案样本.proposal_id]).toEqual(最新回执);
    // 再来一轮完整 actionable 重读（Rules + 两份清单）
    expect(环境.数据源.读取Agent规则).toHaveBeenCalledTimes(1);
    expect(vi.mocked(环境.数据源.读取Agent规则提案列表).mock.calls).toEqual([
      ['candidate', 'interpreting'],
      ['candidate', 'ready'],
    ]);
  });

  it('create/replacement 的 idempotency_conflict 重读 actionable 清单且绝不重放', async () => {
    // 恢复统一走 刷新Agent规则()：两份清单整体替换（+一轮 Rules），原 mutation 不再发第二次
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.创建Agent规则提案).mockRejectedValue(new BFF错误(409, 'idempotency_conflict', 'dup'));
    const 操作 = 创建Agent规则操作(环境.deps);
    await expect(
      操作.创建Agent规则提案({ 文本: '又一次冲突', 作用域: { type: 'global' } }),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
    expect(环境.数据源.创建Agent规则提案).toHaveBeenCalledTimes(1);
    expect(vi.mocked(环境.数据源.读取Agent规则提案列表).mock.calls).toEqual([
      ['candidate', 'interpreting'],
      ['candidate', 'ready'],
    ]);
    expect(环境.数据源.读取Agent规则).toHaveBeenCalledTimes(1);

    const 替换环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(替换环境.数据源.创建Agent规则替换提案)
      .mockRejectedValue(new BFF错误(409, 'idempotency_conflict', 'dup'));
    替换环境.deps.后端状态引用.current = {
      ...替换环境.deps.后端状态引用.current,
      候选规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
    };
    const 替换操作 = 创建Agent规则操作(替换环境.deps);
    await expect(替换操作.创建Agent规则替换提案(BFFAgent规则样本.rule_id, '换一种说法'))
      .rejects.toMatchObject({ code: 'idempotency_conflict' });
    expect(替换环境.数据源.创建Agent规则替换提案).toHaveBeenCalledTimes(1);
    expect(vi.mocked(替换环境.数据源.读取Agent规则提案列表).mock.calls).toEqual([
      ['candidate', 'interpreting'],
      ['candidate', 'ready'],
    ]);
    expect(替换环境.数据源.读取Agent规则).toHaveBeenCalledTimes(1);
  });
});

describe('水合Agent规则角色数据 与 刷新Agent规则', () => {
  it('起跑把 未开始|失败 推进为 进行中；另一角色的种子不受影响', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    const 规则门 = deferred<typeof BFFAgent规则样本[]>();
    const 解读门 = deferred<never[]>();
    const 就绪门 = deferred<never[]>();
    vi.mocked(环境.数据源.读取Agent规则).mockReturnValue(规则门.promise as never);
    vi.mocked(环境.数据源.读取Agent规则提案列表)
      .mockReturnValueOnce(解读门.promise as never)
      .mockReturnValueOnce(就绪门.promise as never);
    const 运行 = 直接运行水合(环境)();
    // 同步推进发生在首个 await 之前：此刻就能看到 进行中
    expect(环境.最新后端状态().Agent规则水合.candidate).toEqual({ rules: '进行中', proposals: '进行中' });
    expect(环境.最新后端状态().Agent规则水合.recruiter).toEqual({ rules: '未开始', proposals: '未开始' });
    规则门.resolve([BFFAgent规则样本]);
    解读门.resolve([]);
    就绪门.resolve([]);
    const 结果 = await 运行;
    expect(结果.map((项) => 项.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    expect(环境.最新后端状态().Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' });
  });

  it('(a) 从失败的 Proposal 阶段刷新：一次 Rule 读取 + 两份清单，双阶段回到 成功', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      Agent规则水合: {
        candidate: { rules: '成功', proposals: '失败' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
    };
    vi.mocked(环境.数据源.读取Agent规则).mockResolvedValue([BFFAgent规则样本]);
    vi.mocked(环境.数据源.读取Agent规则提案列表)
      .mockResolvedValueOnce([BFFAgent规则解释中提案样本])
      .mockResolvedValueOnce([BFFAgent规则就绪提案样本]);
    await 直接运行水合(环境)();
    expect(环境.数据源.读取Agent规则).toHaveBeenCalledTimes(1);
    expect(vi.mocked(环境.数据源.读取Agent规则提案列表).mock.calls).toEqual([
      ['candidate', 'interpreting'],
      ['candidate', 'ready'],
    ]);
    expect(环境.最新后端状态().Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' });
    expect(环境.最新后端状态().候选规则提案[BFFAgent规则就绪提案样本.proposal_id])
      .toEqual(BFFAgent规则就绪提案样本);
  });

  it('(b) 已成功的两个域在刷新途中保持 成功，不闪退', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      Agent规则水合: {
        candidate: { rules: '成功', proposals: '成功' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
      候选规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
    };
    const 规则门 = deferred<typeof BFFAgent规则样本[]>();
    const 解读门 = deferred<never[]>();
    const 就绪门 = deferred<never[]>();
    vi.mocked(环境.数据源.读取Agent规则).mockReturnValue(规则门.promise as never);
    vi.mocked(环境.数据源.读取Agent规则提案列表)
      .mockReturnValueOnce(解读门.promise as never)
      .mockReturnValueOnce(就绪门.promise as never);
    const 运行 = 直接运行水合(环境)();
    // 同步断言：进入刷新的瞬间，已 成功 的域必须仍是 成功
    expect(环境.最新后端状态().Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' });
    expect(Object.keys(环境.最新后端状态().候选规则快照)).toEqual([BFFAgent规则样本.rule_id]);
    规则门.resolve([BFFAgent规则样本]);
    解读门.resolve([]);
    就绪门.resolve([]);
    await 运行;
    expect(环境.最新后端状态().Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' });
  });

  it('(c) ready 清单被拒时 Proposal 域落到 失败，绝不停留 进行中；rules 保持 成功', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.读取Agent规则).mockResolvedValue([BFFAgent规则样本]);
    vi.mocked(环境.数据源.读取Agent规则提案列表)
      .mockResolvedValueOnce([BFFAgent规则解释中提案样本])
      .mockRejectedValueOnce(new BFF错误(503, 'downstream_unavailable', 'down'));
    const 结果 = await 直接运行水合(环境)();
    expect(结果.map((项) => 项.status)).toEqual(['fulfilled', 'fulfilled', 'rejected']);
    expect(环境.最新后端状态().Agent规则水合.candidate.rules).toBe('成功');
    expect(环境.最新后端状态().Agent规则水合.candidate.proposals).toBe('失败');
    // 任一清单失败就不提交半份提案表
    expect(环境.最新后端状态().候选规则提案).toEqual({});
  });

  // 失败腿：从已 成功 的底座起跑的刷新即使有读取被拒，两个阶段也保持 成功，
  // 已提交的快照行与提案卡原样可见（权威替换只发生在对应读取 fulfilled 时）。
  it('已 成功 的域在刷新读取被拒时保持 成功，快照行与提案卡不闪退', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      候选规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
      候选规则提案: { [BFFAgent规则就绪提案样本.proposal_id]: BFFAgent规则就绪提案样本 },
      Agent规则水合: {
        candidate: { rules: '成功', proposals: '成功' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
    };
    // 权威视图里该规则行不变；唯一被拒的是 ready 清单（非 401）
    vi.mocked(环境.数据源.读取Agent规则).mockResolvedValue([BFFAgent规则样本]);
    vi.mocked(环境.数据源.读取Agent规则提案列表)
      .mockResolvedValueOnce([BFFAgent规则解释中提案样本])
      .mockRejectedValueOnce(new BFF错误(503, 'downstream_unavailable', 'down'));
    const 结果 = await 直接运行水合(环境)();
    expect(结果.map((项) => 项.status)).toEqual(['fulfilled', 'fulfilled', 'rejected']);
    // 刷新失败不降级任何已 成功 的域
    expect(环境.最新后端状态().Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' });
    // 已提交的快照行与提案卡原样可见（清单被拒 → 不做整体替换）
    expect(环境.最新后端状态().候选规则快照[BFFAgent规则样本.rule_id]).toEqual(BFFAgent规则样本);
    expect(环境.最新后端状态().候选规则提案[BFFAgent规则就绪提案样本.proposal_id]).toEqual(BFFAgent规则就绪提案样本);
  });

  it('导出的 刷新Agent规则 用完整链路刷新当前角色并把规则投到页面数组', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.读取Agent规则)
      .mockResolvedValue([BFFAgent规则样本, BFF意向Agent规则样本]);
    const 操作 = 创建Agent规则操作(环境.deps);
    await 操作.刷新Agent规则();
    expect(环境.数据源.读取Agent规则).toHaveBeenCalledWith('candidate');
    expect(vi.mocked(环境.数据源.读取Agent规则提案列表).mock.calls).toEqual([
      ['candidate', 'interpreting'],
      ['candidate', 'ready'],
    ]);
    expect(环境.最新后端状态().Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' });
    // orphan intention scope：意向快照为空时整条省略，全局照常显示（映射由当前意向快照驱动）
    expect(环境.页面状态.current.全局规则.map((条) => 条.编号)).toEqual([BFFAgent规则样本.rule_id]);
    expect(环境.页面状态.current.意向级规则).toEqual([]);
  });

  it('recruiter 刷新走 recruiter 前缀并投到 企业规则', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩(), 角色: 'recruiter' });
    vi.mocked(环境.数据源.读取Agent规则).mockResolvedValue([{ ...BFFAgent规则样本, version: 2 }]);
    const 操作 = 创建Agent规则操作(环境.deps);
    await 操作.刷新Agent规则();
    expect(环境.数据源.读取Agent规则).toHaveBeenCalledWith('recruiter');
    expect(环境.页面状态.current.企业规则.map((条) => 条.编号)).toEqual([BFFAgent规则样本.rule_id]);
    expect(环境.最新后端状态().招聘规则快照[BFFAgent规则样本.rule_id]?.version).toBe(2);
  });

  it('角色隔离：candidate 水合不动 recruiter 已有字典', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      招聘规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
    };
    vi.mocked(环境.数据源.读取Agent规则).mockResolvedValue([]);
    const 结果 = await 直接运行水合(环境)();
    expect(结果.every((项) => 项.status === 'fulfilled')).toBe(true);
    expect(环境.最新后端状态().招聘规则快照[BFFAgent规则样本.rule_id]).toEqual(BFFAgent规则样本);
  });

  it('subject/generation 变化丢弃迟到水合：快照一个都不落地', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    const 规则门 = deferred<typeof BFFAgent规则样本[]>();
    const 解读门 = deferred<never[]>();
    const 就绪门 = deferred<never[]>();
    vi.mocked(环境.数据源.读取Agent规则).mockReturnValue(规则门.promise as never);
    vi.mocked(环境.数据源.读取Agent规则提案列表)
      .mockReturnValueOnce(解读门.promise as never)
      .mockReturnValueOnce(就绪门.promise as never);
    const 运行 = 直接运行水合(环境)();
    // 起跑即 写在 refs 之后，此刻再换代——所有迟到响应都该被丢
    环境.deps.主体标识引用.current = 'sub_next';
    环境.deps.会话代际.current = 99;
    规则门.resolve([BFFAgent规则样本]);
    解读门.resolve([]);
    就绪门.resolve([]);
    await 运行;
    const 最新 = 环境.最新后端状态();
    expect(最新.候选规则快照).toEqual({});
    expect(最新.候选规则提案).toEqual({});
    expect(最新.Agent规则水合.candidate.rules).not.toBe('成功');
  });

  it('同帧两条规则并入都从函数式更新器的 旧 构建整表（ref 渲染滞后不丢先落的版本）', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩(), 角色: 'recruiter' });
    const 甲 = { ...BFFAgent规则样本, rule_id: 'rul_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', version: 1 };
    const 乙 = { ...BFFAgent规则样本, rule_id: 'rul_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', version: 1 };
    // 渲染滞后镜像：设后端状态 只更新草稿，ref 读已提交值；赋值 已提交=草稿 模拟一次渲染落定
    let 已提交: 后端状态 = {
      ...环境.deps.后端状态引用.current,
      招聘规则快照: { [甲.rule_id]: 甲, [乙.rule_id]: 乙 },
    };
    let 草稿 = 已提交;
    const 滞后依赖 = {
      ...环境.deps,
      设后端状态: (更新: (旧: 后端状态) => 后端状态) => { 草稿 = 更新(草稿); },
      后端状态引用: {
        get current() { return 已提交; },
        set current(值: 后端状态) { 已提交 = 值; 草稿 = 值; },
      },
    };
    vi.mocked(环境.数据源.修改Agent规则).mockImplementation(async (_role: BFF角色, ruleId: string) =>
      ruleId === 甲.rule_id ? { ...甲, version: 2 } : { ...乙, version: 2 });
    const 操作 = 创建Agent规则操作(滞后依赖 as unknown as 后端操作依赖);
    // 两次 toggle 在同一帧内先后结算：中间没有渲染提交，ref 一直停在旧表
    await 操作.切换Agent规则(甲.rule_id, 'pause');
    await 操作.切换Agent规则(乙.rule_id, 'pause');
    已提交 = 草稿; // 渲染落定
    const 快照 = 已提交.招聘规则快照;
    expect(快照[甲.rule_id]?.version).toBe(2);
    expect(快照[乙.rule_id]?.version).toBe(2);
  });

  it('迟到 GET 不能覆盖终端结果：提案代际新读胜过旧读', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    const 迟到GET = deferred<typeof BFFAgent规则解释中提案样本>();
    const 新鲜GET = deferred<typeof BFFAgent规则解释中提案样本>();
    vi.mocked(环境.数据源.读取Agent规则提案)
      .mockReturnValueOnce(迟到GET.promise as never)
      .mockReturnValueOnce(新鲜GET.promise as never);
    vi.mocked(环境.数据源.放弃Agent规则提案).mockRejectedValue(new BFF错误(0, 'network_error', '断'));
    const 操作 = 创建Agent规则操作(环境.deps);
    // 第一位读者先占住代际 N
    const 迟到读 = 操作.刷新Agent规则提案(BFFAgent规则就绪提案样本.proposal_id);
    await vi.waitFor(() => expect(环境.数据源.读取Agent规则提案).toHaveBeenCalledTimes(1));
    // 放弃流程：POST 断网 → 代际连推两级 → 恢复 GET 抢先落地为「已移除」
    const 放弃 = 操作
      .放弃Agent规则提案(BFFAgent规则就绪提案样本.proposal_id)
      .catch((错误: unknown) => 错误);
    await vi.waitFor(() => expect(环境.数据源.放弃Agent规则提案).toHaveBeenCalled());
    新鲜GET.resolve({
      ...BFFAgent规则解释中提案样本,
      proposal_id: BFFAgent规则就绪提案样本.proposal_id,
      state: 'dismissed',
    } as typeof BFFAgent规则解释中提案样本);
    await 放弃;
    expect(环境.最新后端状态().候选规则提案).toEqual({});
    // 这时最老的迟到 GET 才落地：interpreting 回执不得复活被移除的卡
    迟到GET.resolve(BFFAgent规则解释中提案样本);
    await 迟到读;
    expect(环境.最新后端状态().候选规则提案).toEqual({});
  });

  // finding-r1：终端操作（accept/dismiss）发送前必须自增提案代际 —— 轮询/恢复捕获的
  // 旧单卡 GET 晚于收口落地时过不了代际检查，不能把 ready/interpreting 回执盖回已移除的卡。
  it('accept 发送前推进提案代际：旧轮单卡 GET 的 ready 回执不能复活已收口的卡', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    const 旧GET = deferred<typeof BFFAgent规则就绪提案样本>();
    vi.mocked(环境.数据源.读取Agent规则提案).mockReturnValueOnce(旧GET.promise as never);
    vi.mocked(环境.数据源.接受Agent规则提案).mockResolvedValue(BFFAgent规则样本);
    vi.mocked(环境.数据源.读取Agent规则).mockResolvedValue([BFFAgent规则样本]);
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      候选规则提案: { [BFFAgent规则就绪提案样本.proposal_id]: BFFAgent规则就绪提案样本 },
    };
    const 操作 = 创建Agent规则操作(环境.deps);
    // 轮询式的单卡 GET 先起跑（捕获旧代际）
    const 轮询 = 操作.刷新Agent规则提案(BFFAgent规则就绪提案样本.proposal_id).catch((错误: unknown) => 错误);
    await vi.waitFor(() => expect(环境.数据源.读取Agent规则提案).toHaveBeenCalledTimes(1));
    // accept 成功并经完整刷新收口：actionable 表清空
    await 操作.接受Agent规则提案(BFFAgent规则就绪提案样本.proposal_id);
    expect(环境.最新后端状态().候选规则提案).toEqual({});
    // 旧 GET 这时才落地：ready 回执不得把卡重新插回
    旧GET.resolve(BFFAgent规则就绪提案样本);
    await 轮询;
    expect(环境.最新后端状态().候选规则提案).toEqual({});
  });

  it('dismiss 发送前推进提案代际：旧轮单卡 GET 的 ready 回执不能复活已移除的卡', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    const 旧GET = deferred<typeof BFFAgent规则就绪提案样本>();
    vi.mocked(环境.数据源.读取Agent规则提案).mockReturnValueOnce(旧GET.promise as never);
    vi.mocked(环境.数据源.放弃Agent规则提案)
      .mockResolvedValue({ ...BFFAgent规则就绪提案样本, state: 'dismissed' as const });
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      候选规则提案: { [BFFAgent规则就绪提案样本.proposal_id]: BFFAgent规则就绪提案样本 },
    };
    const 操作 = 创建Agent规则操作(环境.deps);
    const 轮询 = 操作.刷新Agent规则提案(BFFAgent规则就绪提案样本.proposal_id).catch((错误: unknown) => 错误);
    await vi.waitFor(() => expect(环境.数据源.读取Agent规则提案).toHaveBeenCalledTimes(1));
    await 操作.放弃Agent规则提案(BFFAgent规则就绪提案样本.proposal_id);
    expect(环境.最新后端状态().候选规则提案).toEqual({});
    旧GET.resolve(BFFAgent规则就绪提案样本);
    await 轮询;
    expect(环境.最新后端状态().候选规则提案).toEqual({});
  });

  it('刷新Agent规则提案 不获取也不检查 Agent提案 写锁（锁被占时恢复 GET 照跑）', async () => {
    const 环境 = 创建测试依赖({
      数据源: 创建数据源桩(),
      预置锁: [`Agent提案:${BFFAgent规则就绪提案样本.proposal_id}`],
    });
    vi.mocked(环境.数据源.读取Agent规则提案).mockResolvedValue(BFFAgent规则就绪提案样本);
    const 操作 = 创建Agent规则操作(环境.deps);
    await 操作.刷新Agent规则提案(BFFAgent规则就绪提案样本.proposal_id);
    expect(环境.数据源.读取Agent规则提案)
      .toHaveBeenCalledWith('candidate', BFFAgent规则就绪提案样本.proposal_id);
    expect(环境.最新后端状态().候选规则提案[BFFAgent规则就绪提案样本.proposal_id])
      .toEqual(BFFAgent规则就绪提案样本);
    // 该 GET 从不释放别人的写锁
    expect(环境.deps.锁.current.has(`Agent提案:${BFFAgent规则就绪提案样本.proposal_id}`)).toBe(true);
  });

  it('刷新Agent规则提案 只动目标卡：interpreting 原位更新且不读 Rules，dismissed 移除', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    const 同址解读中 = {
      ...BFFAgent规则解释中提案样本,
      proposal_id: BFFAgent规则就绪提案样本.proposal_id,
    };
    vi.mocked(环境.数据源.读取Agent规则提案)
      .mockResolvedValueOnce(同址解读中);
    const 操作 = 创建Agent规则操作(环境.deps);
    await 操作.刷新Agent规则提案(BFFAgent规则就绪提案样本.proposal_id);
    expect(环境.数据源.读取Agent规则).not.toHaveBeenCalled();
    expect(环境.最新后端状态().候选规则提案[BFFAgent规则就绪提案样本.proposal_id])
      .toEqual(同址解读中);
    // 同一地址后来读到 dismissed → 移除而不是留着终态回执
    vi.mocked(环境.数据源.读取Agent规则提案)
      .mockResolvedValue({ ...BFFAgent规则就绪提案样本, state: 'dismissed' as const });
    await 操作.刷新Agent规则提案(BFFAgent规则就绪提案样本.proposal_id);
    expect(环境.最新后端状态().候选规则提案).toEqual({});
  });

  // review-r3 R3-1：权威单卡 GET 撞 401 = 会话在读途中失效。轮询方/页面按约定安静
  // 吞掉错误，但操作层必须先统一登出清理，不能顶着已登录壳吞掉。
  it('刷新Agent规则提案 的权威 GET 撞 401 统一清账号并安静返回（不抛给轮询方）', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.读取Agent规则提案).mockRejectedValue(new BFF错误(401, 'invalid_session', '过期'));
    const 操作 = 创建Agent规则操作(环境.deps);
    await expect(操作.刷新Agent规则提案(BFFAgent规则解释中提案样本.proposal_id)).resolves.toBeUndefined();
    const 最新 = 环境.最新后端状态();
    expect(最新.已登录).toBe(false);
    expect(最新.主体).toBeNull();
    expect(环境.deps.主体标识引用.current).toBeNull();
    expect(环境.deps.会话代际.current).toBe(8);
  });

  it('not-found 对账重读清单撞 401 也统一清账号并安静返回', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.读取Agent规则提案)
      .mockRejectedValue(new BFF错误(404, 'agent_rule_proposal_not_found', '没了'));
    vi.mocked(环境.数据源.读取Agent规则提案列表)
      .mockRejectedValue(new BFF错误(401, 'invalid_session', '过期'));
    const 操作 = 创建Agent规则操作(环境.deps);
    await expect(操作.刷新Agent规则提案(BFFAgent规则解释中提案样本.proposal_id)).resolves.toBeUndefined();
    // interpreting 先撞 401，ready 不再发
    expect(环境.数据源.读取Agent规则提案列表).toHaveBeenCalledTimes(1);
    const 最新 = 环境.最新后端状态();
    expect(最新.已登录).toBe(false);
    expect(环境.deps.主体标识引用.current).toBeNull();
    expect(环境.deps.会话代际.current).toBe(8);
  });

  it('刷新Agent规则提案 的 401 在会话已换代时不清新会话，错误语义不变', async () => {
    // 迟到的 401 属于旧会话：转移路径自己清过账号 —— 跳过清理，错误照抛（轮询方吞）
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    const 提案门 = deferred<never>();
    vi.mocked(环境.数据源.读取Agent规则提案).mockReturnValue(提案门.promise as never);
    const 操作 = 创建Agent规则操作(环境.deps);
    const 轮询 = 操作
      .刷新Agent规则提案(BFFAgent规则解释中提案样本.proposal_id)
      .catch((错误: unknown) => 错误);
    await vi.waitFor(() => expect(环境.数据源.读取Agent规则提案).toHaveBeenCalledTimes(1));
    // 与 完成手机登录 同主体重登同构：subject 不变、代际 +1
    环境.deps.会话代际.current += 1;
    提案门.reject(new BFF错误(401, 'invalid_session', '过期'));
    expect(await 轮询).toMatchObject({ status: 401 });
    const 最新 = 环境.最新后端状态();
    expect(最新.已登录).toBe(true);
    expect(最新.主体).not.toBeNull();
    expect(环境.deps.主体标识引用.current).toBe('sub_1');
    // 代际只被本测试手动 +1：清账号状态 若被误触发会再递增到 9
    expect(环境.deps.会话代际.current).toBe(8);
  });

  it('not-found 对账重读的非 401 失败维持安静吞掉：不清账号也不打断轮询方', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.读取Agent规则提案)
      .mockRejectedValue(new BFF错误(404, 'agent_rule_proposal_not_found', '没了'));
    vi.mocked(环境.数据源.读取Agent规则提案列表)
      .mockRejectedValue(new BFF错误(503, 'downstream_unavailable', '抖'));
    const 操作 = 创建Agent规则操作(环境.deps);
    await expect(操作.刷新Agent规则提案(BFFAgent规则解释中提案样本.proposal_id)).resolves.toBeUndefined();
    const 最新 = 环境.最新后端状态();
    expect(最新.已登录).toBe(true);
    expect(环境.deps.会话代际.current).toBe(7);
  });

  it('刷新Agent规则 的水合 401 也统一清账号', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.读取Agent规则).mockRejectedValue(new BFF错误(401, 'invalid_session', '过期'));
    const 操作 = 创建Agent规则操作(环境.deps);
    await 操作.刷新Agent规则();
    expect(环境.最新后端状态().已登录).toBe(false);
    expect(环境.deps.主体标识引用.current).toBeNull();
  });

  it('accept 成功后的权威刷新遇 401 也统一清账号（follow-up 扫描）', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    // mutation 本体成功，会话却在读回权威 Rules 的途中过期
    vi.mocked(环境.数据源.接受Agent规则提案).mockResolvedValue(BFFAgent规则样本);
    vi.mocked(环境.数据源.读取Agent规则).mockRejectedValue(new BFF错误(401, 'invalid_session', '过期'));
    const 操作 = 创建Agent规则操作(环境.deps);
    await 操作.接受Agent规则提案(BFFAgent规则就绪提案样本.proposal_id);
    expect(环境.最新后端状态().已登录).toBe(false);
    expect(环境.deps.主体标识引用.current).toBeNull();
    expect(环境.deps.会话代际.current).toBe(8);
  });

  it('accept 成功后的 follow-up 刷新遇 401 但会话已换代时不清新会话', async () => {
    // 权威刷新途中用户已换代（登出/重登/切身份，转移路径自己清过账号）：
    // 迟到的 401 扫描绝不能登出新一代 —— 过 fence 就跳过清理。
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    const 规则门 = deferred<never>();
    vi.mocked(环境.数据源.接受Agent规则提案).mockResolvedValue(BFFAgent规则样本);
    vi.mocked(环境.数据源.读取Agent规则).mockReturnValue(规则门.promise as never);
    const 操作 = 创建Agent规则操作(环境.deps);
    const 接受 = 操作
      .接受Agent规则提案(BFFAgent规则就绪提案样本.proposal_id)
      .catch((错误: unknown) => 错误);
    await vi.waitFor(() => expect(环境.数据源.读取Agent规则).toHaveBeenCalledTimes(1));
    // 与 完成手机登录 同主体重登同构：subject 不变、代际 +1
    环境.deps.会话代际.current += 1;
    规则门.reject(new BFF错误(401, 'invalid_session', '过期'));
    await 接受;
    const 最新 = 环境.最新后端状态();
    expect(最新.已登录).toBe(true);
    expect(最新.主体).not.toBeNull();
    expect(环境.deps.主体标识引用.current).toBe('sub_1');
    // 代际只被本测试手动 +1：清账号状态 若被误触发会再递增到 9
    expect(环境.deps.会话代际.current).toBe(8);
    // 401 不走非 401 的轻提示通道
    expect(轻提示).not.toHaveBeenCalled();
  });

  it('accept 成功后的 follow-up 刷新非 401 失败也轻提示，已成功的域保持成功与旧快照', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    // 已 成功 的底座：刷新读被拒不得降级，但也不能无声吞掉 —— 用户得有重试的由头
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      候选规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
      候选规则提案: { [BFFAgent规则就绪提案样本.proposal_id]: BFFAgent规则就绪提案样本 },
      Agent规则水合: {
        candidate: { rules: '成功', proposals: '成功' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
    };
    vi.mocked(环境.数据源.接受Agent规则提案).mockResolvedValue(BFFAgent规则样本);
    vi.mocked(环境.数据源.读取Agent规则).mockResolvedValue([BFFAgent规则样本]);
    vi.mocked(环境.数据源.读取Agent规则提案列表)
      .mockRejectedValueOnce(new BFF错误(503, 'downstream_unavailable', '抖'));
    const 操作 = 创建Agent规则操作(环境.deps);
    await 操作.接受Agent规则提案(BFFAgent规则就绪提案样本.proposal_id);
    // 503 走通用映射的冻结文案：用户由此知道刷新没成，可以点「规则加载失败，重试」
    expect(轻提示).toHaveBeenCalledWith('后端服务暂时不可用，请稍后重试');
    // 不降级：两个阶段保持 成功，已提交的快照行与卡片原样可见
    const 最新 = 环境.最新后端状态();
    expect(最新.Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' });
    expect(最新.候选规则快照[BFFAgent规则样本.rule_id]).toEqual(BFFAgent规则样本);
    expect(最新.已登录).toBe(true);
  });

  it('follow-up 刷新非 401 失败在会话已换代时不轻提示（旧轮拒绝不弹进新会话）', async () => {
    // review-r3 R3-3：提示与 401 清理同一把会话 fence —— 换代后迟到的旧轮拒绝整包
    // 丢弃：不提示、不动阶段、不动快照（与 stale 丢弃口径一致）。
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      候选规则快照: { [BFFAgent规则样本.rule_id]: BFFAgent规则样本 },
      候选规则提案: { [BFFAgent规则就绪提案样本.proposal_id]: BFFAgent规则就绪提案样本 },
      Agent规则水合: {
        candidate: { rules: '成功', proposals: '成功' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
    };
    vi.mocked(环境.数据源.接受Agent规则提案).mockResolvedValue(BFFAgent规则样本);
    const 规则门 = deferred<never[]>();
    vi.mocked(环境.数据源.读取Agent规则).mockReturnValue(规则门.promise as never);
    const 操作 = 创建Agent规则操作(环境.deps);
    const 接受 = 操作
      .接受Agent规则提案(BFFAgent规则就绪提案样本.proposal_id)
      .catch((错误: unknown) => 错误);
    await vi.waitFor(() => expect(环境.数据源.读取Agent规则).toHaveBeenCalledTimes(1));
    // 与 完成手机登录 同主体重登同构：subject 不变、代际 +1
    环境.deps.会话代际.current += 1;
    规则门.reject(new BFF错误(503, 'downstream_unavailable', '抖'));
    await 接受;
    expect(轻提示).not.toHaveBeenCalled();
    const 最新 = 环境.最新后端状态();
    expect(最新.Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' });
    expect(最新.候选规则快照[BFFAgent规则样本.rule_id]).toEqual(BFFAgent规则样本);
    expect(最新.已登录).toBe(true);
  });

  it('刷新Agent规则提案 读到 accepted 后的收口刷新遇 401 也统一清账号', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    vi.mocked(环境.数据源.读取Agent规则提案)
      .mockResolvedValue({ ...BFFAgent规则就绪提案样本, state: 'accepted' as const });
    vi.mocked(环境.数据源.读取Agent规则).mockRejectedValue(new BFF错误(401, 'invalid_session', '过期'));
    const 操作 = 创建Agent规则操作(环境.deps);
    await 操作.刷新Agent规则提案(BFFAgent规则就绪提案样本.proposal_id);
    expect(环境.最新后端状态().已登录).toBe(false);
    expect(环境.deps.主体标识引用.current).toBeNull();
    expect(环境.deps.会话代际.current).toBe(8);
  });

  it('同角色完整水合期间二次刷新不重复发请求（single-flight）', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    const 规则门 = deferred<never[]>();
    vi.mocked(环境.数据源.读取Agent规则).mockReturnValue(规则门.promise as never);
    const 操作 = 创建Agent规则操作(环境.deps);
    const 第一次 = 操作.刷新Agent规则();
    const 第二次 = 操作.刷新Agent规则();
    // 串行队列在微任务里起跑首轮；公共刷新的 single-flight 锁照样压制第二次
    await vi.waitFor(() => expect(环境.数据源.读取Agent规则).toHaveBeenCalledTimes(1));
    规则门.resolve([] as never);
    await Promise.all([第一次, 第二次]);
    // 全部结算后仍然只有首轮这一遍读
    expect(环境.数据源.读取Agent规则).toHaveBeenCalledTimes(1);
  });

  // finding-final 回归：两个 accept 各自触发完整刷新，旧轮挂住的过期读不可能在
  // 新轮提交之后落地 —— 串行队列保证后一轮的读在前一轮整轮提交完才起跑。
  it('并发完整刷新串行提交：旧轮的过期读不会复活已 accept 收口的卡片', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    const 另一提案 = { ...BFFAgent规则就绪提案样本, proposal_id: 'arp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
    // 两张 ready 卡同时在场：两个 accept 各自成功，各触发一轮完整刷新
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      候选规则提案: {
        [BFFAgent规则就绪提案样本.proposal_id]: BFFAgent规则就绪提案样本,
        [另一提案.proposal_id]: 另一提案,
      },
    };
    vi.mocked(环境.数据源.接受Agent规则提案).mockResolvedValue(BFFAgent规则样本);
    // 旧轮的 Rules 读挂住，清单返回过期视图（卡片原样可见、规则还没 materialize）
    const 旧轮规则门 = deferred<typeof BFFAgent规则样本[]>();
    vi.mocked(环境.数据源.读取Agent规则)
      .mockReturnValueOnce(旧轮规则门.promise as never)
      .mockResolvedValueOnce([BFFAgent规则样本]);
    vi.mocked(环境.数据源.读取Agent规则提案列表)
      .mockResolvedValueOnce([]) // 旧轮 interpreting
      .mockResolvedValueOnce([BFFAgent规则就绪提案样本, 另一提案]) // 旧轮 ready：过期副本
      .mockResolvedValueOnce([]) // 新轮 interpreting：已收口
      .mockResolvedValueOnce([]); // 新轮 ready：已收口
    const 操作 = 创建Agent规则操作(环境.deps);
    const 接受一 = 操作.接受Agent规则提案(BFFAgent规则就绪提案样本.proposal_id);
    await vi.waitFor(() => expect(环境.数据源.读取Agent规则).toHaveBeenCalledTimes(1));
    const 接受二 = 操作.接受Agent规则提案(另一提案.proposal_id);
    await vi.waitFor(() => expect(环境.数据源.接受Agent规则提案).toHaveBeenCalledTimes(2));
    // 新一轮已排队但未起跑：旧轮挂住期间权威读不涨
    expect(环境.数据源.读取Agent规则).toHaveBeenCalledTimes(1);
    // 旧轮用过期读提交 —— 两张卡被短暂「复活」（没有串行时这就是终态）
    旧轮规则门.resolve([]);
    await 接受一;
    expect(Object.keys(环境.最新后端状态().候选规则提案)).toEqual([
      BFFAgent规则就绪提案样本.proposal_id,
      另一提案.proposal_id,
    ]);
    // 新一轮的读在旧轮整轮提交完才起跑，并用权威视图最后提交
    expect(环境.数据源.读取Agent规则).toHaveBeenCalledTimes(2);
    await 接受二;
    const 最新 = 环境.最新后端状态();
    expect(最新.候选规则快照[BFFAgent规则样本.rule_id]).toEqual(BFFAgent规则样本);
    expect(最新.候选规则提案).toEqual({});
  });

  it('公共水合锁被占时 accept follow-up 仍完成对账（排队等待而非静默跳过）', async () => {
    const 环境 = 创建测试依赖({
      数据源: 创建数据源桩(),
      预置锁: ['Agent规则水合:candidate'],
    });
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      候选规则提案: { [BFFAgent规则就绪提案样本.proposal_id]: BFFAgent规则就绪提案样本 },
    };
    vi.mocked(环境.数据源.接受Agent规则提案).mockResolvedValue(BFFAgent规则样本);
    vi.mocked(环境.数据源.读取Agent规则).mockResolvedValue([BFFAgent规则样本]);
    const 操作 = 创建Agent规则操作(环境.deps);
    await 操作.接受Agent规则提案(BFFAgent规则就绪提案样本.proposal_id);
    // 公共刷新的 single-flight 锁不拦 follow-up：对账照常落地（卡收口 + 规则进快照）
    expect(环境.最新后端状态().候选规则提案).toEqual({});
    expect(环境.最新后端状态().候选规则快照[BFFAgent规则样本.rule_id]).toEqual(BFFAgent规则样本);
    // 串行队列不释放、也不持有公共锁
    expect(环境.deps.锁.current.has('Agent规则水合:candidate')).toBe(true);
  });

  it('排队期间会话过期：轮次整轮丢弃（不发读、不写状态）', async () => {
    const 环境 = 创建测试依赖({ 数据源: 创建数据源桩() });
    const 另一提案 = { ...BFFAgent规则就绪提案样本, proposal_id: 'arp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
    环境.deps.后端状态引用.current = {
      ...环境.deps.后端状态引用.current,
      候选规则提案: {
        [BFFAgent规则就绪提案样本.proposal_id]: BFFAgent规则就绪提案样本,
        [另一提案.proposal_id]: 另一提案,
      },
    };
    const 旧轮规则门 = deferred<typeof BFFAgent规则样本[]>();
    vi.mocked(环境.数据源.接受Agent规则提案).mockResolvedValue(BFFAgent规则样本);
    vi.mocked(环境.数据源.读取Agent规则).mockReturnValue(旧轮规则门.promise as never);
    const 操作 = 创建Agent规则操作(环境.deps);
    const 接受一 = 操作.接受Agent规则提案(BFFAgent规则就绪提案样本.proposal_id);
    await vi.waitFor(() => expect(环境.数据源.读取Agent规则).toHaveBeenCalledTimes(1));
    const 接受二 = 操作.接受Agent规则提案(另一提案.proposal_id);
    await vi.waitFor(() => expect(环境.数据源.接受Agent规则提案).toHaveBeenCalledTimes(2));
    // 新一轮排队期间会话换代：轮次丢弃 —— 不发第二遍读，也不写任何状态
    环境.deps.主体标识引用.current = 'sub_2';
    环境.deps.会话代际.current = 8;
    旧轮规则门.resolve([]);
    await Promise.all([接受一, 接受二]);
    expect(环境.数据源.读取Agent规则).toHaveBeenCalledTimes(1);
    const 最新 = 环境.最新后端状态();
    expect(最新.候选规则快照).toEqual({});
    expect(Object.keys(最新.候选规则提案)).toEqual([
      BFFAgent规则就绪提案样本.proposal_id,
      另一提案.proposal_id,
    ]);
    expect(最新.已登录).toBe(true);
  });
});

describe('取Agent规则错误文案 · 七码冻结 + 兜底', () => {
  const 冻结文案: Array<[string, string]> = [
    ['agent_rule_proposal_not_ready', 'AI代理还在理解这条规则，请稍后再试'],
    ['agent_rule_proposal_not_actionable', '这条内容暂时不能成为长期规则，请放弃或换一种说法'],
    ['agent_rule_proposal_terminal', '这条规则提案已经处理，请查看最新状态'],
    ['idempotency_conflict', '这次操作与之前的请求冲突，请检查最新状态后重试'],
    ['agent_rule_scope_denied', '这个意向已不可用，请重新选择规则范围'],
    ['agent_rule_not_found', '这条规则已不存在，请查看最新状态'],
    ['agent_rule_proposal_not_found', '这条规则提案已不存在，请查看最新状态'],
  ];

  for (const [码, 文案] of 冻结文案) {
    it(`${码} 固定显示冻结中文文案`, () => {
      expect(取Agent规则错误文案(new BFF错误(500, 码, 'ignored'))).toBe(文案);
    });
  }

  it('未知 BFF 错误回落 取后端错误文案', () => {
    const 未知 = new BFF错误(418, 'totally_unknown', '奇葩错误原文');
    expect(取Agent规则错误文案(未知)).toBe(取后端错误文案(未知));
    expect(取Agent规则错误文案(未知)).toBe('奇葩错误原文');
  });

  // P0 修复 Task 6：非 BFF 错误不是传输故障 —— 回落通用请求失败文案，不冒充网络。
  it('非 BFF 错误回落通用请求失败文案，不冒充网络也不泄露内部 message', () => {
    expect(取Agent规则错误文案(new Error('boom'))).toBe('请求失败，请稍后再试');
  });
});

/** 绕过工厂直接运行导出的完整角色水合（fence 取自 refs 当前值）。 */
function 直接运行水合(环境: 测试环境): () => Promise<PromiseSettledResult<unknown>[]> {
  return () => 水合Agent规则角色数据(
    {
      后端: 环境.deps.后端 as NonNullable<typeof 环境.deps.后端>,
      派发: 环境.deps.派发,
      设后端状态: 环境.deps.设后端状态,
      主体标识引用: 环境.deps.主体标识引用,
      会话代际: 环境.deps.会话代际,
    },
    'candidate',
    环境.deps.主体标识引用.current ?? 'sub_1',
    环境.deps.会话代际.current,
  );
}
