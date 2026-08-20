// 路由表。每屏一个文件，文件名对应设计稿编号（见 说明.md 的对照表）。
// 新增屏幕只需在 屏幕/ 下建文件并在这里挂一行，不改动其它任何地方。

import { Routes, Route, Navigate } from 'react-router-dom';
import { 路径 } from './路由/路径表';

import 登录 from './屏幕/登录';
import 选身份 from './屏幕/选身份';
import 学生分流 from './屏幕/学生分流';
import 引导说明 from './屏幕/引导说明';
import 基本信息 from './屏幕/基本信息';
import 工作经历 from './屏幕/工作经历';
import 引导问答 from './屏幕/引导问答';
import 披露说明 from './屏幕/披露说明';
import 选工作城市 from './屏幕/选工作城市';
import 选期望职位 from './屏幕/选期望职位';
import 求职状态 from './屏幕/求职状态';
import 最高学历 from './屏幕/最高学历';
import 毕业院校 from './屏幕/毕业院校';
import 选专业 from './屏幕/选专业';
import 就读时间段 from './屏幕/就读时间段';
import 添加头像 from './屏幕/添加头像';
import 主壳 from './屏幕/主壳';
import 在谈详情 from './屏幕/在谈详情';
import 往来记录 from './屏幕/往来记录';
import 问AI代理 from './屏幕/问AI代理';
import 代理详情 from './屏幕/代理详情';
import 职位详情 from './屏幕/职位详情';
import 直聊会话 from './屏幕/直聊会话';
import 真人会话 from './屏幕/真人会话';
import 求职意向管理 from './屏幕/求职意向管理';
import 添加意向 from './屏幕/添加意向';
import 规则库 from './屏幕/规则库';
import 我的简历 from './屏幕/我的简历';
import 未通过说明 from './屏幕/未通过说明';
import 企业详情 from './屏幕/企业详情';
import 通知中心 from './屏幕/通知中心';
import 设置 from './屏幕/设置';
import 屏蔽名单 from './屏幕/屏蔽名单';
import 披露偏好 from './屏幕/披露偏好';
import 归档谈判 from './屏幕/归档谈判';
import 帮助与客服 from './屏幕/帮助与客服';
import 企业实名认证 from './屏幕/企业实名认证';
import 招聘名片 from './屏幕/招聘名片';
import 发布岗位 from './屏幕/发布岗位';
import 公司档案编辑 from './屏幕/公司档案编辑';
import 公司档案分区编辑 from './屏幕/公司档案分区编辑';
import 企业主壳 from './屏幕/企业主壳';
import 候选详情 from './屏幕/候选详情';
import 候选未通过 from './屏幕/候选未通过';
import 企业往来记录 from './屏幕/企业往来记录';
import 企业问AI代理 from './屏幕/企业问AI代理';
import 企业真人会话 from './屏幕/企业真人会话';
import 岗位管理 from './屏幕/岗位管理';
import 岗位详情 from './屏幕/岗位详情';
import 企业代理详情 from './屏幕/企业代理详情';
import 企业代理设置 from './屏幕/企业代理设置';
import 匿名在线简历 from './屏幕/匿名在线简历';
import 企业通知中心 from './屏幕/企业通知中心';
import 企业设置 from './屏幕/企业设置';
import 企业披露策略 from './屏幕/企业披露策略';
import 已筛候选 from './屏幕/已筛候选';
import 账号安全 from './屏幕/账号安全';
import 反馈 from './屏幕/反馈';
import 用户协议 from './屏幕/用户协议';
import 接触记录 from './屏幕/接触记录';

export default function 应用() {
  return (
    <Routes>
      {/* 注册引导（2026-08-20 按 BOSS 截图顺序重排）：
          登录 → 选身份 → 引导说明 → 完善资料(/student，可进 /onboard/city、/onboard/job)
          → 期望月薪(/wizard 首题) → 创建在线简历(/basic) → 求职状态 → 最高学历
          → 你毕业于 → 你的专业是 → 就读时间段 →（非学生先 /experience）→ 向导续答
          → 披露说明 → 添加头像 → 主壳 */}
      <Route path={路径.登录} element={<登录 />} />
      <Route path={路径.选身份} element={<选身份 />} />
      <Route path={路径.学生分流} element={<学生分流 />} />
      <Route path={路径.引导说明} element={<引导说明 />} />
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

      {/* 主壳：3 Tab + 职位页双子视图 */}
      <Route path={路径.主壳} element={<主壳 />} />

      {/* 次级页 */}
      <Route path={路径.在谈详情模板} element={<在谈详情 />} />
      <Route path={路径.往来记录模板} element={<往来记录 />} />
      <Route path={路径.问AI代理} element={<问AI代理 />} />
      <Route path={路径.代理详情} element={<代理详情 />} />
      <Route path={路径.职位详情模板} element={<职位详情 />} />
      <Route path={路径.直聊会话} element={<直聊会话 />} />
      <Route path={路径.真人会话} element={<真人会话 />} />
      <Route path={路径.求职意向管理} element={<求职意向管理 />} />
      <Route path={路径.添加意向} element={<添加意向 />} />
      <Route path={路径.编辑意向模板} element={<添加意向 />} />
      <Route path={路径.规则库} element={<规则库 />} />
      <Route path={路径.我的简历} element={<我的简历 />} />
      <Route path={路径.未通过说明} element={<未通过说明 />} />
      <Route path={路径.企业详情模板} element={<企业详情 />} />

      {/* 「我的」下属功能页 */}
      <Route path={路径.通知中心} element={<通知中心 />} />
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
      <Route path={路径.企业主壳} element={<企业主壳 />} />
      <Route path={路径.候选详情模板} element={<候选详情 />} />
      <Route path={路径.候选未通过} element={<候选未通过 />} />
      <Route path={路径.企业往来记录模板} element={<企业往来记录 />} />
      <Route path={路径.企业问AI代理} element={<企业问AI代理 />} />
      <Route path={路径.企业真人会话} element={<企业真人会话 />} />
      <Route path={路径.岗位管理} element={<岗位管理 />} />
      <Route path={路径.岗位详情模板} element={<岗位详情 />} />
      <Route path={路径.企业代理详情} element={<企业代理详情 />} />
      <Route path={路径.企业代理设置} element={<企业代理设置 />} />
      <Route path={路径.匿名在线简历模板} element={<匿名在线简历 />} />
      <Route path={路径.企业通知中心} element={<企业通知中心 />} />
      <Route path={路径.企业设置} element={<企业设置 />} />
      <Route path={路径.企业披露策略} element={<企业披露策略 />} />
      <Route path={路径.已筛候选} element={<已筛候选 />} />

      {/* 兜底 */}
      <Route path="*" element={<Navigate to={路径.登录} replace />} />
    </Routes>
  );
}
