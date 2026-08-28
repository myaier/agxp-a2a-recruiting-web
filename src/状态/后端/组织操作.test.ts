// P1C Task 2：固定水合顺序 / subject+generation fence / 401 统一清理 / 错误分流 的行为测试。
// 受控 deferred promise 证明 stale 响应被丢弃，不用同步 mock 掩盖时序。

import { describe, expect, it, vi } from 'vitest';
import type { BFF企业档案, BFF企业档案替换, BFF招聘方档案 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import type { 页面岗位快照 } from '../../数据/招聘数据源类型';
import { BFF错误 } from '../../数据/HTTP客户端';
import { 从BFF企业档案, 转BFF企业档案替换 } from '../../数据/组织映射';
import {
  BFF主体样本,
  BFF企业关系样本,
  BFF企业媒体样本,
  BFF企业档案样本,
  BFF企业管理员申请样本,
  BFF公开企业样本,
  BFF招聘方档案样本,
} from '../../测试/BFF样本';
import { 初始状态 } from '../初始状态';
import { 归约, type 动作, type 状态 } from '../应用状态';
import type { 后端操作依赖 } from './类型';
import { 水合角色数据 } from './会话操作';
import { 创建空P4发现状态 } from './发现推荐操作';
import { 水合招聘方组织数据, 创建组织操作, type 企业媒体脱离错误 } from './组织操作';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const recruiter主体样本 = { ...BFF主体样本, last_used_role: 'recruiter' as const };
const 页面岗位快照样本: 页面岗位快照 = { 列表: [], 服务端: {} };

/** 本测试文件内的完整数据源桩：默认全成功，逐测试用覆盖项换成受控 promise / vi.fn。 */
function 创建完整测试数据源(覆盖: Partial<HTTP招聘数据源> = {}): HTTP招聘数据源 {
  const 基础 = {
    恢复会话: async () => ({ identity_id: 'id_1', session_id: 'sess_1', expires_at: '2026-08-25T00:00:00Z' }),
    读取主体: async () => BFF主体样本,
    确保角色: async () => BFF主体样本,
    记录当前角色: async () => BFF主体样本,
    读取简历: async () => ({ 列表: [], 服务端: {} }),
    读取意向: async () => ({ 列表: [], 服务端: {} }),
    读取岗位: async () => 页面岗位快照样本,
    清空目录缓存: () => {},
    读取招聘方档案: async () => BFF招聘方档案样本,
    保存招聘方档案: async () => BFF招聘方档案样本,
    读取我的企业关系: async () => [BFF企业关系样本],
    读取企业管理员申请: async () => [BFF企业管理员申请样本],
    创建企业管理员申请: async () => BFF企业管理员申请样本,
    取消企业管理员申请: async () => BFF企业管理员申请样本,
    接受企业邀请: async () => BFF企业关系样本,
    替换招聘方头像: async () => BFF招聘方档案样本,
    读取企业档案: async () => BFF企业档案样本,
    替换企业档案: async () => BFF企业档案样本,
    上传企业媒体: async () => BFF企业媒体样本,
    删除企业媒体: async () => undefined,
    读取公开企业: async () => BFF公开企业样本,
    // P6 Task 4 起 水合角色数据 会把 Agent 规则水合并进角色分支：这里给空集，
    // 让本文件的组织用例继续只钉组织/Jobs 的行为
    读取Agent规则: async () => [],
    读取Agent规则提案列表: async () => [],
  };
  return { ...基础, ...覆盖 } as unknown as HTTP招聘数据源;
}

/** 本测试文件内的依赖 helper：返回完整可变引用，不进入产品代码。 */
function 创建组织测试依赖(input: {
  后端: HTTP招聘数据源; 派发: (动作: 动作) => void; subject: string; generation: number;
}) {
  return {
    后端: input.后端, 派发: input.派发, 设后端状态: vi.fn(),
    主体标识引用: { current: input.subject }, 会话代际: { current: input.generation },
    读取恢复企业关系编号: vi.fn(() => null),
    状态引用: { current: 初始状态 },
    后端状态引用: { current: {
      初始化: '完成', 已登录: true, 主体: null, 简历快照: null, 意向快照: {}, 岗位快照: {},
      隐私快照: null,
      // P6：Task 3 起 后端状态 携带 Agent 规则原始快照与水合阶段（这里的用例不触达它们）
      候选规则快照: {}, 招聘规则快照: {}, 候选规则提案: {}, 招聘规则提案: {},
      Agent规则水合: {
        candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
      // P4：Task 3 起 后端状态 extends P4发现状态（这里的用例不触达它们）
      ...创建空P4发现状态(),
      // P2：附件库权威快照（只追加，不动 P6 字段）
      附件简历库: null,
    } },
    锁: { current: new Set<string>() }, 尝试引用: { current: null }, 是后端: true,
  } satisfies 后端操作依赖;
}

/** 断言用：取派发的动作型列表 */
function 动作型列表(派发: { mock: { calls: ReadonlyArray<[动作, ...unknown[]]> } }): string[] {
  return 派发.mock.calls.map(([动作]) => 动作.型);
}

// ── 组织操作方法的 A/B 切换与读错误测试用的双企业 fixture ──
const 关系B = { ...BFF企业关系样本, affiliation_id: 'aff_2', organization_id: 'org_2' };
const 媒体B = {
  ...BFF企业媒体样本,
  media_id: 'media_b1',
  url: 'https://cdn.example.com/org_2/media_b1.png',
};
const 档案B = {
  ...BFF企业档案样本,
  revision: 5,
  logo: 媒体B,
  office_media: [媒体B],
  company_media: [媒体B],
};
const 公开企业B = { ...BFF公开企业样本, organization_id: 'org_2', profile: 档案B };
const { profile: _A档案, ...身份A } = BFF公开企业样本;

/**
 * 组织操作方法测试的依赖：派发真实过 归约（方法内通过 状态引用 读最新 state）。
 * 先 hydrate A 为 current，再由各测试触发切换/写入。
 */
function 创建操作测试环境(input: {
  后端: HTTP招聘数据源;
  关系?: Array<typeof BFF企业关系样本>;
}) {
  const deps = 创建组织测试依赖({ 后端: input.后端, 派发: () => {}, subject: 'sub_1', generation: 1 });
  const 派发 = vi.fn((动作: 动作) => {
    deps.状态引用.current = 归约(deps.状态引用.current, 动作);
  });
  deps.派发 = 派发;
  deps.状态引用.current = ([
    { 型: '水合企业关系', 关系: input.关系 ?? [BFF企业关系样本, 关系B], 当前编号: BFF企业关系样本.affiliation_id },
    { 型: '水合当前企业', 身份: 身份A, 档案: BFF企业档案样本 },
  ] as 动作[]).reduce((状态: 状态, 动作) => 归约(状态, 动作), deps.状态引用.current);
  return { deps, 派发, 操作: 创建组织操作(deps) };
}

describe('水合招聘方组织数据', () => {
  it('按 profile → affiliations → public organization 水合并守住旧代际', async () => {
    const 顺序: string[] = [];
    const 档案门 = deferred<BFF招聘方档案>();
    const 后端 = {
      读取招聘方档案: vi.fn(() => { 顺序.push('profile'); return 档案门.promise; }),
      读取我的企业关系: vi.fn(async () => { 顺序.push('affiliations'); return [BFF企业关系样本]; }),
      读取公开企业: vi.fn(async () => { 顺序.push('organization'); return BFF公开企业样本; }),
    } as unknown as HTTP招聘数据源;
    const 派发 = vi.fn<(_: 动作) => void>();
    const deps = 创建组织测试依赖({ 后端, 派发, subject: 'sub_1', generation: 7 });
    const 运行 = 水合招聘方组织数据(deps, 'sub_1', 7, null, false);
    档案门.resolve(BFF招聘方档案样本);
    await expect(运行).resolves.toEqual({ sessionExpired: false });
    expect(顺序).toEqual(['profile', 'affiliations', 'organization']);
    expect(派发.mock.calls.map(([动作]) => 动作.型)).toEqual([
      '水合招聘方档案', '水合企业关系', '水合当前企业',
    ]);
  });

  it('recruiter 角色只在组织水合之后读取 owner Jobs', async () => {
    const 顺序: string[] = [];
    const 后端 = 创建完整测试数据源({
      读取招聘方档案: async () => { 顺序.push('profile'); return BFF招聘方档案样本; },
      读取我的企业关系: async () => { 顺序.push('affiliations'); return [BFF企业关系样本]; },
      读取公开企业: async () => { 顺序.push('organization'); return BFF公开企业样本; },
      读取岗位: async () => { 顺序.push('jobs'); return 页面岗位快照样本; },
    });
    const deps = 创建组织测试依赖({ 后端, 派发: () => {}, subject: 'sub_1', generation: 7 });
    await expect(水合角色数据(deps, recruiter主体样本, false, 7)).resolves.toBe(false);
    expect(顺序).toEqual(['profile', 'affiliations', 'organization', 'jobs']);
  });

  it('无 current 时不读公开企业，profile 快照独立水合', async () => {
    const 读取公开企业 = vi.fn(async () => BFF公开企业样本);
    const 后端 = 创建完整测试数据源({
      读取我的企业关系: async () => [],
      读取公开企业,
    });
    const 派发 = vi.fn<(_: 动作) => void>();
    const deps = 创建组织测试依赖({ 后端, 派发, subject: 'sub_1', generation: 1 });
    await expect(水合招聘方组织数据(deps, 'sub_1', 1, null, false)).resolves.toEqual({ sessionExpired: false });
    expect(读取公开企业).not.toHaveBeenCalled();
    expect(动作型列表(派发)).toEqual(['水合招聘方档案', '水合企业关系']);
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({
      型: '水合企业关系', 关系: [], 当前编号: null,
    }));
  });

  it('恢复编号必须仍指向 active+verified 关系，revoked 后清空且不自动切另一个', async () => {
    const 另一可用 = { ...BFF企业关系样本, affiliation_id: 'aff_2' };
    const 后端 = 创建完整测试数据源({
      读取我的企业关系: async () => [{ ...BFF企业关系样本, status: 'revoked' }, 另一可用],
    });
    const 派发 = vi.fn<(_: 动作) => void>();
    const deps = 创建组织测试依赖({ 后端, 派发, subject: 'sub_1', generation: 1 });
    await 水合招聘方组织数据(deps, 'sub_1', 1, BFF企业关系样本.affiliation_id, false);
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({
      型: '水合企业关系', 当前编号: null,
    }));
  });

  it('无恢复编号时恰好一个可用自动选，多个可用不按响应顺序猜', async () => {
    const 可用2 = { ...BFF企业关系样本, affiliation_id: 'aff_2', organization_id: 'org_2' };
    const 单一 = 创建完整测试数据源({ 读取我的企业关系: async () => [BFF企业关系样本] });
    const 派发1 = vi.fn<(_: 动作) => void>();
    await 水合招聘方组织数据(
      创建组织测试依赖({ 后端: 单一, 派发: 派发1, subject: 'sub_1', generation: 1 }),
      'sub_1', 1, null, false,
    );
    expect(派发1).toHaveBeenCalledWith(expect.objectContaining({
      型: '水合企业关系', 当前编号: BFF企业关系样本.affiliation_id,
    }));

    const 多个 = 创建完整测试数据源({ 读取我的企业关系: async () => [可用2, BFF企业关系样本] });
    const 派发2 = vi.fn<(_: 动作) => void>();
    await 水合招聘方组织数据(
      创建组织测试依赖({ 后端: 多个, 派发: 派发2, subject: 'sub_1', generation: 1 }),
      'sub_1', 1, null, false,
    );
    expect(派发2).toHaveBeenCalledWith(expect.objectContaining({
      型: '水合企业关系', 当前编号: null,
    }));
  });

  it('挂起（suspended）组织的恢复编号同样被丢弃', async () => {
    const 后端 = 创建完整测试数据源({
      读取我的企业关系: async () => [{ ...BFF企业关系样本, organization_status: 'suspended' }],
    });
    const 派发 = vi.fn<(_: 动作) => void>();
    const deps = 创建组织测试依赖({ 后端, 派发, subject: 'sub_1', generation: 1 });
    await 水合招聘方组织数据(deps, 'sub_1', 1, BFF企业关系样本.affiliation_id, false);
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({
      型: '水合企业关系', 当前编号: null,
    }));
  });

  it('过时 subject 的迟到响应不派发', async () => {
    const 档案门 = deferred<BFF招聘方档案>();
    const 后端 = {
      读取招聘方档案: vi.fn(() => 档案门.promise),
      读取我的企业关系: vi.fn(async () => [BFF企业关系样本]),
      读取公开企业: vi.fn(async () => BFF公开企业样本),
    } as unknown as HTTP招聘数据源;
    const 派发 = vi.fn<(_: 动作) => void>();
    const deps = 创建组织测试依赖({ 后端, 派发, subject: 'sub_1', generation: 7 });
    const 运行 = 水合招聘方组织数据(deps, 'sub_1', 7, null, false);
    // 首个组织请求已发出后才切到别的账号 —— 该响应属于旧 subject
    deps.主体标识引用.current = 'sub_2';
    档案门.resolve(BFF招聘方档案样本);
    await expect(运行).resolves.toEqual({ sessionExpired: false });
    expect(派发).not.toHaveBeenCalled();
    expect(后端.读取我的企业关系).not.toHaveBeenCalled();
  });

  it('过时代际的迟到响应不派发（中途清账号换代）', async () => {
    const 档案门 = deferred<BFF招聘方档案>();
    const 关系门 = deferred<[typeof BFF企业关系样本]>();
    const 后端 = {
      读取招聘方档案: vi.fn(() => 档案门.promise),
      读取我的企业关系: vi.fn(() => 关系门.promise),
      读取公开企业: vi.fn(async () => BFF公开企业样本),
    } as unknown as HTTP招聘数据源;
    const 派发 = vi.fn<(_: 动作) => void>();
    const deps = 创建组织测试依赖({ 后端, 派发, subject: 'sub_1', generation: 7 });
    const 运行 = 水合招聘方组织数据(deps, 'sub_1', 7, null, false);
    档案门.resolve(BFF招聘方档案样本);
    // 等 profile 已派发、affiliations 请求在飞时账号被清（代际递增）——旧会话响应全部丢弃
    await vi.waitFor(() => expect(动作型列表(派发)).toEqual(['水合招聘方档案']));
    expect(后端.读取我的企业关系).toHaveBeenCalled();
    deps.会话代际.current = 8;
    关系门.resolve([BFF企业关系样本]);
    await expect(运行).resolves.toEqual({ sessionExpired: false });
    expect(动作型列表(派发)).toEqual(['水合招聘方档案']);
    expect(后端.读取公开企业).not.toHaveBeenCalled();
  });

  it('组织水合 401 走统一清账号状态并返回会话失效', async () => {
    const 清空目录缓存 = vi.fn();
    const 后端 = 创建完整测试数据源({
      读取我的企业关系: async () => { throw new BFF错误(401, 'invalid_session', 'expired'); },
      清空目录缓存,
    });
    const 派发 = vi.fn<(_: 动作) => void>();
    const 设后端状态 = vi.fn();
    const deps = 创建组织测试依赖({ 后端, 派发, subject: 'sub_1', generation: 7 });
    deps.设后端状态 = 设后端状态;
    await expect(水合招聘方组织数据(deps, 'sub_1', 7, null, false))
      .resolves.toEqual({ sessionExpired: true });
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '水合后端简历' }));
    expect(派发).toHaveBeenCalledWith({ 型: '清后端组织状态' });
    expect(派发).toHaveBeenCalledWith({ 型: '清后端草稿' });
    expect(清空目录缓存).toHaveBeenCalled();
    expect(设后端状态).toHaveBeenCalledWith(expect.any(Function));
    expect(deps.主体标识引用.current).toBeNull();
    expect(deps.会话代际.current).toBe(8);
  });

  it('mount 初始化 非401 错误轻提示但不算会话失效', async () => {
    const 后端 = 创建完整测试数据源({
      读取我的企业关系: async () => { throw new BFF错误(503, 'downstream_unavailable', 'down'); },
    });
    const 派发 = vi.fn<(_: 动作) => void>();
    const deps = 创建组织测试依赖({ 后端, 派发, subject: 'sub_1', generation: 7 });
    await expect(水合招聘方组织数据(deps, 'sub_1', 7, null, false))
      .resolves.toEqual({ sessionExpired: false });
    expect(document.body.textContent).toContain('后端服务暂时不可用，请稍后重试');
    // 非 401 不清账号
    expect(派发).not.toHaveBeenCalledWith({ 型: '清后端组织状态' });
    expect(deps.主体标识引用.current).toBe('sub_1');
  });

  it('交互模式 非401 错误原样抛回 UI', async () => {
    const 后端 = 创建完整测试数据源({
      读取招聘方档案: async () => { throw new BFF错误(503, 'downstream_unavailable', 'down'); },
    });
    const deps = 创建组织测试依赖({ 后端, 派发: () => {}, subject: 'sub_1', generation: 7 });
    await expect(水合招聘方组织数据(deps, 'sub_1', 7, null, true))
      .rejects.toMatchObject({ code: 'downstream_unavailable' });
  });

  it('affiliations 失败不拿旧 Organization 发岗（不读公开企业、不派发 current）', async () => {
    const 读取公开企业 = vi.fn(async () => BFF公开企业样本);
    const 后端 = 创建完整测试数据源({
      读取我的企业关系: async () => { throw new BFF错误(503, 'downstream_unavailable', 'down'); },
      读取公开企业,
    });
    const 派发 = vi.fn<(_: 动作) => void>();
    const deps = 创建组织测试依赖({ 后端, 派发, subject: 'sub_1', generation: 1 });
    await expect(水合角色数据(deps, recruiter主体样本, false, 1)).resolves.toBe(false);
    expect(读取公开企业).not.toHaveBeenCalled();
    expect(动作型列表(派发)).not.toContain('水合当前企业');
    // 组织失败不清空 owner Jobs 水合（岗位盘仍要起来）
    expect(派发).toHaveBeenCalledWith({ 型: '水合后端岗位', 快照: 页面岗位快照样本 });
  });
});

describe('组织操作：选择企业关系 / 保存企业档案 / 公开企业读取', () => {
  it('A 切到 B 未返回前保存企业档案被拒；B 返回后用 org_b + B.revision + B 媒体 ID', async () => {
    const B门 = deferred<typeof 公开企业B>();
    const 替换企业档案 = vi.fn(async (_orgId: string, _body: BFF企业档案替换, _rev: number) => 档案B);
    const 后端 = 创建完整测试数据源({
      读取公开企业: vi.fn(() => B门.promise),
      替换企业档案,
    });
    const { deps, 操作 } = 创建操作测试环境({ 后端 });

    const 选择 = 操作.选择企业关系(关系B.affiliation_id);
    // B 的 public Organization 未返回：选择已清空 A snapshot，保存必须拒绝且不发请求
    await expect(操作.保存企业档案(从BFF企业档案(档案B))).rejects.toThrow('当前企业档案尚未水合');
    expect(替换企业档案).not.toHaveBeenCalled();

    B门.resolve(公开企业B);
    await 选择;
    const 草稿B = 从BFF企业档案(档案B);
    await 操作.保存企业档案(草稿B);
    expect(替换企业档案).toHaveBeenCalledTimes(1);
    expect(替换企业档案).toHaveBeenCalledWith('org_2', 转BFF企业档案替换(草稿B, 档案B), 5);
    const 请求体 = 替换企业档案.mock.calls[0][1];
    expect(请求体.logo_media_id).toBe('media_b1');
    expect(请求体.office_media_ids).toEqual(['media_b1']);
    expect(请求体.company_media_ids).toEqual(['media_b1']);
    // 写成功：快照换成 B 的新档案，同 ID public cache 一并覆盖
    expect(deps.状态引用.current.企业档案快照).toEqual(档案B);
    expect(deps.状态引用.current.公开企业表['org_2']?.profile).toEqual(档案B);
  });

  it('选择企业关系 读公开企业 401 走统一清账号状态', async () => {
    const 后端 = 创建完整测试数据源({
      读取公开企业: async () => { throw new BFF错误(401, 'invalid_session', 'expired'); },
    });
    const { deps, 派发, 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.选择企业关系(BFF企业关系样本.affiliation_id)).rejects.toMatchObject({ status: 401 });
    expect(派发).toHaveBeenCalledWith({ 型: '清后端组织状态' });
    expect(deps.主体标识引用.current).toBeNull();
    expect(deps.会话代际.current).toBe(2);
  });

  it('选择企业关系 遇 suspended：标记不可用并把 current 置空，错误原样抛出', async () => {
    const 后端 = 创建完整测试数据源({
      读取公开企业: async () => { throw new BFF错误(403, 'organization_suspended', 'gone'); },
    });
    const { deps, 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.选择企业关系(BFF企业关系样本.affiliation_id))
      .rejects.toMatchObject({ code: 'organization_suspended' });
    expect(deps.状态引用.current.不可用公开企业编号).toEqual([BFF企业关系样本.organization_id]);
    expect(deps.状态引用.current.当前企业关系编号).toBeNull();
    expect(deps.状态引用.current.公开企业表).toEqual({});
  });

  it('选择企业关系 对 revoked 关系直接拒绝且不发请求', async () => {
    const 读取公开企业 = vi.fn(async () => BFF公开企业样本);
    const 后端 = 创建完整测试数据源({ 读取公开企业 });
    const { 操作 } = 创建操作测试环境({
      后端,
      关系: [{ ...BFF企业关系样本, status: 'revoked' }],
    });
    await expect(操作.选择企业关系(BFF企业关系样本.affiliation_id)).rejects.toThrow('企业关系已不可用');
    expect(读取公开企业).not.toHaveBeenCalled();
  });

  it('快速二次选择时先前响应被当前 state 丢弃', async () => {
    const A门 = deferred<typeof BFF公开企业样本>();
    const 后端 = 创建完整测试数据源({
      读取公开企业: vi.fn((id: string) => (id === 'org_1' ? A门.promise : Promise.resolve(公开企业B))),
    });
    const { deps, 操作 } = 创建操作测试环境({ 后端 });
    const 第一次 = 操作.选择企业关系(BFF企业关系样本.affiliation_id);
    const 第二次 = 操作.选择企业关系(关系B.affiliation_id);
    await 第二次; // B 先就位
    A门.resolve(BFF公开企业样本); // A 的响应迟到
    await 第一次;
    expect(deps.状态引用.current.当前企业身份?.organization_id).toBe('org_2');
    expect(deps.状态引用.current.企业档案快照).toEqual(档案B);
  });

  it('读取公开企业 401 走统一清账号状态', async () => {
    const 后端 = 创建完整测试数据源({
      读取公开企业: async () => { throw new BFF错误(401, 'invalid_session', 'expired'); },
    });
    const { deps, 派发, 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.读取公开企业(BFF企业关系样本.organization_id)).rejects.toMatchObject({ status: 401 });
    expect(派发).toHaveBeenCalledWith({ 型: '清后端组织状态' });
    expect(deps.主体标识引用.current).toBeNull();
  });

  it('读取公开企业 not_found 命中 current 关系组织时把 current 置空并清缓存', async () => {
    const 后端 = 创建完整测试数据源({
      读取公开企业: async () => { throw new BFF错误(404, 'organization_not_found', 'gone'); },
    });
    const { deps, 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.读取公开企业(BFF企业关系样本.organization_id))
      .rejects.toMatchObject({ code: 'organization_not_found' });
    expect(deps.状态引用.current.不可用公开企业编号).toEqual([BFF企业关系样本.organization_id]);
    expect(deps.状态引用.current.当前企业关系编号).toBeNull();
    expect(deps.状态引用.current.公开企业表).toEqual({});
  });

  it('后续成功读取同一编号会经 缓存公开企业 移除不可用标记', async () => {
    let 调用数 = 0;
    const 后端 = 创建完整测试数据源({
      读取公开企业: async () => {
        调用数 += 1;
        if (调用数 === 1) throw new BFF错误(404, 'organization_not_found', 'gone');
        return BFF公开企业样本;
      },
    });
    const { deps, 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.读取公开企业(BFF企业关系样本.organization_id)).rejects.toMatchObject({ code: 'organization_not_found' });
    expect(deps.状态引用.current.不可用公开企业编号).toEqual([BFF企业关系样本.organization_id]);
    await 操作.读取公开企业(BFF企业关系样本.organization_id);
    expect(deps.状态引用.current.不可用公开企业编号).toEqual([]);
    expect(deps.状态引用.current.公开企业表[BFF企业关系样本.organization_id]).toEqual(BFF公开企业样本);
  });

  it('保存企业档案 409 后重读权威档案覆盖快照与 public cache，再抛回原始错误', async () => {
    let 调用数 = 0;
    const 后端 = 创建完整测试数据源({
      替换企业档案: vi.fn(async (_orgId: string, _body: BFF企业档案替换, _rev: number) => {
        调用数 += 1;
        if (调用数 === 1) throw new BFF错误(409, 'version_conflict', 'conflict');
        return 档案B;
      }),
      读取企业档案: vi.fn(async (_id: string) => 档案B),
    });
    const { deps, 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.保存企业档案(从BFF企业档案(BFF企业档案样本)))
      .rejects.toMatchObject({ status: 409 });
    expect(后端.读取企业档案).toHaveBeenCalledWith(BFF企业关系样本.organization_id);
    expect(deps.状态引用.current.企业档案快照).toEqual(档案B);
    expect(deps.状态引用.current.公开企业表[BFF企业关系样本.organization_id]?.profile).toEqual(档案B);
  });

  it('接受企业邀请 的 raw token 只进数据源，不进任何 reducer action', async () => {
    const 后端 = 创建完整测试数据源({
      接受企业邀请: vi.fn(async (_token: string) => BFF企业关系样本),
    });
    const { deps, 派发, 操作 } = 创建操作测试环境({ 后端 });
    await 操作.接受企业邀请('tok_secret_9');
    expect(后端.接受企业邀请).toHaveBeenCalledWith('tok_secret_9');
    const 序列化 = 派发.mock.calls.map((call) => JSON.stringify(call[0])).join('\n');
    expect(序列化).not.toContain('tok_secret_9');
    // 邀请接受后重读 affiliations 并按校验结果恢复 current + 公开企业
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({
      型: '水合企业关系', 当前编号: BFF企业关系样本.affiliation_id,
    }));
    expect(deps.状态引用.current.当前企业身份?.organization_id).toBe(BFF企业关系样本.organization_id);
  });
});

// ── 替换招聘方头像：一次原子替换 + 409/503 恢复语义（Task 4 Step 2）──

const 头像文件 = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], '头像.png', { type: 'image/png' });

/** 头像操作的环境：在组织操作环境之上再水合一份 招聘方档案。 */
function 创建头像测试环境(后端: HTTP招聘数据源) {
  const 环境 = 创建操作测试环境({ 后端 });
  环境.deps.状态引用.current = 归约(环境.deps.状态引用.current, {
    型: '水合招聘方档案', 档案: BFF招聘方档案样本,
  });
  return 环境;
}

describe('组织操作：替换招聘方头像', () => {
  it('用当前 revision 一次替换，响应用 水合招聘方档案 收口为权威档案', async () => {
    const 新档案 = { ...BFF招聘方档案样本, avatar_url: 'https://cdn.example.com/a.png', revision: 2 };
    const 替换头像 = vi.fn(async (_文件: File, _修订: number) => 新档案);
    const 后端 = 创建完整测试数据源({ 替换招聘方头像: 替换头像 });
    const { deps, 操作 } = 创建头像测试环境(后端);
    await 操作.替换招聘方头像(头像文件);
    expect(替换头像).toHaveBeenCalledWith(头像文件, BFF招聘方档案样本.revision);
    expect(deps.状态引用.current.招聘方档案).toEqual(新档案);
  });

  it('尚未水合时拒绝，不发请求', async () => {
    const 替换头像 = vi.fn(async () => BFF招聘方档案样本);
    const 后端 = 创建完整测试数据源({ 替换招聘方头像: 替换头像 });
    const { 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.替换招聘方头像(头像文件)).rejects.toThrow('招聘方档案尚未水合');
    expect(替换头像).not.toHaveBeenCalled();
  });

  it('409 重读权威档案但不确认成功，原始错误抛回页面', async () => {
    const 后端 = 创建完整测试数据源({
      替换招聘方头像: vi.fn(async () => { throw new BFF错误(409, 'version_conflict', 'conflict'); }),
      读取招聘方档案: vi.fn(async () => ({ ...BFF招聘方档案样本, revision: 5 })),
    });
    const { deps, 派发, 操作 } = 创建头像测试环境(后端);
    await expect(操作.替换招聘方头像(头像文件)).rejects.toMatchObject({ code: 'version_conflict' });
    expect(后端.读取招聘方档案).toHaveBeenCalledTimes(1);
    expect(deps.状态引用.current.招聘方档案?.revision).toBe(5);
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({
      型: '水合招聘方档案', 档案: expect.objectContaining({ revision: 5 }),
    }));
  });

  it('503 重读后 avatar_url 与 revision 都前进才视作 confirmed success', async () => {
    const 后端 = 创建完整测试数据源({
      替换招聘方头像: vi.fn(async () => { throw new BFF错误(503, 'operation_outcome_unknown', 'unknown'); }),
      读取招聘方档案: vi.fn(async () => ({
        ...BFF招聘方档案样本, avatar_url: 'https://cdn.example.com/a.png', revision: 2,
      })),
    });
    const { deps, 操作 } = 创建头像测试环境(后端);
    await expect(操作.替换招聘方头像(头像文件)).resolves.toBeUndefined();
    expect(deps.状态引用.current.招聘方档案?.avatar_url).toBe('https://cdn.example.com/a.png');
  });

  it('503 只推进 revision 或内容未变都不能确认，原始 503 抛回', async () => {
    const 只换修订 = 创建完整测试数据源({
      替换招聘方头像: vi.fn(async () => { throw new BFF错误(503, 'operation_outcome_unknown', 'unknown'); }),
      读取招聘方档案: vi.fn(async () => ({ ...BFF招聘方档案样本, revision: 2 })),
    });
    const 环境1 = 创建头像测试环境(只换修订);
    await expect(环境1.操作.替换招聘方头像(头像文件)).rejects.toMatchObject({
      code: 'operation_outcome_unknown',
    });

    const 全未变 = 创建完整测试数据源({
      替换招聘方头像: vi.fn(async () => { throw new BFF错误(503, 'operation_outcome_unknown', 'unknown'); }),
      读取招聘方档案: vi.fn(async () => BFF招聘方档案样本),
    });
    const 环境2 = 创建头像测试环境(全未变);
    await expect(环境2.操作.替换招聘方头像(头像文件)).rejects.toMatchObject({
      code: 'operation_outcome_unknown',
    });
  });

  it('重读失败抛原始 409/503，不用网络错误顶替、不自动重试', async () => {
    const 后端 = 创建完整测试数据源({
      替换招聘方头像: vi.fn(async () => { throw new BFF错误(503, 'operation_outcome_unknown', 'unknown'); }),
      读取招聘方档案: vi.fn(async () => { throw new BFF错误(503, 'downstream_unavailable', 'down'); }),
    });
    const { 操作 } = 创建头像测试环境(后端);
    await expect(操作.替换招聘方头像(头像文件)).rejects.toMatchObject({ code: 'operation_outcome_unknown' });
    expect(后端.替换招聘方头像).toHaveBeenCalledTimes(1);
  });

  it('401 走统一清账号状态', async () => {
    const 后端 = 创建完整测试数据源({
      替换招聘方头像: vi.fn(async () => { throw new BFF错误(401, 'invalid_session', 'expired'); }),
    });
    const { deps, 派发, 操作 } = 创建头像测试环境(后端);
    await expect(操作.替换招聘方头像(头像文件)).rejects.toMatchObject({ status: 401 });
    expect(派发).toHaveBeenCalledWith({ 型: '清后端组织状态' });
    expect(deps.主体标识引用.current).toBeNull();
    expect(deps.会话代际.current).toBe(2);
  });
});

// ── 企业档案 replacement 的恢复语义与 wire body 冻结（Task 4 Step 3）──

/** BFF企业档案替换 的 14 个键：完整 replacement 不多不少正好这些 */
const 企业档案替换键 = [
  'brand_name', 'industry_id', 'company_size', 'funding_stage', 'office_address',
  'benefit_codes', 'work_schedule', 'company_intro', 'business_items',
  'office_media_ids', 'company_media_ids', 'product_intro', 'team_members', 'logo_media_id',
] as const;

describe('组织操作：企业档案 replacement 与恢复', () => {
  it('完整 replacement 保留未编辑字段并只信 taxonomy id', () => {
    const body = 转BFF企业档案替换(
      {
        ...从BFF企业档案(BFF企业档案样本),
        行业: '人工智能',
        行业引用: { id: 'ind_ai', display_name: '人工智能' },
      },
      BFF企业档案样本,
    );
    expect(Object.keys(body).sort()).toEqual([...企业档案替换键].sort());
    expect(body.industry_id).toBe('ind_ai');
    expect(body.office_media_ids).toEqual(BFF企业档案样本.office_media.map((item) => item.media_id));
  });

  it('行业两空发空字符串，只有显示名拒绝保存', () => {
    const 无行业档案 = { ...BFF企业档案样本, industry: null };
    const body = 转BFF企业档案替换(从BFF企业档案(无行业档案), 无行业档案);
    expect(body.industry_id).toBe('');
    const 只有显示名 = { ...从BFF企业档案(BFF企业档案样本), 行业引用: undefined };
    expect(() => 转BFF企业档案替换(只有显示名, BFF企业档案样本)).toThrow('请从候选行业中选择');
  });

  it('企业档案 409 重读新 revision、覆盖 public cache 并把错误抛回页面', async () => {
    const 后端 = 创建完整测试数据源({
      替换企业档案: vi.fn(async () => { throw new BFF错误(409, 'version_conflict', 'conflict'); }),
      读取企业档案: vi.fn(async () => ({ ...BFF企业档案样本, revision: 9 })),
    });
    const { deps, 派发, 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.保存企业档案(从BFF企业档案(BFF企业档案样本)))
      .rejects.toMatchObject({ code: 'version_conflict' });
    expect(后端.读取企业档案).toHaveBeenCalledWith(BFF公开企业样本.organization_id);
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({
      型: '水合当前企业', 档案: expect.objectContaining({ revision: 9 }),
    }));
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '缓存公开企业' }));
    // 草稿在页面手里，operation 不碰；409 后不自动重发完整写入
    expect(后端.替换企业档案).toHaveBeenCalledTimes(1);
    expect(deps.状态引用.current.企业档案快照?.revision).toBe(9);
  });

  it('企业档案 401 统一清账号状态并原样抛回', async () => {
    const 后端 = 创建完整测试数据源({
      替换企业档案: vi.fn(async () => { throw new BFF错误(401, 'invalid_session', 'expired'); }),
    });
    const { deps, 派发, 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.保存企业档案(从BFF企业档案(BFF企业档案样本)))
      .rejects.toMatchObject({ status: 401 });
    expect(派发).toHaveBeenCalledWith({ 型: '清后端组织状态' });
    expect(deps.主体标识引用.current).toBeNull();
  });

  it('503 重读后完整 replacement 与 body 一致才视作 confirmed success', async () => {
    const 草稿 = { ...从BFF企业档案(BFF企业档案样本), 公司介绍: '新介绍' };
    const 服务端已落 = { ...BFF企业档案样本, company_intro: '新介绍', revision: 4 };
    const 后端 = 创建完整测试数据源({
      替换企业档案: vi.fn(async () => { throw new BFF错误(503, 'operation_outcome_unknown', 'unknown'); }),
      读取企业档案: vi.fn(async () => 服务端已落),
    });
    const { deps, 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.保存企业档案(草稿)).resolves.toBeUndefined();
    expect(deps.状态引用.current.企业档案快照).toEqual(服务端已落);
    expect(deps.状态引用.current.公开企业表[BFF公开企业样本.organization_id]?.profile).toEqual(服务端已落);
  });

  it('503 另一 admin 只推进 revision、内容与 body 不同：保留草稿（不确认）并抛原 503', async () => {
    const 草稿 = { ...从BFF企业档案(BFF企业档案样本), 公司介绍: '我的新介绍' };
    const 别人写的 = { ...BFF企业档案样本, company_intro: '别人写的新介绍', revision: 4 };
    const 后端 = 创建完整测试数据源({
      替换企业档案: vi.fn(async () => { throw new BFF错误(503, 'operation_outcome_unknown', 'unknown'); }),
      读取企业档案: vi.fn(async () => 别人写的),
    });
    const { 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.保存企业档案(草稿)).rejects.toMatchObject({ code: 'operation_outcome_unknown' });
    // 不自动重试完整写入
    expect(后端.替换企业档案).toHaveBeenCalledTimes(1);
  });

  it('重读失败抛原始 409/503，不用网络错误顶替', async () => {
    const 后端 = 创建完整测试数据源({
      替换企业档案: vi.fn(async () => { throw new BFF错误(409, 'version_conflict', 'conflict'); }),
      读取企业档案: vi.fn(async () => { throw new BFF错误(503, 'downstream_unavailable', 'down'); }),
    });
    const { 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.保存企业档案(从BFF企业档案(BFF企业档案样本)))
      .rejects.toMatchObject({ code: 'version_conflict' });
  });

  it('写成功后 current 已被清/切换：不再用 pre-await 身份拼 public cache', async () => {
    const 门 = deferred<BFF企业档案>();
    const 新档案 = { ...BFF企业档案样本, company_intro: '已落库', revision: 4 };
    const 后端 = 创建完整测试数据源({ 替换企业档案: vi.fn(() => 门.promise) });
    const { deps, 派发, 操作 } = 创建操作测试环境({ 后端 });
    const 保存 = 操作.保存企业档案({ ...从BFF企业档案(BFF企业档案样本), 公司介绍: '已落库' });
    // 写在飞时 401 清账号（或用户切走）：current 身份已被清空
    派发({ 型: '清后端组织状态' });
    门.resolve(新档案);
    await expect(保存).resolves.toBeUndefined();
    // 清空之后不能再出现任何基于旧 state 的 水合当前企业 / "undefined" key 的 缓存公开企业
    const 清后序号 = 派发.mock.calls.findIndex(([动作]) => 动作.型 === '清后端组织状态');
    const 清后动作 = 派发.mock.calls.slice(清后序号 + 1).map(([动作]) => 动作.型);
    expect(清后动作).toEqual([]);
    expect(deps.状态引用.current.公开企业表).toEqual({});
  });
});

// ── 两步媒体协议：upload receipt → PATCH full profile → 响应替换快照（Task 4 Step 5）──

describe('组织操作：企业媒体两步发布', () => {
  it('先上传 receipt，再以最新 revision 发布引用', async () => {
    const calls: string[] = [];
    const 后端 = 创建完整测试数据源({
      上传企业媒体: vi.fn(async () => { calls.push('upload'); return 媒体B; }),
      替换企业档案: vi.fn(async (_id, body, revision) => {
        calls.push(`patch:${revision}`);
        expect(body.office_media_ids).toContain(媒体B.media_id);
        return { ...BFF企业档案样本, office_media: [BFF企业媒体样本, 媒体B], revision: revision + 1 };
      }),
    });
    const { deps, 操作 } = 创建操作测试环境({ 后端 });
    await 操作.上传并发布企业媒体('office_photo', 头像文件);
    expect(calls).toEqual(['upload', `patch:${BFF企业档案样本.revision}`]);
    // PATCH 响应（不是 upload receipt）替换权威 snapshot
    expect(deps.状态引用.current.企业档案快照).toEqual({
      ...BFF企业档案样本, office_media: [BFF企业媒体样本, 媒体B], revision: 4,
    });
  });

  it.each([
    ['organization_logo 替换 logo_media_id，不碰相册', 'organization_logo' as const,
      (body: BFF企业档案替换) => body.logo_media_id],
    ['office_photo 追加进 office_media_ids，保留既有媒体', 'office_photo' as const,
      (body: BFF企业档案替换) => body.office_media_ids],
    ['company_photo 追加进 company_media_ids', 'company_photo' as const,
      (body: BFF企业档案替换) => body.company_media_ids],
  ])('%s', async (_名, purpose, 取值) => {
    let 捕获Body: BFF企业档案替换 | null = null;
    const 后端 = 创建完整测试数据源({
      上传企业媒体: vi.fn(async () => 媒体B),
      替换企业档案: vi.fn(async (_id, body) => { 捕获Body = body; return BFF企业档案样本; }),
    });
    const { 操作 } = 创建操作测试环境({ 后端 });
    await 操作.上传并发布企业媒体(purpose, 头像文件);
    const body = 捕获Body!;
    if (purpose === 'organization_logo') expect(取值(body)).toBe(媒体B.media_id);
    else if (purpose === 'office_photo') {
      // 样本 office_media 已有 media_1：追加而不替换
      expect(取值(body)).toEqual([BFF企业媒体样本.media_id, 媒体B.media_id]);
    } else {
      // 样本 company_media 为空
      expect(取值(body)).toEqual([媒体B.media_id]);
    }
  });

  it('upload 失败不 PATCH、不 DELETE，错误原样抛回', async () => {
    const 后端 = 创建完整测试数据源({
      上传企业媒体: vi.fn(async () => { throw new BFF错误(503, 'media_rejected', '拒绝'); }),
      替换企业档案: vi.fn(),
      删除企业媒体: vi.fn(),
    });
    const { 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.上传并发布企业媒体('office_photo', 头像文件))
      .rejects.toMatchObject({ code: 'media_rejected' });
    expect(后端.替换企业档案).not.toHaveBeenCalled();
    expect(后端.删除企业媒体).not.toHaveBeenCalled();
  });

  it('upload 401 统一清账号状态', async () => {
    const 后端 = 创建完整测试数据源({
      上传企业媒体: vi.fn(async () => { throw new BFF错误(401, 'invalid_session', 'expired'); }),
    });
    const { deps, 派发, 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.上传并发布企业媒体('office_photo', 头像文件))
      .rejects.toMatchObject({ status: 401 });
    expect(派发).toHaveBeenCalledWith({ 型: '清后端组织状态' });
    expect(deps.主体标识引用.current).toBeNull();
  });

  it('PATCH 失败保留 detached receipt：错误携带 脱离媒体，不擅自 DELETE', async () => {
    const 后端 = 创建完整测试数据源({
      上传企业媒体: vi.fn(async () => 媒体B),
      替换企业档案: vi.fn(async () => { throw new BFF错误(500, 'internal', '炸了'); }),
      删除企业媒体: vi.fn(),
    });
    const { 操作 } = 创建操作测试环境({ 后端 });
    const 捕获 = await 操作.上传并发布企业媒体('company_photo', 头像文件)
      .then(() => null, (错误: unknown) => 错误) as 企业媒体脱离错误;
    expect(捕获).toBeInstanceOf(BFF错误);
    expect(捕获.脱离媒体).toEqual({ purpose: 'company_photo', media_id: 媒体B.media_id });
    // 收据留给用户决定放弃（页面 best-effort DELETE）或重试；operation 不代删
    expect(后端.删除企业媒体).not.toHaveBeenCalled();
  });

  it('PATCH 409 重读权威档案后仍抛原错误，receipt 照挂', async () => {
    const 后端 = 创建完整测试数据源({
      上传企业媒体: vi.fn(async () => 媒体B),
      替换企业档案: vi.fn(async () => { throw new BFF错误(409, 'version_conflict', 'conflict'); }),
      读取企业档案: vi.fn(async () => ({ ...BFF企业档案样本, revision: 9 })),
    });
    const { 派发, 操作 } = 创建操作测试环境({ 后端 });
    const 捕获 = await 操作.上传并发布企业媒体('office_photo', 头像文件)
      .then(() => null, (错误: unknown) => 错误) as 企业媒体脱离错误;
    expect(捕获).toMatchObject({ code: 'version_conflict' });
    expect(捕获.脱离媒体).toEqual({ purpose: 'office_photo', media_id: 媒体B.media_id });
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({
      型: '水合当前企业', 档案: expect.objectContaining({ revision: 9 }),
    }));
    expect(后端.读取企业档案).toHaveBeenCalledWith(BFF公开企业样本.organization_id);
  });

  it('PATCH 503 重读后完整 replacement 已含新媒体才视作 confirmed success', async () => {
    const 已发布 = { ...BFF企业档案样本, office_media: [BFF企业媒体样本, 媒体B], revision: 4 };
    const 后端 = 创建完整测试数据源({
      上传企业媒体: vi.fn(async () => 媒体B),
      替换企业档案: vi.fn(async () => { throw new BFF错误(503, 'operation_outcome_unknown', 'unknown'); }),
      读取企业档案: vi.fn(async () => 已发布),
      删除企业媒体: vi.fn(async () => undefined),
    });
    const { deps, 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.上传并发布企业媒体('office_photo', 头像文件)).resolves.toBeUndefined();
    expect(deps.状态引用.current.企业档案快照).toEqual(已发布);
    expect(后端.删除企业媒体).not.toHaveBeenCalled();
  });

  it('organization_admin_required：重读 affiliations 切只读并抛原错误', async () => {
    const 降级关系 = { ...BFF企业关系样本, role: 'member' as const };
    const 后端 = 创建完整测试数据源({
      上传企业媒体: vi.fn(async () => 媒体B),
      替换企业档案: vi.fn(async () => { throw new BFF错误(403, 'organization_admin_required', '需要管理员'); }),
      读取我的企业关系: vi.fn(async () => [降级关系]),
    });
    const { 派发, 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.上传并发布企业媒体('office_photo', 头像文件))
      .rejects.toMatchObject({ code: 'organization_admin_required' });
    expect(后端.读取我的企业关系).toHaveBeenCalledTimes(1);
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({
      型: '水合企业关系', 关系: [降级关系], 当前编号: BFF企业关系样本.affiliation_id,
    }));
  });

  it('organization_suspended：标记不可用并清 current selection', async () => {
    const 后端 = 创建完整测试数据源({
      上传企业媒体: vi.fn(async () => 媒体B),
      替换企业档案: vi.fn(async () => { throw new BFF错误(403, 'organization_suspended', '停用'); }),
    });
    const { 派发, 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.上传并发布企业媒体('office_photo', 头像文件))
      .rejects.toMatchObject({ code: 'organization_suspended' });
    expect(派发).toHaveBeenCalledWith({ 型: '标记公开企业不可用', 编号: BFF公开企业样本.organization_id });
    expect(派发).toHaveBeenCalledWith({ 型: '选择当前企业关系', 编号: null });
  });
});

describe('组织操作：企业媒体移除', () => {
  it('明确移除先 PATCH 去引用再 DELETE，body 不再含该 media id', async () => {
    const calls: string[] = [];
    const 后端 = 创建完整测试数据源({
      替换企业档案: vi.fn(async (_id, body, revision) => {
        calls.push(`patch:${revision}`);
        expect(body.office_media_ids).not.toContain(BFF企业媒体样本.media_id);
        return { ...BFF企业档案样本, office_media: [], revision: revision + 1 };
      }),
      删除企业媒体: vi.fn(async () => { calls.push('delete'); }),
    });
    const { deps, 操作 } = 创建操作测试环境({ 后端 });
    await 操作.移除企业媒体('office_photo', BFF企业媒体样本.media_id);
    expect(calls).toEqual(['patch:3', 'delete']);
    expect(后端.删除企业媒体)
      .toHaveBeenCalledWith(BFF公开企业样本.organization_id, BFF企业媒体样本.media_id);
    expect(deps.状态引用.current.企业档案快照).toEqual({
      ...BFF企业档案样本, office_media: [], revision: 4,
    });
  });

  it('快照里已不被引用的媒体（放弃收据）直接 DELETE，不发多余 PATCH', async () => {
    const 后端 = 创建完整测试数据源({
      替换企业档案: vi.fn(),
      删除企业媒体: vi.fn(async () => undefined),
    });
    const { 操作 } = 创建操作测试环境({ 后端 });
    await 操作.移除企业媒体('office_photo', 媒体B.media_id);
    expect(后端.替换企业档案).not.toHaveBeenCalled();
    expect(后端.删除企业媒体).toHaveBeenCalledWith(BFF公开企业样本.organization_id, 媒体B.media_id);
  });

  it('media_in_use：重读权威档案、不伪造删除，原错误抛回', async () => {
    const 后端 = 创建完整测试数据源({
      替换企业档案: vi.fn(async () => ({ ...BFF企业档案样本, office_media: [], revision: 4 })),
      删除企业媒体: vi.fn(async () => { throw new BFF错误(409, 'media_in_use', '还在用'); }),
      读取企业档案: vi.fn(async () => ({ ...BFF企业档案样本, revision: 9 })),
    });
    const { deps, 派发, 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.移除企业媒体('office_photo', BFF企业媒体样本.media_id))
      .rejects.toMatchObject({ code: 'media_in_use' });
    expect(后端.读取企业档案).toHaveBeenCalledWith(BFF公开企业样本.organization_id);
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({
      型: '水合当前企业', 档案: expect.objectContaining({ revision: 9 }),
    }));
    expect(deps.状态引用.current.企业档案快照?.revision).toBe(9);
  });

  it('移除 401 统一清账号状态', async () => {
    const 后端 = 创建完整测试数据源({
      删除企业媒体: vi.fn(async () => { throw new BFF错误(401, 'invalid_session', 'expired'); }),
    });
    const { deps, 派发, 操作 } = 创建操作测试环境({ 后端 });
    await expect(操作.移除企业媒体('office_photo', 媒体B.media_id))
      .rejects.toMatchObject({ status: 401 });
    expect(派发).toHaveBeenCalledWith({ 型: '清后端组织状态' });
    expect(deps.主体标识引用.current).toBeNull();
  });
});
