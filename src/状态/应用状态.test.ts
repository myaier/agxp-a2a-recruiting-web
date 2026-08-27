import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 初始状态, 归约, use应用状态, 应用状态提供者 } from './应用状态';
import { 创建初始状态, 空账号资料 } from './初始状态';
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
} from '../测试/BFF样本';
import { 从BFF隐私 } from '../数据/隐私映射';
import { BFF错误 } from '../数据/HTTP客户端';
import type { BFF招聘方档案, BFF公开企业, BFF角色 } from '../数据/BFF契约';
import type { HTTP招聘数据源 } from '../数据/HTTP招聘数据源';
import type { 页面简历快照, 页面简历写入, 页面意向快照, 页面岗位快照 } from '../数据/招聘数据源类型';
import { 从BFF简历 } from '../数据/后端映射';

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
  };
}

describe('应用状态提供者 后端会话', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
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

  it('消息 action 删除真实存在的未读键', () => {
    const 下一 = 归约(初始状态, { 型: '读消息', 编号: 'X-01' });
    expect(初始状态.消息未读['X-01']).toBe(4);
    expect(下一.消息未读['X-01']).toBeUndefined();
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
      // P1C 组织域方法（组织操作）
      '选择企业关系', '保存未认证公司声明', '保存招聘方档案', '读取企业管理员申请',
      '创建企业管理员申请', '取消企业管理员申请', '接受企业邀请', '替换招聘方头像',
      '保存企业档案', '上传并发布企业媒体', '移除企业媒体', '读取公开企业',
      // P3 隐私域方法（隐私操作）
      '设置雇主隐私', '设置披露偏好', '搜索可屏蔽组织', '添加组织屏蔽', '解除组织屏蔽',
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
