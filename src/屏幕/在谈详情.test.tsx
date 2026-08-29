// 在谈详情 · P5 Task 5：Backend 分支的接线契约（旧 P1C「公司槽只读」面随 P5 详情整体退场）。
// Backend 下这一屏只渲染共享 P5 详情（屏幕/P5/MatchCase详情）：按 URL case_id + 已认证角色
// 强制读详情，不读 在谈列表、不水合 Mock 在谈单、不调公司档案/企业详情导航，匹配对齐卡与
// 职位详情 Tab（P5.1 依赖）不再出现；Mock 分支仍按原 slug 导航、行为与接线前逐字一致。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 在谈详情 from './在谈详情';
import { 在谈列表 } from '../数据/模拟数据';
import { P5范围键 } from '../状态/后端/MatchCase操作';

// jsdom 不实现 scrollIntoView，本屏挂载后自动定位会调用它
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock派发 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: mock返回, 跳转: mock跳转 }),
}));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

const { mock公司路由键, mock取公司档案 } = vi.hoisted(() => {
  const 静态档案 = {
    键: 'douyin',
    名称: '抖音',
    首字: '抖',
    规模行: '未上市 · 10000 人以上 · 短视频与内容平台',
    地址: '北京市海淀区北三环西路甲 18 号',
    简介: ['短视频与内容平台'],
    工商信息: [{ 项: '成立日期', 值: '2016-03-01' }],
  };
  return {
    mock公司路由键: vi.fn((名称: string) => `slug-${名称}`),
    mock取公司档案: vi.fn(() => 静态档案),
  };
});
vi.mock('../数据/公司档案', () => ({
  公司路由键: mock公司路由键,
  取公司档案: mock取公司档案,
}));

const mock设置P5范围 = vi.fn();
const mock读取详情 = vi.fn(async () => undefined);
const mock新增叮嘱 = vi.fn(async () => undefined);

const 本单 = 在谈列表.find((条) => 条.编号 === 'J-01')!;

/** 渲染在 J-01 的详情路由（Backend 分支下 ?tab=job 已无对应 Tab，参数被忽略） */
function 渲染详情页() {
  return render(
    <MemoryRouter initialEntries={['/deal/J-01?tab=job']}>
      <Routes>
        <Route path="/deal/:id" element={<在谈详情 />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Mock 分支用：渲染在 J-01 的「职位详情」Tab（与真人会话「看职位」同一落点） */
function 渲染职位Tab() {
  return render(
    <MemoryRouter initialEntries={['/deal/J-01?tab=job']}>
      <Routes>
        <Route path="/deal/:id" element={<在谈详情 />} />
      </Routes>
    </MemoryRouter>,
  );
}

function 断言匹配卡在条件段与公司之前() {
  const 匹配卡标题 = screen.getByText('匹配度分析');
  const 职位要求 = screen.getAllByText('职位要求')[0];
  const 公司名 = screen.getByText(本单.公司);
  expect(匹配卡标题).toBeTruthy();
  expect(匹配卡标题.compareDocumentPosition(职位要求) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(匹配卡标题.compareDocumentPosition(公司名) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe('在谈详情 · Backend 分支渲染共享 P5 详情', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock派发.mockClear();
    mock公司路由键.mockClear();
    mock取公司档案.mockClear();
    mock设置P5范围.mockClear();
    mock读取详情.mockClear();
    mock新增叮嘱.mockClear();
    mock应用状态 = {
      状态: {
        在谈列表,
        决策: {},
        决策快照: {},
        叮嘱表: {},
        简历文件名: '',
        简历经历: [],
        简历教育: [],
        简历技能: [],
      },
      派发: mock派发,
      数据源模式: 'backend',
      后端状态: {
        已登录: true,
        主体: {
          subject_id: 'sub_1',
          roles: [{ role: 'candidate', status: 'active' }],
          last_used_role: 'candidate',
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

  it('按 URL case_id 强制读 P5 详情；不读公司档案、不跳企业详情、P5.1 面整体退场', () => {
    渲染详情页();
    expect(mock设置P5范围).toHaveBeenCalledWith('candidate', P5范围键.detail('candidate', 'J-01'));
    expect(mock读取详情).toHaveBeenCalledWith('candidate', 'J-01', true);
    // 旧 Backend 公司槽/匹配对齐卡/职位详情 Tab（P5.1 依赖）不再渲染，也不再请求
    expect(mock取公司档案).not.toHaveBeenCalled();
    expect(mock公司路由键).not.toHaveBeenCalled();
    expect(mock跳转.mock.calls.every(([目标]) => !String(目标).startsWith('/company/'))).toBe(true);
    expect(screen.queryByText('匹配度分析')).toBeNull();
    expect(screen.queryByRole('button', { name: '职位详情' })).toBeNull();
    expect(screen.queryByText(本单.公司)).toBeNull(); // Mock 在谈单不进 Backend 视图
    expect(screen.getByText('正在读入这一单…')).toBeTruthy();
  });
});

describe('在谈详情 · Mock 公司卡仍按原 slug 导航', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock派发.mockClear();
    mock公司路由键.mockClear();
    mock取公司档案.mockClear();
    mock应用状态 = {
      状态: {
        在谈列表,
        决策: {},
        决策快照: {},
        叮嘱表: {},
        简历文件名: '',
        简历经历: [],
        简历教育: [],
        简历技能: [],
      },
      派发: mock派发,
    };
  });

  it('公司卡可点，跳 公司路由键 生成的原 slug', async () => {
    渲染职位Tab();
    断言匹配卡在条件段与公司之前();
    await userEvent.click(screen.getByRole('button', { name: new RegExp(本单.公司) }));
    expect(mock公司路由键).toHaveBeenCalledWith(本单.公司);
    expect(mock跳转).toHaveBeenCalledWith(`/company/slug-${本单.公司}`);
  });
});
