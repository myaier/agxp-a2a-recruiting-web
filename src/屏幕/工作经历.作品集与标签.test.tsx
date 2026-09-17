// 工作经历 · 作品集与标签（证书技能与标签录入/作品集写入与边界）
// 由 src/屏幕/工作经历.test.tsx 按冻结归属拆出：证书技能→作品集与标签；证书与语言 Backend、日常作品集写入（Task 1）、证书行内输入（review-cx F4）、技能/证书共用标签录入（Task 3）、日常作品集输入边界（review-r1 F1）就近归入。

import {
  mock跳转,
  mock返回,
  mock替换跳转,
  mock轻提示,
  mock确认分区,
  mock更新草稿,
  mock应用状态,
  宿主,
  render工作经历,
  存简历调用们,
  完整教育,
  登记工作经历,
} from './工作经历.测试辅助';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type 简历证书 } from '../数据/类型';
import userEvent from '@testing-library/user-event';
import 工作经历 from './工作经历';

登记工作经历(工作经历);

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回, 替换跳转: mock替换跳转 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

// review-r1 P1-3：教育编辑页 Backend 分支——学校/专业输入走目录查询，点候选才落引用，
// 继续输入清引用，没点候选阻止保存。Mock 分支保持自由文本不变。
// Task 1：证书添加不要求年份输入 —— BFF 契约里 year 可空（页面 年份 留空字符串 → 写 null），
// 存简历 派发里每条证书都带全 BFF 必需的用户字段（名称/年份/编号），不需要新增年份输入框。
describe('工作经历 证书与语言 Backend', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
  });

  it('添加证书不带年份输入，存简历里 年份 为空字符串', async () => {
    render工作经历({ 数据源: 'backend' });
    const 用户 = userEvent.setup();
    const 证书输入 = screen.getByPlaceholderText('证书或语言，如 CPA、雅思 7.0');
    await 用户.type(证书输入, 'CET-4');
    await 用户.click(证书输入.parentElement!.querySelector('button')!);
    const 派发 = mock应用状态.派发;
    const 存简历调用 = 派发.mock.calls.find((c: unknown[]) => (c[0] as { 型?: string })?.型 === '存简历')?.[0] as {
      证书: { 名称: string; 年份: string; 编号: string }[];
    } | undefined;
    expect(存简历调用).toBeDefined();
    expect(存简历调用!.证书).toEqual([{ 名称: 'CET-4', 年份: '', 编号: expect.any(String) }]);
  });
});

// ── Task 1（core editors §6.1）：日常作品集写入三态 —— 链接编辑意图独立于 onboarding：
// 未编辑省略属性、明确清空 null、设置字符串；失败保留输入可重试、成功清意图取权威回显；
// 普通编辑不生成建档草稿；空身份 + 链接脏沿既有「请先选择求职状态」提示阻止假成功，不离页。
describe('工作经历 · 日常作品集写入（Task 1）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
    mock确认分区.mockClear();
    mock更新草稿.mockClear();
  });

  it('日常编辑（无旅程标记）设置链接：保存带规范化 URL，且不生成建档草稿', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({ 经历: [], 教育: [完整教育], 保存简历, 作品集链接: '' });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByLabelText('作品集或项目链接'), 'github.com/shen');
    await 用户.tab();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(保存简历).toHaveBeenCalledWith(expect.objectContaining({ 作品集链接: 'https://github.com/shen' }));
    expect(mock更新草稿).not.toHaveBeenCalled();
  });

  it('日常编辑（无旅程标记）清空链接：保存带 null', async () => {
    const 保存简历 = vi.fn(async (_写入: Record<string, unknown>) => {});
    render工作经历({
      经历: [], 教育: [完整教育], 保存简历, 作品集链接: 'https://github.com/shen',
    });
    const 用户 = userEvent.setup();
    await 用户.clear(screen.getByLabelText('作品集或项目链接'));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(保存简历.mock.calls[0][0]).toEqual(expect.objectContaining({ 作品集链接: null }));
  });

  it('保存失败且权威水合旧 URL 后，本次输入仍保留在输入框可手动重试；重试成功清意图', async () => {
    let 次数 = 0;
    const 保存简历 = vi.fn(async () => {
      次数 += 1;
      if (次数 === 1) {
        // 模拟 处理写入错误 的权威水合：旧 URL 回 Context
        mock应用状态.状态.简历作品集链接 = 'https://old.example.com';
        throw new Error('保存失败');
      }
    });
    render工作经历({ 经历: [], 教育: [完整教育], 保存简历, 作品集链接: '' });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByLabelText('作品集或项目链接'), 'github.com/shen');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalled());
    // 权威水合回写了旧 URL，但已触碰的本地输入不被覆盖
    // （点保存先失焦 → onBlur 规范化已把输入收成带协议形态）
    const 输入 = screen.getByLabelText('作品集或项目链接') as HTMLInputElement;
    expect(输入.value).toBe('https://github.com/shen');
    // 手动重试成功后取权威回显并清意图
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(2));
    expect(mock轻提示).toHaveBeenCalledWith('简历已保存');
    expect(mock跳转).toHaveBeenCalled();
  });

  it('身份空且链接脏：不发保存、不提示成功、不离页，沿既有求职状态提示收口', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({
      经历: [], 教育: [完整教育], 保存简历,
      基本信息: { 真名: '沈', 开始工作年: '', 身份: '' },
    });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByLabelText('作品集或项目链接'), 'github.com/shen');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(保存简历).not.toHaveBeenCalled();
    expect(mock轻提示).not.toHaveBeenCalledWith('简历已保存');
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock轻提示).toHaveBeenCalledWith('请先选择求职状态');
  });

  it('旅程草稿恢复的链接已改（刷新后未触碰输入）：保存仍带草稿里的三态值', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({
      经历: [], 教育: [完整教育], 保存简历,
      建档: { 资料: { 作品集链接: 'https://github.com/shen' } },
    });
    const 用户 = userEvent.setup();
    // 未触碰输入框（跟随草稿），直接保存
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(保存简历).toHaveBeenCalledWith(expect.objectContaining({ 作品集链接: 'https://github.com/shen' }));
  });

  it('旅程草稿恢复的明确清空（刷新后未触碰输入）：保存仍带 null', async () => {
    const 保存简历 = vi.fn(async (_写入: Record<string, unknown>) => {});
    render工作经历({
      经历: [], 教育: [完整教育], 保存简历,
      建档: { 资料: { 作品集链接: null } },
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(保存简历.mock.calls[0][0]).toEqual(expect.objectContaining({ 作品集链接: null }));
  });
});

// ── review-cx F4：证书行内录入接 编辑中.certificate（冻结合同 7 的证书编辑器变体）──
// 列表视图「证书与语言」的行内输入是旅程里唯一的证书编辑控件：输入即写草稿
// （certificate 变体：本地编号 + 名称），刷新后回填输入框原位；「添加」是它的
// 提交口 —— 以草稿本地编号落列表并清空该层；清空输入是该控件唯一的明确放弃
// 入口，丢弃草稿。单槽设计与教育/经历层互斥：编辑层打开时槽被那一层接管。
describe('工作经历 · 证书行内输入接线（review-cx F4）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
    mock确认分区.mockClear();
    mock更新草稿.mockClear();
  });

  it('刷新恢复：草稿 certificate 编辑中 回填证书名输入框（列表视图原位）', () => {
    render工作经历({
      经历: [], 教育: [完整教育],
      建档: {
        编辑中: { 种类: 'certificate', 本地编号: 'c_draft', 字段: { 名称: 'CPA' } },
      },
    });
    // 列表视图在场（不是教育/经历编辑层），输入框带回半填的名称
    expect(screen.getByText('证书与语言')).toBeTruthy();
    expect(screen.getByDisplayValue('CPA')).toBeTruthy();
    expect((screen.getByPlaceholderText('证书或语言，如 CPA、雅思 7.0') as HTMLInputElement).value).toBe('CPA');
  });

  it('输入即写草稿：certificate 变体带名称与本地编号', async () => {
    render工作经历({ 经历: [], 教育: [完整教育], 建档: {} });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByPlaceholderText('证书或语言，如 CPA、雅思 7.0'), 'CPA');
    const 末次 = mock更新草稿.mock.calls.at(-1)![0];
    expect(末次.编辑中.种类).toBe('certificate');
    expect(末次.编辑中.字段.名称).toBe('CPA');
    expect(typeof 末次.编辑中.本地编号).toBe('string');
    expect(末次.编辑中.本地编号).not.toBe('');
  });

  it('添加证书（提交）：以草稿本地编号落列表并清空 编辑中，输入框复位', async () => {
    render工作经历({ 经历: [], 教育: [完整教育], 建档: {} });
    const 用户 = userEvent.setup();
    const 输入 = screen.getByPlaceholderText('证书或语言，如 CPA、雅思 7.0');
    await 用户.type(输入, 'CPA');
    const 本地编号 = mock更新草稿.mock.calls.at(-1)![0].编辑中.本地编号;
    await 用户.click(输入.parentElement!.querySelector('button')!);
    const 末次 = mock更新草稿.mock.calls.at(-1)![0];
    expect('编辑中' in 末次).toBe(false);
    expect(末次.资料.证书).toEqual([{ 编号: 本地编号, 名称: 'CPA', 年份: '' }]);
    expect((输入 as HTMLInputElement).value).toBe('');
  });

  it('清空输入即丢弃该层草稿（明确放弃），再刷新不回填', async () => {
    render工作经历({
      经历: [], 教育: [完整教育],
      建档: {
        编辑中: { 种类: 'certificate', 本地编号: 'c_draft', 字段: { 名称: 'CPA' } },
      },
    });
    const 用户 = userEvent.setup();
    const 输入 = screen.getByPlaceholderText('证书或语言，如 CPA、雅思 7.0');
    await 用户.clear(输入);
    const 末次 = mock更新草稿.mock.calls.at(-1)![0];
    expect('编辑中' in 末次).toBe(false);
    expect((输入 as HTMLInputElement).value).toBe('');
  });
});

// ── Task 3（candidate-profile-edit-boundaries）：技能与证书共用 简历标签录入 ──
// 证书从行式条目换成技能标签形式，但数据义务原样保留：证书键 = 原编号（同名不同
// 编号不串、按编号删除），既有年份原样保存与展示（标签补充文本，不新增年份输入），
// 新添加证书年份为空、本地编号新生成；技能沿用去重、证书空白提示保留、不新增证书
// 去重产品规则；onboarding 证书草稿恢复/清理语义不变，日常编辑零引导草稿。
describe('工作经历 · 技能/证书共用标签录入（Task 3）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
    mock确认分区.mockClear();
    mock更新草稿.mockClear();
  });

  const 同名证书: 简历证书[] = [
    { 编号: 'cert_cpa_2020', 名称: 'CPA', 年份: '2020' },
    { 编号: 'cert_cpa_2021', 名称: 'CPA', 年份: '2021' },
  ];

  it('同名不同编号证书只删除目标：按编号过滤，另一条年份/编号保存不变', async () => {
    render工作经历({ 证书: 同名证书, 经历: [], 教育: [] });
    const 用户 = userEvent.setup();
    // 两条同名标签各自带年份展示
    expect(screen.getByText('2020 年取得')).toBeTruthy();
    expect(screen.getByText('2021 年取得')).toBeTruthy();
    // 删除第二条（2021 那张）：同名删除钮按 DOM 顺序定位
    const 删除钮们 = screen.getAllByRole('button', { name: '删除证书 CPA' });
    expect(删除钮们).toHaveLength(2);
    await 用户.click(删除钮们[1]!);
    const 证书 = 存简历调用们(mock应用状态.派发).at(-1)!.证书;
    expect(证书).toEqual([{ 编号: 'cert_cpa_2020', 名称: 'CPA', 年份: '2020' }]);
    expect(screen.queryByText('2021 年取得')).toBeNull();
    expect(screen.getByText('2020 年取得')).toBeTruthy();
  });

  it('既有年份在标签中展示且保存不变；新添加证书年份为空、编号新生成不复用', async () => {
    render工作经历({ 证书: [{ 编号: 'cert_old', 名称: 'CPA', 年份: '2019' }], 经历: [], 教育: [] });
    const 用户 = userEvent.setup();
    const 输入 = screen.getByPlaceholderText('证书或语言，如 CPA、雅思 7.0');
    await 用户.type(输入, 'CET-6');
    await 用户.click(输入.parentElement!.querySelector('button')!);
    const 证书 = 存简历调用们(mock应用状态.派发).at(-1)!.证书;
    expect(证书).toEqual([
      { 编号: 'cert_old', 名称: 'CPA', 年份: '2019' },
      { 编号: expect.any(String), 名称: 'CET-6', 年份: '' },
    ]);
    expect(证书[1]!.编号).not.toBe('cert_old');
    expect(screen.getByText('2019 年取得')).toBeTruthy();
  });

  it('技能添加沿用去重：重复添加同一技能只留一条', async () => {
    render工作经历({ 技能: ['Go'], 经历: [], 教育: [] });
    const 用户 = userEvent.setup();
    const 输入 = screen.getByPlaceholderText('如：Go、分布式事务');
    // 先加一条新技能
    await 用户.type(输入, 'Rust');
    await 用户.click(输入.parentElement!.querySelector('button')!);
    expect(存简历调用们(mock应用状态.派发).at(-1)!.技能).toEqual(['Go', 'Rust']);
    // 重复添加同一技能：去重吞掉不报错，列表仍只有一条
    await 用户.type(输入, 'Rust');
    await 用户.click(输入.parentElement!.querySelector('button')!);
    expect(存简历调用们(mock应用状态.派发).at(-1)!.技能).toEqual(['Go', 'Rust']);
    expect(screen.getAllByRole('button', { name: '删除技能 Rust' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '删除技能 Go' })).toHaveLength(1);
  });

  it('证书空白提示保留：空输入点添加只轻提示，不落列表', async () => {
    render工作经历({ 经历: [], 教育: [] });
    const 用户 = userEvent.setup();
    const 输入 = screen.getByPlaceholderText('证书或语言，如 CPA、雅思 7.0');
    await 用户.click(输入.parentElement!.querySelector('button')!);
    expect(mock轻提示).toHaveBeenCalledWith('先填证书名称');
    expect(存简历调用们(mock应用状态.派发)).toHaveLength(0);
  });

  it('不新增证书去重规则：同名证书可并存，逐条删除各删各的', async () => {
    render工作经历({ 经历: [], 教育: [] });
    const 用户 = userEvent.setup();
    const 输入 = screen.getByPlaceholderText('证书或语言，如 CPA、雅思 7.0');
    await 用户.type(输入, 'CPA');
    await 用户.click(输入.parentElement!.querySelector('button')!);
    await 用户.type(输入, 'CPA');
    await 用户.click(输入.parentElement!.querySelector('button')!);
    expect(存简历调用们(mock应用状态.派发).at(-1)!.证书).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '删除证书 CPA' })).toHaveLength(2);
    // 删掉其中一条，另一条原样保留
    await 用户.click(screen.getAllByRole('button', { name: '删除证书 CPA' })[0]!);
    expect(存简历调用们(mock应用状态.派发).at(-1)!.证书).toHaveLength(1);
  });

  it('日常编辑不写引导草稿：敲技能与证书输入零 更新候选建档草稿', async () => {
    // 无 建档 → 引导预填 null → 非旅程（日常编辑），输入只落本页局部草稿
    render工作经历({ 经历: [], 教育: [] });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByPlaceholderText('如：Go、分布式事务'), 'Go');
    await 用户.type(screen.getByPlaceholderText('证书或语言，如 CPA、雅思 7.0'), 'CPA');
    expect(mock更新草稿).not.toHaveBeenCalled();
  });
});

// ── review-r1 F1：日常作品集输入在保存前不得写权威全局状态 ──────────────
// Backend 的 全局.简历作品集链接 由权威 GET 水合：输入只落本页局部意图，保存才写入。
// 否则「打字 → 离开不存 → 再进来」会把未保存的值冒充成已保存值。
describe('工作经历 · 日常作品集输入边界（review-r1 F1）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
  });

  it('Backend 打字不派发 存作品集链接：离开不保存再进来，回显权威值而非未保存输入', async () => {
    const { 卸载 } = render工作经历({ 数据源: 'backend', 经历: [], 教育: [完整教育], 作品集链接: '' });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByLabelText('作品集或项目链接'), 'github.com/shen');
    expect((screen.getByLabelText('作品集或项目链接') as HTMLInputElement).value).toBe('github.com/shen');
    // 离开页面（组件卸载），权威切片未被污染
    expect(mock应用状态.派发.mock.calls.some((c: unknown[]) => (c[0] as { 型?: string })?.型 === '存作品集链接')).toBe(false);
    卸载();
    // 重新进页（重挂载）：输入跟随权威值，不是未保存的打字值
    render(<宿主 />);
    expect((screen.getByLabelText('作品集或项目链接') as HTMLInputElement).value).toBe('');
  });

  it('Backend 未保存就重进：后续保存不带 作品集链接 属性', async () => {
    const 保存简历 = vi.fn(async (_写入: Record<string, unknown>) => {});
    const { 卸载 } = render工作经历({ 数据源: 'backend', 经历: [], 教育: [完整教育], 保存简历, 作品集链接: '' });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByLabelText('作品集或项目链接'), 'github.com/shen');
    // 卸载重挂（未保存）：局部意图已清，本轮没改 → 保存不带属性
    卸载();
    render(<宿主 />);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect('作品集链接' in 保存简历.mock.calls[0][0]).toBe(false);
  });

  it('Mock 保留原行为：打字即写全局模拟态', async () => {
    render工作经历({ 数据源: 'mock', 经历: [], 教育: [完整教育], 作品集链接: '' });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByLabelText('作品集或项目链接'), 'github.com/shen');
    expect(mock应用状态.派发).toHaveBeenCalledWith({ 型: '存作品集链接', 链接: 'github.com/shen' });
  });
});
