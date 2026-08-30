// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { 判定整栈结果, 写整栈报告, 读取运行分片 } from './报告';
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
