// MatchCase详情 · 附件与移交（原始 PDF / 发布前后移交）
// 由 src/屏幕/P5/MatchCase详情.test.tsx 按冻结归属拆出：PDF/发布前后移交→附件与移交；P7 移交两步接线、completed 移交只读按移交职责就近归入。

import {
  mock返回,
  mock跳转,
  mock替换跳转,
  mock读取详情,
  mock读取连续详情,
  mock新增叮嘱,
  mock回答事实,
  mock决定S0,
  mock决定S1,
  mock决定S2,
  mock决定S3,
  mock提交简历,
  mock读取简历PDF,
  mock应用状态,
  状态,
  详情快照,
  置详情状态,
  渲染详情,
  可控Promise,
  S1等待详情,
  S1初筛详情,
  S1解析中详情,
  已发布移交详情DTO,
  已完成移交详情DTO,
  招聘已完成移交DTO,
  轻提示条数,
  清空轻提示,
  登记详情组件,
} from './MatchCase详情.测试辅助';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchCase详情 } from './MatchCase详情';
import { 路径 } from '../../路由/路径表';
import userEvent from '@testing-library/user-event';

登记详情组件(MatchCase详情);

vi.mock('../../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../../路由/导航钩子', () => ({
  use导航: () => ({ 返回: mock返回, 跳转: mock跳转, 替换跳转: mock替换跳转 }),
}));

// ── P7 Task 6：completed 两步移交接线（pending 继续轮询 → ready 启用并进 P7 路由）──
describe('MatchCase详情 · P7 移交两步接线', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock跳转.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pending（handoff_pending）：开始私聊在场但禁用，3 秒节拍继续权威重读，无内部错误词', async () => {
    vi.useFakeTimers();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 已完成移交详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    fireEvent.click(screen.getByRole('button', { name: /意向确认/ })); // 展开折叠的 S3 到达移交
    expect(screen.getAllByText('双方已确认，正在创建会话').length).toBeGreaterThan(0);
    const 私聊键 = screen.getByRole('button', { name: '开始私聊' }) as HTMLButtonElement;
    expect(私聊键.disabled).toBe(true);
    const 基线 = mock读取连续详情.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(3000));
    await act(() => vi.advanceTimersByTimeAsync(3000));
    // pending 不是详情终局：多拍后仍在权威重读（same-party 长期 pending 同形态）
    expect(mock读取连续详情.mock.calls.length).toBeGreaterThan(基线);
    expect(mock跳转).not.toHaveBeenCalled();
    // 绝不出现内部错误词或前端自造的超时终态
    expect(screen.queryByText(/invalid_actor_identity/)).toBeNull();
    expect(screen.queryByText('真人会话已建立')).toBeNull();
    expect((screen.getByRole('button', { name: '开始私聊' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('ready（complete + conversation_ref）：开始私聊启用并按角色进入 P7 会话路由', async () => {
    const user = userEvent.setup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 已发布移交详情DTO('candidate') }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: /意向确认/ })); // 展开折叠的 S3 到达移交
    expect(screen.getByText('真人会话已建立')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '开始私聊' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.真人会话路径('3003'));

    // 招聘端镜像：进入企业参数路由
    cleanup();
    mock跳转.mockClear();
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: 已发布移交详情DTO('recruiter') }) });
    渲染详情('recruiter', 'mc_hr');
    await user.click(screen.getByRole('button', { name: /意向确认/ })); // 展开折叠的 S3 到达移交
    await user.click(screen.getByRole('button', { name: '开始私聊' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.企业真人会话路径('3003'));
  });

  it('ready 详情终局停轮询：3 秒节拍不再重读', async () => {
    vi.useFakeTimers();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 已发布移交详情DTO('candidate') }) });
    渲染详情('candidate', 'mc_direct');
    const 基线 = mock读取连续详情.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(3000));
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(mock读取连续详情.mock.calls.length).toBe(基线);
  });
});

describe('MatchCase详情 · 授权原始 PDF（Task 6）', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock读取简历PDF.mockClear();
    mock读取简历PDF.mockResolvedValue({ url: 'blob:p5-resume', revoke: () => undefined });
    mock跳转.mockClear();
    清空轻提示();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('披露前与解析中：无姓名/联系方式/PDF 入口，零 PDF 请求', async () => {
    // 解析中（S1 waiting）：后端保持附件闭合
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1解析中详情() }) });
    渲染详情('recruiter', 'mc_hr');
    expect(await screen.findByText('正在解析简历')).toBeTruthy(); // 详情已渲染（S1 段摘要）
    expect(screen.queryByText('后端工程师_简历_v2.pdf')).toBeNull(); // 无 PDF 入口
    expect(screen.queryByText('查看 ›')).toBeNull();
    // 无姓名/联系方式/结构化身份（P5.1 缺席即不渲染）
    expect(screen.queryByText('沈亦舟')).toBeNull();
    expect(screen.queryByText(/手机：/)).toBeNull();
    expect(screen.queryByText(/邮箱：/)).toBeNull();
    expect(mock读取简历PDF).not.toHaveBeenCalled();
    // 初筛卡不带附件的镜像（披露前 S1 needs_user 无附件）：同样无入口
    cleanup();
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1初筛详情(false) }) });
    渲染详情('recruiter', 'mc_hr');
    expect(screen.queryByText('查看 ›')).toBeNull();
    expect(mock读取简历PDF).not.toHaveBeenCalled();
  });

  it('typed 附件在场：点击只走 Case 专属 role 路径一次，弹层以租约地址呈现真实 PDF，关闭即回收', async () => {
    const user = userEvent.setup();
    const 租约 = { url: 'blob:p5-resume', revoke: vi.fn() };
    mock读取简历PDF.mockResolvedValue(租约);
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1初筛详情(true) }) });
    渲染详情('recruiter', 'mc_hr');
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v2\.pdf/ }));
    // 只调 Case 专属 role 路径（role + case_id），一次点击一次租约
    expect(mock读取简历PDF).toHaveBeenCalledTimes(1);
    expect(mock读取简历PDF).toHaveBeenCalledWith('recruiter', 'mc_hr');
    const 弹层 = await screen.findByRole('dialog', { name: '简历原件' });
    expect(within(弹层).getByText('后端工程师_简历_v2.pdf')).toBeTruthy(); // 顶栏只有徽标+文件名+关闭
    // 正文以租约对象地址直接呈现真实字节（经 URL 渲染，绝不读 blob 文本/字节）
    const 阅览框 = within(弹层).getByTitle('简历 PDF') as HTMLIFrameElement;
    expect(阅览框.getAttribute('src')).toBe('blob:p5-resume');
    await user.click(within(弹层).getByRole('button', { name: '关闭' }));
    expect(租约.revoke).toHaveBeenCalledTimes(1); // 关闭即回收
    expect(screen.queryByRole('dialog', { name: '简历原件' })).toBeNull();
    expect(mock读取简历PDF).toHaveBeenCalledTimes(1); // 关闭不重取
  });

  it('S1 段有叮嘱回执与文本时间线时 PDF 入口仍在（终审回归钉），照常打开', async () => {
    const user = userEvent.setup();
    const 租约 = { url: 'blob:p5-resume', revoke: vi.fn() };
    mock读取简历PDF.mockResolvedValue(租约);
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1初筛详情(true, true) }) });
    渲染详情('recruiter', 'mc_hr');
    // 段内对话非空：本端叮嘱回执与流程事件注释（已递交简历）都照常展示
    expect(await screen.findByText('只在工作日 10:00-19:00 联系')).toBeTruthy();
    expect(screen.getByText('已递交简历')).toBeTruthy();
    // 入口不被段内对话压掉：仍在、可开、恰好一次租约
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v2\.pdf/ }));
    expect(mock读取简历PDF).toHaveBeenCalledTimes(1);
    expect(mock读取简历PDF).toHaveBeenCalledWith('recruiter', 'mc_hr');
    const 弹层 = await screen.findByRole('dialog', { name: '简历原件' });
    expect(
      (within(弹层).getByTitle('简历 PDF') as HTMLIFrameElement).getAttribute('src'),
    ).toBe('blob:p5-resume');
    await user.click(within(弹层).getByRole('button', { name: '关闭' }));
    expect(租约.revoke).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: '简历原件' })).toBeNull();
  });

  it('弹层开着时整页卸载也回收租约（无缓存无持久化）', async () => {
    const user = userEvent.setup();
    const 租约 = { url: 'blob:p5-resume', revoke: vi.fn() };
    mock读取简历PDF.mockResolvedValue(租约);
    置详情状态({ role: 'recruiter', caseId: 'mc_hr', 快照: 详情快照({ detail: S1初筛详情(true) }) });
    const 页 = 渲染详情('recruiter', 'mc_hr');
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v2\.pdf/ }));
    await screen.findByRole('dialog', { name: '简历原件' });
    页.unmount();
    expect(租约.revoke).toHaveBeenCalledTimes(1); // 卸载即回收
  });

  // Task 3：候选端也能看本 Case 已下发的本人 PDF —— 入口只由阶段投影的 typed 附件授权。
  it('候选端 typed 附件在场：点击走 candidate 路径一次，弹层以租约地址呈现真实 PDF', async () => {
    const user = userEvent.setup();
    const 租约 = { url: 'blob:p5-own-resume', revoke: vi.fn() };
    mock读取简历PDF.mockResolvedValue(租约);
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(true) }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('重试简历校验')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v1\.pdf/ }));
    expect(mock读取简历PDF).toHaveBeenCalledTimes(1);
    // 角色路径严格：候选端只走 candidate 臂，不复用 recruiter 路径
    expect(mock读取简历PDF).toHaveBeenCalledWith('candidate', 'mc_direct');
    const 弹层 = await screen.findByRole('dialog', { name: '简历原件' });
    expect(
      (within(弹层).getByTitle('简历 PDF') as HTMLIFrameElement).getAttribute('src'),
    ).toBe('blob:p5-own-resume');
    await user.click(within(弹层).getByRole('button', { name: '关闭' }));
    expect(租约.revoke).toHaveBeenCalledTimes(1);
  });

  it('候选端无附件：零入口零请求，不从附件库猜文件', async () => {
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(false) }) });
    渲染详情('candidate', 'mc_direct');
    expect(await screen.findByText('重试简历校验')).toBeTruthy();
    expect(screen.queryByText('查看 ›')).toBeNull();
    expect(screen.queryByText('后端工程师_简历_v1.pdf')).toBeNull();
    expect(mock读取简历PDF).not.toHaveBeenCalled();
  });

  it('候选端连点只发一次请求（在飞单飞）', async () => {
    const user = userEvent.setup();
    const 门 = 可控Promise<{ url: string; revoke: () => undefined }>();
    mock读取简历PDF.mockReturnValue(门.promise);
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(true) }) });
    渲染详情('candidate', 'mc_direct');
    const 入口 = screen.getByRole('button', { name: /后端工程师_简历_v1\.pdf/ });
    await user.click(入口);
    await user.click(入口);
    await user.click(入口);
    expect(mock读取简历PDF).toHaveBeenCalledTimes(1);
    await act(async () => {
      门.resolve({ url: 'blob:once', revoke: vi.fn(() => undefined) });
      await 门.promise;
    });
    expect(await screen.findByRole('dialog', { name: '简历原件' })).toBeTruthy();
  });

  it('读取在途卸载：迟到成功的租约立即回收，不打开弹层', async () => {
    const user = userEvent.setup();
    const 门 = 可控Promise<{ url: string; revoke: () => undefined }>();
    const 租约 = { url: 'blob:late', revoke: vi.fn(() => undefined) };
    mock读取简历PDF.mockReturnValue(门.promise);
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(true) }) });
    const 页 = 渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v1\.pdf/ }));
    页.unmount();
    await act(async () => {
      门.resolve(租约);
      await 门.promise;
    });
    expect(租约.revoke).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: '简历原件' })).toBeNull();
  });

  it('读取在途换 Case：迟到租约回收，且新 Case 的第一次点击不被旧在飞锁挡住', async () => {
    const user = userEvent.setup();
    const 旧门 = 可控Promise<{ url: string; revoke: () => undefined }>();
    const 旧租约 = { url: 'blob:old-case', revoke: vi.fn(() => undefined) };
    const 新租约 = { url: 'blob:new-case', revoke: vi.fn(() => undefined) };
    mock读取简历PDF.mockReturnValueOnce(旧门.promise).mockResolvedValue(新租约);
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(true) }) });
    const 页 = 渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v1\.pdf/ }));
    页.unmount();
    cleanup();

    置详情状态({
      role: 'candidate', caseId: 'mc_other',
      快照: 详情快照({
        // 真实换单：新记录自己的 case 坐标（case_detail.state.caseId），不是沿用旧单的
        detail: {
          ...S1等待详情(true),
          state: 状态({
            caseId: 'mc_other', stage: 'resume_submission', status: 'waiting',
            step: 'awaiting_resume_parse', needsUser: false,
          }),
        },
      }),
    });
    渲染详情('candidate', 'mc_other');
    await user.click(await screen.findByRole('button', { name: /后端工程师_简历_v1\.pdf/ }));
    expect(mock读取简历PDF).toHaveBeenLastCalledWith('candidate', 'mc_other');
    const 弹层 = await screen.findByRole('dialog', { name: '简历原件' });
    expect(
      (within(弹层).getByTitle('简历 PDF') as HTMLIFrameElement).getAttribute('src'),
    ).toBe('blob:new-case');
    // 旧 Case 的迟到成功只回收，不改新 Case 的弹层
    await act(async () => {
      旧门.resolve(旧租约);
      await 旧门.promise;
    });
    expect(旧租约.revoke).toHaveBeenCalledTimes(1);
    expect(
      (within(await screen.findByRole('dialog', { name: '简历原件' }))
        .getByTitle('简历 PDF') as HTMLIFrameElement).getAttribute('src'),
    ).toBe('blob:new-case');
  });

  it('读取失败只在当前页轻提示：不跳转、不生成模拟文件；迟到失败不提示', async () => {
    const user = userEvent.setup();
    mock读取简历PDF.mockRejectedValueOnce(new Error('读取失败'));
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: S1等待详情(true) }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: /后端工程师_简历_v1\.pdf/ }));
    await waitFor(() => expect(轻提示条数()).toBe(1));
    expect(screen.queryByRole('dialog', { name: '简历原件' })).toBeNull();
    expect(mock跳转).not.toHaveBeenCalled();

    // 卸载后到达的失败不再提示
    清空轻提示();
    const 门 = 可控Promise<{ url: string; revoke: () => undefined }>();
    mock读取简历PDF.mockReturnValue(门.promise);
    cleanup();
    置详情状态({ role: 'candidate', caseId: 'mc_late', 快照: 详情快照({ detail: S1等待详情(true) }) });
    const 页 = 渲染详情('candidate', 'mc_late');
    await user.click(await screen.findByRole('button', { name: /后端工程师_简历_v1\.pdf/ }));
    页.unmount();
    await act(async () => {
      门.reject(new Error('迟到失败'));
      await 门.promise.catch(() => undefined);
    });
    expect(轻提示条数()).toBe(0);
  });
});

describe('MatchCase详情 · completed 移交只读（Task 7）', () => {
  beforeEach(() => {
    mock读取详情.mockClear();
    mock跳转.mockClear();
    mock新增叮嘱.mockClear();
    mock回答事实.mockClear();
    mock决定S0.mockClear();
    mock决定S1.mockClear();
    mock决定S2.mockClear();
    mock决定S3.mockClear();
    mock提交简历.mockClear();
    mock读取简历PDF.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // brief 片段：completed handoff never navigates to chat —— 按钮在场但恒禁用，
  // 点击零导航（仓库无 jest-dom，toBeDisabled 换成 disabled 属性断言）。
  it('completed handoff never navigates to chat（双端）', async () => {
    const user = userEvent.setup();
    置详情状态({
      role: 'recruiter', caseId: 'mc_done',
      快照: 详情快照({ detail: 招聘已完成移交DTO() }),
    });
    渲染详情('recruiter', 'mc_done');
    // 展开折叠的 S3（completed 的 passed 段默认折叠）到达移交行
    await user.click(screen.getByRole('button', { name: /意向确认/ }));
    // 移交文案与 handoff_pending 步骤说明同词：findAllByText（在场即算，出现两处属正常）
    expect((await screen.findAllByText('双方已确认，正在创建会话')).length).toBeGreaterThan(0);
    const 按钮 = screen.getByRole('button', { name: '开始私聊' }) as HTMLButtonElement;
    expect(按钮.disabled).toBe(true); // toBeDisabled 的仓库等价断言
    expect(按钮.hasAttribute('disabled')).toBe(true);
    await user.click(按钮); // 禁用键点击无效：零导航、零 mutation
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock决定S3).not.toHaveBeenCalled();

    // 候选端镜像：同一形态同样只给文案 + 恒禁用键
    cleanup();
    置详情状态({ role: 'candidate', 快照: 详情快照({ detail: 已完成移交详情DTO() }) });
    渲染详情('candidate', 'mc_direct');
    await user.click(screen.getByRole('button', { name: /意向确认/ })); // 展开折叠的 S3
    expect((await screen.findAllByText('双方已确认，正在创建会话')).length).toBeGreaterThan(0);
    const 候选键 = screen.getByRole('button', { name: '开始私聊' }) as HTMLButtonElement;
    expect(候选键.disabled).toBe(true);
    await user.click(候选键);
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('移交视图零会话标识：视图/导航参数/存储/请求坐标都不存在会话标识', async () => {
    const user = userEvent.setup();
    const 存储写入 = vi.spyOn(Storage.prototype, 'setItem');
    try {
      置详情状态({
        role: 'recruiter', caseId: 'mc_done',
        快照: 详情快照({ detail: 招聘已完成移交DTO() }),
      });
      渲染详情('recruiter', 'mc_done');
      await user.click(screen.getByRole('button', { name: /意向确认/ })); // 展开折叠的 S3
      expect((await screen.findAllByText('双方已确认，正在创建会话')).length).toBeGreaterThan(0);
      await user.click(screen.getByRole('button', { name: '开始私聊' }));

      // 视图态：页面上含「会话」的文本只有那句准备文案（移交行 + 步骤说明），无任何会话标识
      const 含会话 = screen.getAllByText(/会话/);
      expect(含会话.length).toBeGreaterThan(0);
      含会话.forEach((元) => expect(元.textContent).toBe('双方已确认，正在创建会话'));
      expect(screen.queryByText(/conversation|chat[-_]?id|conv[-_]|session[-_]?id/i)).toBeNull();

      // 导航参数：零跳转（禁用键点击与整页任何入口都不产生会话路由）
      expect(mock跳转).not.toHaveBeenCalled();

      // 存储：全程零写入（快照/标识只在内存）
      expect(存储写入).not.toHaveBeenCalled();

      // 请求坐标：读详情只有 (role, case_id, force) 三元组，无第四个会话参数
      expect(mock读取详情.mock.calls.length).toBeGreaterThan(0);
      mock读取详情.mock.calls.forEach((调) => {
        expect(调).toEqual(['recruiter', 'mc_done', true]);
      });
      // 其余 mutation/PDF 操作一概零调用
      expect(mock新增叮嘱).not.toHaveBeenCalled();
      expect(mock回答事实).not.toHaveBeenCalled();
      expect(mock决定S0).not.toHaveBeenCalled();
      expect(mock决定S1).not.toHaveBeenCalled();
      expect(mock决定S2).not.toHaveBeenCalled();
      expect(mock决定S3).not.toHaveBeenCalled();
      expect(mock提交简历).not.toHaveBeenCalled();
      expect(mock读取简历PDF).not.toHaveBeenCalled();
    } finally {
      存储写入.mockRestore();
    }
  });
});
