// 屏幕测试宿主共用的 发现推荐操作 桩工厂。
//
// 生产 Provider 恒注入完整 应用操作（发现推荐操作 在 类型.ts 里是非可选成员），所以产品
// 代码按非可选表直呼这些方法 —— 缺一个就该在测试里立刻 TypeError，而不是静默 no-op 让
// 页面永远转圈。屏幕测试的 use应用状态 桩宿主因此必须给全表：用例只覆盖自己要断言的
// 那几个 spy，其余由本工厂补齐。
//
// 类型上不做 as any：对象字面量按 发现推荐操作 收敛，将来给接口加方法时本文件先编译失败，
// 全部宿主随之补齐，不会出现「桩比生产少一格」的静默缺口。

import { vi } from 'vitest';
import type { 发现推荐操作 } from '../状态/后端/类型';
import { BFF候选委托回执样本, BFF招聘委托回执样本 } from './BFF样本';

/** 完整 发现推荐操作 桩；覆盖项按名替换（用例自己的 spy 优先）。 */
export function 发现推荐操作桩(覆盖: Record<string, unknown> = {}): 发现推荐操作 {
  const 全表: 发现推荐操作 = {
    设置发现推荐范围: vi.fn(),
    加载候选岗位: vi.fn(async () => undefined),
    读取候选岗位详情: vi.fn(async () => undefined),
    加载招聘候选: vi.fn(async () => undefined),
    加载招聘已筛: vi.fn(async () => undefined),
    读取招聘候选详情: vi.fn(async () => undefined),
    刷新候选岗位: vi.fn(async () => undefined),
    标记岗位不感兴趣: vi.fn(async () => undefined),
    刷新招聘候选: vi.fn(async () => undefined),
    设置候选收藏: vi.fn(async () => undefined),
    淘汰候选: vi.fn(async () => undefined),
    撤销淘汰候选: vi.fn(async () => undefined),
    委托候选岗位: vi.fn(async () => BFF候选委托回执样本),
    委托招聘候选: vi.fn(async () => BFF招聘委托回执样本),
    刷新委托: vi.fn(async () => undefined),
  };
  return { ...全表, ...覆盖 } as 发现推荐操作;
}
