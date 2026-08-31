// 组织映射测试：current Affiliation 选择规则、四组 closed vocabulary 双向 round trip、
// industry 三分支、媒体 ID 来源、公开视图只含线上字段、Job publisher/hiring 投影不折叠。

import { describe, expect, it } from 'vitest';
import {
  BFF企业关系样本,
  BFF企业媒体样本,
  BFF企业档案样本,
  BFF企业管理员申请样本,
  BFF公开企业样本,
  BFF岗位样本,
  BFF招聘方档案样本,
} from '../测试/BFF样本';
import { 作息池, 规模池, 福利标签池, 融资阶段池 } from './公司主页资料';
import {
  作息文案,
  公司规模文案,
  福利文案,
  融资阶段文案,
  可用企业关系,
  从BFF企业档案,
  从BFF公开企业,
  从BFF岗位发布方,
  从BFF招聘身份,
  选择当前企业关系,
  转BFF企业档案替换,
} from './组织映射';

const 全部福利码 = Object.keys(福利文案) as (keyof typeof 福利文案)[];

describe('选择当前企业关系', () => {
  it('无恢复值且恰好一个 active+verified 时自动选', () => {
    expect(选择当前企业关系([BFF企业关系样本], null)).toBe('aff_1');
  });

  it('多个可用关系不按响应顺序猜', () => {
    const 另一关系 = { ...BFF企业关系样本, affiliation_id: 'aff_2', organization_id: 'org_2' };
    expect(选择当前企业关系([BFF企业关系样本, 另一关系], null)).toBeNull();
  });

  it('恢复值仍可用时保留（即使存在多个关系）', () => {
    const 另一关系 = { ...BFF企业关系样本, affiliation_id: 'aff_2', organization_id: 'org_2' };
    expect(选择当前企业关系([BFF企业关系样本, 另一关系], 'aff_1')).toBe('aff_1');
  });

  it('revoked 或 suspended 的关系清空选择，不自动切到另一个', () => {
    const 已吊销 = { ...BFF企业关系样本, status: 'revoked' as const };
    const 已停业 = { ...BFF企业关系样本, organization_status: 'suspended' as const };
    const 另一可用 = { ...BFF企业关系样本, affiliation_id: 'aff_2', organization_id: 'org_2' };
    // 无恢复值：唯一关系 revoked / suspended → null
    expect(选择当前企业关系([已吊销], null)).toBeNull();
    expect(选择当前企业关系([已停业], null)).toBeNull();
    // 恢复值指向已失效关系 → 清空且不猜另一个可用关系
    expect(选择当前企业关系([已吊销, 另一可用], 'aff_1')).toBeNull();
    expect(可用企业关系(已吊销)).toBe(false);
    expect(可用企业关系(已停业)).toBe(false);
    expect(可用企业关系(BFF企业关系样本)).toBe(true);
  });
});

describe('closed vocabulary 双向 round trip', () => {
  it('公司规模 code↔中文 与 规模池 同序闭合', () => {
    expect(Object.values(公司规模文案).filter((文) => 文 !== '')).toEqual(规模池);
    expect(公司规模文案['']).toBe('');
    for (const [code, 文] of Object.entries(公司规模文案)) {
      expect(转BFF企业档案替换(
        { ...从BFF企业档案(BFF企业档案样本), 规模: 文 },
        BFF企业档案样本,
      ).company_size).toBe(code);
    }
  });

  it('融资阶段 code↔中文 与 融资阶段池 同序闭合', () => {
    expect(Object.values(融资阶段文案).filter((文) => 文 !== '')).toEqual(融资阶段池);
    expect(融资阶段文案['']).toBe('');
    for (const [code, 文] of Object.entries(融资阶段文案)) {
      expect(转BFF企业档案替换(
        { ...从BFF企业档案(BFF企业档案样本), 融资阶段: 文 },
        BFF企业档案样本,
      ).funding_stage).toBe(code);
    }
  });

  it('作息 code↔中文 与 作息池 同序闭合', () => {
    expect(Object.values(作息文案).filter((文) => 文 !== '')).toEqual(作息池);
    expect(作息文案['']).toBe('');
    for (const [code, 文] of Object.entries(作息文案)) {
      expect(转BFF企业档案替换(
        { ...从BFF企业档案(BFF企业档案样本), 作息档: 文 },
        BFF企业档案样本,
      ).work_schedule).toBe(code);
    }
  });

  it('benefit_codes 17 项与 福利标签池 同序一一映射且可回写', () => {
    expect(全部福利码).toHaveLength(17);
    expect(全部福利码.map((码) => 福利文案[码])).toEqual(福利标签池);
    const 全选档案 = { ...BFF企业档案样本, benefit_codes: 全部福利码 };
    const 草稿 = 从BFF企业档案(全选档案);
    expect(草稿.福利标签).toEqual(福利标签池);
    expect(转BFF企业档案替换(草稿, 全选档案).benefit_codes).toEqual(全部福利码);
  });
});

describe('从BFF企业档案 / 转BFF企业档案替换', () => {
  it('从BFF企业档案 填充中文档位与可选媒体元数据', () => {
    const 资料 = 从BFF企业档案(BFF企业档案样本);
    expect(资料).toMatchObject({
      公司全称: '云衢科技',
      行业: '金融科技',
      规模: '500-1000 人',
      融资阶段: 'C 轮',
      办公地址: '上海市张江路 1 号',
      福利标签: ['五险一金', '股票期权'],
      作息档: '双休',
      公司介绍: '做可靠的技术产品',
      主营业务: '智能招聘平台',
      实景照片: [BFF企业媒体样本.url],
      公司照片: [],
      产品介绍: 'AI 简历助手',
      团队介绍: [{ 姓名: '林澈', 职务: '招聘负责人', 简介: '负责招聘' }],
      行业引用: { id: 'tax_fintech', display_name: '金融科技' },
      LOGO媒体: BFF企业媒体样本,
      实景媒体: [BFF企业媒体样本],
      公司媒体: [],
    });
  });

  it('无行业时 行业 为空串且 行业引用 归一为未设置', () => {
    const 资料 = 从BFF企业档案({ ...BFF企业档案样本, industry: null });
    expect(资料.行业).toBe('');
    expect(资料.行业引用).toBeUndefined();
  });

  it('identity round trip：从BFF企业档案 再 转BFF企业档案替换 还原同一 replacement', () => {
    const 草稿 = 从BFF企业档案(BFF企业档案样本);
    expect(转BFF企业档案替换(草稿, BFF企业档案样本)).toEqual({
      brand_name: '云衢科技',
      industry_id: 'tax_fintech',
      company_size: '500_1000',
      funding_stage: 'series_c',
      office_address: '上海市张江路 1 号',
      benefit_codes: ['social_insurance_housing_fund', 'stock_options'],
      work_schedule: 'two_day_weekend',
      company_intro: '做可靠的技术产品',
      business_items: ['智能招聘平台'],
      office_media_ids: ['media_1'],
      company_media_ids: [],
      product_intro: 'AI 简历助手',
      team_members: [{ name: '林澈', title: '招聘负责人', summary: '负责招聘' }],
      logo_media_id: 'media_1',
    });
  });

  it('industry 三分支：引用 ID / 两空发空字符串 / 只有显示名拒绝', () => {
    const 草稿 = 从BFF企业档案(BFF企业档案样本);
    expect(转BFF企业档案替换({ ...草稿, 行业引用: { id: 'ind_ai', display_name: '人工智能' } }, BFF企业档案样本).industry_id)
      .toBe('ind_ai');
    expect(转BFF企业档案替换({ ...草稿, 行业: '', 行业引用: undefined }, BFF企业档案样本).industry_id).toBe('');
    expect(() => 转BFF企业档案替换({ ...草稿, 行业: '金融科技', 行业引用: undefined }, BFF企业档案样本))
      .toThrow('请从候选行业中选择');
  });

  it('媒体 ID 取自草稿里的显式上传结果，无 LOGO 用空字符串', () => {
    const 草稿 = 从BFF企业档案(BFF企业档案样本);
    const 新媒体 = { ...BFF企业媒体样本, media_id: 'media_new', url: 'https://cdn.example.com/new.png' };
    const 替换 = 转BFF企业档案替换(
      { ...草稿, 实景媒体: [BFF企业媒体样本, 新媒体], LOGO媒体: null },
      BFF企业档案样本,
    );
    expect(替换.office_media_ids).toEqual(['media_1', 'media_new']);
    expect(替换.logo_media_id).toBe('');
    // server 无 LOGO、草稿也无 LOGO 元数据时同样发空字符串
    const 无LOGO服务端 = { ...BFF企业档案样本, logo: null };
    expect(转BFF企业档案替换(从BFF企业档案(无LOGO服务端), 无LOGO服务端).logo_media_id).toBe('');
  });

  it('Mock 构造函数可以不传新增可选元数据（两空行业发空字符串）', () => {
    const Mock资料 = {
      公司全称: '云衢科技', 行业: '', 规模: '', 融资阶段: '', 办公地址: '',
      福利标签: [], 作息档: '', 公司介绍: '', 主营业务: '', 实景照片: [], 公司照片: [],
      产品介绍: '', 团队介绍: [],
    };
    expect(转BFF企业档案替换(Mock资料, BFF企业档案样本).industry_id).toBe('');
  });
});

describe('从BFF招聘身份', () => {
  it('profile 为 null 时归一到空值与未认证', () => {
    const 视图 = 从BFF招聘身份(null, [BFF企业关系样本], null, []);
    expect(视图.publicName).toBe('');
    expect(视图.title).toBe('');
    expect(视图.personalVerification).toEqual({ code: 'unverified', label: '未认证' });
    expect(视图.verifiedName).toBeNull();
    expect(视图.avatarUrl).toBeNull();
    expect(视图.currentAffiliation).toBeNull();
    expect(视图.latestAdminRequest).toBeNull();
  });

  it('映射档案、关系视图、当前关系与最新申请状态', () => {
    const 另一关系 = { ...BFF企业关系样本, affiliation_id: 'aff_2', organization_id: 'org_2', role: 'member' as const };
    const 视图 = 从BFF招聘身份(
      { ...BFF招聘方档案样本, personal_verification_status: 'verified', verified_name: '林澈' },
      [BFF企业关系样本, 另一关系],
      'aff_2',
      [BFF企业管理员申请样本],
    );
    expect(视图.publicName).toBe('林澈');
    expect(视图.personalVerification).toEqual({ code: 'verified', label: '已认证' });
    expect(视图.verifiedName).toBe('林澈');
    expect(视图.affiliations).toHaveLength(2);
    expect(视图.affiliations[0]).toEqual({
      id: 'aff_1', organizationId: 'org_1', organizationName: '云衢科技',
      status: 'verified', statusLabel: '已认证', role: 'admin', roleLabel: '管理员', selectable: true,
    });
    expect(视图.affiliations[1].roleLabel).toBe('成员');
    expect(视图.currentAffiliation?.id).toBe('aff_2');
    expect(视图.latestAdminRequest).toEqual({
      id: 'req_1', status: 'pending', statusLabel: '待审核', revision: 1,
    });
  });
});

describe('从BFF公开企业', () => {
  it('只含线上字段，revision 来自 profile.revision', () => {
    expect(从BFF公开企业(BFF公开企业样本)).toEqual({
      organizationId: 'org_1',
      legalName: '上海云衢科技有限公司',
      displayName: '云衢科技',
      verifiedAt: '2026-08-24T00:00:00Z',
      brandName: '云衢科技',
      industryName: '金融科技',
      companySizeLabel: '500-1000 人',
      fundingStageLabel: 'C 轮',
      officeAddress: '上海市张江路 1 号',
      benefitLabels: ['五险一金', '股票期权'],
      workScheduleLabel: '双休',
      companyIntro: '做可靠的技术产品',
      businessItems: ['智能招聘平台'],
      productIntro: 'AI 简历助手',
      teamMembers: [{ name: '林澈', title: '招聘负责人', summary: '负责招聘' }],
      logoUrl: BFF企业媒体样本.url,
      officeMediaUrls: [BFF企业媒体样本.url],
      companyMediaUrls: [],
      activeVerifiedJobCount: 2,
      revision: 3,
    });
  });

  it('无行业与无 LOGO 归一为 null', () => {
    const 视图 = 从BFF公开企业({ ...BFF公开企业样本, profile: { ...BFF企业档案样本, industry: null, logo: null } });
    expect(视图.industryName).toBeNull();
    expect(视图.logoUrl).toBeNull();
  });
});

describe('从BFF岗位发布方', () => {
  it('publisher 与 hiring organization 投影不折叠', () => {
    const 视图 = 从BFF岗位发布方({
      ...BFF岗位样本,
      publisher_mode: 'agency',
      publisher_verification_status: 'verified',
      publisher_organization_ref: 'org_publisher',
      hiring_organization_verification_status: 'verified',
      hiring_organization_ref: 'org_hiring',
    });
    expect(视图).toEqual({
      发布方模式: 'agency',
      发布方验证: 'verified',
      发布方企业编号: 'org_publisher',
      用人企业验证: 'verified',
      用人企业编号: 'org_hiring',
      用人企业声明: { display_name: '云衢科技', legal_name: null },
    });
  });

  it('ref 缺省归一为 null，不猜编号', () => {
    const 视图 = 从BFF岗位发布方(BFF岗位样本);
    expect(视图.发布方企业编号).toBeNull();
    expect(视图.用人企业编号).toBeNull();
    expect(视图.发布方验证).toBe('unverified');
    expect(视图.用人企业验证).toBe('unverified');
  });
});
