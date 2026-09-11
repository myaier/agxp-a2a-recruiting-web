// codex review-r1 P2：候选操作（保存简历 / 保存个人优势 / 意向写）的 401 统一清理必须随行
// 候选预填引用。子集缺引用时内存轮虽被摊平，但预填代际 / 单飞读锁 / outgoing subject 的
// 恢复元数据不会清 —— 登出渲染把恢复适配器解绑成 null 后，旧 session key 再无人删除，
// 同账号重登会复活上一轮预填（设计 §6.4：401 全部清内存和 session key）。

import { describe, expect, it, vi } from 'vitest';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import { BFF错误, 取后端错误文案, type BFF请求选项, type BFF响应 } from '../../数据/HTTP客户端';
import type { BFF简历, BFF教育, BFFOwnerIntention } from '../../数据/BFF契约';
import type { 简历经历段, 简历教育段 } from '../../数据/类型';
import { 初始状态 } from '../初始状态';
import { BFF意向样本, BFF简历样本 } from '../../测试/BFF样本';
import { 从BFF简历 } from '../../数据/后端映射';
import { 创建简历数据源 } from '../../数据/招聘数据源/简历';
import { 创建意向数据源 } from '../../数据/招聘数据源/意向';
import { 创建候选账号数据源 } from '../../数据/招聘数据源/候选账号';
import type { 候选引导建档草稿, 候选建档草稿存储 } from '../../数据/资料缓存';
import type {
  后端操作依赖, 后端状态, 候选操作, 候选预填恢复存储, 提交候选意向快照输入,
} from './类型';
import { 创建候选操作 } from './候选操作';

/** 动态取轻提示条数/清空：与 会话操作.test.ts 同款（toast 单例容器，避免捕获引用逃逸）。 */
function 轻提示容器(): HTMLElement | undefined {
  return Array.from(document.body.children).find(
    (节点) => (节点 as HTMLElement).style?.zIndex === '999',
  ) as HTMLElement | undefined;
}
function 轻提示含(文案: string): boolean {
  return Array.from(轻提示容器()?.children ?? []).some((条) => 条.textContent === 文案);
}
function 清空轻提示(): void {
  const 容器 = 轻提示容器();
  if (容器) 容器.innerHTML = '';
}

function 创建场景(选项: {
  建档?: 候选引导建档草稿 | null;
  存储?: 候选建档草稿存储 | null;
  后端覆盖?: Partial<HTTP招聘数据源>;
} = {}) {
  const 后端 = {
    读取简历: vi.fn(),
    保存简历: vi.fn(),
    读取候选账号档案: vi.fn(),
    读取意向: vi.fn(),
    读取指定意向: vi.fn(),
    创建意向: vi.fn(),
    创建首次意向: vi.fn(),
    更新意向: vi.fn(),
    删除意向: vi.fn(),
    替换候选头像: vi.fn(),
    删除候选头像: vi.fn(),
    清空目录缓存: vi.fn(),
  };
  // 后端覆盖（真实数据源链路）用 Object.assign 合入：保持各属性的 Mock 静态类型不变
  Object.assign(后端, 选项.后端覆盖 ?? {});
  const 后端状态引用 = { current: {
    初始化: '完成' as const,
    已登录: true,
    主体: { subject_id: 'sub_1', roles: [], last_used_role: 'candidate' },
    简历快照: null,
    意向快照: {},
    岗位快照: {},
    隐私快照: null,
    附件简历库: null,
  } as unknown as 后端状态 };
  const 设后端状态 = vi.fn((更新: (旧: 后端状态) => 后端状态) => {
    后端状态引用.current = 更新(后端状态引用.current);
  });
  const 候选预填代际 = { current: 5 };
  const 候选预填读取锁 = { current: new Map<string, Promise<void>>() };
  const 候选预填恢复存储: 候选预填恢复存储 = { 读取: vi.fn(() => null), 写入: vi.fn(), 删除: vi.fn() };
  const 候选预填恢复 = { current: 候选预填恢复存储 };
  const deps = {
    是后端: true,
    后端: 后端 as unknown as HTTP招聘数据源,
    派发: vi.fn(),
    设后端状态,
    后端状态引用,
    状态引用: { current: 初始状态 },
    锁: { current: new Set<string>() },
    尝试引用: { current: null as string | null },
    主体标识引用: { current: 'sub_1' as string | null },
    会话代际: { current: 1 },
    读取恢复企业关系编号: vi.fn(() => null),
    // Provider 回调的测试替身：同样先过捕获栅栏，再派发 + 同步权威意向快照。
    提交候选意向快照: vi.fn((input: 提交候选意向快照输入) => {
      if (deps.主体标识引用.current !== input.subjectId) return;
      if (deps.会话代际.current !== input.sessionGeneration) return;
      deps.派发({ 型: '水合后端意向', 快照: input.快照, 恢复编号: null });
      设后端状态((旧) => ({ ...旧, 意向快照: input.快照.服务端 }));
    }),
    候选预填代际,
    候选预填读取锁,
    候选预填恢复,
    // J-PILOT-02 Task 3：仅在测试显式传入 建档 时接线（缺省 = 无建档草稿的原路径）
    ...(选项.建档 !== undefined
      ? {
          建档草稿引用: { current: 选项.建档 },
          候选建档草稿: { current: 选项.存储 ?? null },
        }
      : {}),
  };
  const 操作: 候选操作 = 创建候选操作(deps as unknown as 后端操作依赖);
  return {
    后端, 操作, 派发: deps.派发, 后端状态引用, 状态引用: deps.状态引用,
    候选预填代际, 候选预填读取锁, 候选预填恢复存储,
    deps, 提交候选意向快照: deps.提交候选意向快照,
  };
}

describe('创建候选操作 · 401 统一清理随行候选预填引用', () => {
  it('保存简历 401：代际递增、读锁清空、恢复元数据删除', async () => {
    const 场景 = 创建场景();
    场景.候选预填读取锁.current.set('rf_1|rfv_1|rp_1', Promise.resolve());
    场景.后端.读取简历.mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 空模型 = {} as Parameters<候选操作['保存简历']>[0];
    await expect(场景.操作.保存简历(空模型)).rejects.toBeInstanceOf(BFF错误);
    expect(场景.后端状态引用.current.已登录).toBe(false);
    expect(场景.候选预填代际.current).toBe(6);
    expect(场景.候选预填读取锁.current.size).toBe(0);
    expect(场景.候选预填恢复存储.删除).toHaveBeenCalledTimes(1);
  });

  it('保存个人优势 401：同口径清候选预填引用', async () => {
    const 场景 = 创建场景();
    场景.后端.读取简历.mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(场景.操作.保存个人优势('x')).rejects.toBeInstanceOf(BFF错误);
    expect(场景.候选预填代际.current).toBe(6);
    expect(场景.候选预填恢复存储.删除).toHaveBeenCalledTimes(1);
  });
});

describe('创建候选操作 · 候选头像权威写入', () => {
  const 有头像 = {
    avatar_url: '/api/v1/me/avatar/content' as const,
    revision: 2,
    updated_at: '2026-09-03T19:00:00Z',
  };

  it('上传前读取 revision，成功后用 revision 破缓存地址水合', async () => {
    const 场景 = 创建场景();
    场景.后端.读取候选账号档案.mockResolvedValue({ avatar_url: null, revision: 1, updated_at: null });
    场景.后端.替换候选头像.mockResolvedValue(有头像);
    const 文件 = new File(['a'], 'a.png', { type: 'image/png' });
    await 场景.操作.保存候选头像(文件);
    expect(场景.后端.替换候选头像).toHaveBeenCalledWith(文件, 1);
    expect(场景.派发).toHaveBeenLastCalledWith({
      型: '存求职头像', 图: '/api/v1/me/avatar/content?v=2',
    });
  });

  it('上传 503 后 account revision 前进且头像在场仍不能证明本文件成功（Task 8）', async () => {
    const 场景 = 创建场景();
    场景.后端.读取候选账号档案
      .mockResolvedValueOnce({ avatar_url: null, revision: 1, updated_at: null })
      .mockResolvedValueOnce(有头像);
    场景.后端.替换候选头像.mockRejectedValue(
      new BFF错误(503, 'operation_outcome_unknown', 'unknown'),
    );
    // Task 8：读 account 仅为权威回显 —— 成功只能来自已确认回执或原 key 重放，
    // revision 前进 + avatar_url 非空不是本文件的内容哈希，原错误必须抛出。
    await expect(场景.操作.保存候选头像(new File(['a'], 'a.png')))
      .rejects.toMatchObject({ status: 503, code: 'operation_outcome_unknown' });
    expect(场景.后端.替换候选头像).toHaveBeenCalledTimes(1);
  });

  it('删除先读 revision；权威响应为空头像后清本地展示', async () => {
    const 场景 = 创建场景();
    场景.后端.读取候选账号档案.mockResolvedValue(有头像);
    场景.后端.删除候选头像.mockResolvedValue({ avatar_url: null, revision: 3, updated_at: null });
    await 场景.操作.删除候选头像();
    expect(场景.后端.删除候选头像).toHaveBeenCalledWith(2);
    expect(场景.派发).toHaveBeenLastCalledWith({ 型: '存求职头像', 图: null });
  });
});

// ── M：空身份草稿保留 —— 权威水合不得擦掉 /basic 未提交的空身份 profile 草稿。
//    三条水合路径（保存简历 成功 / 保存个人优势 成功 / 带 权威简历 的写失败）都先派发
//    水合后端简历、再派发 存简历：基本信息取调用前草稿，其余切片取权威快照；
//    身份已明确时不补派发。
describe('创建候选操作 · 空身份草稿保留（M）', () => {
  const 权威快照 = () => ({
    基本信息: { 真名: '权威姓名', 开始工作年: '2021', 身份: '在职' as const },
    个人优势: '权威优势',
    技能: ['TypeScript'],
    经历: [{ 编号: 'exp_1', 公司: '云衢', 行业: '互联网', 职位: '工程师', 开始: '2021-01', 结束: null, 内容: '平台', 隐藏: false }],
    教育: [],
    证书: [],
    服务端快照: BFF简历样本,
  });

  function 空草稿状态() {
    return {
      ...初始状态,
      基本信息: { 真名: '本地草稿名', 开始工作年: '', 身份: '' as const },
    };
  }

  it('保存简历 成功：先 水合后端简历 再 存简历，基本信息取调用前空身份草稿', async () => {
    const 场景 = 创建场景();
    场景.状态引用.current = 空草稿状态() as never;
    场景.后端.读取简历.mockResolvedValue(权威快照());
    场景.后端.保存简历.mockResolvedValue(权威快照());
    await 场景.操作.保存简历({
      基本信息: { 真名: '本地草稿名', 开始工作年: '', 身份: '' },
      个人优势: '', 技能: [], 经历: [], 教育: [], 证书: [],
    } as never);
    const 动作们 = (场景.派发.mock.calls as { 型: string }[][]).map(([a]) => a.型);
    const 水合序 = 动作们.indexOf('水合后端简历');
    const 存序 = 动作们.indexOf('存简历');
    expect(水合序).toBeGreaterThanOrEqual(0);
    expect(存序).toBeGreaterThan(水合序);
    const 存 = (场景.派发.mock.calls as { 型: string; 基本信息?: unknown; 经历?: unknown }[][])
      .map(([a]) => a).find((a) => a.型 === '存简历')!;
    expect(存.基本信息).toMatchObject({ 真名: '本地草稿名', 身份: '' });
    expect(存.经历).toEqual(权威快照().经历);
  });

  it('保存个人优势 成功：同口径补回空身份草稿', async () => {
    const 场景 = 创建场景();
    场景.状态引用.current = 空草稿状态() as never;
    场景.后端.读取简历.mockResolvedValue(权威快照());
    场景.后端.保存简历.mockResolvedValue(权威快照());
    await 场景.操作.保存个人优势('新优势');
    const 存 = (场景.派发.mock.calls as { 型: string; 基本信息?: unknown }[][])
      .map(([a]) => a).find((a) => a.型 === '存简历');
    expect(存?.基本信息).toMatchObject({ 真名: '本地草稿名', 身份: '' });
  });

  it('写失败带 权威简历：409 水合后同样补回空身份草稿', async () => {
    const 场景 = 创建场景();
    场景.状态引用.current = 空草稿状态() as never;
    const 错误 = new BFF错误(409, 'version_conflict', 'conflict');
    (错误 as { 权威简历?: unknown }).权威简历 = 权威快照();
    场景.后端.读取简历.mockResolvedValue(权威快照());
    场景.后端.保存简历.mockRejectedValue(错误);
    await expect(场景.操作.保存个人优势('x')).rejects.toBeInstanceOf(BFF错误);
    const 动作们 = (场景.派发.mock.calls as { 型: string }[][]).map(([a]) => a.型);
    expect(动作们).toContain('水合后端简历');
    expect(动作们).toContain('存简历');
  });

  it('身份已明确时不补派发 存简历（权威水合即终局）', async () => {
    const 场景 = 创建场景();
    场景.状态引用.current = {
      ...初始状态,
      基本信息: { 真名: '权威姓名', 开始工作年: '2021', 身份: '在职' as const },
    } as never;
    场景.后端.读取简历.mockResolvedValue(权威快照());
    场景.后端.保存简历.mockResolvedValue(权威快照());
    await 场景.操作.保存个人优势('新优势');
    const 动作们 = (场景.派发.mock.calls as { 型: string }[][]).map(([a]) => a.型);
    expect(动作们).toContain('水合后端简历');
    expect(动作们).not.toContain('存简历');
  });
});

// ── Task 2：意向写操作的权威快照必须经统一提交口，并带发起时刻捕获的主体/代际 ──
// 直接 派发 水合后端意向 会绕过持久化写屏障（选择改了却写不进会话缓存），
// 结算时重新取当前主体则会让迟到结果冒充新主体的 owner。
describe('创建候选操作 · 意向写经 提交候选意向快照', () => {
  const 意向快照 = (编号们: string[]) => ({
    列表: 编号们.map((编号) => ({ 编号, 标题: '[上海] 产品经理', 说明: '' })),
    服务端: Object.fromEntries(
      编号们.map((编号) => [编号, { intention_id: 编号, status: 'active' }]),
    ),
  });

  const 草稿 = { 编辑编号: null } as unknown as Parameters<候选操作['保存意向']>[0];

  it('创建意向成功：经提交口传入权威快照与捕获的主体/代际，不直接派发', async () => {
    const 场景 = 创建场景();
    const 快照 = 意向快照(['int_sh', 'int_bj']);
    场景.后端.创建意向.mockResolvedValue(快照);
    await 场景.操作.保存意向(草稿);
    expect(场景.提交候选意向快照).toHaveBeenCalledWith({
      快照, subjectId: 'sub_1', sessionGeneration: 1,
    });
    // 写操作重读绝不带恢复偏好：恢复只属于首次角色水合
    expect(场景.提交候选意向快照.mock.calls[0][0].恢复选择).toBeUndefined();
  });

  it('删除意向成功同样经提交口', async () => {
    const 场景 = 创建场景();
    场景.后端状态引用.current = {
      ...场景.后端状态引用.current,
      意向快照: { int_bj: { intention_id: 'int_bj', revision: 3 } },
    } as never;
    const 快照 = 意向快照(['int_sh']);
    场景.后端.删除意向.mockResolvedValue(快照);
    await 场景.操作.删除意向('int_bj');
    expect(场景.提交候选意向快照).toHaveBeenCalledWith({
      快照, subjectId: 'sub_1', sessionGeneration: 1,
    });
  });

  it('409 版本冲突的权威重读也经提交口，主体/代际仍取发起时刻的值', async () => {
    const 场景 = 创建场景();
    const 快照 = 意向快照(['int_sh']);
    场景.后端.创建意向.mockRejectedValue(new BFF错误(409, 'version_conflict', 'conflict'));
    场景.后端.读取意向.mockResolvedValue(快照);
    await expect(场景.操作.保存意向(草稿)).rejects.toBeInstanceOf(BFF错误);
    expect(场景.提交候选意向快照).toHaveBeenCalledWith({
      快照, subjectId: 'sub_1', sessionGeneration: 1,
    });
  });

  it('写在途换主体：迟到的成功快照被提交口的栅栏丢弃，不落进新主体', async () => {
    const 场景 = 创建场景();
    const 快照 = 意向快照(['int_sh']);
    let 放行!: () => void;
    场景.后端.创建意向.mockReturnValue(new Promise((ok) => {
      放行 = () => ok(快照);
    }));
    const 写 = 场景.操作.保存意向(草稿);
    // 请求在途时用户换了账号
    场景.deps.主体标识引用.current = 'sub_2';
    放行();
    await 写;
    // 提交口仍被调用（带旧主体），但栅栏拦下：新主体的意向状态不被污染
    expect(场景.提交候选意向快照).toHaveBeenCalledWith({
      快照, subjectId: 'sub_1', sessionGeneration: 1,
    });
    const 动作们 = (场景.派发.mock.calls as { 型: string }[][]).map(([a]) => a.型);
    expect(动作们).not.toContain('水合后端意向');
  });
});

// ── J-PILOT-02 Task 3：建档跟踪保存 —— 结算、已存身份映射、DELETE 门控、busy、栅栏 ──

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

const 教育DTO = (id: string, revision: number): BFF教育 => ({
  id,
  institution: { id: 'inst_1', display_name: '云衢大学' },
  degree: '本科',
  major: { id: 'major_1', display_name: '计算机' },
  start_month: '2020-09',
  end_month: '2024-06',
  revision,
});

const 教育段 = (编号: string): 简历教育段 => ({
  编号,
  学校: '云衢大学',
  学校引用: { id: 'inst_1', display_name: '云衢大学' },
  学历: '本科',
  专业: '计算机',
  专业引用: { id: 'major_1', display_name: '计算机' },
  开始: '2020-09',
  结束: '2024-06',
});

/** 只允许 GET 的权威读桩；任何 mutation 请求都按「未预期」抛错。 */
function 只读请求桩(简历们: BFF简历[]) {
  let 序 = 0;
  const 请求Mock = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
    if ((选项.method ?? 'GET') === 'GET' && 选项.path === '/api/v1/me/resume') {
      const 结果 = 简历们[Math.min(序, 简历们.length - 1)];
      序 += 1;
      return { result: 结果, etag: null, requestId: 'r' };
    }
    throw new Error(`未预期的请求 ${选项.method} ${选项.path}`);
  });
  return 请求Mock;
}

describe('创建候选操作 · 建档跟踪保存（J-PILOT-02 Task 3）', () => {
  it('拒绝存储下教育仍可保存：内存保留输入/命令/回执，轻提示刷新风险，保存不失败', async () => {
    const previous: BFF简历 = { ...BFF简历样本, educations: [] };
    const 权威后 = { ...BFF简历样本, educations: [教育DTO('edu_srv_1', 1)] };
    let 教育POST数 = 0;
    const 请求Mock = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
      if ((选项.method ?? 'GET') === 'GET' && 选项.path === '/api/v1/me/resume') {
        return { result: 教育POST数 === 0 ? previous : 权威后, etag: null, requestId: 'r' };
      }
      if (选项.method === 'POST' && 选项.path === '/api/v1/me/resume/educations') {
        教育POST数 += 1;
        return {
          result: { entry: { kind: 'education', education: 教育DTO('edu_srv_1', 1) }, aggregate_revision: 7 },
          etag: null, requestId: 'r',
        };
      }
      throw new Error(`未预期的请求 ${选项.method} ${选项.path}`);
    });
    const 建档: 候选引导建档草稿 = { 资料: { 教育: [教育段('edu_local_1')] } };
    const 存储: 候选建档草稿存储 = { 读取: () => 建档, 写入: () => false };
    const 场景 = 创建场景({
      建档,
      存储,
      后端覆盖: 创建简历数据源(请求Mock as unknown as 请求函数) as unknown as Partial<HTTP招聘数据源>,
    });
    清空轻提示();
    const next = { ...从BFF简历(previous), 教育: [教育段('edu_local_1')] };
    // 存储不可用不阻断当前明确保存动作
    await expect(场景.操作.保存简历(next as never)).resolves.toBeUndefined();
    expect(教育POST数).toBe(1);
    expect(轻提示含('本次无法保存恢复进度，刷新可能丢失')).toBe(true);
    const 草稿 = 场景.deps.建档草稿引用!.current!;
    expect(草稿.已存条目).toMatchObject([
      { 本地编号: 'edu_local_1', 种类: 'education', 资源编号: 'edu_srv_1', revision: 1 },
    ]);
    expect(草稿.待写入).toBeUndefined(); // 已确认后清槽
    // 内存里的 资料 条目编号已替换为服务器编号（刷新后映射不再重复 POST）
    expect(草稿.资料?.教育?.[0].编号).toBe('edu_srv_1');
  });

  it('received 槽先按回执落已存身份并清槽，不再重放任何请求', async () => {
    const previous: BFF简历 = { ...BFF简历样本, educations: [教育DTO('edu_srv_1', 1)] };
    const 建档: 候选引导建档草稿 = {
      资料: { 教育: [教育段('edu_local_1')] },
      待写入: {
        种类: 'education-create',
        本地编号: 'edu_local_1',
        请求体: { institution_id: 'inst_1', degree: '本科', major_id: 'major_1', start_month: '2020-09', end_month: '2024-06' },
        幂等键: 'idem-received-1',
        阶段: 'received',
        回执: { id: 'edu_srv_1', revision: 1 },
      },
    };
    const 请求Mock = 只读请求桩([previous]);
    const 场景 = 创建场景({
      建档,
      后端覆盖: 创建简历数据源(请求Mock as unknown as 请求函数) as unknown as Partial<HTTP招聘数据源>,
    });
    场景.后端状态引用.current = { ...场景.后端状态引用.current, 简历快照: previous } as never;
    const next = { ...从BFF简历(previous), 教育: [教育段('edu_local_1')] };
    await expect(场景.操作.保存简历(next as never)).resolves.toBeUndefined();
    const 请求们 = 请求Mock.mock.calls.map((c) => c[0] as BFF请求选项);
    expect(请求们.filter((o) => o.method === 'POST' || o.method === 'PATCH' || o.method === 'DELETE')).toHaveLength(0); // 已收 receipt 只按身份核对，不重放
    const 草稿 = 场景.deps.建档草稿引用!.current!;
    expect(草稿.已存条目?.[0]).toMatchObject({ 本地编号: 'edu_local_1', 资源编号: 'edu_srv_1' });
    expect(草稿.待写入).toBeUndefined();
  });

  it('非简历域 received 槽（回执在手）同样拦下简历命令：回执不被覆盖、零 mutation', async () => {
    const previous: BFF简历 = { ...BFF简历样本, educations: [] };
    // 意向域槽由 Task 6 结算，简历域不认识它：结算单槽 跳过 → 必须由 发送前 守卫拦住
    const 意向槽 = {
      种类: 'first-intention-create' as const,
      请求体: { position_id: 'pos_1' },
      幂等键: 'idem-intent-1',
      阶段: 'received' as const,
      回执: { id: 'intent_srv_1', revision: 3 },
    };
    const 建档: 候选引导建档草稿 = { 资料: { 教育: [教育段('edu_local_1')] }, 待写入: 意向槽 };
    const 请求Mock = 只读请求桩([previous]);
    const 场景 = 创建场景({
      建档,
      后端覆盖: 创建简历数据源(请求Mock as unknown as 请求函数) as unknown as Partial<HTTP招聘数据源>,
    });
    场景.后端状态引用.current = { ...场景.后端状态引用.current, 简历快照: previous } as never;
    const next = { ...从BFF简历(previous), 教育: [教育段('edu_local_1')] };
    await expect(场景.操作.保存简历(next as never)).rejects.toThrow('上一条写入结果未确认');
    const 请求们 = 请求Mock.mock.calls.map((c) => c[0] as BFF请求选项);
    expect(请求们.filter((o) => (o.method ?? 'GET') !== 'GET')).toHaveLength(0);
    // 槽原样保留：回执（意向 ID）没有被 education-create 命令悄悄顶掉
    expect(场景.deps.建档草稿引用!.current!.待写入).toEqual(意向槽);
  });

  it('prepared 创建槽先按原 body/key 重放结算，再按最新草稿算下一步（同本地条目仍一条资源）', async () => {
    const previous: BFF简历 = { ...BFF简历样本, educations: [] };
    const 权威后 = { ...BFF简历样本, educations: [教育DTO('edu_srv_9', 2)] };
    let 教育POST数 = 0;
    let 教育PATCH数 = 0;
    const 请求Mock = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
      if ((选项.method ?? 'GET') === 'GET' && 选项.path === '/api/v1/me/resume') {
        return { result: 教育POST数 === 0 ? previous : 权威后, etag: null, requestId: 'r' };
      }
      if (选项.method === 'POST' && 选项.path === '/api/v1/me/resume/educations') {
        教育POST数 += 1;
        return {
          result: { entry: { kind: 'education', education: 教育DTO('edu_srv_9', 1) }, aggregate_revision: 5 },
          etag: null, requestId: 'r',
        };
      }
      if (选项.method === 'PATCH' && 选项.path === '/api/v1/me/resume/educations/edu_srv_9') {
        教育PATCH数 += 1;
        return { result: 权威后, etag: null, requestId: 'r' };
      }
      throw new Error(`未预期的请求 ${选项.method} ${选项.path}`);
    });
    const 建档: 候选引导建档草稿 = {
      // 用户在未知结果后把学历改成了「硕士」——重放必须用槽里的原 body「本科」
      资料: { 教育: [{ ...教育段('edu_local_1'), 学历: '硕士' }] },
      待写入: {
        种类: 'education-create',
        本地编号: 'edu_local_1',
        // 键序沿用 转教育写入 的字面构造序（生产槽都由该映射器产生，重放经同一映射器键序一致）
        请求体: { institution_id: 'inst_1', major_id: 'major_1', degree: '本科', start_month: '2020-09', end_month: '2024-06' },
        幂等键: 'idem-fixed-1234567',
        阶段: 'prepared',
      },
    };
    const 场景 = 创建场景({
      建档,
      后端覆盖: 创建简历数据源(请求Mock as unknown as 请求函数) as unknown as Partial<HTTP招聘数据源>,
    });
    const next = { ...从BFF简历(previous), 教育: [{ ...教育段('edu_local_1'), 学历: '硕士' }] };
    await expect(场景.操作.保存简历(next as never)).resolves.toBeUndefined();
    const POST们 = 请求Mock.mock.calls.map((c) => c[0] as BFF请求选项)
      .filter((o) => o.method === 'POST');
    expect(POST们).toHaveLength(1); // 同一本地条目始终一条服务器资源
    expect(POST们[0].body).toEqual(建档.待写入!.请求体); // 原 body 保持
    expect(POST们[0].幂等键).toBe('idem-fixed-1234567'); // 创建复用原 key
    // 结算后才按最新草稿算下一步：同一资源 PATCH 成「硕士」
    const PATCH们 = 请求Mock.mock.calls.map((c) => c[0] as BFF请求选项)
      .filter((o) => o.method === 'PATCH');
    expect(PATCH们).toHaveLength(1);
    expect(PATCH们[0].path).toBe('/api/v1/me/resume/educations/edu_srv_9');
    expect((PATCH们[0].body as { degree?: string }).degree).toBe('硕士');
    expect(教育POST数).toBe(1);
    expect(教育PATCH数).toBe(1);
    const 草稿 = 场景.deps.建档草稿引用!.current!;
    expect(草稿.已存条目?.[0]).toMatchObject({ 本地编号: 'edu_local_1', 资源编号: 'edu_srv_9' });
    expect(草稿.资料?.教育?.[0].编号).toBe('edu_srv_9');
    expect(草稿.资料?.教育?.[0].学历).toBe('硕士'); // 冲突前用户编辑保留
    expect(草稿.待写入).toBeUndefined();
  });

  it('prepared CAS 槽按权威 GET 只读核对：字段一致即结算；冲突保留草稿并报错', async () => {
    const 资料 = { ...BFF简历样本.profile };
    const previous = BFF简历样本;
    const 一致体 = {
      real_name: '沈亦舟', work_start_year: 2021, status: 'employed' as const,
      current_education: null, graduation_year: null, gender: 'male' as const,
      birth_year: 1998, birth_month: 6,
    };
    const 一致场景 = 创建场景({
      建档: {
        资料: { 个人优势: '一半' },
        待写入: { 种类: 'profile', 请求体: { ...一致体 }, ifMatch: 2, 阶段: 'prepared' },
      },
      后端覆盖: 创建简历数据源(只读请求桩([previous]) as unknown as 请求函数) as unknown as Partial<HTTP招聘数据源>,
    });
    await expect(一致场景.操作.保存简历(从BFF简历(previous) as never)).resolves.toBeUndefined();
    const 一致草稿 = 一致场景.deps.建档草稿引用!.current!;
    expect(一致草稿.已存分区).toEqual({ profile: 2 });
    expect(一致草稿.待写入).toBeUndefined();
    expect(一致草稿.资料).toEqual({ 个人优势: '一半' });

    // 冲突：目标字段已被别人改走 —— 保留用户编辑并报错，清掉可安全判定为终局的槽
    const 冲突场景 = 创建场景({
      建档: {
        资料: { 个人优势: '一半' },
        待写入: { 种类: 'profile', 请求体: { ...一致体, real_name: '本地名字' }, ifMatch: 2, 阶段: 'prepared' },
      },
      后端覆盖: 创建简历数据源(只读请求桩([previous]) as unknown as 请求函数) as unknown as Partial<HTTP招聘数据源>,
    });
    await expect(冲突场景.操作.保存简历(从BFF简历(previous) as never))
      .rejects.toThrow('数据已在其他地方更新，请重试');
    const 冲突草稿 = 冲突场景.deps.建档草稿引用!.current!;
    expect(冲突草稿.资料).toEqual({ 个人优势: '一半' }); // 冲突保留用户编辑
    expect(冲突草稿.待写入).toBeUndefined();
    expect(资料.real_name).toBe('沈亦舟');
  });

  it('确定拒绝（422）清槽保留输入；结果未知（503）保留待核对槽', async () => {
    const previous: BFF简历 = { ...BFF简历样本, educations: [] };
    const 拒绝请求桩 = (错误: BFF错误) => {
      const 请求Mock = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
        if ((选项.method ?? 'GET') === 'GET' && 选项.path === '/api/v1/me/resume') {
          return { result: previous, etag: null, requestId: 'r' };
        }
        if (选项.method === 'POST' && 选项.path === '/api/v1/me/resume/educations') {
          throw 错误;
        }
        throw new Error(`未预期的请求 ${选项.method} ${选项.path}`);
      });
      return 请求Mock;
    };
    const 确定 = new BFF错误(422, 'validation_failed', '填写内容未通过校验');
    const 确定场景 = 创建场景({
      建档: { 资料: { 教育: [教育段('edu_local_1')] } },
      后端覆盖: 创建简历数据源(拒绝请求桩(确定) as unknown as 请求函数) as unknown as Partial<HTTP招聘数据源>,
    });
    await expect(确定场景.操作.保存简历({ ...从BFF简历(previous), 教育: [教育段('edu_local_1')] } as never))
      .rejects.toBe(确定);
    const 确定草稿 = 确定场景.deps.建档草稿引用!.current!;
    expect(确定草稿.待写入).toBeUndefined(); // 确定拒绝清槽，不永远锁在单槽
    expect(确定草稿.资料?.教育).toHaveLength(1); // 表单保留

    const 未知 = new BFF错误(503, 'operation_outcome_unknown', '结果未知');
    const 未知场景 = 创建场景({
      建档: { 资料: { 教育: [教育段('edu_local_1')] } },
      后端覆盖: 创建简历数据源(拒绝请求桩(未知) as unknown as 请求函数) as unknown as Partial<HTTP招聘数据源>,
    });
    await expect(未知场景.操作.保存简历({ ...从BFF简历(previous), 教育: [教育段('edu_local_1')] } as never))
      .rejects.toBe(未知);
    const 未知草稿 = 未知场景.deps.建档草稿引用!.current!;
    expect(未知草稿.待写入).toMatchObject({ 种类: 'education-create', 阶段: 'prepared' }); // 待核对
  });

  // J-PILOT-02 Task 6 review r1：合法保留中的文件槽会挡下资料保存 —— 挡下本身是对的
  //（Global 6：一个槽未结算时禁止另一 mutation 覆盖），但抛裸 Error 会被 取后端错误文案
  // 收成「请求失败，请稍后再试」，用户不知道要回原步骤重选那份文件。
  it('保留中的文件槽挡下资料保存：抛可上屏的闭合文案（不是通用「请求失败」）', async () => {
    const previous: BFF简历 = { ...BFF简历样本, educations: [] };
    const 文件槽 = {
      种类: 'resume-file-create' as const,
      幂等键: 'idem-upload-unknown-1',
      阶段: 'prepared' as const,
      文件核对: { name: '简历.pdf', type: 'application/pdf', size: 8, lastModified: 1, sha256: 'f'.repeat(64) },
    };
    const 请求Mock = 只读请求桩([previous]);
    const 场景 = 创建场景({
      建档: { 资料: { 教育: [教育段('edu_local_1')] }, 待写入: 文件槽 },
      后端覆盖: 创建简历数据源(请求Mock as unknown as 请求函数) as unknown as Partial<HTTP招聘数据源>,
    });
    场景.后端状态引用.current = { ...场景.后端状态引用.current, 简历快照: previous } as never;
    const next = { ...从BFF简历(previous), 教育: [教育段('edu_local_1')] };
    const 错误 = await 场景.操作.保存简历(next as never).then(() => null, (e: unknown) => e);
    expect(错误).toBeInstanceOf(BFF错误);
    // 用户真正看到的那句话（页面统一走 取后端错误文案）必须是可行动的原文
    expect(取后端错误文案(错误)).toBe('上一条写入结果未确认，请先重试或核对原步骤');
    const 请求们 = 请求Mock.mock.calls.map((c) => c[0] as BFF请求选项);
    expect(请求们.filter((o) => (o.method ?? 'GET') !== 'GET')).toHaveLength(0); // 零 mutation
    expect(场景.deps.建档草稿引用!.current!.待写入).toEqual(文件槽); // 槽原样保留
  });

  // review r3（裁决 C 扩展）：结算单槽 判定「无法安全重放」时抛的也必须是可上屏的闭合
  // 文案 —— 裸 Error 会被 取后端错误文案 收成「请求失败，请稍后再试」，用户不知道要回
  // 原步骤核对。该抛出早于 保存简历（发送前 没跑过），所以不会误清正被保留的槽。
  it('无法安全重放的槽：抛可上屏的闭合文案，零 mutation，槽原样保留', async () => {
    const previous: BFF简历 = { ...BFF简历样本, educations: [] };
    // 父经历不在权威快照里 → 从槽重建页面 返回 null（无法安全重放）
    const 孤儿项目槽 = {
      种类: 'project-create' as const,
      本地编号: 'proj_local_1',
      父编号: 'exp_not_in_snapshot',
      请求体: { name: '孤儿项目' },
      幂等键: 'idem-project-1',
      阶段: 'prepared' as const,
    };
    const 请求Mock = 只读请求桩([previous]);
    const 场景 = 创建场景({
      建档: { 资料: { 教育: [教育段('edu_local_1')] }, 待写入: 孤儿项目槽 },
      后端覆盖: 创建简历数据源(请求Mock as unknown as 请求函数) as unknown as Partial<HTTP招聘数据源>,
    });
    场景.后端状态引用.current = { ...场景.后端状态引用.current, 简历快照: previous } as never;
    const next = { ...从BFF简历(previous), 教育: [教育段('edu_local_1')] };
    const 错误 = await 场景.操作.保存简历(next as never).then(() => null, (e: unknown) => e);
    expect(错误).toBeInstanceOf(BFF错误);
    expect(取后端错误文案(错误)).toBe('上一条写入结果未确认，无法安全重放，请先核对原步骤');
    const 请求们 = 请求Mock.mock.calls.map((c) => c[0] as BFF请求选项);
    expect(请求们.filter((o) => (o.method ?? 'GET') !== 'GET')).toHaveLength(0);
    expect(场景.deps.建档草稿引用!.current!.待写入).toEqual(孤儿项目槽); // 槽没有被误清
  });

  // review r1 #3 的同一缺陷在资料域：503 storage_unavailable 结果不确定 ——
  // 清槽就丢了原幂等键，用户再点保存会铸新键，造出重复的教育条目。
  it('503 storage_unavailable：保留槽与原幂等键（重试不铸新键造重复条目）', async () => {
    const previous: BFF简历 = { ...BFF简历样本, educations: [] };
    const 未确定 = new BFF错误(503, 'storage_unavailable', '存储暂不可用');
    const 请求Mock = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
      if ((选项.method ?? 'GET') === 'GET' && 选项.path === '/api/v1/me/resume') {
        return { result: previous, etag: null, requestId: 'r' };
      }
      if (选项.method === 'POST' && 选项.path === '/api/v1/me/resume/educations') throw 未确定;
      throw new Error(`未预期的请求 ${选项.method} ${选项.path}`);
    });
    const 场景 = 创建场景({
      建档: { 资料: { 教育: [教育段('edu_local_1')] } },
      后端覆盖: 创建简历数据源(请求Mock as unknown as 请求函数) as unknown as Partial<HTTP招聘数据源>,
    });
    await expect(场景.操作.保存简历({ ...从BFF简历(previous), 教育: [教育段('edu_local_1')] } as never))
      .rejects.toBe(未确定);
    const 槽 = 场景.deps.建档草稿引用!.current!.待写入;
    expect(槽).toMatchObject({ 种类: 'education-create', 阶段: 'prepared' });
    const 发出的键 = (请求Mock.mock.calls
      .map((c) => c[0] as BFF请求选项)
      .find((o) => o.method === 'POST'))?.幂等键;
    expect(槽?.幂等键).toBe(发出的键); // 原键留在槽里，重试复用同一把
  });

  it('重复点击：第一条在途时第二条 保存简历 拒绝明确 busy 错误，不 return 假成功', async () => {
    const 场景 = 创建场景();
    const 快照 = 从BFF简历(BFF简历样本);
    let 放行!: () => void;
    场景.后端.读取简历.mockReturnValue(new Promise((ok) => { 放行 = () => ok(快照); }));
    场景.后端.保存简历.mockResolvedValue(快照 as never);
    const 第一 = 场景.操作.保存简历({} as never);
    await expect(场景.操作.保存简历({} as never)).rejects.toThrow('简历保存进行中');
    放行();
    await expect(第一).resolves.toBeUndefined();
  });

  it('保存在途切账号：迟到成功不水合新主体、不写新主体草稿', async () => {
    const previous: BFF简历 = { ...BFF简历样本, educations: [] };
    const 权威后 = { ...BFF简历样本, educations: [教育DTO('edu_srv_1', 1)] };
    let 放行!: () => void;
    let 教育POST数 = 0;
    const 请求Mock = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
      if ((选项.method ?? 'GET') === 'GET' && 选项.path === '/api/v1/me/resume') {
        return { result: 教育POST数 === 0 ? previous : 权威后, etag: null, requestId: 'r' };
      }
      if (选项.method === 'POST' && 选项.path === '/api/v1/me/resume/educations') {
        return new Promise((ok) => {
          放行 = () => {
            教育POST数 += 1;
            ok({ result: { entry: { kind: 'education', education: 教育DTO('edu_srv_1', 1) }, aggregate_revision: 7 }, etag: null, requestId: 'r' });
          };
        }) as Promise<BFF响应<unknown>>;
      }
      throw new Error(`未预期的请求 ${选项.method} ${选项.path}`);
    });
    const 建档: 候选引导建档草稿 = { 资料: { 教育: [教育段('edu_local_1')] } };
    const 场景 = 创建场景({
      建档,
      后端覆盖: 创建简历数据源(请求Mock as unknown as 请求函数) as unknown as Partial<HTTP招聘数据源>,
    });
    const 写 = 场景.操作.保存简历({ ...从BFF简历(previous), 教育: [教育段('edu_local_1')] } as never);
    // 等到 POST 真正发出（挂起的 deferred 已装好 放行）再切账号
    await new Promise((完成) => setTimeout(完成, 0));
    场景.deps.主体标识引用.current = 'sub_2';
    场景.deps.建档草稿引用!.current = null;
    放行();
    await expect(写).resolves.toBeUndefined();
    const 动作们 = (场景.派发.mock.calls as { 型: string }[][]).map(([a]) => a.型);
    expect(动作们).not.toContain('水合后端简历'); // 迟到成功不水合新主体
    expect((场景.后端状态引用.current as { 简历快照: unknown }).简历快照).toBeNull();
    expect(场景.deps.建档草稿引用!.current).toBeNull(); // 不向新主体写草稿
  });

  it('条目 DELETE 只消费明确删除登记：hydrate 缺项不发 DELETE，登记后按原 revision 删除并移除身份', async () => {
    const previous = BFF简历样本; // 含 exp_1（revision 4）
    // 缺项保护：草稿里没有 exp_1（hydrate 缺项），next 也不含 → 不发 DELETE。
    // 只读桩对任何 mutation 都抛错：保存能 resolve 即证明零 DELETE 零 PATCH。
    const 保留场景 = 创建场景({
      建档: { 资料: {} },
      后端覆盖: 创建简历数据源(只读请求桩([previous]) as unknown as 请求函数) as unknown as Partial<HTTP招聘数据源>,
    });
    const 空 = { ...从BFF简历(previous), 经历: [] as 简历经历段[] };
    await expect(保留场景.操作.保存简历(空 as never)).resolves.toBeUndefined();

    // 明确删除登记后：DELETE 走原 revision，成功后移除登记与已存身份
    let 删除数 = 0;
    const 删除请求Mock = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
      if ((选项.method ?? 'GET') === 'GET' && 选项.path === '/api/v1/me/resume') {
        return { result: 删除数 === 0 ? previous : { ...previous, experiences: [] }, etag: null, requestId: 'r' };
      }
      if (选项.method === 'DELETE' && 选项.path === '/api/v1/me/resume/experiences/exp_1') {
        删除数 += 1;
        return { result: { ...previous, experiences: [] }, etag: null, requestId: 'r' };
      }
      throw new Error(`未预期的请求 ${选项.method} ${选项.path}`);
    });
    const 删除场景 = 创建场景({
      建档: {
        资料: {},
        已存条目: [{ 本地编号: 'exp_1', 种类: 'experience', 资源编号: 'exp_1', revision: 4 }],
        明确删除条目: [{ 种类: 'experience', 资源编号: 'exp_1', revision: 4 }],
      },
      后端覆盖: 创建简历数据源(删除请求Mock as unknown as 请求函数) as unknown as Partial<HTTP招聘数据源>,
    });
    await expect(删除场景.操作.保存简历({ ...从BFF简历(previous), 经历: [] as 简历经历段[] } as never))
      .resolves.toBeUndefined();
    const 删除们 = 删除请求Mock.mock.calls.map((c) => c[0] as BFF请求选项)
      .filter((o) => o.method === 'DELETE');
    expect(删除们).toHaveLength(1);
    expect(删除们[0].ifMatch).toBe('"4"'); // 原 revision 删除，不盲换
    const 删除草稿 = 删除场景.deps.建档草稿引用!.current!;
    expect(删除草稿.明确删除条目).toHaveLength(0); // 成功移除对应登记
    expect(删除草稿.已存条目).toHaveLength(0); // 成功移除对应已存身份
  });

  it('保存个人优势 不携带作品集链接：普通路径不带该键，建档路径不覆盖草稿 URL 与未提交字段', async () => {
    const previous: BFF简历 = {
      ...BFF简历样本,
      profile: { ...BFF简历样本.profile, portfolio_url: 'https://old.example.com' },
    };
    // 普通路径：透传给数据源的 写入 不含 作品集链接 键（缺省 = 未改，不从旧 GET 顺带覆盖）
    const 普通场景 = 创建场景();
    普通场景.后端.读取简历.mockResolvedValue(从BFF简历(previous) as never);
    普通场景.后端.保存简历.mockResolvedValue(从BFF简历(previous) as never);
    await 普通场景.操作.保存个人优势('新优势');
    const 写入 = 普通场景.后端.保存简历.mock.calls[0][0];
    expect(Object.prototype.hasOwnProperty.call(写入, '作品集链接')).toBe(false);
    expect(写入.个人优势).toBe('新优势');

    // 建档路径：summary 分区单独写入，不发 profile PATCH，草稿 URL/未提交字段原样保留
    let summaryPATCH数 = 0;
    const 请求Mock = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
      if ((选项.method ?? 'GET') === 'GET' && 选项.path === '/api/v1/me/resume') {
        return { result: previous, etag: null, requestId: 'r' };
      }
      if (选项.method === 'PATCH' && 选项.path === '/api/v1/me/resume/summary') {
        summaryPATCH数 += 1;
        return { result: previous, etag: null, requestId: 'r' };
      }
      throw new Error(`未预期的请求 ${选项.method} ${选项.path}`);
    });
    const 场景 = 创建场景({
      建档: { 资料: { 个人优势: '草稿优势', 作品集链接: 'https://draft.example.com', 技能: ['Draft'] } },
      后端覆盖: 创建简历数据源(请求Mock as unknown as 请求函数) as unknown as Partial<HTTP招聘数据源>,
    });
    await expect(场景.操作.保存个人优势('新优势')).resolves.toBeUndefined();
    expect(summaryPATCH数).toBe(1);
    const 请求们 = 请求Mock.mock.calls.map((c) => c[0] as BFF请求选项);
    expect(请求们.filter((o) => o.path === '/api/v1/me/resume/profile')).toHaveLength(0);
    const 草稿 = 场景.deps.建档草稿引用!.current!;
    expect(草稿.资料?.作品集链接).toBe('https://draft.example.com'); // 草稿 URL 不被覆盖
    expect(草稿.资料?.技能).toEqual(['Draft']); // 其他未提交字段不被吞
    expect(草稿.已存分区).toEqual({ summary: 1 });
  });
});

// ── J-PILOT-02 Task 7：首次意向身份与恢复（Spec §5.3）──
// 已 receipt 的意向只 GET exact ID；列表另有 active 意向不冒充本次成功；
// 未知创建按原 key 重放；返回修改走同一资源的 CAS 且保留权威 exclusions。

describe('创建候选操作 · 首次意向身份（J-PILOT-02 Task 7）', () => {
  const 首次输入 = {
    职位们: ['产品经理'],
    城市们: ['上海市'],
    薪资: { 下限: 10, 上限: 20, 单位: '月薪K' as const },
    筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['混合'] },
    排除项: [] as string[],
    职位引用: { id: 'tax_pm', display_name: '产品经理' },
    城市引用们: [{ id: 'loc_sh', display_name: '上海市' }],
  } as unknown as Parameters<候选操作['保存首次意向']>[0];

  /** 与 首次输入 逐字对应的权威 DTO（本轮未改动时 GET 回来就是它）。 */
  const 权威意向 = (覆盖: Partial<BFFOwnerIntention> = {}): BFFOwnerIntention => ({
    ...BFF意向样本,
    intention_id: 'int_7',
    recruitment_type: 'social_full_time',
    job_category: { id: 'tax_pm', display_name: '产品经理' },
    primary_location: { id: 'loc_sh', display_name: '上海市' },
    alternate_locations: [],
    industries: [],
    workplace_modes: ['hybrid'],
    compensation: { mode: 'range', lower: 10, upper: 20, annual_salary_months: null },
    salary_period: 'month',
    graduation_month: null,
    internship_months: null,
    onsite_days_per_week: null,
    private_preferences: '',
    revision: 3,
    ...覆盖,
  });

  /** 意向域真实数据源：按 method+path 分派，未预期请求直接抛错。 */
  function 意向场景(选项: {
    建档?: 候选引导建档草稿 | null;
    处理: (选项: BFF请求选项) => unknown;
  }) {
    const 请求Mock = vi.fn(async (请求选项: BFF请求选项): Promise<BFF响应<unknown>> => ({
      result: await 选项.处理(请求选项), etag: null, requestId: 'r',
    }));
    const 场景 = 创建场景({
      建档: 选项.建档 === undefined ? {} : 选项.建档,
      后端覆盖: 创建意向数据源(请求Mock as unknown as 请求函数) as unknown as Partial<HTTP招聘数据源>,
    });
    const 请求们 = () => 请求Mock.mock.calls.map((c) => c[0] as BFF请求选项);
    return { ...场景, 请求Mock, 请求们 };
  }

  it('POST 201 后列表 GET 失败：ID/revision 已落草稿、槽已清，不再重复创建', async () => {
    let POST数 = 0;
    const 场景 = 意向场景({
      处理: (o) => {
        if (o.method === 'POST') {
          POST数 += 1;
          return { ...权威意向(), intention_id: 'int_new', revision: 1 };
        }
        throw new BFF错误(503, 'storage_unavailable', '稍后再试');
      },
    });
    await expect(场景.操作.保存首次意向(首次输入)).rejects.toBeInstanceOf(BFF错误);
    expect(POST数).toBe(1);
    const 草稿 = 场景.deps.建档草稿引用!.current!;
    expect(草稿.首次意向).toEqual({ id: 'int_new', revision: 1 });
    expect(草稿.待写入).toBeUndefined();
  });

  it('刷新后有本轮 ID：只 GET exact ID 核对，未改就不重复写', async () => {
    const 场景 = 意向场景({
      建档: { 首次意向: { id: 'int_7', revision: 3 } },
      处理: (o) => {
        if (o.path === '/api/v1/me/intentions/int_7') return 权威意向();
        if (o.path.startsWith('/api/v1/me/intentions?')) return { intentions: [权威意向()] };
        throw new Error(`未预期的请求 ${o.method ?? 'GET'} ${o.path}`);
      },
    });
    await expect(场景.操作.保存首次意向(首次输入)).resolves.toBeUndefined();
    const 请求们 = 场景.请求们();
    expect(请求们.filter((o) => (o.method ?? 'GET') !== 'GET')).toHaveLength(0);
    expect(请求们[0].path).toBe('/api/v1/me/intentions/int_7');
  });

  it('503 结果未知：保留 prepared 槽与原幂等键，重试复用同一把键不铸新键', async () => {
    const POST键们: (string | undefined)[] = [];
    let 失败一次 = true;
    const 场景 = 意向场景({
      处理: (o) => {
        if (o.method === 'POST') {
          POST键们.push(o.幂等键);
          if (失败一次) {
            失败一次 = false;
            throw new BFF错误(503, 'operation_outcome_unknown', '结果未知');
          }
          return { ...权威意向(), intention_id: 'int_new', revision: 1 };
        }
        return { intentions: [] };
      },
    });
    await expect(场景.操作.保存首次意向(首次输入)).rejects.toBeInstanceOf(BFF错误);
    const 槽 = 场景.deps.建档草稿引用!.current!.待写入!;
    expect(槽).toMatchObject({ 种类: 'first-intention-create', 阶段: 'prepared' });
    expect(typeof 槽.幂等键).toBe('string');
    // 用户再点一次保存：同一逻辑命令复用原 key 重放，不产生第二个键
    await expect(场景.操作.保存首次意向(首次输入)).resolves.toBeUndefined();
    expect(POST键们).toHaveLength(2);
    expect(POST键们[0]).toBe(槽.幂等键);
    expect(POST键们[1]).toBe(槽.幂等键);
    expect(场景.deps.建档草稿引用!.current!.首次意向).toEqual({ id: 'int_new', revision: 1 });
  });

  it('列表另有 active 意向不算本次成功：本轮无回执仍照常创建', async () => {
    let POST数 = 0;
    const 场景 = 意向场景({
      处理: (o) => {
        if (o.method === 'POST') { POST数 += 1; return { ...权威意向(), intention_id: 'int_new', revision: 1 }; }
        return { intentions: [权威意向({ intention_id: 'int_other' })] };
      },
    });
    场景.状态引用.current = {
      ...场景.状态引用.current,
      求职意向表: [{ 编号: 'int_other', 标题: '[北京] 后端', 说明: '' }],
    } as never;
    await expect(场景.操作.保存首次意向(首次输入)).resolves.toBeUndefined();
    expect(POST数).toBe(1);
  });

  it('快速双击：第二次在途调用不产生第二笔 POST', async () => {
    let POST数 = 0;
    let 放行!: () => void;
    const 闸门 = new Promise<void>((ok) => { 放行 = ok; });
    const 场景 = 意向场景({
      处理: async (o) => {
        if (o.method === 'POST') {
          POST数 += 1;
          await 闸门;
          return { ...权威意向(), intention_id: 'int_new', revision: 1 };
        }
        return { intentions: [] };
      },
    });
    const 第一次 = 场景.操作.保存首次意向(首次输入);
    const 第二次 = 场景.操作.保存首次意向(首次输入);
    放行();
    await Promise.all([第一次, 第二次]);
    expect(POST数).toBe(1);
  });

  it('返回重新确认修改：PATCH 同一 id、用权威 revision 作 If-Match，并保留已有 exclusions', async () => {
    const 权威 = 权威意向({
      revision: 5, // 草稿记的是 3：CAS 必须用本次 GET 的权威 revision
      exclusions: {
        alternate_weekend_work: 'excluded',
        outsourcing_only: 'unspecified',
        onsite_only: 'unspecified',
        frequent_travel: 'excluded',
      },
      private_preferences: '上一轮写的诉求',
    });
    const 场景 = 意向场景({
      建档: { 首次意向: { id: 'int_7', revision: 3 } },
      处理: (o) => {
        if (o.method === 'PATCH') return { ...权威, revision: 6 };
        if (o.path === '/api/v1/me/intentions/int_7') return 权威;
        return { intentions: [{ ...权威, revision: 6 }] };
      },
    });
    await expect(场景.操作.保存首次意向({
      ...首次输入,
      薪资: { 下限: 30, 上限: 50, 单位: '月薪K' },
      排除项: ['大小周'],
      自定义诉求: ['不接受夜班'],
    } as never)).resolves.toBeUndefined();
    const patch = 场景.请求们().find((o) => o.method === 'PATCH');
    expect(patch?.path).toBe('/api/v1/me/intentions/int_7');
    expect(patch?.ifMatch).toBe('"5"');
    expect(场景.请求们().filter((o) => o.method === 'POST')).toHaveLength(0);
    const body = patch?.body as Record<string, unknown>;
    // 历史硬排除原样保留（私有诉求不写硬排除，也不清洗既有规则）
    expect(body.exclusions).toEqual(权威.exclusions);
    expect(body.private_preferences).toBe('不接受大小周\n不接受夜班');
    expect(body.compensation).toMatchObject({ mode: 'range', lower: 30, upper: 50 });
    expect(场景.deps.建档草稿引用!.current!.首次意向).toEqual({ id: 'int_7', revision: 6 });
    expect(场景.deps.建档草稿引用!.current!.待写入).toBeUndefined();
  });

  it('修改遇 409：保留输入与本轮 ID，重读权威后原样抛错，不盲覆盖', async () => {
    const 权威 = 权威意向({ revision: 5 });
    const 场景 = 意向场景({
      建档: { 首次意向: { id: 'int_7', revision: 3 } },
      处理: (o) => {
        if (o.method === 'PATCH') throw new BFF错误(409, 'version_conflict', '数据已在其他地方更新，请重试');
        if (o.path === '/api/v1/me/intentions/int_7') return 权威;
        return { intentions: [权威] };
      },
    });
    await expect(场景.操作.保存首次意向({ ...首次输入, 薪资: { 下限: 30, 上限: 50, 单位: '月薪K' } } as never))
      .rejects.toMatchObject({ code: 'version_conflict' });
    // 仍是同一条资源：ID 不变；revision 跟着本次权威 GET 走（结算只认权威事实，不是盲改）
    expect(场景.deps.建档草稿引用!.current!.首次意向).toEqual({ id: 'int_7', revision: 5 });
    // 冲突不是确定拒绝：本次 CAS 槽保留待用户重审，不清不重放
    expect(场景.deps.建档草稿引用!.current!.待写入).toMatchObject({
      种类: 'first-intention-update', 资源编号: 'int_7', ifMatch: 5, 阶段: 'prepared',
    });
  });

  // review r1 #4：上一次 PATCH 结果未知（503/断网）后用户改成了另一个值 ——
  // 权威 GET 是这条无幂等合同的 CAS 的终局判据，必须无条件结算旧槽，
  // 否则 发送前 会拿「ifMatch/body 都不同」拦下新提交，且因为它抛在 本槽命令 落定之前，
  // catch 也清不掉 —— 整条旅程（summary/profile/文件）的写入会被一起锁死。
  it('上次 PATCH 结果未知后改成新值：权威 GET 先结算旧槽，新改动照常 PATCH', async () => {
    const 旧命令体 = { primary_location_id: 'loc_sh', compensation: { mode: 'range', lower: 30, upper: 50 } };
    const 权威 = 权威意向({
      revision: 6, // 上一次 PATCH 其实生效了（30–50 已在服务端，revision 前进）
      compensation: { mode: 'range', lower: 30, upper: 50, annual_salary_months: null },
    });
    const 场景 = 意向场景({
      建档: {
        首次意向: { id: 'int_7', revision: 5 },
        待写入: {
          种类: 'first-intention-update',
          资源编号: 'int_7',
          请求体: 旧命令体,
          ifMatch: 5,
          阶段: 'prepared',
        },
      },
      处理: (o) => {
        if (o.method === 'PATCH') return { ...权威, revision: 7 };
        if (o.path === '/api/v1/me/intentions/int_7') return 权威;
        return { intentions: [{ ...权威, revision: 7 }] };
      },
    });
    await expect(场景.操作.保存首次意向({
      ...首次输入,
      薪资: { 下限: 40, 上限: 60, 单位: '月薪K' },
    } as never)).resolves.toBeUndefined();
    const patch = 场景.请求们().find((o) => o.method === 'PATCH');
    expect(patch?.ifMatch).toBe('"6"'); // 用权威 revision，不是草稿里那个 5
    const 新body = patch?.body as Record<string, unknown> | undefined;
    expect(新body?.compensation).toMatchObject({ mode: 'range', lower: 40, upper: 60 });
    expect(场景.deps.建档草稿引用!.current!.首次意向).toEqual({ id: 'int_7', revision: 7 });
    expect(场景.deps.建档草稿引用!.current!.待写入).toBeUndefined();
  });

  it('确定拒绝（422）清本次未结算槽并保留输入：不把单槽永久锁死', async () => {
    const 场景 = 意向场景({
      处理: (o) => {
        if (o.method === 'POST') throw new BFF错误(422, 'validation_failed', '请检查填写内容');
        return { intentions: [] };
      },
    });
    await expect(场景.操作.保存首次意向(首次输入)).rejects.toMatchObject({ status: 422 });
    expect(场景.deps.建档草稿引用!.current!.待写入).toBeUndefined();
    expect(场景.deps.建档草稿引用!.current!.首次意向).toBeUndefined();
  });

  it('无建档草稿（日常语境）：不接跟踪，也不因本轮逻辑重复创建已有意向', async () => {
    const 场景 = 创建场景();
    场景.状态引用.current = {
      ...场景.状态引用.current,
      求职意向表: [{ 编号: 'int_other', 标题: '[北京] 后端', 说明: '' }],
    } as never;
    await 场景.操作.保存首次意向(首次输入);
    expect(场景.后端.创建首次意向).not.toHaveBeenCalled();
  });
});

// ── J-PILOT-02 Task 8：头像写入身份 —— 单槽登记、未知结果不伪成功、原 key/If-Match 重放 ──
// 头像命令是文件类命令（Task 6 同款纪律）：槽里只有 name/type/size/lastModified/SHA-256
// 文件核对，绝不存字节；未知结果保留槽与原幂等键/原 If-Match（revision 也是幂等身份）。

describe('创建候选操作 · 建档头像写入（J-PILOT-02 Task 8）', () => {
  async function 摘要(file: File): Promise<string> {
    const 摘 = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(摘)].map((字节) => 字节.toString(16).padStart(2, '0')).join('');
  }

  const 档案 = (revision: number, 有头像: boolean) => ({
    avatar_url: 有头像 ? ('/api/v1/me/avatar/content' as const) : null,
    revision,
    updated_at: null,
  });

  /** 头像域真实数据源链路 + 捕获每次草稿写入（观察登记过的槽）。 */
  function 头像场景(选项: {
    建档?: 候选引导建档草稿 | null;
    处理: (o: BFF请求选项) => unknown;
  }) {
    const 草稿写入们: 候选引导建档草稿[] = [];
    const 存储: 候选建档草稿存储 = {
      读取: vi.fn(() => null),
      写入: vi.fn((建档: 候选引导建档草稿) => {
        草稿写入们.push(建档);
        return true;
      }),
    };
    const 请求Mock = vi.fn(async (请求选项: BFF请求选项): Promise<BFF响应<unknown>> => ({
      result: await 选项.处理(请求选项), etag: null, requestId: 'r',
    }));
    const 场景 = 创建场景({
      建档: 选项.建档 === undefined ? {} : 选项.建档,
      存储,
      后端覆盖: 创建候选账号数据源(请求Mock as unknown as 请求函数) as unknown as Partial<HTTP招聘数据源>,
    });
    const 请求们 = () => 请求Mock.mock.calls.map((c) => c[0] as BFF请求选项);
    const POST们 = () => 请求们().filter((o) => o.method === 'POST' && o.path === '/api/v1/me/avatar');
    return { ...场景, 请求们, POST们, 草稿写入们 };
  }

  const 同一张图片 = () => new File(['avatar-bytes'], 'avatar.png', {
    type: 'image/png', lastModified: 123,
  });

  it('成功：发送前登记 avatar 槽（五键文件核对 + 原 revision 的 ifMatch + 幂等键），回执后清槽并记 头像状态 已保存', async () => {
    const 图片 = 同一张图片();
    const 场景 = 头像场景({
      处理: (o) => {
        if ((o.method ?? 'GET') === 'GET' && o.path === '/api/v1/me/account-profile') return 档案(5, false);
        if (o.method === 'POST' && o.path === '/api/v1/me/avatar') return 档案(6, true);
        throw new Error(`未预期的请求 ${o.method} ${o.path}`);
      },
    });
    await expect(场景.操作.保存候选头像(图片)).resolves.toBeUndefined();
    const 草稿 = 场景.deps.建档草稿引用!.current!;
    expect(草稿.待写入).toBeUndefined(); // 已确认后清槽
    expect(草稿.头像状态).toBe('已保存');
    expect(场景.POST们()).toHaveLength(1);
    expect(场景.POST们()[0].ifMatch).toBe('"5"'); // 上传前权威读取的 revision
    expect(typeof 场景.POST们()[0].幂等键).toBe('string');
    // 登记过的槽：五键文件核对（绝不存字节）、原 revision 的 ifMatch、prepared
    const 槽 = 场景.草稿写入们.map((b) => b.待写入).find((项) => 项 !== undefined)!;
    expect(槽.种类).toBe('avatar');
    expect(槽.阶段).toBe('prepared');
    expect(槽.ifMatch).toBe(5);
    expect(槽.请求体).toBeUndefined();
    expect(槽.文件核对).toEqual({
      name: 'avatar.png', type: 'image/png', size: 图片.size, lastModified: 123,
      sha256: await 摘要(图片),
    });
    // 成功回执路径上的权威水合照常（破缓存地址带 revision）
    expect(场景.派发).toHaveBeenCalledWith({
      型: '存求职头像', 图: '/api/v1/me/avatar/content?v=6',
    });
  });

  it('503 结果未知：槽与原幂等键保留、头像状态 待核对，绝不自动重传', async () => {
    const 图片 = 同一张图片();
    const 场景 = 头像场景({
      处理: (o) => {
        if ((o.method ?? 'GET') === 'GET' && o.path === '/api/v1/me/account-profile') return 档案(5, false);
        if (o.method === 'POST' && o.path === '/api/v1/me/avatar') {
          throw new BFF错误(503, 'operation_outcome_unknown', '结果未知');
        }
        throw new Error(`未预期的请求 ${o.method} ${o.path}`);
      },
    });
    await expect(场景.操作.保存候选头像(图片)).rejects.toMatchObject({ status: 503 });
    const 草稿 = 场景.deps.建档草稿引用!.current!;
    expect(草稿.待写入).toMatchObject({ 种类: 'avatar', 阶段: 'prepared', ifMatch: 5 });
    expect(草稿.头像状态).toBe('待核对');
    expect(草稿.待写入!.幂等键).toBe(场景.POST们()[0].幂等键); // 原键留在槽里
    expect(场景.POST们()).toHaveLength(1); // 只发过一次
  });

  it('503 后重选同一张图片：沿用槽内原幂等键与原 If-Match 重放（revision 也是幂等身份，不拿新快照冒充）', async () => {
    let POST数 = 0;
    let GET数 = 0;
    const 场景 = 头像场景({
      处理: (o) => {
        if ((o.method ?? 'GET') === 'GET' && o.path === '/api/v1/me/account-profile') {
          GET数 += 1;
          // 第一次发送前 revision 5；失败后权威账号已被别处推进到 9（且头像在场）
          return GET数 === 1 ? 档案(5, false) : 档案(9, true);
        }
        if (o.method === 'POST' && o.path === '/api/v1/me/avatar') {
          POST数 += 1;
          if (POST数 === 1) throw new BFF错误(503, 'operation_outcome_unknown', '结果未知');
          return 档案(10, true);
        }
        throw new Error(`未预期的请求 ${o.method} ${o.path}`);
      },
    });
    await expect(场景.操作.保存候选头像(同一张图片())).rejects.toMatchObject({ status: 503 });
    const 原键 = 场景.deps.建档草稿引用!.current!.待写入!.幂等键!;
    // 用户重选同一张图片（新的 File 实例、同字节）再保存
    await expect(场景.操作.保存候选头像(同一张图片())).resolves.toBeUndefined();
    expect(POST数).toBe(2);
    expect(场景.POST们()[1].幂等键).toBe(原键); // 复用原 key，不铸新键
    expect(场景.POST们()[1].ifMatch).toBe('"5"'); // 原 If-Match，不是新快照的 9
    const 草稿 = 场景.deps.建档草稿引用!.current!;
    expect(草稿.待写入).toBeUndefined();
    expect(草稿.头像状态).toBe('已保存');
  });

  it('槽未结算 + 不同比特：零发送、可上屏的闭合文案，槽原样保留', async () => {
    const 场景 = 头像场景({
      建档: {
        待写入: {
          种类: 'avatar', ifMatch: 5, 幂等键: 'idem-avatar-first-01', 阶段: 'prepared',
          文件核对: { name: 'first.png', type: 'image/png', size: 3, lastModified: 1, sha256: 'f'.repeat(64) },
        },
        头像状态: '待核对',
      },
      处理: (o) => {
        if ((o.method ?? 'GET') === 'GET' && o.path === '/api/v1/me/account-profile') return 档案(9, true);
        throw new Error(`未预期的请求 ${o.method} ${o.path}`);
      },
    });
    const 另一张 = new File(['different-bits'], 'second.png', { type: 'image/png', lastModified: 456 });
    const 错误 = await 场景.操作.保存候选头像(另一张).then(() => null, (e: unknown) => e);
    expect(错误).toBeInstanceOf(BFF错误);
    // 用户真正看到的那句话必须是可行动的原文（不是通用「请求失败」）
    expect(取后端错误文案(错误)).toBe('上一条写入结果未确认，请先重试或核对原步骤');
    expect(场景.POST们()).toHaveLength(0); // 本地拦截：一次都不发
    expect(场景.deps.建档草稿引用!.current!.待写入?.幂等键).toBe('idem-avatar-first-01'); // 槽原样
  });

  it('409 冲突同样保留槽（未知结算约定），重读仅为权威回显', async () => {
    const 图片 = 同一张图片();
    const 场景 = 头像场景({
      处理: (o) => {
        if ((o.method ?? 'GET') === 'GET' && o.path === '/api/v1/me/account-profile') return 档案(5, false);
        if (o.method === 'POST' && o.path === '/api/v1/me/avatar') {
          throw new BFF错误(409, 'version_conflict', '数据已在其他地方更新，请重试');
        }
        throw new Error(`未预期的请求 ${o.method} ${o.path}`);
      },
    });
    await expect(场景.操作.保存候选头像(图片)).rejects.toMatchObject({ code: 'version_conflict' });
    const 草稿 = 场景.deps.建档草稿引用!.current!;
    expect(草稿.待写入).toMatchObject({ 种类: 'avatar', 阶段: 'prepared' }); // 待核对
    expect(草稿.头像状态).toBe('待核对');
  });

  it('确定拒绝（422）：清本次头像槽并恢复登记前的头像状态，不把单槽永久锁死', async () => {
    const 场景 = 头像场景({
      建档: { 头像状态: '已保存' }, // 本轮已成功传过一张：这次换图被服务端确定拒绝
      处理: (o) => {
        if ((o.method ?? 'GET') === 'GET' && o.path === '/api/v1/me/account-profile') return 档案(6, true);
        if (o.method === 'POST' && o.path === '/api/v1/me/avatar') {
          throw new BFF错误(422, 'validation_failed', '图片无法处理');
        }
        throw new Error(`未预期的请求 ${o.method} ${o.path}`);
      },
    });
    await expect(场景.操作.保存候选头像(new File(['bad'], 'bad.png', { type: 'image/png' })))
      .rejects.toMatchObject({ status: 422 });
    const 草稿 = 场景.deps.建档草稿引用!.current!;
    expect(草稿.待写入).toBeUndefined(); // 确定拒绝清槽
    expect(草稿.头像状态).toBe('已保存'); // 恢复登记前的值，不误报 未选
  });

  it('写在途切账号：迟到成功不水合新主体、不写新主体草稿', async () => {
    let 放行!: (值: unknown) => void;
    const 场景 = 头像场景({
      处理: (o) => {
        if ((o.method ?? 'GET') === 'GET' && o.path === '/api/v1/me/account-profile') return 档案(5, false);
        if (o.method === 'POST' && o.path === '/api/v1/me/avatar') {
          return new Promise((ok) => { 放行 = ok; });
        }
        throw new Error(`未预期的请求 ${o.method} ${o.path}`);
      },
    });
    const 写 = 场景.操作.保存候选头像(同一张图片());
    await new Promise((完成) => setTimeout(完成, 0)); // 等 POST 真正挂起（发送前已登记槽）
    场景.deps.主体标识引用.current = 'sub_2'; // 请求在途时用户换了账号
    场景.deps.建档草稿引用!.current = null; // Provider 换主体时同步清草稿
    const 切换时写入数 = 场景.草稿写入们.length;
    放行(档案(6, true));
    await expect(写).resolves.toBeUndefined();
    const 动作们 = (场景.派发.mock.calls as { 型: string }[][]).map(([a]) => a.型);
    // 切换前的那次权威读取水合是合法的；迟到的上传成功不得再水合新主体（恰一次）
    expect(动作们.filter((型) => 型 === '存求职头像')).toHaveLength(1);
    expect(场景.deps.建档草稿引用!.current).toBeNull(); // 不向新主体写草稿
    expect(场景.草稿写入们).toHaveLength(切换时写入数); // 迟到回执被栅栏拦下：不再新增草稿写入
  });

  it('无建档草稿（日常语境）：数据源不收跟踪、草稿零写入、成功水合照常', async () => {
    const 图片 = 同一张图片();
    const 场景 = 头像场景({
      建档: null,
      处理: (o) => {
        if ((o.method ?? 'GET') === 'GET' && o.path === '/api/v1/me/account-profile') return 档案(5, false);
        if (o.method === 'POST' && o.path === '/api/v1/me/avatar') return 档案(6, true);
        throw new Error(`未预期的请求 ${o.method} ${o.path}`);
      },
    });
    await expect(场景.操作.保存候选头像(图片)).resolves.toBeUndefined();
    expect(场景.POST们()).toHaveLength(1);
    expect(场景.POST们()[0].幂等键).toBeUndefined(); // 无跟踪：键由 HTTP 层自理
    expect(场景.草稿写入们).toHaveLength(0); // 草稿零写入
    expect(场景.派发).toHaveBeenCalledWith({
      型: '存求职头像', 图: '/api/v1/me/avatar/content?v=6',
    });
  });

  it('SHA-256 不可用：本次不登记单槽（也就不会拿原幂等键配另一份字节），上传照常', async () => {
    const 摘要桩 = vi.spyOn(globalThis.crypto.subtle, 'digest')
      .mockRejectedValue(new Error('SubtleCrypto unavailable'));
    try {
      const 图片 = 同一张图片();
      const 场景 = 头像场景({
        处理: (o) => {
          if ((o.method ?? 'GET') === 'GET' && o.path === '/api/v1/me/account-profile') return 档案(5, false);
          if (o.method === 'POST' && o.path === '/api/v1/me/avatar') return 档案(6, true);
          throw new Error(`未预期的请求 ${o.method} ${o.path}`);
        },
      });
      await expect(场景.操作.保存候选头像(图片)).resolves.toBeUndefined();
      expect(场景.POST们()).toHaveLength(1); // 上传照常
      const 草稿 = 场景.deps.建档草稿引用!.current!;
      expect(草稿.待写入).toBeUndefined(); // 没有核对坐标就不登记
      expect(草稿.头像状态).toBeUndefined(); // 不产生头像状态事实
    } finally {
      摘要桩.mockRestore();
    }
  });
});
