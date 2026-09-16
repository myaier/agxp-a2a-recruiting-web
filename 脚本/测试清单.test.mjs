// @vitest-environment node
// C5 脚本测试：只验证 脚本/测试清单.mjs 的解析/归一/失败/渲染/写入行为，
// 全部用小内联 JSON 样例，不调真实 runner、不镜像测试业务规则、不建通用 reporter。
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  组装清单,
  渲染自动区,
  解析playwright清单,
  解析vitest清单,
  起始标记,
  结束标记,
  主,
} from './测试清单.mjs';

const 假根目录 = '/仓库根';

// ── 小内联样例 ────────────────────────────────────────────────────────

function vitest样例(项们) {
  return JSON.stringify(项们);
}

function playwright样例(套件) {
  return playwright样例2(套件, `${假根目录}/e2e`);
}

function playwright样例2(套件, rootDir = `${假根目录}/e2e/视觉回归`) {
  return JSON.stringify({
    config: { rootDir },
    errors: [],
    suites: 套件,
    stats: {},
  });
}

function 建临时文档(内容) {
  const 根目录 = mkdtempSync(join(tmpdir(), '测试清单-'));
  mkdirSync(join(根目录, 'docs', 'testing'), { recursive: true });
  const 文档路径 = join(根目录, 'docs', 'testing', 'cases.md');
  writeFileSync(文档路径, 内容);
  return { 根目录, 文档路径 };
}

const 三收集样例 = {
  vitest: { status: 0, stdout: vitest样例([
    { name: '算术 > 求和校验 [1+1]', file: `${假根目录}/src/数据/算术.test.ts` },
    { name: '算术 > 求和校验 [2+3]', file: `${假根目录}/src/数据/算术.test.ts` },
  ]) },
  功能配置: { status: 0, stdout: playwright样例([{
    title: 'onboarding.spec.ts',
    suites: [],
    specs: [{
      title: 'walks the social-hire journey',
      file: 'onboarding.spec.ts',
      line: 46,
      column: 3,
      tests: [{ projectName: 'mock' }],
    }],
  }]) },
  视觉配置: { status: 0, stdout: playwright样例2([{
    title: '采集.spec.ts',
    suites: [],
    specs: [{
      title: '采集 登录',
      file: '采集.spec.ts',
      line: 30,
      column: 1,
      tests: [{ projectName: '' }],
    }],
  }]) },
};

describe('解析：Vitest list JSON', () => {
  it('参数展开的两个 Case 保留展开标题，归一为仓库相对路径', () => {
    const 项们 = 解析vitest清单(vitest样例([
      { name: '算术 > 求和校验 [1+1]', file: `${假根目录}/src/数据/算术.test.ts` },
      { name: '算术 > 求和校验 [2+3]', file: `${假根目录}/src/数据/算术.test.ts` },
    ]), 假根目录);
    expect(项们).toHaveLength(2);
    expect(项们[0].titlePath).toEqual(['算术', '求和校验 [1+1]']);
    expect(项们[1].titlePath).toEqual(['算术', '求和校验 [2+3]']);
    expect(项们[0].file).toBe('src/数据/算术.test.ts');
    expect(项们[0].project).toBe('');
    expect(项们[0].location).toBeNull();
    // review r1/r2（C5 修复 a）：titlePath 按 ' > ' 拆分，按同分隔符 join 可逐字还原
    // runner 扁平名 —— 坐标源不必引入额外字段（冻结六字段形状不变）
    expect(项们[0].titlePath.join(' > ')).toBe('算术 > 求和校验 [1+1]');
  });

  it('空集合与坏 JSON 显式失败', () => {
    expect(() => 解析vitest清单('[]', 假根目录)).toThrow(/空/);
    expect(() => 解析vitest清单('不是 JSON', 假根目录)).toThrow();
    expect(() => 解析vitest清单('{"a":1}', 假根目录)).toThrow();
  });
});

describe('解析：Playwright list JSON', () => {
  it('一逻辑标题的两视口/角色变体展开为两行，身份按 project 区分', () => {
    const 项们 = 解析playwright清单(playwright样例([{
      title: 'P1展示统一.spec.ts',
      suites: [{
        title: 'P1 Mock视觉 390 @mock',
        specs: [{
          title: 'P1 卡片几何',
          file: 'P1展示统一.spec.ts',
          line: 595,
          column: 5,
          tests: [{ projectName: 'mock' }, { projectName: 'fixture' }],
        }],
      }],
    }]), 假根目录);
    expect(项们).toHaveLength(2);
    expect(项们[0].titlePath).toEqual(['P1 Mock视觉 390 @mock', 'P1 卡片几何']);
    expect(项们[1].titlePath).toEqual(项们[0].titlePath);
    expect(项们[0].project).toBe('mock');
    expect(项们[1].project).toBe('fixture');
    expect(项们[0].file).toBe('e2e/P1展示统一.spec.ts');
    expect(项们[0].location).toEqual({ line: 595, column: 5 });
  });

  it('describe 链进入 titlePath，文件套件标题不算一层；收集错误与空集合失败', () => {
    const 项们 = 解析playwright清单(playwright样例([{
      title: '离线边界.spec.ts',
      suites: [{
        title: '离线边界反例（本地受控目标）',
        specs: [{
          title: '业务 HTTP 兜底中止',
          file: '离线边界.spec.ts',
          line: 30,
          column: 3,
          tests: [{ projectName: 'mock' }],
        }],
        suites: [],
      }],
      specs: [],
    }]), 假根目录);
    expect(项们[0].titlePath).toEqual(['离线边界反例（本地受控目标）', '业务 HTTP 兜底中止']);
    expect(项们[0].file).toBe('e2e/离线边界.spec.ts');

    expect(() => 解析playwright清单(
      JSON.stringify({ config: {}, errors: [{ message: 'x' }], suites: [{ specs: [] }] }),
      假根目录,
    )).toThrow();
    expect(() => 解析playwright清单('{"config":{},"suites":[],"errors":[]}', 假根目录)).toThrow(/空/);
  });
});

describe('Suite 归属与身份', () => {
  it('相同 title 不同文件保持独立身份', () => {
    const 项们 = 组装清单([
      { 层: '第一层', 项们: [
        { file: 'src/数据/甲.test.ts', titlePath: ['同'], project: '', location: null },
        { file: 'src/数据/乙.test.ts', titlePath: ['同'], project: '', location: null },
      ] },
    ]);
    expect(项们).toHaveLength(2);
    expect(项们.map((项) => 项.file).sort()).toEqual(['src/数据/乙.test.ts', 'src/数据/甲.test.ts'].sort());
  });

  it('重复身份（layer+file+titlePath+project）显式失败', () => {
    expect(() => 组装清单([
      { 层: '第一层', 项们: [
        { file: 'src/数据/甲.test.ts', titlePath: ['同'], project: '', location: null },
        { file: 'src/数据/甲.test.ts', titlePath: ['同'], project: '', location: null },
      ] },
    ])).toThrow(/重复/);
  });

  it('第一层按固定路径前缀归类，src/应用.test.tsx 精确归页面/接线', () => {
    const 项们 = 组装清单([
      { 层: '第一层', 项们: [
        { file: 'src/数据/后端映射.test.ts', titlePath: ['甲'], project: '', location: null },
        { file: 'src/状态/应用状态.test.ts', titlePath: ['甲'], project: '', location: null },
        { file: 'src/流程/登录.test.ts', titlePath: ['甲'], project: '', location: null },
        { file: 'src/屏幕/发布岗位.test.tsx', titlePath: ['甲'], project: '', location: null },
        { file: 'src/路由/守卫.test.ts', titlePath: ['甲'], project: '', location: null },
        { file: 'src/应用.test.tsx', titlePath: ['甲'], project: '', location: null },
        { file: 'src/组件/通用.test.tsx', titlePath: ['甲'], project: '', location: null },
        { file: 'src/配置/环境.test.ts', titlePath: ['甲'], project: '', location: null },
        { file: '脚本/UI回归核心.test.mjs', titlePath: ['甲'], project: '', location: null },
        { file: 'e2e/视觉回归/场景.test.ts', titlePath: ['甲'], project: '', location: null },
      ] },
    ]);
    const 归属 = Object.fromEntries(项们.map((项) => [项.file, 项.suite]));
    expect(归属['src/数据/后端映射.test.ts']).toBe('数据契约/映射');
    expect(归属['src/状态/应用状态.test.ts']).toBe('状态');
    expect(归属['src/流程/登录.test.ts']).toBe('流程');
    expect(归属['src/屏幕/发布岗位.test.tsx']).toBe('页面/接线');
    expect(归属['src/路由/守卫.test.ts']).toBe('页面/接线');
    expect(归属['src/应用.test.tsx']).toBe('页面/接线');
    expect(归属['src/组件/通用.test.tsx']).toBe('组件');
    expect(归属['src/配置/环境.test.ts']).toBe('配置/工具');
    expect(归属['脚本/UI回归核心.test.mjs']).toBe('配置/工具');
    expect(归属['e2e/视觉回归/场景.test.ts']).toBe('配置/工具');
  });

  it('浏览器文件按 C6 表归属；onboarding 三个招聘叶子归招聘建档与JD，其余归候选建档', () => {
    const 项们 = 组装清单([
      { 层: '第二层', 项们: [
        { file: 'e2e/onboarding.spec.ts', titlePath: ['multi-role onboarding', 'walks the recruiter journey'], project: 'mock', location: null },
        { file: 'e2e/onboarding.spec.ts', titlePath: ['multi-role onboarding', 'publishes an internship'], project: 'mock', location: null },
        { file: 'e2e/onboarding.spec.ts', titlePath: ['multi-role onboarding', 'Mock 招聘剧情不请求 BFF @mock'], project: 'mock', location: null },
        { file: 'e2e/onboarding.spec.ts', titlePath: ['multi-role onboarding', 'walks the social-hire journey'], project: 'mock', location: null },
        { file: 'e2e/onboarding.spec.ts', titlePath: ['multi-role onboarding', 'walks the student journey'], project: 'mock', location: null },
        { file: 'e2e/J-PILOT-02接线.spec.ts', titlePath: ['甲'], project: 'fixture', location: null },
        { file: 'e2e/P1展示统一.spec.ts', titlePath: ['甲'], project: 'mock', location: null },
        { file: 'e2e/展示字段接线.spec.ts', titlePath: ['甲'], project: 'mock', location: null },
        { file: 'e2e/抽屉稳定性.spec.ts', titlePath: ['甲'], project: 'mock', location: null },
        { file: 'e2e/换壳无闪屏.spec.ts', titlePath: ['甲'], project: 'mock', location: null },
        { file: 'e2e/问AI代理展示.spec.ts', titlePath: ['甲'], project: 'mock', location: null },
        { file: 'e2e/离线边界.spec.ts', titlePath: ['甲'], project: 'mock', location: null },
        { file: 'e2e/视觉回归/采集.spec.ts', titlePath: ['采集 登录'], project: '', location: null },
        { file: 'e2e/suites/登录与数据源.spec.ts', titlePath: ['甲'], project: 'mock', location: null },
        { file: 'e2e/suites/招聘建档与JD.spec.ts', titlePath: ['甲'], project: 'fixture', location: null },
      ] },
    ]);
    const 归属 = 项们.map((项) => [项.titlePath.at(-1), 项.suite]);
    expect(Object.fromEntries(归属)['walks the recruiter journey']).toBe('招聘建档与JD');
    expect(Object.fromEntries(归属)['publishes an internship']).toBe('招聘建档与JD');
    expect(Object.fromEntries(归属)['Mock 招聘剧情不请求 BFF @mock']).toBe('招聘建档与JD');
    expect(Object.fromEntries(归属)['walks the social-hire journey']).toBe('候选建档');
    expect(Object.fromEntries(归属)['walks the student journey']).toBe('候选建档');
    expect(Object.fromEntries(归属)['甲'].match(/^(连续委托|展示与交互|登录与数据源边界|视觉采集|登录与数据源|招聘建档与JD)$/)).toBeTruthy();
    const 按文件 = Object.fromEntries(项们.map((项) => [项.file, 项.suite]));
    expect(按文件['e2e/J-PILOT-02接线.spec.ts']).toBe('连续委托');
    expect(按文件['e2e/P1展示统一.spec.ts']).toBe('展示与交互');
    expect(按文件['e2e/展示字段接线.spec.ts']).toBe('展示与交互');
    expect(按文件['e2e/抽屉稳定性.spec.ts']).toBe('展示与交互');
    expect(按文件['e2e/换壳无闪屏.spec.ts']).toBe('展示与交互');
    expect(按文件['e2e/问AI代理展示.spec.ts']).toBe('展示与交互');
    expect(按文件['e2e/离线边界.spec.ts']).toBe('登录与数据源边界');
    expect(按文件['e2e/视觉回归/采集.spec.ts']).toBe('视觉采集');
    expect(按文件['e2e/suites/登录与数据源.spec.ts']).toBe('登录与数据源');
    expect(按文件['e2e/suites/招聘建档与JD.spec.ts']).toBe('招聘建档与JD');
  });

  it('未知文件显式失败并提示最小补映射；越出仓库的路径拒绝', () => {
    expect(() => 组装清单([
      { 层: '第一层', 项们: [{ file: 'src/未知域/新.test.ts', titlePath: ['甲'], project: '', location: null }] },
    ])).toThrow(/补映射/);
    expect(() => 组装清单([
      { 层: '第二层', 项们: [{ file: 'e2e/新文件.spec.ts', titlePath: ['甲'], project: 'mock', location: null }] },
    ])).toThrow(/补映射/);
    expect(() => 组装清单([
      { 层: '第一层', 项们: [{ file: 'src/数据/../../逃逸.test.ts', titlePath: ['甲'], project: '', location: null }] },
    ])).toThrow(/越出|仓库|路径/);
  });
});

describe('渲染与排序', () => {
  it('Markdown 特殊字符（管道/反引号/换行）在单元格内转义', () => {
    const 自动区 = 渲染自动区(组装清单([
      { 层: '第一层', 项们: [
        { file: 'src/数据/特殊.test.ts', titlePath: ['a|b`c', '行\n换'], project: '', location: null },
      ] },
    ]));
    expect(自动区).toContain('a\\|b\\`c > 行 换');
    // 转义后表格行数不变（换行不再断行）
    const 表行 = 自动区.split('\n').filter((行) => 行.startsWith('| ') && !行.startsWith('| ---'));
    expect(表行).toHaveLength(2); // 表头 + 一条数据行
  });

  it('排序稳定：相同输入的不同顺序得到字节相同的输出，排序不依赖输入顺序', () => {
    const 甲们 = [
      { file: 'src/数据/甲.test.ts', titlePath: ['B 块', '第二个'], project: '', location: null },
      { file: 'src/数据/甲.test.ts', titlePath: ['A 块', '第一个'], project: '', location: null },
      { file: 'src/数据/乙.test.ts', titlePath: ['A 块'], project: '', location: null },
    ];
    const 首次 = 渲染自动区(组装清单([{ 层: '第一层', 项们: 甲们 }]));
    const 重排 = 渲染自动区(组装清单([{ 层: '第一层', 项们: [...甲们].reverse() }]));
    expect(重排).toBe(首次);
    const 甲位置 = 首次.indexOf('第一个');
    const 乙位置 = 首次.indexOf('src/数据/乙.test.ts');
    expect(甲位置).toBeGreaterThan(-1);
    expect(乙位置).toBeGreaterThan(-1);
    expect(首次.indexOf('A 块')).toBeLessThan(首次.indexOf('B 块'));
  });

  it('坐标列给出可执行文件+名称选择坐标，计时未知', () => {
    const 自动区 = 渲染自动区(组装清单([
      { 层: '第一层', 项们: [{ file: 'src/数据/甲.test.ts', titlePath: ['甲块', '用例一'], project: '', location: null }] },
      { 层: '第二层', 项们: [{ file: 'e2e/suites/MatchCase.spec.ts', titlePath: ['P5', '用例二'], project: 'fixture', location: { line: 9, column: 3 } }] },
    ]));
    expect(自动区).toContain("npm test -- src/数据/甲.test.ts -t '甲块 (> )?用例一'");
    expect(自动区).toContain("npm run test:e2e -- e2e/suites/MatchCase.spec.ts --project=fixture --grep 'P5 用例二'");
    expect(自动区).toContain('未知');
  });

  it('标题含字面「 > 」时 -t 坐标以 titlePath 还原的扁平名为源保留字面符，不再按段拼接丢「>」（C5 修复 a）', () => {
    // 实仓既有形状（src/数据/列表卡片映射.test.ts）：叶子标题自身含 ' > '。
    // vitest list 的 name = '从P5到阶段 > 徽标优先级保留：需要你 > 需注意 > 代理处理中…'，
    // 其中第一处 ' > ' 是段分隔、后两处是标题字面 —— 按段 join(' ') 会丢字面 '>'。
    const 项们 = 解析vitest清单(vitest样例([
      { name: '从P5到阶段 > 徽标优先级保留：需要你 > 需注意 > 代理处理中；待办恒 false（不新增 Mock 呼吸点）', file: `${假根目录}/src/数据/列表卡片映射.test.ts` },
    ]), 假根目录);
    const 自动区 = 渲染自动区(组装清单([{ 层: '第一层', 项们 }]));
    // 展示列维持 best-effort 拆分（cosmetic）；坐标列以 titlePath.join(' > ')
    // （逐字还原 runner 扁平名）经正则转义后为源，每处 ' > ' 放宽为 ' (> )?'：
    // 段分隔位匹配 runner 匹配全名的单空格、字面位匹配 ' > '（实测该 -t 在源文件上
    // 恰好选中目标叶 1 例）。
    expect(自动区).toContain('从P5到阶段 > 徽标优先级保留：需要你 > 需注意 > 代理处理中；待办恒 false（不新增 Mock 呼吸点）');
    expect(自动区).toContain(
      "npm test -- src/数据/列表卡片映射.test.ts -t '从P5到阶段 (> )?徽标优先级保留：需要你 (> )?需注意 (> )?代理处理中；待办恒 false（不新增 Mock 呼吸点）'",
    );
  });

  it('视觉采集行渲染整条可执行命令：UI_CAPTURE_DIR 前缀显式给出，不再拼「（需 UI_CAPTURE_DIR）」（C5 修复 b）', () => {
    const 自动区 = 渲染自动区(组装清单([{ 层: '第二层', 项们: [
      { file: 'e2e/视觉回归/采集.spec.ts', titlePath: ['采集 candidate-salary'], project: '', location: null },
    ] }]));
    expect(自动区).toContain(
      "UI_CAPTURE_DIR=test-results/visual npm run ui:capture -- --grep '采集 candidate-salary'",
    );
    expect(自动区).not.toContain('需 UI_CAPTURE_DIR');
  });
});

describe('三种操作与失败保护（临时目录）', () => {
  const 初始文档 = `# 测试 Case 清单\n\n手写说明区。\n\n${起始标记}\n旧-占位-待替换\n${结束标记}\n\n## L3 手写索引\n\n- stg-onboarding-candidate（manual / parsed）\n- 保留行\n`;

  it('--list 只向 stdout 输出文档，不写文件', async () => {
    const { 根目录: _根目录, 文档路径 } = 建临时文档(初始文档);
    let 标准输出 = '';
    const 退出码 = await 主([], {
      根目录: 假根目录,
      文档路径,
      收集: (名称) => 三收集样例[名称],
      输出: (文本) => { 标准输出 += 文本; },
    });
    expect(退出码).toBe(0);
    expect(标准输出).toContain('walks the social-hire journey');
    expect(标准输出).toContain('求和校验 [2+3]');
    expect(标准输出).toContain(起始标记);
    expect(标准输出).toContain(结束标记);
    expect(标准输出).not.toContain('L3 手写索引');
    expect(readFileSync(文档路径, 'utf8')).toBe(初始文档);
  });

  it('--write 完整成功后一次更新自动区，手写 L3 区与标记保留；重写字节相同', async () => {
    const { 根目录: _根目录, 文档路径 } = 建临时文档(初始文档);
    const 选项 = { 根目录: 假根目录, 文档路径, 收集: (名称) => 三收集样例[名称], 输出: () => {}, 报告: () => {} };
    expect(await 主(['--write'], 选项)).toBe(0);
    const 首次 = readFileSync(文档路径, 'utf8');
    expect(首次).toContain('walks the social-hire journey');
    expect(首次).toContain('求和校验 [1+1]');
    expect(首次).toContain('## L3 手写索引');
    expect(首次).toContain('- stg-onboarding-candidate（manual / parsed）');
    expect(首次).not.toContain('旧-占位-待替换');
    expect(await 主(['--write'], 选项)).toBe(0);
    expect(readFileSync(文档路径, 'utf8')).toBe(首次);
  });

  it('--check 一致为零、自动区过期非零；改一个标题也非零', async () => {
    const { 根目录: _根目录, 文档路径 } = 建临时文档(初始文档);
    const 选项 = { 根目录: 假根目录, 文档路径, 收集: (名称) => 三收集样例[名称], 输出: () => {}, 报告: () => {} };
    expect(await 主(['--write'], 选项)).toBe(0);
    expect(await 主(['--check'], 选项)).toBe(0);
    const 一致时 = readFileSync(文档路径, 'utf8');
    // 模拟 runner 侧改名：注入样例换一个标题
    const 改样例 = {
      vitest: 三收集样例.vitest,
      功能配置: { status: 0, stdout: 三收集样例.功能配置.stdout.replace('walks the social-hire journey', 'walks the changed journey') },
      视觉配置: 三收集样例.视觉配置,
    };
    expect(await 主(['--check'], { ...选项, 收集: (名称) => 改样例[名称] })).toBe(1);
    // 模拟手改自动区
    writeFileSync(文档路径, 一致时.replace('求和校验 [1+1]', '手改标题'));
    expect(await 主(['--check'], 选项)).toBe(1);
    expect(readFileSync(文档路径, 'utf8')).toContain('手改标题'); // check 不写文件
  });

  it('任一收集失败（CLI 非零/空集合/未知文件）时原清单保持不变且非零退出', async () => {
    const { 根目录: _根目录, 文档路径 } = 建临时文档(初始文档);
    const 失败们 = {
      非零: { vitest: { status: 1, stdout: '', stderr: 'boom' }, 功能配置: 三收集样例.功能配置, 视觉配置: 三收集样例.视觉配置 },
      空集合: { ...三收集样例, vitest: { status: 0, stdout: '[]' } },
      未知文件: { ...三收集样例, 功能配置: { status: 0, stdout: playwright样例([{
        title: '新文件.spec.ts', suites: [], specs: [{
          title: '新用例', file: '新文件.spec.ts', line: 1, column: 1, tests: [{ projectName: 'mock' }],
        }],
      }]) } },
    };
    for (const [名称, 样例] of Object.entries(失败们)) {
      expect(await 主(['--write'], {
        根目录: 假根目录,
        文档路径,
        收集: (名称2) => 样例[名称2],
        输出: () => {},
        报告: () => {},
      })).toBe(1);
      expect(readFileSync(文档路径, 'utf8'), `${名称} 失败后原文件应保持不变`).toBe(初始文档);
    }
  });

  it('缺自动区标记的文档不覆盖；未知命令退出非零', async () => {
    const { 根目录, 文档路径 } = 建临时文档('# 无标记文档\n');
    expect(await 主(['--write'], {
      根目录: 假根目录,
      文档路径,
      收集: (名称) => 三收集样例[名称],
      输出: () => {},
      报告: () => {},
    })).toBe(1);
    expect(readFileSync(文档路径, 'utf8')).toBe('# 无标记文档\n');
    expect(await 主(['--坏参数'], { 根目录: 假根目录, 文档路径, 收集: (名称) => 三收集样例[名称], 输出: () => {}, 报告: () => {} })).toBe(1);
    expect(await 主(['--write', '--check'], { 根目录: 假根目录, 文档路径, 收集: (名称) => 三收集样例[名称], 输出: () => {}, 报告: () => {} })).toBe(1);
  });
});
