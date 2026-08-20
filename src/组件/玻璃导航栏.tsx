// 底部毛玻璃悬浮胶囊导航：职位 / 消息 / 我的。只在三个主 Tab 页出现。

import 样式 from './玻璃导航栏.module.css';
import { 公文包图标, 气泡图标, 人像图标 } from './图标';
import { use应用状态 } from '../状态/应用状态';

const 导航项 = [
  { 键: '职位', 名: '职位', 图标: 公文包图标 },
  { 键: '消息', 名: '消息', 图标: 气泡图标 },
  { 键: '我的', 名: '我', 图标: 人像图标 },
] as const;

export default function 玻璃导航栏() {
  const { 状态, 派发 } = use应用状态();

  return (
    <nav className={样式.外壳}>
      {导航项.map((项) => {
        const 选中 = 状态.当前Tab === 项.键;
        const 图标 = 项.图标;
        return (
          <button
            key={项.键}
            className={`${样式.项} 可点`}
            onClick={() => 派发({ 型: '切Tab', Tab: 项.键 })}
            aria-current={选中 ? 'page' : undefined}
          >
            <span className={样式.图标位}>
              <图标 色={选中 ? 'var(--橄榄)' : 'var(--最弱)'} 线宽={选中 ? 1.9 : 1.8} />
            </span>
            <span className={`${样式.文字} ${选中 ? 样式.选中 : ''}`}>{项.名}</span>
          </button>
        );
      })}
    </nav>
  );
}
