// 准备职位正文 · 映射测试（P1 Task 2）。
//
// 覆盖两条同步准备函数：
//   · 准备Backend职位正文 —— 只吃 P4 投影（用现有合法样本经 从P4候选岗位/从P4CandidateJob
//     构建视图，不从 illegal DTO 强转）；Spy 证明不读 Mock 详情表与静态公司档；
//     §3.2 缺失规则（未知图位 / 元行未知 / 发布人占位 / JD 未知）全部在此落位。
//   · 准备Mock职位正文 —— 原映射原样：元行顺序、重复项、文案与匹配结果逐字不变；
//     公司资料以 公司区块 原组件同一输入的可观察输出作对照（不修改原组件）。

import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 准备Backend职位正文, 准备Mock职位正文 } from './准备职位正文';
import { 公司区块 } from '../../组件/公司区块';
import { 从P4CandidateJob, 从P4候选岗位 } from '../../数据/发现推荐映射';
import { 市场列表, 取市场岗位详情 } from '../../数据/模拟数据';
import { BFF候选岗位推荐样本, BFFCandidateJob样本, BFF企业档案样本, BFF公开企业样本 } from '../../测试/BFF样本';
import { BFF公司摘要样本 } from '../../测试/展示资料样本';

// Spy 包装真实实现：Mock 路径照常工作，Backend 路径用「零调用」自证不读 Mock 来源
const { mock取市场岗位详情, mock取公司档案, mock公司路由键 } = vi.hoisted(() => ({
  mock取市场岗位详情: vi.fn(),
  mock取公司档案: vi.fn(),
  mock公司路由键: vi.fn(),
}));
vi.mock('../../数据/模拟数据', async (importOriginal) => {
  const 实际 = await importOriginal<typeof import('../../数据/模拟数据')>();
  mock取市场岗位详情.mockImplementation(实际.取市场岗位详情);
  return { ...实际, 取市场岗位详情: mock取市场岗位详情 };
});
vi.mock('../../数据/公司档案', async (importOriginal) => {
  const 实际 = await importOriginal<typeof import('../../数据/公司档案')>();
  mock取公司档案.mockImplementation(实际.取公司档案);
  mock公司路由键.mockImplementation(实际.公司路由键);
  return { ...实际, 取公司档案: mock取公司档案, 公司路由键: mock公司路由键 };
});

/** 用户真实简历段（同 职位详情.test.tsx 的合法简历事实，Backend 证据来源） */
const 真实经历段 = {
  编号: 'exp_1', 公司: '云衢科技', 行业: '互联网', 职位: '前端工程师',
  开始: '2024-01', 结束: null, 内容: '负责前端', 隐藏: false,
};
const 真实教育段 = {
  编号: 'edu_1', 学校: '同济大学', 学历: '硕士', 专业: '计算机',
  开始: '2019-09', 结束: '2022-06',
};
const 真实简历 = {
  经历: [真实经历段], 教育: [真实教育段], 技能: ['Python'], 开始工作年: '2020',
};
/** 演示空简历（职位详情.test.tsx Mock 分支的缺省状态：经历/教育为空） */
const 空简历 = { 经历: [], 教育: [], 技能: [], 开始工作年: '' };

beforeEach(() => {
  mock取市场岗位详情.mockClear();
  mock取公司档案.mockClear();
  mock公司路由键.mockClear();
});

describe('准备Backend职位正文 · 只吃 P4 权威数据', () => {
  it('Spy 证明：不读 取市场岗位详情，不读静态公司档/公司路由键', () => {
    准备Backend职位正文(从P4候选岗位(BFF候选岗位推荐样本), 真实简历);
    准备Backend职位正文(从P4CandidateJob(BFFCandidateJob样本), 真实简历);
    expect(mock取市场岗位详情).not.toHaveBeenCalled();
    expect(mock取公司档案).not.toHaveBeenCalled();
    expect(mock公司路由键).not.toHaveBeenCalled();
  });

  it('推荐卡（basis 已确认）：核对分支吃 wire 分，行按真实简历核对，分析加核对基准前缀', () => {
    const 数据 = 准备Backend职位正文(从P4候选岗位(BFF候选岗位推荐样本), 真实简历);
    expect(数据.匹配).toEqual({
      种类: '核对',
      分: BFF候选岗位推荐样本.match_score,
      行们: [{ 要求: '学历 本科', 证据: '同济大学 · 硕士', 态: '有证据', 类: '硬性' }],
      分析: { 墨句: '按岗位设置的结构化要求核对。学历满足岗位要求。', 灰句: '' },
    });
    expect(数据.职位).toBe(BFFCandidateJob样本.title);
    expect(数据.薪资).toBe(从P4候选岗位(BFF候选岗位推荐样本).卡.薪资);
  });

  it('经验行按用户真实工作年限判定：年限不够不给真实经历做证据（复用现有 五年经验卡 口径）', () => {
    const 视图 = 从P4候选岗位({
      ...BFF候选岗位推荐样本,
      job: { ...BFF候选岗位推荐样本.job, experience_requirement: 'five_plus_years' },
    });
    const 数据 = 准备Backend职位正文(视图, {
      经历: [真实经历段], 教育: [真实教育段], 技能: [],
      开始工作年: String(new Date().getFullYear() - 1),
    });
    const 匹配 = 数据.匹配;
    expect(匹配.种类).toBe('核对');
    if (匹配.种类 !== '核对') return;
    expect(匹配.分).toBe(BFF候选岗位推荐样本.match_score);
    expect(匹配.行们).toEqual([
      { 要求: '经验 5 年以上', 证据: null, 态: '不满足', 类: '硬性' },
      { 要求: '学历 本科', 证据: '同济大学 · 硕士', 态: '有证据', 类: '硬性' },
    ]);
  });

  it('详情直取（无推荐批次）：说明分支不伪造分，只交代结构化设置现状', () => {
    const 数据 = 准备Backend职位正文(从P4CandidateJob(BFFCandidateJob样本), 真实简历);
    expect(数据.匹配).toEqual({
      种类: '说明',
      分: null,
      说明: [`结构化设置：${BFFCandidateJob样本.structured_requirements_confirmed ? '已确认' : '尚未确认'}`],
    });
  });

  it('推荐卡 basis 未确认：说明分支保留 wire 分，先交代尚未核对再给结构化设置', () => {
    const 视图 = 从P4候选岗位({
      ...BFF候选岗位推荐样本,
      structured_requirements_confirmed: false,
    });
    const 数据 = 准备Backend职位正文(视图, 真实简历);
    expect(数据.匹配).toEqual({
      种类: '说明',
      分: BFF候选岗位推荐样本.match_score,
      说明: [
        '经验与学历尚未核对',
        `结构化设置：${BFFCandidateJob样本.structured_requirements_confirmed ? '已确认' : '尚未确认'}`,
      ],
    });
  });

  it('岗位事实行原样：blank 办公地点不出空标签，null 年薪月数不出 X 薪，none 不出结构化行', () => {
    const 数据 = 准备Backend职位正文(从P4CandidateJob(BFFCandidateJob样本), 真实简历);
    expect(数据.职位事实行).toEqual([
      '城市：上海', '办公方式：混合', '办公地点：张江路 1 号', '结构化学历要求：本科',
    ]);
  });

  it('JD 合法空正文：保留原标题与未知占位，事实行不能掩盖缺失', () => {
    const 视图 = 从P4CandidateJob({
      ...BFFCandidateJob样本,
      description: '  \n  ',
      requirements: '在校生',
    });
    const 数据 = 准备Backend职位正文(视图, 真实简历);
    expect(数据.职位详情标题).toBe('岗位信息与职位详情');
    expect(数据.职位详情行).toEqual(['职位详情未知']);
    expect(数据.职位要求标题).toBe('职位要求（补充说明，不自动解析）');
    expect(数据.职位要求行).toEqual(['在校生']);
    expect(数据.职位事实行.length).toBeGreaterThan(0);
  });

  it('JD 部分行空白：trim 后丢空行、实文照常；要求空正文同样给未知占位', () => {
    const 视图 = 从P4CandidateJob({
      ...BFFCandidateJob样本,
      description: '第一行\n  \n第二行',
      requirements: '',
    });
    const 数据 = 准备Backend职位正文(视图, 真实简历);
    expect(数据.职位详情行).toEqual(['第一行', '第二行']);
    expect(数据.职位要求行).toEqual(['职位要求未知']);
  });

  it('公司区：wire 无图源给未知图位；无元信息给对应未知元行；空简介给 公司简介未知', () => {
    const 数据 = 准备Backend职位正文(从P4CandidateJob(BFFCandidateJob样本), 真实简历);
    expect(数据.公司.名称).toBe('云衢科技');
    expect(数据.公司.图).toEqual({ 种类: '未知', 可访问名: '公司图片未知' });
    expect(数据.公司.简介).toBe('');
    expect(数据.公司.资料).toEqual({
      介绍段: '公司简介未知',
      元行组: [
        { 标签: '融资阶段', 值: '未知' },
        { 标签: '规模', 值: '未知' },
        { 标签: '行业', 值: '未知' },
        { 标签: '成立', 值: '未知' },
        { 标签: '地址', 值: '未知' },
      ],
    });
  });

  it('已知公司简介照常进介绍段（视图层合法携带非空简介时，不降级成未知）', () => {
    const 基础视图 = 从P4CandidateJob(BFFCandidateJob样本);
    const 视图 = { ...基础视图, 公司: { ...基础视图.公司, 简介: '做机器人' } };
    const 数据 = 准备Backend职位正文(视图, 真实简历);
    expect(数据.公司.资料.介绍段).toBe('做机器人');
    expect(数据.公司.资料.元行组).toHaveLength(5);
  });

  it('发布人缺席：原卡位生成占位对象，不拿公司声明合成真实身份，图位不取派生首字', () => {
    const 数据 = 准备Backend职位正文(从P4CandidateJob(BFFCandidateJob样本), 真实简历);
    expect(数据.发布人).toEqual({
      图: { 种类: '未知', 可访问名: '发布人图片未知' },
      姓名: '发布人姓名未知',
      公司: '企业信息未知',
      职务: '职务未知',
      备注: '发布人备注未知',
    });
  });

  it('发布人在场：已知姓名/公司/职务照常展示，头像无真实图源给中性图位，wire 无备注给未知', () => {
    const 视图 = 从P4CandidateJob({
      ...BFFCandidateJob样本,
      publisher_profile: {
        public_name: '李四',
        title: '招聘负责人',
        personal_verification_status: 'verified',
      },
    });
    const 数据 = 准备Backend职位正文(视图, 真实简历);
    expect(数据.发布人).toEqual({
      图: { 种类: '未知', 可访问名: '发布人图片未知' },
      姓名: '李四',
      公司: '云衢科技',
      职务: '招聘负责人',
      备注: '发布人备注未知',
    });
  });

  it('发布人 blank 职务按缺失换未知，不渲染空白职务', () => {
    const 视图 = 从P4CandidateJob({
      ...BFFCandidateJob样本,
      publisher_profile: {
        public_name: '李四',
        title: '   ',
        personal_verification_status: 'unverified',
      },
    });
    expect(准备Backend职位正文(视图, 真实简历).发布人.职务).toBe('职务未知');
  });

  it('发布人 blank 姓名按缺失换未知，已知公司/职务照常展示（§3.2 部分字段已知就展示已知部分）', () => {
    const 视图 = 从P4CandidateJob({
      ...BFFCandidateJob样本,
      publisher_profile: {
        public_name: '   ',
        title: '招聘负责人',
        personal_verification_status: 'verified',
      },
    });
    const 发布人 = 准备Backend职位正文(视图, 真实简历).发布人;
    expect(发布人.姓名).toBe('发布人姓名未知');
    expect(发布人.公司).toBe('云衢科技');
    expect(发布人.职务).toBe('招聘负责人');
  });

  it('发布人在场但公司声明为空白：公司槽按缺失换 企业信息未知，已知姓名照常', () => {
    const 视图 = 从P4CandidateJob({
      ...BFFCandidateJob样本,
      hiring_organization_claim: { display_name: '   ', legal_name: null },
      publisher_profile: {
        public_name: '李四',
        title: '招聘负责人',
        personal_verification_status: 'verified',
      },
    });
    const 发布人 = 准备Backend职位正文(视图, 真实简历).发布人;
    expect(发布人.姓名).toBe('李四');
    expect(发布人.公司).toBe('企业信息未知');
  });
});

describe('准备Backend职位正文 · 公开企业补读（Spec §6.1）', () => {
  /** organization 摘要 + 真实组织坐标的推荐卡（公开读取合法前提） */
  const 带摘要卡 = {
    ...BFF候选岗位推荐样本,
    job: { ...BFFCandidateJob样本, organization: BFF公司摘要样本, hiring_organization_ref: 'org_1' },
  };

  it('公司摘要先展示：organization 六键把 融资/规模/行业 行填上已知值，成立/地址保持未知', () => {
    const 数据 = 准备Backend职位正文(从P4候选岗位(带摘要卡), 真实简历);
    expect(数据.公司.资料.元行组).toEqual([
      { 标签: '融资阶段', 值: 'C 轮' },
      { 标签: '规模', 值: '500-1000 人' },
      { 标签: '行业', 值: '金融科技' },
      { 标签: '成立', 值: '未知' },
      { 标签: '地址', 值: '未知' },
    ]);
    // 公开读取没回来：介绍段不称已读无介绍，仍给未知文案
    expect(数据.公司.资料.介绍段).toBe('公司简介未知');
    // organization.logo.url → 原公司图位的真实图片输入；兜底字只作失败回退
    expect(数据.公司.图).toEqual({
      种类: '图片', URL: BFF公司摘要样本.logo!.url, 兜底字: '云', 可访问名: '公司图片未知',
    });
  });

  it('公开读取成功补已提供事实：介绍段/地址进原槽；成立无源仍未知；JD/薪资/匹配不覆盖', () => {
    const 无公开 = 准备Backend职位正文(从P4候选岗位(带摘要卡), 真实简历);
    const 有公开 = 准备Backend职位正文(从P4候选岗位(带摘要卡), 真实简历, BFF公开企业样本);
    expect(有公开.公司.资料.介绍段).toBe(BFF企业档案样本.company_intro);
    expect(有公开.公司.资料.元行组).toEqual([
      { 标签: '融资阶段', 值: 'C 轮' },
      { 标签: '规模', 值: '500-1000 人' },
      { 标签: '行业', 值: '金融科技' },
      { 标签: '成立', 值: '未知' },
      { 标签: '地址', 值: BFF企业档案样本.office_address },
    ]);
    // 岗位正文、薪资与匹配结论是权威来源，公开企业资料不覆盖
    expect(有公开.职位详情行).toEqual(无公开.职位详情行);
    expect(有公开.职位要求行).toEqual(无公开.职位要求行);
    expect(有公开.职位事实行).toEqual(无公开.职位事实行);
    expect(有公开.薪资).toBe(无公开.薪资);
    expect(有公开.匹配).toEqual(无公开.匹配);
  });

  it('局部 null：摘要缺失段由公开档案补；档案也未提供的成员保持未知；空正文不换未知口径', () => {
    const 视图 = 从P4候选岗位({
      ...带摘要卡,
      job: {
        ...带摘要卡.job,
        organization: { ...BFF公司摘要样本, funding_stage: null, company_size: '20_99', logo: null },
      },
    });
    const 数据 = 准备Backend职位正文(视图, 真实简历, {
      ...BFF公开企业样本,
      profile: { ...BFF企业档案样本, company_intro: '  ', office_address: '   ' },
    });
    expect(数据.公司.资料.元行组).toEqual([
      { 标签: '融资阶段', 值: 'C 轮' },
      { 标签: '规模', 值: '20-99 人' },
      { 标签: '行业', 值: '金融科技' },
      { 标签: '成立', 值: '未知' },
      { 标签: '地址', 值: '未知' },
    ]);
    // 档案介绍/地址空白 = 未提供：保持未知，不渲染空白段
    expect(数据.公司.资料.介绍段).toBe('公司简介未知');
  });

  it('摘要缺席时公开档案是唯一已知源：Logo/元行/介绍段都由档案补齐', () => {
    const 视图 = 从P4CandidateJob({
      ...BFFCandidateJob样本, organization: null, hiring_organization_ref: 'org_1',
    });
    const 数据 = 准备Backend职位正文(视图, 真实简历, BFF公开企业样本);
    expect(数据.公司.图).toEqual({
      种类: '图片', URL: BFF企业档案样本.logo!.url, 兜底字: '云', 可访问名: '公司图片未知',
    });
    expect(数据.公司.资料.元行组).toEqual([
      { 标签: '融资阶段', 值: 'C 轮' },
      { 标签: '规模', 值: '500-1000 人' },
      { 标签: '行业', 值: '金融科技' },
      { 标签: '成立', 值: '未知' },
      { 标签: '地址', 值: BFF企业档案样本.office_address },
    ]);
  });

  it('公司图位：真实 URL 优先摘要 Logo，无图保持中性未知占位；发布人头像同接 avatar_url', () => {
    const 无图 = 准备Backend职位正文(从P4CandidateJob(BFFCandidateJob样本), 真实简历);
    expect(无图.公司.图).toEqual({ 种类: '未知', 可访问名: '公司图片未知' });
    expect(无图.发布人.图).toEqual({ 种类: '未知', 可访问名: '发布人图片未知' });
    // 发布人在场但无头像：仍是中性图位，不拿姓名首字充当真实照片
    const 带发布人 = 从P4CandidateJob({
      ...BFFCandidateJob样本,
      publisher_profile: {
        public_name: '林澈', title: '招聘负责人',
        personal_verification_status: 'verified', avatar_url: null,
      },
    });
    expect(准备Backend职位正文(带发布人, 真实简历).发布人.图)
      .toEqual({ 种类: '未知', 可访问名: '发布人图片未知' });
    // avatar_url 在场 → 图位给真实 URL；兜底字只用于加载失败回退
    const 带头像 = 从P4CandidateJob({
      ...BFFCandidateJob样本,
      publisher_profile: {
        public_name: '林澈', title: '招聘负责人',
        personal_verification_status: 'verified', avatar_url: 'https://cdn.example.com/p.png',
      },
    });
    // 兜底字恒空：发布人失败回未知占位，不用姓名首字充当照片
    expect(准备Backend职位正文(带头像, 真实简历).发布人.图).toEqual({
      种类: '图片', URL: 'https://cdn.example.com/p.png', 兜底字: '', 可访问名: '发布人图片未知',
    });
  });
});

describe('准备Mock职位正文 · 原映射原样', () => {
  it('M-13：读 模拟详情表；匹配从行来（硬字段未提及 + 手工四行有证据 → 分 50），手写分析逐字不变', () => {
    const 岗 = 市场列表.find((条) => 条.编号 === 'M-13');
    expect(岗).toBeTruthy();
    const 数据 = 准备Mock职位正文(岗!, 空简历);
    expect(mock取市场岗位详情).toHaveBeenCalledWith(岗);
    expect(数据.职位).toBe('交易中台架构师');
    expect(数据.薪资).toBe('60-80K');
    expect(数据.匹配).toEqual({
      种类: '核对',
      分: 50,
      行们: [
        { 要求: '经验 5 年以上', 证据: null, 态: '未提及', 类: '硬性' },
        { 要求: '学历 本科及以上', 证据: null, 态: '未提及', 类: '硬性' },
        { 要求: 'Go 主栈', 证据: '字节跳动 · 交易中台 · Go · 9 年', 态: '有证据', 类: '必须' },
        { 要求: '做过高并发架构与分布式事务', 证据: '交易网关重建 · 峰值 32 万 QPS', 态: '有证据', 类: '必须' },
        { 要求: '稳定性治理的体系化实践', 证据: '多活改造 · 故障分钟级切换', 态: '有证据', 类: '必须' },
        { 要求: '带过团队', 证据: '直管 8 人小组', 态: '有证据', 类: '必须' },
      ],
      分析: {
        墨句: '9 年交易中台经验与硕士学历超出岗位要求，主栈、高并发、分布式事务、稳定性治理与带队全部有简历证据。',
        灰句: '',
      },
    });
  });

  it('JD/发布人/公司逐字来自 取市场岗位详情：不在详情表的岗走原合成 fallback（职务/备注空值原样，不添未知）', () => {
    const 岗 = 市场列表.find((条) => 条.编号 === 'M-02');
    expect(岗).toBeTruthy();
    const 数据 = 准备Mock职位正文(岗!, 空简历);
    const 详 = 取市场岗位详情(岗!);
    expect(数据.职位详情标题).toBe('职位详情');
    expect(数据.职位事实行).toEqual([]);
    expect(数据.职位详情行).toEqual(详.职位详情);
    expect(数据.职位要求标题).toBe('职位要求');
    expect(数据.职位要求行).toEqual(详.职位要求);
    expect(数据.发布人).toEqual({
      图: { 种类: '字标', 字: 详.发布人.首字 },
      姓名: 详.发布人.姓名,
      公司: 详.发布人.公司,
      职务: 详.发布人.职务,
      备注: 详.发布人.备注,
    });
    expect(数据.公司.图).toEqual({ 种类: '字标', 字: 详.公司.首字 });
    expect(数据.公司.名称).toBe(详.公司.名称);
    expect(数据.公司.简介).toBe(详.公司.简介);
  });

  it('公司资料与 公司区块 原组件同一输入的可观察输出对照：介绍段与元行顺序/文案逐字一致', () => {
    // M-13 美团不在静态档案表 → 原组件走合成兜底档：一行简介拆段，无 介绍段、无 成立/地址
    const 岗 = 市场列表.find((条) => 条.编号 === 'M-13')!;
    const 数据 = 准备Mock职位正文(岗, 空简历);
    render(
      createElement(公司区块, {
        名称: 岗.公司,
        首字: 岗.公司首字,
        一行简介: 数据.公司.简介,
      }),
    );
    expect(数据.公司.资料.介绍段).toBeNull();
    expect(数据.公司.资料.元行组).toEqual([
      { 标签: '融资阶段', 值: '已上市' },
      { 标签: '规模', 值: '10000 人以上' },
      { 标签: '行业', 值: '本地生活' },
    ]);
    for (const { 标签, 值 } of 数据.公司.资料.元行组) {
      expect(screen.getByText(标签)).toBeTruthy();
      expect(screen.getByText(值)).toBeTruthy();
    }
    expect(screen.queryByText(/主页尚未完善/)).toBeNull();
  });

  it('公司档已补全：介绍段取档案首段，元行含 融资/规模/行业/成立/地址（成立取 成立日期 年份）', () => {
    mock公司路由键.mockReturnValue('full-co');
    mock取公司档案.mockReturnValue({
      键: 'full-co',
      名称: '全资公司',
      首字: '全',
      规模行: 'B 轮 · 120 人 · 数据安全',
      地址: '静安区南京西路 1 号',
      简介: ['做数据安全'],
      工商信息: [{ 项: '成立日期', 值: '2016-03-01' }],
    });
    const 岗 = 市场列表.find((条) => 条.编号 === 'M-12')!;
    const 数据 = 准备Mock职位正文(岗, 空简历);
    expect(mock公司路由键).toHaveBeenCalledWith('PingCAP');
    expect(mock取公司档案).toHaveBeenCalledWith('full-co');
    expect(数据.公司.资料).toEqual({
      介绍段: '做数据安全',
      元行组: [
        { 标签: '融资阶段', 值: 'B 轮' },
        { 标签: '规模', 值: '120 人' },
        { 标签: '行业', 值: '数据安全' },
        { 标签: '成立', 值: '2016 年' },
        { 标签: '地址', 值: '静安区南京西路 1 号' },
      ],
    });
  });

  it('公司档已补全但无 成立日期 条目：只有 地址 行，不造成立年份', () => {
    mock公司路由键.mockReturnValue('no-found');
    mock取公司档案.mockReturnValue({
      键: 'no-found',
      名称: '某公司',
      首字: '某',
      规模行: 'A 轮 · 80 人 · 机器人',
      地址: '徐汇区某路 2 号',
      简介: ['做机器人'],
      工商信息: [],
    });
    const 岗 = 市场列表.find((条) => 条.编号 === 'M-12')!;
    expect(准备Mock职位正文(岗, 空简历).公司.资料.元行组).toEqual([
      { 标签: '融资阶段', 值: 'A 轮' },
      { 标签: '规模', 值: '80 人' },
      // 「机器人」含「人」→ 原认段规则归入规模；重复标签原样保留
      { 标签: '规模', 值: '机器人' },
      { 标签: '地址', 值: '徐汇区某路 2 号' },
    ]);
  });

  it('公司档未补全：不取档案成立/地址，即使工商信息里有 成立日期', () => {
    mock公司路由键.mockReturnValue('todo-co');
    mock取公司档案.mockReturnValue({
      键: 'todo-co',
      名称: '待补公司',
      首字: '待',
      规模行: '规模与融资信息待补充',
      地址: '地址信息待补充',
      简介: ['待补公司的自述'],
      工商信息: [{ 项: '成立日期', 值: '2020-01-01' }],
    });
    const 岗 = 市场列表.find((条) => 条.编号 === 'M-12')!;
    const 数据 = 准备Mock职位正文(岗, 空简历);
    expect(数据.公司.资料.介绍段).toBeNull();
    // 未补全 → 段来自一行简介（M-12 = D 轮 · 500-1000 人 · 分布式数据库），成立/地址都不出
    expect(数据.公司.资料.元行组).toEqual([
      { 标签: '融资阶段', 值: 'D 轮' },
      { 标签: '规模', 值: '500-1000 人' },
      { 标签: '行业', 值: '分布式数据库' },
    ]);
  });

  it('档案规模行按「 · 」拆不足两段：返回空元行（组件退回一行简介兜底）', () => {
    mock公司路由键.mockReturnValue('one-seg');
    mock取公司档案.mockReturnValue({
      键: 'one-seg',
      名称: '单段公司',
      首字: '单',
      规模行: '50-100 人',
      地址: '某地址',
      简介: ['做硬件'],
      工商信息: [{ 项: '成立日期', 值: '2018-01-01' }],
    });
    const 岗 = 市场列表.find((条) => 条.编号 === 'M-12')!;
    const 数据 = 准备Mock职位正文(岗, 空简历);
    expect(数据.公司.资料.元行组).toEqual([]);
    expect(数据.公司.资料.介绍段).toBe('做硬件');
  });

  it('元行按内容认段且重复项原样保留（两个行业段不合并、不重排）', () => {
    mock公司路由键.mockReturnValue('dup-co');
    mock取公司档案.mockReturnValue({
      键: 'dup-co',
      名称: '重复段公司',
      首字: '重',
      规模行: '电商 · 本地生活 · 出行',
      地址: '某路 3 号',
      简介: ['多业务'],
      工商信息: [],
    });
    const 岗 = 市场列表.find((条) => 条.编号 === 'M-12')!;
    expect(准备Mock职位正文(岗, 空简历).公司.资料.元行组).toEqual([
      { 标签: '行业', 值: '电商' },
      { 标签: '行业', 值: '本地生活' },
      { 标签: '行业', 值: '出行' },
      { 标签: '地址', 值: '某路 3 号' },
    ]);
  });

  it('Mock 图位始终是已知字标（不按未知名称猜图），直接聊能力不在数据层（由连接层给回调）', () => {
    const 岗 = 市场列表.find((条) => 条.编号 === 'M-13')!;
    const 数据 = 准备Mock职位正文(岗, 空简历);
    expect(数据.公司.图).toEqual({ 种类: '字标', 字: '美' });
    expect(数据.发布人.图).toEqual({ 种类: '字标', 字: '梁' });
  });
});