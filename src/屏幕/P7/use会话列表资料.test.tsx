// use会话列表资料（Task 2 Step 2）：P7 收件箱列表页的会话资料补读编排契约 ——
// 只消费已加载 available 项；role+caseId 去重；最多 4 个 Case 任务并发；候选端链路
// Case→岗位→企业 且相同岗位/企业本轮去重；翻页只追加新项（成功旧项不重拉）；
// 失败停在局部 unavailable、显式重试只重读失败项；P5 失权/清空当帧撤下资料；
// 换角色使旧轮回执作废。不建全局缓存、不注册轮询、不每 render 重拉。

import { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { use会话列表资料 } from './use会话列表资料';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { 候选详情DTO, 招聘详情DTO, 状态 } from '../P5/MatchCase详情.测试辅助';
import { BFF安全职位资料样本, BFF公司摘要样本 } from '../../测试/展示资料样本';
import type { P5详情快照 } from '../../状态/后端/类型';
import type { P5详情 } from '../../数据/招聘数据源/MatchCase';
import type { P7角色, P7会话项 } from '../../数据/招聘数据源/真人会话';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

/** 上下文覆盖便捷构造：jobRef 决定候选端是否走岗位/企业链。 */
function 上下文(jobRef: string | null): P7会话项['context'] {
  return { primaryLabel: '平台工程师', secondaryLabel: 'C-01', jobRef, resumeRef: null };
}

function 会话项(覆盖: Partial<P7会话项> = {}): P7会话项 {
  return {
    conversationId: '3001',
    caseId: 'mc_1',
    kind: 'human_handoff',
    lastMessage: null,
    lastActivityAt: '2026-09-16T01:00:00Z',
    unreadCount: 0,
    contextStatus: 'available',
    context: 上下文('job_1'),
    ...覆盖,
  };
}

const 快照 = (detail: unknown): P5详情快照 => ({
  阶段: '成功', 刷新中: false, detail: detail as P5详情快照['detail'], error: null, generation: 1,
});

function 候选资料详情(): P5详情 {
  return {
    ...候选详情DTO(),
    state: 状态({ caseId: 'mc_1' }),
    jobDetail: BFF安全职位资料样本,
  };
}

function 招聘资料详情(覆盖: { 身份?: unknown; 企业?: string | null } = {}): P5详情 {
  return {
    ...招聘详情DTO({ 别名: 'C-01' }),
    state: 状态({ caseId: 'mc_1' }),
    jobDetail: {
      ...BFF安全职位资料样本,
      organization: 覆盖.企业 === undefined
        ? BFF公司摘要样本
        : (覆盖.企业 === null ? null : { ...BFF公司摘要样本, display_name: 覆盖.企业 }),
    },
    candidateIdentity: (覆盖.身份 ?? {
      state: 'disclosed' as const, name: '陈屿',
      avatar_url: 'https://cdn.example.com/chen-yu.png', disclosed_at: null,
    }) as never,
  } as never;
}

function 岗位条目(编号: string | null): { organization: null; publisher_organization_ref: string | null } {
  return { organization: null, publisher_organization_ref: 编号 };
}

function 企业条目(名: string) {
  return {
    organization_id: 'org_p', legal_name: null, display_name: 名,
    verified_at: null, profile: null, active_verified_job_count: 0,
  };
}

/** 受控 deferred：任务链的每一段读取都可按测试节奏结算。 */
function 门<T>() {
  let 解决!: (值: T) => void;
  let 拒绝!: (因: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { 解决 = ok; 拒绝 = fail; });
  return { promise, 解决, 拒绝 };
}

function 装态() {
  mock应用状态 = {
    后端状态: {
      主体: { subject_id: 'sub_1', last_used_role: 'candidate' },
      P5详情: {},
      候选岗位详情: {},
      候选岗位不可用: [],
    },
    状态: { 公开企业表: {}, 不可用公开企业编号: [] },
    操作: {
      读取详情: vi.fn().mockResolvedValue(undefined),
      读取候选岗位详情: vi.fn().mockResolvedValue(undefined),
      读取公开企业: vi.fn().mockResolvedValue(undefined),
    },
  };
}

beforeEach(() => {
  装态();
});

describe('use会话列表资料 · 调度（去重 / 并发上限 / 翻页追加）', () => {
  it('最多 4 个 Case 任务同时运行；同 caseId 去重；完成一个补一个；unavailable 项不编排', async () => {
    const 详情门们 = new Map<string, ReturnType<typeof 门<void>>>();
    mock应用状态.操作.读取详情 = vi.fn(((_角色: string, caseId: string) => {
      const 本次 = 门<void>();
      详情门们.set(caseId, 本次);
      return 本次.promise;
    }));
    const 六项 = [1, 2, 3, 4, 5, 6].map((序) => 会话项({
      conversationId: String(3000 + 序), caseId: `mc_${序}`, context: 上下文(null),
    }));
    六项.push(会话项({ conversationId: '3099', caseId: 'mc_1', context: 上下文(null) })); // 同 case 重复行
    六项.push(会话项({ conversationId: '3098', caseId: 'mc_x', contextStatus: 'unavailable', context: null }));
    const { result } = renderHook(({ items }) => use会话列表资料('candidate', items), {
      initialProps: { items: 六项 },
    });
    await waitFor(() => expect(mock应用状态.操作.读取详情).toHaveBeenCalledTimes(4));
    expect(mock应用状态.操作.读取详情.mock.calls.map((调用: unknown[]) => 调用[1]))
      .toEqual(['mc_1', 'mc_2', 'mc_3', 'mc_4']);
    expect(result.current.资料表['mc_1']).toEqual({ 状态: 'loading', 资料: null });
    expect(result.current.资料表['mc_x']).toBeUndefined(); // unavailable 行不编排

    详情门们.get('mc_1')!.解决();
    await waitFor(() => expect(mock应用状态.操作.读取详情).toHaveBeenCalledTimes(5));
    expect(mock应用状态.操作.读取详情.mock.calls[4]![1]).toBe('mc_5');
    for (const 序 of ['mc_2', 'mc_3', 'mc_4', 'mc_5']) 详情门们.get(序)!.解决();
    await waitFor(() => expect(mock应用状态.操作.读取详情).toHaveBeenCalledTimes(6));
    expect(mock应用状态.操作.读取详情.mock.calls[5]![1]).toBe('mc_6');
    详情门们.get('mc_6')!.解决();
    await waitFor(() =>
      expect(Object.values(result.current.资料表).every((资料) => 资料.状态 !== 'loading')).toBe(true));
  });

  it('翻页只追加新项：已成功旧项不重拉；rerender 同集零新请求', async () => {
    mock应用状态.操作.读取详情 = vi.fn((_角色: string, caseId: string) => {
      mock应用状态.后端状态.P5详情[P5范围键.detail('candidate', caseId)] = 快照({
        ...候选资料详情(),
        state: 状态({ caseId }),
      });
      return Promise.resolve();
    });
    const 首页 = [会话项(), 会话项({ conversationId: '3002', caseId: 'mc_2', context: 上下文(null) })];
    const { result, rerender } = renderHook(({ items }) => use会话列表资料('candidate', items), {
      initialProps: { items: 首页 },
    });
    await waitFor(() => expect(result.current.资料表['mc_1']?.状态).toBe('available'));
    await waitFor(() => expect(result.current.资料表['mc_2']?.状态).toBe('available'));
    rerender({ items: 首页 });
    rerender({ items: 首页 });
    expect(mock应用状态.操作.读取详情).toHaveBeenCalledTimes(2); // 不每 render 重拉

    const 次页 = [...首页, 会话项({ conversationId: '3003', caseId: 'mc_3', context: 上下文(null) })];
    rerender({ items: 次页 });
    await waitFor(() => expect(mock应用状态.操作.读取详情).toHaveBeenCalledTimes(3));
    expect(mock应用状态.操作.读取详情).toHaveBeenLastCalledWith('candidate', 'mc_3', true);
    await waitFor(() => expect(result.current.资料表['mc_3']?.状态).toBe('available'));
  });

  it('StrictMode 重放不重复发起：同轮同 case 只一笔请求', async () => {
    mock应用状态.操作.读取详情 = vi.fn((_角色: string, caseId: string) => {
      mock应用状态.后端状态.P5详情[P5范围键.detail('candidate', caseId)] = 快照({
        ...候选资料详情(), state: 状态({ caseId }),
      });
      return Promise.resolve();
    });
    const { result } = renderHook(() => use会话列表资料('candidate', [会话项()]), {
      wrapper: StrictMode,
    });
    await waitFor(() => expect(result.current.资料表['mc_1']?.状态).toBe('available'));
    expect(mock应用状态.操作.读取详情).toHaveBeenCalledTimes(1);
  });

  it('StrictMode 双执行不突破 ≤4 并发上限：在飞读数以发起侧真相为准', async () => {
    const 详情门们 = new Map<string, ReturnType<typeof 门<void>>>();
    mock应用状态.操作.读取详情 = vi.fn(((_角色: string, caseId: string) => {
      const 本次 = 门<void>();
      详情门们.set(caseId, 本次);
      return 本次.promise;
    }));
    const 八项 = [1, 2, 3, 4, 5, 6, 7, 8].map((序) => 会话项({
      conversationId: String(3000 + 序), caseId: `mc_${序}`, context: 上下文(null),
    }));
    const { result } = renderHook(() => use会话列表资料('candidate', 八项), { wrapper: StrictMode });
    await waitFor(() => expect(mock应用状态.操作.读取详情).toHaveBeenCalledTimes(4));
    await new Promise((完成) => setTimeout(完成, 0)); // 排干微任务：第二遍 effect 不得再放行
    expect(mock应用状态.操作.读取详情).toHaveBeenCalledTimes(4);
    for (const 序 of ['mc_1', 'mc_2', 'mc_3', 'mc_4']) 详情门们.get(序)!.解决();
    await waitFor(() => expect(mock应用状态.操作.读取详情).toHaveBeenCalledTimes(8));
    for (const 序 of ['mc_5', 'mc_6', 'mc_7', 'mc_8']) 详情门们.get(序)!.解决();
    await waitFor(() =>
      expect(Object.values(result.current.资料表).every((资料) => 资料.状态 !== 'loading')).toBe(true));
  });
});

describe('use会话列表资料 · 候选端链路（Case→岗位→企业，本轮去重）', () => {
  it('详情落地后按 jobRef 强读岗位，再按发布方编号读企业；同岗位/同企业只读一次', async () => {
    const 详情门 = 门<void>();
    const 岗位门 = 门<void>();
    const 企业门 = 门<void>();
    mock应用状态.操作.读取详情 = vi.fn(() => 详情门.promise);
    mock应用状态.操作.读取候选岗位详情 = vi.fn(() => 岗位门.promise);
    mock应用状态.操作.读取公开企业 = vi.fn(() => 企业门.promise);
    const 两项 = [
      会话项(),
      会话项({ conversationId: '3002', caseId: 'mc_2' }), // 同 jobRef=job_1、同发布方 org_p
    ];
    const { result } = renderHook(({ items }) => use会话列表资料('candidate', items), {
      initialProps: { items: 两项 },
    });
    await waitFor(() => expect(mock应用状态.操作.读取详情).toHaveBeenCalledTimes(2));
    expect(mock应用状态.操作.读取候选岗位详情).not.toHaveBeenCalled(); // 详情在飞不读岗位
    mock应用状态.后端状态.P5详情[P5范围键.detail('candidate', 'mc_1')] = 快照({
      ...候选资料详情(), state: 状态({ caseId: 'mc_1' }),
    });
    mock应用状态.后端状态.P5详情[P5范围键.detail('candidate', 'mc_2')] = 快照({
      ...候选资料详情(), state: 状态({ caseId: 'mc_2' }),
    });
    详情门.解决();
    await waitFor(() => expect(mock应用状态.操作.读取候选岗位详情).toHaveBeenCalledTimes(1));
    expect(mock应用状态.操作.读取候选岗位详情).toHaveBeenCalledWith('job_1', true);
    mock应用状态.后端状态.候选岗位详情.job_1 = 岗位条目('org_p');
    岗位门.解决();
    await waitFor(() => expect(mock应用状态.操作.读取公开企业).toHaveBeenCalledTimes(1));
    expect(mock应用状态.操作.读取公开企业).toHaveBeenCalledWith('org_p');
    mock应用状态.状态.公开企业表.org_p = 企业条目('星桥猎头');
    企业门.解决();
    await waitFor(() => expect(result.current.资料表['mc_1']).toEqual({
      状态: 'available',
      资料: { 姓名: '林澈', 头像URL: null, 企业: '星桥猎头', 职位: '招聘负责人' },
    }));
    await waitFor(() => expect(result.current.资料表['mc_2']?.状态).toBe('available'));
    // 同岗位/同企业本轮去重：两条会话只各一笔岗位/企业请求
    expect(mock应用状态.操作.读取候选岗位详情).toHaveBeenCalledTimes(1);
    expect(mock应用状态.操作.读取公开企业).toHaveBeenCalledTimes(1);
  });

  it('浏览器时序反例：store 不可变替换下岗位结算先于重渲染，仍按新快照坐标读企业', async () => {
    // 真实浏览器里 store 更新是「替换整棵状态对象」：岗位读取的 promise 结算（微任务）
    // 跑在 React 提交（渲染）之前，此时 hook 持有的还是旧状态对象 —— 链条若在 await
    // 之后立刻从旧对象读发布方坐标，会永远拿到空并跳过企业读（副标题缺公司）。
    const 岗位门 = 门<void>();
    mock应用状态.操作.读取详情 = vi.fn((_角色: string, caseId: string) => {
      mock应用状态.后端状态.P5详情[P5范围键.detail('candidate', caseId)] = 快照({
        ...候选资料详情(), state: 状态({ caseId }),
      });
      return Promise.resolve();
    });
    mock应用状态.操作.读取候选岗位详情 = vi.fn(() => 岗位门.promise);
    mock应用状态.操作.读取公开企业 = vi.fn((编号: string) => {
      mock应用状态.状态.公开企业表[编号] = 企业条目('星桥猎头');
      return Promise.resolve();
    });
    const { result } = renderHook(({ items }) => use会话列表资料('candidate', items), {
      initialProps: { items: [会话项()] },
    });
    await waitFor(() => expect(mock应用状态.操作.读取候选岗位详情).toHaveBeenCalledTimes(1));
    // 不可变替换：新状态对象整棵换上（渲染未发生，hook 的 ref 还指着旧对象）
    mock应用状态.后端状态 = {
      ...mock应用状态.后端状态,
      候选岗位详情: { job_1: 岗位条目('org_p') },
    };
    await act(async () => {
      岗位门.解决();
      // 排干微任务与一次渲染提交：链条的「结算后决策」窗口完整跑完
      await new Promise((完成) => setTimeout(完成, 0));
    });
    await waitFor(() => expect(mock应用状态.操作.读取公开企业).toHaveBeenCalledWith('org_p'));
    await waitFor(() => expect(result.current.资料表['mc_1']).toEqual({
      状态: 'available',
      资料: { 姓名: '林澈', 头像URL: null, 企业: '星桥猎头', 职位: '招聘负责人' },
    }));
  });

  it('企业读失败是链路终局：行仍可用（企业留空），不吊死在 loading，旧坐标不透出', async () => {
    mock应用状态.操作.读取详情 = vi.fn((_角色: string, caseId: string) => {
      mock应用状态.后端状态.P5详情[P5范围键.detail('candidate', caseId)] = 快照({
        ...候选资料详情(), state: 状态({ caseId }),
      });
      return Promise.resolve();
    });
    mock应用状态.操作.读取候选岗位详情 = vi.fn((jobId: string) => {
      mock应用状态.后端状态.候选岗位详情[jobId] = 岗位条目('org_p');
      return Promise.resolve();
    });
    mock应用状态.操作.读取公开企业 = vi.fn(() => Promise.reject(new Error('企业读失败')));
    // 上一轮旧企业名预置在缓存：本轮失败不得透出
    mock应用状态.状态.公开企业表.org_p = 企业条目('旧缓存公司');
    const { result } = renderHook(({ items }) => use会话列表资料('candidate', items), {
      initialProps: { items: [会话项()] },
    });
    await waitFor(() => expect(result.current.资料表['mc_1']).toEqual({
      状态: 'available',
      资料: { 姓名: '林澈', 头像URL: null, 企业: null, 职位: '招聘负责人' },
    }));
    expect(mock应用状态.操作.读取公开企业).toHaveBeenCalledTimes(1); // 不自动重试
  });

  it('本轮岗位/企业失败不消费旧缓存坐标：企业缺省但姓名仍出，失败不串联清其他行', async () => {
    mock应用状态.操作.读取详情 = vi.fn((_角色: string, caseId: string) => {
      mock应用状态.后端状态.P5详情[P5范围键.detail('candidate', caseId)] = 快照({
        ...候选资料详情(), state: 状态({ caseId }),
      });
      return Promise.resolve();
    });
    mock应用状态.操作.读取候选岗位详情 = vi.fn(() => Promise.reject(new Error('岗位读失败')));
    // 预置上一轮旧坐标 + 旧企业名：本轮失败不得透出
    mock应用状态.后端状态.候选岗位详情.job_1 = 岗位条目('org_旧');
    mock应用状态.状态.公开企业表.org_旧 = 企业条目('旧缓存公司');
    const { result } = renderHook(({ items }) => use会话列表资料('candidate', items), {
      initialProps: { items: [会话项()] },
    });
    await waitFor(() => expect(result.current.资料表['mc_1']).toEqual({
      状态: 'available',
      资料: { 姓名: '林澈', 头像URL: null, 企业: null, 职位: '招聘负责人' },
    }));
    expect(mock应用状态.操作.读取公开企业).not.toHaveBeenCalled(); // 未按旧坐标发企业读
  });
});

describe('use会话列表资料 · 招聘端（只读 Case 详情，企业来自 jobDetail）', () => {
  it('详情落地即组装：企业 = 用人企业 display_name、职位 = 冻结岗位；不再读岗位/企业接口', async () => {
    mock应用状态.操作.读取详情 = vi.fn((_角色: string, caseId: string) => {
      mock应用状态.后端状态.P5详情[P5范围键.detail('recruiter', caseId)] = 快照(
        招聘资料详情({ 企业: '云衢科技' }),
      );
      return Promise.resolve();
    });
    mock应用状态.后端状态.主体 = { subject_id: 'sub_1', last_used_role: 'recruiter' };
    const 招聘条 = 会话项({ caseId: 'mc_1', context: 上下文('job_1') });
    const { result } = renderHook(({ items }) => use会话列表资料('recruiter', items), {
      initialProps: { items: [招聘条] },
    });
    await waitFor(() => expect(result.current.资料表['mc_1']).toEqual({
      状态: 'available',
      资料: { 姓名: '陈屿', 头像URL: 'https://cdn.example.com/chen-yu.png', 企业: '云衢科技', 职位: '平台工程师' },
    }));
    expect(mock应用状态.操作.读取候选岗位详情).not.toHaveBeenCalled();
    expect(mock应用状态.操作.读取公开企业).not.toHaveBeenCalled();
  });
});

describe('use会话列表资料 · 失败 / 重试 / 失权撤下', () => {
  it('读取失败停在局部 unavailable（不无限重试）；重试只重读失败项；成功项不受影响', async () => {
    let 失败过 = false;
    mock应用状态.操作.读取详情 = vi.fn((_角色: string, caseId: string) => {
      if (caseId === 'mc_2' && !失败过) {
        失败过 = true;
        return Promise.reject(new Error('读失败'));
      }
      mock应用状态.后端状态.P5详情[P5范围键.detail('candidate', caseId)] = 快照({
        ...候选资料详情(), state: 状态({ caseId }),
      });
      return Promise.resolve();
    });
    const 两项 = [会话项(), 会话项({ conversationId: '3002', caseId: 'mc_2', context: 上下文(null) })];
    const { result } = renderHook(({ items }) => use会话列表资料('candidate', items), {
      initialProps: { items: 两项 },
    });
    await waitFor(() => expect(result.current.资料表['mc_1']?.状态).toBe('available'));
    await waitFor(() => expect(result.current.资料表['mc_2']).toEqual({ 状态: 'unavailable', 资料: null }));
    expect(result.current.有失败).toBe(true);
    await new Promise((完成) => setTimeout(完成, 0));
    expect(mock应用状态.操作.读取详情).toHaveBeenCalledTimes(2); // 不自动重试

    act(() => { result.current.重试失败(); });
    await waitFor(() => expect(mock应用状态.操作.读取详情).toHaveBeenCalledTimes(3));
    expect(mock应用状态.操作.读取详情).toHaveBeenLastCalledWith('candidate', 'mc_2', true);
    await waitFor(() => expect(result.current.资料表['mc_2']?.状态).toBe('available'));
    expect(result.current.有失败).toBe(false);
  });

  it('重试不抹其他成功行的发布企业名：只定向摘除失败坐标，成功链路零重读', async () => {
    let mc1失败 = true;
    mock应用状态.操作.读取详情 = vi.fn((_角色: string, caseId: string) => {
      if (caseId === 'mc_1' && mc1失败) return Promise.reject(new Error('读失败'));
      mock应用状态.后端状态.P5详情[P5范围键.detail('candidate', caseId)] = 快照({
        ...候选资料详情(), state: 状态({ caseId }),
      });
      return Promise.resolve();
    });
    // 失败 case 走 job_1/org_p，成功 case 走 job_2/org_q —— 两条互不共享的链路
    mock应用状态.操作.读取候选岗位详情 = vi.fn((jobId: string) => {
      mock应用状态.后端状态.候选岗位详情[jobId] = 岗位条目(jobId === 'job_1' ? 'org_p' : 'org_q');
      return Promise.resolve();
    });
    mock应用状态.操作.读取公开企业 = vi.fn((编号: string) => {
      mock应用状态.状态.公开企业表[编号] = 企业条目(编号 === 'org_p' ? '星桥甲' : '星桥乙');
      return Promise.resolve();
    });
    const 两项 = [
      会话项(), // mc_1 / job_1
      会话项({ conversationId: '3002', caseId: 'mc_2', context: 上下文('job_2') }),
    ];
    const { result } = renderHook(({ items }) => use会话列表资料('candidate', items), {
      initialProps: { items: 两项 },
    });
    await waitFor(() => expect(result.current.资料表['mc_2']).toEqual({
      状态: 'available',
      资料: { 姓名: '林澈', 头像URL: null, 企业: '星桥乙', 职位: '招聘负责人' },
    }));
    await waitFor(() => expect(result.current.资料表['mc_1']).toEqual({ 状态: 'unavailable', 资料: null }));
    mc1失败 = false;
    act(() => { result.current.重试失败(); });
    await waitFor(() => expect(result.current.资料表['mc_1']?.状态).toBe('available'));
    expect(result.current.资料表['mc_1'].状态 === 'available' && result.current.资料表['mc_1'].资料!.企业)
      .toBe('星桥甲');
    // 关键反例：成功行 mc_2 的发布企业名不被重试抹掉（也不退化为 null）
    expect(result.current.资料表['mc_2'].状态 === 'available' && result.current.资料表['mc_2'].资料!.企业)
      .toBe('星桥乙');
    // 成功链路坐标未被无差别清除：本轮岗位/企业仍各只两笔，无重试重读
    expect(mock应用状态.操作.读取候选岗位详情).toHaveBeenCalledTimes(2);
    expect(mock应用状态.操作.读取公开企业).toHaveBeenCalledTimes(2);
  });

  it('P5 失权/清空当帧撤下：快照失败或被清掉立即回 unavailable，不残留旧姓名', async () => {
    mock应用状态.操作.读取详情 = vi.fn(() => {
      mock应用状态.后端状态.P5详情[P5范围键.detail('recruiter', 'mc_1')] = 快照(招聘资料详情());
      return Promise.resolve();
    });
    mock应用状态.后端状态.主体 = { subject_id: 'sub_1', last_used_role: 'recruiter' };
    const 条 = 会话项({ context: 上下文(null) });
    const { result, rerender } = renderHook(({ items }) => use会话列表资料('recruiter', items), {
      initialProps: { items: [条] },
    });
    await waitFor(() => expect(result.current.资料表['mc_1']?.状态).toBe('available'));
    // P5 拒绝（快照失败）→ 立即撤下
    mock应用状态.后端状态.P5详情[P5范围键.detail('recruiter', 'mc_1')] = {
      阶段: '失败', 刷新中: false, detail: null, error: '服务暂时不可用', generation: 2,
    };
    rerender({ items: [条] });
    expect(result.current.资料表['mc_1']).toEqual({ 状态: 'unavailable', 资料: null });
    // 清空（换账号清表）→ 同样撤下，旧 Promise 不能复活
    mock应用状态.后端状态.P5详情 = {};
    rerender({ items: [条] });
    expect(result.current.资料表['mc_1']).toEqual({ 状态: 'unavailable', 资料: null });
  });

  it('换角色开新轮：旧轮在飞回执不落新轮状态，新轮重新发起', async () => {
    const 候选门 = 门<void>();
    const 招聘门 = 门<void>();
    mock应用状态.操作.读取详情 = vi.fn(((角色: string, _caseId: string) =>
      角色 === 'candidate' ? 候选门.promise : 招聘门.promise));
    const 条 = 会话项({ context: 上下文(null) });
    const { result, rerender } = renderHook(
      ({ 角色, items }: { 角色: P7角色; items: P7会话项[] }) => use会话列表资料(角色, items),
      { initialProps: { 角色: 'candidate' as P7角色, items: [条] } },
    );
    await waitFor(() => expect(mock应用状态.操作.读取详情).toHaveBeenCalledWith('candidate', 'mc_1', true));
    mock应用状态.后端状态.主体 = { subject_id: 'sub_1', last_used_role: 'recruiter' };
    rerender({ 角色: 'recruiter' as const, items: [条] });
    await waitFor(() => expect(mock应用状态.操作.读取详情).toHaveBeenCalledWith('recruiter', 'mc_1', true));
    expect(mock应用状态.操作.读取详情).toHaveBeenCalledTimes(2);

    // 旧轮（candidate）迟到结算：不得把 recruiter 轮标成完成
    mock应用状态.后端状态.P5详情[P5范围键.detail('candidate', 'mc_1')] = 快照(候选资料详情());
    候选门.解决();
    rerender({ 角色: 'recruiter' as const, items: [条] });
    expect(result.current.资料表['mc_1']).toEqual({ 状态: 'loading', 资料: null });

    mock应用状态.后端状态.P5详情[P5范围键.detail('recruiter', 'mc_1')] = 快照(招聘资料详情());
    招聘门.解决();
    await waitFor(() => expect(result.current.资料表['mc_1']?.状态).toBe('available'));
    expect(result.current.资料表['mc_1'].状态 === 'available' && result.current.资料表['mc_1'].资料!.姓名).toBe('陈屿');
  });
});
