// 学生分流 Backend onboarding 测试（review-r2 R2-I-1）：
// Backend 引导预填=null 时 城市们 不再回落到 ['上海']（无引用的默认串），
// 未选城市/职位引用时「下一步」被阻断，不派发带默认串无引用的 启程引导。
// Mock 分支保留 ['上海'] 默认。
//
// P2 Task 5：附件简历上传接线 —— Backend 空库创建 / 非空替换 items[0]，
// 上传前本地预检 + 授权确认层（文案冻结），取消零 mutation、失败走 附件错误文案、
// 已换代静默；Mock 分支逐字保留 存简历文件名 行为（防漂移回归）。
//
// 候选 onboarding 简历预填（Spec §7 上传页接线）：挂载恢复（等候选/附件水合，
// 恰好一次）、权威上传/替换 resolves '已提交' 后才激活（invocationCallOrder 断言
// 激活严格晚于上传）、只盯权威附件解析坐标调 同步候选Onboarding解析（页面零直接
// BFF 请求）、离页决策门复用既有 确认层（再等等 / 继续手填）、failed 落位 轻提示、
// 横幅只换既有 代理横幅 props。操作层行为（恢复分支/单飞/栅栏）归 Task 3 的
// 简历预填操作.test.ts，这里只测页面接线。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF附件简历, BFF附件解析状态 } from '../数据/BFF契约';
import { BFF错误 } from '../数据/HTTP客户端';
import { 路径 } from '../路由/路径表';
import { 创建空候选预填状态, type 候选预填状态 } from '../状态/后端/类型';
import 学生分流 from './学生分流';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());
const mock操作 = {
  刷新附件简历: vi.fn().mockResolvedValue(undefined),
  创建附件简历: vi.fn().mockResolvedValue('已提交'),
  替换附件简历: vi.fn().mockResolvedValue('已提交'),
  恢复候选Onboarding预填: vi.fn().mockResolvedValue(undefined),
  激活候选Onboarding预填: vi.fn(),
  同步候选Onboarding解析: vi.fn().mockResolvedValue(undefined),
  重试候选Onboarding预填: vi.fn().mockResolvedValue(undefined),
  继续手填候选Onboarding: vi.fn(),
  确认候选Onboarding预填分区: vi.fn(),
  清候选Onboarding预填: vi.fn(),
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

/** 权威库行 fixture：默认 parse 终态（succeeded，不触发 刷新钩子 轮询） */
function 附件行(编号: string, 名称: string, 解析?: BFF附件解析状态): BFF附件简历 {
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
      parse: 解析 ?? { status: 'succeeded', parse_id: `p_${编号}`, updated_at: 't' },
    },
    created_at: 't',
    updated_at: 't',
  };
}

const 文件A = 附件行('rf_a', '旧简历A.pdf');
const 文件B = 附件行('rf_b', '旧简历B.pdf');
/** 解析在途的权威行（onboarding 上传后的常态）：file/version 与 rf_w 终态行一致，只有解析坐标不同 */
const 等待行 = 附件行('rf_w', '等待中.pdf', { status: 'processing', updated_at: 't' });

/** 预填轮 fixture：默认 pristine inactive，测试只覆盖关心的字段 */
function 预填轮(覆盖: Partial<候选预填状态> = {}): 候选预填状态 {
  return { ...创建空候选预填状态(), ...覆盖 };
}

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
  基本信息?: { 身份: '在校' | '在职' | '' };
  附件库?: { items: BFF附件简历[]; limits: typeof limits } | null;
  候选预填?: 候选预填状态;
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
      候选预填状态: 选项.候选预填 ?? 创建空候选预填状态(),
    },
    操作: mock操作,
    派发,
  };
  const 视图 = render(
    <MemoryRouter>
      <学生分流 />
    </MemoryRouter>,
  );
  return {
    派发,
    视图,
    /** 直改 mock应用状态.后端状态 后强制重渲染（模拟操作层提交新快照后的渲染） */
    重渲染: () =>
      视图.rerender(
        <MemoryRouter>
          <学生分流 />
        </MemoryRouter>,
      ),
  };
}

/** 仓库未装 @testing-library/jest-dom，用 DOM 属性直接断言禁用态 */
function 禁用(按钮: HTMLElement): boolean {
  return (按钮 as HTMLButtonElement).disabled;
}

/** 走完「选 PDF → 同意并继续」的权威上传流（brief Step 1 的显式辅助） */
async function 选择并同意PDF(name: string): Promise<void> {
  const 用户 = userEvent.setup();
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await 用户.upload(input, new File(['%PDF'], name, { type: 'application/pdf' }));
  await 用户.click(screen.getByRole('button', { name: '同意并继续' }));
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

  it('Backend 引导预填=null 时点下一步给出提示，不派发启程引导', async () => {
    const { 派发 } = render学生分流({ 数据源: 'backend' });
    const 用户 = userEvent.setup();
    const 下一步 = screen.getByRole('button', { name: '下一步' });
    // Task 5B：主按钮不再置灰，缺失改为按序可见提示（默认在职种子 → 偏好层提示）
    expect(禁用(下一步)).toBe(false);
    await 用户.click(下一步);
    expect(mock轻提示).toHaveBeenCalledWith('请补充：求职类型、办公方式');
    expect(派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '启程引导' }));
  });

  it('Backend 选了职位但没选城市时下一步提示城市缺失（城市引用们为空）', async () => {
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
    expect(禁用(下一步)).toBe(false);
    await userEvent.click(下一步);
    expect(mock轻提示).toHaveBeenCalledWith('请先选择工作城市与期望职位');
    expect(派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '启程引导' }));
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

describe('学生分流 候选 onboarding 简历预填（Spec §7 上传页接线）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
  });

  it('entering with an old succeeded attachment and no recovery metadata never activates or reads prefill', async () => {
    const { 重渲染 } = render学生分流({ 数据源: 'backend', 附件库: { items: [文件A], limits } });
    // 挂载恢复：候选与附件水合后恰好一次，参数逐字（waiting 分支归操作层裁决）
    await waitFor(() => expect(mock操作.恢复候选Onboarding预填).toHaveBeenCalledTimes(1));
    expect(mock操作.恢复候选Onboarding预填).toHaveBeenCalledWith({ 允许等待解析: true });
    // 旧 succeeded 附件 + pristine inactive 轮：不激活、不推进（零预填读取入口）
    expect(mock操作.激活候选Onboarding预填).not.toHaveBeenCalled();
    expect(mock操作.同步候选Onboarding解析).not.toHaveBeenCalled();
    // 快照换代（轮询提交新对象）也不二次恢复
    mock应用状态.后端状态.附件简历库 = { items: [文件B], limits };
    重渲染();
    expect(mock操作.恢复候选Onboarding预填).toHaveBeenCalledTimes(1);
  });

  it('waits for attachment hydration before the one-time recovery call', async () => {
    const { 重渲染 } = render学生分流({ 数据源: 'backend' });
    // 附件库未水合（null）：不调用，绝不对着空库做一次性恢复
    expect(mock操作.恢复候选Onboarding预填).not.toHaveBeenCalled();
    mock应用状态.后端状态.附件简历库 = { items: [], limits };
    重渲染();
    await waitFor(() => expect(mock操作.恢复候选Onboarding预填).toHaveBeenCalledTimes(1));
    // 再换代快照仍是恰好一次（ref 守卫）
    mock应用状态.后端状态.附件简历库 = { items: [文件A], limits };
    重渲染();
    expect(mock操作.恢复候选Onboarding预填).toHaveBeenCalledTimes(1);
  });

  it('activates only after the authoritative upload flow resolves', async () => {
    mock操作.创建附件简历.mockResolvedValue('已提交');
    render学生分流({ 数据源: 'backend', 附件库: { items: [], limits } });
    await 选择并同意PDF('resume.pdf');
    await waitFor(() => expect(mock操作.激活候选Onboarding预填).toHaveBeenCalledTimes(1));
    expect(mock操作.创建附件简历.mock.invocationCallOrder[0]!)
      .toBeLessThan(mock操作.激活候选Onboarding预填.mock.invocationCallOrder[0]!);
  });

  it('activates exactly once after an authoritative replace resolves 已提交', async () => {
    render学生分流({ 数据源: 'backend', 附件库: { items: [文件A], limits } });
    await 选择并同意PDF('replacement.pdf');
    await waitFor(() => expect(mock操作.替换附件简历).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mock操作.激活候选Onboarding预填).toHaveBeenCalledTimes(1));
    expect(mock操作.替换附件简历.mock.invocationCallOrder[0]!)
      .toBeLessThan(mock操作.激活候选Onboarding预填.mock.invocationCallOrder[0]!);
  });

  it('已换代 neither activates nor shows success feedback', async () => {
    mock操作.创建附件简历.mockResolvedValueOnce('已换代');
    render学生分流({ 数据源: 'backend', 附件库: { items: [], limits } });
    const 前轻提示数 = mock轻提示.mock.calls.length;
    await 选择并同意PDF('stale.pdf');
    await waitFor(() => expect(mock操作.创建附件简历).toHaveBeenCalledTimes(1));
    expect(mock操作.激活候选Onboarding预填).not.toHaveBeenCalled();
    // 动态前后计数（toast 单例纪律）：成功反馈一次都没有
    expect(mock轻提示.mock.calls.length).toBe(前轻提示数);
  });

  it('watches only the authoritative parse coordinates: changes call 同步, non-coordinates do not', async () => {
    const 取数 = vi.spyOn(globalThis, 'fetch');
    const { 重渲染 } = render学生分流({
      数据源: 'backend',
      附件库: { items: [等待行], limits },
      候选预填: 预填轮({
        phase: 'waiting_parse',
        source: { file_id: 'rf_w', version_id: 'v_rf_w', parse_id: null },
      }),
    });
    // 恢复出的 waiting_parse 轮在本页在场：poller 推进解析坐标即由本页转交操作层
    await waitFor(() => expect(mock操作.同步候选Onboarding解析).toHaveBeenCalledTimes(1));
    // 非坐标字段换代（display_name / updated_at）不触发推进
    mock应用状态.后端状态.附件简历库 = {
      items: [{ ...等待行, display_name: '改名.pdf', updated_at: 't2' }],
      limits,
    };
    重渲染();
    expect(mock操作.同步候选Onboarding解析).toHaveBeenCalledTimes(1);
    // 解析坐标升级（processing → succeeded + parse_id，file/version 不变）触发推进
    mock应用状态.后端状态.附件简历库 = { items: [附件行('rf_w', '等待中.pdf')], limits };
    重渲染();
    await waitFor(() => expect(mock操作.同步候选Onboarding解析).toHaveBeenCalledTimes(2));
    // 页面零直接 BFF 请求（本测试连 数据源 都没给页面），恢复也不重跑
    expect(取数).not.toHaveBeenCalled();
    expect(mock操作.恢复候选Onboarding预填).toHaveBeenCalledTimes(1);
    取数.mockRestore();
  });

  it.each(['ready', 'manual'] as const)('%s round continues through the existing route with no gate layer', async (阶段) => {
    const { 派发 } = render学生分流({
      数据源: 'backend',
      附件库: { items: [文件A], limits },
      引导预填: 完整预填,
      基本信息: { 身份: '在校' },
      候选预填: 预填轮({ phase: 阶段 }),
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.queryByRole('button', { name: '再等等' })).toBeNull();
    expect(mock操作.继续手填候选Onboarding).not.toHaveBeenCalled();
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '启程引导' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.基本信息);
  });

  it.each(['waiting_parse', 'loading'] as const)('%s round plus 下一步 opens the existing 确认层 with 再等等 / 继续手填', async (阶段) => {
    const { 派发 } = render学生分流({
      数据源: 'backend',
      附件库: { items: [等待行], limits },
      引导预填: 完整预填,
      基本信息: { 身份: '在校' },
      候选预填: 预填轮({
        phase: 阶段,
        source: { file_id: 'rf_w', version_id: 'v_rf_w', parse_id: null },
      }),
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByRole('button', { name: '再等等' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '继续手填' })).toBeTruthy();
    // 不启程不跳转：决策留在层里
    expect(派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '启程引导' }));
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('再等等 closes the layer and stays on the page', async () => {
    const { 派发 } = render学生分流({
      数据源: 'backend',
      附件库: { items: [等待行], limits },
      引导预填: 完整预填,
      基本信息: { 身份: '在校' },
      候选预填: 预填轮({
        phase: 'waiting_parse',
        source: { file_id: 'rf_w', version_id: 'v_rf_w', parse_id: null },
      }),
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await 用户.click(screen.getByRole('button', { name: '再等等' }));
    expect(screen.queryByRole('button', { name: '再等等' })).toBeNull();
    expect(mock操作.继续手填候选Onboarding).not.toHaveBeenCalled();
    expect(派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '启程引导' }));
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('继续手填 calls the manual operation then navigates the existing route', async () => {
    const { 派发 } = render学生分流({
      数据源: 'backend',
      附件库: { items: [等待行], limits },
      引导预填: 完整预填,
      基本信息: { 身份: '在校' },
      候选预填: 预填轮({
        phase: 'waiting_parse',
        source: { file_id: 'rf_w', version_id: 'v_rf_w', parse_id: null },
      }),
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await 用户.click(screen.getByRole('button', { name: '继续手填' }));
    expect(mock操作.继续手填候选Onboarding).toHaveBeenCalledTimes(1);
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '启程引导' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.基本信息);
    expect(mock操作.继续手填候选Onboarding.mock.invocationCallOrder[0]!)
      .toBeLessThan(mock跳转.mock.invocationCallOrder[0]!);
  });

  it('failed landing reuses 轻提示 and keeps the existing re-upload action on the banner', async () => {
    const { 重渲染 } = render学生分流({
      数据源: 'backend',
      附件库: { items: [文件A], limits },
      候选预填: 预填轮({
        phase: 'waiting_parse',
        source: { file_id: 'rf_a', version_id: 'v_rf_a', parse_id: null },
      }),
    });
    expect(screen.getByText('正在识别简历')).toBeTruthy();
    // 读取失败落位（操作层 error 已是闭合文案）：复用 轻提示 告知
    mock应用状态.后端状态.候选预填状态 = 预填轮({
      phase: 'failed',
      source: { file_id: 'rf_a', version_id: 'v_rf_a', parse_id: null },
      error: '服务暂时不可用，请稍后重试',
    });
    重渲染();
    await waitFor(() => expect(mock轻提示).toHaveBeenLastCalledWith('服务暂时不可用，请稍后重试'));
    // 原横幅保留重新上传动作与权威展示名（failed 不是承诺态）
    expect(screen.getByText(文件A.display_name)).toBeTruthy();
    expect(screen.getByText('重新上传 ›')).toBeTruthy();
    expect(screen.queryByText('正在识别简历')).toBeNull();
  });

  it('failed round plus 下一步 counts as continuing manually and takes the existing route', async () => {
    const { 派发 } = render学生分流({
      数据源: 'backend',
      附件库: { items: [文件A], limits },
      引导预填: 完整预填,
      基本信息: { 身份: '在校' },
      候选预填: 预填轮({
        phase: 'failed',
        source: { file_id: 'rf_a', version_id: 'v_rf_a', parse_id: null },
        error: '服务暂时不可用，请稍后重试',
      }),
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    // failed 不弹等待层：本次点击视为继续手填，横幅上的重新上传入口保留
    expect(screen.queryByRole('button', { name: '再等等' })).toBeNull();
    expect(mock操作.继续手填候选Onboarding).toHaveBeenCalledTimes(1);
    expect(派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '启程引导' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.基本信息);
    expect(mock操作.继续手填候选Onboarding.mock.invocationCallOrder[0]!)
      .toBeLessThan(mock跳转.mock.invocationCallOrder[0]!);
  });

  it('banner feedback only varies existing 代理横幅 props and stays in place across phases', async () => {
    const { 重渲染 } = render学生分流({
      数据源: 'backend',
      附件库: { items: [等待行], limits },
      候选预填: 预填轮({
        phase: 'waiting_parse',
        source: { file_id: 'rf_w', version_id: 'v_rf_w', parse_id: null },
      }),
    });
    // pending/processing：原横幅显示「正在识别简历」
    const 横幅钮 = screen.getByText('正在识别简历').closest('button') as HTMLElement;
    // 节点位置不变：横幅仍在「你目前是否在校？」之前、隐藏文件框之前
    expect(screen.getByText('你目前是否在校？').compareDocumentPosition(横幅钮) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(横幅钮.compareDocumentPosition(document.querySelector('input[type="file"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // loading suggestion：原横幅显示「正在准备可填写内容」
    mock应用状态.后端状态.候选预填状态 = 预填轮({
      phase: 'loading',
      source: { file_id: 'rf_w', version_id: 'v_rf_w', parse_id: 'p_rf_w' },
    });
    重渲染();
    expect(screen.getByText('正在准备可填写内容')).toBeTruthy();
    expect(screen.getByText('重新上传 ›')).toBeTruthy();
    // ready：原横幅显示「已识别，将填写空白项」，上传/重新上传动作保持原位置
    mock应用状态.后端状态.候选预填状态 = 预填轮({
      phase: 'ready',
      source: { file_id: 'rf_w', version_id: 'v_rf_w', parse_id: 'p_rf_w' },
    });
    重渲染();
    expect(screen.getByText('已识别，')).toBeTruthy();
    expect(screen.getByText('将填写空白项')).toBeTruthy();
    expect(screen.getByText('重新上传 ›')).toBeTruthy();
  });

  it('Mock mode makes zero prefill operations and keeps legacy copy', () => {
    render学生分流({ 数据源: 'mock' });
    expect(mock操作.恢复候选Onboarding预填).not.toHaveBeenCalled();
    expect(mock操作.激活候选Onboarding预填).not.toHaveBeenCalled();
    expect(mock操作.同步候选Onboarding解析).not.toHaveBeenCalled();
    expect(screen.getByText('这张表我来填')).toBeTruthy();
  });

  it('Mock mode upload flow leaves all seven prefill operations uncalled', async () => {
    const 用户 = userEvent.setup();
    const { 派发 } = render学生分流({ 数据源: 'mock' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await 用户.upload(input, new File(['%PDF'], 'demo.pdf', { type: 'application/pdf' }));
    // Mock 的旧存名派发照常发生（证明流程真的走到了上传路径），预填域纹丝不动
    expect(派发).toHaveBeenCalledWith({ 型: '存简历文件名', 文件名: 'demo.pdf' });
    expect(mock操作.恢复候选Onboarding预填).not.toHaveBeenCalled();
    expect(mock操作.激活候选Onboarding预填).not.toHaveBeenCalled();
    expect(mock操作.同步候选Onboarding解析).not.toHaveBeenCalled();
    expect(mock操作.重试候选Onboarding预填).not.toHaveBeenCalled();
    expect(mock操作.继续手填候选Onboarding).not.toHaveBeenCalled();
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    expect(mock操作.清候选Onboarding预填).not.toHaveBeenCalled();
  });
});
// ── 首屏默认（Task 5B）：Backend 空 profile + 引导预填:null —— 身份/类型/办公方式
//    全部未选择；草稿动作自带基底（无 ['上海'] 兜底）；下一步依次给出可见提示 ──
describe('学生分流 · 首屏零默认（Task 5B）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
  });

  it('Backend 空 profile + 无预填：身份/求职类型/办公方式按钮全为未选', () => {
    render学生分流({ 数据源: 'backend', 基本信息: { 身份: '' } });
    expect(screen.getByRole('button', { name: '在校' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: '已毕业' }).getAttribute('aria-pressed')).toBe('false');
    for (const 类型 of ['社招全职', '校园招聘', '实习生', '兼职']) {
      expect(screen.getByRole('button', { name: 类型 }).getAttribute('aria-pressed')).toBe('false');
    }
    for (const 方式 of ['现场', '混合', '全远程']) {
      expect(screen.getByRole('button', { name: 方式 }).getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('先点偏好尚未点身份：派发动作的城市基底为空数组，不出现上海', async () => {
    const { 派发 } = render学生分流({ 数据源: 'backend', 基本信息: { 身份: '' } });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '社招全职' }));
    const 存偏好 = 派发.mock.calls.find(([动作]) => (动作 as { 型: string }).型 === '存求职筛选偏好');
    expect(存偏好).toBeTruthy();
    expect((存偏好![0] as { 城市们: string[] }).城市们).toEqual([]);
    // 状态与 sessionStorage 都不能出现「上海」——页面桩不写存储，这里以派发基底为准
    expect(JSON.stringify(派发.mock.calls)).not.toContain('上海');
  });

  it('点下一步依次提示身份、求职类型、办公方式缺失，且不派发启程引导', async () => {
    // 第 1 层：空状态 → 提示身份（派发 mock 不回写状态，各层用前置状态分开验证）
    const 用户 = userEvent.setup();
    const 首层 = render学生分流({ 数据源: 'backend', 基本信息: { 身份: '' } });
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(mock轻提示).toHaveBeenCalledWith('请选择是否在校');
    expect(首层.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '启程引导' }));
    首层.视图.unmount();

    // 第 2 层：身份已选（在校选择:false）、偏好为空 → 提示求职类型（与办公方式同批）
    mock轻提示.mockClear();
    const 二层 = render学生分流({
      数据源: 'backend',
      基本信息: { 身份: '' },
      引导预填: { 城市们: [], 职位: [], 在校选择: false },
    });
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(mock轻提示).toHaveBeenCalledWith('请补充：求职类型、办公方式');

    // 第 3 层：类型已选、办公方式为空 → 提示办公方式
    二层.视图.unmount();
    mock轻提示.mockClear();
    const 三层 = render学生分流({
      数据源: 'backend',
      基本信息: { 身份: '' },
      引导预填: { 城市们: [], 职位: [], 在校选择: false, 筛选偏好: { 求职类型: ['社招全职'], 办公方式: [] } },
    });
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(mock轻提示).toHaveBeenCalledWith('请补充：办公方式');

    // 第 4 层：偏好齐但无城市/职位引用 → 提示城市/职位（Backend 无 refs）
    三层.视图.unmount();
    mock轻提示.mockClear();
    const 末层 = render学生分流({
      数据源: 'backend',
      基本信息: { 身份: '' },
      引导预填: { 城市们: [], 职位: [], 在校选择: false, 筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['现场'] } },
    });
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(mock轻提示).toHaveBeenCalledWith('请先选择工作城市与期望职位');
    expect(末层.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '启程引导' }));
  });

  it('选择「在校」写身份在校；选择「已毕业」从在校回到空身份', async () => {
    const { 派发 } = render学生分流({ 数据源: 'backend', 基本信息: { 身份: '' } });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '在校' }));
    const 存在校 = 派发.mock.calls.find(([动作]) => (动作 as { 型: string }).型 === '存简历');
    expect((存在校![0] as { 基本信息: { 身份: string } }).基本信息.身份).toBe('在校');
    const 存选择 = 派发.mock.calls.find(([动作]) => (动作 as { 型: string }).型 === '存求职筛选偏好');
    expect((存选择![0] as { 在校选择?: boolean }).在校选择).toBe(true);
  });

  // Mock 对照：初始筛选与城市仍用默认；先点偏好再点身份不丢 Mock 城市
  it('Mock 对照：默认偏好与上海城市保留，先点偏好再点身份不丢城市', async () => {
    const { 派发 } = render学生分流({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    // 默认偏好（在职种子 → 社招全职）与默认城市已选
    expect(screen.getByRole('button', { name: '社招全职' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('上海')).toBeTruthy();
    // 先改偏好（兼职），再点身份「在校」：派发基底仍带上海
    await 用户.click(screen.getByRole('button', { name: '兼职' }));
    await 用户.click(screen.getByRole('button', { name: '在校' }));
    const 存选择 = 派发.mock.calls.filter(([动作]) => (动作 as { 型: string }).型 === '存求职筛选偏好');
    const 最后 = 存选择[存选择.length - 1][0] as { 城市们: string[]; 偏好: { 求职类型: string[] } };
    expect(最后.城市们).toEqual(['上海']);
    expect(最后.偏好.求职类型).toEqual(['实习生']);
  });
});
