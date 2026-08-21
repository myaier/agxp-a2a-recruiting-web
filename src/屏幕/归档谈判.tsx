// 归档谈判 —— 「我的 › 其他功能 › 归档谈判」。
//
// 谈崩、退出、被判未通过的单都落到这里，带上「止步在哪一阶段 + 为什么止步」。
// 归档不可恢复成在谈单（阶段机不倒退，业务约束 4），但全程往来记录可以回看 ——
// 这是用户复盘「我这次是被什么条件卡住的」的唯一入口。

import 样式 from './我的功能页.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { use应用状态 } from '../状态/应用状态';
import type { 归档条 } from '../数据/类型';

/** 结果 → 标签配色类名 */
const 结果类名: Record<归档条['结果'], string> = {
  我方退出: 样式.结果我方退出,
  对方未通过: 样式.结果对方未通过,
  双方未达成: 样式.结果双方未达成,
};

export default function 归档谈判() {
  const { 返回, 跳转 } = use导航();
  const { 状态 } = use应用状态();

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="历史接洽" 副标题={`${状态.归档列表.length} 单已结束`} />

      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        <div className={样式.说明条}>
          已结束的单不会再恢复成在谈 —— 阶段只往前走。
          <span className={样式.说明强调}>但全程往来记录一直留着</span>
          ，可以回看当时卡在哪一条上。
        </div>

        {状态.归档列表.map((条) => (
          <button
            key={条.编号}
            className={`${样式.归档卡} 可点`}
            onClick={() => 跳转(路径.往来记录(条.编号))}
          >
            <span className={样式.字标}>{条.公司首字}</span>
            <span className={样式.归档主体}>
              <span className={样式.归档头行}>
                <span className={`${样式.归档公司} 单行`}>{条.公司}</span>
                <span className={`${样式.结果标} ${结果类名[条.结果]}`}>{条.结果}</span>
              </span>
              <span className={`${样式.归档职位} 单行`}>{条.职位}</span>
              <span className={样式.归档原因}>{条.原因}</span>
              <span className={样式.归档底行}>
                <span className={样式.归档止步}>止步于 {条.止步阶段}</span>
                <span className={样式.归档时间}>{条.时间}</span>
                <span className={样式.归档回看}>回看往来 ›</span>
              </span>
            </span>
          </button>
        ))}

        {状态.归档列表.length === 0 ? (
          <div className={样式.空态}>
            <div className={样式.空态图}>🗂</div>
            <div className={样式.空态标题}>还没有历史接洽</div>
            <div className={样式.空态说明}>退出或未通过的单会出现在这里，附上止步原因。</div>
          </div>
        ) : null}
      </滚动区>
    </次级页外壳>
  );
}
