// J-PILOT-01 Task 4：候选连续列表卡的展示投影（Spec §5）。纯函数：把已 decode 的
// NegotiationCard（连续代谈.ts fail-closed）投影成现有 候选在谈卡/白卡/在谈阶段区 接受的
// 展示数据 —— 不强制转成 P5列表项，也由此不产生第二层契约错误分支（decode 已挡漂移）。
//
// 阶段权威：服务端 phase + needs_action + case_state + failure/refusal_code。展示词：
//   · pre-Case 阶段标题为本域闭表；状态文案复用 P4委托状态文案（同一协议的既有权威文案）；
//   · evaluation_failed/refused 的失败原因经 P4失败原因文案/P4拒绝原因文案 投影，进注意说明；
//   · case_started 依据非空 case_state 复用既有 P5 阶段标题/状态文案/attention 说明；
//     case_state=null 时照常出卡（已开案 + 安全进度文案），不依据 case_state=null 隐藏卡；
//   · history 的 needs_action=false 只影响徽标，绝不据此隐藏卡或禁止恢复（权限读 actions.retry）。
// 职位事实缺失（NegotiationJob 的 title/薪资/城市可空段）按既有缺失规则给占位；技能段
// NegotiationJob 不提供，恒无。本模块不重排顺序（顺序权威在服务端）、不发请求、不 import React。

import type { P5阶段, P5状态 } from './BFF契约';
import type { P5Agent注意码, P5状态视图 } from './招聘数据源/MatchCase';
import type { NegotiationCard } from './招聘数据源/连续代谈';
import { P4委托状态文案, P4失败原因文案, P4拒绝原因文案 } from './发现推荐映射';

/** 连续列表卡视图：在谈卡（求职在谈卡）与历史白卡共用的最小展示数据。 */
export interface 连续列表视图 {
  /** 键与导航唯一归属：canonical record_id（dlg_/mc_），绝不用 job_id 猜归属。 */
  recordId: string;
  recordKind: 'delegation' | 'case';
  intentionId: string;
  /** 冻结职位事实：title 缺失给既有占位文案；薪资缺失同；城市缺失为 null（由卡面出占位）。 */
  职位名: string;
  城市: string | null;
  薪资带: string;
  阶段标题: string;
  状态文案: string;
  /** viewer 专属待办（history 恒 false；不据此隐藏卡，也不否决 actions.retry）。 */
  待办: boolean;
  /** 归属徽标（在谈卡阶段区）；历史白卡不渲染徽标。 */
  徽标: '需要你' | '需注意' | '代理处理中' | null;
  /** 失败/拒绝原因与 Case attention 的安全说明（在谈阶段区下方 / 历史卡单独一行）。 */
  注意说明: string | null;
}

// ── 闭表：pre-Case 阶段标题（本域五个 phase 一一对应，无表外键）──

const 连续阶段标题表 = {
  accepted: '已受理',
  evaluating: '初评中',
  evaluation_failed: '初评失败',
  refused: '已拒绝',
  case_started: '已开案',
} as const satisfies Record<NegotiationCard['phase'], string>;

// ── 闭表：case_started 复用既有 P5 状态词汇（与 MatchCase展示映射 的闭表同源；该文件
//    不在本任务可编辑清单内，这里按同一份文案重申，不另造词）──

const P5阶段标题文案表 = {
  anonymous_screening: '匿名初筛',
  resume_submission: '简历提交',
  needs_coordination: '差异协同',
  intent_confirmation: '意向确认',
} as const satisfies Record<P5阶段, string>;

const P5状态文案表 = {
  running: '进行中',
  needs_user: '待处理',
  passed: '已通过',
  attention_required: '需注意',
  ended: '已结束',
  waiting: '等待中',
} as const satisfies Record<P5状态, string>;

/** owner-safe attention 说明（同 MatchCase展示映射 的 Agent注意文案表，不暴露内部错误词）。 */
const Agent注意文案表 = {
  agent_unavailable: 'AI 服务暂时不可用，本 Case 尚未继续',
  agent_result_invalid: '本次 AI 结果无法安全用于推进 Case',
} as const satisfies Record<P5Agent注意码, string>;

/** 失败初评卡的短状态文案（原因进注意说明，阶段行保持短词，不把长句塞进单行文本槽）。 */
const 初评失败文案 = '本次评估未完成';

/**
 * NegotiationCard → 连续列表卡视图。case_state 的 stage/status 已由 decode 对上既有
 * 17 行矩阵，这里只做词表投影；needs_action 与 case_state.needs_user 是两个权威
 * （后者已被 decoder 钉住镜像规则），徽标只读 needs_action，绝不读嵌套 needs_user。
 */
export function 映射连续列表项(card: NegotiationCard): 连续列表视图 {
  let 阶段标题: string = 连续阶段标题表[card.phase];
  let 状态文案: string;
  let 徽标: 连续列表视图['徽标'];
  let 注意说明: 连续列表视图['注意说明'] = null;

  switch (card.phase) {
    case 'accepted':
    case 'evaluating':
      状态文案 = P4委托状态文案(card.phase);
      // needs_action 是 viewer 待办的唯一权威：即使代理在处理，服务端标了待办就给「需要你」
      徽标 = card.needs_action ? '需要你' : '代理处理中';
      break;
    case 'evaluation_failed':
      状态文案 = 初评失败文案;
      注意说明 = card.failure === null ? null : P4失败原因文案(card.failure.code);
      徽标 = card.needs_action ? '需要你' : 注意说明 !== null ? '需注意' : null;
      break;
    case 'refused':
      状态文案 = card.refusal_code === null
        ? P4委托状态文案('refused')
        : P4拒绝原因文案(card.refusal_code);
      徽标 = null;
      break;
    case 'case_started':
      if (card.case_state !== null) {
        // 非空 case_state：复用既有 P5 阶段标题与状态文案（卡面与 Case 列表卡同词）
        阶段标题 = P5阶段标题文案表[card.case_state.stage];
        状态文案 = P5状态文案表[card.case_state.status];
        注意说明 = 映射Agent注意(card.case_state);
      } else {
        // Case 坐标未确认：安全文案，绝不声称已创建在谈（同 P4 的开案前口径）
        状态文案 = P4委托状态文案('case_started');
      }
      徽标 = card.needs_action
        ? '需要你'
        : 注意说明 !== null
          ? '需注意'
          // 终局 Case（ended/completed）与坐标未确认的卡都不冒充「代理处理中」
          : card.case_state === null || card.case_state.lifecycle !== 'open' ? null : '代理处理中';
      break;
  }

  return {
    recordId: card.record_id,
    recordKind: card.record_kind,
    intentionId: card.intention_id,
    职位名: 非空段(card.job.title) ?? '职位信息未知',
    城市: 非空段(card.job.location),
    薪资带: 非空段(card.job.public_salary_range) ?? '薪资未知',
    阶段标题,
    状态文案,
    待办: card.needs_action,
    徽标,
    注意说明,
  };
}

/** attention 说明只属于 attention_required 行（decoder 已钉），这里按行位再守一道。 */
function 映射Agent注意(state: P5状态视图): 连续列表视图['注意说明'] {
  if (state.status !== 'attention_required') return null;
  return state.agentAttention === null ? '本阶段需要注意' : Agent注意文案表[state.agentAttention.code];
}

/** trim 后无有效字符的段不算已知内容（同 列表卡片映射 的缺失规则）。 */
function 非空段(段: string | null): string | null {
  if (段 === null) return null;
  const 值 = 段.trim();
  return 值 === '' ? null : 值;
}