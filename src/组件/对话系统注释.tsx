// 共用灰色系统注释（S0–S3 展示统一 Task 3）：原 Mock 往来记录 屏内的「系统胶囊」
// 提取成共享组件（Spec §9 组件边界 2），原两个往来记录消费者与 阶段对话流 的
// 注释 记录共用同一版式 —— 同一灰色居中胶囊，长文换行不溢出。
//
// 标签 / 时间可选（往往来记录只传内容，视觉与原胶囊逐字一致）；有的那段才进
// 「标签 · 时间」头行。组件不排序、不计数：展示顺序完全由调用方给的数组决定。

import 样式 from './对话系统注释.module.css';

export default function 对话系统注释({
  内容,
  标签 = null,
  时间 = null,
}: {
  内容: string;
  标签?: string | null;
  时间?: string | null;
}) {
  const 头 = [标签, 时间]
    .filter((段) => 段 !== null && 段 !== '')
    .join(' · ');
  return (
    <div className={样式.注释行}>
      <span className={样式.注释胶囊}>
        {头 ? <span className={样式.注释头}>{头}</span> : null}
        <span className={样式.注释文}>{内容}</span>
      </span>
    </div>
  );
}
