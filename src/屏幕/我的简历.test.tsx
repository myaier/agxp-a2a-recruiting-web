// 我的简历 附件简历卡测试（P2 Task 6）：
// Mock 分支逐字保留硬编码演示行与「原型演示」说明（防视觉漂移回归）；
// Backend 分支渲染权威 0–3 行：状态动作矩阵、删除确认、解析/上传授权层（文案与
// 完善资料 Task 5 逐字相同）、真实 PDF 预览、busy 防双击、已换代静默、单行展开。

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEventApi from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { BFF附件简历, BFF附件解析失败码, BFF附件解析状态 } from '../数据/BFF契约';
import { BFF错误 } from '../数据/HTTP客户端';
import type { 基本信息 as 基本信息类型, 简历经历段, 简历教育段, 简历证书 } from '../数据/类型';
import type { 附件变更结果 } from '../状态/后端/类型';
import 样式 from './我的简历.module.css';
import 我的简历, { 检查资料完整度 } from './我的简历';

/** 共享实例：断言按 brief 原样写 userEvent.click(...) */
const userEvent = userEventApi.setup();

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());
const 打开附件PDF = vi.hoisted(() => vi.fn());
const mock操作 = {
  刷新附件简历: vi.fn().mockResolvedValue(undefined),
  创建附件简历: vi.fn().mockResolvedValue('已提交'),
  替换附件简历: vi.fn().mockResolvedValue('已提交'),
  删除附件简历: vi.fn().mockResolvedValue('已提交'),
  请求附件解析: vi.fn().mockResolvedValue('已提交'),
  // 候选 onboarding 预填操作探针（Task 8 回归）：本页属日常简历域，
  // 七个预填操作一个都不该被碰 —— 挂上探针只为了让越界调用立刻红
  恢复候选Onboarding预填: vi.fn().mockResolvedValue(undefined),
  激活候选Onboarding预填: vi.fn(),
  同步候选Onboarding解析: vi.fn().mockResolvedValue(undefined),
  重试候选Onboarding预填: vi.fn().mockResolvedValue(undefined),
  继续手填候选Onboarding: vi.fn(),
  确认候选Onboarding预填分区: vi.fn(),
  清候选Onboarding预填: vi.fn(),
};
const 操作 = mock操作;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));
vi.mock('../流程/附件简历预览', () => ({ use附件PDF预览: () => ({ 打开附件PDF }) }));

/** 服务端快照里的 limits（Task 4 同一张 fixture 表） */
const limits = {
  max_files: 3,
  max_file_bytes: 2 * 1024 * 1024,
  accepted_media_types: ['application/pdf'] as ['application/pdf'],
};

type 任意解析状态 = Extract<BFF附件解析状态, { status: string }>['status'];

/** 解析状态 fixture：按 wire 形状补齐必带字段 */
function 解析态(status: 任意解析状态, failure_code: BFF附件解析失败码 = 'parser_temporarily_unavailable'): BFF附件解析状态 {
  if (status === 'not_started') return { status };
  if (status === 'succeeded') return { status, parse_id: `p_${status}`, updated_at: 't' };
  if (status === 'failed') return { status, failure_code, updated_at: 't' };
  return { status, updated_at: 't' };
}

/** 权威库行 fixture */
function 附件行(编号: string, 名称: string, parse: BFF附件解析状态): BFF附件简历 {
  return {
    file_id: 编号,
    display_name: 名称,
    revision: 1,
    current_version: {
      version_id: `v_${编号}`,
      version: 1,
      size_bytes: 1,
      media_type: 'application/pdf',
      sha256: 'a'.repeat(64),
      created_at: 't',
      parse,
    },
    created_at: 't',
    updated_at: 't',
  };
}

const 文件A = 附件行('rf_a', '旧简历A.pdf', 解析态('not_started'));
const 文件B = 附件行('rf_b', '旧简历B.pdf', 解析态('failed', 'parser_temporarily_unavailable'));
const 文件C = 附件行('rf_c', '旧简历C.pdf', 解析态('succeeded'));

/** 单行库：行处于指定解析状态（用于动作矩阵） */
function 库含状态(status: 任意解析状态) {
  return { items: [附件行('rf_x', '状态行.pdf', 解析态(status))], limits };
}

/** 结构化简历的最小合法 fixture：本屏还要渲染基本信息/经历/技能等卡 */
const 简历fixture = {
  基本信息: { 真名: '沈亦舟', 开始工作年: '2024', 身份: '在职' as const },
  简历经历: [] as 简历经历段[],
  简历教育: [] as 简历教育段[],
  简历技能: [] as string[],
  简历证书: [] as 简历证书[],
  个人优势: '',
};

function render我的简历(选项: {
  mode: 'mock' | 'backend';
  library?: { items: BFF附件简历[]; limits: typeof limits } | null;
  /** 覆盖简历基本信息切片（工作年限事实用例只换 身份 / 开始工作年） */
  基本信息?: { 真名?: string; 开始工作年?: string; 身份?: '在校' | '在职' | '离职' };
  /** 覆盖其余简历切片（完整度矩阵用例换 经历/教育/技能/证书） */
  状态覆盖?: Partial<typeof 简历fixture>;
}) {
  const 是后端 = 选项.mode === 'backend';
  mock应用状态 = {
    数据源模式: 选项.mode,
    状态: {
      ...简历fixture,
      ...选项.状态覆盖,
      ...(选项.基本信息
        ? { 基本信息: { ...简历fixture.基本信息, ...选项.基本信息 } }
        : {}),
    },
    后端状态: {
      已登录: 是后端,
      主体: 是后端 ? { subject_id: 'sub_1', last_used_role: 'candidate' } : null,
      附件简历库: 选项.library ?? null,
    },
    操作: mock操作,
    派发: vi.fn(),
  };
  render(
    <MemoryRouter>
      <我的简历 />
    </MemoryRouter>,
  );
}

/** 左滑露出动作按钮（横向位移远超操作区一半 → 打开） */
async function revealActions(序 = 0) {
  const 行 = screen.getAllByTestId('附件简历行')[序];
  fireEvent.pointerDown(行, { clientX: 180, clientY: 20 });
  fireEvent.pointerMove(行, { clientX: 20, clientY: 22 });
  fireEvent.pointerUp(行, { clientX: 20, clientY: 22 });
}

/** 隐藏的附件文件选择框 */
function 附件输入框(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

describe('我的简历 · Mock 演示基线（P2 不动）', () => {
  it('Mock keeps the original one-row demo and explanation interaction', async () => {
    render我的简历({ mode: 'mock' });
    expect(screen.getByText('沈亦舟_简历_2026.pdf')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '添加附件简历' })).toBeNull();
    await userEvent.click(screen.getByText('沈亦舟_简历_2026.pdf'));
    expect(screen.getByText('原型演示：真机上在这里打开系统 PDF 预览。')).toBeTruthy();
  });
});

describe('我的简历 · Backend 附件简历库（P2 Task 6）', () => {
  it('Backend renders server order and exact parse copy, with add only below limit', () => {
    render我的简历({ mode: 'backend', library: { items: [文件A, 文件B], limits } });
    const rows = screen.getAllByTestId('附件简历行');
    expect(rows[0].textContent).toContain(文件A.display_name);
    expect(rows[1].textContent).toContain(文件B.display_name);
    expect(screen.getByText('尚未识别')).toBeTruthy();
    expect(screen.getByText('服务繁忙 · 稍后重试')).toBeTruthy();
    expect(screen.getByRole('button', { name: '添加附件简历' })).toBeTruthy();
    // 行面的 aria-label 覆盖内容拼出来的名字，所以它必须同时带上「哪一份」和「什么状态」——
    // 只给文件名的话读屏用户在按钮浏览模式下会丢掉解析状态那一段
    expect(screen.getByRole('button', { name: '旧简历A.pdf 尚未识别' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '旧简历B.pdf 服务繁忙 · 稍后重试' })).toBeTruthy();
  });

  it.each<[任意解析状态, string[]]>([
    ['not_started', ['解析', '替换', '删除']],
    ['failed', ['重新解析', '替换', '删除']],
    ['pending', ['替换', '删除']],
    ['processing', ['替换', '删除']],
    ['succeeded', ['替换', '删除']],
  ])('offers the closed swipe action matrix for %s', async (status, labels) => {
    render我的简历({ mode: 'backend', library: 库含状态(status) });
    fireEvent.pointerDown(screen.getByTestId('附件简历行'), { clientX: 180, clientY: 20 });
    fireEvent.pointerMove(screen.getByTestId('附件简历行'), { clientX: 20, clientY: 22 });
    fireEvent.pointerUp(screen.getByTestId('附件简历行'), { clientX: 20, clientY: 22 });
    for (const label of labels) expect(screen.getByRole('button', { name: label })).toBeTruthy();
    for (const absent of ['解析', '重新解析', '替换', '删除'].filter((label) => !labels.includes(label))) {
      expect(screen.queryByRole('button', { name: absent })).toBeNull();
    }
  });

  it('delete waits for confirmation and parse waits for processing consent', async () => {
    render我的简历({ mode: 'backend', library: { items: [文件A], limits } });
    await revealActions();
    await userEvent.click(screen.getByRole('button', { name: '删除' }));
    expect(操作.删除附件简历).not.toHaveBeenCalled();
    expect(screen.getByText('删除后无法恢复。')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '删除附件简历' }));
    expect(操作.删除附件简历).toHaveBeenCalledWith(文件A.file_id);
  });

  it('clicking a Backend row opens the authenticated PDF helper', async () => {
    render我的简历({ mode: 'backend', library: { items: [文件A], limits } });
    await userEvent.click(screen.getByTestId('附件简历行'));
    expect(打开附件PDF).toHaveBeenCalledWith(文件A.file_id);
    expect(screen.queryByText(/原型演示/)).toBeNull();
  });

  it('does not emit a success toast when a mutation reports a changed session', async () => {
    操作.删除附件简历.mockResolvedValueOnce('已换代');
    render我的简历({ mode: 'backend', library: { items: [文件A], limits } });
    await revealActions();
    await userEvent.click(screen.getByRole('button', { name: '删除' }));
    mock轻提示.mockClear();
    await userEvent.click(screen.getByRole('button', { name: '删除附件简历' }));
    expect(mock轻提示).not.toHaveBeenCalled();
  });

  it('shows the authoritative empty-library copy in the same card and keeps the add button', () => {
    render我的简历({ mode: 'backend', library: { items: [], limits } });
    expect(screen.getByText('还未上传附件简历')).toBeTruthy();
    expect(screen.getByRole('button', { name: '添加附件简历' })).toBeTruthy();
  });

  it('shows the same empty copy when the snapshot is null and grows no entry point', () => {
    render我的简历({ mode: 'backend' });
    expect(screen.getByText('还未上传附件简历')).toBeTruthy();
    // 快照未到：无从知道 max_files，不渲染 ＋，也不硬编码本地限制
    expect(screen.queryByRole('button', { name: '添加附件简历' })).toBeNull();
  });

  it('hides the add button when the library is at the server file limit', () => {
    render我的简历({ mode: 'backend', library: { items: [文件A, 文件B, 文件C], limits } });
    expect(screen.getAllByTestId('附件简历行')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: '添加附件简历' })).toBeNull();
  });

  it('rejects non-PDF and over-limit adds before consent with zero mutation', async () => {
    render我的简历({ mode: 'backend', library: { items: [], limits } });
    await userEvent.click(screen.getByRole('button', { name: '添加附件简历' }));
    const input = 附件输入框();
    // 扩展名不对（借 PDF MIME 过 accept，让文件到达本地预检）
    await userEvent.upload(input, new File(['text'], 'notes.txt', { type: 'application/pdf' }));
    expect(mock轻提示).toHaveBeenLastCalledWith('请选择 PDF 文件');
    // media type 与扩展名矛盾
    await userEvent.upload(input, new File(['%PDF'], '伪装.pdf', { type: 'image/png' }));
    expect(mock轻提示).toHaveBeenLastCalledWith('请选择 PDF 文件');
    // 超过快照 limits（2 MB）
    await userEvent.upload(input, new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' }));
    expect(mock轻提示).toHaveBeenLastCalledWith('文件不能超过 2 MB');
    expect(screen.queryByText('允许 AI 识别这份简历？')).toBeNull();
    expect(mock操作.创建附件简历).not.toHaveBeenCalled();
  });

  it('rejects an over-limit replacement before consent with zero mutation', async () => {
    render我的简历({ mode: 'backend', library: { items: [文件A], limits } });
    await revealActions();
    await userEvent.click(screen.getByRole('button', { name: '替换' }));
    await userEvent.upload(
      附件输入框(),
      new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' }),
    );
    expect(mock轻提示).toHaveBeenLastCalledWith('文件不能超过 2 MB');
    expect(screen.queryByText('允许 AI 识别这份简历？')).toBeNull();
    expect(mock操作.替换附件简历).not.toHaveBeenCalled();
    expect(mock操作.创建附件简历).not.toHaveBeenCalled();
  });

  it('cancel keeps mutations at zero for add, replace, and parse', async () => {
    render我的简历({ mode: 'backend', library: { items: [文件A], limits } });
    // add：＋ → 选文件 → 授权层 → 取消
    await userEvent.click(screen.getByRole('button', { name: '添加附件简历' }));
    const input = 附件输入框();
    const pdf = new File(['%PDF'], 'mine.pdf', { type: 'application/pdf' });
    await userEvent.upload(input, pdf);
    expect(screen.getByText('允许 AI 识别这份简历？')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(mock操作.创建附件简历).not.toHaveBeenCalled();
    expect(screen.queryByText('允许 AI 识别这份简历？')).toBeNull();
    // replace：左滑 → 替换 → 选文件 → 授权层 → 取消
    await revealActions();
    await userEvent.click(screen.getByRole('button', { name: '替换' }));
    await userEvent.upload(input, pdf);
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(mock操作.替换附件简历).not.toHaveBeenCalled();
    // parse：左滑 → 解析 → 授权层 → 取消
    await revealActions();
    await userEvent.click(screen.getByRole('button', { name: '解析' }));
    expect(screen.getByText('允许 AI 识别这份简历？')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(mock操作.请求附件解析).not.toHaveBeenCalled();
  });

  it('asks the processing consent for explicit parse and passes literal true', async () => {
    render我的简历({ mode: 'backend', library: { items: [文件A], limits } });
    await revealActions();
    await userEvent.click(screen.getByRole('button', { name: '解析' }));
    expect(screen.getByText('允许 AI 识别这份简历？')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '同意并继续' }));
    expect(mock操作.请求附件解析).toHaveBeenCalledWith(文件A.file_id, true);
    await waitFor(() => expect(mock轻提示).toHaveBeenLastCalledWith('已开始识别简历'));
  });

  it('replace locks the file id of the row that triggered the action', async () => {
    render我的简历({ mode: 'backend', library: { items: [文件A, 文件B], limits } });
    await revealActions(0);
    await userEvent.click(screen.getByRole('button', { name: '替换' }));
    const pdf = new File(['%PDF'], 'new.pdf', { type: 'application/pdf' });
    await userEvent.upload(附件输入框(), pdf);
    await userEvent.click(screen.getByRole('button', { name: '同意并继续' }));
    expect(mock操作.替换附件简历).toHaveBeenCalledWith(文件A.file_id, pdf, true);
    expect(mock操作.创建附件简历).not.toHaveBeenCalled();
    await waitFor(() => expect(mock轻提示).toHaveBeenLastCalledWith('简历已上传，正在识别'));
  });

  it('creates from the title plus button after consent and toasts the frozen success copy', async () => {
    render我的简历({ mode: 'backend', library: { items: [], limits } });
    await userEvent.click(screen.getByRole('button', { name: '添加附件简历' }));
    const pdf = new File(['%PDF'], 'mine.pdf', { type: 'application/pdf' });
    await userEvent.upload(附件输入框(), pdf);
    await userEvent.click(screen.getByRole('button', { name: '同意并继续' }));
    expect(mock操作.创建附件简历).toHaveBeenCalledWith(pdf, true);
    await waitFor(() => expect(mock轻提示).toHaveBeenLastCalledWith('简历已上传，正在识别'));
  });

  it('surfaces the closed 附件错误文案 when a mutation rejects', async () => {
    mock操作.创建附件简历.mockRejectedValueOnce(new BFF错误(503, 'storage_unavailable', 'sha256=… 内部细节'));
    render我的简历({ mode: 'backend', library: { items: [], limits } });
    await userEvent.click(screen.getByRole('button', { name: '添加附件简历' }));
    await userEvent.upload(附件输入框(), new File(['%PDF'], 'mine.pdf', { type: 'application/pdf' }));
    await userEvent.click(screen.getByRole('button', { name: '同意并继续' }));
    // 失败只提示闭合文案，不透出服务端内部细节
    await waitFor(() => expect(mock轻提示).toHaveBeenLastCalledWith('附件服务暂时不可用，请稍后重试'));
  });

  it('opens only one swipe row at a time', async () => {
    render我的简历({ mode: 'backend', library: { items: [文件A, 文件B], limits } });
    await revealActions(0);
    await revealActions(1);
    const 行面们 = screen.getAllByTestId('附件简历行').map((行) => 行.parentElement as HTMLElement);
    expect(行面们[0].getAttribute('aria-expanded')).toBe('false');
    expect(行面们[1].getAttribute('aria-expanded')).toBe('true');
  });

  it('ignores repeated confirm clicks while a mutation is in flight', async () => {
    let 解决删除!: (值: 附件变更结果) => void;
    mock操作.删除附件简历.mockImplementationOnce(
      () => new Promise<附件变更结果>((解决) => { 解决删除 = 解决; }),
    );
    render我的简历({ mode: 'backend', library: { items: [文件A], limits } });
    await revealActions();
    await userEvent.click(screen.getByRole('button', { name: '删除' }));
    await userEvent.click(screen.getByRole('button', { name: '删除附件简历' }));
    expect(mock操作.删除附件简历).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: '删除附件简历' }));
    expect(mock操作.删除附件简历).toHaveBeenCalledTimes(1); // handler guard：只发一次
    解决删除('已提交');
    await waitFor(() => expect(mock轻提示).toHaveBeenLastCalledWith('附件简历已删除'));
  });

  it('never renders the legacy demo filename in Backend mode', () => {
    render我的简历({ mode: 'backend', library: { items: [文件A], limits } });
    expect(screen.queryByText('沈亦舟_简历_2026.pdf')).toBeNull();
  });

  it('keeps the card title classes on the same title node', () => {
    render我的简历({ mode: 'backend', library: { items: [文件A], limits } });
    const className = screen.getByTestId('附件简历标题').className;
    expect(className).toContain(样式.卡标题);
    expect(className).toContain(样式.附件标题行);
  });
});

describe('我的简历 · 工作年限事实（未填不伪造）', () => {
  const 当前年 = new Date().getFullYear();

  it.each([
    ['', '未填写'],
    ['abc', '未填写'],
    ['0', '未填写'],
    ['2024.5', '未填写'],
    [String(当前年 + 1), '未填写'],
  ] as const)('非学生开始工作年 %s → %s（不用当前年补文本）', (开始工作年, 期望) => {
    render我的简历({ mode: 'backend', 基本信息: { 开始工作年 } });
    expect(screen.getByText(期望)).toBeTruthy();
  });

  it('非学生当前年开始工作 → 0 年 · 自当前年起', () => {
    render我的简历({ mode: 'backend', 基本信息: { 开始工作年: String(当前年) } });
    expect(screen.getByText(`0 年 · 自 ${当前年} 年起`)).toBeTruthy();
  });

  it('非学生正常过去年份 → 真实年限与起始年', () => {
    render我的简历({ mode: 'backend', 基本信息: { 开始工作年: String(当前年 - 8) } });
    expect(screen.getByText(`8 年 · 自 ${当前年 - 8} 年起`)).toBeTruthy();
  });

  it('在校身份保持学生文案，不看开始工作年', () => {
    render我的简历({ mode: 'backend', 基本信息: { 身份: '在校', 开始工作年: '' } });
    expect(screen.getByText('应届 · 在校')).toBeTruthy();
  });
});

// ── 资料完整度（Plan 5 Task 2）：待补全 vs 可提升 的纯函数矩阵 + Backend 页面投影 ──

const 教育样本: 简历教育段 = {
  编号: 'edu_1', 学校: '示例大学', 学历: '本科', 专业: '计算机',
  开始: '2016-09', 结束: '2020-06',
};

function 造经历(count: number): 简历经历段[] {
  return Array.from({ length: count }, (_, index) => ({
    编号: `exp_${index}`, 公司: '示例公司', 行业: '软件', 职位: '工程师',
    开始: '2020-01', 结束: '2022-01', 内容: '负责平台开发', 隐藏: false,
    项目: [{ 编号: `project_${index}`, 名称: '平台', 角色: '开发', 结果: '按期上线' }],
  }));
}

function 造证书(count: number): 简历证书[] {
  return Array.from({ length: count }, (_, index) => ({
    编号: `cert_${index}`, 名称: '示例证书', 年份: '2024',
  }));
}

describe('检查资料完整度 · 身份 × 经历 × 证书矩阵', () => {
  it.each<[基本信息类型['身份'], number, number, number]>([
    ['在校', 0, 0, 0],
    ['在职', 0, 0, 1],
    ['离职', 1, 0, 0],
  ])('%s + %i 段经历 + %i 证书', (身份, 经历数, 证书数, 工作缺口数) => {
    const result = 检查资料完整度({
      基本信息: { 真名: '张三', 开始工作年: 身份 === '在校' ? '' : '2020', 身份 },
      经历: 造经历(经历数),
      教育: [教育样本],
      技能: ['TypeScript'],
      证书: 造证书(证书数),
    });
    expect(result.待补全.filter((项) => /工作/.test(项.文案))).toHaveLength(工作缺口数);
    expect(result.待补全.some((项) => /证书/.test(项.文案))).toBe(false);
    expect(result.可提升.some((项) => /证书/.test(项.文案))).toBe(证书数 === 0);
  });

  it('已有经历但内容为空 → 待补全', () => {
    const result = 检查资料完整度({
      基本信息: { 真名: '张三', 开始工作年: '2020', 身份: '在职' },
      经历: [{ ...造经历(1)[0], 内容: '' }],
      教育: [教育样本],
      技能: ['TypeScript'],
      证书: 造证书(1),
    });
    expect(result.待补全.some((项) => /工作内容/.test(项.文案))).toBe(true);
    expect(result.可提升.some((项) => /工作内容/.test(项.文案))).toBe(false);
  });

  it('至少一段经历且所有项目为空 → 可提升，不进待补全', () => {
    const result = 检查资料完整度({
      基本信息: { 真名: '张三', 开始工作年: '2020', 身份: '离职' },
      经历: 造经历(2).map((段) => ({ ...段, 项目: [] })),
      教育: [教育样本],
      技能: ['TypeScript'],
      证书: 造证书(1),
    });
    expect(result.可提升.some((项) => /关键项目/.test(项.文案))).toBe(true);
    expect(result.待补全.some((项) => /关键项目/.test(项.文案))).toBe(false);
  });

  it('技能 0 → 待补全；技能 1/4/5 都不因数量产生提示', () => {
    const 完整输入 = (技能: string[]) => ({
      基本信息: { 真名: '张三', 开始工作年: '2020', 身份: '在职' as const },
      经历: 造经历(1),
      教育: [教育样本],
      技能,
      证书: 造证书(1),
    });
    for (const 技能 of [['TypeScript'], ['一', '二', '三', '四'], ['一', '二', '三', '四', '五']]) {
      expect(检查资料完整度(完整输入(技能)).待补全.some((项) => /专业技能/.test(项.文案))).toBe(false);
    }
    expect(检查资料完整度(完整输入([])).待补全.some((项) => /专业技能还没填写/.test(项.文案))).toBe(true);
  });

  it('证书永不增加待补全计数（0/1/3 份都只有可提升建议）', () => {
    for (const 证书数 of [0, 1, 3]) {
      const result = 检查资料完整度({
        基本信息: { 真名: '张三', 开始工作年: '2020', 身份: '在职' },
        经历: 造经历(1),
        教育: [教育样本],
        技能: ['TypeScript'],
        证书: 造证书(证书数),
      });
      expect(result.待补全.filter((项) => /证书/.test(项.文案))).toHaveLength(0);
    }
  });

  it('学生豁免只认 身份 === 在校：在职空开始工作年仍进待补全', () => {
    const 在职 = 检查资料完整度({
      基本信息: { 真名: '张三', 开始工作年: '', 身份: '在职' },
      经历: 造经历(1),
      教育: [教育样本],
      技能: ['TypeScript'],
      证书: 造证书(1),
    });
    expect(在职.待补全.some((项) => /开始工作年/.test(项.文案))).toBe(true);
    const 在校 = 检查资料完整度({
      基本信息: { 真名: '张三', 开始工作年: '', 身份: '在校' },
      经历: [],
      教育: [教育样本],
      技能: ['TypeScript'],
      证书: 造证书(1),
    });
    expect(在校.待补全.some((项) => /开始工作年|工作经历/.test(项.文案))).toBe(false);
  });
});

describe('我的简历 · Backend 资料完整度检查', () => {
  it('零待补全 + 零证书：标题「资料已补全」、摘要标可提升、按钮「看建议」', async () => {
    render我的简历({
      mode: 'backend',
      状态覆盖: { 简历经历: 造经历(1), 简历教育: [教育样本], 简历技能: ['TypeScript'], 简历证书: [] },
    });
    expect(screen.getByText('◈ 资料完整度检查 · 资料已补全')).toBeTruthy();
    // Backend 标题不出现「AI代理诊断」
    expect(screen.queryByText(/AI代理诊断/)).toBeNull();
    expect(screen.getByText('可提升 · 如有资格证书，可以补充（选填）')).toBeTruthy();
    expect(screen.getByRole('button', { name: '看建议' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '看建议' }));
    // 摘要与列表行同文案：展开后各一处
    expect(screen.getAllByText('可提升 · 如有资格证书，可以补充（选填）')).toHaveLength(2);
    expect(screen.getByText('去完善 ›')).toBeTruthy();
    // DOM 中不出现无类别前缀的裸建议
    expect(screen.queryByText('如有资格证书，可以补充（选填）')).toBeNull();
  });

  it('有待补全：标题计数只读待补全，展开行带类别前缀与「去补 ›」', async () => {
    render我的简历({ mode: 'backend' });
    // 缺省简历：经历/教育/技能全空 → 3 处待补全；证书 0 → 1 条可提升
    expect(screen.getByText('◈ 资料完整度检查 · 3 处待补全')).toBeTruthy();
    expect(screen.getByText('待补全 · 工作经历还没填写')).toBeTruthy();
    expect(screen.getByRole('button', { name: '去补全' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '去补全' }));
    expect(screen.getByText('待补全 · 专业技能还没填写')).toBeTruthy();
    expect(screen.getByText('待补全 · 教育经历还没填写')).toBeTruthy();
    expect(screen.getByText('可提升 · 如有资格证书，可以补充（选填）')).toBeTruthy();
    // 三行待补全各带一个「去补 ›」，可提升行带唯一的「去完善 ›」
    expect(screen.getAllByText('去补 ›')).toHaveLength(3);
    expect(screen.getByText('去完善 ›')).toBeTruthy();
  });

  it('Mock 保留 AI代理诊断 原型标题与口径', () => {
    render我的简历({ mode: 'mock' });
    expect(screen.getByText(/AI代理诊断/)).toBeTruthy();
    expect(screen.queryByText(/资料完整度检查/)).toBeNull();
  });
});

/** 七个候选 onboarding 预填操作零调用（我的简历 属日常简历域，绝不触发 onboarding 预填） */
function 零预填操作() {
  expect(mock操作.恢复候选Onboarding预填).not.toHaveBeenCalled();
  expect(mock操作.激活候选Onboarding预填).not.toHaveBeenCalled();
  expect(mock操作.同步候选Onboarding解析).not.toHaveBeenCalled();
  expect(mock操作.重试候选Onboarding预填).not.toHaveBeenCalled();
  expect(mock操作.继续手填候选Onboarding).not.toHaveBeenCalled();
  expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
  expect(mock操作.清候选Onboarding预填).not.toHaveBeenCalled();
}

describe('我的简历 · 候选 onboarding 预填边界（Task 8 日常域隔离回归）', () => {
  it('daily resume reparse never activates onboarding prefill', async () => {
    render我的简历({ mode: 'backend', library: { items: [文件B], limits } });
    await revealActions();
    await userEvent.click(screen.getByRole('button', { name: '重新解析' }));
    await userEvent.click(screen.getByRole('button', { name: '同意并继续' }));
    expect(mock操作.请求附件解析).toHaveBeenCalledTimes(1);
    expect(mock操作.激活候选Onboarding预填).not.toHaveBeenCalled();
    expect(mock操作.同步候选Onboarding解析).not.toHaveBeenCalled();
  });

  it('upload, replace, and reparse never call a prefill operation or write recovery metadata', async () => {
    // 恢复元数据只能落在 AGXP候选预填恢复v1:{mode}:{env}:{account} 键上
    //（候选Onboarding预填恢复.ts 的 账号存储键 推导）：日常域一次都不该写。
    // 注意：本环境（Node 原生实验 sessionStorage + vitest jsdom）里 setItem 不经
    // 任何可 spyOn 的原型层，Storage.prototype 探针收不到调用 —— 改用终态枚举断言
    render我的简历({ mode: 'backend', library: { items: [文件B], limits } });
    // replace：左滑 → 替换 → 选文件 → 授权同意
    await revealActions();
    await userEvent.click(screen.getByRole('button', { name: '替换' }));
    await userEvent.upload(附件输入框(), new File(['%PDF'], 'new.pdf', { type: 'application/pdf' }));
    await userEvent.click(screen.getByRole('button', { name: '同意并继续' }));
    await waitFor(() => expect(mock操作.替换附件简历).toHaveBeenCalledTimes(1));
    // upload：标题 ＋ → 选文件 → 授权同意
    await userEvent.click(screen.getByRole('button', { name: '添加附件简历' }));
    await userEvent.upload(附件输入框(), new File(['%PDF'], 'mine.pdf', { type: 'application/pdf' }));
    await userEvent.click(screen.getByRole('button', { name: '同意并继续' }));
    await waitFor(() => expect(mock操作.创建附件简历).toHaveBeenCalledTimes(1));
    // explicit reparse：左滑 → 重新解析 → 授权同意
    await revealActions();
    await userEvent.click(screen.getByRole('button', { name: '重新解析' }));
    await userEvent.click(screen.getByRole('button', { name: '同意并继续' }));
    await waitFor(() => expect(mock操作.请求附件解析).toHaveBeenCalledTimes(1));
    // 日常域隔离：七个预填操作零调用 + 恢复元数据存储键零残留
    零预填操作();
    expect(Object.keys(sessionStorage).filter((键) => 键.startsWith('AGXP候选预填恢复v1:'))).toEqual([]);
  });
});
