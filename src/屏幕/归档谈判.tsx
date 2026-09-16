// 归档谈判 —— 「我的 › 其他功能 › 历史代谈」。
// 屏上文案 2026-08-22 按产品负责人定的「代谈」口径改（详见 在谈详情.tsx 页内Tab 注释）；
// 组件名与路由 /archived 是非用户可见标识符，不跟着改，免得平白引入风险。
//
// 谈崩、退出、被判未通过的单都落到这里，带上「止步在哪一阶段 + 为什么止步」。
// 归档不可恢复成在谈单（阶段机不倒退，业务约束 4），但全程往来记录可以回看 ——
// 这是用户复盘「我这次是被什么条件卡住的」的唯一入口。
//
// S0–S3 展示统一 Task 2：页壳与卡改用共享 历史代谈外壳/历史代谈卡（求职/招聘 ×
// Mock/Backend 四入口同版式，H1）；Mock 在连接器原位映射已有归档条，说明条换成
// Spec §4.1 固定文案，数量说明仍为精确总数「N 单已结束」。
//
// P5 模式边界（J-PILOT-01 Task 4 修订）：Backend 候选的历史代谈 = 单一连续分页集合
//（me/negotiations shelf=history，承接已结束 Case 与已归档初评失败），经
// 屏幕/P5/MatchCase历史 渲染（返回回调由此传入，数量说明在 P5 连接层同次渲染）；点卡按
// canonical record_id 开同一在谈详情（已结束不可恢复，归档初评失败的恢复由权威
// actions.retry 在详情动作槽决定）。招聘端继续 completed/ended 两个独立终局架子；不读
// 归档列表、不水合 Mock 归档条、绝不 import Mock。Mock 分支（Mock归档谈判）零 P5 请求。

import 样式 from './我的功能页.module.css';
import { 历史代谈外壳, 历史代谈卡 } from '../组件/历史代谈展示';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { use应用状态 } from '../状态/应用状态';
import { MatchCase历史 } from './P5/MatchCase历史';
import type { 归档条 } from '../数据/类型';

/** Mock 结果 → 共享卡色调（Spec §4.1：不匹配/未通过=提醒；主动结束等=中性；不造成功勾） */
const 结果色调: Record<归档条['结果'], '提醒' | '中性'> = {
  我方退出: '中性',
  对方未通过: '提醒',
  双方未达成: '提醒',
};

export default function 归档谈判() {
  const { 数据源模式 } = use应用状态();
  return 数据源模式 === 'backend' ? <Backend归档谈判 /> : <Mock归档谈判 />;
}

/** Backend 分支：候选连续 history 单一集合 / 招聘双终局架子（见 MatchCase历史）；Mock 归档条一概不读。 */
function Backend归档谈判() {
  const { 返回 } = use导航();
  return (
    // eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role
    <MatchCase历史 role="candidate" 返回={返回} />
  );
}

/** Mock 原型分支：静态归档表映射进共享卡（S0–S3 Task 2），零 P5 请求。 */
function Mock归档谈判() {
  const { 返回, 跳转 } = use导航();
  const { 状态 } = use应用状态();

  return (
    <历史代谈外壳 返回={返回} 数量说明={`${状态.归档列表.length} 单已结束`}>
      {状态.归档列表.map((条) => (
        <历史代谈卡
          key={条.编号}
          信息={{
            键: 条.编号,
            标题: 条.公司,
            职位: 条.职位,
            画像: null,
            图片URL: null,
            字标: 条.公司首字,
            结果: { 文案: 条.结果, 色调: 结果色调[条.结果] },
            原因: 条.原因,
            阶段说明: `止步于 ${条.止步阶段}`,
            时间说明: 条.时间,
            打开: () => 跳转(路径.往来记录(条.编号)),
          }}
        />
      ))}

      {状态.归档列表.length === 0 ? (
        <div className={样式.空态}>
          <div className={样式.空态图}>🗂</div>
          <div className={样式.空态标题}>还没有历史代谈</div>
          <div className={样式.空态说明}>退出或未通过的单会出现在这里，附上止步原因。</div>
        </div>
      ) : null}
    </历史代谈外壳>
  );
}
