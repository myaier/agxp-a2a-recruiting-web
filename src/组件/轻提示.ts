// 全局轻提示（toast）：原型里「还没打通的功能」点了至少给个反馈，杜绝死按钮。
// 纯 DOM 实现不走 React —— 任何屏一行 轻提示('文案') 即用，无需挂组件、无需上下文。

let 容器: HTMLDivElement | null = null;

export function 轻提示(文案: string) {
  if (!容器) {
    容器 = document.createElement('div');
    Object.assign(容器.style, {
      position: 'fixed',
      left: '0',
      right: '0',
      bottom: '18%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      pointerEvents: 'none',
      zIndex: '999',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(容器);
  }

  const 条 = document.createElement('div');
  条.textContent = 文案;
  Object.assign(条.style, {
    background: 'rgba(26,26,26,0.86)',
    color: '#fff',
    fontSize: '12.5px',
    lineHeight: '1.6',
    padding: '8px 16px',
    borderRadius: '999px',
    maxWidth: '78%',
    textAlign: 'center',
    opacity: '0',
    transform: 'translateY(6px)',
    transition: 'opacity .18s ease, transform .18s ease',
  } satisfies Partial<CSSStyleDeclaration>);
  容器.appendChild(条);

  requestAnimationFrame(() => {
    条.style.opacity = '1';
    条.style.transform = 'translateY(0)';
  });
  setTimeout(() => {
    条.style.opacity = '0';
    条.style.transform = 'translateY(6px)';
    setTimeout(() => 条.remove(), 220);
  }, 1800);
}
