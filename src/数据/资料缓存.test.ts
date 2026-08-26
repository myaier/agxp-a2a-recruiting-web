import { describe, expect, it } from 'vitest';
import { 写资料缓存, 读资料缓存, 资料缓存键, 迁移旧资料缓存, type 资料缓存快照 } from './资料缓存';

function 内存存储() {
  const 数据 = new Map<string, string>();
  return {
    getItem: (键: string) => 数据.get(键) ?? null,
    setItem: (键: string, 值: string) => { 数据.set(键, 值); },
    removeItem: (键: string) => { 数据.delete(键); },
  };
}

const 快照: 资料缓存快照 = {
  公司自述: null,
  企业认证: { 姓名: '甲', 公司: '甲公司' },
  招聘头像: 'data:image/jpeg;base64,aaa',
  公司LOGO: null,
  求职头像: '章:2',
  飞书已接入: true,
  企业飞书已接入: false,
};

describe('账号资料缓存', () => {
  it('按模式、环境和账号三重隔离', () => {
    const 存储 = 内存存储();
    const 甲 = { 模式: 'backend' as const, 环境: 'stg' as const, 账号: 'sub_A' };
    const 乙 = { 模式: 'backend' as const, 环境: 'stg' as const, 账号: 'sub_B' };
    const 本地甲 = { 模式: 'backend' as const, 环境: 'local' as const, 账号: 'sub_A' };
    写资料缓存(存储, 甲, 快照);
    expect(读资料缓存(存储, 甲).企业认证?.姓名).toBe('甲');
    expect(读资料缓存(存储, 乙)).toEqual({});
    expect(读资料缓存(存储, 本地甲)).toEqual({});
    expect(资料缓存键(甲)).not.toBe(资料缓存键(乙));
  });

  it('损坏或伪造字段不会进入应用状态', () => {
    const 存储 = 内存存储();
    const 范围 = { 模式: 'mock' as const, 环境: 'stg' as const, 账号: 'demo' };
    存储.setItem(资料缓存键(范围), JSON.stringify({
      招聘头像: 'https://evil.example/avatar',
      求职头像: '非法',
      企业认证: { 姓名: 123, 公司: null },
      飞书已接入: '1',
    }));
    expect(读资料缓存(存储, 范围)).toEqual({});
  });

  it('旧全局键只在新分仓写成功后删除', () => {
    const 存储 = 内存存储();
    const 范围 = { 模式: 'mock' as const, 环境: 'stg' as const, 账号: 'demo' };
    存储.setItem('AGXP企业认证v1', JSON.stringify({ 姓名: '老用户', 公司: '老公司' }));
    const 结果 = 迁移旧资料缓存(存储, 范围);
    expect(结果.企业认证?.姓名).toBe('老用户');
    expect(存储.getItem('AGXP企业认证v1')).toBe(null);
    expect(读资料缓存(存储, 范围).企业认证?.姓名).toBe('老用户');
  });
});
