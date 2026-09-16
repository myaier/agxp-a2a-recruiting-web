// e2e/fixtures/bff/账号控制面.ts
// P8 控制面域 fixture（C2）：凭证/会话/换绑、数据导出、注销与合规反馈/举报的
// wire 形与可变 fixture 工厂，从 e2e/数据源模式.spec.ts 原样迁出。
// 可变状态归每次 安装BFF路由 所有。
import { P4深克隆 } from './发现推荐';
import { 信封, type 路由上下文形 } from './协议';
import type { P3隐私fixture形 } from './隐私与实名';

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


// ── 路由 handler（C2 阶段二迁入）──

export async function 处理账号控制面域(
  P8域: P8FixtureState | null,
  P3域: P3隐私fixture形 | null,
  上下文: 路由上下文形,
): Promise<boolean> {
  if (P8域 === null) return false;
  const { route, 请求, path, method, body } = 上下文;

  // ── P8 控制面域（Task 8）：可变 fixture 在场才应答；JSON 应答带 no-store。
  //    每个变更先存证（method/path/body/原文/键/Origin），幂等按「同键同原文重放、
  //    同键异原文冲突」收口；专用分支按 fixture 标记选择固定应答且绝不写状态。──
  const P8答复 = async (结果: unknown, 状态 = 200) => {
    await route.fulfill({ status: 状态, json: 信封(结果), headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  };
  const P8失败 = async (状态: number, 码: string) => {
    // 合规 429 刻意不带 Retry-After：没有可等的窗口，倒计时/自动重试都该不存在
    await route.fulfill({ status: 状态, json: { error: { type: 码, message: 'P8 fixture 固定分支' } } });
  };
  const P8原文 = (): string | null => (method === 'GET' ? null : 请求.postData());
  const P8键 = (): string => 请求.headers()['idempotency-key'] ?? '';
  const P8记录变更 = () => {
    P8域.变更请求.push({
      method,
      path,
      body,
      原文: P8原文(),
      idempotencyKey: 请求.headers()['idempotency-key'] ?? null,
      origin: 请求.headers()['origin'] ?? null,
    });
  };
  type P8幂等判 = { 型: '坏键' } | { 型: '冲突' } | { 型: '重放'; 回执: unknown } | { 型: '新' };
  const P8幂等查 = (): P8幂等判 => {
    if (!P8键模式.test(P8键())) return { 型: '坏键' };
    const 登记项 = P8域.幂等表.get(P8键());
    if (登记项 === undefined) return { 型: '新' };
    if (登记项.原文 !== P8原文()) return { 型: '冲突' };
    return { 型: '重放', 回执: 登记项.receipt };
  };
  const P8登记幂等 = (回执: unknown) => {
    P8域.幂等表.set(P8键(), { 原文: P8原文(), receipt: P4深克隆(回执) });
  };
  const P8已注销 = () => P8域.分支.已注销 === true;

  // 凭证列表：挂起分支只挂第一次，应答体在请求抵达时快照（迟到应答携带旧数据）
  if (path === '/api/v1/me/credentials' && method === 'GET') {
    if (P8已注销()) {
      await P8失败(401, 'invalid_session');
      return true;
    }
    const 快照 = P8域.凭证们.map((条) => ({ ...条 }));
    if (P8域.分支.挂起凭证读取 && P8域.凭证读取数 === 0) await P8域.分支.挂起凭证读取;
    P8域.凭证读取数 += 1;
    await P8答复({ credentials: 快照 });
    return true;
  }

  // 会话列表：恰好一条 current（换绑/退出其他设备只清洗非 current 行）
  if (path === '/api/v1/security/sessions' && method === 'GET') {
    if (P8已注销()) {
      await P8失败(401, 'invalid_session');
      return true;
    }
    await P8答复({ sessions: P8域.会话们.map((条) => ({ ...条 })) });
    return true;
  }

  // 换绑开始：body 恒 {phone:'+86…'}（操作层只放行 11 位裸号，E.164 由 facade 构造）
  if (path === '/api/v1/me/credential-replacement-attempts' && method === 'POST') {
    P8记录变更();
    const 查 = P8幂等查();
    if (查.型 === '坏键') { await P8失败(400, 'invalid_request_body'); return true; }
    if (查.型 === '冲突') { await P8失败(409, 'idempotency_conflict'); return true; }
    if (查.型 === '重放') { await P8答复(P4深克隆(查.回执)); return true; }
    const 回执 = {
      attempt_id: P8编号.换绑尝试,
      next_action: { type: 'enter_code', expires_at: '2026-09-01T09:00:00Z' },
    };
    P8登记幂等(回执);
    await P8答复(P4深克隆(回执));
    return true;
  }

  // 换绑完成：清洗其他会话、保留 current，唯一 phone_otp 行换上回执掩码；
  // 冲突分支终局；首答未知分支已受理已落库（重放同键回同一张回执）
  const P8换绑完成匹配 = /^\/api\/v1\/me\/credential-replacement-attempts\/([^/]+)\/complete$/.exec(path);
  if (P8换绑完成匹配 && method === 'POST') {
    P8记录变更();
    const 查 = P8幂等查();
    if (查.型 === '坏键') { await P8失败(400, 'invalid_request_body'); return true; }
    if (查.型 === '冲突') { await P8失败(409, 'idempotency_conflict'); return true; }
    if (查.型 === '重放') { await P8答复(P4深克隆(查.回执)); return true; }
    if (P8域.分支.换绑冲突) {
      await P8失败(409, 'credential_replacement_conflict');
      return true;
    }
    const 清洗前其他数 = P8域.会话们.filter((条) => !条.current).length;
    P8域.会话们 = P8域.会话们.filter((条) => 条.current);
    const 新凭证: P8凭证wire形 = {
      credential_id: P8编号.手机凭证,
      provider: 'phone_otp',
      display: P8标记.换绑后掩码,
      verified_at: '2026-09-01T08:30:00Z',
    };
    P8域.凭证们 = [新凭证, ...P8域.凭证们.filter((条) => 条.provider !== 'phone_otp')];
    const 回执 = { credential: { ...新凭证 }, revoked_sessions: 清洗前其他数, unchanged: false };
    P8登记幂等(回执);
    if (P8域.分支.换绑完成首答未知) {
      P8域.分支.换绑完成首答未知 = false; // 已受理已落库：首答 503，同键受控重放回回执
      await route.fulfill({
        status: 503,
        headers: { 'Retry-After': '0' },
        json: { error: { type: 'operation_outcome_unknown', message: 'P8 fixture 换绑完成首答未知' } },
      });
      return true;
    }
    await P8答复(P4深克隆(回执));
    return true;
  }

  // 退出其他设备：DELETE 无请求体；清洗非 current 会话，回执计数原样
  if (path === '/api/v1/security/sessions/others' && method === 'DELETE') {
    P8记录变更();
    const 查 = P8幂等查();
    if (查.型 === '坏键') { await P8失败(400, 'invalid_request_body'); return true; }
    if (查.型 === '冲突') { await P8失败(409, 'idempotency_conflict'); return true; }
    if (查.型 === '重放') { await P8答复(P4深克隆(查.回执)); return true; }
    const 清洗数 = P8域.会话们.filter((条) => !条.current).length;
    P8域.会话们 = P8域.会话们.filter((条) => 条.current);
    const 回执 = { revoked_sessions: 清洗数 };
    P8登记幂等(回执);
    await P8答复(P4深克隆(回执));
    return true;
  }

  // 创建数据导出：该路由不携带请求体 —— 任何 body 都按 400 拒绝；
  // 已有 queued/running/ready 导出时 409 export_in_progress；expired/failed 可重建
  if (path === '/api/v1/me/data-exports' && method === 'POST') {
    P8记录变更();
    if (请求.postData() !== null) {
      await P8失败(400, 'invalid_request_body');
      return true;
    }
    const 查 = P8幂等查();
    if (查.型 === '坏键') { await P8失败(400, 'invalid_request_body'); return true; }
    if (查.型 === '冲突') { await P8失败(409, 'idempotency_conflict'); return true; }
    if (查.型 === '重放') { await P8答复(P4深克隆(查.回执)); return true; }
    const 旧 = P8域.导出.数据;
    if (旧 !== null && (旧.status === 'queued' || 旧.status === 'running' || 旧.status === 'ready')) {
      await P8失败(409, 'export_in_progress');
      return true;
    }
    const 序号 = P8域.导出.下一个序号;
    P8域.导出.下一个序号 += 1;
    const 状态 = P8域.导出.状态脚本[0] ?? 'queued';
    P8域.导出.数据 = {
      export_id: `exp_${序号.toString(16).padStart(32, '0')}`,
      status: 状态,
      created_at: '2026-09-01T08:00:00Z',
      expires_at: '2026-09-08T00:00:00Z',
      download_ready: 状态 === 'ready',
    };
    P8域.导出.读数 = 0;
    const 回执 = { ...P8域.导出.数据 };
    P8登记幂等(回执);
    await P8答复(P4深克隆(回执));
    return true;
  }

  // 读取数据导出：当前导出才 200，其余一律 404 data_export_not_found（过期回收/他端清理）；
  // 注销后的保护读取先于存在性判定按 invalid_session 收口
  const P8导出匹配 = /^\/api\/v1\/me\/data-exports\/([^/]+)$/.exec(path);
  if (P8导出匹配 && method === 'GET') {
    if (P8已注销()) {
      await P8失败(401, 'invalid_session');
      return true;
    }
    const 编号 = decodeURIComponent(P8导出匹配[1]);
    if (P8域.导出.数据 === null || P8域.导出.数据.export_id !== 编号) {
      await P8失败(404, 'data_export_not_found');
      return true;
    }
    P8域.导出.读数 += 1;
    const 推进 = P8域.导出.状态脚本[P8域.导出.读数] ?? P8域.导出.状态脚本.at(-1) ?? 'ready';
    P8域.导出.数据.status = 推进;
    P8域.导出.数据.download_ready = 推进 === 'ready';
    P8域.导出读取.push({ exportId: 编号, origin: 请求.headers()['origin'] ?? null });
    await P8答复({ ...P8域.导出.数据 });
    return true;
  }

  // 下载：只在 ready+download_ready 应答固定头的 application/zip 字节流；
  // 注销后的保护读取先于存在性判定按 invalid_session 收口
  const P8下载匹配 = /^\/api\/v1\/me\/data-exports\/([^/]+)\/download$/.exec(path);
  if (P8下载匹配 && method === 'GET') {
    if (P8已注销()) {
      await P8失败(401, 'invalid_session');
      return true;
    }
    const 编号 = decodeURIComponent(P8下载匹配[1]);
    P8域.导出下载.push({ exportId: 编号, origin: 请求.headers()['origin'] ?? null, contentType: 'application/zip' });
    const 当前 = P8域.导出.数据;
    if (当前 === null || 当前.export_id !== 编号 || 当前.status !== 'ready' || !当前.download_ready) {
      await P8失败(404, 'data_export_not_found');
      return true;
    }
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${P8标记.ZIP文件名}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
      body: P8ZIP字节,
    });
    return true;
  }

  // 账号注销：body 精确 {}（EmptyRequest）；queued/running 导出挡注销（409）；
  // 202 后置位 已注销 —— 后续保护读取一律 401 invalid_session
  if (path === '/api/v1/me/account-deletion' && method === 'POST') {
    P8记录变更();
    if (请求.postData() !== '{}') {
      await P8失败(400, 'invalid_request_body');
      return true;
    }
    const 查 = P8幂等查();
    if (查.型 === '坏键') { await P8失败(400, 'invalid_request_body'); return true; }
    if (查.型 === '冲突') { await P8失败(409, 'idempotency_conflict'); return true; }
    if (查.型 === '重放') { await P8答复(P4深克隆(查.回执), 202); return true; }
    const 当前 = P8域.导出.数据;
    if (当前 !== null && (当前.status === 'queued' || 当前.status === 'running')) {
      await P8失败(409, 'export_in_progress');
      return true;
    }
    const 回执 = {
      deletion_id: P8编号.注销,
      status: 'deletion_pending',
      retention_until: '2026-10-01T00:00:00Z',
    };
    P8登记幂等(回执);
    P8域.分支.已注销 = true;
    await P8答复(P4深克隆(回执), 202);
    return true;
  }

  // 合规反馈：body 恰 {category,details}；429 分支终局且无 Retry-After
  if (path === '/api/v1/compliance/feedback' && method === 'POST') {
    P8记录变更();
    const 查 = P8幂等查();
    if (查.型 === '坏键') { await P8失败(400, 'invalid_request_body'); return true; }
    if (查.型 === '冲突') { await P8失败(409, 'idempotency_conflict'); return true; }
    if (查.型 === '重放') { await P8答复(P4深克隆(查.回执)); return true; }
    if (P8域.分支.反馈限流) {
      await P8失败(429, 'rate_limited');
      return true;
    }
    P8域.反馈受理 += 1;
    const 回执 = { ticket_id: P8标记.反馈工单, status: 'received' };
    P8登记幂等(回执);
    await P8答复(P4深克隆(回执));
    return true;
  }

  // 合规举报：block_unavailable 零写入、404 目标不存在统一收口、
  // applied 把组织写进 P3 隐私 fixture 的权威视图（屏蔽名单只认权威视图）
  if (path === '/api/v1/compliance/reports' && method === 'POST') {
    P8记录变更();
    const 查 = P8幂等查();
    if (查.型 === '坏键') { await P8失败(400, 'invalid_request_body'); return true; }
    if (查.型 === '冲突') { await P8失败(409, 'idempotency_conflict'); return true; }
    if (查.型 === '重放') { await P8答复(P4深克隆(查.回执)); return true; }
    const 换 = body as { target?: { type?: string; ref?: string }; reason?: string; also_block?: boolean };
    if (P8域.分支.举报目标不存在) {
      await P8失败(404, 'report_target_not_found');
      return true;
    }
    if (P8域.分支.举报屏蔽不可用 && 换.also_block === true) {
      await P8失败(409, 'block_unavailable');
      return true;
    }
    P8域.举报受理 += 1;
    const 屏蔽生效 = 换.also_block === true;
    if (屏蔽生效 && 换.target) {
      const 组织 = P8域.举报屏蔽组织[`${换.target.type}:${换.target.ref}`];
      if (组织 && P3域) {
        P3域.视图.organization_blocks.push({
          organization_id: 组织.organization_id,
          organization_display_name: 组织.organization_display_name,
          organization_status: 'active',
          source: 'manual',
          created_at: '2026-09-01T09:00:00Z',
        });
        P3域.视图.revision += 1;
        P3域.视图.updated_at = '2026-09-01T09:00:00Z';
      }
    }
    const 回执 = {
      ticket_id: P8标记.举报工单,
      status: 'received',
      block_status: 屏蔽生效 ? 'applied' : 'not_requested',
    };
    P8登记幂等(回执);
    await P8答复(P4深克隆(回执));
    return true;
  }
  return false;
}
