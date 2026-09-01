// 整栈报告 CLI：运行器收尾时用 tsx 调这一个入口。
//   node_modules/.bin/tsx e2e/真实后端/报告命令.ts <运行上下文.json>
// 进程退出码就是整轮验收的退出码（0/1/2/75），运行器原样转发。
import { readFileSync } from 'node:fs';
import { 生成整栈报告 } from './报告';

const 路径 = process.argv[2];
if (路径 === undefined || 路径 === '') {
  console.error('usage: 报告命令.ts <运行上下文.json>');
  process.exit(2);
}

try {
  const 产出 = 生成整栈报告(JSON.parse(readFileSync(路径, 'utf8')));
  for (const 条目 of 产出.issues) console.log(`报告提示：${条目}`);
  console.log(`整栈验收判定：${产出.classification} 退出码=${产出.exitCode} 候选基线=${产出.baselineReview}`);
  process.exit(产出.exitCode);
} catch (错误) {
  console.error(`报告生成失败：${(错误 as Error).message}`);
  process.exit(2);
}
