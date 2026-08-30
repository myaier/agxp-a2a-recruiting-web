import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { 失败分类, 整栈报告, 旅程ID, 旅程结果 } from './类型';
import { 旅程们 } from './类型';

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
