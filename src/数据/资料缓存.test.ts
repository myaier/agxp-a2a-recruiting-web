import { describe, expect, it, vi } from 'vitest';
import {
  写资料缓存,
  读资料缓存,
  资料缓存键,
  迁移旧资料缓存,
  候选引导草稿键,
  删候选引导草稿,
  读候选引导草稿,
  写候选引导草稿,
  创建候选建档草稿存储,
  type 资料缓存快照,
  type 候选引导草稿快照,
  type 候选引导建档草稿,
} from './资料缓存';

function 内存存储() {
  const 数据 = new Map<string, string>();
  return {
    getItem: (键: string) => 数据.get(键) ?? null,
    setItem: (键: string, 值: string) => { 数据.set(键, 值); },
    removeItem: (键: string) => { 数据.delete(键); },
  };
}

const 快照: 资料缓存快照 = {
  公司自述: null,
  企业认证: { 姓名: '甲', 公司: '甲公司' },
  招聘头像: 'data:image/jpeg;base64,aaa',
  公司LOGO: null,
  求职头像: '章:2',
  飞书已接入: true,
  企业飞书已接入: false,
  求职先问偏好: { 递交材料: '自动发送', 超授权让步: '直接回绝' },
  企业先问偏好: { 递交材料: '先问我', 超授权让步: '直接回绝' },
  全局规则: [{ 编号: 'R-1', 内容: '只接受双休', 来源: '手动添加', 生效: true }],
  意向级规则: [],
  企业规则: [],
};

describe('账号资料缓存', () => {
  it('按模式、环境和账号三重隔离', () => {
    const 存储 = 内存存储();
    const 甲 = { 模式: 'backend' as const, 环境: 'stg' as const, 账号: 'sub_A' };
    const 乙 = { 模式: 'backend' as const, 环境: 'stg' as const, 账号: 'sub_B' };
    const 本地甲 = { 模式: 'backend' as const, 环境: 'local' as const, 账号: 'sub_A' };
    写资料缓存(存储, 甲, 快照);
    expect(读资料缓存(存储, 甲).企业认证?.姓名).toBe('甲');
    expect(读资料缓存(存储, 乙)).toEqual({});
    expect(读资料缓存(存储, 本地甲)).toEqual({});
    expect(资料缓存键(甲)).not.toBe(资料缓存键(乙));
  });

  it('损坏或伪造字段不会进入应用状态', () => {
    const 存储 = 内存存储();
    const 范围 = { 模式: 'mock' as const, 环境: 'stg' as const, 账号: 'demo' };
    存储.setItem(资料缓存键(范围), JSON.stringify({
      招聘头像: 'https://evil.example/avatar',
      求职头像: '非法',
      企业认证: { 姓名: 123, 公司: null },
      飞书已接入: '1',
      求职先问偏好: { 递交材料: '随便发', 超授权让步: '直接回绝' },
      全局规则: [{ 编号: 'R-1', 内容: '规则', 来源: '伪造', 生效: true, 服务端版本: 7 }],
    }));
    expect(读资料缓存(存储, 范围)).toEqual({});
  });

  it('Mock 三组规则可 round trip，拒绝带 Backend 权威字段的伪造规则', () => {
    const 存储 = 内存存储();
    const 范围 = { 模式: 'mock' as const, 环境: 'stg' as const, 账号: 'demo' };
    const 规则组 = [{ 编号: 'R-10', 内容: '只接受薪资透明的岗位', 来源: '手动添加', 生效: true }];
    写资料缓存(存储, 范围, { 全局规则: 规则组, 意向级规则: [], 企业规则: [] });
    expect(读资料缓存(存储, 范围)).toEqual({ 全局规则: 规则组, 意向级规则: [], 企业规则: [] });

    写资料缓存(存储, 范围, {
      全局规则: [{ ...规则组[0], 服务端版本: 3 }], 意向级规则: [], 企业规则: [],
    });
    expect(读资料缓存(存储, 范围)).toEqual({ 意向级规则: [], 企业规则: [] });
  });

  it('Mock 双端先问偏好可安全 round trip', () => {
    const 存储 = 内存存储();
    const 范围 = { 模式: 'mock' as const, 环境: 'stg' as const, 账号: 'demo' };
    写资料缓存(存储, 范围, {
      求职先问偏好: { 递交材料: '自动发送', 超授权让步: '先问我' },
      企业先问偏好: { 递交材料: '先问我', 超授权让步: '直接回绝' },
    });
    expect(读资料缓存(存储, 范围)).toEqual({
      求职先问偏好: { 递交材料: '自动发送', 超授权让步: '先问我' },
      企业先问偏好: { 递交材料: '先问我', 超授权让步: '直接回绝' },
    });
  });

  it('旧全局键只在新分仓写成功后删除', () => {
    const 存储 = 内存存储();
    const 范围 = { 模式: 'mock' as const, 环境: 'stg' as const, 账号: 'demo' };
    存储.setItem('AGXP企业认证v1', JSON.stringify({ 姓名: '老用户', 公司: '老公司' }));
    const 结果 = 迁移旧资料缓存(存储, 范围);
    expect(结果.企业认证?.姓名).toBe('老用户');
    expect(存储.getItem('AGXP企业认证v1')).toBe(null);
    expect(读资料缓存(存储, 范围).企业认证?.姓名).toBe('老用户');
  });

  it('新组织选择字段合法值 round trip', () => {
    const 存储 = 内存存储();
    const 范围 = { 模式: 'backend' as const, 环境: 'stg' as const, 账号: 'sub_1' };
    写资料缓存(存储, 范围, { 当前企业关系编号: 'aff_1', 未认证公司声明: '云衢科技' });
    expect(读资料缓存(存储, 范围)).toEqual({
      当前企业关系编号: 'aff_1',
      未认证公司声明: '云衢科技',
    });
    写资料缓存(存储, 范围, { 当前企业关系编号: null });
    expect(读资料缓存(存储, 范围)).toEqual({ 当前企业关系编号: null });
  });

  it('Backend 快照保留非 P1C 账号资料和可恢复组织选择', () => {
    const setItem = vi.fn();
    const 存储 = { getItem: vi.fn(() => null), setItem, removeItem: vi.fn() };
    const 范围 = { 模式: 'backend', 环境: 'local', 账号: 'sub_1' } as const;
    写资料缓存(存储, 范围, {
      当前企业关系编号: null, 未认证公司声明: '', 求职头像: '章:林',
      飞书已接入: true, 企业飞书已接入: false,
    });
    expect(JSON.parse(setItem.mock.calls[0][1])).toEqual({
      当前企业关系编号: null, 未认证公司声明: '', 求职头像: '章:林',
      飞书已接入: true, 企业飞书已接入: false,
    });
  });

  it('候选当前意向编号 round trip：非空字符串与 null 都合法', () => {
    const 存储 = 内存存储();
    const 范围 = { 模式: 'backend' as const, 环境: 'stg' as const, 账号: 'sub_1' };
    写资料缓存(存储, 范围, { 当前意向编号: 'int_bj' });
    expect(读资料缓存(存储, 范围)).toEqual({ 当前意向编号: 'int_bj' });
    写资料缓存(存储, 范围, { 当前意向编号: null });
    expect(读资料缓存(存储, 范围)).toEqual({ 当前意向编号: null });
  });

  it('旧缓存没有 当前意向编号 仍合法：其余字段照常读出，不补造该键', () => {
    const 存储 = {
      getItem: vi.fn(() => JSON.stringify({ 当前企业关系编号: 'aff_1', 求职头像: null })),
      setItem: vi.fn(), removeItem: vi.fn(),
    };
    const 快照 = 读资料缓存(存储, { 模式: 'backend', 环境: 'local', 账号: 'sub_1' });
    expect(快照).toEqual({ 当前企业关系编号: 'aff_1', 求职头像: null });
    expect('当前意向编号' in 快照).toBe(false);
  });

  it('损坏的候选意向编号被丢弃：空串、数字、对象都不进应用状态', () => {
    for (const 坏值 of ['', 3, {}, [], true]) {
      const 存储 = {
        getItem: vi.fn(() => JSON.stringify({ 当前意向编号: 坏值 })),
        setItem: vi.fn(), removeItem: vi.fn(),
      };
      expect(读资料缓存(存储, { 模式: 'backend', 环境: 'local', 账号: 'sub_1' })).toEqual({});
    }
  });

  it('损坏的 Backend 选择字段被逐键丢弃', () => {
    const 存储 = {
      getItem: vi.fn(() => JSON.stringify({ 当前企业关系编号: 3, 未认证公司声明: [] })),
      setItem: vi.fn(), removeItem: vi.fn(),
    };
    expect(读资料缓存(存储, { 模式: 'backend', 环境: 'local', 账号: 'sub_1' })).toEqual({});
  });
});

// ── Task 4：候选 onboarding 草稿的 sessionStorage 白名单编解码 ─────────────────
// 这是「服务端尚未接管的页面答案」缓存，不是简历缓存：简历正文、凭据、PDF 文本、
// 未脱敏联系方式、模型输出一律不允许落盘；任何损坏字段整条拒绝并删除。

describe('候选引导草稿 sessionStorage 编解码', () => {
  const 范围A = { 模式: 'backend' as const, 环境: 'stg' as const, 账号: 'sub_A' };
  const 范围B = { 模式: 'backend' as const, 环境: 'stg' as const, 账号: 'sub_B' };

  const 草稿: 候选引导草稿快照 = {
    城市们: ['上海'],
    职位: ['后端工程师'],
    城市引用们: [{ id: 'loc_sh', display_name: '上海' }],
    职位引用们: [{ id: 'job_be', display_name: '后端工程师' }],
    筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['混合'] },
    薪资: { 下限: 30, 上限: 40, 单位: '月薪K' },
    到岗: '在职 · 考虑机会',
  };

  it('候选草稿键按 subject 隔离', () => {
    expect(候选引导草稿键(范围A)).not.toBe(候选引导草稿键(范围B));
    expect(候选引导草稿键(范围A)).not.toBe(候选引导草稿键({ 模式: 'backend', 环境: 'local', 账号: 'sub_A' }));
  });

  it('合法草稿 round trip，读不到其它主体的记录', () => {
    const 存储 = 内存存储();
    expect(写候选引导草稿(存储, 范围A, 草稿)).toBe(true);
    expect(读候选引导草稿(存储, 范围A)).toEqual(草稿);
    expect(读候选引导草稿(存储, 范围B)).toBe(null);
    // 删除后归零
    删候选引导草稿(存储, 范围A);
    expect(读候选引导草稿(存储, 范围A)).toBe(null);
    expect(存储.getItem(候选引导草稿键(范围A))).toBe(null);
  });

  it('写入只落白名单键：简历 / credentials / PDF 文本等附加字段绝不落盘', () => {
    const 存储 = 内存存储();
    const 污染输入 = {
      ...草稿,
      简历: '简历正文不得落盘',
      credentials: { token: 'secret' },
      parsed_pdf_text: 'PDF 解析文本',
    } as typeof 草稿;
    写候选引导草稿(存储, 范围A, 污染输入);
    const 原文 = 存储.getItem(候选引导草稿键(范围A))!;
    expect(Object.keys(JSON.parse(原文)).sort()).toEqual(
      ['城市们', '城市引用们', '到岗', '筛选偏好', '薪资', '职位', '职位引用们'].sort()
    );
    expect(原文).not.toContain('简历正文');
    expect(原文).not.toContain('credentials');
    expect(原文).not.toContain('PDF');
    // 写入构造的是全新对象，不共享调用方引用
    expect(JSON.parse(原文)).not.toBe(污染输入);
  });

  it('原始内容不是 JSON 时返回 null 并删除整条', () => {
    const 存储 = 内存存储();
    存储.setItem(候选引导草稿键(范围A), '不是 JSON');
    expect(读候选引导草稿(存储, 范围A)).toBe(null);
    expect(存储.getItem(候选引导草稿键(范围A))).toBe(null);
  });

  const 损坏表: [名称: string, 值: Record<string, unknown>][] = [
    ['城市数组不是数组', { ...草稿, 城市们: '上海' }],
    ['城市数组混入非字符串', { ...草稿, 城市们: ['上海', 42] }],
    ['必填城市/职位数组缺失', { 筛选偏好: 草稿.筛选偏好, 薪资: 草稿.薪资 }],
    ['引用 id 为空串', { ...草稿, 城市引用们: [{ id: '', display_name: '上海' }] }],
    ['引用 display_name 非字符串', { ...草稿, 职位引用们: [{ id: 'job_be', display_name: 7 }] }],
    ['引用带未知字段', { ...草稿, 城市引用们: [{ id: 'loc_sh', display_name: '上海', extra: 1 }] }],
    ['薪资下限非数字', { ...草稿, 薪资: { 下限: '30', 上限: 40, 单位: '月薪K' } }],
    ['薪资上限非有限数', { ...草稿, 薪资: { 下限: 30, 上限: Number.POSITIVE_INFINITY } }],
    ['薪资单位未知', { ...草稿, 薪资: { 下限: 30, 上限: 40, 单位: '时薪' } }],
    ['根上多出未知字段', { ...草稿, credentials: 'token' }],
    ['求职类型枚举非法', { ...草稿, 筛选偏好: { 求职类型: ['全职'], 办公方式: ['混合'] } }],
    ['办公方式枚举非法', { ...草稿, 筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['远程'] } }],
    ['毕业时间格式非法', {
      ...草稿,
      筛选偏好: { 求职类型: ['校园招聘'], 办公方式: ['混合'], 毕业时间: '2026/07' },
    }],
    ['实习月数非整数', {
      ...草稿,
      筛选偏好: { 求职类型: ['实习生'], 办公方式: ['混合'], 实习月数: 2.5 },
    }],
    ['每周到岗天数类型错误', {
      ...草稿,
      筛选偏好: { 求职类型: ['实习生'], 办公方式: ['混合'], 每周到岗天数: '4' },
    }],
    ['到岗类型错误', { ...草稿, 到岗: 123 }],
    ['筛选偏好类型错误', { ...草稿, 筛选偏好: '社招全职' }],
  ];

  it.each(损坏表)('损坏记录（%s）返回 null 并删除整条', (名称, 值) => {
    void 名称;
    const 存储 = 内存存储();
    存储.setItem(候选引导草稿键(范围A), JSON.stringify(值));
    expect(读候选引导草稿(存储, 范围A)).toBe(null);
    // 整条删除：重复 mount 不会反复撞同一条损坏记录
    expect(存储.getItem(候选引导草稿键(范围A))).toBe(null);
  });
});

// ── 首屏默认（Task 5B）：可选 在校选择 的严格编解码 ──
describe('候选引导草稿 在校选择 编解码（Task 5B）', () => {
  const 范围 = { 模式: 'backend' as const, 环境: 'stg' as const, 账号: 'sub_A' };

  it('在校选择 true/false round-trip；缺省不落键', () => {
    const 存储 = 内存存储();
    写候选引导草稿(存储, 范围, { 城市们: [], 职位: [], 在校选择: true });
    expect(读候选引导草稿(存储, 范围)?.在校选择).toBe(true);
    写候选引导草稿(存储, 范围, { 城市们: [], 职位: [], 在校选择: false });
    expect(读候选引导草稿(存储, 范围)?.在校选择).toBe(false);
    写候选引导草稿(存储, 范围, { 城市们: [], 职位: [] });
    expect(读候选引导草稿(存储, 范围)).not.toHaveProperty('在校选择');
  });

  it('非 boolean 的 在校选择 整条拒绝并删除', () => {
    const 存储 = 内存存储();
    存储.setItem(候选引导草稿键(范围), JSON.stringify({ 城市们: [], 职位: [], 在校选择: 'yes' }));
    expect(读候选引导草稿(存储, 范围)).toBe(null);
    expect(存储.getItem(候选引导草稿键(范围))).toBe(null);
  });

  it('旧 v1 记录无该键仍可读', () => {
    const 存储 = 内存存储();
    存储.setItem(候选引导草稿键(范围), JSON.stringify({
      城市们: ['上海'], 职位: ['后端工程师'], 到岗: '在职 · 考虑机会',
    }));
    const 读出 = 读候选引导草稿(存储, 范围);
    expect(读出?.城市们).toEqual(['上海']);
    expect(读出).not.toHaveProperty('在校选择');
  });
});

// ── J-PILOT-02 Task 2：建档草稿（未提交输入 / 编辑层 / 单一未结算写入槽）的编解码 ──
// Global 7 字段白名单：未出现字段兼容旧草稿；在场的损坏/未知字段（含凭据/PDF）
// 整条拒绝并删除。文件操作只存核对元数据，回执只存 ID/revision/source tuple。

describe('候选引导草稿 建档编解码（J-PILOT-02 Task 2）', () => {
  const 范围A = { 模式: 'backend' as const, 环境: 'stg' as const, 账号: 'sub_A' };
  const 范围B = { 模式: 'backend' as const, 环境: 'stg' as const, 账号: 'sub_B' };

  const 建档样本 = (): 候选引导建档草稿 => ({
    位置: { pathname: '/onboarding/工作经历', search: '?step=3', 题序: 3 },
    资料: {
      基本信息: { 真名: '李雷', 开始工作年: '2021', 身份: '在职' },
      个人优势: '五年后端',
      技能: ['Go', '分布式'],
      经历: [{
        编号: 'e1', 公司: '甲公司', 行业: '互联网', 职位: '后端工程师',
        开始: '2021-07', 结束: null, 内容: '做事', 隐藏: true,
        项目: [{ 编号: 'p1', 名称: '网关重构', 角色: '开发', 结果: '上线' }],
      }],
      教育: [{ 编号: 'edu1', 学校: '上海交通大学', 学历: '本科', 专业: '计算机', 开始: '2017-09', 结束: '2021-06' }],
      证书: [{ 编号: 'c1', 名称: 'CET-6', 年份: '2020' }],
      作品集链接: null,
    },
    编辑中: { 种类: 'education', 本地编号: 'edu2', 字段: { 学校: '复旦大学', 学历: '硕士' } },
    排除项: ['大小周'],
    自定义诉求: ['不接受值班'],
    已存条目: [
      { 本地编号: 'edu1', 种类: 'education', 资源编号: 'edu_srv_1', revision: 3 },
      { 本地编号: 'p1', 种类: 'project', 资源编号: 'prj_srv_1', revision: 1, 父编号: 'e1' },
    ],
    已存分区: { profile: 2, summary: 1 },
    明确删除条目: [{ 种类: 'experience', 资源编号: 'exp_srv_1', revision: 5 }],
    公司待选: {
      搜索词: '字节',
      选择: { organization_id: 'org_1', display_name: '字节跳动', legal_name: '字节跳动有限公司' },
    },
    首次意向: { id: 'int_1', revision: 2 },
    待写入: {
      种类: 'education-create', 本地编号: 'edu2',
      请求体: { institution_id: 'ins_1' }, 幂等键: 'idem-a', 阶段: 'prepared',
    },
    头像状态: '待核对',
  });

  it('旧 v1 记录无 建档 仍可读，不补造该键', () => {
    const 存储 = 内存存储();
    存储.setItem(候选引导草稿键(范围A), JSON.stringify({ 城市们: ['上海'], 职位: ['后端工程师'] }));
    const 读出 = 读候选引导草稿(存储, 范围A);
    expect(读出?.城市们).toEqual(['上海']);
    expect(读出).not.toHaveProperty('建档');
  });

  it('完整 建档 草稿 round trip', () => {
    const 存储 = 内存存储();
    const 建档 = 建档样本();
    expect(写候选引导草稿(存储, 范围A, { 城市们: ['上海'], 职位: ['后端工程师'], 建档 })).toBe(true);
    expect(读候选引导草稿(存储, 范围A)?.建档).toEqual(建档);
    // 其它主体读不到
    expect(读候选引导草稿(存储, 范围B)?.建档).toBe(undefined);
  });

  it('不完整编辑字段（编辑中 只填一半）可回读，缺项不补造', () => {
    const 存储 = 内存存储();
    const 建档: 候选引导草稿快照['建档'] = {
      编辑中: { 种类: 'education', 本地编号: 'edu9', 字段: { 学校: '复旦大学' } },
    };
    写候选引导草稿(存储, 范围A, { 城市们: [], 职位: [], 建档 });
    expect(读候选引导草稿(存储, 范围A)?.建档).toEqual(建档);
    expect(读候选引导草稿(存储, 范围A)?.建档?.编辑中?.字段).toEqual({ 学校: '复旦大学' });
  });

  it('写入只落 建档 白名单键：credentials / PDF 附加字段绝不落盘；读取整条拒绝带凭据记录', () => {
    const 存储 = 内存存储();
    const 污染输入 = {
      ...建档样本(),
      credentials: { token: 'secret' },
      pdf_bytes: 'JVBERi',
    } as never as 候选引导草稿快照['建档'];
    写候选引导草稿(存储, 范围A, { 城市们: [], 职位: [], 建档: 污染输入 });
    const 原文 = 存储.getItem(候选引导草稿键(范围A))!;
    expect(原文).not.toContain('secret');
    expect(原文).not.toContain('pdf_bytes');
    expect(原文).not.toContain('credentials');
    expect(Object.keys(JSON.parse(原文).建档).sort()).toEqual([
      '位置', '公司待选', '头像状态', '已存分区', '已存条目', '明确删除条目',
      '首次意向', '待写入', '排除项', '自定义诉求', '编辑中', '资料',
    ].sort());
    // 反向：存储里带凭据键的 建档 记录整条拒绝并删除
    存储.setItem(候选引导草稿键(范围A), JSON.stringify({
      城市们: [], 职位: [],
      建档: { ...建档样本(), token: 'x' },
    }));
    expect(读候选引导草稿(存储, 范围A)).toBe(null);
    expect(存储.getItem(候选引导草稿键(范围A))).toBe(null);
  });

  const 损坏建档表: [名称: string, 值: Record<string, unknown>][] = [
    ['头像状态枚举非法', { ...建档样本(), 头像状态: '已上传' }],
    ['位置缺 search', { ...建档样本(), 位置: { pathname: '/x' } }],
    ['位置题序非整数', { ...建档样本(), 位置: { pathname: '/x', search: '', 题序: 1.5 } }],
    ['待写入种类未知', { ...建档样本(), 待写入: { 种类: 'deploy-job', 阶段: 'prepared' } }],
    ['待写入缺阶段', { ...建档样本(), 待写入: { 种类: 'profile' } }],
    ['待写入阶段非法', { ...建档样本(), 待写入: { 种类: 'profile', 阶段: 'done' } }],
    ['待写入携带任意 URL 键', { ...建档样本(), 待写入: { 种类: 'profile', 阶段: 'prepared', url: 'https://evil' } }],
    ['回执带未知键', { ...建档样本(), 待写入: { 种类: 'profile', 阶段: 'received', 回执: { id: 'p1', extra: 1 } } }],
    ['回执 revision 非数', { ...建档样本(), 待写入: { 种类: 'summary', 阶段: 'received', 回执: { revision: '3' } } }],
    ['回执 source 缺 version_id', {
      ...建档样本(),
      待写入: { 种类: 'resume-file-parse', 阶段: 'received', 回执: { source: { file_id: 'rf_1', parse_id: null } } },
    }],
    ['文件核对缺 sha256', {
      ...建档样本(),
      待写入: { 种类: 'avatar', 阶段: 'prepared', 文件核对: { name: 'a.png', type: 'image/png', size: 1, lastModified: 1 } },
    }],
    ['已存条目缺 revision', { ...建档样本(), 已存条目: [{ 本地编号: 'edu1', 种类: 'education', 资源编号: 'edu_srv_1' }] }],
    ['已存条目种类未知', { ...建档样本(), 已存条目: [{ 本地编号: 'x', 种类: 'blog', 资源编号: 's', revision: 1 }] }],
    ['已存分区未知键', { ...建档样本(), 已存分区: { profile: 1, education: 2 } }],
    ['明确删除条目缺资源编号', { ...建档样本(), 明确删除条目: [{ 种类: 'experience', revision: 1 }] }],
    ['公司待选选择缺 legal_name', {
      ...建档样本(),
      公司待选: { 搜索词: '字节', 选择: { organization_id: 'o1', display_name: '字节' } },
    }],
    ['首次意向 id 非串', { ...建档样本(), 首次意向: { id: 7, revision: 1 } }],
    ['编辑中种类未知', { ...建档样本(), 编辑中: { 种类: 'award', 本地编号: 'x', 字段: {} } }],
    ['编辑中缺本地编号', { ...建档样本(), 编辑中: { 种类: 'education', 字段: { 学校: '复旦' } } }],
    ['编辑中字段未知键', {
      ...建档样本(),
      编辑中: { 种类: 'education', 本地编号: 'edu2', 字段: { 学校: '复旦', token: 'x' } },
    }],
    ['编辑中经历字段类型错', { ...建档样本(), 编辑中: { 种类: 'experience', 本地编号: 'e9', 字段: { 隐藏: 'yes' } } }],
    ['资料经历缺隐藏', {
      ...建档样本(),
      资料: {
        ...建档样本().资料,
        经历: [{ 编号: 'e1', 公司: '甲', 行业: '互联网', 职位: '后端', 开始: '2021-07', 结束: null, 内容: 'x' }],
      },
    }],
    ['资料基本信息身份枚举非法', { ...建档样本(), 资料: { 基本信息: { 身份: '自由职业' } } }],
    ['资料作品集链接非串非 null', { ...建档样本(), 资料: { 作品集链接: 5 } }],
    ['排除项混入非字符串', { ...建档样本(), 排除项: ['大小周', 3] }],
    ['建档根未知字段', { ...建档样本(), resume_text: '整份简历正文不得落草稿' }],
  ];

  it.each(损坏建档表)('损坏的 建档（%s）整条拒绝并删除', (名称, 建档值) => {
    void 名称;
    const 存储 = 内存存储();
    存储.setItem(候选引导草稿键(范围A), JSON.stringify({
      城市们: ['上海'], 职位: ['后端工程师'], 建档: 建档值,
    }));
    expect(读候选引导草稿(存储, 范围A)).toBe(null);
    expect(存储.getItem(候选引导草稿键(范围A))).toBe(null);
  });

  it('存储抛错或无存储：写草稿与建档适配器写入都返回 false，不抛错', () => {
    const 抛错存储 = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceeded'); },
      removeItem: () => { /* no-op */ },
    };
    expect(写候选引导草稿(抛错存储, 范围A, { 城市们: [], 职位: [], 建档: 建档样本() })).toBe(false);
    expect(创建候选建档草稿存储({ storage: 抛错存储, 范围: 范围A }).写入(建档样本())).toBe(false);
    expect(创建候选建档草稿存储({ storage: null, 范围: 范围A }).写入(建档样本())).toBe(false);
    expect(创建候选建档草稿存储({ storage: null, 范围: 范围A }).读取()).toBe(null);
  });

  it('建档适配器：读取只回 建档；写入与既有向导答案合并不顶掉；坏输入 fail closed', () => {
    const 存储 = 内存存储();
    写候选引导草稿(存储, 范围A, { 城市们: ['上海'], 职位: ['后端工程师'] });
    const 适配器 = 创建候选建档草稿存储({ storage: 存储, 范围: 范围A });
    expect(适配器.读取()).toBe(null);
    expect(适配器.写入({ 头像状态: '未选' })).toBe(true);
    // 合并：既有城市/职位答案不被 建档 写入顶掉
    const 读出 = 读候选引导草稿(存储, 范围A);
    expect(读出?.城市们).toEqual(['上海']);
    expect(读出?.职位).toEqual(['后端工程师']);
    expect(读出?.建档).toEqual({ 头像状态: '未选' });
    expect(适配器.读取()).toEqual({ 头像状态: '未选' });
    // 无既有记录的主体：建档写入创建最小记录，不虚构向导答案
    const 适配器B = 创建候选建档草稿存储({ storage: 存储, 范围: 范围B });
    expect(适配器B.写入({ 头像状态: '未选' })).toBe(true);
    const 读B = 读候选引导草稿(存储, 范围B);
    expect(读B?.城市们).toEqual([]);
    expect(读B?.职位).toEqual([]);
    expect(读B?.建档).toEqual({ 头像状态: '未选' });
    // 坏 建档 输入 fail closed：不落一条读不回来的记录
    expect(适配器.写入({ 头像状态: '已上传' } as never)).toBe(false);
    expect(读候选引导草稿(存储, 范围A)?.建档).toEqual({ 头像状态: '未选' });
  });
});
