// 匹配对齐卡(2026-08-26 用户定稿「甲-圆点行式」+ 现成适配环)——
// 匹配度分析的统一形态,四处共用:职位详情 / 在谈详情职位 Tab / 真人会话看职位层 /
// 简历正文(招聘端)。每行:圆点(命中=亮绿实心白勾,未命中=空心灰圈灰叉)+
// 要求行(对方原文,墨色重)+ 证据行(我方原文,浅色)。层级是用户明确定的:
// 「对方的要求应该是黑色的,匹配的一方的文字应该是浅色的」。

import 样式 from './匹配对齐卡.module.css';
import 适配环 from './适配环';
import type { 对齐行 } from '../数据/匹配对齐';

export function 匹配对齐卡({
  分,
  行们,
  藏环 = false,
}: {
  分: number;
  行们: 对齐行[];
  /** 同屏别处已有分数时藏掉环(如简历正文顶栏已带「匹配 94」),避免一屏两个分 */
  藏环?: boolean;
}) {
  if (行们.length === 0) return null;
  return (
    <>
      <div className={样式.头}>
        <span className={样式.标题}>匹配度分析</span>
        {藏环 ? null : <适配环 分={分} 标={null} 尺寸={44} />}
      </div>
      {行们.map((行) => (
        <div key={行.要求} className={样式.行}>
          {行.证据 ? (
            <span className={样式.命中点}>
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M2.6 7.4 L5.8 10.6 L11.4 3.8"
                  stroke="#fff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          ) : (
            <span className={样式.未中点}>
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path
                  d="M3 3 L9 9 M9 3 L3 9"
                  stroke="var(--弱化)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          )}
          <span className={样式.行文}>
            <span className={`${样式.要求} 单行`}>{行.要求}</span>
            {行.证据 ? <span className={`${样式.证据} 单行`}>{行.证据}</span> : null}
          </span>
        </div>
      ))}
    </>
  );
}
