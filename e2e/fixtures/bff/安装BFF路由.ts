// e2e/fixtures/bff/安装BFF路由.ts
// 薄装配入口（C2 阶段二收口）：BFF路由选项 的形状与 安装BFF路由 的调用形态以原
// e2e/数据源模式.spec.ts 的声明为源（不改 DTO、不放宽 decoder）；各域的样本/工厂/
// 路由处理逻辑在 e2e/fixtures/bff/ 各域模块内。本文件只做三件事：
//   1) 声明 BFF路由选项（原 spec 344–383 逐字迁出，仅加 export）；
//   2) 每次安装创建各域独立安装态（Map/Set/序号不跨安装共享）；
//   3) 每请求构造 路由上下文形，按固定顺序调用域 handler，命中即返回。
// 分发顺序与原 spec 相同，只有两处经核对的等价调整：resume/intentions/catalog
// 并入 账号与目录域、jobs 并入 招聘组织域（两处 path 集与所跨越的域均不相交）。
// 跨域共享状态（P4↔P5 连续记录、P5 handoff、P8 举报→P3 屏蔽）一律传同一对象引用。

import type { Page, Route } from '@playwright/test';
import { 信封, 取multipart部件, 解metadata部件, type 拦截请求形, type 路由上下文形 } from './协议';
import { fixture主体, 处理账号与目录域, type 账号域参数形 } from './账号与目录';
import { 创建P2附件fixture, 处理附件域, type P2附件fixture形 } from './附件';
import { 处理候选实名域, 处理隐私域, type P3隐私fixture形, type 候选实名FixtureState } from './隐私与实名';
import { 创建组织安装状态, 处理招聘组织域, type P1C招聘组织Fixture形, type 招聘方OnboardingFixture形 } from './招聘组织';
import { 创建P6安装状态, 处理Agent规则域, type P6分支配置, type P6FixtureState } from './Agent规则';
import { 创建P4安装状态, 处理发现推荐域, type P4发现fixture形 } from './发现推荐';
import { 处理MatchCase域, type P5MatchCasefixture形 } from './MatchCase';
import { 处理真人消息域, type P7FixtureState } from './真人消息';
import { 处理账号控制面域, type P8FixtureState } from './账号控制面';
import { 处理候选建档域, type 候选OnboardingFixture } from './候选建档';

export interface BFF路由选项 {
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


/** 安装 /api/v1 route fixture：按 path + method 匹配，返回 fixture 信封；P6/P4 可变状态经返回值暴露给测试断言。 */
export async function 安装BFF路由(page: Page, 选项: BFF路由选项): Promise<{ p6: P6FixtureState; p4: P4发现fixture形 | null; p7: P7FixtureState | null }> {
  const 会话已登录 = 选项.会话已登录 ?? true;
  // P4 发现域：可变 fixture 状态由用例自持（handler 直读直写）；路由映射表与委托登记跨请求存活
  const P4域 = 选项.发现fixture ?? null;
  // J-PILOT-01（Task 7）：P5 连续代谈臂的提前引用 —— 候选委托 POST（P4 臂）受理时
  // 要在同一 fixture 里登记 dlg 连续记录（响应是否送达不影响受理），P4 臂在 P5 臂之前。
  const P5连续域 = 选项.P5MatchCasefixture ?? null;
  // P7（Task 7）：真人会话域可变 fixture —— 函数级声明（return 也要暴露给测试断言）
  const P7域 = 选项.P7fixture ?? null;
  // P8（Task 8）：控制面域可变 fixture —— 测试自持对象，handler 直读直写
  const P8域 = 选项.P8控制面fixture ?? null;
  // Task 8：候选 onboarding 可变 fixture —— 测试自持对象，handler 直读直写
  const Onboarding域 = 选项.候选OnboardingFixture ?? null;
  // 阶段二：IV/P3 域引用由装配层一次创建（原在 route 回调内逐请求创建，语义等价：
  // 选项对象安装后不变）；缺席域精确空应答与各域 handler 共享同一引用
  const IV域 = 选项.候选实名域 ?? null;
  const P3域 = 选项.隐私fixture ?? null;
  const P4安装态 = 创建P4安装状态();
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
  // onboarding 完成状态：基础/P1C 组织 fixture = 已建立账号（双角色已完成）；
  // 新招聘方 onboarding 旅程的 recruiter 从 null 起步（候选旅程 fixture 自带状态并接管路由）
  const Onboarding完成表: Record<'candidate' | 'recruiter', string | null> = {
    candidate: '2026-08-25T10:00:00Z',
    recruiter: onboardingFixture ? null : '2026-08-25T10:00:00Z',
  };
  // ── 各域每次安装独立安装态（原 spec 430–503 的状态声明收口为工厂调用）──
  const 组织安装态 = 创建组织安装状态(组织fixture);
  const P6安装态 = 创建P6安装状态(选项.P6分支);
  const p6 = P6安装态.p6;
  // ── P2 附件简历域：route callback 之外声明（跨请求存活的可变状态）；
  // 缺席时每次安装自建一份隔离的合法空库，既有 Backend 用例默认拿到权威空清单 ──
  const P2域 = 选项.附件fixture ?? 创建P2附件fixture();
  const 账号域参数: 账号域参数形 = {
    主体,
    fixture主体,
    会话已登录,
    登录尝试id: 选项.登录尝试id,
    Onboarding完成表,
    P8域,
    P4域,
  };

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

    const 上下文: 路由上下文形 = { route, 请求, url, path, method, body, 部件们 };

    // ── 固定顺序分发：局部 handler 返回是否已应答；候选建档先于普通
    //    resume/intentions 路由，自定义覆盖已在上方先行 ──
    if (await 处理候选建档域(Onboarding域, 组织fixture, P3域, 上下文)) return;
    if (await 处理账号与目录域(上下文, 账号域参数)) return;
    if (await 处理候选实名域(IV域, 上下文)) return;
    if (await 处理附件域(P2域, 上下文)) return;
    if (await 处理隐私域(P3域, 上下文)) return;
    if (await 处理招聘组织域(组织安装态, 组织fixture, onboardingFixture, P3域, 上下文)) return;
    if (await 处理Agent规则域(P6安装态, 选项.P6分支, 上下文)) return;
    if (await 处理发现推荐域(P4域, P5连续域, P4安装态, 上下文)) return;
    if (await 处理MatchCase域(P5连续域, 上下文)) return;
    if (await 处理真人消息域(P7域, 上下文)) return;
    if (await 处理账号控制面域(P8域, P3域, 上下文)) return;
    // ── 缺席域的精确空应答（旧全局 200-null 兜底在这些坐标上的显式化：逐
    //    path+method 声明，不是通配）。隐私 / 连续代谈 / 收件箱 fixture 缺席的
    //    用例按原语义拿 200 空信封 → strict decode 拒绝 → 页面如实给空态/失败态
    //   （「Mock 内容不顶替 HTTP」的既有边界）。其余未匹配请求不再有任何兜底。──
    if (P3域 === null && path === '/api/v1/me/privacy' && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封(null) });
      return;
    }
    if (P5连续域 === null && path === '/api/v1/me/negotiations' && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封(null) });
      return;
    }
    // 主壳在谈摘要读（match-cases/summary 闭合五键合同）：MatchCase fixture 缺席的既有
    // 用例按旧全局兜底口径拿 200 空信封 → strict decode 拒绝 → 摘要出错误/占位态。
    if (P5连续域 === null && path === '/api/v1/me/match-cases/summary' && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封(null) });
      return;
    }
    // 发岗后招聘主壳按 job scope 拉在谈工作区清单：同为 MatchCase fixture 缺席坐标的
    // 显式化（strict decode 拒绝 → 工作区错误态，与移除前一致）。
    if (P5连续域 === null && path === '/api/v1/recruiter/match-cases' && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封(null) });
      return;
    }
    if (P7域 === null && method === 'GET'
      && (path === '/api/v1/me/conversations' || path === '/api/v1/recruiter/conversations')) {
      await route.fulfill({ status: 200, json: 信封(null) });
      return;
    }
    // 设置页 / 我 页的账号手机号与实名行（P8 凭证 / 候选实名域缺席的既有用例）：
    // 同为旧全局兜底在这些坐标的显式化 —— 200 空信封 → strict decode 拒绝 → 行出
    // 错误/未知态，与移除前的可观察行为一致（域在场时由各自 handler 先应答）。
    if (P8域 === null && path === '/api/v1/me/credentials' && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封(null) });
      return;
    }
    if (IV域 === null && path === '/api/v1/me/identity-verification' && method === 'GET') {
      await route.fulfill({ status: 200, json: 信封(null) });
      return;
    }
    // 简历教育条目更新（候选 onboarding fixture 缺席的既有用例「写入 body 使用选择 ID」
    // 只断言请求形状、不消费应答）—— 同为旧全局兜底在此坐标的显式化：200 空信封 →
    // strict decode 拒绝 → 页面按写入失败收口，与移除前的可观察行为一致。
    const 教育条目改 = /^\/api\/v1\/me\/resume\/educations\/[^/]+$/.exec(path);
    if (Onboarding域 === null && 教育条目改 && method === 'PATCH') {
      await route.fulfill({ status: 200, json: 信封(null) });
      return;
    }

    // 未匹配的 /api/v1/* 不再回 200 空信封兜底：显式 fallback 交给 context 级
    // 离线边界（e2e/fixtures/离线边界.ts）兜底中止并记录，Case teardown 核对()
    // 抛错定位。有意测试缺资源/解码错误的场景须对准确 path/method 声明对应空/
    // 错误响应（见上方缺席域显式路由），不得用全局兜底吞缺口。
    await route.fallback();
  });
  return { p6, p4: P4域, p7: P7域 };
}
