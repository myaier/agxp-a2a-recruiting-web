// 前端附属存储：加分关键词 / 实习转正 只影响候选人排序与展示，不进 BFF body。
// 按 后端环境 + 真实岗位ID 为键落 localStorage，环境之间互不串读（stg 的附属不会漏进 local）。
// 删除真实岗位时同步删除附属键，避免残留指向已删岗位的孤儿数据。

import type { 后端环境 } from '../配置/运行配置';

export interface 岗位附属 {
  加分关键词?: string[];
  实习转正?: boolean;
}

export interface 岗位附属存储 {
  读取(env: 后端环境, jobId: string): 岗位附属;
  写入(env: 后端环境, jobId: string, value: 岗位附属): void;
  删除(env: 后端环境, jobId: string): void;
}

const 键前缀 = 'AGXP后端岗位附属v1';

function 键(env: 后端环境, jobId: string): string {
  return `${键前缀}:${env}:${jobId}`;
}

/** 附属存储按 env 隔离；读取不到时返回 {}（页面按缺省处理，不抛错）。 */
export function 创建岗位附属存储(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): 岗位附属存储 {
  return {
    读取(env, jobId) {
      const 原文 = storage.getItem(键(env, jobId));
      if (!原文) return {};
      try {
        const 值 = JSON.parse(原文) as 岗位附属;
        return 值 && typeof 值 === 'object' ? 值 : {};
      } catch {
        return {};
      }
    },
    写入(env, jobId, value) {
      storage.setItem(键(env, jobId), JSON.stringify(value));
    },
    删除(env, jobId) {
      storage.removeItem(键(env, jobId));
    },
  };
}