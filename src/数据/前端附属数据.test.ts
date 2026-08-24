import { expect, it, vi } from 'vitest';
import { 创建岗位附属存储 } from './前端附属数据';

it('按环境和真实岗位 ID 隔离附属字段', () => {
  const storage = new Map<string, string>();
  const store = 创建岗位附属存储({ getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) });
  store.写入('stg', 'job_1', { 加分关键词: ['课程项目'], 实习转正: true });
  expect(store.读取('stg', 'job_1')).toEqual({ 加分关键词: ['课程项目'], 实习转正: true });
  expect(store.读取('local', 'job_1')).toEqual({});
});

// F10：localStorage 被禁用/超限时 getItem/setItem/removeItem 会抛错，
// 附属数据是非权威的，绝不能让读打断岗位水合、也不能让写把成功的服务端变更报成失败。
it('storage 各方法抛错时 读取返回 {}，写入/删除 吞掉异常不抛', () => {
  const 抛错storage = {
    getItem: vi.fn(() => { throw new Error('SecurityError: blocked'); }),
    setItem: vi.fn(() => { throw new Error('QuotaExceededError'); }),
    removeItem: vi.fn(() => { throw new Error('blocked'); }),
  };
  const store = 创建岗位附属存储(抛错storage);
  expect(store.读取('stg', 'job_1')).toEqual({});
  expect(() => store.写入('stg', 'job_1', { 加分关键词: ['x'] })).not.toThrow();
  expect(() => store.删除('stg', 'job_1')).not.toThrow();
  expect(抛错storage.getItem).toHaveBeenCalled();
  expect(抛错storage.setItem).toHaveBeenCalled();
  expect(抛错storage.removeItem).toHaveBeenCalled();
});

it('读取 getItem 返回值但 JSON.parse 抛错时仍返回 {}', () => {
  const store = 创建岗位附属存储({
    getItem: () => 'not-json{',
    setItem: () => {},
    removeItem: () => {},
  });
  expect(store.读取('stg', 'job_1')).toEqual({});
});