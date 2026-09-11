// 职位正文展示 · 展示测试（P1 Task 2）。
//
// 展示只按 数据/能力 渲染：核对/说明两态、未知占位（§3.2）只作用于缺失节点、
// 完整状态沿用原声明值。有值 → 空 的 rerender 逐槽断言无旧数据残留。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { 职位正文展示 } from './职位正文展示';
import type { 职位正文数据 } from './类型';

const 对齐行样本 = [
  { 要求: '经验 5 年以上', 证据: null, 态: '未提及' as const, 类: '硬性' as const },
  { 要求: 'Go 主栈', 证据: '字节跳动 · 交易中台 · Go · 9 年', 态: '有证据' as const, 类: '必须' as const },
];

const 核对数据: 职位正文数据 = {
  职位: '交易中台架构师',
  薪资: '60-80K',
  匹配: { 种类: '核对', 分: 50, 行们: 对齐行样本, 分析: { 墨句: '墨句讲强项。', 灰句: '灰句讲缺口。' } },
  职位详情标题: '职位详情',
  职位事实行: [],
  职位详情行: ['1、负责交易中台的架构演进；', '2、主导多活与稳定性治理。'],
  职位要求标题: '职位要求',
  职位要求行: ['1、5 年以上后端经验，Go 主栈。'],
  公司: {
    名称: '美团',
    图: { 种类: '字标', 字: '美' },
    简介: '已上市 · 10000 人以上 · 本地生活',
    资料: {
      介绍段: null,
      元行组: [
        { 标签: '融资阶段', 值: '已上市' },
        { 标签: '规模', 值: '10000 人以上' },
        { 标签: '行业', 值: '本地生活' },
      ],
    },
  },
  发布人: {
    图: { 种类: '字标', 字: '梁' },
    姓名: '梁思远',
    公司: '美团',
    职务: '交易中台招聘负责人',
    备注: '企业直招 · 允许直接联系',
  },
};

/** Backend 详情直取形态：无推荐分、JD 空正文、公司/发布人全缺失 */
const 说明未知数据: 职位正文数据 = {
  职位: 'AI 产品实习生',
  薪资: '300-500 元/天',
  匹配: { 种类: '说明', 分: null, 说明: ['结构化设置：已确认'] },
  职位详情标题: '岗位信息与职位详情',
  职位事实行: ['城市：上海', '办公方式：混合'],
  职位详情行: ['职位详情未知'],
  职位要求标题: '职位要求（补充说明，不自动解析）',
  职位要求行: ['职位要求未知'],
  公司: {
    名称: '云衢科技',
    图: { 种类: '未知', 可访问名: '公司图片未知' },
    简介: '',
    资料: {
      介绍段: '公司简介未知',
      元行组: [
        { 标签: '融资阶段', 值: '未知' },
        { 标签: '规模', 值: '未知' },
        { 标签: '行业', 值: '未知' },
        { 标签: '成立', 值: '未知' },
        { 标签: '地址', 值: '未知' },
      ],
    },
  },
  发布人: {
    图: { 种类: '未知', 可访问名: '发布人图片未知' },
    姓名: '发布人姓名未知',
    公司: '企业信息未知',
    职务: '职务未知',
    备注: '发布人备注未知',
  },
};

describe('职位正文展示 · 核对分支（完整状态 = 原正文视觉形态）', () => {
  it('职位名/薪资 → 匹配分析（44px 环 + 行 + 分析段）→ JD 两段 → 公司元行 → 发布人 → 直接聊', () => {
    const 直接聊 = vi.fn();
    render(<职位正文展示 数据={核对数据} 打开公司={() => undefined} 直接聊={直接聊} />);
    expect(screen.getByText('交易中台架构师')).toBeTruthy();
    expect(screen.getByText('60-80K')).toBeTruthy();
    expect(screen.getByRole('img', { name: '适配 50 分' })).toBeTruthy();
    expect(screen.queryByLabelText('匹配分未知')).toBeNull();
    expect(screen.getByText('墨句讲强项。')).toBeTruthy();
    expect(screen.getByText('Go 主栈')).toBeTruthy();
    expect(screen.getByText('字节跳动 · 交易中台 · Go · 9 年')).toBeTruthy();
    expect(screen.getByText('职位详情')).toBeTruthy();
    expect(screen.getByText('1、负责交易中台的架构演进；')).toBeTruthy();
    expect(screen.getByText('职位要求')).toBeTruthy();
    expect(screen.getByText('融资阶段')).toBeTruthy();
    expect(screen.getByText('已上市')).toBeTruthy();
    expect(screen.getByText('本地生活')).toBeTruthy();
    expect(screen.getByText('梁思远 · 美团')).toBeTruthy();
    expect(screen.getByText('交易中台招聘负责人')).toBeTruthy();
    expect(screen.getByText('企业直招 · 允许直接联系')).toBeTruthy();
    expect(screen.getByRole('button', { name: '直接聊' })).toBeTruthy();
  });

  it('真实 0 分仍是进度环，不是未知占位', () => {
    render(
      <职位正文展示
        数据={{
          ...核对数据,
          匹配: {
            种类: '核对',
            分: 0,
            行们: [{ 要求: '经验 5 年以上', 证据: null, 态: '未提及', 类: '硬性' }],
            分析: null,
          },
        }}
      />,
    );
    expect(screen.getByRole('img', { name: '适配 0 分' })).toBeTruthy();
    expect(screen.queryByLabelText('匹配分未知')).toBeNull();
  });

  it('核对行们为空：整组不绘制内部内容（匹配分析块原零行行为保留）', () => {
    render(
      <职位正文展示
        数据={{ ...核对数据, 匹配: { 种类: '核对', 分: 50, 行们: [], 分析: null } }}
      />,
    );
    expect(screen.queryByText('匹配度分析')).toBeNull();
    expect(screen.queryByRole('img', { name: /适配/ })).toBeNull();
  });

  it('直接聊能力由连接层决定：不给回调就不渲染按钮（Backend 无直聊坐标）', () => {
    render(<职位正文展示 数据={核对数据} 打开公司={() => undefined} />);
    expect(screen.queryByRole('button', { name: '直接聊' })).toBeNull();
  });

  it('打开公司在场渲染可点公司块，缺省渲染非交互块（同一 class）', async () => {
    const 用户 = userEvent.setup();
    const 打开公司 = vi.fn();
    const 页 = render(<职位正文展示 数据={核对数据} 打开公司={打开公司} />);
    await 用户.click(screen.getByRole('button', { name: /美团/ }));
    expect(打开公司).toHaveBeenCalledTimes(1);
    页.unmount();

    render(<职位正文展示 数据={核对数据} />);
    expect(screen.queryByRole('button', { name: /美团/ })).toBeNull();
    expect(screen.getByText('美团')).toBeTruthy();
  });

  it('有值 → 空 rerender：旧 JD 行、旧匹配环、旧发布人身份与备注全部不残留', () => {
    const { rerender } = render(<职位正文展示 数据={核对数据} 直接聊={() => undefined} />);
    rerender(<职位正文展示 数据={说明未知数据} />);
    expect(screen.queryByText('交易中台架构师')).toBeNull();
    expect(screen.queryByRole('img', { name: /适配/ })).toBeNull();
    expect(screen.queryByText('墨句讲强项。')).toBeNull();
    expect(screen.queryByText('1、负责交易中台的架构演进；')).toBeNull();
    expect(screen.queryByText('梁思远 · 美团')).toBeNull();
    expect(screen.queryByText('企业直招 · 允许直接联系')).toBeNull();
    expect(screen.queryByRole('button', { name: '直接聊' })).toBeNull();
    // 缺失位置完整：未知占位与既有事实并存
    expect(screen.getByLabelText('匹配分未知')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('城市：上海')).toBeTruthy();
    expect(screen.getByText('职位详情未知')).toBeTruthy();
    expect(screen.getByText('职位要求未知')).toBeTruthy();
    expect(screen.getByLabelText('公司图片未知')).toBeTruthy();
    expect(screen.getByLabelText('发布人图片未知')).toBeTruthy();
    expect(screen.getByText('发布人姓名未知 · 企业信息未知')).toBeTruthy();
    expect(screen.getByText('职务未知')).toBeTruthy();
    expect(screen.getByText('发布人备注未知')).toBeTruthy();
  });
});

describe('职位正文展示 · 说明分支与缺失占位（§3.2）', () => {
  it('无推荐分：保留 44×44 分数位尺寸的中性占位（— + 匹配分未知），不绘制进度环', () => {
    render(<职位正文展示 数据={说明未知数据} />);
    expect(screen.getByLabelText('匹配分未知')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByRole('img', { name: /适配/ })).toBeNull();
  });

  it('说明分支带 wire 分（basis 未确认）：环照常保留，交代尚未核对与结构化设置', () => {
    render(
      <职位正文展示
        数据={{
          ...说明未知数据,
          匹配: { 种类: '说明', 分: 92, 说明: ['经验与学历尚未核对', '结构化设置：已确认'] },
        }}
      />,
    );
    expect(screen.getByRole('img', { name: '适配 92 分' })).toBeTruthy();
    expect(screen.queryByLabelText('匹配分未知')).toBeNull();
    expect(screen.getByText('经验与学历尚未核对')).toBeTruthy();
    expect(screen.getByText('结构化设置：已确认')).toBeTruthy();
  });

  it('公司未知图位 + 未知元行照常渲染，公司块仍非交互（无 ref 无打开回调）', () => {
    render(<职位正文展示 数据={说明未知数据} />);
    expect(screen.getByLabelText('公司图片未知')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /云衢科技/ })).toBeNull();
    for (const 标签 of ['融资阶段', '规模', '行业', '成立', '地址']) {
      expect(screen.getByText(标签)).toBeTruthy();
    }
    expect(screen.getAllByText('未知')).toHaveLength(5);
    // 空简介 → 介绍段给未知文案，不渲染空白兜底
    expect(screen.getByText('公司简介未知')).toBeTruthy();
  });

  it('说明分支 rerender 成核对分支：匹配分未知占位让位给环，说明行不残留', () => {
    const { rerender } = render(<职位正文展示 数据={说明未知数据} />);
    rerender(<职位正文展示 数据={核对数据} />);
    expect(screen.queryByLabelText('匹配分未知')).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.queryByText('结构化设置：已确认')).toBeNull();
    expect(screen.getByRole('img', { name: '适配 50 分' })).toBeTruthy();
  });
});