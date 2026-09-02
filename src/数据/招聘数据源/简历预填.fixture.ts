// 简历预填 wire fixture 与前端映射变体。
// 上半部 简历预填成功信封 逐字同步自后端公共合成 fixture（resume-prefill.v1 冻结合同）：
//   agxp-monorepo@f2d7af5652c48ed65c96d3db679618c597d1c9fd
//   apps/recruitment-bff/testdata/resume-prefill-v1-success.json
// 前端 CI 不读取本机 monorepo —— fixture 进本仓库并在注释记录来源 commit，避免隐式跨仓库依赖。
// 它是且仅是不可变的 wire-decode fixture：绝不改写它来制造正向映射用例。
//
// 下半部是「前端映射变体」构造器：不是后端公共 fixture，只服务于后续页面映射测试，
// 为 wire fixture 里为空的字段提供正向值（合法 gender、合法生日、受支持学历词汇、
// exact 学校/专业 Catalog 命中、≥2 条教育）。每次调用深拷贝基底，测试间互不影响。

import type { BFF简历预填建议 } from '../BFF契约';

export const 简历预填成功信封 = {
  result: {
    schema_version: 'resume-prefill.v1',
    source: {
      file_id: 'rf_0123456789abcdef0123456789abcdef',
      version_id: 'rfv_0123456789abcdef0123456789abcdef',
      parse_id: 'rp_0123456789abcdef0123456789abcdef',
    },
    draft: {
      profile: {
        real_name: { value: 'Synthetic Candidate', confidence: 'high' },
        work_start_year: { value: 2021, confidence: 'medium' },
        status: { value: 'employed', confidence: 'high' },
        current_education: { value: 'Bachelor', confidence: 'medium' },
        graduation_year: { value: 2021, confidence: 'high' },
        gender: { value: null, confidence: null },
        birth_year: { value: null, confidence: null },
        birth_month: { value: null, confidence: null },
      },
      summary: { value: 'Builds reliable synthetic systems.', confidence: 'medium' },
      skills: [{ value: 'Go', confidence: 'high' }],
      experiences: [{
        company: { value: 'Example Systems', confidence: 'high' },
        industry: {
          source_name: { value: 'Software', confidence: 'medium' },
          resolution: 'exact',
          match: { id: 'tax_aaaaaaaaaaaaaaaaaaaaaaaaaa', display_name: 'Software' },
        },
        title: { value: 'Backend Engineer', confidence: 'high' },
        start_month: { value: '2021-07', confidence: 'high' },
        end_month: { value: null, confidence: null },
        description: { value: 'Implemented deterministic services.', confidence: 'medium' },
        internship: { value: false, confidence: 'high' },
        projects: [{
          name: { value: 'Synthetic Gateway', confidence: 'high' },
          role: { value: 'Maintainer', confidence: 'medium' },
          result: { value: 'Reduced contract drift.', confidence: 'medium' },
        }],
      }],
      educations: [{
        institution: {
          source_name: { value: 'Example University', confidence: 'medium' },
          resolution: 'unresolved',
          match: null,
        },
        degree: { value: 'Bachelor', confidence: 'high' },
        major: {
          source_name: { value: 'Computer Science', confidence: 'high' },
          resolution: 'unresolved',
          match: null,
        },
        start_month: { value: '2017-09', confidence: 'high' },
        end_month: { value: '2021-06', confidence: 'high' },
      }],
      certificates: [{
        name: { value: 'Synthetic Cloud Certificate', confidence: 'medium' },
        year: { value: null, confidence: null },
      }],
    },
    warnings: [
      { field_path: 'draft.educations[0].institution', reason: 'catalog_unresolved' },
      { field_path: 'draft.educations[0].major', reason: 'catalog_unresolved' },
    ],
  },
  meta: {
    request_id: '5f0c3a9b8d2e4f60a1b2c3d4e5f6a7b8',
    api_version: 'v1',
  },
} as const;

// ── 前端映射变体构造器：非后端公共 fixture，只为页面映射提供 wire fixture 缺失的正向值 ──

/** 深拷贝 wire fixture 的 result 作为变体基底（as const 的只读层经 unknown 剥离）；
 *  变体从不写回 简历预填成功信封。 */
export function 构造映射变体基底(): BFF简历预填建议 {
  return structuredClone(简历预填成功信封.result) as unknown as BFF简历预填建议;
}

/** 合法性别正向值：wire fixture 的 gender 为空，映射层需要一个可落单选的 male/female。 */
export function 性别已填变体(): BFF简历预填建议 {
  const 建议 = 构造映射变体基底();
  建议.draft.profile.gender = { value: 'female', confidence: 'low' };
  return 建议;
}

/** 合法生日正向值：出生年/月都有值（页面滚轮范围 1970..2010 / 1..12 由映射层判断）。 */
export function 生日已填变体(): BFF简历预填建议 {
  const 建议 = 构造映射变体基底();
  建议.draft.profile.birth_year = { value: 1998, confidence: 'medium' };
  建议.draft.profile.birth_month = { value: 6, confidence: 'medium' };
  return 建议;
}

/** 受支持学历词汇正向值：degree/current_education 精确命中页面四档（大专/本科/硕士/博士）；
 *  wire fixture 的 'Bachelor' 不在受支持词汇内，正向用例必须用本地变体而非改写 fixture。 */
export function 受支持学历变体(): BFF简历预填建议 {
  const 建议 = 构造映射变体基底();
  建议.draft.profile.current_education = { value: '本科', confidence: 'high' };
  建议.draft.educations[0].degree = { value: '本科', confidence: 'high' };
  return 建议;
}

/** exact 学校/专业 Catalog 命中变体：institution/major 带 match 引用，页面可落 canonical ref。 */
export function 目录精确命中变体(): BFF简历预填建议 {
  const 建议 = 构造映射变体基底();
  建议.draft.educations[0].institution = {
    source_name: { value: 'Example University', confidence: 'high' },
    resolution: 'exact',
    match: { id: 'ins_bbbbbbbbbbbbbbbbbbbbbbbbbb', display_name: 'Example University' },
  };
  建议.draft.educations[0].major = {
    source_name: { value: 'Computer Science', confidence: 'high' },
    resolution: 'exact',
    match: { id: 'tax_cccccccccccccccccccccccc', display_name: 'Computer Science' },
  };
  return 建议;
}

/** ≥2 条教育变体：追加第二段教育（页面可物化附加教育段的正向用例）。 */
export function 多条教育变体(): BFF简历预填建议 {
  const 建议 = 构造映射变体基底();
  建议.draft.educations.push({
    institution: {
      source_name: { value: 'Example Graduate School', confidence: 'medium' },
      resolution: 'unresolved',
      match: null,
    },
    degree: { value: '硕士', confidence: 'high' },
    major: {
      source_name: { value: 'Distributed Systems', confidence: 'medium' },
      resolution: 'unresolved',
      match: null,
    },
    start_month: { value: '2021-09', confidence: 'high' },
    end_month: { value: null, confidence: null },
  });
  return 建议;
}
