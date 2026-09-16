// 采集 spec：每个场景一个 Playwright test，写 PNG + 场景采集结果 JSON。
// 任一步骤失败仍写 status:failed JSON，再重新抛错让 Playwright trace 生效。
//
// C3 离线边界接入（Task 5）：视觉配置无命名 project（空项目名），本文件固定
// 取 mock 模式安装最末级业务 HTTP/WS 防漏边界并在 Case teardown 核对()；
// 其他项目名一律显式失败，不设可配置模式注册表（C3：边界只在此文件取 mock）。
// UI_CAPTURE_DIR 必填检查与目录创建移到测试执行期（每用例 准备采集目录()），
// --list / 无副作用收集不再因缺目录抛错，也不在导入阶段建目录。
import { test as base } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { 安装离线边界 } from '../fixtures/离线边界';
import { 视觉场景们 } from './场景';
import { 安装诊断 } from './稳定页面';
import type { 场景采集结果, 元素几何 } from './类型';

// 视觉配置的默认（空名）project 视同 mock；显式 mock 项目名同样允许。
// 其余项目名（fixture/annotation/未知）一律失败：本 spec 只在 mock 数据源下采集。
const test = base.extend({
  context: async ({ context }, use, testInfo) => {
    const 项目名 = testInfo.project.name;
    if (项目名 !== '' && 项目名 !== 'mock') {
      throw new Error(`视觉采集只支持空项目名（默认）或 mock 项目，收到「${项目名}」`);
    }
    const 边界 = await 安装离线边界(context, 'mock');
    await use(context);
    边界.核对();
  },
});

const 输出目录 = process.env.UI_CAPTURE_DIR ?? '';

function 准备采集目录(): { 截图目录: string; 场景目录: string } {
  if (!输出目录) {
    throw new Error('UI_CAPTURE_DIR 未设置：采集 spec 需要明确输出目录（执行期检查，--list 不需要）');
  }
  const 截图目录 = join(输出目录, 'screenshots');
  const 场景目录 = join(输出目录, 'scenes');
  mkdirSync(截图目录, { recursive: true });
  mkdirSync(场景目录, { recursive: true });
  return { 截图目录, 场景目录 };
}

function 写结果(场景目录: string, 结果: 场景采集结果): void {
  const 路径 = join(场景目录, `${结果.sceneId}.json`);
  mkdirSync(dirname(路径), { recursive: true });
  writeFileSync(路径, JSON.stringify(结果, null, 2));
}

for (const 场景 of 视觉场景们) {
  test(`采集 ${场景.id}`, async ({ page }) => {
    const { 截图目录, 场景目录 } = 准备采集目录();
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
      写结果(场景目录, 结果);
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
      写结果(场景目录, 结果);
      诊断.detach();
      throw 原始错误;
    }
  });
}
