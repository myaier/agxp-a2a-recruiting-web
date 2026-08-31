// Agent 规则映射测试：冻结 owner-safe 来源行、closed 枚举投影与 fail-closed 省略。
// 孤儿 intention scope（意向缺席或已归档）一律不映射，更不许并入 global。

import { describe, expect, it } from 'vitest';
import {
  BFFAgent规则样本,
  BFF意向Agent规则样本,
  BFF意向样本,
} from '../测试/BFF样本';
import { 映射候选Agent规则, 映射招聘Agent规则 } from './Agent规则映射';

describe('Agent 规则映射', () => {
  it('maps candidate global/intention rules and fails closed on orphan scope', () => {
    const intentions = {
      int_0123456789abcdef0123456789abcdef: {
        ...BFF意向样本,
        intention_id: 'int_0123456789abcdef0123456789abcdef',
        job_category: { id: 'tax_product', display_name: 'AI 产品经理' },
      },
    };
    const mapped = 映射候选Agent规则([
      BFFAgent规则样本,
      BFF意向Agent规则样本,
      { ...BFF意向Agent规则样本, rule_id: 'rul_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', scope: {
        type: 'intention', intention_id: 'int_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      } },
    ], intentions);

    expect(mapped.全局).toHaveLength(1);
    expect(mapped.意向级).toEqual([expect.objectContaining({
      编号: BFF意向Agent规则样本.rule_id,
      内容: BFF意向Agent规则样本.display_text,
      生效: true,
      作用域: { 类型: '意向', 意向编号: 'int_0123456789abcdef0123456789abcdef' },
      服务端版本: BFF意向Agent规则样本.version,
      服务端状态: BFF意向Agent规则样本.state,
    })]);
  });

  it('来源行是确定性的 owner-safe 文案：只投影 scope 与更新日期', () => {
    const mapped = 映射候选Agent规则([BFFAgent规则样本, BFF意向Agent规则样本], {
      int_0123456789abcdef0123456789abcdef: {
        ...BFF意向样本,
        intention_id: 'int_0123456789abcdef0123456789abcdef',
        job_category: { id: 'tax_product', display_name: 'AI 产品经理' },
      },
    });
    expect(mapped.全局[0]).toMatchObject({
      编号: BFFAgent规则样本.rule_id,
      来源: '全局 · 更新于 2026-08-27',
      作用域: { 类型: '全局' },
      服务端版本: BFFAgent规则样本.version,
      服务端状态: BFFAgent规则样本.state,
    });
    expect(mapped.意向级[0]).toMatchObject({
      来源: '意向「AI 产品经理」 · 更新于 2026-08-27',
    });
  });

  it('paused 显示为未生效并保留服务端元数据，archived 整条不进当前列表', () => {
    const mapped = 映射候选Agent规则([
      { ...BFFAgent规则样本, state: 'paused' },
      { ...BFFAgent规则样本, rule_id: 'rul_cccccccccccccccccccccccccccccc', state: 'archived' },
    ], {});
    expect(mapped.全局).toHaveLength(1);
    expect(mapped.全局[0]).toMatchObject({
      生效: false,
      作用域: { 类型: '全局' },
      服务端版本: BFFAgent规则样本.version,
      服务端状态: 'paused',
    });
    expect(mapped.意向级).toEqual([]);
  });

  it('意向已归档或缺席的意向规则都整条省略，绝不并入全局（fail closed）', () => {
    const mapped = 映射候选Agent规则([
      BFF意向Agent规则样本,
      { ...BFF意向Agent规则样本, rule_id: 'rul_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', scope: {
        type: 'intention', intention_id: 'int_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      } },
    ], {
      int_0123456789abcdef0123456789abcdef: {
        ...BFF意向样本,
        intention_id: 'int_0123456789abcdef0123456789abcdef',
        job_category: { id: 'tax_product', display_name: 'AI 产品经理' },
        status: 'archived',
      },
    });
    expect(mapped.意向级).toEqual([]);
    expect(mapped.全局).toEqual([]);
  });

  it('recruiter 投影带全量服务端元数据，archived 与非 global scope 都省略', () => {
    const mapped = 映射招聘Agent规则([
      BFFAgent规则样本,
      { ...BFFAgent规则样本, rule_id: 'rul_dddddddddddddddddddddddddddddd', state: 'paused' },
      { ...BFFAgent规则样本, rule_id: 'rul_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', state: 'archived' },
      { ...BFFAgent规则样本, rule_id: 'rul_ffffffffffffffffffffffffffffffff', scope: {
        type: 'intention', intention_id: 'int_0123456789abcdef0123456789abcdef',
      } },
    ]);
    expect(mapped).toHaveLength(2);
    expect(mapped[0]).toMatchObject({
      编号: BFFAgent规则样本.rule_id,
      来源: '全局 · 更新于 2026-08-27',
      生效: true,
      作用域: { 类型: '全局' },
      服务端版本: BFFAgent规则样本.version,
      服务端状态: 'active',
    });
    expect(mapped[1]).toMatchObject({ 生效: false, 服务端状态: 'paused' });
  });
});
