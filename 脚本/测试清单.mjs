#!/usr/bin/env node
// C5 Case 清单生成脚本：只包装三次原生 runner 的「只收集」调用——
//   1. Vitest list JSON（含 .test.mjs 工具测试；参数化用例按展开名逐条）
//   2. 唯一 Playwright 功能配置 list JSON（playwright.config.ts，三 project）
//   3. Playwright 视觉配置 list JSON（playwright.视觉回归.config.ts）
// 不以正则扫描 test( 代替参数展开后的真实清单，不执行测试、不启动服务、不访问网络、
// 不生成第二份持久化 manifest。CLI 以参数数组经 spawnSync 调用，不拼接待执行 shell 字符串。
//
// 用法（C1）：
//   npm run test:list              # stdout 输出稳定 Markdown 清单，不写文档
//   npm run test:list -- --write   # 全部收集/校验成功后只更新 docs/testing/cases.md 自动区
//   npm run test:list -- --check   # 只比对自动区是否过期，不同/失败非零，不写文件
//
// 内部数据形状（冻结）：{ layer, suite, file, titlePath, project, location }
// 身份键 = layer + file + titlePath + project；行号只是导航，不充当去重键。
// review r1/r2（C5 修复 a）：第一层 titlePath 由 runner 扁平名（vitest list JSON 的
// name）按 ' > ' split 而来，按同一分隔符 join(' > ') 即逐字还原原始名称（含标题内
// 字面 ' > '）—— 可执行 -t 坐标以该还原名为源，不经 join(' ') 重组；展示列继续用
// ' > ' 连接（标题含字面 ' > ' 时拆分是 best-effort，展示是 cosmetic）。

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const 默认根目录 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const 起始标记 = '<!-- BEGIN GENERATED CASES -->';
export const 结束标记 = '<!-- END GENERATED CASES -->';

class 清单错误 extends Error {}

// ── 原生 CLI（只收集）───────────────────────────────────────────────

const 收集命令表 = {
  vitest: ['node_modules/vitest/vitest.mjs', ['list', '--json']],
  功能配置: ['node_modules/@playwright/test/cli.js', ['test', '--list', '--reporter=json']],
  视觉配置: [
    'node_modules/@playwright/test/cli.js',
    ['test', '--list', '--reporter=json', '--config=playwright.视觉回归.config.ts'],
  ],
};

function 执行收集(名称, 根目录) {
  const 声明 = 收集命令表[名称];
  if (!声明) throw new 清单错误(`未知的收集项「${名称}」`);
  const [相对入口, 参数们] = 声明;
  const 入口 = join(根目录, 相对入口);
  if (!existsSync(入口)) {
    throw new 清单错误(`${名称}：原生 CLI 入口不存在（${相对入口}），请先安装依赖`);
  }
  // 参数数组直接调用，不经 shell；list/JSON 只收集，不启动浏览器、dev server 或采集目录。
  const 结果 = spawnSync(process.execPath, [入口, ...参数们], {
    cwd: 根目录,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  });
  if (结果.error) {
    throw new 清单错误(`${名称} 收集进程启动失败：${结果.error.message}`);
  }
  return { status: 结果.status, stdout: 结果.stdout ?? '', stderr: 结果.stderr ?? '' };
}

function 默认收集(名称) {
  return 执行收集(名称, 默认根目录);
}

// ── 归一 ────────────────────────────────────────────────────────────

/** 归一为仓库相对 POSIX 路径；越出仓库（../）拒绝。 */
export function 归一路径(文件, 根目录) {
  if (typeof 文件 !== 'string' || 文件 === '') {
    throw new 清单错误(`收集项缺合法 file 字段：${JSON.stringify(文件)}`);
  }
  const 绝对 = isAbsolute(文件) ? 文件 : resolve(根目录, 文件);
  if (文件.split(/[/\\]/).includes('..')) {
    throw new 清单错误(`路径越出仓库（含 .. 段）：${文件}`);
  }
  const 相对 = relative(根目录, 绝对).split('\\').join('/');
  if (相对 === '' || 相对.startsWith('../') || 相对 === '..' || isAbsolute(相对)) {
    throw new 清单错误(`路径越出仓库：${文件} → ${相对}`);
  }
  return 相对;
}

function 必须是JSON(文本, 名称) {
  let 值;
  try {
    值 = JSON.parse(文本);
  } catch (错误) {
    throw new 清单错误(`${名称} 的 JSON 不合法：${错误.message}`);
  }
  return 值;
}

// ── 解析：Vitest list --json ────────────────────────────────────────
// 实际结构（vitest 4.1.11，源码 formatCollectedAsJSON）：数组，每项
// { name: 'describe > test'（参数已展开、无独立参数字段，保留展开名）,
//   file: 绝对 moduleId, projectName?: string, location?: { line, column } }。
// location 仅在 includeTaskLocation 开启时存在；本仓未开 → 缺行号只链接文件。

export function 解析vitest清单(文本, 根目录 = 默认根目录) {
  const json = 必须是JSON(文本, 'vitest');
  if (!Array.isArray(json)) {
    throw new 清单错误('vitest 收集结果不是数组（JSON 结构与预期不符）');
  }
  if (json.length === 0) {
    throw new 清单错误('vitest 收集为空（CLI 成功但零项，不产出空清单）');
  }
  return json.map((项) => {
    if (typeof 项?.name !== 'string' || typeof 项?.file !== 'string') {
      throw new 清单错误(`vitest 收集项缺 name/file：${JSON.stringify(项).slice(0, 200)}`);
    }
    return {
      file: 归一路径(项.file, 根目录),
      titlePath: 项.name.split(' > '),
      project: typeof 项.projectName === 'string' ? 项.projectName : '',
      location: 项.location ? { line: 项.location.line, column: 项.location.column } : null,
    };
  });
}

// ── 解析：Playwright --list --reporter=json ─────────────────────────
// 实际结构：{ config: { rootDir }, errors: [], suites: [文件套件…], stats }；
// 文件套件（title = 相对 rootDir 的文件路径）下嵌套 describe 套件，叶子是
// spec { title, file: 相对 rootDir 路径, line, column, tests: [ { projectName } ] }，
// 一个 spec 的每个 test 就是一个 project 执行变体。

export function 解析playwright清单(文本, 根目录 = 默认根目录, 名称 = '功能配置') {
  const json = 必须是JSON(文本, 名称);
  if (!json || !Array.isArray(json.suites)) {
    throw new 清单错误(`${名称} 的收集结果缺 suites（JSON 结构与预期不符）`);
  }
  if (Array.isArray(json.errors) && json.errors.length > 0) {
    throw new 清单错误(`${名称} 收集报错：${JSON.stringify(json.errors).slice(0, 500)}`);
  }
  if (json.suites.length === 0) {
    throw new 清单错误(`${名称} 收集为空（CLI 成功但零项，不产出空清单）`);
  }
  const 根目录配置 = json.config?.rootDir;
  if (typeof 根目录配置 !== 'string' || 根目录配置 === '') {
    throw new 清单错误(`${名称} 的收集结果缺 config.rootDir`);
  }
  const 出 = [];
  const 走 = (套件, 前缀) => {
    for (const 规格 of 套件.specs ?? []) {
      if (typeof 规格?.title !== 'string' || typeof 规格?.file !== 'string') {
        throw new 清单错误(`${名称} 收集项缺 title/file：${JSON.stringify(规格).slice(0, 200)}`);
      }
      const 变体们 = 规格.tests ?? [];
      if (变体们.length === 0) {
        throw new 清单错误(`${名称} 收集项「${规格.title}」没有任何 project 变体`);
      }
      for (const 变体 of 变体们) {
        出.push({
          file: 归一路径(join2(根目录配置, 规格.file), 根目录),
          titlePath: [...前缀, 规格.title],
          project: typeof 变体.projectName === 'string' ? 变体.projectName : '',
          location: 规格.line != null ? { line: 规格.line, column: 规格.column } : null,
        });
      }
    }
    for (const 子 of 套件.suites ?? []) {
      走(子, [...前缀, ...(子.title ? [子.title] : [])]);
    }
  };
  for (const 顶层 of json.suites) 走(顶层, []);
  if (出.length === 0) {
    throw new 清单错误(`${名称} 收集为空（CLI 成功但零项，不产出空清单）`);
  }
  return 出;
}

function join2(前缀, 后缀) {
  return posix.normalize(`${前缀.split('\\').join('/')}/${后缀.split('\\').join('/')}`);
}

// ── Suite 归属（C5 第一层前缀表 / C6 文件表与补充映射）───────────────

const 第一层前缀表 = [
  ['src/数据/', '数据契约/映射'],
  ['src/状态/', '状态'],
  ['src/流程/', '流程'],
  ['src/屏幕/', '页面/接线'],
  ['src/路由/', '页面/接线'],
  ['src/组件/', '组件'],
  ['src/配置/', '配置/工具'],
  ['脚本/', '配置/工具'],
  ['e2e/视觉回归/', '配置/工具'],
];
const 第一层精确表 = new Map([['src/应用.test.tsx', '页面/接线']]);

const suites文件名们 = [
  '登录与数据源', '招聘组织', '隐私与实名', 'Agent规则', '发现推荐', '简历与附件',
  '求职意向', '岗位编辑', '候选建档', '招聘建档与JD', 'MatchCase', '连续委托',
  '真人消息', '账号与支持', '展示与交互', '标注', '助手会话',
];
const 第二层文件表 = new Map([
  ...suites文件名们.map((名) => [`e2e/suites/${名}.spec.ts`, 名]),
  // C6 补充映射：保留在 e2e/ 根的七个 spec 与视觉采集
  ['e2e/J-PILOT-02接线.spec.ts', '连续委托'],
  ['e2e/P1展示统一.spec.ts', '展示与交互'],
  ['e2e/展示字段接线.spec.ts', '展示与交互'],
  ['e2e/抽屉稳定性.spec.ts', '展示与交互'],
  ['e2e/换壳无闪屏.spec.ts', '展示与交互'],
  ['e2e/问AI代理展示.spec.ts', '展示与交互'],
  ['e2e/离线边界.spec.ts', '登录与数据源边界'],
  ['e2e/视觉回归/采集.spec.ts', '视觉采集'],
]);
// onboarding.spec.ts 是「候选建档」「招聘建档与JD」两 Suite 的文件级并集；
// 三个招聘叶子按冻结前缀识别，其余五项归候选建档。
const 招聘建档与JD标题前缀 = ['walks the recruiter journey', 'publishes an internship', 'Mock 招聘剧情'];

export function 定suite(层, 文件, 叶子标题) {
  if (层 === '第一层') {
    const 精确 = 第一层精确表.get(文件);
    if (精确) return 精确;
    for (const [前缀, suite] of 第一层前缀表) {
      if (文件.startsWith(前缀)) return suite;
    }
  } else {
    if (文件 === 'e2e/onboarding.spec.ts') {
      return 招聘建档与JD标题前缀.some((前缀) => 叶子标题.startsWith(前缀)) ? '招聘建档与JD' : '候选建档';
    }
    const suite = 第二层文件表.get(文件);
    if (suite) return suite;
  }
  throw new 清单错误(
    `未知测试文件「${文件}」（${层}）：请在 脚本/测试清单.mjs 的${层}映射表补充该文件的 Suite 归属（最小补映射），不静默丢项`,
  );
}

// ── 组装与排序 ──────────────────────────────────────────────────────

export function 组装清单(集合, 根目录 = 默认根目录) {
  const 已见 = new Map();
  const 出 = [];
  for (const { 层, 项们 } of 集合) {
    for (const 项 of 项们) {
      if (!Array.isArray(项.titlePath) || 项.titlePath.length === 0) {
        throw new 清单错误(`收集项「${项.file}」的 titlePath 不是非空数组`);
      }
      if (typeof 项.project !== 'string') {
        throw new 清单错误(`收集项「${项.file}」的 project 不是字符串`);
      }
      const 文件 = 归一路径(项.file, 根目录);
      const 叶子标题 = 项.titlePath[项.titlePath.length - 1];
      const 完整 = { layer: 层, suite: 定suite(层, 文件, 叶子标题), file: 文件, titlePath: 项.titlePath, project: 项.project, location: 项.location ?? null };
      const 键 = `${层}\u0000${项.file}\u0000${项.titlePath.join('\u0000')}\u0000${项.project}`;
      if (已见.has(键)) {
        const 旧 = 已见.get(键);
        throw new 清单错误(
          `重复 Case 身份（layer+file+titlePath+project）：\n  ${旧.file} > ${旧.titlePath.join(' > ')} [${旧.project || '无 project'}]\n  ${项.file} > ${项.titlePath.join(' > ')} [${项.project || '无 project'}]`,
        );
      }
      已见.set(键, 完整);
      出.push(完整);
    }
  }
  return 排序清单(出);
}

/** 代码点序稳定排序（不用 locale/time/random）。 */
export function 排序清单(项们) {
  return [...项们].sort((甲, 乙) => {
    for (const 键 of ['layer', 'suite', 'file', 'project']) {
      if (甲[键] !== 乙[键]) return 甲[键] < 乙[键] ? -1 : 1;
    }
    const 长度 = Math.max(甲.titlePath.length, 乙.titlePath.length);
    for (let i = 0; i < 长度; i += 1) {
      const 片甲 = 甲.titlePath[i] ?? '';
      const 片乙 = 乙.titlePath[i] ?? '';
      if (片甲 !== 片乙) return 片甲 < 片乙 ? -1 : 1;
    }
    return 0;
  });
}

// ── Markdown 渲染 ───────────────────────────────────────────────────

function 转义单元格(文本) {
  return String(文本).replace(/\n/g, ' ').replace(/\|/g, '\\|').replace(/`/g, '\\`');
}

/** 正则元字符转义：坐标列的 -t/--grep 都按正则匹配完整名称。 */
function 转义正则(文本) {
  return 文本.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** shell 单引号包裹（标题里确有单引号时用 '\'' 续接）。 */
function 单引号(文本) {
  return `'${文本.replace(/'/g, "'\\''")}'`;
}

function 选择坐标(项) {
  if (项.layer === '第一层') {
    // C5 修复 a（review r1；r2 收敛数据形状）：-t 按 runner 的匹配全名（各段名以单空格
    // 连接，见 @vitest/runner getTaskFullName）做正则匹配，而 list JSON 的 name 是
    // ' > ' 连接 —— 段间分隔与标题内字面 ' > ' 在 name 里无法区分：逐字用 name 一段
    // 都选不中（实测 -t '甲 > 乙' 收 0 例），按段 join(' ') 又会丢标题里的 '>'。坐标以
    // titlePath.join(' > ')（逐字还原 runner 扁平名，无需额外字段）经正则转义后为源，
    // 把每个 ' > ' 放宽为 ' (> )?'：段分隔位匹配全名的单空格、字面位匹配 ' > '，
    // 无需消歧即可选中目标叶（实测恰好选中 1 例）。刻意不用含 '|' 的写法：表格单元格
    // 会转义 '|'，复制即断。
    const 名称 = 单引号(转义正则(项.titlePath.join(' > ')).replace(/ > /g, ' (> )?'));
    return `npm test -- ${项.file} -t ${名称}`;
  }
  const 名称 = 单引号(转义正则(项.titlePath.join(' ')));
  if (项.file === 'e2e/视觉回归/采集.spec.ts') {
    // C5 修复 b（review r1）：渲染成整条可执行命令（env 前缀显式给出），不再把
    // 「（需 UI_CAPTURE_DIR）」拼在命令尾让复制即断。
    return `UI_CAPTURE_DIR=test-results/visual npm run ui:capture -- --grep ${名称}`;
  }
  const 项目参数 = 项.project ? ` --project=${项.project}` : '';
  return `npm run test:e2e -- ${项.file}${项目参数} --grep ${名称}`;
}

function 源码链接(项) {
  const 前缀 = '../../';
  if (项.location && 项.location.line != null) {
    return `[${项.file}:${项.location.line}](${前缀}${项.file})`;
  }
  return `[${项.file}](${前缀}${项.file})`;
}

export function 渲染自动区(项们) {
  const 层组 = new Map(); // 层 → suite → 项们
  for (const 项 of 项们) {
    if (!层组.has(项.layer)) 层组.set(项.layer, new Map());
    const suite表 = 层组.get(项.layer);
    if (!suite表.has(项.suite)) suite表.set(项.suite, []);
    suite表.get(项.suite).push(项);
  }
  const 行们 = [];
  for (const 层 of ['第一层', '第二层']) {
    if (!层组.has(层)) continue;
    const suite表 = 层组.get(层);
    const 层总数 = [...suite表.values()].reduce((和, 组) => 和 + 组.length, 0);
    const 层文件数 = new Set([...suite表.values()].flat().map((项) => 项.file)).size;
    const 层标题 = 层 === '第一层' ? '第一层 · 单元/组件（Vitest）' : '第二层 · 浏览器（Playwright）';
    行们.push(`## ${层标题} · ${层总数} 例 · ${层文件数} 文件`);
    for (const [suite, 组] of suite表) {
      const 文件数 = new Set(组.map((项) => 项.file)).size;
      行们.push('');
      行们.push(`### ${suite} · ${组.length} 例 · ${文件数} 文件`);
      行们.push('');
      行们.push('<details>');
      行们.push('<summary>展开明细</summary>');
      行们.push('');
      行们.push('| 逻辑标题 | 执行变体（project） | 源码 | 选择坐标 | 计时 |');
      行们.push('| --- | --- | --- | --- | --- |');
      for (const 项 of 组) {
        const 标题 = 转义单元格(项.titlePath.join(' > '));
        const 变体 = 转义单元格(项.project);
        行们.push(`| ${标题} | ${变体} | ${源码链接(项)} | ${转义单元格(选择坐标(项))} | 未知 |`);
      }
      行们.push('');
      行们.push('</details>');
    }
    行们.push('');
  }
  return 行们.join('\n').replace(/\n+$/, '\n');
}

// ── 三种操作 ────────────────────────────────────────────────────────

export async function 主(argv = [], 选项 = {}) {
  const {
    收集 = 默认收集,
    根目录 = 默认根目录,
    文档路径 = join(根目录, 'docs/testing/cases.md'),
    输出 = (文本) => { process.stdout.write(文本); },
    报告 = (文本) => { process.stderr.write(文本); },
  } = 选项;
  try {
    const 写 = argv.includes('--write');
    const 查 = argv.includes('--check');
    const 未知参数 = argv.filter((参数) => 参数 !== '--write' && 参数 !== '--check');
    if (未知参数.length > 0) {
      throw new 清单错误(
        `未知参数：${未知参数.join(' ')}（用法：node 脚本/测试清单.mjs [--write | --check]）`,
      );
    }
    if (写 && 查) {
      throw new 清单错误('--write 与 --check 不能同时使用');
    }
    const 模式 = 写 ? 'write' : 查 ? 'check' : 'list';

    const 结果们 = ['vitest', '功能配置', '视觉配置'].map((名称) => {
      const 结果 = 收集(名称);
      if (!结果 || typeof 结果.status !== 'number' || 结果.status !== 0) {
        throw new 清单错误(
          `${名称} 收集失败（退出码 ${结果?.status}）：\n${(结果?.stderr ?? '').slice(0, 2000)}`,
        );
      }
      return 结果;
    });
    const 第一层 = 解析vitest清单(结果们[0].stdout, 根目录);
    const 功能 = 解析playwright清单(结果们[1].stdout, 根目录, '功能配置');
    const 视觉 = 解析playwright清单(结果们[2].stdout, 根目录, '视觉配置');
    const 项们 = 组装清单([
      { 层: '第一层', 项们: 第一层 },
      { 层: '第二层', 项们: [...功能, ...视觉] },
    ], 根目录);
    const 自动区 = 渲染自动区(项们);

    if (模式 === 'list') {
      输出(`${起始标记}\n${自动区}${结束标记}\n`);
      return 0;
    }

    const 原文 = readFileSync(文档路径, 'utf8');
    const 起点 = 原文.indexOf(起始标记);
    const 终点 = 原文.indexOf(结束标记, 起点 === -1 ? 0 : 起点 + 起始标记.length);
    if (起点 === -1 || 终点 === -1) {
      throw new 清单错误(
        `文档缺自动区标记（${起始标记} … ${结束标记}）：${文档路径}；生成区标记存在才允许 --write/--check`,
      );
    }
    const 前文 = 原文.slice(0, 起点 + 起始标记.length);
    const 后文 = 原文.slice(终点);
    const 当前自动区 = 原文.slice(起点 + 起始标记.length, 终点);
    const 生成区 = `\n${自动区}\n`;

    if (模式 === 'check') {
      if (当前自动区 === 生成区) {
        输出('cases.md 自动区与生成结果一致\n');
        return 0;
      }
      throw new 清单错误(
        `cases.md 自动区已过期（或与生成结果不一致）：${文档路径}；请运行 npm run test:list -- --write`,
      );
    }

    // --write：全部收集/校验/渲染成功后才一次性写，不写半成品
    writeFileSync(文档路径, `${前文}${生成区}${后文}`);
    输出(`cases.md 自动区已更新：${文档路径}（第一层 ${第一层.length} 项，第二层 ${功能.length + 视觉.length} 项）\n`);
    return 0;
  } catch (错误) {
    报告(`测试清单：${错误?.message ?? 错误}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await 主(process.argv.slice(2));
}
