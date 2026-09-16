import { vi } from 'vitest';
import { use应用状态 } from './应用状态';
import { BFF主体样本, BFF简历样本, BFF企业关系样本, BFF企业媒体样本, BFF企业档案样本, BFF企业管理员申请样本, BFF公开企业样本, BFF招聘方档案样本, BFF隐私快照样本, BFF屏蔽回执样本, BFF组织搜索页样本 } from '../测试/BFF样本';
import { 从BFF隐私 } from '../数据/隐私映射';
import { type BFF角色, type BFF附件简历库 } from '../数据/BFF契约';
import { type BFF二进制响应 } from '../数据/HTTP客户端';
import { 解P5详情, type P5列表页, type P5详情 } from '../数据/招聘数据源/MatchCase';
import { type NegotiationCard, type NegotiationDetail, type NegotiationPage } from '../数据/招聘数据源/连续代谈';
import { type P7会话项, type P7会话页, type P7消息, type P7消息页 } from '../数据/招聘数据源/真人会话';
import { type P8AccountDeletion, type P8Credential, type P8DataExport, type P8Session } from '../数据/招聘数据源/P8控制面';
import { type 接触事件页 } from '../数据/招聘数据源/接触记录';
import { type 候选实名摘要 } from '../数据/招聘数据源/候选实名';
import { type AssistantMessagePage } from '../数据/招聘数据源/助手会话';
import { P5候选详情Wire } from '../测试/BFF样本';
import { type 页面意向快照, type 页面岗位快照 } from '../数据/招聘数据源类型';
import { 从BFF简历 } from '../数据/后端映射';

/** P5 Task 3：Provider 用例的候选侧权威详情 DTO（由 Task 1 wire 样本解出）。 */
export const P5候选详情DTO: P5详情 = 解P5详情(P5候选详情Wire, 'candidate');

// ── J-PILOT-01 Task 2：Provider 用例的连续代谈 DTO 样本（facade 边界已 decode）──

export const 连续记录A = 'dlg_0123456789abcdef0123456789abcdef';
export const 连续Case坐标 = 'mc_0123456789abcdef0123456789abcdef';

export const 连续卡片: NegotiationCard = {
  needs_action: true,
  record_id: 连续记录A,
  record_kind: 'delegation',
  intention_id: 'int_0123456789abcdef0123456789abcdef',
  job: {
    job_id: 'job_0123456789abcdef0123456789abcdef',
    title: 'AI 产品实习生',
    location: '上海',
    public_salary_range: '300-500 元/天',
    availability: 'available',
    organization: null,
    required_skills: null,
    recruitment_type: null,
    workplace_mode: null,
    annual_salary_months: null,
  },
  delegation_id: 连续记录A,
  evaluation_id: null,
  case_id: null,
  shelf: 'active',
  phase: 'case_started',
  case_state: null,
  failure: null,
  refusal_code: null,
  actions: { retry: false, archive: false, open_case: false },
  retry_generation: 0,
  created_at: '2026-08-29T01:00:00Z',
  updated_at: '2026-08-29T02:00:00Z',
  archived_at: null,
  match_score: null,
};

export const 连续聚合DTO: NegotiationDetail = {
  ...连续卡片,
  evaluation: null,
  case_detail: P5候选详情DTO,
  failure_history: [],
  agent_summary: { public_evaluation: null, condition_confirmation: null },
  job_detail: null,
};

export function 创建后端桩(lastUsedRole: 'candidate' | 'recruiter' | null = 'candidate') {
  const 主体 = { ...BFF主体样本, last_used_role: lastUsedRole };
  return {
    恢复会话: vi.fn(async () => ({ identity_id: 'id_1', session_id: 'sess_1', expires_at: '2026-08-25T00:00:00Z' })),
    读取主体: vi.fn(async () => 主体),
    确保角色: vi.fn(async (role: BFF角色) => ({ ...主体, roles: [...主体.roles, { role, status: 'active' as const }] })),
    记录当前角色: vi.fn(async (role: BFF角色) => ({ ...主体, last_used_role: role })),
    读取简历: vi.fn(async () => 从BFF简历(BFF简历样本)),
    保存简历: vi.fn(async () => 从BFF简历(BFF简历样本)),
    读取意向: vi.fn(async (): Promise<页面意向快照> => ({ 列表: [], 服务端: {} })),
    创建意向: vi.fn(async (): Promise<页面意向快照> => ({ 列表: [], 服务端: {} })),
    更新意向: vi.fn(async (): Promise<页面意向快照> => ({ 列表: [], 服务端: {} })),
    删除意向: vi.fn(async (): Promise<页面意向快照> => ({ 列表: [], 服务端: {} })),
    读取岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    创建岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    更新岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    归档岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    重开岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    删除岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    清空目录缓存: vi.fn(),
    // P1C Task 2：组织域方法（recruiter mount 水合会调用）
    读取招聘方档案: vi.fn(async () => BFF招聘方档案样本),
    保存招聘方档案: vi.fn(async () => BFF招聘方档案样本),
    读取我的企业关系: vi.fn(async () => [BFF企业关系样本]),
    读取企业管理员申请: vi.fn(async () => [BFF企业管理员申请样本]),
    创建企业管理员申请: vi.fn(async () => BFF企业管理员申请样本),
    取消企业管理员申请: vi.fn(async () => BFF企业管理员申请样本),
    接受企业邀请: vi.fn(async () => BFF企业关系样本),
    替换招聘方头像: vi.fn(async () => BFF招聘方档案样本),
    读取企业档案: vi.fn(async () => BFF企业档案样本),
    替换企业档案: vi.fn(async () => BFF企业档案样本),
    上传企业媒体: vi.fn(async () => BFF企业媒体样本),
    删除企业媒体: vi.fn(async () => undefined),
    读取公开企业: vi.fn(async () => BFF公开企业样本),
    查询Location: vi.fn(async (): Promise<{ items: never[]; nextCursor: null; catalogVersion: string }> => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
    查询Taxonomy: vi.fn(async (): Promise<{ items: never[]; nextCursor: null; catalogVersion: string }> => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
    查询Institution: vi.fn(async (): Promise<{ items: never[]; nextCursor: null; catalogVersion: string }> => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
    // P3 Task 2：隐私域（candidate mount 水合会调用 读取隐私）
    读取隐私: vi.fn(async () => 从BFF隐私(BFF隐私快照样本)),
    修改隐私: vi.fn(async () => 从BFF隐私(BFF隐私快照样本)),
    添加组织屏蔽: vi.fn(async () => BFF屏蔽回执样本),
    解除组织屏蔽: vi.fn(async () => 从BFF隐私(BFF隐私快照样本)),
    搜索组织: vi.fn(async () => BFF组织搜索页样本),
    开始手机登录: vi.fn(async () => ({ attempt_id: 'att_test', next_action: { type: 'enter_code' as const } })),
    完成手机登录: vi.fn(),
    开始微信登录: vi.fn(),
    退出登录: vi.fn(),
    // P6：Agent 规则 / 提案 facade（Task 3 起操作层会调用；默认全空集）
    读取Agent规则: vi.fn(async (): Promise<unknown[]> => []),
    读取单条Agent规则: vi.fn(async () => ({
      rule_id: 'rul_0123456789abcdef0123456789abcdef',
      version: 1,
      state: 'active' as const,
      scope: { type: 'global' as const },
      clause_kinds: [] as never[],
      display_text: 'x',
      created_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
    })),
    修改Agent规则: vi.fn(async () => ({
      rule_id: 'rul_0123456789abcdef0123456789abcdef',
      version: 1,
      state: 'active' as const,
      scope: { type: 'global' as const },
      clause_kinds: [] as never[],
      display_text: 'x',
      created_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
    })),
    删除Agent规则: vi.fn(async () => undefined),
    创建Agent规则提案: vi.fn(async () => ({ proposal_id: 'arp_0123456789abcdef0123456789abcdef', state: 'interpreting' as const })),
    读取Agent规则提案: vi.fn(async () => ({ proposal_id: 'arp_0123456789abcdef0123456789abcdef', state: 'interpreting' as const })),
    读取Agent规则提案列表: vi.fn(async () => [] as never[]),
    接受Agent规则提案: vi.fn(async () => ({
      rule_id: 'rul_0123456789abcdef0123456789abcdef',
      version: 1,
      state: 'active' as const,
      scope: { type: 'global' as const },
      clause_kinds: [] as never[],
      display_text: 'x',
      created_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
    })),
    放弃Agent规则提案: vi.fn(async () => ({ proposal_id: 'arp_0123456789abcdef0123456789abcdef', state: 'dismissed' as const })),
    创建Agent规则替换提案: vi.fn(async () => ({ proposal_id: 'arp_0123456789abcdef0123456789abcdef', state: 'interpreting' as const })),
    // P2 Task 3：附件库第四支持域（candidate mount 水合会调用；默认空库成功）
    读取附件简历库: vi.fn(async (): Promise<BFF附件简历库> => ({
      items: [],
      limits: { max_files: 3, max_file_bytes: 10485760, accepted_media_types: ['application/pdf'] },
    })),
    // P5 Task 3：MatchCase 域 facade（默认空页/空详情成功，mutation 默认 void；逐用例覆盖）
    读取P5Open列表: vi.fn(async (): Promise<P5列表页> => ({ role: 'candidate', items: [], nextCursor: null })),
    读取P5历史: vi.fn(async (): Promise<P5列表页> => ({ role: 'candidate', items: [], nextCursor: null })),
    读取P5详情: vi.fn(async (): Promise<P5详情> => P5候选详情DTO),
    回答P5事实: vi.fn(async (): Promise<void> => undefined),
    提交P5简历: vi.fn(async (): Promise<void> => undefined),
    决定P5S0: vi.fn(async (): Promise<void> => undefined),
    决定P5S1: vi.fn(async (): Promise<void> => undefined),
    决定P5S2: vi.fn(async (): Promise<void> => undefined),
    决定P5S3: vi.fn(async (): Promise<void> => undefined),
    新增P5叮嘱: vi.fn(async (): Promise<void> => undefined),
    读取P5简历PDF: vi.fn(async (): Promise<BFF二进制响应> => ({
      blob: { type: 'application/pdf' } as Blob,
      contentType: 'application/pdf',
      contentDisposition: null,
      requestId: 'fixture',
    })),
    // J-PILOT-01 Task 2：连续代谈 facade（默认空页 / canonical=输入坐标的聚合详情成功）
    读取候选连续列表: vi.fn(async (): Promise<NegotiationPage> => ({ items: [], next_cursor: null })),
    读取候选连续详情: vi.fn(async (recordId: string): Promise<NegotiationDetail> => ({
      ...连续聚合DTO,
      record_id: recordId,
      case_detail: recordId.startsWith('mc_') ? P5候选详情DTO : null,
    })),
    // J-PILOT-01 Task 3：委托创建与失败初评动作 facade（默认受理成功，逐用例覆盖）
    创建候选岗位委托: vi.fn(async (): Promise<unknown[]> => []),
    重试候选连续记录: vi.fn(async (): Promise<{ record_id: string; retry_generation: number }> =>
      ({ record_id: 连续记录A, retry_generation: 0 })),
    归档候选连续记录: vi.fn(async (): Promise<{ record_id: string; archived_at: string }> =>
      ({ record_id: 连续记录A, archived_at: '2026-08-29T03:00:00Z' })),
    // P7 Task 2：真人会话域 facade（默认空页/空详情成功，mutation 默认成功；逐用例覆盖）
    读取会话列表: vi.fn(async (): Promise<P7会话页> => ({ items: [], nextCursor: null })),
    读取会话: vi.fn(async (): Promise<P7会话项> => ({
      conversationId: '3003', caseId: 'mc_3003', kind: 'human_handoff',
      lastMessage: null, lastActivityAt: '2026-08-30T01:00:00Z', unreadCount: 0,
      contextStatus: 'unavailable', context: null,
    })),
    读取消息: vi.fn(async (): Promise<P7消息页> => ({ messages: [], nextCursor: null })),
    发送消息: vi.fn(async (): Promise<P7消息> => ({
      messageId: '4005', kind: 'user_text', senderRole: 'candidate',
      content: '你好', createdAt: '2026-08-30T01:00:00Z',
    })),
    标为已读: vi.fn(async (): Promise<string> => '4004'),
    // P8 Task 3：控制面域 facade（默认空凭证 + 单当前会话成功，mutation 默认成功；逐用例覆盖）
    读取P8凭证: vi.fn(async (): Promise<P8Credential[]> => []),
    读取P8会话: vi.fn(async (): Promise<P8Session[]> => [{
      sessionId: 'sess_0000000000000001',
      createdAt: '2026-08-30T00:00:00Z',
      expiresAt: '2026-09-05T00:00:00Z',
      current: true,
    }]),
    开始P8手机号换绑: vi.fn(async () => ({
      attemptId: 'att_0123456789abcdef',
      nextAction: { type: 'enter_code' as const, expiresAt: null, retryAfterSeconds: null },
    })),
    完成P8手机号换绑: vi.fn(async () => ({
      credential: {
        credentialId: 'cred_0000000000000009',
        provider: 'phone_otp' as const,
        display: '+86 139 **** 1111',
        verifiedAt: '2026-08-31T10:00:00Z',
      },
      revokedSessions: 0,
      unchanged: true,
    })),
    退出P8其他设备: vi.fn(async (): Promise<number> => 0),
    // P8 Task 5：导出/注销 facade（默认创建 queued、GET running、同源下载地址、注销 202；逐用例覆盖）
    创建P8数据导出: vi.fn(async (): Promise<P8DataExport> => ({
      exportId: `exp_${'0123456789abcdef'.repeat(2)}`,
      status: 'queued',
      createdAt: '2026-08-30T00:00:00Z',
      expiresAt: null,
      downloadReady: false,
    })),
    读取P8数据导出: vi.fn(async (id: string): Promise<P8DataExport> => ({
      exportId: id,
      status: 'running',
      createdAt: '2026-08-30T00:00:00Z',
      expiresAt: null,
      downloadReady: false,
    })),
    取P8数据导出下载地址: vi.fn((id: string): string => `/api/v1/me/data-exports/${id}/download`),
    请求P8账号注销: vi.fn(async (): Promise<P8AccountDeletion> => ({
      deletionId: `del_${'0123456789abcdef'.repeat(2)}`,
      status: 'deletion_pending',
      retentionUntil: '2026-09-29T00:00:00Z',
    })),
    // 接触记录域 facade（默认空页成功；逐用例覆盖）
    读取接触事件: vi.fn(async (): Promise<接触事件页> => ({ items: [], nextCursor: null })),
    // 候选实名域 facade（默认待审摘要成功；逐用例覆盖）
    读取候选实名: vi.fn(async (): Promise<候选实名摘要> => 待审实名摘要),
    创建候选实名申请: vi.fn(async (): Promise<候选实名摘要> => 待审实名摘要),
    取消候选实名申请: vi.fn(async (): Promise<候选实名摘要> => 取消后实名摘要),
    // stg 契约对齐 2026-09-14：Onboarding 域 facade（默认候选未完成 —— 草稿旅程是本文件
    // 候选用例的常态；已完成用例显式覆盖）
    读取Onboarding: vi.fn(async (): Promise<{ roles: { role: 'candidate' | 'recruiter'; status: 'active' | 'suspended'; completed_at: string | null }[] }> => ({
      roles: [{ role: 'candidate', status: 'active', completed_at: null }],
    })),
    完成Onboarding: vi.fn(async () => ({
      role: 'candidate' as const,
      status: 'active' as const,
      completed_at: '2026-09-14T08:00:00Z',
    })),
    // 助手会话域 facade（Task 4：默认空历史页；发送/轮询/重试逐用例覆盖）
    读取助手历史: vi.fn(async (): Promise<AssistantMessagePage> => ({ items: [], next_cursor: null })),
    发送助手消息: vi.fn(),
    读取助手轮次: vi.fn(),
    重试助手轮次: vi.fn(),
  };
}

export async function 通过测试手机登录(当前: ReturnType<typeof use应用状态>, code = '1234'): Promise<void> {
  await 当前.操作.开始手机登录('13800000000');
  await 当前.操作.完成手机登录(code);
}

/** 候选实名域 fixture：待审 / 取消后的 owner summary（页面域命名，data source 已解码形状）。 */
export const 待审实名摘要: 候选实名摘要 = {
  status: 'pending',
  verifiedName: null,
  currentRequest: { requestId: 'ivq_1', status: 'pending', revision: 3, submittedAt: '2026-09-04T08:00:00Z', rejectionReason: null },
  revision: 7,
  updatedAt: '2026-09-04T08:00:01Z',
};

export const 取消后实名摘要: 候选实名摘要 = {
  status: 'unverified',
  verifiedName: null,
  currentRequest: { requestId: 'ivq_1', status: 'cancelled', revision: 5, submittedAt: '2026-09-04T08:00:00Z', rejectionReason: null },
  revision: 8,
  updatedAt: '2026-09-04T09:30:00Z',
};

/** P7 Task 5：受控假 WebSocket —— jsdom 无实现，Provider 的同源事件连接用桩。 */
export class 假WebSocket {
  static 构造记录: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((事件: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;
  constructor(url: string) {
    this.url = url;
    假WebSocket.构造记录.push(url);
  }
  close() { this.onclose?.(); }
}

/** Map 存储的 localStorage 桩：setItem/getItem 可往返，用于断言 Mock 原型键字节不变。 */
export function 创建Map存储() {
  const 存 = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => 存.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { 存.set(key, value); }),
    removeItem: vi.fn((key: string) => { 存.delete(key); }),
    clear: vi.fn(() => 存.clear()),
  };
}

/** 测试辅助：派发一个带引用的 存引导预填（避免每个测试重复写一长串参数） */
export function current派发引导预填(当前: ReturnType<typeof use应用状态>, 城市: string) {
  当前.派发({
    型: '存引导预填',
    城市们: [城市],
    职位: ['产品经理'],
    城市引用们: [{ id: 'loc_sh', display_name: 城市 }],
    职位引用们: [{ id: 'tax_pm', display_name: '产品经理' }],
  });
}

export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
