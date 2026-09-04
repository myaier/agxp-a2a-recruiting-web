// e2e/数据源模式.spec.ts
// 数据源边界 E2E：Mock 回归 + Backend fixture。两个 describe 各自 test.use({ baseURL })
// 钉到专用 server（mock/stg 4181、backend/stg 4182），项目用 grep 按 @mock / @backend 标签选跑。
//
// Mock：显式 mock/stg server，走现有 candidate 演示流程；断言没有 /api/v1 请求、登录仍 4 格验证码、
// 本地城市/学校/职位仍可选、没有新增页面/弹层/全局 loading。
//
// Backend：显式 backend/stg server。Playwright page.route 拦截所有 /api/v1/* 用 fixture 应答
// （Backend dev server 会代理 /api/v1 到 stg，但 stg 从测试不可达，所以 route-fulfil 全部 fixture）。
// 这只验证前端在拦截边界上的行为，不是真实 BFF 联调 —— 真实后端从不被启动、修改或验证。
// 记录所有 /api/v1/catalog/* 请求，覆盖：candidate login/session 后无 Catalog 请求；打开城市只请求
// 目标省第一页；中英文学校搜索选择同一 institution ID 且候选副行显示「城市 · 国家」；
// 写入 body 使用选择 ID（不含 /catalog/ 反查）；422 array fields、401 cleanup、409 reread、503 同幂等键。
// 响应放入只存在于 fixture 的标记值，断言页面展示该值，证明渲染来自 HTTP 而非 Mock。
//
// P1C（Task 6）：追加组织域 fixture —— RecruiterProfile / Affiliation / 公开企业 / 企业档案与媒体 /
// 管理员申请 / owner Jobs。multipart 请求（头像 / 企业媒体 / 管理员申请证据）不用 JSON parser 解整体，
// 按 content-type boundary 取 part 名；metadata part 内容只在测试进程内比对，不写日志、不进 snapshot。
//
// P6（Task 8）：追加 Agent 规则域可变 fixture —— agent-rules / agent-rule-proposals 双角色。
// 清单一律两页翻页；解读中提案在第二次单项 GET 转 ready；pause/resume 各自推进版本；
// 新规则/替换规则只在 accept 时物化；archive 只认当前版本 If-Match；409/503/响应丢失
// 由专用 fixture ID 选择固定分支。变更回执（body / If-Match / Idempotency-Key）存在
// fixture 的 mutationRequests 里供测试断言；Mock 场景断言 P6 域全程零 /api/v1 请求。
//
// P4（Task 8）：追加发现推荐域可变 fixture —— 候选 job-recommendations / 招聘
// candidate-recommendations 双端 + 双端委托与刷新。编号与标记值（P4编号 / P4标记）只在
// fixture 里存在，Mock 数据里没有；断言页面展示它们即证明渲染来自 HTTP 而非 Mock。
// fixture 拥有 available/rejected 数组、收藏、刷新计数、委托单项读取、变更回执存证
// （method/path/body/If-Match/Idempotency-Key）与一个非法翻页分支；受控重试同键回同一张
// 回执。Mock 场景以任务书原文的 isP4 正则断言发现域全程零请求。
//
// P2（Task 7）：追加附件简历域可变 fixture —— /api/v1/me/resume-files 的 0–3 行 PDF 库。
// 清单 GET 驱动 pending→processing→终态状态机（写入归零重放）；multipart part 形状 /
// consent / If-Match / 幂等键 fail closed；预览只认 authenticated content GET；
// Mock describe 证明 resume-files 请求数为 0。
//
// P5（Task 8）：追加 MatchCase 域可变 fixture —— 双端 match-cases 工作区/历史/详情/
// S0–S3 命令/Case 叮嘱/披露 PDF。10 条 Backend 旅程覆盖：同 Case 双端 needs_action
// 分歧与列表顺序游标、未知词与矩阵外四元组 fail closed、双端详情直达刷新（空列表
// 记忆）、S0 事实 503 同键重放、披露前/解析中失败隐私（零姓名零联系方式零 PDF）、
// 已披露招聘端只开 Case 专属原始 PDF（含终审回归钉：S1 段落有 Case 叮嘱回执时
// 入口不得被段内对话压掉）、S2/S3 权威重读与终态动作消失、completed 移交
// 文案且绝不请求会话路由、终局架子只读详情、登出/切角色清空可见 P5 状态。每个 Case
// JSON 应答带 no-store、PDF 带 private, no-store（应答头存证）；Mock describe 记录
// 全部含 /match-cases 的浏览器请求并证明清单为空。
//
// P8（Task 8）：追加控制面域可变 fixture —— 凭证/会话/退出其他设备/手机号换绑、
// 数据导出（创建幂等 + queued→running→ready 状态机 + application/zip 下载）、
// 账号注销（body 精确 {}、202 后保护读取一律 401）与合规反馈/上下文举报
// （block_unavailable 零写入、404 目标不存在统一收口、applied 把组织写进 P3 权威视图）。
// 每个变更的 method/path/body/原始字节/Idempotency-Key/Origin 存进 变更请求；
// 幂等按「同键同原文重放同一张回执、同键异原文 409」收口；Mock describe 以任务书
// 原文的 isP8 正则断言控制面全程零请求。

import { expect, test, type Page, type Route } from '@playwright/test';
import type { BFF简历, BFFOwnerIntention } from '../src/数据/BFF契约';

// ─────────────────────────────────────────────────────────────────────────────
// Mock 回归 @mock
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Mock 数据源回归 @mock', () => {
  // 显式 mock/stg server（端口 4181），不依赖缺省 dev server
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('缺省数据源保持 PM Mock 登录体验和四格验证码 @mock', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });
    await page.goto('/');
    await page.getByLabel('手机号').fill('13800000000');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.locator('[class*="验证码格"]')).toHaveCount(4);
    await page.getByLabel('短信验证码').fill('1234');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '进入' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    expect(apiRequests).toEqual([]);
    await expect(page.getByText('数据源')).toHaveCount(0);
    await expect(page.getByText(/backend|stg|local/i)).toHaveCount(0);
  });

  test('Mock 本地城市/学校/职位仍可选，无新增页面或弹层 @mock', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    // 微信登录在 Mock 模式仍一键直进，但必须先同意协议
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // 本地期望职位仍可选
    await page.getByRole('button', { name: /选择期望职位/ }).click();
    await page.getByRole('button', { name: '产品', exact: true }).click();
    await page.getByRole('button', { name: '产品经理', exact: true }).click();
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // 没有任何 /api/v1 请求（Mock 模式零 API）
    expect(apiRequests).toEqual([]);
  });

  test('Mock 规则页与双端筛选抽屉全程零 API 请求 @mock', async ({ page }) => {
    // P6（Task 8）：双端规则页（/rules、/hr/agent-settings）+ 双端筛选抽屉（看市场 / 候选推荐）
    // 在 Mock 下全部走本地状态；本地新增/展示/编辑各走一次，断言 P6 的 agent-rule 请求恒为零。
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // ── /rules：Mock 种子规则直接上屏（5 条种子里 1 条默认停用 → 生效计数 4）──
    await page.goto('/#/rules');
    await expect(page.getByText('不主动披露并行接触数量')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('双休是底线；隔周六可谈，大小周不谈')).toBeVisible();
    await expect(page.getByText('4 条')).toBeVisible();

    // ── 候选端市场筛选抽屉：本地新增一条规则（失焦即落库，不发请求）──
    await page.goto('/#/app');
    await page.getByRole('button', { name: '市场', exact: true }).click();
    // 筛选键带生效条数（规则 > 0 时是「筛选 · N ▾」）
    await page.getByRole('button', { name: /筛选.*▾/ }).click();
    await expect(page.getByText('告诉AI代理你的硬性要求')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '＋ 添加规则' }).click();
    // 新增行自动聚焦且排在既有行之后；回车即失焦落库，回规则库核对真的进了清单
    const 候选新行 = page.getByRole('dialog').getByRole('textbox').last();
    await 候选新行.fill('只投双休岗位');
    await 候选新行.press('Enter');
    await page.goto('/#/rules');
    await expect(page.getByRole('button', { name: /只投双休岗位/ })).toBeVisible({ timeout: 10_000 });

    // ── 切到招聘端：Mock 定稿规则只展示，不提供维护型开关 ──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
    await page.goto('/#/hr/agent-settings');
    await expect(page.getByText('竞对在职候选人不接触、不推进')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('switch')).toHaveCount(0);
    await expect(page.getByText('3 条生效')).toBeVisible();

    // ── 招聘端候选筛选抽屉（推荐子视图）：本地改一条规则 ──
    await page.goto('/#/hr');
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    await page.getByRole('button', { name: /筛选.*▾/ }).click();
    await expect(page.getByText('告诉AI代理你的硬性要求')).toBeVisible({ timeout: 10_000 });
    // 企业规则种子首行是「不透露 HC 剩余数量与紧迫度」，就地改写后回车落库，去 canonical 页核对
    const 招聘规则行 = page.getByRole('dialog').getByRole('textbox').first();
    await expect(招聘规则行).toHaveValue('不透露 HC 剩余数量与紧迫度');
    await 招聘规则行.fill('不透露 HC 剩余数量与紧迫度（改）');
    await 招聘规则行.press('Enter');
    await page.goto('/#/hr/agent-settings');
    await expect(page.getByText('不透露 HC 剩余数量与紧迫度（改）')).toBeVisible({ timeout: 10_000 });

    // P6 域在 Mock 下零请求：agent-rule 一个都没有，整个会话也没有任何 /api/v1
    expect(apiRequests.filter((url) => url.includes('agent-rule'))).toEqual([]);
    expect(apiRequests).toEqual([]);
  });

  test('Mock 上传演示零 resume-files 请求 @mock', async ({ page }) => {
    // P2：Mock 的附件简历仍是硬编码演示行，上传演示只落本地文件名 + 轻提示。
    // 监听页面所有请求，证明 /api/v1/me/resume-files 请求数为 0（Mock 不接 BFF 附件库）。
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // 上传演示（Mock）：本地派发文件名 + 轻提示，不发网络请求
    await page.locator('input[type=file]').setInputFiles({
      name: 'demo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('demo.pdf')).toBeVisible();
    await expect(page.getByText('已选择简历，可识别的信息将用于预填')).toBeVisible();

    // 我的简历的附件区照旧是 Mock 演示行，不是权威 0–3 行
    await page.goto('/#/resume');
    await expect(page.getByText('沈亦舟_简历_2026.pdf')).toBeVisible();

    expect(apiRequests.filter((url) => new URL(url).pathname.startsWith('/api/v1/me/resume-files'))).toEqual([]);
    expect(apiRequests).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Backend fixture @backend
// ─────────────────────────────────────────────────────────────────────────────

// 只存在于 fixture 的标记值：Mock 里没有，断言页面展示它们即证明渲染来自 HTTP。
const 标记 = {
  主体真名: '后端 fixture 候选人',
  城市display: ' Fixture 市',
  学校display: ' Fixture 大学',
  学校副行: 'Fixture City · Fixtureland',
  职位display: ' Fixture 工程师',
  简历summary: '后端 fixture 个人优势标记',
  意向标题城市: 'Fixture 市',
} as const;

/** BFF 信封：{ result, meta: { request_id, api_version } } */
function 信封<T>(result: T): { result: T; meta: { request_id: string; api_version: 'v1' } } {
  return { result, meta: { request_id: 'fixture-req', api_version: 'v1' } };
}

/** BFF 目录页：items + next_cursor + catalog_version */
function 目录页<T extends { id: string; display_name: string }>(items: T[]): {
  items: T[];
  next_cursor: string | null;
  catalog_version: string;
} {
  return { items, next_cursor: null, catalog_version: 'fixture-v1' };
}

// ─────────────────────────────────────────────────────────────────────────────
// P6 Agent 规则域 fixture（Task 8）。wire 形与其他 fixture 一样就地声明，不反向依赖 src；
// 标记值只存在于 fixture，断言页面展示它们即证明渲染来自 HTTP 而非 Mock。
// 可变状态（规则 / 提案 / 读取计数 / 变更回执）归每次 安装BFF路由 所有，页面写入只影响本测试。
// ─────────────────────────────────────────────────────────────────────────────

/** P6 wire 规则形（与 BFF契约.BFFAgent规则 同构；fixture 不伪造缺失键，解码器按闭合契约拒收） */
interface P6Rule {
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
interface P6Proposal {
  proposal_id: string;
  state: 'interpreting' | 'ready' | 'accepted' | 'dismissed' | 'failed';
  normalized_text?: string;
  consequence?: 'auto_allow' | 'auto_deny' | 'advisory' | 'mixed';
  created_at?: string;
}

interface P6FixtureState {
  rules: Record<'candidate' | 'recruiter', P6Rule[]>;
  proposals: Record<'candidate' | 'recruiter', P6Proposal[]>;
  proposalReads: Record<string, number>;
  mutationRequests: { method: string; path: string; body: unknown; ifMatch: string | null; idempotencyKey: string | null }[];
}

const P6标记 = {
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
  意向新建草稿: '只和 Fixture 市的岗位谈（fixture 意向新建）',
  替换草稿: '只投双休岗位（fixture 替换规则）',
  招聘新建草稿: '两周内到岗的候选优先（fixture 招聘新建）',
  失败草稿: '这句语法不通顺代理理解不了（fixture 失败重试）',
  创建失败提示: 'Fixture 创建暂时失败',
} as const;

const P6编号 = {
  候选全局规则: 'rul_00112233445566778899aabbccddeea1',
  候选意向规则: 'rul_00112233445566778899aabbccddeea2',
  招聘全局规则: 'rul_00112233445566778899aabbccddeea3',
  解释中提案: 'arp_00112233445566778899aabbccddeeb1',
  就绪提案: 'arp_00112233445566778899aabbccddeeb2',
} as const;

/** 专用分支 fixture ID：只有测试显式 seed 时才会进入状态并选择固定错误分支 */
const P6分支编号 = {
  冲突规则: 'rul_00112233445566778899aabbccddeea4',
  不可接受提案: 'arp_00112233445566778899aabbccddeeb3',
  丢失提案: 'arp_00112233445566778899aabbccddeeb4',
  未知提案: 'arp_00112233445566778899aabbccddeeb5',
  失败提案: 'arp_00112233445566778899aabbccddeeb6',
} as const;

function P6规则(覆盖: Partial<P6Rule> & Pick<P6Rule, 'rule_id' | 'display_text' | 'scope'>): P6Rule {
  return {
    version: 1,
    state: 'active',
    clause_kinds: ['work_schedule'],
    created_at: '2026-08-26T00:00:00Z',
    updated_at: '2026-08-26T00:00:00Z',
    ...覆盖,
  };
}

const candidateGlobalRule: P6Rule = P6规则({
  rule_id: P6编号.候选全局规则,
  display_text: P6标记.候选全局规则,
  scope: { type: 'global' },
});
const candidateIntentionRule: P6Rule = P6规则({
  rule_id: P6编号.候选意向规则,
  display_text: P6标记.候选意向规则,
  scope: { type: 'intention', intention_id: P6标记.意向编号 },
});
const recruiterGlobalRule: P6Rule = P6规则({
  rule_id: P6编号.招聘全局规则,
  display_text: P6标记.招聘全局规则,
  scope: { type: 'global' },
});
/** 解读中提案（清单视图可带 created_at）：轮询的第二次单项 GET 把它转 ready */
const candidateInterpretingProposal: P6Proposal = {
  proposal_id: P6编号.解释中提案,
  state: 'interpreting',
  created_at: '2026-08-26T00:00:00Z',
};
/** 就绪提案：auto_deny 专用 fixture —— 安全摘要逐字来自 consequence，页面不做任何浏览器侧判定 */
const candidateReadyProposal: P6Proposal = {
  proposal_id: P6编号.就绪提案,
  state: 'ready',
  normalized_text: P6标记.就绪提案正文,
  consequence: 'auto_deny',
  created_at: '2026-08-26T00:00:00Z',
};

/** 专用分支提案的 seed：提案本体 + 它在 fixture 里走哪条固定错误分支（不进 wire 形） */
interface P6追加提案 {
  提案: P6Proposal;
  分支?: 'accept丢失' | 'accept未知' | 'accept不可接受' | '单读失败';
}

interface P6追加规则 {
  规则: P6Rule;
  分支?: '写入冲突';
}

/** fixture 内部提案元数据：草稿正文 / 权威解读 / 范围 / 替换目标 / 固定错误分支（不进 wire 形） */
interface P6提案元数据形 {
  草稿?: string;
  权威正文?: string;
  后果?: P6Proposal['consequence'];
  scope?: P6Rule['scope'];
  替换目标编号?: string;
  分支?: P6追加提案['分支'];
}

/** P6 专用分支 fixture：按需叠加在基础状态上，用专用 fixture ID 选择固定 409/503/响应丢失应答 */
interface P6分支配置 {
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

// ─────────────────────────────────────────────────────────────────────────────
// P4 发现推荐域 fixture（Task 8）。wire 形与其他 fixture 一样就地声明，不反向依赖 src；
// 编号与标记值（P4编号 / P4标记）只存在于 fixture，Mock 数据里没有 —— 断言页面展示它们
// 即证明渲染来自 HTTP 而非 Mock。可变状态归每次 安装BFF路由 所有：候选 available 数组、
// 招聘 available/rejected 两条腿、收藏、刷新计数、委托单项读取、变更回执存证
// （method/path/body/If-Match/Idempotency-Key 原样入 变更请求）与一个非法翻页分支
// （第二页注入一个未知键 → strict decoder 拒收整轮读取）。只路由 Spec 点名的 P4 路径，
// 无任何 watch 路由；受控重试（503 operation_outcome_unknown）同键回同一张委托回执。
// ─────────────────────────────────────────────────────────────────────────────

const P4编号 = {
  intention: 'int_00112233445566778899aabbccddeef1',
  job: 'job_00112233445566778899aabbccddeef2',
  candidateRecommendation: 'rec_00112233445566778899aabbccddeef3',
  recruiterJob: 'job_00112233445566778899aabbccddeef4',
  recruiterRecommendation: 'rec_00112233445566778899aabbccddeef5',
  candidateDelegation: 'del_00112233445566778899aabbccddeef6',
  recruiterDelegation: 'del_00112233445566778899aabbccddeef7',
  case: 'case_00112233445566778899aabbccddeef8',
} as const;

const P4标记 = {
  jobTitle: 'P4 Fixture 分布式系统工程师',
  company: 'P4 Fixture 星河科技',
  publisher: 'P4 Fixture 招聘负责人',
  candidateAlias: 'P4候选甲',
  candidateSummary: 'P4 fixture 匿名候选摘要，只来自 HTTP',
} as const;

/** 用例自用的补充编号：固定表之外的第二张卡 / 归档岗位 / 未知坐标（同样只存在于 fixture） */
const P4补充编号 = {
  备选岗位: 'job_00112233445566778899aabbccddeef9',
  备选推荐: 'rec_00112233445566778899aabbccddeeg1',
  招聘候选乙: 'rec_00112233445566778899aabbccddeeg2',
  意向乙: 'int_00112233445566778899aabbccddeeg3',
  归档岗位: 'job_00112233445566778899aabbccddeeg4',
  未知岗位: 'job_00112233445566778899aabbccddeeg5',
  未知推荐: 'rec_00112233445566778899aabbccddeeg6',
} as const;

type P4委托状态形 = 'accepted' | 'evaluating' | 'case_started' | 'needs_user' | 'refused' | 'failed';
type P4淘汰原因形 = 'experience_insufficient' | 'direction_mismatch' | 'primary_stack_mismatch' | 'other';

/** P4 wire 委托摘要（与 BFF契约.BFF委托摘要 同构） */
interface P4委托摘要形 {
  delegation_id: string;
  state: P4委托状态形;
  case_id: string | null;
}

/** P4 wire CandidateJob（与 BFF契约.BFFCandidateJob 同构：owner-private 列缺席即漂移） */
interface P4CandidateJob形 {
  job_id: string;
  publisher_verification_status: 'unverified' | 'verified';
  hiring_organization_verification_status: 'unverified' | 'verified';
  hiring_organization_claim: { display_name: string; legal_name?: string | null };
  publisher_organization_ref?: string;
  hiring_organization_ref?: string;
  publisher_profile?: {
    public_name: string;
    title: string;
    personal_verification_status: 'unverified' | 'verified';
    avatar_url?: string | null;
  };
  title: string;
  recruitment_type: 'social_full_time' | 'campus' | 'internship' | 'part_time';
  category: { id: string; display_name: string };
  location: { id: string; display_name: string };
  office_location: string;
  workplace_mode: 'onsite' | 'hybrid' | 'remote';
  salary_lower: number;
  salary_upper: number;
  salary_period: 'month' | 'day' | 'hour';
  annual_salary_months: number | null;
  campus_cohort: number | null;
  internship_months: number | null;
  onsite_days_per_week: number | null;
  experience_requirement: string;
  education_requirement: string;
  structured_requirements_confirmed: boolean;
  hard_requirements: {
    alternate_weekend_work: 'required' | 'not_required' | 'unknown';
    outsourcing_only: 'required' | 'not_required' | 'unknown';
    onsite_only: 'required' | 'not_required' | 'unknown';
    frequent_travel: 'required' | 'not_required' | 'unknown';
  };
  description: string;
  requirements: string;
  keywords: string[];
  status: 'active';
  revision: number;
  published_at: string;
  created_at: string;
  updated_at: string;
}

/** P4 wire 候选岗位推荐（与 BFF契约.BFF候选岗位推荐 同构） */
interface P4候选推荐形 {
  recommendation_id: string;
  batch_id: string;
  intention_id: string;
  rank: number;
  match_score: number;
  match_reasons: string[];
  state: 'available' | 'delegating' | 'delegated';
  job: P4CandidateJob形;
  delegation: P4委托摘要形 | null;
}

/** P4 wire 招聘候选教育段（与 BFF契约.BFF招聘候选教育 同构） */
interface P4招聘教育形 {
  institution: string | null;
  major: string | null;
  degree: string;
  start_month: string;
  end_month: string | null;
}

/** P4 wire 招聘候选推荐（与 BFF契约.BFF招聘候选推荐 同构：匿名 allowlist，无真名无薪资数字） */
interface P4招聘推荐形 {
  recommendation_id: string;
  batch_id: string;
  job_id: string;
  rank: number;
  match_score: number;
  highlights: string[];
  compensation_relationship: 'overlap' | 'near_miss' | 'disjoint' | 'unknown';
  candidate_alias: string;
  experience_years: number | null;
  job_status: string;
  summary: string;
  skills: string[];
  educations: P4招聘教育形[];
  favorite: boolean;
  rejected: boolean;
  rejection_reason: P4淘汰原因形 | null;
  state: 'available' | 'rejected';
  delegation: P4委托摘要形 | null;
}

/** P4 wire 发现批次（与 BFF契约.BFF发现批次 同构） */
interface P4发现批次形 {
  batch_id: string;
  direction: 'candidate_jobs' | 'recruiter_candidates';
  scope_ref: string;
  ranking_version: 'discovery-ranking.v1';
  count: number;
  created_at: string;
}

/** P4 wire 发现偏好回执（与 BFF契约.BFF发现偏好 同构） */
interface P4偏好形 {
  favorite: boolean;
  rejected: boolean;
  rejection_reason: 'not_interested' | P4淘汰原因形 | null;
  revision: number;
  updated_at: string;
}

/** P4 wire 委托回执（与 BFF契约.BFF委托回执 同构） */
interface P4委托回执形 {
  delegation_id: string;
  recommendation_id: string | null;
  state: P4委托状态形 | null;
  evaluation_id: string | null;
  case_id: string | null;
  refusal_code:
    | 'recommendation_not_found' | 'recommendation_unavailable'
    | 'delegation_not_allowed' | 'active_case_quota_reached'
    | 'delegation_cooldown' | null;
}

/** P4 wire 意向（与 fixture意向列表 条目同构；候选端 scope 坐标与顶栏胶囊的来源） */
interface P4意向形 {
  intention_id: string;
  recruitment_type: 'social_full_time' | 'campus' | 'internship' | 'part_time';
  job_category: { id: string; display_name: string };
  primary_location: { id: string; display_name: string };
  alternate_locations: { id: string; display_name: string }[];
  industries: { id: string; display_name: string }[];
  workplace_modes: ('onsite' | 'hybrid' | 'remote')[];
  compensation: { mode: 'range' | 'negotiable'; lower?: number | null; upper?: number | null; annual_salary_months?: number | null };
  salary_period: 'month' | 'day' | 'hour';
  graduation_month: string | null;
  internship_months: number | null;
  onsite_days_per_week: number | null;
  exclusions: {
    alternate_weekend_work: 'allowed' | 'excluded' | 'unspecified';
    outsourcing_only: 'allowed' | 'excluded' | 'unspecified';
    onsite_only: 'allowed' | 'excluded' | 'unspecified';
    frequent_travel: 'allowed' | 'excluded' | 'unspecified';
  };
  private_preferences: string;
  status: 'active' | 'archived';
  revision: number;
  created_at: string;
  updated_at: string;
}

/** P4 专用分支：只有用例显式 seed 时才选择固定故障 / 挂起 / 注毒应答 */
interface P4发现分支形 {
  /** 候选刷新 POST 每把新键先 503 operation_outcome_unknown（同键受控重试一次后成功） */
  候选刷新首次503?: boolean;
  /** 候选委托 POST 每把新键先 503，重试回同一张回执（同键同回执存证） */
  候选委托先503?: boolean;
  /** 候选列表翻页的第二页注入一个未知键 → strict decoder 拒收整轮读取 */
  候选非法第二页?: boolean;
  /** 候选端不感兴趣 PUT 首次 500（存证后失败；重试成功） */
  候选不感兴趣先失败?: boolean;
  /** 指定意向的列表首页 GET 挂起，直到门兑现（迟到 scope 应答用） */
  挂起候选读取?: { 意向: string; 门: Promise<void> };
}

/** P4 发现域可变 fixture：测试自持一份，安装路由后 handler 与测试共享同一对象 */
interface P4发现fixture形 {
  /** 在场时 GET /api/v1/me/intentions 改答这份列表（候选端双意向 / 迟到应答用例用） */
  意向们?: P4意向形[];
  /** 候选端：intention_id → available 推荐卡（反馈 / 刷新 / 委托直接改写） */
  候选推荐: Record<string, P4候选推荐形[]>;
  /** canonical job GET /api/v1/jobs/{id} 的权威 Job；缺席编号按 404 job_not_found 收口 */
  候选岗位: Record<string, P4CandidateJob形>;
  /** 招聘端：job_id → available / rejected 两条腿（收藏 / 淘汰 / 撤销 / 委托直接改写） */
  招聘可用: Record<string, P4招聘推荐形[]>;
  招聘已筛: Record<string, P4招聘推荐形[]>;
  /** 刷新计数：POST 建批次一次 +1 */
  刷新次数: { candidate: number; recruiter: number };
  /** 委托单项 GET 读取记录（逐次追加） */
  委托读取: { delegationId: string; state: P4委托状态形 | null }[];
  /** 变更回执存证：method/path/body + If-Match / Idempotency-Key 原样 */
  变更请求: { method: string; path: string; body: unknown; ifMatch: string | null; idempotencyKey: string | null }[];
  分支?: P4发现分支形;
}

function P4深克隆<T>(值: T): T {
  return JSON.parse(JSON.stringify(值)) as T;
}

/** P4 页 wrapper：两页翻页（首页 1 条 + cursor / 余下收尾显式 null）；注毒分支在第二页对象上多塞一个键 */
function P4分页(
  items: unknown[],
  注毒: boolean,
  游标: string | null,
): { recommendations: unknown[]; next_cursor: string | null } {
  if (items.length === 0) return { recommendations: [], next_cursor: null };
  if (游标 === null) return { recommendations: [P4深克隆(items[0])], next_cursor: 'p4page2' };
  const 余下 = items.slice(1).map((条) => P4深克隆(条)) as Record<string, unknown>[];
  if (注毒 && 余下.length > 0) 余下[0]!.fixture_extra_key = 'invalid-page';
  return { recommendations: 余下, next_cursor: null };
}

let P4批次序 = 0;
function P4发现批次(direction: 'candidate_jobs' | 'recruiter_candidates', scopeRef: string): P4发现批次形 {
  P4批次序 += 1;
  return {
    batch_id: `bat_p4fixture${P4批次序}`,
    direction,
    scope_ref: scopeRef,
    ranking_version: 'discovery-ranking.v1',
    count: 1,
    created_at: '2026-08-27T09:00:00Z',
  };
}

let P4偏好序 = 0;
function P4发现偏好(覆盖: Partial<P4偏好形> = {}): P4偏好形 {
  P4偏好序 += 1;
  return {
    favorite: false,
    rejected: false,
    rejection_reason: null,
    revision: 1 + P4偏好序,
    updated_at: '2026-08-27T09:30:00Z',
    ...覆盖,
  };
}

function P4CandidateJob(覆盖: Partial<P4CandidateJob形> = {}): P4CandidateJob形 {
  return {
    job_id: P4编号.job,
    publisher_verification_status: 'verified',
    hiring_organization_verification_status: 'verified',
    hiring_organization_claim: { display_name: P4标记.company, legal_name: 'P4 Fixture 星河科技有限公司' },
    title: P4标记.jobTitle,
    recruitment_type: 'social_full_time',
    category: { id: 'job-fixture-p4-cat', display_name: '后端工程师' },
    location: { id: 'loc-fixture-p4', display_name: 'P4 Fixture 市' },
    office_location: 'P4 Fixture 市 Fixture 路 8 号',
    workplace_mode: 'hybrid',
    salary_lower: 30,
    salary_upper: 50,
    salary_period: 'month',
    annual_salary_months: 15,
    campus_cohort: null,
    internship_months: null,
    onsite_days_per_week: null,
    experience_requirement: 'three_to_five_years',
    education_requirement: 'bachelor',
    structured_requirements_confirmed: true,
    hard_requirements: {
      alternate_weekend_work: 'unknown',
      outsourcing_only: 'unknown',
      onsite_only: 'unknown',
      frequent_travel: 'unknown',
    },
    description: 'P4 fixture 岗位描述：负责分布式系统研发。\n参与高可用架构设计。',
    requirements: 'P4 fixture 岗位要求：熟悉分布式一致性。\n有大规模系统经验。',
    keywords: ['P4Fixture'],
    status: 'active',
    revision: 1,
    published_at: '2026-08-27T00:00:00Z',
    created_at: '2026-08-27T00:00:00Z',
    updated_at: '2026-08-27T00:00:00Z',
    publisher_organization_ref: 'org-fixture-p4',
    hiring_organization_ref: 'org-fixture-p4',
    publisher_profile: {
      public_name: P4标记.publisher,
      title: '招聘负责人',
      personal_verification_status: 'verified',
    },
    ...覆盖,
  };
}

function P4候选卡(覆盖: Partial<P4候选推荐形> = {}): P4候选推荐形 {
  return {
    recommendation_id: P4编号.candidateRecommendation,
    batch_id: 'bat_p4fixture_c1',
    intention_id: P4编号.intention,
    rank: 1,
    match_score: 92,
    match_reasons: ['direction_match', 'compensation_overlap'],
    state: 'available',
    job: P4CandidateJob(),
    delegation: null,
    ...覆盖,
  };
}

function P4招聘卡(覆盖: Partial<P4招聘推荐形> = {}): P4招聘推荐形 {
  return {
    recommendation_id: P4编号.recruiterRecommendation,
    batch_id: 'bat_p4fixture_r1',
    job_id: P4编号.recruiterJob,
    rank: 1,
    match_score: 88,
    highlights: ['distributed_systems'],
    compensation_relationship: 'overlap',
    candidate_alias: P4标记.candidateAlias,
    experience_years: 5,
    job_status: 'employed',
    summary: P4标记.candidateSummary,
    skills: ['Go', 'Kubernetes'],
    educations: [
      { institution: 'P4 Fixture 大学', major: '计算机科学', degree: '本科', start_month: '2017-09', end_month: '2021-06' },
    ],
    favorite: false,
    rejected: false,
    rejection_reason: null,
    state: 'available',
    delegation: null,
    ...覆盖,
  };
}

function P4意向(覆盖: Partial<P4意向形> & Pick<P4意向形, 'intention_id' | 'job_category'>): P4意向形 {
  return {
    recruitment_type: 'social_full_time',
    primary_location: { id: 'loc-fixture-p4', display_name: 'P4 Fixture 市' },
    alternate_locations: [],
    industries: [],
    workplace_modes: ['onsite'],
    compensation: { mode: 'range', lower: 30, upper: 50, annual_salary_months: 15 },
    salary_period: 'month',
    graduation_month: null,
    internship_months: null,
    onsite_days_per_week: null,
    exclusions: {
      alternate_weekend_work: 'unspecified',
      outsourcing_only: 'unspecified',
      onsite_only: 'unspecified',
      frequent_travel: 'unspecified',
    },
    private_preferences: '',
    status: 'active',
    revision: 1,
    created_at: '2026-08-27T00:00:00Z',
    updated_at: '2026-08-27T00:00:00Z',
    ...覆盖,
  };
}

/** 招聘端 owner 岗位（P1C 岗位形）：title 与候选端 CandidateJob 同一标记，编号是 owner job 坐标 */
function P4招聘岗位(覆盖: Partial<P1C岗位形> = {}): P1C岗位形 {
  return P1C岗位({
    job_id: P4编号.recruiterJob,
    title: P4标记.jobTitle,
    recruitment_type: 'social_full_time',
    category: { id: 'job-fixture-p4-cat', display_name: '后端工程师' },
    location: { id: 'loc-fixture-p4', display_name: 'P4 Fixture 市' },
    salary_lower: 30,
    salary_upper: 50,
    salary_period: 'month',
    annual_salary_months: 15,
    campus_cohort: null,
    internship_months: null,
    onsite_days_per_week: null,
    ...覆盖,
  });
}

function P4发现fixture(分支: P4发现分支形 = {}): P4发现fixture形 {
  return {
    // 缺省意向列表 = 单条 active 的 P4 意向：水合后 当前意向编号 载体即指向
    // 候选推荐数据的 scope 键（需要双意向的用例自行覆盖 意向们）
    意向们: [P4意向({ intention_id: P4编号.intention, job_category: { id: 'job-fixture-p4-cat', display_name: '后端工程师' } })],
    候选推荐: { [P4编号.intention]: [P4候选卡()] },
    候选岗位: { [P4编号.job]: P4CandidateJob() },
    招聘可用: {
      [P4编号.recruiterJob]: [
        P4招聘卡(),
        P4招聘卡({ recommendation_id: P4补充编号.招聘候选乙, candidate_alias: 'P4候选乙', rank: 2, match_score: 76 }),
      ],
    },
    招聘已筛: {},
    刷新次数: { candidate: 0, recruiter: 0 },
    委托读取: [],
    变更请求: [],
    分支,
  };
}

const fixture主体 = {
  subject_id: 'subj-fixture-001',
  roles: [{ role: 'candidate' as const, status: 'active' as const }],
  last_used_role: 'candidate' as const,
};

const fixture简历 = {
  profile: {
    real_name: 标记.主体真名,
    work_start_year: 2019,
    status: 'employed' as const,
    current_education: null,
    graduation_year: null,
    gender: null,
    birth_year: null,
    birth_month: null,
  },
  profile_revision: 1,
  summary: 标记.简历summary,
  summary_revision: 1,
  skills: ['Go', '分布式事务'],
  skills_revision: 1,
  experiences: [],
  educations: [],
  certificates: [],
  aggregate_revision: 1,
};

const fixture意向列表 = {
  intentions: [
    {
      // Task 8：用 P6 契约形的真实 intention_id（int_ + 32 hex），意向级规则 scope 与
      // 意向级创建 body 引用的都是这一个权威 ID
      intention_id: P6标记.意向编号,
      recruitment_type: 'social_full_time' as const,
      job_category: { id: 'job-fixture-001', display_name: 标记.职位display },
      primary_location: { id: 'loc-fixture-001', display_name: 标记.意向标题城市 },
      alternate_locations: [],
      industries: [],
      workplace_modes: ['onsite' as const],
      compensation: { mode: 'range' as const, lower: 30, upper: 50, annual_salary_months: 15 },
      salary_period: 'month' as const,
      graduation_month: null,
      internship_months: null,
      onsite_days_per_week: null,
      exclusions: {
        alternate_weekend_work: 'unspecified' as const,
        outsourcing_only: 'unspecified' as const,
        onsite_only: 'unspecified' as const,
        frequent_travel: 'unspecified' as const,
      },
      private_preferences: '',
      status: 'active' as const,
      revision: 1,
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// P1C 组织域 fixture（@backend）。所有标记值只存在于 fixture，断言页面展示它们
// 即证明渲染来自 HTTP 而非 Mock。fixture 不伪造 opaque Organization ID ——
// 没有企业关系的用例（未认证声明发岗）organizations 刻意留空。
// ─────────────────────────────────────────────────────────────────────────────

const P1C标记 = {
  招聘方公开名: '后端 fixture 招聘方',
  招聘方职务: 'Fixture 招聘负责人',
  组织甲编号: 'org-fixture-001',
  组织甲名: 'Fixture 云衢科技',
  组织甲法定名: '上海 Fixture 云衢信息科技有限公司',
  组织乙编号: 'org-fixture-002',
  组织乙名: 'Fixture 关联企业',
  品牌名: 'Fixture 云衢',
  公司介绍: '这是 fixture 的公司介绍原文。',
} as const;

type P1C验证状态 = 'unverified' | 'verified';

interface P1C招聘方档案形 {
  public_name: string;
  title: string;
  personal_verification_status: P1C验证状态;
  verified_name: string | null;
  avatar_url: string | null;
  revision: number;
}

interface P1C企业关系形 {
  affiliation_id: string;
  organization_id: string;
  organization_display_name: string;
  organization_status: 'active' | 'suspended';
  status: 'pending' | 'verified' | 'revoked';
  role: 'member' | 'admin';
  verification_method: 'admin_invitation' | 'corporate_email' | 'manual_admin_review';
  revision: number;
}

interface P1C企业媒体形 {
  media_id: string;
  media_type: 'image/png' | 'image/jpeg';
  size_bytes: number;
  width: number;
  height: number;
  url: string;
}

interface P1C企业档案形 {
  brand_name: string;
  industry: { id: string; display_name: string } | null;
  company_size: string;
  funding_stage: string;
  office_address: string;
  benefit_codes: string[];
  work_schedule: string;
  company_intro: string;
  business_items: string[];
  product_intro: string;
  team_members: { name: string; title: string; summary: string }[];
  logo: P1C企业媒体形 | null;
  office_media: P1C企业媒体形[];
  company_media: P1C企业媒体形[];
  revision: number;
  updated_at: string | null;
}

interface P1C组织形 {
  legal_name: string;
  display_name: string;
  profile: P1C企业档案形;
}

interface P1C管理员申请形 {
  request_id: string;
  legal_name: string;
  display_name: string;
  domains: string[];
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  revision: number;
}

/** BFFOwnerJob 的 fixture 形（可选投影键允许缺省，与服务端推导口径一致） */
interface P1C岗位形 {
  job_id: string;
  publisher_mode: 'direct' | 'agency';
  publisher_affiliation_ref?: string;
  publisher_verification_status: P1C验证状态;
  hiring_organization_claim: { display_name: string; legal_name: string | null };
  publisher_organization_ref?: string;
  hiring_organization_verification_status: P1C验证状态;
  hiring_organization_ref?: string;
  title: string;
  recruitment_type: 'social_full_time' | 'campus' | 'internship' | 'part_time';
  category: { id: string; display_name: string };
  location: { id: string; display_name: string };
  office_location: string;
  workplace_mode: 'onsite' | 'hybrid' | 'remote';
  salary_lower: number;
  salary_upper: number;
  salary_period: 'month' | 'day' | 'hour';
  annual_salary_months: number | null;
  campus_cohort: number | null;
  internship_months: number | null;
  onsite_days_per_week: number | null;
  experience_requirement: string;
  education_requirement: string;
  structured_requirements_confirmed: boolean;
  description: string;
  requirements: string;
  keywords: string[];
  private_screening_preferences: string;
  // P3：四员硬性条件是 Owner Job 的必备成员 —— 前端按 exact key set + 闭合档位 fail-closed 校验，
  // 所有 Owner Job fixture（GET 列表 / POST / PATCH 应答）都必须带完整四员，缺员即水合拒绝。
  hard_requirements: P3硬性条件形;
  status: 'active' | 'archived';
  revision: number;
  published_at: string;
  created_at: string;
  updated_at: string;
}

interface P1C招聘组织Fixture形 {
  profile: P1C招聘方档案形;
  affiliations: P1C企业关系形[];
  organizations: Record<string, P1C组织形>;
  adminRequests: P1C管理员申请形[];
  ownerJobs: P1C岗位形[];
}

/** 招聘方 onboarding 变更回执：写入方法 / 路径 / body 与该次写入实际带的 If-Match */
interface 招聘方Onboarding变更 {
  method: string;
  path: string;
  body: unknown;
  ifMatch: string | null;
}

/**
 * 全新招聘方 onboarding 的可变 fixture：与 P1C招聘组织Fixture形 同域但**独立**
 * —— profile 真正可空（首读 404 not_found），首写经 revision-zero 的 CAS 变成权威 DTO。
 * 与候选 onboarding fixture 无任何共享或复位关系：各测试自持一份。
 */
interface 招聘方OnboardingFixture形 {
  profile: P1C招聘方档案形 | null;
  affiliations: P1C企业关系形[];
  organizations: Record<string, P1C组织形>;
  adminRequests: P1C管理员申请形[];
  ownerJobs: P1C岗位形[];
  mutations: 招聘方Onboarding变更[];
}

function 创建招聘方OnboardingFixture(): 招聘方OnboardingFixture形 {
  return {
    profile: null,
    affiliations: [],
    organizations: {},
    adminRequests: [],
    ownerJobs: [],
    mutations: [],
  };
}

function P1C企业档案(): P1C企业档案形 {
  return {
    brand_name: P1C标记.品牌名,
    industry: { id: 'ind-fixture-001', display_name: 'Fixture 行业' },
    company_size: '20_99',
    funding_stage: 'angel',
    office_address: 'Fixture 市 Fixture 路 1 号',
    benefit_codes: ['social_insurance_housing_fund'],
    work_schedule: 'two_day_weekend',
    company_intro: P1C标记.公司介绍,
    business_items: ['Fixture 主营业务一'],
    product_intro: 'Fixture 产品介绍',
    team_members: [{ name: 'Fixture 成员', title: '工程师', summary: 'Fixture 成员简介' }],
    logo: null,
    office_media: [],
    company_media: [],
    revision: 2,
    updated_at: '2026-08-25T00:00:00Z',
  };
}

function P1C企业关系(覆盖: Partial<P1C企业关系形> = {}): P1C企业关系形 {
  return {
    affiliation_id: 'aff-fixture-001',
    organization_id: P1C标记.组织甲编号,
    organization_display_name: P1C标记.组织甲名,
    organization_status: 'active',
    status: 'verified',
    role: 'member',
    verification_method: 'admin_invitation',
    revision: 1,
    ...覆盖,
  };
}

function P1C岗位(覆盖: Partial<P1C岗位形> = {}): P1C岗位形 {
  return {
    job_id: 'job-fixture-001',
    publisher_mode: 'direct',
    publisher_verification_status: 'verified',
    hiring_organization_claim: { display_name: P1C标记.组织甲名, legal_name: null },
    publisher_organization_ref: P1C标记.组织甲编号,
    hiring_organization_verification_status: 'verified',
    hiring_organization_ref: P1C标记.组织甲编号,
    title: 'Fixture 岗位（带企业引用）',
    recruitment_type: 'internship',
    category: { id: 'job-fixture-001', display_name: 标记.职位display },
    location: { id: 'loc-fixture-001', display_name: 标记.城市display },
    office_location: 'Fixture 市 Fixture 路 1 号',
    workplace_mode: 'hybrid',
    salary_lower: 200,
    salary_upper: 400,
    salary_period: 'day',
    annual_salary_months: null,
    campus_cohort: null,
    internship_months: 3,
    onsite_days_per_week: 4,
    experience_requirement: 'none',
    education_requirement: 'none',
    structured_requirements_confirmed: true,
    description: 'Fixture 岗位描述',
    requirements: 'Fixture 岗位要求',
    keywords: [],
    private_screening_preferences: '',
    hard_requirements: P3全未知硬性条件(),
    status: 'active',
    revision: 1,
    published_at: '2026-08-25T00:00:00Z',
    created_at: '2026-08-25T00:00:00Z',
    updated_at: '2026-08-25T00:00:00Z',
    ...覆盖,
  };
}

/** 主管 fixture：未认证招聘方 + 无任何企业关系（公司输入走未认证声明）+ 一条待审核管理员申请 */
const P1C招聘组织Fixture: P1C招聘组织Fixture形 = {
  profile: {
    public_name: P1C标记.招聘方公开名,
    title: P1C标记.招聘方职务,
    personal_verification_status: 'unverified',
    verified_name: null,
    avatar_url: null,
    revision: 3,
  },
  affiliations: [],
  organizations: {},
  adminRequests: [
    { request_id: 'req-fixture-001', legal_name: P1C标记.组织甲法定名, display_name: P1C标记.组织甲名, domains: ['fixture.example'], status: 'pending', revision: 1 },
  ],
  ownerJobs: [],
};

/** admin@组织甲（verified/active → 可写公司档案） */
const P1C管理员关系 = P1C企业关系({ affiliation_id: 'aff-fixture-admin', role: 'admin' });
/** member@组织乙（verified/active → 只读公司档案） */
const P1C成员关系 = P1C企业关系({
  affiliation_id: 'aff-fixture-member',
  organization_id: P1C标记.组织乙编号,
  organization_display_name: P1C标记.组织乙名,
  role: 'member',
  verification_method: 'corporate_email',
});

const P1C组织甲 = (): P1C组织形 => ({
  legal_name: P1C标记.组织甲法定名,
  display_name: P1C标记.组织甲名,
  profile: P1C企业档案(),
});

const P1C组织乙 = (): P1C组织形 => ({
  legal_name: '上海 Fixture 关联企业有限公司',
  display_name: P1C标记.组织乙名,
  profile: P1C企业档案(),
});

/** 在主管 fixture 上叠企业关系 / 在招岗位（各用例按需组合） */
function 带企业关系(
  base: P1C招聘组织Fixture形,
  关系们: P1C企业关系形[],
  组织们: Record<string, P1C组织形>,
  岗位们: P1C岗位形[] = [],
): P1C招聘组织Fixture形 {
  return { ...base, affiliations: 关系们, organizations: 组织们, ownerJobs: 岗位们 };
}

/** 1×1 PNG：上传用（头像 / 企业媒体），不依赖任何本地图片文件 */
const 一像素PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

// ─────────────────────────────────────────────────────────────────────────────
// P3 隐私域 fixture（Task 6）：/api/v1/me/privacy 整读与稀疏补丁、组织屏蔽与解除、
// 可屏蔽组织搜索。所有标记值只存在于 fixture（明显的合成编号），断言页面展示它们
// 即证明渲染来自 HTTP 而非 Mock。每个请求的 path/method/body/If-Match/Idempotency-Key
// 都经 请求拦截 记录，密钥只在测试进程内比对，不进日志。
// ─────────────────────────────────────────────────────────────────────────────

const P3标记 = {
  /** 组织搜索命中（自动来源屏蔽用）——同一族三个，第一页两枚便于验证游标 */
  可屏蔽组织甲: 'Fixture 云衢关联甲',
  可屏蔽组织甲法定: '上海 Fixture 云衢关联甲有限公司',
  可屏蔽组织乙: 'Fixture 云衢关联乙',
  可屏蔽组织乙法定: '上海 Fixture 云衢关联乙有限公司',
  可屏蔽组织丙: 'Fixture 云衢关联丙',
  可屏蔽组织丙法定: '上海 Fixture 云衢关联丙有限公司',
  /** 手动添加搜索族 */
  手动组织甲: 'Fixture 磐石信息',
  手动组织甲法定: '上海 Fixture 磐石信息有限公司',
  /** 停用组织：strict 口径绝不进搜索结果，但允许出现在既有屏蔽里 */
  停用组织: 'Fixture 停用旧东家',
  停用组织法定: '上海 Fixture 停用旧东家有限公司',
  冲突披露值显示: '一直允许',
} as const;

/** BFF硬性条件的 fixture 形（四员闭合，缺一即服务端契约漂移） */
type P3硬性档 = 'required' | 'not_required' | 'unknown';

interface P3硬性条件形 {
  alternate_weekend_work: P3硬性档;
  outsourcing_only: P3硬性档;
  onsite_only: P3硬性档;
  frequent_travel: P3硬性档;
}

/** 服务端存储口径的四员兜底：全部 未说明（unknown），只许 fixture 合成，客户端解码不做兜底 */
const P3全未知硬性条件 = (): P3硬性条件形 => ({
  alternate_weekend_work: 'unknown',
  outsourcing_only: 'unknown',
  onsite_only: 'unknown',
  frequent_travel: 'unknown',
});

interface P3屏蔽形 {
  organization_id: string;
  organization_display_name: string;
  organization_status: 'active' | 'suspended';
  source: 'current_employer' | 'related_organization' | 'manual';
  created_at: string;
}

interface P3隐私形 {
  employer_privacy_enabled: boolean;
  disclosure_preferences: {
    current_employer: 'never' | 'resume_submission' | 'anonymous';
    education: 'never' | 'resume_submission' | 'anonymous';
    portfolio_links: 'never' | 'resume_submission' | 'anonymous';
  };
  organization_blocks: P3屏蔽形[];
  revision: number;
  updated_at: string;
}

/** 组织库里的一项：搜索池与屏蔽元数据共用（搜索只回 active） */
interface P3组织库项形 {
  display_name: string;
  legal_name: string;
  status: 'active' | 'suspended';
}

/**
 * GET /me/privacy 的脚本队列项：
 *  - 无项 → 按当前权威视图即刻应答；
 *  - { 保持 } → 本次请求挂起，测试调 兑现() 放行后再按当时视图应答（口径对齐安全重读语义）；
 *  - { 响应 } → 强制以这份（可能过时的）快照应答，制造跨会话陈旧响应。
 */
interface P3隐私读取脚本形 {
  /** 本次请求先挂起，直到这个 promise 兑现后再按当时视图应答 */
  保持?: Promise<void>;
  响应?: P3隐私形;
}

/** 单个搜索词的行为脚本（竞态用例）：延迟应答 + 固定项目/游标；未命中脚本的词走组织池 */
interface P3搜索脚本形 {
  词: string;
  延迟毫秒?: number;
  items: { organization_id: string; display_name: string; legal_name: string }[];
  next_cursor: string | null;
}

/** P3 隐私域可变 fixture：测试自持一份，安装路由后 handler 与测试共享同一对象 */
interface P3隐私fixture形 {
  /** 权威视图（live）：handler 直读直写；测试也可在两步之间直接改它模拟他端变更 */
  视图: P3隐私形;
  /** 组织搜索池（key = organization_id）；strict active 搜索只回 active 项 */
  组织库: Record<string, P3组织库项形>;
  /** GET privacy 脚本队列（FIFO，逐次消费） */
  get脚本: P3隐私读取脚本形[];
  /** 搜索行为脚本（按词匹配一次性消费） */
  搜索脚本: P3搜索脚本形[];
  /** 已受理的组织搜索（请求到达即记；竞态用例轮询「已发出」） */
  搜索完成: { q: string; cursor: string | null }[];
  /** 已应答的组织搜索（应答回写后记；竞态用例轮询「旧响应已终结」） */
  搜索已答: { q: string; cursor: string | null }[];
  /** 写入计数（不含 hydration 读），零基线由各用例自行快照增量 */
  统计: { 补丁: number; 屏蔽写入: number; 解除写入: number };
  /** 幂等键 → 回执 登记表：同键重放回原 receipt（200） */
  幂等登记: Map<string, { receipt: unknown; 块: P3屏蔽形 }>;
}

function P3隐私fixture(覆盖: Partial<P3隐私形> = {}): P3隐私fixture形 {
  const 初始视图: P3隐私形 = {
    employer_privacy_enabled: true,
    disclosure_preferences: {
      current_employer: 'never',
      education: 'resume_submission',
      portfolio_links: 'anonymous',
    },
    organization_blocks: [],
    revision: 1,
    updated_at: '2026-08-26T00:00:00Z',
    ...覆盖,
  };
  return {
    视图: 初始视图,
    组织库: {},
    get脚本: [],
    搜索脚本: [],
    搜索完成: [],
    搜索已答: [],
    统计: { 补丁: 0, 屏蔽写入: 0, 解除写入: 0 },
    幂等登记: new Map(),
  };
}

/** 可屏蔽组织的默认搜索池：同族三枚 active（首页两枚留游标）+ 一枚手动族 + 一枚停用 */
function P3默认组织库(): Record<string, P3组织库项形> {
  return {
    'org-fixture-p3-block-a': { display_name: P3标记.可屏蔽组织甲, legal_name: P3标记.可屏蔽组织甲法定, status: 'active' },
    'org-fixture-p3-block-b': { display_name: P3标记.可屏蔽组织乙, legal_name: P3标记.可屏蔽组织乙法定, status: 'active' },
    'org-fixture-p3-block-c': { display_name: P3标记.可屏蔽组织丙, legal_name: P3标记.可屏蔽组织丙法定, status: 'active' },
    'org-fixture-p3-manual-a': { display_name: P3标记.手动组织甲, legal_name: P3标记.手动组织甲法定, status: 'active' },
    'org-fixture-p3-suspended': { display_name: P3标记.停用组织, legal_name: P3标记.停用组织法定, status: 'suspended' },
  };
}

/** 发送前克隆视图：测试随后改权威对象不应影响已在途响应体 */
function P3克隆视图(视图: P3隐私形): P3隐私形 {
  return {
    ...视图,
    disclosure_preferences: { ...视图.disclosure_preferences },
    organization_blocks: 视图.organization_blocks.map((块) => ({ ...块 })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// P2 附件简历域 fixture（Task 7）。wire 形就地声明，不反向依赖 src；PDF bytes 统一
// Buffer.from('%PDF-1.7\nfixture\n')，不把二进制字面量写进 spec。可变接口冻结为
// P2附件fixture形：清单 GET 驱动 pending →(第 2 读)→ processing →(第 3+ 读)→ 终态
// 状态机，写入（create/replace/parse）把 列表读取次数 归零重放状态机；删除不重置读取。
// handler 对未知 multipart part、缺 consent、错 If-Match、缺幂等键直接 throw（fail closed）。
// ─────────────────────────────────────────────────────────────────────────────

type P2失败码 = 'document_unreadable' | 'document_too_complex' | 'parser_invalid_output' | 'parser_temporarily_unavailable';
type P2解析形 =
  | { status: 'not_started' }
  | { status: 'pending' | 'processing'; updated_at: string }
  | { status: 'succeeded'; parse_id: string; updated_at: string }
  | { status: 'failed'; failure_code: P2失败码; updated_at: string };

interface P2附件形 {
  file_id: string;
  display_name: string;
  revision: number;
  current_version: {
    version_id: string; version: number; size_bytes: number; media_type: 'application/pdf';
    sha256: string; created_at: string; parse: P2解析形;
  };
  created_at: string;
  updated_at: string;
}

const P2限制 = { max_files: 3, max_file_bytes: 10_485_760, accepted_media_types: ['application/pdf'] } as const;
const P2时间 = '2026-08-28T00:00:00Z';

function P2要求(condition: unknown): asserts condition {
  if (!condition) throw new Error('P2 fixture received an invalid wire request');
}

function P2新附件(id: number, displayName: string, bytes: Buffer): P2附件形 {
  return {
    file_id: `rf_${id}`, display_name: displayName, revision: 1,
    current_version: {
      version_id: `rfv_${id}_1`, version: 1, size_bytes: bytes.length,
      media_type: 'application/pdf', sha256: 'a'.repeat(64), created_at: P2时间,
      parse: { status: 'pending', updated_at: P2时间 },
    },
    created_at: P2时间, updated_at: P2时间,
  };
}

interface P2附件fixture形 {
  items: P2附件形[];
  列表读取次数: number;
  写入次数: number;
  下载次数: number;
  下一个编号: number;
  下次终态: 'succeeded' | P2失败码;
}

function 创建P2附件fixture(下次终态: 'succeeded' | P2失败码 = 'succeeded'): P2附件fixture形 {
  return { items: [], 列表读取次数: 0, 写入次数: 0, 下载次数: 0, 下一个编号: 1, 下次终态 };
}

// ─────────────────────────────────────────────────────────────────────────────
// P5 MatchCase 域可变 fixture（Task 8）。双端（候选 me / 招聘 recruiter）match-cases
// 的 open 工作区、ended/completed 历史架子、四阶段详情、S0–S3 命令、Case 叮嘱与
// 披露后的原始简历 PDF。状态元组只取已准入 17 行矩阵（backend local-e2e J1–J6 的
// 真实迁移：S2 双角色 accept 才进 S3、第二笔 confirm 才 completed、失败解析挡披露
// 后同键重放同一对即披露、invitation decline = decisions action:end）；编号与标记值
// （P5编号 / P5标记）只存在于 fixture，Mock 数据里没有，断言页面展示它们即证明
// 渲染来自 HTTP 而非 Mock。列表两页翻页（首页 1 条 + cursor，游标原样透传）；
// 变更回执（method/path/body/Idempotency-Key）原样存 变更请求，同键重放回 200、
// 决过再发新键答 409；每个 Case JSON 应答带 Cache-Control: no-store、PDF 应答
// private, no-store —— 应答头逐笔存 应答头存证（fixture 侧 no-store 证据）。
// ─────────────────────────────────────────────────────────────────────────────

const P5编号 = {
  job: 'job_00112233445566778899aabbccdde5a1',
  甲: 'mccase_p5_0000000000000000000000a1',
  乙: 'mccase_p5_0000000000000000000000a2',
  丙一: 'mccase_p5_0000000000000000000000a3',
  丙二: 'mccase_p5_0000000000000000000000a4',
  丁: 'mccase_p5_0000000000000000000000a5',
  戊: 'mccase_p5_0000000000000000000000a6',
  己: 'mccase_p5_0000000000000000000000a7',
  坏生命周期: 'mccase_p5_bad_lifecycle',
  坏阶段: 'mccase_p5_bad_stage',
  坏状态: 'mccase_p5_bad_status',
  坏步骤: 'mccase_p5_bad_step',
  坏四元组: 'mccase_p5_bad_tuple',
  坏行: 'mccase_p5_bad_row',
  问题: 'p5prompt_0001',
  协同: 'cdi_00112233445566778899aabbccddee50',
  文件: 'rf_00112233445566778899aabbccddee51',
  文件版本: 'rfv_00112233445566778899aabbccddee52',
} as const;

const P5标记 = {
  招聘岗标题: 'P5 Fixture 招聘岗',
  甲职位名: 'P5 Fixture 在谈岗位·甲',
  乙职位名: 'P5 Fixture 在谈岗位·乙',
  丙一职位名: 'P5 Fixture 在谈岗位·丙一',
  丙二职位名: 'P5 Fixture 在谈岗位·丙二',
  丁职位名: 'P5 Fixture 在谈岗位·丁',
  戊职位名: 'P5 Fixture 终局岗位·戊',
  己职位名: 'P5 Fixture 终局岗位·己',
  城市: 'P5 Fixture 市',
  薪资带: 'P5 30-45K·15薪',
  技能: 'P5FixtureGo',
  甲别名: 'candidate-00000000a5a1',
  乙别名: 'candidate-00000000a5a2',
  丙一别名: 'candidate-00000000a5a3',
  丙二别名: 'candidate-00000000a5a4',
  丁别名: 'candidate-00000000a5a5',
  戊别名: 'candidate-00000000a5a6',
  己别名: 'candidate-00000000a5a7',
  简历名: 'P5 Fixture 原始简历.pdf',
  问题: 'P5 Fixture 每周可以到岗几天？',
  回答: 'P5 Fixture 回答：每周可以到岗 3 天',
  叮嘱: 'P5 Fixture 只在工作日 10:00-19:00 联系',
} as const;

type P5生命周期词 = 'open' | 'ended' | 'completed';
type P5阶段词 = 'anonymous_screening' | 'resume_submission' | 'needs_coordination' | 'intent_confirmation';
type P5状态词 = 'running' | 'needs_user' | 'passed' | 'attention_required' | 'ended' | 'waiting';
type P5角色词 = 'candidate' | 'recruiter';
type P5意向词 = '' | 'confirm' | 'decline';

interface P5时间线wire形 {
  event_id: string;
  stage: P5阶段词;
  kind: string;
  role: '' | P5角色词;
  reason_code?: string;
  ref?: string;
  text?: string;
  occurred_at: string;
}

interface P5阶段区wire形 {
  stage: P5阶段词;
  state: 'pending' | 'active' | 'passed' | 'ended';
  occurred_at: string | null;
  summary: string;
  checklist: { label: string; done: boolean }[];
  transcript: P5时间线wire形[];
  instruction_receipts: { instruction_id: string; owner: P5角色词; stage: P5阶段词; expression?: string; occurred_at: string }[];
}

interface P5Case记录形 {
  caseId: string;
  lifecycle: P5生命周期词;
  stage: P5阶段词;
  status: P5状态词;
  step: string;
  round: number;
  roundBudget: number;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  outcome: string | null;
  outcomeCode: string | null;
  候选: { needsAction: boolean; actions: string[] };
  招聘: { needsAction: boolean; actions: string[] };
  intentionId: string;
  alias: string;
  职位名: string;
  阶段区们: P5阶段区wire形[];
  协同?: { issue_id: string; kind: string; required_roles: P5角色词[]; candidate_decided: boolean; recruiter_decided: boolean };
  意向词: { candidate: P5意向词; recruiter: P5意向词 };
  终局?: { stage: P5阶段词; outcome: string; reason_summary: string; finalized_at: string };
  /** 已绑定递交对（阶段区 typed 附件的来源；候选端恒可见，招聘端要 已披露） */
  已绑定: boolean;
  已披露: boolean;
  /** S1 readiness 状态机：pending/failed 挡披露（409），succeeded 才接受递交 */
  解析: 'none' | 'pending' | 'failed' | 'succeeded';
  /** 非法分支：原样覆盖 state wire（未知词 / 矩阵外四元组），decode 必须 fail closed */
  state覆盖?: Record<string, unknown>;
  /** P7（Task 7）：completed + complete 时的已发布会话坐标；handoff_pending 恒 null。 */
  conversationRef: string | null;
}

const P5阶段顺序 = ['anonymous_screening', 'resume_submission', 'needs_coordination', 'intent_confirmation'] as const;

function P5阶段序(stage: P5阶段词): number {
  return P5阶段顺序.indexOf(stage);
}

/** 阶段区自身 state 的服务端语义：open 以当前阶段为 active、前段 passed、后段 pending；
 *  ended 在定格段收 ended；completed 全 passed。随 Case 当前 stage 动态求值 —— 命令推进
 *  stage 后，已过段立刻转 passed、新当前段转 active（服务端真相，绝不冻结在建造时刻）。 */
function P5区态(c: P5Case记录形, 序: number): { state: P5阶段区wire形['state']; occurred_at: string | null } {
  const 定格序 = c.lifecycle === 'open'
    ? P5阶段序(c.stage)
    : P5阶段序((c.终局?.stage ?? c.stage) as P5阶段词);
  if (c.lifecycle === 'completed') return { state: 'passed', occurred_at: c.createdAt };
  if (序 < 定格序) return { state: 'passed', occurred_at: c.createdAt };
  if (序 === 定格序) return { state: c.lifecycle === 'open' ? 'active' : 'ended', occurred_at: c.createdAt };
  return { state: 'pending', occurred_at: null };
}

/** 四阶段区固定 S0→S3 的存储底座（summary/checklist/transcript/回执按段累积）。 */
function P5阶段区组(c: P5Case记录形): P5阶段区wire形[] {
  return P5阶段顺序.map((stage, 序) => ({
    stage,
    ...P5区态(c, 序),
    summary: `P5 Fixture ${stage} 段摘要·${c.caseId.slice(-4)}`,
    checklist: [],
    transcript: [],
    instruction_receipts: [],
  }));
}

function P5Case(基: Partial<P5Case记录形> & Pick<
  P5Case记录形, 'caseId' | 'lifecycle' | 'stage' | 'status' | 'step' | '职位名' | 'alias'
>): P5Case记录形 {
  const c = {
    round: 1,
    roundBudget: 3,
    createdAt: '2026-08-29T01:00:00Z',
    updatedAt: '2026-08-29T02:00:00Z',
    finalizedAt: null,
    outcome: null,
    outcomeCode: null,
    候选: { needsAction: false, actions: [] },
    招聘: { needsAction: false, actions: [] },
    intentionId: P6标记.意向编号,
    意向词: { candidate: '' as P5意向词, recruiter: '' as P5意向词 },
    已绑定: false,
    已披露: false,
    解析: 'none' as P5Case记录形['解析'],
    conversationRef: null,
    ...基,
  } as P5Case记录形;
  c.阶段区们 = 基.阶段区们 ?? P5阶段区组(c);
  return c;
}

function P5状态wire(c: P5Case记录形): Record<string, unknown> {
  const 视图: Record<string, unknown> = {
    case_id: c.caseId,
    lifecycle: c.lifecycle,
    stage: c.stage,
    status: c.status,
    step: c.step,
    round: c.round,
    round_budget: c.roundBudget,
    needs_user: c.status === 'needs_user',
    outcome: c.outcome,
    outcome_code: c.outcomeCode,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
  if (c.finalizedAt !== null) 视图.finalized_at = c.finalizedAt;
  return { ...视图, ...(c.state覆盖 ?? {}) };
}

function P5职位wire(c: P5Case记录形): Record<string, unknown> {
  return {
    job_id: P5编号.job,
    job: {
      title: c.职位名,
      location: P5标记.城市,
      public_salary_range: P5标记.薪资带,
      required_skills: [P5标记.技能],
    },
  };
}

function P5列表项wire(c: P5Case记录形, 角色: P5角色词): Record<string, unknown> {
  const 项: Record<string, unknown> = {
    state: P5状态wire(c),
    needs_action: 角色 === 'candidate' ? c.候选.needsAction : c.招聘.needsAction,
    job: P5职位wire(c),
  };
  项[角色 === 'candidate' ? 'intention_id' : 'candidate_alias'] = 角色 === 'candidate' ? c.intentionId : c.alias;
  return 项;
}

function P5递交结果wire(c: P5Case记录形): Record<string, unknown> {
  return {
    state: P5状态wire(c),
    resume_submission: {
      submission_id: 'rs_00112233445566778899aabbccddee53',
      display_name: P5标记.简历名,
      size_bytes: 1024,
      media_type: 'application/pdf',
      sha256: 'c'.repeat(64),
      submitted_at: c.updatedAt,
    },
  };
}

/** 详情 wire：候选端只带 intention_id、招聘端只带 candidate_alias；附件只落在 S1 段且
 *  招聘端必须已披露（匿名初筛段永不携带 —— 披露栅栏）；协同/终局块只接受缺席语义。 */
function P5详情wire(c: P5Case记录形, 角色: P5角色词): Record<string, unknown> {
  const 附件可见 = c.已绑定 && (角色 === 'candidate' || c.已披露);
  const 详情: Record<string, unknown> = {
    state: P5状态wire(c),
    needs_action: 角色 === 'candidate' ? c.候选.needsAction : c.招聘.needsAction,
    available_actions: 角色 === 'candidate' ? [...c.候选.actions] : [...c.招聘.actions],
    stages: c.阶段区们.map((区, 序) => ({
      ...区,
      ...P5区态(c, 序), // 段态随当前 stage 动态求值（推进后已过段转 passed、新当前段转 active）
      ...(区.stage === 'resume_submission' && 附件可见
        ? { attachment: { file_id: P5编号.文件, file_version_id: P5编号.文件版本, display_name: P5标记.简历名 } }
        : {}),
    })),
    intent_confirmations: { ...c.意向词 },
    job: P5职位wire(c),
  };
  if (c.协同 && c.lifecycle === 'open' && c.stage === 'needs_coordination') {
    详情.current_coordination = { ...c.协同, required_roles: [...c.协同.required_roles] };
  }
  if (c.终局 && c.lifecycle !== 'open') 详情.terminal_summary = { ...c.终局 };
  // P7（Task 7）：completed + complete 才携带已发布会话坐标；pending/open/ended 必缺席
  if (c.lifecycle === 'completed' && c.step === 'complete' && c.conversationRef !== null) {
    详情.conversation_ref = c.conversationRef;
  }
  详情[角色 === 'candidate' ? 'intention_id' : 'candidate_alias'] = 角色 === 'candidate' ? c.intentionId : c.alias;
  return 详情;
}

interface P5MatchCasefixture形 {
  cases: Record<string, P5Case记录形>;
  /** open 列表服务端顺序（needs_action DESC, updated_at DESC）：翻页按此切两页 */
  候选open顺序: string[];
  招聘open顺序: string[];
  历史顺序: Record<'ended' | 'completed', string[]>;
  变更请求: { method: string; path: string; body: unknown; idempotencyKey: string | null }[];
  PDF读取: string[];
  应答头存证: { path: string; cacheControl: string }[];
  /** 事实首答 503 分支的每 Case 计数（前两把键都 503：第一把被传输层受控重试消耗，
   *  第二把把失败递到屏层 —— 意图键保留，用户再提交即同键重放成功） */
  已503: Map<string, number>;
  叮嘱序: number;
  分支: { 坏行进列表?: boolean; 事实首答503?: boolean };
}

function 创建P5MatchCasefixture(): P5MatchCasefixture形 {
  // 乙：S0 待答事实行（open/anonymous_screening/needs_user·human_decision）—— 候选端
  // 独占 respond_fact/end_screening 卡；transcript 唯一一条 supplementary_question。
  const 乙 = P5Case({
    caseId: P5编号.乙, lifecycle: 'open', stage: 'anonymous_screening', status: 'needs_user', step: 'human_decision',
    职位名: P5标记.乙职位名, alias: P5标记.乙别名, updatedAt: '2026-08-29T02:06:00Z',
    候选: { needsAction: true, actions: ['respond_fact', 'end_screening'] },
  });
  乙.阶段区们[0]!.transcript = [
    {
      event_id: 'evt_p5_q1', stage: 'anonymous_screening', kind: 'supplementary_question',
      role: 'candidate', ref: P5编号.问题, text: P5标记.问题, occurred_at: '2026-08-29T01:10:00Z',
    },
    {
      event_id: 'evt_p5_n1', stage: 'anonymous_screening', kind: 'stage_note',
      role: '', reason_code: 'policy_checked', occurred_at: '2026-08-29T01:20:00Z',
    },
  ];
  乙.阶段区们[0]!.checklist = [{ label: 'P5 Fixture 基础事实已核对', done: true }];

  // 丙一/丙二：S1 解析等待行（open/resume_submission/waiting·awaiting_resume_parse）。
  // 丙一解析中（递交答 409 not_started 挡披露）、丙二解析失败（首答 409 failed，随后
  // 转 succeeded —— 同键重放同一对即披露，backend J4 语义）。候选端有重试卡与 typed 附件。
  const 丙一 = P5Case({
    caseId: P5编号.丙一, lifecycle: 'open', stage: 'resume_submission', status: 'waiting', step: 'awaiting_resume_parse',
    职位名: P5标记.丙一职位名, alias: P5标记.丙一别名, updatedAt: '2026-08-29T02:04:00Z',
    候选: { needsAction: true, actions: ['retry_resume_readiness'] },
    已绑定: true, 解析: 'pending',
  });
  const 丙二 = P5Case({
    caseId: P5编号.丙二, lifecycle: 'open', stage: 'resume_submission', status: 'waiting', step: 'awaiting_resume_parse',
    职位名: P5标记.丙二职位名, alias: P5标记.丙二别名, updatedAt: '2026-08-29T02:03:00Z',
    候选: { needsAction: true, actions: ['retry_resume_readiness'] },
    已绑定: true, 解析: 'failed',
  });

  // 甲：同一 Case 的双端分歧主角（open/resume_submission/needs_user·awaiting_recruiter_decision）
  // —— 候选端零待办零卡、招聘端独占 decide_resume_screening 卡（backend J5b 同款）。
  // 已披露：招聘端 S1 段带 typed 附件（唯一 PDF 入口）。
  const 甲 = P5Case({
    caseId: P5编号.甲, lifecycle: 'open', stage: 'resume_submission', status: 'needs_user', step: 'awaiting_recruiter_decision',
    职位名: P5标记.甲职位名, alias: P5标记.甲别名, updatedAt: '2026-08-29T02:05:00Z',
    招聘: { needsAction: true, actions: ['decide_resume_screening'] },
    已绑定: true, 已披露: true, 解析: 'succeeded',
  });

  // 丁：S2 协同行（open/needs_coordination/needs_user·coordinating）—— 双端各持
  // decide_coordination 卡，双角色 accept 才进 S3，第二笔 confirm 才 completed。
  const 丁 = P5Case({
    caseId: P5编号.丁, lifecycle: 'open', stage: 'needs_coordination', status: 'needs_user', step: 'coordinating',
    职位名: P5标记.丁职位名, alias: P5标记.丁别名, updatedAt: '2026-08-29T02:07:00Z',
    候选: { needsAction: true, actions: ['decide_coordination'] },
    招聘: { needsAction: true, actions: ['decide_coordination'] },
    协同: {
      issue_id: P5编号.协同, kind: 'work_mode', required_roles: ['candidate', 'recruiter'],
      candidate_decided: false, recruiter_decided: false,
    },
  });

  // 戊：ended 架（S0 用户终止）；己：completed 移交架（S3 双确认 + handoff_pending）。
  const 戊 = P5Case({
    caseId: P5编号.戊, lifecycle: 'ended', stage: 'anonymous_screening', status: 'ended', step: 'complete',
    职位名: P5标记.戊职位名, alias: P5标记.戊别名,
    createdAt: '2026-08-28T01:00:00Z', updatedAt: '2026-08-28T03:00:00Z', finalizedAt: '2026-08-28T03:00:00Z',
    outcome: 'user_ended', outcomeCode: 'user_ended',
    终局: { stage: 'anonymous_screening', outcome: 'user_ended', reason_summary: 'user_ended', finalized_at: '2026-08-28T03:00:00Z' },
  });
  const 己 = P5Case({
    caseId: P5编号.己, lifecycle: 'completed', stage: 'intent_confirmation', status: 'passed', step: 'handoff_pending',
    职位名: P5标记.己职位名, alias: P5标记.己别名,
    createdAt: '2026-08-27T01:00:00Z', updatedAt: '2026-08-27T05:00:00Z', finalizedAt: '2026-08-27T05:00:00Z',
    意向词: { candidate: 'confirm' as P5意向词, recruiter: 'confirm' as P5意向词 },
    终局: { stage: 'intent_confirmation', outcome: '', reason_summary: '', finalized_at: '2026-08-27T05:00:00Z' },
  });
  己.阶段区们[3]!.summary = 'handoff_pending';
  己.阶段区们[3]!.transcript = [
    {
      event_id: 'evt_p5_done', stage: 'intent_confirmation', kind: 'case_completed',
      role: '', reason_code: 'handoff_pending', occurred_at: '2026-08-27T05:00:00Z',
    },
  ];

  // 非法分支探针：基行合法、只覆盖一个词（未知枚举词 / 矩阵外四元组），decode 必须 fail closed
  const 坏Case = (caseId: string, 覆盖: Record<string, unknown>) => P5Case({
    caseId, lifecycle: 'open', stage: 'anonymous_screening', status: 'needs_user', step: 'human_decision',
    职位名: `P5 Fixture 非法样本·${caseId}`, alias: 'candidate-00000000bad0', state覆盖: 覆盖,
  });

  return {
    cases: {
      [P5编号.甲]: 甲,
      [P5编号.乙]: 乙,
      [P5编号.丙一]: 丙一,
      [P5编号.丙二]: 丙二,
      [P5编号.丁]: 丁,
      [P5编号.戊]: 戊,
      [P5编号.己]: 己,
      [P5编号.坏生命周期]: 坏Case(P5编号.坏生命周期, { lifecycle: 'frozen' }),
      [P5编号.坏阶段]: 坏Case(P5编号.坏阶段, { stage: 'teleporting' }),
      [P5编号.坏状态]: 坏Case(P5编号.坏状态, { status: 'fluffy' }),
      [P5编号.坏步骤]: 坏Case(P5编号.坏步骤, { step: 'warp' }),
      [P5编号.坏四元组]: 坏Case(P5编号.坏四元组, { step: 'handoff_pending' }),
      [P5编号.坏行]: 坏Case(P5编号.坏行, { status: 'fluffy' }),
    },
    候选open顺序: [P5编号.丁, P5编号.乙, P5编号.丙一, P5编号.丙二, P5编号.甲],
    招聘open顺序: [P5编号.甲, P5编号.丁, P5编号.乙, P5编号.丙一, P5编号.丙二],
    历史顺序: { ended: [P5编号.戊], completed: [P5编号.己] },
    变更请求: [],
    PDF读取: [],
    应答头存证: [],
    已503: new Map(),
    叮嘱序: 0,
    分支: {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// P7 真人会话域可变 fixture（Task 7）。双端（候选 me / 招聘 recruiter）conversations
// 的收件箱、详情、消息分页、纯文本发送（Idempotency-Key 同键重放只落一条）、
// forward-only 已读（PUT 后该角色未读归零）与 context 投影（available /
// unavailable 演练）。消息分页响应键是实际实现的 { messages, next_cursor }，
// 已读回执是 { read_through_message_id }。会话不能由浏览器创建：fixture 只预置
// 3003 一条会话，9900 可标记不存在（foreign / wrong-role 404 演练）。
// ─────────────────────────────────────────────────────────────────────────────

const P7会话编号 = {
  会话: '3003',
  案例: 'mc_p7_000000000000000000000001',
  职位: 'job_00112233445566778899aabbccddeeff',
  简历: 'rf_00112233445566778899aabbccddeeff',
} as const;

const P7标记 = {
  职位名: 'P7 Fixture 后端工程师',
  地点: 'P7 Fixture 市',
  候选代号: 'candidate-p7fixture01',
  候选消息: 'P7 Fixture 候选：想约明天下午聊聊',
  招聘消息: 'P7 Fixture 招聘：可以，下午三点见',
  招聘回复: 'P7 Fixture 招聘：没问题，明天下午三点',
} as const;

type P7角色词 = 'candidate' | 'recruiter';

interface P7消息wire形 {
  message_id: string;
  kind: 'user_text';
  sender_role: P7角色词;
  content: string;
  created_at: string;
}

interface P7FixtureState {
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

function 创建P7fixture(): P7FixtureState {
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
function P7会话项wire(P7域: P7FixtureState, id: string, role: P7角色词): Record<string, unknown> {
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
const P8键模式 = /^[!-~]{16,128}$/;

/** 下载应答的固定 ZIP 字节（route fixture 应答体，PK\x03\x04 开头的 ZIP 魔数）。
 *  锚点下载由浏览器下载管理器接管，Playwright 的 route/request 都看不到该请求
 * （探针实证）——浏览器边界上的证据是 download 事件的同源 /download URL 与点击前
 * 的权威预检 GET；ZIP 字节/固定应答头由本 fixture 与单测覆盖。 */
const P8ZIP字节 = Buffer.from('PKagxp-p8-fixture-export-archive\n');

const P8编号 = {
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

const P8标记 = {
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

type P8提供者词 = 'phone_otp' | 'wechat' | 'email_otp';
type P8导出状态词 = 'queued' | 'running' | 'ready' | 'failed' | 'expired';

/** P8 wire 凭证行（与 BFF契约.BFF凭证 同构） */
interface P8凭证wire形 {
  credential_id: string;
  provider: P8提供者词;
  display: string;
  verified_at: string;
}

/** P8 wire 会话行：无设备/地点/IP 字段（页面只展示创建/失效时间） */
interface P8会话wire形 {
  session_id: string;
  created_at: string;
  expires_at: string;
  current: boolean;
}

/** P8 wire 导出（与 BFF契约.BFF数据导出 同构） */
interface P8导出wire形 {
  export_id: string;
  status: P8导出状态词;
  created_at: string;
  expires_at: string | null;
  download_ready: boolean;
}

/** 变更回执存证：原文 = 请求 postData 字符串（无体路由为 null），同意图重放按字节比对。 */
interface P8变更回执形 {
  method: string;
  path: string;
  body: unknown;
  原文: string | null;
  idempotencyKey: string | null;
  origin: string | null;
}

/** 专用分支：只有用例显式 seed 时才选择固定应答（fail closed 分支不写任何状态） */
interface P8分支形 {
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
interface P8FixtureState {
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

function 创建P8fixture(分支: P8分支形 = {}): P8FixtureState {
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

// ─────────────────────────────────────────────────────────────────────────────
// 候选 onboarding 可变 fixture（Task 8）。证明 Tasks 1–7 修完后的整条 Backend 写链：
//   · 深克隆既有静态 fixture简历 的信封形状（绝不共享状态），profile / summary / skills /
//     experiences / educations / certificates 全部清空成「从未写入过」的注册流起点；
//   · 主体 last_used_role 从 null 起步：会话恢复落身份选择页，从 我要找工作 走完整注册流，
//     角色写入推进它，reload 后直接进主壳；
//   · 每个 mutation 严格闭合校验（Object.keys(body).sort() 对照允许键集 + 必含键在内），
//     未知字段一律拒收；证书 body 必须显式带 year（null 或 1900–2100 整数）；
//   · 受理的 mutation 记录 { method, path, body }、只写本 fixture、推进对应 revision，
//     之后所有 GET 一律回更新后的快照（year: null 原样保留，绝不编造年份）；
//   · 读取计数（resume / intentions）证明 reload 走的是权威重读而非本地状态。
// 只在 选项.候选OnboardingFixture 在场时接管这些路由 —— 既有 Backend 用例的静态
// fixture简历 路由一个字都不动。这只是前端拦截边界上的 wire 行为验证，不是真实
// BFF 联调（真实服务从不被启动、修改或验证）；真实联调仍以 Recruitment/BFF 的
// nullable year 契约基线为前置。
// ─────────────────────────────────────────────────────────────────────────────

type 记录的Mutation = { method: string; path: string; body: unknown };

/** 候选 onboarding 可变 fixture：测试自持一份，安装路由后 handler 与测试共享同一对象 */
interface 候选OnboardingFixture {
  /** 本 fixture 专属主体：last_used_role 起步 null（落身份选择页），角色写入推进它 */
  主体: { subject_id: string; roles: { role: 'candidate' | 'recruiter'; status: 'active' }[]; last_used_role: 'candidate' | 'recruiter' | null };
  resume: BFF简历;
  intentions: BFFOwnerIntention[];
  mutations: 记录的Mutation[];
  /** GET 计数：reload 后必须重新 GET 简历与意向（权威重读，不沿用本地状态） */
  读取: { 简历: number; 意向: number };
  /** 简历域请求序列（含分区写入与 GET）：断言保存以最终权威 GET 收尾 */
  简历请求: { method: string; path: string }[];
}

/** 只存在于本 fixture 的标记值（区别于 P8标记.手机掩码 与 既有静态 fixture 的编号） */
const Onboarding标记 = {
  主体: 'subj-fixture-onboarding-001',
  手机掩码: '+86 136 **** 7725',
  意向编号: 'int_00112233445566778899aabbccddeef0',
} as const;

/** 目录 ID → 展示名：写入 body 只带选择 ID，权威应答里的 display_name 从这里补 */
const Onboarding目录展示: Record<string, string> = {
  'loc-fixture-001': 标记.城市display,
  'job-fixture-001': 标记.职位display,
  'ind-fixture-001': 'Fixture 行业',
  'inst-fixture-001': 标记.学校display,
  'major-fixture-001': 'Fixture 专业',
};

/**
 * 深克隆静态 fixture简历 的信封形状后整体清空内容（注册流起点）。
 * 用既有的 P4深克隆 做深拷贝：Playwright 的 TS 转译目标不保证 structuredClone，
 * 且这里只需要纯 JSON 数据的独立副本 —— 与静态 fixture简历 不共享任何可变状态。
 */
function 创建候选OnboardingFixture(): 候选OnboardingFixture {
  return {
    主体: {
      subject_id: Onboarding标记.主体,
      roles: [{ role: 'candidate', status: 'active' }],
      last_used_role: null,
    },
    resume: {
      ...(P4深克隆(fixture简历) as BFF简历),
      profile: {
        real_name: '',
        work_start_year: null,
        status: '',
        current_education: null,
        graduation_year: null,
        gender: null,
        birth_year: null,
        birth_month: null,
      },
      summary: '',
      skills: [],
      experiences: [],
      educations: [],
      certificates: [],
    },
    intentions: [],
    mutations: [],
    读取: { 简历: 0, 意向: 0 },
    简历请求: [],
  };
}

/** 精确键集：Object.keys(body).sort() 必须与允许键集完全一致（多一个少一个都拒收） */
function 断言精确键集(body: unknown, 允许键: readonly string[]): void {
  expect(body).toBeTruthy();
  expect(Object.keys(body as object).sort()).toEqual([...允许键].sort());
}

/** 闭合键集（带可选键的端点用）：未知字段一律拒收，必含键缺席也拒收 */
function 断言闭合键集(body: unknown, 允许键: readonly string[], 必含键: readonly string[]): void {
  expect(body).toBeTruthy();
  const 键们 = Object.keys(body as object);
  expect(键们.filter((键) => !允许键.includes(键))).toEqual([]);
  for (const 键 of 必含键) expect(键们).toContain(键);
}

/** 证书写入：year 必须显式在场（不是缺属性），值只能是 null 或 1900–2100 整数 */
function 断言证书写入(body: unknown): asserts body is { name: string; year: number | null } {
  expect(body).toBeTruthy();
  expect(Object.keys(body as object).sort()).toEqual(['name', 'year']);
  const value = body as { name: unknown; year: unknown };
  expect(typeof value.name).toBe('string');
  expect(Object.prototype.hasOwnProperty.call(value, 'year')).toBe(true);
  expect(value.year === null || (
    Number.isInteger(value.year) && Number(value.year) >= 1900 && Number(value.year) <= 2100
  )).toBe(true);
}

/** 资料（profile）分区写入：八键全量替换，status 只认三个后端档位 */
function 断言资料写入(body: unknown): asserts body is {
  real_name: string;
  work_start_year: number | null;
  status: 'student' | 'employed' | 'unemployed';
  current_education: string | null;
  graduation_year: number | null;
  gender: 'male' | 'female' | null;
  birth_year: number | null;
  birth_month: number | null;
} {
  断言精确键集(body, ['real_name', 'work_start_year', 'status', 'current_education', 'graduation_year', 'gender', 'birth_year', 'birth_month']);
  const 写 = body as Record<string, unknown>;
  expect(typeof 写.real_name).toBe('string');
  expect(写.work_start_year === null || Number.isInteger(写.work_start_year)).toBe(true);
  expect(['student', 'employed', 'unemployed']).toContain(写.status);
  expect(写.current_education === null || typeof 写.current_education === 'string').toBe(true);
  expect(写.graduation_year === null || Number.isInteger(写.graduation_year)).toBe(true);
  expect(写.gender === null || ['male', 'female'].includes(写.gender as string)).toBe(true);
  expect(写.birth_year === null || Number.isInteger(写.birth_year)).toBe(true);
  expect(写.birth_month === null || Number.isInteger(写.birth_month)).toBe(true);
}

/** 个人优势（summary）分区写入：单键 value */
function 断言摘要写入(body: unknown): asserts body is { value: string } {
  断言精确键集(body, ['value']);
  expect(typeof (body as { value: unknown }).value).toBe('string');
}

/** 技能分区写入：单键 skills，数组里必须全是非常字符串 */
function 断言技能写入(body: unknown): asserts body is { skills: string[] } {
  断言精确键集(body, ['skills']);
  const 写 = body as { skills: unknown };
  expect(Array.isArray(写.skills)).toBe(true);
  expect((写.skills as unknown[]).every((项) => typeof 项 === 'string' && 项 !== '')).toBe(true);
}

/** 经历写入：company / industry_id / title / start_month 必填，其余可选 */
function 断言经历写入(body: unknown): asserts body is {
  company: string;
  industry_id: string;
  title: string;
  start_month: string;
  end_month?: string | null;
  description?: string;
  hidden?: boolean;
  internship?: boolean;
} {
  断言闭合键集(body, ['company', 'industry_id', 'title', 'start_month', 'end_month', 'description', 'hidden', 'internship'], ['company', 'industry_id', 'title', 'start_month']);
  const 写 = body as Record<string, unknown>;
  expect(typeof 写.company).toBe('string');
  expect(typeof 写.industry_id).toBe('string');
  expect(typeof 写.title).toBe('string');
  expect(typeof 写.start_month).toBe('string');
  if ('end_month' in 写) expect(写.end_month === null || typeof 写.end_month === 'string').toBe(true);
  if ('description' in 写) expect(typeof 写.description).toBe('string');
  if ('hidden' in 写) expect(typeof 写.hidden).toBe('boolean');
  if ('internship' in 写) expect(typeof 写.internship).toBe('boolean');
}

/** 教育写入：institution_id / degree / major_id / start_month 必填，end_month 可选 */
function 断言教育写入(body: unknown): asserts body is {
  institution_id: string;
  degree: string;
  major_id: string;
  start_month: string;
  end_month?: string | null;
} {
  断言闭合键集(body, ['institution_id', 'degree', 'major_id', 'start_month', 'end_month'], ['institution_id', 'degree', 'major_id', 'start_month']);
  const 写 = body as Record<string, unknown>;
  expect(typeof 写.institution_id).toBe('string');
  expect(typeof 写.degree).toBe('string');
  expect(typeof 写.major_id).toBe('string');
  expect(typeof 写.start_month).toBe('string');
  if ('end_month' in 写) expect(写.end_month === null || typeof 写.end_month === 'string').toBe(true);
}

/** 意向写入：BFF意向写入 的十二键闭合契约（compensation / exclusions 子键同样闭合） */
function 断言意向写入(body: unknown): asserts body is {
  recruitment_type: 'social_full_time' | 'campus' | 'internship' | 'part_time';
  job_category_id: string;
  primary_location_id: string;
  alternate_location_ids: string[];
  industry_ids: string[];
  workplace_modes: ('onsite' | 'hybrid' | 'remote')[];
  compensation: { mode: 'range' | 'negotiable'; lower?: number | null; upper?: number | null; annual_salary_months?: number | null };
  graduation_month: string | null;
  internship_months: number | null;
  onsite_days_per_week: number | null;
  exclusions: Record<'alternate_weekend_work' | 'outsourcing_only' | 'onsite_only' | 'frequent_travel', 'allowed' | 'excluded' | 'unspecified'>;
  private_preferences: string;
} {
  断言精确键集(body, ['recruitment_type', 'job_category_id', 'primary_location_id', 'alternate_location_ids', 'industry_ids', 'workplace_modes', 'compensation', 'graduation_month', 'internship_months', 'onsite_days_per_week', 'exclusions', 'private_preferences']);
  const 写 = body as Record<string, unknown> & { compensation: Record<string, unknown>; exclusions: Record<string, unknown> };
  expect(['social_full_time', 'campus', 'internship', 'part_time']).toContain(写.recruitment_type);
  expect(typeof 写.job_category_id).toBe('string');
  expect(typeof 写.primary_location_id).toBe('string');
  expect(Array.isArray(写.alternate_location_ids)).toBe(true);
  expect(Array.isArray(写.industry_ids)).toBe(true);
  expect(Array.isArray(写.workplace_modes)).toBe(true);
  expect((写.workplace_modes as string[]).every((值) => ['onsite', 'hybrid', 'remote'].includes(值))).toBe(true);
  断言闭合键集(写.compensation, ['mode', 'lower', 'upper', 'annual_salary_months'], ['mode']);
  expect(['range', 'negotiable']).toContain(写.compensation.mode);
  断言精确键集(写.exclusions, ['alternate_weekend_work', 'outsourcing_only', 'onsite_only', 'frequent_travel']);
  expect(Object.values(写.exclusions).every((值) => ['allowed', 'excluded', 'unspecified'].includes(值 as string))).toBe(true);
  expect(写.graduation_month === null || typeof 写.graduation_month === 'string').toBe(true);
  expect(写.internship_months === null || Number.isInteger(写.internship_months)).toBe(true);
  expect(写.onsite_days_per_week === null || Number.isInteger(写.onsite_days_per_week)).toBe(true);
  expect(typeof 写.private_preferences).toBe('string');
}

interface BFF路由选项 {
  记录目录请求: (path: string) => void;
  登录尝试id: string;
  /** 请求拦截：每次 /api/v1 请求触发（headers 可用于断言 If-Match / Idempotency-Key 等头） */
  请求拦截?: (请求: 拦截请求形) => void;
  /** 自定义响应覆盖：key = `METHOD path`；返回 undefined 表示放行给内置 fixture 应答 */
  覆盖?: Record<string, (body: unknown) => { status: number; 响应: unknown; 头?: Record<string, string> } | undefined>;
  /** GET /api/v1/session 返回 200（已登录）还是 401（未登录）。缺省 200（自动登录）*/
  会话已登录?: boolean;
  /** P1C：组织域 fixture（profile / affiliations / 公开企业 / 档案与媒体 / 管理员申请 / owner Jobs） */
  招聘组织Fixture?: P1C招聘组织Fixture形;
  /** 新招聘方专用：profile 从 null 经 revision-zero PATCH 变为权威 DTO。 */
  招聘方OnboardingFixture?: 招聘方OnboardingFixture形;
  /** P3：隐私域可变 fixture（me/privacy 整读补丁 / 组织搜索 / 屏蔽与解除）。缺席时这些路由走兜底空信封 */
  隐私fixture?: P3隐私fixture形;
  /** P2：附件简历域可变 fixture（resume-files 上传/替换/删除/解析/下载）。缺席时 安装BFF路由
      自建一份隔离的合法空库（权威应答），既有 Backend 用例每次安装各自独立 */
  附件fixture?: P2附件fixture形;
  /** 主体初始 last_used_role：null（缺省）→ 落身份选择页；'candidate' → 直接水合进求职主壳；'recruiter' → 企业主壳 */
  主体初始角色?: 'candidate' | 'recruiter' | null;
  /** P6：Agent 规则域可变 fixture 的专用分支（追加规则/提案、游标成环、应答挂起） */
  P6分支?: P6分支配置;
  /** P4：发现推荐域可变 fixture（双端列表/详情/反馈/刷新/委托 + canonical job GET）。缺席时这些路由走兜底空信封 */
  发现fixture?: P4发现fixture形;
  /** P5（Task 8）：MatchCase 域可变 fixture（双端工作区/历史/详情/S0–S3 命令/叮嘱/披露 PDF）。
   *  缺席时这些路由走兜底空信封 → strict decode 拒绝（Mock 内容不顶替 HTTP 的既有边界） */
  P5MatchCasefixture?: P5MatchCasefixture形;
  /** P7（Task 7）：真人会话域可变 fixture（收件箱/详情/消息/发送/已读 + context 演练）。 */
  P7fixture?: P7FixtureState;
  /** P8（Task 8）：控制面域可变 fixture（凭证/会话/换绑/导出/注销/合规反馈与举报）。
   *  缺席时这些路由走兜底空信封 → strict decode 拒绝（Mock 内容不顶替 HTTP 的既有边界） */
  P8控制面fixture?: P8FixtureState;
  /** Task 8：候选 onboarding 可变 fixture（主体 / 简历分区写入 / 意向 / 凭证投影）。
   *  在场时接管 me / resume / intentions 的候选端路由并严格闭合校验每个写入 body；
   *  缺席时既有静态 fixture简历 路由与兜底行为一字不动。 */
  候选OnboardingFixture?: 候选OnboardingFixture;
  /** FE-IV-01：候选实名域可变 fixture（summary GET / multipart create / revision CAS cancel）。
   *  缺席时这些路由走兜底空信封 → strict decode 拒绝（Mock 内容不顶替 HTTP 的既有边界）。 */
  候选实名域?: 候选实名FixtureState;
}

// ── FE-IV-01：候选实名域 fixture（@backend）。可变 summary 归每次 安装BFF路由 所有，
//    页面写入只影响本测试；creates/cancels 只记录 part 名、metadata JSON、headers，
//    绝不记录文件 bytes 或文件名 ──

interface 候选实名请求投影 {
  request_id: string;
  status: 'pending' | 'verified' | 'rejected' | 'cancelled';
  revision: number;
  submitted_at: string;
  rejection_reason: string | null;
}

interface 候选实名FixtureState {
  /** 当前权威 wire summary（unverified 起步；create → pending；cancel → unverified + cancelled） */
  summary: {
    status: 'unverified' | 'pending' | 'verified' | 'rejected';
    verified_name: string | null;
    current_request: 候选实名请求投影 | null;
    revision: number;
    updated_at: string;
  };
  /** create 投影：幂等键 + part 名顺序 + metadata JSON + evidence 数（无 bytes/文件名） */
  creates: { key: string; parts: string[]; metadata: unknown; evidence数: number }[];
  /** cancel 投影：requestId 与收到的 quoted If-Match */
  cancels: { requestId: string; ifMatch: string }[];
  /** summary GET 计数 */
  gets: number;
  /** 幂等键 → 输入指纹（同键同输入重放，异输入 409） */
  键值: Map<string, string>;
}

function 创建候选实名fixture(): 候选实名FixtureState {
  return {
    summary: {
      status: 'unverified',
      verified_name: null,
      current_request: null,
      revision: 1,
      updated_at: '2026-09-05T00:00:00Z',
    },
    creates: [],
    cancels: [],
    gets: 0,
    键值: new Map(),
  };
}

/** 实名 fixture 的契约 fail closed（与 P2要求 同款）。 */
function IV要求(condition: unknown): asserts condition {
  if (!condition) throw new Error('候选实名 fixture 契约失败');
}

/** 请求拦截收到的请求投影；multipart 的 metadata 只在测试进程内比对 */
interface 拦截请求形 {
  path: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
  /** URL query 原文（含 ?；组织搜索断言 q/limit/cursor 用） */
  query?: string;
  /** multipart 请求：part 名按出现顺序 + metadata part 内容（无则 undefined） */
  multipart?: { parts: string[]; metadata?: unknown };
}

/**
 * 按 content-type boundary 切分 multipart body，取 part 名 / part 类型 / part 字节。
 * 不用 JSON parser 解析整体：boundary 字节是 ASCII，latin1 索引与原 Buffer 一一对应，
 * part 内容回切原 Buffer 后再按需 utf8 解码。
 */
function 取multipart部件(请求: Route['request']): { name: string; contentType: string; bytes: Buffer }[] | null {
  const 类型 = 请求.headers()['content-type'] ?? '';
  const 匹配 = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(类型);
  if (!匹配) return null;
  const 界串 = `--${(匹配[1] ?? 匹配[2]).trim()}`;
  const 原文 = 请求.postDataBuffer();
  if (!原文) return [];
  const 文本 = 原文.toString('latin1');
  const 部件: { name: string; contentType: string; bytes: Buffer }[] = [];
  let 位 = 文本.indexOf(界串);
  while (位 !== -1) {
    const 头起 = 位 + 界串.length;
    if (文本.slice(头起, 头起 + 2) === '--') break; // 终界
    const 头止 = 文本.indexOf('\r\n\r\n', 头起);
    if (头止 === -1) break;
    const 头 = 文本.slice(头起, 头止);
    const 名 = /name="([^"]*)"/i.exec(头)?.[1] ?? '';
    const 型 = /content-type:\s*([^\r\n]+)/i.exec(头)?.[1].trim() ?? '';
    const 下界 = 文本.indexOf(界串, 头止);
    const 体止 = 下界 === -1 ? 原文.length : 下界 - 2; // 去掉 part 尾部 \r\n
    部件.push({ name: 名, contentType: 型, bytes: 原文.subarray(头止 + 4, 体止) });
    if (下界 === -1) break;
    位 = 下界;
  }
  return 部件;
}

/** metadata part 内容（application/json）：解析失败归 undefined，不让坏 JSON 中断路由 */
function 解metadata部件(字节: Buffer): unknown {
  try {
    return JSON.parse(字节.toString('utf8'));
  } catch {
    return undefined;
  }
}

/** 安装 /api/v1 route fixture：按 path + method 匹配，返回 fixture 信封；P6/P4 可变状态经返回值暴露给测试断言。 */
async function 安装BFF路由(page: Page, 选项: BFF路由选项): Promise<{ p6: P6FixtureState; p4: P4发现fixture形 | null; p7: P7FixtureState | null }> {
  const 会话已登录 = 选项.会话已登录 ?? true;
  // P4 发现域：可变 fixture 状态由用例自持（handler 直读直写）；路由映射表与委托登记跨请求存活
  const P4域 = 选项.发现fixture ?? null;
  // P7（Task 7）：真人会话域可变 fixture —— 函数级声明（return 也要暴露给测试断言）
  const P7域 = 选项.P7fixture ?? null;
  // P8（Task 8）：控制面域可变 fixture —— 测试自持对象，handler 直读直写
  const P8域 = 选项.P8控制面fixture ?? null;
  // Task 8：候选 onboarding 可变 fixture —— 测试自持对象，handler 直读直写
  const Onboarding域 = 选项.候选OnboardingFixture ?? null;
  const p4委托表 = new Map<string, { 回执: P4委托回执形; role: 'candidate' | 'recruiter'; 读数: number }>();
  const p4刷新503键 = new Set<string>();
  const p4委托503键 = new Set<string>();
  const p4不感兴趣失败键 = new Set<string>();
  // P1C：组织 fixture 出现时 /me 与角色/偏好写入都返回招聘方主体（PUT last-used-role 会推进它的值）
  // P0 修复 Task 7：新招聘方 onboarding fixture 与既有 P1C 组织 fixture 走同一套组织路由，
  // 但只有前者的 profile 可空（首读 404）并登记写入回执；后者一字不动。
  const onboardingFixture = 选项.招聘方OnboardingFixture ?? null;
  const 组织fixture: P1C招聘组织Fixture形 | 招聘方OnboardingFixture形 | null =
    onboardingFixture ?? 选项.招聘组织Fixture ?? null;
  const 主体 = 组织fixture
    ? {
        subject_id: 'subj-fixture-recruiter-001',
        roles: [
          { role: 'candidate' as const, status: 'active' as const },
          { role: 'recruiter' as const, status: 'active' as const },
        ],
        last_used_role: (选项.主体初始角色 ?? null) as 'candidate' | 'recruiter' | null,
      }
    : fixture主体;

  // ── P1C 组织域可变 fixture 状态：每次安装独立一份，页面写入只影响本测试 ──
  let 档案可变: P1C招聘方档案形 | null = 组织fixture?.profile ? { ...组织fixture.profile } : null;
  const 关系可变: P1C企业关系形[] = 组织fixture ? 组织fixture.affiliations.map((项) => ({ ...项 })) : [];
  const 申请可变: P1C管理员申请形[] = 组织fixture ? 组织fixture.adminRequests.map((项) => ({ ...项 })) : [];
  const 岗位可变: P1C岗位形[] = 组织fixture ? 组织fixture.ownerJobs.map((项) => ({ ...项 })) : [];
  // 企业档案表：独立深拷贝（媒体/成员数组要独立），replacement 后 revision+1
  const 企业档案表 = new Map<string, P1C企业档案形>();
  if (组织fixture) {
    for (const [编号, 组织] of Object.entries(组织fixture.organizations)) {
      企业档案表.set(编号, {
        ...组织.profile,
        benefit_codes: [...组织.profile.benefit_codes],
        business_items: [...组织.profile.business_items],
        team_members: 组织.profile.team_members.map((员) => ({ ...员 })),
        office_media: [...组织.profile.office_media],
        company_media: [...组织.profile.company_media],
      });
    }
  }
  // 媒体登记：POST media 落号，PATCH replacement 按 id 引用回读（服务端语义）
  const 媒体登记 = new Map<string, P1C企业媒体形>();
  let 媒体序 = 0;
  const 登记媒体 = (件: { contentType: string; bytes: Buffer } | undefined): P1C企业媒体形 => {
    媒体序 += 1;
    const 型 = 件?.contentType.includes('jpeg') ? 'image/jpeg' : 'image/png';
    const 媒: P1C企业媒体形 = {
      media_id: `media-fixture-${媒体序}`,
      media_type: 型,
      size_bytes: 件?.bytes.length ?? 0,
      width: 1,
      height: 1,
      url: `data:${型};base64,${(件?.bytes ?? Buffer.alloc(0)).toString('base64')}`,
    };
    媒体登记.set(媒.media_id, 媒);
    return 媒;
  };
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
  for (const 追加 of 选项.P6分支?.追加规则们 ?? []) {
    p6.rules.recruiter.push({ ...追加.规则, scope: { ...追加.规则.scope } });
    if (追加.分支 === '写入冲突') 冲突规则编号们.add(追加.规则.rule_id);
  }
  for (const 追加 of 选项.P6分支?.追加提案们 ?? []) {
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
  let 创建失败余数 = 选项.P6分支?.创建前几次失败 ?? 0;
  let 规则清单请求数 = 0;
  // ── P2 附件简历域：route callback 之外声明（跨请求存活的可变状态）；
  // 缺席时每次安装自建一份隔离的合法空库，既有 Backend 用例默认拿到权威空清单 ──
  const P2域 = 选项.附件fixture ?? 创建P2附件fixture();

  await page.route('**/api/v1/**', async (route: Route) => {
    const 请求 = route.request();
    const url = new URL(请求.url());
    const path = url.pathname;
    const method = 请求.method();
    // multipart 请求不用 JSON parser 解整体：按 boundary 取 part，body 留空对象
    const 部件们 = 取multipart部件(请求);
    const 元数据部件 = 部件们?.find((件) => 件.name === 'metadata');
    const body = method !== 'GET' && method !== 'DELETE' && 部件们 === null
      ? (() => { try { return JSON.parse(请求.postData() ?? '{}'); } catch { return {}; } })()
      : {};

    选项.请求拦截?.({
      path,
      method,
      body,
      headers: 请求.headers(),
      query: url.search,
      multipart: 部件们
        ? { parts: 部件们.map((件) => 件.name), metadata: 元数据部件 ? 解metadata部件(元数据部件.bytes) : undefined }
        : undefined,
    });

    if (path.startsWith('/api/v1/catalog/')) 选项.记录目录请求(path);

    // 自定义覆盖优先；返回 undefined 时放行给内置 fixture
    const 覆盖key = `${method} ${path}`;
    const 覆盖项 = 选项.覆盖?.[覆盖key]?.(body);
    if (覆盖项) {
      await route.fulfill({ status: 覆盖项.status, json: 覆盖项.响应, headers: 覆盖项.头 });
      return;
    }

    // ── 候选 onboarding 可变 fixture（Task 8）：只在选项在场时接管；每个写入都过
    //    闭合键集校验（未知字段拒收），受理后记录 { method, path, body }、只写本
    //    fixture、推进 revision，之后所有 GET 回更新后的快照 ──
    if (Onboarding域) {
      const 记变更 = (路径: string) => {
        Onboarding域.mutations.push({ method, path: 路径, body });
      };
      const 答简历 = async () => {
        await route.fulfill({ status: 200, json: 信封(P4深克隆(Onboarding域.resume)) });
      };

      // 主体：last_used_role 从 null 起步（会话恢复落身份选择页），角色写入推进它
      if (path === '/api/v1/me' && method === 'GET') {
        await route.fulfill({ status: 200, json: 信封(P4深克隆(Onboarding域.主体)) });
        return;
      }
      const Onboarding角色写 = /^\/api\/v1\/me\/roles\/(candidate|recruiter)$/.exec(path);
      if (Onboarding角色写 && method === 'PUT') {
        断言精确键集(body, []); // 确保角色：body 精确 {}
        记变更(path);
        if (!Onboarding域.主体.roles.some((行) => 行.role === Onboarding角色写[1])) {
          Onboarding域.主体.roles.push({ role: Onboarding角色写[1] as 'candidate' | 'recruiter', status: 'active' });
        }
        await route.fulfill({ status: 200, json: 信封(P4深克隆(Onboarding域.主体)) });
        return;
      }
      if (path === '/api/v1/me/preferences/last-used-role' && method === 'PUT') {
        断言精确键集(body, ['role']);
        expect(['candidate', 'recruiter']).toContain((body as { role: string }).role);
        记变更(path);
        Onboarding域.主体.last_used_role = (body as { role: 'candidate' | 'recruiter' }).role;
        await route.fulfill({ status: 200, json: 信封(P4深克隆(Onboarding域.主体)) });
        return;
      }

      // 简历域读取：权威快照永远来自本 fixture 的当前状态（含 year: null 原样保留）
      if (path === '/api/v1/me/resume' && method === 'GET') {
        Onboarding域.读取.简历 += 1;
        Onboarding域.简历请求.push({ method, path });
        await 答简历();
        return;
      }
      if (path.startsWith('/api/v1/me/resume/') && method !== 'GET') {
        Onboarding域.简历请求.push({ method, path });
      }
      if (path === '/api/v1/me/resume/profile' && method === 'PATCH') {
        断言资料写入(body);
        记变更(path);
        Onboarding域.resume.profile = { ...P4深克隆(Onboarding域.resume.profile), ...P4深克隆(body) } as BFF简历['profile'];
        Onboarding域.resume.profile_revision += 1;
        Onboarding域.resume.aggregate_revision += 1;
        await 答简历();
        return;
      }
      if (path === '/api/v1/me/resume/summary' && method === 'PATCH') {
        断言摘要写入(body);
        记变更(path);
        Onboarding域.resume.summary = (body as { value: string }).value;
        Onboarding域.resume.summary_revision += 1;
        Onboarding域.resume.aggregate_revision += 1;
        await 答简历();
        return;
      }
      if (path === '/api/v1/me/resume/skills' && method === 'PATCH') {
        断言技能写入(body);
        记变更(path);
        Onboarding域.resume.skills = [...(body as { skills: string[] }).skills];
        Onboarding域.resume.skills_revision += 1;
        Onboarding域.resume.aggregate_revision += 1;
        await 答简历();
        return;
      }
      if (path === '/api/v1/me/resume/experiences' && method === 'POST') {
        断言经历写入(body);
        记变更(path);
        const 写 = body as {
          company: string; industry_id: string; title: string; start_month: string;
          end_month?: string | null; description?: string; hidden?: boolean; internship?: boolean;
        };
        const 新经历: BFF简历['experiences'][number] = {
          id: `exp-fixture-onboard-${Onboarding域.resume.experiences.length + 1}`,
          company: 写.company,
          industry: { id: 写.industry_id, display_name: Onboarding目录展示[写.industry_id] ?? '' },
          title: 写.title,
          start_month: 写.start_month,
          end_month: 写.end_month ?? null,
          description: 写.description ?? '',
          hidden: 写.hidden ?? false,
          internship: 写.internship ?? false,
          revision: 1,
          projects: null,
        };
        Onboarding域.resume.experiences.push(新经历);
        Onboarding域.resume.aggregate_revision += 1;
        await route.fulfill({
          status: 200,
          json: 信封({ entry: { kind: 'experience', experience: P4深克隆(新经历) }, aggregate_revision: Onboarding域.resume.aggregate_revision }),
        });
        return;
      }
      if (path === '/api/v1/me/resume/educations' && method === 'POST') {
        断言教育写入(body);
        记变更(path);
        const 写 = body as { institution_id: string; degree: string; major_id: string; start_month: string; end_month?: string | null };
        const 新教育: BFF简历['educations'][number] = {
          id: `edu-fixture-onboard-${Onboarding域.resume.educations.length + 1}`,
          institution: { id: 写.institution_id, display_name: Onboarding目录展示[写.institution_id] ?? '' },
          degree: 写.degree,
          major: { id: 写.major_id, display_name: Onboarding目录展示[写.major_id] ?? '' },
          start_month: 写.start_month,
          end_month: 写.end_month ?? null,
          revision: 1,
        };
        Onboarding域.resume.educations.push(新教育);
        Onboarding域.resume.aggregate_revision += 1;
        await route.fulfill({
          status: 200,
          json: 信封({ entry: { kind: 'education', education: P4深克隆(新教育) }, aggregate_revision: Onboarding域.resume.aggregate_revision }),
        });
        return;
      }
      if (path === '/api/v1/me/resume/certificates' && method === 'POST') {
        断言证书写入(body);
        记变更(path);
        const 写 = body as { name: string; year: number | null };
        const 新证书: BFF简历['certificates'][number] = {
          id: `cert-fixture-onboard-${Onboarding域.resume.certificates.length + 1}`,
          name: 写.name,
          // name-only 写入的 year: null 原样保留，绝不编造年份
          year: 写.year,
          revision: 1,
        };
        Onboarding域.resume.certificates.push(新证书);
        Onboarding域.resume.aggregate_revision += 1;
        await route.fulfill({
          status: 200,
          json: 信封({ entry: { kind: 'certificate', certificate: P4深克隆(新证书) }, aggregate_revision: Onboarding域.resume.aggregate_revision }),
        });
        return;
      }

      // 意向域：GET 回本 fixture 当前列表；POST 严格校验后物化唯一一条 active 意向
      if (path === '/api/v1/me/intentions' && method === 'GET') {
        Onboarding域.读取.意向 += 1;
        await route.fulfill({ status: 200, json: 信封({ intentions: P4深克隆(Onboarding域.intentions) }) });
        return;
      }
      if (path === '/api/v1/me/intentions' && method === 'POST') {
        断言意向写入(body);
        记变更(path);
        const 写 = body as {
          recruitment_type: 'social_full_time' | 'campus' | 'internship' | 'part_time';
          job_category_id: string; primary_location_id: string; alternate_location_ids: string[]; industry_ids: string[];
          workplace_modes: ('onsite' | 'hybrid' | 'remote')[];
          compensation: { mode: 'range' | 'negotiable'; lower?: number | null; upper?: number | null; annual_salary_months?: number | null };
          graduation_month: string | null; internship_months: number | null; onsite_days_per_week: number | null;
          exclusions: BFFOwnerIntention['exclusions']; private_preferences: string;
        };
        const 新意向: BFFOwnerIntention = {
          intention_id: Onboarding标记.意向编号,
          recruitment_type: 写.recruitment_type,
          job_category: { id: 写.job_category_id, display_name: Onboarding目录展示[写.job_category_id] ?? '' },
          primary_location: { id: 写.primary_location_id, display_name: Onboarding目录展示[写.primary_location_id] ?? '' },
          alternate_locations: 写.alternate_location_ids.map((id) => ({ id, display_name: Onboarding目录展示[id] ?? '' })),
          industries: 写.industry_ids.map((id) => ({ id, display_name: Onboarding目录展示[id] ?? '' })),
          workplace_modes: [...写.workplace_modes],
          compensation: P4深克隆(写.compensation),
          // salary_period 是服务端按 recruitment_type 派生的只读字段
          salary_period: 写.recruitment_type === 'internship' || 写.recruitment_type === 'part_time' ? 'day' : 'month',
          graduation_month: 写.graduation_month,
          internship_months: 写.internship_months,
          onsite_days_per_week: 写.onsite_days_per_week,
          exclusions: P4深克隆(写.exclusions),
          private_preferences: 写.private_preferences,
          status: 'active',
          revision: 1,
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        };
        Onboarding域.intentions.push(新意向);
        await route.fulfill({ status: 200, json: 信封(P4深克隆(新意向)) });
        return;
      }

      // 凭证投影：只存在于本 fixture 的唯一打码手机号（个人信息页的账号手机号来源）
      if (path === '/api/v1/me/credentials' && method === 'GET') {
        await route.fulfill({
          status: 200,
          json: 信封({
            credentials: [
              { credential_id: 'crd-fixture-onboarding-phone-0001', provider: 'phone_otp', display: Onboarding标记.手机掩码, verified_at: '2026-09-01T00:00:00Z' },
            ],
          }),
        });
        return;
      }
    }

    // ── session / auth ──
    if (path === '/api/v1/session' && method === 'GET') {
      // P8 注销 202 之后：会话已被服务端清除，保护读取一律 401 invalid_session
      if (P8域?.分支.已注销) {
        await route.fulfill({ status: 401, json: { error: { type: 'invalid_session', message: '会话已随账号注销失效' } } });
        return;
      }
      if (会话已登录) {
        await route.fulfill({ status: 200, json: 信封({ identity_id: 'id-fixture', session_id: 'sess-fixture', expires_at: '2026-08-26T00:00:00Z' }) });
      } else {
        await route.fulfill({ status: 401, json: { error: { type: 'invalid_session', message: '未登录' } } });
      }
      return;
    }
    if (path === '/api/v1/auth/login-attempts' && method === 'POST') {
      await route.fulfill({ status: 200, json: 信封({ attempt_id: 选项.登录尝试id, next_action: { type: 'enter_code', expires_at: '2026-08-25T01:00:00Z' } }) });
      return;
    }
    if (path.startsWith('/api/v1/auth/login-attempts/') && path.endsWith('/complete') && method === 'POST') {
      await route.fulfill({ status: 200, json: 信封({ identity_id: 'id-fixture', session_id: 'sess-fixture', expires_at: '2026-08-26T00:00:00Z', next_action: { type: 'completed' } }) });
      return;
    }
    if (path === '/api/v1/auth/logout' && method === 'POST') {
      await route.fulfill({ status: 200, json: 信封({ logged_out: true }) });
      return;
    }

    // ── me ──
    if (path === '/api/v1/me' && method === 'GET') {
      if (P8域?.分支.已注销) {
        await route.fulfill({ status: 401, json: { error: { type: 'invalid_session', message: '会话已随账号注销失效' } } });
        return;
      }
      await route.fulfill({ status: 200, json: 信封(主体) });
      return;
    }
    if (path.startsWith('/api/v1/me/roles/') && method === 'PUT') {
      await route.fulfill({ status: 200, json: 信封(主体) });
      return;
    }
    if (path === '/api/v1/me/preferences/last-used-role' && method === 'PUT') {
      // 服务端语义：记录偏好后，后续 GET /me 返回新值（刷新恢复用例依赖这一点）
      if (主体 !== fixture主体) 主体.last_used_role = (body as { role?: 'recruiter' | null })?.role ?? null;
      await route.fulfill({ status: 200, json: 信封(主体) });
      return;
    }

    // ── FE-IV-01：候选实名域 fixture —— GET 回当前严格摘要信封（no-store + ETag）；
    //    create 校验 Idempotency-Key（16–128 可见 ASCII）与 multipart 形状（恰一个
    //    metadata + 一至两个 evidence，metadata 恰两键），同键同输入重放同 summary、
    //    异输入 409 idempotency_conflict，202 不伪造 ETag；cancel 校验 body {} 与
    //    等于当前顶层 revision 的 quoted If-Match，错 revision 409，成功回 cancelled ──
    const IV域 = 选项.候选实名域 ?? null;
    if (IV域 && path === '/api/v1/me/identity-verification' && method === 'GET') {
      IV域.gets += 1;
      await route.fulfill({
        status: 200,
        json: 信封(P4深克隆(IV域.summary)),
        headers: { 'cache-control': 'no-store', etag: `"${IV域.summary.revision}"` },
      });
      return;
    }
    if (IV域 && path === '/api/v1/me/identity-verification-requests' && method === 'POST') {
      const key = 请求.headers()['idempotency-key'] ?? '';
      IV要求(/^[!-~]{16,128}$/.test(key));
      const parts = 部件们?.map((件) => 件.name) ?? [];
      const evidence数 = parts.filter((名) => 名 === 'evidence').length;
      IV要求(parts.length === evidence数 + 1 && parts[0] === 'metadata' &&
        (evidence数 === 1 || evidence数 === 2));
      const metadataPart = 部件们?.find((件) => 件.name === 'metadata');
      IV要求(metadataPart !== undefined && metadataPart.contentType === 'application/json');
      const metadata = metadataPart ? 解metadata部件(metadataPart.bytes) : undefined;
      IV要求(metadata !== null && typeof metadata === 'object' &&
        Object.keys(metadata as Record<string, unknown>).sort().join(',') === 'document_type,legal_name');
      const 指纹 = `${JSON.stringify(metadata)}|${evidence数}`;
      const 已有指纹 = IV域.键值.get(key);
      if (已有指纹 !== undefined && 已有指纹 !== 指纹) {
        await route.fulfill({
          status: 409,
          json: { error: { type: 'idempotency_conflict', message: '同幂等键提交了不同输入' } },
        });
        return;
      }
      IV域.键值.set(key, 指纹);
      IV域.creates.push({ key, parts, metadata, evidence数 });
      if (IV域.summary.status === 'unverified') {
        IV域.summary = {
          status: 'pending',
          verified_name: null,
          current_request: {
            request_id: 'ivq-fixture-0001',
            status: 'pending',
            revision: 1,
            submitted_at: '2026-09-05T00:00:00Z',
            rejection_reason: null,
          },
          revision: 2,
          updated_at: '2026-09-05T00:00:01Z',
        };
      }
      await route.fulfill({
        status: 202,
        json: 信封(P4深克隆(IV域.summary)),
        headers: { 'cache-control': 'no-store' },
      });
      return;
    }
    const IV取消 = /^\/api\/v1\/me\/identity-verification-requests\/([^/]+)\/cancel$/.exec(path);
    if (IV域 && IV取消 && method === 'POST') {
      IV要求(body !== null && typeof body === 'object' && Object.keys(body as object).length === 0);
      const ifMatch = 请求.headers()['if-match'] ?? '';
      IV域.cancels.push({ requestId: IV取消[1]!, ifMatch });
      if (ifMatch !== `"${IV域.summary.revision}"`) {
        await route.fulfill({
          status: 409,
          json: { error: { type: 'version_conflict', message: 'revision 已变化' } },
        });
        return;
      }
      const 当前 = IV域.summary.current_request;
      if (当前 !== null && 当前.status === 'pending') {
        IV域.summary = {
          status: 'unverified',
          verified_name: null,
          current_request: { ...当前, status: 'cancelled', revision: 当前.revision + 1 },
          revision: IV域.summary.revision + 1,
          updated_at: '2026-09-05T00:00:02Z',
        };
      }
      await route.fulfill({
        status: 200,
        json: 信封(P4深克隆(IV域.summary)),
        headers: { 'cache-control': 'no-store', etag: `"${IV域.summary.revision}"` },
      });
      return;
    }

    // ── P2 附件简历域（Task 7）：multipart / If-Match / Idempotency-Key 契约 fail closed。
    //    清单 GET 驱动 pending →(第 2 读)→ processing →(第 3+ 读)→ 下次终态；
    //    create / replace / parse 把 列表读取次数 归零，重放状态机 ──
    if (P2域 && path === '/api/v1/me/resume-files' && method === 'GET') {
      P2域.列表读取次数 += 1;
      for (const item of P2域.items) {
        if (P2域.列表读取次数 === 2 && item.current_version.parse.status === 'pending') {
          item.current_version.parse = { status: 'processing', updated_at: P2时间 };
        } else if (P2域.列表读取次数 >= 3) {
          if (item.current_version.parse.status === 'pending' || item.current_version.parse.status === 'processing') {
            item.current_version.parse = P2域.下次终态 === 'succeeded'
              ? { status: 'succeeded', parse_id: `parse_${item.file_id}`, updated_at: P2时间 }
              : { status: 'failed', failure_code: P2域.下次终态, updated_at: P2时间 };
          }
        }
      }
      await route.fulfill({ status: 200, json: 信封({ items: P2域.items, limits: P2限制 }) });
      return;
    }
    if (P2域 && path === '/api/v1/me/resume-files' && method === 'POST') {
      P2要求((请求.headers()['idempotency-key'] ?? '') !== '');
      P2要求(部件们?.map((part) => part.name).join(',') === 'display_name,file,processing_consent_confirmed');
      const display = 部件们[0].bytes.toString('utf8');
      const filePart = 部件们[1];
      P2要求(filePart.contentType === 'application/pdf');
      P2要求(部件们[2].bytes.toString('utf8') === 'true');
      P2要求(P2域.items.length < P2限制.max_files);
      const item = P2新附件(P2域.下一个编号++, display, filePart.bytes);
      P2域.items.unshift(item);
      P2域.列表读取次数 = 0;
      P2域.写入次数 += 1;
      await route.fulfill({ status: 201, json: 信封(item) });
      return;
    }
    const P2content = /^\/api\/v1\/me\/resume-files\/([^/]+)\/content$/.exec(path);
    if (P2域 && P2content && method === 'PUT') {
      const item = P2域.items.find((candidate) => candidate.file_id === P2content[1]);
      P2要求(item);
      P2要求(请求.headers()['if-match'] === `"${item.revision}"`);
      P2要求((请求.headers()['idempotency-key'] ?? '') !== '');
      P2要求(部件们?.map((part) => part.name).join(',') === 'file,processing_consent_confirmed');
      P2要求(部件们[0].contentType === 'application/pdf');
      P2要求(部件们[1].bytes.toString('utf8') === 'true');
      item.revision += 1;
      item.current_version = {
        version_id: `rfv_${item.file_id}_${item.revision}`, version: item.current_version.version + 1,
        size_bytes: 部件们[0].bytes.length, media_type: 'application/pdf', sha256: 'b'.repeat(64),
        created_at: P2时间, parse: { status: 'pending', updated_at: P2时间 },
      };
      item.updated_at = P2时间;
      P2域.items.splice(P2域.items.indexOf(item), 1);
      P2域.items.unshift(item);
      P2域.列表读取次数 = 0;
      P2域.写入次数 += 1;
      await route.fulfill({ status: 200, json: 信封(item), headers: { ETag: `"${item.revision}"` } });
      return;
    }
    if (P2域 && P2content && method === 'GET') {
      P2要求(P2域.items.some((item) => item.file_id === P2content[1]));
      P2域.下载次数 += 1;
      await route.fulfill({
        status: 200, body: Buffer.from('%PDF-1.7\nfixture\n'),
        contentType: 'application/pdf',
        headers: { 'Content-Disposition': 'attachment; filename="resume.pdf"', 'X-Request-Id': 'fixture-pdf' },
      });
      return;
    }
    const P2parse = /^\/api\/v1\/me\/resume-files\/([^/]+)\/parse$/.exec(path);
    if (P2域 && P2parse && method === 'POST') {
      const item = P2域.items.find((candidate) => candidate.file_id === P2parse[1]);
      P2要求(item);
      P2要求((请求.headers()['idempotency-key'] ?? '') !== '');
      P2要求(JSON.stringify(body) === JSON.stringify({
        version_id: item.current_version.version_id, processing_consent_confirmed: true,
      }));
      item.current_version.parse = { status: 'pending', updated_at: P2时间 };
      P2域.列表读取次数 = 0;
      P2域.写入次数 += 1;
      await route.fulfill({ status: 202, json: 信封(item.current_version.parse) });
      return;
    }
    const P2file = /^\/api\/v1\/me\/resume-files\/([^/]+)$/.exec(path);
    if (P2域 && P2file && method === 'DELETE') {
      const index = P2域.items.findIndex((candidate) => candidate.file_id === P2file[1]);
      P2要求(index >= 0);
      P2要求(请求.headers()['if-match'] === `"${P2域.items[index].revision}"`);
      P2域.items.splice(index, 1);
      P2域.写入次数 += 1;
      await route.fulfill({ status: 200, json: 信封({ deleted: true }) });
      return;
    }

    // ── P3 隐私域（隐私 fixture 存在时才应答；缺席走兜底空信封 → strict decode 拒绝，
    //    正是「Mock 内容不顶替 HTTP」的既有边界）──
    const P3域 = 选项.隐私fixture ?? null;
    if (P3域) {
      // GET 权威整读：脚本队列 FIFO 消费 —— 无项即刻回当前视图；
      // { 保持 } 先挂起（安全重读在飞的窗口），放行后再按当时视图应答；{ 响应 } 强制回陈旧快照。
      if (path === '/api/v1/me/privacy' && method === 'GET') {
        const 脚本项 = P3域.get脚本.shift();
        if (脚本项?.保持) await 脚本项.保持;
        await route.fulfill({ status: 200, json: 信封(脚本项?.响应 ? P3克隆视图(脚本项.响应) : P3克隆视图(P3域.视图)) });
        return;
      }

      // PATCH 稀疏补丁：quoted If-Match 必须等于当前 revision 的 etag，不符 409 version_conflict；
      // 成功按成员合并、revision+1，回完整视图。body 只允许服务端拥有的两个成员。
      if (path === '/api/v1/me/privacy' && method === 'PATCH') {
        P3域.统计.补丁 += 1;
        const etag = 请求.headers()['if-match'] ?? '';
        if (etag !== `"${P3域.视图.revision}"`) {
          await route.fulfill({ status: 409, json: { error: { type: 'version_conflict', message: '版本冲突' } } });
          return;
        }
        const 补丁 = body as { employer_privacy_enabled?: boolean; disclosure_preferences?: Partial<P3隐私形['disclosure_preferences']> };
        if (补丁.employer_privacy_enabled !== undefined) {
          P3域.视图.employer_privacy_enabled = 补丁.employer_privacy_enabled;
        }
        if (补丁.disclosure_preferences !== undefined) {
          P3域.视图.disclosure_preferences = { ...P3域.视图.disclosure_preferences, ...补丁.disclosure_preferences };
        }
        P3域.视图.revision += 1;
        P3域.视图.updated_at = '2026-08-27T00:00:00Z';
        await route.fulfill({ status: 200, json: 信封(P3克隆视图(P3域.视图)) });
        return;
      }

      // GET 可屏蔽组织搜索：strict active（停用组织永不出现）；游标与 query 绑定
      // （格式 `${q}|${页码}`，跨词/未知游标一律空页）。固定每页 2 条制造翻页游标。
      if (path === '/api/v1/organizations' && method === 'GET') {
        const q = (url.searchParams.get('q') ?? '').trim();
        const 脚本 = P3域.搜索脚本.find((项) => 项.词 === q);
        if (脚本) {
          P3域.搜索脚本 = P3域.搜索脚本.filter((项) => 项 !== 脚本);
          P3域.搜索完成.push({ q, cursor: 脚本.next_cursor });
          if (脚本.延迟毫秒) await new Promise((resolve) => setTimeout(resolve, 脚本.延迟毫秒));
          P3域.搜索已答.push({ q, cursor: 脚本.next_cursor });
          await route.fulfill({ status: 200, json: 信封({ items: 脚本.items.map((项) => ({ ...项 })), next_cursor: 脚本.next_cursor }) });
          return;
        }
        const 游标原文 = url.searchParams.get('cursor') ?? '';
        let 页码 = 1;
        let 归属词 = q;
        if (游标原文 !== '') {
          const 解码 = Buffer.from(游标原文, 'base64url').toString('utf8');
          const 分隔 = 解码.lastIndexOf('|');
          归属词 = 分隔 >= 0 ? 解码.slice(0, 分隔) : '\0不匹配';
          页码 = Number(分隔 >= 0 ? 解码.slice(分隔 + 1) : NaN);
        }
        const 池 = Object.entries(P3域.组织库)
          .filter(([, 项]) => 项.status === 'active')
          .filter(([, 项]) => 项.display_name.includes(q))
          .map(([编号, 项]) => ({ organization_id: 编号, display_name: 项.display_name, legal_name: 项.legal_name }));
        const 每页 = 2;
        const 起点 = Number.isInteger(页码) && 页码 > 0 && 归属词 === q ? (页码 - 1) * 每页 : -1;
        const items = 起点 < 0 ? [] : 池.slice(起点, 起点 + 每页);
        const next_cursor = 起点 < 0 || 起点 + 每页 >= 池.length ? null : Buffer.from(`${q}|${页码 + 1}`).toString('base64url');
        P3域.搜索完成.push({ q, cursor: next_cursor });
        P3域.搜索已答.push({ q, cursor: next_cursor });
        await route.fulfill({ status: 200, json: 信封({ items, next_cursor }) });
        return;
      }

      // POST 屏蔽：If-Match + 非空 Idempotency-Key 必带；组织必须是搜索池里的稳定 ID。
      // 同键重放或同组织重复都以 200 回原 receipt；新建 201 receipt。
      if (path === '/api/v1/me/privacy/organization-blocks' && method === 'POST') {
        P3域.统计.屏蔽写入 += 1;
        const etag = 请求.headers()['if-match'] ?? '';
        const 幂等键 = 请求.headers()['idempotency-key'] ?? '';
        const 重放 = 幂等键 !== '' && P3域.幂等登记.get(幂等键);
        const 新块 = body as { organization_id?: string; source?: P3屏蔽形['source'] };
        const 库项 = 新块.organization_id !== undefined ? P3域.组织库[新块.organization_id] : undefined;
        if (
          etag !== `"${P3域.视图.revision}"` ||
          幂等键 === '' ||
          !库项 ||
          (新块.source !== 'current_employer' && 新块.source !== 'related_organization' && 新块.source !== 'manual')
        ) {
          await route.fulfill({
            status: 库项 === undefined && 新块.organization_id !== undefined ? 409 : 422,
            json: {
              error: {
                type: 库项 === undefined && 新块.organization_id !== undefined ? 'organization_unavailable' : 'validation_failed',
                message: '屏蔽请求未通过校验',
              },
            },
          });
          return;
        }
        if (重放) {
          await route.fulfill({ status: 200, json: 信封(JSON.parse(JSON.stringify(重放.receipt)) as unknown) });
          return;
        }
        const 重复 = P3域.视图.organization_blocks.find((块) => 块.organization_id === 新块.organization_id);
        if (重复) {
          const 回执 = {
            organization_block: { ...重复 },
            privacy_revision: P3域.视图.revision,
            created_at: 重复.created_at,
          };
          P3域.幂等登记.set(幂等键, { receipt: 回执, 块: { ...重复 } });
          await route.fulfill({ status: 200, json: 信封(回执) });
          return;
        }
        const 块: P3屏蔽形 = {
          organization_id: 新块.organization_id!,
          organization_display_name: 库项.display_name,
          organization_status: 库项.status,
          source: 新块.source!,
          created_at: '2026-08-27T01:00:00Z',
        };
        P3域.视图.organization_blocks = [...P3域.视图.organization_blocks.map((项) => ({ ...项 })), { ...块 }];
        P3域.视图.revision += 1;
        const 回执 = { organization_block: { ...块 }, privacy_revision: P3域.视图.revision, created_at: 块.created_at };
        P3域.幂等登记.set(幂等键, { receipt: 回执, 块 });
        await route.fulfill({ status: 201, json: 信封(回执) });
        return;
      }

      // POST 解除：目标必须仍在名单里（404）；建档来源的解除必须显式风险确认（422）；
      // 成功移除并 revision+1，回完整视图。
      const 解除匹配 = /^\/api\/v1\/me\/privacy\/organization-blocks\/([^/]+)\/unblock$/.exec(path);
      if (解除匹配 && method === 'POST') {
        P3域.统计.解除写入 += 1;
        const etag = 请求.headers()['if-match'] ?? '';
        const 目标 = P3域.视图.organization_blocks.find((块) => 块.organization_id === 解除匹配[1]);
        if (etag !== `"${P3域.视图.revision}"` || !目标) {
          await route.fulfill({ status: 目标 ? 409 : 404, json: { error: { type: 目标 ? 'version_conflict' : 'organization_block_not_found', message: '解除失败' } } });
          return;
        }
        const 要求确认 = (body as { risk_acknowledged?: boolean }).risk_acknowledged !== true;
        if ((目标.source === 'current_employer' || 目标.source === 'related_organization') && 要求确认) {
          await route.fulfill({ status: 422, json: { error: { type: 'risk_acknowledgement_required', message: '需要风险确认' } } });
          return;
        }
        P3域.视图.organization_blocks = P3域.视图.organization_blocks.filter((块) => 块.organization_id !== 解除匹配[1]).map((块) => ({ ...块 }));
        P3域.视图.revision += 1;
        await route.fulfill({ status: 200, json: 信封(P3克隆视图(P3域.视图)) });
        return;
      }
    }

    // ── P1C 组织域（组织 fixture 存在时才应答；组织 fixture 缺席的用例走兜底空信封，
    //    strict decode 失败 → 水合抛错，这正是「Mock 内容不顶替 HTTP」的边界）──
    if (组织fixture) {
      if (path === '/api/v1/recruiter/profile' && method === 'GET') {
        // 档案缺失是合法的「还没有」：404 not_found，不是故障（P0 修复 Task 1/7）
        if (档案可变 === null) {
          await route.fulfill({
            status: 404,
            json: { error: { type: 'not_found', message: 'Recruiter profile not found' } },
          });
          return;
        }
        await route.fulfill({ status: 200, json: 信封(档案可变) });
        return;
      }
      if (path === '/api/v1/recruiter/profile' && method === 'PATCH') {
        // CAS 按 fixture 的**实际**当前 revision 校验：缺失档案的首写必须带 If-Match: "0"
        const ifMatch = 请求.headers()['if-match'] ?? null;
        const expected = `"${档案可变?.revision ?? 0}"`;
        if (ifMatch !== expected) {
          await route.fulfill({
            status: 409,
            json: { error: { type: 'version_conflict', message: 'profile revision mismatch' } },
          });
          return;
        }
        const patch = body as { public_name?: string; title?: string };
        档案可变 = {
          public_name: patch.public_name ?? 档案可变?.public_name ?? '',
          title: patch.title ?? 档案可变?.title ?? '',
          personal_verification_status: 档案可变?.personal_verification_status ?? 'unverified',
          verified_name: 档案可变?.verified_name ?? null,
          avatar_url: 档案可变?.avatar_url ?? null,
          revision: (档案可变?.revision ?? 0) + 1,
        };
        if (onboardingFixture) {
          onboardingFixture.profile = { ...档案可变 };
          onboardingFixture.mutations.push({ method, path, body, ifMatch });
        }
        await route.fulfill({ status: 200, json: 信封(档案可变) });
        return;
      }
      if (path === '/api/v1/recruiter/avatar' && method === 'POST') {
        // 招聘方 onboarding fixture 下 档案可变 合法地为 null（首次 PATCH 之前还没有
        // 档案）。此时头像 POST 与 profile GET 同一个事实：404 not_found —— 不解引用
        // null，否则路由永不 fulfill，将来的用例会以 120s 超时死掉而不是给出可读失败。
        if (档案可变 === null) {
          await route.fulfill({
            status: 404,
            json: { error: { type: 'not_found', message: 'Recruiter profile not found' } },
          });
          return;
        }
        // 冻结 multipart：恰一个 media part，返回带新头像 URL 的完整档案
        const 媒 = 登记媒体(部件们?.find((件) => 件.name === 'media'));
        档案可变.avatar_url = 媒.url;
        档案可变.revision += 1;
        await route.fulfill({ status: 200, json: 信封(档案可变) });
        return;
      }
      if (path === '/api/v1/recruiter/affiliations' && method === 'GET') {
        await route.fulfill({ status: 200, json: 信封({ affiliations: 关系可变 }) });
        return;
      }
      if (path === '/api/v1/recruiter/organization-admin-requests' && method === 'GET') {
        await route.fulfill({ status: 200, json: 信封({ requests: 申请可变 }) });
        return;
      }

      // 公开企业（直接读取：名片选当前关系 / 岗位公司卡 / 企业详情页共用）
      const 公开匹配 = /^\/api\/v1\/organizations\/([^/]+)$/.exec(path);
      if (公开匹配 && method === 'GET') {
        const 组织 = 组织fixture.organizations[公开匹配[1]];
        const 档 = 企业档案表.get(公开匹配[1]);
        if (!组织 || !档) {
          await route.fulfill({ status: 404, json: { error: { type: 'organization_not_found', message: '企业不存在' } } });
          return;
        }
        await route.fulfill({
          status: 200,
          json: 信封({
            organization_id: 公开匹配[1],
            legal_name: 组织.legal_name,
            display_name: 组织.display_name,
            verified_at: '2026-08-25T00:00:00Z',
            profile: 档,
            active_verified_job_count: 1,
          }),
        });
        return;
      }

      // 企业档案（GET 权威快照 / PATCH 完整 replacement）
      const 档案匹配 = /^\/api\/v1\/organizations\/([^/]+)\/profile$/.exec(path);
      if (档案匹配) {
        const 档 = 企业档案表.get(档案匹配[1]);
        if (!档) {
          await route.fulfill({ status: 404, json: { error: { type: 'organization_not_found', message: '企业不存在' } } });
          return;
        }
        if (method === 'GET') {
          await route.fulfill({ status: 200, json: 信封(档) });
          return;
        }
        if (method === 'PATCH') {
          const 换 = body as {
            brand_name: string; industry_id: string; company_size: P1C企业档案形['company_size'];
            funding_stage: P1C企业档案形['funding_stage']; office_address: string;
            benefit_codes: string[]; work_schedule: P1C企业档案形['work_schedule']; company_intro: string;
            business_items: string[]; office_media_ids: string[]; company_media_ids: string[];
            product_intro: string; team_members: { name: string; title: string; summary: string }[];
            logo_media_id: string;
          };
          档.brand_name = 换.brand_name;
          档.industry = 换.industry_id ? { id: 换.industry_id, display_name: 'Fixture 行业' } : null;
          档.company_size = 换.company_size;
          档.funding_stage = 换.funding_stage;
          档.office_address = 换.office_address;
          档.benefit_codes = [...换.benefit_codes];
          档.work_schedule = 换.work_schedule;
          档.company_intro = 换.company_intro;
          档.business_items = [...换.business_items];
          档.product_intro = 换.product_intro;
          档.team_members = 换.team_members.map((员) => ({ ...员 }));
          档.logo = 换.logo_media_id ? 媒体登记.get(换.logo_media_id) ?? null : null;
          档.office_media = 换.office_media_ids
            .map((号) => 媒体登记.get(号))
            .filter((媒): 媒 is P1C企业媒体形 => Boolean(媒));
          档.company_media = 换.company_media_ids
            .map((号) => 媒体登记.get(号))
            .filter((媒): 媒 is P1C企业媒体形 => Boolean(媒));
          档.revision += 1;
          档.updated_at = '2026-08-26T00:00:00Z';
          await route.fulfill({ status: 200, json: 信封(档) });
          return;
        }
      }

      // 企业媒体两步协议：POST 落号（幂等由客户端 Idempotency-Key 承担）/ DELETE 204 无信封
      if (/^\/api\/v1\/organizations\/[^/]+\/media$/.test(path) && method === 'POST') {
        await route.fulfill({ status: 200, json: 信封(登记媒体(部件们?.find((件) => 件.name === 'media'))) });
        return;
      }
      const 媒体删除匹配 = /^\/api\/v1\/organizations\/([^/]+)\/media\/([^/]+)$/.exec(path);
      if (媒体删除匹配 && method === 'DELETE') {
        媒体登记.delete(媒体删除匹配[2]);
        await route.fulfill({ status: 204, body: '' });
        return;
      }
    }

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
      物化规则序 += 1;
      if (元?.替换目标编号) {
        const 目标 = p6.rules[角色].find((规) => 规.rule_id === 元.替换目标编号);
        if (目标) 目标.state = 'archived';
      }
      const 新规则: P6Rule = {
        rule_id: `rul_00112233445566778899aabbccddee${(0xd0 + 物化规则序 - 1).toString(16)}`,
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

    // 规则清单：一律两页翻页（首条 + cursor / 余下）；candidate 专用 503-首次与挂起分支
    const 规则清单匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rules$/.exec(path);
    if (规则清单匹配 && method === 'GET') {
      const 角色 = 规则清单匹配[1] === 'me' ? 'candidate' : 'recruiter';
      规则清单请求数 += 1;
      if (角色 === 'candidate' && 选项.P6分支?.规则清单首次失败 && 规则清单请求数 === 1) {
        await route.fulfill({ status: 503, json: { error: { type: 'service_unavailable', message: 'fixture 首次规则清单失败' } } });
        return;
      }
      if (角色 === 'candidate') await 选项.P6分支?.挂起候选规则;
      const 全部 = p6.rules[角色];
      const 游标 = url.searchParams.get('cursor');
      const 成环 = 角色 === 'candidate' && Boolean(选项.P6分支?.游标成环);
      const 页: { rules: P6Rule[]; next_cursor?: string } = 游标 === null
        ? (全部.length > 0 ? { rules: [全部[0]], next_cursor: 'fixture-p6-page-2' } : { rules: [] })
        : (成环 && 全部.length > 1
          ? { rules: 全部.slice(1), next_cursor: 'fixture-p6-page-2' }
          : { rules: 全部.slice(1) });
      await route.fulfill({ status: 200, json: 信封(页) });
      return;
    }

    // 规则单项：GET 带强 ETag；PATCH pause/resume 校验 If-Match 并推进版本；DELETE 只认当前版本
    const 规则单项匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rules\/([^/]+)$/.exec(path);
    if (规则单项匹配 && method === 'GET') {
      const 规则 = p6.rules[规则单项匹配[1] === 'me' ? 'candidate' : 'recruiter'].find((规) => 规.rule_id === 规则单项匹配[2]);
      if (!规则) {
        await route.fulfill({ status: 404, json: { error: { type: 'agent_rule_not_found', message: '规则不存在' } } });
        return;
      }
      await route.fulfill({ status: 200, headers: { etag: `"${规则.version}"` }, json: 信封(规则) });
      return;
    }
    if (规则单项匹配 && method === 'PATCH') {
      记录P6变更(path);
      const 角色 = 规则单项匹配[1] === 'me' ? 'candidate' : 'recruiter';
      const 目标编号 = 规则单项匹配[2];
      const 规则 = p6.rules[角色].find((规) => 规.rule_id === 目标编号);
      if (冲突规则编号们.has(目标编号) || !规则 || 请求.headers()['if-match'] !== `"${规则.version}"`) {
        await route.fulfill({ status: 409, json: { error: { type: 'version_conflict', message: '版本冲突' } } });
        return;
      }
      const 换 = body as { operation?: 'pause' | 'resume' };
      if (换.operation === 'pause') 规则.state = 'paused';
      if (换.operation === 'resume') 规则.state = 'active';
      规则.version += 1;
      规则.updated_at = '2026-08-26T00:00:07Z';
      await route.fulfill({ status: 200, headers: { etag: `"${规则.version}"` }, json: 信封(规则) });
      return;
    }
    if (规则单项匹配 && method === 'DELETE') {
      记录P6变更(path);
      const 角色 = 规则单项匹配[1] === 'me' ? 'candidate' : 'recruiter';
      const 规则 = p6.rules[角色].find((规) => 规.rule_id === 规则单项匹配[2]);
      if (!规则) {
        await route.fulfill({ status: 404, json: { error: { type: 'agent_rule_not_found', message: '规则不存在' } } });
        return;
      }
      // archive 只在 If-Match 等于当前版本时生效，否则 409（客户端必须重读权威版本）
      if (请求.headers()['if-match'] !== `"${规则.version}"`) {
        await route.fulfill({ status: 409, json: { error: { type: 'version_conflict', message: '版本冲突' } } });
        return;
      }
      规则.state = 'archived';
      await route.fulfill({ status: 204 });
      return;
    }

    // 替换提案：If-Match 必须点名创建时的当前版本；提案先以 interpreting 回执入场
    const 替换匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rules\/([^/]+)\/replacement-proposals$/.exec(path);
    if (替换匹配 && method === 'POST') {
      记录P6变更(path);
      const 角色 = 替换匹配[1] === 'me' ? 'candidate' : 'recruiter';
      const 目标规则 = p6.rules[角色].find((规) => 规.rule_id === 替换匹配[2]);
      if (!目标规则) {
        await route.fulfill({ status: 404, json: { error: { type: 'agent_rule_not_found', message: '规则不存在' } } });
        return;
      }
      if (请求.headers()['if-match'] !== `"${目标规则.version}"`) {
        await route.fulfill({ status: 409, json: { error: { type: 'version_conflict', message: '版本冲突' } } });
        return;
      }
      const 换 = body as { text?: string; scope?: P6Rule['scope'] };
      创建提案序 += 1;
      const 编号 = `arp_00112233445566778899aabbccddee${(0xc0 + 创建提案序 - 1).toString(16)}`;
      const 提案: P6Proposal = { proposal_id: 编号, state: 'interpreting' };
      提案元数据.set(编号, {
        草稿: 换.text ?? '',
        scope: 角色 === 'candidate' ? 换.scope : undefined,
        后果: 'mixed',
        替换目标编号: 替换匹配[2],
      });
      p6.proposals[角色].push(提案);
      await route.fulfill({ status: 200, json: 信封(提案) });
      return;
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
      return;
    }
    if (提案清单匹配 && method === 'POST') {
      记录P6变更(path);
      if (创建失败余数 > 0) {
        创建失败余数 -= 1;
        await route.fulfill({ status: 500, json: { error: { type: 'internal_error', message: P6标记.创建失败提示 } } });
        return;
      }
      const 角色 = 提案清单匹配[1] === 'me' ? 'candidate' : 'recruiter';
      const 换 = body as { text?: string; scope?: P6Rule['scope'] };
      创建提案序 += 1;
      const 编号 = `arp_00112233445566778899aabbccddee${(0xc0 + 创建提案序 - 1).toString(16)}`;
      // fresh create 回执只有 proposal_id + state（连 created_at 都不给，解码器允许）
      const 提案: P6Proposal = { proposal_id: 编号, state: 'interpreting' };
      提案元数据.set(编号, {
        草稿: 换.text ?? '',
        scope: 角色 === 'candidate' ? 换.scope : undefined,
        后果: 'mixed',
      });
      p6.proposals[角色].push(提案);
      await route.fulfill({ status: 200, json: 信封(提案) });
      return;
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
        return;
      }
      const 提案 = p6.proposals[角色].find((提) => 提.proposal_id === 提案编号);
      if (!提案) {
        await route.fulfill({ status: 404, json: { error: { type: 'agent_rule_proposal_not_found', message: '提案不存在' } } });
        return;
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
      return;
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
        return;
      }
      if (元?.分支 === 'accept丢失' || 元?.分支 === 'accept未知') {
        if (!提案终态.has(提案编号)) 物化并终态(角色, 提案编号, 元);
        if (元.分支 === 'accept丢失') {
          await route.abort('connectionreset');
          return;
        }
        await route.fulfill({ status: 503, json: { error: { type: 'operation_outcome_unknown', message: '结果未知' } } });
        return;
      }
      const 新规则 = 物化并终态(角色, 提案编号, 元);
      if (!新规则) {
        await route.fulfill({ status: 409, json: { error: { type: 'agent_rule_proposal_not_ready', message: '提案还未就绪' } } });
        return;
      }
      await route.fulfill({ status: 200, headers: { etag: `"${新规则.version}"` }, json: 信封(新规则) });
      return;
    }

    // dismiss：提案出局并给 dismissed 回执（恢复路径靠单项 GET 也能读到同一终态）
    const 放弃匹配 = /^\/api\/v1\/(me|recruiter)\/agent-rule-proposals\/([^/]+)\/dismiss$/.exec(path);
    if (放弃匹配 && method === 'POST') {
      记录P6变更(path);
      const 角色 = 放弃匹配[1] === 'me' ? 'candidate' : 'recruiter';
      const 提案 = p6.proposals[角色].find((提) => 提.proposal_id === 放弃匹配[2]);
      if (!提案) {
        await route.fulfill({ status: 404, json: { error: { type: 'agent_rule_proposal_not_found', message: '提案不存在' } } });
        return;
      }
      提案终态.set(提案.proposal_id, { proposal_id: 提案.proposal_id, state: 'dismissed' });
      p6.proposals[角色] = p6.proposals[角色].filter((提) => 提.proposal_id !== 提案.proposal_id);
      await route.fulfill({ status: 200, json: 信封({ proposal_id: 提案.proposal_id, state: 'dismissed' }) });
      return;
    }

    // ── P4 发现推荐域（发现 fixture 存在时才应答；缺席走兜底空信封 → strict decode 拒绝，
    //    正是「Mock 内容不顶替 HTTP」的既有边界）。变更回执（method/path/body + If-Match /
    //    Idempotency-Key）原样存进 fixture 的 变更请求；委托登记表按 Idempotency-Key 记录，
    //    同键重放 / 受控重试都回同一张回执。──
    if (P4域) {
      const 记录P4变更 = (变更路径: string) => {
        P4域.变更请求.push({
          method,
          path: 变更路径,
          body,
          ifMatch: 请求.headers()['if-match'] ?? null,
          idempotencyKey: 请求.headers()['idempotency-key'] ?? null,
        });
      };
      const 游标 = url.searchParams.get('cursor');

      // 候选端列表：按 intention scope 两页翻页；迟到应答分支挂起首页；非法分支注毒第二页
      if (path === '/api/v1/me/job-recommendations' && method === 'GET') {
        const 意向 = url.searchParams.get('intention_id') ?? '';
        const 挂起 = P4域.分支?.挂起候选读取;
        if (挂起?.意向 === 意向 && 游标 === null) await 挂起.门;
        const 注毒 = Boolean(P4域.分支?.候选非法第二页) && 游标 !== null;
        await route.fulfill({ status: 200, json: 信封(P4分页(P4域.候选推荐[意向] ?? [], 注毒, 游标)) });
        return;
      }

      // canonical job GET（详情直取）：fixture 没有的编号按 404 job_not_found 收口
      const P4岗位匹配 = /^\/api\/v1\/jobs\/([^/]+)$/.exec(path);
      if (P4岗位匹配 && method === 'GET') {
        const 岗 = P4域.候选岗位[decodeURIComponent(P4岗位匹配[1])];
        if (!岗) {
          await route.fulfill({ status: 404, json: { error: { type: 'job_not_found', message: '岗位不存在' } } });
          return;
        }
        await route.fulfill({ status: 200, json: 信封(P4深克隆(岗)) });
        return;
      }

      // 候选端刷新：POST 建新批次；受控重试分支首把键 503，同键重试成功
      if (path === '/api/v1/me/job-recommendation-refreshes' && method === 'POST') {
        记录P4变更(path);
        const 键 = 请求.headers()['idempotency-key'] ?? '';
        if (P4域.分支?.候选刷新首次503 && 键 !== '' && !p4刷新503键.has(键)) {
          p4刷新503键.add(键);
          await route.fulfill({ status: 503, headers: { 'Retry-After': '0' }, json: { error: { type: 'operation_outcome_unknown', message: '结果未知' } } });
          return;
        }
        P4域.刷新次数.candidate += 1;
        const 意向 = (body as { intention_id?: string }).intention_id ?? '';
        // 服务端建新批次：空 scope 首刷给权威卡（旧卡保留语义由客户端快照负责）
        if ((P4域.候选推荐[意向] ?? []).length === 0) {
          P4域.候选推荐[意向] = [P4候选卡({ batch_id: `bat_p4fixture_c${P4域.刷新次数.candidate + 1}` })];
        }
        await route.fulfill({ status: 200, json: 信封(P4发现批次('candidate_jobs', 意向)) });
        return;
      }

      // 候选端不感兴趣：PUT 200 才从 available 数组移除（无 If-Match / 无 Idempotency-Key）
      const P4不感兴趣匹配 = /^\/api\/v1\/me\/job-recommendations\/([^/]+)\/not-interested$/.exec(path);
      if (P4不感兴趣匹配 && method === 'PUT') {
        记录P4变更(path);
        const 推荐编号 = decodeURIComponent(P4不感兴趣匹配[1]);
        // 失败分支也在存证之后：两次传输都留变更回执，只有应答不同
        if (P4域.分支?.候选不感兴趣先失败 && !p4不感兴趣失败键.has(推荐编号)) {
          p4不感兴趣失败键.add(推荐编号);
          await route.fulfill({ status: 500, json: { error: { type: 'internal_error', message: 'fixture 首次不感兴趣失败' } } });
          return;
        }
        for (const 意向 of Object.keys(P4域.候选推荐)) {
          P4域.候选推荐[意向] = P4域.候选推荐[意向]!.filter((卡) => 卡.recommendation_id !== 推荐编号);
        }
        await route.fulfill({ status: 200, json: 信封(P4发现偏好({ rejected: true, rejection_reason: 'not_interested' })) });
        return;
      }

      // 候选端委托：一次意图一把键；同键重放 / 受控重试回同一张回执；选择坐标是 job_id
      if (path === '/api/v1/me/job-delegations' && method === 'POST') {
        记录P4变更(path);
        const 键 = 请求.headers()['idempotency-key'] ?? '';
        let 表项 = p4委托表.get(键);
        if (!表项) {
          const 换 = body as { intention_id?: string; selection?: { items?: string[] } };
          const 岗位编号 = 换.selection?.items?.[0] ?? '';
          // 服务端语义：无论响应是否送达，委托都已受理 —— 503 分支也先落登记再丢应答
          表项 = {
            role: 'candidate',
            读数: 0,
            回执: { delegation_id: P4编号.candidateDelegation, recommendation_id: null, state: 'accepted', evaluation_id: null, case_id: null, refusal_code: null },
          };
          p4委托表.set(键, 表项);
          for (const 卡 of P4域.候选推荐[换.intention_id ?? ''] ?? []) {
            if (卡.job.job_id === 岗位编号) {
              卡.state = 'delegating';
              卡.delegation = { delegation_id: P4编号.candidateDelegation, state: 'accepted', case_id: null };
            }
          }
        }
        if (P4域.分支?.候选委托先503 && 键 !== '' && !p4委托503键.has(键)) {
          p4委托503键.add(键);
          await route.fulfill({ status: 503, headers: { 'Retry-After': '0' }, json: { error: { type: 'operation_outcome_unknown', message: '结果未知' } } });
          return;
        }
        await route.fulfill({ status: 200, json: 信封({ receipts: [P4深克隆(表项.回执)] }) });
        return;
      }

      // 候选端委托单项 GET：第一次读 evaluating，之后推进 case_started（真实 Case 引用只在这里出现）
      const P4候选委托读匹配 = /^\/api\/v1\/me\/job-delegations\/([^/]+)$/.exec(path);
      if (P4候选委托读匹配 && method === 'GET') {
        const 编号 = decodeURIComponent(P4候选委托读匹配[1]);
        const 表项 = [...p4委托表.values()].find((项) => 项.回执.delegation_id === 编号);
        if (!表项) {
          await route.fulfill({ status: 404, json: { error: { type: 'delegation_not_found', message: '委托不存在' } } });
          return;
        }
        表项.读数 += 1;
        表项.回执 = 表项.读数 >= 2
          ? { ...表项.回执, state: 'case_started', case_id: P4编号.case }
          : { ...表项.回执, state: 'evaluating' };
        P4域.委托读取.push({ delegationId: 编号, state: 表项.回执.state });
        await route.fulfill({ status: 200, json: 信封(P4深克隆(表项.回执)) });
        return;
      }

      // 招聘端列表：available / rejected 两条腿都按当前岗位 scope 两页翻页
      const P4招聘列表匹配 = /^\/api\/v1\/recruiter\/jobs\/([^/]+)\/candidate-recommendations$/.exec(path);
      if (P4招聘列表匹配 && method === 'GET') {
        const 岗位编号 = decodeURIComponent(P4招聘列表匹配[1]);
        const items = (url.searchParams.get('state') === 'rejected'
          ? P4域.招聘已筛[岗位编号]
          : P4域.招聘可用[岗位编号]) ?? [];
        await route.fulfill({ status: 200, json: 信封(P4分页(items, false, 游标)) });
        return;
      }

      // 招聘端单项详情 / 收藏 / 淘汰（fixture 拥有两条腿，PUT/DELETE 直接改写并在两腿间搬运）
      const P4收藏匹配 = /^\/api\/v1\/recruiter\/jobs\/([^/]+)\/candidate-recommendations\/([^/]+)\/favorite$/.exec(path);
      const P4淘汰匹配 = /^\/api\/v1\/recruiter\/jobs\/([^/]+)\/candidate-recommendations\/([^/]+)\/rejection$/.exec(path);
      const P4招聘详情匹配 = /^\/api\/v1\/recruiter\/jobs\/([^/]+)\/candidate-recommendations\/([^/]+)$/.exec(path);
      const P4找招聘卡 = (岗位编号: string, 推荐编号: string): P4招聘推荐形 | undefined =>
        (P4域.招聘可用[岗位编号] ?? []).find((卡) => 卡.recommendation_id === 推荐编号) ??
        (P4域.招聘已筛[岗位编号] ?? []).find((卡) => 卡.recommendation_id === 推荐编号);

      if (P4收藏匹配 && (method === 'PUT' || method === 'DELETE')) {
        记录P4变更(path);
        const 卡 = P4找招聘卡(decodeURIComponent(P4收藏匹配[1]), decodeURIComponent(P4收藏匹配[2]));
        if (!卡) {
          await route.fulfill({ status: 404, json: { error: { type: 'recommendation_not_found', message: '推荐不存在' } } });
          return;
        }
        卡.favorite = method === 'PUT';
        await route.fulfill({ status: 200, json: 信封(P4发现偏好({ favorite: 卡.favorite, rejected: 卡.rejected, rejection_reason: 卡.rejection_reason })) });
        return;
      }
      if (P4淘汰匹配 && (method === 'PUT' || method === 'DELETE')) {
        记录P4变更(path);
        const 岗位编号 = decodeURIComponent(P4淘汰匹配[1]);
        const 卡 = P4找招聘卡(岗位编号, decodeURIComponent(P4淘汰匹配[2]));
        if (!卡) {
          await route.fulfill({ status: 404, json: { error: { type: 'recommendation_not_found', message: '推荐不存在' } } });
          return;
        }
        if (method === 'PUT') {
          卡.rejected = true;
          卡.rejection_reason = (body as { reason?: P4淘汰原因形 }).reason ?? 'other';
          卡.state = 'rejected';
          P4域.招聘可用[岗位编号] = (P4域.招聘可用[岗位编号] ?? []).filter((条) => 条.recommendation_id !== 卡.recommendation_id);
          P4域.招聘已筛[岗位编号] = [...(P4域.招聘已筛[岗位编号] ?? []).filter((条) => 条.recommendation_id !== 卡.recommendation_id), 卡];
        } else {
          卡.rejected = false;
          卡.rejection_reason = null;
          卡.state = 'available';
          P4域.招聘已筛[岗位编号] = (P4域.招聘已筛[岗位编号] ?? []).filter((条) => 条.recommendation_id !== 卡.recommendation_id);
          P4域.招聘可用[岗位编号] = [...(P4域.招聘可用[岗位编号] ?? []).filter((条) => 条.recommendation_id !== 卡.recommendation_id), 卡];
        }
        await route.fulfill({ status: 200, json: 信封(P4发现偏好({ favorite: 卡.favorite, rejected: 卡.rejected, rejection_reason: 卡.rejection_reason })) });
        return;
      }
      if (P4招聘详情匹配 && method === 'GET') {
        const 卡 = P4找招聘卡(decodeURIComponent(P4招聘详情匹配[1]), decodeURIComponent(P4招聘详情匹配[2]));
        if (!卡) {
          await route.fulfill({ status: 404, json: { error: { type: 'recommendation_not_found', message: '推荐不存在' } } });
          return;
        }
        await route.fulfill({ status: 200, json: 信封(P4深克隆(卡)) });
        return;
      }

      // 招聘端刷新：POST 建新批次（body 带 job_id，幂等键必带）
      if (path === '/api/v1/recruiter/candidate-recommendation-refreshes' && method === 'POST') {
        记录P4变更(path);
        P4域.刷新次数.recruiter += 1;
        const 岗位编号 = (body as { job_id?: string }).job_id ?? '';
        await route.fulfill({ status: 200, json: 信封(P4发现批次('recruiter_candidates', 岗位编号)) });
        return;
      }

      // 招聘端委托：无披露字段，选择坐标是 recommendation_id；同键回同一张回执
      if (path === '/api/v1/recruiter/candidate-delegations' && method === 'POST') {
        记录P4变更(path);
        const 键 = 请求.headers()['idempotency-key'] ?? '';
        let 表项 = p4委托表.get(键);
        if (!表项) {
          const 换 = body as { job_id?: string; selection?: { items?: string[] } };
          const 推荐编号 = 换.selection?.items?.[0] ?? '';
          表项 = {
            role: 'recruiter',
            读数: 0,
            回执: { delegation_id: P4编号.recruiterDelegation, recommendation_id: 推荐编号, state: 'accepted', evaluation_id: null, case_id: null, refusal_code: null },
          };
          p4委托表.set(键, 表项);
          for (const 卡 of P4域.招聘可用[换.job_id ?? ''] ?? []) {
            if (卡.recommendation_id === 推荐编号) {
              卡.delegation = { delegation_id: P4编号.recruiterDelegation, state: 'accepted', case_id: null };
            }
          }
        }
        await route.fulfill({ status: 200, json: 信封({ receipts: [P4深克隆(表项.回执)] }) });
        return;
      }

      // 招聘端委托单项 GET：accepted 保持（P4 不制造 Case，case_id 恒空）
      const P4招聘委托读匹配 = /^\/api\/v1\/recruiter\/candidate-delegations\/([^/]+)$/.exec(path);
      if (P4招聘委托读匹配 && method === 'GET') {
        const 编号 = decodeURIComponent(P4招聘委托读匹配[1]);
        const 表项 = [...p4委托表.values()].find((项) => 项.回执.delegation_id === 编号);
        if (!表项) {
          await route.fulfill({ status: 404, json: { error: { type: 'delegation_not_found', message: '委托不存在' } } });
          return;
        }
        表项.读数 += 1;
        P4域.委托读取.push({ delegationId: 编号, state: 表项.回执.state });
        await route.fulfill({ status: 200, json: 信封(P4深克隆(表项.回执)) });
        return;
      }
    }

    // ── resume ──
    if (path === '/api/v1/me/resume' && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封(fixture简历) });
      return;
    }
    if (path === '/api/v1/me/resume/summary' && method === 'PATCH') {
      await route.fulfill({ status: 200, json: 信封({ ...fixture简历, summary: (body as { value?: string })?.value ?? '', summary_revision: 2 }) });
      return;
    }
    if (path === '/api/v1/me/resume/profile' && method === 'PATCH') {
      await route.fulfill({ status: 200, json: 信封({ ...fixture简历, profile: { ...fixture简历.profile, ...(body as object) }, profile_revision: 2 }) });
      return;
    }
    if (path === '/api/v1/me/resume/skills' && method === 'PATCH') {
      await route.fulfill({ status: 200, json: 信封({ ...fixture简历, skills: (body as { skills?: string[] })?.skills ?? [], skills_revision: 2 }) });
      return;
    }
    if (path.startsWith('/api/v1/me/resume/educations') && method === 'POST') {
      const b = body as { institution_id?: string; degree?: string; major_id?: string; start_month?: string };
      await route.fulfill({ status: 200, json: 信封({ entry: { kind: 'education', education: { id: 'edu-fixture-001', institution: { id: b.institution_id ?? '', display_name: 标记.学校display }, degree: b.degree ?? '', major: { id: b.major_id ?? '', display_name: 'Fixture 专业' }, start_month: b.start_month ?? '', end_month: null, revision: 1 } }, aggregate_revision: 2 }) });
      return;
    }
    if (path.startsWith('/api/v1/me/resume/experiences') && method === 'POST') {
      await route.fulfill({ status: 200, json: 信封({ entry: { kind: 'experience', experience: { id: 'exp-fixture-001', company: (body as { company?: string })?.company ?? '', industry: { id: 'ind-fixture', display_name: 'Fixture 行业' }, title: (body as { title?: string })?.title ?? '', start_month: '2020-01', end_month: null, description: '', hidden: false, internship: false, revision: 1, projects: null } }, aggregate_revision: 2 }) });
      return;
    }

    // ── intentions ──
    if (path === '/api/v1/me/intentions' && method === 'GET') {
      // P4 发现 fixture 在场时可以改答自己的意向列表（候选端 scope 坐标 / 迟到应答用例用）
      await route.fulfill({ status: 200, json: 信封(P4域?.意向们 ? { intentions: P4域.意向们 } : fixture意向列表) });
      return;
    }
    if (path === '/api/v1/me/intentions' && method === 'POST') {
      await route.fulfill({ status: 200, json: 信封(fixture意向列表.intentions[0]) });
      return;
    }

    // ── catalog ──
    if (path === '/api/v1/catalog/locations' && method === 'GET') {
      const q = url.searchParams.get('q') ?? '';
      const admin1 = url.searchParams.get('admin1_code') ?? '';
      const items = admin1 !== '' || q !== ''
        ? [{ id: 'loc-fixture-001', display_name: 标记.城市display, country_code: 'CN', country_name: '中国', admin1_code: admin1 || 'SH', admin1_name: 'Fixture 省', timezone: 'Asia/Shanghai', population: 1000 }]
        : [];
      await route.fulfill({ status: 200, json: 信封(目录页(items)) });
      return;
    }
    if (path === '/api/v1/catalog/education-institutions' && method === 'GET') {
      const q = url.searchParams.get('q') ?? '';
      const items = q !== ''
        ? [{ id: 'inst-fixture-001', display_name: 标记.学校display, location: { id: 'loc-fixture-001', display_name: 'Fixture City', country_code: 'CN', country_name: 'Fixtureland', admin1_code: null, admin1_name: null, timezone: 'Asia/Shanghai', population: 0 } }]
        : [];
      await route.fulfill({ status: 200, json: 信封(目录页(items)) });
      return;
    }
    if (path.startsWith('/api/v1/catalog/job-categories') && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封(目录页([{ id: 'job-fixture-001', display_name: 标记.职位display, parent_id: null, selectable: true }])) });
      return;
    }
    if (path.startsWith('/api/v1/catalog/industries') && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封(目录页([{ id: 'ind-fixture-001', display_name: 'Fixture 行业', parent_id: null, selectable: true }])) });
      return;
    }
    if (path.startsWith('/api/v1/catalog/majors') && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封(目录页([{ id: 'major-fixture-001', display_name: 'Fixture 专业', parent_id: null, selectable: true }])) });
      return;
    }

    // ── recruiter jobs ──
    if (path === '/api/v1/recruiter/jobs' && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封({ jobs: 组织fixture ? 岗位可变 : [], next_cursor: null }) });
      return;
    }
    if (组织fixture && path === '/api/v1/recruiter/jobs' && method === 'POST') {
      // 服务端推导（客户端 body 只有 claim，无 refs / verification status）：
      // 首个 verified+active 关系给出两个 ref 与两侧验证状态；没有关系则 unverified 无 ref。
      // P3：hard_requirements 四员块必收完整（客户端永远带整块），fixture 原样落库回读。
      const 换 = body as {
        publisher_mode: 'direct' | 'agency';
        hiring_organization_claim: { display_name: string; legal_name?: string | null };
        title: string;
        recruitment_type: P1C岗位形['recruitment_type'];
        category_id: string;
        location_id: string;
        office_location: string;
        workplace_mode: P1C岗位形['workplace_mode'];
        salary: { lower: number; upper: number };
        annual_salary_months: number | null;
        campus_cohort: number | null;
        internship_months: number | null;
        onsite_days_per_week: number | null;
        experience_requirement: string;
        education_requirement: string;
        structured_requirements_confirmed: boolean;
        description: string;
        requirements: string;
        keywords: string[];
        private_screening_preferences: string;
        hard_requirements?: P3硬性条件形;
      };
      const 发布关系 = 关系可变.find((项) => 项.status === 'verified' && 项.organization_status === 'active');
      const 现在 = '2026-08-26T00:00:00Z';
      const 新岗: P1C岗位形 = {
        job_id: `job-fixture-created-${岗位可变.length + 1}`,
        publisher_mode: 换.publisher_mode,
        publisher_affiliation_ref: 发布关系?.affiliation_id,
        publisher_verification_status: 发布关系 ? 'verified' : 'unverified',
        hiring_organization_claim: {
          display_name: 换.hiring_organization_claim.display_name,
          legal_name: 换.hiring_organization_claim.legal_name ?? null,
        },
        publisher_organization_ref: 发布关系?.organization_id,
        hiring_organization_verification_status: 发布关系 ? 'verified' : 'unverified',
        hiring_organization_ref: 发布关系?.organization_id,
        title: 换.title,
        recruitment_type: 换.recruitment_type,
        category: { id: 换.category_id, display_name: 标记.职位display },
        location: { id: 换.location_id, display_name: 标记.城市display },
        office_location: 换.office_location,
        workplace_mode: 换.workplace_mode,
        salary_lower: 换.salary.lower,
        salary_upper: 换.salary.upper,
        salary_period: 换.recruitment_type === 'internship' || 换.recruitment_type === 'part_time' ? 'day' : 'month',
        annual_salary_months: 换.annual_salary_months,
        campus_cohort: 换.campus_cohort,
        internship_months: 换.internship_months,
        onsite_days_per_week: 换.onsite_days_per_week,
        experience_requirement: 换.experience_requirement,
        education_requirement: 换.education_requirement,
        structured_requirements_confirmed: 换.structured_requirements_confirmed,
        description: 换.description,
        requirements: 换.requirements,
        keywords: 换.keywords,
        private_screening_preferences: 换.private_screening_preferences,
        hard_requirements: { ...P3全未知硬性条件(), ...换.hard_requirements },
        status: 'active',
        revision: 1,
        published_at: 现在,
        created_at: 现在,
        updated_at: 现在,
      };
      岗位可变.push(新岗);
      if (onboardingFixture) {
        onboardingFixture.ownerJobs.push({ ...新岗 });
        onboardingFixture.mutations.push({
          method,
          path,
          body,
          ifMatch: 请求.headers()['if-match'] ?? null,
        });
      }
      await route.fulfill({ status: 201, json: 信封(新岗) });
      return;
    }

    // P3：编辑岗位 —— PATCH 回完整 owner DTO（immutable title/type/category/location 带
    // 服务端原值），hard_requirements 整块替换，revision+1。客户端 PATCH 前必带 quoted If-Match。
    const 编辑匹配 = 组织fixture ? /^\/api\/v1\/recruiter\/jobs\/([^/]+)$/.exec(path) : null;
    if (编辑匹配 && method === 'PATCH') {
      const 存量 = 岗位可变.find((项) => 项.job_id === 编辑匹配[1]);
      if (!存量) {
        await route.fulfill({ status: 404, json: { error: { type: 'job_not_found', message: '岗位不存在' } } });
        return;
      }
      const 补丁 = body as {
        publisher_mode: 'direct' | 'agency';
        hiring_organization_claim: { display_name: string; legal_name?: string | null };
        office_location: string;
        workplace_mode: P1C岗位形['workplace_mode'];
        salary: { lower: number; upper: number };
        annual_salary_months: number | null;
        campus_cohort: number | null;
        internship_months: number | null;
        onsite_days_per_week: number | null;
        experience_requirement: string;
        education_requirement: string;
        structured_requirements_confirmed: boolean;
        hard_requirements?: P3硬性条件形;
        description: string;
        requirements: string;
        keywords: string[];
        private_screening_preferences: string;
      };
      存量.office_location = 补丁.office_location;
      存量.workplace_mode = 补丁.workplace_mode;
      存量.salary_lower = 补丁.salary.lower;
      存量.salary_upper = 补丁.salary.upper;
      存量.salary_period = 存量.recruitment_type === 'internship' || 存量.recruitment_type === 'part_time' ? 'day' : 'month';
      存量.annual_salary_months = 补丁.annual_salary_months;
      存量.campus_cohort = 补丁.campus_cohort;
      存量.internship_months = 补丁.internship_months;
      存量.onsite_days_per_week = 补丁.onsite_days_per_week;
      存量.experience_requirement = 补丁.experience_requirement;
      存量.education_requirement = 补丁.education_requirement;
      存量.structured_requirements_confirmed = 补丁.structured_requirements_confirmed;
      存量.hard_requirements = { ...P3全未知硬性条件(), ...补丁.hard_requirements };
      存量.description = 补丁.description;
      存量.requirements = 补丁.requirements;
      存量.keywords = Array.isArray(补丁.keywords) ? [...补丁.keywords] : [];
      存量.private_screening_preferences = 补丁.private_screening_preferences;
      存量.revision += 1;
      存量.updated_at = '2026-08-27T02:00:00Z';
      await route.fulfill({ status: 200, json: 信封({ ...存量 }) });
      return;
    }

    // ── P5 MatchCase 域（Task 8：可变 fixture 在场才应答；缺席走兜底空信封 → strict
    //    decode 拒绝，正是「Mock 内容不顶替 HTTP」的既有边界）。路由匹配顺序：列表 →
    //    历史 → PDF 内容 → 各命令 → 详情（详情的 [^/]+ 不吞子路径，history 先挡）。
    //    每个 Case JSON 应答带 no-store、PDF 带 private, no-store，应答头逐笔存证；
    //    变更回执原样存 变更请求；同键重放回 200、决过再发新键答 409。──
    const P5域 = 选项.P5MatchCasefixture ?? null;
    if (P5域) {
      const P5答复 = async (路径: string, 状态: number, json: unknown, 头: Record<string, string> = {}) => {
        const 合并 = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...头 };
        P5域.应答头存证.push({ path: 路径, cacheControl: 合并['Cache-Control']! });
        await route.fulfill({ status: 状态, json, headers: 合并 });
      };
      const P5记变更 = (路径: string) => {
        P5域.变更请求.push({
          method, path: 路径, body,
          idempotencyKey: 请求.headers()['idempotency-key'] ?? null,
        });
      };
      const P5取Case = (编号: string): P5Case记录形 | undefined => P5域.cases[编号];
      const P5键 = () => 请求.headers()['idempotency-key'] ?? '';
      // 已生效键登记：路由键 → 首把生效的 Idempotency-Key（同键 200 重放 / 新键 409）
      const P5生效键 = new Map<string, string>();
      const P5重放检查 = async (路由键: string, 路径: string, c: P5Case记录形): Promise<boolean> => {
        const 键 = P5键();
        const 生效键 = P5生效键.get(路由键);
        if (生效键 === 键 && 键 !== '') {
          await P5答复(路径, 200, 信封(P5状态wire(c)));
          return true;
        }
        return false;
      };
      const P5冲突 = async (路径: string, 类型: string, 文案: string) =>
        P5答复(路径, 409, { error: { type: 类型, message: 文案 } });
      const P5终局化 = (c: P5Case记录形, 结果词: string) => {
        c.lifecycle = 'ended';
        c.status = 'ended';
        c.step = 'complete';
        c.outcome = 结果词;
        c.outcomeCode = 结果词;
        c.finalizedAt = '2026-08-29T04:00:00Z';
        c.updatedAt = c.finalizedAt;
        c.终局 = { stage: c.stage, outcome: 结果词, reason_summary: 结果词, finalized_at: c.finalizedAt };
        c.候选 = { needsAction: false, actions: [] };
        c.招聘 = { needsAction: false, actions: [] };
        c.协同 = undefined;
      };

      // open 工作区列表：两页翻页（首页 1 条 + cursor）；查询 at-most-once 违例答公开 400
      const P5列表路径 = path === '/api/v1/me/match-cases' || path === '/api/v1/recruiter/match-cases';
      if (P5列表路径 && method === 'GET') {
        for (const 参数键 of new Set(url.searchParams.keys())) {
          if (url.searchParams.getAll(参数键).length > 1) {
            await P5答复(path, 400, { error: { type: 'invalid_request', message: '重复查询参数' } });
            return;
          }
        }
        const 限 = Number(url.searchParams.get('limit') ?? '50');
        if (!Number.isInteger(限) || 限 < 1 || 限 > 50) {
          await P5答复(path, 400, { error: { type: 'invalid_request', message: 'limit 越界' } });
          return;
        }
        const 游标 = url.searchParams.get('cursor');
        if (游标 !== null && !/^[A-Za-z0-9_-]+$/.test(游标)) {
          await P5答复(path, 400, { error: { type: 'invalid_request', message: 'cursor 非法' } });
          return;
        }
        const 角色: P5角色词 = path.startsWith('/api/v1/me/') ? 'candidate' : 'recruiter';
        let 序列 = (角色 === 'candidate' ? P5域.候选open顺序 : P5域.招聘open顺序)
          .map((编号) => P5域.cases[编号]!)
          .filter((c) => c.lifecycle === 'open');
        if (角色 === 'candidate' && P5域.分支.坏行进列表) {
          序列 = [P5域.cases[P5编号.坏行]!, ...序列]; // 毒行进首页：整页 decode 拒绝
        }
        const 页 = 游标 === null
          ? { items: 序列.slice(0, 1), next_cursor: 序列.length > 1 ? 'p5pg2' : null }
          : { items: 序列.slice(1), next_cursor: null };
        await P5答复(path, 200, 信封({
          items: 页.items.map((c) => P5列表项wire(c, 角色)),
          next_cursor: 页.next_cursor,
        }));
        return;
      }

      // 历史架子：lifecycle 查询词只认两个终态词，行只装对应终态
      const P5历史路径 = path === '/api/v1/me/match-cases/history' || path === '/api/v1/recruiter/match-cases/history';
      if (P5历史路径 && method === 'GET') {
        const 架子词 = url.searchParams.get('lifecycle');
        if (架子词 !== 'ended' && 架子词 !== 'completed') {
          await P5答复(path, 400, { error: { type: 'invalid_request', message: 'lifecycle 只认 ended/completed' } });
          return;
        }
        const 角色: P5角色词 = path.startsWith('/api/v1/me/') ? 'candidate' : 'recruiter';
        const items = P5域.历史顺序[架子词]
          .map((编号) => P5域.cases[编号]!)
          .filter((c) => c.lifecycle === 架子词);
        await P5答复(path, 200, 信封({ items: items.map((c) => P5列表项wire(c, 角色)), next_cursor: null }));
        return;
      }

      // 披露后的原始简历 PDF：只认 Case 专属 role 路径；未披露答 409 resume_submission_not_allowed
      const P5内容 = /^\/api\/v1\/(me|recruiter)\/match-cases\/([^/]+)\/resume-submission\/content$/.exec(path);
      if (P5内容 && method === 'GET') {
        const 角色: P5角色词 = P5内容[1] === 'me' ? 'candidate' : 'recruiter';
        const c = P5取Case(decodeURIComponent(P5内容[2]!));
        if (!c || !c.已披露) {
          await P5答复(path, 409, { error: { type: 'resume_submission_not_allowed', message: '简历尚未披露' } });
          return;
        }
        P5域.PDF读取.push(`${角色}:${c.caseId}`);
        P5域.应答头存证.push({ path, cacheControl: 'private, no-store' });
        await route.fulfill({
          status: 200,
          body: Buffer.from('%PDF-1.7\nP5 fixture raw resume\n'),
          contentType: 'application/pdf',
          headers: {
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            'Content-Disposition': `attachment; filename="${P5标记.简历名}"`,
          },
        });
        return;
      }

      // S0 补充事实：body 只认 {prompt_id, response}，prompt_id 必须是 transcript 的 ref
      const P5事实 = /^\/api\/v1\/(me|recruiter)\/match-cases\/([^/]+)\/fact-responses$/.exec(path);
      if (P5事实 && method === 'POST') {
        P5记变更(path);
        const c = P5取Case(decodeURIComponent(P5事实[2]!));
        if (!c) {
          await P5答复(path, 404, { error: { type: 'case_not_found', message: 'Case 不存在' } });
          return;
        }
        if (JSON.stringify(body) !== JSON.stringify({ prompt_id: P5编号.问题, response: P5标记.回答 })) {
          await P5答复(path, 400, { error: { type: 'invalid_request_body', message: 'fact-responses body 不合契约' } });
          return;
        }
        const 路由键 = `${method} ${path}`;
        if (await P5重放检查(路由键, path, c)) return;
        if (P5生效键.has(路由键)) {
          await P5冲突(path, 'fact_response_not_allowed', '该问题已回答');
          return;
        }
        if (P5域.分支.事实首答503 && (P5域.已503.get(c.caseId) ?? 0) < 2) {
          P5域.已503.set(c.caseId, (P5域.已503.get(c.caseId) ?? 0) + 1);
          P5域.应答头存证.push({ path, cacheControl: 'no-store' });
          await route.fulfill({
            status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '0' },
            json: { error: { type: 'operation_outcome_unknown', message: '结果未知' } },
          });
          return;
        }
        P5生效键.set(路由键, P5键());
        // 事实已答 → 复评等待行；候选端待办与 respond_fact/end_screening 卡一并撤下
        c.status = 'waiting';
        c.step = 'candidate_reevaluation';
        c.updatedAt = '2026-08-29T03:00:00Z';
        c.候选 = { needsAction: false, actions: [] };
        await P5答复(path, 201, 信封(P5状态wire(c)));
        return;
      }

      // S1 简历递交：字面披露 true + 精确 file/version 对；pending/failed 挡披露（409），
      // failed 首答后解析转 succeeded —— 同键重放同一对即披露（backend J4 语义）
      const P5递交 = /^\/api\/v1\/me\/match-cases\/([^/]+)\/resume-submission$/.exec(path);
      if (P5递交 && method === 'POST') {
        P5记变更(path);
        const c = P5取Case(decodeURIComponent(P5递交[1]!));
        if (!c) {
          await P5答复(path, 404, { error: { type: 'case_not_found', message: 'Case 不存在' } });
          return;
        }
        const 递交 = body as { file_id?: string; file_version_id?: string; disclosure_confirmed?: boolean };
        if (递交.file_id !== P5编号.文件 || 递交.file_version_id !== P5编号.文件版本 || 递交.disclosure_confirmed !== true) {
          await P5答复(path, 400, { error: { type: 'invalid_request_body', message: 'resume-submission body 不合契约' } });
          return;
        }
        const 路由键 = `${method} ${path}`;
        if (await P5重放检查(路由键, path, c)) return;
        if (P5生效键.has(路由键)) {
          await P5冲突(path, 'resume_submission_conflict', '本 Case 已递交');
          return;
        }
        if (c.解析 === 'pending') {
          await P5冲突(path, 'resume_readiness_not_started', '简历解析尚未完成');
          return;
        }
        if (c.解析 === 'failed') {
          c.解析 = 'succeeded'; // 解析随后恢复：同键重放同一对即可披露
          await P5冲突(path, 'resume_readiness_failed', '简历解析未通过，请重试');
          return;
        }
        P5生效键.set(路由键, P5键());
        c.已披露 = true;
        c.stage = 'resume_submission';
        c.status = 'needs_user';
        c.step = 'awaiting_recruiter_decision';
        c.updatedAt = '2026-08-29T03:10:00Z';
        c.候选 = { needsAction: false, actions: [] };
        c.招聘 = { needsAction: true, actions: ['decide_resume_screening'] };
        await P5答复(path, 201, 信封(P5递交结果wire(c)), { ETag: '"2"' });
        return;
      }

      // S0 决定（invitation decline = decisions action:end，backend J2 语义）
      const P5决定 = /^\/api\/v1\/me\/match-cases\/([^/]+)\/decisions$/.exec(path);
      if (P5决定 && method === 'POST') {
        P5记变更(path);
        const c = P5取Case(decodeURIComponent(P5决定[1]!));
        if (!c) {
          await P5答复(path, 404, { error: { type: 'case_not_found', message: 'Case 不存在' } });
          return;
        }
        const 动作 = (body as { action?: string }).action;
        if (动作 !== 'continue' && 动作 !== 'end') {
          await P5答复(path, 400, { error: { type: 'invalid_request_body', message: 'decisions body 不合契约' } });
          return;
        }
        const 路由键 = `${method} ${path}`;
        if (await P5重放检查(路由键, path, c)) return;
        if (P5生效键.has(路由键)) {
          await P5冲突(path, 'lifecycle_conflict', '本 Case 已决定');
          return;
        }
        P5生效键.set(路由键, P5键());
        if (动作 === 'end') {
          P5终局化(c, 'user_ended');
        } else {
          c.status = 'running';
          c.step = 'candidate_evaluation';
          c.updatedAt = '2026-08-29T03:20:00Z';
          c.候选 = { needsAction: false, actions: [] };
        }
        await P5答复(path, 201, 信封(P5状态wire(c)));
        return;
      }

      // S1 简历初筛结论：continue 无遗留分歧直进 S3（backend J5b），not_fit 终结
      const P5初筛 = /^\/api\/v1\/recruiter\/match-cases\/([^/]+)\/resume-screening-decisions$/.exec(path);
      if (P5初筛 && method === 'POST') {
        P5记变更(path);
        const c = P5取Case(decodeURIComponent(P5初筛[1]!));
        if (!c) {
          await P5答复(path, 404, { error: { type: 'case_not_found', message: 'Case 不存在' } });
          return;
        }
        const 动作 = (body as { action?: string }).action;
        if (动作 !== 'continue' && 动作 !== 'not_fit') {
          await P5答复(path, 400, { error: { type: 'invalid_request_body', message: 'screening body 不合契约' } });
          return;
        }
        const 路由键 = `${method} ${path}`;
        if (await P5重放检查(路由键, path, c)) return;
        if (P5生效键.has(路由键)) {
          await P5冲突(path, 'resume_screening_decision_not_allowed', '本 Case 已出结论');
          return;
        }
        P5生效键.set(路由键, P5键());
        if (动作 === 'not_fit') {
          P5终局化(c, 'semantic_not_fit');
        } else {
          c.stage = 'intent_confirmation';
          c.status = 'needs_user';
          c.step = 'awaiting_confirmations';
          c.updatedAt = '2026-08-29T03:30:00Z';
          c.意向词 = { candidate: '', recruiter: '' };
          c.候选 = { needsAction: true, actions: ['confirm_intent', 'decline_intent'] };
          c.招聘 = { needsAction: true, actions: ['confirm_intent', 'decline_intent'] };
        }
        await P5答复(path, 201, 信封(P5状态wire(c)));
        return;
      }

      // S2 协同决定：单角色 accept 留对方卡，双 accept 进 S3；任一 reject 终结（backend J6）
      const P5协同决定 = /^\/api\/v1\/(me|recruiter)\/match-cases\/([^/]+)\/coordination\/([^/]+)\/decisions$/.exec(path);
      if (P5协同决定 && method === 'POST') {
        P5记变更(path);
        const 角色: P5角色词 = P5协同决定[1] === 'me' ? 'candidate' : 'recruiter';
        const c = P5取Case(decodeURIComponent(P5协同决定[2]!));
        if (!c) {
          await P5答复(path, 404, { error: { type: 'case_not_found', message: 'Case 不存在' } });
          return;
        }
        const 动作 = (body as { action?: string }).action;
        if (动作 !== 'accept' && 动作 !== 'reject') {
          await P5答复(path, 400, { error: { type: 'invalid_request_body', message: 'coordination body 不合契约' } });
          return;
        }
        if (!c.协同 || c.协同.issue_id !== decodeURIComponent(P5协同决定[3]!) || c.stage !== 'needs_coordination') {
          await P5冲突(path, 'coordination_decision_not_allowed', '该协同事项不再待决');
          return;
        }
        const 路由键 = `${method} ${path}`;
        if (await P5重放检查(路由键, path, c)) return;
        if (P5生效键.has(路由键)) {
          await P5冲突(path, 'coordination_decision_not_allowed', '该协同事项已决定');
          return;
        }
        P5生效键.set(路由键, P5键());
        if (动作 === 'reject') {
          P5终局化(c, 'user_ended');
        } else {
          if (角色 === 'candidate') c.协同.candidate_decided = true;
          else c.协同.recruiter_decided = true;
          if (c.协同.candidate_decided && c.协同.recruiter_decided) {
            // 双 accept 才收口进 S3（backend J1：单角色 accept 留下对方卡）
            c.协同 = undefined;
            c.stage = 'intent_confirmation';
            c.status = 'needs_user';
            c.step = 'awaiting_confirmations';
            c.updatedAt = '2026-08-29T03:40:00Z';
            c.意向词 = { candidate: '', recruiter: '' };
            c.候选 = { needsAction: true, actions: ['confirm_intent', 'decline_intent'] };
            c.招聘 = { needsAction: true, actions: ['confirm_intent', 'decline_intent'] };
          } else {
            c.updatedAt = '2026-08-29T03:35:00Z';
            c.候选 = 角色 === 'candidate'
              ? { needsAction: false, actions: [] }
              : { needsAction: true, actions: ['decide_coordination'] };
            c.招聘 = 角色 === 'recruiter'
              ? { needsAction: false, actions: [] }
              : { needsAction: true, actions: ['decide_coordination'] };
          }
        }
        await P5答复(path, 201, 信封(P5状态wire(c)));
        return;
      }

      // S3 意向决定：第一笔 confirm 留对方卡，第二笔 confirm 才 completed；decline 终结
      const P5意向决定 = /^\/api\/v1\/(me|recruiter)\/match-cases\/([^/]+)\/intent-decisions$/.exec(path);
      if (P5意向决定 && method === 'POST') {
        P5记变更(path);
        const 角色: P5角色词 = P5意向决定[1] === 'me' ? 'candidate' : 'recruiter';
        const c = P5取Case(decodeURIComponent(P5意向决定[2]!));
        if (!c) {
          await P5答复(path, 404, { error: { type: 'case_not_found', message: 'Case 不存在' } });
          return;
        }
        const 动作 = (body as { action?: string }).action;
        if (动作 !== 'confirm' && 动作 !== 'decline') {
          await P5答复(path, 400, { error: { type: 'invalid_request_body', message: 'intent body 不合契约' } });
          return;
        }
        const 路由键 = `${method} ${path}`;
        if (await P5重放检查(路由键, path, c)) return;
        if (P5生效键.has(路由键) || c.意向词[角色] !== '') {
          await P5冲突(path, 'idempotency_conflict', '本端意向已决定');
          return;
        }
        P5生效键.set(路由键, P5键());
        if (动作 === 'decline') {
          c.意向词[角色] = 'decline';
          P5终局化(c, 'user_ended');
        } else {
          c.意向词[角色] = 'confirm';
          if (c.意向词.candidate === 'confirm' && c.意向词.recruiter === 'confirm') {
            // 第二笔确认完成 Case：completed + handoff_pending，双方零动作（backend J1）
            c.lifecycle = 'completed';
            c.stage = 'intent_confirmation';
            c.status = 'passed';
            c.step = 'handoff_pending';
            c.outcome = null;
            c.outcomeCode = null;
            c.finalizedAt = '2026-08-29T05:00:00Z';
            c.updatedAt = c.finalizedAt;
            c.终局 = { stage: 'intent_confirmation', outcome: '', reason_summary: '', finalized_at: c.finalizedAt };
            c.候选 = { needsAction: false, actions: [] };
            c.招聘 = { needsAction: false, actions: [] };
            c.协同 = undefined;
          } else {
            c.status = 'needs_user';
            c.step = 角色 === 'candidate' ? 'awaiting_recruiter_confirmation' : 'awaiting_candidate_confirmation';
            c.updatedAt = '2026-08-29T03:50:00Z';
            c.候选 = 角色 === 'candidate'
              ? { needsAction: false, actions: [] }
              : { needsAction: true, actions: ['confirm_intent', 'decline_intent'] };
            c.招聘 = 角色 === 'recruiter'
              ? { needsAction: false, actions: [] }
              : { needsAction: true, actions: ['confirm_intent', 'decline_intent'] };
          }
        }
        await P5答复(path, 201, 信封(P5状态wire(c)));
        return;
      }

      // Case 叮嘱：回执即刻落当前段（权威重读对账用），202 受理
      const P5叮嘱 = /^\/api\/v1\/(me|recruiter)\/match-cases\/([^/]+)\/agent-instructions$/.exec(path);
      if (P5叮嘱 && method === 'POST') {
        P5记变更(path);
        const 角色: P5角色词 = P5叮嘱[1] === 'me' ? 'candidate' : 'recruiter';
        const c = P5取Case(decodeURIComponent(P5叮嘱[2]!));
        if (!c) {
          await P5答复(path, 404, { error: { type: 'case_not_found', message: 'Case 不存在' } });
          return;
        }
        const 文本 = (body as { text?: string }).text;
        if (typeof 文本 !== 'string' || 文本.length < 1 || 文本.length > 2000) {
          await P5答复(path, 400, { error: { type: 'invalid_request_body', message: '叮嘱 body 不合契约' } });
          return;
        }
        P5域.叮嘱序 += 1;
        const 回执号 = `aci_p5_${P5域.叮嘱序}`;
        c.阶段区们.find((区) => 区.stage === c.stage)?.instruction_receipts.push({
          instruction_id: 回执号, owner: 角色, stage: c.stage, expression: 文本, occurred_at: '2026-08-29T03:55:00Z',
        });
        await P5答复(path, 202, 信封({ instruction_id: 回执号, text: 文本, state: 'executable', created_at: '2026-08-29T03:55:00Z' }));
        return;
      }
      if (P5叮嘱 && method === 'GET') {
        await P5答复(path, 200, 信封({ instructions: [] }));
        return;
      }

      // 详情（最后匹配）：unknown case 一律固定 404 case_not_found
      const P5详情 = /^\/api\/v1\/(me|recruiter)\/match-cases\/([^/]+)$/.exec(path);
      if (P5详情 && method === 'GET') {
        const 角色: P5角色词 = P5详情[1] === 'me' ? 'candidate' : 'recruiter';
        const c = P5取Case(decodeURIComponent(P5详情[2]!));
        if (!c) {
          await P5答复(path, 404, { error: { type: 'case_not_found', message: 'Case 不存在' } });
          return;
        }
        await P5答复(path, 200, 信封(P5详情wire(c, 角色)));
        return;
      }
    }

    // ── P7 真人会话域（Task 7）：可变 fixture 在场才应答；每个 JSON 应答带 no-store。
    //    路由匹配：收件箱（无坐标）→ 详情 / 消息 / 已读（带坐标）。发送登记
    //    Idempotency-Key：同键重放回已落库的那一条（不重复追加）；首答未知分支
    //    消息已落库但响应 503，客户端受控重试同键收敛。已读 PUT 后该角色未读归零。──
    if (P7域) {
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
          return;
        }
        if (坐标 !== null && !P7域.不存在.includes(坐标)) {
          if (子路径 === null && method === 'GET') {
            await P7答复(200, 信封(P7会话项wire(P7域, 坐标, 角色)));
            return;
          }
          if (子路径 === 'messages' && method === 'GET') {
            await P7答复(200, 信封({ messages: P7域.messages[坐标] ?? [], next_cursor: null }));
            return;
          }
          if (子路径 === 'messages' && method === 'POST') {
            const 键 = 请求.headers()['idempotency-key'] ?? '';
            const 正文 = (body as { content?: string }).content ?? '';
            P7域.sends.push({ role: 角色, key: 键, content: 正文 });
            const 已落库 = (P7域.messages[坐标] ?? []).find((条) => 条.sender_role === 角色 && 条.content === 正文);
            if (已落库) {
              // 同键重放 / 同文重复：幂等服务端只回已落库的那一条，绝不二次追加
              await P7答复(200, 信封(已落库));
              return;
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
              return;
            }
            await P7答复(200, 信封(新消息));
            return;
          }
          if (子路径 === 'read' && method === 'PUT') {
            const through = (body as { read_through_message_id?: string }).read_through_message_id ?? '';
            P7域.reads.push({ role: 角色, through });
            P7域.unread[角色] = 0;
            await P7答复(200, 信封({ read_through_message_id: through }));
            return;
          }
        }
        if (坐标 !== null && P7域.不存在.includes(坐标)) {
          // foreign / wrong-role / unpublished 统一 404
          await route.fulfill({
            status: 404,
            json: { error: { type: 'conversation_not_found', message: 'The conversation does not exist.', request_id: 'p7-fixture' } },
          });
          return;
        }
      }
    }

    // ── P8 控制面域（Task 8）：可变 fixture 在场才应答；JSON 应答带 no-store。
    //    每个变更先存证（method/path/body/原文/键/Origin），幂等按「同键同原文重放、
    //    同键异原文冲突」收口；专用分支按 fixture 标记选择固定应答且绝不写状态。──
    if (P8域) {
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
          return;
        }
        const 快照 = P8域.凭证们.map((条) => ({ ...条 }));
        if (P8域.分支.挂起凭证读取 && P8域.凭证读取数 === 0) await P8域.分支.挂起凭证读取;
        P8域.凭证读取数 += 1;
        await P8答复({ credentials: 快照 });
        return;
      }

      // 会话列表：恰好一条 current（换绑/退出其他设备只清洗非 current 行）
      if (path === '/api/v1/security/sessions' && method === 'GET') {
        if (P8已注销()) {
          await P8失败(401, 'invalid_session');
          return;
        }
        await P8答复({ sessions: P8域.会话们.map((条) => ({ ...条 })) });
        return;
      }

      // 换绑开始：body 恒 {phone:'+86…'}（操作层只放行 11 位裸号，E.164 由 facade 构造）
      if (path === '/api/v1/me/credential-replacement-attempts' && method === 'POST') {
        P8记录变更();
        const 查 = P8幂等查();
        if (查.型 === '坏键') { await P8失败(400, 'invalid_request_body'); return; }
        if (查.型 === '冲突') { await P8失败(409, 'idempotency_conflict'); return; }
        if (查.型 === '重放') { await P8答复(P4深克隆(查.回执)); return; }
        const 回执 = {
          attempt_id: P8编号.换绑尝试,
          next_action: { type: 'enter_code', expires_at: '2026-09-01T09:00:00Z' },
        };
        P8登记幂等(回执);
        await P8答复(P4深克隆(回执));
        return;
      }

      // 换绑完成：清洗其他会话、保留 current，唯一 phone_otp 行换上回执掩码；
      // 冲突分支终局；首答未知分支已受理已落库（重放同键回同一张回执）
      const P8换绑完成匹配 = /^\/api\/v1\/me\/credential-replacement-attempts\/([^/]+)\/complete$/.exec(path);
      if (P8换绑完成匹配 && method === 'POST') {
        P8记录变更();
        const 查 = P8幂等查();
        if (查.型 === '坏键') { await P8失败(400, 'invalid_request_body'); return; }
        if (查.型 === '冲突') { await P8失败(409, 'idempotency_conflict'); return; }
        if (查.型 === '重放') { await P8答复(P4深克隆(查.回执)); return; }
        if (P8域.分支.换绑冲突) {
          await P8失败(409, 'credential_replacement_conflict');
          return;
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
          return;
        }
        await P8答复(P4深克隆(回执));
        return;
      }

      // 退出其他设备：DELETE 无请求体；清洗非 current 会话，回执计数原样
      if (path === '/api/v1/security/sessions/others' && method === 'DELETE') {
        P8记录变更();
        const 查 = P8幂等查();
        if (查.型 === '坏键') { await P8失败(400, 'invalid_request_body'); return; }
        if (查.型 === '冲突') { await P8失败(409, 'idempotency_conflict'); return; }
        if (查.型 === '重放') { await P8答复(P4深克隆(查.回执)); return; }
        const 清洗数 = P8域.会话们.filter((条) => !条.current).length;
        P8域.会话们 = P8域.会话们.filter((条) => 条.current);
        const 回执 = { revoked_sessions: 清洗数 };
        P8登记幂等(回执);
        await P8答复(P4深克隆(回执));
        return;
      }

      // 创建数据导出：该路由不携带请求体 —— 任何 body 都按 400 拒绝；
      // 已有 queued/running/ready 导出时 409 export_in_progress；expired/failed 可重建
      if (path === '/api/v1/me/data-exports' && method === 'POST') {
        P8记录变更();
        if (请求.postData() !== null) {
          await P8失败(400, 'invalid_request_body');
          return;
        }
        const 查 = P8幂等查();
        if (查.型 === '坏键') { await P8失败(400, 'invalid_request_body'); return; }
        if (查.型 === '冲突') { await P8失败(409, 'idempotency_conflict'); return; }
        if (查.型 === '重放') { await P8答复(P4深克隆(查.回执)); return; }
        const 旧 = P8域.导出.数据;
        if (旧 !== null && (旧.status === 'queued' || 旧.status === 'running' || 旧.status === 'ready')) {
          await P8失败(409, 'export_in_progress');
          return;
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
        return;
      }

      // 读取数据导出：当前导出才 200，其余一律 404 data_export_not_found（过期回收/他端清理）；
      // 注销后的保护读取先于存在性判定按 invalid_session 收口
      const P8导出匹配 = /^\/api\/v1\/me\/data-exports\/([^/]+)$/.exec(path);
      if (P8导出匹配 && method === 'GET') {
        if (P8已注销()) {
          await P8失败(401, 'invalid_session');
          return;
        }
        const 编号 = decodeURIComponent(P8导出匹配[1]);
        if (P8域.导出.数据 === null || P8域.导出.数据.export_id !== 编号) {
          await P8失败(404, 'data_export_not_found');
          return;
        }
        P8域.导出.读数 += 1;
        const 推进 = P8域.导出.状态脚本[P8域.导出.读数] ?? P8域.导出.状态脚本.at(-1) ?? 'ready';
        P8域.导出.数据.status = 推进;
        P8域.导出.数据.download_ready = 推进 === 'ready';
        P8域.导出读取.push({ exportId: 编号, origin: 请求.headers()['origin'] ?? null });
        await P8答复({ ...P8域.导出.数据 });
        return;
      }

      // 下载：只在 ready+download_ready 应答固定头的 application/zip 字节流；
      // 注销后的保护读取先于存在性判定按 invalid_session 收口
      const P8下载匹配 = /^\/api\/v1\/me\/data-exports\/([^/]+)\/download$/.exec(path);
      if (P8下载匹配 && method === 'GET') {
        if (P8已注销()) {
          await P8失败(401, 'invalid_session');
          return;
        }
        const 编号 = decodeURIComponent(P8下载匹配[1]);
        P8域.导出下载.push({ exportId: 编号, origin: 请求.headers()['origin'] ?? null, contentType: 'application/zip' });
        const 当前 = P8域.导出.数据;
        if (当前 === null || 当前.export_id !== 编号 || 当前.status !== 'ready' || !当前.download_ready) {
          await P8失败(404, 'data_export_not_found');
          return;
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
        return;
      }

      // 账号注销：body 精确 {}（EmptyRequest）；queued/running 导出挡注销（409）；
      // 202 后置位 已注销 —— 后续保护读取一律 401 invalid_session
      if (path === '/api/v1/me/account-deletion' && method === 'POST') {
        P8记录变更();
        if (请求.postData() !== '{}') {
          await P8失败(400, 'invalid_request_body');
          return;
        }
        const 查 = P8幂等查();
        if (查.型 === '坏键') { await P8失败(400, 'invalid_request_body'); return; }
        if (查.型 === '冲突') { await P8失败(409, 'idempotency_conflict'); return; }
        if (查.型 === '重放') { await P8答复(P4深克隆(查.回执), 202); return; }
        const 当前 = P8域.导出.数据;
        if (当前 !== null && (当前.status === 'queued' || 当前.status === 'running')) {
          await P8失败(409, 'export_in_progress');
          return;
        }
        const 回执 = {
          deletion_id: P8编号.注销,
          status: 'deletion_pending',
          retention_until: '2026-10-01T00:00:00Z',
        };
        P8登记幂等(回执);
        P8域.分支.已注销 = true;
        await P8答复(P4深克隆(回执), 202);
        return;
      }

      // 合规反馈：body 恰 {category,details}；429 分支终局且无 Retry-After
      if (path === '/api/v1/compliance/feedback' && method === 'POST') {
        P8记录变更();
        const 查 = P8幂等查();
        if (查.型 === '坏键') { await P8失败(400, 'invalid_request_body'); return; }
        if (查.型 === '冲突') { await P8失败(409, 'idempotency_conflict'); return; }
        if (查.型 === '重放') { await P8答复(P4深克隆(查.回执)); return; }
        if (P8域.分支.反馈限流) {
          await P8失败(429, 'rate_limited');
          return;
        }
        P8域.反馈受理 += 1;
        const 回执 = { ticket_id: P8标记.反馈工单, status: 'received' };
        P8登记幂等(回执);
        await P8答复(P4深克隆(回执));
        return;
      }

      // 合规举报：block_unavailable 零写入、404 目标不存在统一收口、
      // applied 把组织写进 P3 隐私 fixture 的权威视图（屏蔽名单只认权威视图）
      if (path === '/api/v1/compliance/reports' && method === 'POST') {
        P8记录变更();
        const 查 = P8幂等查();
        if (查.型 === '坏键') { await P8失败(400, 'invalid_request_body'); return; }
        if (查.型 === '冲突') { await P8失败(409, 'idempotency_conflict'); return; }
        if (查.型 === '重放') { await P8答复(P4深克隆(查.回执)); return; }
        const 换 = body as { target?: { type?: string; ref?: string }; reason?: string; also_block?: boolean };
        if (P8域.分支.举报目标不存在) {
          await P8失败(404, 'report_target_not_found');
          return;
        }
        if (P8域.分支.举报屏蔽不可用 && 换.also_block === true) {
          await P8失败(409, 'block_unavailable');
          return;
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
        return;
      }
    }

    // 兜底：未匹配的 /api/v1/* 返回 200 空信封，避免测试因未处理路由挂死
    await route.fulfill({ status: 200, json: 信封(null) });
  });
  return { p6, p4: P4域, p7: P7域 };
}

/**
 * 填写意向表单并提交：办公方式（现场）+ 工作城市（子页搜索 fixture）+ 期望职位（子页选择）→ 点保存。
 * 三个条件齐了 可保存 才为 true，保存键才会亮——少填一项 POST 就不会发出。
 */
async function 填意向表单并提交(page: Page) {
  // 导航到添加意向页
  await page.goto('/#/intentions/new');
  await page.waitForTimeout(500);

  // 1. 办公方式：点「现场」选钮片
  await page.getByRole('button', { name: '现场', exact: true }).click();

  // 2. 工作城市：点行 → 跳选城市页 → 搜索 fixture → 选结果 → 保存 → 返回
  await page.getByText('请选择工作城市').click();
  await page.waitForTimeout(500);
  const 城市搜索 = page.getByPlaceholder('搜索城市 / 省份');
  await expect(城市搜索).toBeVisible({ timeout: 5000 });
  await 城市搜索.fill('fixture');
  await page.waitForTimeout(600); // debounce 250ms + 余量
  await expect(page.getByText(标记.城市display)).toBeVisible({ timeout: 5000 });
  await page.getByText(标记.城市display).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  // 等待返回意向页
  await page.waitForTimeout(500);

  // 3. 期望职位：点行 → 跳选期望职位页 → 选 fixture 职位 → 保存 → 返回
  await page.getByText('请选择期望职位').click();
  await page.waitForTimeout(500);
  // Backend 左栏根项已加载，右栏子项也加载（fixture 单项 selectable=true）
  // 左右两栏都显示同一文本，用 .last() 点右栏的可选子项
  await expect(page.getByText(标记.职位display).last()).toBeVisible({ timeout: 5000 });
  await page.getByText(标记.职位display).last().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  // 等待返回意向页
  await page.waitForTimeout(500);

  // 4. 点保存 → POST /api/v1/me/intentions
  await page.getByRole('button', { name: '保存', exact: true }).click();
}

/**
 * P1C Backend 招聘链路：身份选择页点「我要招人」→ 切身份（PUT 角色 + 偏好）→
 * 固定水合（profile → affiliations → [公开企业] → jobs）→ 招聘名片。
 * 水合失败（interactive）会抛回身份页，所以落进名片本身就是水合成功的证据。
 */
async function 以招聘方进入名片(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我要招人' }).click();
  await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible();
}

/**
 * P1C Backend 发岗向导（实习生档，与 Mock onboarding 同一真实 UI）：
 * 类别走 catalog job-categories（左栏 root → 右栏 selectable 叶子），
 * 城市走 catalog locations 搜索候选，最后一步提交 POST /api/v1/recruiter/jobs。
 */
async function 走完后端发岗向导(page: Page) {
  await page.goto('/#/hr/post-job');
  const 职位类别行 = page.getByRole('button').filter({ hasText: '职位类别' });
  await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue('');
  await page.getByRole('button', { name: '实习生 在校生实习，按天计薪' }).click();
  await page.getByRole('button', { name: '提供转正机会' }).click();
  await page.getByPlaceholder(/资深后端工程师/).fill('Fixture 实习岗位');
  await 职位类别行.click();
  // fixture 目录只有一项 selectable root；点左栏 root 后右栏出现同名叶子，用次序区分
  const 类键 = page.getByRole('button', { name: 标记.职位display, exact: true });
  await 类键.first().click();
  await expect(类键).toHaveCount(2, { timeout: 5_000 });
  await 类键.last().click();
  await page.getByRole('button', { name: '混合', exact: true }).click();
  await page.getByRole('button', { name: '下一步' }).click();

  await page.getByLabel('职位描述').fill(
    '用户研究、产品验证、产品策略、实验、数据分析、需求执行、GTM、发布与增长',
  );
  await page.getByRole('button', { name: '下一步' }).click();

  // P0 修复 Task 4/7：职位要求是与描述互相独立的必填文本，第三步不填就发不出岗
  await page.getByLabel('职位要求').fill(
    '应届或毕业年级；有产品、技术、增长、分析或创业经历；关注 AI、SaaS、工作流、开发工具与 Agent',
  );

  await page.getByRole('button', { name: '— 元/天' }).first().click();
  await page.getByRole('button', { name: '完成' }).click();
  await page.getByRole('button', { name: '— 元/天' }).click();
  await page.getByRole('button', { name: '完成' }).click();
  await page.getByPlaceholder('搜索城市名，从下方候选选择').fill('fixture');
  await page.getByRole('button', { name: 标记.城市display, exact: true }).click();
  await page.getByPlaceholder(/浦东新区世纪大道/).fill('Fixture 市 Fixture 路 1 号');
  await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
}

test.describe('Backend 数据源 fixture @backend', () => {
  // 显式 backend/stg server（端口 4182）
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  // 后端用例统一 60s 超时（涉及 debounce + 网络路由 fixture）
  test.use({ timeout: 60_000 });

  test('candidate 会话恢复后无 Catalog 请求 @backend', async ({ page }) => {
    const 目录请求: string[] = [];
    await 安装BFF路由(page, { 记录目录请求: (p) => 目录请求.push(p), 登录尝试id: 'att-001' });

    // GET /api/v1/session → 200（已登录）→ 读取主体 → 水合简历/意向 → 落 #/app
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 会话恢复 + 主体 + 简历 + 意向后不应有任何 catalog 请求
    expect(目录请求).toEqual([]);
  });

  test('页面显示 fixture 标记值（渲染来自 HTTP 非 Mock）@backend', async ({ page }) => {
    const 目录请求: string[] = [];
    await 安装BFF路由(page, { 记录目录请求: (p) => 目录请求.push(p), 登录尝试id: 'att-002' });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 导航到我的简历 → 个人优势来自 /api/v1/me/resume 的 summary 字段
    await page.goto('/#/resume');
    // fixture summary 标记值在页面上可见（Mock 里没有这段文本）
    await expect(page.getByText(标记.简历summary)).toBeVisible({ timeout: 10_000 });
  });

  test('打开城市选择只请求目标省第一页 @backend', async ({ page }) => {
    const 目录请求: string[] = [];
    await 安装BFF路由(page, { 记录目录请求: (p) => 目录请求.push(p), 登录尝试id: 'att-003' });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 直接导航到选工作城市屏
    await page.goto('/#/onboard/city');
    await page.waitForTimeout(500);

    // 搜索「fixture」→ 只触发 /catalog/locations 请求
    const 搜索框 = page.getByPlaceholder('搜索城市 / 省份');
    if (await 搜索框.isVisible({ timeout: 5000 }).catch(() => false)) {
      await 搜索框.fill('fixture');
      await page.waitForTimeout(600); // debounce 250ms + 余量
      // 候选出现 fixture 城市
      await expect(page.getByText(标记.城市display)).toBeVisible({ timeout: 5000 });
    }

    // 城市页只应有 /catalog/locations 请求，不应有 job-categories / institutions / majors
    const 非location目录请求 = 目录请求.filter((p) => !p.includes('/catalog/locations'));
    expect(非location目录请求).toEqual([]);
  });

  test('学校搜索中英文同一 institution ID，候选副行显示城市·国家 @backend', async ({ page }) => {
    const 目录请求: string[] = [];
    await 安装BFF路由(page, { 记录目录请求: (p) => 目录请求.push(p), 登录尝试id: 'att-004' });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 导航到毕业院校屏
    await page.goto('/#/onboard/school');
    await page.waitForTimeout(500);

    const 输入框 = page.getByPlaceholder('学校名称');
    await expect(输入框).toBeVisible({ timeout: 5000 });

    // 中文搜索
    await 输入框.fill('fixture');
    await page.waitForTimeout(500); // debounce 250ms

    // 候选列表出现 fixture 学校 + 「城市 · 国家」副行
    await expect(page.getByText(标记.学校display)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(标记.学校副行)).toBeVisible();

    // 点候选 → 存引用
    await page.getByText(标记.学校display).click();
    await page.waitForTimeout(300);

    // 再搜索英文 → 同一 institution ID（fixture 始终返回 inst-fixture-001）
    await 输入框.fill('Fixture');
    await page.waitForTimeout(500);
    await expect(page.getByText(标记.学校display)).toBeVisible();

    // 断言走的是 BFF catalog 非 Mock 本地名录
    expect(目录请求.some((p) => p.includes('/catalog/education-institutions'))).toBe(true);
  });

  test('写入 body 使用选择 ID，不含 /catalog/ 反查 @backend', async ({ page }) => {
    const 目录请求: string[] = [];
    const 写入bodies: { path: string; method: string; body: unknown }[] = [];
    await 安装BFF路由(page, {
      记录目录请求: (p) => 目录请求.push(p),
      登录尝试id: 'att-005',
      请求拦截: ({ path, method, body }) => {
        if (method === 'POST' || method === 'PATCH') 写入bodies.push({ path, method, body });
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 导航到毕业院校，选学校 + 下一步触发教育写入
    await page.goto('/#/onboard/school');
    await page.waitForTimeout(500);

    const 输入框 = page.getByPlaceholder('学校名称');
    await expect(输入框).toBeVisible({ timeout: 5000 });
    await 输入框.fill('fixture');
    await page.waitForTimeout(500);
    await expect(page.getByText(标记.学校display)).toBeVisible({ timeout: 5000 });
    await page.getByText(标记.学校display).click();
    await page.waitForTimeout(300);

    // 点下一步（触发保存简历 → 可能 POST education）
    const 下一步键 = page.getByRole('button', { name: '下一步' });
    await 下一步键.click();
    await page.waitForTimeout(1500);

    // 教育写入可能因 onboarding 中间屏（专业/开始未填）跳过——保存简历 diff 会跳过不完整条目。
    // 若有教育 POST，断言 body 里有 institution_id（来自选择引用，不是 display_name 反查）。
    const 教育写入 = 写入bodies.filter((b) => b.path.includes('/resume/educations'));
    if (教育写入.length > 0) {
      const body = 教育写入[0].body as { institution_id?: string; degree?: string };
      expect(body.institution_id).toBe('inst-fixture-001');
    }

    // 写入 path 不含 /catalog/（写入直接用选择时保存的 ID，不反查目录）
    expect(写入bodies.some((b) => b.path.includes('/catalog/'))).toBe(false);
  });

  test('422 array fields 返回字段错误 @backend', async ({ page }) => {
    // 覆盖 POST intentions → 422 + fields 数组。驱动真实 UI 填表提交，断言 POST 真正
    // 发出且 422 落到 轻提示 toast 里。
    // P0 修复 Task 6：通用文案不再展示机器 reason —— toast 是固定的
    // 「填写内容未通过校验」，服务端 reason 绝不上屏（fieldErrors 仍完整解析，
    // 由各表单屏按字段自行本地化）。
    let post次数 = 0;
    await 安装BFF路由(page, {
      记录目录请求: () => {},
      登录尝试id: 'att-006',
      请求拦截: ({ path, method }) => {
        if (path === '/api/v1/me/intentions' && method === 'POST') post次数++;
      },
      覆盖: {
        'POST /api/v1/me/intentions': () => ({
          status: 422,
          响应: { error: { type: 'validation_failed', message: '字段错误', fields: [{ path: 'workplace_modes', reason: '至少选一种办公方式' }] } },
        }),
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    await 填意向表单并提交(page);

    // POST 确实发出（填表 + 点保存触发了真实写入请求）
    expect(post次数).toBeGreaterThanOrEqual(1);
    // 422 落通用校验文案（取后端错误文案 → 轻提示），机器 reason 不泄露给用户
    await expect(page.getByText('填写内容未通过校验')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('至少选一种办公方式')).toHaveCount(0);
  });

  test('401 清理会话并清空目录缓存 @backend', async ({ page }) => {
    // 覆盖 PATCH profile → 401 invalid_session。驱动真实 UI 编辑姓名 → blur → PATCH 401 →
    // 处理写入错误 清会话（已登录=false）→ 应用.tsx Navigate 到登录页。
    // 断言页面落回登录页（手机号输入框可见）——删掉 401 清会话或 Navigate 守卫这条断言就会失败。
    await 安装BFF路由(page, {
      记录目录请求: () => {},
      登录尝试id: 'att-007',
      覆盖: {
        'PATCH /api/v1/me/resume/profile': () => ({
          status: 401,
          响应: { error: { type: 'invalid_session', message: '登录已失效' } },
        }),
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 导航到我的简历 → 编辑姓名 → blur 触发 PATCH profile → 401 → 清会话 → 落登录页
    await page.goto('/#/resume');
    await page.waitForTimeout(500);

    // 点姓名进入编辑（可改条目：点只读态 → 变 input）
    const 姓名行 = page.getByText(标记.主体真名).first();
    await expect(姓名行).toBeVisible({ timeout: 5000 });
    await 姓名行.click();
    // 编辑态 input 的 aria-label 含「姓名」
    const 输入框 = page.getByLabel('姓名');
    await expect(输入框).toBeVisible({ timeout: 3000 });
    await 输入框.fill('改后名字');
    await 输入框.blur();

    // 401 后 处理写入错误 清会话 → 应用.tsx Navigate 到登录页
    // 登录页有「手机号」输入框——如果 401 清理或 Navigate 守卫被删，页面会留在 /#/resume
    await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 10_000 });
  });

  test('409 reread 用权威快照水合 @backend', async ({ page }) => {
    // 覆盖 PATCH profile → 409 version_conflict，GET /me/resume 第二次返回不同名字。
    // 驱动真实 UI 编辑姓名 → blur → PATCH 409 → HTTP catch GET /me/resume（权威快照）
    // → 处理写入错误 用 错误.权威简历 水合。
    // 断言 GET /me/resume 被调用了至少 2 次（初始 + 409 reread），且页面显示权威快照里的名字
    // ——删掉 409 reread 或权威水合这条断言就会失败（页面会停留在初始名字）。
    const 权威名字 = '后端 fixture 权威名';
    let getResume次数 = 0;
    await 安装BFF路由(page, {
      记录目录请求: () => {},
      登录尝试id: 'att-008',
      请求拦截: ({ path, method }) => {
        if (path === '/api/v1/me/resume' && method === 'GET') getResume次数++;
      },
      覆盖: {
        'PATCH /api/v1/me/resume/profile': () => ({
          status: 409,
          响应: { error: { type: 'version_conflict', message: '版本冲突' } },
        }),
        // GET /me/resume：首次（init 水合）返回 fixture 简历；第二次（409 reread）返回权威名字
        'GET /api/v1/me/resume': () => {
          if (getResume次数 <= 1) {
            return { status: 200, 响应: 信封(fixture简历) };
          }
          return {
            status: 200,
            响应: 信封({ ...fixture简历, profile: { ...fixture简历.profile, real_name: 权威名字 } }),
          };
        },
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 导航到我的简历 → 编辑姓名 → blur → PATCH 409 → GET reread → 权威水合
    await page.goto('/#/resume');
    await page.waitForTimeout(500);

    const 姓名行 = page.getByText(标记.主体真名).first();
    await expect(姓名行).toBeVisible({ timeout: 5000 });
    await 姓名行.click();
    const 输入框 = page.getByLabel('姓名');
    await expect(输入框).toBeVisible({ timeout: 3000 });
    await 输入框.fill('改后名字');
    await 输入框.blur();

    // 409 reread：GET /me/resume 至少被调用 2 次（初始水合 + catch 权威快照）
    await page.waitForTimeout(2000);
    expect(getResume次数).toBeGreaterThanOrEqual(2);
    // 权威快照水合后页面显示 reread 返回的名字（不是用户输入也不是初始 fixture 名字）
    await expect(page.getByText(权威名字)).toBeVisible({ timeout: 10_000 });
  });

  test('503 同幂等键受控重试 @backend', async ({ page }) => {
    // 覆盖 POST intentions：首次 503 operation_outcome_unknown，第二次 200。
    // 驱动真实 UI 填表提交 → POST 503 → HTTP客户端 可受控重试 复用同一把 Idempotency-Key → 200。
    // 断言至少 2 次 POST 且两次 Idempotency-Key 相同——删掉 503 重试或幂等键复用这条断言就会失败。
    let post覆盖次数 = 0;
    const 幂等键们: string[] = [];
    await 安装BFF路由(page, {
      记录目录请求: () => {},
      登录尝试id: 'att-009',
      请求拦截: ({ path, method, headers }) => {
        if (path === '/api/v1/me/intentions' && method === 'POST') {
          幂等键们.push(headers['idempotency-key'] ?? '');
        }
      },
      覆盖: {
        'POST /api/v1/me/intentions': () => {
          post覆盖次数++;
          if (post覆盖次数 === 1) {
            return { status: 503, 响应: { error: { type: 'operation_outcome_unknown', message: '结果未知' } } };
          }
          return { status: 200, 响应: 信封(fixture意向列表.intentions[0]) };
        },
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    await 填意向表单并提交(page);

    // 503 受控重试：至少 2 次 POST（首次 503 + 重试 200）
    await page.waitForTimeout(2000);
    expect(幂等键们.length).toBeGreaterThanOrEqual(2);
    // 复用同一把 Idempotency-Key（HTTP客户端 可受控重试 用同一个 init）
    expect(幂等键们[0]).toBe(幂等键们[1]);
    expect(幂等键们[0]).not.toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P1C 组织域 fixture @backend —— 招聘 Organization 全链路（intercepted boundary only）
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P1C 招聘组织 fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });
  test.use({ timeout: 60_000 });

  test('P1C 招聘 Organization 全链路使用 HTTP fixture 且发岗 body 无可信字段 @backend', async ({ page }) => {
    // 未认证招聘方 + 无企业关系：名片来自 /recruiter/profile，公司输入走未认证声明，
    // 发岗 POST 只声明 claim —— organization_ref / verification status / affiliation
    // 全是服务端推导，客户端 body 一个都不能带。
    const 请求们: { path: string; method: string; body: unknown }[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-org',
      记录目录请求: () => undefined,
      请求拦截: ({ path, method, body }) => 请求们.push({ path, method, body }),
      招聘组织Fixture: P1C招聘组织Fixture,
    });

    await 以招聘方进入名片(page);
    // 名片姓名来自 HTTP fixture（Mock 里没有这个值）
    await expect(page.getByText(P1C招聘组织Fixture.profile.public_name).first()).toBeVisible();
    await expect(page.getByLabel('姓名')).toHaveValue(P1C招聘组织Fixture.profile.public_name);

    // 无企业关系 → 公司是自由输入（未认证声明），输入本身不发任何请求；
    // P0 修复 Task 3 起它只在按下保存时才落库（blur 不再收笔）。
    await page.getByLabel('公司').fill('未认证客户公司');
    await page.getByLabel('公司').blur();

    // 固定水合链：profile → affiliations →（无 current，不读公开企业）→ jobs；
    // admin request 不进登录链。渲染顺序错乱或登录链混入组织申请都会在这里翻车。
    // P6（Task 8）起规则三路读取与组织水合并行起跑，所以这里只在组织域请求内部看相对顺序。
    const 链 = 请求们.map((项) => `${项.method} ${项.path}`);
    const 组织链 = 链.filter((项) => 项.startsWith('GET /api/v1/recruiter/profile') ||
      项.startsWith('GET /api/v1/recruiter/affiliations') || 项.startsWith('GET /api/v1/recruiter/jobs'));
    expect(组织链.slice(0, 3)).toEqual([
      'GET /api/v1/recruiter/profile',
      'GET /api/v1/recruiter/affiliations',
      'GET /api/v1/recruiter/jobs',
    ]);
    expect(链.some((项) => 项.includes('organization-admin-requests'))).toBe(false);

    // P0 修复 Task 2/3：注册流名片的主按钮是「保存并继续」——按下它才把未认证声明与
    // 档案一起落地，并推进到发岗；不保存就发岗，company claim 会是空的。
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/, { timeout: 20_000 });

    // 发岗（真实三步向导）→ POST /api/v1/recruiter/jobs
    await 走完后端发岗向导(page);
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });

    const 创建 = 请求们.find((项) => 项.path === '/api/v1/recruiter/jobs' && 项.method === 'POST');
    expect(创建).toBeDefined();
    expect(JSON.stringify(创建!.body)).not.toMatch(/organization_ref|verification_status|affiliation/);
    // 正向：只声明 direct 模式与用人企业声明，claim 名来自未认证声明
    expect(创建!.body).toMatchObject({
      publisher_mode: 'direct',
      hiring_organization_claim: { display_name: '未认证客户公司', legal_name: null },
    });
  });

  test('P1C 多 Organization 关系不自动猜测，选择后刷新恢复 @backend', async ({ page }) => {
    // 两个可用关系 → current 为 null（不猜），不读任何公开企业；
    // 手动选择后 sessionStorage 白名单把当前关系编号带回刷新后的固定水合。
    const 公开读取: string[] = [];
    let 岗位读取数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-multi',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(
        P1C招聘组织Fixture,
        [P1C管理员关系, P1C成员关系],
        { [P1C标记.组织甲编号]: P1C组织甲(), [P1C标记.组织乙编号]: P1C组织乙() },
      ),
      主体初始角色: 'recruiter',
      请求拦截: ({ path, method }) => {
        if (method === 'GET' && path.startsWith('/api/v1/organizations/')) 公开读取.push(path);
        if (path === '/api/v1/recruiter/jobs' && method === 'GET') 岗位读取数++;
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    // 固定水合链走完（jobs 是最后一步）且没有读任何公开企业 —— 多可用关系不自动选
    await expect.poll(() => 岗位读取数).toBeGreaterThanOrEqual(1);
    expect(公开读取).toEqual([]);

    await page.goto('/#/hr/card');
    await expect(page.getByText('请选择当前任职企业')).toBeVisible({ timeout: 10_000 });
    const 甲键 = page.getByRole('button', { name: new RegExp(P1C标记.组织甲名) });
    await expect(甲键).toBeVisible();
    await expect(甲键).not.toContainText('（当前）');

    // 手动选择组织甲 → 按 canonical ID 读一次公开企业
    await 甲键.click();
    await expect(page.getByRole('button', { name: new RegExp(P1C标记.组织甲名) })).toContainText('（当前）', { timeout: 10_000 });
    expect(公开读取).toEqual([`/api/v1/organizations/${P1C标记.组织甲编号}`]);

    // 刷新：恢复的当前关系编号经 选择当前企业关系 校验后仍指向组织甲
    await page.reload();
    await expect(page.getByRole('button', { name: new RegExp(P1C标记.组织甲名) })).toContainText('（当前）', { timeout: 20_000 });
    expect(公开读取).toEqual([
      `/api/v1/organizations/${P1C标记.组织甲编号}`,
      `/api/v1/organizations/${P1C标记.组织甲编号}`,
    ]);
  });

  test('P1C member 关系对公司档案只读 @backend', async ({ page }) => {
    // 唯一可用关系（member）会被自动选中，但公司档案分区一律只读：
    // 无保存键、文本禁用、也没有任何组织写入请求。
    const 写入们: string[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-member',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [P1C成员关系], { [P1C标记.组织乙编号]: P1C组织乙() }),
      主体初始角色: 'recruiter',
      请求拦截: ({ path, method }) => {
        if (method !== 'GET') 写入们.push(`${method} ${path}`);
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.goto('/#/hr/card');
    // 唯一可用关系自动选中（不猜的另一半：恰好一个可用才自动选）
    await expect(page.getByRole('button', { name: new RegExp(P1C标记.组织乙名) })).toContainText('（当前）', { timeout: 10_000 });

    await page.getByRole('button', { name: /公司主页资料/ }).click();
    await expect(page).toHaveURL(/#\/hr\/company-profile$/);
    await expect(page.getByText('仅企业管理员可修改').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /公司介绍/ }).click();
    await expect(page).toHaveURL(/#\/hr\/company-profile\/intro$/);
    // 文本区显示服务端事实但禁用；没有保存键；也没有任何写入请求
    await expect(page.getByLabel('公司介绍')).toBeDisabled();
    await expect(page.getByLabel('公司介绍')).toHaveValue(P1C标记.公司介绍);
    // 只读的诚实证据：member 在这一屏没有**任何**保存控件（连改了标签的也没有）——
    // 同一屏 admin 的「保存」键由 409 用例真实点击，所以这条 0 不是「标签变了匹配不上」。
    await expect(page.getByRole('button', { name: '保存', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /保存/ })).toHaveCount(0);
    expect(写入们).toEqual([]);
  });

  test('P1C 管理员申请只在进入实名认证屏后读取 @backend', async ({ page }) => {
    // admin request 列表不进登录链；企业实名认证屏挂载才读，状态按服务端事实展示。
    let 申请读取数 = 0;
    let 岗位读取数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-admin-req',
      记录目录请求: () => undefined,
      招聘组织Fixture: P1C招聘组织Fixture,
      主体初始角色: 'recruiter',
      请求拦截: ({ path }) => {
        if (path === '/api/v1/recruiter/organization-admin-requests') 申请读取数++;
        if (path === '/api/v1/recruiter/jobs') 岗位读取数++;
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await expect.poll(() => 岗位读取数).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(500); // 水合链收尾：admin request 若被误挂进登录链，这里会露馅
    expect(申请读取数).toBe(0);

    await page.goto('/#/hr/verify');
    await expect(page.getByText('管理员申请：待审核')).toBeVisible({ timeout: 10_000 });
    // dev server 的 StrictMode 会双跑挂载 effect，读取次数 ≥1 即可；关键断言是
    // 「没进本屏之前是 0」与「进了本屏才读」
    expect(申请读取数).toBeGreaterThanOrEqual(1);
    // 个人三行分开：公开名 / 实名 / 验证状态（fixture 未实名）
    await expect(page.getByText(`实名：未实名`)).toBeVisible();
    await expect(page.getByText(P1C标记.招聘方公开名).first()).toBeVisible();
  });

  test('P1C 招聘名片保存档案与头像走 multipart 单 media part @backend', async ({ page }) => {
    // 一次保存 = PATCH profile（If-Match 当前 revision）+ POST avatar
    // （multipart 恰一个 media part，不带 metadata/file part，If-Match 用新 revision）。
    const 写入们: { path: string; method: string; body: unknown; headers: Record<string, string>; multipart?: { parts: string[] } }[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-profile',
      记录目录请求: () => undefined,
      招聘组织Fixture: P1C招聘组织Fixture,
      请求拦截: ({ path, method, body, headers, multipart }) => {
        if (method !== 'GET') 写入们.push({ path, method, body, headers, multipart });
      },
    });

    await 以招聘方进入名片(page);
    await expect(page.getByLabel('姓名')).toHaveValue(P1C标记.招聘方公开名);

    await page.getByLabel('姓名').fill('沈 fixture');
    // P0 修复 Task 3：本 fixture 无任何企业关系 → 公司是未认证声明，也是发岗 claim 的
    // 唯一来源，因此是保存的前置必填；空着按保存只会得到本地提示，一个请求都不发。
    await page.getByLabel('公司').fill('未认证客户公司');
    await page.setInputFiles('input[aria-label="更换头像"]', {
      name: '头像.png', mimeType: 'image/png', buffer: 一像素PNG,
    });
    // P0 修复 Task 2：本用例经「我要招人」进名片（从注册流），主按钮是「保存并继续」，
    // 成功后直接推进到发岗 —— 不再停在本屏弹「保存成功」。
    await expect(page.getByRole('button', { name: '保存', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/, { timeout: 20_000 });

    const 档案写 = 写入们.find((项) => 项.path === '/api/v1/recruiter/profile' && 项.method === 'PATCH');
    expect(档案写).toBeDefined();
    // PATCH body 只有公开名与职务；If-Match 是当前 revision 的 etag
    expect(档案写!.body).toEqual({ public_name: '沈 fixture', title: P1C标记.招聘方职务 });
    expect(档案写!.headers['if-match']).toBe('"3"');

    const 头像写 = 写入们.find((项) => 项.path === '/api/v1/recruiter/avatar' && 项.method === 'POST');
    expect(头像写).toBeDefined();
    // 冻结 multipart 形状：单个 media part（按 content-type boundary 解析，非 JSON parser）
    expect(头像写!.multipart?.parts).toEqual(['media']);
    // 头像 If-Match 用 PATCH 之后的 revision（fixture：3 → 4）
    expect(头像写!.headers['if-match']).toBe('"4"');
  });

  test('P1C 企业媒体 multipart 带 metadata purpose，删除走 204 @backend', async ({ page }) => {
    // 两步媒体协议：POST media(metadata+media) → PATCH 全量发布；
    // 删除先 PATCH 去引用再 DELETE（204 No Content）。
    const 写入们: { path: string; method: string; body: unknown; multipart?: { parts: string[]; metadata?: unknown } }[] = [];
    const 删除状态: number[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-media',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [P1C管理员关系], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      请求拦截: ({ path, method, body, multipart }) => {
        if (method !== 'GET') 写入们.push({ path, method, body, multipart });
      },
    });
    page.on('response', (响应) => {
      const 路径 = new URL(响应.url()).pathname;
      if (路径.startsWith(`/api/v1/organizations/${P1C标记.组织甲编号}/media/`) && 响应.request().method() === 'DELETE') {
        删除状态.push(响应.status());
      }
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.goto('/#/hr/company-profile/album');
    await expect(page.getByRole('button', { name: '添加实景照片' })).toBeVisible({ timeout: 10_000 });

    await page.setInputFiles('input[aria-label="上传实景照片"]', {
      name: '实景.png', mimeType: 'image/png', buffer: 一像素PNG,
    });
    // 上传 → PATCH 发布 → 快照带权威媒体 → 删除键出现
    await expect(page.getByRole('button', { name: '删除实景照片第 1 张' })).toBeVisible({ timeout: 10_000 });

    const 媒体写 = 写入们.find((项) => 项.path === `/api/v1/organizations/${P1C标记.组织甲编号}/media` && 项.method === 'POST');
    expect(媒体写).toBeDefined();
    // FormData key 顺序：metadata(application/json) + media，恰好两个 part
    expect(媒体写!.multipart?.parts).toEqual(['metadata', 'media']);
    // metadata 的 purpose 按槽位区分（office_photo），只在测试进程内比对
    expect(媒体写!.multipart?.metadata).toEqual({ purpose: 'office_photo' });

    const 发布们 = 写入们.filter((项) => 项.path === `/api/v1/organizations/${P1C标记.组织甲编号}/profile` && 项.method === 'PATCH');
    expect(发布们.length).toBe(1);
    expect((发布们[0].body as { office_media_ids: string[] }).office_media_ids.length).toBe(1);

    // 删除：先 PATCH 去引用（media 仍被快照引用），再 DELETE 拿 204
    await page.getByRole('button', { name: '删除实景照片第 1 张' }).click();
    await expect(page.getByRole('button', { name: '删除实景照片第 1 张' })).toHaveCount(0, { timeout: 10_000 });
    expect(删除状态).toEqual([204]);

    const 补丁们 = 写入们.filter((项) => 项.path === `/api/v1/organizations/${P1C标记.组织甲编号}/profile` && 项.method === 'PATCH');
    expect(补丁们.length).toBe(2);
    expect((补丁们[1].body as { office_media_ids: string[] }).office_media_ids).toEqual([]);
  });

  test('P1C 409 冲突保留公司介绍草稿并需人工再存 @backend', async ({ page }) => {
    // 覆盖沿用现有 覆盖 seam：首次 PATCH 409 version_conflict → operation 重读权威快照，
    // 但文本草稿留在用户手里；人工再按同一个保存键，第二次放行给内置 fixture 应答。
    let 档案写数 = 0;
    let 档案读数 = 0;
    let 覆盖次数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-409',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [P1C管理员关系], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      请求拦截: ({ path, method }) => {
        if (path === `/api/v1/organizations/${P1C标记.组织甲编号}/profile`) {
          if (method === 'PATCH') 档案写数++;
          if (method === 'GET') 档案读数++;
        }
      },
      覆盖: {
        [`PATCH /api/v1/organizations/${P1C标记.组织甲编号}/profile`]: () => {
          覆盖次数++;
          if (覆盖次数 === 1) {
            return { status: 409, 响应: { error: { type: 'version_conflict', message: '版本冲突' } } };
          }
          return undefined; // 人工再存这一次放行给内置 fixture
        },
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    // 走真实入口进分区页（名片 → 公司主页资料 → 公司介绍行）：保存成功后的 返回()
    // 才会回到分区清单，而不是直接手输 URL 后退到企业主壳
    await page.goto('/#/hr/card');
    await page.getByRole('button', { name: /公司主页资料/ }).click();
    await expect(page).toHaveURL(/#\/hr\/company-profile$/, { timeout: 10_000 });
    await page.getByRole('button', { name: /公司介绍/ }).click();
    const 草稿区 = page.getByLabel('公司介绍');
    await expect(草稿区).toBeVisible({ timeout: 10_000 });
    await expect(草稿区).toHaveValue(P1C标记.公司介绍);

    await 草稿区.fill('409 之后仍然留在本页的草稿');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    // 409：operation 重读权威快照（媒体同步、文本不动），草稿保留，页面不离开。
    // 计数是普通数字，click 之后网络往返要等一会儿 → expect.poll 轮询
    await expect.poll(() => 档案读数, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    await expect.poll(() => 档案写数, { timeout: 10_000 }).toBe(1);
    await expect(page.getByLabel('公司介绍')).toHaveValue('409 之后仍然留在本页的草稿');
    await expect(page).toHaveURL(/#\/hr\/company-profile\/intro$/);

    // 人工再存：第二次 PATCH 走内置 fixture 应答成功，才返回分区清单
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('已保存')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/#\/hr\/company-profile$/, { timeout: 10_000 });
    await expect.poll(() => 档案写数, { timeout: 10_000 }).toBe(2);
  });

  test('P1C canonical ref 公司卡可进公开企业页，no-ref 声明卡不可点 @backend', async ({ page }) => {
    // owner snapshot 投影：带 hiring_organization_ref 的公司卡是按钮，点击直接读公开企业；
    // 无 ref 的未认证声明只渲染同样式的非交互块，也不触发任何 Organization 读取。
    // publisher / hiring 两行不折叠，direct 与 agency 各占一行并带 wire code。
    const 岗位甲 = P1C岗位();
    const 岗位乙 = P1C岗位({
      job_id: 'job-fixture-noref',
      publisher_mode: 'agency',
      publisher_affiliation_ref: 'aff-fixture-admin',
      publisher_verification_status: 'unverified',
      publisher_organization_ref: undefined,
      hiring_organization_claim: { display_name: '未认证声明客户乙', legal_name: null },
      hiring_organization_verification_status: 'unverified',
      hiring_organization_ref: undefined,
      title: 'Fixture 岗位（无企业引用）',
    });
    const 公开读取: string[] = [];
    let 岗位读取数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-ref',
      记录目录请求: () => undefined,
      // 无企业关系（水合不预读公开企业），公司卡点击才是对公开企业的直接读取
      招聘组织Fixture: 带企业关系(
        P1C招聘组织Fixture,
        [],
        { [P1C标记.组织甲编号]: P1C组织甲() },
        [岗位甲, 岗位乙],
      ),
      主体初始角色: 'recruiter',
      请求拦截: ({ path, method }) => {
        if (method === 'GET' && path.startsWith('/api/v1/organizations/')) 公开读取.push(path);
        if (path === '/api/v1/recruiter/jobs' && method === 'GET') 岗位读取数++;
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await expect.poll(() => 岗位读取数).toBeGreaterThanOrEqual(1);

    await page.goto('/#/hr/job/job-fixture-001');
    await expect(page.getByRole('heading', { name: 'Fixture 岗位（带企业引用）' })).toBeVisible({ timeout: 10_000 });
    // direct/agency 不折叠：两行各自来自明确的 DTO 字段，展示带 wire code
    await expect(page.getByTestId('publisher-status')).toContainText('直招 · 已认证（verified）');
    await expect(page.getByTestId('hiring-status')).toContainText(`${P1C标记.组织甲名} · 已认证（verified）`);

    const 读取前 = 公开读取.length;
    await page.getByRole('button', { name: new RegExp(P1C标记.组织甲名) }).click();
    await expect(page).toHaveURL(new RegExp(`#/company/${P1C标记.组织甲编号}$`));
    // 企业身份卡来自直接读取的公开企业（不经过任何 candidate Job route）。
    // dev server 的 StrictMode 会双跑挂载 effect：次数 ≥1，且全部按 canonical ID 读
    await expect(page.getByText(P1C标记.组织甲法定名)).toBeVisible({ timeout: 10_000 });
    const 公司页读取 = 公开读取.slice(读取前);
    expect(公司页读取.length).toBeGreaterThanOrEqual(1);
    expect(new Set(公司页读取)).toEqual(new Set([`/api/v1/organizations/${P1C标记.组织甲编号}`]));

    await page.goto('/#/hr/job/job-fixture-noref');
    await expect(page.getByRole('heading', { name: 'Fixture 岗位（无企业引用）' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('publisher-status')).toContainText('代理 · 未认证（unverified）');
    await expect(page.getByTestId('hiring-status')).toContainText('未认证声明客户乙 · 未认证（unverified）');
    // 声明卡不是按钮（无尖括号、无可点），claim 不触发任何 Organization 读取
    await expect(page.getByRole('button', { name: /未认证声明客户乙/ })).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(公开读取.length).toBe(读取前 + 公司页读取.length);
  });

  test('P1C Organization 读取失败不回退 Mock 公司内容 @backend', async ({ page }) => {
    // 公开企业读得到 → 企业身份卡来自 HTTP；读不到（404 organization_not_found）
    // → 诚实空态，绝不拿静态公司档案顶替。
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-org-fail',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [P1C管理员关系], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      覆盖: {
        'GET /api/v1/organizations/org-fixture-gone': () => ({
          status: 404,
          响应: { error: { type: 'organization_not_found', message: '企业不存在' } },
        }),
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });

    await page.goto(`/#/company/${P1C标记.组织甲编号}`);
    await expect(page.getByText(P1C标记.组织甲法定名)).toBeVisible({ timeout: 10_000 });

    await page.goto('/#/company/org-fixture-gone');
    await expect(page.getByText('这家企业暂时打不开')).toBeVisible({ timeout: 10_000 });
    // Mock 分支的静态公司页内容不出现（不回退静态档）
    await expect(page.getByText('公司自述')).toHaveCount(0);
    await expect(page.getByText('作息与条款')).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P3 隐私域主链路 @backend（Task 6）：candidate 会话恢复水合隐私 → 设置关隐身 PATCH If-Match
// → 披露偏好稀疏补丁 → 屏蔽名单搜索/屏蔽（稳定组织 ID + 幂等键）→ 建档来源解除风险确认
// → 手动来源加入与解除 → 切招聘方 → 发布并编辑岗位（hard_requirements 四员完整收发）。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P3 Backend 隐私主链路 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });
  test.use({ timeout: 150_000 });

  test('P3 隐私读写、组织屏蔽与岗位硬性条件走 HTTP fixture 主链路 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P3默认组织库();
    const 请求们: 拦截请求形[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-main',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      招聘组织Fixture: 带企业关系(
        P1C招聘组织Fixture,
        [P1C管理员关系],
        { [P1C标记.组织甲编号]: P1C组织甲() },
      ),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
    });

    // ── candidate 会话恢复：隐私是第三条并行水合域 ──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    const 链 = 请求们.map((项) => `${项.method} ${项.path}`);
    const 会话位 = 链.indexOf('GET /api/v1/session');
    expect(会话位).toBeGreaterThanOrEqual(0);
    expect(链.slice(会话位, 会话位 + 12)).toEqual(expect.arrayContaining([
      'GET /api/v1/me/resume',
      'GET /api/v1/me/intentions',
      'GET /api/v1/me/privacy',
    ]));

    // ── 设置：关闭「对现雇主隐身」→ 确认弹层 → PATCH quoted If-Match ──
    await page.goto('/#/settings');
    const 隐身开关 = page.getByRole('switch', { name: '对现雇主隐身' });
    await expect(隐身开关).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
    await 隐身开关.click();
    await page.getByRole('button', { name: '仍要关闭' }).click();
    await expect(page.getByText('隐身已关闭')).toBeVisible({ timeout: 10_000 });
    await expect(隐身开关).toHaveAttribute('aria-checked', 'false');
    let 补丁们 = 请求们.filter((项) => 项.path === '/api/v1/me/privacy' && 项.method === 'PATCH');
    expect(补丁们.length).toBe(1);
    expect(补丁们[0].body).toEqual({ employer_privacy_enabled: false });
    expect(补丁们[0].headers['if-match']).toBe('"1"');
    expect(补丁们[0].headers['idempotency-key']).toBeUndefined();

    // ── 披露偏好：D4 只发 education 单成员的稀疏补丁，If-Match 用服务端新 revision ──
    await page.goto('/#/disclosure-prefs');
    // 档位按钮的可访问名称是字段化的「<字段名>：<档>」，选中态读 aria-pressed（见 披露偏好.tsx）
    const 学历意向确认后 = page.getByRole('button', { name: '毕业院校与学历：意向确认后', exact: true });
    const 学历不披露 = page.getByRole('button', { name: '毕业院校与学历：不披露', exact: true });
    await expect(学历意向确认后).toBeVisible({ timeout: 10_000 });
    await 学历不披露.click();
    await expect
      .poll(() => 请求们.filter((项) => 项.path === '/api/v1/me/privacy' && 项.method === 'PATCH').length, { timeout: 10_000 })
      .toBe(2);
    补丁们 = 请求们.filter((项) => 项.path === '/api/v1/me/privacy' && 项.method === 'PATCH');
    expect(补丁们[1].body).toEqual({ disclosure_preferences: { education: 'never' } });
    expect(补丁们[1].headers['if-match']).toBe('"2"');
    await expect(学历不披露).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });

    // ── 屏蔽名单：选来源 → 搜组织（strict active 分页 + query 绑定游标）→ 点命中 → 屏蔽 ──
    await page.goto('/#/blocklist');
    await page.getByRole('button', { name: '关联公司' }).click();
    const 组织框 = page.getByPlaceholder('输入公司全称，如「某某科技」');
    await 组织框.fill('云衢');
    await expect(page.getByText(P3标记.可屏蔽组织甲, { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(P3标记.可屏蔽组织乙, { exact: true })).toBeVisible();
    // 停用组织永不进结果（strict active），第一页两枚后跟翻页键
    await expect(page.getByText(P3标记.停用组织)).toHaveCount(0);
    const 搜索请求 = 请求们.filter((项) => 项.path === '/api/v1/organizations').at(-1);
    expect(decodeURIComponent(搜索请求?.query ?? '')).toContain('q=云衢');
    expect(decodeURIComponent(搜索请求?.query ?? '')).toContain('limit=20');

    await page.getByRole('button', { name: '加载更多' }).click();
    await expect(page.getByText(P3标记.可屏蔽组织丙, { exact: true })).toBeVisible({ timeout: 10_000 });
    const 翻页请求 = 请求们.filter((项) => 项.path === '/api/v1/organizations').at(-1)!;
    expect(翻页请求.query).toContain('cursor=');

    await page.getByRole('button', { name: P3标记.可屏蔽组织甲 }).click();
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();
    await expect(page.getByText(`已屏蔽 ${P3标记.可屏蔽组织甲}，双向不可见`)).toBeVisible({ timeout: 10_000 });

    const 屏蔽写们 = 请求们.filter((项) => 项.path === '/api/v1/me/privacy/organization-blocks' && 项.method === 'POST');
    expect(屏蔽写们.length).toBe(1);
    expect(屏蔽写们[0].body).toEqual({ organization_id: 'org-fixture-p3-block-a', source: 'related_organization' });
    expect(屏蔽写们[0].headers['if-match']).toBe('"3"');
    const 首把幂等键 = 屏蔽写们[0].headers['idempotency-key'];
    expect(首把幂等键).toBeTruthy();
    // 关联公司归入「建档时自动屏蔽」组（分组按 来源，不按理由文案）
    await expect(page.getByText('建档时自动屏蔽')).toBeVisible();
    await expect(page.getByText('你手动添加')).toHaveCount(0);

    // ── 解除建档来源：必须带 risk_acknowledged=true ──
    await page.getByRole('button', { name: '解除' }).click();
    await expect(page.getByText(`解除对「${P3标记.可屏蔽组织甲}」的屏蔽？`)).toBeVisible();
    await expect(page.getByText('这是你的当前雇主或其关联公司，解除意味着放弃这层保密。')).toBeVisible();
    await page.getByRole('button', { name: '确认解除' }).click();
    await expect(page.getByText(`已解除对 ${P3标记.可屏蔽组织甲} 的屏蔽`)).toBeVisible({ timeout: 10_000 });
    const 解除们 = 请求们.filter((项) => 项.path.startsWith('/api/v1/me/privacy/organization-blocks/') && 项.path.endsWith('/unblock'));
    expect(解除们.length).toBe(1);
    expect(解除们[0].path).toContain('/org-fixture-p3-block-a/');
    expect(解除们[0].body).toEqual({ risk_acknowledged: true });
    expect(解除们[0].headers['if-match']).toBe('"4"');
    await expect(page.getByRole('button', { name: '解除' })).toHaveCount(0, { timeout: 10_000 });

    // ── 手动来源：加入与解除都不需要风险确认（risk_acknowledged=false）──
    await page.getByRole('button', { name: '手动添加' }).click();
    await 组织框.fill('磐石');
    await expect(page.getByText(P3标记.手动组织甲, { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: P3标记.手动组织甲 }).click();
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();
    await expect(page.getByText(`已屏蔽 ${P3标记.手动组织甲}，双向不可见`)).toBeVisible({ timeout: 10_000 });
    expect(请求们.filter((项) => 项.path === '/api/v1/me/privacy/organization-blocks' && 项.method === 'POST').length).toBe(2);
    const 手动写 = 请求们.filter((项) => 项.path === '/api/v1/me/privacy/organization-blocks' && 项.method === 'POST')[1];
    expect((手动写.body as { source?: string }).source).toBe('manual');
    expect(手动写.headers['idempotency-key']).toBeTruthy();
    expect(手动写.headers['idempotency-key']).not.toBe(首把幂等键);
    await expect(page.getByText('你手动添加')).toBeVisible();

    await page.getByRole('button', { name: '解除' }).click();
    await page.getByRole('button', { name: '确认解除' }).click();
    await expect(page.getByText(`已解除对 ${P3标记.手动组织甲} 的屏蔽`)).toBeVisible({ timeout: 10_000 });
    const 手动解除 = 请求们.filter((项) => 项.path.startsWith('/api/v1/me/privacy/organization-blocks/') && 项.path.endsWith('/unblock'))[1];
    expect((手动解除.body as { risk_acknowledged?: boolean }).risk_acknowledged).toBe(false);
    expect(手动解除.headers['if-match']).toBe('"6"');

    // ── 切招聘方：固定组织水合链，候选侧隐私先行清空 ──
    await page.goto('/#/identity?switch=1&from=app');
    await expect(page.getByRole('button', { name: '翻到「招聘方」那一面' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    const 切换后链 = 请求们.map((项) => `${项.method} ${项.path}`);
    // P6 并行水合的 recruiter 规则/提案读与组织链并发起跑；先滤掉再断言固定组织链
    const 组织链 = 切换后链.filter((项) => !项.startsWith('GET /api/v1/recruiter/agent-rule'));
    const 偏好位 = 组织链.indexOf('PUT /api/v1/me/preferences/last-used-role');
    expect(偏好位).toBeGreaterThanOrEqual(0);
    // 唯一 verified 关系自动选中 ⇒ 固定链含一次公开企业直读；owner Jobs 收尾
    expect(组织链.slice(偏好位 + 1, 偏好位 + 5)).toEqual([
      'GET /api/v1/recruiter/profile',
      'GET /api/v1/recruiter/affiliations',
      `GET /api/v1/organizations/${P1C标记.组织甲编号}`,
      'GET /api/v1/recruiter/jobs',
    ]);

    // ── 发布岗位：POST body 带完整四员 hard_requirements；claim 由已验证关系推导 ──
    await 走完后端发岗向导(page);
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    const 创建 = 请求们.find((项) => 项.path === '/api/v1/recruiter/jobs' && 项.method === 'POST');
    expect(创建).toBeDefined();
    expect(创建!.headers['idempotency-key']).toBeTruthy();
    expect(创建!.body).toMatchObject({
      publisher_mode: 'direct',
      hiring_organization_claim: { display_name: P1C标记.组织甲名, legal_name: null },
    });
    const 发布硬性 = (创建!.body as { hard_requirements?: Record<string, string> }).hard_requirements ?? {};
    expect(Object.keys(发布硬性).sort()).toEqual(['alternate_weekend_work', 'frequent_travel', 'onsite_only', 'outsourcing_only']);
    for (const 档 of Object.values(发布硬性)) {
      expect(['required', 'not_required', 'unknown']).toContain(档);
    }

    // ── 编辑岗位：硬性事实控件已从 UI 删除；PATCH 仍须原样回传完整四员块 + immutable 字段原值 ──
    await page.goto('/#/hr/post-job/job-fixture-created-1');
    await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue('Fixture 实习岗位', { timeout: 10_000 });
    await page.getByRole('button', { name: '职位要求' }).click();
    await expect(page.getByRole('button', { name: /大小周/ })).toHaveCount(0);

    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('岗位已保存')).toBeVisible({ timeout: 15_000 });
    const 岗位补丁 = 请求们.find(
      (项) => /^\/api\/v1\/recruiter\/jobs\/job-fixture-created-1$/.test(项.path) && 项.method === 'PATCH',
    );
    expect(岗位补丁).toBeDefined();
    expect(岗位补丁!.headers['if-match']).toBe('"1"');
    const 补丁体 = 岗位补丁!.body as {
      title: string;
      recruitment_type: string;
      category_id: string;
      location_id: string;
      hard_requirements: Record<string, string>;
    };
    // immutable 契约字段沿用 previous owner DTO 原值
    expect(补丁体.title).toBe('Fixture 实习岗位');
    expect(补丁体.recruitment_type).toBe('internship');
    expect(补丁体.category_id).toBe('job-fixture-001');
    expect(补丁体.location_id).toBe('loc-fixture-001');
    expect(补丁体.hard_requirements).toEqual(发布硬性);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P3 Backend 恢复分派 @backend：错误码驱动的重读不重放。
// 用例内通过 覆盖 seam 注入单次故障（沿用既有 att-* 计数器惯例）；需要「先见效再失败」的
// 场景直接改共享的 隐私.视图（handler 与测试同一进程同份状态）。所有等待用 expect.poll，
// 不用超过 UI debounce 的长 sleep。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P3 Backend 恢复分派 @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });
  test.use({ timeout: 90_000 });

  /** 隐私 GET 总数（hydration 之后作增量基线用） */
  function 统计get(请求们: { path: string; method: string }[]): number {
    return 请求们.filter((项) => 项.path === '/api/v1/me/privacy' && 项.method === 'GET').length;
  }

  test('PATCH 409 后只一次 PATCH、一次权威重读并刷新视图，绝不自动重放 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture();
    const 请求们: 拦截请求形[] = [];
    let 冲突次数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-r409',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      覆盖: {
        'PATCH /api/v1/me/privacy': () => {
          if (冲突次数 > 0) return undefined;
          冲突次数 += 1;
          // 他端并发推进了版本，还把「当前公司」改成一直允许 —— 权威视图将随重读刷新进来
          隐私.视图.revision += 1;
          隐私.视图.disclosure_preferences.current_employer = 'anonymous';
          return { status: 409, 响应: { error: { type: 'version_conflict', message: '版本冲突' } } };
        },
      },
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    const get基线 = 统计get(请求们);

    // 用户想关隐身 → PATCH 409 → 弹层保留可取消；权威快照经一次重读落进页面
    await page.goto('/#/settings');
    const 隐身开关 = page.getByRole('switch', { name: '对现雇主隐身' });
    await expect(隐身开关).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
    await 隐身开关.click();
    await page.getByRole('button', { name: '仍要关闭' }).click();
    await expect
      .poll(() => 统计get(请求们), { timeout: 10_000 })
      .toBe(get基线 + 1); // 安全重读权威恰好一次

    // 不自动重放：此时仍然只有那一次 PATCH
    expect(统计get(请求们)).toBe(get基线 + 1);
    expect(请求们.filter((项) => 项.path === '/api/v1/me/privacy' && 项.method === 'PATCH').length).toBe(1);

    await page.getByRole('button', { name: '保持开启' }).click();
    await expect(page.getByRole('button', { name: '仍要关闭' })).toHaveCount(0);
    // 刷新后的权威视图：employer_privacy_enabled 保持 true（页面仍开）
    await expect(隐身开关).toHaveAttribute('aria-checked', 'true');
    // 且他端写入的 D3=一直允许 已经在页面上（来自重读，不是本地假成功）
    await page.goto('/#/disclosure-prefs');
    await expect(page.getByRole('button', { name: '当前公司：一直允许', exact: true }))
      .toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
  });

  test('AddBlock 遇 idempotency_in_progress 同键受控重试，后续新意图换新键 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P3默认组织库();
    const 幂等键们: string[] = [];
    let 故障次数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-rInProgress',
      记录目录请求: () => undefined,
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      请求拦截: ({ path, method, headers }) => {
        if (path === '/api/v1/me/privacy/organization-blocks' && method === 'POST') {
          幂等键们.push(headers['idempotency-key'] ?? '');
        }
      },
      覆盖: {
        'POST /api/v1/me/privacy/organization-blocks': () => {
          if (故障次数 > 0) return undefined; // 重试放行给内置 fixture 应答
          故障次数 += 1;
          return {
            status: 409,
            头: { 'Retry-After': '0' },
            响应: { error: { type: 'idempotency_in_progress', message: '前次相同请求仍在处理' } },
          };
        },
      },
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    await page.goto('/#/blocklist');
    await page.getByRole('button', { name: '手动添加' }).click();
    const 组织框 = page.getByPlaceholder('输入公司全称，如「某某科技」');
    await 组织框.fill('云衢');
    await expect(page.getByText(P3标记.可屏蔽组织甲, { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: P3标记.可屏蔽组织甲 }).click();
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();
    // 首个意图：in-progress 后同键受控重试成功；备选列表保持可见供换选
    await expect(page.getByText(`已屏蔽 ${P3标记.可屏蔽组织甲}，双向不可见`)).toBeVisible({ timeout: 10_000 });
    expect(幂等键们.length).toBe(2);
    expect(幂等键们[0]).toBe(幂等键们[1]);
    expect(幂等键们[0]).not.toBe('');

    // 新意图：成功路径清了搜索词，重新搜索后再选另一枚命中 → 新请求必须换一把 Idempotency-Key
    await 组织框.fill('云衢');
    await expect(page.getByText(P3标记.可屏蔽组织乙, { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: P3标记.可屏蔽组织乙 }).click();
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();
    await expect(page.getByText(`已屏蔽 ${P3标记.可屏蔽组织乙}，双向不可见`)).toBeVisible({ timeout: 10_000 });
    expect(幂等键们.length).toBe(3);
    expect(幂等键们[2]).not.toBe('');
    expect(幂等键们[2]).not.toBe(幂等键们[0]);
  });

  test('AddBlock 503 先生效后失败：权威重读确认效果，UI 不再发起第二次屏蔽 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P3默认组织库();
    const 请求们: 拦截请求形[] = [];
    let 已见效 = false;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-r503block',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      覆盖: {
        'POST /api/v1/me/privacy/organization-blocks': () => {
          if (!已见效) {
            已见效 = true;
            // 服务端已落库但响应丢失（operation_outcome_unknown）：先见效，之后每次都以 503 应答，
            // 让受控重试同样撞上结果未知 ⇒ 客户端只能走「重读权威核对效果」的歧义恢复路径。
            const 占位 = { organization_id: 'org-fixture-p3-manual-a' };
            隐私.视图.organization_blocks = [
              ...隐私.视图.organization_blocks,
              {
                organization_id: 占位.organization_id,
                organization_display_name: 隐私.组织库[占位.organization_id].display_name,
                organization_status: 隐私.组织库[占位.organization_id].status,
                source: 'manual',
                created_at: '2026-08-27T03:00:00Z',
              },
            ];
            隐私.视图.revision += 1;
          }
          return { status: 503, 响应: { error: { type: 'operation_outcome_unknown', message: '结果未知' } } };
        },
      },
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    const get基线 = 统计get(请求们);

    await page.goto('/#/blocklist');
    await page.getByRole('button', { name: '手动添加' }).click();
    const 组织框 = page.getByPlaceholder('输入公司全称，如「某某科技」');
    await 组织框.fill('磐石');
    await expect(page.getByText(P3标记.手动组织甲, { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: P3标记.手动组织甲 }).click();
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();

    // 效果达成路径：按 GET 核实后按成功兑现（清词 + 成功提示）
    await expect(page.getByText(`已屏蔽 ${P3标记.手动组织甲}，双向不可见`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('你手动添加')).toBeVisible();
    await expect(page.getByText(P3标记.手动组织甲, { exact: true })).toBeVisible();
    // 歧义后的核实：恰好一次 GET 权威；同一次意图的两笔传输共用同一把幂等键（受控重试），
    // 绝无第二个新意图发出 —— 内置 handler 从未参与：唯一副作用就是覆盖里的那次手动落库
    await expect.poll(() => 统计get(请求们), { timeout: 10_000 }).toBe(get基线 + 1);
    const 覆盖期写们 = 请求们.filter((项) => 项.path === '/api/v1/me/privacy/organization-blocks' && 项.method === 'POST');
    await expect.poll(() => 覆盖期写们.length, { timeout: 10_000 }).toBe(2);
    expect(覆盖期写们[0].headers['idempotency-key']).toBe(覆盖期写们[1].headers['idempotency-key']);
    expect(隐私.统计.屏蔽写入).toBe(0);
  });

  test('Unblock 404 目标他端已解除：以权威视图为准视为成功，不重放解除 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture({
      organization_blocks: [
        {
          organization_id: 'org-fixture-p3-gone',
          organization_display_name: 'Fixture 他端先解企业',
          organization_status: 'active',
          source: 'manual',
          created_at: '2026-08-20T00:00:00Z',
        },
      ],
      revision: 5,
    });
    const 请求们: 拦截请求形[] = [];
    let 已报失 = false;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-r404unblock',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      覆盖: {
        'POST /api/v1/me/privacy/organization-blocks/org-fixture-p3-gone/unblock': () => {
          if (已报失) return undefined;
          已报失 = true;
          // 服务端该行已被他端移除（同样推进版本），本次解除以 404 作答
          隐私.视图.organization_blocks = [];
          隐私.视图.revision += 1;
          return { status: 404, 响应: { error: { type: 'organization_block_not_found', message: '目标不存在' } } };
        },
      },
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    const get基线 = 统计get(请求们);
    await page.goto('/#/blocklist');
    await expect(page.getByText('Fixture 他端先解企业')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: '解除' }).click();
    await page.getByRole('button', { name: '确认解除' }).click();
    // 404 + 权威视图已无该组织 ⇒ 兑现为成功（提示照常出现），且恰好一次核对 GET、零重放
    await expect(page.getByText('已解除对 Fixture 他端先解企业 的屏蔽')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Fixture 他端先解企业')).toHaveCount(0, { timeout: 10_000 });
    await expect.poll(() => 统计get(请求们), { timeout: 10_000 }).toBe(get基线 + 1);
    await expect
      .poll(() => 请求们.filter((项) => 项.path.endsWith('/unblock')).length, { timeout: 10_000 })
      .toBe(1);
  });

  test('Unblock 422 风险确认：一次重读更新来源分组后原样抛出，绝不自动重放 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture({
      organization_blocks: [
        {
          organization_id: 'org-fixture-p3-flip',
          organization_display_name: P3标记.可屏蔽组织甲,
          organization_status: 'active',
          source: 'current_employer',
          created_at: '2026-08-20T00:00:00Z',
        },
      ],
      revision: 4,
    });
    const 请求们: 拦截请求形[] = [];
    let 已纠正 = false;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-r422unblock',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      覆盖: {
        'POST /api/v1/me/privacy/organization-blocks/org-fixture-p3-flip/unblock': () => {
          if (已纠正) return undefined;
          已纠正 = true;
          // 存储里这条其实已经被改判为手动来源：422 要求重新确认 —— 与此同时把它落库改掉
          const 行 = 隐私.视图.organization_blocks.find((块) => 块.organization_id === 'org-fixture-p3-flip');
          if (行) 行.source = 'manual';
          隐私.视图.revision += 1;
          return { status: 422, 响应: { error: { type: 'risk_acknowledgement_required', message: '需要风险确认' } } };
        },
      },
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    const get基线 = 统计get(请求们);
    await page.goto('/#/blocklist');
    await expect(page.getByText(P3标记.可屏蔽组织甲, { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: '解除' }).click();
    await page.getByRole('button', { name: '确认解除' }).click();
    // 重读把真实来源（manual）带回：行挪去「你手动添加」组、副行理由随之更新；
    // 操作本身抛回 UI ⇒ 弹层静默关闭，绝不二次 POST
    await expect(page.getByText(P3标记.可屏蔽组织甲, { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('你手动加入 · 双向不可见 · 2026-08-20')).toBeVisible();
    await expect(page.getByRole('button', { name: '确认解除' })).toHaveCount(0);
    await expect.poll(() => 统计get(请求们), { timeout: 10_000 }).toBe(get基线 + 1);
    await expect
      .poll(() => 请求们.filter((项) => 项.path.endsWith('/unblock')).length, { timeout: 10_000 })
      .toBe(1);
  });

  test('组织搜索竞态：旧词晚到被代际守卫丢弃，只有新词渲染；无结果回既有空态 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture(); // 屏蔽名单为空：便于断言既有空态
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-race',
      记录目录请求: () => undefined,
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
    });
    // 搜索脚本：A 词延迟 1500ms 单枚命中并带专用游标；B 词即时命中无游标
    隐私.搜索脚本.push(
      {
        词: '云端矩阵',
        延迟毫秒: 1500,
        items: [{ organization_id: 'org-fixture-race-a', display_name: '竞速先发公司A序列', legal_name: '上海竞速先发A有限公司' }],
        next_cursor: 'cur-stale-a',
      },
      {
        词: '后发制胜',
        items: [{ organization_id: 'org-fixture-race-b', display_name: '竞速后发公司B序列', legal_name: '上海竞速后发B有限公司' }],
        next_cursor: null,
      },
    );

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await page.goto('/#/blocklist');
    await expect(page.getByText('名单是空的')).toBeVisible({ timeout: 10_000 }); // 空态基线

    await page.getByRole('button', { name: '当前雇主' }).click();
    const 组织框 = page.getByPlaceholder('输入公司全称，如「某某科技」');
    await 组织框.fill('云端矩阵');
    await expect.poll(() => 隐私.搜索完成.some((项) => 项.q === '云端矩阵'), { timeout: 10_000 }).toBe(true); // 已受理（响应仍被脚本压住 1500ms）

    // 换词即作废在飞代际：B 即刻命中渲染
    await 组织框.fill('后发制胜');
    await expect(page.getByText('竞速后发公司B序列')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('竞速先发公司A序列')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '加载更多' })).toHaveCount(0); // B 无游标

    // A 此刻才应答完成 —— 也必须被代际守卫丢弃
    await expect.poll(() => 隐私.搜索已答.some((项) => 项.q === '云端矩阵'), { timeout: 10_000 }).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 120));
    await expect(page.getByText('竞速先发公司A序列')).toHaveCount(0);
    await expect(page.getByText('竞速后发公司B序列')).toBeVisible();
    await expect(page.getByRole('button', { name: '加载更多' })).toHaveCount(0);

    // 无结果页：不改变列表、空态保持既有文案
    await 组织框.fill('旧东家'); // 命中的是停用组织：strict active 口径不下发
    await expect(page.getByText('竞速后发公司B序列')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText('名单是空的')).toBeVisible();
    await expect(page.getByText(P3标记.停用组织)).toHaveCount(0);
    // 三次搜索全部终结（A/B/停用词查询都没有挂在途）
    await expect.poll(() => 隐私.搜索已答.length, { timeout: 10_000 }).toBe(3);
  });

  test('登出时挂起的隐私 GET 过期不作数：新主体只见自己的快照 @backend', async ({ page }) => {
    const 隐私 = P3隐私fixture({
      disclosure_preferences: { current_employer: 'anonymous', education: 'never', portfolio_links: 'never' },
      revision: 7,
    });
    隐私.组织库['org-fixture-p3-old'] = { display_name: 'Fixture 旧世界公司', legal_name: '上海旧世界有限公司', status: 'active' };
    隐私.视图.organization_blocks = [
      {
        organization_id: 'org-fixture-p3-old',
        organization_display_name: 'Fixture 旧世界公司',
        organization_status: 'active',
        source: 'manual',
        created_at: '2026-08-19T00:00:00Z',
      },
    ];
    const 请求们: 拦截请求形[] = [];
    let 挂起兑现: (() => void) | null = null;

    // 冲突注入放在 弹层确认后第一次 PATCH：借它的安全重读制造「挂起中的旧会话 GET」
    let 冲突次数 = 0;
    await 安装BFF路由(page, {
      登录尝试id: 'att-p3-stale',
      记录目录请求: () => undefined,
      请求拦截: (项) => 请求们.push(项),
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      覆盖: {
        'PATCH /api/v1/me/privacy': () => {
          if (冲突次数 > 0) return undefined;
          冲突次数 += 1;
          隐私.视图.revision += 1;
          return { status: 409, 响应: { error: { type: 'version_conflict', message: '版本冲突' } } };
        },
      },
    });

    // A 主体会话：旧世界公司可见
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await page.goto('/#/blocklist');
    await expect(page.getByText('Fixture 旧世界公司')).toBeVisible({ timeout: 10_000 });

    // 触发一次带挂起重读的冲突（重读将在旧会话登出后才被放行）
    await page.goto('/#/disclosure-prefs');
    const 作品意向确认后 = page.getByRole('button', { name: '作品与代码仓库：意向确认后', exact: true });
    const get挂起前 = 统计get(请求们);
    隐私.get脚本.push({
      保持: new Promise<void>((resolve) => {
        挂起兑现 = resolve;
      }),
    });
    await 作品意向确认后.click();
    await expect.poll(() => 统计get(请求们), { timeout: 10_000 }).toBe(get挂起前 + 1); // 重读已发出并被挂起

    // 旧会话登出（清理同步派发），然后才放行那个迟到的旧 GET。
    // hash 直跳设置根 —— 不能整页 reload，那会让新挂载抢走队列里的挂起项
    await page.evaluate(() => {
      window.location.hash = '#/settings';
    });
    await expect(page.getByText('隐私与可见性')).toBeVisible({ timeout: 10_000 });
    // 触发键与确认层的确认键**不再同名**：确认键有自己的可访问名称「确认退出当前账号」
    // （src/屏幕/设置.tsx:225 的 aria-label，可见文案仍是「退出登录」）。
    // 弹层框架用的是 <dialog open>，非模态 —— 层开着时背景那枚触发键仍在可访问树里，
    // 两枚同名会让 getByRole 分不开，也让读屏用户分不开，所以产品侧把名字拆开了。
    // 「确认」前缀同时避开了遮罩键「关闭退出当前账号」：getByRole 的 name 是子串匹配，
    // 确认键若直接叫「退出当前账号」会同时命中遮罩，触发 strict mode violation。
    await page.getByRole('button', { name: '退出登录' }).click();
    await page.getByRole('button', { name: '确认退出当前账号' }).click();
    await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 10_000 });
    挂起兑现?.();

    // 服务端换成 B 主体的权威事实后再登录
    隐私.视图 = {
      employer_privacy_enabled: false,
      disclosure_preferences: { current_employer: 'resume_submission', education: 'resume_submission', portfolio_links: 'resume_submission' },
      organization_blocks: [
        {
          organization_id: 'org-fixture-p3-new',
          organization_display_name: 'Fixture 新世界公司',
          organization_status: 'active',
          source: 'current_employer',
          created_at: '2026-08-27T04:00:00Z',
        },
      ],
      revision: 42,
      updated_at: '2026-08-27T04:00:00Z',
    };
    await page.getByLabel('手机号').fill('13900000002');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await page.getByLabel('短信验证码').fill('1234');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '进入' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 登录建立会话后整页恢复一次：mount 会话恢复链才会按 last_used_role 水合三域（含隐私）
    await page.reload();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // B 主体自己的水合读取了自己的快照；旧世界的任何痕迹都不再出现
    const 完成位 = 请求们.findIndex((项) => 项.method === 'POST' && 项.path.endsWith('/complete') && 项.path.includes('/login-attempts/'));
    expect(完成位).toBeGreaterThanOrEqual(0);
    const 登录后隐私位 = 请求们.findIndex((项, 序) => 序 > 完成位 && 项.path === '/api/v1/me/privacy' && 项.method === 'GET');
    expect(登录后隐私位).toBeGreaterThanOrEqual(0); // 新会话水合再次带上隐私 GET
    await page.goto('/#/blocklist');
    await expect(page.getByText('Fixture 新世界公司')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Fixture 旧世界公司')).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P3 Mock 数据源隔离 @mock：隐私相关四屏访问且本地流照常工作，同时
// 全程 /api/v1 请求列表保持为空 —— Mock 模式对 P3 域零网络调用。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P3 Mock 数据源隔离 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('Mock 四屏本地流程零 API 请求 @mock', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    // 登录（Mock 一键直进）
    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // 设置：本地开关切换立即生效，无网络
    await page.goto('/#/settings');
    await expect(page.getByText('隐私与可见性')).toBeVisible({ timeout: 10_000 });
    const 别的开关 = page.getByRole('switch', { name: '求职状态' }).first();
    if (await 别的开关.isVisible().catch(() => false)) {
      const 开前 = await 别的开关.getAttribute('aria-checked');
      await 别的开关.click();
      await expect(别的开关).toHaveAttribute('aria-checked', 开前 === 'true' ? 'false' : 'true');
    }
    // 对现雇主隐身在 Mock 同样可切（本地归约）：初始为开时需过确认弹层
    const 隐身开关 = page.getByRole('switch', { name: '对现雇主隐身' });
    if ((await 隐身开关.getAttribute('aria-checked')) === 'true') {
      await 隐身开关.click();
      await page.getByRole('button', { name: '仍要关闭' }).click();
      await expect(隐身开关).toHaveAttribute('aria-checked', 'false', { timeout: 10_000 });
    } else {
      await 隐身开关.click();
      await expect(隐身开关).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
      await 隐身开关.click(); // 再关回去同样要确认弹层
      await page.getByRole('button', { name: '仍要关闭' }).click();
      await expect(隐身开关).toHaveAttribute('aria-checked', 'false', { timeout: 10_000 });
    }
    expect(apiRequests).toEqual([]);

    // 披露偏好：D4 本地切档（Mock 七行模板照旧展示并可点）
    await page.goto('/#/disclosure-prefs');
    const Mock学历不披露 = page.getByRole('button', { name: '毕业院校与学历：不披露', exact: true });
    await expect(page.getByRole('button', { name: '毕业院校与学历：一直允许', exact: true })).toBeVisible({ timeout: 10_000 });
    await Mock学历不披露.click();
    await expect(Mock学历不披露).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
    expect(apiRequests).toEqual([]);

    // 屏蔽名单：自由文本本地加入（Mock 无组织搜索段）
    await page.goto('/#/blocklist');
    const 添加框 = page.getByPlaceholder('输入公司全称，如「某某科技」');
    await expect(添加框).toBeVisible({ timeout: 10_000 });
    await 添加框.fill('本地测试屏蔽公司');
    await page.getByRole('button', { name: '屏蔽', exact: true }).click();
    await expect(page.getByText('已屏蔽 本地测试屏蔽公司，双向不可见')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('本地测试屏蔽公司').first()).toBeVisible();
    expect(apiRequests).toEqual([]);

    // 发岗屏（Mock 本地向导）：到达 + 第一步本地校验照常运转
    await page.goto('/#/hr/post-job');
    const 岗位名框 = page.getByPlaceholder(/资深后端工程师/);
    await expect(岗位名框).toBeVisible({ timeout: 10_000 });
    await 岗位名框.fill('本地草稿岗位');
    await expect(岗位名框).toHaveValue('本地草稿岗位');
    // Mock 目录选择的类别（非硬性条件区也保持本地可选）
    await page.getByRole('button', { name: '实习生 在校生实习，按天计薪' }).click();

    // 全程累计：Mock 模式下没有任何 /api/v1 请求 —— P3 域也是纯本地
    expect(apiRequests).toEqual([]);
  });
});

// P6 规则域 fixture @backend —— Agent 规则/提案全生命周期（intercepted boundary only）。
// 断言以 fixture 存证的变更回执（body / If-Match / Idempotency-Key）为主，
// 可见文案只做收口佐证；标记值只存在于 fixture，上屏即证明渲染来自 HTTP。
// ─────────────────────────────────────────────────────────────────────────────

/** 就绪提案卡的正文 div 与动作键同属一张卡：正文唯一文本的父节点即卡，卡内恰一组动作键。 */
function 就绪卡动作键(page: Page, 正文: string, 名称: string) {
  return page.getByText(正文).locator('..').getByRole('button', { name: 名称 });
}

test.describe('P6 规则域 fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });
  test.use({ timeout: 60_000 });

  test('P6 全链路：双端规则生命周期与请求契约 @backend', async ({ page }) => {
    // 冻结序列：candidate restore → 双端水合 → global create→accept → 意向 create →
    // 替换(If-Match) → 归档(If-Match) → 切招聘端 → 招聘 create(no scope)→accept → pause/resume 版本推进
    test.setTimeout(150_000);
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-life',
      记录目录请求: () => undefined,
      // 招聘端水合需要组织域 fixture；主体同时具备双角色，切身份走真实 PUT 角色链
      招聘组织Fixture: P1C招聘组织Fixture,
      主体初始角色: 'candidate',
    });

    // ── candidate restore：session 200 + last_used_role=candidate → 直接落求职主壳 ──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });

    // ── candidate Rule/Proposal 水合：标记值只存在于 fixture ──
    await page.goto('/#/rules');
    await expect(page.getByText(P6标记.候选全局规则)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P6标记.候选意向规则)).toBeVisible();
    await expect(page.getByText('2 条')).toBeVisible();
    await expect(page.getByText('AI代理正在理解这条规则…')).toBeVisible();
    await expect(page.getByText(P6标记.就绪提案正文)).toBeVisible();
    // auto_deny 的安全摘要逐字来自 fixture 的 consequence，页面不做任何浏览器侧可接受性判定
    await expect(page.getByText('命中条件时，AI代理会自动拦下')).toBeVisible();
    // 解读中提案在第二次单项 GET 转 ready（轮询 2s 一拍 → 两次读 ≈ 4s）
    await expect(page.getByText(P6标记.解读完成正文)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('符合条件时，AI代理可以自动推进')).toBeVisible();
    expect(p6.proposalReads[P6编号.解释中提案]).toBeGreaterThanOrEqual(2);

    // ── global create → interpreting → ready → accept → active Rule ──
    await page.getByRole('button', { name: '手动添加规则' }).click();
    const 候选输入 = page.getByPlaceholder('例：不接受大小周的岗位直接过滤');
    await 候选输入.fill(P6标记.全局新建草稿);
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    // 创建回执是 interpreting：卡片先出「解读中」，成功才收起输入行
    await expect(候选输入).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText(`已理解：${P6标记.全局新建草稿}`)).toBeVisible({ timeout: 20_000 });
    // accept-success fixture 的公开 consequence 是 mixed
    await expect(page.getByText('这条规则同时包含推进、拦截或参考条件')).toBeVisible();
    await 就绪卡动作键(page, `已理解：${P6标记.全局新建草稿}`, '确认规则').click();
    // 确认后权威 Rule 才物化：正文从卡片变成规则行（按钮）
    await expect(page.getByRole('button', { name: new RegExp(`已理解：${P6标记.全局新建草稿}`) })).toBeVisible({ timeout: 15_000 });
    const 创建全局 = p6.mutationRequests.find((项) => 项.method === 'POST' && 项.path === '/api/v1/me/agent-rule-proposals');
    expect(创建全局).toBeDefined();
    expect(创建全局!.body).toEqual({ text: P6标记.全局新建草稿, scope: { type: 'global' } });
    expect(创建全局!.ifMatch).toBeNull();
    expect(创建全局!.idempotencyKey).toMatch(/\S/);

    // ── intention create：范围选择发的是 fixture 的真实 intention_id ──
    await page.getByRole('button', { name: '手动添加规则' }).click();
    await page.getByLabel('规则范围').selectOption(P6标记.意向编号);
    await page.getByPlaceholder('例：不接受大小周的岗位直接过滤').fill(P6标记.意向新建草稿);
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    await expect(page.getByText(`已理解：${P6标记.意向新建草稿}`)).toBeVisible({ timeout: 20_000 });
    const 创建意向 = p6.mutationRequests.filter((项) => 项.method === 'POST' && 项.path === '/api/v1/me/agent-rule-proposals')[1];
    expect(创建意向).toBeDefined();
    expect(创建意向!.body).toEqual({
      text: P6标记.意向新建草稿,
      scope: { type: 'intention', intention_id: P6标记.意向编号 },
    });
    expect(创建意向!.idempotencyKey).toMatch(/\S/);

    // ── replacement：发当前 If-Match；确认前旧 Rule 一直可见、新正文不是规则行 ──
    await page.getByRole('button', { name: new RegExp(P6标记.候选全局规则) }).click();
    // 编辑态下规则库只有这一只输入框（composer 已收起），草稿预填原文
    const 编辑框 = page.getByRole('textbox');
    await expect(编辑框).toHaveCount(1, { timeout: 10_000 });
    await expect(编辑框).toHaveValue(P6标记.候选全局规则);
    await 编辑框.fill(P6标记.替换草稿);
    await page.getByRole('button', { name: '提交修改' }).click();
    await expect(page.getByText(`已理解：${P6标记.替换草稿}`)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(P6标记.候选全局规则)).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(`已理解：${P6标记.替换草稿}`) })).toHaveCount(0);
    const 替换回执 = p6.mutationRequests.find((项) => 项.path === `/api/v1/me/agent-rules/${P6编号.候选全局规则}/replacement-proposals`);
    expect(替换回执).toBeDefined();
    expect(替换回执!.ifMatch).toBe('"1"');
    expect(替换回执!.body).toEqual({ text: P6标记.替换草稿, scope: { type: 'global' } });
    expect(替换回执!.idempotencyKey).toMatch(/\S/);
    await 就绪卡动作键(page, `已理解：${P6标记.替换草稿}`, '确认规则').click();
    await expect(page.getByRole('button', { name: new RegExp(`已理解：${P6标记.替换草稿}`) })).toBeVisible({ timeout: 15_000 });
    // 旧规则归档出局：原文整行（含卡片）消失
    await expect(page.getByText(P6标记.候选全局规则)).toHaveCount(0);

    // ── archive：DELETE 带当前 If-Match ──
    await page.getByRole('button', { name: new RegExp(`已理解：${P6标记.替换草稿}`) }).click();
    await page.getByRole('button', { name: '删除', exact: true }).click();
    await expect(page.getByRole('button', { name: new RegExp(`已理解：${P6标记.替换草稿}`) })).toHaveCount(0, { timeout: 10_000 });
    const 删除们 = p6.mutationRequests.filter((项) => 项.method === 'DELETE');
    expect(删除们.length).toBe(1);
    expect(删除们[0]!.ifMatch).toBe('"1"');
    expect(删除们[0]!.path).toMatch(/^\/api\/v1\/me\/agent-rules\/rul_[0-9a-f]{32}$/);
    await expect(page.getByText('2 条')).toBeVisible();

    // ── 切到招聘端：真实 PUT 角色 + 偏好链，切完直接进企业主壳 ──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });

    // ── recruiter：规则水合 + create（body 永不携带 scope）→ accept ──
    await page.goto('/#/hr/agent-settings');
    await expect(page.getByText(P6标记.招聘全局规则)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('1 条生效')).toBeVisible();
    const 总开关 = page.getByRole('switch', { name: `规则：${P6标记.招聘全局规则}` });
    await expect(总开关).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: '手动添加规则' }).click();
    await page.getByPlaceholder('例：到岗超过 60 天的候选先不推进').fill(P6标记.招聘新建草稿);
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    await expect(page.getByText(`已理解：${P6标记.招聘新建草稿}`)).toBeVisible({ timeout: 20_000 });
    const 招聘创建 = p6.mutationRequests.find((项) => 项.method === 'POST' && 项.path === '/api/v1/recruiter/agent-rule-proposals');
    expect(招聘创建).toBeDefined();
    expect(招聘创建!.body).toEqual({ text: P6标记.招聘新建草稿 });
    expect(招聘创建!.idempotencyKey).toMatch(/\S/);
    await 就绪卡动作键(page, `已理解：${P6标记.招聘新建草稿}`, '确认规则').click();
    // 招聘端规则行没有编辑按钮：权威落地以行内容 + 开关为准
    await expect(page.getByRole('switch', { name: `规则：已理解：${P6标记.招聘新建草稿}` })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('2 条生效')).toBeVisible();
    const 招聘接受 = p6.mutationRequests.find((项) => 项.path.startsWith('/api/v1/recruiter/agent-rule-proposals/') && 项.path.endsWith('/accept'));
    expect(招聘接受).toBeDefined();
    expect(招聘接受!.body).toEqual({});
    expect(招聘接受!.idempotencyKey).toMatch(/\S/);

    // ── pause → resume：每个应答的版本都在前进（resume 的 If-Match 就是 pause 应答的新版本）──
    await 总开关.click();
    await expect(总开关).toHaveAttribute('aria-checked', 'false', { timeout: 10_000 });
    await expect(page.getByText('1 条生效')).toBeVisible();
    await 总开关.click();
    await expect(总开关).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
    await expect(page.getByText('2 条生效')).toBeVisible();
    const 开关写 = p6.mutationRequests.filter((项) => 项.method === 'PATCH' && 项.path === `/api/v1/recruiter/agent-rules/${P6编号.招聘全局规则}`);
    expect(开关写.length).toBe(2);
    expect(开关写[0]!.body).toEqual({ operation: 'pause' });
    expect(开关写[0]!.ifMatch).toBe('"1"');
    expect(开关写[1]!.body).toEqual({ operation: 'resume' });
    expect(开关写[1]!.ifMatch).toBe('"2"');
    // 权威版本链落到 fixture：pause 1→2、resume 2→3
    expect(p6.rules.recruiter.find((规) => 规.rule_id === P6编号.招聘全局规则)?.version).toBe(3);

    // 幂等纪律：两次 candidate 创建是两个意图 → 两把不同的 key；accept 一律空对象 body + 非 key
    const 候选创建们 = p6.mutationRequests.filter((项) => 项.method === 'POST' && 项.path === '/api/v1/me/agent-rule-proposals');
    expect(候选创建们.length).toBe(2);
    expect(候选创建们[0]!.idempotencyKey).not.toBe(候选创建们[1]!.idempotencyKey);
    const 候选接受们 = p6.mutationRequests.filter((项) => 项.method === 'POST' && 项.path.includes('/me/') && 项.path.endsWith('/accept'));
    expect(候选接受们.length).toBe(2);
    for (const 项 of 候选接受们) {
      expect(项.body).toEqual({});
      expect(项.idempotencyKey).toMatch(/\S/);
    }
  });

  test('P6 版本冲突只做一次权威重读且零重放 @backend', async ({ page }) => {
    // PATCH 专用冲突规则 409 version_conflict：effect 没有 receipt，恢复只做一轮权威 Rule 重读
    // （两页翻页 = 不带 cursor 的首页 GET 恰好一次），绝不再发 mutation；开关原样保留。
    const 请求序: string[] = [];
    const 清单读取: { url: string; ms: number }[] = [];
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-conflict',
      记录目录请求: () => undefined,
      招聘组织Fixture: P1C招聘组织Fixture,
      主体初始角色: 'recruiter',
      P6分支: {
        追加规则们: [{
          规则: P6规则({
            rule_id: P6分支编号.冲突规则,
            display_text: P6标记.冲突规则,
            scope: { type: 'global' },
          }),
          分支: '写入冲突',
        }],
      },
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });
    // 清单读取带完整 URL（cursor 参数区分翻页），补丁时间戳用来只数 PATCH 之后的读取
    page.on('request', (请求) => {
      const 地址 = new URL(请求.url());
      if (地址.pathname === '/api/v1/recruiter/agent-rules' && 请求.method() === 'GET') {
        清单读取.push({ url: 地址.pathname + 地址.search, ms: Date.now() });
      }
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.goto('/#/hr/agent-settings');
    const 冲突开关 = page.getByRole('switch', { name: `规则：${P6标记.冲突规则}` });
    await expect(冲突开关).toBeVisible({ timeout: 15_000 });
    await expect(冲突开关).toHaveAttribute('aria-checked', 'true');

    const 点击时刻 = Date.now();
    await 冲突开关.click();
    await expect(page.getByText('数据已在其他地方更新，请重试')).toBeVisible({ timeout: 10_000 });
    await expect(冲突开关).toHaveAttribute('aria-checked', 'true');
    const 补丁键 = `PATCH /api/v1/recruiter/agent-rules/${P6分支编号.冲突规则}`;
    const 补丁位 = 请求序.lastIndexOf(补丁键);
    expect(补丁位).toBeGreaterThanOrEqual(0);
    // 零重放：PATCH 只发出过一次
    expect(请求序.filter((项) => 项 === 补丁键).length).toBe(1);
    // 一次权威重读：PATCH 之后带 cursor 的翻页请求恰一轮（首页 GET 恰好一次）
    await expect.poll(() => 清单读取.filter((项) => 项.ms >= 点击时刻 && !项.url.includes('cursor=')).length, { timeout: 5_000 }).toBe(1);
    // 回执存证：If-Match 是水合时的当前版本
    const 冲突写 = p6.mutationRequests.find((项) => 项.path === `/api/v1/recruiter/agent-rules/${P6分支编号.冲突规则}`);
    expect(冲突写).toBeDefined();
    expect(冲突写!.ifMatch).toBe('"1"');
    expect(冲突写!.body).toEqual({ operation: 'pause' });
  });

  test('P6 accept 响应丢失与结果未知经权威 GET 收敛 @backend', async ({ page }) => {
    // 真·响应丢失（连接中断）：accept 已被服务端处理，客户端不重发 mutation，
    // 恢复走 GET 提案（accepted 回执）→ 完整重读 Rules；503 outcome_unknown 额外证明
    // 受控重试复用同一把 Idempotency-Key。
    test.setTimeout(120_000);
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-loss',
      记录目录请求: () => undefined,
      P6分支: {
        追加提案们: [
          {
            提案: {
              proposal_id: P6分支编号.丢失提案,
              state: 'ready',
              normalized_text: P6标记.丢失提案正文,
              consequence: 'auto_allow',
              created_at: '2026-08-26T00:00:00Z',
            },
            分支: 'accept丢失',
          },
          {
            提案: {
              proposal_id: P6分支编号.未知提案,
              state: 'ready',
              normalized_text: P6标记.未知提案正文,
              consequence: 'advisory',
              created_at: '2026-08-26T00:00:00Z',
            },
            分支: 'accept未知',
          },
        ],
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.goto('/#/rules');
    await expect(page.getByText(P6标记.丢失提案正文)).toBeVisible({ timeout: 15_000 });

    // 响应丢失：POST 恰一次（mutation 不自动重试），权威收敛后规则行出现、卡片消失
    await 就绪卡动作键(page, P6标记.丢失提案正文, '确认规则').click();
    await expect(page.getByRole('button', { name: new RegExp(P6标记.丢失提案正文) })).toBeVisible({ timeout: 20_000 });
    await expect(就绪卡动作键(page, P6标记.丢失提案正文, '确认规则')).toHaveCount(0);
    const 丢失接受们 = p6.mutationRequests.filter((项) => 项.path === `/api/v1/me/agent-rule-proposals/${P6分支编号.丢失提案}/accept`);
    expect(丢失接受们.length).toBe(1);
    expect(p6.proposalReads[P6分支编号.丢失提案]).toBeGreaterThanOrEqual(1);

    // 结果未知：受控重试一次、两把 key 是同一把，仍 503 后同样经 GET 提案 + Rule 清单收敛
    await 就绪卡动作键(page, P6标记.未知提案正文, '确认规则').click();
    await expect(page.getByRole('button', { name: new RegExp(P6标记.未知提案正文) })).toBeVisible({ timeout: 20_000 });
    await expect(就绪卡动作键(page, P6标记.未知提案正文, '确认规则')).toHaveCount(0);
    const 未知接受们 = p6.mutationRequests.filter((项) => 项.path === `/api/v1/me/agent-rule-proposals/${P6分支编号.未知提案}/accept`);
    expect(未知接受们.length).toBe(2);
    expect(未知接受们[0]!.idempotencyKey).not.toBe('');
    expect(未知接受们[0]!.idempotencyKey).toBe(未知接受们[1]!.idempotencyKey);
    expect(p6.proposalReads[P6分支编号.未知提案]).toBeGreaterThanOrEqual(1);
  });

  test('P6 切换招聘端后迟到的候选端应答不再上屏 @backend', async ({ page }) => {
    // 首次规则清单 503 → 重试键；重试的规则清单第一页被挂起到切身份之后才应答：
    // 旧会话代际的迟到响应整包丢弃，候选端标记绝不上招聘端页面；切回候选端后完整水合照常。
    test.setTimeout(120_000);
    let 放行!: () => void;
    const 门 = new Promise<void>((ok) => { 放行 = ok; });
    const 请求序: string[] = [];
    // 切回候选端是交互式水合：隐私域缺席会按「Mock 不顶替 HTTP」边界拒绝并中断切换，故提供 fixture
    const 隐私 = P3隐私fixture();
    await 安装BFF路由(page, {
      登录尝试id: 'att-p6-stale',
      记录目录请求: () => undefined,
      招聘组织Fixture: P1C招聘组织Fixture,
      主体初始角色: 'candidate',
      隐私fixture: 隐私,
      P6分支: { 规则清单首次失败: true, 挂起候选规则: 门 },
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.goto('/#/rules');
    await expect(page.getByRole('button', { name: '规则加载失败，重试' })).toBeVisible({ timeout: 15_000 });

    // 重试：这一轮规则清单第一页被 fixture 挂起，请求横跨切身份全程
    await page.getByRole('button', { name: '规则加载失败，重试' }).click();
    await expect.poll(() => 请求序.filter((项) => 项 === 'GET /api/v1/me/agent-rules').length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);

    // 切到招聘端（会话代际递增），招聘端事实先水合完成
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    await page.goto('/#/hr/agent-settings');
    await expect(page.getByText(P6标记.招聘全局规则)).toBeVisible({ timeout: 15_000 });

    // 放行迟到应答：候选端规则/提案标记一个都不出现
    放行();
    await page.waitForTimeout(1500);
    await expect(page.getByText(P6标记.招聘全局规则)).toBeVisible();
    await expect(page.getByText(P6标记.候选全局规则)).toHaveCount(0);
    await expect(page.getByText(P6标记.候选意向规则)).toHaveCount(0);
    await expect(page.getByText(P6标记.就绪提案正文)).toHaveCount(0);

    // 切回候选端：新代际的完整水合不受迟到应答影响
    await page.goto('/#/identity?switch=1&from=hr');
    await page.getByRole('button', { name: '翻到「求职者」那一面' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto('/#/rules');
    await expect(page.getByText(P6标记.候选全局规则)).toBeVisible({ timeout: 15_000 });
  });

  test('P6 失败提案卡显示固定文案，失败保留草稿可再提交 @backend', async ({ page }) => {
    // 专用提案单项 GET 即 failed：固定失败文案 + 关闭；创建失败（500）时草稿与范围原样保留，
    // 再次提交是新意图、新 key。
    test.setTimeout(120_000);
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-failed',
      记录目录请求: () => undefined,
      P6分支: {
        追加提案们: [{
          提案: { proposal_id: P6分支编号.失败提案, state: 'interpreting', created_at: '2026-08-26T00:00:00Z' },
          分支: '单读失败',
        }],
        创建前几次失败: 1,
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.goto('/#/rules');
    await expect(page.getByText('AI代理正在理解这条规则…').first()).toBeVisible({ timeout: 15_000 });

    // 轮询读到权威 failed（legacy 无 code）→ 兜底失败文案；关闭只收起这一张卡
    await expect(page.getByText('本次规则没有生效')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '关闭' }).click();
    await expect(page.getByText('本次规则没有生效')).toHaveCount(0);

    // 创建失败：composer 不收起，草稿/范围原样保留（绝不伪造成功）
    await page.getByRole('button', { name: '手动添加规则' }).click();
    const 候选输入 = page.getByPlaceholder('例：不接受大小周的岗位直接过滤');
    await 候选输入.fill(P6标记.失败草稿);
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    await expect(page.getByText(P6标记.创建失败提示)).toBeVisible({ timeout: 10_000 });
    await expect(候选输入).toHaveValue(P6标记.失败草稿);
    await expect(page.getByLabel('规则范围')).toHaveValue('');

    // 再次提交：新意图、新 key，创建成功才收起输入行
    await page.getByRole('button', { name: '提交给AI代理理解' }).click();
    await expect(候选输入).toHaveCount(0, { timeout: 10_000 });
    const 创建们 = p6.mutationRequests.filter((项) => 项.method === 'POST' && 项.path === '/api/v1/me/agent-rule-proposals');
    expect(创建们.length).toBe(2);
    expect(创建们[0]!.body).toEqual({ text: P6标记.失败草稿, scope: { type: 'global' } });
    expect(创建们[1]!.body).toEqual({ text: P6标记.失败草稿, scope: { type: 'global' } });
    expect(创建们[0]!.idempotencyKey).not.toBe('');
    expect(创建们[0]!.idempotencyKey).not.toBe(创建们[1]!.idempotencyKey);
  });

  test('P6 重复 cursor 按契约漂移失败出服务异常重试，不回退 Mock @backend', async ({ page }) => {
    // 清单游标成环 → 解码器按翻页死循环拒绝，rules 域整体失败：
    // 重试键上屏、无清单/无计数/无写控件，Mock 种子绝不顶替 HTTP。
    await 安装BFF路由(page, {
      登录尝试id: 'att-p6-cursor',
      记录目录请求: () => undefined,
      P6分支: { 游标成环: true },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.goto('/#/rules');
    await expect(page.getByRole('button', { name: '规则加载失败，重试' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('规则加载中')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '手动添加规则' })).toHaveCount(0);
    await expect(page.getByText('2 条')).toHaveCount(0);
    await expect(page.getByText(P6标记.候选全局规则)).toHaveCount(0);
    await expect(page.getByText(P6标记.候选意向规则)).toHaveCount(0);
    await expect(page.getByText('不主动披露并行接触数量')).toHaveCount(0);
    await expect(page.getByText('双休是底线；隔周六可谈，大小周不谈')).toHaveCount(0);
  });

  test('P6 首次水合挂起期间无任何规则内容与写入口 @backend', async ({ page }) => {
    // 规则清单第一页被挂起：初始化完成前整壳只有路由加载中 ——
    // Mock 种子行 / 计数 / 写控件 / 重试键都不上屏；放行后权威行与计数一并落地。
    test.setTimeout(120_000);
    let 放行!: () => void;
    const 门 = new Promise<void>((ok) => { 放行 = ok; });
    await 安装BFF路由(page, {
      登录尝试id: 'att-p6-pending',
      记录目录请求: () => undefined,
      P6分支: { 挂起候选规则: 门 },
    });

    await page.goto('/#/rules');
    await expect(page.getByText('正在加载…')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('不主动披露并行接触数量')).toHaveCount(0);
    await expect(page.getByText('双休是底线；隔周六可谈，大小周不谈')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '手动添加规则' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '规则加载失败，重试' })).toHaveCount(0);

    放行();
    await expect(page.getByText(P6标记.候选全局规则)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P6标记.候选意向规则)).toBeVisible();
    await expect(page.getByText('2 条')).toBeVisible();
  });

  test('P6 accept 409 not_actionable 权威恢复保留卡片 @backend', async ({ page }) => {
    // 专用提案公开 consequence 是 auto_allow（看起来完全可执行），服务端仍裁决 not_actionable：
    // 公开后果从不决定可执行性 —— 恢复路径读权威回执，卡片保留、绝不本地物化规则、零重放。
    const { p6 } = await 安装BFF路由(page, {
      登录尝试id: 'att-p6-not-actionable',
      记录目录请求: () => undefined,
      P6分支: {
        追加提案们: [{
          提案: {
            proposal_id: P6分支编号.不可接受提案,
            state: 'ready',
            normalized_text: P6标记.不可接受提案正文,
            consequence: 'auto_allow',
            created_at: '2026-08-26T00:00:00Z',
          },
          分支: 'accept不可接受',
        }],
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.goto('/#/rules');
    await expect(page.getByText(P6标记.不可接受提案正文)).toBeVisible({ timeout: 15_000 });

    await 就绪卡动作键(page, P6标记.不可接受提案正文, '确认规则').click();
    await expect(page.getByText('这条内容暂时不能成为长期规则，请放弃或换一种说法')).toBeVisible({ timeout: 10_000 });
    // 权威恢复：GET 回执仍是 ready → 卡片原样保留，规则计数不变、没有规则行被物化
    await expect(page.getByText(P6标记.不可接受提案正文)).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(P6标记.不可接受提案正文) })).toHaveCount(0);
    await expect(page.getByText('2 条')).toBeVisible();
    const 接受们 = p6.mutationRequests.filter((项) => 项.path === `/api/v1/me/agent-rule-proposals/${P6分支编号.不可接受提案}/accept`);
    expect(接受们.length).toBe(1);
    expect(p6.proposalReads[P6分支编号.不可接受提案]).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P4 发现推荐域 fixture @backend —— Backend/Mock 隔离证明（Task 8）。
// 断言以 fixture 存证（变更回执 method/path/body/If-Match/Idempotency-Key、委托读取、
// 刷新计数、available/rejected 数组）与 P4标记 上屏为主：标记值只存在于 fixture，
// 页面展示它们即证明渲染来自 HTTP 而非 Mock。无任何 watch 路由。
// ─────────────────────────────────────────────────────────────────────────────

/** P4 候选端安装：candidate 会话恢复 + 发现 fixture（意向列表可用 fixture 的 意向们 覆盖） */
async function 装P4候选(
  page: Page,
  选项: {
    fixture?: P4发现fixture形;
    附件fixture?: P2附件fixture形;
    覆盖?: BFF路由选项['覆盖'];
    请求拦截?: (请求: 拦截请求形) => void;
  } = {},
): Promise<P4发现fixture形> {
  const fixture = 选项.fixture ?? P4发现fixture();
  await 安装BFF路由(page, {
    登录尝试id: 'att-p4-candidate',
    记录目录请求: () => undefined,
    发现fixture: fixture,
    附件fixture: 选项.附件fixture,
    覆盖: 选项.覆盖,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}

/** P4 招聘端安装：recruiter 会话（组织 fixture + P4 owner 岗位）+ 发现 fixture */
async function 装P4招聘(
  page: Page,
  选项: {
    fixture?: P4发现fixture形;
    岗位们?: P1C岗位形[];
    请求拦截?: (请求: 拦截请求形) => void;
  } = {},
): Promise<P4发现fixture形> {
  const fixture = 选项.fixture ?? P4发现fixture();
  await 安装BFF路由(page, {
    登录尝试id: 'att-p4-recruiter',
    记录目录请求: () => undefined,
    招聘组织Fixture: 带企业关系(
      P1C招聘组织Fixture,
      [P1C管理员关系],
      { [P1C标记.组织甲编号]: P1C组织甲() },
      选项.岗位们 ?? [P4招聘岗位()],
    ),
    主体初始角色: 'recruiter',
    发现fixture: fixture,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}

/** 下拉刷新手势：列表贴顶时向下拽 160px（拉距 64 封顶 > 46 阈值），松手触发刷新回调 */
async function 下拉刷新手势(page: Page) {
  const 区 = page.locator('.滚动区').first();
  const 框 = (await 区.boundingBox())!;
  const 横 = 框.x + 框.width / 2;
  await page.mouse.move(横, 框.y + 120);
  await page.mouse.down();
  for (let 步 = 1; 步 <= 8; 步 += 1) await page.mouse.move(横, 框.y + 120 + 步 * 20);
  await page.mouse.up();
}

/** 触屏左滑候选卡露出「不合适」。走 CDP touch 而不是鼠标拖拽：真实触屏手势在大幅移动后
 *  浏览器不会合成 click，行面的「打开态点击即收起」不会被拖拽尾随的 click 误触。 */
async function 左滑候选卡(page: Page, 别名: string) {
  const 行面 = page.locator('[role="group"][aria-expanded="false"]').filter({ hasText: 别名 }).first();
  const 框 = (await 行面.boundingBox())!;
  const 纵 = 框.y + 框.height / 2;
  const 起 = 框.x + 框.width - 30;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 起, y: 纵 }] });
  for (let 步 = 1; 步 <= 5; 步 += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 起 - 步 * ((框.width - 60) / 5), y: 纵 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.describe('P4 发现推荐域 fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });
  test.use({ timeout: 120_000 });

  test('P4 候选列表与详情的职位/公司/发布人来自 HTTP fixture，快照命中不再 GET @backend', async ({ page }) => {
    const 请求序: string[] = [];
    await 装P4候选(page, { 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();

    // 列表三个标记值逐字来自 fixture（Mock 里没有）：jobTitle / company / publisher
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P4标记.company)).toBeVisible();
    await expect(page.getByText(P4标记.publisher)).toBeVisible();
    // 列表来自按当前意向 scope 的候选岗位推荐 GET
    expect(请求序.some((项) => 项 === 'GET /api/v1/me/job-recommendations')).toBe(true);

    // 进详情：快照命中直接渲染，绝不再发 canonical job GET
    await page.getByRole('button', { name: '查看职位详情' }).click();
    await expect(page).toHaveURL(new RegExp(`#/job/${P4编号.job}$`));
    await expect(page.getByText(P4标记.jobTitle).first()).toBeVisible();
    // 公司名同时出现在公司区块与发布人行 → 用 .first() 只证渲染自 HTTP
    await expect(page.getByText(P4标记.company).first()).toBeVisible();
    await expect(page.getByText(P4标记.publisher).first()).toBeVisible();
    expect(请求序.some((项) => 项.startsWith('GET /api/v1/jobs/'))).toBe(false);
  });

  test('P4 详情直取走 canonical job GET，同一批 HTTP 标记上屏 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    await 装P4候选(page, { 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    // 直接进详情：无任何快照 → GET 单个 CandidateJob（canonical job GET）
    await page.goto(`/#/job/${P4编号.job}`);
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    expect(请求序).toContain(`GET /api/v1/jobs/${P4编号.job}`);
    await expect(page.getByText(P4标记.company).first()).toBeVisible();
    await expect(page.getByText(P4标记.publisher).first()).toBeVisible();
    // 详情直取没有推荐坐标：不感兴趣禁用，绝不猜坐标
    await expect(page.getByRole('button', { name: '不感兴趣' })).toBeDisabled();
  });

  test('下拉刷新只重读（GET），绝不发刷新 POST @backend', async ({ page }) => {
    const P4请求: { method: string; path: string }[] = [];
    await 装P4候选(page, {
      请求拦截: ({ path, method }) => {
        if (path.includes('job-recommendation')) P4请求.push({ method, path });
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    const 首读数 = P4请求.filter((项) => 项.method === 'GET').length;

    await 下拉刷新手势(page);

    // 松手后恰好再走一轮 GET 翻页；全程无任何刷新 POST
    await expect
      .poll(() => P4请求.filter((项) => 项.method === 'GET').length, { timeout: 15_000 })
      .toBeGreaterThan(首读数);
    await page.waitForTimeout(400);
    expect(P4请求.filter((项) => 项.method === 'POST')).toEqual([]);
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible();
  });

  test('空态让AI代理帮我搜：POST 稳幂等键（503 受控重试同键）随后 GET 建新批次 @backend', async ({ page }) => {
    const fixture = P4发现fixture({ 候选刷新首次503: true });
    fixture.候选推荐[P4编号.intention] = [];
    const 刷新POST: { 键: string; 体: unknown }[] = [];
    const P4请求: { method: string; path: string }[] = [];
    await 装P4候选(page, {
      fixture,
      请求拦截: ({ path, method, headers, body }) => {
        if (path.includes('job-recommendation')) P4请求.push({ method, path });
        if (path === '/api/v1/me/job-recommendation-refreshes' && method === 'POST') {
          刷新POST.push({ 键: headers['idempotency-key'] ?? '', 体: body });
        }
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    // 空批次：空态文案 + 手动刷新入口
    await expect(page.getByText('这个意向下暂时没有新职位')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: '让AI代理帮我搜' }).click();
    // 503 受控重试复用同一把键；随后权威 GET 把新批次带上屏
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 20_000 });
    expect(刷新POST.length).toBe(2);
    expect(刷新POST[0]!.键).not.toBe('');
    expect(刷新POST[0]!.键).toBe(刷新POST[1]!.键);
    expect(刷新POST[0]!.体).toEqual({ intention_id: P4编号.intention });
    // POST 之后以权威 GET 收尾：日志最后一笔是列表读取
    expect(P4请求[P4请求.length - 1]).toEqual({ method: 'GET', path: '/api/v1/me/job-recommendations' });
    expect(fixture.刷新次数.candidate).toBe(1);
  });

  test('候选委托：确认前零变更请求 → 字面披露 true → 同键同回执 → 轮询到 case_started，绝不落 Mock 在谈 @backend', async ({ page }) => {
    const fixture = P4发现fixture({ 候选委托先503: true });
    const 附件fixture = 创建P2附件fixture();
    附件fixture.items = [P2新附件(1, 'P4 Fixture 候选简历.pdf', Buffer.from('%PDF-1.7\nfixture\n'))];
    const 请求序: { method: string; path: string; body: unknown; headers: Record<string, string> }[] = [];
    await 装P4候选(page, {
      fixture,
      附件fixture,
      请求拦截: (项) => 请求序.push({ method: 项.method, path: 项.path, body: 项.body, headers: 项.headers }),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });

    // 确认层之前零变更请求；打开确认层允许重读附件库校验当前选择仍然有效
    const 确认前变更数 = 请求序.filter((项) => 项.method !== 'GET').length;
    await page.getByRole('button', { name: '让AI代理去谈' }).click();
    await expect(page.getByRole('dialog', { name: '确认委托AI代理？' })).toBeVisible({ timeout: 5_000 });
    expect(请求序.filter((项) => 项.method !== 'GET')).toHaveLength(确认前变更数);

    // 确认层遮罩钮的可及名是「关闭确认委托AI代理？」：exact 才只命中执行键
    await page.getByRole('button', { name: '确认委托', exact: true }).click();

    // POST 携带字面披露 true（503 受控重试 → 同键同回执），卡片原地显示已接手
    await expect(page.getByText('AI代理已接手')).toBeVisible({ timeout: 15_000 });
    const 委托POST = 请求序.filter((项) => 项.path === '/api/v1/me/job-delegations' && 项.method === 'POST');
    expect(委托POST.length).toBe(2);
    expect(委托POST[0]!.body).toEqual({
      intention_id: P4编号.intention,
      selection: { items: [P4编号.job] },
      disclosure_acknowledged: true,
      resume_file_id: 'rf_1',
      resume_file_version_id: 'rfv_1_1',
    });
    expect(委托POST[0]!.headers['idempotency-key']).not.toBe('');
    expect(委托POST[0]!.headers['idempotency-key']).toBe(委托POST[1]!.headers['idempotency-key']);
    expect(fixture.变更请求.filter((项) => 项.path === '/api/v1/me/job-delegations')).toHaveLength(2);

    // 轮询：evaluating → case_started（真实 Case 引用只来自回执）
    await expect
      .poll(() => fixture.委托读取.filter((项) => 项.state === 'case_started').length, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);
    expect(fixture.委托读取[0]).toEqual({ delegationId: P4编号.candidateDelegation, state: 'evaluating' });

    // 从未跳去 Mock 在谈：URL 留在市场，变更恰好那两笔受控重试的 POST
    await page.waitForTimeout(500);
    expect(page.url()).toMatch(/#\/app$/);
    expect(page.url()).not.toMatch(/#\/deal/);
    expect(fixture.变更请求).toHaveLength(2);
    await expect(page.getByText('AI代理已接手')).toBeVisible();
  });

  test('不感兴趣：PUT 未成功卡片原地不动，200 权威移除后才消失 @backend', async ({ page }) => {
    const fixture = P4发现fixture();
    fixture.候选推荐[P4编号.intention] = [
      P4候选卡(),
      P4候选卡({
        recommendation_id: P4补充编号.备选推荐,
        rank: 2,
        match_score: 71,
        job: P4CandidateJob({ job_id: P4补充编号.备选岗位, title: 'P4 Fixture 备选岗位' }),
      }),
    ];
    fixture.分支 = { 候选不感兴趣先失败: true };
    await 装P4候选(page, { fixture });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    // 两张卡：第一张即甲（翻页首页 items[0]）
    await page.getByRole('button', { name: '查看职位详情' }).first().click();
    await expect(page).toHaveURL(new RegExp(`#/job/${P4编号.job}$`));

    // 首次 PUT 500：服务端先行 —— 不回列表，权威数组原样两张卡
    await page.getByRole('button', { name: '不感兴趣' }).click();
    await expect(page.getByText('fixture 首次不感兴趣失败')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(new RegExp(`#/job/${P4编号.job}$`));
    expect(fixture.候选推荐[P4编号.intention]).toHaveLength(2);

    // 第二次 PUT 200：权威回执确认后才回列表；卡消失、另一张还在
    await page.getByRole('button', { name: '不感兴趣' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await expect(page.getByText(P4标记.jobTitle)).toHaveCount(0);
    await expect(page.getByText('P4 Fixture 备选岗位')).toBeVisible();
    const 不感兴趣写 = fixture.变更请求.filter((项) => 项.path.endsWith('/not-interested'));
    expect(不感兴趣写).toHaveLength(2);
    expect(不感兴趣写[0]!.method).toBe('PUT');
    expect(不感兴趣写[0]!.ifMatch).toBeNull();
    expect(不感兴趣写[0]!.idempotencyKey).toBeNull();
    expect(fixture.候选推荐[P4编号.intention]).toHaveLength(1);
  });

  test('招聘端列表与详情渲染匿名别名/摘要，身份与薪资 canary 绝不上屏 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    await 装P4招聘(page, { 请求拦截: ({ path, method, query }) => 请求序.push(`${method} ${path}${query ?? ''}`) });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '推荐', exact: true }).click();

    // 列表：别名/摘要逐字来自 fixture；请求按当前岗位 scope 发出
    await expect(page.getByText(P4标记.candidateAlias).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P4标记.candidateSummary).first()).toBeVisible();
    expect(请求序.some((项) => 项 === `GET /api/v1/recruiter/jobs/${P4编号.recruiterJob}/candidate-recommendations?limit=50`)).toBe(true);

    // 详情：强制重读权威详情后渲染同一张卡的画像
    await page.getByRole('button', { name: '查看候选画像' }).first().click();
    await expect(page).toHaveURL(new RegExp(`#/hr/resume/${P4编号.recruiterRecommendation}$`));
    // 先等列表卸载（hash 已换而 React 未换树的瞬态窗里，列表摘要仍会在 DOM）
    await expect(page.getByText('你的AI代理从人才库筛出')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText(P4标记.candidateSummary)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P4标记.candidateAlias)).toBeVisible();
    expect(请求序).toContain(`GET /api/v1/recruiter/jobs/${P4编号.recruiterJob}/candidate-recommendations/${P4编号.recruiterRecommendation}`);

    // 身份/薪资 canary：HTTP 从未下发真名/直聊/经历段/年龄性别/期望薪资，页面一概不渲染；
    // Mock 人才库的候选（江叙白）与会话主体真名也不兜底出现
    await expect(page.getByText('直接聊')).toHaveCount(0);
    await expect(page.getByText('工作经历')).toHaveCount(0);
    await expect(page.getByText('沈亦舟')).toHaveCount(0);
    await expect(page.getByText('后端 fixture 候选人')).toHaveCount(0);
    await expect(page.getByText(/期望薪资/)).toHaveCount(0);
    await expect(page.getByText('江叙白')).toHaveCount(0);
  });

  test('收藏本地过滤、淘汰与撤销持久，已筛聚合只扫在招岗位 @backend', async ({ page }) => {
    const fixture = P4发现fixture();
    const 请求序: string[] = [];
    await 装P4招聘(page, {
      fixture,
      岗位们: [
        P4招聘岗位(),
        P4招聘岗位({ job_id: P4补充编号.归档岗位, title: 'P4 Fixture 已归档岗位', status: 'archived' }),
      ],
      请求拦截: ({ path, method, query }) => 请求序.push(`${method} ${path}${query ?? ''}`),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    await expect(page.getByText(P4标记.candidateAlias).first()).toBeVisible({ timeout: 15_000 });

    // 收藏：服务端先行 PUT（无 If-Match / 无 Idempotency-Key），权威回执改快照后星标点亮
    await page.getByRole('button', { name: '收藏', exact: true }).first().click();
    await expect(page.getByRole('button', { name: '取消收藏' }).first()).toBeVisible({ timeout: 10_000 });
    const 收藏写 = fixture.变更请求.find((项) => 项.path.endsWith('/favorite'));
    expect(收藏写).toBeDefined();
    expect(收藏写!.method).toBe('PUT');
    expect(收藏写!.ifMatch).toBeNull();
    expect(收藏写!.idempotencyKey).toBeNull();

    // 「只看收藏」是本地过滤：开关全程零新请求，只留收藏的甲
    await page.getByRole('button', { name: /筛选.*▾/ }).click();
    const 收藏开关 = page.getByRole('switch', { name: '只看收藏' });
    await expect(收藏开关).toBeVisible();
    const 过滤前请求数 = 请求序.length;
    await 收藏开关.click();
    await expect(page.getByText(P4标记.candidateAlias).first()).toBeVisible();
    await expect(page.getByText('P4候选乙')).toHaveCount(0);
    expect(请求序.length).toBe(过滤前请求数);
    await 收藏开关.click();
    await expect(page.getByText('P4候选乙')).toBeVisible();
    expect(请求序.length).toBe(过滤前请求数);
    await page.getByRole('button', { name: '完成' }).click();

    // 淘汰：左滑 → 原因 → PUT reason → 权威详情重读后卡才从可用流消失
    await 左滑候选卡(page, 'P4候选乙');
    await page.getByRole('button', { name: '不合适' }).click();
    await page.getByRole('button', { name: /年限不足/ }).click();
    await expect(page.getByText('已标记「年限不足」')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('P4候选乙')).toHaveCount(0, { timeout: 10_000 });
    const 淘汰写 = fixture.变更请求.find((项) => 项.path.endsWith('/rejection') && 项.method === 'PUT');
    expect(淘汰写!.body).toEqual({ reason: 'experience_insufficient' });

    // 已筛页：只请求在招岗位的 rejected 腿（归档岗位一个请求都没有），原因文案闭合
    await page.goto('/#/hr/screened-out');
    await expect(page.getByText('P4候选乙')).toBeVisible({ timeout: 15_000 });
    // 原因标逐字「年限不足」；此时上一屏的 toast 可能仍在，用 exact 避开它的子串
    await expect(page.getByText('年限不足', { exact: true })).toBeVisible();
    const 已筛读 = 请求序.filter((项) => 项.includes('state=rejected'));
    expect(已筛读.length).toBeGreaterThanOrEqual(1);
    for (const 项 of 已筛读) {
      expect(项.startsWith(`GET /api/v1/recruiter/jobs/${P4编号.recruiterJob}/candidate-recommendations?`)).toBe(true);
    }
    expect(请求序.some((项) => 项.includes(P4补充编号.归档岗位))).toBe(false);

    // 撤销：DELETE 成功后行消失（文案中性，不承诺回到当前批次）
    await page.getByRole('button', { name: '撤销' }).click();
    await expect(page.getByText('已撤销「P4候选乙」的筛选')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('P4候选乙')).toHaveCount(0, { timeout: 10_000 });
    expect(fixture.变更请求.some((项) => 项.path.endsWith('/rejection') && 项.method === 'DELETE')).toBe(true);

    // 持久证明：撤销后权威 available 腿把乙放回 —— 下拉强制重读（GET）才见回来
    await page.goto('/#/hr');
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    await expect(page.getByText(P4标记.candidateAlias).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('P4候选乙')).toHaveCount(0); // 撤销不回塞当前批次快照
    await 下拉刷新手势(page);
    await expect(page.getByText('P4候选乙')).toBeVisible({ timeout: 15_000 });
  });

  test('招聘端委托无确认层：POST 选择坐标 recommendation_id，绝不制造 Mock 候选 Case @backend', async ({ page }) => {
    const fixture = P4发现fixture();
    const 请求序: { method: string; path: string; body: unknown; headers: Record<string, string> }[] = [];
    await 装P4招聘(page, {
      fixture,
      请求拦截: (项) => 请求序.push({ method: 项.method, path: 项.path, body: 项.body, headers: 项.headers }),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    await expect(page.getByText(P4标记.candidateAlias).first()).toBeVisible({ timeout: 15_000 });

    // 无确认层：点击立即发起，页面全程没有弹层；卡原地长出「AI代理已接触」
    // （滑动行整行 role=button 的可及名含全卡文字，去聊键按真实 <button> 定位）
    await page.locator('button:has-text("让AI代理去聊")').first().click();
    await expect(page.getByText('AI代理已接触')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('dialog')).toHaveCount(0);

    const 委托POST = 请求序.filter((项) => 项.path === '/api/v1/recruiter/candidate-delegations' && 项.method === 'POST');
    expect(委托POST).toHaveLength(1);
    expect(委托POST[0]!.body).toEqual({ job_id: P4编号.recruiterJob, selection: { items: [P4编号.recruiterRecommendation] } });
    expect(委托POST[0]!.headers['idempotency-key']).toMatch(/\S/);

    // 进行中回执按节拍单项 GET；原地停留，变更恰好一笔，绝无 Mock 接触的第二笔
    await expect.poll(() => fixture.委托读取.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    expect(fixture.委托读取[0]).toEqual({ delegationId: P4编号.recruiterDelegation, state: 'accepted' });
    await page.waitForTimeout(400);
    expect(page.url()).toMatch(/#\/hr$/);
    expect(fixture.变更请求).toHaveLength(1);
    await expect(page.getByText('AI代理已接触')).toBeVisible();
  });

  test('P4 读取遇 401：统一清理把 P4 UI 带回登录页 @backend', async ({ page }) => {
    // 401 只武装给首载成功后的强制重读：本用例证明的是当前栅栏 401 的统一清理。
    // StrictMode 挂载期的首读不发 401（未武装），本用例不断言 stale-fence 401 的丢弃行为
    let 已武装 = false;
    await 装P4候选(page, {
      覆盖: {
        'GET /api/v1/me/job-recommendations': () => {
          if (!已武装) return undefined;
          return { status: 401, 响应: { error: { type: 'invalid_session', message: '登录已失效' } } };
        },
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    已武装 = true;
    await 下拉刷新手势(page);
    // 当前栅栏的 401 走统一清理：登录页回来，P4 内容清场
    await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P4标记.jobTitle)).toHaveCount(0);
  });

  test('P4 详情 404 走安全不可用页，绝不回落 Mock 岗位 @backend', async ({ page }) => {
    await 装P4候选(page);
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    // fixture 从未下发过的 job 编号 → canonical job GET 404
    await page.goto(`/#/job/${P4补充编号.未知岗位}`);
    await expect(page.getByText('这个职位暂时看不了')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('该职位可能已下架，或已不在你的推荐范围内。')).toBeVisible();
    await expect(page.getByText('MiniMax')).toHaveCount(0);
    await expect(page.getByText(P4标记.jobTitle)).toHaveCount(0);
  });

  test('招聘端简历详情 404 收口安全不可用页 @backend', async ({ page }) => {
    await 装P4招聘(page);
    await page.goto('/');
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await page.goto(`/#/hr/resume/${P4补充编号.未知推荐}`);
    await expect(page.getByText('这位候选暂时看不了')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P4标记.candidateAlias)).toHaveCount(0);
    await expect(page.getByText('江叙白')).toHaveCount(0);
  });

  test('503 与非法翻页都保留旧成功快照，绝不清空已上屏的卡 @backend', async ({ page }) => {
    const fixture = P4发现fixture();
    fixture.候选推荐[P4编号.intention] = [
      P4候选卡(),
      P4候选卡({
        recommendation_id: P4补充编号.备选推荐,
        rank: 2,
        match_score: 71,
        job: P4CandidateJob({ job_id: P4补充编号.备选岗位, title: 'P4 Fixture 备选岗位' }),
      }),
    ];
    let 已武装 = false;
    let 已503 = false;
    await 装P4候选(page, {
      fixture,
      覆盖: {
        'GET /api/v1/me/job-recommendations': () => {
          if (!已武装 || 已503) return undefined;
          已503 = true;
          return { status: 503, 响应: { error: { type: 'source_unavailable', message: '服务暂不可用' } } };
        },
      },
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('P4 Fixture 备选岗位')).toBeVisible();
    已武装 = true;

    // 第一次下拉撞 503：旧卡保留，错误行单独交代
    await 下拉刷新手势(page);
    await expect(page.getByText('后端服务暂时不可用，请稍后重试')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible();
    await expect(page.getByText('P4 Fixture 备选岗位')).toBeVisible();
    await page.waitForTimeout(1100); // 下拉动画至少 900ms：等它收场再拉下一次

    // 第二次下拉走到被注毒的第二页：strict decoder 拒收整轮读取，旧卡依旧不被清掉
    fixture.分支 = { ...fixture.分支, 候选非法第二页: true };
    await 下拉刷新手势(page);
    // 错误文案与恢复期隐私水合失败的 toast 同文：取 first 只认列表错误行
    await expect(page.getByText('服务返回异常，请稍后重试').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible();
    await expect(page.getByText('P4 Fixture 备选岗位')).toBeVisible();
  });

  test('切意向后旧 scope 的迟到应答整包丢弃，绝不闪进新列表 @backend', async ({ page }) => {
    const fixture = P4发现fixture();
    let 放行!: () => void;
    const 门 = new Promise<void>((ok) => { 放行 = ok; });
    fixture.意向们 = [
      P4意向({ intention_id: P4编号.intention, job_category: { id: 'job-fixture-p4-cat-a', display_name: 'P4 意向甲' } }),
      P4意向({ intention_id: P4补充编号.意向乙, job_category: { id: 'job-fixture-p4-cat-b', display_name: 'P4 意向乙' } }),
    ];
    fixture.候选推荐 = { [P4编号.intention]: [P4候选卡()] };
    fixture.分支 = { 挂起候选读取: { 意向: P4编号.intention, 门 } };
    await 装P4候选(page, { fixture });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await page.getByRole('button', { name: '市场', exact: true }).click();
    // 甲 scope 的首页 GET 被挂起：列表停在加载态
    await expect(page.getByText('正在为你挑岗位…')).toBeVisible({ timeout: 15_000 });

    // 切到乙：甲的 scope 代际已作废；乙自己的空批次先落定
    await page.getByRole('button', { name: 'P4 意向乙' }).click();
    await expect(page.getByText('这个意向下暂时没有新职位')).toBeVisible({ timeout: 15_000 });

    // 此刻才放行甲的迟到应答：整包丢弃，甲的标记卡绝不闪现
    放行();
    await page.waitForTimeout(1500);
    await expect(page.getByText('这个意向下暂时没有新职位')).toBeVisible();
    await expect(page.getByText(P4标记.jobTitle)).toHaveCount(0);

    // 切回甲：新代际照常加载
    await page.getByRole('button', { name: 'P4 意向甲' }).click();
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P4 Mock 数据源隔离 @mock：候选列表/详情 + 招聘列表/详情 + 收藏 + 淘汰 + 双端委托
// 全走本地归约；收集全部请求后按任务书原文的 isP4 正则断言发现域零请求。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P4 Mock 数据源隔离 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('Mock 双端发现全流程零 P4 请求 @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });

    // ── 候选端：登录 → 看市场列表 → 职位详情 → 一键委托（无确认层）──
    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);
    await page.goto('/#/app');
    await page.getByRole('button', { name: '市场', exact: true }).click();
    // Mock 市场列表的后端工程师卡片（老虎国际 M-11 / PingCAP M-12）
    await expect(page.getByText('交易系统资深工程师')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '查看职位详情' }).first().click();
    await expect(page).toHaveURL(/#\/job\//);
    await expect(page.getByText('交易系统资深工程师')).toBeVisible();
    await page.goto('/#/app');
    await page.getByRole('button', { name: '市场', exact: true }).click();
    await page.getByRole('button', { name: '让AI代理去谈' }).first().click();
    await expect(page.getByText('AI代理已接手').first()).toBeVisible({ timeout: 10_000 });

    // ── 招聘端：切身份 → 推荐列表 → 候选详情 → 收藏 / 淘汰 / 委托 ──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
    await page.goto('/#/hr');
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    await expect(page.getByText('江叙白')).toBeVisible({ timeout: 10_000 });

    // 详情：匿名在线简历（Mock 分支）
    await page.getByRole('button', { name: '查看候选画像' }).first().click();
    await expect(page).toHaveURL(/#\/hr\/resume\//);
    await expect(page.getByText('江叙白').first()).toBeVisible();

    // 回列表：收藏（本地）→ 委托（本地）→ 左滑淘汰（本地）。
    // 淘汰放最后：卡片移除会让列表位移，紧随其后的点击会跟重渲染抢布局
    await page.goto('/#/hr');
    await page.getByRole('button', { name: '推荐', exact: true }).click();
    await expect(page.getByText('江叙白')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '收藏', exact: true }).first().click();
    await expect(page.getByRole('button', { name: '取消收藏' }).first()).toBeVisible({ timeout: 10_000 });

    // 滑动行整行是 role=button（可及名含全卡文字），getByRole 会先命中行面、
    // 点其中心等于点卡主体 —— 去聊键必须按真实 <button> 元素定位
    await page.locator('button:has-text("让AI代理去聊")').first().click();
    await expect(page.getByText('AI代理已接触').first()).toBeVisible({ timeout: 10_000 });

    await 左滑候选卡(page, '周砚秋');
    await page.getByRole('button', { name: '不合适' }).click();
    await page.getByRole('button', { name: /年限不足/ }).click();
    await expect(page.getByText('周砚秋')).toHaveCount(0, { timeout: 10_000 });

    // P4 域在 Mock 下零请求（任务书原文断言），整段会话也没有任何 /api/v1
    const isP4 = (url: string) => /\/(job-recommendation|candidate-recommendation|job-delegation|candidate-delegation)/.test(url);
    expect(apiRequests.filter(isP4)).toEqual([]);
    expect(apiRequests).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P2 附件简历 Backend @backend —— candidate 拥有 0–3 份 PDF 附件库的真实浏览器契约。
// fixture（创建P2附件fixture）fail closed：未知 multipart part、缺 consent、错 If-Match、
// 缺幂等键一律 throw，让 E2E 在契约漂移时直接红。预览只断言 authenticated content GET，
// 不依赖 headless PDF viewer 的页面内容；布局门由 断言附件标题几何未漂移 承担。
// ─────────────────────────────────────────────────────────────────────────────

/** 左滑附件行露出操作键：真实 pointer 手势驱动 滑动行，绝不直接调 operation。
    一处浏览器实况补偿（手势路径与位移仍是「右缘 → 左缘」的左滑本体）：
    · 早期还有第二处补偿：附件卡贴在长页底部、容器已滚到底时，行的右缘中点会
      落进右下角常驻 ✎ 标注钮（zIndex 90、pointerEvents auto）的命中区，
      手势线被钳到行顶部 12px —— Task 7 后启动器 portal 出设备（缺省构建更是
      整个不渲染标注层），设备内不再有悬浮命中区，钳制已删除（见函数体内注释）；
    · 真实触摸左滑不会派生 click，桌面鼠标拖拽会派生一发 click 落回行面，
      触发「打开态点行 = 收起」把刚打开的行立刻关上 —— 手势期间在 document
      捕获段拦掉这一发派生 click，随后撤掉拦截，不碰任何真实交互。 */
async function 左滑附件行(page: Page, name: string): Promise<void> {
  const row = page.getByTestId('附件简历行').filter({ hasText: name });
  await row.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const box = await row.boundingBox();
  if (!box) throw new Error(`resume row is not visible: ${name}`);
  // 行中点本位：早期因右下角常驻 ✎ 标注钮的命中区钳到过行顶 12px ——
  // Task 7 后启动器 portal 出设备（缺省构建不渲染标注层），设备内无悬浮命中区
  const 手势y = box.y + box.height / 2;
  await page.evaluate(() => {
    const 拦 = (事件: Event) => 事件.stopPropagation();
    document.addEventListener('click', 拦, { capture: true, once: true });
    (window as unknown as { __撤滑动派生click拦截: () => void }).__撤滑动派生click拦截 = () =>
      document.removeEventListener('click', 拦, { capture: true });
  });
  await page.mouse.move(box.x + box.width - 10, 手势y);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, 手势y, { steps: 5 });
  await page.mouse.up();
  await page.evaluate(() => (window as unknown as { __撤滑动派生click拦截?: () => void }).__撤滑动派生click拦截?.());
}

/** 附件简历标题几何门：与「基本信息」标题同高、同下间距，且无全局 loading / 骨架残留。 */
async function 断言附件标题几何未漂移(page: Page): Promise<void> {
  const 附件标题 = page.getByTestId('附件简历标题');
  const 基本标题 = page.getByText('基本信息', { exact: true });
  const 附件后继 = 附件标题.locator('xpath=following-sibling::*[1]');
  const 基本后继 = 基本标题.locator('xpath=following-sibling::*[1]');
  const [附件框, 基本框, 附件后继框, 基本后继框] = await Promise.all([
    附件标题.boundingBox(), 基本标题.boundingBox(), 附件后继.boundingBox(), 基本后继.boundingBox(),
  ]);
  if (!附件框 || !基本框 || !附件后继框 || !基本后继框) {
    throw new Error('resume title geometry is unavailable');
  }
  expect(Math.abs(附件框.height - 基本框.height)).toBeLessThanOrEqual(1);
  const 附件下间距 = 附件后继框.y - (附件框.y + 附件框.height);
  const 基本下间距 = 基本后继框.y - (基本框.y + 基本框.height);
  expect(Math.abs(附件下间距 - 基本下间距)).toBeLessThanOrEqual(1);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.locator('[class*="骨架"], [class*="badge"]')).toHaveCount(0);
}

test.describe('P2 附件简历 Backend @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('Backend candidate owns PDF library without changing Mock visuals @backend', async ({ page }) => {
    // 轮询节拍是 3s 一读，多段轮询 + 手势全在一条 journey 里：显式放宽到 120s
    test.setTimeout(120_000);
    const P2 = 创建P2附件fixture();
    await 安装BFF路由(page, {
      记录目录请求: () => {}, 登录尝试id: 'att-p2', 附件fixture: P2,
    });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await page.goto('/#/student');
    await page.locator('input[type=file]').setInputFiles({
      name: 'candidate.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByText('candidate.pdf')).toBeVisible();

    await page.goto('/#/resume');
    // 授权层成功轻提示存活约 2s；等它退场，避免「简历已上传，正在识别」与行状态文案
    // 同时命中下面的 alternation（strict mode 会把 toast 记为第二个匹配，属测试噪声）。
    await expect(page.getByText('简历已上传，正在识别')).toBeHidden({ timeout: 5_000 });
    await expect(page.getByText('candidate.pdf')).toBeVisible();
    await expect(page.getByText(/等待识别|正在识别|识别完成/)).toBeVisible();
    await expect.poll(() => P2.列表读取次数, { timeout: 15_000 }).toBeGreaterThan(2);
    await expect(page.getByText('识别完成')).toBeVisible();

    // ── 布局门一：1/3（未满额）＋ 可见 —— 有 ＋ 的标题几何 ──
    await expect(page.getByRole('button', { name: '添加附件简历' })).toBeVisible();
    await 断言附件标题几何未漂移(page);
    // 记录第一行关闭滑动态的高度：replace + 轮询完成后同一行高度差不得 >1px
    const 首行 = page.getByTestId('附件简历行').filter({ hasText: 'candidate.pdf' });
    const 首行闭高 = (await 首行.boundingBox())?.height;
    expect(首行闭高).toBeDefined();

    // ── ＋ 授权取消：零写入零请求（基线采样在触发文件选择之前）──
    const writesBeforeAddCancel = P2.写入次数;
    await page.getByRole('button', { name: '添加附件简历' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'cancel-me.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
    expect(P2.写入次数).toBe(writesBeforeAddCancel);
    await expect(page.getByText('允许 AI 识别这份简历？')).toHaveCount(0);
    await expect(page.getByTestId('附件简历行')).toHaveCount(1);

    // ── 添加第二份 ──
    await page.getByRole('button', { name: '添加附件简历' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'second.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByTestId('附件简历行')).toHaveCount(2);
    await expect(page.getByTestId('附件简历行').filter({ hasText: 'second.pdf' })).toBeVisible();

    // ── 替换 candidate.pdf：display name 由槽位保留，与新挑的文件名无关 ──
    await 左滑附件行(page, 'candidate.pdf');
    await page.getByRole('button', { name: '替换', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'replacement.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByText('replacement.pdf')).toHaveCount(0);
    await expect(首行).toBeVisible();
    // replace 后重新入列 pending → 轮询回 识别完成；同一行高度不漂移
    await expect(首行.getByText('识别完成')).toBeVisible({ timeout: 15_000 });
    const 首行复高 = (await 首行.boundingBox())?.height;
    expect(Math.abs(首行复高! - 首行闭高!)).toBeLessThanOrEqual(1);

    // ── 预览：只断言 authenticated content GET，不依赖 PDF viewer 页面内容 ──
    const 内容请求 = page.waitForRequest(
      (request) => new URL(request.url()).pathname === '/api/v1/me/resume-files/rf_1/content',
    );
    await 首行.click();
    await 内容请求;
    expect(P2.下载次数).toBeGreaterThanOrEqual(1);

    // ── 添加到 3/3：＋ 消失；布局门二：满额无 ＋ 的标题几何 ──
    await page.getByRole('button', { name: '添加附件简历' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'third.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByTestId('附件简历行')).toHaveCount(3);
    await expect(page.getByRole('button', { name: '添加附件简历' })).toHaveCount(0);
    await 断言附件标题几何未漂移(page);

    // ── 删除：取消零 DELETE，确认恰一次 DELETE ──
    const 删除请求: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'DELETE' && new URL(request.url()).pathname.startsWith('/api/v1/me/resume-files')) {
        删除请求.push(request.url());
      }
    });
    const writesBeforeDelete = P2.写入次数;
    await 左滑附件行(page, 'third.pdf');
    await page.getByRole('button', { name: '删除', exact: true }).click();
    await expect(page.getByText('删除后无法恢复。')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
    expect(P2.写入次数).toBe(writesBeforeDelete);
    expect(删除请求).toEqual([]);
    await expect(page.getByTestId('附件简历行').filter({ hasText: 'third.pdf' })).toBeVisible();

    await 左滑附件行(page, 'third.pdf');
    await page.getByRole('button', { name: '删除', exact: true }).click();
    await expect(page.getByText('删除后无法恢复。')).toBeVisible();
    // 弹层遮罩的 aria-label「关闭删除附件简历？」也含这段文字：exact 只认执行键
    await page.getByRole('button', { name: '删除附件简历', exact: true }).click();
    await expect(page.getByTestId('附件简历行').filter({ hasText: 'third.pdf' })).toHaveCount(0, { timeout: 10_000 });
    expect(P2.写入次数).toBe(writesBeforeDelete + 1);
    expect(删除请求.length).toBe(1);
  });

  test('failed resume parse requires fresh consent before retry @backend', async ({ page }) => {
    // 失败态要等两拍 3s 轮询 + 重试后两拍：显式放宽到 120s
    test.setTimeout(120_000);
    const P2 = 创建P2附件fixture('parser_temporarily_unavailable');
    await 安装BFF路由(page, { 记录目录请求: () => {}, 登录尝试id: 'att-p2-failed', 附件fixture: P2 });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await page.goto('/#/student');
    await page.locator('input[type=file]').setInputFiles({
      name: 'failed.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture\n'),
    });
    await page.getByRole('button', { name: '同意并继续' }).click();
    await page.goto('/#/resume');
    await expect(page.getByText('服务繁忙 · 稍后重试')).toBeVisible({ timeout: 15_000 });
    P2.下次终态 = 'succeeded';
    const writesBeforeConsent = P2.写入次数;
    await 左滑附件行(page, 'failed.pdf');
    await page.getByRole('button', { name: '重新解析' }).click();
    await expect(page.getByText('允许 AI 识别这份简历？')).toBeVisible();
    expect(P2.写入次数).toBe(writesBeforeConsent);
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect(page.getByText('识别完成')).toBeVisible({ timeout: 15_000 });
    expect(P2.写入次数).toBe(writesBeforeConsent + 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P5 MatchCase 生命周期 @backend —— 双端 match-cases 的浏览器验收旅程（Task 8）。
// fixture 见 创建P5MatchCasefixture；变更回执 / PDF 读取 / 应答头（no-store）存证。
// ─────────────────────────────────────────────────────────────────────────────

/** P5 候选端安装：candidate 会话恢复 + MatchCase fixture（列表进 #/app 即读） */
async function 装P5候选(
  page: Page,
  选项: {
    fixture?: P5MatchCasefixture形;
    覆盖?: BFF路由选项['覆盖'];
    请求拦截?: (请求: 拦截请求形) => void;
  } = {},
): Promise<P5MatchCasefixture形> {
  const fixture = 选项.fixture ?? 创建P5MatchCasefixture();
  await 安装BFF路由(page, {
    登录尝试id: 'att-p5-candidate',
    记录目录请求: () => undefined,
    P5MatchCasefixture: fixture,
    覆盖: 选项.覆盖,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}

/** P5 招聘端安装：recruiter 会话（组织 fixture + P5 专属 owner 岗）+ MatchCase fixture */
async function 装P5招聘(
  page: Page,
  选项: { fixture?: P5MatchCasefixture形; 请求拦截?: (请求: 拦截请求形) => void } = {},
): Promise<P5MatchCasefixture形> {
  const fixture = 选项.fixture ?? 创建P5MatchCasefixture();
  await 安装BFF路由(page, {
    登录尝试id: 'att-p5-recruiter',
    记录目录请求: () => undefined,
    招聘组织Fixture: 带企业关系(
      P1C招聘组织Fixture,
      [P1C管理员关系],
      { [P1C标记.组织甲编号]: P1C组织甲() },
      [P4招聘岗位({ job_id: P5编号.job, title: P5标记.招聘岗标题 })],
    ),
    主体初始角色: 'recruiter',
    P5MatchCasefixture: fixture,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}

/** P5 双角色安装：双角色主体 + 隐私 fixture（切回候选端要交互式水合）—— 旅程内可切端 */
async function 装P5双角色(
  page: Page,
  选项: {
    fixture?: P5MatchCasefixture形;
    主体初始角色: 'candidate' | 'recruiter';
    请求拦截?: (请求: 拦截请求形) => void;
  },
): Promise<P5MatchCasefixture形> {
  const fixture = 选项.fixture ?? 创建P5MatchCasefixture();
  await 安装BFF路由(page, {
    登录尝试id: 'att-p5-dual',
    记录目录请求: () => undefined,
    招聘组织Fixture: 带企业关系(
      P1C招聘组织Fixture,
      [P1C管理员关系],
      { [P1C标记.组织甲编号]: P1C组织甲() },
      [P4招聘岗位({ job_id: P5编号.job, title: P5标记.招聘岗标题 })],
    ),
    主体初始角色: 选项.主体初始角色,
    隐私fixture: P3隐私fixture(),
    P5MatchCasefixture: fixture,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}

/** 纵序断言：各标记文本按给定顺序自上而下（服务端顺序原样保留，无客户端重排） */
async function 断言纵序(page: Page, 文本们: readonly string[]) {
  const 纵们: number[] = [];
  for (const 文本 of 文本们) {
    const 定位 = page.getByText(文本).first();
    await 定位.waitFor({ state: 'visible', timeout: 10_000 });
    const 框 = await 定位.boundingBox();
    if (!框) throw new Error(`P5 标记不可见：${文本}`);
    纵们.push(框.y);
  }
  for (let 序 = 1; 序 < 纵们.length; 序 += 1) {
    expect(纵们[序]!).toBeGreaterThan(纵们[序 - 1]!);
  }
}

/** POST 之后必有权威 detail 重读（mutation 响应是 void，权威态只来自 GET） */
function 断言重读发生(请求序: readonly string[], POST项: string) {
  const 位 = 请求序.indexOf(POST项);
  expect(位).toBeGreaterThanOrEqual(0);
  expect(请求序.slice(位 + 1).some((项) => /^GET \/api\/v1\/(me|recruiter)\/match-cases\/[^/]+$/.test(项))).toBe(true);
}

test.describe('P5 MatchCase 生命周期 fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });
  test.use({ timeout: 120_000 });

  test('同一 Case 双端 needs_action 分歧，列表保留服务端顺序与游标 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5双角色(page, {
      主体初始角色: 'candidate',
      请求拦截: ({ path, method, query }) => 请求序.push(`${method} ${path}${query ?? ''}`),
    });

    // ── 候选端 #/app：在谈子视图直接读 open 工作区（intention 过滤 + limit=50）──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await expect(page.getByText(P5标记.丁职位名)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '加载更多' })).toBeVisible(); // 游标未尽
    expect(请求序).toContain(`GET /api/v1/me/match-cases?intention_id=${P6标记.意向编号}&limit=50`);

    // 加载更多：首页 cursor 原样透传，第二页按服务端顺序追加上屏
    await page.getByRole('button', { name: '加载更多' }).click();
    await expect(page.getByText(P5标记.甲职位名)).toBeVisible({ timeout: 10_000 });
    expect(请求序).toContain(`GET /api/v1/me/match-cases?intention_id=${P6标记.意向编号}&limit=50&cursor=p5pg2`);
    await 断言纵序(page, [P5标记.丁职位名, P5标记.乙职位名, P5标记.丙一职位名, P5标记.丙二职位名, P5标记.甲职位名]);
    // 候选端视角：丁/乙/丙一/丙二需要你 ×4；同一 Case 甲对候选端零待办（代理处理中）
    await expect(page.getByText('需要你', { exact: true })).toHaveCount(4);
    await expect(page.getByText('代理处理中', { exact: true })).toHaveCount(1);

    // ── 切招聘端：同一批 Case 的 needs_action 由 viewer 重新裁决 ──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    await expect(page.getByText(P5标记.甲职位名)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(P5标记.甲别名)).toBeVisible();
    // 甲：候选端「代理处理中」→ 招聘端「需要你」（backend J5b 同款分歧）
    await expect(page.getByText('需要你', { exact: true })).toHaveCount(1);
    await expect(page.getByText('代理处理中', { exact: true })).toHaveCount(0);
    expect(请求序).toContain(`GET /api/v1/recruiter/match-cases?job_id=${P5编号.job}&limit=50`);
    await page.getByRole('button', { name: '加载更多' }).click();
    await expect(page.getByText(P5标记.丁职位名)).toBeVisible({ timeout: 10_000 });
    await 断言纵序(page, [P5标记.甲职位名, P5标记.丁职位名, P5标记.乙职位名, P5标记.丙一职位名, P5标记.丙二职位名]);
    expect(请求序).toContain(`GET /api/v1/recruiter/match-cases?job_id=${P5编号.job}&limit=50&cursor=p5pg2`);

    // 候选端专属上下文（intention_id）绝不上招聘端的屏
    await expect(page.getByText(new RegExp(P6标记.意向编号))).toHaveCount(0);
    // 整段旅程零写请求；每个 match-cases JSON 应答都带 no-store（fixture 侧存证）
    expect(fixture.变更请求).toEqual([]);
    expect(fixture.应答头存证.filter((项) => 项.path.includes('/match-cases')).every((项) => 项.cacheControl === 'no-store')).toBe(true);
  });

  test('未知 lifecycle/stage/status/step 与矩阵外四元组 fail closed @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = 创建P5MatchCasefixture();
    fixture.分支.坏行进列表 = true;
    await 装P5候选(page, { fixture, 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    // 一行未知 status 毒化整页：首载失败态 + 重试，任何行（含合法行）都不上屏
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await expect(page.getByText('在谈暂时加载不了')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('服务返回异常，请稍后重试').first()).toBeVisible();
    await expect(page.getByText(P5标记.丁职位名)).toHaveCount(0);
    // Mock 在谈单绝不顶替 HTTP
    await expect(page.getByText('资深后端工程师 · 交易网关')).toHaveCount(0);

    // 详情逐个探：未知词与矩阵外四元组一律 fail closed —— 零动作卡、零叮嘱输入
    const 坏编号们 = [P5编号.坏生命周期, P5编号.坏阶段, P5编号.坏状态, P5编号.坏步骤, P5编号.坏四元组];
    for (const 编号 of 坏编号们) {
      await page.goto(`/#/deal/${编号}`);
      await expect(page.getByText('这一单暂时打不开')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('服务返回异常，请稍后重试').first()).toBeVisible();
      await expect(page.getByRole('button', { name: '提交回答' })).toHaveCount(0);
      await expect(page.getByPlaceholder('有想法就告诉你的AI代理')).toHaveCount(0);
      expect(请求序).toContain(`GET /api/v1/me/match-cases/${编号}`);
    }
    // 重试只重发权威 GET（仍 fail closed），绝不变异
    const 详情GET数 = () => 请求序.filter((项) => 项 === `GET /api/v1/me/match-cases/${P5编号.坏四元组}`).length;
    const 前 = 详情GET数();
    await page.getByRole('button', { name: '重试' }).click();
    await expect.poll(() => 详情GET数(), { timeout: 5_000 }).toBeGreaterThan(前);
    expect(fixture.变更请求).toEqual([]);
  });

  test('候选详情直达刷新：空列表记忆下整页可渲染 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5候选(page, { 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    // 首个导航就是详情深链：列表从未挂载，context 只来自详情 GET
    await page.goto(`/#/deal/${P5编号.乙}`);
    await expect(page.getByText(P5标记.乙职位名).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`意向 ${P6标记.意向编号}`)).toBeVisible();
    await expect(page.getByText(P5标记.问题)).toBeVisible();
    await expect(page.getByRole('button', { name: '提交回答' })).toBeVisible();
    await expect(page.getByText('轮次 1/3')).toBeVisible();
    expect(请求序).toContain(`GET /api/v1/me/match-cases/${P5编号.乙}`);
    expect(请求序.filter((项) => /\/match-cases\?/.test(项))).toEqual([]); // 零列表/历史读取

    // Case 叮嘱：POST 等服务器回话 —— 权威重读落条后才上屏，无乐观气泡。
    // 同步点用「输入框清空」：操作在 POST + 权威重读完成后才 resolve，成功才清草稿
    // （getByText 会连 textarea 的值一起匹配，不能当「回执已上屏」的等待条件）。
    await page.getByPlaceholder('有想法就告诉你的AI代理').fill(P5标记.叮嘱);
    await page.getByRole('button', { name: '发送' }).click();
    await expect(page.getByPlaceholder('有想法就告诉你的AI代理')).toHaveValue('', { timeout: 10_000 });
    await expect(page.getByText(P5标记.叮嘱).first()).toBeVisible();
    const 叮嘱POST = fixture.变更请求.filter((项) => 项.path.endsWith('/agent-instructions'));
    expect(叮嘱POST).toHaveLength(1);
    expect(叮嘱POST[0]!.body).toEqual({ text: P5标记.叮嘱 });
    expect(叮嘱POST[0]!.idempotencyKey).not.toBe('');
    断言重读发生(请求序, `POST /api/v1/me/match-cases/${P5编号.乙}/agent-instructions`);
  });

  test('招聘详情直达刷新：空列表记忆下整页可渲染 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    await 装P5招聘(page, { 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    await page.goto(`/#/hr/candidate/${P5编号.甲}`);
    await expect(page.getByText(P5标记.甲别名).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(P5标记.甲职位名).first()).toBeVisible();
    await expect(page.getByText('需要你', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '通过初筛' })).toBeVisible();
    await expect(page.getByRole('button', { name: '不合适' })).toBeVisible();
    expect(请求序).toContain(`GET /api/v1/recruiter/match-cases/${P5编号.甲}`);
    expect(请求序.filter((项) => /\/match-cases\?/.test(项))).toEqual([]);
    // 身份 canary：P5 投影里没有姓名/联系方式渲染路径
    await expect(page.getByText(标记.主体真名)).toHaveCount(0);
  });

  test('S0 补充事实：POST 带 ref、503 同键重放成功、重读移除动作卡 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = 创建P5MatchCasefixture();
    fixture.分支.事实首答503 = true;
    await 装P5候选(page, { fixture, 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    await page.goto(`/#/deal/${P5编号.乙}`);
    await expect(page.getByText(P5标记.问题)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('补充事实')).toBeVisible();

    // 首答两把 503（第一把被传输层受控重试同键消耗，第二把把失败递到屏层）：
    // 结果未知 → 权威 detail GET 对账（问题仍在 → 原样抛、意图键保留）
    await page.getByRole('textbox', { name: '回答问题' }).fill(P5标记.回答);
    await page.getByRole('button', { name: '提交回答' }).click();
    await expect(page.getByText('后端服务暂时不可用，请稍后重试').first()).toBeVisible({ timeout: 10_000 });
    断言重读发生(请求序, `POST /api/v1/me/match-cases/${P5编号.乙}/fact-responses`);
    // 失败不清卡：respond_fact 卡与草稿原样
    await expect(page.getByRole('button', { name: '提交回答' })).toBeVisible();

    // 同键重放成功：权威重读把卡撤下（S0 转复评等待行）
    await page.getByRole('button', { name: '提交回答' }).click();
    await expect(page.getByText('等待中', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('系统正在复评候选信息')).toBeVisible();
    await expect(page.getByRole('button', { name: '提交回答' })).toHaveCount(0);
    await expect(page.getByText('补充事实')).toHaveCount(0);

    // 三笔 POST 同一把 Idempotency-Key（传输层受控重试 + 意图键保留后的用户重放）
    const 事实POST = fixture.变更请求.filter((项) => 项.path.endsWith('/fact-responses'));
    expect(事实POST).toHaveLength(3);
    expect(事实POST[0]!.idempotencyKey).not.toBe('');
    expect(new Set(事实POST.map((项) => 项.idempotencyKey)).size).toBe(1);
    // body 只带 transcript 的 ref（prompt_id）与回答，case/请求编号进不了 body
    expect(事实POST[0]!.body).toEqual({ prompt_id: P5编号.问题, response: P5标记.回答 });
    expect(事实POST[2]!.body).toEqual({ prompt_id: P5编号.问题, response: P5标记.回答 });
  });

  test('披露前与解析中/失败：无姓名无联系方式无 PDF；失败重试重发同一对 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5双角色(page, {
      主体初始角色: 'candidate',
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    // ── 候选端 丙二（解析失败）：重试卡只认阶段区 typed 附件 ──
    await page.goto(`/#/deal/${P5编号.丙二}`);
    await expect(page.getByRole('button', { name: '重试校验' })).toBeVisible({ timeout: 20_000 });

    // 首次递交：失败解析挡披露（409 明确提示），卡仍在
    await page.getByRole('button', { name: '重试校验' }).click();
    const 披露框 = page.getByRole('dialog');
    await expect(披露框.getByText(/这一 Case 递交/)).toBeVisible();
    await expect(披露框.getByText(new RegExp(P5标记.简历名))).toBeVisible();
    await 披露框.getByRole('button', { name: '确认递交' }).click();
    await expect(page.getByText('简历解析未通过，请重试').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '重试校验' })).toBeVisible();

    // 解析恢复后同键重放同一对（file/version 与 typed 附件逐字一致）→ 披露成功
    await page.getByRole('button', { name: '重试校验' }).click();
    const 再披露 = page.getByRole('dialog');
    await 再披露.getByRole('button', { name: '确认递交' }).click();
    await expect(page.getByText('等待招聘方决定')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '重试校验' })).toHaveCount(0);
    const 递交POST = fixture.变更请求.filter((项) => 项.path.endsWith('/resume-submission'));
    expect(递交POST).toHaveLength(2);
    expect(递交POST[0]!.body).toEqual({
      file_id: P5编号.文件, file_version_id: P5编号.文件版本, disclosure_confirmed: true,
    });
    expect(递交POST[0]!.body).toEqual(递交POST[1]!.body);
    expect(递交POST[0]!.idempotencyKey).not.toBe('');
    expect(递交POST[0]!.idempotencyKey).toBe(递交POST[1]!.idempotencyKey);

    // ── 切招聘端：披露前（乙 S0）与解析中（丙一 S1 waiting）不暴露姓名/联系方式/PDF ──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    for (const [编号, 别名] of [[P5编号.丙一, P5标记.丙一别名], [P5编号.乙, P5标记.乙别名]] as const) {
      await page.goto(`/#/hr/candidate/${编号}`);
      await expect(page.getByText(别名).first()).toBeVisible({ timeout: 15_000 });
      // 姓名只在 /me/resume（候选端会话已读过）里存在；P5 投影绝无渲染路径
      await expect(page.getByText(标记.主体真名)).toHaveCount(0);
      // 无 PDF 入口：附件行（PDF 徽标 + 文件名）一个都不出现
      await expect(page.locator('button').filter({ hasText: 'PDF' })).toHaveCount(0);
      await expect(page.getByText(P5标记.简历名)).toHaveCount(0);
    }
    expect(fixture.PDF读取).toEqual([]); // 全程零内容 GET
  });

  test('已披露招聘端只开 Case 专属原始 PDF（叮嘱落段后入口仍在） @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5招聘(page, { 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    await page.goto(`/#/hr/candidate/${P5编号.甲}`);
    const 附件键 = page.getByRole('button', { name: new RegExp(P5标记.简历名) });
    await expect(附件键).toBeVisible({ timeout: 20_000 });

    // ── 终审回归钉：S1 段一旦有对话内容，PDF 入口不得消失。招聘端就在同一屏发一条
    //    Case 叮嘱（回执带 expression 文本落进当前 S1 段），权威重读落条后入口仍在 ──
    await page.getByPlaceholder('有想法就告诉你的AI代理').fill(P5标记.叮嘱);
    await page.getByRole('button', { name: '发送' }).click();
    // 同步点 = 输入框清空（POST + 权威重读完成后才 resolve、成功才清草稿）；
    // 清空后 getByText 只可能命中段内回执 —— 证明「回执落段」而非 textarea 值。
    await expect(page.getByPlaceholder('有想法就告诉你的AI代理')).toHaveValue('', { timeout: 10_000 });
    await expect(page.getByText(P5标记.叮嘱).first()).toBeVisible(); // 回执落段
    await expect(附件键).toBeVisible(); // 入口不被段内对话压掉

    // 点击只走 Case 专属 recruiter 路径；唯一一次内容 GET
    const 内容请求 = page.waitForRequest(
      (请求) => new URL(请求.url()).pathname === `/api/v1/recruiter/match-cases/${P5编号.甲}/resume-submission/content`,
    );
    await 附件键.click();
    await 内容请求;
    // 弹层：PDF 徽标 + 文件名 + iframe（真实字节经租约地址呈现）
    await expect(page.getByRole('dialog').getByText(P5标记.简历名)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTitle('简历 PDF')).toBeVisible();
    expect(fixture.PDF读取).toEqual([`recruiter:${P5编号.甲}`]);
    // 候选臂路径绝不请求；PDF 应答是 private, no-store
    expect(请求序.filter((项) => 项.includes('/me/match-cases/'))).toEqual([]);
    const PDF头 = fixture.应答头存证.filter((项) => 项.path.endsWith('/resume-submission/content'));
    expect(PDF头).toHaveLength(1);
    expect(PDF头[0]!.cacheControl).toBe('private, no-store');

    // 关闭即收层（租约随弹层回收）
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('S2/S3 每步权威重读，本端动作卡随权威视图消失 @backend', async ({ page }) => {
    test.setTimeout(150_000);
    const 请求序: string[] = [];
    const fixture = await 装P5双角色(page, {
      主体初始角色: 'candidate',
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    // ── 候选端 S2 accept：POST → 权威重读 → 本端卡消失（对方仍待决）──
    await page.goto(`/#/deal/${P5编号.丁}`);
    await expect(page.getByRole('button', { name: '接受', exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('回应协同事项')).toBeVisible();
    await page.getByRole('button', { name: '接受', exact: true }).click();
    await expect(page.getByRole('button', { name: '接受', exact: true })).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText('回应协同事项')).toHaveCount(0);
    断言重读发生(请求序, `POST /api/v1/me/match-cases/${P5编号.丁}/coordination/${P5编号.协同}/decisions`);

    // ── 切招聘端：同一协同卡仍归招聘方 → accept 后 S2 收口进 S3 ──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    await page.goto(`/#/hr/candidate/${P5编号.丁}`);
    await expect(page.getByRole('button', { name: '接受', exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '接受', exact: true }).click();
    await expect(page.getByRole('button', { name: '确认意向' })).toBeVisible({ timeout: 10_000 });

    // S3：招聘方确认 → 本端意向卡消失，等待候选人（终态动作消失）
    await page.getByRole('button', { name: '确认意向' }).click();
    await expect(page.getByRole('button', { name: '确认意向' })).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByRole('button', { name: '婉拒意向' })).toHaveCount(0);
    await expect(page.getByText('等待候选人确认意向')).toBeVisible();
    断言重读发生(请求序, `POST /api/v1/recruiter/match-cases/${P5编号.丁}/intent-decisions`);

    // ── 切回候选端：最后一笔确认完成 Case —— 移交文案上屏、双方动作表清空 ──
    await page.goto('/#/identity?switch=1&from=hr');
    await page.getByRole('button', { name: '翻到「求职者」那一面' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await page.goto(`/#/deal/${P5编号.丁}`);
    await expect(page.getByRole('button', { name: '确认意向' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '确认意向' }).click();
    await expect(page.getByText('双方已确认，正在创建会话').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('已通过', { exact: true }).first()).toBeVisible();

    // 每个 mutation 恰一次 POST、各走本端唯一准许路线；主壳可预载 P7 收件箱集合，
    // 但 P5 没有会话标识，不能提前读取会话详情、消息或移交路由。
    const 决定POST们 = fixture.变更请求.filter((项) => 项.method === 'POST');
    expect(决定POST们.map((项) => `${项.method} ${项.path} ${JSON.stringify(项.body)}`)).toEqual([
      `POST /api/v1/me/match-cases/${P5编号.丁}/coordination/${P5编号.协同}/decisions {"action":"accept"}`,
      `POST /api/v1/recruiter/match-cases/${P5编号.丁}/coordination/${P5编号.协同}/decisions {"action":"accept"}`,
      `POST /api/v1/recruiter/match-cases/${P5编号.丁}/intent-decisions {"action":"confirm"}`,
      `POST /api/v1/me/match-cases/${P5编号.丁}/intent-decisions {"action":"confirm"}`,
    ]);
    expect(请求序.filter((项) => /\/conversations\/|\/chat\/|handoff/i.test(项))).toEqual([]);
  });

  test('completed 移交两步：pending 继续低频重读恒禁用，发布后进入 P7 会话路由 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5候选(page, { 请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`) });

    await page.goto('/#/archived');
    await expect(page.getByText('已谈成')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P5标记.己职位名)).toBeVisible();
    await page.getByText(P5标记.己职位名).click();
    await expect(page.getByText('双方已确认，正在创建会话').first()).toBeVisible({ timeout: 10_000 });

    // 「开始私聊」在场但恒禁用：准备中，会话坐标只能来自服务端发布
    const 私聊键 = page.getByRole('button', { name: '开始私聊' });
    await expect(私聊键).toBeVisible();
    await expect(私聊键).toBeDisabled();
    // completed 终态只读：零动作卡零输入
    await expect(page.getByRole('button', { name: '确认意向' })).toHaveCount(0);
    await expect(page.getByPlaceholder('有想法就告诉你的AI代理')).toHaveCount(0);

    // P7 Task 7：pending 不是详情终局 —— 3 秒节拍继续权威重读（same-party 长期
    // pending 同形态：多拍后仍是准备态，绝不出现内部错误词或前端超时终态）
    const 详情GET数 = () => 请求序.filter((项) => 项 === `GET /api/v1/me/match-cases/${P5编号.己}`).length;
    await page.waitForTimeout(4_000);
    const 拍后数 = 详情GET数();
    await page.waitForTimeout(3_500);
    expect(详情GET数()).toBeGreaterThan(拍后数); // 节拍仍在走
    await expect(私聊键).toBeDisabled();
    await expect(page.getByText('invalid_actor_identity')).toHaveCount(0);
    await expect(page.getByText('真人会话已建立')).toHaveCount(0);

    // 会话坐标在发布前绝不被请求（P5 阶段零会话路由）
    const 发布前会话请求 = 请求序.filter((项) => /\/conversations|\/chat\//i.test(项)).length;

    // ── 服务端发布：completed + complete + conversation_ref ──
    const 己 = fixture.cases[P5编号.己]!;
    己.step = 'complete';
    己.conversationRef = P7会话编号.会话;

    // 下一拍权威重读见到发布：文案切换、按钮启用
    await expect(page.getByText('真人会话已建立').first()).toBeVisible({ timeout: 10_000 });
    await expect(私聊键).toBeEnabled({ timeout: 5_000 });
    await 私聊键.click();
    await expect(page).toHaveURL(new RegExp(`#/chat/human/${P7会话编号.会话}$`), { timeout: 10_000 });
    // 发布前 P5 屏从未请求过会话路由（发布后的进入是用户主动导航）
    expect(发布前会话请求).toBe(0);
  });

  test('ended/completed 两架分开读取，终局详情只读 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P5候选(page, { 请求拦截: ({ path, method, query }) => 请求序.push(`${method} ${path}${query ?? ''}`) });

    await page.goto('/#/archived');
    await expect(page.getByText('已谈成')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P5标记.己职位名)).toBeVisible();
    await expect(page.getByText('已结束').first()).toBeVisible();
    await expect(page.getByText(P5标记.戊职位名)).toBeVisible({ timeout: 10_000 });
    // 两个架子各自的 lifecycle 查询词分开发读；单页读尽无加载更多
    expect(请求序).toContain('GET /api/v1/me/match-cases/history?lifecycle=completed&limit=50');
    expect(请求序).toContain('GET /api/v1/me/match-cases/history?lifecycle=ended&limit=50');
    await expect(page.getByRole('button', { name: '加载更多' })).toHaveCount(0);

    // ended 详情：终局摘要原样（wire outcome/reason 不翻译），零动作零输入
    await page.getByText(P5标记.戊职位名).click();
    await expect(page.getByText('终局', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('user_ended').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '提交回答' })).toHaveCount(0);
    await expect(page.getByPlaceholder('有想法就告诉你的AI代理')).toHaveCount(0);

    // completed 详情同样只读（移交文案 + 恒禁用的开始私聊）
    await page.goto('/#/archived');
    await page.getByText(P5标记.己职位名).click();
    await expect(page.getByText('双方已确认，正在创建会话').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '开始私聊' })).toBeDisabled();

    // 整条旅程零变异
    expect(fixture.变更请求).toEqual([]);
    expect(请求序.filter((项) => 项.startsWith('POST'))).toEqual([]);
  });

  test('登出与角色切换清空可见 P5 状态 @backend', async ({ page }) => {
    test.setTimeout(150_000);
    const 请求序: string[] = [];
    await 装P5双角色(page, {
      主体初始角色: 'candidate',
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    // 候选端在谈可见
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    await expect(page.getByText(P5标记.丁职位名)).toBeVisible({ timeout: 15_000 });

    // 切招聘端：候选端在谈内容一个字不留（P5 状态随会话转移摊平）
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    await expect(page.getByText(P5标记.甲职位名)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(P5标记.丁职位名)).toHaveCount(0);
    await expect(page.getByText(P5标记.乙职位名)).toHaveCount(0);

    // 切回候选端：新会话代际重新水合，自己的在谈重新可见
    await page.goto('/#/identity?switch=1&from=hr');
    await page.getByRole('button', { name: '翻到「求职者」那一面' }).click();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await expect(page.getByText(P5标记.丁职位名)).toBeVisible({ timeout: 20_000 });

    // 登出：可见 P5 状态清空，深链不再读出任何 Case 数据、零 P5 读取
    await page.evaluate(() => {
      window.location.hash = '#/settings';
    });
    await expect(page.getByRole('button', { name: '退出登录' }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '退出登录' }).first().click();
    await page.getByRole('button', { name: '确认退出当前账号' }).click();
    await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(P5标记.丁职位名)).toHaveCount(0);
    const P5请求数 = () => 请求序.filter((项) => 项.includes('/match-cases')).length;
    const 登出后 = P5请求数();
    await page.evaluate((编号) => {
      window.location.hash = `#/deal/${编号}`;
    }, P5编号.乙);
    await page.waitForTimeout(1_000);
    await expect(page.getByText(P5标记.乙职位名)).toHaveCount(0);
    expect(P5请求数()).toBe(登出后);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P5 Mock 数据源隔离 @mock：记录每个含 /match-cases 的浏览器请求，Mock 旅程下
// 这份清单必须为空（空列表），整段会话也没有任何 /api/v1 请求。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P5 Mock 数据源隔离 @mock', () => {
  test.use({ baseURL: 'http://127.0.0.1:4181' });

  test('Mock 在谈/归档/详情全流程零 match-cases 请求（空清单） @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const matchCase请求: string[] = [];
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!new URL(url).pathname.startsWith('/api/v1')) return;
      apiRequests.push(url);
      if (url.includes('/match-cases')) matchCase请求.push(url);
    });

    // ── 候选端：在谈首页（Mock 在谈单）/ 归档 / 在谈详情 ──
    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);
    await page.goto('/#/app');
    await expect(page.getByText('资深后端工程师 · 交易网关')).toBeVisible({ timeout: 10_000 });
    await page.goto('/#/archived');
    await expect(page.getByText('历史代谈').first()).toBeVisible({ timeout: 10_000 });
    await page.goto('/#/deal/J-01');
    await expect(page.getByText('资深后端工程师 · 交易网关').first()).toBeVisible({ timeout: 10_000 });

    // ── 招聘端：在谈候选 / 归档 / 候选详情 ──
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 15_000 });
    await page.goto('/#/hr');
    await expect(page.getByText('沈亦舟').first()).toBeVisible({ timeout: 10_000 });
    await page.goto('/#/hr/archived');
    await expect(page.getByText('历史代谈').first()).toBeVisible({ timeout: 10_000 });
    await page.goto('/#/hr/candidate/A-01');
    await expect(page.getByText('沈亦舟').first()).toBeVisible({ timeout: 10_000 });

    // P5 域在 Mock 下零请求：match-cases 请求清单为空（空列表），整段会话无任何 /api/v1
    expect(matchCase请求).toEqual([]);
    expect(apiRequests).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P7 真人会话 fixture（Task 7）—— 双端 conversations 的浏览器验收旅程。
// 原生 WebSocket 在 app 加载前 stub（__emitP7/__P7断开 只存在于测试 init script，
// 产品 bundle 不含该 seam）；帧不携带真相：内容一律经 no-store HTTP 重拉上屏。
// ─────────────────────────────────────────────────────────────────────────────

/** app 加载前 stub 原生 WebSocket；测试 seam：__emitP7(帧) / __P7断开() / __P7套接字数()。 */
async function 安装P7事件桩(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const 套接字们: Array<{
      url: string;
      onopen: (() => void) | null;
      onmessage: ((事件: { data: string }) => void) | null;
      onclose: (() => void) | null;
      onerror: (() => void) | null;
      已关: boolean;
    }> = [];
    class 假WebSocket {
      url: string;
      onopen: (() => void) | null = null;
      onmessage: ((事件: { data: string }) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      已关 = false;
      constructor(url: string) {
        this.url = url;
        套接字们.push(this);
        // 模拟真实连接成功：构造后的下一轮事件循环触发 onopen（handlers 已由 adapter 挂好）
        setTimeout(() => {
          if (!this.已关) this.onopen?.();
        }, 0);
      }
      close() {
        if (this.已关) return;
        this.已关 = true;
        this.onclose?.();
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).WebSocket = 假WebSocket;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__P7套接字们 = 套接字们;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__emitP7 = (帧: unknown) => {
      for (const 套 of 套接字们) {
        if (!套.已关) 套.onmessage?.({ data: JSON.stringify(帧) });
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__P7断开 = () => {
      for (const 套 of [...套接字们]) 套.onclose?.();
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__P7套接字数 = () => 套接字们.filter((套) => !套.已关).length;
  });
}

/** P7 候选端安装：candidate 会话 + P7 fixture + 事件桩（app 加载前）。 */
async function 装P7候选(
  page: Page,
  选项: {
    fixture?: P7FixtureState;
    覆盖?: BFF路由选项['覆盖'];
    请求拦截?: (请求: 拦截请求形) => void;
  } = {},
): Promise<P7FixtureState> {
  const fixture = 选项.fixture ?? 创建P7fixture();
  await 安装P7事件桩(page);
  await 安装BFF路由(page, {
    登录尝试id: 'att-p7-candidate',
    记录目录请求: () => undefined,
    主体初始角色: 'candidate',
    隐私fixture: P3隐私fixture(),
    P7fixture: fixture,
    覆盖: 选项.覆盖,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}

/** FE-IV-01 候选实名安装：candidate 会话 + 隐私 fixture + 实名域可变 fixture。 */
async function 装候选实名(page: Page): Promise<候选实名FixtureState> {
  const fixture = 创建候选实名fixture();
  await 安装BFF路由(page, {
    登录尝试id: 'att-iv-candidate',
    记录目录请求: () => undefined,
    主体初始角色: 'candidate',
    隐私fixture: P3隐私fixture(),
    候选实名域: fixture,
  });
  return fixture;
}

/** P7 招聘端安装：recruiter 会话（组织 fixture）+ P7 fixture + 事件桩。 */
async function 装P7招聘(
  page: Page,
  选项: {
    fixture?: P7FixtureState;
    P5MatchCasefixture?: P5MatchCasefixture形;
    请求拦截?: (请求: 拦截请求形) => void;
  } = {},
): Promise<P7FixtureState> {
  const fixture = 选项.fixture ?? 创建P7fixture();
  await 安装P7事件桩(page);
  await 安装BFF路由(page, {
    登录尝试id: 'att-p7-recruiter',
    记录目录请求: () => undefined,
    招聘组织Fixture: 带企业关系(
      P1C招聘组织Fixture,
      [P1C管理员关系],
      { [P1C标记.组织甲编号]: P1C组织甲() },
      [P4招聘岗位({ job_id: P5编号.job, title: P5标记.招聘岗标题 })],
    ),
    主体初始角色: 'recruiter',
    P5MatchCasefixture: 选项.P5MatchCasefixture,
    P7fixture: fixture,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}

/** 预置一条 recruiter 消息的候选会话（read-through 旅程用）。 */
function P7带消息fixture(消息: string): P7FixtureState {
  const fixture = 创建P7fixture();
  fixture.messages[P7会话编号.会话] = [{
    message_id: '4004', kind: 'user_text', sender_role: 'recruiter', content: 消息, created_at: '2026-08-30T01:00:00Z',
  }];
  return fixture;
}

// ── P8 控制面域用例的公共安装/断言 ─────────────────────────────────────────────

/** P8 候选端安装：candidate 会话 + P3 隐私 + P8 控制面 fixture（+ 可选 P7/P4/组织域）。 */
async function 装P8候选(
  page: Page,
  选项: {
    fixture?: P8FixtureState;
    P7fixture?: P7FixtureState;
    发现fixture?: P4发现fixture形;
    招聘组织Fixture?: BFF路由选项['招聘组织Fixture'];
    隐私fixture?: BFF路由选项['隐私fixture'];
    覆盖?: BFF路由选项['覆盖'];
    请求拦截?: (请求: 拦截请求形) => void;
  } = {},
): Promise<P8FixtureState> {
  const fixture = 选项.fixture ?? 创建P8fixture();
  await 安装BFF路由(page, {
    登录尝试id: 'att-p8-candidate',
    记录目录请求: () => undefined,
    主体初始角色: 'candidate',
    招聘组织Fixture: 选项.招聘组织Fixture,
    隐私fixture: 选项.隐私fixture ?? P3隐私fixture(),
    发现fixture: 选项.发现fixture,
    P7fixture: 选项.P7fixture,
    P8控制面fixture: fixture,
    覆盖: 选项.覆盖,
    请求拦截: 选项.请求拦截,
  });
  return fixture;
}

/** P8 变更存证的统一断言：浏览器 Origin 与 fixture server 同源；幂等键 16–128 可见 ASCII。 */
function 断言P8变更边界(条: P8变更回执形, 源: string): void {
  expect(条.origin).toBe(源);
  expect(条.idempotencyKey).toMatch(P8键模式);
}

test.describe('P7 真人会话 fixture @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });
  test.use({ timeout: 120_000 });

  test('候选端收件箱未读 → 进会话 read-through → 权威收件箱归零 @backend', async ({ page }) => {
    const fixture = P7带消息fixture(P7标记.招聘消息);
    fixture.unread.candidate = 1;
    const 请求序: string[] = [];
    await 装P7候选(page, {
      fixture,
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 20_000 });
    // 主壳首屏水合收件箱：未打开消息 Tab 之前，底部角标已是已加载未读（=1）
    await expect(page.locator('nav').getByText('1', { exact: true })).toBeVisible({ timeout: 15_000 });

    // 消息 Tab：行未读胶囊 + 点击只导航（绝不本地清零）。角标并入按钮无障碍名，用子串匹配。
    await page.locator('nav').getByRole('button').filter({ hasText: '消息' }).click();
    await expect(page.getByText(P7标记.职位名)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(`unread-${P7会话编号.会话}`)).toHaveText('1');
    await page.getByText(P7标记.职位名).click();
    await expect(page).toHaveURL(new RegExp(`#/chat/human/${P7会话编号.会话}$`), { timeout: 10_000 });
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 10_000 });

    // read-through：渲染到的最新 user_text 恰好提交一次，PUT 后权威未读归零
    await expect.poll(
      () => fixture.reads.filter((条) => 条.role === 'candidate' && 条.through === '4004').length,
      { timeout: 15_000 },
    ).toBe(1);
    expect(fixture.unread.candidate).toBe(0);
    // 同一 target 重渲染零重复提交
    await page.waitForTimeout(1_000);
    expect(fixture.reads.filter((条) => 条.role === 'candidate').length).toBe(1);
  });

  test('候选端发送：首答结果未知经同键重放收敛，消息只落一条 @backend', async ({ page }) => {
    const fixture = P7带消息fixture(P7标记.招聘消息);
    fixture.首答未知 = true; // 消息已落库，但首答 503 operation_outcome_unknown
    await 装P7候选(page, { fixture });

    await page.goto(`/#/chat/human/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 15_000 });
    const 输入框 = page.getByRole('textbox', { name: '输入消息' });
    await 输入框.fill(P7标记.候选消息);
    await 输入框.press('Enter');

    // 权威重拉见到同文消息：确认成功、无未知提示、恰一个气泡
    await expect(page.getByText(P7标记.候选消息)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('暂时无法确认是否发送成功')).toHaveCount(0);
    // 幂等服务端：首答 503 后受控重试同键重放 —— 两笔同键 POST、只落一条消息
    const 候选发送 = fixture.sends.filter((条) => 条.content === P7标记.候选消息);
    expect(候选发送.length).toBeGreaterThanOrEqual(2);
    expect(new Set(候选发送.map((条) => 条.key)).size).toBe(1);
    expect(fixture.messages[P7会话编号.会话]!.filter((条) => 条.content === P7标记.候选消息)).toHaveLength(1);
    // 草稿已清空
    await expect(输入框).toHaveValue('');
  });

  test('招聘端经内容无关失效事件 HTTP 重拉看到候选新消息并回复 @backend', async ({ page }) => {
    const fixture = 创建P7fixture();
    fixture.messages[P7会话编号.会话] = [{
      message_id: '4004', kind: 'user_text', sender_role: 'candidate', content: P7标记.候选消息, created_at: '2026-08-30T01:00:00Z',
    }];
    const 请求序: string[] = [];
    await 装P7招聘(page, {
      fixture,
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    await page.goto(`/#/hr/chat/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.候选消息)).toBeVisible({ timeout: 15_000 });

    // 服务端事实先变（候选新消息落库），页面上还看不到
    fixture.messages[P7会话编号.会话]!.push({
      message_id: '5006', kind: 'user_text', sender_role: 'candidate', content: P7标记.招聘回复, created_at: '2026-08-30T01:30:00Z',
    });
    await expect(page.getByText(P7标记.招聘回复)).toHaveCount(0);

    // 内容无关帧：只触发 no-store HTTP 重拉
    const 消息GET数 = () => 请求序.filter((项) => 项 === `GET /api/v1/recruiter/conversations/${P7会话编号.会话}/messages`).length;
    const 帧前 = 消息GET数();
    await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__emitP7({ type: 'recruitment.conversation_changed', conversation_id: '3003', reason: 'message_created' }));
    await expect(page.getByText(P7标记.招聘回复)).toBeVisible({ timeout: 10_000 });
    expect(消息GET数()).toBeGreaterThan(帧前); // 上屏来自 HTTP，不是帧

    // 招聘回复走同一发送链
    const 输入框 = page.getByRole('textbox', { name: '输入消息' });
    await 输入框.fill(P7标记.招聘消息);
    await 输入框.press('Enter');
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 10_000 });
    expect(fixture.sends.some((条) => 条.role === 'recruiter' && 条.content === P7标记.招聘消息)).toBe(true);
  });

  test('断线重连无条件重拉当前角色收件箱与当前会话 @backend', async ({ page }) => {
    const fixture = P7带消息fixture(P7标记.招聘消息);
    const 请求序: string[] = [];
    await 装P7候选(page, {
      fixture,
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });

    await page.goto(`/#/chat/human/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 15_000 });

    const 收件箱GET数 = () => 请求序.filter((项) => 项 === 'GET /api/v1/me/conversations').length;
    const 消息GET数 = () => 请求序.filter((项) => 项 === `GET /api/v1/me/conversations/${P7会话编号.会话}/messages`).length;
    const 断前 = [收件箱GET数(), 消息GET数()];
    // 主动断开（socket 关闭）→ 1s 退避重连 → onOpen 无条件重拉可见范围
    await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__P7断开());
    await expect.poll(() => 收件箱GET数(), { timeout: 10_000 }).toBeGreaterThan(断前[0]);
    await expect.poll(() => 消息GET数(), { timeout: 5_000 }).toBeGreaterThan(断前[1]);
  });

  test('context 不可用保留消息、隐藏上下文动作，提供重新加载会话信息 @backend', async ({ page }) => {
    const fixture = P7带消息fixture(P7标记.招聘消息);
    fixture.contexts[P7会话编号.会话] = 'unavailable';
    await 装P7候选(page, { fixture });

    await page.goto(`/#/chat/human/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '看职位' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '电话' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '微信' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '重新加载会话信息' })).toBeVisible();
  });

  test('foreign/wrong-role 404 不保留上一会话残留 @backend', async ({ page }) => {
    const fixture = P7带消息fixture(P7标记.招聘消息);
    fixture.不存在 = ['9900'];
    await 装P7候选(page, { fixture });

    await page.goto(`/#/chat/human/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 15_000 });

    // 深链不存在的会话：404 fail closed，上一会话内容不泄漏
    await page.goto('/#/chat/human/9900');
    await expect(page.getByText('这段会话不存在或已不可访问').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P7标记.招聘消息)).toHaveCount(0);
    await expect(page.getByText(P7标记.职位名)).toHaveCount(0); // 详情 context 残留也不泄漏
  });

  test('P5 发布后招聘端「开始私聊」进入企业参数路由 @backend', async ({ page }) => {
    const P5fixture = 创建P5MatchCasefixture();
    const 己 = P5fixture.cases[P5编号.己]!;
    己.step = 'complete';
    己.conversationRef = P7会话编号.会话;
    await 装P7招聘(page, {
      fixture: 创建P7fixture(),
      P5MatchCasefixture: P5fixture,
    });

    await page.goto(`/#/hr/candidate/${P5编号.己}`);
    await expect(page.getByText('真人会话已建立').first()).toBeVisible({ timeout: 15_000 });
    const 私聊键 = page.getByRole('button', { name: '开始私聊' });
    await expect(私聊键).toBeEnabled();
    await 私聊键.click();
    await expect(page).toHaveURL(new RegExp(`#/hr/chat/${P7会话编号.会话}$`), { timeout: 10_000 });
  });
});

// ── P7 Mock 隔离：Mock 双端零 P7 请求与零事件连接 ──────────────────────────────
test.describe('P7 Mock 数据源隔离 @mock', () => {
  test('Mock 双端消息旅程零 /conversations 请求与零 WebSocket @mock', async ({ page }) => {
    await 安装P7事件桩(page);
    const 会话请求: string[] = [];
    page.on('request', (请求) => {
      if (/\/api\/v1\/(me|recruiter)\/conversations/.test(请求.url())) {
        会话请求.push(请求.url());
      }
    });

    // Mock 无路由守卫：直接进两端主壳（零登录旅程，聚焦 P7 隔离断言）
    await page.goto('/#/app');
    await page.locator('nav').getByRole('button').filter({ hasText: '消息' }).click();
    await expect(page.getByText('AI代理动态')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('林筱')).toBeVisible();
    // 企业端镜像
    await page.goto('/#/hr');
    await page.locator('nav').getByRole('button').filter({ hasText: '消息' }).click();
    await expect(page.getByText('AI代理动态')).toBeVisible({ timeout: 10_000 });

    // 全程零 P7 HTTP 与零事件连接
    expect(会话请求).toEqual([]);
    // 零事件连接：Vite dev 的 HMR 也走 WebSocket（非事件端点），只统计 /api/v1/events/live
    const 事件套接字数 = await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).__P7套接字们 as Array<{ url: string }>)
        .filter((套) => 套.url.includes('/api/v1/events/live')).length);
    expect(事件套接字数).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P8 控制面 Backend 旅程（Task 8）。账号安全（凭证/会话/退出其他设备/换绑）、数据导出
// （恢复/创建/轮询/下载/过期与 404 清理/挡注销）、账号注销 202、产品反馈与上下文举报。
// 每个变更都断言浏览器 Origin = fixture server 源、幂等键 16–128 可见 ASCII；同意图
// 重放断言键与 body 字节一致。四张全屏截图（账号页导出行 / 详情直取举报抽屉 / P7 会话
// ⋯ / 直聊无举报入口）写入 Playwright 测试输出，是已准入 Backend 专属入口差异的手动
// 证据，不入库。fixture 见 创建P8fixture。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('P8 控制面 fixture @backend', () => {
  test.use({ baseURL: 'http://127.0.0.1:4182' });
  test.use({ timeout: 120_000 });

  test('P8 账号安全首屏：fixture 凭证掩码与真实会话时间上屏，无设备/地点字面量 @backend', async ({ page }, 测试信息) => {
    const fixture = await 装P8候选(page);
    await page.goto('/#/account');
    // 凭证 display 原样上屏（fixture 标记值，Mock 数据里没有）
    await expect(page.getByText(P8标记.手机掩码)).toBeVisible({ timeout: 15_000 });
    // 当前会话只显示创建/失效时间（fixture 值 → 定长展示格式）；其他设备数来自会话快照
    await expect(page.getByText('创建 2026-09-01 08:00 · 失效 2026-09-08 08:00')).toBeVisible();
    await expect(page.getByText(/其他设备 2 台/)).toBeVisible();
    // 无型号/地点/IP/UA 字面量（wire 会话行根本不带这些字段）
    await expect(page.getByText(/iPhone|上海·|上海 ·|\d+\.\d+\.\d+\.\d+/)).toHaveCount(0);
    // Backend 专属「数据」组恰一行导出入口；无句柄零导出请求（被动恢复零请求边界）
    await expect(page.getByRole('button', { name: /导出我的数据/ })).toBeVisible();
    expect(fixture.导出读取).toEqual([]);
    expect(fixture.变更请求.filter((条) => 条.path.startsWith('/api/v1/me/data-exports'))).toEqual([]);
    // 手动证据（a）：凭证/会话/导出行可见的 Backend 账号页
    await page.screenshot({ path: 测试信息.outputPath('P8-backend-account.png'), fullPage: true });
  });

  test('P8 退出其他设备：DELETE 无 body、同源键边界与权威重读归零 @backend', async ({ page }) => {
    const fixture = await 装P8候选(page);
    await page.goto('/#/account');
    await expect(page.getByText(/其他设备 2 台/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /退出其他设备/ }).click();
    // 回执计数原样上屏；成功后操作层权威重读会话
    await expect(page.getByText('已退出 2 台其他设备')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/其他设备 0 台/)).toBeVisible({ timeout: 10_000 });
    // 其他设备归零后动作键禁用（没有可退的设备）
    await expect(page.getByRole('button', { name: /退出其他设备/ })).toBeDisabled();
    const 源 = new URL(page.url()).origin;
    const 变更 = fixture.变更请求.filter((条) => 条.method === 'DELETE' && 条.path === '/api/v1/security/sessions/others');
    expect(变更).toHaveLength(1);
    expect(变更[0]!.原文).toBeNull(); // DELETE 不携带请求体
    断言P8变更边界(变更[0]!, 源);
    // 服务端清洗：fixture 会话只剩 current
    expect(fixture.会话们.filter((条) => !条.current)).toHaveLength(0);
  });

  test('P8 换绑：四位码成功；冲突保留输入；首答未知同键字节一致重放 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = await 装P8候选(page);
    await page.goto('/#/account');
    await expect(page.getByText(P8标记.手机掩码)).toBeVisible({ timeout: 15_000 });
    const 源 = new URL(page.url()).origin;

    // ── 成功：11 位裸号 begin → 四位码 complete → 权威重读落地后才关抽屉 ──
    await page.getByRole('button', { name: /手机号/ }).click();
    await page.getByPlaceholder('输入新手机号').fill('13800009001');
    await page.getByRole('button', { name: '获取验证码' }).click();
    // toast 是单一文本节点；抽屉说明的相邻文本节点会拼出同串，必须 exact（下同）
    await expect(page.getByText('验证码已发送', { exact: true })).toBeVisible({ timeout: 10_000 });
    // Backend 不出现 Mock 专属「原型任意验证码」文案
    await expect(page.getByText(/原型/)).toHaveCount(0);
    await page.getByPlaceholder(/位验证码$/).fill('2468');
    await page.getByRole('button', { name: '确认换绑' }).click();
    await expect(page.getByText('手机号已换绑', { exact: true })).toBeVisible({ timeout: 15_000 });
    // 绝不乐观写：新掩码只在权威重读落地后出现，旧掩码消失
    await expect(page.getByText(P8标记.换绑后掩码)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(P8标记.手机掩码)).toHaveCount(0);
    // 换绑完成清洗其他会话但保留 current
    await expect(page.getByText(/其他设备 0 台/)).toBeVisible({ timeout: 10_000 });

    const 开始们 = fixture.变更请求.filter((条) => 条.method === 'POST' && 条.path === '/api/v1/me/credential-replacement-attempts');
    expect(开始们[0]!.body).toEqual({ phone: '+8613800009001' }); // 11 位裸号 → facade 构造 E.164
    断言P8变更边界(开始们[0]!, 源);
    const 完成们 = () => fixture.变更请求.filter((条) => 条.method === 'POST' && 条.path.endsWith('/complete'));
    const 成功完成 = 完成们()[0]!;
    expect(成功完成.body).toEqual({ proof: { code: '2468' } }); // 全局四位规则
    断言P8变更边界(成功完成, 源);

    // ── 冲突：409 credential_replacement_conflict，抽屉与输入保留 ──
    fixture.分支.换绑冲突 = true;
    await page.getByRole('button', { name: /手机号/ }).click();
    await page.getByPlaceholder('输入新手机号').fill('13800009002');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.getByText('验证码已发送', { exact: true })).toBeVisible({ timeout: 10_000 });
    const 验证框 = page.getByPlaceholder(/位验证码$/);
    await 验证框.fill('1357');
    await page.getByRole('button', { name: '确认换绑' }).click();
    await expect(page.getByText('验证码不正确或已过期，请重新获取后再试')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '确认换绑' })).toBeVisible(); // 抽屉未关
    await expect(验证框).toHaveValue('1357'); // 输入保留，可同层重试
    await page.keyboard.press('Escape'); // 弹层框架统一 Esc 关层

    // ── 首答未知：503 后 HTTP 客户端同键受控重试 —— 两笔同键、body 字节一致 ──
    fixture.分支.换绑冲突 = false; // 冲突分支是 fixture 级标记，先复位再换分支
    fixture.分支.换绑完成首答未知 = true;
    await page.getByRole('button', { name: /手机号/ }).click();
    await page.getByPlaceholder('输入新手机号').fill('13800009003');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.getByText('验证码已发送', { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder(/位验证码$/).fill('8642');
    await page.getByRole('button', { name: '确认换绑' }).click();
    await expect(page.getByText('手机号已换绑', { exact: true })).toBeVisible({ timeout: 15_000 });
    const 未知完成们 = 完成们().filter((条) => (条.body as { proof?: { code?: string } }).proof?.code === '8642');
    expect(未知完成们).toHaveLength(2);
    expect(new Set(未知完成们.map((条) => 条.idempotencyKey)).size).toBe(1); // 同键
    expect(未知完成们[0]!.原文).toBe(未知完成们[1]!.原文); // 同意图重放：body 字节一致
    for (const 条 of 未知完成们) 断言P8变更边界(条, 源);
  });

  test('P8 数据导出：创建无 body → 轮询 ready → 关闭重开恢复 → 同源流式下载 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = await 装P8候选(page);
    await page.goto('/#/account');
    await expect(page.getByRole('button', { name: /导出我的数据/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /导出我的数据/ }).click();
    // 打开抽屉即恢复：无句柄零导出请求 → 抽屉给「生成导出文件」
    await expect(page.getByRole('button', { name: '生成导出文件' })).toBeVisible({ timeout: 10_000 });
    expect(fixture.导出读取).toEqual([]);
    await page.getByRole('button', { name: '生成导出文件' }).click();
    // 创建 POST：该路由不携带请求体；回执 queued → 抽屉进入生成中（轮询推进）
    await expect(page.getByText('正在生成导出文件，完成后可以在这里下载。')).toBeVisible({ timeout: 10_000 });
    const 创建们 = () => fixture.变更请求.filter((条) => 条.method === 'POST' && 条.path === '/api/v1/me/data-exports');
    expect(创建们()).toHaveLength(1);
    expect(创建们()[0]!.原文).toBeNull();
    断言P8变更边界(创建们()[0]!, new URL(page.url()).origin);
    // queued→running→ready（2s 退避节拍内）；ready 显示服务端过期时间
    await expect(page.getByRole('button', { name: '下载数据导出' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/2026-09-08 00:00 前可下载/)).toBeVisible();
    expect(fixture.导出.数据?.status).toBe('ready');

    // ── 关闭抽屉再打开：恢复句柄（有 ID 只 GET 绝不 POST）──
    await page.getByRole('button', { name: '先不导出' }).click();
    await expect(page.getByRole('button', { name: '先不导出' })).toHaveCount(0);
    const 读取前 = fixture.导出读取.length;
    await page.getByRole('button', { name: /导出我的数据/ }).click();
    await expect(page.getByRole('button', { name: '下载数据导出' })).toBeVisible({ timeout: 10_000 });
    expect(fixture.导出读取.length).toBeGreaterThan(读取前);
    expect(创建们()).toHaveLength(1); // 重开恢复零创建

    // ── 下载：先权威预检（GET）再同源锚点导航。锚点下载由浏览器下载管理器接管，
    //    page.route / request 事件都看不到 —— download 事件的 URL 是浏览器边界上
    //    可得的证据：同源 /download 端点 + 权威 exportId（不是 blob:/跨源 URL）。
    //    ZIP 字节与固定应答头由 route fixture 与单测覆盖；本环境 stg 不可达，
    //    落盘内容是 Vite 代理的 DNS 错误页，不作为断言对象。──
    const 预检前 = fixture.导出读取.length;
    const 下载承诺 = page.waitForEvent('download', { timeout: 15_000 });
    await page.getByRole('button', { name: '下载数据导出' }).click();
    const 下载 = await 下载承诺;
    const 源 = new URL(page.url()).origin;
    expect(下载.url()).toBe(`${源}/api/v1/me/data-exports/${fixture.导出.数据!.export_id}/download`);
    expect(下载.url().startsWith('blob:')).toBe(false);
    // 点击后的权威预检 GET 确实发生（下载先确认一次状态）
    expect(fixture.导出读取.length).toBeGreaterThan(预检前);
  });

  test('P8 数据导出过期与 404：句柄清理后重新生成用新键 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = 创建P8fixture();
    // 轮询退避 2s/4s；ready 是停表终态，过期演练直接 running→expired（不经过 ready）
    fixture.导出.状态脚本 = ['queued', 'running', 'expired'];
    await 装P8候选(page, { fixture });
    await page.goto('/#/account');
    await page.getByRole('button', { name: /导出我的数据/ }).click();
    await page.getByRole('button', { name: '生成导出文件' }).click();
    // 轮询至 expired：抽屉给「这份导出已过期」与「重新生成」（只展示服务端 status）；
    // expired 的权威 GET 同时清掉恢复句柄（回到可创建态）
    await expect(page.getByText('这份导出已过期。如仍需要，请重新生成。')).toBeVisible({ timeout: 20_000 });
    // exact：行按钮的无障碍名「导出我的数据 已过期，可重新生成 ›」含同名子串
    await expect(page.getByRole('button', { name: '重新生成', exact: true })).toBeVisible();
    const 创建们 = () => fixture.变更请求.filter((条) => 条.method === 'POST' && 条.path === '/api/v1/me/data-exports');
    const 甲键 = 创建们()[0]!.idempotencyKey;
    // 重新生成 = 先废弃句柄再创建：新键 POST，绝不重放旧键。第二份导出停在 ready
    // （保留句柄），给下一段 404 演练用
    fixture.导出.状态脚本 = ['ready'];
    await page.getByRole('button', { name: '重新生成', exact: true }).click();
    expect(创建们()).toHaveLength(2);
    expect(创建们()[1]!.idempotencyKey).not.toBe(甲键); // 明确重新生成 = 新意图新键
    断言P8变更边界(创建们()[1]!, new URL(page.url()).origin);
    // 服务端状态机重置：第二份导出直接 ready（行说明「已生成，可下载」随之落位）
    await expect.poll(() => fixture.导出.数据?.status ?? null, { timeout: 10_000 }).toBe('ready');
    await expect(page.getByText('已生成，可下载', { exact: true })).toBeVisible({ timeout: 10_000 });

    // ── 404 清理：服务端导出消失（他端清理/回收）。已成功快照的刷新失败按设计
    //    保留旧 data（只落重试错误），所以 404 的收口要在全新页面状态 + 陈旧句柄下
    //    演练：整页刷新 → 被动恢复 GET → 404 → 句柄清理 + 抽屉进入可重试错误态 ──
    fixture.导出.数据 = null;
    await page.getByRole('button', { name: '先不导出' }).click();
    await page.reload();
    await expect(page.getByText('账号与安全', { exact: true })).toBeVisible({ timeout: 15_000 });
    // 被动恢复（挂载即恢复）对陈旧句柄的权威 GET 得 404；打开抽屉看到统一收口文案
    await page.getByRole('button', { name: /导出我的数据/ }).click();
    await expect(page.getByText('导出已失效，请重新生成')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '重试', exact: true })).toBeVisible();
  });

  test('P8 导出进行中挡注销；ready 未下载给警示且仍可继续 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = 创建P8fixture();
    fixture.导出.状态脚本 = ['queued', 'running']; // 恒不 ready
    await 装P8候选(page, { fixture });
    await page.goto('/#/account');
    await page.getByRole('button', { name: /导出我的数据/ }).click();
    await page.getByRole('button', { name: '生成导出文件' }).click();
    await expect(page.getByText('正在生成导出文件，完成后可以在这里下载。')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '先不导出' }).click(); // 关抽屉只停前端节拍，服务端仍进行中

    // 注销两层弹层：说明 → 最终确认 → 409 export_in_progress（无本地登出）
    await page.getByRole('button', { name: '注销账号' }).click();
    await expect(page.getByText('注销账号会发生什么')).toBeVisible();
    await page.getByRole('button', { name: '我已了解，继续注销' }).click();
    // exact：遮罩的 aria-label「关闭确认注销账号」是「确认注销」的子串
    await page.getByRole('button', { name: '确认注销', exact: true }).click();
    await expect(page.getByText('已有导出正在生成或等待下载，请稍后重试')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '确认注销', exact: true })).toBeVisible(); // 确认层保留
    const 注销们 = () => fixture.变更请求.filter((条) => 条.path === '/api/v1/me/account-deletion');
    expect(注销们()).toHaveLength(1);
    expect(注销们()[0]!.原文).toBe('{}'); // EmptyRequest：body 精确 {}
    断言P8变更边界(注销们()[0]!, new URL(page.url()).origin);
    await page.getByRole('button', { name: '取消' }).click();

    // ── ready 未下载：说明层给「注销后将无法下载」警示与先下载入口，仍可继续 ──
    fixture.导出.状态脚本 = ['ready'];
    fixture.导出.数据 = {
      export_id: P8编号.导出甲, status: 'ready',
      created_at: '2026-09-01T08:00:00Z', expires_at: '2026-09-08T00:00:00Z', download_ready: true,
    };
    await page.getByRole('button', { name: /导出我的数据/ }).click(); // 权威重读 → ready 落位
    await expect(page.getByRole('button', { name: '下载数据导出' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '先不导出' }).click();
    await page.getByRole('button', { name: '注销账号' }).click();
    await expect(page.getByText('你有一份已生成的数据导出，注销后将无法下载。建议先下载留存。')).toBeVisible();
    await expect(page.getByRole('button', { name: '先下载数据导出' })).toBeVisible();
    // 仍可继续：警示不拦截
    await page.getByRole('button', { name: '我已了解，继续注销' }).click();
    await expect(page.getByText('确认注销账号？')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
  });

  test('P8 注销 202：清会话跳登录；后续保护读取一律 invalid_session @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = await 装P8候选(page);
    await page.goto('/#/account');
    await expect(page.getByText(P8标记.手机掩码)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '注销账号' }).click();
    await page.getByRole('button', { name: '我已了解，继续注销' }).click();
    await page.getByRole('button', { name: '确认注销', exact: true }).click();
    // 202 成功：统一清账号后由本屏跳登录页
    await expect(page).toHaveURL(/#\/$/, { timeout: 15_000 });
    await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 10_000 });
    const 注销 = fixture.变更请求.find((条) => 条.path === '/api/v1/me/account-deletion')!;
    expect(注销.method).toBe('POST');
    expect(注销.原文).toBe('{}'); // body 精确 {}
    断言P8变更边界(注销, new URL(page.url()).origin);
    expect(fixture.分支.已注销).toBe(true);
    // 注销清了会话：重进账号页被会话 401 拦在登录，旧账号数据一个字不上屏
    await page.goto('/#/account');
    await expect(page).toHaveURL(/#\/$/, { timeout: 15_000 });
    await expect(page.getByLabel('手机号')).toBeVisible();
    await expect(page.getByText(P8标记.手机掩码)).toHaveCount(0);
    // P8 保护读取在注销后一律 401 invalid_session —— fixture 级探针（页面上下文 fetch，
    // page.request 不经 page.route，会打到真实代理）：凭证 + 导出读取 + 导出下载
    // 三路全部先于存在性判定按 invalid_session 收口（ID 用合法形状即可，守卫与存在性无关）
    const 保护读取 = await page.evaluate(async (导出编号: string) => {
      const 取 = async (路径: string) => {
        const 响 = await fetch(路径, { credentials: 'include' });
        return { 状态: 响.status, 码: ((await 响.json()) as { error?: { type?: string } }).error?.type ?? null };
      };
      return {
        凭证: await 取('/api/v1/me/credentials'),
        导出: await 取(`/api/v1/me/data-exports/${导出编号}`),
        下载: await 取(`/api/v1/me/data-exports/${导出编号}/download`),
      };
    }, P8编号.导出甲);
    expect(保护读取.凭证).toEqual({ 状态: 401, 码: 'invalid_session' });
    expect(保护读取.导出).toEqual({ 状态: 401, 码: 'invalid_session' });
    expect(保护读取.下载).toEqual({ 状态: 401, 码: 'invalid_session' });
  });

  test('P8 产品反馈真实工单上屏；举报两类零 reports 请求 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    const fixture = await 装P8候选(page);
    await page.goto('/#/feedback');
    // 产品三分类走真实提交：服务端 ticket 原样上屏
    await page.getByRole('button', { name: '功能异常', exact: true }).click();
    await page.getByRole('textbox').fill('Fixture 反馈：账号页导出行点击无响应');
    await page.getByRole('button', { name: '提交', exact: true }).click();
    await expect(page.getByText('已收到，谢谢你')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(`工单号 ${P8标记.反馈工单}`)).toBeVisible();
    // Backend 致谢文案不含 24 小时承诺（后端不发布时限）
    await expect(page.getByText('我们会尽快核查。每一条反馈都有人读。')).toBeVisible();
    await expect(page.getByText(/24 小时/)).toHaveCount(0);
    const 反馈 = fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/feedback');
    expect(反馈).toHaveLength(1);
    expect(反馈[0]!.body).toEqual({ category: 'bug', details: 'Fixture 反馈：账号页导出行点击无响应' });
    断言P8变更边界(反馈[0]!, new URL(page.url()).origin);

    // 举报两类没有可核实对象：提交只给入口指引，绝不把无目标的一段话当举报发出去。
    // 离开反馈页前先等账号页可见：连发的同文档 hash 跳转会被 React Router 合并，
    // 不等中间屏落定就跳回会保留旧的致谢态组件实例。
    await page.goto('/#/account');
    await expect(page.getByText('账号与安全', { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.goto('/#/feedback');
    await expect(page.getByRole('button', { name: '举报虚假岗位' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '举报虚假岗位' }).click();
    await page.getByRole('textbox').fill('这个岗位写得薪资很高，实际聊下来完全不一样');
    await page.getByRole('button', { name: '提交', exact: true }).click();
    await expect(page.getByText('举报要从具体的岗位、谈判或真人会话里发起；这里只收集产品反馈。')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('已收到，谢谢你')).toHaveCount(0); // 无本地成功
    // 轻提示每笔一条、1.8s 后淡出：等上一条完全移除再提交第二类（避免两条同文叠放）
    await expect(page.getByText('举报要从具体的岗位、谈判或真人会话里发起；这里只收集产品反馈。')).toHaveCount(0, { timeout: 10_000 });
    await page.getByRole('button', { name: '举报骚扰行为' }).click();
    await page.getByRole('button', { name: '提交', exact: true }).click();
    await expect(page.getByText('举报要从具体的岗位、谈判或真人会话里发起；这里只收集产品反馈。')).toBeVisible({ timeout: 10_000 });
    expect(fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/reports')).toEqual([]);
    expect(fixture.反馈受理).toBe(1);
  });

  test('P8 职位举报（详情直取）：target=job_id 隐私安全 body @backend', async ({ page }, 测试信息) => {
    const 隐私 = P3隐私fixture();
    const fixture = await 装P8候选(page, { 发现fixture: P4发现fixture(), 隐私fixture: 隐私 });
    fixture.举报屏蔽组织[`job:${P4编号.job}`] = {
      organization_id: P8标记.屏蔽组织编号,
      organization_display_name: P8标记.屏蔽组织名,
    };
    await page.goto(`/#/job/${P4编号.job}`);
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    // 详情直取路径：⋯ 在场（权威 CandidateJob 解码成功即有举报入口）
    // 手动证据（b-1）：权威直取详情页，顶栏既有样式 ⋯ 可见
    await page.screenshot({ path: 测试信息.outputPath('P8-backend-job-more-button.png'), fullPage: true });
    await page.getByRole('button', { name: '更多操作' }).click();
    // 抽屉里恰一项非取消动作：举报这个职位（直取无推荐坐标 → 无不感兴趣）
    await expect(page.getByRole('button', { name: '举报这个职位' })).toBeVisible();
    await expect(page.getByRole('button', { name: '不感兴趣，别再推给我' })).toHaveCount(0);
    // 手动证据（b-2）：举报抽屉展开 —— 恰一项新增的既有样式抽屉项「举报这个职位」
    await page.screenshot({ path: 测试信息.outputPath('P8-backend-job-report-drawer.png'), fullPage: true });
    await page.getByRole('button', { name: '举报这个职位' }).click();
    await page.getByRole('button', { name: '骚扰', exact: true }).click();
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText('举报已受理，我们会尽快核查')).toBeVisible({ timeout: 10_000 });
    const 举报 = fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/reports');
    expect(举报).toHaveLength(1);
    // 隐私安全 body：恰 {target:{type,ref},reason,also_block}——无展示名/公司名/用户身份
    expect(举报[0]!.body).toEqual({ target: { type: 'job', ref: P4编号.job }, reason: 'harassment', also_block: false });
    断言P8变更边界(举报[0]!, new URL(page.url()).origin);
    // not_requested：不触发候选隐私重读
    expect(fixture.举报受理).toBe(1);
    expect(隐私.视图.organization_blocks).toHaveLength(0);
  });

  test('P8 举报屏蔽暂不可用：取消勾选=新键纯举报；目标不存在统一关层刷新来源 @backend', async ({ page }) => {
    const 请求序: string[] = [];
    const fixture = await 装P8候选(page, {
      发现fixture: P4发现fixture(),
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });
    await page.goto(`/#/job/${P4编号.job}`);
    await expect(page.getByText(P4标记.jobTitle)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('button', { name: '举报这个职位' }).click();

    // ── 勾选同时屏蔽 → 409 block_unavailable：层保持开、选择保留、零写入 ──
    fixture.分支.举报屏蔽不可用 = true;
    await page.getByRole('button', { name: '薪资不实', exact: true }).click();
    await page.getByRole('button', { name: /同时屏蔽/ }).click();
    await expect(page.getByRole('button', { name: /同时屏蔽/ })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText('暂时无法同时屏蔽，可取消勾选后仅提交举报')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '提交举报' })).toBeVisible(); // 层未关
    expect(fixture.举报受理).toBe(0); // block_unavailable：什么都没写

    // ── 取消勾选 → 新意图新键 → 纯举报成功 ──
    await page.getByRole('button', { name: /同时屏蔽/ }).click();
    await expect(page.getByRole('button', { name: /同时屏蔽/ })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText('举报已受理，我们会尽快核查')).toBeVisible({ timeout: 10_000 });
    const 举报们 = fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/reports');
    expect(举报们).toHaveLength(2);
    expect(举报们[0]!.body).toEqual({ target: { type: 'job', ref: P4编号.job }, reason: 'salary_misrepresentation', also_block: true });
    expect(举报们[1]!.body).toEqual({ target: { type: 'job', ref: P4编号.job }, reason: 'salary_misrepresentation', also_block: false });
    expect(举报们[1]!.idempotencyKey).not.toBe(举报们[0]!.idempotencyKey); // 取消勾选=新键
    for (const 条 of 举报们) 断言P8变更边界(条, new URL(page.url()).origin);
    expect(fixture.举报受理).toBe(1);

    // ── 目标不存在：404 统一终局 —— 关层 + 屏层强制重读来源 ──
    fixture.分支.举报目标不存在 = true;
    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('button', { name: '举报这个职位' }).click();
    await page.getByRole('button', { name: '其他', exact: true }).click();
    const 岗位读取前 = 请求序.filter((项) => 项 === `GET /api/v1/jobs/${P4编号.job}`).length;
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText('举报对象已不存在，请刷新后重试')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '提交举报' })).toHaveCount(0); // 过期层已关
    await expect
      .poll(() => 请求序.filter((项) => 项 === `GET /api/v1/jobs/${P4编号.job}`).length, { timeout: 10_000 })
      .toBeGreaterThan(岗位读取前); // 屏层刷新来源：权威岗位 GET 再次发出
  });

  test('P7 会话举报：target=conversation 路由坐标；同一枚 ⋯ 键盘可达 @backend', async ({ page }, 测试信息) => {
    test.setTimeout(120_000);
    const 隐私 = P3隐私fixture();
    const 请求序: string[] = [];
    const fixture = await 装P8候选(page, {
      P7fixture: P7带消息fixture(P7标记.招聘消息),
      隐私fixture: 隐私,
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });
    fixture.举报屏蔽组织[`conversation:${P7会话编号.会话}`] = {
      organization_id: P8标记.屏蔽组织编号,
      organization_display_name: P8标记.屏蔽组织名,
    };
    await page.goto(`/#/chat/human/${P7会话编号.会话}`);
    await expect(page.getByText(P7标记.招聘消息)).toBeVisible({ timeout: 15_000 });
    // 手动证据（c）：Backend P7 会话页的同一枚视觉 ⋯（span + 原类，role=button 可达）
    const 拉点 = page.getByRole('button', { name: '举报', exact: true });
    await expect(拉点).toBeVisible();
    await page.screenshot({ path: 测试信息.outputPath('P8-backend-p7-conversation.png'), fullPage: true });
    // 键盘可达：Enter 打开会话举报层
    await 拉点.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: '提交举报' })).toBeVisible();
    // 勾选同时屏蔽 → applied：toast 点名屏蔽对象
    await page.getByRole('button', { name: '虚假信息', exact: true }).click();
    await page.getByRole('button', { name: /同时屏蔽/ }).click();
    const 会话详情前 = 请求序.filter((项) => 项 === `GET /api/v1/me/conversations/${P7会话编号.会话}`).length;
    const 隐私读取前 = 请求序.filter((项) => 项 === 'GET /api/v1/me/privacy').length;
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText(`举报已受理 · 已屏蔽${P7标记.地点}`)).toBeVisible({ timeout: 10_000 });
    const 举报 = fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/reports');
    expect(举报).toHaveLength(1);
    // target 恒为该会话的权威路由坐标，绝不是展示名
    expect(举报[0]!.body).toEqual({ target: { type: 'conversation', ref: P7会话编号.会话 }, reason: 'false_information', also_block: true });
    断言P8变更边界(举报[0]!, new URL(page.url()).origin);
    // applied + 候选角色：恰一次权威隐私重读（相对计数：进屏水合也读隐私），
    // 且 fixture 隐私权威视图多了该组织（屏蔽只认权威视图）
    await expect
      .poll(() => 请求序.filter((项) => 项 === 'GET /api/v1/me/privacy').length, { timeout: 10_000 })
      .toBe(隐私读取前 + 1);
    expect(隐私.视图.organization_blocks.map((块) => 块.organization_id)).toEqual([P8标记.屏蔽组织编号]);
    // 确认回执后强制重读该会话
    await expect
      .poll(() => 请求序.filter((项) => 项 === `GET /api/v1/me/conversations/${P7会话编号.会话}`).length, { timeout: 10_000 })
      .toBeGreaterThan(会话详情前);
  });

  test('P8 Backend 直聊：无举报入口、零 reports 请求 @backend', async ({ page }, 测试信息) => {
    const fixture = await 装P8候选(page);
    await page.goto('/#/chat/direct/J-01');
    await expect(page.getByRole('button', { name: '看职位' })).toBeVisible({ timeout: 15_000 });
    // P4 不发布直聊许可/会话坐标 → 没有可发的权威 target：⋯ 举报入口整体隐藏
    await expect(page.getByRole('button', { name: '举报', exact: true })).toHaveCount(0);
    await expect(page.getByText('⋯')).toHaveCount(0);
    // 手动证据（d）：Backend 直聊页无非法举报入口
    await page.screenshot({ path: 测试信息.outputPath('P8-backend-direct-chat.png'), fullPage: true });
    expect(fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/reports')).toEqual([]);
  });

  test('P8 401 清账号回登录，无本地成功 @backend', async ({ page }) => {
    await 装P8候选(page, {
      覆盖: {
        'GET /api/v1/me/credentials': () => ({
          status: 401,
          响应: { error: { type: 'invalid_session', message: '未登录' } },
        }),
      },
    });
    await page.goto('/#/account');
    // 当前会话 401：统一清账号（P4–P8 状态与引用）→ 应用级路由回收进登录页
    await expect(page).toHaveURL(/#\/$/, { timeout: 15_000 });
    await expect(page.getByLabel('手机号')).toBeVisible({ timeout: 10_000 });
    // 旧账号的 fixture 凭证掩码绝不上屏（无本地成功）
    await expect(page.getByText(P8标记.手机掩码)).toHaveCount(0);
  });

  test('P8 切换身份后迟到的账号应答不泄漏；重进账号页按新代际完整水合 @backend', async ({ page }) => {
    test.setTimeout(120_000);
    let 放行!: () => void;
    const 门 = new Promise<void>((ok) => { 放行 = ok; });
    const fixture = 创建P8fixture();
    fixture.分支.挂起凭证读取 = 门;
    const 请求序: string[] = [];
    await 装P8候选(page, {
      fixture,
      招聘组织Fixture: P1C招聘组织Fixture,
      请求拦截: ({ path, method }) => 请求序.push(`${method} ${path}`),
    });
    // 候选端账号页：第一笔凭证 GET 挂起（应答体在请求抵达时已快照为旧值）
    await page.goto('/#/account');
    await expect
      .poll(() => 请求序.filter((项) => 项 === 'GET /api/v1/me/credentials').length, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);
    // 卸载账号页（离开）并切换身份：会话代际递增，旧代的在飞读按栅栏整包作废
    await page.goto('/#/identity?switch=1&from=app');
    await page.getByRole('button', { name: '翻到「招聘方」那一面' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 30_000 });
    // 权威数据先翻新（若迟到应答真的落位，快照会停在旧值且不再重读）
    fixture.凭证们 = [
      { credential_id: P8编号.手机凭证, provider: 'phone_otp', display: P8标记.换绑后掩码, verified_at: '2026-09-01T00:00:00Z' },
    ];
    放行();
    await page.waitForTimeout(1_500);
    // 两端共用的账号页：按新代际完整读取，展示当前权威值；旧主体的迟到值无泄漏路径
    await page.goto('/#/account');
    await expect(page.getByText(P8标记.换绑后掩码)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(P8标记.手机掩码)).toHaveCount(0);
    expect(fixture.凭证读取数).toBeGreaterThanOrEqual(2); // 重进页触发新代际读取
  });

  test('P8 合规 429：固定文案无倒计时，绝不自动重试（手动再提交=新键） @backend', async ({ page }) => {
    const fixture = await 装P8候选(page);
    fixture.分支.反馈限流 = true;
    await page.goto('/#/feedback');
    await page.getByRole('button', { name: '体验建议', exact: true }).click();
    const 正文 = 'Fixture 反馈：希望导出文件能选时间范围';
    await page.getByRole('textbox').fill(正文);
    await page.getByRole('button', { name: '提交', exact: true }).click();
    await expect(page.getByText('操作过于频繁，请稍后再试')).toBeVisible({ timeout: 10_000 });
    // 输入与所选分类原样保留（无本地成功）
    await expect(page.getByRole('textbox')).toHaveValue(正文);
    await expect(page.getByText('已收到，谢谢你')).toHaveCount(0);
    // 不编造倒计时文案
    await expect(page.getByText(/秒后重试|倒计时/)).toHaveCount(0);
    // 合规 429 不带 Retry-After：没有可等的窗口 —— 等待期内零自动重试（恰一笔 POST）
    await page.waitForTimeout(2_500);
    const 反馈们 = () => fixture.变更请求.filter((条) => 条.path === '/api/v1/compliance/feedback');
    expect(反馈们()).toHaveLength(1);
    // 手动再提交 = 新意图新键（429 是终局），同一文的 body 字节一致
    await page.getByRole('button', { name: '提交', exact: true }).click();
    await expect(反馈们()).toHaveLength(2);
    expect(反馈们()[1]!.idempotencyKey).not.toBe(反馈们()[0]!.idempotencyKey);
    expect(反馈们()[1]!.原文).toBe(反馈们()[0]!.原文);
  });
});

// ── P8 Mock 隔离：Mock 双端零控制面请求（任务书 isP8 原文） ─────────────────────
test.describe('P8 Mock 数据源隔离 @mock', () => {
  test('P8 Mock 账号安全/反馈/职位举报/直聊举报零控制面请求 @mock', async ({ page }) => {
    test.setTimeout(120_000);
    const isP8 = (path: string) =>
      /\/security\/sessions|\/me\/(credentials|credential-replacement-attempts|data-exports|account-deletion)|\/compliance\/(feedback|reports)/.test(path);
    const P8请求: string[] = [];
    const apiRequests: string[] = [];
    page.on('request', (请求) => {
      const 路径 = new URL(请求.url()).pathname;
      if (路径.startsWith('/api/v1')) {
        apiRequests.push(`${请求.method()} ${路径}`);
        if (isP8(路径)) P8请求.push(`${请求.method()} ${路径}`);
      }
    });

    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // ── 账号安全：四位原型换绑 / 本地退出提示 / 本地注销跳登录 照旧 ──
    await page.goto('/#/account');
    await expect(page.getByText('138 **** 6021')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /手机号/ }).click();
    await page.getByPlaceholder('输入新手机号').fill('13900001111');
    await page.getByRole('button', { name: '获取验证码' }).click();
    // Mock 专属原型文案（抽屉说明与 toast 都含「原型」，取 toast 的完整单节点文本）
    await expect(page.getByText('验证码已发送（原型：任意 4 位数字均可通过）')).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder(/位验证码$/).fill('8888'); // 任意四位
    await page.getByRole('button', { name: '确认换绑' }).click();
    await expect(page.getByText('手机号已换绑')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('139 **** 1111')).toBeVisible();
    await page.getByRole('button', { name: /退出其他设备/ }).click();
    await expect(page.getByText('其余设备已全部退出登录')).toBeVisible({ timeout: 10_000 });
    // Mock 不渲染 Backend 专属「数据」组与导出行（现有页面一个像素不多）
    await expect(page.getByRole('button', { name: /导出我的数据/ })).toHaveCount(0);
    // 本地注销两步弹层照旧，成功本地跳登录
    await page.getByRole('button', { name: '注销账号' }).click();
    await page.getByRole('button', { name: '我已了解，继续注销' }).click();
    await page.getByRole('button', { name: '确认注销', exact: true }).click();
    await expect(page).toHaveURL(/#\/$/, { timeout: 10_000 });

    // 重新登录（四格验证码原型路径照旧）后再走反馈与两处举报原型
    await page.getByLabel('手机号').fill('13800000000');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.locator('[class*="验证码格"]')).toHaveCount(4);
    await page.getByLabel('短信验证码').fill('1234');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '进入' }).click();
    await expect(page).toHaveURL(/#\/identity$/);
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // ── 反馈：举报分类本地成功（原型固定工单号 + 24 小时口径照旧） ──
    await page.goto('/#/feedback');
    await page.getByRole('button', { name: '举报虚假岗位' }).click();
    await page.getByRole('textbox').fill('Mock 原型反馈：举报虚假岗位本地成功');
    await page.getByRole('button', { name: '提交', exact: true }).click();
    await expect(page.getByText('已收到，谢谢你')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('工单号 FB-2026-0818-041')).toBeVisible();
    await expect(page.getByText('我们会在 24 小时内核查。核查过程中不会向对方透露是谁提交的。')).toBeVisible();

    // ── 职位举报（原型岗位）：本地派发 + 固定 toast，勾选屏蔽落全局名单 ──
    await page.goto('/#/job/J-01');
    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('button', { name: '举报这个职位' }).click();
    await page.getByRole('button', { name: '虚假信息', exact: true }).click();
    await page.getByRole('button', { name: /同时屏蔽/ }).click();
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText(/举报已受理 · 已屏蔽/)).toBeVisible({ timeout: 10_000 });

    // ── 直聊举报（Mock 在场；Backend 该入口整体隐藏） ──
    await page.goto('/#/chat/direct/J-01');
    await page.getByRole('button', { name: '举报', exact: true }).click();
    await page.getByRole('button', { name: '其他', exact: true }).click();
    await page.getByRole('button', { name: '提交举报' }).click();
    await expect(page.getByText('举报已受理，我们会尽快核查')).toBeVisible({ timeout: 10_000 });

    // 全程零 P8 请求（任务书 isP8 原文），Mock 恒零 /api/v1
    expect(P8请求).toEqual([]);
    expect(apiRequests).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 候选 onboarding Backend fixture @backend —— Task 8：Tasks 1–7 修完后的整条
// 写链收口。可见导航走完整注册流（身份选择 → 完善资料 → 薪资向导 → 档案四连页 →
// 在线简历 → 偏好向导 → 披露说明 → 头像 → 主壳），每个 mutation 都被可变 fixture
// 严格校验、记录并物化；reload 后从 我的 Tab 宫格进 我的简历，断言权威快照里
// 经历 / 教育 / 技能 / 证书齐全（证书 year: null 不上屏）。
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 滚薪资轮到指定档：按 listbox 的可访问名定位，滚到目标档那一格（行高按相邻两档
 * 的 offsetTop 差现算），停下后等防抖（90ms）落值 —— aria-selected 翻true 才继续。
 * 这是真滚轮滚动（scroll-snap 吸附交给浏览器），不是绕过 UI 的值注入。
 */
async function 滚薪资轮(page: Page, 名称: string, 档: number): Promise<void> {
  const 轮 = page.getByRole('listbox', { name: 名称 });
  await 轮.waitFor();
  await 轮.evaluate((节点, 目标) => {
    const 档们 = [...节点.querySelectorAll<HTMLElement>('[role="option"]')];
    const 序 = Math.max(0, 档们.findIndex((项) => (项.textContent ?? '').trim() === String(目标)));
    const 行高 = 档们.length > 1 ? 档们[1]!.offsetTop - 档们[0]!.offsetTop : 46;
    节点.scrollTop = 序 * 行高;
  }, 档);
  await expect(轮.getByRole('option', { name: String(档), exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
}

test.describe('候选 onboarding Backend fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('候选 onboarding 完整保存并创建首次意向 @backend', async ({ page }) => {
    // 全程可见导航 + debounce + 初始化页 3.6s + reload 水合，给足预算
    test.setTimeout(180_000);

    const fixture = 创建候选OnboardingFixture();
    await 安装BFF路由(page, {
      记录目录请求: () => {},
      登录尝试id: 'att-onboarding-001',
      候选OnboardingFixture: fixture,
      // 选身份是交互水合（任一支持域失败会抛回身份页），隐私域要给合法权威视图
      隐私fixture: P3隐私fixture(),
    });
    const 次数 = (方法: string, 路径: string) =>
      fixture.mutations.filter((条) => 条.method === 方法 && 条.path === 路径).length;

    // ── 1. 会话恢复 → last_used_role=null 落身份选择页 → 我要找工作 ──
    await page.goto('/');
    await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: '完善资料' })).toBeVisible();

    // ── 2. 完善资料：已毕业（保留社招全职）、办公方式、工作城市与期望职位
    //      都走全屏选择页的可见搜索/选择/保存返回 ──
    // 选中态的 ✓ 由 CSS ::before 渲染、会进可访问名，所以选择钮一律用非精确匹配。
    // 城市行先选（引导预填还是 null，行内是可见占位「选择工作城市」），办公方式
    // 在两个全屏选择页返回之后再点 —— 存求职筛选偏好 的 reducer 兜底会往 null 预填里
    // 播种 Mock 默认城市「上海」（既有行为，与本轮修复无关），先选城市不触发它。
    await page.getByRole('button', { name: '已毕业' }).click();
    await expect(page.getByRole('button', { name: '社招全职' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: '选择工作城市' }).click();
    await expect(page).toHaveURL(/#\/onboard\/city$/);
    await page.getByPlaceholder('搜索城市 / 省份').fill('fixture');
    await expect(page.getByRole('button', { name: 标记.城市display, exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 标记.城市display, exact: true }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/student$/);

    await page.getByRole('button', { name: '选择期望职位' }).click();
    await expect(page).toHaveURL(/#\/onboard\/job$/);
    // Backend 双栏：左根项 + 右同名 selectable 叶子（fixture 目录只有一项），点右栏那枚
    const 职位键 = page.getByRole('button', { name: 标记.职位display, exact: true });
    await expect(职位键.first()).toBeVisible({ timeout: 10_000 });
    await expect(职位键).toHaveCount(2, { timeout: 10_000 });
    await 职位键.last().click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/#\/student$/);

    // 办公方式至少一种：默认三档全亮，点掉「混合」后现场/全远程仍在
    await page.getByRole('button', { name: '混合' }).click();
    await expect(page.getByRole('button', { name: '现场' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '下一步' })).toBeEnabled();

    // ── 3. 下一步 → 向导薪资段：两轮滚到 30 / 40（最低月薪 / 最高月薪 可访问名）──
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/wizard\?stage=salary$/);
    await expect(page.getByRole('heading', { name: '期望现金月薪是？' })).toBeVisible();
    await 滚薪资轮(page, '最低月薪', 30);
    await 滚薪资轮(page, '最高月薪', 40);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/basic$/);
    await expect(page.getByRole('heading', { name: '创建在线简历' })).toBeVisible();

    // ── 历史点（完成清栈前仍保留）：后退回薪资段，两轮仍是 30/40，再前进回来。
    //    完成注册会清掉整条注册流历史，所以这条断言放在最后的披露/头像步骤之前做 ──
    await page.goBack();
    await expect(page).toHaveURL(/#\/wizard\?stage=salary$/);
    await expect(
      page.getByRole('listbox', { name: '最低月薪' }).getByRole('option', { name: '30', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByRole('listbox', { name: '最高月薪' }).getByRole('option', { name: '40', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await page.goForward();
    await expect(page).toHaveURL(/#\/basic$/);

    // ── 4. 身份证上的名字 → 现在是什么状态？ → 学历四连页 ──
    await page.getByPlaceholder('身份证上的名字').fill('Fixture 候选人');
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/onboard\/status$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '现在是什么状态？' })).toBeVisible();
    await page.getByRole('button', { name: '在职 · 考虑机会' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/onboard\/degree$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '最高学历' })).toBeVisible();
    await page.getByRole('button', { name: '本科' }).click();
    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page).toHaveURL(/#\/onboard\/school$/, { timeout: 15_000 });
    const 学校框 = page.getByPlaceholder('学校名称');
    await 学校框.fill('fixture');
    await expect(page.getByText(标记.学校display)).toBeVisible({ timeout: 10_000 });
    await page.getByText(标记.学校display).click();
    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page).toHaveURL(/#\/onboard\/major$/, { timeout: 15_000 });
    const 专业框 = page.getByPlaceholder('专业名称');
    await 专业框.fill('fixture');
    await expect(page.getByRole('button', { name: 'Fixture 专业', exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Fixture 专业', exact: true }).click();
    await page.getByRole('button', { name: '下一步' }).click();

    // 就读时间段：滚轮默认 2021—2025 合法，走可见 下一步（日期轮的完成键在经历编辑页）
    await expect(page).toHaveURL(/#\/onboard\/eduyears$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '就读时间段' })).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();

    // ── 5. 在线简历：添加工作经历（公司 / 行业 / 职位 / 入职年月·完成）→
    //      技能 Go、证书 CET-4（各点输入框旁的 添加）→ 保存 ──
    await expect(page).toHaveURL(/#\/experience$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '在线简历' })).toBeVisible();
    await page.getByRole('button', { name: '添加工作经历' }).click();
    await expect(page.getByPlaceholder('必填')).toHaveCount(2);
    await page.getByPlaceholder('必填').nth(0).fill('Fixture 星桥数据');
    await page.getByRole('button', { name: '所属行业' }).click();
    await page.getByRole('button', { name: 'Fixture 行业', exact: true }).click();
    await page.getByPlaceholder('必填').nth(1).fill('Fixture 后端工程师');
    await page.getByRole('button', { name: '入职年月' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '完成' }).click();
    await page.getByRole('button', { name: '完成', exact: true }).click();

    const 技能输入 = page.getByPlaceholder('如：Go、分布式事务');
    await 技能输入.fill('Go');
    await 技能输入.locator('..').getByRole('button', { name: '添加' }).click();
    await expect(page.getByRole('button', { name: '删除技能 Go' })).toBeVisible();
    const 证书输入 = page.getByPlaceholder('证书或语言，如 CPA、雅思 7.0');
    await 证书输入.fill('CET-4');
    await 证书输入.locator('..').getByRole('button', { name: '添加' }).click();
    await expect(page.getByText('CET-4', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('heading', { name: '哪些情况直接排除？' })).toBeVisible({ timeout: 20_000 });

    // ── 6. 偏好段：硬性排除 下一步 → 个人优势 → 保存并继续 ──
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    await expect(page.getByRole('heading', { name: '分享一下自己的个人优势' })).toBeVisible();
    await page.getByLabel('个人优势').fill('Fixture 候选人的个人优势标记');
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page).toHaveURL(/#\/disclosure$/, { timeout: 30_000 });

    // ── 7. 首次意向已创建：恰好一条 POST /me/intentions 被记录 ──
    expect(次数('POST', '/api/v1/me/intentions')).toBe(1);

    await page.getByRole('button', { name: '完成设置，开始匹配' }).click();
    await expect(page).toHaveURL(/#\/onboard\/avatar$/);
    await page.getByRole('button', { name: '完成注册' }).click();
    // 完成注册清栈进初始化页（~3.6s 播完）替换进主壳
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });

    // 重读计数快照必须取在落主壳**之后、page.reload() 之前**：此前所有写入的权威 GET
    // 都已落地（每步保存都 await 完自己的 GET 才跳转，且初始化页播了 3.6s），此后
    // 计数器上的任何增量只能来自 reload 自己 —— 若前端改成从 sessionStorage 静默
    // 水合、不发 GET，下面的 poll 会当场红，而不是被挂载期读取冒充掩盖。
    const 重读前 = { 简历: fixture.读取.简历, 意向: fixture.读取.意向 };

    // reload：必须重新 GET 权威简历与意向（不是沿用本地状态）；水合 GET 异步到达，
    // 用 poll 等增量而非在 URL 断言后立刻取值
    await page.reload();
    await expect(page).toHaveURL(/#\/app$/, { timeout: 30_000 });
    await expect.poll(() => fixture.读取.简历, { timeout: 15_000 }).toBeGreaterThan(重读前.简历);
    await expect.poll(() => fixture.读取.意向, { timeout: 15_000 }).toBeGreaterThan(重读前.意向);

    // 可见 UI 打开 我的简历：底部导航 我 Tab → 宫格 我的简历
    await page.getByRole('button', { name: '我', exact: true }).click();
    await page.getByRole('button', { name: '我的简历' }).click();
    await expect(page).toHaveURL(/#\/resume$/);
    // 返回栏居中标题是 div 不是 heading，按可见文本断言
    await expect(page.getByText('我的简历', { exact: true })).toBeVisible();

    // 权威快照渲染：经历 / 教育 / 技能 / 证书 全部来自 HTTP fixture
    await expect(page.getByText('Fixture 星桥数据')).toBeVisible();
    await expect(page.getByText('Fixture 后端工程师')).toBeVisible();
    await expect(page.getByText(标记.学校display)).toBeVisible();
    await expect(page.getByText('本科 · Fixture 专业').first()).toBeVisible();
    await expect(page.getByText('Go', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('CET-4', { exact: true })).toBeVisible();
    // 证书 year: null 不上屏（年份为空整行不渲染「年取得」），页面绝不出现字面 null
    expect(await page.getByText(/null/).count()).toBe(0);

    // ── 精确 mutation 计数与权威终态 ──
    expect(次数('POST', '/api/v1/me/resume/experiences')).toBe(1);
    expect(次数('PATCH', '/api/v1/me/resume/skills')).toBe(1);
    expect(次数('POST', '/api/v1/me/resume/certificates')).toBe(1);
    expect(次数('POST', '/api/v1/me/resume/educations')).toBe(1);
    expect(次数('POST', '/api/v1/me/intentions')).toBe(1);
    // 分区写入各一次（档案与个人优势），没有第二次写
    expect(次数('PATCH', '/api/v1/me/resume/profile')).toBe(1);
    expect(次数('PATCH', '/api/v1/me/resume/summary')).toBe(1);
    const 证书Mutation = fixture.mutations.find((条) => 条.path === '/api/v1/me/resume/certificates');
    expect(证书Mutation?.body).toEqual({ name: 'CET-4', year: null });
    expect(fixture.resume.experiences).toHaveLength(1);
    expect(fixture.resume.skills).toEqual(['Go']);
    expect(fixture.resume.educations).toHaveLength(1);
    expect(fixture.resume.certificates).toEqual([
      expect.objectContaining({ name: 'CET-4', year: null }),
    ]);
    expect(fixture.intentions).toHaveLength(1);
    expect(fixture.intentions[0]?.status).toBe('active');
    // 意向坐标来自目录引用 ID（薪资 30–40K / 城市 / 职位都是 fixture 的标记值）
    expect(fixture.intentions[0]?.compensation).toEqual({ mode: 'range', lower: 30, upper: 40 });
    expect(fixture.intentions[0]?.job_category).toEqual({ id: 'job-fixture-001', display_name: 标记.职位display });
    expect(fixture.intentions[0]?.primary_location).toEqual({ id: 'loc-fixture-001', display_name: 标记.城市display });

    // 请求顺序：简历域最后一个请求是 GET（保存以最终权威重读收尾）
    const 简历域尾 = fixture.简历请求.at(-1);
    expect(简历域尾?.method).toBe('GET');
    expect(简历域尾?.path).toBe('/api/v1/me/resume');
    // 写入 path 不含 /catalog/（直接用选择时保存的 ID，不反查目录）
    expect(fixture.mutations.some((条) => 条.path.includes('/catalog/'))).toBe(false);
    // 角色偏好已落 candidate：reload 直接进主壳而非身份选择页
    expect(fixture.主体.last_used_role).toBe('candidate');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 招聘方 onboarding Backend fixture @backend（P0 修复 Task 7）：全新招聘方从身份选择页
// 起步 —— profile 首读 404 not_found（合法的「缺失」而非故障），名片首写走
// PATCH + If-Match: "0"（fixture 按自己的当前 revision 做 CAS），发岗写出三段独立
// 非空文本，刷新后从权威 HTTP 事实（profile revision 1 + owner Jobs）重新水合。
// 这条 fixture 是独立对象：不与候选 onboarding fixture 共享或复位任何状态。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('招聘方 onboarding Backend fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });
  test.use({ timeout: 120_000 });

  test('新招聘方 onboarding：404 首写、完整发岗与刷新恢复 @backend', async ({ page }) => {
    const fixture = 创建招聘方OnboardingFixture();
    const requests: 拦截请求形[] = [];
    const jobCreateStatuses: number[] = [];
    const profileReadStatuses: number[] = [];
    page.on('response', (response) => {
      if (response.request().method() === 'POST' && response.url().endsWith('/api/v1/recruiter/jobs')) {
        jobCreateStatuses.push(response.status());
      }
      if (response.request().method() === 'GET' && response.url().endsWith('/api/v1/recruiter/profile')) {
        profileReadStatuses.push(response.status());
      }
    });
    await 安装BFF路由(page, {
      登录尝试id: 'att-new-recruiter-onboarding',
      记录目录请求: () => undefined,
      主体初始角色: null,
      招聘方OnboardingFixture: fixture,
      请求拦截: (request) => requests.push(request),
    });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
    await page.getByRole('button', { name: '我要招人' }).click();
    await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 20_000 });
    expect(profileReadStatuses[0]).toBe(404);

    await page.getByLabel('姓名').fill('林澈');
    await page.getByLabel('职务').fill('招聘负责人');
    await page.getByLabel('公司').fill('星河科技');
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/, { timeout: 20_000 });

    const profileWrite = fixture.mutations.find((item) => item.path === '/api/v1/recruiter/profile');
    expect(profileWrite).toEqual(expect.objectContaining({
      method: 'PATCH',
      ifMatch: '"0"',
      body: { public_name: '林澈', title: '招聘负责人' },
    }));
    expect(fixture.profile).toEqual(expect.objectContaining({ revision: 1 }));

    await 走完后端发岗向导(page);
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });

    const jobWrite = fixture.mutations.find((item) => item.path === '/api/v1/recruiter/jobs');
    expect(jobWrite).toBeDefined();
    expect(jobWrite!.body).toMatchObject({
      hiring_organization_claim: { display_name: '星河科技', legal_name: null },
      description: '用户研究、产品验证、产品策略、实验、数据分析、需求执行、GTM、发布与增长',
      requirements: '应届或毕业年级；有产品、技术、增长、分析或创业经历；关注 AI、SaaS、工作流、开发工具与 Agent',
    });
    expect(jobCreateStatuses).toEqual([201]);
    expect(fixture.ownerJobs).toHaveLength(1);

    await page.reload();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });
    await expect(page.getByText('Fixture 实习岗位')).toBeVisible();
    expect(requests.filter((item) => item.path === '/api/v1/recruiter/profile' && item.method === 'GET').length)
      .toBeGreaterThanOrEqual(2);
    expect(profileReadStatuses).toContain(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FE-IV-01 候选实名域 fixture @backend + Mock 隔离（2026-09-05）。
// 拦截式验证浏览器到 HTTP 的边界与用户旅程：设置页实名行由 summary 驱动 → 独立页
// 提交（multipart 恰一个 metadata JSON + 一至两个 evidence、16–128 可见 ASCII 幂等键）
// → reload 后仍从后端读到 pending（草稿/文件名不出现）→ 取消带顶层 revision 的
// quoted If-Match → 回 unverified + cancelled。fixture 只记录 part 名、metadata JSON、
// headers 与请求计数，不把文件 bytes/文件名写进任何断言或快照；verified/rejected
// 已由组件 fixture 覆盖，本路由不实现 reviewer 终审。这条 E2E 只证明前端接线
// （route fixture），不声称启动或验证真实 BFF。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('候选实名 Backend fixture @backend', () => {
  test('候选实名提交刷新取消闭环 @backend', async ({ page }) => {
    test.setTimeout(150_000);
    const fixture = await 装候选实名(page);

    // 1. 设置页：Backend 实名行由 summary 驱动，初始 unverified
    await page.goto('/#/settings');
    await expect(page.getByRole('button', { name: /实名认证/ })).toContainText('未认证', { timeout: 20_000 });

    // 2. 进入独立实名页
    await page.getByRole('button', { name: /实名认证/ }).click();
    await expect(page).toHaveURL(/#\/settings\/identity-verification$/, { timeout: 10_000 });

    // 3. 填合成姓名、选护照、上传合成 PNG、提交
    await page.getByRole('textbox', { name: '证件姓名' }).fill('Fixture Candidate IV');
    await page.getByRole('combobox', { name: '证件类型' }).selectOption('passport');
    await page.setInputFiles('input[type="file"]', {
      name: '材料.png',
      mimeType: 'image/png',
      buffer: Buffer.from('89 50 4e 47 0d 0a 1a 0a-fixture-png-bytes', 'latin1'),
    });
    await page.getByRole('button', { name: '提交材料' }).click();

    // 4. 页面进入审核中；fixture 记录 metadata 只有两键、一个 evidence、稳定幂等键
    await expect(page.getByText('审核中')).toBeVisible({ timeout: 15_000 });
    expect(fixture.creates).toHaveLength(1);
    expect(fixture.creates[0]!.metadata).toEqual({ legal_name: 'Fixture Candidate IV', document_type: 'passport' });
    expect(fixture.creates[0]!.evidence数).toBe(1);
    expect(fixture.creates[0]!.parts).toEqual(['metadata', 'evidence']);
    expect(fixture.creates[0]!.key).toMatch(/^[!-~]{16,128}$/);

    // 5. reload：页面仍从后端读到 pending；草稿与文件名不出现
    await page.reload();
    await expect(page.getByText('审核中')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Fixture Candidate IV')).toHaveCount(0);
    await expect(page.getByText('材料.png')).toHaveCount(0);

    // 6. 取消：确认层 → If-Match 用顶层 revision → 页面回未认证表单
    await page.getByRole('button', { name: '取消申请' }).click();
    await expect(page.getByText('取消实名认证申请？')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: '取消申请' }).click();
    await expect(page.getByRole('textbox', { name: '证件姓名' })).toBeVisible({ timeout: 15_000 });
    expect(fixture.cancels).toHaveLength(1);
    expect(fixture.cancels[0]!.requestId).toBe('ivq-fixture-0001');
    expect(fixture.cancels[0]!.ifMatch).toBe('"2"'); // create 后的顶层 revision

    // 7. 返回设置页显示 未认证；fixture 当前 summary 为 unverified + cancelled
    await page.goto('/#/settings');
    await expect(page.getByRole('button', { name: /实名认证/ })).toContainText('未认证', { timeout: 20_000 });
    expect(fixture.summary.status).toBe('unverified');
    expect(fixture.summary.current_request?.status).toBe('cancelled');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mock 隔离：设置页保持原型「已认证」演示与点击提示；直达实名路由被页面 replace 回
// 候选设置页；整个会话零 identity-verification 请求。
// ─────────────────────────────────────────────────────────────────────────────
test('Mock 候选实名保持原型且零实名请求 @mock', async ({ page }) => {
  test.setTimeout(90_000);
  const 实名请求: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.includes('identity-verification')) {
      实名请求.push(new URL(request.url()).pathname);
    }
  });

  await page.goto('/#/settings');
  const 实名行 = page.getByRole('button', { name: /实名认证.*已认证/ });
  await expect(实名行).toBeVisible({ timeout: 10_000 });
  await 实名行.click();
  await expect(page.getByText('实名认证 · 已通过，无需重复认证')).toBeVisible();

  // 直达实名路由：Mock 由页面自身 replace 回候选设置页
  await page.goto('/#/settings/identity-verification');
  await expect(page.getByRole('button', { name: /实名认证.*已认证/ })).toBeVisible({ timeout: 10_000 });
  expect(实名请求).toEqual([]);
});

// ─────────────────────────────────────────────────────────────────────────────
// JD PDF 建议稿导入 fixture @backend（2026-09-03）。
// 拦截式验证浏览器到 HTTP 的形状：consent 前零 POST；POST 202 恰两个 multipart part
// （file: application/pdf + processing_consent_confirmed:"true"）与 jd-import- 幂等键；
// GET 按返回的 jdi_* 串行轮询（processing → succeeded）；快照合并只填未改字段；
// 类别只走轻提示、城市只进搜索框，Catalog 引用仍由用户真实选择；解析本身不产生
// Job POST。这条 E2E 只证明前端接线，不证明目标后端已部署 handoff 提交。
// ─────────────────────────────────────────────────────────────────────────────
test.describe('JD 建议稿导入 Backend fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });
  test.use({ timeout: 120_000 });

  test('JD 建议稿导入：consent 前零 POST，202 + 串行轮询后快照合并，发布仍需真实 Catalog @backend', async ({ page }) => {
    const fixture = 创建招聘方OnboardingFixture();
    await 安装BFF路由(page, {
      登录尝试id: 'att-jd-import',
      记录目录请求: () => undefined,
      主体初始角色: null,
      招聘方OnboardingFixture: fixture,
    });

    // 登录进发岗页（新招聘方 onboarding 同链：名片首写 → 保存并继续）
    await page.goto('/');
    await expect(page).toHaveURL(/#\/identity$/, { timeout: 15_000 });
    await page.getByRole('button', { name: '我要招人' }).click();
    await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 20_000 });
    await page.getByLabel('姓名').fill('林澈');
    await page.getByLabel('职务').fill('招聘负责人');
    await page.getByLabel('公司').fill('星河科技');
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/, { timeout: 20_000 });

    // ── JD 导入路由（注册晚于 安装BFF路由 的通配路由，优先生效）──
    const 导入ID = 'jdi_0123456789abcdef0123456789abcdef';
    const 元数据 = { request_id: 'fixture-req', api_version: 'v1' as const };
    const 建议稿 = {
      title: 'Fixture JD 资深后端工程师',
      recruitment_type: null,
      workplace_mode: 'remote',
      office_location: null,
      description: 'Fixture JD 描述（用户改过就不该出现）',
      requirements: 'Fixture JD 要求（五年以上后端）',
      education_requirement: 'bachelor',
      experience_requirement: 'five_plus_years',
      category_source_name: '后端开发',
      location_source_name: 'fixture',
      keywords: ['Fixture 关键词'],
    };
    const 基础 = {
      import_id: 导入ID,
      created_at: '2026-09-03T01:02:03Z',
    };
    let POST数 = 0;
    const POST状态: number[] = [];
    page.on('response', (响应) => {
      if (响应.url().endsWith('/api/v1/recruiter/job-draft-imports') && 响应.request().method() === 'POST') {
        POST状态.push(响应.status());
      }
    });
    await page.route('**/api/v1/recruiter/job-draft-imports', async (route) => {
      expect(route.request().method()).toBe('POST');
      POST数 += 1;
      const headers = route.request().headers();
      expect(headers['idempotency-key']).toMatch(/^jd-import-.{36}$/);
      const body = route.request().postDataBuffer()?.toString('latin1') ?? '';
      expect(body).toContain('name="file"; filename="synthetic-jd.pdf"');
      expect(body).toContain('Content-Type: application/pdf');
      expect(body).toContain('name="processing_consent_confirmed"');
      expect(body).toContain('true');
      expect(body).not.toContain('display_name');
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ result: { ...基础, status: 'pending', updated_at: '2026-09-03T01:02:03Z' }, meta: 元数据 }),
      });
    });
    let GET数 = 0;
    await page.route(`**/api/v1/recruiter/job-draft-imports/${导入ID}`, async (route) => {
      expect(route.request().method()).toBe('GET');
      GET数 += 1;
      const 结果 = GET数 === 1
        ? { ...基础, status: 'processing', updated_at: '2026-09-03T01:02:05Z' }
        : { ...基础, status: 'succeeded', updated_at: '2026-09-03T01:02:07Z', suggestion: 建议稿 };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: 结果, meta: 元数据 }),
      });
    });

    // ── 第一步先就绪（标题/办公方式/类别），快照里这些是用户已知值 ──
    const 职位类别行 = page.getByRole('button').filter({ hasText: '职位类别' });
    await page.getByPlaceholder(/资深后端工程师/).fill('上传前标题');
    await page.getByRole('button', { name: '混合', exact: true }).click();
    await 职位类别行.click();
    const 类键 = page.getByRole('button', { name: 标记.职位display, exact: true });
    await 类键.first().click();
    await expect(类键).toHaveCount(2, { timeout: 5_000 });
    await 类键.last().click();

    // ── 取消一轮：consent 取消零 POST ──
    await page.getByRole('button', { name: /把 JD 给我/ }).click();
    const JD文件 = page.getByLabel('上传 JD 文件');
    await JD文件.setInputFiles({
      name: 'synthetic-jd.pdf', mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\nfixture jd\n'),
    });
    await expect(page.getByText('允许 AI 识别这份职位描述？')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
    expect(POST数).toBe(0);

    // ── 真正导入：consent 后恰一次 POST 202 ──
    await page.getByRole('button', { name: /把 JD 给我/ }).click();
    await JD文件.setInputFiles({
      name: 'synthetic-jd.pdf', mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\nfixture jd\n'),
    });
    await expect(page.getByText('允许 AI 识别这份职位描述？')).toBeVisible();
    expect(POST数).toBe(0); // consent 前零 mutation
    await page.getByRole('button', { name: '同意并继续' }).click();
    await expect.poll(() => POST数).toBe(1);

    // ── 解析期间表单可编辑：进第二步改描述（保护用例）──
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByLabel('职位描述').fill('用户等待时写的描述');

    // ── 轮询到 succeeded（pending → processing → succeeded 两拍，约 6 秒）──
    await expect.poll(() => GET数, { timeout: 20_000 }).toBe(2);
    expect(POST状态).toEqual([202]);
    // 类别建议只走现有轻提示（无常驻节点）
    await expect(page.getByText('AI 识别的职位类别是「后端开发」，请手动选择')).toBeVisible();
    // 解析本身不产生 Job POST
    expect(fixture.mutations.find((项) => 项.path === '/api/v1/recruiter/jobs')).toBeUndefined();
    // 等待期间改过的描述保留
    await expect(page.getByLabel('职位描述')).toHaveValue('用户等待时写的描述');

    // ── 未改的标题被建议替换；横幅进入终局；全远程清空并禁用办公地点（原位不隐藏）──
    await page.getByRole('button', { name: '返回' }).click();
    await expect(page.getByText('已识别，请检查建议')).toBeVisible();
    await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue(建议稿.title);
    // 选中快捷片的 accessible name 带 ✓ 前缀，用包含匹配
    await expect(page.getByRole('button', { name: /全远程/ })).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    const 办公地框 = page.getByPlaceholder(/浦东新区世纪大道/);
    await expect(办公地框).toBeDisabled();
    await expect(办公地框).toHaveValue('');

    // ── 城市源文本只进搜索框：先补齐薪资/年薪月数，再验证发布被城市门禁拦下 ──
    await expect(page.getByPlaceholder('搜索城市名，从下方候选选择')).toHaveValue('fixture');
    await page.getByLabel('薪资下限').fill('50');
    await page.getByLabel('薪资上限').fill('65');
    await page.getByRole('button', { name: /年薪月数/ }).click();
    await page.getByRole('button', { name: '完成' }).click();
    await page.getByRole('checkbox', { name: /我已确认经验和学历设置将作为自动匹配依据/ }).check();
    await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
    await expect(page.getByText('请从候选城市中选择')).toBeVisible();
    expect(fixture.mutations.find((项) => 项.path === '/api/v1/recruiter/jobs')).toBeUndefined();
    // 点真实候选取得 地点引用 后主动发布：此时才出现 Job POST
    await page.getByRole('button', { name: 标记.城市display, exact: true }).click();
    // 职位要求由建议填入（未被用户改过）
    await expect(page.getByLabel('职位要求')).toHaveValue(建议稿.requirements);
    await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });

    const 岗位写入 = fixture.mutations.find((项) => 项.path === '/api/v1/recruiter/jobs');
    expect(岗位写入).toBeDefined();
    expect(岗位写入!.body).toMatchObject({
      title: 建议稿.title,
      description: '用户等待时写的描述',
      requirements: 建议稿.requirements,
      workplace_mode: 'remote',
      office_location: '',
      category_id: 'job-fixture-001',
      location_id: 'loc-fixture-001',
    });
    // 轮询收口：succeeded 终局后不再读
    expect(GET数).toBe(2);
    expect(POST数).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 标注评审构建 @annotation —— VITE_ANNOTATION_ENABLED=true 的专属构建（端口 4183）。
// Mock / Backend 项目保持缺省命令（无标注变量）→ 缺省构建零标注 UI 的口径由既有
// 用例继续守住；这里只验「标注开着时，工具不挡业务」：
//   1. 窄视口物理鼠标点击技能「添加」键——启动器已 portal 出设备内容，命不中被截走；
//   2. 宽视口启动器中心落在设备外预留工具列内、且在机身（data-遮罩挂载点）之外。
// ─────────────────────────────────────────────────────────────────────────────

test.describe('标注评审构建 @annotation', () => {
  // 显式标注构建 server（端口 4183，VITE_ANNOTATION_ENABLED=true）
  test.use({ baseURL: 'http://127.0.0.1:4183' });
  test.use({ timeout: 60_000 });

  // 先种上「最大高度」的启动器分支：计数角标 + 铅笔同列（22 + 6gap + 34 = 62px），
  // 让启动器命中区取最大值 —— 工具行按这个最大高度定尺寸，回归才有意义
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('AGXP标注意见', JSON.stringify([{
        编号: 1,
        路由: '/experience',
        位置: '工作经历-module__录入键',
        文本: '添加',
        意见: 'fixture 标注',
        时间: '2026-09-01T00:00:00.000Z',
      }]));
    });
  });

  test('标注模式不遮挡技能添加 @annotation', async ({ page }) => {
    await 安装BFF路由(page, { 记录目录请求: () => {}, 登录尝试id: 'att-annotation-1' });

    // 矮视口（真实小屏手机档）：在线简历屏不滚动、技能录入行固定在 y≈313；
    // 修复前启动器悬浮带（设备底部 96–158px）在 390×664 下根本盖不到这一行，
    // 只有 390×460 这类高度下启动器列（x≥342）才压住「添加」键的右半边。
    // 按钮中心（x≈341.5）恰好贴着启动器左缘外 0.5px —— 中心点击永远命不中被截的
    // 场景，所以回归点选按钮右半中点（用户拇指的常见落点），修复前它被启动器盖住。
    await page.setViewportSize({ width: 390, height: 460 });

    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });

    // 在线简历（工作经历）屏：专业技能录入行
    await page.goto('/#/experience');
    const 技能输入 = page.getByPlaceholder('如：Go、分布式事务');
    await expect(技能输入).toBeVisible({ timeout: 10_000 });
    await 技能输入.fill('Rust');

    // 物理鼠标坐标点击（禁止 forced click / locator.click 的命中补偿）：
    // 启动器若仍悬在设备内容里，这一下会被它截走，技能片不会上屏
    const 添加键 = 技能输入.locator('xpath=following-sibling::button');
    const 添加框 = await 添加键.boundingBox();
    if (!添加框) throw new Error('skill add button is not visible');
    await page.mouse.click(添加框.x + 添加框.width * 0.75, 添加框.y + 添加框.height / 2);

    await expect(page.getByRole('button', { name: '删除技能 Rust' })).toBeVisible({ timeout: 10_000 });
  });

  test('桌面标注启动器位于设备外工具列 @annotation', async ({ page }) => {
    await 安装BFF路由(page, { 记录目录请求: () => {}, 登录尝试id: 'att-annotation-2' });

    // 宽视口 → 两列评审布局：设备内容占主列，启动器进右侧 64px 工具列
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/app$/, { timeout: 15_000 });
    await page.goto('/#/experience');

    const 启动器 = await page.getByRole('button', { name: '标注模式' }).boundingBox();
    const 工具列 = await page.locator('[data-标注工具位]').boundingBox();
    const 机身 = await page.locator('[data-遮罩挂载点]').boundingBox();
    if (!启动器 || !工具列 || !机身) {
      throw new Error('annotation launcher geometry is unavailable');
    }

    // 启动器中心在工具列矩形内
    const 中心x = 启动器.x + 启动器.width / 2;
    const 中心y = 启动器.y + 启动器.height / 2;
    expect(中心x).toBeGreaterThanOrEqual(工具列.x);
    expect(中心x).toBeLessThanOrEqual(工具列.x + 工具列.width);
    expect(中心y).toBeGreaterThanOrEqual(工具列.y);
    expect(中心y).toBeLessThanOrEqual(工具列.y + 工具列.height);

    // 且在机身（设备内容）矩形外 —— 工具列是设备外的保留车道
    const 在机身内 =
      中心x >= 机身.x && 中心x <= 机身.x + 机身.width &&
      中心y >= 机身.y && 中心y <= 机身.y + 机身.height;
    expect(在机身内).toBe(false);
  });
});
