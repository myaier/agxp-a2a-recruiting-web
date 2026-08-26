// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { 比较图片, 比较几何, 判定门禁, 比较采集目录, 默认比较阈值 } from './比较器';
import type { 场景采集结果 } from './类型';

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

  it('report 模式放宽视觉与覆盖，但仍阻断结构', () => {
    expect(判定门禁([{ status: 'blocked', categories: ['visual'] }], 'report', false)).toBe(0);
    expect(判定门禁([{ status: 'blocked', categories: ['visual'] }], 'report', true)).toBe(0);
    expect(判定门禁([{ status: 'removed', categories: ['coverage'] }], 'report', false)).toBe(0);
    expect(判定门禁([{ status: 'blocked', categories: ['structure'] }], 'report', false)).toBe(1);
    expect(判定门禁([{ status: 'blocked', categories: ['structure'] }], 'report', true)).toBe(1);
    expect(判定门禁([{ status: 'infrastructure', categories: ['infrastructure'] }], 'report', false)).toBe(2);
  });
});

function 捕获结果(sceneId: string): 场景采集结果 {
  return {
    schemaVersion: 1,
    sceneId,
    status: 'captured',
    url: `http://localhost/${sceneId}`,
    screenshot: null,
    viewport: { width: 1280, height: 720 },
    elements: [],
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    apiRequests: [],
    horizontalOverflow: 0,
    failure: null,
  };
}

function 写场景(dir: string, result: 场景采集结果): void {
  writeFileSync(join(dir, 'scenes', `${result.sceneId}.json`), JSON.stringify(result));
}

describe('UI 目录比较与报告', () => {
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

  it('候选采集无任何场景结果时报基础设施错误（采集整体失败不放过门禁）', () => {
    const 根 = 新目录();
    const reference = join(根, 'reference');
    const candidate = join(根, 'candidate');
    const output = join(根, 'report');
    mkdirSync(join(reference, 'scenes'), { recursive: true });
    // 候选 scenes 目录存在但为空：采集 spec 模块加载时已 mkdir，但 webServer 超时/
    // 浏览器崩溃导致没有 test 跑、没有 JSON 落盘。绝不能产出空通过报告。
    mkdirSync(join(candidate, 'scenes'), { recursive: true });
    写场景(reference, 捕获结果('removed'));

    expect(() =>
      比较采集目录({ referenceDir: reference, candidateDir: candidate, outputDir: output, visualGate: 'enforce', uiChangeApproved: false }),
    ).toThrow();

    expect(() =>
      比较采集目录({ referenceDir: null, candidateDir: candidate, outputDir: output, visualGate: 'enforce', uiChangeApproved: false }),
    ).toThrow();
  });
});