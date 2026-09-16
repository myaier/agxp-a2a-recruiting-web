// e2e/fixtures/bff/Agent规则.ts
// P6 Agent 规则域 fixture（C2）：wire 形、标记值、规则/提案样本与专用分支配置，
// 从 e2e/数据源模式.spec.ts 原样迁出。可变状态归每次 安装BFF路由 所有。
import { 信封, type 路由上下文形 } from './协议';

// ── P6 Agent 规则域样本与工厂 ──

// ─────────────────────────────────────────────────────────────────────────────
// P6 Agent 规则域 fixture（Task 8）。wire 形与其他 fixture 一样就地声明，不反向依赖 src；
// 标记值只存在于 fixture，断言页面展示它们即证明渲染来自 HTTP 而非 Mock。
// 可变状态（规则 / 提案 / 读取计数 / 变更回执）归每次 安装BFF路由 所有，页面写入只影响本测试。
// ─────────────────────────────────────────────────────────────────────────────

/** P6 wire 规则形（与 BFF契约.BFFAgent规则 同构；fixture 不伪造缺失键，解码器按闭合契约拒收） */
export interface P6Rule {
  rule_id: string;
  version: number;
  state: 'active' | 'paused' | 'archived';
  scope: { type: 'global' } | { type: 'intention'; intention_id: string };
  clause_kinds: string[];
  display_text: string;
  created_at: string;
  updated_at: string;
}

/** P6 wire 提案形（与 BFF契约.BFFAgent规则提案 同构；interpreting 可带 created_at 但永不带正文） */
export interface P6Proposal {
  proposal_id: string;
  state: 'interpreting' | 'ready' | 'accepted' | 'dismissed' | 'failed';
  normalized_text?: string;
  consequence?: 'auto_allow' | 'auto_deny' | 'advisory' | 'mixed';
  created_at?: string;
}

export interface P6FixtureState {
  rules: Record<'candidate' | 'recruiter', P6Rule[]>;
  proposals: Record<'candidate' | 'recruiter', P6Proposal[]>;
  proposalReads: Record<string, number>;
  mutationRequests: { method: string; path: string; body: unknown; ifMatch: string | null; idempotencyKey: string | null }[];
}

export const P6标记 = {
  意向编号: 'int_00112233445566778899aabbccddeec1',
  候选全局规则: '不投单休大小周的公司（fixture 全局规则）',
  候选意向规则: '只看 Fixture 市的产品岗（fixture 意向规则）',
  招聘全局规则: '到岗超过 60 天的候选先不推进（fixture 规则）',
  冲突规则: '薪资低于 30K 的岗位自动跳过（fixture 冲突规则）',
  就绪提案正文: '命中大小周的岗位自动排除（fixture 就绪提案）',
  解读完成正文: '优先推进薪酬透明的岗位（fixture 解读完成）',
  不可接受提案正文: '只和讲清楚的招聘方谈（fixture 不可执行提案）',
  丢失提案正文: '晚上十点后不聊工作（fixture 响应丢失提案）',
  未知提案正文: '只看给缴社保的岗位（fixture 结果未知提案）',
  全局新建草稿: '不接受外包岗位（fixture 新建规则）',
  替换草稿: '只投双休岗位（fixture 替换规则）',
  招聘新建草稿: '两周内到岗的候选优先（fixture 招聘新建）',
  失败草稿: '这句语法不通顺代理理解不了（fixture 失败重试）',
  创建失败提示: 'Fixture 创建暂时失败',
} as const;

export const P6编号 = {
  候选全局规则: 'rul_00112233445566778899aabbccddeea1',
  候选意向规则: 'rul_00112233445566778899aabbccddeea2',
  招聘全局规则: 'rul_00112233445566778899aabbccddeea3',
  解释中提案: 'arp_00112233445566778899aabbccddeeb1',
  就绪提案: 'arp_00112233445566778899aabbccddeeb2',
} as const;

/** 专用分支 fixture ID：只有测试显式 seed 时才会进入状态并选择固定错误分支 */
export const P6分支编号 = {
  冲突规则: 'rul_00112233445566778899aabbccddeea4',
  不可接受提案: 'arp_00112233445566778899aabbccddeeb3',
  丢失提案: 'arp_00112233445566778899aabbccddeeb4',
  未知提案: 'arp_00112233445566778899aabbccddeeb5',
  失败提案: 'arp_00112233445566778899aabbccddeeb6',
} as const;

export function P6规则(覆盖: Partial<P6Rule> & Pick<P6Rule, 'rule_id' | 'display_text' | 'scope'>): P6Rule {
  return {
    version: 1,
    state: 'active',
    clause_kinds: ['work_schedule'],
    created_at: '2026-08-26T00:00:00Z',
    updated_at: '2026-08-26T00:00:00Z',
    ...覆盖,
  };
}

export const candidateGlobalRule: P6Rule = P6规则({
  rule_id: P6编号.候选全局规则,
  display_text: P6标记.候选全局规则,
  scope: { type: 'global' },
});
export const candidateIntentionRule: P6Rule = P6规则({
  rule_id: P6编号.候选意向规则,
  display_text: P6标记.候选意向规则,
  scope: { type: 'intention', intention_id: P6标记.意向编号 },
});
export const recruiterGlobalRule: P6Rule = P6规则({
  rule_id: P6编号.招聘全局规则,
  display_text: P6标记.招聘全局规则,
  scope: { type: 'global' },
});
/** 解读中提案（清单视图可带 created_at）：轮询的第二次单项 GET 把它转 ready */
export const candidateInterpretingProposal: P6Proposal = {
  proposal_id: P6编号.解释中提案,
  state: 'interpreting',
  created_at: '2026-08-26T00:00:00Z',
};
/** 就绪提案：auto_deny 专用 fixture —— 安全摘要逐字来自 consequence，页面不做任何浏览器侧判定 */
export const candidateReadyProposal: P6Proposal = {
  proposal_id: P6编号.就绪提案,
  state: 'ready',
  normalized_text: P6标记.就绪提案正文,
  consequence: 'auto_deny',
  created_at: '2026-08-26T00:00:00Z',
};

/** 专用分支提案的 seed：提案本体 + 它在 fixture 里走哪条固定错误分支（不进 wire 形） */
export interface P6追加提案 {
  提案: P6Proposal;
  分支?: 'accept丢失' | 'accept未知' | 'accept不可接受' | '单读失败';
}

export interface P6追加规则 {
  规则: P6Rule;
  分支?: '写入冲突';
}

/** fixture 内部提案元数据：草稿正文 / 权威解读 / 范围 / 替换目标 / 固定错误分支（不进 wire 形） */
export interface P6提案元数据形 {
  草稿?: string;
  权威正文?: string;
  后果?: P6Proposal['consequence'];
  scope?: P6Rule['scope'];
  替换目标编号?: string;
  分支?: P6追加提案['分支'];
}

/** P6 专用分支 fixture：按需叠加在基础状态上，用专用 fixture ID 选择固定 409/503/响应丢失应答 */
export interface P6分支配置 {
  /** 追加进 recruiter 初始规则清单的专用规则（如 PATCH 一律 409 的冲突规则） */
  追加规则们?: P6追加规则[];
  /** 追加进 candidate 初始提案清单的专用提案（分支提案以现成形态入场） */
  追加提案们?: P6追加提案[];
  /** 规则清单翻页游标成环 → 前端按契约漂移整域失败（服务异常重试 UI，绝不回退 Mock） */
  游标成环?: boolean;
  /** candidate 规则清单第一次请求返回 503（先失败出重试键，重试请求再由 挂起候选规则 接管） */
  规则清单首次失败?: boolean;
  /** 挂起 candidate 规则清单第一页应答，直到测试放行（首屏 pending / 迟到响应隔离） */
  挂起候选规则?: Promise<void>;
  /** candidate 创建提案的前 N 次 POST 返回 500（失败保留草稿，再次提交是新意图、新 key） */
  创建前几次失败?: number;
}


// ── 安装态与路由 handler（C2 阶段二迁入）──

/** P6 域的每次安装独立状态（规则/提案可变副本 + 分支 seed + 计数器）。 */
export interface P6安装状态形 {
  p6: P6FixtureState;
  提案元数据: Map<string, P6提案元数据形>;
  提案终态: Map<string, P6Proposal>;
  冲突规则编号们: Set<string>;
  创建提案序: number;
  物化规则序: number;
  创建失败余数: number;
  规则清单请求数: number;
}

export function 创建P6安装状态(分支: P6分支配置 | undefined): P6安装状态形 {
  // ── P6 Agent 规则域：可变 fixture 状态每次安装独立一份，页面写入只影响本测试 ──
  const p6: P6FixtureState = {
    rules: {
      candidate: [candidateGlobalRule, candidateIntentionRule].map((规) => ({ ...规, scope: { ...规.scope } })),
      recruiter: [recruiterGlobalRule].map((规) => ({ ...规, scope: { ...规.scope } })),
    },
    proposals: {
      candidate: [candidateInterpretingProposal, candidateReadyProposal].map((提) => ({ ...提 })),
      recruiter: [],
    },
    proposalReads: {},
    mutationRequests: [],
  };
  // 专用分支 seed 追加进基础状态；分支标记走 fixture 内部元数据，不进 wire 形
  const 提案元数据 = new Map<string, P6提案元数据形>();
  const 提案终态 = new Map<string, P6Proposal>();
  const 冲突规则编号们 = new Set<string>();
  for (const 追加 of 分支?.追加规则们 ?? []) {
    p6.rules.recruiter.push({ ...追加.规则, scope: { ...追加.规则.scope } });
    if (追加.分支 === '写入冲突') 冲突规则编号们.add(追加.规则.rule_id);
  }
  for (const 追加 of 分支?.追加提案们 ?? []) {
    p6.proposals.candidate.push({ ...追加.提案 });
    提案元数据.set(追加.提案.proposal_id, {
      权威正文: 追加.提案.normalized_text,
      后果: 追加.提案.consequence,
      分支: 追加.分支,
    });
  }
  // 基础解读中提案的权威解读结果：第二次单项 GET 转 ready 时带上这段正文
  提案元数据.set(candidateInterpretingProposal.proposal_id, {
    权威正文: P6标记.解读完成正文,
    后果: 'auto_allow',
  });
  let 创建提案序 = 0;
  let 物化规则序 = 0;
  let 创建失败余数 = 分支?.创建前几次失败 ?? 0;
  let 规则清单请求数 = 0;
  return { p6, 提案元数据, 提案终态, 冲突规则编号们, 创建提案序: 0, 物化规则序: 0, 创建失败余数: 分支?.创建前几次失败 ?? 0, 规则清单请求数: 0 };
}

export async function 处理Agent规则域(
  状态: P6安装状态形,
  分支: P6分支配置 | undefined,
  上下文: 路由上下文形,
): Promise<boolean> {
  const { p6, 提案元数据, 提案终态, 冲突规则编号们 } = 状态;
  const { route, 请求, url, path, method, body } = 上下文;

  // ── P6 Agent 规则域 handlers：状态声明在 route 外（跨请求存活），闭包只读请求上下文 ──
  // 变更回执：method/path/body + If-Match / Idempotency-Key 原样存证，测试断言全靠它
  const 记录P6变更 = (变更路径: string) => {
    p6.mutationRequests.push({
      method,
      path: 变更路径,
      body,
      ifMatch: 请求.headers()['if-match'] ?? null,
      idempotencyKey: 请求.headers()['idempotency-key'] ?? null,
    });
  };
  // accept 的统一落地：只有 accept 会物化 Rule；替换提案同时把目标旧规则归档出局
  const 物化并终态 = (角色: 'candidate' | 'recruiter', 提案编号: string, 元: P6提案元数据形 | undefined): P6Rule | null => {
    const 提案 = p6.proposals[角色].find((提) => 提.proposal_id === 提案编号);
    if (!提案 || 提案.state !== 'ready') return null;
    状态.物化规则序 += 1;
    if (元?.替换目标编号) {
      const 目标 = p6.rules[角色].find((规) => 规.rule_id === 元.替换目标编号);
      if (目标) 目标.state = 'archived';
    }
    const 新规则: P6Rule = {
      rule_id: `rul_00112233445566778899aabbccddee${(0xd0 + 状态.物化规则序 - 1).toString(16)}`,
      version: 1,
      state: 'active',
      scope: 元?.scope ?? { type: 'global' },
      clause_kinds: ['work_schedule'],
      display_text: 元?.权威正文 ?? `已理解：${元?.草稿 ?? ''}`,
      created_at: '2026-08-26T00:00:06Z',
      updated_at: '2026-08-26T00:00:06Z',
    };
    p6.rules[角色].push(新规则);
    提案终态.set(提案编号, { ...提案, state: 'accepted' });
    p6.proposals[角色] = p6.proposals[角色].filter((提) => 提.proposal_id !== 提案编号);
    return 新规则;
  };

  // 候选规则页的 Agent 设置整读（Agent设置 数据源双端不对称：候选端独有 material_submission）。
  // 招聘端设置页暂未接线该读取，fixture 只应答实际会发生的候选端 GET。
  if (path === '/api/v1/me/agent-settings' && method === 'GET') {
    await route.fulfill({
      status: 200,
      json: 信封({ material_submission: 'ask_first', out_of_authority_concession: 'ask_first', revision: 1, updated_at: null }),
    });
    return true;
  }

  // 规则清单：一律两页翻页（首条 + cursor / 余下）；candidate 专用 503-首次与挂起分支
  const 规则清单匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rules$/.exec(path);
  if (规则清单匹配 && method === 'GET') {
    const 角色 = 规则清单匹配[1] === 'me' ? 'candidate' : 'recruiter';
    状态.规则清单请求数 += 1;
    if (角色 === 'candidate' && 分支?.规则清单首次失败 && 状态.规则清单请求数 === 1) {
      await route.fulfill({ status: 503, json: { error: { type: 'service_unavailable', message: 'fixture 首次规则清单失败' } } });
      return true;
    }
    if (角色 === 'candidate') await 分支?.挂起候选规则;
    const 全部 = p6.rules[角色];
    const 游标 = url.searchParams.get('cursor');
    const 成环 = 角色 === 'candidate' && Boolean(分支?.游标成环);
    const 页: { rules: P6Rule[]; next_cursor?: string } = 游标 === null
      ? (全部.length > 0 ? { rules: [全部[0]], next_cursor: 'fixture-p6-page-2' } : { rules: [] })
      : (成环 && 全部.length > 1
        ? { rules: 全部.slice(1), next_cursor: 'fixture-p6-page-2' }
        : { rules: 全部.slice(1) });
    await route.fulfill({ status: 200, json: 信封(页) });
    return true;
  }

  // 规则单项：GET 带强 ETag；PATCH pause/resume 校验 If-Match 并推进版本；DELETE 只认当前版本
  const 规则单项匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rules\/([^/]+)$/.exec(path);
  if (规则单项匹配 && method === 'GET') {
    const 规则 = p6.rules[规则单项匹配[1] === 'me' ? 'candidate' : 'recruiter'].find((规) => 规.rule_id === 规则单项匹配[2]);
    if (!规则) {
      await route.fulfill({ status: 404, json: { error: { type: 'agent_rule_not_found', message: '规则不存在' } } });
      return true;
    }
    await route.fulfill({ status: 200, headers: { etag: `"${规则.version}"` }, json: 信封(规则) });
    return true;
  }
  if (规则单项匹配 && method === 'PATCH') {
    记录P6变更(path);
    const 角色 = 规则单项匹配[1] === 'me' ? 'candidate' : 'recruiter';
    const 目标编号 = 规则单项匹配[2];
    const 规则 = p6.rules[角色].find((规) => 规.rule_id === 目标编号);
    if (冲突规则编号们.has(目标编号) || !规则 || 请求.headers()['if-match'] !== `"${规则.version}"`) {
      await route.fulfill({ status: 409, json: { error: { type: 'version_conflict', message: '版本冲突' } } });
      return true;
    }
    const 换 = body as { operation?: 'pause' | 'resume' };
    if (换.operation === 'pause') 规则.state = 'paused';
    if (换.operation === 'resume') 规则.state = 'active';
    规则.version += 1;
    规则.updated_at = '2026-08-26T00:00:07Z';
    await route.fulfill({ status: 200, headers: { etag: `"${规则.version}"` }, json: 信封(规则) });
    return true;
  }
  if (规则单项匹配 && method === 'DELETE') {
    记录P6变更(path);
    const 角色 = 规则单项匹配[1] === 'me' ? 'candidate' : 'recruiter';
    const 规则 = p6.rules[角色].find((规) => 规.rule_id === 规则单项匹配[2]);
    if (!规则) {
      await route.fulfill({ status: 404, json: { error: { type: 'agent_rule_not_found', message: '规则不存在' } } });
      return true;
    }
    // archive 只在 If-Match 等于当前版本时生效，否则 409（客户端必须重读权威版本）
    if (请求.headers()['if-match'] !== `"${规则.version}"`) {
      await route.fulfill({ status: 409, json: { error: { type: 'version_conflict', message: '版本冲突' } } });
      return true;
    }
    规则.state = 'archived';
    await route.fulfill({ status: 204 });
    return true;
  }

  // 替换提案：If-Match 必须点名创建时的当前版本；提案先以 interpreting 回执入场
  const 替换匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rules\/([^/]+)\/replacement-proposals$/.exec(path);
  if (替换匹配 && method === 'POST') {
    记录P6变更(path);
    const 角色 = 替换匹配[1] === 'me' ? 'candidate' : 'recruiter';
    const 目标规则 = p6.rules[角色].find((规) => 规.rule_id === 替换匹配[2]);
    if (!目标规则) {
      await route.fulfill({ status: 404, json: { error: { type: 'agent_rule_not_found', message: '规则不存在' } } });
      return true;
    }
    if (请求.headers()['if-match'] !== `"${目标规则.version}"`) {
      await route.fulfill({ status: 409, json: { error: { type: 'version_conflict', message: '版本冲突' } } });
      return true;
    }
    const 换 = body as { text?: string; scope?: P6Rule['scope'] };
    状态.创建提案序 += 1;
    const 编号 = `arp_00112233445566778899aabbccddee${(0xc0 + 状态.创建提案序 - 1).toString(16)}`;
    const 提案: P6Proposal = { proposal_id: 编号, state: 'interpreting' };
    提案元数据.set(编号, {
      草稿: 换.text ?? '',
      scope: 角色 === 'candidate' ? 换.scope : undefined,
      后果: 'mixed',
      替换目标编号: 替换匹配[2],
    });
    p6.proposals[角色].push(提案);
    await route.fulfill({ status: 200, json: 信封(提案) });
    return true;
  }

  // 提案清单：按 state 过滤后同样两页翻页
  const 提案清单匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rule-proposals$/.exec(path);
  if (提案清单匹配 && method === 'GET') {
    const 角色 = 提案清单匹配[1] === 'me' ? 'candidate' : 'recruiter';
    const 想要状态 = url.searchParams.get('state') === 'interpreting' ? 'interpreting' as const : 'ready' as const;
    const 全部 = p6.proposals[角色].filter((提) => 提.state === 想要状态);
    const 游标 = url.searchParams.get('cursor');
    const 页: { proposals: P6Proposal[]; next_cursor?: string } = 游标 === null
      ? (全部.length > 0 ? { proposals: [全部[0]], next_cursor: 'fixture-p6-page-2' } : { proposals: [] })
      : { proposals: 全部.slice(1) };
    await route.fulfill({ status: 200, json: 信封(页) });
    return true;
  }
  if (提案清单匹配 && method === 'POST') {
    记录P6变更(path);
    if (状态.创建失败余数 > 0) {
      状态.创建失败余数 -= 1;
      await route.fulfill({ status: 500, json: { error: { type: 'internal_error', message: P6标记.创建失败提示 } } });
      return true;
    }
    const 角色 = 提案清单匹配[1] === 'me' ? 'candidate' : 'recruiter';
    const 换 = body as { text?: string; scope?: P6Rule['scope'] };
    状态.创建提案序 += 1;
    const 编号 = `arp_00112233445566778899aabbccddee${(0xc0 + 状态.创建提案序 - 1).toString(16)}`;
    // fresh create 回执只有 proposal_id + state（连 created_at 都不给，解码器允许）
    const 提案: P6Proposal = { proposal_id: 编号, state: 'interpreting' };
    提案元数据.set(编号, {
      草稿: 换.text ?? '',
      scope: 角色 === 'candidate' ? 换.scope : undefined,
      后果: 'mixed',
    });
    p6.proposals[角色].push(提案);
    await route.fulfill({ status: 200, json: 信封(提案) });
    return true;
  }

  // 提案单项 GET：第二次读取把 interpreting 转 ready（权威解读完成）；专用 ID 第一次读即 failed
  const 单提案匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rule-proposals\/([^/]+)$/.exec(path);
  if (单提案匹配 && method === 'GET') {
    const 角色 = 单提案匹配[1] === 'me' ? 'candidate' : 'recruiter';
    const 提案编号 = 单提案匹配[2];
    // 读取计数对终态回执同样生效（accept 恢复路径的 GET 也要留下存证）
    p6.proposalReads[提案编号] = (p6.proposalReads[提案编号] ?? 0) + 1;
    const 终态 = 提案终态.get(提案编号);
    if (终态) {
      await route.fulfill({ status: 200, json: 信封(终态) });
      return true;
    }
    const 提案 = p6.proposals[角色].find((提) => 提.proposal_id === 提案编号);
    if (!提案) {
      await route.fulfill({ status: 404, json: { error: { type: 'agent_rule_proposal_not_found', message: '提案不存在' } } });
      return true;
    }
    if (提案.state === 'interpreting') {
      const 元 = 提案元数据.get(提案编号);
      if (元?.分支 === '单读失败') {
        提案.state = 'failed';
      } else if ((p6.proposalReads[提案编号] ?? 0) >= 2) {
        提案.state = 'ready';
        提案.normalized_text = 元?.权威正文 ?? `已理解：${元?.草稿 ?? ''}`;
        提案.consequence = 元?.后果 ?? 'mixed';
        提案.created_at = 提案.created_at ?? '2026-08-26T00:00:05Z';
      }
    }
    await route.fulfill({ status: 200, json: 信封(提案) });
    return true;
  }

  // accept：专用分支（不可执行 409 / 结果未知 503 / 响应丢失中断）都先按服务端语义落终态再丢应答
  const 接受匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rule-proposals\/([^/]+)\/accept$/.exec(path);
  if (接受匹配 && method === 'POST') {
    记录P6变更(path);
    const 角色 = 接受匹配[1] === 'me' ? 'candidate' : 'recruiter';
    const 提案编号 = 接受匹配[2];
    const 元 = 提案元数据.get(提案编号);
    if (元?.分支 === 'accept不可接受') {
      // 公开 consequence 从不决定可执行性：这张卡看起来完全可接受，服务端仍裁决 not_actionable
      await route.fulfill({ status: 409, json: { error: { type: 'agent_rule_proposal_not_actionable', message: 'proposal not actionable' } } });
      return true;
    }
    if (元?.分支 === 'accept丢失' || 元?.分支 === 'accept未知') {
      if (!提案终态.has(提案编号)) 物化并终态(角色, 提案编号, 元);
      if (元.分支 === 'accept丢失') {
        await route.abort('connectionreset');
        return true;
      }
      await route.fulfill({ status: 503, json: { error: { type: 'operation_outcome_unknown', message: '结果未知' } } });
      return true;
    }
    const 新规则 = 物化并终态(角色, 提案编号, 元);
    if (!新规则) {
      await route.fulfill({ status: 409, json: { error: { type: 'agent_rule_proposal_not_ready', message: '提案还未就绪' } } });
      return true;
    }
    await route.fulfill({ status: 200, headers: { etag: `"${新规则.version}"` }, json: 信封(新规则) });
    return true;
  }

  // dismiss：提案出局并给 dismissed 回执（恢复路径靠单项 GET 也能读到同一终态）
  const 放弃匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rule-proposals\/([^/]+)\/dismiss$/.exec(path);
  if (放弃匹配 && method === 'POST') {
    记录P6变更(path);
    const 角色 = 放弃匹配[1] === 'me' ? 'candidate' : 'recruiter';
    const 提案 = p6.proposals[角色].find((提) => 提.proposal_id === 放弃匹配[2]);
    if (!提案) {
      await route.fulfill({ status: 404, json: { error: { type: 'agent_rule_proposal_not_found', message: '提案不存在' } } });
      return true;
    }
    提案终态.set(提案.proposal_id, { proposal_id: 提案.proposal_id, state: 'dismissed' });
    p6.proposals[角色] = p6.proposals[角色].filter((提) => 提.proposal_id !== 提案.proposal_id);
    await route.fulfill({ status: 200, json: 信封({ proposal_id: 提案.proposal_id, state: 'dismissed' }) });
    return true;
  }
  return false;
}
