import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { 比较图片, 默认比较阈值 } from '../../视觉回归/比较器';
import type { 旅程ID, 真实后端视觉Manifest, 视觉结果 } from '../类型';
import { 场景文件名, 旅程场景映射, 真实后端场景们, type 真实后端场景ID } from './场景清单';

// 真实后端视觉比较刻意不复用 e2e/视觉回归/比较器.ts 的 比较采集目录()：
// 那是 Mock 视觉回归的目录 API，它把任何 /api/v1 请求当作结构失败，而本验收每条旅程都必须打真实后端。
// 这里只复用像素比较核心 比较图片() 和 默认比较阈值。

type 场景结果项 = 视觉结果['scenes'][number];

export interface 比较真实后端视觉选项 {
  selectedJourneys: readonly 旅程ID[];
  baselineManifestPath: string;
  baselineDir: string;
  candidateDir: string;
  diffDir: string;
  candidateManifest: 真实后端视觉Manifest;
  gate: 'report' | 'enforce';
}

function 期望场景集(selectedJourneys: readonly 旅程ID[]): Set<真实后端场景ID> {
  const 集合 = new Set<真实后端场景ID>();
  for (const 旅程 of selectedJourneys) {
    for (const 场景 of 旅程场景映射[旅程]) 集合.add(场景);
  }
  return 集合;
}

function 跳过场景(sceneId: string): 场景结果项 {
  return { sceneId, status: 'skipped', pixelDiffRatio: null, reference: null, candidate: null, diff: null, reasons: [] };
}

// 基线目录“存在”指真的有 reference PNG：空目录等同于没有基线，
// 这样一次失败运行留下的空目录不会把 bootstrap 误判成半存在的损坏基线。
function 基线目录可用(baselineDir: string): boolean {
  if (!existsSync(baselineDir) || !statSync(baselineDir).isDirectory()) return false;
  return readdirSync(baselineDir).some((名) => 名.endsWith('.png'));
}

function 读基线清单(路径: string): 真实后端视觉Manifest | null {
  let 值: unknown;
  try {
    值 = JSON.parse(readFileSync(路径, 'utf8'));
  } catch {
    return null;
  }
  if (typeof 值 !== 'object' || 值 === null || Array.isArray(值)) return null;
  const 记录 = 值 as Record<string, unknown>;
  const 视口 = 记录.viewport as Record<string, unknown> | undefined;
  if (typeof 记录.schemaVersion !== 'number') return null;
  if (typeof 记录.agentBrowserVersion !== 'string' || typeof 记录.chromeBuild !== 'string') return null;
  if (typeof 视口 !== 'object' || 视口 === null) return null;
  if (typeof 视口.width !== 'number' || typeof 视口.height !== 'number') return null;
  if (typeof 记录.locale !== 'string' || typeof 记录.timezone !== 'string' || typeof 记录.colorScheme !== 'string') return null;
  if (typeof 记录.deviceScaleFactor !== 'number') return null;
  if (!Array.isArray(记录.scenes) || 记录.scenes.some((项) => typeof 项 !== 'string')) return null;
  if (typeof 记录.baselineCommit !== 'string') return null;
  return 记录 as unknown as 真实后端视觉Manifest;
}

// 逐字段比较环境；baselineCommit 故意不参与（基线内容一致时换 commit 不该阻塞）。
function 环境差异(基线: 真实后端视觉Manifest, 候选: 真实后端视觉Manifest): string[] {
  const 差异: string[] = [];
  if (基线.schemaVersion !== 候选.schemaVersion) 差异.push('schemaVersion');
  if (基线.agentBrowserVersion !== 候选.agentBrowserVersion) 差异.push('agentBrowserVersion');
  if (基线.chromeBuild !== 候选.chromeBuild) 差异.push('chromeBuild');
  if (基线.viewport.width !== 候选.viewport.width || 基线.viewport.height !== 候选.viewport.height) 差异.push('viewport');
  if (基线.locale !== 候选.locale) 差异.push('locale');
  if (基线.timezone !== 候选.timezone) 差异.push('timezone');
  if (基线.colorScheme !== 候选.colorScheme) 差异.push('colorScheme');
  if (基线.deviceScaleFactor !== 候选.deviceScaleFactor) 差异.push('deviceScaleFactor');
  if (基线.scenes.length !== 候选.scenes.length || 基线.scenes.some((名, 序) => 名 !== 候选.scenes[序])) 差异.push('scenes');
  return 差异;
}

// 环境层面已经无法比较时：不读任何 PNG，已选场景记 missing，未选场景记 skipped。
function 未比较结果(
  options: 比较真实后端视觉选项,
  期望: Set<真实后端场景ID>,
  environment: 视觉结果['environment'],
  environmentIssue: 视觉结果['environmentIssue'],
  原因: string,
): 视觉结果 {
  return {
    schemaVersion: 1,
    gate: options.gate,
    environment,
    environmentIssue,
    scenes: 真实后端场景们.map((场景) => (期望.has(场景)
      ? { sceneId: 场景, status: 'missing' as const, pixelDiffRatio: null, reference: null, candidate: null, diff: null, reasons: [原因] }
      : 跳过场景(场景))),
  };
}

export function 比较真实后端视觉(options: 比较真实后端视觉选项): 视觉结果 {
  const 期望 = 期望场景集(options.selectedJourneys);
  const 清单存在 = existsSync(options.baselineManifestPath);
  const 基线存在 = 基线目录可用(options.baselineDir);

  // bootstrap 要求清单与基线目录同时缺失；半存在按损坏处理，不能靠删清单伪造 bootstrap。
  if (!清单存在 && !基线存在) {
    return 未比较结果(options, 期望, 'bootstrap', 'bootstrap', '尚无基线：首次运行需人工审阅并安装基线');
  }
  if (!清单存在 || !基线存在) {
    return 未比较结果(options, 期望, 'blocked', 'manifest-invalid', '基线清单与基线目录必须同时存在');
  }

  const 基线清单 = 读基线清单(options.baselineManifestPath);
  if (基线清单 === null) {
    return 未比较结果(options, 期望, 'blocked', 'manifest-invalid', '基线清单无法解析或字段不合法');
  }

  const 差异 = 环境差异(基线清单, options.candidateManifest);
  if (差异.length > 0) {
    // 只差 renderer 版本是结构化、可通过人工审阅恢复的；其余环境差异不可用更新命令绕过。
    const 仅渲染器 = 差异.every((名) => 名 === 'agentBrowserVersion' || 名 === 'chromeBuild');
    return 未比较结果(
      options,
      期望,
      'blocked',
      仅渲染器 ? 'renderer-version-mismatch' : 'manifest-invalid',
      `环境与基线不一致：${差异.join('、')}`,
    );
  }

  let environment: 视觉结果['environment'] = 'matched';
  let environmentIssue: 视觉结果['environmentIssue'] = null;
  const scenes: 场景结果项[] = [];

  for (const 场景 of 真实后端场景们) {
    if (!期望.has(场景)) {
      scenes.push(跳过场景(场景));
      continue;
    }

    const 基准路径 = join(options.baselineDir, 场景文件名(场景));
    const 候选路径 = join(options.candidateDir, 场景文件名(场景));
    const 有基准 = existsSync(基准路径);
    const 有候选 = existsSync(候选路径);
    if (!有基准 || !有候选) {
      // 已有基线模式下缺图是基础设施问题：不抛异常，也不当作通过。
      environment = 'blocked';
      environmentIssue = 'expected-file-missing';
      const reasons: string[] = [];
      if (!有基准) reasons.push('基准截图缺失');
      if (!有候选) reasons.push('候选截图缺失');
      scenes.push({
        sceneId: 场景,
        status: 'missing',
        pixelDiffRatio: null,
        reference: 有基准 ? 基准路径 : null,
        candidate: 有候选 ? 候选路径 : null,
        diff: null,
        reasons,
      });
      continue;
    }

    mkdirSync(options.diffDir, { recursive: true });
    const 差异路径 = join(options.diffDir, 场景文件名(场景));
    let 图: ReturnType<typeof 比较图片>;
    try {
      图 = 比较图片(基准路径, 候选路径, 差异路径, 默认比较阈值);
    } catch {
      // 截断或零字节 PNG（capture_scene 被打断）与缺图是同一类基础设施失败，
      // 归入既有的 expected-file-missing，绝不让异常逃逸：逃逸会让 runner 退成
      // 通用非零码被误判为功能失败，而且整份 report.json 都写不出来。
      environment = 'blocked';
      environmentIssue = 'expected-file-missing';
      scenes.push({
        sceneId: 场景,
        status: 'missing',
        pixelDiffRatio: null,
        reference: 基准路径,
        candidate: 候选路径,
        diff: null,
        reasons: ['基准/候选截图无法解析'],
      });
      continue;
    }
    scenes.push({
      sceneId: 场景,
      status: 图.status,
      pixelDiffRatio: 图.pixelDiffRatio,
      reference: 基准路径,
      candidate: 候选路径,
      diff: 差异路径,
      reasons: 图.status === 'pass' ? [] : [`像素差异 ${(图.pixelDiffRatio * 100).toFixed(2)}%`],
    });
  }

  return { schemaVersion: 1, gate: options.gate, environment, environmentIssue, scenes };
}

// ---- 候选基线目录（两阶段更新的第一阶段）----

// 已提交基线只由人工从 review 目录复制安装，本模块永远不写这个路径。
const 已提交基线目录 = ['e2e', '真实后端', '视觉', '基线'].join(sep);

export function 生成候选基线目录(options: {
  functionalPassed: boolean;
  fixtureVerified: boolean;
  environment: 'matched' | 'bootstrap' | 'blocked';
  environmentIssue: null | 'bootstrap' | 'renderer-version-mismatch' | 'manifest-invalid' | 'expected-file-missing';
  baselineManifest: 真实后端视觉Manifest | null;
  candidateManifest: 真实后端视觉Manifest;
  candidateDir: string;
  reviewDir: string;
}): void {
  if (!options.functionalPassed) throw new Error('功能旅程未全部通过，拒绝生成候选基线');
  if (!options.fixtureVerified) throw new Error('后端 fixture verify 未通过，拒绝生成候选基线');

  const 审阅目录 = resolve(options.reviewDir);
  if (审阅目录 === 已提交基线目录 || 审阅目录.endsWith(sep + 已提交基线目录)) {
    throw new Error('候选基线只能写入运行产物目录，不得写入已提交基线目录');
  }

  const 渲染器升级 = options.environment === 'blocked'
    && options.environmentIssue === 'renderer-version-mismatch'
    && options.baselineManifest !== null;
  const 允许 = 渲染器升级
    || (options.environment === 'matched' && options.environmentIssue === null && options.baselineManifest !== null)
    || (options.environment === 'bootstrap' && options.environmentIssue === 'bootstrap' && options.baselineManifest === null);
  if (!允许) {
    throw new Error(`环境状态不允许生成候选基线：${options.environment}/${options.environmentIssue ?? 'null'}`);
  }

  // 七张 reference 是一个原子集合：先确认候选齐全，再写 review 目录，避免留下半套。
  for (const 场景 of 真实后端场景们) {
    if (!existsSync(join(options.candidateDir, 场景文件名(场景)))) {
      throw new Error(`候选截图缺失，拒绝生成候选基线：${场景}`);
    }
  }

  mkdirSync(审阅目录, { recursive: true });
  for (const 场景 of 真实后端场景们) {
    copyFileSync(join(options.candidateDir, 场景文件名(场景)), join(审阅目录, 场景文件名(场景)));
  }
  writeFileSync(join(审阅目录, '基线清单.json'), JSON.stringify(options.candidateManifest, null, 2), 'utf8');

  if (渲染器升级) {
    const 旧 = options.baselineManifest as 真实后端视觉Manifest;
    writeFileSync(join(审阅目录, 'environment-review.json'), JSON.stringify({
      schemaVersion: 1,
      reason: 'renderer-version-mismatch',
      previous: { agentBrowserVersion: 旧.agentBrowserVersion, chromeBuild: 旧.chromeBuild },
      current: {
        agentBrowserVersion: options.candidateManifest.agentBrowserVersion,
        chromeBuild: options.candidateManifest.chromeBuild,
      },
      candidateManifest: options.candidateManifest,
    }, null, 2), 'utf8');
  }
}
