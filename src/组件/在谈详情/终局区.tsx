// 终局区 —— 终局摘要卡 + completed 移交行的纯展示（契约 A，详情统一 Task 9）。
// 摘要三字段（结束语/原因/定格于）与移交说明全部由 终局区信息 给定（值来自控制层投影，
// 本地时间归 mapper），本组件不读 Context、不推导终局、不生成会话坐标。
//   · 「开始私聊」遵循契约 A 按钮铁律：执行!==null 且 禁用说明===null 才可触发，否则
//     真实 disabled 且禁用说明可见（aria-describedby 关联）；观感保留移交专属两档
//     （pending 弱化禁用 / ready 荧光绿主键），不用动作卡按钮档冒充；
//   · pending 只读零导航（spec §5）；ready 的导航坐标只来自控制层给定的执行回调。

import { useId } from 'react';
import 样式 from './详情外壳.module.css';
import type { 终局区信息 } from './类型';

export function 终局区({ 信息 }: { 信息: 终局区信息 }) {
  const 前缀 = useId();
  const 移交 = 信息.移交;
  const 私聊 = 移交?.开始私聊 ?? null;
  const 可触发 = 私聊 !== null && 私聊.执行 !== null && 私聊.禁用说明 === null;
  const 说明id = 私聊 !== null && 私聊.禁用说明 !== null ? `${前缀}-移交` : undefined;
  return (
    <>
      {/* 终局摘要（wire outcome/reason 原样，定格于已本地化） */}
      {信息.摘要 !== null ? (
        <div className={样式.终局卡}>
          <div className={样式.终局题}>终局</div>
          <div>{信息.摘要.结束语}</div>
          <div>{信息.摘要.原因}</div>
          <div className={样式.终局弱}>{信息.摘要.定格于}</div>
        </div>
      ) : null}

      {/* completed 两步移交：pending 恒禁用零导航；ready 只按真实 conversation_ref 执行 */}
      {移交 !== null ? (
        <div className={样式.移交区}>
          <div className={样式.移交行}>{移交.说明}</div>
          <button
            type="button"
            className={可触发 ? `${样式.移交就绪键} 可点` : 样式.移交键禁用}
            disabled={!可触发}
            aria-describedby={说明id}
            onClick={移交.开始私聊.执行 ?? undefined}
          >
            {移交.开始私聊.文案}
          </button>
          {说明id !== undefined ? (
            <span id={说明id} className={样式.移交禁用说明}>
              {移交.开始私聊.禁用说明}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
