// Agent 规则域 reducer 测试：既有 Mock CRUD 的结果与规则编号一个都不能变，
// 再加 P6 Backend 水合（整体替换，绝无 Mock 行残留）与清空（只清三组规则数组）。

import { describe, expect, it } from 'vitest';
import { 归约Agent规则 } from './Agent规则';
import { 初始状态 } from '../应用状态';
import type { 规则 } from '../../数据/类型';

const 后端全局规则: 规则 = {
  编号: 'rul_0123456789abcdef0123456789abcdef',
  内容: '大小周不谈',
  来源: '全局 · 更新于 2026-08-27',
  生效: true,
  作用域: { 类型: '全局' },
  服务端版本: 3,
  服务端状态: 'active',
};

const 后端意向规则: 规则 = {
  编号: 'rul_fedcba9876543210fedcba9876543210',
  内容: '双休是底线；隔周六可谈',
  来源: '意向「AI 产品经理」 · 更新于 2026-08-27',
  生效: true,
  作用域: { 类型: '意向', 意向编号: 'int_0123456789abcdef0123456789abcdef' },
  服务端版本: 1,
  服务端状态: 'active',
};

const 后端招聘规则: 规则 = {
  编号: 'rul_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  内容: '不透露 HC 剩余数量',
  来源: '全局 · 更新于 2026-08-27',
  生效: true,
  作用域: { 类型: '全局' },
  服务端版本: 2,
  服务端状态: 'active',
};

describe('归约Agent规则：Mock CRUD 保持原行为与编号', () => {
  it('新增规则 落全局组，编号沿用 R-06 且播种 生效:true', () => {
    const 下一 = 归约Agent规则(初始状态, { 型: '新增规则', 内容: '不接受大小周', 来源: '测试' });
    expect(下一.全局规则.at(-1)).toEqual({
      编号: 'R-06', 内容: '不接受大小周', 来源: '测试', 生效: true,
    });
    expect(下一.意向级规则).toEqual(初始状态.意向级规则);
  });

  it('改规则 只改命中行内容，另一组不动', () => {
    const 下一 = 归约Agent规则(初始状态, { 型: '改规则', 编号: 'R-04', 内容: '只谈双休' });
    expect(下一.意向级规则.find((条) => 条.编号 === 'R-04')?.内容).toBe('只谈双休');
    expect(下一.全局规则).toEqual(初始状态.全局规则);
    expect(下一.企业规则).toEqual(初始状态.企业规则);
  });

  it('删规则 按编号删且不重排其余编号', () => {
    const 下一 = 归约Agent规则(初始状态, { 型: '删规则', 编号: 'R-09' });
    expect(下一.意向级规则.map((条) => 条.编号)).toEqual(['R-04']);
    expect(下一.全局规则).toEqual(初始状态.全局规则);
  });

  it('切规则开关 只翻转命中行的 生效', () => {
    const 下一 = 归约Agent规则(初始状态, { 型: '切规则开关', 编号: 'R-01' });
    expect(下一.全局规则.find((条) => 条.编号 === 'R-01')?.生效).toBe(false);
    expect(下一.意向级规则.map((条) => 条.生效)).toEqual(初始状态.意向级规则.map((条) => 条.生效));
  });

  it('企业新增规则 编号独立于求职端计数（R-04）', () => {
    const 下一 = 归约Agent规则(初始状态, { 型: '企业新增规则', 内容: '竞对在职不推进', 来源: '测试' });
    expect(下一.企业规则.at(-1)).toEqual({
      编号: 'R-04', 内容: '竞对在职不推进', 来源: '测试', 生效: true,
    });
  });

  it('企业改规则/企业删规则/企业切规则开关 与求职端同构', () => {
    const 改后 = 归约Agent规则(初始状态, { 型: '企业改规则', 编号: 'R-05', 内容: '两轮未回应转亮点沟通' });
    expect(改后.企业规则.find((条) => 条.编号 === 'R-05')?.内容).toBe('两轮未回应转亮点沟通');

    const 删后 = 归约Agent规则(初始状态, { 型: '企业删规则', 编号: 'R-02' });
    expect(删后.企业规则.map((条) => 条.编号)).toEqual(['R-03', 'R-05']);

    const 切后 = 归约Agent规则(初始状态, { 型: '企业切规则开关', 编号: 'R-02' });
    expect(切后.企业规则.find((条) => 条.编号 === 'R-02')?.生效).toBe(false);
  });
});

describe('归约Agent规则：P6 Backend 水合与清空', () => {
  it('backend hydration replaces Mock arrays and clear empties only P6 rows', () => {
    const candidate = 归约Agent规则(初始状态, {
      型: '水合后端候选规则', 全局: [后端全局规则], 意向级: [后端意向规则],
    });
    expect(candidate.全局规则).toEqual([后端全局规则]);
    expect(candidate.意向级规则).toEqual([后端意向规则]);

    const recruiter = 归约Agent规则(candidate, {
      型: '水合后端招聘规则', 规则: [后端招聘规则],
    });
    expect(recruiter.企业规则).toEqual([后端招聘规则]);

    expect(归约Agent规则(recruiter, { 型: '清后端Agent规则' })).toMatchObject({
      全局规则: [], 意向级规则: [], 企业规则: [],
    });
  });

  it('水合是整体替换且不动其他域，清空只清三组规则数组', () => {
    const 水合 = 归约Agent规则(初始状态, {
      型: '水合后端候选规则', 全局: [后端全局规则], 意向级: [后端意向规则],
    });
    // Mock 播种的 R-01/R-07/R-03/R-04/R-09 一条都不剩
    expect(水合.全局规则.some((条) => 条.编号.startsWith('R-'))).toBe(false);
    expect(水合.在谈列表).toBe(初始状态.在谈列表);

    const 清后 = 归约Agent规则({ ...水合, 企业规则: [后端招聘规则] }, { 型: '清后端Agent规则' });
    expect(清后.企业规则).toEqual([]);
    expect(清后.在谈列表).toBe(初始状态.在谈列表);
  });

  it('清空后再走 Mock 新增，编号按剩余数组重新起算', () => {
    const 清后 = 归约Agent规则(初始状态, { 型: '清后端Agent规则' });
    const 再新增 = 归约Agent规则(清后, { 型: '新增规则', 内容: '重启后第一条', 来源: '测试' });
    expect(再新增.全局规则.at(-1)?.编号).toBe('R-01');
  });
});
