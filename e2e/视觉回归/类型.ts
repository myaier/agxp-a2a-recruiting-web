// 可序列化的稳定接口（纯比较核心，不依赖浏览器对象）。
// Locator / Page / 视觉场景 / 关键元素描述 留到 Task 3 的 场景.ts。

export type 场景状态种子 = '未登录' | '求职端已注册' | '招聘端已注册';

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