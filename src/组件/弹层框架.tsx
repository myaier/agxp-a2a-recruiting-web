import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

interface 属性 {
  标签: string;
  遮罩类名: string;
  面板类名: string;
  关闭: () => void;
  children: ReactNode;
  层级?: number;
  /** 底部 = 抽屉(滚轮/筛选等,默认);居中 = 确认框。
      各屏 CSS 里早就写了居中的遮罩样式,但面板被这里的内联 bottom:0 钉在底部,
      CSS 从未生效 —— 2026-08-31 用户定稿确认框改居中,位置从此由本参数决定 */
  位置?: '底部' | '居中';
}

/**
 * 全应用统一的可关闭弹层骨架：可聚焦遮罩 + 原生 dialog + Escape 关闭 + 焦点恢复。
 * 业务组件只负责面板内容，避免每屏重复写不可键盘操作的 click-div。
 *
 * picker 统一 Task 1：底部面板不再内联 maxHeight:'none' —— caller CSS 的限高
 * （如 经历行业选择层 的 72%）重新生效，长列表在面板内滚动而不是把弹层顶出屏幕。
 * 居中分支保持 maxHeight:'none' 不限高。
 */
export default function 弹层框架({ 标签, 遮罩类名, 面板类名, 关闭, children, 层级 = 81, 位置 = '底部' }: 属性) {
  const 对话框 = useRef<HTMLDialogElement>(null);

  // 最新关闭回调经 ref 提供给 Escape：首开聚焦/焦点恢复 effect 只在挂载与卸载各跑一次，
  // 不再以每次关闭函数变化重跑 —— 父层每次重渲染不会把焦点重新抓回首控件。
  const 关闭引用 = useRef(关闭);
  关闭引用.current = 关闭;

  useEffect(() => {
    const 原焦点 = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const 处理按键 = (事件: KeyboardEvent) => {
      if (事件.key === 'Escape') {
        事件.preventDefault();
        关闭引用.current();
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
    // 焦点圈/Escape/恢复只在首开与卸载成立；关闭 经 关闭引用 读取最新值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 居中面板不能用 transform 定位:确认框的放大动画(animation both)会在收尾时
  // 用 scale(1) 覆盖内联 transform,面板会跳回原位。所以用 flex 容器包一层来居中,
  // 容器 pointer-events:none 让点空白处仍落在下层遮罩按钮上。
  const 面板样式: CSSProperties =
    位置 === '居中'
      ? { position: 'static', width: '100%', margin: 0, border: 0, maxWidth: 'none', maxHeight: 'none', pointerEvents: 'auto' }
      : { position: 'absolute', left: 0, right: 0, bottom: 0, margin: 0, border: 0, maxWidth: 'none', zIndex: 层级 };
  const 面板 = (
    <dialog
      ref={对话框}
      open
      aria-label={标签}
      aria-modal="true"
      tabIndex={-1}
      className={面板类名}
      style={面板样式}
    >
      {children}
    </dialog>
  );
  return (
    <>
      <button type="button" className={遮罩类名} onClick={关闭} aria-label={`关闭${标签}`} />
      {位置 === '居中' ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 28px',
            zIndex: 层级,
            pointerEvents: 'none',
          }}
        >
          {面板}
        </div>
      ) : (
        面板
      )}
    </>
  );
}