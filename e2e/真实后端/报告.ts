import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { 失败分类, 整栈报告, 旅程ID, 旅程结果, 真实后端视觉Manifest } from './类型';
import { 旅程们 } from './类型';
import { 比较真实后端视觉, 生成候选基线目录 } from './视觉/比较';
import { 真实后端场景们 } from './视觉/场景清单';

// ---- 运行分片读取 ----

// 旅程脚本把每条旅程写成 `<fragmentDir>/<旅程ID>.json`，字段与 旅程结果 完全一致。
// 单旅程模式仍要求五个分片齐全：未选旅程必须显式记为 skipped，缺失或改写成别的状态
// 说明编排本身坏了，按报告错误（exit 2）处理，而不是悄悄当成通过。
const 分片允许字段 = new Set([
  'schemaVersion', 'journey', 'status', 'milestone',
  'apiRequests', 'consoleErrors', 'pageErrors', 'failedRequests', 'screenshots', 'failure',
]);
const 分片字符串数组字段 = ['apiRequests', 'consoleErrors', 'pageErrors', 'failedRequests', 'screenshots'] as const;
const 旅程状态们 = new Set(['pass', 'failed', 'blocked', 'skipped']);
// 只允许 `METHOD /path`：带查询串、片段、host 或空格的条目可能夹带 token、手机号或正文，一律拒收。
const 请求形状 = /^[A-Z]+ \/[A-Za-z0-9\-._~%/]*$/;

export interface 读取运行分片选项 {
  fragmentDir: string;
  selectedJourneys: readonly 旅程ID[];
}

export interface 运行分片读取结果 {
  journeys: 旅程结果[];
  reportParseError: boolean;
  functionalFailed: boolean;
  infraBlocked: boolean;
  issues: string[];
}

function 是字符串数组(值: unknown): 值 is string[] {
  return Array.isArray(值) && 值.every((项) => typeof 项 === 'string');
}

function 解析分片(原文: string, journey: 旅程ID): 旅程结果 | null {
  let 值: unknown;
  try {
    值 = JSON.parse(原文);
  } catch {
    return null;
  }
  if (typeof 值 !== 'object' || 值 === null || Array.isArray(值)) return null;
  const 记录 = 值 as Record<string, unknown>;
  for (const 键 of Object.keys(记录)) {
    if (!分片允许字段.has(键)) return null;
  }
  if (记录.schemaVersion !== 1) return null;
  if (记录.journey !== journey) return null;
  if (typeof 记录.status !== 'string' || !旅程状态们.has(记录.status)) return null;
  if (typeof 记录.milestone !== 'string') return null;
  for (const 键 of 分片字符串数组字段) {
    if (!是字符串数组(记录[键])) return null;
  }
  if (记录.failure !== null && typeof 记录.failure !== 'string') return null;
  const 请求们 = [...(记录.apiRequests as string[]), ...(记录.failedRequests as string[])];
  if (请求们.some((项) => !请求形状.test(项))) return null;
  return 记录 as unknown as 旅程结果;
}

function 占位分片(journey: 旅程ID, milestone: string, failure: string): 旅程结果 {
  return {
    schemaVersion: 1,
    journey,
    status: 'failed',
    milestone,
    apiRequests: [],
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    screenshots: [],
    failure,
  };
}

export function 读取运行分片(options: 读取运行分片选项): 运行分片读取结果 {
  const 选中 = new Set(options.selectedJourneys);
  const journeys: 旅程结果[] = [];
  const issues: string[] = [];
  let reportParseError = false;
  let functionalFailed = false;
  let infraBlocked = false;

  for (const 旅程 of 旅程们) {
    const 路径 = join(options.fragmentDir, `${旅程}.json`);
    const 被选中 = 选中.has(旅程);

    if (!existsSync(路径)) {
      if (被选中) {
        functionalFailed = true;
        issues.push(`已选旅程缺少分片：${旅程}`);
        journeys.push(占位分片(旅程, '分片缺失', '已选旅程没有写出结果分片'));
      } else {
        reportParseError = true;
        issues.push(`未选旅程缺少 skipped 分片：${旅程}`);
        journeys.push(占位分片(旅程, '分片缺失', '未选旅程必须写出 skipped 分片'));
      }
      continue;
    }

    const 分片 = 解析分片(readFileSync(路径, 'utf8'), 旅程);
    if (分片 === null) {
      reportParseError = true;
      issues.push(`旅程分片无法解析或字段不合法：${旅程}`);
      journeys.push(占位分片(旅程, '分片不合法', '旅程分片无法解析或字段不合法'));
      continue;
    }

    if (!被选中 && 分片.status !== 'skipped') {
      reportParseError = true;
      issues.push(`未选旅程必须记为 skipped：${旅程}`);
    }
    if (被选中 && 分片.status === 'skipped') {
      functionalFailed = true;
      issues.push(`已选旅程未执行：${旅程}`);
    }
    if (分片.status === 'failed') {
      functionalFailed = true;
      issues.push(`旅程失败：${旅程}`);
    }
    if (分片.status === 'blocked') {
      infraBlocked = true;
      issues.push(`旅程阻塞：${旅程}`);
    }
    journeys.push(分片);
  }

  return { journeys, reportParseError, functionalFailed, infraBlocked, issues };
}

// ---- verdict ----

export interface 整栈判定输入 {
  reportParseError: boolean;
  infraBlocked: boolean;
  functionalFailed: boolean;
  cleanupFailed: boolean;
  visualBlocked: boolean;
  gate: 'report' | 'enforce';
}

export interface 整栈判定 {
  classification: 失败分类;
  exitCode: 0 | 1 | 2 | 75;
}

export function 判定整栈结果(输入: 整栈判定输入): 整栈判定 {
  // 优先级从高到低：报告错误 2 → 基础设施 75 → 清理 1 → 功能 1 → enforce 视觉 1 → report 视觉 0。
  // 报告本身读不出来时任何结论都不可信，所以排在最前；基础设施阻塞排在业务失败之前，
  // 因为环境没跑起来时功能结论没有意义。
  if (输入.reportParseError) return { classification: 'USAGE_ERROR', exitCode: 2 };
  if (输入.infraBlocked) return { classification: 'INFRA_BLOCKED', exitCode: 75 };
  // 清理与功能都返回 1；同时失败时确定性地归类为 CLEANUP_FAILED，
  // 因为残留的 fixture 数据会污染下一轮运行，必须先人工处理。
  if (输入.cleanupFailed) return { classification: 'CLEANUP_FAILED', exitCode: 1 };
  if (输入.functionalFailed) return { classification: 'FUNCTIONAL_FAILED', exitCode: 1 };
  if (输入.visualBlocked) {
    return { classification: 'VISUAL_DRIFT', exitCode: 输入.gate === 'enforce' ? 1 : 0 };
  }
  return { classification: 'PASS', exitCode: 0 };
}

// ---- 报告输出 ----

function 生成Markdown(报告: 整栈报告): string {
  const 行: string[] = [];
  行.push('# 真实后端整栈验收报告', '');
  行.push(`- 分类：${报告.classification}`);
  行.push(`- 退出码：${报告.exitCode}`);
  行.push(`- 前端 commit：${报告.frontendCommit}`);
  行.push(`- 后端 commit：${报告.backendCommit}`);
  行.push(`- agent-browser：${报告.agentBrowserVersion}`);
  行.push(`- Chrome：${报告.chromeBuild}`);
  行.push(`- 本地栈：预先存在=${报告.stack.preexisting} 健康=${报告.stack.healthy}`);
  行.push(`- fixture：converge=${报告.fixture.converge} verify=${报告.fixture.verify} cleanup=${报告.fixture.cleanup}`);
  行.push('');

  行.push('## 业务旅程', '');
  行.push('| 旅程 | 状态 | 里程碑 | 摘要 |');
  行.push('| --- | --- | --- | --- |');
  for (const 旅程 of 报告.journeys) {
    行.push(`| ${旅程.journey} | ${旅程.status} | ${旅程.milestone} | ${旅程.failure ?? '无'} |`);
  }
  行.push('');

  行.push('## 视觉', '');
  行.push(`- 门禁：${报告.visual.gate}`);
  行.push(`- 环境：${报告.visual.environment}（${报告.visual.environmentIssue ?? '一致'}）`);
  行.push('');
  行.push('| 场景 | 状态 | 像素差异 | 基准 | 候选 | 差异 | 原因 |');
  行.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const 场景 of 报告.visual.scenes) {
    const 比例 = 场景.pixelDiffRatio === null ? '-' : `${(场景.pixelDiffRatio * 100).toFixed(2)}%`;
    行.push(`| ${场景.sceneId} | ${场景.status} | ${比例} | ${场景.reference ?? '-'} | ${场景.candidate ?? '-'} | ${场景.diff ?? '-'} | ${场景.reasons.join('；') || '-'} |`);
  }
  行.push('');

  return 行.join('\n');
}

export function 写整栈报告(报告: 整栈报告, outputDir: string): void {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'report.json'), JSON.stringify(报告, null, 2), 'utf8');
  writeFileSync(join(outputDir, 'report.md'), 生成Markdown(报告), 'utf8');
}

// ---- 整栈运行上下文 → 报告（运行器唯一的报告入口）----

// 运行器（e2e/真实后端/运行整栈验收.sh）在收尾阶段把这份上下文写成 JSON 交给 报告命令.ts。
// 视觉比较、候选基线生成、verdict 与报告落盘都在这里做完，bash 侧只负责编排与退出码转发。
export interface 整栈运行上下文 {
  selectedJourneys: 旅程ID[];
  fragmentDir: string;
  outputDir: string;
  gate: 'report' | 'enforce';
  updateBaseline: boolean;
  cleanupFailed: boolean;
  infraBlocked: boolean;
  fixtureVerified: boolean;
  frontendCommit: string;
  backendCommit: string;
  agentBrowserVersion: string;
  chromeBuild: string;
  stack: { preexisting: boolean; healthy: boolean };
  fixture: { converge: string; verify: string; cleanup: string };
  visual: {
    baselineManifestPath: string;
    baselineDir: string;
    candidateDir: string;
    diffDir: string;
    reviewDir: string;
  };
}

export interface 整栈报告产出 extends 整栈判定 {
  baselineReview: string;
  issues: string[];
}

// 候选清单的固定字段与 capture_scene（公共步骤.sh）的取景设置一一对应：
// 视口 390x844、light、缩放 1。这些常量只在这里出现一次，基线清单按同一份格式比对。
export function 构造候选视觉清单(上下文: 整栈运行上下文): 真实后端视觉Manifest {
  return {
    schemaVersion: 1,
    agentBrowserVersion: 上下文.agentBrowserVersion,
    chromeBuild: 上下文.chromeBuild,
    viewport: { width: 390, height: 844 },
    locale: 'zh-CN',
    timezone: 'Asia/Shanghai',
    colorScheme: 'light',
    deviceScaleFactor: 1,
    scenes: [...真实后端场景们],
    baselineCommit: 上下文.frontendCommit,
  };
}

function 断言上下文(值: unknown): 整栈运行上下文 {
  if (typeof 值 !== 'object' || 值 === null || Array.isArray(值)) throw new Error('运行上下文不是对象');
  const 记录 = 值 as Record<string, unknown>;
  const 旅程集 = new Set<string>(旅程们);
  if (!Array.isArray(记录.selectedJourneys) || 记录.selectedJourneys.length === 0
    || 记录.selectedJourneys.some((项) => typeof 项 !== 'string' || !旅程集.has(项))) {
    throw new Error('selectedJourneys 不合法');
  }
  for (const 键 of ['fragmentDir', 'outputDir', 'frontendCommit', 'backendCommit', 'agentBrowserVersion', 'chromeBuild']) {
    if (typeof 记录[键] !== 'string' || 记录[键] === '') throw new Error(`${键} 缺失`);
  }
  if (记录.gate !== 'report' && 记录.gate !== 'enforce') throw new Error('gate 只能是 report 或 enforce');
  for (const 键 of ['updateBaseline', 'cleanupFailed', 'infraBlocked', 'fixtureVerified']) {
    if (typeof 记录[键] !== 'boolean') throw new Error(`${键} 必须是布尔`);
  }
  const 视觉 = 记录.visual as Record<string, unknown> | undefined;
  if (typeof 视觉 !== 'object' || 视觉 === null) throw new Error('visual 缺失');
  for (const 键 of ['baselineManifestPath', 'baselineDir', 'candidateDir', 'diffDir', 'reviewDir']) {
    if (typeof 视觉[键] !== 'string' || 视觉[键] === '') throw new Error(`visual.${键} 缺失`);
  }
  const 栈 = 记录.stack as Record<string, unknown> | undefined;
  if (typeof 栈 !== 'object' || 栈 === null || typeof 栈.preexisting !== 'boolean' || typeof 栈.healthy !== 'boolean') {
    throw new Error('stack 不合法');
  }
  const 夹具 = 记录.fixture as Record<string, unknown> | undefined;
  if (typeof 夹具 !== 'object' || 夹具 === null
    || typeof 夹具.converge !== 'string' || typeof 夹具.verify !== 'string' || typeof 夹具.cleanup !== 'string') {
    throw new Error('fixture 不合法');
  }
  return 记录 as unknown as 整栈运行上下文;
}

// 环境层面的视觉阻塞（renderer-version-mismatch / manifest-invalid / expected-file-missing）
// 是基础设施问题，按 75 处理；但只有在功能结论本身可信时才这么升级 ——
// 旅程失败时截图本来就拍不全，那时缺图是功能失败的**后果**，不该盖掉 exit 1。
export function 生成整栈报告(输入: unknown): 整栈报告产出 {
  const 上下文 = 断言上下文(输入);
  const 分片 = 读取运行分片({ fragmentDir: 上下文.fragmentDir, selectedJourneys: 上下文.selectedJourneys });
  const 候选清单 = 构造候选视觉清单(上下文);

  const 视觉 = 比较真实后端视觉({
    selectedJourneys: 上下文.selectedJourneys,
    baselineManifestPath: 上下文.visual.baselineManifestPath,
    baselineDir: 上下文.visual.baselineDir,
    candidateDir: 上下文.visual.candidateDir,
    diffDir: 上下文.visual.diffDir,
    candidateManifest: 候选清单,
    gate: 上下文.gate,
  });

  const 功能通过 = !分片.reportParseError && !分片.functionalFailed && !分片.infraBlocked && !上下文.infraBlocked;
  const issues = [...分片.issues];

  let baselineReview = 上下文.updateBaseline ? 'refused' : 'not-requested';
  if (上下文.updateBaseline) {
    const 允许环境 = (视觉.environment === 'matched' && 视觉.environmentIssue === null)
      || (视觉.environment === 'bootstrap' && 视觉.environmentIssue === 'bootstrap')
      || (视觉.environment === 'blocked' && 视觉.environmentIssue === 'renderer-version-mismatch');
    if (!允许环境) {
      baselineReview = `refused:${视觉.environmentIssue ?? 视觉.environment}`;
      issues.push(`环境状态不允许生成候选基线：${视觉.environmentIssue ?? 视觉.environment}`);
    } else if (!功能通过) {
      baselineReview = 'refused:functional';
      issues.push('功能旅程未全部通过，未生成候选基线');
    } else {
      // 基线清单读得出来才有“旧环境”可写；bootstrap 时本来就没有基线清单。
      let 基线清单: 真实后端视觉Manifest | null = null;
      if (视觉.environment !== 'bootstrap' && existsSync(上下文.visual.baselineManifestPath)) {
        try {
          基线清单 = JSON.parse(readFileSync(上下文.visual.baselineManifestPath, 'utf8')) as 真实后端视觉Manifest;
        } catch {
          基线清单 = null;
        }
      }
      try {
        生成候选基线目录({
          functionalPassed: 功能通过,
          fixtureVerified: 上下文.fixtureVerified,
          environment: 视觉.environment,
          environmentIssue: 视觉.environmentIssue,
          baselineManifest: 基线清单,
          candidateManifest: 候选清单,
          candidateDir: 上下文.visual.candidateDir,
          reviewDir: 上下文.visual.reviewDir,
        });
        baselineReview = 'generated';
      } catch (错误) {
        baselineReview = `refused:${(错误 as Error).message}`;
        issues.push(`候选基线生成被拒：${(错误 as Error).message}`);
      }
    }
  }

  // 三种视觉环境阻塞里只有 expected-file-missing 与功能结论有因果关系：旅程失败时截图本来就
  // 拍不全，那时的缺图是功能失败的**后果**，把它升级成 75 会盖掉真正的 exit 1。
  // renderer-version-mismatch 与 manifest-invalid 则是已提交基线与本机渲染器的属性，
  // 跟哪条旅程过没过毫无关系 —— 它们必须照常升级成 75，否则「环境陈旧」会被报成
  // 「你的代码坏了」，正好把 判定整栈结果 里「基础设施高于功能」的优先级倒过来。
  const 视觉环境阻塞 = 视觉.environment === 'blocked'
    && (视觉.environmentIssue !== 'expected-file-missing' || 功能通过);
  // 无论升不升级，环境阻塞本身都要出现在 issues 里：抑制得静悄悄，人就看不见基线该更新了。
  if (视觉.environment === 'blocked') {
    issues.push(视觉环境阻塞
      ? `视觉环境阻塞：${视觉.environmentIssue ?? 'blocked'}`
      : `视觉缺图（${视觉.environmentIssue ?? 'blocked'}）不升级为基础设施阻塞：功能旅程未全部通过，缺图是失败的后果`);
  }

  const 判定 = 判定整栈结果({
    reportParseError: 分片.reportParseError,
    infraBlocked: 上下文.infraBlocked || 分片.infraBlocked || 视觉环境阻塞,
    functionalFailed: 分片.functionalFailed,
    cleanupFailed: 上下文.cleanupFailed,
    visualBlocked: 视觉.scenes.some((场景) => 场景.status === 'blocked'),
    gate: 上下文.gate,
  });

  const 报告: 整栈报告 = {
    schemaVersion: 1,
    classification: 判定.classification,
    exitCode: 判定.exitCode,
    frontendCommit: 上下文.frontendCommit,
    backendCommit: 上下文.backendCommit,
    agentBrowserVersion: 上下文.agentBrowserVersion,
    chromeBuild: 上下文.chromeBuild,
    stack: 上下文.stack,
    fixture: 上下文.fixture,
    journeys: 分片.journeys,
    visual: 视觉,
  };
  写整栈报告(报告, 上下文.outputDir);
  return { ...判定, baselineReview, issues };
}
