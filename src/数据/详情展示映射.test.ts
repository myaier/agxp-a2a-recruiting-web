// 详情展示映射 · 纯投影表测：P5 详情正常视图 → 顶栏信息 / 状态区信息 / 阶段分段
// （纯函数、无 I/O、无 React）。顶栏钉住两端口径（求职端标题/副标题沿用接线前口径；
// 招聘端遵守去名裁定，画像位置全保留、字段全 null，岗位上下文单独承载冻结职位）。
// Task 2 起补状态区与分段投影：徽标只由权威布尔投影、段态来自阶段区自身 state、
// 段内顺序固定 S0 记录 → 旧时间线 → 叮嘱回执、候选私有总结不出招聘端、
// 「默认展开」只标有动作的合法当前段（raw stage），分段绝不携带命令。

import { describe, expect, it } from 'vitest';
import {
  从P5到详情分段, 从P5到详情状态, 从P5到详情顶栏, 从P5到职位资料, 从职位摘要到资料, 从冻结职位到资料,
} from './详情展示映射';
import type { P5阶段, P5阶段区块视图, P5详情正常视图 } from './MatchCase展示映射';
import type { BFF安全职位资料 } from './BFF契约';
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
});

// ── 从P5到详情状态 / 从P5到详情分段（详情统一 Task 2 契约 B）──────────────────

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

describe('从P5到详情状态', () => {
  it('待办：徽标「需要你」，闭词状态/步骤/轮次原样保留', () => {
    expect(从P5到详情状态(正常视图())).toEqual({
      阶段: '匿名初筛',
      状态: '待处理',
      步骤: '等待人工决定是否继续',
      轮次: { 当前: 1, 预算: 3 },
      徽标: '需要你',
      注意说明: null,
    });
  });

  it('attention：owner-safe 说明原样带出，徽标退「需注意」，绝不显示「代理处理中」', () => {
    const 信息 = 从P5到详情状态(正常视图({
      待办: false,
      状态文案: '需注意',
      注意说明: 'AI 服务暂时不可用，本 Case 尚未继续',
    }));
    expect(信息.徽标).toBe('需注意');
    expect(信息.注意说明).toBe('AI 服务暂时不可用，本 Case 尚未继续');
  });

  it('无待办无注意：徽标「代理处理中」（进行中的语义）', () => {
    expect(从P5到详情状态(正常视图({ 待办: false })).徽标).toBe('代理处理中');
  });

  it('终局：只读态徽标退场（null），不是「处理中」', () => {
    expect(从P5到详情状态(正常视图({ 终局: true, 待办: false })).徽标).toBeNull();
  });

  it('轮次 0 是合法数值：原样投影，绝不当缺失吞掉也不补 0', () => {
    expect(从P5到详情状态(正常视图({ 轮次: { 当前: 0, 预算: 3 } })).轮次).toEqual({ 当前: 0, 预算: 3 });
  });
});

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
});

describe('从P5到详情分段', () => {
  it('四阶段不缺段：S0→S3 顺序交付；颜色/排序/折叠键仍是共用阶段名，展示标题用 P5 区.标题', () => {
    const 分段 = 从P5到详情分段(分段视图(), 'anonymous_screening');
    expect(分段.map((段) => 段.阶段)).toEqual(['匿名初筛', '递交简历', '需要协调', '意向确认']);
    expect(分段.map((段) => 段.展示标题)).toEqual(['匿名初筛', '递交简历', '差异协同', '意向确认']);
  });

  it('S0 Agent 问答带「候选 Agent／招聘 Agent」标签，左右按 viewer；旧时间线落系统状态行；叮嘱不带标签', () => {
    const 分段 = 从P5到详情分段(分段视图({
      阶段区块: 四段({
        anonymous_screening: {
          // 时间线以系统状态行落段（J-PILOT-01，Spec §7 不投成对方气泡）；无文本事件跳过
          时间线: [
            { eventId: 'evt_1', stage: 'anonymous_screening', kind: 'supplementary_question', role: 'candidate', ref: 'prompt_1', text: '每周可以到岗几天？', occurredAt: '2026-08-29T01:10:00Z' },
            { eventId: 'evt_2', stage: 'anonymous_screening', kind: 'stage_note', role: '', reasonCode: 'policy_checked', occurredAt: '2026-08-29T01:20:00Z' },
          ],
          叮嘱: [
            { instructionId: 'aci_1', owner: 'candidate', stage: 'anonymous_screening', expression: '工作日联系', occurredAt: '2026-08-29T01:05:00Z' },
            { instructionId: 'aci_2', owner: 'recruiter', stage: 'anonymous_screening', expression: '两周内走完', occurredAt: '2026-08-29T01:06:00Z' },
          ],
          Agent消息: [
            { id: 's0q_1', kind: 'question', role: 'candidate', round: 1, answerStatus: null, occurredAt: '2026-08-23T10:01:00Z', 内容: '需要确认岗位的值班安排。' },
            { id: 's0a_1', kind: 'answer', role: 'recruiter', round: 1, answerStatus: 'answered', occurredAt: '2026-08-23T10:05:00Z', 内容: '没有固定晚班。' },
          ],
        },
      }),
    }), 'anonymous_screening');
    const 段 = 分段[0]!;
    // S0 记录：角色标签按 wire role 投影（不显示内部 ID/round/记录 ID），左右按 viewer
    expect(段.Agent对话).toEqual([
      { 编号: 's0:s0q_1', 角色: '候选 Agent', 方: '我方', 时间: 本地时分('2026-08-23T10:01:00Z'), 内容: '需要确认岗位的值班安排。' },
      { 编号: 's0:s0a_1', 角色: '招聘 Agent', 方: '对方', 时间: 本地时分('2026-08-23T10:05:00Z'), 内容: '没有固定晚班。' },
    ]);
    // 系统状态行：只带正文的文本事件，不投成对方气泡
    expect(段.系统消息).toEqual([{ 编号: 'evt:evt_1', 内容: '每周可以到岗几天？' }]);
    // 叮嘱回执按归属分列、不带角色标签（不伪装 Agent Q/A）
    expect(段.对话?.map((条) => [条.内容, 条.方])).toEqual([
      ['工作日联系', '我方'],
      ['两周内走完', '对方'],
    ]);
    expect(段.对话?.every((条) => 条.方 !== undefined)).toBe(true);
    expect(JSON.stringify(段.对话)).not.toContain('候选 Agent');
  });

  it('候选私有总结不进招聘端分段；候选端原样进小结托盘数据', () => {
    const 总结 = [{
      id: 'sum_1', phase: 'initial' as const, round: null,
      occurredAt: '2026-08-23T10:06:00Z', 标签: '初评', 内容: '初评确认岗位在浦东园区。',
    }];
    const 候选段 = 从P5到详情分段(
      分段视图({ 阶段区块: 四段({ anonymous_screening: { Agent总结: 总结 } }) }),
      'anonymous_screening',
    );
    expect(候选段[0]!.Agent总结).toEqual([{ 编号: 'sum_1', 标签: '初评', 内容: '初评确认岗位在浦东园区。' }]);

    const 招聘段 = 从P5到详情分段(
      分段视图({ role: 'recruiter', candidateAlias: 'hr-0123456789ab' }),
      'anonymous_screening',
    );
    // decoder 已保证招聘端总结恒空：空数组不给空托盘数据
    expect(招聘段[0]!.Agent总结).toBeUndefined();
  });

  it('未到达段保留折叠段与待推进说明：状态文/小结退场，不把将来阶段写成接口缺失', () => {
    const 待进 = 从P5到详情分段(分段视图(), 'anonymous_screening')[1]!;
    expect(待进.态).toBe('未到达');
    expect(待进.状态文 ?? null).toBeNull();
    expect(待进.小结 ?? null).toBeNull();
    expect(待进.待推进说明).toBe('未开始');
  });

  it('当前段的空态兜底是权威步骤说明（有中性说明，不造对话）', () => {
    const 分段 = 从P5到详情分段(分段视图(), 'anonymous_screening');
    expect(分段[0]!.空说明).toBe('等待人工决定是否继续');
    expect(分段[1]!.空说明).toBeUndefined();
  });

  it('动作段（passed）仍能展开：raw 当前段 + 有动作 → 默认展开；无动作或非当前段不标', () => {
    const passed区块 = 四段({ anonymous_screening: { 状态: 'passed', 摘要: '已通过' } });
    const 有动作 = 从P5到详情分段(分段视图({
      阶段区块: passed区块,
      actions: [{ action: 'accept_resume_invitation', 标题: '接受简历邀请', 说明: '同意披露简历并进入简历评估' }],
    }), 'anonymous_screening');
    expect(有动作[0]!.态).toBe('已完成');
    expect(有动作[0]!.默认展开).toBe(true);
    expect(有动作.slice(1).every((段) => 段.默认展开 === undefined)).toBe(true);

    const 无动作 = 从P5到详情分段(分段视图({ 阶段区块: passed区块, actions: [] }), 'anonymous_screening');
    expect(无动作.every((段) => 段.默认展开 === undefined)).toBe(true);
  });

  it('纯投影不含命令：分段不携带 尾部；附件只带文件名（PDF 回调归控制层）且常驻', () => {
    const 分段 = 从P5到详情分段(分段视图({
      actions: [{ action: 'respond_fact', 标题: '补充事实', 说明: '回答当前阶段待补充的问题' }],
      阶段区块: 四段({
        anonymous_screening: { 附件: { fileId: 'file_1', fileVersionId: 'fv_1', displayName: '后端工程师_简历_v1.pdf' } },
      }),
    }), 'anonymous_screening');
    expect(分段.every((段) => 段.尾部 === undefined)).toBe(true);
    expect(分段[0]!.附件).toEqual({ 文件名: '后端工程师_简历_v1.pdf' });
    expect(分段[0]!.附件常驻).toBe(true);
    // 清单照旧走「通过/核对中」二元结果
    const 清单段 = 从P5到详情分段(分段视图({
      阶段区块: 四段({ anonymous_screening: { 清单: [{ 文本: '简历已绑定', 完成: false }] } }),
    }), 'anonymous_screening');
    expect(清单段[0]!.核对清单).toEqual([{ 项: '简历已绑定', 结果: '核对中' }]);
  });
});
