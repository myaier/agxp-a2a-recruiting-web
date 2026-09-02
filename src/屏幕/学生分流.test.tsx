// 学生分流 Backend onboarding 测试（review-r2 R2-I-1）：
// Backend 引导预填=null 时 城市们 不再回落到 ['上海']（无引用的默认串），
// 未选城市/职位引用时「下一步」被阻断，不派发带默认串无引用的 启程引导。
// Mock 分支保留 ['上海'] 默认。
//
// P2 Task 5：附件简历上传接线 —— Backend 空库创建 / 非空替换 items[0]，
// 上传前本地预检 + 授权确认层（文案冻结），取消零 mutation、失败走 附件错误文案、
// 已换代静默；Mock 分支逐字保留 存简历文件名 行为（防漂移回归）。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF附件简历 } from '../数据/BFF契约';
import { BFF错误 } from '../数据/HTTP客户端';
import 学生分流 from './学生分流';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());
const mock操作 = {
  刷新附件简历: vi.fn().mockResolvedValue(undefined),
  创建附件简历: vi.fn().mockResolvedValue('已提交'),
  替换附件简历: vi.fn().mockResolvedValue('已提交'),
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

/** 服务端快照里的 limits（Task 4 同一张 fixture 表） */
const limits = {
  max_files: 3,
  max_file_bytes: 2 * 1024 * 1024,
  accepted_media_types: ['application/pdf'] as ['application/pdf'],
};

/** 权威库行 fixture：parse 终态（succeeded），不会触发 刷新钩子 的轮询 */
function 附件行(编号: string, 名称: string): BFF附件简历 {
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
      parse: { status: 'succeeded', parse_id: `p_${编号}`, updated_at: 't' },
    },
    created_at: 't',
    updated_at: 't',
  };
}

const 文件A = 附件行('rf_a', '旧简历A.pdf');
const 文件B = 附件行('rf_b', '旧简历B.pdf');

/** 城市与职位引用齐备的 引导预填（下一步可点） */
const 完整预填 = {
  城市们: ['上海'],
  职位: ['产品经理'],
  城市引用们: [{ id: 'loc_sh', display_name: '上海' }],
  职位引用们: [{ id: 'tax_pm', display_name: '产品经理' }],
  筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['现场'] },
};

function render学生分流(选项: {
  数据源: 'backend' | 'mock';
  引导预填?: unknown;
  基本信息?: { 身份: '在校' | '在职' };
  附件库?: { items: BFF附件简历[]; limits: typeof limits } | null;
}) {
  const 派发 = vi.fn();
  const 是后端 = 选项.数据源 === 'backend';
  mock应用状态 = {
    数据源模式: 选项.数据源,
    状态: {
      引导预填: 选项.引导预填 ?? null,
      基本信息: 选项.基本信息 ?? { 身份: '在职' },
      简历经历: [],
      简历教育: [],
      简历技能: [],
      简历证书: [],
      简历文件名: '',
      个人优势: '',
      简历作品集链接: '',
    },
    后端状态: {
      已登录: 是后端,
      主体: 是后端 ? { subject_id: 'sub_1', last_used_role: 'candidate' } : null,
      附件简历库: 选项.附件库 ?? null,
    },
    操作: mock操作,
    派发,
  };
  render(
    <MemoryRouter>
      <学生分流 />
    </MemoryRouter>,
  );
  return { 派发 };
}

/** 仓库未装 @testing-library/jest-dom，用 DOM 属性直接断言禁用态 */
function 禁用(按钮: HTMLElement): boolean {
  return (按钮 as HTMLButtonElement).disabled;
}

describe('学生分流 Backend onboarding（R2-I-1）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('Backend 引导预填=null 时城市行显示占位（不显示默认上海）', () => {
    render学生分流({ 数据源: 'backend' });
    // 城市行显示「选择工作城市」占位，而非默认串「上海」
    expect(screen.getByText('选择工作城市')).toBeTruthy();
  });

  it('Backend 引导预填=null 时下一步按钮禁用，不派发启程引导', async () => {
    const { 派发 } = render学生分流({ 数据源: 'backend' });
    const 用户 = userEvent.setup();
    const 下一步 = screen.getByRole('button', { name: '下一步' });
    expect(禁用(下一步)).toBe(true);
    await 用户.click(下一步);
    expect(派发).not.toHaveBeenCalled();
  });

  it('Backend 选了职位但没选城市时下一步仍禁用（城市引用们为空）', () => {
    const { 派发 } = render学生分流({
      数据源: 'backend',
      引导预填: {
        城市们: [],
        职位: ['产品经理'],
        职位引用们: [{ id: 'tax_pm', display_name: '产品经理' }],
        城市引用们: [],
        筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['现场'] },
      },
    });
    const 下一步 = screen.getByRole('button', { name: '下一步' });
    expect(禁用(下一步)).toBe(true);
    expect(派发).not.toHaveBeenCalled();
  });

  it('Backend 城市与职位引用齐备时下一步可点且派发携带引用的启程引导', async () => {
    const { 派发 } = render学生分流({
      数据源: 'backend',
      引导预填: {
        城市们: ['上海'],
        职位: ['产品经理'],
        城市引用们: [{ id: 'loc_sh', display_name: '上海' }],
        职位引用们: [{ id: 'tax_pm', display_name: '产品经理' }],
        筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['现场'] },
      },
    });
    const 用户 = userEvent.setup();
    const 下一步 = screen.getByRole('button', { name: '下一步' });
    expect(禁用(下一步)).toBe(false);
    await 用户.click(下一步);
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '启程引导',
        城市引用们: [{ id: 'loc_sh', display_name: '上海' }],
        职位引用们: [{ id: 'tax_pm', display_name: '产品经理' }],
      }),
    );
  });
});

describe('学生分流 Mock onboarding（R2-I-1 回归）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('Mock 引导预填=null 时城市行仍显示默认上海（Mock 保留旧默认）', () => {
    render学生分流({ 数据源: 'mock' });
    // Mock 保留 ['上海'] 默认：城市行不显示占位
    expect(screen.queryByText('选择工作城市')).toBeNull();
    // 城市行里有「上海」
    const 城市按钮 = screen.getByText('上海');
    expect(城市按钮).toBeTruthy();
  });
});

describe('学生分流 预计毕业时间弹层（可访问滚轮）', () => {
  it('预计毕业时间弹层把毕业年和毕业月接入真实 Tab 顺序', async () => {
    const 用户 = userEvent.setup();
    render学生分流({
      数据源: 'backend',
      基本信息: { 身份: '在校' },
      引导预填: {
        ...完整预填,
        筛选偏好: {
          ...完整预填.筛选偏好,
          求职类型: ['校园招聘'],
          毕业时间: '2027-06',
        },
      },
    });
    await 用户.click(screen.getByRole('button', { name: /2027 年 06 月/ }));
    const 取消 = screen.getByRole('button', { name: '取消' });
    const 完成 = screen.getByRole('button', { name: '完成' });
    const 年列 = screen.getByRole('listbox', { name: '毕业年' });
    const 月列 = screen.getByRole('listbox', { name: '毕业月' });

    expect(document.activeElement).toBe(取消);
    await 用户.tab();
    expect(document.activeElement).toBe(完成);
    await 用户.tab();
    expect(document.activeElement).toBe(年列);
    await 用户.tab();
    expect(document.activeElement).toBe(月列);
  });
});

describe('学生分流 附件简历上传（P2 Task 5）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('Backend empty library validates, asks consent, then creates with literal true', async () => {
    const 用户 = userEvent.setup();
    render学生分流({ 数据源: 'backend', 附件库: { items: [], limits } });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File(['%PDF'], 'mine.pdf', { type: 'application/pdf' });
    await 用户.upload(input, pdf);
    expect(screen.getByText('允许 AI 识别这份简历？')).toBeTruthy();
    expect(mock操作.创建附件简历).not.toHaveBeenCalled();
    await 用户.click(screen.getByRole('button', { name: '同意并继续' }));
    expect(mock操作.创建附件简历).toHaveBeenCalledWith(pdf, true);
    expect(mock操作.替换附件简历).not.toHaveBeenCalled();
  });

  it('Backend nonempty library replaces items[0], keeps display name, and does not block Next', async () => {
    const 用户 = userEvent.setup();
    render学生分流({ 数据源: 'backend', 附件库: { items: [文件A, 文件B], limits }, 引导预填: 完整预填 });
    expect(screen.getByText(文件A.display_name)).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File(['%PDF'], 'different.pdf', { type: 'application/pdf' });
    await 用户.upload(input, pdf);
    await 用户.click(screen.getByRole('button', { name: '同意并继续' }));
    expect(mock操作.替换附件简历).toHaveBeenCalledWith(文件A.file_id, pdf, true);
    expect(screen.getByRole('button', { name: '下一步' })).not.toHaveProperty('disabled', true);
  });

  it('cancel consent performs no mutation and clears the input for choosing the same file again', async () => {
    const 用户 = userEvent.setup();
    render学生分流({ 数据源: 'backend', 附件库: { items: [], limits } });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File(['%PDF'], 'mine.pdf', { type: 'application/pdf' });
    await 用户.upload(input, pdf);
    await 用户.click(screen.getByRole('button', { name: '取消' }));
    expect(mock操作.创建附件简历).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('Mock preserves legacy copy, reducer action, and has no consent dialog', async () => {
    const 用户 = userEvent.setup();
    const { 派发 } = render学生分流({ 数据源: 'mock' });
    expect(screen.getByText('这张表我来填')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await 用户.upload(input, new File(['%PDF'], 'demo.pdf', { type: 'application/pdf' }));
    expect(派发).toHaveBeenCalledWith({ 型: '存简历文件名', 文件名: 'demo.pdf' });
    expect(screen.queryByText('允许 AI 识别这份简历？')).toBeNull();
  });

  it('does not toast success when an upload finishes after the session changed', async () => {
    const 用户 = userEvent.setup();
    mock操作.创建附件简历.mockResolvedValueOnce('已换代');
    render学生分流({ 数据源: 'backend', 附件库: { items: [], limits } });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await 用户.upload(input, new File(['%PDF'], 'stale.pdf', { type: 'application/pdf' }));
    mock轻提示.mockClear();
    await 用户.click(screen.getByRole('button', { name: '同意并继续' }));
    await waitFor(() => expect(mock操作.创建附件简历).toHaveBeenCalledTimes(1));
    expect(mock轻提示).not.toHaveBeenCalled();
  });

  it('closes the consent layer after a 401 so no doomed mutation can be re-fired', async () => {
    const 用户 = userEvent.setup();
    mock操作.创建附件简历.mockRejectedValueOnce(new BFF错误(401, 'invalid_session', 'expired'));
    render学生分流({ 数据源: 'backend', 附件库: { items: [], limits } });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await 用户.upload(input, new File(['%PDF'], 'expired.pdf', { type: 'application/pdf' }));
    await 用户.click(screen.getByRole('button', { name: '同意并继续' }));
    await waitFor(() => expect(mock操作.创建附件简历).toHaveBeenCalledTimes(1));
    // 401 时操作层已清账号（Spec §10.1 待处理文件一并失效）：授权层必须关掉
    await waitFor(() => expect(screen.queryByText('允许 AI 识别这份简历？')).toBeNull());
  });

  it('rejects invalid extension, media type, and over-limit files before consent with zero mutation', async () => {
    const 用户 = userEvent.setup();
    render学生分流({ 数据源: 'backend', 附件库: { items: [], limits } });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    // 扩展名不对（MIME 过 accept 模拟、扩展名被本地预检拦下：浏览器里 accept 是第一道门，
    // user-event 会按 accept 丢弃 text/plain，故这里用 PDF MIME 让它到达预检）
    await 用户.upload(input, new File(['text'], 'notes.txt', { type: 'application/pdf' }));
    expect(mock轻提示).toHaveBeenLastCalledWith('请选择 PDF 文件');
    // media type 与扩展名矛盾
    await 用户.upload(input, new File(['%PDF'], '伪装.pdf', { type: 'image/png' }));
    expect(mock轻提示).toHaveBeenLastCalledWith('请选择 PDF 文件');
    // 超过快照 limits（2 MB）
    await 用户.upload(input, new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' }));
    expect(mock轻提示).toHaveBeenLastCalledWith('文件不能超过 2 MB');

    // 全部在授权层之前拦截：零 mutation、零授权层
    expect(screen.queryByText('允许 AI 识别这份简历？')).toBeNull();
    expect(mock操作.创建附件简历).not.toHaveBeenCalled();
    expect(mock操作.替换附件简历).not.toHaveBeenCalled();
  });

  it('keeps the slot display name in the row echo and uses 附件错误文案 when the mutation rejects', async () => {
    const 用户 = userEvent.setup();
    mock操作.替换附件简历.mockRejectedValueOnce(new BFF错误(503, 'storage_unavailable', 'sha256=… 内部细节'));
    render学生分流({ 数据源: 'backend', 附件库: { items: [文件A, 文件B], limits }, 引导预填: 完整预填 });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await 用户.upload(input, new File(['%PDF'], 'different.pdf', { type: 'application/pdf' }));
    await 用户.click(screen.getByRole('button', { name: '同意并继续' }));
    // 失败只提示闭合文案，不透出服务端内部细节
    await waitFor(() => expect(mock轻提示).toHaveBeenLastCalledWith('附件服务暂时不可用，请稍后重试'));
    // 行回显仍是权威行的展示名，picked filename 不上屏；确认层保留（可重试）
    expect(screen.getByText(文件A.display_name)).toBeTruthy();
    expect(screen.queryByText('different.pdf')).toBeNull();
    expect(screen.getByRole('button', { name: '同意并继续' })).toBeTruthy();
  });

  it('ignores repeated confirm clicks while in flight and flags aria-busy', async () => {
    const 用户 = userEvent.setup();
    let 解决创建!: (值: '已提交') => void;
    mock操作.创建附件简历.mockImplementationOnce(
      () => new Promise<'已提交'>((解决) => { 解决创建 = 解决; }),
    );
    render学生分流({ 数据源: 'backend', 附件库: { items: [], limits } });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await 用户.upload(input, new File(['%PDF'], 'mine.pdf', { type: 'application/pdf' }));
    const 执行键 = screen.getByRole('button', { name: '同意并继续' });
    await 用户.click(执行键);
    expect(mock操作.创建附件简历).toHaveBeenCalledTimes(1);
    // 在飞期间外层带 aria-busy=true（不新增 spinner）
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    await 用户.click(执行键);
    expect(mock操作.创建附件简历).toHaveBeenCalledTimes(1); // handler guard：只发一次
    解决创建('已提交');
    await waitFor(() => expect(mock轻提示).toHaveBeenLastCalledWith('简历已上传，正在识别'));
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('shows the empty-library copy when the snapshot is null and lets the server adjudicate size', async () => {
    const 用户 = userEvent.setup();
    render学生分流({ 数据源: 'backend' });
    // 快照未到：空库占位文案（不硬编码本地大小限制）
    expect(screen.getByText('确认后开始识别')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const 大文件 = new File([new Uint8Array(3 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
    await 用户.upload(input, 大文件);
    // 本地无 limits 可查，不做大小拦截，交由服务端裁决
    expect(screen.getByText('允许 AI 识别这份简历？')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '同意并继续' }));
    await waitFor(() => expect(mock操作.创建附件简历).toHaveBeenCalledWith(大文件, true));
  });
});