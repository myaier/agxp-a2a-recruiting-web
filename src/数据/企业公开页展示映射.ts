// 企业公开页展示映射：两条合法来源投影成同一份 企业公开页资料（接口 A）。
//
// 从公开企业到展示 只消费冻结的 公开企业视图：空串 trim 后转 null、空列表转 null、
// 未知枚举按 Spec §6 补明确未知文案；legal/display/verified_at 是必需身份字段，
// 原样保留、不用占位掩盖契约错误；activeVerifiedJobCount 的真实 0 不是未知。
//
// 从模拟企业到展示 只消费外层已按原条件叠加 公司自述覆盖 的 Mock 档：企业身份、
// 核验时间与真实 LOGO 没有 Mock 事实来源，一律 null，不拿展示名或首字顶替。
//
// 本文件不查 Mock 表、不读应用状态、不发请求，也不改写两条来源本身 ——
// 「未知」只进入展示资料，不回流接口、缓存或保存数据。

import type { 公开企业视图 } from './组织映射';
import type { 公司档案 } from './公司档案';
import type { 公司自述覆盖 } from './类型';
import type { 企业公开页资料 } from '../组件/企业公开页/类型';

/** 非空文本 → 原值；空白 → null（缺失与真实 0 / 合法否定分开处理） */
function 文本(值: string): string | null {
  const 收紧 = 值.trim();
  return 收紧 === '' ? null : 收紧;
}

export function 从公开企业到展示(视图: 公开企业视图): 企业公开页资料 {
  const 简介 = 文本(视图.companyIntro);
  const 相册 = [...视图.officeMediaUrls, ...视图.companyMediaUrls];
  return {
    名称: 视图.displayName,
    图片: 视图.logoUrl,
    规模行: [
      文本(视图.fundingStageLabel) ?? '融资阶段未知',
      文本(视图.companySizeLabel) ?? '公司规模未知',
      文本(视图.industryName ?? '') ?? '行业未知',
    ].join(' · '),
    简介: 简介 === null ? null : [简介],
    文化: null, // 公开契约没有企业文化字段
    历程: null, // 公开契约没有发展历程字段
    业务: 视图.businessItems.length > 0 ? 视图.businessItems : null,
    相册: 相册.length > 0 ? 相册 : null,
    产品: 文本(视图.productIntro),
    团队:
      视图.teamMembers.length > 0
        ? 视图.teamMembers.map((位) => ({
            姓名: 文本(位.name),
            职务: 文本(位.title),
            简介: 文本(位.summary),
          }))
        : null,
    作息: 文本(视图.workScheduleLabel),
    // 福利标签是企业自述：没有逐条说明字段，也没有代理核对结果
    条款:
      视图.benefitLabels.length > 0
        ? 视图.benefitLabels.map((名称) => ({ 名称, 说明: null, 已核: false }))
        : null,
    代理核对已知: false,
    地址: 文本(视图.officeAddress),
    地址补充: null, // 公开契约没有地址补充字段
    反馈: null, // 公开契约没有在职者反馈字段
    工商: null, // 公开契约没有完整工商资料，不从私有组织字段补齐
    工商来源说明: null,
    身份: {
      法定名称: 视图.legalName,
      展示名称: 视图.displayName,
      核验时间: 视图.verifiedAt.slice(0, 10),
      已核验: true,
      岗位数: 视图.activeVerifiedJobCount,
      岗位数已核验: true,
    },
    页脚: '公开信息由企业主页提供 · 企业身份经平台核验',
  };
}

export function 从模拟企业到展示(档: 公司档案 & Partial<公司自述覆盖>): 企业公开页资料 {
  const 相册 = [...(档.公司相册?.实景照片 ?? []), ...(档.公司相册?.公司照片 ?? [])];
  const 团队 = 档.团队介绍 ?? [];
  return {
    名称: 档.名称,
    图片: null, // Mock 档没有真实 LOGO 来源，不把首字当图片
    规模行: 档.规模行, // Mock 保留现有整行，不反向解析三种事实
    简介: 档.简介.length > 0 ? 档.简介 : null,
    文化: 文本(档.企业文化),
    历程: 档.发展历程.length > 0 ? 档.发展历程 : null,
    业务: 档.主营业务.length > 0 ? 档.主营业务 : null,
    相册: 相册.length > 0 ? 相册 : null,
    产品: 文本(档.产品介绍 ?? ''),
    团队:
      团队.length > 0
        ? 团队.map((位) => ({
            姓名: 文本(位.姓名),
            职务: 文本(位.职务),
            简介: 文本(位.简介),
          }))
        : null,
    作息: 文本(档.作息),
    条款:
      档.福利.length > 0
        ? 档.福利.map((项) => ({
            名称: 项.名称,
            说明: 文本(项.说明),
            已核: 项.核对 === '已核',
          }))
        : null,
    代理核对已知: true,
    地址: 文本(档.地址),
    地址补充: 文本(档.地址补充),
    反馈: 档.在职感受.length > 0 ? 档.在职感受 : null,
    工商: 档.工商信息.length > 0 ? 档.工商信息 : null,
    工商来源说明: '已核验',
    身份: {
      法定名称: null, // 没有法定名称事实，不按展示名猜
      展示名称: 档.名称,
      核验时间: null,
      已核验: false,
      岗位数: 档.在招岗位数,
      岗位数已核验: false,
    },
    页脚: '公司自述由企业提供 · 工商信息经第三方核验 · 如有不实可举报',
  };
}
