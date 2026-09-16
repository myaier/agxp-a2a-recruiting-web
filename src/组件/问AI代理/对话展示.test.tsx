// 对话展示 的受控展示契约：换 props 直接换内容（不把初值复制成不可更新的 state），
// 快捷项点击只调用被点那一项的回调。纯内存组件，无需任何 Provider。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { 代理气泡, 代理气泡框, 我方气泡, 快捷操作行 } from './对话展示';
import 样式 from './对话展示.module.css';

// jsdom 不加载模块 CSS，要钉选择器形状只能读源码文本（vitest 以仓库根为 cwd）
const cssSource = readFileSync(
  join(process.cwd(), 'src', '组件', '问AI代理', '对话展示.module.css'),
  'utf8',
);

describe('代理气泡', () => {
  it('两种外观都渲染内容，且收到新 props 直接更新', () => {
    const 页 = render(<代理气泡 外观="求职" 内容="第一条回复" />);
    expect(screen.getByText('第一条回复')).toBeTruthy();
    // 直接换内容换外观：初值没有被复制成 state
    页.rerender(<代理气泡 外观="招聘" 内容="第二条回复" />);
    expect(screen.getByText('第二条回复')).toBeTruthy();
    expect(screen.queryByText('第一条回复')).toBeNull();
  });

  it('默认纯文本：** 原样显示（Mock 与招聘端既有行为不变）', () => {
    render(<代理气泡 外观="招聘" 内容="说**要点**了" />);
    expect(screen.getByText('说**要点**了')).toBeTruthy();
  });

  it('正文格式=markdown：解析加粗，同一内容不落纯文本类', () => {
    const 页 = render(<代理气泡 外观="求职" 内容="说**要点**了" 正文格式="markdown" />);
    expect(页.container.querySelector('strong')?.textContent).toBe('要点');
    expect(页.container.textContent).not.toContain('**');
  });
});

describe('我方气泡', () => {
  it('有头像URL用图，改传 null 立即回落首字', () => {
    const 页 = render(
      <我方气泡 外观="招聘" 内容="在吗" 头像URL="https://example.com/a.png" 首字="邵" />,
    );
    // 头像图是 alt="" 的装饰图（无 img 角色），用 DOM 查询断言
    expect(页.container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/a.png');
    expect(screen.queryByText('邵')).toBeNull();
    页.rerender(<我方气泡 外观="招聘" 内容="在吗" 头像URL={null} 首字="邵" />);
    expect(screen.getByText('邵')).toBeTruthy();
    expect(页.container.querySelector('img')).toBeNull();
  });
});

describe('气泡时间（适配层透传）', () => {
  it('代理气泡框与我方气泡都把时间渲染在气泡外下方（列内兄弟节点）', () => {
    const 原串 = '2026-09-16T09:07:33.348845Z';
    const 代理页 = render(
      <代理气泡框 外观="求职" 时间={原串}>
        <div>回复内容</div>
      </代理气泡框>,
    );
    const 代理时间 = 代理页.container.querySelector('time');
    expect(代理时间?.getAttribute('datetime')).toBe(原串);
    // 时间与气泡同居一列：时间的父元素里先有气泡
    expect(代理时间?.parentElement?.querySelector('div[class*="代理气泡"]')).toBeTruthy();

    const 我方页 = render(
      <我方气泡 外观="求职" 内容="在吗" 头像URL={null} 首字="邵" 时间={原串} />,
    );
    expect(我方页.container.querySelector('time')?.getAttribute('datetime')).toBe(原串);
  });

  it('不传时间不产生空时间节点（既有 Mock 调用零变化）', () => {
    const 代理页 = render(<代理气泡 外观="求职" 内容="普通回复" />);
    expect(代理页.container.querySelector('time')).toBeNull();
    const 我方页 = render(<我方气泡 外观="求职" 内容="在吗" 头像URL={null} 首字="邵" />);
    expect(我方页.container.querySelector('time')).toBeNull();
  });
});

describe('快捷操作行', () => {
  it('点击只调用被点那一项的回调', () => {
    const 去市场 = vi.fn();
    const 看在谈 = vi.fn();
    render(
      <快捷操作行
        外观="求职"
        项们={[
          { 键: '去市场', 文案: '去市场', 按下: 去市场 },
          { 键: '看在谈', 文案: '看在谈', 按下: 看在谈 },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '去市场' }));
    expect(去市场).toHaveBeenCalledTimes(1);
    expect(看在谈).not.toHaveBeenCalled();
  });
});

describe('代理气泡框 · 简报宽度覆盖', () => {
  // 气泡元素：scoped 类名含「代理气泡」的 div（气泡列类是「气泡列」，不会撞）
  const 气泡元素 = (容器: HTMLElement) =>
    容器.querySelector('div[class*="代理气泡"]') as HTMLElement;

  it('求职+简报：气泡挂简报类，行根带求职外观类（行 > 气泡列 > 气泡）', () => {
    const 页 = render(
      <代理气泡框 外观="求职" 简报>
        <div>简报内容</div>
      </代理气泡框>,
    );
    const 气泡 = 气泡元素(页.container);
    expect(气泡.className).toContain(样式.简报气泡);
    // DOM 行列关系：气泡在 气泡列 内，外观类挂在行根 —— 端差后代选择器才能命中
    expect(气泡.parentElement?.parentElement?.className).toContain(样式.求职);
  });

  it('招聘+简报：不挂简报类，保持基础气泡宽度', () => {
    const 页 = render(
      <代理气泡框 外观="招聘" 简报>
        <div>简报内容</div>
      </代理气泡框>,
    );
    expect(气泡元素(页.container).className).not.toContain(样式.简报气泡);
  });

  it('CSS 必须用后代选择器 .求职 .简报气泡 盖过镜像净空（防死选择器回归）', () => {
    // jsdom 不做模块 CSS 匹配，类组合断言查不出「选择器写错永不命中」——
    // 直接钉住选择器形状：外观类在行根、简报类在气泡，必须后代形式
    expect(cssSource).toMatch(/\.求职 \.简报气泡/);
    expect(cssSource).not.toMatch(/\.求职\.简报气泡/);
  });
});
