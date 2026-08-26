// 采集 spec：每个场景一个 Playwright test，写 PNG + 场景采集结果 JSON。
// 任一步骤失败仍写 status:failed JSON，再重新抛错让 Playwright trace 生效。
import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { 视觉场景们 } from './场景';
import { 安装诊断 } from './稳定页面';
import type { 场景采集结果, 元素几何 } from './类型';

const 输出目录 = process.env.UI_CAPTURE_DIR;
if (!输出目录) {
  throw new Error('UI_CAPTURE_DIR 未设置：采集 spec 需要明确输出目录');
}

const 截图目录 = join(输出目录, 'screenshots');
const 场景目录 = join(输出目录, 'scenes');
mkdirSync(截图目录, { recursive: true });
mkdirSync(场景目录, { recursive: true });

function 写结果(结果: 场景采集结果): void {
  const 路径 = join(场景目录, `${结果.sceneId}.json`);
  mkdirSync(dirname(路径), { recursive: true });
  writeFileSync(路径, JSON.stringify(结果, null, 2));
}

for (const 场景 of 视觉场景们) {
  test(`采集 ${场景.id}`, async ({ page }) => {
    const 诊断 = 安装诊断(page);
    let 结果: 场景采集结果 = {
      schemaVersion: 1,
      sceneId: 场景.id,
      status: 'captured',
      url: '',
      screenshot: null,
      viewport: { width: 0, height: 0 },
      elements: [],
      consoleErrors: [],
      pageErrors: [],
      failedRequests: [],
      apiRequests: [],
      horizontalOverflow: 0,
      failure: null,
    };

    try {
      await 场景.到达(page);
      await 场景.就绪(page);

      // body 可见文字长度 >= 12
      const 正文长度 = await page.evaluate(() => {
        const 文 = document.body?.innerText ?? '';
        return 文.replace(/\s+/g, ' ').trim().length;
      });
      if (正文长度 < 12) {
        throw new Error(`body 可见文字长度 ${正文长度} < 12`);
      }

      // 水平溢出：scrollWidth - clientWidth <= 2
      const 溢出 = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (溢出 > 2) {
        throw new Error(`水平溢出 ${溢出} > 2`);
      }

      // 关键元素可见并记录 boundingBox。
      // 不用 scrollIntoViewIfNeeded：boundingBox 取的是页面坐标系下的几何，与滚动位置无关，
      // 而且对缺失元素 scrollIntoViewIfNeeded 会重试到测试超时，掩盖真实错误。
      const 元素们: 元素几何[] = [];
      for (const 描述 of 场景.关键元素(page)) {
        const 可见 = await 描述.定位.isVisible();
        if (!可见) {
          throw new Error(`关键元素不可见：${描述.名称}`);
        }
        const 框 = await 描述.定位.boundingBox();
        if (!框) {
          throw new Error(`关键元素无 boundingBox：${描述.名称}`);
        }
        元素们.push({
          名称: 描述.名称,
          x: Math.round(框.x * 100) / 100,
          y: Math.round(框.y * 100) / 100,
          width: Math.round(框.width * 100) / 100,
          height: Math.round(框.height * 100) / 100,
        });
      }

      const 视窗 = page.viewportSize() ?? { width: 0, height: 0 };
      const 截图文件 = join(截图目录, `${场景.id}.png`);
      await page.screenshot({ path: 截图文件 });

      结果 = {
        schemaVersion: 1,
        sceneId: 场景.id,
        status: 'captured',
        url: page.url(),
        // 截图实际写入绝对 截图文件；JSON 字段存相对 UI_CAPTURE_DIR 的路径（screenshots/<id>.png），
        // 与比较器契约 join(captureDir, screenshot) 一致，并保证报告里为相对路径。
        screenshot: `screenshots/${场景.id}.png`,
        viewport: 视窗,
        elements: 元素们,
        consoleErrors: [...诊断.consoleErrors],
        pageErrors: [...诊断.pageErrors],
        failedRequests: [...诊断.failedRequests],
        apiRequests: [...诊断.apiRequests],
        horizontalOverflow: 溢出,
        failure: null,
      };
      写结果(结果);
      诊断.detach();
    } catch (原始错误) {
      结果 = {
        ...结果,
        status: 'failed',
        url: page.url(),
        viewport: page.viewportSize() ?? { width: 0, height: 0 },
        consoleErrors: [...诊断.consoleErrors],
        pageErrors: [...诊断.pageErrors],
        failedRequests: [...诊断.failedRequests],
        apiRequests: [...诊断.apiRequests],
        failure: 原始错误 instanceof Error ? 原始错误.message : String(原始错误),
      };
      写结果(结果);
      诊断.detach();
      throw 原始错误;
    }
  });
}