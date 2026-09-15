// 详情动作卡 —— 阶段动作区的纯展示卡（契约 A）。标题/说明/正文/按钮全部由控制层的
// 详情动作卡信息 给定：本组件不读 Context/fixture、不推导动作权限、不发请求。
// 按钮铁律（详情按钮位 的唯一实现）：执行!==null 且 禁用说明===null
// 才可触发；否则真实 disabled，禁用说明可见并经 aria-describedby 关联到按钮 ——
// 不把禁用说明塞进按钮文案（无障碍名保持控制层给定文案）。

import { useId } from 'react';
import 样式 from './详情动作卡.module.css';
import type { 详情按钮, 详情动作卡信息, 详情勾选位, 详情输入位 } from './类型';

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

/** 卡内输入位：标签与输入真实关联（label htmlFor），禁用时说明可见并经 aria 关联。 */
function 卡内输入({ 输入, 前缀 }: { 输入: 详情输入位; 前缀: string }) {
  const id = `${前缀}-输入-${输入.键}`;
  const 说明id = 输入.说明 !== null || 输入.禁用说明 !== null ? `${id}-说明` : undefined;
  const 禁用 = 输入.禁用说明 !== null;
  return (
    <span className={样式.输入位}>
      <label className={样式.输入标签} htmlFor={id}>{输入.标签}</label>
      {输入.多行 ? (
        <textarea
          id={id}
          className={样式.输入框}
          rows={3}
          value={输入.值}
          placeholder={输入.占位}
          disabled={禁用}
          aria-describedby={说明id}
          onChange={(事件) => 输入.改变(事件.target.value)}
        />
      ) : (
        <input
          id={id}
          className={样式.输入框}
          type="text"
          value={输入.值}
          placeholder={输入.占位}
          disabled={禁用}
          aria-describedby={说明id}
          onChange={(事件) => 输入.改变(事件.target.value)}
        />
      )}
      {说明id !== undefined ? (
        <span id={说明id} className={样式.禁用说明}>{输入.禁用说明 ?? 输入.说明}</span>
      ) : null}
    </span>
  );
}

/** 卡内勾选位：勾选框与标签同一可点区域，说明另起一行。 */
function 卡内勾选({ 勾选 }: { 勾选: 详情勾选位 }) {
  return (
    <span className={样式.输入位}>
      <label className={样式.勾选行}>
        <input
          type="checkbox"
          checked={勾选.选中}
          onChange={(事件) => 勾选.切换(事件.target.checked)}
        />
        <span>{勾选.标签}</span>
      </label>
      {勾选.说明 !== null ? <span className={样式.禁用说明}>{勾选.说明}</span> : null}
    </span>
  );
}

export function 详情动作卡({ 信息 }: { 信息: 详情动作卡信息 }) {
  const 前缀 = useId();
  return (
    <div className={样式.卡}>
      <div className={样式.标题}>{信息.标题}</div>
      {信息.说明 !== null ? <div className={样式.说明}>{信息.说明}</div> : null}
      {(信息.提示们 ?? []).map((提示) => (
        <div key={提示} className={样式.说明}>{提示}</div>
      ))}
      {信息.正文}
      {(信息.输入们 ?? []).map((输入) => (
        <卡内输入 key={输入.键} 输入={输入} 前缀={前缀} />
      ))}
      {(信息.勾选们 ?? []).map((勾选) => (
        <卡内勾选 key={勾选.键} 勾选={勾选} />
      ))}
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
