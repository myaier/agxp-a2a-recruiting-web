// 企业组织申请 · multipart 提交与恢复组件测试（P1C Task 3 Step 3；2026-09-13 合同 C 更新）。
// 边界按 P1B 冻结：legal<=200 / registry<=200 / explanation<=4000（Unicode 码点）/
// domains<=20 且每项<=253（可空数组）；evidence 1–5 个 PNG/JPEG/PDF 各<=10MiB。
// 合同 C：metadata 精确为 {organization_id, legal_name, registry_key, explanation, domains}，
// display_name 从请求删除、展示名读选中企业；目标企业 = query 参数优先（公开 ID），
// 其次档案 organization_ref，无值则空；读取校验成功前不允许申请；换企业清材料、
// 取消选择保留证据；列表按所选 organization_id 过滤。
// 超限不调 operation；BFF {path,reason} 映射回同一表单槽；conflict 重读不重复 POST。

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 企业组织申请 from './企业组织申请';
import {
  BFF企业管理员申请样本,
  BFF招聘方档案样本,
  BFF组织搜索页样本,
} from '../测试/BFF样本';
import { BFF错误 } from '../数据/HTTP客户端';
import type { BFF企业管理员申请元数据 } from '../数据/BFF契约';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock读取申请 = vi.fn(async () => {});
// 带签名声明，mock.calls 才是 [BFF企业管理员申请元数据, File[]] 元组；合同 C 起返回回执
const mock创建申请 = vi.fn(async (_元数据: BFF企业管理员申请元数据, _证据: File[]) => ({
  申请: BFF企业管理员申请样本,
  列表刷新失败: false,
}));
const mock取消申请 = vi.fn(async (_申请编号: string) => {});
const mock读取目录企业 = vi.fn(async (编号: string) => ({
  organization_id: 编号,
  display_name: `企业${编号}`,
  legal_name: null,
  verification_status: 'unverified' as const,
}));
const mock搜索组织 = vi.fn(async () => BFF组织搜索页样本);
const mock创建组织 = vi.fn(async (名称: string) => ({
  organization: {
    organization_id: 'org_new_1',
    display_name: 名称,
    legal_name: null,
    verification_status: 'unverified' as const,
  },
  created: true,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }),
}));

function 置Backend应用状态(申请列表: unknown[] = [], 覆盖: Record<string, unknown> = {}) {
  mock应用状态 = {
    状态: {
      // 合同 C：档案自报企业是 query 参数缺席时的 fallback；默认给 org_1
      招聘方档案: { ...BFF招聘方档案样本, organization_ref: 'org_1' },
      企业关系列表: [],
      当前企业关系编号: null,
      企业管理员申请列表: 申请列表,
      ...覆盖,
    },
    派发: mock派发,
    操作: {
      读取企业管理员申请: mock读取申请,
      创建企业管理员申请: mock创建申请,
      取消企业管理员申请: mock取消申请,
      读取目录企业: mock读取目录企业,
      搜索组织: mock搜索组织,
      创建组织: mock创建组织,
    },
    数据源模式: 'backend',
  };
}

/** URL 探针：断言更换选择用 replace 写 organization_id 参数 */
function 位置探针() {
  const 位置 = useLocation();
  return <div data-testid="位置">{位置.pathname}{位置.search}</div>;
}

function 渲染申请页(入口 = '/hr/organization-application') {
  return render(
    <MemoryRouter initialEntries={[入口]}>
      <位置探针 />
      <企业组织申请 />
    </MemoryRouter>,
  );
}

function 证据文件(名 = '执照.png', 类型 = 'image/png', 大小 = 8): File {
  return new File([new Uint8Array(大小)], 名, { type: 类型 });
}

/** 填完一份合法申请（值可用 覆盖 替换单个槽位），不点提交 */
async function 填写(用户: ReturnType<typeof userEvent.setup>, 覆盖: Record<string, string> = {}) {
  const 值: Record<string, string> = {
    公司全称: '上海云衢科技有限公司',
    工商注册号: '91310000MA1FL000X',
    申请说明: '我是这家公司的招聘负责人，附营业执照与在职证明。',
    企业域名: 'yunqu.example',
    ...覆盖,
  };
  await 用户.type(screen.getByLabelText('公司全称'), 值.公司全称);
  await 用户.type(screen.getByLabelText('工商注册号'), 值.工商注册号);
  await 用户.type(screen.getByLabelText('申请说明'), 值.申请说明);
  if (值.企业域名 !== undefined && 值.企业域名 !== '') {
    await 用户.type(screen.getByLabelText('企业域名'), 值.企业域名);
  }
  await 用户.upload(screen.getByLabelText('证明材料'), 证据文件());
}

async function 填写并提交合法申请() {
  const 用户 = userEvent.setup();
  await 填写(用户);
  await 用户.click(screen.getByRole('button', { name: '提交申请' }));
}

describe('企业组织申请 · 必填与冻结边界', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock返回.mockClear();
    mock读取申请.mockClear();
    mock创建申请.mockClear();
    mock创建申请.mockResolvedValue({ 申请: BFF企业管理员申请样本, 列表刷新失败: false });
    mock取消申请.mockClear();
    mock读取目录企业.mockClear();
    mock读取目录企业.mockImplementation(async (编号: string) => ({
      organization_id: 编号,
      display_name: `企业${编号}`,
      legal_name: null,
      verification_status: 'unverified' as const,
    }));
    mock搜索组织.mockClear();
    mock搜索组织.mockResolvedValue(BFF组织搜索页样本);
    mock创建组织.mockClear();
    置Backend应用状态();
  });

  it('四项必填与 evidence 缺失时不调 operation，逐槽提示；域名允许为空不再必填', async () => {
    const 用户 = userEvent.setup();
    渲染申请页();
    await 用户.click(screen.getByRole('button', { name: '提交申请' }));
    expect(mock创建申请).not.toHaveBeenCalled();
    expect(screen.getByText('请填写公司全称')).toBeTruthy();
    expect(screen.getByText('请填写工商注册号')).toBeTruthy();
    expect(screen.getByText('请填写申请说明')).toBeTruthy();
    expect(screen.queryByText('请填写企业域名')).toBeNull();
    expect(screen.getByText('请至少上传 1 份证明材料')).toBeTruthy();
  });

  it('文本超限不调 operation，提示落在同一槽位', async () => {
    const 用户 = userEvent.setup();
    渲染申请页();
    // 先补齐其余槽位，再用 fireEvent 灌超长值（4000+ 字走 type 太慢）
    await 填写(用户);
    fireEvent.change(screen.getByLabelText('公司全称'), { target: { value: '长'.repeat(201) } });
    await 用户.click(screen.getByRole('button', { name: '提交申请' }));
    expect(mock创建申请).not.toHaveBeenCalled();
    expect(screen.getByText('公司全称不超过 200 字')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('公司全称'), { target: { value: '上海云衢科技有限公司' } });
    fireEvent.change(screen.getByLabelText('工商注册号'), { target: { value: '号'.repeat(201) } });
    await 用户.click(screen.getByRole('button', { name: '提交申请' }));
    expect(mock创建申请).not.toHaveBeenCalled();
    expect(screen.getByText('工商注册号不超过 200 字')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('工商注册号'), { target: { value: '91310000MA1FL000X' } });
    fireEvent.change(screen.getByLabelText('申请说明'), { target: { value: '说'.repeat(4001) } });
    await 用户.click(screen.getByRole('button', { name: '提交申请' }));
    expect(mock创建申请).not.toHaveBeenCalled();
    expect(screen.getByText('申请说明不超过 4000 字')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('申请说明'), { target: { value: '附营业执照与在职证明。' } });
    fireEvent.change(screen.getByLabelText('企业域名'), {
      target: { value: Array.from({ length: 21 }, (_, 序) => `d${序}.example`).join(',') },
    });
    await 用户.click(screen.getByRole('button', { name: '提交申请' }));
    expect(mock创建申请).not.toHaveBeenCalled();
    expect(screen.getByText('企业域名最多 20 个')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('企业域名'), {
      target: { value: `${'x'.repeat(254)}.example` },
    });
    await 用户.click(screen.getByRole('button', { name: '提交申请' }));
    expect(mock创建申请).not.toHaveBeenCalled();
    expect(screen.getByText('单个域名不超过 253 字')).toBeTruthy();
  });

  it('evidence 数量/类型/大小越界被拦在 operation 之前', async () => {
    const 用户 = userEvent.setup();
    渲染申请页();
    await 填写(用户);
    await 用户.upload(
      screen.getByLabelText('证明材料'),
      Array.from({ length: 6 }, (_, 序) => 证据文件(`材料${序}.png`)),
    );
    expect(screen.getByText('证明材料最多 5 份')).toBeTruthy();
    expect(mock创建申请).not.toHaveBeenCalled();

    await 用户.upload(screen.getByLabelText('证明材料'), 证据文件('说明.txt', 'text/plain'));
    expect(screen.getByText('证明材料只能是 PNG/JPEG/PDF')).toBeTruthy();
    expect(mock创建申请).not.toHaveBeenCalled();

    const 超大 = new File([new Uint8Array(10 * 1024 * 1024 + 1)], '大图.png', { type: 'image/png' });
    await 用户.upload(screen.getByLabelText('证明材料'), 超大);
    expect(screen.getByText('单份证明材料不超过 10 MiB')).toBeTruthy();
    expect(mock创建申请).not.toHaveBeenCalled();
  });
});

describe('企业组织申请 · 目标企业（合同 C）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock返回.mockClear();
    mock读取申请.mockClear();
    mock创建申请.mockClear();
    mock创建申请.mockResolvedValue({ 申请: BFF企业管理员申请样本, 列表刷新失败: false });
    mock取消申请.mockClear();
    mock读取目录企业.mockClear();
    mock读取目录企业.mockImplementation(async (编号: string) => ({
      organization_id: 编号,
      display_name: `企业${编号}`,
      legal_name: null,
      verification_status: 'unverified' as const,
    }));
    mock搜索组织.mockClear();
    mock搜索组织.mockResolvedValue(BFF组织搜索页样本);
    mock创建组织.mockClear();
    置Backend应用状态();
  });

  it('query 参数优先于档案：刷新后 URL 目标仍被验证并展示，档案坐标不参与', async () => {
    置Backend应用状态([], { 招聘方档案: { ...BFF招聘方档案样本, organization_ref: 'org_1' } });
    渲染申请页('/hr/organization-application?organization_id=org_9');
    expect(mock读取目录企业).toHaveBeenCalledTimes(1);
    expect(mock读取目录企业).toHaveBeenCalledWith('org_9');
    expect(await screen.findByText('企业org_9')).toBeTruthy();
  });

  it('直接访问缺选择：无参数且档案无自报企业时给选择入口，提交不可用', async () => {
    置Backend应用状态([], { 招聘方档案: BFF招聘方档案样本 });
    渲染申请页();
    expect(mock读取目录企业).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '选择企业' })).toBeTruthy();
    expect((screen.getByRole('button', { name: '提交申请' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('目标不存在时显示目标企业不存在并保留选择入口，提交不可用', async () => {
    mock读取目录企业.mockRejectedValue(new BFF错误(404, 'not_found', '没有这个组织'));
    渲染申请页('/hr/organization-application?organization_id=org_x');
    expect(await screen.findByText('目标企业不存在')).toBeTruthy();
    expect(screen.getByRole('button', { name: '选择企业' })).toBeTruthy();
    expect((screen.getByRole('button', { name: '提交申请' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('读取失败与目标不存在分开：给重试且重试重新读取', async () => {
    mock读取目录企业.mockRejectedValueOnce(new BFF错误(503, 'unavailable', 'x'));
    渲染申请页('/hr/organization-application?organization_id=org_1');
    expect(await screen.findByText('企业信息读取失败')).toBeTruthy();
    mock读取目录企业.mockResolvedValueOnce({
      organization_id: 'org_1',
      display_name: '企业org_1',
      legal_name: null,
      verification_status: 'unverified',
    });
    await userEvent.setup().click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('企业org_1')).toBeTruthy();
    expect(mock读取目录企业).toHaveBeenCalledTimes(2);
  });

  it('换企业更新 URL（replace）并清空材料；取消选择保留证据', async () => {
    const 用户 = userEvent.setup();
    渲染申请页('/hr/organization-application?organization_id=org_1');
    expect(await screen.findByText('企业org_1')).toBeTruthy();
    await 填写(用户, { 企业域名: '' });
    expect(screen.getByText('执照.png')).toBeTruthy();

    // 取消选择：Escape 关抽屉，材料与表单原样保留
    await 用户.click(screen.getByRole('button', { name: '更换企业' }));
    await 用户.type(screen.getAllByPlaceholderText('输入公司名称')[0], '云衢');
    await 用户.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '选择企业' })).toBeNull();
    expect(screen.getByText('执照.png')).toBeTruthy();
    expect((screen.getByLabelText('公司全称') as HTMLInputElement).value).toBe('上海云衢科技有限公司');
    expect(screen.getByTestId('位置').textContent).toBe('/hr/organization-application?organization_id=org_1');

    // 换企业：URL replace + 重新验证新目标 + 清空上一企业的材料与表单
    mock搜索组织.mockResolvedValue({
      items: [{ organization_id: 'org_2', display_name: '星桥传媒', legal_name: null, verification_status: 'unverified' }],
      next_cursor: null,
    });
    await 用户.click(screen.getByRole('button', { name: '更换企业' }));
    await 用户.type(screen.getAllByPlaceholderText('输入公司名称')[0], '星桥');
    await 用户.click(await screen.findByRole('button', { name: /星桥传媒/ }));
    expect(screen.getByTestId('位置').textContent).toBe('/hr/organization-application?organization_id=org_2');
    await waitFor(() => expect(mock读取目录企业).toHaveBeenCalledWith('org_2'));
    expect(await screen.findByText('企业org_2')).toBeTruthy();
    // 上一企业的材料已清
    expect(screen.queryByText('执照.png')).toBeNull();
    expect((screen.getByLabelText('公司全称') as HTMLInputElement).value).toBe('');
  });

  it('旧目标迟到响应不覆盖新目标（换企业后旧读取被代际丢弃）', async () => {
    let 兑现旧目标!: (值: { organization_id: string; display_name: string; legal_name: null; verification_status: 'unverified' }) => void;
    mock读取目录企业.mockImplementationOnce(() => new Promise((兑现) => { 兑现旧目标 = 兑现; }));
    const 用户 = userEvent.setup();
    渲染申请页('/hr/organization-application?organization_id=org_old');
    // 旧目标还在读取中就先换企业（抽屉结果直接来自本实例搜索结果）
    await 用户.click(screen.getByRole('button', { name: '选择企业' }));
    await 用户.type(screen.getAllByPlaceholderText('输入公司名称')[0], '云衢');
    await 用户.click(await screen.findByRole('button', { name: /云衢科技/ }));
    expect(mock读取目录企业).toHaveBeenLastCalledWith('org_1');
    expect(await screen.findByText('企业org_1')).toBeTruthy();
    // 旧目标迟到：不得覆盖已确认的新目标
    兑现旧目标({ organization_id: 'org_stale', display_name: '迟到旧企业', legal_name: null, verification_status: 'unverified' });
    await waitFor(() => expect(screen.getByText('企业org_1')).toBeTruthy());
    expect(screen.queryByText('迟到旧企业')).toBeNull();
  });

  it('列表按所选 organization_id 过滤：只展示对应企业申请，取消用该申请的 id', async () => {
    置Backend应用状态([
      { ...BFF企业管理员申请样本, request_id: 'req_2', organization_id: 'org_2', status: 'approved' },
      { ...BFF企业管理员申请样本, request_id: 'req_1', organization_id: 'org_1', status: 'pending' },
    ]);
    const 用户 = userEvent.setup();
    渲染申请页();
    expect(await screen.findByText('当前申请：待审核')).toBeTruthy();
    // 另一家企业的 approved 申请不进本屏（列表绑定企业，不可更换）
    expect(screen.queryByText('当前申请：已通过')).toBeNull();
    await 用户.click(screen.getByRole('button', { name: '取消申请' }));
    expect(mock取消申请).toHaveBeenCalledWith('req_1');
  });

  it('提交已成功而列表刷新失败时保留返回申请并给重试读取', async () => {
    mock创建申请.mockImplementation(async () => {
      // 单元桩同步模拟 operation 的 upsert：返回申请已落全局列表
      mock应用状态.状态.企业管理员申请列表 = [{ ...BFF企业管理员申请样本, request_id: 'req_new' }];
      return { 申请: { ...BFF企业管理员申请样本, request_id: 'req_new' }, 列表刷新失败: true };
    });
    const 用户 = userEvent.setup();
    渲染申请页();
    await 填写并提交合法申请();
    expect(mock创建申请).toHaveBeenCalledTimes(1);
    // 刷新失败不诱导重复 POST：保留返回申请的状态行 + 可重试读取
    expect(await screen.findByText('当前申请：待审核')).toBeTruthy();
    expect(screen.getByText('申请状态刷新失败')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '重试读取' }));
    await waitFor(() => expect(mock读取申请).toHaveBeenCalledTimes(1));
  });
});

describe('企业组织申请 · 提交与恢复', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock返回.mockClear();
    mock读取申请.mockClear();
    mock创建申请.mockClear();
    mock创建申请.mockResolvedValue({ 申请: BFF企业管理员申请样本, 列表刷新失败: false });
    mock取消申请.mockClear();
    mock读取目录企业.mockClear();
    mock读取目录企业.mockImplementation(async (编号: string) => ({
      organization_id: 编号,
      display_name: `企业${编号}`,
      legal_name: null,
      verification_status: 'unverified' as const,
    }));
    mock搜索组织.mockClear();
    mock搜索组织.mockResolvedValue(BFF组织搜索页样本);
    mock创建组织.mockClear();
    置Backend应用状态();
  });

  it('合法提交把精确 metadata（无 display_name、含目标 ID）与原样 File[] 交给 operation', async () => {
    const 用户 = userEvent.setup();
    const 材料 = 证据文件();
    渲染申请页();
    expect(await screen.findByText('企业org_1')).toBeTruthy();
    await 填写(用户, { 企业域名: 'yunqu.example, partner.example' });
    // 再上传一次以精确断言 File 引用（upload 直接替换 input.files，onChange 收到的就是它）
    await 用户.upload(screen.getByLabelText('证明材料'), 材料);
    await 用户.click(screen.getByRole('button', { name: '提交申请' }));
    expect(mock创建申请).toHaveBeenCalledTimes(1);
    const [元数据, 证据] = mock创建申请.mock.calls[0];
    expect(元数据).toEqual({
      organization_id: 'org_1',
      legal_name: '上海云衢科技有限公司',
      registry_key: '91310000MA1FL000X',
      explanation: '我是这家公司的招聘负责人，附营业执照与在职证明。',
      domains: ['yunqu.example', 'partner.example'],
    });
    expect('display_name' in (元数据 as unknown as Record<string, unknown>)).toBe(false);
    expect(证据).toHaveLength(1);
    expect(证据[0]).toBe(材料); // 同一 File 引用：没有中间 data URL 转换
  });

  it('允许 domains 为空数组；名称长度按 Unicode 码点计', async () => {
    const 用户 = userEvent.setup();
    渲染申请页();
    await 填写(用户, { 企业域名: '' });
    // 200 个码点 = 100 个代理对字符：UTF-16 length 是 400，码点计法不误拦
    fireEvent.change(screen.getByLabelText('公司全称'), { target: { value: '𠮷'.repeat(100) } });
    await 用户.click(screen.getByRole('button', { name: '提交申请' }));
    await waitFor(() => expect(mock创建申请).toHaveBeenCalledTimes(1));
    const [元数据] = mock创建申请.mock.calls[0];
    expect(元数据).toEqual(expect.objectContaining({ domains: [], legal_name: '𠮷'.repeat(100) }));
  });

  it('提交成功清掉 File 引用并显示服务端 pending', async () => {
    mock创建申请.mockImplementation(async () => {
      mock应用状态.状态.企业管理员申请列表 = [BFF企业管理员申请样本];
      return { 申请: BFF企业管理员申请样本, 列表刷新失败: false };
    });
    const 用户 = userEvent.setup();
    const { rerender } = 渲染申请页();
    await 填写(用户);
    await 用户.click(screen.getByRole('button', { name: '提交申请' }));
    expect(mock创建申请).toHaveBeenCalledTimes(1);
    // operation 内部重读后状态带出服务端 pending；组件本地 File 引用已清
    rerender(
      <MemoryRouter>
        <位置探针 />
        <企业组织申请 />
      </MemoryRouter>,
    );
    expect(await screen.findByText('当前申请：待审核')).toBeTruthy();
    expect(screen.queryByText('执照.png')).toBeNull();
  });

  it('申请冲突时重读既有申请而不重复 POST', async () => {
    mock创建申请.mockRejectedValue(new BFF错误(409, 'verification_request_conflict', 'conflict'));
    渲染申请页();
    await 填写并提交合法申请();
    expect(mock读取申请).toHaveBeenCalledTimes(1);
    expect(mock创建申请).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('已存在进行中的申请，已载入最新状态')).toBeTruthy();
  });

  it('BFF 校验错误按 path 映射回同一表单槽，不自造第二套限制', async () => {
    mock创建申请.mockRejectedValue(
      new BFF错误(400, 'validation_failed', '校验未通过', [
        { path: 'legal_name', reason: '公司全称与注册记录不一致' },
        { path: 'domains[0]', reason: '域名不在贵司名下' },
      ]),
    );
    const 用户 = userEvent.setup();
    渲染申请页();
    await 填写(用户);
    await 用户.click(screen.getByRole('button', { name: '提交申请' }));
    expect(await screen.findByText('公司全称与注册记录不一致')).toBeTruthy();
    expect(screen.getByText('域名不在贵司名下')).toBeTruthy();
  });

  it('pending 申请可取消；取消 409 保留现有状态并重读', async () => {
    const 用户 = userEvent.setup();
    置Backend应用状态([{ ...BFF企业管理员申请样本, status: 'pending', revision: 3 }]);
    渲染申请页();
    expect(await screen.findByText('当前申请：待审核')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '取消申请' }));
    // 取消带快照 revision 由 operation 内部完成（本屏只传 request_id）
    expect(mock取消申请).toHaveBeenCalledWith('req_1');

    mock取消申请.mockRejectedValue(new BFF错误(409, 'version_conflict', '冲突'));
    await 用户.click(screen.getByRole('button', { name: '取消申请' }));
    expect(mock读取申请).toHaveBeenCalledTimes(1);
    expect(screen.getByText('当前申请：待审核')).toBeTruthy(); // 现有状态不清空
  });

  it('非 pending 申请只读展示，不给取消入口', () => {
    for (const 状态 of ['approved', 'rejected', 'cancelled'] as const) {
      置Backend应用状态([{ ...BFF企业管理员申请样本, status: 状态 }]);
      const { unmount } = 渲染申请页();
      expect(screen.queryByRole('button', { name: '取消申请' })).toBeNull();
      unmount();
    }
  });

  it('提交在途禁止换目标与重复提交', async () => {
    let 兑现!: (值: { 申请: typeof BFF企业管理员申请样本; 列表刷新失败: boolean }) => void;
    mock创建申请.mockReturnValue(new Promise((r) => { 兑现 = r; }));
    const 用户 = userEvent.setup();
    渲染申请页();
    await 填写(用户);
    await 用户.click(screen.getByRole('button', { name: '提交申请' }));
    expect((screen.getByRole('button', { name: '提交申请' }) as HTMLButtonElement).disabled).toBe(true);
    // 提交在途：换目标入口被禁用
    expect((screen.getByRole('button', { name: '更换企业' }) as HTMLButtonElement).disabled).toBe(true);
    兑现({ 申请: BFF企业管理员申请样本, 列表刷新失败: false });
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '提交申请' }) as HTMLButtonElement).disabled).toBe(false),
    );
  });
});