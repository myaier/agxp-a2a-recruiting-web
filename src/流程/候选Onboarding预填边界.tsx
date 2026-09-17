// 候选 onboarding 简历预填的路由恢复边界（设计 §9 / Task 7）。
//
// 只包装可能消费 suggestion 的 onboarding 页面（六个资料页）：
// Task 3 起向导不再是消费位 —— 个人优势题（summary 建议的唯一消费者）已迁到简历资料页。
// 刷新后内存轮丢失、session 恢复元数据仍指向当前附件 exact tuple 时，先按 exact
// tuple 恢复这轮建议 —— 恢复期间复用既有 路由加载中，绝不挂载消费表单（含附件库
// 水合落地前的首帧窗口：pristine 消费轮不先挂表单再被恢复卸掉，敲进的键不丢）；
// 恢复结算成 failed 时复用既有 确认层 给「重试 / 继续手填」，绝不把空建议冒充恢复成功。
// 内存已有轮（arming/waiting_parse/loading/ready/failed/manual）零恢复调用直接挂载 —— 恢复
// 操作内部重复同一 pristine 守卫，正常路由切换不覆盖活状态、不重复读取。
// 消费页不挂 use附件简历刷新：权威解析仍是 pending/processing 时，恢复操作按
// 允许等待解析:false 立即把本轮落 manual（Task 3），这里只需在结算前不放行表单。
// 边界返回 Fragment，不新增任何布局 DOM / 类名 / 样式。
//
// 本文件还拥有两个纯位置判定，供 应用.tsx 的退出清理与测试共用：
//   · 是预填消费位置 —— 哪些 (pathname, search) 会消费 suggestion（只有六个资料页；
//     日常编辑标记写在 query 上，带合法来源的完整位置不消费）；
//   · 是活跃Onboarding位置 —— 注册会话还活着的路径集合，以 Onboarding流程 为唯一
//     事实源（两条候选合同进主壳前的并集 + 学生分流 打开的 city/job 子页），
//     求职状态 / 披露说明 / 头像页只保状态不清理；离开集合才由 应用.tsx 清理。

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { 路径 } from '../路由/路径表';
import { 路由加载中 } from '../应用';
import 确认层 from '../组件/确认层';
import { use应用状态 } from '../状态/应用状态';
import { 创建空候选预填状态, type 候选预填状态 } from '../状态/后端/类型';
import { 读候选编辑来源 } from './候选日常编辑';
import { Onboarding流程 } from './onboarding配置';

/** 消费 suggestion 的资料页（设计 §9 的窄集合）。Task 3 起向导不再是消费位：
 *  个人优势题随 summary 建议一起迁到简历资料页（工作经历 聚合页），向导只剩补充偏好一题，
 *  不读任何 suggestion —— 进本屏也不再触发恢复（salary 旧地址由屏幕自己替换回首屏）。 */
const 消费预填路径 = new Set<string>([
  路径.基本信息,
  路径.最高学历,
  路径.毕业院校,
  路径.选专业,
  路径.就读时间段,
  路径.工作经历,
]);

/** 日常编辑标记（简历编辑显式来源，Task 1）：我的简历 的基本信息／工作经历／求职状态
 *  全部入口在地址上带它，是「这次编辑只服务简历域」的唯一标记 —— 保存后只回我的简历，
 *  不写建档草稿、不确认分区、不派发到岗预填。查询串保持 ASCII（URL 参数既有约定）。 */
export const 简历编辑查询 = 'from=resume';

/** 该 search 是否带日常编辑标记。三个资料屏、应用 的活跃判定与预填边界共用同一判据，
 *  不允许第二种口径（比如拿 引导预填 非空去推断编辑来源）。 */
export function 带简历编辑标记(search: string): boolean {
  return new URLSearchParams(search).get('from') === 'resume';
}

/**
 * 该 (pathname, search) 是否带合同 A 白名单里、且**在本路径合法**的日常编辑来源：
 * resume 服务简历域各屏（/basic、/experience、/wizard、/onboard/status…），
 * intentions 仅状态页可用（合同 A「intentions 仅允许状态页使用」）。
 * 路径限定由本层承担 —— 错配来源（如 /basic?from=intentions）既不是日常位置，也不
 * 改变原有的消费位/活跃位判定，与页面「/basic 只认 from=resume、其余等同无来源」同一
 * 口径：同一 URL 不允许在页面层与边界层得到互相矛盾的语义。
 */
function 是日常编辑位置(pathname: string, search: string): boolean {
  const 来源 = 读候选编辑来源(search);
  if (来源 === null) return false;
  return 来源 === 'resume' || pathname === 路径.求职状态;
}

/** 该位置是否会消费 suggestion：路由身份必须含 search —— 日常编辑标记写在 query 上。
 *  带合法日常编辑来源的完整位置绝不消费（从我的简历进来的编辑刷新后也不恢复建议）。 */
export function 是预填消费位置(pathname: string, search: string): boolean {
  if (是日常编辑位置(pathname, search)) return false;
  return 消费预填路径.has(pathname);
}

/** 去掉 query 的裸路径（合同里可能有带 query 的登记地址，站点比对只看路径）。 */
function 剥问号(路径串: string): string {
  const 位 = 路径串.indexOf('?');
  return 位 === -1 ? 路径串 : 路径串.slice(0, 位);
}

/** 注册会话活跃集合：两条候选合同进主壳前的并集 + 学生分流 打开的 city/job 子页。 */
const 活跃Onboarding路径 = new Set<string>(
  [
    ...Onboarding流程.学生求职,
    ...Onboarding流程.社招求职,
    路径.选工作城市,
    路径.选期望职位,
  ]
    .filter((站) => 站 !== 路径.主壳)
    .map(剥问号),
);

/**
 * 该位置是否仍在候选注册会话内。向导在合同里，活跃与否不看 query（旧薪资段地址仍
 * 属注册会话，由屏幕自己替换回首屏）—— 唯一例外是日常编辑标记：带合法来源的完整位置（/basic?from=resume、
 * /onboard/status?from=intentions）属简历域，绝不是注册会话；否则已退出的引导状态
 * 会被资料编辑路径重新当作活跃。错配来源（/basic?from=intentions）不算日常位置，
 * 与原判定一致。其余离开集合的位置由 应用.tsx 清理。
 */
export function 是活跃Onboarding位置(路径串: string): boolean {
  const 位 = 路径串.indexOf('?');
  const pathname = 剥问号(路径串);
  if (是日常编辑位置(pathname, 位 === -1 ? '' : 路径串.slice(位))) return false;
  return 活跃Onboarding路径.has(pathname);
}

/**
 * J-PILOT-02 Task 9（Spec §6 回访分流 / §7 白名单）：未完成建档草稿的恢复落点。
 * 位置 只信任活跃集合内的 pathname —— 路径恢复接受当前候选流程白名单，不拿存储值
 * 任意导航；search 原样带回；无位置记录或白名单外位置一律
 * 回旅程入口 学生分流。题序/编辑中等其余恢复坐标随 建档 草稿本身走，不在这里展开。
 */
export function 恢复落点(位置?: { pathname: string; search: string; 题序?: number }): string {
  if (位置 !== undefined && 是活跃Onboarding位置(位置.pathname)) {
    return `${位置.pathname}${位置.search}`;
  }
  return 路径.学生分流;
}

/** 内存轮是否 pristine inactive（source/suggestion 皆空）——只有它才允许发起恢复。 */
function 是原始轮(预填: 候选预填状态): boolean {
  return 预填.phase === 'inactive' && 预填.source === null && 预填.suggestion === null;
}

/**
 * 非视觉恢复边界：消费位置上按 exact tuple 恢复一轮未完成预填，恢复结算前不挂
 * 消费表单。恢复/重试/手填的分支语义全部在操作层（简历预填操作），本组件只决定
 * 何时调、调什么参、结算前后各渲染什么。
 */
export function 候选Onboarding预填边界({ children }: { children: ReactNode }) {
  const { 数据源模式, 后端状态, 操作 } = use应用状态();
  const 位置 = useLocation();
  const 预填 = 后端状态.候选预填状态 ?? 创建空候选预填状态();
  const 消费中 = 是预填消费位置(位置.pathname, 位置.search);
  const 候选会话就绪 = 数据源模式 === 'backend' && 后端状态.主体?.last_used_role === 'candidate';
  const 附件已水合 = 后端状态.附件简历库 !== null;
  const [恢复在途, 设恢复在途] = useState(false);
  const [恢复已结束, 设恢复已结束] = useState(false);
  const 已触发引用 = useRef(false);

  // 一次性恢复：只在消费位置 + pristine 内存轮上发起；候选/附件未水合时先等
  //（不烧掉这次机会），水合落地由依赖变化重新驱动。恢复操作对 Mock / 非候选 /
  // 无元数据 / 失配记录一律 no-op，正常路由切换不重复读取。
  useEffect(() => {
    if (!消费中 || 已触发引用.current) return;
    if (!候选会话就绪 || !附件已水合) return;
    if (!是原始轮(预填)) return;
    已触发引用.current = true;
    设恢复在途(true);
    void 操作.恢复候选Onboarding预填({ 允许等待解析: false })
      .catch(() => undefined) // 恢复按合同不抛出；防御收口，绝不把异常抛进路由树
      .finally(() => {
        设恢复在途(false);
        设恢复已结束(true);
      });
  }, [消费中, 候选会话就绪, 附件已水合, 预填, 操作]);

  // 非消费位置（如向导）原样放行；恢复在途先出既有加载屏；本边界触发的
  // 恢复结算成 failed 时复用 确认层（重试 / 继续手填）——继续手填后操作层落 manual，
  // 本组件随状态重渲染自然放行表单，无需另一份本地界面态。
  if (!消费中) return <>{children}</>;
  if (恢复在途) return <路由加载中 />;
  // 水合落地、恢复结算前不挂消费表单（Spec §9「读取完成前不挂载待预填表单」）：
  // 消费位置 + 候选会话 + pristine 内存轮时，附件库未水合的首帧与恢复结算之间都
  // 只出 路由加载中 —— 否则表单先挂、恢复发起再卸掉它，那一帧里敲进的键全部丢失。
  // 恢复结算（含无元数据 no-op）或轮不再 pristine（内存 ready/manual 直接挂载、零读取）
  // 才放行；Mock / 非候选会话不进此门，直接挂载。
  if (候选会话就绪 && 是原始轮(预填) && !恢复已结束) return <路由加载中 />;
  if (恢复已结束 && 预填.phase === 'failed') {
    return (
      <确认层
        标题="简历内容暂时取不到"
        正文="可以重试刚才那次读取，也可以先手动填写，已保存的内容不会受影响。"
        执行文="重试"
        执行={() => {
          设恢复在途(true);
          void 操作.重试候选Onboarding预填()
            .catch(() => undefined)
            .finally(() => 设恢复在途(false));
        }}
        取消文="继续手填"
        取消={() => 操作.继续手填候选Onboarding()}
      />
    );
  }
  return <>{children}</>;
}
