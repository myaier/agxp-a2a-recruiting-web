// 分析弹层（承接义务 1/2，Spec §3.2）：列表分析弹层的唯一共享组装 —— 既有 弹层框架
// （遮罩/抓手/Escape/焦点恢复）+ 可见关闭按钮 + 当前记录岗位上下文行 + 匹配分析块
// （藏环文本总分）。四个消费者（看市场/候选推荐/求职在谈/招聘在谈）共用本组件，
// 零网络补读（模型由调用方从该行已返回数据构建，本组件不发任何请求）。
// 仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import 分析弹层 from './分析弹层';
import type { 匹配分析模型 } from '../数据/匹配解释展示映射';
import { 解匹配解释 } from '../数据/招聘数据源/匹配解释';
import { BFF匹配解释92分样本 } from '../测试/BFF样本';

// 模型一律经真实解码构造（同 匹配分析块.test 惯例，不吃手工六行）
const 解释92 = 解匹配解释(BFF匹配解释92分样本, 92)!;
const 模型: 匹配分析模型 = {
  分数: 92,
  解释: 解释92,
  有限依据: [],
  上下文: '有来源',
};

const 缺失模型: 匹配分析模型 = {
  分数: 87,
  解释: null,
  有限依据: ['职位方向匹配'],
  上下文: '有来源',
};

function 渲染弹层(模型输入: 匹配分析模型 = 模型, 岗位上下文: string | null = 'AI 产品实习生 · 云衢科技') {
  const 关闭 = vi.fn();
  const 页 = render(<分析弹层 模型={模型输入} 岗位上下文={岗位上下文} 关闭={关闭} />);
  return { 页, 关闭 };
}

describe('分析弹层 · 组装（Spec §3.2）', () => {
  it('弹层头部有可见关闭按钮（与遮罩/Escape 三通道并列）：点击只调 关闭', async () => {
    const { 关闭 } = 渲染弹层();
    // 可见关闭键的可访问名是「关闭」（弹层遮罩按钮是「关闭匹配度分析」，二者并存）
    const 关闭键 = screen.getByRole('button', { name: '关闭' });
    expect(关闭键.tagName).toBe('BUTTON');
    fireEvent.click(关闭键);
    expect(关闭).toHaveBeenCalledTimes(1);
  });

  it('遮罩（关闭匹配度分析）与 Escape 也关闭：三通道并存', () => {
    const { 关闭 } = 渲染弹层();
    fireEvent.click(screen.getByRole('button', { name: '关闭匹配度分析' }));
    expect(关闭).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(关闭).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(关闭).toHaveBeenCalledTimes(3);
  });

  it('当前记录的简短岗位上下文行在场（阅读顺序：头部行 → 标题+文本总分 → 六维行）', () => {
    render(<分析弹层 模型={模型} 岗位上下文="AI 产品实习生 · 云衢科技" 关闭={vi.fn()} />);
    const 弹层 = screen.getByRole('dialog', { name: '匹配度分析' });
    expect(within(弹层).getByText('AI 产品实习生 · 云衢科技')).toBeTruthy();
    // 标题与文本总分来自 匹配分析块（藏环）
    expect(within(弹层).getByText('匹配度分析')).toBeTruthy();
    expect(弹层.textContent).toContain('92 分');
    expect(within(弹层).getByText('推荐生成时的匹配结果')).toBeTruthy();
    expect(within(弹层).getByText('命中11/12个岗位关键词')).toBeTruthy();
    // 弹层内不画环（藏环文本总分）
    expect(within(弹层).queryByRole('img', { name: /适配/ })).toBeNull();
  });

  it('上下文缺失（null）不造占位：上下文行缺席，分析内容照常', () => {
    render(<分析弹层 模型={模型} 岗位上下文={null} 关闭={vi.fn()} />);
    const 弹层 = screen.getByRole('dialog', { name: '匹配度分析' });
    expect(弹层.textContent).toContain('92 分');
  });

  it('解释合法缺失：缺失说明 + 有限依据照常进入弹层', () => {
    render(<分析弹层 模型={缺失模型} 岗位上下文="平台工程师" 关闭={vi.fn()} />);
    const 弹层 = screen.getByRole('dialog', { name: '匹配度分析' });
    expect(within(弹层).getByText('暂无该次匹配的详细分析')).toBeTruthy();
    expect(within(弹层).getByText('有限依据')).toBeTruthy();
    expect(within(弹层).getByText('职位方向匹配')).toBeTruthy();
  });

  it('组件零网络零入口：弹层内除关闭键/遮罩外没有其他 button（查看入口归卡片层）', () => {
    render(<分析弹层 模型={模型} 岗位上下文="AI 产品实习生" 关闭={vi.fn()} />);
    const 弹层 = screen.getByRole('dialog', { name: '匹配度分析' });
    const 键 = within(弹层).queryAllByRole('button');
    expect(键).toHaveLength(1); // 只有可见关闭键（遮罩在 dialog 外）
    expect(键[0]!.getAttribute('aria-label')).toBe('关闭');
  });

  it('渲染不改传入模型（纯展示）', () => {
    const 快照模型: 匹配分析模型 = {
      分数: 92, 解释: 解释92, 有限依据: [], 上下文: '有来源',
    };
    const 冻结解释 = JSON.parse(JSON.stringify(快照模型.解释));
    const 页 = render(<分析弹层 模型={快照模型} 岗位上下文="x" 关闭={vi.fn()} />);
    expect(页.getByRole('dialog', { name: '匹配度分析' }).textContent).toContain('92 分');
    expect(JSON.parse(JSON.stringify(快照模型.解释))).toEqual(冻结解释);
  });
});
