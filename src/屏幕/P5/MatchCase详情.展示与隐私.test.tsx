// MatchCase详情 · 展示与隐私（直达刷新/Tab/S0 记录呈现/attention）
// 由 src/屏幕/P5/MatchCase详情.test.tsx 按冻结归属拆出：S0记录呈现/Tab/attention→展示与隐私；直达刷新与隐私（Backend）、资料 Tab 与完整缺失区、招聘端在线简历 Tab 按主要断言主体（呈现）就近归入；S1 步骤文案三态按主要断言主体（步骤文案呈现）归入。

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
  mock操作,
  mock应用状态,
  意向ID,
  别名,
  叮嘱占位,
  状态,
  阶段区组,
  候选详情DTO,
  招聘详情DTO,
  已终止详情DTO,
  契约外详情DTO,
  详情快照,
  置详情状态,
  渲染详情,
  本地终局期望,
  测试换Case钮,
  测试地址行,
  绑定附件,
  S1等待详情,
  S1初筛详情,
  S1解析中详情,
  S1AI初筛详情,
  注意详情DTO,
  S0记录样本,
  S0完整记录详情,
  本地时分期望,
  S0详情树,
  登记详情组件,
} from './MatchCase详情.测试辅助';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchCase详情 } from './MatchCase详情';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { P5契约错误提示 } from '../../数据/MatchCase展示映射';
import userEvent from '@testing-library/user-event';

登记详情组件(MatchCase详情);

vi.mock('../../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../../路由/导航钩子', () => ({
  use导航: () => ({ 返回: mock返回, 跳转: mock跳转, 替换跳转: mock替换跳转 }),
}));

describe('MatchCase详情 · 直达刷新与隐私（Backend）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock返回.mockClear();
    mock设置P5范围.mockClear();
    mock读取详情.mockClear();
    mock新增叮嘱.mockClear();
    mock加载工作区.mockClear();
    mock刷新工作区.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // brief 片段：direct URL refresh —— 只凭 URL 坐标 + 已认证角色，不读任何列表快照
  it('direct URL refresh renders context without list memory', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(mock设置P5范围).toHaveBeenCalledWith('candidate', P5范围键.negotiation('mc_direct'));
    expect(mock读取连续详情).toHaveBeenCalledWith('mc_direct', true);
    // 候选只走聚合读：不并行调用旧候选 Case GET（Spec §4）
    expect(mock读取详情).not.toHaveBeenCalled();
    // 先注册可见范围再读（操作层栅栏靠注册的可见范围对上）
    expect(mock设置P5范围.mock.invocationCallOrder[0]).toBeLessThan(
      mock读取连续详情.mock.invocationCallOrder[0]);
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy(); // 冻结职位名 · 公司槽缺失占位（F3）
    // Task 4：内部意向 ID 不再出现在可见内容里（业务上下文靠冻结职位/城市/薪资承载）
    expect(document.body.textContent).not.toContain(意向ID);
    expect(screen.getByText('上海 · 25-40K·16薪')).toBeTruthy(); // 城市 · 薪资带
    // 列表记忆零读取：不碰任何工作区/列表操作
    expect(mock加载工作区).not.toHaveBeenCalled();
    expect(mock刷新工作区).not.toHaveBeenCalled();
    cleanup();
    // 卸载即清可见范围
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    const 页 = 渲染详情('candidate', 'mc_direct');
    页.unmount();
    expect(mock设置P5范围).toHaveBeenLastCalledWith('candidate', null);
  });

  it('招聘端直达刷新：candidate_alias 不进顶栏（去名裁定）+ 画像缺段占位 + 岗位上下文；无姓名/对端字段', async () => {
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: 招聘详情DTO() }) });
    渲染详情('recruiter', 'mc_hr');
    expect(mock读取详情).toHaveBeenCalledWith('recruiter', 'mc_hr', true);
    // scope 坐标是 case_id（不是别名）
    expect(mock设置P5范围).toHaveBeenCalledWith('recruiter', P5范围键.detail('recruiter', 'mc_hr'));
    // 去名裁定（2026-09-09）：alias 是不透明展示文本，不解析、不渲染，也不以「缺少姓名」恢复姓名区
    expect(await screen.findByTitle('匹配分缺失')).toBeTruthy();
    expect(document.body.textContent).not.toContain(别名);
    // 画像位置全保留，缺失说缺失；性别位给中性未知标记，不猜性别
    expect(screen.getByText('经验缺失')).toBeTruthy();
    expect(screen.getByText('学历缺失')).toBeTruthy();
    expect(screen.getByText('求职状态缺失')).toBeTruthy();
    expect(screen.getByRole('img', { name: '性别未知' })).toBeTruthy();
    // 冻结职位随岗位上下文行在场（职位名 · 城市 · 薪资带）
    expect(screen.getByText('平台工程师 · 上海 · 25-40K·16薪')).toBeTruthy();
    // 姓名与结构化身份是 P5.1 依赖：一个都不渲染
    expect(screen.queryByText('沈亦舟')).toBeNull();
    expect(document.body.textContent).not.toContain(意向ID); // 对端（候选端）字段进不了视图
    expect(screen.queryByText('匹配度分析')).toBeNull();

    // 候选端镜像：别名/对端字段同样不出现（双向不漏）
    cleanup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy();
    expect(document.body.textContent).not.toContain(意向ID);
    expect(screen.queryByText(别名)).toBeNull();
  });

  it('正常 Backend 详情用共用外壳：进度/资料两 Tab 在场，切 Tab 不改 URL，换单 Tab 回进度', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'candidate', caseId: 'mc_a',
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_a' }) }) }),
    });
    const 页 = render(
      <MemoryRouter initialEntries={['/deal/mc_a']}>
        <测试地址行 />
        <测试换Case钮 目标="/deal/mc_b" 文案="切到新单" />
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy();
    expect(screen.getByText('/deal/mc_a')).toBeTruthy();
    expect(screen.getByRole('button', { name: '代谈进度' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '职位详情' })).toBeTruthy();

    // 切到资料：槽位换成缺口说明（当前 P5 detail 不提供资料区字段），地址不变
    await user.click(screen.getByRole('button', { name: '职位详情' }));
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy();
    expect(screen.queryByText('轮次 1/3')).toBeNull(); // 进度 槽已卸载（唯一挂载）
    expect(screen.getByText('/deal/mc_a')).toBeTruthy();

    // 换单：Tab 重置回进度，不把上一单的视图带给下一单
    置详情状态({
      role: 'candidate', caseId: 'mc_b',
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_b' }) }) }),
    });
    await user.click(screen.getByRole('button', { name: '切到新单' }));
    expect(await screen.findByText('轮次 1/3')).toBeTruthy();
    expect(screen.getByText('/deal/mc_b')).toBeTruthy();
    页.unmount();
  });

  it('从资料 Tab 切回进度：当前段回到 DOM 且重新定位（不因条件挂载丢失节点定位）', async () => {
    vi.useFakeTimers();
    const 滚动 = vi.fn();
    const 原生 = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = 滚动;
    try {
      置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
      渲染详情('candidate', 'mc_direct');
      await act(() => vi.advanceTimersByTimeAsync(300));
      expect(滚动.mock.calls.length).toBeGreaterThan(0); // 进入详情定位当前阶段
      const 首次 = 滚动.mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name: '职位详情' }));
      expect(screen.queryByText('匿名初筛')).toBeNull(); // 进度槽互斥挂载，切走即卸载
      fireEvent.click(screen.getByRole('button', { name: '代谈进度' }));
      // 当前段回到 DOM（默认展开），不是只有状态区
      expect(screen.getByText('匿名初筛')).toBeTruthy();
      expect(screen.getByText('每周可以到岗几天？')).toBeTruthy();
      await act(() => vi.advanceTimersByTimeAsync(300));
      expect(滚动.mock.calls.length).toBeGreaterThan(首次); // 切回进度重新定位当前段
    } finally {
      HTMLElement.prototype.scrollIntoView = 原生;
      vi.useRealTimers();
    }
  });

  it('正常换 Case 不沿用折叠状态：上一单手动收起的当前段，在新单恢复默认展开', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'candidate', caseId: 'mc_a',
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_a' }) }) }),
    });
    const 页 = render(
      <MemoryRouter initialEntries={['/deal/mc_a']}>
        <测试换Case钮 目标="/deal/mc_b" 文案="切到新单" />
        <Routes>
          {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
          <Route path="/deal/:id" element={<MatchCase详情 role="candidate" />} />
        </Routes>
      </MemoryRouter>,
    );
    // S0 是当前段，默认展开：段内对话在场
    expect(await screen.findByText('每周可以到岗几天？')).toBeTruthy();
    await user.click(screen.getByText('匿名初筛').closest('button')!);
    expect(screen.queryByText('每周可以到岗几天？')).toBeNull(); // 手动收起

    置详情状态({
      role: 'candidate', caseId: 'mc_b',
      快照: 详情快照({ detail: 候选详情DTO({ state: 状态({ caseId: 'mc_b' }) }) }),
    });
    await user.click(screen.getByRole('button', { name: '切到新单' }));
    expect(await screen.findByText('每周可以到岗几天？')).toBeTruthy(); // 新单回到默认展开
    页.unmount();
  });

  it('四阶段固定 S0→S3 顺序（mapper 交付顺序，无客户端重排）；分节条显示 P5 自己的阶段标题', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    // 展示标题 = P5 区.标题（服务端阶段标题闭词投影）；颜色/排序/折叠键仍是共用四阶段名
    const 名序 = ['匿名初筛', '递交简历', '差异协同', '意向确认']; // J-PILOT-01：S1 阶段标题改「递交简历」
    await screen.findByText('平台工程师 · 公司信息缺失');
    名序.forEach((名) => expect(screen.getAllByText(名).length).toBe(1));
    const [s0, s1, s2, s3] = 名序.map((名) => screen.getAllByText(名)[0]!);
    expect(s0.compareDocumentPosition(s1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(s1.compareDocumentPosition(s2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(s2.compareDocumentPosition(s3) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('checklist / 时间线 / 叮嘱回执按类型渲染为展示文本', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    // S0 是当前段（默认展开）：核对清单（闭词→固定中文）、待答问题文本、双方叮嘱回执全部在场
    expect(await screen.findByText('匿名初筛已通过')).toBeTruthy();
    expect(screen.getByText('简历已绑定')).toBeTruthy(); // 未完成项标「核对中」
    expect(screen.getByText('每周可以到岗几天？')).toBeTruthy(); // 时间线文本原样展示
    expect(screen.getByText('工作日 10:00-19:00 联系')).toBeTruthy(); // 本端叮嘱回执
    expect(screen.getByText('流程预计两周内走完')).toBeTruthy(); // 对端叮嘱回执
    expect(screen.getByText('待处理')).toBeTruthy(); // 状态文案胶囊（六闭词表）
    expect(screen.getByText('等待人工决定是否继续')).toBeTruthy(); // 步骤说明（17 词闭表）
    expect(screen.getByText('轮次 1/3')).toBeTruthy();
  });

  it('阶段 summary/checklist 闭词走固定中文，未知 token 不进 DOM（安全兜底）', async () => {
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          stages: 阶段区组({
            anonymous_screening: {
              summary: 'secret_internal_step',
              checklist: [
                { label: 'anonymous_screening_passed', done: true },
                { label: 'secret_internal_check', done: false },
              ],
            },
          }),
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    // 已知闭词 → 固定中文；未知 summary → 安全兜底文案；未知 checklist 整项省略
    expect(await screen.findByText('阶段信息待更新')).toBeTruthy();
    expect(screen.getByText('匿名初筛已通过')).toBeTruthy();
    // 原始 token 一个都不进 DOM
    expect(screen.queryByText('secret_internal_step')).toBeNull();
    expect(screen.queryByText('secret_internal_check')).toBeNull();
  });

  it('candidate_question 步骤说明是 AI 侧生成动作，不是候选人的人工待办', async () => {
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          state: 状态({ status: 'running', step: 'candidate_question', needsUser: false, round: 0 }),
          needsAction: false,
          availableActions: [],
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    expect((await screen.findAllByText('候选方 AI 正在生成补充问题')).length).toBeGreaterThan(0);
    expect(screen.queryByText('等待候选人补充事实')).toBeNull(); // 旧文案（人工待办口径）退役
    // AI 生成中：无任何人工回答控件
    expect(screen.queryByRole('textbox', { name: '回答问题' })).toBeNull();
    expect(screen.queryByRole('button', { name: '提交回答' })).toBeNull();
  });

  it('时间线只作展示：running 行零动作卡、零回答输入（绝不从文本推状态/按钮）', async () => {
    // running 行（step policy_check）行侧白名单为空 —— 即便夹具给了 transcript 文本，
    // 展示映射也不出任何卡；时间线文本只能是文字。
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          state: 状态({ status: 'running', step: 'policy_check', needsUser: false, round: 0 }),
          needsAction: false,
          availableActions: [],
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('每周可以到岗几天？')).toBeTruthy(); // 文本照样展示
    expect(screen.queryByText('补充事实')).toBeNull(); // 无 respond_fact 卡
    expect(screen.queryByText('结束初筛')).toBeNull(); // 无 end_screening 卡
    // 状态权威来自 state.status（状态行 + 当前段胶囊都是闭词「进行中」），非文本推断
    expect(screen.getAllByText('进行中').length).toBeGreaterThan(0);
  });

  it('契约错误视图 fail closed：提示 + 重试（force 重读）+ 隐藏全部 mutation 控件', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 契约外详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText(P5契约错误提示)).toBeTruthy();
    expect(screen.queryByText('平台工程师')).toBeNull(); // 部分数据一概不渲染
    expect(screen.queryByPlaceholderText(叮嘱占位)).toBeNull(); // 叮嘱输入隐藏
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock读取连续详情).toHaveBeenCalledTimes(2);
    expect(mock读取连续详情).toHaveBeenLastCalledWith('mc_direct', true);
  });

  it('首载失败给失败态与重试（force 重读）；无输入', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'candidate',
      快照: 详情快照({ 阶段: '失败', detail: null, error: '服务暂时不可用，请稍后再试' }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText('这一单暂时打不开')).toBeTruthy();
    expect(screen.getByText('服务暂时不可用，请稍后再试')).toBeTruthy();
    expect(screen.queryByPlaceholderText(叮嘱占位)).toBeNull();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock读取连续详情).toHaveBeenCalledTimes(2);
    expect(mock读取连续详情).toHaveBeenLastCalledWith('mc_direct', true);
  });

  it('刷新失败保留旧详情只读 + 单独错误行交代 + 重试走刷新', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'candidate',
      快照: 详情快照({ detail: 候选详情DTO(), error: '服务暂时不可用，请稍后再试' }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText('平台工程师 · 公司信息缺失')).toBeTruthy(); // 旧详情原样保留，不降级成空白
    expect(screen.getByText('服务暂时不可用，请稍后再试')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(mock读取连续详情).toHaveBeenCalledTimes(2);
    expect(mock读取连续详情).toHaveBeenLastCalledWith('mc_direct', true);
  });

  it('可见 3 秒节拍权威重读（恒 force=true）', async () => {
    vi.useFakeTimers();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(mock读取连续详情).toHaveBeenCalledTimes(1); // 挂载直达读那一次
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(mock读取连续详情).toHaveBeenCalledTimes(2);
    expect(mock读取连续详情).toHaveBeenLastCalledWith('mc_direct', true);
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(mock读取连续详情).toHaveBeenCalledTimes(3);
  });

  it('终局详情不显示「代理处理中」徽标（只读终局，不是在处理）', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 已终止详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    await screen.findByText('终局'); // 终局卡在场（缺失则 findBy 抛错）
    expect(screen.queryByText('代理处理中')).toBeNull();
    expect(screen.queryByText('需要你')).toBeNull();
  });

  it('终局详情停 3 秒轮询、隐藏输入，终局摘要给本地时间而非原始 RFC3339', async () => {
    vi.useFakeTimers();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 已终止详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(mock读取连续详情).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(7000));
    expect(mock读取连续详情).toHaveBeenCalledTimes(1); // terminal detail 停止 polling（§10.3）
    expect(screen.queryByPlaceholderText(叮嘱占位)).toBeNull(); // 终局隐藏叮嘱输入
    // 结束语/原因仍是 wire 原样（不翻译不改写）
    expect(screen.getAllByText('user_ended').length).toBeGreaterThan(0);
    // 定格于换成本地展示值：原始 RFC3339 与任何 ISO 形状都不得出现在屏上
    expect(document.body.textContent).not.toContain('2026-08-29T03:00:00Z');
    expect(document.body.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
    expect(screen.getByText(本地终局期望('2026-08-29T03:00:00Z'))).toBeTruthy();
    // 内部 ID 同样不在可见内容里
    expect(document.body.textContent).not.toContain(意向ID);
  });

  it('会话/角色不匹配关轮询（已登录=false 或 last_used_role 非本端）', async () => {
    vi.useFakeTimers();
    置详情状态({
      role: 'candidate',
      登录角色: 'recruiter', // 组件角色 candidate，主体当前角色却是 recruiter
      快照: 详情快照({ detail: 候选详情DTO() }),
    });
    渲染详情('candidate', 'mc_direct');
    await act(() => vi.advanceTimersByTimeAsync(7000));
    expect(mock读取连续详情).toHaveBeenCalledTimes(1); // 只有挂载直达读，无节拍
    cleanup();
    mock读取连续详情.mockClear(); // 两条腿分开计数
    置详情状态({
      role: 'candidate', 已登录: false,
      快照: 详情快照({ detail: 候选详情DTO() }),
    });
    渲染详情('candidate', 'mc_direct');
    await act(() => vi.advanceTimersByTimeAsync(7000));
    expect(mock读取连续详情).toHaveBeenCalledTimes(1);
  });

  it('缺 P5.1 段不渲染：无 Mock Tab 名、无匹配度分析、匹配分位显示缺失、无公司块', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy();
    // Tab 行是共用产品名（spec §1：求职端 代谈进度 / 职位详情），招聘端 Tab 名不上求职端
    expect(screen.getByRole('button', { name: '代谈进度' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '职位详情' })).toBeTruthy();
    expect(screen.queryByText('在线简历')).toBeNull();
    expect(screen.queryByText('匹配度分析')).toBeNull(); // Mock 的资料面不出现（P5.1 依赖）
    // Backend 详情没有匹配分：右侧分数位显示缺失（— + 可访问说明），不传 0、不画假分
    const 分数位 = screen.getByTitle('匹配分缺失');
    expect(分数位.textContent).toBe('—');
    expect(screen.queryByText('公司')).toBeNull(); // 无公司块（P5.1 依赖）
  });
});

// ── 详情统一 Task 3：第二 Tab 用共用 职位资料 渲染完整缺失区（spec §3.3）─────────

describe('MatchCase详情 · 资料 Tab 与完整缺失区（Task 3）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock返回.mockClear();
    mock设置P5范围.mockClear();
    mock读取详情.mockClear();
    mock新增叮嘱.mockClear();
    mock加载工作区.mockClear();
    mock刷新工作区.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('缺资料：分析/JD/要求/公司五元行/标签/对接人都有标题或标签及缺失；冻结摘要与缺口说明在场', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '职位详情' }));
    // 阅读顺序（spec §3.3）五个区块各有标题，位置一个不缺。「职位详情」与 Tab 按钮
    // 同词（Tab 名恢复产品合同），逐标题按在场断言即可
    for (const 标题 of ['匹配度分析', '职位详情', '职位要求', '公司信息', '对接人']) {
      expect(screen.getAllByText(标题).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('匹配分析缺失')).toBeTruthy();
    expect(screen.getByText('职位详情缺失')).toBeTruthy();
    expect(screen.getByText('职位要求缺失')).toBeTruthy();
    expect(screen.getByText('公司介绍缺失')).toBeTruthy();
    expect(screen.getByText('公司标签缺失')).toBeTruthy();
    // 公司五元行位置恒在，缺值显示「—」+ 可访问缺失说明
    for (const 标签 of ['融资阶段', '规模', '行业', '成立', '地址']) {
      expect(screen.getByText(标签)).toBeTruthy();
      expect(screen.getByTitle(`${标签}缺失`).textContent).toBe('—');
    }
    expect(screen.getByTitle('对接人姓名缺失').textContent).toBe('—');
    expect(screen.getByTitle('对接人职务缺失').textContent).toBe('—');
    expect(screen.getByRole('img', { name: '对接人头像缺失' })).toBeTruthy();
    expect(screen.getByRole('img', { name: '公司标志缺失' })).toBeTruthy();
    // 冻结四事实不丢（岗位摘要位如实展示），缺口说明用约定句
    expect(screen.getByText('上海')).toBeTruthy();
    expect(screen.getByText('Kubernetes')).toBeTruthy();
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy();
    // 缺失不走错误红/通过绿的语义色：这里没有通过/失败图标
    expect(screen.queryByRole('img', { name: /通过/ })).toBeNull();
  });

  it('Tab 切换零新增请求：组织/推荐/岗位等所有操作在切换前后调用数不变', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy();
    const 操作调用数 = () => Object.values(mock操作).map((fn) => fn.mock.calls.length);
    const 切换前 = 操作调用数();
    fireEvent.click(screen.getByRole('button', { name: '职位详情' }));
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy();
    expect(操作调用数()).toEqual(切换前);
    fireEvent.click(screen.getByRole('button', { name: '代谈进度' }));
    expect(screen.getByText('匿名初筛')).toBeTruthy();
    expect(操作调用数()).toEqual(切换前);
  });
});

// ── 详情统一 Task 4：招聘端第二 Tab = 共用 在线简历正文（完整布局、档 null）──────
//    Backend P5 detail 不提供结构化在线简历：九区逐区缺失，不以一句「简历尚未同步」
//    替代整页；求职期望未知不给「已进入初筛/一致」承诺。求职端第二 Tab 仍是 职位资料。
describe('MatchCase详情 · 招聘端在线简历 Tab（Task 4）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock返回.mockClear();
    mock设置P5范围.mockClear();
    mock读取详情.mockClear();
    mock新增叮嘱.mockClear();
    mock加载工作区.mockClear();
    mock刷新工作区.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('recruiter 资料 Tab：九区标题原位保留并逐区缺失，缺口说明与页尾说明在场', async () => {
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: 招聘详情DTO() }) });
    渲染详情('recruiter', 'mc_hr');
    expect(await screen.findByText('平台工程师 · 上海 · 25-40K·16薪')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '在线简历' }));
    const 标题们 = [
      '匹配度分析', '个人优势', '求职期望', '工作经历', '项目经历', '教育经历', '专业技能',
    ] as const;
    for (const 标题 of 标题们) expect(screen.getByText(标题)).toBeTruthy();
    const 缺失们 = [
      '匿名画像缺失', '职位信息缺失', '匹配分析缺失', '个人优势缺失', '求职期望缺失',
      '工作经历缺失', '项目经历缺失', '教育经历缺失', '专业技能缺失',
    ] as const;
    for (const 缺失 of 缺失们) expect(screen.getByText(缺失)).toBeTruthy();
    // 区块级缺口说明用与求职端资料区同一句约定文案
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy();
    expect(screen.getByText(/在线简历缺失 · 内容不可转发/)).toBeTruthy();
  });

  it('recruiter 资料 Tab 不给无依据承诺与身份信息：无假薪资结论、无一致性 ✓、别名不上屏', async () => {
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: 招聘详情DTO() }) });
    渲染详情('recruiter', 'mc_hr');
    await screen.findByText('平台工程师 · 上海 · 25-40K·16薪');
    fireEvent.click(screen.getByRole('button', { name: '在线简历' }));
    expect(screen.queryByText('薪资带已进入初筛')).toBeNull();
    expect(screen.queryByText('✓')).toBeNull();
    expect(document.body.textContent).not.toContain(别名);
    expect(document.body.textContent).not.toContain('适配分');
    // 招聘端第二 Tab 不是 职位资料（那是求职端的资料区）
    expect(screen.queryByText('公司信息')).toBeNull();
    expect(screen.queryByText('对接人')).toBeNull();
  });

  it('candidate 资料 Tab 仍是职位资料（完整缺失区），不出现在线简历缺失占位', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 候选详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('平台工程师 · 公司信息缺失')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '职位详情' }));
    expect(screen.getByText('公司信息')).toBeTruthy();
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy();
    expect(screen.queryByText('匿名画像缺失')).toBeNull();
    expect(screen.queryByText('工作经历缺失')).toBeNull();
  });

  it('招聘端切 Tab 零新增请求：所有操作在切换前后调用数不变', async () => {
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: 招聘详情DTO() }) });
    渲染详情('recruiter', 'mc_hr');
    await screen.findByText('平台工程师 · 上海 · 25-40K·16薪');
    const 操作调用数 = () => Object.values(mock操作).map((fn) => fn.mock.calls.length);
    const 切换前 = 操作调用数();
    fireEvent.click(screen.getByRole('button', { name: '在线简历' }));
    expect(screen.getByText('个人优势缺失')).toBeTruthy();
    expect(操作调用数()).toEqual(切换前);
    fireEvent.click(screen.getByRole('button', { name: '代谈进度' }));
    expect(screen.getByText('匿名初筛')).toBeTruthy();
    expect(操作调用数()).toEqual(切换前);
  });
});

// ══ Task 5 夹具：S1 三条步骤文案逐词钉死（解析中 / AI 初筛中 / 人工决定）══

describe('MatchCase详情 · S1 步骤文案三态（Task 5）', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock决定S1.mockClear();
    mock读取简历PDF.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('解析中 / AI 初筛中 / 人工决定：文案来自 17 词闭表，决策卡只随人工决定行出现', async () => {
    // 解析中（S1 waiting + awaiting_resume_parse）：段摘要与步骤说明同词，出现即算
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1解析中详情() }) });
    渲染详情('recruiter', 'mc_hr');
    expect((await screen.findAllByText('正在解析简历')).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: '通过初筛' })).toBeNull();
    expect(screen.queryByRole('button', { name: '不合适' })).toBeNull();

    // 人工决定（S1 needs_user + awaiting_recruiter_decision）：等待文案 + 招聘端唯一决策卡
    cleanup();
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1初筛详情(true) }) });
    渲染详情('recruiter', 'mc_hr');
    expect(await screen.findByText('等待招聘方决定')).toBeTruthy();
    expect(screen.getByRole('button', { name: '通过初筛' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '不合适' })).toBeTruthy();

    // AI 初筛中（S1 waiting + screening_resume + 空动作表）：新 AI 文案、零决策控件
    cleanup();
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1AI初筛详情() }) });
    渲染详情('recruiter', 'mc_hr');
    expect(await screen.findByText('招聘方 AI 正在初筛已提交简历')).toBeTruthy();
    expect(screen.queryByText('出具简历初筛结论')).toBeNull();
    expect(screen.queryByRole('button', { name: '通过初筛' })).toBeNull();
    expect(screen.queryByRole('button', { name: '不合适' })).toBeNull();
    expect(mock决定S1).not.toHaveBeenCalled();
  });
});

describe('MatchCase详情 · owner-safe agent_attention', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock决定S0.mockClear();
    mock决定S1.mockClear();
    mock决定S2.mockClear();
    mock决定S3.mockClear();
    mock提交简历.mockClear();
    mock跳转.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(['candidate', 'recruiter'] as const)(
    'attention 详情给安全说明，徽标按待办优先，零 Agent 重试（%s）',
    async (role) => {
      const caseId = role === 'candidate' ? 'mc_direct' : 'mc_hr';
      // needsAction=false：说明在场（状态行后）、徽标「需注意」、「代理处理中」缺席
      置详情状态({ role, caseId, 快照: 详情快照({ detail: 注意详情DTO(role, false) }) });
      渲染详情(role, caseId);
      expect(await screen.findByText('AI 服务暂时不可用，本 Case 尚未继续')).toBeTruthy();
      // 「需注意」徽标与 attention 状态文案同词（闭词表）：出现即算
      expect(screen.getAllByText('需注意').length).toBeGreaterThan(0);
      expect(screen.queryByText('代理处理中')).toBeNull();
      expect(screen.queryByText('需要你')).toBeNull();
      // attention 行不出现 retry_resume_readiness 卡/控件，也没有任何新增 Agent retry 键
      expect(screen.queryByText('重试简历校验')).toBeNull();
      expect(screen.queryByRole('button', { name: '重试校验' })).toBeNull();
      expect(screen.queryByRole('button', { name: '重试' })).toBeNull();
      expect(mock提交简历).not.toHaveBeenCalled();
      cleanup();

      // needsAction=true：徽标仍是「需要你」且说明仍在
      置详情状态({ role, caseId, 快照: 详情快照({ detail: 注意详情DTO(role, true) }) });
      渲染详情(role, caseId);
      expect(screen.getByText('需要你')).toBeTruthy();
      expect(screen.getByText('AI 服务暂时不可用，本 Case 尚未继续')).toBeTruthy();
      expect(screen.queryByText('代理处理中')).toBeNull();
      expect(screen.queryByRole('button', { name: '重试校验' })).toBeNull();
      cleanup();
    },
  );

  it('retry_resume_readiness 的既有合法 S1 case 原文案与 operation 仍在（attention 接线不触碰）', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(true) }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('重试简历校验')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '重试校验' }));
    // J-PILOT-01（Spec §9）：原授权检查直接执行 submitResume（字面 true），无披露弹层
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mock提交简历).toHaveBeenCalledTimes(1);
    expect(mock提交简历).toHaveBeenCalledWith('mc_direct', 绑定附件.fileId, 绑定附件.fileVersionId, true);
  });
});

describe('MatchCase详情 · S0 screening records 呈现（Task 3）', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock回答事实.mockClear();
    mock决定S0.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** 气泡行：正文 span → 气泡 div → 行 div；我方行里有代理标 svg，对方行没有（既有 DOM 结构）。 */
  function 气泡行(文本: string): HTMLElement {
    const 气泡 = screen.getByText(文本).closest('div');
    if (气泡 === null) throw new Error(`找不到气泡：${文本}`);
    return 气泡.parentElement as HTMLElement;
  }
  const 是我方行 = (行: HTMLElement) => 行.querySelector('svg') !== null;

  it.each(['candidate', 'recruiter'] as const)(
    '同一批 S0 问答按 viewer 分方位；只出现正文/状态与时间，无技术字段（%s）',
    (role) => {
      const caseId = role === 'candidate' ? 'mc_direct' : 'mc_hr';
      置详情状态({ role, caseId, 快照: 详情快照({ detail: S0完整记录详情(role) }) });
      渲染详情(role, caseId);
      // question 是候选方、answer 是招聘方：candidate 下 question 我方；recruiter 下左右相反
      expect(是我方行(气泡行('需要确认岗位的值班安排。'))).toBe(role === 'candidate');
      expect(是我方行(气泡行('没有固定晚班，周末偶尔需要支援。'))).toBe(role === 'recruiter');
      // 只出现正文/状态/时间：kind、role、round、ID 与技术标题一概不进 DOM
      const 文本 = document.body.textContent ?? '';
      ['question', 'answer', 'candidate', 'recruiter', 'round 1', 's0q_1', 'Agent问答'].forEach(
        (词) => expect(文本).not.toContain(词),
      );
    },
  );

  it('candidate：初评与全部复评都进托盘且无总结时间；recruiter：无总结正文也无空托盘', () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0完整记录详情('candidate') }) });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText('初评：初评已确认岗位在浦东园区，值班安排仍待确认。')).toBeTruthy();
    // 逐轮复评全部出现，标签只由 phase/round 给定
    expect(screen.getByText('第 1 轮复评：已确认没有固定晚班，团队规模仍待确认。')).toBeTruthy();
    expect(screen.getByText('第 2 轮复评：团队规模初步确认为 6 人。')).toBeTruthy();
    // 总结不显示时间：屏上没有任何 RFC3339 原文
    expect(document.body.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}T/);

    cleanup();
    置详情状态({
      role: 'recruiter', caseId: 'mc_hr',
      快照: 详情快照({ detail: S0完整记录详情('recruiter') }),
    });
    渲染详情('recruiter', 'mc_hr');
    // 招聘方没有总结区域，也没有空托盘或失败占位：托盘只有阶段区自己的旧小结
    expect(screen.queryByText(/初评：/)).toBeNull();
    expect(screen.queryByText(/第 \d+ 轮复评/)).toBeNull();
    expect(screen.getAllByText('代 理 小 结').length).toBe(1);
    const 托盘 = screen.getByText('代 理 小 结').parentElement as HTMLElement;
    expect(托盘.textContent).not.toContain('值班安排仍待确认');
  });

  it('三种未回答只显示固定文案：无伪造正文，也没有新增输入框', () => {
    const 记录 = S0记录样本();
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          state: 状态({
            status: 'running', step: 'policy_check', needsUser: false, round: 0, roundBudget: 5,
          }),
          needsAction: false,
          availableActions: [],
          stages: 阶段区组({
            anonymous_screening: { screeningRecords: { messages: 记录.messages.filter((条) => 条.round >= 2), summaries: [] } },
          }),
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    // 三条未回答的气泡正文就是固定文案本身（getByText 精确匹配：拼了别的字就找不到）
    expect(screen.getByText('已拒绝回答')).toBeTruthy();
    // 冻结合同 §6.1：unknown 对外固定「暂时无法回答」（是一条被记录的回答，不等于同意）
    expect(screen.getByText('暂时无法回答')).toBeTruthy();
    expect(screen.getByText('暂无可用信息')).toBeTruthy();
    // 段内气泡 9 个不多不少：轮 2–4 的 6 条 S0 问答 + 旧 transcript 1 条 + 旧叮嘱回执 2 条
    const 列 = 气泡行('还需要了解团队规模。').parentElement as HTMLElement;
    expect(列.childElementCount).toBe(9);
    // 没有新增输入框：只剩底部 Case 叮嘱一条
    expect(screen.getAllByRole('textbox').length).toBe(1);
  });

  it('S0 记录固定在旧 transcript 与叮嘱回执之前：不按时间混排', () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0完整记录详情('candidate') }) });
    渲染详情('candidate', 'mc_direct');
    const 序 = [
      '需要确认岗位的值班安排。', // s0q_1（2026-08-23，早于旧时间线）
      '没有固定晚班，周末偶尔需要支援。',
      '带团队的人数规模？', // s0q_4（2026-08-30，晚于旧时间线）
      '暂无可用信息', // s0a_4
      '每周可以到岗几天？', // 旧 transcript
      '工作日 10:00-19:00 联系', // 旧叮嘱回执
      '流程预计两周内走完',
    ].map((文本) => screen.getByText(文本));
    for (let 下标 = 0; 下标 < 序.length - 1; 下标 += 1) {
      const 前 = 序[下标] as Element;
      const 后 = 序[下标 + 1] as Element;
      expect(前.compareDocumentPosition(后) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('question-only、空 messages、轮次空档都合法；轮询式重读同批记录不重复', () => {
    const 记录 = S0记录样本();
    // 仅问（question-only）
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          stages: 阶段区组({
            anonymous_screening: { screeningRecords: { messages: [记录.messages[0]!], summaries: [] } },
          }),
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getAllByText('需要确认岗位的值班安排。').length).toBe(1);
    expect(screen.queryByText(/初评：/)).toBeNull();

    // 空 messages + 仅 initial 总结：零问答气泡，托盘只有总结
    cleanup();
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          stages: 阶段区组({
            anonymous_screening: {
              screeningRecords: {
                messages: [],
                summaries: [{ id: 's0sum_1', phase: 'initial', summary: '初评确认岗位在浦东园区。', occurredAt: '2026-08-23T10:06:00Z' }],
              },
            },
          }),
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(screen.queryByText('需要确认岗位的值班安排。')).toBeNull();
    expect(screen.getByText('初评：初评确认岗位在浦东园区。')).toBeTruthy();

    // 轮次空档（round 1 → 3）：原样渲染，不补位不重排
    cleanup();
    置详情状态({
      role: 'candidate',
      快照: 详情快照({
        detail: 候选详情DTO({
          stages: 阶段区组({
            anonymous_screening: {
              screeningRecords: { messages: [记录.messages[0]!, 记录.messages[4]!], summaries: [] },
            },
          }),
        }),
      }),
    });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getAllByText('需要确认岗位的值班安排。').length).toBe(1);
    expect(screen.getAllByText('平时出差频率如何？').length).toBe(1);

    // 轮询式重读：同批记录以新快照整包再来一遍，气泡与总结都不重复
    cleanup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0完整记录详情('candidate') }) });
    const 树 = S0详情树('candidate', 'mc_direct');
    const 页 = render(树);
    expect(screen.getAllByText('需要确认岗位的值班安排。').length).toBe(1);
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0完整记录详情('candidate') }) });
    页.rerender(树);
    expect(screen.getAllByText('需要确认岗位的值班安排。').length).toBe(1);
    expect(screen.getAllByText('初评：初评已确认岗位在浦东园区，值班安排仍待确认。').length).toBe(1);
  });

  it('旧摘要/清单/附件/叮嘱仍在；S0 respond_fact 零输入零请求（review-r1：end 卡也停）', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0完整记录详情('candidate') }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('系统正在复评候选信息')).toBeTruthy(); // 旧步骤摘要头行
    expect(screen.getByText('匿名初筛已通过')).toBeTruthy(); // 清单
    expect(screen.getByText('简历已绑定')).toBeTruthy();
    expect(screen.getByText('工作日 10:00-19:00 联系')).toBeTruthy(); // 叮嘱回执
    expect(screen.getByRole('button', { name: /后端工程师_简历_v1\.pdf/ })).toBeTruthy(); // 附件入口
    // J-PILOT-01（Spec §7）：无 respond_fact 卡/回答框，零人工补事实请求；
    // review-r1：旧 S0 needs_user 行的 end_screening 卡也停（停止该卡交互）
    expect(screen.queryByText('补充事实')).toBeNull();
    expect(screen.queryByRole('textbox', { name: '回答问题' })).toBeNull();
    expect(screen.queryByRole('button', { name: '结束初筛' })).toBeNull();
    expect(mock回答事实).not.toHaveBeenCalled();
  });

  it('S0 新消息走本地 HH:mm 且不读 Date.now()；旧时间线仍是既有 UTC 字符串切片', () => {
    vi.useFakeTimers();
    // 期望值独立用本地 getter 推出：UTC 进程 = 10:01，Asia/Shanghai 进程 = 18:01
    const 期望 = 本地时分期望('2026-08-23T10:01:00Z');
    const 错位 = 期望 === '10:01' ? '18:01' : '10:01';

    vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0完整记录详情('candidate') }) });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText(期望)).toBeTruthy();
    expect(screen.queryByText(错位)).toBeNull(); // 显示跟进程时区走，不写死
    // 叮嘱回执保持既有字符串切片结果（本任务不统一时间线）；旧 transcript 落系统状态行
    expect(screen.getByText('每周可以到岗几天？')).toBeTruthy(); // 时间线文本原样展示
    expect(screen.getByText('01:05')).toBeTruthy();
    expect(screen.getByText('01:06')).toBeTruthy();

    // 换一个 fake 当前时间：显示不变（不读 Date.now()）
    cleanup();
    vi.setSystemTime(new Date('2030-06-01T18:30:00Z'));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S0完整记录详情('candidate') }) });
    渲染详情('candidate', 'mc_direct');
    expect(screen.getByText(期望)).toBeTruthy();
    expect(screen.getByText('01:05')).toBeTruthy(); // 叮嘱回执时间不随当前时间变
  });
});
