// Agent 规则映射：BFF wire Rule → 页面 规则 的纯函数投影。
// 只投 owner-safe 字段：closed scope 枚举 + 更新日期副行（设计 7.1/7.2），不解释 clause_kinds；
// Backend 映射出的每条 Rule 必须带全 作用域/服务端版本/服务端状态，供 CAS mutation 与开关显示用。
// archived 一律不进当前列表；意向 scope 对不上权威意向（缺席或已归档）就整条省略
// （fail closed），绝不并入 global —— 并入会让代理把意向约束当全局约束执行。

import type { BFFAgent规则, BFFOwnerIntention } from './BFF契约';
import type { 规则 } from './类型';

export interface 规则映射结果 {
  全局: 规则[];
  意向级: 规则[];
}

function 转页面规则(dto: BFFAgent规则, 作用域: 规则['作用域'], 来源: string): 规则 {
  return {
    编号: dto.rule_id,
    内容: dto.display_text,
    来源,
    // paused 是权威存在但不生效：active→true，其余（到此只剩 paused）→false
    生效: dto.state === 'active',
    作用域,
    服务端版本: dto.version,
    服务端状态: dto.state,
  };
}

/** 候选端投影：global 直接归组；intention 规则按真实 intention 归组，
 *  意向缺席或 status=archived 时整条省略。保持入参顺序。 */
export function 映射候选Agent规则(
  rules: BFFAgent规则[],
  intentions: Record<string, BFFOwnerIntention>,
): 规则映射结果 {
  const 结果: 规则映射结果 = { 全局: [], 意向级: [] };
  for (const dto of rules) {
    if (dto.state === 'archived') continue;
    const { scope } = dto;
    if (scope.type === 'global') {
      结果.全局.push(转页面规则(
        dto,
        { 类型: '全局' },
        `全局 · 更新于 ${dto.updated_at.slice(0, 10)}`,
      ));
      continue;
    }
    const 意向 = intentions[scope.intention_id];
    if (!意向 || 意向.status === 'archived') continue;
    结果.意向级.push(转页面规则(
      dto,
      { 类型: '意向', 意向编号: scope.intention_id },
      `意向「${意向.job_category.display_name}」 · 更新于 ${dto.updated_at.slice(0, 10)}`,
    ));
  }
  return 结果;
}

/** 招聘端投影：只有 global 单组（设计 7.2）；wire 里不应出现的其它 scope 不伪造「全局」，
 *  整条省略 —— 与候选端孤儿处理同口径的 fail closed。 */
export function 映射招聘Agent规则(rules: BFFAgent规则[]): 规则[] {
  return rules.flatMap((dto) => {
    if (dto.state === 'archived') return [];
    if (dto.scope.type !== 'global') return [];
    return [转页面规则(dto, { 类型: '全局' }, `全局 · 更新于 ${dto.updated_at.slice(0, 10)}`)];
  });
}
