// P0 修复 Task 6：viewport 的可访问性合同 —— safe-area 内缩保留，浏览器缩放
// 永远不许再被关掉（user-scalable=no / maximum-scale=1 / minimum-scale=1）。
// 走仓库既有的 ?raw 源码合同模式（应用 tsconfig 只挂 vite/client 类型，不用 node:fs）。

import { describe, expect, it } from 'vitest';
import html from '../../index.html?raw';

describe('viewport 可访问性合同', () => {
  it('保留 safe area 并允许用户缩放', () => {
    expect(html).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
    );
    expect(html).not.toMatch(/user-scalable\s*=\s*no/i);
    expect(html).not.toMatch(/maximum-scale\s*=\s*1/i);
    expect(html).not.toMatch(/minimum-scale\s*=\s*1/i);
  });
});
