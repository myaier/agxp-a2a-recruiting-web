// MatchCase详情 · 阶段动作（叮嘱 / S0–S3 命令 / 控制收口）
// 由 src/屏幕/P5/MatchCase详情.test.tsx 按冻结归属拆出：叮嘱/S0–S3 命令→阶段动作；消歧：「控制收口（Task 9）」整个 describe→阶段动作。

import {
  mock派发,
  mock返回,
  mock跳转,
  mock替换跳转,
  mock设置P5范围,
  mock读取详情,
  mock读取连续详情,
  mock新增叮嘱,
  mock加载工作区,
  mock刷新工作区,
  mock回答事实,
  mock决定S0,
  mock决定S1,
  mock决定S2,
  mock决定S3,
  mock提交简历,
  mock读取简历PDF,
  mock准备候选委托简历,
  mock应用状态,
  叮嘱占位,
  状态,
  阶段区组,
  候选详情DTO,
  候选S1详情DTO,
  招聘详情DTO,
  已终止详情DTO,
  详情快照,
  连续详情DTO,
  连续详情快照,
  置详情状态,
  渲染详情,
  测试换Case钮,
  协同问题ID,
  绑定附件,
  填充十六,
  附件库样本,
  S0邀请详情,
  S1等待详情,
  S1更换详情,
  S1初筛详情,
  S2详情,
  S3详情,
  已完成移交详情DTO,
  设应用状态,
  S1完整记录详情,
  清空轻提示,
  登记详情组件,
} from './MatchCase详情.测试辅助';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchCase详情 } from './MatchCase详情';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { 路径 } from '../../路由/路径表';
import { P5契约错误提示 } from '../../数据/MatchCase展示映射';
import userEvent from '@testing-library/user-event';

登记详情组件(MatchCase详情);

vi.mock('../../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../../路由/导航钩子', () => ({
  use导航: () => ({ 返回: mock返回, 跳转: mock跳转, 替换跳转: mock替换跳转 }),
}));

describe('MatchCase详情 · Case 叮嘱输入', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock返回.mockClear();
    mock设置P5范围.mockClear();
    mock读取详情.mockClear();
    mock加载工作区.mockClear();
    mock刷新工作区.mockClear();
    // clearMocks 只清调用记录不清实现：逐测试重置 新增叮嘱 的桩实现，默认按成功收口
    mock新增叮嘱.mockReset();
    mock新增叮嘱.mockImplementation(async () => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('提交等待服务器：无乐观气泡/无本地派发，成功才清空，重读归操作层（候选端）', async () => {
    const user = userEvent.setup();
    let 送达!: () => void;
    mock新增叮嘱.mockImplementation(
      () => new Promise<void>((解决) => { 送达 = 解决; }));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选S1详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    const 框 = screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement;
    await user.type(框, '周五也可以到岗');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(mock新增叮嘱).toHaveBeenCalledTimes(1);
    expect(mock新增叮嘱).toHaveBeenCalledWith('candidate', 'mc_direct', '周五也可以到岗');
    // 在途：草稿未清、无乐观气泡（jsdom 会把 textarea 值镜像进 DOM —— 该文本允许
    // 只出现在输入框里，任何非输入框元素出现即算乐观气泡）、无本地归约
    expect(框.value).toBe('周五也可以到岗');
    expect(screen.getAllByText('周五也可以到岗').every((元) => 元.tagName === 'TEXTAREA')).toBe(true);
    expect(mock派发).not.toHaveBeenCalled();
    expect(mock读取连续详情).toHaveBeenCalledTimes(1); // 仍是挂载那次：不自己重读
    送达();
    await waitFor(() => expect(框.value).toBe('')); // 仅成功清空
    expect(mock读取连续详情).toHaveBeenCalledTimes(1); // 权威重读归 Task 3 操作层
  });

  it('招聘端同构：role/case_id 原样透传给 新增叮嘱', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'recruiter', caseId: 'mc_hr',
      快照: 详情快照({
        detail: 招聘详情DTO({
          state: 状态({ caseId: 'mc_hr', stage: 'resume_submission', status: 'waiting', step: 'awaiting_resume_parse', needsUser: false, round: 0 }),
          needsAction: false,
          availableActions: [],
          stages: [
            { ...阶段区组()[0]!, state: 'passed', summary: 'complete', transcript: [], instructionReceipts: [] },
            { ...阶段区组()[1]!, state: 'active', occurredAt: '2026-08-29T01:30:00Z', summary: 'awaiting_resume_parse' },
            ...阶段区组().slice(2),
          ],
        }),
      }),
    });
    渲染详情('recruiter', 'mc_hr');
    const 框 = screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement;
    await user.type(框, '优先看 Go 背景');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(mock新增叮嘱).toHaveBeenCalledWith('recruiter', 'mc_hr', '优先看 Go 背景');
    await waitFor(() => expect(框.value).toBe(''));
  });

  it('发送失败保留草稿（不清空、不乐观）', async () => {
    const user = userEvent.setup();
    mock新增叮嘱.mockImplementation(async () => {
      throw new Error('网络错误');
    });
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选S1详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    const 框 = screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement;
    await user.type(框, '周五也可以到岗');
    await user.click(screen.getByRole('button', { name: '发送' }));
    await waitFor(() => expect(mock新增叮嘱).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(框.value).toBe('周五也可以到岗')); // 失败绝不清空
    expect(mock派发).not.toHaveBeenCalled(); // 也不落任何本地规则/气泡
  });

  it('空输入不发送', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(mock新增叮嘱).not.toHaveBeenCalled();
  });

  it('终局详情隐藏输入（无任何 mutation 控件；J-PILOT-01 S0 终局占位成对产出）', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 已终止详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    // 终局段胶囊与原因都是中文字典词（wire 原词不再出现在屏上）
    expect(await screen.findAllByText('已结束')).toBeTruthy();
    expect(document.body.textContent).not.toContain('user_ended');
    // S0 终局：原输入框保留但禁用，占位为 Spec §7 其它终局文案（发送键真实禁用）
    const 框 = screen.getByPlaceholderText('本次代谈已结束') as HTMLTextAreaElement;
    expect(框.disabled).toBe(true);
    expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('MatchCase详情 · S0/S1 动作（Task 6）', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock回答事实.mockClear();
    mock决定S0.mockClear();
    mock决定S1.mockClear();
    mock提交简历.mockClear();
    mock准备候选委托简历.mockClear();
    mock跳转.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('S0 respond_fact 零输入（路由级）：无回答框/提交键，零人工补事实请求；待核实说明在场', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    // J-PILOT-01（Spec §7）：S0 不再提供 respond_fact 输入/提交 —— 白名单摘除后零回答区；
    // review-r1 起旧 S0 needs_user/human_decision 行的 end_screening 也停（停止该卡交互），
    // 只剩 待核实说明 与禁用输入
    expect(await screen.findByText('旧版状态待核实，请交负责人处理')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: '回答问题' })).toBeNull();
    expect(screen.queryByRole('button', { name: '提交回答' })).toBeNull();
    expect(screen.queryByText('补充事实')).toBeNull();
    expect(screen.queryByRole('button', { name: '结束初筛' })).toBeNull();
    expect(mock回答事实).not.toHaveBeenCalled(); // 双端 S0 零人工补事实请求
  });

  it('多条补充问题（遗留 transcript）不再破坏契约：respond_fact 已不可达，回答控件一概不出', async () => {
    const 双问阶段 = 阶段区组({
      anonymous_screening: {
        transcript: [
          {
            eventId: 'evt_q1', stage: 'anonymous_screening', kind: 'supplementary_question',
            role: 'candidate', ref: 'prompt_1', text: '每周可以到岗几天？', occurredAt: '2026-08-29T01:10:00Z',
          },
          {
            eventId: 'evt_q2', stage: 'anonymous_screening', kind: 'supplementary_question',
            role: 'candidate', ref: 'prompt_2', text: '期望薪资是多少？', occurredAt: '2026-08-29T01:11:00Z',
          },
        ],
      },
    });
    置详情状态({
      role: 'candidate',
      快照: 详情快照({ detail: 候选详情DTO({ stages: 双问阶段 }) }),
    });
    渲染详情('candidate', 'mc_direct');
    // 补充问题接入已随 respond_fact 移除：多问不再是整页契约错误。
    // review-r2 F1：supplementary_question 属结构化问答种类 —— 正文只以 screening
    // records 正式问答显示一次，不再重复为系统注释（第二条遗留问题不显示）
    expect((await screen.findAllByText('每周可以到岗几天？')).length).toBe(1);
    expect(screen.queryByText('期望薪资是多少？')).toBeNull();
    expect(screen.queryByText(P5契约错误提示)).toBeNull();
    expect(screen.queryByRole('textbox', { name: '回答问题' })).toBeNull();
    expect(screen.queryByRole('button', { name: '提交回答' })).toBeNull();
    expect(mock回答事实).not.toHaveBeenCalled();
  });

  it('S0 respond_fact 零输入：无补充事实卡/回答框，旧 S0 行给待核实说明', () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    // J-PILOT-01（Spec §7）：S0 不再提供 respond_fact 输入/提交 —— 白名单摘除后无卡
    expect(screen.queryByRole('textbox', { name: '回答问题' })).toBeNull();
    expect(screen.queryByRole('button', { name: '提交回答' })).toBeNull();
    expect(screen.queryByText('补充事实')).toBeNull();
    // 待核实说明（注意说明）在场；review-r1 起该行的 end_screening 卡也停（停止该卡交互）
    expect(screen.getByText('旧版状态待核实，请交负责人处理')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '结束初筛' })).toBeNull();
    expect(screen.queryByText('结束本次匿名初筛')).toBeNull();
  });

  it('旧 S0 needs_user 行携带 respond_fact/end_screening：无任何动作卡，零请求（Spec §7 停止该卡交互）', async () => {
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({ availableActions: ['respond_fact', 'end_screening'] }),
      }),
    });
    渲染详情('candidate', 'mc_direct');

    // 「继续初筛」是前端自造的未授权动作：任何形态都不出现（spec §10.1）；
    // respond_fact 也不再出任何输入控件（J-PILOT-01，Spec §7）；
    // review-r1：end_screening 随旧 S0 行停止交互一并摘除 —— 决定S0 在该行零调用
    //（既有 end 路径由 S0 passed 行的婉拒邀请承接）
    expect(screen.queryByRole('button', { name: '继续初筛' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: '回答问题' })).toBeNull();
    expect(screen.queryByRole('button', { name: '结束初筛' })).toBeNull();
    expect(mock决定S0).not.toHaveBeenCalled();
    expect(mock回答事实).not.toHaveBeenCalled();
  });

  it('end_screening（招聘）：wire 缺 recruiter decisions 臂 → 零控件零请求（fail closed，后端缺口观察）', async () => {
    置详情状态({
      role: 'recruiter', caseId: 'mc_hr',
      快照: 详情快照({
        detail: 招聘详情DTO({
          state: 状态({ caseId: 'mc_hr', stage: 'anonymous_screening', status: 'needs_user', step: 'human_decision' }),
          needsAction: true,
          availableActions: ['respond_fact', 'end_screening'],
          stages: 阶段区组({
            anonymous_screening: {
              transcript: [{
                eventId: 'evt_q9', stage: 'anonymous_screening', kind: 'supplementary_question',
                role: 'recruiter', ref: 'prompt_hr', text: '这个岗位要求到岗时间？', occurredAt: '2026-08-29T01:10:00Z',
              }],
            },
          }),
        }),
      }),
    });
    渲染详情('recruiter', 'mc_hr');
    // J-PILOT-01：招聘端 S0 同样无 respond_fact 回答区（双端零人工补事实输入）
    expect(screen.queryByRole('textbox', { name: '回答问题' })).toBeNull();
    // 投影器会给 needs_user 属主发 end_screening，但冻结 wire 的 decisions 路线只有
    // 候选端 /me 臂 —— 招聘端结束卡零控件、零请求（fail closed，待后端补 recruiter 臂）
    expect(screen.queryByRole('button', { name: '继续初筛' })).toBeNull();
    expect(screen.queryByRole('button', { name: '结束初筛' })).toBeNull();
    expect(mock决定S0).not.toHaveBeenCalled();
    expect(mock提交简历).not.toHaveBeenCalled();
    expect(mock决定S1).not.toHaveBeenCalled();
    expect(mock准备候选委托简历).not.toHaveBeenCalled();
    expect(mock读取简历PDF).not.toHaveBeenCalled();
  });

  it('接受简历邀请：单选 → Case 专属披露确认点名所选 PDF → 字面 true；取消零请求', async () => {
    const user = userEvent.setup();
    mock准备候选委托简历.mockResolvedValue(附件库样本(2));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0邀请详情() }) });
    渲染详情('candidate', 'mc_direct');
    // Task 4 起 passed 段默认折叠：权威动作须展开该段到达（可展开访问，不以已通过隐藏）
    await user.click(screen.getByRole('button', { name: /匿名初筛/ }));
    await user.click(screen.getByRole('button', { name: '接受邀请' }));
    // 单选层：多份附件必须当场单选一份（S1 递交口径的文案）
    const 选择框 = await screen.findByRole('dialog');
    expect(within(选择框).getByText(/本次 Case 是「平台工程师」/)).toBeTruthy();
    await user.click(within(选择框).getByRole('radio', { name: /简历_v2\.pdf/ }));
    await user.click(within(选择框).getByRole('button', { name: '选定这份' }));
    // 披露确认：正文点名冻结职位（Case 上下文）与这次递交哪份 PDF，说清递交即披露
    const 披露框 = screen.getByRole('dialog');
    expect(within(披露框).getByText(/「平台工程师」这一 Case 递交「简历_v2\.pdf」/)).toBeTruthy();
    expect(within(披露框).getByText(/仅对这一次递交生效/)).toBeTruthy();
    await user.click(within(披露框).getByRole('button', { name: '暂不递交' })); // 取消：零请求
    expect(mock提交简历).not.toHaveBeenCalled();
    // 再来一次：选择与披露都重新走，不复用上一次的授权
    await user.click(screen.getByRole('button', { name: '接受邀请' }));
    const 再选 = await screen.findByRole('dialog');
    await user.click(within(再选).getByRole('radio', { name: /简历_v1\.pdf/ }));
    await user.click(within(再选).getByRole('button', { name: '选定这份' }));
    const 再披露 = screen.getByRole('dialog');
    expect(within(再披露).getByText(/简历_v1\.pdf/)).toBeTruthy(); // 点名的是这次选的
    await user.click(within(再披露).getByRole('button', { name: '确认递交' }));
    expect(mock提交简历).toHaveBeenCalledTimes(1);
    expect(mock提交简历).toHaveBeenCalledWith('mc_direct', `rf_${填充十六(1)}`, `rfv_${填充十六(1)}`, true);
    expect(mock准备候选委托简历).toHaveBeenCalledTimes(2); // 每次尝试都重跑权威库读取
    expect(mock决定S0).not.toHaveBeenCalled();
  });

  it('接受简历邀请：单份附件直达披露确认（仍点名该 PDF 与职位）', async () => {
    const user = userEvent.setup();
    mock准备候选委托简历.mockResolvedValue(附件库样本(1));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0邀请详情() }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: /匿名初筛/ })); // passed 段默认折叠
    await user.click(screen.getByRole('button', { name: '接受邀请' }));
    const 披露框 = await screen.findByRole('dialog');
    expect(within(披露框).getByText(/「平台工程师」这一 Case 递交「简历_v1\.pdf」/)).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /简历_v1\.pdf/ })).toBeNull(); // 单份不再过单选层
    await user.click(within(披露框).getByRole('button', { name: '确认递交' }));
    expect(mock提交简历).toHaveBeenCalledWith('mc_direct', `rf_${填充十六(1)}`, `rfv_${填充十六(1)}`, true);
  });

  it('婉拒简历邀请 = 决定S0 end（服务端唯一准许路线，e2e J2 同款）；确认前零请求', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0邀请详情() }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: /匿名初筛/ })); // passed 段默认折叠
    await user.click(screen.getByRole('button', { name: '婉拒邀请' }));
    const 确认框 = screen.getByRole('dialog');
    expect(within(确认框).getByText(/不会向该招聘方披露你的简历/)).toBeTruthy();
    await user.click(within(确认框).getByRole('button', { name: '婉拒邀请' }));
    expect(mock决定S0).toHaveBeenCalledTimes(1);
    expect(mock决定S0).toHaveBeenCalledWith('mc_direct', 'end');
    expect(mock提交简历).not.toHaveBeenCalled(); // 婉拒绝不携带简历
  });

  it('附件库为空：提示去上传并跳转，零提交请求；null（会话/角色换代）静默返回', async () => {
    const user = userEvent.setup();
    mock准备候选委托简历.mockResolvedValue(附件库样本(0));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0邀请详情() }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: /匿名初筛/ })); // passed 段默认折叠
    await user.click(screen.getByRole('button', { name: '接受邀请' }));
    await waitFor(() => expect(mock跳转).toHaveBeenCalledWith(路径.我的简历));
    expect(screen.getByText('请先上传一份 PDF 简历')).toBeTruthy();
    expect(mock提交简历).not.toHaveBeenCalled();

    cleanup();
    mock准备候选委托简历.mockResolvedValue(null); // null 不是空库：静默返回，绝不去上传
    mock准备候选委托简历.mockClear();
    mock跳转.mockClear();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0邀请详情() }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: /匿名初筛/ })); // passed 段默认折叠
    await user.click(screen.getByRole('button', { name: '接受邀请' }));
    await waitFor(() => expect(mock准备候选委托简历).toHaveBeenCalledTimes(1));
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock提交简历).not.toHaveBeenCalled();
  });

  it('S1 重试（原授权检查）：用阶段中原绑定 file/version 对直接提交字面 true，不重新展示披露确认', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(true) }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: '重试校验' }));
    // J-PILOT-01（Spec §9）：不重新选文件、不重新要求披露确认 —— 原授权直接执行
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mock提交简历).toHaveBeenCalledTimes(1);
    expect(mock提交简历).toHaveBeenCalledWith(
      'mc_direct', 绑定附件.fileId, 绑定附件.fileVersionId, true);
  });

  it('S1 重试无 typed 附件：零控件零请求（fail closed，绝不猜坐标）', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(false) }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('重试简历校验')).toBeTruthy(); // 卡框架仍在（映射交集）
    expect(screen.queryByRole('button', { name: '重试校验' })).toBeNull(); // 无坐标即无控件
    expect(mock提交简历).not.toHaveBeenCalled();
  });

  it('S1 更换简历：同一单选 + 披露栅栏，第二份不复用第一份授权', async () => {
    const user = userEvent.setup();
    mock准备候选委托简历.mockResolvedValue(附件库样本(2));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1更换详情() }) });
    渲染详情('candidate', 'mc_direct');
    // 第一次：选 v2 后在披露层取消
    await user.click(screen.getByRole('button', { name: '更换简历' }));
    const 选择框 = await screen.findByRole('dialog');
    await user.click(within(选择框).getByRole('radio', { name: /简历_v2\.pdf/ }));
    await user.click(within(选择框).getByRole('button', { name: '选定这份' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '暂不递交' }));
    expect(mock提交简历).not.toHaveBeenCalled();
    // 第二次：改选 v1，确认递交 —— 发出去的恰是这次选的对
    await user.click(screen.getByRole('button', { name: '更换简历' }));
    const 再选 = await screen.findByRole('dialog');
    await user.click(within(再选).getByRole('radio', { name: /简历_v1\.pdf/ }));
    await user.click(within(再选).getByRole('button', { name: '选定这份' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认递交' }));
    expect(mock提交简历).toHaveBeenCalledTimes(1);
    expect(mock提交简历).toHaveBeenCalledWith('mc_direct', `rf_${填充十六(1)}`, `rfv_${填充十六(1)}`, true);
  });

  it('S1 初筛结论（招聘）：continue|not_fit 精确调用，not_fit 过二次确认', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1初筛详情(false) }) });
    渲染详情('recruiter', 'mc_hr');
    await user.click(screen.getByRole('button', { name: '通过初筛' }));
    expect(mock决定S1).toHaveBeenCalledTimes(1);
    expect(mock决定S1).toHaveBeenCalledWith('mc_hr', 'continue');
    await user.click(screen.getByRole('button', { name: '不合适' }));
    const 确认框 = screen.getByRole('dialog');
    await user.click(within(确认框).getByRole('button', { name: '确认不合适' }));
    expect(mock决定S1).toHaveBeenCalledTimes(2);
    expect(mock决定S1).toHaveBeenLastCalledWith('mc_hr', 'not_fit');
  });

  it('行白名单外的动作词不渲染（映射交集）：needs_user 行给邀请词也不出卡、零请求', async () => {
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          needsAction: true,
          availableActions: ['accept_resume_invitation', 'decline_resume_invitation'],
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    // 顶部状态条退场：当前段胶囊走 A.2.1 口径（v1 needs_action → 需要你），邀请二卡仍被行白名单挡下
    expect(await screen.findByText('需要你')).toBeTruthy();
    expect(screen.queryByText('接受简历邀请')).toBeNull(); // S0 needs_user 行白名单不含邀请二卡
    expect(screen.queryByRole('button', { name: '接受邀请' })).toBeNull();
    expect(screen.queryByRole('button', { name: '婉拒邀请' })).toBeNull();
    expect(mock提交简历).not.toHaveBeenCalled();
    expect(mock决定S0).not.toHaveBeenCalled();
    expect(mock准备候选委托简历).not.toHaveBeenCalled();
  });
});

describe('MatchCase详情 · S2/S3 动作（Task 6）', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock决定S1.mockClear();
    mock决定S2.mockClear();
    mock决定S3.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('S2（候选）：接受/拒绝带精确 issueId（typed 协同块）', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: S2详情('candidate', {
          issueId: 协同问题ID, kind: 'work_mode', requiredRoles: ['candidate', 'recruiter'],
          candidateDecided: false, recruiterDecided: false,
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: '接受' }));
    expect(mock决定S2).toHaveBeenCalledTimes(1);
    expect(mock决定S2).toHaveBeenCalledWith('candidate', 'mc_direct', 协同问题ID, 'accept');
    await user.click(screen.getByRole('button', { name: '拒绝' }));
    expect(mock决定S2).toHaveBeenCalledTimes(2);
    expect(mock决定S2).toHaveBeenLastCalledWith('candidate', 'mc_direct', 协同问题ID, 'reject');
  });

  it('S2（招聘）：同 issueId 独立表态', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'recruiter', caseId: 'mc_hr',
      快照: 详情快照({
        detail: S2详情('recruiter', {
          issueId: 协同问题ID, kind: 'work_schedule', requiredRoles: ['candidate', 'recruiter'],
          candidateDecided: true, recruiterDecided: false,
        }),
      }),
    });
    渲染详情('recruiter', 'mc_hr');
    await user.click(screen.getByRole('button', { name: '拒绝' }));
    expect(mock决定S2).toHaveBeenCalledWith('recruiter', 'mc_hr', 协同问题ID, 'reject');
  });

  it('S2：非必需角色 / 本端已决 → 等待态零控件零请求', async () => {
    // 本端（候选）不在必需名单：卡虽在映射交集里，typed 事实不给控件
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: S2详情('candidate', {
          issueId: 协同问题ID, kind: 'travel', requiredRoles: ['recruiter'],
          candidateDecided: false, recruiterDecided: false,
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('回应协同事项')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '接受' })).toBeNull();
    expect(screen.queryByRole('button', { name: '拒绝' })).toBeNull();
    expect(mock决定S2).not.toHaveBeenCalled();

    cleanup();
    // 本端已决：服务端形态是 waiting 行 + 空动作表（needs_action 与动作表精确耦合）
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          state: 状态({
            stage: 'needs_coordination', status: 'waiting',
            step: 'awaiting_recruiter_decision', needsUser: false,
          }),
          needsAction: false,
          availableActions: [],
          stages: 阶段区组({
            anonymous_screening: { state: 'passed', summary: '匿名初筛已通过' },
            resume_submission: { state: 'passed', summary: '简历初筛已通过' },
            needs_coordination: { state: 'active', summary: '本端已表态，等待对方' },
          }),
          currentCoordination: {
            issueId: 协同问题ID, kind: 'work_mode', requiredRoles: ['candidate', 'recruiter'],
            candidateDecided: true, recruiterDecided: false,
          },
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText('等待招聘方决定')).toBeTruthy(); // 等待态来自 17 词闭表
    expect(screen.queryByRole('button', { name: '接受' })).toBeNull();
    expect(screen.queryByRole('button', { name: '拒绝' })).toBeNull();
    expect(mock决定S2).not.toHaveBeenCalled();
  });

  it('S2：卡在场但 currentCoordination 缺席 → fail closed 零请求', async () => {
    置详情状态({
      role: 'candidate',
      快照: 详情快照({ detail: S2详情('candidate', null) }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('回应协同事项')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '接受' })).toBeNull();
    expect(screen.queryByRole('button', { name: '拒绝' })).toBeNull();
    expect(mock决定S2).not.toHaveBeenCalled();
  });

  it('S3：双端独立确认/婉拒 → 决定S3 confirm|decline', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'candidate',
      快照: 详情快照({ detail: S3详情('candidate', { candidate: '', recruiter: '' }) }),
    });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: '确认意向' }));
    expect(mock决定S3).toHaveBeenCalledWith('candidate', 'mc_direct', 'confirm');
    await user.click(screen.getByRole('button', { name: '婉拒意向' }));
    expect(mock决定S3).toHaveBeenLastCalledWith('candidate', 'mc_direct', 'decline');

    cleanup();
    置详情状态({
      role: 'recruiter', caseId: 'mc_hr',
      快照: 详情快照({
        detail: S3详情('recruiter', { candidate: 'confirm', recruiter: '' }, ['confirm_intent', 'decline_intent'], 'awaiting_recruiter_confirmation'),
      }),
    });
    渲染详情('recruiter', 'mc_hr');
    await user.click(screen.getByRole('button', { name: '确认意向' }));
    expect(mock决定S3).toHaveBeenLastCalledWith('recruiter', 'mc_hr', 'confirm');
  });

  it('S3：本端已决 → 等待态零控件（等待文案来自步骤闭表）', async () => {
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: S3详情(
          'candidate',
          { candidate: 'confirm', recruiter: '' },
          [], 'awaiting_recruiter_confirmation',
        ),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText('等待招聘方确认意向')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '确认意向' })).toBeNull();
    expect(screen.queryByRole('button', { name: '婉拒意向' })).toBeNull();
    expect(mock决定S3).not.toHaveBeenCalled();
  });

  it('第二次确认后的终局：移交文案在场、全部 mutation 控件缺席、屏层零本地重读', async () => {
    const user = userEvent.setup();
    // 先看确认动作本身：点击后屏层不做任何本地重建（权威重读归操作层）
    置详情状态({
      role: 'candidate',
      快照: 详情快照({ detail: S3详情('candidate', { candidate: '', recruiter: 'confirm' }, ['confirm_intent', 'decline_intent'], 'awaiting_candidate_confirmation') }),
    });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: '确认意向' }));
    expect(mock决定S3).toHaveBeenCalledTimes(1);
    expect(mock读取连续详情).toHaveBeenCalledTimes(1); // 仍是挂载那次
    expect(mock派发).not.toHaveBeenCalled();

    // 第二次确认后的权威形态（completed + handoff_pending）：只读移交，零动作控件
    cleanup();
    mock决定S3.mockClear(); // 两条腿分开计数
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 已完成移交详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    // Task 4 起 completed 的 S3（passed）默认折叠：展开意向确认段到达移交行
    await user.click(screen.getByRole('button', { name: /意向确认/ }));
    // 移交文案在场（移交行 + handoff_pending 步骤说明同词，出现即算）
    expect(screen.getAllByText('双方已确认，正在创建会话').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: '确认意向' })).toBeNull();
    expect(screen.queryByRole('button', { name: '婉拒意向' })).toBeNull();
    expect(screen.queryByRole('button', { name: '接受' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: '回答问题' })).toBeNull();
    expect(screen.queryByPlaceholderText(叮嘱占位)).toBeNull();
    expect(mock决定S3).not.toHaveBeenCalled();
  });
});

// ── 详情统一 Task 9：控制收口后的路由级行为（契约 C 生命周期）──
// 读取控制迁 use后端详情控制、正常区迁 keyed 后端正常详情 后的边界钉子：
// Tab 不改变发送 Case；换单/账号变更销毁弹层与原草稿；正常/失败交替不违反 hooks 顺序。
describe('MatchCase详情 · 控制收口（Task 9）', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock新增叮嘱.mockReset();
    mock新增叮嘱.mockImplementation(async () => undefined);
    mock读取简历PDF.mockReset();
    mock读取简历PDF.mockResolvedValue({ url: 'blob:p5-resume', revoke: () => undefined });
    mock跳转.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Tab 不改变发送 Case：切资料再切回，叮嘱草稿保留、发送仍带当前 case_id', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选S1详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    const 框 = screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement;
    await user.type(框, '周五也可以到岗');
    await user.click(screen.getByRole('button', { name: '职位详情' }));
    await user.click(screen.getByRole('button', { name: '代谈进度' }));
    // 底栏草稿归父控制（切 Tab 不卸载、不换单）：回来原样，发送坐标仍是本单
    expect((screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement).value).toBe('周五也可以到岗');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(mock新增叮嘱).toHaveBeenCalledTimes(1);
    expect(mock新增叮嘱).toHaveBeenCalledWith('candidate', 'mc_direct', '周五也可以到岗');
  });

  it('换单重置父层叮嘱草稿：A 的草稿不带进 B，B 发送只带 B 的 case_id（review-r1 F4）', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'candidate', caseId: 'mc_a',
      快照: 详情快照({ detail: 候选S1详情DTO('mc_a') }),
    });
    render(
      <MemoryRouter initialEntries={['/deal/mc_a']}>
        <测试换Case钮 目标="/deal/mc_b" 文案="切到新单" />
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>,
    );
    const 框A = screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement;
    await user.type(框A, 'A 单的叮嘱草稿');

    // 同一 Route 内换单：父控制 hook 不卸载，叮嘱草稿仍必须随 scope 清空
    置详情状态({
      role: 'candidate', caseId: 'mc_b',
      快照: 详情快照({ detail: 候选S1详情DTO('mc_b') }),
    });
    await user.click(screen.getByRole('button', { name: '切到新单' }));
    const 框B = screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement;
    expect(框B.value).toBe(''); // 不沿用上一单的内容（spec §3.1）
    await user.type(框B, 'B 单的叮嘱草稿');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(mock新增叮嘱).toHaveBeenCalledTimes(1);
    expect(mock新增叮嘱).toHaveBeenCalledWith('candidate', 'mc_b', 'B 单的叮嘱草稿'); // 零误发
  });

  it('换单销毁弹层与原草稿：开着的 PDF 弹层关闭并回收租约，回答草稿清空', async () => {
    const user = userEvent.setup();
    const 租约 = { url: 'blob:p5-resume', revoke: vi.fn() };
    mock读取简历PDF.mockResolvedValue(租约);
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1完整记录详情('candidate') }) });
    const 页 = render(
      <MemoryRouter initialEntries={['/deal/mc_direct']}>
        <测试换Case钮 目标="/deal/mc_other" 文案="切到新单" />
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>,
    );
    // S1 输入态 + typed 附件：叮嘱草稿与弹层同时在场
    const 叮嘱框 = (await screen.findByPlaceholderText(叮嘱占位)) as HTMLTextAreaElement;
    await user.type(叮嘱框, '每周可以到岗 3 天');
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v1\.pdf/ }));
    await screen.findByRole('dialog', { name: '简历原件' });

    // 换单：正常控制子组件按 key 重挂载 —— 弹层销毁（租约回收）、草稿清空
    const 新单 = S1完整记录详情('candidate');
    置详情状态({
      role: 'candidate', caseId: 'mc_other',
      快照: 详情快照({ detail: { ...新单, state: { ...新单.state!, caseId: 'mc_other' } } }),
    });
    await user.click(screen.getByRole('button', { name: '切到新单' }));
    await waitFor(() => expect(租约.revoke).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog', { name: '简历原件' })).toBeNull();
    expect((screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement).value).toBe('');
    页.unmount();
  });

  it('账号变更销毁弹层与原草稿（key 带 主体/角色/单，不能只用 caseId 作账号边界）', async () => {
    const user = userEvent.setup();
    const 租约 = { url: 'blob:p5-resume', revoke: vi.fn() };
    mock读取简历PDF.mockResolvedValue(租约);
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1完整记录详情('candidate') }) });
    // rerender 需要新元素实例（同一元素引用会让 React 直接跳过重渲染）
    const 树 = () => (
      <MemoryRouter initialEntries={['/deal/mc_direct']}>
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>
    );
    const 页 = render(树());
    const 叮嘱框 = (await screen.findByPlaceholderText(叮嘱占位)) as HTMLTextAreaElement;
    await user.type(叮嘱框, '每周可以到岗 3 天');
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v1\.pdf/ }));
    await screen.findByRole('dialog', { name: '简历原件' });

    // 同一 URL 同一单，主体换代（切换账号）：正常区整建重置
    设应用状态({
      ...mock应用状态,
      后端状态: {
        ...mock应用状态.后端状态,
        主体: { ...mock应用状态.后端状态.主体, subject_id: 'sub_2' },
        // 新主体自己的聚合快照已落位（旧属主快照被隐私栅栏挡下，页面资源不冒充）
        P5连续详情: {
          [P5范围键.negotiation('mc_direct')]: {
            ...连续详情快照({
              聚合: 连续详情DTO({ caseDetail: S1完整记录详情('candidate') }),
            }),
            ownerSubjectId: 'sub_2',
          },
        },
      },
    });
    页.rerender(树());
    await waitFor(() => expect(租约.revoke).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog', { name: '简历原件' })).toBeNull();
    expect((screen.getByPlaceholderText(叮嘱占位) as HTMLTextAreaElement).value).toBe('');
    页.unmount();
  });

  it('同路由换账号：叮嘱在飞锁随 scope 整表换代 —— B 不继承 A 的草稿，旧单迟到失败不提示', async () => {
    const user = userEvent.setup();
    let 送达!: () => void;
    mock新增叮嘱.mockImplementation(
      () => new Promise<void>((解决) => { 送达 = 解决; }));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1完整记录详情('candidate') }) });
    // rerender 需要新元素实例（同一元素引用会让 React 直接跳过重渲染）
    const 树 = () => (
      <MemoryRouter initialEntries={['/deal/mc_direct']}>
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>
    );
    const 页 = render(树());
    const 框A = (await screen.findByPlaceholderText(叮嘱占位)) as HTMLTextAreaElement;
    await user.type(框A, 'A 的叮嘱');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(mock新增叮嘱).toHaveBeenCalledTimes(1);
    清空轻提示();

    // 同一 URL 同一单，主体换代（切换账号）：正常区按 key 整建重置，父 hook 不重挂载
    设应用状态({
      ...mock应用状态,
      后端状态: {
        ...mock应用状态.后端状态,
        主体: { ...mock应用状态.后端状态.主体, subject_id: 'sub_2' },
        // 新主体自己的聚合快照已落位（旧属主快照被隐私栅栏挡下，页面资源不冒充）
        P5连续详情: {
          [P5范围键.negotiation('mc_direct')]: {
            ...连续详情快照({
              聚合: 连续详情DTO({ caseDetail: S1完整记录详情('candidate') }),
            }),
            ownerSubjectId: 'sub_2',
          },
        },
      },
    });
    页.rerender(树());

    // B 初始不继承 A 的草稿：输入区干净可输入、可发起自己的请求
    const 框B = (await screen.findByPlaceholderText(叮嘱占位)) as HTMLTextAreaElement;
    expect(框B.value).toBe('');
    await user.type(框B, 'B 的叮嘱');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(mock新增叮嘱).toHaveBeenCalledTimes(2);
    expect(mock新增叮嘱).toHaveBeenLastCalledWith('candidate', 'mc_direct', 'B 的叮嘱');
    送达();
    页.unmount();
  });

  it('正常→失败→正常交替不违反 hooks 顺序：错误页与正常页各自完整，恢复即整页回来', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    // rerender 需要新元素实例（同一元素引用会让 React 直接跳过重渲染）
    const 树 = () => (
      <MemoryRouter initialEntries={['/deal/mc_direct']}>
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>
    );
    const 页 = render(树());
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy();

    // 首载失败（detail 变 null）：整页走失败态，不把错误当缺失塞进正常区
    置详情状态({
      role: 'candidate',
      快照: 详情快照({ 阶段: '失败', detail: null, error: '服务暂时不可用，请稍后再试' }),
    });
    页.rerender(树());
    expect(screen.getByText('这一单暂时打不开')).toBeTruthy();
    expect(screen.queryByText('平台工程师')).toBeNull();

    // 恢复正常：hooks 顺序不变，正常区整页回来
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    页.rerender(树());
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy();
    expect(screen.getByRole('button', { name: '职位详情' })).toBeTruthy();
    页.unmount();
  });
});
