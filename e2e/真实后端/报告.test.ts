// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { 判定整栈结果, 生成整栈报告, 构造候选视觉清单, 写整栈报告, 读取运行分片 } from './报告';
import type { 整栈运行上下文 } from './报告';
import { 真实后端场景们 } from './视觉/场景清单';
import type { 整栈报告, 旅程ID, 旅程结果 } from './类型';

const 临时目录们: string[] = [];

function 新目录(): string {
  const 目录 = mkdtempSync(join(tmpdir(), 'backend-report-test-'));
  临时目录们.push(目录);
  return 目录;
}

function 分片(journey: 旅程ID, status: 旅程结果['status'], 覆盖: Partial<旅程结果> = {}): 旅程结果 {
  return {
    schemaVersion: 1,
    journey,
    status,
    milestone: status === 'skipped' ? '未选中' : '旅程完成',
    apiRequests: status === 'skipped' ? [] : ['GET /api/v1/me/resume'],
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    screenshots: [],
    failure: null,
    ...覆盖,
  };
}

function 写分片(目录: string, 值: 旅程结果 | Record<string, unknown>, 文件名?: string): void {
  const 名 = 文件名 ?? `${(值 as 旅程结果).journey}.json`;
  writeFileSync(join(目录, 名), JSON.stringify(值), 'utf8');
}

function 写全部跳过(目录: string, 选中: 旅程ID[]): void {
  const 全部: 旅程ID[] = ['candidate-load', 'candidate-crud', 'recruiter-load', 'recruiter-crud', 'session-isolation'];
  for (const 旅程 of 全部) {
    if (选中.includes(旅程)) continue;
    写分片(目录, 分片(旅程, 'skipped'));
  }
}

afterEach(() => {
  for (const 目录 of 临时目录们.splice(0)) rmSync(目录, { recursive: true, force: true });
});

describe('真实后端整栈 verdict', () => {
  it('基础设施阻塞不是 PASS', () => {
    expect(判定整栈结果({ reportParseError: false, infraBlocked: true, functionalFailed: false, cleanupFailed: false, visualBlocked: false, gate: 'report' }))
      .toEqual({ classification: 'INFRA_BLOCKED', exitCode: 75 });
  });
  it('report 模式只报告视觉漂移', () => {
    expect(判定整栈结果({ reportParseError: false, infraBlocked: false, functionalFailed: false, cleanupFailed: false, visualBlocked: true, gate: 'report' }))
      .toEqual({ classification: 'VISUAL_DRIFT', exitCode: 0 });
  });
  it('enforce、功能与清理失败返回 1', () => {
    expect(判定整栈结果({ reportParseError: false, infraBlocked: false, functionalFailed: false, cleanupFailed: false, visualBlocked: true, gate: 'enforce' }).exitCode).toBe(1);
    expect(判定整栈结果({ reportParseError: false, infraBlocked: false, functionalFailed: true, cleanupFailed: false, visualBlocked: false, gate: 'report' }).exitCode).toBe(1);
    expect(判定整栈结果({ reportParseError: false, infraBlocked: false, functionalFailed: false, cleanupFailed: true, visualBlocked: false, gate: 'report' }).exitCode).toBe(1);
  });
  it('报告分片解析错误返回 usage/reporting exit 2', () => {
    expect(判定整栈结果({ reportParseError: true, infraBlocked: false, functionalFailed: false, cleanupFailed: false, visualBlocked: false, gate: 'report' }))
      .toEqual({ classification: 'USAGE_ERROR', exitCode: 2 });
  });
  it('全部通过是 PASS 0，enforce 阻断归类为 VISUAL_DRIFT', () => {
    expect(判定整栈结果({ reportParseError: false, infraBlocked: false, functionalFailed: false, cleanupFailed: false, visualBlocked: false, gate: 'enforce' }))
      .toEqual({ classification: 'PASS', exitCode: 0 });
    expect(判定整栈结果({ reportParseError: false, infraBlocked: false, functionalFailed: false, cleanupFailed: false, visualBlocked: true, gate: 'enforce' }))
      .toEqual({ classification: 'VISUAL_DRIFT', exitCode: 1 });
  });
  it('优先级：解析错误 > 基础设施 > 清理 > 功能 > 视觉', () => {
    expect(判定整栈结果({ reportParseError: true, infraBlocked: true, functionalFailed: true, cleanupFailed: true, visualBlocked: true, gate: 'enforce' }).classification).toBe('USAGE_ERROR');
    expect(判定整栈结果({ reportParseError: false, infraBlocked: true, functionalFailed: true, cleanupFailed: true, visualBlocked: true, gate: 'enforce' }).classification).toBe('INFRA_BLOCKED');
    expect(判定整栈结果({ reportParseError: false, infraBlocked: false, functionalFailed: true, cleanupFailed: true, visualBlocked: true, gate: 'enforce' }))
      .toEqual({ classification: 'CLEANUP_FAILED', exitCode: 1 });
    expect(判定整栈结果({ reportParseError: false, infraBlocked: false, functionalFailed: true, cleanupFailed: false, visualBlocked: true, gate: 'enforce' }))
      .toEqual({ classification: 'FUNCTIONAL_FAILED', exitCode: 1 });
  });
});

describe('读取运行分片', () => {
  it('五个分片齐全且通过时不产生任何失败标记', () => {
    const 目录 = 新目录();
    const 选中: 旅程ID[] = ['candidate-load', 'candidate-crud', 'recruiter-load', 'recruiter-crud', 'session-isolation'];
    for (const 旅程 of 选中) 写分片(目录, 分片(旅程, 'pass'));

    const 结果 = 读取运行分片({ fragmentDir: 目录, selectedJourneys: 选中 });
    expect(结果.journeys.map((项) => 项.journey)).toEqual(选中);
    expect(结果).toMatchObject({ reportParseError: false, functionalFailed: false, infraBlocked: false });
    expect(结果.issues).toEqual([]);
  });

  it('单旅程模式下未选中旅程必须是 skipped 分片', () => {
    const 目录 = 新目录();
    写分片(目录, 分片('candidate-crud', 'pass'));
    写全部跳过(目录, ['candidate-crud']);

    const 结果 = 读取运行分片({ fragmentDir: 目录, selectedJourneys: ['candidate-crud'] });
    expect(结果.reportParseError).toBe(false);
    expect(结果.functionalFailed).toBe(false);
    expect(结果.journeys.filter((项) => 项.status === 'skipped')).toHaveLength(4);
  });

  it('已选分片缺失是功能失败，未选分片缺失是报告错误', () => {
    const 缺已选 = 新目录();
    写全部跳过(缺已选, ['candidate-crud']);
    const 甲 = 读取运行分片({ fragmentDir: 缺已选, selectedJourneys: ['candidate-crud'] });
    expect(甲.functionalFailed).toBe(true);
    expect(甲.reportParseError).toBe(false);
    expect(甲.journeys.find((项) => 项.journey === 'candidate-crud')?.status).toBe('failed');

    const 缺未选 = 新目录();
    写分片(缺未选, 分片('candidate-crud', 'pass'));
    const 乙 = 读取运行分片({ fragmentDir: 缺未选, selectedJourneys: ['candidate-crud'] });
    expect(乙.reportParseError).toBe(true);
  });

  it('未选中旅程写成非 skipped 状态是报告错误', () => {
    const 目录 = 新目录();
    写分片(目录, 分片('candidate-crud', 'pass'));
    写全部跳过(目录, ['candidate-crud', 'recruiter-load']);
    写分片(目录, 分片('recruiter-load', 'pass'));

    expect(读取运行分片({ fragmentDir: 目录, selectedJourneys: ['candidate-crud'] }).reportParseError).toBe(true);
  });

  it('已选中旅程写成 skipped 是功能失败', () => {
    const 目录 = 新目录();
    写分片(目录, 分片('candidate-crud', 'skipped'));
    写全部跳过(目录, ['candidate-crud']);

    const 结果 = 读取运行分片({ fragmentDir: 目录, selectedJourneys: ['candidate-crud'] });
    expect(结果.functionalFailed).toBe(true);
  });

  it('failed 是功能失败，blocked 是基础设施阻塞', () => {
    const 目录 = 新目录();
    写分片(目录, 分片('candidate-crud', 'failed', { failure: '简历姓名未回读' }));
    写分片(目录, 分片('recruiter-crud', 'blocked', { failure: '会话不可用' }));
    写全部跳过(目录, ['candidate-crud', 'recruiter-crud']);

    const 结果 = 读取运行分片({ fragmentDir: 目录, selectedJourneys: ['candidate-crud', 'recruiter-crud'] });
    expect(结果.functionalFailed).toBe(true);
    expect(结果.infraBlocked).toBe(true);
  });

  it('损坏 JSON、未知字段与 journey 名不符都是报告错误', () => {
    const 损坏 = 新目录();
    writeFileSync(join(损坏, 'candidate-crud.json'), '{不是 JSON', 'utf8');
    写全部跳过(损坏, ['candidate-crud']);
    expect(读取运行分片({ fragmentDir: 损坏, selectedJourneys: ['candidate-crud'] }).reportParseError).toBe(true);

    const 多字段 = 新目录();
    写分片(多字段, { ...分片('candidate-crud', 'pass'), cookie: '__Host-agxp_recruitment_session=x' });
    写全部跳过(多字段, ['candidate-crud']);
    expect(读取运行分片({ fragmentDir: 多字段, selectedJourneys: ['candidate-crud'] }).reportParseError).toBe(true);

    const 名不符 = 新目录();
    写分片(名不符, 分片('recruiter-crud', 'pass'), 'candidate-crud.json');
    写全部跳过(名不符, ['candidate-crud', 'recruiter-crud']);
    写分片(名不符, 分片('recruiter-crud', 'skipped'));
    expect(读取运行分片({ fragmentDir: 名不符, selectedJourneys: ['candidate-crud'] }).reportParseError).toBe(true);
  });

  it('apiRequests 只允许 METHOD + pathname，带查询串或完整 URL 是报告错误', () => {
    const 查询串 = 新目录();
    写分片(查询串, 分片('candidate-crud', 'pass', { apiRequests: ['GET /api/v1/me/resume?token=abc'] }));
    写全部跳过(查询串, ['candidate-crud']);
    expect(读取运行分片({ fragmentDir: 查询串, selectedJourneys: ['candidate-crud'] }).reportParseError).toBe(true);

    const 完整URL = 新目录();
    写分片(完整URL, 分片('candidate-crud', 'pass', { failedRequests: ['POST http://127.0.0.1:8097/api/v1/me/intentions'] }));
    写全部跳过(完整URL, ['candidate-crud']);
    expect(读取运行分片({ fragmentDir: 完整URL, selectedJourneys: ['candidate-crud'] }).reportParseError).toBe(true);
  });
});

function 样例报告(): 整栈报告 {
  return {
    schemaVersion: 1,
    classification: 'VISUAL_DRIFT',
    exitCode: 0,
    frontendCommit: 'aaaaaaa',
    backendCommit: 'bbbbbbb',
    agentBrowserVersion: '1.2.3',
    chromeBuild: '141.0.7390.54',
    stack: { preexisting: true, healthy: true },
    fixture: { converge: 'PASS', verify: 'PASS', cleanup: 'PASS' },
    journeys: [分片('candidate-load', 'pass'), 分片('candidate-crud', 'skipped')],
    visual: {
      schemaVersion: 1,
      gate: 'report',
      environment: 'matched',
      environmentIssue: null,
      scenes: [
        { sceneId: 'candidate-resume-loaded', status: 'blocked', pixelDiffRatio: 0.06, reference: '基线/candidate-resume-loaded.png', candidate: '候选/candidate-resume-loaded.png', diff: '差异/candidate-resume-loaded.png', reasons: ['像素差异 6.00%'] },
      ],
    },
  };
}

describe('写整栈报告', () => {
  it('写出可回读的 report.json 与含分类、退出码的 report.md', () => {
    const 目录 = 新目录();
    const 报告 = 样例报告();
    写整栈报告(报告, 目录);

    expect(JSON.parse(readFileSync(join(目录, 'report.json'), 'utf8'))).toEqual(报告);
    const md = readFileSync(join(目录, 'report.md'), 'utf8');
    expect(md).toContain('VISUAL_DRIFT');
    expect(md).toContain('退出码：0');
    expect(md).toContain('candidate-load');
    expect(md).toContain('candidate-resume-loaded');
  });
});

// ---- 运行器入口：生成整栈报告 ----

const 全部旅程: 旅程ID[] = ['candidate-load', 'candidate-crud', 'recruiter-load', 'recruiter-crud', 'session-isolation'];

function 搭运行现场(选项: { 失败旅程?: 旅程ID; 基线清单?: string } = {}): 整栈运行上下文 {
  const 根 = 新目录();
  const 分片目录 = join(根, 'journeys');
  const 基线目录 = join(根, 'baseline');
  mkdirSync(分片目录, { recursive: true });
  mkdirSync(基线目录, { recursive: true });
  for (const 旅程 of 全部旅程) {
    写分片(分片目录, 分片(旅程, 旅程 === 选项.失败旅程 ? 'failed' : 'pass'));
  }
  // 基线 PNG 只需要“存在”：候选目录整体缺图，比较在读像素之前就已经判成环境阻塞。
  for (const 场景 of 真实后端场景们) writeFileSync(join(基线目录, `${场景}.png`), '', 'utf8');
  writeFileSync(join(基线目录, '基线清单.json'), 选项.基线清单 ?? JSON.stringify({
    schemaVersion: 1,
    agentBrowserVersion: '0.27.2',
    chromeBuild: 'Chrome/141.0.7390.55',
    viewport: { width: 390, height: 844 },
    locale: 'zh-CN',
    timezone: 'Asia/Shanghai',
    colorScheme: 'light',
    deviceScaleFactor: 1,
    scenes: [...真实后端场景们],
    baselineCommit: '0000000',
  }), 'utf8');

  return {
    selectedJourneys: [...全部旅程],
    fragmentDir: 分片目录,
    outputDir: 根,
    gate: 'report',
    updateBaseline: false,
    cleanupFailed: false,
    infraBlocked: false,
    fixtureVerified: true,
    frontendCommit: 'abc1234',
    backendCommit: 'def5678',
    agentBrowserVersion: '0.27.2',
    chromeBuild: 'Chrome/141.0.7390.55',
    stack: { preexisting: true, healthy: true },
    fixture: { converge: 'PASS', verify: 'PASS', cleanup: 'PASS' },
    visual: {
      baselineManifestPath: join(基线目录, '基线清单.json'),
      baselineDir: 基线目录,
      candidateDir: join(根, 'visual/current'),
      diffDir: join(根, 'visual/diff'),
      reviewDir: join(根, 'visual/baseline-review'),
    },
  };
}

describe('生成整栈报告', () => {
  it('候选清单锁死取景常量与七个场景', () => {
    const 清单 = 构造候选视觉清单(搭运行现场());
    expect(清单.viewport).toEqual({ width: 390, height: 844 });
    expect(清单.locale).toBe('zh-CN');
    expect(清单.timezone).toBe('Asia/Shanghai');
    expect(清单.colorScheme).toBe('light');
    expect(清单.deviceScaleFactor).toBe(1);
    expect(清单.scenes).toEqual([...真实后端场景们]);
    expect(清单.baselineCommit).toBe('abc1234');
  });

  it('功能全过时视觉环境阻塞升级成 INFRA_BLOCKED 75，并写出报告', () => {
    const 上下文 = 搭运行现场();
    const 产出 = 生成整栈报告(上下文);
    expect(产出).toMatchObject({ classification: 'INFRA_BLOCKED', exitCode: 75 });
    const 报告 = JSON.parse(readFileSync(join(上下文.outputDir, 'report.json'), 'utf8'));
    expect(报告.visual.environmentIssue).toBe('expected-file-missing');
    expect(报告.journeys).toHaveLength(5);
    expect(报告.chromeBuild).toBe('Chrome/141.0.7390.55');
  });

  it('有旅程失败时缺图不再升级成基础设施阻塞：仍然是 FUNCTIONAL_FAILED 1', () => {
    const 产出 = 生成整栈报告(搭运行现场({ 失败旅程: 'candidate-crud' }));
    expect(产出).toMatchObject({ classification: 'FUNCTIONAL_FAILED', exitCode: 1 });
  });

  it('基线清单不合法时拒绝生成候选基线目录', () => {
    const 上下文 = { ...搭运行现场({ 基线清单: '{"schemaVersion":1}' }), updateBaseline: true };
    const 产出 = 生成整栈报告(上下文);
    expect(产出.classification).toBe('INFRA_BLOCKED');
    expect(产出.baselineReview).toBe('refused:manifest-invalid');
    expect(existsSync(上下文.visual.reviewDir)).toBe(false);
  });

  it('上下文不合法时抛错，由 CLI 转成 exit 2', () => {
    expect(() => 生成整栈报告({ ...搭运行现场(), gate: 'whatever' })).toThrow(/gate/);
    expect(() => 生成整栈报告({ ...搭运行现场(), selectedJourneys: [] })).toThrow(/selectedJourneys/);
    expect(() => 生成整栈报告(null)).toThrow();
  });
});
