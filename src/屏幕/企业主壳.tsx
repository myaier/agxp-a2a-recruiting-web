// 企业端主壳：3 Tab（人才 / 消息 / 我的）+ 人才页「在谈 / 推荐」双子视图。
// 与求职端主壳同构（职位 Tab ↔ 人才 Tab）；玻璃导航独立于求职端的，
// 因为两端 Tab 集不同、图标不同，混在一个组件里反而互相牵制。
// P7 Task 3：Backend 模式首屏非 force 水合招聘端 P7 收件箱（镜像求职端主壳）。

import { useEffect } from 'react';
import { use应用状态, 数未读 } from '../状态/应用状态';
import { 数P7已加载未读 } from '../状态/后端/真人会话操作';
import { 公文包图标, 气泡图标, 人像图标 } from '../组件/图标';
import 导航样式 from '../组件/玻璃导航栏.module.css';
import 企业在谈候选 from './企业在谈候选';
import 候选推荐 from './候选推荐';
import 企业消息 from './企业消息';
import 企业我的 from './企业我的';

const 导航项 = [
  { 键: '人才', 名: '人才', 图标: 公文包图标 },
  { 键: '消息', 名: '消息', 图标: 气泡图标 },
  { 键: '我的', 名: '我', 图标: 人像图标 },
] as const;

export default function 企业主壳() {
  const { 状态, 派发, 数据源模式, 后端状态, 操作 } = use应用状态();
  // 未读角标挂在「消息」上：Backend 只汇总已加载招聘端收件箱的未读（不是账号全量）；
  // Mock 沿用 reducer 未读表（镜像求职端 玻璃导航栏，共用同一套样式与同一个算法）。
  const 未读总数 = 数据源模式 === 'backend'
    ? 数P7已加载未读(后端状态.P7收件箱.recruiter.items)
    : 数未读(状态.企业消息未读);

  // Backend：进入招聘端主壳即水合第一页（非 force：已有成功快照则零请求）。
  useEffect(() => {
    if (数据源模式 !== 'backend') return;
    void 操作.加载会话列表('recruiter');
  }, [数据源模式, 操作]);

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
                {项.键 === '消息' && 未读总数 > 0 ? (
                  <span className={`${导航样式.角标} 等宽数字`}>{未读总数}</span>
                ) : null}
              </span>
              <span className={`${导航样式.文字} ${选中 ? 导航样式.选中 : ''}`}>{项.名}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
