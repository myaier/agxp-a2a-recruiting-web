// P7 Backend 收件箱（双角色共用）：只读 后端状态.P7收件箱[role] 的内存快照与
// 真人会话操作，绝不 import Mock 消息 fixture。结构与行 JSX 统一收进 消息列表展示
// （P1 Task 4），字段映射收进 消息行映射（候选端标题 = 职位、副标题 = 地点；招聘端
// 反转）；本文件只剩连接层 —— 可见范围登记/注销、force 首读、分页、重试、本地过滤。
// context 不可用只降级展示；unread_count=0 无红点、>0 数字胶囊；点行只走参数路由
// 导航（Builder），已读由会话页 read-through 回执收敛 —— 绝不派发 读消息/企业读消息、
// 绝不本地清零。「全部」和「仅会话」展示同一已加载集合；「通知」是明确空态，不混入
// Mock AI 动态。搜索只过滤已加载项，不声称搜全部。

import { useEffect, useMemo, useState } from 'react';
import { 从Backend消息行 } from '../消息列表展示/消息行映射';
import { 消息列表展示 } from '../消息列表展示/消息列表展示';
import type { 消息页签 } from '../消息列表展示/类型';
import { use导航 } from '../../路由/导航钩子';
import { 路径 } from '../../路由/路径表';
import { use应用状态 } from '../../状态/应用状态';
import type { P7角色, P7会话项 } from '../../数据/招聘数据源/真人会话';

export default function Backend会话列表({ 角色: role }: { 角色: P7角色 }) {
  const { 跳转 } = use导航();
  const { 后端状态, 操作 } = use应用状态();
  const 快照 = 后端状态.P7收件箱[role];
  const [当前页签, 设当前页签] = useState<消息页签>('全部');
  const [搜索词, 设搜索词] = useState('');
  const 通知页签 = 当前页签 === '通知';

  // 进入消息 Tab：登记收件箱可见范围 + force 权威刷新（操作层单飞防重复）；
  // 卸载注销可见范围。事件层据此决定失效重拉的范围。
  useEffect(() => {
    操作.设置P7收件箱范围(role, true);
    void 操作.加载会话列表(role, true);
    return () => 操作.设置P7收件箱范围(role, false);
  }, [role, 操作]);

  // 本地搜索只过滤已加载项；「全部」与「仅会话」是同一已加载集合（P7 只有真人会话）。
  // 过滤字段与行展示同源：都走 从Backend消息行（角色反转/降级/摘要缺省一处说了算）。
  const 过滤后 = useMemo(() => {
    if (通知页签) return [];
    const 关键词 = 搜索词.trim();
    if (!关键词) return 快照.items;
    return 快照.items.filter((条) => {
      const 行 = 从Backend消息行(条, role, () => {});
      return `${行.标题} ${行.副标题} ${行.摘要}`.includes(关键词);
    });
  }, [快照.items, 通知页签, 搜索词, role]);

  /** 点行只导航到参数路由；已读由会话页 read-through 回执权威收敛，不本地清零。 */
  const 打开会话 = (条: P7会话项) => {
    跳转(role === 'candidate'
      ? 路径.真人会话路径(条.conversationId)
      : 路径.企业真人会话路径(条.conversationId));
  };

  // 状态区沿用原互斥条件，错误与缓存行可共存：错误/读入中在前，成功空页/搜索无命中在后。
  const 前置提示 = 通知页签
    ? []
    : [
      ...(快照.error !== null
        ? [{
          键: '错误',
          行们: [快照.error],
          操作: { 文案: '重试', 按下: () => void 操作.加载会话列表(role, true) },
        }]
        : []),
      ...(快照.阶段 !== '成功' && 快照.items.length === 0 && 快照.error === null
        ? [{ 键: '读入中', 行们: ['正在读入会话…'] }]
        : []),
    ];
  const 后置提示 = 通知页签
    ? [{ 键: '通知空', 行们: ['还没有通知'] }]
    : [
      ...(快照.阶段 === '成功' && 快照.items.length === 0 && 搜索词.trim() === ''
        ? [{ 键: '空', 行们: ['还没有真人会话'] }]
        : []),
      ...(过滤后.length === 0 && 搜索词.trim() !== '' && 快照.items.length > 0
        ? [{ 键: '无匹配', 行们: ['没有匹配的会话。', '换个关键词，或者切到「全部」看看。'] }]
        : []),
    ];

  return (
    <消息列表展示
      页签={当前页签}
      改页签={设当前页签}
      搜索词={搜索词}
      改搜索词={设搜索词}
      搜索提示={role === 'candidate' ? '搜索会话 / 公司 / 职位' : '搜索会话 / 候选 / 岗位'}
      前置提示={前置提示}
      行们={通知页签
        ? []
        : 过滤后.map((条) => 从Backend消息行(条, role, () => 打开会话(条)))}
      后置提示={后置提示}
      加载更多={!通知页签 && 快照.nextCursor !== null
        ? () => void 操作.追加会话列表(role)
        : undefined}
    />
  );
}