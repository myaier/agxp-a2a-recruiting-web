// 聊天气泡：AI 助手与双端真人聊天共用的最小纯展示基础（Spec §11.5）。
// 只负责左右行向、头像槽、气泡外观、内容宽度与气泡外下方时间；正文由 聊天正文
// 渲染（text 纯文本 / markdown 安全渲染）。不认识消息来源、权限、状态机或导航，
// 端差/页差由调用方用 类名 / 气泡类名 叠加，头像仍由调用方构造。
//
// 宽度口径：普通短气泡 width: fit-content 不铺满剩余行；长文到列上限后换行
// （min-width: 0 + overflow-wrap: anywhere 防无空格长串撑破）；宽内容（AI 带 cards
// 的简报容器）显式 stretch 回整列。时间住在气泡列内、气泡之下的兄弟节点，
// 不强迫气泡拉伸。时间无效（无法解析）不生成节点、绝不虚构当前时间。

import type { ReactNode } from 'react';
// react-markdown 10 的运行时入口只以 default 别名导出同步 Markdown 组件（d.ts 的
// 具名 Markdown 与运行时不同步），这里用默认导入拿同步组件
import Markdown from 'react-markdown';
import 样式 from './聊天气泡.module.css';

export interface 聊天气泡属性 {
  方: '我方' | '对方';
  头像: ReactNode;
  时间?: string | null; // RFC3339；省略时无空时间节点
  宽内容?: boolean; // 默认 false；仅 AI 有 cards 时 true
  类名?: string; // 现有外观适配，不允许业务含义
  气泡类名?: string;
  children: ReactNode;
}

/** 一行聊天：对方头像在左、我方头像在右，气泡与时间同居一列。 */
export function 聊天气泡({
  方,
  头像,
  时间,
  宽内容 = false,
  类名,
  气泡类名,
  children,
}: 聊天气泡属性): React.ReactElement {
  // 时间节点只在有合法可显示文本时生成：空串/无效串都不产生空节点
  const 时间文本 = 时间 ? 格式化聊天时间(时间) : '';
  const 原始时间串 = 时间文本 ? (时间 as string) : null;
  const 气泡列 = (
    <div className={样式.气泡列}>
      <div
        className={[样式.气泡, 宽内容 ? 样式.宽内容 : '', 气泡类名 ?? '']
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>
      {原始时间串 ? (
        <time dateTime={原始时间串} className={`${样式.时间} 等宽数字`}>
          {时间文本}
        </time>
      ) : null}
    </div>
  );
  const 头像槽 = <div className={样式.头像槽}>{头像}</div>;
  const 行类 = [方 === '我方' ? 样式.我方 : 样式.对方, 类名].filter(Boolean).join(' ');
  return (
    <div className={行类}>
      {方 === '对方' ? (
        <>
          {头像槽}
          {气泡列}
        </>
      ) : (
        <>
          {气泡列}
          {头像槽}
        </>
      )}
    </div>
  );
}

/** 消息正文：text 保留原文换行（pre-wrap），markdown 走 react-markdown 安全渲染。
 *  skipHtml 丢弃原始 HTML 节点；链接沿用默认 URL 白名单转换（javascript: 等被剥除）；
 *  图片标记只呈现 alt 文本 —— 消息附件不在本轮范围，不为气泡加载外部图片。 */
export function 聊天正文(props: {
  内容: string;
  格式: 'text' | 'markdown';
  类名?: string;
}): React.ReactElement {
  const { 内容, 格式, 类名 } = props;
  if (格式 === 'text') {
    return <span className={[样式.纯文本, 类名].filter(Boolean).join(' ')}>{内容}</span>;
  }
  return (
    <div className={[样式.正文, 类名].filter(Boolean).join(' ')}>
      <Markdown skipHtml components={{ img: 仅替代文字 }}>
        {内容}
      </Markdown>
    </div>
  );
}

// 图片 → 只留 alt 文本（无图节点、无网络请求）；alt 缺省时不渲染占位
function 仅替代文字({ alt }: { alt?: string | null }) {
  return <>{alt ?? ''}</>;
}

/** 气泡下时间：设备本地时区 MM-DD HH:mm，非当前年带年份 YYYY-MM-DD HH:mm。
 *  无效输入只返回空字符串；可选 当前年 仅供纯函数测试可控，不是产品设置项。 */
export function 格式化聊天时间(iso: string, 当前年?: number): string {
  const 时刻 = new Date(iso);
  if (Number.isNaN(时刻.getTime())) return '';
  const 两位 = (值: number) => String(值).padStart(2, '0');
  const 月日时分 = `${两位(时刻.getMonth() + 1)}-${两位(时刻.getDate())} ${两位(
    时刻.getHours(),
  )}:${两位(时刻.getMinutes())}`;
  return 时刻.getFullYear() === (当前年 ?? new Date().getFullYear()) ? 月日时分 : `${时刻.getFullYear()}-${月日时分}`;
}
