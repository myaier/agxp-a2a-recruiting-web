// 企业端主壳：3 Tab（人才 / 消息 / 我的）+ 人才页「在谈 / 推荐」双子视图。
// 与求职端主壳同构（职位 Tab ↔ 人才 Tab）；玻璃导航独立于求职端的，
// 因为两端 Tab 集不同、图标不同，混在一个组件里反而互相牵制。

import { use应用状态 } from '../状态/应用状态';
import { 公文包图标, 气泡图标, 人像图标 } from '../组件/图标';
import 导航样式 from '../组件/玻璃导航栏.module.css';
import 企业在谈候选 from './企业在谈候选';
import 候选推荐 from './候选推荐';
import 企业消息 from './企业消息';
import 企业我的 from './企业我的';

const 导航项 = [
  { 键: '人才', 图标: 公文包图标 },
  { 键: '消息', 图标: 气泡图标 },
  { 键: '我的', 图标: 人像图标 },
] as const;

export default function 企业主壳() {
  const { 状态, 派发 } = use应用状态();

  return (
    <div style={{ position: 'relative', height: '100%', background: 'var(--页面底)' }}>
      {状态.企业Tab === '人才' &&
        (状态.企业子视图 === '在谈' ? <企业在谈候选 /> : <候选推荐 />)}
      {状态.企业Tab === '消息' && <企业消息 />}
      {状态.企业Tab === '我的' && <企业我的 />}

      {/* 底部玻璃导航：复用求职端的样式模块，仅 Tab 集不同 */}
      <nav className={导航样式.外壳}>
        {导航项.map((项) => {
          const 选中 = 状态.企业Tab === 项.键;
          const 图标 = 项.图标;
          return (
            <button
              key={项.键}
              className={`${导航样式.项} 可点`}
              onClick={() => 派发({ 型: '企业切Tab', Tab: 项.键 })}
              aria-current={选中 ? 'page' : undefined}
            >
              <span className={导航样式.图标位}>
                <图标 色={选中 ? 'var(--橄榄)' : 'var(--最弱)'} 线宽={选中 ? 1.9 : 1.8} />
              </span>
              <span className={`${导航样式.文字} ${选中 ? 导航样式.选中 : ''}`}>{项.键}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
