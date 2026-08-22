// 反馈与举报 —— 两端设置页「关于」组共用这一屏（/feedback）。
//
// 举报和产品反馈放在同一个入口：分类先选，正文再写，提交后整屏换成致谢态。
// 举报类的分类必须在最前面 —— 骚扰与虚假岗位是这个产品最需要被立刻告知的事。
//
// 双盲提醒：举报时不需要（也不应该）让用户报出对方的真实身份，代理侧有编号可追溯，
// 所以表单里没有「对方姓名」这类字段。

import { useState } from 'react';
import 样式 from './我的功能页.module.css';
import 本屏样式 from './反馈.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';

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

export default function 反馈() {
  const { 返回 } = use导航();
  const [分类, 设分类] = useState(分类表[0]);
  const [正文, 设正文] = useState('');
  const [已提交, 设已提交] = useState(false);

  const 可提交 = 正文.trim().length >= 5;

  if (已提交) {
    return (
      <次级页外壳>
        <返回栏 返回={返回} 标题="反馈与举报" />
        <滚动区 样式覆盖={{ padding: '0 18px 24px' }}>
          <div className={本屏样式.致谢区}>
            <div className={本屏样式.对勾圈}>✓</div>
            <div className={本屏样式.致谢标题}>已收到，谢谢你</div>
            <div className={本屏样式.致谢正文}>
              {分类.startsWith('举报')
                ? '我们会在 24 小时内核查。核查过程中不会向对方透露是谁提交的。'
                : '每一条都有人读。被采纳的建议会在版本更新说明里出现。'}
            </div>
            <div className={本屏样式.致谢编号}>工单号 FB-2026-0818-041</div>
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
            onChange={(事件) => 设正文(事件.target.value)}
          />
          <div className={本屏样式.计数行}>
            <span className={本屏样式.计数}>
              {正文.length} / {字数上限}
            </span>
          </div>
        </div>

        <button
          className={`${本屏样式.提交键} ${可提交 ? '可点' : 本屏样式.提交键禁用}`}
          disabled={!可提交}
          onClick={() => 设已提交(true)}
        >
          提交
        </button>

        <div className={样式.版本}>
          提交内容会附带你的账号与当前版本号，便于定位问题。
          <br />
          举报时无需提供对方身份，平台侧按接洽编号即可追溯。
        </div>
      </滚动区>
    </次级页外壳>
  );
}
