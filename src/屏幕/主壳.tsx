// 主壳：3 Tab（职位 / 消息 / 我的）+ 职位页内部「在谈 / 看市场」双子视图。
// 玻璃导航栏只在这一屏出现；Tab 与子视图状态放在全局 store，
// 因此从次级页返回时还停在原来那个 Tab 和子视图上。
// P7 Task 3：Backend 模式首屏（非消息 Tab 也算）非 force 水合候选端 P7 收件箱 ——
// 消息 Tab 角标在用户打开消息 Tab 之前就已由已加载未读就绪；Mock 零 P7 请求。

import { useEffect } from 'react';
import 玻璃导航栏 from '../组件/玻璃导航栏';
import { use应用状态 } from '../状态/应用状态';
import 在谈首页 from './在谈首页';
import 看市场 from './看市场';
import 消息列表 from './消息列表';
import 我的 from './我的';

export default function 主壳() {
  const { 状态, 数据源模式, 操作 } = use应用状态();

  // Backend：进入候选端主壳即水合第一页（非 force：已有成功快照则零请求）。
  // 单飞在操作层；StrictMode 卸载重挂不会死锁。Mock 模式早退，零 P7 请求。
  useEffect(() => {
    if (数据源模式 !== 'backend') return;
    void 操作.加载会话列表('candidate');
  }, [数据源模式, 操作]);

  return (
    <div style={{ position: 'relative', height: '100%', background: 'var(--页面底)' }}>
      {状态.当前Tab === '职位' && (状态.子视图 === '在谈' ? <在谈首页 /> : <看市场 />)}
      {状态.当前Tab === '消息' && <消息列表 />}
      {状态.当前Tab === '我的' && <我的 />}
      <玻璃导航栏 />
    </div>
  );
}