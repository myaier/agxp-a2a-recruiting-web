// 候选信息主体：招聘两卡共用的 头行 → 工作图标行 → 教育图标行 → 亮点标签行
// （Spec §4.2 / §5.1）。缺失只看「合法 null / trim 后为空」：统一未知占位；
// 工作/教育复合行显示已知部分，全空才占位；重复亮点不去重、不排序。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import 候选信息主体 from './候选信息主体';
import type { 候选卡信息 } from './类型';

const 有值: 候选卡信息 = {
  性别: '女',
  年限: '9 年',
  学历: '硕士',
  求职状态: '在职看机会',
  工作: '华泰证券 · Go / 交易网关',
  教育: '上海交通大学 · 计算机科学与技术',
  亮点: ['交易域直接对口', '低延迟系统'],
};

const 全未知: 候选卡信息 = {
  性别: null,
  年限: null,
  学历: null,
  求职状态: null,
  工作: null,
  教育: null,
  亮点: [],
};

const 占位文案们 = [
  '经验未知', '学历未知', '求职状态未知',
  '工作经历未知', '教育经历未知', '亮点信息未知',
] as const;

/** 区域标记（Plan 公共展示契约：稳定卡内位置，只标实际存在的区域） */
const 区域 = (名称: string) =>
  document.querySelector(`[data-card-region="${名称}"]`) as HTMLElement | null;

afterEach(() => vi.restoreAllMocks());

describe('候选信息主体', () => {
  it('字段全未知：头行三段 + 性别 + 工作/教育/亮点 全部给明确占位，图标行与标签行不收起', () => {
    render(<候选信息主体 信息={全未知} />);
    for (const 文案 of 占位文案们) expect(screen.getByText(文案)).toBeTruthy();
    const 性别未知 = screen.getByLabelText('性别未知');
    expect(性别未知.getAttribute('title')).toBe('性别未知');
    // 未知不让行上移：工作/教育图标行照常在（图标 aria-hidden，按区域查）
    expect(区域('work')?.querySelector('svg')).toBeTruthy();
    expect(区域('education')?.querySelector('svg')).toBeTruthy();
    expect(区域('tags')?.textContent).toBe('亮点信息未知');
    // 不再有旧的中性「候选信息暂未披露」
    expect(screen.queryByText('候选信息暂未披露')).toBeNull();
  });

  it('字段有值：显示原值、不出占位；性别继续用原图标（默认行为不变）', () => {
    render(<候选信息主体 信息={有值} />);
    expect(screen.getByRole('img', { name: '女' })).toBeTruthy();
    expect(screen.queryByLabelText('性别未知')).toBeNull();
    for (const 文案 of [
      '9 年', '硕士', '在职看机会',
      '华泰证券 · Go / 交易网关', '上海交通大学 · 计算机科学与技术', '交易域直接对口',
    ]) {
      expect(screen.getByText(文案)).toBeTruthy();
    }
    for (const 占位 of 占位文案们) expect(screen.queryByText(占位)).toBeNull();
  });

  it('部分已知：复合行只显示已知部分，不出整行占位', () => {
    render(<候选信息主体 信息={{ ...全未知, 工作: '华泰证券', 教育: '计算机科学与技术' }} />);
    expect(screen.getByText('华泰证券')).toBeTruthy();
    expect(screen.getByText('计算机科学与技术')).toBeTruthy();
    expect(screen.queryByText('工作经历未知')).toBeNull();
    expect(screen.queryByText('教育经历未知')).toBeNull();
  });

  it('重复亮点按原顺序逐条渲染，不去重，无 duplicate key 告警', () => {
    const 键警告 = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<候选信息主体 信息={{ ...全未知, 亮点: ['稳定性', '稳定性'] }} />);
    expect(screen.getAllByText('稳定性')).toHaveLength(2);
    expect(键警告.mock.calls.some((参) => String(参[0]).includes('key'))).toBe(false);
  });

  it('亮点全是空白字符串按空处理：给「亮点信息未知」，不渲染空白标签', () => {
    const { container } = render(<候选信息主体 信息={{ ...全未知, 亮点: ['  ', ''] }} />);
    expect(screen.getByText('亮点信息未知')).toBeTruthy();
    expect(container.querySelector('[data-card-region="tags"]')?.textContent).toBe('亮点信息未知');
  });

  it('有值 → null rerender：旧信息不得残留，回到逐字段占位', () => {
    const 页 = render(<候选信息主体 信息={有值} />);
    expect(screen.getByText('华泰证券 · Go / 交易网关')).toBeTruthy();
    页.rerender(<候选信息主体 信息={全未知} />);
    expect(screen.queryByText('华泰证券 · Go / 交易网关')).toBeNull();
    expect(screen.queryByText('交易域直接对口')).toBeNull();
    for (const 文案 of 占位文案们) expect(screen.getByText(文案)).toBeTruthy();
    expect(screen.getByLabelText('性别未知')).toBeTruthy();
    expect(screen.queryByRole('img', { name: '女' })).toBeNull();
  });
});
