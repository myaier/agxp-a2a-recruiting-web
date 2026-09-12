// 简历附件区 组件测试（Task 8，core editors §5.3）：
// 展示契约：标题/＋、现有空态、PDF 行（经原 滑动行）、行说明与箭头、单行展开、busy 禁操作。
// 组件不关心数据源模式：行键由页面给（Backend 真实 file ID / Mock 模拟键），
// 行面可访问名 = 「哪一份 + 什么状态」，读屏信息量不减。
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import userEventApi from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 样式 from '../屏幕/我的简历.module.css';
import { 简历附件区, type 附件展示行 } from './简历附件区';

/** 共享实例：断言按 brief 原样写 userEvent.click(...) */
const userEvent = userEventApi.setup();

/** 一条展示行：默认带 解析/替换/删除 三个动作（动作矩阵由页面按状态给） */
function 行(键: string, 名称: string, 说明: string, 覆盖: Partial<附件展示行> = {}): 附件展示行 {
  return {
    键,
    名称,
    说明,
    操作们: [
      { 文字: '解析', 按下: vi.fn() },
      { 文字: '替换', 按下: vi.fn() },
      { 文字: '删除', 危险: true, 按下: vi.fn() },
    ],
    打开: vi.fn(),
    ...覆盖,
  };
}

function render附件区(
  行们: 附件展示行[],
  覆盖: { 可添加?: boolean; 忙?: boolean; 展开键?: string | null } = {},
) {
  const 添加 = vi.fn();
  const 请求展开 = vi.fn();
  // 展开态受控：请求展开 落到真实 state（与页面同构），组件才能按新 展开键 重渲染
  function 外壳() {
    const [展开键, 设展开键] = useState<string | null>(覆盖.展开键 ?? null);
    return (
      <简历附件区
        行们={行们}
        可添加={覆盖.可添加 ?? true}
        忙={覆盖.忙 ?? false}
        添加={添加}
        展开键={展开键}
        请求展开={(键) => { 请求展开(键); 设展开键(键); }}
      />
    );
  }
  render(<外壳 />);
  return { 添加, 请求展开 };
}

/** 左滑露出动作按钮（横向位移远超操作区一半 → 打开） */
function revealActions(序 = 0) {
  const 行 = screen.getAllByTestId('附件简历行')[序];
  fireEvent.pointerDown(行, { clientX: 180, clientY: 20 });
  fireEvent.pointerMove(行, { clientX: 20, clientY: 22 });
  fireEvent.pointerUp(行, { clientX: 20, clientY: 22 });
}

describe('简历附件区 · 标题与 ＋', () => {
  it('标题行同一节点带 卡标题+附件标题行 两类，可添加时渲染 ＋ 并回报添加', async () => {
    const { 添加 } = render附件区([]);
    const 标题 = screen.getByTestId('附件简历标题');
    expect(标题.className).toContain(样式.卡标题);
    expect(标题.className).toContain(样式.附件标题行);
    expect(标题.textContent).toContain('附件简历');
    expect(screen.getByText('还未上传附件简历')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '添加附件简历' }));
    expect(添加).toHaveBeenCalledTimes(1);
  });

  it('不可添加时不长 ＋ 入口，空态照旧', () => {
    render附件区([], { 可添加: false });
    expect(screen.queryByRole('button', { name: '添加附件简历' })).toBeNull();
    expect(screen.getByText('还未上传附件简历')).toBeTruthy();
  });
});

describe('简历附件区 · PDF 行', () => {
  it('单行按冻结结构渲染，行面可访问名 = 文件名 + 状态说明，点行回报 打开', async () => {
    const 打开 = vi.fn();
    render附件区([行('rf_a', '旧简历A.pdf', '尚未识别', { 打开 })]);
    const 行面 = screen.getAllByTestId('附件简历行');
    expect(行面).toHaveLength(1);
    expect(行面[0].className).toContain(样式.附件行);
    expect(行面[0].getElementsByClassName(样式.PDF块)).toHaveLength(1);
    expect(行面[0].getElementsByClassName(样式.PDF字)).toHaveLength(1);
    expect(行面[0].getElementsByClassName(样式.附件主体)).toHaveLength(1);
    expect(行面[0].getElementsByClassName(样式.附件名)).toHaveLength(1);
    expect(行面[0].getElementsByClassName(样式.附件说明)).toHaveLength(1);
    expect(行面[0].getElementsByClassName(样式.尖括号)).toHaveLength(1);
    expect(行面[0].textContent).toContain('旧简历A.pdf');
    expect(行面[0].textContent).toContain('尚未识别');
    // aria-label 覆盖内容拼名，必须同时带「哪一份」和「什么状态」
    expect(screen.getByRole('button', { name: '旧简历A.pdf 尚未识别' })).toBeTruthy();
    await userEvent.click(screen.getByTestId('附件简历行'));
    expect(打开).toHaveBeenCalledTimes(1);
  });

  it('三行都渲染；受控展开键决定唯一打开行', () => {
    render附件区(
      [行('k1', 'a.pdf', '尚未识别'), 行('k2', 'b.pdf', '识别完成'), 行('k3', 'c.pdf', '正在识别')],
      { 展开键: 'k2' },
    );
    expect(screen.getAllByTestId('附件简历行')).toHaveLength(3);
    const 行面们 = screen.getAllByTestId('附件简历行').map((行) => 行.parentElement as HTMLElement);
    expect(行面们[0].getAttribute('aria-expanded')).toBe('false');
    expect(行面们[1].getAttribute('aria-expanded')).toBe('true');
    expect(行面们[2].getAttribute('aria-expanded')).toBe('false');
  });

  it('点已打开的行 = 收起（回报 null），不触发 行打开', async () => {
    const 打开 = vi.fn();
    const { 请求展开 } = render附件区([行('k1', 'a.pdf', '尚未识别', { 打开 })], { 展开键: 'k1' });
    await userEvent.click(screen.getByTestId('附件简历行'));
    expect(请求展开).toHaveBeenCalledWith(null);
    expect(打开).not.toHaveBeenCalled();
  });

  it('左滑打开回报该行稳定键；点操作键回报其按下并收起', async () => {
    const 替换 = vi.fn();
    const { 请求展开 } = render附件区(
      [行('rf_x', 'x.pdf', '尚未识别', { 操作们: [{ 文字: '替换', 按下: 替换 }] })],
    );
    // 关闭态：操作键不进可访问树
    expect(screen.queryByRole('button', { name: '替换' })).toBeNull();
    revealActions();
    expect(请求展开).toHaveBeenCalledWith('rf_x');
    expect(screen.getByRole('button', { name: '替换' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '替换' }));
    expect(替换).toHaveBeenCalledTimes(1);
    expect(请求展开).toHaveBeenCalledWith(null);
  });
});

describe('简历附件区 · 忙态', () => {
  it('忙时全部操作键禁用且按不下（防重复提交由页面状态锁承载）', async () => {
    const 解析 = vi.fn();
    const 替换 = vi.fn();
    render附件区(
      [行('rf_x', 'x.pdf', '尚未识别', { 操作们: [{ 文字: '解析', 按下: 解析 }, { 文字: '替换', 按下: 替换 }] })],
      { 忙: true },
    );
    revealActions();
    expect((screen.getByRole('button', { name: '解析' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '替换' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: '解析' }));
    expect(解析).not.toHaveBeenCalled();
    expect(替换).not.toHaveBeenCalled();
  });
});
