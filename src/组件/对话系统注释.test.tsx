// 对话系统注释 · 共用灰色注释胶囊（S0–S3 展示统一 Task 3）：原 Mock 往来记录 屏内的
// 「系统胶囊」提取为共享组件，原两个往来记录消费者与 阶段对话流 的 注释 记录共用。
// 只断言 DOM 文本与结构，不依赖 CSS hash、像素或截图（仓库未装 jest-dom）。

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import 对话系统注释 from './对话系统注释';

afterEach(() => {
  cleanup();
});

describe('对话系统注释 · 共用灰胶囊（Task 3）', () => {
  it('只传内容：单个胶囊承载内容，无「标签 · 时间」头行 —— 与原 往来记录 系统条同构', () => {
    const { container } = render(<对话系统注释 内容="双方代理已就递交简历达成一致" />);
    expect(screen.getByText('双方代理已就递交简历达成一致')).toBeTruthy();
    // 只有 胶囊 + 内容 两层 span：没有头行
    expect(container.querySelectorAll('span').length).toBe(2);
    expect(screen.queryByText('·')).toBeNull();
  });

  it('标签 + 时间：同一胶囊内先「标签 · 时间」头行再内容，长文完整呈现不截断', () => {
    const 长文 =
      '初评结论：候选人在交易网关方向与岗位主线高度一致；薪资条件双方区间未重叠，暂无法比较；其余维度未发现冲突。';
    render(<对话系统注释 内容={长文} 标签="初评" 时间="22:28" />);
    expect(screen.getByText('初评 · 22:28')).toBeTruthy();
    expect(screen.getByText(长文)).toBeTruthy();
    // 头行与内容在同一个胶囊元素里
    const 胶囊 = (screen.getByText('初评 · 22:28') as HTMLElement).parentElement as HTMLElement;
    expect(胶囊.textContent).toContain('初评结论');
  });

  it('只传标签（或只传时间）：头行只含有的那一段，不出现孤立的分隔点', () => {
    render(<对话系统注释 内容="继续推进流程" 标签="第 1 轮复评" 时间={null} />);
    expect(screen.getByText('第 1 轮复评')).toBeTruthy();
    expect(screen.queryByText('·')).toBeNull();
  });
});
