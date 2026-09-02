// 候选 onboarding 简历预填恢复元数据的账号范围存储。
//
// 只存「刷新后恢复一轮未完成预填」所需且仅需的控制面五元组：
// {mode, source 三元组, eligibility 布尔快照, confirmed 分区, generation}；
// 绝不落 suggestion 载荷、draft、candidate 文本、warning 展示文本或错误 message ——
// resume-prefill.v1 响应是敏感履历且 no-store，合法响应上限也远大于浏览器配额，
// 刷新后由 exact tuple 重新读取（Task 3 的恢复边界）。
// 物理键复用 账号存储键('候选预填恢复v1', 范围)（候选预填分类 + 模式 + 环境 + 账号 四重隔离），
// 只做按键精确读写：不枚举存储、不维护跨账号索引。candidate 角色的强制在 Provider
// 创建绑定适配器之前完成（Task 3 接线），本模块只按传入范围绑定。
// 反序列化严格按恰好闭合键集校验（root 五键、source 三键、eligibility 六键 + profile 五键、
// confirmed 七分区、ID grammar、非负整数 generation），任何损坏 JSON、多余字段（可能是
// 敏感数据）或坏类型的旧值都会被丢弃并删除。无存储或存储抛异常一律 fail closed：
// 读 null、写 false、删 no-op，绝不把存储故障抛进页面。

import { 账号存储键 } from './资料缓存';
import type { 资料缓存范围 } from './资料缓存';
import type {
  候选预填恢复元数据,
  候选预填分区,
  候选预填恢复存储,
  候选预填Eligibility,
} from '../状态/后端/类型';

const 键分类 = '候选预填恢复v1';

// 与 wire 契约同口径（招聘数据源/简历预填.ts）：rf_/rfv_/rp_ + 32 位小写十六进制。
const 文件ID模式 = /^rf_[0-9a-f]{32}$/;
const 版本ID模式 = /^rfv_[0-9a-f]{32}$/;
const 解析ID模式 = /^rp_[0-9a-f]{32}$/;

const 分区全表: readonly 候选预填分区[] = [
  'basic', 'degree', 'institution', 'major', 'education_period', 'work', 'summary',
];

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === 'object' && 值 !== null && !Array.isArray(值);
}

/** 恰好闭合键集：缺键或多出未知键（可能是敏感数据）都整笔拒绝。 */
function 键集恰好(值: Record<string, unknown>, 期望键: readonly string[]): boolean {
  const 实际 = Object.keys(值).sort();
  const 期望 = [...期望键].sort();
  if (实际.length !== 期望.length) return false;
  for (let 序 = 0; 序 < 实际.length; 序 += 1) {
    if (实际[序] !== 期望[序]) return false;
  }
  return true;
}

function 是布尔(值: unknown): 值 is boolean {
  return typeof 值 === 'boolean';
}

/** 非负整数的 generation 栅栏计数。 */
function 是世代(值: unknown): 值 is number {
  return typeof 值 === 'number' && Number.isInteger(值) && 值 >= 0;
}

function 是有效来源(值: unknown): 值 is 候选预填恢复元数据['source'] {
  if (!是记录(值) || !键集恰好(值, ['file_id', 'version_id', 'parse_id'])) return false;
  if (typeof 值.file_id !== 'string' || !文件ID模式.test(值.file_id)) return false;
  if (typeof 值.version_id !== 'string' || !版本ID模式.test(值.version_id)) return false;
  if (值.parse_id !== null
    && (typeof 值.parse_id !== 'string' || !解析ID模式.test(值.parse_id))) return false;
  return true;
}

function 是有效Eligibility(值: unknown): 值 is 候选预填Eligibility {
  if (!是记录(值) || !键集恰好(值, ['profile', 'summary', 'skills', 'experiences', 'educations', 'certificates'])) {
    return false;
  }
  if (!是记录(值.profile)
    || !键集恰好(值.profile, ['real_name', 'work_start_year', 'gender', 'birth_year', 'birth_month'])) {
    return false;
  }
  const 档 = 值.profile as Record<string, unknown>;
  for (const 键 of ['real_name', 'work_start_year', 'gender', 'birth_year', 'birth_month'] as const) {
    if (!是布尔(档[键])) return false;
  }
  return 是布尔(值.summary) && 是布尔(值.skills) && 是布尔(值.experiences)
    && 是布尔(值.educations) && 是布尔(值.certificates);
}

function 是有效确认(值: unknown): 值 is Record<候选预填分区, boolean> {
  if (!是记录(值) || !键集恰好(值, 分区全表)) return false;
  return 分区全表.every((分区) => 是布尔(值[分区]));
}

/** 恰好五键、mode/source/eligibility/confirmed/generation 全部合形的元数据。 */
function 是有效元数据(值: unknown): 值 is 候选预填恢复元数据 {
  if (!是记录(值) || !键集恰好(值, ['mode', 'source', 'eligibility', 'confirmed', 'generation'])) return false;
  if (值.mode !== 'auto' && 值.mode !== 'manual') return false;
  if (!是有效来源(值.source)) return false;
  if (!是有效Eligibility(值.eligibility)) return false;
  if (!是有效确认(值.confirmed)) return false;
  return 是世代(值.generation);
}

export function 创建候选预填恢复存储(input: {
  storage: Storage | null;
  范围: 资料缓存范围;
}): 候选预填恢复存储 {
  const { storage, 范围 } = input;
  const 键 = 账号存储键(键分类, 范围);

  function 丢弃(): void {
    try {
      storage?.removeItem(键);
    } catch {
      // 删除失败也只能保持 fail closed，不把存储故障抛进页面。
    }
  }

  return {
    读取(): 候选预填恢复元数据 | null {
      if (!storage) return null;
      let 原文: string | null;
      try {
        原文 = storage.getItem(键);
      } catch {
        // 读不出来就当没有，但不删除：还没看到值，不能凭空清掉别人的数据。
        return null;
      }
      if (原文 === null) return null;
      let 值: unknown;
      try {
        值 = JSON.parse(原文);
      } catch {
        丢弃();
        return null;
      }
      if (!是有效元数据(值)) {
        丢弃();
        return null;
      }
      return 值;
    },
    写入(metadata: 候选预填恢复元数据): boolean {
      // 入参也按同一套守卫：带多余字段（可能是敏感数据）或坏坐标的元数据整笔拒绝。
      if (!storage || !是有效元数据(metadata)) return false;
      try {
        // 构造全新白名单对象，绝不展开调用方对象：写入后调用方改输入不影响已存值。
        storage.setItem(键, JSON.stringify({
          mode: metadata.mode,
          source: {
            file_id: metadata.source.file_id,
            version_id: metadata.source.version_id,
            parse_id: metadata.source.parse_id,
          },
          eligibility: {
            profile: {
              real_name: metadata.eligibility.profile.real_name,
              work_start_year: metadata.eligibility.profile.work_start_year,
              gender: metadata.eligibility.profile.gender,
              birth_year: metadata.eligibility.profile.birth_year,
              birth_month: metadata.eligibility.profile.birth_month,
            },
            summary: metadata.eligibility.summary,
            skills: metadata.eligibility.skills,
            experiences: metadata.eligibility.experiences,
            educations: metadata.eligibility.educations,
            certificates: metadata.eligibility.certificates,
          },
          confirmed: {
            basic: metadata.confirmed.basic,
            degree: metadata.confirmed.degree,
            institution: metadata.confirmed.institution,
            major: metadata.confirmed.major,
            education_period: metadata.confirmed.education_period,
            work: metadata.confirmed.work,
            summary: metadata.confirmed.summary,
          },
          generation: metadata.generation,
        }));
        return true;
      } catch {
        return false;
      }
    },
    删除(): void {
      丢弃();
    },
  };
}
