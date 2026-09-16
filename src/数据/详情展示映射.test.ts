// 详情展示映射 · 纯投影表测：P5 详情正常视图 → 顶栏信息 / 阶段分段
// （纯函数、无 I/O、无 React）。顶栏钉住两端口径（求职端标题/副标题沿用接线前口径；
// 招聘端遵守去名裁定，画像位置全保留、字段全 null，岗位上下文单独承载冻结职位）。
// S0–S3 展示统一 Task 4 的分段投影：状态胶囊按 Spec §A.2.1（active 按权威待办分化）、
// 段内 记录 时序交错（总结/问答/流程事件/回执，同毫秒稳定源序）、S0 小结=阶段结论＋
// 公开资料匹配检查、结束原因/时间只入终局段、wire 词不进任何展示数据，分段绝不携带命令。

import { describe, expect, it } from 'vitest';
import {
  从P5到详情分段, 从P5到详情顶栏, 从P5到职位资料, 从职位摘要到资料, 从冻结职位到资料,
  投影冻结职位摘要, P5阶段共用名,
} from './详情展示映射';
import type { P5阶段, P5阶段区块视图, P5详情正常视图 } from './MatchCase展示映射';
import type { P5详情 } from './招聘数据源/MatchCase';
import type { 公开初评托盘视图 } from './连续代谈展示映射';
import type { BFF安全职位资料 } from './BFF契约';
import type { 在线简历展示资料 } from '../组件/在谈详情/类型';
import { BFF安全职位资料样本, BFF公司摘要样本 } from '../测试/展示资料样本';

const 别名 = 'candidate-0123456789ab';
const 意向ID = 'int_0123456789abcdef0123456789abcdef';

/** 最小正常视图：顶栏投影只读 role 与冻结职位三事实，其余字段与本投影无关。 */
function 正常视图(覆盖: Partial<P5详情正常视图> = {}): P5详情正常视图 {
  return {
    kind: '正常',
    caseId: 'mc_direct',
    role: 'candidate',
    职位: {
      jobId: 'job_0123456789abcdef0123456789abcdef',
      职位名: '平台工程师',
      城市: '上海',
      薪资带: '25-40K·16薪',
      技能: ['Go'],
    },
    intentionId: 意向ID,
    candidateAlias: null,
    阶段标题: '匿名初筛',
    状态文案: '待处理',
    步骤说明: '等待人工决定是否继续',
    轮次: { 当前: 1, 预算: 3 },
    待办: true,
    终局: false,
    详情终局: false,
    更新于: '2026-08-29T02:00:00Z',
    handoff: null,
    actions: [],
    阶段区块: [],
    终局摘要: null,
    注意说明: null,
    // Task 6：同一响应的权威分与冻结职位资料（旧 Case 合法 null 档）
    匹配分: null,
    冻结职位资料: null,
    // S0–S3 连续筛选（默认历史 Case：无待办、无发问块计数、无恢复窗口与固定总结）
    continuity版本: 1,
    待办们: [],
    对话进度: null,
    重新考虑: null,
    确认总结: null,
    ...覆盖,
  };
}

describe('从P5到详情顶栏', () => {
  it('求职端：标题 = 冻结职位名 · 公司信息缺失（公司槽原位保留），副标题 = 城市 · 薪资带，无画像，右侧无分数给 null', () => {
    const 顶栏 = 从P5到详情顶栏(正常视图());
    expect(顶栏).toEqual({
      端: '求职',
      标题: '平台工程师 · 公司信息缺失',
      副标题: '上海 · 25-40K·16薪',
      画像: null,
      右侧: { kind: '分数', 值: null },
      岗位上下文: null,
    });
    // 内部意向 ID 不进任何展示字段
    expect(JSON.stringify(顶栏)).not.toContain(意向ID);
  });

  it('招聘端：candidateAlias 不进顶栏（去名裁定），画像位置全保留、字段全 null，岗位上下文单独可读', () => {
    const 顶栏 = 从P5到详情顶栏(正常视图({ role: 'recruiter', candidateAlias: 别名 }));
    expect(顶栏).toEqual({
      端: '招聘',
      标题: null,
      副标题: null,
      画像: { 性别: null, 年限: null, 学历: null, 求职状态: null },
      右侧: { kind: '分数', 值: null },
      岗位上下文: '平台工程师 · 上海 · 25-40K·16薪',
    });
    // 别名一个字都不带出（不解析成身份，也不以「缺少姓名」占位恢复姓名区）
    expect(JSON.stringify(顶栏)).not.toContain(别名);
  });

  // Task 6：顶栏取同一响应的 match_score 与 job_detail 公司名（标题/分数/正文同源）
  it('冻结组织在场：求职端标题公司名用 job_detail 的 organization.display_name，右侧权威分原样', () => {
    const 顶栏 = 从P5到详情顶栏(正常视图({ 匹配分: 73, 冻结职位资料: BFF安全职位资料样本 }));
    expect(顶栏.标题).toBe('平台工程师 · 云衢科技');
    expect(顶栏.右侧).toEqual({ kind: '分数', 值: 73 });
  });

  it('真实 0 分照常带出；无溯源（null）与组织缺席保持既有未知口径，不外查分数', () => {
    const 零分 = 从P5到详情顶栏(正常视图({ 匹配分: 0 }));
    expect(零分.右侧).toEqual({ kind: '分数', 值: 0 });
    expect(零分.标题).toBe('平台工程师 · 公司信息缺失');
    const 无分 = 从P5到详情顶栏(正常视图({ 匹配分: null }));
    expect(无分.右侧).toEqual({ kind: '分数', 值: null });
    expect(无分.标题).toBe('平台工程师 · 公司信息缺失');
  });

  it('招聘端同样带权威分：岗位上下文不变，别名不因分数在场而泄漏', () => {
    const 顶栏 = 从P5到详情顶栏(
      正常视图({ role: 'recruiter', candidateAlias: 别名, 匹配分: 61, 冻结职位资料: BFF安全职位资料样本 }),
    );
    expect(顶栏.右侧).toEqual({ kind: '分数', 值: 61 });
    expect(顶栏.岗位上下文).toBe('平台工程师 · 上海 · 25-40K·16薪');
    expect(JSON.stringify(顶栏)).not.toContain(别名);
  });

  // ── S0–S3 展示统一 Task 5（Spec §5.3）：S3 沿用 Mock —— 标题只剩职位、右侧改岗位薪资 ──

  it('S3（意向确认是当前段）：标题职位、右侧岗位薪资、副标题公司 · 城市非空拼接，分数不上 S3', () => {
    const S3区块 = 四段({
      anonymous_screening: { 状态: 'passed' },
      resume_submission: { 状态: 'passed' },
      needs_coordination: { 状态: 'passed' },
      intent_confirmation: { 状态: 'active' },
    });
    const 顶栏 = 从P5到详情顶栏(正常视图({ 阶段区块: S3区块, 匹配分: 66 }));
    expect(顶栏).toEqual({
      端: '求职',
      标题: '平台工程师',
      副标题: '公司信息缺失 · 上海',
      画像: null,
      右侧: { kind: '薪资', 值: '25-40K·16薪' },
      岗位上下文: null,
    });
  });

  it('S3 顶栏与资料 Tab 同吃一份投影：摘要薪资缺失由同记录冻结三元组补位（20/30/month → 20-30K）', () => {
    const 冻结: BFF安全职位资料 = {
      ...BFF安全职位资料样本, salary_lower: 20, salary_upper: 30, salary_period: 'month',
    };
    const 顶栏 = 从P5到详情顶栏(正常视图({
      职位: { jobId: 'job_x', 职位名: '平台工程师', 城市: '上海', 薪资带: '', 技能: ['Go'] },
      冻结职位资料: 冻结,
      阶段区块: 四段({
        anonymous_screening: { 状态: 'passed' },
        intent_confirmation: { 状态: 'active' },
      }),
    }));
    expect(顶栏.右侧).toEqual({ kind: '薪资', 值: '20-30K' });
  });

  it('completed（全段已过、停在 S3）同为薪资顶栏；S3 无薪资事实给 null（顶栏显示 —，不造 0）', () => {
    const 全过 = 四段({
      anonymous_screening: { 状态: 'passed' },
      resume_submission: { 状态: 'passed' },
      needs_coordination: { 状态: 'passed' },
      intent_confirmation: { 状态: 'passed' },
    });
    const 完成 = 从P5到详情顶栏(正常视图({ 阶段区块: 全过, 匹配分: 66 }));
    expect(完成.右侧).toEqual({ kind: '薪资', 值: '25-40K·16薪' });
    const 无薪资 = 从P5到详情顶栏(正常视图({
      职位: { jobId: 'job_x', 职位名: '平台工程师', 城市: '上海', 薪资带: '', 技能: [] },
      阶段区块: 全过,
    }));
    expect(无薪资.右侧).toEqual({ kind: '薪资', 值: null });
  });

  it('S0–S2 副标题非空拼接无尾随分隔符：薪资全缺只留城市、城市也缺给 null；招聘端岗位上下文同规则', () => {
    const 缺薪资 = 从P5到详情顶栏(正常视图({
      职位: { jobId: 'job_x', 职位名: '平台工程师', 城市: '上海', 薪资带: '', 技能: [] },
    }));
    expect(缺薪资.副标题).toBe('上海');
    const 全缺 = 从P5到详情顶栏(正常视图({
      职位: { jobId: 'job_x', 职位名: '平台工程师', 城市: '', 薪资带: '', 技能: [] },
    }));
    expect(全缺.副标题).toBeNull();
    const 招聘端 = 从P5到详情顶栏(正常视图({
      role: 'recruiter',
      职位: { jobId: 'job_x', 职位名: '平台工程师', 城市: '上海', 薪资带: '', 技能: [] },
    }));
    expect(招聘端.岗位上下文).toBe('平台工程师 · 上海');
  });
});

// ── S0–S3 展示统一 Task 6（Spec §5.3/§7.2）：招聘端顶栏画像与在线简历正文同源 ——
//    同一响应 candidate_resume 的安全摘要/最近工作行，禁止 alias/真名进顶栏 ──

/** 与 从BFF到在线简历展示 的产出同形的安全摘要画像（合成数据）。 */
const 摘要画像资料: 在线简历展示资料 = {
  画像: { 性别: '女', 年限: '5 年', 学历: '本科', 求职状态: '在职看机会', 职位行: '示例公司 · 软件工程师' },
  个人优势: null,
  期望: null,
  工作: null,
  项目: null,
  教育: null,
  技能: null,
};

describe('从P5到详情顶栏 · 招聘端画像同源（Task 6）', () => {
  it('安全摘要在场：性别/年限/学历/求职状态进画像槽，最近工作行作副标题，岗位上下文不变', () => {
    const 顶栏 = 从P5到详情顶栏(
      正常视图({ role: 'recruiter', candidateAlias: 别名 }),
      摘要画像资料,
    );
    expect(顶栏.端).toBe('招聘');
    expect(顶栏.标题).toBeNull(); // 标题位不填真名/alias
    expect(顶栏.画像).toEqual({ 性别: '女', 年限: '5 年', 学历: '本科', 求职状态: '在职看机会' });
    expect(顶栏.副标题).toBe('示例公司 · 软件工程师');
    expect(顶栏.岗位上下文).toBe('平台工程师 · 上海 · 25-40K·16薪');
    // 摘要里的性别/状态是安全投影事实，alias 依旧一个字不带出
    expect(JSON.stringify(顶栏)).not.toContain(别名);
  });

  it('摘要缺失/画像 null：画像位置保留全 null、副标题 null（占位归展示层），与既有口径一致', () => {
    const 无资料 = 从P5到详情顶栏(正常视图({ role: 'recruiter', candidateAlias: 别名 }));
    expect(无资料.画像).toEqual({ 性别: null, 年限: null, 学历: null, 求职状态: null });
    expect(无资料.副标题).toBeNull();
    const 画像缺 = 从P5到详情顶栏(
      正常视图({ role: 'recruiter' }),
      { ...摘要画像资料, 画像: null },
    );
    expect(画像缺.画像).toEqual({ 性别: null, 年限: null, 学历: null, 求职状态: null });
    expect(画像缺.副标题).toBeNull();
  });

  it('合法有值变 null：同一投影对新响应重算，旧画像立即清空，不残留上一次摘要', () => {
    const 有值 = 从P5到详情顶栏(正常视图({ role: 'recruiter' }), 摘要画像资料);
    expect(有值.画像).toEqual({ 性别: '女', 年限: '5 年', 学历: '本科', 求职状态: '在职看机会' });
    const 变null = 从P5到详情顶栏(正常视图({ role: 'recruiter' }), null);
    expect(变null.画像).toEqual({ 性别: null, 年限: null, 学历: null, 求职状态: null });
    expect(变null.副标题).toBeNull();
  });

  it('求职端不受安全摘要影响：画像恒 null（顶栏走标题位），传不传摘要都一样', () => {
    const 求职端 = 从P5到详情顶栏(正常视图(), 摘要画像资料);
    expect(求职端.画像).toBeNull();
    expect(求职端.标题).toBe('平台工程师 · 公司信息缺失');
  });
});

// ── 从P5到详情分段（详情统一 Task 2 契约 B；S0–S3 展示统一 Task 4 按阶段重排）──────

/** S0 记录时间的期望值：与 mapper 同为本地时分，但各算各的（Date 本地 getter 独立推出）。 */
function 本地时分(原文: string): string {
  const 时刻 = new Date(原文);
  const 补 = (数: number) => String(数).padStart(2, '0');
  return `${补(时刻.getHours())}:${补(时刻.getMinutes())}`;
}

/** 单个阶段区块样本：typed 块字段齐备，单字段覆盖即可。 */
function 区块(stage: P5阶段, 覆盖: Partial<P5阶段区块视图> = {}): P5阶段区块视图 {
  const 基础: P5阶段区块视图 = {
    stage,
    标题: ({ anonymous_screening: '匿名初筛', resume_submission: '递交简历', needs_coordination: '差异协同', intent_confirmation: '意向确认' } as Record<P5阶段, string>)[stage],
    状态: stage === 'anonymous_screening' ? 'active' : 'pending',
    状态文案: stage === 'anonymous_screening' ? '进行中' : '未开始',
    发生于: stage === 'anonymous_screening' ? '2026-08-29T01:10:00Z' : null,
    摘要: stage === 'anonymous_screening' ? '系统正在复评候选信息' : '未开始',
    清单: [],
    时间线: [],
    叮嘱: [],
    附件: null,
    Agent消息: [],
    Agent总结: [],
  };
  return { ...基础, ...覆盖 };
}

/** 四阶段固定 S0→S3：S0 active，其余 pending（与 decode 后的真实 Case 同形）。 */
function 四段(覆盖: Partial<Record<P5阶段, Partial<P5阶段区块视图>>> = {}): P5阶段区块视图[] {
  const 序: P5阶段[] = ['anonymous_screening', 'resume_submission', 'needs_coordination', 'intent_confirmation'];
  return 序.map((stage) => 区块(stage, 覆盖[stage]));
}

function 分段视图(覆盖: Partial<P5详情正常视图> = {}): P5详情正常视图 {
  return { ...正常视图({ 阶段区块: 四段() }), ...覆盖 };
}

// ── 从P5到职位资料（详情统一 Task 3 契约 B）──────────────────────────────────

describe('从P5到职位资料', () => {
  it('P5 只保证摘要已知：分析/JD/要求/公司/对接人全是合法缺失，公司五元行恒在，接口说明是约定句', () => {
    expect(从P5到职位资料(正常视图())).toEqual({
      摘要: { 职位: '平台工程师', 城市: '上海', 薪资: '25-40K·16薪', 技能: ['Go'] },
      分析: { 分: null, 行们: null, 文案: null },
      职位详情: null,
      职位要求: null,
      公司: {
        名称: null,
        字标: null,
        简介: null,
        元行: [
          { 标签: '融资阶段', 值: null },
          { 标签: '规模', 值: null },
          { 标签: '行业', 值: null },
          { 标签: '成立', 值: null },
          { 标签: '地址', 值: null },
        ],
        标签: null,
      },
      对接人: { 姓名: null, 职务: null, 字标: null },
      接口缺口说明: '当前在谈详情数据未提供',
    });
  });

  it('招聘端同形：alias / 内部意向 ID 都不进资料区，不用公司文本或别处数据补值', () => {
    const 资料 = 从P5到职位资料(正常视图({ role: 'recruiter', candidateAlias: 别名 }));
    expect(资料.摘要?.职位).toBe('平台工程师');
    expect(资料.公司.名称).toBeNull();
    expect(资料.公司.元行.map((行) => 行.标签)).toEqual(['融资阶段', '规模', '行业', '成立', '地址']);
    const 全文 = JSON.stringify(资料);
    expect(全文).not.toContain(别名);
    expect(全文).not.toContain(意向ID);
  });

  // J-PILOT-01 Task 5：连续 pre-Case 详情（negotiation.job 只有职位三事实）与 Case 详情
  // 共用同一份「全缺失资料区」底座 —— 抽出的 从职位摘要到资料 是 从P5到职位资料 的唯一实现。
  it('从职位摘要到资料：同一份职位事实在两条详情路由产出完全相同的资料区', () => {
    const 职位 = { 职位: '平台工程师', 城市: '上海', 薪资: '25-40K·16薪', 技能: ['Go'] };
    expect(从职位摘要到资料(职位)).toEqual(从P5到职位资料(正常视图()));
  });

  // Task 6：视图携带冻结职位资料后，从P5到职位资料 消费同一响应的 job_detail（同源）
  it('从P5到职位资料：冻结快照在场时消费它，摘要仍用旧四事实；alias 不进资料区', () => {
    const 资料 = 从P5到职位资料(正常视图({ 冻结职位资料: BFF安全职位资料样本, 匹配分: 73 }));
    expect(资料.职位详情).toEqual(['参与产品工作']);
    expect(资料.公司.名称).toBe('云衢科技');
    expect(资料.公司.编号).toBe('org_1');
    expect(资料.分析.分).toBe(73);
    expect(资料.摘要).toEqual({ 职位: '平台工程师', 城市: '上海', 薪资: '25-40K·16薪', 技能: ['Go'] });
    expect(JSON.stringify(资料)).not.toContain(别名);
  });
});

// ── Task 6：Case 冻结职位资料（BFF安全职位资料）→ 资料区投影 ────────────────────────

describe('从冻结职位到资料', () => {
  const 摘要 = { 职位: 'AI 产品实习生', 城市: '上海', 薪资: '300-500 元/天', 技能: ['Python'] };

  it('新 Case 完整：JD/要求/公司/发布人/福利落既有原槽，接口缺口说明退场，权威分进分析槽', () => {
    expect(从冻结职位到资料({ 摘要, 冻结: BFF安全职位资料样本, 分: 73 })).toEqual({
      摘要,
      分析: { 分: 73, 行们: null, 文案: null },
      职位详情: ['参与产品工作'],
      职位要求: ['在校生'],
      公司: {
        名称: '云衢科技',
        字标: null, // 文字首字不冒充真实媒体：只有 Logo 在场才给图位输入
        图片URL: 'https://cdn.example.com/org_1/media_1.png',
        编号: 'org_1',
        简介: '做可靠的技术产品',
        元行: [
          { 标签: '融资阶段', 值: 'C 轮' },
          { 标签: '规模', 值: '500-1000 人' },
          { 标签: '行业', 值: '金融科技' },
          { 标签: '成立', 值: null }, // 公司成立时间本轮无源（Spec §9 延后项）
          { 标签: '地址', 值: '上海市张江路 1 号' }, // 公司地址；岗位办公地址（office_location）分开
        ],
        标签: ['五险一金', '股票期权'],
      },
      对接人: { 姓名: '林澈', 职务: '招聘负责人', 字标: null, 头像URL: null },
      接口缺口说明: null,
    });
  });

  it('旧 Case 双区 null：冻结缺席时沿用全缺失底座与缺口说明，不因 job_detail=null 抹去旧四事实', () => {
    expect(从冻结职位到资料({ 摘要, 冻结: null, 分: null })).toEqual({
      ...从职位摘要到资料(摘要),
      分析: { 分: null, 行们: null, 文案: null },
    });
    // 无溯源分数不造 0；有权威分时也只填分数槽，证据行/缺口说明照旧缺失
    expect(从冻结职位到资料({ 摘要, 冻结: null, 分: 73 }).分析).toEqual({ 分: 73, 行们: null, 文案: null });
    expect(从冻结职位到资料({ 摘要, 冻结: null, 分: 73 }).接口缺口说明).toBe('当前在谈详情数据未提供');
  });

  it('真实 0 分合法：分析分槽原样 0（组件按「有分无证据」给缺失说明，不画假环）', () => {
    expect(从冻结职位到资料({ 摘要, 冻结: null, 分: 0 }).分析.分).toBe(0);
  });

  it('JD/要求按行拆条：多行文本 trim 丢空行；空串 = 提供了但一条没有（暂无）；null = 缺失', () => {
    const 多行: BFF安全职位资料 = {
      ...BFF安全职位资料样本,
      description: '参与产品工作\r\n\n  维护需求池  ',
      requirements: '',
    };
    const 资料 = 从冻结职位到资料({ 摘要, 冻结: 多行, 分: null });
    expect(资料.职位详情).toEqual(['参与产品工作', '维护需求池']);
    expect(资料.职位要求).toEqual([]);
    const 缺失: BFF安全职位资料 = { ...BFF安全职位资料样本, description: null, requirements: null };
    expect(从冻结职位到资料({ 摘要, 冻结: 缺失, 分: null }).职位详情).toBeNull();
    expect(从冻结职位到资料({ 摘要, 冻结: 缺失, 分: null }).职位要求).toBeNull();
  });

  it('每成员可 null：组织/公司简介/福利/发布人缺席给未知；开放福利码不展示；空白文本按缺失', () => {
    const 缺源: BFF安全职位资料 = {
      ...BFF安全职位资料样本,
      organization: null,
      company_intro: '   ',
      benefit_codes: null,
      publisher_profile: null,
      office_address: '  ',
    };
    const 资料 = 从冻结职位到资料({ 摘要, 冻结: 缺源, 分: null });
    expect(资料.公司.名称).toBeNull();
    expect(资料.公司.编号).toBeNull();
    expect(资料.公司.图片URL).toBeNull();
    expect(资料.公司.简介).toBeNull();
    expect(资料.公司.元行.map((行) => 行.值)).toEqual([null, null, null, null, null]);
    expect(资料.公司.标签).toBeNull();
    expect(资料.对接人).toEqual({ 姓名: null, 职务: null, 字标: null, 头像URL: null });
    // 冻结快照在场：缺口说明退场（资料已提供），缺失槽由组件原位显示
    expect(资料.接口缺口说明).toBeNull();
  });

  it('开放 string 福利码只认闭合文案表：未知码丢弃，全未知收口为空数组（暂无）', () => {
    const 未知码: BFF安全职位资料 = {
      ...BFF安全职位资料样本,
      benefit_codes: ['social_insurance_housing_fund', 'not_a_benefit'],
    };
    expect(从冻结职位到资料({ 摘要, 冻结: 未知码, 分: null }).公司.标签).toEqual(['五险一金']);
    const 全未知: BFF安全职位资料 = { ...BFF安全职位资料样本, benefit_codes: ['nope'] };
    expect(从冻结职位到资料({ 摘要, 冻结: 全未知, 分: null }).公司.标签).toEqual([]);
  });

  it('组织摘要成员缺失时保留已知段：编号缺失（公司导航禁用坐标）与名称/媒体互不连坐', () => {
    const 缺编号: BFF安全职位资料 = {
      ...BFF安全职位资料样本,
      organization: { ...BFF公司摘要样本, organization_id: null },
    };
    const 资料 = 从冻结职位到资料({ 摘要, 冻结: 缺编号, 分: null });
    expect(资料.公司.编号).toBeNull(); // 无合法导航坐标
    expect(资料.公司.名称).toBe('云衢科技');
    expect(资料.公司.图片URL).toBe('https://cdn.example.com/org_1/media_1.png');
  });

  // S0–S3 展示统一 Task 5（Spec §6.2）：摘要先过 统一投影，顶栏与资料 Tab 一处有值处处有值
  it('资料 Tab 同投影：摘要薪资缺失由同一冻结三元组补位；原摘要有效成员不被顶替', () => {
    const 冻结: BFF安全职位资料 = {
      ...BFF安全职位资料样本, salary_lower: 20, salary_upper: 30, salary_period: 'month',
    };
    const 资料 = 从冻结职位到资料({
      摘要: { 职位: '平台工程师', 城市: '上海', 薪资: '', 技能: null },
      冻结,
      分: null,
    });
    expect(资料.摘要?.薪资).toBe('20-30K');
    expect(资料.摘要?.职位).toBe('平台工程师');
    expect(资料.摘要?.技能).toBeNull();
  });

  it('company_intro 三态：「""」是已知空（组件显示暂无），纯空白与 null 才是缺失 —— 非空清洗不吞已知空', () => {
    const 已知空 = 从冻结职位到资料({
      摘要, 冻结: { ...BFF安全职位资料样本, company_intro: '' }, 分: null,
    });
    expect(已知空.公司.简介).toBe('');
    expect(从冻结职位到资料({
      摘要, 冻结: { ...BFF安全职位资料样本, company_intro: null }, 分: null,
    }).公司.简介).toBeNull();
  });
});

// ── S0–S3 展示统一 Task 5：冻结职位统一投影（同一记录同一次响应，顶栏与 Tab 同吃一份）──

describe('投影冻结职位摘要', () => {
  /** 摘要原值可空段在生产两路都以空串进投影；冻结样本裁剪出结构化薪资三元组。 */
  const 空摘要 = { 职位: '', 城市: '', 薪资: '', 技能: null };
  const 冻结样本: BFF安全职位资料 = {
    ...BFF安全职位资料样本,
    salary_lower: 20,
    salary_upper: 30,
    salary_period: 'month',
  };

  it('public 非空优先：摘要有效成员原样保留，冻结 title/location/薪资一律不顶替', () => {
    const 摘要 = { 职位: '平台工程师', 城市: '上海', 薪资: '25-40K·16薪', 技能: ['Go'] };
    expect(投影冻结职位摘要(摘要, 冻结样本)).toEqual(摘要);
  });

  it('摘要缺项由同一冻结补位：title/location 补空；20/30/month → 既有简洁格式 20-30K', () => {
    expect(投影冻结职位摘要(空摘要, 冻结样本)).toEqual({
      职位: 'AI 产品实习生',
      城市: '上海',
      薪资: '20-30K',
      技能: null,
    });
  });

  it('day/hour 用既有单位文案：300/500/day → 300-500 元/天；40/60/hour → 40-60 元/时', () => {
    expect(投影冻结职位摘要(空摘要, {
      ...冻结样本, salary_lower: 300, salary_upper: 500, salary_period: 'day',
    }).薪资).toBe('300-500 元/天');
    expect(投影冻结职位摘要(空摘要, {
      ...冻结样本, salary_lower: 40, salary_upper: 60, salary_period: 'hour',
    }).薪资).toBe('40-60 元/时');
  });

  it('0 是合法界值不当 false：0/30/month → 0-30K；单值上下限相等沿用既有简洁单值 20/20/month → 20K', () => {
    expect(投影冻结职位摘要(空摘要, { ...冻结样本, salary_lower: 0 }).薪资).toBe('0-30K');
    expect(投影冻结职位摘要(空摘要, { ...冻结样本, salary_upper: 20 }).薪资).toBe('20K');
  });

  it('缺成员/缺周期/非法数字/倒置保持缺失：不补默认上下限、不猜周期、不算年薪乘月数', () => {
    expect(投影冻结职位摘要(空摘要, { ...冻结样本, salary_lower: null }).薪资).toBe('');
    expect(投影冻结职位摘要(空摘要, { ...冻结样本, salary_upper: null }).薪资).toBe('');
    expect(投影冻结职位摘要(空摘要, { ...冻结样本, salary_period: null }).薪资).toBe('');
    expect(投影冻结职位摘要(空摘要, { ...冻结样本, salary_lower: 30, salary_upper: 20 }).薪资).toBe('');
    expect(投影冻结职位摘要(空摘要, { ...冻结样本, salary_lower: Number.NaN }).薪资).toBe('');
    // 年薪月数在场也不参与：薪资投影只认 lower/upper/period 三元组
    expect(投影冻结职位摘要(空摘要, {
      ...冻结样本, salary_lower: null, salary_upper: null, salary_period: null, annual_salary_months: 16,
    }).薪资).toBe('');
  });

  it('冻结 null：摘要原值原样带出（缺口归缺口），绝不外查当前 Job 补历史', () => {
    const 摘要 = { 职位: '平台工程师', 城市: '', 薪资: '', 技能: null };
    expect(投影冻结职位摘要(摘要, null)).toEqual(摘要);
  });

  it('只缺 title/city：各成员独立判定，冻结只补缺失成员，薪资/技能原值不受影响', () => {
    const 摘要 = { 职位: '', 城市: '', 薪资: '300-500 元/天', 技能: ['Python'] };
    expect(投影冻结职位摘要(摘要, 冻结样本)).toEqual({
      职位: 'AI 产品实习生',
      城市: '上海',
      薪资: '300-500 元/天',
      技能: ['Python'],
    });
  });

  it('skills 只认摘要原值：冻结 keywords 在场也不冒充技能（null 未知与 [] 已知空都不被顶替）', () => {
    expect(投影冻结职位摘要(空摘要, { ...冻结样本, keywords: ['React', 'SQL'] }).技能).toBeNull();
    expect(投影冻结职位摘要(
      { 职位: '', 城市: '', 薪资: '', 技能: [] },
      { ...冻结样本, keywords: ['React'] },
    ).技能).toEqual([]);
  });

  it('两条记录异值不串：同一投影先后喂两份输入，各自产出自己的摘要', () => {
    const 甲 = 投影冻结职位摘要(空摘要, 冻结样本);
    const 乙 = 投影冻结职位摘要(
      { 职位: '数据工程师', 城市: '北京', 薪资: '', 技能: [] },
      {
        ...冻结样本,
        title: '数据工程师',
        location: { id: 'loc_bj', display_name: '北京' },
        salary_lower: 40,
        salary_upper: 60,
      },
    );
    expect(甲).toEqual({ 职位: 'AI 产品实习生', 城市: '上海', 薪资: '20-30K', 技能: null });
    expect(乙).toEqual({ 职位: '数据工程师', 城市: '北京', 薪资: '40-60K', 技能: [] });
  });
});

// ── 从P5到详情分段 · 夹具（S0–S3 展示统一 Task 4 的去标识化等价样本）──────────────

/** 最小已解码 P5详情（候选）：从P5到详情分段 只读 state.stage / state.lifecycle。 */
function 详情DTO(覆盖: {
  stage?: P5详情['state']['stage'];
  lifecycle?: P5详情['state']['lifecycle'];
  intentConfirmations?: P5详情['intentConfirmations'];
} = {}): P5详情 {
  return {
    role: 'candidate',
    context: {
      intentionId: 'int_0123456789abcdef0123456789abcdef',
      job: {
        jobId: 'job_0123456789abcdef0123456789abcdef',
        job: { title: '平台工程师', location: '上海', publicSalaryRange: '25-40K·16薪', requiredSkills: ['Go'] },
      },
    },
    state: {
      caseId: 'mc_direct',
      lifecycle: 覆盖.lifecycle ?? 'open',
      stage: 覆盖.stage ?? 'anonymous_screening',
      status: 'running', step: 'candidate_reevaluation', round: 1, roundBudget: 3,
      needsUser: false, outcome: null, outcomeCode: null,
      createdAt: '2026-08-29T01:00:00Z', updatedAt: '2026-08-29T02:00:00Z', finalizedAt: null,
      agentAttention: null,
    },
    needsAction: false,
    availableActions: [],
    stages: [],
    currentCoordination: null,
    intentConfirmations: 覆盖.intentConfirmations ?? { candidate: '', recruiter: '' },
    terminalSummary: null,
    conversationRef: null,
    matchScore: null,
    jobDetail: null,
    continuityVersion: 2,
    pendingActions: [],
    dialogueProgress: null,
    reconsideration: null,
    confirmationSummary: null,
  };
}

/** 公开初评（Task 4 新契约：决定文 + 中文核对项；英文 summary/wire code 不再产出）。 */
function 初评视图(覆盖: Partial<公开初评托盘视图> = {}): 公开初评托盘视图 {
  return {
    编号: 'ev_pub_1',
    决定文: '公开初评匹配',
    核对清单: [
      { 项: '招聘类型：匹配', 结果: '通过' },
      { 项: '薪资条件：暂无法比较', 结果: '待确认' },
    ],
    ...覆盖,
  };
}

describe('从P5到详情分段', () => {
  it('四阶段不缺段：S0→S3 顺序交付；颜色/排序/折叠键仍是共用阶段名，展示标题用 P5 区.标题', () => {
    const 分段 = 从P5到详情分段(分段视图(), 详情DTO(), null);
    expect(分段.map((段) => 段.阶段)).toEqual(['匿名初筛', '递交简历', '需要协调', '意向确认']);
    expect(分段.map((段) => 段.展示标题)).toEqual(['匿名初筛', '递交简历', '差异协同', '意向确认']);
    expect(P5阶段共用名('needs_coordination')).toBe('需要协调');
  });

  // ── 主样本（Spec 附录 A.7 的去标识化等价）：S0 passed（初评/复评两条 + 问答），
  //    记录混装 S1 两条消息；S1 ended semantic_not_fit；S2/S3 pending；公开初评 fit；
  //    恢复窗口在场但候选零动作 ──
  function 主样本视图(): P5详情正常视图 {
    return 分段视图({
      role: 'candidate',
      阶段区块: 四段({
        anonymous_screening: {
          状态: 'passed', 状态文案: '已通过', 摘要: '本阶段已完成',
          清单: [{ 文本: '匿名初筛已通过', 完成: true }],
          时间线: [
            { eventId: 'evt_a', stage: 'anonymous_screening', kind: 'decision_continue', role: '', occurredAt: '2026-08-23T10:07:00Z' },
            { eventId: 'evt_b', stage: 'anonymous_screening', kind: 'case_advanced', role: '', occurredAt: '2026-08-23T10:08:00Z' },
          ],
          Agent总结: [
            { id: 'sum_i', phase: 'initial', round: null, occurredAt: '2026-08-23T10:00:34Z', 标签: '初评', 内容: '公开资料看岗位方向一致。' },
            { id: 'sum_r', phase: 'reevaluation', round: 1, occurredAt: '2026-08-23T10:05:10Z', 标签: '第 1 轮复评', 内容: '补充回答后仍无冲突。' },
          ],
          Agent消息: [
            { id: 'q_1', kind: 'question', role: 'candidate', stage: 'anonymous_screening', askingRole: 'candidate', round: 1, answerStatus: null, answerSource: null, exchangeRef: null, occurredAt: '2026-08-23T10:01:47Z', 内容: '需要确认岗位的值班安排。' },
            { id: 'a_1', kind: 'answer', role: 'recruiter', stage: 'anonymous_screening', askingRole: 'candidate', round: 1, answerStatus: 'answered', answerSource: 'agent', exchangeRef: null, occurredAt: '2026-08-23T10:03:57Z', 内容: '没有固定晚班。' },
          ],
        },
        resume_submission: {
          状态: 'ended', 状态文案: '不匹配', 摘要: '本阶段已完成',
          清单: [
            { 文本: '简历已绑定', 完成: true },
            { 文本: '简历已解析', 完成: true },
            { 文本: '简历初筛未通过', 完成: false },
          ],
          附件: { fileId: 'rf_00000000000000000000000000000001', fileVersionId: 'rfv_00000000000000000000000000000001', displayName: '简历_样本_v1.pdf' },
          Agent消息: [
            { id: 'q_s1', kind: 'question', role: 'recruiter', stage: 'resume_submission', askingRole: 'recruiter', round: 1, answerStatus: null, answerSource: null, exchangeRef: null, occurredAt: '2026-08-24T10:01:00Z', 内容: '请说明你在产品迭代中的职责。' },
            { id: 'a_s1', kind: 'answer', role: 'candidate', stage: 'resume_submission', askingRole: 'recruiter', round: 1, answerStatus: 'unknown', answerSource: 'agent', exchangeRef: null, occurredAt: '2026-08-24T10:02:00Z', 内容: '暂时无法回答' },
          ],
        },
      }),
      终局摘要: { 结束语: '不匹配', 原因: '本阶段评估不匹配，代谈已结束', 定格于: '2026-08-29 11:00' },
      重新考虑: { 可恢复: true, deadline: '2026-09-05T03:00:00Z', 截止于: '2026-09-05 11:00', 说明: '招聘方可在 2026-09-05 11:00 前重新考虑这一单' },
    });
  }

  const 主样本详情 = 详情DTO({ stage: 'resume_submission', lifecycle: 'ended' });

  it('主样本：状态胶囊三分 —— S0 已通过、S1 不匹配、S2/S3 未开始；结束信息只入 S1 段', () => {
    const 分段 = 从P5到详情分段(主样本视图(), 主样本详情, 初评视图());
    expect(分段.map((段) => 段.状态文 ?? null)).toEqual(['已通过', '不匹配', null, null]);
    expect(分段.map((段) => 段.态)).toEqual(['已完成', '已结束', '未到达', '未到达']);
    expect(分段[2]!.待推进说明).toBe('未开始');
    expect(分段[3]!.待推进说明).toBe('未开始');
    // 结束原因/时间/恢复窗口只入实际结束段（S1），不回灌 S0，也不再有顶部终局卡数据
    expect(分段[1]!.小结).toBe('本阶段评估不匹配，代谈已结束');
    expect(分段[1]!.小结行们).toEqual([
      '结束时间：2026-08-29 11:00',
      '招聘方可在 2026-09-05 11:00 前重新考虑这一单',
    ]);
    expect(分段[0]!.小结行们).toEqual([`公开资料匹配检查：${初评视图().决定文}`]);
    expect(分段[2]!.小结).toBeNull();
    expect(分段[2]!.小结行们).toBeUndefined();
  });

  it('主样本：S0 段内时序 初评→问→答→复评→继续注释，逐条恰好一次；S1 消息不留在 S0', () => {
    const 分段 = 从P5到详情分段(主样本视图(), 主样本详情, 初评视图());
    const S0记录 = 分段[0]!.记录 ?? [];
    expect(S0记录.map((条) => (条.kind === '注释' && 条.标签 !== null ? `${条.标签}｜${条.内容}` : 条.内容))).toEqual([
      `初评｜公开资料看岗位方向一致。`,
      '需要确认岗位的值班安排。',
      '没有固定晚班。',
      '第 1 轮复评｜补充回答后仍无冲突。',
      '双方选择继续这一单', // 有效流程事件；无正文的 case_advanced 不落段
    ]);
    expect(S0记录.filter((条) => 条.kind === '气泡')).toHaveLength(2);
    // 消息归实际 stage：S1 的两条问答落在 S1 段的时序里，S0 段不见踪影
    const S1记录 = 分段[1]!.记录 ?? [];
    expect(S1记录.map((条) => (条.kind === '气泡' ? 条.内容 : ''))).toEqual([
      '请说明你在产品迭代中的职责。',
      '暂时无法回答',
    ]);
    expect(JSON.stringify(S0记录)).not.toContain('请说明你在产品迭代中的职责');
    // 灰色注释是候选私有总结：分段数据只走时序注释，不再有托盘第二份或英文 phase 标签
    expect(JSON.stringify(分段)).not.toContain('initial');
    expect(JSON.stringify(分段)).not.toContain('reevaluation');
  });

  it('主样本：全量展示数据只讲中文 —— wire 决定/终局/流程词一律不进分段', () => {
    const 全文 = JSON.stringify(从P5到详情分段(主样本视图(), 主样本详情, 初评视图()));
    for (const 词 of ['fit', 'semantic_not_fit', 'decision_continue', 'resume_submitted', 'case_advanced', 'user_ended']) {
      expect(全文).not.toContain(词);
    }
  });

  it('主样本：S0 小结=阶段结论＋公开资料匹配检查行＋中文核对项；S1 清单 done=false 为未完成', () => {
    const 分段 = 从P5到详情分段(主样本视图(), 主样本详情, 初评视图());
    expect(分段[0]!.小结).toBe('匿名初筛已通过');
    // S0 核对项 = 公开资料匹配检查的中文证据打头，其后是本段自身 checklist
    expect(分段[0]!.核对清单).toEqual([
      { 项: '招聘类型：匹配', 结果: '通过' },
      { 项: '薪资条件：暂无法比较', 结果: '待确认' },
      { 项: '匿名初筛已通过', 结果: '通过' },
    ]);
    // S1 核对项只反映自身段状态：done=true 通过、done=false 在终局段是未完成（不是核对中）
    expect(分段[1]!.核对清单).toEqual([
      { 项: '简历已绑定', 结果: '通过' },
      { 项: '简历已解析', 结果: '通过' },
      { 项: '简历初筛未通过', 结果: '未完成' },
    ]);
  });

  it('主样本：S1 附件常驻独立行；分段仍是纯投影（不携带 尾部/展开命令）', () => {
    const 分段 = 从P5到详情分段(主样本视图(), 主样本详情, 初评视图());
    expect(分段[1]!.附件).toEqual({ 文件名: '简历_样本_v1.pdf' });
    expect(分段[1]!.附件常驻).toBe(true);
    expect(分段.every((段) => 段.尾部 === undefined && 段.切展开 === undefined && 段.展开状态 === undefined)).toBe(true);
    expect(分段.every((段) => 段.默认展开 === undefined && 段.对话 === undefined)).toBe(true);
  });

  it('同毫秒按来源遍历序稳定（总结先于消息）；同一来源按稳定 ID 去重；缺失/非法时间排在有效时间之后', () => {
    const 分段 = 从P5到详情分段(分段视图({
      阶段区块: 四段({
        anonymous_screening: {
          状态: 'active',
          时间线: [
            { eventId: 'evt_ok', stage: 'anonymous_screening', kind: 'case_created', role: '', occurredAt: '2026-08-23T10:00:00Z' },
            { eventId: 'evt_bad', stage: 'anonymous_screening', kind: 'resume_submitted', role: '', occurredAt: 'not-a-time' },
          ],
          Agent总结: [
            { id: 'sum_t', phase: 'initial', round: null, occurredAt: '2026-08-23T10:00:00Z', 标签: '初评', 内容: '同一毫秒的初评。' },
          ],
          Agent消息: [
            { id: 'q_t', kind: 'question', role: 'candidate', stage: 'anonymous_screening', askingRole: 'candidate', round: 1, answerStatus: null, answerSource: null, exchangeRef: null, occurredAt: '2026-08-23T10:00:00Z', 内容: '同一毫秒的问题。' },
            { id: 'q_t', kind: 'question', role: 'candidate', stage: 'anonymous_screening', askingRole: 'candidate', round: 1, answerStatus: null, answerSource: null, exchangeRef: null, occurredAt: '2026-08-23T10:00:00Z', 内容: '同一毫秒的问题。' },
          ],
        },
      }),
    }), 详情DTO(), null);
    const 序 = (分段[0]!.记录 ?? []).map((条) => (条.kind === '注释' ? `注:${条.内容}` : `泡:${条.内容}`));
    expect(序).toEqual([
      '注:同一毫秒的初评。', // 同毫秒：总结（源序 0）稳定先于消息（源序 1）
      '泡:同一毫秒的问题。', // 同 ID 只出一次（轮询整包替换不产生双份）
      '注:开始代谈',
      '注:已递交简历', // 非法时间：保持遍历序，排在全部有效时间之后，不造当前时刻
    ]);
  });

  it('active 段状态胶囊按权威待办分化：本人待办=需要你、对端待办=等待对方、无待办=进行中', () => {
    const 待办 = (role: 'candidate' | 'recruiter', purpose: 's0_continue' | 's1_continue') => ({
      id: `cpa_${role}_${purpose}`, role, purpose,
      deadline: '2026-09-01T12:00:00Z', 截止于: '2026-09-01 20:00',
      说明: '', 到期说明: '逾期未回应，这一单会自动结束', exchangeRef: null, summaryVersion: null,
    });
    const 基础区块 = 四段({ anonymous_screening: { 状态: 'active', 状态文案: '进行中' } });
    const 本人 = 从P5到详情分段(分段视图({
      role: 'candidate', 阶段区块: 基础区块, 待办们: [待办('candidate', 's0_continue')],
    }), 详情DTO({ stage: 'anonymous_screening' }), null);
    expect(本人[0]!.状态文).toBe('需要你');
    const 对端 = 从P5到详情分段(分段视图({
      role: 'candidate', 阶段区块: 基础区块, 待办们: [待办('recruiter', 's1_continue')],
    }), 详情DTO(), null);
    expect(对端[0]!.状态文).toBe('进行中'); // S1 的待办不冒充 S0 的状态（不串段）
    const S1对端 = 从P5到详情分段(分段视图({
      role: 'candidate',
      阶段区块: 四段({ resume_submission: { 状态: 'active', 状态文案: '进行中' } }),
      待办们: [待办('recruiter', 's1_continue')],
    }), 详情DTO({ stage: 'resume_submission' }), null);
    expect(S1对端[1]!.状态文).toBe('等待对方');
    const 无待办 = 从P5到详情分段(分段视图({ 阶段区块: 基础区块 }), 详情DTO(), null);
    expect(无待办[0]!.状态文).toBe('进行中');
  });

  it('S3 胶囊：completed（双方确认完成事实）为已确认；仅到 S3 尚未双确认不得称已确认', () => {
    const S3passed = 四段({
      anonymous_screening: { 状态: 'passed', 状态文案: '已通过', 摘要: '' },
      resume_submission: { 状态: 'passed', 状态文案: '已通过', 摘要: '' },
      needs_coordination: { 状态: 'passed', 状态文案: '已通过', 摘要: '' },
      intent_confirmation: { 状态: 'passed', 状态文案: '已通过', 摘要: '' },
    });
    const 完成 = 从P5到详情分段(分段视图({
      阶段区块: S3passed, 终局: true, 待办: false,
    }), 详情DTO({ stage: 'intent_confirmation', lifecycle: 'completed' }), null);
    expect(完成[3]!.状态文).toBe('已确认');
    // 反例：S3 段自身 passed 但 Case 未完成（尚未双方确认）——保持已通过，不冒充已确认
    const 未完 = 从P5到详情分段(分段视图({ 阶段区块: S3passed }), 详情DTO({ stage: 'intent_confirmation' }), null);
    expect(未完[3]!.状态文).toBe('已通过');
  });

  it('招聘端：公开初评恒 null，S0 不出现公开资料匹配检查行；私有总结槽不再存在于分段', () => {
    const 分段 = 从P5到详情分段(
      分段视图({ role: 'recruiter', candidateAlias: 'candidate-0123456789ab' }),
      详情DTO(), null,
    );
    expect(分段[0]!.小结行们).toBeUndefined();
    expect(JSON.stringify(分段)).not.toContain('公开资料匹配检查');
  });

  it('段首说明只挂对得上的段：当前段带权威步骤说明，轮次 v2 读发问块记账、v1 读 round/预算（不写死 3）', () => {
    const v2 = 从P5到详情分段(分段视图({
      阶段区块: 四段({
        resume_submission: { 状态: 'active', 状态文案: '进行中' },
      }),
      对话进度: { stage: 'resume_submission', 轮次说明: '当前由招聘方发问，已问 1/3 轮' },
    }), 详情DTO({ stage: 'resume_submission' }), null);
    expect(v2[0]!.段首说明).toBeUndefined();
    expect(v2[1]!.段首说明).toEqual(['等待人工决定是否继续', '当前由招聘方发问，已问 1/3 轮']);
    const v1 = 从P5到详情分段(分段视图({ 轮次: { 当前: 2, 预算: 5 } }), 详情DTO({ stage: 'anonymous_screening' }), null);
    expect(v1[0]!.段首说明).toEqual(['等待人工决定是否继续', '轮次 2/5']);
    expect(v1[1]!.段首说明).toBeUndefined();
  });

  it('未到达段保留折叠段与待推进说明：状态文/小结退场、记录为空，不把将来阶段写成接口缺失', () => {
    const 待进 = 从P5到详情分段(分段视图(), 详情DTO(), null)[1]!;
    expect(待进.态).toBe('未到达');
    expect(待进.状态文 ?? null).toBeNull();
    expect(待进.小结 ?? null).toBeNull();
    expect(待进.待推进说明).toBe('未开始');
    expect(待进.记录).toEqual([]);
  });

  it('当前段的一句步骤说明进段首说明行（不在顶部堆叠）；注意说明落当前段小结行', () => {
    const 分段 = 从P5到详情分段(分段视图(), 详情DTO({ stage: 'anonymous_screening' }), null);
    expect(分段[0]!.段首说明).toContain('等待人工决定是否继续');
    expect(分段[1]!.段首说明).toBeUndefined();
    const 注意 = 从P5到详情分段(分段视图({
      注意说明: 'AI 服务暂时不可用，本 Case 尚未继续',
    }), 详情DTO({ stage: 'anonymous_screening' }), null);
    expect(注意[0]!.小结行们).toEqual(['AI 服务暂时不可用，本 Case 尚未继续']);
  });

  it('段内往来：气泡左右按 viewer、角色标签按 answer_source；正式回执仍以本人/代理身份落回时序', () => {
    const 分段 = 从P5到详情分段(分段视图({
      阶段区块: 四段({
        anonymous_screening: {
          状态: 'active',
          叮嘱: [
            { instructionId: 'aci_1', owner: 'candidate', stage: 'anonymous_screening', expression: '工作日联系', occurredAt: '2026-08-29T01:05:00Z' },
            { instructionId: 'aci_2', owner: 'recruiter', stage: 'anonymous_screening', expression: '', occurredAt: '2026-08-29T01:06:00Z' },
          ],
          Agent消息: [
            { id: 'a_h', kind: 'answer', role: 'recruiter', stage: 'anonymous_screening', askingRole: 'candidate', round: 1, answerStatus: 'answered', answerSource: 'human', exchangeRef: null, occurredAt: '2026-08-23T10:05:00Z', 内容: '由本人补答：可以。' },
          ],
        },
      }),
    }), 详情DTO({ stage: 'anonymous_screening' }), null);
    const 气泡们 = (分段[0]!.记录 ?? []).filter(
      (条): 条 is Extract<typeof 条, { kind: '气泡' }> => 条.kind === '气泡',
    );
    const 回执 = 气泡们.find((条) => 条.内容 === '工作日联系');
    expect(回执).toMatchObject({ 方: '我方', 角色: '', 时间: 本地时分('2026-08-29T01:05:00Z') });
    // 空正文回执不占位；human 回答带「招聘方本人」标签
    expect(气泡们.some((条) => 条.内容 === '')).toBe(false);
    const 本人答 = 气泡们.find((条) => 条.内容 === '由本人补答：可以。');
    expect(本人答?.角色).toBe('招聘方本人 · 第 1 轮');
  });
});
