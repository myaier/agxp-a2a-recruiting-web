// A20 求职意向管理（想找什么工作？）
//
// 结构：返回栏 → 大标题 → 意向卡（绿竖条 + 标题 + N/5 配额 + 意向行列表 + 添加按钮）
// → 设置卡（只剩求职状态一行）。
//
// 2026-08-22 产品负责人「这个底线与条件也删掉」：设置卡里那一行连同「AI代理可见」徽标摘掉。
//   它点进去落的是规则库，而规则库在「我」的功能格里有自己的独立入口，所以只删这一行、
//   规则库本身原样留着。删完设置卡只剩一行，那一行要补 无分隔线 —— 否则卡底会剩一条
//   悬空的分隔线压在圆角上，看起来像下面还有一行没渲染出来。
//
// 删的只是「期望区间」之外那条更硬的底线字段：薪资区间的下限仍然承担底线作用，
//   代理之间依旧只交换「有没有交集」、不交换数字，双盲机制没有因为这次删除而改变。
//
// 求职状态行（Task 1 / Spec §6）：状态是候选 profile 全账号一份的事实，不是本屏的
//   本地展示态 —— 原来的 Mock 三档轮转假状态已删除。两模式读同一份 profile（Backend
//   读已水合权威快照的 wire status、Mock 读同一份页面身份），点行进共用状态编辑
//   （?from=intentions + 来路证明），保存后回本屏。

import 样式 from './求职意向管理.module.css';
import { 次级页外壳, 返回栏, 页面大标题, 滚动区, 设置行 } from '../组件/通用';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 创建候选编辑来路 } from '../流程/候选日常编辑';
import type { BFF简历资料 } from '../数据/BFF契约';
import type { 候选身份 } from '../数据/类型';

/** 求职意向配额上限：产品规则限定一个账号最多 5 个意向 */
const 意向配额上限 = 5;

/** 日常状态的展示文案（Spec §6）：只显示真实三态，空值未填写。
 *  不把 employed 翻译成「保密求职中」、不给在校/离职包装到岗节奏 —— 那些是 onboarding
 *  到岗档位的语义，不是这份 profile 状态的持久化选项。 */
const 状态文案: Record<候选身份, string> = {
  '': '未填写',
  在校: '在校',
  在职: '在职',
  离职: '离职',
};

/** Backend wire status → 页面身份：只做既有枚举映射，不新增语义（'' / 缺失 = 未选择）。 */
const wire到身份: Record<BFF简历资料['status'], 候选身份> = {
  '': '',
  student: '在校',
  employed: '在职',
  unemployed: '离职',
};

export default function 求职意向管理() {
  const { 状态, 数据源模式, 后端状态 } = use应用状态();
  const { 跳转, 返回 } = use导航();
  const 是后端 = 数据源模式 === 'backend';

  // Backend 读已水合权威快照的 wire 身份；Mock 读同一份页面 profile 身份 ——
  // 两模式同一份事实、同一编辑入口，不再有本地轮转的假状态。
  const 身份 = 是后端
    ? wire到身份[后端状态.简历快照?.profile.status ?? '']
    : 状态.基本信息.身份;
  const 状态值 = 状态文案[身份];
  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      <页面大标题 标题="想找什么工作？" />

      <滚动区>
        <div className={样式.内容}>
          {/* ── 意向卡 ── */}
          <div className={样式.卡}>
            <div className={样式.卡头}>
              <span className={样式.绿竖条} />
              <span className={样式.卡标题}>求职意向</span>
              <span className={`${样式.配额} 等宽数字`}>
                <span className={样式.配额已用}>{状态.求职意向表.length}</span>/{意向配额上限}
              </span>
            </div>

            {状态.求职意向表.map((意向) => (
              <button
                key={意向.编号}
                className={`${样式.意向行} 可点`}
                onClick={() => 跳转(路径.编辑意向(意向.编号))}
              >
                <span className={样式.意向文字组}>
                  <span className={`${样式.意向标题} 单行`}>{意向.标题}</span>
                  <span className={`${样式.意向说明} 单行`}>{意向.说明}</span>
                </span>
                <span className={样式.意向改}>✎</span>
              </button>
            ))}

            {/* 配额用满就不再放添加入口，避免点进表单才被拒 */}
            {状态.求职意向表.length < 意向配额上限 ? (
              <button
                className={`${样式.添加意向} 可点`}
                onClick={() => 跳转(路径.添加意向)}
              >
                <span className={样式.添加圆}>
                  <span className={样式.添加符}>＋</span>
                </span>
                <span className={样式.添加文字}>添加求职意向</span>
              </button>
            ) : (
              <div className={样式.配额已满}>意向已达 {意向配额上限} 个上限，先删一个再加。</div>
            )}
          </div>

          {/* ── 设置卡：只剩求职状态一行，故这一行就是最后一行，要 无分隔线 ── */}
          <div className={`${样式.卡} ${样式.设置卡}`}>
            <设置行
              标题="求职状态"
              值={状态值}
              按下={() => 跳转(
                `${路径.求职状态}?from=intentions`,
                创建候选编辑来路('intentions'),
              )}
              无分隔线
            />
          </div>
        </div>
      </滚动区>
    </次级页外壳>
  );
}
