// 开始工作年 → 折算工作年限的唯一实现（我的简历 基本信息区消费）。
//
// 历史（Task 7 / Spec §7 收口）：本文件曾有「JD 硬性要求 × 简历证据」的三态对齐行、
// 算适配分（分从行来加权）与招聘侧对齐行 —— 那套本地 JD/学历/经验评分路径已被
// 六维匹配解释取代：Backend 走 解匹配解释 严格解码，Mock 走 Mock匹配快照 固定表。
// 求职核对块、匹配对齐卡 与 use适配分 均已随最后一批消费者退场（证明无消费者后删除）。

/** 开始工作年 → 折算工作年限;空/非有限数/非整数/非正数/未来年份一律 null
 * （核不动,绝不当 0 或演示常量用）。currentYear 供确定性测试注入,生产缺省取当前年。 */
export function 折算工作年限(
  开始工作年: string,
  currentYear = new Date().getFullYear(),
): number | null {
  const 年 = Number(开始工作年);
  if (!开始工作年 || !Number.isFinite(年) || !Number.isInteger(年) ||
      年 <= 0 || 年 > currentYear) return null;
  return currentYear - 年;
}
