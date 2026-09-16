// 历史代谈展示映射（S0–S3 展示统一 Task 2）：把两类历史行 DTO（候选连续 NegotiationCard、
// 招聘终局 P5列表项）投影成共享 历史代谈卡信息 的纯函数。只在对应历史分支被调用：
//   · 从候选历史到卡：me/negotiations shelf=history（MatchCase历史 候选半边）；
//   · 从招聘历史到卡：recruiter completed/ended 两架（MatchCase历史 招聘半边）。
// 权威规则 = 批准 Spec §4：结果色调按明确事实（completed=已谈成/成功；ended 走 代谈终局文案
// 字典，未知码安全兜底且原词不透出）；原因位置恒在（completed 无额外原因给「双方已确认意向」，
// 结束原因无源给「结束原因暂未提供」，pre-Case 给现有安全失败/拒绝说明）；阶段前缀
// ended=止步于 / completed=完成于 / 尚无 Case=初评阶段；时间三级标签 结束于/归档于/更新于，
// 不以更新时间冒充结束时间。招聘历史卡不消费 candidateIdentity（无身份图标、不取姓名头像），
// 画像位置恒保留为「画像信息暂未提供」（历史行无 candidate_summary，不补读）。
// 纯函数：不发请求、不读 Context、不 import Mock 值表；同输入恒同输出。

import type { P5阶段 } from './BFF契约';
import type { P5列表项 } from './招聘数据源/MatchCase';
import type { NegotiationCard } from './招聘数据源/连续代谈';
import { 映射连续列表项 } from './连续代谈展示映射';
import { P4失败原因文案, P4拒绝原因文案 } from './发现推荐映射';
import { 代谈终局文案 } from './代谈结果文案';
import type { 历史代谈卡信息 } from '../组件/历史代谈展示';

/** 已谈成（completed）的结果与原因：历史 DTO 无额外原因源，固定这一句（Spec §4.1）。 */
const 已谈成结果: 历史代谈卡信息['结果'] = { 文案: '已谈成', 色调: '成功' };
const 已谈成原因 = '双方已确认意向';
/** 结束原因无源时的中性占位（Spec §4.1；未知 outcome/code 同句，绝不透原词）。 */
const 原因未提供 = '结束原因暂未提供';

/** 四阶段展示名（Spec §5.1 沿用 Mock：S2 展示统一为「需要协调」，内部键不变）。 */
const 阶段展示名表 = {
  anonymous_screening: '匿名初筛',
  resume_submission: '递交简历',
  needs_coordination: '需要协调',
  intent_confirmation: '意向确认',
} as const satisfies Record<P5阶段, string>;

// ── 时间说明：结束于 finalized → 归档于 archived → 更新于 updated（同一浏览器时区）──

/** RFC3339 → `YYYY-MM-DD HH:mm`（与 MatchCase展示映射 的终局时间同规格；该文件不在本任务
 *  可编辑清单内，这里按同一规则重申）。异常值给「时间待确认」，不抛异常、不回原文。 */
function 格式化时间(原文: string): string {
  if (typeof 原文 !== 'string') return '时间待确认';
  const 时刻 = new Date(原文);
  if (Number.isNaN(时刻.getTime())) return '时间待确认';
  const 段 = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(时刻);
  const 取 = (类型: string) => 段.find((条) => 条.type === 类型)?.value ?? '';
  const 年 = 取('year'); const 月 = 取('month'); const 日 = 取('day');
  const 时 = 取('hour'); const 分 = 取('minute');
  if ([年, 月, 日, 时, 分].some((值) => 值 === '')) return '时间待确认';
  return `${年}-${月}-${日} ${时}:${分}`;
}

function 时间说明三级(终局: string | null, 归档: string | null, 更新: string): string {
  if (终局 !== null) return `结束于 ${格式化时间(终局)}`;
  if (归档 !== null) return `归档于 ${格式化时间(归档)}`;
  return `更新于 ${格式化时间(更新)}`;
}

function 时间说明两级(终局: string | null, 更新: string): string {
  return 终局 !== null ? `结束于 ${格式化时间(终局)}` : `更新于 ${格式化时间(更新)}`;
}

/**
 * 候选连续历史行（NegotiationCard）→ 共享历史卡。公司/职位/Logo 缺失占位复用
 * 映射连续列表项 的既有规则（同一响应权威事实，不跨域补读）；Backend 不造演示字标，
 * 有真实 Logo 显示图片，无媒体由共享卡给中性图位。
 */
export function 从候选历史到卡(card: NegotiationCard, 打开: () => void): 历史代谈卡信息 {
  const 视图 = 映射连续列表项(card);

  let 结果: 历史代谈卡信息['结果'];
  let 原因: string;
  let 阶段说明: string;
  switch (card.phase) {
    case 'case_started': {
      const 状态 = card.case_state;
      if (状态 !== null && 状态.lifecycle === 'completed') {
        结果 = 已谈成结果;
        原因 = 已谈成原因;
        阶段说明 = `完成于 ${阶段展示名表[状态.stage]}`;
      } else if (状态 !== null && 状态.lifecycle === 'ended') {
        const 终局 = 代谈终局文案(状态.outcome, 状态.outcomeCode);
        结果 = { 文案: 终局.状态文, 色调: 终局.色调 };
        原因 = 终局.原因;
        阶段说明 = `止步于 ${阶段展示名表[状态.stage]}`;
      } else {
        // open Case / 坐标未确认：不在历史语义内做结论，只按既有安全文案中性带出
        结果 = { 文案: 视图.状态文案, 色调: '中性' };
        原因 = 视图.注意说明 ?? 原因未提供;
        阶段说明 = 状态 === null ? 视图.阶段标题 : 阶段展示名表[状态.stage];
      }
      break;
    }
    case 'evaluation_failed':
      // 尚无 Case：不把初评失败等同 S0 失败，阶段说明固定「初评阶段」
      结果 = { 文案: '初评失败', 色调: '提醒' };
      原因 = card.failure === null ? 原因未提供 : P4失败原因文案(card.failure.code);
      阶段说明 = '初评阶段';
      break;
    case 'refused':
      结果 = { 文案: '已拒绝', 色调: '提醒' };
      原因 = card.refusal_code === null ? 原因未提供 : P4拒绝原因文案(card.refusal_code);
      阶段说明 = '初评阶段';
      break;
    default:
      // accepted/evaluating 不是终局行（服务端不会放进 history）；防御性按既有状态文案中性带出
      结果 = { 文案: 视图.状态文案, 色调: '中性' };
      原因 = 原因未提供;
      阶段说明 = '初评阶段';
      break;
  }

  return {
    键: card.record_id,
    标题: 视图.公司 ?? '公司信息缺失',
    职位: 视图.职位名,
    画像: null,
    图片URL: 视图.公司图片URL,
    字标: null,
    结果,
    原因,
    阶段说明,
    时间说明: 时间说明三级(card.case_state?.finalizedAt ?? null, card.archived_at, card.updated_at),
    打开,
  };
}

/**
 * 招聘终局历史行（P5列表项，recruiter completed/ended 两架）→ 共享历史卡。
 * 标题保留合法匿名别名，不以其字符推实名或头像字；不消费 candidateIdentity；
 * 画像位置恒保留（历史行无 candidate_summary →「画像信息暂未提供」，不补读 open 列表）。
 */
export function 从招聘历史到卡(item: P5列表项, 打开: () => void): 历史代谈卡信息 {
  const 状态 = item.state;
  // 招聘历史行恒为 recruiter 行（调用点合同）；候选行不产生别名，中性称呼兜底不猜名
  const 别名 = item.role === 'recruiter' ? item.candidateAlias : '候选人';
  const 阶段名 = 阶段展示名表[状态.stage];

  let 结果: 历史代谈卡信息['结果'];
  let 原因: string;
  let 阶段说明: string;
  if (状态.lifecycle === 'completed') {
    结果 = 已谈成结果;
    原因 = 已谈成原因;
    阶段说明 = `完成于 ${阶段名}`;
  } else if (状态.lifecycle === 'ended') {
    const 终局 = 代谈终局文案(状态.outcome, 状态.outcomeCode);
    结果 = { 文案: 终局.状态文, 色调: 终局.色调 };
    原因 = 终局.原因;
    阶段说明 = `止步于 ${阶段名}`;
  } else {
    // open 行不属于终局历史（scope 隔离保证）；防御性中性带出，不预写「已结束」
    结果 = { 文案: '进行中', 色调: '中性' };
    原因 = 原因未提供;
    阶段说明 = 阶段名;
  }

  return {
    键: 状态.caseId,
    标题: 别名,
    职位: item.job.job.title,
    画像: '画像信息暂未提供',
    图片URL: null,
    字标: null,
    结果,
    原因,
    阶段说明,
    时间说明: 时间说明两级(状态.finalizedAt, 状态.updatedAt),
    打开,
  };
}
