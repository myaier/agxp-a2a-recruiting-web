import { expect, it } from 'vitest';
import { 创建岗位附属存储 } from './前端附属数据';

it('按环境和真实岗位 ID 隔离附属字段', () => {
  const storage = new Map<string, string>();
  const store = 创建岗位附属存储({ getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) });
  store.写入('stg', 'job_1', { 加分关键词: ['课程项目'], 实习转正: true });
  expect(store.读取('stg', 'job_1')).toEqual({ 加分关键词: ['课程项目'], 实习转正: true });
  expect(store.读取('local', 'job_1')).toEqual({});
});