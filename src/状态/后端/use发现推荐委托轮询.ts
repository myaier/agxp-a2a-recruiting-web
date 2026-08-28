// 页面域委托轮询钩子（P4 Task 5）：发现推荐双端共用的节拍器。
// 设计 §8.3：页面挂载且委托进行中（accepted/evaluating）时，每 2 秒对当前可见委托单项 GET：
//   · 只在 开启 时排一个 interval —— 绝不在根 Provider 建永久 interval，
//     重新进入页面由推荐卡的委托摘要恢复；
//   · 每个委托同时最多一个在飞 GET（ref 里的 Set<string> 在途表，finally 里删除）；
//   · terminal 委托由操作层提交后从页面 selector 摘除，天然不再发 GET；
//   · 同一委托连续 5 次非 401 失败：进暂停表（本周期内跳过），页面用它把进行中标签覆盖成
//     P4委托进度未知文案 —— 绝不伪造终态回执；一次成功只把该委托的计数清零；
//   · 401 属会话失效，由操作层的统一 清账号状态 收口，绝不变成这里的暂停标记；
//   · 卸载 / 开启 翻 false / 页面 scope 变化即清 interval、在途表、计数与暂停表，并翻转
//     周期代际：旧周期（旧页面、旧 scope）的迟到完成只落在途清理；重进页面或换 scope
//     都从一张干净的计数表起跑（§8.3：unmount、role/subject/scope 变化立即停止并增代）。
// 会话/范围栅栏与终态提交归 操作层（发现推荐操作.ts 的 刷新委托）所有，
// 本钩子只负责节拍、单飞与失败上界，不持有任何快照。

import { useEffect, useRef, useState } from 'react';
import type { BFF角色 } from '../../数据/BFF契约';
import { BFF错误 } from '../../数据/HTTP客户端';

/** 默认轮询间隔（与 P6 提案轮询同拍：设计冻结的 2 秒） */
const 默认间隔毫秒 = 2000;

/** 同一委托连续多少次非 401 轮询失败后暂停到本周期结束（§8.3 冻结的 5 次） */
const 连续失败上界 = 5;

/** 页面轮询的一笔进行中委托：只接受 accepted/evaluating，终态由页面 selector 摘除。 */
export interface 可轮询委托 {
  role: BFF角色;
  delegationId: string;
  state: 'accepted' | 'evaluating';
}

/** 轮询连续失败后页面覆盖「已接手」标签用的中性文案（绝不伪造成终态回执）。 */
export const P4委托进度未知文案 = '暂时无法确认进度，请稍后刷新';

export function use发现推荐委托轮询(input: {
  开启: boolean;
  委托: 可轮询委托[];
  刷新: (role: BFF角色, delegationId: string) => Promise<void>;
  /**
   * 页面当前 scope 坐标（意向编号 / 岗位编号 / 详情键）。变化即结束本轮询周期并重开：
   * 连续失败计数与暂停表绝不跨 scope 存活（§8.3）。页面没有 scope 概念时可不传。
   */
  范围键?: string | null;
  间隔毫秒?: number;
}): ReadonlySet<string> {
  const { 开启, 范围键 = null } = input;
  // 页面数组/刷新函数是派生对象，每次渲染都是新引用：interval 回调一律走 ref 读最新值，
  // effect 只依赖 开启 与 范围键（两个稳定标量），避免每次渲染重建 interval 打乱节拍。
  const 委托引用 = useRef(input.委托);
  委托引用.current = input.委托;
  const 刷新引用 = useRef(input.刷新);
  刷新引用.current = input.刷新;
  const 间隔引用 = useRef(input.间隔毫秒);
  间隔引用.current = input.间隔毫秒;

  // 在途表：同一 delegation 同时最多一个 GET；新周期起跑时整表重建。
  const 在途 = useRef<Set<string>>(new Set());
  // 连续非 401 失败计数：成功一次只清该委托自己的计数。
  const 连续失败 = useRef<Map<string, number>>(new Map());
  // 暂停表：ref 供 interval 回调同步读取，state 副本驱动页面重渲染。
  const 暂停表 = useRef<Set<string>>(new Set());
  const [暂停, 设暂停] = useState<ReadonlySet<string>>(new Set());
  const 加入暂停 = (编号: string) => {
    const 下 = new Set(暂停表.current);
    下.add(编号);
    暂停表.current = 下;
    设暂停(下);
  };
  // 轮询周期代际：cleanup 时 +1，让上一周期的迟到完成不再安排后续工作。
  const 周期 = useRef(0);

  useEffect(() => {
    if (!开启) return;
    在途.current = new Set();
    连续失败.current = new Map();
    暂停表.current = new Set();
    设暂停(new Set());
    const 本周期 = ++周期.current;
    const 计时 = window.setInterval(() => {
      for (const 委托 of 委托引用.current) {
        const 编号 = 委托.delegationId;
        if (暂停表.current.has(编号)) continue; // 本周期已暂停：不再发 GET
        if (在途.current.has(编号)) continue;
        在途.current.add(编号);
        // 操作层的 刷新委托 拥有栅栏/终态提交/401 清理；这里的失败只计节拍，
        // 吞掉等下一拍（unhandled rejection 会让测试失败）。
        void 刷新引用
          .current(委托.role, 编号)
          .then(() => {
            if (周期.current !== 本周期) return; // 旧周期：不碰新周期的计数
            连续失败.current.delete(编号);
          })
          .catch((错误: unknown) => {
            if (周期.current !== 本周期) return;
            // 401 留给统一清理收口，绝不转成暂停标记
            if (错误 instanceof BFF错误 && 错误.status === 401) return;
            const 次数 = (连续失败.current.get(编号) ?? 0) + 1;
            连续失败.current.set(编号, 次数);
            if (次数 >= 连续失败上界) 加入暂停(编号);
          })
          .finally(() => {
            if (周期.current !== 本周期) return; // 旧页面/旧周期：不安排任何后续工作
            在途.current.delete(编号);
          });
      }
    }, 间隔引用.current ?? 默认间隔毫秒);
    return () => {
      window.clearInterval(计时);
      周期.current += 1;
      在途.current = new Set();
      连续失败.current = new Map();
      暂停表.current = new Set();
      设暂停(new Set());
    };
  }, [开启, 范围键]);

  return 暂停;
}
