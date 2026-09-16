// 历史代谈展示 —— 四入口（求职/招聘 × Mock/Backend）共用的历史列表壳与卡（S0–S3 展示统一
// Task 2，Spec §4/§9）。视觉基准 = Mock 归档卡；版式/间距/阅读顺序只在此一处定义。
// 边界：本组件只持展示 —— 不读 Context、不判断数据来源、不发请求、不排序列表。加载态/
// 空态/错误行/数量说明由各连接层组合后作为 children 传入；卡只吃显式展示参数
// （历史代谈卡信息），结果色调按调用方给的明确事实渲染，不 here 猜模式。

import { useState } from 'react';
import { 次级页外壳, 返回栏, 滚动区 } from './通用';
import { 人像图标 } from './图标';
import 样式 from './历史代谈展示.module.css';

/** 一张历史卡的全部展示参数。结果色调按明确事实给出；画像/时间/媒体可缺。 */
export interface 历史代谈卡信息 {
  键: string; 标题: string; 职位: string; 画像: string | null;
  图片URL: string | null; 字标: string | null;
  结果: { 文案: string; 色调: '成功' | '提醒' | '中性' };
  原因: string; 阶段说明: string; 时间说明: string | null;
  打开: () => void;
}

const 结果色调类名: Record<历史代谈卡信息['结果']['色调'], string> = {
  成功: 样式.结果成功,
  提醒: 样式.结果提醒,
  中性: 样式.结果中性,
};

/**
 * 历史卡：字标/媒体位 → 标题＋结果标签 → 职位 → 招聘侧画像 → 原因灰块 →
 * 阶段说明＋时间＋「回看往来 ›」。画像/时间说明为 null 时该行位缺席，其余结构不变；
 * 媒体位：真实图片在场则渲染（加载失败回中性图位），否则演示字标，都缺给中性图位。
 */
export function 历史代谈卡(props: { 信息: 历史代谈卡信息 }): React.ReactElement {
  const { 信息 } = props;
  // 图片加载失败只影响这一张卡，回中性图位，不留裂图
  const [图片失败, 设图片失败] = useState(false);
  return (
    <button className={`${样式.归档卡} 可点`} onClick={信息.打开}>
      <span className={样式.字标}>
        {信息.图片URL !== null && !图片失败 ? (
          <img
            className={样式.媒体图}
            src={信息.图片URL}
            alt=""
            onError={() => 设图片失败(true)}
          />
        ) : 信息.字标 !== null ? (
          信息.字标
        ) : (
          <span className={样式.中性图位} aria-hidden="true">
            <人像图标 尺寸={18} 色="var(--最弱)" />
          </span>
        )}
      </span>
      <span className={样式.归档主体}>
        <span className={样式.归档头行}>
          <span className={`${样式.归档公司} 单行`}>{信息.标题}</span>
          <span className={`${样式.结果标} ${结果色调类名[信息.结果.色调]}`}>{信息.结果.文案}</span>
        </span>
        <span className={`${样式.归档职位} 单行`}>{信息.职位}</span>
        {信息.画像 !== null ? <span className={样式.画像}>{信息.画像}</span> : null}
        <span className={样式.归档原因}>{信息.原因}</span>
        <span className={样式.归档底行}>
          <span className={样式.归档止步}>{信息.阶段说明}</span>
          {信息.时间说明 !== null ? (
            <span className={样式.归档时间}>{信息.时间说明}</span>
          ) : null}
          <span className={样式.归档回看}>回看往来 ›</span>
        </span>
      </span>
    </button>
  );
}

/**
 * 历史列表壳：返回栏（标题「历史代谈」＋可选数量说明副标题）＋ Spec §4.1 固定说明条 ＋
 * 14px 18px 24px 滚动内边距。数量说明由连接层按各自事实给（Mock 精确总数「N 单已结束」、
 * Backend「已加载 N 单」，加载未开始给 null 不显示假零）。
 */
export function 历史代谈外壳(props: {
  返回: () => void;
  数量说明: string | null;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <次级页外壳>
      <返回栏 返回={props.返回} 标题="历史代谈" 副标题={props.数量说明 ?? undefined} />
      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        <div className={样式.说明条}>
          历史代谈保留往来记录，可回看进度与结果；能否继续以详情页当前可用操作为准。
        </div>
        {props.children}
      </滚动区>
    </次级页外壳>
  );
}
