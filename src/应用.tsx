// 路由表。每屏一个文件，文件名对应设计稿编号（见 说明.md 的对照表）。
// 新增屏幕只需在 屏幕/ 下建文件并在这里挂一行，不改动其它任何地方。

import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { 路径 } from './路由/路径表';
import 登录 from './屏幕/登录';
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
const 企业详情 = lazy(() => import('./屏幕/企业详情'));
const 设置 = lazy(() => import('./屏幕/设置'));
const 屏蔽名单 = lazy(() => import('./屏幕/屏蔽名单'));
const 披露偏好 = lazy(() => import('./屏幕/披露偏好'));
const 归档谈判 = lazy(() => import('./屏幕/归档谈判'));
const 帮助与客服 = lazy(() => import('./屏幕/帮助与客服'));
const 企业实名认证 = lazy(() => import('./屏幕/企业实名认证'));
const 招聘名片 = lazy(() => import('./屏幕/招聘名片'));
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

export default function 应用() {
  const { 数据源模式, 后端状态 } = use应用状态();
  const 位置 = useLocation();
  const 前往 = useNavigate();

  // Backend 初始化完成且已恢复会话、当前仍在登录页时：按上次角色替换到对应主壳，
  // null 角色落到身份选择页。不新增中间页面。
  useEffect(() => {
    if (数据源模式 !== 'backend') return;
    if (后端状态.初始化 !== '完成') return;
    if (位置.pathname !== 路径.登录) return;
    if (!后端状态.已登录) return;
    const 角色 = 后端状态.主体?.last_used_role;
    if (角色 === 'candidate') 前往(路径.主壳, { replace: true });
    else if (角色 === 'recruiter') 前往(路径.企业主壳, { replace: true });
    else 前往(路径.选身份, { replace: true });
  }, [数据源模式, 后端状态, 位置, 前往]);

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

  return (
    <Suspense fallback={<路由加载中 />}>
      <Routes>
      {/* 注册引导（2026-08-20 按 BOSS 截图顺序重排；引导说明页 2026-08-21 按标注删除）：
          登录 → 选身份 → 完善资料(/student，可进 /onboard/city、/onboard/job)
          → 期望月薪(/wizard?stage=salary) → 创建在线简历(/basic) → 求职状态 → 最高学历
          → 你毕业于 → 你的专业是 → 就读时间段 →（非学生先 /experience）→ 向导偏好段(/wizard)
          → 披露说明 → 添加头像 → 主壳
          向导两段共用一条路由：段写在 query 上，query 不参与路由匹配 */}
      <Route path={路径.登录} element={<登录 />} />
      <Route path={路径.选身份} element={<选身份 />} />
      <Route path={路径.学生分流} element={<学生分流 />} />
      <Route path={路径.基本信息} element={<基本信息 />} />
      <Route path={路径.工作经历} element={<工作经历 />} />
      <Route path={路径.引导问答} element={<引导问答 />} />
      <Route path={路径.披露说明} element={<披露说明 />} />
      <Route path={路径.选工作城市} element={<选工作城市 />} />
      <Route path={路径.选期望职位} element={<选期望职位 />} />
      <Route path={路径.求职状态} element={<求职状态 />} />
      <Route path={路径.最高学历} element={<最高学历 />} />
      <Route path={路径.毕业院校} element={<毕业院校 />} />
      <Route path={路径.选专业} element={<选专业 />} />
      <Route path={路径.就读时间段} element={<就读时间段 />} />
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
      <Route path={路径.求职意向管理} element={<求职意向管理 />} />
      <Route path={路径.添加意向} element={<添加意向 />} />
      {/* 两条静态子路径写在 :id 模板之前：react-router 的排序本来就让静态段胜过动态段，
          这里再按书写顺序摆一次，读代码的人不用去回忆匹配优先级 */}
      <Route path={路径.选择城市} element={<选择城市 />} />
      <Route path={路径.选期望行业} element={<选期望行业 />} />
      <Route path={路径.编辑意向模板} element={<添加意向 />} />
      <Route path={路径.规则库} element={<规则库 />} />
      <Route path={路径.我的简历} element={<我的简历 />} />
      <Route path={路径.企业详情模板} element={<企业详情 />} />

      {/* 「我的」下属功能页 */}
      <Route path={路径.设置} element={<设置 />} />
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
      <Route path={路径.岗位管理} element={<岗位管理 />} />
      <Route path={路径.岗位详情模板} element={<岗位详情 />} />
      <Route path={路径.企业代理详情} element={<企业代理详情 />} />
      <Route path={路径.企业代理设置} element={<企业代理设置 />} />
      <Route path={路径.匿名在线简历模板} element={<匿名在线简历 />} />
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
