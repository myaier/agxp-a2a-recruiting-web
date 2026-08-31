// 公司区块(共用,2026-08-26)—— 职位详情 / 在谈详情职位 Tab / 真人会话看职位层 /
// 企业端岗位详情 四处同用的加厚公司卡:头行(标志+名称) + 介绍段 + 元信息表
// (融资阶段/规模/行业/成立/地址)。用户指定"所有页面都要改",抽成一个组件改一次。
//
// 数据一律读 公司档案(与公司主页同源);合成兜底档案(信息待补充)时退回
// 调用方给的一行简介,不把占位空话摆上台面。整块可点,落点由调用方定
// (通常进企业详情;企业端岗位详情落自己的公司主页)。
//
// P1C Task 5:显式 资料 与可选 按下。Backend 一律走 资料 路径——介绍段/元行由
// 调用方从映射后的 view 传入,本组件不再替 Backend 读静态档案;canonical ref 与
// 不可用公开企业编号 在调用方共同决定 按下 是否存在,缺省时渲染同样 class 的
// 非交互 div(不渲染尖括号、不带 可点、不伪造链接)。资料 缺省保持旧 Mock 行为。

import type { ReactNode } from 'react';
import 样式 from './公司区块.module.css';
import { 公司字标 } from './通用';
import { 公司路由键, 取公司档案, type 公司档案 } from '../数据/公司档案';

/** 显式投影(P1C Task 5):Backend 调用方传入的介绍段与元行,组件不读静态档 */
export interface 公司区块资料 {
  介绍段: string | null;
  元行组: readonly { 标签: string; 值: string }[];
}

function 从静态档案构造元行组(
  档案: 公司档案,
  一行简介: string,
): readonly [string, string][] {
  const 档案未补全 = 档案.规模行 === '规模与融资信息待补充';
  // 规模行/一行简介按段识别,不按位置硬套:含「轮/上市」= 融资阶段,含「人」= 规模,
  // 其余 = 行业。在谈单的公司简介只有「融资 · 规模」两段,按内容认才不会整体降级
  const 简介段们 = (档案未补全 ? 一行简介 : 档案.规模行).split(' · ');
  const 认段 = (段: string) =>
    /轮|上市/.test(段) ? '融资阶段' : /人/.test(段) ? '规模' : '行业';
  const 成立年 = 档案.工商信息.find((条) => 条.项 === '成立日期')?.值.slice(0, 4);
  return 简介段们.length >= 2
    ? ([
        ...简介段们.map((段) => [认段(段), 段] as [string, string]),
        成立年 && !档案未补全 ? ['成立', `${成立年} 年`] : null,
        档案未补全 ? null : ['地址', 档案.地址],
      ].filter(Boolean) as [string, string][])
    : [];
}

export function 公司区块({
  名称,
  首字,
  一行简介,
  资料,
  按下,
  标志,
  children,
}: {
  名称: string;
  首字: string;
  /** 档案缺失时的兜底一行,约定格式「融资 · 规模 · 行业」(如拆不出三段则原样展示) */
  一行简介: string;
  /** 显式投影:存在时不调用 公司路由键()/取公司档案(),内容全由调用方负责 */
  资料?: 公司区块资料;
  /** 缺省时根元素是同样 class 的非交互 div(Backend 无 canonical ref / 不可用编号) */
  按下?: () => void;
  /** 自定义标志(如企业端已上传的 LOGO);缺省用黑底橄榄字的品牌字标 */
  标志?: ReactNode;
  /** 追加在元表之后的内容(如在谈详情的公司标签行) */
  children?: ReactNode;
}) {
  const 静态档案 = 资料 ? null : 取公司档案(公司路由键(名称));
  const 档案未补全 = 静态档案?.规模行 === '规模与融资信息待补充';
  const 介绍段 = 资料?.介绍段 ?? (档案未补全 ? null : 静态档案?.简介[0] ?? null);
  const 元行组: readonly [string, string][] = 资料
    ? 资料.元行组.map(({ 标签, 值 }) => [标签, 值] as const)
    : 从静态档案构造元行组(静态档案!, 一行简介);

  const 内容 = (
    <>
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
        {按下 ? <span className={样式.尖括号}>›</span> : null}
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
    </>
  );

  return 按下 ? (
    <button className={`${样式.区块} 可点`} onClick={按下}>
      {内容}
    </button>
  ) : (
    <div className={样式.区块}>{内容}</div>
  );
}
