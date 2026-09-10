// use后端详情动作 · 控制测试（契约 C 的 S0 分支）：respond_fact 与 end_screening 的业务
// 控制自 屏幕/P5/MatchCase详情 的 阶段动作区 原样搬入，命令参数与生命周期逐项对照旧实现：
//   · 空回答零请求；回答事实 精确带 (role, caseId, 当前 typed promptId, trim 后原文)；
//   · 失败（503）保留草稿可继续编辑；成功才清空；
//   · 回答在飞按 caseId 记在父级持有的表里：动作区卸载不丢锁，同 Case 回来续锁，
//     在飞中不可能重发第二段草稿；他单在飞不锁本单（按 caseId 记账）；
//   · 换 Case 后旧单迟到回调不能改动新单草稿（局部代际栅栏）；
//   · end_screening 保持二次确认语义：确认前零请求，确认后 决定S0(caseId,'end')，
//     取消零请求；招聘端结束卡零控件（wire 缺 recruiter decisions 臂，fail closed）；
//   · S1 的 简历选择/披露确认 本 Task 恒 null（Task 6 迁入，返回合同不再变）。
// 夹具走真实 映射P5详情（视图与 raw DTO 同屏同源），不造假视图对象。
// 仓库未装 @testing-library/jest-dom，断言用调用计数与 toBe。

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { use后端详情动作 } from './use后端详情动作';
import type { 后端详情动作输入 } from './use后端详情动作';
import { 映射P5详情 } from '../../数据/MatchCase展示映射';
import type { P5详情正常视图, P5角色, P5动作 } from '../../数据/MatchCase展示映射';
import type { P5阶段区, P5状态视图, P5详情, P5工作区职位 } from '../../数据/招聘数据源/MatchCase';
import type { 事实问题属性 } from '../../组件/在谈详情/类型';

// ── 夹具：S0 needs_user 行（human_decision）——想看见 respond_fact/end_screening 卡
//    必须用这一行；补充问题按 viewer 角色匹配（零/多条会被映射层 fail closed）。──

const 冻结职位: P5工作区职位 = {
  jobId: 'job_0123456789abcdef0123456789abcdef',
  job: { title: '平台工程师', location: '上海', publicSalaryRange: '25-40K·16薪', requiredSkills: ['Go'] },
};

function 状态(覆盖: Partial<P5状态视图> = {}): P5状态视图 {
  return {
    caseId: 'mc_a',
    lifecycle: 'open',
    stage: 'anonymous_screening',
    status: 'needs_user',
    step: 'human_decision',
    round: 1,
    roundBudget: 3,
    needsUser: true,
    outcome: null,
    outcomeCode: null,
    createdAt: '2026-09-10T01:00:00Z',
    updatedAt: '2026-09-10T02:00:00Z',
    finalizedAt: null,
    agentAttention: null,
    ...覆盖,
  };
}

function 阶段区组(问题角色: P5角色, 问题ref: string): P5阶段区[] {
  const S0: P5阶段区 = {
    stage: 'anonymous_screening',
    state: 'active',
    occurredAt: '2026-09-10T01:10:00Z',
    summary: 'candidate_reevaluation',
    checklist: [],
    transcript: [
      {
        eventId: 'evt_q1',
        stage: 'anonymous_screening',
        kind: 'supplementary_question',
        role: 问题角色,
        ref: 问题ref,
        text: '每周可以到岗几天？',
        occurredAt: '2026-09-10T01:10:00Z',
      },
    ],
    instructionReceipts: [],
    attachment: null,
    screeningRecords: { messages: [], summaries: [] },
  };
  const 待 = (stage: 'resume_submission' | 'needs_coordination' | 'intent_confirmation'): P5阶段区 => ({
    stage,
    state: 'pending',
    occurredAt: null,
    summary: '',
    checklist: [],
    transcript: [],
    instructionReceipts: [],
    attachment: null,
    screeningRecords: null,
  });
  return [S0, 待('resume_submission'), 待('needs_coordination'), 待('intent_confirmation')];
}

function S0详情DTO(选项: { role?: P5角色; caseId?: string; 问题ref?: string } = {}): P5详情 {
  const 公共 = {
    state: 状态({ caseId: 选项.caseId ?? 'mc_a' }),
    needsAction: true,
    availableActions: ['respond_fact', 'end_screening'] as P5动作[],
    currentCoordination: null,
    intentConfirmations: { candidate: '', recruiter: '' } as const,
    terminalSummary: null,
    conversationRef: null,
  };
  if ((选项.role ?? 'candidate') === 'recruiter') {
    return {
      role: 'recruiter',
      context: { candidateAlias: 'candidate-0123456789ab', job: 冻结职位 },
      stages: 阶段区组('recruiter', 选项.问题ref ?? 'prompt_hr'),
      ...公共,
    };
  }
  return {
    role: 'candidate',
    context: { intentionId: 'int_0123456789abcdef0123456789abcdef', job: 冻结职位 },
    stages: 阶段区组('candidate', 选项.问题ref ?? 'prompt_1'),
    ...公共,
  };
}

function 正常视图(详情: P5详情): P5详情正常视图 {
  const 视图 = 映射P5详情(详情);
  if (视图.kind !== '正常') throw new Error('测试夹具必须是正常视图');
  return 视图;
}

/** 测试外置可控 promise：手动决定 settle 时机（回答 in-flight 夹具用）。 */
function 可控Promise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((ok) => {
    resolve = ok;
  });
  return { promise, resolve };
}

type 动作结果 = ReturnType<typeof use后端详情动作>;

function 取事实问题(result: { current: 动作结果 }): 事实问题属性 {
  const 问题 = result.current.事实问题;
  if (问题 === null) throw new Error('S0 夹具必须提供事实问题');
  return 问题;
}

function 取卡(result: { current: 动作结果 }, 键: string) {
  const 卡 = result.current.卡片们.find((条) => 条.键 === 键);
  if (卡 === undefined) throw new Error(`S0 夹具必须提供 ${键} 卡`);
  return 卡;
}

/** 挂 hook 的统一入口：回答在飞表由测试持有（模拟父级 route 实例），跨重挂载同一份。 */
function 挂动作(输入: 后端详情动作输入) {
  return renderHook((props: 后端详情动作输入) => use后端详情动作(props), { initialProps: 输入 });
}

/** 操作桩签名与 应用操作 对应方法同形（避免 vi.fn 推导宽类型过不了合同检查）。 */
type 回答事实桩 = (role: P5角色, caseId: string, promptId: string, response: string) => Promise<void>;
type 决定S0桩 = (caseId: string, action: 'continue' | 'end') => Promise<void>;

function 动作输入(选项: {
  详情: P5详情;
  回答在飞表: { current: Map<string, Promise<void>> };
  回答事实?: 回答事实桩;
  决定S0?: 决定S0桩;
}): 后端详情动作输入 {
  return {
    role: 选项.详情.role,
    caseId: 选项.详情.state.caseId,
    视图: 正常视图(选项.详情),
    详情: 选项.详情,
    操作: {
      回答事实: 选项.回答事实 ?? vi.fn(async (): Promise<void> => undefined),
      决定S0: 选项.决定S0 ?? vi.fn(async (): Promise<void> => undefined),
      决定S1: vi.fn(async (): Promise<void> => undefined),
      决定S2: vi.fn(async (): Promise<void> => undefined),
      决定S3: vi.fn(async (): Promise<void> => undefined),
      提交简历: vi.fn(async (): Promise<void> => undefined),
      准备候选委托简历: vi.fn(async (): Promise<null> => null),
    },
    回答在飞表: 选项.回答在飞表,
  };
}

describe('use后端详情动作 · respond_fact（回答补充问题）', () => {
  it('空回答零请求；提交键在场但守卫不发', async () => {
    const 回答事实 = vi.fn(async (): Promise<void> => undefined);
    const 回答在飞表 = { current: new Map<string, Promise<void>>() };
    const { result } = 挂动作(动作输入({ 详情: S0详情DTO(), 回答在飞表, 回答事实 }));
    await act(async () => {
      取事实问题(result).提交.执行?.();
    });
    expect(回答事实).not.toHaveBeenCalled();
  });

  it('命令参数逐项对照旧实现：role、caseId、当前 promptId 原值、trim 后回答原文', async () => {
    const 回答事实 = vi.fn(async (): Promise<void> => undefined);
    const 回答在飞表 = { current: new Map<string, Promise<void>>() };
    const { result } = 挂动作(动作输入({ 详情: S0详情DTO(), 回答在飞表, 回答事实 }));
    await act(async () => {
      取事实问题(result).改草稿('  每周可以到岗 3 天  ');
    });
    await act(async () => {
      取事实问题(result).提交.执行?.();
    });
    expect(回答事实).toHaveBeenCalledTimes(1);
    expect(回答事实).toHaveBeenCalledWith('candidate', 'mc_a', 'prompt_1', '每周可以到岗 3 天');
  });

  it('在飞期间提交键锁定为 提交中…（不可重发），锁账记在父级表里', async () => {
    const deferred = 可控Promise<void>();
    const 回答事实 = vi.fn(() => deferred.promise);
    const 回答在飞表 = { current: new Map<string, Promise<void>>() };
    const { result } = 挂动作(动作输入({ 详情: S0详情DTO(), 回答在飞表, 回答事实 }));
    await act(async () => {
      取事实问题(result).改草稿('第一段回答');
    });
    await act(async () => {
      取事实问题(result).提交.执行?.();
    });
    expect(回答在飞表.current.has('mc_a')).toBe(true); // 在飞期间锁在父级表里
    expect(取事实问题(result).提交.执行).toBeNull(); // 在飞：不可再发
    expect(取事实问题(result).提交.文案).toBe('提交中…');
    deferred.resolve();
    await waitFor(() => expect(回答在飞表.current.has('mc_a')).toBe(false)); // 收口自清
  });

  it('失败（503）保留草稿可继续编辑；成功才清空', async () => {
    const 回答事实 = vi.fn().mockRejectedValueOnce(new Error('503')).mockResolvedValue(undefined);
    const 回答在飞表 = { current: new Map<string, Promise<void>>() };
    const { result } = 挂动作(动作输入({ 详情: S0详情DTO(), 回答在飞表, 回答事实 }));
    await act(async () => {
      取事实问题(result).改草稿('保留这段回答');
    });
    await act(async () => {
      取事实问题(result).提交.执行?.();
    });
    await waitFor(() => expect(取事实问题(result).提交.执行).not.toBeNull());
    expect(取事实问题(result).草稿).toBe('保留这段回答'); // 失败绝不清空

    await act(async () => {
      取事实问题(result).改草稿('重试的回答');
    });
    await act(async () => {
      取事实问题(result).提交.执行?.();
    });
    await waitFor(() => expect(取事实问题(result).草稿).toBe('')); // 仅成功清空
  });
});

describe('use后端详情动作 · 回答在飞表生命周期', () => {
  it('动作区重挂载不丢在飞锁：同 Case 回来仍在飞，续锁且不能重发', async () => {
    const deferred = 可控Promise<void>();
    const 回答事实 = vi.fn(() => deferred.promise);
    const 回答在飞表 = { current: new Map<string, Promise<void>>() };
    const 一号 = 挂动作(动作输入({ 详情: S0详情DTO(), 回答在飞表, 回答事实 }));
    await act(async () => {
      取事实问题(一号.result).改草稿('第一段回答');
    });
    await act(async () => {
      取事实问题(一号.result).提交.执行?.();
    });
    一号.unmount(); // 动作区整体卸载（无动作单往返 / 段折叠）

    const 二号 = 挂动作(动作输入({ 详情: S0详情DTO(), 回答在飞表, 回答事实 }));
    const 问题 = 取事实问题(二号.result);
    expect(问题.草稿).toBe(''); // 新动作区干净起步
    expect(问题.提交.执行).toBeNull(); // 旧请求仍在飞：续锁，不得放行第二段草稿
    expect(问题.提交.文案).toBe('提交中…');

    deferred.resolve();
    await waitFor(() => expect(取事实问题(二号.result).提交.执行).not.toBeNull());
    expect(回答事实).toHaveBeenCalledTimes(1); // 往返全程只发过一次 POST
  });

  it('换 Case：旧单迟到的成功不改动新单草稿（代际栅栏），他单在飞不锁本单', async () => {
    const deferred = 可控Promise<void>();
    const 回答事实 = vi.fn(() => deferred.promise);
    const 回答在飞表 = { current: new Map<string, Promise<void>>() };
    const 单A = S0详情DTO({ caseId: 'mc_a' });
    const 单B = S0详情DTO({ caseId: 'mc_b' });
    const { result, rerender } = 挂动作(动作输入({ 详情: 单A, 回答在飞表, 回答事实 }));
    await act(async () => {
      取事实问题(result).改草稿('旧单回答');
    });
    await act(async () => {
      取事实问题(result).提交.执行?.();
    });
    expect(回答事实).toHaveBeenCalledWith('candidate', 'mc_a', 'prompt_1', '旧单回答');

    rerender(动作输入({ 详情: 单B, 回答在飞表, 回答事实 }));
    expect(取事实问题(result).草稿).toBe(''); // 换单清草稿
    expect(取事实问题(result).提交.执行).not.toBeNull(); // 他单在飞不锁本单
    await act(async () => {
      取事实问题(result).改草稿('新单草稿');
    });
    await act(async () => {
      deferred.resolve(); // 旧单此刻才落定
    });
    expect(取事实问题(result).草稿).toBe('新单草稿'); // 迟到清空被代际作废
  });
});

describe('use后端详情动作 · end_screening（结束初筛）', () => {
  it('保留原确认语义：确认前零请求，确认后 决定S0(caseId, end)，取消零请求', async () => {
    const 决定S0 = vi.fn(async (): Promise<void> => undefined);
    const 回答在飞表 = { current: new Map<string, Promise<void>>() };
    const { result } = 挂动作(动作输入({ 详情: S0详情DTO(), 回答在飞表, 决定S0 }));
    const 卡 = 取卡(result, 'end_screening');
    expect(卡.标题).toBe('结束初筛'); // 动作标题/说明保留
    expect(卡.说明).toBe('结束本次匿名初筛');
    const 键 = 卡.按钮们[0];
    if (键 === undefined) throw new Error('候选端结束卡必须有一个结束键');

    await act(async () => {
      键.执行?.();
    });
    expect(决定S0).not.toHaveBeenCalled(); // 未确认零请求
    const 确认 = result.current.终结确认;
    if (确认 === null) throw new Error('结束初筛必须先过二次确认');
    expect(确认.标题).toBe('结束本次匿名初筛？');
    expect(确认.正文).toBe('结束后这一单立即终止，无法恢复。');
    expect(确认.取消文).toBe('暂不结束');
    await act(async () => {
      确认.取消();
    });
    expect(result.current.终结确认).toBeNull();
    expect(决定S0).not.toHaveBeenCalled();

    await act(async () => {
      取卡(result, 'end_screening').按钮们[0]?.执行?.();
    });
    const 确认2 = result.current.终结确认;
    if (确认2 === null) throw new Error('二次确认应在场');
    await act(async () => {
      确认2.执行();
    });
    expect(决定S0).toHaveBeenCalledTimes(1);
    expect(决定S0).toHaveBeenCalledWith('mc_a', 'end');
    expect(result.current.终结确认).toBeNull(); // 确认即收层
  });

  it('招聘端结束卡零控件零请求（wire 缺 recruiter decisions 臂，fail closed）；回答卡双端仍可用', () => {
    const 决定S0 = vi.fn(async (): Promise<void> => undefined);
    const 回答在飞表 = { current: new Map<string, Promise<void>>() };
    const { result } = 挂动作(
      动作输入({ 详情: S0详情DTO({ role: 'recruiter', 问题ref: 'prompt_hr' }), 回答在飞表, 决定S0 }),
    );
    expect(取卡(result, 'end_screening').按钮们).toHaveLength(0); // 零控件
    expect(result.current.终结确认).toBeNull();
    expect(决定S0).not.toHaveBeenCalled();
    expect(result.current.事实问题).not.toBeNull(); // respond_fact 双端都有准许路线
    expect(result.current.事实问题?.问题).toBe('每周可以到岗几天？');
  });
});

describe('use后端详情动作 · 返回合同（Task 5 边界）', () => {
  it('S1 的 简历选择/披露确认 本 Task 恒 null（Task 6 迁入，合同不变）', () => {
    const 回答在飞表 = { current: new Map<string, Promise<void>>() };
    const { result } = 挂动作(动作输入({ 详情: S0详情DTO(), 回答在飞表 }));
    expect(result.current.简历选择).toBeNull();
    expect(result.current.披露确认).toBeNull();
  });

  it('卡片只来自映射交集：respond_fact 卡不带提交键（提交控件归 事实问题），顺序随 wire 枚举', () => {
    const 回答在飞表 = { current: new Map<string, Promise<void>>() };
    const { result } = 挂动作(动作输入({ 详情: S0详情DTO(), 回答在飞表 }));
    const 回答卡 = 取卡(result, 'respond_fact');
    expect(回答卡.标题).toBe('补充事实');
    expect(回答卡.说明).toBe('回答当前阶段待补充的问题');
    expect(回答卡.按钮们).toHaveLength(0); // 提交控件归 事实问题，不双挂载
    expect(result.current.卡片们.map((卡) => 卡.键)).toEqual(['respond_fact', 'end_screening']);
  });
});
