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
import { 取后端错误文案 } from '../../数据/HTTP客户端';
import { 从附件行取选择值, type 附件简历选择值 } from '../../组件/附件简历选择层';
import { 附件状态文案 } from '../../流程/附件简历交互';
import type { 详情动作卡信息, 详情按钮, 简历选择属性, 确认属性 } from '../../组件/在谈详情/类型';
import type { P5详情正常视图, P5角色 } from '../../数据/MatchCase展示映射';
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
    '决定S0' | '决定S1' | '决定S2' | '决定S3' | '提交简历' | '准备候选委托简历'
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
  }, [caseId]);

  const 报错 = (错误: unknown) => 轻提示(取后端错误文案(错误));

  /** 写中（spec §5「正在提交…保留该动作位置并禁用解释」）统一禁用说明：写中期间
   * 每个被锁按钮就地给出可见/可访问解释，落定后恢复 null。 */
  const 写中说明 = '正在提交，请稍候';

  /** 命令包装：服务端先行，失败原地提示；权威重读归操作层（本 hook 绝不本地重建）。
   *  迟到栅栏（review-r1 F5，spec §5）：catch/finally 只在本轮代际上收口 —— 换单/卸载
   *  后迟到的失败提示与写中解锁对不上代际即整包作废，绝不落在新单的页面上。 */
  const 发命令 = async (运行: () => Promise<void>) => {
    if (写中 || caseId === '') return;
    const 本轮 = 代际.current;
    设写中(true);
    try {
      await 运行();
    } catch (错误) {
      if (代际.current === 本轮) 报错(错误);
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

  const 卡片们: 详情动作卡信息[] = [];
  for (const 卡 of 视图.actions) {
    if (卡.action === 'end_screening') {
      卡片们.push({
        键: 'end_screening',
        标题: 卡.标题,
        说明: 卡.说明,
        按钮们: role === 'candidate'
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
      卡片们.push({
        键: 卡.action,
        标题: 卡.标题,
        说明: 卡.说明,
        按钮们: [
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
    } else if (卡.action === 'confirm_intent') {
      卡片们.push({
        键: 卡.action,
        标题: 卡.标题,
        说明: 卡.说明,
        按钮们: 本端意向未决
          ? [
              {
                键: 'confirm_intent',
                文案: '确认意向',
                外观: '主要',
                禁用说明: 写中 ? 写中说明 : null,
                执行: 写中 ? null : () => void 发命令(() => 操作.决定S3(role, caseId, 'confirm')),
              },
            ]
          : [],
      });
    } else if (卡.action === 'decline_intent') {
      卡片们.push({
        键: 卡.action,
        标题: 卡.标题,
        说明: 卡.说明,
        按钮们: 本端意向未决
          ? [
              {
                键: 'decline_intent',
                文案: '婉拒意向',
                外观: '次要',
                禁用说明: 写中 ? 写中说明 : null,
                执行: 写中 ? null : () => void 发命令(() => 操作.决定S3(role, caseId, 'decline')),
              },
            ]
          : [],
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
