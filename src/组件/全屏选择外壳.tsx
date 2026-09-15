// 全屏选择外壳（Task 1，Plan 冻结的 A 契约）：本批五个全屏选择入口共用的轻量壳。
//
// 壳是已有 次级页外壳 的内容兄弟（flex:1; min-height:0），不是第二个带顶部安全区的
// 次级页外壳：顶部安全区由父层的 次级页外壳 提供，壳内只有 返回栏（标题固定）
// + 纵向 flex 正文，满高/溢出/底部安全区见 ./全屏选择外壳.module.css。
//
// 壳只管交互边界，不管业务：role="dialog" + aria-modal + 可访问名称（= 标题）、
// 首次焦点在返回按钮、Tab/Shift+Tab 限于子视图、Escape 调用 关闭。
// 父层负责隐藏自己以及关闭后的焦点/滚动恢复 —— 所以壳卸载时刻意不恢复焦点
// （不得抢先 focus 尚未显示的父元素），壳也不收任何父状态/模式参数。

import { useEffect, useRef, type ReactNode } from 'react';
import { 返回栏 } from './通用';
import 样式 from './全屏选择外壳.module.css';

export function 全屏选择外壳({ 标题, 关闭, children }: { 标题: string; 关闭: () => void; children: ReactNode }) {
  const 盒引用 = useRef<HTMLDivElement>(null);
  // 最新 关闭 经 ref 给 Escape：焦点/Escape effect 只在挂载跑一次，父层重渲染不重挂
  const 关闭引用 = useRef(关闭);
  关闭引用.current = 关闭;

  useEffect(() => {
    // 首次焦点在返回按钮（返回栏 的返回键是壳内第一个可聚焦控件）
    盒引用.current?.querySelector<HTMLButtonElement>('button[aria-label="返回"]')?.focus();
    const 处理按键 = (事件: KeyboardEvent) => {
      if (事件.key === 'Escape') {
        事件.preventDefault();
        关闭引用.current();
        return;
      }
      if (事件.key !== 'Tab') return;
      const 可聚焦 = Array.from(
        盒引用.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ) ?? [],
      );
      if (可聚焦.length === 0) {
        事件.preventDefault();
        盒引用.current?.focus();
        return;
      }
      const 首个 = 可聚焦[0]!;
      const 末个 = 可聚焦[可聚焦.length - 1]!;
      if (事件.shiftKey && document.activeElement === 首个) {
        事件.preventDefault();
        末个.focus();
      } else if (!事件.shiftKey && document.activeElement === 末个) {
        事件.preventDefault();
        首个.focus();
      }
    };
    // 监听挂 window（同 工作城市选择正文 的做法）：页面任何层级冒泡的按键都能收到
    window.addEventListener('keydown', 处理按键);
    return () => window.removeEventListener('keydown', 处理按键);
    // 首焦点/焦点圈/Escape 只在挂载成立；关闭 经 关闭引用 读取最新值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 刻意没有卸载时的焦点恢复：父页在 wrapper 恢复显示后自行 focus 触发元素（A 契约）
  return (
    <div ref={盒引用} role="dialog" aria-modal="true" aria-label={标题} tabIndex={-1} className={样式.壳}>
      <返回栏 返回={关闭} 标题={标题} />
      <div className={样式.正文}>{children}</div>
    </div>
  );
}
