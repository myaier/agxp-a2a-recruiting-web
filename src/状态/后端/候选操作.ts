// 后端候选域操作：简历 / 个人优势 / 意向 / 首次意向 / 删除意向 的写入。
// 从 应用状态提供者 的 useMemo 操作体按真实后端 owner 拆出，行为逐字保持：
// 写锁 / 409 权威水合 / 503 重读 / 401 统一清理 / revision 全部原样。接口失败绝不回退 Mock。

import { BFF错误 } from '../../数据/HTTP客户端';
import { 从BFF简历 } from '../../数据/后端映射';
import type { 页面简历快照 } from '../../数据/招聘数据源类型';
import type { 后端操作依赖, 候选操作 } from './类型';
import { 清账号状态 } from './会话操作';

/** 意向草稿 → 求职意向.说明 文案（Mock 分支用，与 添加意向.tsx 提交 的说明格式保持一致）。 */
function 意向说明(draft: import('../../数据/招聘数据源类型').意向草稿型): string {
  const 薪资文本 =
    draft.薪资下限 === null || draft.薪资上限 === null
      ? ''
      : draft.薪资下限 === draft.薪资上限
        ? `${draft.薪资下限}K`
        : `${draft.薪资下限}-${draft.薪资上限}K`;
  const 期望行业文本 = draft.期望行业们.join('、');
  return 期望行业文本 === '' ? 薪资文本 : `${薪资文本}｜${期望行业文本}`;
}

export function 创建候选操作(deps: 后端操作依赖): 候选操作 {
  const { 是后端, 后端, 派发, 设后端状态, 后端状态引用, 状态引用, 锁, 主体标识引用, 会话代际 } = deps;
  // P4 Task 3 fix：三个 P4 引用随行 —— 简历/意向 401 的统一清理同样清 discovery 双 Map 与可见范围
  const 账号清理依赖 = {
    派发, 设后端状态, 后端, 主体标识引用, 会话代际,
    P4范围代际: deps.P4范围代际, P4幂等意图: deps.P4幂等意图, P4可见范围: deps.P4可见范围,
  };

  /** 统一处理写操作错误：401 清会话；409 用错误携带的权威简历水合；其余原样抛出。 */
  function 处理写入错误(错误: unknown): never {
    if (错误 instanceof BFF错误) {
      if (错误.status === 401) {
        // review-r3 R3-I-2：401 收口到 清账号状态，三个支持域 + 草稿 + 目录缓存一起清
        清账号状态(账号清理依赖);
      } else if (错误.权威简历) {
        // 409 版本冲突或任一分区写入中途失败后，catch 路径已 GET 权威快照附在错误上。
        // 统一用它水合本地状态，使重试 diff 基于服务端最新值（避免重复 POST 新条目）。
        // 权威简历 是 BFF简历（生产 HTTP 层 GET 拿到的 DTO）；
        // 测试桩可能直接放已映射的 页面简历快照。两者按 'profile' 字段区分。
        const 权威 = 错误.权威简历;
        const 是原始DTO = 'profile' in 权威;
        const 页面 = 是原始DTO ? 从BFF简历(权威 as never) : 权威 as unknown as 页面简历快照;
        派发({ 型: '水合后端简历', 快照: 页面 });
        设后端状态((旧) => ({ ...旧, 简历快照: 是原始DTO ? (权威 as never) : 旧.简历快照 }));
      }
    }
    throw 错误;
  }

  /**
   * 意向写操作错误处理（镜像 处理岗位写入错误）：
   *   401 清会话（派发 空意向快照，清意向快照）；
   *   409 version_conflict / 503 operation_outcome_unknown 最终仍不确定时，调 读取意向() 重新水合，
   *     让求职意向表落回服务端最新值，避免本地乐观值覆盖冲突后的真实状态
   *     （spec §12：409 版本冲突 → 重新读取对应权威资源，不覆盖服务端新版本）；
   *   其余原样抛出。
   * 简历写操作仍走 处理写入错误（用 错误.权威简历 水合），此处不接管简历路径。
   * 不派发 Mock 意向 action（新增意向/改意向），不播种预置意向。
   */
  async function 处理意向写入错误(错误: unknown): Promise<never> {
    if (错误 instanceof BFF错误) {
      if (错误.status === 401) {
        // review-r3 R3-I-2：意向 401 收口到 清账号状态，三个支持域 + 草稿一起清
        // （旧实现只清意向，把简历/岗位快照与引导预填留给下一个登录）
        清账号状态(账号清理依赖);
        throw 错误;
      }
      if (错误.status === 409 || 错误.status === 503) {
        const 快照 = await 后端!.读取意向();
        派发({ 型: '水合后端意向', 快照 });
        设后端状态((旧) => ({ ...旧, 意向快照: 快照.服务端 }));
      }
    }
    throw 错误;
  }

  return {
    async 保存简历(next) {
      if (!是后端 || !后端) {
        派发({
          型: '存简历',
          经历: next.经历,
          教育: next.教育,
          技能: next.技能,
          证书: next.证书,
          基本信息: next.基本信息,
        });
        派发({ 型: '存个人优势', 文本: next.个人优势 });
        return;
      }
      if (锁.current.has('简历保存')) return;
      锁.current.add('简历保存');
      try {
        let previous = 后端状态引用.current.简历快照;
        if (!previous) {
          const 读出 = await 后端.读取简历();
          previous = 读出.服务端快照;
        }
        const 快照 = await 后端.保存简历(next, previous);
        派发({ 型: '水合后端简历', 快照 });
        设后端状态((旧) => ({ ...旧, 简历快照: 快照.服务端快照 }));
      } catch (错误) {
        处理写入错误(错误);
      } finally {
        锁.current.delete('简历保存');
      }
    },
    async 保存个人优势(text) {
      if (!是后端 || !后端) {
        派发({ 型: '存个人优势', 文本: text });
        return;
      }
      if (锁.current.has('简历保存')) return;
      锁.current.add('简历保存');
      try {
        let previous = 后端状态引用.current.简历快照;
        if (!previous) {
          const 读出 = await 后端.读取简历();
          previous = 读出.服务端快照;
        }
        const 当前页面 = 从BFF简历(previous);
        const 快照 = await 后端.保存简历({ ...当前页面, 个人优势: text }, previous);
        派发({ 型: '水合后端简历', 快照 });
        设后端状态((旧) => ({ ...旧, 简历快照: 快照.服务端快照 }));
      } catch (错误) {
        处理写入错误(错误);
      } finally {
        锁.current.delete('简历保存');
      }
    },
    async 保存意向(draft) {
      if (!是后端 || !后端) {
        const 标题 = `[${draft.工作城市}] ${draft.期望职位}`;
        const 说明 = 意向说明(draft);
        if (draft.编辑编号) 派发({ 型: '改意向', 编号: draft.编辑编号, 标题, 说明 });
        else 派发({ 型: '新增意向', 标题, 说明 });
        return;
      }
      const 键 = draft.编辑编号 ? `意向:${draft.编辑编号}` : '意向:new';
      if (锁.current.has(键)) return;
      锁.current.add(键);
      try {
        // Task 6：目录引用直接落在草稿里（Tasks 3-4），不再按需取目录；
        // 办公方式 从草稿.办公方式 读（必填草稿字段），不再硬编码 ['onsite']。
        const 原始 = draft.编辑编号 ? 后端状态引用.current.意向快照[draft.编辑编号] ?? null : null;
        const 上下文 = { 原始 };
        const 快照 = draft.编辑编号
          ? await 后端.更新意向(draft.编辑编号, draft, 上下文)
          : await 后端.创建意向(draft, 上下文);
        派发({ 型: '水合后端意向', 快照 });
        设后端状态((旧) => ({ ...旧, 意向快照: 快照.服务端 }));
      } catch (错误) {
        await 处理意向写入错误(错误);
      } finally {
        锁.current.delete(键);
      }
    },
    async 保存首次意向(input) {
      if (!是后端 || !后端) {
        // Mock 模式 no-op：保持当前预置意向不增加，防止重复走向导制造重复数据
        return;
      }
      // Backend 仅在当前真实意向列表为空时创建一条，已有意向时 no-op
      if (状态引用.current.求职意向表.length > 0) return;
      const 键 = '意向:new';
      if (锁.current.has(键)) return;
      锁.current.add(键);
      try {
        // Task 6：目录引用直接落在 input 里（引导问答 Backend 分支选中时原子保存），
        // 不再按需取目录；办公方式 从 input.筛选偏好.办公方式 读（向导答案）。
        const 快照 = await 后端.创建首次意向(input);
        派发({ 型: '水合后端意向', 快照 });
        设后端状态((旧) => ({ ...旧, 意向快照: 快照.服务端 }));
      } catch (错误) {
        await 处理意向写入错误(错误);
      } finally {
        锁.current.delete(键);
      }
    },
    async 删除意向(id) {
      if (!是后端 || !后端) {
        派发({ 型: '删意向', 编号: id });
        return;
      }
      const 键 = `意向:${id}`;
      if (锁.current.has(键)) return;
      锁.current.add(键);
      try {
        const 原始 = 后端状态引用.current.意向快照[id];
        if (!原始) return;
        const 快照 = await 后端.删除意向(id, 原始.revision);
        派发({ 型: '水合后端意向', 快照 });
        设后端状态((旧) => ({ ...旧, 意向快照: 快照.服务端 }));
      } catch (错误) {
        await 处理意向写入错误(错误);
      } finally {
        锁.current.delete(键);
      }
    },
  };
}