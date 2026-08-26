// 稳定页面工具：清空存储 → 写状态种子 → 导航 → 等字体与两帧 rAF → 关闭动画。
// 诊断收集 console error / pageerror / requestfailed / /api/v1 请求。
import type { Page } from '@playwright/test';
import type { 场景状态种子 } from './类型';

/** legacy seed：当前应用的迁移逻辑会读这两个旧键并迁移到账号隔离的新键。 */
const 求职端种子: Record<string, string> = {
  AGXP简历v2: JSON.stringify({
    基本信息: { 真名: '沈亦舟', 开始工作年: '2017', 身份: '在职' },
    经历: [],
    教育: [],
    技能: ['TypeScript', 'React'],
    个人优势: '九年前端与平台经验，主导过招聘系统重建。',
  }),
  AGXP求职筛选v1: JSON.stringify({
    职位: ['产品经理'],
    城市们: ['上海'],
    薪资: { 下限: 30, 上限: 45, 单位: '月薪K' },
    筛选偏好: { 求职类型: ['社招全职'], 办公方式: ['混合'] },
  }),
};

/** 每个状态种子对应的 localStorage 写入内容。null = 只清空。 */
function 种子写入表(种子: 场景状态种子): Record<string, string> | null {
  if (种子 === '未登录') return null;
  if (种子 === '求职端已注册') return 求职端种子;
  // 招聘端已注册：只清空，用应用内现成的 Mock 招聘数据，不复制业务数据进测试代码。
  return null;
}

export interface 诊断句柄 {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  apiRequests: string[];
  detach(): void;
}

/** 收集 console error、pageerror、requestfailed、pathname 以 /api/v1 开头的请求。不收集 warning。 */
export function 安装诊断(page: Page): 诊断句柄 {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const apiRequests: string[] = [];

  const onConsole = (msg: { type(): string; text(): string }) => {
    if (msg.type() !== 'error') return;
    const 文 = msg.text();
    // 环境性静态资源 404（favicon/.ico 等）非「严重 console error」（spec §10.1）。
    // API 失败由 apiRequests（pathname 以 /api/v1 开头）单独捕获，不会被这里遮蔽；
    // 主 bundle 缺失会导致 pageerror 或 body 文字 <12 / 关键元素不可见，亦不靠此条。
    if (/Failed to load resource: the server responded with a status of 404/.test(文)) return;
    consoleErrors.push(文);
  };
  const onPageError = (err: Error) => {
    pageErrors.push(err.message);
  };
  const onRequestFailed = (req: { url(): string }) => {
    failedRequests.push(req.url());
  };
  const onRequest = (req: { url(): string; method(): string }) => {
    try {
      const u = new URL(req.url());
      if (u.pathname.startsWith('/api/v1')) apiRequests.push(`${req.method()} ${u.pathname}`);
    } catch {
      // 跨域或非标准 URL：忽略
    }
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);
  page.on('request', onRequest);

  return {
    consoleErrors,
    pageErrors,
    failedRequests,
    apiRequests,
    detach() {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('requestfailed', onRequestFailed);
      page.off('request', onRequest);
    },
  };
}

const 关闭动画样式 = `*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  caret-color: transparent !important;
}`;

/** 在第一次 goto 前用 addInitScript 清空 local/session storage，再按种子写入。导航后等字体与两帧 rAF，注入关闭动画样式。 */
export async function 打开稳定页面(
  page: Page,
  path: string,
  种子: 场景状态种子,
): Promise<void> {
  const 写入 = 种子写入表(种子);
  await page.addInitScript(([写入表]) => {
    localStorage.clear();
    sessionStorage.clear();
    if (写入表) {
      for (const [键, 值] of Object.entries(写入表)) localStorage.setItem(键, 值);
    }
  }, [写入]);

  await page.goto(path);

  // 等字体就绪 + 连续两个 requestAnimationFrame（布局/动画落定）。
  await page.evaluate(() => (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready);
  await page.evaluate(
    () =>
      new Promise<number>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(1))),
      ),
  );

  // 关闭动画/过渡/光标，避免截图瞬时帧差异。
  await page.addStyleTag({ content: 关闭动画样式 });
}

/**
 * candidate-only 自测突变钩子。只在 UI_CAPTURE_ROLE=candidate 时应用。
 * 由 UI_CANDIDATE_MUTATION 选择具体突变：shift / overflow / pageerror。
 * 用来验证比较管线能检测到差异——采集本身不应长期开着它。
 */
export async function 注入候选突变(page: Page): Promise<void> {
  if (process.env.UI_CAPTURE_ROLE !== 'candidate') return;
  const 突变 = process.env.UI_CANDIDATE_MUTATION;
  if (!突变) return;

  if (突变 === 'shift') {
    await page.addStyleTag({
      content: [
        '#根节点 { transform: translateX(20px) !important; }',
        // translateX(20px) 会把根节点右沿推出视口 20px，采集期的横向溢出门禁会先拦下，
        // 比较器的位移路径就测不到。给 html 加 overflow-x:hidden 把横向溢出归零，
        // 让位移突变真正走到比较几何的位移检查（位移 20px > 16 → structure blocked）。
        'html { overflow-x: hidden !important; }',
      ].join('\n'),
    });
  } else if (突变 === 'overflow') {
    await page.evaluate(() => {
      const 节点 = document.createElement('div');
      节点.style.width = '500px';
      节点.style.height = '1px';
      节点.style.visibility = 'hidden';
      document.body.appendChild(节点);
    });
  } else if (突变 === 'pageerror') {
    await page.evaluate(() =>
      setTimeout(() => {
        throw new Error('UI regression self-test');
      }),
    );
  }
}