// 招聘方组织门 · 两条组织路由（公司档案编辑 / 公司档案分区编辑）共用的可用性门。
//
// 修的是同一个谎：`企业档案快照 === null` 既可能是「水合还在飞」，也可能是
// 「这个人根本没有任何可用企业关系」。旧实现把两者一律显示成「正在加载企业资料」，
// 于是没有企业的招聘方会永远看见一个转不完的加载态，而深链进分区编辑页的人
// 会拿到一张空的可编辑草稿表单 —— 保存下去就等于凭空捏造一家企业。
//
// 本门只读权威事实，按固定顺序分流，绝不合成 Organization、绝不回落 Mock：
//   水合未开始/进行中 → 加载；无可用（active+verified）关系 → 两个既有动作的空态；
//   有多个可用但 current 为空 → 引导去招聘名片选一家；快照/身份缺失 → 重试。

import type { ReactNode } from 'react';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 可用企业关系 } from '../数据/组织映射';

export default function 招聘方组织门({ children }: { children: ReactNode }) {
  const { 状态, 后端状态, 操作 } = use应用状态();
  const { 跳转 } = use导航();
  const hydration = 后端状态.招聘方组织水合;
  const available = 状态.企业关系列表.filter(可用企业关系);

  if (hydration.阶段 === '未开始' || hydration.阶段 === '进行中') {
    return <div role="status">正在加载企业资料</div>;
  }
  // 聚合失败由 Task 2 的应用层 guard 统一接管；受保护招聘路径不会在失败态挂载此门。
  if (available.length === 0) {
    return (
      <div>
        <p>你还没有可用的已认证企业关系。</p>
        <button type="button" onClick={() => 跳转(路径.企业组织申请)}>申请成为企业管理员</button>
        <button type="button" onClick={() => 跳转(路径.企业邀请加入)}>使用邀请加入企业</button>
      </div>
    );
  }
  if (状态.当前企业关系编号 === null) {
    return (
      <div>
        <p>请先选择当前任职企业</p>
        <button type="button" onClick={() => 跳转(路径.招聘名片)}>前往招聘名片选择</button>
      </div>
    );
  }
  if (状态.企业档案快照 === null || 状态.当前企业身份 === null) {
    return (
      <div role="alert">
        <p>企业资料状态不完整，请重新加载</p>
        <button
          type="button"
          onClick={() => void 操作.重新水合招聘方组织().catch(() => undefined)}
        >重试</button>
      </div>
    );
  }
  return <>{children}</>;
}
