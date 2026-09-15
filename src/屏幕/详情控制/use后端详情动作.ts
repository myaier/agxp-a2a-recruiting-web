// use后端详情动作 —— Backend 详情动作控制 hook（契约 C，Task 5 交付 S0 分支，
// Task 6 迁入 S1 五动作：accept/decline/retry/replace/decide_resume_screening，
// Task 8 迁入 S2/S3：decide_coordination / confirm_intent / decline_intent）。
// 业务控制自 屏幕/P5/MatchCase详情 的 阶段动作区 原样搬入，命令参数、锁与生命周期
// 逐项对照旧实现；S2/S3 的 typed 栅栏（当前协同块必需且本端未决 / 本端意向词为空）
// 只吃 raw 详情 —— 协同块与意向词不在展示视图里，判定与后端 projector 同判据。
//
// J-PILOT-01（Spec §7）：S0 不再提供 respond_fact 输入/提交 —— 展示映射白名单已摘除，
// 旧 S0 needs_user/human_decision 行只剩 待核实说明（注意说明）与允许的 end 路径，
// 本 hook 不再携带回答草稿/回答在飞表/事实问题；本 hook 不画任何未提供的动作。
//
// 生命周期（plan 固定）：本 hook 自持 S1 选择/披露草稿与局部代际（卸载/换 case 递增），
// 旧单迟到的成败回调对不上代际即整包作废，绝不改动新单草稿。
//
// S1 披露栅栏（spec §5 + §9）：接受/更换都当场重跑显式单选（准备候选委托简历 的
// 权威库；null = 会话/角色换代，静默返回，绝不当空库）+ 一次 Case 专属披露确认（点名
// 所选 PDF 与冻结职位名）；确认/取消都即刻清层，下一次绝不复用；disclosure_confirmed
// 只由这一次确认传字面 true。retry_resume_readiness 是原授权检查：使用阶段中原绑定
// file/version 对直接提交（字面 true），不重新选文件、不重新要求披露确认，也不是纯刷新
// 或重跑 Agent。真实 file_id/file_version_id 只在控制层经 键→行 映射
// （从附件行取选择值 / 阶段区 typed 附件）取得，绝不以文件名作身份。

import { useEffect, useRef, useState } from 'react';
import { 轻提示 } from '../../组件/轻提示';
import { BFF错误, 取后端错误文案 } from '../../数据/HTTP客户端';
import { 从附件行取选择值, type 附件简历选择值 } from '../../组件/附件简历选择层';
import { 附件状态文案 } from '../../流程/附件简历交互';
import type {
  详情动作卡信息, 详情按钮, 详情勾选位, 详情输入位, 简历选择属性, 确认属性,
} from '../../组件/在谈详情/类型';
import { 取S2待答问题, 取本人待办 } from '../../数据/MatchCase基础';
import type { P5待办视图, P5详情正常视图, P5角色 } from '../../数据/MatchCase展示映射';
import type { P5详情, P5简历附件 } from '../../数据/招聘数据源/MatchCase';
import type { BFF附件简历 } from '../../数据/BFF契约';
import type { 应用操作 } from '../../状态/后端/类型';
import { use导航 } from '../../路由/导航钩子';
import { 路径 } from '../../路由/路径表';

/** 契约 C 的输入（动作操作面与 屏幕/P5 阶段动作区 的 动作操作 同形）。 */
export interface 后端详情动作输入 {
  role: P5角色;
  caseId: string;
  视图: P5详情正常视图;
  详情: P5详情;
  操作: Pick<
    应用操作,
    '决定S0' | '决定S1' | '决定S2' | '决定S3' | '回答对话' | '重新考虑'
    | '提交简历' | '准备候选委托简历'
  >;
}

export interface 后端详情动作结果 {
  卡片们: readonly 详情动作卡信息[];
  简历选择: 简历选择属性 | null;
  披露确认: 确认属性 | null;
  终结确认: 确认属性 | null;
}

/** 终结类动作（结束初筛/婉拒邀请/判不合适）的二次确认载荷；取消统一收层。 */
interface 终结确认载荷 {
  标题: string;
  正文: string;
  执行文: string;
  取消文: string;
  执行: () => void;
}

export function use后端详情动作({
  role,
  caseId,
  视图,
  详情,
  操作,
}: 后端详情动作输入): 后端详情动作结果 {
  // 空附件库跳 我的简历（原 阶段动作区 行为原样保留）
  const { 跳转 } = use导航();

  // 命令（决定S0/决定S1/提交简历）的写中锁（与旧 阶段动作区 的 写中 同语义：POST 期间禁再点）
  const [写中, 设写中] = useState(false);
  // 终结类动作的二次确认（不可逆）：确认前零请求（原 待结束确认 + 待确认终局 合一）
  const [待终结确认, 设待终结确认] = useState<终结确认载荷 | null>(null);

  // S1 提交三态：权威库单选 → Case 专属披露确认 → POST（字面 true）；任一结束即清
  const [待选择, 设待选择] = useState<{ 文件们: readonly BFF附件简历[] } | null>(null);
  const [选中键, 设选中键] = useState<string | null>(null);
  const [待披露, 设待披露] = useState<{ 选择: 附件简历选择值 } | null>(null);

  // S0–S3 连续筛选（v2）的本地草稿：私有说明（S0/S1/重新考虑各一份）、S2 公开回答与
  // 「暂时无法回答」勾选。只在命令成功后清空 —— 失败（含 409）必须原样保住未发出的输入。
  const [说明草稿, 设说明草稿] = useState<Record<string, string>>({});
  const [回答草稿, 设回答草稿] = useState('');
  const [暂无法回答, 设暂无法回答] = useState(false);
  // S3 版本冲突记账：只记「我提交的是第几版」，用于提示总结已变化；绝不据此自动再次确认。
  const [S3冲突版本, 设S3冲突版本] = useState<number | null>(null);

  // 局部代际（原 准备代际）：卸载与换 case 都递增；迟到的权威库结果（含拒绝）与
  // 成败回调对不上代际就整包静默作废，绝不跨 case 弹层/提示/跳转。
  const 代际 = useRef(0);
  useEffect(() => () => {
    代际.current += 1;
  }, []);
  useEffect(() => {
    代际.current += 1;
    设写中(false); // 旧单写中在飞也放行新 scope（迟到 finally 过代际栅栏不再收口）
    设待终结确认(null);
    设待选择(null);
    设选中键(null);
    设待披露(null);
    设说明草稿({});
    设回答草稿('');
    设暂无法回答(false);
    设S3冲突版本(null);
  }, [caseId]);

  const 报错 = (错误: unknown) => 轻提示(取后端错误文案(错误));

  /** 写中（spec §5「正在提交…保留该动作位置并禁用解释」）统一禁用说明：写中期间
   * 每个被锁按钮就地给出可见/可访问解释，落定后恢复 null。 */
  const 写中说明 = '正在提交，请稍候';

  /** 命令包装：服务端先行，失败原地提示；权威重读归操作层（本 hook 绝不本地重建）。
   *  迟到栅栏（review-r1 F5，spec §5）：catch/finally 只在本轮代际上收口 —— 换单/卸载
   *  后迟到的失败提示与写中解锁对不上代际即整包作废，绝不落在新单的页面上。 */
  const 发命令 = async (
    运行: () => Promise<void>,
    收尾?: { 成功?: () => void; 失败?: (错误: unknown) => void },
  ) => {
    if (写中 || caseId === '') return;
    const 本轮 = 代际.current;
    设写中(true);
    try {
      await 运行();
      // 只有明确成功才清草稿：失败（含 409 版本冲突）必须原样保住未发出的输入。
      if (代际.current === 本轮) 收尾?.成功?.();
    } catch (错误) {
      if (代际.current === 本轮) {
        收尾?.失败?.(错误);
        报错(错误);
      }
    } finally {
      if (代际.current === 本轮) 设写中(false);
    }
  };

  // S1 接受/更换：先拿权威附件库（每次尝试都重跑），再多份单选、单份直达披露确认
  const 开始选择 = async () => {
    if (写中 || caseId === '') return;
    const 起始代际 = 代际.current;
    try {
      const 库 = await 操作.准备候选委托简历();
      if (代际.current !== 起始代际) return; // 迟到：scope 已变/已卸载，整包作废
      if (库 === null) return; // 会话/角色换代：静默返回，null 不是空库
      if (库.items.length === 0) {
        轻提示('请先上传一份 PDF 简历');
        跳转(路径.我的简历);
        return;
      }
      if (库.items.length === 1) {
        const 唯一 = 库.items[0];
        if (唯一 !== undefined) 设待披露({ 选择: 从附件行取选择值(唯一) });
        return;
      }
      设选中键(null); // 每次打开都重新单选，绝不记默认
      设待选择({ 文件们: 库.items });
    } catch (错误) {
      if (代际.current !== 起始代际) return; // 拒绝路径同样过栅栏
      报错(错误);
    }
  };

  // S1 重试（retry_resume_readiness，Spec §9）：原授权检查 —— 坐标只取阶段区 typed
  // 附件（Case 当前绑定的 file/version 对，绝不猜、不重选），用原授权直接执行既有
  // submitResume（字面 true），不重新展示披露确认；这一写操作不是纯刷新或重跑 Agent。
  let 绑定附件: P5简历附件 | null = null;
  for (const 区 of 视图.阶段区块) {
    if (区.附件 !== null) {
      绑定附件 = 区.附件;
      break;
    }
  }
  const 开始重试 = () => {
    const 坐标 = 绑定附件;
    if (坐标 === null || 写中 || caseId === '') return; // 无 typed 坐标：零控件（渲染层已挡）
    void 发命令(() => 操作.提交简历(caseId, 坐标.fileId, 坐标.fileVersionId, true));
  };

  /** 单选层的唯一出口：按 键 取回所选行（真实 file/version 只在此映射），进披露确认。 */
  const 确认选择 = () => {
    const 选中文件 = 待选择?.文件们.find((条) => 条.file_id === 选中键) ?? null;
    if (选中文件 === null) return;
    设待选择(null);
    设选中键(null);
    设待披露({ 选择: 从附件行取选择值(选中文件) });
  };

  /** 披露确认的唯一出口：先收层再发，字面 true 只由这一次确认传入；失败要求重新确认。 */
  const 执行披露提交 = (选择: 附件简历选择值) => {
    设待披露(null);
    void 发命令(() => 操作.提交简历(caseId, 选择.fileId, 选择.fileVersionId, true));
  };

  // 终结类确认（不可逆）：正文把后果讲清，确认才发命令
  const 确认结束初筛 = () =>
    设待终结确认({
      标题: '结束本次匿名初筛？',
      正文: '结束后这一单立即终止，无法恢复。',
      执行文: '结束初筛',
      取消文: '暂不结束',
      执行: () => {
        设待终结确认(null);
        void 发命令(() => 操作.决定S0(caseId, 'end'));
      },
    });
  // 婉拒简历邀请 = decisions 路线的 end（wire 无 decline 专臂；e2e J2 同款语义）
  const 确认婉拒邀请 = () =>
    设待终结确认({
      标题: '婉拒这次简历邀请？',
      正文: '婉拒后这一单将结束，不会向该招聘方披露你的简历。',
      执行文: '婉拒邀请',
      取消文: '暂不婉拒',
      执行: () => {
        设待终结确认(null);
        void 发命令(() => 操作.决定S0(caseId, 'end'));
      },
    });
  const 确认不合适 = () =>
    设待终结确认({
      标题: '判定简历不合适？',
      正文: '判定后这一单将结束，无法恢复。',
      执行文: '确认不合适',
      取消文: '再想想',
      执行: () => {
        设待终结确认(null);
        void 发命令(() => 操作.决定S1(caseId, 'not_fit'));
      },
    });

  // 动作卡：只从 视图.actions 的映射交集出卡，标题/说明原样保留。
  // 招聘端结束卡零控件零请求（wire 缺 recruiter decisions 臂，fail closed）；候选端结束
  // 键只保留 end 一条准许路线。S0 respond_fact 不再出卡（映射白名单摘除，Spec §7）。
  // review-r1（Spec §7 停止该卡交互）：旧 S0 needs_user 行白名单已移除 end_screening，
  // 该卡经映射不再可达；下方 end_screening handler 仅为既有接口保留（不清全站旧接口）。
  // S2/S3（Task 8 迁入）：typed 栅栏 —— 当前协同块在场、本端必需且未决才给决定键
  // （issueId 只取当前块）；本端意向词为空才给确认/婉拒键。缺坐标一律零控件零请求。
  const 协同块 = 详情.currentCoordination;
  const 本端协同未决 = 协同块 !== null && 协同块.requiredRoles.includes(role) &&
    (role === 'candidate' ? !协同块.candidateDecided : !协同块.recruiterDecided);
  const 本端意向未决 = 详情.intentConfirmations[role] === '';

  /** 相同区域（协同卡）保留的规则入口（Mock 端同区域走原型 拿不准/记成规则 弹层）：
   *  Backend 暂无 rules mutation —— 在场但不可用，禁用原因就地解释（spec §5）。 */
  const 记成规则入口: 详情按钮 = {
    键: 'decide_coordination_rule',
    文案: '记成规则',
    外观: '次要',
    禁用说明: '暂不支持记成规则',
    执行: null,
  };

  // ── S0–S3 连续筛选（continuity_version 2）的共用坐标与草稿位 ──
  // 目标只来自服务端下发的本人待办：缺待办一律零控件零请求（「Case 停在哪」不是目标）。

  const 是连续版本 = 视图.continuity版本 === 2;
  const 取本人卡待办 = (purpose: P5待办视图['purpose']): P5待办视图 | null =>
    是连续版本 ? 取本人待办(视图.待办们, role, purpose) : null;

  /** 服务端绝对截止时刻 + 到期口径；本地时钟越过它只禁用提交，绝不由前端改变 Case。 */
  const 待办提示 = (待办: P5待办视图): string[] => [
    `请在 ${待办.截止于} 前回应`,
    待办.到期说明,
  ];
  const 已过期 = (待办: P5待办视图): boolean => Date.parse(待办.deadline) <= Date.now();
  const 过期说明 = '这条待办已到期，正在等待最新状态';
  /** 本轮提交是否可点：写中、待办过期各自给出可见解释（不靠变灰冒充说明）。 */
  const 提交禁用说明 = (待办: P5待办视图): string | null =>
    写中 ? 写中说明 : 已过期(待办) ? 过期说明 : null;

  /** 私有说明输入位（C4/C5 固定标签）：只投给本人 Agent，任何响应都不会回显它。 */
  const 说明输入位 = (键: string): 详情输入位 => ({
    键,
    标签: '给我的 AI 一句说明（选填）',
    占位: '例如：更希望每周两天远程',
    值: 说明草稿[键] ?? '',
    多行: false,
    说明: '只发给你自己的 AI，对方看不到；继续也不代表接受差异',
    禁用说明: 写中 ? 写中说明 : null,
    改变: (值) => 设说明草稿((旧) => ({ ...旧, [键]: 值 })),
  });
  const 取说明 = (键: string): string | null => {
    const 文 = (说明草稿[键] ?? '').trim();
    return 文 === '' ? null : 文;
  };
  const 清说明 = (键: string) => 设说明草稿((旧) => ({ ...旧, [键]: '' }));

  /** 结束类二次确认（S0/S1/S2 的 end 都不可恢复，且一律不带私有说明）。 */
  const 确认结束 = (正文: string, 执行: () => void) =>
    设待终结确认({ 标题: '结束这一单？', 正文, 执行文: '结束匹配', 取消文: '暂不结束', 执行 });

  // S2 人工补答的坐标与当前问题：问题只按 exchange_ref 与记录 id 精确相等取，
  // 取不到就只呈现对话流本身（绝不编造问题正文）。
  const S2待办 = 取本人卡待办('s2_answer');
  const S2段 = 视图.阶段区块.find((区) => 区.stage === 'needs_coordination') ?? null;
  const S2问题 = S2待办 === null || S2段 === null
    ? null
    : 取S2待答问题(S2段.Agent消息, S2待办.exchangeRef);
  const S2回答 = 回答草稿.trim();
  const S2回答输入: 详情输入位 = {
    键: 's2_answer',
    标签: '你的回答',
    占位: '写下你的回答',
    值: 回答草稿,
    多行: true,
    说明: '这是本次匹配的正式回答，双方都能看到',
    禁用说明: 写中 ? 写中说明 : 暂无法回答 ? '已勾选「暂时无法回答」，本次不提交正文' : null,
    改变: 设回答草稿,
  };
  const S2勾选: 详情勾选位 = {
    键: 's2_unknown',
    标签: '暂时无法回答',
    选中: 暂无法回答,
    说明: '记录为「暂时无法回答」，不等于同意对方的方案',
    切换: 设暂无法回答,
  };

  // S3：本人待办 + 本屏读到的 summary_version（提交哪一版就是哪一版，绝不自动改投新版）
  const S3待办 = 取本人卡待办('s3_confirm');
  const S3版本 = 视图.确认总结?.version ?? null;
  const S3可提交 = S3待办 !== null && S3版本 !== null;
  const S3冲突提示 = S3冲突版本 === null
    ? []
    : [S3版本 !== null && S3版本 !== S3冲突版本
        ? `你确认的是第 ${S3冲突版本} 版总结，它已更新为第 ${S3版本} 版；请重新阅读后再决定。`
        : '这份总结在你确认时已经变化，请重新阅读后再决定。'];

  const 卡片们: 详情动作卡信息[] = [];
  for (const 卡 of 视图.actions) {
    if (卡.action === 'end_screening') {
      // v2：S0 人工卡 —— 继续（可带只给本人 AI 的说明）或结束匹配，目标必须是本人的
      // s0_continue 待办。v1 旧卡只保留原来的「结束初筛」一条准许路线（招聘端零控件）。
      const S0待办 = 取本人卡待办('s0_continue');
      卡片们.push({
        键: 'end_screening',
        标题: 卡.标题,
        说明: 卡.说明,
        提示们: S0待办 === null ? undefined : 待办提示(S0待办),
        输入们: S0待办 === null ? undefined : [说明输入位('s0')],
        按钮们: 是连续版本
          ? S0待办 === null
            ? [] // 缺待办：零控件零请求（fail closed）
            : [
                {
                  键: 'decide_s0_continue',
                  文案: '继续',
                  外观: '主要',
                  禁用说明: 提交禁用说明(S0待办),
                  执行: 提交禁用说明(S0待办) !== null ? null : () => void 发命令(
                    () => 操作.决定S0(caseId, 'continue', {
                      pendingActionId: S0待办.id, privateNote: 取说明('s0'),
                    }),
                    { 成功: () => 清说明('s0') },
                  ),
                },
                {
                  键: 'decide_s0_end',
                  文案: '结束匹配',
                  外观: '次要',
                  禁用说明: 提交禁用说明(S0待办),
                  执行: 提交禁用说明(S0待办) !== null ? null : () => 确认结束(
                    '结束后这一单立即终止，无法恢复。',
                    () => {
                      设待终结确认(null);
                      // end 一律不带私有说明（合同：说明只能随 continue）
                      void 发命令(() => 操作.决定S0(caseId, 'end', {
                        pendingActionId: S0待办.id, privateNote: null,
                      }));
                    },
                  ),
                },
              ]
          : role === 'candidate'
            ? [
                {
                  键: 'end_screening',
                  文案: '结束初筛',
                  外观: '次要',
                  禁用说明: 写中 ? 写中说明 : null,
                  执行: 写中 ? null : 确认结束初筛,
                },
              ]
            : [],
      });
    } else if (卡.action === 'accept_resume_invitation' || 卡.action === 'replace_resume') {
      卡片们.push({
        键: 卡.action,
        标题: 卡.标题,
        说明: 卡.说明,
        按钮们: [
          {
            键: 卡.action,
            文案: 卡.action === 'accept_resume_invitation' ? '接受邀请' : '更换简历',
            外观: '主要',
            禁用说明: 写中 ? 写中说明 : null,
            执行: 写中 ? null : () => void 开始选择(),
          },
        ],
      });
    } else if (卡.action === 'decline_resume_invitation') {
      卡片们.push({
        键: 卡.action,
        标题: 卡.标题,
        说明: 卡.说明,
        按钮们: [
          {
            键: 卡.action,
            文案: '婉拒邀请',
            外观: '次要',
            禁用说明: 写中 ? 写中说明 : null,
            执行: 写中 ? null : 确认婉拒邀请,
          },
        ],
      });
    } else if (卡.action === 'retry_resume_readiness') {
      卡片们.push({
        键: 卡.action,
        标题: 卡.标题,
        说明: 卡.说明,
        // 无 typed 附件坐标：卡框架仍在（映射交集），零控件零请求（fail closed）
        按钮们: 绑定附件 === null
          ? []
          : [
              {
                键: 卡.action,
                文案: '重试校验',
                外观: '主要',
                禁用说明: 写中 ? 写中说明 : null,
                执行: 写中 ? null : 开始重试,
              },
            ],
      });
    } else if (卡.action === 'decide_resume_screening') {
      // v2：S1 人工卡只有 continue / end 两个词（not_fit 只属历史 Case，v2 不发）。
      const S1待办 = 取本人卡待办('s1_continue');
      卡片们.push({
        键: 卡.action,
        标题: 卡.标题,
        说明: 卡.说明,
        提示们: S1待办 === null ? undefined : 待办提示(S1待办),
        输入们: S1待办 === null ? undefined : [说明输入位('s1')],
        按钮们: 是连续版本
          ? S1待办 === null
            ? []
            : [
                {
                  键: 'decide_resume_screening_continue',
                  文案: '继续',
                  外观: '主要',
                  禁用说明: 提交禁用说明(S1待办),
                  执行: 提交禁用说明(S1待办) !== null ? null : () => void 发命令(
                    () => 操作.决定S1(caseId, 'continue', {
                      pendingActionId: S1待办.id, privateNote: 取说明('s1'),
                    }),
                    { 成功: () => 清说明('s1') },
                  ),
                },
                {
                  键: 'decide_resume_screening_end',
                  文案: '结束匹配',
                  外观: '次要',
                  禁用说明: 提交禁用说明(S1待办),
                  执行: 提交禁用说明(S1待办) !== null ? null : () => 确认结束(
                    '结束后这一单将终止；七天内你还可以重新考虑。',
                    () => {
                      设待终结确认(null);
                      void 发命令(() => 操作.决定S1(caseId, 'end', {
                        pendingActionId: S1待办.id, privateNote: null,
                      }));
                    },
                  ),
                },
              ]
          : [
              {
                键: 'decide_resume_screening_continue',
                文案: '通过初筛',
                外观: '主要',
                禁用说明: 写中 ? 写中说明 : null,
                执行: 写中 ? null : () => void 发命令(() => 操作.决定S1(caseId, 'continue')),
              },
              {
                键: 'decide_resume_screening_not_fit',
                文案: '不合适',
                外观: '次要',
                禁用说明: 写中 ? 写中说明 : null,
                执行: 写中 ? null : 确认不合适,
              },
            ],
      });
    } else if (卡.action === 'decide_coordination') {
      卡片们.push({
        键: 卡.action,
        标题: 卡.标题,
        说明: 卡.说明,
        // issueId 只取当前 typed 协同块（服务端权威重读换代即换坐标）；无本端准许
        // 路线（非必需/已决/缺协同块）→ 零决定键，连规则入口也不提前挂。
        按钮们: 本端协同未决 && 协同块 !== null
          ? [
              {
                键: 'decide_coordination_accept',
                文案: '接受',
                外观: '主要',
                禁用说明: 写中 ? 写中说明 : null,
                执行: 写中 ? null
                  : () => void 发命令(() => 操作.决定S2(role, caseId, 协同块.issueId, 'accept')),
              },
              {
                键: 'decide_coordination_reject',
                文案: '拒绝',
                外观: '次要',
                禁用说明: 写中 ? 写中说明 : null,
                执行: 写中 ? null
                  : () => void 发命令(() => 操作.决定S2(role, caseId, 协同块.issueId, 'reject')),
              },
              记成规则入口,
            ]
          : [],
      });
    } else if (卡.action === 'confirm_intent' || 卡.action === 'decline_intent') {
      // v2：确认/婉拒都必须带本人 s3_confirm 待办与本屏读到的 summary_version；
      // 遇到 summary_version_conflict 只提示总结已变化并重读，绝不自动确认新版本。
      const 是确认 = 卡.action === 'confirm_intent';
      const v2可点 = 本端意向未决 && S3可提交 && S3待办 !== null && 提交禁用说明(S3待办) === null;
      卡片们.push({
        键: 卡.action,
        标题: 卡.标题,
        说明: 卡.说明,
        提示们: 是连续版本
          ? [
              ...(视图.确认总结 === null ? [] : [视图.确认总结.含义说明]),
              ...(S3待办 === null ? [] : 待办提示(S3待办)),
              ...S3冲突提示,
            ]
          : undefined,
        按钮们: 是连续版本
          ? 本端意向未决 && S3待办 !== null && S3版本 !== null
            ? [
                {
                  键: 卡.action,
                  文案: 是确认 ? '确认意向' : '婉拒意向',
                  外观: 是确认 ? '主要' : '次要',
                  禁用说明: 提交禁用说明(S3待办),
                  执行: !v2可点 ? null : () => void 发命令(
                    () => 操作.决定S3(role, caseId, 是确认 ? 'confirm' : 'decline', {
                      pendingActionId: S3待办.id, summaryVersion: S3版本,
                    }),
                    {
                      成功: () => 设S3冲突版本(null),
                      失败: (错误) => {
                        if (错误 instanceof BFF错误 && 错误.code === 'summary_version_conflict') {
                          设S3冲突版本(S3版本);
                        }
                      },
                    },
                  ),
                },
              ]
            : []
          : 本端意向未决
            ? [
                {
                  键: 卡.action,
                  文案: 是确认 ? '确认意向' : '婉拒意向',
                  外观: 是确认 ? '主要' : '次要',
                  禁用说明: 写中 ? 写中说明 : null,
                  执行: 写中 ? null : () => void 发命令(
                    () => 操作.决定S3(role, caseId, 是确认 ? 'confirm' : 'decline')),
                },
              ]
            : [],
      });
    } else if (卡.action === 'answer_dialogue') {
      // S2 人工补答（v2 专属）：两个主要动作「提交回答」「结束匹配」，「暂时无法回答」
      // 是前者上的勾选（→ status=unknown）；刻意没有「接受方案」按钮。
      const 可提交 = S2待办 !== null && 提交禁用说明(S2待办) === null
        && (暂无法回答 || S2回答 !== '');
      卡片们.push({
        键: 卡.action,
        标题: 卡.标题,
        说明: 卡.说明,
        提示们: S2待办 === null ? undefined : [
          ...(S2问题 === null ? [] : [`对方的问题：${S2问题.内容}`]),
          ...(视图.对话进度 === null ? [] : [视图.对话进度.轮次说明]),
          ...待办提示(S2待办),
        ],
        输入们: S2待办 === null ? undefined : [S2回答输入],
        勾选们: S2待办 === null ? undefined : [S2勾选],
        按钮们: S2待办 === null
          ? []
          : [
              {
                键: 'answer_dialogue_submit',
                文案: '提交回答',
                外观: '主要',
                禁用说明: 提交禁用说明(S2待办)
                  ?? (暂无法回答 || S2回答 !== '' ? null : '请先写下回答，或勾选「暂时无法回答」'),
                执行: !可提交 ? null : () => void 发命令(
                  () => 操作.回答对话(role, caseId, 暂无法回答
                    ? { pendingActionId: S2待办.id, action: 'answer', status: 'unknown' }
                    : { pendingActionId: S2待办.id, action: 'answer', status: 'answered', answer: S2回答 }),
                  {
                    成功: () => {
                      设回答草稿('');
                      设暂无法回答(false);
                    },
                  },
                ),
              },
              {
                键: 'answer_dialogue_end',
                文案: '结束匹配',
                外观: '次要',
                禁用说明: 提交禁用说明(S2待办),
                执行: 提交禁用说明(S2待办) !== null ? null : () => 确认结束(
                  '结束后这一单立即终止，无法恢复。',
                  () => {
                    设待终结确认(null);
                    void 发命令(() => 操作.回答对话(role, caseId, {
                      pendingActionId: S2待办.id, action: 'end',
                    }));
                  },
                ),
              },
            ],
      });
    } else if (卡.action === 'reconsider') {
      // S1 七天重新考虑（v2，仅招聘端）：不带待办，只有 continue 一个词；确认后才发。
      卡片们.push({
        键: 卡.action,
        标题: 卡.标题,
        说明: 卡.说明,
        提示们: 视图.重新考虑 === null ? undefined : [视图.重新考虑.说明],
        输入们: [说明输入位('reconsider')],
        按钮们: [
          {
            键: 'reconsider',
            文案: '重新考虑',
            外观: '主要',
            禁用说明: 写中 ? 写中说明 : null,
            执行: 写中 ? null : () => 设待终结确认({
              标题: '重新考虑这一单？',
              正文: '这会继续同一单：不重新投递简历，也不重跑匿名初筛；你填的说明只发给你自己的 AI。',
              执行文: '重新考虑',
              取消文: '暂不恢复',
              执行: () => {
                设待终结确认(null);
                void 发命令(
                  () => 操作.重新考虑(caseId, 取说明('reconsider')),
                  { 成功: () => 清说明('reconsider') },
                );
              },
            }),
          },
        ],
      });
    }
  }

  // S1 多份附件的单选层：视图只接文件名/状态文/禁用原因；键→真实文件版本映射留在本层
  const 简历选择: 简历选择属性 | null = 待选择 === null
    ? null
    : {
        职位名: 视图.职位.职位名,
        文件们: 待选择.文件们.map((条) => ({
          键: 条.file_id,
          文件名: 条.display_name,
          状态文: 附件状态文案(条),
          禁用说明: null, // 旧语义：所有行可选（校验归服务端，解析失败走重试卡），不前端禁选
        })),
        选中键,
        选择: 设选中键,
        取消: () => {
          设待选择(null);
          设选中键(null);
        },
        确认: {
          键: '选定这份',
          文案: '选定这份',
          外观: '主要',
          禁用说明: null,
          执行: 选中键 === null ? null : 确认选择,
        },
      };

  // Case 专属披露确认：正文点名冻结职位（Case 上下文，无别名）与这次递交哪份 PDF，
  // 说清递交即披露；仅对这一次递交生效。确认/取消都即刻清层 —— 上一次的授权绝不复用。
  const 披露确认: 确认属性 | null = 待披露 === null
    ? null
    : {
        标题: '确认递交这份简历？',
        正文: `本次将向「${视图.职位.职位名}」这一 Case 递交「${待披露.选择.displayName}」，递交后本份简历与你的姓名、联系方式即向该招聘方披露。授权仅对这一次递交生效。`,
        执行文: '确认递交',
        取消文: '暂不递交',
        取消: () => 设待披露(null),
        执行: () => 执行披露提交(待披露.选择),
      };

  // 终结类确认（结束初筛/婉拒邀请/判不合适）：逐字段透传给 确认层
  const 终结确认: 确认属性 | null = 待终结确认 === null
    ? null
    : { ...待终结确认, 取消: () => 设待终结确认(null) };

  return {
    卡片们,
    简历选择,
    披露确认,
    终结确认,
  };
}
