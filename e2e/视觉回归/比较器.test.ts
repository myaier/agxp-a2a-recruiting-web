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