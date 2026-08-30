// 真实后端整栈验收的可序列化类型（Stable Interfaces）。
// 纯数据：不依赖浏览器对象，也不依赖 Mock 视觉回归的 e2e/视觉回归/类型.ts。
// 报告与产物一律不得携带 Cookie、OTP、bearer、Authorization、请求/响应正文或真实个人数据；
// apiRequests / failedRequests 只允许 METHOD + pathname。

export type 旅程ID =
  | 'candidate-load'
  | 'candidate-crud'
  | 'recruiter-load'
  | 'recruiter-crud'
  | 'session-isolation';

// 固定顺序的五条旅程：报告分片按此顺序读取与输出，`--journey all` 也展开成这个集合。
export const 旅程们: readonly 旅程ID[] = [
  'candidate-load',
  'candidate-crud',
  'recruiter-load',
  'recruiter-crud',
  'session-isolation',
];

export type 失败分类 =
  | 'PASS'
  | 'INFRA_BLOCKED'
  | 'FUNCTIONAL_FAILED'
  | 'VISUAL_DRIFT'
  | 'CLEANUP_FAILED'
  | 'USAGE_ERROR';

export interface 旅程结果 {
  schemaVersion: 1;
  journey: 旅程ID;
  status: 'pass' | 'failed' | 'blocked' | 'skipped';
  milestone: string;
  apiRequests: string[];        // 仅 METHOD + pathname
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];     // 仅 METHOD + pathname
  screenshots: string[];        // 仓库相对 artifact 路径
  failure: string | null;       // 脱敏业务摘要
}

export interface 真实后端视觉Manifest {
  schemaVersion: 1;
  agentBrowserVersion: string;
  chromeBuild: string;
  viewport: { width: 390; height: 844 };
  locale: 'zh-CN';
  timezone: 'Asia/Shanghai';
  colorScheme: 'light';
  deviceScaleFactor: 1;
  scenes: string[];
  baselineCommit: string;
}

export interface 视觉结果 {
  schemaVersion: 1;
  gate: 'report' | 'enforce';
  environment: 'matched' | 'bootstrap' | 'blocked';
  environmentIssue: null | 'bootstrap' | 'renderer-version-mismatch' | 'manifest-invalid' | 'expected-file-missing';
  scenes: Array<{
    sceneId: string;
    status: 'pass' | 'warning' | 'blocked' | 'missing' | 'skipped';
    pixelDiffRatio: number | null;
    reference: string | null;
    candidate: string | null;
    diff: string | null;
    reasons: string[];
  }>;
}

export interface 整栈报告 {
  schemaVersion: 1;
  classification: 失败分类;
  exitCode: 0 | 1 | 2 | 75;
  frontendCommit: string;
  backendCommit: string;
  agentBrowserVersion: string;
  chromeBuild: string;
  stack: { preexisting: boolean; healthy: boolean };
  fixture: { converge: string; verify: string; cleanup: string };
  journeys: 旅程结果[];
  visual: 视觉结果;
}
