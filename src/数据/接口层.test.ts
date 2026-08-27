import { describe, expect, it, vi } from 'vitest';
import { 创建招聘数据源 } from './接口层';
import { BFF错误 } from './HTTP客户端';
import type { HTTP招聘数据源 } from './HTTP招聘数据源';

// 捕获默认 backend 工厂（创建HTTP招聘数据源）收到的 deps：P2 起 client 必须同时
// 具备 请求 与 请求二进制（附件简历域的二进制下载走后者）。
const 捕获 = vi.hoisted(() => ({ 后端工厂依赖: null as unknown }));

vi.mock('./HTTP招聘数据源', async (importOriginal) => {
  const 实际 = await importOriginal<typeof import('./HTTP招聘数据源')>();
  const 捕获工厂: typeof 实际.创建HTTP招聘数据源 = (deps) => {
    捕获.后端工厂依赖 = deps;
    return null as unknown as ReturnType<typeof 实际.创建HTTP招聘数据源>;
  };
  return { ...实际, 创建HTTP招聘数据源: 捕获工厂 };
});

describe('招聘数据源选择', () => {
  it('缺省只选择 Mock，且不构造 HTTP 数据源', () => {
    const 创建HTTP = vi.fn();
    expect(创建招聘数据源({ 数据源: 'mock', 后端环境: 'stg' }, { 创建HTTP })).toEqual({ 模式: 'mock', 后端环境: 'stg' });
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

  it('backend 默认工厂传入的 client 同时具备 请求 与 请求二进制', () => {
    // 默认依赖里 创建BFF客户端() 只构造 client，不发任何真实 fetch；
    // 先垫一个内存 localStorage，避免 Node 的 ExperimentalWarning 噪音（测试环境未提供时）。
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    try {
      const source = 创建招聘数据源({ 数据源: 'backend', 后端环境: 'stg' });
      expect(source.模式).toBe('backend');
      const deps = 捕获.后端工厂依赖 as { client: { 请求: unknown; 请求二进制: unknown } };
      expect(typeof deps.client.请求).toBe('function');
      expect(typeof deps.client.请求二进制).toBe('function');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
