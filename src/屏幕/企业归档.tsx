// 企业历史代谈 —— 「我的 › 其他功能 › 历史代谈」。同构镜像：求职端 归档谈判.tsx。
//
// 被你按下终止的候选落到这里，带上「止步在哪一阶段 + 为什么止步」。
// 归档不可恢复成在谈（阶段机不倒退，业务约束 4），但全程往来记录可以回看 ——
// 没有这一屏，终止就是一次静默删除：这一单谈到哪、卡在哪一条，再也打不开。
//
// 双盲不变：意向确认前只出现代号与画像，不出现真名，也不出现任何薪资数字。
//
// P5 模式边界：Backend 的历史代谈只来自 P5 历史快照（completed/ended 两个独立架子，
// 屏幕/P5/MatchCase历史），点卡按 case_id 开同一候选详情（终局只读）；不读 企业归档列表、
// 不水合 Mock 归档条、绝不从 Mock 归档条重建时间线或原因。Mock 分支（Mock企业归档）
// 行为与接线前逐字一致、零 P5 请求。

import 样式 from './我的功能页.module.css';
import 本屏样式 from './企业归档.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { use应用状态 } from '../状态/应用状态';
import { MatchCase历史 } from './P5/MatchCase历史';

export default function 企业归档() {
  const { 数据源模式 } = use应用状态();
  return 数据源模式 === 'backend' ? <Backend企业归档 /> : <Mock企业归档 />;
}

/** Backend 分支（P5）：completed/ended 两个独立终局架子；Mock 归档条一概不读。 */
function Backend企业归档() {
  const { 返回 } = use导航();
  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="历史代谈" />
      <滚动区 样式覆盖={{ padding: '14px 10px 24px' }}>
        {/* eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role */}
        <MatchCase历史 role="recruiter" />
      </滚动区>
    </次级页外壳>
  );
}

/** Mock 原型分支：静态归档表，行为与接线前逐字一致（P5 Task 7 仅移入，未改）。 */
function Mock企业归档() {
  const { 返回, 跳转 } = use导航();
  const { 状态 } = use应用状态();

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="历史代谈" 副标题={`${状态.企业归档列表.length} 单已结束`} />

      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        <div className={样式.说明条}>
          已结束的单不会再恢复成在谈 —— 阶段只往前走。
          <span className={样式.说明强调}>但全程往来记录一直留着</span>
          ，可以回看当时卡在哪一条上。
        </div>

        {状态.企业归档列表.map((条) => (
          <button
            key={条.编号}
            className={`${样式.归档卡} 可点`}
            onClick={() => 跳转(路径.企业往来记录(条.编号))}
          >
            <span className={样式.字标}>{条.头像字}</span>
            <span className={样式.归档主体}>
              <span className={样式.归档头行}>
                <span className={`${样式.归档公司} 单行`}>{条.代号}</span>
                <span className={`${样式.结果标} ${本屏样式.结果我方终止}`}>{条.结果}</span>
              </span>
              <span className={`${样式.归档职位} 单行`}>{条.职位}</span>
              <span className={本屏样式.画像}>{条.画像}</span>
              <span className={样式.归档原因}>{条.原因}</span>
              <span className={样式.归档底行}>
                <span className={样式.归档止步}>止步于 {条.止步阶段}</span>
                <span className={样式.归档时间}>{条.时间}</span>
                <span className={样式.归档回看}>回看往来 ›</span>
              </span>
            </span>
          </button>
        ))}

        {状态.企业归档列表.length === 0 ? (
          <div className={样式.空态}>
            <div className={样式.空态图}>🗂</div>
            <div className={样式.空态标题}>还没有历史代谈</div>
            <div className={样式.空态说明}>被终止的候选会出现在这里，附上止步原因。</div>
          </div>
        ) : null}
      </滚动区>
    </次级页外壳>
  );
}
