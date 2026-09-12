// 招聘在谈卡：Mock 在谈候选卡与 Backend P5 招聘在谈卡共用的唯一卡面（Spec §5.2）。
// 视觉基准 = 原 企业在谈候选.tsx 的 Mock 候选卡：候选信息主体（头行 → 工作/教育图标行 →
// 亮点标签行）在标签下方接 在谈阶段区；右侧始终是匹配分位 —— Backend 的 P5 open 无匹配分，
// 走 卡片分数 的未知占位，不补 0、不画环。整卡点击 = 打开；卡上没有收藏/委托/淘汰按钮。
// 无 Provider 宿主：回调全部走 props。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import 招聘在谈卡 from './招聘在谈卡';
import type { 候选卡信息, 招聘在谈卡属性, 在谈阶段信息 } from './类型';

const 完整信息: 候选卡信息 = {
  性别: '男',
  年限: '9 年',
  学历: '硕士',
  求职状态: '在职看机会',
  工作: '字节跳动 · Go / 高并发交易',
  教育: '上海交通大学 · 计算机科学与技术',
  亮点: ['交易域直接对口', '短通勤'],
};

const 全未知: 候选卡信息 = {
  性别: null, 年限: null, 学历: null, 求职状态: null, 工作: null, 教育: null, 亮点: [],
};

function 阶段(覆盖: Partial<在谈阶段信息> = {}): 在谈阶段信息 {
  return {
    标题: '需要协调',
    色系: '需要协调',
    待办: true,
    徽标: null,
    文本: '对方要每周 2 天远程，AI代理建议给 1 天',
    注意说明: null,
    ...覆盖,
  };
}

/** 默认卡：完整信息 + 已知 94 分，逐用例覆盖自己关心的槽位 */
function 渲染卡(覆盖: Partial<招聘在谈卡属性> = {}): 招聘在谈卡属性 {
  const 属性: 招聘在谈卡属性 = {
    信息: 完整信息,
    匹配分: 94,
    阶段: 阶段(),
    打开: vi.fn(),
    ...覆盖,
  };
  render(<招聘在谈卡 {...属性} />);
  return 属性;
}

describe('招聘在谈卡 · 卡面与占位（Spec §5.2 / §4）', () => {
  it('完整信息：候选主体四区 + 右列已知分 + 阶段区，卡内区域顺序固定', () => {
    render(<招聘在谈卡 信息={完整信息} 匹配分={94} 阶段={阶段()} 打开={vi.fn()} />);
    expect(screen.getByTestId('招聘在谈卡')).toBeTruthy();
    expect(screen.getByRole('img', { name: '男' })).toBeTruthy();
    expect(screen.getByText('字节跳动 · Go / 高并发交易')).toBeTruthy();
    expect(screen.getByText('上海交通大学 · 计算机科学与技术')).toBeTruthy();
    expect(screen.getByText('交易域直接对口')).toBeTruthy();
    expect(screen.getByRole('img', { name: '适配 94 分' })).toBeTruthy();
    expect(screen.getByText('对方要每周 2 天远程，AI代理建议给 1 天')).toBeTruthy();
    const 区域顺序 = Array.from(
      screen.getByTestId('招聘在谈卡').querySelectorAll('[data-card-region]'),
    ).map((元) => 元.getAttribute('data-card-region'));
    expect(区域顺序).toEqual(['score', 'head', 'work', 'education', 'tags', 'stage']);
  });

  it('全空信息 + 未知分：占位齐全，分数位不补 0（P5 open 缺匹配分 ≠ 0 分）', () => {
    render(<招聘在谈卡 信息={全未知} 匹配分={null} 阶段={阶段()} 打开={vi.fn()} />);
    expect(screen.getByLabelText('性别未知')).toBeTruthy();
    for (const 占位 of [
      '经验未知', '学历未知', '求职状态未知', '工作经历未知', '教育经历未知', '亮点信息未知',
    ]) {
      expect(screen.getByText(占位)).toBeTruthy();
    }
    expect(screen.getByLabelText('匹配分未知')).toBeTruthy();
    expect(screen.queryByRole('img', { name: /适配/ })).toBeNull();
  });

  it('阶段区在标签下方，归属徽标与注意说明都落在阶段区里（原 P5 头行徽标搬入）', () => {
    render(
      <招聘在谈卡
        信息={全未知}
        匹配分={null}
        阶段={阶段({ 待办: false, 徽标: '需注意', 注意说明: 'AI 服务暂时不可用，本 Case 尚未继续' })}
        打开={vi.fn()}
      />,
    );
    const 阶段区 = screen.getByTestId('招聘在谈卡').querySelector('[data-card-region="stage"]');
    expect(阶段区?.textContent).toContain('需注意');
    expect(阶段区?.textContent).toContain('AI 服务暂时不可用，本 Case 尚未继续');
    expect(阶段区?.textContent).toContain('对方要每周 2 天远程，AI代理建议给 1 天');
  });

  it('P5 open 行带来的真实 0 分照常画 0 分环，不落未知占位（release/0.2.5）', () => {
    render(<招聘在谈卡 信息={全未知} 匹配分={0} 阶段={阶段()} 打开={vi.fn()} />);
    expect(screen.getByRole('img', { name: '适配 0 分' })).toBeTruthy();
    expect(screen.queryByLabelText('匹配分未知')).toBeNull();
  });
});

describe('招聘在谈卡 · 行为', () => {
  it('整卡点击只调 打开；卡上没有收藏/委托/淘汰等第二入口', () => {
    const 属性 = 渲染卡();
    const 键们 = screen.getByTestId('招聘在谈卡').querySelectorAll('button');
    expect(键们).toHaveLength(1); // 白卡整卡即唯一可点元素
    fireEvent.click(键们[0] as Element);
    expect(属性.打开).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /收藏|委托|淘汰/ })).toBeNull();
  });
});
