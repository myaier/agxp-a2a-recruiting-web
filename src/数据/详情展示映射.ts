// 详情展示映射：两条在谈详情路由共用的纯数据投影。无 I/O、无 React、不读 fixture/Context，
// 缺失一律 null（占位文案归展示层），绝不传 0/NaN 充当缺失。现有 MatchCase展示映射.ts
// 的协议语义不动；Mock 的顶栏由连接层用已有状态构造，不在 mapper 内读全局数据。
// 顶栏投影在 Task 1 落地，Task 2 补状态区与阶段分段，Task 3 补资料区投影（契约 B）。

import type { P5阶段, P5阶段区块视图, P5详情正常视图, P5角色 } from './MatchCase展示映射';
import type { BFF安全职位资料 } from './BFF契约';
import { 公司规模文案, 融资阶段文案, 福利文案 } from './组织映射';
import type { 状态区信息, 顶栏信息, 职位资料信息 } from '../组件/在谈详情/类型';
import type { 分段项 } from '../组件/阶段对话流';
import type { 对话条, 阶段 } from './类型';

/** trim 后无有效字符按缺失处理（同 列表卡片映射 的缺失规则） */
function 非空文本(值: string | null | undefined): string | null {
  const 文 = 值?.trim() ?? '';
  return 文 === '' ? null : 文;
}

/** 开放 string 码只认闭合文案表内键（同 发现推荐映射.码表段：表外码不展示、不强转枚举） */
function 码表段<T extends object>(表: T, 码: string | null | undefined): string | null {
  if (码 === null || 码 === undefined || !已有键(表, 码)) return null;
  const 文 = 表[码];
  return typeof 文 === 'string' && 文.trim() !== '' ? 文 : null;
}

function 已有键<T extends object>(表: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(表, key);
}

/** JD 文本按行拆条：trim 后丢空行（同 发现推荐映射.拆行 的口径） */
function 拆行(文本: string): string[] {
  return 文本.split(/\r?\n/).map((行) => 行.trim()).filter((行) => 行 !== '');
}

/**
 * P5 详情正常视图 → 顶栏信息。
 *
 * 求职端：标题 = 冻结职位名 · 公司名（spec §6.2「标题公司名与正文同源」—— 只吃同一
 * 响应的 冻结职位资料.organization.display_name；对象/名称缺失显示『公司信息缺失』，
 * 公司槽位原样保留在标题里，不加新查询/类型）、副标题 = 城市 · 薪资带（与接线前逐字
 * 一致）；岗位上下文已由标题/副标题承载，给 null。右侧取同一响应的权威 match_score
 * （真实 0 合法；null 无溯源 → 展示层显示「—」并说明「匹配分缺失」，不画假分数，
 * 不外查、不拼其它记录的分数）。
 *
 * 招聘端：去名裁定 —— candidateAlias 是不透明展示文本，不进顶栏（标题/副标题 null）；
 * Backend 详情没有结构化画像字段，但画像位置全保留（字段全 null，占位文案归展示层）；
 * 冻结职位 · 城市 · 薪资带改由 岗位上下文 单独承载，不丢 Backend 已知事实。
 */
export function 从P5到详情顶栏(view: P5详情正常视图): 顶栏信息 {
  const 公司名 = 非空文本(view.冻结职位资料?.organization?.display_name ?? null) ?? '公司信息缺失';
  if (view.role === 'candidate') {
    return {
      端: '求职',
      标题: `${view.职位.职位名} · ${公司名}`,
      副标题: `${view.职位.城市} · ${view.职位.薪资带}`,
      画像: null,
      右侧: { kind: '分数', 值: view.匹配分 },
      岗位上下文: null,
    };
  }
  return {
    端: '招聘',
    标题: null,
    副标题: null,
    画像: { 性别: null, 年限: null, 学历: null, 求职状态: null },
    右侧: { kind: '分数', 值: view.匹配分 },
    岗位上下文: `${view.职位.职位名} · ${view.职位.城市} · ${view.职位.薪资带}`,
  };
}

// ── 资料区（详情统一 Task 3 契约 B）─────────────────────────────────────────

/**
 * 职位四事实 → 第二 Tab（资料）的职位资料信息（J-PILOT-01 Task 5 抽出的共用底座）。
 *
 * P5 detail 与 negotiation.job 都只携带冻结职位事实（职位名/城市/薪资带/技能），因此摘要
 * 如实保留、其余区块全部是合法缺失（null = 数据源未提供）：没有匹配分与对齐证据就不给
 * 分、不给行；公司五元行位置恒在（标签闭集、值全 null），对接人不生成姓名/首字。缺口
 * 说明用约定句「当前在谈详情数据未提供」，不建原因系统，也绝不用别处查询（公司/岗位/
 * 推荐）补值。
 */
export function 从职位摘要到资料(职位: {
  职位: string;
  城市: string;
  薪资: string;
  技能: readonly string[];
}): 职位资料信息 {
  return {
    摘要: {
      职位: 职位.职位,
      城市: 职位.城市,
      薪资: 职位.薪资,
      技能: 职位.技能,
    },
    分析: { 分: null, 行们: null, 文案: null },
    职位详情: null,
    职位要求: null,
    公司: {
      名称: null,
      字标: null,
      简介: null,
      元行: [
        { 标签: '融资阶段', 值: null },
        { 标签: '规模', 值: null },
        { 标签: '行业', 值: null },
        { 标签: '成立', 值: null },
        { 标签: '地址', 值: null },
      ],
      标签: null,
    },
    对接人: { 姓名: null, 职务: null, 字标: null },
    接口缺口说明: '当前在谈详情数据未提供',
  };
}

/**
 * 冻结职位资料（BFF安全职位资料，可 null）→ 第二 Tab（资料）的职位资料信息。
 *
 * 在谈详情的 Case/pre-Case 共用底座（Spec §6.2）：摘要仍用旧职位四事实（不因
 * job_detail=null 抹去旧事实），冻结快照在场时把完整 JD、结构化要求正文、公司简介/
 * 元信息/福利、发布人姓名职务填进既有原槽，成员缺失给 null（未知）；只有旧 job 四
 * 事实的 legacy Case 原样走 从职位摘要到资料 的全缺失底座 + 缺口说明。
 * 不补读当前 Job/组织替换冻结正文；匹配分析无对齐证据不给行（权威分只进分数槽，
 * 组件按「有分无证据」显示缺失，绝不把空行喂给分析块）。
 */
export function 从冻结职位到资料(输入: {
  摘要: { 职位: string; 城市: string; 薪资: string; 技能: readonly string[] };
  冻结: BFF安全职位资料 | null;
  分: number | null;
}): 职位资料信息 {
  const 基础 = 从职位摘要到资料(输入.摘要);
  // 同一响应的权威分：0 合法；无对齐证据时 行们/文案 保持缺失（组件负责缺失说明）
  基础.分析 = { 分: 输入.分, 行们: null, 文案: null };
  const 冻结 = 输入.冻结;
  if (冻结 === null) return 基础;
  const 组织 = 冻结.organization;
  return {
    ...基础,
    职位详情: 冻结.description === null ? null : 拆行(冻结.description),
    职位要求: 冻结.requirements === null ? null : 拆行(冻结.requirements),
    公司: {
      名称: 非空文本(组织?.display_name ?? null),
      // 文字首字不冒充真实媒体：只有 Logo 在场才给图位输入（同 Task 3/4 图片口径）
      字标: null,
      图片URL: 组织?.logo?.url ?? null,
      编号: 非空文本(组织?.organization_id ?? null),
      简介: 非空文本(冻结.company_intro),
      元行: [
        { 标签: '融资阶段', 值: 码表段(融资阶段文案, 组织?.funding_stage ?? null) },
        { 标签: '规模', 值: 码表段(公司规模文案, 组织?.company_size ?? null) },
        { 标签: '行业', 值: 非空文本(组织?.industry?.display_name ?? null) },
        // 公司成立时间本轮无源（Spec §9 延后项），位置保留
        { 标签: '成立', 值: null },
        // 地址 = 公司地址（office_address）；岗位办公地址（office_location）语义分开不混填
        { 标签: '地址', 值: 非空文本(冻结.office_address) },
      ],
      // 福利码只认闭合文案表：未知码不展示，全部未知收口空数组（暂无）
      标签: 冻结.benefit_codes === null
        ? null
        : 冻结.benefit_codes.flatMap((码) => (已有键(福利文案, 码) ? [福利文案[码]] : [])),
    },
    对接人: {
      姓名: 非空文本(冻结.publisher_profile?.public_name ?? null),
      职务: 非空文本(冻结.publisher_profile?.title ?? null),
      // 不用姓名首字充当照片（Task 4 口径）：只有真实头像 URL 才给图位输入
      字标: null,
      头像URL: 冻结.publisher_profile?.avatar_url ?? null,
    },
    // 冻结快照在场：整页缺口说明退场（成员级缺失由组件原位显示）
    接口缺口说明: null,
  };
}

/**
 * P5 详情正常视图 → 第二 Tab（资料）的职位资料信息（从P5到职位资料 的 Case 入口）。
 * 摘要四事实与 权威分/冻结职位资料 同源（同一响应）。
 */
export function 从P5到职位资料(view: P5详情正常视图): 职位资料信息 {
  return 从冻结职位到资料({
    摘要: {
      职位: view.职位.职位名,
      城市: view.职位.城市,
      薪资: view.职位.薪资带,
      技能: view.职位.技能,
    },
    冻结: view.冻结职位资料,
    分: view.匹配分,
  });
}

// ── 状态区与阶段分段（详情统一 Task 2 契约 B）────────────────────────────────

/** P5阶段 → 共用四阶段中文名：分段的颜色/排序/折叠键闭集（与 数据/类型 的 阶段顺序 同表）。 */
const 阶段名表: Record<P5阶段, 阶段> = {
  anonymous_screening: '匿名初筛',
  resume_submission: '递交简历',
  needs_coordination: '需要协调',
  intent_confirmation: '意向确认',
};

/**
 * P5 详情正常视图 → 「代谈进度」的状态区信息。
 *
 * 徽标只由权威布尔投影：待办优先「需要你」，attention 行退「需注意」（owner-safe 说明
 * 原样带出），其余「代理处理中」；终局是只读语义，徽标退场而不是「处理中」。
 * 闭词状态文案、步骤说明与轮次原样保留（轮次 0 是合法值），Mock 等没有轮次字段的来源
 * 由调用方给 null（展示层显示缺失），mapper 绝不补 0。
 */
export function 从P5到详情状态(view: P5详情正常视图): 状态区信息 {
  return {
    阶段: view.阶段标题,
    状态: view.状态文案,
    步骤: view.步骤说明,
    轮次: { 当前: view.轮次.当前, 预算: view.轮次.预算 },
    徽标: view.终局 ? null : view.待办 ? '需要你' : view.注意说明 !== null ? '需注意' : '代理处理中',
    注意说明: view.注意说明,
  };
}

/**
 * S0 Agent 问答 → 带角色标签的展示气泡（J-PILOT-01，Spec §7 D08）：角色标签按 wire
 * role 投影成「候选 Agent／招聘 Agent」（不显示内部 ID/task/operation 字样），左右按
 * viewer（己方 Agent 在右、对方在左）；正文按 answer_status 已由映射层投影（拒答/未知/
 * 无法回答沿用固定文案）。顺序权威在服务端（真实 round 与 question→answer），不混排。
 * key 用带前缀的稳定业务 ID，轮询整包替换时 React 不会误配对。
 */
function 段内Agent对话(区: P5阶段区块视图, role: P5角色): 分段项['Agent对话'] {
  if (区.Agent消息.length === 0) return undefined;
  return 区.Agent消息.map((条) => ({
    编号: `s0:${条.id}`,
    角色: 条.role === 'candidate' ? '候选 Agent' : '招聘 Agent',
    方: 条.role === role ? ('我方' as const) : ('对方' as const),
    时间: 取本地时分(条.occurredAt),
    内容: 条.内容,
  }));
}

/**
 * 旧 transcript 事件 → 系统状态行（J-PILOT-01，Spec §7）：canonical case 事件以系统
 * 状态显示，不投成对方气泡；无文本的事件（纯 reason_code）无可展示，跳过。
 */
function 段内系统消息(区: P5阶段区块视图): 分段项['系统消息'] {
  const 行们 = 区.时间线
    .filter((项) => 项.text !== undefined && 项.text.trim() !== '')
    .map((项) => ({ 编号: `evt:${项.eventId}`, 内容: 项.text as string }));
  return 行们.length > 0 ? 行们 : undefined;
}

/**
 * 叮嘱回执 → 既有展示气泡（不伪装 Agent Q/A：不带角色标签，按归属分列）。
 */
function 段内叮嘱对话(区: P5阶段区块视图, role: P5角色): 对话条[] {
  return 区.叮嘱.flatMap((条) =>
    条.expression === undefined || 条.expression.trim() === ''
      ? []
      : [{
          编号: `aci:${条.instructionId}`,
          方: 条.owner === role ? ('我方' as const) : ('对方' as const),
          时间: 取短时间(条.occurredAt),
          内容: 条.expression,
        }],
  );
}

/** RFC3339 → 「HH:mm」（UTC 定长截取，纯展示格式化，绝不参与状态判定）。 */
function 取短时间(iso: string): string {
  return iso.slice(11, 16);
}

/**
 * S0 Agent 消息的本地时分（用户运行环境时区，两位 24 小时制 HH:mm）。只服务新 screening
 * records 的展示，绝不参与状态或动作判定；不固定产品时区、不硬编码加八小时。旧
 * transcript／instruction receipt 仍走 取短时间 的字符串切片 —— 同一 S0 阶段内两种时间
 * 口径并存是刻意兼容边界（观察后再决定是否另立统一任务）。
 */
const S0时刻格式 = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function 取本地时分(原文: string): string {
  if (typeof 原文 !== 'string') return '时间待确认';
  const 时刻 = new Date(原文);
  if (Number.isNaN(时刻.getTime())) return '时间待确认';
  const 段 = S0时刻格式.formatToParts(时刻);
  const 时 = 段.find((条) => 条.type === 'hour')?.value ?? '';
  const 分 = 段.find((条) => 条.type === 'minute')?.value ?? '';
  return 时 === '' || 分 === '' ? '时间待确认' : `${时}:${分}`;
}

/**
 * P5 详情正常视图 → 阶段对话流的分段（纯投影，不含任何命令）。
 *
 *   · 段态来自阶段区自身 state（pending/active/passed/ended），不从文本推，S0→S3 顺序
 *     按 mapper 交付的原样，客户端不重排；四阶段一段不缺。
 *   · 展示标题用 P5 自己的阶段标题（区.标题，服务端闭词投影）；颜色/排序/折叠键仍用
 *     共用阶段名（阶段名表），不改其它消费者的阶段命名。
 *   · 「默认展开」只标有动作的合法当前段 —— currentStage 必须来自 raw detail.state.stage
 *     （不从展示文案反推）；控制层据此把动作卡挂到这一段，passed 段也能展开看到等你的决定。
 *   · 附件只带文件名（招聘端 typed 附件是该段唯一 PDF 入口，附件常驻不随对话内容消失），
 *     点击回调归控制层，投影绝不绑定动作或 PDF。
 */
export function 从P5到详情分段(view: P5详情正常视图, currentStage: P5阶段): 分段项[] {
  const 有动作 = view.actions.length > 0;
  return view.阶段区块.map((区) => {
    const 态: 分段项['态'] =
      区.状态 === 'pending' ? '未到达' : 区.状态 === 'active' ? '当前' : '已完成';
    const 是动作段 = 有动作 && 区.stage === currentStage;
    return {
      阶段: 阶段名表[区.stage],
      展示标题: 区.标题,
      态,
      状态文: 态 === '未到达' ? null : 区.状态文案,
      小结: 态 === '未到达' || 区.摘要 === '' ? null : 区.摘要,
      核对清单: 区.清单.length > 0
        ? 区.清单.map((项) => ({ 项: 项.文本, 结果: 项.完成 ? ('通过' as const) : ('核对中' as const) }))
        : undefined,
      Agent对话: 段内Agent对话(区, view.role),
      系统消息: 段内系统消息(区),
      对话: 段内叮嘱对话(区, view.role),
      // S0 候选总结原样适配进小结托盘（标签/内容由 mapper 给定）；招聘方自然得到空数组
      Agent总结: 区.Agent总结.length > 0
        ? 区.Agent总结.map((总) => ({ 编号: 总.id, 标签: 总.标签, 内容: 总.内容 }))
        : undefined,
      // 未到达段的一行说明用服务端自己的阶段摘要（typed 块，不是时间线文本）——
      // 将来阶段说「还没到」，绝不写成接口缺失
      待推进说明: 态 === '未到达' && 区.摘要 !== '' ? 区.摘要 : undefined,
      // 当前阶段没有对话时的中性兜底一行（权威步骤说明），不生成一段模拟代理对话
      空说明: 态 === '当前' ? view.步骤说明 : undefined,
      附件: 区.附件 !== null ? { 文件名: 区.附件.displayName } : null,
      附件常驻: 区.附件 !== null ? true : undefined,
      默认展开: 是动作段 ? true : undefined,
    };
  });
}
