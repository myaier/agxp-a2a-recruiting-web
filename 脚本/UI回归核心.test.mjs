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