// 双端 Agent 设置数据源：候选端 /me/agent-settings，招聘端 /recruiter/agent-settings。
// 两端公开字段不对称：招聘端没有 material_submission，因此 decoder 与写入都按角色闭合。

import type {
  BFFAgent设置,
  BFFAgent设置补丁,
  BFF候选Agent设置,
  BFF招聘Agent设置,
  BFF角色,
} from '../BFF契约';
import { BFF错误 } from '../HTTP客户端';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

export interface Agent设置数据源 {
  读取Agent设置(role: BFF角色): Promise<BFFAgent设置>;
  修改Agent设置(role: BFF角色, patch: BFFAgent设置补丁, revision: number): Promise<BFFAgent设置>;
}

function 契约错误(): BFF错误 {
  return new BFF错误(200, 'invalid_response', '服务返回了不符合契约的 Agent 设置');
}

function 是记录(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function 要求闭合对象(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!是记录(input)) throw 契约错误();
  for (const key of keys) if (!(key in input)) throw 契约错误();
  for (const key of Object.keys(input)) if (!keys.includes(key)) throw 契约错误();
  return input;
}

function 要求枚举<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw 契约错误();
  return value as T;
}

function 要求修订(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw 契约错误();
  return value;
}

function 要求时间(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw 契约错误();
  return value;
}

function 解设置(input: unknown, role: BFF角色): BFFAgent设置 {
  const common = ['out_of_authority_concession', 'revision', 'updated_at'] as const;
  const raw = 要求闭合对象(input, role === 'candidate' ? ['material_submission', ...common] : common);
  const base = {
    out_of_authority_concession: 要求枚举(raw.out_of_authority_concession, ['ask_first', 'reject']),
    revision: 要求修订(raw.revision),
    updated_at: 要求时间(raw.updated_at),
  };
  if (role === 'recruiter') return base satisfies BFF招聘Agent设置;
  return {
    material_submission: 要求枚举(raw.material_submission, ['ask_first', 'auto_send']),
    ...base,
  } satisfies BFF候选Agent设置;
}

function 路径(role: BFF角色): '/api/v1/me/agent-settings' | '/api/v1/recruiter/agent-settings' {
  return role === 'candidate' ? '/api/v1/me/agent-settings' : '/api/v1/recruiter/agent-settings';
}

function 校验补丁(role: BFF角色, patch: BFFAgent设置补丁): void {
  const keys = Object.keys(patch);
  const allowed = role === 'candidate'
    ? ['material_submission', 'out_of_authority_concession']
    : ['out_of_authority_concession'];
  if (keys.length === 0 || keys.some((key) => !allowed.includes(key))) {
    throw new BFF错误(0, 'validation_failed', '没有可保存的 Agent 设置');
  }
}

export function 创建Agent设置数据源(请求: 请求函数): Agent设置数据源 {
  return {
    async 读取Agent设置(role) {
      const { result } = await 请求<unknown>({ path: 路径(role), 不缓存: true });
      return 解设置(result, role);
    },
    async 修改Agent设置(role, patch, revision) {
      校验补丁(role, patch);
      const { result } = await 请求<unknown>({
        path: 路径(role),
        method: 'PATCH',
        body: patch,
        ifMatch: `"${revision}"`,
        幂等: true,
      });
      return 解设置(result, role);
    },
  };
}
