// 公司区块(共用,2026-08-26)—— 职位详情 / 在谈详情职位 Tab / 真人会话看职位层 /
// 企业端岗位详情 四处同用的加厚公司卡:头行(标志+名称) + 介绍段 + 元信息表
// (融资阶段/规模/行业/成立/地址)。用户指定"所有页面都要改",抽成一个组件改一次。
//
// 数据一律读 公司档案(与公司主页同源);合成兜底档案(信息待补充)时退回
// 调用方给的一行简介,不把占位空话摆上台面。整块可点,落点由调用方定
// (通常进企业详情;企业端岗位详情落自己的公司主页)。

import type { ReactNode } from 'react';
import 样式 from './公司区块.module.css';
import { 公司字标 } from './通用';
import { 公司路由键, 取公司档案 } from '../数据/公司档案';

export function 公司区块({
  名称,
  首字,
  一行简介,
  按下,
  标志,
  children,
}: {
  名称: string;
  首字: string;
  /** 档案缺失时的兜底一行,约定格式「融资 · 规模 · 行业」(如拆不出三段则原样展示) */
  一行简介: string;
  按下: () => void;
  /** 自定义标志(如企业端已上传的 LOGO);缺省用黑底橄榄字的品牌字标 */
  标志?: ReactNode;
  /** 追加在元表之后的内容(如在谈详情的公司标签行) */
  children?: ReactNode;
}) {
  const 档案 = 取公司档案(公司路由键(名称));
  const 档案未补全 = 档案.规模行 === '规模与融资信息待补充';
  const 介绍段 = 档案未补全 ? null : 档案.简介[0];
  // 规模行/一行简介按段识别,不按位置硬套:含「轮/上市」= 融资阶段,含「人」= 规模,
  // 其余 = 行业。在谈单的公司简介只有「融资 · 规模」两段,按内容认才不会整体降级
  const 简介段们 = (档案未补全 ? 一行简介 : 档案.规模行).split(' · ');
  const 认段 = (段: string) =>
    /轮|上市/.test(段) ? '融资阶段' : /人/.test(段) ? '规模' : '行业';
  const 成立年 = 档案.工商信息.find((条) => 条.项 === '成立日期')?.值.slice(0, 4);
  const 元行组: [string, string][] =
    简介段们.length >= 2
      ? ([
          ...简介段们.map((段) => [认段(段), 段] as [string, string]),
          成立年 && !档案未补全 ? ['成立', `${成立年} 年`] : null,
          档案未补全 ? null : ['地址', 档案.地址],
        ].filter(Boolean) as [string, string][])
      : [];

  return (
    <button className={`${样式.区块} 可点`} onClick={按下}>
      <span className={样式.头行}>
        {标志 ?? (
          <公司字标
            首字={首字}
            尺寸={40}
            圆角={14}
            底色="var(--墨)"
            字色="var(--橄榄)"
            描边={false}
            字号={17}
          />
        )}
        <span className={`${样式.名称} 单行`}>{名称}</span>
        <span className={样式.尖括号}>›</span>
      </span>
      {介绍段 ? <span className={样式.介绍段}>{介绍段}</span> : null}
      {元行组.length > 0 ? (
        <span className={样式.元表}>
          {元行组.map(([标, 值]) => (
            <span key={标} className={样式.元行}>
              <span className={样式.元标}>{标}</span>
              <span className={`${样式.元值} 单行`}>{值}</span>
            </span>
          ))}
        </span>
      ) : (
        <span className={样式.兜底简介}>{一行简介}</span>
      )}
      {children}
    </button>
  );
}
