// 候选日常简历编辑的来路与退出（合同 A，Spec §5.2）。
//
// 页面局部参数，不加应用路由：原列表点击时把「固定来源 + 当前格号 + 本次页面会话标识」
// 记进 history.state，编辑页据此决定「退一格回原列表」还是「安全替换到来源固定路径」。
// 只记这三项 —— 不存业务草稿、不存任意 return URL：深链/刷新拿不到本会话证明时只
// 落到来源白名单里的路径，绝不按 URL 或 state 里的值任意导航。
//
// 退一格需要三件事同时成立：来路写自本页面会话、来源与本次编辑一致、当前格号正好
// 是来源格号 + 1。刷新后是新文档（会话标识变了），state 里的旧证明自动失效 —— 宁可
// 安全替换，也不盲退到外站或把两张列表首页留在历史里。嵌套条目编辑走同页本地子视图
//（不额外 push），所以这里不需要通用多级退栈算法。

import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';

/** 允许的日常编辑来源：resume = 我的简历；intentions = 求职意向管理（仅状态页允许使用）*/
export type 候选编辑来源 = 'resume' | 'intentions';

/** 简历分区（合同 A URL 表 /experience?section=）：Task 2 的消费者 */
export type 简历编辑分区 = 'work' | 'education' | 'skills' | 'certificates';

/** 来源白名单：URL 里其它 from 值一律 null —— 未知来源不进日常分支，也不触发写入 */
const 来源白名单: readonly 候选编辑来源[] = ['resume', 'intentions'];

/** 来源对应的固定落点（路径表；没有来路证明时的安全替换目标）*/
const 来源落点: Record<候选编辑来源, string> = {
  resume: 路径.我的简历,
  intentions: 路径.求职意向管理,
};

/** 读 URL 里的日常编辑来源；缺省或白名单外的值返回 null。 */
export function 读候选编辑来源(search: string): 候选编辑来源 | null {
  const 值 = new URLSearchParams(search).get('from');
  return 来源白名单.find((来源) => 来源 === 值) ?? null;
}

/**
 * 本次页面会话标识：模块求值一次。刷新/新文档必然换一个新值，旧文档写进 history.state
 * 的来路证明因此自动失效（刷新后不盲退）。
 */
const 本次页面会话 = `ce_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

/** history.state 上的来路证明：固定形状，只此三项 */
interface 编辑来路 {
  来源: 候选编辑来源;
  /** 来源页的格号；写来路时拿不到（非 react-router 位置）记 null */
  格号: number | null;
  会话: string;
}

/** 当前格号：react-router 写在 history.state.idx 上（v6/v7 一致，导航钩子同源取法）*/
function 当前格号(): number | null {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === 'number' ? idx : null;
}

/** 原列表点击时交给现有 跳转(url, state)。 */
export function 创建候选编辑来路(来源: 候选编辑来源): unknown {
  const 来路: 编辑来路 = { 来源, 格号: 当前格号(), 会话: 本次页面会话 };
  return 来路;
}

/** 把 location.state 解析成来路证明：形状/白名单/本会话任一不成立 → null（无证明）。*/
function 解析来路(state: unknown): 编辑来路 | null {
  if (typeof state !== 'object' || state === null) return null;
  const 可能 = state as Partial<编辑来路>;
  if (可能.会话 !== 本次页面会话) return null;
  if (typeof 可能.来源 !== 'string' || !来源白名单.includes(可能.来源)) return null;
  if (可能.格号 !== null && 可能.格号 !== undefined && typeof 可能.格号 !== 'number') return null;
  return { 来源: 可能.来源, 格号: 可能.格号 ?? null, 会话: 本次页面会话 };
}

/**
 * 退出日常编辑：三件事同时成立才退一格（回原列表，连续编辑两次后返回也正确）；
 * 其余（刷新/深链/越级/来源不符）一律替换到来源固定路径 —— 不退外站，也不留下
 * 两张列表首页。保存成功与取消共用这一份出口。
 */
export function use候选编辑退出(来源: 候选编辑来源): () => void {
  const { 返回, 替换跳转 } = use导航();
  const 位置 = useLocation();
  const 来路 = 解析来路(位置.state);
  // 只留两个原始值做依赖：退出回调在两次渲染间保持同一身份
  const 匹配格号 = 来路 !== null && 来路.来源 === 来源 ? 来路.格号 : null;
  return useCallback(() => {
    if (匹配格号 !== null && 当前格号() === 匹配格号 + 1) {
      返回();
      return;
    }
    替换跳转(来源落点[来源]);
  }, [匹配格号, 返回, 替换跳转, 来源]);
}
