// 路由表。每屏一个文件，文件名对应设计稿编号（见 说明.md 的对照表）。
// 新增屏幕只需在 屏幕/ 下建文件并在这里挂一行，不改动其它任何地方。

import { Routes, Route, Navigate } from 'react-router-dom';
import { 路径 } from './路由/路径表';

import 登录 from './屏幕/登录';
import 选身份 from './屏幕/选身份';
import 引导说明 from './屏幕/引导说明';
import 工作经历 from './屏幕/工作经历';
import 引导问答 from './屏幕/引导问答';
import 披露说明 from './屏幕/披露说明';
import 主壳 from './屏幕/主壳';
import 在谈详情 from './屏幕/在谈详情';
import 往来记录 from './屏幕/往来记录';
import 问AI代理 from './屏幕/问AI代理';
import 职位详情 from './屏幕/职位详情';
import 直聊会话 from './屏幕/直聊会话';
import 真人会话 from './屏幕/真人会话';
import 求职意向管理 from './屏幕/求职意向管理';
import 添加意向 from './屏幕/添加意向';
import 规则库 from './屏幕/规则库';
import 我的简历 from './屏幕/我的简历';
import 未通过说明 from './屏幕/未通过说明';

export default function 应用() {
  return (
    <Routes>
      {/* 注册引导：R1 → R2 → A1 → A2 → A3a-g → A4 */}
      <Route path={路径.登录} element={<登录 />} />
      <Route path={路径.选身份} element={<选身份 />} />
      <Route path={路径.引导说明} element={<引导说明 />} />
      <Route path={路径.工作经历} element={<工作经历 />} />
      <Route path={路径.引导问答} element={<引导问答 />} />
      <Route path={路径.披露说明} element={<披露说明 />} />

      {/* 主壳：3 Tab + 职位页双子视图 */}
      <Route path={路径.主壳} element={<主壳 />} />

      {/* 次级页 */}
      <Route path={路径.在谈详情模板} element={<在谈详情 />} />
      <Route path={路径.往来记录模板} element={<往来记录 />} />
      <Route path={路径.问AI代理} element={<问AI代理 />} />
      <Route path={路径.职位详情模板} element={<职位详情 />} />
      <Route path={路径.直聊会话} element={<直聊会话 />} />
      <Route path={路径.真人会话} element={<真人会话 />} />
      <Route path={路径.求职意向管理} element={<求职意向管理 />} />
      <Route path={路径.添加意向} element={<添加意向 />} />
      <Route path={路径.规则库} element={<规则库 />} />
      <Route path={路径.我的简历} element={<我的简历 />} />
      <Route path={路径.未通过说明} element={<未通过说明 />} />

      {/* 兜底 */}
      <Route path="*" element={<Navigate to={路径.登录} replace />} />
    </Routes>
  );
}
