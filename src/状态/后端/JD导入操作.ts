// JD PDF 建议稿导入域操作：consent 后的创建与轮询读取（发布岗位页面专用）。
// 与其它域同一纪律：Backend + recruiter 才调用数据源，Mock / 无后端 / 非 recruiter
// 一律返回 已换代 且零请求；请求前捕获 subject + 会话代际栅栏，主体 / 角色 / 代际任一
// 失配的迟到成败整包丢弃（迟到的 401 绝不登出新会话）；当前栅栏 401 走统一 清账号状态，
// 非 401 错误原样抛给页面的 JD 闭合文案映射。导入运行态（generation/import ID/快照）
// 全部留在页面，本层不新增全局状态、锁或持久化。

import { BFF错误 } from '../../数据/HTTP客户端';
import type { BFFJD导入 } from '../../数据/BFF契约';
import { 清账号状态 } from './会话操作';
import type { 后端操作依赖, JD导入操作 } from './类型';

export function 创建JD导入操作(deps: 后端操作依赖): JD导入操作 {
  const {
    是后端,
    后端,
    后端状态引用,
    主体标识引用,
    会话代际,
  } = deps;

  function 可调用(): boolean {
    return 是后端 && 后端 !== null && 主体标识引用.current !== null &&
      后端状态引用.current.主体?.last_used_role === 'recruiter';
  }

  async function 执行(
    request: () => Promise<BFFJD导入>,
  ): Promise<BFFJD导入 | '已换代'> {
    if (!可调用()) return '已换代';

    const subject = 主体标识引用.current;
    const generation = 会话代际.current;
    const fenceCurrent = () =>
      主体标识引用.current === subject &&
      会话代际.current === generation &&
      后端状态引用.current.主体?.last_used_role === 'recruiter';

    try {
      const result = await request();
      return fenceCurrent() ? result : '已换代';
    } catch (error) {
      if (!fenceCurrent()) return '已换代';
      if (error instanceof BFF错误 && error.status === 401) {
        清账号状态(deps);
        return '已换代';
      }
      throw error;
    }
  }

  return {
    // 起飞前 guard 在两个公开方法里各自重复一次，让 后端! 非空断言不与无后端依赖竞态。
    创建JD导入(file, idempotencyKey) {
      if (!可调用()) return Promise.resolve('已换代');
      return 执行(() => 后端!.创建JD导入(file, idempotencyKey));
    },
    读取JD导入(importId) {
      if (!可调用()) return Promise.resolve('已换代');
      return 执行(() => 后端!.读取JD导入(importId));
    },
  };
}
