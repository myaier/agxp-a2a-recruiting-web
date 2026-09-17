// use会话列表资料（Task 2 Step 2）：P7 收件箱列表页的会话资料补读编排。
// 只消费已加载 available P7 项；按 role+caseId 去重；最多 4 个 Case 任务并发；
// 候选端每个任务 = Case 详情(force) →（有 jobRef 时）岗位详情(force) → 发布方公开
// 企业，相同岗位/企业在本次页面轮次去重；翻页只追加新项（成功旧项不重拉）；
// 失败停在局部 unavailable，重试失败() 只重读失败项（不自动重试、不无限重试）。
// 换主体/换角色开新轮：旧轮在飞回执经轮键核对整包作废。不建全局缓存、不注册轮询、
// 不每 render 重拉。
//
// 资料消费是响应式的：任务落地后按「此刻」快照组装（从P5详情取对方资料），P5 拒绝/
// 清空当帧撤下（unavailable），绝不镜像 P5 DTO。新鲜度门槛依赖操作层的同 key 真实
// Promise 复用（读取详情/读取候选岗位详情/读取公开企业，Task 2 Step 3）：await 的
// 结算即真实读取结算；本轮岗位/企业成败记在轮内表上，失败不消费旧缓存坐标/旧企业名。
// 上下文标签（P7 viewer-safe）与匿名代号永不进入 资料 —— 由 消息行映射 的缺省分支
// 承接加载窗口。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { use应用状态 } from '../../状态/应用状态';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { 从P5详情取对方资料 } from '../消息列表展示/会话资料映射';
import type { 会话资料状态 } from '../消息列表展示/会话资料映射';
import type { BFFCandidateJob, BFF公开企业 } from '../../数据/BFF契约';
import type { P7角色, P7会话项 } from '../../数据/招聘数据源/真人会话';

/** 同时运行的 Case 补读任务上限（spec §2：最多 4 个并发）。 */
const 最大并发 = 4;

/** trim 后非空才算已知企业名/坐标；空白不得冒充。 */
function 非空(值: string | null | undefined): string | null {
  const 文 = 值?.trim() ?? '';
  return 文 === '' ? null : 文;
}

/** 轮内任务态：pending = 在飞；完成 = 链路已结算（成败由快照反应式判读）。 */
type 任务态 = 'pending' | '完成';

/**
 * 轮内链路记录（引用同步突变，随轮键整体重置）：case 已发起集合防同轮/重放重复
 * 发起；岗位/企业 成败表只记「本轮真实读取」的结算，失败不消费旧缓存。
 */
interface 轮链 {
  键: string;
  已发起Case: Set<string>;
  岗位: Map<string, 'ok' | '失败'>;
  已发起岗位: Set<string>;
  企业: Map<string, 'ok' | '失败'>;
  已发起企业: Set<string>;
}

function 新轮链(键: string): 轮链 {
  return {
    键,
    已发起Case: new Set(),
    岗位: new Map(),
    已发起岗位: new Set(),
    企业: new Map(),
    已发起企业: new Set(),
  };
}

export function use会话列表资料(角色: P7角色, items: P7会话项[]): {
  资料表: Record<string, 会话资料状态>;
  有失败: boolean;
  重试失败: () => void;
} {
  const { 后端状态, 状态, 操作 } = use应用状态();
  const 主体键 = 后端状态.主体?.subject_id ?? '';
  const 轮键 = `${主体键}:${角色}`;

  // 任务表带轮键：换主体/换角色当帧弃旧轮（React 支持的渲染期状态调整），旧轮的
  // 迟到 写入 经轮键核对整包丢弃。
  const [轮, 设轮] = useState<{ 键: string; 任务: Record<string, 任务态> }>(() => ({
    键: 轮键, 任务: {},
  }));
  if (轮.键 !== 轮键) 设轮({ 键: 轮键, 任务: {} });

  // 最新快照引用：任务链在 await 之后取「此刻」的岗位坐标/企业编号，不用渲染闭包旧值。
  const 快照引用 = useRef({ 后端状态, 状态 });
  快照引用.current = { 后端状态, 状态 };
  const 链引用 = useRef<轮链>(新轮链(轮键));

  const 改任务 = useCallback((键: string, caseId: string, 态: 任务态) => {
    设轮((旧) => (旧.键 === 键 && 旧.任务[caseId] !== 态
      ? { ...旧, 任务: { ...旧.任务, [caseId]: 态 } }
      : 旧));
  }, []);

  // 只补读 available 项；同 caseId 去重（重复行共享同一份资料）。
  const 可补项 = useMemo(() => {
    const 已见 = new Set<string>();
    const 列表: P7会话项[] = [];
    for (const 条 of items) {
      if (条.contextStatus !== 'available' || 条.context === null) continue;
      if (已见.has(条.caseId)) continue;
      已见.add(条.caseId);
      列表.push(条);
    }
    return 列表;
  }, [items]);

  const 运行任务 = useCallback(async (键: string, 条: P7会话项) => {
    const caseId = 条.caseId;
    try {
      await 操作.读取详情(角色, caseId, true);
    } catch {
      // 失败由快照反应式判读（unavailable + 定向重试），这里不吞重抛
    }
    if (链引用.current.键 !== 键) return; // 换轮：旧链不再继续
    if (角色 === 'candidate' && 条.context?.jobRef != null) {
      const jobRef = 条.context.jobRef;
      if (!链引用.current.已发起岗位.has(jobRef)) {
        链引用.current.已发起岗位.add(jobRef);
        try {
          await 操作.读取候选岗位详情(jobRef, true);
          链引用.current.岗位.set(jobRef, 'ok');
        } catch {
          链引用.current.岗位.set(jobRef, '失败');
        }
      }
      if (链引用.current.键 !== 键) return;
      // 本轮岗位真实读取成功才按「此刻」坐标读发布方企业；岗位失败/仍在飞（他任务
      // 发起）都不发起 —— 绝不按上一轮旧缓存坐标发企业读。
      if (链引用.current.岗位.get(jobRef) === 'ok') {
        const 编号 = 取发布方编号(快照引用.current.后端状态, jobRef);
        if (编号 !== null && !链引用.current.已发起企业.has(编号)) {
          链引用.current.已发起企业.add(编号);
          try {
            await 操作.读取公开企业(编号);
            链引用.current.企业.set(编号, 'ok');
          } catch {
            链引用.current.企业.set(编号, '失败');
          }
        }
      }
    }
    改任务(键, caseId, '完成');
  }, [角色, 操作, 改任务]);

  // 调度：换轮先重置链记录；同轮补齐 pending 槽位（≤ 4 个在飞），翻页新 caseId 自然续排
  //（items 换代 → 可补项 换代 → effect 复跑，成功旧项经任务表拦下不重拉）。
  useEffect(() => {
    if (链引用.current.键 !== 轮键) 链引用.current = 新轮链(轮键);
    if (轮.键 !== 轮键) return;
    let 空位 = 最大并发 - Object.values(轮.任务).filter((态) => 态 === 'pending').length;
    for (const 条 of 可补项) {
      if (空位 <= 0) break;
      if (轮.任务[条.caseId] !== undefined || 链引用.current.已发起Case.has(条.caseId)) continue;
      链引用.current.已发起Case.add(条.caseId);
      改任务(轮键, 条.caseId, 'pending');
      空位 -= 1;
      void 运行任务(轮键, 条);
    }
  }, [轮, 轮键, 可补项, 改任务, 运行任务]);

  // 资料表：任务完成 + 本轮成功快照才 available；失败/清空 unavailable；在飞 loading。
  const 资料表 = useMemo(() => {
    const 表: Record<string, 会话资料状态> = {};
    for (const 条 of 可补项) {
      if (轮.任务[条.caseId] !== '完成') {
        表[条.caseId] = { 状态: 'loading', 资料: null };
        continue;
      }
      const 快照 = 后端状态.P5详情[P5范围键.detail(角色, 条.caseId)];
      if (快照 !== undefined && 快照.阶段 === '成功' && !快照.刷新中 &&
        快照.error === null && 快照.detail !== null) {
        const 发布企业名 = 角色 === 'candidate'
          ? 取发布企业名({ 后端状态, 状态 }, 条, 链引用.current)
          : null;
        表[条.caseId] = { 状态: 'available', 资料: 从P5详情取对方资料(快照.detail, 角色, 发布企业名) };
      } else {
        表[条.caseId] = { 状态: 'unavailable', 资料: null };
      }
    }
    return 表;
    // 整体 后端状态/状态 作依赖：任一相关快照（P5详情/岗位/公开企业）换代即重组资料
  }, [可补项, 轮, 角色, 后端状态, 状态]);

  const 有失败 = useMemo(
    () => Object.values(资料表).some((资料) => 资料.状态 === 'unavailable'),
    [资料表],
  );

  // 显式重试：只摘当前仍失败的 case（opaque id 走集合，不拼键串），并清轮内岗位/企业
  // 记录让链路按失败项重读；成功项不重拉。换轮后旧的重试闭包经轮键核对变成无操作。
  const 失败集 = useMemo(
    () => new Set(可补项.filter((条) => 资料表[条.caseId]?.状态 === 'unavailable')
      .map((条) => 条.caseId)),
    [可补项, 资料表],
  );
  const 重试失败 = useCallback(() => {
    if (失败集.size === 0 || 轮.键 !== 轮键) return;
    const 链 = 链引用.current;
    for (const caseId of 失败集) 链.已发起Case.delete(caseId);
    链.岗位.clear();
    链.已发起岗位.clear();
    链.企业.clear();
    链.已发起企业.clear();
    设轮((旧) => {
      if (旧.键 !== 轮键) return 旧;
      const 任务 = { ...旧.任务 };
      for (const caseId of 失败集) delete 任务[caseId];
      return { ...旧, 任务 };
    });
  }, [失败集, 轮键, 轮.键]);

  return { 资料表, 有失败, 重试失败 };
}

/** 此刻快照里的发布方编号：只在岗位条目在场且未标记不可用时给出。 */
function 取发布方编号(快照: {
  候选岗位详情: Record<string, BFFCandidateJob>;
  候选岗位不可用: string[];
}, jobRef: string): string | null {
  if (快照.候选岗位不可用.includes(jobRef)) return null;
  return 非空(快照.候选岗位详情[jobRef]?.publisher_organization_ref ?? null);
}

/**
 * 候选端发布企业名（渲染期纯读）：本轮岗位真实读取成功才消费其坐标，本轮企业真实
 * 读取成功才消费公开企业 display_name —— 任一失败/在飞都给 null（副标题缺企业），
 * 绝不透出上一轮旧缓存坐标或旧企业名。
 */
function 取发布企业名(快照: {
  后端状态: { 候选岗位详情: Record<string, BFFCandidateJob>; 候选岗位不可用: string[] };
  状态: { 公开企业表: Record<string, BFF公开企业>; 不可用公开企业编号: string[] };
}, 条: P7会话项, 链: 轮链): string | null {
  const jobRef = 条.context?.jobRef;
  if (jobRef == null || 链.岗位.get(jobRef) !== 'ok') return null;
  const 编号 = 取发布方编号(快照.后端状态, jobRef);
  if (编号 === null) return null;
  if (链.企业.get(编号) !== 'ok') return null;
  if (快照.状态.不可用公开企业编号.includes(编号)) return null;
  return 非空(快照.状态.公开企业表[编号]?.display_name ?? null);
}
