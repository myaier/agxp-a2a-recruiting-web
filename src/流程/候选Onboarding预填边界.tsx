// 候选 onboarding 简历预填的路由恢复边界（设计 §9 / Task 7）。
//
// 只包装可能消费 suggestion 的 onboarding 页面（六个资料页 + 向导偏好段）：
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
//   · 是预填消费位置 —— 哪些 (pathname, search) 会消费 suggestion（向导段写在
//     query 上：偏好段消费，薪资段绝不消费 summary 建议）；
//   · 是活跃Onboarding位置 —— 注册会话还活着的路径集合，以 Onboarding流程 为唯一
//     事实源（两条候选合同进主壳前的并集 + 学生分流 打开的 city/job 子页），
//     薪资段 / 求职状态 / 披露说明 / 头像页只保状态不清理；离开集合才由 应用.tsx 清理。

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { 路径 } from '../路由/路径表';
import { 路由加载中 } from '../应用';
import 确认层 from '../组件/确认层';
import { use应用状态 } from '../状态/应用状态';
import { 创建空候选预填状态, type 候选预填状态 } from '../状态/后端/类型';
import { Onboarding流程, 读向导段, 向导段参数名 } from './onboarding配置';

/** 消费 suggestion 的资料页（设计 §9 的窄集合；向导只有偏好段的个人优势题消费）。 */
const 消费预填路径 = new Set<string>([
  路径.基本信息,
  路径.最高学历,
  路径.毕业院校,
  路径.选专业,
  路径.就读时间段,
  路径.工作经历,
]);

/** 该位置是否会消费 suggestion：路由身份必须含 search —— 向导段写在 query 上。 */
export function 是预填消费位置(pathname: string, search: string): boolean {
  if (消费预填路径.has(pathname)) return true;
  return pathname === 路径.引导问答 && 读向导段(new URLSearchParams(search).get(向导段参数名)) === '偏好段';
}

/** 去掉 query 的裸路径（合同里薪资段带着 ?stage=salary 登记，站点比对只看路径）。 */
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
 * 该位置是否仍在候选注册会话内。向导两段（含薪资段）都在合同里，活跃与否不看
 * query —— query 只决定消费（上面的段判定）；离开集合的位置由 应用.tsx 清理。
 */
export function 是活跃Onboarding位置(路径串: string): boolean {
  return 活跃Onboarding路径.has(剥问号(路径串));
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

  // 非消费位置（如向导薪资段）原样放行；恢复在途先出既有加载屏；本边界触发的
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
