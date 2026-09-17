// C6（2026-09-16 Task 3）：本文件是「候选建档」与「招聘建档与JD」两个 Suite 的文件级
// 并集 —— 以 walks the recruiter journey / publishes an internship / Mock 招聘剧情 开头
// 的三项归招聘建档与JD，其余五项归候选建档；titlePath 原样保留，不建第三个 Suite。
import { expect, test } from './fixtures/test';
import type { Page } from '@playwright/test';

async function 从登录进入身份(page: Page, 身份: '我要找工作' | '我要招人') {
  await page.goto('/');
  await page.getByText(/已阅读并同意/).click();
  await page.getByRole('button', { name: '微信登录' }).click();
  await expect(page).toHaveURL(/#\/identity$/);
  await page.getByRole('button', { name: 身份 }).click();
}

/** Mock 招聘剧情入口：从身份选择点「我要招人」进招聘名片（P1C 数据源改造后仍不强插
 *  Backend identity flow，Mock 招聘方没有 opaque Organization ID 也能走完整剧情）。 */
async function 进入Mock招聘名片(page: Page) {
  await 从登录进入身份(page, '我要招人');
  await expect(page).toHaveURL(/#\/hr\/card$/);
  await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible();
}

async function 选择期望职位(page: Page, 分类: string, 职位: string) {
  await page.getByRole('button', { name: /选择期望职位/ }).click();
  await page.getByRole('button', { name: 分类, exact: true }).click();
  await page.getByRole('button', { name: 职位, exact: true }).click();
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page).toHaveURL(/#\/student$/);
}

async function 走完学历资料(page: Page) {
  for (const [路径, 标题] of [
    ['degree', /最高学历|在读学历/],
    ['school', '你毕业于'],
    ['major', '你的专业是'],
    ['eduyears', '就读时间段'],
  ] as const) {
    await expect(page).toHaveURL(new RegExp(`#\\/onboard\\/${路径}$`));
    await expect(page.getByRole('heading', { name: 标题 })).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();
  }
  await expect(page).toHaveURL(/#\/experience$/);
}

/** 首屏「期望薪资」行（合同 C / Spec §3.2）：值与单位合成在题名里，行本身可访问名被
 *  aria-label="期望薪资" 覆盖 —— 行内值文本不是可访问名的一部分，所以按 aria-label
 *  定位、值用 toContainText 读。 */
function 首屏薪资行(page: Page) {
  return page.getByRole('button', { name: '期望薪资', exact: true });
}

/** 首屏选月薪：开共用薪资区间层 → 点 30 档（联动把上限抬到 40）→ 确定回填。 */
async function 选首屏薪资(page: Page, 档: string) {
  const 行 = 首屏薪资行(page);
  await 行.click();
  const 抽屉 = page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' });
  await expect(抽屉).toBeVisible();
  await 抽屉.getByRole('listbox', { name: '薪资下限' }).getByRole('option', { name: 档, exact: true }).click();
  await 抽屉.getByRole('button', { name: '确定' }).click();
  await expect(抽屉).toHaveCount(0);
  await expect(行).toContainText('30-40K');
}

test.describe('multi-role onboarding', () => {
  test('walks the social-hire journey from role entry to the preference supplement', async ({ page }) => {
    await 从登录进入身份(page, '我要找工作');
    await expect(page).toHaveURL(/#\/student$/);
    await expect(page.getByRole('button', { name: '已毕业' })).toHaveAttribute('aria-pressed', 'true');

    // 作品集链接已搬去 /experience（简历内容，不是求职偏好），本屏不该再有这个字段
    await expect(page.getByLabel('作品集或项目链接')).toHaveCount(0);

    // 重复确认当前身份不能清掉已经填写的偏好。
    await page.getByRole('button', { name: '全远程' }).click();
    await page.getByRole('button', { name: '已毕业' }).click();
    await expect(page.getByRole('button', { name: '全远程' })).toHaveAttribute('aria-pressed', 'false');

    await 选择期望职位(page, '产品', '产品经理');
    // 首屏薪资（合同 C）：社招是月薪档；未确认时下一步被拦、留首屏（不再有独立薪资页）
    await expect(page.getByText('期望薪资（月薪 · K）')).toBeVisible();
    await expect(首屏薪资行(page)).toContainText('请选择');
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/student$/);
    await expect(page.getByText('请确认期望薪资，也可以选择面议')).toBeVisible();
    await 选首屏薪资(page, '30');
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/basic$/);
    await expect(page.getByRole('heading', { name: '创建在线简历' })).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/onboard\/status$/);
    // 求职状态已无默认档（「不设默认档，未选择就提示」）：先选再走，否则下一步被拦
    await page.getByRole('button', { name: '在职 · 考虑机会' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await 走完学历资料(page);

    // 作品集链接的新家：在线简历屏，与专业技能 / 证书与语言并列的独立区块
    await expect(page.getByRole('heading', { name: '在线简历' })).toBeVisible();
    await page.getByLabel('作品集或项目链接').fill('github.com/example/kept-project');
    await page.getByLabel('作品集或项目链接').blur();
    await expect(page.getByLabel('作品集或项目链接')).toHaveValue(
      'https://github.com/example/kept-project',
    );
    // 清空是合法三态之一（null 写盘的输入侧表现；wire 层三态由 Backend fixture 用例核对）：
    // 清完不报错、值为空串，再填回时规范化照旧生效
    await page.getByLabel('作品集或项目链接').fill('');
    await page.getByLabel('作品集或项目链接').blur();
    await expect(page.getByLabel('作品集或项目链接')).toHaveValue('');
    await page.getByLabel('作品集或项目链接').fill('github.com/example/kept-project');
    await page.getByLabel('作品集或项目链接').blur();
    await expect(page.getByLabel('作品集或项目链接')).toHaveValue(
      'https://github.com/example/kept-project',
    );
    // 零工作经历可以下一步：本旅程全程没点过「添加工作经历」，这里钉住页面上确实
    // 没有任何经历行（删除入口只出现在已建经历的编辑层里），保存照样推进
    await expect(page.getByText(/删除这段经历/)).toHaveCount(0);
    // 个人优势（Task 3 合同 C）：从向导偏好转进本资料页，随简历链一起保存
    await page.getByLabel('个人优势').fill('Mock 社招候选人的个人优势标记');
    await page.getByRole('button', { name: '保存' }).click();

    // 资料页保存链收口：简历链成功 → 个人优势保存成功 → 确认 summary 分区 → 补充偏好
    await expect(page).toHaveURL(/#\/wizard$/);
    await expect(page.getByRole('heading', { name: '哪些情况直接排除？' })).toBeVisible();
    // 向导只剩补充偏好一题：首屏已确认的职位/城市/薪资与个人优势都不再在这里问
    await expect(page.getByRole('heading', { name: '期望现金月薪是？' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '分享一下自己的个人优势' })).toHaveCount(0);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/disclosure$/);
  });

  test('walks the student journey from role entry to the preference supplement on daily pay', async ({ page }) => {
    await 从登录进入身份(page, '我要找工作');
    await expect(page).toHaveURL(/#\/student$/);
    await page.getByRole('button', { name: '在校' }).click();
    await expect(page.getByRole('button', { name: '实习生' })).toHaveAttribute('aria-pressed', 'true');

    // 「最早可开始实习日期」2026-08-22 已删（招聘端「最晚可接受实习开始日期」被产品负责人
    // 标注删掉后它就没有比对对象了），这里不再填它，顺带守住「删完不该再冒出来」
    await expect(page.getByLabel('最早可开始实习日期')).toHaveCount(0);
    await 选择期望职位(page, '产品', '产品经理');

    // 首屏薪资（合同 C）：实习生档是日薪。面议起步：抽屉里左轮停在面议档、右轮整列隐藏；
    // 取消零回填（滚轮初始落点不当已填写），确定写 0/0 后行显示面议
    await expect(page.getByText('期望薪资（日薪 · 元/天）')).toBeVisible();
    const 薪资行 = 首屏薪资行(page);
    await expect(薪资行).toContainText('请选择');
    await 薪资行.click();
    const 日薪抽屉 = page.getByRole('dialog', { name: '薪资要求(日薪，单位:元)' });
    await expect(日薪抽屉).toBeVisible();
    await expect(日薪抽屉.getByRole('listbox', { name: '薪资下限' }).getByRole('option', { name: '面议' })).toHaveAttribute('aria-selected', 'true');
    await expect(日薪抽屉.getByRole('listbox', { name: '薪资上限' })).toHaveCount(0);
    await 日薪抽屉.getByRole('button', { name: '取消' }).click();
    await expect(日薪抽屉).toHaveCount(0);
    await expect(薪资行).toContainText('请选择');
    await 薪资行.click();
    await page.getByRole('dialog', { name: '薪资要求(日薪，单位:元)' }).getByRole('button', { name: '确定' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(薪资行).toContainText('面议');

    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/basic$/);
    await expect(page.getByRole('heading', { name: '创建在线简历' })).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/onboard\/status$/);
    // 学生档同样无默认：先选「在校 ·」档再下一步，否则被「请选择当前求职状态」拦下
    await page.getByRole('button', { name: '在校 · 考虑机会' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await 走完学历资料(page);
    // 空优势仍按原合同处理（不新增必填）：不填也能保存推进
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page).toHaveURL(/#\/wizard$/);
    await expect(page.getByRole('heading', { name: '哪些情况直接排除？' })).toBeVisible();
    // 学生与社招同一条主序：向导里不再有独立薪资题
    await expect(page.getByRole('heading', { name: '期望实习日薪是？' })).toHaveCount(0);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/disclosure$/);
  });

  test('walks the recruiter journey from role entry to job posting', async ({ page }) => {
    await 从登录进入身份(page, '我要招人');
    // 标注 2026-08-20 13:32 定、2026-08-22 再次确认：企业端先不做实名认证，选完身份直接落
    // 招聘名片。这两条断言守的就是「/hr/verify 不能被重新塞回注册第一屏」
    await expect(page).toHaveURL(/#\/hr\/card$/);
    await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '实名认证' })).toHaveCount(0);

    // 认证撤了，姓名与公司回到可就地编辑（同一批标注的 13:35 那条），
    // 灰色只读态的「已认证」徽标不该再出现
    await expect(page.getByText('已认证')).toHaveCount(0);

    // 逐行验证常驻就地输入（标注 2026-08-24：不再有「点一下变输入框」的两态，
    // 每行本身就是输入框）：直接改值、失焦即存。三行走同一条路径，
    // 漏测哪行都可能只改了一半
    for (const [行标签, 原值, 新值] of [
      ['姓名', '邵铭', '沈知远'],
      ['职务', '技术 VP', '招聘负责人'],
      ['公司', '云衢科技', '云衢信息科技'],
    ] as const) {
      const 输入框 = page.getByLabel(行标签, { exact: true });
      await expect(输入框).toHaveValue(原值);
      await 输入框.fill(新值);
      await 输入框.blur();
      await expect(输入框).toHaveValue(新值);
    }
    // 收笔要落到预览区（顶部姓名 + 职务·公司副行），不能只停在输入框里
    await expect(page.getByText('沈知远')).toBeVisible();
    await expect(page.getByText('招聘负责人 · 云衢信息科技')).toBeVisible();

    await page.getByRole('button', { name: '保存 · 去发岗位' }).click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/);
    await expect(page.getByRole('heading', { name: '岗位基础信息' })).toBeVisible();
  });

  test('migrates a legacy mixed job preference and keeps internship data on daily pay', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'AGXP求职筛选v1',
        JSON.stringify({
          城市们: ['上海'],
          职位: ['产品经理'],
          筛选偏好: {
            求职类型: ['校园招聘', '实习生'],
            办公方式: ['混合'],
            实习月数: 3,
            每周到岗天数: 4,
            作品集链接: 'https://example.com/portfolio',
          },
          薪资: { 下限: 300, 上限: 500, 单位: '元/天' },
        }),
      );
    });

    await page.goto('/#/student');

    await expect(page.getByRole('button', { name: '实习生' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '校园招聘' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByLabel('预计毕业时间')).toHaveCount(0);

    await expect.poll(async () => {
      const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('AGXP求职筛选v2:mock:stg:demo') ?? '{}'));
      return cache.筛选偏好?.求职类型;
    }).toEqual(['实习生']);
  });

  test('collects the campus graduation month separately from internship availability', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'AGXP求职筛选v1',
        JSON.stringify({
          城市们: ['上海'],
          职位: ['产品经理'],
          筛选偏好: { 求职类型: ['校园招聘'], 办公方式: ['现场'] },
        }),
      );
    });

    await page.goto('/#/student');

    // picker 统一 Task 3：毕业时间平时是字段行（值 ›），点开才弹共用 年月滚轮层。
    // 「选了校园招聘自动落默认毕业月」的 mount effect 已删（Task 5B）：父行以实际
    // 筛选偏好.毕业时间 判断 —— 空值显示「请选择」，临时落点「次年 6 月」只在抽屉里
    await expect(page.getByText('预计毕业时间')).toBeVisible();
    await expect(page.getByRole('button', { name: '预计毕业时间' })).toContainText('请选择');
    const 未确认存值 = await page.evaluate(
      () => JSON.parse(localStorage.getItem('AGXP求职筛选v2:mock:stg:demo') ?? '{}')?.筛选偏好?.毕业时间 ?? '',
    );
    expect(未确认存值).toBe('');
    // 打开抽屉再取消：仍未填写、缓存仍为空
    await page.getByRole('button', { name: '预计毕业时间' }).click();
    const 抽屉 = page.getByRole('dialog', { name: '预计毕业时间' });
    await expect(抽屉).toBeVisible();
    await 抽屉.getByRole('button', { name: '取消' }).click();
    await expect(抽屉).toHaveCount(0);
    await expect(page.getByRole('button', { name: '预计毕业时间' })).toContainText('请选择');
    // 打开点「确定」才写值；缺值临时落「次年 6 月」（毕业季）
    await page.getByRole('button', { name: '预计毕业时间' }).click();
    await page.getByRole('dialog', { name: '预计毕业时间' }).getByRole('button', { name: '确定' }).click();
    const 存值 = await page.evaluate(
      () => JSON.parse(localStorage.getItem('AGXP求职筛选v2:mock:stg:demo') ?? '{}')?.筛选偏好?.毕业时间 ?? '',
    );
    expect(存值).toMatch(/^\d{4}-06$/);
    await expect(page.getByRole('button', { name: '预计毕业时间' })).toContainText(`${new Date().getFullYear() + 1} 年 06 月`);
    await expect(page.getByRole('button', { name: '下一步' })).toBeEnabled();
  });

  test('publishes an internship with explicit recruiter screening fields', async ({ page }) => {
    await page.goto('/#/hr/post-job');

    // 职位类别改成一行版式（标签靠左、值靠右 + ›）后，未选时的占位从「请选择职位类别」
    // 收成本页 年薪月数 已在用的「请选择」。这里改按整行定位再断言行内文本，
    // 比直接匹配占位字串更稳：以后占位再改措辞，这条用例不会跟着碎。
    const 职位类别行 = page.getByRole('button').filter({ hasText: '职位类别' });
    await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue('');
    await expect(职位类别行).toContainText('请选择');
    await expect(page.getByRole('button', { name: '实习生 在校生实习，按天计薪' })).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: '实习生 在校生实习，按天计薪' }).click();
    await page.getByRole('button', { name: '提供转正机会' }).click();
    await expect(page.getByRole('button', { name: '提供转正机会' })).toHaveAttribute('aria-pressed', 'true');
    // 「最晚可接受实习开始日期」2026-08-22 已删（产品负责人：「这个删了吧，没啥用」），
    // 它原来还是第一步的必填闸门 —— 这条断言守住「既不再出现，也不再拦人」
    await expect(page.getByLabel('最晚可接受实习开始日期')).toHaveCount(0);
    await page.getByPlaceholder(/资深后端工程师/).fill('AI 产品实习生');
    await 职位类别行.click();
    await page.getByRole('button', { name: '产品', exact: true }).click();
    await page.getByRole('button', { name: '产品经理', exact: true }).click();
    await page.getByRole('button', { name: '混合', exact: true }).click();
    await page.getByRole('button', { name: '下一步' }).click();

    // 技能词池块 2026-08-26 按标注删除(加分项块 2026-08-24 已删),本步只剩职位描述
    await page.getByLabel('职位描述').fill('参与 AI 招聘产品的需求分析、原型设计与用户研究。');
    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page.getByText('日薪（元/天）')).toBeVisible();
    await expect(page.getByText('元/天').first()).toBeVisible();
    // 三条断言 2026-08-22 由「可见」翻成「不存在」：预计面试轮次（「应该删掉吧」）、
    // 招聘紧急程度（「感觉没什么用」）、实习最晚开始日期（「这个删了吧，没啥用」）全部删除
    await expect(page.getByText('预计面试轮次')).toHaveCount(0);
    await expect(page.getByText('招聘紧急程度')).toHaveCount(0);
    await expect(page.getByText(/开始日期：最晚/)).toHaveCount(0);
    // AI 初筛卡 2026-08-26 已删,薪资承诺句降格为薪资区小字
    await expect(page.getByText('薪资仅判断双方区间是否匹配，不询问或协商具体金额。')).toBeVisible();

    // bottom-drawer 统一 Task 5：日薪两个金额按钮开同一双轮抽屉 —— 一次打开、
    // 点一次「确定」同步上下限两字段（缺值临时落 200/200）
    await page.getByRole('button', { name: '— 元/天' }).first().click();
    await page.getByRole('button', { name: '确定' }).click();
    // picker 统一 Task 2：岗位城市 input 已删 —— 经工作城市行打开全页选择子视图选上海
    // Task 6：精选区按钮是目录规范名「上海市」（22 城市规范名，不再用旧别名「上海」）
    await page.getByRole('button').filter({ hasText: '工作城市' }).click();
    await expect(page.getByRole('heading', { name: '选择工作城市' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '上海市', exact: true }).first().click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('heading', { name: '选择工作城市' })).toHaveCount(0);
    await page.getByPlaceholder(/浦东新区世纪大道/).fill('浦东新区张江路 1 号');
    // 职位要求与职位描述是两条互相独立的必填文本，各填各的
    //（2026-09-11 起第三步的公开要求输入 label 从「职位要求」改回「岗位要求」，
    // 与代理私有筛选要求区分 —— 只修选择器，不改布局预期）
    await page.getByLabel('岗位要求').fill('在校本科及以上，熟悉用户研究方法，能独立推进需求。');
    // Spec §5.4：确认门两模式共用，Mock 新建未确认不再放行发布
    await page.getByRole('checkbox', { name: /我已确认经验和学历设置将作为自动匹配依据/ }).check();
    await page.getByRole('button', { name: '发布岗位并开始寻访' }).click();

    await expect(page).toHaveURL(/#\/hr$/);
    await expect(page.getByText('AI 产品实习生')).toBeVisible();
  });

  // 老用户的作品集链接还留在旧的求职筛选缓存里（那时字段长在完善资料屏）。
  // 搬进简历切片之后必须做兼容读取，已经填过的人不能因为这次搬家丢数据。
  test('reuses the persisted portfolio link on the personal-strength page', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'AGXP求职筛选v1',
        JSON.stringify({
          城市们: ['上海'],
          职位: ['产品经理'],
          筛选偏好: {
            求职类型: ['社招全职'],
            办公方式: ['混合'],
            作品集链接: 'https://github.com/example/shared-project',
          },
          薪资: { 下限: 30, 上限: 40, 单位: '月薪K' },
        }),
      );
    });

    // 2026-08-24：GitHub/作品集行挪去在线简历屏，持久值在那里的 作品集 输入框验证
    await page.goto('/#/experience');
    await expect(page.getByLabel('作品集或项目链接')).toHaveValue(
      'https://github.com/example/shared-project',
    );
  });

  // P1C Task 6 数据源边界守卫：Mock 招聘剧情从身份选择进名片、再走公司档案分区，
  // 全程零 /api/v1 请求 —— Mock 图片本地预览、无 opaque Organization ID、
  // 不因为接了 Backend 代码就把请求漏进 Mock 模式。
  // Spec §4.1（2026-09-17）：注册流名片不再渲染「公司主页资料」维护行，日常入口保留。
  test('Mock 招聘剧情不请求 BFF：注册流无名片维护行、日常入口仍可进公司档案 @mock', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1')) apiRequests.push(request.url());
    });
    await page.goto('/');
    await 进入Mock招聘名片(page);
    await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible();
    // 注册流：整行不渲染（不是点进去被拒），名片自身仍可完成
    await expect(page.getByRole('button', { name: /公司主页资料/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '保存 · 去发岗位' })).toBeVisible();

    // 日常入口（企业我的头像行 / 企业设置的招聘名片行都是无 state 的普通跳转）仍保留该行：
    // 进企业主壳 → 我 → 头像行 → 名片 → 公司主页资料 → 分区清单 → 公司介绍分区
    await page.goto('/#/hr');
    await expect(page.getByRole('button', { name: '我', exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '我', exact: true }).click();
    await page.getByRole('button', { name: /招聘名片/ }).first().click();
    await expect(page).toHaveURL(/#\/hr\/card$/);
    await page.getByRole('button', { name: /公司主页资料/ }).click();
    await expect(page).toHaveURL(/#\/hr\/company-profile$/);
    await page.getByRole('button', { name: /公司介绍/ }).click();
    await expect(page).toHaveURL(/#\/hr\/company-profile\/intro$/);
    await expect(page.getByLabel('公司介绍')).toBeVisible();

    expect(apiRequests).toEqual([]);
  });

  // 合同 C / Spec §3.2：旧 `/wizard?stage=salary` 最小兼容 —— 屏幕认出它后替换导航回首屏，
  // 不插新历史项、不自动跳过基础资料；首屏薪资三态（未确认 / 明确面议 / 区间）与确认闸门。
  test('Onboarding简历修正 旧薪资地址替换回首屏：首屏薪资三态与确认闸门 @mock', async ({ page }) => {
    await page.goto('/#/wizard?stage=salary');
    await expect(page).toHaveURL(/#\/student$/, { timeout: 15_000 });
    // 独立薪资页已不存在（旧的期望现金月薪题不再出现）
    await expect(page.getByRole('heading', { name: '期望现金月薪是？' })).toHaveCount(0);

    // 未确认：占位「请选择」；先把身份/职位补齐，让下一步走到薪资闸门（闸门在
    // 身份 → 偏好 → 城市/职位 之后按序检查）
    const 行 = 首屏薪资行(page);
    await expect(行).toContainText('请选择');
    await 选择期望职位(page, '产品', '产品经理');
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/student$/);
    await expect(page.getByText('请确认期望薪资，也可以选择面议')).toBeVisible();

    // 明确面议：抽屉确定写 0/0，行显示面议
    await 行.click();
    await page.getByRole('dialog', { name: '薪资要求(月薪，单位:千元)' }).getByRole('button', { name: '确定' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(行).toContainText('面议');

    // 区间：重开抽屉点 30 档（联动上限 40）→ 行显示 30-40K
    await 选首屏薪资(page, '30');

    // 替换导航（不是 push）：后退一步不回到旧薪资深链
    await page.goBack();
    await expect(page).not.toHaveURL(/#\/wizard\?stage=salary$/);
  });
});
