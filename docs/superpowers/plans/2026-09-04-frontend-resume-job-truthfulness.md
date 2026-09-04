# 简历与岗位匹配真实性 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正未填工作年和资料完整度的事实口径，并让岗位 `none` 约束不再生成“简历缺失”核对行或不存在的 Agent 操作暗示。

**Architecture:** 复用并收紧 `折算工作年限`，在简历页增加一个可测试的纯完整度函数；P4 映射把 strict enum 的 `none` 投影为 nullable 对齐事实，但市场卡仍显示“不限”。匹配生成器只处理非 null 约束，通用缺证据文案保持事实性。

**Tech Stack:** TypeScript、React 18、Vitest、Testing Library。

**Spec:** `docs/superpowers/specs/2026-09-04-frontend-truthfulness-route-state-repair-design.md`

## Global Constraints

- 开始前完整阅读 `CLAUDE.md`、`AGENTS.md` 和 Spec。
- `experience_requirement` 与 `education_requirement` 是现有 BFF strict enum；不得接收或透传未知字符串。
- `none` 只表示无约束：市场卡可以显示“不限”，对齐链不得生成缺失/不满足行。
- 不从自由文本 JD 推断条件，不修改 wire DTO、适配分来源或 `structured_requirements_confirmed` gate。
- Backend 不得出现“AI代理诊断”或“在下方告诉代理即可补上”；Mock 手工旗舰分析可保持。
- 不修改简历写入、附件或 parser 合同。
- 每个 Task 严格执行 red → green → commit。

---

### Task 1: 收紧工作年限纯函数并供简历页复用

**Files:**
- Create: `src/数据/匹配对齐.test.ts`
- Modify: `src/数据/匹配对齐.ts`
- Modify: `src/屏幕/我的简历.tsx`
- Modify: `src/屏幕/我的简历.test.tsx`

**Interfaces:**
- Consumes: `基本信息.开始工作年` string。
- Produces: `折算工作年限(开始工作年: string, currentYear?: number): number | null`。

- [ ] **Step 1: 写纯函数和页面失败测试**

```ts
describe('折算工作年限', () => {
  it.each([
    ['', 2026, null],
    ['abc', 2026, null],
    ['0', 2026, null],
    ['2024.5', 2026, null],
    ['2027', 2026, null],
    ['2026', 2026, 0],
    ['2018', 2026, 8],
  ] as const)('%s / %i → %s', (input, currentYear, expected) => {
    expect(折算工作年限(input, currentYear)).toBe(expected);
  });
});
```

页面以非学生身份分别给空、非法、未来和正常年份；前三类必须显示“未填写”，不得出现当前年或“0 年”。当前年合法输入应显示“0 年 · 自 2026 年起”。在校仍显示“应届 · 在校”。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/数据/匹配对齐.test.ts src/屏幕/我的简历.test.tsx
```

Expected: 小数/未来值当前被夹成 0；简历页用当前年伪造文本。

- [ ] **Step 3: 修改纯函数与页面投影**

```ts
export function 折算工作年限(
  开始工作年: string,
  currentYear = new Date().getFullYear(),
): number | null {
  const 年 = Number(开始工作年);
  if (!开始工作年 || !Number.isFinite(年) || !Number.isInteger(年) ||
      年 <= 0 || 年 > currentYear) return null;
  return currentYear - 年;
}
```

`我的简历.tsx` 导入函数并删除本地 `Math.max`：

```tsx
const 折算年限 = 折算工作年限(基本.开始工作年);
const 工作年限文案 = 基本.身份 === '在校'
  ? '应届 · 在校'
  : 折算年限 === null
    ? '未填写'
    : 折算年限 + ' 年 · 自 ' + 基本.开始工作年 + ' 年起';
```

- [ ] **Step 4: 运行并提交**

```bash
npx vitest run src/数据/匹配对齐.test.ts src/屏幕/我的简历.test.tsx src/屏幕/职位详情.test.tsx
git add src/数据/匹配对齐.ts src/数据/匹配对齐.test.ts src/屏幕/我的简历.tsx src/屏幕/我的简历.test.tsx
git commit -m "fix: stop inventing candidate work years"
```

Expected: PASS；职位详情仍使用同一折算语义。

### Task 2: 把资料完整度拆成待补全与可提升

**Files:**
- Modify: `src/屏幕/我的简历.tsx`
- Modify: `src/屏幕/我的简历.test.tsx`

**Interfaces:**
- Consumes: 现有 `基本信息`、`简历经历`、`简历教育`、`简历技能`、`简历证书`。
- Produces: `检查资料完整度(input): { 待补全: 完整度项[]; 可提升: 完整度项[] }`。

- [ ] **Step 1: 写纯矩阵失败测试**

从 `数据/类型` 导入现有类型，直接调用导出的页面纯函数。至少覆盖：

```ts
const 教育样本: 简历教育段 = {
  编号: 'edu_1', 学校: '示例大学', 学历: '本科', 专业: '计算机',
  开始: '2016-09', 结束: '2020-06',
};

function 造经历(count: number): 简历经历段[] {
  return Array.from({ length: count }, (_, index) => ({
    编号: `exp_${index}`, 公司: '示例公司', 行业: '软件', 职位: '工程师',
    开始: '2020-01', 结束: '2022-01', 内容: '负责平台开发', 隐藏: false,
    项目: [{ 编号: `project_${index}`, 名称: '平台', 角色: '开发', 结果: '按期上线' }],
  }));
}

function 造证书(count: number): 简历证书[] {
  return Array.from({ length: count }, (_, index) => ({
    编号: `cert_${index}`, 名称: '示例证书', 年份: '2024',
  }));
}

it.each([
  ['在校', 0, 0, 0],
  ['在职', 0, 0, 1],
  ['离职', 1, 0, 0],
] as const)('%s + %i 段经历 + %i 证书', (身份, 经历数, 证书数, 工作缺口数) => {
  const result = 检查资料完整度({
    基本信息: { 真名: '张三', 开始工作年: 身份 === '在校' ? '' : '2020', 身份 },
    经历: 造经历(经历数),
    教育: [教育样本],
    技能: ['TypeScript'],
    证书: 造证书(证书数),
  });
  expect(result.待补全.filter((项) => /工作/.test(项.文案))).toHaveLength(工作缺口数);
  expect(result.待补全.some((项) => /证书/.test(项.文案))).toBe(false);
  expect(result.可提升.some((项) => /证书/.test(项.文案))).toBe(证书数 === 0);
});
```

另钉：已有经历内容为空进入待补全；至少一段经历且所有项目为空进入可提升；技能 0 是待补全，技能 1/4/5 都不因数量产生提示；证书永不增加待补全计数。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/屏幕/我的简历.test.tsx
```

Expected: 当前只有单数组、证书计入待补全、少于 5 个技能产生无合同结论、非学生零经历未提示。

- [ ] **Step 3: 实现纯函数**

```ts
export interface 完整度项 {
  文案: string;
  去处: string;
}

export function 检查资料完整度(input: {
  基本信息: 基本信息类型;
  经历: readonly 简历经历段[];
  教育: readonly 简历教育段[];
  技能: readonly string[];
  证书: readonly 简历证书[];
}): { 待补全: 完整度项[]; 可提升: 完整度项[] } {
  const 待补全: 完整度项[] = [];
  const 可提升: 完整度项[] = [];
  if (input.基本信息.真名.trim() === '') {
    待补全.push({ 文案: '姓名还没填写', 去处: 路径.基本信息 });
  }
  if (input.基本信息.身份 !== '在校' &&
      折算工作年限(input.基本信息.开始工作年) === null) {
    待补全.push({ 文案: '开始工作年还没正确填写', 去处: 路径.基本信息 });
  }
  if (input.基本信息.身份 !== '在校' && input.经历.length === 0) {
    待补全.push({ 文案: '工作经历还没填写', 去处: 路径.工作经历 });
  }
  const 缺内容 = input.经历.filter((段) => 段.内容.trim() === '').length;
  if (缺内容 > 0) {
    待补全.push({ 文案: 缺内容 + ' 段工作经历还没写工作内容', 去处: 路径.工作经历 });
  }
  if (input.教育.length === 0) {
    待补全.push({ 文案: '教育经历还没填写', 去处: 路径.工作经历 });
  }
  if (input.技能.length === 0) {
    待补全.push({ 文案: '专业技能还没填写', 去处: 路径.工作经历 });
  }
  if (input.经历.length > 0 && input.经历.every((段) => (段.项目 ?? []).length === 0)) {
    可提升.push({ 文案: '可以补充关键项目', 去处: 路径.工作经历 });
  }
  if (input.证书.length === 0) {
    可提升.push({ 文案: '如有资格证书，可以补充（选填）', 去处: 路径.工作经历 });
  }
  return { 待补全, 可提升 };
}
```

补齐 `简历经历段`、`简历教育段`、`简历证书` 的 type-only imports。

- [ ] **Step 4: 按模式渲染标题与两类计数**

Backend 标题只按 `待补全.length` 显示“资料完整度检查 · N 处待补全”或“资料已补全”；展开区先渲染“待补全”，再渲染“可提升建议”。证书只在后者。Mock 可继续用“AI代理诊断”和现有原型标题，但不得让 Mock 的五技能阈值进入 Backend 结果。

```tsx
const 完整度 = 检查资料完整度({
  基本信息: 全局.基本信息,
  经历: 经历列表,
  教育: 全局.简历教育,
  技能: 全局.简历技能,
  证书: 全局.简历证书,
});
const Backend诊断项 = [...完整度.待补全, ...完整度.可提升];
```

- [ ] **Step 5: 运行并提交**

```bash
npx vitest run src/屏幕/我的简历.test.tsx src/数据/匹配对齐.test.ts
git add src/屏幕/我的简历.tsx src/屏幕/我的简历.test.tsx
git commit -m "fix: separate resume gaps from suggestions"
```

Expected: PASS。

### Task 3: 把岗位 `none` 投影为 nullable 对齐事实

**Files:**
- Modify: `src/数据/招聘数据源类型.ts`
- Modify: `src/数据/发现推荐映射.ts`
- Modify: `src/数据/发现推荐映射.test.ts`
- Modify: `src/数据/匹配对齐.ts`
- Modify: `src/数据/匹配对齐.test.ts`
- Modify: `src/屏幕/职位详情.test.tsx`

**Interfaces:**
- Consumes: strict `BFF经验要求`、`BFF学历要求`。
- Produces: `P4岗位事实.经验要求: string | null`、`学历要求: string | null`；`none → null`。

- [ ] **Step 1: 写映射与对齐失败测试**

替换当前通过类型逃逸测试未知 code 的用例，改成：

```ts
it.each([
  ['none', 'none', null, null],
  ['none', 'bachelor', null, '本科'],
  ['three_to_five_years', 'none', '3-5 年', null],
  ['three_to_five_years', 'bachelor', '3-5 年', '本科'],
] as const)('经验=%s 学历=%s 投影 nullable 事实', (experience, education, expText, eduText) => {
  const view = 从P4CandidateJob({
    ...BFFCandidateJob样本,
    experience_requirement: experience,
    education_requirement: education,
  });
  expect(view.岗位事实.经验要求).toBe(expText);
  expect(view.岗位事实.学历要求).toBe(eduText);
  expect(view.卡.经验要求).toBe(experience === 'none' ? '不限' : '3-5 年');
});
```

`匹配对齐.test.ts` 用同样四种组合调用 `求职侧对齐行`，断言 null 项不生成核对行；两个约束均 null 时硬性行数为 0。职位详情 Backend 推荐态断言 DOM 不含“经验 不限”“学历 不限”或“简历未提及”。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/数据/发现推荐映射.test.ts src/数据/匹配对齐.test.ts src/屏幕/职位详情.test.tsx
```

Expected: `none` 当前进入“不限”对齐事实并生成误导行。

- [ ] **Step 3: 修改类型、注释与闭合映射**

```ts
export interface P4岗位事实 {
  城市: string;
  办公方式: '现场' | '混合' | '全远程';
  办公地点: string | null;
  年薪月数: number | null;
  经验要求: string | null;
  学历要求: string | null;
  结构化要求已确认: boolean;
}

const 经验要求 = job.experience_requirement === 'none'
  ? null
  : 经验要求文案[job.experience_requirement];
const 学历要求 = job.education_requirement === 'none'
  ? null
  : 学历要求文案[job.education_requirement];
```

删除“开放字符串/未知码透传”注释和 `as keyof ... ?? wire` fallback。`建卡` 仍用闭合表把 `none` 显示“不限”。`求职侧对齐行` 的源类型改为 `经验要求?: string | null; 学历要求?: string | null`；现有 truthy gate 即可跳过 null，但新增测试必须冻结语义。

- [ ] **Step 4: 运行并提交**

```bash
npx vitest run src/数据/发现推荐映射.test.ts src/数据/匹配对齐.test.ts src/屏幕/职位详情.test.tsx
git add src/数据/招聘数据源类型.ts src/数据/发现推荐映射.ts src/数据/发现推荐映射.test.ts src/数据/匹配对齐.ts src/数据/匹配对齐.test.ts src/屏幕/职位详情.test.tsx
git commit -m "fix: treat absent job requirements as unconstrained"
```

Expected: PASS。

### Task 4: 删除通用缺证据文案中的假 Agent 入口

**Files:**
- Modify: `src/数据/匹配对齐.ts`
- Modify: `src/数据/匹配对齐.test.ts`
- Modify: `src/屏幕/职位详情.test.tsx`

**Interfaces:**
- Consumes: `对齐行[]`。
- Produces: `求职匹配分析` 的事实性 missing copy；不改变行状态或分数。

- [ ] **Step 1: 写三态失败测试**

```ts
it('未提及时只说明简历未提及', () => {
  const result = 求职匹配分析([
    { 要求: 'Go 主栈', 证据: null, 态: '未提及', 类: '必须' },
  ]);
  expect(result?.灰句).toBe('Go 主栈简历未提及。');
  expect(result?.灰句).not.toContain('下方');
  expect(result?.灰句).not.toContain('代理');
});
```

再覆盖“有证据”“不满足”输出和 `算适配分` 不变。Mock `M-11` 手工分析仍保留既有原型文案；Backend 职位详情不得出现该操作暗示。

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/数据/匹配对齐.test.ts src/屏幕/职位详情.test.tsx
```

Expected: generic missing copy 含“在下方告诉代理即可补上”。

- [ ] **Step 3: 最小修改 generic 文案**

```ts
if (未提及们.length) 灰段们.push(未提及们.join('、') + '简历未提及');
```

不要修改 `手工分析表`，不要增加职位详情 Agent 输入或编辑 CTA。

- [ ] **Step 4: 运行并提交**

```bash
npx vitest run src/数据/匹配对齐.test.ts src/屏幕/职位详情.test.tsx
git add src/数据/匹配对齐.ts src/数据/匹配对齐.test.ts src/屏幕/职位详情.test.tsx
git commit -m "fix: remove nonexistent match analysis action"
```

Expected: PASS。

### Task 5: 运行本 Plan 联合验证

**Files:**
- Test: all files changed by this Plan

**Interfaces:**
- Consumes: Tasks 1–4。
- Produces: 简历、P4 映射、对齐和职位详情同口径证据。

- [ ] **Step 1: 运行定向测试与静态检查**

```bash
npx vitest run   src/屏幕/我的简历.test.tsx   src/数据/发现推荐映射.test.ts   src/数据/匹配对齐.test.ts   src/屏幕/职位详情.test.tsx
npm run typecheck
npm run lint
```

Expected: 全部 PASS / exit 0。

- [ ] **Step 2: 检查范围**

```bash
git diff --check
git status --short
```

Expected: 无未提交文件；未修改 BFF decoder、自由文本 JD、简历写入或 CSS。

## Plan Completion Check

- [ ] 空/非法/小数/未来工作年均显示“未填写”，当前年合法显示 0 年。
- [ ] 学生工作经历豁免只看 `身份 === '在校'`。
- [ ] 证书只计可提升，少量技能不再触发阈值结论。
- [ ] 岗位 `none` 不生成经验/学历对齐行，卡片仍显示“不限”。
- [ ] Backend missing copy 无不存在的 Agent 操作，适配分与三态不变。
