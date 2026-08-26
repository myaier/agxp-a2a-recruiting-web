import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { 比较阈值, 元素几何, 比较状态, 问题类别 } from './类型';

export const 默认比较阈值: 比较阈值 = {
  warningPixelRatio: 0.005,
  blockingPixelRatio: 0.05,
  maxPositionDelta: 16,
  maxSizeChangeRatio: 0.15,
  colorThreshold: 0.2,
};

// 退出码：0 通过或仅警告、1 产品门禁失败、2 基础设施失败。

export function 比较图片(
  referencePath: string,
  candidatePath: string,
  diffPath: string,
  thresholds: 比较阈值,
): { status: 'pass' | 'warning' | 'blocked'; pixelDiffRatio: number } {
  const 基准 = PNG.sync.read(readFileSync(referencePath));
  const 候选 = PNG.sync.read(readFileSync(candidatePath));

  // 尺寸不同：直接阻断，并写一张以较大宽高为画布的红色 diff。
  if (基准.width !== 候选.width || 基准.height !== 候选.height) {
    const 宽 = Math.max(基准.width, 候选.width);
    const 高 = Math.max(基准.height, 候选.height);
    const 差异 = new PNG({ width: 宽, height: 高 });
    for (let i = 0; i < 宽 * 高; i += 1) {
      const 偏移 = i * 4;
      差异.data[偏移] = 255;
      差异.data[偏移 + 1] = 0;
      差异.data[偏移 + 2] = 0;
      差异.data[偏移 + 3] = 255;
    }
    writeFileSync(diffPath, PNG.sync.write(差异));
    return { status: 'blocked', pixelDiffRatio: 1 };
  }

  const 宽 = 基准.width;
  const 高 = 基准.height;
  const 差异 = new PNG({ width: 宽, height: 高 });
  const 差异像素 = pixelmatch(基准.data, 候选.data, 差异.data, 宽, 高, {
    threshold: thresholds.colorThreshold,
    includeAA: false,
  });
  writeFileSync(diffPath, PNG.sync.write(差异));

  const 比例 = 差异像素 / (宽 * 高);
  let 状态: 'pass' | 'warning' | 'blocked';
  if (比例 > thresholds.blockingPixelRatio) 状态 = 'blocked';
  else if (比例 >= thresholds.warningPixelRatio) 状态 = 'warning';
  else 状态 = 'pass';
  return { status: 状态, pixelDiffRatio: 比例 };
}

export function 比较几何(
  reference: 元素几何[],
  candidate: 元素几何[],
  thresholds: 比较阈值,
): string[] {
  const 原因: string[] = [];
  const 候选表 = new Map<string, 元素几何>();
  for (const 元素 of candidate) 候选表.set(元素.名称, 元素);

  for (const 基准元素 of reference) {
    const 候选元素 = 候选表.get(基准元素.名称);
    if (!候选元素) {
      原因.push(`关键元素缺失：${基准元素.名称}`);
      continue;
    }
    const 水平位移 = Math.abs(候选元素.x - 基准元素.x);
    const 垂直位移 = Math.abs(候选元素.y - 基准元素.y);
    const 位移 = Math.max(水平位移, 垂直位移);
    if (位移 > thresholds.maxPositionDelta) {
      原因.push(`${基准元素.名称}位移 ${位移}px`);
    }

    const 宽变化 = Math.abs(候选元素.width - 基准元素.width) / 基准元素.width;
    const 高变化 = Math.abs(候选元素.height - 基准元素.height) / 基准元素.height;
    const 尺寸变化 = Math.max(宽变化, 高变化);
    if (尺寸变化 > thresholds.maxSizeChangeRatio) {
      原因.push(`${基准元素.名称}尺寸变化 ${(尺寸变化 * 100).toFixed(1)}%`);
    }
  }

  return 原因;
}

export function 判定门禁(
  results: Array<{ status: 比较状态; categories: 问题类别[] }>,
  visualGate: 'report' | 'enforce',
  uiChangeApproved: boolean,
): 0 | 1 | 2 {
  // 基础设施失败优先返回 2。
  for (const 结果 of results) {
    if (结果.status === 'infrastructure') return 2;
  }

  if (visualGate === 'enforce') {
    // 结构阻断不受 UI 审批放行。
    for (const 结果 of results) {
      if (结果.status === 'blocked' && 结果.categories.includes('structure')) return 1;
    }
    // 视觉阻断与覆盖删除仅在未审批时返回 1。
    if (!uiChangeApproved) {
      for (const 结果 of results) {
        if (结果.status === 'blocked' && 结果.categories.includes('visual')) return 1;
        if (结果.status === 'removed' && 结果.categories.includes('coverage')) return 1;
      }
    }
  }

  return 0;
}