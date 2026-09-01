import { createElement } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 初始状态, 归约, use应用状态, 应用状态提供者 } from './应用状态';
import { 创建初始状态, 空账号资料 } from './初始状态';
import { 空岗位硬性事实 } from '../数据/类型';
import {
  BFF主体样本,
  BFF简历样本,
  BFF岗位样本,
  BFF意向样本,
  页面岗位样本,
  BFF企业关系样本,
  BFF企业媒体样本,
  BFF企业档案样本,
  BFF企业管理员申请样本,
  BFF公开企业样本,
  BFF招聘方档案样本,
  BFF隐私快照样本,
  BFF屏蔽回执样本,
  BFF组织搜索页样本,
  BFFAgent规则样本,
  BFF意向Agent规则样本,
} from '../测试/BFF样本';
import { 从BFF隐私 } from '../数据/隐私映射';
import { BFF错误 } from '../数据/HTTP客户端';
import type { BFF招聘方档案, BFF公开企业, BFF角色, BFF附件简历库 } from '../数据/BFF契约';
import type { BFF二进制响应 } from '../数据/HTTP客户端';
import { 解P5详情, type P5列表页, type P5详情 } from '../数据/招聘数据源/MatchCase';
import type { P7会话项, P7会话页, P7消息, P7消息页 } from '../数据/招聘数据源/真人会话';
import type { P8AccountDeletion, P8Credential, P8DataExport, P8Session } from '../数据/招聘数据源/P8控制面';
import { P5候选详情Wire } from '../测试/BFF样本';
import type { HTTP招聘数据源 } from '../数据/HTTP招聘数据源';
import type { 页面简历快照, 页面简历写入, 页面意向快照, 页面岗位快照 } from '../数据/招聘数据源类型';
import type { 规则 } from '../数据/类型';
import { 从BFF简历 } from '../数据/后端映射';
import { 候选引导草稿键, 写候选引导草稿, type 候选引导草稿快照 } from '../数据/资料缓存';

beforeEach(() => {
  try {
    globalThis.sessionStorage.clear();
  } catch {
    // 个别存储降级测试会故意提供不可用实现。
  }
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** P5 Task 3：Provider 用例的候选侧权威详情 DTO（由 Task 1 wire 样本解出）。 */
const P5候选详情DTO: P5详情 = 解P5详情(P5候选详情Wire, 'candidate');

describe('应用状态 reducer', () => {
  const 写入 = vi.fn();
  const 删除 = vi.fn();

  // P1C Task 2：组织域 reducer 用例的本地 fixture（只在本 describe 内使用）
  const 企业A身份: Omit<BFF公开企业, 'profile'> = {
    organization_id: 'org_a',
    legal_name: '甲公司法务主体',
    display_name: '甲公司',
    verified_at: '2026-08-24T00:00:00Z',
    active_verified_job_count: 1,
  };
  const 企业A档案 = BFF企业档案样本;

  beforeEach(() => {
    写入.mockClear();
    删除.mockClear();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: 写入,
      removeItem: 删除,
      clear: vi.fn(),
    });
  });

  it('保持纯函数：更新认证状态时不直接写 localStorage', () => {
    const 下一状态 = 归约(初始状态, {
      型: '存企业认证',
      姓名: '测试用户',
      公司: '测试科技',
      职务: '招聘经理',
    });

    expect(下一状态.企业认证).toEqual({ 姓名: '测试用户', 公司: '测试科技', 职务: '招聘经理' });
    expect(写入).not.toHaveBeenCalled();
    expect(删除).not.toHaveBeenCalled();
  });

  it('不修改传入状态对象', () => {
    const 下一状态 = 归约(初始状态, { 型: '设企业飞书接入', 接入: true });
    expect(下一状态).not.toBe(初始状态);
    expect(初始状态.企业飞书已接入).toBe(false);
    expect(下一状态.企业飞书已接入).toBe(true);
  });

  // F6：后端模式下编辑已有意向，草稿要从 完整 BFFOwnerIntention 重建，
  // 而不是从稀疏列表条目拆回 —— 否则打开+原样保存清掉 alternate_locations/industries 等。
  it('后端模式 开意向草稿 从服务端完整 DTO 重建草稿', () => {
    const dto = {
      ...BFF意向样本,
      intention_id: 'int_1',
      primary_location: { id: 'loc_sh', display_name: '上海' },
      job_category: { id: 'tax_p', display_name: '产品经理' },
      alternate_locations: [{ id: 'loc_bj', display_name: '北京' }],
      industries: [{ id: 'ind_fin', display_name: '金融' }],
      workplace_modes: ['hybrid'] as ('onsite' | 'hybrid' | 'remote')[],
      compensation: { mode: 'range' as const, lower: 300, upper: 500, annual_salary_months: null },
      salary_period: 'day' as const,
      recruitment_type: 'internship' as const,
    };
    // 水合后端意向：列表是稀疏条目，服务端 map 是完整 DTO
    const 水合后 = 归约(初始状态, {
      型: '水合后端意向',
      快照: { 列表: [{ 编号: 'int_1', 标题: '[上海] 产品经理', 说明: '300-500 元/天' }], 服务端: { int_1: dto } },
    });
    const 开草稿后 = 归约(水合后, { 型: '开意向草稿', 编号: 'int_1' });
    expect(开草稿后.意向草稿).toEqual({
      编辑编号: 'int_1',
      求职类型: '全职',
      工作城市: '上海',
      工作城市引用: { id: 'loc_sh', display_name: '上海' },
      期望职位: '产品经理',
      职位引用: { id: 'tax_p', display_name: '产品经理' },
      感兴趣城市们: ['北京'],
      感兴趣城市引用们: [{ id: 'loc_bj', display_name: '北京' }],
      薪资下限: 300,
      薪资上限: 500,
      期望行业们: ['金融'],
      行业引用们: [{ id: 'ind_fin', display_name: '金融' }],
      办公方式: ['混合'],
      后端招聘类型: 'internship',
      求职类型已改: false,
    });
  });

  it('后端意向服务端 水合时同步更新，再次水合空快照清空', () => {
    const dto = { ...BFF意向样本, intention_id: 'int_2' };
    const 水合 = 归约(初始状态, { 型: '水合后端意向', 快照: { 列表: [], 服务端: { int_2: dto } } });
    expect(水合.后端意向服务端).toEqual({ int_2: dto });
    const 清空 = 归约(水合, { 型: '水合后端意向', 快照: { 列表: [], 服务端: {} } });
    expect(清空.后端意向服务端).toEqual({});
  });

  // review-r2 R2-I-2：启程引导 必须保留选择器写入的 目录引用们，否则首轮意向提交丢 refs。
  it('启程引导 保留 城市引用们/职位引用们（R2-I-2）', () => {
    const 城市引用们 = [{ id: 'loc_sh', display_name: '上海' }];
    const 职位引用们 = [{ id: 'tax_pm', display_name: '产品经理' }];
    const 下一 = 归约(初始状态, {
      型: '启程引导',
      城市们: ['上海'],
      职位: ['产品经理'],
      筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['现场'] },
      城市引用们,
      职位引用们,
    });
    expect(下一.引导预填).not.toBe(null);
    expect(下一.引导预填!.城市引用们).toEqual(城市引用们);
    expect(下一.引导预填!.职位引用们).toEqual(职位引用们);
  });

  // onboarding 重启：启程引导 只该覆盖自己拥有的字段，用户已填的 薪资/到岗 必须留在 引导预填 上。
  it('启程引导 合并进旧 预填，保留 薪资 与 到岗', () => {
    const 预置 = {
      ...初始状态,
      引导预填: {
        城市们: ['上海'],
        职位: ['旧职位'],
        城市引用们: [{ id: 'loc_old', display_name: '上海' }],
        职位引用们: [{ id: 'job_old', display_name: '旧职位' }],
        薪资: { 下限: 30, 上限: 40, 单位: '月薪K' as const },
        到岗: '在职 · 考虑机会',
      },
    };
    const 下一 = 归约(预置, {
      型: '启程引导',
      城市们: ['北京'],
      职位: ['新职位'],
      筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['混合'] },
      城市引用们: [{ id: 'loc_bj', display_name: '北京' }],
      职位引用们: [{ id: 'job_new', display_name: '新职位' }],
    });
    expect(下一.引导预填).not.toBe(null);
    expect(下一.引导预填!.城市们).toEqual(['北京']);
    expect(下一.引导预填!.职位).toEqual(['新职位']);
    expect(下一.引导预填!.筛选偏好).toEqual({ 求职类型: ['社招全职'], 办公方式: ['混合'] });
    expect(下一.引导预填!.城市引用们).toEqual([{ id: 'loc_bj', display_name: '北京' }]);
    expect(下一.引导预填!.职位引用们).toEqual([{ id: 'job_new', display_name: '新职位' }]);
    expect(下一.引导预填!.薪资).toEqual({ 下限: 30, 上限: 40, 单位: '月薪K' });
    expect(下一.引导预填!.到岗).toBe('在职 · 考虑机会');
  });

  it('启程引导 未传 refs 时默认空数组（Mock 路径，R2-I-2）', () => {
    const 下一 = 归约(初始状态, {
      型: '启程引导',
      城市们: ['上海'],
      职位: ['产品经理'],
      筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['现场'] },
    });
    expect(下一.引导预填).not.toBe(null);
    expect(下一.引导预填!.城市引用们).toEqual([]);
    expect(下一.引导预填!.职位引用们).toEqual([]);
  });

  it('由 Provider 在状态提交后统一持久化', async () => {
    function 测试按钮() {
      const { 派发 } = use应用状态();
      return createElement('button', { onClick: () => 派发({ 型: '设企业飞书接入', 接入: true }) }, '接入飞书');
    }

    render(createElement(应用状态提供者, null, createElement(测试按钮)));
    写入.mockClear();
    await userEvent.click(document.querySelector('button')!);

    await waitFor(() => expect(写入).toHaveBeenCalledWith(
      'AGXP账号资料v2:mock:stg:demo',
      expect.stringContaining('"企业飞书已接入":true'),
    ));
  });

  it('完整发布岗位时保留角色专属计薪单位和全部筛选字段', () => {
    const 岗 = {
      编号: 'P-99',
      名称: '后端实习生',
      薪资带: '300-500 元/天',
      状态: '在招' as const,
      在谈数: 0,
      城市: '上海',
      办公方式: '混合',
      招聘类型: '实习生' as const,
      实习月数: 3,
      每周天数: 4,
      实习转正: true,
      职位关键词: ['Java'],
      加分关键词: ['有相关课程项目'],
      硬性条件: ['本科及以上'],
      // Task 5：四问硬性事实随岗必填（四员齐全；新岗未点过的问保持 未说明）
      硬性事实: { ...空岗位硬性事实 },
    };

    const 下一状态 = 归约(初始状态, { 型: '发布岗位', 岗 });
    expect(下一状态.岗位列表[0]).toMatchObject({
      编号: 'P-99',
      薪资带: '300-500 元/天',
      招聘类型: '实习生',
      实习月数: 3,
      每周天数: 4,
      // 实习最晚开始日期 / 面试轮次 / 招聘紧急度 三条断言删于 2026-08-22：字段本身已按
      // 产品负责人标注删除（「应该删掉吧」「感觉没什么用」「这个删了吧，没啥用」，且无书面出处）。
      // 实习转正 留着断言 —— 同批澄清「实习生转正可以加」，它仍要跟着发布落库
      实习转正: true,
      职位关键词: ['Java'],
      加分关键词: ['有相关课程项目'],
      // 在谈数 已退役（拦路 11）：静态字段不再是任何屏的数据源，发布时一律 0。
      // 原来这里断言 2，断的正是那个「刚发布就显示在谈 2 人」的假数字
      在谈数: 0,
    });
    // 真实的在谈人数由起步候选实时算出来 —— 岗位管理行内与删除守卫读的都是这个
    expect(下一状态.企业候选列表.filter((候) => 候.岗位编号 === 'P-99')).toHaveLength(2);
  });

  // ── P1C Task 2：Organization 权威状态的 reducer 用例 ──

  it('清后端组织状态只清 Backend 权威事实', () => {
    const 水合后 = 归约(归约(初始状态, {
      型: '水合企业关系', 关系: [BFF企业关系样本], 当前编号: BFF企业关系样本.affiliation_id,
    }), { 型: '水合招聘方档案', 档案: BFF招聘方档案样本 });
    const 清后 = 归约(水合后, { 型: '清后端组织状态' });
    expect(清后.招聘方档案).toBeNull();
    expect(清后.企业关系列表).toEqual([]);
    expect(清后.当前企业关系编号).toBeNull();
    expect(清后.公开企业表).toEqual({});
    expect(清后.不可用公开企业编号).toEqual([]);
    expect(清后.企业认证).toEqual(初始状态.企业认证);
  });

  it('revoke 当前关系时清选择而不猜另一个关系', () => {
    const 水合后 = 归约(初始状态, {
      型: '水合企业关系',
      关系: [BFF企业关系样本, { ...BFF企业关系样本, affiliation_id: 'aff_2' }],
      当前编号: BFF企业关系样本.affiliation_id,
    });
    const revoke后 = 归约(水合后, {
      型: '水合企业关系',
      关系: [{ ...BFF企业关系样本, status: 'revoked' }, { ...BFF企业关系样本, affiliation_id: 'aff_2' }],
      当前编号: null,
    });
    expect(revoke后.当前企业关系编号).toBeNull();
    expect(revoke后.当前企业身份).toBeNull();
  });

  it('选择不同关系时立即清掉旧企业身份与完整档案', () => {
    const A = { ...初始状态, 当前企业关系编号: 'aff_a', 当前企业身份: 企业A身份, 企业档案快照: 企业A档案 };
    const 切B = 归约(A, { 型: '选择当前企业关系', 编号: 'aff_b' });
    expect(切B.当前企业关系编号).toBe('aff_b');
    expect(切B.当前企业身份).toBeNull();
    expect(切B.企业档案快照).toBeNull();
  });

  it('Backend 种子组织权威事实为空，Mock 仍保留现有 fixture', () => {
    const 后端种子 = 创建初始状态({ 模式: 'backend', 后端环境: 'stg', 后端: {} as HTTP招聘数据源 });
    expect(后端种子.招聘方档案).toBeNull();
    expect(后端种子.企业关系列表).toEqual([]);
    expect(后端种子.当前企业关系编号).toBeNull();
    expect(后端种子.企业管理员申请列表).toEqual([]);
    expect(后端种子.当前企业身份).toBeNull();
    expect(后端种子.企业档案快照).toBeNull();
    expect(后端种子.公开企业表).toEqual({});
    expect(后端种子.不可用公开企业编号).toEqual([]);
    expect(后端种子.未认证公司声明).toBe('');
    // Backend seed 不把 Mock 的云衢 fixture 当权威事实
    expect(后端种子.企业认证).toEqual(空账号资料.企业认证);
    // Mock 初始状态仍播种现有 fixture
    expect(初始状态.企业认证.公司).toBe('云衢科技');
    expect(初始状态.企业关系列表).toEqual([]);
  });

  it('水合组织权威事实，admin request 只经显式按需 action', () => {
    const 档案后 = 归约(初始状态, { 型: '水合招聘方档案', 档案: BFF招聘方档案样本 });
    expect(档案后.招聘方档案).toEqual(BFF招聘方档案样本);
    const 关系后 = 归约(档案后, {
      型: '水合企业关系', 关系: [BFF企业关系样本], 当前编号: BFF企业关系样本.affiliation_id,
    });
    expect(关系后.企业关系列表).toEqual([BFF企业关系样本]);
    expect(关系后.当前企业关系编号).toBe(BFF企业关系样本.affiliation_id);
    const 当前后 = 归约(关系后, { 型: '水合当前企业', 身份: 企业A身份, 档案: 企业A档案 });
    expect(当前后.当前企业身份).toEqual(企业A身份);
    expect(当前后.企业档案快照).toEqual(企业A档案);
    const 申请后 = 归约(当前后, { 型: '水合企业管理员申请', 申请: [BFF企业管理员申请样本] });
    expect(申请后.企业管理员申请列表).toEqual([BFF企业管理员申请样本]);
  });

  it('水合账号资料 丢弃快照中未经 affiliations 校验的当前企业关系编号', () => {
    // 最新 affiliations 已确认 revoked → current 已被校验为 null
    const 已校验 = 归约(初始状态, {
      型: '水合企业关系',
      关系: [{ ...BFF企业关系样本, status: 'revoked' }],
      当前编号: null,
    });
    expect(已校验.当前企业关系编号).toBeNull();
    // 之后到达的 水合账号资料 带着缓存里的旧编号，不能把它写回 state
    const 快照后 = 归约(已校验, {
      型: '水合账号资料',
      范围键: 'AGXP账号资料v2:backend:stg:sub_1',
      快照: {
        ...空账号资料,
        当前企业关系编号: BFF企业关系样本.affiliation_id,
        未认证公司声明: '缓存里的声明',
      },
    });
    expect(快照后.当前企业关系编号).toBeNull();
    // 其它白名单字段照常恢复
    expect(快照后.未认证公司声明).toBe('缓存里的声明');
    expect(快照后.资料缓存范围键).toBe('AGXP账号资料v2:backend:stg:sub_1');
  });

  it('水合后端隐私 覆盖屏蔽名单/披露偏好/隐身开关，清后端隐私 三者归零', () => {
    const 页面 = 从BFF隐私(BFF隐私快照样本);
    const 水合后 = 归约(初始状态, { 型: '水合后端隐私', 快照: 页面 });
    expect(水合后.屏蔽名单).toEqual(页面.屏蔽名单);
    expect(水合后.披露偏好).toEqual(页面.披露偏好);
    expect(水合后.设置开关.对现雇主隐身).toBe(true);
    // 隐私之外的设置开关不被触碰
    expect(水合后.设置开关['只接受与意向匹配的接触'])
      .toBe(初始状态.设置开关['只接受与意向匹配的接触']);
    const 清后 = 归约(水合后, { 型: '清后端隐私' });
    expect(清后.屏蔽名单).toEqual([]);
    expect(清后.披露偏好).toEqual([]);
    expect(清后.设置开关.对现雇主隐身).toBe(false);
  });

  it('Backend 种子隐私域为空，Mock 保留三条种子屏蔽与七行披露', () => {
    const 后端种子 = 创建初始状态({ 模式: 'backend', 后端环境: 'stg', 后端: {} as HTTP招聘数据源 });
    expect(后端种子.屏蔽名单).toEqual([]);
    expect(后端种子.披露偏好).toEqual([]);
    expect(后端种子.设置开关.对现雇主隐身).toBe(false);
    // Mock 初始状态仍保留现有 fixture（三条种子屏蔽 + 七行披露模板）
    expect(初始状态.屏蔽名单).toHaveLength(3);
    expect(初始状态.披露偏好).toHaveLength(7);
  });

  it('当前企业关系编号不进入 localStorage（Mock 原型路径）', async () => {
    function 测试按钮() {
      const { 派发 } = use应用状态();
      return createElement('button', {
        onClick: () => {
          派发({ 型: '水合企业关系', 关系: [BFF企业关系样本], 当前编号: 'aff_local' });
          派发({ 型: '设企业飞书接入', 接入: true });
        },
      }, '写入组织选择');
    }

    render(createElement(应用状态提供者, null, createElement(测试按钮)));
    写入.mockClear();
    await userEvent.click(document.querySelector('button')!);
    // 设企业飞书接入 触发一次账号资料写回；该写回不得携带组织选择
    await waitFor(() => expect(写入).toHaveBeenCalledWith(
      'AGXP账号资料v2:mock:stg:demo',
      expect.stringContaining('"企业飞书已接入":true'),
    ));
    const 全部写入 = 写入.mock.calls.map(([, 值]) => String(值)).join('');
    expect(全部写入).not.toContain('当前企业关系编号');
    expect(全部写入).not.toContain('aff_local');
  });
});

// ── Provider 会话 / 角色水合 / 401 ───────────────────────────────
// Task 6：Context 接入后端数据源后的会话恢复与角色切换顺序。
// 注：仓库未装 @testing-library/jest-dom，故不用 toHaveTextContent/toBeInTheDocument；
// 用 getByText/getByRole（找不到即抛）+ toBe 定义来等价断言。

function 创建后端桩(lastUsedRole: 'candidate' | 'recruiter' | null = 'candidate') {
  const 主体 = { ...BFF主体样本, last_used_role: lastUsedRole };
  return {
    恢复会话: vi.fn(async () => ({ identity_id: 'id_1', session_id: 'sess_1', expires_at: '2026-08-25T00:00:00Z' })),
    读取主体: vi.fn(async () => 主体),
    确保角色: vi.fn(async (role: BFF角色) => ({ ...主体, roles: [...主体.roles, { role, status: 'active' as const }] })),
    记录当前角色: vi.fn(async (role: BFF角色) => ({ ...主体, last_used_role: role })),
    读取简历: vi.fn(async () => 从BFF简历(BFF简历样本)),
    保存简历: vi.fn(async () => 从BFF简历(BFF简历样本)),
    读取意向: vi.fn(async (): Promise<页面意向快照> => ({ 列表: [], 服务端: {} })),
    创建意向: vi.fn(async (): Promise<页面意向快照> => ({ 列表: [], 服务端: {} })),
    更新意向: vi.fn(async (): Promise<页面意向快照> => ({ 列表: [], 服务端: {} })),
    删除意向: vi.fn(async (): Promise<页面意向快照> => ({ 列表: [], 服务端: {} })),
    读取岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    创建岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    更新岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    归档岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    重开岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    删除岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    清空目录缓存: vi.fn(),
    // P1C Task 2：组织域方法（recruiter mount 水合会调用）
    读取招聘方档案: vi.fn(async () => BFF招聘方档案样本),
    保存招聘方档案: vi.fn(async () => BFF招聘方档案样本),
    读取我的企业关系: vi.fn(async () => [BFF企业关系样本]),
    读取企业管理员申请: vi.fn(async () => [BFF企业管理员申请样本]),
    创建企业管理员申请: vi.fn(async () => BFF企业管理员申请样本),
    取消企业管理员申请: vi.fn(async () => BFF企业管理员申请样本),
    接受企业邀请: vi.fn(async () => BFF企业关系样本),
    替换招聘方头像: vi.fn(async () => BFF招聘方档案样本),
    读取企业档案: vi.fn(async () => BFF企业档案样本),
    替换企业档案: vi.fn(async () => BFF企业档案样本),
    上传企业媒体: vi.fn(async () => BFF企业媒体样本),
    删除企业媒体: vi.fn(async () => undefined),
    读取公开企业: vi.fn(async () => BFF公开企业样本),
    查询Location: vi.fn(async (): Promise<{ items: never[]; nextCursor: null; catalogVersion: string }> => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
    查询Taxonomy: vi.fn(async (): Promise<{ items: never[]; nextCursor: null; catalogVersion: string }> => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
    查询Institution: vi.fn(async (): Promise<{ items: never[]; nextCursor: null; catalogVersion: string }> => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
    // P3 Task 2：隐私域（candidate mount 水合会调用 读取隐私）
    读取隐私: vi.fn(async () => 从BFF隐私(BFF隐私快照样本)),
    修改隐私: vi.fn(async () => 从BFF隐私(BFF隐私快照样本)),
    添加组织屏蔽: vi.fn(async () => BFF屏蔽回执样本),
    解除组织屏蔽: vi.fn(async () => 从BFF隐私(BFF隐私快照样本)),
    搜索组织: vi.fn(async () => BFF组织搜索页样本),
    开始手机登录: vi.fn(),
    完成手机登录: vi.fn(),
    开始微信登录: vi.fn(),
    退出登录: vi.fn(),
    // P6：Agent 规则 / 提案 facade（Task 3 起操作层会调用；默认全空集）
    读取Agent规则: vi.fn(async (): Promise<unknown[]> => []),
    读取单条Agent规则: vi.fn(async () => ({
      rule_id: 'rul_0123456789abcdef0123456789abcdef',
      version: 1,
      state: 'active' as const,
      scope: { type: 'global' as const },
      clause_kinds: [] as never[],
      display_text: 'x',
      created_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
    })),
    修改Agent规则: vi.fn(async () => ({
      rule_id: 'rul_0123456789abcdef0123456789abcdef',
      version: 1,
      state: 'active' as const,
      scope: { type: 'global' as const },
      clause_kinds: [] as never[],
      display_text: 'x',
      created_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
    })),
    删除Agent规则: vi.fn(async () => undefined),
    创建Agent规则提案: vi.fn(async () => ({ proposal_id: 'arp_0123456789abcdef0123456789abcdef', state: 'interpreting' as const })),
    读取Agent规则提案: vi.fn(async () => ({ proposal_id: 'arp_0123456789abcdef0123456789abcdef', state: 'interpreting' as const })),
    读取Agent规则提案列表: vi.fn(async () => [] as never[]),
    接受Agent规则提案: vi.fn(async () => ({
      rule_id: 'rul_0123456789abcdef0123456789abcdef',
      version: 1,
      state: 'active' as const,
      scope: { type: 'global' as const },
      clause_kinds: [] as never[],
      display_text: 'x',
      created_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
    })),
    放弃Agent规则提案: vi.fn(async () => ({ proposal_id: 'arp_0123456789abcdef0123456789abcdef', state: 'dismissed' as const })),
    创建Agent规则替换提案: vi.fn(async () => ({ proposal_id: 'arp_0123456789abcdef0123456789abcdef', state: 'interpreting' as const })),
    // P2 Task 3：附件库第四支持域（candidate mount 水合会调用；默认空库成功）
    读取附件简历库: vi.fn(async (): Promise<BFF附件简历库> => ({
      items: [],
      limits: { max_files: 3, max_file_bytes: 10485760, accepted_media_types: ['application/pdf'] },
    })),
    // P5 Task 3：MatchCase 域 facade（默认空页/空详情成功，mutation 默认 void；逐用例覆盖）
    读取P5Open列表: vi.fn(async (): Promise<P5列表页> => ({ role: 'candidate', items: [], nextCursor: null })),
    读取P5历史: vi.fn(async (): Promise<P5列表页> => ({ role: 'candidate', items: [], nextCursor: null })),
    读取P5详情: vi.fn(async (): Promise<P5详情> => P5候选详情DTO),
    回答P5事实: vi.fn(async (): Promise<void> => undefined),
    提交P5简历: vi.fn(async (): Promise<void> => undefined),
    决定P5S0: vi.fn(async (): Promise<void> => undefined),
    决定P5S1: vi.fn(async (): Promise<void> => undefined),
    决定P5S2: vi.fn(async (): Promise<void> => undefined),
    决定P5S3: vi.fn(async (): Promise<void> => undefined),
    新增P5叮嘱: vi.fn(async (): Promise<void> => undefined),
    读取P5简历PDF: vi.fn(async (): Promise<BFF二进制响应> => ({
      blob: { type: 'application/pdf' } as Blob,
      contentType: 'application/pdf',
      contentDisposition: null,
      requestId: 'fixture',
    })),
    // P7 Task 2：真人会话域 facade（默认空页/空详情成功，mutation 默认成功；逐用例覆盖）
    读取会话列表: vi.fn(async (): Promise<P7会话页> => ({ items: [], nextCursor: null })),
    读取会话: vi.fn(async (): Promise<P7会话项> => ({
      conversationId: '3003', caseId: 'mc_3003', kind: 'human_handoff',
      lastMessage: null, lastActivityAt: '2026-08-30T01:00:00Z', unreadCount: 0,
      contextStatus: 'unavailable', context: null,
    })),
    读取消息: vi.fn(async (): Promise<P7消息页> => ({ messages: [], nextCursor: null })),
    发送消息: vi.fn(async (): Promise<P7消息> => ({
      messageId: '4005', kind: 'user_text', senderRole: 'candidate',
      content: '你好', createdAt: '2026-08-30T01:00:00Z',
    })),
    标为已读: vi.fn(async (): Promise<string> => '4004'),
    // P8 Task 3：控制面域 facade（默认空凭证 + 单当前会话成功，mutation 默认成功；逐用例覆盖）
    读取P8凭证: vi.fn(async (): Promise<P8Credential[]> => []),
    读取P8会话: vi.fn(async (): Promise<P8Session[]> => [{
      sessionId: 'sess_0000000000000001',
      createdAt: '2026-08-30T00:00:00Z',
      expiresAt: '2026-09-05T00:00:00Z',
      current: true,
    }]),
    开始P8手机号换绑: vi.fn(async () => ({
      attemptId: 'att_0123456789abcdef',
      nextAction: { type: 'enter_code' as const, expiresAt: null, retryAfterSeconds: null },
    })),
    完成P8手机号换绑: vi.fn(async () => ({
      credential: {
        credentialId: 'cred_0000000000000009',
        provider: 'phone_otp' as const,
        display: '+86 139 **** 1111',
        verifiedAt: '2026-08-31T10:00:00Z',
      },
      revokedSessions: 0,
      unchanged: true,
    })),
    退出P8其他设备: vi.fn(async (): Promise<number> => 0),
    // P8 Task 5：导出/注销 facade（默认创建 queued、GET running、同源下载地址、注销 202；逐用例覆盖）
    创建P8数据导出: vi.fn(async (): Promise<P8DataExport> => ({
      exportId: `exp_${'0123456789abcdef'.repeat(2)}`,
      status: 'queued',
      createdAt: '2026-08-30T00:00:00Z',
      expiresAt: null,
      downloadReady: false,
    })),
    读取P8数据导出: vi.fn(async (id: string): Promise<P8DataExport> => ({
      exportId: id,
      status: 'running',
      createdAt: '2026-08-30T00:00:00Z',
      expiresAt: null,
      downloadReady: false,
    })),
    取P8数据导出下载地址: vi.fn((id: string): string => `/api/v1/me/data-exports/${id}/download`),
    请求P8账号注销: vi.fn(async (): Promise<P8AccountDeletion> => ({
      deletionId: `del_${'0123456789abcdef'.repeat(2)}`,
      status: 'deletion_pending',
      retentionUntil: '2026-09-29T00:00:00Z',
    })),
  };
}

/** P7 Task 5：受控假 WebSocket —— jsdom 无实现，Provider 的同源事件连接用桩。 */
class 假WebSocket {
  static 构造记录: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((事件: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;
  constructor(url: string) {
    this.url = url;
    假WebSocket.构造记录.push(url);
  }
  close() { this.onclose?.(); }
}

describe('应用状态提供者 后端会话', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    假WebSocket.构造记录 = [];
    vi.stubGlobal('WebSocket', 假WebSocket);
  });

  it('候选资料 action 冻结具体结果', () => {
    expect(归约(初始状态, { 型: '存个人优势', 文本: '新的介绍' }).个人优势).toBe('新的介绍');
  });

  it('组织岗位 action 冻结具体结果', () => {
    const 下一 = 归约(初始状态, {
      型: '存企业认证', 姓名: '陆知遥', 公司: '示例科技', 职务: '招聘经理',
    });
    expect(下一.企业认证).toEqual({ 姓名: '陆知遥', 公司: '示例科技', 职务: '招聘经理' });
  });

  it('隐私设置 action 冻结具体结果', () => {
    const 下一 = 归约(初始状态, { 型: '拉黑', 名称: '示例公司' });
    // P3：屏蔽项新增必需元数据 —— 拉黑路径固定 手动添加/有效 + 合成组织编号
    expect(下一.屏蔽名单[0]).toEqual({
      编号: 'B-04', 名称: '示例公司', 首字: '示', 理由: '你手动加入 · 双向不可见', 时间: '刚刚',
      组织编号: 'org_local_04', 来源: '手动添加', 组织状态: '有效',
    });
  });

  it('发现推荐 action 冻结具体结果', () => {
    expect(归约(初始状态, { 型: '切收藏候选', 编号: 'A-01' }).收藏候选).toEqual(['A-01']);
  });

  it('MatchCase action 冻结决策和阶段推进', () => {
    const 下一 = 归约(初始状态, { 型: '接受方案', 编号: 'J-02' });
    expect(下一.决策['J-02']).toBe('接受');
    expect(下一.在谈列表.find((单) => 单.编号 === 'J-02')?.阶段).toBe('意向确认');
  });

  it('Agent 规则 action 冻结新规则内容', () => {
    const 下一 = 归约(初始状态, { 型: '新增规则', 内容: '不接受大小周', 来源: '测试' });
    expect(下一.全局规则.at(-1)).toEqual({
      编号: 'R-06', 内容: '不接受大小周', 来源: '测试', 生效: true,
    });
  });

  // Task 2：P6 Backend 水合/清空动作必须在根归约里路由到 Agent 规则域 ——
  // 根 switch 是逐项列 case，漏列会被 default 静默吞掉
  it('P6 水合与清空动作经根归约路由到 Agent 规则域', () => {
    const 后端全局规则: 规则 = {
      编号: 'rul_0123456789abcdef0123456789abcdef',
      内容: '大小周不谈',
      来源: '全局 · 更新于 2026-08-27',
      生效: true,
      作用域: { 类型: '全局' },
      服务端版本: 3,
      服务端状态: 'active',
    };
    const 后端意向规则: 规则 = {
      编号: 'rul_fedcba9876543210fedcba9876543210',
      内容: '双休是底线；隔周六可谈',
      来源: '意向「AI 产品经理」 · 更新于 2026-08-27',
      生效: true,
      作用域: { 类型: '意向', 意向编号: 'int_0123456789abcdef0123456789abcdef' },
      服务端版本: 1,
      服务端状态: 'active',
    };
    const 后端招聘规则: 规则 = {
      编号: 'rul_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      内容: '不透露 HC 剩余数量',
      来源: '全局 · 更新于 2026-08-27',
      生效: true,
      作用域: { 类型: '全局' },
      服务端版本: 2,
      服务端状态: 'active',
    };

    const 水合候选 = 归约(初始状态, {
      型: '水合后端候选规则', 全局: [后端全局规则], 意向级: [后端意向规则],
    });
    expect(水合候选.全局规则).toEqual([后端全局规则]);
    expect(水合候选.意向级规则).toEqual([后端意向规则]);

    const 水合招聘 = 归约(水合候选, { 型: '水合后端招聘规则', 规则: [后端招聘规则] });
    expect(水合招聘.企业规则).toEqual([后端招聘规则]);

    const 清后 = 归约(水合招聘, { 型: '清后端Agent规则' });
    expect(清后.全局规则).toEqual([]);
    expect(清后.意向级规则).toEqual([]);
    expect(清后.企业规则).toEqual([]);
  });

  it('消息 action 删除真实存在的未读键', () => {
    const 下一 = 归约(初始状态, { 型: '读消息', 编号: 'X-01' });
    expect(初始状态.消息未读['X-01']).toBe(4);
    expect(下一.消息未读['X-01']).toBeUndefined();
  });

  // Task 3 Step 6：Rule 与 Intention 谁先到都不能永久隐藏或错组规则 ——
  // 候选 Rules 先落地（意向快照还空着 → orphan intention scope 整条省略），
  // 意向后到时 Provider effect 用同一 raw Rule 重算归组。
  it('P6 候选规则先到、意向后到：全局立即出现，意向级随后自动归组', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 意向规则 = BFF意向Agent规则样本; // scope.intention_id = int_0123456789abcdef0123456789abcdef
    vi.mocked(后端.读取Agent规则)
      .mockResolvedValue([BFFAgent规则样本, 意向规则]);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 此时意向快照仍是空的（mount 只水合了空意向）
    await act(async () => {
      await 当前.操作.刷新Agent规则();
    });
    // 全局 Rule 立即出现；orphan intention Rule 不许并入全局，也不显示假分组
    expect(当前.状态.全局规则.map((rule) => rule.编号)).toEqual([BFFAgent规则样本.rule_id]);
    expect(当前.状态.意向级规则).toEqual([]);
    const resolveIntentions = (服务端: Record<string, typeof BFF意向样本>) => {
      当前.派发({ 型: '水合后端意向', 快照: { 列表: [], 服务端 } });
    };
    act(() => resolveIntentions({
      int_0123456789abcdef0123456789abcdef: BFF意向样本,
    }));
    await waitFor(() => {
      expect(当前.状态.意向级规则.map((rule) => rule.编号)).toEqual([BFF意向Agent规则样本.rule_id]);
    });
    // 全局那条保持原样：重算不重复、不丢行
    expect(当前.状态.全局规则.map((rule) => rule.编号)).toEqual([BFFAgent规则样本.rule_id]);
  });

  it('应用操作公开 shape 在拆分后保持不变', () => {
    function 探针() {
      const { 操作 } = use应用状态();
      return createElement('output', null, Object.keys(操作).sort().join('|'));
    }
    render(createElement(应用状态提供者, null, createElement(探针)));
    expect(screen.getByText([
      '保存个人优势', '保存首次意向', '保存意向', '保存简历', '删除岗位', '删除意向',
      '切身份', '发布岗位', '完成手机登录', '开始手机登录', '归档岗位', '微信登录',
      '更新岗位', '退出登录', '重开岗位',
      // P0 修复 Task 2：招聘方数据显式重试（会话操作）
      '重新水合招聘方数据',
      // P1C 组织域方法（组织操作）
      '选择企业关系', '保存未认证公司声明', '保存招聘方档案', '读取企业管理员申请',
      '创建企业管理员申请', '取消企业管理员申请', '接受企业邀请', '替换招聘方头像',
      '保存企业档案', '上传并发布企业媒体', '移除企业媒体', '读取公开企业',
      // P0 修复 Task 1：招聘方组织链重试
      '重新水合招聘方组织',
      // P3 隐私域方法（隐私操作）
      '设置雇主隐私', '设置披露偏好', '搜索可屏蔽组织', '添加组织屏蔽', '解除组织屏蔽',
      // P6 Agent 规则域方法（Agent规则操作）
      '刷新Agent规则', '创建Agent规则提案', '创建Agent规则替换提案', '刷新Agent规则提案',
      '接受Agent规则提案', '放弃Agent规则提案', '切换Agent规则', '删除Agent规则',
      // P4 发现推荐域读 + Task 4 refresh/feedback + Task 5 委托方法（发现推荐操作）
      '设置发现推荐范围', '加载候选岗位', '读取候选岗位详情',
      '加载招聘候选', '加载招聘已筛', '读取招聘候选详情',
      '刷新候选岗位', '标记岗位不感兴趣', '刷新招聘候选',
      '设置候选收藏', '淘汰候选', '撤销淘汰候选',
      '委托候选岗位', '委托招聘候选', '刷新委托',
      // P2 附件简历域方法（附件简历操作）；P5 追加委托前的权威库准备
      '刷新附件简历', '创建附件简历', '替换附件简历', '删除附件简历', '请求附件解析', '下载附件简历',
      '准备候选委托简历',
      // P5 MatchCase 域方法（MatchCase操作）：scope 注册、工作区/历史窗口、详情直读、
      // S0–S3 命令、叮嘱与披露后的简历 PDF 租约
      '设置P5范围', '加载工作区', '追加工作区', '刷新工作区',
      '加载历史', '追加历史', '刷新历史',
      '读取详情', '回答事实', '提交简历', '决定S0', '决定S1', '决定S2', '决定S3',
      '新增叮嘱', '读取简历PDF',
      // P7 真人会话域方法（真人会话操作）：收件箱/会话可见范围注册、列表/详情/消息
      // 读取与分页、发送对账、显式放弃、forward-only 已读与失效通知
      '设置P7收件箱范围', '设置P7会话范围', '加载会话列表', '追加会话列表',
      '读取真人会话', '追加更早消息', '发送真人消息', '放弃真人消息意图',
      '提交真人已读', '使真人会话失效',
      // P8 控制面域方法（P8账号控制面操作，Task 5 起全量组合）：范围登记、
      // 凭证/会话按需读取、换绑开始/完成与退出其他设备、导出恢复/创建/刷新/废弃/
      // 下载地址与账号注销；Task 6 起加合规反馈、Task 7 起加上下文举报（两法齐备）
      '设置P8账号范围', '加载P8凭证', '加载P8会话',
      '开始P8手机号换绑', '完成P8手机号换绑', '退出P8其他设备',
      '恢复P8数据导出', '创建P8数据导出', '刷新P8数据导出',
      '废弃P8数据导出', '取P8数据导出下载地址', '请求P8账号注销',
      '提交P8反馈', '提交P8举报',
    ].sort().join('|'))).toBeTruthy();
  });

  it('Backend 恢复会话与主体，角色完成后才派发切身份', async () => {
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    function 探针() {
      const { 后端状态, 操作 } = use应用状态();
      return createElement('button', { onClick: () => 操作.切身份('招聘方') }, 后端状态.初始化);
    }
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(探针)));
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('完成'));
    await userEvent.click(screen.getByRole('button'));
    expect(后端.确保角色).toHaveBeenCalledWith('recruiter');
    expect(后端.记录当前角色).toHaveBeenCalledWith('recruiter');
    expect(后端.确保角色.mock.invocationCallOrder[0]).toBeLessThan(后端.记录当前角色.mock.invocationCallOrder[0]);
  });

  // P7 Task 2：P7 内存快照随主体基串（subject + 角色）转移清空；
  // 任何 P7 值（会话项、消息正文、幂等键）都不写 localStorage/sessionStorage。
  it('P7 会话状态随角色转移清空且不落任何持久化', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 会话行: P7会话项 = {
      conversationId: '3003', caseId: 'mc_3003', kind: 'human_handoff',
      lastMessage: null, lastActivityAt: '2026-08-30T01:00:00Z', unreadCount: 1,
      contextStatus: 'available',
      context: { primaryLabel: '后端工程师', secondaryLabel: '上海', jobRef: null, resumeRef: null },
    };
    vi.mocked(后端.读取会话列表).mockResolvedValue({ items: [会话行], nextCursor: null });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    const 会话存储 = 创建Map存储();
    vi.stubGlobal('sessionStorage', 会话存储);
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => {
      await 当前.操作.加载会话列表('candidate', true);
    });
    expect(当前.后端状态.P7收件箱.candidate.items).toEqual([会话行]);
    const setItem调用 = () => [
      ...vi.mocked(localStorage.setItem).mock.calls,
      ...vi.mocked(会话存储.setItem).mock.calls,
    ].map((调用) => JSON.stringify(调用));
    const 写入前 = setItem调用().length;
    // 切身份 = 角色转移：P7 域整体摊平（收件箱/详情/消息页回空底座）
    await act(async () => {
      await 当前.操作.切身份('招聘方');
    });
    expect(当前.后端状态.P7收件箱.candidate.items).toEqual([]);
    expect(当前.后端状态.P7会话详情).toEqual({});
    expect(当前.后端状态.P7消息页).toEqual({});
    // P7 值绝不进持久化：新增写入里既无会话坐标也无消息正文
    for (const 写入 of setItem调用().slice(写入前)) {
      expect(写入).not.toContain('3003');
      expect(写入).not.toContain('后端工程师');
    }
  });

  // P7 Task 5：Backend 登录后挂起同源事件连接；Mock 模式零连接。
  it('Backend 登录后挂起一条同源事件连接，Mock 模式零连接', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await waitFor(() => expect(假WebSocket.构造记录.length).toBeGreaterThanOrEqual(1));
    expect(假WebSocket.构造记录[0]).toContain('/api/v1/events/live');
    const 构造数 = 假WebSocket.构造记录.length;
    // 同一 Provider 的 Mock 渲染：零新增连接
    render(createElement(应用状态提供者, null, createElement(上下文探针)));
    await act(async () => {});
    expect(假WebSocket.构造记录.length).toBe(构造数);
  });

  it('401 只清后端状态，不载入 Mock 支持域', async () => {
    const 后端 = 创建后端桩();
    后端.恢复会话.mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    function 探针() {
      const { 后端状态, 状态 } = use应用状态();
      return createElement('output', null, JSON.stringify({ 后端状态, 岗位数: 状态.岗位列表.length, 意向数: 状态.求职意向表.length }));
    }
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(探针)));
    // getByText 找不到即抛，waitFor 据此重试
    await waitFor(() => screen.getByText(/"初始化":"完成"/));
    expect(screen.getByText(/"已登录":false/)).toBeDefined();
    expect(screen.getByText(/"岗位数":0/)).toBeDefined();
    expect(screen.getByText(/"意向数":0/)).toBeDefined();
  });

  // P1C Task 2：mount 恢复 recruiter 会话时，subject fence 与新 generation 必须在
  // 第一个异步组织请求（读取招聘方档案）之前就绪 —— 否则首个 profile 响应会被
  // 当成 stale 丢掉。owner Jobs 只能在组织水合之后读取。
  it('Backend mount recruiter 先立 fence 再水合组织，owner Jobs 在组织之后', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('recruiter');
    const 档案门 = deferred<BFF招聘方档案>();
    vi.mocked(后端.读取招聘方档案).mockReturnValue(档案门.promise);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    // 首个组织请求已发出（fence 必须在此之前已写入），响应稍后才到达
    await waitFor(() => expect(后端.读取招聘方档案).toHaveBeenCalled());
    档案门.resolve(BFF招聘方档案样本);
    await waitFor(() => expect(当前.状态.招聘方档案).toEqual(BFF招聘方档案样本));
    // affiliations → current → public organization 全链水合
    await waitFor(() => expect(当前.状态.当前企业关系编号).toBe(BFF企业关系样本.affiliation_id));
    expect(当前.状态.企业关系列表).toEqual([BFF企业关系样本]);
    expect(当前.状态.当前企业身份?.organization_id).toBe(BFF公开企业样本.organization_id);
    expect(当前.状态.企业档案快照).toEqual(BFF公开企业样本.profile);
    // owner Jobs 在组织水合之后
    expect(后端.读取岗位).toHaveBeenCalled();
    expect(后端.读取招聘方档案.mock.invocationCallOrder[0])
      .toBeLessThan(后端.读取岗位.mock.invocationCallOrder[0]);
    expect(当前.后端状态.初始化).toBe('完成');
    expect(当前.后端状态.已登录).toBe(true);
  });

  it('Backend 账号资料写回只含白名单字段，不含 P1C 已接管的旧字段', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('recruiter');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    const 会话 = 创建Map存储();
    vi.stubGlobal('sessionStorage', 会话);
    function 测试按钮() {
      const { 派发 } = use应用状态();
      return createElement('button', {
        onClick: () => {
          派发({ 型: '选择当前企业关系', 编号: BFF企业关系样本.affiliation_id });
          派发({ 型: '存未认证公司声明', 公司: '云衢科技' });
          派发({ 型: '设企业飞书接入', 接入: true });
        },
      }, '写入组织选择');
    }
    render(createElement(
      应用状态提供者,
      { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } },
      [createElement(上下文探针), createElement(测试按钮)],
    ));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await userEvent.click(document.querySelector('button')!);
    await waitFor(() => expect(会话.setItem).toHaveBeenCalledWith(
      'AGXP账号资料v2:backend:stg:sub_1',
      expect.stringContaining('"当前企业关系编号":"aff_1"'),
    ));
    const 范围内写入 = 会话.setItem.mock.calls
      .filter(([键]) => 键 === 'AGXP账号资料v2:backend:stg:sub_1')
      .map(([, 值]) => String(值));
    const 最后快照 = JSON.parse(范围内写入.at(-1)!);
    expect(最后快照).toEqual({
      当前企业关系编号: 'aff_1',
      未认证公司声明: '云衢科技',
      求职头像: null,
      飞书已接入: false,
      企业飞书已接入: true,
    });
  });
});

// ── 候选侧写操作：并发锁 + 409 冲突恢复 + 成功才水合 ───────────────
// Task 7：保存简历/意向 的 Backend 分支。

describe('应用状态提供者 候选写操作', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  it('Backend 简历保存成功后才派发服务端映射结果', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 保存完成 = deferred<页面简历快照>();
    vi.mocked(后端.保存简历).mockReturnValue(保存完成.promise);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    const 页面 = 从BFF简历(BFF简历样本);
    const 页面写入: 页面简历写入 = { 基本信息: 页面.基本信息, 个人优势: 页面.个人优势, 技能: 页面.技能, 经历: 页面.经历, 教育: 页面.教育, 证书: 页面.证书 };
    const 请求 = 当前.操作.保存简历({ ...页面写入, 基本信息: { ...页面.基本信息, 真名: '新名' } });
    // 进行中：不乐观派发，状态仍是旧值
    expect(当前.状态.基本信息.真名).toBe('沈亦舟');
    保存完成.resolve({ ...页面, 基本信息: { ...页面.基本信息, 真名: '新名' } });
    await 请求;
    await waitFor(() => expect(当前.状态.基本信息.真名).toBe('新名'));
  });

  it('部分保存失败时采用错误携带的重新读取快照且不使用 Mock', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 权威 = 从BFF简历({ ...BFF简历样本, skills: ['服务端权威技能'], skills_revision: 4 });
    vi.mocked(后端.保存简历).mockRejectedValue(Object.assign(new BFF错误(409, 'version_conflict', 'stale'), { 权威简历: 权威 }));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    const 页面 = 从BFF简历(BFF简历样本);
    const 页面写入: 页面简历写入 = { 基本信息: 页面.基本信息, 个人优势: 页面.个人优势, 技能: 页面.技能, 经历: 页面.经历, 教育: 页面.教育, 证书: 页面.证书 };
    await expect(当前.操作.保存简历({ ...页面写入, 技能: ['本地未确认技能'] })).rejects.toMatchObject({ code: 'version_conflict' });
    await waitFor(() => expect(当前.状态.简历技能).toEqual(['服务端权威技能']));
    expect(当前.状态.简历技能).not.toContain('本地未确认技能');
  });

  it('同一个 Backend 写操作进行中时拒绝重复提交', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 完成 = deferred<页面意向快照>();
    vi.mocked(后端.创建意向).mockReturnValue(完成.promise);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    const 草稿 = {
      编辑编号: null, 求职类型: '全职' as const, 工作城市: '上海', 期望职位: '产品经理',
      工作城市引用: { id: 'loc_sh', display_name: '上海' }, 职位引用: { id: 'tax_p', display_name: '产品经理' },
      感兴趣城市们: [] as string[], 感兴趣城市引用们: [] as never[],
      薪资下限: 10, 薪资上限: 20, 期望行业们: [] as string[], 行业引用们: [] as never[],
      办公方式: ['hybrid'], 后端招聘类型: null, 求职类型已改: false,
    };
    const 第一次 = 当前.操作.保存意向(草稿);
    const 第二次 = 当前.操作.保存意向(草稿);
    // Task 6：保存意向 不再按需取目录，创建意向 同步调用（不再 waitFor）
    expect(后端.创建意向).toHaveBeenCalledTimes(1);
    完成.resolve({ 列表: [], 服务端: {} });
    await Promise.all([第一次, 第二次]);
  });

  it('Backend 意向更新 409 后重新读取权威资源而不覆盖本地冲突值', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 初始意向 = { 编号: 'int_1', 标题: '[上海] 产品经理', 说明: '300-500 元/天' };
    const 初始快照 = { 列表: [初始意向], 服务端: { int_1: BFF意向样本 } };
    const 最新意向 = { 编号: 'int_1', 标题: '[上海] 服务端最新职位', 说明: '400-600 元/天' };
    const 最新快照 = {
      列表: [最新意向],
      服务端: { int_1: { ...BFF意向样本, revision: 2 } },
    };
    vi.mocked(后端.读取意向).mockResolvedValueOnce(初始快照).mockResolvedValueOnce(最新快照);
    vi.mocked(后端.更新意向).mockRejectedValue(new BFF错误(409, 'version_conflict', 'stale'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    const 草稿 = {
      编辑编号: 'int_1',
      求职类型: '全职' as const,
      工作城市: '上海',
      工作城市引用: { id: 'loc_sh', display_name: '上海' },
      期望职位: '本地冲突职位',
      职位引用: { id: 'tax_p', display_name: '产品经理' },
      感兴趣城市们: [] as string[],
      感兴趣城市引用们: [] as never[],
      薪资下限: 10,
      薪资上限: 20,
      期望行业们: [] as string[],
      行业引用们: [] as never[],
      办公方式: ['hybrid'],
      后端招聘类型: 'internship' as const,
      求职类型已改: false,
    };
    await expect(当前.操作.保存意向(草稿)).rejects.toMatchObject({ code: 'version_conflict' });
    // 初始化水合一次 + 409 后重新读取一次 = 两次
    expect(后端.读取意向).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(当前.状态.求职意向表).toEqual([最新意向]));
    // 本地冲突值不应落入选中状态
    expect(当前.状态.求职意向表.some((条) => 条.标题.includes('本地冲突职位'))).toBe(false);
  });
});

// ── 招聘方岗位写操作：服务端真实 ID + revision ETag + 409 重读不覆盖 ───────────────
// Task 8：发布/更新/归档/重开/删除 岗位的 Backend 分支。

describe('应用状态提供者 招聘方岗位写操作', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  it('Backend 发布岗位使用服务端 ID，且不播种 Mock 起步候选', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('recruiter');
    const 服务端岗位 = { ...BFF岗位样本, job_id: 'job_real_1' };
    vi.mocked(后端.创建岗位).mockResolvedValue({ 列表: [{ ...页面岗位样本, 编号: 'job_real_1' }], 服务端: { job_real_1: 服务端岗位 } });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await 当前.操作.发布岗位({ ...页面岗位样本, 编号: 'P-临时' });
    await waitFor(() => expect(当前.状态.岗位列表[0].编号).toBe('job_real_1'));
    expect(当前.状态.企业候选列表.some((item) => item.岗位编号 === 'job_real_1')).toBe(false);
  });

  it('Backend 更新使用当前 revision，409 后重新读取而不覆盖', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('recruiter');
    const 初始 = { 列表: [页面岗位样本], 服务端: { [BFF岗位样本.job_id]: BFF岗位样本 } };
    const 最新列表 = [{ ...页面岗位样本, 名称: '服务端最新岗位名' }];
    vi.mocked(后端.读取岗位).mockResolvedValueOnce(初始).mockResolvedValueOnce({ 列表: 最新列表, 服务端: 初始.服务端 });
    vi.mocked(后端.更新岗位).mockRejectedValue(new BFF错误(409, 'version_conflict', 'stale'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await expect(当前.操作.更新岗位({ ...页面岗位样本, 名称: '本地冲突名称' })).rejects.toMatchObject({ code: 'version_conflict' });
    expect(后端.读取岗位).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(当前.状态.岗位列表).toEqual(最新列表));
  });
});

// ── 切身份后水合目标角色支持域（F3）+ 退出登录 401 清本地会话（F12）+ StrictMode 双跑（F1）──

describe('应用状态提供者 切身份与退出登录', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  it('候选切到招聘方后水合目标角色的岗位列表（F3）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    // mount-init 时 candidate → 读取简历/意向；切身份后 recruiter → 读取岗位
    const 岗位快照 = { 列表: [{ ...页面岗位样本, 编号: 'job_real_1', 名称: '后端工程师' }], 服务端: { job_real_1: BFF岗位样本 } };
    vi.mocked(后端.读取岗位).mockResolvedValue(岗位快照);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 切之前：候选盘空
    expect(当前.状态.岗位列表).toEqual([]);
    await 当前.操作.切身份('招聘方');
    expect(后端.确保角色).toHaveBeenCalledWith('recruiter');
    expect(后端.记录当前角色).toHaveBeenCalledWith('recruiter');
    // 切身份触发了一次 读取岗位（mount-init 候选侧不读岗位）
    expect(后端.读取岗位).toHaveBeenCalled();
    await waitFor(() => expect(当前.状态.岗位列表.map((岗) => 岗.名称)).toContain('后端工程师'));
  });

  it('退出登录 401 视同成功：清空本地会话且不抛错（F12）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.退出登录).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await expect(当前.操作.退出登录()).resolves.toBeUndefined();
    // 设后端状态 触发的重渲染是异步的，waitFor 等到已登录 落 false
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.主体).toBe(null);
    expect(当前.后端状态.简历快照).toBe(null);
    expect(当前.后端状态.意向快照).toEqual({});
    expect(当前.后端状态.岗位快照).toEqual({});
  });

  it('退出登录非 401 错误原样抛出，不清本地会话（F12）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.退出登录).mockRejectedValue(new BFF错误(500, 'internal_error', 'boom'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await expect(当前.操作.退出登录()).rejects.toMatchObject({ code: 'internal_error' });
  });

  // #5：切身份时水合失败应 reject，让 选身份.tsx catch 显示 轻提示并留在原地，
  // 不导航进空壳。确保角色/记录当前角色仍已执行，后端状态.主体仍已更新。
  it('切身份 水合失败时 reject，角色/主体仍已更新（#5）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取岗位).mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await expect(当前.操作.切身份('招聘方')).rejects.toMatchObject({ code: 'downstream_unavailable' });
    expect(后端.确保角色).toHaveBeenCalledWith('recruiter');
    expect(后端.记录当前角色).toHaveBeenCalledWith('recruiter');
    await waitFor(() => expect(当前.后端状态.主体?.last_used_role).toBe('recruiter'));
  });

  it('mount-init 水合失败仍完成初始化（不阻塞启动）（#5）', async () => {
    const 后端 = 创建后端桩('recruiter');
    vi.mocked(后端.读取岗位).mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    function 探针() {
      const { 后端状态 } = use应用状态();
      return createElement('output', null, JSON.stringify({ 初始化: 后端状态.初始化, 已登录: 后端状态.已登录 }));
    }
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(探针)));
    await waitFor(() => screen.getByText(/"初始化":"完成"/));
    expect(screen.getByText(/"已登录":true/)).toBeDefined();
  });

  // #6：开始手机登录 失败时清除尝试引用，完成手机登录 不用过期 attempt 提交。
  it('开始手机登录 失败时清除尝试引用，完成手机登录 用空 attempt（#6）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.开始手机登录).mockRejectedValue(new BFF错误(503, 'sms_unavailable', 'down'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await expect(当前.操作.开始手机登录('13800000000')).rejects.toMatchObject({ code: 'sms_unavailable' });
    // 尝试引用已清除 → 完成手机登录 用空串调 BFF
    await 当前.操作.完成手机登录('1234');
    expect(后端.完成手机登录).toHaveBeenCalledWith('', '1234');
  });

  it('effect 依赖变更后（同实例 cleanup→setup）初始化仍能落到 完成（F1）', async () => {
    // 同实例的 effect 依赖变更触发 cleanup→setup（模拟 StrictMode 的双跑行为）。
    // 修复前：第一次 已初始化.current 置 true 但被取消，cleanup 不复位 ref → 第二次 setup 早退 → 永远 进行中。
    // 修复后：cleanup 复位 ref → 第二次 setup 重新跑初始化。
    const 恢复完成 = deferred<{ identity_id: string; session_id: string; expires_at: string }>();
    const 后端1 = 创建后端桩('candidate');
    vi.mocked(后端1.恢复会话).mockReturnValue(恢复完成.promise);
    const 后端2 = 创建后端桩('candidate');
    const 后端源1 = 后端1 as unknown as HTTP招聘数据源;
    const 后端源2 = 后端2 as unknown as HTTP招聘数据源;
    const 数据源1 = { 模式: 'backend' as const, 后端环境: 'stg' as const, 后端: 后端源1 };
    const 数据源2 = { 模式: 'backend' as const, 后端环境: 'stg' as const, 后端: 后端源2 };
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const { rerender } = render(createElement(应用状态提供者, { 数据源: 数据源1 }, createElement(上下文探针)));
    // 第一次 init 已开始但未完成（恢复会话 返回 deferred）
    expect(后端1.恢复会话).toHaveBeenCalled();
    // 改变 后端 引用 → effect deps 变化 → cleanup（取消第一次 + 复位 ref）→ setup（重新跑 init）
    rerender(createElement(应用状态提供者, { 数据源: 数据源2 }, createElement(上下文探针)));
    // 第二次 setup 的 init（用 后端2）应完成
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.已登录).toBe(true);
    expect(后端2.恢复会话).toHaveBeenCalled();
    // 清理：resolve 第一次的 deferred（第一次 init 已被取消，resolve 不会影响状态）
    恢复完成.resolve({ identity_id: 'id_1', session_id: 'sess_1', expires_at: '2026-08-25T00:00:00Z' });
  });

  // ── P0 修复 Task 1：招聘方档案 / 组织链两个水合阶段的种子与登出复位 ──

  it('Provider 种子把招聘方两个阶段落在 未开始', () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    render(createElement(应用状态提供者, null, createElement(上下文探针)));
    expect(当前.后端状态.招聘方档案水合阶段).toBe('未开始');
    expect(当前.后端状态.招聘方组织水合).toEqual({ 阶段: '未开始', 错误: null });
  });

  it('登出把招聘方两个阶段恢复到未开始并清空未认证公司声明', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('recruiter');
    // mount 时组织链失败 → 两个阶段都落在非 未开始，登出必须把它们清回底座
    vi.mocked(后端.读取招聘方档案).mockRejectedValue(new BFF错误(503, 'service_unavailable', 'down'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await waitFor(() => expect(当前.后端状态.招聘方组织水合.阶段).toBe('失败'));
    expect(当前.后端状态.招聘方档案水合阶段).toBe('失败');
    expect(当前.后端状态.招聘方组织水合.错误).toBeTruthy();
    act(() => { 当前.操作.保存未认证公司声明('上个账号的公司'); });
    await waitFor(() => expect(当前.状态.未认证公司声明).toBe('上个账号的公司'));
    await act(async () => { await 当前.操作.退出登录(); });
    await waitFor(() => expect(当前.后端状态.招聘方档案水合阶段).toBe('未开始'));
    expect(当前.后端状态.招聘方组织水合).toEqual({ 阶段: '未开始', 错误: null });
    expect(当前.状态.未认证公司声明).toBe('');
  });

  it('mount 恢复换主体时把招聘方两个阶段恢复到未开始', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    // A：招聘方且 profile 缺失 → 档案阶段落在 缺失
    const 后端A = 创建后端桩('recruiter');
    vi.mocked(后端A.读取招聘方档案).mockRejectedValue(new BFF错误(404, 'not_found', 'missing'));
    // B：另一个主体且是候选人 —— 水合角色数据 不进招聘方分支，两个阶段只能由 mount 复位收口
    const 后端B = 创建后端桩('candidate');
    vi.mocked(后端B.读取主体).mockResolvedValue({
      ...BFF主体样本, subject_id: 'sub_b', last_used_role: 'candidate',
    });
    const 数据源A = { 模式: 'backend' as const, 后端环境: 'stg' as const, 后端: 后端A as unknown as HTTP招聘数据源 };
    const 数据源B = { 模式: 'backend' as const, 后端环境: 'stg' as const, 后端: 后端B as unknown as HTTP招聘数据源 };
    const { rerender } = render(createElement(应用状态提供者, { 数据源: 数据源A }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.招聘方档案水合阶段).toBe('缺失'));
    // 后端 引用变化 → mount effect cleanup→setup → 以 sub_b 重跑恢复
    rerender(createElement(应用状态提供者, { 数据源: 数据源B }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.主体?.subject_id).toBe('sub_b'));
    expect(当前.后端状态.招聘方档案水合阶段).toBe('未开始');
    expect(当前.后端状态.招聘方组织水合).toEqual({ 阶段: '未开始', 错误: null });
  });

  it('重新水合招聘方组织 在缺失档案上重跑整条链并落成功', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('recruiter');
    vi.mocked(后端.读取招聘方档案).mockRejectedValueOnce(new BFF错误(503, 'service_unavailable', 'down'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.招聘方组织水合.阶段).toBe('失败'));
    await act(async () => { await 当前.操作.重新水合招聘方组织(); });
    await waitFor(() => expect(当前.后端状态.招聘方组织水合).toEqual({ 阶段: '成功', 错误: null }));
    expect(当前.后端状态.招聘方档案水合阶段).toBe('成功');
  });
});

// ── Task 2：目录不再随初始化预取；candidate 水合并行；Mock 原型缓存隔离 ───────────────

/** Map 存储的 localStorage 桩：setItem/getItem 可往返，用于断言 Mock 原型键字节不变。 */
function 创建Map存储() {
  const 存 = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => 存.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { 存.set(key, value); }),
    removeItem: vi.fn((key: string) => { 存.delete(key); }),
    clear: vi.fn(() => 存.clear()),
  };
}

describe('应用状态提供者 目录水合与原型缓存隔离', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', 创建Map存储());
  });

  // Task 2：candidate 初始化并行读取简历与 active 意向，不再预取目录。
  // Task 7：读取目录 已删除，这里只断言简历/意向独立提交。
  it('candidate 初始化独立提交简历和 active 意向', async () => {
    const 后端 = 创建后端桩('candidate');
    const 简历快照 = 从BFF简历(BFF简历样本);
    const 意向快照 = { 列表: [], 服务端: {} } as 页面意向快照;
    vi.mocked(后端.读取简历).mockResolvedValue(简历快照);
    vi.mocked(后端.读取意向).mockResolvedValue(意向快照);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }));
    await waitFor(() => expect(后端.读取简历).toHaveBeenCalled());
    expect(后端.读取意向).toHaveBeenCalled();
    expect(后端.读取意向).toHaveBeenCalledWith();
  });

  // Task 2：交互式切身份也不预取目录。
  // Task 7：读取目录 已删除，这里只断言切身份后水合目标角色岗位。
  it('交互式切换角色水合目标角色岗位', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await 当前.操作.切身份('招聘方');
    await waitFor(() => expect(后端.读取岗位).toHaveBeenCalled());
  });

  // Task 2：Backend 水合与退出不覆盖 Mock 原型缓存（AGXP简历v2 / AGXP求职筛选v1）。
  it('Backend 水合和退出不覆盖 Mock 原型缓存', async () => {
    localStorage.setItem('AGXP简历v2', '{"PM":"mock-resume"}');
    localStorage.setItem('AGXP求职筛选v1', '{"PM":"mock-onboarding"}');
    const before = [localStorage.getItem('AGXP简历v2'), localStorage.getItem('AGXP求职筛选v1')];
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await 当前.操作.退出登录();
    expect([localStorage.getItem('AGXP简历v2'), localStorage.getItem('AGXP求职筛选v1')]).toEqual(before);
  });

  it('Backend 资料只读写当前 subject_id 的 sessionStorage 仓', async () => {
    const 本地 = 创建Map存储();
    const 会话 = 创建Map存储();
    vi.stubGlobal('localStorage', 本地);
    vi.stubGlobal('sessionStorage', 会话);
    会话.setItem('AGXP账号资料v2:backend:stg:sub_A', JSON.stringify({
      企业认证: { 姓名: 'A 用户', 公司: 'A 公司' },
      求职头像: '章:1',
    }));
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_A' });
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端 as unknown as HTTP招聘数据源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.状态.企业认证.姓名).toBe('A 用户'));
    expect(当前.状态.求职头像).toBe('章:1');
    expect(本地.setItem.mock.calls.some(([key]) => String(key).startsWith('AGXP账号资料v2:backend:'))).toBe(false);
  });

  it('同一 Provider 切换主体时只水合新账号资料', async () => {
    const 会话 = 创建Map存储();
    vi.stubGlobal('sessionStorage', 会话);
    const 快照 = (姓名: string) => JSON.stringify({ 企业认证: { 姓名, 公司: `${姓名}公司` } });
    会话.setItem('AGXP账号资料v2:backend:stg:sub_A', 快照('A'));
    会话.setItem('AGXP账号资料v2:backend:stg:sub_B', 快照('B'));
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体)
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_A' })
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_B' });
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端 as unknown as HTTP招聘数据源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.状态.企业认证.姓名).toBe('A'));
    await 当前.操作.完成手机登录('1234');
    await waitFor(() => expect(当前.状态.企业认证.姓名).toBe('B'));
    expect(当前.状态.资料缓存范围键).toBe('AGXP账号资料v2:backend:stg:sub_B');
  });
});

// ── review-r1 P1-4 / P1-5 / P1-6：Backend 种子不读 Mock 缓存；401/退出清草稿；
//    目录查询 401 走统一会话清理 ──────────────────────────────────────────────

describe('应用状态提供者 review-r1 Backend 边界', () => {
  function 创建Map存储() {
    const 存 = new Map<string, string>();
    return {
      getItem: vi.fn((key: string) => 存.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { 存.set(key, value); }),
      removeItem: vi.fn((key: string) => { 存.delete(key); }),
      clear: vi.fn(() => 存.clear()),
    };
  }

  beforeEach(() => {
    vi.stubGlobal('localStorage', 创建Map存储());
  });

  // P1-4：Backend 种子状态不读 Mock 的 AGXP求职筛选v1 缓存——
  // 浏览器先前跑过 Mock 时该键存了 Mock 城市/职位字符串，Backend onboarding 不该把它们当答案。
  it('Backend 种子引导预填为 null，不读 Mock 求职筛选缓存（P1-4）', async () => {
    localStorage.setItem('AGXP求职筛选v1', JSON.stringify({ 城市们: ['上海'], 职位: ['产品经理'] }));
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.状态.引导预填).toBe(null);
  });

  // P1-5：Backend 退出登录后，引导预填 / 意向草稿 都归零，不带到下一个账号。
  it('退出登录清空 引导预填 与 意向草稿（P1-5）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 先写入草稿与引导预填，模拟用户填到一半
    当前.派发({ 型: '改意向草稿', 补丁: { 期望职位: '后端工程师', 职位引用: { id: 'tax_be', display_name: '后端工程师' } } });
    当前.派发({
      型: '存引导预填',
      城市们: ['上海'],
      职位: ['产品经理'],
      城市引用们: [{ id: 'loc_sh', display_name: '上海' }],
      职位引用们: [{ id: 'tax_pm', display_name: '产品经理' }],
    });
    await waitFor(() => expect(当前.状态.意向草稿.期望职位).toBe('后端工程师'));
    expect(当前.状态.引导预填).not.toBe(null);
    await 当前.操作.退出登录();
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.状态.引导预填).toBe(null);
    expect(当前.状态.意向草稿.期望职位).toBe('');
    expect(当前.状态.意向草稿.职位引用).toBeUndefined();
  });

  // P1-5：意向写操作 401 也清草稿与引导预填（不只清服务端快照）。
  it('意向写入 401 清空 引导预填 与 意向草稿（P1-5）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.创建意向).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    当前.派发({ 型: '改意向草稿', 补丁: { 期望职位: '后端工程师' } });
    当前.派发({ 型: '存引导预填', 城市们: ['上海'], 职位: ['产品经理'], 城市引用们: [], 职位引用们: [] });
    const 草稿 = {
      编辑编号: null, 求职类型: '全职' as const, 工作城市: '上海', 期望职位: '后端工程师',
      工作城市引用: { id: 'loc_sh', display_name: '上海' }, 职位引用: { id: 'tax_be', display_name: '后端工程师' },
      感兴趣城市们: [] as string[], 感兴趣城市引用们: [] as never[],
      薪资下限: 10, 薪资上限: 20, 期望行业们: [] as string[], 行业引用们: [] as never[],
      办公方式: ['hybrid'], 后端招聘类型: null, 求职类型已改: false,
    };
    await expect(当前.操作.保存意向(草稿)).rejects.toMatchObject({ code: 'invalid_session' });
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.状态.引导预填).toBe(null);
    expect(当前.状态.意向草稿.期望职位).toBe('');
  });

  // P1-6：目录查询 401 也走统一会话清理（派发空快照 + 后端状态已登录=false + 清空目录缓存），
  // 不只是资源写操作的 401 才清。选择器开着时会话过期 → 目录请求 401 → 会话被清。
  it('目录查询 401 触发会话清理：派发空快照、后端状态登出、清空目录缓存（P1-6）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    // 目录查询方法 401
    后端.查询Institution = vi.fn(async () => { throw new BFF错误(401, 'invalid_session', 'expired'); }) as never;
    后端.查询Taxonomy = vi.fn(async () => { throw new BFF错误(401, 'invalid_session', 'expired'); }) as never;
    后端.查询Location = vi.fn(async () => { throw new BFF错误(401, 'invalid_session', 'expired'); }) as never;
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.已登录).toBe(true);
    // 选择器开着时会话过期 → 调目录查询 → 401
    const 目录查询 = 当前.目录查询!;
    await expect(目录查询.查询Institution({ q: '清华' })).rejects.toMatchObject({ code: 'invalid_session' });
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.主体).toBe(null);
    expect(后端.清空目录缓存).toHaveBeenCalled();
    // 服务端支持域也清空了
    expect(当前.状态.求职意向表).toEqual([]);
    expect(当前.状态.岗位列表).toEqual([]);
  });

  // P1-6 补：目录查询 401 后还清草稿与引导预填（与资源写 401 同口径）。
  it('目录查询 401 也清空 引导预填 与 意向草稿（P1-6）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    后端.查询Institution = vi.fn(async () => { throw new BFF错误(401, 'invalid_session', 'expired'); }) as never;
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    当前.派发({ 型: '改意向草稿', 补丁: { 期望职位: '后端工程师' } });
    当前.派发({ 型: '存引导预填', 城市们: ['上海'], 职位: ['产品经理'], 城市引用们: [], 职位引用们: [] });
    await expect(当前.目录查询!.查询Institution({ q: '清华' })).rejects.toMatchObject({ code: 'invalid_session' });
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.状态.引导预填).toBe(null);
    expect(当前.状态.意向草稿.期望职位).toBe('');
  });
});

// ── review-r2 R2-I-3 / R2-I-4 / R2-M-4：会话边界——水合 401、主体切换、目录 stale 401 ──

describe('应用状态提供者 review-r2 会话边界', () => {
  function 创建Map存储() {
    const 存 = new Map<string, string>();
    return {
      getItem: vi.fn((key: string) => 存.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { 存.set(key, value); }),
      removeItem: vi.fn((key: string) => { 存.delete(key); }),
      clear: vi.fn(() => 存.clear()),
    };
  }

  beforeEach(() => {
    vi.stubGlobal('localStorage', 创建Map存储());
  });

  // R2-I-3：mount-init 恢复会话 200 但水合时 读取简历 401（会话在水合途中过期），
  // 旧实现只 轻提示 然后落 已登录=true，本地还挂着上个会话的草稿/快照。
  it('水合 401 清会话不落 已登录=true（R2-I-3）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取简历).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.已登录).toBe(false);
    expect(当前.后端状态.主体).toBe(null);
    expect(当前.后端状态.简历快照).toBe(null);
    expect(后端.清空目录缓存).toHaveBeenCalled();
    // 草稿也被清（与资源写 401 同口径）
    expect(当前.状态.引导预填).toBe(null);
  });

  // R2-I-4：同一 Provider 实例下主体 subject_id 变化时，上个账号的草稿/快照要先清掉。
  it('主体 subject_id 变化时清空上个账号的草稿与快照（R2-I-4）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    // 主体 A（sub_A）先登录
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.主体?.subject_id).toBe('sub_A');
    // A 填了一些草稿
    当前.派发({ 型: '改意向草稿', 补丁: { 期望职位: 'A 的职位' } });
    current派发引导预填(当前, '上海');
    await waitFor(() => expect(当前.状态.意向草稿.期望职位).toBe('A 的职位'));
    // B 在同一 Provider 登录（完成手机登录 → 读取主体 返回 sub_B）
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_B' });
    await 当前.操作.完成手机登录('1234');
    await waitFor(() => expect(当前.后端状态.主体?.subject_id).toBe('sub_B'));
    // A 的草稿/引导预填被清，不串到 B
    expect(当前.状态.意向草稿.期望职位).toBe('');
    expect(当前.状态.引导预填).toBe(null);
  });

  // R2-I-4 补：同一 subject_id 再次登录（如刷新后再登录）不清空草稿。
  it('同 subject_id 再次登录不清空草稿（R2-I-4）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    current派发引导预填(当前, '上海');
    await waitFor(() => expect(当前.状态.引导预填).not.toBe(null));
    // 同 subject_id 再次完成手机登录
    await 当前.操作.完成手机登录('1234');
    // 草稿保留
    expect(当前.状态.引导预填).not.toBe(null);
  });

  // R2-M-4：目录请求开始 → 退出+重登（新会话）→ 旧请求的 401 到达 → 新会话不被踢。
  it('stale 目录 401 不清 newer 会话（R2-M-4）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    // 主体先登录（sub_A）
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 目录请求开始（deferred，稍后才 reject 401）
    const 目录拒绝 = deferred<never>();
    后端.查询Institution = vi.fn(async () => 目录拒绝.promise) as never;
    const 目录请求 = 当前.目录查询!.查询Institution({ q: '清华' });
    // 退出登录 + 重新登录（新会话代际）
    await 当前.操作.退出登录();
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    // 重新登录：读取主体 返回新主体
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_A' });
    await 当前.操作.完成手机登录('5678');
    await waitFor(() => expect(当前.后端状态.已登录).toBe(true));
    // 旧请求的 401 到达
    目录拒绝.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(目录请求).rejects.toMatchObject({ code: 'invalid_session' });
    // 新会话仍然登录（stale 401 被忽略）
    await waitFor(() => expect(当前.后端状态.已登录).toBe(true));
    expect(当前.后端状态.主体).not.toBe(null);
  });
});

/** 测试辅助：派发一个带引用的 存引导预填（避免每个测试重复写一长串参数） */
function current派发引导预填(当前: ReturnType<typeof use应用状态>, 城市: string) {
  当前.派发({
    型: '存引导预填',
    城市们: [城市],
    职位: ['产品经理'],
    城市引用们: [{ id: 'loc_sh', display_name: 城市 }],
    职位引用们: [{ id: 'tax_pm', display_name: '产品经理' }],
  });
}

// ── review-r3 R3-I-2 / R3-I-3 / R3-I-4：会话边界收口——全 401 统一清理、登录读主体失败、切身份 401 ──

describe('应用状态提供者 review-r3 会话边界收口', () => {
  function 创建Map存储() {
    const 存 = new Map<string, string>();
    return {
      getItem: vi.fn((key: string) => 存.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { 存.set(key, value); }),
      removeItem: vi.fn((key: string) => { 存.delete(key); }),
      clear: vi.fn(() => 存.clear()),
    };
  }

  beforeEach(() => {
    vi.stubGlobal('localStorage', 创建Map存储());
  });

  // R3-I-2：意向 401 必须清掉全部支持域快照（简历/意向/岗位），不只清意向。
  it('意向写入 401 清空全部支持域快照与草稿（R3-I-2）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.创建意向).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 模拟已水合的支持域有内容
    当前.派发({ 型: '改意向草稿', 补丁: { 期望职位: '后端工程师' } });
    当前.派发({ 型: '存引导预填', 城市们: ['上海'], 职位: ['产品经理'], 城市引用们: [], 职位引用们: [] });
    const 草稿 = {
      编辑编号: null, 求职类型: '全职' as const, 工作城市: '上海', 期望职位: '后端工程师',
      工作城市引用: { id: 'loc_sh', display_name: '上海' }, 职位引用: { id: 'tax_be', display_name: '后端工程师' },
      感兴趣城市们: [] as string[], 感兴趣城市引用们: [] as never[],
      薪资下限: 10, 薪资上限: 20, 期望行业们: [] as string[], 行业引用们: [] as never[],
      办公方式: ['hybrid'], 后端招聘类型: null, 求职类型已改: false,
    };
    await expect(当前.操作.保存意向(草稿)).rejects.toMatchObject({ code: 'invalid_session' });
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    // 三个支持域的后端快照都清空（不只意向）
    expect(当前.后端状态.简历快照).toBe(null);
    expect(当前.后端状态.意向快照).toEqual({});
    expect(当前.后端状态.岗位快照).toEqual({});
    // 状态层支持域也清空
    expect(当前.状态.求职意向表).toEqual([]);
    expect(当前.状态.岗位列表).toEqual([]);
    // 草稿也清
    expect(当前.状态.引导预填).toBe(null);
    expect(当前.状态.意向草稿.期望职位).toBe('');
    expect(后端.清空目录缓存).toHaveBeenCalled();
  });

  // R3-I-2 补：岗位 401 也清掉简历/意向快照（不只岗位）
  it('岗位写入 401 清空全部支持域快照与草稿（R3-I-2）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('recruiter');
    vi.mocked(后端.创建岗位).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    当前.派发({ 型: '改意向草稿', 补丁: { 期望职位: '后端工程师' } });
    当前.派发({ 型: '存引导预填', 城市们: ['上海'], 职位: ['产品经理'], 城市引用们: [], 职位引用们: [] });
    await expect(当前.操作.发布岗位({ ...页面岗位样本, 编号: 'P-临时' })).rejects.toMatchObject({ code: 'invalid_session' });
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.简历快照).toBe(null);
    expect(当前.后端状态.意向快照).toEqual({});
    expect(当前.后端状态.岗位快照).toEqual({});
    expect(当前.状态.引导预填).toBe(null);
    expect(当前.状态.意向草稿.期望职位).toBe('');
    expect(后端.清空目录缓存).toHaveBeenCalled();
  });

  // R3-I-3：完成手机登录 → 读取主体 401 → 已登录 保持 false，且已清理
  it('完成手机登录 读取主体 401 不落 已登录 且清理会话（R3-I-3）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 先有些上个账号的草稿
    当前.派发({ 型: '改意向草稿', 补丁: { 期望职位: '旧职位' } });
    当前.派发({ 型: '存引导预填', 城市们: ['上海'], 职位: ['产品经理'], 城市引用们: [], 职位引用们: [] });
    await 当前.操作.完成手机登录('1234');
    // 读取主体 401 → 不落 已登录，清理会话
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.主体).toBe(null);
    expect(当前.状态.引导预填).toBe(null);
    expect(当前.状态.意向草稿.期望职位).toBe('');
    expect(后端.清空目录缓存).toHaveBeenCalled();
  });

  // R3-I-3 补：读取主体 非 401 失败也不落 已登录=true，留未登录 + 轻提示
  it('完成手机登录 读取主体 非401 失败留未登录（R3-I-3）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await 当前.操作.完成手机登录('1234');
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.主体).toBe(null);
  });

  // R3-I-4：切身份 → 确保角色 401 → 全清理，已登录 false；本地角色不切
  it('切身份 确保角色 401 全清理且本地角色不切（R3-I-4）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.确保角色).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 切之前是 candidate（已登录）
    expect(当前.后端状态.已登录).toBe(true);
    await expect(当前.操作.切身份('招聘方')).rejects.toMatchObject({ code: 'invalid_session' });
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.主体).toBe(null);
    expect(当前.状态.引导预填).toBe(null);
    expect(后端.清空目录缓存).toHaveBeenCalled();
    // 本地 Tab 仍是求职者的「职位」（切身份 派发未执行）
    expect(当前.状态.当前Tab).toBe('职位');
  });

  // R3-I-4 补：切身份 记录当前角色 401 也全清理
  it('切身份 记录当前角色 401 全清理（R3-I-4）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.记录当前角色).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await expect(当前.操作.切身份('招聘方')).rejects.toMatchObject({ code: 'invalid_session' });
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.状态.当前Tab).toBe('职位');
  });
});

// ── P6 Task 4：mount / 退出 会话水合与清理（含 Backend 种子首帧隔离）──────────────

describe('应用状态提供者 P6 会话水合与清理', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  it('candidate mount hydrates P6 with the role and lands the page arrays', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取Agent规则).mockResolvedValue([BFFAgent规则样本]);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(后端.读取Agent规则).toHaveBeenCalledWith('candidate');
    await waitFor(() => expect(当前.后端状态.Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' }));
    // Provider effect 从 raw 快照投影页面数组
    await waitFor(() => expect(当前.状态.全局规则.map((条) => 条.编号)).toEqual([BFFAgent规则样本.rule_id]));
  });

  it('mount with last_used_role null leaves P6 empty and page arrays clear', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩(null);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.已登录).toBe(true);
    // 保持身份选择页：不读任何规则，P6 状态停在干净底座
    expect(后端.读取Agent规则).not.toHaveBeenCalled();
    expect(当前.后端状态.候选规则快照).toEqual({});
    expect(当前.后端状态.招聘规则快照).toEqual({});
    expect(当前.后端状态.候选规则提案).toEqual({});
    expect(当前.后端状态.招聘规则提案).toEqual({});
    expect(当前.后端状态.Agent规则水合).toEqual({
      candidate: { rules: '未开始', proposals: '未开始' },
      recruiter: { rules: '未开始', proposals: '未开始' },
    });
    expect(当前.状态.全局规则).toEqual([]);
    expect(当前.状态.意向级规则).toEqual([]);
    expect(当前.状态.企业规则).toEqual([]);
  });

  it('mount 水合 401 clears P6 dicts, resets stages, and clears page arrays', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取简历).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.已登录).toBe(false);
    // P6 也被拉进统一清理：阶段回 未开始、原始字典与页面数组清空
    expect(后端.读取Agent规则).toHaveBeenCalledWith('candidate');
    expect(当前.后端状态.候选规则快照).toEqual({});
    expect(当前.后端状态.招聘规则快照).toEqual({});
    expect(当前.后端状态.Agent规则水合).toEqual({
      candidate: { rules: '未开始', proposals: '未开始' },
      recruiter: { rules: '未开始', proposals: '未开始' },
    });
    expect(当前.状态.全局规则).toEqual([]);
    expect(当前.状态.意向级规则).toEqual([]);
    expect(当前.状态.企业规则).toEqual([]);
  });

  it('退出登录 clears P6 raw dicts and page arrays', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取Agent规则).mockResolvedValue([BFFAgent规则样本]);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.候选规则快照[BFFAgent规则样本.rule_id]).toBeDefined());
    await 当前.操作.退出登录();
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.候选规则快照).toEqual({});
    expect(当前.后端状态.Agent规则水合).toEqual({
      candidate: { rules: '未开始', proposals: '未开始' },
      recruiter: { rules: '未开始', proposals: '未开始' },
    });
    expect(当前.状态.全局规则).toEqual([]);
    expect(当前.状态.意向级规则).toEqual([]);
    expect(当前.状态.企业规则).toEqual([]);
  });
});

// ── P4 Task 3：Backend 初始 discovery raw 快照为空底座；Mock 发现域种子不动 ─────────

describe('应用状态提供者 P4 发现初始状态', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  it('Backend 初始 P4 发现快照为空底座，Mock 发现种子保持不变', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.候选岗位推荐).toEqual({});
    expect(当前.后端状态.候选岗位详情).toEqual({});
    expect(当前.后端状态.候选岗位不可用).toEqual([]);
    expect(当前.后端状态.招聘可用候选).toEqual({});
    expect(当前.后端状态.招聘已筛候选).toEqual({});
    expect(当前.后端状态.招聘已筛聚合).toEqual({ 阶段: '未开始', jobKey: '', error: null });
    expect(当前.后端状态.招聘候选详情).toEqual({});
    expect(当前.后端状态.招聘候选不可用).toEqual([]);
    expect(当前.后端状态.P4委托回执).toEqual({});
    expect(当前.后端状态.P4真实Case引用).toEqual({});
    // Mock 发现域继续走 归约发现推荐 与既有种子（本轮未触碰）
    expect(初始状态.推荐列表.length).toBeGreaterThan(0);
    expect(初始状态.企业候选列表.length).toBeGreaterThan(0);
  });
});

// ── P4 fix-r1：Backend 当前意向的编号载体（当前意向编号）──────────
// 当前意向 是意向名（跨 Mock 全局同名复用、不可反查），P4 发现域的 scope 一律认
// 编号载体：水合落「仍 active 的原值，否则第一条 active」，切意向 只认随 action
// 带上的编号；Mock 不带编号，载体恒 null。

describe('当前意向编号 · Backend 意向编号载体', () => {
  const 列表与快照 = (entries: { 编号: string; active: boolean }[]) => {
    const 列表 = entries.map(({ 编号 }) => ({
      编号, 标题: `[上海] 产品经理`, 说明: '',
    }));
    const 服务端: Record<string, typeof BFF意向样本> = {};
    for (const { 编号, active } of entries) {
      服务端[编号] = { ...BFF意向样本, intention_id: 编号, status: active ? 'active' : 'archived' };
    }
    return { 列表, 服务端 };
  };

  it('水合后端意向 把载体落到列表序里第一条 active 意向', () => {
    const { 列表, 服务端 } = 列表与快照([
      { 编号: 'int_9', active: false },
      { 编号: 'int_1', active: true },
      { 编号: 'int_2', active: true },
    ]);
    const 水合后 = 归约(初始状态, { 型: '水合后端意向', 快照: { 列表, 服务端 } });
    expect(水合后.当前意向编号).toBe('int_1');
    expect(水合后.当前意向).toBe('产品经理');
  });

  it('重水合时保留仍 active 的已选载体；原值失效才回退第一条 active', () => {
    const 第一次 = 列表与快照([
      { 编号: 'int_1', active: true },
      { 编号: 'int_2', active: true },
    ]);
    const 水合后 = 归约(初始状态, { 型: '水合后端意向', 快照: 第一次 });
    const 已选第二条 = 归约(水合后, { 型: '切意向', 意向: '产品经理', 编号: 'int_2' });
    expect(已选第二条.当前意向编号).toBe('int_2');
    // 重水合（如编辑保存后的权威刷新）：int_2 仍 active → 保留用户的选择
    const 保留 = 归约(已选第二条, { 型: '水合后端意向', 快照: 第一次 });
    expect(保留.当前意向编号).toBe('int_2');
    // int_2 被归档：载体回退到剩余的第一条 active，不指向死意向
    const 归档后 = 列表与快照([
      { 编号: 'int_1', active: true },
      { 编号: 'int_2', active: false },
    ]);
    const 回退 = 归约(已选第二条, { 型: '水合后端意向', 快照: 归档后 });
    expect(回退.当前意向编号).toBe('int_1');
  });

  it('服务端改名后 当前意向 跟着载体走，绝不落到第一条的名字', () => {
    const 第一次 = 列表与快照([
      { 编号: 'int_1', active: true },
      { 编号: 'int_2', active: true },
    ]);
    const 已选第二条 = 归约(
      归约(初始状态, { 型: '水合后端意向', 快照: 第一次 }),
      { 型: '切意向', 意向: '产品经理', 编号: 'int_2' },
    );
    // int_2 服务端改名：载体仍是 int_2，标题必须跟着同一条走（名字反查会错落到 int_1）
    const 改名后 = {
      列表: [
        { 编号: 'int_1', 标题: '[上海] 产品经理', 说明: '' },
        { 编号: 'int_2', 标题: '[北京] 数据分析', 说明: '' },
      ],
      服务端: 第一次.服务端,
    };
    const 重水合 = 归约(已选第二条, { 型: '水合后端意向', 快照: 改名后 });
    expect(重水合.当前意向编号).toBe('int_2');
    expect(重水合.当前意向).toBe('数据分析');
  });

  it('水合不到任何 active 意向时载体归 null', () => {
    const { 列表, 服务端 } = 列表与快照([{ 编号: 'int_1', active: false }]);
    const 水合后 = 归约(初始状态, { 型: '水合后端意向', 快照: { 列表, 服务端 } });
    expect(水合后.当前意向编号).toBeNull();
  });

  it('重名意向按编号区分：切意向带编号时载体指向被点的那条', () => {
    const { 列表, 服务端 } = 列表与快照([
      { 编号: 'int_1', active: true },
      { 编号: 'int_2', active: true },
    ]);
    const 水合后 = 归约(初始状态, { 型: '水合后端意向', 快照: { 列表, 服务端 } });
    // 两条意向的意向名完全相同，只有编号能区分 —— 名字反查在这里是错的
    const 点第二条 = 归约(水合后, { 型: '切意向', 意向: '产品经理', 编号: 'int_2' });
    expect(点第二条.当前意向).toBe('产品经理');
    expect(点第二条.当前意向编号).toBe('int_2');
  });

  it('Mock 路径不带编号：切意向后载体归 null，Mock 行为原样', () => {
    const 先水合 = 归约(初始状态, {
      型: '水合后端意向',
      快照: 列表与快照([{ 编号: 'int_1', active: true }]),
    });
    expect(先水合.当前意向编号).toBe('int_1');
    // 顶栏在 Mock 下派发不带编号（字节级同型的旧 action）
    const 切回 = 归约(先水合, { 型: '切意向', 意向: '产品经理' });
    expect(切回.当前意向).toBe('产品经理');
    expect(切回.当前意向编号).toBeNull();
  });
});

// ── P2 Task 3：Provider 附件库快照 —— 四域水合 / 招聘方不读附件 / 清理路径 ──

describe('应用状态提供者 P2 附件库快照', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  const 附件库样本: BFF附件简历库 = {
    items: [{
      file_id: 'rf_1', display_name: '沈亦舟_简历_2026.pdf', revision: 1,
      current_version: {
        version_id: 'rfv_1', version: 1, size_bytes: 1, media_type: 'application/pdf',
        sha256: 'a'.repeat(64), created_at: '2026-08-28T00:00:00Z', parse: { status: 'not_started' },
      },
      created_at: '2026-08-28T00:00:00Z', updated_at: '2026-08-28T00:00:00Z',
    }],
    limits: { max_files: 3, max_file_bytes: 10485760, accepted_media_types: ['application/pdf'] },
  };

  it('candidate mount 水合提交附件库，P6 三路照旧，切到招聘方后清空且不读附件', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取附件简历库).mockResolvedValue(附件库样本);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 第四支持域已提交
    expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
    expect(当前.后端状态.附件简历库).toEqual(附件库样本);
    // P6 三路并发照旧且阶段收口
    expect(后端.读取Agent规则).toHaveBeenCalledWith('candidate');
    await waitFor(() => expect(当前.后端状态.Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' }));
    // 切到招聘方：附件快照清空且招聘方水合不读附件
    await 当前.操作.切身份('招聘方');
    await waitFor(() => expect(当前.后端状态.附件简历库).toBeNull());
    expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
  });

  it('mount 附件读取 401 统一清理：不落已登录，附件与 P6 同清', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取附件简历库).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.已登录).toBe(false);
    expect(当前.后端状态.附件简历库).toBeNull();
    expect(当前.后端状态.主体).toBe(null);
    expect(当前.后端状态.Agent规则水合.candidate).toEqual({ rules: '未开始', proposals: '未开始' });
    expect(后端.清空目录缓存).toHaveBeenCalled();
  });

  it('mount 附件读取非 401 失败不阻塞初始化：已登录照常，附件为 null，简历/P6 保留', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取附件简历库).mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.已登录).toBe(true);
    expect(当前.后端状态.附件简历库).toBeNull();
    expect(当前.后端状态.简历快照).not.toBe(null);
    await waitFor(() => expect(当前.后端状态.Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' }));
  });

  it('退出登录清空附件快照，P6 清理不回归', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取附件简历库).mockResolvedValue(附件库样本);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.附件简历库).toEqual(附件库样本));
    await 当前.操作.退出登录();
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.附件简历库).toBeNull();
    expect(当前.后端状态.候选规则快照).toEqual({});
    expect(当前.后端状态.Agent规则水合).toEqual({
      candidate: { rules: '未开始', proposals: '未开始' },
      recruiter: { rules: '未开始', proposals: '未开始' },
    });
  });

  it('换账号登录清空上个账号的附件快照', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取附件简历库).mockResolvedValue(附件库样本);
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.附件简历库).toEqual(附件库样本));
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_B' });
    await 当前.操作.完成手机登录('1234');
    await waitFor(() => expect(当前.后端状态.主体?.subject_id).toBe('sub_B'));
    expect(当前.后端状态.附件简历库).toBeNull();
  });
});

// ── P5 Task 3：Provider 的 MatchCase 运行时状态 —— 内存快照、会话清理与对象租约 ──

describe('应用状态提供者 P5 MatchCase 运行时状态', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  it('Backend 初始 P5 快照为空底座', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.P5工作区).toEqual({});
    expect(当前.后端状态.P5历史).toEqual({});
    expect(当前.后端状态.P5详情).toEqual({});
  });

  it('加载工作区经 facade 提交 scope 快照；成功后非 force 不重发', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 行: P5列表页['items'][number] = {
      role: 'candidate',
      state: {
        caseId: 'mc_1', lifecycle: 'open', stage: 'anonymous_screening', status: 'running',
        step: 'policy_check', round: 0, roundBudget: 3, needsUser: false,
        outcome: null, outcomeCode: null,
        createdAt: '2026-08-29T01:00:00Z', updatedAt: '2026-08-29T02:00:00Z', finalizedAt: null,
      },
      needsAction: true,
      intentionId: 'int_0123456789abcdef0123456789abcdef',
      job: {
        jobId: 'job_0123456789abcdef0123456789abcdef',
        job: { title: 'AI 产品实习生', location: '上海', publicSalaryRange: '300-500 元/天', requiredSkills: ['Python'] },
      },
    };
    vi.mocked(后端.读取P5Open列表).mockResolvedValue({ role: 'candidate', items: [行], nextCursor: null });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await 当前.操作.加载工作区('candidate', null);
    expect(后端.读取P5Open列表).toHaveBeenCalledWith('candidate', null, null);
    await waitFor(() => expect(当前.后端状态.P5工作区['p5:open:candidate:*']).toMatchObject({
      阶段: '成功', 刷新中: false, items: [行], nextCursor: null, 已加载页数: 1,
    }));
    await 当前.操作.加载工作区('candidate', null);
    expect(后端.读取P5Open列表).toHaveBeenCalledTimes(1);
  });

  it('Mock 模式零 P5 请求：操作惰性返回，不触碰任何 facade', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    render(createElement(应用状态提供者, null, createElement(上下文探针)));
    expect(当前.数据源模式).toBe('mock');
    await expect(当前.操作.加载工作区('candidate', null)).resolves.toBeUndefined();
    await expect(当前.操作.读取详情('candidate', 'mc_1', true)).resolves.toBeUndefined();
    await expect(当前.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天')).resolves.toBeUndefined();
    await expect(当前.操作.决定S0('mc_1', 'end')).resolves.toBeUndefined();
  });

  it('退出登录清空 P5 快照与引用（主体转移的反应式清理）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取P5Open列表).mockResolvedValue({ role: 'candidate', items: [], nextCursor: null });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await 当前.操作.加载工作区('candidate', null);
    await waitFor(() => expect(当前.后端状态.P5工作区['p5:open:candidate:*']).toMatchObject({ 阶段: '成功' }));
    await 当前.操作.退出登录();
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.P5工作区).toEqual({});
    expect(当前.后端状态.P5历史).toEqual({});
    expect(当前.后端状态.P5详情).toEqual({});
  });

  it('切身份（角色转移）清空 P5 快照', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取P5Open列表).mockResolvedValue({ role: 'candidate', items: [], nextCursor: null });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await 当前.操作.加载工作区('candidate', null);
    await waitFor(() => expect(当前.后端状态.P5工作区['p5:open:candidate:*']).toMatchObject({ 阶段: '成功' }));
    await 当前.操作.切身份('招聘方');
    await waitFor(() => expect(当前.后端状态.P5工作区).toEqual({}));
    expect(当前.后端状态.P5历史).toEqual({});
    expect(当前.后端状态.P5详情).toEqual({});
  });

  it('换主体登录清空上个账号的 P5 快照（主体基串变化）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取P5Open列表).mockResolvedValue({ role: 'candidate', items: [], nextCursor: null });
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await 当前.操作.加载工作区('candidate', null);
    await waitFor(() => expect(当前.后端状态.P5工作区['p5:open:candidate:*']).toMatchObject({ 阶段: '成功' }));
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_B' });
    await 当前.操作.完成手机登录('1234');
    await waitFor(() => expect(当前.后端状态.主体?.subject_id).toBe('sub_B'));
    expect(当前.后端状态.P5工作区).toEqual({});
    expect(当前.后端状态.P5历史).toEqual({});
    expect(当前.后端状态.P5详情).toEqual({});
  });

  it('退出登录回收在途 PDF 对象租约（URL.revokeObjectURL 恰好一次）', async () => {
    const 建造 = vi.fn(() => 'blob:p5-provider');
    const 回收 = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: 建造, configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: 回收, configurable: true, writable: true });
    try {
      let 当前!: ReturnType<typeof use应用状态>;
      function 上下文探针() { 当前 = use应用状态(); return null; }
      const 后端 = 创建后端桩('candidate');
      const 后端源 = 后端 as unknown as HTTP招聘数据源;
      render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
      await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
      const 租约 = await 当前.操作.读取简历PDF('candidate', 'mc_1');
      expect(建造).toHaveBeenCalledTimes(1);
      await 当前.操作.退出登录();
      await waitFor(() => expect(回收).toHaveBeenCalledWith('blob:p5-provider'));
      租约.revoke(); // 二次回收安全
    } finally {
      delete (URL as unknown as Record<string, unknown>).createObjectURL;
      delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
    }
  });
});

// ── P8 Task 3：Provider 的账号安全运行时状态 —— 空底座种子、按需读取、会话边界清理 ──
// P8 的 Provider 清理键只认主体（不带角色）：同主体切角色保留已确认的共享账号快照，
// 只递增 P8 范围代际并清待定意图；登出 / 401 / 换主体 / 卸载则三块快照整域摊平。

describe('应用状态提供者 P8 控制面运行时状态', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  const 手机凭证DTO: P8Credential = {
    credentialId: 'cred_0000000000000001',
    provider: 'phone_otp',
    display: '+86 138 **** 0000',
    verifiedAt: '2026-08-20T10:00:00Z',
  };

  it('Backend 初始 P8 控制面快照为空底座，初始化零 P8 请求', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    const 空底座 = { phase: 'idle', refreshing: false, data: null, error: null, generation: 0 };
    expect(当前.后端状态.credentials).toEqual(空底座);
    expect(当前.后端状态.sessions).toEqual(空底座);
    expect(当前.后端状态.dataExport).toEqual(空底座);
    // P8 是按需读取域：登录水合不触达凭证/会话
    expect(后端.读取P8凭证).not.toHaveBeenCalled();
    expect(后端.读取P8会话).not.toHaveBeenCalled();
  });

  it('加载P8凭证 经 Provider 提交成功快照；非 force 重复加载零请求', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取P8凭证).mockResolvedValue([手机凭证DTO]);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.加载P8凭证(); });
    expect(当前.后端状态.credentials).toMatchObject({ phase: 'success', data: [手机凭证DTO] });
    await act(async () => { await 当前.操作.加载P8凭证(); });
    expect(后端.读取P8凭证).toHaveBeenCalledTimes(1);
  });

  it('退出登录清空三块 P8 快照；P7/P6/附件/隐私清理不回归', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取P8凭证).mockResolvedValue([手机凭证DTO]);
    vi.mocked(后端.读取P8会话).mockResolvedValue([{
      sessionId: 'sess_0000000000000001',
      createdAt: '2026-08-30T00:00:00Z',
      expiresAt: '2026-09-05T00:00:00Z',
      current: true,
    }]);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.加载P8凭证(); });
    await act(async () => { await 当前.操作.加载P8会话(); });
    expect(当前.后端状态.credentials.data).toEqual([手机凭证DTO]);
    await 当前.操作.退出登录();
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    const 空底座 = { phase: 'idle', refreshing: false, data: null, error: null, generation: 0 };
    expect(当前.后端状态.credentials).toEqual(空底座);
    expect(当前.后端状态.sessions).toEqual(空底座);
    expect(当前.后端状态.dataExport).toEqual(空底座);
    // 相邻域清理不回归：P7 / P6 / 附件 / 隐私 / P4 同口径清空
    expect(当前.后端状态.P7收件箱.candidate.阶段).toBe('未开始');
    expect(当前.后端状态.候选规则快照).toEqual({});
    expect(当前.后端状态.附件简历库).toBeNull();
    expect(当前.后端状态.隐私快照).toBeNull();
    expect(当前.后端状态.候选岗位推荐).toEqual({});
    expect(当前.状态.屏蔽名单).toEqual([]);
  });

  it('换主体登录清空上个账号的 P8 快照（清理键只认主体）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取P8凭证).mockResolvedValue([手机凭证DTO]);
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.加载P8凭证(); });
    expect(当前.后端状态.credentials.data).toEqual([手机凭证DTO]);
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_B' });
    await 当前.操作.完成手机登录('1234');
    await waitFor(() => expect(当前.后端状态.主体?.subject_id).toBe('sub_B'));
    expect(当前.后端状态.credentials).toMatchObject({ phase: 'idle', data: null });
    expect(当前.后端状态.sessions).toMatchObject({ phase: 'idle', data: null });
  });

  it('同主体切角色保留已确认 P8 快照，非 force 重载零新请求', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取P8凭证).mockResolvedValue([手机凭证DTO]);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.加载P8凭证(); });
    await act(async () => { await 当前.操作.切身份('招聘方'); });
    // 同主体：已确认快照保留（candidate↔recruiter 共享账号事实）
    expect(当前.后端状态.credentials).toMatchObject({ phase: 'success', data: [手机凭证DTO] });
    await act(async () => { await 当前.操作.加载P8凭证(); });
    expect(后端.读取P8凭证).toHaveBeenCalledTimes(1); // 非 force 命中成功快照：零新请求
  });

  it('P8 读取 401 统一清账号并摊平 P8 域', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取P8凭证).mockResolvedValue([手机凭证DTO]);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.加载P8凭证(); });
    vi.mocked(后端.读取P8凭证).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    await act(async () => { await 当前.操作.加载P8凭证(true); });
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.主体).toBeNull();
    expect(当前.后端状态.credentials).toMatchObject({ phase: 'idle', data: null });
    expect(当前.后端状态.sessions).toMatchObject({ phase: 'idle', data: null });
  });

  it('Provider 卸载后的迟到结算被丢弃：迟到 resolve 不抛错、不再写状态', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 凭证门 = deferred<P8Credential[]>();
    vi.mocked(后端.读取P8凭证).mockReturnValueOnce(凭证门.promise);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    const { unmount } = render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    const 读 = 当前.操作.加载P8凭证(true);
    unmount(); // Provider 卸载：引用随实例消亡，迟到结算无处落位
    凭证门.resolve([手机凭证DTO]);
    await expect(读).resolves.toBeUndefined();
  });

  // ── Task 5：subject 绑定的导出恢复适配器 ─────────────────────────
  // Backend 主体在场才构造（local 存储 + 模式/环境/账号 三重隔离键）；主体/环境变化在
  // 渲染期先写 ref，子组件的被动恢复 effect 一定看到新适配器；Mock 恒 null、零存储触碰。

  it('Backend 主体在场即供给 subject 绑定适配器：预置句柄恢复只 GET 不 POST', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_1' });
    const 本地 = 创建Map存储();
    vi.stubGlobal('localStorage', 本地);
    本地.setItem('AGXPP8数据导出v1:backend:stg:sub_1', JSON.stringify({
      subjectId: 'sub_1', createKey: 'p8-export-key-0001', exportId: `exp_${'0123456789abcdef'.repeat(2)}`,
    }));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.恢复P8数据导出(); });
    expect(后端.读取P8数据导出).toHaveBeenCalledWith(`exp_${'0123456789abcdef'.repeat(2)}`);
    expect(后端.创建P8数据导出).not.toHaveBeenCalled();
    expect(当前.后端状态.dataExport).toMatchObject({ phase: 'success' });
  });

  it('同一 Provider 主体 A→B：适配器随渲染换绑，B 的创建只写 B 键，A 的句柄逐字节不变', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_A' });
    const 本地 = 创建Map存储();
    vi.stubGlobal('localStorage', 本地);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.创建P8数据导出(); });
    const A键 = 'AGXPP8数据导出v1:backend:stg:sub_A';
    const A原文 = 本地.getItem(A键);
    expect(A原文).toContain('"exportId"');
    const A写入数 = 本地.setItem.mock.calls.filter(([键]) => 键 === A键).length;
    // 同一 Provider 实例切换主体（完成手机登录换主体）：渲染期把 ref 换绑到 B 的适配器
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_B' });
    await act(async () => { await 当前.操作.完成手机登录('1234'); });
    await waitFor(() => expect(当前.后端状态.主体?.subject_id).toBe('sub_B'));
    await act(async () => { await 当前.操作.创建P8数据导出(); });
    const B键 = 'AGXPP8数据导出v1:backend:stg:sub_B';
    expect(本地.getItem(B键)).toContain('"exportId"');
    expect(本地.getItem(A键)).toBe(A原文); // A 的条目逐字节不变
    expect(本地.setItem.mock.calls.filter(([键]) => 键 === A键).length).toBe(A写入数); // 换主体后绝不再写 A
  });

  it('Mock 模式：P8导出恢复 引用保持 null、零 P8导出 存储；导出/注销写路径拒绝 backend_unavailable', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 本地 = 创建Map存储();
    vi.stubGlobal('localStorage', 本地);
    render(createElement(应用状态提供者, null, createElement(上下文探针)));
    await act(async () => {});
    await expect(当前.操作.创建P8数据导出()).rejects.toMatchObject({ code: 'backend_unavailable' });
    await expect(当前.操作.请求P8账号注销()).rejects.toMatchObject({ code: 'backend_unavailable' });
    await expect(当前.操作.恢复P8数据导出()).resolves.toBeUndefined();
    expect(当前.操作.取P8数据导出下载地址()).toBeNull();
    const P8导出键 = (键: string) => String(键).includes('P8数据导出');
    expect(本地.setItem.mock.calls.filter(([键]) => P8导出键(键))).toEqual([]); // 零存储触碰
  });

  it('注销 202 清三块 P8 快照并删除当前主体导出句柄；成功后由屏幕导航（操作层不导航）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_1' });
    const 本地 = 创建Map存储();
    vi.stubGlobal('localStorage', 本地);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.创建P8数据导出(); });
    expect(本地.getItem('AGXPP8数据导出v1:backend:stg:sub_1')).toContain('"exportId"');
    await act(async () => { await 当前.操作.请求P8账号注销(); });
    const 空底座 = { phase: 'idle', refreshing: false, data: null, error: null, generation: 0 };
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.credentials).toEqual(空底座);
    expect(当前.后端状态.sessions).toEqual(空底座);
    expect(当前.后端状态.dataExport).toEqual(空底座);
    expect(本地.getItem('AGXPP8数据导出v1:backend:stg:sub_1')).toBeNull(); // 句柄已删
    expect(后端.清空目录缓存).toHaveBeenCalled();
  });
});

// ── Task 4：候选 onboarding 草稿的 sessionStorage 持久化（主体域内恢复 + 生命周期清理）──
// 用真实 window.sessionStorage + Provider 渲染覆盖：恢复屏障（首帧空状态不覆盖存量草稿）、
// 写屏障（恢复未完成/无主体不写）、主体切换 / 登出 / 401 / 切角色的键清理、Mock 零触碰。

describe('应用状态提供者 候选引导草稿持久化', () => {
  function 本地Map存储() {
    const 存 = new Map<string, string>();
    return {
      getItem: vi.fn((key: string) => 存.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { 存.set(key, value); }),
      removeItem: vi.fn((key: string) => { 存.delete(key); }),
      clear: vi.fn(() => 存.clear()),
    };
  }

  const 键 = (账号: string) => 候选引导草稿键({ 模式: 'backend', 环境: 'stg', 账号 });
  const 草稿样本 = (覆盖?: Partial<候选引导草稿快照>): 候选引导草稿快照 => ({
    城市们: ['上海'],
    职位: ['后端工程师'],
    城市引用们: [{ id: 'loc_sh', display_name: '上海' }],
    职位引用们: [{ id: 'job_be', display_name: '后端工程师' }],
    筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['混合'] },
    薪资: { 下限: 30, 上限: 40, 单位: '月薪K' },
    到岗: '在职 · 考虑机会',
    ...覆盖,
  });

  beforeEach(() => {
    // 还原被先前用例 stub 掉的 sessionStorage：本组用真实 window.sessionStorage
    vi.unstubAllGlobals();
    globalThis.sessionStorage.clear();
    vi.stubGlobal('localStorage', 本地Map存储());
    假WebSocket.构造记录 = [];
    vi.stubGlobal('WebSocket', 假WebSocket);
  });

  it('全新候选主体空存储：填 30-40K，卸载重挂后薪资恢复', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    const 数据源 = { 模式: 'backend' as const, 后端环境: 'stg' as const, 后端: 后端源 };
    const { unmount } = render(createElement(应用状态提供者, { 数据源 }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 空存储：没有任何恢复，也没有键被创建
    expect(当前.状态.引导预填).toBe(null);
    expect(globalThis.sessionStorage.getItem(键('sub_1'))).toBe(null);
    当前.派发({ 型: '存薪资预填', 下限: 30, 上限: 40, 单位: '月薪K' });
    await waitFor(() => expect(当前.状态.引导预填?.薪资).toEqual({ 下限: 30, 上限: 40, 单位: '月薪K' }));
    await waitFor(() => expect(globalThis.sessionStorage.getItem(键('sub_1'))).toContain('"下限":30'));
    unmount();
    // 重挂：草稿从 sessionStorage 恢复
    render(createElement(应用状态提供者, { 数据源 }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await waitFor(() => expect(当前.状态.引导预填?.薪资).toEqual({ 下限: 30, 上限: 40, 单位: '月薪K' }));
  });

  it('预置 sub_A 草稿的重挂恢复薪资与到岗', async () => {
    写候选引导草稿(globalThis.sessionStorage, { 模式: 'backend', 环境: 'stg', 账号: 'sub_A' }, 草稿样本());
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await waitFor(() => expect(当前.状态.引导预填?.薪资).toEqual({ 下限: 30, 上限: 40, 单位: '月薪K' }));
    expect(当前.状态.引导预填?.到岗).toBe('在职 · 考虑机会');
    expect(当前.状态.引导预填?.职位).toEqual(['后端工程师']);
  });

  it('首帧空状态不在水合前覆盖 sub_A 的存量草稿', async () => {
    写候选引导草稿(globalThis.sessionStorage, { 模式: 'backend', 环境: 'stg', 账号: 'sub_A' }, 草稿样本());
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 初始化完成时存量草稿逐字节未被空状态顶掉（写屏障：恢复未完成不写）
    expect(globalThis.sessionStorage.getItem(键('sub_A'))).toContain('后端工程师');
    await waitFor(() => expect(当前.状态.引导预填?.职位).toEqual(['后端工程师']));
    expect(globalThis.sessionStorage.getItem(键('sub_A'))).toContain('"下限":30');
  });

  it('切到 sub_B：不恢复也不改写 sub_A 的答案，且主体转移清理 A 的键', async () => {
    写候选引导草稿(globalThis.sessionStorage, { 模式: 'backend', 环境: 'stg', 账号: 'sub_A' }, 草稿样本());
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await waitFor(() => expect(当前.状态.引导预填?.职位).toEqual(['后端工程师']));
    // 同一 Provider 换主体登录
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_B' });
    await 当前.操作.完成手机登录('1234');
    await waitFor(() => expect(当前.后端状态.主体?.subject_id).toBe('sub_B'));
    // A 的答案不串进 B 的内存态
    expect(当前.状态.引导预填).toBe(null);
    // A 的键在主体转移时清理；B 名下没有键被创建
    expect(globalThis.sessionStorage.getItem(键('sub_A'))).toBe(null);
    expect(globalThis.sessionStorage.getItem(键('sub_B'))).toBe(null);
  });

  it('退出登录删除当前候选草稿并清内存 引导预填', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    current派发引导预填(当前, '上海');
    await waitFor(() => expect(当前.状态.引导预填).not.toBe(null));
    await waitFor(() => expect(globalThis.sessionStorage.getItem(键('sub_1'))).toContain('产品经理'));
    await 当前.操作.退出登录();
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.状态.引导预填).toBe(null);
    expect(globalThis.sessionStorage.getItem(键('sub_1'))).toBe(null);
  });

  it('401 路径删除当前候选草稿并清内存 引导预填', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.创建意向).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    current派发引导预填(当前, '上海');
    await waitFor(() => expect(globalThis.sessionStorage.getItem(键('sub_1'))).toContain('产品经理'));
    const 草稿 = {
      编辑编号: null, 求职类型: '全职' as const, 工作城市: '上海', 期望职位: '后端工程师',
      工作城市引用: { id: 'loc_sh', display_name: '上海' }, 职位引用: { id: 'tax_be', display_name: '后端工程师' },
      感兴趣城市们: [] as string[], 感兴趣城市引用们: [] as never[],
      薪资下限: 10, 薪资上限: 20, 期望行业们: [] as string[], 行业引用们: [] as never[],
      办公方式: ['hybrid'], 后端招聘类型: null, 求职类型已改: false,
    };
    await expect(当前.操作.保存意向(草稿)).rejects.toMatchObject({ code: 'invalid_session' });
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.状态.引导预填).toBe(null);
    expect(globalThis.sessionStorage.getItem(键('sub_1'))).toBe(null);
  });

  it('候选切到招聘方删除原候选键', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    current派发引导预填(当前, '上海');
    await waitFor(() => expect(globalThis.sessionStorage.getItem(键('sub_1'))).toContain('产品经理'));
    await 当前.操作.切身份('招聘方');
    await waitFor(() => expect(当前.后端状态.主体?.last_used_role).toBe('recruiter'));
    expect(globalThis.sessionStorage.getItem(键('sub_1'))).toBe(null);
    expect(当前.状态.引导预填).toBe(null);
  });

  // Codex review-loop R1 [P2]：已提交（存在 active 意向）后，引导草稿不再属于
  // 「未提交答案」——不得写回 sessionStorage，也不得在重挂时恢复。
  it('保存首次意向成功（水合 active 意向）后删除已提交草稿键，内存薪资保留', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    当前.派发({ 型: '存薪资预填', 下限: 30, 上限: 40, 单位: '月薪K' });
    await waitFor(() => expect(globalThis.sessionStorage.getItem(键('sub_1'))).toContain('"下限":30'));
    // 保存首次意向成功的权威落点：水合后端意向（快照含唯一 active 意向）
    当前.派发({
      型: '水合后端意向',
      快照: { 列表: [{ 编号: 'int_1', 标题: '[上海] 后端工程师', 说明: '30-40K' }], 服务端: { int_1: BFF意向样本 } },
    });
    // 已提交答案不再以草稿形态落存储
    await waitFor(() => expect(globalThis.sessionStorage.getItem(键('sub_1'))).toBe(null));
    // 内存 引导预填 不被清（验收：返回/前进后薪资仍 30-40K，读的是内存预填）
    expect(当前.状态.引导预填?.薪资).toEqual({ 下限: 30, 上限: 40, 单位: '月薪K' });
  });

  it('已有 active 意向的候选重挂：不恢复存量草稿并删除该键', async () => {
    写候选引导草稿(globalThis.sessionStorage, { 模式: 'backend', 环境: 'stg', 账号: 'sub_A' }, 草稿样本());
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_A' });
    vi.mocked(后端.读取意向).mockResolvedValue({
      列表: [{ 编号: 'int_1', 标题: '[上海] 后端工程师', 说明: '30-40K' }],
      服务端: { int_1: BFF意向样本 },
    });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await waitFor(() => expect(当前.状态.求职意向表).toHaveLength(1));
    // 已提交的存量草稿既不恢复、也被清出存储：下一次刷新不会再带回已提交答案
    await waitFor(() => expect(globalThis.sessionStorage.getItem(键('sub_A'))).toBe(null));
  });

  it('删除最后一条 active 意向后：已消费的引导答案不再作为草稿回写，新答案可重新起草', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    当前.派发({ 型: '存薪资预填', 下限: 30, 上限: 40, 单位: '月薪K' });
    await waitFor(() => expect(globalThis.sessionStorage.getItem(键('sub_1'))).toContain('"下限":30'));
    const 活跃快照 = { 列表: [{ 编号: 'int_1', 标题: '[上海] 后端工程师', 说明: '30-40K' }], 服务端: { int_1: BFF意向样本 } };
    当前.派发({ 型: '水合后端意向', 快照: 活跃快照 });
    await waitFor(() => expect(globalThis.sessionStorage.getItem(键('sub_1'))).toBe(null));
    // 删除最后一条 active 意向：active→空，已消费的引导答案被清出内存与存储
    当前.派发({ 型: '水合后端意向', 快照: { 列表: [], 服务端: {} } });
    await waitFor(() => expect(当前.状态.引导预填).toBe(null));
    expect(globalThis.sessionStorage.getItem(键('sub_1'))).toBe(null);
    // 重新起草（新意向流程）不受影响：新答案照常落草稿
    当前.派发({ 型: '存薪资预填', 下限: 50, 上限: 60, 单位: '月薪K' });
    await waitFor(() => expect(globalThis.sessionStorage.getItem(键('sub_1'))).toContain('"下限":50'));
  });

  it('Mock 模式：Mock 原型 localStorage 逐字节不变，也不创建任何候选会话键', async () => {
    localStorage.setItem('AGXP简历v2', '{"PM":"mock-resume"}');
    localStorage.setItem('AGXP求职筛选v1', '{"PM":"mock-onboarding"}');
    const 本地 = localStorage as unknown as ReturnType<typeof 本地Map存储>;
    render(createElement(应用状态提供者, null));
    await act(async () => {});
    expect(本地.getItem('AGXP简历v2')).toBe('{"PM":"mock-resume"}');
    expect(本地.getItem('AGXP求职筛选v1')).toBe('{"PM":"mock-onboarding"}');
    // 候选草稿只认 Backend：Mock 模式绝不创建候选会话键
    const 会话键们 = Object.keys(globalThis.sessionStorage);
    expect(会话键们.some((名) => 名.includes('候选引导草稿'))).toBe(false);
  });
});
