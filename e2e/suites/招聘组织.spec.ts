// e2e/suites/招聘组织.spec.ts
// C6：原「P1C 招聘组织 fixture @backend」describe 等价迁入（含嵌套的企业名片/
// 公开页统一用例；titlePath 原样保留）。

import { expect, test } from '../fixtures/test';
import { 抽屉搜企业并选中, 走完后端发岗向导, hash直达 } from '../fixtures/数据源交互';
import { 信封 } from '../fixtures/bff/协议';
import { 标记 } from '../fixtures/bff/账号与目录';
import { P1C标记, 创建招聘方OnboardingFixture, P1C企业档案, P1C岗位, P1C招聘组织Fixture, P1C管理员关系, P1C成员关系, P1C组织甲, P1C组织乙, 带企业关系, 一像素PNG, type P1C企业档案形 } from '../fixtures/bff/招聘组织';
import { P3隐私fixture, P1C搜索池 } from '../fixtures/bff/隐私与实名';
import { 安装BFF路由 } from '../fixtures/bff/安装BFF路由';
import { type Page } from '@playwright/test';

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
// ─────────────────────────────────────────────────────────────────────────────
// P1C 组织域 fixture @backend —— 招聘 Organization 全链路（intercepted boundary only）
// ─────────────────────────────────────────────────────────────────────────────
test.describe('P1C 招聘组织 fixture @backend', () => {
  // 显式 backend/stg server（端口 4182），与既有 @backend 用例同一口径
  test.use({ baseURL: 'http://127.0.0.1:4182' });

  test('P1C 招聘 Organization 全链路使用 HTTP fixture 且发岗 body 无可信字段 @backend', async ({ page }) => {
    // 未认证招聘方 + 无企业关系：名片来自 /recruiter/profile，公司自报经 公司选择抽屉
    // 选中目录组织（organization_ref）；发岗 POST 带显式 publisher/hiring 两个 ref ——
    // verification status / affiliation / claim 全是服务端推导，客户端 body 一个都不能伪造。
    // 已完成账号走注册流名片会被路由守卫弹回企业主壳（Spec §5 有意行为），故用应用内入口。
    const 请求们: { path: string; method: string; body: unknown }[] = [];
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P1C搜索池();
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-org',
      记录目录请求: () => undefined,
      请求拦截: ({ path, method, body }) => 请求们.push({ path, method, body }),
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      隐私fixture: 隐私,
    });

    await hash直达(page, '/#/hr/card');
    await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible({ timeout: 20_000 });
    // 名片姓名来自 HTTP fixture（Mock 里没有这个值）
    await expect(page.getByText(P1C招聘组织Fixture.profile.public_name).first()).toBeVisible();
    await expect(page.getByLabel('姓名')).toHaveValue(P1C招聘组织Fixture.profile.public_name);

    // 无企业关系 → 公司自报行是选择入口；打开抽屉、搜索、点确切目录候选；
    // 选中只改本页草稿：点「保存」前零档案 PATCH。
    await page.getByRole('button', { name: '未选择公司' }).click();
    await 抽屉搜企业并选中(page, '云衢科技', P1C标记.组织甲名);
    await expect(page.getByRole('button', { name: P1C标记.组织甲名 })).toBeVisible();
    expect(请求们.filter((项) => 项.path === '/api/v1/recruiter/profile' && 项.method !== 'GET')).toEqual([]);

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

    // 应用内普通编辑：主按钮是「保存」，成功后留在本屏（不推进发岗、不 complete）。
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('保存成功')).toBeVisible({ timeout: 20_000 });
    const 档案写 = 请求们.find((项) => 项.path === '/api/v1/recruiter/profile' && 项.method === 'PATCH');
    expect(档案写).toBeDefined();
    // 保存 body 携带选中的 organization_ref（合同 A/C 唯一权威坐标）
    expect(档案写!.body).toMatchObject({ organization_ref: P1C标记.组织甲编号 });

    // 发岗（真实三步向导）→ POST /api/v1/recruiter/jobs
    await hash直达(page, '/#/hr/post-job');
    await 走完后端发岗向导(page);
    await expect(page).toHaveURL(/#\/hr$/, { timeout: 20_000 });

    const 创建 = 请求们.find((项) => 项.path === '/api/v1/recruiter/jobs' && 项.method === 'POST');
    expect(创建).toBeDefined();
    // 正向：direct 模式 + 显式发布方/用人目录 ID（向导内选中，两 ref 相同）
    expect(创建!.body).toMatchObject({
      publisher_mode: 'direct',
      publisher_organization_ref: 'org-fixture-p3-manual-a',
      hiring_organization_ref: 'org-fixture-p3-manual-a',
    });
    // 负向（替代旧整包正则）：客户端不得伪造 verification_status / affiliation / claim
    const 创建键们 = Object.keys(创建!.body as Record<string, unknown>);
    expect(创建键们.filter((键) => /verification_status|affiliation|_claim/.test(键))).toEqual([]);
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

    await hash直达(page, '/#/hr/card');
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
    await hash直达(page, '/#/hr/card');
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

    await hash直达(page, '/#/hr/verify');
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
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P1C搜索池();
    await 安装BFF路由(page, {
      登录尝试id: 'att-p1c-profile',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      隐私fixture: 隐私,
      请求拦截: ({ path, method, body, headers, multipart }) => {
        if (method !== 'GET') 写入们.push({ path, method, body, headers, multipart });
      },
    });

    // 应用内普通编辑入口（存量档案 revision 3）：PATCH→头像 的 revision 链由本用例承载
    await hash直达(page, '/#/hr/card');
    await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel('姓名')).toHaveValue(P1C标记.招聘方公开名);

    await page.getByLabel('姓名').fill('沈 fixture');
    // 公司自报是保存前置必填：经 公司选择抽屉 选中目录组织；选中只改草稿，不发声请求。
    await page.getByRole('button', { name: '未选择公司' }).click();
    await 抽屉搜企业并选中(page, '云衢科技', P1C标记.组织甲名);
    await page.setInputFiles('input[aria-label="更换头像"]', {
      name: '头像.png', mimeType: 'image/png', buffer: 一像素PNG,
    });
    // 应用内普通编辑：主按钮是「保存」，成功后留在本屏弹「保存成功」（不推进发岗）。
    await expect(page.getByRole('button', { name: '保存并继续' })).toHaveCount(0);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('保存成功')).toBeVisible({ timeout: 20_000 });

    const 档案写 = 写入们.find((项) => 项.path === '/api/v1/recruiter/profile' && 项.method === 'PATCH');
    expect(档案写).toBeDefined();
    // PATCH body = 公开名、职务与选中的自报组织 ref；If-Match 是当前 revision 的 etag
    expect(档案写!.body).toEqual({
      public_name: '沈 fixture',
      title: P1C标记.招聘方职务,
      organization_ref: P1C标记.组织甲编号,
    });
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
    await hash直达(page, '/#/hr/company-profile/album');
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
    await hash直达(page, '/#/hr/card');
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

    await hash直达(page, '/#/hr/job/job-fixture-001');
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

    await hash直达(page, '/#/hr/job/job-fixture-noref');
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

    await hash直达(page, `/#/company/${P1C标记.组织甲编号}`);
    await expect(page.getByText(P1C标记.组织甲法定名)).toBeVisible({ timeout: 10_000 });

    await hash直达(page, '/#/company/org-fixture-gone');
    await expect(page.getByText('这家企业暂时打不开')).toBeVisible({ timeout: 10_000 });
    // Mock 分支的静态公司页内容不出现（不回退静态档）
    await expect(page.getByText('公司自述')).toHaveCount(0);
    await expect(page.getByText('作息与条款')).toHaveCount(0);
  });

  // ── 企业名片统一（Task 3）：两栈消费同一份 企业公开页展示/招聘名片展示。
  //    Backend 侧验证「合法缺字段是占位、契约错误/失败不是成功占位页」与能力差异，
  //    不复写上方三条 P1C 既有回归，只新增统一展示的跨模式断言。──

  test('企业名片统一 Backend 公开页真实字段上屏、缺字段占位、岗位/导航能力不可执行 @backend', async ({ page }) => {
    await 安装BFF路由(page, {
      登录尝试id: 'att-uni-org-full',
      记录目录请求: () => undefined,
      // 无企业关系：公开页只经 URL 按 opaque ID 直读，不经过名片当前关系
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
    });

    await hash直达(page, `/#/company/${P1C标记.组织甲编号}`);
    await expect(page.getByText(P1C标记.组织甲法定名)).toBeVisible({ timeout: 10_000 });

    // 身份行来自 HTTP：法定名/展示名/核验时间（slice(0,10)）；岗位数是真实已核验在招数
    await expect(page.getByText('2026-08-25', { exact: true })).toBeVisible();
    await expect(page.getByText('天使轮 · 20-99 人 · Fixture 行业')).toBeVisible();
    // 同一岗位数文案出现在「企业身份」行与底部固定区两处
    await expect(page.getByText('1 个已核验在招岗位')).toHaveCount(2);

    // 能力不可执行：无岗位层入口、无导航键，只给事实与不可点说明，绝不给假按钮
    await expect(page.getByRole('button', { name: /看这家在招的/ })).toHaveCount(0);
    await expect(page.getByText('岗位列表暂不可用')).toBeVisible();
    await expect(page.getByRole('button', { name: '导航 ›' })).toHaveCount(0);
    await expect(page.getByText('导航暂不可用')).toBeVisible();

    // 统一展示下两栈同结构：接口没有的字段是明确占位，不是整卡消失。
    // 文化/历程占位在对应 Tab 正文里：切 Tab 只换正文，不改事实来源
    await expect(page.getByText(P1C标记.公司介绍)).toBeVisible();
    await page.getByRole('button', { name: '企业文化' }).click();
    await expect(page.getByText('企业文化未知')).toBeVisible();
    await page.getByRole('button', { name: '发展历程' }).click();
    await expect(page.getByText('发展历程未知')).toBeVisible();
    await page.getByRole('button', { name: '公司简介' }).click();
    await expect(page.getByText('主营业务', { exact: true })).toBeVisible();
    await expect(page.getByText('Fixture 主营业务一')).toBeVisible();
    await expect(page.getByRole('img', { name: '公司相册未知' })).toBeVisible();
    await expect(page.getByRole('img', { name: '企业 LOGO 未知' })).toBeVisible();
    await expect(page.getByText('在职者反馈未知')).toBeVisible();
    await expect(page.getByText('工商资料未知')).toBeVisible();
    // 反馈未知就不画统计条，也不出现匿名评价来源说明
    await expect(page.getByText('来自平台内匿名评价')).toHaveCount(0);

    // 条款：福利标签是企业自述 → 「已提供 N 条条款」，没有代理核对结果就没有已核计数
    const 条款卡 = page.getByRole('button', { name: /作息与条款/ });
    await expect(条款卡).toContainText('已提供 1 条条款');
    await expect(条款卡).not.toContainText('条已由代理核对');
    await expect(条款卡).toContainText('双休');

    // 全文层：产品/团队在固定五部分里完整可达（Backend 不再有独立产品/团队卡）
    await page.getByRole('button', { name: '读全文 ›' }).click();
    await expect(page.getByText('Fixture 产品介绍')).toBeVisible();
    await expect(page.getByText('Fixture 成员简介')).toBeVisible();
    await page.keyboard.press('Escape');

    // 条款层：接口没有代理核对结果 → 「代理核对信息未知」，不写「0 条已核」冒充已检查
    await 条款卡.click();
    await expect(page.getByText('代理核对信息未知')).toBeVisible();
    await expect(page.getByText(/已核对 0 条条款/)).toHaveCount(0);
    await page.keyboard.press('Escape');

    // 来源页脚：公开信息来源与身份核验说明
    await expect(page.getByText('公开信息由企业主页提供 · 企业身份经平台核验')).toBeVisible();
  });

  test('企业名片统一 Backend 合法空公开档案逐字段占位且真实 0 不是未知 @backend', async ({ page }) => {
    // 全空但合法的公开档案：每个字段都转成对应「未知」，0 岗位照常显示 0（真实 0 ≠ 未知），
    // 整页仍是一张成功页，不是「打不开」的诚实空态。
    const 空档案: P1C企业档案形 = {
      ...P1C企业档案(),
      brand_name: '',
      industry: null,
      company_size: '',
      funding_stage: '',
      office_address: '',
      benefit_codes: [],
      work_schedule: '',
      company_intro: '',
      business_items: [],
      product_intro: '',
      team_members: [],
      logo: null,
      office_media: [],
      company_media: [],
    };
    await 安装BFF路由(page, {
      登录尝试id: 'att-uni-org-empty',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [], {
        [P1C标记.组织甲编号]: {
          legal_name: P1C标记.组织甲法定名,
          display_name: P1C标记.组织甲名,
          profile: 空档案,
        },
      }),
      主体初始角色: 'recruiter',
      // 内置公开企业路由的 active_verified_job_count 固定为 1；本用例经覆盖给出合法 0
      覆盖: {
        [`GET /api/v1/organizations/${P1C标记.组织甲编号}`]: () => ({
          status: 200,
          响应: 信封({
            organization_id: P1C标记.组织甲编号,
            legal_name: P1C标记.组织甲法定名,
            display_name: P1C标记.组织甲名,
            verified_at: '2026-08-25T00:00:00Z',
            profile: 空档案,
            active_verified_job_count: 0,
          }),
        }),
      },
    });

    await hash直达(page, `/#/company/${P1C标记.组织甲编号}`);
    await expect(page.getByText(P1C标记.组织甲法定名)).toBeVisible({ timeout: 10_000 });

    // 规模行逐字段补未知后拼接；必需身份字段仍来自 HTTP，不用占位掩盖契约
    await expect(page.getByText('融资阶段未知 · 公司规模未知 · 行业未知')).toBeVisible();
    await expect(page.getByText('2026-08-25', { exact: true })).toBeVisible();

    // 逐字段占位：每个缺失块保留区块与标签（文化/历程占位在各自 Tab 正文里）
    await expect(page.getByText('公司简介未知')).toBeVisible();
    await page.getByRole('button', { name: '企业文化' }).click();
    await expect(page.getByText('企业文化未知')).toBeVisible();
    await page.getByRole('button', { name: '发展历程' }).click();
    await expect(page.getByText('发展历程未知')).toBeVisible();
    await page.getByRole('button', { name: '公司简介' }).click();
    await expect(page.getByText('主营业务未知')).toBeVisible();
    await expect(page.getByRole('img', { name: '公司相册未知' })).toBeVisible();
    await expect(page.getByText('作息信息未知')).toBeVisible();
    await expect(page.getByText('福利信息未知')).toBeVisible();
    await expect(page.getByText('办公地址未知')).toBeVisible();
    await expect(page.getByText('地址补充未知')).toBeVisible();
    await expect(page.getByText('在职者反馈未知')).toBeVisible();
    await expect(page.getByText('工商资料未知')).toBeVisible();

    // 全文层五部分里产品/团队同样占位
    await page.getByRole('button', { name: '读全文 ›' }).click();
    await expect(page.getByText('产品介绍未知')).toBeVisible();
    await expect(page.getByText('团队介绍未知')).toBeVisible();
    await page.keyboard.press('Escape');

    // 真实 0 照常展示（身份行 + 底栏两处），岗位列表仍不可用
    await expect(page.getByText('0 个已核验在招岗位')).toHaveCount(2);
    await expect(page.getByText('岗位列表暂不可用')).toBeVisible();
    // 合法空档案 ≠ 请求失败：不出现诚实空态
    await expect(page.getByText('这家企业暂时打不开')).toHaveCount(0);
  });

  test('企业名片统一 Organization 读取失败只见诚实空态不见成功占位区 @backend', async ({ page }) => {
    await 安装BFF路由(page, {
      登录尝试id: 'att-uni-org-fail',
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

    await hash直达(page, '/#/company/org-fixture-gone');
    await expect(page.getByText('这家企业暂时打不开')).toBeVisible({ timeout: 10_000 });
    // 失败页不出现成功页的任何占位/结构：占位只属于「成功取得资料后的合法缺失」
    await expect(page.getByText('企业名称未知')).toHaveCount(0);
    await expect(page.getByText('公司简介未知')).toHaveCount(0);
    await expect(page.getByText('主营业务未知')).toHaveCount(0);
    await expect(page.getByText('工商资料未知')).toHaveCount(0);
    await expect(page.getByText('岗位列表暂不可用')).toHaveCount(0);
    await expect(page.getByText('公司自述')).toHaveCount(0);
    await expect(page.getByText('作息与条款')).toHaveCount(0);
    await expect(page.getByText(P1C标记.公司介绍)).toHaveCount(0);
  });

  test('企业名片统一 名片空公开档案预览占位且未知不进输入与提交 @backend', async ({ page }) => {
    // 全新招聘方 onboarding fixture：档案首读 404（合法的「还没有」）→ 名片空值态
    const 写入们: { path: string; method: string }[] = [];
    await 安装BFF路由(page, {
      登录尝试id: 'att-uni-card-empty',
      记录目录请求: () => undefined,
      招聘方OnboardingFixture: 创建招聘方OnboardingFixture(),
      请求拦截: ({ path, method }) => {
        if (method !== 'GET') 写入们.push({ path, method });
      },
    });

    await 以招聘方进入名片(page);
    await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible({ timeout: 10_000 });
    // 进名片时的切角色写入（PUT roles / preferences）不属名片域：此后名片域零写入为基线
    const 名片写入基线 = 写入们.length;

    // 预览三段占位 + 无图的中性空白头像位（不用姓名首字/企业字标冒充照片）
    await expect(page.getByText('姓名未知')).toBeVisible();
    await expect(page.getByText('职务未知')).toBeVisible();
    await expect(page.getByText('企业信息未知')).toBeVisible();
    await expect(page.getByRole('img', { name: '头像未知' })).toBeVisible();

    // 「未知」只进展示：可编辑行是空串输入 + 可行动占位符；公司行是选择入口按钮
    //（未选组织时显示「未选择公司」，绝不把「企业信息未知」塞进任何输入或提交）
    await expect(page.getByLabel('姓名')).toHaveValue('');
    await expect(page.getByLabel('职务')).toHaveValue('');
    await expect(page.getByPlaceholder('请填写姓名')).toBeVisible();
    await expect(page.getByPlaceholder('请填写职务')).toBeVisible();
    await expect(page.getByRole('button', { name: '未选择公司' })).toBeVisible();
    await expect(page.getByPlaceholder('请填写公司名称')).toHaveCount(0);

    // 打开选择抽屉再取消：选择本身零业务写入
    await page.getByRole('button', { name: '未选择公司' }).click();
    const 企业抽屉 = page.getByRole('dialog', { name: '选择企业' });
    await expect(企业抽屉).toBeVisible({ timeout: 10_000 });
    await expect(企业抽屉.getByPlaceholder('输入公司名称')).toBeVisible(); // 搜索视图正文
    await page.keyboard.press('Escape');
    await expect(企业抽屉).toHaveCount(0, { timeout: 10_000 });
    expect(写入们.slice(名片写入基线)).toEqual([]);

    // 空值保存：本地校验拦截，一个请求都不发，也不把占位文案写进任何提交
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page.getByText('请填写姓名')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/#\/hr\/card$/);
    expect(写入们.slice(名片写入基线)).toEqual([]);
  });

  test('企业名片统一 实名只读姓名保留公开名且认证标记按事实 @backend', async ({ page }) => {
    const 写入们: { path: string; method: string; body: unknown }[] = [];
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P1C搜索池();
    await 安装BFF路由(page, {
      登录尝试id: 'att-uni-card-verified',
      记录目录请求: () => undefined,
      招聘组织Fixture: {
        ...P1C招聘组织Fixture,
        profile: {
          ...P1C招聘组织Fixture.profile,
          personal_verification_status: 'verified',
          verified_name: '沈实名',
          public_name: '公开马甲名',
        },
        organizations: { [P1C标记.组织甲编号]: P1C组织甲() },
      },
      主体初始角色: 'recruiter',
      隐私fixture: 隐私,
      请求拦截: ({ path, method, body }) => {
        if (method !== 'GET') 写入们.push({ path, method, body });
      },
    });

    // 应用内普通编辑入口（非注册流）→ 主按钮是「保存」
    await hash直达(page, '/#/hr/card');
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible({ timeout: 10_000 });

    // 当前可见姓名槽（预览 + 只读行）都显示实名姓名；没有可编辑姓名输入，公开名不上屏
    await expect(page.getByText('沈实名')).toHaveCount(2);
    await expect(page.getByLabel('姓名')).toHaveCount(0);
    await expect(page.getByText('公开马甲名')).toHaveCount(0);
    await expect(page.getByText('已认证', { exact: true })).toBeVisible();

    // 保存前置的公司自报经抽屉选中；保存仍提交原公开名：实名只读不把 public_name 擅自替换成实名姓名
    await page.getByRole('button', { name: '未选择公司' }).click();
    await 抽屉搜企业并选中(page, '云衢科技', P1C标记.组织甲名);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('保存成功')).toBeVisible({ timeout: 10_000 });
    const 档案写 = 写入们.find((项) => 项.path === '/api/v1/recruiter/profile' && 项.method === 'PATCH');
    expect(档案写).toBeDefined();
    expect(档案写!.body).toEqual({
      public_name: '公开马甲名',
      title: P1C标记.招聘方职务,
      organization_ref: P1C标记.组织甲编号,
    });
  });

  test('企业名片统一 名片保存失败保留输入与暂存头像并可重试 @backend', async ({ page }) => {
    const 写入们: { path: string; method: string }[] = [];
    let 档案写数 = 0;
    const 隐私 = P3隐私fixture();
    隐私.组织库 = P1C搜索池();
    await 安装BFF路由(page, {
      登录尝试id: 'att-uni-card-retry',
      记录目录请求: () => undefined,
      招聘组织Fixture: 带企业关系(P1C招聘组织Fixture, [], { [P1C标记.组织甲编号]: P1C组织甲() }),
      主体初始角色: 'recruiter',
      隐私fixture: 隐私,
      请求拦截: ({ path, method }) => {
        if (method !== 'GET') 写入们.push({ path, method });
      },
      覆盖: {
        'PATCH /api/v1/recruiter/profile': () => {
          档案写数 += 1;
          if (档案写数 === 1) {
            return { status: 500, 响应: { error: { type: 'internal_error', message: 'fixture 故障' } } };
          }
          return undefined; // 重试这一次放行给内置 fixture
        },
      },
    });

    // 应用内普通编辑入口（注册流入口会被已完成账号的守卫弹回企业主壳）
    await hash直达(page, '/#/hr/card');
    await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel('姓名')).toHaveValue(P1C标记.招聘方公开名);
    await page.getByLabel('姓名').fill('重试招聘方');
    await page.getByLabel('职务').fill('资深招聘');
    await page.getByRole('button', { name: '未选择公司' }).click();
    await 抽屉搜企业并选中(page, '云衢科技', P1C标记.组织甲名);
    await page.setInputFiles('input[aria-label="更换头像"]', {
      name: '重试头像.png', mimeType: 'image/png', buffer: 一像素PNG,
    });
    // 暂存预览：服务端成功前只是内存预览，不落权威档案
    await expect(page.getByRole('img', { name: '头像预览' })).toBeVisible();

    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('后端服务暂时不可用，请稍后重试')).toBeVisible({ timeout: 10_000 });
    // 失败保留输入、所选企业与文件预览，不离开本屏，按钮也不再是保存中
    await expect(page).toHaveURL(/#\/hr\/card$/);
    await expect(page.getByLabel('姓名')).toHaveValue('重试招聘方');
    await expect(page.getByLabel('职务')).toHaveValue('资深招聘');
    await expect(page.getByRole('button', { name: P1C标记.组织甲名 })).toBeVisible();
    await expect(page.getByRole('img', { name: '头像预览' })).toBeVisible();
    await expect(page.getByRole('button', { name: '保存中…' })).toHaveCount(0);

    // 同一个保存键重试：PATCH 与头像 POST 各放行一次，成功后留在本屏
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('保存成功')).toBeVisible({ timeout: 20_000 });
    expect(写入们.filter((项) => 项.path === '/api/v1/recruiter/profile' && 项.method === 'PATCH')).toHaveLength(2);
    expect(写入们.some((项) => 项.path === '/api/v1/recruiter/avatar' && 项.method === 'POST')).toBe(true);
  });
});
