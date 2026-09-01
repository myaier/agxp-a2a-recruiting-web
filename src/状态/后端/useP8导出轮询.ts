// 页面域 P8 数据导出轮询钩子（Task 5）：账号安全页导出抽屉的节拍器。
// spec §7.4：打开/重新可见立即 GET；仍 queued/running 时依次等待 2、4、8 秒，之后
// 以 10 秒为上限继续；状态变化或重新可见重置退避；关闭弹层/卸载/隐藏标签页只停
// 前端计时（服务端任务继续）；ready/failed/expired 停表；同拍绝不重叠请求。
// 依赖全部显式注入（refresh / visibility 经 ref 读最新值），绝不读 Context、
// 不持有任何快照 —— 会话/范围栅栏与快照提交归操作层（P8控制面操作.ts）所有。

import { useEffect, useRef } from 'react';
import type { P8DataExport } from '../../数据/招聘数据源/P8控制面';

/** 退避序列（spec §7.4 冻结）：2s → 4s → 8s，之后 10s 封顶。 */
const 退避序列毫秒 = [2_000, 4_000, 8_000] as const;
const 封顶毫秒 = 10_000;

export function useP8导出轮询(input: {
  enabled: boolean;
  exportId: string | null;
  status: P8DataExport['status'] | null;
  refresh: () => Promise<void>;
  visibility?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
}): void {
  // refresh / visibility 是每次渲染的新引用：节拍回调一律走 ref 读最新值，不进依赖。
  const 刷新引用 = useRef(input.refresh);
  刷新引用.current = input.refresh;
  const 可见源引用 = useRef(input.visibility);
  可见源引用.current = input.visibility;

  // 周期代际：cleanup 时 +1，旧周期（关闭/卸载/换坐标）的迟到完成不再安排任何后续工作。
  const 周期 = useRef(0);

  // ready/failed/expired 是终态停表；status 未知（null，恢复读未落）照常轮询直到得知状态。
  const 仍在生成 = input.status === null || input.status === 'queued' || input.status === 'running';
  const 应轮询 = input.enabled && input.exportId !== null && 仍在生成;

  useEffect(() => {
    if (!应轮询) return;
    const 可见源 = 可见源引用.current ?? document;
    const 本周期 = ++周期.current;
    let 在飞 = false;
    let 计时: number | null = null;
    let 步 = 0;
    const 可见 = () => 可见源.visibilityState === 'visible';
    const 清表 = () => {
      if (计时 !== null) {
        window.clearTimeout(计时);
        计时 = null;
      }
    };
    /** 一拍：在飞期间绝不并发第二发；单拍失败吞掉（错误态由操作层快照承载）。 */
    const 发拍 = (): Promise<void> => {
      if (在飞 || !可见()) return Promise.resolve();
      在飞 = true;
      return 刷新引用.current().catch(() => undefined).finally(() => {
        在飞 = false;
      });
    };
    const 排拍 = () => {
      清表(); // 恒先清旧表：可见性恢复与迟到收口竞态时绝不留双表
      if (本周期 !== 周期.current || !可见()) return;
      const 延迟 = 步 < 退避序列毫秒.length ? 退避序列毫秒[步] : 封顶毫秒;
      计时 = window.setTimeout(() => {
        计时 = null;
        void 发拍().then(() => {
          if (本周期 !== 周期.current) return; // 旧周期：不安排任何后续工作
          if (步 < 退避序列毫秒.length) 步 += 1;
          排拍();
        });
      }, 延迟);
    };
    void 发拍(); // 打开/重新起拍：立即一拍
    排拍();
    const 见可见性 = () => {
      if (本周期 !== 周期.current) return;
      if (可见()) {
        步 = 0; // 重新可见：重置退避 + 立即一拍
        void 发拍();
        排拍();
      } else {
        清表(); // 隐藏：只停前端计时，服务端任务继续
      }
    };
    可见源.addEventListener('visibilitychange', 见可见性);
    return () => {
      清表();
      可见源.removeEventListener('visibilitychange', 见可见性);
      周期.current += 1;
    };
    // 显式依赖：开关 / 导出 ID / 状态（状态变化即重置退避重开周期）。
  }, [应轮询, input.exportId, input.status]);
}
