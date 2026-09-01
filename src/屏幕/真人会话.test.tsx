// 真人会话 · P1C Task 5（Mock 分支）：「看职位」全屏层的公司槽接线契约 ——
// Mock 公司卡仍按原 slug 导航，匹配对齐卡位于职位条件段与公司区块之前。
// P7 Task 4：本屏改为模式/参数双开关 —— Backend 参数路由把 conversationId 交给
// P7 Backend 真人会话；Backend 访问无参路由 fail closed 成「会话不可用」；
// Mock 无参路由保留 J-01 剧情。P1C 时代的「Backend 看职位层公司槽只读」契约
// 已被 Task 4 的权威岗位详情路由取代（看职位不再盖 Mock 层）。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 真人会话 from './真人会话';
import { 在谈列表 } from '../数据/模拟数据';
// review-r3：scope 隔离合同的源码读取（仓库既有 ?raw 模式）
import 真人会话tsx源码 from './真人会话.tsx?raw';
import 企业真人会话tsx源码 from './企业真人会话.tsx?raw';
import Backend真人会话tsx源码 from './P7/Backend真人会话.tsx?raw';

// jsdom 不实现 scrollIntoView，消息流自动滚到底会调用它
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

const mock跳转 = vi.fn();
const mock返回 = vi.fn();

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

const 本单 = 在谈列表.find((条) => 条.编号 === 'J-01')!;

/** P7 Task 4：Backend 屏需要的空收件箱快照底座。 */
function 空收件箱() {
  return {
    阶段: '未开始' as const, 刷新中: false, items: [], nextCursor: null,
    已加载页数: 0, error: null, generation: 0,
  };
}

function 渲染() {
  return render(
    <MemoryRouter initialEntries={['/chat/human']}>
      <Routes>
        <Route path="/chat/human" element={<真人会话 />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** 打开「看职位」全屏层，返回用户句柄 */
async function 打开看职位层() {
  const 用户 = userEvent.setup();
  渲染();
  await 用户.click(screen.getByRole('button', { name: /看职位/ }));
  return 用户;
}

function 断言匹配卡在条件段与公司之前() {
  const 匹配卡标题 = screen.getByText('匹配度分析');
  const 职位要求 = screen.getAllByText('职位要求')[0];
  const 公司名 = screen.getByText(本单.公司);
  expect(匹配卡标题).toBeTruthy();
  expect(匹配卡标题.compareDocumentPosition(职位要求) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(匹配卡标题.compareDocumentPosition(公司名) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

// P7 Task 4：Backend 参数路由把坐标交给 P7 屏；无参路由 fail closed。
describe('真人会话 · P7 模式分支', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock应用状态 = {
      数据源模式: 'backend',
      状态: { 在谈列表, 简历经历: [], 简历教育: [], 简历技能: [] },
      派发: vi.fn(),
      后端状态: {
        P7收件箱: { candidate: 空收件箱(), recruiter: 空收件箱() },
        P7会话详情: {},
        P7消息页: {},
      },
      操作: {
        设置P7会话范围: vi.fn(),
        读取真人会话: vi.fn().mockResolvedValue(undefined),
        追加更早消息: vi.fn().mockResolvedValue(undefined),
        发送真人消息: vi.fn().mockResolvedValue({ status: 'confirmed' }),
        放弃真人消息意图: vi.fn(),
        提交真人已读: vi.fn().mockResolvedValue(undefined),
        读取简历PDF: vi.fn(),
      },
    };
  });

  it('Backend 参数路由把 conversationId 交给 Backend 真人会话（candidate）', () => {
    render(
      <MemoryRouter initialEntries={['/chat/human/3003']}>
        <Routes>
          <Route path="/chat/human/:conversationId" element={<真人会话 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(mock应用状态.操作.设置P7会话范围).toHaveBeenCalledWith('candidate', '3003');
    expect(mock应用状态.操作.读取真人会话).toHaveBeenCalledWith('candidate', '3003');
  });

  it('Backend 访问无参路由 fail closed 成「会话不可用」，绝不读默认 J-01', () => {
    render(
      <MemoryRouter initialEntries={['/chat/human']}>
        <Routes>
          <Route path="/chat/human" element={<真人会话 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('会话不可用')).toBeTruthy();
    expect(screen.queryByText('林筱')).toBeNull();
    expect(mock应用状态.操作.读取真人会话).not.toHaveBeenCalled();
  });

  it('Mock 无参路由保留 J-01 剧情', () => {
    mock应用状态 = {
      数据源模式: 'mock',
      状态: { 在谈列表, 简历经历: [], 简历教育: [], 简历技能: [] },
      派发: vi.fn(),
    };
    render(
      <MemoryRouter initialEntries={['/chat/human']}>
        <Routes>
          <Route path="/chat/human" element={<真人会话 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('林筱')).toBeTruthy();
    expect(mock应用状态.操作?.读取真人会话).toBeUndefined();
  });
});

describe('真人会话 · Mock 公司卡仍按原 slug 导航', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock公司路由键.mockClear();
    mock取公司档案.mockClear();
    mock应用状态 = {
      状态: {
        在谈列表,
        简历经历: [],
        简历教育: [],
        简历技能: [],
      },
      派发: vi.fn(),
    };
  });

  it('看职位层公司卡可点，跳 公司路由键 生成的原 slug', async () => {
    await 打开看职位层();
    断言匹配卡在条件段与公司之前();
    await userEvent.click(screen.getByRole('button', { name: new RegExp(本单.公司) }));
    expect(mock公司路由键).toHaveBeenCalledWith(本单.公司);
    expect(mock跳转).toHaveBeenCalledWith(`/company/slug-${本单.公司}`);
  });
});


// ── P8 Task 7：Mock 真人会话调用点的举报层回归 ──────────────────────
//   共用 举报层 的可选 target/已确认/目标失效 扩展绝不能改变本调用点的既有行为：
//   ⋯ 打开层、本地拉黑（屏蔽顾问所属机构）、固定 toast、关层，零 P8 操作。
describe('真人会话 · Mock 举报层调用点（P7 Task 7 回归）', () => {
  it('⋯ → 举报层：本地拉黑 + 关层，零 P8 操作', async () => {
    const mock派发 = vi.fn();
    mock应用状态 = {
      数据源模式: 'mock',
      状态: { 在谈列表, 简历经历: [], 简历教育: [], 简历技能: [] },
      派发: mock派发,
    };
    const 用户 = userEvent.setup();
    渲染();
    await 用户.click(screen.getByRole('button', { name: '举报' }));
    expect(screen.getByRole('dialog', { name: '举报' })).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '骚扰' }));
    await 用户.click(screen.getByRole('button', { name: /同时屏蔽铨衡人才/ }));
    await 用户.click(screen.getByRole('button', { name: '提交举报' }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '拉黑', 名称: '铨衡人才' });
    expect(screen.queryByRole('dialog', { name: '举报' })).toBeNull();
  });
});

// ── review-r3：换会话 scope 隔离的源码合同（key 重挂 + layout-effect 代际）────────
describe('真人会话 · review-r3 scope 隔离合同', () => {
  it('双端父屏按 conversationId key 重挂 Backend 真人会话；卸载敏感代际用 useLayoutEffect', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const 真人会话源码 = 真人会话tsx源码;
    const 企业源码 = 企业真人会话tsx源码;
    const 屏源码 = Backend真人会话tsx源码;
    expect(真人会话源码.includes('key={conversationId}')).toBe(true);
    expect(企业源码.includes('key={conversationId}')).toBe(true);
    // 卸载/换会话敏感的代际推进与租约回收必须与提交同步（先于绘制）
    expect(屏源码.includes('useLayoutEffect')).toBe(true);
    expect(屏源码.includes('useLayoutEffect(() => {')).toBe(true);
  });
});
