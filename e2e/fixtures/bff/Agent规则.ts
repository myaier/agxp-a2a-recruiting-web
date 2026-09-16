// e2e/fixtures/bff/Agent规则.ts
// P6 Agent 规则域 fixture（C2）：wire 形、标记值、规则/提案样本与专用分支配置，
// 从 e2e/数据源模式.spec.ts 原样迁出。可变状态归每次 安装BFF路由 所有。

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
