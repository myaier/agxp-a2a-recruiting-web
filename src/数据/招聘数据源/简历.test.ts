// 简历数据源分区写入 · 空身份（M）：身份为 '' 时 profile 分区整体跳过，
// summary/skills/experiences/educations/certificates 仍独立 diff 照发；
// 身份非空且 profile 变化时才 PATCH。转资料写入 本身拒绝空身份（后端映射测试覆盖），
// 这里验证数据源不会因为 Context 里未提交的 /basic 草稿（空身份 + 本地姓名/生日）
// 抛错或阻断其它五个分区。

import { describe, expect, it, vi } from 'vitest';
import { BFF错误, type BFF请求选项, type BFF响应 } from '../HTTP客户端';
import { BFF简历样本 } from '../../测试/BFF样本';
import type { BFF简历, BFF教育, BFF经历 } from '../BFF契约';
import type { 简历经历段, 简历教育段 } from '../类型';
import { 从BFF简历 } from '../后端映射';
import { 创建简历数据源 } from './简历';
import type { 建档待写入, 建档写入跟踪, 建档写入回执 } from '../招聘数据源类型';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

/** 记录全部调用的 mock 请求：GET /me/resume 返回 最终简历（默认 BFF简历样本） */
function 请求桩(最终简历: typeof BFF简历样本 = BFF简历样本) {
  const 请求Mock = vi.fn(async (_选项: BFF请求选项) => ({ result: 最终简历, etag: null, requestId: 'r1' }));
  return { 请求Mock, 请求: 请求Mock as unknown as 请求函数 };
}

const 空身份页面 = (dto: typeof BFF简历样本) => {
  const 页面 = 从BFF简历(dto);
  return { ...页面, 基本信息: { ...页面.基本信息, 身份: '' as const } };
};

const 空profile简历 = (): typeof BFF简历样本 => ({
  ...BFF简历样本,
  profile: { ...BFF简历样本.profile, real_name: '', work_start_year: null, status: '' },
});

describe('简历数据源 · 空身份跳过 profile 分区（M）', () => {
  it('previous/next 身份均为空且只改技能：不发 profile PATCH，只发 skills PATCH', async () => {
    const previous = 空profile简历();
    const { 请求Mock, 请求 } = 请求桩();
    const next = { ...空身份页面(previous), 技能: ['TypeScript', 'React'] };
    await 创建简历数据源(请求).保存简历(next, previous);
    const 调用 = 请求Mock.mock.calls.map((c) => [(c[0] as BFF请求选项).method ?? 'GET', (c[0] as BFF请求选项).path]);
    expect(调用).toEqual([
      ['PATCH', '/api/v1/me/resume/skills'],
      ['GET', '/api/v1/me/resume'],
    ]);
  });

  it('previous 空 profile，next 空身份但带 /basic 本地姓名生日并改技能：跳过 profile，其余照发', async () => {
    const previous = 空profile简历();
    const { 请求Mock, 请求 } = 请求桩();
    const next = {
      ...空身份页面(previous),
      基本信息: { ...空身份页面(previous).基本信息, 真名: '沈', 出生年: '1998', 出生月: '6' },
      技能: ['TypeScript', 'React'],
    };
    await expect(创建简历数据源(请求).保存简历(next, previous)).resolves.toBeDefined();
    const 调用 = 请求Mock.mock.calls.map((c) => [(c[0] as BFF请求选项).method ?? 'GET', (c[0] as BFF请求选项).path]);
    expect(调用).toEqual([
      ['PATCH', '/api/v1/me/resume/skills'],
      ['GET', '/api/v1/me/resume'],
    ]);
  });

  it('previous 空 status、next 身份为离职：恰发一次 profile PATCH 且 body status = unemployed', async () => {
    const previous = 空profile简历();
    const { 请求Mock, 请求 } = 请求桩();
    const 页面 = 从BFF简历(previous);
    const next = { ...页面, 基本信息: { ...页面.基本信息, 身份: '离职' as const } };
    await 创建简历数据源(请求).保存简历(next, previous);
    const profile调用 = 请求Mock.mock.calls
      .map((c) => c[0] as BFF请求选项)
      .filter((选项) => 选项.path === '/api/v1/me/resume/profile');
    expect(profile调用).toHaveLength(1);
    expect(profile调用[0].body).toMatchObject({ status: 'unemployed' });
  });
});

// ── J-PILOT-02 Task 3：建档跟踪 —— 回执先落账、部分成功不重跑、原 key/body 保持 ──

/**
 * 记录型跟踪桩：同一逻辑命令（种类/坐标/请求体/ifMatch，不含幂等键与阶段）复用同一把键，
 * 模拟操作层 发送前 的「创建复用原 key」语义；已确认 记录命令与回执供断言。
 */
function 跟踪桩(事件?: string[]) {
  const 发送前们: 建档待写入[] = [];
  const 已确认们: { 命令: 建档待写入; 回执: 建档写入回执 }[] = [];
  const 键表 = new Map<string, string>();
  const 坐标 = (命令: 建档待写入) => JSON.stringify([
    命令.种类, 命令.本地编号 ?? null, 命令.资源编号 ?? null, 命令.父编号 ?? null,
    命令.请求体 ?? null, 命令.ifMatch ?? null,
  ]);
  const 跟踪: 建档写入跟踪 = {
    发送前(命令) {
      const 键 = 坐标(命令);
      if (!键表.has(键)) 键表.set(键, `idem-${键表.size + 1}`);
      const 定: 建档待写入 = { ...命令, 幂等键: 键表.get(键), 阶段: 'prepared' };
      发送前们.push(定);
      事件?.push(`发送前 ${命令.种类}`);
      return 定;
    },
    已确认(命令, 回执) {
      已确认们.push({ 命令, 回执 });
      事件?.push(`已确认 ${命令.种类}`);
    },
  };
  return { 跟踪, 发送前们, 已确认们, 键表 };
}

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

const 经历DTO = (id: string, revision: number): BFF经历 => ({
  id,
  company: '云衢',
  industry: { id: 'tax_i', display_name: '互联网' },
  title: '工程师',
  start_month: '2021-01',
  end_month: null,
  description: '平台',
  hidden: false,
  internship: false,
  revision,
  projects: [],
});

const 经历段 = (编号: string): 简历经历段 => ({
  编号,
  公司: '云衢',
  行业: '互联网',
  行业引用: { id: 'tax_i', display_name: '互联网' },
  职位: '工程师',
  开始: '2021-01',
  结束: null,
  内容: '平台',
  隐藏: false,
  项目: [{ 编号: 'proj_local_1', 名称: 'P1', 角色: '前端', 结果: '上线' }],
});

describe('简历数据源 · 建档跟踪回执（J-PILOT-02 Task 3）', () => {
  it('education POST 201 → 下一条失败 → GET 失败：第一条回执先落账，重试不重跑、原 key/body 保持', async () => {
    const previous = { ...BFF简历样本, educations: [] };
    const { 跟踪, 已确认们 } = 跟踪桩();
    const 下一条错误 = new BFF错误(500, 'internal_error', '后端暂时不可用');
    const GET错误 = new BFF错误(0, 'network_error', '网络连接失败');
    let 教育POST数 = 0;
    const 请求Mock = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
      if (选项.method === 'POST' && 选项.path === '/api/v1/me/resume/educations') {
        教育POST数 += 1;
        if (教育POST数 === 1) {
          return {
            result: { entry: { kind: 'education', education: 教育DTO('edu_srv_1', 1) }, aggregate_revision: 7 },
            etag: null, requestId: 'r1',
          };
        }
        throw 下一条错误;
      }
      if ((选项.method ?? 'GET') === 'GET' && 选项.path === '/api/v1/me/resume') throw GET错误;
      throw new Error(`未预期的请求 ${选项.method} ${选项.path}`);
    });
    const next = { ...从BFF简历(previous), 教育: [教育段('edu_local_1'), 教育段('edu_local_2')] };
    // 部分成功后必须抛原 mutation 错误 —— catch 路径的权威 GET 失败不得顶替它
    await expect(
      创建简历数据源(请求Mock as unknown as 请求函数).保存简历(next, previous, 跟踪),
    ).rejects.toBe(下一条错误);
    // 第一条回执在失败发生前已交跟踪（先落账，之后才 GET）
    expect(已确认们).toHaveLength(1);
    expect(已确认们[0].命令.种类).toBe('education-create');
    expect(已确认们[0].命令.本地编号).toBe('edu_local_1');
    expect(已确认们[0].回执).toEqual({ id: 'edu_srv_1', revision: 1, aggregate_revision: 7 });

    // 重试：已存身份把 edu_local_1 映射为 edu_srv_1（操作层职责），previous 权威含该条
    const previous2: BFF简历 = { ...BFF简历样本, educations: [教育DTO('edu_srv_1', 1)] };
    const 基页 = 从BFF简历(previous2);
    const next2 = { ...基页, 教育: [基页.教育[0], 教育段('edu_local_2')] };
    const 请求Mock2 = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
      if (选项.method === 'POST' && 选项.path === '/api/v1/me/resume/educations') {
        return {
          result: { entry: { kind: 'education', education: 教育DTO('edu_srv_2', 1) }, aggregate_revision: 8 },
          etag: null, requestId: 'r2',
        };
      }
      if ((选项.method ?? 'GET') === 'GET' && 选项.path === '/api/v1/me/resume') {
        return {
          result: { ...BFF简历样本, educations: [教育DTO('edu_srv_1', 1), 教育DTO('edu_srv_2', 1)] } as BFF简历,
          etag: null, requestId: 'r3',
        };
      }
      throw new Error(`未预期的请求 ${选项.method} ${选项.path}`);
    });
    await 创建简历数据源(请求Mock2 as unknown as 请求函数).保存简历(next2, previous2, 跟踪);
    const 首次POST们 = 请求Mock.mock.calls.map((c) => c[0] as BFF请求选项).filter((o) => o.method === 'POST');
    const 重试POST们 = 请求Mock2.mock.calls.map((c) => c[0] as BFF请求选项).filter((o) => o.method === 'POST');
    // 已收 receipt 不再 POST —— 同一本地条目始终只有一条服务器资源
    expect(首次POST们).toHaveLength(2);
    expect(重试POST们).toHaveLength(1);
    const 第二条首次 = 首次POST们[1];
    expect(重试POST们[0].body).toEqual(第二条首次.body); // 原 body 保持
    expect(重试POST们[0].幂等键).toBe(第二条首次.幂等键); // 原 key 保持
    expect(第二条首次.幂等键).toMatch(/^idem-/);
  });

  it('experience 成功 → project 未知：经历回执先于项目请求落账；重试不重建经历、项目原 key 重放', async () => {
    const previous = { ...BFF简历样本, experiences: [] };
    const 事件: string[] = [];
    const { 跟踪, 发送前们, 已确认们 } = 跟踪桩(事件);
    const 未知错误 = new BFF错误(503, 'operation_outcome_unknown', '结果未知');
    const 请求Mock = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
      事件.push(`请求 ${选项.method} ${选项.path}`);
      if (选项.method === 'POST' && 选项.path === '/api/v1/me/resume/experiences') {
        return {
          result: { entry: { kind: 'experience', experience: 经历DTO('exp_srv_1', 1) }, aggregate_revision: 2 },
          etag: null, requestId: 'r1',
        };
      }
      if (选项.method === 'POST' && 选项.path === '/api/v1/me/resume/experiences/exp_srv_1/projects') {
        throw 未知错误;
      }
      if ((选项.method ?? 'GET') === 'GET' && 选项.path === '/api/v1/me/resume') {
        throw new BFF错误(0, 'network_error', '网络连接失败');
      }
      throw new Error(`未预期的请求 ${选项.method} ${选项.path}`);
    });
    const next = { ...从BFF简历(previous), 经历: [经历段('exp_local_1')] };
    await expect(
      创建简历数据源(请求Mock as unknown as 请求函数).保存简历(next, previous, 跟踪),
    ).rejects.toBe(未知错误);
    // 经历回执已交跟踪，且先于项目请求发出 —— 新经历 ID 在项目请求前落存储
    expect(已确认们).toHaveLength(1);
    expect(已确认们[0].命令.种类).toBe('experience-create');
    expect(已确认们[0].回执.id).toBe('exp_srv_1');
    expect(事件.indexOf('已确认 experience-create'))
      .toBeLessThan(事件.indexOf('请求 POST /api/v1/me/resume/experiences/exp_srv_1/projects'));
    // 未知结果的项目命令已被 发送前 固定，父编号是服务端经历 id
    const 项目命令 = 发送前们.find((c) => c.种类 === 'project-create');
    expect(项目命令?.父编号).toBe('exp_srv_1');
    expect(项目命令?.幂等键).toMatch(/^idem-/);

    // 重试：经历身份已映射为服务器 id → 不再 POST 经历；项目用原 key/body 重放
    const previous2: BFF简历 = { ...BFF简历样本, experiences: [经历DTO('exp_srv_1', 1)] };
    const 基页 = 从BFF简历(previous2);
    const next2 = { ...基页, 经历: [{ ...基页.经历[0], 项目: [经历段('exp_local_1').项目![0]] }] };
    const 请求Mock2 = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
      if (选项.method === 'POST' && 选项.path === '/api/v1/me/resume/experiences/exp_srv_1/projects') {
        return {
          result: {
            entry: { kind: 'project', project: { id: 'proj_srv_1', name: 'P1', role: '前端', result: '上线', revision: 1 } },
            aggregate_revision: 3,
          },
          etag: null, requestId: 'r2',
        };
      }
      // 段带新项目即整段变化：经历主体 PATCH 是既有 diff 语义，原样放行
      if (选项.method === 'PATCH' && 选项.path === '/api/v1/me/resume/experiences/exp_srv_1') {
        return { result: previous2, etag: null, requestId: 'r4' };
      }
      if ((选项.method ?? 'GET') === 'GET' && 选项.path === '/api/v1/me/resume') {
        return { result: previous2, etag: null, requestId: 'r3' };
      }
      throw new Error(`未预期的请求 ${选项.method} ${选项.path}`);
    });
    await 创建简历数据源(请求Mock2 as unknown as 请求函数).保存简历(next2, previous2, 跟踪);
    const 重试调用 = 请求Mock2.mock.calls.map((c) => c[0] as BFF请求选项);
    expect(重试调用.filter((o) => o.path === '/api/v1/me/resume/experiences' && o.method === 'POST')).toHaveLength(0);
    const 重试项目 = 重试调用.filter((o) => o.method === 'POST');
    expect(重试项目).toHaveLength(1);
    const 首次项目 = 请求Mock.mock.calls.map((c) => c[0] as BFF请求选项)
      .find((o) => o.path === '/api/v1/me/resume/experiences/exp_srv_1/projects')!;
    expect(重试项目[0].幂等键).toBe(首次项目.幂等键); // 原 key 保持
    expect(重试项目[0].body).toEqual(首次项目.body); // 原 body 保持
  });

  it('POST 回执后最终 GET 失败：回执已交跟踪不丢；按已存身份重算后零 mutation', async () => {
    const previous = { ...BFF简历样本, educations: [] };
    const { 跟踪, 已确认们 } = 跟踪桩();
    const GET错误 = new BFF错误(0, 'network_error', '网络连接失败');
    const 请求Mock = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
      if (选项.method === 'POST' && 选项.path === '/api/v1/me/resume/educations') {
        return {
          result: { entry: { kind: 'education', education: 教育DTO('edu_srv_1', 1) }, aggregate_revision: 7 },
          etag: null, requestId: 'r1',
        };
      }
      if ((选项.method ?? 'GET') === 'GET' && 选项.path === '/api/v1/me/resume') throw GET错误;
      throw new Error(`未预期的请求 ${选项.method} ${选项.path}`);
    });
    const next = { ...从BFF简历(previous), 教育: [教育段('edu_local_1')] };
    await expect(
      创建简历数据源(请求Mock as unknown as 请求函数).保存简历(next, previous, 跟踪),
    ).rejects.toBe(GET错误);
    // GET 失败只影响回读确认，已知创建身份不丢
    expect(已确认们).toHaveLength(1);
    expect(已确认们[0].回执.id).toBe('edu_srv_1');

    // 刷新后：权威 previous 含该条，页面按已存身份映射 → 零 mutation，只有回读 GET
    const previous2: BFF简历 = { ...BFF简历样本, educations: [教育DTO('edu_srv_1', 1)] };
    const 请求Mock2 = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
      if ((选项.method ?? 'GET') === 'GET' && 选项.path === '/api/v1/me/resume') {
        return { result: previous2, etag: null, requestId: 'r2' };
      }
      throw new Error(`未预期的请求 ${选项.method} ${选项.path}`);
    });
    await 创建简历数据源(请求Mock2 as unknown as 请求函数).保存简历(从BFF简历(previous2), previous2, 跟踪);
    const 重试调用 = 请求Mock2.mock.calls.map((c) => c[0] as BFF请求选项);
    expect(重试调用.filter((o) => o.method === 'POST' || o.method === 'PATCH' || o.method === 'DELETE')).toHaveLength(0);
  });

  it('单例分区回执取对应 revision；条目更新回执只认本命令条目', async () => {
    const previous = BFF简历样本;
    const { 跟踪, 已确认们 } = 跟踪桩();
    const 请求Mock = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
      if ((选项.method ?? 'GET') === 'GET') return { result: BFF简历样本, etag: null, requestId: 'r1' };
      // summary / skills / experience PATCH 都回权威 BFF简历
      return { result: BFF简历样本, etag: null, requestId: 'r2' };
    });
    const next = {
      ...从BFF简历(previous),
      个人优势: '新优势',
      技能: ['TypeScript', 'React'],
      经历: [{ ...从BFF简历(previous).经历[0], 内容: '新内容' }],
    };
    await 创建简历数据源(请求Mock as unknown as 请求函数).保存简历(next, previous, 跟踪);
    expect(已确认们[0]).toMatchObject({ 命令: { 种类: 'summary' }, 回执: { revision: 1 } });
    expect(已确认们[1]).toMatchObject({ 命令: { 种类: 'skills' }, 回执: { revision: 3 } });
    expect(已确认们[2]).toMatchObject({
      命令: { 种类: 'experience-update', 资源编号: 'exp_1' },
      回执: { id: 'exp_1', revision: 4, aggregate_revision: BFF简历样本.aggregate_revision },
    });
    // 更新响应缺本命令条目时不得把其它资源的 revision 冒充回执
    const 请求Mock2 = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
      if ((选项.method ?? 'GET') === 'GET') return { result: BFF简历样本, etag: null, requestId: 'r1' };
      return { result: { ...BFF简历样本, experiences: [] }, etag: null, requestId: 'r2' };
    });
    const 跟踪2 = 跟踪桩();
    await 创建简历数据源(请求Mock2 as unknown as 请求函数)
      .保存简历(next, previous, 跟踪2.跟踪);
    const 更新回执 = 跟踪2.已确认们.find((c) => c.命令.种类 === 'experience-update');
    expect(更新回执?.回执).toEqual({});
  });

  it('作品集链接三态：属性缺省不带 portfolio_url；有意编辑触发 profile PATCH 并交 profile 回执', async () => {
    const previous = BFF简历样本;
    // 缺省：普通资料编辑（不带 作品集链接 属性）的 profile body 不含 portfolio_url 键
    const 缺省桩 = 跟踪桩();
    const 缺省Mock = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
      if ((选项.method ?? 'GET') === 'GET') return { result: BFF简历样本, etag: null, requestId: 'r1' };
      return { result: BFF简历样本, etag: null, requestId: 'r2' };
    });
    const 缺省页 = (() => {
      // 普通资料编辑不带该字段：按契约把快照必返的 作品集链接 属性剥掉（存在即视为有意编辑）
      const { 作品集链接: _省略, ...基底 } = 从BFF简历(previous);
      return { ...基底, 基本信息: { ...从BFF简历(previous).基本信息, 真名: '新名字' } };
    })();
    await 创建简历数据源(缺省Mock as unknown as 请求函数).保存简历(缺省页, previous, 缺省桩.跟踪);
    const 缺省PATCH = 缺省Mock.mock.calls.map((c) => c[0] as BFF请求选项)
      .find((o) => o.path === '/api/v1/me/resume/profile')!;
    expect(缺省PATCH.body).not.toHaveProperty('portfolio_url');
    expect(缺省桩.已确认们[0]).toMatchObject({ 命令: { 种类: 'profile' }, 回执: { revision: 2 } });

    // 有意编辑：链接单独变化也触发保留其余字段的 profile PATCH
    const 链接桩 = 跟踪桩();
    const 链接Mock = vi.fn(async (选项: BFF请求选项): Promise<BFF响应<unknown>> => {
      if ((选项.method ?? 'GET') === 'GET') return { result: BFF简历样本, etag: null, requestId: 'r1' };
      return { result: BFF简历样本, etag: null, requestId: 'r2' };
    });
    await 创建简历数据源(链接Mock as unknown as 请求函数).保存简历(
      { ...从BFF简历(previous), 作品集链接: 'https://me.example.com' },
      previous,
      链接桩.跟踪,
    );
    const 链接PATCH = 链接Mock.mock.calls.map((c) => c[0] as BFF请求选项)
      .find((o) => o.path === '/api/v1/me/resume/profile')!;
    expect(链接PATCH).toBeDefined();
    expect((链接PATCH.body as { portfolio_url?: string }).portfolio_url).toBe('https://me.example.com');
    expect(链接PATCH.body).toMatchObject({ real_name: '沈亦舟', status: 'employed' }); // 其余字段仍全量保留
    expect(链接桩.已确认们[0]).toMatchObject({ 命令: { 种类: 'profile' } });
  });
});

// ── J-PILOT-02 fix（Task 10 评审裁决）：教育 diff 不看键序 —— 权威页快照按 转教育
//    的规范键序建对象，注册流草稿的 学校引用/专业引用 是各屏逐次追加的键；整对象
//    JSON.stringify 会把内容未变的条目误判「已变化」，后续每次保存都发一次多余的
//    PATCH /me/resume/educations/{id}（同 id CAS，幂等但无谓）。 ──

describe('简历数据源 · 教育 diff 键序（J-PILOT-02 fix）', () => {
  it('键序不同内容未变：后续保存零教育写入；内容真变化仍照常 PATCH', async () => {
    const previous: BFF简历 = { ...BFF简历样本, educations: [教育DTO('edu_srv_1', 1)] };
    const 基页 = 从BFF简历(previous);
    const 权威页条目 = 基页.教育[0]!;
    // 注册流草稿的键插入序（学校引用/专业引用追加在尾），内容与权威页完全一致
    const 草稿条目: 简历教育段 = {
      编号: 'edu_srv_1',
      学校: '云衢大学',
      学历: '本科',
      专业: '计算机',
      开始: '2020-09',
      结束: '2024-06',
      学校引用: { id: 'inst_1', display_name: '云衢大学' },
      专业引用: { id: 'major_1', display_name: '计算机' },
    };
    // 断言必要性：旧比较（整对象 stringify）确实把这对内容相同的条目判为不同
    expect(JSON.stringify(权威页条目)).not.toBe(JSON.stringify(草稿条目));

    // 内容未变：整次保存零写入，只有收尾的权威 GET
    const 未变 = 请求桩(previous);
    await 创建简历数据源(未变.请求).保存简历({ ...基页, 教育: [草稿条目] }, previous);
    const 未变调用 = 未变.请求Mock.mock.calls.map((c) => [(c[0] as BFF请求选项).method ?? 'GET', (c[0] as BFF请求选项).path]);
    expect(未变调用).toEqual([['GET', '/api/v1/me/resume']]);

    // 内容真变化（毕业时间改了）：仍照常 PATCH 该条目，CAS 挂当前 revision
    const 变化 = 请求桩(previous);
    await 创建简历数据源(变化.请求).保存简历(
      { ...基页, 教育: [{ ...草稿条目, 结束: '2025-06' }] },
      previous,
    );
    const 变化PATCH = 变化.请求Mock.mock.calls.map((c) => c[0] as BFF请求选项)
      .find((o) => o.method === 'PATCH' && o.path === '/api/v1/me/resume/educations/edu_srv_1')!;
    expect(变化PATCH).toBeDefined();
    expect(变化PATCH.body).toEqual({ institution_id: 'inst_1', degree: '本科', major_id: 'major_1', start_month: '2020-09', end_month: '2025-06' });
    expect(变化PATCH.ifMatch).toBe('"1"');
  });
});
