// Mock匹配快照（Spec §7）—— 演示记录的固定六维快照表：记录 ID → 已解码 BFF匹配解释 | null。
// 这是 Mock 匹配分的唯一来源：列表环、详情总分、分析弹层六维行全部经本表取同一条固定快照，
// 列表分数 = 详情总分 = 分项合计。不是运行时评分器：分数不从 JD/简历推算，编辑简历/JD
// 不改变任何演示快照；后端模式不经本文件（wire 分数/解释由各数据源解码）。
//
// 表值两种形态（每条演示记录保留自己的固定快照，不允许全部记录共用一份演示对象）：
//   · BFF匹配解释 —— 六维对象；展示分数就是它的 total_points（同源，不另存一份分数）；
//   · null —— 该记录无六维解释（解释合法缺失），展示分数回落记录自带的活动分/匹配分种子。
// 不在表内的编号 = 无快照与总分缺失（展示「—」+「暂无该次匹配的详细分析」，不造 0）。
//
// 覆盖矩阵（Spec §7 至少涵盖）：四态（M-13 全 matched / M-02、A-01 部分匹配 / M-11、
// M-12、A-01 不匹配 / M-11、M-01 未核对）、技能 1/100 命中 0 分仍部分匹配（M-02）、
// 真实总分 0（M-12）、null 解释有分（J-01、A-07 等）、无快照与总分缺失（M-04）；
// 求职端（J-/M-）与招聘端（A-/B-/S-/R-）记录分开，两端快照互不复制。

import type { BFF匹配解释 } from './BFF契约';
import { 市场列表, 在谈列表 } from './模拟数据';
import { 在谈候选列表, 推荐列表, 起步推荐模板 } from './企业端模拟数据';

/** 六维满分：direction 25 / skills 35 / experience 15 / location 10 / workplace_mode 5 / compensation 10。 */
export const Mock匹配快照表: Readonly<Record<string, BFF匹配解释 | null>> = {
  // ── 求职端 · 后端工程师 ──
  // M-13 交易中台架构师：全匹配演示（允许调整旧演示分数：种子 97 → 快照总分 100）
  'M-13': {
    schema_version: 'match-explanation.v1',
    ranking_version: 'discovery-ranking.v2',
    basis: 'batch_snapshot',
    total_points: 100,
    max_points: 100,
    dimensions: [
      { dimension: 'direction', status: 'matched', points: 25, max_points: 25, reason_code: 'category_matched' },
      { dimension: 'skills', status: 'matched', points: 35, max_points: 35, reason_code: 'all_keywords_matched', matched_count: 5, required_count: 5 },
      { dimension: 'experience', status: 'matched', points: 15, max_points: 15, reason_code: 'experience_met' },
      { dimension: 'location', status: 'matched', points: 10, max_points: 10, reason_code: 'location_matched' },
      { dimension: 'workplace_mode', status: 'matched', points: 5, max_points: 5, reason_code: 'workplace_mode_matched' },
      { dimension: 'compensation', status: 'matched', points: 10, max_points: 10, reason_code: 'compensation_overlap' },
    ],
  },
  // M-11 交易系统资深工程师：一态一行各占全（部分匹配 2/4=17 / 未核对 / 不匹配），总分 52
  'M-11': {
    schema_version: 'match-explanation.v1',
    ranking_version: 'discovery-ranking.v2',
    basis: 'batch_snapshot',
    total_points: 52,
    max_points: 100,
    dimensions: [
      { dimension: 'direction', status: 'matched', points: 25, max_points: 25, reason_code: 'category_matched' },
      { dimension: 'skills', status: 'partially_matched', points: 17, max_points: 35, reason_code: 'partial_keyword_overlap', matched_count: 2, required_count: 4 },
      { dimension: 'experience', status: 'unknown', points: 0, max_points: 15, reason_code: 'requirements_unconfirmed' },
      { dimension: 'location', status: 'matched', points: 10, max_points: 10, reason_code: 'location_matched' },
      { dimension: 'workplace_mode', status: 'not_matched', points: 0, max_points: 5, reason_code: 'workplace_mode_not_matched' },
      { dimension: 'compensation', status: 'unknown', points: 0, max_points: 10, reason_code: 'compensation_negotiable' },
    ],
  },
  // M-12 分布式存储工程师：真实总分 0 —— 全维度 0 分（0 是合法分，不是缺失）
  'M-12': {
    schema_version: 'match-explanation.v1',
    ranking_version: 'discovery-ranking.v2',
    basis: 'batch_snapshot',
    total_points: 0,
    max_points: 100,
    dimensions: [
      { dimension: 'direction', status: 'not_matched', points: 0, max_points: 25, reason_code: 'category_not_matched' },
      { dimension: 'skills', status: 'not_matched', points: 0, max_points: 35, reason_code: 'no_keyword_overlap', matched_count: 0, required_count: 4 },
      { dimension: 'experience', status: 'not_matched', points: 0, max_points: 15, reason_code: 'experience_not_met' },
      { dimension: 'location', status: 'not_matched', points: 0, max_points: 10, reason_code: 'location_not_matched' },
      { dimension: 'workplace_mode', status: 'not_matched', points: 0, max_points: 5, reason_code: 'workplace_mode_not_matched' },
      { dimension: 'compensation', status: 'not_matched', points: 0, max_points: 10, reason_code: 'compensation_disjoint' },
    ],
  },
  // M-02 搜索推荐：冻结反例 —— 1/100 命中 floor 后 0 分仍为部分匹配；总分 60
  'M-02': {
    schema_version: 'match-explanation.v1',
    ranking_version: 'discovery-ranking.v2',
    basis: 'batch_snapshot',
    total_points: 60,
    max_points: 100,
    dimensions: [
      { dimension: 'direction', status: 'matched', points: 25, max_points: 25, reason_code: 'category_matched' },
      { dimension: 'skills', status: 'partially_matched', points: 0, max_points: 35, reason_code: 'partial_keyword_overlap', matched_count: 1, required_count: 100 },
      { dimension: 'experience', status: 'matched', points: 15, max_points: 15, reason_code: 'experience_met' },
      { dimension: 'location', status: 'matched', points: 10, max_points: 10, reason_code: 'location_matched' },
      { dimension: 'workplace_mode', status: 'matched', points: 5, max_points: 5, reason_code: 'workplace_mode_matched' },
      { dimension: 'compensation', status: 'partially_matched', points: 5, max_points: 10, reason_code: 'compensation_near_miss' },
    ],
  },
  // M-01 Agent 方向：技能 19/20=33 部分匹配、办公方式未核对，总分 93（与种子一致）
  'M-01': {
    schema_version: 'match-explanation.v1',
    ranking_version: 'discovery-ranking.v2',
    basis: 'batch_snapshot',
    total_points: 93,
    max_points: 100,
    dimensions: [
      { dimension: 'direction', status: 'matched', points: 25, max_points: 25, reason_code: 'category_matched' },
      { dimension: 'skills', status: 'partially_matched', points: 33, max_points: 35, reason_code: 'partial_keyword_overlap', matched_count: 19, required_count: 20 },
      { dimension: 'experience', status: 'matched', points: 15, max_points: 15, reason_code: 'experience_met' },
      { dimension: 'location', status: 'matched', points: 10, max_points: 10, reason_code: 'location_matched' },
      { dimension: 'workplace_mode', status: 'unknown', points: 0, max_points: 5, reason_code: 'job_workplace_mode_missing' },
      { dimension: 'compensation', status: 'matched', points: 10, max_points: 10, reason_code: 'compensation_overlap' },
    ],
  },
  // J-02 平台架构师：六维行在求职端在谈详情/列表弹层可见；总分 76（与种子一致）
  'J-02': {
    schema_version: 'match-explanation.v1',
    ranking_version: 'discovery-ranking.v2',
    basis: 'batch_snapshot',
    total_points: 76,
    max_points: 100,
    dimensions: [
      { dimension: 'direction', status: 'matched', points: 25, max_points: 25, reason_code: 'category_matched' },
      { dimension: 'skills', status: 'partially_matched', points: 26, max_points: 35, reason_code: 'partial_keyword_overlap', matched_count: 3, required_count: 4 },
      { dimension: 'experience', status: 'matched', points: 15, max_points: 15, reason_code: 'experience_met' },
      { dimension: 'location', status: 'matched', points: 10, max_points: 10, reason_code: 'location_matched' },
      { dimension: 'workplace_mode', status: 'not_matched', points: 0, max_points: 5, reason_code: 'workplace_mode_not_matched' },
      { dimension: 'compensation', status: 'unknown', points: 0, max_points: 10, reason_code: 'compensation_negotiable' },
    ],
  },
  // ── null 条目：无六维解释（合法缺失），分数回落各自种子，演示「null 解释有分」──
  'J-01': null, // 种子 94（真人会话/在谈详情 J-01 剧情保持「暂无该次匹配的详细分析」）
  'J-03': null, // 种子 91
  'J-04': null, // 种子 82
  'J-05': null, // 种子 87
  'J-21': null, // 种子 92
  'J-22': null, // 种子 87
  'J-23': null, // 种子 85
  'M-03': null, // 种子 86
  'M-05': null, // 种子 79
  // M-04 刻意不入表：唯一的「无快照与总分缺失」演示记录（— + 暂无分析，便于观察缺失清理）

  // ── 招聘端（与求职端分开的记录与快照，不跨角色复制）──
  // A-01 需要协调：办公方式不匹配对应该单「全现场 vs 要远程」分歧；总分 94（与匹配分一致）
  'A-01': {
    schema_version: 'match-explanation.v1',
    ranking_version: 'discovery-ranking.v2',
    basis: 'batch_snapshot',
    total_points: 94,
    max_points: 100,
    dimensions: [
      { dimension: 'direction', status: 'matched', points: 25, max_points: 25, reason_code: 'category_matched' },
      { dimension: 'skills', status: 'partially_matched', points: 34, max_points: 35, reason_code: 'partial_keyword_overlap', matched_count: 35, required_count: 36 },
      { dimension: 'experience', status: 'matched', points: 15, max_points: 15, reason_code: 'experience_met' },
      { dimension: 'location', status: 'matched', points: 10, max_points: 10, reason_code: 'location_matched' },
      { dimension: 'workplace_mode', status: 'not_matched', points: 0, max_points: 5, reason_code: 'workplace_mode_not_matched' },
      { dimension: 'compensation', status: 'matched', points: 10, max_points: 10, reason_code: 'compensation_overlap' },
    ],
  },
  // A-02 递交简历：技能 4/5=28 部分匹配、办公方式未核对；总分 88（与匹配分一致）
  'A-02': {
    schema_version: 'match-explanation.v1',
    ranking_version: 'discovery-ranking.v2',
    basis: 'batch_snapshot',
    total_points: 88,
    max_points: 100,
    dimensions: [
      { dimension: 'direction', status: 'matched', points: 25, max_points: 25, reason_code: 'category_matched' },
      { dimension: 'skills', status: 'partially_matched', points: 28, max_points: 35, reason_code: 'partial_keyword_overlap', matched_count: 4, required_count: 5 },
      { dimension: 'experience', status: 'matched', points: 15, max_points: 15, reason_code: 'experience_met' },
      { dimension: 'location', status: 'matched', points: 10, max_points: 10, reason_code: 'location_matched' },
      { dimension: 'workplace_mode', status: 'unknown', points: 0, max_points: 5, reason_code: 'candidate_workplace_modes_missing' },
      { dimension: 'compensation', status: 'matched', points: 10, max_points: 10, reason_code: 'compensation_overlap' },
    ],
  },
  // A-03 主栈待放宽：技能 6/7=30 部分匹配、地点不匹配；总分 85（与匹配分一致）
  'A-03': {
    schema_version: 'match-explanation.v1',
    ranking_version: 'discovery-ranking.v2',
    basis: 'batch_snapshot',
    total_points: 85,
    max_points: 100,
    dimensions: [
      { dimension: 'direction', status: 'matched', points: 25, max_points: 25, reason_code: 'category_matched' },
      { dimension: 'skills', status: 'partially_matched', points: 30, max_points: 35, reason_code: 'partial_keyword_overlap', matched_count: 6, required_count: 7 },
      { dimension: 'experience', status: 'matched', points: 15, max_points: 15, reason_code: 'experience_met' },
      { dimension: 'location', status: 'not_matched', points: 0, max_points: 10, reason_code: 'location_not_matched' },
      { dimension: 'workplace_mode', status: 'matched', points: 5, max_points: 5, reason_code: 'workplace_mode_matched' },
      { dimension: 'compensation', status: 'matched', points: 10, max_points: 10, reason_code: 'compensation_overlap' },
    ],
  },
  // ── null 条目（招聘端种子 = 候选/推荐条目的匹配分）──
  'A-07': null, // 种子 79
  'B-02': null, // 种子 84
  'S1': null,   // 种子 87（起步推荐模板，含 @岗位 克隆）
  'S2': null,   // 种子 84
  'S3': null,   // 种子 82
  'R-11': null, // 种子 91
  'R-12': null, // 种子 86
  'R-13': null, // 种子 78
  'R-21': null, // 种子 88
};

/** 种子回落：null 条目的展示分来自记录自带的固定字段（求职端 适配分 / 招聘端 匹配分）。 */
function 种子分(编号: string): number | null {
  const 键 = 编号.split('@')[0];
  return (
    市场列表.find((岗) => 岗.编号 === 编号)?.适配分
    ?? 在谈列表.find((单) => 单.编号 === 编号)?.适配分
    ?? 在谈候选列表.find((候) => 候.编号 === 编号)?.匹配分
    ?? 推荐列表.find((推) => 推.编号 === 键)?.匹配分
    ?? 起步推荐模板.find((推) => 推.编号 === 键)?.匹配分
    ?? null
  );
}

/** 记录的固定六维解释；不在表内 = 无快照，返回 null（与表内显式 null 同返 null）。 */
export function Mock匹配解释(编号: string): BFF匹配解释 | null {
  return Mock匹配快照表[编号] ?? Mock匹配快照表[编号.split('@')[0]] ?? null;
}

/**
 * 记录是否在固定快照表内（含 @ 克隆回落）。C1 两态的 Mock 侧判据：表内显式 null =
 * 「已展开无溯源」，不在表内 = 「未展开」（调用方据此在 模型版式 与 有限依据 旧行
 * 之间互斥选择 —— 与 Backend 详情的 解释已展开 判据同构）。
 */
export function Mock有快照(编号: string): boolean {
  return 编号 in Mock匹配快照表 || 编号.split('@')[0] in Mock匹配快照表;
}

/** 记录的固定展示分：对象快照 = total_points（同源）；null 条目 = 种子分；不在表内 = null。 */
export function Mock匹配分数(编号: string): number | null {
  const 解释 = Mock匹配解释(编号);
  if (解释 !== null) return 解释.total_points;
  // 显式 null 条目与 @ 克隆回落到 null 条目都保留种子；完全无快照（不在表内）无分。
  const 键 = 编号.split('@')[0];
  return 编号 in Mock匹配快照表 || 键 in Mock匹配快照表 ? 种子分(编号) : null;
}
