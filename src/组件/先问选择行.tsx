// 「哪些事先问你」的选择行(2026-08-31 用户定稿):标题 + 小注在左,双选胶囊在右。
// 页面上只放真选项 —— 铁律类(本来就会问/本来就不做)一律不渲染成设置,见定稿讨论。
// 两端同构:AI代理设置(企业) 与 规则库(求职) 共用,改一次两端生效。

import 样式 from './先问选择行.module.css';

export function 先问选择行<选 extends string>({
  标题,
  注,
  值,
  选项,
  选择,
  末行 = false,
  禁用 = false,
}: {
  标题: string;
  注?: string;
  值: 选;
  选项: readonly 选[];
  选择: (值: 选) => void;
  末行?: boolean;
  禁用?: boolean;
}) {
  return (
    <div className={`${样式.行} ${末行 ? 样式.末行 : ''}`}>
      <div className={样式.文字区}>
        <div className={样式.标题}>{标题}</div>
        {注 ? <div className={样式.注}>{注}</div> : null}
      </div>
      <div className={样式.选组} role="group" aria-label={标题}>
        {选项.map((项) => (
          <button
            key={项}
            type="button"
            className={`${样式.选项} ${项 === 值 ? 样式.选中 : ''} 可点`}
            aria-pressed={项 === 值}
            disabled={禁用}
            onClick={() => 选择(项)}
          >
            {项}
          </button>
        ))}
      </div>
    </div>
  );
}
