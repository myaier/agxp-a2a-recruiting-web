// 发布岗位页 Backend 提交测试（Task 7）：
// 编辑保存成功前不导航；await 操作.更新岗位 落定后才返回。
// Backend 选择器：选类别候选 + 选城市候选 → 发布带 类别引用/地点引用（id+display_name）；
// 手输城市不选候选 → 发布被拦（操作.发布岗位 不调用）。
// Mock 下 操作 内部同步 dispatch，DOM/流程由现有 onboarding E2E 覆盖。

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 发布岗位, { 取岗位提交错误文案 } from './发布岗位';
import { 页面岗位样本 } from '../测试/BFF样本';
import { BFF错误 } from '../数据/HTTP客户端';
import type { BFFJD导入, BFFJD导入失败码, BFFJD建议 } from '../数据/BFF契约';

const mock返回 = vi.fn();
const mock进企业主壳 = vi.fn();
const mock替换跳转 = vi.fn();
const mock跳转 = vi.fn();
const mock更新岗位 = vi.fn();
const mock发布岗位 = vi.fn();
const mock删除岗位 = vi.fn();
const mock创建JD导入 = vi.fn();
const mock读取JD导入 = vi.fn();

// P4 互认 Task 3：结构化要求确认勾选框的可访问名称（label 内 span 文案），测试与实现共用
const 结构化确认文案 =
  '我已确认经验和学历设置将作为自动匹配依据；补充要求不会被自动解析。修改上述内容后需要重新确认。';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({
    返回: mock返回,
    进企业主壳: mock进企业主壳,
    替换跳转: mock替换跳转,
    跳转: mock跳转,
  }),
}));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

/** 轻提示 是挂在 document.body 上的纯 DOM 单例，RTL cleanup 不清它。
 *  每个用例开头清一次，保证「有没有弹这条」问的是本用例自己弹的。 */
function 清空轻提示() {
  for (const 节点 of Array.from(document.body.children)) {
    const 元素 = 节点 as HTMLElement;
    if (元素.style.position === 'fixed' && 元素.style.zIndex === '999') 元素.innerHTML = '';
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** P0 修复 Task 4：发岗前置校验会读组织链三字段，两个桩都按 初始状态 的形状补齐。 */
type 组织覆盖 = {
  企业关系列表?: unknown[];
  当前企业关系编号?: string | null;
  未认证公司声明?: string;
  企业认证?: { 姓名: string; 公司: string };
};

function 组基础状态(覆盖: 组织覆盖 = {}) {
  return {
    岗位列表: [页面岗位样本],
    企业候选列表: [],
    企业关系列表: 覆盖.企业关系列表 ?? [],
    当前企业关系编号: 覆盖.当前企业关系编号 ?? null,
    未认证公司声明: 覆盖.未认证公司声明 ?? '星河科技',
    企业认证: 覆盖.企业认证 ?? { 姓名: '林澈', 公司: 'Mock 公司' },
  };
}

/** 默认 Mock 模式桩：数据源模式 undefined → 是后端=false，与原 Mock 测试同形 */
function 置Mock应用状态(覆盖: 组织覆盖 = {}) {
  mock应用状态 = {
    状态: 组基础状态(覆盖),
    派发: vi.fn(),
    操作: { 更新岗位: mock更新岗位, 发布岗位: mock发布岗位, 删除岗位: mock删除岗位 },
  };
}

/** Backend 桩：数据源模式 'backend' + 目录查询 seam（查询Taxonomy/查询Location 可注入） */
function 置Backend应用状态(
  查询Taxonomy: ReturnType<typeof vi.fn>,
  查询Location: ReturnType<typeof vi.fn>,
  覆盖: 组织覆盖 = {},
) {
  mock应用状态 = {
    状态: 组基础状态(覆盖),
    派发: vi.fn(),
    操作: {
      更新岗位: mock更新岗位, 发布岗位: mock发布岗位, 删除岗位: mock删除岗位,
      创建JD导入: mock创建JD导入, 读取JD导入: mock读取JD导入,
    },
    数据源模式: 'backend',
    // JD 导入入口按当前角色守卫：缺省给 recruiter 主体，用例可按需改写
    后端状态: { 主体: { subject_id: 'sub_1', roles: [], last_used_role: 'recruiter' } },
    目录查询: {
      查询Taxonomy,
      查询Location,
      查询Institution: vi.fn(),
    },
  };
}

describe('发布岗位页 Backend 提交', () => {
  beforeEach(() => {
    mock返回.mockClear();
    mock进企业主壳.mockClear();
    mock替换跳转.mockClear();
    mock跳转.mockClear();
    mock更新岗位.mockClear();
    mock发布岗位.mockClear();
    mock删除岗位.mockClear();
    清空轻提示();
    // 默认 Mock 桩：原有编辑保存测试不依赖 数据源模式/目录查询
    置Mock应用状态();
  });

  it('Backend 编辑保存成功前不导航', async () => {
    const 完成 = deferred<void>();
    mock更新岗位.mockReturnValue(完成.promise);
    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes>
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(mock返回).not.toHaveBeenCalled();
    完成.resolve();
    await waitFor(() => expect(mock返回).toHaveBeenCalled());
  });

  // P1C Task 5：Backend 页面保存必须走这条 operation（claim 在 operation 内决定），
  // 不能绕过 操作.更新岗位 直接写数据源/派发 Mock action。
  it('Backend 编辑保存走 操作.更新岗位', async () => {
    mock更新岗位.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes>
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({ 编号: 'job_1' });
  });

  // Task 5：编辑回环必须原样带走三态四员，存量 硬性条件 字符串不被触碰。
  it('editing round-trips required/not-required/unknown without touching legacy strings', async () => {
    mock更新岗位.mockResolvedValue(undefined);
    mock应用状态.状态.岗位列表 = [{ ...页面岗位样本,
      硬性条件: ['本科及以上'],
      硬性事实: { 大小周: '必须', 纯外包乙方: '不要求', 全现场办公: '未说明', 频繁出差: '必须' },
    }];
    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: '职位要求' }));
    // 四问钮 2026-08-26 随录入 UI 删除;存量手动条仍展示,三态值不经 UI 原样回环
    expect(screen.getByText('硬性条件')).toBeTruthy();
    expect(screen.getByText('本科及以上')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0].硬性事实).toEqual({
      大小周: '必须', 纯外包乙方: '不要求', 全现场办公: '未说明', 频繁出差: '必须',
    });
    // 存量合同字符串不改写：三态块是独立新增字段，legacy 数组原样随对象提交
    expect(mock更新岗位.mock.calls[0][0].硬性条件).toContain('本科及以上');
  });

  // Task 5：保存失败（如 409）后留在本屏 toast 报错，四个本地选择一格都不动，
  // 用户改完再点「保存」时仍是自己刚才选的档 —— 操作层重读服务端快照，不回滚表单。
  it('failed save keeps the four local selections unchanged for the next explicit save', async () => {
    const 用户 = userEvent.setup();
    mock更新岗位.mockRejectedValue(new BFF错误(409, 'version_conflict', '版本冲突'));
    mock应用状态.状态.岗位列表 = [{ ...页面岗位样本,
      硬性条件: [],
      硬性事实: { 大小周: '未说明', 纯外包乙方: '未说明', 全现场办公: '未说明', 频繁出差: '未说明' },
    }];
    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: '职位要求' }));
    // 四问钮 2026-08-26 已删,本例只验「保存失败 toast 报错且不导航」
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    // 失败只弹现有轻提示（409 → 「数据已在其他地方更新」），不导航
    expect(await screen.findByText('数据已在其他地方更新，请重试')).toBeTruthy();
    expect(mock返回).not.toHaveBeenCalled();
  });

  // ── 岗位办公方式 round-trip（backend 数据真相源 Task C）──
  // remote owner job 经 从BFF岗位 回显「全远程」：编辑态快捷片精确选中（aria-pressed），
  // 用户什么都不改直接保存，提交对象仍带 办公方式:'全远程'（补丁映射层发回 wire 'remote'）。
  it('remote owner job 编辑时选中全远程，无修改保存仍提交全远程', async () => {
    const 用户 = userEvent.setup();
    mock更新岗位.mockResolvedValue(undefined);
    const 查询Taxonomy = vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' }));
    const 查询Location = vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' }));
    置Backend应用状态(查询Taxonomy, 查询Location);
    // Backend 编辑守卫口径：编辑目标按存量岗位带 类别引用/地点引用（同「照常保存」用例）
    mock应用状态.状态.岗位列表 = [{
      ...页面岗位样本,
      办公方式: '全远程',
      类别引用: { id: 'tax_product', display_name: '产品经理' },
      地点引用: { id: 'loc_shanghai', display_name: '上海' },
    }];

    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );

    const remote = screen.getByRole('button', { name: '全远程' });
    expect(remote.getAttribute('aria-pressed')).toBe('true');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({
      编号: 'job_1',
      办公方式: '全远程',
    });
  });

  // onsite/hybrid 镜像用例：选中与保存不因 remote 修复回归。
  it.each(['现场', '混合'] as const)('%s owner job 编辑选中与保存不回归', async (方式) => {
    const 用户 = userEvent.setup();
    mock更新岗位.mockResolvedValue(undefined);
    const 查询Taxonomy = vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' }));
    const 查询Location = vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' }));
    置Backend应用状态(查询Taxonomy, 查询Location);
    mock应用状态.状态.岗位列表 = [{
      ...页面岗位样本,
      办公方式: 方式,
      类别引用: { id: 'tax_product', display_name: '产品经理' },
      地点引用: { id: 'loc_shanghai', display_name: '上海' },
    }];

    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 方式 }).getAttribute('aria-pressed')).toBe('true');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({
      编号: 'job_1',
      办公方式: 方式,
    });
  });
});

describe('发布岗位页 Backend 选择器', () => {
  const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
    if (!query.parentId && !query.q) {
      return {
        items: [
          { id: 'cat_tech', display_name: '互联网/AI', parent_id: null, selectable: false },
        ],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    }
    if (query.parentId === 'cat_tech') {
      return {
        items: [
          { id: 'job_be', display_name: '后端开发', parent_id: 'cat_tech', selectable: true },
        ],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    }
    return { items: [], nextCursor: null, catalogVersion: 'v2' };
  });

  const 查询Location = vi.fn(async () => ({
    items: [
      {
        id: 'loc_shanghai',
        display_name: '上海',
        country_code: 'CN',
        country_name: '中国',
        admin1_code: 'SH',
        admin1_name: '上海',
        timezone: 'Asia/Shanghai',
        population: 24000000,
      },
    ],
    nextCursor: null,
    catalogVersion: 'v2',
  }));

  beforeEach(() => {
    mock返回.mockClear();
    mock进企业主壳.mockClear();
    mock替换跳转.mockClear();
    mock跳转.mockClear();
    mock更新岗位.mockClear();
    mock发布岗位.mockClear();
    mock删除岗位.mockClear();
    清空轻提示();
    查询Taxonomy.mockClear();
    查询Location.mockClear();
    mock发布岗位.mockResolvedValue(undefined);
    置Backend应用状态(查询Taxonomy, 查询Location);
  });

  /** 把三步向导填到「只差点发布」的状态，返回候选城市按钮（已出现但未点）。
   *  选城市=false 时只输入不选；选城市=true 时点候选，落 地点引用。
   *  P0 修复 Task 4：第三步恢复了独立的「职位要求」输入 —— 默认填一句与描述不同的话；
   *  职位要求=null 时故意留空，用来验前置校验。 */
  async function 填到发布前(
    选城市: boolean,
    选项: { 职位描述?: string | null; 职位要求?: string | null; 勾选确认?: boolean } = {},
  ) {
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );

    // ── 第一步：基础信息 ──
    await 用户.type(
      screen.getByPlaceholderText('必填，如：资深后端工程师 · 交易网关'),
      '资深后端',
    );
    // 招聘类型默认 社招全职，办公方式待选
    await 用户.click(screen.getByRole('button', { name: '现场' }));
    // 职位类别：打开 Backend 两级选择层 → 选根 → 选 selectable 叶子（原子写 职位类别+类别引用）
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    await 用户.click(await screen.findByRole('button', { name: '互联网/AI' }));
    await waitFor(() =>
      expect(查询Taxonomy).toHaveBeenCalledWith('job-categories', expect.objectContaining({ parentId: 'cat_tech' })),
    );
    await 用户.click(await screen.findByRole('button', { name: '后端开发' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));

    // ── 第二步：职位描述 ── 职位描述=null 时故意留空，用来验校验失败的跨步回跳
    const 职位描述文本 = 选项.职位描述 === undefined ? '负责交易网关与撮合核心' : 选项.职位描述;
    if (职位描述文本 !== null) {
      await 用户.type(screen.getByLabelText('职位描述'), 职位描述文本);
    }
    await 用户.click(screen.getByRole('button', { name: '下一步' }));

    // ── 第三步：职位要求 ──
    await 用户.type(screen.getByLabelText('薪资下限'), '50');
    await 用户.type(screen.getByLabelText('薪资上限'), '65');
    // 年薪月数（社招全职必填）：打开滚轮 → 完成（默认 12）
    await 用户.click(screen.getByRole('button', { name: /年薪月数/ }));
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    // 办公地点
    await 用户.type(
      screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层'),
      '张江路 1 号',
    );
    // 职位要求：与职位描述各自独立的一段文本
    const 职位要求文本 = 选项.职位要求 === undefined ? '有分布式系统与撮合引擎经验' : 选项.职位要求;
    if (职位要求文本 !== null) {
      await 用户.type(screen.getByRole('textbox', { name: '给候选人看的职位要求（补充文字，不自动解析为硬门槛）' }), 职位要求文本);
    }
    // 工作城市：输入触发 250ms debounce 候选查询
    await 用户.type(
      screen.getByPlaceholderText('搜索城市名，从下方候选选择'),
      '上海',
    );
    const 候选键 = await screen.findByRole('button', { name: '上海' }, { timeout: 2000 });
    if (选城市) {
      await 用户.click(候选键);
    }
    // P4 互认 Task 3：Backend 发岗必须显式确认结构化要求。默认勾上，
    // 让既有用例继续走「表单填完即可发布」的主路径；确认语义本身的用例传 勾选确认:false 自己控制
    if (选项.勾选确认 !== false) {
      await 用户.click(screen.getByRole('checkbox', { name: 结构化确认文案 }));
    }
    return { 用户 };
  }

  /** P4 互认 Task 3：打开 Backend 编辑态并切到第三步（勾选框所在步）。
   *  编辑目标按存量岗位带 地点引用（城市守卫要求），覆盖项由用例注入。 */
  async function 打开编辑第三步(岗位覆盖: Record<string, unknown> = {}) {
    const 用户 = userEvent.setup();
    mock应用状态.状态.岗位列表 = [
      {
        ...页面岗位样本,
        类别引用: { id: 'tax_product', display_name: '产品经理' },
        地点引用: { id: 'loc_shanghai', display_name: '上海' },
        ...岗位覆盖,
      },
    ];
    const 视图 = render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: '职位要求' }));
    return { 用户, unmount: 视图.unmount };
  }

  it('选类别候选 + 选城市候选 → 发布带 类别引用/地点引用', async () => {
    const { 用户 } = await 填到发布前(true);
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));

    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    const 传入 = mock发布岗位.mock.calls[0][0];
    expect(传入.类别引用).toEqual({ id: 'job_be', display_name: '后端开发' });
    expect(传入.地点引用).toEqual({ id: 'loc_shanghai', display_name: '上海' });
  });

  it('手输城市不选候选 → 发布被拦（操作.发布岗位 不调用）', async () => {
    const { 用户 } = await 填到发布前(false);
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));

    expect(mock发布岗位).not.toHaveBeenCalled();
    expect(await screen.findByText('请从候选城市中选择')).toBeTruthy();
  });

  // ── P0 修复 Task 4：JobCreate 的三条独立必填文本 ──

  it('第三步显示独立的职位要求 textarea', async () => {
    const { 用户 } = await 填到发布前(true, { 职位要求: null });
    const 要求框 = screen.getByRole('textbox', { name: '给候选人看的职位要求（补充文字，不自动解析为硬门槛）' }) as HTMLTextAreaElement;
    expect(要求框.disabled).toBe(false);
    expect(要求框.readOnly).toBe(false);
    // 第二步填过的职位描述没有渗进来：这是一个独立的空输入
    expect(要求框.value).toBe('');
    await 用户.type(要求框, '要求正文');
    expect((screen.getByRole('textbox', { name: '给候选人看的职位要求（补充文字，不自动解析为硬门槛）' }) as HTMLTextAreaElement).value)
      .toBe('要求正文');
  });

  it('职位要求为空时回到第三步、显示可行动文案且零 mutation', async () => {
    const { 用户 } = await 填到发布前(true, { 职位要求: null });
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    expect(await screen.findByText('请填写职位要求')).toBeTruthy();
    expect(mock发布岗位).not.toHaveBeenCalled();
    // 留在第三步：要求输入框仍在屏上，用户看得见该改哪儿
    expect(screen.getByRole('textbox', { name: '给候选人看的职位要求（补充文字，不自动解析为硬门槛）' })).toBeTruthy();
  });

  // 校验失败必须把用户带回出问题的那一步 —— 只弹 toast 不切步，用户当前屏上根本
  // 看不见那个控件。职位描述是唯一会跨步回跳（第三步 → 第一步）的那条。
  it('职位描述为空时从第三步跳回第二步的描述输入并零 mutation', async () => {
    const { 用户 } = await 填到发布前(true, { 职位描述: null });
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    expect(await screen.findByText('请填写职位描述')).toBeTruthy();
    expect(mock发布岗位).not.toHaveBeenCalled();
    // 真的换了步：描述输入回到屏上，第三步的职位要求输入与提交键都不在了
    expect(screen.getByRole('textbox', { name: '职位描述' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: '给候选人看的职位要求（补充文字，不自动解析为硬门槛）' })).toBeNull();
    expect(screen.queryByRole('button', { name: '发布岗位并开始寻访' })).toBeNull();
  });

  it('无 verified affiliation 且公司声明为空时零 mutation', async () => {
    置Backend应用状态(查询Taxonomy, 查询Location, {
      企业关系列表: [], 当前企业关系编号: null, 未认证公司声明: '   ',
    });
    const { 用户 } = await 填到发布前(true);
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    // review-final 修复 3：本页没有公司名输入框（它在招聘名片屏）——
    // 文案必须指路，否则用户被弹回第二步去找一个这里根本不存在的字段。
    expect(await screen.findByText('请先在招聘名片填写公司名称')).toBeTruthy();
    expect(mock发布岗位).not.toHaveBeenCalled();
  });

  // review-r1 回归：公司声明前置校验只管「新建」。编辑走 JobPatch —— claim 由服务端
  // 沿用岗位原值，请求里根本不带客户端 claim；本页也没有公司名输入框，所以换设备
  // （未认证公司声明 是设备本地态）或关系被撤销时挡在这里，那条 toast 无从消解。
  // 与上一条创建用例互为对照：创建仍被挡，编辑必须放行。
  it('编辑态无 verified affiliation 且公司声明为空时照常保存', async () => {
    const 用户 = userEvent.setup();
    mock更新岗位.mockResolvedValue(undefined);
    置Backend应用状态(查询Taxonomy, 查询Location, {
      企业关系列表: [], 当前企业关系编号: null, 未认证公司声明: '   ',
    });
    // Backend 编辑态的城市守卫（地点引用）不在本次修复范围内：编辑目标按存量岗位带引用；
    // 类别引用同口径补齐（Task 4 起 Backend 第一步要求真实 类别引用）
    mock应用状态.状态.岗位列表 = [
      {
        ...页面岗位样本,
        类别引用: { id: 'job_be', display_name: '产品经理' },
        地点引用: { id: 'loc_shanghai', display_name: '上海' },
      },
    ];
    render(
      <MemoryRouter initialEntries={['/hr/post-job/job_1']}>
        <Routes><Route path="/hr/post-job/:id" element={<发布岗位 />} /></Routes>
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({ 编号: 'job_1' });
    expect(screen.queryByText('请先在招聘名片填写公司名称')).toBeNull();
  });

  it('完整表单把独立 description 和 requirements 交给 operation', async () => {
    const { 用户 } = await 填到发布前(true, { 职位要求: '  应届或毕业年级；关注 AI 与开发工具  ' });
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    expect(mock发布岗位.mock.calls[0][0]).toMatchObject({
      职位描述: '负责交易网关与撮合核心',
      职位要求: '应届或毕业年级；关注 AI 与开发工具',
    });
  });

  // Task 4（frontend truthfulness）：结构化档位（自动匹配读取）与补充文字（不自动解析）
  // 的文案边界 —— 只改可见/可访问文案，不改 payload：用户选的结构化值原样、手打补充文字原样。
  it('结构化经验学历与补充文字使用精确说明且不改 payload', async () => {
    const { 用户 } = await 填到发布前(true);
    expect(screen.getByText('经验要求（自动匹配读取）')).toBeTruthy();
    expect(screen.getByText('最低学历（自动匹配读取）')).toBeTruthy();
    const 要求框 = screen.getByRole('textbox', {
      name: '给候选人看的职位要求（补充文字，不自动解析为硬门槛）',
    });
    await 用户.clear(要求框);
    await 用户.type(要求框, '至少 3 年经验，本科优先');
    // P4 互认 Task 3：改结构化的要求文本会撤掉默认勾选；本例只验 payload 文案边界，重新勾上再发
    await 用户.click(screen.getByRole('checkbox', { name: 结构化确认文案 }));
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    expect(mock发布岗位.mock.calls[0][0]).toMatchObject({
      职位要求: '至少 3 年经验，本科优先',
      经验要求: '不限',
      最低学历: '不限',
    });
  });

  // Task 5：新岗四问全部从未说明起步；没点过的三问也必须以 未说明 随完整对象提交，
  // 绝不允许缺员 —— 服务端 hard_requirements 四员必返/必收。
  it('new job starts with four unknown facts and submits the complete object', async () => {
    const { 用户 } = await 填到发布前(true);
    // 四问钮 2026-08-26 已删:服务端合同不变——新岗仍以完整四员(全「未说明」)随对象提交
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    expect(mock发布岗位).toHaveBeenCalledWith(expect.objectContaining({
      硬性事实: { 大小周: '未说明', 纯外包乙方: '未说明', 全现场办公: '未说明', 频繁出差: '未说明' },
    }));
  });
  // ── P4 互认 Task 3：结构化要求确认（仅 Backend）──

  const 勾选框 = () => screen.getByRole('checkbox', { name: 结构化确认文案 }) as HTMLInputElement;

  it('未勾选确认时发岗被拦：留在第三步、显示文案且零 mutation', async () => {
    const { 用户 } = await 填到发布前(true, { 勾选确认: false });
    expect(勾选框().checked).toBe(false);
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    expect(await screen.findByText('请确认经验和学历将作为自动匹配依据')).toBeTruthy();
    expect(mock发布岗位).not.toHaveBeenCalled();
    expect(mock更新岗位).not.toHaveBeenCalled();
    // 留在第三步：确认勾选框仍在屏上，用户看得见该勾哪儿
    expect(勾选框()).toBeTruthy();
  });

  it('经验学历保持不限时勾选确认即可发岗并带 结构化要求已确认: true', async () => {
    const { 用户 } = await 填到发布前(true, { 勾选确认: false });
    await 用户.click(勾选框());
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    expect(mock发布岗位.mock.calls[0][0]).toMatchObject({
      结构化要求已确认: true,
      经验要求: '不限',
      最低学历: '不限',
    });
  });

  it('Backend 编辑按存量 Owner Job 水合勾选态：已确认勾上、legacy-false 不勾', async () => {
    const 已确认 = await 打开编辑第三步({ 结构化要求已确认: true });
    expect(勾选框().checked).toBe(true);
    已确认.unmount();

    await 打开编辑第三步({ 结构化要求已确认: false });
    expect(勾选框().checked).toBe(false);
  });

  it('legacy-false 编辑勾选后不改动三处文本也能保存：update 带 结构化要求已确认: true', async () => {
    mock更新岗位.mockResolvedValue(undefined);
    const { 用户 } = await 打开编辑第三步({ 结构化要求已确认: false });
    await 用户.click(勾选框());
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({
      编号: 'job_1',
      结构化要求已确认: true,
      经验要求: '不限',
      最低学历: '本科',
      职位要求: '在校生',
    });
  });

  it('勾选后改经验、学历或职位要求任一项立即取消勾选', async () => {
    const { 用户 } = await 填到发布前(true, { 勾选确认: false });
    const 要求框 = screen.getByRole('textbox', {
      name: '给候选人看的职位要求（补充文字，不自动解析为硬门槛）',
    });

    await 用户.click(勾选框());
    await 用户.click(screen.getByRole('button', { name: '1-3 年' }));
    expect(勾选框().checked).toBe(false);

    await 用户.click(勾选框());
    await 用户.click(screen.getByRole('button', { name: '本科' }));
    expect(勾选框().checked).toBe(false);

    await 用户.click(勾选框());
    await 用户.type(要求框, '。');
    expect(勾选框().checked).toBe(false);
  });

  it('改薪资、办公地点、筛选偏好、年薪月数或描述不取消勾选', async () => {
    const { 用户 } = await 填到发布前(true, { 勾选确认: false });
    await 用户.click(勾选框());

    await 用户.clear(screen.getByLabelText('薪资下限'));
    await 用户.type(screen.getByLabelText('薪资下限'), '52');
    await 用户.type(
      screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层'),
      '（改）',
    );
    await 用户.type(
      screen.getByPlaceholderText('例如：985/211 或指定院校优先、有大厂或创业公司经历、重点看系统设计能力'),
      '重点看系统设计',
    );
    // 年薪月数滚轮也是无关控件
    await 用户.click(screen.getByRole('button', { name: /年薪月数/ }));
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    expect(勾选框().checked).toBe(true);

    // 描述在第二步：返回 → 改描述 → 下一步回第三步，确认态不能被跨步编辑冲掉
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    await 用户.type(screen.getByRole('textbox', { name: '职位描述' }), '（改）');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(勾选框().checked).toBe(true);
  });

  it('legacy-false 编辑只改无关字段时不勾选也能保存', async () => {
    mock更新岗位.mockResolvedValue(undefined);
    const { 用户 } = await 打开编辑第三步({ 结构化要求已确认: false });
    expect(勾选框().checked).toBe(false);
    await 用户.type(
      screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层'),
      '（改）',
    );
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
    expect(mock更新岗位.mock.calls[0][0]).toMatchObject({
      编号: 'job_1',
      结构化要求已确认: false,
    });
  });
});

// ── P0 修复 Task 4：Mock 发岗语义冻结 —— 公司声明前置校验只在 Backend 生效 ──
describe('发布岗位页 Mock 发岗（公司声明前置校验不生效）', () => {
  beforeEach(() => {
    mock返回.mockClear();
    mock进企业主壳.mockClear();
    mock替换跳转.mockClear();
    mock跳转.mockClear();
    mock更新岗位.mockClear();
    mock发布岗位.mockClear();
    mock删除岗位.mockClear();
    清空轻提示();
    mock发布岗位.mockResolvedValue(undefined);
  });

  it('Mock 发岗不读取 Backend 专属未认证公司声明', async () => {
    // Backend 专属的 未认证公司声明 为空，Mock 仍按 企业认证.公司 走原有发布流程
    置Mock应用状态({ 未认证公司声明: '', 企业认证: { 姓名: '林澈', 公司: 'Mock 公司' } });
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );

    // 第一步：基础信息（Mock 走本地职业分类表）
    await 用户.type(
      screen.getByPlaceholderText('必填，如：资深后端工程师 · 交易网关'),
      'AI 产品实习生',
    );
    await 用户.click(screen.getByRole('button', { name: '现场' }));
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    await 用户.click(screen.getByRole('button', { name: '产品' }));
    await 用户.click(screen.getByRole('button', { name: '产品经理' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));

    // 第二步：职位描述
    await 用户.type(screen.getByRole('textbox', { name: '职位描述' }), '描述正文');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));

    // 第三步：职位要求 + 薪资 + 城市 + 办公地
    await 用户.type(screen.getByRole('textbox', { name: '给候选人看的职位要求（补充文字，不自动解析为硬门槛）' }), '要求正文');
    await 用户.type(screen.getByLabelText('薪资下限'), '20');
    await 用户.type(screen.getByLabelText('薪资上限'), '30');
    await 用户.click(screen.getByRole('button', { name: /年薪月数/ }));
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    await 用户.type(screen.getByPlaceholderText('如：上海'), '上海');
    await 用户.type(
      screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层'),
      '张江路 1 号',
    );
    // P4 互认 Task 3：确认勾选框仅 Backend 渲染，Mock 发岗语义冻结、无需确认
    expect(screen.queryByRole('checkbox', { name: 结构化确认文案 })).toBeNull();
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));

    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('请先在招聘名片填写公司名称')).toBeNull();
    expect(mock发布岗位.mock.calls[0][0]).toMatchObject({
      职位描述: '描述正文', 职位要求: '要求正文',
    });
  });
});

// ── review-r3 R3-I-5：职业分类层后端 分页 + R3-I-6 导航代际守 stale ──
describe('发布岗位页 Backend 职业分类层分页与代际（review-r3）', () => {
  beforeEach(() => {
    mock返回.mockClear();
    mock进企业主壳.mockClear();
    mock替换跳转.mockClear();
    mock跳转.mockClear();
    mock更新岗位.mockClear();
    mock发布岗位.mockClear();
    mock删除岗位.mockClear();
    清空轻提示();
    mock发布岗位.mockResolvedValue(undefined);
  });

  it('根分页加载更多追加第二页（R3-I-5）', async () => {
    let 根调用 = 0;
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        根调用 += 1;
        if (根调用 === 1) {
          return {
            items: [{ id: 'cat_a', display_name: '大类A', parent_id: null, selectable: false }],
            nextCursor: 'root_cur_1',
            catalogVersion: 'v2',
          };
        }
        return {
          items: [{ id: 'cat_b', display_name: '大类B', parent_id: null, selectable: false }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_a') {
        return {
          items: [{ id: 'job_a1', display_name: 'A岗位1', parent_id: 'cat_a', selectable: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    置Backend应用状态(查询Taxonomy, vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })));
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
    // 打开职位类别弹层
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    // 等 roots 加载
    await screen.findByText('大类A');
    // 点「加载更多」→ 追加第二页
    const 加载更多 = await screen.findByRole('button', { name: '加载更多' });
    await 用户.click(加载更多);
    await screen.findByText('大类B');
    expect(screen.getByText('大类A')).toBeTruthy();
  });

  it('快速切大类时旧响应不覆盖新子项（R3-I-6）', async () => {
    const { promise: 慢Promise, resolve: 慢Resolve } = deferred<{ items: unknown[]; nextCursor: string | null; catalogVersion: string }>();
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        return {
          items: [
            { id: 'cat_a', display_name: '大类A', parent_id: null, selectable: false },
            { id: 'cat_b', display_name: '大类B', parent_id: null, selectable: false },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'cat_a') {
        return 慢Promise;
      }
      if (query.parentId === 'cat_b') {
        return {
          items: [{ id: 'job_b1', display_name: 'B岗位1', parent_id: 'cat_b', selectable: true }],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    置Backend应用状态(查询Taxonomy, vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })));
    const 用户 = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/hr/post-job']}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
    // 打开职位类别弹层
    await 用户.click(screen.getByRole('button', { name: /职位类别/ }));
    // 等 roots 加载（mount 预选大类A并触发其子项请求，但 A 的响应是慢的）
    await screen.findByText('大类A');
    // 快速切到大类B
    await 用户.click(screen.getByText('大类B'));
    // B 的子项立刻出现
    await screen.findByText('B岗位1');
    // A 的慢响应到达——不应覆盖 B 的子项
    慢Resolve({
      items: [{ id: 'job_a1', display_name: 'A岗位1（过期）', parent_id: 'cat_a', selectable: true }],
      nextCursor: null,
      catalogVersion: 'v2',
    });
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    expect(screen.getByText('B岗位1')).toBeTruthy();
    expect(screen.queryByText('A岗位1（过期）')).toBeNull();
  });
});

// ── P0 修复 Task 6：岗位表单的服务端校验投影 ────────────────────────
// 只有「已知字段路径 × 已知空值类 reason」才本地化；未知路径或未知 reason
// 一律落通用岗位文案，绝不把机器 reason 原样上屏。点分与 JSON Pointer 两种
// 路径写法都要归一。
describe('取岗位提交错误文案', () => {
  it.each([
    ['hiring_organization_claim.display_name', 'must_not_be_blank', '请填写公司名称'],
    ['/office_location', 'required', '请填写办公地点'],
    ['description', 'blank', '请填写职位描述'],
    ['/requirements', 'must_not_be_blank', '请填写职位要求'],
  ] as const)('把字段错误 %s 本地化', (path, reason, expected) => {
    expect(取岗位提交错误文案(
      new BFF错误(422, 'validation_failed', 'bad', [{ path, reason }]),
    )).toBe(expected);
  });

  it.each([
    [new BFF错误(422, 'validation_failed', 'bad', [{ path: 'unknown', reason: 'required' }])],
    [new BFF错误(422, 'validation_failed', 'bad', [{ path: 'requirements', reason: 'unsupported_code' }])],
  ])('未知字段或 reason 使用通用岗位文案', (error) => {
    expect(取岗位提交错误文案(error)).toBe('请检查岗位信息');
  });
});

// ── JD PDF 建议稿导入：consent、串行轮询、状态横幅与重试（Task 3）──
// 假时钟驱动 3 秒节拍与 visibilitychange；所有迟到结果必须过页面 generation/import ID
// 栅栏。错误文案闭合：Spec §9.2 全表 + 非 BFF错误 + 未知 code，原始 message/request ID/
// provider/模型输出绝不上屏。
describe('发布岗位页 JD 导入生命周期', () => {
  const JD合法ID = 'jdi_0123456789abcdef0123456789abcdef';
  const JD新ID = 'jdi_fedcba9876543210fedcba9876543210';
  const 不可用文案 = 'JD 服务暂时不可用，请稍后重试或手动填写';

  const JD建议全量 = {
    title: 'Senior Backend Engineer',
    recruitment_type: 'social_full_time',
    workplace_mode: 'hybrid',
    office_location: '上海市浦东新区世纪大道 1568 号',
    description: '负责核心招聘服务。',
    requirements: '五年以上后端经验。',
    education_requirement: 'bachelor',
    experience_requirement: 'five_plus_years',
    category_source_name: '后端开发',
    location_source_name: '上海',
    keywords: ['Go', 'PostgreSQL'],
  } as const;

  const JDpending: BFFJD导入 = { import_id: JD合法ID, status: 'pending', created_at: '2026-09-03T01:02:03Z', updated_at: '2026-09-03T01:02:03Z' };
  const JDprocessing: BFFJD导入 = { ...JDpending, status: 'processing' };
  const JDsucceeded: BFFJD导入 = {
    import_id: JD合法ID, status: 'succeeded',
    created_at: '2026-09-03T01:02:03Z', updated_at: '2026-09-03T01:02:06Z',
    suggestion: { ...JD建议全量, keywords: [...JD建议全量.keywords] },
  };
  const JD失败 = (failure_code: BFFJD导入失败码): BFFJD导入 => ({
    import_id: JD合法ID, status: 'failed',
    created_at: '2026-09-03T01:02:03Z', updated_at: '2026-09-03T01:02:05Z', failure_code,
  });
  const JDpending新轮: BFFJD导入 = { ...JDpending, import_id: JD新ID };

  const JDPDF = () => new File(['%PDF-1.7'], 'role.pdf', { type: 'application/pdf' });
  const 第二份PDF = () => new File(['%PDF-1.7'], 'another.pdf', { type: 'application/pdf' });

  /** 横幅文字/动作都取自 JD 上传区内现有 代理横幅 的 DOM（class 名含中文 local 名），不改组件；
   *  必须限定范围 —— 页面外壳还有第二处代理横幅（默认动作「问AI代理 ›」）。 */
  const JD横幅节点 = () => document.querySelector('[class*="上传JD区"] [class*="代理横幅"]');
  const 横幅文字 = () => JD横幅节点()?.querySelector('[class*="横幅文字"]')?.textContent ?? '';
  const 动作文字 = () => JD横幅节点()?.querySelector('[class*="横幅动作"]')?.textContent ?? '';

  function 轻提示文案们(): string[] {
    for (const 节点 of Array.from(document.body.children)) {
      const 元素 = 节点 as HTMLElement;
      if (元素.style.position === 'fixed' && 元素.style.zIndex === '999') {
        return Array.from(元素.children).map((条) => 条.textContent ?? '');
      }
    }
    return [];
  }

  /** 推进假时钟（触发内部状态更新的都裹 act）。 */
  async function 走(毫秒: number): Promise<void> {
    await act(async () => { await vi.advanceTimersByTimeAsync(毫秒); });
  }

  /** 结算已 resolve/reject 的 deferred 链（微任务空转）。 */
  async function 微任务结算(): Promise<void> {
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  }

  function 设可见(可见: boolean): void {
    Object.defineProperty(document, 'hidden', { value: !可见, configurable: true });
  }

  function render发布岗位(路由 = '/hr/post-job') {
    return render(
      <MemoryRouter initialEntries={[路由]}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  /** 假时钟下不用 userEvent.upload（其内部 wait 会挂起）：直接派发带 files 的 change。 */
  function 选择JD(文件: File) {
    fireEvent.change(screen.getByLabelText('上传 JD 文件'), { target: { files: [文件] } });
  }

  function 确认JD() {
    fireEvent.click(screen.getByRole('button', { name: '同意并继续' }));
  }

  function 选择并确认JD(文件: File) {
    选择JD(文件);
    确认JD();
  }

  /** 同步双击：先吃 busy guard、再吃确认层卸载，两条路都只许一次 POST。 */
  function dblClick(元素: Element) {
    fireEvent.click(元素);
    fireEvent.click(元素);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    mock创建JD导入.mockReset();
    mock读取JD导入.mockReset();
    置Backend应用状态(
      vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
      vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'hidden');
  });

  it('候选人角色打开发岗页：合法 PDF 只提示可手填，零确认零请求', async () => {
    mock应用状态.后端状态.主体.last_used_role = 'candidate';
    render发布岗位();
    选择JD(JDPDF());
    expect(轻提示文案们()).toContain('已选择，可继续手动填写');
    expect(screen.queryByText('允许 AI 识别这份职位描述？')).toBeNull();
    expect(mock创建JD导入).not.toHaveBeenCalled();
  });

  it('操作层栅栏换代（已换代）时当前轮收口回 idle，不卡 uploading', async () => {
    mock创建JD导入.mockResolvedValue('已换代');
    render发布岗位();
    选择并确认JD(JDPDF());
    await 微任务结算();
    expect(横幅文字()).toBe('把 JD 给我，这张表我来填');
    expect(动作文字()).toBe('上传 JD ›');
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('合法 PDF 先确认，consent 前零 POST，取消仍零 POST', async () => {
    render发布岗位();
    选择JD(JDPDF());
    expect(mock创建JD导入).not.toHaveBeenCalled();
    expect(screen.getByText('允许 AI 识别这份职位描述？')).toBeTruthy();
    expect(screen.getByText('这份 PDF 将发送给受控模型服务进行职位信息识别。确认后才会上传并开始处理。')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(mock创建JD导入).not.toHaveBeenCalled();
    expect(screen.queryByText('允许 AI 识别这份职位描述？')).toBeNull();
    expect(横幅文字()).toBe('把 JD 给我，这张表我来填');
  });

  it('确认后 POST；pending 串行轮询，hidden 暂停，visible 立即恢复', async () => {
    const POST门 = deferred<BFFJD导入>();
    const GET1门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValueOnce(POST门.promise);
    mock读取JD导入.mockReturnValueOnce(GET1门.promise).mockResolvedValueOnce(JDsucceeded);
    render发布岗位();
    选择并确认JD(JDPDF());
    // POST 已起飞且在飞：恰一次 POST，页面容器带 aria-busy
    expect(mock创建JD导入).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    POST门.resolve(JDpending);
    await 微任务结算();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    expect(横幅文字()).toBe('正在识别 JD');
    // 3 秒节拍：2999ms 零 GET，再 1ms 恰一次 GET（用返回的 import ID）
    await 走(2999);
    expect(mock读取JD导入).not.toHaveBeenCalled();
    await 走(1);
    expect(mock读取JD导入).toHaveBeenCalledTimes(1);
    expect(mock读取JD导入).toHaveBeenLastCalledWith(JD合法ID);
    // 第一个 GET 未决期间再走 9 秒仍只有一次 GET（串行，setTimeout 链不重叠）
    await 走(9000);
    expect(mock读取JD导入).toHaveBeenCalledTimes(1);
    // 页面隐藏：清定时器；GET 结算后也不排新拍
    设可见(false);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    GET1门.resolve(JDprocessing);
    await 微任务结算();
    await 走(9000);
    expect(mock读取JD导入).toHaveBeenCalledTimes(1);
    // 恢复可见：立即读取一次
    设可见(true);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await 微任务结算();
    expect(mock读取JD导入).toHaveBeenCalledTimes(2);
    expect(横幅文字()).toBe('已识别，请检查建议');
    expect(动作文字()).toBe('重新上传 ›');
  });

  it('input 收紧为 PDF 且选后立即清空 value，同一文件可再次选择', async () => {
    render发布岗位();
    const input = screen.getByLabelText('上传 JD 文件') as HTMLInputElement;
    expect(input.accept).toBe('.pdf,application/pdf');
    选择JD(JDPDF());
    expect(input.value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    选择JD(JDPDF());
    expect(screen.getByText('允许 AI 识别这份职位描述？')).toBeTruthy();
  });

  it.each([
    ['扩展名不合法', () => new File(['x'], 'role.docx', { type: 'application/msword' })],
    ['MIME 不合法', () => new File(['x'], 'role.pdf', { type: 'text/plain' })],
  ])('%s 只弹「请选择 PDF 文件」，不开确认层且不打扰在途导入', async (_名, 造文件) => {
    mock创建JD导入.mockResolvedValue(JDpending);
    mock读取JD导入.mockResolvedValue(JDpending);
    render发布岗位();
    选择并确认JD(JDPDF());
    await 走(3000);
    expect(mock读取JD导入).toHaveBeenCalledTimes(1);
    选择JD(造文件());
    expect(轻提示文案们()).toContain('请选择 PDF 文件');
    expect(screen.queryByText('允许 AI 识别这份职位描述？')).toBeNull();
    // 旧轮不受影响：轮询照旧按同一 import ID 排队
    await 走(3000);
    expect(mock读取JD导入).toHaveBeenCalledTimes(2);
    expect(mock读取JD导入).toHaveBeenLastCalledWith(JD合法ID);
    expect(横幅文字()).toBe('正在识别 JD');
  });

  it('Mock 模式合法 PDF 只提示「已选择，可继续手动填写」，零确认零请求', async () => {
    置Mock应用状态();
    render发布岗位();
    选择JD(JDPDF());
    expect(轻提示文案们()).toContain('已选择，可继续手动填写');
    expect(screen.queryByText('允许 AI 识别这份职位描述？')).toBeNull();
    expect(横幅文字()).toBe('把 JD 给我，这张表我来填');
  });

  it('POST 未决时双击「同意并继续」只发一次 POST', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    选择JD(JDPDF());
    dblClick(screen.getByRole('button', { name: '同意并继续' }));
    expect(mock创建JD导入).toHaveBeenCalledTimes(1);
    POST门.resolve(JDpending);
    await 微任务结算();
  });

  it.each([
    ['直接 succeeded', JDsucceeded, '已识别，请检查建议', '重新上传 ›'],
    ['直接 failed', JD失败('invalid_pdf'), '仅支持有效、未加密且不含主动内容的 PDF', '重新上传 ›'],
  ] as const)('POST %s 时不安排任何 GET 且进入终局', async (_名, 结果, 文案, 动作) => {
    mock创建JD导入.mockResolvedValue(结果);
    render发布岗位();
    选择并确认JD(JDPDF());
    await 走(10000);
    expect(mock读取JD导入).not.toHaveBeenCalled();
    expect(横幅文字()).toBe(文案);
    expect(动作文字()).toBe(动作);
  });

  it('卸载清除轮询定时器，卸载后再派发 visibilitychange 也零 GET', async () => {
    mock创建JD导入.mockResolvedValue(JDpending);
    mock读取JD导入.mockResolvedValue(JDpending);
    const { unmount } = render发布岗位();
    选择并确认JD(JDPDF());
    await 走(2999);
    unmount();
    设可见(false);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    设可见(true);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await 走(30000);
    expect(mock读取JD导入).not.toHaveBeenCalled();
  });

  it.each([
    ['旧 POST 迟到成功', true],
    ['旧 POST 迟到失败', false],
  ])('新合法 PDF 使 %s 整包失效', async (_名, 成功) => {
    const 旧POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValueOnce(旧POST门.promise);
    render发布岗位();
    选择并确认JD(JDPDF());
    expect(mock创建JD导入).toHaveBeenCalledTimes(1);
    // 选新合法 PDF：新一轮复位 idle 并开确认层
    选择JD(第二份PDF());
    expect(screen.getByText('允许 AI 识别这份职位描述？')).toBeTruthy();
    if (成功) 旧POST门.resolve(JDsucceeded);
    else 旧POST门.reject(new BFF错误(0, 'network_error', 'offline'));
    await 微任务结算();
    // 旧轮结果没有落进新轮：横幅仍是新轮 idle 文案
    expect(横幅文字()).toBe('把 JD 给我，这张表我来填');
    expect(动作文字()).toBe('上传 JD ›');
  });

  it.each([
    ['旧 GET 迟到成功', true],
    ['旧 GET 迟到失败', false],
  ])('新合法 PDF 使 %s 整包失效', async (_名, 成功) => {
    const GET门 = deferred<BFFJD导入>();
    mock创建JD导入.mockResolvedValueOnce(JDpending);
    mock读取JD导入.mockReturnValueOnce(GET门.promise);
    render发布岗位();
    选择并确认JD(JDPDF());
    await 走(3000);
    expect(mock读取JD导入).toHaveBeenCalledTimes(1);
    选择JD(第二份PDF());
    if (成功) GET门.resolve(JDsucceeded);
    else GET门.reject(new BFF错误(503, 'operation_outcome_unknown', 'down'));
    await 微任务结算();
    expect(横幅文字()).toBe('把 JD 给我，这张表我来填');
    await 走(10000);
    // 旧轮定时器已被清掉：不排新 GET
    expect(mock读取JD导入).toHaveBeenCalledTimes(1);
  });

  it('旧 import ID 的迟到结果不能改变新轮（同页多轮）', async () => {
    mock创建JD导入.mockResolvedValueOnce(JDpending).mockResolvedValueOnce(JDpending新轮);
    const GET_A门 = deferred<BFFJD导入>();
    mock读取JD导入.mockReturnValueOnce(GET_A门.promise).mockResolvedValue(JDpending新轮);
    render发布岗位();
    // 轮 1：pending(合法ID)，GET(A) 在飞
    选择并确认JD(JDPDF());
    await 走(3000);
    expect(mock读取JD导入).toHaveBeenNthCalledWith(1, JD合法ID);
    // 轮 2：新文件 → pending(新ID)；选择即作废旧轮
    选择并确认JD(第二份PDF());
    // 旧 import ID 的 GET 此时才带回 succeeded —— generation/import ID 双失配，整包丢弃
    GET_A门.resolve(JDsucceeded);
    await 微任务结算();
    expect(横幅文字()).toBe('正在识别 JD');
    expect(动作文字()).toBe('上传 JD ›');
    // 新轮照常轮询自己的任务（单飞解除后按节拍读 新ID），不被旧结果改成终局
    await 走(3000);
    expect(mock读取JD导入).toHaveBeenNthCalledWith(2, JD新ID);
    expect(横幅文字()).toBe('正在识别 JD');
  });

  it('POST 重试复用同一 File 与幂等键；GET 重试只再读同一 import ID 且不重新 POST', async () => {
    const 开文件 = vi.spyOn(HTMLInputElement.prototype, 'click');
    // POST network_error → failed + 重试 ›；重试再用同一 File/key 恰发第二次 POST
    mock创建JD导入.mockRejectedValueOnce(new BFF错误(0, 'network_error', '网络连接失败'));
    render发布岗位();
    选择并确认JD(JDPDF());
    await 微任务结算();
    expect(横幅文字()).toBe(不可用文案);
    expect(动作文字()).toBe('重试 ›');
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    fireEvent.click(screen.getByText('重试 ›'));
    expect(mock创建JD导入).toHaveBeenCalledTimes(2);
    const [文件1, 键1] = mock创建JD导入.mock.calls[0];
    const [文件2, 键2] = mock创建JD导入.mock.calls[1];
    expect(文件2).toBe(文件1);
    expect(键2).toBe(键1);
    expect(键1).toMatch(/^jd-import-/);
    // 开文件框一次都没被拉起（重试动作不重新选文件）
    expect(开文件).not.toHaveBeenCalled();
    开文件.mockRestore();
  });

  it('GET 失败的重试只调 读取JD导入 且使用同一 import ID', async () => {
    mock创建JD导入.mockResolvedValue(JDpending);
    mock读取JD导入.mockRejectedValueOnce(new BFF错误(0, 'network_error', 'offline'));
    render发布岗位();
    选择并确认JD(JDPDF());
    await 走(3000);
    await 微任务结算();
    expect(横幅文字()).toBe(不可用文案);
    expect(动作文字()).toBe('重试 ›');
    fireEvent.click(screen.getByText('重试 ›'));
    expect(mock读取JD导入).toHaveBeenCalledTimes(2);
    expect(mock读取JD导入).toHaveBeenLastCalledWith(JD合法ID);
    expect(mock创建JD导入).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['invalid_pdf', '仅支持有效、未加密且不含主动内容的 PDF'],
    ['document_too_complex', '内容过多或过于复杂，请换一份 PDF'],
    ['parser_invalid_output', '未能识别这份 JD，可重新上传或手动填写'],
    ['parser_temporarily_unavailable', '识别服务繁忙，请稍后重试或手动填写'],
  ] as const)('terminal failed（%s）显示精确文案、只提供重新上传且不再重试', async (code, 文案) => {
    mock创建JD导入.mockResolvedValue(JD失败(code));
    const 开文件 = vi.spyOn(HTMLInputElement.prototype, 'click');
    render发布岗位();
    选择并确认JD(JDPDF());
    await 微任务结算();
    expect(横幅文字()).toBe(文案);
    expect(动作文字()).toBe('重新上传 ›');
    await 走(30000);
    expect(mock读取JD导入).not.toHaveBeenCalled();
    expect(mock创建JD导入).toHaveBeenCalledTimes(1);
    // 「重新上传」拉起现有文件框
    fireEvent.click(screen.getByText('重新上传 ›'));
    expect(开文件).toHaveBeenCalledTimes(1);
    开文件.mockRestore();
  });

  it('uploading 时横幅动作 no-op；pending 时允许重新上传开始新轮', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValueOnce(POST门.promise).mockResolvedValueOnce(JDpending新轮);
    const 开文件 = vi.spyOn(HTMLInputElement.prototype, 'click');
    render发布岗位();
    选择并确认JD(JDPDF());
    expect(横幅文字()).toBe('正在上传 JD');
    // uploading 中点横幅不拉起文件框
    fireEvent.click(screen.getByText('上传 JD ›').closest('button')!);
    expect(开文件).not.toHaveBeenCalled();
    POST门.resolve(JDpending);
    await 微任务结算();
    // pending 中点横幅可重新上传
    fireEvent.click(screen.getByText('上传 JD ›').closest('button')!);
    expect(开文件).toHaveBeenCalledTimes(1);
    选择JD(第二份PDF());
    expect(screen.getByText('允许 AI 识别这份职位描述？')).toBeTruthy();
    开文件.mockRestore();
  });

  it('编辑岗位无导入横幅行为且零 JD 调用', async () => {
    render发布岗位('/hr/post-job/job_1');
    expect(screen.queryByText('把 JD 给我，这张表我来填')).toBeNull();
    选择JD(JDPDF());
    expect(mock创建JD导入).not.toHaveBeenCalled();
    expect(mock读取JD导入).not.toHaveBeenCalled();
    expect(screen.queryByText('允许 AI 识别这份职位描述？')).toBeNull();
  });

  // ── Spec §9.2 闭合错误文案：POST 异常全表（含非 BFF错误与未知 code）──
  it.each([
    ['invalid_pdf', new BFF错误(422, 'invalid_pdf', 'provider=openai request_id=req_1'), '仅支持有效、未加密且不含主动内容的 PDF', '重新上传 ›'],
    ['job_draft_import_too_large', new BFF错误(422, 'job_draft_import_too_large', 'too large'), '文件过大，请选择较小的 PDF', '重新上传 ›'],
    ['document_too_complex', new BFF错误(422, 'document_too_complex', 'complex'), '内容过多或过于复杂，请换一份 PDF', '重新上传 ›'],
    ['processing_consent_required', new BFF错误(422, 'processing_consent_required', 'consent'), '请重新确认后再继续', '重新上传 ›'],
    ['upload_in_progress', new BFF错误(409, 'upload_in_progress', 'in flight'), 'JD 正在上传，请稍后重试', '重试 ›'],
    ['idempotency_in_progress', new BFF错误(409, 'idempotency_in_progress', 'in flight'), 'JD 正在上传，请稍后重试', '重试 ›'],
    ['idempotency_conflict', new BFF错误(409, 'idempotency_conflict', 'conflict'), '上传意图已变化，请重新选择文件', '重新上传 ›'],
    ['parser_invalid_output', new BFF错误(422, 'parser_invalid_output', 'bad parse'), '未能识别这份 JD，可重新上传或手动填写', '重新上传 ›'],
    ['parser_temporarily_unavailable', new BFF错误(422, 'parser_temporarily_unavailable', 'busy'), '识别服务繁忙，请稍后重试或手动填写', '重新上传 ›'],
    ['job_draft_import_not_found', new BFF错误(404, 'job_draft_import_not_found', 'gone'), '这次识别已失效，请重新上传', '重新上传 ›'],
    ['storage_unavailable', new BFF错误(503, 'storage_unavailable', 'storage'), 不可用文案, '重试 ›'],
    ['network_error', new BFF错误(0, 'network_error', 'provider=openai request_id=req_2'), 不可用文案, '重试 ›'],
    ['HTTP 503 operation_outcome_unknown', new BFF错误(503, 'operation_outcome_unknown', 'unknown'), 不可用文案, '重试 ›'],
    ['invalid_response', new BFF错误(200, 'invalid_response', 'drift'), '服务返回异常，请稍后重试', '重新上传 ›'],
    ['未知 code', new BFF错误(500, 'mystery_error', 'provider=openai'), 不可用文案, '重新上传 ›'],
    ['原型链键 code', new BFF错误(422, 'constructor', 'proto'), 不可用文案, '重新上传 ›'],
    ['非 BFF错误', new Error('provider=openai request_id=req_9 model_output=SENSITIVE'), 不可用文案, '重新上传 ›'],
  ])('POST 失败 %s → 精确安全文案与动作，机器细节不上屏', async (_名, 错误, 文案, 动作) => {
    mock创建JD导入.mockRejectedValueOnce(错误).mockResolvedValueOnce(JDpending);
    render发布岗位();
    选择并确认JD(JDPDF());
    await 微任务结算();
    expect(横幅文字()).toBe(文案);
    expect(动作文字()).toBe(动作);
    expect(document.body.textContent).not.toContain('provider=openai');
    expect(document.body.textContent).not.toContain('request_id=req_');
    expect(document.body.textContent).not.toContain('model_output=');
  });

  // ── GET 异常：只有 network_error / HTTP 503 / storage_unavailable 保留 read 重试 ──
  it.each([
    ['network_error', new BFF错误(0, 'network_error', 'offline'), 不可用文案, '重试 ›'],
    ['HTTP 503', new BFF错误(503, 'downstream_unavailable', 'down'), 不可用文案, '重试 ›'],
    ['storage_unavailable', new BFF错误(503, 'storage_unavailable', 'storage'), 不可用文案, '重试 ›'],
    ['job_draft_import_not_found', new BFF错误(404, 'job_draft_import_not_found', 'gone'), '这次识别已失效，请重新上传', '重新上传 ›'],
    ['invalid_response', new BFF错误(200, 'invalid_response', 'drift'), '服务返回异常，请稍后重试', '重新上传 ›'],
    ['未知 code', new BFF错误(500, 'mystery_error', 'boom'), 不可用文案, '重新上传 ›'],
  ])('GET 失败 %s → 精确安全文案与动作', async (_名, 错误, 文案, 动作) => {
    mock创建JD导入.mockResolvedValue(JDpending);
    mock读取JD导入.mockRejectedValueOnce(错误).mockResolvedValueOnce(JDpending);
    render发布岗位();
    选择并确认JD(JDPDF());
    await 走(3000);
    await 微任务结算();
    expect(横幅文字()).toBe(文案);
    expect(动作文字()).toBe(动作);
    await 走(30000);
    // failed 后不再自动轮询
    expect(mock读取JD导入).toHaveBeenCalledTimes(1);
  });
});

// ── JD PDF 建议稿导入：快照安全合并、耦合组与 Catalog 规则（Task 4）──
// POST 起飞前捕获表单快照；succeeded 只写仍等于快照的字段；三个耦合组（招聘类型 /
// 办公方式 / 工作城市+地点引用）整组比较；类别只走轻提示；keywords 忽略。
describe('发布岗位页 JD 建议合并', () => {
  const 分类查询 = vi.fn(async (_kind: 'job-categories', query: { parentId?: string }) => {
    if (!query.parentId) {
      return {
        items: [{ id: 'cat_tech', display_name: '互联网/AI', parent_id: null, selectable: false }],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    }
    if (query.parentId === 'cat_tech') {
      return {
        items: [{ id: 'job_be', display_name: '后端开发', parent_id: 'cat_tech', selectable: true }],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    }
    return { items: [], nextCursor: null, catalogVersion: 'v2' };
  });
  const 地点查询 = vi.fn(async (query: { q?: string }) => {
    const 名 = (query.q ?? '').includes('北京') ? '北京' : '上海';
    return {
      items: [{
        id: `loc_${名}`, display_name: 名, country_code: 'CN', country_name: '中国',
        admin1_code: 'SH', admin1_name: 名, timezone: 'Asia/Shanghai', population: 24000000,
      }],
      nextCursor: null,
      catalogVersion: 'v2',
    };
  });

  const JD建议 = (覆盖: Partial<BFFJD建议>): BFFJD建议 => ({
    title: null, recruitment_type: null, workplace_mode: null, office_location: null,
    description: null, requirements: null, education_requirement: null,
    experience_requirement: null, category_source_name: null, location_source_name: null,
    keywords: [], ...覆盖,
  });
  const 成功 = (建议: BFFJD建议): BFFJD导入 => ({
    import_id: 'jdi_0123456789abcdef0123456789abcdef', status: 'succeeded',
    created_at: '2026-09-03T01:02:03Z', updated_at: '2026-09-03T01:02:06Z', suggestion: 建议,
  });

  const JDPDF = () => new File(['%PDF-1.7'], 'role.pdf', { type: 'application/pdf' });
  const 第二份PDF = () => new File(['%PDF-1.7'], 'another.pdf', { type: 'application/pdf' });

  const 标题框 = () => screen.getByPlaceholderText('必填，如：资深后端工程师 · 交易网关') as HTMLInputElement;
  const 描述框 = () => screen.getByLabelText('职位描述') as HTMLTextAreaElement;
  const 要求框 = () => screen.getByRole('textbox', { name: '给候选人看的职位要求（补充文字，不自动解析为硬门槛）' }) as HTMLTextAreaElement;
  const 城市框 = () => screen.getByPlaceholderText('搜索城市名，从下方候选选择') as HTMLInputElement;
  const 办公地框 = () => screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层') as HTMLInputElement;
  /** 招聘类型块的 accessible name 含副标文案，统一按前缀匹配取按钮。 */
  const 按钮前缀 = (名: string) => screen.getByRole('button', { name: new RegExp(`^${名}`) });
  const 按下 = (名: string) => 按钮前缀(名).getAttribute('aria-pressed');
  /** 学历/经验两行都有「不限」档：按行标签定位该行的快捷片。 */
  const 按下片 = (区: RegExp, 名: string) => {
    const 行 = screen.getByText(区).closest('div[class*="编辑条目"]');
    const 键 = Array.from(行?.querySelectorAll('button') ?? []).find((b) => b.textContent === 名);
    return 键?.getAttribute('aria-pressed');
  };
  const 类别提示数 = () => 轻提示文案们().filter((条) => 条.startsWith('AI 识别的职位类别')).length;

  function 轻提示文案们(): string[] {
    for (const 节点 of Array.from(document.body.children)) {
      const 元素 = 节点 as HTMLElement;
      if (元素.style.position === 'fixed' && 元素.style.zIndex === '999') {
        return Array.from(元素.children).map((条) => 条.textContent ?? '');
      }
    }
    return [];
  }

  async function 走(毫秒: number): Promise<void> {
    await act(async () => { await vi.advanceTimersByTimeAsync(毫秒); });
  }
  async function 微任务结算(): Promise<void> {
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  }

  function render发布岗位(路由 = '/hr/post-job') {
    return render(
      <MemoryRouter initialEntries={[路由]}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  function 选择JD(文件: File) {
    fireEvent.change(screen.getByLabelText('上传 JD 文件'), { target: { files: [文件] } });
  }
  function 确认JD() {
    fireEvent.click(screen.getByRole('button', { name: '同意并继续' }));
  }
  function 选择并确认JD(文件: File) {
    选择JD(文件);
    确认JD();
  }

  /** 第一步就绪：标题 + 现场 + Backend 类别叶子（先写标题，避免类别预填覆盖标题断言）。 */
  async function 第一步就绪(标题 = '上传前标题') {
    fireEvent.change(标题框(), { target: { value: 标题 } });
    fireEvent.click(screen.getByRole('button', { name: '现场' }));
    fireEvent.click(screen.getByRole('button', { name: /职位类别/ }));
    await 微任务结算();
    fireEvent.click(screen.getByText('后端开发'));
  }
  function 下一步() {
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  }
  function 返回() {
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    mock创建JD导入.mockReset();
    mock读取JD导入.mockReset();
    分类查询.mockClear();
    地点查询.mockClear();
    清空轻提示();
    置Backend应用状态(分类查询, 地点查询);
  });
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'hidden');
  });

  it('只自动填入上传后仍等于快照的字段（代表性用例）', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪('上传前标题');
    选择并确认JD(JDPDF());
    下一步();
    fireEvent.change(描述框(), { target: { value: '用户等待时写的描述' } });
    POST门.resolve(成功(JD建议({ title: 'AI 标题', description: 'AI 描述' })));
    await 微任务结算();
    // 等待期间改过的描述保留
    expect(描述框().value).toBe('用户等待时写的描述');
    // 上传后未改的标题被建议替换
    返回();
    expect(标题框().value).toBe('AI 标题');
    // 类别建议只走现有轻提示
    expect(类别提示数()).toBe(0); // 本建议 category 为 null
  });

  it('独立字段替换空白与未改的既有值；学历经验枚举映射精确；keywords 不进 DOM', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪('上传前标题');
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    POST门.resolve(成功(JD建议({
      title: 'Senior Backend Engineer',
      description: '负责核心招聘服务。',
      requirements: '五年以上后端经验。',
      education_requirement: 'bachelor',
      experience_requirement: 'five_plus_years',
      keywords: ['Go', 'PostgreSQL'],
    })));
    await 微任务结算();
    expect(要求框().value).toBe('五年以上后端经验。');
    expect(按下片(/最低学历/, '本科')).toBe('true');
    expect(按下片(/经验要求/, '5 年以上')).toBe('true');
    expect(screen.queryByText('Go')).toBeNull();
    expect(screen.queryByText('PostgreSQL')).toBeNull();
    返回();
    expect(描述框().value).toBe('负责核心招聘服务。');
    返回();
    // 上传前已非空但未修改的标题同样允许被替换（本轮已确认的自动填表语义）
    expect(标题框().value).toBe('Senior Backend Engineer');
  });

  it('解析期间改过的字段被保护；改回快照值后仍可被填（纯值比较）', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪('上传前标题');
    选择并确认JD(JDPDF());
    fireEvent.change(标题框(), { target: { value: '等待时改的标题' } });
    fireEvent.change(标题框(), { target: { value: '上传前标题' } });
    POST门.resolve(成功(JD建议({ title: 'AI 标题' })));
    await 微任务结算();
    expect(标题框().value).toBe('AI 标题');
  });

  it('null 建议保持当前值且不弹类别提示', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪('上传前标题');
    选择并确认JD(JDPDF());
    下一步();
    fireEvent.change(描述框(), { target: { value: '描述正文' } });
    下一步();
    POST门.resolve(成功(JD建议({})));
    await 微任务结算();
    expect(要求框().value).toBe('');
    expect(按下片(/最低学历/, '不限')).toBe('true');
    expect(城市框().value).toBe('');
    返回();
    expect(描述框().value).toBe('描述正文');
    返回();
    expect(标题框().value).toBe('上传前标题');
    expect(按下('现场')).toBe('true');
    expect(类别提示数()).toBe(0);
  });

  it.each([
    ['none', '不限'], ['associate', '大专'], ['bachelor', '本科'], ['master', '硕士'], ['doctorate', '博士'],
  ] as const)('学历枚举 %s → %s', async (wire, label) => {
    mock创建JD导入.mockImplementationOnce(() => Promise.resolve(成功(JD建议({ education_requirement: wire }))));
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    await 微任务结算();
    expect(按下片(/最低学历/, label)).toBe('true');
  });

  it.each([
    ['none', '不限'], ['one_to_three_years', '1-3 年'], ['three_to_five_years', '3-5 年'],
    ['five_plus_years', '5 年以上'], ['ten_plus_years', '10 年以上'],
  ] as const)('经验枚举 %s → %s（类型未变时独立应用）', async (wire, label) => {
    mock创建JD导入.mockImplementationOnce(() => Promise.resolve(成功(JD建议({ experience_requirement: wire }))));
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    await 微任务结算();
    expect(按下片(/经验要求/, label)).toBe('true');
  });

  it('招聘类型组：整组等于快照才切换；切换清空薪资与年薪月数；校园招聘隐藏经验档', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    下一步();
    下一步();
    fireEvent.change(screen.getByLabelText('薪资下限'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('薪资上限'), { target: { value: '65' } });
    fireEvent.click(screen.getByRole('button', { name: /年薪月数/ }));
    fireEvent.click(screen.getByRole('button', { name: '完成' }));
    返回();
    返回();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    POST门.resolve(成功(JD建议({ recruitment_type: 'campus', experience_requirement: 'five_plus_years' })));
    await 微任务结算();
    // 切到校园招聘：薪资清理、经验档整块收起（隐藏经验不被写成模型事实）
    expect((screen.getByLabelText('薪资下限') as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('button', { name: /年薪月数/ }).textContent).toContain('请选择');
    expect(screen.queryByText('经验要求（自动匹配读取）')).toBeNull();
    返回();
    返回();
    expect(按下('校园招聘')).toBe('true');
  });

  it('招聘类型组：解析期间改过任一成员则整组保留', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    fireEvent.change(screen.getByLabelText('薪资下限'), { target: { value: '40' } });
    POST门.resolve(成功(JD建议({ recruitment_type: 'campus' })));
    await 微任务结算();
    返回();
    返回();
    expect(按下('社招全职')).toBe('true');
  });

  it('建议切到兼职时经验随组一起应用', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    POST门.resolve(成功(JD建议({ recruitment_type: 'part_time', experience_requirement: 'ten_plus_years' })));
    await 微任务结算();
    expect(按下片(/经验要求/, '10 年以上')).toBe('true');
    返回();
    返回();
    expect(按下('兼职')).toBe('true');
  });

  it('建议切到实习生时重置转正确认', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    // 先在实习生下设转正=true，再切回社招全职（转正保留隐藏值）
    fireEvent.click(按钮前缀('实习生'));
    fireEvent.click(screen.getByRole('button', { name: '提供转正机会' }));
    fireEvent.click(按钮前缀('社招全职'));
    await 第一步就绪();
    选择并确认JD(JDPDF());
    POST门.resolve(成功(JD建议({ recruitment_type: 'internship' })));
    await 微任务结算();
    expect(按下('实习生')).toBe('true');
    expect(按下('提供转正机会')).toBe('false');
    expect(按下('暂不提供')).toBe('false');
  });

  it('办公方式组：全远程清空并禁用办公地点', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    下一步();
    下一步();
    fireEvent.change(办公地框(), { target: { value: '张江路 1 号' } });
    返回();
    返回();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    POST门.resolve(成功(JD建议({ workplace_mode: 'remote', office_location: '不该出现的地址' })));
    await 微任务结算();
    expect(办公地框().value).toBe('');
    expect(办公地框().disabled).toBe(true);
    返回();
    返回();
    expect(按下('全远程')).toBe('true');
  });

  it('办公方式组：解析期间改过地址则整组保留', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    fireEvent.change(办公地框(), { target: { value: '等待时改的地址' } });
    POST门.resolve(成功(JD建议({ workplace_mode: 'remote', office_location: 'AI 地址' })));
    await 微任务结算();
    expect(办公地框().value).toBe('等待时改的地址');
    expect(办公地框().disabled).toBe(false);
    返回();
    返回();
    expect(按下('现场')).toBe('true');
  });

  it('办公方式组：解析期间改过方式则地址建议不应用', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    fireEvent.click(screen.getByRole('button', { name: '混合' }));
    POST门.resolve(成功(JD建议({ office_location: 'AI 地址' })));
    await 微任务结算();
    expect(按下('混合')).toBe('true');
    下一步();
    下一步();
    expect(办公地框().value).toBe('');
  });

  it('地点组：无引用且未改时写入城市搜索并触发候选查询', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    POST门.resolve(成功(JD建议({ location_source_name: '上海' })));
    await 微任务结算();
    expect(城市框().value).toBe('上海');
    expect(screen.queryByText('已选')).toBeNull();
    await 走(260);
    expect(地点查询).toHaveBeenCalledWith(expect.objectContaining({ q: '上海' }));
  });

  it('地点组：已有 canonical 引用优先，源文本不覆盖', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    fireEvent.change(城市框(), { target: { value: '北京' } });
    await 走(260);
    fireEvent.click(screen.getByRole('button', { name: '北京' }));
    POST门.resolve(成功(JD建议({ location_source_name: '上海' })));
    await 微任务结算();
    expect(城市框().value).toBe('北京');
  });

  it('地点组：解析期间改过城市文本则源文本不应用', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    fireEvent.change(城市框(), { target: { value: '用户等待时改的城市' } });
    POST门.resolve(成功(JD建议({ location_source_name: '上海' })));
    await 微任务结算();
    expect(城市框().value).toBe('用户等待时改的城市');
  });

  it('create 重试沿用原快照：失败后用户编辑在重放成功时仍受保护', async () => {
    mock创建JD导入.mockRejectedValueOnce(new BFF错误(0, 'network_error', 'offline'));
    render发布岗位();
    await 第一步就绪('上传前标题');
    选择并确认JD(JDPDF());
    await 微任务结算();
    fireEvent.change(标题框(), { target: { value: '失败后改的标题' } });
    mock创建JD导入.mockResolvedValueOnce(成功(JD建议({ title: 'AI 标题' })));
    fireEvent.click(screen.getByText('重试 ›'));
    await 微任务结算();
    expect(标题框().value).toBe('失败后改的标题');
  });

  it('迟到代际的 succeeded 零应用且无类别提示', async () => {
    const 旧POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValueOnce(旧POST门.promise);
    render发布岗位();
    await 第一步就绪('上传前标题');
    选择并确认JD(JDPDF());
    选择JD(第二份PDF());
    旧POST门.resolve(成功(JD建议({
      title: 'AI 标题', recruitment_type: 'campus', workplace_mode: 'remote',
      office_location: 'AI 地址', description: 'AI 描述', location_source_name: '上海',
      category_source_name: '后端开发',
    })));
    await 微任务结算();
    expect(标题框().value).toBe('上传前标题');
    expect(按下('社招全职')).toBe('true');
    expect(按下('现场')).toBe('true');
    expect(类别提示数()).toBe(0);
  });
});

// ── Task 4：全远程办公地址合同与类别/地点发布门禁（真实时钟走完整发布流）──
describe('发布岗位页 全远程地址与 Catalog 门禁', () => {
  const 分类查询 = vi.fn(async (_kind: 'job-categories', query: { parentId?: string }) => {
    if (!query.parentId) {
      return {
        items: [{ id: 'cat_tech', display_name: '互联网/AI', parent_id: null, selectable: false }],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    }
    if (query.parentId === 'cat_tech') {
      return {
        items: [{ id: 'job_be', display_name: '后端开发', parent_id: 'cat_tech', selectable: true }],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    }
    return { items: [], nextCursor: null, catalogVersion: 'v2' };
  });
  const 地点查询 = vi.fn(async () => ({
    items: [{
      id: 'loc_shanghai', display_name: '上海', country_code: 'CN', country_name: '中国',
      admin1_code: 'SH', admin1_name: '上海', timezone: 'Asia/Shanghai', population: 24000000,
    }],
    nextCursor: null,
    catalogVersion: 'v2',
  }));

  beforeEach(() => {
    mock创建JD导入.mockReset();
    mock读取JD导入.mockReset();
    mock发布岗位.mockClear();
    mock更新岗位.mockClear();
    分类查询.mockClear();
    地点查询.mockClear();
    mock发布岗位.mockResolvedValue(undefined);
    置Backend应用状态(分类查询, 地点查询);
    清空轻提示();
  });

  function render发布岗位(路由 = '/hr/post-job') {
    return render(
      <MemoryRouter initialEntries={[路由]}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  /** 三步填到发布前；办公方式与办公地可覆盖（全远程用例不填地址）。 */
  async function 填到发布前(用户: ReturnType<typeof userEvent.setup>, 选项: { 办公方式?: '现场' | '混合' | '全远程'; 办公地?: string | null; JD建议地点?: string | null } = {}) {
    const { 办公方式 = '现场', 办公地 = '张江路 1 号', JD建议地点 = null } = 选项;
    await 用户.type(screen.getByPlaceholderText('必填，如：资深后端工程师 · 交易网关'), '资深后端');
    fireEvent.click(screen.getByRole('button', { name: 办公方式 }));
    fireEvent.click(screen.getByRole('button', { name: /职位类别/ }));
    await screen.findByText('后端开发');
    fireEvent.click(screen.getByText('后端开发'));
    if (JD建议地点 !== null) {
      mock创建JD导入.mockResolvedValue({
        import_id: 'jdi_0123456789abcdef0123456789abcdef', status: 'succeeded',
        created_at: '2026-09-03T01:02:03Z', updated_at: '2026-09-03T01:02:06Z',
        suggestion: {
          title: null, recruitment_type: null, workplace_mode: null, office_location: null,
          description: null, requirements: null, education_requirement: null,
          experience_requirement: null, category_source_name: '后端开发',
          location_source_name: JD建议地点, keywords: [],
        },
      });
      await 用户.upload(screen.getByLabelText('上传 JD 文件'), new File(['%PDF-1.7'], 'role.pdf', { type: 'application/pdf' }));
      await 用户.click(screen.getByRole('button', { name: '同意并继续' }));
    }
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await 用户.type(screen.getByLabelText('职位描述'), '负责交易网关与撮合核心');
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await 用户.type(screen.getByLabelText('薪资下限'), '50');
    await 用户.type(screen.getByLabelText('薪资上限'), '65');
    await 用户.click(screen.getByRole('button', { name: /年薪月数/ }));
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    if (办公地 !== null) {
      await 用户.type(screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层'), 办公地);
    }
    await 用户.type(screen.getByRole('textbox', { name: '给候选人看的职位要求（补充文字，不自动解析为硬门槛）' }), '有分布式系统经验');
    // 工作城市：JD 建议填了搜索文本的用例外，手输并点候选
    if (JD建议地点 === null) {
      await 用户.type(screen.getByPlaceholderText('搜索城市名，从下方候选选择'), '上海');
      await 用户.click(await screen.findByRole('button', { name: '上海' }, { timeout: 2000 }));
    }
    // Backend 发岗要求显式确认结构化匹配依据（确认框只在第三步渲染）；
    // 这两条用例聚焦地址/地点门禁，确认在这里统一补齐，不引入第二个变量。
    await 用户.click(screen.getByRole('checkbox', { name: '我已确认经验和学历设置将作为自动匹配依据；补充要求不会被自动解析。修改上述内容后需要重新确认。' }));
  }

  it('手动全远程：清空并禁用办公地点、跳过地址校验、payload 办公地为空串', async () => {
    const 用户 = userEvent.setup();
    render发布岗位();
    await 填到发布前(用户, { 办公方式: '全远程', 办公地: null });
    // 办公地点仍占原位置，但为空且禁用
    const 地址框 = screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层') as HTMLInputElement;
    expect(地址框.disabled).toBe(true);
    expect(地址框.value).toBe('');
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    expect(mock发布岗位.mock.calls[0][0].办公地).toBe('');
    // 切回现场：恢复可填必填，不恢复旧地址
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    fireEvent.click(screen.getByRole('button', { name: '现场' }));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect((screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层') as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层') as HTMLInputElement).value).toBe('');
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    expect(await screen.findByText('请填写办公地点')).toBeTruthy();
    expect(mock发布岗位).toHaveBeenCalledTimes(1);
  });

  it('JD 城市源文本只进搜索框：未经候选选择发布被拦，点候选后带地点引用发布', async () => {
    const 用户 = userEvent.setup();
    render发布岗位();
    await 填到发布前(用户, { JD建议地点: '上海' });
    // 建议只填了城市搜索文本，没有引用：发布被拦
    expect((screen.getByPlaceholderText('搜索城市名，从下方候选选择') as HTMLInputElement).value).toBe('上海');
    const 候选键 = await screen.findByRole('button', { name: '上海' }, { timeout: 2000 });
    expect(候选键).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    expect(await screen.findByText('请从候选城市中选择')).toBeTruthy();
    expect(mock发布岗位).not.toHaveBeenCalled();
    // 点真实候选后发布：类别引用仍是用户选择的，地点引用来自候选
    await 用户.click(候选键);
    await 用户.click(screen.getByRole('button', { name: '发布岗位并开始寻访' }));
    await waitFor(() => expect(mock发布岗位).toHaveBeenCalledTimes(1));
    const 传入 = mock发布岗位.mock.calls[0][0];
    expect(传入.类别引用).toEqual({ id: 'job_be', display_name: '后端开发' });
    expect(传入.地点引用).toEqual({ id: 'loc_shanghai', display_name: '上海' });
    expect(传入.城市).toBe('上海');
  });

  it('Backend 第一步要求真实类别引用；Mock 保持自由文本', async () => {
    // Backend：编辑岗位无 类别引用（老数据）→ 保存被拦在第一步
    置Backend应用状态(分类查询, 地点查询);
    mock应用状态.状态.岗位列表 = [{ ...页面岗位样本 }];
    const 用户 = userEvent.setup();
    const 后端页 = render发布岗位('/hr/post-job/job_1');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('请选择职位类别')).toBeTruthy();
    expect(mock更新岗位).not.toHaveBeenCalled();
    // Mock：同样数据照常保存（自由文本类别）
    后端页.unmount();
    mock更新岗位.mockClear();
    置Mock应用状态();
    mock应用状态.状态.岗位列表 = [{ ...页面岗位样本 }];
    render发布岗位('/hr/post-job/job_1');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock更新岗位).toHaveBeenCalledTimes(1));
  });
});
