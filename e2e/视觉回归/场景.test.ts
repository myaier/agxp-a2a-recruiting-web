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
});