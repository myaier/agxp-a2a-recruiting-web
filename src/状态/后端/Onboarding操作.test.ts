// Onboarding 域操作测试（stg 契约对齐 2026-09-14，Spec §4/§5）：
// 运行态判别 union（未读取/加载中/成功/失败）、会话栅栏 + 本域请求序号、
// GET 失败绝不合成「未完成」、旧 GET 不覆盖较新 complete、422 冻结 path 提示、
// 以及 判定Onboarding分流 的 Spec §5 分流表。Mock 模式零请求。

import { describe, expect, it, vi } from 'vitest';
import { BFF错误 } from '../../数据/HTTP客户端';
import type { BFFOnboarding状态, BFF主体 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { 初始状态 } from '../初始状态';
import { 归约 } from '../应用状态';
import { BFF主体样本 } from '../../测试/BFF样本';
import type { 后端操作依赖, 后端状态, Onboarding运行态 } from './类型';
import { 创建空Onboarding状态 } from './Onboarding操作';
import { 创建空P4发现状态 } from './发现推荐操作';
import { 创建空P5MatchCase状态 } from './MatchCase操作';
import { 创建空P7会话状态 } from './真人会话操作';
import { 创建空P8控制面状态 } from './P8控制面操作';
import { 创建空接触记录状态 } from './接触记录操作';
import {
  判定Onboarding分流,
  清Onboarding引用,
  水合Onboarding,
  完成Onboarding角色,
  查证Onboarding角色,
  创建Onboarding操作,
  Onboarding422提示,
} from './Onboarding操作';

const 完成时间 = '2026-09-14T08:00:00Z';

function 角色行(role: 'candidate' | 'recruiter', completed_at: string | null, status: 'active' | 'suspended' = 'active') {
  return { role, status, completed_at };
}

function Onboarding状态(roles: ReturnType<typeof 角色行>[]): BFFOnboarding状态 {
  return { roles };
}

/** 本文件内的 后端状态 底座：Onboarding 字段显式播种（required）。 */
function 创建测试后端状态(覆盖: Partial<后端状态> = {}): 后端状态 {
  return {
    初始化: '完成', 已登录: true, 主体: null, 简历快照: null, 意向快照: {}, 岗位快照: {},
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

/** 依赖 helper：派发重放 归约；设后端状态 折叠到 ref，断言读最终 后端状态。 */
function 创建Onboarding测试依赖(后端: HTTP招聘数据源) {
  const 状态引用 = { current: 初始状态 };
  const 派发 = vi.fn((动作: Parameters<typeof 归约>[1]) => {
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
    手机登录代际: { current: 0 },
    主体标识引用: { current: null as string | null },
    会话代际: { current: 0 },
    读取恢复企业关系编号: vi.fn(() => null),
    Onboarding请求序号: { current: 0 },
  };
  return { deps };
}

function 最终Onboarding(deps: ReturnType<typeof 创建Onboarding测试依赖>['deps']): Onboarding运行态 {
  let 最新: 后端状态 = deps.后端状态引用.current;
  for (const 调用 of deps.设后端状态.mock.calls) {
    最新 = (调用[0] as (旧: 后端状态) => 后端状态)(最新);
  }
  return 最新.Onboarding;
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

function 数据源(覆盖: Record<string, unknown> = {}): HTTP招聘数据源 {
  return {
    清空目录缓存: vi.fn(),
    读取Onboarding: vi.fn(async () => Onboarding状态([角色行('candidate', null)])),
    完成Onboarding: vi.fn(async () => 角色行('candidate', 完成时间)),
    ...覆盖,
  } as unknown as HTTP招聘数据源;
}

// ── brief 第一项：状态反例（全部场景）──────────────────────────────

describe('水合Onboarding：GET 语义与栅栏', () => {
  it('首次空 roles：GET 成功原样落 成功，不合成完成猜测', async () => {
    const 后端 = 数据源({ 读取Onboarding: vi.fn(async () => Onboarding状态([])) });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    const 会话失效 = await 水合Onboarding(deps, 'sub_1', 0);
    expect(会话失效).toBe(false);
    expect(最终Onboarding(deps)).toEqual({ 阶段: '成功', 数据: { roles: [] } });
  });

  it('GET 503 落 失败 而不是未完成：失败绝不合成 completed=null 猜测', async () => {
    const 后端 = 数据源({ 读取Onboarding: vi.fn(async () => {
      throw new BFF错误(503, 'recruitment_service_unavailable', '不可用');
    }) });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    await 水合Onboarding(deps, 'sub_1', 0);
    const 状态 = 最终Onboarding(deps);
    expect(状态.阶段).toBe('失败');
    if (状态.阶段 === '失败') expect(状态.错误.status).toBe(503);
    // 分流不允许把失败当未完成
    expect(判定Onboarding分流({ ...BFF主体样本, subject_id: 'sub_1' }, 状态).型).toBe('读取失败');
  });

  it('GET 404（部署不匹配）同样落 失败，不当未完成', async () => {
    const 后端 = 数据源({ 读取Onboarding: vi.fn(async () => {
      throw new BFF错误(404, 'not_found', '未部署');
    }) });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    await 水合Onboarding(deps, 'sub_1', 0);
    expect(最终Onboarding(deps).阶段).toBe('失败');
  });

  it('坏响应（invalid_response）落 失败，不回退默认值', async () => {
    const 后端 = 数据源({ 读取Onboarding: vi.fn(async () => {
      throw new BFF错误(200, 'invalid_response', 'Onboarding 响应不符合冻结契约');
    }) });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    await 水合Onboarding(deps, 'sub_1', 0);
    expect(最终Onboarding(deps).阶段).toBe('失败');
  });

  it('换账号后迟到的 200 不写进新 scope', async () => {
    const 迟到 = deferred<BFFOnboarding状态>();
    const 后端 = 数据源({ 读取Onboarding: vi.fn(() => 迟到.promise) });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_a';
    const 读取 = 水合Onboarding(deps, 'sub_a', 0);
    // 读取在飞时换账号（主体 + 会话代际都换）
    deps.主体标识引用.current = 'sub_b';
    deps.会话代际.current += 1;
    迟到.resolve(Onboarding状态([角色行('candidate', 完成时间)]));
    await 读取;
    expect(最终Onboarding(deps).阶段).toBe('加载中'); // 旧 scope 结果整包丢弃，不写新 scope
  });

  it('换账号后迟到的 401 不清新会话', async () => {
    const 迟到 = deferred<BFFOnboarding状态>();
    const 后端 = 数据源({ 读取Onboarding: vi.fn(() => 迟到.promise) });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_a';
    const 读取 = 水合Onboarding(deps, 'sub_a', 0);
    deps.主体标识引用.current = 'sub_b';
    deps.会话代际.current += 1;
    迟到.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await 读取;
    expect(deps.主体标识引用.current).toBe('sub_b');
    expect(deps.派发).not.toHaveBeenCalledWith({ 型: '水合后端简历', 快照: expect.anything() });
    expect(最终Onboarding(deps).阶段).toBe('加载中');
  });

  it('当前栅栏的 401 清账号并返回 会话失效=true', async () => {
    const 后端 = 数据源({ 读取Onboarding: vi.fn(async () => {
      throw new BFF错误(401, 'invalid_session', 'expired');
    }) });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    const 会话失效 = await 水合Onboarding(deps, 'sub_1', 0);
    expect(会话失效).toBe(true);
    expect(deps.主体标识引用.current).toBeNull();
    expect(deps.会话代际.current).toBe(1);
    expect(最终Onboarding(deps).阶段).toBe('未读取');
  });

  it('同 scope 旧 GET 不能把已完成覆盖为 null（请求序号）', async () => {
    const 旧GET = deferred<BFFOnboarding状态>();
    let 序 = 0;
    const 后端 = 数据源({
      读取Onboarding: vi.fn(() => {
        序 += 1;
        return 序 === 1 ? 旧GET.promise : Promise.resolve(Onboarding状态([角色行('candidate', null)]));
      }),
    });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    const 在飞 = 水合Onboarding(deps, 'sub_1', 0);
    // 旧 GET 还在飞时 complete 先落地（已完成写入 + 序号推进）
    await 完成Onboarding角色(deps, 'candidate');
    expect(最终Onboarding(deps)).toEqual({
      阶段: '成功',
      数据: { roles: [角色行('candidate', 完成时间)] },
    });
    旧GET.resolve(Onboarding状态([角色行('candidate', null)]));
    await 在飞;
    // 旧 GET 的 null 结果被序号作废：已完成事实不被覆盖
    expect(最终Onboarding(deps)).toEqual({
      阶段: '成功',
      数据: { roles: [角色行('candidate', 完成时间)] },
    });
  });
});

describe('完成Onboarding角色：POST 与登记', () => {
  it('成功后把角色对象登记进 成功 状态（body 恒 {}，不携带前端草稿字段）', async () => {
    const 后端 = 数据源({
      完成Onboarding: vi.fn(async () => 角色行('recruiter', 完成时间)),
    });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    const 结果 = await 完成Onboarding角色(deps, 'recruiter');
    expect(结果.completed_at).toBe(完成时间);
    expect(vi.mocked(后端.完成Onboarding)).toHaveBeenCalledWith('recruiter');
    expect(最终Onboarding(deps)).toEqual({
      阶段: '成功',
      数据: { roles: [角色行('recruiter', 完成时间)] },
    });
  });

  it('已有 GET 成功快照时 complete 合并同角色条目并保持 candidate→recruiter 顺序', async () => {
    const 后端 = 数据源({
      读取Onboarding: vi.fn(async () => Onboarding状态([角色行('candidate', 完成时间)])),
      完成Onboarding: vi.fn(async () => 角色行('recruiter', 完成时间)),
    });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    await 水合Onboarding(deps, 'sub_1', 0);
    await 完成Onboarding角色(deps, 'recruiter');
    expect(最终Onboarding(deps)).toEqual({
      阶段: '成功',
      数据: { roles: [角色行('candidate', 完成时间), 角色行('recruiter', 完成时间)] },
    });
  });

  it('当前栅栏的 401 清账号并原样抛出', async () => {
    const 后端 = 数据源({
      完成Onboarding: vi.fn(async () => {
        throw new BFF错误(401, 'invalid_session', 'expired');
      }),
    });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    await expect(完成Onboarding角色(deps, 'candidate')).rejects.toMatchObject({ status: 401 });
    expect(deps.主体标识引用.current).toBeNull();
  });

  it('栅栏破防（换会话）后的迟到成功不写新 scope，并以会话已变化拒绝', async () => {
    const 迟到 = deferred<ReturnType<typeof 角色行>>();
    const 后端 = 数据源({ 完成Onboarding: vi.fn(() => 迟到.promise) });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_a';
    const 调用 = 完成Onboarding角色(deps, 'candidate');
    deps.主体标识引用.current = 'sub_b';
    deps.会话代际.current += 1;
    迟到.resolve(角色行('candidate', 完成时间));
    await expect(调用).rejects.toMatchObject({
      status: 0, code: 'invalid_request', message: '会话已变化，本次完成未生效',
    });
    expect(最终Onboarding(deps).阶段).toBe('未读取');
  });

  // ── codex review-r1 F1：迟到的旧会话完成回执不得污染新会话 ──
  // 旧缺陷：登记Onboarding完成 无条件先推进共享请求序号再查栅栏，迟到的旧 POST 会
  // 把新会话在飞 GET 捕获的序号快照作废；且完成调用仍以成功返回，调用方继续收口。
  it('换账号后迟到的完成回执：complete 拒绝、序号不被污染，新会话在飞 GET 照常落地', async () => {
    const 迟到POST = deferred<ReturnType<typeof 角色行>>();
    const 新GET = deferred<BFFOnboarding状态>();
    const 后端 = 数据源({
      完成Onboarding: vi.fn(() => 迟到POST.promise),
      读取Onboarding: vi.fn(() => 新GET.promise),
    });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_a';
    const 调用 = 完成Onboarding角色(deps, 'candidate');
    // A 的 POST 在飞时换到账号 B，并已开始 B 的 GET（序号快照已被该 GET 捕获）
    deps.主体标识引用.current = 'sub_b';
    deps.会话代际.current += 1;
    const 新会话读取 = 水合Onboarding(deps, 'sub_b', 1);
    迟到POST.resolve(角色行('candidate', 完成时间));
    await expect(调用).rejects.toMatchObject({
      status: 0, code: 'invalid_request', message: '会话已变化，本次完成未生效',
    });
    新GET.resolve(Onboarding状态([角色行('candidate', null)]));
    await 新会话读取;
    // 旧会话回执不推进序号：B 的 GET 结果照常落地，状态里没有 A 的完成回执
    expect(最终Onboarding(deps)).toEqual({
      阶段: '成功',
      数据: { roles: [角色行('candidate', null)] },
    });
  });

  it('同主体换会话代际（切身份/重登）后的迟到完成回执：同样拒绝且序号不被污染', async () => {
    const 迟到POST = deferred<ReturnType<typeof 角色行>>();
    const 新GET = deferred<BFFOnboarding状态>();
    const 后端 = 数据源({
      完成Onboarding: vi.fn(() => 迟到POST.promise),
      读取Onboarding: vi.fn(() => 新GET.promise),
    });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    const 调用 = 完成Onboarding角色(deps, 'candidate');
    deps.会话代际.current += 1; // 主体未变，会话代际翻新
    const 新会话读取 = 水合Onboarding(deps, 'sub_1', 1);
    迟到POST.resolve(角色行('candidate', 完成时间));
    await expect(调用).rejects.toMatchObject({ message: '会话已变化，本次完成未生效' });
    新GET.resolve(Onboarding状态([角色行('candidate', null)]));
    await 新会话读取;
    expect(最终Onboarding(deps)).toEqual({
      阶段: '成功',
      数据: { roles: [角色行('candidate', null)] },
    });
  });
});

describe('查证Onboarding角色：POST 结果未知的 GET 查证', () => {
  it('GET 明确已完成 → 已完成（并把事实落进状态）', async () => {
    const 后端 = 数据源({
      读取Onboarding: vi.fn(async () => Onboarding状态([角色行('candidate', 完成时间)])),
    });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    await expect(查证Onboarding角色(deps, 'sub_1', 0, 'candidate')).resolves.toBe('已完成');
    expect(最终Onboarding(deps)).toEqual({
      阶段: '成功',
      数据: { roles: [角色行('candidate', 完成时间)] },
    });
  });

  it('GET 仍未完成 → 未完成（可安全重试完成操作）', async () => {
    const 后端 = 数据源();
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    await expect(查证Onboarding角色(deps, 'sub_1', 0, 'candidate')).resolves.toBe('未完成');
  });

  it('GET 失败 → 读取失败（留错误，不猜）', async () => {
    const 后端 = 数据源({
      读取Onboarding: vi.fn(async () => {
        throw new BFF错误(503, 'recruitment_service_unavailable', '不可用');
      }),
    });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    await expect(查证Onboarding角色(deps, 'sub_1', 0, 'candidate')).resolves.toBe('读取失败');
  });
});

describe('判定Onboarding分流：Spec §5 分流表', () => {
  const 主体 = (last_used_role: 'candidate' | 'recruiter' | null, roles: { role: 'candidate' | 'recruiter'; status: 'active' | 'suspended' }[] = [{ role: 'candidate', status: 'active' }]): BFF主体 =>
    ({ ...BFF主体样本, last_used_role, roles });

  it('主体缺失或 last_used_role=null → 选择身份', () => {
    expect(判定Onboarding分流(null, 创建空Onboarding状态()).型).toBe('选择身份');
    expect(判定Onboarding分流(主体(null), { 阶段: '成功', 数据: Onboarding状态([角色行('candidate', 完成时间)]) }).型).toBe('选择身份');
  });

  it('已有角色、偏好 null 选择后 completed → 已完成（进主壳）；未完成 → 未完成（进引导）', () => {
    const 已完成 = 判定Onboarding分流(主体('candidate'), { 阶段: '成功', 数据: Onboarding状态([角色行('candidate', 完成时间)]) });
    expect(已完成).toEqual({ 型: '已完成', 角色: 'candidate' });
    const 未完成 = 判定Onboarding分流(主体('candidate'), { 阶段: '成功', 数据: Onboarding状态([角色行('candidate', null)]) });
    expect(未完成).toEqual({ 型: '未完成', 角色: 'candidate' });
  });

  it('查询未完成（未读取/加载中）→ 查询中：不猜完成也不猜未完成', () => {
    expect(判定Onboarding分流(主体('candidate'), 创建空Onboarding状态()).型).toBe('查询中');
    expect(判定Onboarding分流(主体('candidate'), { 阶段: '加载中' }).型).toBe('查询中');
  });

  it('读取失败 → 读取失败', () => {
    const 状态: Onboarding运行态 = { 阶段: '失败', 错误: new BFF错误(503, 'recruitment_service_unavailable', 'x') };
    expect(判定Onboarding分流(主体('candidate'), 状态).型).toBe('读取失败');
  });

  it('角色停用（GET suspended / 主体 suspended）→ 角色不可用，不自动激活', () => {
    expect(判定Onboarding分流(主体('candidate'), { 阶段: '成功', 数据: Onboarding状态([角色行('candidate', null, 'suspended')]) }).型).toBe('角色不可用');
    expect(判定Onboarding分流(主体('candidate', [{ role: 'candidate', status: 'suspended' }]), { 阶段: '成功', 数据: Onboarding状态([角色行('candidate', null)]) }).型).toBe('角色不可用');
  });

  it('GET 列表缺所选角色（矛盾/旧空 roles）→ 角色不可用：显示重试，不自动 ensure', () => {
    const 双角色主体 = 主体('recruiter', [
      { role: 'candidate', status: 'active' },
      { role: 'recruiter', status: 'active' },
    ]);
    expect(判定Onboarding分流(双角色主体, { 阶段: '成功', 数据: Onboarding状态([角色行('candidate', 完成时间)]) }).型).toBe('角色不可用');
  });
});

describe('Onboarding422提示：冻结 path 的可行动中文提示', () => {
  const 错误 = (path: string) => new BFF错误(422, 'validation_failed', '校验未通过', [{ path, reason: 'required' }]);

  it('候选冻结 path 逐项映射到相应现有页面的指引', () => {
    expect(Onboarding422提示(错误('resume.profile.real_name'))).toContain('基本信息');
    expect(Onboarding422提示(错误('resume.profile.status'))).toContain('基本信息');
    expect(Onboarding422提示(错误('resume.educations'))).toContain('教育');
    expect(Onboarding422提示(错误('intentions'))).toContain('求职意向');
  });

  it('招聘 path 映射到招聘名片', () => {
    expect(Onboarding422提示(错误('recruiter.profile'))).toContain('招聘名片');
    expect(Onboarding422提示(错误('recruiter.profile.public_name'))).toContain('招聘名片');
  });

  it('未知字段/非 422 不给猜测提示（null）', () => {
    expect(Onboarding422提示(错误('unknown.field'))).toBeNull();
    expect(Onboarding422提示(new BFF错误(503, 'operation_outcome_unknown', 'x'))).toBeNull();
    expect(Onboarding422提示(new Error('x'))).toBeNull();
  });
});

describe('创建Onboarding操作：应用操作面', () => {
  it('刷新Onboarding 成功返回数据；失败原样抛出（状态已记录）', async () => {
    const 后端 = 数据源({
      读取Onboarding: vi.fn()
        .mockResolvedValueOnce(Onboarding状态([角色行('candidate', 完成时间)]))
        .mockRejectedValueOnce(new BFF错误(503, 'recruitment_service_unavailable', 'x')),
    });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    const 操作 = 创建Onboarding操作(deps);
    await expect(操作.刷新Onboarding()).resolves.toEqual(Onboarding状态([角色行('candidate', 完成时间)]));
    await expect(操作.刷新Onboarding()).rejects.toMatchObject({ status: 503 });
    expect(最终Onboarding(deps).阶段).toBe('失败');
  });

  it('Mock 模式零请求：刷新/完成都不发网络、不写状态', async () => {
    const 后端 = 数据源();
    const { deps } = 创建Onboarding测试依赖(后端);
    (deps as 后端操作依赖 & { 是后端: boolean }).是后端 = false;
    const 操作 = 创建Onboarding操作(deps);
    await expect(操作.刷新Onboarding()).rejects.toMatchObject({ code: 'invalid_request' });
    await expect(操作.完成角色Onboarding('candidate')).rejects.toMatchObject({ code: 'invalid_request' });
    expect(后端.读取Onboarding).not.toHaveBeenCalled();
    expect(后端.完成Onboarding).not.toHaveBeenCalled();
    expect(最终Onboarding(deps).阶段).toBe('未读取');
  });

  it('完成角色Onboarding 返回 POST 结果并登记状态', async () => {
    const 后端 = 数据源();
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    const 结果 = await 创建Onboarding操作(deps).完成角色Onboarding('candidate');
    expect(结果.role).toBe('candidate');
    expect(最终Onboarding(deps).阶段).toBe('成功');
  });
});

describe('清Onboarding引用：会话边界作废在飞读', () => {
  it('递增请求序号：清后在飞的旧 GET 结果被丢弃', async () => {
    const 迟到 = deferred<BFFOnboarding状态>();
    const 后端 = 数据源({ 读取Onboarding: vi.fn(() => 迟到.promise) });
    const { deps } = 创建Onboarding测试依赖(后端);
    deps.主体标识引用.current = 'sub_1';
    const 在飞 = 水合Onboarding(deps, 'sub_1', 0);
    清Onboarding引用(deps); // 退出/401 清理递增序号
    迟到.resolve(Onboarding状态([角色行('candidate', 完成时间)]));
    await 在飞;
    expect(最终Onboarding(deps).阶段).toBe('加载中');
  });
});
