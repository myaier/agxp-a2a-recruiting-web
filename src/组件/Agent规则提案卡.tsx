// Agent 规则提案确认卡（P6 Task 5）：候选规则库 / 企业代理设置 双端共用的纯展示组件。
// 状态机逐条对齐设计 §7.3：
//   · interpreting → 「AI代理正在理解这条规则…」，不给任何动作键；
//   · ready → normalized_text + consequence 的固定安全摘要 + 「放弃/确认规则」双动作；
//   · failed → 固定失败文案 + 关闭（关闭后由页面保留用户原草稿供再次明确提交）；
//   · accepted|dismissed → 整卡不渲染，快照清理由操作层负责。
// 只呈现后端 safe summary：不显示 confidence、clauses、parameters、effect、
// Agent task 或影响人数估算。consequence 只用于安全摘要，绝不做可接受性判定——
// executable 的 auto_deny 也可确认，not_actionable 由操作层的恢复路径裁决。
// 纯展示：不读 Context、不 import 操作层，接受/放弃/关闭全部由调用方注入。

import 样式 from './Agent规则提案卡.module.css';
import type { BFFAgent规则后果, BFFAgent规则提案 } from '../数据/BFF契约';

/** 冻结的 consequence 安全摘要（设计 §7.3）：一字不改，双端同一口径。 */
export const Agent规则后果文案: Record<BFFAgent规则后果, string> = {
  auto_allow: '符合条件时，AI代理可以自动推进',
  auto_deny: '命中条件时，AI代理会自动拦下',
  advisory: '这是一条参考偏好，不会单独触发自动决定',
  mixed: '这条规则同时包含推进、拦截或参考条件',
};

export interface Agent规则提案卡属性 {
  提案: BFFAgent规则提案;
  /** 页面动作（接受/放弃）在飞时为 true：两个动作键一起禁用 */
  忙: boolean;
  接受: () => void;
  放弃: () => void;
  /** failed 卡的关闭：页面负责保留原草稿供再次明确提交 */
  关闭失败: () => void;
}

export default function Agent规则提案卡({ 提案, 忙, 接受, 放弃, 关闭失败 }: Agent规则提案卡属性) {
  // 终态不继续显示：操作层把权威快照刷新后这张卡自然消失
  if (提案.state === 'accepted' || 提案.state === 'dismissed') return null;

  if (提案.state === 'interpreting') {
    return (
      <div className={样式.卡}>
        <div className={样式.解读行}>
          <span className={样式.解读圈} />
          <span>AI代理正在理解这条规则…</span>
        </div>
      </div>
    );
  }

  if (提案.state === 'failed') {
    const 失败文案 = 提案.failure_code === 'agent_unavailable'
      ? 'AI代理暂时不可用，这条规则没有完成理解'
      : 'AI代理没有理解这条规则，请换一种更明确的说法';
    return (
      <div className={样式.卡}>
        <div className={样式.后果}>{失败文案}</div>
        <div className={样式.键行}>
          <button type="button" className={`${样式.关闭键} 可点`} onClick={关闭失败}>
            关闭
          </button>
        </div>
      </div>
    );
  }

  // ready：正文 + 安全摘要 + 显式双动作（primary 确认规则 / secondary 放弃）
  return (
    <div className={样式.卡}>
      <div className={样式.规则文本}>{提案.normalized_text}</div>
      <div className={样式.后果}>
        {提案.consequence !== undefined ? Agent规则后果文案[提案.consequence] : null}
      </div>
      <div className={样式.键行}>
        <button type="button" className={`${样式.放弃键} 可点`} disabled={忙} onClick={放弃}>
          放弃
        </button>
        <button type="button" className={`${样式.确认键} 可点`} disabled={忙} onClick={接受}>
          确认规则
        </button>
      </div>
    </div>
  );
}
