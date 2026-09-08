// 去名改版（定稿 2026-09-08）：候选卡头行的性别裸符号 —— ♂ / ♀ 线描 SVG（性别图标）。
// 合同 = 定稿实现文档「四件待定的处理」1：viewBox 16×16、fill none、stroke currentColor /
// 1.7 / round / round、渲染 16px、role=img + aria-label 男/女、颜色走 --性别男 / --性别女 令牌、
// 性别 缺省渲染 null。只测组件本身；卡面上的位置（头行最前、右距 5px）由两张卡的屏幕测试覆盖。
// 注：仓库未装 @testing-library/jest-dom，用 toBe / toBeNull 直接断言属性。

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { 性别图标 } from './图标';

/** 容器里唯一的 svg（没有就直接抛，避免后面一串 undefined 断言看不懂） */
function 取svg(容器: HTMLElement): SVGElement {
  const svg = 容器.querySelector('svg');
  if (!svg) throw new Error('性别图标没有渲染出 <svg>');
  return svg;
}

/** 线描属性可能写在 <svg> 根上，也可能写在内层 <g> 上：先看根，再看后代 */
function 线描属性(svg: SVGElement, 名: string): string | null {
  return svg.getAttribute(名) ?? svg.querySelector(`[${名}]`)?.getAttribute(名) ?? null;
}

const 路径表 = (svg: SVGElement) =>
  Array.from(svg.querySelectorAll('path')).map((路径) => 路径.getAttribute('d') ?? '');

describe('性别图标 · 裸符号线描（定稿 2026-09-08）', () => {
  it('验收5 · 性别=男：role=img、aria-label 男、含 M9.2 6.8 路径、圆 (6.4, 9.6) r 3.9、色走 --性别男', () => {
    const { container } = render(<性别图标 性别="男" />);
    const svg = 取svg(container);
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('男');
    expect(screen.getByRole('img', { name: '男' })).toBe(svg);
    // 男符 = 圆 + 右上箭头；不得混入女符的竖线十字
    expect(路径表(svg).some((d) => d.includes('M9.2 6.8'))).toBe(true);
    expect(路径表(svg).some((d) => d.includes('M8 9.8'))).toBe(false);
    const 圆 = svg.querySelector('circle');
    expect(圆?.getAttribute('cx')).toBe('6.4');
    expect(圆?.getAttribute('cy')).toBe('9.6');
    expect(圆?.getAttribute('r')).toBe('3.9');
    expect(container.innerHTML).toContain('--性别男');
    expect(container.innerHTML).not.toContain('--性别女');
  });

  it('验收5 · 性别=女：role=img、aria-label 女、含 M8 9.8 路径、圆 (8, 5.9) r 3.9、色走 --性别女', () => {
    const { container } = render(<性别图标 性别="女" />);
    const svg = 取svg(container);
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('女');
    expect(screen.getByRole('img', { name: '女' })).toBe(svg);
    // 女符 = 圆 + 下方十字；不得混入男符的箭头
    expect(路径表(svg).some((d) => d.includes('M8 9.8'))).toBe(true);
    expect(路径表(svg).some((d) => d.includes('M9.2 6.8'))).toBe(false);
    const 圆 = svg.querySelector('circle');
    expect(圆?.getAttribute('cx')).toBe('8');
    expect(圆?.getAttribute('cy')).toBe('5.9');
    expect(圆?.getAttribute('r')).toBe('3.9');
    expect(container.innerHTML).toContain('--性别女');
    expect(container.innerHTML).not.toContain('--性别男');
  });

  it('验收5 · 性别 缺省：渲染 null（不留空壳、没有 role=img）', () => {
    const { container } = render(<性别图标 性别={undefined} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('SVG 规格：viewBox 0 0 16 16、fill none、stroke currentColor / 1.7 / round / round、默认 16px、尺寸 可调', () => {
    const { container } = render(<性别图标 性别="男" />);
    const svg = 取svg(container);
    expect(svg.getAttribute('viewBox')).toBe('0 0 16 16');
    expect(线描属性(svg, 'fill')).toBe('none');
    expect(线描属性(svg, 'stroke')).toBe('currentColor');
    expect(线描属性(svg, 'stroke-width')).toBe('1.7');
    expect(线描属性(svg, 'stroke-linecap')).toBe('round');
    expect(线描属性(svg, 'stroke-linejoin')).toBe('round');
    expect(svg.getAttribute('width')).toBe('16');
    expect(svg.getAttribute('height')).toBe('16');

    const 放大 = render(<性别图标 性别="女" 尺寸={20} />);
    const 大svg = 取svg(放大.container);
    expect(大svg.getAttribute('width')).toBe('20');
    expect(大svg.getAttribute('height')).toBe('20');
    expect(大svg.getAttribute('viewBox')).toBe('0 0 16 16'); // 尺寸只改渲染框，不改坐标系
  });
});
