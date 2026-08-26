// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { 决定采集模式, 解析UI回归参数, 解析门禁环境 } from './UI回归核心.mjs';

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

  it('解析门禁环境：未知/空值回落到 report，只有字面量 true 才表示审批', () => {
    expect(解析门禁环境({})).toEqual({ visualGate: 'report', uiChangeApproved: false });
    expect(解析门禁环境({ UI_VISUAL_GATE: undefined, UI_CHANGE_APPROVED: undefined })).toEqual({
      visualGate: 'report',
      uiChangeApproved: false,
    });
    expect(解析门禁环境({ UI_VISUAL_GATE: '', UI_CHANGE_APPROVED: '' })).toEqual({
      visualGate: 'report',
      uiChangeApproved: false,
    });
    expect(解析门禁环境({ UI_VISUAL_GATE: 'unknown', UI_CHANGE_APPROVED: 'unknown' })).toEqual({
      visualGate: 'report',
      uiChangeApproved: false,
    });
    expect(解析门禁环境({ UI_VISUAL_GATE: 'enforce', UI_CHANGE_APPROVED: 'true' })).toEqual({
      visualGate: 'enforce',
      uiChangeApproved: true,
    });
    expect(解析门禁环境({ UI_VISUAL_GATE: 'report', UI_CHANGE_APPROVED: 'false' })).toEqual({
      visualGate: 'report',
      uiChangeApproved: false,
    });
    // 非 'true' 字面量一律不视为审批
    expect(解析门禁环境({ UI_CHANGE_APPROVED: 'TRUE' }).uiChangeApproved).toBe(false);
    expect(解析门禁环境({ UI_CHANGE_APPROVED: '1' }).uiChangeApproved).toBe(false);
    expect(解析门禁环境({ UI_CHANGE_APPROVED: true }).uiChangeApproved).toBe(false);
  });
});