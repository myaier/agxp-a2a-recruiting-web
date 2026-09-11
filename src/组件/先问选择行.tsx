import { useCallback, useState } from 'react';
import 弹层框架 from './弹层框架';
import 样式 from './先问选择行.module.css';

/** 授权整行打开底部单选面板；当前值来自调用方的持久化状态。 */
export function 先问选择行<选 extends string>({ 标题, 注, 值, 选项, 选择, 末行 = false, 禁用 = false }: {
  标题: string; 注?: string; 值: 选; 选项: readonly 选[];
  选择: (值: 选) => void; 末行?: boolean; 禁用?: boolean;
}) {
  const [打开, 设打开] = useState(false);
  const 关闭 = useCallback(() => 设打开(false), []);
  return <>
    <button className={`${样式.行} ${末行 ? 样式.末行 : ''}`} disabled={禁用} onClick={() => 设打开(true)} aria-label={`${标题}，${值}`}>
      <span className={样式.文字区}><span className={样式.标题}>{标题}</span>{注 ? <span className={样式.注}>{注}</span> : null}</span>
      <span className={样式.当前}>{值}<svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="m1 1 5 5-5 5" /></svg></span>
    </button>
    {打开 ? <弹层框架 标签={标题} 遮罩类名={样式.遮罩} 面板类名={样式.面板} 关闭={关闭}>
      <div className={样式.把手} /><div className={样式.面板头}><h2>{标题}</h2><button aria-label="关闭" onClick={关闭}>×</button></div>
      {注 ? <p className={样式.说明}>{注}</p> : null}
      <div role="group" aria-label={标题}>{选项.map(项 => <button key={项} className={样式.选项} disabled={禁用} aria-pressed={项 === 值} onClick={() => 选择(项)}>{项}{项 === 值 ? <span aria-hidden="true">✓</span> : null}</button>)}</div>
    </弹层框架> : null}
  </>;
}
