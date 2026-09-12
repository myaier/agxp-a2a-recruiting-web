// 在线简历展示映射测试：BFF候选在线简历（nullable 共享在线简历）→ 在线简历展示资料 的
// 纯函数投影。语义分界是本文件的门槛：resume / 区域 null = 数据源未提供（缺失），
// [] = 提供了但一条没有，两者在映射结果里不可互换；identity / 候选薪资 / 行业 /
// 公司实名恢复字段一律带不出去。

import { describe, expect, it } from 'vitest';
import { BFF安全简历经历样本, BFF候选在线简历样本 } from '../测试/展示资料样本';
import type { BFF招聘候选摘要 } from './BFF契约';
import type { 在线简历展示资料 } from '../组件/在谈详情/类型';
import { 从BFF到在线简历展示 } from './在线简历展示映射';

/** 收口非 null 断言：映射结果为 null 时显式失败，后续槽访问免非空断言 */
function 必有(资料: 在线简历展示资料 | null): 在线简历展示资料 {
  if (资料 === null) throw new Error('期望非 null 的展示资料');
  return 资料;
}

describe('从BFF到在线简历展示', () => {
  it('完整样本按原信息槽投影：画像 / 个人优势 / 期望 / 工作 / 项目 / 教育 / 技能', () => {
    expect(从BFF到在线简历展示(BFF候选在线简历样本)).toEqual({
      画像: { 性别: '女', 年限: '5 年', 学历: '本科', 求职状态: '在职看机会', 职位行: '示例公司 · 软件工程师' },
      个人优势: '四年全栈经验',
      期望: { 标题: '社招全职 · 产品经理', 薪资关系: '薪资带有交集', 副行: '上海 · 混合 · 全远程' },
      工作: [{ 公司: '云衢', 起止: '2021.01—至今', 职位: '工程师', 说明: '平台研发' }],
      项目: [{ 名称: '推荐引擎', 角色: '负责人', 结果: '转化提升 12%' }],
      教育: [{ 行: '复旦大学 · 计算机科学 · 本科', 起止: '2017.09—2021.06' }],
      技能: ['TypeScript', 'React'],
    });
  });

  it('整份 null（详情 candidate_resume = null）投影为 null，不造空资料', () => {
    expect(从BFF到在线简历展示(null)).toBeNull();
  });

  it('仅部分区在场：缺席区域显式 null，在场区域照常投影', () => {
    const 资料 = 必有(从BFF到在线简历展示({
      ...BFF候选在线简历样本,
      summary: null,
      self_description: null,
      skills: null,
      educations: null,
      expectation: null,
    }));
    expect(资料.画像).toBeNull();
    expect(资料.个人优势).toBeNull();
    expect(资料.技能).toBeNull();
    expect(资料.教育).toBeNull();
    expect(资料.期望).toBeNull();
    // 在场区域不受缺席区域影响
    expect(资料.工作).toHaveLength(1);
    expect(资料.项目).toHaveLength(1);
  });

  it('每个区 null 与 [] 不可互换：null = 未提供，[] = 提供了但一条没有', () => {
    const 全缺 = 必有(从BFF到在线简历展示({
      ...BFF候选在线简历样本,
      skills: null,
      experiences: null,
      educations: null,
    }));
    expect(全缺.技能).toBeNull();
    expect(全缺.工作).toBeNull();
    expect(全缺.项目).toBeNull();
    expect(全缺.教育).toBeNull();

    const 全空 = 必有(从BFF到在线简历展示({
      ...BFF候选在线简历样本,
      skills: [],
      experiences: [],
      educations: [],
    }));
    expect(全空.技能).toEqual([]);
    expect(全空.工作).toEqual([]);
    expect(全空.项目).toEqual([]);
    expect(全空.教育).toEqual([]);
  });

  it('多教育 / 多工作 / 多项目：项目按所属工作顺序平铺，教育逐条保留', () => {
    const 资料 = 必有(从BFF到在线简历展示({
      ...BFF候选在线简历样本,
      experiences: [
        { ...BFF安全简历经历样本, projects: [
          { name: '推荐引擎', role: '负责人', result: '转化提升 12%' },
          { name: '风控网关', role: '成员', result: null },
        ] },
        { ...BFF安全简历经历样本, company: '前一家', start_month: '2018-03', end_month: '2020-12', projects: [
          { name: '对账系统', role: '负责人', result: '差错率降 90%' },
        ] },
      ],
      educations: [
        { institution: '复旦大学', major: '计算机科学', degree: '本科', start_month: '2017-09', end_month: '2021-06' },
        { institution: '交通大学', major: '软件工程', degree: '硕士', start_month: '2021-09', end_month: null },
      ],
    }));
    expect(资料.工作?.map((段) => 段.公司)).toEqual(['云衢', '前一家']);
    expect(资料.项目?.map((项) => 项.名称)).toEqual(['推荐引擎', '风控网关', '对账系统']);
    expect(资料.教育?.map((条) => 条.行)).toEqual([
      '复旦大学 · 计算机科学 · 本科',
      '交通大学 · 软件工程 · 硕士',
    ]);
    // 教育第二条 ongoing：有真实开始时间才给「至今」
    expect(资料.教育?.[1]?.起止).toBe('2021.09—至今');
  });

  it('重复日期 / 重复条目不丢条：起止相同的两条教育都保留', () => {
    const 资料 = 必有(从BFF到在线简历展示({
      ...BFF候选在线简历样本,
      educations: [
        { institution: '复旦大学', major: '计算机科学', degree: '本科', start_month: '2017-09', end_month: '2021-06' },
        { institution: '复旦大学', major: '计算机科学', degree: '本科', start_month: '2017-09', end_month: '2021-06' },
      ],
    }));
    expect(资料.教育).toHaveLength(2);
  });

  it('起止规则：有开始时间才把 end_month=null 显示为至今；起始也缺失给日期未知，不造一段任职', () => {
    const 资料 = 必有(从BFF到在线简历展示({
      ...BFF候选在线简历样本,
      experiences: [
        { ...BFF安全简历经历样本 },
        { ...BFF安全简历经历样本, start_month: null, end_month: '2020-12' },
        { ...BFF安全简历经历样本, start_month: null, end_month: null },
      ],
    }));
    expect(资料.工作?.[0]?.起止).toBe('2021.01—至今');
    expect(资料.工作?.[1]?.起止).toBe('日期未知');
    expect(资料.工作?.[2]?.起止).toBe('日期未知');
  });

  it('internship=false 原样保留不外泄：资料不带实习标记，也不新增行业行', () => {
    const 资料 = 从BFF到在线简历展示({
      ...BFF候选在线简历样本,
      experiences: [BFF安全简历经历样本],
    });
    expect(JSON.stringify(资料)).not.toContain('实习');
    expect(JSON.stringify(资料)).not.toContain('互联网'); // industry 无原槽，不带出
  });

  it('公司缺失给中性缺失标记，不借 industry 伪装公司名；职位/说明缺失给 null', () => {
    const 资料 = 必有(从BFF到在线简历展示({
      ...BFF候选在线简历样本,
      experiences: [{ ...BFF安全简历经历样本, company: null, title: null, description: null, industry: '互联网' }],
    }));
    expect(资料.工作?.[0]?.公司).toBe('未披露');
    expect(资料.工作?.[0]?.职位).toBeNull();
    expect(资料.工作?.[0]?.说明).toBeNull();
    expect(JSON.stringify(资料)).not.toContain('互联网');
  });

  it('compensation_relationship 只驱动既有薪资关系文案：unknown 不作结论', () => {
    const 交集 = 从BFF到在线简历展示(BFF候选在线简历样本);
    expect(交集?.期望?.薪资关系).toBe('薪资带有交集');
    const 接近 = 从BFF到在线简历展示({ ...BFF候选在线简历样本, compensation_relationship: 'near_miss' });
    expect(接近?.期望?.薪资关系).toBe('薪资带接近');
    const 无交集 = 从BFF到在线简历展示({ ...BFF候选在线简历样本, compensation_relationship: 'disjoint' });
    expect(无交集?.期望?.薪资关系).toBe('薪资带无交集');
    const 未知 = 从BFF到在线简历展示({ ...BFF候选在线简历样本, compensation_relationship: 'unknown' });
    expect(未知?.期望?.薪资关系).toBeNull();
    expect(JSON.stringify(未知)).not.toContain('薪资带'); // 不作结论就一个字都不出
  });

  it('期望缺失或全空收口为 null；地点/办公方式里的空白段丢弃', () => {
    expect(从BFF到在线简历展示({ ...BFF候选在线简历样本, expectation: null })?.期望).toBeNull();
    const 全空 = 从BFF到在线简历展示({
      ...BFF候选在线简历样本,
      compensation_relationship: 'unknown',
      expectation: { recruitment_type: null, job_category: null, locations: null, workplace_modes: null },
    });
    expect(全空?.期望).toBeNull();

    const 部分 = 从BFF到在线简历展示({
      ...BFF候选在线简历样本,
      expectation: {
        recruitment_type: 'internship',
        job_category: { id: 'tax_product', display_name: '产品经理' },
        locations: [{ id: 'loc_1', display_name: '  ' }],
        workplace_modes: [],
      },
    });
    expect(部分?.期望).toEqual({ 标题: '实习生 · 产品经理', 薪资关系: '薪资带有交集', 副行: null });
  });

  it('个人优势 / 画像职位行 trim 判空按缺失处理；自由文本原样保留（含 HTML 样式字符）', () => {
    // 纯空白最近工作 = 缺失，不合成占位
    const 摘要最近工作空白: BFF招聘候选摘要 = {
      gender: 'female',
      experience_years: 5,
      job_status: 'employed',
      degree: '本科',
      latest_experience: { company: ' ', title: null },
      latest_education: { institution: '示例大学', major: '计算机科学' },
      personal_highlights: ['带领5人团队交付'],
    };
    const 资料 = 必有(从BFF到在线简历展示({
      ...BFF候选在线简历样本,
      self_description: '  <b>主导交易网关重建</b>\n第二行 ',
      summary: 摘要最近工作空白,
    }));
    expect(资料.个人优势).toBe('<b>主导交易网关重建</b>\n第二行');
    expect(资料.画像?.职位行).toBeNull();
  });
});