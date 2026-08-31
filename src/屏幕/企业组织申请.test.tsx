// 企业组织申请 · multipart 提交与恢复组件测试（P1C Task 3 Step 3）。
// 边界按 P1B 冻结：legal<=200 / display<=80 / registry<=200 / explanation<=4000 /
// domains<=20 且每项<=253；evidence 1–5 个 PNG/JPEG/PDF 各<=10MiB。
// 超限不调 operation；BFF {path,reason} 映射回同一表单槽；conflict 重读不重复 POST。

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 企业组织申请 from './企业组织申请';
import { BFF企业管理员申请样本 } from '../测试/BFF样本';
import { BFF错误 } from '../数据/HTTP客户端';
import type { BFF企业管理员申请元数据 } from '../数据/BFF契约';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock读取申请 = vi.fn(async () => {});
// 带签名声明，mock.calls 才是 [BFF企业管理员申请元数据, File[]] 元组
const mock创建申请 = vi.fn(async (_元数据: BFF企业管理员申请元数据, _证据: File[]) => {});
const mock取消申请 = vi.fn(async (_申请编号: string) => {});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }),
}));

function 置Backend应用状态(申请列表 = [] as unknown[]) {
  mock应用状态 = {
    状态: { 企业管理员申请列表: 申请列表 },
    派发: mock派发,
    操作: {
      读取企业管理员申请: mock读取申请,
      创建企业管理员申请: mock创建申请,
      取消企业管理员申请: mock取消申请,
    },
    数据源模式: 'backend',
  };
}

function 证据文件(名 = '执照.png', 类型 = 'image/png', 大小 = 8): File {
  return new File([new Uint8Array(大小)], 名, { type: 类型 });
}

/** 填完一份合法申请（值可用 覆盖 替换单个槽位），不点提交 */
async function 填写(用户: ReturnType<typeof userEvent.setup>, 覆盖: Record<string, string> = {}) {
  const 值: Record<string, string> = {
    公司全称: '上海云衢科技有限公司',
    对外名称: '云衢科技',
    工商注册号: '91310000MA1FL000X',
    申请说明: '我是这家公司的招聘负责人，附营业执照与在职证明。',
    企业域名: 'yunqu.example',
    ...覆盖,
  };
  await 用户.type(screen.getByLabelText('公司全称'), 值.公司全称);
  await 用户.type(screen.getByLabelText('对外名称'), 值.对外名称);
  await 用户.type(screen.getByLabelText('工商注册号'), 值.工商注册号);
  await 用户.type(screen.getByLabelText('申请说明'), 值.申请说明);
  await 用户.type(screen.getByLabelText('企业域名'), 值.企业域名);
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
    mock创建申请.mockResolvedValue(undefined);
    mock取消申请.mockClear();
    置Backend应用状态();
  });

  it('五项必填与 evidence 缺失时不调 operation，逐槽提示', async () => {
    const 用户 = userEvent.setup();
    render(<MemoryRouter><企业组织申请 /></MemoryRouter>);
    await 用户.click(screen.getByRole('button', { name: '提交申请' }));
    expect(mock创建申请).not.toHaveBeenCalled();
    expect(screen.getByText('请填写公司全称')).toBeTruthy();
    expect(screen.getByText('请填写对外名称')).toBeTruthy();
    expect(screen.getByText('请填写工商注册号')).toBeTruthy();
    expect(screen.getByText('请填写申请说明')).toBeTruthy();
    expect(screen.getByText('请填写企业域名')).toBeTruthy();
    expect(screen.getByText('请至少上传 1 份证明材料')).toBeTruthy();
  });

  it('文本超限不调 operation，提示落在同一槽位', async () => {
    const 用户 = userEvent.setup();
    render(<MemoryRouter><企业组织申请 /></MemoryRouter>);
    // 先补齐其余槽位，再用 fireEvent 灌超长值（4000+ 字走 type 太慢）
    await 填写(用户);
    fireEvent.change(screen.getByLabelText('公司全称'), { target: { value: '长'.repeat(201) } });
    await 用户.click(screen.getByRole('button', { name: '提交申请' }));
    expect(mock创建申请).not.toHaveBeenCalled();
    expect(screen.getByText('公司全称不超过 200 字')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('公司全称'), { target: { value: '上海云衢科技有限公司' } });
    fireEvent.change(screen.getByLabelText('对外名称'), { target: { value: '名'.repeat(81) } });
    await 用户.click(screen.getByRole('button', { name: '提交申请' }));
    expect(mock创建申请).not.toHaveBeenCalled();
    expect(screen.getByText('对外名称不超过 80 字')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('对外名称'), { target: { value: '云衢科技' } });
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
    render(<MemoryRouter><企业组织申请 /></MemoryRouter>);
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

describe('企业组织申请 · 提交与恢复', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    mock返回.mockClear();
    mock读取申请.mockClear();
    mock创建申请.mockClear();
    mock创建申请.mockResolvedValue(undefined);
    mock取消申请.mockClear();
    mock取消申请.mockResolvedValue(undefined);
    置Backend应用状态();
  });

  it('合法提交把 metadata 与原样 File[] 交给 operation，不转 data URL', async () => {
    const 用户 = userEvent.setup();
    const 材料 = 证据文件();
    render(<MemoryRouter><企业组织申请 /></MemoryRouter>);
    await 填写(用户, { 企业域名: 'yunqu.example, partner.example' });
    // 再上传一次以精确断言 File 引用（upload 直接替换 input.files，onChange 收到的就是它）
    await 用户.upload(screen.getByLabelText('证明材料'), 材料);
    await 用户.click(screen.getByRole('button', { name: '提交申请' }));
    expect(mock创建申请).toHaveBeenCalledTimes(1);
    const [元数据, 证据] = mock创建申请.mock.calls[0];
    expect(元数据).toEqual({
      legal_name: '上海云衢科技有限公司',
      display_name: '云衢科技',
      registry_key: '91310000MA1FL000X',
      explanation: '我是这家公司的招聘负责人，附营业执照与在职证明。',
      domains: ['yunqu.example', 'partner.example'],
    });
    expect(证据).toHaveLength(1);
    expect(证据[0]).toBe(材料); // 同一 File 引用：没有中间 data URL 转换
  });

  it('提交成功清掉 File 引用并显示服务端 pending', async () => {
    mock创建申请.mockImplementation(async () => {
      mock应用状态.状态.企业管理员申请列表 = [BFF企业管理员申请样本];
    });
    const 用户 = userEvent.setup();
    const { rerender } = render(<MemoryRouter><企业组织申请 /></MemoryRouter>);
    await 填写(用户);
    await 用户.click(screen.getByRole('button', { name: '提交申请' }));
    expect(mock创建申请).toHaveBeenCalledTimes(1);
    // operation 内部重读后状态带出服务端 pending；组件本地 File 引用已清
    rerender(<MemoryRouter><企业组织申请 /></MemoryRouter>);
    expect(await screen.findByText('当前申请：待审核')).toBeTruthy();
    expect(screen.queryByText('执照.png')).toBeNull();
  });

  it('申请冲突时重读既有申请而不重复 POST', async () => {
    mock创建申请.mockRejectedValue(new BFF错误(409, 'verification_request_conflict', 'conflict'));
    render(<MemoryRouter><企业组织申请 /></MemoryRouter>);
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
    render(<MemoryRouter><企业组织申请 /></MemoryRouter>);
    await 填写(用户);
    await 用户.click(screen.getByRole('button', { name: '提交申请' }));
    expect(await screen.findByText('公司全称与注册记录不一致')).toBeTruthy();
    expect(screen.getByText('域名不在贵司名下')).toBeTruthy();
  });

  it('pending 申请可取消；取消 409 保留现有状态并重读', async () => {
    const 用户 = userEvent.setup();
    置Backend应用状态([{ ...BFF企业管理员申请样本, status: 'pending', revision: 3 }]);
    render(<MemoryRouter><企业组织申请 /></MemoryRouter>);
    expect(screen.getByText('当前申请：待审核')).toBeTruthy();
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
      const { unmount } = render(<MemoryRouter><企业组织申请 /></MemoryRouter>);
      expect(screen.queryByRole('button', { name: '取消申请' })).toBeNull();
      unmount();
    }
  });
});
