// A16 消息Tab · AI代理动态与真人会话
//
// 结构与行 JSX 统一收进 消息列表展示（P1 Task 4）：本文件只剩连接层 ——
// 页签/搜索 useState、过滤顺序、Mock 未读快照与「点击 = 派发 读消息 后导航」剧情。
// Backend 模式只渲染候选端 P7 收件箱（权威快照 + 参数路由导航），两条分支互不渗漏。

import { useMemo, useState } from 'react';
import Backend会话列表 from './P7/Backend会话列表';
import { 从Mock消息行 } from './消息列表展示/消息行映射';
import { 消息列表展示 } from './消息列表展示/消息列表展示';
import type { 消息页签 } from './消息列表展示/类型';
import { 消息列表 as 消息数据 } from '../数据/模拟数据';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import type { 消息条目 } from '../数据/类型';

/**
 * 模式分支：Backend 只渲染候选端 P7 收件箱（权威快照 + 参数路由导航），
 * Mock 保留既有 fixture、reducer 未读语义与无参路由剧情，二者互不渗漏。
 */
export default function 消息列表() {
  const { 数据源模式 } = use应用状态();
  return 数据源模式 === 'backend'
    ? <Backend会话列表 角色="candidate" />
    : <Mock消息列表 />;
}

function Mock消息列表() {
  const { 跳转 } = use导航();
  const { 状态, 派发 } = use应用状态();
  const [当前页签, 设当前页签] = useState<消息页签>('全部');
  const [搜索词, 设搜索词] = useState('');

  // 先按页签过滤（仅会话 = 去掉 AI代理动态；通知 = 只留 AI代理动态），
  // 再按搜索词在标题 / 副标题 / 摘要三个字段里做包含匹配。
  const 过滤后 = useMemo(() => {
    const 关键词 = 搜索词.trim();
    return 消息数据.filter((条) => {
      if (当前页签 === '仅会话' && 条.类型 === 'AI代理') return false;
      if (当前页签 === '通知' && 条.类型 !== 'AI代理') return false;
      if (!关键词) return true;
      return `${条.标题} ${条.副标题} ${条.摘要}`.includes(关键词);
    });
  }, [当前页签, 搜索词]);

  // 三种会话类型各自对应一个次级页
  const 取跳转路径 = (条: 消息条目) => {
    if (条.类型 === 'AI代理') return 路径.问AI代理;
    if (条.类型 === '直聊') return 路径.直聊会话;
    return 路径.真人会话;
  };

  /** 点行 = 读掉它再进会话。未读徽标与底部导航角标同源于 状态.消息未读，一次点两处一起消 */
  const 打开会话 = (条: 消息条目) => {
    派发({ 型: '读消息', 编号: 条.编号 });
    跳转(取跳转路径(条));
  };

  return (
    <消息列表展示
      页签={当前页签}
      改页签={设当前页签}
      搜索词={搜索词}
      改搜索词={设搜索词}
      搜索提示="搜索会话 / 公司 / 职位"
      前置提示={[]}
      行们={过滤后.map((条) => 从Mock消息行(条, 状态.消息未读[条.编号], () => 打开会话(条)))}
      后置提示={过滤后.length === 0
        ? [{ 键: '无匹配', 行们: ['没有匹配的会话。', '换个关键词，或者切到「全部」看看。'] }]
        : []}
    />
  );
}