// 后端岗位域操作：发布 / 更新 / 归档 / 重开 / 删除岗位。
// 从 应用状态提供者 的 useMemo 操作体按真实后端 owner 拆出，行为逐字保持：
// 写锁 / 409 + 503 重读岗位 / 401 统一清理 / revision 全部原样。接口失败绝不回退 Mock。

import { BFF错误 } from '../../数据/HTTP客户端';
import type { 后端操作依赖, 岗位操作 } from './类型';
import { 清账号状态 } from './会话操作';

export function 创建岗位操作(deps: 后端操作依赖): 岗位操作 {
  const { 是后端, 后端, 派发, 设后端状态, 后端状态引用, 状态引用, 锁, 主体标识引用, 会话代际 } = deps;
  const 账号清理依赖 = { 派发, 设后端状态, 后端, 主体标识引用, 会话代际 };

  /**
   * 岗位写操作错误处理：
   *   401 清会话（与 处理写入错误 同口径，但不派发 Mock 岗位 action）；
   *   409 version_conflict / 503 operation_outcome_unknown 最终仍不确定时，调 读取岗位() 重新水合，
   *     让岗位列表落回服务端最新值，避免本地乐观值覆盖冲突后的真实状态；
   *   其余原样抛出。
   * 不派发 Mock 岗位 action（发布岗位/停止招聘/重开岗位/删除岗位），不播种起步候选。
   */
  async function 处理岗位写入错误(错误: unknown): Promise<never> {
    if (错误 instanceof BFF错误) {
      if (错误.status === 401) {
        // review-r3 R3-I-2：岗位 401 收口到 清账号状态，三个支持域 + 草稿一起清
        // （旧实现只清岗位，把简历/意向快照与意向草稿留给下一个登录）
        清账号状态(账号清理依赖);
        throw 错误;
      }
      if (错误.status === 409 || 错误.status === 503) {
        const 快照 = await 后端!.读取岗位();
        派发({ 型: '水合后端岗位', 快照 });
        设后端状态((旧) => ({ ...旧, 岗位快照: 快照.服务端 }));
      }
    }
    throw 错误;
  }

  return {
    async 发布岗位(job) {
      if (!是后端 || !后端) {
        派发({ 型: '发布岗位', 岗: job });
        return;
      }
      const 键 = '岗位:new';
      if (锁.current.has(键)) return;
      锁.current.add(键);
      try {
        // Task 7：create 直接用 类别引用/地点引用 取 ID，不再按需取目录。
        // 附属数据（加分关键词/实习转正）由数据层用响应里的真实 job_id 写入；
        // 水合只派发服务端岗位列表，不派发 Mock 发布岗位（不播种起步候选）。
        const 快照 = await 后端.创建岗位(job, { 公司: 状态引用.current.企业认证.公司 });
        派发({ 型: '水合后端岗位', 快照 });
        设后端状态((旧) => ({ ...旧, 岗位快照: 快照.服务端 }));
      } catch (错误) {
        await 处理岗位写入错误(错误);
      } finally {
        锁.current.delete(键);
      }
    },
    async 更新岗位(job) {
      if (!是后端 || !后端) {
        派发({ 型: '更新岗位', 岗: job });
        return;
      }
      const 键 = `岗位:${job.编号}`;
      if (锁.current.has(键)) return;
      锁.current.add(键);
      try {
        const 原始 = 后端状态引用.current.岗位快照[job.编号];
        if (!原始) return;
        // Task 7：update 的 immutable category/location 取 owner DTO（previous）的 id，
        // 不再按需取目录；If-Match 由数据层用 previous.revision 生成；附属按同 ID 更新。
        const 快照 = await 后端.更新岗位(job, 原始, { 公司: 状态引用.current.企业认证.公司 });
        派发({ 型: '水合后端岗位', 快照 });
        设后端状态((旧) => ({ ...旧, 岗位快照: 快照.服务端 }));
      } catch (错误) {
        await 处理岗位写入错误(错误);
      } finally {
        锁.current.delete(键);
      }
    },
    async 归档岗位(id) {
      if (!是后端 || !后端) {
        派发({ 型: '停止招聘', 编号: id });
        return;
      }
      const 键 = `岗位:${id}`;
      if (锁.current.has(键)) return;
      锁.current.add(键);
      try {
        const 原始 = 后端状态引用.current.岗位快照[id];
        if (!原始) return;
        const 快照 = await 后端.归档岗位(id, 原始.revision);
        派发({ 型: '水合后端岗位', 快照 });
        设后端状态((旧) => ({ ...旧, 岗位快照: 快照.服务端 }));
      } catch (错误) {
        await 处理岗位写入错误(错误);
      } finally {
        锁.current.delete(键);
      }
    },
    async 重开岗位(id) {
      if (!是后端 || !后端) {
        派发({ 型: '重开岗位', 编号: id });
        return;
      }
      const 键 = `岗位:${id}`;
      if (锁.current.has(键)) return;
      锁.current.add(键);
      try {
        const 原始 = 后端状态引用.current.岗位快照[id];
        if (!原始) return;
        const 快照 = await 后端.重开岗位(id, 原始.revision);
        派发({ 型: '水合后端岗位', 快照 });
        设后端状态((旧) => ({ ...旧, 岗位快照: 快照.服务端 }));
      } catch (错误) {
        await 处理岗位写入错误(错误);
      } finally {
        锁.current.delete(键);
      }
    },
    async 删除岗位(id) {
      if (!是后端 || !后端) {
        派发({ 型: '删除岗位', 编号: id });
        return;
      }
      const 键 = `岗位:${id}`;
      if (锁.current.has(键)) return;
      锁.current.add(键);
      try {
        const 原始 = 后端状态引用.current.岗位快照[id];
        if (!原始) return;
        // delete 成功后由数据层删除附属数据；水合只派发服务端岗位列表。
        const 快照 = await 后端.删除岗位(id, 原始.revision);
        派发({ 型: '水合后端岗位', 快照 });
        设后端状态((旧) => ({ ...旧, 岗位快照: 快照.服务端 }));
      } catch (错误) {
        await 处理岗位写入错误(错误);
      } finally {
        锁.current.delete(键);
      }
    },
  };
}