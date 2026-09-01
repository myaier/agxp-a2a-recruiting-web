// P8 数据导出恢复句柄的账号范围存储。
//
// 只存“恢复一次未完成导出”所需的最小三元组 {subjectId, createKey, exportId}；
// 绝不落手机号/凭证/会话/工单/举报内容，也不落 ZIP 字节、对象键或下载 URL ——
// 这些都留在 BFF，浏览器只拿得回一个能继续轮询的句柄。
// 物理键复用 账号存储键('P8数据导出v1', 范围)（模式+环境+账号 三重隔离），
// 只做按键精确读写：不枚举存储、不维护跨账号索引。
// 反序列化严格按恰好三个字段校验，任何损坏 JSON、多余字段或 subject 不匹配的
// 旧值都会被丢弃并删除。无存储或存储抛异常一律 fail closed：读 null、写 false、
// 删 no-op，绝不把存储故障抛进页面。

import { 账号存储键 } from './资料缓存';
import type { 资料缓存范围, 资料缓存存储 } from './资料缓存';

/** 恢复一次数据导出所需且仅需的三个字段。 */
export interface P8导出恢复句柄 {
  subjectId: string;
  createKey: string;
  exportId: string | null;
}

export interface P8导出恢复存储 {
  读取(): P8导出恢复句柄 | null;
  写入(handle: P8导出恢复句柄): boolean;
  删除(): void;
}

const 键分类 = 'P8数据导出v1';

// 与 BFF wire 契约同口径（招聘数据源/P8控制面.ts）：exp_ + 32 位小写十六进制。
const 导出ID模式 = /^exp_[0-9a-f]{32}$/;

// createKey 是不透明的恢复令牌：只收 8~128 个可见 ASCII，
// 挡掉控制字符、空白与非 ASCII，避免不可见内容被静默持久化。
const 创建键模式 = /^[!-~]{8,128}$/;

/** 恰好三个字段、subject 与范围一致、createKey/exportId 合形的句柄。 */
function 是有效句柄(值: unknown, 范围: 资料缓存范围): 值 is P8导出恢复句柄 {
  if (!值 || typeof 值 !== 'object' || Array.isArray(值)) return false;
  const 候选 = 值 as Record<string, unknown>;
  if (Object.keys(候选).length !== 3) return false;
  if (候选.subjectId !== 范围.账号) return false;
  if (typeof 候选.createKey !== 'string' || !创建键模式.test(候选.createKey)) return false;
  if (候选.exportId !== null
    && (typeof 候选.exportId !== 'string' || !导出ID模式.test(候选.exportId))) return false;
  return true;
}

export function 创建P8导出恢复存储(input: {
  storage: 资料缓存存储 | null;
  范围: 资料缓存范围;
}): P8导出恢复存储 {
  const { storage, 范围 } = input;
  const 键 = 账号存储键(键分类, 范围);

  function 丢弃(): void {
    try {
      storage?.removeItem(键);
    } catch {
      // 删除失败也只能保持 fail closed，不把存储故障抛进页面。
    }
  }

  return {
    读取(): P8导出恢复句柄 | null {
      if (!storage) return null;
      let 原文: string | null;
      try {
        原文 = storage.getItem(键);
      } catch {
        // 读不出来就当没有，但不删除：还没看到值，不能凭空清掉别人的数据。
        return null;
      }
      if (原文 === null) return null;
      let 值: unknown;
      try {
        值 = JSON.parse(原文);
      } catch {
        丢弃();
        return null;
      }
      if (!是有效句柄(值, 范围)) {
        丢弃();
        return null;
      }
      return 值;
    },
    写入(handle: P8导出恢复句柄): boolean {
      // 入参也按同一套守卫：subject 不匹配或带多余字段（可能是敏感数据）整笔拒绝。
      if (!storage || !是有效句柄(handle, 范围)) return false;
      try {
        storage.setItem(键, JSON.stringify({
          subjectId: handle.subjectId,
          createKey: handle.createKey,
          exportId: handle.exportId,
        }));
        return true;
      } catch {
        return false;
      }
    },
    删除(): void {
      丢弃();
    },
  };
}
