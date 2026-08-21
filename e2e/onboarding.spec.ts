import { expect, test } from '@playwright/test';

test.describe('multi-role onboarding', () => {
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
            实习开始日期: '2026-09-01',
            作品集链接: 'https://example.com/portfolio',
          },
          薪资: { 下限: 300, 上限: 500, 单位: '元/天' },
        }),
      );
    });

    await page.goto('/#/student');

    await expect(page.getByRole('button', { name: '实习生' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '校园招聘' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByLabel('最早可开始实习日期')).toHaveValue('2026-09-01');
    await expect(page.getByLabel('作品集或项目链接')).toHaveValue('https://example.com/portfolio');
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
    await page.getByLabel('预计毕业时间').fill('2027-06');
    await page.getByLabel('作品集或项目链接').fill('https://github.com/example/campus-project');
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
});
