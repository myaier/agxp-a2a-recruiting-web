// MatchCase详情 · 连续委托（J-PILOT-01 候选连续承接 / pre-Case 及未知核对）
// 由 src/屏幕/P5/MatchCase详情.test.tsx 按冻结归属拆出：pre-Case 及未知核对→连续委托（J-PILOT-01 Task 5 候选连续承接）。

import {
  mock派发,
  mock返回,
  mock跳转,
  mock替换跳转,
  mock设置P5范围,
  mock读取详情,
  mock读取连续详情,
  mock重试连续记录,
  mock归档连续记录,
  mock新增叮嘱,
  mock读取简历PDF,
  mock应用状态,
  候选详情DTO,
  招聘详情DTO,
  详情快照,
  连续详情DTO,
  连续详情快照,
  置详情状态,
  渲染详情,
  测试地址行,
  测试换Case钮,
  S0完整记录详情,
  登记详情组件,
} from './MatchCase详情.测试辅助';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchCase详情 } from './MatchCase详情';
import userEvent from '@testing-library/user-event';

登记详情组件(MatchCase详情);

vi.mock('../../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../../路由/导航钩子', () => ({
  use导航: () => ({ 返回: mock返回, 跳转: mock跳转, 替换跳转: mock替换跳转 }),
}));

// ══ J-PILOT-01 Task 5：同一详情承接 pre-Case / Case / 封闭态（Spec §4/§6/§8）══
// 路由反例：空缓存打开 dlg 与 mc alias 的 canonical 归一替换（保留 tab query）、
// 同卡 pre-Case→Case 不重置 Tab 不加历史条目、pre-Case 复用外壳与失败动作、
// retention 清露出且停表、同 version 新消息整包替换、招聘端零 negotiation 读。

describe('MatchCase详情 · J-PILOT-01 Task 5 候选连续承接', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock返回.mockClear();
    mock跳转.mockClear();
    mock替换跳转.mockClear();
    mock设置P5范围.mockClear();
    mock读取详情.mockClear();
    mock读取连续详情.mockClear();
    mock重试连续记录.mockClear();
    mock归档连续记录.mockClear();
    mock新增叮嘱.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** 带地址行的候选路由：钉住 replace 后的地址与 query。 */
  function 渲染候选(地址: string) {
    return render(
      <MemoryRouter initialEntries={[地址]}>
        <测试地址行 />
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('dlg 直链（canonical 与 URL 一致）：照常聚合读，零地址替换（不加历史条目）', async () => {
    const 记录 = 'dlg_0123456789abcdef0123456789abcdef';
    置详情状态({
      role: 'candidate', caseId: 记录,
      连续快照: 连续详情快照({ 聚合: 连续详情DTO({ recordId: 记录, phase: 'evaluating', caseDetail: null }) }),
    });
    渲染候选(`/deal/${记录}`);
    expect(mock读取连续详情).toHaveBeenCalledWith(记录, true);
    expect(await screen.findByText('初评中')).toBeTruthy();
    expect(mock替换跳转).not.toHaveBeenCalled(); // canonical 即 URL：不推新历史格
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('mc 旧深链（URL 是别名）：GET 成功后按 canonical replace 地址，tab query 原样保留', async () => {
    const canonical = 'dlg_0123456789abcdef0123456789abcdef';
    // 状态层只按 canonical 落位（别名键槽不残留）：别名经返回 case_id 找到 canonical 内容
    置详情状态({
      role: 'candidate', caseId: 'mc_0123456789abcdef0123456789abcdef',
      连续快照: 连续详情快照({
        聚合: 连续详情DTO({ recordId: canonical, caseId: 'mc_0123456789abcdef0123456789abcdef', caseDetail: 候选详情DTO() }),
      }),
    });
    渲染候选('/deal/mc_0123456789abcdef0123456789abcdef?tab=job');
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy();
    expect(mock替换跳转).toHaveBeenCalledTimes(1);
    expect(mock替换跳转).toHaveBeenCalledWith(`/deal/${canonical}?tab=job`); // replace + 保留 query
    expect(mock跳转).not.toHaveBeenCalled(); // 绝不 push：不追加一次导航历史
  });

  // S0–S3 展示统一 Task 5（Spec §5.3）：首次挂载识别求职 ?tab=job；换 record 按新 query
  // 初始化（key 重挂载），不加导航历史。
  it('深链 ?tab=job 首开即资料 Tab；换 record（新地址无 query）回进度', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'candidate', caseId: 'dlg_a',
      连续快照: 连续详情快照({ 聚合: 连续详情DTO({ recordId: 'dlg_a', phase: 'evaluating', caseDetail: null }) }),
    });
    const 页 = render(
      <MemoryRouter initialEntries={['/deal/dlg_a?tab=job']}>
        <测试换Case钮 目标="/deal/dlg_b" 文案="切到新单" />
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>,
    );
    // 首次挂载识别 ?tab=job：直开资料 Tab，进度槽（S0 信息区/四灰条）不挂载
    expect(await screen.findByText('当前在谈详情数据未提供')).toBeTruthy();
    expect(screen.queryByText('初评中')).toBeNull();
    expect(screen.queryByText('未开始')).toBeNull();

    // 换 record：key 重挂载按新 query 初始化 —— 新地址没有 tab query，回进度
    置详情状态({
      role: 'candidate', caseId: 'dlg_b',
      连续快照: 连续详情快照({ 聚合: 连续详情DTO({ recordId: 'dlg_b', phase: 'evaluating', caseDetail: null }) }),
    });
    await user.click(screen.getByRole('button', { name: '切到新单' }));
    expect(await screen.findByText('初评中')).toBeTruthy(); // 进度槽回来了
    页.unmount();
  });

  it('同卡 pre-Case→Case：轮询开案只是联合切换 —— Tab 不跳、零导航、零历史条目', async () => {
    const user = userEvent.setup();
    const 记录 = 'dlg_0123456789abcdef0123456789abcdef';
    置详情状态({
      role: 'candidate', caseId: 记录,
      连续快照: 连续详情快照({ 聚合: 连续详情DTO({ recordId: 记录, phase: 'evaluating', caseDetail: null }) }),
    });
    const 页 = 渲染候选(`/deal/${记录}`);
    expect(await screen.findByText('初评中')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '职位详情' }));
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy(); // 切到资料 Tab

    // 同一 canonical 记录开案（phase → case_started，case_detail 到场）：Tab 仍是 资料
    置详情状态({
      role: 'candidate', caseId: 记录,
      连续快照: 连续详情快照({
        聚合: 连续详情DTO({ recordId: 记录, caseId: 'mc_0123456789abcdef0123456789abcdef', caseDetail: 候选详情DTO() }),
      }),
    });
    页.rerender(
      <MemoryRouter initialEntries={[`/deal/${记录}`]}>
        <测试地址行 />
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy(); // Tab 未被重置回进度
    expect(mock替换跳转).not.toHaveBeenCalled(); // 同卡开案不推历史
    expect(mock跳转).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '代谈进度' }));
    expect(screen.getByText('每周可以到岗几天？')).toBeTruthy(); // Case 四阶段流照常
    页.unmount();
  });

  it('pre-Case 失败：重试/归档仅权威允许时经原动作卡出键；归档过现有确认层，取消零请求', async () => {
    const user = userEvent.setup();
    const 记录 = 'dlg_0123456789abcdef0123456789abcdef';
    置详情状态({
      role: 'candidate', caseId: 记录,
      连续快照: 连续详情快照({
        聚合: 连续详情DTO({
          recordId: 记录, phase: 'evaluation_failed', caseDetail: null,
          failure: { code: 'delegation_agent_unavailable', retryable: true },
          actions: { retry: true, archive: true },
        }),
      }),
    });
    const 页 = 渲染候选(`/deal/${记录}`);
    // 动作卡标题与底栏禁用说明同词（初评未完成）；J-PILOT-01 后禁用条是原控件，文案在 placeholder
    expect(await screen.findAllByText('公开信息初评未完成')).toHaveLength(1);
    expect((await screen.findByPlaceholderText('公开信息初评未完成') as HTMLTextAreaElement).disabled).toBe(true);
    // 失败原因闭表文案：状态区注意说明 + 动作卡说明各一处（同词两处，非重复渲染）
    expect(screen.getAllByText('AI 服务暂时不可用，本次没有创建 Case')).toHaveLength(2);
    // 底栏禁用条：不冒充初评仍在运行；发送键真实禁用（零 Case 叮嘱输入）
    expect(screen.queryByText('AI 代理正在进行公开信息初评')).toBeNull();
    expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(true);

    // 重试：真实受理（控制层只调状态方法，重试受理后的真实状态由权威重读投影）
    await user.click(screen.getByRole('button', { name: '重试初评' }));
    expect(mock重试连续记录).toHaveBeenCalledTimes(1);
    expect(mock重试连续记录).toHaveBeenCalledWith(记录);
    expect(mock新增叮嘱).not.toHaveBeenCalled(); // pre-Case 零 Case 叮嘱请求

    // 归档：先过现有确认层（移入历史，不是取消），取消零请求、确认才发
    await user.click(screen.getByRole('button', { name: '归档' }));
    const 确认 = await screen.findByRole('dialog', { name: '归档这条记录？' });
    expect(within(确认).getByText('移入历史，不是取消')).toBeTruthy();
    expect(mock归档连续记录).not.toHaveBeenCalled();
    await user.click(within(确认).getByRole('button', { name: '取消' }));
    expect(mock归档连续记录).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '归档' }));
    await user.click(within(await screen.findByRole('dialog', { name: '归档这条记录？' }))
      .getByRole('button', { name: '归档' }));
    expect(mock归档连续记录).toHaveBeenCalledTimes(1);
    expect(mock归档连续记录).toHaveBeenCalledWith(记录);
    页.unmount();
  });

  it('retention 封闭（有 case_id 但 case_detail=null）：清旧 Case 内容、只显示记录状态、停表零补全 GET', async () => {
    vi.useFakeTimers();
    const 记录 = 'dlg_0123456789abcdef0123456789abcdef';
    置详情状态({
      role: 'candidate', caseId: 记录,
      连续快照: 连续详情快照({
        聚合: 连续详情DTO({
          recordId: 记录, phase: 'case_started',
          caseId: 'mc_0123456789abcdef0123456789abcdef', caseDetail: null, shelf: 'history',
        }),
      }),
    });
    const 页 = 渲染候选(`/deal/${记录}`);
    expect(screen.getByText('暂时无法确认进度，请稍后刷新')).toBeTruthy(); // 合同允许的记录状态
    expect(screen.getByText('轮次 —')).toBeTruthy(); // 无轮次不造 0/3
    expect(screen.getByText('当前在谈已结束，仅可查看')).toBeTruthy(); // 底栏只读
    // 旧 Case 内容清露出：四阶段全部未到达灰条，无对话/动作/附件入口
    expect(screen.queryByRole('button', { name: '发送' })).toBeNull();
    expect(screen.queryByRole('button', { name: '重试初评' })).toBeNull(); // retention 不出失败动作
    ['匿名初筛', '递交简历', '需要协调', '意向确认'].forEach((名) => {
      expect(screen.getAllByText(名).length).toBeGreaterThan(0);
    });
    await act(() => vi.advanceTimersByTimeAsync(7000));
    expect(mock读取连续详情).toHaveBeenCalledTimes(1); // 封闭无自动推进：停表
    expect(mock读取详情).not.toHaveBeenCalled(); // 不发补全 GET（不回退独立 Case 读）
    expect(mock读取简历PDF).not.toHaveBeenCalled(); // 不经附件库找回封闭资料
    页.unmount();
  });

  it('同 version 新消息：整包替换后新问答在场且不重复（不 append、不丢新消息）', async () => {
    const 记录 = 'dlg_0123456789abcdef0123456789abcdef';
    const 底 = S0完整记录详情('candidate');
    置详情状态({
      role: 'candidate', caseId: 记录,
      连续快照: 连续详情快照({ 聚合: 连续详情DTO({ recordId: 记录, caseDetail: 底 }) }),
    });
    const 页 = 渲染候选(`/deal/${记录}`);
    expect(await screen.findByText('需要确认岗位的值班安排。')).toBeTruthy();
    expect(screen.getAllByText('需要确认岗位的值班安排。').length).toBe(1);

    // 轮询整包替换：同一条记录的 S0 screening records 多了一对新问答 —— 旧的还在、新的出现一次
    const 底详情 = S0完整记录详情('candidate');
    const 新 = {
      ...底详情,
      stages: 底详情.stages.map((区) =>
        区.stage === 'anonymous_screening' && 区.screeningRecords !== null
          ? {
            ...区,
            screeningRecords: {
              messages: [
                ...区.screeningRecords.messages,
                {
                  id: 's0q_5', kind: 'question' as const, role: 'candidate' as const,
                  stage: 'anonymous_screening' as const, askingRole: 'candidate' as const, round: 5,
                  text: '到岗时间能接受节假日轮班吗？', exchangeRef: null,
                  occurredAt: '2026-08-30T09:50:00Z',
                },
              ],
              summaries: 区.screeningRecords.summaries,
            },
          }
          : 区,
      ),
    };
    置详情状态({
      role: 'candidate', caseId: 记录,
      连续快照: 连续详情快照({ 聚合: 连续详情DTO({ recordId: 记录, caseDetail: 新 }) }),
    });
    页.rerender(
      <MemoryRouter initialEntries={[`/deal/${记录}`]}>
        <测试地址行 />
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('到岗时间能接受节假日轮班吗？')).toBeTruthy(); // 新消息在场
    expect(screen.getAllByText('需要确认岗位的值班安排。').length).toBe(1); // 旧消息不重复
    页.unmount();
  });

  it('招聘端零 negotiation 读：仍走 Case 读取，无公开初评托盘', async () => {
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: 招聘详情DTO() }) });
    渲染详情('recruiter', 'mc_hr');
    expect(await screen.findByTitle('匹配分缺失')).toBeTruthy();
    expect(mock读取详情).toHaveBeenCalledWith('recruiter', 'mc_hr', true);
    expect(mock读取连续详情).not.toHaveBeenCalled(); // 招聘无公开初评请求（零 negotiation）
    expect(mock重试连续记录).not.toHaveBeenCalled();
    expect(mock归档连续记录).not.toHaveBeenCalled();
    expect(screen.queryByText('公开信息初评')).toBeNull(); // 无托盘
  });
});
