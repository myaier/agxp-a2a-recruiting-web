# 无后端 UI 回归基线与合并门禁实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一套以 PR 目标分支为动态 reference、完全使用 Mock 数据、可在本地和 PR CI 运行的 iPhone 13 UI 回归门禁，并用 `agent-browser` 补充智能巡检证据。

**Architecture:** 每个 Git 版本用自己的 Playwright 采集器输出同名场景的截图、关键元素几何和运行时诊断；candidate 侧比较器按稳定场景 ID 比较 reference 与 candidate，再按结构、视觉、覆盖和基础设施四类结果决定退出码。`脚本/UI回归.mjs` 创建临时 detached worktree 并编排两次采集，GitHub Actions 只把确定性结果作为门禁，`agent-browser` 报告保持人工审查性质。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Playwright 1.62、Vitest 4、Node.js ESM、`pixelmatch`、`pngjs`、GitHub Actions、`agent-browser` CLI。

**Spec:** `docs/superpowers/specs/2026-08-26-ui-regression-baseline-design.md`

## Global Constraints

- 只覆盖 Playwright `devices['iPhone 13']`；第一版不增加桌面、平板或第二个手机项目。
- 两个版本都显式使用 `VITE_DATA_SOURCE=mock VITE_BACKEND_ENV=stg`，测试期间任何 `/api/v1` 请求都属于结构性失败。
- reference 默认取 `origin/main`，本地可用 `--base <ref>` 或 `UI_BASE_REF` 覆盖，PR CI 必须使用实际 `github.base_ref`。
- 第一版固定 15 个场景 ID；新增 ID 只报告，删除已有 ID 阻止合并。
- 初始阈值固定为：警告像素比例 `0.005`、大漂移比例 `0.05`、关键元素最大位移 `16px`、宽高最大相对变化 `0.15`、像素感知阈值 `0.2`。
- `ui-change-approved` 只能放行视觉大漂移和明确批准的场景删除，不能放行白屏、关键元素缺失、运行时异常、横向溢出、`/api/v1` 请求或基础设施错误。
- 视觉门禁先由 `UI_VISUAL_GATE=report` 运行两周，再通过 GitHub Actions repository variable 切换为 `enforce`；代码中不写自动日期切换。
- 不自动更新或提交截图；每轮 reference 与 candidate 都在同一 runner 中实时采集。
- 不引入视觉测试 DSL；场景继续使用普通 TypeScript 函数和 Playwright 语义定位器。
- 不强制安装 Git `pre-push` hook。
- 测试产物写入 `ui-regression-output/`，该目录必须加入 `.gitignore`。
- 实施过程中不修改任何业务页面 JSX、CSS、路由或 Mock 业务数据；若场景无法稳定到达，先修测试准备方式，不为测试改产品。

## File Map

### Create

- `playwright.视觉回归.config.ts`：固定 iPhone 13、单 worker、Mock server、采集目录和 trace。
- `e2e/视觉回归/类型.ts`：跨采集器、比较器和 CLI 共用的稳定数据结构。
- `e2e/视觉回归/稳定页面.ts`：清理/灌入浏览器状态、稳定页面、收集运行时错误和几何信息。
- `e2e/视觉回归/场景.ts`：15 个场景的到达步骤、ready 条件、关键元素和 mask。
- `e2e/视觉回归/场景.test.ts`：场景 ID、数量和状态种子约束的 Vitest 测试。
- `e2e/视觉回归/采集.spec.ts`：逐场景采集 PNG 与 JSON。
- `e2e/视觉回归/比较器.ts`：图片、几何、结构和覆盖比较，生成 Markdown/JSON 报告。
- `e2e/视觉回归/比较器.test.ts`：合成 PNG、几何阈值、bootstrap、场景增删和门禁测试。
- `e2e/视觉回归/比较命令.ts`：`tsx` 可执行的比较 CLI。
- `脚本/UI回归核心.mjs`：参数解析、base 探测、命令执行、门禁退出码和安全清理的可测试函数。
- `脚本/UI回归核心.test.mjs`：编排纯逻辑测试。
- `脚本/UI回归.mjs`：本地/CI 总入口。
- `.github/workflows/ui-regression.yml`：PR 门禁和产物上传。
- `docs/UI回归巡检.md`：本地命令、结果解释、阈值切换和 `agent-browser` 巡检手册。

### Modify

- `package.json`：加入图片比较依赖和 `ui:check`、`ui:capture`、`ui:compare` scripts。
- `package-lock.json`：锁定新增依赖。
- `vitest.config.ts`：继续排除 Playwright `.spec.ts`，但允许 `e2e/视觉回归/*.test.ts` 由 Vitest 执行。
- `.gitignore`：忽略 `ui-regression-output/`。

## Stable Interfaces

后续任务只能使用这里列出的名称，不另造同义接口：

```ts
export type 场景状态种子 = '未登录' | '求职端已注册' | '招聘端已注册';

export interface 关键元素描述 {
  名称: string;
  定位: Locator;
}

export interface 视觉场景 {
  id: string;
  状态: 场景状态种子;
  到达(page: Page): Promise<void>;
  就绪(page: Page): Promise<void>;
  关键元素(page: Page): 关键元素描述[];
  遮罩?(page: Page): Locator[];
}

export interface 元素几何 {
  名称: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface 场景采集结果 {
  schemaVersion: 1;
  sceneId: string;
  status: 'captured' | 'failed';
  url: string;
  screenshot: string | null;
  viewport: { width: number; height: number };
  elements: 元素几何[];
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  apiRequests: string[];
  horizontalOverflow: number;
  failure: string | null;
}

export interface 比较阈值 {
  warningPixelRatio: number;
  blockingPixelRatio: number;
  maxPositionDelta: number;
  maxSizeChangeRatio: number;
  colorThreshold: number;
}

export type 比较状态 = 'pass' | 'warning' | 'blocked' | 'new' | 'removed' | 'infrastructure';
export type 问题类别 = 'structure' | 'visual' | 'coverage' | 'infrastructure';

export interface 场景比较结果 {
  sceneId: string;
  status: 比较状态;
  categories: 问题类别[];
  pixelDiffRatio: number | null;
  reasons: string[];
  referenceScreenshot: string | null;
  candidateScreenshot: string | null;
  diffScreenshot: string | null;
}

export interface UI回归报告 {
  schemaVersion: 1;
  mode: 'bootstrap' | 'compare';
  visualGate: 'report' | 'enforce';
  uiChangeApproved: boolean;
  summary: Record<比较状态, number>;
  scenes: 场景比较结果[];
  exitCode: 0 | 1 | 2;
}
```

退出码必须保持：`0` 通过或仅警告、`1` 产品门禁失败、`2` 基础设施失败。

---

### Task 1: 建立图片、几何与门禁比较核心

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vitest.config.ts`
- Create: `e2e/视觉回归/类型.ts`
- Create: `e2e/视觉回归/比较器.ts`
- Create: `e2e/视觉回归/比较器.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces: `默认比较阈值`、`比较图片()`、`比较几何()`、`判定门禁()`，以及 Stable Interfaces 中全部可序列化类型。

- [ ] **Step 1: 安装最小图片比较依赖**

Run:

```bash
npm install --save-dev pixelmatch pngjs @types/pngjs tsx
```

Expected: `package.json` 与 `package-lock.json` 更新；不得移动现有 React、Vite、Playwright 或 Vitest 版本。

- [ ] **Step 2: 让 Vitest 只排除 Playwright spec**

将 `vitest.config.ts` 的 `exclude` 改为：

```ts
exclude: ['e2e/**/*.spec.ts', 'node_modules/**', 'dist/**', '.claude/**'],
```

Run:

```bash
npm test -- --run e2e/视觉回归/比较器.test.ts
```

Expected: FAIL，提示测试文件不存在；这证明新路径不会再被 `e2e/**` 整体排除。

- [ ] **Step 3: 写类型与失败测试**

在 `e2e/视觉回归/类型.ts` 写入 Stable Interfaces 中的可序列化类型。`Locator`、`Page` 和 `视觉场景` 留到 Task 3 的 `场景.ts`，不要让纯比较器依赖浏览器对象。

在 `e2e/视觉回归/比较器.test.ts` 使用 Node 环境并创建合成 PNG：

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { 比较图片, 比较几何, 判定门禁, 默认比较阈值 } from './比较器';

const 临时目录们: string[] = [];

function 新目录(): string {
  const 目录 = mkdtempSync(join(tmpdir(), 'ui-diff-test-'));
  临时目录们.push(目录);
  return 目录;
}

function 写图(路径: string, 改色像素: number): void {
  const 图 = new PNG({ width: 20, height: 20 });
  for (let i = 0; i < 400; i += 1) {
    const 偏移 = i * 4;
    const 改 = i < 改色像素;
    图.data[偏移] = 改 ? 255 : 20;
    图.data[偏移 + 1] = 20;
    图.data[偏移 + 2] = 20;
    图.data[偏移 + 3] = 255;
  }
  writeFileSync(路径, PNG.sync.write(图));
}

afterEach(() => {
  for (const 目录 of 临时目录们.splice(0)) rmSync(目录, { recursive: true, force: true });
});

describe('UI 图片与几何比较', () => {
  it('按 0.5% 与 5% 阈值区分通过、警告和阻断', () => {
    const 目录 = 新目录();
    const 基准 = join(目录, 'reference.png');
    const 候选 = join(目录, 'candidate.png');
    const 差异 = join(目录, 'diff.png');
    写图(基准, 0);

    写图(候选, 1);
    expect(比较图片(基准, 候选, 差异, 默认比较阈值).status).toBe('pass');

    写图(候选, 20);
    expect(比较图片(基准, 候选, 差异, 默认比较阈值).status).toBe('warning');

    写图(候选, 40);
    expect(比较图片(基准, 候选, 差异, 默认比较阈值).status).toBe('blocked');
  });

  it('位移超过 16px 或尺寸变化超过 15% 时阻断', () => {
    const 基准 = [{ 名称: '主按钮', x: 10, y: 20, width: 100, height: 44 }];
    expect(比较几何(基准, [{ 名称: '主按钮', x: 27, y: 20, width: 100, height: 44 }], 默认比较阈值)).toContain('主按钮位移 17px');
    expect(比较几何(基准, [{ 名称: '主按钮', x: 10, y: 20, width: 116, height: 44 }], 默认比较阈值)).toContain('主按钮尺寸变化 16.0%');
  });

  it('UI 审批不能放行结构和基础设施失败', () => {
    expect(判定门禁([{ status: 'blocked', categories: ['visual'] }], 'enforce', true)).toBe(0);
    expect(判定门禁([{ status: 'blocked', categories: ['structure'] }], 'enforce', true)).toBe(1);
    expect(判定门禁([{ status: 'infrastructure', categories: ['infrastructure'] }], 'enforce', true)).toBe(2);
    expect(判定门禁([{ status: 'new', categories: ['coverage'] }], 'enforce', false)).toBe(0);
    expect(判定门禁([{ status: 'removed', categories: ['coverage'] }], 'enforce', false)).toBe(1);
  });
});
```

- [ ] **Step 4: 运行失败测试**

Run:

```bash
npm test -- --run e2e/视觉回归/比较器.test.ts
```

Expected: FAIL，提示 `./比较器` 不存在。

- [ ] **Step 5: 实现最小比较器**

在 `e2e/视觉回归/比较器.ts` 实现以下导出：

```ts
export const 默认比较阈值: 比较阈值 = {
  warningPixelRatio: 0.005,
  blockingPixelRatio: 0.05,
  maxPositionDelta: 16,
  maxSizeChangeRatio: 0.15,
  colorThreshold: 0.2,
};

export function 比较图片(
  referencePath: string,
  candidatePath: string,
  diffPath: string,
  thresholds: 比较阈值,
): { status: 'pass' | 'warning' | 'blocked'; pixelDiffRatio: number };

export function 比较几何(
  reference: 元素几何[],
  candidate: 元素几何[],
  thresholds: 比较阈值,
): string[];

export function 判定门禁(
  results: Array<{ status: 比较状态; categories: 问题类别[] }>,
  visualGate: 'report' | 'enforce',
  uiChangeApproved: boolean,
): 0 | 1 | 2;
```

实现规则：

- `pixelmatch` 使用 `{ threshold: thresholds.colorThreshold, includeAA: false }`。
- 两张 PNG 尺寸不同时直接返回 `blocked` 和 `pixelDiffRatio: 1`，同时生成一张以较大宽高为画布的红色 diff。
- `pixelDiffRatio = differingPixels / (width * height)`。
- 几何位移取 `max(abs(dx), abs(dy))`；尺寸变化取宽、高相对变化的最大值。
- 关键元素在 candidate 缺失时返回 `关键元素缺失：<名称>`。
- `判定门禁()` 优先返回基础设施 `2`，其次结构 `1`；`new` 永远只报告；`report` 模式不因 visual/coverage 返回 `1`；`enforce` 模式下只有 `blocked` visual 和 `removed` coverage 会在 `uiChangeApproved` 为 false 时返回 `1`。

- [ ] **Step 6: 运行单测与类型检查**

Run:

```bash
npm test -- --run e2e/视觉回归/比较器.test.ts
npm run typecheck
```

Expected: 两条命令 PASS。

- [ ] **Step 7: 提交比较核心**

```bash
git add package.json package-lock.json vitest.config.ts e2e/视觉回归/类型.ts e2e/视觉回归/比较器.ts e2e/视觉回归/比较器.test.ts
git commit -m "test: add UI regression comparison core"
```

---

### Task 2: 完成目录比较、报告和比较 CLI

**Files:**
- Modify: `e2e/视觉回归/比较器.ts`
- Modify: `e2e/视觉回归/比较器.test.ts`
- Create: `e2e/视觉回归/比较命令.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1 的 `场景采集结果`、`UI回归报告`、`默认比较阈值`、`比较图片()`、`比较几何()`、`判定门禁()`。
- Produces: `比较采集目录(options): UI回归报告`、`写报告(report, outputDir): void`，以及 `npm run ui:compare`。

- [ ] **Step 1: 写目录比较失败测试**

在 `比较器.test.ts` 新增测试；先把 Node fs import 补为 `mkdirSync, mkdtempSync, rmSync, writeFileSync`，再写入两个最小 `场景采集结果` JSON：

```ts
it('bootstrap、新增、删除和结构失败进入正确状态', () => {
  const 根 = 新目录();
  const reference = join(根, 'reference');
  const candidate = join(根, 'candidate');
  const output = join(根, 'report');
  mkdirSync(join(reference, 'scenes'), { recursive: true });
  mkdirSync(join(candidate, 'scenes'), { recursive: true });

  写场景(reference, 捕获结果('removed'));
  写场景(candidate, 捕获结果('new'));

  const 报告 = 比较采集目录({ referenceDir: reference, candidateDir: candidate, outputDir: output, visualGate: 'report', uiChangeApproved: false });
  expect(报告.mode).toBe('compare');
  expect(报告.scenes.find((项) => 项.sceneId === 'new')?.status).toBe('new');
  expect(报告.scenes.find((项) => 项.sceneId === 'removed')?.status).toBe('removed');
  expect(报告.exitCode).toBe(0);

  const bootstrap = 比较采集目录({ referenceDir: null, candidateDir: candidate, outputDir: output, visualGate: 'enforce', uiChangeApproved: false });
  expect(bootstrap.mode).toBe('bootstrap');
  expect(bootstrap.exitCode).toBe(0);
});
```

同一文件加入辅助函数 `捕获结果(sceneId)` 与 `写场景(dir, result)`；这条测试只有新增和删除场景，因此截图字段设为 `null`，不会进入像素比较。

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- --run e2e/视觉回归/比较器.test.ts
```

Expected: FAIL，提示 `比较采集目录` 尚未导出。

- [ ] **Step 3: 实现目录比较与报告**

新增精确接口：

```ts
export interface 比较采集目录选项 {
  referenceDir: string | null;
  candidateDir: string;
  outputDir: string;
  visualGate: 'report' | 'enforce';
  uiChangeApproved: boolean;
  thresholds?: 比较阈值;
}

export function 比较采集目录(options: 比较采集目录选项): UI回归报告;
export function 写报告(report: UI回归报告, outputDir: string): void;
```

实现必须：

- 读取 `<captureDir>/scenes/*.json`，按 `sceneId` 建 Map。
- candidate 的 `status: failed`、console/page error、failed request、API request、横向溢出大于 `2` 或 `failure` 非空都归为 `structure`。
- 两边都有成功截图时调用 `比较图片()` 和 `比较几何()`。
- `new` 使用 `categories: ['coverage']`，在 report/enforce 均只警告；`removed` 使用 `categories: ['coverage']`，report 模式警告、enforce 模式阻断。
- 缺目录、JSON 无法解析或截图文件缺失使用 `infrastructure`。
- 生成 `report.json` 和 `report.md`；Markdown 先给汇总表，再为非 pass 场景列 reasons 与三个相对图片路径。
- `summary` 必须包含全部六种状态，即使计数为零。

- [ ] **Step 4: 实现比较 CLI 与 npm script**

`e2e/视觉回归/比较命令.ts` 接收：

```bash
tsx e2e/视觉回归/比较命令.ts --candidate <dir> --output <dir> [--reference <dir>]
```

环境变量：

```text
UI_VISUAL_GATE=report|enforce
UI_CHANGE_APPROVED=true|false
```

CLI 打印报告 Markdown 路径与汇总，并设置 `process.exitCode` 为报告的 `exitCode`。在 `package.json` 加入：

```json
"ui:compare": "tsx e2e/视觉回归/比较命令.ts"
```

- [ ] **Step 5: 验证报告与 CLI**

Run:

```bash
npm test -- --run e2e/视觉回归/比较器.test.ts
npm run ui:compare -- --candidate /path/that/does/not/exist --output /tmp/ui-regression-cli-test
```

Expected: 单测 PASS；第二条退出码为 `2`，输出明确的基础设施错误，不抛未格式化堆栈。

- [ ] **Step 6: 提交报告层**

```bash
git add package.json e2e/视觉回归/比较器.ts e2e/视觉回归/比较器.test.ts e2e/视觉回归/比较命令.ts
git commit -m "test: report tiered UI regression results"
```

---

### Task 3: 建立稳定采集器与入口场景

**Files:**
- Create: `playwright.视觉回归.config.ts`
- Create: `e2e/视觉回归/稳定页面.ts`
- Create: `e2e/视觉回归/场景.ts`
- Create: `e2e/视觉回归/场景.test.ts`
- Create: `e2e/视觉回归/采集.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1 的 `场景采集结果`、`元素几何`。
- Produces: `视觉场景们: 视觉场景[]`、`安装诊断(page)`、`打开稳定页面(page, path, seed)`、`采集场景(page, scene, outputDir)` 和 `npm run ui:capture`。

- [ ] **Step 1: 写场景清单失败测试**

创建 `e2e/视觉回归/场景.test.ts`：

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { 视觉场景们 } from './场景';

const 预期ID = [
  'entry-login-default',
  'entry-identity',
  'candidate-preferences',
  'candidate-salary',
  'candidate-resume',
];

describe('视觉场景清单', () => {
  it('先包含 5 个稳定且唯一的入口场景 ID', () => {
    expect(视觉场景们.map((场景) => 场景.id)).toEqual(预期ID);
    expect(new Set(视觉场景们.map((场景) => 场景.id)).size).toBe(5);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- --run e2e/视觉回归/场景.test.ts
```

Expected: FAIL，提示 `./场景` 不存在。

- [ ] **Step 3: 实现状态种子与稳定页面工具**

在 `稳定页面.ts` 定义以下固定 legacy seed；它们已被当前应用的迁移逻辑支持，并且每个新 context 都会迁移到账号隔离的新键：

```ts
const 求职端种子 = {
  AGXP简历v2: JSON.stringify({
    基本信息: { 真名: '沈亦舟', 开始工作年: '2017', 身份: '在职' },
    经历: [],
    教育: [],
    技能: ['TypeScript', 'React'],
    个人优势: '九年前端与平台经验，主导过招聘系统重建。',
  }),
  AGXP求职筛选v1: JSON.stringify({
    职位: ['产品经理'],
    城市们: ['上海'],
    薪资: { 下限: 30, 上限: 45, 单位: '月薪K' },
    筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['混合'] },
  }),
};
```

`打开稳定页面()` 必须在第一次 `goto` 前用 `page.addInitScript()` 清空 local/session storage，再按状态种子写入；导航后等待目标 ready locator、`document.fonts.ready` 和连续两个 `requestAnimationFrame`。随后注入：

```css
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  caret-color: transparent !important;
}
```

`安装诊断()` 收集 `console` 的 error、`pageerror`、`requestfailed` 和 pathname 以 `/api/v1` 开头的请求。不要收集 warning。

实现 `UI_CANDIDATE_MUTATION` 的 candidate-only 自测钩子，支持：

- `shift`：给 `#根节点` 注入 `transform: translateX(20px)`。
- `overflow`：向 body 添加固定宽度 `500px` 的不可见测试节点。
- `pageerror`：通过 `setTimeout(() => { throw new Error('UI regression self-test'); })` 触发 page error。

只有 `UI_CAPTURE_ROLE=candidate` 时允许应用该钩子。

三个状态种子的写入规则固定为：`未登录` 只清空存储；`求职端已注册` 清空后写入 `求职端种子`；`招聘端已注册` 只清空存储并使用应用内现成的 Mock 招聘数据，不复制企业业务数据到测试代码。

- [ ] **Step 4: 实现前五个入口场景**

在 `场景.ts` 定义 `视觉场景` 与 `关键元素描述` 接口，并先实现前五个场景：

```ts
export interface 关键元素描述 {
  名称: string;
  定位: Locator;
}

export interface 视觉场景 {
  id: string;
  状态: 场景状态种子;
  到达(page: Page): Promise<void>;
  就绪(page: Page): Promise<void>;
  关键元素(page: Page): 关键元素描述[];
  遮罩?(page: Page): Locator[];
}
```

到达路径和关键断言固定为：

| ID | 路径 | ready/关键元素 |
|---|---|---|
| `entry-login-default` | `/#/` | heading `工作蜂`、label `手机号`、button `进入` |
| `entry-identity` | `/#/identity` | button `我要找工作`、button `我要招人` |
| `candidate-preferences` | `/#/student` | heading `完善资料`、button `/选择期望职位/`、button `下一步` |
| `candidate-salary` | `/#/wizard?stage=salary` | heading `期望现金月薪是？`、listbox `最低月薪`、button `下一步` |
| `candidate-resume` | `/#/basic` | heading `创建在线简历`、label `姓名`、button `下一步` |

`entry-*` 使用 `未登录`；后三项使用 `求职端已注册`。路径使用 `page.goto()`，ready 与关键元素都使用 role/label，不使用 CSS module hash。

- [ ] **Step 5: 实现 Playwright 配置和采集 spec**

`playwright.视觉回归.config.ts` 必须包含：

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/视觉回归',
  testMatch: '采集.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 45_000,
  use: {
    ...devices['iPhone 13'],
    baseURL: process.env.UI_BASE_URL ?? 'http://127.0.0.1:4174',
    browserName: 'chromium',
    channel: process.env.CI ? undefined : 'chrome',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `VITE_DATA_SOURCE=mock VITE_BACKEND_ENV=stg npm run dev -- --host 127.0.0.1 --port ${process.env.UI_PORT ?? '4174'} --strictPort`,
    url: process.env.UI_BASE_URL ?? 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
```

`采集.spec.ts` 为每个场景生成一个 Playwright test。每条测试：

1. 安装诊断。
2. 到达并等待稳定。
3. 检查 body 可见文字长度至少 `12`。
4. 检查 `document.documentElement.scrollWidth - clientWidth <= 2`。
5. 检查所有关键元素可见并记录 `boundingBox()`。
6. 将 viewport screenshot 写到 `<UI_CAPTURE_DIR>/screenshots/<scene-id>.png`。
7. 将 `场景采集结果` 写到 `<UI_CAPTURE_DIR>/scenes/<scene-id>.json`。
8. 任一步骤失败时仍写 `status: failed` JSON，再重新抛错让 Playwright trace 生效。

在 `package.json` 加入：

```json
"ui:capture": "playwright test --config=playwright.视觉回归.config.ts"
```

- [ ] **Step 6: 运行入口采集**

Run:

```bash
UI_CAPTURE_DIR=/tmp/ui-capture-entry UI_CAPTURE_ROLE=candidate UI_PORT=4174 UI_BASE_URL=http://127.0.0.1:4174 npm run ui:capture
```

Expected: 当前阶段只有前五个场景时 5 tests PASS；`/tmp/ui-capture-entry/scenes` 有 5 个 JSON，`screenshots` 有 5 个 PNG，所有 `apiRequests` 为空。

- [ ] **Step 7: 提交采集骨架**

```bash
git add package.json playwright.视觉回归.config.ts e2e/视觉回归/稳定页面.ts e2e/视觉回归/场景.ts e2e/视觉回归/场景.test.ts e2e/视觉回归/采集.spec.ts
git commit -m "test: capture stable mobile UI scenes"
```

---

### Task 4: 补齐求职端与招聘端 15 个场景

**Files:**
- Modify: `e2e/视觉回归/场景.ts`
- Modify: `e2e/视觉回归/场景.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `视觉场景`、`打开稳定页面()` 与固定状态种子。
- Produces: 顺序与 Task 3 `预期ID` 完全相同的 15 项 `视觉场景们`。

- [ ] **Step 1: 先运行数量测试确认失败**

先把 `场景.test.ts` 中的 `预期ID` 扩为规格确定的完整 15 项：

```ts
const 预期ID = [
  'entry-login-default',
  'entry-identity',
  'candidate-preferences',
  'candidate-salary',
  'candidate-resume',
  'candidate-market',
  'candidate-negotiations',
  'candidate-negotiation-detail',
  'candidate-messages',
  'candidate-me-overlay',
  'recruiter-card',
  'recruiter-post-job-1',
  'recruiter-post-job-2',
  'recruiter-post-job-3',
  'recruiter-home-candidate',
];
```

同时把测试名称改为 `包含 15 个稳定且唯一的场景 ID`，并把唯一 ID 数断言从 `5` 改为 `15`。

Run:

```bash
npm test -- --run e2e/视觉回归/场景.test.ts
```

Expected: FAIL，实际只有 5 个场景，预期 15 个。

- [ ] **Step 2: 添加五个求职端场景**

实现以下到达步骤：

| ID | 步骤 | ready/关键元素 |
|---|---|---|
| `candidate-market` | 打开 `/#/app`，点 button `市场` | text `告诉AI代理你的硬性要求`、button `查看职位详情`、button `让AI代理去谈` |
| `candidate-negotiations` | 打开 `/#/app` | button `在谈`、text `/个职位需要你协调|暂时没有需要你介入/`、第一张在谈卡 |
| `candidate-negotiation-detail` | 打开 `/#/deal/J-01` | text `匹配度分析`、text `职位详情`、返回按钮 |
| `candidate-messages` | 打开 `/#/app`，点底部 nav button `消息` | text `消息`、button `搜索`、第一条会话 |
| `candidate-me-overlay` | 打开 `/#/app`，点底部 nav button `我`，先断言 text `我的求职AI代理`，再点 button `待你拍`，点 button `/筛选/` 打开在谈筛选层 | text `看哪几单`、text `全部意向`、button `完成` |

`candidate-me-overlay` 保留已批准的场景 ID，但要同时证明“我的”入口和关键在谈筛选层能连通。它的最终截图是筛选层打开态；关键元素同时包含底部“我”导航和筛选层标题，避免只测到最终路由而漏掉入口。

禁止用 `.nth()` 选择底部导航；使用准确 accessible name。只有“第一张业务卡”允许 `.first()`，并在 key 名中写明 `第一张在谈卡` 或 `第一条会话`。

- [ ] **Step 3: 添加五个招聘端场景**

实现以下到达步骤：

| ID | 步骤 | ready/关键元素 |
|---|---|---|
| `recruiter-card` | 打开 `/#/hr/card` | heading `招聘名片`、label `姓名`、button `保存 · 去发岗位` |
| `recruiter-post-job-1` | 打开 `/#/hr/post-job` | heading `岗位基础信息`、button `实习生 在校生实习，按天计薪`、button `下一步` |
| `recruiter-post-job-2` | 完成第一步必填项并点 `下一步` | heading `职位描述`、label `职位描述`、button `下一步` |
| `recruiter-post-job-3` | 在第二步填职位描述并点 `下一步` | heading `职位要求`、label `薪资下限` 或 button `— 元/天`、text `AI 初筛条件确认` |
| `recruiter-home-candidate` | 打开 `/#/hr`，点 button `推荐`，点第一项 button `查看候选画像` | 返回按钮、text `/匹配|在线简历/`、候选画像标题 |

发布岗位第一步统一使用已有 E2E 已验证的动作：

```ts
await page.getByRole('button', { name: '实习生 在校生实习，按天计薪' }).click();
await page.getByRole('button', { name: '提供转正机会' }).click();
await page.getByPlaceholder(/资深后端工程师/).fill('AI 产品实习生');
await page.getByRole('button').filter({ hasText: '职位类别' }).click();
await page.getByRole('button', { name: '产品', exact: true }).click();
await page.getByRole('button', { name: '产品经理', exact: true }).click();
await page.getByRole('button', { name: '混合', exact: true }).click();
await page.getByRole('button', { name: '下一步' }).click();
```

第二步继续：

```ts
await page.getByLabel('职位描述').fill('参与 AI 招聘产品的需求分析与原型设计。');
await page.getByRole('button', { name: '下一步' }).click();
```

- [ ] **Step 4: 运行清单测试和完整单版本采集**

Run:

```bash
npm test -- --run e2e/视觉回归/场景.test.ts
UI_CAPTURE_DIR=/tmp/ui-capture-all UI_CAPTURE_ROLE=candidate UI_PORT=4174 UI_BASE_URL=http://127.0.0.1:4174 npm run ui:capture
```

Expected: 场景清单测试 PASS；Playwright 显示 15 tests PASS；15 个 JSON 和 15 个 PNG 存在；没有 `/api/v1` 请求。

- [ ] **Step 5: 逐图检查场景没有拍歪**

Run:

```bash
find /tmp/ui-capture-all/screenshots -type f -name '*.png' | sort
```

Expected: 文件名与 15 个场景 ID 一一对应。用本地图片查看工具抽查全部截图，确认没有骨架屏、`正在加载…`、关闭中的弹层或错误路由。

- [ ] **Step 6: 提交完整场景集**

```bash
git add e2e/视觉回归/场景.ts e2e/视觉回归/场景.test.ts
git commit -m "test: cover candidate and recruiter UI anchors"
```

---

### Task 5: 编排动态 base worktree、bootstrap 与安全清理

**Files:**
- Create: `脚本/UI回归核心.mjs`
- Create: `脚本/UI回归核心.test.mjs`
- Create: `脚本/UI回归.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Task 2 的 `npm run ui:compare`，Task 3 的 `npm run ui:capture`。
- Produces: `解析UI回归参数()`、`决定采集模式()`、`运行命令()` 与公开命令 `npm run ui:check`。

- [ ] **Step 1: 写编排核心失败测试**

创建 `脚本/UI回归核心.test.mjs`：

```js
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { 决定采集模式, 解析UI回归参数 } from './UI回归核心.mjs';

describe('UI 回归编排核心', () => {
  it('命令行 base 优先于环境变量和默认值', () => {
    expect(解析UI回归参数(['--base', 'origin/release'], { UI_BASE_REF: 'origin/main' }).baseRef).toBe('origin/release');
    expect(解析UI回归参数([], { UI_BASE_REF: 'origin/develop' }).baseRef).toBe('origin/develop');
    expect(解析UI回归参数([], {}).baseRef).toBe('origin/main');
  });

  it('base 没有采集命令时进入 bootstrap', () => {
    expect(决定采集模式({ baseHasCapture: false })).toBe('bootstrap');
    expect(决定采集模式({ baseHasCapture: true })).toBe('compare');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- --run 脚本/UI回归核心.test.mjs
```

Expected: FAIL，提示 `UI回归核心.mjs` 不存在。

- [ ] **Step 3: 实现纯编排核心**

`解析UI回归参数(argv, env)` 只接受 `--base <ref>` 和 `--output <absolute-or-relative-dir>`，出现未知参数、缺值或 base 为空时抛出带用法的错误。默认 output 为仓库根下 `ui-regression-output/latest`。

导出：

```js
export function 解析UI回归参数(argv, env) {
  return { baseRef, outputDir };
}

export function 决定采集模式({ baseHasCapture }) {
  return baseHasCapture ? 'compare' : 'bootstrap';
}

export function 运行命令(command, args, options) {
  return { status, stdout, stderr };
}
```

`运行命令()` 必须使用 `spawnSync(command, args, { shell: false })`，不得把 base ref 拼进 shell 字符串。非零退出码由调用方分类；signal 终止视为基础设施错误。

- [ ] **Step 4: 实现总入口和安全清理**

`脚本/UI回归.mjs` 按以下顺序实现：

1. 用 `git rev-parse --show-toplevel` 解析仓库根。
2. 用 `git rev-parse --verify <baseRef>^{commit}` 校验 base。
3. 在 `mkdtempSync(join(tmpdir(), 'agxp-ui-base-'))` 返回的精确目录中创建 detached worktree。
4. 读取 base worktree 的 `package.json`，检查 `scripts['ui:capture']`。
5. base 有采集器时，在 base worktree 执行 `npm ci`，再以 `UI_CAPTURE_ROLE=reference`、端口 `4174`、输出 `<output>/reference` 运行 `npm run ui:capture`。
6. base 无采集器时进入 bootstrap，不运行 reference 采集。
7. 在当前工作区以 `UI_CAPTURE_ROLE=candidate`、端口 `4175`、输出 `<output>/candidate` 运行 `npm run ui:capture`。
8. 执行 candidate 的 `npm run ui:compare`，bootstrap 时不传 `--reference`。
9. 将比较器退出码原样返回。
10. `finally` 中只对第 3 步由 `mkdtempSync` 返回的精确目录执行 `git worktree remove --force <path>`，随后执行 `git worktree prune`；不得删除仓库根、用户目录或任何非本轮创建路径。

基础设施步骤失败时写 `<output>/infrastructure-error.json`，打印简短原因并退出 `2`。reference 或 candidate 采集失败后仍调用比较器，让已有 failed JSON 和 trace 进入报告。若采集进程非零退出且对应 `scenes/` 没有任何 JSON，判定为浏览器/服务基础设施失败并自动重试一次；已有任意场景 JSON 时不重试，因为失败已具有产品诊断证据。依赖安装、Git 和比较器解析错误同样最多重试一次，第二次失败退出 `2`。

在 `.gitignore` 加入：

```gitignore
ui-regression-output/
```

在 `package.json` 加入：

```json
"ui:check": "node 脚本/UI回归.mjs"
```

- [ ] **Step 5: 运行编排单测**

Run:

```bash
npm test -- --run 脚本/UI回归核心.test.mjs
```

Expected: PASS。

- [ ] **Step 6: 验证 bootstrap**

先验证当前设计分支相对不含采集器的父提交进入 bootstrap：

```bash
UI_VISUAL_GATE=report npm run ui:check -- --base 5a1c644^ --output ui-regression-output/bootstrap-check
```

Expected: exit `0`，报告 `mode: bootstrap`，15 个 candidate 场景存在。

- [ ] **Step 7: 提交动态编排器**

```bash
git add package.json .gitignore 脚本/UI回归核心.mjs 脚本/UI回归核心.test.mjs 脚本/UI回归.mjs
git commit -m "test: compare UI against the target branch"
```

---

### Task 6: 接入 PR CI、标签放行和产物策略

**Files:**
- Create: `.github/workflows/ui-regression.yml`
- Modify: `脚本/UI回归.mjs`
- Modify: `脚本/UI回归核心.mjs`
- Modify: `脚本/UI回归核心.test.mjs`
- Create: `docs/UI回归巡检.md`

**Interfaces:**
- Consumes: Task 5 的 `npm run ui:check`、退出码与 `ui-regression-output/latest`。
- Produces: GitHub Actions check `ui-regression`，repository variable `UI_VISUAL_GATE` 和 label `ui-change-approved` 的约定。

- [ ] **Step 1: 先写标签与门禁环境映射测试**

在 `UI回归核心.mjs` 导出并测试：

```js
export function 解析门禁环境(env) {
  const visualGate = env.UI_VISUAL_GATE === 'enforce' ? 'enforce' : 'report';
  const uiChangeApproved = env.UI_CHANGE_APPROVED === 'true';
  return { visualGate, uiChangeApproved };
}
```

测试必须断言未知/空值回落到 `report`，只有字面量 `true` 才表示审批。

- [ ] **Step 2: 运行测试确认失败后实现**

Run before implementation:

```bash
npm test -- --run 脚本/UI回归核心.test.mjs
```

Expected: FAIL，提示 `解析门禁环境` 未导出。

实现后重复同一命令，Expected: PASS。

同时让 `脚本/UI回归.mjs` 调用 `解析门禁环境(process.env)`，并把规范化后的 `UI_VISUAL_GATE` 与 `UI_CHANGE_APPROVED` 传给 `npm run ui:compare`；不要把未知字符串原样传入比较器。

- [ ] **Step 3: 创建 GitHub Actions workflow**

`.github/workflows/ui-regression.yml` 使用：

```yaml
name: UI Regression

on:
  pull_request:
    types: [opened, synchronize, reopened, labeled, unlabeled]

permissions:
  contents: read

jobs:
  ui-regression:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Compare candidate UI with PR base
        run: npm run ui:check -- --base "origin/${{ github.base_ref }}"
        env:
          CI: 'true'
          UI_VISUAL_GATE: ${{ vars.UI_VISUAL_GATE || 'report' }}
          UI_CHANGE_APPROVED: ${{ contains(github.event.pull_request.labels.*.name, 'ui-change-approved') }}
      - name: Upload UI regression report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ui-regression-report
          path: |
            ui-regression-output/latest/report.json
            ui-regression-output/latest/report.md
            ui-regression-output/latest/infrastructure-error.json
          if-no-files-found: warn
          retention-days: 14
      - name: Upload UI regression evidence
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: ui-regression-evidence
          path: |
            ui-regression-output/latest/reference
            ui-regression-output/latest/candidate
            ui-regression-output/latest/diff
          if-no-files-found: warn
          retention-days: 14
```

不要给 workflow 写入写权限。不要自动创建、添加或移除标签。

- [ ] **Step 4: 文档记录外部仓库设置**

在 `docs/UI回归巡检.md` 明确写出两个需要仓库管理员执行、代码无法自行完成的步骤：

1. 创建 repository variable `UI_VISUAL_GATE=report`；报告期结束并校准阈值后改为 `enforce`。
2. 创建 label `ui-change-approved`，并在 branch protection 中把 `UI Regression / ui-regression` 设为 required status check。

文档必须注明：label 只能由审查者在查看 diff 后添加；结构、API 隔离和基础设施错误不会被 label 放行。

- [ ] **Step 5: 本地模拟 CI 环境**

Run:

```bash
CI=true UI_VISUAL_GATE=report UI_CHANGE_APPROVED=false npm run ui:check -- --base HEAD --output ui-regression-output/ci-simulation
```

Expected: exit `0`，报告包含 `visualGate: report` 与 `uiChangeApproved: false`。

- [ ] **Step 6: 提交 CI 门禁**

```bash
git add .github/workflows/ui-regression.yml 脚本/UI回归.mjs 脚本/UI回归核心.mjs 脚本/UI回归核心.test.mjs docs/UI回归巡检.md
git commit -m "ci: add staged UI regression gate"
```

---

### Task 7: 完成 `agent-browser` 巡检手册与可复现实验

**Files:**
- Modify: `docs/UI回归巡检.md`
- Create: `docs/UI回归报告模板.md`

**Interfaces:**
- Consumes: 15 个稳定场景 ID、candidate Mock URL、`agent-browser` 的 snapshot/error/console/network/screenshot/record 命令。
- Produces: 大型分支合并前可重复执行的人工巡检协议和 `agent-scan-report.md` 格式。

- [ ] **Step 1: 写巡检报告模板**

`docs/UI回归报告模板.md` 固定包含：

```markdown
# Agent UI Scan Report

- Candidate commit:
- Base ref:
- Target URL:
- Device: iPhone 13 / 390x844
- Data source: mock/stg
- Started at:

## Summary

- Passed scenes: 0
- Warnings: 0
- Issues: 0

## Scene Results

| Scene ID | Result | Console/Page Errors | Evidence |
|---|---|---|---|

## Issues

### ISSUE-001

- Severity:
- Scene ID:
- Reproduction:
- Expected:
- Actual:
- Screenshot:
- Video:
```

这些空字段属于报告模板本身；执行巡检时必须填满 header 与所有实际 issue。

- [ ] **Step 2: 写直接可执行的 `agent-browser` 流程**

在 `docs/UI回归巡检.md` 加入：

```bash
mkdir -p ui-regression-output/agent-scan/screenshots ui-regression-output/agent-scan/videos
VITE_DATA_SOURCE=mock VITE_BACKEND_ENV=stg npm run dev -- --host 127.0.0.1 --port 4176 --strictPort
agent-browser --session ui-regression open http://127.0.0.1:4176
agent-browser --session ui-regression wait --load networkidle
agent-browser --session ui-regression snapshot -i
agent-browser --session ui-regression errors
agent-browser --session ui-regression console
agent-browser --session ui-regression network requests
agent-browser --session ui-regression screenshot --annotate ui-regression-output/agent-scan/screenshots/entry-login-default.png
```

手册要求：

- 按 `docs/superpowers/specs/2026-08-26-ui-regression-baseline-design.md` 第 9 节顺序走 15 个场景。
- 页面变化后重新 snapshot，不复用 stale ref。
- 静态问题只保存 annotated screenshot。
- 交互/时序问题先复验一次，再在动作前 `record start`，结束后 `record stop`。
- 每页检查 `errors`、`console` 和 `network requests`；发现 `/api/v1` 即记录为 blocker。
- 结束时执行 `agent-browser --session ui-regression close` 并停止 Vite。
- `agent-browser` 报告不改变 Playwright 退出码。

- [ ] **Step 3: 用当前分支执行一次真实巡检**

执行时先读取当前安装版本的说明：

```bash
agent-browser skills get core --full
agent-browser skills get dogfood
```

然后按手册完成 15 个场景，生成：

```text
ui-regression-output/agent-scan/agent-scan-report.md
ui-regression-output/agent-scan/screenshots/
ui-regression-output/agent-scan/videos/
```

Expected: 每个场景在报告中恰有一行；正常静态场景不录视频；发现的问题具有可复现证据。产物位于 ignored 目录，不提交截图和视频。

- [ ] **Step 4: 提交巡检手册**

```bash
git add docs/UI回归巡检.md docs/UI回归报告模板.md
git commit -m "docs: add agent-browser UI scan runbook"
```

---

### Task 8: 故障注入、全量回归与交付验收

**Files:**
- Modify only if verification exposes a defect: files created in Tasks 1–7

**Interfaces:**
- Consumes: 全部公开命令、candidate-only 自测钩子和 CI 门禁规则。
- Produces: 通过规格第 15 节全部验收项的可执行系统；不新增接口。

- [ ] **Step 1: 跑静态质量检查和现有回归**

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

Expected: 全部 PASS。若现有测试因新增 Vitest exclude 规则误收 Playwright spec，先修 `vitest.config.ts`，不得跳过测试。

- [ ] **Step 2: 验证同提交无漂移和 Mock 隔离**

Run:

```bash
UI_VISUAL_GATE=enforce npm run ui:check -- --base HEAD --output ui-regression-output/final-same
```

Expected: exit `0`；15 个场景都有结果；无 API 请求；所有相同场景低于 warning 阈值；没有残留临时 worktree。

- [ ] **Step 3: 验证 20px 位移被结构门禁拦截**

Run:

```bash
UI_VISUAL_GATE=enforce UI_CANDIDATE_MUTATION=shift npm run ui:check -- --base HEAD --output ui-regression-output/final-shift
```

Expected: exit `1`；报告包含位移超过 `16px` 的 structure reason；即使设置 `UI_CHANGE_APPROVED=true` 仍退出 `1`。

- [ ] **Step 4: 验证横向溢出与 page error 被拦截**

Run:

```bash
UI_VISUAL_GATE=enforce UI_CANDIDATE_MUTATION=overflow npm run ui:check -- --base HEAD --output ui-regression-output/final-overflow
UI_VISUAL_GATE=enforce UI_CANDIDATE_MUTATION=pageerror npm run ui:check -- --base HEAD --output ui-regression-output/final-pageerror
```

Expected: 两条都 exit `1`；报告分别出现 horizontal overflow 与 `UI regression self-test`，类别均为 structure。

- [ ] **Step 5: 验证视觉报告期与正式门禁差异**

使用 Task 1 合成 PNG 测试确认 `0.5%–5%` 为 warning、`>5%` 为 blocked，并运行：

```bash
UI_VISUAL_GATE=report UI_CANDIDATE_MUTATION=shift npm run ui:check -- --base HEAD --output ui-regression-output/final-report-mode
```

Expected: 结构位移仍 exit `1`。这一步证明 report 模式只放宽 visual，不放宽 structure。

- [ ] **Step 6: 检查产物、清理和性能**

Run:

```bash
git worktree list
find ui-regression-output/final-shift -maxdepth 3 -type f | sort
git status --short
```

Expected:

- worktree 列表只有实施前已存在的工作树。
- 失败目录包含 report JSON/Markdown、reference、candidate 和 diff/trace 证据。
- `git status --short` 不列出 `ui-regression-output/`。
- 一次 15 场景双版本检查在 CI 目标环境中少于 5 分钟；若超过，先记录每阶段耗时，只优化依赖安装缓存和服务启动，不减少场景。

- [ ] **Step 7: 最终提交（仅在验证修复产生改动时）**

如果 Steps 1–6 暴露问题并产生修复：

```bash
git add package.json package-lock.json vitest.config.ts playwright.视觉回归.config.ts e2e/视觉回归 脚本/UI回归.mjs 脚本/UI回归核心.mjs 脚本/UI回归核心.test.mjs .github/workflows/ui-regression.yml .gitignore docs/UI回归巡检.md docs/UI回归报告模板.md
git commit -m "test: harden UI regression delivery checks"
```

如果没有文件变化，不创建空提交。

- [ ] **Step 8: 交付说明**

交付消息必须包含：

- `npm run ui:check` 的使用方式。
- 本次同提交检查、故障注入、现有单测和 E2E 的真实结果与耗时。
- 报告与 diff 的本地目录。
- GitHub 管理员仍需设置的 repository variable、label 和 required status check。
- 两周报告期结束后把 `UI_VISUAL_GATE` 从 `report` 切为 `enforce` 的操作提醒。
