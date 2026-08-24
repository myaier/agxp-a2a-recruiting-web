import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 初始状态, 归约, use应用状态, 应用状态提供者 } from './应用状态';
import { BFF主体样本, BFF简历样本, BFF岗位样本, BFF意向样本, 页面岗位样本 } from '../测试/BFF样本';
import { BFF错误 } from '../数据/HTTP客户端';
import type { BFF角色 } from '../数据/BFF契约';
import type { HTTP招聘数据源 } from '../数据/HTTP招聘数据源';
import type { 页面简历快照, 页面简历写入, 页面意向快照, 页面岗位快照 } from '../数据/招聘数据源类型';
import { 从BFF简历 } from '../数据/后端映射';

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
      期望职位: '产品经理',
      感兴趣城市们: ['北京'],
      薪资下限: 300,
      薪资上限: 500,
      期望行业们: ['金融'],
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

  it('由 Provider 在状态提交后统一持久化', async () => {
    function 测试按钮() {
      const { 派发 } = use应用状态();
      return createElement('button', { onClick: () => 派发({ 型: '设企业飞书接入', 接入: true }) }, '接入飞书');
    }

    render(createElement(应用状态提供者, null, createElement(测试按钮)));
    写入.mockClear();
    await userEvent.click(document.querySelector('button')!);

    await waitFor(() => expect(写入).toHaveBeenCalledWith('AGXP企业飞书接入v1', '1'));
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
    读取目录: vi.fn(async () => ({ 职位类别: [], 地点: [], 行业: [], 院校: [], 专业: [] })),
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
    const 草稿 = { 编辑编号: null, 求职类型: '全职' as const, 工作城市: '上海', 期望职位: '产品经理', 感兴趣城市们: [] as string[], 薪资下限: 10, 薪资上限: 20, 期望行业们: [] as string[], 后端招聘类型: null, 求职类型已改: false };
    const 第一次 = 当前.操作.保存意向(草稿);
    const 第二次 = 当前.操作.保存意向(草稿);
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
      期望职位: '本地冲突职位',
      感兴趣城市们: [] as string[],
      薪资下限: 10,
      薪资上限: 20,
      期望行业们: [] as string[],
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
