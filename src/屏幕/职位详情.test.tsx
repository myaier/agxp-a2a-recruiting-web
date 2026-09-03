// 职位详情 · 三个契约：
//  1. 委托入谈一次点击（P0，Mock 原样保留：一次点击、无确认层、原地切在谈详情）；
//  2. P4 Task 6：Backend 路由只吃 P4 权威数据 —— 快照命中直接渲染（不再 GET）、
//     直接 URL 才 GET 单个 CandidateJob、404 走安全不可用页；绝不回退 市场列表[0]，
//     绝不造 Mock 公司 slug；公开企业页只在 hiring_organization_ref 在场时可进；
//     委托每次都要 确认层 披露确认，成功后原地停留（不跳 P5 在谈详情），
//     进行中回执按节拍轮询、连败五次被中性文案覆盖；
//  3. 匹配对齐卡 在接线前后都位于职位条件段与公司区块之前（推荐卡路径带真实分，
//     详情直取路径 wire 无匹配分，藏环不伪造）。
// 测试宿主：mock 应用状态 / 导航钩子（同 看市场.test.tsx 惯例）。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 职位详情 from './职位详情';
import { P4委托进度未知文案 } from '../状态/后端/use发现推荐委托轮询';
import { 标记看市场来路, 复位看市场来路 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { BFF错误 } from '../数据/HTTP客户端';
import type { BFF候选岗位推荐, BFF附件简历, BFF附件简历库 } from '../数据/BFF契约';
import type { P8ReportReceipt } from '../数据/招聘数据源/P8控制面';
import { BFF候选岗位推荐样本, BFFCandidateJob样本 } from '../测试/BFF样本';
import { 发现推荐操作桩 } from '../测试/操作桩';

const mock派发 = vi.fn();
const mock替换跳转 = vi.fn();
const mock返回 = vi.fn();
const mock跳转 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());
// P4 操作桩：Backend 分支只经上下文操作表触达后端
const mock加载候选岗位 = vi.fn(async (_意向编号: string) => undefined);
const mock读取候选岗位详情 = vi.fn(async () => undefined);
const mock标记岗位不感兴趣 = vi.fn(async () => undefined);
const mock委托候选岗位 = vi.fn();
const mock设置发现推荐范围 = vi.fn();
const mock刷新委托 = vi.fn(async () => undefined);
// P5 Task 3：委托前的权威附件库准备（附件简历操作 域的桩）
const mock准备候选委托简历 = vi.fn();
// P8 Task 7：上下文举报（P8合规操作 域的桩）
const mock提交P8举报 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

// 导航钩子只换 use导航：会话内来路信号（标记/复位）用真实现，安全返回的会话证据靠它
vi.mock('../路由/导航钩子', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  use导航: () => ({ 返回: mock返回, 替换跳转: mock替换跳转, 跳转: mock跳转 }),
}));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

const { mock公司路由键, mock取公司档案 } = vi.hoisted(() => {
  const 静态档案 = {
    键: 'pingcap',
    名称: 'PingCAP',
    首字: 'P',
    规模行: 'D 轮 · 500-1000 人 · 基础软件',
    地址: '上海市张江路 2 号',
    简介: ['分布式数据库'],
    工商信息: [{ 项: '成立日期', 值: '2015-04-01' }],
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

function 渲染Backend状态(选项: {
  候选岗位推荐?: Record<string, unknown>;
  候选岗位详情?: Record<string, unknown>;
  候选岗位不可用?: string[];
  /** 当前意向编号载体：推荐卡只从这一个 scope 里找，缺省是快照惯例的 int_1 */
  当前意向编号?: string | null;
  /** Backend 初始化阶段：缺省 '完成'（既有用例代表水合后的渲染世界） */
  后端初始化?: '进行中' | '完成' | '跳过';
  /** 真实简历事实（匹配对齐行的 Backend 证据来源）；缺省是空简历 */
  简历?: Record<string, unknown>;
}) {
  mock应用状态 = {
    状态: {
      已委托: [], 简历经历: [], 简历教育: [], 简历技能: [],
      基本信息: { 真名: '', 开始工作年: '', 身份: '在职' },
      当前意向编号: 选项.当前意向编号 === undefined ? 'int_1' : 选项.当前意向编号,
      ...选项.简历,
    },
    派发: mock派发,
    数据源模式: 'backend',
    后端状态: {
      初始化: 选项.后端初始化 ?? '完成',
      候选岗位推荐: 选项.候选岗位推荐 ?? {},
      候选岗位详情: 选项.候选岗位详情 ?? {},
      候选岗位不可用: 选项.候选岗位不可用 ?? [],
    },
    // 生产 Provider 恒注入全表：桩宿主同样给全表，用例只覆盖自己要断言的 spy
    // 准备候选委托简历 属附件域，同样默认给桩，用例再用 mockResolvedValue 定行为
    操作: 发现推荐操作桩({
      加载候选岗位: mock加载候选岗位,
      读取候选岗位详情: mock读取候选岗位详情,
      标记岗位不感兴趣: mock标记岗位不感兴趣,
      委托候选岗位: mock委托候选岗位,
      设置发现推荐范围: mock设置发现推荐范围,
      刷新委托: mock刷新委托,
      准备候选委托简历: mock准备候选委托简历,
      提交P8举报: mock提交P8举报,
    }),
  };
}

/** 命中 job_1 的候选推荐快照（可换 delegation / state） */
function 快照With(卡: BFF候选岗位推荐) {
  return { int_1: { 阶段: '成功', 刷新中: false, items: [卡], error: null, generation: 1 } };
}

const 推荐卡样本 = BFF候选岗位推荐样本;

/** 「5 年以上」经验要求的推荐卡：门槛必须核用户真实年限，不许吃演示常量 */
const 五年经验卡 = {
  ...BFF候选岗位推荐样本,
  job: { ...BFF候选岗位推荐样本.job, experience_requirement: 'five_plus_years' as const },
};

// ── P5 Task 3：委托前必须显式选定的附件简历坐标（零 / 一 / 多 表驱动底座）──

/** 便捷附件版本行：坐标只认 current_version.version_id，parse 与本任务无关 */
function 附件版本(id: string): BFF附件简历['current_version'] {
  return {
    version_id: id,
    version: 1,
    size_bytes: 1024,
    media_type: 'application/pdf',
    sha256: 'a'.repeat(64),
    created_at: '2026-08-28T00:00:00Z',
    parse: { status: 'not_started' },
  };
}

const 附件文件甲: BFF附件简历 = {
  file_id: 'rf_1',
  display_name: '沈亦舟_简历_2026.pdf',
  revision: 2,
  current_version: 附件版本('rfv_1'),
  created_at: '2026-08-28T00:00:00Z',
  updated_at: '2026-08-28T00:00:00Z',
};

const 附件文件乙: BFF附件简历 = {
  ...附件文件甲,
  file_id: 'rf_2',
  display_name: '产品简历_2026.pdf',
  current_version: 附件版本('rfv_2'),
};

function 附件库(items: BFF附件简历[]): BFF附件简历库 {
  return {
    items,
    limits: { max_files: 3, max_file_bytes: 10485760, accepted_media_types: ['application/pdf'] },
  };
}

/** 单文件库：既有委托用例的缺省准备结果 —— 一份文件仍要披露确认点名它 */
const 单文件附件库 = 附件库([附件文件甲]);
const 双文件附件库 = 附件库([附件文件甲, 附件文件乙]);

/** 用户真实简历段（Backend 水合而来，不是 Mock 演示简历） */
const 真实经历段 = {
  编号: 'exp_1', 公司: '云衢科技', 行业: '互联网', 职位: '前端工程师',
  开始: '2024-01', 结束: null, 内容: '负责前端',
};
const 真实教育段 = {
  编号: 'edu_1', 学校: '同济大学', 学历: '硕士', 专业: '计算机',
  开始: '2019-09', 结束: '2022-06',
};

function 渲染(编号 = 'M-12') {
  return render(
    <MemoryRouter initialEntries={[`/job/${编号}`]}>
      <Routes>
        <Route path="/job/:id" element={<职位详情 />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** 挂在 Routes 旁的导航驱动：点它走真实路由导航到 目标（测 scope 栅栏用的换岗路径）*/
function 换岗驱动(选项: { 目标: string }) {
  const 换 = useNavigate();
  return <button onClick={() => 换(选项.目标)}>换岗测试驱动</button>;
}

function 路由元素(编号: string) {
  return (
    <MemoryRouter initialEntries={[`/job/${编号}`]}>
      <Routes>
        <Route path="/job/:id" element={<职位详情 />} />
      </Routes>
    </MemoryRouter>
  );
}

function 断言匹配卡在条件段与公司之前(公司名: string) {
  const 匹配卡标题 = screen.getByText('匹配度分析');
  // Backend 小标题是「职位要求（补充说明，不自动解析）」、Mock 是「职位要求」，用正则同时覆盖
  const 职位要求 = screen.getByText(/职位要求/);
  const 公司节点 = screen.getByText(公司名);
  expect(匹配卡标题).toBeTruthy();
  // 匹配卡先于 JD 条件段，也先于公司区块（DOCUMENT_POSITION_FOLLOWING = 目标在参数节点之后）
  expect(匹配卡标题.compareDocumentPosition(职位要求) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(匹配卡标题.compareDocumentPosition(公司节点) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe('职位详情 · 让 AI 代理去谈（Mock 原样）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock替换跳转.mockClear();
    mock返回.mockClear();
    mock跳转.mockClear();
    mock公司路由键.mockClear();
    mock取公司档案.mockClear();
    mock轻提示.mockClear();
    mock应用状态 = { 状态: { 已委托: [], 简历技能: [] }, 派发: mock派发 };
  });

  it('让 AI 代理去谈保持一次点击，不增加确认层', async () => {
    const 用户 = userEvent.setup();
    渲染('M-12');
    await 用户.click(screen.getByRole('button', { name: /让AI代理去谈/ }));
    expect(mock派发).toHaveBeenCalledWith({
      型: '委托入谈',
      岗: expect.objectContaining({ 编号: 'M-12' }),
    });
    expect(mock替换跳转).toHaveBeenCalledTimes(1);
    // 没有新增的二次确认入口
    expect(screen.queryByText('同意并去谈')).toBeNull();
    expect(screen.queryByRole('dialog', { name: '确认委托AI代理？' })).toBeNull();
    // Mock 委托不读附件库：一键派发的原型行为保持原样
    expect(mock准备候选委托简历).not.toHaveBeenCalled();
  });

  it('Mock 公司卡仍按原 slug 导航', async () => {
    const 用户 = userEvent.setup();
    渲染('M-12');
    断言匹配卡在条件段与公司之前('PingCAP');
    await 用户.click(screen.getByRole('button', { name: /PingCAP/ }));
    expect(mock跳转).toHaveBeenCalledWith('/company/slug-PingCAP');
  });
});

describe('职位详情 · P4 权威数据（Backend）', () => {
  beforeEach(() => {
    复位看市场来路();
    mock派发.mockClear();
    mock替换跳转.mockClear();
    mock返回.mockClear();
    mock跳转.mockClear();
    mock公司路由键.mockClear();
    mock取公司档案.mockClear();
    mock轻提示.mockClear();
    mock加载候选岗位.mockReset();
    mock读取候选岗位详情.mockReset();
    mock标记岗位不感兴趣.mockReset();
    mock委托候选岗位.mockReset();
    mock设置发现推荐范围.mockClear();
    mock刷新委托.mockReset();
    // 委托前的权威库准备缺省给单文件库：一份文件也必须披露确认点名后才发委托
    mock准备候选委托简历.mockReset();
    mock准备候选委托简历.mockResolvedValue(单文件附件库);
  });

  afterEach(() => {
    // 假时钟每个用例后恢复，避免泄漏进其它测试文件
    vi.useRealTimers();
  });

  it('快照命中的卡直接渲染，不再 GET；进屏注册候选详情范围，离开即清', () => {
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    const 页 = 渲染('job_1');
    expect(screen.getByText('AI 产品实习生')).toBeTruthy();
    expect(mock读取候选岗位详情).not.toHaveBeenCalled();
    expect(mock设置发现推荐范围).toHaveBeenCalledWith('candidate', 'candidate:detail:job_1');
    页.unmount();
    expect(mock设置发现推荐范围).toHaveBeenCalledWith('candidate', null);
  });

  it('直接 URL 无缓存时 GET 单个 CandidateJob，页面停在加载态', () => {
    渲染Backend状态({});
    渲染('job_new');
    expect(mock读取候选岗位详情).toHaveBeenCalledWith('job_new');
    expect(screen.getByText('正在加载职位详情…')).toBeTruthy();
    expect(mock设置发现推荐范围).toHaveBeenCalledWith('candidate', 'candidate:detail:job_new');
  });

  it('404 收口的安全不可用页：不重试请求，也不回落市场列表', () => {
    渲染Backend状态({ 候选岗位不可用: ['job_gone'] });
    渲染('job_gone');
    expect(screen.getByText('这个职位暂时看不了')).toBeTruthy();
    expect(mock读取候选岗位详情).not.toHaveBeenCalled();
    expect(screen.queryByText('PingCAP')).toBeNull();
    expect(screen.queryByText('MiniMax')).toBeNull();
  });

  it('无任何 P4 数据时不回落 市场列表[0]（Mock 首条不串场）', () => {
    渲染Backend状态({});
    渲染('job_missing');
    expect(screen.queryByText('PingCAP')).toBeNull();
    expect(screen.queryByText('AI 产品经理（Agent 方向）')).toBeNull();
    expect(screen.getByText('正在加载职位详情…')).toBeTruthy();
  });

  it('公司槽无 hiring_organization_ref 时只读，不造 Mock slug、不读静态档', () => {
    渲染Backend状态({ 候选岗位详情: { job_1: BFFCandidateJob样本 } });
    渲染('job_1');
    // 公司名照常完整展示，但没有 button/link 形态的公司卡
    expect(screen.getByText('云衢科技')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /云衢科技/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /云衢科技/ })).toBeNull();
    expect(mock公司路由键).not.toHaveBeenCalled();
    expect(mock取公司档案).not.toHaveBeenCalled();
    expect(mock跳转.mock.calls.every(([目标]) => !String(目标).startsWith('/company/'))).toBe(true);
  });

  it('hiring_organization_ref 在场才可进公开企业页（路由参数是 opaque ID）', async () => {
    const 用户 = userEvent.setup();
    渲染Backend状态({
      候选岗位详情: { job_1: { ...BFFCandidateJob样本, hiring_organization_ref: 'org_pub_1' } },
    });
    渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: /云衢科技/ }));
    expect(mock跳转).toHaveBeenCalledWith(路径.企业详情('org_pub_1'));
    expect(mock公司路由键).not.toHaveBeenCalled();
  });

  it('推荐卡路径渲染真实匹配分；详情直取路径 wire 无匹配分，藏环不伪造', () => {
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    渲染('job_1');
    断言匹配卡在条件段与公司之前('云衢科技');
    expect(screen.getByRole('img', { name: '适配 92 分' })).toBeTruthy();
  });

  // 绝不编造事实：Backend 的匹配对齐行拿真实 JD 要求核真实简历，
  // 门槛只能来自用户自己的 开始工作年 / 学历，绝不来自演示简历常量
  it('经验行按用户真实工作年限判定：年限不够就不给证据', () => {
    const 今年 = new Date().getFullYear();
    渲染Backend状态({
      候选岗位推荐: 快照With(五年经验卡),
      简历: {
        基本信息: { 真名: '', 开始工作年: String(今年 - 1), 身份: '在职' },
        简历经历: [真实经历段],
      },
    });
    渲染('job_1');
    expect(screen.getByText('经验 5 年以上')).toBeTruthy();
    // 只干过 1 年：真实公司·职位绝不能被当成「命中 5 年以上」的证据
    expect(screen.queryByText('云衢科技 · 前端工程师')).toBeNull();
  });

  it('经验行按用户真实工作年限判定：够年限才给真实经历做证据', () => {
    const 今年 = new Date().getFullYear();
    渲染Backend状态({
      候选岗位推荐: 快照With(五年经验卡),
      简历: {
        基本信息: { 真名: '', 开始工作年: String(今年 - 8), 身份: '在职' },
        简历经历: [真实经历段],
      },
    });
    渲染('job_1');
    expect(screen.getByText('云衢科技 · 前端工程师')).toBeTruthy();
  });

  it('开始工作年为空（核不动）时经验行不给证据', () => {
    渲染Backend状态({
      候选岗位推荐: 快照With(五年经验卡),
      简历: { 简历经历: [真实经历段] },
    });
    渲染('job_1');
    expect(screen.getByText('经验 5 年以上')).toBeTruthy();
    expect(screen.queryByText('云衢科技 · 前端工程师')).toBeNull();
  });

  it('学历行按用户真实学历判定：学历不够就不给证据，够了才给', () => {
    渲染Backend状态({
      候选岗位推荐: 快照With(推荐卡样本), // education_requirement: bachelor → 本科
      简历: { 简历教育: [{ ...真实教育段, 学历: '大专' }] },
    });
    const 页 = 渲染('job_1');
    expect(screen.getByText('学历 本科')).toBeTruthy();
    expect(screen.queryByText('同济大学 · 大专')).toBeNull();
    页.unmount();

    渲染Backend状态({
      候选岗位推荐: 快照With(推荐卡样本),
      简历: { 简历教育: [真实教育段] },
    });
    渲染('job_1');
    expect(screen.getByText('同济大学 · 硕士')).toBeTruthy();
  });

  it('详情直取路径不渲染匹配分环', () => {
    渲染Backend状态({ 候选岗位详情: { job_1: BFFCandidateJob样本 } });
    渲染('job_1');
    expect(screen.getByText('匹配度分析')).toBeTruthy();
    expect(screen.queryByRole('img', { name: /适配/ })).toBeNull();
  });

  it('历史 basis 已确认（控制组）：核对行与生成分析照常渲染', () => {
    渲染Backend状态({
      候选岗位推荐: 快照With(推荐卡样本),
      简历: { 简历教育: [真实教育段] },
    });
    渲染('job_1');
    expect(screen.getByRole('img', { name: '适配 92 分' })).toBeTruthy();
    expect(screen.getByText('学历 本科')).toBeTruthy();
    expect(screen.getByText('同济大学 · 硕士')).toBeTruthy();
    expect(screen.getByText(/按岗位设置的结构化要求核对/)).toBeTruthy();
    expect(screen.queryByText('经验与学历尚未核对')).toBeNull();
  });

  it('历史 basis 未确认 + 嵌入 Job 当前已确认：保留后端分，确定性核对行与生成分析整组不出，改显中性句', () => {
    渲染Backend状态({
      候选岗位推荐: 快照With({
        ...推荐卡样本,
        structured_requirements_confirmed: false,
        job: { ...BFFCandidateJob样本, structured_requirements_confirmed: true },
      }),
      简历: { 简历教育: [真实教育段] },
    });
    渲染('job_1');
    // 后端历史分保留
    expect(screen.getByRole('img', { name: '适配 92 分' })).toBeTruthy();
    // 中性句 + 当前 Job 事实（与历史 basis 分开表述）
    expect(screen.getByText('经验与学历尚未核对')).toBeTruthy();
    expect(screen.getByText('结构化设置：已确认')).toBeTruthy();
    // 整组收起：核对行（要求 + 证据）与生成分析一条不留，不做选择性过滤
    expect(screen.queryByText('学历 本科')).toBeNull();
    expect(screen.queryByText('同济大学 · 硕士')).toBeNull();
    expect(screen.queryByText('经验 不限')).toBeNull();
    expect(screen.queryByText(/按岗位设置的结构化要求核对/)).toBeNull();
    // 当前 Job 事实行（JD 卡里的「标签：值」）不属于推荐结论，照常在
    expect(screen.getByText('结构化学历要求：本科')).toBeTruthy();
  });

  it.each([true, false])(
    '详情直取（null basis）不渲染任何推荐结论：当前 Job 确认=%s 时只给 结构化设置',
    (确认) => {
      渲染Backend状态({
        候选岗位详情: { job_1: { ...BFFCandidateJob样本, structured_requirements_confirmed: 确认 } },
        简历: { 简历教育: [真实教育段] },
      });
      渲染('job_1');
      expect(screen.getByText(`结构化设置：${确认 ? '已确认' : '尚未确认'}`)).toBeTruthy();
      // 无推荐批次：无分、无核对行、无生成分析，也无中性核对句
      expect(screen.queryByRole('img', { name: /适配/ })).toBeNull();
      expect(screen.queryByText('学历 本科')).toBeNull();
      expect(screen.queryByText('同济大学 · 硕士')).toBeNull();
      expect(screen.queryByText(/按岗位设置的结构化要求核对/)).toBeNull();
      expect(screen.queryByText('经验与学历尚未核对')).toBeNull();
    },
  );

  it('Backend detail displays CandidateJob facts in existing text slots', async () => {
    渲染Backend状态({
      候选岗位详情: {
        job_1: {
          ...BFFCandidateJob样本,
          location: { ...BFFCandidateJob样本.location, display_name: '上海' },
          workplace_mode: 'hybrid',
          office_location: '浦东新区世纪大道 1 号',
          annual_salary_months: 15,
          experience_requirement: 'three_to_five_years',
          education_requirement: 'bachelor',
          requirements: '熟悉 TypeScript',
        },
      },
    });
    渲染('job_1');
    expect(await screen.findByText('城市：上海')).toBeTruthy();
    expect(screen.getByText('办公方式：混合')).toBeTruthy();
    expect(screen.getByText('办公地点：浦东新区世纪大道 1 号')).toBeTruthy();
    expect(screen.getByText('年薪月数：15 薪')).toBeTruthy();
    expect(screen.getByText('结构化经验要求：3-5 年')).toBeTruthy();
    expect(screen.getByText('结构化学历要求：本科')).toBeTruthy();
    // 详情直取（null basis）：只给当前 Job 的结构化设置现状，不出生成分析
    expect(screen.getByText('结构化设置：已确认')).toBeTruthy();
    expect(screen.queryByText(/按岗位设置的结构化要求核对/)).toBeNull();
    expect(screen.getByText('职位要求（补充说明，不自动解析）')).toBeTruthy();
    expect(screen.getByText('熟悉 TypeScript')).toBeTruthy();
  });

  it('remote with blank office and null months renders no empty fact labels or default', async () => {
    渲染Backend状态({
      候选岗位详情: {
        job_1: {
          ...BFFCandidateJob样本,
          workplace_mode: 'remote',
          office_location: ' ',
          annual_salary_months: null,
        },
      },
    });
    渲染('job_1');
    await screen.findByText('办公方式：全远程');
    expect(screen.queryByText(/^办公地点：/)).toBeNull();
    expect(screen.queryByText(/^年薪月数：/)).toBeNull();
    expect(screen.queryByText('12 薪')).toBeNull();
  });

  it('不感兴趣服务端先行：PUT 成功才回列表（无来路证据走安全替换）', async () => {
    const 用户 = userEvent.setup();
    mock标记岗位不感兴趣.mockResolvedValue(undefined);
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: '不感兴趣' }));
    expect(mock标记岗位不感兴趣).toHaveBeenCalledWith('int_1', 'rec_c1');
    // 本用例没给市场来路证据：成功落点 = 摆好看市场再替换进主壳（同样是「回列表」）
    await waitFor(() => expect(mock替换跳转).toHaveBeenCalledWith(路径.主壳));
    expect(mock派发).toHaveBeenCalledWith({ 型: '切子视图', 子视图: '看市场' });
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock轻提示).not.toHaveBeenCalled();
  });

  it('不感兴趣失败：不回列表，提示错误文案', async () => {
    const 用户 = userEvent.setup();
    mock标记岗位不感兴趣.mockRejectedValueOnce(new Error('网络失败'));
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: '不感兴趣' }));
    expect(mock标记岗位不感兴趣).toHaveBeenCalledWith('int_1', 'rec_c1');
    await waitFor(() => expect(mock轻提示).toHaveBeenCalled());
    expect(mock返回).not.toHaveBeenCalled();
  });

  it('每次委托都要披露确认：确认后带 literal true 与所选简历坐标调操作，成功不跳 P5', async () => {
    const 用户 = userEvent.setup();
    mock委托候选岗位.mockResolvedValue({
      delegation_id: 'del_9', recommendation_id: null, state: 'accepted',
      refusal_code: null, case_id: null,
    });
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    const 确认框 = screen.getByRole('dialog', { name: '确认委托AI代理？' });
    expect(确认框.textContent).toContain('沈亦舟_简历_2026.pdf');
    expect(确认框.textContent).toContain('仅对这一次委托生效');
    expect(mock委托候选岗位).not.toHaveBeenCalled();
    await 用户.click(screen.getByRole('button', { name: '暂不委托' }));
    expect(mock委托候选岗位).not.toHaveBeenCalled();
    // 再来一次：确认不复用，每次委托都要重新确认
    await 用户.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await 用户.click(screen.getByRole('button', { name: '确认委托' }));
    await waitFor(() => expect(mock委托候选岗位).toHaveBeenCalledTimes(1));
    expect(mock委托候选岗位).toHaveBeenCalledWith({
      intentionId: 'int_1',
      recommendationId: 'rec_c1',
      jobId: 'job_1',
      resumeFileId: 附件文件甲.file_id,
      resumeFileVersionId: 附件文件甲.current_version.version_id,
      disclosureAcknowledged: true,
    });
    expect(mock替换跳转).not.toHaveBeenCalled();
    expect(mock派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '委托入谈' }));
  });

  // 同一 job_id 可能同时在多个意向的缓存快照里：推荐坐标只能来自当前意向那一份，
  // 否则不感兴趣/委托会带着别的意向的 intention_id + recommendation_id 上 wire。
  const 双意向快照 = {
    int_1: {
      阶段: '成功', 刷新中: false, error: null, generation: 1,
      items: [{ ...推荐卡样本, recommendation_id: 'rec_旧意向', intention_id: 'int_1' }],
    },
    int_2: {
      阶段: '成功', 刷新中: false, error: null, generation: 1,
      items: [{ ...推荐卡样本, recommendation_id: 'rec_当前', intention_id: 'int_2' }],
    },
  };

  it('同一 job_id 在多个意向快照里时，不感兴趣只用当前意向的推荐坐标', async () => {
    const 用户 = userEvent.setup();
    mock标记岗位不感兴趣.mockResolvedValue(undefined);
    渲染Backend状态({ 当前意向编号: 'int_2', 候选岗位推荐: 双意向快照 });
    渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: '不感兴趣' }));
    expect(mock标记岗位不感兴趣).toHaveBeenCalledWith('int_2', 'rec_当前');
  });

  it('同一 job_id 在多个意向快照里时，委托只用当前意向的推荐坐标', async () => {
    const 用户 = userEvent.setup();
    mock委托候选岗位.mockResolvedValue({
      delegation_id: 'del_9', recommendation_id: null, state: 'accepted',
      refusal_code: null, case_id: null,
    });
    渲染Backend状态({ 当前意向编号: 'int_2', 候选岗位推荐: 双意向快照 });
    渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await 用户.click(screen.getByRole('button', { name: '确认委托' }));
    await waitFor(() => expect(mock委托候选岗位).toHaveBeenCalledTimes(1));
    expect(mock委托候选岗位).toHaveBeenCalledWith({
      intentionId: 'int_2',
      recommendationId: 'rec_当前',
      jobId: 'job_1',
      resumeFileId: 附件文件甲.file_id,
      resumeFileVersionId: 附件文件甲.current_version.version_id,
      disclosureAcknowledged: true,
    });
  });

  it('岗位只在非当前意向的快照里时走详情直取，绝不借别的意向坐标', async () => {
    const 用户 = userEvent.setup();
    渲染Backend状态({
      当前意向编号: 'int_2',
      候选岗位推荐: {
        int_1: 快照With(推荐卡样本).int_1,
        // 当前意向自己的快照已结算且没有这张卡：坐标恢复的终态就是只读空态
        int_2: { 阶段: '成功', 刷新中: false, items: [], error: null, generation: 1 },
      },
      候选岗位详情: { job_1: BFFCandidateJob样本 },
    });
    渲染('job_1');
    const 去谈键 = screen.getByRole('button', { name: '当前求职意向暂无这条推荐' }) as HTMLButtonElement;
    const 不感兴趣键 = screen.getByRole('button', { name: '不感兴趣' }) as HTMLButtonElement;
    expect(去谈键.disabled).toBe(true);
    expect(不感兴趣键.disabled).toBe(true);
    await 用户.click(去谈键);
    expect(screen.queryByRole('dialog', { name: '确认委托AI代理？' })).toBeNull();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
    expect(mock标记岗位不感兴趣).not.toHaveBeenCalled();
    // 详情直取路径：wire 无匹配分，藏环不伪造
    expect(screen.queryByRole('img', { name: /适配/ })).toBeNull();
  });

  it('详情直取（无推荐坐标）禁用不感兴趣与委托，绝不猜推荐坐标', async () => {
    const 用户 = userEvent.setup();
    渲染Backend状态({
      候选岗位推荐: { int_1: { 阶段: '成功', 刷新中: false, items: [], error: null, generation: 1 } },
      候选岗位详情: { job_1: BFFCandidateJob样本 },
    });
    渲染('job_1');
    const 去谈键 = screen.getByRole('button', { name: '当前求职意向暂无这条推荐' }) as HTMLButtonElement;
    expect(去谈键.disabled).toBe(true);
    const 不感兴趣键 = screen.getByRole('button', { name: '不感兴趣' }) as HTMLButtonElement;
    expect(不感兴趣键.disabled).toBe(true);
    await 用户.click(去谈键);
    expect(screen.queryByRole('dialog', { name: '确认委托AI代理？' })).toBeNull();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
    expect(mock标记岗位不感兴趣).not.toHaveBeenCalled();
  });

  it('详情停留期间按节拍轮询 accepted 回执，主键显示进行中状态文案', async () => {
    vi.useFakeTimers();
    mock刷新委托.mockResolvedValue(undefined);
    渲染Backend状态({
      候选岗位推荐: 快照With({
        ...推荐卡样本,
        state: 'delegating',
        delegation: { delegation_id: 'del_9', state: 'accepted', case_id: null },
      }),
    });
    render(路由元素('job_1'));
    expect(screen.getByText('已提交给 AI，等待处理')).toBeTruthy();
    expect(screen.queryByText('AI代理已接手')).toBeNull();
    expect(screen.queryByText('已开始沟通')).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(mock刷新委托).toHaveBeenCalledWith('candidate', 'del_9');
    expect(mock替换跳转).not.toHaveBeenCalled();
  });

  it('终态回执落位（摘要保留、卡回 available）后停止轮询', async () => {
    vi.useFakeTimers();
    mock刷新委托.mockResolvedValue(undefined);
    渲染Backend状态({
      候选岗位推荐: 快照With({
        ...推荐卡样本,
        state: 'delegating',
        delegation: { delegation_id: 'del_9', state: 'accepted', case_id: null },
      }),
    });
    const { rerender } = render(路由元素('job_1'));
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(mock刷新委托).toHaveBeenCalledTimes(1);
    // 操作层提交终态后摘要保留权威 state：卡回 available，只有 accepted/evaluating 才轮询
    渲染Backend状态({
      候选岗位推荐: 快照With({
        ...推荐卡样本,
        state: 'available',
        delegation: { delegation_id: 'del_9', state: 'refused', case_id: null },
      }),
    });
    rerender(路由元素('job_1'));
    expect(screen.getByText('本次未能继续')).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(mock刷新委托).toHaveBeenCalledTimes(1);
  });

  it('同一委托连续五次轮询失败后，进行中标被中性文案覆盖', async () => {
    vi.useFakeTimers();
    mock刷新委托.mockRejectedValue(new Error('网络失败'));
    渲染Backend状态({
      候选岗位推荐: 快照With({
        ...推荐卡样本,
        state: 'delegating',
        delegation: { delegation_id: 'del_9', state: 'accepted', case_id: null },
      }),
    });
    render(路由元素('job_1'));
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(mock刷新委托).toHaveBeenCalledTimes(5);
    expect(screen.getByText(P4委托进度未知文案)).toBeTruthy();
    expect(screen.queryByText('已提交给 AI，等待处理')).toBeNull();
    expect(screen.queryByText('AI代理已接手')).toBeNull();
    expect(screen.queryByText('已开始沟通')).toBeNull();
  });

  // 六个闭合委托状态的权威文案（与 发现推荐映射 的 P4委托状态文案表 逐字一致）
  const 状态文案 = [
    ['accepted', '已提交给 AI，等待处理'],
    ['evaluating', 'AI 正在评估'],
    ['case_started', '已创建真实在谈'],
    ['needs_user', '需要你处理'],
    ['refused', '本次未能继续'],
    ['failed', '本次处理未完成'],
  ] as const;
  const 候选卡态 = {
    accepted: 'delegating', evaluating: 'delegating', case_started: 'delegated',
    needs_user: 'available', refused: 'available', failed: 'available',
  } as const;

  it.each(状态文案)('%s 委托按闭合表在主键显示「%s」且禁用', (state, 文案) => {
    渲染Backend状态({
      候选岗位推荐: 快照With({
        ...推荐卡样本,
        state: 候选卡态[state],
        delegation: { delegation_id: `del_${state}`, state, case_id: null },
      }),
    });
    render(路由元素('job_1'));
    const 主键 = screen.getByRole('button', { name: 文案 }) as HTMLButtonElement;
    expect(主键.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: '让AI代理去谈' })).toBeNull();
    expect(screen.queryByText('AI代理已接手')).toBeNull();
    expect(screen.queryByText('已开始沟通')).toBeNull();
  });

  it('candidate case_started navigates only by server case_id', async () => {
    渲染Backend状态({
      候选岗位推荐: 快照With({
        ...推荐卡样本,
        state: 'delegated',
        delegation: { delegation_id: 'del_c1', state: 'case_started', case_id: 'case_server_c1' },
      }),
    });
    render(路由元素('job_1'));
    await userEvent.click(screen.getByRole('button', { name: '查看进展' }));
    expect(mock跳转).toHaveBeenCalledTimes(1);
    expect(mock跳转).toHaveBeenCalledWith(路径.在谈详情('case_server_c1'));
  });

  it('case_started 无服务端 case_id 时主键只是禁用状态，绝不拿任何本地 ID 充当 Case', async () => {
    渲染Backend状态({
      候选岗位推荐: 快照With({
        ...推荐卡样本,
        state: 'delegated',
        delegation: { delegation_id: 'del_c2', state: 'case_started', case_id: null },
      }),
    });
    render(路由元素('job_1'));
    const 主键 = screen.getByRole('button', { name: '已创建真实在谈' }) as HTMLButtonElement;
    expect(主键.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: '查看进展' })).toBeNull();
    await userEvent.click(主键);
    expect(mock跳转).not.toHaveBeenCalled();
  });
});

// ── 深链恢复：推荐坐标只从当前活跃意向恢复 + 详情页的安全返回 ────────────────
//   直链进详情（没经过看市场）时当前意向的快照可能还没进内存：页面只加载当前意向
//   这一份快照来恢复坐标 —— 绝不扫别的意向、绝不用 CandidateJob 直取坐标补。
//   快照在途 → 主键给「正在恢复推荐信息…」（禁用）；快照成功但没有这张卡 →
//   「当前求职意向暂无这条推荐」（禁用）；快照失败 → 通用不可用文案，不换 scope 重试。
//   返回：带 'candidate-market' 来源 + 本会话内真的从看市场跳过来（内存标记）且
//   history idx > 0 → 普通 返回()；直链 / 刷新残留标记 / idx 0 → 派发 切Tab '职位' +
//   切子视图 '看市场' 再 替换跳转(主壳)（刷新会重置内存 reducer，退栈会落错子视图）。
describe('职位详情 · 深链恢复当前意向坐标与安全返回（Backend）', () => {
  beforeEach(() => {
    复位看市场来路();
    mock派发.mockClear();
    mock替换跳转.mockClear();
    mock返回.mockClear();
    mock跳转.mockClear();
    mock轻提示.mockClear();
    mock加载候选岗位.mockReset();
    mock读取候选岗位详情.mockReset();
    mock委托候选岗位.mockReset();
    mock标记岗位不感兴趣.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('当前意向快照已在内存：直接出推荐坐标，不再多发一次列表请求', () => {
    渲染Backend状态({
      当前意向编号: 'int_current',
      候选岗位推荐: {
        int_current: {
          阶段: '成功', 刷新中: false, error: null, generation: 1,
          items: [{ ...推荐卡样本, intention_id: 'int_current' }],
        },
      },
    });
    渲染('job_1');
    expect(mock加载候选岗位).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '让AI代理去谈' })).toBeTruthy();
  });

  it('快照缺位只加载当前意向，回来后坐标恢复、主键回到可委托态', async () => {
    渲染Backend状态({
      当前意向编号: 'int_current',
      候选岗位推荐: {},
      候选岗位详情: { job_1: BFFCandidateJob样本 },
    });
    const 页 = 渲染('job_1');
    expect(mock加载候选岗位).toHaveBeenCalledWith('int_current');
    expect(mock加载候选岗位.mock.calls.every(([意向]) => 意向 === 'int_current')).toBe(true);
    expect(screen.getByRole('button', { name: /正在恢复推荐信息/ })).toBeTruthy();

    渲染Backend状态({
      当前意向编号: 'int_current',
      候选岗位推荐: {
        int_current: {
          阶段: '成功', 刷新中: false, error: null, generation: 1,
          items: [{ ...推荐卡样本, intention_id: 'int_current' }],
        },
      },
      候选岗位详情: { job_1: BFFCandidateJob样本 },
    });
    页.rerender(路由元素('job_1'));
    expect(screen.getByRole('button', { name: '让AI代理去谈' })).toBeTruthy();
    expect((screen.getByRole('button', { name: '让AI代理去谈' }) as HTMLButtonElement).disabled)
      .toBe(false);
  });

  it('同一 job_id 只在别的意向快照里：绝不借坐标，退只读空态', () => {
    渲染Backend状态({
      当前意向编号: 'int_current',
      候选岗位推荐: {
        int_current: { 阶段: '成功', 刷新中: false, items: [], error: null, generation: 1 },
        int_other: {
          阶段: '成功', 刷新中: false, error: null, generation: 1,
          items: [{ ...推荐卡样本, intention_id: 'int_other', recommendation_id: 'rec_other' }],
        },
      },
      候选岗位详情: { job_1: BFFCandidateJob样本 },
    });
    渲染('job_1');
    const 动作键 = screen.getByRole('button', { name: /当前求职意向暂无这条推荐/ }) as HTMLButtonElement;
    expect(动作键.disabled).toBe(true);
    expect(mock委托候选岗位).not.toHaveBeenCalled();
    expect(mock标记岗位不感兴趣).not.toHaveBeenCalled();
  });

  it('初始化未完成且无当前意向时不发列表请求，水合完成且有编号载体才恢复', () => {
    渲染Backend状态({
      后端初始化: '进行中',
      当前意向编号: null,
      候选岗位推荐: {},
      候选岗位详情: { job_1: BFFCandidateJob样本 },
    });
    const 页 = 渲染('job_1');
    expect(mock加载候选岗位).not.toHaveBeenCalled();

    渲染Backend状态({
      后端初始化: '完成',
      当前意向编号: 'int_current',
      候选岗位推荐: {},
      候选岗位详情: { job_1: BFFCandidateJob样本 },
    });
    页.rerender(路由元素('job_1'));
    expect(mock加载候选岗位).toHaveBeenCalledWith('int_current');
    expect(mock加载候选岗位.mock.calls.every(([意向]) => 意向 === 'int_current')).toBe(true);
  });

  it('快照失败不换 scope 重试：主键给通用不可用文案并禁用', () => {
    渲染Backend状态({
      当前意向编号: 'int_current',
      候选岗位推荐: {
        int_current: {
          阶段: '失败', 刷新中: false, items: [], error: '服务暂时不可用，请稍后再试', generation: 1,
        },
      },
      候选岗位详情: { job_1: BFFCandidateJob样本 },
    });
    渲染('job_1');
    expect(mock加载候选岗位).not.toHaveBeenCalled();
    const 动作键 = screen.getByRole('button', { name: '服务暂时不可用，请稍后再试' }) as HTMLButtonElement;
    expect(动作键.disabled).toBe(true);
  });

  it('在途快照（进行中）也补发加载：可能已是栅栏作废的陈旧在途，交操作层单飞接管', () => {
    渲染Backend状态({
      当前意向编号: 'int_current',
      候选岗位推荐: {
        int_current: { 阶段: '进行中', 刷新中: true, items: [], error: null, generation: 1 },
      },
      候选岗位详情: { job_1: BFFCandidateJob样本 },
    });
    渲染('job_1');
    expect(mock加载候选岗位).toHaveBeenCalledWith('int_current');
    expect(mock加载候选岗位.mock.calls.every(([意向]) => 意向 === 'int_current')).toBe(true);
    expect(screen.getByRole('button', { name: /正在恢复推荐信息/ })).toBeTruthy();
  });

  it('直链（无来源 / idx 0）返回：落回主壳的看市场，不盲退栈', async () => {
    const 用户 = userEvent.setup();
    window.history.replaceState({ idx: 0 }, '');
    渲染Backend状态({ 候选岗位详情: { job_1: BFFCandidateJob样本 } });
    渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '切Tab', Tab: '职位' });
    expect(mock派发).toHaveBeenCalledWith({ 型: '切子视图', 子视图: '看市场' });
    expect(mock替换跳转).toHaveBeenCalledWith(路径.主壳);
    expect(mock返回).not.toHaveBeenCalled();
  });

  it('带看市场来源且 history 有格：归一主壳到看市场后正常返回', async () => {
    const 用户 = userEvent.setup();
    window.history.replaceState({ idx: 2 }, '');
    // 模拟「本会话内真的从看市场跳过来」：来源标记 + 会话内来路证据同时成立。
    // 退栈前仍要把主壳摆回「职位 → 看市场」：用户可能 返回→切在谈→前进 回到本详情，
    // 裸退栈会落在他后来选的子视图上，与来源标记承诺的「回看市场」不符
    标记看市场来路();
    渲染Backend状态({ 候选岗位详情: { job_1: BFFCandidateJob样本 } });
    render(
      <MemoryRouter
        initialEntries={[{ pathname: '/job/job_1', state: { 来源: 'candidate-market' } }]}
      >
        <Routes>
          <Route path="/job/:id" element={<职位详情 />} />
        </Routes>
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '切Tab', Tab: '职位' });
    expect(mock派发).toHaveBeenCalledWith({ 型: '切子视图', 子视图: '看市场' });
    expect(mock返回).toHaveBeenCalled();
    expect(mock替换跳转).not.toHaveBeenCalled();
  });

  it('刷新残留的来源标记不算本会话来路：仍摆好主壳再替换，不盲退栈', async () => {
    // market → detail 后按 F5：来源标记与 idx 都活在 history.state 里，但内存里的
    // 会话来路证据随刷新归零、reducer 也回到启动默认（在谈）—— 退栈会落错子视图
    const 用户 = userEvent.setup();
    window.history.replaceState({ idx: 2 }, '');
    渲染Backend状态({ 候选岗位详情: { job_1: BFFCandidateJob样本 } });
    render(
      <MemoryRouter
        initialEntries={[{ pathname: '/job/job_1', state: { 来源: 'candidate-market' } }]}
      >
        <Routes>
          <Route path="/job/:id" element={<职位详情 />} />
        </Routes>
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock派发).toHaveBeenCalledWith({ 型: '切Tab', Tab: '职位' });
    expect(mock派发).toHaveBeenCalledWith({ 型: '切子视图', 子视图: '看市场' });
    expect(mock替换跳转).toHaveBeenCalledWith(路径.主壳);
  });

  it('直链恢复出推荐卡后点不感兴趣：成功也走安全返回，不盲退栈', async () => {
    // 直链详情经当前意向快照恢复出推荐坐标后「不感兴趣」可用：PUT 成功的落点
    // 与返回栏同一套安全返回 —— idx 0 / 外链前一格时绝不能 navigate(-1) 退出应用
    const 用户 = userEvent.setup();
    window.history.replaceState({ idx: 0 }, '');
    mock标记岗位不感兴趣.mockResolvedValue(undefined);
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: '不感兴趣' }));
    expect(mock标记岗位不感兴趣).toHaveBeenCalledWith('int_1', 'rec_c1');
    await waitFor(() => expect(mock替换跳转).toHaveBeenCalledWith(路径.主壳));
    expect(mock派发).toHaveBeenCalledWith({ 型: '切子视图', 子视图: '看市场' });
    expect(mock返回).not.toHaveBeenCalled();
  });

  it('加载/错误/不可用态的返回栏同样安全返回，不盲退栈', async () => {
    const 用户 = userEvent.setup();
    window.history.replaceState({ idx: 0 }, '');
    mock读取候选岗位详情.mockImplementation(() => new Promise(() => {}));
    渲染Backend状态({ 当前意向编号: null });
    render(路由元素('job_new'));
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '切子视图', 子视图: '看市场' });
    expect(mock替换跳转).toHaveBeenCalledWith(路径.主壳);
    expect(mock返回).not.toHaveBeenCalled();
  });
});

// ── P5 Task 3：委托前的显式简历选择（零 / 一 / 多 表驱动）────────────────────
//   委托第一跳先拿权威附件库：零份 → 提示去上传并跳 我的简历（零委托）；
//   一份 → 披露确认点名该文件；多份 → 附件简历选择层 必须单选。
//   读被拒 → P4 失败 toast（零导航零委托）；null（会话/角色换代）→ 静默返回，
//   绝不进零文件的跳转分支。
describe('职位详情 · 委托前必须显式选定简历坐标（Backend）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock替换跳转.mockClear();
    mock返回.mockClear();
    mock跳转.mockClear();
    mock轻提示.mockClear();
    mock加载候选岗位.mockClear();
    mock委托候选岗位.mockReset();
    mock准备候选委托简历.mockReset();
  });

  it.each([
    {
      名称: '0 份：提示先上传并跳 我的简历，零委托',
      库: 附件库([]),
      场景: '零',
    },
    {
      名称: '1 份：披露确认点名该文件，确认只发它的当前 file/version',
      库: 单文件附件库,
      场景: '单',
    },
    {
      名称: '2 份：必须单选后才可确认，只发所选行的当前 file/version',
      库: 双文件附件库,
      场景: '多',
    },
  ])('$名称', async ({ 库, 场景 }) => {
    const 用户 = userEvent.setup();
    mock准备候选委托简历.mockResolvedValue(库);
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await waitFor(() => expect(mock准备候选委托简历).toHaveBeenCalledTimes(1));
    expect(mock委托候选岗位).not.toHaveBeenCalled();

    if (场景 === '零') {
      await waitFor(() => expect(mock轻提示).toHaveBeenCalledWith('请先上传一份 PDF 简历'));
      expect(mock跳转).toHaveBeenCalledWith(路径.我的简历);
      expect(screen.queryByRole('dialog')).toBeNull();
      return;
    }

    if (场景 === '单') {
      const 确认框 = screen.getByRole('dialog', { name: '确认委托AI代理？' });
      expect(确认框.textContent).toContain(附件文件甲.display_name);
      await 用户.click(screen.getByRole('button', { name: '确认委托' }));
      await waitFor(() => expect(mock委托候选岗位).toHaveBeenCalledTimes(1));
      expect(mock委托候选岗位).toHaveBeenCalledWith({
        intentionId: 'int_1',
        recommendationId: 'rec_c1',
        jobId: 'job_1',
        resumeFileId: 附件文件甲.file_id,
        resumeFileVersionId: 附件文件甲.current_version.version_id,
        disclosureAcknowledged: true,
      });
      return;
    }

    // 多份：单选层先出，确认键未选禁用
    expect(screen.getByRole('dialog', { name: '选择委托简历' })).toBeTruthy();
    const 确认键 = screen.getByRole('button', { name: '确认并委托' }) as HTMLButtonElement;
    expect(确认键.disabled).toBe(true);
    await 用户.click(screen.getByRole('radio', { name: 附件文件乙.display_name }));
    await 用户.click(确认键);
    await waitFor(() => expect(mock委托候选岗位).toHaveBeenCalledTimes(1));
    expect(mock委托候选岗位).toHaveBeenCalledWith({
      intentionId: 'int_1',
      recommendationId: 'rec_c1',
      jobId: 'job_1',
      resumeFileId: 附件文件乙.file_id,
      resumeFileVersionId: 附件文件乙.current_version.version_id,
      disclosureAcknowledged: true,
    });
  });

  it('准备读被拒：P4 失败 toast，零导航零委托零弹层', async () => {
    const 用户 = userEvent.setup();
    mock准备候选委托简历.mockRejectedValue(new BFF错误(503, 'source_unavailable', 'down'));
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await waitFor(() =>
      expect(mock轻提示).toHaveBeenCalledWith('服务暂时不可用，请稍后再试'));
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('null（会话/角色换代）：静默无操作，绝不进零文件跳转分支', async () => {
    const 用户 = userEvent.setup();
    mock准备候选委托简历.mockResolvedValue(null);
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await waitFor(() => expect(mock准备候选委托简历).toHaveBeenCalledTimes(1));
    expect(mock轻提示).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('取消即清捕获：下一次点击重读权威库，绝不复用旧授权', async () => {
    const 用户 = userEvent.setup();
    mock准备候选委托简历.mockResolvedValue(双文件附件库);
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: '选择委托简历' })).toBeTruthy());
    await 用户.click(screen.getByRole('radio', { name: 附件文件乙.display_name }));
    await 用户.click(screen.getByRole('button', { name: '暂不委托' }));
    expect(screen.queryByRole('dialog', { name: '选择委托简历' })).toBeNull();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
    // 再点是一次全新的准备：选择与推荐捕获都不带走
    await 用户.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await waitFor(() => expect(mock准备候选委托简历).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('dialog', { name: '选择委托简历' })).toBeTruthy();
    const 确认键 = screen.getByRole('button', { name: '确认并委托' }) as HTMLButtonElement;
    expect(确认键.disabled).toBe(true);
  });

  // 准备读在途时换岗位路由（编号）/ 离开详情：迟到的权威库结果必须被栅栏丢弃 ——
  // 不许在新岗位下弹旧岗位的确认层，更不许离屏后还提示并跳 我的简历
  //（plan：选择不跨 cancel/完成/卸载/scope 变化存活）。
  it('准备读在途换岗位路由：迟到结果被丢弃，不提示不弹层不跳转零委托', async () => {
    const 用户 = userEvent.setup();
    let 解决!: (库: BFF附件简历库) => void;
    mock准备候选委托简历.mockImplementation(
      () => new Promise<BFF附件简历库>((res) => { 解决 = res; }),
    );
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    // 真实路由导航换岗（同一路由模式：/job/:id 参数变化、组件实例保留），
    // 不用新 MemoryRouter rerender —— 那样 history 不会换、参数不变测不到竞态。
    const 视图 = render(
      <MemoryRouter initialEntries={['/job/job_1']}>
        <换岗驱动 目标="/job/job_乙" />
        <Routes>
          <Route path="/job/:id" element={<职位详情 />} />
        </Routes>
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    expect(mock准备候选委托简历).toHaveBeenCalledTimes(1);
    // 读取仍在途时换到另一个岗位详情（快照里也换上乙岗）
    const 乙岗快照 = {
      int_1: {
        阶段: '成功', 刷新中: false, error: null, generation: 1,
        items: [{ ...推荐卡样本, job: { ...推荐卡样本.job, job_id: 'job_乙' } }],
      },
    };
    渲染Backend状态({ 候选岗位推荐: 乙岗快照 });
    await 用户.click(screen.getByRole('button', { name: '换岗测试驱动' }));
    // 零文件是后果最重的分支：本该提示去上传 + 跳 我的简历
    //（若导航没真换岗，栅栏不成立、下面第一条断言就会先被 toast 打爆 —— 测试自证）
    解决(附件库([]));
    await act(async () => {});
    expect(mock轻提示).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    视图.unmount();
  });

  it('准备读在途离开详情（卸载）：迟到结果不提示不跳转零委托', async () => {
    const 用户 = userEvent.setup();
    let 解决!: (库: BFF附件简历库) => void;
    mock准备候选委托简历.mockImplementation(
      () => new Promise<BFF附件简历库>((res) => { 解决 = res; }),
    );
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    const 视图 = 渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    视图.unmount();
    // 迟到的零文件结果不许再触发提示 / 跳 我的简历
    解决(附件库([]));
    await act(async () => {});
    expect(mock轻提示).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
  });

  // 评审 R2：入口在 StrictMode 下跑（effect 会 setup→cleanup→setup 双执行），
  // 挂载栅栏若只在 cleanup 里落 false 而不在 setup 里回 true，dev 下全部委托都会
  // 被误判成「已离屏」而静默丢弃 —— 弹层必须照常出现。
  it('StrictMode 双重挂载不误判离屏：准备结果照常弹层', async () => {
    const 用户 = userEvent.setup();
    mock准备候选委托简历.mockResolvedValue(双文件附件库);
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    render(
      <StrictMode>
        {路由元素('job_1')}
      </StrictMode>,
    );
    await 用户.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: '选择委托简历' })).toBeTruthy());
  });

  it('准备读被拒同样过栅栏：换岗后的迟到拒绝不提示', async () => {
    const 用户 = userEvent.setup();
    let 拒绝!: (错误: unknown) => void;
    mock准备候选委托简历.mockImplementation(
      () => new Promise<BFF附件简历库>((_, rej) => { 拒绝 = rej; }),
    );
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    const 视图 = render(
      <MemoryRouter initialEntries={['/job/job_1']}>
        <换岗驱动 目标="/job/job_乙" />
        <Routes>
          <Route path="/job/:id" element={<职位详情 />} />
        </Routes>
      </MemoryRouter>,
    );
    await 用户.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    const 乙岗快照 = {
      int_1: {
        阶段: '成功', 刷新中: false, error: null, generation: 1,
        items: [{ ...推荐卡样本, job: { ...推荐卡样本.job, job_id: 'job_乙' } }],
      },
    };
    渲染Backend状态({ 候选岗位推荐: 乙岗快照 });
    await 用户.click(screen.getByRole('button', { name: '换岗测试驱动' }));
    拒绝(new BFF错误(503, 'source_unavailable', 'down'));
    await act(async () => {});
    expect(mock轻提示).not.toHaveBeenCalled();
    expect(mock跳转).not.toHaveBeenCalled();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
    视图.unmount();
  });
});

// ── P8 Task 7：上下文举报 ──────────────────────────────────────────
//   ⋯ 只在权威 CandidateJob 快照解码成功（视图在场）后出现；举报 target 只取
//   视图.jobId，绝不用路由参数 编号、更不用 P4 推荐 ID。快照缺位 / 在飞 / 失败 /
//   404 四个隐藏态一律无 ⋯ —— 拼错或过期的路由参数单凭自己打不开也提交不了举报。
//   推荐路径的抽屉里「举报这个职位」与不感兴趣并列；详情直取路径它是唯一非取消
//   动作（反馈/委托仍禁用）。target-not-found 强制重读来源并关掉过期层。
describe('职位详情 · P8 上下文举报（Backend）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock轻提示.mockClear();
    mock加载候选岗位.mockClear();
    mock读取候选岗位详情.mockReset();
    mock提交P8举报.mockReset().mockResolvedValue({
      ticketId: 'TICKET-P8-RPT-001', status: 'received', blockStatus: 'not_requested',
    } satisfies P8ReportReceipt);
  });

  it.each([
    {
      名称: '路由参数缺位（absent）：无 ⋯',
      挂载: () => render(
        <MemoryRouter initialEntries={['/job']}>
          <Routes>
            <Route path="/job" element={<职位详情 />} />
          </Routes>
        </MemoryRouter>,
      ),
      断言零读: true,
    },
    {
      名称: '读取在飞（loading）：无 ⋯，GET 已发未归',
      挂载: () => {
        mock读取候选岗位详情.mockImplementation(() => new Promise(() => {}));
        渲染Backend状态({});
        return 渲染('job_new');
      },
      断言零读: false,
    },
    {
      名称: '读取失败（failure）：无 ⋯，落错误态',
      挂载: () => {
        mock读取候选岗位详情.mockRejectedValue(new BFF错误(503, 'source_unavailable', 'down'));
        渲染Backend状态({});
        return 渲染('job_new');
      },
      断言零读: false,
    },
    {
      名称: '404 收口的不可用态：无 ⋯',
      挂载: () => {
        渲染Backend状态({ 候选岗位不可用: ['job_gone'] });
        return 渲染('job_gone');
      },
      断言零读: true,
    },
  ])('$名称', async ({ 挂载, 断言零读 }) => {
    await act(async () => {});
    挂载();
    await act(async () => {});
    expect(screen.queryByRole('button', { name: '更多操作' })).toBeNull();
    expect(screen.queryByText('举报这个职位')).toBeNull();
    expect(screen.queryByRole('dialog', { name: '举报' })).toBeNull();
    if (断言零读) expect(mock读取候选岗位详情).not.toHaveBeenCalled();
    expect(mock提交P8举报).not.toHaveBeenCalled();
  });

  it('拼错/过期的路由参数单凭参数打不开也提交不了举报（缓存与快照都没有这个岗）', async () => {
    mock读取候选岗位详情.mockRejectedValue(new BFF错误(404, 'job_not_found', 'gone'));
    渲染Backend状态({});
    渲染('job_typo_404');
    await act(async () => {});
    expect(screen.queryByRole('button', { name: '更多操作' })).toBeNull();
    expect(screen.queryByText('举报这个职位')).toBeNull();
    expect(mock提交P8举报).not.toHaveBeenCalled();
    expect(mock派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '拉黑' }));
  });

  it('推荐路径：⋯ 抽屉里「举报这个职位」与不感兴趣并列', async () => {
    const 用户 = userEvent.setup();
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: '更多操作' }));
    expect(screen.getByRole('dialog', { name: '职位更多操作' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '不感兴趣，别再推给我' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '举报这个职位' })).toBeTruthy();
  });

  it('举报提交：target 只取 视图.jobId 的权威 job_id，绝不用 P4 推荐 ID，也绝不本地拉黑', async () => {
    const 用户 = userEvent.setup();
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: '更多操作' }));
    await 用户.click(screen.getByRole('button', { name: '举报这个职位' }));
    expect(screen.getByRole('dialog', { name: '举报' })).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '骚扰' }));
    await 用户.click(screen.getByRole('button', { name: /同时屏蔽云衢科技/ }));
    await 用户.click(screen.getByRole('button', { name: '提交举报' }));
    await waitFor(() => expect(mock提交P8举报).toHaveBeenCalledTimes(1));
    expect(mock提交P8举报).toHaveBeenCalledWith({ type: 'job', ref: 'job_1' }, 'harassment', true);
    // 请求里既没有推荐 ID，也没有对象/公司展示名（举报走平台侧）
    const 序列化 = JSON.stringify(mock提交P8举报.mock.calls);
    expect(序列化).not.toContain('rec_c1');
    expect(序列化).not.toContain('云衢科技');
    expect(mock派发).not.toHaveBeenCalledWith(expect.objectContaining({ 型: '拉黑' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '举报' })).toBeNull());
  });

  it('详情直取路径：举报这个职位是唯一非取消动作，用权威 job ID 即可举报（无推荐坐标）', async () => {
    const 用户 = userEvent.setup();
    渲染Backend状态({
      候选岗位推荐: { int_1: { 阶段: '成功', 刷新中: false, items: [], error: null, generation: 1 } },
      候选岗位详情: { job_1: BFFCandidateJob样本 },
    });
    渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: '更多操作' }));
    const 抽屉 = screen.getByRole('dialog', { name: '职位更多操作' });
    expect(screen.getByRole('button', { name: '举报这个职位' })).toBeTruthy();
    expect(抽屉.textContent).not.toContain('不感兴趣');
    // 推荐专属动作在直取路径仍禁用（不因举报入口放开）
    expect((screen.getByRole('button', { name: '当前求职意向暂无这条推荐' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '不感兴趣' }) as HTMLButtonElement).disabled).toBe(true);
    await 用户.click(screen.getByRole('button', { name: '举报这个职位' }));
    await 用户.click(screen.getByRole('button', { name: '虚假信息' }));
    await 用户.click(screen.getByRole('button', { name: '提交举报' }));
    await waitFor(() => expect(mock提交P8举报).toHaveBeenCalledWith(
      { type: 'job', ref: 'job_1' }, 'false_information', false));
    expect(JSON.stringify(mock提交P8举报.mock.calls)).not.toContain('rec_');
    expect(mock标记岗位不感兴趣).not.toHaveBeenCalled();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
  });

  it('target-not-found：强制重读该岗位来源并关掉过期举报层', async () => {
    const 用户 = userEvent.setup();
    mock读取候选岗位详情.mockResolvedValue(undefined);
    mock提交P8举报.mockRejectedValue(new BFF错误(404, 'report_target_not_found', 'gone'));
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: '更多操作' }));
    await 用户.click(screen.getByRole('button', { name: '举报这个职位' }));
    await 用户.click(screen.getByRole('button', { name: '其他' }));
    await 用户.click(screen.getByRole('button', { name: '提交举报' }));
    await waitFor(() => expect(mock读取候选岗位详情).toHaveBeenCalledWith('job_1', true));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '举报' })).toBeNull());
    expect(mock轻提示).toHaveBeenCalledWith('举报对象已不存在，请刷新后重试');
  });
});
