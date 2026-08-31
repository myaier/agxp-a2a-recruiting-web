// 底部毛玻璃悬浮胶囊导航：职位 / 消息 / 我的。只在三个主 Tab 页出现。
// P7 Task 3：Backend 角标只汇总当前已加载候选端收件箱的未读（不宣称账号全量）；
// Mock 沿用 reducer 未读表。

import 样式 from './玻璃导航栏.module.css';
import { 公文包图标, 气泡图标, 人像图标 } from './图标';
import { use应用状态, 数未读 } from '../状态/应用状态';
import { 数P7已加载未读 } from '../状态/后端/真人会话操作';

const 导航项 = [
  { 键: '职位', 名: '职位', 图标: 公文包图标 },
  { 键: '消息', 名: '消息', 图标: 气泡图标 },
  { 键: '我的', 名: '我', 图标: 人像图标 },
] as const;

export default function 玻璃导航栏() {
  const { 状态, 派发, 数据源模式, 后端状态 } = use应用状态();
  // 未读角标挂在「消息」上：不在消息 Tab 时，代理谈完一轮等你拍板这件事
  // 原来在屏上没有任何痕迹，全靠用户自己想起来去点一下消息（拦路 10）。
  // Backend：已加载会话的未读和（read-through 后由权威收件箱刷新下降）。
  const 未读总数 = 数据源模式 === 'backend'
    ? 数P7已加载未读(后端状态.P7收件箱.candidate.items)
    : 数未读(状态.消息未读);

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
              {项.键 === '消息' && 未读总数 > 0 ? (
                <span className={`${样式.角标} 等宽数字`}>{未读总数}</span>
              ) : null}
            </span>
            <span className={`${样式.文字} ${选中 ? 样式.选中 : ''}`}>{项.名}</span>
          </button>
        );
      })}
    </nav>
  );
}
