// 详情展示映射：两条在谈详情路由共用的纯数据投影。无 I/O、无 React、不读 fixture/Context，
// 缺失一律 null（占位文案归展示层），绝不传 0/NaN 充当缺失。现有 MatchCase展示映射.ts
// 的协议语义不动；Mock 的顶栏由连接层用已有状态构造，不在 mapper 内读全局数据。
// 顶栏投影在 Task 1 落地，Task 2 补阶段分段，Task 3 补资料区投影（契约 B）；
// S0–S3 展示统一 Task 4 把状态/初评证据/时序记录/结束原因归位到各阶段段（顶部不再有
// 状态条、公开初评托盘与终局卡）；Task 5 补 投影冻结职位摘要（顶栏与资料 Tab 同吃一份
// 冻结投影）与 S3 顶栏（标题职位、右侧岗位薪资）。

import type {
  P5待办用途,
  P5阶段,
  P5阶段区块视图,
  P5详情正常视图,
  P5角色,
} from './MatchCase展示映射';
import type { P5详情 } from './招聘数据源/MatchCase';
import type { BFF安全职位资料 } from './BFF契约';
import type { 公开初评托盘视图 } from './连续代谈展示映射';
import { 公司规模文案, 融资阶段文案, 福利文案 } from './组织映射';
import type { 顶栏信息, 职位资料信息, 在线简历展示资料 } from '../组件/在谈详情/类型';
import type { 分段项, 段内记录 } from '../组件/阶段对话流';
import type { 阶段 } from './类型';

/** trim 后无有效字符按缺失处理（同 列表卡片映射 的缺失规则） */
function 非空文本(值: string | null | undefined): string | null {
  const 文 = 值?.trim() ?? '';
  return 文 === '' ? null : 文;
}

/** 非空段拼接（Spec §5.3 副标题规则）：只留已有事实、无尾随「·」；全缺给 null。 */
function 非空拼接(段们: readonly (string | null)[]): string | null {
  const 实 = 段们.flatMap((段) => {
    const 文 = 段?.trim() ?? '';
    return 文 === '' ? [] : [文];
  });
  return 实.length > 0 ? 实.join(' · ') : null;
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
 * 冻结结构化薪资三元组 → 既有简洁薪资带文本（A.6：只认本记录已授权冻结值，不改单位
 * 合同）：三员齐、两界都是合法数字且 lower<=upper 才格式化（0 是合法界值）；缺成员、
 * 非法数字、倒置或缺周期一律缺失 —— 不补默认上下限、不猜周期、不做年薪乘月数。
 * month 沿用既有 K（'20-30K'），day/hour 前留一个空格（'300-500 元/天'，同 后端映射/
 * 发现推荐映射 口径）；单值上下限相等沿用既有简洁单值（'20K'，同 添加意向 回填格式）。
 */
function 冻结薪资带(冻结: BFF安全职位资料): string | null {
  const 下 = 冻结.salary_lower;
  const 上 = 冻结.salary_upper;
  if (下 === null || 上 === null || !Number.isFinite(下) || !Number.isFinite(上) || 下 > 上) {
    return null;
  }
  const 单位 = 冻结.salary_period === 'month' ? 'K'
    : 冻结.salary_period === 'day' ? ' 元/天'
    : 冻结.salary_period === 'hour' ? ' 元/时' : null;
  if (单位 === null) return null;
  return 下 === 上 ? `${下}${单位}` : `${下}-${上}${单位}`;
}

/**
 * 冻结职位统一摘要投影（S0–S3 展示统一 Task 5，Spec §6.2）：同一记录同一次响应里，
 * 旧四事实摘要与冻结 job_detail 合成一份摘要 —— 从冻结职位到资料 与两种 Backend 顶栏
 * 都吃它，一处有值处处有值。
 *   · 职位/城市：原摘要有效非空优先；缺失才用同一冻结 job_detail.title/location 补位；
 *     两头都缺原样带回缺口，由调用方决定占位；
 *   · 薪资：原摘要非空优先 → 完整合法的冻结结构化三元组（冻结薪资带）→ 缺失；
 *   · 技能：只认摘要原值（required_skills），keywords/benefits 不冒充技能。
 * 纯函数、无缓存：两条记录异值各算各的，不串。
 */
export function 投影冻结职位摘要(
  摘要: { 职位: string; 城市: string; 薪资: string; 技能: readonly string[] | null },
  冻结: BFF安全职位资料 | null,
): { 职位: string; 城市: string; 薪资: string; 技能: readonly string[] | null } {
  return {
    职位: 非空文本(摘要.职位) ?? 非空文本(冻结?.title ?? null) ?? 摘要.职位,
    城市: 非空文本(摘要.城市) ?? 非空文本(冻结?.location?.display_name ?? null) ?? 摘要.城市,
    薪资: 非空文本(摘要.薪资) ?? (冻结 === null ? null : 冻结薪资带(冻结)) ?? 摘要.薪资,
    技能: 摘要.技能,
  };
}

/**
 * P5 详情正常视图 → 顶栏信息。
 *
 * 求职端：标题/副标题/右侧的职位·城市·薪资一律来自 投影冻结职位摘要（与资料 Tab 同吃
 * 一份，同记录同次响应）。S0–S2 沿用 Mock：标题 = 职位 · 公司（公司名只吃同一响应的
 * 冻结职位资料.organization.display_name，缺失显示『公司信息缺失』，公司槽位原样保留，
 * 不加新查询）、右侧适配分；S3（意向确认是当前段）标题只剩职位、右侧改岗位薪资
 * （Spec §5.3，completed 停在 S3 同形）。副标题用已有事实非空拼接，无尾随「·」。
 * 右侧分数取同一响应的权威 match_score（真实 0 合法；null 无溯源 → 展示层显示「—」
 * 并说明「匹配分缺失」，不画假分数，不外查、不拼其它记录的分数）。
 *
 * 招聘端：去名裁定 —— candidateAlias 是不透明展示文本，不进顶栏（标题/副标题 null）；
 * 画像与在线简历正文同源（S0–S3 展示统一 Task 6，Spec §5.3/§7.2）：性别、年限、学历、
 * 求职状态与最近工作行都来自同一响应 candidate_resume 的安全摘要投影（调用方把
 * 从BFF到在线简历展示 的产物作第二参传入，禁止另拉 open/current resume 补齐），
 * 最近工作行作副标题；摘要缺失时画像位置全保留（字段全 null，占位文案归展示层）。
 * 每次都按传入投影重算 —— 合法有值变 null 立即清旧画像，不残留上一次摘要。
 * 冻结职位 · 城市 · 薪资带改由 岗位上下文 单独承载（同投影、非空拼接），不丢已知事实。
 */
export function 从P5到详情顶栏(
  view: P5详情正常视图,
  简历资料?: 在线简历展示资料 | null,
): 顶栏信息 {
  const 摘要 = 投影冻结职位摘要(
    { 职位: view.职位.职位名, 城市: view.职位.城市, 薪资: view.职位.薪资带, 技能: view.职位.技能 },
    view.冻结职位资料,
  );
  const 公司名 = 非空文本(view.冻结职位资料?.organization?.display_name ?? null) ?? '公司信息缺失';
  if (view.role === 'candidate') {
    // 当前阶段 = 最后一个非未到达段（四段顺序服务端冻结，active/ended/completed 都停
    // 在自己的段）；到 S3 即按 Mock 换成「职位 + 岗位薪资」顶栏
    const 当前阶段 = view.阶段区块.reduce<P5阶段 | null>(
      (阶段, 区) => (区.状态 === 'pending' ? 阶段 : 区.stage),
      null,
    );
    if (当前阶段 === 'intent_confirmation') {
      return {
        端: '求职',
        标题: 非空文本(摘要.职位),
        副标题: 非空拼接([公司名, 摘要.城市]),
        画像: null,
        右侧: { kind: '薪资', 值: 非空文本(摘要.薪资) },
        岗位上下文: null,
      };
    }
    return {
      端: '求职',
      // 公司名恒非空（已有「公司信息缺失」回退），拼接结果不会为 null
      标题: 非空拼接([摘要.职位, 公司名]),
      副标题: 非空拼接([摘要.城市, 摘要.薪资]),
      画像: null,
      右侧: { kind: '分数', 值: view.匹配分 },
      岗位上下文: null,
    };
  }
  const 摘要画像 = 简历资料?.画像 ?? null;
  return {
    端: '招聘',
    标题: null,
    副标题: 摘要画像?.职位行 ?? null,
    画像: {
      性别: 摘要画像?.性别 ?? null,
      年限: 摘要画像?.年限 ?? null,
      学历: 摘要画像?.学历 ?? null,
      求职状态: 摘要画像?.求职状态 ?? null,
    },
    右侧: { kind: '分数', 值: view.匹配分 },
    岗位上下文: 非空拼接([摘要.职位, 摘要.城市, 摘要.薪资]),
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
  技能: readonly string[] | null;
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
 * 在谈详情的 Case/pre-Case 共用底座（Spec §6.2）：摘要先过 投影冻结职位摘要（原四事实
 * 有效非空优先，冻结 title/location/结构化薪资补空 —— 与顶栏同吃一份投影，D1 顶栏
 * 一致），冻结快照在场时把完整 JD、结构化要求正文、公司简介/元信息/福利、发布人姓名
 * 职务填进既有原槽，成员缺失给 null（未知）；只有旧 job 四事实的 legacy Case 原样走
 * 从职位摘要到资料 的全缺失底座 + 缺口说明。
 * 不补读当前 Job/组织替换冻结正文；匹配分析无对齐证据不给行（权威分只进分数槽，
 * 组件按「有分无证据」显示缺失，绝不把空行喂给分析块）。
 */
export function 从冻结职位到资料(输入: {
  摘要: { 职位: string; 城市: string; 薪资: string; 技能: readonly string[] | null };
  冻结: BFF安全职位资料 | null;
  分: number | null;
}): 职位资料信息 {
  const 基础 = 从职位摘要到资料(投影冻结职位摘要(输入.摘要, 输入.冻结));
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
      // company_intro：'' 是已知空（组件显示「暂无公司介绍」），纯空白/null 才是缺失
      简介: 冻结.company_intro === '' ? '' : 非空文本(冻结.company_intro),
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

// ── 阶段分段（详情统一 Task 2 契约 B；S0–S3 展示统一 Task 4 按阶段重排）──────────

/** P5阶段 → 共用四阶段中文名：分段的颜色/排序/折叠键闭集（与 数据/类型 的 阶段顺序 同表）。 */
const 阶段名表: Record<P5阶段, 阶段> = {
  anonymous_screening: '匿名初筛',
  resume_submission: '递交简历',
  needs_coordination: '需要协调',
  intent_confirmation: '意向确认',
};

/** 分段折叠键的共用名（S0–S3 展示统一 Task 4）：控制层据此把动作卡/移交挂到当前段。 */
export function P5阶段共用名(stage: P5阶段): 阶段 {
  return 阶段名表[stage];
}

/**
 * S0 Agent 问答气泡的角色标签：answer_source='human' 是那一方本人写的公开回答（双方可见），
 * 必须与 Agent 的问答区分开；其余（含历史未标来源的记录）按 wire role 投影成
 * 「候选 Agent／招聘 Agent」。不显示内部 ID/task/operation 字样。
 */
function 记录角色标签(条: P5阶段区块视图['Agent消息'][number]): string {
  const 侧 = 条.role === 'candidate' ? '候选' : '招聘';
  return 条.answerSource === 'human' ? `${侧}方本人` : `${侧} Agent`;
}

/** transcript 事件 kind 的开放 string：无正文时只给确有用户价值的流程闭词的固定中文
 *  说明（Spec §A.5）；有非空正文的事件一律保留原文语义，协议 kind/reason_code 不进展示。 */
const 流程事件文案表 = {
  case_created: '开始代谈',
  decision_continue: '双方选择继续这一单',
  resume_submitted: '已递交简历',
} as const;

/** RFC3339 → epoch 毫秒（排序专用展示事实）；缺失/非法给 null，绝不造当前时刻。 */
function 时刻毫秒(原文: string): number | null {
  const 时刻 = Date.parse(原文);
  return Number.isNaN(时刻) ? null : 时刻;
}

/**
 * 一个阶段段的 段内记录 有序联合（S0–S3 展示统一 Task 4，Spec §A.5）：
 *   · 来源遍历序：候选私有总结（灰注释）→ 正式问答（气泡）→ 有效 transcript 事件
 *     （中文注释）→ 正式叮嘱回执（气泡）；
 *   · 展示顺序 = occurred_at 的 epoch 毫秒升序；同毫秒保留上面的稳定源序；缺失/非法
 *     时间不造当前时刻，保持遍历序排在有效时间之后；
 *   · 同一来源只按稳定 ID 去重（轮询整包替换不产生双份），不按文本删掉不同事件；
 *   · 时间统一浏览器本地时分（不把 UTC 切片与本地时间混用）；气泡左右按 viewer，
 *     回执仍以本人/代理身份落回时序，绝不投成对端发言。
 */
function 段内时序记录(区: P5阶段区块视图, role: P5角色): 段内记录[] {
  type 带序行 = { 条: 段内记录; 毫秒: number | null; 源序: number; 输入序: number };
  const 行们: 带序行[] = [];
  const 已见 = new Set<string>();
  区.Agent总结.forEach((总, 序) => {
    if (已见.has(总.id)) return;
    已见.add(总.id);
    行们.push({
      条: { kind: '注释', 编号: `sum:${总.id}`, 标签: 总.标签, 时间: 取本地时分(总.occurredAt), 内容: 总.内容 },
      毫秒: 时刻毫秒(总.occurredAt), 源序: 0, 输入序: 序,
    });
  });
  区.Agent消息.forEach((条, 序) => {
    if (已见.has(条.id)) return;
    已见.add(条.id);
    行们.push({
      条: {
        kind: '气泡',
        编号: `rec:${条.id}`,
        方: 条.role === role ? ('我方' as const) : ('对方' as const),
        角色: `${记录角色标签(条)} · 第 ${条.round} 轮`,
        时间: 取本地时分(条.occurredAt),
        内容: 条.内容,
      },
      毫秒: 时刻毫秒(条.occurredAt), 源序: 1, 输入序: 序,
    });
  });
  // transcript（A.5）：case_ended 已由阶段胶囊+结束时间表达，一概不重复；case_advanced
  // 无正文不显示、重复推进只列第一条有正文的；通用正文保留只限纯系统事件（role 为空
  // —— supplementary_question 等带 role 的结构化问答种类由 screening records 正式投影，
  // 不得以注释重复）；无正文时才给已知流程事件的固定中文说明；无正文且未知 kind 不显示。
  let 已列推进事件 = false;
  区.时间线.forEach((项, 序) => {
    if (项.kind === 'case_ended' || 已见.has(项.eventId)) return;
    const 正文 = 项.text?.trim() ?? '';
    let 内容: string | null;
    if (项.kind === 'case_advanced') {
      if (正文 === '' || 已列推进事件) return;
      已列推进事件 = true;
      内容 = 正文;
    } else if (正文 !== '' && 项.role === '') {
      内容 = 正文;
    } else {
      内容 = 已有键(流程事件文案表, 项.kind) ? 流程事件文案表[项.kind] : null;
    }
    if (内容 === null) return;
    已见.add(项.eventId);
    行们.push({
      条: { kind: '注释', 编号: `evt:${项.eventId}`, 标签: null, 时间: 取本地时分(项.occurredAt), 内容 },
      毫秒: 时刻毫秒(项.occurredAt), 源序: 2, 输入序: 序,
    });
  });
  // 正式叮嘱回执（A.5「仍标本人/代理回执」）：本人的叮嘱是用户自己的话，走荧光绿用户
  // 版式（Mock 连接器同款视觉即本人身份）；对端的叮嘱是对方本人的话，带既有本人标签，
  // 不伪装成对端代理问答。方向/时间戳照常保留，空正文继续省略。
  区.叮嘱.forEach((条, 序) => {
    const 内容 = 条.expression?.trim() ?? '';
    if (内容 === '' || 已见.has(条.instructionId)) return;
    已见.add(条.instructionId);
    const 本人 = 条.owner === role;
    const 条目: 段内记录 = {
      kind: '气泡',
      编号: `aci:${条.instructionId}`,
      方: 本人 ? ('我方' as const) : ('对方' as const),
      角色: 本人 ? '' : `${条.owner === 'candidate' ? '候选' : '招聘'}方本人`,
      时间: 取本地时分(条.occurredAt),
      内容,
    };
    if (本人) 条目.来自 = '用户';
    行们.push({
      条: 条目,
      毫秒: 时刻毫秒(条.occurredAt), 源序: 3, 输入序: 序,
    });
  });
  return 行们
    .sort((左, 右) => {
      if (左.毫秒 !== null && 右.毫秒 !== null && 左.毫秒 !== 右.毫秒) return 左.毫秒 - 右.毫秒;
      if (左.毫秒 !== null && 右.毫秒 === null) return -1;
      if (左.毫秒 === null && 右.毫秒 !== null) return 1;
      return 左.源序 - 右.源序 || 左.输入序 - 右.输入序;
    })
    .map((行) => 行.条);
}

/**
 * 正在等对端的人工待办 → 段内一行（S0–S3 连续筛选）：本人的待办由段尾动作卡承载
 * （连同它自己的截止时刻），这里只交代「在等谁、到几时」，绝不给按钮。
 */
function 段内待办说明(视图: P5详情正常视图, stage: P5阶段): 分段项['待办说明'] {
  const 行们 = 视图.待办们
    .filter((待办) => 待办.role !== 视图.role && 待办用途阶段表[待办.purpose] === stage)
    .map((待办) => ({
      编号: `todo:${待办.id}`,
      内容: 待办.说明,
      截止说明: `截止 ${待办.截止于} · ${待办.到期说明}`,
    }));
  return 行们.length > 0 ? 行们 : undefined;
}

/** 待办用途 → 它所属的阶段段（记录/卡都落在自己的阶段里，不串段）。 */
const 待办用途阶段表: Record<P5待办用途, P5阶段> = {
  s0_continue: 'anonymous_screening',
  s1_continue: 'resume_submission',
  s2_answer: 'needs_coordination',
  s3_confirm: 'intent_confirmation',
};

/**
 * S0 本地时分（用户运行环境时区，两位 24 小时制 HH:mm）。段内时序的统一时间口径
 * （气泡/注释同源），绝不参与状态或动作判定；不固定产品时区、不硬编码加八小时。
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

/** S0 通过段的阶段结论（Spec §A.2 第 2 层事实：passed 才显示，不单凭公开初评 fit）。 */
const S0通过结论 = '匿名初筛已通过';

/**
 * P5 详情正常视图 → 阶段对话流的分段（纯投影，不含任何命令；S0–S3 展示统一 Task 4）。
 *
 *   · 段态来自阶段区自身 state（pending/active/passed/ended），不从文本推，S0→S3 顺序
 *     按 mapper 交付的原样，客户端不重排；四阶段一段不缺。
 *   · 状态胶囊（Spec §A.2.1）：未开始 / 需要你·等待对方·进行中 / 已通过（S3 双方完成
 *     事实为已确认）/ 结束段 outcome 闭表。不以 summary 自然语言决定状态。
 *   · 段内往来 = 记录 有序联合（时序交错、按稳定 ID 去重），气泡与灰注释一次遍历；
 *     候选 S0 私有总结只走这条时序，托盘不再有第二份副本（招聘端恒无）。
 *   · 段底小结：终局段给结束原因 + 结束时间 + 恢复窗口；S0 通过段给阶段结论并注明
 *     「公开资料匹配检查」的决定（初评入参来自候选聚合，招聘端为 null）；其余沿用
 *     服务端阶段摘要。核对项只反映自身段状态（done=false 在终局为未完成）。
 *   · 当前步骤/轮次提示只挂当前段（v2 读服务端发问块记账，v1 读权威 round/预算，
 *     不写死 3）；未到达段保留折叠段与待推进说明；动作卡/移交由控制层装尾部。
 *   · 附件只带文件名（招聘端 typed 附件是该段唯一 PDF 入口，附件常驻不随对话内容消失），
 *     点击回调归控制层，投影绝不绑定动作或 PDF。
 */
export function 从P5到详情分段(
  view: P5详情正常视图,
  详情: P5详情,
  初评: 公开初评托盘视图 | null,
): 分段项[] {
  const currentStage = 详情.state.stage;
  return view.阶段区块.map((区) => {
    const 态: 分段项['态'] =
      区.状态 === 'pending' ? '未到达'
      : 区.状态 === 'active' ? '当前'
      : 区.状态 === 'ended' ? '已结束'
      : '已完成';
    const 是终局段 = 区.状态 === 'ended';
    // 状态胶囊：active 段按权威待办分化（本人待办=需要你、对端待办=等待对方，不能把
    // 所有 needs_user 当本人）；passed/ended 走区块自身文案，S3 双方确认完成才「已确认」
    let 状态文: string | null = 区.状态文案;
    if (态 === '未到达') {
      状态文 = null;
    } else if (区.状态 === 'active') {
      const 段待办 = view.待办们.filter((待办) => 待办用途阶段表[待办.purpose] === 区.stage);
      状态文 = 段待办.some((待办) => 待办.role === view.role)
        ? '需要你'
        : 段待办.some((待办) => 待办.role !== view.role)
          ? '等待对方'
          // v1（历史 Case）没有 pending_actions：viewer 级权威信号是 needs_action
          // （decoder 不变式 needsAction ⇔ available_actions 非空，动作卡只出当前段），
          // 恢复其「需要你」提示 —— A.2.1「本人待办存在时按权威输入显示」
          : view.待办 && 区.stage === currentStage ? '需要你' : 区.状态文案;
    } else if (区.stage === 'intent_confirmation' && 区.状态 === 'passed'
      && 详情.state.lifecycle === 'completed') {
      状态文 = '已确认';
    }
    const 小结 =
      态 === '未到达' ? null
      : 是终局段 ? (view.终局摘要?.原因 ?? null)
      : 区.stage === 'anonymous_screening' && 区.状态 === 'passed' ? S0通过结论
      : 区.摘要 === '' ? null : 区.摘要;
    const 小结行们 = [
      ...(初评 !== null && 区.stage === 'anonymous_screening' && 态 !== '未到达'
        ? [`公开资料匹配检查：${初评.决定文}`]
        : []),
      ...(是终局段 && view.终局摘要 !== null ? [`结束时间：${view.终局摘要.定格于}`] : []),
      ...(是终局段 && view.重新考虑 !== null ? [view.重新考虑.说明] : []),
      ...(态 === '当前' && view.注意说明 !== null ? [view.注意说明] : []),
    ];
    // S0 段核对项 = 公开资料匹配检查的中文证据打头，其后是本段自身 checklist（A.7）
    const 段核对项 = [
      ...(初评 !== null && 区.stage === 'anonymous_screening' && 态 !== '未到达'
        ? 初评.核对清单
        : []),
      ...区.清单.map((项) => ({
        项: 项.文本,
        // done=false 在终局段为未完成（不是还在核对）；其余段维持「核对中」
        结果: 项.完成 ? ('通过' as const) : 是终局段 ? ('未完成' as const) : ('核对中' as const),
      })),
    ];
    // 段首说明（当前段上下文，A.6：step 中文用于当前段一句说明；轮次读服务端记账，
    // 不写死 3）：当前段给步骤说明 + 轮次（v2 读发问块记账，v1 读 round/预算）；
    // 非当前的 S1/S2 段只带它自己的发问块轮次说明
    const 段首说明行们: string[] = [];
    if (区.stage === currentStage && 态 !== '未到达') {
      段首说明行们.push(view.步骤说明);
      if (view.对话进度 !== null && view.对话进度.stage === 区.stage) {
        段首说明行们.push(view.对话进度.轮次说明);
      } else {
        段首说明行们.push(`轮次 ${view.轮次.当前}/${view.轮次.预算}`);
      }
    } else if (view.对话进度 !== null && view.对话进度.stage === 区.stage) {
      段首说明行们.push(view.对话进度.轮次说明);
    }
    return {
      阶段: 阶段名表[区.stage],
      展示标题: 区.标题,
      态,
      状态文,
      小结,
      小结行们: 小结行们.length > 0 ? 小结行们 : undefined,
      核对清单: 段核对项.length > 0 ? 段核对项 : undefined,
      // 段内时序（Spec §A.5）：总结/问答/有效流程事件/回执一次遍历；未到达段为空
      记录: 态 === '未到达' ? [] : 段内时序记录(区, view.role),
      待办说明: 段内待办说明(view, 区.stage),
      // S3 固定总结只挂意向确认段（双方内容相同；版本号随权威重读换代）
      确认总结: 区.stage === 'intent_confirmation' && view.确认总结 !== null
        ? {
            版本说明: `本次确认的总结版本：第 ${view.确认总结.version} 版`,
            含义说明: view.确认总结.含义说明,
            分节们: view.确认总结.分节们,
          }
        : null,
      // 未到达段的一行说明用服务端自己的阶段摘要（typed 块，不是时间线文本）——
      // 将来阶段说「还没到」，绝不写成接口缺失
      待推进说明: 态 === '未到达' && 区.摘要 !== '' ? 区.摘要 : undefined,
      段首说明: 段首说明行们.length > 0 ? 段首说明行们 : undefined,
      附件: 区.附件 !== null ? { 文件名: 区.附件.displayName } : null,
      附件常驻: 区.附件 !== null ? true : undefined,
      // 展开默认值归组件（当前/已结束开、已通过/未到达关）；手动覆盖由 后端详情渲染
      // 以受控 props 下发，轮询不反复强制开合（Spec §5.1）
    };
  });
}
