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
//
// Task 2：可选本地资料参数（use会话列表资料 的本轮状态）。姓名/副标题/头像同取
// 一个本轮状态：available = 授权姓名（缺名给角色缺值文案，匿名不显代号）+ 企业·职位
// 副标题（缺企业只显示岗位、无孤立分隔符）+ 真实头像（有图无名仍是图，字标取姓名
// 首字）；unavailable = 「会话资料暂不可用」（行仍可点，不冒充身份）；loading/缺省
// = P7 viewer-safe 标签的既有展示（加载窗口不冒充身份）。context 不可用优先于一切
// 资料参数（P7 准入事实不在场就不消费 Case 身份）。

import type { P7角色, P7会话项 } from '../../数据/招聘数据源/真人会话';
import type { 消息条目 } from '../../数据/类型';
import { 取姓名首字 } from './会话资料映射';
import type { 会话资料状态 } from './会话资料映射';
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

export function 从Backend消息行(
  条: P7会话项,
  role: P7角色,
  按下: () => void,
  资料?: 会话资料状态,
): 会话行数据 {
  const 上下文在场 = 条.contextStatus === 'available' && 条.context !== null;
  let 标题: string;
  let 副标题: string;
  let 头像: 会话行数据['头像'];
  if (!上下文在场) {
    // P7 准入事实不在场：统一降级（不消费任何 Case 身份资料），消息仍可读写。
    标题 = '会话信息暂不可用';
    副标题 = '';
    头像 = { 种类: '字标', 字: '会', 底色: 'var(--最弱)' };
  } else if (资料 !== undefined && 资料.状态 === 'available') {
    const 对方 = 资料.资料;
    标题 = 对方.姓名 ?? (role === 'recruiter' ? '候选人姓名暂未提供' : '招聘者姓名暂未提供');
    // 缺企业只显示岗位（求职端缺企业只剩职务），两缺为空串 —— 绝无孤立分隔符
    副标题 = [对方.企业, 对方.职位].filter((段): 段 is string => 段 !== null).join(' · ');
    头像 = 对方.头像URL !== null
      ? { 种类: '图片', URL: 对方.头像URL, 回退字: 取姓名首字(对方.姓名) }
      : { 种类: '字标', 字: 取姓名首字(对方.姓名), 底色: 'var(--最弱)' };
  } else if (资料 !== undefined && 资料.状态 === 'unavailable') {
    // 本轮补读失败/失权：行保持可点，不拿 P7 代号或旧缓存冒充身份。
    标题 = '会话资料暂不可用';
    副标题 = '';
    头像 = { 种类: '字标', 字: '·', 底色: 'var(--最弱)' };
  } else {
    // 资料 === undefined（不编排，如 context 刚恢复）或本轮 loading：
    // 沿用 P7 viewer-safe 标签与中性「会」字标（加载窗口不冒充身份）。
    标题 = role === 'candidate' ? 条.context!.primaryLabel : 条.context!.secondaryLabel;
    副标题 = role === 'candidate' ? 条.context!.secondaryLabel : 条.context!.primaryLabel;
    头像 = { 种类: '字标', 字: '会', 底色: 'var(--最弱)' };
  }
  return {
    键: 条.conversationId,
    标题,
    副标题,
    时间: 取会话时间(条.lastActivityAt),
    摘要: 条.lastMessage?.preview ?? '已建立真人会话',
    头像,
    未读: 条.unreadCount > 0 ? { 种类: '数字', 数量: 条.unreadCount } : { 种类: '无' },
    未读测试标识: `unread-${条.conversationId}`,
    按下,
  };
}