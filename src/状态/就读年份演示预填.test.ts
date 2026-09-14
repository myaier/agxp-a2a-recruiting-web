// 就读年份演示预填（Task 4）：2021/2025 从就读页面 `?? 2021 / ?? 2025` 的伪默认
// 迁到数据层的显式 Mock 种子 —— Mock 显式种子、既有样例（2014/2017）、空 fixture 三者分明。
// 缓存优先不变：缓存里的空字段/空数组不合并演示种子；Backend 初始教育仍为空。
// 测试环境 localStorage 不可用（Node 需要 --localstorage-file），按仓库惯例用内存桩。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 就读年份演示预填 } from '../数据/模拟数据';
import { 账号存储键 } from '../数据/资料缓存';
import type { HTTP招聘数据源 } from '../数据/HTTP招聘数据源';
import { 创建初始状态, 演示范围, 安全取存储 } from './初始状态';

/** 内存版 localStorage（同 应用状态.test.ts 的 stubGlobal 惯例） */
function 内存存储(): Storage {
  const 表 = new Map<string, string>();
  return {
    length: 0,
    key: () => null,
    getItem: (键: string) => 表.get(键) ?? null,
    setItem: (键: string, 值: string) => void 表.set(键, 值),
    removeItem: (键: string) => void 表.delete(键),
    clear: () => void 表.clear(),
  } as unknown as Storage;
}

describe('就读年份演示预填（Mock 显式种子）', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', 内存存储());
  });

  it('生产种子就是 2021-09 / 2025-06', () => {
    expect(就读年份演示预填).toEqual({ 开始: '2021-09', 结束: '2025-06' });
  });

  it('默认 Mock 路径既有教育 2014/2017 原样优先，不被演示种子改成 2021/2025', () => {
    const 状态 = 创建初始状态({ 模式: 'mock', 后端环境: 'stg' });
    expect(状态.简历教育[0]?.学校).toBe('上海交通大学');
    expect(状态.简历教育[0]?.开始).toBe('2014-09');
    expect(状态.简历教育[0]?.结束).toBe('2017-06');
  });

  it('缓存中的空教育起止不合并演示种子（明确空值保持空）', () => {
    安全取存储('local')?.setItem(
      账号存储键('简历v3', 演示范围('stg')),
      JSON.stringify({
        经历: [],
        教育: [{ 编号: 'edu1', 学校: '缓存大学', 学历: '本科', 专业: '演示专业', 开始: '', 结束: '' }],
        技能: [],
        证书: [],
        基本信息: { 真名: '测', 开始工作年: '2020', 身份: '在职' },
      }),
    );
    const 状态 = 创建初始状态({ 模式: 'mock', 后端环境: 'stg' });
    expect(状态.简历教育[0]?.学校).toBe('缓存大学');
    expect(状态.简历教育[0]?.开始).toBe('');
    expect(状态.简历教育[0]?.结束).toBe('');
  });

  it('Backend 初始教育仍为空，不播演示种子', () => {
    const 状态 = 创建初始状态({ 模式: 'backend', 后端环境: 'stg', 后端: {} as HTTP招聘数据源 });
    expect(状态.简历教育).toEqual([]);
  });
});
