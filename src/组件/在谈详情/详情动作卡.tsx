// 详情动作卡 —— 阶段动作区的纯展示卡（契约 A）。标题/说明/正文/按钮全部由控制层的
// 详情动作卡信息 给定：本组件不读 Context/fixture、不推导动作权限、不发请求。
// 按钮铁律（详情按钮位 的唯一实现）：执行!==null 且 禁用说明===null
// 才可触发；否则真实 disabled，禁用说明可见并经 aria-describedby 关联到按钮 ——
// 不把禁用说明塞进按钮文案（无障碍名保持控制层给定文案）。

import { useId } from 'react';
import 样式 from './详情动作卡.module.css';
import type { 详情按钮, 详情动作卡信息 } from './类型';

/** 契约 A 按钮规则的唯一实现：不在展示层各抄一份。 */
export function 详情按钮位({ 按钮, 前缀 }: { 按钮: 详情按钮; 前缀: string }) {
  const 可触发 = 按钮.执行 !== null && 按钮.禁用说明 === null;
  const 说明id = 按钮.禁用说明 !== null ? `${前缀}-${按钮.键}` : undefined;
  return (
    <span className={样式.键槽}>
      <button
        type="button"
        className={可触发 ? `${样式[按钮.外观]} 可点` : 样式[按钮.外观]}
        disabled={!可触发}
        aria-describedby={说明id}
        onClick={按钮.执行 ?? undefined}
      >
        {按钮.文案}
      </button>
      {说明id !== undefined ? (
        <span id={说明id} className={样式.禁用说明}>
          {按钮.禁用说明}
        </span>
      ) : null}
    </span>
  );
}

export function 详情动作卡({ 信息 }: { 信息: 详情动作卡信息 }) {
  const 前缀 = useId();
  return (
    <div className={样式.卡}>
      <div className={样式.标题}>{信息.标题}</div>
      {信息.说明 !== null ? <div className={样式.说明}>{信息.说明}</div> : null}
      {信息.正文}
      {信息.按钮们.length > 0 ? (
        <div className={样式.键行}>
          {信息.按钮们.map((按钮) => (
            <详情按钮位 key={按钮.键} 按钮={按钮} 前缀={前缀} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
