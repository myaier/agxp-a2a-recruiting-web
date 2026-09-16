// use真人会话资料（Spec §11.2）：真人会话页头与资料弹层的局部读取 hook 契约 ——
// 只组织本页资料读取、映射与局部失败状态；读现有 provider 状态（P5详情 / 候选岗位详情 /
// 公开企业表），不建 store、不加轮询。身份来源铁律：
//   · 招聘页头 = Case candidateIdentity（disclosed 有名才显真名；anonymous 保留 Case 代号）；
//   · 候选页头 = Case jobDetail.publisher_profile（姓名/职务）+ 发布方公司（经当前岗位
//     publisher_organization_ref 读公开企业，绝不拿用人企业 organization 替代）；
//   · 授权 context 不在场 / 补读失败只降级资料，不透出旧身份、不阻断消息。
// 受控 promise 验证迟到资料不污染新会话；快照失败不消费缓存旧身份（手动重读同口径）。

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { use真人会话资料 } from './use真人会话资料';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { 候选详情DTO, 招聘详情DTO, 状态 } from '../P5/MatchCase详情.测试辅助';
import { BFF安全职位资料样本 } from '../../测试/展示资料样本';
import type { P5详情快照 } from '../../状态/后端/类型';
import type { P7会话项 } from '../../数据/招聘数据源/真人会话';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

const 会话 = (覆盖: Partial<P7会话项> = {}): P7会话项 => ({
  conversationId: '3003',
  caseId: 'mc_3003',
  kind: 'human_handoff',
  lastMessage: null,
  lastActivityAt: '2026-09-16T01:00:00Z',
  unreadCount: 0,
  contextStatus: 'available',
  context: {
    primaryLabel: '平台工程师',
    secondaryLabel: 'C-07',
    jobRef: 'job_3003',
    resumeRef: 'rf_3003',
  },
  ...覆盖,
});

const 快照 = (detail: unknown): P5详情快照 =>
  ({ 阶段: '成功', 刷新中: false, detail: detail as P5详情快照['detail'], error: null, generation: 1 });

function 装态(覆盖: Record<string, unknown> = {}) {
  mock应用状态 = {
    后端状态: {
      P5详情: {},
      候选岗位详情: {},
      ...覆盖,
    },
    状态: {
      公开企业表: {},
      不可用公开企业编号: [],
    },
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

describe('use真人会话资料 · 招聘页头（Case candidateIdentity）', () => {
  it('disclosed 有名：标题 = 候选真名、副标题 = Case 职位名、头像 = 已披露 avatar_url', async () => {
    const 详情 = {
      ...招聘详情DTO({ 别名: 'C-07' }),
      state: 状态({ caseId: 'mc_3003' }),
      candidateIdentity: {
        state: 'disclosed' as const,
        name: '陈屿',
        avatar_url: 'https://cdn.example.com/chen-yu.png',
        disclosed_at: '2026-09-01T00:00:00Z',
      },
    };
    mock应用状态.后端状态.P5详情[P5范围键.detail('recruiter', 'mc_3003')] = 快照(详情);
    const { result } = renderHook(() => use真人会话资料('recruiter', 会话()));
    await waitFor(() => expect(result.current.标题).toBe('陈屿'));
    expect(result.current.副标题).toBe('平台工程师');
    expect(result.current.对方头像URL).toBe('https://cdn.example.com/chen-yu.png');
    expect(result.current.对方首字).toBe('陈');
    expect(result.current.资料状态).toBe('available');
    // 招聘层正文走授权 PDF；职位资料只在冻结 jobDetail 在场时给出（该 DTO 缺席 → null）
    expect(result.current.职位资料).toBeNull();
  });

  it('disclosed 缺名：显示「候选人姓名暂未提供」，anonymous：保留 Case 代号、不显被遮蔽姓名', async () => {
    mock应用状态.后端状态.P5详情[P5范围键.detail('recruiter', 'mc_3003')] = 快照({
      ...招聘详情DTO({ 别名: 'C-07' }),
      state: 状态({ caseId: 'mc_3003' }),
      candidateIdentity: { state: 'disclosed', name: null, avatar_url: null, disclosed_at: '2026-09-01T00:00:00Z' },
    });
    const 缺名 = renderHook(() => use真人会话资料('recruiter', 会话()));
    await waitFor(() => expect(缺名.result.current.标题).toBe('候选人姓名暂未提供'));
    缺名.unmount();

    mock应用状态.后端状态.P5详情[P5范围键.detail('recruiter', 'mc_3003')] = 快照({
      ...招聘详情DTO({ 别名: 'C-07' }),
      state: 状态({ caseId: 'mc_3003' }),
    });
    const 匿名 = renderHook(() => use真人会话资料('recruiter', 会话()));
    await waitFor(() => expect(匿名.result.current.标题).toBe('C-07'));
    expect(匿名.result.current.对方头像URL).toBeNull();
  });
});

describe('use真人会话资料 · 候选页头（发布人档案 + 发布方公司）', () => {
  function 候选会话详情(): Parameters<typeof 快照>[0] {
    return {
      ...候选详情DTO(),
      state: 状态({ caseId: 'mc_3003' }),
      jobDetail: {
        ...BFF安全职位资料样本,
        publisher_profile: {
          public_name: '林澈',
          title: '招聘负责人',
          personal_verification_status: 'verified',
          avatar_url: 'https://cdn.example.com/lin-che.png',
        },
      },
    };
  }

  it('标题 = 发布人姓名，副标题 = 发布方公司 · 职务；公司读公开企业 display_name，不用用人企业', async () => {
    mock应用状态.后端状态.P5详情[P5范围键.detail('candidate', 'mc_3003')] = 快照(候选会话详情());
    // 当前岗位：发布方 org-pub 与用人企业 org-hire 不同 —— 只有 org-pub 可作副标题公司
    mock应用状态.后端状态.候选岗位详情.job_3003 = {
      organization: null,
      publisher_organization_ref: 'org-pub',
    };
    mock应用状态.状态.公开企业表['org-pub'] = {
      organization_id: 'org-pub', legal_name: null, display_name: '星桥猎头',
      verified_at: null, profile: null, active_verified_job_count: 0,
    };
    const { result } = renderHook(() => use真人会话资料('candidate', 会话()));
    await waitFor(() => expect(result.current.标题).toBe('林澈'));
    expect(result.current.副标题).toBe('星桥猎头 · 招聘负责人');
    expect(result.current.对方头像URL).toBe('https://cdn.example.com/lin-che.png');
    expect(result.current.职位资料).not.toBeNull();
  });

  it('岗位/企业缺场或不可用：公司显示「公司暂未提供」，发布人姓名/职务仍按 Case 冻结档案', async () => {
    mock应用状态.后端状态.P5详情[P5范围键.detail('candidate', 'mc_3003')] = 快照(候选会话详情());
    const { result } = renderHook(() => use真人会话资料('candidate', 会话()));
    await waitFor(() => expect(result.current.标题).toBe('林澈'));
    expect(result.current.副标题).toBe('公司暂未提供 · 招聘负责人');

    // 岗位在但公开企业标记不可用：同样不落旧缓存
    mock应用状态.后端状态.候选岗位详情.job_3003 = { organization: null, publisher_organization_ref: 'org-pub' };
    mock应用状态.状态.不可用公开企业编号 = ['org-pub'];
    const 不可用 = renderHook(() => use真人会话资料('candidate', 会话()));
    await waitFor(() => expect(不可用.result.current.标题).toBe('林澈'));
    expect(不可用.result.current.副标题).toBe('公司暂未提供 · 招聘负责人');
  });

  it('发布人档案缺席：姓名/职务给缺失占位，不挖 PDF 或拼身份坐标', async () => {
    mock应用状态.后端状态.P5详情[P5范围键.detail('candidate', 'mc_3003')] = 快照({
      ...候选详情DTO(),
      state: 状态({ caseId: 'mc_3003' }),
      jobDetail: { ...BFF安全职位资料样本, publisher_profile: null },
    });
    const { result } = renderHook(() => use真人会话资料('candidate', 会话()));
    await waitFor(() => expect(result.current.标题).toBe('招聘者姓名暂未提供'));
    expect(result.current.副标题).toBe('公司暂未提供 · 角色暂未提供');
    expect(result.current.对方头像URL).toBeNull();
    expect(result.current.对方首字).toBe('招');
  });
});

describe('use真人会话资料 · 读取与失败降级', () => {
  it('授权在场进会话做一次定向 P5 读取（force，不加轮询）；候选端补读当前岗位与公开企业', async () => {
    const { result, rerender } = renderHook(() => use真人会话资料('candidate', 会话()));
    expect(mock应用状态.操作.读取详情).toHaveBeenCalledWith('candidate', 'mc_3003', true);
    expect(mock应用状态.操作.读取候选岗位详情).toHaveBeenCalledWith('job_3003', true);
    rerender();
    expect(mock应用状态.操作.读取详情).toHaveBeenCalledTimes(1);

    mock应用状态.后端状态.候选岗位详情.job_3003 = { organization: null, publisher_organization_ref: 'org-pub' };
    rerender();
    await waitFor(() => expect(mock应用状态.操作.读取公开企业).toHaveBeenCalledWith('org-pub'));
    expect(result.current.标题).toBeTruthy();
  });

  it('快照缺席 = loading；上下文不可用 = unavailable（回落 P7 标签，不透出旧身份）', () => {
    const 加载中 = renderHook(() => use真人会话资料('recruiter', 会话()));
    expect(加载中.result.current.资料状态).toBe('loading');
    加载中.unmount();

    const 不可用 = renderHook(() => use真人会话资料('recruiter', 会话({ contextStatus: 'unavailable', context: null })));
    expect(不可用.result.current.资料状态).toBe('unavailable');
    expect(不可用.result.current.职位资料).toBeNull();
    expect(mock应用状态.操作.读取详情).toHaveBeenCalledTimes(1); // 不可用会话不发起补读
  });

  it('补读失败不消费缓存旧身份（有 detail 也有 error 一并按失败降级）；重读走 force', async () => {
    mock应用状态.后端状态.P5详情[P5范围键.detail('recruiter', 'mc_3003')] = {
      阶段: '失败', 刷新中: false,
      detail: {
        ...招聘详情DTO({ 别名: 'C-07' }),
        state: 状态({ caseId: 'mc_3003' }),
        candidateIdentity: { state: 'disclosed', name: '陈屿', avatar_url: null, disclosed_at: null },
      },
      error: '服务暂时不可用', generation: 2,
    };
    const { result } = renderHook(() => use真人会话资料('recruiter', 会话()));
    await waitFor(() => expect(result.current.资料状态).toBe('unavailable'));
    expect(result.current.标题).not.toBe('陈屿');
    result.current.重读资料();
    expect(mock应用状态.操作.读取详情).toHaveBeenLastCalledWith('recruiter', 'mc_3003', true);
  });

  it('jobDetail 缺席：职位资料为 null（弹层显示不可用），不拿当前岗位替代历史资料', async () => {
    mock应用状态.后端状态.P5详情[P5范围键.detail('candidate', 'mc_3003')] = 快照({
      ...候选详情DTO(),
      state: 状态({ caseId: 'mc_3003' }),
      jobDetail: null,
    });
    const { result } = renderHook(() => use真人会话资料('candidate', 会话()));
    await waitFor(() => expect(result.current.资料状态).toBe('available'));
    expect(result.current.职位资料).toBeNull();
  });

  it('迟到资料不污染新会话：旧 case 的补读落地只写旧范围键', async () => {
    let 旧读取结算!: () => void;
    mock应用状态.操作.读取详情 = vi.fn((_角色: string, caseId: string) => {
      if (caseId === 'mc_old') return new Promise<void>((完成) => { 旧读取结算 = 完成; });
      return Promise.resolve();
    });
    const 旧会话 = 会话({ conversationId: '2002', caseId: 'mc_old' });
    const 新会话 = 会话();
    const { rerender, result } = renderHook(({ 详情 }) => use真人会话资料('recruiter', 详情), {
      initialProps: { 详情: 旧会话 },
    });
    rerender({ 详情: 新会话 });
    // 新会话成功落地
    mock应用状态.后端状态.P5详情[P5范围键.detail('recruiter', 'mc_3003')] = 快照({
      ...招聘详情DTO({ 别名: 'C-07' }),
      state: 状态({ caseId: 'mc_3003' }),
    });
    rerender({ 详情: 新会话 });
    await waitFor(() => expect(result.current.标题).toBe('C-07'));
    // 旧会话的迟到读取现在才结算：写入旧范围键，不影响当前页
    mock应用状态.后端状态.P5详情[P5范围键.detail('recruiter', 'mc_old')] = 快照({
      ...招聘详情DTO({ 别名: 'C-99' }),
      state: 状态({ caseId: 'mc_old' }),
    });
    旧读取结算();
    rerender({ 详情: 新会话 });
    await waitFor(() => expect(result.current.标题).toBe('C-07'));
  });
});


// ── 异构 review-r1 F2：本轮读取门槛 —— 旧缓存不替代本轮读取 ──
describe('use真人会话资料 · 本轮读取门槛（review-r1 F2）', () => {
  it('预置成功缓存也强制本轮读取：pending 期间回落占位，本轮落地才显示身份', async () => {
    let 落地!: () => void;
    mock应用状态.操作.读取详情 = vi.fn(() => new Promise<void>((完成) => { 落地 = 完成; }));
    mock应用状态.后端状态.P5详情[P5范围键.detail('recruiter', 'mc_3003')] = 快照({
      ...招聘详情DTO({ 别名: 'C-07' }),
      state: 状态({ caseId: 'mc_3003' }),
      candidateIdentity: { state: 'disclosed', name: '旧缓存真名', avatar_url: null, disclosed_at: null },
    });
    const { result } = renderHook(() => use真人会话资料('recruiter', 会话()));
    expect(mock应用状态.操作.读取详情).toHaveBeenCalledWith('recruiter', 'mc_3003', true);
    // 本轮在飞：缓存里的旧身份不出场，页头回落 P7 授权标签
    expect(result.current.标题).toBe('C-07');
    expect(result.current.资料状态).toBe('loading');
    落地();
    await waitFor(() => expect(result.current.标题).toBe('旧缓存真名'));
    expect(result.current.资料状态).toBe('available');
  });

  it('手动重读期间旧身份退场，本次落地后恢复', async () => {
    let 第二轮!: () => void;
    mock应用状态.操作.读取详情 = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => new Promise<void>((完成) => { 第二轮 = 完成; }));
    mock应用状态.后端状态.P5详情[P5范围键.detail('recruiter', 'mc_3003')] = 快照({
      ...招聘详情DTO({ 别名: 'C-07' }),
      state: 状态({ caseId: 'mc_3003' }),
      candidateIdentity: { state: 'disclosed', name: '陈屿', avatar_url: null, disclosed_at: null },
    });
    const { result } = renderHook(() => use真人会话资料('recruiter', 会话()));
    await waitFor(() => expect(result.current.标题).toBe('陈屿'));
    act(() => { result.current.重读资料(); });
    await waitFor(() => expect(result.current.标题).toBe('C-07')); // 重读在飞：退回占位
    第二轮();
    await waitFor(() => expect(result.current.标题).toBe('陈屿'));
  });
});
