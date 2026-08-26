// UI 回归总入口：解析参数 → 解析 base → 创建 detached base worktree →
// 参考/候选采集 → 比较 → 返回比较器退出码。带一次性基础设施重试与安全清理。
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { 解析UI回归参数, 决定采集模式, 运行命令, 解析门禁环境 } from './UI回归核心.mjs';

function log(消息) {
  console.log(`[ui:check] ${消息}`);
}

function 写基础设施错误(outputDir, 信息) {
  try {
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      join(outputDir, 'infrastructure-error.json'),
      JSON.stringify({ error: 信息, timestamp: new Date().toISOString() }, null, 2),
      'utf8',
    );
  } catch {
    // 写错误本身失败不再传播，仍打印原因。
  }
  console.error(`[ui:check] 基础设施错误：${信息}`);
}

function scenes有JSON(采集目录) {
  const scenesDir = join(采集目录, 'scenes');
  if (!existsSync(scenesDir)) return false;
  try {
    const 文件们 = readdirSync(scenesDir).filter((名) => 名.endsWith('.json'));
    return 文件们.length > 0;
  } catch {
    return false;
  }
}

// 重试包装：最多重试一次。
function 运行命令并重试(command, args, options) {
  const 首次 = 运行命令(command, args, options);
  if (首次.status === 0) return 首次;
  log(`首次失败（status=${首次.status}），重试一次：${command} ${args.join(' ')}`);
  return 运行命令(command, args, options);
}

// 在 outputDir 建立后置为该目录，供顶层 .catch 决定是否写 infrastructure-error.json。
let 已知输出目录 = null;

async function main() {
  const { baseRef, outputDir: rawOutput } = 解析UI回归参数(process.argv.slice(2), process.env);

  // Step 1: 仓库根（当前 worktree 即候选工作区）。
  const toplevel = 运行命令('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (toplevel.status !== 0) {
    throw new Error(`无法解析仓库根：${toplevel.stderr.trim()}`);
  }
  const 仓库根 = toplevel.stdout.trim();
  const outputDir = rawOutput ?? join(仓库根, 'ui-regression-output', 'latest');
  mkdirSync(outputDir, { recursive: true });
  已知输出目录 = outputDir;

  // Step 2: 校验 base 引用。
  const verify = 运行命令('git', ['rev-parse', '--verify', `${baseRef}^{commit}`], { encoding: 'utf8' });
  if (verify.status !== 0) {
    throw new Error(`无效 base 引用：${baseRef}（${verify.stderr.trim()}）`);
  }

  // Step 3: 创建 detached base worktree 到 mkdtemp 精确目录。
  const baseWorktree = mkdtempSync(join(tmpdir(), 'agxp-ui-base-'));
  log(`创建 base worktree：${baseWorktree} @ ${baseRef}`);

  try {
    const addWorktree = 运行命令('git', ['worktree', 'add', '--detach', baseWorktree, baseRef], { encoding: 'utf8' });
    if (addWorktree.status !== 0) {
      // Git 基础设施：重试一次。
      const 重试 = 运行命令('git', ['worktree', 'add', '--detach', baseWorktree, baseRef], { encoding: 'utf8' });
      if (重试.status !== 0) {
        写基础设施错误(outputDir, `git worktree add 失败：${重试.stderr.trim()}`);
        return 2;
      }
    }

    // Step 4: 读取 base worktree 的 package.json，检查 ui:capture。
    let baseHasCapture = false;
    const basePkgPath = join(baseWorktree, 'package.json');
    if (existsSync(basePkgPath)) {
      try {
        const basePkg = JSON.parse(readFileSync(basePkgPath, 'utf8'));
        baseHasCapture = Boolean(basePkg.scripts && basePkg.scripts['ui:capture']);
      } catch {
        baseHasCapture = false;
      }
    }
    const 模式 = 决定采集模式({ baseHasCapture });
    log(`采集模式：${模式}（base ${baseHasCapture ? '有' : '无'} 采集器）`);

    // Step 5 / 6: 参考采集。
    const referenceDir = join(outputDir, 'reference');
    if (模式 === 'compare') {
      log('在 base worktree 执行 npm ci（安装依赖）...');
      const install = 运行命令并重试('npm', ['ci'], { cwd: baseWorktree, encoding: 'utf8' });
      if (install.status !== 0) {
        写基础设施错误(outputDir, `base 依赖安装失败：${install.stderr.trim().slice(-400)}`);
        // 依赖安装第二次失败：基础设施错误，立即退出 2，不继续到候选采集/比较。
        return 2;
      } else {
        log('采集参考场景（reference，端口 4174）...');
        const refEnv = {
          ...process.env,
          UI_CAPTURE_DIR: referenceDir,
          UI_CAPTURE_ROLE: 'reference',
          UI_PORT: '4174',
          UI_BASE_URL: 'http://127.0.0.1:4174',
        };
        const ref = 运行命令('npm', ['run', 'ui:capture'], { cwd: baseWorktree, encoding: 'utf8', env: refEnv });
        if (ref.status !== 0 && !scenes有JSON(referenceDir)) {
          log('参考采集无任何场景 JSON，重试一次...');
          const refRetry = 运行命令('npm', ['run', 'ui:capture'], { cwd: baseWorktree, encoding: 'utf8', env: refEnv });
          if (refRetry.status !== 0 && !scenes有JSON(referenceDir)) {
            写基础设施错误(outputDir, '参考采集重试仍失败且无场景 JSON');
          }
        }
      }
    } else {
      log('bootstrap 模式：跳过参考采集。');
    }

    // Step 7: 候选采集（当前工作区）。
    const candidateDir = join(outputDir, 'candidate');
    log('采集候选场景（candidate，端口 4175）...');
    const candEnv = {
      ...process.env,
      UI_CAPTURE_DIR: candidateDir,
      UI_CAPTURE_ROLE: 'candidate',
      UI_PORT: '4175',
      UI_BASE_URL: 'http://127.0.0.1:4175',
    };
    const cand = 运行命令('npm', ['run', 'ui:capture'], { cwd: 仓库根, encoding: 'utf8', env: candEnv });
    if (cand.status !== 0 && !scenes有JSON(candidateDir)) {
      log('候选采集无任何场景 JSON，重试一次...');
      const candRetry = 运行命令('npm', ['run', 'ui:capture'], { cwd: 仓库根, encoding: 'utf8', env: candEnv });
      if (candRetry.status !== 0 && !scenes有JSON(candidateDir)) {
        写基础设施错误(outputDir, '候选采集重试仍失败且无场景 JSON');
      }
    }

    // Step 8: 执行比较器。
    const { visualGate, uiChangeApproved } = 解析门禁环境(process.env);
    const compareArgs = ['run', 'ui:compare', '--', '--candidate', candidateDir, '--output', outputDir];
    if (模式 === 'compare') {
      compareArgs.push('--reference', referenceDir);
    }
    log(`运行比较器（mode=${模式}, gate=${visualGate}, approved=${uiChangeApproved}）...`);
    const compareEnv = {
      ...process.env,
      UI_VISUAL_GATE: visualGate,
      UI_CHANGE_APPROVED: uiChangeApproved ? 'true' : 'false',
    };
    const compare = 运行命令('npm', compareArgs, { cwd: 仓库根, encoding: 'utf8', env: compareEnv });
    if (compare.stdout) process.stdout.write(compare.stdout);
    if (compare.stderr) process.stderr.write(compare.stderr);

    if (compare.status !== 0 && compare.status !== 1 && compare.status !== 2) {
      写基础设施错误(outputDir, `比较器异常退出码：${compare.status}`);
      return 2;
    }

    // Step 9: 返回比较器退出码。
    log(`比较器退出码：${compare.status}`);
    return compare.status;
  } finally {
    // Step 10: 仅清理本轮 mkdtemp 返回的精确路径。绝不触碰仓库根、当前 worktree 或用户目录。
    try {
      运行命令('git', ['worktree', 'remove', '--force', baseWorktree], { encoding: 'utf8' });
    } catch {
      // 忽略
    }
    try {
      rmSync(baseWorktree, { recursive: true, force: true });
    } catch {
      // 忽略
    }
    try {
      运行命令('git', ['worktree', 'prune'], { encoding: 'utf8' });
    } catch {
      // 忽略
    }
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    const 信息 = error instanceof Error ? error.message : String(error);
    if (已知输出目录) {
      写基础设施错误(已知输出目录, 信息);
    } else {
      // outputDir 尚未建立（例如参数解析或仓库根解析失败）：不向 cwd 写文件，仅打印原因。
      console.error(`[ui:check] 基础设施错误：${信息}`);
    }
    process.exitCode = 2;
  });