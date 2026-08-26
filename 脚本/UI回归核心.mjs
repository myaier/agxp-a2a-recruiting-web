// UI 回归编排纯核心：参数解析、采集模式决策、子进程命令执行。
// 不含 git/worktree 逻辑，便于在 Vitest 下单测。
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const 用法 = [
  '用法：node 脚本/UI回归.mjs [--base <git-ref>] [--output <dir>]',
  '  --base   对比基准 git 引用，覆盖环境变量 UI_BASE_REF，默认 origin/main',
  '  --output 报告输出目录（绝对或相对路径），默认 <仓库根>/ui-regression-output/latest',
].join('\n');

export function 解析UI回归参数(argv, env) {
  let baseRef = null;
  let outputDir = null;
  for (let i = 0; i < argv.length; i += 1) {
    const 项 = argv[i];
    if (项 === '--base') {
      const 值 = argv[i + 1];
      if (值 === undefined) {
        throw new Error(`--base 缺少值\n${用法}`);
      }
      baseRef = 值;
      i += 1;
    } else if (项 === '--output') {
      const 值 = argv[i + 1];
      if (值 === undefined) {
        throw new Error(`--output 缺少值\n${用法}`);
      }
      outputDir = 值;
      i += 1;
    } else {
      throw new Error(`未知参数：${项}\n${用法}`);
    }
  }

  const envBase = typeof env.UI_BASE_REF === 'string' && env.UI_BASE_REF.length > 0 ? env.UI_BASE_REF : null;
  const resolvedBase = baseRef ?? envBase ?? 'origin/main';
  if (resolvedBase.length === 0) {
    throw new Error(`base 引用不能为空\n${用法}`);
  }

  return {
    baseRef: resolvedBase,
    outputDir: outputDir === null ? null : resolve(outputDir),
  };
}

export function 决定采集模式({ baseHasCapture }) {
  return baseHasCapture ? 'compare' : 'bootstrap';
}

// 门禁环境解析：规范化 CI/本地传入的 UI_VISUAL_GATE 与 UI_CHANGE_APPROVED。
// 未知/空值一律回落到 `report`；只有字面量 'true' 才视为审批通过。
export function 解析门禁环境(env) {
  const visualGate = env.UI_VISUAL_GATE === 'enforce' ? 'enforce' : 'report';
  const uiChangeApproved = env.UI_CHANGE_APPROVED === 'true';
  return { visualGate, uiChangeApproved };
}

export function 运行命令(command, args, options = {}) {
  const 结果 = spawnSync(command, args, {
    shell: false,
    encoding: 'utf8',
    ...options,
  });
  if (结果.signal) {
    throw new Error(`命令被信号终止：${command} ${args.join(' ')} (signal=${结果.signal})`);
  }
  return {
    status: 结果.status,
    stdout: 结果.stdout ?? '',
    stderr: 结果.stderr ?? '',
  };
}