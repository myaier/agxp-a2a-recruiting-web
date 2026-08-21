import { useEffect, useRef, type ReactNode } from 'react';

interface 属性 {
  标签: string;
  遮罩类名: string;
  面板类名: string;
  关闭: () => void;
  children: ReactNode;
  层级?: number;
}

/**
 * 全应用统一的可关闭弹层骨架：可聚焦遮罩 + 原生 dialog + Escape 关闭 + 焦点恢复。
 * 业务组件只负责面板内容，避免每屏重复写不可键盘操作的 click-div。
 */
export default function 弹层框架({ 标签, 遮罩类名, 面板类名, 关闭, children, 层级 = 81 }: 属性) {
  const 对话框 = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const 原焦点 = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const 处理按键 = (事件: KeyboardEvent) => {
      if (事件.key === 'Escape') {
        事件.preventDefault();
        关闭();
        return;
      }
      if (事件.key !== 'Tab') return;
      const 可聚焦 = Array.from(
        对话框.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
        ) ?? []
      );
      if (可聚焦.length === 0) {
        事件.preventDefault();
        对话框.current?.focus();
        return;
      }
      const 首个 = 可聚焦[0];
      const 末个 = 可聚焦[可聚焦.length - 1];
      if (事件.shiftKey && document.activeElement === 首个) {
        事件.preventDefault();
        末个.focus();
      } else if (!事件.shiftKey && document.activeElement === 末个) {
        事件.preventDefault();
        首个.focus();
      }
    };
    document.addEventListener('keydown', 处理按键);
    const 首个控件 = 对话框.current?.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
    );
    首个控件?.focus();
    return () => {
      document.removeEventListener('keydown', 处理按键);
      原焦点?.focus();
    };
  }, [关闭]);

  return (
    <>
      <button type="button" className={遮罩类名} onClick={关闭} aria-label={`关闭${标签}`} />
      <dialog
        ref={对话框}
        open
        aria-label={标签}
        aria-modal="true"
        tabIndex={-1}
        className={面板类名}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          margin: 0,
          border: 0,
          maxWidth: 'none',
          maxHeight: 'none',
          zIndex: 层级,
        }}
      >
        {children}
      </dialog>
    </>
  );
}
