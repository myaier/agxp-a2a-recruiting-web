// 匹配分析块(2026-08-31 用户定稿效果图「分析段 + 紧凑核对」)—— 求职端专用:
//   头行:标题 + 适配环(分从行来,由调用方用 算适配分 算好传入);
//   分析段:墨句讲强项、灰句讲缺口(模板或旗舰手写句,见 数据/匹配对齐);
//   核对表:每行一条 JD 硬性要求,单行排版 —— 左圆点 + 要求(墨),右侧简历证据(浅,右对齐)。
// 三态圆点:有证据 = 亮绿实心白勾;未提及 = 空心灰圈(没写≠不会,不打叉);
// 不满足 = 空心灰圈灰叉(只有硬字段确定性比较才会出现)。
// 招聘端仍用 组件/匹配对齐卡(2026-08-26 定稿两态卡),本组件不承接招聘面。

import 样式 from './匹配分析块.module.css';
import 适配环 from './适配环';
import type { 对齐行 } from '../数据/匹配对齐';

export function 匹配分析块({
  分,
  行们,
  分析,
  藏环 = false,
}: {
  分: number;
  行们: 对齐行[];
  分析: { 墨句: string; 灰句: string } | null;
  /** 同屏别处已有分数时藏掉环,避免一屏两个分(与旧对齐卡同一口径) */
  藏环?: boolean;
}) {
  if (行们.length === 0) return null;
  return (
    <>
      <div className={样式.头}>
        <span className={样式.标题}>匹配度分析</span>
        {藏环 ? null : <适配环 分={分} 标={null} 尺寸={44} />}
      </div>
      {分析 && (分析.墨句 || 分析.灰句) ? (
        <div className={样式.分析段}>
          {分析.墨句}
          {分析.灰句 ? <span className={样式.灰句}>{分析.灰句}</span> : null}
        </div>
      ) : null}
      {行们.map((行) => (
        <div key={行.要求} className={样式.行}>
          {行.态 === '有证据' ? (
            <span className={样式.点有}>
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M2.6 7.4 L5.8 10.6 L11.4 3.8"
                  stroke="#fff"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          ) : (
            <span className={样式.点空}>
              {行.态 === '不满足' ? (
                <svg width="8" height="8" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path
                    d="M3 3 L9 9 M9 3 L3 9"
                    stroke="var(--弱化)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              ) : null}
            </span>
          )}
          <span className={`${样式.要求} ${行.态 === '未提及' ? 样式.要求淡 : ''} 单行`}>
            {行.要求}
          </span>
          <span className={`${样式.证据} 单行`}>
            {行.态 === '有证据' ? 行.证据 : 行.态 === '未提及' ? '简历未提及' : '未达到要求'}
          </span>
        </div>
      ))}
    </>
  );
}
