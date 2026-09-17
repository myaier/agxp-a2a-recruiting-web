// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { 视觉场景们 } from './场景';

const 预期ID = [
  'entry-login-default',
  'entry-identity',
  'candidate-preferences',
  'candidate-salary',
  'candidate-resume',
  // onboarding 与简历编辑（Task 5）：日常基本信息编辑、共用状态编辑、招聘三级类别
  'onboarding-resume-basic-edit',
  'onboarding-resume-status-edit',
  'candidate-market',
  'candidate-negotiations',
  'candidate-negotiation-detail',
  'candidate-messages',
  'candidate-profile',
  'recruiter-card',
  'recruiter-post-job-1',
  'recruiter-post-job-2',
  'recruiter-post-job-3',
  'onboarding-recruiter-category',
  'recruiter-home-candidate',
  // P8（Task 8）：Mock 账号与安全 / 反馈与举报 —— 钉住 Mock 页与基线像素/几何兼容
  'candidate-account-security',
  'candidate-feedback',
  // 企业名片统一（Task 3）：企业公开页 Mock 场景（统一展示的对照入口）
  'enterprise-public',
  // 聊天推荐前端修复（Task 6）：两端消息列表 / 真人聊天 / 招聘在线简历纸身
  'chat-recommend-frontend-candidate-messages',
  'chat-recommend-frontend-candidate-chat',
  'chat-recommend-frontend-recruiter-messages',
  'chat-recommend-frontend-recruiter-chat',
  'chat-recommend-frontend-recruiter-resume-paper',
];

describe('视觉场景清单', () => {
  // onboarding 与简历编辑（Task 5）：新增三个场景（日常基本信息编辑 / 共用状态编辑 /
  // 招聘三级类别），23 → 26；既有两个新增项（P8 两场景、企业公开页）与先行五个
  // chat-recommend-frontend 场景全部保留，不按旧固定数量覆盖。
  it('包含 26 个稳定且唯一的场景 ID', () => {
    expect(视觉场景们.map((场景) => 场景.id)).toEqual(预期ID);
    expect(new Set(视觉场景们.map((场景) => 场景.id)).size).toBe(26);
  });

  it('onboarding 与简历编辑场景前缀覆盖日常基本信息/状态编辑与招聘三级类别', () => {
    const 本轮场景 = 视觉场景们.filter(
      (场景) => 场景.id === 'onboarding-resume-basic-edit'
        || 场景.id === 'onboarding-resume-status-edit'
        || 场景.id === 'onboarding-recruiter-category',
    );
    expect(本轮场景.map((场景) => 场景.id)).toEqual([
      'onboarding-resume-basic-edit',
      'onboarding-resume-status-edit',
      'onboarding-recruiter-category',
    ]);
  });

  it('聊天推荐前端修复场景前缀一致且覆盖两端列表/聊天/招聘纸身', () => {
    const 修复场景 = 视觉场景们.filter((场景) => 场景.id.startsWith('chat-recommend-frontend'));
    expect(修复场景.map((场景) => 场景.id)).toEqual([
      'chat-recommend-frontend-candidate-messages',
      'chat-recommend-frontend-candidate-chat',
      'chat-recommend-frontend-recruiter-messages',
      'chat-recommend-frontend-recruiter-chat',
      'chat-recommend-frontend-recruiter-resume-paper',
    ]);
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
