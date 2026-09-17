// 路由表。每屏一个文件，文件名对应设计稿编号（见 说明.md 的对照表）。
// 新增屏幕只需在 屏幕/ 下建文件并在这里挂一行，不改动其它任何地方。

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { 路径 } from './路由/路径表';
import { 候选Onboarding预填边界, 是活跃Onboarding位置, 恢复落点 } from './流程/候选Onboarding预填边界';
import { 并入建档草稿 } from './流程/onboarding配置';
import { 判定Onboarding分流, 取Onboarding状态 } from './状态/后端/Onboarding操作';
import { 取后端错误文案 } from './数据/HTTP客户端';
import { 主按钮 } from './组件/通用';
import 登录 from './屏幕/登录';
import type { BFF主体, BFF角色 } from './数据/BFF契约';
import { use应用状态 } from './状态/应用状态';

// 手机端首屏只加载当前路由。此前所有屏幕同步 import，登录页也会把求职端、企业端
// 约 60 屏一次性打进 800KB 主包；路由切换时由 Suspense 提供短暂的统一兜底。
const 选身份 = lazy(() => import('./屏幕/选身份'));
const 学生分流 = lazy(() => import('./屏幕/学生分流'));
const 基本信息 = lazy(() => import('./屏幕/基本信息'));
const 工作经历 = lazy(() => import('./屏幕/工作经历'));
const 引导问答 = lazy(() => import('./屏幕/引导问答'));
const 披露说明 = lazy(() => import('./屏幕/披露说明'));
const 选工作城市 = lazy(() => import('./屏幕/选工作城市'));
const 选期望职位 = lazy(() => import('./屏幕/选期望职位'));
const 求职状态 = lazy(() => import('./屏幕/求职状态'));
const 最高学历 = lazy(() => import('./屏幕/最高学历'));
const 毕业院校 = lazy(() => import('./屏幕/毕业院校'));
const 选专业 = lazy(() => import('./屏幕/选专业'));
const 就读时间段 = lazy(() => import('./屏幕/就读时间段'));
const 添加头像 = lazy(() => import('./屏幕/添加头像'));
const 初始化页 = lazy(() => import('./屏幕/初始化页'));
const 主壳 = lazy(() => import('./屏幕/主壳'));
const 在谈详情 = lazy(() => import('./屏幕/在谈详情'));
const 往来记录 = lazy(() => import('./屏幕/往来记录'));
const 问AI代理 = lazy(() => import('./屏幕/问AI代理'));
const 代理详情 = lazy(() => import('./屏幕/代理详情'));
const 职位详情 = lazy(() => import('./屏幕/职位详情'));
const 直聊会话 = lazy(() => import('./屏幕/直聊会话'));
const 真人会话 = lazy(() => import('./屏幕/真人会话'));
const 求职意向管理 = lazy(() => import('./屏幕/求职意向管理'));
const 添加意向 = lazy(() => import('./屏幕/添加意向'));
const 选择城市 = lazy(() => import('./屏幕/选择城市'));
const 选期望行业 = lazy(() => import('./屏幕/选期望行业'));
const 规则库 = lazy(() => import('./屏幕/规则库'));
const 我的简历 = lazy(() => import('./屏幕/我的简历'));
const 个人信息 = lazy(() => import('./屏幕/个人信息'));
const 企业详情 = lazy(() => import('./屏幕/企业详情'));
const 设置 = lazy(() => import('./屏幕/设置'));
const 屏蔽名单 = lazy(() => import('./屏幕/屏蔽名单'));
const 披露偏好 = lazy(() => import('./屏幕/披露偏好'));
const 归档谈判 = lazy(() => import('./屏幕/归档谈判'));
const 帮助与客服 = lazy(() => import('./屏幕/帮助与客服'));
const 企业实名认证 = lazy(() => import('./屏幕/企业实名认证'));
const 招聘名片 = lazy(() => import('./屏幕/招聘名片'));
const 企业组织申请 = lazy(() => import('./屏幕/企业组织申请'));
const 企业邀请加入 = lazy(() => import('./屏幕/企业邀请加入'));
const 发布岗位 = lazy(() => import('./屏幕/发布岗位'));
const 公司档案编辑 = lazy(() => import('./屏幕/公司档案编辑'));
const 公司档案分区编辑 = lazy(() => import('./屏幕/公司档案分区编辑'));
const 企业主壳 = lazy(() => import('./屏幕/企业主壳'));
const 候选详情 = lazy(() => import('./屏幕/候选详情'));
const 企业往来记录 = lazy(() => import('./屏幕/企业往来记录'));
const 企业问AI代理 = lazy(() => import('./屏幕/企业问AI代理'));
const 企业真人会话 = lazy(() => import('./屏幕/企业真人会话'));
const 岗位管理 = lazy(() => import('./屏幕/岗位管理'));
const 岗位详情 = lazy(() => import('./屏幕/岗位详情'));
const 企业代理详情 = lazy(() => import('./屏幕/企业代理详情'));
const 企业代理设置 = lazy(() => import('./屏幕/企业代理设置'));
const 匿名在线简历 = lazy(() => import('./屏幕/匿名在线简历'));
const 企业设置 = lazy(() => import('./屏幕/企业设置'));
const 企业披露策略 = lazy(() => import('./屏幕/企业披露策略'));
const 企业归档 = lazy(() => import('./屏幕/企业归档'));
const 已筛候选 = lazy(() => import('./屏幕/已筛候选'));
const 初筛记录 = lazy(() => import('./屏幕/初筛记录'));
const 初筛对话 = lazy(() => import('./屏幕/初筛对话'));
const 账号安全 = lazy(() => import('./屏幕/账号安全'));
const 反馈 = lazy(() => import('./屏幕/反馈'));
const 用户协议 = lazy(() => import('./屏幕/用户协议'));
const 接触记录 = lazy(() => import('./屏幕/接触记录'));
const 候选实名认证 = lazy(() => import('./屏幕/候选实名认证'));

export function 路由加载中() {
  return (
    <div
      aria-live="polite"
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--页面底)',
        color: 'var(--次要)',
        fontSize: 13,
      }}
    >
      正在加载…
    </div>
  );
}

// ── P0 修复 Task 2：招聘方路由守卫 ───────────────────────────────
// 恢复与退出路径永远放行：档案缺失或组织链失败时，用户仍能改名片、去实名认证、
// 申请/加入企业、回身份选择、进账号安全 —— 绝不把人锁死在一屏上。
const 招聘方恢复路径 = new Set<string>([
  路径.招聘名片,
  路径.企业实名认证,
  路径.企业组织申请,
  路径.企业邀请加入,
]);

// ── Backend 角色路由边界（前端真实性修复 Plan 1）──────────────────
// 候选/招聘两组精确路由模式，shared 路由（登录/选身份/账号安全/反馈/用户协议/
// 帮助/企业详情）不入表。逐项列出已注册路由，未知路径仍交给 * fallback，
// 不用 startsWith 之类的宽匹配去猜角色。
const 候选路由模式 = [
  路径.学生分流, 路径.基本信息, 路径.工作经历, 路径.引导问答,
  路径.披露说明, 路径.选工作城市, 路径.选期望职位, 路径.求职状态,
  路径.最高学历, 路径.毕业院校, 路径.选专业, 路径.就读时间段,
  路径.添加头像, 路径.初始化, 路径.主壳, 路径.在谈详情模板,
  路径.往来记录模板, 路径.问AI代理, 路径.代理详情, 路径.职位详情模板,
  路径.直聊会话, 路径.直聊会话岗位模板, 路径.真人会话, 路径.真人会话模板,
  路径.求职意向管理, 路径.添加意向, 路径.选择城市, 路径.选期望行业,
  路径.编辑意向模板, 路径.规则库, 路径.我的简历, 路径.个人信息,
  路径.设置, 路径.屏蔽名单, 路径.披露偏好, 路径.归档谈判, 路径.接触记录,
  路径.候选实名认证,
] as const;

const 招聘路由模式 = [
  路径.企业实名认证, 路径.招聘名片, 路径.企业组织申请, 路径.企业邀请加入,
  路径.发布岗位, 路径.编辑岗位模板, 路径.公司档案编辑, 路径.公司档案分区模板,
  路径.企业初始化, 路径.企业主壳, 路径.候选详情模板, 路径.企业往来记录模板,
  路径.企业问AI代理, 路径.企业真人会话, 路径.企业真人会话模板,
  路径.岗位管理, 路径.岗位详情模板, 路径.企业代理详情, 路径.企业代理设置,
  路径.匿名在线简历模板, 路径.后端匿名在线简历模板,
  路径.企业设置, 路径.企业披露策略, 路径.企业归档,
  路径.已筛候选, 路径.初筛记录, 路径.初筛对话模板,
] as const;

function 匹配任一路由(pathname: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchPath({ path: pattern, end: true }, pathname) !== null);
}

/**
 * 只读角色路由判定：目标角色路由要求 last_used_role 是该角色且该角色 active。
 * 双 active 但当前身份在对侧 → 显式切身份路径；其余不满足 → 身份选择。
 * 绝不调用 操作.切身份，也不写 last_used_role —— 访问 URL 不是身份切换。
 */
function 角色路由重定向(pathname: string, subject: BFF主体 | null): string | null {
  const 目标角色: BFF角色 | null = 匹配任一路由(pathname, 候选路由模式)
    ? 'candidate'
    : 匹配任一路由(pathname, 招聘路由模式) ? 'recruiter' : null;
  if (目标角色 === null) return null;
  if (subject === null) return 路径.选身份;
  const active = (role: BFF角色) =>
    subject.roles.some((项) => 项.role === role && 项.status === 'active');
  if (active(目标角色) && subject.last_used_role === 目标角色) return null;
  if (!active('candidate') || !active('recruiter') || subject.last_used_role === null) {
    return 路径.选身份;
  }
  return subject.last_used_role === 'candidate'
    ? 路径.切换身份自求职端
    : 路径.切换身份自企业端;
}

/** 受保护的招聘业务路径：登录页（恢复落点）与 /hr 主壳及其子路径，去掉恢复/退出路径。 */
function 是受保护招聘路径(pathname: string): boolean {
  const 招聘路由 = pathname === 路径.企业主壳 ||
    pathname.startsWith(`${路径.企业主壳}/`);
  return pathname === 路径.登录 ||
    (招聘路由 && !招聘方恢复路径.has(pathname));
}

/**
 * 组织链失败时的恢复面：显示服务端给出的真实错误，而不是让业务屏渲染假空列表。
 * 重试走 操作.重新水合招聘方数据（会话层把 初始化 落 进行中 再收口，加载屏全程可见），
 * 本组件只持有自己按钮的单飞状态；非 401 失败仍由操作层 轻提示，并留在恢复面。
 */
function 招聘方恢复失败({
  error,
  retry,
  switchRole,
}: {
  error: string | null;
  retry: () => Promise<void>;
  switchRole: () => void;
}) {
  // 重入守卫只当双击保险：重新水合招聘方数据 在第一个 await 之前就同步把
  // 初始化 落 进行中，本面当场让位给 路由加载中 —— 真正把整轮重试串起来的是
  // 那块加载屏，不是这个组件（所以这里没有、也不可能有可见的「重试中」态）。
  const [重试中, 设重试中] = useState(false);
  return (
    <div
      role="alert"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--页面底)',
        paddingTop: 'var(--安全区上)',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'grid',
          alignContent: 'center',
          justifyItems: 'center',
          gap: 16,
          padding: '0 24px',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, color: 'var(--次要)', fontSize: 13, lineHeight: 1.7 }}>
          {error ?? '企业资料读取失败'}
        </p>
        <button
          type="button"
          className="可点"
          disabled={重试中}
          onClick={switchRole}
          style={{ color: 'var(--次要)', fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          切换身份
        </button>
      </div>
      <主按钮
        文字="重试"
        禁用={重试中}
        按下={() => {
          if (重试中) return;
          设重试中(true);
          void retry().catch(() => undefined).finally(() => 设重试中(false));
        }}
      />
    </div>
  );
}

export default function 应用() {
  const { 数据源模式, 后端状态, 操作, 状态 } = use应用状态();
  const 位置 = useLocation();
  const 前往 = useNavigate();
  // review-cx F1：登录落点分流要看的「本轮建档草稿不在场」——进依赖表（布尔，不引整份 状态）。
  const 无建档草稿 = 状态.引导预填?.建档 === undefined;

  // ── stg 契约对齐 2026-09-14（Spec §5 分流表）：登录/选身份/切端/受保护入口同一语义 ──
  // 旧「profile 存在 / 简历教育+意向完备」的回访判定已被明确替代：完成事实只来自
  // me/onboarding 成功快照（判定Onboarding分流）；查询未完成前显示加载/重试，不挂载
  // 会自动保存的引导页，也不闪进主壳。已有 URL 角色隔离（角色路由重定向）保持在前。
  const Onboarding分流 = 数据源模式 === 'backend'
    && 后端状态.初始化 === '完成'
    && 后端状态.已登录
    ? 判定Onboarding分流(后端状态.主体, 取Onboarding状态(后端状态))
    : null;
  // review-r3：candidate 未完成且无草稿的 主壳 落点 —— 渲染守卫的重定向与预填清理
  // 效应共用的同一判定。这种「即将被送回引导」的落点仍算注册会话内：/student 上传
  // 简历只激活预填轮（source/suggestion + 恢复元数据）不建 建档草稿，重定向跳变上
  // 烧掉在飞预填轮会让解析流程降级为手动。
  const 候选主壳落点重定向 = Onboarding分流 !== null
    && Onboarding分流.型 === '未完成'
    && Onboarding分流.角色 === 'candidate'
    && 无建档草稿
    && 位置.pathname === 路径.主壳;
  const 位置从注册流 = Boolean((位置.state as { 从注册流?: boolean } | null)?.从注册流);
  // 完成判定被消费的表面：登录/主壳/初始化的主页落点 + 旅程入口（学生分流 / 注册流名片）。
  // 其余页面（设置/账号安全/普通名片编辑等）不被 Onboarding 阶段阻塞。
  const 是Onboarding引导入口 = 位置.pathname === 路径.学生分流
    || (位置.pathname === 路径.招聘名片 && 位置从注册流);
  const 是主页落点 = 位置.pathname === 路径.登录
    || 位置.pathname === 路径.主壳
    || 位置.pathname === 路径.企业主壳
    || 位置.pathname === 路径.初始化;
  const 分流生效面 = Onboarding分流 !== null && (是Onboarding引导入口 || 是主页落点);

  // 引导入口的完成反弹只认「进入」那次导航：本次注册名片上刚 complete 成功时用户
  // 仍坐在名片页（pathname 未变），显式跳首岗的导航不被已完成状态抢走。
  const 进入的路径 = useRef<string | null>(null);
  useEffect(() => {
    if (Onboarding分流 === null) return;
    const 当前 = 位置.pathname;
    const 是进入 = 进入的路径.current !== 当前;
    进入的路径.current = 当前;
    if (当前 === 路径.登录) {
      // 登录落点：选择身份 / 已完成主页 / 未完成引导（无草稿）三类确定性导航；
      // 查询中、读取失败、角色不可用与「未完成+有草稿」不在effect里猜 —— 渲染区的
      // 分流门给出加载/恢复面，草稿回访由下方 恢复落点 守卫接手。
      if (Onboarding分流.型 === '选择身份') {
        前往(路径.选身份, { replace: true });
        return;
      }
      if (Onboarding分流.型 === '已完成') {
        前往(Onboarding分流.角色 === 'recruiter' ? 路径.企业主壳 : 路径.主壳, { replace: true });
        return;
      }
      if (Onboarding分流.型 === '未完成' && Onboarding分流.角色 === 'candidate' && 无建档草稿) {
        前往(路径.学生分流, { replace: true });
        return;
      }
      if (
        Onboarding分流.型 === '未完成' && Onboarding分流.角色 === 'recruiter'
        && 后端状态.招聘方组织水合.阶段 !== '失败'
      ) {
        前往(路径.招聘名片, { replace: true, state: { 从注册流: true } });
        return;
      }
      return;
    }
    // 已完成用户进入注册流名片（从注册流 state 可区分）：完成事实优先于引导（消除
    // 完成后反复引导）；仅认进入那次导航，名片页上的原地完成（pathname 未变）不触发。
    // closeout：/student 不做同款反弹 —— Spec §5 表只定义登录/恢复/切端/受保护入口的
    // 落点，不要求弹出显式深链的学生分流（已完成用户经学生分流上传简历是真实路径）。
    if (是进入 && Onboarding分流.型 === '已完成') {
      if (当前 === 路径.招聘名片 && 位置从注册流) {
        前往(路径.企业主壳, { replace: true });
        return;
      }
    }
    // recruiter 受保护路径的引导重定向：未完成 → 注册流名片。已完成用户不因档案缺失
    // 或资料减少退回引导（Spec §5）；组织链失败保持既有恢复面，不被伪装成注册流。
    if (
      Onboarding分流.型 === '未完成' && Onboarding分流.角色 === 'recruiter'
      && 后端状态.招聘方组织水合.阶段 !== '失败'
      && 是受保护招聘路径(当前)
    ) {
      前往(路径.招聘名片, { replace: true, state: { 从注册流: true } });
      return;
    }
    // 后端状态整体进依赖（分流/组织阶段变化都要重评）；操作/前往 由 router 保证稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [数据源模式, 后端状态, 位置, 前往, 无建档草稿]);

  // ── 候选 onboarding 预填的退出清理（设计 §9 / Task 7）──────────────────
  // 离开注册会话（进主壳、切其它产品路由）就作废预填轮与恢复元数据（内存 + session
  // 存储随 清候选Onboarding预填 一起清），防止中断注册后从主壳进消费页被误判为
  // onboarding。活跃集合以 Onboarding流程 为唯一事实源（见 流程/候选Onboarding预填边界），
  // 求职状态 / 披露说明 / 头像页只保状态；完成注册的收尾清理另在 添加头像 显式做。
  // 只在 Backend + 已登录 candidate 且初始化完成后清理 —— 主体未落地时恢复元数据适配器
  // 还是 null，先清只会烧掉内存态而删不掉存储；同一路径只清一次（清本身会写状态，
  // 不设栅栏会与设态互相驱动成环）。
  const 预填清理就绪 = 数据源模式 === 'backend'
    && 后端状态.初始化 === '完成'
    && 后端状态.已登录
    && 后端状态.主体?.last_used_role === 'candidate';
  // 活跃判定的路由身份是完整位置（pathname+search）：日常编辑标记（from=resume）
  // 都写在 query 上，只看 pathname 会把 /basic?from=resume 的编辑位置误判成注册会话。
  const 完整位置 = `${位置.pathname}${位置.search}`;
  const 已清理路径引用 = useRef<string | null>(null);
  useEffect(() => {
    if (!预填清理就绪) return;
    if (是活跃Onboarding位置(完整位置) || 候选主壳落点重定向) {
      // codex review-r1 P2：进入（或回到）活跃集合时复位栅栏 —— 下一次「活跃→非活跃」
      // 转移必须再清一次。否则清过 /app 后重进 onboarding 激活新轮、再退回 /app 时，
      // 路径相同被去重跳过，新 suggestion 与恢复元数据会活到刷新。
      // review-r3：被拦截重定向的 /app 落点同属注册会话 —— 本帧只复位栅栏返回，
      // 不把在飞预填轮当「已离开注册会话」清掉。
      已清理路径引用.current = null;
      return;
    }
    if (已清理路径引用.current === 完整位置) return;
    已清理路径引用.current = 完整位置;
    操作.清候选Onboarding预填();
    // 操作 由 Provider 的 useMemo 保持稳定；后端状态刻意不进依赖（清理写状态会回环）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [预填清理就绪, 完整位置, 操作]);

  // ── J-PILOT-02 Task 9：候选 onboarding 回访落点（Spec §6 回访按事实分流）──
  // 旅程未完成的事实只由建档草稿表达（无客户端「completed」假服务端标记）：Backend
  // 已登录 candidate 且本轮建档草稿在场时，注册会话内每站把 pathname/search 落进草稿
  //（刷新/重登后恢复落点的唯一坐标；题序/编辑中等输入坐标随草稿本身走）；普通返回
  // 与选择子页都在活跃集合内，不清草稿。
  const 建档在场 = 数据源模式 === 'backend'
    && 后端状态.初始化 === '完成'
    && 后端状态.已登录
    && 后端状态.主体?.last_used_role === 'candidate'
    && 状态.引导预填?.建档 !== undefined;
  useEffect(() => {
    if (!建档在场) return;
    if (!是活跃Onboarding位置(完整位置)) return;
    const 建档 = 状态.引导预填?.建档;
    const 现有 = 建档?.位置;
    if (现有?.pathname === 位置.pathname && 现有?.search === 位置.search) return;
    操作.更新候选建档草稿(
      并入建档草稿(建档, { 位置: { pathname: 位置.pathname, search: 位置.search } }),
    );
    // 操作 由 Provider 的 useMemo 保持稳定；草稿对象只作比较输入（比较守卫防回环），
    // 刻意不进依赖表。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [建档在场, 完整位置, 操作]);

  // ── Backend 角色路由边界（前端真实性修复 Plan 1）──────────────────
  // 初始化完成且已登录后，在 <Routes> 挂载前同步判角色：错误角色的业务组件
  // （含其 effect）一次都不能挂载。被拒路由 replace，浏览器后退不会落回旧格。
  // 守卫在组织恢复面之前执行：只有通过 recruiter 角色守卫的请求才进入
  // 档案缺失/组织失败/恢复白名单判定。Mock 完全跳过（守卫仅 Backend 生效）。
  const 角色重定向 = 数据源模式 === 'backend' &&
    后端状态.初始化 === '完成' && 后端状态.已登录
    ? 角色路由重定向(位置.pathname, 后端状态.主体)
    : null;
  if (角色重定向 !== null) return <Navigate to={角色重定向} replace />;

  // 组织链失败：受保护路径上换成恢复面（真实错误 + 重试 + 切换身份），
  // 恢复/退出路径（名片、实名认证、组织申请、邀请加入、账号安全、身份选择）照常渲染。
  if (
    数据源模式 === 'backend' &&
    后端状态.初始化 === '完成' &&
    后端状态.已登录 &&
    后端状态.主体?.last_used_role === 'recruiter' &&
    后端状态.招聘方组织水合.阶段 === '失败' &&
    是受保护招聘路径(位置.pathname)
  ) {
    return (
      <招聘方恢复失败
        error={后端状态.招聘方组织水合.错误}
        retry={操作.重新水合招聘方数据}
        switchRole={() => 前往(路径.选身份, { replace: true })}
      />
    );
  }

  // Backend 初始化进行中：复用现有 路由加载中（不改其 JSX/样式）
  if (数据源模式 === 'backend' && 后端状态.初始化 === '进行中') {
    return <路由加载中 />;
  }
  // 初始化完成、无会话、且不在登录页：回到登录页
  if (
    数据源模式 === 'backend' &&
    后端状态.初始化 === '完成' &&
    !后端状态.已登录 &&
    位置.pathname !== 路径.登录
  ) {
    return <Navigate to={路径.登录} replace />;
  }

  // ── stg 契约对齐 2026-09-14（Spec §5）：完成判定消费表面上的分流门 ──────────
  // 查询未完成（未读取/加载中）→ 既有 路由加载中：不挂载会自动保存的引导页，也不闪进
  // 主壳；读取失败 / 角色停用或不存在 → 恢复面（真实错误 + 重试 刷新Onboarding +
  // 切换身份），不擅自激活、不猜完成/未完成。Mock（Onboarding分流 null）与其余页面
  // 不受影响。重试的加载交接与 重新水合招聘方数据 同款：刷新起步写 加载中，本门让位。
  if (分流生效面 && Onboarding分流 !== null) {
    if (Onboarding分流.型 === '查询中') {
      return <路由加载中 />;
    }
    if (Onboarding分流.型 === '读取失败' || Onboarding分流.型 === '角色不可用') {
      return (
        <招聘方恢复失败
          error={Onboarding分流.型 === '角色不可用'
            ? '当前身份不可用或已停用，请切换身份后重试'
            : 取后端错误文案(Onboarding分流.错误)}
          retry={async () => {
            try {
              await 操作.刷新Onboarding();
            } catch {
              // 失败已记录进 Onboarding.失败，恢复面随之重挂；不把异常抛进路由树
            }
          }}
          switchRole={() => 前往(路径.选身份, { replace: true })}
        />
      );
    }
  }

  // ── candidate 受保护主入口（review-r2/r3）：未完成且无草稿的 主壳 落点与登录/切端
  // 同一语义（Spec §5）—— 在 <Routes> 挂载前同步 replace 回旅程入口，主壳（含其
  // 挂载效应 加载会话列表）一次都不能挂载（与 角色重定向 同款防闪守卫）；有草稿的
  // 回访由下方 恢复落点 守卫接手，已完成不因资料事实退回引导；查询中/失败/停用
  // 已被上方分流门拦下，Mock（Onboarding分流 null → 判定恒 false）不受影响。
  // 判定与预填清理效应共用（见上方 候选主壳落点重定向）。
  if (候选主壳落点重定向) {
    return <Navigate to={路径.学生分流} replace />;
  }

  // ── J-PILOT-02 Task 9：未完成草稿的回访落点（Spec §6 回访分流）──
  // 同标签有未完成建档草稿时，直接打开完成落点（登录/主壳/初始化）不能借直达跳过
  // 保存：同步 replace 回草稿记录的恢复落点（白名单外或无位置记录回旅程入口 学生分流），
  // 目标屏一次都不挂载（不先挂空表单又被卸载）。stg 契约对齐 2026-09-14：后端已完成
  // 事实优先于旧草稿回访拦截 —— 分流不是 未完成（已完成 / 查询中 / 失败）时不拦截，
  // 已完成由 Provider 的完成清理作废旧草稿；无草稿账号不进此门。选身份/账号安全等
  // 恢复出口不在拦截集合内，切换身份与登出的既有路径不受影响。
  const 回访重定向 = 建档在场
    && Onboarding分流?.型 === '未完成'
    && !是活跃Onboarding位置(完整位置)
    && (位置.pathname === 路径.主壳
      || 位置.pathname === 路径.登录
      || 位置.pathname === 路径.初始化)
    ? 恢复落点(状态.引导预填?.建档?.位置)
    : null;
  if (回访重定向 !== null) return <Navigate to={回访重定向} replace />;

  return (
    <Suspense fallback={<路由加载中 />}>
      <Routes>
      {/* 注册引导（2026-08-20 按 BOSS 截图顺序重排；引导说明页 2026-08-21 按标注删除）：
          登录 → 选身份 → 完善资料(/student：求职意向含期望薪资，可进 /onboard/city、
          /onboard/job) → 创建在线简历(/basic) → 求职状态 → 最高学历 → 你毕业于 →
          你的专业是 → 就读时间段 → 工作经历(/experience：简历资料含个人优势)
          → 向导(/wizard：补充偏好，答完创建首次意向) → 披露说明 → 添加头像 → 主壳
          Task 3（合同 C）：两身份共用这一条主序 —— 薪资并入首屏、个人优势并入简历资料，
          向导只剩补充偏好一题；旧 /wizard?stage=salary 由屏幕自己替换回首屏补齐。
          向导只有一条路由，query 不参与路由匹配（旧 stage 参数只作兼容识别）。 */}
      <Route path={路径.登录} element={<登录 />} />
      <Route path={路径.选身份} element={<选身份 />} />
      <Route path={路径.学生分流} element={<学生分流 />} />
      {/* Task 7：消费 suggestion 的六条资料路由套非视觉恢复边界 ——
          刷新后先按 exact tuple 恢复一轮未完成预填再挂表单（Task 3 起向导不再是
          消费位：summary 建议随个人优势迁到 /experience）。路由顺序与登记不变。 */}
      <Route path={路径.基本信息} element={<候选Onboarding预填边界><基本信息 /></候选Onboarding预填边界>} />
      <Route path={路径.工作经历} element={<候选Onboarding预填边界><工作经历 /></候选Onboarding预填边界>} />
      <Route path={路径.引导问答} element={<候选Onboarding预填边界><引导问答 /></候选Onboarding预填边界>} />
      <Route path={路径.披露说明} element={<披露说明 />} />
      <Route path={路径.选工作城市} element={<选工作城市 />} />
      <Route path={路径.选期望职位} element={<选期望职位 />} />
      <Route path={路径.求职状态} element={<求职状态 />} />
      <Route path={路径.最高学历} element={<候选Onboarding预填边界><最高学历 /></候选Onboarding预填边界>} />
      <Route path={路径.毕业院校} element={<候选Onboarding预填边界><毕业院校 /></候选Onboarding预填边界>} />
      <Route path={路径.选专业} element={<候选Onboarding预填边界><选专业 /></候选Onboarding预填边界>} />
      <Route path={路径.就读时间段} element={<候选Onboarding预填边界><就读时间段 /></候选Onboarding预填边界>} />
      <Route path={路径.添加头像} element={<添加头像 />} />
      {/* 注册流收尾的一次性初始化页：播完自己替换进主壳 */}
      <Route path={路径.初始化} element={<初始化页 端="求职" />} />

      {/* 主壳：3 Tab + 职位页双子视图 */}
      <Route path={路径.主壳} element={<主壳 />} />

      {/* 次级页 */}
      <Route path={路径.在谈详情模板} element={<在谈详情 />} />
      <Route path={路径.往来记录模板} element={<往来记录 />} />
      <Route path={路径.问AI代理} element={<问AI代理 />} />
      <Route path={路径.代理详情} element={<代理详情 />} />
      <Route path={路径.职位详情模板} element={<职位详情 />} />
      {/* 直聊两条路由同一个屏：静态的无参兜底在前，带岗位编号的在后 */}
      <Route path={路径.直聊会话} element={<直聊会话 />} />
      <Route path={路径.直聊会话岗位模板} element={<直聊会话 />} />
      <Route path={路径.真人会话} element={<真人会话 />} />
      {/* P7 Task 4：Backend 参数化真人会话 —— 静态无参路由在前（Mock 剧情 / Backend fail closed），
          参数模板紧随其后供收件箱与 P5 移交导航直达 */}
      <Route path={路径.真人会话模板} element={<真人会话 />} />
      <Route path={路径.求职意向管理} element={<求职意向管理 />} />
      <Route path={路径.添加意向} element={<添加意向 />} />
      {/* 两条静态子路径写在 :id 模板之前：react-router 的排序本来就让静态段胜过动态段，
          这里再按书写顺序摆一次，读代码的人不用去回忆匹配优先级 */}
      <Route path={路径.选择城市} element={<选择城市 />} />
      <Route path={路径.选期望行业} element={<选期望行业 />} />
      <Route path={路径.编辑意向模板} element={<添加意向 />} />
      <Route path={路径.规则库} element={<规则库 />} />
      <Route path={路径.我的简历} element={<我的简历 />} />
      <Route path={路径.个人信息} element={<个人信息 />} />
      <Route path={路径.企业详情模板} element={<企业详情 />} />

      {/* 「我的」下属功能页 */}
      <Route path={路径.设置} element={<设置 />} />
      {/* FE-IV-01：候选实名认证独立页（设置页实名行的落点；候选路由表已登记，
          recruiter/未登录由应用角色/会话守卫处理，Mock 由页面 replace 回设置页） */}
      <Route path={路径.候选实名认证} element={<候选实名认证 />} />
      <Route path={路径.屏蔽名单} element={<屏蔽名单 />} />
      <Route path={路径.披露偏好} element={<披露偏好 />} />
      <Route path={路径.归档谈判} element={<归档谈判 />} />
      <Route path={路径.帮助与客服} element={<帮助与客服 />} />

      {/* 两端共用的外围页：两侧设置里都挂了入口 */}
      <Route path={路径.账号安全} element={<账号安全 />} />
      <Route path={路径.反馈} element={<反馈 />} />
      <Route path={路径.用户协议} element={<用户协议 />} />
      <Route path={路径.接触记录} element={<接触记录 />} />

      {/* ── 企业端（招人方）── */}
      <Route path={路径.企业实名认证} element={<企业实名认证 />} />
      <Route path={路径.招聘名片} element={<招聘名片 />} />
      {/* 实名认证摘要页的两个账号管理入口：不是注册步骤，不进 onboarding 合同 */}
      <Route path={路径.企业组织申请} element={<企业组织申请 />} />
      <Route path={路径.企业邀请加入} element={<企业邀请加入 />} />
      <Route path={路径.发布岗位} element={<发布岗位 />} />
      {/* 编辑态复用同一个屏：带 :id 就预填那个岗位、主按钮变「保存修改」 */}
      <Route path={路径.编辑岗位模板} element={<发布岗位 />} />
      <Route path={路径.公司档案编辑} element={<公司档案编辑 />} />
      {/* 分区编辑各自一整页：长文写得开，也能返回、能深链 */}
      <Route path={路径.公司档案分区模板} element={<公司档案分区编辑 />} />
      {/* 注册流首次发岗后的一次性初始化页：播完自己替换进企业主壳 */}
      <Route path={路径.企业初始化} element={<初始化页 端="招聘" />} />
      <Route path={路径.企业主壳} element={<企业主壳 />} />
      <Route path={路径.候选详情模板} element={<候选详情 />} />
      <Route path={路径.企业往来记录模板} element={<企业往来记录 />} />
      <Route path={路径.企业问AI代理} element={<企业问AI代理 />} />
      <Route path={路径.企业真人会话} element={<企业真人会话 />} />
      {/* P7 Task 4：Backend 参数化企业真人会话（镜像求职端） */}
      <Route path={路径.企业真人会话模板} element={<企业真人会话 />} />
      <Route path={路径.岗位管理} element={<岗位管理 />} />
      <Route path={路径.岗位详情模板} element={<岗位详情 />} />
      <Route path={路径.企业代理详情} element={<企业代理详情 />} />
      <Route path={路径.企业代理设置} element={<企业代理设置 />} />
      <Route path={路径.匿名在线简历模板} element={<匿名在线简历 />} />
      {/* J（Task 8）：Backend canonical 双坐标；旧 /hr/resume/:id 仍注册（Mock 原型 + Backend 失效提示），
          模式分流留在 匿名在线简历 页内，不能让应用 wildcard 把 Mock 旧路由吃掉 */}
      <Route path={路径.后端匿名在线简历模板} element={<匿名在线简历 />} />
      <Route path={路径.企业设置} element={<企业设置 />} />
      <Route path={路径.企业披露策略} element={<企业披露策略 />} />
      <Route path={路径.企业归档} element={<企业归档 />} />
      <Route path={路径.已筛候选} element={<已筛候选 />} />
      {/* 列表在前、单条在后：静态段本来就胜过动态段，这里按书写顺序再摆一次，
          读代码的人不用去回忆 react-router 的匹配优先级 */}
      <Route path={路径.初筛记录} element={<初筛记录 />} />
      <Route path={路径.初筛对话模板} element={<初筛对话 />} />

      {/* 兜底 */}
        <Route path="*" element={<Navigate to={路径.登录} replace />} />
      </Routes>
    </Suspense>
  );
}
