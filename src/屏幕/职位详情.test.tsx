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
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 职位详情 from './职位详情';
import { P4委托进度未知文案 } from '../状态/后端/use发现推荐委托轮询';
import { 路径 } from '../路由/路径表';
import { BFF错误 } from '../数据/HTTP客户端';
import type { BFF候选岗位推荐, BFF附件简历, BFF附件简历库 } from '../数据/BFF契约';
import { BFF候选岗位推荐样本, BFFCandidateJob样本 } from '../测试/BFF样本';
import { 发现推荐操作桩 } from '../测试/操作桩';

const mock派发 = vi.fn();
const mock替换跳转 = vi.fn();
const mock返回 = vi.fn();
const mock跳转 = vi.fn();
const mock轻提示 = vi.hoisted(() => vi.fn());
// P4 操作桩：Backend 分支只经上下文操作表触达后端
const mock读取候选岗位详情 = vi.fn(async () => undefined);
const mock标记岗位不感兴趣 = vi.fn(async () => undefined);
const mock委托候选岗位 = vi.fn();
const mock设置发现推荐范围 = vi.fn();
const mock刷新委托 = vi.fn(async () => undefined);
// P5 Task 3：委托前的权威附件库准备（附件简历操作 域的桩）
const mock准备候选委托简历 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({
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
      候选岗位推荐: 选项.候选岗位推荐 ?? {},
      候选岗位详情: 选项.候选岗位详情 ?? {},
      候选岗位不可用: 选项.候选岗位不可用 ?? [],
    },
    // 生产 Provider 恒注入全表：桩宿主同样给全表，用例只覆盖自己要断言的 spy
    // 准备候选委托简历 属附件域，同样默认给桩，用例再用 mockResolvedValue 定行为
    操作: 发现推荐操作桩({
      读取候选岗位详情: mock读取候选岗位详情,
      标记岗位不感兴趣: mock标记岗位不感兴趣,
      委托候选岗位: mock委托候选岗位,
      设置发现推荐范围: mock设置发现推荐范围,
      刷新委托: mock刷新委托,
      准备候选委托简历: mock准备候选委托简历,
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
  const 职位要求 = screen.getByText('职位要求');
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
    mock派发.mockClear();
    mock替换跳转.mockClear();
    mock返回.mockClear();
    mock跳转.mockClear();
    mock公司路由键.mockClear();
    mock取公司档案.mockClear();
    mock轻提示.mockClear();
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

  it('不感兴趣服务端先行：PUT 成功才回列表', async () => {
    const 用户 = userEvent.setup();
    mock标记岗位不感兴趣.mockResolvedValue(undefined);
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    渲染('job_1');
    await 用户.click(screen.getByRole('button', { name: '不感兴趣' }));
    expect(mock标记岗位不感兴趣).toHaveBeenCalledWith('int_1', 'rec_c1');
    await waitFor(() => expect(mock返回).toHaveBeenCalled());
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
      候选岗位推荐: { int_1: 快照With(推荐卡样本).int_1 },
      候选岗位详情: { job_1: BFFCandidateJob样本 },
    });
    渲染('job_1');
    const 去谈键 = screen.getByRole('button', { name: '让AI代理去谈' }) as HTMLButtonElement;
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
    渲染Backend状态({ 候选岗位详情: { job_1: BFFCandidateJob样本 } });
    渲染('job_1');
    const 去谈键 = screen.getByRole('button', { name: '让AI代理去谈' }) as HTMLButtonElement;
    expect(去谈键.disabled).toBe(true);
    const 不感兴趣键 = screen.getByRole('button', { name: '不感兴趣' }) as HTMLButtonElement;
    expect(不感兴趣键.disabled).toBe(true);
    await 用户.click(去谈键);
    expect(screen.queryByRole('dialog', { name: '确认委托AI代理？' })).toBeNull();
    expect(mock委托候选岗位).not.toHaveBeenCalled();
    expect(mock标记岗位不感兴趣).not.toHaveBeenCalled();
  });

  it('详情停留期间按节拍轮询 accepted 回执，并显示「AI代理已接手」', async () => {
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
    expect(screen.getByText('AI代理已接手')).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(mock刷新委托).toHaveBeenCalledWith('candidate', 'del_9');
    expect(mock替换跳转).not.toHaveBeenCalled();
  });

  it('终态回执落位（摘要摘除）后停止轮询', async () => {
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
    // 操作层提交终态后摘要被摘除：回到 available，不再有可轮询委托
    渲染Backend状态({ 候选岗位推荐: 快照With(推荐卡样本) });
    rerender(路由元素('job_1'));
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(mock刷新委托).toHaveBeenCalledTimes(1);
  });

  it('同一委托连续五次轮询失败后，已接手标被中性文案覆盖', async () => {
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
    expect(screen.queryByText('AI代理已接手')).toBeNull();
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
});
