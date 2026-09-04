// FE-IV-01 候选实名认证页的行为测试 —— 冻结路由 /settings/identity-verification、
// 四状态渲染（unverified 空表单 / pending 刷新与取消确认 / verified 只读 /
// rejected 安全文案 + 全新表单）、文件组合校验（数量 → 扩展名 → 非空声明 MIME →
// 扩展名/MIME 一致性 → PDF 组合的固定优先级，无 size 检查）、页面错误映射的闭合
// 文案（不拼接 error.message/field path/request ID/文件名）、敏感文件生命周期
// （input value 读后清空、同名文件可重选、卸载重挂为空、草稿只在页面 state）、
// 待定意图重置（字段/文件变化与卸载）、提交/取消在飞时控件禁用与零第二请求、
// direct route 的 Mock/非候选 guard（零实名请求）。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 候选实名认证, {
  校验候选实名文件,
  候选实名码点数,
  候选实名拒绝文案,
  格式化实名提交时间,
} from './候选实名认证';
import { 路径 } from '../路由/路径表';
import { BFF错误 } from '../数据/HTTP客户端';
import type { 候选实名快照 } from '../状态/后端/类型';
import { 创建空候选实名快照 } from '../状态/后端/候选实名操作';
import type { BFF主体 } from '../数据/BFF契约';
import { BFF主体样本 } from '../测试/BFF样本';
import type { 候选实名摘要, 候选实名拒绝原因 } from '../数据/招聘数据源/候选实名';

const 导航 = vi.hoisted(() => ({ 返回: vi.fn(), 跳转: vi.fn(), 替换跳转: vi.fn() }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => 导航 }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

const 候选主体: BFF主体 = { ...BFF主体样本, subject_id: 'sub_1', last_used_role: 'candidate' };
const 招聘主体: BFF主体 = { ...BFF主体样本, subject_id: 'sub_1', last_used_role: 'recruiter' };

const 未认证摘要: 候选实名摘要 = {
  status: 'unverified',
  verifiedName: null,
  currentRequest: null,
  revision: 1,
  updatedAt: '2026-09-01T00:00:00Z',
};

const 待审摘要: 候选实名摘要 = {
  status: 'pending',
  verifiedName: null,
  currentRequest: { requestId: 'ivq_1', status: 'pending', revision: 3, submittedAt: '2026-09-04T08:00:00Z', rejectionReason: null },
  revision: 7,
  updatedAt: '2026-09-04T08:00:01Z',
};

const 取消后摘要: 候选实名摘要 = {
  status: 'unverified',
  verifiedName: null,
  currentRequest: { requestId: 'ivq_1', status: 'cancelled', revision: 5, submittedAt: '2026-09-04T08:00:00Z', rejectionReason: null },
  revision: 8,
  updatedAt: '2026-09-04T09:30:00Z',
};

const 已认证摘要: 候选实名摘要 = {
  status: 'verified',
  verifiedName: '张三',
  currentRequest: { requestId: 'ivq_1', status: 'verified', revision: 6, submittedAt: '2026-09-04T08:00:00Z', rejectionReason: null },
  revision: 10,
  updatedAt: '2026-09-04T10:00:00Z',
};

function 被拒摘要(reason: 候选实名拒绝原因): 候选实名摘要 {
  return {
    status: 'rejected',
    verifiedName: null,
    currentRequest: { requestId: 'ivq_1', status: 'rejected', revision: 4, submittedAt: '2026-09-04T08:00:00Z', rejectionReason: reason },
    revision: 9,
    updatedAt: '2026-09-04T10:00:00Z',
  };
}

function 成功快照(摘要: 候选实名摘要, 刷新中 = false): 候选实名快照 {
  return { 阶段: '成功', 摘要, 刷新中, 错误: null };
}

function 操作桩(覆盖: Record<string, unknown> = {}) {
  return {
    加载候选实名: vi.fn(async () => undefined),
    提交候选实名: vi.fn(async (): Promise<'已提交' | '状态已更新' | '已换代'> => '已提交'),
    取消候选实名: vi.fn(async (): Promise<'已取消' | '状态已更新' | '已换代'> => '已取消'),
    重置候选实名提交意图: vi.fn(),
    ...覆盖,
  };
}

function 喂后端(候选实名: 候选实名快照 = 创建空候选实名快照(), 主体: BFF主体 | null = 候选主体) {
  mock应用状态 = {
    数据源模式: 'backend',
    后端状态: { 已登录: 主体 !== null, 主体, 候选实名 },
    操作: 操作桩(),
  };
  return mock应用状态.操作;
}

function 渲染页() {
  render(
    <MemoryRouter initialEntries={[路径.候选实名认证]}>
      <Routes>
        <Route path={路径.候选实名认证} element={<候选实名认证 />} />
        <Route path={路径.设置} element={<div>设置页桩</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const 单页PNG = () => new File([new Uint8Array([1])], 'front.png', { type: 'image/png' });
const 单页JPG = () => new File([new Uint8Array([1])], 'front.jpg', { type: 'image/jpeg' });
const 单页PDF = () => new File([new Uint8Array([1])], 'doc.pdf', { type: 'application/pdf' });

beforeEach(() => {
  导航.返回.mockClear();
  导航.跳转.mockClear();
  导航.替换跳转.mockClear();
});

describe('纯校验函数', () => {
  it('码点数按 Unicode code point 计数，不用 UTF-16 length', () => {
    expect(候选实名码点数(`${'😀'.repeat(50)}${'a'.repeat(150)}`)).toBe(200);
    // 同一字符串的 UTF-16 length 是 250：若实现误用 string.length 会得到它
    expect(`${'😀'.repeat(50)}${'a'.repeat(150)}`.length).toBe(250);
    expect(候选实名码点数('')).toBe(0);
  });

  it.each([
    ['单 PDF', [单页PDF()]],
    ['单 PNG', [单页PNG()]],
    ['单 JPEG', [单页JPG()]],
    ['双 PNG', [单页PNG(), 单页PNG()]],
    ['PNG + JPEG', [单页PNG(), 单页JPG()]],
    ['合法扩展名空 MIME', [new File([new Uint8Array([1])], 'front.png', { type: '' })]],
  ])('%s 通过组合校验', (_名, files) => {
    expect(校验候选实名文件(files)).toBeNull();
  });

  it.each([
    // 数量级最先
    ['零文件', [], '请上传证件材料'],
    ['三个文件', [单页PNG(), 单页PNG(), 单页PNG()], '最多上传两张图片，或一份 PDF'],
    // 数量合法后：扩展名级
    ['.gif 扩展名', [new File([new Uint8Array([1])], 'x.gif', { type: 'image/gif' })], '仅支持 PDF、PNG、JPG 或 JPEG'],
    // 非空声明 MIME 级
    ['非空不支持 MIME', [new File([new Uint8Array([1])], 'x.png', { type: 'image/gif' })], '文件类型无法识别，请选择 PDF、PNG 或 JPEG'],
    // 扩展名/MIME 矛盾级
    ['扩展名与 MIME 矛盾', [new File([new Uint8Array([1])], 'x.png', { type: 'application/pdf' })], '文件扩展名与类型不一致，请重新选择'],
    // PDF 组合级（两份 PDF / PDF 混选图片）
    ['两份 PDF', [单页PDF(), 单页PDF()], 'PDF 只能单独上传一份'],
    ['PDF 混选图片', [单页PDF(), 单页PNG()], 'PDF 只能单独上传一份'],
  ])('%s 按固定优先级返回闭合文案', (_名, files, 文案) => {
    expect(校验候选实名文件(files)).toBe(文案);
  });

  it('数量错误优先于扩展名错误（3 个文件里含 .gif 报数量）', () => {
    expect(校验候选实名文件([
      单页PNG(), 单页PNG(), new File([new Uint8Array([1])], 'x.gif', { type: '' }),
    ])).toBe('最多上传两张图片，或一份 PDF');
  });

  it('不检查 file.size（大小由服务端裁决）', () => {
    const 大文件 = new File([new Uint8Array([1])], 'front.png', { type: 'image/png' });
    Object.defineProperty(大文件, 'size', { value: 99 * 1024 * 1024 });
    expect(校验候选实名文件([大文件])).toBeNull();
  });
});

describe('候选实名认证 · 读取态与四状态渲染', () => {
  it('初始与进行中显示中性读取态，挂载触发一次加载', async () => {
    const 操作 = 喂后端();
    渲染页();
    expect(screen.getByRole('status').textContent).toContain('正在读取');
    await waitFor(() => expect(操作.加载候选实名).toHaveBeenCalledTimes(1));
    expect(操作.提交候选实名).not.toHaveBeenCalled();
  });

  it('首载失败显示安全错误与重试，重试走强制重读', async () => {
    const 用户 = userEvent.setup();
    const 操作 = 喂后端({ 阶段: '失败', 摘要: null, 刷新中: false, 错误: '请求失败，请稍后再试' });
    渲染页();
    expect(screen.getByRole('alert').textContent).toContain('请求失败，请稍后再试');
    await 用户.click(screen.getByRole('button', { name: '重试' }));
    expect(操作.加载候选实名).toHaveBeenCalledWith(true);
  });

  it('成功快照刷新中保留旧状态并显示刷新中', () => {
    喂后端(成功快照(未认证摘要, true));
    渲染页();
    // 旧表单仍在（旧状态保留）
    expect(screen.getByLabelText('证件姓名')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('刷新中');
  });

  it('unverified 是空姓名、空证件类型、空文件表单', async () => {
    const 用户 = userEvent.setup();
    喂后端(成功快照(未认证摘要));
    渲染页();
    const 姓名输入 = screen.getByLabelText('证件姓名') as HTMLInputElement;
    const 类型选择 = screen.getByLabelText('证件类型') as HTMLSelectElement;
    expect(姓名输入.value).toBe('');
    expect(类型选择.value).toBe('');
    expect(screen.queryByText('front.png')).toBeNull();
    // 空表单提交走客户端校验，零 operation
    await 用户.click(screen.getByRole('button', { name: '提交材料' }));
    expect(screen.getByRole('alert').textContent).toContain('请填写证件姓名');
    expect(操作桩调用提交(mock应用状态.操作)).toBe(0);
  });

  it('cancelled request 不作为历史展示', () => {
    喂后端(成功快照(取消后摘要));
    渲染页();
    expect(screen.getByLabelText('证件姓名')).toBeTruthy();
    expect(screen.queryByText(/已取消/)).toBeNull();
    expect(screen.queryByText('2026-09-04')).toBeNull();
  });

  it('pending 显示审核中与提交时间，有刷新和取消，没有提交表单', () => {
    喂后端(成功快照(待审摘要));
    渲染页();
    expect(screen.getByText('审核中')).toBeTruthy();
    expect(screen.getByText(格式化实名提交时间('2026-09-04T08:00:00Z'))).toBeTruthy();
    expect(screen.getByRole('button', { name: '刷新状态' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '取消申请' })).toBeTruthy();
    expect(screen.queryByLabelText('证件姓名')).toBeNull();
    expect(screen.queryByRole('button', { name: '提交材料' })).toBeNull();
  });

  it('verified 只显示已认证与服务端 verified_name，没有提交或取消', () => {
    喂后端(成功快照(已认证摘要));
    渲染页();
    expect(screen.getByText('已认证')).toBeTruthy();
    expect(screen.getByText('张三')).toBeTruthy();
    expect(screen.queryByLabelText('证件姓名')).toBeNull();
    expect(screen.queryByRole('button', { name: '取消申请' })).toBeNull();
  });

  it.each([
    'document_unreadable',
    'identity_mismatch',
    'document_expired',
    'unsupported_document',
    'other',
  ] as const)('rejected 的 %s 显示固定安全文案与全新空表单', (reason) => {
    喂后端(成功快照(被拒摘要(reason)));
    渲染页();
    expect(screen.getByText(候选实名拒绝文案[reason])).toBeTruthy();
    const 姓名输入 = screen.getByLabelText('证件姓名') as HTMLInputElement;
    const 类型选择 = screen.getByLabelText('证件类型') as HTMLSelectElement;
    expect(姓名输入.value).toBe('');
    expect(类型选择.value).toBe('');
    expect(screen.queryByText('front.png')).toBeNull();
  });
});

function 操作桩调用提交(操作: ReturnType<typeof 操作桩>): number {
  return (操作.提交候选实名 as ReturnType<typeof vi.fn>).mock.calls.length;
}

describe('候选实名认证 · 表单交互与文件生命周期', () => {
  async function 填表单(用户: ReturnType<typeof userEvent.setup>, 选项: { 姓名?: string; 文件?: File[] } = {}) {
    await 用户.type(screen.getByLabelText('证件姓名'), 选项.姓名 ?? 'Fixture Candidate');
    await 用户.selectOptions(screen.getByLabelText('证件类型'), 'passport');
    for (const 文件 of 选项.文件 ?? [单页PNG()]) {
      await 用户.upload(screen.getByLabelText('证件材料'), 文件);
    }
  }

  it('任一字段或文件变化与卸载都重置待定意图', async () => {
    const 用户 = userEvent.setup();
    const 操作 = 喂后端(成功快照(未认证摘要));
    渲染页();
    await 用户.type(screen.getByLabelText('证件姓名'), '张');
    expect(操作.重置候选实名提交意图).toHaveBeenCalled();
    操作.重置候选实名提交意图.mockClear();
    await 用户.selectOptions(screen.getByLabelText('证件类型'), 'passport');
    expect(操作.重置候选实名提交意图).toHaveBeenCalled();
    操作.重置候选实名提交意图.mockClear();
    await 用户.upload(screen.getByLabelText('证件材料'), 单页PNG());
    expect(操作.重置候选实名提交意图).toHaveBeenCalled();
    操作.重置候选实名提交意图.mockClear();
    // 卸载 cleanup 也重置
    const { unmount } = render(
      <MemoryRouter initialEntries={[路径.候选实名认证]}>
        <Routes>
          <Route path={路径.候选实名认证} element={<候选实名认证 />} />
        </Routes>
      </MemoryRouter>,
    );
    unmount();
    expect(操作.重置候选实名提交意图).toHaveBeenCalled();
  });

  it('读取文件后 input value 清空；移除后同名文件能再次加入；文件名只在当前页面显示', async () => {
    const 用户 = userEvent.setup();
    喂后端(成功快照(未认证摘要));
    const { unmount } = render(
      <MemoryRouter initialEntries={[路径.候选实名认证]}>
        <Routes>
          <Route path={路径.候选实名认证} element={<候选实名认证 />} />
        </Routes>
      </MemoryRouter>,
    );
    const 输入 = screen.getByLabelText('证件材料') as HTMLInputElement;
    const 同一文件 = 单页PNG();
    await 用户.upload(输入, 同一文件);
    expect(输入.value).toBe('');
    expect(screen.getByText('front.png')).toBeTruthy();
    // 移除
    await 用户.click(screen.getByRole('button', { name: '移除 front.png' }));
    expect(screen.queryByText('front.png')).toBeNull();
    // 同名文件能再次加入
    await 用户.upload(输入, 单页PNG());
    expect(screen.getByText('front.png')).toBeTruthy();
    // 卸载后重挂：文件不复活
    unmount();
    render(
      <MemoryRouter initialEntries={[路径.候选实名认证]}>
        <Routes>
          <Route path={路径.候选实名认证} element={<候选实名认证 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText('front.png')).toBeNull();
  });

  it('提交在飞时控件全部 disabled，重复点击零第二请求', async () => {
    const 用户 = userEvent.setup();
    let 决出!: (值: '已提交') => void;
    喂后端(成功快照(未认证摘要));
    mock应用状态.操作 = 操作桩({
      提交候选实名: vi.fn(async (): Promise<'已提交'> => new Promise((resolve) => { 决出 = resolve; })),
    });
    渲染页();
    await 填表单(用户);
    const 提交键 = screen.getByRole('button', { name: '提交材料' }) as HTMLButtonElement;
    await 用户.click(提交键);
    const 姓名输入 = screen.getByLabelText('证件姓名') as HTMLInputElement;
    const 类型选择 = screen.getByLabelText('证件类型') as HTMLSelectElement;
    const 材料输入 = screen.getByLabelText('证件材料') as HTMLInputElement;
    expect(提交键.disabled).toBe(true);
    expect(姓名输入.disabled).toBe(true);
    expect(类型选择.disabled).toBe(true);
    expect(材料输入.disabled).toBe(true);
    expect((screen.getByRole('button', { name: '移除 front.png' }) as HTMLButtonElement).disabled).toBe(true);
    // disabled 键点击不触发第二笔
    await 用户.click(提交键);
    expect((mock应用状态.操作.提交候选实名 as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    决出('已提交');
    await waitFor(() => expect(提交键.disabled).toBe(false));
  });

  it('姓名 trim 后空与 201 code point 拒绝；200 个含 surrogate pair 的 code point 通过', async () => {
    const 用户 = userEvent.setup();
    喂后端(成功快照(未认证摘要));
    渲染页();
    await 用户.type(screen.getByLabelText('证件姓名'), '   ');
    await 用户.selectOptions(screen.getByLabelText('证件类型'), 'passport');
    await 用户.upload(screen.getByLabelText('证件材料'), 单页PNG());
    await 用户.click(screen.getByRole('button', { name: '提交材料' }));
    expect(screen.getByRole('alert').textContent).toContain('请填写证件姓名');
    expect(操作桩调用提交(mock应用状态.操作)).toBe(0);

    const 姓名 = `${'😀'.repeat(50)}${'a'.repeat(151)}`;
    const 姓名输入 = screen.getByLabelText('证件姓名') as HTMLInputElement;
    await 用户.clear(姓名输入);
    await 用户.type(姓名输入, 姓名);
    await 用户.click(screen.getByRole('button', { name: '提交材料' }));
    expect(screen.getByRole('alert').textContent).toContain('证件姓名不超过 200 字');
    expect(操作桩调用提交(mock应用状态.操作)).toBe(0);

    await 用户.clear(姓名输入);
    await 用户.type(姓名输入, `${'😀'.repeat(50)}${'a'.repeat(150)}`);
    await 用户.click(screen.getByRole('button', { name: '提交材料' }));
    await waitFor(() => expect(操作桩调用提交(mock应用状态.操作)).toBe(1));
  });

  it('文件组合错误提前提示且零 operation', async () => {
    const 用户 = userEvent.setup();
    喂后端(成功快照(未认证摘要));
    渲染页();
    await 用户.type(screen.getByLabelText('证件姓名'), 'Fixture Candidate');
    await 用户.selectOptions(screen.getByLabelText('证件类型'), 'passport');
    await 用户.upload(screen.getByLabelText('证件材料'), 单页PDF());
    await 用户.upload(screen.getByLabelText('证件材料'), 单页PNG());
    expect(screen.getByRole('alert').textContent).toContain('PDF 只能单独上传一份');
    await 用户.click(screen.getByRole('button', { name: '提交材料' }));
    expect(操作桩调用提交(mock应用状态.操作)).toBe(0);
  });

  it('create 成功清草稿与页面错误', async () => {
    const 用户 = userEvent.setup();
    喂后端(成功快照(未认证摘要));
    mock应用状态.操作 = 操作桩({ 提交候选实名: vi.fn(async (): Promise<'已提交'> => '已提交') });
    渲染页();
    await 填表单(用户);
    await 用户.click(screen.getByRole('button', { name: '提交材料' }));
    await waitFor(() => expect((screen.getByLabelText('证件姓名') as HTMLInputElement).value).toBe(''));
    expect((screen.getByLabelText('证件类型') as HTMLSelectElement).value).toBe('');
    expect(screen.queryByText('front.png')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('create outcome unknown 保留全部草稿与 File 引用', async () => {
    const 用户 = userEvent.setup();
    喂后端(成功快照(未认证摘要));
    mock应用状态.操作 = 操作桩({
      提交候选实名: vi.fn(async (): Promise<'已提交'> => {
        throw new BFF错误(503, 'operation_outcome_unknown', '内部详情');
      }),
    });
    渲染页();
    await 填表单(用户);
    await 用户.click(screen.getByRole('button', { name: '提交材料' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('提交结果暂未确认，请保留原材料后重试或刷新状态'));
    expect((screen.getByLabelText('证件姓名') as HTMLInputElement).value).toBe('Fixture Candidate');
    expect(screen.getByText('front.png')).toBeTruthy();
  });

  it('create network_error 用同一保留文案且草稿保留', async () => {
    const 用户 = userEvent.setup();
    喂后端(成功快照(未认证摘要));
    mock应用状态.操作 = 操作桩({
      提交候选实名: vi.fn(async (): Promise<'已提交'> => {
        throw new BFF错误(0, 'network_error', '网络连接失败');
      }),
    });
    渲染页();
    await 填表单(用户);
    await 用户.click(screen.getByRole('button', { name: '提交材料' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('提交结果暂未确认'));
    expect((screen.getByLabelText('证件姓名') as HTMLInputElement).value).toBe('Fixture Candidate');
  });

  it('idempotency conflict 后编辑文件触发新意图重置', async () => {
    const 用户 = userEvent.setup();
    const 操作 = 喂后端(成功快照(未认证摘要));
    mock应用状态.操作 = 操作桩({
      提交候选实名: vi.fn(async (): Promise<'已提交'> => {
        throw new BFF错误(409, 'idempotency_conflict', '内部详情');
      }),
      重置候选实名提交意图: 操作.重置候选实名提交意图,
    });
    渲染页();
    await 填表单(用户);
    await 用户.click(screen.getByRole('button', { name: '提交材料' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('本次提交状态冲突，请重新选择材料后重试'));
    操作.重置候选实名提交意图.mockClear();
    // 编辑文件（移除后重选）触发新意图
    await 用户.click(screen.getByRole('button', { name: '移除 front.png' }));
    expect(操作.重置候选实名提交意图).toHaveBeenCalled();
  });

  it('server 错误安全呈现：不拼接 error.message、field path、request ID 或文件名', async () => {
    const 用户 = userEvent.setup();
    喂后端(成功快照(未认证摘要));
    mock应用状态.操作 = 操作桩({
      提交候选实名: vi.fn(async (): Promise<'已提交'> => {
        throw new BFF错误(422, 'validation_failed', '秘密详情', [{ path: 'metadata.legal_name', reason: '内部理由' }]);
      }),
    });
    渲染页();
    await 填表单(用户);
    await 用户.click(screen.getByRole('button', { name: '提交材料' }));
    const 警示 = screen.getByRole('alert');
    await waitFor(() => expect(警示.textContent).toBe('提交内容不完整，请检查后重试'));
    expect(警示.textContent).not.toContain('秘密详情');
    expect(警示.textContent).not.toContain('metadata');
    expect(警示.textContent).not.toContain('front.png');
  });

  it('状态已更新 不弹已提交假成功，按 operation 已提交的新权威摘要渲染', async () => {
    const 用户 = userEvent.setup();
    喂后端(成功快照(未认证摘要));
    mock应用状态.操作 = 操作桩({
      提交候选实名: vi.fn(async (): Promise<'状态已更新'> => '状态已更新'),
    });
    渲染页();
    await 填表单(用户);
    await 用户.click(screen.getByRole('button', { name: '提交材料' }));
    await waitFor(() => expect((screen.getByLabelText('证件姓名') as HTMLInputElement).value).toBe(''));
    expect(screen.queryByText(/已提交/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('已换代 静默：清页面错误不弹假成功', async () => {
    const 用户 = userEvent.setup();
    喂后端(成功快照(未认证摘要));
    mock应用状态.操作 = 操作桩({
      提交候选实名: vi.fn(async (): Promise<'已换代'> => '已换代'),
    });
    渲染页();
    await 填表单(用户);
    await 用户.click(screen.getByRole('button', { name: '提交材料' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.queryByText(/已提交/)).toBeNull();
  });
});

describe('候选实名认证 · pending 刷新与取消', () => {
  it('pending 刷新单飞：刷新在飞时刷新键与取消键都 disabled，不重复请求', async () => {
    const 用户 = userEvent.setup();
    喂后端(成功快照(待审摘要));
    mock应用状态.操作 = 操作桩({
      加载候选实名: vi.fn(async () => new Promise<void>(() => undefined)),
    });
    渲染页();
    const 刷新键 = screen.getByRole('button', { name: '刷新状态' }) as HTMLButtonElement;
    const 取消键 = screen.getByRole('button', { name: '取消申请' }) as HTMLButtonElement;
    await 用户.click(刷新键);
    expect(刷新键.disabled).toBe(true);
    expect(取消键.disabled).toBe(true);
    await 用户.click(刷新键);
    // 挂载一次 + force 刷新一次；disabled 键的第二次点击零新增
    expect((mock应用状态.操作.加载候选实名 as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
    expect(mock应用状态.操作.加载候选实名).toHaveBeenLastCalledWith(true);
  });

  it('取消必须先确认；确认层 Escape 与取消键零 mutation；确认后 busy 成功回 unverified', async () => {
    const 用户 = userEvent.setup();
    喂后端(成功快照(待审摘要));
    mock应用状态.操作 = 操作桩();
    渲染页();
    await 用户.click(screen.getByRole('button', { name: '取消申请' }));
    expect(screen.getByText('取消实名认证申请？')).toBeTruthy();
    expect(screen.getByText('取消后本次审核会终止，如需认证必须重新提交材料。')).toBeTruthy();
    // Escape 关层：零 mutation
    await 用户.keyboard('{Escape}');
    expect(screen.queryByText('取消实名认证申请？')).toBeNull();
    expect((mock应用状态.操作.取消候选实名 as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    // 再开层，点取消键：零 mutation
    await 用户.click(screen.getByRole('button', { name: '取消申请' }));
    await 用户.click(screen.getByRole('button', { name: /^取消$/ }));
    expect(screen.queryByText('取消实名认证申请？')).toBeNull();
    expect((mock应用状态.操作.取消候选实名 as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    // 确认执行：立即关层并进入 busy（层开着时触发键已 disabled，同名执行键是唯一 enabled）
    await 用户.click(screen.getByRole('button', { name: '取消申请' }));
    const 执行键 = screen.getAllByRole('button', { name: '取消申请' })
      .find((键) => !(键 as HTMLButtonElement).disabled)!;
    await 用户.click(执行键);
    expect(screen.queryByText('取消实名认证申请？')).toBeNull();
    await waitFor(() => expect(mock应用状态.操作.取消候选实名).toHaveBeenCalledTimes(1));
  });

  it('取消失败保留 pending 页面并显示安全错误', async () => {
    const 用户 = userEvent.setup();
    喂后端(成功快照(待审摘要));
    mock应用状态.操作 = 操作桩({
      取消候选实名: vi.fn(async (): Promise<'已取消'> => {
        throw new BFF错误(0, 'network_error', '网络连接失败');
      }),
    });
    渲染页();
    await 用户.click(screen.getByRole('button', { name: '取消申请' }));
    const 执行键 = screen.getAllByRole('button', { name: '取消申请' })
      .find((键) => !(键 as HTMLButtonElement).disabled)!;
    await 用户.click(执行键);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('请求失败，请稍后再试'));
    // pending 页面保留
    expect(screen.getByText('审核中')).toBeTruthy();
    expect(screen.getByRole('button', { name: '刷新状态' })).toBeTruthy();
  });
});

describe('候选实名认证 · direct route guard', () => {
  it('Mock 直达 replace 回候选设置页且零实名请求', async () => {
    mock应用状态 = {
      数据源模式: 'mock',
      后端状态: { 已登录: false, 主体: null, 候选实名: 创建空候选实名快照() },
      操作: 操作桩(),
    };
    渲染页();
    await waitFor(() => expect(screen.getByText('设置页桩')).toBeTruthy());
    expect(mock应用状态.操作.加载候选实名).not.toHaveBeenCalled();
  });

  it('recruiter 与未登录不渲染表单、零实名请求（交给应用现有守卫）', () => {
    mock应用状态 = {
      数据源模式: 'backend',
      后端状态: { 已登录: true, 主体: 招聘主体, 候选实名: 创建空候选实名快照() },
      操作: 操作桩(),
    };
    const { unmount } = render(
      <MemoryRouter initialEntries={[路径.候选实名认证]}>
        <Routes>
          <Route path={路径.候选实名认证} element={<候选实名认证 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText('证件姓名')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(mock应用状态.操作.加载候选实名).not.toHaveBeenCalled();
    unmount();

    mock应用状态 = {
      数据源模式: 'backend',
      后端状态: { 已登录: false, 主体: null, 候选实名: 创建空候选实名快照() },
      操作: 操作桩(),
    };
    render(
      <MemoryRouter initialEntries={[路径.候选实名认证]}>
        <Routes>
          <Route path={路径.候选实名认证} element={<候选实名认证 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText('证件姓名')).toBeNull();
    expect(mock应用状态.操作.加载候选实名).not.toHaveBeenCalled();
  });
});
