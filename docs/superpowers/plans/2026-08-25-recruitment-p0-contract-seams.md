# 招聘前端 P0 契约校准与并行接缝 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不修改前端样式、页面结构和公开 Context API 的前提下，校准 S1/S3 披露语义，并把现有招聘状态、异步操作和 HTTP 数据源按业务 owner 拆成可独立扩展的接缝。

**Architecture:** 保留单一 `应用状态提供者`、`use应用状态()`、根 action 和数据源 facade。先以测试冻结并修正 S1/S3 的用户可见事实，再将现有 HTTP 方法、Provider 操作和 reducer 分支移入静态域模块；根文件只保留显式组合、初始化和跨域机械路由。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest 4、Testing Library、现有中文领域类型和 CSS Modules（本计划禁止修改 CSS）

**Spec:** `docs/superpowers/specs/2026-08-25-recruitment-p0-contract-seams-design.md`

**Baseline:** `origin/main@c982dda3770b0b85a99432fe04662106a59aea44`，设计提交 `96d3311`

## Global Constraints

- 不修改任何 `.css` / `.module.css`、DOM 结构、导航路径或“让 AI 代理去谈”的一次点击流程。
- 不新增确认弹层、常驻授权说明、PDF 解析 UI、空 API、空业务模块或新依赖。
- Backend 请求失败绝不回退 Mock；现有 401、409、503、stale response 和 revision 行为必须保持。
- 在线简历与 PDF 是独立对象；不生成匿名 PDF。
- S1 成功后招聘方可见 PDF 原件、姓名和联系方式；S3 只记录最终意向。
- 保留 `应用状态提供者`、`use应用状态()`、`状态`、`动作`、`应用操作`、`招聘数据源选择` 和 `创建招聘数据源` 的导入路径。
- 每个重构任务先运行既有 characterization tests，再搬移逻辑，再运行相同测试。
- 每个任务独立提交；不得在机械搬移中顺手清理无关代码或改名。

---

### Task 1: 校准 S1/S3 文案、Mock 身份和 PDF 原件投影

**Files:**
- Create: `src/数据/披露契约.test.ts`
- Create: `src/屏幕/职位详情.test.tsx`
- Create: `src/组件/简历预览层.test.tsx`
- Modify: `src/数据/模拟数据.ts:485-1193,1216-1227,1350-1535`
- Modify: `src/数据/企业端模拟数据.ts:162-282,529-895,928-1625`
- Modify: `src/屏幕/用户协议.tsx:13-75`
- Modify: `src/屏幕/我的简历.tsx:145-165,292-318`
- Modify: `src/屏幕/企业详情.tsx:90-110`
- Modify: `src/屏幕/候选详情.tsx:1-110,150-255,428-505`
- Modify: `src/屏幕/企业在谈候选.tsx:255-275`
- Modify: `src/屏幕/在谈详情.tsx:440-498`
- Modify: `src/屏幕/匿名在线简历.tsx:35-205`
- Modify: `src/屏幕/企业真人会话.tsx:1-80`
- Modify: `src/组件/阶段对话流.tsx:25-65,285-320`
- Modify: `src/组件/简历预览层.tsx:1-170`
- Modify: `src/组件/图标.tsx:375-390`
- Modify: `src/屏幕/真人会话操作栏.tsx:1-60`
- Modify: `src/路由/路径表.ts:100-115`
- Modify: `src/数据/类型.ts:160-190`
- Modify: `src/屏幕/真人会话.tsx:1-60`
- Modify: `src/状态/应用状态.tsx:903-969,1062-1140`

**Interfaces:**
- Consumes: 现有 `候选.真名: string | null`、`简历原件层`、`披露四阶段`、`归约` 和单击委托 action。
- Produces: `协议正文` 具名导出；S1 已递交 Mock 的 `真名`、候选专属原件投影和 PDF 原件事实；不再由阶段名称推导身份可见性的招聘方页面。

- [ ] **Step 1: 写披露契约失败测试**

在 `src/屏幕/用户协议.tsx` 将 `协议正文` 改为具名导出，但先不改内容。创建：

```ts
import { describe, expect, it } from 'vitest';
import { 各单阶段小结, 各单阶段对话, 披露四阶段 } from './模拟数据';
import { 在谈候选列表, 各候选阶段对话 } from './企业端模拟数据';
import { 协议正文 } from '../屏幕/用户协议';

describe('招聘渐进披露契约', () => {
  it('S1 明确递交 PDF 原件并解除姓名和联系方式隐藏', () => {
    const 递交 = 披露四阶段.find((项) => 项.编号 === '递交简历');
    expect(递交?.说明).toContain('PDF 原件');
    expect(递交?.说明).toMatch(/姓名|联系方式/);
    const 协议 = JSON.stringify(协议正文);
    expect(协议).toContain('简历原件成功递交');
    expect(协议).not.toContain('意向确认后，双方身份与联系方式同时互换');
  });

  it('已递交原件的候选有真名，S0 候选仍匿名', () => {
    for (const id of ['A-01', 'A-02', 'A-03', 'B-02']) {
      const 候 = 在谈候选列表.find((条) => 条.编号 === id);
      expect(候?.真名).toBeTruthy();
      expect(候?.真名).not.toBe(候?.代号);
    }
    expect(在谈候选列表.find((候) => 候.编号 === 'A-07')?.真名).toBeNull();
  });

  it('双端 S1 附件说明和对话正文不再声称匿名或隐去联系方式', () => {
    const 企业条们 = Object.values(各候选阶段对话).flatMap((各段) => 各段.递交简历 ?? []);
    const 求职条们 = Object.values(各单阶段对话).flatMap((各段) => 各段.递交简历 ?? []);
    const 小结附件们 = Object.values(各单阶段小结)
      .flat()
      .flatMap((条) => 条.附件?.说明 ? [条.附件.说明] : []);
    const 说明们 = [...企业条们, ...求职条们]
      .flatMap((条) => 条.附件?.说明 ? [条.附件.说明] : [])
      .concat(小结附件们);
    const 正文们 = [...企业条们, ...求职条们].flatMap((条) => 条.内容 ? [条.内容] : []);
    expect(说明们.length).toBeGreaterThan(0);
    expect(说明们.every((说明) => /原件/.test(说明))).toBe(true);
    expect([...说明们, ...正文们].some((文本) => /匿名版|隐去/.test(文本))).toBe(false);
  });
});
```

- [ ] **Step 2: 运行披露契约测试，确认以旧口径失败**

Run: `npm test -- src/数据/披露契约.test.ts`

Expected: FAIL；S1 说明缺少 `PDF 原件`，协议仍写意向确认交换身份，S1/S2 Mock 的 `真名` 仍为空，附件仍写匿名版。

- [ ] **Step 3: 修改现有文字槽和 Mock 数据**

使用以下已批准口径，不新增 DOM：

```ts
// src/数据/模拟数据.ts
{ 编号: '递交简历' as const, 说明: '核过条件才递 PDF 原件，亮姓名联系方式，换完整 JD' }

// src/屏幕/用户协议.tsx（协议正文保持原数组结构）
'候选人匿名：在简历原件成功递交之前，候选人仅以代号与在线简历出现；真实姓名和联系方式不会交给招聘方。'
'简历原件成功递交后，招聘方可以查看其中的姓名与联系方式；意向确认只表示双方同意进入真人沟通与约面。'

// src/数据/企业端模拟数据.ts：S1 已完成的真名必须与匿名代号不同
'A-01': 真名 = '沈亦舟'
'A-02': 真名 = '林若衡'
'A-03': 真名 = '周承宇'
'B-02': 真名 = '许清和'
'A-07': 真名 = null

// 双端所有 S1 附件只把 说明 字段替换为以下值
说明: 'PDF 原件 · 包含姓名与联系方式'

// 放在 匿名简历表 定义之后；Mock 原件正文必须绑定对应候选，不能读取求职端全局简历
export interface 候选简历原件投影 {
  真名: string;
  手机: string;
  邮箱: string;
  经验: string;
  个人优势: string;
  经历: { 公司: string; 起止: string; 职位: string; 说明: string }[];
  教育行: string;
  教育起止: string;
}

function 建Mock原件(
  身份: Pick<候选简历原件投影, '真名' | '手机' | '邮箱'>,
  档: 匿名简历档 | undefined,
): 候选简历原件投影 {
  if (!档) throw new Error('Mock 原件缺少候选在线简历种子');
  return {
    ...身份,
    经验: 档.经验,
    个人优势: 档.自述,
    经历: 档.经历.map(({ 公司, 公司实名, 起止, 职位, 说明 }) => ({
      公司: 公司实名 ?? 公司, 起止, 职位, 说明,
    })),
    教育行: 档.教育行,
    教育起止: 档.教育起止,
  };
}

export const 候选简历原件表: Record<string, 候选简历原件投影> = {
  'A-01': 建Mock原件({ 真名: '沈亦舟', 手机: '138 0217 6021', 邮箱: 'shenyizhou@qq.com' }, 匿名简历表['A-01']),
  'A-02': 建Mock原件({ 真名: '林若衡', 手机: '139 0000 0002', 邮箱: 'ruoheng.lin@example.com' }, 匿名简历表['A-02']),
  'A-03': 建Mock原件({ 真名: '周承宇', 手机: '139 0000 0003', 邮箱: 'chengyu.zhou@example.com' }, 匿名简历表['A-03']),
  'B-02': {
    真名: '许清和', 手机: '139 0000 0004', 邮箱: 'qinghe.xu@example.com', 经验: '6 年经验',
    个人优势: '负责实时风控特征工程与策略平台建设，熟悉支付场景的实时决策链路。',
    经历: [{
      公司: '连连支付', 起止: '2020.06—至今', 职位: '高级风控算法工程师',
      说明: '建设实时特征平台与在线策略链路，支持支付风险识别和模型迭代',
    }],
    教育行: '中山大学 · 应用统计硕士', 教育起止: '2014—2017',
  },
};
```

同步替换以下旧事实，保持原文字节点：

```text
姓名（仅意向确认后披露） → 姓名（递交简历后披露）
递交简历阶段自动隐去联系方式后发送 → 初筛通过后发送 PDF 原件
双方互相披露姓名与联系方式，不可撤回 → 双方确认后进入真人沟通与约面
已确认意向，联系方式已互换 → 已确认意向，可进入真人沟通
```

`各单阶段小结`、`各单阶段对话` 和 `各候选阶段对话` 的 S1 附件与对话内容都按原件口径修改。
`候选确认意向` reducer 删除写入 `真名`/还原公司实名的分支，只更新 S3 结果文案；S1/S2 初始 Mock 已携带
真名和完整画像。同步校准 `类型.ts`、路径表和真人会话组件中把身份交换绑定到 S3 的注释，避免下一轮开发
继续按过时注释实现；这些注释修改不影响 DOM。`用户协议.tsx` 文件头“二、三、四节不可改写”同步注明：
本次二节变更由 P0 产品契约重新批准，后续仍不可自行改写。

- [ ] **Step 4: 让招聘方页面消费真实身份事实和原件**

按以下表达式替换阶段推导，不新增 helper 布尔字段：

```ts
// src/屏幕/企业在谈候选.tsx
const 显示真名 = 单.真名;

// src/屏幕/候选详情.tsx
const [看简历文件名, 设看简历文件名] = useState<string | null>(null);
const 原件投影 = 候.真名
  ? (候选简历原件表[候.编号] ?? 候选简历原件表[候.编号.split('@')[0]])
  : undefined;

<阶段对话流 点附件={设看简历文件名} />
{看简历文件名 ? (
  <简历预览层
    文件名={看简历文件名}
    候选原件={原件投影}
    匿名代号={原件投影 ? undefined : 候.代号}
    关闭={() => 设看简历文件名(null)}
  />
) : null}

// 意向确认节点
待推进说明: 名 === '意向确认' ? '双方确认后进入真人沟通与约面' : '前一阶段通过后 AI 代理自动推进'
```

`简历纸身` 和 `简历原件层` 增加可选的 `候选原件?: 候选简历原件投影`。存在时，抬头姓名、手机、邮箱、
首段职位和经验取投影；工作经历继续复用现有经历 DOM，以数组索引作 key，`起止` 整串进入时间槽、`说明`
进入内容槽，并省略原投影没有的行业行；教育继续复用现有教育 DOM，把 `教育行` 第一个 ` · ` 前的内容放学校
槽、剩余内容放学历/专业槽，`教育起止` 整串放时间槽。个人优势按现有逐行列表渲染。不得为了 Mock 原件增加
技能等新 DOM 区块；真实 PDF 内容由 P2/P5 的文件渲染替换。

不存在 `候选原件` 且传入 `匿名代号` 时继续走现有代号/打码分支；两者都不存在时仍是求职者查看自己的全局
原件。三个分支复用现有 DOM 与 CSS，不新增解释文本。`企业真人会话.tsx` 的 A-01 原件同样传入
`候选简历原件表['A-01']`，不能继续从求职端全局简历读取；未披露时仍传代号并走打码分支。

```tsx
// src/屏幕/企业真人会话.tsx
const A01原件 = A01?.真名 ? 候选简历原件表['A-01'] : undefined;
<简历纸身
  候选原件={A01原件}
  原件={A01原件 !== undefined}
  代号={A01?.代号 ?? ''}
/>
```

保留 `真名 === null` 时的代号和匿名样式。不得仅把 `匿名代号` 删除后无条件走全局 `简历纸身 原件`，否则
所有招聘方候选 PDF 都会错误显示沈亦舟。

- [ ] **Step 5: 写委托无新增确认层和原件渲染测试**

`src/屏幕/职位详情.test.tsx` mock `use应用状态`、`use导航` 和职位数据，断言一次点击直接派发并跳转：

```tsx
it('让 AI 代理去谈保持一次点击，不增加确认层', async () => {
  const 用户 = userEvent.setup();
  render(<MemoryRouter initialEntries={['/job/M-12']}><职位详情 /></MemoryRouter>);
  await 用户.click(screen.getByRole('button', { name: /让AI代理去谈/ }));
  expect(mock派发).toHaveBeenCalledWith({ 型: '委托入谈', 岗: expect.objectContaining({ 编号: 'M-12' }) });
  expect(mock替换跳转).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('同意并去谈')).toBeNull();
});
```

`src/组件/简历预览层.test.tsx` mock `use应用状态`，分别冻结候选专属原件和 S0 匿名分支：

```tsx
it('招聘方原件使用当前候选自己的身份、联系方式和履历', () => {
  render(
    <简历原件层
      文件名="顾晚舟_简历.pdf"
      候选原件={候选简历原件表['A-02']}
      关闭={vi.fn()}
    />,
  );
  expect(screen.getByText('林若衡')).toBeTruthy();
  expect(screen.getByText(/139 0000 0002/)).toBeTruthy();
  expect(screen.getByText(/11 年经验/)).toBeTruthy();
  expect(screen.getByText('九坤投资')).toBeTruthy();
  expect(screen.queryByText('沈亦舟')).toBeNull();
});

it('没有 S1 原件投影的候选仍显示代号和打码联系方式', () => {
  render(<简历原件层 文件名="苏含章_简历.pdf" 匿名代号="苏含章" 关闭={vi.fn()} />);
  expect(screen.getByText('苏含章')).toBeTruthy();
  expect(screen.getByText(/138\*\*\*\*6021/)).toBeTruthy();
  expect(screen.queryByText('沈亦舟')).toBeNull();
});
```

- [ ] **Step 6: 运行语义校准测试和静态检查**

Run:

```bash
npm test -- src/数据/披露契约.test.ts src/屏幕/职位详情.test.tsx src/组件/简历预览层.test.tsx src/状态/应用状态.test.ts
npm run typecheck
! rg -n "匿名版(原件|简历)|正式简历已递.*匿名版|简历.*隐去.*联系方式|真名与联系方式.{0,4}隐去|原件.*只在意向确认后|意向确认后.*(互换|披露|解除|必然是实名).*(身份|姓名|真名|联系方式|双盲|号码)|意向确认后.*(身份|姓名|真名|联系方式|双盲|号码).*(互换|披露|解除|必然是实名)|(已确认意向|双方已确认).*联系方式.*互换|确认后才.*(露|显示).*(真名|姓名|联系方式)" src --glob '!**/*.css'
! git status --porcelain | rg '\.css$|\.module\.css$'
git diff --check
```

Expected: 测试和类型检查全部 PASS；旧口径扫描无输出；`git status --porcelain | rg '\.css$|\.module\.css$'` 无输出。

- [ ] **Step 7: 提交语义校准**

```bash
git add src/数据/模拟数据.ts src/数据/企业端模拟数据.ts src/数据/披露契约.test.ts \
  src/屏幕/用户协议.tsx src/屏幕/我的简历.tsx src/屏幕/企业详情.tsx \
  src/屏幕/候选详情.tsx src/屏幕/企业在谈候选.tsx src/屏幕/在谈详情.tsx \
  src/屏幕/匿名在线简历.tsx src/屏幕/企业真人会话.tsx src/屏幕/真人会话.tsx \
  src/屏幕/职位详情.test.tsx src/屏幕/真人会话操作栏.tsx src/路由/路径表.ts src/数据/类型.ts \
  src/组件/阶段对话流.tsx src/组件/简历预览层.tsx src/组件/简历预览层.test.tsx \
  src/组件/图标.tsx \
  src/状态/应用状态.tsx
git commit -m "fix(recruitment): 对齐 S1 原件披露语义"
```

### Task 2: 将 HTTP 招聘数据源拆成静态域 facade

**Files:**
- Create: `src/数据/招聘数据源/会话.ts`
- Create: `src/数据/招聘数据源/目录.ts`
- Create: `src/数据/招聘数据源/简历.ts`
- Create: `src/数据/招聘数据源/意向.ts`
- Create: `src/数据/招聘数据源/岗位.ts`
- Modify: `src/数据/HTTP招聘数据源.ts`
- Modify: `src/数据/HTTP招聘数据源.test.ts`
- Test: `src/数据/接口层.test.ts`

**Interfaces:**
- Consumes: `HTTP招聘数据源依赖`、`BFF请求选项`、现有映射函数和岗位附属存储。
- Produces: `会话数据源`、`目录数据源`、`简历数据源`、`意向数据源`、`岗位数据源`；根 `HTTP招聘数据源` 为五者交集且导入路径不变。

- [ ] **Step 1: 运行当前数据源 characterization tests**

Run: `npm test -- src/数据/HTTP招聘数据源.test.ts src/数据/接口层.test.ts`

Expected: PASS。保存输出作为搬移后的行为基线。

- [ ] **Step 2: 先定义五个闭合域接口**

每个文件只导出当前已存在的方法。接口签名必须如下：

```ts
// 会话.ts
export interface 会话数据源 {
  恢复会话(): Promise<BFF当前会话>;
  开始手机登录(手机号11位: string): Promise<BFF登录尝试>;
  开始微信登录(): Promise<BFF登录尝试>;
  完成手机登录(attemptId: string, code4位: string): Promise<BFF当前会话>;
  退出登录(): Promise<void>;
  读取主体(): Promise<BFF主体>;
  确保角色(role: BFF角色): Promise<BFF主体>;
  记录当前角色(role: BFF角色): Promise<BFF主体>;
}

// 目录.ts
export interface 目录数据源 {
  查询Taxonomy(kind: 'job-categories' | 'industries' | 'majors', query: Taxonomy查询): Promise<目录页<BFFTaxonomyItem>>;
  查询Location(query: Location查询): Promise<目录页<BFFLocationItem>>;
  查询Institution(query: Institution查询): Promise<目录页<BFFInstitutionItem>>;
  清空目录缓存(): void;
}

// 简历.ts
export interface 简历数据源 {
  读取简历(): Promise<页面简历快照>;
  保存简历(next: 页面简历写入, previous: BFF简历): Promise<页面简历快照>;
}

// 意向.ts
export interface 意向数据源 {
  读取意向(): Promise<页面意向快照>;
  创建意向(draft: 意向草稿型, context: 意向映射上下文): Promise<页面意向快照>;
  创建首次意向(input: 首次意向输入): Promise<页面意向快照>;
  更新意向(id: string, draft: 意向草稿型, context: 意向映射上下文): Promise<页面意向快照>;
  删除意向(id: string, revision: number): Promise<页面意向快照>;
}

// 岗位.ts
export interface 岗位数据源 {
  读取岗位(): Promise<页面岗位快照>;
  创建岗位(job: 在招岗位, context: 岗位映射上下文): Promise<页面岗位快照>;
  更新岗位(job: 在招岗位, previous: BFFOwnerJob, context: 岗位映射上下文): Promise<页面岗位快照>;
  归档岗位(id: string, revision: number): Promise<页面岗位快照>;
  重开岗位(id: string, revision: number): Promise<页面岗位快照>;
  删除岗位(id: string, revision: number): Promise<页面岗位快照>;
}
```

为每个接口实现同名 `创建…数据源` 工厂。工厂只接收其真实依赖：会话/目录/简历/意向接收 `client.请求`；岗位额外接收 `后端环境` 和 `附属存储`。

- [ ] **Step 3: 搬移现有实现，不改变协议代码**

从 `HTTP招聘数据源.ts` 移动以下完整函数体：

```text
会话：恢复会话、开始手机登录、开始微信登录、完成手机登录、退出登录、读取主体、确保角色、记录当前角色
目录：编码查询、查询一页、查询Taxonomy、查询Location、查询Institution、清空目录缓存和目录页面缓存闭包
简历：读取简历、保存简历及其内部 diff/write helpers
意向：读取意向、创建意向、创建首次意向、更新意向、删除意向
岗位：读取岗位、创建岗位、更新岗位、归档岗位、重开岗位、删除岗位
```

不得修改 path、method、body、If-Match、幂等、分页循环或 `.catch` 行为。根文件收敛为：

```ts
export type HTTP招聘数据源 =
  & 会话数据源
  & 目录数据源
  & 简历数据源
  & 意向数据源
  & 岗位数据源;

export function 创建HTTP招聘数据源(deps: HTTP招聘数据源依赖): HTTP招聘数据源 {
  const 请求 = deps.client.请求;
  return {
    ...创建会话数据源(请求),
    ...创建目录数据源(请求),
    ...创建简历数据源(请求),
    ...创建意向数据源(请求),
    ...创建岗位数据源(请求, deps.后端环境, deps.附属存储),
  };
}
```

- [ ] **Step 4: 增加 facade 组成测试**

在 `HTTP招聘数据源.test.ts` 增加：

```ts
it('根 facade 组合五个现有域且不丢公开方法', () => {
  const source = 创建HTTP招聘数据源(依赖());
  expect(Object.keys(source).sort()).toEqual([
    '保存简历', '创建岗位', '创建意向', '创建首次意向', '删除岗位', '删除意向',
    '开始微信登录', '开始手机登录', '归档岗位', '恢复会话', '更新岗位', '更新意向',
    '查询Institution', '查询Location', '查询Taxonomy', '清空目录缓存', '确保角色',
    '读取主体', '读取岗位', '读取意向', '读取简历', '记录当前角色', '退出登录',
    '完成手机登录', '重开岗位',
  ].sort());
});
```

- [ ] **Step 5: 运行数据源测试和检查**

Run:

```bash
npm test -- src/数据/HTTP招聘数据源.test.ts src/数据/接口层.test.ts
npm run typecheck
npm run lint
```

Expected: 全部 PASS，现有测试调用次数和请求体断言不变。

- [ ] **Step 6: 提交 HTTP 域拆分**

```bash
git add src/数据/HTTP招聘数据源.ts src/数据/HTTP招聘数据源.test.ts src/数据/招聘数据源
git commit -m "refactor(recruitment): 拆分 HTTP 数据源域"
```

### Task 3: 从 Provider 提取后端会话、候选和岗位操作

**Files:**
- Create: `src/状态/后端/类型.ts`
- Create: `src/状态/后端/会话操作.ts`
- Create: `src/状态/后端/候选操作.ts`
- Create: `src/状态/后端/岗位操作.ts`
- Create: `src/状态/后端/目录查询.ts`
- Modify: `src/状态/应用状态.tsx:1567-2445`
- Modify: `src/状态/应用状态.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `HTTP招聘数据源` facade、现有 `状态/动作`、`BFF错误`、dispatch 和 mutable refs。
- Produces: `后端状态`、`应用操作` 组合类型，以及 `创建会话操作`、`创建候选操作`、`创建岗位操作`、`创建目录查询`。

- [ ] **Step 1: 增加公开操作 shape characterization test**

在 `应用状态.test.ts` 的 Provider 探针中读取 `操作`，增加：

```tsx
it('应用操作公开 shape 在拆分后保持不变', () => {
  function 探针() {
    const { 操作 } = use应用状态();
    return createElement('output', null, Object.keys(操作).sort().join('|'));
  }
  render(createElement(应用状态提供者, null, createElement(探针)));
  expect(screen.getByText([
    '保存个人优势', '保存首次意向', '保存意向', '保存简历', '删除岗位', '删除意向',
    '切身份', '发布岗位', '完成手机登录', '开始手机登录', '归档岗位', '微信登录',
    '更新岗位', '退出登录', '重开岗位',
  ].sort().join('|'))).toBeTruthy();
});
```

Run: `npm test -- src/状态/应用状态.test.ts`

Expected: PASS，作为纯重构基线。

- [ ] **Step 2: 定义操作组合和共同依赖**

`src/状态/后端/类型.ts` 使用结构 ref，避免运行时 React 依赖：

```ts
export interface 后端状态 {
  初始化: '跳过' | '进行中' | '完成';
  已登录: boolean;
  主体: BFF主体 | null;
  简历快照: BFF简历 | null;
  意向快照: Record<string, BFFOwnerIntention>;
  岗位快照: Record<string, BFFOwnerJob>;
}

export type 更新后端状态 = (更新: (旧: 后端状态) => 后端状态) => void;
export type 可变引用<T> = { current: T };

export interface 后端操作依赖 {
  是后端: boolean;
  后端: HTTP招聘数据源 | null;
  派发: (动作: 动作) => void;
  设后端状态: 更新后端状态;
  后端状态引用: 可变引用<后端状态>;
  状态引用: 可变引用<状态>;
  锁: 可变引用<Set<string>>;
  尝试引用: 可变引用<string | null>;
  主体标识引用: 可变引用<string | null>;
  会话代际: 可变引用<number>;
}

export type 应用操作 = 会话操作 & 候选操作 & 岗位操作;
```

三个子接口的方法签名逐字复制现有 `应用操作`，按会话、候选（简历+意向）和岗位分组。

- [ ] **Step 3: 提取会话和统一清理逻辑**

将 `空BFF简历`、三个空快照、`是会话失效错误`、`清账号状态`、`水合角色数据` 及登录/退出/切身份方法移动到 `会话操作.ts`。导出：

```ts
export function 清账号状态(deps: Pick<后端操作依赖,
  '派发' | '设后端状态' | '后端' | '主体标识引用' | '会话代际'>): void;

export async function 水合角色数据(
  deps: Pick<后端操作依赖,
    '后端' | '派发' | '设后端状态' | '主体标识引用' | '会话代际'> & { 后端: HTTP招聘数据源 },
  主体: BFF主体,
  交互: boolean,
): Promise<boolean>;

export function 创建会话操作(deps: 后端操作依赖): 会话操作;
```

重复的退出清理调用统一复用 `清账号状态`，但保持 `尝试引用.current = null` 和 `invalid_session` 视同成功。

- [ ] **Step 4: 提取候选、岗位和目录操作**

`候选操作.ts` 移入 `处理写入错误`、`处理意向写入错误`、`意向说明`，以及 `保存简历`、`保存个人优势`、
`保存意向`、`保存首次意向`、`删除意向`。`岗位操作.ts` 移入 `处理岗位写入错误`，以及 `发布岗位`、
`更新岗位`、`归档岗位`、`重开岗位`、`删除岗位`。导出：

```ts
export function 创建候选操作(deps: 后端操作依赖): 候选操作;
export function 创建岗位操作(deps: 后端操作依赖): 岗位操作;
```

`目录查询.ts` 完整保留会话代际守卫：

```ts
export type 目录查询 = Pick<HTTP招聘数据源,
  '查询Location' | '查询Taxonomy' | '查询Institution'>;

export function 创建目录查询(deps: Pick<后端操作依赖,
  '是后端' | '后端' | '派发' | '设后端状态' | '主体标识引用' | '会话代际'>): 目录查询 | null;
```

- [ ] **Step 5: 根 Provider 只组合现有操作**

保留 persistence effects 和 mount 恢复 effect；mount effect 调用导出的 `水合角色数据`。`useMemo` 改为：

```ts
const 操作 = useMemo<应用操作>(
  () => {
    const deps: 后端操作依赖 = {
      是后端, 后端, 派发, 设后端状态, 后端状态引用, 状态引用, 锁,
      尝试引用, 主体标识引用, 会话代际,
    };
    return {
      ...创建会话操作(deps),
      ...创建候选操作(deps),
      ...创建岗位操作(deps),
    };
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [是后端, 后端],
);

const 目录查询 = useMemo(
  () => 创建目录查询({
    是后端, 后端, 派发, 设后端状态, 主体标识引用, 会话代际,
  }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [是后端, 后端],
);
```

若 lint 要求稳定依赖，不把整个对象加入 dependency array；工厂只捕获与当前实现相同的稳定 ref 和 React setter。

- [ ] **Step 6: 运行 Provider 全量测试**

Run:

```bash
npm test -- src/状态/应用状态.test.ts src/数据/接口层.test.ts
npm run typecheck
npm run lint
```

Expected: 所有 session restore、401 清理、stale 401、角色切换、水合、写锁、409/503 重读测试 PASS；公开操作 shape 不变。

- [ ] **Step 7: 提交 Provider 操作拆分**

```bash
git add src/状态/应用状态.tsx src/状态/应用状态.test.ts src/状态/后端
git commit -m "refactor(recruitment): 拆分 Provider 后端操作"
```

### Task 4: 提取候选资料、组织岗位和隐私设置 reducer

**Files:**
- Create: `src/状态/领域/候选资料.ts`
- Create: `src/状态/领域/组织岗位.ts`
- Create: `src/状态/领域/隐私设置.ts`
- Modify: `src/状态/应用状态.tsx:120-360,693-830,830-1565`
- Modify: `src/状态/应用状态.test.ts`

**Interfaces:**
- Consumes: 根 `状态` 的 flat shape 和现有 action payload。
- Produces: `候选资料状态/动作/归约候选资料`、`组织岗位状态/动作/归约组织岗位`、`隐私设置状态/动作/归约隐私设置`；页面继续从根模块导入联合 `动作`。

- [ ] **Step 1: 为三个域增加 direct reducer characterization 表**

在 `应用状态.test.ts` 为每个将搬移的域增加一个确定结果断言；不能只断言“状态发生了变化”：

```ts
it('候选资料 action 冻结具体结果', () => {
  expect(归约(初始状态, { 型: '存个人优势', 文本: '新的介绍' }).个人优势).toBe('新的介绍');
});

it('组织岗位 action 冻结具体结果', () => {
  const 下一 = 归约(初始状态, {
    型: '存企业认证', 姓名: '陆知遥', 公司: '示例科技', 职务: '招聘经理',
  });
  expect(下一.企业认证).toEqual({ 姓名: '陆知遥', 公司: '示例科技', 职务: '招聘经理' });
});

it('隐私设置 action 冻结具体结果', () => {
  const 下一 = 归约(初始状态, { 型: '拉黑', 名称: '示例公司' });
  expect(下一.屏蔽名单[0]).toEqual({
    编号: 'B-04', 名称: '示例公司', 首字: '示', 理由: '你手动加入 · 双向不可见', 时间: '刚刚',
  });
});
```

Run: `npm test -- src/状态/应用状态.test.ts`

Expected: PASS。

- [ ] **Step 2: 定义三个域的状态和 action 子联合**

精确归属如下：

```text
候选资料与意向：当前意向、求职意向表、意向草稿、后端意向服务端、简历经历/教育/技能/证书、
个人优势、作品集、基本信息、引导预填、简历文件名、求职头像；相关意向/简历/onboarding/水合 action。

组织与岗位：岗位列表、当前岗位编号、公司自述、企业认证、招聘头像、公司 LOGO；
更新/停止/重开/删除岗位、水合岗位和公司资料 action。`发布岗位` 与 `切当前岗位` 分别跨越多个域，
保留在根 reducer，不进入组织岗位 action。

隐私与设置：屏蔽名单、披露偏好、企业披露策略、两端设置开关、两端飞书接入；
拉黑/解除、披露档、设置开关和飞书 action。
```

每个文件导出闭合状态接口、闭合 action 子联合和 reducer；`状态` 必须是 type-only import。候选资料接口的
字段和类型按下列定义，组织岗位与隐私设置接口按本步骤上一段列出的字段从根接口原样移动：

```ts
export interface 候选资料状态 {
  当前意向: string;
  求职意向表: 求职意向[];
  意向草稿: 意向草稿型;
  后端意向服务端: Record<string, BFFOwnerIntention>;
  简历经历: 简历经历段[];
  简历教育: 简历教育段[];
  简历技能: string[];
  个人优势: string;
  简历作品集链接: string;
  简历证书: 简历证书[];
  基本信息: 基本信息;
  引导预填: {
    城市们: string[];
    职位: string[];
    城市引用们?: 目录选择值[];
    职位引用们?: 目录选择值[];
    筛选偏好?: 求职初筛偏好;
    薪资?: { 下限: number; 上限: number; 单位?: 求职薪资单位 };
    到岗?: string;
  } | null;
  简历文件名: string;
  求职头像: string | null;
}

export type 候选资料动作 =
  | { 型: '改意向'; 编号: string; 标题: string; 说明: string }
  | { 型: '删意向'; 编号: string }
  | { 型: '新增意向'; 标题: string; 说明: string }
  | { 型: '开意向草稿'; 编号: string | null }
  | { 型: '改意向草稿'; 补丁: Partial<意向草稿型> }
  | { 型: '清意向草稿' }
  | { 型: '存简历'; 经历: 简历经历段[]; 教育: 简历教育段[]; 技能: string[]; 证书: 简历证书[]; 基本信息: 基本信息 }
  | { 型: '存个人优势'; 文本: string }
  | { 型: '存作品集链接'; 链接: string }
  | { 型: '存简历文件名'; 文件名: string }
  | { 型: '存求职头像'; 图: string | null }
  | { 型: '存引导预填'; 城市们: string[]; 职位: string[]; 城市引用们: 目录选择值[]; 职位引用们: 目录选择值[] }
  | {
      型: '启程引导';
      城市们: string[];
      职位: string[];
      筛选偏好: 求职初筛偏好;
      城市引用们?: 目录选择值[];
      职位引用们?: 目录选择值[];
    }
  | { 型: '存求职筛选偏好'; 偏好: 求职初筛偏好 }
  | { 型: '存薪资预填'; 下限: number; 上限: number; 单位: 求职薪资单位 }
  | { 型: '存到岗预填'; 到岗: string }
  | { 型: '水合后端简历'; 快照: 页面简历快照 }
  | { 型: '水合后端意向'; 快照: 页面意向快照 }
  | { 型: '清后端草稿' };

export type 候选资料归约 = (旧: 状态, 动作: 候选资料动作) => 状态;
```

实现导出的 `归约候选资料: 候选资料归约` 时，把 `候选资料动作` 联合列出的 19 个 action 的完整 case body 移入
闭合 switch；组织岗位和隐私设置同样只移动本步骤精确列出的 action。不得重写表达式或改变返回字段。

`切意向` 同时修改候选域的 `当前意向` 和 MatchCase 域的 `在谈范围`，因此不放进候选资料 action，保留在根
`归约跨域`。这不是为未来预留的抽象，而是基线 reducer 已经存在的真实双域写入。

把候选 action case 真实依赖的 `造意向编号`、`空意向草稿`、`拆意向为草稿`、`选新当前意向` 和
`取意向名` 一起移到 `候选资料.ts`；根模块从该文件导入，并继续 `export { 取意向名 }`，保证
`顶部意向栏.tsx` 与 `在谈首页.tsx` 的既有导入路径不变。把 `选新当前岗` 移到 `组织岗位.ts` 并供根初始状态
和跨域 case 使用。不得让域文件从根模块运行时 import helper。

`组织岗位.ts` 和 `隐私设置.ts` 使用同一签名。每个 switch 必须有 exhaustive `default`：

```ts
default: {
  const 不可能: never = 动作;
  return 不可能;
}
```

- [ ] **Step 3: 根类型和 reducer 显式组合三个域**

从根 `状态` 接口删除已经搬入三个状态接口的字段，并改为 `extends 候选资料状态, 组织岗位状态,
隐私设置状态`；发现推荐、MatchCase、Agent 规则、消息和导航字段继续逐字留在根接口。根 `动作` 联合先加入
三个域 action，尚未搬移的 action 成员继续逐字保留。Task 5 尚未创建的四个域不得在本任务中以空类型或空文件
占位。根 switch 对本任务 action 使用
显式 case group：

```ts
case '存简历':
case '存个人优势':
case '水合后端简历':
  return 归约候选资料(旧, 动作);
```

对 action 清单逐项列出 case，不使用数组 `.includes` 或字符串 registry。

- [ ] **Step 4: 运行 reducer 和全量 TypeScript 测试**

Run:

```bash
npm test -- src/状态/应用状态.test.ts
npm run typecheck
npm run lint
```

Expected: characterization test 与所有既有 reducer/Provider 测试 PASS，无运行时循环依赖。

- [ ] **Step 5: 提交第一组 reducer 域**

```bash
git add src/状态/应用状态.tsx src/状态/应用状态.test.ts src/状态/领域/候选资料.ts src/状态/领域/组织岗位.ts src/状态/领域/隐私设置.ts
git commit -m "refactor(recruitment): 拆分资料岗位隐私状态域"
```

### Task 5: 提取发现、MatchCase、Agent 规则和消息 reducer

**Files:**
- Create: `src/状态/领域/发现推荐.ts`
- Create: `src/状态/领域/MatchCase.ts`
- Create: `src/状态/领域/Agent规则.ts`
- Create: `src/状态/领域/消息.ts`
- Modify: `src/状态/应用状态.tsx`
- Modify: `src/状态/应用状态.test.ts`

**Interfaces:**
- Consumes: Task 4 的根联合与显式路由模式。
- Produces: 七个完整业务域的 state/action/reducer 所有权；根 reducer 只保留导航与确有现实依据的跨域编排。

- [ ] **Step 1: 增加第二组 characterization tests**

```ts
it('发现推荐 action 冻结具体结果', () => {
  expect(归约(初始状态, { 型: '切收藏候选', 编号: 'A-01' }).收藏候选).toEqual(['A-01']);
});

it('MatchCase action 冻结决策和阶段推进', () => {
  const 下一 = 归约(初始状态, { 型: '接受方案', 编号: 'J-02' });
  expect(下一.决策['J-02']).toBe('接受');
  expect(下一.在谈列表.find((单) => 单.编号 === 'J-02')?.阶段).toBe('意向确认');
});

it('Agent 规则 action 冻结新规则内容', () => {
  const 下一 = 归约(初始状态, { 型: '新增规则', 内容: '不接受大小周', 来源: '测试' });
  expect(下一.全局规则.at(-1)).toEqual({
    编号: 'R-06', 内容: '不接受大小周', 来源: '测试', 生效: true,
  });
});

it('消息 action 删除真实存在的未读键', () => {
  const 下一 = 归约(初始状态, { 型: '读消息', 编号: 'X-01' });
  expect(初始状态.消息未读['X-01']).toBe(4);
  expect(下一.消息未读['X-01']).toBeUndefined();
});
```

Run: `npm test -- src/状态/应用状态.test.ts`

Expected: PASS。

- [ ] **Step 2: 按精确所有权搬移状态和 action**

```text
发现推荐：已委托、已接触推荐、推荐列表、不感兴趣岗位、收藏候选、不合适候选；
委托代理/不感兴趣/收藏/不合适/撤销/补给 action。

MatchCase：在谈列表、两端视图档、双方决策与快照、企业候选列表、叮嘱表、两端归档；
两端视图、接受/退出/终止/确认、加叮嘱 action。

Agent规则：全局规则、意向级规则、企业规则；两端规则 CRUD/开关 action。

消息：消息未读、企业消息未读；两端读消息 action。
```

`造规则编号` 随规则 case 移入 `Agent规则.ts`；它没有其他消费者，不建立共享 utils 文件。

各文件使用 Task 4 的闭合 action + exhaustive switch 形状。`发布岗位` 当前会同时写岗位和播种候选/推荐，
`委托入谈` 同时写 `已委托` 与 `在谈列表`，`接触推荐候选` 同时写 `已接触推荐` 与 `企业候选列表`；三者
都保留在根 `归约跨域`，完整保留现有 case body。`切意向`、`切当前岗位`、`看全部在谈`、`企业看全部在谈`
也继续保留在根，因为它们分别同时写导航/资料/岗位与 MatchCase 字段。不要让任一业务域 import 另一个业务域。

- [ ] **Step 3: 收敛根 reducer**

根 `归约` 最终只保留：

```text
页面导航/Tab/身份视图 action 的简单字段切换
发布岗位、委托入谈、接触推荐候选、切意向、切当前岗位、看全部在谈、企业看全部在谈的既有跨域编排
七组显式 action case → 对应域 reducer
default → 返回旧状态
```

此时才把根状态收敛成最终组合，避免 Task 4 引用尚不存在的类型：

```ts
export interface 状态 extends 候选资料状态, 组织岗位状态, 隐私设置状态,
  发现推荐状态, MatchCase状态, Agent规则状态, 消息状态 {
  子视图: 子视图;
  当前Tab: 底部Tab;
  企业子视图: '在谈' | '推荐';
  企业Tab: '人才' | '消息' | '我的';
}
```

根 `动作` 联合由七个域 action，加上仍在根处理的导航/跨域 action 的现有对象成员组成；不要为这些只由根消费
一次的 action 再建 `导航动作` 或 `跨域动作` 别名。

根 action 继续从 `应用状态.tsx` 导出，页面 import 不变。删除已搬移的重复 case body，不保留 shadow reducer。

- [ ] **Step 4: 运行状态层与页面单测**

Run:

```bash
npm test -- src/状态/应用状态.test.ts src/屏幕/职位详情.test.tsx src/组件/简历预览层.test.tsx
npm run typecheck
npm run lint
```

Expected: 全部 PASS；根 `应用状态.tsx` 不再包含任一域的大段业务 case body。

- [ ] **Step 5: 提交第二组 reducer 域**

```bash
git add src/状态/应用状态.tsx src/状态/应用状态.test.ts src/状态/领域
git commit -m "refactor(recruitment): 拆分接洽发现规则消息状态域"
```

### Task 6: 全量回归、结构审计与交付记录

**Files:**
- No source changes expected; any source failure returns to its owning Task 1–5
- No CSS changes permitted

**Interfaces:**
- Consumes: Tasks 1–5 的稳定 root facade、Provider API 和七个业务域。
- Produces: 可供 P1/P2/P3/P4/P5/P6/P7 分别扩展的前端 P0 基线。

- [ ] **Step 1: 扫描被批准删除的旧口径**

Run:

```bash
! rg -n "匿名版(原件|简历)|正式简历已递.*匿名版|简历.*隐去.*联系方式|真名与联系方式.{0,4}隐去|原件.*只在意向确认后|意向确认后.*(互换|披露|解除|必然是实名).*(身份|姓名|真名|联系方式|双盲|号码)|意向确认后.*(身份|姓名|真名|联系方式|双盲|号码).*(互换|披露|解除|必然是实名)|(已确认意向|双方已确认).*联系方式.*互换|确认后才.*(露|显示).*(真名|姓名|联系方式)" src --glob '!**/*.css'
```

Expected: 无输出。若命中则回到 Task 1 修改并追加到 Task 1 的语义校准提交；薪资在意向确认后由真人决定的合法文案不删除。

- [ ] **Step 2: 审计无视觉和依赖变化**

Run:

```bash
! git diff origin/main...HEAD --name-only | rg '\.css$|\.module\.css$|package-lock\.json$|package\.json$'
```

Expected: 无输出。

- [ ] **Step 3: 运行完整前端验证**

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

Expected:

```text
TypeScript: exit 0
oxlint: exit 0
Vitest: 全部测试文件 PASS
Vite build: exit 0
git diff --check: 无输出
```

- [ ] **Step 4: 查看提交和工作树**

Run:

```bash
git status --short --branch
git log --oneline --decorate origin/main..HEAD
```

Expected: 工作树干净；设计提交后依次存在 Task 1–5 的五个实现提交。
