// 顶部意向切换栏：在谈首页（A6·L）与看市场（A14）共用。
// 放大镜 = 自己去市场里搜岗，原型层面直接切到「看市场」子视图。

import 样式 from './顶部意向栏.module.css';
import { 放大镜图标 } from '../组件/图标';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 意向切换 } from '../数据/模拟数据';

export default function 顶部意向栏() {
  const { 状态, 派发 } = use应用状态();
  const { 跳转 } = use导航();

  return (
    <div className={样式.顶栏}>
      <div className={样式.意向行}>
        {意向切换.map((意向) => {
          const 选中 = 意向 === 状态.当前意向;
          return (
            <button
              key={意向}
              className={`${选中 ? 样式.意向选中 : 样式.意向未选} 可点`}
              onClick={() => 派发({ 型: '切意向', 意向 })}
            >
              {意向}
            </button>
          );
        })}
        <span className={样式.意向行右}>
          <button
            className={`${样式.加号} 可点`}
            onClick={() => 跳转(路径.添加意向)}
            aria-label="添加求职意向"
          >
            ＋
          </button>
          <button
            className="可点"
            onClick={() => 派发({ 型: '切子视图', 子视图: '看市场' })}
            aria-label="搜索职位"
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <放大镜图标 />
          </button>
        </span>
      </div>

      <div className={样式.子视图行}>
        {(['在谈', '看市场'] as const).map((视图) => (
          <button
            key={视图}
            className={`${状态.子视图 === 视图 ? 样式.子视图选中 : 样式.子视图未选} 可点`}
            onClick={() => 派发({ 型: '切子视图', 子视图: 视图 })}
          >
            {视图}
          </button>
        ))}
        <span className={样式.筛选}>筛选 ▾</span>
      </div>
    </div>
  );
}
