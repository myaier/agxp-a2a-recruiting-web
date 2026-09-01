// 举报层 —— 职位详情、直聊会话、真人会话三处共用的底部举报表单。
//
// 为什么做成共用组件：这三个入口举报的对象不同（一个岗 / 一个直聊对象 / 一个真人顾问），
// 但用户要做的事完全一样 —— 选一个原因、决定要不要顺手屏蔽这家公司、提交。
// 三处各写一份必然会漂移（原因项不一致、提交后反馈不一致），所以只留这一份。
//
// 与双盲的关系：举报走的是平台侧，不改变谈判阶段，也不会把你的身份透给对方；
// 勾选「同时屏蔽」才会真的动名单，而屏蔽在本产品里是双向的（对方也看不到你）。
//
// P8 Task 7：按 数据源模式 只分叉提交行为 —— Mock 三个调用点不传 target，本地
// 派发 + 固定 toast + 关层的原型行为字节不变；Backend 调用点必传权威 target
// （{type:'job'|'match_case'|'conversation', ref}，绝不是展示名），提交走
// 操作.提交P8举报（幂等键归操作层）：提交期间锁原因/屏蔽行/提交键，只有确认回执
// 才关层并回调 已确认；409 block_unavailable 与结果未知保持层开、选择保留（取消
// 勾选屏蔽后的重试是新的提交）；404 report_target_not_found 统一关层并回调 目标失效
// 让屏层刷新来源。Backend 绝不本地派发 拉黑 —— 屏蔽名单只认权威视图（P3 隐私快照）。
// 原因的 UI 中文→线协议映射是本层闭合表；本层没有也不新增自由正文框。

import { useState } from 'react';
import 样式 from './举报层.module.css';
import { 轻提示 } from './轻提示';
import { use应用状态 } from '../状态/应用状态';
import { 取P8错误文案, 是举报目标失效 } from '../状态/后端/P8控制面操作';
import type { P8ReportReason, P8ReportReceipt, P8ReportTarget } from '../数据/招聘数据源/P8控制面';
import 弹层框架 from './弹层框架';

/** 举报原因固定四项：前三项是平台能核查的具体事由，「其他」兜底 */
const 举报原因表 = ['虚假信息', '薪资不实', '骚扰', '其他'] as const;

/** 原因的 UI 中文 → 线协议闭合映射（与 wire 四值枚举一一对应，绝不发明第五种） */
const 原因到线协议: Record<(typeof 举报原因表)[number], P8ReportReason> = {
  虚假信息: 'false_information',
  薪资不实: 'salary_misrepresentation',
  骚扰: 'harassment',
  其他: 'other',
};

interface 属性 {
  /** 被举报对象的展示名：职位名，或直聊/真人会话里的对方姓名（只用于展示，绝不进请求） */
  对象名: string;
  /** 勾选「同时屏蔽」时要拉黑的公司 / 机构名（Mock 本地拉黑用；Backend 只做展示） */
  屏蔽名称: string;
  关闭: () => void;
  /** Backend 必传的权威举报目标；Mock 调用点不传（走本地路径） */
  target?: P8ReportTarget;
  /** 确认回执到达后回调（P7 用它强制重读该会话）；层随后自行关闭 */
  已确认?: (receipt: P8ReportReceipt) => void | Promise<void>;
  /** 404 report_target_not_found 的统一回调：屏层刷新来源（层随后自行关闭） */
  目标失效?: () => void | Promise<void>;
}

export default function 举报层({ 对象名, 屏蔽名称, 关闭, target, 已确认, 目标失效 }: 属性) {
  const { 派发, 数据源模式, 操作 } = use应用状态();
  const [原因, 设原因] = useState<(typeof 举报原因表)[number] | null>(null);
  const [同时屏蔽, 设同时屏蔽] = useState(false);
  // Backend 提交在飞：锁原因/屏蔽行/提交键（单飞由操作层保证，这里只收口视觉）
  const [提交中, 设提交中] = useState(false);

  const 提交 = () => {
    if (!原因) {
      轻提示('先选一个举报原因');
      return;
    }
    if (数据源模式 === 'backend') {
      if (target === undefined) return; // 接线缺陷：Backend 必带权威 target —— fail closed，绝不本地拉黑、不伪造成功
      const 权威目标 = target;
      void (async () => {
        设提交中(true);
        try {
          const 回执 = await 操作.提交P8举报(权威目标, 原因到线协议[原因], 同时屏蔽);
          // 确认后的刷新（如 P7 重读会话）失败不影响已确认的举报结果
          try {
            await 已确认?.(回执);
          } catch {
            // 刷新失败：举报已权威受理，照常收口本层
          }
          // 屏蔽是否生效只认服务端回执，绝不信本地勾选
          轻提示(回执.blockStatus === 'applied' ? `举报已受理 · 已屏蔽${屏蔽名称}` : '举报已受理，我们会尽快核查');
          关闭();
        } catch (错误) {
          if (是举报目标失效(错误)) {
            // 统一终局：对象已不存在 —— 关层 + 让屏层刷新来源（刷新失败同样关层）
            try {
              await 目标失效?.();
            } catch {
              // 来源刷新失败不拦住过期层的关闭
            }
            轻提示(取P8错误文案(错误));
            关闭();
            return;
          }
          // 未知/限流/屏蔽暂不可用等：层保持开、选择保留，固定中文文案可同层重试
          轻提示(取P8错误文案(错误));
        } finally {
          设提交中(false);
        }
      })();
      return;
    }
    // Mock 原型路径（字节不变）：屏蔽是双向的，所以它是一个真实的业务动作，必须落到
    // 全局名单里，不能只在这一层里「看起来勾上了」
    if (同时屏蔽) 派发({ 型: '拉黑', 名称: 屏蔽名称 });
    轻提示(同时屏蔽 ? `举报已受理 · 已屏蔽${屏蔽名称}` : '举报已受理，我们会尽快核查');
    关闭();
  };

  return (
    <弹层框架 标签="举报" 遮罩类名={样式.遮罩} 面板类名={样式.层} 关闭={关闭}>
        <div className={样式.抓手} />
        <div className={样式.标题}>举报</div>
        <div className={`${样式.对象} 单行`}>{对象名}</div>

        <div className={样式.原因组}>
          {举报原因表.map((项) => (
            <button
              key={项}
              className={`${样式.原因项} ${原因 === 项 ? 样式.原因项选中 : ''} 可点`}
              disabled={提交中}
              onClick={() => 设原因(项)}
            >
              {项}
              {原因 === 项 ? <span className={样式.勾}>✓</span> : null}
            </button>
          ))}
        </div>

        <button
          className={`${样式.屏蔽行} 可点`}
          disabled={提交中}
          onClick={() => 设同时屏蔽((旧) => !旧)}
          aria-pressed={同时屏蔽}
        >
          <span className={`${样式.勾选框} ${同时屏蔽 ? 样式.勾选框选中 : ''}`}>
            {同时屏蔽 ? '✓' : ''}
          </span>
          <span className={样式.屏蔽文字}>
            <span className={样式.屏蔽标题}>同时屏蔽{屏蔽名称}</span>
            <span className={样式.屏蔽说明}>屏蔽是双向的，对方也不会再看到你</span>
          </span>
        </button>

        <button className={`${样式.提交} 可点`} disabled={提交中} onClick={提交}>
          提交举报
        </button>
        <button className={`${样式.取消} 可点`} onClick={关闭}>
          取消
        </button>
    </弹层框架>
  );
}
