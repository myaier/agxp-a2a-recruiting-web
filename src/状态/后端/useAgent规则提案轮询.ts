// 页面域提案轮询钩子（P6 Task 5）：双端规则页共用的节拍器。
// 设计 §4.4：页面挂载且提案水合就绪后，对当前可见的 interpreting 提案每 2 秒 GET 单项：
//   · 只在 开启 时排一个 interval —— 绝不在根 Provider 建永久 interval，
//     重新进入页面由提案清单恢复；
//   · 每个提案同时最多一个在飞 GET（ref 里的 Set<string> 在途表，finally 里删除）；
//   · ready/terminal 提案天然被 state 过滤，不再发 GET；
//   · 卸载 / 开启 翻 false 即清 interval，并翻转周期代际：旧页面（旧周期）的
//     迟到完成只落在途清理，不再安排任何后续工作。
// 会话 fence 与 per-Proposal 提案代际都归 操作层（Agent规则操作.ts）所有，
// 本钩子只负责节拍与单飞，不持有任何快照。

import { useEffect, useRef } from 'react';
import type { BFFAgent规则提案 } from '../../数据/BFF契约';

/** 默认轮询间隔（设计 §4.4 冻结的 2 秒） */
const 默认间隔毫秒 = 2000;

export function useAgent规则提案轮询(input: {
  开启: boolean;
  提案: BFFAgent规则提案[];
  刷新: (proposalId: string) => Promise<void>;
  间隔毫秒?: number;
}): void {
  const { 开启 } = input;
  // 页面数组是派生对象，每次渲染都是新引用：interval 回调一律走 ref 读最新值，
  // effect 只依赖 开启，避免每次渲染重建 interval 打乱节拍。
  const 提案引用 = useRef(input.提案);
  提案引用.current = input.提案;
  const 刷新引用 = useRef(input.刷新);
  刷新引用.current = input.刷新;
  const 间隔引用 = useRef(input.间隔毫秒);
  间隔引用.current = input.间隔毫秒;

  // 在途表：同一 proposal 同时最多一个 GET；新周期起跑时整表重建，
  // 旧周期的迟到 finally 由周期代际拦下，不会污染新周期的在途判断。
  const 在途 = useRef<Set<string>>(new Set());
  // 轮询周期代际：cleanup 时 +1，让上一周期的迟到完成不再安排后续工作。
  const 周期 = useRef(0);

  useEffect(() => {
    if (!开启) return;
    在途.current = new Set<string>();
    const 本周期 = ++周期.current;
    const 计时 = window.setInterval(() => {
      for (const 提案 of 提案引用.current) {
        // 只轮 interpreting；ready/terminal 不再发 GET
        if (提案.state !== 'interpreting') continue;
        const 编号 = 提案.proposal_id;
        if (在途.current.has(编号)) continue;
        在途.current.add(编号);
        // 操作层的 刷新Agent规则提案 恢复失败时会抛：轮询吞掉等下一拍，
        // 页面侧错误提示由调用方自己的 await 分支负责。
        void 刷新引用
          .current(编号)
          .catch(() => undefined)
          .finally(() => {
            if (周期.current !== 本周期) return; // 旧页面/旧周期：不安排任何后续工作
            在途.current.delete(编号);
          });
      }
    }, 间隔引用.current ?? 默认间隔毫秒);
    return () => {
      window.clearInterval(计时);
      周期.current += 1;
    };
  }, [开启]);
}
