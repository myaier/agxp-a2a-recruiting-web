// 历史代谈展示：四入口（求职/招聘 × Mock/Backend）共用的历史卡与页面壳（S0–S3 展示统一 Task 2）。
// 卡只吃显式展示参数（历史代谈卡信息），不判断数据来源；同 props 必须同 DOM（验收 H1）。
// 媒体位合同：真实图片在场渲染 img，加载失败回中性图位；无媒体给中性图位，绝不按标题猜字。
// 壳只持返回栏 / Spec §4.1 固定说明条 / 14px 18px 24px 滚动内边距；数量说明与列表状态归连接层。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { 历史代谈外壳, 历史代谈卡 } from './历史代谈展示';
import type { 历史代谈卡信息 } from './历史代谈展示';
import { 从招聘历史到卡 } from '../数据/历史代谈展示映射';
import type { P5列表项 } from '../数据/招聘数据源/MatchCase';

afterEach(cleanup);

function 卡信息(覆盖: Partial<历史代谈卡信息> = {}): 历史代谈卡信息 {
  return {
    键: 'G-01',
    标题: 'SHEIN',
    职位: '高级后端工程师（供应链）',
    画像: '女 · 3年 · 本科',
    图片URL: null,
    字标: 'S',
    结果: { 文案: '我方退出', 色调: '中性' },
    原因: '要求全现场办公，与你的底线冲突。',
    阶段说明: '止步于 需要协调',
    时间说明: '8月12日',
    打开: () => undefined,
    ...覆盖,
  };
}

/** Backend 招聘终局行样本（ended）：经 从招聘历史到卡 产出真实 Backend 卡信息。 */
function 招聘行(覆盖: Partial<P5列表项> = {}): P5列表项 {
  return {
    role: 'recruiter',
    state: {
      caseId: 'mc_0123456789abcdef0123456789abcdef',
      lifecycle: 'ended',
      stage: 'anonymous_screening',
      status: 'ended',
      step: 'complete',
      round: 2, roundBudget: 3, needsUser: false,
      outcome: 'user_ended',
      outcomeCode: null,
      createdAt: '2026-08-20T01:00:00Z', updatedAt: '2026-08-29T02:00:00Z',
      finalizedAt: '2026-08-29T03:00:00Z',
      agentAttention: null,
    },
    needsAction: false,
    candidateAlias: 'candidate-0123456789ab',
    job: {
      jobId: 'job_0123456789abcdef0123456789abcdef',
      job: { title: '平台工程师', location: '上海', publicSalaryRange: '25-40K·16薪', requiredSkills: ['Go'] },
    },
    matchScore: null,
    candidateIdentity: { state: 'anonymous', name: null, avatar_url: null, disclosed_at: null },
    ...覆盖,
  } as P5列表项;
}

describe('历史代谈卡 · DOM 与可访问性（Spec §4.1）', () => {
  it('卡是可访问按钮：整卡可点触发 打开，固定顺序 标题+结果 → 职位 → 画像 → 原因 → 阶段+时间+回看', async () => {
    const 打开 = vi.fn();
    const 用户 = (await import('@testing-library/user-event')).default.setup();
    render(<历史代谈卡 信息={卡信息({ 打开 })} />);
    const 卡 = screen.getByRole('button', { name: /SHEIN/ });
    expect(卡).toBeTruthy();
    expect(screen.getByText('我方退出')).toBeTruthy();
    expect(screen.getByText('高级后端工程师（供应链）')).toBeTruthy();
    expect(screen.getByText('女 · 3年 · 本科')).toBeTruthy();
    expect(screen.getByText('要求全现场办公，与你的底线冲突。')).toBeTruthy();
    expect(screen.getByText('止步于 需要协调')).toBeTruthy();
    expect(screen.getByText('8月12日')).toBeTruthy();
    expect(screen.getByText('回看往来 ›')).toBeTruthy();
    await 用户.click(卡);
    expect(打开).toHaveBeenCalledTimes(1);
  });

  it('画像/时间说明为 null 时对应行位缺席，其余结构不变', () => {
    const { container } = render(
      <历史代谈卡 信息={卡信息({ 画像: null, 时间说明: null })} />,
    );
    expect(screen.getByText('SHEIN')).toBeTruthy();
    expect(screen.getByText('止步于 需要协调')).toBeTruthy();
    expect(screen.queryByText('女 · 3年 · 本科')).toBeNull();
    // 底行只剩 阶段说明 + 回看往来，没有时间位
    expect(container.textContent).not.toContain('8月12日');
    expect(screen.getByText('回看往来 ›')).toBeTruthy();
  });

  it('结果三档只换色调类，文案原样；未知来源不在这里判定', () => {
    for (const 色调 of ['成功', '提醒', '中性'] as const) {
      const { container, unmount } = render(
        <历史代谈卡 信息={卡信息({ 结果: { 文案: '不匹配', 色调 } })} />,
      );
      const 标 = screen.getByText('不匹配');
      expect(标.className).toContain('结果');
      expect(标.className.length).toBeGreaterThan('结果'.length); // 带具体色调类
      expect(container.textContent).toContain('不匹配');
      unmount();
    }
  });
});

describe('历史代谈卡 · 媒体位（Spec §4.1：真实图片 / 演示字标 / 中性图位）', () => {
  it('有真实图片渲染 img（alt 空，装饰位）；字标在场且无图时渲染字标', () => {
    const 有图 = render(<历史代谈卡 信息={卡信息({ 图片URL: 'https://cdn.example.test/logo.png', 字标: null })} />);
    const 图 = 有图.container.querySelector('img');
    expect(图).toBeTruthy();
    expect(图?.getAttribute('src')).toBe('https://cdn.example.test/logo.png');
    expect(图?.getAttribute('alt')).toBe('');
    有图.unmount();

    render(<历史代谈卡 信息={卡信息()} />);
    expect(screen.getByText('S')).toBeTruthy(); // Mock 演示字标原样
  });

  it('媒体加载失败回中性图位，不留下裂图', () => {
    const { container } = render(
      <历史代谈卡 信息={卡信息({ 图片URL: 'https://cdn.example.test/broken.png', 字标: null })} />,
    );
    const 图 = container.querySelector('img');
    expect(图).toBeTruthy();
    fireEvent.error(图!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy(); // 中性图位（人像图标）
  });

  it('无媒体给中性图位，不按标题/别名猜字', () => {
    const { container } = render(
      <历史代谈卡 信息={卡信息({ 图片URL: null, 字标: null, 标题: 'candidate-0123456789ab' })} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
    // 媒体位本身无文字：标题首字符不被抠去当头像字
    const 媒体位 = container.querySelector('[class*="字标"]');
    expect(媒体位).toBeTruthy();
    expect((媒体位 as HTMLElement).textContent ?? '').toMatch(/^\s*$/);
  });
});

describe('历史代谈卡 · 同 props 同 DOM（H1：Backend 卡与 Mock 卡共用版式）', () => {
  it('Backend 映射产物与等事实 Mock 信息渲染出完全相同的 DOM', () => {
    // Backend：经 从招聘历史到卡 的真实产物（别名/职位/结果/原因/阶段/时间）
    const backend信息 = 从招聘历史到卡(招聘行(), () => undefined);
    // Mock：连接层按等事实手工构造的同值信息（同字段、同文案、同色调）
    const mock信息: 历史代谈卡信息 = {
      ...backend信息,
      打开: () => undefined,
    };
    const { container: backend容器 } = render(<历史代谈卡 信息={backend信息} />);
    const backendHTML = backend容器.firstElementChild?.outerHTML ?? '';
    cleanup();
    const { container: mock容器 } = render(<历史代谈卡 信息={mock信息} />);
    const mockHTML = mock容器.firstElementChild?.outerHTML ?? '';
    expect(backendHTML).toBe(mockHTML);
    // 且共用同一批版式类（卡/头行/原因/底行）
    expect(backendHTML).toContain('归档卡');
    expect(backendHTML).toContain('归档原因');
  });
});

describe('历史代谈外壳 · 壳只持展示（Spec §4.1 固定说明条）', () => {
  it('返回栏 + 数量说明副标题 + 固定说明条 + children；滚动内边距 14px 18px 24px', () => {
    const 返回 = vi.fn();
    const { container } = render(
      <历史代谈外壳 返回={返回} 数量说明="已加载 3 单">
        <div>列表本体</div>
      </历史代谈外壳>,
    );
    expect(screen.getByText('历史代谈')).toBeTruthy();
    expect(screen.getByText('已加载 3 单')).toBeTruthy();
    expect(screen.getByText('列表本体')).toBeTruthy();
    // Spec §4.1 冻结说明文案（替换旧「所有历史不可恢复」承诺），两种来源同文案
    expect(
      screen.getByText('历史代谈保留往来记录，可回看进度与结果；能否继续以详情页当前可用操作为准。'),
    ).toBeTruthy();
    const 滚动 = container.querySelector('.滚动区');
    expect(滚动).toBeTruthy();
    expect((滚动 as HTMLElement).style.padding).toBe('14px 18px 24px');
  });

  it('数量说明为 null 时无副标题（加载未开始不显示假零总数）', () => {
    render(
      <历史代谈外壳 返回={() => undefined} 数量说明={null}>
        <div />
      </历史代谈外壳>,
    );
    expect(screen.getByText('历史代谈')).toBeTruthy();
    expect(screen.queryByText(/单/)).toBeNull();
  });

  it('返回键触发 返回 回调', async () => {
    const 返回 = vi.fn();
    const 用户 = (await import('@testing-library/user-event')).default.setup();
    render(
      <历史代谈外壳 返回={返回} 数量说明={null}>
        <div />
      </历史代谈外壳>,
    );
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(返回).toHaveBeenCalledTimes(1);
  });
});
