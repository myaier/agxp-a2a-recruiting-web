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
import type { 附件变更结果 } from '../状态/后端/类型';
import 样式 from './我的简历.module.css';
import 我的简历 from './我的简历';

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
  简历经历: [],
  简历教育: [],
  简历技能: [],
  简历证书: [],
  个人优势: '',
};

function render我的简历(选项: {
  mode: 'mock' | 'backend';
  library?: { items: BFF附件简历[]; limits: typeof limits } | null;
}) {
  const 是后端 = 选项.mode === 'backend';
  mock应用状态 = {
    数据源模式: 选项.mode,
    状态: { ...简历fixture },
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
