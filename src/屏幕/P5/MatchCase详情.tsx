// P5 双端四阶段详情（Backend 专用共享组件；Mock 屏不渲染本组件）。
//
// 详情统一（2026-09-10 Task 9 控制收口）：本文件只剩路由连接 —— 始终挂载
// use后端详情控制（scope 登记/退出、直达强制读、3 秒可见节拍、Case 叮嘱、展示映射与
// 稳定回答在飞表，见 屏幕/详情控制/use后端详情控制），按返回联合分支：
//   · kind 不可用（契约错误 / 首载失败 / 读入中）：原样的错误/加载页 —— 不进共用外壳、
//     不调 mapper、不摆 Tab，不给虚假详情；
//   · kind 正常/连续：keyed 后端详情渲染（按 主体/角色/单 重挂载 —— 换任一者 Tab 回
//     进度、弹层销毁、动作/PDF 草稿与租约回收；同一张卡 pre-Case→Case 只是联合切换，
//     Tab 不重置、不追加导航历史），正常联合内部无条件调用 use后端详情动作 与
//     useCasePDF预览，连续联合只做 pre-Case/retention 展示，见 屏幕/详情控制/后端正常详情。
//
// 模式边界（spec §5/§6/§8/§10.3 与 P5 冻结契约；J-PILOT-01 Spec §4）：
//   · 详情只凭 URL 坐标 + 已认证角色强制 GET（读取恒 force=true），绝不读列表
//     快照补 context：直达 URL 刷新（列表状态为空）必须整页可渲染。
//   · 候选 URL 坐标接纳合同允许的 dlg_/mc_ 记录坐标；GET 成功按返回 canonical
//     record_id 替换地址（replace，不追加一次导航历史）并保留 tab query —— 别名绝不
//     推造 ID，也绝不保留两条身份。
//   · 未知契约（矩阵外四元组等）按展示映射 fail closed：只给契约错误提示 + 重试
//     （重新 GET），隐藏全部 mutation 控件。
//   · 键与请求坐标唯一归属：candidate 走 negotiation 聚合（canonical record_id），
//     recruiter 仍是 case_id；candidate_alias 不进任何键/请求/缓存坐标。

import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { 次级页外壳, 返回栏, 滚动区 } from '../../组件/通用';
// 详情自己的样式：状态区/徽标/空态/错误/契约错误都在共用外壳的 CSS（列表文件不回写）
import 样式 from '../../组件/在谈详情/详情外壳.module.css';
import { 后端详情渲染 } from '../详情控制/后端正常详情';
import { use后端详情控制 } from '../详情控制/use后端详情控制';
import { use应用状态 } from '../../状态/应用状态';
import { use导航 } from '../../路由/导航钩子';
import { 路径 } from '../../路由/路径表';
import type { P5角色 } from '../../数据/MatchCase展示映射';

const 失败标题 = '这一单暂时打不开';

export function MatchCase详情(props: { role: P5角色 }) {
  const { role } = props;
  const { id: caseId = '' } = useParams<{ id: string }>();
  const { 返回, 替换跳转 } = use导航();
  const 位置 = useLocation();
  const { 后端状态 } = use应用状态();
  const 资源 = use后端详情控制({ role, caseId });

  // Spec §4：候选 GET 成功后按返回 canonical record_id 替换地址（replace 只换当前格，
  // 不追加导航历史），tab query 原样保留；canonical 与 URL 一致（或招聘端）时零导航。
  const canonical = 资源.kind === '不可用' ? null : 资源.canonical记录ID;
  useEffect(() => {
    if (role !== 'candidate' || canonical === null || canonical === caseId) return;
    替换跳转(`${路径.在谈详情(canonical)}${位置.search}`);
  }, [role, canonical, caseId, 位置.search, 替换跳转]);

  // 错误路径（契约错误 / 首载失败 / 读入中）保持原样：不进共用外壳、不调顶栏 mapper ——
  // 没有可渲染的正常详情就不摆 Tab，更不给虚假详情。
  if (资源.kind === '不可用') {
    return (
      <次级页外壳 白底>
        <返回栏 返回={返回} />
        <滚动区>
          {资源.状态 === '契约错误' ? (
            // fail closed：契约错误视图动作表恒空，只给提示与重试，部分数据一概不渲染
            <div className={样式.契约错误行}>
              <div>{资源.说明}</div>
              {资源.重试 !== null ? (
                <button className={`${样式.重试键} 可点`} onClick={资源.重试}>
                  重试
                </button>
              ) : null}
            </div>
          ) : 资源.状态 === '失败' ? (
            <div className={样式.空态}>
              <div className={样式.空态标题}>{失败标题}</div>
              <div className={样式.空态说明}>{资源.说明}</div>
              {资源.重试 !== null ? (
                <button className={`${样式.重试键} 可点`} onClick={资源.重试}>
                  重试
                </button>
              ) : null}
            </div>
          ) : (
            <div className={样式.空态}>{资源.说明}</div>
          )}
        </滚动区>
      </次级页外壳>
    );
  }

  // 详情主体按 主体/角色/单 key 重挂载（plan 生命周期固定）：换 Case、换角色或
  // 换账号都整体重置 —— Tab 回进度、弹层销毁、原草稿清空、PDF 租约回收；同一张卡的
  // pre-Case→Case（联合切换）与正常↔错误交替不重挂载 —— Tab 保留、父实例（含回答
  // 在飞表）不重建。
  const 主体键 = 后端状态.主体?.subject_id ?? '无主体';
  return <后端详情渲染 key={`${主体键}:${role}:${caseId}`} 资源={资源} />;
}