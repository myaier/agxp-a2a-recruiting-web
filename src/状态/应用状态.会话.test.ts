// 应用状态 · 会话（登录/切主体/目录水合/review 会话边界）
// 由 src/状态/应用状态.test.ts 按冻结归属拆出：登录/切主体/目录水合/历史 review 会话边界→会话。

import { createElement } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 初始状态, 归约, use应用状态, 应用状态提供者 } from './应用状态';
import { BFF主体样本, BFF简历样本, BFF岗位样本, BFF意向样本, 页面岗位样本, BFF企业关系样本, BFF公开企业样本, BFF招聘方档案样本, BFFAgent规则样本, BFF意向Agent规则样本 } from '../测试/BFF样本';
import { BFF错误 } from '../数据/HTTP客户端';
import { type BFF招聘方档案 } from '../数据/BFF契约';
import { type P7会话项 } from '../数据/招聘数据源/真人会话';
import { type HTTP招聘数据源 } from '../数据/HTTP招聘数据源';
import { type 页面简历快照, type 页面意向快照 } from '../数据/招聘数据源类型';
import { type 规则 } from '../数据/类型';
import { 从BFF简历 } from '../数据/后端映射';
import { 候选引导草稿键, 写候选引导草稿 } from '../数据/资料缓存';
import userEvent from '@testing-library/user-event';
import { deferred, 创建后端桩, 通过测试手机登录, 假WebSocket, 创建Map存储, current派发引导预填 } from './应用状态.测试辅助';

beforeEach(() => {
  try {
    globalThis.sessionStorage.clear();
  } catch {
    // 个别存储降级测试会故意提供不可用实现。
  }
});
// ── Provider 会话 / 角色水合 / 401 ───────────────────────────────
// Task 6：Context 接入后端数据源后的会话恢复与角色切换顺序。
// 注：仓库未装 @testing-library/jest-dom，故不用 toHaveTextContent/toBeInTheDocument；
// 用 getByText/getByRole（找不到即抛）+ toBe 定义来等价断言。


describe('应用状态提供者 后端会话', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    假WebSocket.构造记录 = [];
    vi.stubGlobal('WebSocket', 假WebSocket);
  });

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
    // P3：屏蔽项新增必需元数据 —— 拉黑路径固定 手动添加/有效 + 合成组织编号
    expect(下一.屏蔽名单[0]).toEqual({
      编号: 'B-04', 名称: '示例公司', 首字: '示', 理由: '你手动加入 · 双向不可见', 时间: '刚刚',
      组织编号: 'org_local_04', 来源: '手动添加', 组织状态: '有效',
    });
  });

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

  // 第二批（2026-09-09）删筛选后：规则数据与两个 canonical 入口不动 —— 两端 新增 / 改 / 删 动作照常
  it('删筛选后两端规则 新增 / 改 / 删 动作照常（第二批 验收6）', () => {
    const 一 = 归约(初始状态, { 型: '新增规则', 内容: '不接受大小周', 来源: '测试' });
    const 新 = 一.全局规则.at(-1)!;
    const 二 = 归约(一, { 型: '改规则', 编号: 新.编号, 内容: '大小周不谈' });
    expect(二.全局规则.find((条) => 条.编号 === 新.编号)?.内容).toBe('大小周不谈');
    const 三 = 归约(二, { 型: '删规则', 编号: 新.编号 });
    expect(三.全局规则.some((条) => 条.编号 === 新.编号)).toBe(false);

    const 甲 = 归约(初始状态, { 型: '企业新增规则', 内容: '必须双休', 来源: '测试' });
    const 企新 = 甲.企业规则.at(-1)!;
    expect(企新).toMatchObject({ 内容: '必须双休', 来源: '测试', 生效: true });
    const 乙 = 归约(甲, { 型: '企业改规则', 编号: 企新.编号, 内容: '双休是底线' });
    expect(乙.企业规则.find((条) => 条.编号 === 企新.编号)?.内容).toBe('双休是底线');
    const 丙 = 归约(乙, { 型: '企业删规则', 编号: 企新.编号 });
    expect(丙.企业规则.some((条) => 条.编号 === 企新.编号)).toBe(false);
  });

  // Task 2：P6 Backend 水合/清空动作必须在根归约里路由到 Agent 规则域 ——
  // 根 switch 是逐项列 case，漏列会被 default 静默吞掉
  it('P6 水合与清空动作经根归约路由到 Agent 规则域', () => {
    const 后端全局规则: 规则 = {
      编号: 'rul_0123456789abcdef0123456789abcdef',
      内容: '大小周不谈',
      来源: '全局 · 更新于 2026-08-27',
      生效: true,
      作用域: { 类型: '全局' },
      服务端版本: 3,
      服务端状态: 'active',
    };
    const 后端意向规则: 规则 = {
      编号: 'rul_fedcba9876543210fedcba9876543210',
      内容: '双休是底线；隔周六可谈',
      来源: '意向「AI 产品经理」 · 更新于 2026-08-27',
      生效: true,
      作用域: { 类型: '意向', 意向编号: 'int_0123456789abcdef0123456789abcdef' },
      服务端版本: 1,
      服务端状态: 'active',
    };
    const 后端招聘规则: 规则 = {
      编号: 'rul_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      内容: '不透露 HC 剩余数量',
      来源: '全局 · 更新于 2026-08-27',
      生效: true,
      作用域: { 类型: '全局' },
      服务端版本: 2,
      服务端状态: 'active',
    };

    const 水合候选 = 归约(初始状态, {
      型: '水合后端候选规则', 全局: [后端全局规则], 意向级: [后端意向规则],
    });
    expect(水合候选.全局规则).toEqual([后端全局规则]);
    expect(水合候选.意向级规则).toEqual([后端意向规则]);

    const 水合招聘 = 归约(水合候选, { 型: '水合后端招聘规则', 规则: [后端招聘规则] });
    expect(水合招聘.企业规则).toEqual([后端招聘规则]);

    const 清后 = 归约(水合招聘, { 型: '清后端Agent规则' });
    expect(清后.全局规则).toEqual([]);
    expect(清后.意向级规则).toEqual([]);
    expect(清后.企业规则).toEqual([]);
  });

  it('消息 action 删除真实存在的未读键', () => {
    const 下一 = 归约(初始状态, { 型: '读消息', 编号: 'X-01' });
    expect(初始状态.消息未读['X-01']).toBe(4);
    expect(下一.消息未读['X-01']).toBeUndefined();
  });

  // Task 3 Step 6：Rule 与 Intention 谁先到都不能永久隐藏或错组规则 ——
  // 候选 Rules 先落地（意向快照还空着 → orphan intention scope 整条省略），
  // 意向后到时 Provider effect 用同一 raw Rule 重算归组。
  it('P6 候选规则先到、意向后到：全局立即出现，意向级随后自动归组', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 意向规则 = BFF意向Agent规则样本; // scope.intention_id = int_0123456789abcdef0123456789abcdef
    vi.mocked(后端.读取Agent规则)
      .mockResolvedValue([BFFAgent规则样本, 意向规则]);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 此时意向快照仍是空的（mount 只水合了空意向）
    await act(async () => {
      await 当前.操作.刷新Agent规则();
    });
    // 全局 Rule 立即出现；orphan intention Rule 不许并入全局，也不显示假分组
    expect(当前.状态.全局规则.map((rule) => rule.编号)).toEqual([BFFAgent规则样本.rule_id]);
    expect(当前.状态.意向级规则).toEqual([]);
    const resolveIntentions = (服务端: Record<string, typeof BFF意向样本>) => {
      当前.派发({ 型: '水合后端意向', 快照: { 列表: [], 服务端 } });
    };
    act(() => resolveIntentions({
      int_0123456789abcdef0123456789abcdef: BFF意向样本,
    }));
    await waitFor(() => {
      expect(当前.状态.意向级规则.map((rule) => rule.编号)).toEqual([BFF意向Agent规则样本.rule_id]);
    });
    // 全局那条保持原样：重算不重复、不丢行
    expect(当前.状态.全局规则.map((rule) => rule.编号)).toEqual([BFFAgent规则样本.rule_id]);
  });

  it('应用操作公开 shape 在拆分后保持不变', () => {
    function 探针() {
      const { 操作 } = use应用状态();
      return createElement('output', null, Object.keys(操作).sort().join('|'));
    }
    render(createElement(应用状态提供者, null, createElement(探针)));
    expect(screen.getByText([
      '保存个人优势', '保存首次意向', '保存意向', '保存简历', '删除岗位', '删除意向',
      '加载候选账号档案', '保存候选头像', '删除候选头像',
      // J-PILOT-02 Task 9（Global 8 冻结契约）：完成注册前的本人资源核对
      '完成候选Onboarding',
      '切身份', '发布岗位', '完成手机登录', '开始手机登录', '取消手机登录尝试', '归档岗位', '微信登录',
      '更新岗位', '退出登录', '重开岗位',
      // P0 修复 Task 2：招聘方数据显式重试（会话操作）
      '重新水合招聘方数据',
      // P1C 组织域方法（组织操作）；2026-09-13 合同 A：目录搜索/创建/读取三操作
      '选择企业关系', '保存未认证公司声明', '保存招聘方档案', '读取企业管理员申请',
      '创建企业管理员申请', '取消企业管理员申请', '接受企业邀请', '替换招聘方头像',
      '保存企业档案', '上传并发布企业媒体', '移除企业媒体', '读取公开企业',
      '搜索组织', '创建组织', '读取目录企业',
      // P0 修复 Task 1：招聘方组织链重试
      '重新水合招聘方组织',
      // P3 隐私域方法（隐私操作）
      // 2026-09-13 合同 A/B：隐私域搜索代理（搜索可屏蔽组织）删除，目录查询走 组织操作.搜索组织
      '设置雇主隐私', '设置披露偏好', '添加组织屏蔽', '解除组织屏蔽',
      // P6 Agent 规则域方法（Agent规则操作）
      '刷新Agent规则', '创建Agent规则提案', '创建Agent规则替换提案', '刷新Agent规则提案',
      '接受Agent规则提案', '放弃Agent规则提案', '切换Agent规则', '删除Agent规则',
      '加载Agent设置', '保存Agent设置',
      // P4 发现推荐域读 + Task 4 refresh/feedback + Task 5 委托方法（发现推荐操作）
      '设置发现推荐范围', '加载候选岗位', '读取候选岗位详情',
      '加载招聘候选', '加载招聘已筛', '读取招聘候选详情',
      '刷新候选岗位', '标记岗位不感兴趣', '刷新招聘候选',
      '设置候选收藏', '淘汰候选', '撤销淘汰候选',
      '委托候选岗位', '委托招聘候选', '刷新委托',
      // J-PILOT-01 Task 3：待核对投影与原命令核对口（发现推荐操作）
      '取候选待核对命令', '核对候选委托',
      // P2 附件简历域方法（附件简历操作）；P5 追加委托前的权威库准备
      '刷新附件简历', '创建附件简历', '替换附件简历', '删除附件简历', '请求附件解析', '下载附件简历',
      '准备候选委托简历',
      // P5 MatchCase 域方法（MatchCase操作）：scope 注册、summary 权威读取、工作区/
      // 历史窗口、详情直读、S0–S3 命令、叮嘱与披露后的简历 PDF 租约
      '设置P5范围', '加载摘要', '加载工作区', '追加工作区', '刷新工作区',
      '加载历史', '追加历史', '刷新历史',
      '读取详情', '回答事实', '提交简历', '决定S0', '决定S1', '决定S2', '决定S3',
      '回答对话', '重新考虑',
      '新增叮嘱', '读取简历PDF',
      // J-PILOT-01 Task 2：候选连续集合读取（MatchCase操作）
      '加载连续列表', '追加连续列表', '刷新连续列表', '读取连续详情',
      // J-PILOT-01 Task 3：失败初评动作（MatchCase操作）
      '重试连续记录', '归档连续记录',
      // P7 真人会话域方法（真人会话操作）：收件箱/会话可见范围注册、列表/详情/消息
      // 读取与分页、发送对账、显式放弃、forward-only 已读与失效通知
      '设置P7收件箱范围', '设置P7会话范围', '加载会话列表', '追加会话列表',
      '读取真人会话', '追加更早消息', '发送真人消息', '放弃真人消息意图',
      '提交真人已读', '使真人会话失效',
      // P8 控制面域方法（P8账号控制面操作，Task 5 起全量组合）：范围登记、
      // 凭证/会话按需读取、换绑开始/完成与退出其他设备、导出恢复/创建/刷新/废弃/
      // 下载地址与账号注销；Task 6 起加合规反馈、Task 7 起加上下文举报（两法齐备）
      '设置P8账号范围', '加载P8凭证', '加载P8会话',
      '开始P8手机号换绑', '完成P8手机号换绑', '退出P8其他设备',
      '恢复P8数据导出', '创建P8数据导出', '刷新P8数据导出',
      '废弃P8数据导出', '取P8数据导出下载地址', '请求P8账号注销',
      '提交P8反馈', '提交P8举报',
      // 候选 onboarding 简历预填域方法（简历预填操作）：恢复（路由边界）、激活（上传页
      // 显式新一轮）、权威解析同步、显式重试、继续手填、分区确认与全量清理
      '恢复候选Onboarding预填', '激活候选Onboarding预填', '同步候选Onboarding解析',
      '重试候选Onboarding预填', '继续手填候选Onboarding', '确认候选Onboarding预填分区',
      '清候选Onboarding预填',
      // JD 导入域方法（JD导入操作）：创建（consent 后 POST）与轮询读取
      '创建JD导入', '读取JD导入',
      // 接触记录域方法（接触记录操作）：候选「谁接触过我」首载/刷新与分页追加
      '加载接触记录', '追加接触记录',
      // 候选实名域方法（候选实名操作）：summary 读取、材料提交、取消与待定意图重置
      '加载候选实名', '提交候选实名', '取消候选实名', '重置候选实名提交意图',
      // J-PILOT-02 Task 2（建档草稿操作）：建档草稿的同步更新口
      '更新候选建档草稿',
      // stg 契约对齐 2026-09-14（Onboarding操作）：me/onboarding 权威重读与角色完成
      '刷新Onboarding', '完成角色Onboarding',
    ].sort().join('|'))).toBeTruthy();
  });

  // JD 导入：防止「类型存在但 Provider 没暴露」的假接线 —— Backend recruiter Provider
  // 必须真正 spread 出两个可调用方法。
  it('Backend recruiter Provider 暴露 JD 导入创建与读取方法', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('recruiter');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(typeof 当前.操作.创建JD导入).toBe('function');
    expect(typeof 当前.操作.读取JD导入).toBe('function');
  });

  // 接触记录：Backend candidate Provider 必须真正 spread 出两个可调用方法；
  // Mock Provider 创建零 contact-events 请求。
  it('Backend candidate Provider 暴露接触记录加载与追加方法，Mock 零 contact 请求', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(typeof 当前.操作.加载接触记录).toBe('function');
    expect(typeof 当前.操作.追加接触记录).toBe('function');
    expect(后端.读取接触事件).not.toHaveBeenCalled();

    const 取数 = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', 取数);
    let 模拟当前!: ReturnType<typeof use应用状态>;
    function 模拟探针() { 模拟当前 = use应用状态(); return null; }
    render(createElement(应用状态提供者, null, createElement(模拟探针)));
    await act(async () => {
      await 模拟当前.操作.加载接触记录();
      await 模拟当前.操作.追加接触记录();
    });
    expect(取数).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  // 候选实名：Backend candidate Provider 必须播种空快照并真正 spread 四个方法，
  // FE-MC 的 加载摘要 与 加载候选实名 同时存在；Mock 零实名请求。
  it('Backend candidate Provider 播种候选实名快照并暴露四方法，Mock 零实名请求', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.候选实名).toEqual({ 阶段: '未开始', 摘要: null, 刷新中: false, 错误: null });
    expect(typeof 当前.操作.加载摘要).toBe('function');
    expect(typeof 当前.操作.加载候选实名).toBe('function');
    expect(typeof 当前.操作.提交候选实名).toBe('function');
    expect(typeof 当前.操作.取消候选实名).toBe('function');
    expect(typeof 当前.操作.重置候选实名提交意图).toBe('function');
    await act(async () => { await 当前.操作.加载候选实名(); });
    expect(后端.读取候选实名).toHaveBeenCalledTimes(1);

    const 取数 = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', 取数);
    let 模拟当前!: ReturnType<typeof use应用状态>;
    function 模拟探针() { 模拟当前 = use应用状态(); return null; }
    render(createElement(应用状态提供者, null, createElement(模拟探针)));
    await act(async () => {
      await 模拟当前.操作.加载候选实名();
      await expect(模拟当前.操作.提交候选实名({
        legalName: 'Fixture Candidate',
        documentType: 'passport',
        evidence: [new File([new Uint8Array([1])], 'front.png', { type: 'image/png' })],
      })).resolves.toBe('已换代');
      await expect(模拟当前.操作.取消候选实名()).resolves.toBe('已换代');
      模拟当前.操作.重置候选实名提交意图();
    });
    expect(取数).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  // ── stg 契约对齐 2026-09-14（Spec §5）：Onboarding 水合顺序与完成事实清理 ──────────
  it('mount 恢复读取 Onboarding：主体提交前已落成功快照', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    vi.mocked(后端.读取Onboarding).mockResolvedValue({
      roles: [{ role: 'candidate', status: 'active', completed_at: '2026-09-14T08:00:00Z' }],
    });
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.已登录).toBe(true));
    expect(后端.读取Onboarding).toHaveBeenCalledTimes(1);
    expect(当前.后端状态.Onboarding).toEqual({
      阶段: '成功',
      数据: { roles: [{ role: 'candidate', status: 'active', completed_at: '2026-09-14T08:00:00Z' }] },
    });
  });

  it('Onboarding GET 失败不阻断登录：已登录仍为 true、运行态落失败', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取Onboarding).mockRejectedValue(new BFF错误(503, 'recruitment_service_unavailable', '不可用'));
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端 as unknown as HTTP招聘数据源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.已登录).toBe(true));
    expect(当前.后端状态.Onboarding.阶段).toBe('失败');
  });

  it('last_used_role=null 的 mount 恢复不读 Onboarding（选择身份后由切身份刷新）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩(null);
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端 as unknown as HTTP招聘数据源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(后端.读取Onboarding).not.toHaveBeenCalled();
  });

  it('切身份成功后按新角色刷新 Onboarding（不用旧空 roles 判新角色不存在）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.确保角色).mockResolvedValue({
      ...BFF主体样本,
      roles: [
        { role: 'candidate' as const, status: 'active' as const },
        { role: 'recruiter' as const, status: 'active' as const },
      ],
      last_used_role: 'recruiter',
    });
    vi.mocked(后端.记录当前角色).mockResolvedValue({
      ...BFF主体样本,
      roles: [
        { role: 'candidate' as const, status: 'active' as const },
        { role: 'recruiter' as const, status: 'active' as const },
      ],
      last_used_role: 'recruiter',
    });
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端 as unknown as HTTP招聘数据源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.已登录).toBe(true));
    const 登录后读数 = vi.mocked(后端.读取Onboarding).mock.calls.length;
    await 当前.操作.切身份('招聘方');
    expect(vi.mocked(后端.读取Onboarding).mock.calls.length).toBeGreaterThan(登录后读数);
    // 刷新起步把上个角色的快照摊平，再按新主体提交
    expect(当前.后端状态.Onboarding.阶段).toBe('成功');
  });

  it('候选已完成事实作废旧草稿与预填恢复：不触发回访拦截或自动重放', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    // 完成事实 + 刷新前留下的旧建档草稿（session 存储）
    vi.mocked(后端.读取Onboarding).mockResolvedValue({
      roles: [{ role: 'candidate', status: 'active', completed_at: '2026-09-14T08:00:00Z' }],
    });
    const 范围 = { 模式: 'backend' as const, 环境: 'stg' as const, 账号: BFF主体样本.subject_id };
    写候选引导草稿(sessionStorage, 范围, {
      城市们: ['上海市'],
      职位: ['产品经理'],
      建档: { 资料: { 个人优势: '一半' }, 位置: { pathname: '/onboard/wizard', search: '?stage=salary' } },
    } as never);
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端 as unknown as HTTP招聘数据源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.已登录).toBe(true));
    await waitFor(() => expect(当前.状态.引导预填).toBeNull());
    expect(sessionStorage.getItem(候选引导草稿键(范围))).toBeNull();
    // 普通编辑输入（资料缓存等账号仓）不被这一清理触碰
    expect(当前.状态.资料缓存范围键).not.toBe('');
  });

  it('Backend 恢复会话与主体，角色完成后才派发切身份', async () => {
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    function 探针() {
      const { 后端状态, 操作 } = use应用状态();
      return createElement('button', { onClick: () => 操作.切身份('招聘方') }, 后端状态.初始化);
    }
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(探针)));
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('完成'));
    await userEvent.click(screen.getByRole('button'));
    expect(后端.确保角色).toHaveBeenCalledWith('recruiter');
    expect(后端.记录当前角色).toHaveBeenCalledWith('recruiter');
    expect(后端.确保角色.mock.invocationCallOrder[0]).toBeLessThan(后端.记录当前角色.mock.invocationCallOrder[0]);
  });

  // P7 Task 2：P7 内存快照随主体基串（subject + 角色）转移清空；
  // 任何 P7 值（会话项、消息正文、幂等键）都不写 localStorage/sessionStorage。
  it('P7 会话状态随角色转移清空且不落任何持久化', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 会话行: P7会话项 = {
      conversationId: '3003', caseId: 'mc_3003', kind: 'human_handoff',
      lastMessage: null, lastActivityAt: '2026-08-30T01:00:00Z', unreadCount: 1,
      contextStatus: 'available',
      context: { primaryLabel: '后端工程师', secondaryLabel: '上海', jobRef: null, resumeRef: null },
    };
    vi.mocked(后端.读取会话列表).mockResolvedValue({ items: [会话行], nextCursor: null });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    const 会话存储 = 创建Map存储();
    vi.stubGlobal('sessionStorage', 会话存储);
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await act(async () => {
      await 当前.操作.加载会话列表('candidate', true);
    });
    expect(当前.后端状态.P7收件箱.candidate.items).toEqual([会话行]);
    const setItem调用 = () => [
      ...vi.mocked(localStorage.setItem).mock.calls,
      ...vi.mocked(会话存储.setItem).mock.calls,
    ].map((调用) => JSON.stringify(调用));
    const 写入前 = setItem调用().length;
    // 切身份 = 角色转移：P7 域整体摊平（收件箱/详情/消息页回空底座）
    await act(async () => {
      await 当前.操作.切身份('招聘方');
    });
    expect(当前.后端状态.P7收件箱.candidate.items).toEqual([]);
    expect(当前.后端状态.P7会话详情).toEqual({});
    expect(当前.后端状态.P7消息页).toEqual({});
    // P7 值绝不进持久化：新增写入里既无会话坐标也无消息正文
    for (const 写入 of setItem调用().slice(写入前)) {
      expect(写入).not.toContain('3003');
      expect(写入).not.toContain('后端工程师');
    }
  });

  // P7 Task 5：Backend 登录后挂起同源事件连接；Mock 模式零连接。
  it('Backend 登录后挂起一条同源事件连接，Mock 模式零连接', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await waitFor(() => expect(假WebSocket.构造记录.length).toBeGreaterThanOrEqual(1));
    expect(假WebSocket.构造记录[0]).toContain('/api/v1/events/live');
    const 构造数 = 假WebSocket.构造记录.length;
    // 同一 Provider 的 Mock 渲染：零新增连接
    render(createElement(应用状态提供者, null, createElement(上下文探针)));
    await act(async () => {});
    expect(假WebSocket.构造记录.length).toBe(构造数);
  });

  it('401 只清后端状态，不载入 Mock 支持域', async () => {
    const 后端 = 创建后端桩();
    后端.恢复会话.mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    function 探针() {
      const { 后端状态, 状态 } = use应用状态();
      return createElement('output', null, JSON.stringify({ 后端状态, 岗位数: 状态.岗位列表.length, 意向数: 状态.求职意向表.length }));
    }
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(探针)));
    // getByText 找不到即抛，waitFor 据此重试
    await waitFor(() => screen.getByText(/"初始化":"完成"/));
    expect(screen.getByText(/"已登录":false/)).toBeDefined();
    expect(screen.getByText(/"岗位数":0/)).toBeDefined();
    expect(screen.getByText(/"意向数":0/)).toBeDefined();
  });

  // P1C Task 2：mount 恢复 recruiter 会话时，subject fence 与新 generation 必须在
  // 第一个异步组织请求（读取招聘方档案）之前就绪 —— 否则首个 profile 响应会被
  // 当成 stale 丢掉。owner Jobs 只能在组织水合之后读取。
  it('Backend mount recruiter 先立 fence 再水合组织，owner Jobs 在组织之后', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('recruiter');
    const 档案门 = deferred<BFF招聘方档案>();
    vi.mocked(后端.读取招聘方档案).mockReturnValue(档案门.promise);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    // 首个组织请求已发出（fence 必须在此之前已写入），响应稍后才到达
    await waitFor(() => expect(后端.读取招聘方档案).toHaveBeenCalled());
    档案门.resolve(BFF招聘方档案样本);
    await waitFor(() => expect(当前.状态.招聘方档案).toEqual(BFF招聘方档案样本));
    // affiliations → current → public organization 全链水合
    await waitFor(() => expect(当前.状态.当前企业关系编号).toBe(BFF企业关系样本.affiliation_id));
    expect(当前.状态.企业关系列表).toEqual([BFF企业关系样本]);
    expect(当前.状态.当前企业身份?.organization_id).toBe(BFF公开企业样本.organization_id);
    expect(当前.状态.企业档案快照).toEqual(BFF公开企业样本.profile);
    // owner Jobs 在组织水合之后
    expect(后端.读取岗位).toHaveBeenCalled();
    expect(后端.读取招聘方档案.mock.invocationCallOrder[0])
      .toBeLessThan(后端.读取岗位.mock.invocationCallOrder[0]);
    expect(当前.后端状态.初始化).toBe('完成');
    expect(当前.后端状态.已登录).toBe(true);
  });

  // 会话栅栏：mount 水合在飞期间用户完成了新的短信登录 —— 迟到的 mount 结算
  // （外层 subject + generation 栅栏）不得把旧会话的简历/主体写进新会话，
  // mount 收口也只关 初始化，不覆盖新登录态。本用例写在 Task 2 之前：当前
  // 完成手机登录 只换代际不自带水合；Task 2 后第二份 读取简历 mock 服务新登录水合。
  it('迟到的 mount 水合不覆盖期间建立的新短信会话', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 旧简历门 = deferred<页面简历快照>();
    vi.mocked(后端.读取主体)
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'stale-subject' })
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'fresh-subject' });
    vi.mocked(后端.读取简历)
      .mockReturnValueOnce(旧简历门.promise)
      .mockResolvedValue(从BFF简历(BFF简历样本));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(
      应用状态提供者,
      { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } },
      createElement(上下文探针),
    ));
    await waitFor(() => expect(后端.读取简历).toHaveBeenCalledTimes(1));

    await act(async () => { await 通过测试手机登录(当前); });
    expect(当前.后端状态.主体?.subject_id).toBe('fresh-subject');

    旧简历门.resolve(从BFF简历(BFF简历样本));
    await act(async () => { await 旧简历门.promise; });
    await waitFor(() => expect(当前.后端状态.主体?.subject_id).toBe('fresh-subject'));
    expect(当前.后端状态.已登录).toBe(true);
    expect(当前.后端状态.初始化).toBe('完成');
  });

  // 无恢复会话（冷启动 401）后用户完成短信登录：完成手机登录 要在提交 已登录=true
  // 之前按 last_used_role 水合权威资料 —— 导航可见时简历/意向已就位，不再是空壳。
  it('无恢复会话后短信登录已有 candidate 会在导航可见前水合权威资料', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.恢复会话).mockRejectedValueOnce(
      new BFF错误(401, 'invalid_session', 'no session'),
    );
    vi.mocked(后端.读取主体).mockResolvedValueOnce({
      ...BFF主体样本,
      subject_id: 'sub-interactive',
      last_used_role: 'candidate',
    });
    // 种一条在招意向：登录水合要带回权威意向，不接受默认空清单 fixture
    vi.mocked(后端.读取意向).mockResolvedValue({
      列表: [{ 编号: 'int_1', 标题: 'AI 产品经理', 说明: '20–30K' }],
      服务端: { int_1: BFF意向样本 },
    });
    render(createElement(
      应用状态提供者,
      { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端 as unknown as HTTP招聘数据源 } },
      createElement(探针),
    ));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.已登录).toBe(false);

    // act 包裹：登录提交与水合派发都要落进 React 提交，探针读到的是导航可见时的状态
    await act(async () => { await 通过测试手机登录(当前); });

    expect(当前.后端状态.已登录).toBe(true);
    expect(当前.状态.基本信息.真名).toBe(BFF简历样本.profile.real_name);
    expect(当前.状态.求职意向表).not.toEqual([]);
    expect(后端.读取简历).toHaveBeenCalledTimes(1);
    expect(后端.读取意向).toHaveBeenCalledTimes(1);
  });

  it('Backend 账号资料写回只含白名单字段，不含 P1C 已接管的旧字段', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('recruiter');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    const 会话 = 创建Map存储();
    vi.stubGlobal('sessionStorage', 会话);
    function 测试按钮() {
      const { 派发 } = use应用状态();
      return createElement('button', {
        onClick: () => {
          派发({ 型: '选择当前企业关系', 编号: BFF企业关系样本.affiliation_id });
          派发({ 型: '存未认证公司声明', 公司: '云衢科技' });
          派发({ 型: '设企业飞书接入', 接入: true });
        },
      }, '写入组织选择');
    }
    render(createElement(
      应用状态提供者,
      { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } },
      [createElement(上下文探针), createElement(测试按钮)],
    ));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await userEvent.click(document.querySelector('button')!);
    await waitFor(() => expect(会话.setItem).toHaveBeenCalledWith(
      'AGXP账号资料v2:backend:stg:sub_1',
      expect.stringContaining('"当前企业关系编号":"aff_1"'),
    ));
    const 范围内写入 = 会话.setItem.mock.calls
      .filter(([键]) => 键 === 'AGXP账号资料v2:backend:stg:sub_1')
      .map(([, 值]) => String(值));
    const 最后快照 = JSON.parse(范围内写入.at(-1)!);
    expect(最后快照).toEqual({
      当前企业关系编号: 'aff_1',
      未认证公司声明: '云衢科技',
      求职头像: null,
      飞书已接入: false,
      企业飞书已接入: true,
    });
  });
});

// ── 切身份后水合目标角色支持域（F3）+ 退出登录 401 清本地会话（F12）+ StrictMode 双跑（F1）──

describe('应用状态提供者 切身份与退出登录', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  it('候选切到招聘方后水合目标角色的岗位列表（F3）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    // mount-init 时 candidate → 读取简历/意向；切身份后 recruiter → 读取岗位
    const 岗位快照 = { 列表: [{ ...页面岗位样本, 编号: 'job_real_1', 名称: '后端工程师' }], 服务端: { job_real_1: BFF岗位样本 } };
    vi.mocked(后端.读取岗位).mockResolvedValue(岗位快照);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 切之前：候选盘空
    expect(当前.状态.岗位列表).toEqual([]);
    await 当前.操作.切身份('招聘方');
    expect(后端.确保角色).toHaveBeenCalledWith('recruiter');
    expect(后端.记录当前角色).toHaveBeenCalledWith('recruiter');
    // 切身份触发了一次 读取岗位（mount-init 候选侧不读岗位）
    expect(后端.读取岗位).toHaveBeenCalled();
    await waitFor(() => expect(当前.状态.岗位列表.map((岗) => 岗.名称)).toContain('后端工程师'));
  });

  it('退出登录 401 视同成功：清空本地会话且不抛错（F12）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.退出登录).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await expect(当前.操作.退出登录()).resolves.toBeUndefined();
    // 设后端状态 触发的重渲染是异步的，waitFor 等到已登录 落 false
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.主体).toBe(null);
    expect(当前.后端状态.简历快照).toBe(null);
    expect(当前.后端状态.意向快照).toEqual({});
    expect(当前.后端状态.岗位快照).toEqual({});
  });

  it('退出登录非 401 错误原样抛出，不清本地会话（F12）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.退出登录).mockRejectedValue(new BFF错误(500, 'internal_error', 'boom'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await expect(当前.操作.退出登录()).rejects.toMatchObject({ code: 'internal_error' });
  });

  // #5：切身份时水合失败应 reject，让 选身份.tsx catch 显示 轻提示并留在原地，
  // 不导航进空壳。确保角色/记录当前角色仍已执行，后端状态.主体仍已更新。
  it('切身份 水合失败时 reject，角色/主体仍已更新（#5）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取岗位).mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await expect(当前.操作.切身份('招聘方')).rejects.toMatchObject({ code: 'downstream_unavailable' });
    expect(后端.确保角色).toHaveBeenCalledWith('recruiter');
    expect(后端.记录当前角色).toHaveBeenCalledWith('recruiter');
    await waitFor(() => expect(当前.后端状态.主体?.last_used_role).toBe('recruiter'));
  });

  it('mount-init 水合失败仍完成初始化（不阻塞启动）（#5）', async () => {
    const 后端 = 创建后端桩('recruiter');
    vi.mocked(后端.读取岗位).mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    function 探针() {
      const { 后端状态 } = use应用状态();
      return createElement('output', null, JSON.stringify({ 初始化: 后端状态.初始化, 已登录: 后端状态.已登录 }));
    }
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(探针)));
    await waitFor(() => screen.getByText(/"初始化":"完成"/));
    expect(screen.getByText(/"已登录":true/)).toBeDefined();
  });

  // 已批准失效修复：开始失败后无有效 attempt，完成必须本地拒绝而不是向 BFF 发空串。
  it('开始手机登录失败后完成操作本地拒绝且零 complete 请求', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.开始手机登录).mockRejectedValue(new BFF错误(503, 'sms_unavailable', 'down'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await expect(当前.操作.开始手机登录('13800000000')).rejects.toMatchObject({ code: 'sms_unavailable' });
    await expect(当前.操作.完成手机登录('1234')).rejects.toMatchObject({
      name: '客户端校验错误',
      field: 'attempt',
    });
    expect(后端.完成手机登录).not.toHaveBeenCalled();
  });

  it('effect 依赖变更后（同实例 cleanup→setup）初始化仍能落到 完成（F1）', async () => {
    // 同实例的 effect 依赖变更触发 cleanup→setup（模拟 StrictMode 的双跑行为）。
    // 修复前：第一次 已初始化.current 置 true 但被取消，cleanup 不复位 ref → 第二次 setup 早退 → 永远 进行中。
    // 修复后：cleanup 复位 ref → 第二次 setup 重新跑初始化。
    const 恢复完成 = deferred<{ identity_id: string; session_id: string; expires_at: string }>();
    const 后端1 = 创建后端桩('candidate');
    vi.mocked(后端1.恢复会话).mockReturnValue(恢复完成.promise);
    const 后端2 = 创建后端桩('candidate');
    const 后端源1 = 后端1 as unknown as HTTP招聘数据源;
    const 后端源2 = 后端2 as unknown as HTTP招聘数据源;
    const 数据源1 = { 模式: 'backend' as const, 后端环境: 'stg' as const, 后端: 后端源1 };
    const 数据源2 = { 模式: 'backend' as const, 后端环境: 'stg' as const, 后端: 后端源2 };
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const { rerender } = render(createElement(应用状态提供者, { 数据源: 数据源1 }, createElement(上下文探针)));
    // 第一次 init 已开始但未完成（恢复会话 返回 deferred）
    expect(后端1.恢复会话).toHaveBeenCalled();
    // 改变 后端 引用 → effect deps 变化 → cleanup（取消第一次 + 复位 ref）→ setup（重新跑 init）
    rerender(createElement(应用状态提供者, { 数据源: 数据源2 }, createElement(上下文探针)));
    // 第二次 setup 的 init（用 后端2）应完成
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.已登录).toBe(true);
    expect(后端2.恢复会话).toHaveBeenCalled();
    // 清理：resolve 第一次的 deferred（第一次 init 已被取消，resolve 不会影响状态）
    恢复完成.resolve({ identity_id: 'id_1', session_id: 'sess_1', expires_at: '2026-08-25T00:00:00Z' });
  });

  // ── P0 修复 Task 1：招聘方档案 / 组织链两个水合阶段的种子与登出复位 ──

  it('Provider 种子把招聘方两个阶段落在 未开始', () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    render(createElement(应用状态提供者, null, createElement(上下文探针)));
    expect(当前.后端状态.招聘方档案水合阶段).toBe('未开始');
    expect(当前.后端状态.招聘方组织水合).toEqual({ 阶段: '未开始', 错误: null });
  });

  it('登出把招聘方两个阶段恢复到未开始并清空未认证公司声明', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('recruiter');
    // mount 时组织链失败 → 两个阶段都落在非 未开始，登出必须把它们清回底座
    vi.mocked(后端.读取招聘方档案).mockRejectedValue(new BFF错误(503, 'service_unavailable', 'down'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await waitFor(() => expect(当前.后端状态.招聘方组织水合.阶段).toBe('失败'));
    expect(当前.后端状态.招聘方档案水合阶段).toBe('失败');
    expect(当前.后端状态.招聘方组织水合.错误).toBeTruthy();
    act(() => { 当前.操作.保存未认证公司声明('上个账号的公司'); });
    await waitFor(() => expect(当前.状态.未认证公司声明).toBe('上个账号的公司'));
    await act(async () => { await 当前.操作.退出登录(); });
    await waitFor(() => expect(当前.后端状态.招聘方档案水合阶段).toBe('未开始'));
    expect(当前.后端状态.招聘方组织水合).toEqual({ 阶段: '未开始', 错误: null });
    expect(当前.状态.未认证公司声明).toBe('');
  });

  it('mount 恢复换主体时把招聘方两个阶段恢复到未开始', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    // A：招聘方且 profile 缺失 → 档案阶段落在 缺失
    const 后端A = 创建后端桩('recruiter');
    vi.mocked(后端A.读取招聘方档案).mockRejectedValue(new BFF错误(404, 'not_found', 'missing'));
    // B：另一个主体且是候选人 —— 水合角色数据 不进招聘方分支，两个阶段只能由 mount 复位收口
    const 后端B = 创建后端桩('candidate');
    vi.mocked(后端B.读取主体).mockResolvedValue({
      ...BFF主体样本, subject_id: 'sub_b', last_used_role: 'candidate',
    });
    const 数据源A = { 模式: 'backend' as const, 后端环境: 'stg' as const, 后端: 后端A as unknown as HTTP招聘数据源 };
    const 数据源B = { 模式: 'backend' as const, 后端环境: 'stg' as const, 后端: 后端B as unknown as HTTP招聘数据源 };
    const { rerender } = render(createElement(应用状态提供者, { 数据源: 数据源A }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.招聘方档案水合阶段).toBe('缺失'));
    // 后端 引用变化 → mount effect cleanup→setup → 以 sub_b 重跑恢复
    rerender(createElement(应用状态提供者, { 数据源: 数据源B }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.主体?.subject_id).toBe('sub_b'));
    expect(当前.后端状态.招聘方档案水合阶段).toBe('未开始');
    expect(当前.后端状态.招聘方组织水合).toEqual({ 阶段: '未开始', 错误: null });
  });

  it('重新水合招聘方组织 在缺失档案上重跑整条链并落成功', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('recruiter');
    vi.mocked(后端.读取招聘方档案).mockRejectedValueOnce(new BFF错误(503, 'service_unavailable', 'down'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.招聘方组织水合.阶段).toBe('失败'));
    await act(async () => { await 当前.操作.重新水合招聘方组织(); });
    await waitFor(() => expect(当前.后端状态.招聘方组织水合).toEqual({ 阶段: '成功', 错误: null }));
    expect(当前.后端状态.招聘方档案水合阶段).toBe('成功');
  });
});

describe('应用状态提供者 目录水合与原型缓存隔离', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', 创建Map存储());
  });

  // Task 2：candidate 初始化并行读取简历与 active 意向，不再预取目录。
  // Task 7：读取目录 已删除，这里只断言简历/意向独立提交。
  it('candidate 初始化独立提交简历和 active 意向', async () => {
    const 后端 = 创建后端桩('candidate');
    const 简历快照 = 从BFF简历(BFF简历样本);
    const 意向快照 = { 列表: [], 服务端: {} } as 页面意向快照;
    vi.mocked(后端.读取简历).mockResolvedValue(简历快照);
    vi.mocked(后端.读取意向).mockResolvedValue(意向快照);
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }));
    await waitFor(() => expect(后端.读取简历).toHaveBeenCalled());
    expect(后端.读取意向).toHaveBeenCalled();
    expect(后端.读取意向).toHaveBeenCalledWith();
  });

  // Task 2：交互式切身份也不预取目录。
  // Task 7：读取目录 已删除，这里只断言切身份后水合目标角色岗位。
  it('交互式切换角色水合目标角色岗位', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await 当前.操作.切身份('招聘方');
    await waitFor(() => expect(后端.读取岗位).toHaveBeenCalled());
  });

  // Task 2：Backend 水合与退出不覆盖 Mock 原型缓存（AGXP简历v2 / AGXP求职筛选v1）。
  it('Backend 水合和退出不覆盖 Mock 原型缓存', async () => {
    localStorage.setItem('AGXP简历v2', '{"PM":"mock-resume"}');
    localStorage.setItem('AGXP求职筛选v1', '{"PM":"mock-onboarding"}');
    const before = [localStorage.getItem('AGXP简历v2'), localStorage.getItem('AGXP求职筛选v1')];
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await 当前.操作.退出登录();
    expect([localStorage.getItem('AGXP简历v2'), localStorage.getItem('AGXP求职筛选v1')]).toEqual(before);
  });

  it('Backend 资料只读写当前 subject_id 的 sessionStorage 仓', async () => {
    const 本地 = 创建Map存储();
    const 会话 = 创建Map存储();
    vi.stubGlobal('localStorage', 本地);
    vi.stubGlobal('sessionStorage', 会话);
    会话.setItem('AGXP账号资料v2:backend:stg:sub_A', JSON.stringify({
      企业认证: { 姓名: 'A 用户', 公司: 'A 公司' },
      求职头像: '章:1',
    }));
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_A' });
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端 as unknown as HTTP招聘数据源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.状态.企业认证.姓名).toBe('A 用户'));
    expect(当前.状态.求职头像).toBe('章:1');
    expect(本地.setItem.mock.calls.some(([key]) => String(key).startsWith('AGXP账号资料v2:backend:'))).toBe(false);
  });

  it('同一 Provider 切换主体时只水合新账号资料', async () => {
    const 会话 = 创建Map存储();
    vi.stubGlobal('sessionStorage', 会话);
    const 快照 = (姓名: string) => JSON.stringify({ 企业认证: { 姓名, 公司: `${姓名}公司` } });
    会话.setItem('AGXP账号资料v2:backend:stg:sub_A', 快照('A'));
    会话.setItem('AGXP账号资料v2:backend:stg:sub_B', 快照('B'));
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体)
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_A' })
      .mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_B' });
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端 as unknown as HTTP招聘数据源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.状态.企业认证.姓名).toBe('A'));
    await 通过测试手机登录(当前);
    await waitFor(() => expect(当前.状态.企业认证.姓名).toBe('B'));
    expect(当前.状态.资料缓存范围键).toBe('AGXP账号资料v2:backend:stg:sub_B');
  });
});

// ── review-r1 P1-4 / P1-5 / P1-6：Backend 种子不读 Mock 缓存；401/退出清草稿；
//    目录查询 401 走统一会话清理 ──────────────────────────────────────────────

describe('应用状态提供者 review-r1 Backend 边界', () => {
  function 创建Map存储() {
    const 存 = new Map<string, string>();
    return {
      getItem: vi.fn((key: string) => 存.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { 存.set(key, value); }),
      removeItem: vi.fn((key: string) => { 存.delete(key); }),
      clear: vi.fn(() => 存.clear()),
    };
  }

  beforeEach(() => {
    vi.stubGlobal('localStorage', 创建Map存储());
  });

  // P1-4：Backend 种子状态不读 Mock 的 AGXP求职筛选v1 缓存——
  // 浏览器先前跑过 Mock 时该键存了 Mock 城市/职位字符串，Backend onboarding 不该把它们当答案。
  it('Backend 种子引导预填为 null，不读 Mock 求职筛选缓存（P1-4）', async () => {
    localStorage.setItem('AGXP求职筛选v1', JSON.stringify({ 城市们: ['上海'], 职位: ['产品经理'] }));
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.状态.引导预填).toBe(null);
  });

  // P1-5：Backend 退出登录后，引导预填 / 意向草稿 都归零，不带到下一个账号。
  it('退出登录清空 引导预填 与 意向草稿（P1-5）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 先写入草稿与引导预填，模拟用户填到一半
    当前.派发({ 型: '改意向草稿', 补丁: { 期望职位: '后端工程师', 职位引用: { id: 'tax_be', display_name: '后端工程师' } } });
    当前.派发({
      型: '存引导预填',
      城市们: ['上海'],
      职位: ['产品经理'],
      城市引用们: [{ id: 'loc_sh', display_name: '上海' }],
      职位引用们: [{ id: 'tax_pm', display_name: '产品经理' }],
    });
    await waitFor(() => expect(当前.状态.意向草稿.期望职位).toBe('后端工程师'));
    expect(当前.状态.引导预填).not.toBe(null);
    await 当前.操作.退出登录();
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.状态.引导预填).toBe(null);
    expect(当前.状态.意向草稿.期望职位).toBe('');
    expect(当前.状态.意向草稿.职位引用).toBeUndefined();
  });

  // P1-5：意向写操作 401 也清草稿与引导预填（不只清服务端快照）。
  it('意向写入 401 清空 引导预填 与 意向草稿（P1-5）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.创建意向).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    当前.派发({ 型: '改意向草稿', 补丁: { 期望职位: '后端工程师' } });
    当前.派发({ 型: '存引导预填', 城市们: ['上海'], 职位: ['产品经理'], 城市引用们: [], 职位引用们: [] });
    const 草稿 = {
      编辑编号: null, 求职类型: '全职' as const, 工作城市: '上海', 期望职位: '后端工程师',
      工作城市引用: { id: 'loc_sh', display_name: '上海' }, 职位引用: { id: 'tax_be', display_name: '后端工程师' },
      感兴趣城市们: [] as string[], 感兴趣城市引用们: [] as never[],
      薪资下限: 10, 薪资上限: 20, 期望行业们: [] as string[], 行业引用们: [] as never[],
      办公方式: ['hybrid'], 后端招聘类型: null, 求职类型已改: false,
    };
    await expect(当前.操作.保存意向(草稿)).rejects.toMatchObject({ code: 'invalid_session' });
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.状态.引导预填).toBe(null);
    expect(当前.状态.意向草稿.期望职位).toBe('');
  });

  // P1-6：目录查询 401 也走统一会话清理（派发空快照 + 后端状态已登录=false + 清空目录缓存），
  // 不只是资源写操作的 401 才清。选择器开着时会话过期 → 目录请求 401 → 会话被清。
  it('目录查询 401 触发会话清理：派发空快照、后端状态登出、清空目录缓存（P1-6）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    // 目录查询方法 401
    后端.查询Institution = vi.fn(async () => { throw new BFF错误(401, 'invalid_session', 'expired'); }) as never;
    后端.查询Taxonomy = vi.fn(async () => { throw new BFF错误(401, 'invalid_session', 'expired'); }) as never;
    后端.查询Location = vi.fn(async () => { throw new BFF错误(401, 'invalid_session', 'expired'); }) as never;
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.已登录).toBe(true);
    // 选择器开着时会话过期 → 调目录查询 → 401
    const 目录查询 = 当前.目录查询!;
    await expect(目录查询.查询Institution({ q: '清华' })).rejects.toMatchObject({ code: 'invalid_session' });
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.主体).toBe(null);
    expect(后端.清空目录缓存).toHaveBeenCalled();
    // 服务端支持域也清空了
    expect(当前.状态.求职意向表).toEqual([]);
    expect(当前.状态.岗位列表).toEqual([]);
  });

  // P1-6 补：目录查询 401 后还清草稿与引导预填（与资源写 401 同口径）。
  it('目录查询 401 也清空 引导预填 与 意向草稿（P1-6）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    后端.查询Institution = vi.fn(async () => { throw new BFF错误(401, 'invalid_session', 'expired'); }) as never;
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    当前.派发({ 型: '改意向草稿', 补丁: { 期望职位: '后端工程师' } });
    当前.派发({ 型: '存引导预填', 城市们: ['上海'], 职位: ['产品经理'], 城市引用们: [], 职位引用们: [] });
    await expect(当前.目录查询!.查询Institution({ q: '清华' })).rejects.toMatchObject({ code: 'invalid_session' });
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.状态.引导预填).toBe(null);
    expect(当前.状态.意向草稿.期望职位).toBe('');
  });
});

// ── review-r2 R2-I-3 / R2-I-4 / R2-M-4：会话边界——水合 401、主体切换、目录 stale 401 ──

describe('应用状态提供者 review-r2 会话边界', () => {
  function 创建Map存储() {
    const 存 = new Map<string, string>();
    return {
      getItem: vi.fn((key: string) => 存.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { 存.set(key, value); }),
      removeItem: vi.fn((key: string) => { 存.delete(key); }),
      clear: vi.fn(() => 存.clear()),
    };
  }

  beforeEach(() => {
    vi.stubGlobal('localStorage', 创建Map存储());
  });

  // R2-I-3：mount-init 恢复会话 200 但水合时 读取简历 401（会话在水合途中过期），
  // 旧实现只 轻提示 然后落 已登录=true，本地还挂着上个会话的草稿/快照。
  it('水合 401 清会话不落 已登录=true（R2-I-3）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取简历).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.已登录).toBe(false);
    expect(当前.后端状态.主体).toBe(null);
    expect(当前.后端状态.简历快照).toBe(null);
    expect(后端.清空目录缓存).toHaveBeenCalled();
    // 草稿也被清（与资源写 401 同口径）
    expect(当前.状态.引导预填).toBe(null);
  });

  // R2-I-4：同一 Provider 实例下主体 subject_id 变化时，上个账号的草稿/快照要先清掉。
  it('主体 subject_id 变化时清空上个账号的草稿与快照（R2-I-4）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    // 主体 A（sub_A）先登录
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.主体?.subject_id).toBe('sub_A');
    // A 填了一些草稿
    当前.派发({ 型: '改意向草稿', 补丁: { 期望职位: 'A 的职位' } });
    current派发引导预填(当前, '上海');
    await waitFor(() => expect(当前.状态.意向草稿.期望职位).toBe('A 的职位'));
    // B 在同一 Provider 登录（完成手机登录 → 读取主体 返回 sub_B）
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_B' });
    await 通过测试手机登录(当前);
    await waitFor(() => expect(当前.后端状态.主体?.subject_id).toBe('sub_B'));
    // A 的草稿/引导预填被清，不串到 B
    expect(当前.状态.意向草稿.期望职位).toBe('');
    expect(当前.状态.引导预填).toBe(null);
  });

  // R2-I-4 补：同一 subject_id 再次登录（如刷新后再登录）不清空草稿。
  it('同 subject_id 再次登录不清空草稿（R2-I-4）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    current派发引导预填(当前, '上海');
    await waitFor(() => expect(当前.状态.引导预填).not.toBe(null));
    // 同 subject_id 再次完成手机登录
    await 通过测试手机登录(当前);
    // 草稿保留
    expect(当前.状态.引导预填).not.toBe(null);
  });

  // R2-M-4：目录请求开始 → 退出+重登（新会话）→ 旧请求的 401 到达 → 新会话不被踢。
  it('stale 目录 401 不清 newer 会话（R2-M-4）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    // 主体先登录（sub_A）
    vi.mocked(后端.读取主体).mockResolvedValue({ ...BFF主体样本, subject_id: 'sub_A' });
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 目录请求开始（deferred，稍后才 reject 401）
    const 目录拒绝 = deferred<never>();
    后端.查询Institution = vi.fn(async () => 目录拒绝.promise) as never;
    const 目录请求 = 当前.目录查询!.查询Institution({ q: '清华' });
    // 退出登录 + 重新登录（新会话代际）
    await 当前.操作.退出登录();
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    // 重新登录：读取主体 返回新主体
    vi.mocked(后端.读取主体).mockResolvedValueOnce({ ...BFF主体样本, subject_id: 'sub_A' });
    await 通过测试手机登录(当前, '5678');
    await waitFor(() => expect(当前.后端状态.已登录).toBe(true));
    // 旧请求的 401 到达
    目录拒绝.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(目录请求).rejects.toMatchObject({ code: 'invalid_session' });
    // 新会话仍然登录（stale 401 被忽略）
    await waitFor(() => expect(当前.后端状态.已登录).toBe(true));
    expect(当前.后端状态.主体).not.toBe(null);
  });
});

// ── review-r3 R3-I-2 / R3-I-3 / R3-I-4：会话边界收口——全 401 统一清理、登录读主体失败、切身份 401 ──

describe('应用状态提供者 review-r3 会话边界收口', () => {
  function 创建Map存储() {
    const 存 = new Map<string, string>();
    return {
      getItem: vi.fn((key: string) => 存.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { 存.set(key, value); }),
      removeItem: vi.fn((key: string) => { 存.delete(key); }),
      clear: vi.fn(() => 存.clear()),
    };
  }

  beforeEach(() => {
    vi.stubGlobal('localStorage', 创建Map存储());
  });

  // R3-I-2：意向 401 必须清掉全部支持域快照（简历/意向/岗位），不只清意向。
  it('意向写入 401 清空全部支持域快照与草稿（R3-I-2）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.创建意向).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 模拟已水合的支持域有内容
    当前.派发({ 型: '改意向草稿', 补丁: { 期望职位: '后端工程师' } });
    当前.派发({ 型: '存引导预填', 城市们: ['上海'], 职位: ['产品经理'], 城市引用们: [], 职位引用们: [] });
    const 草稿 = {
      编辑编号: null, 求职类型: '全职' as const, 工作城市: '上海', 期望职位: '后端工程师',
      工作城市引用: { id: 'loc_sh', display_name: '上海' }, 职位引用: { id: 'tax_be', display_name: '后端工程师' },
      感兴趣城市们: [] as string[], 感兴趣城市引用们: [] as never[],
      薪资下限: 10, 薪资上限: 20, 期望行业们: [] as string[], 行业引用们: [] as never[],
      办公方式: ['hybrid'], 后端招聘类型: null, 求职类型已改: false,
    };
    await expect(当前.操作.保存意向(草稿)).rejects.toMatchObject({ code: 'invalid_session' });
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    // 三个支持域的后端快照都清空（不只意向）
    expect(当前.后端状态.简历快照).toBe(null);
    expect(当前.后端状态.意向快照).toEqual({});
    expect(当前.后端状态.岗位快照).toEqual({});
    // 状态层支持域也清空
    expect(当前.状态.求职意向表).toEqual([]);
    expect(当前.状态.岗位列表).toEqual([]);
    // 草稿也清
    expect(当前.状态.引导预填).toBe(null);
    expect(当前.状态.意向草稿.期望职位).toBe('');
    expect(后端.清空目录缓存).toHaveBeenCalled();
  });

  // R3-I-2 补：岗位 401 也清掉简历/意向快照（不只岗位）
  it('岗位写入 401 清空全部支持域快照与草稿（R3-I-2）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('recruiter');
    vi.mocked(后端.创建岗位).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    当前.派发({ 型: '改意向草稿', 补丁: { 期望职位: '后端工程师' } });
    当前.派发({ 型: '存引导预填', 城市们: ['上海'], 职位: ['产品经理'], 城市引用们: [], 职位引用们: [] });
    await expect(当前.操作.发布岗位({ ...页面岗位样本, 编号: 'P-临时' })).rejects.toMatchObject({ code: 'invalid_session' });
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.简历快照).toBe(null);
    expect(当前.后端状态.意向快照).toEqual({});
    expect(当前.后端状态.岗位快照).toEqual({});
    expect(当前.状态.引导预填).toBe(null);
    expect(当前.状态.意向草稿.期望职位).toBe('');
    expect(后端.清空目录缓存).toHaveBeenCalled();
  });

  // R3-I-3：完成手机登录 → 读取主体 401 → 已登录 保持 false，且已清理
  it('完成手机登录 读取主体 401 不落 已登录 且清理会话（R3-I-3）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 先有些上个账号的草稿
    当前.派发({ 型: '改意向草稿', 补丁: { 期望职位: '旧职位' } });
    当前.派发({ 型: '存引导预填', 城市们: ['上海'], 职位: ['产品经理'], 城市引用们: [], 职位引用们: [] });
    await 通过测试手机登录(当前);
    // 读取主体 401 → 不落 已登录，清理会话
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.主体).toBe(null);
    expect(当前.状态.引导预填).toBe(null);
    expect(当前.状态.意向草稿.期望职位).toBe('');
    expect(后端.清空目录缓存).toHaveBeenCalled();
  });

  // R3-I-3 补：读取主体 非 401 失败也不落 已登录=true，留未登录 + 轻提示
  it('完成手机登录 读取主体 非401 失败留未登录（R3-I-3）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取主体).mockRejectedValue(new BFF错误(503, 'downstream_unavailable', 'down'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await 通过测试手机登录(当前);
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.主体).toBe(null);
  });

  // R3-I-4：切身份 → 确保角色 401 → 全清理，已登录 false；本地角色不切
  it('切身份 确保角色 401 全清理且本地角色不切（R3-I-4）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.确保角色).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    // 切之前是 candidate（已登录）
    expect(当前.后端状态.已登录).toBe(true);
    await expect(当前.操作.切身份('招聘方')).rejects.toMatchObject({ code: 'invalid_session' });
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.主体).toBe(null);
    expect(当前.状态.引导预填).toBe(null);
    expect(后端.清空目录缓存).toHaveBeenCalled();
    // 本地 Tab 仍是求职者的「职位」（切身份 派发未执行）
    expect(当前.状态.当前Tab).toBe('职位');
  });

  // R3-I-4 补：切身份 记录当前角色 401 也全清理
  it('切身份 记录当前角色 401 全清理（R3-I-4）', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.记录当前角色).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    await expect(当前.操作.切身份('招聘方')).rejects.toMatchObject({ code: 'invalid_session' });
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.状态.当前Tab).toBe('职位');
  });
});

// ── 求职端助手会话访问 seam（Task 4 / 合同 C）：身份门控 + 统一 401 清理 + 代际失效 ──
//（原 src/状态/应用状态.test.ts 的同名 describe 按 Task 4 冻结归属迁入会话边界。）

describe('应用状态提供者 助手会话访问', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    假WebSocket.构造记录 = [];
    vi.stubGlobal('WebSocket', 假WebSocket);
  });

  it('candidate 登录后提供助手会话访问：范围键含环境/主体/角色/真实代际，方法透传', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    const seam = 当前.助手会话;
    expect(seam).not.toBe(null);
    // mount 恢复把会话代际从 0 递增到 1：范围键快照的是真实代际，不是固定串
    expect(seam!.范围键).toBe(`stg|${BFF主体样本.subject_id}|candidate|1`);
    await seam!.api.读取助手历史();
    expect(后端.读取助手历史).toHaveBeenCalledTimes(1);
  });

  it('Mock / 未登录 / recruiter 一律不提供助手会话访问', async () => {
    // Mock（默认数据源）
    let Mock当前!: ReturnType<typeof use应用状态>;
    function Mock探针() { Mock当前 = use应用状态(); return null; }
    render(createElement(应用状态提供者, null, createElement(Mock探针)));
    expect(Mock当前.助手会话).toBe(null);

    // 未登录：恢复会话 401
    let 未登录当前!: ReturnType<typeof use应用状态>;
    function 未登录探针() { 未登录当前 = use应用状态(); return null; }
    const 未登录后端 = 创建后端桩('candidate');
    vi.mocked(未登录后端.恢复会话).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 未登录后端 as unknown as HTTP招聘数据源 } }, createElement(未登录探针)));
    await waitFor(() => expect(未登录当前.后端状态.初始化).toBe('完成'));
    expect(未登录当前.助手会话).toBe(null);

    // recruiter 角色
    let 招聘当前!: ReturnType<typeof use应用状态>;
    function 招聘探针() { 招聘当前 = use应用状态(); return null; }
    const 招聘后端 = 创建后端桩('recruiter');
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 招聘后端 as unknown as HTTP招聘数据源 } }, createElement(招聘探针)));
    await waitFor(() => expect(招聘当前.后端状态.初始化).toBe('完成'));
    expect(招聘当前.助手会话).toBe(null);
  });

  it('助手请求当前 401 走统一清账号状态，seam 随会话清理失效为 null', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    vi.mocked(后端.读取助手历史).mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.后端状态.已登录).toBe(true);
    await expect(当前.助手会话!.api.读取助手历史()).rejects.toMatchObject({ status: 401 });
    // 清账号状态全套：登出 + 主体清空 + 目录缓存清空 + 支持域快照清空（不只清助手域）
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    expect(当前.后端状态.主体).toBe(null);
    expect(后端.清空目录缓存).toHaveBeenCalled();
    expect(当前.状态.求职意向表).toEqual([]);
    expect(当前.状态.岗位列表).toEqual([]);
    await waitFor(() => expect(当前.助手会话).toBe(null));
  });

  it('退出登录后助手会话访问失效为 null', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    expect(当前.助手会话).not.toBe(null);
    await 当前.操作.退出登录();
    await waitFor(() => expect(当前.后端状态.已登录).toBe(false));
    await waitFor(() => expect(当前.助手会话).toBe(null));
  });

  it('同 subject 重新登录换代际：旧 seam 被 fence 拒绝，新 seam 提供新范围键', async () => {
    let 当前!: ReturnType<typeof use应用状态>;
    function 上下文探针() { 当前 = use应用状态(); return null; }
    const 后端 = 创建后端桩('candidate');
    const 后端源 = 后端 as unknown as HTTP招聘数据源;
    render(createElement(应用状态提供者, { 数据源: { 模式: 'backend', 后端环境: 'stg', 后端: 后端源 } }, createElement(上下文探针)));
    await waitFor(() => expect(当前.后端状态.初始化).toBe('完成'));
    const 旧seam = 当前.助手会话!;
    expect(旧seam.范围键).toBe(`stg|${BFF主体样本.subject_id}|candidate|1`);
    // 同 subject 再次完成短信登录：会话代际递增（仅比较字符串 subject 不足以失效）
    await act(async () => { await 通过测试手机登录(当前); });
    expect(当前.后端状态.已登录).toBe(true);
    await waitFor(() => expect(当前.助手会话?.范围键).toBe(`stg|${BFF主体样本.subject_id}|candidate|2`));
    // 旧 seam 已过时：请求前 fence 直接 AbortError，不再触网
    const 旧历史调用数 = vi.mocked(后端.读取助手历史).mock.calls.length;
    await expect(旧seam.api.读取助手历史()).rejects.toMatchObject({ name: 'AbortError' });
    expect(vi.mocked(后端.读取助手历史).mock.calls.length).toBe(旧历史调用数);
  });
});
