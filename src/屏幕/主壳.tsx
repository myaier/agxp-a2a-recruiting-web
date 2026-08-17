// 主壳：3 Tab（职位 / 消息 / 我的）+ 职位页内部「在谈 / 看市场」双子视图。
// 玻璃导航栏只在这一屏出现；Tab 与子视图状态放在全局 store，
// 因此从次级页返回时还停在原来那个 Tab 和子视图上。

import 玻璃导航栏 from '../组件/玻璃导航栏';
import { use应用状态 } from '../状态/应用状态';
import 在谈首页 from './在谈首页';
import 看市场 from './看市场';
import 消息列表 from './消息列表';
import 我的 from './我的';

export default function 主壳() {
  const { 状态 } = use应用状态();

  return (
    <div style={{ position: 'relative', height: '100%', background: 'var(--页面底)' }}>
      {状态.当前Tab === '职位' && (状态.子视图 === '在谈' ? <在谈首页 /> : <看市场 />)}
      {状态.当前Tab === '消息' && <消息列表 />}
      {状态.当前Tab === '我的' && <我的 />}
      <玻璃导航栏 />
    </div>
  );
}
