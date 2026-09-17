// 引导问答（向导）测试 —— Task 3 合同 C 之后本屏每个模式只有一道题：
//   · onboarding（无 from=resume）= 补充偏好一题（硬性排除 + 屏蔽公司）：明确继续时
//     只调 保存首次意向（读最新 引导预填 refs/薪资/类型 + 本页偏好），成功才进披露说明；
//     缺首屏必需数据则替换回首屏补齐，绝不从空默认串提交。
//   · 日常编辑 /wizard?from=resume = 只编辑个人优势一题（Task 2/4 语义不变）。
// 期望职位/工作城市/期望薪资/个人优势四题已随 Spec §3 迁出本屏：它的预填、恢复与
// 提取说明改由 工作经历.资料与预填.test.tsx 覆盖，薪资抽屉与首屏写线由
// 学生分流.test.tsx 覆盖；本文件只保留补充偏好、屏蔽公司与日常编辑三条线。

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 引导问答 from './引导问答';
import { 路径 } from '../路由/路径表';
import { 创建候选编辑来路 } from '../流程/候选日常编辑';
import { 构造映射变体基底 } from '../数据/招聘数据源/简历预填.fixture';
import { 创建空候选预填状态, type 候选预填Eligibility, type 候选预填状态 } from '../状态/后端/类型';
import type { 屏蔽项 } from '../数据/类型';
import { BFF错误 } from '../数据/HTTP客户端';
import { BFF组织搜索项样本, BFF组织搜索页样本 } from '../测试/BFF样本';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock替换跳转 = vi.fn();
const mock操作 = vi.hoisted(() => ({
  保存个人优势: vi.fn(async (_文本?: string) => {}),
  保存首次意向: vi.fn(async (_输入?: Record<string, unknown>) => {}),
  确认候选Onboarding预填分区: vi.fn(),
  更新候选建档草稿: vi.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回, 替换跳转: mock替换跳转 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

const 全可预填: 候选预填Eligibility = {
  profile: { real_name: true, work_start_year: true, gender: true, birth_year: true, birth_month: true, current_education: true },
  summary: true,
  skills: true,
  experiences: true,
  educations: true,
  certificates: true,
};

/** ready 轮 fixture（与 Task 2 映射测试同款形状）：wire fixture 深拷贝基底。 */
function readySummary(): 候选预填状态 {
  const 建议 = 构造映射变体基底();
  return {
    ...创建空候选预填状态(),
    phase: 'ready',
    source: 建议.source,
    eligibility: 全可预填,
    suggestion: 建议,
  };
}

/** 首屏采集齐备的 引导预填（合同 C：refs/薪资/偏好都在首屏采完，本屏只读） */
const 首屏已采 = {
  城市们: ['上海'],
  职位: ['产品经理'],
  城市引用们: [{ id: 'loc_sh', display_name: '上海' }],
  职位引用们: [{ id: 'tax_pm', display_name: '产品经理' }],
  筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['混合'] },
  薪资: { 下限: 20, 上限: 30, 单位: '月薪K' as const },
};

/** 渲染向导（两身份同一个地址；旧薪资段地址由用例显式传 条目） */
function render引导问答(选项: {
  预填?: 候选预填状态;
  /** 显式覆盖整份 引导预填（null = 没有首屏数据） */
  引导预填?: unknown;
  /** 建档草稿增量（排除项/自定义诉求 的恢复侧、位置写入） */
  建档?: object;
  数据源?: 'backend' | 'mock';
  个人优势?: string;
  条目?: string | { pathname: string; search: string; state?: unknown };
  保存首次意向?: ReturnType<typeof vi.fn>;
} = {}) {
  const 引导预填 = 选项.引导预填 !== undefined
    ? 选项.引导预填
    : (选项.建档 === undefined ? 首屏已采 : { ...首屏已采, 建档: 选项.建档 });
  mock应用状态 = {
    数据源模式: 选项.数据源 ?? 'backend',
    目录查询: null,
    状态: {
      引导预填,
      个人优势: 选项.个人优势 ?? '',
      简历作品集链接: '',
      简历经历: [],
      简历教育: [],
      简历技能: [],
      简历证书: [],
      屏蔽名单: [],
      基本信息: { 真名: '沈', 开始工作年: '2017', 身份: '在职' as const },
    },
    后端状态: { 候选预填状态: 选项.预填 ?? 创建空候选预填状态(), 主体: null },
    派发: vi.fn(),
    操作: {
      ...mock操作,
      保存首次意向: 选项.保存首次意向 ?? mock操作.保存首次意向,
    },
  };
  render(
    <MemoryRouter initialEntries={[选项.条目 ?? 路径.引导问答]}>
      <引导问答 />
    </MemoryRouter>,
  );
}

/** 个人优势题 textarea（日常编辑模式） */
function 优势框(): HTMLTextAreaElement {
  return screen.getByLabelText('个人优势') as HTMLTextAreaElement;
}

describe('引导问答 onboarding 只问补充偏好（Task 3 合同 C）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock替换跳转.mockClear();
    mock操作.保存个人优势.mockReset().mockResolvedValue(undefined);
    mock操作.保存首次意向.mockReset().mockResolvedValue(undefined);
    mock操作.确认候选Onboarding预填分区.mockReset();
    mock操作.更新候选建档草稿.mockReset();
  });

  it('本屏只问补充偏好：期望职位/城市/薪资/个人优势四题都不再进场', () => {
    render引导问答();
    expect(screen.getByText('哪些情况直接排除？')).toBeTruthy();
    expect(screen.getByRole('button', { name: '下一步' })).toBeTruthy();
    expect(screen.queryByLabelText('个人优势')).toBeNull();
    expect(screen.queryByText('期望职位是')).toBeNull();
    expect(screen.queryByText('你理想的工作城市是')).toBeNull();
    expect(screen.queryByRole('button', { name: /薪资要求（/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '保存并继续' })).toBeNull();
  });

  it('明确继续动作只调 保存首次意向：读最新首屏 refs/薪资/类型 + 本页偏好，成功才进披露说明', async () => {
    render引导问答();
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '大小周' }));
    await 用户.type(screen.getByPlaceholderText('用你自己的话写'), '不接受夜班');
    await 用户.click(screen.getByRole('button', { name: '添加' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存首次意向).toHaveBeenCalledTimes(1));
    const 传入 = mock操作.保存首次意向.mock.calls[0][0] as Record<string, unknown>;
    expect(传入.职位们).toEqual(['产品经理']);
    expect(传入.城市们).toEqual(['上海']);
    expect(传入.薪资).toEqual({ 下限: 20, 上限: 30, 单位: '月薪K' });
    expect(传入.筛选偏好).toEqual({ 求职类型: ['社招全职'], 办公方式: ['混合'] });
    expect(传入.职位引用).toEqual({ id: 'tax_pm', display_name: '产品经理' });
    expect(传入.城市引用们).toEqual([{ id: 'loc_sh', display_name: '上海' }]);
    expect(传入.排除项).toEqual(['大小周']);
    expect(传入.自定义诉求).toEqual(['不接受夜班']);
    // 优势与首次意向已解耦：本屏不保存个人优势、不确认任何分区
    expect(mock操作.保存个人优势).not.toHaveBeenCalled();
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    expect(mock跳转).toHaveBeenCalledWith(路径.披露说明);
  });

  it('薪资/偏好逐字取自 引导预填（本屏不再自算周期，也不读页面副本）', async () => {
    render引导问答({
      引导预填: {
        ...首屏已采,
        筛选偏好: { 求职类型: ['实习生'], 办公方式: ['现场'] },
        薪资: { 下限: 300, 上限: 500, 单位: '元/天' },
      },
    });
    await userEvent.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存首次意向).toHaveBeenCalledTimes(1));
    const 传入 = mock操作.保存首次意向.mock.calls[0][0] as Record<string, unknown>;
    expect(传入.薪资).toEqual({ 下限: 300, 上限: 500, 单位: '元/天' });
    expect(传入.筛选偏好).toEqual({ 求职类型: ['实习生'], 办公方式: ['现场'] });
  });

  it('回到首屏补齐后再回来：本屏不缓存旧值，提交读的是最新 引导预填', async () => {
    render引导问答({ 引导预填: { ...首屏已采, 薪资: undefined } });
    const 用户 = userEvent.setup();
    // 同一挂载内的权威草稿更新（用户回首屏确认薪资后回到本屏）
    mock应用状态.状态.引导预填 = 首屏已采;
    await 用户.click(screen.getByRole('button', { name: '大小周' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存首次意向).toHaveBeenCalledTimes(1));
    expect((mock操作.保存首次意向.mock.calls[0][0] as Record<string, unknown>).薪资)
      .toEqual({ 下限: 20, 上限: 30, 单位: '月薪K' });
  });

  it.each([
    ['没有首屏数据（引导预填 缺席）', null],
    ['薪资未确认', { ...首屏已采, 薪资: undefined }],
    ['城市引用为空', { ...首屏已采, 城市们: [], 城市引用们: [] }],
    ['职位引用为空', { ...首屏已采, 职位: [], 职位引用们: [] }],
  ])('缺首屏必需数据（%s）：不提交空默认串，替换回首屏补齐', async (_名, 引导预填) => {
    render引导问答({ 引导预填 });
    await userEvent.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock替换跳转).toHaveBeenCalledWith(路径.学生分流));
    expect(mock操作.保存首次意向).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock操作.更新候选建档草稿).not.toHaveBeenCalled();
  });

  it('双击只发一次命令：提交锁 + 按钮禁用，不为同一轮造第二条意向', async () => {
    let resolve提交!: () => void;
    const 保存首次意向 = vi.fn(() => new Promise<void>((resolve) => { resolve提交 = resolve; }));
    render引导问答({ 保存首次意向 });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    expect(保存首次意向).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('button', { name: '下一步' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { resolve提交(); });
    await waitFor(() => expect(mock跳转).toHaveBeenCalledWith(路径.披露说明));
  });

  it('首次意向失败：留页保留偏好、不跳转，也不重存个人优势或重确认分区', async () => {
    mock操作.保存首次意向.mockRejectedValue(new Error('offline'));
    render引导问答();
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '大小周' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(document.body.textContent).toContain('请求失败，请稍后再试'));
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock操作.保存个人优势).not.toHaveBeenCalled();
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    // 重试只补意向：已成功的分区与个人优势一概不重跑
    mock操作.保存首次意向.mockResolvedValue(undefined);
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock跳转).toHaveBeenCalledWith(路径.披露说明));
    expect(mock操作.保存首次意向).toHaveBeenCalledTimes(2);
    expect(mock操作.保存个人优势).not.toHaveBeenCalled();
  });

  it('Mock 分支同样只调 保存首次意向 并进披露说明（预置意向不由本屏新增）', async () => {
    render引导问答({ 数据源: 'mock' });
    await userEvent.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存首次意向).toHaveBeenCalledTimes(1));
    expect(mock跳转).toHaveBeenCalledWith(路径.披露说明);
  });

  it('建档草稿里的 排除项/自定义诉求 恢复成本题答案并原样提交', async () => {
    render引导问答({ 建档: { 排除项: ['全现场办公'], 自定义诉求: ['不接受夜班'] } });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存首次意向).toHaveBeenCalledTimes(1));
    const 传入 = mock操作.保存首次意向.mock.calls[0][0] as Record<string, unknown>;
    expect(传入.排除项).toEqual(['全现场办公']);
    expect(传入.自定义诉求).toEqual(['不接受夜班']);
    // 答案与位置同一次草稿写（分两次写会拿过期建档互相覆盖）
    expect(mock操作.更新候选建档草稿).toHaveBeenCalledTimes(1);
    expect(mock操作.更新候选建档草稿).toHaveBeenCalledWith(expect.objectContaining({
      排除项: ['全现场办公'],
      自定义诉求: ['不接受夜班'],
      位置: { pathname: 路径.引导问答, search: '' },
    }));
  });

  it('单题形态不读 位置.题序：越界/损坏下标不影响本屏（不会白屏或跳到不存在的题）', () => {
    render引导问答({
      建档: { 位置: { pathname: 路径.引导问答, search: '', 题序: 9 } },
    });
    expect(screen.getByText('哪些情况直接排除？')).toBeTruthy();
    expect(screen.getByRole('button', { name: '下一步' })).toBeTruthy();
  });
});

// ── 旧薪资段地址最小兼容（Spec §3.2 / 合同 C）：薪资已并入首屏，本屏不再有薪资段。
//    「判定日常模式之后」才替换重定向 —— 恶意/旧组合 query 不得把日常编辑带进注册流。
describe('引导问答 · 旧薪资段地址兼容（Task 3）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock替换跳转.mockClear();
    mock操作.更新候选建档草稿.mockReset();
  });

  it('旧 ?stage=salary 替换回首屏补齐：不挂本屏表单、不动草稿与待写入槽', async () => {
    render引导问答({
      条目: 路径.引导问答薪资段,
      建档: {
        待写入: { 种类: 'summary', 幂等键: 'k1', 阶段: 'prepared' },
        资料: { 个人优势: '一半' },
      },
    });
    await waitFor(() => expect(mock替换跳转).toHaveBeenCalledWith(路径.学生分流));
    expect(mock跳转).not.toHaveBeenCalled();
    expect(screen.queryByText('哪些情况直接排除？')).toBeNull();
    expect(screen.queryByLabelText('个人优势')).toBeNull();
    expect(mock操作.更新候选建档草稿).not.toHaveBeenCalled();
  });

  it('日常编辑标记优先：?stage=salary&from=resume 仍是个人优势编辑，不被带进注册流', () => {
    render引导问答({
      条目: `${路径.引导问答}?stage=salary&from=resume`,
      引导预填: null,
    });
    expect(mock替换跳转).not.toHaveBeenCalled();
    expect(screen.getByText('编辑个人优势')).toBeTruthy();
    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy();
  });
});
// ── 个人优势独立编辑入口（Task 4 / Task 2）：/wizard?from=resume 在向导内唯一表示
//    「只编辑个人优势」—— 题序直接为个人优势单题，标题「编辑个人优势」，初值是已水合
//    全局.个人优势（不消费候选预填建议、不显示“已根据你上传的简历预先提取”与恢复动作）；
//    正文走共用 个人优势编辑正文（合同 B），「保存」只调 保存个人优势 后按统一退出
//    回我的简历，确认分区 / 首次意向 / 建档草稿一概不碰。──

function render个人优势编辑(选项: { 个人优势?: string; 预填?: 候选预填状态; 带来路?: boolean } = {}) {
  mock应用状态 = {
    数据源模式: 'backend',
    目录查询: {
      查询Taxonomy: vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
      查询Location: vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
      查询Institution: vi.fn(),
    },
    状态: {
      引导预填: null,
      个人优势: 选项.个人优势 ?? '',
      简历作品集链接: '',
      简历经历: [],
      屏蔽名单: [],
      基本信息: { 真名: '沈', 开始工作年: '2017', 身份: '在职' as const },
    },
    后端状态: { 候选预填状态: 选项.预填 ?? 创建空候选预填状态() },
    派发: vi.fn(),
    操作: mock操作,
  };
  render(
    <MemoryRouter initialEntries={[选项.带来路
      ? {
          pathname: 路径.引导问答,
          search: '?from=resume',
          state: 来路证明(),
        }
      : `${路径.引导问答}?from=resume`]}
    >
      <引导问答 />
    </MemoryRouter>,
  );
}

/** 合同 A 的来路证明：来源格号 +1 即「本会话从我的简历 push 进编辑页」 */
function 来路证明(): unknown {
  window.history.replaceState({ idx: 4, key: 'k4', usr: null }, '');
  const 来路 = 创建候选编辑来路('resume');
  window.history.replaceState({ idx: 5, key: 'k5', usr: null }, '');
  return 来路;
}

describe('引导问答 个人优势独立编辑（Task 4，/wizard?from=resume）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock替换跳转.mockClear();
    window.history.replaceState(null, '');
    mock操作.保存个人优势.mockReset().mockResolvedValue(undefined);
    mock操作.保存首次意向.mockReset().mockResolvedValue(undefined);
    mock操作.确认候选Onboarding预填分区.mockReset();
    mock操作.更新候选建档草稿.mockReset();
  });

  it('刷新直达编辑场景：题序只有个人优势一题，标题为编辑个人优势，按钮为「保存」', () => {
    render个人优势编辑({ 个人优势: '存量优势' });
    expect(优势框().value).toBe('存量优势');
    expect(screen.getByText('编辑个人优势')).toBeTruthy();
    expect(screen.queryByText('分享一下自己的个人优势')).toBeNull();
    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '保存并继续' })).toBeNull();
    expect(screen.queryByRole('button', { name: '下一步' })).toBeNull();
    // 不问城市 / 薪资 / 排除题：排除网格不出现
    expect(screen.queryByRole('button', { name: '大小周' })).toBeNull();
    // 已失效的「删除一行：长按段落」提示不再出现（字数与恢复语义保留）
    expect(screen.queryByText(/长按/)).toBeNull();
    expect(screen.getByText('4 / 500')).toBeTruthy();
  });

  it('初值是已水合现值：ready 预填建议不种入，提取说明与恢复动作不进场', () => {
    render个人优势编辑({ 个人优势: '我自己写的优势', 预填: readySummary() });
    expect(优势框().value).toBe('我自己写的优势');
    expect(screen.queryByText('已根据你上传的简历预先提取，直接删改即可。')).toBeNull();
    expect(screen.queryByRole('button', { name: /恢复简历识别建议|重新从简历提取/ })).toBeNull();
  });

  it('保存只调 保存个人优势 并按统一退出回我的简历：确认分区/首次意向/建档草稿全零', async () => {
    render个人优势编辑({ 个人优势: '旧优势' });
    const 用户 = userEvent.setup();
    await 用户.clear(优势框());
    await 用户.type(优势框(), '改后的优势');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock操作.保存个人优势).toHaveBeenCalledWith('改后的优势', '日常编辑')); // fix-r1：显式绕过 onboarding 跟踪
    expect(mock操作.确认候选Onboarding预填分区).not.toHaveBeenCalled();
    expect(mock操作.保存首次意向).not.toHaveBeenCalled();
    expect(mock操作.更新候选建档草稿).not.toHaveBeenCalled();
    // 无来路证明（刷新直达）：安全替换回我的简历，不盲退也不 push
    await waitFor(() => expect(mock替换跳转).toHaveBeenCalledWith(路径.我的简历));
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalledWith(路径.引导问答);
  });

  it('带来路证明保存：退一格回我的简历（不 push 新页）', async () => {
    render个人优势编辑({ 个人优势: '旧优势', 带来路: true });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock操作.保存个人优势).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mock返回).toHaveBeenCalledTimes(1));
    expect(mock替换跳转).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('多行文本逐字保存（保留换行）', async () => {
    render个人优势编辑({ 个人优势: '' });
    const 用户 = userEvent.setup();
    await 用户.type(优势框(), '第一行{Enter}第二行');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock操作.保存个人优势).toHaveBeenCalledWith('第一行\n第二行', '日常编辑'));
  });

  it('保存失败留在编辑页：输入保留、不退出', async () => {
    mock操作.保存个人优势.mockRejectedValue(new Error('offline'));
    render个人优势编辑({ 个人优势: '还没保存的优势' });
    const 用户 = userEvent.setup();
    await 用户.type(优势框(), '追加');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock操作.保存个人优势).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(document.body.textContent).toContain('请求失败，请稍后再试'));
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).not.toHaveBeenCalled();
    expect(优势框().value).toBe('还没保存的优势追加');
  });

  it('保存在途重复点击只发一次', async () => {
    let 解决!: () => void;
    mock操作.保存个人优势.mockImplementationOnce(() => new Promise<void>((ok) => { 解决 = ok; }));
    render个人优势编辑({ 个人优势: '' });
    const 用户 = userEvent.setup();
    await 用户.type(优势框(), '在途优势');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    解决();
    await waitFor(() => expect(mock替换跳转).toHaveBeenCalledWith(路径.我的简历));
    expect(mock操作.保存个人优势).toHaveBeenCalledTimes(1);
  });

  it('返回未保存不提交：零保存，只按统一出口退出', async () => {
    render个人优势编辑({ 个人优势: '原优势' });
    const 用户 = userEvent.setup();
    await 用户.type(优势框(), '改一半');
    await 用户.click(screen.getByRole('button', { name: /返回/ }));
    expect(mock操作.保存个人优势).not.toHaveBeenCalled();
    expect(mock操作.保存首次意向).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    // 取消与保存共用合同 A 的出口：无来路证明时安全替换回我的简历
    expect(mock替换跳转).toHaveBeenCalledWith(路径.我的简历);
  });
});

// ── J-PILOT-02 Task 7：私有诉求与权威屏蔽状态 ──
// 固定卡进 排除项、用户原文进 自定义诉求（映射层据此拼私有诉求）；
// 屏蔽只回显权威确认快照，不能因社招简历公司名默认已屏蔽或自动写入。

const 权威屏蔽项: 屏蔽项 = {
  编号: 'B-01',
  名称: '云衢科技',
  首字: '云',
  理由: '你手动加入 · 双向不可见',
  时间: '刚刚',
  组织编号: 'org_yq',
  来源: '手动添加',
  组织状态: '有效',
};

function render排除题(选项: {
  屏蔽名单?: 屏蔽项[];
  /** 简历经历段的最小形状：一键目标读 公司/组织编号/结束 */
  简历经历?: { 公司: string; 组织编号?: string; 结束?: string | null }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  解除组织屏蔽?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  添加组织屏蔽?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  搜索组织?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  创建组织?: any;
  身份?: '在校' | '离职';
} = {}) {
  const 解除组织屏蔽 = 选项.解除组织屏蔽 ?? vi.fn(async () => {});
  const 添加组织屏蔽 = 选项.添加组织屏蔽 ?? vi.fn(async () => {});
  const 搜索组织 = 选项.搜索组织 ?? vi.fn(async () => ({ items: [], next_cursor: null }));
  const 创建组织 = 选项.创建组织 ?? vi.fn();
  mock应用状态 = {
    数据源模式: 'backend',
    目录查询: {
      查询Taxonomy: vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
      查询Location: vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
      查询Institution: vi.fn(),
    },
    状态: {
      引导预填: 首屏已采,
      个人优势: '',
      简历作品集链接: '',
      简历经历: 选项.简历经历 ?? [],
      屏蔽名单: 选项.屏蔽名单 ?? [],
      基本信息: { 真名: '沈', 开始工作年: '2017', 身份: 选项.身份 ?? '离职' },
    },
    后端状态: { 候选预填状态: 创建空候选预填状态(), 主体: null },
    派发: vi.fn(),
    操作: { ...mock操作, 解除组织屏蔽, 添加组织屏蔽, 搜索组织, 创建组织 },
  };
  render(
    <MemoryRouter initialEntries={[路径.引导问答]}>
      <引导问答 />
    </MemoryRouter>,
  );
  return { 解除组织屏蔽, 添加组织屏蔽, 搜索组织, 创建组织 };
}

/** 抽屉内查询域（弹层框架 dialog，标签「选择企业」） */
function 公司抽屉() {
  return within(screen.getByRole('dialog', { name: '选择企业' }));
}

/** 再加一家 → 开抽屉 → 输入搜索词等过 250ms debounce（行按钮 aria-label = 常用名） */
async function 打开抽屉并搜索公司(用户: ReturnType<typeof userEvent.setup>, 词: string) {
  await 用户.click(screen.getByRole('button', { name: /再加一家/ }));
  fireEvent.change(公司抽屉().getByPlaceholderText('输入公司名称'), { target: { value: 词 } });
  await waitFor(() => expect(公司抽屉().getByRole('button', { name: '云衢科技' })).toBeDefined());
}

/** 选中抽屉里的唯一命中行 */
async function 选中公司行() {
  fireEvent.click(公司抽屉().getByRole('button', { name: '云衢科技' }));
}

describe('引导问答 硬性排除：私有诉求与权威屏蔽（Task 7）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock操作.保存个人优势.mockReset().mockResolvedValue(undefined);
    mock操作.保存首次意向.mockReset().mockResolvedValue(undefined);
    mock操作.确认候选Onboarding预填分区.mockReset();
    mock操作.更新候选建档草稿.mockReset();
  });

  it('固定卡进 排除项、用户自定义原文进 自定义诉求（不再混进排除项被丢弃）', async () => {
    render引导问答();
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '大小周' }));
    await 用户.click(screen.getByRole('button', { name: '频繁出差' }));
    await 用户.type(screen.getByPlaceholderText('用你自己的话写'), '不接受夜班');
    await 用户.click(screen.getByRole('button', { name: '添加' }));
    await 用户.type(screen.getByPlaceholderText('用你自己的话写'), '大小周也能接受');
    await 用户.click(screen.getByRole('button', { name: '添加' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存首次意向).toHaveBeenCalled());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const 传入 = (mock操作.保存首次意向.mock.calls[0] as any[])[0];
    expect(传入.排除项).toEqual(['大小周', '频繁出差']);
    expect(传入.自定义诉求).toEqual(['不接受夜班', '大小周也能接受']);
    // 离开该题时两个载体都落进建档草稿（刷新/返回不丢）
    expect(mock操作.更新候选建档草稿).toHaveBeenCalledWith(
      expect.objectContaining({
        排除项: ['大小周', '频繁出差'],
        自定义诉求: ['不接受夜班', '大小周也能接受'],
      }),
    );
  });

  // review r1 #1：行内输入写的是「用户自己的话」，与卡片同名也不例外 ——
  // 走 排除项 就会被映射改写成「不接受大小周」，那是 Spec §5.1 明令禁止的改写用户原话。
  it('自定义输入里逐字打出卡片同名文字，仍进 自定义诉求（不被当卡片改写）', async () => {
    render引导问答();
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByPlaceholderText('用你自己的话写'), '大小周');
    await 用户.click(screen.getByRole('button', { name: '添加' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存首次意向).toHaveBeenCalled());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const 传入 = (mock操作.保存首次意向.mock.calls[0] as any[])[0];
    expect(传入.排除项).toEqual([]);
    expect(传入.自定义诉求).toEqual(['大小周']);
  });

  // review r1 #1 第二面：草稿恢复出来的同名自定义原话必须能被点掉，
  // 且点它不能反而往 排除项 里塞一张卡（否则会多出一条「不接受大小周」且删不掉）。
  it('草稿恢复的同名自定义原话可点掉，且点击不会变成勾选固定卡', async () => {
    render引导问答({ 建档: { 排除项: ['频繁出差'], 自定义诉求: ['大小周'] } });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '大小周' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存首次意向).toHaveBeenCalled());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const 传入 = (mock操作.保存首次意向.mock.calls[0] as any[])[0];
    expect(传入.自定义诉求).toEqual([]);
    expect(传入.排除项).toEqual(['频繁出差']);
  });

  // review r1 #5：草稿恢复这一侧同样要有断言 —— 刷新回来两个载体都在原位
  it('建档草稿里的 排除项/自定义诉求 恢复成本题答案并原样提交', async () => {
    render引导问答({ 建档: { 排除项: ['全现场办公'], 自定义诉求: ['不接受夜班'] } });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存首次意向).toHaveBeenCalled());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const 传入 = (mock操作.保存首次意向.mock.calls[0] as any[])[0];
    expect(传入.排除项).toEqual(['全现场办公']);
    expect(传入.自定义诉求).toEqual(['不接受夜班']);
  });

  it('取消一枚自定义 chip 只动 自定义诉求，不影响固定卡', async () => {
    render引导问答();
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '全现场办公' }));
    await 用户.type(screen.getByPlaceholderText('用你自己的话写'), '不接受夜班');
    await 用户.click(screen.getByRole('button', { name: '添加' }));
    await 用户.click(screen.getByRole('button', { name: '不接受夜班' }));
    await 用户.click(screen.getByRole('button', { name: '下一步' }));
    await waitFor(() => expect(mock操作.保存首次意向).toHaveBeenCalled());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const 传入 = (mock操作.保存首次意向.mock.calls[0] as any[])[0];
    expect(传入.排除项).toEqual(['全现场办公']);
    expect(传入.自定义诉求).toEqual([]);
  });

  it('Backend 社招：简历公司名不默认已屏蔽；缺组织编号的经历让一键提示补选且不部分执行', async () => {
    const { 添加组织屏蔽 } = render排除题({ 简历经历: [{ 公司: '云衢科技' }] });
    const 用户 = userEvent.setup();
    // 简历里的公司名不是组织身份：既不显示成已屏蔽 chip，开关也默认关
    expect(screen.queryByRole('button', { name: /云衢科技/ })).toBeNull();
    const 开关 = screen.getByRole('switch', { name: '一键屏蔽简历中的公司' });
    expect(开关.getAttribute('aria-checked')).toBe('false');
    await 用户.click(开关);
    // 非空公司经历没有组织编号：提示回工作经历补选，本轮不静默部分执行
    expect(添加组织屏蔽).not.toHaveBeenCalled();
    expect(开关.getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByRole('button', { name: /云衢科技 ✕/ })).toBeNull();
    await waitFor(() => expect(document.body.textContent).toContain('请先到工作经历补选'));
  });

  it('Backend chip 来自权威屏蔽快照；解除失败保留 chip，不做本地假成功', async () => {
    const 解除组织屏蔽 = vi.fn(async () => { throw new Error('offline'); });
    render排除题({ 屏蔽名单: [权威屏蔽项], 解除组织屏蔽 });
    const 用户 = userEvent.setup();
    const chip = screen.getByRole('button', { name: /云衢科技 ✕/ });
    await 用户.click(chip);
    await waitFor(() => expect(解除组织屏蔽).toHaveBeenCalledWith(expect.objectContaining({ 组织编号: 'org_yq' })));
    // 权威快照没变：chip 仍在，并给出错误提示
    expect(screen.getByRole('button', { name: /云衢科技 ✕/ })).toBeDefined();
    await waitFor(() => expect(document.body.textContent).toContain('请求失败，请稍后再试'));
  });

  // review r1 #3：非 手动添加 的屏蔽（当前雇主 / 关联公司）解除需要风险确认，
  // 本屏没有确认层，一次误点就会把现雇主的屏蔽摘掉、暴露求职动作 —— 不许单击直解。
  it('Backend 非手动来源的 chip 单击不解除，只说明须到屏蔽名单页处理', async () => {
    const 当前雇主项: 屏蔽项 = {
      ...权威屏蔽项,
      编号: 'B-02',
      名称: '现雇主科技',
      组织编号: 'org_now',
      来源: '当前雇主',
      理由: '建档时自动加入 · 双向不可见',
    };
    const { 解除组织屏蔽 } = render排除题({ 屏蔽名单: [当前雇主项] });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: /现雇主科技 ✕/ }));
    expect(解除组织屏蔽).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /现雇主科技 ✕/ })).toBeDefined();
    await waitFor(() => expect(document.body.textContent).toContain('需要风险确认'));
  });

  it('Backend 解除成功后 chip 随权威快照消失（不由本地开关宣布）', async () => {
    const { 解除组织屏蔽 } = render排除题({ 屏蔽名单: [权威屏蔽项] });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: /云衢科技 ✕/ }));
    await waitFor(() => expect(解除组织屏蔽).toHaveBeenCalledTimes(1));
    // 权威快照更新后重渲染：chip 不再出现
    cleanup();
    mock应用状态.状态 = { ...mock应用状态.状态, 屏蔽名单: [] };
    render(
      <MemoryRouter initialEntries={['/onboard/wizard?stage=preference']}>
        <引导问答 />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: /云衢科技 ✕/ })).toBeNull();
  });

  it('Mock 分支的本地屏蔽演示行为不变（简历公司随开关并入本地列表）', async () => {
    const 派发 = vi.fn();
    mock应用状态 = {
      数据源模式: 'mock',
      目录查询: null,
      状态: {
        引导预填: 首屏已采,
        个人优势: '',
        简历作品集链接: '',
        简历经历: [{ 公司: '云衢科技' }],
        屏蔽名单: [],
        基本信息: { 真名: '沈', 开始工作年: '2017', 身份: '离职' as const },
      },
      派发,
      操作: mock操作,
    };
    render(
      <MemoryRouter initialEntries={['/onboard/wizard?stage=preference']}>
        <引导问答 />
      </MemoryRouter>,
    );
    // 非在校：一键开关默认开，简历公司进本地列表
    expect(screen.getByRole('switch', { name: '一键屏蔽简历中的公司' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('button', { name: /云衢科技 ✕/ })).toBeDefined();
  });
});

// ── Task 5：再加一家复用公司选择抽屉 + 一键屏蔽的真实 ID 写线 ──
// 选中/添加完成即以 source=手动添加 屏蔽，成功才由权威快照出 chip；
// 一键目标按真实组织 ID 去重、在职优先，顺序 await，首次失败停止剩余写入。

const 任务5已屏蔽行: 屏蔽项 = {
  编号: 'B-01', 名称: '云衢科技', 首字: '云', 理由: '你手动加入 · 双向不可见',
  时间: '刚刚', 组织编号: 'org_a', 来源: '手动添加', 组织状态: '有效',
};
const 任务5已屏蔽行B: 屏蔽项 = {
  ...任务5已屏蔽行,
  编号: 'B-02', 名称: '恒达外包', 首字: '恒', 组织编号: 'org_b',
};

describe('引导问答 再加一家：公司选择抽屉与手动屏蔽（Task 5）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock操作.保存个人优势.mockReset().mockResolvedValue(undefined);
    mock操作.保存首次意向.mockReset().mockResolvedValue(undefined);
    mock操作.确认候选Onboarding预填分区.mockReset();
    mock操作.更新候选建档草稿.mockReset();
  });

  it('再加一家打开抽屉；选定命中即以 source=手动添加 屏蔽，未写成功不出 chip', async () => {
    const { 添加组织屏蔽 } = render排除题({
      搜索组织: vi.fn().mockResolvedValue(BFF组织搜索页样本),
    });
    const 用户 = userEvent.setup();
    expect(添加组织屏蔽).not.toHaveBeenCalled();
    await 打开抽屉并搜索公司(用户, '云衢');
    await 选中公司行();
    await waitFor(() => expect(添加组织屏蔽).toHaveBeenCalledWith('org_1', '手动添加'));
    // 权威快照没变：不出 chip，不做本地假成功
    expect(screen.queryByRole('button', { name: /云衢科技 ✕/ })).toBeNull();
    expect(mock应用状态.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '拉黑' }));
    // 选定成功抽屉关闭
    await waitFor(() => expect(screen.queryByText('选择企业')).toBeNull());
  });

  it('首个屏蔽请求在途时再点同一行不伪造成功：抽屉不关、无第二笔调用；失败后可重试', async () => {
    const 门们: { resolve: (值?: unknown) => void; reject: (错误?: unknown) => void }[] = [];
    const 添加组织屏蔽 = vi.fn(() => new Promise((ok, fail) => { 门们.push({ resolve: ok as () => void, reject: fail }); }));
    render排除题({
      搜索组织: vi.fn().mockResolvedValue(BFF组织搜索页样本),
      添加组织屏蔽,
    });
    const 用户 = userEvent.setup();
    await 打开抽屉并搜索公司(用户, '云衢');
    选中公司行();
    await waitFor(() => expect(添加组织屏蔽).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('dialog', { name: '选择企业' })).toBeDefined();

    // 首个请求未结算：再点同一行被重入挡下，不产生第二笔调用，抽屉不关（无假成功）
    fireEvent.click(公司抽屉().getByRole('button', { name: '云衢科技' }));
    await waitFor(() => {});
    expect(添加组织屏蔽).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: '选择企业' })).toBeDefined();
    expect(mock应用状态.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '拉黑' }));

    // 首个请求拒绝：显示失败、抽屉仍开可重试
    门们[0].reject(new BFF错误(503, 'backend_unavailable', 'down'));
    await waitFor(() => expect(document.body.textContent).toContain('后端服务暂时不可用'));
    expect(screen.getByRole('dialog', { name: '选择企业' })).toBeDefined();

    // 重试同一行：真实结算成功才关抽屉
    fireEvent.click(公司抽屉().getByRole('button', { name: '云衢科技' }));
    await waitFor(() => expect(添加组织屏蔽).toHaveBeenCalledTimes(2));
    门们[1].resolve();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择企业' })).toBeNull());
  });

  it('创建目录成功而屏蔽失败：显示屏蔽失败、不再次造目录条目，可重选同一企业重试', async () => {
    let 屏蔽成功 = false;
    const 添加组织屏蔽 = vi.fn(async () => { if (!屏蔽成功) throw new BFF错误(503, 'backend_unavailable', 'down'); });
    const 创建组织 = vi.fn(async () => ({ organization: BFF组织搜索项样本 }));
    render排除题({
      搜索组织: vi.fn().mockResolvedValue(BFF组织搜索页样本),
      创建组织,
      添加组织屏蔽,
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: /再加一家/ }));
    await 用户.click(screen.getByRole('button', { name: '添加新企业' }));
    await 用户.type(screen.getByPlaceholderText('输入公司名称'), '云衢科技');
    await 用户.click(screen.getByRole('button', { name: '添加并选择' }));
    // 创建一次成功、屏蔽一次失败：不再次造目录条目
    await waitFor(() => expect(添加组织屏蔽).toHaveBeenCalledTimes(1));
    expect(添加组织屏蔽).toHaveBeenCalledWith('org_1', '手动添加');
    expect(创建组织).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(document.body.textContent).toContain('后端服务暂时不可用'));
    // 抽屉仍开着（返回搜索可重选同一企业重试），不再次造目录条目
    expect(screen.getByRole('button', { name: '返回搜索' })).toBeDefined();

    // 重试：返回搜索视图，重选同一命中行（不再创建）→ 第二次屏蔽成功后抽屉关闭
    屏蔽成功 = true;
    await 用户.click(screen.getByRole('button', { name: '返回搜索' }));
    fireEvent.change(screen.getByPlaceholderText('输入公司名称'), { target: { value: '云衢' } });
    await waitFor(() => expect(公司抽屉().getByRole('button', { name: '云衢科技' })).toBeDefined());
    fireEvent.click(公司抽屉().getByRole('button', { name: '云衢科技' }));
    await waitFor(() => expect(添加组织屏蔽).toHaveBeenCalledTimes(2));
    expect(添加组织屏蔽).toHaveBeenLastCalledWith('org_1', '手动添加');
    expect(创建组织).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('选择企业')).toBeNull());
  });

  // review r2：一键 与 手动 两条屏蔽入口共用同一同步写入锁 —— 一键在途时抽屉里
  // 再选同一企业不能被操作层同键锁静默吞掉后当成成功关抽屉
  it('一键屏蔽在途时抽屉再选同一企业不伪造成功：抽屉不关、无第二笔调用；一键失败后可重试', async () => {
    const 门们: { resolve: (值?: unknown) => void; reject: (错误?: unknown) => void }[] = [];
    const 添加组织屏蔽 = vi.fn(() => new Promise((ok, fail) => { 门们.push({ resolve: ok as () => void, reject: fail }); }));
    render排除题({
      简历经历: [{ 公司: '云衢科技', 组织编号: 'org_1', 结束: null }],
      搜索组织: vi.fn().mockResolvedValue(BFF组织搜索页样本),
      添加组织屏蔽,
    });
    const 用户 = userEvent.setup();
    // 一键屏蔽 org_1 在途（首请求未结算）
    await 用户.click(screen.getByRole('switch', { name: '一键屏蔽简历中的公司' }));
    await waitFor(() => expect(添加组织屏蔽).toHaveBeenCalledTimes(1));
    expect(添加组织屏蔽).toHaveBeenCalledWith('org_1', '当前雇主');

    // 一键仍在途：抽屉里选同一企业 → 共用锁挡下，无第二笔调用、抽屉不关（无伪成功）
    await 打开抽屉并搜索公司(用户, '云衢');
    fireEvent.click(公司抽屉().getByRole('button', { name: '云衢科技' }));
    await waitFor(() => {});
    expect(添加组织屏蔽).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: '选择企业' })).toBeDefined();
    expect(mock应用状态.派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '拉黑' }));

    // 一键请求失败：提示失败；从抽屉原选择重试，真实结算成功才关抽屉
    门们[0].reject(new BFF错误(503, 'backend_unavailable', 'down'));
    await waitFor(() => expect(document.body.textContent).toContain('后端服务暂时不可用'));
    expect(screen.getByRole('dialog', { name: '选择企业' })).toBeDefined();
    fireEvent.click(公司抽屉().getByRole('button', { name: '云衢科技' }));
    await waitFor(() => expect(添加组织屏蔽).toHaveBeenCalledTimes(2));
    门们[1].resolve();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择企业' })).toBeNull());
  });

  it('一键屏蔽：缺任一组织编号则提示回工作经历补选，本轮不静默部分执行', async () => {
    const { 添加组织屏蔽 } = render排除题({
      简历经历: [
        { 公司: '云衢科技', 组织编号: 'org_a', 结束: null },
        { 公司: '恒达外包', 组织编号: 'org_b', 结束: '2022-03' },
        { 公司: '某厂' }, // 缺组织编号 → 本轮不执行
      ],
    });
    const 用户 = userEvent.setup();
    const 开关 = screen.getByRole('switch', { name: '一键屏蔽简历中的公司' });
    expect(开关.getAttribute('aria-checked')).toBe('false');
    await 用户.click(开关);
    expect(添加组织屏蔽).not.toHaveBeenCalled();
    await waitFor(() => expect(document.body.textContent).toContain('请先到工作经历补选'));
    expect(开关.getAttribute('aria-checked')).toBe('false');
  });

  it('一键屏蔽：在职经历用当前雇主、其余曾任职企业用手动添加，同 ID 去重只调用一次，不推断关联公司', async () => {
    const { 添加组织屏蔽 } = render排除题({
      简历经历: [
        { 公司: '云衢科技', 组织编号: 'org_a', 结束: '2021-01' },
        { 公司: '云衢科技', 组织编号: 'org_a', 结束: null },
        { 公司: '恒达外包', 组织编号: 'org_b', 结束: '2022-03' },
      ],
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('switch', { name: '一键屏蔽简历中的公司' }));
    await waitFor(() => expect(添加组织屏蔽).toHaveBeenCalledTimes(2));
    expect(添加组织屏蔽).toHaveBeenNthCalledWith(1, 'org_a', '当前雇主');
    expect(添加组织屏蔽).toHaveBeenNthCalledWith(2, 'org_b', '手动添加');
  });

  it('一键屏蔽顺序 await：第二项失败停止剩余写入，已成功项显示，重试跳过已有成功目标', async () => {
    const 添加组织屏蔽 = vi.fn(async (id: string) => {
      if (id === 'org_a') return;
      throw new BFF错误(503, 'backend_unavailable', 'down');
    });
    render排除题({
      简历经历: [
        { 公司: '云衢科技', 组织编号: 'org_a', 结束: null }, // 在职 → 当前雇主
        { 公司: '恒达外包', 组织编号: 'org_b', 结束: '2022-03' },
      ],
      添加组织屏蔽,
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('switch', { name: '一键屏蔽简历中的公司' }));
    // 首次失败停止剩余写入：恰两次调用，org_b 失败
    await waitFor(() => expect(添加组织屏蔽).toHaveBeenCalledTimes(2));
    expect(添加组织屏蔽).toHaveBeenNthCalledWith(1, 'org_a', '当前雇主');
    expect(添加组织屏蔽).toHaveBeenNthCalledWith(2, 'org_b', '手动添加');
    await waitFor(() => expect(document.body.textContent).toContain('后端服务暂时不可用'));

    // 权威快照前进（org_a 已成功 → 首项 chip），整页按权威状态重渲染后重试：
    // org_a 已成功不重写，只补 org_b
    cleanup();
    const 重试屏蔽 = vi.fn(async () => {});
    render排除题({
      简历经历: [
        { 公司: '云衢科技', 组织编号: 'org_a', 结束: '2021-01' },
        { 公司: '恒达外包', 组织编号: 'org_b', 结束: '2022-03' },
      ],
      屏蔽名单: [任务5已屏蔽行],
      添加组织屏蔽: 重试屏蔽,
    });
    await 用户.click(screen.getByRole('switch', { name: '一键屏蔽简历中的公司' }));
    await waitFor(() => expect(重试屏蔽).toHaveBeenCalledTimes(1));
    expect(重试屏蔽).toHaveBeenCalledWith('org_b', '手动添加');
  });

  it('一键全成功后开关显示已屏蔽；关闭导航现有屏蔽名单逐项解除，不自动解除', async () => {
    const 解除组织屏蔽 = vi.fn();
    const { 添加组织屏蔽 } = render排除题({
      简历经历: [
        { 公司: '云衢科技', 组织编号: 'org_a', 结束: '2021-01' },
        { 公司: '恒达外包', 组织编号: 'org_b', 结束: '2022-03' },
      ],
      屏蔽名单: [任务5已屏蔽行, 任务5已屏蔽行B],
      解除组织屏蔽,
    });
    const 用户 = userEvent.setup();
    const 开关 = screen.getByRole('switch', { name: '一键屏蔽简历中的公司' });
    expect(开关.getAttribute('aria-checked')).toBe('true');
    // 关闭只去现有解除入口：导航屏蔽名单，不自动解除、不发任何写
    await 用户.click(开关);
    expect(mock跳转).toHaveBeenCalledWith('/blocklist');
    expect(解除组织屏蔽).not.toHaveBeenCalled();
    expect(添加组织屏蔽).not.toHaveBeenCalled();
  });

  it('无目标时开关不能显示全部已屏蔽：保持关闭并说明无可一键屏蔽的公司', async () => {
    render排除题({ 简历经历: [] });
    const 用户 = userEvent.setup();
    const 开关 = screen.getByRole('switch', { name: '一键屏蔽简历中的公司' });
    expect(开关.getAttribute('aria-checked')).toBe('false');
    await 用户.click(开关);
    await waitFor(() => expect(document.body.textContent).toContain('简历里还没有可一键屏蔽的公司'));
    expect(开关.getAttribute('aria-checked')).toBe('false');
  });
});
