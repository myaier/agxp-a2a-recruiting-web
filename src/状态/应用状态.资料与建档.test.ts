// 应用状态 · 资料与建档（资料写入/意向恢复/建档草稿/招聘方岗位写操作）
// 由 src/状态/应用状态.test.ts 按冻结归属拆出：资料写入/意向选择恢复/建档草稿→资料与建档（含消歧：招聘方岗位写操作→本文件）。

import { createElement } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 初始状态, 归约, use应用状态, 应用状态提供者 } from './应用状态';
import { BFF主体样本, BFF简历样本, BFF岗位样本, BFF意向样本, 页面岗位样本 } from '../测试/BFF样本';
import { BFF错误 } from '../数据/HTTP客户端';
import { type HTTP招聘数据源 } from '../数据/HTTP招聘数据源';
import { type 页面简历快照, type 页面简历写入, type 页面意向快照 } from '../数据/招聘数据源类型';
import { 从BFF简历 } from '../数据/后端映射';
import { 候选引导草稿键, 写候选引导草稿, 资料缓存键, type 候选引导草稿快照 } from '../数据/资料缓存';
import { deferred, 创建后端桩, 通过测试手机登录, 假WebSocket, current派发引导预填 } from './应用状态.测试辅助';

beforeEach(() => {
  try {
    globalThis.sessionStorage.clear();
  } catch {
    // 个别存储降级测试会故意提供不可用实现。
  }
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

  it('恢复编号 只在没有仍有效的旧选择时参与：旧选择优先，恢复值不抢占', () => {
    const 快照 = 列表与快照([
      { 编号: 'int_sh', active: true },
      { 编号: 'int_bj', active: true },
    ]);
    const 已选第一条 = 归约(
      归约(初始状态, { 型: '水合后端意向', 快照 }),
      { 型: '切意向', 意向: '产品经理', 编号: 'int_sh' },
    );
    const 重水合 = 归约(已选第一条, { 型: '水合后端意向', 快照, 恢复编号: 'int_bj' });
    expect(重水合.当前意向编号).toBe('int_sh');
  });

  it('首次水合带恢复编号：校验通过就落它，不落列表第一条', () => {
    const 快照 = 列表与快照([
      { 编号: 'int_sh', active: true },
      { 编号: 'int_bj', active: true },
    ]);
    const 水合后 = 归约(初始状态, { 型: '水合后端意向', 快照, 恢复编号: 'int_bj' });
    expect(水合后.当前意向编号).toBe('int_bj');
  });

  it('恢复编号 已归档 / 不在列表 / 为 null 时回退第一条 active；空表清空', () => {
    const 快照 = 列表与快照([
      { 编号: 'int_sh', active: true },
      { 编号: 'int_bj', active: false },
    ]);
    expect(归约(初始状态, { 型: '水合后端意向', 快照, 恢复编号: 'int_bj' }).当前意向编号)
      .toBe('int_sh');
    expect(归约(初始状态, { 型: '水合后端意向', 快照, 恢复编号: 'int_别人的' }).当前意向编号)
      .toBe('int_sh');
    expect(归约(初始状态, { 型: '水合后端意向', 快照, 恢复编号: null }).当前意向编号)
      .toBe('int_sh');
    const 空表 = 归约(初始状态, {
      型: '水合后端意向', 快照: { 列表: [], 服务端: {} }, 恢复编号: 'int_bj',
    });
    expect(空表.当前意向编号).toBeNull();
    expect(空表.当前意向).toBe('');
  });

  it('服务端字典有 active 但页面列表里没有那条时该编号无效，不当当前坐标', () => {
    const 服务端 = {
      int_sh: { ...BFF意向样本, intention_id: 'int_sh', status: 'active' as const },
      int_幽灵: { ...BFF意向样本, intention_id: 'int_幽灵', status: 'active' as const },
    };
    const 快照 = { 列表: [{ 编号: 'int_sh', 标题: '[上海] 产品经理', 说明: '' }], 服务端 };
    // 恢复偏好指向一条服务端有、页面列表没有的意向：不能被当成有效选择
    expect(归约(初始状态, { 型: '水合后端意向', 快照, 恢复编号: 'int_幽灵' }).当前意向编号)
      .toBe('int_sh');
  });

  it('没有任何 active 时展示名一并归空，绝不留名称兜底', () => {
    const 先有 = 归约(初始状态, {
      型: '水合后端意向',
      快照: 列表与快照([{ 编号: 'int_sh', active: true }]),
    });
    expect(先有.当前意向).toBe('产品经理');
    const 全归档 = 归约(先有, {
      型: '水合后端意向',
      快照: 列表与快照([{ 编号: 'int_sh', active: false }]),
    });
    expect(全归档.当前意向编号).toBeNull();
    // 旧实现会用 选新当前意向 把名字留在表头，与 null 载体不同源
    expect(全归档.当前意向).toBe('');
  });

  it('水合账号资料 丢弃缓存里的候选选择：只能经权威水合的 恢复编号 落地', () => {
    const 已选 = 归约(
      归约(初始状态, { 型: '水合后端意向', 快照: 列表与快照([{ 编号: 'int_sh', active: true }]) }),
      { 型: '切意向', 意向: '产品经理', 编号: 'int_sh' },
    );
    const 水合后 = 归约(已选, {
      型: '水合账号资料',
      范围键: 'k',
      快照: { 当前意向编号: 'int_缓存里的', 求职头像: null },
    });
    expect(水合后.当前意向编号).toBe('int_sh');
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

// ── DF-014：Backend 缓存不覆盖账户头像 ──────────────────────────────────────
// 头像以服务端 account-profile 权威回读（存求职头像）为唯一来源；会话缓存不持久化
// 也不恢复该字段，旧缓存里的 null / 旧 URL / 旧本地图片都不得覆盖服务端值，服务端
// 明确 null 必须清旧图，账户读取失败不得用缓存伪装权威成功。以下用例走真实
// Provider effect/action 接线（挂载水合 → 缓存 effect 水合 → 写回），不自制 reducer 输入。
// 注：生产接线里 缓存水合 effect 只随 主体变化触发，且发生在挂载水合完成之后 ——
// 「缓存值先于服务端落地」的次序由归约层 DF-014 用例覆盖，这里覆盖接线真实次序。

describe('应用状态提供者 DF-014 Backend 缓存不覆盖账户头像', () => {
  const 权威头像 = '/api/v1/me/avatar/content?v=3';
  const 旧本地图 = 'data:image/png;base64,AAAA';
  const 范围键 = (账号: string) => 资料缓存键({ 模式: 'backend', 环境: 'stg', 账号 });

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(),
    });
  });

  function 挂载(后端: HTTP招聘数据源) {
    let 当前!: ReturnType<typeof use应用状态>;
    function 探针() { 当前 = use应用状态(); return null; }
    render(createElement(
      应用状态提供者,
      { 数据源: { 模式: 'backend' as const, 后端环境: 'stg' as const, 后端 } },
      createElement(探针),
    ));
    return () => 当前;
  }

  it('服务端头像已落、缓存水合（旧 null）后到：不覆盖权威值，写回 JSON 不含头像键', async () => {
    globalThis.sessionStorage.setItem(范围键('sub_1'), JSON.stringify({ 求职头像: null }));
    const 后端 = {
      ...创建后端桩('candidate'),
      读取候选账号档案: vi.fn(async () =>
        ({ avatar_url: '/api/v1/me/avatar/content' as const, revision: 3, updated_at: '2026-09-01T00:00:00Z' })),
    };
    const 取当前 = 挂载(后端 as unknown as HTTP招聘数据源);
    await waitFor(() => expect(取当前().后端状态.初始化).toBe('完成'));
    // 服务端权威头像先落地
    await waitFor(() => expect(取当前().状态.求职头像).toBe(权威头像));
    // 缓存水合落地（资料缓存范围键 由 水合账号资料 写入）之后，旧 null 仍不得覆盖
    await waitFor(() => expect(取当前().状态.资料缓存范围键).toBe(范围键('sub_1')));
    expect(取当前().状态.求职头像).toBe(权威头像);
    // Backend 写回不含头像键：该字段不再是会话缓存的所有物
    await waitFor(() => expect(globalThis.sessionStorage.getItem(范围键('sub_1'))).not.toBe(null));
    expect('求职头像' in JSON.parse(globalThis.sessionStorage.getItem(范围键('sub_1'))!)).toBe(false);
  });

  it('缓存里的旧本地图片同样不覆盖服务端头像', async () => {
    globalThis.sessionStorage.setItem(范围键('sub_1'), JSON.stringify({ 求职头像: 旧本地图 }));
    const 后端 = {
      ...创建后端桩('candidate'),
      读取候选账号档案: vi.fn(async () =>
        ({ avatar_url: '/api/v1/me/avatar/content' as const, revision: 3, updated_at: '2026-09-01T00:00:00Z' })),
    };
    const 取当前 = 挂载(后端 as unknown as HTTP招聘数据源);
    await waitFor(() => expect(取当前().后端状态.初始化).toBe('完成'));
    await waitFor(() => expect(取当前().状态.资料缓存范围键).toBe(范围键('sub_1')));
    expect(取当前().状态.求职头像).toBe(权威头像);
  });

  it('服务端明确 null：清掉缓存里的旧本地图片', async () => {
    globalThis.sessionStorage.setItem(范围键('sub_1'), JSON.stringify({ 求职头像: 旧本地图 }));
    const 后端 = {
      ...创建后端桩('candidate'),
      读取候选账号档案: vi.fn(async () => ({ avatar_url: null, revision: 2, updated_at: '2026-09-01T00:00:00Z' })),
    };
    const 取当前 = 挂载(后端 as unknown as HTTP招聘数据源);
    await waitFor(() => expect(取当前().后端状态.初始化).toBe('完成'));
    await waitFor(() => expect(取当前().状态.资料缓存范围键).toBe(范围键('sub_1')));
    expect(取当前().状态.求职头像).toBeNull();
  });

  it('账户档案读取失败：不用缓存旧图伪装权威成功', async () => {
    globalThis.sessionStorage.setItem(范围键('sub_1'), JSON.stringify({ 求职头像: 旧本地图 }));
    const 后端 = {
      ...创建后端桩('candidate'),
      读取候选账号档案: vi.fn(async () => { throw new Error('network'); }),
    };
    const 取当前 = 挂载(后端 as unknown as HTTP招聘数据源);
    await waitFor(() => expect(取当前().后端状态.初始化).toBe('完成'));
    await waitFor(() => expect(取当前().状态.资料缓存范围键).toBe(范围键('sub_1')));
    expect(取当前().状态.求职头像).toBeNull();
  });

  it('切账号不沿用旧图：A 的权威头像与 A/B 的旧缓存都不进 B', async () => {
    globalThis.sessionStorage.setItem(范围键('sub_A'), JSON.stringify({ 求职头像: 旧本地图 }));
    globalThis.sessionStorage.setItem(范围键('sub_B'), JSON.stringify({ 求职头像: 旧本地图 }));
    const 后端 = {
      ...创建后端桩('candidate'),
      // A 本轮权威回读有头像；B 本轮权威回读明确无头像
      读取候选账号档案: vi.fn(async () => ({ avatar_url: null, revision: 1, updated_at: null })),
    };
    vi.mocked(后端.读取候选账号档案)
      .mockResolvedValueOnce({ avatar_url: '/api/v1/me/avatar/content', revision: 3, updated_at: '2026-09-01T00:00:00Z' });
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_A' });
    const 取当前 = 挂载(后端 as unknown as HTTP招聘数据源);
    await waitFor(() => expect(取当前().状态.求职头像).toBe(权威头像));
    // 同一 Provider 换主体登录：切账号先清空，再由 sub_B 的权威事实重建
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_B' });
    await 通过测试手机登录(取当前());
    await waitFor(() => expect(取当前().后端状态.主体?.subject_id).toBe('sub_B'));
    await waitFor(() => expect(取当前().状态.资料缓存范围键).toBe(范围键('sub_B')));
    // B 服务端明确无头像：A 的权威头像与 A/B 的旧缓存图都不出现
    expect(取当前().状态.求职头像).toBeNull();
  });
});

// ── Task 2：候选当前意向选择的会话恢复（sessionStorage → 权威校验 → 落状态）──
// 这里测的是「同一标签页 Provider 完整卸载重建」的刷新口径，不是内存里再水合一次。
describe('应用状态提供者 候选当前意向的会话恢复', () => {
  const 两条同名 = {
    列表: [
      { 编号: 'int_sh', 标题: '[上海] 产品经理', 说明: '20-35K' },
      { 编号: 'int_bj', 标题: '[北京] 产品经理', 说明: '25-40K' },
    ],
    服务端: {
      int_sh: { ...BFF意向样本, intention_id: 'int_sh', status: 'active' as const },
      int_bj: { ...BFF意向样本, intention_id: 'int_bj', status: 'active' as const },
    },
  };

  const 资料键 = (账号: string, 环境: 'stg' | 'local' = 'stg') =>
    资料缓存键({ 模式: 'backend', 环境, 账号 });

  const 种缓存 = (账号: string, 编号: string | null, 环境: 'stg' | 'local' = 'stg') => {
    globalThis.sessionStorage.setItem(资料键(账号, 环境), JSON.stringify({ 当前意向编号: 编号 }));
  };

  const 读缓存意向 = (账号: string, 环境: 'stg' | 'local' = 'stg') => {
    const 原文 = globalThis.sessionStorage.getItem(资料键(账号, 环境));
    return 原文 === null ? undefined : (JSON.parse(原文) as { 当前意向编号?: string | null }).当前意向编号;
  };

  function 挂载(后端: ReturnType<typeof 创建后端桩>, 环境: 'stg' | 'local' = 'stg') {
    let 当前!: ReturnType<typeof use应用状态>;
    function 探针() { 当前 = use应用状态(); return null; }
    const 视图 = render(createElement(
      应用状态提供者,
      { 数据源: { 模式: 'backend', 后端环境: 环境, 后端: 后端 as unknown as HTTP招聘数据源 } },
      createElement(探针),
    ));
    return { 视图, 取当前: () => 当前 };
  }

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(),
    });
  });

  it('权威水合前不落任何当前 ID（零 scope 请求），缓存里的 int_bj 也不被覆盖', async () => {
    种缓存(BFF主体样本.subject_id, 'int_bj');
    const 后端 = 创建后端桩('candidate');
    const 门 = deferred<页面意向快照>();
    vi.mocked(后端.读取意向).mockReturnValue(门.promise);
    const { 取当前 } = 挂载(后端);
    await waitFor(() => expect(后端.读取意向).toHaveBeenCalled());
    // 水合尚未结算：当前 ID 仍是 null —— 页面据此零 P4 / 零「当前」P5 请求
    expect(取当前().状态.当前意向编号).toBeNull();
    // 初始 null 不得被当成权威空列表写回缓存
    expect(读缓存意向(BFF主体样本.subject_id)).toBe('int_bj');
    await act(async () => { 门.resolve(两条同名); await 门.promise; });
    await waitFor(() => expect(取当前().状态.当前意向编号).toBe('int_bj'));
    expect(取当前().状态.当前意向).toBe('产品经理');
  });

  it('完整卸载重建后仍是第二条：选择经缓存 → 权威校验落回同一条', async () => {
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取意向).mockResolvedValue(两条同名);
    const 首次 = 挂载(后端);
    await waitFor(() => expect(首次.取当前().后端状态.初始化).toBe('完成'));
    // 首载没有偏好 → 落列表第一条
    expect(首次.取当前().状态.当前意向编号).toBe('int_sh');
    act(() => { 首次.取当前().派发({ 型: '切意向', 意向: '产品经理', 编号: 'int_bj' }); });
    await waitFor(() => expect(读缓存意向(BFF主体样本.subject_id)).toBe('int_bj'));
    首次.视图.unmount();

    const 重建 = 挂载(后端);
    await waitFor(() => expect(重建.取当前().状态.当前意向编号).toBe('int_bj'));
  });

  it('恢复 ID 已归档：回退首个有效项并把偏好更新成回退结果', async () => {
    种缓存(BFF主体样本.subject_id, 'int_bj');
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取意向).mockResolvedValue({
      列表: 两条同名.列表,
      服务端: {
        int_sh: 两条同名.服务端.int_sh,
        int_bj: { ...两条同名.服务端.int_bj, status: 'archived' as const },
      },
    });
    const { 取当前 } = 挂载(后端);
    await waitFor(() => expect(取当前().状态.当前意向编号).toBe('int_sh'));
    await waitFor(() => expect(读缓存意向(BFF主体样本.subject_id)).toBe('int_sh'));
  });

  it('权威空列表：清空选择并把 null 写回缓存', async () => {
    种缓存(BFF主体样本.subject_id, 'int_bj');
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取意向).mockResolvedValue({ 列表: [], 服务端: {} });
    const { 取当前 } = 挂载(后端);
    await waitFor(() => expect(取当前().后端状态.初始化).toBe('完成'));
    expect(取当前().状态.当前意向编号).toBeNull();
    await waitFor(() => expect(读缓存意向(BFF主体样本.subject_id)).toBeNull());
  });

  it('水合失败：不落任何当前 ID，也不把缓存偏好当成服务端成功结果抹掉', async () => {
    种缓存(BFF主体样本.subject_id, 'int_bj');
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取意向).mockRejectedValue(new Error('network'));
    const { 取当前 } = 挂载(后端);
    await waitFor(() => expect(取当前().后端状态.初始化).toBe('完成'));
    expect(取当前().状态.当前意向编号).toBeNull();
    expect(读缓存意向(BFF主体样本.subject_id)).toBe('int_bj');
  });

  it('recruiter 角色不读也不写候选选择：别人的偏好原样留在自己的键里', async () => {
    种缓存(BFF主体样本.subject_id, 'int_bj');
    const 后端 = 创建后端桩('recruiter');
    const { 取当前 } = 挂载(后端);
    await waitFor(() => expect(取当前().后端状态.初始化).toBe('完成'));
    expect(取当前().状态.当前意向编号).toBeNull();
    expect(读缓存意向(BFF主体样本.subject_id)).toBe('int_bj');
    expect(后端.读取意向).not.toHaveBeenCalled();
  });

  it('主体与环境隔离：别的 subject / 别的环境的偏好不会被读进来', async () => {
    种缓存('sub_别人', 'int_bj');
    种缓存(BFF主体样本.subject_id, 'int_bj', 'local');
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取意向).mockResolvedValue(两条同名);
    const { 取当前 } = 挂载(后端, 'stg');
    await waitFor(() => expect(取当前().后端状态.初始化).toBe('完成'));
    // 本主体 stg 键里没有偏好 → 落第一条，绝不借用别人的 int_bj
    expect(取当前().状态.当前意向编号).toBe('int_sh');
    expect(读缓存意向('sub_别人')).toBe('int_bj');
    expect(读缓存意向(BFF主体样本.subject_id, 'local')).toBe('int_bj');
  });

  it('存储损坏不中断页面：按服务端有效选择工作，刷新记忆能力降级', async () => {
    globalThis.sessionStorage.setItem(资料键(BFF主体样本.subject_id), '{不是 JSON');
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取意向).mockResolvedValue(两条同名);
    const { 取当前 } = 挂载(后端);
    await waitFor(() => expect(取当前().状态.当前意向编号).toBe('int_sh'));
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
    当前.派发({ 型: '存薪资预填', 下限: 30, 上限: 40, 单位: '月薪K', 城市们: [], 职位: [], 城市引用们: [], 职位引用们: [] });
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

  it('切到 sub_B：不恢复也不改写 sub_A 的答案（含 建档），且主体转移清理 A 的键', async () => {
    写候选引导草稿(globalThis.sessionStorage, { 模式: 'backend', 环境: 'stg', 账号: 'sub_A' }, {
      ...草稿样本(),
      建档: { 头像状态: '待核对' },
    });
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
    await 通过测试手机登录(当前);
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

  // J-PILOT-02 Task 2：active 意向存在不再触发引导草稿删除 —— 草稿是「未提交答案」，
  // 已提交事实由服务端权威快照表达；「任一 active 意向即删除草稿」的判断已按 Plan 移除。
  it('保存首次意向成功（水合 active 意向）后草稿（含 建档）保留，不删键', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    当前.派发({ 型: '存薪资预填', 下限: 30, 上限: 40, 单位: '月薪K', 城市们: [], 职位: [], 城市引用们: [], 职位引用们: [] });
    await waitFor(() => expect(globalThis.sessionStorage.getItem(键('sub_1'))).toContain('"下限":30'));
    await act(async () => { 当前.操作.更新候选建档草稿({ 头像状态: '未选' }); });
    await waitFor(() => expect(globalThis.sessionStorage.getItem(键('sub_1'))).toContain('"头像状态"'));
    // 保存首次意向成功的权威落点：水合后端意向（快照含唯一 active 意向）
    当前.派发({
      型: '水合后端意向',
      快照: { 列表: [{ 编号: 'int_1', 标题: '[上海] 后端工程师', 说明: '30-40K' }], 服务端: { int_1: BFF意向样本 } },
    });
    await act(async () => {});
    // active 意向在场不再删除草稿：向导答案与 建档 都保留
    expect(globalThis.sessionStorage.getItem(键('sub_1'))).toContain('"下限":30');
    expect(globalThis.sessionStorage.getItem(键('sub_1'))).toContain('"头像状态"');
    expect(当前.状态.引导预填?.薪资).toEqual({ 下限: 30, 上限: 40, 单位: '月薪K' });
    expect(当前.状态.引导预填?.建档?.头像状态).toBe('未选');
  });

  it('已有 active 意向的候选重挂：存量草稿（含 建档）照常恢复且不删键', async () => {
    写候选引导草稿(globalThis.sessionStorage, { 模式: 'backend', 环境: 'stg', 账号: 'sub_A' }, {
      ...草稿样本(),
      建档: { 头像状态: '待核对' },
    });
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
    // active 意向在场：存量草稿照常恢复、键不被删
    await waitFor(() => expect(当前.状态.引导预填?.职位).toEqual(['后端工程师']));
    expect(当前.状态.引导预填?.建档?.头像状态).toBe('待核对');
    expect(globalThis.sessionStorage.getItem(键('sub_A'))).toContain('后端工程师');
  });

  it('删除最后一条 active 意向后：草稿保留在内存与存储，新答案继续合并', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    当前.派发({ 型: '存薪资预填', 下限: 30, 上限: 40, 单位: '月薪K', 城市们: [], 职位: [], 城市引用们: [], 职位引用们: [] });
    await waitFor(() => expect(globalThis.sessionStorage.getItem(键('sub_1'))).toContain('"下限":30'));
    const 活跃快照 = { 列表: [{ 编号: 'int_1', 标题: '[上海] 后端工程师', 说明: '30-40K' }], 服务端: { int_1: BFF意向样本 } };
    当前.派发({ 型: '水合后端意向', 快照: 活跃快照 });
    await act(async () => {});
    // active→空（最后一条意向被删）：草稿不再被清，答案保留可继续编辑
    当前.派发({ 型: '水合后端意向', 快照: { 列表: [], 服务端: {} } });
    await act(async () => {});
    expect(当前.状态.引导预填?.薪资).toEqual({ 下限: 30, 上限: 40, 单位: '月薪K' });
    expect(globalThis.sessionStorage.getItem(键('sub_1'))).toContain('"下限":30');
    // 新答案照常合并进同一份草稿
    当前.派发({ 型: '存薪资预填', 下限: 50, 上限: 60, 单位: '月薪K', 城市们: [], 职位: [], 城市引用们: [], 职位引用们: [] });
    await waitFor(() => expect(globalThis.sessionStorage.getItem(键('sub_1'))).toContain('"下限":50'));
  });

  it('刷新保留只填一半的教育编辑层：建档.编辑中 恢复，权威简历水合不抹掉', async () => {
    写候选引导草稿(globalThis.sessionStorage, { 模式: 'backend', 环境: 'stg', 账号: 'sub_A' }, {
      城市们: [],
      职位: [],
      建档: { 编辑中: { 种类: 'education', 本地编号: 'edu2', 字段: { 学校: '复旦大学', 学历: '硕士' } } },
    });
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await waitFor(() => expect(当前.状态.引导预填?.建档?.编辑中).toEqual({
      种类: 'education', 本地编号: 'edu2', 字段: { 学校: '复旦大学', 学历: '硕士' },
    }));
    // hydrate authoritative 与本地 draft 分开：水合后端简历 落权威简历字段，
    // 不把 引导预填.建档（只供原编辑表单）抹掉，也不假写服务端快照
    const 快照 = 从BFF简历(BFF简历样本);
    当前.派发({ 型: '水合后端简历', 快照 });
    await act(async () => {});
    expect(当前.状态.基本信息).toEqual(快照.基本信息);
    expect(当前.状态.引导预填?.建档?.编辑中).toEqual({
      种类: 'education', 本地编号: 'edu2', 字段: { 学校: '复旦大学', 学历: '硕士' },
    });
    expect(globalThis.sessionStorage.getItem(键('sub_A'))).toContain('复旦大学');
  });

  it('更新候选建档草稿：内存与存储同步更新；未结算槽不被第二条命令覆盖', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    const 槽A = {
      种类: 'education-create' as const, 本地编号: 'edu2',
      请求体: { institution_id: 'ins_1' }, 幂等键: 'idem-a', 阶段: 'prepared' as const,
    };
    await act(async () => { 当前.操作.更新候选建档草稿({ 资料: { 个人优势: '一半' }, 待写入: 槽A }); });
    await waitFor(() => expect(当前.状态.引导预填?.建档?.待写入).toEqual(槽A));
    expect(globalThis.sessionStorage.getItem(键('sub_1'))).toContain('"幂等键":"idem-a"');
    // 第二条不同命令：单槽未结算（prepared、无回执）不被覆盖；普通输入字段照常落地
    const 槽B = {
      种类: 'summary' as const, 请求体: { summary: '新优势' }, 幂等键: 'idem-b', 阶段: 'prepared' as const,
    };
    await act(async () => { 当前.操作.更新候选建档草稿({ 资料: { 个人优势: '完整优势' }, 待写入: 槽B }); });
    expect(当前.状态.引导预填?.建档?.资料?.个人优势).toBe('完整优势');
    expect(当前.状态.引导预填?.建档?.待写入).toEqual(槽A);
    expect(JSON.parse(globalThis.sessionStorage.getItem(键('sub_1'))!).建档.待写入.幂等键).toBe('idem-a');
    // 同一条命令推进 received（回执落地）不被守卫拦
    await act(async () => {
      当前.操作.更新候选建档草稿({
        资料: { 个人优势: '完整优势' },
        待写入: { ...槽A, 阶段: 'received', 回执: { id: 'edu_srv_1', revision: 4 } },
      });
    });
    expect(当前.状态.引导预填?.建档?.待写入?.阶段).toBe('received');
    expect(当前.状态.引导预填?.建档?.待写入?.回执).toEqual({ id: 'edu_srv_1', revision: 4 });
    // 已结算（received）后新命令可接槽
    await act(async () => { 当前.操作.更新候选建档草稿({ 待写入: 槽B }); });
    expect(当前.状态.引导预填?.建档?.待写入?.幂等键).toBe('idem-b');
  });

  it('更新候选建档草稿 存储写入失败：提示刷新风险，输入保留在内存，不阻断保存', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    // jsdom 的 Storage 是 Proxy（属性赋值会变成存储条目），必须整体替换 global 才能
    // 让 setItem 抛错；getItem 保持空读、removeItem 静默，恢复链路不受影响。
    const 抛错存储 = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceeded'); },
      removeItem: () => { /* no-op */ },
    };
    vi.stubGlobal('sessionStorage', 抛错存储);
    try {
      render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
      await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
      // 拒绝存储下当前明确保存动作继续：不抛错、输入不丢
      await act(async () => { 当前.操作.更新候选建档草稿({ 资料: { 个人优势: '内存保留' } }); });
      expect(当前.状态.引导预填?.建档?.资料?.个人优势).toBe('内存保留');
      const 文案们 = Array.from(document.body.children)
        .filter((节点) => (节点 as HTMLElement).style?.zIndex === '999')
        .flatMap((容器) => Array.from((容器 as HTMLElement).children))
        .map((条) => (条 as HTMLElement).textContent ?? '');
      expect(文案们.some((文案) => 文案.includes('无法保存恢复进度') && 文案.includes('刷新可能丢失'))).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('Mock 模式：更新候选建档草稿 仅留内存，不触碰任何候选会话键', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    vi.stubGlobal('localStorage', 本地Map存储());
    render(createElement(应用状态提供者, null, createElement(上下文探针)));
    await act(async () => {});
    await act(async () => { 当前.操作.更新候选建档草稿({ 头像状态: '未选' }); });
    expect(当前.状态.引导预填?.建档?.头像状态).toBe('未选');
    const 会话键们 = Object.keys(globalThis.sessionStorage);
    expect(会话键们.some((名) => 名.includes('候选引导草稿'))).toBe(false);
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
