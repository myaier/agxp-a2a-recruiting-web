// use后端详情控制 —— Backend 详情路由的读取控制 hook（契约 C，Task 9 自
// 屏幕/P5/MatchCase详情 的路由实例原样搬入：scope 登记/退出、直达强制读、3 秒可见
// 节拍、Case 叮嘱与展示映射；命令参数与生命周期逐项对照旧实现）。
// J-PILOT-01 Task 5：候选分支只读 continuous detail（读取连续详情）—— pre-Case/retention
// 封闭交 后端连续资源（不构造假 P5 详情），Case 分支把聚合 case_detail 交既有 后端正常资源；
// 招聘分支维持 读取详情 的 Case 口径不变。
// J-PILOT-01 Task 6（Spec §7）：底栏按真实当前阶段判定 —— S0（双端）保留原输入框与
// 发送键但禁用（占位随阶段/终局成对产出，发送 null 零叮嘱请求），即使展开历史 S0 也按
// 当前阶段；S1 起恢复既有非 S0 叮嘱输入，终局（非 S0）维持只读条。
//
// 生命周期（plan 固定）：本 hook 由主体会话范围的 route 实例（MatchCase详情）始终挂载，
// 不调用 use后端详情动作 或 useCasePDF预览（那两个归正常控制子组件 后端正常详情 按
// role/case key 重挂载时无条件调用）。主体/会话换代由整个父实例重置回收。
// 全部 hooks 无条件调用，绝不条件挂 hook。
//
// 返回明确联合（不把错误变成正常缺失）：
//   · {kind:'不可用'; 状态:'加载'|'失败'|'契约错误'; 说明; 重试} —— 路由只按 kind 渲染
//     错误/加载页，不进共用外壳、不调顶栏 mapper；
//   · 后端正常资源 —— 顶栏/状态/分段/资料/底栏/终局的纯展示 props + 动作/PDF 输入 +
//     刷新错误与重试，只供 后端正常详情 消费，不放展示目录；
//   · 后端连续资源 —— pre-Case/retention 封闭的纯展示 props + 失败动作卡/归档确认，
//     只供 后端详情渲染 的连续分支消费（Spec §6/§8）。
//
// 模式边界（spec §10.3 与 P5 冻结契约）：读取恒 force=true（非 force 在成功快照上
// 短路会吞掉 3 秒节拍与直达刷新）；详情只凭 URL 坐标 + 已认证角色，不读列表快照。
// 叮嘱等服务器回话，绝不造乐观气泡，仅成功后清空输入；终局（ended/completed）底栏
// 只读「当前在谈已结束，仅可查看」，停 3 秒节拍；completed+pending 继续权威重读
// （不加前端超时终态）。会话/角色栅栏：已登录且 last_used_role 匹配才开节拍。
//
// J-PILOT-01 轮询停表口径（Spec §6）：候选 pre-Case accepted/evaluating 继续观察；
// pre-Case 已失败/refused/retention 封闭无自动推进即停；Case 沿旧 ended 或已发布会话
// 停止口径，completed+handoff pending 继续，不以 shelf=history 一概停表。

import { useEffect, useRef, useState, type RefObject } from 'react';
import { 轻提示 } from '../../组件/轻提示';
import { 取后端错误文案 } from '../../数据/HTTP客户端';
import {
  从P5到详情分段,
  从P5到详情顶栏,
  从P5到详情状态,
  从P5到职位资料,
} from '../../数据/详情展示映射';
import {
  从连续到详情分段,
  从连续到详情顶栏,
  从连续到详情状态,
  从连续到职位资料,
  映射公开初评,
  映射连续失败动作,
  映射连续底栏,
} from '../../数据/连续代谈展示映射';
import type { 公开初评托盘视图 } from '../../数据/连续代谈展示映射';
import { 映射P5详情, 映射S0底栏说明, P5契约错误提示 } from '../../数据/MatchCase展示映射';
import type { P5角色 } from '../../数据/MatchCase展示映射';
import type { 分段项 } from '../../组件/阶段对话流';
import { 从BFF到在线简历展示 } from '../../数据/在线简历展示映射';
import type { 在线简历展示资料 } from '../../组件/在谈详情/类型';
import type {
  详情动作卡信息,
  详情底栏信息,
  详情按钮,
  确认属性,
  终局区信息,
  顶栏信息,
  状态区信息,
  职位资料信息,
} from '../../组件/在谈详情/类型';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import type { P5连续详情快照 } from '../../状态/后端/类型';
import { useMatchCase轮询 } from '../../状态/后端/useMatchCase轮询';
import { use应用状态 } from '../../状态/应用状态';
import { use导航 } from '../../路由/导航钩子';
import { 路径 } from '../../路由/路径表';
import { use后端详情动作 } from './use后端详情动作';
import { useCasePDF预览 } from './useCasePDF预览';

const 叮嘱占位 = '有想法就告诉你的AI代理';
const 读入中文案 = '正在读入这一单…';
const 叮嘱失败提示 = '叮嘱没有发出去，请重试';
/** spec §5 must-protect：终局保留底部区域，只读说明的约定文案（双端同款）。 */
export const 终局只读说明 = '当前在谈已结束，仅可查看';
/** completed+pending 的「开始私聊」在场但恒禁用（准备中），禁用说明就地解释。 */
const 移交准备中说明 = '准备中';
/** 连续写中说明（与 use后端详情动作 的写中文案同句）：retry/archive 在飞期间就地解释。 */
const 连续写中说明 = '正在提交，请稍候';

/** 契约 C：正常联合的资源形状（控制模块内部类型，只供 后端正常详情 消费）。 */
export interface 后端正常资源 {
  kind: '正常';
  /** canonical record_id（candidate 聚合返回）；recruiter 恒 null（Case ID 不归一替换）。 */
  canonical记录ID: string | null;
  /** 公开信息初评托盘（candidate 聚合 agent_summary.public_evaluation；来源与 S0 独立）。 */
  公开初评: 公开初评托盘视图 | null;
  顶栏: 顶栏信息;
  状态: 状态区信息;
  分段们: 分段项[];
  职位资料: 职位资料信息;
  /** Task 6：招聘角色把 Case 冻结 candidate_resume 映射成共享正文资料；候选角色恒 null
   *  （不构造该资料，第二 Tab 走 职位资料）。身份（identity）不进这条映射 —— 去名不受
   *  S1 披露状态影响。 */
  在线简历资料: 在线简历展示资料 | null;
  底栏: 详情底栏信息;
  终局: 终局区信息;
  刷新错误: string | null;
  重试: () => void;
  当前段引用: RefObject<HTMLDivElement | null>;
  动作输入: Parameters<typeof use后端详情动作>[0];
  PDF输入: Parameters<typeof useCasePDF预览>[0];
}

/** 契约 C：连续联合（pre-Case / retention 封闭）—— 只供 后端详情渲染 的连续分支消费。 */
export interface 后端连续资源 {
  kind: '连续';
  /** canonical record_id：URL 别名归一替换地址的唯一依据（Spec §4）。 */
  canonical记录ID: string;
  顶栏: 顶栏信息;
  状态: 状态区信息;
  /** 公开信息初评托盘（与 Case 分支同槽；retention 只显示公开残留状态）。 */
  公开初评: 公开初评托盘视图 | null;
  /** 四阶段均未到达的展示分段（不提交为业务 state，Spec §6）。 */
  分段们: 分段项[];
  职位资料: 职位资料信息;
  /** 失败初评的恢复动作卡（重试/归档仅权威允许时在场；Spec §8）。 */
  失败动作卡: 详情动作卡信息 | null;
  /** 归档二次确认（现有确认层；「移入历史，不是取消」）。 */
  归档确认: 确认属性 | null;
  底栏: 详情底栏信息;
  刷新错误: string | null;
  重试: () => void;
}

/** 不可用联合：错误路径（契约错误/首载失败/读入中）只给说明与重试，无正常字段。 */
export interface 后端详情不可用 {
  kind: '不可用';
  状态: '加载' | '失败' | '契约错误';
  说明: string;
  重试: (() => void) | null;
}

export type 后端详情控制结果 = 后端正常资源 | 后端连续资源 | 后端详情不可用;

/**
 * 候选聚合快照解析（Spec §4）：状态层只按返回 canonical record_id 落位（alias 键槽
 * 绝不残留），本层按 URL 坐标直查连续槽；未命中再按返回 case_id 找 canonical 槽 ——
 * 旧 Case 深链（mc_ 别名）经聚合 GET 归一后，canonical 记录携带该 case_id。属主不匹配
 * 的快照一律不可用（同主体内存对照的隐私栅栏，绝不把旧账号内容当本页资源）。
 */
function 取候选连续快照(
  表: Record<string, P5连续详情快照> | undefined,
  caseId: string,
  主体ID: string | null,
): P5连续详情快照 | undefined {
  if (表 === undefined || 主体ID === null) return undefined;
  const 直接 = 表[P5范围键.negotiation(caseId)];
  if (直接 !== undefined && 直接.ownerSubjectId === 主体ID) return 直接;
  for (const 快照 of Object.values(表)) {
    if (快照.ownerSubjectId !== 主体ID) continue;
    if (快照.detail?.case_id === caseId) return 快照;
  }
  return undefined;
}

export function use后端详情控制({ role, caseId }: { role: P5角色; caseId: string }): 后端详情控制结果 {
  const { 数据源模式, 后端状态, 操作 } = use应用状态();
  const { 跳转 } = use导航();
  const 是后端 = 数据源模式 === 'backend';
  const 主体ID = 后端状态.主体?.subject_id ?? null;

  // J-PILOT-01 Task 5：候选页注册 negotiation scope（聚合读的可见范围栅栏）；招聘仍 detail scope。
  const scope键 = role === 'candidate'
    ? P5范围键.negotiation(caseId)
    : P5范围键.detail(role, caseId);

  // 进屏 / 换单：先注册可见范围再强制权威读；离开本屏或换单清回 null。Mock 模式本
  // hook 不挂载，操作层也恒早退。候选只走聚合读（读取连续详情），招聘继续 读取详情。
  useEffect(() => {
    if (!是后端 || caseId === '') return;
    操作.设置P5范围(role, scope键);
    const 读 = role === 'candidate'
      ? 操作.读取连续详情(caseId, true)
      : 操作.读取详情(role, caseId, true);
    void 读.catch(() => undefined);
    return () => 操作.设置P5范围(role, null);
  }, [是后端, role, caseId, scope键, 操作]);

  // ── 视图解析（纯计算，先于所有按资源收口的段）──
  // 候选：聚合快照（canonical 落位）→ case_detail 走既有 P5 映射；pre-Case/retention
  // （case_detail=null）交连续联合。招聘：P5详情 槽原口径。
  const 连续快照 = role === 'candidate'
    ? 取候选连续快照(后端状态.P5连续详情, caseId, 主体ID)
    : undefined;
  const 聚合 = 连续快照?.detail ?? null;
  const 快照 = role === 'candidate' ? 连续快照 : 后端状态.P5详情?.[scope键];
  const 原文 = role === 'candidate'
    ? 聚合?.case_detail ?? null
    : 后端状态.P5详情?.[scope键]?.detail ?? null;
  const 视图 = 原文 !== null ? 映射P5详情(原文) : null;
  const 正常 = 视图 !== null && 视图.kind === '正常' ? 视图 : null;
  // Case 动作/PDF 的真实坐标：候选用聚合 case_detail 的 case_id（case_id 只用于真实
  // Case 动作/PDF），招聘仍是 URL case_id。
  const 命令caseId = role === 'candidate' ? 正常?.caseId ?? caseId : caseId;

  // Case 叮嘱：等服务器回话再清输入（仅成功清空），绝不造乐观气泡 —— 展示永远以
  // 下一次权威 detail 重读为准（操作层在成功后已重读并刷新已载 scope）。在飞锁
  // （发送中 ref）归本控制层，不靠 disabled DOM。
  const [叮嘱草稿, 设叮嘱草稿] = useState('');
  const 发送中 = useRef(false);
  // 叮嘱代际（review-r1 F4，spec §3.1「切换 Case 或角色后重置」+ §5 迟到结果丢弃）：
  // 本 hook 常驻路由实例，scope（角色/单/主体）换代或卸载都递增；换代即清草稿并放
  // 在飞锁（锁归新 scope 干净起步），旧单迟到的清空/收口对不上代际整包作废。
  const 叮嘱代际 = useRef(0);
  // 连续写中代际（J-PILOT-01 Task 5）：retry/archive 的在飞锁与归档确认弹层同此口径 ——
  // 换 scope 即清（旧单迟到的 finally 不卡新单按钮、不复活已卸载 scope 的弹层）。
  const 连续写代际 = useRef(0);
  const [连续写中, 设连续写中] = useState(false);
  const [待归档确认, 设待归档确认] = useState(false);
  useEffect(() => () => {
    叮嘱代际.current += 1;
    连续写代际.current += 1; // 卸载后迟到的 retry/archive catch 也不弹轻提示
  }, []);
  useEffect(() => {
    叮嘱代际.current += 1;
    连续写代际.current += 1;
    发送中.current = false;
    设叮嘱草稿('');
    设连续写中(false);
    设待归档确认(false);
  }, [role, caseId, 主体ID]);
  const 发叮嘱 = () => {
    const 内容 = 叮嘱草稿.trim();
    if (内容 === '' || caseId === '' || 发送中.current) return;
    const 本轮 = 叮嘱代际.current;
    发送中.current = true;
    操作.新增叮嘱(role, 命令caseId, 内容)
      .then(() => {
        if (叮嘱代际.current === 本轮) 设叮嘱草稿('');
      })
      .catch(() => {
        if (叮嘱代际.current === 本轮) 轻提示(叮嘱失败提示);
      })
      .finally(() => {
        if (叮嘱代际.current === 本轮) 发送中.current = false;
      });
  };
  /** 连续恢复动作（retry/archive）的统一发口：失败轻提示真实错误文案，落定过代际栅栏才收锁。 */
  const 执行连续写 = (承诺: Promise<void>) => {
    const 本轮 = 连续写代际.current;
    设连续写中(true);
    承诺
      .catch((错误) => {
        if (连续写代际.current === 本轮) 轻提示(取后端错误文案(错误));
      })
      .finally(() => {
        if (连续写代际.current === 本轮) 设连续写中(false);
      });
  };

  // 当前阶段段的定位引用（子组件渲染 阶段对话流 时挂到「当前」段并自动滚过去）
  const 当前段引用 = useRef<HTMLDivElement>(null);

  const 重读 = () => {
    const 读 = role === 'candidate'
      ? 操作.读取连续详情(caseId, true)
      : 操作.读取详情(role, caseId, true);
    void 读.catch(() => undefined);
  };

  // 视图与终局判定（非 hook，先算给节拍栅栏用）：
  // 正常视图只能来自快照里已 decode 的详情（detail 为空不映射）。
  // 详情轮询停止口径：候选 pre-Case 沿 phase（accepted/evaluating 继续观察，已失败/
  // refused/retention 封闭停），Case 沿旧 ended 或已发布会话停止口径；pending（含
  // same-party 长期 pending）保持 3 秒权威重读，绝不加前端超时终态。
  const P5详情终局 = 正常 !== null && 正常.详情终局;
  const 详情终局 = role === 'candidate'
    ? 聚合 !== null && (
      聚合.case_detail === null
        ? 聚合.phase !== 'accepted' && 聚合.phase !== 'evaluating'
        : P5详情终局
    )
    : P5详情终局;

  // 可见 3 秒详情节拍（spec §10.3）：Backend + 会话/角色有效 + 详情在场 + 非终局；
  // 终局即停。每拍都走权威重读（成功快照不得短路节拍）。
  const 会话有效 = 后端状态.已登录 === true && 后端状态.主体?.last_used_role === role;
  useMatchCase轮询({
    开启: 是后端 && caseId !== '' && 会话有效 && !详情终局,
    列表: null,
    详情: { role, caseId },
    详情终局,
    刷新列表: async () => undefined,
    刷新详情: (范围) => 范围.role === 'candidate'
      ? 操作.读取连续详情(范围.caseId, true)
      : 操作.读取详情(范围.role, 范围.caseId, true),
  });

  // ── 所有 hook 之后才收窄联合：错误路径（契约错误 / 首载失败 / 读入中）只给说明与
  //    重试，不进正常资源，更不给虚假详情。──
  if (视图 !== null && 视图.kind === '契约错误') {
    return { kind: '不可用', 状态: '契约错误', 说明: P5契约错误提示, 重试: 重读 };
  }
  if (正常 === null || 原文 === null) {
    // 候选聚合在场（GET 已成功至少一次）而 case_detail 缺席：pre-Case 或 retention 封闭
    // （Spec §6）—— 走连续联合，绝不为 pre-Case 构造假 P5 详情。
    if (role === 'candidate' && 聚合 !== null) {
      const 失败动作 = 映射连续失败动作(聚合);
      return {
        kind: '连续',
        canonical记录ID: 聚合.record_id,
        顶栏: 从连续到详情顶栏(聚合),
        状态: 从连续到详情状态(聚合),
        公开初评: 映射公开初评(聚合),
        分段们: 从连续到详情分段(),
        职位资料: 从连续到职位资料(聚合),
        失败动作卡: 失败动作 === null ? null : {
          键: 失败动作.卡.键,
          标题: 失败动作.卡.标题,
          说明: 失败动作.卡.说明,
          按钮们: ([
            失败动作.重试文案 !== null
              ? {
                键: '重试',
                文案: 失败动作.重试文案,
                外观: '主要' as const,
                禁用说明: 连续写中 ? 连续写中说明 : null,
                执行: 连续写中 ? null : () => 执行连续写(操作.重试连续记录(聚合.record_id)),
              }
              : null,
            失败动作.归档文案 !== null
              ? {
                键: '归档',
                文案: 失败动作.归档文案,
                外观: '次要' as const,
                禁用说明: 连续写中 ? 连续写中说明 : null,
                执行: 连续写中 ? null : () => 设待归档确认(true),
              }
              : null,
          ] as (详情按钮 | null)[]).filter((键): 键 is 详情按钮 => 键 !== null),
        },
        归档确认: 失败动作 !== null && 待归档确认
          ? {
            标题: 失败动作.归档确认.标题,
            正文: 失败动作.归档确认.正文,
            执行文: 失败动作.归档确认.执行文,
            取消文: 失败动作.归档确认.取消文,
            执行: () => {
              设待归档确认(false);
              执行连续写(操作.归档连续记录(聚合.record_id));
            },
            取消: () => 设待归档确认(false),
          }
          : null,
        底栏: 映射连续底栏(聚合),
        刷新错误: 快照?.error && !快照.刷新中 ? 快照.error : null,
        重试: 重读,
      };
    }
    if (快照 !== undefined && 快照.阶段 === '失败' && 快照.detail === null) {
      return {
        kind: '不可用', 状态: '失败',
        说明: 快照.error ?? '这一单暂时打不开', 重试: 重读,
      };
    }
    return { kind: '不可用', 状态: '加载', 说明: 读入中文案, 重试: null };
  }

  // 终局摘要与移交（completed 两步）：wire 原词原样，导航坐标只来自权威
  // conversation_ref —— 不生成、不缓存、不推断。
  const 移交 = 正常.handoff;
  const 终局: 终局区信息 = {
    摘要: 正常.终局摘要 !== null ? { ...正常.终局摘要 } : null,
    移交: 移交 === null ? null : {
      说明: 移交.copy,
      开始私聊: 移交.state === 'ready'
        ? {
            键: '开始私聊', 文案: '开始私聊', 外观: '主要', 禁用说明: null,
            执行: () => 跳转(role === 'candidate'
              ? 路径.真人会话路径(移交.conversationId)
              : 路径.企业真人会话路径(移交.conversationId)),
          }
        : { 键: '开始私聊', 文案: '开始私聊', 外观: '主要', 禁用说明: 移交准备中说明, 执行: null },
    },
  };

  // 底部 Case 叮嘱（J-PILOT-01 Task 6，Spec §7）：S0（双端，即使展开历史 S0 也按当前
  // 阶段判定）保留原输入框与发送键但禁用 —— 占位=禁用说明成对产出（映射S0底栏说明），
  // 发送 null 零叮嘱请求、值恒空（清 S0 旧草稿）；非 S0 终局只读（spec §5），S1 起进行中
  // 可输入（非终局的禁用由已有刷新/动作保护表达，不在底栏加锁）。
  const S0禁用说明 = 映射S0底栏说明(原文.state);
  const 底栏: 详情底栏信息 = S0禁用说明 !== null
    ? { kind: '输入', 占位: S0禁用说明, 值: '', 改变: () => undefined, 发送: null, 禁用说明: S0禁用说明 }
    : 正常.终局
      ? { kind: '只读', 说明: 终局只读说明 }
      : { kind: '输入', 占位: 叮嘱占位, 值: 叮嘱草稿, 改变: 设叮嘱草稿, 发送: 发叮嘱, 禁用说明: null };

  return {
    kind: '正常',
    canonical记录ID: role === 'candidate' ? 聚合?.record_id ?? null : null,
    公开初评: role === 'candidate' && 聚合 !== null ? 映射公开初评(聚合) : null,
    顶栏: 从P5到详情顶栏(正常),
    状态: 从P5到详情状态(正常),
    分段们: 从P5到详情分段(正常, 原文.state.stage),
    职位资料: 从P5到职位资料(正常),
    // 招聘角色吃 Case 冻结 candidate_resume（缺源档给 null）；候选不构造，正文走 职位资料
    在线简历资料: 原文.role === 'recruiter' ? 从BFF到在线简历展示(原文.candidateResume) : null,
    底栏,
    终局,
    // 刷新/轮询失败：旧详情原样保留只读，错误单独一行交代 + 重试（§10.3）
    刷新错误: 快照?.error && !快照.刷新中 ? 快照.error : null,
    重试: 重读,
    当前段引用,
    动作输入: { role, caseId: 命令caseId, 视图: 正常, 详情: 原文, 操作 },
    PDF输入: { role, caseId: 命令caseId, 读取: 操作.读取简历PDF },
  };
}
