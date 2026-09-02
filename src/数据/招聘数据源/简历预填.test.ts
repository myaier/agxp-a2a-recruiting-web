// 简历预填域数据源测试：冻结 GET parse-result 的 path/query/不缓存/严格信封 形状，
// 并锁定 strict decode：每层 exact key set、schema_version 常量、闭合枚举
// （status/gender/resolution/confidence/warning reason）、scalar value/confidence 同空或同在、
// 非空月份必为真实日历月、年份必须整数、列表不许 null、exact 必有 match 而 unresolved
// 必 match:null、回显 source 过 ID grammar 且与请求三元组逐字相等；
// contact/evidence/provider 等任何多余键一律 invalid_response fail closed。
// 调用方 source 非法 grammar → 零 HTTP、status 0 invalid_request。
// wire fixture（简历预填成功信封）不可变：契约漂移用例一律深拷贝改写副本；
// 正向映射值用 fixture 文件里标注「前端映射变体」的本地构造器。

import { describe, expect, it, vi } from 'vitest';
import { 创建简历预填数据源 } from './简历预填';
import {
  简历预填成功信封,
  多条教育变体,
  性别已填变体,
  受支持学历变体,
  生日已填变体,
  目录精确命中变体,
} from './简历预填.fixture';
import type { BFF简历预填建议, BFF简历预填来源 } from '../BFF契约';

/** 结构漂移（增删键、置 null、换值类型）经 Record 视图改写深拷贝副本，不触碰不可变 wire fixture。 */
function 结构视图(值: object): Record<string, unknown> {
  return 值 as Record<string, unknown>;
}

/** 深拷贝 wire fixture 的 result 并改写出一个契约漂移样本（as const 的只读层经 unknown 剥离）。 */
function 契约变体(改写: (建议: BFF简历预填建议) => void): unknown {
  const 副本 = structuredClone(简历预填成功信封.result) as unknown as BFF简历预填建议;
  改写(副本);
  return 副本;
}

/** 每个响应拒绝都必须是 status=200 的 invalid_response。 */
async function 按契约漂移拒绝(result: unknown): Promise<void> {
  const 请求 = vi.fn().mockResolvedValue({ result, etag: null, requestId: 'req' });
  const source = 创建简历预填数据源(请求);
  await expect(source.读取简历预填(简历预填成功信封.result.source))
    .rejects.toMatchObject({ status: 200, code: 'invalid_response' });
}

describe('简历预填数据源', () => {
  it('成功信封按冻结路径与选项请求并逐字解码', async () => {
    const 请求 = vi.fn().mockResolvedValue({
      result: 简历预填成功信封.result,
      etag: null,
      requestId: 简历预填成功信封.meta.request_id,
    });
    const source = 创建简历预填数据源(请求);
    await expect(source.读取简历预填(简历预填成功信封.result.source))
      .resolves.toEqual(简历预填成功信封.result);
    expect(请求).toHaveBeenCalledWith({
      path: '/api/v1/me/resume-files/rf_0123456789abcdef0123456789abcdef/parse-result?version_id=rfv_0123456789abcdef0123456789abcdef&parse_id=rp_0123456789abcdef0123456789abcdef',
      不缓存: true,
      严格信封: true,
    });
  });

  // ── 前端映射变体（非后端公共 fixture）：正向 gender/生日/学历/目录/多条教育值
  //    必须与 wire fixture 走同一严格 decoder，且本身携带映射层需要的正向值。 ──

  it.each([
    ['性别已填变体', 性别已填变体],
    ['生日已填变体', 生日已填变体],
    ['受支持学历变体', 受支持学历变体],
    ['目录精确命中变体', 目录精确命中变体],
    ['多条教育变体', 多条教育变体],
  ])('前端映射变体通过同一严格 decoder：%s', async (_名称, 构造) => {
    const 建议 = 构造();
    const 请求 = vi.fn().mockResolvedValue({ result: 建议, etag: null, requestId: 'req' });
    await expect(创建简历预填数据源(请求).读取简历预填(建议.source)).resolves.toEqual(建议);
  });

  it('前端映射变体携带 wire fixture 缺失的正向映射值', () => {
    expect(性别已填变体().draft.profile.gender).toEqual({ value: 'female', confidence: 'low' });
    const 生日 = 生日已填变体().draft.profile;
    expect(生日.birth_year).toEqual({ value: 1998, confidence: 'medium' });
    expect(生日.birth_month).toEqual({ value: 6, confidence: 'medium' });
    const 学历 = 受支持学历变体();
    expect(学历.draft.profile.current_education.value).toBe('本科');
    expect(学历.draft.educations[0].degree.value).toBe('本科');
    const 目录 = 目录精确命中变体().draft.educations[0];
    expect(目录.institution).toMatchObject({ resolution: 'exact', match: { id: 'ins_bbbbbbbbbbbbbbbbbbbbbbbbbb' } });
    expect(目录.major).toMatchObject({ resolution: 'exact', match: { display_name: 'Computer Science' } });
    expect(多条教育变体().draft.educations).toHaveLength(2);
    // 变体从不写回不可变 wire fixture
    expect(简历预填成功信封.result.draft.profile.gender.value).toBe(null);
    expect(简历预填成功信封.result.draft.educations).toHaveLength(1);
  });

  // ── 多余键：每个对象层级 + contact/evidence/provider 禁键 ──

  it.each([
    ['result 多 provider 禁键', (建议: BFF简历预填建议) => { 结构视图(建议).provider = 'acme'; }],
    ['draft 多 contact 禁键', (建议: BFF简历预填建议) => { 结构视图(建议.draft).contact = { phone: '13800000000' }; }],
    ['experience 多 evidence 禁键', (建议: BFF简历预填建议) => { 结构视图(建议.draft.experiences[0]).evidence = []; }],
    ['catalog 多 provider 禁键', (建议: BFF简历预填建议) => { 结构视图(建议.draft.experiences[0].industry).provider = 'acme'; }],
    ['source 多 sha256 键', (建议: BFF简历预填建议) => { 结构视图(建议.source).sha256 = 'a'.repeat(64); }],
    ['profile 多 nickname 键', (建议: BFF简历预填建议) => { 结构视图(建议.draft.profile).nickname = 'Syn'; }],
    ['标量多 source_text 键', (建议: BFF简历预填建议) => { 结构视图(建议.draft.profile.real_name).source_text = 'Synthetic Candidate'; }],
    ['education 多 honors 键', (建议: BFF简历预填建议) => { 结构视图(建议.draft.educations[0]).honors = []; }],
    ['project 多 tech 键', (建议: BFF简历预填建议) => { 结构视图(建议.draft.experiences[0].projects[0]).tech = ['Go']; }],
    ['certificate 多 issuer 键', (建议: BFF简历预填建议) => { 结构视图(建议.draft.certificates[0]).issuer = 'Synthetic Cloud'; }],
    ['match 多 score 键', (建议: BFF简历预填建议) => {
      const 行业 = 建议.draft.experiences[0].industry;
      if (行业.resolution === 'exact') 结构视图(行业.match).score = 0.9;
    }],
    ['warning 多 source 键', (建议: BFF简历预填建议) => { 结构视图(建议.warnings[0]).source = 'pdf'; }],
  ])('多余键 fail closed：%s', async (_场景, 改写) => {
    await 按契约漂移拒绝(契约变体(改写));
  });

  // ── 缺键：每个对象层级 ──

  it.each([
    ['result 缺 schema_version', (建议: BFF简历预填建议) => { delete 结构视图(建议).schema_version; }],
    ['result 缺 source', (建议: BFF简历预填建议) => { delete 结构视图(建议).source; }],
    ['result 缺 draft', (建议: BFF简历预填建议) => { delete 结构视图(建议).draft; }],
    ['result 缺 warnings', (建议: BFF简历预填建议) => { delete 结构视图(建议).warnings; }],
    ['source 缺 parse_id', (建议: BFF简历预填建议) => { delete 结构视图(建议.source).parse_id; }],
    ['draft 缺 summary', (建议: BFF简历预填建议) => { delete 结构视图(建议.draft).summary; }],
    ['profile 缺 gender', (建议: BFF简历预填建议) => { delete 结构视图(建议.draft.profile).gender; }],
    ['标量缺 confidence', (建议: BFF简历预填建议) => { delete 结构视图(建议.draft.profile.real_name).confidence; }],
    ['experience 缺 projects', (建议: BFF简历预填建议) => { delete 结构视图(建议.draft.experiences[0]).projects; }],
    ['education 缺 degree', (建议: BFF简历预填建议) => { delete 结构视图(建议.draft.educations[0]).degree; }],
    ['certificate 缺 year', (建议: BFF简历预填建议) => { delete 结构视图(建议.draft.certificates[0]).year; }],
    ['catalog 缺 match', (建议: BFF简历预填建议) => { delete 结构视图(建议.draft.educations[0].institution).match; }],
    ['match 缺 display_name', (建议: BFF简历预填建议) => {
      const 行业 = 建议.draft.experiences[0].industry;
      if (行业.resolution === 'exact') delete 结构视图(行业.match).display_name;
    }],
    ['warning 缺 reason', (建议: BFF简历预填建议) => { delete 结构视图(建议.warnings[0]).reason; }],
  ])('缺键 fail closed：%s', async (_场景, 改写) => {
    await 按契约漂移拒绝(契约变体(改写));
  });

  // ── 列表不许 null：任何数组置 null 都拒绝，绝不归一成空数组 ──

  it.each([
    ['skills', (建议: BFF简历预填建议) => { 结构视图(建议.draft).skills = null; }],
    ['experiences', (建议: BFF简历预填建议) => { 结构视图(建议.draft).experiences = null; }],
    ['educations', (建议: BFF简历预填建议) => { 结构视图(建议.draft).educations = null; }],
    ['certificates', (建议: BFF简历预填建议) => { 结构视图(建议.draft).certificates = null; }],
    ['warnings', (建议: BFF简历预填建议) => { 结构视图(建议).warnings = null; }],
    ['projects', (建议: BFF简历预填建议) => { 结构视图(建议.draft.experiences[0]).projects = null; }],
  ])('列表为 null fail closed：%s', async (_字段, 改写) => {
    await 按契约漂移拒绝(契约变体(改写));
  });

  // ── 闭合枚举：status/gender/resolution/confidence/warning reason ──

  it.each([
    ['status 非闭集值', (建议: BFF简历预填建议) => { 结构视图(建议.draft.profile.status).value = 'retired'; }],
    ['gender 非闭集值', (建议: BFF简历预填建议) => { 结构视图(建议.draft.profile.gender).value = 'nonbinary'; }],
    ['resolution 非闭集值', (建议: BFF简历预填建议) => { 结构视图(建议.draft.experiences[0].industry).resolution = 'partial'; }],
    ['confidence 非闭集值', (建议: BFF简历预填建议) => { 结构视图(建议.draft.profile.real_name).confidence = 'certain'; }],
    ['warning reason 非闭集值', (建议: BFF简历预填建议) => { 结构视图(建议.warnings[0]).reason = 'mystery'; }],
    ['schema_version 非常量', (建议: BFF简历预填建议) => { 结构视图(建议).schema_version = 'resume-prefill.v2'; }],
  ])('未知枚举 fail closed：%s', async (_场景, 改写) => {
    await 按契约漂移拒绝(契约变体(改写));
  });

  // ── 回显 source：ID grammar 与请求三元组 ──

  it.each([
    ['file_id 语法非法', (建议: BFF简历预填建议) => { 建议.source.file_id = 'rf_short'; }],
    ['version_id 语法非法', (建议: BFF简历预填建议) => { 建议.source.version_id = 'RFV_0123456789ABCDEF0123456789ABCDEF'; }],
    ['parse_id 语法非法', (建议: BFF简历预填建议) => { 建议.source.parse_id = 'rp_0123456789abcdef0123456789abcdeg'; }],
    ['回显 source 与请求三元组不相等', (建议: BFF简历预填建议) => { 建议.source.version_id = 'rfv_ffffffffffffffffffffffffffffffff'; }],
  ])('回显 source 漂移 fail closed：%s', async (_场景, 改写) => {
    await 按契约漂移拒绝(契约变体(改写));
  });

  // ── 标量值规则：整数年份、YYYY-MM 月份、value/confidence 同空或同在、值类型 ──

  it.each([
    ['work_start_year 非整数', (建议: BFF简历预填建议) => { 结构视图(建议.draft.profile.work_start_year).value = 2021.5; }],
    ['graduation_year 字符串', (建议: BFF简历预填建议) => { 结构视图(建议.draft.profile.graduation_year).value = '2021'; }],
    ['certificate year 非整数', (建议: BFF简历预填建议) => { 结构视图(建议.draft.certificates[0].year).value = 2020.5; }],
    ['experience start_month 缺零填充', (建议: BFF简历预填建议) => { 结构视图(建议.draft.experiences[0].start_month).value = '2021-7'; }],
    ['education end_month 越界月份', (建议: BFF简历预填建议) => { 结构视图(建议.draft.educations[0].end_month).value = '2021-13'; }],
    ['education start_month 非日历月', (建议: BFF简历预填建议) => { 结构视图(建议.draft.educations[0].start_month).value = 'Sept 2016'; }],
    ['summary 有值但 confidence 为 null', (建议: BFF简历预填建议) => { 结构视图(建议.draft.summary).confidence = null; }],
    ['skills[0] value 为 null 但 confidence 在', (建议: BFF简历预填建议) => { 结构视图(建议.draft.skills[0]).value = null; }],
    ['real_name value 非字符串', (建议: BFF简历预填建议) => { 结构视图(建议.draft.profile.real_name).value = 42; }],
    ['internship value 非布尔', (建议: BFF简历预填建议) => { 结构视图(建议.draft.experiences[0].internship).value = 'false'; }],
  ])('标量值漂移 fail closed：%s', async (_场景, 改写) => {
    await 按契约漂移拒绝(契约变体(改写));
  });

  // ── CatalogSuggestion 联合不变式 ──

  it.each([
    ['exact 但 match 为 null', (建议: BFF简历预填建议) => {
      结构视图(建议.draft.experiences[0].industry).match = null;
    }],
    ['unresolved 但 match 非 null', (建议: BFF简历预填建议) => {
      结构视图(建议.draft.educations[0].institution).match = {
        id: 'ins_bbbbbbbbbbbbbbbbbbbbbbbbbb', display_name: 'Example University',
      };
    }],
  ])('catalog 不变式破坏 fail closed：%s', async (_场景, 改写) => {
    await 按契约漂移拒绝(契约变体(改写));
  });

  // ── 调用方入参：非法 ID grammar 零 HTTP，按既有 preflight 约定 invalid_request ──

  it.each([
    ['file_id', { file_id: 'rf_short', version_id: 简历预填成功信封.result.source.version_id, parse_id: 简历预填成功信封.result.source.parse_id }],
    ['version_id', { file_id: 简历预填成功信封.result.source.file_id, version_id: 'rfv_', parse_id: 简历预填成功信封.result.source.parse_id }],
    ['parse_id', { file_id: 简历预填成功信封.result.source.file_id, version_id: 简历预填成功信封.result.source.version_id, parse_id: 'rp_0123456789ABCDEF0123456789ABCDEF' }],
  ])('调用方 source %s 非法：零请求且 status 0 invalid_request', async (_字段, source) => {
    const 请求 = vi.fn();
    const 预填源 = 创建简历预填数据源(请求);
    await expect(预填源.读取简历预填(source as BFF简历预填来源))
      .rejects.toMatchObject({ status: 0, code: 'invalid_request' });
    expect(请求).not.toHaveBeenCalled();
  });
});
