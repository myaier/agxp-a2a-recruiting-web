// 应用状态 · 归约（reducer 纯函数与种子域）
// 由 src/状态/应用状态.test.ts 按冻结归属拆出：reducer→归约。

import { createElement } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 初始状态, 归约, use应用状态, 应用状态提供者 } from './应用状态';
import { 创建初始状态, 空账号资料 } from './初始状态';
import { 空岗位硬性事实 } from '../数据/类型';
import { BFF意向样本, BFF企业关系样本, BFF企业档案样本, BFF企业管理员申请样本, BFF招聘方档案样本, BFF隐私快照样本 } from '../测试/BFF样本';
import { 从BFF隐私 } from '../数据/隐私映射';
import { type BFF公开企业 } from '../数据/BFF契约';
import { type HTTP招聘数据源 } from '../数据/HTTP招聘数据源';
import userEvent from '@testing-library/user-event';

beforeEach(() => {
  try {
    globalThis.sessionStorage.clear();
  } catch {
    // 个别存储降级测试会故意提供不可用实现。
  }
});

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
      求职类型: '实习生',
      毕业时间: null,
      实习月数: 3,
      每周到岗天数: 4,
      薪资周期: 'day',
      排除项: {
        alternate_weekend_work: 'unspecified',
        outsourcing_only: 'unspecified',
        onsite_only: 'unspecified',
        frequent_travel: 'unspecified',
      },
      私有偏好: '',
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

  it('Backend 种子不携带 legacy MatchCase 演示数组', () => {
    const 种子 = 创建初始状态({ 模式: 'backend', 后端环境: 'stg', 后端: {} as HTTP招聘数据源 });
    expect(种子.在谈列表).toEqual([]);
    expect(种子.企业候选列表).toEqual([]);
    expect(种子.归档列表).toEqual([]);
    expect(种子.企业归档列表).toEqual([]);
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

  // ── 首屏默认（Task 5B）：三个草稿动作自带基底，reducer 不再兜底 ['上海'] ──
  it('引导预填:null 时派发三类草稿动作带空基底，城市保持空数组', () => {
    const 空基底 = { 城市们: [], 职位: [], 城市引用们: [], 职位引用们: [] };
    const 存偏好 = 归约(初始状态, {
      型: '存求职筛选偏好', 偏好: { 求职类型: ['社招全职'], 办公方式: ['现场'] }, ...空基底,
    });
    expect(存偏好.引导预填?.城市们).toEqual([]);
    const 存薪资 = 归约(初始状态, {
      型: '存薪资预填', 下限: 20, 上限: 30, 单位: '月薪K', ...空基底,
    });
    expect(存薪资.引导预填?.城市们).toEqual([]);
    const 存到岗 = 归约(初始状态, { 型: '存到岗预填', 到岗: '在职 · 考虑机会', ...空基底 });
    expect(存到岗.引导预填?.城市们).toEqual([]);
  });

  it('动作携带 Mock 当前城市时结果保留，且 在校选择 只在显式传入时写', () => {
    const 上海基底 = { 城市们: ['上海'], 职位: [], 城市引用们: [], 职位引用们: [] };
    const 存偏好 = 归约(初始状态, {
      型: '存求职筛选偏好', 偏好: { 求职类型: ['实习生'], 办公方式: [] }, ...上海基底,
    });
    expect(存偏好.引导预填?.城市们).toEqual(['上海']);
    expect(存偏好.引导预填).not.toHaveProperty('在校选择');
    const 存身份 = 归约(存偏好, {
      型: '存求职筛选偏好', 偏好: { 求职类型: [], 办公方式: [] }, 在校选择: true, ...上海基底,
    });
    expect(存身份.引导预填?.在校选择).toBe(true);
  });
});
