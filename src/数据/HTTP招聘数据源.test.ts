import { describe, expect, it, vi } from 'vitest';
import { BFF简历样本 } from '../测试/BFF样本';
import type { BFF请求选项, BFF响应 } from './HTTP客户端';
import { 从BFF简历 } from './后端映射';
import { 创建岗位附属存储 } from './前端附属数据';
import { 创建HTTP招聘数据源 } from './HTTP招聘数据源';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

function 内存附属存储() {
  const values = new Map<string, string>();
  return 创建岗位附属存储({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
}

describe('HTTP 招聘数据源', () => {
  it('手机登录使用 +86 E.164 和两次独立幂等操作', async () => {
    const 请求Mock = vi.fn(async (options: BFF请求选项) => {
      if (options.path === '/api/v1/auth/login-attempts') {
        return { result: { attempt_id: 'att_1', next_action: { type: 'enter_code' } }, etag: null, requestId: 'r1' };
      }
      return {
        result: { identity_id: 'id_1', session_id: 'sess_1', expires_at: '2026-08-25T00:00:00Z', next_action: { type: 'completed' } },
        etag: null,
        requestId: 'r2',
      };
    });
    const 请求 = 请求Mock as unknown as 请求函数;
    const source = 创建HTTP招聘数据源({ client: { 请求 }, 后端环境: 'stg', 附属存储: 内存附属存储() });
    const attempt = await source.开始手机登录('13800000000');
    await source.完成手机登录(attempt.attempt_id, '1234');
    expect(请求Mock.mock.calls.map(([options]) => options)).toMatchObject([
      { path: '/api/v1/auth/login-attempts', method: 'POST', body: { provider: 'phone_otp', input: { phone: '+8613800000000' } }, 幂等: true },
      { path: `/api/v1/auth/login-attempts/${attempt.attempt_id}/complete`, method: 'POST', body: { proof: { code: '1234' } }, 幂等: true },
    ]);
  });

  it('保存简历按快照 diff 写 singleton/entries 后重新 GET', async () => {
    const 请求Mock = vi.fn(async (options: BFF请求选项) => {
      if (options.method === 'POST') {
        return { result: { entry: { kind: 'experience', experience: BFF简历样本.experiences[0] }, aggregate_revision: 10 }, etag: null, requestId: 'r2' };
      }
      return { result: BFF简历样本, etag: '"4"', requestId: 'r1' };
    });
    const 请求 = 请求Mock as unknown as 请求函数;
    const source = 创建HTTP招聘数据源({ client: { 请求 }, 后端环境: 'stg', 附属存储: 内存附属存储() });
    const 旧页面 = 从BFF简历(BFF简历样本);
    const 新页面 = {
      ...旧页面,
      基本信息: { ...旧页面.基本信息, 真名: '新名字' },
      技能: [...旧页面.技能, 'React'],
      经历: [...旧页面.经历, { ...旧页面.经历[0], 编号: 'local-new', 公司: '新公司' }],
    };
    await source.保存简历(新页面, BFF简历样本);
    expect(请求Mock.mock.calls.map(([options]) => [options.method ?? 'GET', options.path, options.ifMatch ?? null])).toEqual([
      ['PATCH', '/api/v1/me/resume/profile', '"2"'],
      ['PATCH', '/api/v1/me/resume/skills', '"3"'],
      ['POST', '/api/v1/me/resume/experiences', null],
      ['GET', '/api/v1/me/resume', null],
    ]);
  });

  // F7：新建一段经历且带项目时，POST 经历拿到服务端 id 后要再 POST 它的项目，
  // 否则最终 GET /me/resume 用服务端权威替换本地、用户刚填的项目全丢。
  it('新建带项目的经历会 POST 经历后再 POST 项目到新经历下', async () => {
    const 新经历服务端 = { ...BFF简历样本.experiences[0], id: 'exp_server', projects: [] };
    const 项目回执 = { entry: { kind: 'project' as const, project: { id: 'proj_1', name: '网关重建', role: '负责人', result: '降 82%', revision: 1 } }, aggregate_revision: 11 };
    const 最终简历: typeof BFF简历样本 = { ...BFF简历样本, experiences: [新经历服务端] };
    const 请求Mock = vi.fn(async (options: BFF请求选项) => {
      if (options.method === 'POST' && options.path === '/api/v1/me/resume/experiences') {
        return { result: { entry: { kind: 'experience', experience: 新经历服务端 }, aggregate_revision: 10 }, etag: null, requestId: 'r2' };
      }
      if (options.method === 'POST' && options.path === '/api/v1/me/resume/experiences/exp_server/projects') {
        return { result: 项目回执, etag: null, requestId: 'r3' };
      }
      return { result: 最终简历, etag: null, requestId: 'r1' };
    });
    const 请求 = 请求Mock as unknown as 请求函数;
    const source = 创建HTTP招聘数据源({ client: { 请求 }, 后端环境: 'stg', 附属存储: 内存附属存储() });
    const 旧页面 = 从BFF简历(BFF简历样本);
    const 新页面 = {
      ...旧页面,
      经历: [...旧页面.经历, {
        编号: 'local-new', 公司: '新公司', 行业: '互联网', 职位: '工程师', 开始: '2022-01', 结束: null, 内容: '', 隐藏: false,
        项目: [{ 编号: 'p-local', 名称: '网关重建', 角色: '负责人', 结果: '降 82%' }],
      }],
    };
    await source.保存简历(新页面, BFF简历样本);
    const 调用 = 请求Mock.mock.calls.map(([options]) => [options.method ?? 'GET', options.path]);
    expect(调用).toContainEqual(['POST', '/api/v1/me/resume/experiences']);
    expect(调用).toContainEqual(['POST', '/api/v1/me/resume/experiences/exp_server/projects']);
    const 项目POST = 请求Mock.mock.calls
      .map(([options]) => options as BFF请求选项)
      .find((o) => o.method === 'POST' && o.path === '/api/v1/me/resume/experiences/exp_server/projects');
    expect(项目POST?.body).toMatchObject({ name: '网关重建', role: '负责人', result: '降 82%' });
    // 最终仍 GET 权威快照
    expect(调用[调用.length - 1]).toEqual(['GET', '/api/v1/me/resume']);
  });

  // F8：已有经历的 行业 显示名改成 previous 快照里没有的新名时，
  // 目录解析仍要跑（?q= 搜索补进目录），否则 转经历写入 的 精确目录ID 找不到新名而抛错。
  it('已有经历改行业显示名为新名时仍解析目录并 PATCH 新 industry_id', async () => {
    const 请求Mock = vi.fn(async (options: BFF请求选项) => {
      const path = options.path;
      if (path.startsWith('/api/v1/catalog/industries') && path.includes('q=')) {
        return { result: { items: [{ id: 'fin_1', display_name: '金融', selectable: true }], next_cursor: null, catalog_version: 'v1' }, etag: null, requestId: 'r-q' };
      }
      if (options.method === 'PATCH' && path === '/api/v1/me/resume/experiences/exp_1') {
        return { result: BFF简历样本, etag: null, requestId: 'r-patch' };
      }
      return { result: BFF简历样本, etag: null, requestId: 'r1' };
    });
    const 请求 = 请求Mock as unknown as 请求函数;
    const source = 创建HTTP招聘数据源({ client: { 请求 }, 后端环境: 'stg', 附属存储: 内存附属存储() });
    const 旧页面 = 从BFF简历(BFF简历样本);
    const 新页面 = { ...旧页面, 经历: 旧页面.经历.map((段) => 段.编号 === 'exp_1' ? { ...段, 行业: '金融' } : 段) };
    await expect(source.保存简历(新页面, BFF简历样本)).resolves.toBeDefined();
    const 目录搜索 = 请求Mock.mock.calls
      .map(([o]) => o as BFF请求选项)
      .find((o) => o.path.startsWith('/api/v1/catalog/industries') && o.path.includes('q='));
    expect(目录搜索).toBeDefined();
    const patch = 请求Mock.mock.calls
      .map(([o]) => o as BFF请求选项)
      .find((o) => o.method === 'PATCH' && o.path === '/api/v1/me/resume/experiences/exp_1');
    expect(patch?.body).toMatchObject({ industry_id: 'fin_1' });
  });

  // F5：onboarding 中间屏会建一条 学校/专业 空白的教育段，BFF 写入需要目录精确 ID
  // 会抛错阻塞流程。空白条目跳过服务端写入，保留在返回的页面态里；完整条目照常 POST。
  it('空白学校的教育段跳过 POST，完整教育段照常 POST，且空白段保留在返回快照里', async () => {
    const 新教育服务端 = { id: 'edu_server', institution: { id: 'ins_1', display_name: '复旦大学' }, degree: '本科', major: { id: 'tax_m', display_name: '计算机科学' }, start_month: '2017-09', end_month: '2021-06', revision: 2 };
    const 最终简历: typeof BFF简历样本 = { ...BFF简历样本, educations: [新教育服务端] };
    const 请求Mock = vi.fn(async (options: BFF请求选项) => {
      if (options.method === 'POST' && options.path === '/api/v1/me/resume/educations') {
        return { result: { entry: { kind: 'education', education: 新教育服务端 }, aggregate_revision: 10 }, etag: null, requestId: 'r2' };
      }
      return { result: 最终简历, etag: null, requestId: 'r1' };
    });
    const 请求 = 请求Mock as unknown as 请求函数;
    const source = 创建HTTP招聘数据源({ client: { 请求 }, 后端环境: 'stg', 附属存储: 内存附属存储() });
    const 旧页面 = 从BFF简历(BFF简历样本);
    // previous 服务端只有 edu_1；next 额外两条：一条空白学校（onboarding 刚建）、一条完整新教育
    const 空白教育 = { 编号: 'edu_local_blank', 学校: '', 学历: '本科', 专业: '', 开始: '', 结束: '' };
    const 完整教育 = { 编号: 'edu_local_full', 学校: '复旦大学', 学历: '本科', 专业: '计算机科学', 开始: '2017-09', 结束: '2021-06' };
    const 新页面 = { ...旧页面, 教育: [...旧页面.教育, 空白教育, 完整教育] };
    const 出 = await source.保存简历(新页面, BFF简历样本);
    const 调用 = 请求Mock.mock.calls.map(([o]) => [o.method ?? 'GET', o.path]);
    // 教育只 POST 一次（空白段被跳过，完整段才 POST）
    const 教育POST们 = 请求Mock.mock.calls
      .map(([o]) => o as BFF请求选项)
      .filter((o) => o.method === 'POST' && o.path === '/api/v1/me/resume/educations');
    expect(教育POST们).toHaveLength(1);
    expect(教育POST们[0].body).toMatchObject({ institution_id: 'ins_1', major_id: 'tax_m' });
    // 空白段保留在返回的页面态里，后续屏才能往里补字段
    expect(出.教育.some((段) => 段.编号 === 'edu_local_blank')).toBe(true);
    // 最终 GET 仍跑
    expect(调用[调用.length - 1]).toEqual(['GET', '/api/v1/me/resume']);
  });
});