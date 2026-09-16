// 应用状态 · 运行域（P2/P4/P5/P6/P8/接触记录运行时）
// 由 src/状态/应用状态.test.ts 按冻结归属拆出：P2/P4/P5/P6/P8/接触记录运行时→运行域（含消歧：接触记录会话边界、P6 会话水合与清理、委托待核对运行时接线→本文件）。

import { createElement, useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 初始状态, use应用状态, 应用状态提供者 } from './应用状态';
import { BFF主体样本, BFFCandidateJob样本, BFFAgent规则样本 } from '../测试/BFF样本';
import { BFF错误 } from '../数据/HTTP客户端';
import { type BFF附件简历库 } from '../数据/BFF契约';
import { type P5列表页 } from '../数据/招聘数据源/MatchCase';
import { P5范围键, 清P5MatchCase引用 } from './后端/MatchCase操作';
import { 委托待核对键 } from './后端/委托待核对';
import { type P8Credential } from '../数据/招聘数据源/P8控制面';
import { type 接触事件, type 接触事件页 } from '../数据/招聘数据源/接触记录';
import { type HTTP招聘数据源 } from '../数据/HTTP招聘数据源';
import { deferred, 连续记录A, 连续Case坐标, 连续卡片, 连续聚合DTO, 创建后端桩, 通过测试手机登录, 创建Map存储 } from './应用状态.测试辅助';

beforeEach(() => {
  try {
    globalThis.sessionStorage.clear();
  } catch {
    // 个别存储降级测试会故意提供不可用实现。
  }
});
// J-PILOT-01 Task 2 fix 探针：主体基串 effect 对 清P5MatchCase引用 的组合参数（是否
// 带上 alias 对照）无法经后端状态观察 —— 用透传 delegation 桩记录调用参数，行为保持原实现。
vi.mock('./后端/MatchCase操作', async (importOriginal) => {
  const 原 = await importOriginal<typeof import('./后端/MatchCase操作')>();
  return { ...原, 清P5MatchCase引用: vi.fn(原.清P5MatchCase引用) };
});


// ── 接触记录（contact-events）：Provider 种子 / 会话边界清理 / 主体隔离 ──────────

describe('应用状态提供者 接触记录会话边界', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.stubGlobal('WebSocket', class {
      onopen: (() => void) | null = null;
      onmessage: ((事件: { data: string }) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {}
      close() { this.onclose?.(); }
    });
  });

  const 事件: 接触事件 = {
    eventId: 'cev_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    organization: {
      organizationId: 'org_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      displayName: 'Acme',
    },
    action: 'contact_started',
    occurredAt: '2026-09-01T08:00:00Z',
  };

  const pristine快照 = {
    ownerSubjectId: null,
    阶段: '未开始' as const,
    刷新中: false,
    items: [],
    nextCursor: null,
    已加载页数: 0,
    error: null,
    generation: 0,
  };

  it('candidate 加载成功后登出，接触记录回 pristine', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取接触事件).mockResolvedValueOnce({ items: [事件], nextCursor: null });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.加载接触记录(); });
    expect(当前.后端状态.接触记录.items).toEqual([事件]);
    await act(async () => { await 当前.操作.退出登录(); });
    expect(当前.后端状态.已登录).toBe(false);
    expect(当前.后端状态.接触记录).toEqual(pristine快照);
  });

  it('candidate 加载成功后切 recruiter，不保留 candidate 记录', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取接触事件).mockResolvedValueOnce({ items: [事件], nextCursor: null });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.加载接触记录(); });
    expect(当前.后端状态.接触记录.items).toEqual([事件]);
    await act(async () => { await 当前.操作.切身份('招聘方'); });
    expect(当前.后端状态.接触记录).toEqual(pristine快照);
    // 招聘方身份下追加/加载零 contact 请求
    后端.读取接触事件.mockClear();
    await act(async () => {
      await 当前.操作.加载接触记录();
      await 当前.操作.追加接触记录();
    });
    expect(后端.读取接触事件).not.toHaveBeenCalled();
  });

  it('换 candidate subject 后旧响应不落新主体，快照回 pristine', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 主体 A 加载成功，拿到一条记录
    vi.mocked(后端.读取接触事件).mockResolvedValueOnce({ items: [事件], nextCursor: null });
    await act(async () => { await 当前.操作.加载接触记录(); });
    expect(当前.后端状态.接触记录.items).toEqual([事件]);
    // A 的在飞 force 重读（deferred，稍后才回来）
    const 迟到门 = deferred<接触事件页>();
    vi.mocked(后端.读取接触事件).mockReturnValueOnce(迟到门.promise);
    await act(async () => { void 当前.操作.加载接触记录(true); });
    // 主体 B 在同一 Provider 登录（完成手机登录 → 读取主体 返回 sub_B）
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_B' });
    await act(async () => { await 通过测试手机登录(当前); });
    await waitFor(() => expect(当前.后端状态.主体?.subject_id).toBe('sub_B'));
    expect(当前.后端状态.接触记录).toEqual(pristine快照);
    // 旧 candidate 响应迟到到达：不落新主体
    迟到门.resolve({ items: [事件], nextCursor: null });
    await act(async () => { await 迟到门.promise; });
    expect(当前.后端状态.接触记录.items).toEqual([]);
  });
});

// ── P6 Task 4：mount / 退出 会话水合与清理（含 Backend 种子首帧隔离）──────────────

describe('应用状态提供者 P6 会话水合与清理', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  it('candidate mount hydrates P6 with the role and lands the page arrays', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取Agent规则).mockResolvedValue([BFFAgent规则样本]);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(后端.读取Agent规则).toHaveBeenCalledWith('candidate');
    await waitFor(() => expect(当前.后端状态.Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' }));
    // Provider effect 从 raw 快照投影页面数组
    await waitFor(() => expect(当前.状态.全局规则.map((条) => 条.编号)).toEqual([BFFAgent规则样本.rule_id]));
  });

  it('mount with last_used_role null leaves P6 empty and page arrays clear', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩(null);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.已登录).toBe(true);
    // 保持身份选择页：不读任何规则，P6 状态停在干净底座
    expect(后端.读取Agent规则).not.toHaveBeenCalled();
    expect(当前.后端状态.候选规则快照).toEqual({});
    expect(当前.后端状态.招聘规则快照).toEqual({});
    expect(当前.后端状态.候选规则提案).toEqual({});
    expect(当前.后端状态.招聘规则提案).toEqual({});
    expect(当前.后端状态.Agent规则水合).toEqual({
      candidate: { rules: '未开始', proposals: '未开始' },
      recruiter: { rules: '未开始', proposals: '未开始' },
    });
    expect(当前.状态.全局规则).toEqual([]);
    expect(当前.状态.意向级规则).toEqual([]);
    expect(当前.状态.企业规则).toEqual([]);
  });

  it('mount 水合 401 clears P6 dicts, resets stages, and clears page arrays', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取简历).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.已登录).toBe(false);
    // P6 也被拉进统一清理：阶段回 未开始、原始字典与页面数组清空
    expect(后端.读取Agent规则).toHaveBeenCalledWith('candidate');
    expect(当前.后端状态.候选规则快照).toEqual({});
    expect(当前.后端状态.招聘规则快照).toEqual({});
    expect(当前.后端状态.Agent规则水合).toEqual({
      candidate: { rules: '未开始', proposals: '未开始' },
      recruiter: { rules: '未开始', proposals: '未开始' },
    });
    expect(当前.状态.全局规则).toEqual([]);
    expect(当前.状态.意向级规则).toEqual([]);
    expect(当前.状态.企业规则).toEqual([]);
  });

  it('退出登录 clears P6 raw dicts and page arrays', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取Agent规则).mockResolvedValue([BFFAgent规则样本]);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.候选规则快照[BFFAgent规则样本.rule_id]).toBeDefined());
    await 当前.操作.退出登录();
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.候选规则快照).toEqual({});
    expect(当前.后端状态.Agent规则水合).toEqual({
      candidate: { rules: '未开始', proposals: '未开始' },
      recruiter: { rules: '未开始', proposals: '未开始' },
    });
    expect(当前.状态.全局规则).toEqual([]);
    expect(当前.状态.意向级规则).toEqual([]);
    expect(当前.状态.企业规则).toEqual([]);
  });
});

// ── P4 Task 3：Backend 初始 discovery raw 快照为空底座；Mock 发现域种子不动 ─────────

describe('应用状态提供者 P4 发现初始状态', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  it('Backend 初始 P4 发现快照为空底座，Mock 发现种子保持不变', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.候选岗位推荐).toEqual({});
    expect(当前.后端状态.候选岗位详情).toEqual({});
    expect(当前.后端状态.候选岗位不可用).toEqual([]);
    expect(当前.后端状态.招聘可用候选).toEqual({});
    expect(当前.后端状态.招聘已筛候选).toEqual({});
    expect(当前.后端状态.招聘已筛聚合).toEqual({ 阶段: '未开始', jobKey: '', error: null });
    expect(当前.后端状态.招聘候选详情).toEqual({});
    expect(当前.后端状态.招聘候选不可用).toEqual([]);
    expect(当前.后端状态.P4委托回执).toEqual({});
    expect(当前.后端状态.P4真实Case引用).toEqual({});
    // Mock 发现域继续走 归约发现推荐 与既有种子（本轮未触碰）
    expect(初始状态.推荐列表.length).toBeGreaterThan(0);
    expect(初始状态.企业候选列表.length).toBeGreaterThan(0);
  });
});

// ── P2 Task 3：Provider 附件库快照 —— 四域水合 / 招聘方不读附件 / 清理路径 ──

describe('应用状态提供者 P2 附件库快照', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  const 附件库样本: BFF附件简历库 = {
    items: [{
      file_id: 'rf_1', display_name: '沈亦舟_简历_2026.pdf', revision: 1,
      current_version: {
        version_id: 'rfv_1', version: 1, size_bytes: 1, media_type: 'application/pdf',
        sha256: 'a'.repeat(64), created_at: '2026-08-28T00:00:00Z', parse: { status: 'not_started' },
      },
      created_at: '2026-08-28T00:00:00Z', updated_at: '2026-08-28T00:00:00Z',
    }],
    limits: { max_files: 3, max_file_bytes: 10485760, accepted_media_types: ['application/pdf'] },
  };

  it('candidate mount 水合提交附件库，P6 三路照旧，切到招聘方后清空且不读附件', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取附件简历库).mockResolvedValue(附件库样本);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 第四支持域已提交
    expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
    expect(当前.后端状态.附件简历库).toEqual(附件库样本);
    // P6 三路并发照旧且阶段收口
    expect(后端.读取Agent规则).toHaveBeenCalledWith('candidate');
    await waitFor(() => expect(当前.后端状态.Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' }));
    // 切到招聘方：附件快照清空且招聘方水合不读附件
    await 当前.操作.切身份('招聘方');
    await waitFor(() => expect(当前.后端状态.附件简历库).toBeNull());
    expect(后端.读取附件简历库).toHaveBeenCalledTimes(1);
  });

  it('mount 附件读取 401 统一清理：不落已登录，附件与 P6 同清', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取附件简历库).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.已登录).toBe(false);
    expect(当前.后端状态.附件简历库).toBeNull();
    expect(当前.后端状态.主体).toBe(null);
    expect(当前.后端状态.Agent规则水合.candidate).toEqual({ rules: '未开始', proposals: '未开始' });
    expect(后端.清空目录缓存).toHaveBeenCalled();
  });

  it('mount 附件读取非 401 失败不阻塞初始化：已登录照常，附件为 null，简历/P6 保留', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取附件简历库).mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.已登录).toBe(true);
    expect(当前.后端状态.附件简历库).toBeNull();
    expect(当前.后端状态.简历快照).not.toBe(null);
    await waitFor(() => expect(当前.后端状态.Agent规则水合.candidate).toEqual({ rules: '成功', proposals: '成功' }));
  });

  it('退出登录清空附件快照，P6 清理不回归', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取附件简历库).mockResolvedValue(附件库样本);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.附件简历库).toEqual(附件库样本));
    await 当前.操作.退出登录();
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.附件简历库).toBeNull();
    expect(当前.后端状态.候选规则快照).toEqual({});
    expect(当前.后端状态.Agent规则水合).toEqual({
      candidate: { rules: '未开始', proposals: '未开始' },
      recruiter: { rules: '未开始', proposals: '未开始' },
    });
  });

  it('换账号登录清空上个账号的附件快照', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    // 附件 mock 只服务 A 的 mount 读取：Task 2 起登录自带水合，B 的登录会再读
    // 附件库（桩默认空库）—— 断言 A 的附件条目不串进 B，B 名下是自己的空库
    vi.mocked(后端.读取附件简历库).mockResolvedValueOnce(附件库样本);
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.附件简历库).toEqual(附件库样本));
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_B' });
    await 通过测试手机登录(当前);
    await waitFor(() => expect(当前.后端状态.主体?.subject_id).toBe('sub_B'));
    expect(当前.后端状态.附件简历库?.items).toEqual([]);
  });
});

// ── P5 Task 3：Provider 的 MatchCase 运行时状态 —— 内存快照、会话清理与对象租约 ──

describe('应用状态提供者 P5 MatchCase 运行时状态', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  it('Backend 初始 P5 快照为空底座', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.P5工作区).toEqual({});
    expect(当前.后端状态.P5历史).toEqual({});
    expect(当前.后端状态.P5详情).toEqual({});
    // J-PILOT-01 Task 2：连续快照同一空底座，绝不进 资料持久化
    expect(当前.后端状态.P5连续列表).toEqual({});
    expect(当前.后端状态.P5连续详情).toEqual({});
  });

  it('J-PILOT-01 Task 2：加载连续列表/读取连续详情经 facade 提交快照并按 canonical 归位', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取候选连续列表).mockResolvedValue({ items: [连续卡片], next_cursor: null });
    // 旧 Case 深链坐标（mc_）作为 alias 输入：后端归一返回 canonical dlg 记录
    vi.mocked(后端.读取候选连续详情).mockResolvedValue({ ...连续聚合DTO, record_id: 连续记录A, case_id: 连续Case坐标 });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await 当前.操作.加载连续列表('active');
    expect(后端.读取候选连续列表).toHaveBeenCalledWith('active', null);
    await waitFor(() => expect(当前.后端状态.P5连续列表['p5:negotiations:candidate:active']).toMatchObject({
      阶段: '成功', items: [连续卡片], ownerSubjectId: BFF主体样本.subject_id,
    }));
    await 当前.操作.加载连续列表('active'); // 非 force 命中成功快照零请求
    expect(后端.读取候选连续列表).toHaveBeenCalledTimes(1);
    await 当前.操作.读取连续详情(连续Case坐标);
    expect(后端.读取候选连续详情).toHaveBeenCalledWith(连续Case坐标);
    await waitFor(() => expect(当前.后端状态.P5连续详情).toEqual({
      // 只按返回 canonical record_id 保存一份，alias 键槽不残留
      'p5:negotiation:candidate:dlg_0123456789abcdef0123456789abcdef': {
        阶段: '成功', 刷新中: false, detail: { ...连续聚合DTO, record_id: 连续记录A, case_id: 连续Case坐标 },
        error: null, generation: 0, ownerSubjectId: BFF主体样本.subject_id,
      },
    }));
  });

  it('加载工作区经 facade 提交 scope 快照；成功后非 force 不重发', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 行: P5列表页['items'][number] = {
      role: 'candidate',
      state: {
        caseId: 'mc_1', lifecycle: 'open', stage: 'anonymous_screening', status: 'running',
        step: 'policy_check', round: 0, roundBudget: 3, needsUser: false,
        outcome: null, outcomeCode: null,
        createdAt: '2026-08-29T01:00:00Z', updatedAt: '2026-08-29T02:00:00Z', finalizedAt: null,
        agentAttention: null,
      },
      needsAction: true,
      intentionId: 'int_0123456789abcdef0123456789abcdef',
      job: {
        jobId: 'job_0123456789abcdef0123456789abcdef',
        job: { title: 'AI 产品实习生', location: '上海', publicSalaryRange: '300-500 元/天', requiredSkills: ['Python'] },
      },
    };
    vi.mocked(后端.读取P5Open列表).mockResolvedValue({ role: 'candidate', items: [行], nextCursor: null });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await 当前.操作.加载工作区('candidate', null);
    expect(后端.读取P5Open列表).toHaveBeenCalledWith('candidate', null, null);
    await waitFor(() => expect(当前.后端状态.P5工作区['p5:open:candidate:*']).toMatchObject({
      阶段: '成功', 刷新中: false, items: [行], nextCursor: null, 已加载页数: 1,
    }));
    await 当前.操作.加载工作区('candidate', null);
    expect(后端.读取P5Open列表).toHaveBeenCalledTimes(1);
  });

  it('Mock 模式零 P5 请求：操作惰性返回，不触碰任何 facade', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    render(createElement(应用状态提供者, null, createElement(上下文探针)));
    expect(当前.数据源模式).toBe('mock');
    await expect(当前.操作.加载工作区('candidate', null)).resolves.toBeUndefined();
    await expect(当前.操作.读取详情('candidate', 'mc_1', true)).resolves.toBeUndefined();
    await expect(当前.操作.回答事实('candidate', 'mc_1', 'prompt_1', '三天')).resolves.toBeUndefined();
    await expect(当前.操作.决定S0('mc_1', 'end')).resolves.toBeUndefined();
  });

  it('退出登录清空 P5 快照与引用（主体转移的反应式清理）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取P5Open列表).mockResolvedValue({ role: 'candidate', items: [], nextCursor: null });
    vi.mocked(后端.读取候选连续列表).mockResolvedValue({ items: [连续卡片], next_cursor: null });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await 当前.操作.加载工作区('candidate', null);
    await waitFor(() => expect(当前.后端状态.P5工作区['p5:open:candidate:*']).toMatchObject({ 阶段: '成功' }));
    await 当前.操作.加载连续列表('active');
    await 当前.操作.读取连续详情(连续记录A);
    await waitFor(() => expect(当前.后端状态.P5连续列表['p5:negotiations:candidate:active']).toMatchObject({ 阶段: '成功' }));
    await 当前.操作.退出登录();
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.P5工作区).toEqual({});
    expect(当前.后端状态.P5历史).toEqual({});
    expect(当前.后端状态.P5详情).toEqual({});
    // J-PILOT-01 Task 2：连续快照与 alias 对照随主体转移的反应式清理一并摊平
    expect(当前.后端状态.P5连续列表).toEqual({});
    expect(当前.后端状态.P5连续详情).toEqual({});
    // 统一登出清理同时摊平四个 legacy MatchCase 演示数组
    expect(当前.状态.在谈列表).toEqual([]);
    expect(当前.状态.企业候选列表).toEqual([]);
    expect(当前.状态.归档列表).toEqual([]);
    expect(当前.状态.企业归档列表).toEqual([]);
  });

  it('切身份（角色转移）清空 P5 快照', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取P5Open列表).mockResolvedValue({ role: 'candidate', items: [], nextCursor: null });
    vi.mocked(后端.读取候选连续列表).mockResolvedValue({ items: [连续卡片], next_cursor: null });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await 当前.操作.加载工作区('candidate', null);
    await 当前.操作.加载连续列表('active');
    await waitFor(() => expect(当前.后端状态.P5工作区['p5:open:candidate:*']).toMatchObject({ 阶段: '成功' }));
    await 当前.操作.切身份('招聘方');
    await waitFor(() => expect(当前.后端状态.P5工作区).toEqual({}));
    expect(当前.后端状态.P5历史).toEqual({});
    expect(当前.后端状态.P5详情).toEqual({});
    expect(当前.后端状态.P5连续列表).toEqual({});
    expect(当前.后端状态.P5连续详情).toEqual({});
  });

  it('换主体登录把 alias 对照随 P5 引用一并复位（主体基串重置口接线）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    // 旧 Case 深链坐标（mc_）作为 alias 输入：后端归一返回 canonical dlg 记录
    vi.mocked(后端.读取候选连续详情).mockResolvedValue({
      ...连续聚合DTO, record_id: 连续记录A, case_id: 连续Case坐标,
    });
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // sub_A 经 alias 坐标读聚合：canonical 落位 + alias 对照入表
    await 当前.操作.读取连续详情(连续Case坐标);
    await waitFor(() => expect(Object.keys(当前.后端状态.P5连续详情))
      .toEqual([P5范围键.negotiation(连续记录A)]));
    await 当前.操作.读取连续详情(连续Case坐标);
    // 第二次非 force 零请求：只有经 alias 对照命中 canonical 成功快照才短路 —— 证明对照条目在场
    expect(后端.读取候选连续详情).toHaveBeenCalledTimes(1);
    // 换主体登录：主体基串变化触发 Provider 反应式清理
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_B' });
    await 通过测试手机登录(当前);
    await waitFor(() => expect(当前.后端状态.主体?.subject_id).toBe('sub_B'));
    // effect 必须把 P5别名对照 随其余 P5 引用一并传入并清空（对照不得跨主体残留）
    await waitFor(() => {
      const 调用 = vi.mocked(清P5MatchCase引用).mock.calls.at(-1)?.[0];
      expect(调用?.P5别名对照).toBeDefined();
      expect((调用!.P5别名对照 as { current: Map<string, string> }).current.size).toBe(0);
    });
  });

  it('换主体登录清空上个账号的 P5 快照（主体基串变化）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取P5Open列表).mockResolvedValue({ role: 'candidate', items: [], nextCursor: null });
    vi.mocked(后端.读取候选连续列表).mockResolvedValue({ items: [连续卡片], next_cursor: null });
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await 当前.操作.加载工作区('candidate', null);
    await 当前.操作.加载连续列表('active');
    await waitFor(() => expect(当前.后端状态.P5工作区['p5:open:candidate:*']).toMatchObject({ 阶段: '成功' }));
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_B' });
    await 通过测试手机登录(当前);
    await waitFor(() => expect(当前.后端状态.主体?.subject_id).toBe('sub_B'));
    expect(当前.后端状态.P5工作区).toEqual({});
    expect(当前.后端状态.P5历史).toEqual({});
    expect(当前.后端状态.P5详情).toEqual({});
    expect(当前.后端状态.P5连续列表).toEqual({});
    expect(当前.后端状态.P5连续详情).toEqual({});
  });

  it('首个主体到达不清掉同帧子组件注册的 P5 scope（刷新落在 P5 页面首个加载不被栅栏丢弃）', async () => {
    // 探针复刻「我的」页的注册/加载 effect：依赖当前主体，主体落地的那一帧重跑。
    // mount 恢复（'' → sub|candidate）时页面与主体同 commit 挂载 —— 子 effect 先于
    // Provider 的 P5 主体基串清理 effect 执行；若那帧执行清理，刚注册的可见范围被
    // 置 null、代际表清空，在飞读取被 fence 整包丢弃，且无轮询的页面（「我的」）
    // 永远停在缺失态。首个主体到达必须跳过清理：登出/401 转移（基 → ''）已清空过。
    let 当前!: ReturnType<typeof use应用状态>;
    function P5注册探针() {
      const 值 = use应用状态();
      当前 = 值;
      const 当前SubjectId = 值.后端状态.主体?.last_used_role === 'candidate'
        ? 值.后端状态.主体.subject_id
        : null;
      useEffect(() => {
        if (值.数据源模式 !== 'backend' || 当前SubjectId === null) return;
        值.操作.设置P5范围('candidate', P5范围键.open('candidate', null));
        void 值.操作.加载工作区('candidate', null).catch(() => undefined);
        return () => 值.操作.设置P5范围('candidate', null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [值.数据源模式, 当前SubjectId, 值.操作]);
      return null;
    }
    const 行: P5列表页['items'][number] = {
      role: 'candidate',
      state: {
        caseId: 'mc_1', lifecycle: 'open', stage: 'anonymous_screening', status: 'running',
        step: 'policy_check', round: 0, roundBudget: 3, needsUser: false,
        outcome: null, outcomeCode: null,
        createdAt: '2026-08-29T01:00:00Z', updatedAt: '2026-08-29T02:00:00Z', finalizedAt: null,
        agentAttention: null,
      },
      needsAction: true,
      intentionId: 'int_0123456789abcdef0123456789abcdef',
      job: {
        jobId: 'job_0123456789abcdef0123456789abcdef',
        job: { title: 'AI 产品实习生', location: '上海', publicSalaryRange: '300-500 元/天', requiredSkills: ['Python'] },
      },
    };
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取P5Open列表).mockResolvedValue({ role: 'candidate', items: [行], nextCursor: null });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(
      应用状态提供者,
      { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } },
      createElement(P5注册探针),
    ));
    await waitFor(() => expect(当前 ?? undefined).toBeDefined(), { timeout: 3000 });
    await waitFor(() => {
      expect(当前.后端状态.P5工作区['p5:open:candidate:*']).toMatchObject({
        阶段: '成功', ownerSubjectId: 'sub_1', items: [行],
      });
    }, { timeout: 3000 });
  });

  it('退出登录回收在途 PDF 对象租约（URL.revokeObjectURL 恰好一次）', async () => {
    const 建造 = vi.fn(() => 'blob:p5-provider');
    const 回收 = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: 建造, configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: 回收, configurable: true, writable: true });
    try {
      let 当前!: ReturnType<typeof use应用状态>;
      function 上下文探针() { 当前 = use应用状态(); return null; }
      const 后端 = 创建后端桩('candidate');
      const 后端源 = 后端 as unknown as HTTP招聘数据源;
      render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
      await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
      const 租约 = await 当前.操作.读取简历PDF('candidate', 'mc_1');
      expect(建造).toHaveBeenCalledTimes(1);
      await 当前.操作.退出登录();
      await waitFor(() => expect(回收).toHaveBeenCalledWith('blob:p5-provider'));
      租约.revoke(); // 二次回收安全
    } finally {
      delete (URL as unknown as Record<string, unknown>).createObjectURL;
      delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
    }
  });
});

// ── J-PILOT-01 Task 3：委托待核对运行时接线 —— 方法暴露、owner 存储落键与会话边界清理 ──
// pending 内存表与 owner 存储会话由 Provider 一次性初始化并传给发现推荐/MatchCase 两域；
// 退出/切身份由 会话操作 的清理口清内存并删 outgoing owner 的 sessionStorage 恢复记录。

describe('应用状态提供者 J-PILOT-01 Task 3：委托待核对运行时接线', () => {
  const 候选委托输入 = {
    intentionId: 'int_1', recommendationId: 'rec_c1', jobId: 'job_1',
    resumeFileId: 'rf_1', resumeFileVersionId: 'rfv_7', disclosureAcknowledged: true as const,
  };
  const 恢复键 = () => 委托待核对键({
    environment: 'stg', subjectId: BFF主体样本.subject_id, role: 'candidate',
  });

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(),
    });
  });

  it('Provider 暴露取候选待核对命令/核对候选委托/重试连续记录/归档连续记录；Mock 模式零请求', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    render(createElement(应用状态提供者, null, createElement(上下文探针)));
    expect(当前.数据源模式).toBe('mock');
    expect(当前.操作.取候选待核对命令('int_1', 'job_1')).toBeNull();
    await expect(当前.操作.核对候选委托('int_1', 'job_1')).resolves.toBeUndefined();
    await expect(当前.操作.重试连续记录('dlg_1')).resolves.toBeUndefined();
    await expect(当前.操作.归档连续记录('dlg_1')).resolves.toBeUndefined();
  });

  it('委托网络失败冻结 pending 并落 owner 存储；退出登录清内存与恢复记录', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.创建候选岗位委托)
      .mockRejectedValueOnce(new BFF错误(0, 'network_error', 'unknown'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));

    await expect(当前.操作.委托候选岗位(候选委托输入)).rejects.toMatchObject({ code: 'network_error' });
    // 发送前冻结：内存投影与 owner 存储键都在场（普通页面 scope 卸载不清它）
    const 待核对 = 当前.操作.取候选待核对命令('int_1', 'job_1');
    expect(待核对).toMatchObject({
      operation: 'create', intention_id: 'int_1',
      resume_file_id: 'rf_1', resume_file_version_id: 'rfv_7',
    });
    expect(globalThis.sessionStorage.getItem(恢复键())).not.toBeNull();

    // 退出登录：内存表与 outgoing owner 的恢复记录一并清空（401 走同一 清账号状态 收口）
    await 当前.操作.退出登录();
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(globalThis.sessionStorage.getItem(恢复键())).toBeNull();
    expect(当前.操作.取候选待核对命令('int_1', 'job_1')).toBeNull();
  });

  it('切身份（切离 candidate）清内存并删当前主体的恢复记录', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.创建候选岗位委托)
      .mockRejectedValueOnce(new BFF错误(0, 'network_error', 'unknown'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await expect(当前.操作.委托候选岗位(候选委托输入)).rejects.toMatchObject({ code: 'network_error' });
    expect(globalThis.sessionStorage.getItem(恢复键())).not.toBeNull();

    await 当前.操作.切身份('招聘方');
    await waitFor(() => expect(当前.后端状态.主体?.last_used_role).toBe('recruiter'));
    expect(globalThis.sessionStorage.getItem(恢复键())).toBeNull();
    expect(当前.操作.取候选待核对命令('int_1', 'job_1')).toBeNull();
  });
});

// ── P8 Task 3：Provider 的账号安全运行时状态 —— 空底座种子、按需读取、会话边界清理 ──
// P8 的 Provider 清理键只认主体（不带角色）：同主体切角色保留已确认的共享账号快照，
// 只递增 P8 范围代际并清待定意图；登出 / 401 / 换主体 / 卸载则三块快照整域摊平。
describe('应用状态提供者 P8 控制面运行时状态', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  const 手机凭证DTO: P8Credential = {
    credentialId: 'cred_0000000000000001',
    provider: 'phone_otp',
    display: '+86 138 **** 0000',
    verifiedAt: '2026-08-20T10:00:00Z',
  };

  it('Backend 初始 P8 控制面快照为空底座，初始化零 P8 请求', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    const 空底座 = { phase: 'idle', refreshing: false, data: null, error: null, generation: 0 };
    expect(当前.后端状态.credentials).toEqual(空底座);
    expect(当前.后端状态.sessions).toEqual(空底座);
    expect(当前.后端状态.dataExport).toEqual(空底座);
    // P8 是按需读取域：登录水合不触达凭证/会话
    expect(后端.读取P8凭证).not.toHaveBeenCalled();
    expect(后端.读取P8会话).not.toHaveBeenCalled();
  });

  it('加载P8凭证 经 Provider 提交成功快照；非 force 重复加载零请求', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取P8凭证).mockResolvedValue([手机凭证DTO]);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.加载P8凭证(); });
    expect(当前.后端状态.credentials).toMatchObject({ phase: 'success', data: [手机凭证DTO] });
    await act(async () => { await 当前.操作.加载P8凭证(); });
    expect(后端.读取P8凭证).toHaveBeenCalledTimes(1);
  });

  it('退出登录清空三块 P8 快照；P7/P6/附件/隐私清理不回归', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取P8凭证).mockResolvedValue([手机凭证DTO]);
    vi.mocked(后端.读取P8会话).mockResolvedValue([{
      sessionId: 'sess_0000000000000001',
      createdAt: '2026-08-30T00:00:00Z',
      expiresAt: '2026-09-05T00:00:00Z',
      current: true,
    }]);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.加载P8凭证(); });
    await act(async () => { await 当前.操作.加载P8会话(); });
    expect(当前.后端状态.credentials.data).toEqual([手机凭证DTO]);
    await 当前.操作.退出登录();
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    const 空底座 = { phase: 'idle', refreshing: false, data: null, error: null, generation: 0 };
    expect(当前.后端状态.credentials).toEqual(空底座);
    expect(当前.后端状态.sessions).toEqual(空底座);
    expect(当前.后端状态.dataExport).toEqual(空底座);
    // 相邻域清理不回归：P7 / P6 / 附件 / 隐私 / P4 同口径清空
    expect(当前.后端状态.P7收件箱.candidate.阶段).toBe('未开始');
    expect(当前.后端状态.候选规则快照).toEqual({});
    expect(当前.后端状态.附件简历库).toBeNull();
    expect(当前.后端状态.隐私快照).toBeNull();
    expect(当前.后端状态.候选岗位推荐).toEqual({});
    expect(当前.状态.屏蔽名单).toEqual([]);
  });

  it('换主体登录清空上个账号的 P8 快照（清理键只认主体）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取P8凭证).mockResolvedValue([手机凭证DTO]);
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.加载P8凭证(); });
    expect(当前.后端状态.credentials.data).toEqual([手机凭证DTO]);
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_B' });
    await 通过测试手机登录(当前);
    await waitFor(() => expect(当前.后端状态.主体?.subject_id).toBe('sub_B'));
    expect(当前.后端状态.credentials).toMatchObject({ phase: 'idle', data: null });
    expect(当前.后端状态.sessions).toMatchObject({ phase: 'idle', data: null });
  });

  it('同主体切角色保留已确认 P8 快照，非 force 重载零新请求', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取P8凭证).mockResolvedValue([手机凭证DTO]);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.加载P8凭证(); });
    await act(async () => { await 当前.操作.切身份('招聘方'); });
    // 同主体：已确认快照保留（candidate↔recruiter 共享账号事实）
    expect(当前.后端状态.credentials).toMatchObject({ phase: 'success', data: [手机凭证DTO] });
    await act(async () => { await 当前.操作.加载P8凭证(); });
    expect(后端.读取P8凭证).toHaveBeenCalledTimes(1); // 非 force 命中成功快照：零新请求
  });

  it('P8 读取 401 统一清账号并摊平 P8 域', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取P8凭证).mockResolvedValue([手机凭证DTO]);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.加载P8凭证(); });
    vi.mocked(后端.读取P8凭证).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    await act(async () => { await 当前.操作.加载P8凭证(true); });
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.主体).toBeNull();
    expect(当前.后端状态.credentials).toMatchObject({ phase: 'idle', data: null });
    expect(当前.后端状态.sessions).toMatchObject({ phase: 'idle', data: null });
  });

  it('Provider 卸载后的迟到结算被丢弃：迟到 resolve 不抛错、不再写状态', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 凭证门 = deferred<P8Credential[]>();
    vi.mocked(后端.读取P8凭证).mockReturnValueOnce(凭证门.promise);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    const { unmount } = render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    const 读 = 当前.操作.加载P8凭证(true);
    unmount(); // Provider 卸载：引用随实例消亡，迟到结算无处落位
    凭证门.resolve([手机凭证DTO]);
    await expect(读).resolves.toBeUndefined();
  });

  // ── Task 5：subject 绑定的导出恢复适配器 ─────────────────────────
  // Backend 主体在场才构造（local 存储 + 模式/环境/账号 三重隔离键）；主体/环境变化在
  // 渲染期先写 ref，子组件的被动恢复 effect 一定看到新适配器；Mock 恒 null、零存储触碰。

  it('Backend 主体在场即供给 subject 绑定适配器：预置句柄恢复只 GET 不 POST', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_1' });
    const 本地 = 创建Map存储();
    vi.stubGlobal('localStorage', 本地);
    本地.setItem('AGXPP8数据导出v1:backend:stg:sub_1', JSON.stringify({
      subjectId: 'sub_1', createKey: 'p8-export-key-0001', exportId: `exp_${'0123456789abcdef'.repeat(2)}`,
    }));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.恢复P8数据导出(); });
    expect(后端.读取P8数据导出).toHaveBeenCalledWith(`exp_${'0123456789abcdef'.repeat(2)}`);
    expect(后端.创建P8数据导出).not.toHaveBeenCalled();
    expect(当前.后端状态.dataExport).toMatchObject({ phase: 'success' });
  });

  it('同一 Provider 主体 A→B：适配器随渲染换绑，B 的创建只写 B 键，A 的句柄逐字节不变', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_A' });
    const 本地 = 创建Map存储();
    vi.stubGlobal('localStorage', 本地);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.创建P8数据导出(); });
    const A键 = 'AGXPP8数据导出v1:backend:stg:sub_A';
    const A原文 = 本地.getItem(A键);
    expect(A原文).toContain('"exportId"');
    const A写入数 = 本地.setItem.mock.calls.filter(([键]) => 键 === A键).length;
    // 同一 Provider 实例切换主体（完成手机登录换主体）：渲染期把 ref 换绑到 B 的适配器
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_B' });
    await act(async () => { await 通过测试手机登录(当前); });
    await waitFor(() => expect(当前.后端状态.主体?.subject_id).toBe('sub_B'));
    await act(async () => { await 当前.操作.创建P8数据导出(); });
    const B键 = 'AGXPP8数据导出v1:backend:stg:sub_B';
    expect(本地.getItem(B键)).toContain('"exportId"');
    expect(本地.getItem(A键)).toBe(A原文); // A 的条目逐字节不变
    expect(本地.setItem.mock.calls.filter(([键]) => 键 === A键).length).toBe(A写入数); // 换主体后绝不再写 A
  });

  it('Mock 模式：P8导出恢复 引用保持 null、零 P8导出 存储；导出/注销写路径拒绝 backend_unavailable', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 本地 = 创建Map存储();
    vi.stubGlobal('localStorage', 本地);
    render(createElement(应用状态提供者, null, createElement(上下文探针)));
    await act(async () => {});
    await expect(当前.操作.创建P8数据导出()).rejects.toMatchObject({ code: 'backend_unavailable' });
    await expect(当前.操作.请求P8账号注销()).rejects.toMatchObject({ code: 'backend_unavailable' });
    await expect(当前.操作.恢复P8数据导出()).resolves.toBeUndefined();
    expect(当前.操作.取P8数据导出下载地址()).toBeNull();
    const P8导出键 = (键: string) => String(键).includes('P8数据导出');
    expect(本地.setItem.mock.calls.filter(([键]) => P8导出键(键))).toEqual([]); // 零存储触碰
  });

  it('注销 202 清三块 P8 快照并删除当前主体导出句柄；成功后由屏幕导航（操作层不导航）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_1' });
    const 本地 = 创建Map存储();
    vi.stubGlobal('localStorage', 本地);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => { await 当前.操作.创建P8数据导出(); });
    expect(本地.getItem('AGXPP8数据导出v1:backend:stg:sub_1')).toContain('"exportId"');
    await act(async () => { await 当前.操作.请求P8账号注销(); });
    const 空底座 = { phase: 'idle', refreshing: false, data: null, error: null, generation: 0 };
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.credentials).toEqual(空底座);
    expect(当前.后端状态.sessions).toEqual(空底座);
    expect(当前.后端状态.dataExport).toEqual(空底座);
    expect(本地.getItem('AGXPP8数据导出v1:backend:stg:sub_1')).toBeNull(); // 句柄已删
    expect(后端.清空目录缓存).toHaveBeenCalled();
  });
});

// ── Task 5：P4 开案 → P5 工作区失效的 Provider 接线（生产操作工厂 + 受控 facade）──
// 只验证接线是真的（Provider 注入的 P5 引用被用上了）：开案成功后，已缓存的对应与
// 全部 open scope 再调 加载工作区 会真实 GET；别的 scope 仍缓存；本方案没有立即 GET。
describe('应用状态提供者 P4 开案后的 P5 工作区失效', () => {
  const 候选推荐卡 = {
    recommendation_id: 'rec_c1',
    batch_id: 'bat_c1',
    intention_id: 'int_1',
    rank: 1,
    match_score: 80,
    match_reasons: [],
    state: 'available' as const,
    structured_requirements_confirmed: true,
    delegation: null,
    job: BFFCandidateJob样本,
  };

  const 空页 = (): P5列表页 => ({ role: 'candidate', items: [], nextCursor: null });

  function 建后端() {
    const 后端 = 创建后端桩('candidate');
    return Object.assign(后端, {
      读取候选岗位推荐: vi.fn(async () => [候选推荐卡]),
      创建候选岗位委托: vi.fn(async () => [{
        delegation_id: 'del_1', recommendation_id: null, state: 'case_started' as const,
        evaluation_id: null, case_id: 'case_new', refusal_code: null, failure_code: null,
      }]),
      读取候选岗位委托: vi.fn(),
    });
  }

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(),
    });
  });

  it('POST case_started 后：对应与全部 scope 真实重读，别的 scope 仍命中缓存', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 探针() { 当前 = use应用状态(); return null; }
    const 后端 = 建后端();
    vi.mocked(后端.读取P5Open列表).mockResolvedValue(空页());
    render(createElement(
      应用状态提供者,
      { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端 as unknown as HTTP招聘数据源 } },
      createElement(探针),
    ));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));

    // 三个 scope 都先读成功缓存：int_1（本档）、*（全部）、int_2（别的意向）
    await act(async () => {
      当前.操作.设置发现推荐范围('candidate', 'candidate:list:int_1');
      await 当前.操作.加载工作区('candidate', 'int_1');
      await 当前.操作.加载工作区('candidate', null);
      await 当前.操作.加载工作区('candidate', 'int_2');
    });
    const 首载次数 = vi.mocked(后端.读取P5Open列表).mock.calls.length;
    expect(首载次数).toBe(3);
    // 缓存命中：再读不发请求
    await act(async () => { await 当前.操作.加载工作区('candidate', 'int_1'); });
    expect(vi.mocked(后端.读取P5Open列表).mock.calls.length).toBe(首载次数);

    await act(async () => {
      await 当前.操作.加载候选岗位('int_1');
      await 当前.操作.委托候选岗位({
        intentionId: 'int_1', recommendationId: 'rec_c1', jobId: BFFCandidateJob样本.job_id,
        resumeFileId: 'rf_1', resumeFileVersionId: 'rfv_1', disclosureAcknowledged: true,
      });
    });
    // 失效本身不发 GET
    expect(vi.mocked(后端.读取P5Open列表).mock.calls.length).toBe(首载次数);

    // 本档与全部档不再命中缓存 → 各真实 GET 一次；别的意向仍缓存
    await act(async () => {
      await 当前.操作.加载工作区('candidate', 'int_1');
      await 当前.操作.加载工作区('candidate', null);
      await 当前.操作.加载工作区('candidate', 'int_2');
    });
    expect(vi.mocked(后端.读取P5Open列表).mock.calls.length).toBe(首载次数 + 2);
  });

  it('失效前发出的旧 GET 迟到返回，不把空列表重新落成成功缓存', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 探针() { 当前 = use应用状态(); return null; }
    const 后端 = 建后端();
    const 门 = deferred<P5列表页>();
    vi.mocked(后端.读取P5Open列表).mockReturnValueOnce(门.promise).mockResolvedValue(空页());
    render(createElement(
      应用状态提供者,
      { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端 as unknown as HTTP招聘数据源 } },
      createElement(探针),
    ));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    当前.操作.设置发现推荐范围('candidate', 'candidate:list:int_1');
    // 在飞的旧读还没回来
    const 在飞 = 当前.操作.加载工作区('candidate', 'int_1');
    await act(async () => {
      await 当前.操作.加载候选岗位('int_1');
      await 当前.操作.委托候选岗位({
        intentionId: 'int_1', recommendationId: 'rec_c1', jobId: BFFCandidateJob样本.job_id,
        resumeFileId: 'rf_1', resumeFileVersionId: 'rfv_1', disclosureAcknowledged: true,
      });
    });
    await act(async () => { 门.resolve(空页()); await 在飞; });
    // 迟到读被读代际作废：这个 scope 没有成功缓存，下一次加载仍真实 GET
    expect(当前.后端状态.P5工作区['p5:open:candidate:int_1']?.阶段).not.toBe('成功');
    const 失效后次数 = vi.mocked(后端.读取P5Open列表).mock.calls.length;
    await act(async () => { await 当前.操作.加载工作区('candidate', 'int_1'); });
    expect(vi.mocked(后端.读取P5Open列表).mock.calls.length).toBe(失效后次数 + 1);
  });
});
