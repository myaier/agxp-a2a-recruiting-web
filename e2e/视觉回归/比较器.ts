import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { 比较阈值, 元素几何, 比较状态, 问题类别, 场景采集结果, 场景比较结果, UI回归报告 } from './类型';

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

  // 结构阻断不受报告模式或 UI 审批放行：report 只放宽视觉/覆盖，不放宽结构。
  for (const 结果 of results) {
    if (结果.status === 'blocked' && 结果.categories.includes('structure')) return 1;
  }

  if (visualGate === 'enforce') {
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

// ---- 目录级比较与报告 ----

export interface 比较采集目录选项 {
  referenceDir: string | null;
  candidateDir: string;
  outputDir: string;
  visualGate: 'report' | 'enforce';
  uiChangeApproved: boolean;
  thresholds?: 比较阈值;
}

// candidate 的结构失败：采集失败、控制台/页面错误、失败请求、/api/v1 请求、横向溢出大于 2、failure 非空。
function 结构原因(结果: 场景采集结果): string[] {
  const 原因: string[] = [];
  if (结果.status === 'failed') 原因.push('采集失败');
  if (结果.consoleErrors.length > 0) 原因.push(`控制台错误 ${结果.consoleErrors.length} 条`);
  if (结果.pageErrors.length > 0) 原因.push(`页面错误 ${结果.pageErrors.length} 条`);
  if (结果.failedRequests.length > 0) 原因.push(`失败请求 ${结果.failedRequests.length} 条`);
  const apiV1 = 结果.apiRequests.filter((请求) => 请求.includes('/api/v1'));
  if (apiV1.length > 0) 原因.push(`API 请求 ${apiV1.length} 条`);
  if (结果.horizontalOverflow > 2) 原因.push(`横向溢出 ${结果.horizontalOverflow}px`);
  if (结果.failure) 原因.push(`采集异常：${结果.failure}`);
  return 原因;
}

// 读取 <dir>/scenes/*.json，按 sceneId 建 Map。解析失败的条目值为 null。
function 读场景们(dir: string): Map<string, 场景采集结果 | null> {
  const scenesDir = join(dir, 'scenes');
  const 表 = new Map<string, 场景采集结果 | null>();
  if (!existsSync(scenesDir)) {
    throw new Error(`采集目录缺少 scenes 子目录：${scenesDir}`);
  }
  const 文件们 = readdirSync(scenesDir).filter((名) => 名.endsWith('.json'));
  for (const 名 of 文件们) {
    const sceneId = 名.replace(/\.json$/, '');
    const 原文 = readFileSync(join(scenesDir, 名), 'utf8');
    try {
      const 解析 = JSON.parse(原文) as 场景采集结果;
      表.set(sceneId, 解析);
    } catch {
      表.set(sceneId, null);
    }
  }
  return 表;
}

function 空汇总(): Record<比较状态, number> {
  return { pass: 0, warning: 0, blocked: 0, new: 0, removed: 0, infrastructure: 0 };
}

export function 比较采集目录(options: 比较采集目录选项): UI回归报告 {
  const 阈值 = options.thresholds ?? 默认比较阈值;
  const 模式: 'bootstrap' | 'compare' = options.referenceDir === null ? 'bootstrap' : 'compare';

  if (!existsSync(options.candidateDir)) {
    throw new Error(`候选采集目录不存在：${options.candidateDir}`);
  }

  const 候选表 = 读场景们(options.candidateDir);
  const 基准表 = options.referenceDir !== null ? 读场景们(options.referenceDir) : new Map<string, 场景采集结果 | null>();

  const 全部id = new Set<string>([...候选表.keys(), ...基准表.keys()]);
  const 场景结果: 场景比较结果[] = [];

  for (const sceneId of 全部id) {
    const 候选 = 候选表.get(sceneId);
    const 基准 = 基准表.get(sceneId);

    // 解析失败 → 基础设施。
    if (候选 === null || (基准 === null && 模式 === 'compare')) {
      场景结果.push({
        sceneId,
        status: 'infrastructure',
        categories: ['infrastructure'],
        pixelDiffRatio: null,
        reasons: ['场景采集结果无法解析'],
        referenceScreenshot: null,
        candidateScreenshot: null,
        diffScreenshot: null,
      });
      continue;
    }

    // 仅候选存在 → 新增。
    if (基准 === undefined && 候选 !== undefined && 候选 !== null) {
      const 结构 = 结构原因(候选);
      if (结构.length > 0) {
        场景结果.push({
          sceneId, status: 'blocked', categories: ['structure'], pixelDiffRatio: null,
          reasons: 结构, referenceScreenshot: null, candidateScreenshot: 候选.screenshot, diffScreenshot: null,
        });
      } else {
        场景结果.push({
          sceneId, status: 'new', categories: ['coverage'], pixelDiffRatio: null,
          reasons: ['新增场景'], referenceScreenshot: null, candidateScreenshot: 候选.screenshot, diffScreenshot: null,
        });
      }
      continue;
    }

    // 仅基准存在 → 删除。
    if (候选 === undefined && 基准 !== undefined && 基准 !== null) {
      场景结果.push({
        sceneId, status: 'removed', categories: ['coverage'], pixelDiffRatio: null,
        reasons: ['场景已删除'], referenceScreenshot: 基准.screenshot, candidateScreenshot: null, diffScreenshot: null,
      });
      continue;
    }

    // 两边都存在。
    const 候选结果 = 候选 as 场景采集结果;
    const 基准结果 = 基准 as 场景采集结果;

    // 候选结构失败优先。
    const 结构 = 结构原因(候选结果);
    if (结构.length > 0) {
      场景结果.push({
        sceneId, status: 'blocked', categories: ['structure'], pixelDiffRatio: null,
        reasons: 结构, referenceScreenshot: 基准结果.screenshot, candidateScreenshot: 候选结果.screenshot, diffScreenshot: null,
      });
      continue;
    }

    // 两边都有成功截图 → 像素 + 几何比较。
    if (基准结果.screenshot && 候选结果.screenshot) {
      const referencePath = join(options.referenceDir as string, 基准结果.screenshot);
      const candidatePath = join(options.candidateDir, 候选结果.screenshot);
      const diffRel = `diffs/${sceneId}.png`;
      const diffPath = join(options.outputDir, diffRel);
      if (!existsSync(referencePath) || !existsSync(candidatePath)) {
        场景结果.push({
          sceneId, status: 'infrastructure', categories: ['infrastructure'], pixelDiffRatio: null,
          reasons: ['截图文件缺失'], referenceScreenshot: 基准结果.screenshot, candidateScreenshot: 候选结果.screenshot, diffScreenshot: null,
        });
        continue;
      }
      mkdirSync(dirname(diffPath), { recursive: true });
      const 图 = 比较图片(referencePath, candidatePath, diffPath, 阈值);
      const 几何原因 = 比较几何(基准结果.elements, 候选结果.elements, 阈值);
      const reasons = [...几何原因];
      let 状态: 比较状态;
      let 类别: 问题类别[];
      // 几何位移/尺寸变化属于结构问题：超过阈值即 structure blocked，
      // 不受视觉审批（UI_CHANGE_APPROVED）放行，也不被 report 模式放宽。
      if (几何原因.length > 0) {
        状态 = 'blocked';
        类别 = ['structure'];
      } else if (图.status === 'blocked') {
        状态 = 'blocked';
        类别 = ['visual'];
      } else if (图.status === 'warning') {
        状态 = 'warning';
        类别 = ['visual'];
      } else {
        状态 = 'pass';
        类别 = [];
      }
      场景结果.push({
        sceneId, status: 状态, categories: 类别, pixelDiffRatio: 图.pixelDiffRatio,
        reasons, referenceScreenshot: 基准结果.screenshot, candidateScreenshot: 候选结果.screenshot, diffScreenshot: diffRel,
      });
      continue;
    }

    // 截图字段缺失但两边都有采集记录 → 基础设施。
    场景结果.push({
      sceneId, status: 'infrastructure', categories: ['infrastructure'], pixelDiffRatio: null,
      reasons: ['截图缺失'], referenceScreenshot: 基准结果.screenshot, candidateScreenshot: 候选结果.screenshot, diffScreenshot: null,
    });
  }

  // 排序：按 sceneId 稳定输出。
  场景结果.sort((a, b) => (a.sceneId < b.sceneId ? -1 : a.sceneId > b.sceneId ? 1 : 0));

  const 汇总 = 空汇总();
  for (const 项 of 场景结果) 汇总[项.status] += 1;

  const 退出码 = 判定门禁(
    场景结果.map((项) => ({ status: 项.status, categories: 项.categories })),
    options.visualGate,
    options.uiChangeApproved,
  );

  return {
    schemaVersion: 1,
    mode: 模式,
    visualGate: options.visualGate,
    uiChangeApproved: options.uiChangeApproved,
    summary: 汇总,
    scenes: 场景结果,
    exitCode: 退出码,
  };
}

function 生成Markdown(report: UI回归报告): string {
  const 行: string[] = [];
  行.push('# UI 回归报告', '');
  行.push(`- 模式：${report.mode}`);
  行.push(`- 视觉门禁：${report.visualGate}`);
  行.push(`- UI 审批：${report.uiChangeApproved}`);
  行.push(`- 退出码：${report.exitCode}`);
  行.push('');
  行.push('| 状态 | 数量 |');
  行.push('| --- | --- |');
  (['pass', 'warning', 'blocked', 'new', 'removed', 'infrastructure'] as 比较状态[]).forEach((状态) => {
    行.push(`| ${状态} | ${report.summary[状态]} |`);
  });
  行.push('');

  const 非通过 = report.scenes.filter((项) => 项.status !== 'pass');
  if (非通过.length === 0) {
    行.push('所有场景通过。');
    return 行.join('\n');
  }

  行.push('## 非通过场景', '');
  for (const 项 of 非通过) {
    行.push(`### ${项.sceneId}`, '');
    行.push(`- 状态：${项.status}`);
    行.push(`- 类别：${项.categories.join(', ') || '无'}`);
    if (项.pixelDiffRatio !== null) 行.push(`- 像素差异：${(项.pixelDiffRatio * 100).toFixed(2)}%`);
    if (项.reasons.length > 0) {
      行.push('- 原因：');
      for (const 原因 of 项.reasons) 行.push(`  - ${原因}`);
    }
    行.push(`- 基准截图：${项.referenceScreenshot ?? 'null'}`);
    行.push(`- 候选截图：${项.candidateScreenshot ?? 'null'}`);
    行.push(`- 差异截图：${项.diffScreenshot ?? 'null'}`);
    行.push('');
  }

  return 行.join('\n');
}

export function 写报告(report: UI回归报告, outputDir: string): void {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  writeFileSync(join(outputDir, 'report.md'), 生成Markdown(report), 'utf8');
}