// P7 Task 5：真人会话失效重拉钩子 —— 在 应用状态提供者 挂载一次。
// 与 useMatchCase轮询 同一纪律：本钩子不读 React Context（避免「根组合 ⇄ 域实现」
// 互相调用的模块环），全部输入由 Provider 注入。
// 开启 = Backend + 已登录 + 当前角色是 candidate/recruiter + 页面可见；
// 页面隐藏断开（socket 与重连定时一并关闭），恢复可见重连。
// 帧不携带真相：事件只调 操作.使真人会话失效（作废在飞读）再 no-store 重拉
// 当前角色收件箱；只有正在显示的会话才重拉详情+消息（open/重连后无条件重拉
// 当前角色收件箱与当前可见会话）。Mock 模式零连接。

import { useEffect } from 'react';
import type { 招聘事件源 } from '../../数据/招聘事件源';
import type { 真人会话操作 } from './类型';
import type { 可变引用 } from './类型';
import type { P7角色 } from '../../数据/BFF契约';

export interface 真人会话事件输入 {
  /** 事件源 adapter（Provider 恒注入同一实例；测试注入受控桩）。 */
  事件源: 招聘事件源;
  /** 当前可见会话引用（P7运行时引用.P7可见会话）：决定重拉范围。 */
  可见会话引用: 可变引用<Record<P7角色, string | null>>;
  数据源模式: 'mock' | 'backend';
  已登录: boolean;
  /** 当前主体角色；null / 非 P7 角色不开启连接。 */
  角色: P7角色 | null;
  操作: Pick<真人会话操作, '使真人会话失效' | '加载会话列表' | '读取真人会话'>;
}

export function use真人会话事件(输入: 真人会话事件输入): void {
  const { 事件源, 可见会话引用, 数据源模式, 已登录, 角色, 操作 } = 输入;
  const 有效角色 = 角色 === 'candidate' || 角色 === 'recruiter';

  useEffect(() => {
    if (数据源模式 !== 'backend' || !已登录 || !有效角色 || 角色 === null) return;
    let 断开连接: (() => void) | null = null;

    const 重拉收件箱 = () => {
      void 操作.加载会话列表(角色, true).catch(() => undefined);
    };
    const 重拉可见会话 = () => {
      const 可见 = 可见会话引用.current[角色];
      if (可见 !== null) void 操作.读取真人会话(角色, 可见, true).catch(() => undefined);
    };

    const 确保连接 = () => {
      if (document.visibilityState !== 'visible' || 断开连接 !== null) return;
      断开连接 = 事件源.连接({
        onOpen: () => {
          // 连接成功与每次重连后无条件重拉当前角色收件箱与当前可见会话。
          重拉收件箱();
          重拉可见会话();
        },
        onEvent: (事件) => {
          // 帧只触发失效与重拉；对应会话正在显示时才重拉详情+消息。
          操作.使真人会话失效(角色, 事件.conversationId);
          重拉收件箱();
          if (可见会话引用.current[角色] === 事件.conversationId) {
            void 操作.读取真人会话(角色, 事件.conversationId, true).catch(() => undefined);
          }
        },
      });
    };
    const 确保断开 = () => {
      断开连接?.();
      断开连接 = null;
    };
    const 变更 = () => {
      if (document.visibilityState === 'visible') 确保连接();
      else 确保断开();
    };

    document.addEventListener('visibilitychange', 变更);
    确保连接();
    return () => {
      document.removeEventListener('visibilitychange', 变更);
      确保断开();
    };
    // 角色/登录/模式或操作引用变化时重开；操作 在同一 Provider 内由 useMemo 保持稳定
  }, [数据源模式, 已登录, 有效角色, 角色, 事件源, 可见会话引用, 操作]);
}