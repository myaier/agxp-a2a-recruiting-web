// e2e/数据源模式.spec.ts
import { expect, test } from '@playwright/test';

test('缺省数据源保持 PM Mock 登录体验和四格验证码', async ({ page }) => {
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