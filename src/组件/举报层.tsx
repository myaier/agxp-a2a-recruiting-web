// 举报层 —— 职位详情、直聊会话、真人会话三处共用的底部举报表单。
//
// 为什么做成共用组件：这三个入口举报的对象不同（一个岗 / 一个直聊对象 / 一个真人顾问），
// 但用户要做的事完全一样 —— 选一个原因、决定要不要顺手屏蔽这家公司、提交。
// 三处各写一份必然会漂移（原因项不一致、提交后反馈不一致），所以只留这一份。
//
// 与双盲的关系：举报走的是平台侧，不改变谈判阶段，也不会把你的身份透给对方；
// 勾选「同时屏蔽」才会真的动名单，而屏蔽在本产品里是双向的（对方也看不到你）。

import { useState } from 'react';
import 样式 from './举报层.module.css';
import { 轻提示 } from './轻提示';
import { use应用状态 } from '../状态/应用状态';

/** 举报原因固定四项：前三项是平台能核查的具体事由，「其他」兜底 */
const 举报原因表 = ['虚假信息', '薪资不实', '骚扰', '其他'] as const;

interface 属性 {
  /** 被举报对象的展示名：职位名，或直聊/真人会话里的对方姓名 */
  对象名: string;
  /** 勾选「同时屏蔽」时要拉黑的公司 / 机构名 */
  屏蔽名称: string;
  关闭: () => void;
}

export default function 举报层({ 对象名, 屏蔽名称, 关闭 }: 属性) {
  const { 派发 } = use应用状态();
  const [原因, 设原因] = useState<string | null>(null);
  const [同时屏蔽, 设同时屏蔽] = useState(false);

  const 提交 = () => {
    if (!原因) {
      轻提示('先选一个举报原因');
      return;
    }
    // 屏蔽是双向的，所以它是一个真实的业务动作，必须落到全局名单里，
    // 不能只在这一层里「看起来勾上了」
    if (同时屏蔽) 派发({ 型: '拉黑', 名称: 屏蔽名称 });
    轻提示(同时屏蔽 ? `举报已受理 · 已屏蔽${屏蔽名称}` : '举报已受理，我们会尽快核查');
    关闭();
  };

  return (
    <div className={样式.遮罩} onClick={关闭}>
      <div className={样式.层} onClick={(事件) => 事件.stopPropagation()}>
        <div className={样式.抓手} />
        <div className={样式.标题}>举报</div>
        <div className={`${样式.对象} 单行`}>{对象名}</div>

        <div className={样式.原因组}>
          {举报原因表.map((项) => (
            <button
              key={项}
              className={`${样式.原因项} ${原因 === 项 ? 样式.原因项选中 : ''} 可点`}
              onClick={() => 设原因(项)}
            >
              {项}
              {原因 === 项 ? <span className={样式.勾}>✓</span> : null}
            </button>
          ))}
        </div>

        <button
          className={`${样式.屏蔽行} 可点`}
          onClick={() => 设同时屏蔽((旧) => !旧)}
          role="checkbox"
          aria-checked={同时屏蔽}
        >
          <span className={`${样式.勾选框} ${同时屏蔽 ? 样式.勾选框选中 : ''}`}>
            {同时屏蔽 ? '✓' : ''}
          </span>
          <span className={样式.屏蔽文字}>
            <span className={样式.屏蔽标题}>同时屏蔽{屏蔽名称}</span>
            <span className={样式.屏蔽说明}>屏蔽是双向的，对方也不会再看到你</span>
          </span>
        </button>

        <button className={`${样式.提交} 可点`} onClick={提交}>
          提交举报
        </button>
        <button className={`${样式.取消} 可点`} onClick={关闭}>
          取消
        </button>
      </div>
    </div>
  );
}
