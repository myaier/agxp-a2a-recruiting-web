// 企业历史代谈 —— 「我的 › 其他功能 › 历史代谈」。同构镜像：求职端 归档谈判.tsx。
//
// 被你按下终止的候选落到这里，带上「止步在哪一阶段 + 为什么止步」。
// 归档不可恢复成在谈（阶段机不倒退，业务约束 4），但全程往来记录可以回看 ——
// 没有这一屏，终止就是一次静默删除：这一单谈到哪、卡在哪一条，再也打不开。
//
// 双盲不变：意向确认前只出现代号与画像，不出现真名，也不出现任何薪资数字。
//
// S0–S3 展示统一 Task 2：页壳与卡改用共享 历史代谈外壳/历史代谈卡（求职/招聘 ×
// Mock/Backend 四入口同版式，H1）；Mock 在连接器原位映射已有企业归档条，说明条换成
// Spec §4.1 固定文案，数量说明仍为精确总数「N 单已结束」。
//
// P5 模式边界：Backend 的历史代谈只来自 P5 历史快照（completed/ended 两个独立架子，
// 屏幕/P5/MatchCase历史，返回回调由此传入），点卡按 case_id 开同一候选详情（终局只读）；
// 不读 企业归档列表、不水合 Mock 归档条、绝不从 Mock 归档条重建时间线或原因。
// Mock 分支（Mock企业归档）零 P5 请求。

import 样式 from './我的功能页.module.css';
import { 历史代谈外壳, 历史代谈卡 } from '../组件/历史代谈展示';
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
    // eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role
    <MatchCase历史 role="recruiter" 返回={返回} />
  );
}

/** Mock 原型分支：静态归档表映射进共享卡（S0–S3 Task 2），零 P5 请求。 */
function Mock企业归档() {
  const { 返回, 跳转 } = use导航();
  const { 状态 } = use应用状态();

  return (
    <历史代谈外壳 返回={返回} 数量说明={`${状态.企业归档列表.length} 单已结束`}>
      {状态.企业归档列表.map((条) => (
        <历史代谈卡
          key={条.编号}
          信息={{
            键: 条.编号,
            标题: 条.代号,
            职位: 条.职位,
            画像: 条.画像,
            图片URL: null,
            字标: 条.头像字,
            // 企业侧目前只有「你按下终止」这一条归档路径：主动结束=中性（Spec §4.1）
            结果: { 文案: 条.结果, 色调: '中性' },
            原因: 条.原因,
            阶段说明: `止步于 ${条.止步阶段}`,
            时间说明: 条.时间,
            打开: () => 跳转(路径.企业往来记录(条.编号)),
          }}
        />
      ))}

      {状态.企业归档列表.length === 0 ? (
        <div className={样式.空态}>
          <div className={样式.空态图}>🗂</div>
          <div className={样式.空态标题}>还没有历史代谈</div>
          <div className={样式.空态说明}>被终止的候选会出现在这里，附上止步原因。</div>
        </div>
      ) : null}
    </历史代谈外壳>
  );
}
