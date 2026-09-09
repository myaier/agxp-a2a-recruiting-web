// 招聘候选摘要 decoder：include=candidate_summary 展开对象的严格解码。
// 与发现推荐.ts / MatchCase.ts 同一闭合纪律（exact key set、闭集枚举、非负整数、码点上限），
// 但摘要对象由两个列表消费者共用，按仓库 domain-local 惯例内置自己的小 guard，
// 不导出私有 guard；契约错误由调用方按各自请求模式传入（本函数不判定 item 键是否存在）。

import type { BFF招聘候选摘要 } from '../BFF契约';

const 性别枚举 = ['male', 'female'] as const;
const 求职状态枚举 = ['student', 'employed', 'unemployed'] as const;
const 亮点最大码点 = 24;

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === 'object' && 值 !== null && !Array.isArray(值);
}

/** exact key set：缺必需键、多出未知键、显式 undefined 值都按契约漂移 fail closed。 */
function 要求闭合对象(
  input: unknown,
  必需键: readonly string[],
  抛错: () => Error,
): Record<string, unknown> {
  if (!是记录(input)) throw 抛错();
  for (const 键 of 必需键) {
    if (!(键 in input) || input[键] === undefined) throw 抛错();
  }
  for (const 键 of Object.keys(input)) if (!必需键.includes(键)) throw 抛错();
  return input;
}

function 闭集<T extends string>(值: unknown, 枚举: readonly T[], 抛错: () => Error): T | null {
  if (值 === null) return null;
  if (typeof 值 !== 'string' || !(枚举 as readonly string[]).includes(值)) throw 抛错();
  return 值 as T;
}

function 可空字符串(值: unknown, 抛错: () => Error): string | null {
  if (值 === null) return null;
  if (typeof 值 !== 'string') throw 抛错();
  return 值;
}

function 非负整数(值: unknown, 抛错: () => Error): number | null {
  if (值 === null) return null;
  if (typeof 值 !== 'number' || !Number.isInteger(值) || 值 < 0) throw 抛错();
  return 值;
}

function 可空两键对象(
  值: unknown,
  第一键: 'company' | 'institution',
  第二键: 'title' | 'major',
  抛错: () => Error,
): Record<string, string | null> | null {
  if (值 === null) return null;
  const 记录 = 要求闭合对象(值, [第一键, 第二键], 抛错);
  return { [第一键]: 可空字符串(记录[第一键], 抛错), [第二键]: 可空字符串(记录[第二键], 抛错) };
}

function 亮点数组(值: unknown, 抛错: () => Error): string[] {
  if (!Array.isArray(值)) throw 抛错();
  return 值.map((条) => {
    if (typeof 条 !== 'string') throw 抛错();
    const 码点 = [...条].length;
    if (码点 < 1 || 码点 > 亮点最大码点) throw 抛错();
    return 条;
  });
}

/** 输入 null 原样输出 null；摘要对象只允许且必须包含七字段，白名单重建，拒绝未知键。 */
export function 解招聘候选摘要(
  input: unknown,
  契约错误: () => Error,
): BFF招聘候选摘要 | null {
  if (input === null) return null;
  const 记录 = 要求闭合对象(input, [
    'gender', 'experience_years', 'job_status', 'degree',
    'latest_experience', 'latest_education', 'personal_highlights',
  ], 契约错误);
  return {
    gender: 闭集(记录['gender'], 性别枚举, 契约错误),
    experience_years: 非负整数(记录['experience_years'], 契约错误),
    job_status: 闭集(记录['job_status'], 求职状态枚举, 契约错误),
    degree: 可空字符串(记录['degree'], 契约错误),
    latest_experience: 可空两键对象(记录['latest_experience'], 'company', 'title', 契约错误) as BFF招聘候选摘要['latest_experience'],
    latest_education: 可空两键对象(记录['latest_education'], 'institution', 'major', 契约错误) as BFF招聘候选摘要['latest_education'],
    personal_highlights: 亮点数组(记录['personal_highlights'], 契约错误),
  };
}