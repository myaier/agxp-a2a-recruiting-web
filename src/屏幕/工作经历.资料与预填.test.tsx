// 工作经历 · 资料与预填（保存 single-flight / 简历编辑来源 / onboarding 预填 / 资料接线）
// 由 src/屏幕/工作经历.test.tsx 按冻结归属拆出：预填保存→资料与预填；保存 single-flight、简历编辑来源（from=resume）、候选 onboarding 预填（Spec §8）、空身份经历保存、Task 4 资料接线按保存/预填职责就近归入。

import {
  mock跳转,
  mock返回,
  mock替换跳转,
  mock轻提示,
  mock确认分区,
  mock更新草稿,
  mock应用状态,
  简历经历初始,
  render工作经历,
  存简历调用们,
  完整教育,
  登记工作经历,
  type 入口形,
} from './工作经历.测试辅助';

import { act, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 路径 } from '../路由/路径表';
import { 创建候选编辑来路 } from '../流程/候选日常编辑';
import { 个人优势文本 } from '../数据/模拟数据';
import { type BFF简历预填建议 } from '../数据/BFF契约';
import { 构造映射变体基底, 多条教育变体 } from '../数据/招聘数据源/简历预填.fixture';
import { 创建空候选预填状态, type 候选预填Eligibility, type 候选预填状态 } from '../状态/后端/类型';
import { type 简历经历段, type 简历教育段, type 简历证书 } from '../数据/类型';
import userEvent from '@testing-library/user-event';
import 工作经历 from './工作经历';

// jsdom 不实现 scrollIntoView / scrollTo（DF-002 首错定位的挂载滚动会调用）
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

登记工作经历(工作经历);

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回, 替换跳转: mock替换跳转 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

// ── 候选 onboarding 简历预填（Spec §8 /experience，Task 6）──

const 全可预填: 候选预填Eligibility = {
  profile: { real_name: true, work_start_year: true, gender: true, birth_year: true, birth_month: true, current_education: true },
  summary: true,
  skills: true,
  experiences: true,
  educations: true,
  certificates: true,
};

/** ready 轮 fixture（与 Task 2 映射测试同款形状）；建议默认是 wire fixture 深拷贝基底。 */
function readyWork(
  覆盖: {
    experiencesEligible?: boolean;
    educationsEligible?: boolean;
    skillsEligible?: boolean;
    certificatesEligible?: boolean;
  } = {},
  建议: BFF简历预填建议 = 构造映射变体基底(),
): 候选预填状态 {
  return {
    ...创建空候选预填状态(),
    phase: 'ready',
    source: 建议.source,
    eligibility: {
      ...全可预填,
      ...(覆盖.experiencesEligible !== undefined ? { experiences: 覆盖.experiencesEligible } : {}),
      ...(覆盖.educationsEligible !== undefined ? { educations: 覆盖.educationsEligible } : {}),
      ...(覆盖.skillsEligible !== undefined ? { skills: 覆盖.skillsEligible } : {}),
      ...(覆盖.certificatesEligible !== undefined ? { certificates: 覆盖.certificatesEligible } : {}),
    },
    suggestion: 建议,
  };
}

/** 深拷贝 wire fixture 的 result 改写出映射边界样本（unresolved / 缺席），不触碰不可变 fixture。 */
function 映射变体(改写: (建议: BFF简历预填建议) => void): BFF简历预填建议 {
  const 副本 = 构造映射变体基底();
  改写(副本);
  return 副本;
}

/** 空页面（四列表全空）——预填物化的正向用例基线；每次返回新数组，测试间互不影响 */
function 空列表页(): { 经历: 简历经历段[]; 教育: 简历教育段[]; 技能: string[]; 证书: 简历证书[] } {
  return { 经历: [], 教育: [], 技能: [], 证书: [] };
}

/** review fix-1（契约B 写前完备性预检）：Backend 保存类用例的经历行需可存齐
 *  （行业引用 + 组织编号）—— 沿用共享种子行，仅补目录引用。 */
const 完整经历行: 简历经历段 = {
  ...简历经历初始[0],
  行业引用: { id: 'tax_i', display_name: '互联网' },
};

/** 合同 C：经历编辑页里打开公司抽屉并选中指定行（搜索词由旧公司文本预填） */
async function 抽屉选公司(
  用户: ReturnType<typeof userEvent.setup>,
  搜索组织: ReturnType<typeof vi.fn>,
  行名称: string,
) {
  await 用户.click(screen.getByText('公司名称'));
  const 抽屉 = await screen.findByRole('dialog', { name: '选择企业' });
  void 搜索组织;
  // 250ms debounce 后搜索结果才上屏：等行出现再点（同时覆盖搜索词预填触发搜索）
  await 用户.click(await within(抽屉).findByText(行名称));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择企业' })).toBeNull());
}

/** DF-002：两条缺公司/行业的物化建议 —— 第一条公司原文缺失，第二条公司原文在而缺组织 ID。 */
function 双缺项建议(): BFF简历预填建议 {
  return 映射变体((建议) => {
    建议.draft.experiences[0].company = { value: null, confidence: null };
    建议.draft.experiences[0].industry = {
      source_name: { value: 'Software', confidence: 'medium' },
      resolution: 'unresolved',
      match: null,
    };
    建议.draft.experiences.push(structuredClone(建议.draft.experiences[0]));
    建议.draft.experiences[1].company = { value: 'Second Corp', confidence: 'high' };
    建议.draft.experiences[1].industry = {
      source_name: { value: 'Finance', confidence: 'medium' },
      resolution: 'unresolved',
      match: null,
    };
    建议.draft.experiences[1].title = { value: 'Second Engineer', confidence: 'high' };
    建议.draft.experiences[1].start_month = { value: '2020-03', confidence: 'high' };
  });
}


// Task 2（onboarding 修复）：保存 single-flight —— 保存中按钮禁用并显示「保存中…」，
// 重复点击只发一次 保存简历；权威保存完成后才 轻提示('简历已保存') 并跳转下一屏；
// 失败不跳转，按钮恢复为「保存」。仓库未装 jest-dom，断言一律读原生 DOM。
describe('工作经历 保存 single-flight', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
  });

  it('保存中按钮禁用显示保存中，重复点击只保存一次，成功后轻提示并跳转', async () => {
    let resolve保存!: () => void;
    const 保存简历 = vi.fn(() => new Promise<void>((resolve) => { resolve保存 = resolve; }));
    render工作经历({ 数据源: 'mock', 保存简历 });
    const 用户 = userEvent.setup();
    const 保存键 = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement;
    await 用户.click(保存键);
    expect(保存简历).toHaveBeenCalledTimes(1);
    // 引导旅程不传保存来源（缺省 = onboarding 跟踪语义）
    expect(保存简历.mock.calls[0]).toHaveLength(1);
    expect(保存键.disabled).toBe(true);
    expect(保存键.textContent).toBe('保存中…');
    // 再点一次：disabled + single-flight 守卫，不再发保存
    await 用户.click(保存键);
    expect(保存简历).toHaveBeenCalledTimes(1);
    // 权威保存完成后才提示并跳转（在职 → 引导问答）
    await act(async () => { resolve保存(); });
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('简历已保存'));
    expect(mock跳转).toHaveBeenCalledWith(路径.引导问答);
  });

  it('保存失败不跳转，轻提示错误文案，按钮恢复为保存', async () => {
    let reject保存!: (错误: unknown) => void;
    const 保存简历 = vi.fn(() => new Promise<void>((_resolve, reject) => { reject保存 = reject; }));
    render工作经历({ 数据源: 'mock', 保存简历 });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    const 保存中键 = screen.getByRole('button', { name: '保存中…' }) as HTMLButtonElement;
    expect(保存中键.disabled).toBe(true);
    await act(async () => { reject保存(new Error('网络失败')); });
    // P0 修复 Task 6：普通本地 Error 落通用请求失败文案（不冒充网络，也不泄露 message）
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('请求失败，请稍后再试'));
    expect(mock轻提示).not.toHaveBeenCalledWith('网络失败');
    expect(mock跳转).not.toHaveBeenCalled();
    const 恢复键 = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement;
    expect(恢复键.disabled).toBe(false);
    expect(恢复键.textContent).toBe('保存');
  });
});

// ── 简历编辑显式来源（Task 1 / Task 2）：from=resume 是唯一日常编辑标记 ──
// 我的简历 → 在线简历 分区/条目的日常编辑：旅程判定为 false（编辑标记赢过 引导预填：
// 零建档草稿、零分区确认），条目「保存」走完整保存链一次提交；失败留页，零建议物化。
describe('工作经历 · 简历编辑来源（from=resume）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock替换跳转.mockClear();
    mock轻提示.mockClear();
    mock确认分区.mockClear();
    mock更新草稿.mockClear();
    window.history.replaceState(null, '');
  });

  /** 带合法来路证明的日常条目入口（来源格号 +1 = 本会话从我的简历 push 进来） */
  function 日常入口(search: string): 入口形 {
    window.history.replaceState({ idx: 4, key: 'k4', usr: null }, '');
    const 来路 = 创建候选编辑来路('resume');
    window.history.replaceState({ idx: 5, key: 'k5', usr: null }, '');
    return { pathname: 路径.工作经历, search, state: 来路 };
  }

  it('社招条目编辑：保存带 日常编辑 来源，成功只回我的简历，零分区确认零建档草稿', async () => {
    // 建档在场：证明编辑标记赢过 引导预填 非空 —— 旅程判定必须为 false
    const 保存简历 = vi.fn(async (_next?: unknown, _来源?: string) => {});
    render工作经历({
      保存简历, 建档: { 资料: { 个人优势: '旧' } }, 经历: [完整经历行],
      入口: 日常入口('?from=resume&section=work&item=e1'),
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(保存简历.mock.calls[0][1]).toBe('日常编辑'); // fix-r1：显式绕过 onboarding 跟踪
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('简历已保存'));
    await waitFor(() => expect(mock返回).toHaveBeenCalledTimes(1));
    expect(mock跳转).not.toHaveBeenCalledWith(路径.引导问答);
    expect(mock跳转).not.toHaveBeenCalledWith(路径.求职状态);
    expect(mock确认分区).not.toHaveBeenCalled();
    expect(mock更新草稿).not.toHaveBeenCalled();
  });

  it('学生条目编辑：保存成功同样只回我的简历（不进求职状态）', async () => {
    render工作经历({
      基本信息: { 真名: '沈', 开始工作年: '', 身份: '在校' },
      经历: [完整经历行],
      入口: 日常入口('?from=resume&section=work&item=e1'),
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('简历已保存'));
    await waitFor(() => expect(mock返回).toHaveBeenCalledTimes(1));
    expect(mock跳转).not.toHaveBeenCalledWith(路径.求职状态);
    expect(mock确认分区).not.toHaveBeenCalled();
  });

  it('保存失败：轻提示并留在本页，零分区确认零退出', async () => {
    const 保存简历 = vi.fn(async () => { throw new Error('网络失败'); });
    render工作经历({
      保存简历, 经历: [完整经历行],
      入口: 日常入口('?from=resume&section=work&item=e1'),
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('请求失败，请稍后再试'));
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).not.toHaveBeenCalled();
    expect(mock确认分区).not.toHaveBeenCalled();
  });

  it('编辑模式零建议物化：ready 轮在场也不写根草稿', () => {
    const { 派发 } = render工作经历({
      预填: readyWork(), ...空列表页(),
      入口: 日常入口('?from=resume&section=work'),
    });
    expect(存简历调用们(派发)).toHaveLength(0);
  });
});

describe('工作经历 候选 onboarding 预填（Spec §8）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
    mock确认分区.mockClear();
  });

  it('空服务端且空页面时物化四分区：经历卡（隐私默认不隐藏）/技能标签/证书行（年份空不渲染）', () => {
    render工作经历({ 预填: readyWork(), ...空列表页() });
    // 经历卡：公司/职位来自建议；契约B —— 徽标按有效企业屏蔽派生，物化默认 隐藏:false
    // 且无任何屏蔽记录：不显示「已对该公司隐身」
    expect(screen.getByText('Example Systems')).toBeTruthy();
    expect(screen.getByText('Backend Engineer')).toBeTruthy();
    expect(screen.queryByText('已对该公司隐身')).toBeNull();
    // 技能标签 / 证书行（year:null → 页面空串 → 不渲染「年取得」）
    expect(screen.getByText('Go')).toBeTruthy();
    expect(screen.getByText('Synthetic Cloud Certificate')).toBeTruthy();
    expect(screen.queryByText(/年取得/)).toBeNull();
  });

  it('物化条目带 prefill: 临时编号（不匹配服务端 ID grammar）、exact 行业引用、证书空年份', () => {
    const { 派发 } = render工作经历({ 预填: readyWork(), ...空列表页() });
    const 种入 = 存简历调用们(派发);
    expect(种入).toHaveLength(1);
    const 段 = 种入[0].经历[0];
    expect(段.编号).toBe('prefill:exp:0');
    expect(段.编号.startsWith('prefill:')).toBe(true);
    expect(/^[a-z]{2,4}_[0-9a-f]{32}$/.test(段.编号)).toBe(false);
    expect(段.行业引用).toEqual({ id: 'tax_aaaaaaaaaaaaaaaaaaaaaaaaaa', display_name: 'Software' });
    // 契约B：解析预填沿用新建段默认 隐藏:false —— 企业屏蔽不再误写成公司名遮蔽
    expect(段.隐藏).toBe(false);
    expect(种入[0].技能).toEqual(['Go']);
    expect(种入[0].证书).toEqual([{ 编号: 'prefill:cer:0', 名称: 'Synthetic Cloud Certificate', 年份: '' }]);
  });

  it('internship 缺席保持未设置', () => {
    const { 派发 } = render工作经历({
      预填: readyWork({}, 映射变体((建议) => {
        建议.draft.experiences[0].internship = { value: null, confidence: null };
      })),
      ...空列表页(),
    });
    const 段 = 存简历调用们(派发)[0].经历[0];
    expect('实习' in 段).toBe(false);
  });

  it('parser 顺序保持：多条经历按原顺序物化', () => {
    render工作经历({
      预填: readyWork({}, 映射变体((建议) => {
        建议.draft.experiences.push(structuredClone(建议.draft.experiences[0]));
        建议.draft.experiences[1].company = { value: 'Second Corp', confidence: 'high' };
        建议.draft.experiences[1].industry = {
          source_name: { value: 'Finance', confidence: 'medium' },
          resolution: 'unresolved',
          match: null,
        };
      })),
      ...空列表页(),
    });
    const 第一 = screen.getByText('Example Systems');
    const 第二 = screen.getByText('Second Corp');
    expect(第一.compareDocumentPosition(第二) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not append parsed experiences to an existing server list', () => {
    const existing: 简历经历段 = {
      编号: 'exp_server_1', 公司: '现有公司', 行业: '软件', 职位: '工程师',
      开始: '2024-01', 结束: null, 内容: '', 隐藏: true,
    };
    render工作经历({ 预填: readyWork({ experiencesEligible: false }), 经历: [existing] });
    expect(screen.getByText(existing.公司)).toBeTruthy();
    expect(screen.queryByText('Example Systems')).toBeNull();
  });

  it('附加教育：保留前四页形成的第 0 条并追加 slice(1)（eligibility true 且无既有附加条）', () => {
    const 主段: 简历教育段 = { 编号: 'edu_local_0', 学校: '清华大学', 学历: '本科', 专业: '计算机', 开始: '2017-09', 结束: '2021-06' };
    const { 派发 } = render工作经历({ 预填: readyWork({}, 多条教育变体()), 经历: [], 教育: [主段], 技能: [], 证书: [] });
    // 第 0 条原样保留，附加教育物化为第二张卡
    expect(screen.getByText('清华大学')).toBeTruthy();
    expect(screen.getByText('Example Graduate School')).toBeTruthy();
    expect(screen.getByText('硕士 · Distributed Systems')).toBeTruthy();
    const 教育 = 存简历调用们(派发)[0].教育;
    expect(教育).toHaveLength(2);
    expect(教育[0]).toEqual(主段);
    expect(教育[1].编号).toBe('prefill:edu:1');
  });

  it('当前已有任何附加教育时不追加（非空页面列表不合并）', () => {
    const 主段: 简历教育段 = { 编号: 'edu_local_0', 学校: 'A 大学', 学历: '本科', 专业: 'B', 开始: '2017-09', 结束: '2021-06' };
    const 附加: 简历教育段 = { 编号: 'edu_local_1', 学校: 'C 大学', 学历: '硕士', 专业: 'D', 开始: '2021-09', 结束: '' };
    const { 派发 } = render工作经历({
      预填: readyWork({}, 多条教育变体()),
      经历: [], 教育: [主段, 附加], 技能: [], 证书: [],
    });
    expect(screen.queryByText('Example Graduate School')).toBeNull();
    // 教育分区无变化：种入派发不发生（技能/证书仍物化，但教育列表原样）
    const 种入 = 存简历调用们(派发);
    expect(种入[0].教育).toEqual([主段, 附加]);
  });

  it('educations 非空（服务端已有教育）时附加教育不追加', () => {
    const 主段: 简历教育段 = { 编号: 'edu_local_0', 学校: 'A 大学', 学历: '本科', 专业: 'B', 开始: '2017-09', 结束: '2021-06' };
    render工作经历({
      预填: readyWork({ educationsEligible: false }, 多条教育变体()),
      经历: [], 教育: [主段], 技能: [], 证书: [],
    });
    expect(screen.queryByText('Example Graduate School')).toBeNull();
    expect(screen.getByText('A 大学')).toBeTruthy();
  });

  it('unresolved 行业只留 source_name 文本并无引用；保存点击只用 轻提示 报「还有 1 处」', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({
      预填: readyWork({}, 映射变体((建议) => {
        建议.draft.experiences[0].industry = {
          source_name: { value: 'Software', confidence: 'medium' },
          resolution: 'unresolved',
          match: null,
        };
      })),
      ...空列表页(),
      保存简历,
    });
    const 用户 = userEvent.setup();
    // unresolved 条目仍按原文显示（不静默丢弃）
    expect(screen.getByText('Software')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    // unresolvedCount 只进既有保存点击的 轻提示：拦下保存，不渲染任何提示节点
    expect(mock轻提示).toHaveBeenCalledWith('还有 1 处需要选择目录或补充必填项');
    expect(保存简历).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    // 物化条目无 canonical 引用（不猜 ID）
    const 段 = 存简历调用们(mock应用状态.派发)[0].经历[0];
    expect('行业引用' in 段).toBe(false);
  });

  // review Issue 1：保存拦截必须对当前列表实时重数 —— 挂载时冻结的 unresolvedCount
  // 在用户补齐物化条目后仍非零，会把已经无未完成项的保存一直拦到离开页面为止。
  it('补齐建议条目（编辑页选 canonical 行业并选真实企业 ID）后再保存放行：重数当前列表而非挂载冻结值', async () => {
    const 保存简历 = vi.fn(async () => {});
    const 搜索组织 = vi.fn(async () => ({
      items: [{
        organization_id: 'org_example', display_name: 'Example Systems',
        legal_name: null, verification_status: 'unverified' as const,
      }],
      next_cursor: null,
    }));
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        return {
          items: [
            { id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false, has_children: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'ind_fin') {
        return {
          items: [
            { id: 'ind_pay', display_name: '支付与清结算', parent_id: 'ind_fin', selectable: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render工作经历({
      预填: readyWork({}, 映射变体((建议) => {
        建议.draft.experiences[0].industry = {
          source_name: { value: 'Software', confidence: 'medium' },
          resolution: 'unresolved',
          match: null,
        };
      })),
      ...空列表页(),
      保存简历,
      查询Taxonomy,
      搜索组织,
    });
    const 用户 = userEvent.setup();
    // 第一次保存：确实还有 1 处未完成，被拦
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock轻提示).toHaveBeenCalledWith('还有 1 处需要选择目录或补充必填项');
    expect(保存简历).not.toHaveBeenCalled();
    // 第一次保存的拦截提示已断言过；清零后再走补齐流程，断言只看后续调用
    mock轻提示.mockClear();
    // 进编辑页补 canonical 行业（完成守卫要求 行业引用）
    await 用户.click(screen.getByText('Example Systems'));
    await 用户.click(screen.getByText('所属行业'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    await 用户.click(await screen.findByText('金融科技'));
    await 用户.click(await screen.findByText('支付与清结算'));
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    // 合同 C：再补真实企业 ID（缺 ID 的条目仍不能完成）
    await 用户.click(screen.getByText('Example Systems'));
    await 抽屉选公司(用户, 搜索组织, 'Example Systems');
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    // 回列表再保存：无未完成项，放行（不再被挂载时冻结的计数拦下）
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(mock轻提示).not.toHaveBeenCalledWith('还有 1 处需要选择目录或补充必填项');
    expect(保存简历).toHaveBeenCalledWith(expect.objectContaining({
      经历: [expect.objectContaining({ 组织编号: 'org_example' })],
    }));
  });

  it('删除未完成的建议条目后重数实时下降：缺 ID 的条目不放行，删完才清零', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({
      预填: readyWork({}, 映射变体((建议) => {
        建议.draft.experiences.push(structuredClone(建议.draft.experiences[0]));
        建议.draft.experiences[1].company = { value: 'Second Corp', confidence: 'high' };
        建议.draft.experiences[1].industry = {
          source_name: { value: 'Finance', confidence: 'medium' },
          resolution: 'unresolved',
          match: null,
        };
      })),
      ...空列表页(),
      保存简历,
    });
    const 用户 = userEvent.setup();
    // 两条物化经历都还没有真实企业 ID：还有 2 处，先被拦
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock轻提示).toHaveBeenCalledWith('还有 2 处需要选择目录或补充必填项');
    // DF-002：拦截同时自动打开了第一条编辑页 —— 返回列表再按原意图删第二条
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    // 删除未完成的第二条：第一条仍缺 ID，重数实时降到 1 处
    await 用户.click(screen.getByText('Second Corp'));
    await 用户.click(screen.getByText('删除这段经历'));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock轻提示).toHaveBeenCalledWith('还有 1 处需要选择目录或补充必填项');
    expect(保存简历).not.toHaveBeenCalled();
    // 缺 ID 的条目不能直接跳过再报告完成：删完才放行（这次拦截自动打开的就是
    // 唯一剩下的第一条，就地删除）
    await 用户.click(screen.getByText('删除这段经历'));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    const 存入 = 存简历调用们(mock应用状态.派发);
    expect(存入.at(-1)!.经历).toHaveLength(0);
  });

  it('exact 行业引用并选中真实企业 ID 后保存照常发生', async () => {
    const 保存简历 = vi.fn(async () => {});
    const 搜索组织 = vi.fn(async () => ({
      items: [{
        organization_id: 'org_example', display_name: 'Example Systems',
        legal_name: null, verification_status: 'unverified' as const,
      }],
      next_cursor: null,
    }));
    render工作经历({ 预填: readyWork(), ...空列表页(), 保存简历, 搜索组织 });
    const 用户 = userEvent.setup();
    // 解析预填不自动搜索首命中／创建：物化阶段零目录请求，缺 ID 先被拦
    expect(搜索组织).not.toHaveBeenCalled();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock轻提示).toHaveBeenCalledWith('还有 1 处需要选择目录或补充必填项');
    mock轻提示.mockClear();
    // 进编辑页选真实企业 ID 后放行
    await 用户.click(screen.getByText('Example Systems'));
    await 抽屉选公司(用户, 搜索组织, 'Example Systems');
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(mock轻提示).not.toHaveBeenCalledWith(expect.stringContaining('需要选择目录'));
    // 保存携带物化条目（prefill: 临时编号 + 新建默认 隐藏:false + 真实企业 ID）与物化技能
    expect(保存简历).toHaveBeenCalledWith(expect.objectContaining({
      经历: [expect.objectContaining({ 编号: 'prefill:exp:0', 隐藏: false, 组织编号: 'org_example' })],
      技能: ['Go'],
    }));
  });

  // 契约B：hidden 是既有 wire/本地字段 —— 旧经历原值在无关保存时保留，不批量清空也不顺手改写
  it('旧经历 hidden=true 与企业屏蔽无关：保存原样携带 true', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({
      数据源: 'backend',
      保存简历,
      经历: [{ ...简历经历初始[0], 行业引用: { id: 'tax_i', display_name: '互联网' } }],
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(保存简历).toHaveBeenCalledWith(expect.objectContaining({
      经历: [expect.objectContaining({ 隐藏: true })],
    }));
  });

  it('正常流程只物化一次：种入派发恰好一条，重渲染不重复种入', async () => {
    const { 派发, 重渲染 } = render工作经历({ 预填: readyWork(), ...空列表页() });
    expect(存简历调用们(派发)).toHaveLength(1);
    // 列表更新引发的自动重渲染之外，再显式触发一次重渲染：仍只有一条种入
    await act(async () => { 重渲染(); });
    expect(存简历调用们(派发)).toHaveLength(1);
  });

  it('保存成功后确认 work 分区（先于跳转），保存携带物化条目', async () => {
    const 保存简历 = vi.fn(async () => {});
    const 搜索组织 = vi.fn(async () => ({
      items: [{
        organization_id: 'org_example', display_name: 'Example Systems',
        legal_name: null, verification_status: 'unverified' as const,
      }],
      next_cursor: null,
    }));
    render工作经历({ 预填: readyWork(), ...空列表页(), 保存简历, 搜索组织 });
    const 用户 = userEvent.setup();
    // 合同 C：物化条目缺真实企业 ID 时保存被拦，选中后才放行
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock确认分区).not.toHaveBeenCalled();
    await 用户.click(screen.getByText('Example Systems'));
    await 抽屉选公司(用户, 搜索组织, 'Example Systems');
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock确认分区).toHaveBeenCalledWith('work'));
    expect(mock确认分区.mock.invocationCallOrder[0]).toBeLessThan(mock跳转.mock.invocationCallOrder[0]);
    expect(mock跳转).toHaveBeenCalledWith(路径.引导问答);
  });

  it('保存被拒时 work 分区不确认、不跳转', async () => {
    const 保存简历 = vi.fn(async () => {
      throw new Error('保存失败');
    });
    const 搜索组织 = vi.fn(async () => ({
      items: [{
        organization_id: 'org_example', display_name: 'Example Systems',
        legal_name: null, verification_status: 'unverified' as const,
      }],
      next_cursor: null,
    }));
    render工作经历({ 预填: readyWork(), ...空列表页(), 保存简历, 搜索组织 });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('Example Systems'));
    await 抽屉选公司(用户, 搜索组织, 'Example Systems');
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalled());
    expect(保存简历).toHaveBeenCalledTimes(1);
    expect(mock确认分区).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it.each([
    ['manual 轮', (轮: 候选预填状态) => { 轮.phase = 'manual'; }],
    ['work 已确认', (轮: 候选预填状态) => { 轮.confirmed.work = true; }],
    ['inactive 轮（无建议）', null],
  ])('%s 保留旧初始化（零种入派发）', (_名, 改) => {
    const 轮 = readyWork();
    if (改) 改(轮);
    const { 派发 } = render工作经历({ 预填: 改 ? 轮 : undefined, ...空列表页() });
    expect(screen.queryByText('Example Systems')).toBeNull();
    expect(screen.queryByText('Go')).toBeNull();
    expect(派发).not.toHaveBeenCalled();
  });
});

// ── DF-002：卡片缺项提示与保存首错定位 ──
// 折叠卡可发现（待补充行）、保存不发无效总保存而直接进入第一条不完整经历并聚焦首错
// 控件、字段旁可见提示、修正/删除后实时重算、只有教育/证书缺项时保留既有拦截。
describe('工作经历 DF-002 缺项提示与保存首错定位', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
    mock确认分区.mockClear();
    mock更新草稿.mockClear();
  });

  it('两张折叠卡按缺项数组显示具体提示；公司原文在而缺组织 ID 显示「请从目录选择公司」', () => {
    render工作经历({ 预填: readyWork({}, 双缺项建议()), ...空列表页() });
    const 提示们 = screen.getAllByText(/^待补充：/);
    expect(提示们).toHaveLength(2);
    expect(提示们[0].textContent).toBe('待补充：公司、行业');
    expect(提示们[1].textContent).toBe('待补充：请从目录选择公司、行业');
  });

  it('点保存打开第一条不完整经历、首错「公司」控件获焦、字段旁提示可见，不发无效保存', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({ 预填: readyWork({}, 双缺项建议()), ...空列表页(), 保存简历 });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock轻提示).toHaveBeenCalledWith('还有 2 处需要选择目录或补充必填项');
    expect(保存简历).not.toHaveBeenCalled();
    // 打开的是第一条（解析职位 Backend Engineer），不是第二条
    expect((screen.getByPlaceholderText('必填') as HTMLInputElement).value).toBe('Backend Engineer');
    // 首错 = 公司：挂载后聚焦其选择触发按钮（不自动弹目录）
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /公司名称/ }));
    expect(screen.queryByRole('dialog', { name: '选择企业' })).toBeNull();
    // 字段附近可见提示，不能只靠短 toast
    expect(screen.getByText('待补充：公司')).toBeTruthy();
    expect(screen.getByText('待补充：行业')).toBeTruthy();
  });

  it('修正第一条后提示实时消失、下一次保存定位第二条；删除后保存放行且草稿不丢', async () => {
    const 保存简历 = vi.fn(async () => {});
    const 搜索组织 = vi.fn(async () => ({
      items: [{
        organization_id: 'org_example', display_name: 'Example Systems',
        legal_name: null, verification_status: 'unverified' as const,
      }],
      next_cursor: null,
    }));
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (!query.parentId && !query.q) {
        return {
          items: [
            { id: 'ind_fin', display_name: '金融科技', parent_id: null, selectable: false, has_children: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      if (query.parentId === 'ind_fin') {
        return {
          items: [
            { id: 'ind_pay', display_name: '支付与清结算', parent_id: 'ind_fin', selectable: true },
          ],
          nextCursor: null,
          catalogVersion: 'v2',
        };
      }
      return { items: [], nextCursor: null, catalogVersion: 'v2' };
    });
    render工作经历({
      预填: readyWork({}, 双缺项建议()),
      ...空列表页(),
      保存简历,
      查询Taxonomy,
      搜索组织,
    });
    const 用户 = userEvent.setup();
    // 首存：自动打开第一条；先手改解析职位（草稿随完成一并落列表，不丢已填内容）
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await 用户.type(screen.getByPlaceholderText('必填'), '2');
    // 第一条解析公司为空：抽屉里手动输入搜索词再选（不自动匹配解析文本）
    await 用户.click(screen.getByText('公司名称'));
    const 抽屉 = await screen.findByRole('dialog', { name: '选择企业' });
    await 用户.type(within(抽屉).getByPlaceholderText('输入公司名称'), 'Example');
    await 用户.click(await within(抽屉).findByText('Example Systems'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择企业' })).toBeNull());
    await 用户.click(screen.getByText('所属行业'));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    await 用户.click(await screen.findByText('金融科技'));
    await 用户.click(await screen.findByText('支付与清结算'));
    // 编辑页缺项提示随补齐实时消失
    expect(screen.queryByText('待补充：公司')).toBeNull();
    expect(screen.queryByText('待补充：行业')).toBeNull();
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    // 列表重算：第一条不再提示，第二条仍可发现
    expect(screen.getByText('待补充：请从目录选择公司、行业')).toBeTruthy();
    expect(screen.queryByText('待补充：公司、行业')).toBeNull();
    // 下一次保存定位下一条：第二条（解析字段原样保留），公司原文在 → 提示选择目录
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(mock轻提示).toHaveBeenLastCalledWith('还有 1 处需要选择目录或补充必填项');
    expect((screen.getByPlaceholderText('必填') as HTMLInputElement).value).toBe('Second Engineer');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /公司名称/ }));
    expect(screen.getByText('请从目录选择公司')).toBeTruthy();
    // 删除第二条后重算归零：保存放行，第一条连同手改职位一起提交
    await 用户.click(screen.getByText('删除这段经历'));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(保存简历).toHaveBeenCalledWith(expect.objectContaining({
      经历: [expect.objectContaining({ 组织编号: 'org_example', 职位: 'Backend Engineer2' })],
    }));
  });

  it('只剩教育/证书缺项时保留现有拦截：不打开完整工作经历', async () => {
    const 保存简历 = vi.fn(async () => {});
    // 完整的预填经历（带 canonical 行业引用与真实企业 ID）
    const 完整经历段: 简历经历段 = {
      编号: 'prefill:exp:0', 公司: 'Example Systems', 行业: 'Software',
      行业引用: { id: 'tax_aaaaaaaaaaaaaaaaaaaaaaaaaa', display_name: 'Software' },
      组织编号: 'org_example', 职位: 'Backend Engineer', 开始: '2021-07', 结束: null, 内容: '', 隐藏: true,
    };
    const 主段: 简历教育段 = { 编号: 'edu_local_0', 学校: '清华大学', 学历: '本科', 专业: '计算机', 开始: '2017-09', 结束: '2021-06' };
    render工作经历({
      预填: readyWork({}, 多条教育变体()),
      经历: [完整经历段], 教育: [主段], 技能: [], 证书: [],
      保存简历,
    });
    // 完整经历无缺项提示
    expect(screen.queryByText(/^待补充：/)).toBeNull();
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    // 仍由既有拦截拦下（计数含附加教育），但不误打开完整工作经历
    expect(mock轻提示).toHaveBeenCalledWith('还有 1 处需要选择目录或补充必填项');
    expect(保存简历).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /添加工作经历/ })).toBeTruthy();
    expect(screen.queryByPlaceholderText('必填')).toBeNull();
  });
});

// ── M：空身份 + /basic 本地姓名草稿 —— 完整经历保存仍交给 操作.保存简历，
//    页面不自行把身份补成「在职」（profile 分区由数据源跳过，身份在状态页收口） ──
describe('工作经历 · 空身份经历保存（M）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
  });

  it('空身份 + 本地姓名草稿：保存简历 携带空身份原样，不虚构在职', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({
      数据源: 'backend',
      保存简历,
      经历: [完整经历行],
      基本信息: { 真名: '沈', 开始工作年: '', 身份: '' },
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(保存简历).toHaveBeenCalledWith(expect.objectContaining({
      基本信息: expect.objectContaining({ 真名: '沈', 身份: '' }),
      经历: [expect.objectContaining({ 编号: 'e1', 公司: '字节跳动' })],
    }));
  });
});

describe('工作经历 · Task 4 资料接线', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
    mock确认分区.mockClear();
    mock更新草稿.mockClear();
  });

  it('社招零工作经历也能保存并前进（工作经历可空）', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({ 经历: [], 教育: [完整教育], 保存简历 });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(保存简历).toHaveBeenCalledWith(expect.objectContaining({ 经历: [] }));
    expect(mock轻提示).not.toHaveBeenCalledWith('至少填一段工作经历');
    expect(mock跳转).toHaveBeenCalledWith(路径.引导问答);
  });

  it('教育缺毕业时间：保存被拦，不发写入、不确认分区、不跳转', async () => {
    const 保存简历 = vi.fn(async () => {});
    // 经历非空：这条反例针对的是教育门槛本身，不借「至少一段工作经历」的旧拦截
    render工作经历({ 教育: [{ ...完整教育, 结束: '' }], 保存简历, 建档: {} });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(保存简历).not.toHaveBeenCalled();
    expect(mock确认分区).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock轻提示).toHaveBeenCalled();
  });

  it('作品集链接未改：保存不带该属性（不拿旧 GET 顺带覆盖）', async () => {
    const 保存简历 = vi.fn(async (_写入: Record<string, unknown>) => {});
    render工作经历({ 经历: [], 教育: [完整教育], 保存简历 });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect('作品集链接' in 保存简历.mock.calls[0][0]).toBe(false);
  });

  it('作品集链接单独改动：写进草稿并随保存带上规范化后的字符串', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({ 经历: [], 教育: [完整教育], 保存简历, 建档: {} });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByLabelText('作品集或项目链接'), 'github.com/shen');
    await 用户.tab();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(保存简历).toHaveBeenCalledWith(expect.objectContaining({
      作品集链接: 'https://github.com/shen',
      // 链接单独变化也要保留 profile 其余字段
      基本信息: expect.objectContaining({ 真名: '沈' }),
    }));
  });

  it('清空已有作品集链接：保存带 null（明确清空，不是省略）', async () => {
    const 保存简历 = vi.fn(async (_写入: Record<string, unknown>) => {});
    render工作经历({
      经历: [], 教育: [完整教育], 保存简历, 作品集链接: 'https://github.com/shen', 建档: {},
    });
    const 用户 = userEvent.setup();
    await 用户.clear(screen.getByLabelText('作品集或项目链接'));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(保存简历.mock.calls[0][0]).toEqual(expect.objectContaining({ 作品集链接: null }));
  });

  it('日常编辑（无旅程标记）不受教育门槛影响：结束为空是「至今在读」，照常保存', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({ 经历: [完整经历行], 教育: [{ ...完整教育, 结束: '' }], 保存简历 });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
  });

  // review-r1 关键反例：日常编辑走的是真实次序 —— 先进编辑层敲字（编辑层的 effect
  // 每次输入都会试图写 编辑中），再回列表保存。判据只要一落到「有没有草稿」上，
  // 这一串就会自己把草稿造出来，然后 简历域保存 改走单槽 + 缺项保护那条路。
  it('日常编辑真实次序：进经历编辑页敲字→回列表→保存，不生草稿、教育门槛不误伤「至今在读」', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({ 经历: [完整经历行], 教育: [{ ...完整教育, 结束: '' }], 保存简历 });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.type(screen.getAllByPlaceholderText('必填')[0], '改');
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(mock更新草稿).not.toHaveBeenCalled();
    expect(mock轻提示).not.toHaveBeenCalledWith(expect.stringContaining('教育经历还缺'));
    expect(mock跳转).toHaveBeenCalled();
  });

  it('日常编辑删除一段经历：不登记明确删除条目、不生草稿，保存照原样发空经历列表', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({
      经历: [{ ...简历经历初始[0], 编号: 'exp_server' }],
      教育: [完整教育],
      保存简历,
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByRole('button', { name: '删除这段经历' }));
    expect(mock更新草稿).not.toHaveBeenCalled();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    // 没有草稿 → 简历域保存 走「非 onboarding 原路径」，删除按原 diff 生效，
    // 不经 准备写入 的缺项保护被带回来
    expect(保存简历).toHaveBeenCalledWith(expect.objectContaining({ 经历: [] }));
  });

  it('只是聚焦再离开作品集输入框：不算修改，保存仍不带该属性', async () => {
    const 保存简历 = vi.fn(async (_写入: Record<string, unknown>) => {});
    render工作经历({ 经历: [], 教育: [完整教育], 保存简历, 作品集链接: 'https://github.com/shen' });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByLabelText('作品集或项目链接'));
    await 用户.tab();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect('作品集链接' in 保存简历.mock.calls[0][0]).toBe(false);
  });

  it('刷新恢复未完成的教育编辑层：挂载即回到编辑页并带回已填字段', async () => {
    render工作经历({
      经历: [], 教育: [],
      建档: {
        编辑中: { 种类: 'education', 本地编号: 'edu新', 字段: { 学校: '复旦大学', 专业: '计算机' } },
      },
    });
    // Task 2 起 学校/专业 是字段点击行（不再有输入框）：草稿回显看行值
    expect(screen.getByRole('button', { name: /学校名称/ }).textContent).toContain('复旦大学');
    expect(screen.getByRole('button', { name: /^专业/ }).textContent).toContain('计算机');
  });

  it('取消编辑层明确丢弃 编辑中（回带其余草稿字段）', async () => {
    render工作经历({
      经历: [], 教育: [],
      建档: {
        资料: { 技能: ['Go'] },
        编辑中: { 种类: 'education', 本地编号: 'edu新', 字段: { 学校: '复旦大学' } },
      },
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    const 末次 = mock更新草稿.mock.calls.at(-1)![0];
    expect('编辑中' in 末次).toBe(false);
    expect(末次.资料.技能).toEqual(['Go']);
    // 丢弃是明确的：同一条再打开也不能把刚丢掉的输入翻出来
    await 用户.click(screen.getByRole('button', { name: /添加教育经历/ }));
    expect(screen.getByRole('button', { name: /学校名称/ }).textContent).not.toContain('复旦大学');
  });

  it('经历编辑页输入即写 编辑中（不带 项目，回带未结算写入槽）', async () => {
    const 槽 = { 种类: 'profile' as const, 幂等键: 'k1', 阶段: 'prepared' as const };
    render工作经历({ 经历: [], 教育: [完整教育], 建档: { 待写入: 槽 } });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: /添加工作经历/ }));
    // 公司名称已改为抽屉选择（合同 C）；编辑层输入以 职位名称 验证
    await 用户.type(screen.getByPlaceholderText('必填'), '后端开发');
    const 末次 = mock更新草稿.mock.calls.at(-1)![0];
    expect(末次.编辑中.种类).toBe('experience');
    expect(末次.编辑中.字段.职位).toBe('后端开发');
    expect('项目' in 末次.编辑中.字段).toBe(false);
    expect(末次.待写入).toEqual(槽);
  });

  it('删除已存条目：登记 明确删除条目，保存时不会被缺项保护带回', async () => {
    render工作经历({
      经历: [{ ...简历经历初始[0], 编号: 'exp_server' }],
      教育: [完整教育],
      建档: {
        已存条目: [{ 本地编号: 'e1', 种类: 'experience', 资源编号: 'exp_server', revision: 2 }],
      },
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.click(screen.getByRole('button', { name: '删除这段经历' }));
    const 末次 = mock更新草稿.mock.calls.at(-1)![0];
    expect(末次.明确删除条目).toEqual([
      { 种类: 'experience', 资源编号: 'exp_server', revision: 2 },
    ]);
  });
});

// ── 聚合资料页的个人优势（Task 3 合同 C / Spec §3.3）：优势正文从向导偏好段迁到
//    简历资料页（onboarding 聚合页）。初值只认「已水合权威现值 / 建档草稿里用户明确
//    输入过的值」，当前轮真实建议（ready + eligible + 未确认）只在二者皆空时种入；
//    用户已输入（含清空后的空串）不被迟到建议覆盖。聚合保存链在简历写入成功后写
//    个人优势、成功才确认 summary 并进补充偏好（引导问答）；优势失败留页保留输入。
const 建议优势文本 = 'Builds reliable synthetic systems.';
const 提取说明 = '已根据你上传的简历预先提取，直接删改即可。';
const 中性说明 = '可以介绍你的经验、技能和擅长的事情。';

/** 个人优势正文的 textarea（共用组件冻结的 aria-label） */
function 优势框(): HTMLTextAreaElement {
  return screen.getByLabelText('个人优势') as HTMLTextAreaElement;
}

describe('工作经历 · 聚合资料页个人优势（Task 3）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
    mock确认分区.mockClear();
    mock更新草稿.mockClear();
  });

  it('聚合资料页挂上个人优势正文：初值取已水合现值，无当前轮建议时无恢复动作', () => {
    render工作经历({
      经历: [], 教育: [完整教育], 建档: {}, 个人优势: '存量优势',
    });
    expect(优势框().value).toBe('存量优势');
    expect(screen.getByText('4 / 500')).toBeTruthy();
    expect(screen.getByText(中性说明)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /恢复简历识别建议|重新从简历提取/ })).toBeNull();
    // 已移除的长按说明不再进场
    expect(screen.queryByText(/长按/)).toBeNull();
  });

  it('Ready 轮且权威为空：种入当前轮真实建议、显示提取说明并给恢复动作', () => {
    render工作经历({
      经历: [], 教育: [完整教育], 建档: {}, 个人优势: '', 预填: readyWork(),
    });
    expect(优势框().value).toBe(建议优势文本);
    expect(screen.getByText(提取说明)).toBeTruthy();
    expect(screen.getByRole('button', { name: /恢复简历识别建议/ })).toBeTruthy();
    // Mock 种子文本不因 Backend 有建议而混进页面
    expect(screen.queryByText(/9 年高并发交易系统/)).toBeNull();
  });

  it('权威现值优先于建议：用户已有文本不被建议替换，说明保持中性', () => {
    render工作经历({
      经历: [], 教育: [完整教育], 建档: {}, 个人优势: '我自己写的优势', 预填: readyWork(),
    });
    expect(优势框().value).toBe('我自己写的优势');
    expect(screen.queryByText(提取说明)).toBeNull();
    expect(screen.getByText(中性说明)).toBeTruthy();
  });

  it.each([
    ['manual 轮', (轮: 候选预填状态) => { 轮.phase = 'manual'; }],
    ['summary 已确认', (轮: 候选预填状态) => { 轮.confirmed.summary = true; }],
    ['inactive 轮（无建议）', null],
  ])('当前轮 %s：不种入建议、不给恢复动作', (_名, 改) => {
    const 轮 = readyWork();
    if (改) 改(轮);
    render工作经历({
      经历: [], 教育: [完整教育], 建档: {}, 个人优势: '', 预填: 改 ? 轮 : undefined,
    });
    expect(优势框().value).toBe('');
    expect(screen.getByText(中性说明)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /恢复简历识别建议|重新从简历提取/ })).toBeNull();
  });

  it('旧草稿恢复：建档草稿里的优势优先，空串是明确清空（迟到的建议不覆盖）', async () => {
    const 视图 = render工作经历({
      经历: [], 教育: [完整教育],
      建档: { 资料: { 个人优势: '' } },
      个人优势: '存量优势',
    });
    expect(优势框().value).toBe('');
    expect(screen.queryByText(提取说明)).toBeNull();
    // 迟到到达的建议（轮变成 ready）不覆盖用户已清空的输入
    mock应用状态.后端状态.候选预填状态 = readyWork();
    await act(async () => { 视图.重渲染(); });
    expect(优势框().value).toBe('');
  });

  it('挂载后到达的建议不覆盖用户已敲入的文本，也不让说明误称已应用', async () => {
    const 视图 = render工作经历({ 经历: [], 教育: [完整教育], 建档: {}, 个人优势: '' });
    const 用户 = userEvent.setup();
    await 用户.type(优势框(), '用户本人填写');
    mock应用状态.后端状态.候选预填状态 = readyWork();
    await act(async () => { 视图.重渲染(); });
    expect(优势框().value).toBe('用户本人填写');
    expect(screen.queryByText(提取说明)).toBeNull();
  });

  it('用户清空后立即回中性说明（不再声称已提取）', async () => {
    render工作经历({ 经历: [], 教育: [完整教育], 建档: {}, 个人优势: '', 预填: readyWork() });
    const 用户 = userEvent.setup();
    await 用户.clear(优势框());
    expect(screen.queryByText(提取说明)).toBeNull();
    expect(screen.getByText(中性说明)).toBeTruthy();
  });

  it('输入即写建档草稿（含清空后的空串），恢复动作只改页面草稿不写草稿', async () => {
    const 视图 = render工作经历({
      经历: [], 教育: [完整教育], 建档: {}, 个人优势: '', 预填: readyWork(),
    });
    const 用户 = userEvent.setup();
    await 用户.type(优势框(), '我写的');
    expect(mock更新草稿.mock.calls.at(-1)![0].资料.个人优势).toBe(`${建议优势文本}我写的`);
    await 用户.clear(优势框());
    expect(mock更新草稿.mock.calls.at(-1)![0].资料.个人优势).toBe('');
    // 恢复只把建议写回输入框，不当作「用户明确输入」落草稿
    const 写次数 = mock更新草稿.mock.calls.length;
    await 用户.click(screen.getByRole('button', { name: /恢复简历识别建议/ }));
    expect(优势框().value).toBe(建议优势文本);
    expect(mock更新草稿.mock.calls.length).toBe(写次数);
    void 视图;
  });

  it('Mock 保留原型恢复：重新从简历提取写回种子文本', async () => {
    render工作经历({ 数据源: 'mock', 经历: [], 教育: [完整教育], 建档: {}, 个人优势: '' });
    const 用户 = userEvent.setup();
    await 用户.type(优势框(), '我改过的内容');
    await 用户.click(screen.getByRole('button', { name: /重新从简历提取/ }));
    expect(优势框().value).toBe(个人优势文本);
  });

  it('聚合保存整链：简历写入 → 个人优势 → 确认 summary → 进补充偏好', async () => {
    const 保存简历 = vi.fn(async (_next?: unknown, _来源?: string) => {});
    const 保存个人优势 = vi.fn(async (文本?: string) => { void 文本; });
    render工作经历({
      经历: [], 教育: [完整教育], 建档: {}, 个人优势: '存量优势',
      保存简历, 保存个人优势,
    });
    const 用户 = userEvent.setup();
    await 用户.clear(优势框());
    await 用户.type(优势框(), '新的个人优势');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock跳转).toHaveBeenCalledWith(路径.引导问答));
    // 合同 C：本次待保存优势在局部/建档草稿，简历写入携带的是进入保存前的已存值
    expect((保存简历.mock.calls[0][0] as { 个人优势: string }).个人优势).toBe('存量优势');
    expect(保存简历.mock.calls[0][1]).toBeUndefined(); // onboarding 不传保存来源
    expect(保存个人优势).toHaveBeenCalledWith('新的个人优势');
    expect(mock确认分区).toHaveBeenCalledWith('work');
    expect(mock确认分区).toHaveBeenCalledWith('summary');
    const 序 = (桩: { mock: { invocationCallOrder: number[] } }) => 桩.mock.invocationCallOrder[0];
    const 确认序 = (段: string) =>
      mock确认分区.mock.invocationCallOrder[mock确认分区.mock.calls.findIndex(([值]) => 值 === 段)];
    expect(序(保存简历)).toBeLessThan(序(保存个人优势));
    expect(序(保存个人优势)).toBeLessThan(确认序('summary'));
    expect(序(保存个人优势)).toBeLessThan(序(mock跳转));
    // work 分区确认在整条链之前（Task 2 既有语义），summary 只在优势写入成功后确认
    expect(mock确认分区.mock.calls.map(([段]) => 段)).toEqual(['work', 'summary']);
  });

  it('个人优势保存失败：summary 不确认、不前进、留页且保留输入', async () => {
    const 保存简历 = vi.fn(async () => {});
    const 保存个人优势 = vi.fn(async () => { throw new Error('保存失败'); });
    render工作经历({
      经历: [], 教育: [完整教育], 建档: {}, 个人优势: '',
      保存简历, 保存个人优势,
    });
    const 用户 = userEvent.setup();
    await 用户.type(优势框(), '待保存的优势');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('请求失败，请稍后再试'));
    expect(mock确认分区).not.toHaveBeenCalledWith('summary');
    expect(mock跳转).not.toHaveBeenCalled();
    expect(优势框().value).toBe('待保存的优势');
  });

  // 合同 C Step 5「重试只补未达成项」：优势失败后**没再动过链上输入**的重试只补优势 ——
  // 不重发简历写、不重复确认 work、不重放已落地的隐私命令。
  it('优势失败后的紧接重试只补优势：不重跑简历链、不重复确认 work、输入仍在', async () => {
    const 保存简历 = vi.fn(async () => {});
    const 保存个人优势 = vi.fn(async () => {})
      .mockRejectedValueOnce(new Error('保存失败'))
      .mockResolvedValue(undefined);
    render工作经历({
      经历: [], 教育: [完整教育], 建档: {}, 个人优势: '',
      保存简历, 保存个人优势,
    });
    const 用户 = userEvent.setup();
    await 用户.type(优势框(), '待保存的优势');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存个人优势).toHaveBeenCalledTimes(1));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock跳转).toHaveBeenCalledWith(路径.引导问答));
    expect(保存简历).toHaveBeenCalledTimes(1);
    expect(mock确认分区.mock.calls.map(([段]) => 段)).toEqual(['work', 'summary']);
  });

  // fix-r1（quality Important 1）：「只补优势」只对紧接的重试成立。链上输入一改就必须
  // 重新走整条简历链（含全部写前校验），否则一次优势失败会把后面的编辑静默吞掉 ——
  // 保存简历不再发出、校验全被跳过，页面却按整链成功照常前进。
  it('优势失败后改了经历条目再保存：简历链照走、新条目随 保存简历 带上', async () => {
    const 保存简历 = vi.fn(async (_next?: unknown, _来源?: string) => {});
    const 保存个人优势 = vi.fn(async () => {})
      .mockRejectedValueOnce(new Error('保存失败'))
      .mockResolvedValue(undefined);
    render工作经历({
      经历: [完整经历行], 教育: [完整教育], 建档: {}, 个人优势: '',
      保存简历, 保存个人优势,
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存个人优势).toHaveBeenCalledTimes(1));
    // 留页后改一条经历（列表 → 条目编辑页 → 完成），再点保存
    await 用户.click(screen.getByText('字节跳动'));
    await 用户.clear(screen.getByPlaceholderText('必填'));
    await 用户.type(screen.getByPlaceholderText('必填'), '后端架构师');
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(2));
    const 第二次next = 保存简历.mock.calls[1][0] as { 经历: { 职位: string }[] };
    expect(第二次next.经历.map((段) => 段.职位)).toEqual(['后端架构师']);
    await waitFor(() => expect(mock跳转).toHaveBeenCalledWith(路径.引导问答));
    expect(保存个人优势).toHaveBeenCalledTimes(2);
  });

  it('优势失败后留下非法作品集链接再保存：写前校验恢复生效，简历写入不再被跳过', async () => {
    const 保存简历 = vi.fn(async () => {});
    const 保存个人优势 = vi.fn(async () => {})
      .mockRejectedValueOnce(new Error('保存失败'))
      .mockResolvedValue(undefined);
    render工作经历({
      经历: [], 教育: [完整教育], 建档: {}, 个人优势: '',
      保存简历, 保存个人优势,
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存个人优势).toHaveBeenCalledTimes(1));
    await 用户.type(screen.getByLabelText('作品集或项目链接'), '不是链接 有空格');
    mock轻提示.mockClear();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('请输入有效的作品集或项目链接'));
    expect(保存简历).toHaveBeenCalledTimes(1);
    expect(保存个人优势).toHaveBeenCalledTimes(1);
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('简历写入失败：个人优势不再写、summary 不确认、不前进', async () => {
    const 保存简历 = vi.fn(async () => { throw new Error('保存失败'); });
    const 保存个人优势 = vi.fn(async () => {});
    render工作经历({
      经历: [], 教育: [完整教育], 建档: {}, 个人优势: '',
      保存简历, 保存个人优势,
    });
    const 用户 = userEvent.setup();
    await 用户.type(优势框(), '待保存的优势');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('请求失败，请稍后再试'));
    expect(保存个人优势).not.toHaveBeenCalled();
    expect(mock确认分区).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('学生身份同样把优势写进资料页并进补充偏好（不再先进求职状态）', async () => {
    const 保存个人优势 = vi.fn(async () => {});
    render工作经历({
      经历: [], 教育: [完整教育], 建档: {}, 个人优势: '',
      基本信息: { 真名: '沈', 开始工作年: '', 身份: '在校' },
      保存个人优势,
    });
    const 用户 = userEvent.setup();
    await 用户.type(优势框(), '在校生的优势');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存个人优势).toHaveBeenCalledWith('在校生的优势'));
    await waitFor(() => expect(mock跳转).toHaveBeenCalledWith(路径.引导问答));
    expect(mock跳转).not.toHaveBeenCalledWith(路径.求职状态);
  });

  it('日常编辑（from=resume）不挂优势正文：资料页优势只服务 onboarding', () => {
    window.history.replaceState({ idx: 4, key: 'k4', usr: null }, '');
    const 来路 = 创建候选编辑来路('resume');
    window.history.replaceState({ idx: 5, key: 'k5', usr: null }, '');
    render工作经历({
      经历: [完整经历行], 教育: [完整教育],
      入口: { pathname: 路径.工作经历, search: '?from=resume&section=work', state: 来路 },
    });
    expect(screen.queryByLabelText('个人优势')).toBeNull();
    expect(mock更新草稿).not.toHaveBeenCalled();
  });
});
