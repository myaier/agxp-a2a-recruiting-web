// 工作经历 测试的共用桩与构造辅助：mock 桩函数、宿主渲染（组件经 登记工作经历 注入）、
// 存简历调用提取与教育 fixture。由 src/屏幕/工作经历.test.tsx 按冻结归属拆出时提取；
// vitest 按测试文件隔离实例化，不跨文件共享状态。原文件头注：
// 工作经历 行业选择 Backend 接入测试（Task 4；editor-catalog-fullscreen Task 3 起承载
// 从 72% 底部弹层换成全屏选择外壳，目录行为不变）：
// Backend 按需 查询Taxonomy('industries')，点 selectable 叶子写 行业引用；
// 继续自由输入清除引用。Mock 保留 常见行业 不变。
// //
// 候选 onboarding 简历预填（Spec §8 /experience，Task 6）：首挂载同步用 取工作页预填
// 一次物化四分区（空服务端且空页面才物化；附加教育只在前四页形成的 educations[0] 之后
// 追加 slice(1)），临时编号 prefill: 前缀、隐私默认 隐藏:false（契约B：企业屏蔽不再写
// hidden）、internship 缺席不设置、证书年份空串；unresolvedCount 只进保存点击的 轻提示
// （还有 N 处需要选择目录或补充必填项），不渲染任何提示节点；确认 work 分区只在既有
// 保存成功后。
// 契约B（2026-09-17 聊天与推荐展示修复 Task 1）：经历企业屏蔽开关/徽标读隐私域页面状态
// （屏蔽名单 + 对现雇主隐身），本桩随之补默认 屏蔽名单/设置开关 与三个隐私操作桩。

import { render } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { 创建空候选预填状态, type 候选预填状态 } from '../状态/后端/类型';
import { type 屏蔽项, type 简历经历段, type 简历教育段, type 简历证书 } from '../数据/类型';
import { type 候选引导建档草稿 } from '../数据/资料缓存';

export const mock跳转 = vi.fn();
export const mock返回 = vi.fn();
/** 合同 A 的退出出口之一：无来路证明（刷新/深链/越级）时安全替换到来源固定路径，
 *  日常分区 URL 归一（旧 /experience?from=resume → work 分区）也走它 */
export const mock替换跳转 = vi.fn();
export const mock轻提示 = vi.fn();
export const mock确认分区 = vi.fn();
export const mock更新草稿 = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let mock应用状态: any;

export const 简历经历初始 = [
  {
    编号: 'e1',
    组织编号: 'org_bytedance',
    公司: '字节跳动',
    行业: '',
    职位: '后端开发',
    开始: '2019-06',
    结束: null,
    内容: '主导交易网关重建',
    隐藏: true,
  },
];

// Task 6：宿主组件——派发 存简历 就地合并列表并触发一次真实重渲染（模拟根 Resume
// reducer 换新对象后的渲染），否则物化种入后受控列表不更新、卡片不出现。
let 触发重渲染: (() => void) | null = null;

import type 工作经历组件 from './工作经历';
let 已登记: typeof 工作经历组件 | null = null;

/** suite 加载后登记被测组件（helper 不能静态 import 组件，避免 vi.mock 工厂环）。 */
export function 登记工作经历(组件: typeof 工作经历组件) {
  已登记 = 组件;
}

/** 入口形：字符串（只有 URL）或完整位置（带 state —— 日常编辑来路证明） */
export type 入口形 = string | { pathname: string; search?: string; state?: unknown };

export function 宿主({ 入口 }: { 入口?: 入口形 } = {}) {
  const [, 设代] = useState(0);
  // 渲染期登记（早于子组件的 useLayoutEffect 种入派发）；设代 在同一挂载内稳定
  触发重渲染 = () => 设代((代) => 代 + 1);
  const 组件 = 已登记!;
  return (
    <MemoryRouter initialEntries={[入口 ?? '/experience']}>
      <组件 />
    </MemoryRouter>
  );
}

export function render工作经历(选项: {
  数据源?: 'backend' | 'mock';
  查询Taxonomy?: ReturnType<typeof vi.fn>;
  查询Institution?: ReturnType<typeof vi.fn>;
  保存简历?: ReturnType<typeof vi.fn>;
  /** Task 3：聚合保存链在简历保存成功之后调它（个人优势） */
  保存个人优势?: ReturnType<typeof vi.fn>;
  /** Task 3：已水合的权威个人优势（资料页优势正文的初值来源之一） */
  个人优势?: string;
  /** 合同 C：公司选择抽屉的目录搜索/创建（Backend 走操作层） */
  搜索组织?: ReturnType<typeof vi.fn>;
  创建组织?: ReturnType<typeof vi.fn>;
  预填?: 候选预填状态;
  经历?: 简历经历段[];
  教育?: 简历教育段[];
  技能?: string[];
  证书?: 简历证书[];
  基本信息?: { 真名: string; 开始工作年: string; 身份: '在校' | '在职' | '离职' | '' };
  作品集链接?: string;
  /** J-PILOT-02 Task 4：会话恢复出的建档草稿（更新回写同一对象并重渲染，贴近 Provider）*/
  建档?: 候选引导建档草稿;
  /** 简历编辑显式来源（Task 1/2）：带 from=resume 的入口；日常分区用例传完整位置
   *  （pathname + search + 来路 state）以便退出走「退一格」分支 */
  入口?: 入口形;
  /** 契约B：隐私域页面状态（默认空名单 + 总开关关；Backend 水合语义由用例自行播种）*/
  屏蔽名单?: 屏蔽项[];
  /** 契约B：「对现雇主隐身」（employer_privacy_enabled）——derived 屏蔽的生效开关 */
  雇主隐身?: boolean;
  /** 契约B：Backend 隐私快照镜像（缺省 = 未读，屏幕按「不能当无屏蔽」处理）*/
  隐私快照?: unknown;
  /** 契约B：隐私写/读操作桩（缺省成功 no-op；用例按需替换） */
  添加组织屏蔽?: ReturnType<typeof vi.fn>;
  解除组织屏蔽?: ReturnType<typeof vi.fn>;
  重读隐私?: ReturnType<typeof vi.fn>;
}) {
  const 数据源 = 选项.数据源 ?? 'backend';
  mock应用状态 = {
    数据源模式: 数据源,
    目录查询:
      数据源 === 'backend'
        ? {
            查询Location: vi.fn(),
            查询Taxonomy: 选项.查询Taxonomy ?? vi.fn(),
            查询Institution: 选项.查询Institution ?? vi.fn(),
          }
        : null,
    状态: {
      简历经历: 选项.经历 ?? 简历经历初始,
      简历教育: 选项.教育 ?? [],
      简历技能: 选项.技能 ?? [],
      简历证书: 选项.证书 ?? [],
      个人优势: 选项.个人优势 ?? '',
      简历作品集链接: 选项.作品集链接 ?? '',
      基本信息: 选项.基本信息 ?? { 真名: '沈', 开始工作年: '2017', 身份: '在职' as const },
      引导预填: 选项.建档 === undefined ? null : { 城市们: [], 职位: [], 建档: 选项.建档 },
      // 契约B：企业屏蔽开关/徽标的可观察规则读这两块（同企业各入口共用权威状态）
      屏蔽名单: 选项.屏蔽名单 ?? [],
      设置开关: { 对现雇主隐身: 选项.雇主隐身 ?? false },
    },
    后端状态: {
      候选预填状态: 选项.预填 ?? 创建空候选预填状态(),
      主体: { subject_id: 'sub_1', roles: [], last_used_role: 'candidate' },
      ...(选项.隐私快照 !== undefined ? { 隐私快照: 选项.隐私快照 } : {}),
    },
    派发: vi.fn((动作: { 型?: string; 经历?: 简历经历段[]; 教育?: 简历教育段[]; 技能?: string[]; 证书?: 简历证书[]; 链接?: string }) => {
      if (动作.型 === '存简历') {
        mock应用状态.状态.简历经历 = 动作.经历 ?? mock应用状态.状态.简历经历;
        mock应用状态.状态.简历教育 = 动作.教育 ?? mock应用状态.状态.简历教育;
        mock应用状态.状态.简历技能 = 动作.技能 ?? mock应用状态.状态.简历技能;
        mock应用状态.状态.简历证书 = 动作.证书 ?? mock应用状态.状态.简历证书;
        触发重渲染?.();
      }
      // 模拟全局 reducer：存作品集链接 写权威切片（Backend 该切片由 GET 水合，Mock 由输入写）
      if (动作.型 === '存作品集链接') {
        mock应用状态.状态.简历作品集链接 = 动作.链接 ?? '';
        触发重渲染?.();
      }
    }),
    操作: {
      保存简历: 选项.保存简历 ?? vi.fn(async () => {}),
      保存个人优势: 选项.保存个人优势 ?? vi.fn(async () => {}),
      确认候选Onboarding预填分区: mock确认分区,
      更新候选建档草稿: mock更新草稿.mockImplementation((建档: 候选引导建档草稿) => {
        mock应用状态.状态.引导预填 = { 城市们: [], 职位: [], 建档 };
        触发重渲染?.();
      }),
      // 合同 C：公司选择抽屉的目录操作（Backend 走操作层；Mock 用本地模拟目录）
      搜索组织: 选项.搜索组织 ?? vi.fn(async () => ({ items: [], next_cursor: null })),
      创建组织: 选项.创建组织 ?? vi.fn(async () => {
        throw new Error('未预期的组织创建');
      }),
      // 契约B：隐私操作桩（缺省成功 no-op —— 断言零写用 not.toHaveBeenCalled，
      // 需要提交/回读语义的用例自行替换）
      添加组织屏蔽: 选项.添加组织屏蔽 ?? vi.fn(async () => {}),
      解除组织屏蔽: 选项.解除组织屏蔽 ?? vi.fn(async () => {}),
      重读隐私: 选项.重读隐私 ?? vi.fn(async () => {}),
    },
  };
  const 视图 = render(<宿主 入口={选项.入口} />);
  return {
    派发: mock应用状态.派发 as ReturnType<typeof vi.fn>,
    重渲染: () => 触发重渲染?.(),
    卸载: () => 视图.unmount(),
  };
}

/** 从派发记录里取 存简历 动作（预填种入与页面编辑共用这一条通道） */
export function 存简历调用们(派发: ReturnType<typeof vi.fn>) {
  return (派发.mock.calls as { 型: string; 经历: 简历经历段[]; 教育: 简历教育段[]; 技能: string[]; 证书: 简历证书[] }[][])
    .filter(([动作]) => 动作.型 === '存简历')
    .map(([动作]) => 动作);
}

// ── J-PILOT-02 Task 4：资料页最后一屏的接线 ──────────────────────
// 反例覆盖：社招无工作经历可前进、不完整教育不得靠保存跳过门槛、作品集链接三态、
// 未完成编辑层刷新恢复与取消丢弃、删除已存条目登记明确删除。
export const 完整教育: 简历教育段 = {
  编号: 'edu1', 学校: '复旦大学', 学历: '硕士', 专业: '计算机', 开始: '2019-09', 结束: '2023-06',
};
