// 页面域 MatchCase 轮询钩子（P5 Task 3）：双端共用的可见性节拍器。
// spec §10.3：open 列表每 5 秒重读已载窗口、open 详情每 3 秒权威重读，且只在
// document 可见时才真正发请求：
//   · 只在 开启 且对应范围在场时排 interval —— 绝不在根 Provider 建永久 interval；
//   · 隐藏标签页（visibilityState !== 'visible'）当拍跳过，恢复可见后节拍照常；
//   · 卸载 / 开启 翻 false / 列表或详情 scope 变化 / 详情终局 即清表并重开周期；
//   · 同一目标在飞期间绝不并发第二发（ref 在途表，finally 删除）；
//   · 单拍失败吞掉（错误态由操作层快照承载，页面给重试），下一拍照常重试，
//     绝不产生未处理 rejection；401 归操作层统一清理，这里不做暂停表。
// 会话/范围栅栏与快照提交归 操作层（MatchCase操作.ts 的 刷新工作区/刷新历史/读取详情）
// 所有，本钩子只持节拍与在途表，不持有任何快照。

import { useEffect, useRef } from 'react';
import type { P5角色 } from '../../数据/BFF契约';

/** 列表轮询的一笔范围：role + 角色专属过滤（candidate=意向 / recruiter=岗位）。 */
export interface P5可轮询列表 {
  role: P5角色;
  filterRef: string | null;
}

/** 详情轮询的一笔范围：role + URL case_id（与列表记忆无关）。 */
export interface P5可轮询详情 {
  role: P5角色;
  caseId: string;
}

/** 冻结的节拍间隔（spec §10.3）：open 列表 5 秒、open 详情 3 秒。 */
const 列表间隔毫秒 = 5_000;
const 详情间隔毫秒 = 3_000;

export function useMatchCase轮询(input: {
  开启: boolean;
  /** 当前可见的列表范围；null = 该屏没有列表节拍。 */
  列表: P5可轮询列表 | null;
  /** 当前可见的详情范围；null = 该屏没有详情节拍。 */
  详情: P5可轮询详情 | null;
  /** 详情终局（ended/completed）：详情表立即停，列表表不受影响。 */
  详情终局: boolean;
  刷新列表: (范围: P5可轮询列表) => Promise<void>;
  刷新详情: (范围: P5可轮询详情) => Promise<void>;
  列表间隔毫秒?: number;
  详情间隔毫秒?: number;
}): void {
  // 页面对象/刷新函数是派生对象，每次渲染都是新引用：interval 回调一律走 ref 读最新值，
  // effect 只依赖两个稳定标量键（范围串 + 开关），避免每次渲染重建 interval 打乱节拍。
  const 列表引用 = useRef(input.列表);
  列表引用.current = input.列表;
  const 详情引用 = useRef(input.详情);
  详情引用.current = input.详情;
  const 刷新列表引用 = useRef(input.刷新列表);
  刷新列表引用.current = input.刷新列表;
  const 刷新详情引用 = useRef(input.刷新详情);
  刷新详情引用.current = input.刷新详情;
  const 列表间隔引用 = useRef(input.列表间隔毫秒);
  列表间隔引用.current = input.列表间隔毫秒;
  const 详情间隔引用 = useRef(input.详情间隔毫秒);
  详情间隔引用.current = input.详情间隔毫秒;

  const 列表键 = input.列表 === null ? null : `${input.列表.role}|${input.列表.filterRef ?? ''}`;
  const 详情键 = input.详情 === null ? null : `${input.详情.role}|${input.详情.caseId}`;

  // 在途表：同一目标同时最多一发；新周期起跑时整表重建。
  const 列表在途 = useRef(false);
  const 详情在途 = useRef(false);
  // 轮询周期代际：cleanup 时 +1，让上一周期的迟到完成不再安排后续工作。
  const 周期 = useRef(0);

  useEffect(() => {
    if (!input.开启) return;
    列表在途.current = false;
    详情在途.current = false;
    const 本周期 = ++周期.current;
    /** §10.3 可见栅栏：隐藏标签页当拍跳过，恢复可见后节拍照常。 */
    const 可见 = () => document.visibilityState === 'visible';
    let 列表计时 = 0;
    let 详情计时 = 0;
    if (列表键 !== null) {
      列表计时 = window.setInterval(() => {
        const 范围 = 列表引用.current;
        if (范围 === null || 列表在途.current || !可见()) return;
        列表在途.current = true;
        // 操作层拥有栅栏与快照提交；这里的失败只吞掉等下一拍（未处理 rejection 会让测试失败）。
        void 刷新列表引用.current(范围)
          .catch(() => undefined)
          .finally(() => {
            if (周期.current === 本周期) 列表在途.current = false;
          });
      }, 列表间隔引用.current ?? 列表间隔毫秒);
    }
    if (详情键 !== null && !input.详情终局) {
      详情计时 = window.setInterval(() => {
        const 范围 = 详情引用.current;
        if (范围 === null || 详情在途.current || !可见()) return;
        详情在途.current = true;
        void 刷新详情引用.current(范围)
          .catch(() => undefined)
          .finally(() => {
            if (周期.current === 本周期) 详情在途.current = false;
          });
      }, 详情间隔引用.current ?? 详情间隔毫秒);
    }
    return () => {
      if (列表计时 !== 0) window.clearInterval(列表计时);
      if (详情计时 !== 0) window.clearInterval(详情计时);
      周期.current += 1; // 旧页面/旧周期：不安排任何后续工作
      列表在途.current = false;
      详情在途.current = false;
    };
    // 范围键 / 终局 / 开关 变化即结束本周期并按新配置重开；间隔以 ref 读最新值不进依赖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.开启, 列表键, 详情键, input.详情终局]);
}
