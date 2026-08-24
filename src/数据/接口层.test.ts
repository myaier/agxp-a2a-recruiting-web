import { describe, expect, it, vi } from 'vitest';
import { 创建招聘数据源 } from './接口层';
import { BFF错误 } from './HTTP客户端';
import type { HTTP招聘数据源 } from './HTTP招聘数据源';

describe('招聘数据源选择', () => {
  it('缺省只选择 Mock，且不构造 HTTP 数据源', () => {
    const 创建HTTP = vi.fn();
    expect(创建招聘数据源({ 数据源: 'mock', 后端环境: 'stg' }, { 创建HTTP })).toEqual({ 模式: 'mock' });
    expect(创建HTTP).not.toHaveBeenCalled();
  });

  it('Backend 失败直接向上抛出，不返回模拟数据', async () => {
    const 读取岗位 = vi.fn().mockRejectedValue(new BFF错误(503, 'recruitment_service_unavailable', 'down'));
    const 后端 = { 读取岗位 } as unknown as HTTP招聘数据源;
    const source = 创建招聘数据源({ 数据源: 'backend', 后端环境: 'stg' }, { 创建HTTP: () => 后端 });
    if (source.模式 !== 'backend') throw new Error('测试配置必须选择 backend');
    await expect(source.后端.读取岗位()).rejects.toMatchObject({ code: 'recruitment_service_unavailable' });
    expect(读取岗位).toHaveBeenCalledTimes(1);
  });
});