import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BFF简历样本, BFF岗位样本, 页面岗位样本, BFF隐私视图样本, BFF屏蔽回执样本, BFF组织搜索页样本, BFFAgent规则解释中提案样本, BFF发现批次样本 } from '../测试/BFF样本';
import { BFF错误, type BFF请求选项, type BFF响应 } from './HTTP客户端';
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
  // 分页目录查询测试共用的 mock 与依赖：每个用例前重置，新测试用 依赖() 取依赖。
  const 请求Mock = vi.fn();
  const 请求 = 请求Mock as unknown as 请求函数;
  function 依赖() {
    return { client: { 请求, 请求二进制: vi.fn() }, 后端环境: 'stg' as const, 附属存储: 内存附属存储() };
  }
  beforeEach(() => {
    请求Mock.mockReset();
  });
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
    const source = 创建HTTP招聘数据源({ client: { 请求, 请求二进制: vi.fn() }, 后端环境: 'stg', 附属存储: 内存附属存储() });
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
    const source = 创建HTTP招聘数据源({ client: { 请求, 请求二进制: vi.fn() }, 后端环境: 'stg', 附属存储: 内存附属存储() });
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
    const source = 创建HTTP招聘数据源({ client: { 请求, 请求二进制: vi.fn() }, 后端环境: 'stg', 附属存储: 内存附属存储() });
    const 旧页面 = 从BFF简历(BFF简历样本);
    const 新页面 = {
      ...旧页面,
      经历: [...旧页面.经历, {
        编号: 'local-new', 公司: '新公司', 行业: '互联网', 行业引用: { id: 'tax_i', display_name: '互联网' }, 职位: '工程师', 开始: '2022-01', 结束: null, 内容: '', 隐藏: false,
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

  // Task 5：已有经历改行业时，用户在候选选择器里选了新候选（设置 行业引用）；
  // 写入直接用 引用.id PATCH，不再按新显示名反查目录。手输显示名不会改 ID。
  it('已有经历改行业用保存的引用 ID 直接 PATCH，不查目录', async () => {
    const 请求Mock = vi.fn(async (options: BFF请求选项) => {
      if (options.method === 'PATCH' && options.path === '/api/v1/me/resume/experiences/exp_1') {
        return { result: BFF简历样本, etag: null, requestId: 'r-patch' };
      }
      return { result: BFF简历样本, etag: null, requestId: 'r1' };
    });
    const 请求 = 请求Mock as unknown as 请求函数;
    const source = 创建HTTP招聘数据源({ client: { 请求, 请求二进制: vi.fn() }, 后端环境: 'stg', 附属存储: 内存附属存储() });
    const 旧页面 = 从BFF简历(BFF简历样本);
    const 新页面 = { ...旧页面, 经历: 旧页面.经历.map((段) => 段.编号 === 'exp_1' ? { ...段, 行业: '金融', 行业引用: { id: 'fin_1', display_name: '金融' } } : 段) };
    await expect(source.保存简历(新页面, BFF简历样本)).resolves.toBeDefined();
    // 没有任何 /catalog/ 请求
    const 目录请求 = 请求Mock.mock.calls
      .map(([o]) => o as BFF请求选项)
      .find((o) => o.path.includes('/catalog/'));
    expect(目录请求).toBeUndefined();
    const patch = 请求Mock.mock.calls
      .map(([o]) => o as BFF请求选项)
      .find((o) => o.method === 'PATCH' && o.path === '/api/v1/me/resume/experiences/exp_1');
    expect(patch?.body).toMatchObject({ industry_id: 'fin_1' });
  });

  // Task 5：完整但缺候选引用的教育段（手输学校）在构建写入 body 时就抛错，
  // 不会触发任何 /catalog/ 反查请求。
  it('没有候选引用时不按显示名反查', async () => {
    const resume = 从BFF简历(BFF简历样本);
    const previous = BFF简历样本;
    const 请求Mock = vi.fn(async () => ({ result: BFF简历样本, etag: null, requestId: 'r1' }));
    const 请求 = 请求Mock as unknown as 请求函数;
    const source = 创建HTTP招聘数据源({ client: { 请求, 请求二进制: vi.fn() }, 后端环境: 'stg', 附属存储: 内存附属存储() });
    await expect(source.保存简历({ ...resume, 教育: [{ ...resume.教育[0], 学校: '手输学校', 学校引用: undefined }] }, previous))
      .rejects.toThrow('请从候选学校中选择');
    expect(请求).not.toHaveBeenCalledWith(expect.objectContaining({ path: expect.stringContaining('/catalog/') }));
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
    const source = 创建HTTP招聘数据源({ client: { 请求, 请求二进制: vi.fn() }, 后端环境: 'stg', 附属存储: 内存附属存储() });
    const 旧页面 = 从BFF简历(BFF简历样本);
    // previous 服务端只有 edu_1；next 额外两条：一条空白学校（onboarding 刚建）、一条完整新教育
    const 空白教育 = { 编号: 'edu_local_blank', 学校: '', 学历: '本科', 专业: '', 开始: '', 结束: '' };
    const 完整教育 = { 编号: 'edu_local_full', 学校: '复旦大学', 学校引用: { id: 'ins_1', display_name: '复旦大学' }, 学历: '本科', 专业: '计算机科学', 专业引用: { id: 'tax_m', display_name: '计算机科学' }, 开始: '2017-09', 结束: '2021-06' };
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

  // #1：onboarding 选专业后学校+专业已填但 开始 仍空，BFF 要求 start_month 非空会拒。
  // 跳过 start_month 为空的教育段，完整段照常 POST。
  it('开始月份为空的教育段跳过 POST，完整教育段照常 POST', async () => {
    const 新教育服务端 = { id: 'edu_server', institution: { id: 'ins_1', display_name: '复旦大学' }, degree: '本科', major: { id: 'tax_m', display_name: '计算机科学' }, start_month: '2017-09', end_month: '2021-06', revision: 2 };
    const 最终简历: typeof BFF简历样本 = { ...BFF简历样本, educations: [BFF简历样本.educations[0], 新教育服务端] };
    const 请求Mock = vi.fn(async (options: BFF请求选项) => {
      if (options.method === 'POST' && options.path === '/api/v1/me/resume/educations') {
        return { result: { entry: { kind: 'education', education: 新教育服务端 }, aggregate_revision: 10 }, etag: null, requestId: 'r2' };
      }
      return { result: 最终简历, etag: null, requestId: 'r1' };
    });
    const 请求 = 请求Mock as unknown as 请求函数;
    const source = 创建HTTP招聘数据源({ client: { 请求, 请求二进制: vi.fn() }, 后端环境: 'stg', 附属存储: 内存附属存储() });
    const 旧页面 = 从BFF简历(BFF简历样本);
    // 学校+专业已填但开始月份为空（onboarding 选专业后、选时间前的中间态）
    const 空开始教育 = { 编号: 'edu_local_no_start', 学校: '复旦大学', 学历: '本科', 专业: '计算机科学', 开始: '', 结束: '' };
    const 完整教育 = { 编号: 'edu_local_full', 学校: '复旦大学', 学校引用: { id: 'ins_1', display_name: '复旦大学' }, 学历: '本科', 专业: '计算机科学', 专业引用: { id: 'tax_m', display_name: '计算机科学' }, 开始: '2017-09', 结束: '2021-06' };
    const 新页面 = { ...旧页面, 教育: [...旧页面.教育, 空开始教育, 完整教育] };
    const 出 = await source.保存简历(新页面, BFF简历样本);
    // 教育只 POST 一次（空开始段被跳过，完整段才 POST）
    const 教育POST们 = 请求Mock.mock.calls
      .map(([o]) => o as BFF请求选项)
      .filter((o) => o.method === 'POST' && o.path === '/api/v1/me/resume/educations');
    expect(教育POST们).toHaveLength(1);
    // 空开始段保留在返回的页面态里
    expect(出.教育.some((段) => 段.编号 === 'edu_local_no_start')).toBe(true);
  });

  // #3：新建经历 POST 成功但项目 POST 失败时，本地编号已更新为服务端 id；
  // 重试（previous 含新经历）不再重复 POST 经历，项目 POST 到服务端 id。
  it('新建经历 POST 成功但项目 POST 失败时，经历只 POST 一次，重试不重复', async () => {
    const 新经历服务端 = { ...BFF简历样本.experiences[0], id: 'exp_server', projects: [] };
    const 最终简历: typeof BFF简历样本 = { ...BFF简历样本, experiences: [BFF简历样本.experiences[0], 新经历服务端] };
    const 请求Mock = vi.fn(async (options: BFF请求选项) => {
      if (options.method === 'POST' && options.path === '/api/v1/me/resume/experiences') {
        return { result: { entry: { kind: 'experience', experience: 新经历服务端 }, aggregate_revision: 10 }, etag: null, requestId: 'r2' };
      }
      if (options.method === 'POST' && options.path === '/api/v1/me/resume/experiences/exp_server/projects') {
        throw new BFF错误(422, 'validation_failed', 'bad project');
      }
      return { result: 最终简历, etag: null, requestId: 'r1' };
    });
    const 请求 = 请求Mock as unknown as 请求函数;
    const source = 创建HTTP招聘数据源({ client: { 请求, 请求二进制: vi.fn() }, 后端环境: 'stg', 附属存储: 内存附属存储() });
    const 旧页面 = 从BFF简历(BFF简历样本);
    const 新页面 = {
      ...旧页面,
      经历: [...旧页面.经历, {
        编号: 'local-new', 公司: '新公司', 行业: '互联网', 行业引用: { id: 'tax_i', display_name: '互联网' }, 职位: '工程师', 开始: '2022-01', 结束: null, 内容: '', 隐藏: false,
        项目: [{ 编号: 'p-local', 名称: '网关重建', 角色: '负责人', 结果: '降 82%' }],
      }],
    };
    // 第一次保存：经历 POST 成功，项目 POST 失败 → 抛错
    await expect(source.保存简历(新页面, BFF简历样本)).rejects.toMatchObject({ code: 'validation_failed' });
    // 经历只 POST 一次
    const 经历POST们 = 请求Mock.mock.calls
      .map(([o]) => o as BFF请求选项)
      .filter((o) => o.method === 'POST' && o.path === '/api/v1/me/resume/experiences');
    expect(经历POST们).toHaveLength(1);
    // 项目 POST 针对服务端 id
    const 项目POST们 = 请求Mock.mock.calls
      .map(([o]) => o as BFF请求选项)
      .filter((o) => o.method === 'POST' && o.path === '/api/v1/me/resume/experiences/exp_server/projects');
    expect(项目POST们).toHaveLength(1);
    // 本地条目编号已被更新为服务端 id
    expect(新页面.经历[新页面.经历.length - 1].编号).toBe('exp_server');

    // 第二次保存：previous 含新经历（服务端 id），next 条目编号已是服务端 id → 不重复 POST
    const 请求Mock2 = vi.fn(async (options: BFF请求选项) => {
      if (options.method === 'POST' && options.path === '/api/v1/me/resume/experiences') {
        return { result: { entry: { kind: 'experience', experience: 新经历服务端 }, aggregate_revision: 11 }, etag: null, requestId: 'r-dup' };
      }
      if (options.method === 'PATCH' && options.path === '/api/v1/me/resume/experiences/exp_server') {
        return { result: 最终简历, etag: null, requestId: 'r-patch' };
      }
      if (options.method === 'POST' && options.path === '/api/v1/me/resume/experiences/exp_server/projects') {
        return { result: { entry: { kind: 'project', project: { id: 'proj_1', name: '网关重建', role: '负责人', result: '降 82%', revision: 1 } }, aggregate_revision: 12 }, etag: null, requestId: 'r3' };
      }
      return { result: 最终简历, etag: null, requestId: 'r1' };
    });
    const 请求2 = 请求Mock2 as unknown as 请求函数;
    const source2 = 创建HTTP招聘数据源({ client: { 请求: 请求2, 请求二进制: vi.fn() }, 后端环境: 'stg', 附属存储: 内存附属存储() });
    await source2.保存简历(新页面, 最终简历);
    // 经历没有被重复 POST
    const 经历POST2 = 请求Mock2.mock.calls
      .map(([o]) => o as BFF请求选项)
      .filter((o) => o.method === 'POST' && o.path === '/api/v1/me/resume/experiences');
    expect(经历POST2).toHaveLength(0);
    // 项目 POST 到服务端 id
    const 项目POST2 = 请求Mock2.mock.calls
      .map(([o]) => o as BFF请求选项)
      .filter((o) => o.method === 'POST' && o.path === '/api/v1/me/resume/experiences/exp_server/projects');
    expect(项目POST2).toHaveLength(1);
  });

  // Task 1：分页目录查询只请求一页，保留不可选 taxonomy 导航节点（不照旧 读取目录 过滤掉）。
  it('目录查询只请求一页且保留不可选 taxonomy 导航节点', async () => {
    请求Mock.mockResolvedValueOnce({
      result: {
        items: [{ id: 'tax_root', display_name: '技术', parent_id: null, selectable: false }],
        next_cursor: 'next-1', catalog_version: 'v2',
      },
    });
    const source = 创建HTTP招聘数据源(依赖());
    await expect(source.查询Taxonomy('job-categories', { limit: 20 })).resolves.toEqual({
      items: [{ id: 'tax_root', display_name: '技术', parent_id: null, selectable: false }],
      nextCursor: 'next-1', catalogVersion: 'v2',
    });
    expect(请求Mock).toHaveBeenCalledTimes(1);
  });

  // Task 1：同 key in-flight 去重，只发一次请求；清空目录缓存后再查会重新请求。
  it('相同 in-flight 查询去重，清缓存后重新请求', async () => {
    let resolve!: (value: unknown) => void;
    请求Mock.mockReturnValue(new Promise((r) => { resolve = r; }));
    const source = 创建HTTP招聘数据源(依赖());
    const a = source.查询Location({ countryCode: 'CN', admin1Code: '31', limit: 20 });
    const b = source.查询Location({ countryCode: 'CN', admin1Code: '31', limit: 20 });
    expect(请求Mock).toHaveBeenCalledTimes(1);
    resolve({ result: { items: [], next_cursor: null, catalog_version: 'v2' } });
    await Promise.all([a, b]);
    source.清空目录缓存();
    await source.查询Location({ countryCode: 'CN', admin1Code: '31', limit: 20 });
    expect(请求Mock).toHaveBeenCalledTimes(2);
  });

  // Task 1：院校结果的嵌套 location 原样保留，映射层不抹平嵌套字段。
  it('院校结果保留嵌套地点', async () => {
    请求Mock.mockResolvedValueOnce({ result: { items: [{
      id: 'ins_1', display_name: '复旦大学',
      location: { id: 'loc_1', display_name: '上海市', country_code: 'CN', country_name: '中国', admin1_code: '31', admin1_name: '上海市', timezone: 'Asia/Shanghai', population: 0 },
    }], next_cursor: null, catalog_version: 'v2' } });
    const page = await 创建HTTP招聘数据源(依赖()).查询Institution({ q: '复旦', limit: 20 });
    expect(page.items[0].location).toMatchObject({ display_name: '上海市', country_name: '中国' });
  });

  // Task 2：读取意向 带 status=active 过滤，只拉活跃意向；创建/更新/删除 后 re-GET 也走同一 path。
  it('读取意向 请求路径带 status=active', async () => {
    请求Mock.mockResolvedValue({ result: { intentions: [] }, etag: null, requestId: 'r1' });
    const source = 创建HTTP招聘数据源(依赖());
    await source.读取意向();
    const 意向请求 = 请求Mock.mock.calls
      .map(([o]) => o as BFF请求选项)
      .find((o) => o.path.startsWith('/api/v1/me/intentions'));
    expect(意向请求?.path).toBe('/api/v1/me/intentions?status=active');
  });

  // Task 6：创建意向 body 用草稿里的引用 ID，不再按显示名反查目录（无 /catalog/ 请求）。
  it('创建意向 body 用引用 ID，不请求 /catalog/', async () => {
    请求Mock.mockResolvedValue({ result: { intentions: [] }, etag: null, requestId: 'r1' });
    const source = 创建HTTP招聘数据源(依赖());
    const 草稿 = {
      编辑编号: null, 求职类型: '全职' as const, 工作城市: '上海市', 期望职位: '产品经理',
      工作城市引用: { id: 'loc_sh', display_name: '上海市' },
      职位引用: { id: 'tax_pm', display_name: '产品经理' },
      感兴趣城市们: [] as string[],
      感兴趣城市引用们: [{ id: 'loc_hz', display_name: '杭州市' }],
      薪资下限: 20, 薪资上限: 30,
      期望行业们: [] as string[],
      行业引用们: [{ id: 'tax_it', display_name: '互联网' }],
      办公方式: ['hybrid'],
      后端招聘类型: null, 求职类型已改: false,
    };
    await source.创建意向(草稿, { 原始: null });
    const post = 请求Mock.mock.calls
      .map(([o]) => o as BFF请求选项)
      .find((o) => o.method === 'POST' && o.path === '/api/v1/me/intentions');
    expect(post?.body).toMatchObject({
      job_category_id: 'tax_pm', primary_location_id: 'loc_sh',
      alternate_location_ids: ['loc_hz'], industry_ids: ['tax_it'], workplace_modes: ['hybrid'],
    });
    // 上面 toMatchObject 已断言 post 存在；这里再取 body 前 guard 一次，避免
    // no-unsafe-optional-chaining：post?.body 短路成 undefined 时 `.compensation` 会抛。
    const body = post?.body as { compensation: unknown } | undefined;
    expect(body?.compensation).toEqual({ mode: 'range', lower: 20, upper: 30 });
    // 没有任何 /catalog/ 请求
    const 目录请求 = 请求Mock.mock.calls
      .map(([o]) => o as BFF请求选项)
      .find((o) => o.path.includes('/catalog/'));
    expect(目录请求).toBeUndefined();
  });

  // Task 6：创建首次意向 body 用引用 ID，不请求 /catalog/。
  it('创建首次意向 body 用引用 ID，不请求 /catalog/', async () => {
    请求Mock.mockResolvedValue({ result: { intentions: [] }, etag: null, requestId: 'r1' });
    const source = 创建HTTP招聘数据源(依赖());
    const 输入 = {
      职位们: ['产品经理'],
      城市们: ['上海市', '杭州市'],
      薪资: { 下限: 10, 上限: 20, 单位: '月薪K' as const },
      筛选偏好: { 求职类型: ['社招全职'] as ['社招全职'], 办公方式: ['混合'] as ['混合'] },
      排除项: [],
      职位引用: { id: 'tax_pm', display_name: '产品经理' },
      城市引用们: [
        { id: 'loc_sh', display_name: '上海市' },
        { id: 'loc_hz', display_name: '杭州市' },
      ],
    };
    await source.创建首次意向(输入);
    const post = 请求Mock.mock.calls
      .map(([o]) => o as BFF请求选项)
      .find((o) => o.method === 'POST' && o.path === '/api/v1/me/intentions');
    expect(post?.body).toMatchObject({
      job_category_id: 'tax_pm', primary_location_id: 'loc_sh',
      alternate_location_ids: ['loc_hz'], workplace_modes: ['hybrid'],
    });
    const 目录请求 = 请求Mock.mock.calls
      .map(([o]) => o as BFF请求选项)
      .find((o) => o.path.includes('/catalog/'));
    expect(目录请求).toBeUndefined();
  });

  // Task 7：创建岗位 body 用 类别引用/地点引用 的 ID，不再按显示名反查目录（无 /catalog/ 请求）。
  // P1C Task 5：上下文改为显式 岗位创建上下文（direct + claim）。
  it('创建岗位 body 用引用 ID，不请求 /catalog/', async () => {
    // POST /recruiter/jobs 返回单个 job；后续 读取岗位 GET 返回 jobs 页
    请求Mock.mockImplementation(async (options: BFF请求选项) => {
      if (options.method === 'POST' && options.path === '/api/v1/recruiter/jobs') {
        return { result: BFF岗位样本, etag: null, requestId: 'r-post' };
      }
      return { result: { jobs: [BFF岗位样本], next_cursor: null }, etag: null, requestId: 'r-list' };
    });
    const source = 创建HTTP招聘数据源(依赖());
    const job = {
      ...页面岗位样本,
      类别引用: { id: 'tax_pm', display_name: '产品经理' },
      地点引用: { id: 'loc_sh', display_name: '上海市' },
    };
    await source.创建岗位(job, {
      publisherMode: 'direct',
      hiringOrganizationClaim: { display_name: '甲公司', legal_name: null },
    });
    const post = 请求Mock.mock.calls
      .map(([o]) => o as BFF请求选项)
      .find((o) => o.method === 'POST' && o.path === '/api/v1/recruiter/jobs');
    expect(post?.body).toMatchObject({
      category_id: 'tax_pm', location_id: 'loc_sh',
      publisher_mode: 'direct', hiring_organization_claim: { display_name: '甲公司', legal_name: null },
    });
    // 没有任何 /catalog/ 请求
    const 目录请求 = 请求Mock.mock.calls
      .map(([o]) => o as BFF请求选项)
      .find((o) => o.path.includes('/catalog/'));
    expect(目录请求).toBeUndefined();
  });

  // P1C Task 5：创建/更新 的实际 JSON 不携带服务端专有 refs 与 verification status；
  // 更新不接公司 context，只吃 previous owner DTO（补丁沿用 previous claim/mode）。
  it('创建与更新的 JSON 无 organization refs / verification status，更新只吃 previous', async () => {
    请求Mock.mockImplementation(async (options: BFF请求选项) => {
      if (options.method === 'POST' || options.method === 'PATCH') {
        return { result: BFF岗位样本, etag: null, requestId: 'r-write' };
      }
      return { result: { jobs: [BFF岗位样本], next_cursor: null }, etag: null, requestId: 'r-list' };
    });
    const source = 创建HTTP招聘数据源(依赖());
    const job = {
      ...页面岗位样本,
      类别引用: { id: 'tax_pm', display_name: '产品经理' },
      地点引用: { id: 'loc_sh', display_name: '上海市' },
    };
    await source.创建岗位(job, {
      publisherMode: 'direct',
      hiringOrganizationClaim: { display_name: '甲公司', legal_name: null },
    });
    await source.更新岗位(job, BFF岗位样本);
    const 写入们 = 请求Mock.mock.calls
      .map(([o]) => o as BFF请求选项)
      .filter((o) => o.method === 'POST' || o.method === 'PATCH');
    expect(写入们).toHaveLength(2);
    for (const 写入 of 写入们) {
      expect(JSON.stringify(写入.body))
        .not.toMatch(/publisher_affiliation_ref|publisher_organization_ref|hiring_organization_ref|verification_status/);
    }
  });

  // Task 1（P6）：第八个域 facade（Agent 规则）组合进根 facade，公开方法一个不丢。
  // Task 1（P4）：第九个域 facade（发现推荐）组合进根 facade；watch / 候选撤销 /
  // 委托列表 / top 选择仍不进入浏览器 facade。
  // Task 2（P2）：第十个域 facade（附件简历）一并组合进根 facade。
  // Task 1（P5）：第十一个域 facade（MatchCase）一并组合进根 facade。
  // Task 1（P7）：第十二个域 facade（真人会话）一并组合进根 facade。
  it('根 facade 组合十二个域且不丢公开方法', () => {
    const source = 创建HTTP招聘数据源(依赖());
    expect(Object.keys(source).sort()).toEqual([
      '保存简历', '保存招聘方档案', '创建岗位', '创建意向', '创建首次意向', '创建企业管理员申请',
      '删除岗位', '删除意向', '删除企业媒体', '开始微信登录', '开始手机登录', '归档岗位',
      '恢复会话', '更新岗位', '更新意向', '上传企业媒体', '查询Institution', '查询Location',
      '查询Taxonomy', '清空目录缓存', '确保角色', '取消企业管理员申请', '读取主体', '读取岗位',
      '读取意向', '读取简历', '读取招聘方档案', '读取我的企业关系', '读取公开企业', '读取企业档案',
      '读取企业管理员申请', '记录当前角色', '接受企业邀请', '替换招聘方头像', '替换企业档案',
      '退出登录', '完成手机登录', '重开岗位',
      // P3：隐私域 + 组织搜索
      '修改隐私', '解除组织屏蔽', '读取隐私', '添加组织屏蔽', '搜索组织',
      // P6：Agent 规则与提案域
      '读取Agent规则', '读取单条Agent规则', '修改Agent规则', '删除Agent规则',
      '创建Agent规则提案', '读取Agent规则提案', '读取Agent规则提案列表',
      '接受Agent规则提案', '放弃Agent规则提案', '创建Agent规则替换提案',
      // P4：发现推荐域
      '读取候选岗位推荐', '读取候选岗位详情', '刷新候选岗位推荐', '标记候选岗位不感兴趣',
      '创建候选岗位委托', '读取候选岗位委托',
      '读取招聘候选', '读取招聘候选详情', '刷新招聘候选', '设置招聘候选收藏',
      '设置招聘候选淘汰', '撤销招聘候选淘汰', '创建招聘候选委托', '读取招聘候选委托',
      // P2：附件简历域
      '读取附件简历库', '创建附件简历', '替换附件简历',
      '删除附件简历', '请求附件解析', '下载附件简历',
      // P5：MatchCase 域
      '读取P5Open列表', '读取P5历史', '读取P5详情', '回答P5事实', '提交P5简历',
      '决定P5S0', '决定P5S1', '决定P5S2', '决定P5S3', '新增P5叮嘱', '读取P5简历PDF',
      // P7：真人会话域
      '读取会话列表', '读取会话', '读取消息', '发送消息', '标为已读',
    ].sort());
    // P1C Task 5 / P4 边界：不为尚不可达的 candidate Job route 增加浏览器 consumer。
    expect(Object.keys(source)).not.toContain('读取公开岗位');
    expect(Object.keys(source)).not.toContain('公开岗位表');
    // P4 非目标：watch、候选撤销、委托列表读取与 top 选择不存在于 facade。
    expect(Object.keys(source)).not.toContain('创建候选岗位watch');
    expect(Object.keys(source)).not.toContain('撤销候选岗位不感兴趣');
    expect(Object.keys(source)).not.toContain('读取候选岗位委托列表');
  });

  // P3：隐私与组织搜索经根 facade 走到线上；CandidateJob 只留编译期闭类型，无请求方法。
  it('根 facade 提供隐私读写与组织搜索并按契约发请求', async () => {
    请求Mock.mockImplementation(async (options: BFF请求选项) => {
      if (options.method === 'POST' && options.path === '/api/v1/me/privacy/organization-blocks') {
        return { result: BFF屏蔽回执样本, etag: '"3"', requestId: 'r-block' };
      }
      if (options.path === '/api/v1/organizations?q=Acme&limit=20') {
        return { result: BFF组织搜索页样本, etag: null, requestId: 'r-search' };
      }
      return { result: BFF隐私视图样本, etag: '"2"', requestId: 'r-view' };
    });
    const source = 创建HTTP招聘数据源(依赖());
    await source.读取隐私();
    await expect(source.修改隐私({ disclosure_preferences: { education: 'resume_submission' } }, 2)).resolves.toBeDefined();
    await expect(source.添加组织屏蔽('org_1', 'related_organization', 2)).resolves.toEqual(BFF屏蔽回执样本);
    await expect(source.搜索组织({ q: 'Acme', limit: 20 })).resolves.toMatchObject({ items: [{ organization_id: 'org_1' }] });
    expect(请求Mock.mock.calls.map(([o]) => [o.method ?? 'GET', o.path])).toEqual([
      ['GET', '/api/v1/me/privacy'],
      ['PATCH', '/api/v1/me/privacy'],
      ['POST', '/api/v1/me/privacy/organization-blocks'],
      ['GET', '/api/v1/organizations?q=Acme&limit=20'],
    ]);
    // 幂等键只落在 AddBlock 上
    const post = 请求Mock.mock.calls
      .map(([o]) => o as BFF请求选项)
      .find((o) => o.method === 'POST')!;
    expect(post.幂等).toBe(true);
    expect(Object.keys(source)).not.toContain('读取候选岗位');
  });

  // Task 1（P6）：组合后的 Agent 规则方法直接走冻结的 agent-rule-proposals 路径并解码。
  it('根 facade 组合后可发起候选人 Agent 规则提案创建', async () => {
    请求Mock.mockResolvedValueOnce({ result: BFFAgent规则解释中提案样本, etag: null, requestId: 'p6' });
    const source = 创建HTTP招聘数据源(依赖());
    await expect(source.创建Agent规则提案('candidate', '大小周不谈', { type: 'global' }))
      .resolves.toEqual(BFFAgent规则解释中提案样本);
    expect(请求Mock.mock.calls[0][0]).toMatchObject({
      path: '/api/v1/me/agent-rule-proposals', method: 'POST', 幂等: true,
    });
  });

  // Task 1（P4）：组合后的发现推荐方法直接走冻结的 refresh 路径，带调用方幂等键并解码批次。
  it('根 facade 组合后可刷新候选岗位推荐并冻结调用方幂等键', async () => {
    请求Mock.mockResolvedValueOnce({ result: BFF发现批次样本, etag: null, requestId: 'p4' });
    const source = 创建HTTP招聘数据源(依赖());
    await expect(source.刷新候选岗位推荐('int_1', 'candidate-refresh-key')).resolves.toEqual(BFF发现批次样本);
    expect(请求Mock.mock.calls[0][0]).toMatchObject({
      path: '/api/v1/me/job-recommendation-refreshes', method: 'POST',
      body: { intention_id: 'int_1' }, 幂等: true, 幂等键: 'candidate-refresh-key',
    });
  });

  // Task 1（P5）：组合后的 MatchCase open 列表直接走冻结的双端前缀 + 固定 limit=50，GET 显式 no-store。
  it('根 facade 组合后 P5 open 列表走 no-store 双端前缀', async () => {
    请求Mock.mockResolvedValueOnce({ result: { items: [], next_cursor: null }, etag: null, requestId: 'p5' });
    const source = 创建HTTP招聘数据源(依赖());
    await expect(source.读取P5Open列表('candidate', null, null)).resolves.toEqual({
      role: 'candidate', items: [], nextCursor: null,
    });
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/me/match-cases?limit=50', 不缓存: true,
    });
  });

  // Task 1（P7）：组合后的真人会话列表走双端前缀，GET 显式 no-store，role 只决定前缀。
  it('根 facade 组合后 P7 会话列表走 no-store 双端前缀', async () => {
    请求Mock.mockResolvedValueOnce({ result: { items: [], next_cursor: null }, etag: null, requestId: 'p7' });
    const source = 创建HTTP招聘数据源(依赖());
    await expect(source.读取会话列表('recruiter')).resolves.toEqual({
      items: [], nextCursor: null,
    });
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/recruiter/conversations', 不缓存: true,
    });
  });
});