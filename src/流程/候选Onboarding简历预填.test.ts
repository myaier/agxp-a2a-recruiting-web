// 候选 onboarding 简历预填的纯页面映射测试（Spec §8 的全部分页应用规则）。
// 优先级铁律：服务端非空值（eligibility 记录）> 当前页面非空值 > 建议 > 既有 UI 默认；
// value:null 保持缺失不补默认；status 永不映射；不翻译不支持的学历词汇；
// exact Catalog 带 canonical ref 而 unresolved 只留 source_name 文本；
// 出生年/月 限 1970..2010 / 1..12，教育年份限 2000..2030，超界保留页面现值；
// 非空服务端列表分区不按下标合并；附加教育只在「已有第 0 条且无更多条」时物化；
// 临时编号以 prefill: 开头且不匹配服务端 ID grammar；parser 顺序保持；
// 解析经历沿用 UI 新建段隐私默认 隐藏:true；internship 缺席保持未设置；
// 证书 year:null 落页面空串；个人优势只在偏好段应用。
// 不可变 wire fixture（简历预填成功信封）经 构造映射变体基底() 深拷贝进状态（绝不改写）；
// 正向值用 fixture 文件里标注「前端映射变体」的本地构造器；边界/缺席改写一律深拷贝副本。

import { describe, expect, it } from 'vitest';
import {
  创建空候选预填状态,
  type 候选预填Eligibility,
  type 候选预填状态,
} from '../状态/后端/类型';
import {
  取基本信息预填,
  取最高学历预填,
  取学校预填,
  取专业预填,
  取就读年份预填,
  取工作页预填,
  取个人优势预填,
  取可恢复个人优势建议,
  数未完成项,
  type 候选工作页当前值,
} from './候选Onboarding简历预填';
import {
  构造映射变体基底,
  性别已填变体,
  生日已填变体,
  受支持学历变体,
  目录精确命中变体,
  多条教育变体,
} from '../数据/招聘数据源/简历预填.fixture';
import type { BFF简历预填建议 } from '../数据/BFF契约';
import type { 基本信息, 简历经历段 } from '../数据/类型';
import type { 向导段 } from './onboarding配置';

/** 与后端各域公开 ID 同族的 grammar（前缀 + 32 位小写十六进制）：prefill: 临时编号绝不能撞上。 */
const 服务端ID样式 = /^[a-z]{2,4}_[0-9a-f]{32}$/;

const 现有经历fixture: 简历经历段 = {
  编号: 'exp_server_1',
  公司: '现有公司',
  行业: '软件',
  职位: '工程师',
  开始: '2024-01',
  结束: null,
  内容: '',
  隐藏: true,
};

const 全可预填: 候选预填Eligibility = {
  profile: { real_name: true, work_start_year: true, gender: true, birth_year: true, birth_month: true, current_education: true },
  summary: true,
  skills: true,
  experiences: true,
  educations: true,
  certificates: true,
};

/** wire fixture 的可变深拷贝：进状态的建议用可变形状，绝不改回 简历预填成功信封。 */
function wire建议(): BFF简历预填建议 {
  return 构造映射变体基底();
}

function readyState(
  suggestion: BFF简历预填建议,
  patch: Partial<Omit<候选预填Eligibility, 'profile'>> = {},
): 候选预填状态 {
  return {
    ...创建空候选预填状态(),
    phase: 'ready',
    source: suggestion.source,
    eligibility: { ...全可预填, ...patch },
    suggestion,
  };
}

/** 深拷贝 wire fixture 的 result 改写出映射边界样本（缺席/超界/未解析），不触碰不可变 fixture。 */
function 映射变体(改写: (建议: BFF简历预填建议) => void): BFF简历预填建议 {
  const 副本 = 构造映射变体基底();
  改写(副本);
  return 副本;
}

function 空白基本(身份: 基本信息['身份'] = '在职'): 基本信息 {
  return { 真名: '', 开始工作年: '', 身份 };
}

function 空工作页(覆盖: Partial<候选工作页当前值> = {}): 候选工作页当前值 {
  return { experiences: [], educations: [], skills: [], certificates: [], ...覆盖 };
}

describe('候选预填状态种子', () => {
  it('初始状态 inactive、无来源/建议/错误、confirmed 全 false、generation 0', () => {
    const 种子 = 创建空候选预填状态();
    expect(种子).toEqual({
      phase: 'inactive',
      source: null,
      eligibility: null,
      suggestion: null,
      confirmed: {
        basic: false,
        degree: false,
        institution: false,
        major: false,
        education_period: false,
        work: false,
        summary: false,
      },
      error: null,
      generation: 0,
    });
  });

  it('创建空候选预填状态(5) 保留传入 generation', () => {
    expect(创建空候选预填状态(5).generation).toBe(5);
  });
});

describe('取基本信息预填', () => {
  it('空白页面种入真名/开始工作年；wire fixture 的性别与生日为 null 保持缺失', () => {
    const state = readyState(wire建议());
    expect(取基本信息预填(state, 空白基本())).toEqual({
      真名: 'Synthetic Candidate',
      开始工作年: '2021',
    });
  });

  it('性别映射 male/female → 男/女（本地正向变体）', () => {
    const state = readyState(性别已填变体());
    expect(取基本信息预填(state, 空白基本()).性别).toBe('女');
  });

  it('出生年/月给出数字初值（本地正向变体）', () => {
    const state = readyState(生日已填变体());
    const 预填 = 取基本信息预填(state, 空白基本());
    expect(预填.出生年).toBe(1998);
    expect(预填.出生月).toBe(6);
  });

  it('出生年/月超出 1970..2010 / 1..12 时不给初值（页面保留既有默认）', () => {
    const 超上界 = readyState(映射变体((建议) => {
      建议.draft.profile.birth_year = { value: 2011, confidence: 'medium' };
      建议.draft.profile.birth_month = { value: 13, confidence: 'medium' };
    }));
    expect(取基本信息预填(超上界, 空白基本())).toEqual({
      真名: 'Synthetic Candidate',
      开始工作年: '2021',
    });

    const 超下界 = readyState(映射变体((建议) => {
      建议.draft.profile.birth_year = { value: 1969, confidence: 'medium' };
      建议.draft.profile.birth_month = { value: 0, confidence: 'medium' };
    }));
    const 预填 = 取基本信息预填(超下界, 空白基本());
    expect(预填.出生年).toBeUndefined();
    expect(预填.出生月).toBeUndefined();
  });

  it('出生年在界内而月份超界时只落出生年', () => {
    const state = readyState(映射变体((建议) => {
      建议.draft.profile.birth_year = { value: 1998, confidence: 'medium' };
      建议.draft.profile.birth_month = { value: 13, confidence: 'medium' };
    }));
    const 预填 = 取基本信息预填(state, 空白基本());
    expect(预填.出生年).toBe(1998);
    expect(预填.出生月).toBeUndefined();
  });

  it('当前页面非空值优先：全部已有值时不产出任何键', () => {
    const state = readyState(性别已填变体());
    const 已填: 基本信息 = {
      真名: '张三',
      开始工作年: '2019',
      身份: '在职',
      性别: '男',
      出生年: '1990',
      出生月: '1',
    };
    expect(取基本信息预填(state, 已填)).toEqual({});
  });

  it('学生不映射开始工作年；status（身份）永不映射', () => {
    const state = readyState(wire建议());
    const 预填 = 取基本信息预填(state, 空白基本('在校'));
    expect(预填.开始工作年).toBeUndefined();
    expect(Object.keys(预填)).not.toContain('身份');
  });

  it('eligibility 记录服务端已有值：对应字段不给建议', () => {
    const state = readyState(wire建议());
    state.eligibility = {
      ...全可预填,
      profile: { real_name: false, work_start_year: true, gender: true, birth_year: true, birth_month: true, current_education: true },
    };
    expect(取基本信息预填(state, 空白基本())).toEqual({ 开始工作年: '2021' });
  });

  it('basic 已确认或阶段非 ready 时不再建议', () => {
    const 已确认 = readyState(wire建议());
    已确认.confirmed.basic = true;
    expect(取基本信息预填(已确认, 空白基本())).toEqual({});

    const 手填 = readyState(wire建议());
    手填.phase = 'manual';
    expect(取基本信息预填(手填, 空白基本())).toEqual({});
  });

  it('纯函数：不改动 state 与当前页面值', () => {
    const state = readyState(wire建议());
    const 当前 = 空白基本();
    const 快照 = JSON.stringify({ state, 当前 });
    取基本信息预填(state, 当前);
    expect(JSON.stringify({ state, 当前 })).toBe(快照);
  });
});

describe('取最高学历预填', () => {
  it('学生：current_education 精确命中四档基词时给「X在读」（本地正向变体）', () => {
    const state = readyState(受支持学历变体());
    expect(取最高学历预填(state, true, '大专在读')).toBe('本科在读');
  });

  it('与页面当前选择一致的命中返回 null（无需重设，页面保留 current）', () => {
    const state = readyState(受支持学历变体());
    expect(取最高学历预填(state, true, '本科在读')).toBeNull();
  });

  it('学生：current_education 未命中时回退 education[0].degree 基词', () => {
    const state = readyState(映射变体((建议) => {
      建议.draft.profile.current_education = { value: null, confidence: null };
    }));
    // wire fixture 的 degree 是 'Bachelor'：仍未命中 → null（不翻译）
    expect(取最高学历预填(state, true, '本科在读')).toBeNull();

    const 硕士档 = readyState(映射变体((建议) => {
      建议.draft.profile.current_education = { value: null, confidence: null };
      建议.draft.educations[0].degree = { value: '硕士', confidence: 'high' };
    }));
    expect(取最高学历预填(硕士档, true, '本科在读')).toBe('硕士在读');
  });

  // codex review-r1 P1：学生服务端在读学历（profile.current_education）可以非空而
  // educations 列表仍为空（此前 onboarding 先落 profile、跳过未完整 education 段）。
  // 此时 eligibility.educations 为 true，但页面 既有 来自已保存服务端值 —— 与 UI 默认
  // 无法区分，必须由 eligibility 按「source 时服务端 current_education 是否为空」挡住
  // 建议，否则下一轮上传的 PDF 建议会在保存时覆盖已有在读学历（设计 §8 服务端值优先）。
  it('服务端已有在读学历时不建议：current_education 非空 → 学生路径整体返回 null', () => {
    const state = {
      ...readyState(受支持学历变体()),
      eligibility: { ...全可预填, profile: { ...全可预填.profile, current_education: false } },
    };
    expect(取最高学历预填(state, true, '大专在读')).toBeNull(); // 建议「本科在读」不同也不给
  });

  it('非学生：只接受 education[0].degree 精确命中七档', () => {
    const 支持 = readyState(受支持学历变体());
    expect(取最高学历预填(支持, false, '大专')).toBe('本科');

    const 不支持 = readyState(wire建议());
    expect(取最高学历预填(不支持, false, '本科')).toBeNull();
  });

  it('非学生忽略 current_education；不支持的词表不翻译不猜档', () => {
    const state = readyState(映射变体((建议) => {
      建议.draft.profile.current_education = { value: '博士', confidence: 'high' };
      建议.draft.educations[0].degree = { value: '大专', confidence: 'high' };
    }));
    expect(取最高学历预填(state, false, '本科')).toBe('大专');
  });

  it('educations 非空（服务端已有教育）或 degree 已确认时不建议', () => {
    const 非空 = readyState(受支持学历变体(), { educations: false });
    expect(取最高学历预填(非空, false, '大专')).toBeNull();

    const 已确认 = readyState(受支持学历变体());
    已确认.confirmed.degree = true;
    expect(取最高学历预填(已确认, true, '大专在读')).toBeNull();
  });
});

describe('取学校预填 / 取专业预填', () => {
  it('unresolved 只落 source_name 文本，不制造引用（brief 用例）', () => {
    const state = readyState(wire建议(), { educations: true });
    expect(取学校预填(state, '', undefined)).toEqual({ text: 'Example University' });
    expect(取专业预填(state, '', undefined)).toEqual({ text: 'Computer Science' });
    const 学校 = 取学校预填(state, '', undefined);
    expect('ref' in 学校).toBe(false);
  });

  it('exact 带 canonical ref 与 display_name（本地正向变体）', () => {
    const state = readyState(目录精确命中变体(), { educations: true });
    expect(取学校预填(state, '', undefined)).toEqual({
      text: 'Example University',
      ref: { id: 'ins_bbbbbbbbbbbbbbbbbbbbbbbbbb', display_name: 'Example University' },
    });
    expect(取专业预填(state, '', undefined)).toEqual({
      text: 'Computer Science',
      ref: { id: 'tax_cccccccccccccccccccccccc', display_name: 'Computer Science' },
    });
  });

  it('当前文本非空时原样保留（含已有引用）', () => {
    const state = readyState(目录精确命中变体(), { educations: true });
    const 引用 = { id: 'ins_existing', display_name: '清华大学' };
    expect(取学校预填(state, '清华大学', 引用)).toEqual({ text: '清华大学', ref: 引用 });
    expect(取学校预填(state, '清华大学', undefined)).toEqual({ text: '清华大学' });
  });

  it('来源缺失（value:null）保持空文本', () => {
    const state = readyState(映射变体((建议) => {
      建议.draft.educations[0].institution = {
        source_name: { value: null, confidence: null },
        resolution: 'unresolved',
        match: null,
      };
    }), { educations: true });
    expect(取学校预填(state, '', undefined)).toEqual({ text: '' });
  });

  it('educations 非空或分区已确认时保留当前值', () => {
    const 非空 = readyState(目录精确命中变体(), { educations: false });
    expect(取学校预填(非空, '', undefined)).toEqual({ text: '' });

    const 已确认 = readyState(目录精确命中变体(), { educations: true });
    已确认.confirmed.institution = true;
    expect(取学校预填(已确认, '', undefined)).toEqual({ text: '' });
  });
});

describe('取就读年份预填', () => {
  it('从 education[0] 起止月取年份（wire fixture 2017-09 / 2021-06）', () => {
    const state = readyState(wire建议(), { educations: true });
    expect(取就读年份预填(state, 2021, 2025, false)).toEqual({ start: 2017, end: 2021 });
  });

  it('年份超出 2000..2030 时保留页面现值', () => {
    const 起点超界 = readyState(映射变体((建议) => {
      建议.draft.educations[0].start_month = { value: '1999-09', confidence: 'high' };
    }), { educations: true });
    expect(取就读年份预填(起点超界, 2021, 2025, false)).toEqual({ start: 2021, end: 2021 });

    const 止点超界 = readyState(映射变体((建议) => {
      建议.draft.educations[0].end_month = { value: '2031-06', confidence: 'high' };
    }), { educations: true });
    expect(取就读年份预填(止点超界, 2021, 2025, false)).toEqual({ start: 2017, end: 2025 });
  });

  it('起点缺失保留页面现值', () => {
    const state = readyState(映射变体((建议) => {
      建议.draft.educations[0].start_month = { value: null, confidence: null };
    }), { educations: true });
    expect(取就读年份预填(state, 2021, 2025, false)).toEqual({ start: 2021, end: 2021 });
  });

  it('学生 end month 缺失时可用 profile.graduation_year（仍须 2000..2030）', () => {
    const 无止月 = readyState(映射变体((建议) => {
      建议.draft.educations[0].end_month = { value: null, confidence: null };
    }), { educations: true });
    expect(取就读年份预填(无止月, 2021, 2025, true)).toEqual({ start: 2017, end: 2021 });
    expect(取就读年份预填(无止月, 2021, 2025, false)).toEqual({ start: 2017, end: 2025 });

    const 毕业超界 = readyState(映射变体((建议) => {
      建议.draft.educations[0].end_month = { value: null, confidence: null };
      建议.draft.profile.graduation_year = { value: 1999, confidence: 'high' };
    }), { educations: true });
    expect(取就读年份预填(毕业超界, 2021, 2025, true)).toEqual({ start: 2017, end: 2025 });
  });

  it('educations 非空或分区已确认时保留页面现值', () => {
    const 非空 = readyState(wire建议(), { educations: false });
    expect(取就读年份预填(非空, 2021, 2025, false)).toEqual({ start: 2021, end: 2025 });

    const 已确认 = readyState(wire建议(), { educations: true });
    已确认.confirmed.education_period = true;
    expect(取就读年份预填(已确认, 2021, 2025, false)).toEqual({ start: 2021, end: 2025 });
  });
});

describe('取工作页预填', () => {
  it('does not merge suggestions into a non-empty server experience partition（brief 用例）', () => {
    const state = readyState(wire建议(), { experiences: false });
    const current = { experiences: [现有经历fixture], educations: [], skills: [], certificates: [] };
    expect(取工作页预填(state, current).experiences).toEqual([现有经历fixture]);
  });

  it('当前列表非空时即使 eligible 也不合并（当前页面值优先）', () => {
    const state = readyState(wire建议());
    const current = 空工作页({ experiences: [现有经历fixture] });
    const 结果 = 取工作页预填(state, current);
    expect(结果.experiences).toEqual([现有经历fixture]);
    expect(结果.unresolvedCount).toBe(0);
  });

  it('空服务端且空页面时物化解析经历：exact 行业带引用、隐藏默认开、项目保序', () => {
    const state = readyState(wire建议());
    const 结果 = 取工作页预填(state, 空工作页());
    expect(结果.experiences).toEqual([{
      编号: 'prefill:exp:0',
      公司: 'Example Systems',
      行业: 'Software',
      行业引用: { id: 'tax_aaaaaaaaaaaaaaaaaaaaaaaaaa', display_name: 'Software' },
      职位: 'Backend Engineer',
      开始: '2021-07',
      结束: null,
      内容: 'Implemented deterministic services.',
      隐藏: true,
      实习: false,
      项目: [{
        编号: 'prefill:exp:0:proj:0',
        名称: 'Synthetic Gateway',
        角色: 'Maintainer',
        结果: 'Reduced contract drift.',
      }],
    }]);
  });

  it('unresolved 行业只留 source_name 文本并无引用，计入 unresolvedCount', () => {
    const state = readyState(映射变体((建议) => {
      建议.draft.experiences[0].industry = {
        source_name: { value: 'Software', confidence: 'medium' },
        resolution: 'unresolved',
        match: null,
      };
    }));
    const 结果 = 取工作页预填(state, 空工作页());
    expect(结果.experiences[0].行业).toBe('Software');
    expect('行业引用' in 结果.experiences[0]).toBe(false);
    expect(结果.unresolvedCount).toBe(1);
  });

  it('开始/公司/职位缺失保持空串（必填留待用户补），计入 unresolvedCount', () => {
    const state = readyState(映射变体((建议) => {
      建议.draft.experiences[0].company = { value: null, confidence: null };
      建议.draft.experiences[0].start_month = { value: null, confidence: null };
    }));
    const 结果 = 取工作页预填(state, 空工作页());
    expect(结果.experiences[0].公司).toBe('');
    expect(结果.experiences[0].开始).toBe('');
    expect(结果.unresolvedCount).toBe(1);
  });

  it('internship 缺席保持未设置；有值时如实落', () => {
    const 缺席 = readyState(映射变体((建议) => {
      建议.draft.experiences[0].internship = { value: null, confidence: null };
    }));
    const 物化 = 取工作页预填(缺席, 空工作页()).experiences[0];
    expect('实习' in 物化).toBe(false);

    const 实习 = readyState(映射变体((建议) => {
      建议.draft.experiences[0].internship = { value: true, confidence: 'high' };
    }));
    expect(取工作页预填(实习, 空工作页()).experiences[0].实习).toBe(true);
  });

  it('parser 顺序保持：多条经历按原顺序物化', () => {
    const state = readyState(映射变体((建议) => {
      建议.draft.experiences.push(structuredClone(建议.draft.experiences[0]));
      建议.draft.experiences[1].company = { value: 'Second Corp', confidence: 'high' };
      建议.draft.experiences[1].industry = {
        source_name: { value: 'Finance', confidence: 'medium' },
        resolution: 'unresolved',
        match: null,
      };
    }));
    const 结果 = 取工作页预填(state, 空工作页());
    expect(结果.experiences.map((段) => 段.公司)).toEqual(['Example Systems', 'Second Corp']);
    expect(结果.experiences.map((段) => 段.编号)).toEqual(['prefill:exp:0', 'prefill:exp:1']);
    expect(结果.unresolvedCount).toBe(1);
  });

  it('附加教育只在「已有第 0 条且无更多条」时物化 slice(1)', () => {
    const 主段 = { 编号: 'edu_local_0', 学校: '清华大学', 学历: '本科', 专业: '计算机', 开始: '2017-09', 结束: '2021-06' };
    const state = readyState(多条教育变体(), { educations: true });
    const 结果 = 取工作页预填(state, 空工作页({ educations: [主段] }));
    expect(结果.educations).toEqual([主段, {
      编号: 'prefill:edu:1',
      学校: 'Example Graduate School',
      学历: '硕士',
      专业: 'Distributed Systems',
      开始: '2021-09',
      结束: '',
    }]);
    // 附加教育 unresolved（学校/专业无 canonical ref）计入 unresolvedCount
    expect(结果.unresolvedCount).toBe(1);
  });

  it('当前已有附加教育时不追加；当前教育为空（无第 0 条）时也不物化', () => {
    const state = readyState(多条教育变体(), { educations: true });
    const 主段 = { 编号: 'edu_local_0', 学校: 'A', 学历: '本科', 专业: 'B', 开始: '2017-09', 结束: '2021-06' };
    const 附加 = { 编号: 'edu_local_1', 学校: 'C', 学历: '硕士', 专业: 'D', 开始: '2021-09', 结束: '' };
    expect(取工作页预填(state, 空工作页({ educations: [主段, 附加] })).educations).toEqual([主段, 附加]);
    expect(取工作页预填(state, 空工作页({ educations: [] })).educations).toEqual([]);
  });

  it('skills：空页面物化（去重、跳过空值/缺席），非空页面保留', () => {
    const state = readyState(映射变体((建议) => {
      建议.draft.skills = [
        { value: null, confidence: null },
        { value: 'Go', confidence: 'high' },
        { value: 'Go', confidence: 'high' },
        { value: 'Rust', confidence: 'medium' },
      ];
    }));
    expect(取工作页预填(state, 空工作页()).skills).toEqual(['Go', 'Rust']);

    const 保留 = readyState(wire建议());
    expect(取工作页预填(保留, 空工作页({ skills: ['现有技能'] })).skills).toEqual(['现有技能']);
  });

  it('skills/certificates 的 eligibility 关闭时保留当前列表', () => {
    const 无技能 = readyState(wire建议(), { skills: false, certificates: false });
    const 结果 = 取工作页预填(无技能, 空工作页());
    expect(结果.skills).toEqual([]);
    expect(结果.certificates).toEqual([]);
  });

  it('证书 year:null 落页面空串；有值落字符串', () => {
    const state = readyState(wire建议());
    expect(取工作页预填(state, 空工作页()).certificates).toEqual([
      { 编号: 'prefill:cer:0', 名称: 'Synthetic Cloud Certificate', 年份: '' },
    ]);

    const 有年份 = readyState(映射变体((建议) => {
      建议.draft.certificates[0].year = { value: 2020, confidence: 'high' };
    }));
    expect(取工作页预填(有年份, 空工作页()).certificates).toEqual([
      { 编号: 'prefill:cer:0', 名称: 'Synthetic Cloud Certificate', 年份: '2020' },
    ]);
  });

  it('证书 name:null 物化空名称行并计入 unresolvedCount（与 数未完成项 同口径）', () => {
    const state = readyState(映射变体((建议) => {
      建议.draft.certificates[0].name = { value: null, confidence: null };
    }));
    const 结果 = 取工作页预填(state, 空工作页());
    expect(结果.certificates).toEqual([{ 编号: 'prefill:cer:0', 名称: '', 年份: '' }]);
    expect(结果.unresolvedCount).toBe(1);
  });

  it('work 已确认时整页保留当前值', () => {
    const state = readyState(wire建议());
    state.confirmed.work = true;
    const current = 空工作页({ skills: ['已确认技能'] });
    const 结果 = 取工作页预填(state, current);
    expect(结果.experiences).toEqual([]);
    expect(结果.skills).toEqual(['已确认技能']);
    expect(结果.unresolvedCount).toBe(0);
  });

  it('临时编号以 prefill: 开头、不匹配服务端 ID grammar，且确定可复现', () => {
    const state = readyState(多条教育变体());
    const 主段 = { 编号: 'edu_local_0', 学校: 'A', 学历: '本科', 专业: 'B', 开始: '2017-09', 结束: '2021-06' };
    const 第一次 = 取工作页预填(state, 空工作页({ educations: [主段] }));
    const 第二次 = 取工作页预填(state, 空工作页({ educations: [主段] }));
    const 编号们 = [
      ...第一次.experiences.map((段) => 段.编号),
      ...第一次.experiences.flatMap((段) => (段.项目 ?? []).map((项) => 项.编号)),
      // 第 0 条是页面已有主段（非 prefill 键），只有物化的附加教育带临时编号
      ...第一次.educations.slice(1).map((条) => 条.编号),
      ...第一次.certificates.map((条) => 条.编号),
    ];
    expect(编号们.length).toBeGreaterThan(0);
    for (const 编号 of 编号们) {
      expect(编号.startsWith('prefill:')).toBe(true);
      expect(服务端ID样式.test(编号)).toBe(false);
    }
    expect(第二次).toEqual(第一次);
  });

  it('纯函数：不改动 state 与当前页面列表', () => {
    const state = readyState(多条教育变体());
    const current = 空工作页({ experiences: [现有经历fixture] });
    const 快照 = JSON.stringify({ state, current });
    取工作页预填(state, current);
    expect(JSON.stringify({ state, current })).toBe(快照);
  });
});

// 保存点击时的实时重数（review Issue 1/9）：挂载时冻结的 unresolvedCount 在用户补齐或
// 删除物化条目后不会归零，误拦保存；数未完成项 对当前列表求值，只认 prefill: 物化条目。
describe('数未完成项', () => {
  /** 未完成的物化经历（unresolved 行业无引用）。 */
  const 未完成经历: 简历经历段 = {
    编号: 'prefill:exp:0',
    公司: 'Example Systems',
    行业: 'Software',
    职位: 'Backend Engineer',
    开始: '2021-07',
    结束: null,
    内容: '',
    隐藏: true,
  };

  /** 已补齐的物化经历（编辑页完成守卫放行后的形状：带 canonical 行业引用）。 */
  const 已补齐经历: 简历经历段 = {
    ...未完成经历,
    编号: 'prefill:exp:1',
    行业引用: { id: 'tax_aaaaaaaaaaaaaaaaaaaaaaaaaa', display_name: 'Software' },
  };

  /** 未完成的物化附加教育（学校/专业只留 source_name 文本，无 canonical 引用）。 */
  const 未完成教育 = {
    编号: 'prefill:edu:1',
    学校: 'Example Graduate School',
    学历: '硕士',
    专业: 'Distributed Systems',
    开始: '2021-09',
    结束: '',
  };

  it('物化经历/教育未完成与证书空名称都计入，与取工作页预填的物化计数同口径', () => {
    expect(数未完成项([未完成经历], [], [])).toBe(1);
    expect(数未完成项([], [未完成教育], [])).toBe(1);
    expect(数未完成项([], [], [{ 编号: 'prefill:cer:0', 名称: '', 年份: '' }])).toBe(1);
    expect(
      数未完成项([未完成经历, 已补齐经历], [未完成教育], [{ 编号: 'prefill:cer:0', 名称: '', 年份: '' }]),
    ).toBe(3);
  });

  it('补齐后的物化条目不再计数（保存点击实时归零，不用挂载时冻结值）', () => {
    expect(数未完成项([已补齐经历], [], [{ 编号: 'prefill:cer:0', 名称: 'CPA', 年份: '' }])).toBe(0);
  });

  it('删除物化条目后清零', () => {
    expect(数未完成项([], [], [])).toBe(0);
  });

  it('用户自建条目（无 prefill: 前缀）不计数', () => {
    // Mock 分支下用户自建的未完成经历/教育/证书不在预填守卫的职责内
    expect(数未完成项(
      [{ ...未完成经历, 编号: 'e1' }],
      [{ ...未完成教育, 编号: 'edu1' }],
      [{ 编号: 'c1', 名称: '', 年份: '' }],
    )).toBe(0);
  });
});

describe('取个人优势预填', () => {
  it('偏好段空白时种入 summary', () => {
    const state = readyState(wire建议());
    expect(取个人优势预填(state, '偏好段' as 向导段, '')).toBe('Builds reliable synthetic systems.');
  });

  it('薪资段不应用 summary（社招首次薪资段）', () => {
    const state = readyState(wire建议());
    expect(取个人优势预填(state, '薪资段' as 向导段, '')).toBe('');
  });

  it('当前已有个人优势时保留', () => {
    const state = readyState(wire建议());
    expect(取个人优势预填(state, '偏好段' as 向导段, '我自己的介绍')).toBe('我自己的介绍');
  });

  it('summary 缺席、eligibility 关闭或已确认时保留当前值', () => {
    const 缺席 = readyState(映射变体((建议) => {
      建议.draft.summary = { value: null, confidence: null };
    }));
    expect(取个人优势预填(缺席, '偏好段' as 向导段, '')).toBe('');

    const 关闭 = readyState(wire建议(), { summary: false });
    expect(取个人优势预填(关闭, '偏好段' as 向导段, '')).toBe('');

    const 已确认 = readyState(wire建议());
    已确认.confirmed.summary = true;
    expect(取个人优势预填(已确认, '偏好段' as 向导段, '')).toBe('');
  });
});

// ── S：Backend 个人优势的「恢复建议」来源 —— 只认当前轮 ready/eligible/未确认的真实
//    summary 文本，其余（含 Mock 种子）一律 null，页面据此不渲染恢复按钮 ──
describe('取可恢复个人优势建议', () => {
  it('ready + eligible + 未确认 + 非空 → 返回当前轮真实建议', () => {
    expect(取可恢复个人优势建议(readyState(wire建议()), '偏好段' as 向导段))
      .toBe('Builds reliable synthetic systems.');
  });

  it('非偏好段 → null（社招首次薪资段不恢复）', () => {
    expect(取可恢复个人优势建议(readyState(wire建议()), '薪资段' as 向导段)).toBeNull();
  });

  it.each(['manual', 'loading', 'failed', 'inactive'] as const)('%s 轮 → null', (阶段) => {
    const state = readyState(wire建议());
    state.phase = 阶段;
    expect(取可恢复个人优势建议(state, '偏好段' as 向导段)).toBeNull();
  });

  it('summary 已确认 → null', () => {
    const state = readyState(wire建议());
    state.confirmed.summary = true;
    expect(取可恢复个人优势建议(state, '偏好段' as 向导段)).toBeNull();
  });

  it('eligibility.summary 关闭 → null', () => {
    expect(取可恢复个人优势建议(readyState(wire建议(), { summary: false }), '偏好段' as 向导段)).toBeNull();
  });

  it('空建议文本 → null', () => {
    const 空白 = readyState(映射变体((建议) => {
      建议.draft.summary = { value: '   ', confidence: 'medium' };
    }));
    expect(取可恢复个人优势建议(空白, '偏好段' as 向导段)).toBeNull();
  });
});
