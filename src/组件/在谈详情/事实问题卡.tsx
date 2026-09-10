// 事实问题卡 —— S0 补充事实的纯展示卡（契约 A）。问题/草稿/改草稿/提交全部由控制层
// （use后端详情动作 的 事实问题 返回）给定；提交按钮走 详情按钮位 的契约 A 铁律。
// 提交不可触发（在飞续锁等控制态）时回答框同步锁定 —— 不出现「还能输入、已不能提交」
// 的半开态；当前问题原样展示（「问：」前缀由本卡给定，不改写控制层文案）。

import { useId } from 'react';
import { 详情按钮位 } from './详情动作卡';
import 样式 from './详情动作卡.module.css';
import type { 事实问题属性 } from './类型';

export function 事实问题卡(props: 事实问题属性) {
  const { 问题, 草稿, 改草稿, 提交 } = props;
  const 前缀 = useId();
  const 可触发 = 提交.执行 !== null && 提交.禁用说明 === null;
  return (
    <div className={样式.问题区}>
      <div className={样式.问题}>问：{问题}</div>
      <textarea
        aria-label="回答问题"
        className={样式.回答框}
        value={草稿}
        disabled={!可触发}
        onChange={(事件) => 改草稿(事件.target.value)}
      />
      <div className={样式.键行}>
        <详情按钮位 按钮={提交} 前缀={前缀} />
      </div>
    </div>
  );
}
