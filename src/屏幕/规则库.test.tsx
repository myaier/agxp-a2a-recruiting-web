// P6 Task 6：规则库（候选 canonical 页）双模式契约。
// Backend 分支：角色水合门控（规则行/计数等 rules 成功；创建/编辑/确认/放弃控件与提案卡
// 等 rules+proposals 双成功；失败出「规则加载失败，重试」；进行中出 role="status" 加载壳，
// 已成功的域保持在屏）、权威意向分组（孤儿意向 fail closed）、范围选择无自由文本项、
// 替换提案在确认前保留旧 Rule、删除按当前 ID、七条冻结错误文案、失败保留草稿/范围/卡片、
// composing Enter 不提交。Mock 分支：既有清单、来源文案与同步动作保持不变。
// 测试宿主：真实 应用状态提供者 + 后端桩（同 应用状态.test.ts 的 Context 宿主），
// 另加两个镜头缝（不替换 Provider，真实 reducer/操作层照常运行）：
//   · 操作 逐方法包成 vi.fn 透传 —— 页面仍调真实操作，断言与 mockImplementation 打在间谍上；
//   · setHydration(next) 直写镜头里的 角色水合阶段 并触发页面重渲染 ——
//     供「重试进度/完成」这类时序断言在首帧就成立（真实状态由挂载水合并发收敛到同一场景）。
// 注：仓库未装 @testing-library/jest-dom，不用 toBeInTheDocument；
// 用 getByText/getByRole（找不到即抛）+ toBeTruthy，queryBy* 缺席断言为 null。

import { useLayoutEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 应用状态提供者 } from '../状态/应用状态';
import type { 动作, 应用操作, 后端状态 } from '../状态/应用状态';
import type { 状态 } from '../状态/应用状态';
import type { Agent规则角色水合状态 } from '../状态/后端/类型';
import { 映射候选Agent规则 } from '../数据/Agent规则映射';
import { BFF错误 } from '../数据/HTTP客户端';
import type { BFFAgent规则, BFFAgent规则提案 } from '../数据/BFF契约';
import type { BFF角色 } from '../数据/BFF契约';
import type { HTTP招聘数据源 } from '../数据/HTTP招聘数据源';
import type { 页面意向快照, 页面岗位快照 } from '../数据/招聘数据源类型';
import { 从BFF简历 } from '../数据/后端映射';
import { 从BFF隐私 } from '../数据/隐私映射';
import {
  BFF主体样本,
  BFF简历样本,
  BFF意向样本,
  BFF隐私快照样本,
  BFF企业关系样本,
  BFF企业媒体样本,
  BFF企业档案样本,
  BFF企业管理员申请样本,
  BFF公开企业样本,
  BFF招聘方档案样本,
  BFFAgent规则样本,
  BFF意向Agent规则样本,
  BFFAgent规则解释中提案样本,
  BFFAgent规则就绪提案样本,
} from '../测试/BFF样本';
import 规则库 from './规则库';

// ── 镜头：真实 Provider 之上的两条测试缝（操作间谍 + 阶段覆盖） ──────────────

const 镜头 = vi.hoisted(() => ({
  原use应用状态: null as null | (() => unknown),
  真值: null as null | {
    状态: unknown;
    派发: (动作: never) => void;
    数据源模式: 'mock' | 'backend';
    后端状态: unknown;
    操作: unknown;
  },
  覆盖: null as null | Record<string, unknown>,
  版本: 0,
  订阅们: new Set<() => void>(),
  间谍: null as null | { 源: unknown; 包装: unknown },
  种子派发: null as null | (() => void),
}));

interface 镜头真值 {
  状态: 状态;
  派发: (动作: 动作) => void;
  数据源模式: 'mock' | 'backend';
  后端状态: 后端状态;
  操作: 应用操作;
}

/** vi.fn 透传间谍：签名与真实操作一致，另带 mock 缝供断言/接管。 */
type 操作间谍 = {
  [K in keyof 应用操作]: 应用操作[K] & ReturnType<typeof vi.fn>;
};

function 取间谍操作(源: 应用操作): 操作间谍 {
  if (镜头.间谍 && 镜头.间谍.源 === 源) return 镜头.间谍.包装 as 操作间谍;
  const 包装 = Object.fromEntries(
    Object.entries(源).map(([名, 函数]) => [
      名,
      vi.fn((...参数: unknown[]) => (函数 as (...内参: unknown[]) => unknown)(...参数)),
    ]),
  ) as unknown as 操作间谍;
  镜头.间谍 = { 源, 包装 };
  return 包装;
}

// 覆盖阶段变化 → 通知 useSyncExternalStore 的订阅组件（页面）重渲染
function 读镜头版本() {
  return 镜头.版本;
}

function 订阅镜头变化(通知: () => void) {
  镜头.订阅们.add(通知);
  return () => {
    镜头.订阅们.delete(通知);
  };
}

function 读镜头值(): 镜头真值 {
  // 直接挂真实 Context：Provider 任何状态变化（种子/水合/操作回写）都会重渲染页面 ——
  // 页面元素身份稳定，单靠父级重渲染会被 React bailout 掉，必须自己消费 context
  const 真值 = 镜头.原use应用状态?.() as 镜头真值;
  // 再登记镜头订阅：setHydration 翻覆盖阶段时页面随之重渲染
  useSyncExternalStore(订阅镜头变化, 读镜头版本);
  if (!真值) throw new Error('规则库测试：页面必须经 renderCandidateRules 渲染');
  镜头.真值 = 真值;
  return {
    ...真值,
    操作: 取间谍操作(真值.操作),
    后端状态: 镜头.覆盖
      ? ({ ...真值.后端状态, ...镜头.覆盖 } as 后端状态)
      : 真值.后端状态,
  };
}

vi.mock('../状态/应用状态', async (importOriginal) => {
  const 实际 = await importOriginal<Record<string, unknown>>();
  镜头.原use应用状态 = 实际.use应用状态 as () => unknown;
  return { ...实际, use应用状态: () => 读镜头值() };
});

// 页面只用 use导航().返回；单测无 Router，按本仓屏幕测试惯例桩掉
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: vi.fn(), 跳转: vi.fn() }) }));

/** Provider 内的镜头宿主：捕获真实 Context 值 + 首帧种子（真实 reducer 播场景数据）。 */
function 镜头宿主({ children }: { children: ReactNode }) {
  const 真值 = 镜头.原use应用状态?.() as 镜头真值;
  镜头.真值 = 真值;
  useLayoutEffect(() => {
    // 首帧种子在 layout effect 里经真实 派发 落地：render() 返回后同步断言即可用
    镜头.种子派发?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在挂载时播种一次
  }, []);
  return <>{children}</>;
}

// ── 数据源桩：默认全成功；规则/提案/意向由场景注入 ──────────────────────────

function 创建后端桩() {
  return {
    恢复会话: vi.fn(async () => ({ identity_id: 'id_1', session_id: 'sess_1', expires_at: '2026-08-29T00:00:00Z' })),
    读取主体: vi.fn(async () => BFF主体样本),
    确保角色: vi.fn(async (角色: BFF角色) => ({ ...BFF主体样本, roles: [...BFF主体样本.roles, { role: 角色, status: 'active' as const }] })),
    记录当前角色: vi.fn(async (角色: BFF角色) => ({ ...BFF主体样本, last_used_role: 角色 })),
    读取简历: vi.fn(async () => 从BFF简历(BFF简历样本)),
    保存简历: vi.fn(async () => 从BFF简历(BFF简历样本)),
    读取意向: vi.fn(async (): Promise<页面意向快照> => ({ 列表: [], 服务端: {} })),
    创建意向: vi.fn(async (): Promise<页面意向快照> => ({ 列表: [], 服务端: {} })),
    更新意向: vi.fn(async (): Promise<页面意向快照> => ({ 列表: [], 服务端: {} })),
    删除意向: vi.fn(async (): Promise<页面意向快照> => ({ 列表: [], 服务端: {} })),
    读取岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    创建岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    更新岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    归档岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    重开岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    删除岗位: vi.fn(async (): Promise<页面岗位快照> => ({ 列表: [], 服务端: {} })),
    清空目录缓存: vi.fn(),
    // P3：candidate mount 水合的隐私链（本文件用例不触达，桩保持完整以防串域访问）
    读取隐私: vi.fn(async () => 从BFF隐私(BFF隐私快照样本)),
    // recruiter mount 水合的组织链（candidate 页不触达，桩保持完整以防串角色访问）
    读取招聘方档案: vi.fn(async () => BFF招聘方档案样本),
    保存招聘方档案: vi.fn(async () => BFF招聘方档案样本),
    读取我的企业关系: vi.fn(async () => [BFF企业关系样本]),
    读取企业管理员申请: vi.fn(async () => [BFF企业管理员申请样本]),
    创建企业管理员申请: vi.fn(async () => BFF企业管理员申请样本),
    取消企业管理员申请: vi.fn(async () => BFF企业管理员申请样本),
    接受企业邀请: vi.fn(async () => BFF企业关系样本),
    替换招聘方头像: vi.fn(async () => BFF招聘方档案样本),
    读取企业档案: vi.fn(async () => BFF企业档案样本),
    替换企业档案: vi.fn(async () => BFF企业档案样本),
    上传企业媒体: vi.fn(async () => BFF企业媒体样本),
    删除企业媒体: vi.fn(async () => undefined),
    读取公开企业: vi.fn(async () => BFF公开企业样本),
    查询Location: vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
    查询Taxonomy: vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
    查询Institution: vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
    开始手机登录: vi.fn(),
    完成手机登录: vi.fn(),
    开始微信登录: vi.fn(),
    退出登录: vi.fn(),
    // P6：Agent 规则 / 提案 facade（默认空集，成功回执）
    读取Agent规则: vi.fn(async (): Promise<BFFAgent规则[]> => []),
    读取单条Agent规则: vi.fn(async () => BFFAgent规则样本),
    修改Agent规则: vi.fn(async () => BFFAgent规则样本),
    删除Agent规则: vi.fn(async () => undefined),
    创建Agent规则提案: vi.fn(async () => BFFAgent规则解释中提案样本),
    读取Agent规则提案: vi.fn(async () => BFFAgent规则解释中提案样本),
    读取Agent规则提案列表: vi.fn(async (_角色: BFF角色, _状态: 'interpreting' | 'ready'): Promise<BFFAgent规则提案[]> => []),
    接受Agent规则提案: vi.fn(async () => BFFAgent规则样本),
    放弃Agent规则提案: vi.fn(async () => ({ ...BFFAgent规则就绪提案样本, state: 'dismissed' as const })),
    创建Agent规则替换提案: vi.fn(async () => BFFAgent规则解释中提案样本),
    // P2 Task 3 起候选水合并行读第四个支持域（附件库）：默认空库成功
    读取附件简历库: vi.fn(async () => ({
      items: [],
      limits: { max_files: 3, max_file_bytes: 10485760, accepted_media_types: ['application/pdf'] },
    })),
  } as unknown as Record<string, ReturnType<typeof vi.fn>>;
}

type 后端桩 = ReturnType<typeof 创建后端桩>;

// ── 场景 fixture：权威意向 + 双组规则（global / intention 各一条，文案不重复） ──

const 意向编号 = 'int_0123456789abcdef0123456789abcdef';
const 孤儿意向编号 = 'int_fedcba9876543210fedcba9876543210';
const 权威意向DTO = {
  ...BFF意向样本,
  intention_id: 意向编号,
  job_category: { id: 'tax_pm', display_name: 'AI 产品经理' },
};
const 意向场景: 页面意向快照 = {
  列表: [{ 编号: 意向编号, 标题: 'AI 产品经理', 说明: '300-500 元/天' }],
  服务端: { [意向编号]: 权威意向DTO },
};
const 默认规则: BFFAgent规则[] = [
  BFFAgent规则样本,
  { ...BFF意向Agent规则样本, display_text: '双休是底线' },
];
const 失败提案: BFFAgent规则提案 = {
  ...BFFAgent规则解释中提案样本,
  proposal_id: 'arp_0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a',
  state: 'failed',
};
const 未水合: Agent规则角色水合状态 = { rules: '未开始', proposals: '未开始' };

interface 页面场景 {
  mode?: 'mock' | 'backend';
  rulesStage?: Agent规则角色水合状态['rules'];
  proposalsStage?: Agent规则角色水合状态['proposals'];
  /** false = 未登录首帧（主体为空），页面必须落安全壳 */
  initialized?: boolean;
  /** 桩主体与镜头主体一起切角色：验证候选页在 recruiter 会话下渲染安全壳 */
  主体角色?: 'candidate' | 'recruiter';
  规则?: BFFAgent规则[];
  提案?: BFFAgent规则提案[];
  意向?: 页面意向快照;
  /** 提案字典不进首帧镜头：改由真实挂载水合落卡（accept/dismiss 全链路用例用） */
  提案走真实水合?: boolean;
  调桩?: (桩: 后端桩) => void;
}

function setHydrationFor(角色: 'candidate' | 'recruiter') {
  return (next: Agent规则角色水合状态) => {
    镜头.覆盖 = {
      ...镜头.覆盖,
      Agent规则水合: {
        candidate: 角色 === 'candidate' ? next : 未水合,
        recruiter: 角色 === 'recruiter' ? next : 未水合,
      },
    };
    镜头.版本 += 1;
    for (const 通知 of 镜头.订阅们) 通知();
  };
}

function renderCandidateRules(场景: 页面场景 = {}) {
  const 模式 = 场景.mode ?? 'backend';
  const 角色 = 场景.主体角色 ?? 'candidate';
  const 规则们 = 场景.规则 ?? 默认规则;
  const 提案们 = 场景.提案 ?? [];
  const 意向 = 场景.意向 ?? 意向场景;
  const 后端 = 创建后端桩();

  if (模式 === 'backend') {
    后端.读取主体.mockResolvedValue({ ...BFF主体样本, last_used_role: 角色 });
    后端.读取意向.mockResolvedValue(意向);
    后端.读取Agent规则.mockResolvedValue(规则们);
    后端.读取Agent规则提案列表.mockImplementation(async (_角色: BFF角色, 阶段: 'interpreting' | 'ready') =>
      提案们.filter((提案) => 提案.state === 阶段));
  }
  场景.调桩?.(后端);

  镜头.真值 = null;
  镜头.间谍 = null;
  镜头.种子派发 = null;
  镜头.覆盖 = null;
  镜头.版本 = 0;

  if (模式 === 'backend') {
    const 投影 = 映射候选Agent规则(规则们, 意向.服务端);
    const 提案表 = Object.fromEntries(提案们.map((提案) => [提案.proposal_id, 提案]));
    镜头.覆盖 = {
      主体: 场景.initialized === false ? null : { ...BFF主体样本, last_used_role: 角色 },
      Agent规则水合: {
        candidate: 角色 === 'candidate'
          ? { rules: 场景.rulesStage ?? '成功', proposals: 场景.proposalsStage ?? '成功' }
          : 未水合,
        recruiter: 角色 === 'recruiter'
          ? { rules: 场景.rulesStage ?? '成功', proposals: 场景.proposalsStage ?? '成功' }
          : 未水合,
      },
      意向快照: 意向.服务端,
      ...(场景.提案走真实水合 ? {} : { 候选规则提案: 提案表 }),
    };
    镜头.种子派发 = () => {
      const 派发 = 镜头.真值?.派发 as ((动作: 动作) => void) | undefined;
      if (!派发) return;
      派发({ 型: '水合后端意向', 快照: 意向 });
      派发({ 型: '水合后端候选规则', 全局: 投影.全局, 意向级: 投影.意向级 });
    };
  }

  const 视图 = render(
    <应用状态提供者
      数据源={模式 === 'backend'
        ? { 模式: 'backend', 后端环境: 'stg', 后端: 后端 as unknown as HTTP招聘数据源 }
        : undefined}
    >
      <镜头宿主>
        <规则库 />
      </镜头宿主>
    </应用状态提供者>,
  );

  return {
    ...视图,
    操作: 取间谍操作(镜头.真值!.操作 as unknown as 应用操作),
    setHydration: setHydrationFor(角色),
    后端,
    派发: (动作: 动作) => 镜头.真值?.派发(动作 as never),
  };
}

/** 等挂载水合（首帧种子之后的真实链路）落定：避免点击与重渲染赛跑换掉 DOM 节点。 */
async function 挂载到稳定() {
  await act(async () => {});
}

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  });
  // P6 草稿寄存走 sessionStorage（跨卸载存活）：用例间清掉，杜绝跨用例残留还原
  window.sessionStorage.clear();
  // 轻提示 是 body 下的纯 DOM 单例：上一用例的吐司还挂着会撞同名 getByText，只清子条不留壳
  for (const 壳 of Array.from(document.body.querySelectorAll('div'))) {
    if ((壳 as HTMLElement).style.zIndex === '999') 壳.innerHTML = '';
  }
});

// Task 3 冻结的七条 P6 文案（error code → 页面文案，一字不改）
const 冻结文案们: [string, string][] = [
  ['agent_rule_proposal_not_ready', 'AI代理还在理解这条规则，请稍后再试'],
  ['agent_rule_proposal_not_actionable', '这条内容暂时不能成为长期规则，请放弃或换一种说法'],
  ['agent_rule_proposal_terminal', '这条规则提案已经处理，请查看最新状态'],
  ['idempotency_conflict', '这次操作与之前的请求冲突，请检查最新状态后重试'],
  ['agent_rule_scope_denied', '这个意向已不可用，请重新选择规则范围'],
  ['agent_rule_not_found', '这条规则已不存在，请查看最新状态'],
  ['agent_rule_proposal_not_found', '这条规则提案已不存在，请查看最新状态'],
];

describe('规则库 · Backend 候选页', () => {
  it('Backend candidate groups by authoritative intention and creates an intention-scoped Proposal', async () => {
    const user = userEvent.setup();
    const 视图 = renderCandidateRules({ mode: 'backend', rulesStage: '成功', proposalsStage: '成功', initialized: true });
    expect(screen.getByText('意向规则 · AI 产品经理')).toBeTruthy();
    await 挂载到稳定();
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    await user.selectOptions(screen.getByLabelText('规则范围'), 'int_0123456789abcdef0123456789abcdef');
    await user.type(screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤'), '只接受双休');
    await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
    expect(视图.操作.创建Agent规则提案).toHaveBeenCalledWith({
      文本: '只接受双休',
      作用域: { type: 'intention', intention_id: 'int_0123456789abcdef0123456789abcdef' },
    });
    expect(screen.queryByText('只接受双休')).toBeNull();
  });

  it('global default submits an explicit global scope and offers no free-text scope', async () => {
    const user = userEvent.setup();
    const 视图 = renderCandidateRules({ rulesStage: '成功', proposalsStage: '成功', initialized: true });
    await 挂载到稳定();
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    // 范围选择只有「全局 + 权威意向」，绝不提供自由文本 ID 项
    expect(within(screen.getByLabelText('规则范围')).getAllByRole('option')
      .map((选项) => (选项 as HTMLOptionElement).value))
      .toEqual(['', 意向编号]);
    await user.type(screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤'), '只接受双休');
    await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
    expect(视图.操作.创建Agent规则提案).toHaveBeenCalledWith({
      文本: '只接受双休',
      作用域: { type: 'global' },
    });
  });

  it('replacement creates a Proposal and keeps the old Rule visible until accept', async () => {
    const user = userEvent.setup();
    const 视图 = renderCandidateRules({ rulesStage: '成功', proposalsStage: '成功', initialized: true });
    await 挂载到稳定();
    await user.click(screen.getByText('大小周不谈'));
    const 编辑框 = screen.getByDisplayValue('大小周不谈');
    await user.clear(编辑框);
    await user.type(编辑框, '双休是底线；隔周六可谈');
    await user.click(screen.getByRole('button', { name: '提交修改' }));
    expect(视图.操作.创建Agent规则替换提案).toHaveBeenCalledWith(
      BFFAgent规则样本.rule_id,
      '双休是底线；隔周六可谈',
    );
    // 旧 Rule 在用户「确认规则」前保持原样显示，也没有临时行或计数变化
    expect(screen.getByText('大小周不谈')).toBeTruthy();
    expect(screen.getByText('2 条')).toBeTruthy();
  });

  it('archive deletes by the current Rule ID, guards double-clicks, and refreshes authoritatively', async () => {
    const user = userEvent.setup();
    const 删除完成 = deferred<void>();
    const 视图 = renderCandidateRules({
      rulesStage: '成功', proposalsStage: '成功', initialized: true,
      规则: [BFFAgent规则样本],
      调桩: (桩) => {
        // 删除在飞期间按钮禁用：双击不再打出第二条 DELETE（权威会回 not_found）
        桩.删除Agent规则.mockImplementation(async () => {
          await 删除完成.promise;
          return undefined;
        });
      },
    });
    await 挂载到稳定();
    await user.click(screen.getByText('大小周不谈'));
    await user.click(screen.getByRole('button', { name: '删除' }));
    expect(screen.getByRole('button', { name: '删除' }).hasAttribute('disabled')).toBe(true);
    // 同一张编辑卡上只有删除在飞：提交修改不受牵连
    expect(screen.getByRole('button', { name: '提交修改' }).hasAttribute('disabled')).toBe(false);
    删除完成.resolve();
    await waitFor(() => expect(screen.queryByText('大小周不谈')).toBeNull());
    expect(视图.操作.删除Agent规则).toHaveBeenCalledTimes(1);
    expect(screen.getByText('0 条')).toBeTruthy();
  });

  it('renders interpreting, ready, and failed Proposal cards with the frozen copies', () => {
    renderCandidateRules({
      rulesStage: '成功', proposalsStage: '成功', initialized: true,
      提案: [BFFAgent规则解释中提案样本, BFFAgent规则就绪提案样本, 失败提案],
    });
    expect(screen.getByText('AI代理正在理解这条规则…')).toBeTruthy();
    expect(screen.getByText('双休岗位可推进，大小周岗位拦下')).toBeTruthy();
    expect(screen.getByText('这条规则同时包含推进、拦截或参考条件')).toBeTruthy();
    expect(screen.getByRole('button', { name: '确认规则' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '放弃' })).toBeTruthy();
    expect(screen.getByText('AI代理没有理解这条规则，请换一种更明确的说法')).toBeTruthy();
    expect(screen.getByRole('button', { name: '关闭' })).toBeTruthy();
  });

  it('orders Proposal cards by created_at and puts absent timestamps last', () => {
    renderCandidateRules({
      rulesStage: '成功', proposalsStage: '成功', initialized: true,
      提案: [
        { ...BFFAgent规则就绪提案样本, proposal_id: 'arp_bbbb', normalized_text: '没有时间戳的提案', created_at: undefined },
        { ...BFFAgent规则就绪提案样本, proposal_id: 'arp_aaaa', normalized_text: '更早落地的提案', created_at: '2026-08-27T01:00:00Z' },
      ],
    });
    const 更早的 = screen.getByText('更早落地的提案');
    const 无时的 = screen.getByText('没有时间戳的提案');
    // created_at 正序在前，缺席的一律排最后
    expect(更早的.compareDocumentPosition(无时的) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('closing a failed card only removes that card', async () => {
    const user = userEvent.setup();
    renderCandidateRules({
      rulesStage: '成功', proposalsStage: '成功', initialized: true,
      提案: [BFFAgent规则就绪提案样本, 失败提案],
    });
    await user.click(screen.getByRole('button', { name: '关闭' }));
    expect(screen.queryByText('AI代理没有理解这条规则，请换一种更明确的说法')).toBeNull();
    // ready 卡与页面控件不受牵连
    expect(screen.getByRole('button', { name: '确认规则' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /手动添加规则/ })).toBeTruthy();
  });

  it('closing a failed card restores the submitted draft and scope for resubmission', async () => {
    const user = userEvent.setup();
    renderCandidateRules({ rulesStage: '成功', proposalsStage: '成功', initialized: true });
    await 挂载到稳定();
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    await user.selectOptions(screen.getByLabelText('规则范围'), 意向编号);
    await user.type(screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤'), '只接受双休');
    await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
    // 创建成功即收起输入行：草稿先寄存在页面，等提案终态裁决
    await waitFor(() => expect(screen.queryByPlaceholderText('例：不接受大小周的岗位直接过滤')).toBeNull());
    // 提案翻转为 failed：失败卡上屏
    act(() => {
      镜头.覆盖 = {
        ...镜头.覆盖,
        候选规则提案: {
          [BFFAgent规则解释中提案样本.proposal_id]: { ...BFFAgent规则解释中提案样本, state: 'failed' as const },
        },
      };
      镜头.版本 += 1;
      for (const 通知 of 镜头.订阅们) 通知();
    });
    expect(screen.getByText('AI代理没有理解这条规则，请换一种更明确的说法')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '关闭' }));
    // §7.3：关闭后原草稿（含范围）回到输入行，供再次明确提交
    expect((screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤') as HTMLInputElement).value).toBe('只接受双休');
    expect((screen.getByLabelText('规则范围') as HTMLSelectElement).value).toBe(意向编号);
    expect(screen.queryByText('AI代理没有理解这条规则，请换一种更明确的说法')).toBeNull();
  });

  it('unmount 后回到本页：关闭失败卡仍还原跨导航寄存的原草稿与范围', async () => {
    // §7.3「关闭后保留用户原草稿」必须跨导航存活：寄存在 sessionStorage 而不是页面 useState
    const user = userEvent.setup();
    const 第一屏 = renderCandidateRules({ rulesStage: '成功', proposalsStage: '成功', initialized: true });
    await 挂载到稳定();
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    await user.selectOptions(screen.getByLabelText('规则范围'), 意向编号);
    await user.type(screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤'), '只接受双休');
    await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
    await waitFor(() => expect(screen.queryByPlaceholderText('例：不接受大小周的岗位直接过滤')).toBeNull());
    // 模拟导航离开再回来：页面卸载重建，原始提案字典里这张卡已翻 failed
    第一屏.unmount();
    renderCandidateRules({
      rulesStage: '成功', proposalsStage: '成功', initialized: true,
      提案: [{ ...BFFAgent规则解释中提案样本, state: 'failed' as const }],
    });
    expect(screen.getByText('AI代理没有理解这条规则，请换一种更明确的说法')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '关闭' }));
    // 原草稿（含范围）回到输入行，供再次明确提交
    expect((screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤') as HTMLInputElement).value).toBe('只接受双休');
    expect((screen.getByLabelText('规则范围') as HTMLSelectElement).value).toBe(意向编号);
    expect(screen.queryByText('AI代理没有理解这条规则，请换一种更明确的说法')).toBeNull();
  });

  it('sessionStorage 写入抛错时草稿落记忆层：同页关闭失败卡仍还原，且不跨页复活', async () => {
    // review-r3 R3-2：配额满/隐私模式下 setItem 抛错的旧实现会把草稿直接丢掉
    //（composer 又已清空）—— 记忆层兜底后同页还原照常，关闭时两层一起删。
    const user = userEvent.setup();
    // jsdom 的全局 Storage 与 window.sessionStorage 的原型不同域：桩要打在真实原型上
    const 写入抛错 = vi.spyOn(
      Object.getPrototypeOf(window.sessionStorage) as Storage,
      'setItem',
    ).mockImplementation(() => {
      throw new Error('配额已满');
    });
    let 第一屏: ReturnType<typeof renderCandidateRules>;
    try {
      第一屏 = renderCandidateRules({ rulesStage: '成功', proposalsStage: '成功', initialized: true });
      await 挂载到稳定();
      await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
      await user.selectOptions(screen.getByLabelText('规则范围'), 意向编号);
      await user.type(screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤'), '只接受双休');
      await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
      await waitFor(() => expect(screen.queryByPlaceholderText('例：不接受大小周的岗位直接过滤')).toBeNull());
      // storage 层确实没写进去
      expect(写入抛错).toHaveBeenCalled();
      expect(window.sessionStorage.getItem(`agent规则草稿:${BFFAgent规则解释中提案样本.proposal_id}`)).toBeNull();
      act(() => {
        镜头.覆盖 = {
          ...镜头.覆盖,
          候选规则提案: {
            [BFFAgent规则解释中提案样本.proposal_id]: { ...BFFAgent规则解释中提案样本, state: 'failed' as const },
          },
        };
        镜头.版本 += 1;
        for (const 通知 of 镜头.订阅们) 通知();
      });
      await user.click(screen.getByRole('button', { name: '关闭' }));
      // 记忆层兜底：同页关闭失败卡照样还原原草稿与范围
      expect((screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤') as HTMLInputElement).value).toBe('只接受双休');
      expect((screen.getByLabelText('规则范围') as HTMLSelectElement).value).toBe(意向编号);
    } finally {
      写入抛错.mockRestore();
    }
    // storage 恢复后重进页面：关闭已把两层一起删干净，草稿不得复活
    第一屏.unmount();
    renderCandidateRules({
      rulesStage: '成功', proposalsStage: '成功', initialized: true,
      提案: [{ ...BFFAgent规则解释中提案样本, state: 'failed' as const }],
    });
    await user.click(screen.getByRole('button', { name: '关闭' }));
    expect(screen.queryByPlaceholderText('例：不接受大小周的岗位直接过滤')).toBeNull();
  });

  it('subject 不匹配的寄存草稿直接丢弃：不还原也不留键', async () => {
    // 换账号后的失败卡：上一个账号的草稿绝不回流到新账号的输入行
    window.sessionStorage.setItem(
      `agent规则草稿:${失败提案.proposal_id}`,
      JSON.stringify({ subjectId: 'sub_other', 文本: '别人的草稿', 作用域: { type: 'global' as const } }),
    );
    const user = userEvent.setup();
    renderCandidateRules({
      rulesStage: '成功', proposalsStage: '成功', initialized: true,
      提案: [失败提案],
    });
    await user.click(screen.getByRole('button', { name: '关闭' }));
    expect(screen.queryByPlaceholderText('例：不接受大小周的岗位直接过滤')).toBeNull();
    expect(screen.queryByText('AI代理没有理解这条规则，请换一种更明确的说法')).toBeNull();
    // 不匹配的键也要删掉，不留残留
    expect(window.sessionStorage.getItem(`agent规则草稿:${失败提案.proposal_id}`)).toBeNull();
  });

  it('accept clears the stored draft: a later failed card for the same ID does not resurrect it', async () => {
    const user = userEvent.setup();
    renderCandidateRules({
      rulesStage: '成功', proposalsStage: '成功', initialized: true,
      调桩: (桩) => {
        // accept 之后的完整水合读到一份新权威规则：投影上屏即「完整刷新已收口」的实证
        桩.接受Agent规则提案.mockImplementation(async () => {
          桩.读取Agent规则.mockResolvedValue([{ ...BFFAgent规则样本, display_text: '权威刷新后的规则' }]);
          return BFFAgent规则样本;
        });
      },
    });
    await 挂载到稳定();
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    await user.type(screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤'), '只接受双休');
    await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
    await waitFor(() => expect(screen.queryByPlaceholderText('例：不接受大小周的岗位直接过滤')).toBeNull());
    // 提案变成 ready：确认规则 走真实操作层成功收口
    act(() => {
      镜头.覆盖 = {
        ...镜头.覆盖,
        候选规则提案: {
          [BFFAgent规则解释中提案样本.proposal_id]: {
            ...BFFAgent规则解释中提案样本,
            state: 'ready' as const,
            normalized_text: '归一化后的草稿',
            consequence: 'mixed' as const,
          },
        },
      };
      镜头.版本 += 1;
      for (const 通知 of 镜头.订阅们) 通知();
    });
    await user.click(screen.getByRole('button', { name: '确认规则' }));
    // 完整水合收口完成的实证：新权威规则经投影上屏
    await waitFor(() => expect(screen.getByText('权威刷新后的规则')).toBeTruthy());
    await 挂载到稳定();
    // 同一提案再翻 failed：寄存已随 accept 清掉，关闭失败卡不得再还原草稿
    act(() => {
      镜头.覆盖 = {
        ...镜头.覆盖,
        候选规则提案: {
          [BFFAgent规则解释中提案样本.proposal_id]: { ...BFFAgent规则解释中提案样本, state: 'failed' as const },
        },
      };
      镜头.版本 += 1;
      for (const 通知 of 镜头.订阅们) 通知();
    });
    expect(screen.getByText('AI代理没有理解这条规则，请换一种更明确的说法')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '关闭' }));
    // 寄存已清：输入行不弹开，草稿不复活
    expect(screen.queryByPlaceholderText('例：不接受大小周的岗位直接过滤')).toBeNull();
    expect(screen.queryByText('AI代理没有理解这条规则，请换一种更明确的说法')).toBeNull();
  });

  it('count only reflects active Rules and paused rows stay on the list', () => {
    renderCandidateRules({
      rulesStage: '成功', proposalsStage: '成功', initialized: true,
      规则: [
        BFFAgent规则样本,
        { ...BFFAgent规则样本, rule_id: 'rul_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', state: 'paused', display_text: '全现场岗位先不聊' },
      ],
    });
    expect(screen.getByText('1 条')).toBeTruthy();
    expect(screen.getByText('全现场岗位先不聊')).toBeTruthy();
  });

  it('shows the retry affordance without rows while the Rules domain failed', () => {
    renderCandidateRules({ rulesStage: '失败', proposalsStage: '成功', initialized: true });
    expect(screen.getByRole('button', { name: '规则加载失败，重试' })).toBeTruthy();
    expect(screen.queryByRole('status', { name: '规则加载中' })).toBeNull();
    expect(screen.queryByText('大小周不谈')).toBeNull();
    expect(screen.queryByRole('button', { name: /手动添加规则/ })).toBeNull();
  });

  it('hides Mock rows and count before Rule hydration succeeds', () => {
    const 视图 = renderCandidateRules({ rulesStage: '未开始', proposalsStage: '未开始', initialized: true });
    expect(screen.getByRole('status', { name: '规则加载中' })).toBeTruthy();
    // 首次 Rule 成功前连 Mock 残留行也不许显示：手动播一条 Mock 规则进全局状态
    act(() => {
      视图.派发({ 型: '新增规则', 内容: '模拟残留的Mock规则', 来源: '你手动添加 · 刚刚' });
    });
    expect(screen.queryByText('模拟残留的Mock规则')).toBeNull();
    expect(screen.queryByText('0 条')).toBeNull();
    expect(screen.queryByRole('button', { name: /手动添加规则/ })).toBeNull();
  });

  it('orphan intention Rules stay absent and never join the scope options', async () => {
    const user = userEvent.setup();
    renderCandidateRules({
      rulesStage: '成功', proposalsStage: '成功', initialized: true,
      规则: [
        BFFAgent规则样本,
        { ...BFF意向Agent规则样本, display_text: '孤儿意向的规则', scope: { type: 'intention', intention_id: 孤儿意向编号 } },
      ],
    });
    expect(screen.queryByText('孤儿意向的规则')).toBeNull();
    await 挂载到稳定();
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    expect(within(screen.getByLabelText('规则范围')).getAllByRole('option')
      .map((选项) => (选项 as HTMLOptionElement).value))
      .toEqual(['', 意向编号]);
  });

  it('renders a safe shell when the active role is not the candidate', () => {
    renderCandidateRules({ rulesStage: '成功', proposalsStage: '成功', initialized: true, 主体角色: 'recruiter' });
    expect(screen.queryByRole('button', { name: /手动添加规则/ })).toBeNull();
    expect(screen.queryByText('大小周不谈')).toBeNull();
    expect(screen.queryByRole('status', { name: '规则加载中' })).toBeNull();
    expect(screen.queryByRole('button', { name: '规则加载失败，重试' })).toBeNull();
  });

  it('renders a safe shell while the session is not initialized', () => {
    renderCandidateRules({ rulesStage: '成功', proposalsStage: '成功', initialized: false });
    expect(screen.queryByRole('button', { name: /手动添加规则/ })).toBeNull();
    expect(screen.queryByRole('status', { name: '规则加载中' })).toBeNull();
  });

  it('operation failure keeps the draft and the composer open', async () => {
    const user = userEvent.setup();
    const 视图 = renderCandidateRules({ rulesStage: '成功', proposalsStage: '成功', initialized: true });
    await 挂载到稳定();
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    await user.type(screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤'), '只接受双休');
    视图.操作.创建Agent规则提案.mockRejectedValue(new BFF错误(500, 'internal_error', 'boom'));
    await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
    await waitFor(() => expect(screen.getByText('boom')).toBeTruthy());
    expect((screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤') as HTMLInputElement).value).toBe('只接受双休');
    expect(screen.getByRole('button', { name: '提交给AI代理理解' })).toBeTruthy();
  });

  it('空规则时提交键禁用，写入有效内容后才可提交', async () => {
    const user = userEvent.setup();
    renderCandidateRules({ rulesStage: '成功', proposalsStage: '成功', initialized: true });
    await 挂载到稳定();
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    const 提交 = screen.getByRole('button', { name: '提交给AI代理理解' }) as HTMLButtonElement;
    expect(提交.disabled).toBe(true);
    await user.type(screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤'), '只接受双休');
    expect(提交.disabled).toBe(false);
  });

  it('surfaces all seven frozen P6 error copies verbatim', async () => {
    const user = userEvent.setup();
    const 视图 = renderCandidateRules({ rulesStage: '成功', proposalsStage: '成功', initialized: true });
    await 挂载到稳定();
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    await user.type(screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤'), '只接受双休');
    for (const [code, 文案] of 冻结文案们) {
      视图.操作.创建Agent规则提案.mockRejectedValue(new BFF错误(400, code, 'rejected'));
      await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
      await waitFor(() => expect(screen.getByText(文案)).toBeTruthy());
      // 每次失败都保留草稿，绝不伪造成功
      expect((screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤') as HTMLInputElement).value).toBe('只接受双休');
    }
  });

  it('agent_rule_scope_denied keeps the selected scope and the draft text', async () => {
    const user = userEvent.setup();
    const 视图 = renderCandidateRules({ rulesStage: '成功', proposalsStage: '成功', initialized: true });
    await 挂载到稳定();
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    await user.selectOptions(screen.getByLabelText('规则范围'), 意向编号);
    await user.type(screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤'), '只接受双休');
    视图.操作.创建Agent规则提案.mockRejectedValue(new BFF错误(403, 'agent_rule_scope_denied', 'denied'));
    await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
    await waitFor(() => expect(screen.getByText('这个意向已不可用，请重新选择规则范围')).toBeTruthy());
    // 不静默改成 global：范围与文本都原样保留
    expect((screen.getByLabelText('规则范围') as HTMLSelectElement).value).toBe(意向编号);
    expect((screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤') as HTMLInputElement).value).toBe('只接受双休');
  });

  it('idempotency_conflict keeps the card and the draft without success copy', async () => {
    const user = userEvent.setup();
    const 视图 = renderCandidateRules({
      rulesStage: '成功', proposalsStage: '成功', initialized: true,
      提案: [BFFAgent规则就绪提案样本],
    });
    await 挂载到稳定();
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    await user.type(screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤'), '只接受双休');
    视图.操作.接受Agent规则提案.mockRejectedValue(new BFF错误(409, 'idempotency_conflict', 'conflict'));
    await user.click(screen.getByRole('button', { name: '确认规则' }));
    await waitFor(() => expect(screen.getByText('这次操作与之前的请求冲突，请检查最新状态后重试')).toBeTruthy());
    // 卡片与草稿都在，且没有任何成功迹象（计数不变、没有新行）
    expect(screen.getByText('双休岗位可推进，大小周岗位拦下')).toBeTruthy();
    expect((screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤') as HTMLInputElement).value).toBe('只接受双休');
    expect(screen.getByText('2 条')).toBeTruthy();
  });

  it('not_actionable keeps the card and shows no success copy', async () => {
    const user = userEvent.setup();
    const 视图 = renderCandidateRules({
      rulesStage: '成功', proposalsStage: '成功', initialized: true,
      提案: [BFFAgent规则就绪提案样本],
    });
    await 挂载到稳定();
    视图.操作.接受Agent规则提案.mockRejectedValue(new BFF错误(409, 'agent_rule_proposal_not_actionable', 'advisory'));
    await user.click(screen.getByRole('button', { name: '确认规则' }));
    await waitFor(() => expect(screen.getByText('这条内容暂时不能成为长期规则，请放弃或换一种说法')).toBeTruthy());
    expect(screen.getByText('双休岗位可推进，大小周岗位拦下')).toBeTruthy();
    expect(screen.getByText('2 条')).toBeTruthy();
  });

  it('composing Enter only picks the candidate word; plain Enter submits', async () => {
    const user = userEvent.setup();
    const 视图 = renderCandidateRules({ rulesStage: '成功', proposalsStage: '成功', initialized: true });
    await 挂载到稳定();
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    const 输入框 = screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤');
    await user.type(输入框, '只接受双休');
    // 中文输入法组合期的回车是选字：直接在原生 KeyboardEvent 上置 isComposing 再派发
    const 组合回车 = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    Object.defineProperty(组合回车, 'isComposing', { value: true });
    fireEvent(输入框, 组合回车);
    expect(视图.操作.创建Agent规则提案).not.toHaveBeenCalled();
    fireEvent.keyDown(输入框, { key: 'Enter' });
    expect(视图.操作.创建Agent规则提案).toHaveBeenCalledTimes(1);
    expect(视图.操作.创建Agent规则提案).toHaveBeenCalledWith({ 文本: '只接受双休', 作用域: { type: 'global' } });
  });

  it('Mock mode keeps the prototype list, source copy, and synchronous add', async () => {
    const user = userEvent.setup();
    const 视图 = renderCandidateRules({ mode: 'mock' });
    expect(screen.getByText('不主动披露并行接触数量')).toBeTruthy();
    expect(screen.getByText('意向级 · 仅「AI 产品经理」')).toBeTruthy();
    // 2026-08-31 定稿：Mock 页去掉提示条，顶部换成「哪些事先问你」真选项
    expect(screen.queryByText('你确认过的规则才会沉淀到这里，长期约束你的AI代理。')).toBeNull();
    expect(screen.getByText('发送正式简历')).toBeTruthy();
    expect(screen.queryByText('在任何一单的代谈进度里发给代理的话，都会自动沉淀到这里，长期约束你的AI代理。')).toBeNull();
    // Mock 头部计数与 Backend 同口径：只数 生效 行（种子 5 行里 R-03 暂停 → 4 条，E2E 同款）
    expect(screen.getByText('4 条')).toBeTruthy();
    // 暂停一条生效行：计数 -1，行本身保留在清单上（生效-only，不是行数）
    act(() => {
      视图.派发({ 型: '切规则开关', 编号: 'R-01' });
    });
    expect(screen.getByText('3 条')).toBeTruthy();
    expect(screen.getByText('不主动披露并行接触数量')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    expect(screen.queryByLabelText('规则范围')).toBeNull();
    await user.type(screen.getByPlaceholderText('例：不接受大小周的岗位直接过滤'), '只接受双休');
    await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
    expect(视图.操作.创建Agent规则提案).toHaveBeenCalledTimes(1);
    // Mock：保存即关闭、同步动作立即上屏，没有提案卡
    expect(screen.getByText('只接受双休')).toBeTruthy();
    expect(screen.queryByText('AI代理正在理解这条规则…')).toBeNull();
  });

  it('shows loaded Rules and a retry affordance when Proposal hydration failed', async () => {
    const user = userEvent.setup();
    const 视图 = renderCandidateRules({
      mode: 'backend', rulesStage: '成功', proposalsStage: '失败', initialized: true,
    });
    const retry = deferred<void>();
    视图.操作.刷新Agent规则.mockImplementation(async () => {
      视图.setHydration({ rules: '成功', proposals: '进行中' });
      await retry.promise;
      视图.setHydration({ rules: '成功', proposals: '成功' });
    });
    expect(screen.getByText(BFFAgent规则样本.display_text)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /手动添加规则/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: '规则加载失败，重试' }));
    expect(视图.操作.刷新Agent规则).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('status', { name: '规则加载中' })).toBeTruthy();
    });
    // 已成功的 Rules 域保持在屏，不因兄弟域重试而闪退
    expect(screen.getByText(BFFAgent规则样本.display_text)).toBeTruthy();
    retry.resolve();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /手动添加规则/ })).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: '规则加载失败，重试' })).toBeNull();
  });

  it('shows a loading shell without a retry affordance while P6 hydration is in flight', () => {
    renderCandidateRules({
      mode: 'backend', rulesStage: '进行中', proposalsStage: '进行中', initialized: true,
    });
    expect(screen.getByRole('status', { name: '规则加载中' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '规则加载失败，重试' })).toBeNull();
  });
});

/** 与 Agent规则操作.test.ts 同形的 deferred 助手。 */
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
