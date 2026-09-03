// JD 导入域数据源测试：冻结 POST /recruiter/job-draft-imports 的 multipart 两 part、
// 调用方幂等键、严格信封与空 MIME 规范化；GET 只读同一合法 jdi_ ID、显式 no-store。
// strict decode：四个合法状态、状态矛盾（pending/processing/failed 带 suggestion、
// 非 failed 带 failure_code）、每层 exact key set、import_id grammar、RFC3339 时间、
// 闭合枚举（status/failure code/四个建议枚举）、可空字段 omitted、非可空字段 null、
// keywords 非字符串成员、建议缺键一律 invalid_response fail closed。
// 调用方 importId 非法 → 零 HTTP、status 0 invalid_request。

import { describe, expect, it, vi } from 'vitest';
import { 创建JD导入数据源 } from './JD导入';
import type { BFFJD导入, BFFJD导入失败码 } from '../BFF契约';

const 完整建议 = {
  title: 'Senior Backend Engineer',
  recruitment_type: 'social_full_time',
  workplace_mode: 'hybrid',
  office_location: '上海市浦东新区世纪大道 1568 号',
  description: '负责核心招聘服务。',
  requirements: '五年以上后端经验。',
  education_requirement: 'bachelor',
  experience_requirement: 'five_plus_years',
  category_source_name: '后端开发',
  location_source_name: '上海',
  keywords: ['Go', 'PostgreSQL'],
} as const;

const succeeded = {
  import_id: 'jdi_0123456789abcdef0123456789abcdef',
  status: 'succeeded',
  created_at: '2026-09-03T01:02:03Z',
  updated_at: '2026-09-03T01:02:06Z',
  suggestion: 完整建议,
} as const;

const 合法ID = succeeded.import_id;
const key = 'jd-import-01234567-89ab-cdef-0123-456789abcdef';
const PDF文件 = () => new File(['%PDF-1.7'], 'role.pdf', { type: 'application/pdf' });

/** 结构漂移（增删键、置 null、换值类型）经 Record 视图改写深拷贝副本，不触碰 as const 样本。 */
function 结构视图(值: object): Record<string, unknown> {
  return 值 as Record<string, unknown>;
}

/** 深拷贝 succeeded 样本并改写出一个契约漂移结果（as const 的只读层经 unknown 剥离）。 */
function 契约变体(改写: (导入: BFFJD导入) => void): unknown {
  const 副本 = structuredClone(succeeded) as unknown as BFFJD导入;
  改写(副本);
  return 副本;
}

/** 每个响应拒绝都必须是 status=200 的 invalid_response。 */
async function 按契约漂移拒绝(result: unknown): Promise<void> {
  const 请求 = vi.fn().mockResolvedValue({ result, etag: null, requestId: 'req' });
  const source = 创建JD导入数据源(请求);
  await expect(source.创建JD导入(PDF文件(), key))
    .rejects.toMatchObject({ status: 200, code: 'invalid_response' });
}

describe('JD 导入数据源', () => {
  it('POST 恰发送两个 multipart part、稳定幂等键并严格解码', async () => {
    const 请求 = vi.fn().mockResolvedValue({ result: succeeded, etag: null, requestId: 'req-1' });
    const source = 创建JD导入数据源(请求);
    const file = new File(['%PDF-1.7'], 'role.pdf', { type: '' });

    await expect(source.创建JD导入(file, key)).resolves.toEqual(succeeded);

    const options = 请求.mock.calls[0][0];
    expect(options).toMatchObject({
      path: '/api/v1/recruiter/job-draft-imports',
      method: 'POST',
      幂等: true,
      幂等键: key,
      严格信封: true,
    });
    expect(options.headers).toBeUndefined();
    expect([...options.formData.keys()]).toEqual(['file', 'processing_consent_confirmed']);
    expect(options.formData.get('processing_consent_confirmed')).toBe('true');
    const uploaded = options.formData.get('file');
    expect(uploaded).toBeInstanceOf(File);
    expect((uploaded as File).name).toBe('role.pdf');
    expect((uploaded as File).type).toBe('application/pdf');
    expect((uploaded as File).lastModified).toBe(file.lastModified);
  });

  it('GET 只读同一合法 import ID 且禁用缓存', async () => {
    const 请求 = vi.fn().mockResolvedValue({ result: succeeded, etag: null, requestId: 'req-2' });
    await 创建JD导入数据源(请求).读取JD导入(succeeded.import_id);
    expect(请求).toHaveBeenCalledWith({
      path: `/api/v1/recruiter/job-draft-imports/${succeeded.import_id}`,
      不缓存: true,
      严格信封: true,
    });
  });

  it('非法 import ID 在 fetch 前失败', async () => {
    const 请求 = vi.fn();
    await expect(创建JD导入数据源(请求).读取JD导入('../jobs'))
      .rejects.toMatchObject({ status: 0, code: 'invalid_request' });
    expect(请求).not.toHaveBeenCalled();
  });

  // ── 四个合法状态逐个解码；failed 覆盖全部失败码闭集 ──

  it.each([
    ['pending', { import_id: 合法ID, status: 'pending', created_at: '2026-09-03T01:02:03Z', updated_at: '2026-09-03T01:02:03Z' }],
    ['processing', { import_id: 合法ID, status: 'processing', created_at: '2026-09-03T01:02:03Z', updated_at: '2026-09-03T01:02:04Z' }],
  ])('%s 状态合法解码', async (_名称, 结果) => {
    const 请求 = vi.fn().mockResolvedValue({ result: 结果, etag: null, requestId: 'req' });
    await expect(创建JD导入数据源(请求).创建JD导入(PDF文件(), key)).resolves.toEqual(结果);
  });

  it.each([
    'invalid_pdf', 'document_too_complex', 'parser_invalid_output', 'parser_temporarily_unavailable',
  ] as const satisfies readonly BFFJD导入失败码[])('failed 失败码 %s 合法解码', async (failure_code) => {
    const 结果 = {
      import_id: 合法ID, status: 'failed',
      created_at: '2026-09-03T01:02:03Z', updated_at: '2026-09-03T01:02:05Z', failure_code,
    };
    const 请求 = vi.fn().mockResolvedValue({ result: 结果, etag: null, requestId: 'req' });
    await expect(创建JD导入数据源(请求).创建JD导入(PDF文件(), key)).resolves.toEqual(结果);
  });

  // ── 状态矛盾：optional 字段必须真正 omitted，suggestion/failure_code 不得串位 ──

  it.each([
    ['pending 带 suggestion', (导入: BFFJD导入) => { 结构视图(导入).status = 'pending'; }],
    ['processing 带 suggestion', (导入: BFFJD导入) => { 结构视图(导入).status = 'processing'; }],
    ['pending 带 failure_code', (导入: BFFJD导入) => { 结构视图(导入).status = 'pending'; delete 结构视图(导入).suggestion; 结构视图(导入).failure_code = 'invalid_pdf'; }],
    ['processing 带 failure_code', (导入: BFFJD导入) => { 结构视图(导入).status = 'processing'; delete 结构视图(导入).suggestion; 结构视图(导入).failure_code = 'invalid_pdf'; }],
    ['succeeded 带 failure_code', (导入: BFFJD导入) => { 结构视图(导入).failure_code = 'invalid_pdf'; }],
    ['failed 带 suggestion', (导入: BFFJD导入) => {
      结构视图(导入).status = 'failed';
      结构视图(导入).suggestion = { ...完整建议 };
      delete 结构视图(导入).failure_code;
    }],
  ])('状态矛盾 fail closed：%s', async (_场景, 改写) => {
    await 按契约漂移拒绝(契约变体(改写));
  });

  // ── 每层缺键：根对象四个基础键 + succeeded 缺 suggestion + failed 缺 failure_code + 建议十一个键 ──

  it.each([
    ['根缺 import_id', (导入: BFFJD导入) => { delete 结构视图(导入).import_id; }],
    ['根缺 status', (导入: BFFJD导入) => { delete 结构视图(导入).status; }],
    ['根缺 created_at', (导入: BFFJD导入) => { delete 结构视图(导入).created_at; }],
    ['根缺 updated_at', (导入: BFFJD导入) => { delete 结构视图(导入).updated_at; }],
    ['succeeded 缺 suggestion', (导入: BFFJD导入) => { delete 结构视图(导入).suggestion; }],
    ['failed 缺 failure_code', (导入: BFFJD导入) => { 结构视图(导入).status = 'failed'; delete 结构视图(导入).suggestion; }],
    ['建议缺 title', (导入: BFFJD导入) => { if (导入.status === 'succeeded') delete 结构视图(导入.suggestion).title; }],
    ['建议缺 recruitment_type', (导入: BFFJD导入) => { if (导入.status === 'succeeded') delete 结构视图(导入.suggestion).recruitment_type; }],
    ['建议缺 workplace_mode', (导入: BFFJD导入) => { if (导入.status === 'succeeded') delete 结构视图(导入.suggestion).workplace_mode; }],
    ['建议缺 office_location', (导入: BFFJD导入) => { if (导入.status === 'succeeded') delete 结构视图(导入.suggestion).office_location; }],
    ['建议缺 description', (导入: BFFJD导入) => { if (导入.status === 'succeeded') delete 结构视图(导入.suggestion).description; }],
    ['建议缺 requirements', (导入: BFFJD导入) => { if (导入.status === 'succeeded') delete 结构视图(导入.suggestion).requirements; }],
    ['建议缺 education_requirement', (导入: BFFJD导入) => { if (导入.status === 'succeeded') delete 结构视图(导入.suggestion).education_requirement; }],
    ['建议缺 experience_requirement', (导入: BFFJD导入) => { if (导入.status === 'succeeded') delete 结构视图(导入.suggestion).experience_requirement; }],
    ['建议缺 category_source_name', (导入: BFFJD导入) => { if (导入.status === 'succeeded') delete 结构视图(导入.suggestion).category_source_name; }],
    ['建议缺 location_source_name', (导入: BFFJD导入) => { if (导入.status === 'succeeded') delete 结构视图(导入.suggestion).location_source_name; }],
    ['建议缺 keywords', (导入: BFFJD导入) => { if (导入.status === 'succeeded') delete 结构视图(导入.suggestion).keywords; }],
  ])('缺键 fail closed：%s', async (_场景, 改写) => {
    await 按契约漂移拒绝(契约变体(改写));
  });

  // ── 多余键：根对象与建议对象各一层 ──

  it.each([
    ['根多 provider 键', (导入: BFFJD导入) => { 结构视图(导入).provider = 'acme'; }],
    ['建议多 confidence 键', (导入: BFFJD导入) => { if (导入.status === 'succeeded') 结构视图(导入.suggestion).confidence = 0.9; }],
  ])('多余键 fail closed：%s', async (_场景, 改写) => {
    await 按契约漂移拒绝(契约变体(改写));
  });

  // ── import_id grammar 与 RFC3339 时间 ──

  it.each([
    ['import_id 大写', (导入: BFFJD导入) => { 结构视图(导入).import_id = 'JDI_0123456789ABCDEF0123456789ABCDEF'; }],
    ['import_id 过短', (导入: BFFJD导入) => { 结构视图(导入).import_id = 'jdi_short'; }],
    ['created_at 空格分隔', (导入: BFFJD导入) => { 结构视图(导入).created_at = '2026-09-03 01:02:03Z'; }],
    ['updated_at 非时间文本', (导入: BFFJD导入) => { 结构视图(导入).updated_at = 'yesterday'; }],
    ['时间形状合法但日历非法', (导入: BFFJD导入) => { 结构视图(导入).updated_at = '2026-13-45T99:99:99Z'; }],
  ])('ID/时间漂移 fail closed：%s', async (_场景, 改写) => {
    await 按契约漂移拒绝(契约变体(改写));
  });

  // ── 闭合枚举：status、failure_code 与四个建议枚举 ──

  it.each([
    ['status 非闭集值', (导入: BFFJD导入) => { 结构视图(导入).status = 'completed'; }],
    ['failure_code 非闭集值', (导入: BFFJD导入) => {
      结构视图(导入).status = 'failed';
      delete 结构视图(导入).suggestion;
      结构视图(导入).failure_code = 'mystery';
    }],
    ['recruitment_type 非闭集值', (导入: BFFJD导入) => { if (导入.status === 'succeeded') 结构视图(导入.suggestion).recruitment_type = 'contractor'; }],
    ['workplace_mode 非闭集值', (导入: BFFJD导入) => { if (导入.status === 'succeeded') 结构视图(导入.suggestion).workplace_mode = 'flexible'; }],
    ['education_requirement 非闭集值', (导入: BFFJD导入) => { if (导入.status === 'succeeded') 结构视图(导入.suggestion).education_requirement = 'diploma'; }],
    ['experience_requirement 非闭集值', (导入: BFFJD导入) => { if (导入.status === 'succeeded') 结构视图(导入.suggestion).experience_requirement = 'mid_level'; }],
  ])('未知枚举 fail closed：%s', async (_场景, 改写) => {
    await 按契约漂移拒绝(契约变体(改写));
  });

  // ── 非可空字段 null / 可空字段非字符串 / keywords 成员 / suggestion 本体 ──

  it.each([
    ['status 为 null', (导入: BFFJD导入) => { 结构视图(导入).status = null; }],
    ['import_id 为 null', (导入: BFFJD导入) => { 结构视图(导入).import_id = null; }],
    ['suggestion 为 null', (导入: BFFJD导入) => { 结构视图(导入).suggestion = null; }],
    ['keywords 为 null', (导入: BFFJD导入) => { if (导入.status === 'succeeded') 结构视图(导入.suggestion).keywords = null; }],
    ['keywords 含非字符串', (导入: BFFJD导入) => { if (导入.status === 'succeeded') 结构视图(导入.suggestion).keywords = ['Go', 42]; }],
    ['title 为数字', (导入: BFFJD导入) => { if (导入.status === 'succeeded') 结构视图(导入.suggestion).title = 42; }],
    ['failure_code 为 null', (导入: BFFJD导入) => {
      结构视图(导入).status = 'failed';
      delete 结构视图(导入).suggestion;
      结构视图(导入).failure_code = null;
    }],
  ])('值类型漂移 fail closed：%s', async (_场景, 改写) => {
    await 按契约漂移拒绝(契约变体(改写));
  });
});
