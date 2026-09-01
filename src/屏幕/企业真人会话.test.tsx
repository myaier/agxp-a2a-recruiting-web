// 企业真人会话 · 候选专属原件投影契约（P0）：顶部「看简历」打开的是 A-01 候选自己的原件
// 投影，而不是求职端全局简历。校准后招聘方看到的履历属于对应候选，不会串成沈亦舟的全局版本。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 企业真人会话 from './企业真人会话';

// jsdom 不实现 scrollIntoView，企业真人会话的消息流自动滚到底会调用它，桩一个空实现
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

// 全局简历经历里放一个候选 A-01 原件不会有的职位串，用于断言原件分支不读全局。
const 全局经历职位串 = '研发专家 2-2 · 交易中台';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

/** P7 Task 4：Backend 屏需要的空快照底座与 P7 操作桩。 */
function 空收件箱() {
  return { 阶段: '未开始' as const, 刷新中: false, items: [], nextCursor: null, 已加载页数: 0, error: null, generation: 0 };
}
function P7操作桩() {
  return {
    设置P7会话范围: vi.fn(),
    读取真人会话: vi.fn().mockResolvedValue(undefined),
    追加更早消息: vi.fn().mockResolvedValue(undefined),
    发送真人消息: vi.fn().mockResolvedValue({ status: 'confirmed' }),
    放弃真人消息意图: vi.fn(),
    提交真人已读: vi.fn().mockResolvedValue(undefined),
    读取简历PDF: vi.fn(),
  };
}
vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: vi.fn(), 跳转: vi.fn() }),
}));

describe('企业真人会话 · 看简历读取候选投影', () => {
  beforeEach(() => {
    mock应用状态 = {
      状态: {
        // A-01 已递交原件：真名非空 → 走候选原件投影分支
        企业候选列表: [
          { 编号: 'A-01', 岗位编号: 'P-01', 代号: '陈屿', 真名: '沈亦舟', 头像字: '陈', 阶段: '意向确认', 轮次: '第 3 轮', 下一步: '', 辅助文案: '去消息页私聊', 需要你: false, 分歧: null, 匹配分: 94, 画像: '9 年 · Go / 高并发交易 · 字节跳动' },
        ],
        // 这些是求职者自己的全局简历切片，候选原件分支不应消费
        简历经历: [{ 编号: 'G-1', 公司: '字节跳动', 职位: 全局经历职位串, 开始: '2019-06', 结束: null, 内容: '' }],
        简历教育: [],
        个人优势: '',
        基本信息: { 真名: '沈亦舟' },
      },
    };
  });

  it('企业真人会话的原件读取候选专属投影', async () => {
    const 用户 = userEvent.setup();
    render(<企业真人会话 />);
    await 用户.click(screen.getByRole('button', { name: /看简历/ }));
    // A-01 原件经历首段职位是「研发专家 · 交易中台」
    expect(screen.getByText('研发专家 · 交易中台')).toBeTruthy();
    // 全局简历里的「研发专家 2-2 · 交易中台」不应出现在候选原件分支
    expect(screen.queryByText(全局经历职位串)).toBeNull();
  });
});

// ── P7 Task 4：模式/参数双开关（镜像求职端 真人会话.test.tsx）────────────────
describe('企业真人会话 · P7 模式分支', () => {
  beforeEach(() => {
    mock应用状态 = {
      数据源模式: 'backend',
      后端状态: {
        P7收件箱: { candidate: 空收件箱(), recruiter: 空收件箱() },
        P7会话详情: {},
        P7消息页: {},
      },
      操作: P7操作桩(),
    };
  });

  it('Backend 参数路由把 conversationId 交给 Backend 真人会话（recruiter）', () => {
    render(
      <MemoryRouter initialEntries={['/hr/chat/3003']}>
        <Routes>
          <Route path="/hr/chat/:conversationId" element={<企业真人会话 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(mock应用状态.操作.设置P7会话范围).toHaveBeenCalledWith('recruiter', '3003');
    expect(mock应用状态.操作.读取真人会话).toHaveBeenCalledWith('recruiter', '3003');
  });

  it('Backend 访问无参路由 fail closed 成「会话不可用」，不渲染 Mock 真名剧情', () => {
    render(
      <MemoryRouter initialEntries={['/hr/chat']}>
        <Routes>
          <Route path="/hr/chat" element={<企业真人会话 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('会话不可用')).toBeTruthy();
    expect(screen.queryByText('沈亦舟')).toBeNull();
    expect(mock应用状态.操作.读取真人会话).not.toHaveBeenCalled();
  });
});
