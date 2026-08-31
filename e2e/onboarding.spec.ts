import { expect, test, type Page } from '@playwright/test';

async function 从登录进入身份(page: Page, 身份: '我要找工作' | '我要招人') {
  await page.goto('/');
  await page.getByText(/已阅读并同意/).click();
  await page.getByRole('button', { name: '微信登录' }).click();
  await expect(page).toHaveURL(/#\/identity$/);
  await page.getByRole('button', { name: 身份 }).click();
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

test.describe('multi-role onboarding', () => {
  test('walks the social-hire journey from role entry through both wizard stages', async ({ page }) => {
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
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/wizard\?stage=salary$/);
    await expect(page.getByRole('heading', { name: '期望现金月薪是？' })).toBeVisible();

    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/basic$/);
    await expect(page.getByRole('heading', { name: '创建在线简历' })).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/onboard\/status$/);
    await page.getByRole('button', { name: '下一步' }).click();
    await 走完学历资料(page);

    // 作品集链接的新家：在线简历屏，与专业技能 / 证书与语言并列的独立区块
    await expect(page.getByRole('heading', { name: '在线简历' })).toBeVisible();
    await page.getByLabel('作品集或项目链接').fill('github.com/example/kept-project');
    await page.getByLabel('作品集或项目链接').blur();
    await expect(page.getByLabel('作品集或项目链接')).toHaveValue(
      'https://github.com/example/kept-project',
    );
    await page.getByRole('button', { name: '保存' }).click();

    await expect(page).toHaveURL(/#\/wizard$/);
    await expect(page.getByRole('heading', { name: '哪些情况直接排除？' })).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByRole('heading', { name: '分享一下自己的个人优势' })).toBeVisible();
    // GitHub/作品集行 2026-08-24 挪去在线简历屏（作品集小节），优势页不再出现
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page).toHaveURL(/#\/disclosure$/);
  });

  test('walks the student journey from role entry to internship daily pay', async ({ page }) => {
    await 从登录进入身份(page, '我要找工作');
    await expect(page).toHaveURL(/#\/student$/);
    await page.getByRole('button', { name: '在校' }).click();
    await expect(page.getByRole('button', { name: '实习生' })).toHaveAttribute('aria-pressed', 'true');

    // 「最早可开始实习日期」2026-08-22 已删（招聘端「最晚可接受实习开始日期」被产品负责人
    // 标注删掉后它就没有比对对象了），这里不再填它，顺带守住「删完不该再冒出来」
    await expect(page.getByLabel('最早可开始实习日期')).toHaveCount(0);
    await 选择期望职位(page, '产品', '产品经理');
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/basic$/);
    await expect(page.getByRole('heading', { name: '创建在线简历' })).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();
    await 走完学历资料(page);
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page).toHaveURL(/#\/onboard\/status$/);
    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page).toHaveURL(/#\/wizard$/);
    await expect(page.getByRole('heading', { name: '期望实习日薪是？' })).toBeVisible();
    await expect(page.getByRole('listbox', { name: '最低日薪' })).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByRole('heading', { name: '哪些情况直接排除？' })).toBeVisible();
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

    // 2026-08-24 二改：毕业时间平时是字段行（值 ›），点开才弹滚轮层；
    // 默认「明年 6 月」仍自动落盘
    await expect(page.getByText('预计毕业时间')).toBeVisible();
    await expect(page.getByRole('button', { name: /\d{4} 年 \d{2} 月/ })).toBeVisible();
    const 存值 = await page.evaluate(
      () => JSON.parse(localStorage.getItem('AGXP求职筛选v2:mock:stg:demo') ?? '{}')?.筛选偏好?.毕业时间 ?? '',
    );
    expect(存值).toMatch(/^\d{4}-06$/);
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
    await expect(page.getByText('AI 只按以下条件进行初筛。薪资仅判断双方区间是否匹配，不询问或协商具体金额。')).toBeVisible();

    await page.getByRole('button', { name: '— 元/天' }).first().click();
    await page.getByRole('button', { name: '完成' }).click();
    await page.getByRole('button', { name: '— 元/天' }).click();
    await page.getByRole('button', { name: '完成' }).click();
    await page.getByPlaceholder('如：上海').fill('上海');
    await page.getByPlaceholder(/浦东新区世纪大道/).fill('浦东新区张江路 1 号');
    // 职位要求输入区 2026-08-24 已删（与职位描述重复）
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
});
