// 候选 onboarding 简历预填的纯页面初始化映射（Spec §8 的分页应用规则）。
//
// 每个函数只读 候选预填状态 与页面当前值，产出既有页面域形状：不改 state、不标记分区
// 确认、不写存储、不创建服务端 ID/revision。优先级处处一致：
//   服务端非空值（eligibility 快照记录）> 当前页面非空值 > 建议 > 既有 UI 默认。
// value:null 保持缺失（不补默认年/当前年/相邻文本）；status（身份）永不映射；
// 不翻译不支持的学历词汇；exact Catalog 带 canonical ref 而 unresolved 只留 source_name
// 文本；出生年/月限 1970..2010 / 1..12、教育年份限 2000..2030，超界返回页面现值；
// 非空服务端列表分区绝不按下标合并；附加教育只在「已有第 0 条且无更多条」时物化
// suggestion.educations.slice(1)；列表顺序保持 parser 顺序；物化条目的临时编号以
// prefill: 开头（仅供 React key/diff，不匹配服务端 ID grammar，确定可复现）；
// 解析经历沿用 UI 新建段的隐私默认 隐藏:true；internship 缺席保持未设置；
// 证书 year:null 落页面空串；summary 只在偏好段的个人优势题应用。
// 本模块不 import React，不建立通用表单框架或统一「大 Profile」聚合。

import type { 候选预填状态, 候选预填分区 } from '../状态/后端/类型';
import type { BFF简历预填建议, BFF简历预填目录建议 } from '../数据/BFF契约';
import type { 目录选择值 } from '../数据/招聘数据源类型';
import type { 基本信息, 简历经历段, 简历教育段, 简历证书 } from '../数据/类型';
import type { 向导段 } from './onboarding配置';

// ── 页面控件范围与词表（与 屏幕/基本信息、最高学历、就读时间段 的既有档表逐字一致）──

const 出生年下界 = 1970;
const 出生年上界 = 2010;
const 出生月上界 = 12;
const 教育年下界 = 2000;
const 教育年上界 = 2030;

/** 学生四档的基词：current_education / degree 精确命中才组合「X在读」。 */
const 学历基词: readonly string[] = ['大专', '本科', '硕士', '博士'];
/** 学生页四档（在读）与非学生页七档：未命中不翻译、不猜档。 */
const 在读学历选项: readonly string[] = ['大专在读', '本科在读', '硕士在读', '博士在读'];
const 非学生学历选项: readonly string[] = ['初中及以下', '中专/中技', '高中', '大专', '本科', '硕士', '博士'];

// ── 共同门卫：只有 ready 且未确认的分区才可能有建议 ──

/** manual/inactive/arming/waiting_parse/loading/failed 或已确认的分区一律无建议。 */
function 可用建议(state: 候选预填状态, 分区: 候选预填分区): BFF简历预填建议 | null {
  if (state.phase !== 'ready' || state.suggestion === null) return null;
  if (state.confirmed[分区]) return null;
  return state.suggestion;
}

/** 目录建议 → 页面文本 + 可选 canonical 引用；unresolved 只留 source_name，绝不造 ID。 */
function 目录文本与引用(建议: BFF简历预填目录建议): { text: string; ref?: 目录选择值 } {
  if (建议.resolution === 'exact' && 建议.match !== null) {
    return {
      text: 建议.match.display_name,
      ref: { id: 建议.match.id, display_name: 建议.match.display_name },
    };
  }
  return { text: 建议.source_name.value ?? '' };
}

/** 'YYYY-MM' → 控件范围内的年份；缺席或超界返回 null（调用方保留页面现值）。 */
function 控件内年份(月份: string | null): number | null {
  if (月份 === null) return null;
  const 年 = Number(月份.slice(0, 4));
  return 年 >= 教育年下界 && 年 <= 教育年上界 ? 年 : null;
}

// ── 基本信息（/basic）──

export interface 候选基本信息预填 {
  真名?: string;
  开始工作年?: string;
  性别?: 基本信息['性别'];
  出生年?: number;
  出生月?: number;
}

/**
 * 只种入 eligible 且当前为空的建议字段；键缺席 = 页面保留既有值/默认。
 * 出生滚轮输出 number 并限 1970..2010 / 1..12，超界不给初值。
 * profile.status（身份）永不映射：onboarding 分支与意向语义必须由用户显式选择。
 */
export function 取基本信息预填(state: 候选预填状态, current: 基本信息): 候选基本信息预填 {
  const 预填: 候选基本信息预填 = {};
  const 建议 = 可用建议(state, 'basic');
  if (建议 === null || state.eligibility === null) return 预填;
  const 资料 = 建议.draft.profile;
  const 可填 = state.eligibility.profile;

  if (current.真名.trim() === '' && 可填.real_name && 资料.real_name.value !== null) {
    预填.真名 = 资料.real_name.value;
  }
  // 开始工作年只属于非学生分支（学生由在读学历/毕业年表达）
  if (current.身份 !== '在校' && current.开始工作年 === ''
    && 可填.work_start_year && 资料.work_start_year.value !== null) {
    预填.开始工作年 = String(资料.work_start_year.value);
  }
  if (current.性别 === undefined && 可填.gender && 资料.gender.value !== null) {
    预填.性别 = 资料.gender.value === 'male' ? '男' : '女';
  }
  if ((current.出生年 ?? '') === '' && 可填.birth_year) {
    const 年 = 资料.birth_year.value;
    if (年 !== null && 年 >= 出生年下界 && 年 <= 出生年上界) 预填.出生年 = 年;
  }
  if ((current.出生月 ?? '') === '' && 可填.birth_month) {
    const 月 = 资料.birth_month.value;
    if (月 !== null && 月 >= 1 && 月 <= 出生月上界) 预填.出生月 = 月;
  }
  return 预填;
}

// ── 最高学历（/onboard/degree）──

/** 学生：current_education 精确命中四档（或基词）→「X在读」；否则 degree 基词组合；未命中 null。 */
function 学生学历档(值: string | null): string | null {
  if (值 === null) return null;
  if (在读学历选项.includes(值)) return 值;
  if (学历基词.includes(值)) return `${值}在读`;
  return null;
}

/**
 * 学生优先 current_education，回退 educations[0].degree；非学生只认 educations[0].degree
 * 精确命中七档。未命中 UI 词表不翻译、不猜档，返回 null 由页面保留 current。
 */
export function 取最高学历预填(state: 候选预填状态, isStudent: boolean, current: string): string | null {
  const 建议 = 可用建议(state, 'degree');
  if (建议 === null || state.eligibility?.educations !== true) return null;
  const 档 = 建议.draft.educations[0]?.degree.value ?? null;

  let 命中: string | null;
  if (isStudent) {
    // codex review-r1 P1：页面「既有选择」来自服务端在读学历时与 UI 默认无法区分 ——
    // source 时服务端 current_education 非空就整条不建议（设计 §8：服务端值优先）。
    if (state.eligibility.profile.current_education !== true) return null;
    命中 = 学生学历档(建议.draft.profile.current_education.value);
    if (命中 === null && 档 !== null && 学历基词.includes(档)) 命中 = `${档}在读`;
  } else {
    // 非学生只接受 education[0].degree；current_education 不参与
    命中 = 档 !== null && 非学生学历选项.includes(档) ? 档 : null;
  }
  // 与页面当前选择一致时无需重设：null 表示保留 current
  return 命中 !== null && 命中 !== current ? 命中 : null;
}

// ── 毕业院校 / 选专业（/onboard/school、/onboard/major）──

function 取目录页预填(
  state: 候选预填状态,
  分区: 'institution' | 'major',
  currentText: string,
  currentRef: 目录选择值 | undefined,
  建议: (草稿: BFF简历预填建议) => BFF简历预填目录建议 | undefined,
): { text: string; ref?: 目录选择值 } {
  if (currentText.trim() !== '') {
    // 当前页面非空值优先：文本与已有引用原样保留
    return currentRef !== undefined ? { text: currentText, ref: currentRef } : { text: currentText };
  }
  const 草稿 = 可用建议(state, 分区);
  if (草稿 === null || state.eligibility?.educations !== true) return { text: currentText };
  const 目录 = 建议(草稿);
  if (目录 === undefined) return { text: currentText };
  return 目录文本与引用(目录);
}

/** exact 用 match.display_name + canonical 引用；unresolved 只落 source_name 文本。 */
export function 取学校预填(
  state: 候选预填状态,
  currentText: string,
  currentRef?: 目录选择值,
): { text: string; ref?: 目录选择值 } {
  return 取目录页预填(state, 'institution', currentText, currentRef, (草稿) => 草稿.draft.educations[0]?.institution);
}

export function 取专业预填(
  state: 候选预填状态,
  currentText: string,
  currentRef?: 目录选择值,
): { text: string; ref?: 目录选择值 } {
  return 取目录页预填(state, 'major', currentText, currentRef, (草稿) => 草稿.draft.educations[0]?.major);
}

// ── 就读时间段（/onboard/eduyears）──

/**
 * 从 educations[0].start_month/end_month 取年份，仅 2000..2030 才预选；
 * 学生 end month 缺失时可回退 profile.graduation_year（仍须在控件范围）。
 * 无建议/超界/缺席时返回传入的当前值（页面既有默认）。
 */
export function 取就读年份预填(
  state: 候选预填状态,
  currentStart: number,
  currentEnd: number,
  isStudent: boolean,
): { start: number; end: number } {
  const 结果 = { start: currentStart, end: currentEnd };
  const 建议 = 可用建议(state, 'education_period');
  if (建议 === null || state.eligibility?.educations !== true) return 结果;
  const 教育 = 建议.draft.educations[0];
  if (教育 === undefined) return 结果;

  const 起年 = 控件内年份(教育.start_month.value);
  if (起年 !== null) 结果.start = 起年;
  if (教育.end_month.value !== null) {
    const 止年 = 控件内年份(教育.end_month.value);
    if (止年 !== null) 结果.end = 止年;
  } else if (isStudent) {
    const 毕业年 = 建议.draft.profile.graduation_year.value;
    if (毕业年 !== null && 毕业年 >= 教育年下界 && 毕业年 <= 教育年上界) 结果.end = 毕业年;
  }
  return 结果;
}

// ── 工作经历页（/experience：经历 / 附加教育 / 技能 / 证书）──

export interface 候选工作页当前值 {
  experiences: 简历经历段[];
  educations: 简历教育段[];
  skills: string[];
  certificates: 简历证书[];
}

/** 物化条目临时编号前缀：仅供 React key/diff，绝不匹配服务端 ID grammar。 */
const 预填编号前缀 = 'prefill:';

/** 仅供 React key/diff 的确定性临时编号：以 prefill: 开头，绝不匹配服务端 ID grammar。 */
function 临时编号(类: string, 序: number): string {
  return `${预填编号前缀}${类}:${序}`;
}

/** exact 行业带 canonical 引用；unresolved 只留 source_name 文本。 */
function 物化行业(建议: BFF简历预填目录建议): Pick<简历经历段, '行业' | '行业引用'> {
  const { text, ref } = 目录文本与引用(建议);
  return ref !== undefined ? { 行业: text, 行业引用: ref } : { 行业: text };
}

function 物化经历(段: BFF简历预填建议['draft']['experiences'][number], 序: number): 简历经历段 {
  const 经历: 简历经历段 = {
    编号: 临时编号('exp', 序),
    公司: 段.company.value ?? '',
    ...物化行业(段.industry),
    职位: 段.title.value ?? '',
    开始: 段.start_month.value ?? '',
    // 解析没给结束月 = 页面新建段的既有默认（至今开关开）；不补当前月
    结束: 段.end_month.value,
    内容: 段.description.value ?? '',
    // 隐藏不来自解析：沿用当前 UI 新建段的隐私默认 true，不得因预填改成公开
    隐藏: true,
  };
  // internship 缺席保持未设置（选填开关留给用户）
  if (段.internship.value !== null) 经历.实习 = 段.internship.value;
  if (段.projects.length > 0) {
    经历.项目 = 段.projects.map((项, 项目序) => ({
      编号: 临时编号(`exp:${序}:proj`, 项目序),
      名称: 项.name.value ?? '',
      角色: 项.role.value ?? '',
      结果: 项.result.value ?? '',
    }));
  }
  return 经历;
}

function 物化教育(段: BFF简历预填建议['draft']['educations'][number], 序: number): 简历教育段 {
  const 学校 = 目录文本与引用(段.institution);
  const 专业 = 目录文本与引用(段.major);
  const 教育: 简历教育段 = {
    编号: 临时编号('edu', 序),
    学校: 学校.text,
    学历: 段.degree.value ?? '',
    专业: 专业.text,
    // 简历教育段.结束 是必填字符串；后端 null（至今在读）按既有 读映射 落成空串
    结束: 段.end_month.value ?? '',
    开始: 段.start_month.value ?? '',
  };
  if (学校.ref !== undefined) 教育.学校引用 = 学校.ref;
  if (专业.ref !== undefined) 教育.专业引用 = 专业.ref;
  return 教育;
}

/** 经历条目还有未选目录或缺失必填（公司/职位/入职时间/行业引用）。 */
function 经历未完成(段: 简历经历段): boolean {
  return 段.行业引用 === undefined || 段.公司 === '' || 段.职位 === '' || 段.开始 === '';
}

/** 教育条目还有未选目录或缺失必填（学校/专业/入学时间 + 两处 canonical 引用）。 */
function 教育未完成(段: 简历教育段): boolean {
  return 段.学校引用 === undefined || 段.专业引用 === undefined
    || 段.学校 === '' || 段.专业 === '' || 段.开始 === '';
}

/**
 * 对当前页面列表实时重数预填物化条目（编号以 prefill: 开头）中仍有未选目录或缺失
 * 必填的条数：经历/教育复用 经历未完成 / 教育未完成，物化证书名称为空（name:null
 * 落成的空名称行）也计入。保存点击用它求值 —— 用户补齐或删除物化条目后计数实时
 * 归零，不受挂载时冻结的 unresolvedCount 牵制；用户自建条目（无 prefill: 前缀）
 * 不在此列，仍由页面既有必填守卫负责。
 */
export function 数未完成项(
  经历列表: 简历经历段[],
  教育列表: 简历教育段[],
  证书列表: 简历证书[],
): number {
  return 经历列表.filter((段) => 段.编号.startsWith(预填编号前缀) && 经历未完成(段)).length
    + 教育列表.filter((条) => 条.编号.startsWith(预填编号前缀) && 教育未完成(条)).length
    + 证书列表.filter((条) => 条.编号.startsWith(预填编号前缀) && 条.名称 === '').length;
}

/**
 * 工作经历页一次物化该页可见的四个分区。experiences / skills / certificates 只在
 * source 绑定时对应服务端列表为空、当前页面对应列表仍为空且 work 未确认时物化；
 * 附加教育使用同一个 source-time educations eligibility，页面空条件是
 * 「已有前四页形成的 educations[0]，且 slice(1) 为空」：满足时保留第 0 条并追加
 * suggestion.educations.slice(1)，当前已有任何附加教育则完全不追加。
 * 非空服务端/页面列表绝不按下标合并；顺序保持 parser 顺序，不排序、不去重（技能除外：
 * 页面自身按字符串作 React key，重复技能去重保序）。unresolvedCount 是物化条目中
 * 仍有未选目录或缺失必填的条数（含名称为空的物化证书行），与 数未完成项 同口径、
 * 只反映挂载物化那一刻；保存点击的实时拦截请对当前列表调 数未完成项。不做任何静默丢弃。
 */
export function 取工作页预填(state: 候选预填状态, current: 候选工作页当前值): {
  experiences: 简历经历段[];
  educations: 简历教育段[];
  skills: string[];
  certificates: 简历证书[];
  unresolvedCount: number;
} {
  const 建议 = 可用建议(state, 'work');
  let experiences = current.experiences;
  let educations = current.educations;
  let skills = current.skills;
  let certificates = current.certificates;
  let unresolvedCount = 0;
  if (建议 !== null && state.eligibility !== null) {
    const 可填 = state.eligibility;

    if (可填.experiences && current.experiences.length === 0) {
      experiences = 建议.draft.experiences.map(物化经历);
      unresolvedCount += experiences.filter(经历未完成).length;
    }
    if (可填.educations && current.educations.length === 1) {
      // 已有第 0 条（前四页形成）且无更多条时才追加 slice(1)；第 0 条保持原样，
      // 附加条沿用建议里的原始下标（从 1 起）保证键稳定
      const 附加 = 建议.draft.educations.slice(1).map((段, 序) => 物化教育(段, 序 + 1));
      educations = [current.educations[0], ...附加];
      unresolvedCount += 附加.filter(教育未完成).length;
    }
    if (可填.skills && current.skills.length === 0) {
      const 技能: string[] = [];
      for (const 项 of 建议.draft.skills) {
        const 词 = 项.value;
        if (词 !== null && 词 !== '' && !技能.includes(词)) 技能.push(词);
      }
      skills = 技能;
    }
    if (可填.certificates && current.certificates.length === 0) {
      certificates = 建议.draft.certificates.map((证, 序) => ({
        编号: 临时编号('cer', 序),
        名称: 证.name.value ?? '',
        // year:null → 页面空字符串（列表里年份为空即不渲染），不补年份
        年份: 证.year.value === null ? '' : String(证.year.value),
      }));
      // name:null 物化的空名称行与 数未完成项 同口径计入（review Issue 9）
      unresolvedCount += certificates.filter((证) => 证.名称 === '').length;
    }
  }
  return { experiences, educations, skills, certificates, unresolvedCount };
}

// ── 引导问答的个人优势（/wizard 偏好段）──

/**
 * draft.summary 只在偏好段的「个人优势」题作为初值（社招首次薪资段不应用）；
 * 当前已有个人优势或 summary 缺席/不可填时原样返回 current。
 */
export function 取个人优势预填(state: 候选预填状态, stage: 向导段, current: string): string {
  if (stage !== '偏好段' || current.trim() !== '') return current;
  const 建议 = 可用建议(state, 'summary');
  if (建议 === null || state.eligibility?.summary !== true) return current;
  return 建议.draft.summary.value ?? current;
}
