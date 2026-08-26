import { join } from 'node:path';
import { 比较采集目录, 写报告 } from './比较器';

interface 命令参数 {
  candidate?: string;
  output?: string;
  reference?: string;
}

function 解析参数(args: string[]): 命令参数 {
  const 参数: 命令参数 = {};
  for (let i = 0; i < args.length; i += 1) {
    const 项 = args[i];
    if (项 === '--candidate') 参数.candidate = args[i + 1];
    else if (项 === '--output') 参数.output = args[i + 1];
    else if (项 === '--reference') 参数.reference = args[i + 1];
  }
  return 参数;
}

const 参数 = 解析参数(process.argv.slice(2));
const visualGate = (process.env.UI_VISUAL_GATE === 'enforce' ? 'enforce' : 'report') as 'report' | 'enforce';
const uiChangeApproved = process.env.UI_CHANGE_APPROVED === 'true';

if (!参数.candidate || !参数.output) {
  console.error(
    '用法：tsx e2e/视觉回归/比较命令.ts --candidate <dir> --output <dir> [--reference <dir>]',
  );
  process.exitCode = 2;
} else {
  try {
    const 报告 = 比较采集目录({
      referenceDir: 参数.reference ?? null,
      candidateDir: 参数.candidate,
      outputDir: 参数.output,
      visualGate,
      uiChangeApproved,
    });
    写报告(报告, 参数.output);
    const md路径 = join(参数.output, 'report.md');
    console.log(`报告：${md路径}`);
    console.log(
      `汇总：pass=${报告.summary.pass} warning=${报告.summary.warning} blocked=${报告.summary.blocked} new=${报告.summary.new} removed=${报告.summary.removed} infrastructure=${报告.summary.infrastructure}`,
    );
    console.log(`退出码：${报告.exitCode}`);
    process.exitCode = 报告.exitCode;
  } catch (error) {
    const 信息 = error instanceof Error ? error.message : String(error);
    console.error(`基础设施错误：${信息}`);
    process.exitCode = 2;
  }
}