import { describe, expect, it } from 'vitest';
import { 解析运行配置, 取代理描述, 断言运行场景 } from './运行配置';

describe('运行配置', () => {
  it('缺省为 mock + stg', () => {
    expect(解析运行配置({})).toEqual({ 数据源: 'mock', 后端环境: 'stg' });
  });

  // 注：参数不在标题里（两条 Case 同名，清单身份重复），补 %s 标签
  //（2026-09-16 清单验证发现，只改标题形式，断言不变）。
  it.each([
    ['local', { VITE_DATA_SOURCE: 'backend', VITE_BACKEND_ENV: 'local' }, 'http://127.0.0.1:8097', null],
    ['stg', { VITE_DATA_SOURCE: 'backend', VITE_BACKEND_ENV: 'stg' }, 'https://recruitment-stg.agxp.ai', 'https://recruitment-stg.agxp.ai'],
  ] as const)('为 Backend dev 返回代理描述（%s）', (_标签, env, target, origin) => {
    expect(取代理描述(解析运行配置(env))).toEqual({ target, 改写Origin: origin });
  });

  it('Mock 不配置代理', () => {
    expect(取代理描述(解析运行配置({ VITE_BACKEND_ENV: 'local' }))).toBeNull();
  });

  it.each([
    ['VITE_DATA_SOURCE', { VITE_DATA_SOURCE: 'fixture' }, 'VITE_DATA_SOURCE'],
    ['VITE_BACKEND_ENV', { VITE_BACKEND_ENV: 'prod' }, 'VITE_BACKEND_ENV'],
  ] as const)('拒绝未知枚举值（%s）', (_标签, env, key) => {
    expect(() => 解析运行配置(env)).toThrow(key);
  });

  it('拒绝 production build 显式启用 backend', () => {
    expect(() => 断言运行场景(解析运行配置({ VITE_DATA_SOURCE: 'backend' }), 'build'))
      .toThrow('Backend 数据源只支持 Vite dev');
  });
});