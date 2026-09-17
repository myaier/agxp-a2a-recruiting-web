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
import { 从P5详情取对方资料, 非空 } from '../消息列表展示/会话资料映射';
import type { 会话资料状态 } from '../消息列表展示/会话资料映射';
import type { BFFCandidateJob, BFF公开企业 } from '../../数据/BFF契约';
import type { P7角色, P7会话项 } from '../../数据/招聘数据源/真人会话';

/** 同时运行的 Case 补读任务上限（spec §2：最多 4 个并发）。 */
const 最大并发 = 4;

/** 轮内任务态：pending = 在飞；完成 = 链路已结算（成败由快照反应式判读）。 */
type 任务态 = 'pending' | '完成';

/**
 * 轮内链路记录（引用同步突变，随轮键整体重置）：case 已发起集合防同轮/重放重复
 * 发起；在飞Case 是并发上限的发起侧真相（state 只是镜像 —— StrictMode 同一 commit
 * 内 effect 双执行时，第二遍看到的 任务表 仍是旧的，只有 ref 先于渲染更新）。
 * 岗位/企业 结算不在这里 —— 它们进 轮 state（见 轮状态）：浏览器里 store 更新是
 * 不可变替换，await 结算早于渲染提交，ref 侧永远读到旧对象（Task 6 浏览器接线反例）。
 */
interface 轮链 {
  键: string;
  已发起Case: Set<string>;
  在飞Case: Set<string>;
  已发起岗位: Set<string>;
  已发起企业: Set<string>;
}

function 新轮链(键: string): 轮链 {
  return {
    键,
    已发起Case: new Set(),
    在飞Case: new Set(),
    已发起岗位: new Set(),
    已发起企业: new Set(),
  };
}

/** 岗位/企业结算与「等企业」任务：进 state 让企业发起与行资料按渲染期快照消费。
 *  等企业[caseId] = jobRef：Case 已读、岗位已结算的候选任务在此等链路收口（同 jobRef
 *  的多个 case 共享同一份岗位/企业结算），完成由企业 effect 落账。 */
interface 轮状态 {
  键: string;
  任务: Record<string, 任务态>;
  岗位: Record<string, 'ok' | '失败'>;
  企业: Record<string, 'ok' | '失败'>;
  等企业: Record<string, string>;
}

function 新轮状态(键: string): 轮状态 {
  return { 键, 任务: {}, 岗位: {}, 企业: {}, 等企业: {} };
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
  const [轮, 设轮] = useState<轮状态>(() => 新轮状态(轮键));
  if (轮.键 !== 轮键) 设轮(新轮状态(轮键));

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
    const jobRef = 条.context?.jobRef ?? null;
    if (角色 !== 'candidate' || jobRef === null) {
      // 链路到此为止：完成即释放在飞占位（换轮后的新记录不含本 case，绝不动新轮占位）
      链引用.current.在飞Case.delete(caseId);
      改任务(键, caseId, '完成');
      return;
    }
    if (!链引用.current.已发起岗位.has(jobRef)) {
      链引用.current.已发起岗位.add(jobRef);
      let 结算: 'ok' | '失败' = '失败';
      try {
        await 操作.读取候选岗位详情(jobRef, true);
        结算 = 'ok';
      } catch {
        // 结算进 state：企业发起按渲染期快照反应式续链
      }
      if (链引用.current.键 !== 键) return;
      设轮((旧) => (旧.键 === 键 ? { ...旧, 岗位: { ...旧.岗位, [jobRef]: 结算 } } : 旧));
    }
    // 等企业链路：本任务交由企业 effect 按渲染期快照收口（完成/失败各一处落账），
    // 不在 await 后读 ref 旧对象解析坐标 —— 那在浏览器不可变替换下永远是旧值。
    设轮((旧) => (旧.键 === 键 && 旧.等企业[caseId] === undefined
      ? { ...旧, 等企业: { ...旧.等企业, [caseId]: jobRef } }
      : 旧));
  }, [角色, 操作, 改任务]);

  // 企业轮（渲染期驱动）：等企业任务按「当前渲染快照」解析发布方编号并发起企业读；
  // 岗位失败收口本任务，企业 ok 收口全部同链任务。编号尚未随快照换代时本轮不发起，
  // effect 随 后端状态/轮 复跑 —— 绝不按 await 时刻的 ref 旧对象读坐标，也绝不按
  // 上一轮旧缓存坐标发企业读。
  useEffect(() => {
    if (角色 !== 'candidate' || 轮.键 !== 轮键) return;
    const 链 = 链引用.current;
    const 收口集: string[] = [];
    for (const [caseId, jobRef] of Object.entries(轮.等企业)) {
      const 岗位结算 = 轮.岗位[jobRef];
      if (岗位结算 === undefined) continue; // 同 jobRef 首任务仍在飞
      if (岗位结算 === '失败') {
        // 链路到此为止：任务收口（资料是否可用由快照判读），坐标留给 重试失败 定向摘除
        收口集.push(caseId);
        continue;
      }
      const 编号 = 取发布方编号(后端状态, jobRef);
      if (编号 === null) {
        // 岗位结算没带出可用坐标（读取未落账 / 404 不可用 / 无发布方）：链路终局，
        // 企业留空 —— 结算与岗位 DTO 同批提交，这里不会再等来新坐标
        收口集.push(caseId);
        continue;
      }
      const 企业结算 = 轮.企业[编号];
      if (企业结算 === 'ok' || 企业结算 === '失败') {
        // ok = 链路收口；失败 = 链路终局（行按 Case 快照可用、企业留空 —— 与旧链
        // 「失败即完成」同语义，不把行吊死在 loading）
        收口集.push(caseId);
        continue;
      }
      if (链.已发起企业.has(编号)) continue; // 在飞：等结算落地再收口
      链.已发起企业.add(编号);
      void 操作.读取公开企业(编号).then(
        () => 设轮((旧) => (旧.键 === 轮键 ? { ...旧, 企业: { ...旧.企业, [编号]: 'ok' } } : 旧)),
        () => 设轮((旧) => (旧.键 === 轮键 ? { ...旧, 企业: { ...旧.企业, [编号]: '失败' } } : 旧)),
      );
    }
    if (收口集.length > 0) {
      for (const caseId of 收口集) 链.在飞Case.delete(caseId);
      设轮((旧) => {
        if (旧.键 !== 轮键) return 旧;
        const 任务 = { ...旧.任务 };
        const 等企业 = { ...旧.等企业 };
        for (const caseId of 收口集) {
          任务[caseId] = '完成';
          delete 等企业[caseId];
        }
        return { ...旧, 任务, 等企业 };
      });
    }
  }, [角色, 轮, 轮键, 后端状态, 操作]);

  // 调度：换轮先重置链记录；同轮补齐在飞槽位（≤ 4 个）。空位以 在飞Case（ref 侧
  // 真相）计数 —— StrictMode 同一 commit 内 effect 双执行时第二遍也看得到首批占位；
  // 翻页新 caseId 自然续排（items 换代 → 可补项 换代 → effect 复跑，成功旧项经任务表
  // 拦下不重拉）。
  useEffect(() => {
    if (链引用.current.键 !== 轮键) 链引用.current = 新轮链(轮键);
    if (轮.键 !== 轮键) return;
    let 空位 = 最大并发 - 链引用.current.在飞Case.size;
    for (const 条 of 可补项) {
      if (空位 <= 0) break;
      if (轮.任务[条.caseId] !== undefined || 链引用.current.已发起Case.has(条.caseId)) continue;
      链引用.current.已发起Case.add(条.caseId);
      链引用.current.在飞Case.add(条.caseId);
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
          ? 取发布企业名({ 后端状态, 状态 }, 条, 轮.岗位, 轮.企业)
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

  // 显式重试：只摘当前仍失败的 case（opaque id 走集合，不拼键串）；链路坐标只定向
  // 摘除「失败」结算 —— 成功坐标（ok）必须保留，否则资料表 memo 因轮变化立即重算，
  // 无差别 clear 会把其他成功行的发布企业名一并抹成 null。成功项不重拉；换轮后旧的
  // 重试闭包经轮键核对变成无操作。
  const 失败集 = useMemo(
    () => new Set(可补项.filter((条) => 资料表[条.caseId]?.状态 === 'unavailable')
      .map((条) => 条.caseId)),
    [可补项, 资料表],
  );
  const 重试失败 = useCallback(() => {
    if (失败集.size === 0 || 轮.键 !== 轮键) return;
    const 链 = 链引用.current;
    for (const caseId of 失败集) 链.已发起Case.delete(caseId);
    const 岗位摘除 = Object.entries(轮.岗位).filter(([, 结算]) => 结算 === '失败').map(([编号]) => 编号);
    const 企业摘除 = Object.entries(轮.企业).filter(([, 结算]) => 结算 === '失败').map(([编号]) => 编号);
    for (const jobRef of 岗位摘除) 链.已发起岗位.delete(jobRef);
    for (const 编号 of 企业摘除) 链.已发起企业.delete(编号);
    设轮((旧) => {
      if (旧.键 !== 轮键) return 旧;
      const 任务 = { ...旧.任务 };
      const 等企业 = { ...旧.等企业 };
      const 岗位 = { ...旧.岗位 };
      const 企业 = { ...旧.企业 };
      for (const caseId of 失败集) {
        delete 任务[caseId];
        delete 等企业[caseId];
      }
      for (const jobRef of 岗位摘除) delete 岗位[jobRef];
      for (const 编号 of 企业摘除) delete 企业[编号];
      return { ...旧, 任务, 等企业, 岗位, 企业 };
    });
  }, [失败集, 轮键, 轮]);

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
 * 绝不透出上一轮旧缓存坐标或旧企业名。结算表来自 轮 state（渲染期新鲜，见 轮状态）。
 */
function 取发布企业名(快照: {
  后端状态: { 候选岗位详情: Record<string, BFFCandidateJob>; 候选岗位不可用: string[] };
  状态: { 公开企业表: Record<string, BFF公开企业>; 不可用公开企业编号: string[] };
}, 条: P7会话项, 岗位结算: Record<string, 'ok' | '失败'>, 企业结算: Record<string, 'ok' | '失败'>): string | null {
  const jobRef = 条.context?.jobRef;
  if (jobRef == null || 岗位结算[jobRef] !== 'ok') return null;
  const 编号 = 取发布方编号(快照.后端状态, jobRef);
  if (编号 === null) return null;
  if (企业结算[编号] !== 'ok') return null;
  if (快照.状态.不可用公开企业编号.includes(编号)) return null;
  return 非空(快照.状态.公开企业表[编号]?.display_name ?? null);
}
