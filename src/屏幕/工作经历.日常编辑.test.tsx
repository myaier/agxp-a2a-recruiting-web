// 工作经历 · 日常分区编辑（合同 A URL 表 / Spec §5.1–5.2）：
// /experience?from=resume&section=work|education|skills|certificates（+ item=<编号>|new）。
// 分区列表只做导航（没有第二次「总保存」），条目编辑器里的「保存」是唯一一份保存责任：
// 成功回原简历（直接条目）或回本地分区列表（列表内打开的条目），取消/返回只丢局部草稿
// —— 零派发、零隐私写、零 保存简历。旧 /experience?from=resume 与未知 section 替换归一
// 为 work 分区列表，不再展示整份聚合页。真实浏览器历史栈证据归 Task 5。

import {
  mock跳转,
  mock返回,
  mock替换跳转,
  mock轻提示,
  mock确认分区,
  mock更新草稿,
  mock应用状态,
  简历经历初始,
  render工作经历,
  存简历调用们,
  登记工作经历,
} from './工作经历.测试辅助';
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 路径 } from '../路由/路径表';
import { 创建候选编辑来路 } from '../流程/候选日常编辑';
import type { 简历证书, 简历教育段 } from '../数据/类型';
import userEvent from '@testing-library/user-event';
import 工作经历 from './工作经历';

登记工作经历(工作经历);

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回, 替换跳转: mock替换跳转 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

// 日期倒置校验等会读 本月()；本组用例只关心分区路由与保存链，不构造时间边界。
// 置当前格号：react-router 把格号写在 history.state.idx（导航钩子同源取法）。
function 置格号(idx: number) {
  window.history.replaceState({ idx, key: `k${idx}`, usr: null }, '');
}

/** 带合法来路证明的日常入口：来源格号 +1 即「本会话从我的简历 push 进来」。
 *  返回完整位置（不是 入口形 的字符串支）—— 归一用例要断言转交下去的正是这份 state。 */
function 编辑入口(search: string): { pathname: string; search: string; state: unknown } {
  置格号(4);
  const 来路 = 创建候选编辑来路('resume');
  置格号(5);
  return { pathname: 路径.工作经历, search, state: 来路 };
}

/** 保存简历 桩的显式入参形状：next 是页面简历写入，第二参是保存来源 */
type 保存简历调用 = [Record<string, unknown>, string?];

/** 第 n 次 保存简历 的 next（字段形状由用例断言，避免 any 扩散） */
function 取保存next(桩: ReturnType<typeof vi.fn>, 序 = 0): Record<string, unknown> {
  return (桩.mock.calls as unknown as 保存简历调用[])[序]![0];
}

/** 第 n 次 保存简历 的保存来源 */
function 取保存来源(桩: ReturnType<typeof vi.fn>, 序 = 0): string | undefined {
  return (桩.mock.calls as unknown as 保存简历调用[])[序]![1];
}

const 教育行: 简历教育段 = {
  编号: 'edu_1', 学校: '复旦大学', 学历: '硕士', 专业: '计算机', 开始: '2019-09', 结束: '2023-06',
};

const 证书行: 简历证书[] = [
  { 编号: 'cert_old', 名称: 'CPA', 年份: '2019' },
  { 编号: 'cert_new', 名称: '雅思', 年份: '2022' },
];

/** 零 onboarding 副作用：分区确认与建档草稿一次都不该被碰（日常域隔离） */
function 零建档副作用() {
  expect(mock确认分区).not.toHaveBeenCalled();
  expect(mock更新草稿).not.toHaveBeenCalled();
}

beforeEach(() => {
  mock跳转.mockClear();
  mock返回.mockClear();
  mock替换跳转.mockClear();
  mock轻提示.mockClear();
  mock确认分区.mockClear();
  mock更新草稿.mockClear();
  window.history.replaceState(null, '');
});

describe('工作经历 · 日常分区 URL（合同 A）', () => {
  it('work 无 item：只显示工作分区列表，没有第二次总保存', () => {
    render工作经历({ 数据源: 'mock', 入口: 编辑入口('?from=resume&section=work') });
    expect(screen.getByRole('button', { name: /添加工作经历/ })).toBeTruthy();
    expect(screen.getByText('字节跳动')).toBeTruthy();
    // 其余分区与作品集都不在整份聚合页里出现
    expect(screen.queryByText('证书与语言')).toBeNull();
    expect(screen.queryByPlaceholderText('如：Go、分布式事务')).toBeNull();
    expect(screen.queryByLabelText('作品集或项目链接')).toBeNull();
    // 分区列表没有「总保存」：唯一一份保存责任在条目编辑器里
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull();
  });

  // codex review-r1 F2：归一必须保留合法来路 state —— 替换跳转 只传 {replace:true} 会用
  // undefined 顶掉 location.state，use候选编辑退出 三条件必然失败，只能安全替换回我的简历，
  // 历史里留下两张简历页（合同 A 明文「保留合法来路」）。故断言从单参升级为「目标 + 来路」。
  it('旧 /experience?from=resume（无 section）替换归一为 work 分区列表，不展示聚合页', () => {
    const 入口 = 编辑入口('?from=resume');
    render工作经历({ 数据源: 'mock', 入口 });
    expect(mock替换跳转).toHaveBeenCalledWith(
      `${路径.工作经历}?from=resume&section=work`,
      入口.state,
    );
    expect(screen.getByRole('button', { name: /添加工作经历/ })).toBeTruthy();
    expect(screen.queryByText('证书与语言')).toBeNull();
    expect(存简历调用们(mock应用状态.派发)).toHaveLength(0);
  });

  it('归一替换原样转交当前来路 state：退出仍能按来路退一格', () => {
    const 入口 = 编辑入口('?from=resume&section=evil');
    render工作经历({ 数据源: 'mock', 入口 });
    expect(mock替换跳转).toHaveBeenCalledWith(
      `${路径.工作经历}?from=resume&section=work`,
      入口.state,
    );
  });

  it('未知 section 同样归一为 work 分区列表，零写入', () => {
    const 入口 = 编辑入口('?from=resume&section=evil');
    render工作经历({ 数据源: 'mock', 入口 });
    expect(mock替换跳转).toHaveBeenCalledWith(
      `${路径.工作经历}?from=resume&section=work`,
      入口.state,
    );
    expect(screen.getByRole('button', { name: /添加工作经历/ })).toBeTruthy();
    expect(存简历调用们(mock应用状态.派发)).toHaveLength(0);
  });

  it('education 无 item：教育分区列表（含添加行），工作经历区不在场', () => {
    render工作经历({
      数据源: 'mock', 教育: [教育行], 经历: [简历经历初始[0]],
      入口: 编辑入口('?from=resume&section=education'),
    });
    expect(screen.getByText('复旦大学')).toBeTruthy();
    expect(screen.getByRole('button', { name: /添加教育经历/ })).toBeTruthy();
    expect(screen.queryByText('字节跳动')).toBeNull();
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull();
  });

  it('certificates 无 item：证书分区列表（名称 + 年份），工作/教育区不在场', () => {
    render工作经历({
      数据源: 'mock', 证书: 证书行, 教育: [教育行], 经历: [简历经历初始[0]],
      入口: 编辑入口('?from=resume&section=certificates'),
    });
    expect(screen.getByText('CPA')).toBeTruthy();
    expect(screen.getByText('2019 年取得')).toBeTruthy();
    expect(screen.getByRole('button', { name: /添加证书/ })).toBeTruthy();
    expect(screen.queryByText('字节跳动')).toBeNull();
    expect(screen.queryByText('复旦大学')).toBeNull();
  });

  it('skills：只显示技能分区（受控标签编辑），其它分区不在场', () => {
    render工作经历({
      数据源: 'mock', 技能: ['Go'], 证书: 证书行, 教育: [教育行], 经历: [简历经历初始[0]],
      入口: 编辑入口('?from=resume&section=skills'),
    });
    expect(screen.getByPlaceholderText('如：Go、分布式事务')).toBeTruthy();
    expect(screen.getByRole('button', { name: '删除技能 Go' })).toBeTruthy();
    expect(screen.queryByText('证书与语言')).toBeNull();
    expect(screen.queryByText('字节跳动')).toBeNull();
  });

  it('from=resume 不带已知来源白名单值时仍是原来的聚合页（错配来源等同无来源）', () => {
    render工作经历({ 数据源: 'mock', 入口: `${路径.工作经历}?from=evil` });
    // 聚合页：四块都在场（旧行为逐字保留）
    expect(screen.getByText('证书与语言')).toBeTruthy();
    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy();
    expect(mock替换跳转).not.toHaveBeenCalled();
  });
});

describe('工作经历 · 日常条目直达（item）', () => {
  it('已有工作条目按编号直达编辑器，按钮为保存', () => {
    render工作经历({
      数据源: 'mock', 经历: [简历经历初始[0]],
      入口: 编辑入口('?from=resume&section=work&item=e1'),
    });
    expect(screen.getByText('编辑工作经历')).toBeTruthy();
    expect(screen.getByText('字节跳动')).toBeTruthy();
    expect((screen.getByPlaceholderText('必填') as HTMLInputElement).value).toBe('后端开发');
    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '完成' })).toBeNull();
  });

  it('item=new 直接打开空条目编辑器', () => {
    render工作经历({
      数据源: 'mock', 经历: [简历经历初始[0]],
      入口: 编辑入口('?from=resume&section=work&item=new'),
    });
    expect(screen.getByText('添加工作经历')).toBeTruthy();
    expect((screen.getByPlaceholderText('必填') as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy();
  });

  it('不存在的 id 不落「新增」：显示已不可用并可返回，不渲染空编辑器', () => {
    render工作经历({
      数据源: 'mock', 经历: [简历经历初始[0]],
      入口: 编辑入口('?from=resume&section=work&item=e404'),
    });
    expect(screen.getByText('这条内容已不可用，可能已在其他设备删除。')).toBeTruthy();
    expect(screen.queryByText('添加工作经历')).toBeNull();
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull();
    expect(screen.queryByPlaceholderText('必填')).toBeNull();
  });

  it('education 带 item 直接编辑该条', () => {
    render工作经历({
      数据源: 'mock', 教育: [教育行],
      入口: 编辑入口('?from=resume&section=education&item=edu_1'),
    });
    expect(screen.getByText('教育经历')).toBeTruthy();
    expect(screen.getByText('复旦大学')).toBeTruthy();
    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy();
  });

  it('certificates 带 item 指定证书可编辑：名称与年份回显，保存带回该条新年份', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({
      数据源: 'mock', 证书: 证书行, 保存简历,
      入口: 编辑入口('?from=resume&section=certificates&item=cert_old'),
    });
    const 名输入 = screen.getByDisplayValue('CPA') as HTMLInputElement;
    const 年输入 = screen.getByDisplayValue('2019') as HTMLInputElement;
    const 用户 = userEvent.setup();
    await 用户.clear(年输入);
    await 用户.type(年输入, '2021');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    expect(名输入.value).toBe('CPA');
    const next = 取保存next(保存简历);
    expect(next.证书).toEqual([
      { 编号: 'cert_old', 名称: 'CPA', 年份: '2021' },
      { 编号: 'cert_new', 名称: '雅思', 年份: '2022' },
    ]);
    expect(取保存来源(保存简历)).toBe('日常编辑');
    零建档副作用();
  });

  it('certificates item=new：空编辑器可新增，保存带新条目', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({
      数据源: 'mock', 证书: 证书行, 保存简历,
      入口: 编辑入口('?from=resume&section=certificates&item=new'),
    });
    const 用户 = userEvent.setup();
    await 用户.type(screen.getByLabelText('证书名称'), 'PMP');
    await 用户.type(screen.getByLabelText('取得年份'), '2023');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    const next = 取保存next(保存简历);
    expect((next.证书 as 简历证书[]).slice(0, 2)).toEqual(证书行);
    expect((next.证书 as 简历证书[])[2]).toMatchObject({ 名称: 'PMP', 年份: '2023' });
  });
});

describe('工作经历 · 日常保存与取消（一份保存责任、取消零写）', () => {
  it('直接条目保存：只发一次 保存简历（带日常编辑），随后退一格回我的简历', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({
      数据源: 'mock', 经历: [简历经历初始[0]], 保存简历,
      入口: 编辑入口('?from=resume&section=work&item=e1'),
    });
    const 用户 = userEvent.setup();
    await 用户.clear(screen.getByPlaceholderText('必填'));
    await 用户.type(screen.getByPlaceholderText('必填'), '资深后端');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    const next = 取保存next(保存简历) as unknown as { 经历: { 编号: string; 职位: string }[] };
    expect(next.经历).toHaveLength(1);
    expect(next.经历[0]).toMatchObject({ 编号: 'e1', 职位: '资深后端' });
    expect(取保存来源(保存简历)).toBe('日常编辑');
    // 回原简历：来路证明成立时退一格；不 push 新页（跳转一次都不该发生）
    await waitFor(() => expect(mock返回).toHaveBeenCalledTimes(1));
    expect(mock替换跳转).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    零建档副作用();
  });

  it('列表内打开条目保存：回本地分区列表，不退出整页、不要求第二次总保存', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({
      数据源: 'mock', 经历: [简历经历初始[0]], 保存简历,
      入口: 编辑入口('?from=resume&section=work'),
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('字节跳动'));
    expect(screen.getByText('编辑工作经历')).toBeTruthy();
    await 用户.clear(screen.getByPlaceholderText('必填'));
    await 用户.type(screen.getByPlaceholderText('必填'), '资深后端');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    // 回本地分区列表：列表在场，且没有任何退出导航
    await waitFor(() => expect(screen.getByRole('button', { name: /添加工作经历/ })).toBeTruthy());
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
  });

  it('取消：零隐私写、零 保存简历、零派发，按来路退一格', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({
      数据源: 'mock', 经历: [简历经历初始[0]], 保存简历,
      入口: 编辑入口('?from=resume&section=work&item=e1'),
    });
    const 用户 = userEvent.setup();
    await 用户.clear(screen.getByPlaceholderText('必填'));
    await 用户.type(screen.getByPlaceholderText('必填'), '不要保存');
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(保存简历).not.toHaveBeenCalled();
    expect(mock应用状态.派发).not.toHaveBeenCalled();
    expect(mock返回).toHaveBeenCalledTimes(1);
    expect(mock替换跳转).not.toHaveBeenCalled();
    零建档副作用();
  });

  it('无来路证明（刷新/深链）：安全替换回我的简历，不盲退', async () => {
    const 保存简历 = vi.fn(async () => {});
    // 深链直达条目（没有 history 来路证明）：取消只能安全替换，不能盲退外站
    render工作经历({
      数据源: 'mock', 经历: [简历经历初始[0]], 保存简历,
      入口: `${路径.工作经历}?from=resume&section=work&item=e1`,
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).toHaveBeenCalledWith(路径.我的简历);
    expect(保存简历).not.toHaveBeenCalled();
  });

  it('连续两次编辑都不 push 编辑页：两次都只退一格，不回到刚退出的那一屏', async () => {
    const 保存简历 = vi.fn(async () => {});
    // 第一次编辑（我的简历格号 4 → 编辑页格号 5）
    const 首次 = render工作经历({
      数据源: 'mock', 经历: [简历经历初始[0]], 保存简历,
      入口: 编辑入口('?from=resume&section=work&item=e1'),
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock返回).toHaveBeenCalledTimes(1));
    首次.卸载();
    // 第二次编辑（我的简历格号 5 → 编辑页格号 6）：同样的退一格，同样零 push
    const 二次 = render工作经历({
      数据源: 'mock', 经历: [简历经历初始[0]], 教育: [教育行], 保存简历,
      入口: 编辑入口('?from=resume&section=education&item=edu_1'),
    });
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock返回).toHaveBeenCalledTimes(2));
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock替换跳转).not.toHaveBeenCalled();
    二次.卸载();
  });

  it('skills 保存：本地标签草稿随一次 保存简历 提交，未保存输入不污染全局', async () => {
    const 保存简历 = vi.fn(async () => {});
    render工作经历({
      数据源: 'mock', 技能: ['Go'], 经历: [简历经历初始[0]], 保存简历,
      入口: 编辑入口('?from=resume&section=skills'),
    });
    const 用户 = userEvent.setup();
    const 输入 = screen.getByPlaceholderText('如：Go、分布式事务');
    await 用户.type(输入, 'Rust');
    await 用户.click(输入.parentElement!.querySelector('button')!);
    // 输入只落本页局部草稿：没有 保存简历，也没有 存简历 派发
    expect(保存简历).not.toHaveBeenCalled();
    expect(存简历调用们(mock应用状态.派发)).toHaveLength(0);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    const next = 取保存next(保存简历) as unknown as { 技能: string[]; 经历: { 编号: string }[] };
    expect(next.技能).toEqual(['Go', 'Rust']);
    // 未编辑分区原样带回（同一条权威对象 → 数据源 diff 不产生写）
    expect(next.经历[0]).toBe(简历经历初始[0]);
    expect(取保存来源(保存简历)).toBe('日常编辑');
    // 分区级编辑成功后退出回原简历（没有第二层列表）
    await waitFor(() => expect(mock返回).toHaveBeenCalledTimes(1));
  });

  it('education「至今在读」（结束为空）是合法状态：不被教育缺项误拦', async () => {
    const 保存简历 = vi.fn(async () => {});
    const 在读教育: 简历教育段 = { ...教育行, 结束: '' };
    render工作经历({
      数据源: 'mock', 教育: [在读教育], 保存简历,
      入口: 编辑入口('?from=resume&section=education&item=edu_1'),
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '硕士' }));
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(1));
    const next = 取保存next(保存简历) as unknown as { 教育: 简历教育段[] };
    expect(next.教育[0]).toMatchObject({ 编号: 'edu_1', 学历: '硕士', 结束: '' });
    expect(mock轻提示).not.toHaveBeenCalledWith('教育经历还缺学校、学历、专业或就读时间');
  });

  it('保存失败留页可重试：锁释放、输入保留、零退出', async () => {
    const 保存简历 = vi.fn(async () => { throw new Error('offline'); });
    render工作经历({
      数据源: 'mock', 经历: [简历经历初始[0]], 保存简历,
      入口: 编辑入口('?from=resume&section=work&item=e1'),
    });
    const 用户 = userEvent.setup();
    await 用户.clear(screen.getByPlaceholderText('必填'));
    await 用户.type(screen.getByPlaceholderText('必填'), '重试职位');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('请求失败，请稍后再试'));
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).not.toHaveBeenCalled();
    expect((screen.getByPlaceholderText('必填') as HTMLInputElement).value).toBe('重试职位');
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(保存简历).toHaveBeenCalledTimes(2));
  });
});
