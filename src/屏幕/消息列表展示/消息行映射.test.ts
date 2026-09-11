// 消息行映射 · 表驱动测试（P1 Task 4）：Mock undefined/0/正数 → 无/红点/数字；
// Backend unread_count 0/正数 → 无/数字（不误套 Mock 0 红点语义）；两角色标题反转、
// context 不可用降级、lastMessage=null 摘要、RFC3339 短时间与原代码一致，点击回调原样透传。

import { describe, expect, it, vi } from 'vitest';
import type { P7会话项 } from '../../数据/招聘数据源/真人会话';
import type { 消息条目 } from '../../数据/类型';
import { 从Backend消息行, 从Mock消息行 } from './消息行映射';

function Mock条(覆盖: Partial<消息条目> = {}): 消息条目 {
  return {
    编号: 'X-02',
    类型: '直聊',
    标题: '陆知遥',
    副标题: 'MiniMax · 直聊中 · 未走AI代理',
    时间: '10:46',
    摘要: '新建岗，产品这边你是第一个，配 6 个工程师',
    首字: '陆',
    底色: '#8a6db8',
    ...覆盖,
  };
}

function Backend条(覆盖: Partial<P7会话项> = {}): P7会话项 {
  return {
    conversationId: '3003',
    caseId: 'mc_3003',
    kind: 'human_handoff',
    lastMessage: {
      messageId: '4004', senderRole: 'recruiter', preview: '收到！明天下午聊', createdAt: '2026-08-30T01:00:00Z',
    },
    lastActivityAt: '2026-08-30T01:00:00Z',
    unreadCount: 0,
    contextStatus: 'available',
    context: { primaryLabel: '后端工程师', secondaryLabel: '上海·浦东', jobRef: null, resumeRef: null },
    ...覆盖,
  };
}

describe('从Mock消息行', () => {
  it('未读表驱动：undefined→无、0→红点、正数→数字（数量原值）', () => {
    expect(从Mock消息行(Mock条(), undefined, () => {}).未读).toEqual({ 种类: '无' });
    expect(从Mock消息行(Mock条(), 0, () => {}).未读).toEqual({ 种类: '红点' });
    expect(从Mock消息行(Mock条(), 2, () => {}).未读).toEqual({ 种类: '数字', 数量: 2 });
  });

  it('字段原样透传，点击回调同一引用；AI代理→代理头像，真人/直聊→字标', () => {
    const 按下 = () => {};
    const 行 = 从Mock消息行(Mock条(), 2, 按下);
    expect(行.键).toBe('X-02');
    expect(行.标题).toBe('陆知遥');
    expect(行.副标题).toBe('MiniMax · 直聊中 · 未走AI代理');
    expect(行.时间).toBe('10:46');
    expect(行.摘要).toBe('新建岗，产品这边你是第一个，配 6 个工程师');
    expect(行.头像).toEqual({ 种类: '字标', 字: '陆', 底色: '#8a6db8' });
    expect(行.按下).toBe(按下);
    expect(从Mock消息行(Mock条({ 类型: 'AI代理' }), undefined, 按下).头像).toEqual({ 种类: '代理' });
  });

  it('首字/底色缺省：空字与最弱底，不生成假姓名', () => {
    expect(从Mock消息行(Mock条({ 首字: undefined, 底色: undefined }), undefined, () => {}).头像)
      .toEqual({ 种类: '字标', 字: '', 底色: 'var(--最弱)' });
  });
});

describe('从Backend消息行', () => {
  it('unread_count 表驱动：0→无标记、正数→数字（不误套 Mock 0 红点语义）', () => {
    expect(从Backend消息行(Backend条(), 'candidate', () => {}).未读).toEqual({ 种类: '无' });
    expect(从Backend消息行(Backend条({ unreadCount: 2 }), 'candidate', () => {}).未读)
      .toEqual({ 种类: '数字', 数量: 2 });
  });

  it('候选端标题=职位、副标题=地点；招聘端反转（不自行恢复真名）', () => {
    const 候选 = 从Backend消息行(Backend条(), 'candidate', () => {});
    expect(候选.标题).toBe('后端工程师');
    expect(候选.副标题).toBe('上海·浦东');
    const 招聘 = 从Backend消息行(Backend条(), 'recruiter', () => {});
    expect(招聘.标题).toBe('上海·浦东');
    expect(招聘.副标题).toBe('后端工程师');
  });

  it('context 不可用：标题统一「会话信息暂不可用」、副标题留空', () => {
    const 行 = 从Backend消息行(Backend条({ contextStatus: 'unavailable', context: null }), 'candidate', () => {});
    expect(行.标题).toBe('会话信息暂不可用');
    expect(行.副标题).toBe('');
  });

  it('last_message=null→「已建立真人会话」；时间 MM-DD 与原代码一致；其余字段与未读测试标识、点击透传', () => {
    const 按下 = vi.fn();
    const 行 = 从Backend消息行(Backend条({ lastMessage: null }), 'candidate', 按下);
    expect(行.键).toBe('3003');
    expect(行.摘要).toBe('已建立真人会话');
    expect(行.时间).toBe('08-30');
    expect(行.头像).toEqual({ 种类: '字标', 字: '会', 底色: 'var(--最弱)' });
    expect(行.未读测试标识).toBe('unread-3003');
    行.按下();
    expect(按下).toHaveBeenCalledTimes(1);
  });
});