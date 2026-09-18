// J-PILOT-01 Task 4：候选连续列表卡的展示投影（Spec §5）；Task 5 追加详情页 pre-Case /
// retention 封闭的展示投影（Spec §6/§7/§8，消费 NegotiationDetail）。纯函数：把已 decode 的
// NegotiationCard / NegotiationDetail（连续代谈.ts fail-closed）投影成现有 详情外壳/详情状态区/
// 阶段对话流/详情动作卡/详情底栏 接受的展示数据 —— 不强制转成 P5 视图，也由此不产生第二层
// 契约错误分支（decode 已挡漂移）。
//
// 阶段权威：服务端 phase + needs_action + case_state + failure/refusal_code。展示词：
//   · pre-Case 阶段标题为本域闭表；状态文案复用 P4委托状态文案（同一协议的既有权威文案）；
//   · evaluation_failed/refused 的失败原因经 P4失败原因文案/P4拒绝原因文案 投影，进注意说明；
//   · case_started 依据非空 case_state 复用既有 P5 阶段标题/状态文案/attention 说明；
//     case_state=null 时照常出卡（已开案 + 安全进度文案），不依据 case_state=null 隐藏卡；
//   · history 的 needs_action=false 只影响徽标，绝不据此隐藏卡或禁止恢复（权限读 actions.retry）。
// 职位事实缺失（NegotiationJob 的 title/薪资/城市可空段）按既有缺失规则给占位；技能段
// NegotiationJob 不提供，恒无。本模块不重排顺序（顺序权威在服务端）、不发请求、不 import React。

import type { P5阶段, P5状态, BFF匹配解释 } from './BFF契约';
import type { P5Agent注意码, P5状态视图 } from './招聘数据源/MatchCase';
import type { NegotiationCard, NegotiationDetail } from './招聘数据源/连续代谈';
import { P4委托状态文案, P4失败原因文案, P4拒绝原因文案, 公司短行 } from './发现推荐映射';
import { 规范薪资文本 } from './薪资展示';
import { 初评证据文案, 公开初评决定文案, 公开初评过程文案 } from './代谈结果文案';
import type { 核对结果 } from './代谈结果文案';
import { 从冻结职位到资料, 投影冻结职位摘要 } from './详情展示映射';
import type { 分段项, 段内记录 } from '../组件/阶段对话流';
import type {
  详情底栏信息,
  顶栏信息,
  状态区信息,
  职位资料信息,
} from '../组件/在谈详情/类型';

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
  /**
   * release/0.2.5 组织摘要（Spec §5.2）：公司名/短行/字标/Logo 只认 job.organization，
   * 对象或成员缺失给 null（卡面走既有未知占位，不拿 claim 名冒充已知公司）。字标只在
   * 真实 Logo 在场时给出 —— 无媒体保持中性空位，绝不按公司名命中静态图。
   */
  公司: string | null;
  公司简介: string | null;
  公司字标: { 首字: string; 公司名: string } | null;
  公司图片URL: string | null;
  /** 当前查看者原推荐批次分（0 合法）；无溯源为 null，不造 0。 */
  匹配分: number | null;
  /**
   * include=match_explanation 展开时出现（C1 两态）：解释对象或显式 null——
   * 缺席=未展开读取、null=已展开无溯源；不从分数/理由文字重造。
   */
  匹配解释?: BFF匹配解释 | null;
  /** 在谈卡标签行：地点 → 办公方式 → 技能，未知成员不补默认（Mock 岗位属性顺序；
   *  §8A.1：年薪月数已由薪资后缀表达，不再有独立「N 薪」段）。 */
  标签们: readonly string[];
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
  resume_submission: '递交简历',
  needs_coordination: '差异协同',
  intent_confirmation: '意向确认',
} as const satisfies Record<P5阶段, string>;

// 在谈卡标签行的办公方式段：与 发现推荐映射 的闭表同一份文案（该表未导出，按同一份词重申）
const 办公方式文案 = { onsite: '现场', hybrid: '混合', remote: '全远程' } as const;

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

  // release/0.2.5：组织摘要、批次分与标签行成员都来自卡上已 decode 的字段；未知不补默认。
  const 组织 = card.job.organization;
  const 公司名 = 非空段(组织?.display_name ?? null);
  const 公司图片URL = 组织?.logo?.url ?? null;
  return {
    recordId: card.record_id,
    recordKind: card.record_kind,
    intentionId: card.intention_id,
    职位名: 非空段(card.job.title) ?? '职位信息未知',
    城市: 非空段(card.job.location),
    // §8A.3：显示字符串在映射边界按有限识别规范化（同源月数并入后缀、单位矛盾串降级）
    薪资带: 规范薪资文本(card.job.public_salary_range, card.job.annual_salary_months),
    公司: 公司名,
    公司简介: 组织 === null || 公司名 === null ? null : 公司短行(组织),
    公司字标: 公司名 !== null && 公司图片URL !== null
      ? { 首字: Array.from(公司名)[0] ?? '', 公司名 }
      : null,
    公司图片URL,
    匹配分: card.match_score,
    // 已展开解释两态原样透传（缺席=未展开读取、null=已展开无溯源），不从分数重造
    ...(card.匹配解释 === undefined ? {} : { 匹配解释: card.匹配解释 }),
    标签们: [
      非空段(card.job.location),
      card.job.workplace_mode === null ? null : 办公方式文案[card.job.workplace_mode],
      ...(card.job.required_skills ?? []),
    ].flatMap((段) => {
      const 文 = typeof 段 === 'string' ? 非空段(段) : null;
      return 文 === null ? [] : [文];
    }),
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

// ── J-PILOT-01 Task 5：详情页 pre-Case / retention 封闭的展示投影（Spec §6/§7/§8）──
// pre-Case 状态与四个未到达阶段只作展示数据（不构造假 P5 详情、不提交为业务 state）；
// 文案/禁用标记在本模块闭表产出（plan review-r1 裁定），Task 6 的原控件禁用能力就绪后
// 联合验证，数据形状不变。

/** Spec §6 冻结：尚未开案时状态区据实显示的两句（与列表短文案不同词，别混用）。 */
const 连续详情状态文案表 = {
  accepted: '已接手，等待开始',
  evaluating: '正在进行公开信息初评',
} as const;

/** Spec §7 输入框表第一行：初评运行中的占位与禁用说明同句。 */
export const 公开初评运行文案 = 'AI 代理正在进行公开信息初评';
/** pre-Case 失败/拒绝后的真实文案：不冒充初评仍在运行（Spec §7「区分」要求）。 */
const 初评未完成文案 = '公开信息初评未完成';
const 已拒绝文案 = '本次未能继续';
/** retention 封闭（case_started 且 case_detail=null）复用终局只读口径（终局只读说明 同句重申）。 */
const 封闭只读说明 = '当前在谈已结束，仅可查看';

/** pre-Case 详情状态区：列表短词 + Task 5 冻结文案；轮次恒 null（无轮次不造 0/3）。 */
export function 从连续到详情状态(detail: NegotiationDetail): 状态区信息 {
  const 卡视图 = 映射连续列表项(detail);
  return {
    阶段: 卡视图.阶段标题,
    状态: detail.phase === 'accepted' || detail.phase === 'evaluating'
      ? 连续详情状态文案表[detail.phase]
      : 卡视图.状态文案,
    步骤: null,
    轮次: null,
    徽标: 卡视图.徽标,
    注意说明: 卡视图.注意说明,
  };
}

/** pre-Case 职位四事实的投影输入：原值可空段以空串进 投影冻结职位摘要（不先占位，
 *  冻结 title/location/结构化薪资才有机会补空；占位在投影之后补）。 */
function 连续摘要输入(detail: NegotiationDetail): {
  职位: string; 城市: string; 薪资: string; 技能: readonly string[] | null;
} {
  return {
    职位: detail.job.title ?? '',
    城市: detail.job.location ?? '',
    薪资: detail.job.public_salary_range ?? '',
    // review-r1：NegotiationJob 自 release/0.2.5 起携带 required_skills（null=未知，
    // []=已知为空，二者不互换）；同一响应权威事实，不跨 API 拼资料。
    技能: detail.job.required_skills,
  };
}

/**
 * pre-Case 详情顶栏：求职端同款槽位，职位/城市/薪资走 投影冻结职位摘要（Task 5：
 * 与资料 Tab 同吃一份冻结投影，同记录同次响应），投影仍缺的成员给既有占位，不猜公司。
 * Task 6：公司名取同一响应 job_detail 的组织名（缺失保持『公司信息缺失』），右侧取
 * 同一响应的权威 match_score（0 合法；无溯源 null 不造 0，不外查/拼其它记录）。
 */
export function 从连续到详情顶栏(detail: NegotiationDetail): 顶栏信息 {
  // review-r1：公司名同语义回退 —— 冻结快照（job_detail）优先，缺席时用同一响应外层
  // job.organization（同源权威事实，不补读）；双方都缺才给「公司信息缺失」。
  const 公司名 =
    非空段(detail.job_detail?.organization?.display_name ?? null) ??
    非空段(detail.job.organization?.display_name ?? null) ??
    '公司信息缺失';
  const 摘要 = 投影冻结职位摘要(连续摘要输入(detail), detail.job_detail);
  return {
    端: '求职',
    标题: `${非空段(摘要.职位) ?? '职位信息未知'} · ${公司名}`,
    副标题: `${非空段(摘要.城市) ?? '城市未知'} · ${非空段(摘要.薪资) ?? '薪资未知'}`,
    画像: null,
    右侧: { kind: '分数', 值: detail.match_score },
    岗位上下文: null,
  };
}

/**
 * pre-Case 第二 Tab 职位资料：negotiation.job 只给实际字段；消费同一响应的 job_detail
 * （pre-case 也用它自身冻结职位，不因没有 case_id 隐藏）与 match_score —— 摘要的冻结
 * 补位在 从冻结职位到资料 内部的 投影冻结职位摘要 完成（与顶栏同一份投影）；投影仍缺
 * 的成员补既有占位（在投影之后，不占住冻结值的位置）；legacy（job_detail=null）沿用
 * 全缺失底座，旧四事实不被抹去。
 */
export function 从连续到职位资料(detail: NegotiationDetail): 职位资料信息 {
  const 资料 = 从冻结职位到资料({
    摘要: 连续摘要输入(detail),
    冻结: detail.job_detail,
    分: detail.match_score,
    // Task 6（Spec §3.4/§5.4）：pre-Case 也吃同一响应的展开解释（解释属于推荐本身，
    // case_id 缺席不隐藏）；转 Case 后由 P5 侧 从P5到职位资料 整体切换，绝不拼接两源。
    解释: detail.匹配解释,
  });
  if (资料.摘要 === null) return 资料;
  return {
    ...资料,
    摘要: {
      职位: 非空段(资料.摘要.职位) ?? '职位信息未知',
      城市: 非空段(资料.摘要.城市) ?? '城市未知',
      薪资: 非空段(资料.摘要.薪资) ?? '薪资未知',
      技能: 资料.摘要.技能,
    },
  };
}

/**
 * 失败/重试历史 → 段内灰色注释（A.6）：安全中文失败原因（P4 同一闭表），按实际时间
 * 升序；同一时间同一来源只留一条（不按文本删不同事件）；空数组不占块。
 */
function 失败历史注释(历史: NegotiationDetail['failure_history']): 段内记录[] {
  const 已见 = new Set<string>();
  return 历史
    .map((事件, 输入序) => {
      const 毫秒 = Date.parse(事件.occurred_at);
      return { 事件, 输入序, 毫秒: Number.isNaN(毫秒) ? null : 毫秒 };
    })
    .sort((左, 右) => {
      if (左.毫秒 !== null && 右.毫秒 !== null && 左.毫秒 !== 右.毫秒) return 左.毫秒 - 右.毫秒;
      if (左.毫秒 !== null && 右.毫秒 === null) return -1;
      if (左.毫秒 === null && 右.毫秒 !== null) return 1;
      return 左.输入序 - 右.输入序;
    })
    .flatMap(({ 事件, 输入序 }) => {
      const 去重键 = `${事件.occurred_at}|${事件.evaluation_id ?? ''}|${事件.code}`;
      if (已见.has(去重键)) return [];
      已见.add(去重键);
      return [{
        kind: '注释' as const,
        编号: `fh:${事件.retry_generation}:${输入序}`,
        标签: null,
        时间: null,
        内容: P4失败原因文案(事件.code),
      }];
    });
}

/**
 * 四阶段均未到达（Spec §6）：共用阶段名一段不缺，不造轮次/Q/A。
 * S0–S3 展示统一 Task 4（Spec §5.2）：pre-Case（非 case_started）的匿名初筛标题旁
 * 「未开始」，用 可展开+默认展开 打开同款小结/中文核对项区域，显示公开初评的过程
 * （evaluation.state → 初评中/完成/未完成/超时）或决定与证据；失败初评的重试/归档
 * 动作卡由控制层装进该段尾部。绝不把打开的信息区标成 active/passed，也不为开案前的
 * 记录造阶段消息。retention（case_started 且 case_detail=null）不擅自造阶段：四段
 * 照旧灰条不可展开，公开初评残留仍在页顶托盘。
 */
export function 从连续到详情分段(detail: NegotiationDetail): 分段项[] {
  const 是preCase = detail.phase !== 'case_started';
  const 评 = 映射公开初评(detail);
  // 初评过程的权威状态：evaluation 在场读它；缺席时按 phase 给安全过程词（只落在
  // evaluating / evaluation_failed 两个 phase，accepted/refused 不猜）
  const 过程态 = detail.evaluation?.state
    ?? (detail.phase === 'evaluating' ? 'pending' : detail.phase === 'evaluation_failed' ? 'failed' : null);
  const 有失败历史 = detail.failure_history.length > 0;
  // 初评中/初评失败本身就是 §5.2 的 S0 信息内容（「公开初评中/匹配/不匹配/待确认」），
  // 这两个 phase 恒可展开；其余 pre-Case 有评估事实才展开
  const 可展开 = 是preCase
    && (评 !== null || detail.evaluation !== null || detail.phase === 'evaluating'
      || detail.phase === 'evaluation_failed' || 有失败历史);
  // 初评失败的原因是权威事实：即使 actions 未允许出恢复卡，也要在 S0 信息区有落点
  //（有卡时与卡.说明同词各一处，与改前 状态区+卡 的两处口径一致）
  const 失败原因行 =
    detail.phase === 'evaluation_failed' && detail.failure !== null
      ? [P4失败原因文案(detail.failure.code)]
      : [];
  return (['匿名初筛', '递交简历', '需要协调', '意向确认'] as const).map((阶段, 序) => {
    if (序 !== 0 || !可展开) {
      return {
        阶段,
        展示标题: 阶段,
        态: '未到达' as const,
        ...(序 === 0 && 是preCase ? { 待推进说明: '未开始' as const } : {}),
      };
    }
    return {
      阶段,
      展示标题: 阶段,
      态: '未到达' as const,
      // 可展开段走分节条 button 分支：标题旁的「未开始」由状态胶囊承载（A.2.1 pending 闭词），
      // 不可展开的灰条分支才经 待推进说明 显示
      状态文: '未开始' as const,
      可展开: true,
      默认展开: true,
      小结: 评?.决定文 ?? 公开初评过程文案(过程态),
      小结行们: 失败原因行.length > 0 ? 失败原因行 : undefined,
      ...(评 !== null ? { 核对清单: 评.核对清单 } : {}),
      ...(有失败历史 ? { 记录: 失败历史注释(detail.failure_history) } : {}),
    };
  });
}

/** pre-Case 底栏（Spec §7 输入框表）：占位与禁用说明成对产出，发送恒 null（无 Case 叮嘱请求）；
 *  Task 6 把只读 div 换成真禁用控件时数据形状不变。 */
export function 映射连续底栏(detail: NegotiationDetail): 详情底栏信息 {
  if (detail.phase === 'case_started') {
    // case_detail=null 的 case_started = retention 封闭（开案中的分支归 Case 渲染）
    return { kind: '只读', 说明: 封闭只读说明 };
  }
  const 禁用说明 = detail.phase === 'accepted' || detail.phase === 'evaluating'
    ? 公开初评运行文案
    : detail.phase === 'evaluation_failed' ? 初评未完成文案 : 已拒绝文案;
  return { kind: '输入', 占位: 禁用说明, 值: '', 改变: () => undefined, 发送: null, 禁用说明 };
}

/**
 * 公开信息初评的展示数据（S0–S3 展示统一 Task 4）：只来源 agent_summary.public_evaluation，
 * 决定与证据按附录 A 字典走 Task 1 中文闭表 —— 英文 summary 与 wire code/source 一律
 * 不再产出上屏（A.4：不让前端在线翻译或整段照搬）。决定/核对清单由消费者装进 S0
 * 「公开资料匹配检查」区域（pre-Case）或页顶残留托盘（retention）。
 */
export interface 公开初评托盘视图 {
  /** 稳定 key：evaluation_id（轮询整包替换时 React 不误配对）。 */
  编号: string;
  /** 决定的中文文案（A.2.1：公开初评匹配/不匹配/待确认；未知词安全兜底，不译英文 summary）。 */
  决定文: string;
  /** 证据核对项（A.4 完整中文句 + 核对结果；code/source 不透出，未知维度按「其他条件」）。 */
  核对清单: { 项: string; 结果: 核对结果 }[];
}

export function 映射公开初评(detail: NegotiationDetail): 公开初评托盘视图 | null {
  const 评 = detail.agent_summary.public_evaluation;
  if (评 === null) return null;
  return {
    编号: 评.evaluation_id,
    决定文: 公开初评决定文案(评.decision),
    核对清单: [
      ...评.evidence.matches.map((项) => 初评证据文案('matches', 项)),
      ...评.evidence.conflicts.map((项) => 初评证据文案('conflicts', 项)),
      ...评.evidence.unknowns.map((项) => 初评证据文案('unknowns', 项)),
    ],
  };
}

/** 失败初评的动作卡展示数据（Spec §8）：只有权威 actions 允许时给出对应按钮文案；
 *  执行回调归控制层接（操作.重试连续记录/归档连续记录），本模块不发请求。 */
export interface 连续失败动作视图 {
  卡: { 键: string; 标题: string; 说明: string | null };
  /** actions.retry 允许才有；否则 null（不出按钮）。 */
  重试文案: string | null;
  /** actions.archive 允许才有；否则 null。 */
  归档文案: string | null;
  /** 归档二次确认（现有确认层）：描述「移入历史，不是取消」。 */
  归档确认: { 标题: string; 正文: string; 执行文: string; 取消文: string };
}

export function 映射连续失败动作(detail: NegotiationDetail): 连续失败动作视图 | null {
  // 只有失败初评出恢复动作：refused/Case 阶段不出 Agent 重跑、pre-Case 归档或保证可结束按钮
  if (detail.phase !== 'evaluation_failed') return null;
  if (!detail.actions.retry && !detail.actions.archive) return null;
  return {
    卡: {
      键: '连续失败动作',
      标题: 初评未完成文案,
      说明: detail.failure === null ? null : P4失败原因文案(detail.failure.code),
    },
    重试文案: detail.actions.retry ? '重试初评' : null,
    归档文案: detail.actions.archive ? '归档' : null,
    归档确认: {
      标题: '归档这条记录？',
      正文: '移入历史，不是取消',
      执行文: '归档',
      取消文: '取消',
    },
  };
}
