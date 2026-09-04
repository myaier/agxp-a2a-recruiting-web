// P6 Task 6：企业代理设置（招聘方 canonical 页）双模式契约。
// Backend 分支：角色水合门控（规则行/「N 条生效」计数等 rules 成功；手动添加/确认/放弃控件
// 与提案卡等 rules+proposals 双成功；失败出「规则加载失败，重试」；进行中出 role="status"
// 加载壳）、开关 pause/resume（active→pause、paused→resume）、手动添加永不携带范围、
// 提案接受/放弃全链路、无编辑/删除 UI、显式确认文案替换「任何叮嘱都会沉淀」、
// 七条冻结错误文案。Mock 分支：既有单组清单与同步动作保持不变。
// 测试宿主与 规则库.test.tsx 同构：真实 应用状态提供者 + 后端桩 + 两条镜头缝
// （操作逐方法 vi.fn 透传；setHydration 直写镜头里的水合阶段并触发重渲染），
// 不替换 Provider，真实 reducer/操作层照常运行。
// 注：仓库未装 @testing-library/jest-dom，不用 toBeInTheDocument；
// 用 getByText/getByRole（找不到即抛）+ toBeTruthy，queryBy* 缺席断言为 null。

import { useLayoutEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 应用状态提供者 } from '../状态/应用状态';
import type { 动作, 应用操作, 后端状态 } from '../状态/应用状态';
import type { 状态 } from '../状态/应用状态';
import type { Agent规则角色水合状态 } from '../状态/后端/类型';
import { 映射招聘Agent规则 } from '../数据/Agent规则映射';
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
  BFF隐私快照样本,
  BFF企业关系样本,
  BFF企业媒体样本,
  BFF企业档案样本,
  BFF企业管理员申请样本,
  BFF公开企业样本,
  BFF招聘方档案样本,
  BFFAgent规则样本,
  BFFAgent规则就绪提案样本,
  BFFAgent规则解释中提案样本,
} from '../测试/BFF样本';
import 企业代理设置 from './企业代理设置';

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
  if (!真值) throw new Error('企业代理设置测试：页面必须经 renderRecruiterRules 渲染');
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

// ── 数据源桩：默认全成功（含 recruiter mount 的组织链）；规则/提案由场景注入 ──

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
    // P2：candidate mount 水合的附件库读（本文件用例不触达，桩保持完整以防串域访问）
    读取附件简历库: vi.fn(async () => ({
      items: [],
      limits: { max_files: 3, max_file_bytes: 10485760, accepted_media_types: ['application/pdf'] },
    })),
  } as unknown as Record<string, ReturnType<typeof vi.fn>>;
}

type 后端桩 = ReturnType<typeof 创建后端桩>;

const 暂停规则: BFFAgent规则 = {
  ...BFFAgent规则样本,
  rule_id: 'rul_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  state: 'paused',
  display_text: '全现场岗位先不聊',
  updated_at: '2026-08-27T03:00:00Z',
};
const 未水合: Agent规则角色水合状态 = { rules: '未开始', proposals: '未开始' };

interface 页面场景 {
  mode?: 'mock' | 'backend';
  rulesStage?: Agent规则角色水合状态['rules'];
  proposalsStage?: Agent规则角色水合状态['proposals'];
  /** false = 未登录首帧（主体为空），页面必须落安全壳 */
  initialized?: boolean;
  /** 桩主体与镜头主体一起切角色：验证招聘方页在 candidate 会话下渲染安全壳 */
  主体角色?: 'candidate' | 'recruiter';
  规则?: BFFAgent规则[];
  提案?: BFFAgent规则提案[];
  /** 提案字典不进首帧镜头：改由真实挂载水合落卡（accept/dismiss 全链路用例用） */
  提案走真实水合?: boolean;
  调桩?: (桩: 后端桩) => void;
}

function renderRecruiterRules(场景: 页面场景 = {}) {
  const 模式 = 场景.mode ?? 'backend';
  const 角色 = 场景.主体角色 ?? 'recruiter';
  const 规则们 = 场景.规则 ?? [BFFAgent规则样本];
  const 提案们 = 场景.提案 ?? [];
  const 后端 = 创建后端桩();

  if (模式 === 'backend') {
    后端.读取主体.mockResolvedValue({ ...BFF主体样本, last_used_role: 角色 });
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
    const 投影 = 映射招聘Agent规则(规则们);
    const 提案表 = Object.fromEntries(提案们.map((提案) => [提案.proposal_id, 提案]));
    镜头.覆盖 = {
      主体: 场景.initialized === false ? null : { ...BFF主体样本, last_used_role: 角色 },
      Agent规则水合: {
        candidate: 未水合,
        recruiter: { rules: 场景.rulesStage ?? '成功', proposals: 场景.proposalsStage ?? '成功' },
      },
      ...(场景.提案走真实水合 ? {} : { 招聘规则提案: 提案表 }),
    };
    镜头.种子派发 = () => {
      const 派发 = 镜头.真值?.派发 as ((动作: 动作) => void) | undefined;
      if (!派发) return;
      派发({ 型: '水合后端招聘规则', 规则: 投影 });
    };
  }

  const 视图 = render(
    <应用状态提供者
      数据源={模式 === 'backend'
        ? { 模式: 'backend', 后端环境: 'stg', 后端: 后端 as unknown as HTTP招聘数据源 }
        : undefined}
    >
      <镜头宿主>
        <企业代理设置 />
      </镜头宿主>
    </应用状态提供者>,
  );

  return {
    ...视图,
    操作: 取间谍操作(镜头.真值!.操作 as unknown as 应用操作),
    setHydration: (next: Agent规则角色水合状态) => {
      镜头.覆盖 = {
        ...镜头.覆盖,
        Agent规则水合: { candidate: 未水合, recruiter: next },
      };
      镜头.版本 += 1;
      for (const 通知 of 镜头.订阅们) 通知();
    },
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

describe('企业代理设置 · Backend 招聘方页', () => {
  it('Backend recruiter toggles active Rule through pause and never sends a scope', async () => {
    const user = userEvent.setup();
    const 视图 = renderRecruiterRules({ mode: 'backend', rulesStage: '成功', proposalsStage: '成功', initialized: true });
    await 挂载到稳定();
    await user.click(screen.getByRole('switch', { name: `规则：${BFFAgent规则样本.display_text}` }));
    expect(视图.操作.切换Agent规则).toHaveBeenCalledWith(BFFAgent规则样本.rule_id, 'pause');
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    await user.type(screen.getByPlaceholderText(/到岗超过/), '竞对在职候选人不接触');
    await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
    expect(视图.操作.创建Agent规则提案).toHaveBeenCalledWith({ 文本: '竞对在职候选人不接触' });
  });

  it('paused Rule resumes through the same switch and the count follows', async () => {
    const user = userEvent.setup();
    const 视图 = renderRecruiterRules({
      rulesStage: '成功', proposalsStage: '成功', initialized: true,
      规则: [暂停规则],
      调桩: (桩) => {
        // resume 的响应 Rule：同 ID 回到 active
        桩.修改Agent规则.mockResolvedValue({ ...暂停规则, state: 'active' });
      },
    });
    await 挂载到稳定();
    const 开关 = screen.getByRole('switch', { name: '规则：全现场岗位先不聊' });
    expect(开关.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('0 条生效')).toBeTruthy();
    await user.click(开关);
    expect(视图.操作.切换Agent规则).toHaveBeenCalledWith(暂停规则.rule_id, 'resume');
    // 真实操作层用响应 Rule 收口：行回到生效，计数跟着走
    await waitFor(() => expect(screen.getByRole('switch', { name: '规则：全现场岗位先不聊' }).getAttribute('aria-checked')).toBe('true'));
    expect(screen.getByText('1 条生效')).toBeTruthy();
  });

  it('count only reflects active Rules', () => {
    renderRecruiterRules({
      rulesStage: '成功', proposalsStage: '成功', initialized: true,
      规则: [BFFAgent规则样本, 暂停规则],
    });
    expect(screen.getByText('1 条生效')).toBeTruthy();
    expect(screen.getByText('全现场岗位先不聊')).toBeTruthy();
    expect(screen.getByText('大小周不谈')).toBeTruthy();
  });

  it('keeps pause/resume only: no edit or delete UI on the recruiter page', async () => {
    const user = userEvent.setup();
    renderRecruiterRules({ rulesStage: '成功', proposalsStage: '成功', initialized: true });
    await 挂载到稳定();
    expect(screen.queryByRole('button', { name: '删除' })).toBeNull();
    expect(screen.queryByRole('button', { name: '提交修改' })).toBeNull();
    // 规则行不是可编辑入口：点行不出现编辑框
    await user.click(screen.getByText('大小周不谈'));
    expect(screen.queryByDisplayValue('大小周不谈')).toBeNull();
  });

  it('ready Proposal accepts through the operation and the card closes', async () => {
    const user = userEvent.setup();
    const 视图 = renderRecruiterRules({
      rulesStage: '成功', proposalsStage: '成功', initialized: true,
      提案: [BFFAgent规则就绪提案样本],
      提案走真实水合: true,
      调桩: (桩) => {
        // 挂载水合照常返回就绪卡；accept 之后的完整水合才清空 actionable 清单
        桩.接受Agent规则提案.mockImplementation(async () => {
          桩.读取Agent规则提案列表.mockImplementation(async () => []);
          return BFFAgent规则样本;
        });
      },
    });
    await 挂载到稳定();
    // 卡片由真实挂载水合落屏（不走路过镜头）
    await waitFor(() => expect(screen.getByRole('button', { name: '确认规则' })).toBeTruthy());
    await user.click(screen.getByRole('button', { name: '确认规则' }));
    expect(视图.操作.接受Agent规则提案).toHaveBeenCalledWith(BFFAgent规则就绪提案样本.proposal_id);
    await waitFor(() => expect(screen.queryByRole('button', { name: '确认规则' })).toBeNull());
  });

  it('ready Proposal dismisses and the card leaves without creating a Rule', async () => {
    const user = userEvent.setup();
    const 视图 = renderRecruiterRules({
      rulesStage: '成功', proposalsStage: '成功', initialized: true,
      提案: [BFFAgent规则就绪提案样本],
      提案走真实水合: true,
    });
    await waitFor(() => expect(screen.getByText('双休岗位可推进，大小周岗位拦下')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: '放弃' }));
    expect(视图.操作.放弃Agent规则提案).toHaveBeenCalledWith(BFFAgent规则就绪提案样本.proposal_id);
    await waitFor(() => expect(screen.queryByText('双休岗位可推进，大小周岗位拦下')).toBeNull());
    // dismiss 不创建 Rule：计数仍是原有的 1 条
    expect(screen.getByText('1 条生效')).toBeTruthy();
  });

  it('closing a failed card restores the submitted draft text', async () => {
    const user = userEvent.setup();
    const 视图 = renderRecruiterRules({ rulesStage: '成功', proposalsStage: '成功', initialized: true });
    await 挂载到稳定();
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    await user.type(screen.getByPlaceholderText(/到岗超过/), '竞对在职候选人不接触');
    await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
    // 创建成功即收起输入行：草稿先寄存在页面，等提案终态裁决
    await waitFor(() => expect(screen.queryByPlaceholderText(/到岗超过/)).toBeNull());
    // 提交只有这一次 create：后续任何失败恢复都绝不自动重发
    expect(视图.操作.创建Agent规则提案).toHaveBeenCalledTimes(1);
    // 提案翻转为 failed（interpretation_failed）：失败卡上屏对应安全文案
    act(() => {
      镜头.覆盖 = {
        ...镜头.覆盖,
        招聘规则提案: {
          [BFFAgent规则解释中提案样本.proposal_id]: {
            ...BFFAgent规则解释中提案样本,
            state: 'failed' as const,
            failure_code: 'interpretation_failed' as const,
          },
        },
      };
      镜头.版本 += 1;
      for (const 通知 of 镜头.订阅们) 通知();
    });
    expect(screen.getByText('内容无法可靠转换为规则，可编辑后重新提交')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '关闭' }));
    // §7.3：关闭后原草稿回到输入行，供再次明确提交
    expect((screen.getByPlaceholderText(/到岗超过/) as HTMLInputElement).value).toBe('竞对在职候选人不接触');
    expect(screen.queryByText('内容无法可靠转换为规则，可编辑后重新提交')).toBeNull();
    // 关闭恢复草稿后也没有第二次 create：重发必须由用户显式点击
    expect(视图.操作.创建Agent规则提案).toHaveBeenCalledTimes(1);
  });

  it('unmount 后回到本页：关闭失败卡仍还原跨导航寄存的原草稿', async () => {
    // §7.3「关闭后保留用户原草稿」必须跨导航存活：寄存在 sessionStorage 而不是页面 useState
    const user = userEvent.setup();
    const 第一屏 = renderRecruiterRules({ rulesStage: '成功', proposalsStage: '成功', initialized: true });
    await 挂载到稳定();
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    await user.type(screen.getByPlaceholderText(/到岗超过/), '竞对在职候选人不接触');
    await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
    await waitFor(() => expect(screen.queryByPlaceholderText(/到岗超过/)).toBeNull());
    // 模拟导航离开再回来：页面卸载重建，原始提案字典里这张卡已翻 failed
    第一屏.unmount();
    renderRecruiterRules({
      rulesStage: '成功', proposalsStage: '成功', initialized: true,
      提案: [{ ...BFFAgent规则解释中提案样本, state: 'failed' as const }],
    });
    expect(screen.getByText('本次规则没有生效')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '关闭' }));
    // 原草稿回到输入行，供再次明确提交
    expect((screen.getByPlaceholderText(/到岗超过/) as HTMLInputElement).value).toBe('竞对在职候选人不接触');
    expect(screen.queryByText('本次规则没有生效')).toBeNull();
  });

  it('accept clears the stored draft: a later failed card for the same ID does not resurrect it', async () => {
    const user = userEvent.setup();
    const 视图 = renderRecruiterRules({
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
    await user.type(screen.getByPlaceholderText(/到岗超过/), '竞对在职候选人不接触');
    await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
    await waitFor(() => expect(screen.queryByPlaceholderText(/到岗超过/)).toBeNull());
    // 提案变成 ready：确认规则 走真实操作层成功收口
    act(() => {
      镜头.覆盖 = {
        ...镜头.覆盖,
        招聘规则提案: {
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
    await waitFor(() => expect(screen.getByText('权威刷新后的规则')).toBeTruthy());
    await 挂载到稳定();
    // 同一提案再翻 failed：寄存已随 accept 清掉，关闭失败卡不得再还原草稿
    act(() => {
      镜头.覆盖 = {
        ...镜头.覆盖,
        招聘规则提案: {
          [BFFAgent规则解释中提案样本.proposal_id]: { ...BFFAgent规则解释中提案样本, state: 'failed' as const },
        },
      };
      镜头.版本 += 1;
      for (const 通知 of 镜头.订阅们) 通知();
    });
    expect(screen.getByText('本次规则没有生效')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '关闭' }));
    // 寄存已清：输入行不弹开，草稿不复活
    expect(screen.queryByPlaceholderText(/到岗超过/)).toBeNull();
    expect(screen.queryByText('本次规则没有生效')).toBeNull();
    expect(视图.操作.接受Agent规则提案).toHaveBeenCalledWith(BFFAgent规则解释中提案样本.proposal_id);
  });

  it('surfaces all seven frozen P6 error copies verbatim', async () => {
    const user = userEvent.setup();
    const 视图 = renderRecruiterRules({ rulesStage: '成功', proposalsStage: '成功', initialized: true });
    await 挂载到稳定();
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    await user.type(screen.getByPlaceholderText(/到岗超过/), '竞对在职候选人不接触');
    for (const [code, 文案] of 冻结文案们) {
      视图.操作.创建Agent规则提案.mockRejectedValue(new BFF错误(400, code, 'rejected'));
      await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
      await waitFor(() => expect(screen.getByText(文案)).toBeTruthy());
      // 每次失败都保留草稿，绝不伪造成功
      expect((screen.getByPlaceholderText(/到岗超过/) as HTMLInputElement).value).toBe('竞对在职候选人不接触');
    }
  });

  it('shows the loading shell without a retry affordance while hydration is in flight', () => {
    renderRecruiterRules({ rulesStage: '进行中', proposalsStage: '进行中', initialized: true });
    expect(screen.getByRole('status', { name: '规则加载中' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '规则加载失败，重试' })).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('button', { name: /手动添加规则/ })).toBeNull();
  });

  it('shows the retry affordance and keeps hydrated rows when a sibling domain failed', () => {
    renderRecruiterRules({ rulesStage: '成功', proposalsStage: '失败', initialized: true });
    expect(screen.getByRole('button', { name: '规则加载失败，重试' })).toBeTruthy();
    // rules 已成功的域保持可见，但不给任何 mutation 控件
    expect(screen.getByRole('switch', { name: `规则：${BFFAgent规则样本.display_text}` })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /手动添加规则/ })).toBeNull();
  });

  it('replaces the auto-deposit copy with explicit confirmation wording', () => {
    renderRecruiterRules({ rulesStage: '成功', proposalsStage: '成功', initialized: true });
    expect(screen.getByText('你确认过的规则才会沉淀到这里，长期约束你的招聘AI代理。')).toBeTruthy();
    expect(screen.queryByText('在任何候选的往来记录里发的叮嘱，都会沉淀到这里，长期约束你的招聘AI代理。')).toBeNull();
  });

  it('renders a safe shell when the session is not initialized', () => {
    renderRecruiterRules({ rulesStage: '成功', proposalsStage: '成功', initialized: false });
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('button', { name: /手动添加规则/ })).toBeNull();
    expect(screen.queryByRole('status', { name: '规则加载中' })).toBeNull();
    expect(screen.queryByRole('button', { name: '规则加载失败，重试' })).toBeNull();
  });

  it('renders a safe shell when the active role is not the recruiter', () => {
    // candidate 会话直访 /hr/agent-settings：不出任何规则行/开关/控件，也不索引别角色的水合
    renderRecruiterRules({ rulesStage: '成功', proposalsStage: '成功', initialized: true, 主体角色: 'candidate' });
    expect(screen.queryByRole('switch', { name: `规则：${BFFAgent规则样本.display_text}` })).toBeNull();
    expect(screen.queryByRole('button', { name: /手动添加规则/ })).toBeNull();
    expect(screen.queryByRole('status', { name: '规则加载中' })).toBeNull();
    expect(screen.queryByRole('button', { name: '规则加载失败，重试' })).toBeNull();
    expect(screen.queryByText('1 条生效')).toBeNull();
  });
});

describe('企业代理设置 · Mock 原型分支', () => {
  it('空规则时提交键不可用', async () => {
    const user = userEvent.setup();
    renderRecruiterRules({ mode: 'mock' });
    await 挂载到稳定();
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    expect((screen.getByRole('button', { name: '提交给AI代理理解' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Mock mode shows choice rows without switches and confirms before adding', async () => {
    const user = userEvent.setup();
    const 视图 = renderRecruiterRules({ mode: 'mock' });
    // 2026-08-31 定稿：Mock 规则不渲染开关（规则来自叮嘱与选择，不是要维护的配置）
    expect(screen.getByText('不透露 HC 剩余数量与紧迫度')).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getByText('3 条生效')).toBeTruthy();
    await 挂载到稳定();
    // 「哪些事先问你」：真选项，点击即改选中态
    const 回绝 = screen.getByRole('button', { name: '直接回绝' });
    expect(回绝.getAttribute('aria-pressed')).toBe('false');
    await user.click(回绝);
    expect(screen.getByRole('button', { name: '直接回绝' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: /手动添加规则/ }));
    expect(screen.queryByLabelText('规则范围')).toBeNull();
    await user.type(screen.getByPlaceholderText(/到岗超过/), '只招上海本地的候选');
    await user.click(screen.getByRole('button', { name: '提交给AI代理理解' }));
    expect(视图.操作.创建Agent规则提案).not.toHaveBeenCalled();
    expect(screen.getByText('只招上海本地的候选')).toBeTruthy();
    expect(screen.getByRole('button', { name: '确认规则' })).toBeTruthy();
    expect(screen.getByText('3 条生效')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '确认规则' }));
    expect(screen.queryByRole('button', { name: '确认规则' })).toBeNull();
    expect(screen.getByText('4 条生效')).toBeTruthy();
  });
});
