// P2 Task 4：附件简历真实 PDF 预览钩子（设计 §8.3）。
// BFF 下载带 Content-Disposition: attachment，直接导航会被当下载：固定流程为
//   1. 用户点击 handler 同步预开 about:blank 空白窗口并立刻隔离 opener（当帧拿到新窗口才不被拦）；
//   2. await 下载附件简历(fileId)；成功为 Blob 建 object URL；
//   3. popup 存在则 location.replace(url) 导航过去，被拦（null）则用 rel=noopener 的
//      临时 anchor 兜底；两者都把预开窗口/新标签留在浏览器原生 PDF 预览上；
//   4. 生命周期 timer 两两并存：popup load 只新增 5 秒延迟回收（不立即 revoke、不取消硬兜底），
//      创建时另留 30 秒有界硬兜底；unmount 立即回收仍存活的资源；
//   5. 下载失败关闭预开窗口并 轻提示(附件错误文案(...))。
// object URL / Blob 只活在模块闭包里：绝不进 React state、Provider 或任何存储。

import { useEffect, useRef } from 'react';
import { use应用状态 } from '../状态/应用状态';
import type { BFF附件简历库 } from '../数据/BFF契约';
import { 附件错误文案 } from './附件简历交互';
import { 轻提示 } from '../组件/轻提示';

/** 每个已打开的 PDF 资源：object URL + 两个并存的生命周期 timer。 */
interface 预览资源 {
  url: string;
  hardTimer: ReturnType<typeof setTimeout> | null;
  loadTimer: ReturnType<typeof setTimeout> | null;
}

const 已回收资源 = new WeakSet<预览资源>();

/** 幂等释放（load timer / 硬兜底 / unmount 共用）：清两个 timer，URL 恰好 revoke 一次。 */
function 释放(资源: 预览资源): void {
  if (已回收资源.has(资源)) return;
  已回收资源.add(资源);
  if (资源.hardTimer !== null) { clearTimeout(资源.hardTimer); 资源.hardTimer = null; }
  if (资源.loadTimer !== null) { clearTimeout(资源.loadTimer); 资源.loadTimer = null; }
  URL.revokeObjectURL(资源.url);
}

export function use附件PDF预览(): { 打开附件PDF(fileId: string): Promise<void> } {
  const { 后端状态, 操作 } = use应用状态();
  const 操作引用 = useRef(操作);
  操作引用.current = 操作;
  const limits引用 = useRef<BFF附件简历库['limits'] | null>(后端状态.附件简历库?.limits ?? null);
  limits引用.current = 后端状态.附件简历库?.limits ?? null;
  const 活动资源 = useRef<预览资源[]>([]);

  useEffect(() => {
    const 资源表 = 活动资源.current;
    return () => {
      for (const 资源 of 资源表) 释放(资源);
      资源表.length = 0;
    };
  }, []);

  const 打开附件PDF = async (fileId: string): Promise<void> => {
    const 预览 = window.open('about:blank', '_blank');
    if (预览) 预览.opener = null;
    try {
      const blob = await 操作引用.current.下载附件简历(fileId);
      const url = URL.createObjectURL(blob);
      const 资源: 预览资源 = { url, hardTimer: null, loadTimer: null };
      活动资源.current.push(资源);
      资源.hardTimer = setTimeout(() => 释放(资源), 30000);
      if (预览) {
        预览.location.replace(url);
        预览.addEventListener('load', () => {
          资源.loadTimer = setTimeout(() => 释放(资源), 5000);
        });
      } else {
        const 锚 = document.createElement('a');
        锚.href = url;
        锚.target = '_blank';
        锚.rel = 'noopener';
        document.body.appendChild(锚);
        锚.click();
        锚.remove();
      }
    } catch (error) {
      预览?.close();
      轻提示(附件错误文案(error, limits引用.current));
    }
  };

  return { 打开附件PDF };
}
