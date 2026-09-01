// 公司档案分区编辑 · Backend/Mock 双分支测试（P1C Task 4 Step 3/5）。
// Backend：草稿=从 企业档案快照 构造的完整 资料形，保存走 保存企业档案（完整 replacement），
// 409/503 草稿保留由用户重按保存；基本信息槽位改名「品牌名称」+ 只读「工商全称（已核验）」；
// 行业走 industries taxonomy（roots/parentId 展开/q 搜索，selectable 叶子原子写显示名+引用）；
// 媒体走 上传并发布企业媒体/移除企业媒体；P1B 长度/数量/文件上限冻结在页面。
// P0 Task 5 起深链先过 招聘方组织门：任何非就绪态都不得挂出空的可编辑草稿。
// Mock：原静态档 + 存公司自述 路径逐字保留。仓库未装 jest-dom，断言直接读 DOM。

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 公司档案分区编辑 from './公司档案分区编辑';
import {
  BFF企业关系样本,
  BFF企业媒体样本,
  BFF企业档案样本,
  BFF公开企业样本,
} from '../测试/BFF样本';
import type { BFFTaxonomyItem } from '../数据/BFF契约';
import { 从BFF企业档案 } from '../数据/组织映射';
import { BFF错误 } from '../数据/HTTP客户端';
import { 路径 } from '../路由/路径表';
import type { 企业媒体脱离错误 } from '../状态/后端/组织操作';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock保存企业档案 = vi.fn(async () => {});
const mock上传媒体 = vi.fn(async () => {});
const mock移除媒体 = vi.fn(async () => {});
const mock查询Taxonomy = vi.fn();
const mock重新水合招聘方组织 = vi.fn(async () => {});
const mock取公司档案 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }),
}));
vi.mock('../数据/公司档案', async (导入原模块) => {
  const 实际 = await 导入原模块() as typeof import('../数据/公司档案');
  return {
    ...实际,
    取公司档案: (...参数: unknown[]) => {
      mock取公司档案(...参数);
      return 实际.取公司档案(...参数 as [string]);
    },
  };
});

/** Backend 媒体上传的合法文件（PNG、小于 10 MiB） */
const pngFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], '照片.png', { type: 'image/png' });
const webpFile = new File([new Uint8Array(8)], '照片.webp', { type: 'image/webp' });
const 超大图 = new File([new Uint8Array(10 * 1024 * 1024 + 1)], '大图.png', { type: 'image/png' });

const { profile: _档案, ...身份样本 } = BFF公开企业样本;

// ── industries taxonomy 桩：根项 / 根的子项 / 搜索结果 三种形态 ──
const 行业根: BFFTaxonomyItem[] = [
  { id: 'ind_root', display_name: '互联网', parent_id: null, selectable: false },
  { id: 'ind_ai', display_name: '人工智能', parent_id: null, selectable: true },
];
const 行业子项: BFFTaxonomyItem[] = [
  { id: 'ind_web', display_name: '网页', parent_id: 'ind_root', selectable: false },
  { id: 'ind_ecom', display_name: '电子商务', parent_id: 'ind_root', selectable: true },
];
const 行业搜索结果: BFFTaxonomyItem[] = [
  { id: 'ind_fintech', display_name: '金融科技', parent_id: null, selectable: true },
];

function 目录页Of(items: BFFTaxonomyItem[]) {
  return { items, nextCursor: null, catalogVersion: 'v1' };
}

// 两个 active+verified 的可用关系：多可用但 current 为空时走「先选任职企业」引导
const verified关系A = BFF企业关系样本;
const verified关系B = {
  ...BFF企业关系样本,
  affiliation_id: 'aff_2',
  organization_id: 'org_2',
  organization_display_name: '另一家企业',
};

/** 覆盖里的 后端状态 与 状态 字段平级传入（与 招聘方组织门 读的两处根状态一一对应）。 */
function 置Backend应用状态(覆盖: Record<string, unknown> = {}) {
  const { 后端状态: 后端覆盖, ...状态覆盖 } = 覆盖;
  mock应用状态 = {
    状态: {
      企业关系列表: [BFF企业关系样本],
      当前企业关系编号: BFF企业关系样本.affiliation_id,
      企业档案快照: BFF企业档案样本,
      当前企业身份: 身份样本,
      公司自述: null,
      公司LOGO: null,
      ...状态覆盖,
    },
    后端状态: {
      招聘方组织水合: { 阶段: '成功', 错误: null },
      ...(后端覆盖 as Record<string, unknown> | undefined),
    },
    派发: mock派发,
    操作: {
      保存企业档案: mock保存企业档案,
      上传并发布企业媒体: mock上传媒体,
      移除企业媒体: mock移除媒体,
      重新水合招聘方组织: mock重新水合招聘方组织,
    },
    目录查询: { 查询Taxonomy: mock查询Taxonomy },
    数据源模式: 'backend',
  };
}

function 置Mock应用状态() {
  mock应用状态 = {
    状态: { 公司自述: null, 公司LOGO: null },
    派发: mock派发,
  };
}

function 渲染分区(段: string) {
  return render(
    <MemoryRouter initialEntries={[`/hr/company-profile/${段}`]}>
      <Routes>
        <Route path="/hr/company-profile/:area" element={<公司档案分区编辑 />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** 受控挂起 promise：证明「上传在飞」时页面的卸载行为 */
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mock派发.mockClear();
  mock跳转.mockClear();
  mock返回.mockClear();
  mock保存企业档案.mockClear();
  mock保存企业档案.mockResolvedValue(undefined);
  mock上传媒体.mockClear();
  mock上传媒体.mockResolvedValue(undefined);
  mock移除媒体.mockClear();
  mock移除媒体.mockResolvedValue(undefined);
  mock重新水合招聘方组织.mockClear();
  mock重新水合招聘方组织.mockResolvedValue(undefined);
  mock查询Taxonomy.mockReset();
  mock查询Taxonomy.mockImplementation(
    async (_kind: 'industries', query: { parentId?: string; q?: string }) => {
      if (query.parentId) return 目录页Of(query.parentId === 'ind_root' ? 行业子项 : []);
      if (query.q) return 目录页Of(行业搜索结果);
      return 目录页Of(行业根);
    },
  );
  mock取公司档案.mockClear();
});

describe('公司档案分区编辑 · Backend 完整 replacement', () => {
  it('基本信息槽位是「品牌名称」，工商全称只读展示且 verified_at 不进编辑页', () => {
    置Backend应用状态();
    渲染分区('basic');
    const 品牌输入 = screen.getByLabelText('品牌名称') as HTMLInputElement;
    expect(品牌输入.value).toBe('云衢科技');
    expect(品牌输入.maxLength).toBe(40);
    expect(screen.queryByLabelText('公司全称')).toBeNull();
    expect(screen.getByText('工商全称（已核验）')).toBeTruthy();
    expect(screen.getByText('上海云衢科技有限公司')).toBeTruthy();
    // 只读信息行不是输入框，核验时间/在招岗位数这类平台事实不出现
    expect(screen.queryByLabelText('工商全称（已核验）')).toBeNull();
    expect(screen.queryByText('2026-08-24T00:00:00Z')).toBeNull();
  });

  it('保存提交完整 资料形 草稿，不派发 存公司自述/存公司LOGO，不读静态档', async () => {
    置Backend应用状态();
    const 用户 = userEvent.setup();
    渲染分区('basic');
    await 用户.clear(screen.getByLabelText('品牌名称'));
    await 用户.type(screen.getByLabelText('品牌名称'), '新品牌');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock保存企业档案).toHaveBeenCalledTimes(1);
    expect(mock保存企业档案).toHaveBeenCalledWith({
      ...从BFF企业档案(BFF企业档案样本),
      公司全称: '新品牌',
    });
    expect(mock派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '存公司自述' }));
    expect(mock派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '存公司LOGO' }));
    expect(mock取公司档案).not.toHaveBeenCalled();
    expect(await screen.findByText('已保存')).toBeTruthy();
    expect(mock返回).toHaveBeenCalled();
  });

  it('409 草稿保留、不离开页面，用户再按一次保存才重试', async () => {
    置Backend应用状态();
    mock保存企业档案.mockRejectedValue(new BFF错误(409, 'version_conflict', 'conflict'));
    const 用户 = userEvent.setup();
    渲染分区('basic');
    await 用户.type(screen.getByLabelText('品牌名称'), '冲突版');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('数据已在其他地方更新，请重试')).toBeTruthy();
    // 草稿在页面手里：operation 重读了权威 snapshot，但没顶掉用户的输入
    expect((screen.getByLabelText('品牌名称') as HTMLInputElement).value).toBe('云衢科技冲突版');
    expect(mock返回).not.toHaveBeenCalled();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock保存企业档案).toHaveBeenCalledTimes(2);
  });

  it('行业选择：打开读根项、展开读子项，selectable 叶子原子写显示名+引用', async () => {
    置Backend应用状态();
    const 用户 = userEvent.setup();
    渲染分区('basic');
    expect(mock查询Taxonomy).not.toHaveBeenCalled();
    await 用户.click(screen.getByLabelText('更换行业'));
    await waitFor(() => expect(mock查询Taxonomy).toHaveBeenCalledWith('industries', { limit: 50 }));
    expect(await screen.findByRole('button', { name: '互联网 ›' })).toBeTruthy();
    // 非 selectable 根项只做展开导航
    await 用户.click(screen.getByRole('button', { name: '互联网 ›' }));
    await waitFor(() =>
      expect(mock查询Taxonomy).toHaveBeenCalledWith('industries', { parentId: 'ind_root', limit: 50 }),
    );
    await 用户.click(await screen.findByRole('button', { name: '电子商务' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock保存企业档案).toHaveBeenCalledWith(expect.objectContaining({
      行业: '电子商务',
      行业引用: { id: 'ind_ecom', display_name: '电子商务' },
    }));
  });

  it('行业搜索按 q 查询并可直接选中结果叶子', async () => {
    置Backend应用状态();
    const 用户 = userEvent.setup();
    渲染分区('basic');
    await 用户.click(screen.getByLabelText('更换行业'));
    await 用户.type(screen.getByLabelText('搜索行业'), '金融');
    await waitFor(() =>
      expect(mock查询Taxonomy).toHaveBeenCalledWith('industries', { q: '金融', limit: 50 }),
    );
    await 用户.click(await screen.findByRole('button', { name: '金融科技' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock保存企业档案).toHaveBeenCalledWith(expect.objectContaining({
      行业引用: { id: 'ind_fintech', display_name: '金融科技' },
    }));
  });

  it.each([
    ['member 权限不足', { role: 'member' as const }],
  ])('%s：无保存按钮、输入禁用、无上传入口', (_名, 关系覆盖) => {
    置Backend应用状态({ 企业关系列表: [{ ...BFF企业关系样本, ...关系覆盖 }] });
    渲染分区('basic');
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull();
    expect((screen.getByLabelText('品牌名称') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByLabelText('更换行业')).toBeNull();
    expect(screen.queryByLabelText('上传公司 LOGO')).toBeNull();
    expect(screen.getByText('仅企业管理员可修改')).toBeTruthy();
    // 只读不等于不可看：工商全称照常展示
    expect(screen.getByText('上海云衢科技有限公司')).toBeTruthy();
  });

  // ── 深链直达同样过 招聘方组织门：任何非就绪态都不得挂出空的可编辑草稿 ──

  it('只有真实组织水合在飞时显示加载，不挂草稿表单', () => {
    置Backend应用状态({
      后端状态: { 招聘方组织水合: { 阶段: '进行中', 错误: null } },
      企业档案快照: null,
    });
    渲染分区('basic');
    expect(screen.getByText('正在加载企业资料').textContent).toBe('正在加载企业资料');
    expect(screen.queryByLabelText('品牌名称')).toBeNull();
    expect(mock取公司档案).not.toHaveBeenCalled();
  });

  it('无可用 affiliation 深链显示两个现有动作，不挂草稿表单', async () => {
    置Backend应用状态({
      后端状态: { 招聘方组织水合: { 阶段: '成功', 错误: null } },
      企业关系列表: [], 当前企业关系编号: null, 企业档案快照: null, 当前企业身份: null,
    });
    const 用户 = userEvent.setup();
    渲染分区('basic');
    expect(screen.queryByText('正在加载企业资料')).toBeNull();
    expect(screen.queryByLabelText('品牌名称')).toBeNull();
    await 用户.click(screen.getByRole('button', { name: '申请成为企业管理员' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.企业组织申请);
    await 用户.click(screen.getByRole('button', { name: '使用邀请加入企业' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.企业邀请加入);
  });

  it.each([
    ['pending 尚未核验', { status: 'pending' as const }],
    ['revoked 已解除', { status: 'revoked' as const }],
    ['suspended 企业停用', { organization_status: 'suspended' as const }],
  ])('%s：深链落申请空态而不是空草稿', (_名, 关系覆盖) => {
    置Backend应用状态({
      后端状态: { 招聘方组织水合: { 阶段: '成功', 错误: null } },
      企业关系列表: [{ ...BFF企业关系样本, ...关系覆盖 }],
    });
    渲染分区('basic');
    expect(screen.getByRole('button', { name: '申请成为企业管理员' })).toBeTruthy();
    expect(screen.queryByLabelText('品牌名称')).toBeNull();
  });

  it('多个可用关系但 current 为空时深链引导选择，不显示申请空态', () => {
    置Backend应用状态({
      后端状态: { 招聘方组织水合: { 阶段: '成功', 错误: null } },
      企业关系列表: [verified关系A, verified关系B],
      当前企业关系编号: null, 企业档案快照: null, 当前企业身份: null,
    });
    渲染分区('basic');
    expect(screen.getByText('请先选择当前任职企业').textContent).toBe('请先选择当前任职企业');
    expect(screen.queryByRole('button', { name: '申请成为企业管理员' })).toBeNull();
    expect(screen.queryByLabelText('品牌名称')).toBeNull();
  });

  it('水合成功但快照缺失时深链给重试，不挂空草稿也不合成组织', async () => {
    置Backend应用状态({ 企业档案快照: null, 当前企业身份: null });
    const 用户 = userEvent.setup();
    渲染分区('basic');
    expect(screen.queryByText('正在加载企业资料')).toBeNull();
    expect(screen.queryByLabelText('品牌名称')).toBeNull();
    await 用户.click(screen.getByRole('button', { name: '重试' }));
    expect(mock重新水合招聘方组织).toHaveBeenCalledTimes(1);
  });

  it('深链重试被拒绝也不清当前档案、不回落 Mock', async () => {
    mock重新水合招聘方组织.mockRejectedValue(new Error('网络断开'));
    置Backend应用状态({ 企业档案快照: null, 当前企业身份: null });
    const 用户 = userEvent.setup();
    渲染分区('basic');
    await 用户.click(screen.getByRole('button', { name: '重试' }));
    expect(mock派发).not.toHaveBeenCalled();
    expect(mock取公司档案).not.toHaveBeenCalled();
    expect(screen.getByText('企业资料状态不完整，请重新加载').textContent)
      .toBe('企业资料状态不完整，请重新加载');
  });

  it('P1B 长度上限冻结在输入端：办公地址 80 / 公司介绍 500 / 产品介绍 300', () => {
    置Backend应用状态();
    let 视图 = 渲染分区('basic');
    expect((screen.getByLabelText('办公地址') as HTMLTextAreaElement).maxLength).toBe(80);
    视图.unmount();
    视图 = 渲染分区('intro');
    expect((screen.getByLabelText('公司介绍') as HTMLTextAreaElement).maxLength).toBe(500);
    视图.unmount();
    视图 = 渲染分区('product');
    expect((screen.getByLabelText('产品介绍') as HTMLTextAreaElement).maxLength).toBe(300);
    视图.unmount();
  });

  it('主营业务超 20 条或单条超 200 字拒绝保存，合法多行可保存', async () => {
    置Backend应用状态();
    const 用户 = userEvent.setup();
    渲染分区('business');
    const 框 = screen.getByLabelText('主营业务') as HTMLTextAreaElement;
    fireEvent.change(框, { target: { value: Array.from({ length: 21 }, (_, i) => `业务${i}`).join('\n') } });
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('主营业务最多 20 条')).toBeTruthy();
    expect(mock保存企业档案).not.toHaveBeenCalled();
    fireEvent.change(框, { target: { value: 'x'.repeat(201) } });
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('每条主营业务不超过 200 字')).toBeTruthy();
    expect(mock保存企业档案).not.toHaveBeenCalled();
    fireEvent.change(框, { target: { value: '第一条\n第二条' } });
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock保存企业档案).toHaveBeenCalledTimes(1));
  });

  it('团队成员字段上限 16/20/60，成员数到 20 后不再提供添加键', () => {
    置Backend应用状态();
    let 视图 = 渲染分区('team');
    expect((screen.getByLabelText('成员 1 姓名') as HTMLInputElement).maxLength).toBe(16);
    expect((screen.getByLabelText('成员 1 职务') as HTMLInputElement).maxLength).toBe(20);
    expect((screen.getByLabelText('成员 1 简介') as HTMLTextAreaElement).maxLength).toBe(60);
    视图.unmount();
    置Backend应用状态({
      企业档案快照: {
        ...BFF企业档案样本,
        team_members: Array.from({ length: 20 }, (_, i) => ({
          name: `成员${i}`, title: '', summary: '',
        })),
      },
    });
    视图 = 渲染分区('team');
    expect(screen.queryByRole('button', { name: '＋ 添加成员' })).toBeNull();
    视图.unmount();
  });

  it('相册每组最多 3 张：满组不给添加键，删除走 移除企业媒体(purpose, media_id)', async () => {
    const 媒体2 = { ...BFF企业媒体样本, media_id: 'media_2', url: 'https://cdn.example.com/org_1/media_2.png' };
    const 媒体3 = { ...BFF企业媒体样本, media_id: 'media_3', url: 'https://cdn.example.com/org_1/media_3.png' };
    置Backend应用状态({
      企业档案快照: {
        ...BFF企业档案样本,
        office_media: [BFF企业媒体样本, 媒体2, 媒体3],
        company_media: [BFF企业媒体样本],
      },
    });
    const 用户 = userEvent.setup();
    渲染分区('album');
    expect(screen.getByText('实景照片 3/3')).toBeTruthy();
    expect(screen.queryByLabelText('添加实景照片')).toBeNull();
    expect(screen.getByText('公司照片 1/3')).toBeTruthy();
    expect(screen.getByLabelText('添加公司照片')).toBeTruthy();
    await 用户.click(screen.getByLabelText('删除实景照片第 1 张'));
    expect(mock移除媒体).toHaveBeenCalledWith('office_photo', 'media_1');
  });

  it('相册上传校验 PNG/JPEG 与 10 MiB，合法文件按 purpose 调 上传并发布企业媒体', async () => {
    置Backend应用状态();
    const 用户 = userEvent.setup();
    const 建对象 = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:album-preview');
    渲染分区('album');
    await 用户.upload(screen.getByLabelText('上传公司照片'), webpFile);
    expect(await screen.findByText('仅支持 PNG / JPEG 图片')).toBeTruthy();
    await 用户.upload(screen.getByLabelText('上传公司照片'), 超大图);
    expect(await screen.findByText('图片不超过 10 MiB')).toBeTruthy();
    expect(建对象).not.toHaveBeenCalled();
    expect(mock上传媒体).not.toHaveBeenCalled();
    await 用户.upload(screen.getByLabelText('上传公司照片'), pngFile);
    await waitFor(() => expect(mock上传媒体).toHaveBeenCalledWith('company_photo', pngFile));
  });

  it('LOGO 上传走 organization_logo purpose', async () => {
    置Backend应用状态();
    const 用户 = userEvent.setup();
    渲染分区('basic');
    await 用户.upload(screen.getByLabelText('更换公司 LOGO'), pngFile);
    await waitFor(() => expect(mock上传媒体).toHaveBeenCalledWith('organization_logo', pngFile));
  });
});

describe('公司档案分区编辑 · Backend 媒体两步协议（页面侧）', () => {
  it('上传失败提示错误并回收预览，不出现放弃键', async () => {
    置Backend应用状态();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:album-fail');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    mock上传媒体.mockRejectedValue(new BFF错误(500, 'internal', '上传失败'));
    const 用户 = userEvent.setup();
    渲染分区('album');
    await 用户.upload(screen.getByLabelText('上传公司照片'), pngFile);
    expect(await screen.findByText('上传失败')).toBeTruthy();
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:album-fail'));
    expect(screen.queryByRole('button', { name: '放弃未发布的照片' })).toBeNull();
    expect(mock移除媒体).not.toHaveBeenCalled();
  });

  it('发布失败的脱离收据给「放弃未发布的照片」：点击后 best-effort 移除', async () => {
    置Backend应用状态();
    const 错误 = new BFF错误(500, 'internal', '发布失败') as 企业媒体脱离错误;
    错误.脱离媒体 = { purpose: 'company_photo', media_id: 'media_b1' };
    mock上传媒体.mockRejectedValue(错误);
    const 用户 = userEvent.setup();
    渲染分区('album');
    await 用户.upload(screen.getByLabelText('上传公司照片'), pngFile);
    expect(await screen.findByRole('button', { name: '放弃未发布的照片' })).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '放弃未发布的照片' }));
    await waitFor(() => expect(mock移除媒体).toHaveBeenCalledWith('company_photo', 'media_b1'));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '放弃未发布的照片' })).toBeNull(),
    );
  });

  it('放弃清理失败也静默收口（best-effort，不阻塞页面）', async () => {
    置Backend应用状态();
    const 错误 = new BFF错误(500, 'internal', '发布失败') as 企业媒体脱离错误;
    错误.脱离媒体 = { purpose: 'company_photo', media_id: 'media_b1' };
    mock上传媒体.mockRejectedValue(错误);
    mock移除媒体.mockRejectedValue(new BFF错误(403, 'organization_admin_required', '需要管理员'));
    const 用户 = userEvent.setup();
    渲染分区('album');
    await 用户.upload(screen.getByLabelText('上传公司照片'), pngFile);
    await 用户.click(await screen.findByRole('button', { name: '放弃未发布的照片' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '放弃未发布的照片' })).toBeNull(),
    );
  });

  it('上传在飞时卸载只回收 object URL，不把卸载当服务器删除', async () => {
    置Backend应用状态();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:album-inflight');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const 门 = deferred<void>();
    mock上传媒体.mockImplementation(() => 门.promise);
    const 用户 = userEvent.setup();
    const 视图 = 渲染分区('album');
    await 用户.upload(screen.getByLabelText('上传公司照片'), pngFile);
    视图.unmount();
    expect(revoke).toHaveBeenCalledWith('blob:album-inflight');
    expect(mock移除媒体).not.toHaveBeenCalled();
    门.resolve();
    await Promise.resolve();
  });
});

describe('公司档案分区编辑 · Mock 原型保持不变', () => {
  it('基本信息仍是「公司全称」就地编辑，保存派发 存公司自述 并返回', async () => {
    置Mock应用状态();
    const 用户 = userEvent.setup();
    渲染分区('basic');
    expect(screen.getByLabelText('公司全称')).toBeTruthy();
    expect(screen.queryByLabelText('品牌名称')).toBeNull();
    expect(screen.queryByText('工商全称（已核验）')).toBeNull();
    // Mock 没有目录 seam，行业仍是静态池片组
    expect(mock查询Taxonomy).not.toHaveBeenCalled();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() =>
      expect(mock派发).toHaveBeenCalledWith(expect.objectContaining({ 型: '存公司自述' })),
    );
    expect(mock返回).toHaveBeenCalled();
    expect(mock保存企业档案).not.toHaveBeenCalled();
  });
});
