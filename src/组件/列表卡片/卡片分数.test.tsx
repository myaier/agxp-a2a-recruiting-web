// 卡片分数：列表卡右列的 40px 分数位（Spec §4.3）。
// 已知分复用 适配环 的原 40px 展示；未知分走中性占位（可访问名「匹配分未知」，
// 容器内给「—」与「分数未知」，不画进度弧）。真实 0 分仍是 0 分，不得把零变成未知。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import 卡片分数 from './卡片分数';

describe('卡片分数', () => {
  it('已知分数复用适配环原展示，可访问名不变', () => {
    render(<卡片分数 分={87} />);
    expect(screen.getByRole('img', { name: '适配 87 分' })).toBeTruthy();
    expect(screen.queryByLabelText('匹配分未知')).toBeNull();
  });

  it('真实 0 分仍是 0 分：照常画 0 分环，不变成未知占位', () => {
    render(<卡片分数 分={0} />);
    expect(screen.getByRole('img', { name: '适配 0 分' })).toBeTruthy();
    expect(screen.queryByLabelText('匹配分未知')).toBeNull();
  });

  it('未知分数走中性占位：可访问名「匹配分未知」，容器内给 — 与「分数未知」，不画进度弧', () => {
    const { container } = render(<卡片分数 分={null} />);
    const 位 = screen.getByLabelText('匹配分未知');
    expect(位.textContent).toContain('—');
    expect(位.textContent).toContain('分数未知');
    // 不画进度弧、不给低分/成功色的环
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('img', { name: /适配/ })).toBeNull();
  });
});
