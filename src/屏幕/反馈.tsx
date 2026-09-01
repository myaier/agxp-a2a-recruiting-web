// 反馈与举报 —— 两端设置页「关于」组共用这一屏（/feedback）。
//
// 举报和产品反馈放在同一个入口：分类先选，正文再写，提交后整屏换成致谢态。
// 举报类的分类必须在最前面 —— 骚扰与虚假岗位是这个产品最需要被立刻告知的事。
//
// 双盲提醒：举报时不需要（也不应该）让用户报出对方的真实身份，代理侧有编号可追溯，
// 所以表单里没有「对方姓名」这类字段。
//
// P8 Task 6：按 数据源模式 只分叉提交行为、致谢文案与工单号 —— 分类片/输入区/计数/
// 提交键/致谢壳的标记与样式原样。Backend：产品三分类（功能异常/体验建议/其他）走真实
// 操作.提交P8反馈（键归操作层；服务端 ticketId 原样上屏，文案是「我们会尽快核查」，
// 后端不发布 24 小时时限），提交期间锁分类与正文，失败/未知保留输入并给既有错误文案；
// 举报两类在这里没有可核实的对象 —— 提交只给「从具体岗位、谈判或真人会话发起」的
// 入口指引，绝不把无目标的一段话当举报发出去。Mock：本地成功、固定原型工单号照旧，
// 零 P8 操作。

import { useState } from 'react';
import 样式 from './我的功能页.module.css';
import 本屏样式 from './反馈.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 轻提示 } from '../组件/轻提示';
import { 取P8错误文案 } from '../状态/后端/P8控制面操作';
import type { P8FeedbackCategory } from '../数据/招聘数据源/P8控制面';

const 分类表 = ['举报虚假岗位', '举报骚扰行为', '功能异常', '体验建议', '其他'];

/** 各分类的输入提示：写清楚要什么信息，用户才知道该说什么 */
const 占位表: Record<string, string> = {
  举报虚假岗位: '哪个岗位、哪里对不上？例如：JD 与代理转述不一致、公司实际不在招。',
  举报骚扰行为: '发生了什么？我们会核查该企业代理与真人沟通的全部记录。',
  功能异常: '在哪一屏、做了什么、期望看到什么？',
  体验建议: '你希望它变成什么样？',
  其他: '想说的都可以写在这里。',
};

const 字数上限 = 500;

/** 产品反馈的 UI→线协议映射（举报两类不在此表：后端只收带具体对象的举报）。 */
const 反馈分类到线协议: Record<string, P8FeedbackCategory | undefined> = {
  功能异常: 'bug',
  体验建议: 'suggestion',
  其他: 'other',
};

/** Backend 举报两类的提交指引：入口在具体对象那一侧，本屏绝不代发无目标举报。 */
const 举报入口指引 = '举报要从具体的岗位、谈判或真人会话里发起；这里只收集产品反馈。';

export default function 反馈() {
  const { 返回 } = use导航();
  const { 操作, 数据源模式 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  const [分类, 设分类] = useState(分类表[0]);
  const [正文, 设正文] = useState('');
  const [已提交, 设已提交] = useState(false);
  // Backend 提交在飞：锁分类片/正文/提交键（单飞由操作层保证，这里只收口视觉）
  const [提交中, 设提交中] = useState(false);
  // Backend 成功回执的工单号；Mock 恒用原型固定工单号
  const [工单号, 设工单号] = useState<string | null>(null);

  const 可提交 = 正文.trim().length >= 5;

  const 提交 = () => {
    if (!是后端) {
      设已提交(true); // Mock：本地成功照旧，零 P8 操作
      return;
    }
    const 线分类 = 反馈分类到线协议[分类];
    if (线分类 === undefined) {
      轻提示(举报入口指引);
      return;
    }
    void (async () => {
      设提交中(true);
      try {
        const 回执 = await 操作.提交P8反馈(线分类, 正文);
        设工单号(回执.ticketId);
        设已提交(true);
      } catch (错误) {
        // 冲突/限流/未知/401：无本地成功，输入与所选分类原样保留可重试（401 由应用级路由回收）
        轻提示(取P8错误文案(错误));
      } finally {
        设提交中(false);
      }
    })();
  };

  const 致谢正文 = 是后端
    ? '我们会尽快核查。每一条反馈都有人读。'
    : 分类.startsWith('举报')
      ? '我们会在 24 小时内核查。核查过程中不会向对方透露是谁提交的。'
      : '每一条都有人读。被采纳的建议会在版本更新说明里出现。';
  const 致谢工单号 = 是后端 && 工单号 !== null ? `工单号 ${工单号}` : '工单号 FB-2026-0818-041';

  if (已提交) {
    return (
      <次级页外壳>
        <返回栏 返回={返回} 标题="反馈与举报" />
        <滚动区 样式覆盖={{ padding: '0 18px 24px' }}>
          <div className={本屏样式.致谢区}>
            <div className={本屏样式.对勾圈}>✓</div>
            <div className={本屏样式.致谢标题}>已收到，谢谢你</div>
            <div className={本屏样式.致谢正文}>{致谢正文}</div>
            <div className={本屏样式.致谢编号}>{致谢工单号}</div>
            <button className={`${本屏样式.返回键} 可点`} onClick={返回}>
              返回
            </button>
          </div>
        </滚动区>
      </次级页外壳>
    );
  }

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="反馈与举报" />

      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        <div className={样式.分类行}>
          {分类表.map((项) => (
            <button
              key={项}
              className={`${样式.分类片} ${分类 === 项 ? 样式.分类片选中 : ''} 可点`}
              disabled={提交中}
              onClick={() => 设分类(项)}
            >
              {项}
            </button>
          ))}
        </div>

        <div className={本屏样式.输入区}>
          <textarea
            className={本屏样式.文本框}
            placeholder={占位表[分类]}
            value={正文}
            maxLength={字数上限}
            disabled={提交中}
            onChange={(事件) => 设正文(事件.target.value)}
          />
          <div className={本屏样式.计数行}>
            <span className={本屏样式.计数}>
              {正文.length} / {字数上限}
            </span>
          </div>
        </div>

        <button
          className={`${本屏样式.提交键} ${可提交 && !提交中 ? '可点' : 本屏样式.提交键禁用}`}
          disabled={!可提交 || 提交中}
          onClick={提交}
        >
          提交
        </button>

        <div className={样式.版本}>
          提交内容会附带你的账号与当前版本号，便于定位问题。
          <br />
          举报时无需提供对方身份，平台侧按代谈编号即可追溯。
        </div>
      </滚动区>
    </次级页外壳>
  );
}
