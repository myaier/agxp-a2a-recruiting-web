// 注册流走完切主壳时，中间不能闪出注册流的任何一屏。
//
// 产品负责人 2026-08-22 原话：「我在 onboarding 上传头像之后，应该会进到主页。
// 但是突然会有一个配置页面闪出来，然后才是主页，把这个 bug 修一下」。
//
// 这条用例逐帧采样，不是只断言「最后落在主页」—— 闪屏是时序问题，
// 只看最终状态验不出来（修复前的版本同样能落在主页，中间照样闪 150ms）。
// 采样用 requestAnimationFrame（回调跑在本帧绘制之前，此刻 DOM 里是什么这一帧就画什么）
// 加 MutationObserver（补上两次 rAF 之间一闪而过的中间态）。

import { expect, test, type Page } from '@playwright/test';

interface 帧快照 {
  hash: string;
  有遮罩: boolean;
  正文头: string;
}

declare global {
  interface Window {
    __开始采样?: () => void;
    __停止采样?: () => Promise<帧快照[]> | 帧快照[];
  }
}

/** 注册流各屏的可辨识文字。任何一条出现在没被遮罩盖住的帧里 = 用户看到了不该看到的屏 */
const 注册流文字 = [
  '条件对上了', // 登录
  '输入手机号', // 登录
  '我要找工作', // 选身份
  '完善资料',
  '求职类型',
  'AI代理如何帮你找工作', // 披露说明
  '添加头像',
  '招聘名片',
  '岗位基础信息',
];

async function 装采样器(页: Page) {
  await 页.addInitScript(() => {
    const 记录: 帧快照[] = [];
    let 上一条 = '';
    let 采样中 = false;
    const 记一条 = () => {
      const 根 = document.getElementById('根节点');
      const 条: 帧快照 = {
        hash: location.hash,
        有遮罩: Boolean(document.querySelector('[data-换壳遮罩]')),
        正文头: (根?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 400),
      };
      const 指纹 = `${条.hash}|${条.有遮罩}|${条.正文头}`;
      if (指纹 === 上一条) return;
      上一条 = 指纹;
      记录.push(条);
    };
    let 观察: MutationObserver | null = null;
    window.__开始采样 = () => {
      记录.length = 0;
      上一条 = '';
      采样中 = true;
      const 一帧 = () => {
        if (!采样中) return;
        记一条();
        requestAnimationFrame(一帧);
      };
      requestAnimationFrame(一帧);
      观察 = new MutationObserver(() => 记一条());
      观察.observe(document.getElementById('根节点')!, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    };
    window.__停止采样 = () => {
      采样中 = false;
      观察?.disconnect();
      return 记录;
    };
  });
}

/** 采一次「点按钮 → 落到目标屏」的完整画面序列 */
async function 采换壳画面(页: Page, 触发按钮: string, 落点: RegExp): Promise<帧快照[]> {
  // 源屏是 lazy 分包，等它真画出来再开录，否则录到的第一帧是上一屏
  await 页.getByRole('button', { name: 触发按钮 }).waitFor({ state: 'visible' });
  await 页.waitForTimeout(300);
  await 页.evaluate(() => window.__开始采样!());
  await 页.getByRole('button', { name: 触发按钮 }).click();
  await 页.waitForURL(落点);
  await 页.waitForTimeout(800);
  return 页.evaluate(() => window.__停止采样!());
}

/** 没被遮罩盖住、又画着注册流内容的帧 —— 一条都不能有 */
function 裸露的注册流帧(序列: 帧快照[], 源屏文字: string) {
  return 序列.filter(
    (帧) =>
      !帧.有遮罩 &&
      !帧.正文头.includes(源屏文字) &&
      注册流文字.some((文) => 帧.正文头.includes(文)),
  );
}

// 走本机装好的 Chrome，不依赖 playwright 自带的 chromium 分发包（本机没装那份）。
// channel 会强制新建 worker，playwright 只允许写在文件顶层，不能塞进 describe 里。
test.use({ channel: 'chrome' });

// 串行跑，不与别的 spec 抢 worker。这两条是**逐帧采样**：要在 history.go 到
// replace 落地这几十毫秒里连续抓帧，判断有没有裸露的注册流帧。
// fullyParallel 下多 worker 抢同一个 dev server，采样窗口被拖慢就会漏帧 ——
// 实测全量跑三次挂一次，单独跑必过。一条随机变红的护栏比没有护栏更糟：
// 下次它红了，没人知道该不该信。
test.describe.configure({ mode: 'serial' });

test.describe('注册流换壳不闪中间屏', () => {
  test.beforeEach(async ({ page }) => 装采样器(page));

  test('求职端：头像页 → 主壳，中间不闪注册流任何一屏，且后退退不回去', async ({ page }) => {
    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await page.getByRole('button', { name: '我要找工作' }).click();
    await expect(page).toHaveURL(/#\/student$/);
    await page.getByRole('button', { name: /选择期望职位/ }).click();
    await page.getByRole('button', { name: '产品', exact: true }).click();
    await page.getByRole('button', { name: '产品经理', exact: true }).click();
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page).toHaveURL(/#\/student$/);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByRole('heading', { name: '期望现金月薪是？' })).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/basic$/);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page).toHaveURL(/#\/onboard\/status$/);
    await page.getByRole('button', { name: '下一步' }).click();
    for (const 段 of ['degree', 'school', 'major', 'eduyears']) {
      await expect(page).toHaveURL(new RegExp(`#\\/onboard\\/${段}$`));
      await page.getByRole('button', { name: '下一步' }).click();
    }
    await expect(page).toHaveURL(/#\/experience$/);
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page).toHaveURL(/#\/wizard$/);
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByRole('button', { name: '保存并继续' }).click();
    await expect(page).toHaveURL(/#\/disclosure$/);
    await page.getByRole('button', { name: '完成设置，开始匹配' }).click();
    await expect(page).toHaveURL(/#\/onboard\/avatar$/);

    const 序列 = await 采换壳画面(page, '完成注册', /#\/app$/);

    // 先断言用户视角的那句话：中间没有任何一帧裸着画注册流的屏
    expect(裸露的注册流帧(序列, '添加头像')).toEqual([]);
    // 再断言遮罩真的出现过 —— 否则「没闪」可能只是这次没走到会闪的时序上，用例就成了摆设
    expect(序列.some((帧) => 帧.有遮罩)).toBe(true);
    // 落点是主壳，不是别的什么屏
    expect(序列.at(-1)?.正文头).toContain('市场'); // 2026-08-24 标签「看市场」→「市场」

    // 51b6f20 那条修复不能丢：主壳按后退键退不回注册流
    await page.goBack();
    await page.waitForTimeout(500);
    const 后退后 = await page.evaluate(() => ({
      href: location.href,
      正文: (document.getElementById('根节点')?.innerText ?? '').replace(/\s+/g, ' '),
    }));
    // 只看 hash 不够：登录屏的地址就是没有 hash 的根路径，得看画面
    for (const 文 of 注册流文字) expect(后退后.正文).not.toContain(文);
  });

  test('招聘端：发岗页 → 企业主壳，同一条时序在企业端同样不闪', async ({ page }) => {
    await page.goto('/');
    await page.getByText(/已阅读并同意/).click();
    await page.getByRole('button', { name: '微信登录' }).click();
    await page.getByRole('button', { name: '我要招人' }).click();
    await expect(page).toHaveURL(/#\/hr\/card$/);
    await page.getByRole('button', { name: '保存 · 去发岗位' }).click();
    await expect(page).toHaveURL(/#\/hr\/post-job$/);

    await page.getByRole('button', { name: '实习生 在校生实习，按天计薪' }).click();
    await page.getByRole('button', { name: '提供转正机会' }).click();
    await page.getByPlaceholder(/资深后端工程师/).fill('AI 产品实习生');
    await page.getByRole('button').filter({ hasText: '职位类别' }).click();
    await page.getByRole('button', { name: '产品', exact: true }).click();
    await page.getByRole('button', { name: '产品经理', exact: true }).click();
    await page.getByRole('button', { name: '混合', exact: true }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByLabel('职位描述').fill('参与 AI 招聘产品的需求分析与原型设计。');
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByRole('button', { name: '— 元/天' }).first().click();
    await page.getByRole('button', { name: '完成' }).click();
    await page.getByRole('button', { name: '— 元/天' }).click();
    await page.getByRole('button', { name: '完成' }).click();
    await page.getByPlaceholder('如：上海').fill('上海');
    await page.getByPlaceholder(/浦东新区世纪大道/).fill('浦东新区张江路 1 号');
    // 职位要求与职位描述是两条互相独立的必填文本，各填各的
    await page.getByLabel('职位要求').fill('在校生，熟悉用户研究方法，能独立推进需求。');

    const 序列 = await 采换壳画面(page, '发布岗位并开始寻访', /#\/hr$/);

    expect(裸露的注册流帧(序列, '补充加分偏好')).toEqual([]); // 特征词:AI 初筛卡 2026-08-26 删除后改用加分偏好节标
    expect(序列.some((帧) => 帧.有遮罩)).toBe(true);
    expect(序列.at(-1)?.正文头).toContain('AI 产品实习生');

    await page.goBack();
    await page.waitForTimeout(500);
    const 后退后 = await page.evaluate(() =>
      (document.getElementById('根节点')?.innerText ?? '').replace(/\s+/g, ' '),
    );
    for (const 文 of 注册流文字) expect(后退后).not.toContain(文);
  });
});
