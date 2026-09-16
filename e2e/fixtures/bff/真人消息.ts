// e2e/fixtures/bff/真人消息.ts
// P7 真人会话域 fixture（C2）：收件箱/详情/消息分页的 wire 投影与可变 fixture 工厂，
// 从 e2e/数据源模式.spec.ts 原样迁出。可变状态归每次 安装BFF路由 所有。
import { 信封, type 路由上下文形 } from './协议';

// ── P7 真人会话域 fixture 与工厂 ──

// ─────────────────────────────────────────────────────────────────────────────
// P7 真人会话域可变 fixture（Task 7）。双端（候选 me / 招聘 recruiter）conversations
// 的收件箱、详情、消息分页、纯文本发送（Idempotency-Key 同键重放只落一条）、
// forward-only 已读（PUT 后该角色未读归零）与 context 投影（available /
// unavailable 演练）。消息分页响应键是实际实现的 { messages, next_cursor }，
// 已读回执是 { read_through_message_id }。会话不能由浏览器创建：fixture 只预置
// 3003 一条会话，9900 可标记不存在（foreign / wrong-role 404 演练）。
// ─────────────────────────────────────────────────────────────────────────────

export const P7会话编号 = {
  会话: '3003',
  案例: 'mc_p7_000000000000000000000001',
  职位: 'job_00112233445566778899aabbccddeeff',
  简历: 'rf_00112233445566778899aabbccddeeff',
} as const;

export const P7标记 = {
  职位名: 'P7 Fixture 后端工程师',
  地点: 'P7 Fixture 市',
  候选代号: 'candidate-p7fixture01',
  候选消息: 'P7 Fixture 候选：想约明天下午聊聊',
  招聘消息: 'P7 Fixture 招聘：可以，下午三点见',
  招聘回复: 'P7 Fixture 招聘：没问题，明天下午三点',
} as const;

export type P7角色词 = 'candidate' | 'recruiter';

export interface P7消息wire形 {
  message_id: string;
  kind: 'user_text';
  sender_role: P7角色词;
  content: string;
  created_at: string;
}

export interface P7FixtureState {
  messages: Record<string, P7消息wire形[]>;
  unread: Record<P7角色词, number>;
  sends: Array<{ role: P7角色词; key: string; content: string }>;
  reads: Array<{ role: P7角色词; through: string }>;
  /** 详情 context 投影：'unavailable' 或显式上下文（ref 可缺省隐藏动作）；缺省 available + 职位上下文 */
  contexts: Record<string, { primary_label: string; secondary_label: string; job_ref?: string; resume_ref?: string } | 'unavailable'>;
  /** 标记为不存在的会话坐标（foreign / wrong-role 404） */
  不存在: string[];
  /** 发送首答 503 operation_outcome_unknown（消息已落库、响应未知）：受控重试同键重放收敛一条 */
  首答未知: boolean;
}

export function 创建P7fixture(): P7FixtureState {
  return {
    messages: { [P7会话编号.会话]: [] },
    unread: { candidate: 0, recruiter: 0 },
    sends: [],
    reads: [],
    contexts: {},
    不存在: [],
    首答未知: false,
  };
}

/** 会话条 wire：双端共用一条 3003；context 不可用只降级展示字段（消息事实仍在）。 */
export function P7会话项wire(P7域: P7FixtureState, id: string, role: P7角色词): Record<string, unknown> {
  const 消息们 = P7域.messages[id] ?? [];
  const 最后 = 消息们.at(-1) ?? null;
  const 上下文 = P7域.contexts[id] ?? {
    primary_label: P7标记.职位名,
    secondary_label: role === 'candidate' ? P7标记.地点 : P7标记.候选代号,
    job_ref: P7会话编号.职位,
    resume_ref: P7会话编号.简历,
  };
  const 条: Record<string, unknown> = {
    conversation_id: id,
    case_id: P7会话编号.案例,
    kind: 'human_handoff',
    last_message: 最后 === null
      ? null
      : { message_id: 最后.message_id, sender_role: 最后.sender_role, preview: 最后.content, created_at: 最后.created_at },
    last_activity_at: 最后?.created_at ?? '2026-08-30T00:00:00Z',
    unread_count: P7域.unread[role],
    context_status: 上下文 === 'unavailable' ? 'unavailable' : 'available',
  };
  if (上下文 !== 'unavailable') 条.context = { ...上下文 };
  return 条;
}


// ── 路由 handler（C2 阶段二迁入）──

export async function 处理真人消息域(
  P7域: P7FixtureState | null,
  上下文: 路由上下文形,
): Promise<boolean> {
  if (P7域 === null) return false;
  const { route, 请求, path, method, body } = 上下文;

  // ── P7 真人会话域（Task 7）：可变 fixture 在场才应答；每个 JSON 应答带 no-store。
  //    路由匹配：收件箱（无坐标）→ 详情 / 消息 / 已读（带坐标）。发送登记
  //    Idempotency-Key：同键重放回已落库的那一条（不重复追加）；首答未知分支
  //    消息已落库但响应 503，客户端受控重试同键收敛。已读 PUT 后该角色未读归零。──
  const P7答复 = async (状态: number, json: unknown) => {
    await route.fulfill({ status: 状态, json, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  };
  const P7匹配 = /^\/api\/v1\/(me|recruiter)\/conversations(?:\/([^/]+))?(?:\/(messages|read))?$/.exec(path);
  if (P7匹配) {
    const 角色: P7角色词 = P7匹配[1] === 'me' ? 'candidate' : 'recruiter';
    const 坐标 = P7匹配[2] ?? null;
    const 子路径 = P7匹配[3] ?? null;
    if (坐标 === null && method === 'GET') {
      await P7答复(200, 信封({ items: [P7会话项wire(P7域, P7会话编号.会话, 角色)], next_cursor: null }));
      return true;
    }
    if (坐标 !== null && !P7域.不存在.includes(坐标)) {
      if (子路径 === null && method === 'GET') {
        await P7答复(200, 信封(P7会话项wire(P7域, 坐标, 角色)));
        return true;
      }
      if (子路径 === 'messages' && method === 'GET') {
        await P7答复(200, 信封({ messages: P7域.messages[坐标] ?? [], next_cursor: null }));
        return true;
      }
      if (子路径 === 'messages' && method === 'POST') {
        const 键 = 请求.headers()['idempotency-key'] ?? '';
        const 正文 = (body as { content?: string }).content ?? '';
        P7域.sends.push({ role: 角色, key: 键, content: 正文 });
        const 已落库 = (P7域.messages[坐标] ?? []).find((条) => 条.sender_role === 角色 && 条.content === 正文);
        if (已落库) {
          // 同键重放 / 同文重复：幂等服务端只回已落库的那一条，绝不二次追加
          await P7答复(200, 信封(已落库));
          return true;
        }
        const 新消息: P7消息wire形 = {
          message_id: `${4005 + P7域.sends.length}`,
          kind: 'user_text', sender_role: 角色, content: 正文, created_at: '2026-08-30T02:00:00Z',
        };
        (P7域.messages[坐标] ??= []).push(新消息);
        if (P7域.首答未知) {
          P7域.首答未知 = false; // 消息已落库，但把首答替换成 503 结果未知
          await route.fulfill({
            status: 503,
            json: { error: { type: 'operation_outcome_unknown', message: 'The outcome is unknown.' } },
          });
          return true;
        }
        await P7答复(200, 信封(新消息));
        return true;
      }
      if (子路径 === 'read' && method === 'PUT') {
        const through = (body as { read_through_message_id?: string }).read_through_message_id ?? '';
        P7域.reads.push({ role: 角色, through });
        P7域.unread[角色] = 0;
        await P7答复(200, 信封({ read_through_message_id: through }));
        return true;
      }
    }
    if (坐标 !== null && P7域.不存在.includes(坐标)) {
      // foreign / wrong-role / unpublished 统一 404
      await route.fulfill({
        status: 404,
        json: { error: { type: 'conversation_not_found', message: 'The conversation does not exist.', request_id: 'p7-fixture' } },
      });
      return true;
    }
  }
  return false;
}
