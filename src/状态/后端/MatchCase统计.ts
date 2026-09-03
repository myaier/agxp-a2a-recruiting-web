// Backend MatchCase 真相源修复：两个“我的”页与相邻展示页共用的纯统计 selector。
// 只读当前 owner 的 unfiltered open scope 快照，按 state.lifecycle / state.stage /
// needs_action 计数；不读 step、状态文案、时间线、昵称或任何 legacy 演示数组。
// 展示约定（spec §A）：读尽给精确 N，分页未尽给下界 N+，空且读尽给 0，
// 未开始/加载中/失败/owner 不匹配一律中性 —，绝不冒充权威零以外的数字。

import type { P5列表快照 } from './类型';

export interface P5Open统计 {
  open: string;
  anonymousScreening: string;
  needsAction: string;
}

export interface P5候选横幅状态 {
  强调: string;
  已载待办数: number;
  读尽: boolean;
}

const 中性统计: P5Open统计 = {
  open: '—', anonymousScreening: '—', needsAction: '—',
};

export function 取P5Open统计(
  snapshot: P5列表快照 | undefined,
  subjectId: string | null,
): P5Open统计 {
  if (subjectId === null || snapshot?.阶段 !== '成功' || snapshot.ownerSubjectId !== subjectId) {
    return 中性统计;
  }
  const openItems = snapshot.items.filter((item) => item.state.lifecycle === 'open');
  const suffix = snapshot.nextCursor === null ? '' : '+';
  return {
    open: `${openItems.length}${suffix}`,
    anonymousScreening: `${openItems.filter((item) => item.state.stage === 'anonymous_screening').length}${suffix}`,
    needsAction: `${openItems.filter((item) => item.needsAction === true).length}${suffix}`,
  };
}

export function 取P5候选横幅状态(
  snapshot: P5列表快照 | undefined,
  subjectId: string | null,
  hasScope: boolean,
): P5候选横幅状态 {
  if (!hasScope) return { 强调: '暂时没有需要你介入的', 已载待办数: 0, 读尽: false };
  const current = subjectId !== null && snapshot?.ownerSubjectId === subjectId ? snapshot : undefined;
  if (current === undefined || current.阶段 === '未开始' || current.阶段 === '进行中') {
    return { 强调: '正在读入在谈职位…', 已载待办数: 0, 读尽: false };
  }
  const 已载待办数 = current.items.filter((item) => item.needsAction).length;
  const 读尽 = current.阶段 === '成功' && current.nextCursor === null;
  const 强调 = 已载待办数 > 0
    ? (读尽 ? `${已载待办数} 个职位需要你协调` : '有职位需要你协调')
    : (读尽 ? '暂时没有需要你介入的' : '已读入的里暂时没有需要你介入的');
  return { 强调, 已载待办数, 读尽 };
}