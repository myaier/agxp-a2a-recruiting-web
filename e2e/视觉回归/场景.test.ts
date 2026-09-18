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
  // 六维展示对齐（Task 10）：解释展示细节 + 四卡传回调态（含 360/320 窄屏）
  'match-explanation-detail-four-states',
  'match-explanation-detail-four-states-320',
  'match-explanation-skills-partial-zero',
  'match-explanation-missing',
  'match-explanation-list-popup',
  'match-explanation-recruiter-resume-analysis',
  'match-explanation-card-market-390',
  'match-explanation-card-market-360',
  'match-explanation-card-market-320',
  'match-explanation-card-deals-390',
  'match-explanation-card-deals-320',
  'match-explanation-card-hr-deals-390',
];

describe('视觉场景清单', () => {
  // onboarding 与简历编辑（Task 5）：新增三个场景（日常基本信息编辑 / 共用状态编辑 /
  // 招聘三级类别）；Task 10 再加十三个 match-explanation-* 场景 —— 26 → 39；
  // 既有 P8 两场景、企业公开页与 chat-recommend-frontend 场景全部保留，不按旧固定数量覆盖。
  it('包含 38 个稳定且唯一的场景 ID', () => {
    expect(视觉场景们.map((场景) => 场景.id)).toEqual(预期ID);
    expect(new Set(视觉场景们.map((场景) => 场景.id)).size).toBe(38);
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

  it('六维展示对齐场景前缀一致且覆盖四态/技能部分0/缺失/弹层/纸身分析与四卡传回调态', () => {
    const 六维场景 = 视觉场景们.filter((场景) => 场景.id.startsWith('match-explanation-'));
    expect(六维场景.map((场景) => 场景.id)).toEqual([
      'match-explanation-detail-four-states',
      'match-explanation-detail-four-states-320',
      'match-explanation-skills-partial-zero',
      'match-explanation-missing',
      'match-explanation-list-popup',
      'match-explanation-recruiter-resume-analysis',
      'match-explanation-card-market-390',
      'match-explanation-card-market-360',
      'match-explanation-card-market-320',
      'match-explanation-card-deals-390',
      'match-explanation-card-deals-320',
      'match-explanation-card-hr-deals-390',
    ]);
    // Task 4 视觉义务：三张 Mock 可捕获的共享卡有传回调态场景（招聘推荐卡的回调只在
    // Backend 数据源存在，采集固定 mock 源无法捕获 —— 44px 入口几何与截图证据在
    // 展示与交互 卡片统一 Backend 用例）；带薪资串的市场/在谈卡覆盖 320/360 窄屏。
    const 宽度们 = 六维场景.map((场景) => 场景.id);
    expect(宽度们.filter((id) => id.includes('-320')).length).toBeGreaterThanOrEqual(3);
    expect(宽度们.filter((id) => id.includes('-360')).length).toBe(1);
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
