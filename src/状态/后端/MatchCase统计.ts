// Backend MatchCase 精确统计：四个页面共用 summary 投影；只认当前 owner 的成功快照，
// loading/refresh/error/owner mismatch 一律给 —，成功零明确给 0，绝不回退分页 N/N+。
// 候选 P5 横幅仍由 open 列表快照驱动，保留既有分页与四态语义。

import type { P5列表快照, P5摘要快照 } from './类型';

export interface P5Open统计 {
  open: string;
  anonymousScreening: string;
  needsAction: string;
  archived: string;
  completed: string;
}

export interface P5候选横幅状态 {
  强调: string;
  已载待办数: number;
  读尽: boolean;
}

const 中性统计: P5Open统计 = {
  open: '—', anonymousScreening: '—', needsAction: '—', archived: '—', completed: '—',
};

export function 取P5Open统计(
  snapshot: P5摘要快照 | undefined,
  subjectId: string | null,
): P5Open统计 {
  if (subjectId === null || snapshot?.阶段 !== '成功' || snapshot.刷新中 ||
    snapshot.ownerSubjectId !== subjectId || snapshot.summary === null) {
    return 中性统计;
  }
  const summary = snapshot.summary;
  return {
    open: String(summary.openTotal),
    anonymousScreening: String(summary.openAnonymousScreeningTotal),
    needsAction: String(summary.openNeedsActionTotal),
    archived: String(summary.endedTotal + summary.completedTotal),
    completed: String(summary.completedTotal),
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
