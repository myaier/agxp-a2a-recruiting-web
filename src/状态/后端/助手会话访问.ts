// 助手会话访问 seam（Task 4 / 合同 C）：Provider 只暴露这一个可空访问口，不保存聊天消息。
// `创建助手会话访问` 仅封装四个数据源方法之上的真实身份 fence —— 请求前与响应后都核对
// 「当前主体 + 当前会话代际」；同 subject 重新登录会递增代际，所以仅比较字符串 subject 不够，
// 代际不匹配同样过时。过时结果（成功或 401）抛 AbortError 交调用方丢弃，不清新会话；
// 当前轮 401 与既有会话操作同一口径：清账号状态 全套依赖（完整清理回调由 Provider 绑定
// 既有 后端操作依赖，不另造第二套 deps 抽象）后原样 rethrow。Mock / 未登录 / 非 candidate
// 一律返回 null。协议本身（路由/解码/幂等键）归 助手会话数据源 所有，本层不重写。

import { BFF错误 } from '../../数据/HTTP客户端';
import type { BFF主体 } from '../../数据/BFF契约';
import type { 助手会话数据源 } from '../../数据/招聘数据源/助手会话';
import { 清账号状态 } from './会话操作';

export interface 助手会话访问 {
  /** 后端环境 + subject + candidate 角色 + 真实会话代际；任一变化即失效。 */
  范围键: string;
  api: 助手会话数据源;
}

/** 清理依赖即 清账号状态 的入参形状（必需五键 + 可选引用）；Provider 传入全量既有依赖。 */
export type 助手会话访问依赖 = Parameters<typeof 清账号状态>[0] & {
  是后端: boolean;
  /** 后端环境标识（stg/prod…），只进 范围键。 */
  环境: string;
  /** seam 创建时刻的登录主体；null = 未登录。 */
  主体: BFF主体 | null;
  已登录: boolean;
  /** seam 创建时刻的真实会话代际快照（Provider 渲染期从 会话代际.current 读出）。 */
  代际: number;
};

export function 创建助手会话访问(deps: 助手会话访问依赖): 助手会话访问 | null {
  const { 是后端, 后端, 环境, 主体, 已登录, 代际 } = deps;
  if (!是后端 || !后端 || !已登录 || 主体 === null || 主体.last_used_role !== 'candidate') {
    return null;
  }
  const subjectId = 主体.subject_id;
  const 范围键 = `${环境}|${subjectId}|candidate|${代际}`;

  const 仍在范围 = () =>
    deps.主体标识引用.current === subjectId && deps.会话代际.current === 代际;

  const 范围已变化错误 = () =>
    // 与 fetch 中止同名的 AbortError：调用方按 name 丢弃，不当作业务失败展示。
    new DOMException('助手会话身份范围已变化', 'AbortError');

  const 包装 = <T>(发起: () => Promise<T>): Promise<T> => {
    // 每次请求前检查真实身份：seam 已过时（登出 / 重登 / 切角色）就不再触网。
    if (!仍在范围()) return Promise.reject(范围已变化错误());
    const 起始代际 = deps.会话代际.current;
    return 发起().then(
      (值) => {
        if (!仍在范围()) throw 范围已变化错误();
        return 值;
      },
      (错误: unknown) => {
        // 过时结果（含过时 401）整包丢弃，不清新会话
        if (!仍在范围()) throw 范围已变化错误();
        // 当前轮 401：与既有会话操作同口径 —— 清账号状态 全套依赖 + rethrow，
        // 不能只清本域支持的子集
        if (错误 instanceof BFF错误 && 错误.status === 401 && 起始代际 === deps.会话代际.current) {
          清账号状态(deps);
        }
        throw 错误;
      },
    );
  };

  const api: 助手会话数据源 = {
    读取助手历史: (cursor?: string) => 包装(() => 后端.读取助手历史(cursor)),
    发送助手消息: (text: string, idempotencyKey: string) =>
      包装(() => 后端.发送助手消息(text, idempotencyKey)),
    读取助手轮次: (turnId: string) => 包装(() => 后端.读取助手轮次(turnId)),
    重试助手轮次: (turnId: string, idempotencyKey: string) =>
      包装(() => 后端.重试助手轮次(turnId, idempotencyKey)),
  };

  return { 范围键, api };
}
