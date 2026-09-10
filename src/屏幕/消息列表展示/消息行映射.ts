// 消息行映射（P1 Task 4）—— Mock 消息条目 与 Backend P7 会话项 各自收拢成同一份
// 会话行数据。只做同步字段映射：不读 Context、不读 fixture、不路由、不请求。
//
// 未读语义按数据来源分家（spec §4.2）：
//   Mock   undefined = 已读（无标记）、0 = 红点（有未读不计数）、正数 = 数字胶囊；
//   Backend unread_count = 0 = 无标记、正数 = 数字胶囊 —— 不误套 Mock 的 0 红点语义。
//
// Backend 角色映射原样搬自 P7/Backend会话列表（spec §4.1）：候选端标题 = 职位、
// 副标题 = 地点；招聘端反转 = 候选代号 / 职位。context 不可用只降级展示：标题统一
// 「会话信息暂不可用」、副标题留空（不生成会被误当身份的未知姓名）。last_message=null
// 保留「已建立真人会话」；时间沿用原 MM-DD 短格式（只从字符串取段，不读本地时钟）。

import type { P7角色, P7会话项 } from '../../数据/招聘数据源/真人会话';
import type { 消息条目 } from '../../数据/类型';
import type { 会话行数据, 未读展示 } from './类型';

/** Mock 未读：undefined = 已读、0 = 红点、正数 = 数字 */
function Mock未读展示(未读: number | undefined): 未读展示 {
  if (未读 === undefined) return { 种类: '无' };
  if (未读 > 0) return { 种类: '数字', 数量: 未读 };
  return { 种类: '红点' };
}

export function 从Mock消息行(条: 消息条目, 未读: number | undefined, 按下: () => void): 会话行数据 {
  return {
    键: 条.编号,
    标题: 条.标题,
    副标题: 条.副标题,
    时间: 条.时间,
    摘要: 条.摘要,
    头像: 条.类型 === 'AI代理'
      ? { 种类: '代理' }
      // 真人 / 直聊：数据里带的底色 + 姓氏首字（无图片资源，用首字占位）
      : { 种类: '字标', 字: 条.首字 ?? '', 底色: 条.底色 ?? 'var(--最弱)' },
    未读: Mock未读展示(未读),
    按下,
  };
}

/** RFC3339 的确定性短显示（MM-DD）：只从字符串本身取段，不读本地时钟。 */
function 取会话时间(iso: string): string {
  const 月 = iso.slice(5, 7);
  const 日 = iso.slice(8, 10);
  return `${月}-${日}`;
}

export function 从Backend消息行(条: P7会话项, role: P7角色, 按下: () => void): 会话行数据 {
  // 角色专属字段映射：context 不可用时标题统一降级、副标题留空（消息仍可读写）。
  const 标题 = 条.contextStatus !== 'available' || 条.context === null
    ? '会话信息暂不可用'
    : role === 'candidate'
      ? 条.context.primaryLabel
      : 条.context.secondaryLabel;
  const 副标题 = 条.contextStatus !== 'available' || 条.context === null
    ? ''
    : role === 'candidate'
      ? 条.context.secondaryLabel
      : 条.context.primaryLabel;
  return {
    键: 条.conversationId,
    标题,
    副标题,
    时间: 取会话时间(条.lastActivityAt),
    摘要: 条.lastMessage?.preview ?? '已建立真人会话',
    // 头像继续用中性「会」标志，不从姓名或 Mock fixture 派生首字
    头像: { 种类: '字标', 字: '会', 底色: 'var(--最弱)' },
    未读: 条.unreadCount > 0 ? { 种类: '数字', 数量: 条.unreadCount } : { 种类: '无' },
    未读测试标识: `unread-${条.conversationId}`,
    按下,
  };
}