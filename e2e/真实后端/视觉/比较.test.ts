// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { 比较真实后端视觉, 生成候选基线目录 } from './比较';
import { 真实后端场景们 } from './场景清单';
import type { 真实后端视觉Manifest } from '../类型';

const 临时目录们: string[] = [];

const 固定清单: 真实后端视觉Manifest = {
  schemaVersion: 1,
  agentBrowserVersion: '1.4.0',
  chromeBuild: '141.0.7390.54',
  viewport: { width: 390, height: 844 },
  locale: 'zh-CN',
  timezone: 'Asia/Shanghai',
  colorScheme: 'light',
  deviceScaleFactor: 1,
  scenes: [...真实后端场景们],
  baselineCommit: 'aaaaaaa',
};

interface 工作区 {
  根: string;
  基线目录: string;
  基线清单路径: string;
  候选目录: string;
  差异目录: string;
}

function 新工作区(): 工作区 {
  const 根 = mkdtempSync(join(tmpdir(), 'backend-visual-test-'));
  临时目录们.push(根);
  return {
    根,
    基线目录: join(根, '基线'),
    基线清单路径: join(根, '基线清单.json'),
    候选目录: join(根, '候选'),
    差异目录: join(根, '差异'),
  };
}

function 写图(路径: string, 改色像素: number): void {
  mkdirSync(join(路径, '..'), { recursive: true });
  const 图 = new PNG({ width: 20, height: 20 });
  for (let i = 0; i < 400; i += 1) {
    const 偏移 = i * 4;
    图.data[偏移] = i < 改色像素 ? 255 : 20;
    图.data[偏移 + 1] = 20;
    图.data[偏移 + 2] = 20;
    图.data[偏移 + 3] = 255;
  }
  writeFileSync(路径, PNG.sync.write(图));
}

function 写坏图(路径: string): void {
  mkdirSync(join(路径, '..'), { recursive: true });
  writeFileSync(路径, '这不是 PNG', 'utf8');
}

function 写全部场景(目录: string, 改色像素 = 0): void {
  for (const 场景 of 真实后端场景们) 写图(join(目录, `${场景}.png`), 改色像素);
}

function 写基线清单(工作区: 工作区, 覆盖: Record<string, unknown> = {}): void {
  writeFileSync(工作区.基线清单路径, JSON.stringify({ ...固定清单, ...覆盖 }), 'utf8');
}

function 场景状态(结果: ReturnType<typeof 比较真实后端视觉>, sceneId: string) {
  const 项 = 结果.scenes.find((场景) => 场景.sceneId === sceneId);
  if (!项) throw new Error(`结果缺少场景：${sceneId}`);
  return 项;
}

afterEach(() => {
  for (const 目录 of 临时目录们.splice(0)) rmSync(目录, { recursive: true, force: true });
});

describe('比较真实后端视觉：阈值与旅程选择', () => {
  it('按 0.5% 与 5% 阈值区分通过、警告和阻断', () => {
    const 区 = 新工作区();
    写基线清单(区);
    写全部场景(区.基线目录, 0);

    const 比较 = (改色像素: number) => {
      写全部场景(区.候选目录, 改色像素);
      return 场景状态(比较真实后端视觉({
        selectedJourneys: ['candidate-crud'],
        baselineManifestPath: 区.基线清单路径,
        baselineDir: 区.基线目录,
        candidateDir: 区.候选目录,
        diffDir: 区.差异目录,
        candidateManifest: 固定清单,
        gate: 'report',
      }), 'candidate-resume-updated');
    };

    expect(比较(1).status).toBe('pass');
    expect(比较(20).status).toBe('warning');
    const 阻断 = 比较(21);
    expect(阻断.status).toBe('blocked');
    expect(阻断.pixelDiffRatio).toBeCloseTo(21 / 400, 6);
    expect(existsSync(join(区.差异目录, 'candidate-resume-updated.png'))).toBe(true);
  });

  it('全部旅程比较七个场景，单旅程只比较自己的场景且不读取未选中 PNG', () => {
    const 区 = 新工作区();
    写基线清单(区);
    写全部场景(区.基线目录, 0);
    写全部场景(区.候选目录, 0);

    const 全部 = 比较真实后端视觉({
      selectedJourneys: ['candidate-load', 'candidate-crud', 'recruiter-load', 'recruiter-crud', 'session-isolation'],
      baselineManifestPath: 区.基线清单路径,
      baselineDir: 区.基线目录,
      candidateDir: 区.候选目录,
      diffDir: 区.差异目录,
      candidateManifest: 固定清单,
      gate: 'report',
    });
    expect(全部.environment).toBe('matched');
    expect(全部.scenes.map((项) => 项.sceneId)).toEqual([...真实后端场景们]);
    expect(全部.scenes.every((项) => 项.status === 'pass')).toBe(true);

    // 未选中的场景即使 PNG 损坏也不得被读取。
    for (const 场景 of 真实后端场景们) {
      if (场景 === 'candidate-resume-loaded' || 场景 === 'candidate-intentions-loaded' || 场景 === 'candidate-disclosure-loaded') continue;
      写坏图(join(区.基线目录, `${场景}.png`));
      写坏图(join(区.候选目录, `${场景}.png`));
    }
    const 单旅程 = 比较真实后端视觉({
      selectedJourneys: ['candidate-load'],
      baselineManifestPath: 区.基线清单路径,
      baselineDir: 区.基线目录,
      candidateDir: 区.候选目录,
      diffDir: 区.差异目录,
      candidateManifest: 固定清单,
      gate: 'report',
    });
    expect(单旅程.environment).toBe('matched');
    expect(单旅程.scenes.filter((项) => 项.status === 'pass').map((项) => 项.sceneId))
      .toEqual(['candidate-resume-loaded', 'candidate-intentions-loaded', 'candidate-disclosure-loaded']);
    expect(单旅程.scenes.filter((项) => 项.status === 'skipped')).toHaveLength(4);
    expect(场景状态(单旅程, 'candidate-resume-updated')).toMatchObject({ reference: null, candidate: null, diff: null, pixelDiffRatio: null });
  });

  it('已选场景缺基准或缺候选是 missing 加 expected-file-missing', () => {
    const 区 = 新工作区();
    写基线清单(区);
    写全部场景(区.基线目录, 0);
    写全部场景(区.候选目录, 0);
    rmSync(join(区.基线目录, 'candidate-resume-loaded.png'));
    rmSync(join(区.候选目录, 'candidate-intentions-loaded.png'));

    const 结果 = 比较真实后端视觉({
      selectedJourneys: ['candidate-load'],
      baselineManifestPath: 区.基线清单路径,
      baselineDir: 区.基线目录,
      candidateDir: 区.候选目录,
      diffDir: 区.差异目录,
      candidateManifest: 固定清单,
      gate: 'report',
    });
    expect(结果.environment).toBe('blocked');
    expect(结果.environmentIssue).toBe('expected-file-missing');
    expect(场景状态(结果, 'candidate-resume-loaded').status).toBe('missing');
    expect(场景状态(结果, 'candidate-intentions-loaded').status).toBe('missing');
    expect(场景状态(结果, 'candidate-disclosure-loaded').status).toBe('pass');
  });
});

describe('比较真实后端视觉：环境清单', () => {
  it('清单与基线目录同时缺失才是 bootstrap', () => {
    const 区 = 新工作区();
    写全部场景(区.候选目录, 0);

    const 结果 = 比较真实后端视觉({
      selectedJourneys: ['candidate-crud'],
      baselineManifestPath: 区.基线清单路径,
      baselineDir: 区.基线目录,
      candidateDir: 区.候选目录,
      diffDir: 区.差异目录,
      candidateManifest: 固定清单,
      gate: 'report',
    });
    expect(结果.environment).toBe('bootstrap');
    expect(结果.environmentIssue).toBe('bootstrap');
    expect(场景状态(结果, 'candidate-resume-updated').status).toBe('missing');
    expect(场景状态(结果, 'candidate-resume-loaded').status).toBe('skipped');
  });

  it('半存在或损坏的基线是 manifest-invalid，不是 bootstrap', () => {
    const 只有清单 = 新工作区();
    写基线清单(只有清单);
    写全部场景(只有清单.候选目录, 0);
    const 甲 = 比较真实后端视觉({
      selectedJourneys: ['candidate-crud'],
      baselineManifestPath: 只有清单.基线清单路径,
      baselineDir: 只有清单.基线目录,
      candidateDir: 只有清单.候选目录,
      diffDir: 只有清单.差异目录,
      candidateManifest: 固定清单,
      gate: 'report',
    });
    expect(甲).toMatchObject({ environment: 'blocked', environmentIssue: 'manifest-invalid' });

    const 只有图片 = 新工作区();
    写全部场景(只有图片.基线目录, 0);
    写全部场景(只有图片.候选目录, 0);
    const 乙 = 比较真实后端视觉({
      selectedJourneys: ['candidate-crud'],
      baselineManifestPath: 只有图片.基线清单路径,
      baselineDir: 只有图片.基线目录,
      candidateDir: 只有图片.候选目录,
      diffDir: 只有图片.差异目录,
      candidateManifest: 固定清单,
      gate: 'report',
    });
    expect(乙).toMatchObject({ environment: 'blocked', environmentIssue: 'manifest-invalid' });

    const 坏清单 = 新工作区();
    writeFileSync(坏清单.基线清单路径, '{不是 JSON', 'utf8');
    写全部场景(坏清单.基线目录, 0);
    写全部场景(坏清单.候选目录, 0);
    const 丙 = 比较真实后端视觉({
      selectedJourneys: ['candidate-crud'],
      baselineManifestPath: 坏清单.基线清单路径,
      baselineDir: 坏清单.基线目录,
      candidateDir: 坏清单.候选目录,
      diffDir: 坏清单.差异目录,
      candidateManifest: 固定清单,
      gate: 'report',
    });
    expect(丙).toMatchObject({ environment: 'blocked', environmentIssue: 'manifest-invalid' });
  });

  it('只差 agent-browser/Chrome 版本时在读取 PNG 之前返回 renderer-version-mismatch', () => {
    const 区 = 新工作区();
    写基线清单(区, { agentBrowserVersion: '1.3.0', chromeBuild: '140.0.7000.1' });
    写坏图(join(区.基线目录, 'candidate-resume-updated.png'));
    写坏图(join(区.候选目录, 'candidate-resume-updated.png'));

    const 结果 = 比较真实后端视觉({
      selectedJourneys: ['candidate-crud'],
      baselineManifestPath: 区.基线清单路径,
      baselineDir: 区.基线目录,
      candidateDir: 区.候选目录,
      diffDir: 区.差异目录,
      candidateManifest: 固定清单,
      gate: 'report',
    });
    expect(结果).toMatchObject({ environment: 'blocked', environmentIssue: 'renderer-version-mismatch' });
    expect(场景状态(结果, 'candidate-resume-updated').status).toBe('missing');
    expect(existsSync(区.差异目录)).toBe(false);
  });

  it('viewport、语言、时区、颜色、scale、schema、场景清单差异都是 manifest-invalid', () => {
    const 覆盖们: Record<string, unknown>[] = [
      { viewport: { width: 375, height: 812 } },
      { locale: 'en-US' },
      { timezone: 'UTC' },
      { colorScheme: 'dark' },
      { deviceScaleFactor: 2 },
      { schemaVersion: 2 },
      { scenes: ['candidate-resume-loaded'] },
    ];
    for (const 覆盖 of 覆盖们) {
      const 区 = 新工作区();
      写基线清单(区, 覆盖);
      写全部场景(区.基线目录, 0);
      写全部场景(区.候选目录, 0);
      expect(比较真实后端视觉({
        selectedJourneys: ['candidate-crud'],
        baselineManifestPath: 区.基线清单路径,
        baselineDir: 区.基线目录,
        candidateDir: 区.候选目录,
        diffDir: 区.差异目录,
        candidateManifest: 固定清单,
        gate: 'report',
      })).toMatchObject({ environment: 'blocked', environmentIssue: 'manifest-invalid' });
    }
  });

  it('baselineCommit 不参与环境比较', () => {
    const 区 = 新工作区();
    写基线清单(区, { baselineCommit: '9999999' });
    写全部场景(区.基线目录, 0);
    写全部场景(区.候选目录, 0);
    expect(比较真实后端视觉({
      selectedJourneys: ['candidate-crud'],
      baselineManifestPath: 区.基线清单路径,
      baselineDir: 区.基线目录,
      candidateDir: 区.候选目录,
      diffDir: 区.差异目录,
      candidateManifest: 固定清单,
      gate: 'report',
    })).toMatchObject({ environment: 'matched', environmentIssue: null });
  });
});

describe('生成候选基线目录', () => {
  function 选项(覆盖: Partial<Parameters<typeof 生成候选基线目录>[0]>): Parameters<typeof 生成候选基线目录>[0] {
    const 区 = 新工作区();
    写全部场景(区.候选目录, 0);
    return {
      functionalPassed: true,
      fixtureVerified: true,
      environment: 'bootstrap',
      environmentIssue: 'bootstrap',
      baselineManifest: null,
      candidateManifest: 固定清单,
      candidateDir: 区.候选目录,
      reviewDir: join(区.根, 'baseline-review'),
      ...覆盖,
    };
  }

  it('干净 bootstrap 复制七张候选与候选清单，不触碰已提交基线', () => {
    const 参数 = 选项({});
    生成候选基线目录(参数);
    expect(readdirSync(参数.reviewDir).sort()).toEqual([...真实后端场景们].map((场景) => `${场景}.png`).concat('基线清单.json').sort());
    expect(JSON.parse(readFileSync(join(参数.reviewDir, '基线清单.json'), 'utf8'))).toEqual(固定清单);
  });

  it('matched 刷新复制七张候选', () => {
    const 参数 = 选项({ environment: 'matched', environmentIssue: null, baselineManifest: 固定清单 });
    生成候选基线目录(参数);
    expect(readdirSync(参数.reviewDir).filter((名) => 名.endsWith('.png'))).toHaveLength(7);
    expect(existsSync(join(参数.reviewDir, 'environment-review.json'))).toBe(false);
  });

  it('仅渲染器版本升级时生成 review 目录与安全的旧新版本元数据', () => {
    const 旧清单: 真实后端视觉Manifest = { ...固定清单, agentBrowserVersion: '1.3.0', chromeBuild: '140.0.7000.1' };
    const 参数 = 选项({ environment: 'blocked', environmentIssue: 'renderer-version-mismatch', baselineManifest: 旧清单 });
    生成候选基线目录(参数);
    expect(readdirSync(参数.reviewDir).filter((名) => 名.endsWith('.png'))).toHaveLength(7);
    const 审阅 = JSON.parse(readFileSync(join(参数.reviewDir, 'environment-review.json'), 'utf8'));
    expect(审阅).toMatchObject({
      reason: 'renderer-version-mismatch',
      previous: { agentBrowserVersion: '1.3.0', chromeBuild: '140.0.7000.1' },
      current: { agentBrowserVersion: '1.4.0', chromeBuild: '141.0.7390.54' },
      candidateManifest: 固定清单,
    });
  });

  it('功能或 fixture 未通过一律拒绝', () => {
    expect(() => 生成候选基线目录(选项({ functionalPassed: false }))).toThrow(/功能/);
    expect(() => 生成候选基线目录(选项({ fixtureVerified: false }))).toThrow(/fixture/);
  });

  it('manifest-invalid 与 expected-file-missing 不能借更新命令绕过', () => {
    expect(() => 生成候选基线目录(选项({ environment: 'blocked', environmentIssue: 'manifest-invalid', baselineManifest: 固定清单 })))
      .toThrow(/manifest-invalid/);
    expect(() => 生成候选基线目录(选项({ environment: 'blocked', environmentIssue: 'expected-file-missing', baselineManifest: 固定清单 })))
      .toThrow(/expected-file-missing/);
  });

  it('候选缺图时拒绝并且不写出半套 review 目录', () => {
    const 参数 = 选项({});
    rmSync(join(参数.candidateDir, 'recruiter-jobs-after-create.png'));
    expect(() => 生成候选基线目录(参数)).toThrow(/recruiter-jobs-after-create/);
    expect(existsSync(参数.reviewDir)).toBe(false);
  });

  it('拒绝写入已提交基线目录', () => {
    const 参数 = 选项({ reviewDir: join('/tmp/仓库', 'e2e', '真实后端', '视觉', '基线') });
    expect(() => 生成候选基线目录(参数)).toThrow(/已提交基线/);
  });
});
