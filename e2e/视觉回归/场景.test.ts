// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { 视觉场景们 } from './场景';

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
  'candidate-profile',
  'recruiter-card',
  'recruiter-post-job-1',
  'recruiter-post-job-2',
  'recruiter-post-job-3',
  'recruiter-home-candidate',
  // P8（Task 8）：Mock 账号与安全 / 反馈与举报 —— 钉住 Mock 页与基线像素/几何兼容
  'candidate-account-security',
  'candidate-feedback',
];

describe('视觉场景清单', () => {
  it('包含 18 个稳定且唯一的场景 ID', () => {
    expect(视觉场景们.map((场景) => 场景.id)).toEqual(预期ID);
    expect(new Set(视觉场景们.map((场景) => 场景.id)).size).toBe(18);
  });

  it('发布岗位第三步使用跨版本稳定的提交按钮作为关键元素', () => {
    const 场景 = 视觉场景们.find((候选) => 候选.id === 'recruiter-post-job-3');
    expect(场景).toBeDefined();

    const 空定位器 = { first: () => 空定位器 };
    const 假页面 = {
      getByRole: () => 空定位器,
      getByText: () => 空定位器,
    } as never;
    const 关键元素名称 = 场景!.关键元素(假页面).map((元素) => 元素.名称);

    expect(关键元素名称).toContain('按钮 发布岗位并开始寻访');
    expect(关键元素名称).not.toContain('文本 AI 初筛条件确认');
  });
});
