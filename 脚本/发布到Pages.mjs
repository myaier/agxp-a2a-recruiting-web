// 一键发布到 GitHub Pages：本地构建 → 补 Pages 必需文件 → 推到 gh-pages 分支。
//
// 为什么要补文件：
//   · .nojekyll —— GitHub Pages 默认走 Jekyll，会跳过下划线开头的目录。
//     Vite 产物里没有下划线目录，但加上它同时也关掉了 Jekyll 的整套预处理，
//     省掉一类难查的 404，成本为零。
//   · 404.html —— 复制一份 index.html。用的是哈希路由，正常不会触发 404，
//     但用户手输错路径时能落回应用而不是 GitHub 的报错页。
//
// 为什么推到 gh-pages 分支而不是 main/docs：
//   main 只放源码，构建产物不进版本历史；组织里 webc-zh 也是这个做法。

import { execSync } from 'node:child_process';
import { existsSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const 工程根 = join(dirname(fileURLToPath(import.meta.url)), '..');
const 产物目录 = join(工程根, 'dist');
const 目标分支 = 'gh-pages';

const 跑 = (命令, 目录 = 工程根) =>
  execSync(命令, { cwd: 目录, stdio: 'inherit', encoding: 'utf8' });
const 取 = (命令, 目录 = 工程根) =>
  execSync(命令, { cwd: 目录, encoding: 'utf8' }).trim();

// ── 1. 构建 ──────────────────────────────────────────────
console.log('\n[1/4] 构建生产产物…');
跑('npm run build');

if (!existsSync(join(产物目录, 'index.html'))) {
  console.error('构建产物里没有 index.html，中止发布。');
  process.exit(1);
}

// ── 2. 补 Pages 必需文件 ──────────────────────────────────
console.log('\n[2/4] 补 .nojekyll 与 404.html…');
writeFileSync(join(产物目录, '.nojekyll'), '');
copyFileSync(join(产物目录, 'index.html'), join(产物目录, '404.html'));

// ── 3. 确认有 remote ────────────────────────────────────
let 远端;
try {
  远端 = 取('git remote get-url origin');
} catch {
  console.error('\n还没有配置 origin remote。先创建远端仓库并 git remote add origin <url>。');
  process.exit(1);
}
console.log(`\n[3/4] 远端：${远端}`);

// ── 4. 把 dist 作为独立仓库强推到 gh-pages ────────────────
// 用「临时仓库 + 强推」而不是 git subtree：产物目录被 .gitignore 忽略，
// subtree 会拒绝；强推也保证 gh-pages 永远只有一层最新产物，不堆历史。
console.log(`\n[4/4] 推送到 ${目标分支} 分支…`);
const 提交信息 = `发布 web 产物 (${取('git rev-parse --short HEAD')})`;

rmSync(join(产物目录, '.git'), { recursive: true, force: true });
跑('git init -q', 产物目录);
跑('git checkout -q -b ' + 目标分支, 产物目录);
跑('git add -A', 产物目录);
跑(`git -c user.name="deploy" -c user.email="deploy@local" commit -q -m "${提交信息}"`, 产物目录);
跑(`git remote add origin ${远端}`, 产物目录);
跑(`git push -q --force origin ${目标分支}`, 产物目录);
rmSync(join(产物目录, '.git'), { recursive: true, force: true });

const 仓库路径 = 远端.replace(/^.*github\.com[:/]/, '').replace(/\.git$/, '');
const [组织, 仓库] = 仓库路径.split('/');
console.log(`\n完成。页面地址：https://${组织}.github.io/${仓库}/`);
console.log('（首次发布需要在仓库 Settings → Pages 把源设为 gh-pages 分支，或用 gh api 开启）');
