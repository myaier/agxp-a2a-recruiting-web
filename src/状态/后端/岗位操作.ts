// 后端岗位域操作：发布 / 更新 / 归档 / 重开 / 删除岗位。
// 从 应用状态提供者 的 useMemo 操作体按真实后端 owner 拆出，行为逐字保持：
// 写锁 / 409 + 503 重读岗位 / 401 统一清理 / revision 全部原样。接口失败绝不回退 Mock。

import { BFF错误 } from '../../数据/HTTP客户端';
import type { 后端操作依赖, 岗位操作 } from './类型';
import { 清账号状态 } from './会话操作';

export function 创建岗位操作(deps: 后端操作依赖): 岗位操作 {
  const { 是后端, 后端, 派发, 设后端状态, 后端状态引用, 锁, 主体标识引用, 会话代际 } = deps;
  // P4 Task 3 fix：三个 P4 引用随行 —— 岗位 401 的统一清理同样清 discovery 双 Map 与可见范围
  const 账号清理依赖 = {
    派发, 设后端状态, 后端, 主体标识引用, 会话代际,
    P4范围代际: deps.P4范围代际, P4幂等意图: deps.P4幂等意图, P4可见范围: deps.P4可见范围,
    候选预填代际: deps.候选预填代际, 候选预填读取锁: deps.候选预填读取锁, 候选预填恢复: deps.候选预填恢复,
  };

  /**
   * 岗位写操作错误处理：
   *   401 清会话（与 处理写入错误 同口径，但不派发 Mock 岗位 action）；
   *   409 version_conflict / 503 operation_outcome_unknown 最终仍不确定时，调 读取岗位() 重新水合，
   *     让岗位列表落回服务端最新值，避免本地乐观值覆盖冲突后的真实状态；
   *   其余原样抛出。
   * 不派发 Mock 岗位 action（发布岗位/停止招聘/重开岗位/删除岗位），不播种起步候选。
   */
  /**
   * @param 仍有效 发起时捕获的栅栏（发布路径传入）：过时的 401 不清新会话，
   *   过时的 409/503 权威重读也不落进新主体的状态。其余调用方不传即恒有效（行为原样）。
   */
  async function 处理岗位写入错误(错误: unknown, 仍有效: () => boolean = () => true): Promise<never> {
    if (错误 instanceof BFF错误) {
      if (错误.status === 401) {
        // review-r3 R3-I-2：岗位 401 收口到 清账号状态，三个支持域 + 草稿一起清
        // （旧实现只清岗位，把简历/意向快照与意向草稿留给下一个登录）
        if (仍有效()) 清账号状态(账号清理依赖);
        throw 错误;
      }
      if ((错误.status === 409 || 错误.status === 503) && 仍有效()) {
        const 快照 = await 后端!.读取岗位();
        if (仍有效()) {
          派发({ 型: '水合后端岗位', 快照 });
          设后端状态((旧) => ({ ...旧, 岗位快照: 快照.服务端 }));
        }
      }
    }
    throw 错误;
  }

  return {
    async 发布岗位(job) {
      if (!是后端 || !后端) {
        派发({ 型: '发布岗位', 岗: job });
        return null; // Mock 没有服务端 ID：调用方据此走原有 Mock 导航
      }
      const 键 = '岗位:new';
      if (锁.current.has(键)) return null; // 同操作已在飞：本次没执行，不是成功
      锁.current.add(键);
      // 发起时刻捕获主体／角色／会话代际：结算时重新取当前值会让迟到成功冒充新主体
      const 本次主体 = 主体标识引用.current;
      const 本次角色 = 后端状态引用.current.主体?.last_used_role ?? null;
      const 本次代际 = 会话代际.current;
      const 仍有效 = () => 主体标识引用.current === 本次主体
        && (后端状态引用.current.主体?.last_used_role ?? null) === 本次角色
        && 会话代际.current === 本次代际;
      try {
        // Task 7：create 直接用 类别引用/地点引用 取 ID，不再按需取目录。
        // 2026-09-13 合同 C：创建上下文由本次 job 内的 发布模式/发布方企业编号/用人企业编号
        // 三字段构建 —— 前端新建模式只有 direct；缺 ref / direct 两 ref 不相等由
        // 转岗位创建 在发请求前拒绝。名片 / 关系列表 / 未认证公司声明不再参与发岗，
        // claim 由服务端从 hiring_organization_ref 快照生成；附属数据（加分关键词/
        // 实习转正）由数据层用响应里的真实 job_id 写入；水合只派发服务端岗位列表。
        const 快照 = await 后端.创建岗位(job, {
          publisherMode: job.发布模式 ?? 'direct',
          publisherOrganizationRef: job.发布方企业编号 ?? '',
          hiringOrganizationRef: job.用人企业编号 ?? '',
        });
        // 迟到成功不污染新主体：只有捕获栅栏仍有效才水合并把真实 ID 交给页面
        if (!仍有效()) return null;
        派发({ 型: '水合后端岗位', 快照 });
        设后端状态((旧) => ({ ...旧, 岗位快照: 快照.服务端 }));
        return 快照.创建岗位编号;
      } catch (错误) {
        // 处理岗位写入错误 的返回类型是 never（恒抛）：这里显式 return 只为满足
        // try/catch/finally 的控制流推导，运行时到不了。
        return await 处理岗位写入错误(错误, 仍有效);
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
        // 合同 C：更新不接坐标上下文 —— 转岗位补丁 仅将用户实际改变的 refs 进补丁，
        // 不读 名片/关系/未认证公司声明，未改公司时补丁不带 refs/mode/claim。
        const 快照 = await 后端.更新岗位(job, 原始);
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