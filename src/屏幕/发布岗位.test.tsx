// 发布岗位页 Backend 提交测试（Task 7）：
// 编辑保存成功前不导航；await 操作.更新岗位 落定后才返回。
// Backend 选择器：选类别候选 + 选城市候选 → 发布带 类别引用/地点引用（id+display_name）；
// 手输城市不选候选 → 发布被拦（操作.发布岗位 不调用）。
// Mock 下 操作 内部同步 dispatch，DOM/流程由现有 onboarding E2E 覆盖。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 发布岗位, { 取岗位提交错误文案 } from './发布岗位';
import { 页面岗位样本 } from '../测试/BFF样本';
import { BFF错误 } from '../数据/HTTP客户端';

const mock返回 = vi.fn();
const mock进企业主壳 = vi.fn();
const mock替换跳转 = vi.fn();
const mock跳转 = vi.fn();
const mock更新岗位 = vi.fn();
const mock发布岗位 = vi.fn();
const mock删除岗位 = vi.fn();

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
    操作: { 更新岗位: mock更新岗位, 发布岗位: mock发布岗位, 删除岗位: mock删除岗位 },
    数据源模式: 'backend',
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
    // Backend 编辑态的城市守卫（地点引用）不在本次修复范围内：编辑目标按存量岗位带引用
    mock应用状态.状态.岗位列表 = [
      { ...页面岗位样本, 地点引用: { id: 'loc_shanghai', display_name: '上海' } },
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
