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
});