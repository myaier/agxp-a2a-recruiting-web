// 候选详情（企业端）的第一个测试文件（P5 Task 5 创建，此前该屏无测试）：
// Backend 分支只渲染共享 P5 详情（屏幕/P5/MatchCase详情，role=recruiter）—— 按 URL
// case_id + 已认证角色强制读详情，不读 企业候选列表、不读匿名简历表、零 Mock 候选渲染；
// Mock 分支保持原行为（Tab/在线简历在场）且零 P5 请求；第二批（2026-09-09）起顶栏去名，见文末一组。
// 仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 候选详情 from './候选详情';
import { P5范围键 } from '../状态/后端/MatchCase操作';
import { 在谈候选列表 } from '../数据/企业端模拟数据';

// jsdom 不实现 scrollIntoView，本屏挂载后自动定位会调用它
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock派发 = vi.fn();
const mock设置P5范围 = vi.fn();
const mock读取详情 = vi.fn(async () => undefined);
const mock新增叮嘱 = vi.fn(async () => undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: mock返回, 跳转: mock跳转 }),
}));

function 渲染候选详情页(编号: string) {
  return render(
    <MemoryRouter initialEntries={[`/hr/candidate/${编号}`]}>
      <Routes>
        <Route path="/hr/candidate/:id" element={<候选详情 />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('候选详情 · Backend 分支渲染共享 P5 详情（recruiter）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock派发.mockClear();
    mock设置P5范围.mockClear();
    mock读取详情.mockClear();
    mock新增叮嘱.mockClear();
    mock应用状态 = {
      数据源模式: 'backend',
      派发: mock派发,
      状态: {
        企业候选列表: 在谈候选列表,
        候选决策: {},
        候选决策快照: {},
        决策: {},
        决策快照: {},
        叮嘱表: {},
      },
      后端状态: {
        已登录: true,
        主体: {
          subject_id: 'sub_1',
          roles: [{ role: 'recruiter', status: 'active' }],
          last_used_role: 'recruiter',
        },
        P5详情: {},
      },
      操作: {
        设置P5范围: mock设置P5范围,
        读取详情: mock读取详情,
        新增叮嘱: mock新增叮嘱,
      },
    };
  });

  it('按 URL case_id 强制读 recruiter 详情；Mock 候选（真名/代号/在线简历 Tab）不进视图', () => {
    渲染候选详情页('mc_hr');
    expect(mock设置P5范围).toHaveBeenCalledWith('recruiter', P5范围键.detail('recruiter', 'mc_hr'));
    expect(mock读取详情).toHaveBeenCalledWith('recruiter', 'mc_hr', true);
    // Mock 候选对象一个字段都不渲染（列表记忆零读取）
    expect(screen.queryByText('沈亦舟')).toBeNull();
    expect(screen.queryByText('陈屿')).toBeNull();
    expect(screen.queryByRole('button', { name: '在线简历' })).toBeNull();
    expect(screen.getByText('正在读入这一单…')).toBeTruthy();
  });
});

describe('候选详情 · Mock 分支原行为且零 P5 请求', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock派发.mockClear();
    mock设置P5范围.mockClear();
    mock读取详情.mockClear();
    mock新增叮嘱.mockClear();
    // 数据源模式 缺席 = Mock 分支（包壳屏只在 Backend 分支渲染 P5 详情）
    mock应用状态 = {
      状态: {
        企业候选列表: 在谈候选列表,
        候选决策: {},
        候选决策快照: {},
        决策: {},
        决策快照: {},
        叮嘱表: {},
      },
      派发: mock派发,
    };
  });

  it('A-01 原样渲染（在线简历 Tab 在场；顶栏已去名），零 P5 请求', async () => {
    渲染候选详情页('A-01');
    expect(await screen.findByRole('button', { name: '在线简历' })).toBeTruthy(); // Mock 的 Tab 仍在
    // 第二批（2026-09-09）：招聘端全匿名 —— 顶栏不再显示 S1 已披露的真名（沈亦舟）与代号（陈屿）
    expect(screen.queryByText('沈亦舟')).toBeNull();
    expect(screen.queryByText('陈屿')).toBeNull();
    expect(mock设置P5范围).not.toHaveBeenCalled();
    expect(mock读取详情).not.toHaveBeenCalled();
    expect(mock新增叮嘱).not.toHaveBeenCalled();
  });
});

// ── 第二批（2026-09-09 定稿）：候选详情顶栏去名 —— 标题位换成与列表卡同一套头行
//    （性别图标 + 年限｜学历｜求职状态：年限取 画像 首段、学历取 候.学历、状态取 在找「·」后半段），
//    副标题 = 画像 去掉首段年限；真名 / 代号都不上顶栏。
//    句子里的称呼（决定文案 / 终止弹层 / 附件文件名 / 规则来源）本轮不动 —— 验收 9 防误删。
describe('候选详情 · 顶栏去名（第二批 验收7/9）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock派发.mockClear();
    mock应用状态 = {
      // 记成规则 的 Mock 分支要显式 'mock' 才派发 企业新增规则（缺席只走 Mock 渲染、不走原型动作）
      数据源模式: 'mock',
      状态: {
        企业候选列表: 在谈候选列表,
        候选决策: {},
        候选决策快照: {},
        决策: {},
        决策快照: {},
        叮嘱表: {},
      },
      派发: mock派发,
    };
  });

  /** 返回栏 = 「返回」键所在的那一行 */
  function 取返回栏(): HTMLElement {
    const 栏 = screen.getByRole('button', { name: '返回' }).parentElement;
    if (!(栏 instanceof HTMLElement)) throw new Error('返回键不在返回栏内');
    return 栏;
  }

  it('验收7 · A-01（S1 已披露真名）：顶栏无真名 / 代号；有 role=img 性别图标；含年限、学历、状态；副标题不含年限段', async () => {
    渲染候选详情页('A-01');
    await screen.findByRole('button', { name: '在线简历' });
    const 栏 = 取返回栏();
    expect(within(栏).getByRole('img', { name: '男' })).toBeTruthy();
    const 栏文 = 栏.textContent ?? '';
    expect(栏文).toContain('9 年');       // 画像「9 年 · Go / 高并发交易 · 字节跳动」首段
    expect(栏文).toContain('硕士');       // 候.学历
    expect(栏文).toContain('在职看机会'); // 在找「后端工程师 · 在职看机会」后半段
    expect(栏文).not.toContain('后端工程师');
    expect(栏文).not.toContain('沈亦舟');
    expect(栏文).not.toContain('陈屿');
    expect(screen.queryByText('沈亦舟')).toBeNull();
    expect(screen.queryByText('陈屿')).toBeNull();
    // 副标题 = 画像 去掉首段年限
    expect(within(栏).getByText('Go / 高并发交易 · 字节跳动')).toBeTruthy();
    expect(screen.queryByText('9 年 · Go / 高并发交易 · 字节跳动')).toBeNull();
    // 右侧 匹配 N 与 Tab 不动
    expect(栏文).toContain('94');
    expect(screen.getByRole('button', { name: '代谈进度' })).toBeTruthy();
  });

  it('验收7 · A-07（S0 匿名初筛，真名 null）：顶栏同构，代号不上顶栏', async () => {
    渲染候选详情页('A-07');
    await screen.findByRole('button', { name: '在线简历' });
    const 栏 = 取返回栏();
    expect(within(栏).getByRole('img', { name: '女' })).toBeTruthy();
    expect(栏.textContent).toContain('10 年');
    expect(栏.textContent).toContain('本科');
    expect(栏.textContent).not.toContain('苏含章');
    expect(screen.queryByText('苏含章')).toBeNull();
    expect(within(栏).getByText('Go / 中间件 · 阿里云')).toBeTruthy();
    expect(screen.queryByText('10 年 · Go / 中间件 · 阿里云')).toBeNull();
  });

  it('验收9 · 终止弹层与终止决定文案里的代号仍在：不接受 → 「终止「陈屿」？」→ 终止 → 弹层复述「陈屿…你选择不放宽」', async () => {
    const user = userEvent.setup();
    渲染候选详情页('A-01');
    await user.click(await screen.findByRole('button', { name: '不接受' }));
    expect(screen.getByText('终止「陈屿」？')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '终止' }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '候选终止', 编号: 'A-01' });
    // 拿不准弹层 的灰托盘复述决定：句首仍是代号（8/25 留的"句子里的称呼"问题另议）
    expect(screen.getByText(/^陈屿.*你选择不放宽 —— AI代理已终止接触并归档/)).toBeTruthy();
  });

  it('验收9 · 接受决定文案与规则来源里的代号仍在：接受 → 弹层复述「陈屿…你同意放宽」→ 记成规则 派发 来自「陈屿」单的决策', async () => {
    const user = userEvent.setup();
    渲染候选详情页('A-01');
    await user.click(await screen.findByRole('button', { name: '接受' }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '候选接受方案', 编号: 'A-01' });
    expect(screen.getByText(/^陈屿.*你同意放宽 —— AI代理会立刻回报对方/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '记成规则' }));
    expect(mock派发).toHaveBeenCalledWith(
      expect.objectContaining({ 型: '企业新增规则', 来源: '来自「陈屿」单的决策' }),
    );
  });

  it('验收9 · 递交简历段的附件文件名仍用代号（A-02 顾晚舟_简历.pdf）；顶栏同样不出真名', async () => {
    渲染候选详情页('A-02');
    expect(await screen.findByText('顾晚舟_简历.pdf')).toBeTruthy();
    expect(screen.queryByText('林若衡')).toBeNull(); // A-02 的 S1 真名
    expect(screen.queryByText('顾晚舟')).toBeNull(); // 裸代号不上顶栏（文件名里的代号是另一回事）
    const 栏 = 取返回栏();
    expect(within(栏).getByRole('img', { name: '女' })).toBeTruthy();
    expect(栏.textContent).toContain('11 年');
    expect(栏.textContent).toContain('本科');
  });
});
