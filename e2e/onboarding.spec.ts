import { expect, test, type Page } from '@playwright/test';

async function 从登录进入身份(page: Page, 身份: '我要找工作' | '我要招人') {
  await page.goto('/');
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
    // 两个入口共写同一份简历字段，所以在线简历屏填的这条在这里立刻可见
    await expect(page.getByRole('button', { name: /https:\/\/github.com\/example\/kept-project/ })).toBeVisible();
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page).toHaveURL(/#\/disclosure$/);
  });

  test('walks the student journey from role entry to internship daily pay', async ({ page }) => {
    await 从登录进入身份(page, '我要找工作');
    await expect(page).toHaveURL(/#\/student$/);
    await page.getByRole('button', { name: '在校' }).click();
    await expect(page.getByRole('button', { name: '实习生' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByLabel('最早可开始实习日期').fill('2099-09-01');
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
    await expect(page).toHaveURL(/#\/hr\/verify$/);
    await expect(page.getByRole('heading', { name: '实名认证' })).toBeVisible();

    await page.getByRole('button', { name: '开始人脸识别' }).click();
    await expect(page).toHaveURL(/#\/hr\/card$/, { timeout: 3_000 });
    await expect(page.getByRole('heading', { name: '招聘名片' })).toBeVisible();
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
            实习开始日期: '2099-09-01',
            作品集链接: 'https://example.com/portfolio',
          },
          薪资: { 下限: 300, 上限: 500, 单位: '元/天' },
        }),
      );
    });

    await page.goto('/#/student');

    await expect(page.getByRole('button', { name: '实习生' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '校园招聘' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByLabel('最早可开始实习日期')).toHaveValue('2099-09-01');
    await expect(page.getByLabel('预计毕业时间')).toHaveCount(0);

    await expect.poll(async () => {
      const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('AGXP求职筛选v1') ?? '{}'));
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

    await expect(page.getByLabel('预计毕业时间')).toBeVisible();
    await page.getByLabel('预计毕业时间').fill('2099-06');
    await expect(page.getByLabel('最早可开始实习日期')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '下一步' })).toBeEnabled();
  });

  test('publishes an internship with explicit recruiter screening and process fields', async ({ page }) => {
    await page.goto('/#/hr/post-job');

    await expect(page.getByPlaceholder(/资深后端工程师/)).toHaveValue('');
    await expect(page.getByText('请选择职位类别')).toBeVisible();
    await expect(page.getByRole('button', { name: '实习生 在校生实习，按天计薪' })).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: '实习生 在校生实习，按天计薪' }).click();
    await page.getByRole('button', { name: '提供转正机会' }).click();
    await page.getByLabel('最晚可接受实习开始日期').fill('2099-09-15');
    await expect(page.getByRole('button', { name: '提供转正机会' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByPlaceholder(/资深后端工程师/).fill('AI 产品实习生');
    await page.getByText('请选择职位类别').click();
    await page.getByRole('button', { name: '产品', exact: true }).click();
    await page.getByRole('button', { name: '产品经理', exact: true }).click();
    await page.getByRole('button', { name: '混合', exact: true }).click();
    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page.getByText('必须具备的技能（用于自动初筛）')).toBeVisible();
    await expect(page.getByText('加分项（只影响排序）')).toBeVisible();
    await page.getByLabel('职位描述').fill('参与 AI 招聘产品的需求分析、原型设计与用户研究。');
    await page.getByRole('button', { name: 'Python', exact: true }).click();
    await page.getByRole('button', { name: '有相关课程项目', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Python', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '有相关课程项目', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page.getByText('日薪（元/天）')).toBeVisible();
    await expect(page.getByText('元/天').first()).toBeVisible();
    await expect(page.getByText('预计面试轮次')).toBeVisible();
    await expect(page.getByText('招聘紧急程度')).toBeVisible();
    await expect(page.getByText('开始日期：最晚 2099-09-15')).toBeVisible();
    await expect(page.getByText('AI 只按以下条件进行初筛。薪资仅判断双方区间是否匹配，不询问或协商具体金额。')).toBeVisible();

    await page.getByRole('button', { name: '— 元/天' }).first().click();
    await page.getByRole('button', { name: '完成' }).click();
    await page.getByRole('button', { name: '— 元/天' }).click();
    await page.getByRole('button', { name: '完成' }).click();
    await page.getByPlaceholder('如：上海').fill('上海');
    await page.getByPlaceholder(/浦东新区世纪大道/).fill('浦东新区张江路 1 号');
    await page.getByRole('button', { name: /预计面试轮次/ }).click();
    await page.getByRole('button', { name: '完成' }).click();
    await page.getByRole('button', { name: '尽快到岗' }).click();
    await page.getByLabel('职位要求').fill('在校生，能持续实习三个月，具备基础产品分析能力。');
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

    await page.goto('/#/wizard');
    await expect(page.getByRole('heading', { name: '哪些情况直接排除？' })).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();

    await expect(page.getByText('作品集 / GitHub / 项目链接')).toBeVisible();
    await expect(page.getByRole('button', { name: /https:\/\/github.com\/example\/shared-project/ })).toBeVisible();
  });
});
