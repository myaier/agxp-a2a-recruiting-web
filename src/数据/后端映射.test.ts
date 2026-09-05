import { describe, expect, it } from 'vitest';
import { 从BFF简历, 转资料写入, 转经历写入, 转教育写入, 从BFF岗位, 转岗位创建, 转岗位补丁, 转意向写入, 转首次意向写入, 从BFF意向草稿, 转证书写入, 转证书, 岗位办公方式到Wire, Wire到岗位办公方式 } from './后端映射';
import { BFF意向样本, BFF岗位样本, BFF简历样本, 页面岗位样本 } from '../测试/BFF样本';
import type { 意向草稿型, 岗位创建上下文 } from './招聘数据源类型';
import type { BFF证书, BFFOwnerJob, BFF简历 } from './BFF契约';
import { 取后端错误文案 } from './HTTP客户端';

/** 构造空草稿（含 Task 6 新增的 办公方式 字段），测试用展开覆盖个别字段 */
const 空草稿: 意向草稿型 = {
  编辑编号: null,
  求职类型: '全职',
  工作城市: '',
  工作城市引用: undefined,
  期望职位: '',
  职位引用: undefined,
  感兴趣城市们: [],
  感兴趣城市引用们: [],
  薪资下限: null,
  薪资上限: null,
  期望行业们: [],
  行业引用们: [],
  办公方式: [],
  后端招聘类型: null,
  求职类型已改: false,
};

/** 目录引用构造助手 */
function ref(id: string, display_name: string) {
  return { id, display_name };
}

/** P1C Task 5：Job 创建的显式 claim 输入（direct 直发 + 未认证声明起底） */
const 直接发岗上下文 = (display_name: string): 岗位创建上下文 => ({
  publisherMode: 'direct',
  hiringOrganizationClaim: { display_name, legal_name: null },
});

/** P0 修复 Task 4：JobCreate 的最小完整草稿 —— 目录引用齐备，描述与要求各自独立非空。
 *  Task 2：结构化要求确认是页面事实，Backend 发布必须显式勾选（Mock fixture 不带该字段）。 */
const 完整岗位草稿 = {
  ...页面岗位样本,
  类别引用: { id: 'tax_product', display_name: '产品经理' },
  地点引用: { id: 'loc_shanghai', display_name: '上海' },
  职位描述: '职位描述正文',
  职位要求: '职位要求正文',
  结构化要求已确认: true,
};

const 完整创建上下文 = 直接发岗上下文('星河科技');

/** 编辑态的服务端权威 owner DTO（claim 由服务端拥有，页面不可改） */
const 服务端岗位 = BFF岗位样本;

describe('候选人后端映射', () => {
  it('完整映射 profile 并保留四类条目的真实 ID', () => {
    const 页面 = 从BFF简历({
      profile: { real_name: '沈亦舟', work_start_year: 2021, status: 'employed', current_education: null, graduation_year: null, gender: 'male', birth_year: 1998, birth_month: 6 },
      profile_revision: 2, summary: '优势', summary_revision: 1, skills: ['TypeScript'], skills_revision: 3,
      experiences: [{ id: 'exp_1', company: '云衢', industry: { id: 'tax_i', display_name: '互联网' }, title: '工程师', start_month: '2021-01', end_month: null, description: '平台', hidden: true, internship: false, revision: 4, projects: [] }],
      educations: [{ id: 'edu_1', institution: { id: 'ins_1', display_name: '复旦大学' }, degree: '本科', major: { id: 'tax_m', display_name: '计算机科学' }, start_month: '2017-09', end_month: '2021-06', revision: 2 }],
      certificates: [{ id: 'cert_1', name: 'PMP', year: 2024, revision: 1 }], aggregate_revision: 9,
    });
    expect(页面.基本信息).toMatchObject({ 真名: '沈亦舟', 开始工作年: '2021', 身份: '在职', 性别: '男', 出生年: '1998', 出生月: '6' });
    expect(页面.经历[0].编号).toBe('exp_1');
    expect(页面.教育[0].编号).toBe('edu_1');
    expect(页面.证书[0].编号).toBe('cert_1');
    expect(页面.服务端快照.aggregate_revision).toBe(9);
    // BFF-hydrated 已有条目必须带上 owner DTO 的目录引用，写入时直接用引用.id，不再反查目录
    expect(页面.经历[0].行业引用).toEqual({ id: 'tax_i', display_name: '互联网' });
    expect(页面.教育[0].学校引用).toEqual({ id: 'ins_1', display_name: '复旦大学' });
    expect(页面.教育[0].专业引用).toEqual({ id: 'tax_m', display_name: '计算机科学' });
  });

  // Task 5：简历写入直接使用表单目录引用，不再按显示名反查目录。
  it('Education 直接使用选择时保存的 ID', () => {
    expect(转教育写入({
      编号: 'edu_local', 学校: '同名大学', 学校引用: { id: 'ins_cn', display_name: '同名大学' },
      专业: '计算机科学', 专业引用: { id: 'maj_cs', display_name: '计算机科学' },
      学历: '本科', 开始: '2020-09', 结束: '2024-06',
    })).toMatchObject({ institution_id: 'ins_cn', major_id: 'maj_cs' });
  });

  it('Experience 直接使用选择时保存的行业引用 ID', () => {
    expect(转经历写入({
      编号: 'exp_local', 公司: '云衢', 行业: '互联网', 行业引用: { id: 'tax_i', display_name: '互联网' },
      职位: '工程师', 开始: '2021-01', 结束: null, 内容: '平台', 隐藏: true,
    })).toMatchObject({ industry_id: 'tax_i' });
  });

  // Task 1：证书 year 是可空契约 —— 没填年份显式写 null，绝不编造年份；非法年份在客户端拒绝。
  it('证书没有取得年份时显式写 null，不编造年份', () => {
    expect(转证书写入({ 编号: 'local-1', 名称: 'CET-4', 年份: '' }))
      .toEqual({ name: 'CET-4', year: null });
  });

  it.each(['1899', '2101', '2024.5', '二零二四', 'NaN'])(
    '拒绝非法证书年份 %s',
    (年份) => {
      expect(() => 转证书写入({ 编号: 'local-1', 名称: 'PMP', 年份 }))
        .toThrow('证书年份必须是 1900 到 2100 之间的整数');
    },
  );

  it('证书有合法年份时写整数', () => {
    expect(转证书写入({ 编号: 'local-1', 名称: 'PMP', 年份: '2024' }))
      .toEqual({ name: 'PMP', year: 2024 });
  });

  it('权威 null 年份回读为空字符串', () => {
    expect(转证书({ id: 'cert-1', name: 'CET-4', year: null, revision: 1 }))
      .toEqual({ 编号: 'cert-1', 名称: 'CET-4', 年份: '' });
  });

  it('权威证书缺失 year 时按响应契约错误拒绝', () => {
    try {
      转证书({ id: 'cert-1', name: 'CET-4', revision: 1 } as BFF证书);
      expect.unreachable('缺失 year 必须失败');
    } catch (错误) {
      expect(错误).toMatchObject({ status: 200, code: 'invalid_response' });
    }
  });

  it('没有候选引用时抛出请从候选选择，不反查目录', () => {
    expect(() => 转教育写入({
      编号: 'edu_local', 学校: '手输学校', 学历: '本科', 专业: '计算机科学', 开始: '2020-09', 结束: '2024-06',
    })).toThrow('请从候选学校中选择');
    expect(() => 转经历写入({
      编号: 'exp_local', 公司: '云衢', 行业: '互联网', 职位: '工程师', 开始: '2021-01', 结束: null, 内容: '', 隐藏: false,
    })).toThrow('请从候选行业中选择');
  });

  it('把页面 profile 转成闭合后端 body', () => {
    expect(转资料写入({ 真名: '沈亦舟', 开始工作年: '2021', 身份: '离职', 性别: '男', 出生年: '1998', 出生月: '6' }))
      .toEqual({ real_name: '沈亦舟', work_start_year: 2021, status: 'unemployed', current_education: null, graduation_year: null, gender: 'male', birth_year: 1998, birth_month: 6 });
  });

  it('把后端岗位映射为现有页面模型', () => {
    expect(从BFF岗位(BFF岗位样本, { 加分关键词: ['课程项目'], 实习转正: true })).toMatchObject({
      编号: 'job_1', 名称: 'AI 产品实习生', 城市: '上海', 办公方式: '混合',
      招聘类型: '实习生', 职位类别: '产品经理', 职位关键词: ['Python'],
      // Task 7：owner DTO 的 category/location 同时落到 类别引用/地点引用，写入时直接用引用.id
      类别引用: { id: 'tax_product', display_name: '产品经理' },
      地点引用: { id: 'loc_shanghai', display_name: '上海' },
      加分关键词: ['课程项目'], 实习转正: true, 状态: '在招', 在谈数: 0,
    });
  });

  // ── 岗位办公方式闭合映射（backend 数据真相源 Task C）──
  // 页面 canonical 固定 现场/混合/全远程，wire 固定 onsite/hybrid/remote，
  // 读入与创建/补丁共用唯一一组双向映射；非法页值 fail closed，不再静默回退 onsite。
  it.each([
    ['onsite', '现场'],
    ['hybrid', '混合'],
    ['remote', '全远程'],
  ] as const)('%s 与 %s 双向闭合', (wire, page) => {
    expect(Wire到岗位办公方式(wire)).toBe(page);
    expect(岗位办公方式到Wire(page)).toBe(wire);
    expect(岗位办公方式到Wire(Wire到岗位办公方式(wire))).toBe(wire);
  });

  it('非法岗位办公方式 fail closed，不回退 onsite', () => {
    expect(() => 岗位办公方式到Wire('远程' as never))
      .toThrowError('未映射的岗位办公方式：远程');
  });

  // review-r1：`in` 会命中原型链 —— toString/constructor/__proto__ 必须当非法页值拒绝，
  // 不能把继承来的函数/对象当 wire code 发出去。hasOwnProperty 只认自有键。
  it.each(['toString', 'constructor', '__proto__'])('原型链键 %s 不是合法岗位办公方式', (键) => {
    expect(() => 岗位办公方式到Wire(键 as never))
      .toThrowError(`未映射的岗位办公方式：${键}`);
  });

  // 三态分别走完整 owner 读入 → 创建/补丁写回 round-trip（完整 DTO，不用稀疏对象）：
  // remote 修复前回显「远程」，补丁时会被旧表静默落成 onsite（丢事实），这里整链钉死。
  // 补丁是 sparse 语义：未变化缺省（服务端保持存储值），变化才携带映射后的 wire code。
  it.each([
    ['onsite', '现场'],
    ['hybrid', '混合'],
    ['remote', '全远程'],
  ] as const)('岗位 %s 读入 %s：创建发回原档，补丁未变化缺省、变化携带映射值', (wire, page) => {
    const dto = { ...BFF岗位样本, workplace_mode: wire };
    const 页面 = 从BFF岗位(dto, {});
    expect(页面.办公方式).toBe(page);
    expect(转岗位创建(页面, 直接发岗上下文('云衢科技')).workplace_mode).toBe(wire);
    // 与 previous 相同：sparse 补丁缺省 workplace_mode，服务端保持存储值
    expect(转岗位补丁(页面, dto)).not.toHaveProperty('workplace_mode');
    // 换成另一档：补丁携带闭合映射后的 wire code，绝不静默降级成 onsite
    const 换页 = wire === 'remote' ? '现场' : '全远程';
    const 换wire = wire === 'remote' ? 'onsite' : 'remote';
    expect(转岗位补丁({ ...页面岗位样本, ...页面, 办公方式: 换页 }, dto).workplace_mode).toBe(换wire);
  });

  // Task 7：岗位创建直接用选择器保存的 类别引用/地点引用 取 ID，不再按显示名反查目录。
  it('职位创建只发送 BFF 支持字段', () => {
    const body = 转岗位创建({
      ...页面岗位样本,
      类别引用: { id: 'tax_product', display_name: '产品经理' },
      地点引用: { id: 'loc_shanghai', display_name: '上海' },
      结构化要求已确认: true,
    }, 直接发岗上下文('云衢科技'));
    expect(body).toMatchObject({
      publisher_mode: 'direct', hiring_organization_claim: { display_name: '云衢科技', legal_name: null },
      title: 页面岗位样本.名称, category_id: 'tax_product', location_id: 'loc_shanghai',
      keywords: 页面岗位样本.职位关键词, private_screening_preferences: 页面岗位样本.筛选要求,
    });
    expect(body).not.toHaveProperty('加分关键词');
    expect(body).not.toHaveProperty('实习转正');
  });

  // P0 修复 Task 4：真实 BFF 的 JobCreate 要求公司声明 / 描述 / 要求 三条各自 trim 后非空。
  // 「requirements 为空就复用 description」的老回退已删 —— 两个字段必须独立。
  it('JobCreate 独立 trim 公司名、描述和要求，不互相复制', () => {
    const body = 转岗位创建(完整岗位草稿, {
      publisherMode: 'direct',
      hiringOrganizationClaim: { display_name: '  星河科技  ', legal_name: null },
    });
    expect(body).toMatchObject({
      hiring_organization_claim: { display_name: '星河科技', legal_name: null },
      description: '职位描述正文',
      requirements: '职位要求正文',
    });
  });

  it.each([
    ['职位描述', { 职位描述: '   ', 职位要求: '要求' }, 'description'],
    ['职位要求', { 职位描述: '描述', 职位要求: '   ' }, 'requirements'],
  ])('%s 为空时不生成 JobCreate', (_label, patch, field) => {
    try {
      转岗位创建({ ...完整岗位草稿, ...patch }, 完整创建上下文);
      expect.unreachable('空白文本必须拒绝');
    } catch (error) {
      expect(error).toMatchObject({ code: 'client_validation', field });
    }
  });

  it('公司声明为空时 mapper 不生成 JobCreate', () => {
    try {
      转岗位创建(完整岗位草稿, {
        publisherMode: 'direct',
        hiringOrganizationClaim: { display_name: '   ', legal_name: null },
      });
      expect.unreachable('空白公司声明必须拒绝');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'client_validation', field: 'hiring_organization_claim.display_name',
      });
    }
  });

  // Task 2：补丁收敛为 sparse diff —— 只发实际变化的可编辑字段（trim 后参与比较），
  // claim/title/type/refs 等 immutable 或服务端专有字段一律不再回传。
  it('JobPatch 保持两参 seam，只 trim 用户可编辑的描述和要求', () => {
    const body = 转岗位补丁(
      { ...完整岗位草稿, 职位描述: '  描述  ', 职位要求: '  要求  ' },
      服务端岗位,
    );
    expect(body).toEqual({
      description: '描述',
      requirements: '要求',
      structured_requirements_confirmed: true,
    });
  });

  // 全局约束：不可修复的历史 claim 绝不能挡住一次普通的 JD 编辑 ——
  // 补丁根本不带 claim（归服务端所有），previous 的历史空 claim 不影响保存。
  it('previous 的历史空 claim 不阻塞普通编辑保存', () => {
    const 空claim岗位 = {
      ...服务端岗位,
      hiring_organization_claim: { display_name: '', legal_name: null },
    };
    const body = 转岗位补丁(
      { ...完整岗位草稿, 职位描述: '改后的描述', 职位要求: '改后的要求' },
      空claim岗位,
    );
    // 不抛错，且补丁不含 claim（沿用 previous，不拿页面文本顶替、也不硬造一个值）
    expect(body).not.toHaveProperty('hiring_organization_claim');
    expect(body).toMatchObject({ description: '改后的描述', requirements: '改后的要求' });
  });

  // 补丁侧的描述/要求也走同一套非空保护（旧实现是 ?? ''，会把空串发给服务端）
  it.each([
    ['职位描述', { 职位描述: '   ', 职位要求: '要求' }, 'description'],
    ['职位要求', { 职位描述: '描述', 职位要求: '   ' }, 'requirements'],
  ])('%s 为空时不生成 JobPatch', (_label, patch, field) => {
    try {
      转岗位补丁({ ...完整岗位草稿, ...patch }, 服务端岗位);
      expect.unreachable('空白文本必须拒绝');
    } catch (error) {
      expect(error).toMatchObject({ code: 'client_validation', field });
    }
  });

  // P1C Task 5：创建/补丁 body 不得携带服务端专有 refs 与 verification status。
  it('岗位创建与补丁不携带 organization refs / verification status', () => {
    const 带引用 = {
      ...页面岗位样本,
      类别引用: { id: 'tax_product', display_name: '产品经理' },
      地点引用: { id: 'loc_shanghai', display_name: '上海' },
      结构化要求已确认: true,
    };
    expect(JSON.stringify(转岗位创建(带引用, 直接发岗上下文('云衢科技'))))
      .not.toMatch(/publisher_affiliation_ref|publisher_organization_ref|hiring_organization_ref|verification_status/);
    expect(JSON.stringify(转岗位补丁(带引用, BFF岗位样本)))
      .not.toMatch(/publisher_affiliation_ref|publisher_organization_ref|hiring_organization_ref|verification_status/);
  });

  // P1C Task 5：普通 JD 编辑不拿当前自由文本改 claim，补丁沿用 previous 的 mode 与 claim。
  // Task 2：sparse 之后「沿用」的含义就是这两类字段根本不进 body。
  it('岗位补丁沿用 previous.publisher_mode 与 previous.hiring_organization_claim', () => {
    const previous = {
      ...BFF岗位样本,
      publisher_mode: 'agency' as const,
      hiring_organization_claim: { display_name: '客户公司', legal_name: '客户公司有限公司' },
    };
    const body = 转岗位补丁({ ...页面岗位样本, 结构化要求已确认: true }, previous);
    expect(body).not.toHaveProperty('publisher_mode');
    expect(body).not.toHaveProperty('hiring_organization_claim');
  });

  it('经验要求按 BFF enum 映射，不静默降级为 none', () => {
    const 带引用 = {
      ...页面岗位样本,
      类别引用: { id: 'tax_product', display_name: '产品经理' },
      地点引用: { id: 'loc_shanghai', display_name: '上海' },
      结构化要求已确认: true,
    };
    // 页面岗位样本.经验要求 = '不限'；覆盖成 '3-5 年' 验证不被吞成 'none'
    const body = 转岗位创建({ ...带引用, 经验要求: '3-5 年' }, 直接发岗上下文('云衢科技'));
    expect(body.experience_requirement).toBe('three_to_five_years');
    // 不限 仍映射为 none
    expect(转岗位创建(带引用, 直接发岗上下文('云衢科技')).experience_requirement).toBe('none');
    // 未映射的页值（演示域「3 年以上」）必须抛错，不静默落成 'none'
    expect(() => 转岗位创建({ ...带引用, 经验要求: '3 年以上' }, 直接发岗上下文('云衢科技')))
      .toThrow('未映射的经验要求：3 年以上');
  });

  it('岗位创建使用选择时保存的类别和地点 ID', () => {
    const body = 转岗位创建({
      ...页面岗位样本,
      类别引用: { id: 'tax_backend', display_name: '后端开发' },
      地点引用: { id: 'loc_sh', display_name: '上海市' },
      结构化要求已确认: true,
    }, 直接发岗上下文('甲公司'));
    expect(body).toMatchObject({ category_id: 'tax_backend', location_id: 'loc_sh' });
  });

  // P3：hard_requirements 完整四员对象在 owner 读与创建/补丁写之间往返，不丢成员也不造默认值。
  // Task 2：补丁侧 sparse —— 块未变则整体省略，变了才整体发出。
  it('hard_requirements complete object round-trips through owner mapping and writes', () => {
    const dto = {
      ...BFF岗位样本,
      hard_requirements: {
        alternate_weekend_work: 'required' as const,
        outsourcing_only: 'not_required' as const,
        onsite_only: 'unknown' as const,
        frequent_travel: 'required' as const,
      },
    };
    const 页面 = 从BFF岗位(dto, {});
    expect(页面.硬性事实).toEqual({ 大小周: '必须', 纯外包乙方: '不要求', 全现场办公: '未说明', 频繁出差: '必须' });
    expect(转岗位创建(页面, 直接发岗上下文('Acme')).hard_requirements).toEqual(dto.hard_requirements);
    const 旧四员 = {
      alternate_weekend_work: 'unknown', outsourcing_only: 'unknown',
      onsite_only: 'unknown', frequent_travel: 'unknown',
    } as const;
    expect(转岗位补丁(页面, { ...dto, hard_requirements: 旧四员 }).hard_requirements)
      .toEqual(dto.hard_requirements);
  });

  // Task 5 起 在招岗位.硬性事实 必填（组装岗位恒带完整四员）：
  // 页面样本的四员在创建 body 里写成 hard_requirements，不许缺员；补丁只在实际变化时发。
  it('页面的硬性事实四员在创建与补丁 body 里都写 hard_requirements', () => {
    const 带引用 = {
      ...页面岗位样本,
      类别引用: { id: 'tax_product', display_name: '产品经理' },
      地点引用: { id: 'loc_shanghai', display_name: '上海' },
      结构化要求已确认: true,
    };
    const 样本wire四员 = {
      alternate_weekend_work: 'unknown',
      outsourcing_only: 'not_required',
      onsite_only: 'unknown',
      frequent_travel: 'unknown',
    } as const;
    expect(转岗位创建(带引用, 直接发岗上下文('云衢科技')).hard_requirements).toEqual(样本wire四员);
    // 与 previous 一致 → sparse 省略；只有一档不同 → 四员整体发出
    expect(转岗位补丁(带引用, BFF岗位样本)).not.toHaveProperty('hard_requirements');
    expect(转岗位补丁(带引用, { ...BFF岗位样本, hard_requirements: { ...样本wire四员, onsite_only: 'required' } }))
      .toMatchObject({ hard_requirements: 样本wire四员 });
  });

  it('已加载的校园/实习意向在用户没切招聘类型时保留原类型', () => {
    const 草稿: 意向草稿型 = {
      ...空草稿,
      编辑编号: BFF意向样本.intention_id, 求职类型: '全职', 工作城市: '上海', 期望职位: '产品经理',
      工作城市引用: ref('loc_shanghai', '上海'), 职位引用: ref('tax_product', '产品经理'),
      感兴趣城市们: [], 薪资下限: 10, 薪资上限: 20, 期望行业们: [],
      求职类型已改: false, 后端招聘类型: 'internship' as const,
      办公方式: ['混合'],
    };
    expect(转意向写入(草稿, { 原始: BFF意向样本 }).recruitment_type)
      .toBe('internship');
  });

  // F9：campus_cohort '不限'/空/非数字 → null，不再被 Number('') 误判成 0 届
  it('校园招聘 campus_cohort：不限/空/非数字 落 null，数字年份保留', () => {
    const 带引用 = {
      ...页面岗位样本,
      类别引用: { id: 'tax_product', display_name: '产品经理' },
      地点引用: { id: 'loc_shanghai', display_name: '上海' },
      结构化要求已确认: true,
    };
    expect(转岗位创建({ ...带引用, 招聘类型: '校园招聘', 届别: '不限' }, 直接发岗上下文('云衢科技')).campus_cohort).toBe(null);
    expect(转岗位创建({ ...带引用, 招聘类型: '校园招聘', 届别: undefined }, 直接发岗上下文('云衢科技')).campus_cohort).toBe(null);
    expect(转岗位创建({ ...带引用, 招聘类型: '校园招聘', 届别: '本周' }, 直接发岗上下文('云衢科技')).campus_cohort).toBe(null);
    expect(转岗位创建({ ...带引用, 招聘类型: '校园招聘', 届别: '2027 届' }, 直接发岗上下文('云衢科技')).campus_cohort).toBe(2027);
    // 补丁 sparse：数字→null 显式清除，null→数字 显式发出，未变化则省略
    const 校园previous = { ...BFF岗位样本, campus_cohort: 2027 };
    expect(转岗位补丁({ ...带引用, 招聘类型: '校园招聘', 届别: '不限' }, 校园previous).campus_cohort).toBe(null);
    expect(转岗位补丁({ ...带引用, 招聘类型: '校园招聘', 届别: '2027 届' }, BFF岗位样本).campus_cohort).toBe(2027);
    expect(转岗位补丁({ ...带引用, 招聘类型: '校园招聘', 届别: '2027 届' }, 校园previous))
      .not.toHaveProperty('campus_cohort');
  });

  // F4：办公方式 既接受中文标签（引导预填来源），也接受 wire code（已有意向快照来源）
  it('映射办公方式：中文标签与 wire code 都能映射，不再产出 [null]', () => {
    const 草稿 = {
      ...空草稿,
      求职类型: '全职' as const, 工作城市: '上海', 期望职位: '产品经理',
      工作城市引用: ref('loc_shanghai', '上海'), 职位引用: ref('tax_product', '产品经理'),
      感兴趣城市们: [], 薪资下限: 10, 薪资上限: 20, 期望行业们: [],
    };
    // 中文标签（引导预填来源）
    expect(转意向写入({ ...草稿, 办公方式: ['混合'] }, { 原始: null }).workplace_modes).toEqual(['hybrid']);
    expect(转意向写入({ ...草稿, 办公方式: ['现场', '全远程'] }, { 原始: null }).workplace_modes).toEqual(['onsite', 'remote']);
    // wire code（已有意向快照 workplace_modes 来源）—— 原来这里产出 [undefined] 被 BFF 拒
    expect(转意向写入({ ...草稿, 办公方式: ['hybrid'] }, { 原始: BFF意向样本 }).workplace_modes).toEqual(['hybrid']);
    expect(转意向写入({ ...草稿, 办公方式: ['onsite'] }, { 原始: BFF意向样本 }).workplace_modes).toEqual(['onsite']);
  });

  it('首次意向写入用向导答案的办公方式（中文标签），不再硬编码 onsite', () => {
    const 输入 = {
      职位们: ['产品经理'],
      城市们: ['上海'],
      薪资: { 下限: 10, 上限: 20, 单位: '月薪K' as const },
      筛选偏好: { 求职类型: ['社招全职'] as ['社招全职'], 办公方式: ['混合', '全远程'] as ['混合', '全远程'] },
      排除项: [],
      职位引用: ref('tax_product', '产品经理'),
      城市引用们: [ref('loc_shanghai', '上海')],
    };
    expect(转首次意向写入(输入).workplace_modes).toEqual(['hybrid', 'remote']);
  });

  // F6：编辑已有意向的草稿必须从完整 BFFOwnerIntention 重建，不能从稀疏列表条目拆回，
  // 否则打开+原样保存会清掉 alternate_locations / industries / 薪资结构 / 后端招聘类型。
  // Task 6：同时填充 目录选择值 引用与 办公方式（中文标签），保存时直接用引用.id。
  it('从BFF意向草稿 从完整 DTO 重建草稿，保留 alternate_locations/industries/薪资/招聘类型/refs/办公方式', () => {
    const dto = {
      ...BFF意向样本,
      recruitment_type: 'internship' as const,
      primary_location: { id: 'loc_shanghai', display_name: '上海' },
      job_category: { id: 'tax_product', display_name: '产品经理' },
      alternate_locations: [
        { id: 'loc_bj', display_name: '北京' },
        { id: 'loc_hz', display_name: '杭州' },
      ],
      industries: [
        { id: 'ind_fin', display_name: '金融' },
        { id: 'ind_ai', display_name: '人工智能' },
      ],
      workplace_modes: ['hybrid', 'remote'] as ('onsite' | 'hybrid' | 'remote')[],
      compensation: { mode: 'range' as const, lower: 300, upper: 500, annual_salary_months: null },
      salary_period: 'day' as const,
    };
    const 草稿 = 从BFF意向草稿(dto);
    expect(草稿).toEqual({
      编辑编号: dto.intention_id,
      求职类型: '全职',
      工作城市: '上海',
      工作城市引用: { id: 'loc_shanghai', display_name: '上海' },
      期望职位: '产品经理',
      职位引用: { id: 'tax_product', display_name: '产品经理' },
      感兴趣城市们: ['北京', '杭州'],
      感兴趣城市引用们: [
        { id: 'loc_bj', display_name: '北京' },
        { id: 'loc_hz', display_name: '杭州' },
      ],
      薪资下限: 300,
      薪资上限: 500,
      期望行业们: ['金融', '人工智能'],
      行业引用们: [
        { id: 'ind_fin', display_name: '金融' },
        { id: 'ind_ai', display_name: '人工智能' },
      ],
      办公方式: ['混合', '远程'],
      后端招聘类型: 'internship',
      求职类型已改: false,
    });
  });

  it('从BFF意向草稿 对面议薪资落成 null/null', () => {
    const 草稿 = 从BFF意向草稿({ ...BFF意向样本, compensation: { mode: 'negotiable' } });
    expect(草稿.薪资下限).toBeNull();
    expect(草稿.薪资上限).toBeNull();
  });

  // #4：编辑已有意向时 annual_salary_months 从服务端快照保留（草稿不能表达此字段）。
  // salary_period 是 BFF 从 recruitment_type 派生的只读字段，不在 IntentionWrite body 里，
  // 保留 recruitment_type 即保留了 period —— 草稿不能表达 period，但保存不会丢它。
  it('转意向写入 更新时保留服务端 annual_salary_months', () => {
    const 草稿: 意向草稿型 = {
      ...空草稿,
      编辑编号: BFF意向样本.intention_id, 求职类型: '全职', 工作城市: '上海', 期望职位: '产品经理',
      工作城市引用: ref('loc_shanghai', '上海'), 职位引用: ref('tax_product', '产品经理'),
      感兴趣城市们: [], 薪资下限: 10, 薪资上限: 20, 期望行业们: [],
      求职类型已改: false, 后端招聘类型: 'internship' as const,
      办公方式: ['hybrid'],
    };
    const 原始 = { ...BFF意向样本, compensation: { mode: 'range' as const, lower: 300, upper: 500, annual_salary_months: 14 } };
    const body = 转意向写入(草稿, { 原始 });
    expect(body.compensation.annual_salary_months).toBe(14);
  });

  it('转意向写入 新建时省略 annual_salary_months（不填 12）', () => {
    const 草稿: 意向草稿型 = {
      ...空草稿,
      求职类型: '全职', 工作城市: '上海', 期望职位: '产品经理',
      工作城市引用: ref('loc_shanghai', '上海'), 职位引用: ref('tax_product', '产品经理'),
      感兴趣城市们: [], 薪资下限: 10, 薪资上限: 20, 期望行业们: [],
      办公方式: ['onsite'],
    };
    const body = 转意向写入(草稿, { 原始: null });
    expect(body.compensation).toEqual({ mode: 'range', lower: 10, upper: 20 });
    expect(body.compensation).not.toHaveProperty('annual_salary_months');
  });

  // Task 6 Step 1：新建意向不默认 onsite、不补 12、按 ID 去重地点
  it('新建意向不默认 onsite、不补 12、按 ID 去重地点', () => {
    const body = 转意向写入({
      ...空草稿,
      求职类型: '全职', 职位引用: ref('tax_pm', '产品经理'),
      工作城市引用: ref('loc_sh', '上海市'),
      感兴趣城市引用们: [ref('loc_sh', '上海市'), ref('loc_hz', '杭州市')],
      行业引用们: [ref('tax_it', '互联网')], 办公方式: ['hybrid'],
      薪资下限: 20, 薪资上限: 30,
    }, { 原始: null });
    expect(body).toMatchObject({
      job_category_id: 'tax_pm', primary_location_id: 'loc_sh',
      alternate_location_ids: ['loc_hz'], industry_ids: ['tax_it'], workplace_modes: ['hybrid'],
    });
    expect(body.compensation).toEqual({ mode: 'range', lower: 20, upper: 30 });
  });

  // Task 6 Step 1：编辑只改可见字段并保留 owner 未表达字段
  it('编辑只改可见字段并保留 owner 未表达字段', () => {
    const ownerCampus = {
      ...BFF意向样本,
      recruitment_type: 'campus' as const,
      job_category: { id: 'tax_pm', display_name: '产品经理' },
      primary_location: { id: 'loc_sh', display_name: '上海市' },
      alternate_locations: [{ id: 'loc_hz', display_name: '杭州市' }],
      industries: [{ id: 'tax_it', display_name: '互联网' }],
      workplace_modes: ['hybrid'] as ('onsite' | 'hybrid' | 'remote')[],
      compensation: { mode: 'range' as const, lower: 20, upper: 30, annual_salary_months: 15 },
      graduation_month: '2026-07',
      internship_months: null,
      onsite_days_per_week: null,
      exclusions: {
        alternate_weekend_work: 'excluded' as const,
        outsourcing_only: 'unspecified' as const,
        onsite_only: 'excluded' as const,
        frequent_travel: 'unspecified' as const,
      },
      private_preferences: '自定义偏好',
    };
    const body = 转意向写入(从BFF意向草稿(ownerCampus), { 原始: ownerCampus });
    expect(body).toMatchObject({
      recruitment_type: 'campus', graduation_month: ownerCampus.graduation_month,
      exclusions: ownerCampus.exclusions, private_preferences: ownerCampus.private_preferences,
    });
    expect(body.compensation.annual_salary_months).toBe(ownerCampus.compensation.annual_salary_months);
  });

  // Task 1：意向路径的本地校验失败必须是 客户端校验错误（带稳定 field 名），
  // 取后端错误文案 直接给出具体原因，不再落成网络错误文案。
  it('意向本地校验失败显示具体原因而不是网络错误', () => {
    const 意向草稿 = {
      ...空草稿,
      工作城市: '上海',
      期望职位: '产品经理',
      工作城市引用: ref('loc_shanghai', '上海'),
      职位引用: ref('tax_product', '产品经理'),
      薪资下限: 10,
      薪资上限: 20,
    };
    const 首次输入 = {
      职位们: ['产品经理'],
      城市们: ['上海'],
      薪资: { 下限: 10, 上限: 20, 单位: '月薪K' as const },
      筛选偏好: {
        求职类型: ['社招全职'] as ['社招全职'],
        办公方式: ['混合'] as ['混合'],
      },
      排除项: [],
      职位引用: ref('tax_product', '产品经理'),
      城市引用们: [],
    };

    const 捕获 = (调用: () => unknown) => {
      try {
        调用();
        throw new Error('预期调用失败');
      } catch (错误) {
        return 错误;
      }
    };
    const 办公错误 = 捕获(() => 转意向写入({ ...意向草稿, 办公方式: [] }, { 原始: null }));
    const 城市错误 = 捕获(() => 转首次意向写入(首次输入));
    expect(办公错误).toMatchObject({ field: 'intention.workplace_modes', message: '请先完善办公方式' });
    expect(城市错误).toMatchObject({ field: 'intention.primary_location_id', message: '请从候选城市中选择' });
    expect(取后端错误文案(办公错误)).toBe('请先完善办公方式');
    expect(取后端错误文案(城市错误)).toBe('请从候选城市中选择');

    // 编辑意向路径缺城市引用同样落 intention.primary_location_id，与首次路径同一原因
    expect(捕获(() => 转意向写入({ ...意向草稿, 工作城市引用: undefined, 办公方式: ['混合'] }, { 原始: null })))
      .toMatchObject({ field: 'intention.primary_location_id', message: '请从候选城市中选择' });
  });

  // ── Task 2：结构化要求显式确认 + sparse Job 补丁 ──

  // Create：未显式确认（缺字段 / false）一律在生成 body 前拒绝；「不限」是合法选择，与未确认无关。
  it('转岗位创建 未显式确认时不生成 JobCreate', () => {
    expect(() => 转岗位创建({ ...完整岗位草稿, 结构化要求已确认: false }, 完整创建上下文))
      .toThrow('请确认经验和学历将作为自动匹配依据');
    const { 结构化要求已确认: _未勾选, ...未确认草稿 } = 完整岗位草稿;
    expect(() => 转岗位创建(未确认草稿, 完整创建上下文))
      .toThrow('请确认经验和学历将作为自动匹配依据');
  });

  it('转岗位创建 确认后发送字面量 true；经验/学历都是不限 + 确认也合法', () => {
    expect(转岗位创建({ ...完整岗位草稿, 经验要求: '不限', 最低学历: '不限', 结构化要求已确认: true }, 完整创建上下文))
      .toMatchObject({
        experience_requirement: 'none',
        education_requirement: 'none',
        structured_requirements_confirmed: true,
      });
  });

  describe('转岗位补丁 sparse 语义', () => {
    /** 从 previous 权威 DTO 反 hydrate 页面基线：除显式覆盖外，页面与 previous 完全一致 */
    const 基线 = (覆盖: Partial<BFFOwnerJob> = {}) => {
      const previous = { ...BFF岗位样本, ...覆盖 };
      return { previous, 页面: 从BFF岗位(previous, {}) };
    };

    it('无变化时补丁为空对象', () => {
      const { previous, 页面 } = 基线();
      expect(转岗位补丁(页面, previous)).toEqual({});
    });

    it('无关编辑只带 office_location，legacy false 不被伪造确认', () => {
      const { previous, 页面 } = 基线({ structured_requirements_confirmed: false });
      expect(转岗位补丁({ ...页面, 办公地: '新办公地址' }, previous))
        .toEqual({ office_location: '新办公地址' });
    });

    it('legacy false 显式勾选且内容未变时只发确认', () => {
      const { previous, 页面 } = 基线({ structured_requirements_confirmed: false });
      expect(转岗位补丁({ ...页面, 结构化要求已确认: true }, previous))
        .toEqual({ structured_requirements_confirmed: true });
    });

    it('只改经验/学历时变化字段与确认同请求发送', () => {
      const { previous, 页面 } = 基线();
      expect(转岗位补丁({ ...页面, 经验要求: '3-5 年' }, previous))
        .toEqual({ experience_requirement: 'three_to_five_years', structured_requirements_confirmed: true });
      expect(转岗位补丁({ ...页面, 最低学历: '大专' }, previous))
        .toEqual({ education_requirement: 'associate', structured_requirements_confirmed: true });
    });

    it('requirements trim 后变化才带确认；仅空白差异不算变化', () => {
      const { previous, 页面 } = 基线();
      expect(转岗位补丁({ ...页面, 职位要求: '  新的要求  ' }, previous))
        .toEqual({ requirements: '新的要求', structured_requirements_confirmed: true });
      expect(转岗位补丁({ ...页面, 职位要求: `  ${previous.requirements}  ` }, previous)).toEqual({});
    });

    it('只改描述时仅带 description，不带确认', () => {
      const { previous, 页面 } = 基线();
      expect(转岗位补丁({ ...页面, 职位描述: '新的描述' }, previous))
        .toEqual({ description: '新的描述' });
    });

    it('只改薪资带时发整个 salary 对象（period 不可编辑，不回传）', () => {
      const { previous, 页面 } = 基线();
      expect(转岗位补丁({ ...页面, 薪资带: '400-600 元/天' }, previous))
        .toEqual({ salary: { lower: 400, upper: 600 } });
    });

    it('年薪月数/届别 数字→null 显式发 null（三态清除）', () => {
      const { previous, 页面 } = 基线({ annual_salary_months: 13, campus_cohort: 2027 });
      const 清除页面 = { ...页面, 年薪月数: undefined, 届别: undefined };
      expect(转岗位补丁(清除页面, previous))
        .toEqual({ annual_salary_months: null, campus_cohort: null });
    });

    it('internship_months/onsite_days_per_week 页面缺值表示不变，不发 null', () => {
      const { previous, 页面 } = 基线({ internship_months: 3, onsite_days_per_week: 4 });
      expect(转岗位补丁({ ...页面, 实习月数: undefined, 每周天数: undefined }, previous)).toEqual({});
  });

    it('keywords 非空→[] 显式发空数组；页面缺 keywords 时保留服务端值', () => {
      const { previous, 页面 } = 基线();
      expect(转岗位补丁({ ...页面, 职位关键词: [] }, previous)).toEqual({ keywords: [] });
      const 无关键词页面 = { ...页面 };
      delete 无关键词页面.职位关键词;
      expect(转岗位补丁(无关键词页面, previous)).toEqual({});
    });

    it('四员硬性条件块只在变化时整体发出，且不带确认', () => {
      const { previous, 页面 } = 基线();
      expect(转岗位补丁({ ...页面, 硬性事实: { ...页面.硬性事实, 大小周: '必须' } }, previous))
        .toEqual({ hard_requirements: { ...previous.hard_requirements, alternate_weekend_work: 'required' } });
    });

    it('immutable 与服务端专有字段绝不回传', () => {
      const { previous, 页面 } = 基线();
      const patch = 转岗位补丁({ ...页面, 办公地: '新办公地址' }, previous);
      for (const 键 of [
        'publisher_mode', 'hiring_organization_claim', 'title', 'recruitment_type',
        'category_id', 'location_id', 'salary_period', 'revision',
        'publisher_affiliation_ref', 'publisher_organization_ref', 'hiring_organization_ref',
        'publisher_verification_status', 'hiring_organization_verification_status',
      ]) {
        expect(patch).not.toHaveProperty(键);
      }
    });

    it('相关变化缺确认（缺字段或 false）时在生成补丁前抛错', () => {
      const { previous, 页面 } = 基线();
      const 未确认页面 = { ...页面 };
      delete 未确认页面.结构化要求已确认;
      expect(() => 转岗位补丁({ ...未确认页面, 经验要求: '3-5 年' }, previous))
        .toThrow('请确认经验和学历将作为自动匹配依据');
      expect(() => 转岗位补丁({ ...页面, 结构化要求已确认: false, 最低学历: '大专' }, previous))
        .toThrow('请确认经验和学历将作为自动匹配依据');
    });
  });
});

// ── M：空身份 —— BFF 空 status 映射为页面 ''，转资料写入 拒绝空身份 ──
describe('空身份映射与写入校验（M）', () => {
  it('从BFF简历 对空 status 保持 身份:""（不再显示默认「在职」）', () => {
    const 空Profile: BFF简历 = {
      ...BFF简历样本,
      profile: { ...BFF简历样本.profile, status: '' },
    };
    expect(从BFF简历(空Profile).基本信息.身份).toBe('');
  });

  it('转资料写入 对空身份抛「请选择求职状态」并带字段名', () => {
    expect(() => 转资料写入({ 真名: '沈', 开始工作年: '', 身份: '' }))
      .toThrow('请选择求职状态');
    try {
      转资料写入({ 真名: '沈', 开始工作年: '', 身份: '' });
    } catch (错误) {
      expect(错误).toMatchObject({ field: 'resume.profile.status' });
    }
  });
});
