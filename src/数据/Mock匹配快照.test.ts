// Mock匹配快照 —— 固定记录 ID → 已解码 BFF匹配解释 | null 的演示快照表（Spec §7）。
// 表是唯一来源：列表环、详情总分、弹层六维行全部经 Mock匹配分数 / Mock匹配解释 取同一条
// 固定快照 —— 不按当前简历/JD 重算（编辑简历/JD 不改变演示快照），也没有第二份评分器。
// 覆盖矩阵（Spec §7 至少涵盖）：四态、技能 1/100 命中 0 分仍部分匹配、真实总分 0、
// null 解释有分、无快照与总分缺失；不同记录不同快照；求职/招聘两端记录分开。

import { describe, expect, it } from 'vitest';
import { Mock匹配解释, Mock匹配分数, Mock匹配快照表 } from './Mock匹配快照';
import { 解匹配解释 } from './招聘数据源/匹配解释';
import type { BFF匹配解释, BFF匹配状态 } from './BFF契约';

function 全表条目(): [string, BFF匹配解释 | null][] {
  return Object.entries(Mock匹配快照表);
}

describe('Mock匹配快照 · 覆盖矩阵（Spec §7）', () => {
  it('M-13 全匹配演示：六维全 matched，总分 100 = 分项和', () => {
    const 解释 = Mock匹配解释('M-13');
    expect(解释).not.toBeNull();
    expect(解释!.dimensions.map((维) => 维.status)).toEqual([
      'matched', 'matched', 'matched', 'matched', 'matched', 'matched',
    ]);
    expect(解释!.total_points).toBe(100);
    expect(解释!.dimensions.reduce((和, 维) => 和 + 维.points, 0)).toBe(100);
  });

  it('M-02 冻结反例：技能 1/100 命中，floor 后 0 分仍为部分匹配', () => {
    const 解释 = Mock匹配解释('M-02');
    expect(解释).not.toBeNull();
    const 技能 = 解释!.dimensions[1];
    expect(技能.dimension).toBe('skills');
    expect(技能.status).toBe('partially_matched');
    expect(技能.points).toBe(0);
    expect(技能.max_points).toBe(35);
    expect(技能).toHaveProperty('matched_count', 1);
    expect(技能).toHaveProperty('required_count', 100);
  });

  it('M-12 真实总分 0：全部维度 0 分 —— 0 是合法真实分，不是缺失', () => {
    const 解释 = Mock匹配解释('M-12');
    expect(解释).not.toBeNull();
    expect(解释!.total_points).toBe(0);
    expect(解释!.dimensions.every((维) => 维.points === 0)).toBe(true);
  });

  it('J-01 null 解释有分：解释为 null，分数保留固定种子 94', () => {
    expect(Mock匹配解释('J-01')).toBeNull();
    expect(Mock匹配分数('J-01')).toBe(94);
  });

  it('M-04 无快照与总分缺失：不在表内 → 分数与解释都是 null（不回落种子、不造 0）', () => {
    expect(Mock匹配解释('M-04')).toBeNull();
    expect(Mock匹配分数('M-04')).toBeNull();
  });

  it('四态在快照表的对象条目里都有演示', () => {
    const 态们 = new Set<BFF匹配状态>();
    for (const [, 解释] of 全表条目()) {
      if (解释 === null) continue;
      for (const 维 of 解释.dimensions) 态们.add(维.status);
    }
    expect(态们.has('matched')).toBe(true);
    expect(态们.has('partially_matched')).toBe(true);
    expect(态们.has('not_matched')).toBe(true);
    expect(态们.has('unknown')).toBe(true);
  });

  it('每条对象快照都是过冻结 解匹配解释 校验的合法 C1 对象（总分=分项和=同分）', () => {
    for (const [编号, 解释] of 全表条目()) {
      if (解释 === null) continue;
      expect(解匹配解释(解释, 解释.total_points), `${编号} 不是合法 C1 解释`).toEqual(解释);
    }
  });

  it('不同记录不同快照：不是一份演示对象到处引用', () => {
    const 串 = (编号: string) => JSON.stringify(Mock匹配解释(编号));
    expect(串('M-13')).not.toBe(串('M-11'));
    expect(串('M-11')).not.toBe(串('M-01'));
    expect(串('M-01')).not.toBe(串('A-01'));
  });

  it('账号/角色记录分开：求职端与招聘端各有自己的条目，招聘端快照不与求职端共用', () => {
    for (const 编号 of ['J-01', 'J-02', 'M-01', 'M-11', 'M-12', 'M-13']) {
      expect(编号 in Mock匹配快照表, `${编号} 应在快照表内`).toBe(true);
    }
    for (const 编号 of ['A-01', 'A-02', 'A-03', 'A-07', 'B-02']) {
      expect(编号 in Mock匹配快照表, `${编号} 应在快照表内`).toBe(true);
    }
    // 招聘端对象快照与任何求职端对象快照都不同（分角色视角，不能跨角色复制）
    expect(JSON.stringify(Mock匹配解释('A-01'))).not.toBe(JSON.stringify(Mock匹配解释('M-13')));
  });

  it('分数与表内 total_points 同源：对象条目的分数就是 total_points', () => {
    expect(Mock匹配分数('M-13')).toBe(Mock匹配解释('M-13')!.total_points);
    expect(Mock匹配分数('A-01')).toBe(Mock匹配解释('A-01')!.total_points);
  });

  it('null 条目保留种子分：表内 null 条目都能查到固定种子分（不随简历/JD 变）', () => {
    for (const [编号, 解释] of 全表条目()) {
      if (解释 !== null) continue;
      expect(Mock匹配分数(编号), `${编号} 应保留种子分`).not.toBeNull();
    }
    expect(Mock匹配分数('J-03')).toBe(91);
    expect(Mock匹配分数('A-07')).toBe(79);
  });

  it('@ 克隆回落：S1@P-03 按前缀回落 S1 的固定快照（招聘端克隆候选不丢分源）', () => {
    expect(Mock匹配分数('S1@P-03')).toBe(Mock匹配分数('S1'));
    expect(Mock匹配解释('S1@P-03')).toBeNull();
  });
});
