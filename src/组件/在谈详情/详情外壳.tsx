// 详情外壳 —— 两条在谈详情路由（求职端 /deal/:id、招聘端 /hr/candidate/:id）的共用版式：
// 顶栏 → Tab 行 → 当前 Tab 滚动内容 → 底栏 → 弹层。返回栏/Tab 行/滚动壳只此一处，
// 传入槽位的内容不得自带第二层。外壳是纯展示：不读 Context/fixture、不请求数据、
// 不拼路由；Tab 由调用方持有（换 Case/角色由连接层重置），点击只回调 切Tab。

import { 次级页外壳, 滚动区 } from '../通用';
import { 详情顶栏 } from './详情顶栏';
import 样式 from './详情外壳.module.css';
import type { 详情外壳属性, 详情Tab } from './类型';

/** Tab 名即屏上文案。共用外壳不写模式名：第二 Tab 的具体资料由调用方槽位给
 *  （求职端 职位详情、招聘端 在线简历），Tab 键固定 进度 / 资料。 */
const Tab名: readonly { 键: 详情Tab; 文: string }[] = [
  { 键: '进度', 文: '进度' },
  { 键: '资料', 文: '资料' },
];

export function 详情外壳({
  信息,
  返回,
  当前Tab,
  切Tab,
  进度,
  资料,
  底栏,
  弹层,
}: 详情外壳属性) {
  return (
    <次级页外壳 白底>
      <详情顶栏 信息={信息} 返回={返回} />
      <div className={样式.Tab行}>
        {Tab名.map(({ 键, 文 }) => (
          <button
            key={键}
            type="button"
            className={`${样式.Tab} ${当前Tab === 键 ? 样式.Tab选中 : 样式.Tab未选} 可点`}
            onClick={() => 切Tab(键)}
          >
            {文}
          </button>
        ))}
      </div>
      {/* 两个 Tab 的内容互斥挂载：切走即卸载，不留第二份 DOM */}
      <滚动区>{当前Tab === '进度' ? 进度 : 资料}</滚动区>
      {底栏}
      {弹层}
    </次级页外壳>
  );
}
