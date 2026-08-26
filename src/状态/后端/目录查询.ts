// 后端目录查询 seam：Backend 模式暴露 查询Location/Taxonomy/Institution，Mock 为 null。
// 从 应用状态提供者 的 useMemo 目录查询体按真实后端 owner 拆出，行为逐字保持：
// 401 会话代际守卫（stale 401 不清新会话）+ 收口到 清账号状态 + rethrow。接口失败绝不回退 Mock。

import { BFF错误 } from '../../数据/HTTP客户端';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import type { 后端操作依赖 } from './类型';
import { 清账号状态 } from './会话操作';

export type 目录查询 = Pick<HTTP招聘数据源, '查询Location' | '查询Taxonomy' | '查询Institution'>;

export function 创建目录查询(
  deps: Pick<后端操作依赖, '是后端' | '后端' | '派发' | '设后端状态' | '主体标识引用' | '会话代际'>,
): 目录查询 | null {
  const { 是后端, 后端, 派发, 设后端状态, 主体标识引用, 会话代际 } = deps;
  if (!是后端 || !后端) return null;
  const 账号清理依赖 = { 派发, 设后端状态, 后端, 主体标识引用, 会话代际 };

  // Task 3 R8 / review-r1 P1-6 / review-r2 R2-M-4：目录查询 seam —— Backend 模式暴露
  // 后端.查询Location 等三个方法，Mock 为 null。facade 包一层 401 处理：选择器开着时会话过期 →
  // 目录请求 401 → 触发与资源写操作 401 同口径的会话清理（派发空快照 + 后端状态登出 +
  // 清空目录缓存 + 清草稿），然后 rethrow 让选择器的 .catch 照常显示空结果。
  // review-r2 R2-M-4：捕获请求起始时的会话代际；401 到达时若代际已变（退出/重登开了新会话），
  // 该 401 属于旧会话（stale），只 rethrow 不清新会话——否则旧请求的 401 会把新登录踢掉。
  const 处理目录401 = (错误: unknown, 起始代际: number): never => {
    if (错误 instanceof BFF错误 && 错误.status === 401) {
      // review-r2 R2-M-4：stale 401 —— 请求发出后会话已更替（退出/重登），不清新会话
      if (起始代际 !== 会话代际.current) throw 错误;
      // review-r3 R3-I-2：收口到 清账号状态，三个支持域 + 草稿 + 目录缓存一起清
      清账号状态(账号清理依赖);
    }
    throw 错误;
  };

  return {
    查询Location: ((...args: Parameters<HTTP招聘数据源['查询Location']>) => {
      const 起始代际 = 会话代际.current;
      return 后端.查询Location(...args).catch((e) => 处理目录401(e, 起始代际));
    }) as HTTP招聘数据源['查询Location'],
    查询Taxonomy: ((...args: Parameters<HTTP招聘数据源['查询Taxonomy']>) => {
      const 起始代际 = 会话代际.current;
      return 后端.查询Taxonomy(...args).catch((e) => 处理目录401(e, 起始代际));
    }) as HTTP招聘数据源['查询Taxonomy'],
    查询Institution: ((...args: Parameters<HTTP招聘数据源['查询Institution']>) => {
      const 起始代际 = 会话代际.current;
      return 后端.查询Institution(...args).catch((e) => 处理目录401(e, 起始代际));
    }) as HTTP招聘数据源['查询Institution'],
  };
}