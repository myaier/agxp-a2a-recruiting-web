import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 初始状态, 归约, use应用状态, 应用状态提供者 } from './应用状态';
import { BFF主体样本, BFF简历样本 } from '../测试/BFF样本';
import { BFF错误 } from '../数据/HTTP客户端';
import type { BFF角色 } from '../数据/BFF契约';
import type { HTTP招聘数据源 } from '../数据/HTTP招聘数据源';
import { 从BFF简历 } from '../数据/后端映射';

describe('应用状态 reducer', () => {
  const 写入 = vi.fn();
  const 删除 = vi.fn();

  beforeEach(() => {
    写入.mockClear();
    删除.mockClear();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: 写入,
      removeItem: 删除,
      clear: vi.fn(),
    });
  });

  it('保持纯函数：更新认证状态时不直接写 localStorage', () => {
    const 下一状态 = 归约(初始状态, {
      型: '存企业认证',
      姓名: '测试用户',
      公司: '测试科技',
      职务: '招聘经理',
    });

    expect(下一状态.企业认证).toEqual({ 姓名: '测试用户', 公司: '测试科技', 职务: '招聘经理' });
    expect(写入).not.toHaveBeenCalled();
    expect(删除).not.toHaveBeenCalled();
  });

  it('不修改传入状态对象', () => {
    const 下一状态 = 归约(初始状态, { 型: '设企业飞书接入', 接入: true });
    expect(下一状态).not.toBe(初始状态);
    expect(初始状态.企业飞书已接入).toBe(false);
    expect(下一状态.企业飞书已接入).toBe(true);
  });

  it('由 Provider 在状态提交后统一持久化', async () => {
    function 测试按钮() {
      const { 派发 } = use应用状态();
      return createElement('button', { onClick: () => 派发({ 型: '设企业飞书接入', 接入: true }) }, '接入飞书');
    }

    render(createElement(应用状态提供者, null, createElement(测试按钮)));
    写入.mockClear();
    await userEvent.click(document.querySelector('button')!);

    await waitFor(() => expect(写入).toHaveBeenCalledWith('AGXP企业飞书接入v1', '1'));
  });

  it('完整发布岗位时保留角色专属计薪单位和全部筛选字段', () => {
    const 岗 = {
      编号: 'P-99',
      名称: '后端实习生',
      薪资带: '300-500 元/天',
      状态: '在招' as const,
      在谈数: 0,
      城市: '上海',
      办公方式: '混合',
      招聘类型: '实习生' as const,
      实习月数: 3,
      每周天数: 4,
      实习转正: true,
      职位关键词: ['Java'],
      加分关键词: ['有相关课程项目'],
      硬性条件: ['本科及以上'],
    };

    const 下一状态 = 归约(初始状态, { 型: '发布岗位', 岗 });
    expect(下一状态.岗位列表[0]).toMatchObject({
      编号: 'P-99',
      薪资带: '300-500 元/天',
      招聘类型: '实习生',
      实习月数: 3,
      每周天数: 4,
      // 实习最晚开始日期 / 面试轮次 / 招聘紧急度 三条断言删于 2026-08-22：字段本身已按
      // 产品负责人标注删除（「应该删掉吧」「感觉没什么用」「这个删了吧，没啥用」，且无书面出处）。
      // 实习转正 留着断言 —— 同批澄清「实习生转正可以加」，它仍要跟着发布落库
      实习转正: true,
      职位关键词: ['Java'],
      加分关键词: ['有相关课程项目'],
      // 在谈数 已退役（拦路 11）：静态字段不再是任何屏的数据源，发布时一律 0。
      // 原来这里断言 2，断的正是那个「刚发布就显示在谈 2 人」的假数字
      在谈数: 0,
    });
    // 真实的在谈人数由起步候选实时算出来 —— 岗位管理行内与删除守卫读的都是这个
    expect(下一状态.企业候选列表.filter((候) => 候.岗位编号 === 'P-99')).toHaveLength(2);
  });
});

// ── Provider 会话 / 角色水合 / 401 ───────────────────────────────
// Task 6：Context 接入后端数据源后的会话恢复与角色切换顺序。
// 注：仓库未装 @testing-library/jest-dom，故不用 toHaveTextContent/toBeInTheDocument；
// 用 getByText/getByRole（找不到即抛）+ toBe 定义来等价断言。

function 创建后端桩(lastUsedRole: 'candidate' | 'recruiter' | null = 'candidate') {
  const 主体 = { ...BFF主体样本, last_used_role: lastUsedRole };
  return {
    恢复会话: vi.fn(async () => ({ identity_id: 'id_1', session_id: 'sess_1', expires_at: '2026-08-25T00:00:00Z' })),
    读取主体: vi.fn(async () => 主体),
    确保角色: vi.fn(async (role: BFF角色) => ({ ...主体, roles: [...主体.roles, { role, status: 'active' as const }] })),
    记录当前角色: vi.fn(async (role: BFF角色) => ({ ...主体, last_used_role: role })),
    读取简历: vi.fn(async () => 从BFF简历(BFF简历样本)),
    保存简历: vi.fn(async () => 从BFF简历(BFF简历样本)),
    读取意向: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    创建意向: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    更新意向: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    删除意向: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    读取岗位: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    创建岗位: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    更新岗位: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    归档岗位: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    重开岗位: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    删除岗位: vi.fn(async () => ({ 列表: [], 服务端: {} })),
    读取目录: vi.fn(async () => ({ 职位类别: [], 地点: [], 行业: [], 院校: [], 专业: [] })),
    开始手机登录: vi.fn(),
    完成手机登录: vi.fn(),
    开始微信登录: vi.fn(),
    退出登录: vi.fn(),
  };
}

describe('应用状态提供者 后端会话', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
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
});
