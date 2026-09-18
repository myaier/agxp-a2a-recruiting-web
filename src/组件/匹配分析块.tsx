// 匹配分析块（冻结公共合同 C3 / Spec §3.1–3.2、§4）：双端与 Mock 共用的六维匹配分析组件。
// props 核心为 模型: 匹配分析模型 + 藏环?: boolean —— 组件只消费已解码模型，不自行从
// 正文、分数大小或旧依据推断任何状态（映射边界在 数据/匹配解释展示映射.ts）。
// 旧「JD 三态核对块」（求职核对块）已随 Task 6 迁完最后两个消费者（真人会话 / 职位资料）
// 删除，其遗留样式类一并清理 —— 六维解释展示只有本组件一条路径。
//
// 版式（Spec §4 最终紧凑勾选行）：头行[标题「匹配度分析」+ 分数环/文本总分] →
// 「推荐生成时的匹配结果」→ 六维行[左状态图标 + 维度名 + 小号 points/max_points，
// 右弱化原因与状态文字，长原因换行] → 技能口径说明。四态图标互不相同（matched 绿实心
// 勾 / partially 半圆 / not_matched 空心叉 / unknown 中性空心横线），且与状态文字同时
// 在场，不只靠颜色区分。
//
// 缺失口径（Spec §5.2）：解释合法缺失（显式 null）→ 同区显示「暂无该次匹配的详细分析」；
// 有旧正向依据标「有限依据」仅列已知原因；无旧依据仅缺失说明；绝不补六条假状态，也不
// 与旧依据的重复分析（「当前接口仅提供部分匹配依据」）同现。分数 null → 中性「—」，不画
// 假 0 分环；真实 0 正常显示。藏环（列表弹层形态）用文本总分；不藏环（详情唯一环）用
// 原适配环 44px。组件零网络请求、无 button —— 查看入口在卡片层（列表）或页面层（详情）。

import 样式 from './匹配分析块.module.css';
import 适配环 from './适配环';
import type { BFF匹配状态 } from '../数据/BFF契约';
import {
  匹配分析行们,
  type 匹配分析模型,
  type 匹配解释行,
} from '../数据/匹配解释展示映射';

/** Spec §4 四态图标：每态独立形状（勾 / 半圆 / 叉 / 横线）。颜色沿用现有体系：
 *  matched 用亮绿实心，partially 用协调橙半圆，not_matched / unknown 用中性灰 ——
 *  状态语义由图标形状 + 状态文字共同承载，不只靠颜色。 */
function 状态图标({ 状态 }: { 状态: BFF匹配状态 }) {
  if (状态 === 'matched') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="7" fill="var(--亮绿)" />
        <path
          d="M4.6 8.4 L7 10.8 L11.4 5.4"
          stroke="#fff"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (状态 === 'partially_matched') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="6.6" stroke="var(--协调)" strokeWidth="1.4" />
        <path d="M8 1.4 A6.6 6.6 0 0 0 8 14.6 Z" fill="var(--协调)" />
      </svg>
    );
  }
  if (状态 === 'not_matched') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="6.6" stroke="var(--弱化)" strokeWidth="1.4" />
        <path
          d="M5.2 5.2 L10.8 10.8 M10.8 5.2 L5.2 10.8"
          stroke="var(--弱化)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.6" stroke="var(--描边深)" strokeWidth="1.4" />
      <path d="M5 8 L11 8" stroke="var(--弱化)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** 六维行（Spec §4）：左图标 + 维度名 + 小号分项；右弱化原因与状态文字（换行不截断）。
 *  技能行附「命中X/Y个岗位关键词」（仅技能行携带，来自冻结解码的 matched/required_count）。 */
function 六维行({ 行 }: { 行: 匹配解释行 }) {
  return (
    <div className={样式.行}>
      <span className={样式.态符} data-状态={行.状态}>
        <状态图标 状态={行.状态} />
      </span>
      <span className={样式.行主}>
        <span className={样式.行头}>
          <span className={样式.维度名}>{行.维度}</span>
          <span className={`${样式.分项} 等宽数字`}>{`${行.points}/${行.max_points}`}</span>
        </span>
        {行.命中 !== null && 行.总数 !== null ? (
          <span className={样式.命中文}>{`命中${行.命中}/${行.总数}个岗位关键词`}</span>
        ) : null}
      </span>
      <span className={样式.行注}>
        <span className={样式.原因}>{行.说明}</span>
        <span className={样式.状态词}>{行.状态文字}</span>
      </span>
    </div>
  );
}

export function 匹配分析块({ 模型, 藏环 = false }: { 模型: 匹配分析模型; 藏环?: boolean }) {
  const 行们 = 匹配分析行们(模型);
  return (
    <>
      <div className={样式.头}>
        <span className={样式.标题}>匹配度分析</span>
        {藏环 ? (
          // 弹层形态：紧凑文本总分，不再画环（Spec §3.2）
          <span className={`${样式.文本总分} 等宽数字`}>
            {模型.分数 === null ? '—' : `${模型.分数} 分`}
          </span>
        ) : 模型.分数 === null ? (
          // 详情形态缺分：中性「—」占位，不画假 0 分环（Spec §3.1）
          <span className={样式.缺分位} role="img" aria-label="匹配分未知">—</span>
        ) : (
          <适配环 分={模型.分数} 标={null} 尺寸={44} />
        )}
      </div>
      {行们 === null ? (
        <>
          <p className={样式.缺失说明}>暂无该次匹配的详细分析</p>
          {模型.上下文 === '无推荐上下文' ? (
            <p className={样式.缺失说明}>当前职位没有特定推荐上下文</p>
          ) : null}
          {模型.上下文 === '原推荐不可用' ? (
            <p className={样式.缺失说明}>该次推荐上下文已不可用</p>
          ) : null}
          {模型.有限依据.length > 0 ? (
            <div className={样式.有限依据}>
              <div className={样式.有限依据标}>有限依据</div>
              {模型.有限依据.map((依据) => (
                <div key={依据} className={样式.依据行}>{依据}</div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className={样式.副标}>推荐生成时的匹配结果</div>
          {行们.map((行) => (
            <六维行 key={行.维度} 行={行} />
          ))}
          <p className={样式.技能说明}>技能按关键词命中核对，不代表能力认证。</p>
        </>
      )}
    </>
  );
}
