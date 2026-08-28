// P2 Task 4：页面可见期的附件简历刷新钩子（设计 §9）。
// 只负责 immediate refresh、settle 后 3 秒 setTimeout 轮询和清理，不拥有另一份列表。
// 会话生命周期与 active 调度拆成两个 effect：
//   · session effect 只依赖 可运行/subject，负责唯一 immediate GET、visibility 监听与清理；
//   · active effect 只调 controller 的 同步active，绝不直接 GET —— active 翻转不产生
//     第二次 immediate GET，false→true 只排 3 秒 timer。
// inFlightRef 位于 effect 外：active 翻转或 session effect 重跑时仍是同一个单飞标志。
// 轮询待排 与 待立即刷新 是两个独立等待信号，visibility 的 immediate 意图优先：
// 在飞期间回到 visible 会登记「settle 后立即刷新」，owner 的 finally 让位、不消费它。
// 页面显式动作负责提示；轮询静默吞错、保留最后成功快照，不连续 toast。

import { useEffect, useRef } from 'react';
import { use应用状态 } from '../状态/应用状态';

export function use附件简历刷新(启用 = true): void {
  const { 数据源模式, 后端状态, 操作 } = use应用状态();
  const active = 后端状态.附件简历库?.items.some((item) =>
    item.current_version.parse.status === 'pending' || item.current_version.parse.status === 'processing') ?? false;
  const 可运行 = 启用 && 数据源模式 === 'backend' && 后端状态.已登录 &&
    后端状态.主体?.last_used_role === 'candidate';
  const 操作引用 = useRef(操作);
  操作引用.current = 操作;
  const activeRef = useRef(active);
  activeRef.current = active;
  const inFlightRef = useRef<Promise<void> | null>(null);
  const controllerRef = useRef<{ 同步active: (value: boolean) => void } | null>(null);

  useEffect(() => {
    if (!可运行) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let 轮询待排 = false;
    let 待立即刷新 = false;
    let 已监听的在飞请求: Promise<void> | null = null;
    const clear = () => { if (timer !== null) clearTimeout(timer); timer = null; };
    const schedule = () => {
      clear();
      if (stopped || !activeRef.current || document.visibilityState !== 'visible') return;
      if (inFlightRef.current) { 轮询待排 = true; return; }
      timer = setTimeout(() => { void 执行刷新(); }, 3000);
    };
    const 执行刷新 = async () => {
      clear();
      if (stopped || document.visibilityState !== 'visible' || inFlightRef.current) return;
      const request = 操作引用.current.刷新附件简历();
      inFlightRef.current = request;
      try { await request; } catch { /* 页面显式动作负责提示；轮询静默 */ }
      finally {
        if (inFlightRef.current === request) inFlightRef.current = null;
        if (stopped || 待立即刷新) return; // immediate waiter 在同一 promise settle 后接管
        if (轮询待排 || activeRef.current) { 轮询待排 = false; schedule(); }
      }
    };
    const immediate = () => {
      clear();
      if (stopped || document.visibilityState !== 'visible') return;
      const existing = inFlightRef.current;
      if (!existing) { void 执行刷新(); return; }
      待立即刷新 = true;
      if (已监听的在飞请求 === existing) return;
      已监听的在飞请求 = existing;
      void existing.catch(() => undefined).finally(() => {
        if (已监听的在飞请求 === existing) 已监听的在飞请求 = null;
        if (stopped || !待立即刷新 || document.visibilityState !== 'visible') return;
        待立即刷新 = false;
        void 执行刷新();
      });
    };
    const visibility = () => {
      clear();
      if (document.visibilityState === 'visible') immediate();
      else 待立即刷新 = false;
    };
    controllerRef.current = {
      同步active(value) { activeRef.current = value; if (value) schedule(); else { 轮询待排 = false; clear(); } },
    };
    document.addEventListener('visibilitychange', visibility);
    immediate();
    return () => {
      stopped = true; clear(); controllerRef.current = null;
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [可运行, 后端状态.主体?.subject_id]);

  useEffect(() => { controllerRef.current?.同步active(active); }, [active]);
}
