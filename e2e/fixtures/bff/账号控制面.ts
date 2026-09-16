// e2e/fixtures/bff/账号控制面.ts
// P8 控制面域 fixture（C2）：凭证/会话/换绑、数据导出、注销与合规反馈/举报的
// wire 形与可变 fixture 工厂，从 e2e/数据源模式.spec.ts 原样迁出。
// 可变状态归每次 安装BFF路由 所有。

// ── P8 控制面域 fixture 与工厂 ──

// ─────────────────────────────────────────────────────────────────────────────
// P8 控制面域可变 fixture（Task 8）。账号安全（凭证/会话/退出其他设备/换绑）、
// 数据导出、账号注销与合规反馈/上下文举报。wire 形就地声明，不反向依赖 src；
// 标记值（P8标记）只存在于 fixture，Mock 数据里没有 —— 断言页面展示它们即证明
// 渲染来自 HTTP 而非 Mock。可变状态归每次 安装BFF路由 所有：
//   · 变更请求 存证 method/path/body/原始字节(postData 字符串，同意图重放按字节
//     比对)/Idempotency-Key/Origin（Origin 断言浏览器同源边界）；
//   · 幂等表：同键同原文重放同一张回执，同键异原文 409 idempotency_conflict，
//     缺键/坏键 400 invalid_request_body；创建导出还拒绝任何请求体，注销 body 精确 {}；
//   · 换绑完成清洗其他会话但保留 current；导出 GET 按状态脚本推进 queued→running→ready，
//     download 只在 ready 应答 application/zip 固定头（固定 ZIP 字节，绝不进浏览器内存状态）；
//   · 举报 block_unavailable 零写入、404 目标不存在统一收口、applied 把组织写进
//     P3 隐私 fixture 的权威视图（举报屏蔽组织 表把 target 映射到组织坐标）；
//   · 注销 202 后 分支.已注销 置位：session/me 与全部 P8 保护读取一律 401 invalid_session。
// ─────────────────────────────────────────────────────────────────────────────

/** 与 HTTP客户端 的 IdempotencyKeyHeader 同口径：16–128 个可见 ASCII 字节。 */
export const P8键模式 = /^[!-~]{16,128}$/;

/** 下载应答的固定 ZIP 字节（route fixture 应答体，PK\x03\x04 开头的 ZIP 魔数）。
 *  锚点下载由浏览器下载管理器接管，Playwright 的 route/request 都看不到该请求
 * （探针实证）——浏览器边界上的证据是 download 事件的同源 /download URL 与点击前
 * 的权威预检 GET；ZIP 字节/固定应答头由本 fixture 与单测覆盖。 */
export const P8ZIP字节 = Buffer.from('PKagxp-p8-fixture-export-archive\n');

export const P8编号 = {
  手机凭证: 'crd_p8_phone_0000000000000001',
  微信凭证: 'crd_p8_wechat_0000000000000001',
  当前会话: 'sess_p8_current_000000000001',
  他机会话甲: 'sess_p8_other_00000000000001',
  他机会话乙: 'sess_p8_other_00000000000002',
  换绑尝试: 'cra_p8_attempt_0000000000001',
  /** 导出/注销 ID 必须匹配发布 pattern（exp_/del_ + 32 位小写十六进制） */
  导出甲: `exp_${'1'.padStart(32, '0')}`,
  注销: `del_${'1'.padStart(32, '0')}`,
} as const;

export const P8标记 = {
  手机掩码: '+86 137 **** 3008',
  换绑后掩码: '+86 138 **** 9001',
  会话创建时间: '2026-09-01T08:00:00Z',
  会话失效时间: '2026-09-08T08:00:00Z',
  反馈工单: 'P8FB-fixture-20260901-0001',
  举报工单: 'P8RP-fixture-20260901-0001',
  屏蔽组织编号: 'org-fixture-p8-blocked',
  屏蔽组织名: 'P8 Fixture 星河科技',
  ZIP文件名: 'agxp-p8-fixture-export.zip',
} as const;

export type P8提供者词 = 'phone_otp' | 'wechat' | 'email_otp';
export type P8导出状态词 = 'queued' | 'running' | 'ready' | 'failed' | 'expired';

/** P8 wire 凭证行（与 BFF契约.BFF凭证 同构） */
export interface P8凭证wire形 {
  credential_id: string;
  provider: P8提供者词;
  display: string;
  verified_at: string;
}

/** P8 wire 会话行：无设备/地点/IP 字段（页面只展示创建/失效时间） */
export interface P8会话wire形 {
  session_id: string;
  created_at: string;
  expires_at: string;
  current: boolean;
}

/** P8 wire 导出（与 BFF契约.BFF数据导出 同构） */
export interface P8导出wire形 {
  export_id: string;
  status: P8导出状态词;
  created_at: string;
  expires_at: string | null;
  download_ready: boolean;
}

/** 变更回执存证：原文 = 请求 postData 字符串（无体路由为 null），同意图重放按字节比对。 */
export interface P8变更回执形 {
  method: string;
  path: string;
  body: unknown;
  原文: string | null;
  idempotencyKey: string | null;
  origin: string | null;
}

/** 专用分支：只有用例显式 seed 时才选择固定应答（fail closed 分支不写任何状态） */
export interface P8分支形 {
  /** 换绑完成首答 503 operation_outcome_unknown（服务端已受理并清洗会话）：受控重试同键回执收敛 */
  换绑完成首答未知?: boolean;
  /** 换绑完成一律 409 credential_replacement_conflict（终局，不写状态） */
  换绑冲突?: boolean;
  /** 带屏蔽的举报一律 409 block_unavailable（终局，零写入） */
  举报屏蔽不可用?: boolean;
  /** 举报一律 404 report_target_not_found（统一终局） */
  举报目标不存在?: boolean;
  /** 反馈一律 429 rate_limited 且不带 Retry-After（终局：没有可等的窗口） */
  反馈限流?: boolean;
  /** 第一次凭证 GET 挂起：应答体在请求抵达时快照（迟到应答携带旧主体数据） */
  挂起凭证读取?: Promise<void>;
  /** 注销 202 后置位：session/me 与全部 P8 保护读取一律 401 invalid_session */
  已注销?: boolean;
}

/** P8 控制面域可变 fixture：测试自持一份，安装路由后 handler 与测试共享同一对象 */
export interface P8FixtureState {
  凭证们: P8凭证wire形[];
  会话们: P8会话wire形[];
  变更请求: P8变更回执形[];
  /** 幂等登记：键 → { 原文, receipt }；同键同原文重放，同键异原文冲突 */
  幂等表: Map<string, { 原文: string | null; receipt: unknown }>;
  /** 导出状态机：POST 起步 状态脚本[0]，每次 GET 推进一格（末档保持） */
  导出: { 数据: P8导出wire形 | null; 读数: number; 状态脚本: P8导出状态词[]; 下一个序号: number };
  /** 导出状态 GET 存证（exportId + Origin） */
  导出读取: { exportId: string; origin: string | null }[];
  /** 下载 GET 存证（application/zip 固定头应答） */
  导出下载: { exportId: string; origin: string | null; contentType: string }[];
  /** 凭证 GET 计数（挂起分支只挂第一次） */
  凭证读取数: number;
  反馈受理: number;
  举报受理: number;
  /** 举报目标（type:ref）→ applied 时写进 P3 权威视图的组织坐标 */
  举报屏蔽组织: Record<string, { organization_id: string; organization_display_name: string }>;
  分支: P8分支形;
}

export function 创建P8fixture(分支: P8分支形 = {}): P8FixtureState {
  return {
    凭证们: [
      { credential_id: P8编号.手机凭证, provider: 'phone_otp', display: P8标记.手机掩码, verified_at: '2026-08-01T00:00:00Z' },
      { credential_id: P8编号.微信凭证, provider: 'wechat', display: '微信 · P8 Fixture 绑定', verified_at: '2026-08-02T00:00:00Z' },
    ],
    会话们: [
      { session_id: P8编号.当前会话, created_at: P8标记.会话创建时间, expires_at: P8标记.会话失效时间, current: true },
      { session_id: P8编号.他机会话甲, created_at: '2026-08-30T10:00:00Z', expires_at: '2026-09-06T10:00:00Z', current: false },
      { session_id: P8编号.他机会话乙, created_at: '2026-08-29T10:00:00Z', expires_at: '2026-09-05T10:00:00Z', current: false },
    ],
    变更请求: [],
    幂等表: new Map(),
    导出: { 数据: null, 读数: 0, 状态脚本: ['queued', 'running', 'ready'], 下一个序号: 1 },
    导出读取: [],
    导出下载: [],
    凭证读取数: 0,
    反馈受理: 0,
    举报受理: 0,
    举报屏蔽组织: {},
    分支,
  };
}
