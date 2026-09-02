// 简历预填域数据源：BFF /api/v1/me/resume-files/{file_id}/parse-result 的 onboarding 只读建议。
// 第十四个域 facade：resume-prefill.v1 冻结合同（agxp-monorepo@f2d7af565 的 ResumePrefill 家族）。
// GET 显式 no-store（不缓存）+ 严格信封；调用方 source 三个 ID 先过 grammar 预检，
// 非法即零 HTTP 按 invalid_request 拒绝（服务端 400 invalid_request_body 只能来自真实后端）。
// 每个响应 strict decode：每层 exact key set、schema_version 常量、闭合枚举
// （status/gender/resolution/confidence/warning reason）、scalar value/confidence 同空或同在、
// 非空月份必为真实日历月 YYYY-MM、年份必须整数、列表不许 null、exact 必有 match 而
// unresolved 必 match:null、回显 source 过 ID grammar 且与请求三元组逐字相等；
// contact/evidence/provider 等任何多余键一律 invalid_response fail closed。
// 年份/月份只按 OpenAPI 解成整数/string（控件范围判断留给页面映射，不在本层发明）。
// 接口失败绝不回退 Mock。本模块不 import React 或模拟数据。

import { BFF错误 } from '../HTTP客户端';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type {
  BFF简历预填Warning原因,
  BFF简历预填置信度,
  BFF简历预填建议,
  BFF简历预填来源,
  BFF简历预填标量,
  BFF简历预填目录建议,
  BFF简历预填证书,
  BFF简历预填经历,
  BFF简历预填教育,
  BFF简历预填项目,
} from '../BFF契约';

// ── 本域小 guard：闭合纪律与 附件简历.ts 同一基调；本域统一 status=200 的 invalid_response ──

function 契约错误(): BFF错误 {
  return new BFF错误(200, 'invalid_response', '简历预填响应不符合 resume-prefill.v1 契约');
}

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === 'object' && 值 !== null && !Array.isArray(值);
}

/** exact key set：Object.keys 排序后与必需键排序完全相等，缺键或多出未知键都按契约漂移 fail closed。 */
function 要求闭合对象(input: unknown, 必需键: readonly string[]): Record<string, unknown> {
  if (!是记录(input)) throw 契约错误();
  const 实际键 = Object.keys(input).sort();
  const 期望键 = [...必需键].sort();
  if (实际键.length !== 期望键.length) throw 契约错误();
  for (let i = 0; i < 实际键.length; i += 1) {
    if (实际键[i] !== 期望键[i]) throw 契约错误();
  }
  return input;
}

/** 标量 value / match.id / display_name / field_path：OpenAPI 只冻结 string（无 minLength），不发明非空约束。 */
function 要求字符串(值: unknown): string {
  if (typeof 值 !== 'string') throw 契约错误();
  return 值;
}

function 要求数组(值: unknown): unknown[] {
  if (!Array.isArray(值)) throw 契约错误();
  return 值;
}

function 要求布尔(值: unknown): boolean {
  if (typeof 值 !== 'boolean') throw 契约错误();
  return 值;
}

/** 年份类整数：OpenAPI 只冻结 integer（无 minimum），控件范围由页面映射另行判断。 */
function 要求整数(值: unknown): number {
  if (typeof 值 !== 'number' || !Number.isInteger(值)) throw 契约错误();
  return 值;
}

function 要求枚举<T extends string>(值: unknown, 取值: readonly T[]): T {
  if (typeof 值 !== 'string') throw 契约错误();
  for (const 候选 of 取值) if (候选 === 值) return 候选;
  throw 契约错误();
}

// ── 闭合 vocabulary 与冻结 grammar ──

const 置信度全表 = ['high', 'medium', 'low'] as const satisfies readonly BFF简历预填置信度[];
const 状态全表 = ['student', 'employed', 'unemployed'] as const;
const 性别全表 = ['male', 'female'] as const;
const 解析度全表 = ['exact', 'unresolved'] as const;
const 警告原因全表 = [
  'missing_required', 'unsafe_month', 'catalog_unresolved',
  'target_limit_exceeded', 'enum_undetermined', 'conflicting_sources',
] as const satisfies readonly BFF简历预填Warning原因[];

/** 发布的 ID grammar（OpenAPI pattern）：rf_/rfv_/rp_ 前缀 + 32 位小写十六进制。 */
const 文件ID模式 = /^rf_[0-9a-f]{32}$/;
const 版本ID模式 = /^rfv_[0-9a-f]{32}$/;
const 解析ID模式 = /^rp_[0-9a-f]{32}$/;

/** 月份闭集：后端 resumeparse.normalizeMonth 保证非空月份必为真实日历月（YYYY-MM、01..12），
 *  形状不符即契约漂移；控件范围（如教育 2000..2030）由页面映射另行判断，不在本层发明。 */
const 年月模式 = /^\d{4}-(0[1-9]|1[0-2])$/;

// ── 具体 decoder：逐字段过 guard，不做 `as` 直转 ──

/** scalar {value, confidence}：二者必须同空或同在；非空 confidence 只认三档闭集。 */
function 解标量<T>(input: unknown, 取值: (raw: unknown) => T): BFF简历预填标量<T> {
  const raw = 要求闭合对象(input, ['value', 'confidence']);
  if (raw.confidence === null) {
    if (raw.value !== null) throw 契约错误();
    return { value: null, confidence: null };
  }
  const confidence = 要求枚举(raw.confidence, 置信度全表);
  if (raw.value === null) throw 契约错误();
  return { value: 取值(raw.value), confidence };
}

function 要求年月(值: unknown): string {
  const 字符串 = 要求字符串(值);
  if (!年月模式.test(字符串)) throw 契约错误();
  return 字符串;
}

/** CatalogSuggestion：exact 必有 closed match 对象，unresolved 必须 match:null。 */
function 解目录建议(input: unknown): BFF简历预填目录建议 {
  const raw = 要求闭合对象(input, ['source_name', 'resolution', 'match']);
  const source_name = 解标量(raw.source_name, 要求字符串);
  if (要求枚举(raw.resolution, 解析度全表) === 'exact') {
    if (raw.match === null) throw 契约错误();
    const match = 要求闭合对象(raw.match, ['id', 'display_name']);
    return {
      source_name,
      resolution: 'exact',
      match: { id: 要求字符串(match.id), display_name: 要求字符串(match.display_name) },
    };
  }
  if (raw.match !== null) throw 契约错误();
  return { source_name, resolution: 'unresolved', match: null };
}

const 项目键 = ['name', 'role', 'result'] as const;

function 解项目(input: unknown): BFF简历预填项目 {
  const raw = 要求闭合对象(input, 项目键);
  return {
    name: 解标量(raw.name, 要求字符串),
    role: 解标量(raw.role, 要求字符串),
    result: 解标量(raw.result, 要求字符串),
  };
}

const 经历键 = [
  'company', 'industry', 'title', 'start_month', 'end_month', 'description', 'internship', 'projects',
] as const;

function 解经历(input: unknown): BFF简历预填经历 {
  const raw = 要求闭合对象(input, 经历键);
  return {
    company: 解标量(raw.company, 要求字符串),
    industry: 解目录建议(raw.industry),
    title: 解标量(raw.title, 要求字符串),
    start_month: 解标量(raw.start_month, 要求年月),
    end_month: 解标量(raw.end_month, 要求年月),
    description: 解标量(raw.description, 要求字符串),
    internship: 解标量(raw.internship, 要求布尔),
    projects: 要求数组(raw.projects).map(解项目),
  };
}

const 教育键 = ['institution', 'degree', 'major', 'start_month', 'end_month'] as const;

function 解教育(input: unknown): BFF简历预填教育 {
  const raw = 要求闭合对象(input, 教育键);
  return {
    institution: 解目录建议(raw.institution),
    degree: 解标量(raw.degree, 要求字符串),
    major: 解目录建议(raw.major),
    start_month: 解标量(raw.start_month, 要求年月),
    end_month: 解标量(raw.end_month, 要求年月),
  };
}

const 证书键 = ['name', 'year'] as const;

function 解证书(input: unknown): BFF简历预填证书 {
  const raw = 要求闭合对象(input, 证书键);
  return {
    name: 解标量(raw.name, 要求字符串),
    year: 解标量(raw.year, 要求整数),
  };
}

const 资料键 = [
  'real_name', 'work_start_year', 'status', 'current_education',
  'graduation_year', 'gender', 'birth_year', 'birth_month',
] as const;

function 解资料(input: unknown): BFF简历预填建议['draft']['profile'] {
  const raw = 要求闭合对象(input, 资料键);
  return {
    real_name: 解标量(raw.real_name, 要求字符串),
    work_start_year: 解标量(raw.work_start_year, 要求整数),
    status: 解标量(raw.status, (值) => 要求枚举(值, 状态全表)),
    current_education: 解标量(raw.current_education, 要求字符串),
    graduation_year: 解标量(raw.graduation_year, 要求整数),
    gender: 解标量(raw.gender, (值) => 要求枚举(值, 性别全表)),
    birth_year: 解标量(raw.birth_year, 要求整数),
    birth_month: 解标量(raw.birth_month, 要求整数),
  };
}

const 警告键 = ['field_path', 'reason'] as const;

function 解警告(input: unknown): BFF简历预填建议['warnings'][number] {
  const raw = 要求闭合对象(input, 警告键);
  return { field_path: 要求字符串(raw.field_path), reason: 要求枚举(raw.reason, 警告原因全表) };
}

/** 回显 source：三个坐标都过发布 grammar；与请求三元组的相等比较留在读取方法里。 */
function 解来源(input: unknown): BFF简历预填来源 {
  const raw = 要求闭合对象(input, ['file_id', 'version_id', 'parse_id']);
  const file_id = 要求字符串(raw.file_id);
  const version_id = 要求字符串(raw.version_id);
  const parse_id = 要求字符串(raw.parse_id);
  if (!文件ID模式.test(file_id) || !版本ID模式.test(version_id) || !解析ID模式.test(parse_id)) {
    throw 契约错误();
  }
  return { file_id, version_id, parse_id };
}

const 草稿键 = ['profile', 'summary', 'skills', 'experiences', 'educations', 'certificates'] as const;

function 解建议(input: unknown): BFF简历预填建议 {
  const raw = 要求闭合对象(input, ['schema_version', 'source', 'draft', 'warnings']);
  if (raw.schema_version !== 'resume-prefill.v1') throw 契约错误();
  const draft = 要求闭合对象(raw.draft, 草稿键);
  return {
    schema_version: 'resume-prefill.v1',
    source: 解来源(raw.source),
    draft: {
      profile: 解资料(draft.profile),
      summary: 解标量(draft.summary, 要求字符串),
      skills: 要求数组(draft.skills).map((项) => 解标量(项, 要求字符串)),
      experiences: 要求数组(draft.experiences).map(解经历),
      educations: 要求数组(draft.educations).map(解教育),
      certificates: 要求数组(draft.certificates).map(解证书),
    },
    warnings: 要求数组(raw.warnings).map(解警告),
  };
}

// ── 调用方入参校验：非法 grammar 在任何请求前按 invalid_request 拒绝 ──

function 校验坐标(值: string, 模式: RegExp, 名称: string, 描述: string): string {
  if (typeof 值 !== 'string' || !模式.test(值)) {
    throw new BFF错误(0, 'invalid_request', `简历预填来源 ${名称} 需为 ${描述}`);
  }
  return 值;
}

// ── 数据源 ──

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

export interface 简历预填数据源 {
  读取简历预填(source: BFF简历预填来源): Promise<BFF简历预填建议>;
}

export function 创建简历预填数据源(请求: 请求函数): 简历预填数据源 {
  return {
    async 读取简历预填(source) {
      const fileId = 校验坐标(source.file_id, 文件ID模式, 'file_id', 'rf_ 加 32 位小写十六进制');
      const versionId = 校验坐标(source.version_id, 版本ID模式, 'version_id', 'rfv_ 加 32 位小写十六进制');
      const parseId = 校验坐标(source.parse_id, 解析ID模式, 'parse_id', 'rp_ 加 32 位小写十六进制');
      const { result } = await 请求<unknown>({
        path: (`/api/v1/me/resume-files/${encodeURIComponent(fileId)}/parse-result` +
          `?version_id=${encodeURIComponent(versionId)}&parse_id=${encodeURIComponent(parseId)}`) as `/api/v1/${string}`,
        不缓存: true,
        严格信封: true,
      });
      const 建议 = 解建议(result);
      // 回显 source 必须与请求三元组逐字相等：后端已验证 owner/current ready version/exact parse，
      // 前端再对一次，防止 relay/合同漂移被当成当前建议。
      if (建议.source.file_id !== fileId || 建议.source.version_id !== versionId || 建议.source.parse_id !== parseId) {
        throw 契约错误();
      }
      return 建议;
    },
  };
}
