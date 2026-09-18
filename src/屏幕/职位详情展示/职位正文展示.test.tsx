// 职位正文展示 · 展示测试（P1 Task 2；匹配展示域 Task 5 模型化）。
//
// 展示只按 数据/能力 渲染：匹配区只吃 匹配分析模型（C3 匹配分析块，六维直接展开，
// 无旧 JD 核对行路径）、未知占位（§3.2）只作用于缺失节点、完整状态沿用原声明值。
// 有值 → 空 的 rerender 逐槽断言无旧数据残留。

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { 职位正文展示 } from './职位正文展示';
import type { 职位正文数据 } from './类型';
import { 解匹配解释 } from '../../数据/招聘数据源/匹配解释';
import { BFF匹配解释92分样本 } from '../../测试/BFF样本';

/** 已解码六维解释（走真实解码器构造，不吃手工行） */
const 解释92 = 解匹配解释(BFF匹配解释92分样本, 92) ?? (() => { throw new Error('样本必须可解码'); })();

/** Backend 推荐路径：精确推荐上下文 + 已展开批次解释 → 匹配分析块六维直接展开 */
const 模型数据: 职位正文数据 = {
  职位: '交易中台架构师',
  薪资: '60-80K',
  匹配: { 分数: 92, 解释: 解释92, 有限依据: [], 上下文: '有来源' },
  职位详情标题: '岗位信息与职位详情',
  职位事实行: ['城市：上海', '办公方式：混合'],
  职位详情行: ['1、负责交易中台的架构演进；', '2、主导多活与稳定性治理。'],
  职位要求标题: '职位要求（补充说明，不自动解析）',
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

/** Backend 详情直取形态：无推荐分、JD 空正文、公司/发布人全缺失（通用岗位直达） */
const 说明未知数据: 职位正文数据 = {
  职位: 'AI 产品实习生',
  薪资: '300-500 元/天',
  匹配: { 分数: null, 解释: null, 有限依据: [], 上下文: '无推荐上下文' },
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

describe('职位正文展示 · 匹配分析模型（C3 匹配分析块，六维直接展开）', () => {
  it('职位名/薪资 → 匹配分析（44px 环 + 六维行直接展开）→ JD 两段 → 公司元行 → 发布人 → 直接聊', () => {
    const 直接聊 = vi.fn();
    render(<职位正文展示 数据={模型数据} 打开公司={() => undefined} 直接聊={直接聊} />);
    expect(screen.getByText('交易中台架构师')).toBeTruthy();
    expect(screen.getByText('60-80K')).toBeTruthy();
    // 本页唯一总分环：分析区头行 44px 环（§3.4）
    expect(screen.getByRole('img', { name: '适配 92 分' })).toBeTruthy();
    expect(screen.queryByLabelText('匹配分未知')).toBeNull();
    // 六维行直接展开：副标 + 冻结说明（取自真实解码解释）
    expect(screen.getByText('推荐生成时的匹配结果')).toBeTruthy();
    expect(screen.getByText('命中11/12个岗位关键词')).toBeTruthy();
    expect(screen.getByText('薪资范围接近')).toBeTruthy();
    expect(screen.getByText('技能按关键词命中核对，不代表能力认证。')).toBeTruthy();
    expect(screen.getByText('1、负责交易中台的架构演进；')).toBeTruthy();
    expect(screen.getByText('融资阶段')).toBeTruthy();
    expect(screen.getByText('梁思远 · 美团')).toBeTruthy();
    expect(screen.getByRole('button', { name: '直接聊' })).toBeTruthy();
    // 顺序：薪资 → 匹配头 → 六维 →（JD 卡）职位详情标题
    const 全文 = document.body.textContent ?? '';
    expect(全文.indexOf('60-80K')).toBeLessThan(全文.indexOf('推荐生成时的匹配结果'));
    expect(全文.indexOf('命中11/12个岗位关键词')).toBeLessThan(全文.indexOf('岗位信息与职位详情'));
  });

  it('旧 JD 核对路径已删除：任何模型都不再出 学历/经验 核对行与生成分析段（学历不属于六维）', () => {
    render(<职位正文展示 数据={模型数据} />);
    expect(screen.queryByText(/按岗位设置的结构化要求核对/)).toBeNull();
    expect(screen.queryByText(/简历未提及/)).toBeNull();
    expect(screen.queryByText(/^学历 本科/)).toBeNull();
    expect(screen.queryByText('经验与学历尚未核对')).toBeNull();
    expect(screen.queryByText(/结构化设置：/)).toBeNull();
  });

  it('真实 0 分仍是进度环，不是未知占位', () => {
    render(
      <职位正文展示
        数据={{ ...模型数据, 匹配: { 分数: 0, 解释: 解释92, 有限依据: [], 上下文: '有来源' } }}
      />,
    );
    expect(screen.getByRole('img', { name: '适配 0 分' })).toBeTruthy();
    expect(screen.queryByLabelText('匹配分未知')).toBeNull();
  });

  it('null 分（通用岗位直达）：中性「匹配分未知」分数位 + 「当前职位没有特定推荐上下文」，不画假 0 环、不出六行', () => {
    render(<职位正文展示 数据={说明未知数据} />);
    expect(screen.getByText('匹配度分析')).toBeTruthy();
    expect(screen.getByLabelText('匹配分未知')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('当前职位没有特定推荐上下文')).toBeTruthy();
    expect(screen.getByText('暂无该次匹配的详细分析')).toBeTruthy();
    expect(screen.queryByRole('img', { name: /适配/ })).toBeNull();
    expect(screen.queryByText('推荐生成时的匹配结果')).toBeNull();
  });

  it('原推荐不可用（批次不符/穷尽未找到）：显示「该次推荐上下文已不可用」，不借新批次分数', () => {
    render(
      <职位正文展示
        数据={{ ...说明未知数据, 匹配: { 分数: null, 解释: null, 有限依据: [], 上下文: '原推荐不可用' } }}
      />,
    );
    expect(screen.getByText('该次推荐上下文已不可用')).toBeTruthy();
    expect(screen.queryByText('当前职位没有特定推荐上下文')).toBeNull();
    expect(screen.getByLabelText('匹配分未知')).toBeTruthy();
  });

  it('解释合法缺失但有旧正向依据：同区标「有限依据」仅列已知原因，不补六条假状态', () => {
    render(
      <职位正文展示
        数据={{
          ...模型数据,
          匹配: { 分数: 92, 解释: null, 有限依据: ['职位方向匹配', '工作地点匹配'], 上下文: '有来源' },
        }}
      />,
    );
    expect(screen.getByRole('img', { name: '适配 92 分' })).toBeTruthy();
    expect(screen.getByText('暂无该次匹配的详细分析')).toBeTruthy();
    expect(screen.getByText('有限依据')).toBeTruthy();
    expect(screen.getByText('职位方向匹配')).toBeTruthy();
    expect(screen.getByText('工作地点匹配')).toBeTruthy();
    expect(screen.queryByText('推荐生成时的匹配结果')).toBeNull();
  });

  it('新解释存在时不再另设「推荐依据」小区（§3.4），也不与旧依据重复分析同现', () => {
    render(<职位正文展示 数据={模型数据} />);
    expect(screen.queryByText('推荐依据')).toBeNull();
    expect(screen.queryByText('暂无推荐依据')).toBeNull();
    expect(screen.queryByText('当前接口仅提供部分匹配依据')).toBeNull();
  });

  it('直接聊能力由连接层决定：不给回调就不渲染按钮（Backend 无直聊坐标）', () => {
    render(<职位正文展示 数据={模型数据} 打开公司={() => undefined} />);
    expect(screen.queryByRole('button', { name: '直接聊' })).toBeNull();
  });

  it('打开公司在场渲染可点公司块，缺省渲染非交互块（同一 class）', async () => {
    const 用户 = userEvent.setup();
    const 打开公司 = vi.fn();
    const 页 = render(<职位正文展示 数据={模型数据} 打开公司={打开公司} />);
    await 用户.click(screen.getByRole('button', { name: /美团/ }));
    expect(打开公司).toHaveBeenCalledTimes(1);
    页.unmount();

    render(<职位正文展示 数据={模型数据} />);
    expect(screen.queryByRole('button', { name: /美团/ })).toBeNull();
    expect(screen.getByText('美团')).toBeTruthy();
  });

  it('有值 → 空 rerender：旧六维行、旧匹配环、旧发布人身份与备注全部不残留', () => {
    const { rerender } = render(<职位正文展示 数据={模型数据} 直接聊={() => undefined} />);
    rerender(<职位正文展示 数据={说明未知数据} />);
    expect(screen.queryByText('交易中台架构师')).toBeNull();
    expect(screen.queryByRole('img', { name: /适配/ })).toBeNull();
    expect(screen.queryByText('推荐生成时的匹配结果')).toBeNull();
    expect(screen.queryByText('命中11/12个岗位关键词')).toBeNull();
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

  it('换记录 rerender：六维行跟模型走，旧解释不残留（同岗位双批次不串值的展示面前置）', () => {
    const 另一解释 = { ...解释92, total_points: 50 };
    const { rerender } = render(<职位正文展示 数据={模型数据} />);
    expect(screen.getByText('命中11/12个岗位关键词')).toBeTruthy();
    rerender(
      <职位正文展示
        数据={{ ...模型数据, 匹配: { 分数: 50, 解释: 另一解释, 有限依据: [], 上下文: '有来源' } }}
      />,
    );
    expect(screen.getByRole('img', { name: '适配 50 分' })).toBeTruthy();
    expect(screen.queryByRole('img', { name: '适配 92 分' })).toBeNull();
  });
});

describe('职位正文展示 · 缺失占位（§3.2）', () => {
  it('公司未知图位 + 未知元行照常渲染，公司块仍非交互（无 ref 无打开回调）', () => {
    render(<职位正文展示 数据={说明未知数据} />);
    expect(screen.getByLabelText('公司图片未知')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /云衢科技/ })).toBeNull();
    for (const 标签 of ['融资阶段', '规模', '行业', '成立', '地址']) {
      expect(screen.getByText(标签)).toBeTruthy();
    }
    // 匹配区占位 — 也算一处「—」，加上五个未知元行
    expect(screen.getAllByText('未知')).toHaveLength(5);
    // 空简介 → 介绍段给未知文案，不渲染空白兜底
    expect(screen.getByText('公司简介未知')).toBeTruthy();
  });
});

describe('职位正文展示 · 真实媒体图位（Spec §6.1）', () => {
  const 公司图数据: 职位正文数据 = {
    ...说明未知数据,
    公司: {
      ...说明未知数据.公司,
      图: { 种类: '图片', URL: 'https://cdn.example.com/logo.png', 兜底字: '云', 可访问名: '公司图片未知' },
    },
  };
  const 头像数据: 职位正文数据 = {
    ...说明未知数据,
    发布人: {
      ...说明未知数据.发布人,
      图: { 种类: '图片', URL: 'https://cdn.example.com/p.png', 兜底字: '', 可访问名: '发布人图片未知' },
    },
  };

  it('公司图位给真实 URL 时原图位节点渲染图片，不叠首字；公司块交互形态不变', () => {
    const 宿主 = render(<职位正文展示 数据={公司图数据} 打开公司={() => undefined} />);
    expect(宿主.container.querySelector('img[src="https://cdn.example.com/logo.png"]')).toBeTruthy();
    expect(screen.queryByText('云')).toBeNull();
    // 图位填充不改变公司槽形态：给了 打开公司 就还是可点公司块（同一节点）
    expect(screen.getByRole('button', { name: /云衢科技/ })).toBeTruthy();
  });

  it('公司 Logo 加载失败回中性首字块；换 URL 清失败态重新出图', () => {
    const 宿主 = render(<职位正文展示 数据={公司图数据} />);
    fireEvent.error(宿主.container.querySelector('img') as Element);
    expect(宿主.container.querySelector('img')).toBeNull();
    expect(screen.getByText('云')).toBeTruthy();
    宿主.rerender(<职位正文展示 数据={{ ...公司图数据, 公司: { ...公司图数据.公司, 图: { 种类: '图片', URL: 'https://cdn.example.com/logo-2.png', 兜底字: '云', 可访问名: '公司图片未知' } } }} />);
    expect(宿主.container.querySelector('img[src="https://cdn.example.com/logo-2.png"]')).toBeTruthy();
    expect(screen.queryByText('云')).toBeNull();
  });

  it('发布人头像渲染在原头像槽内；加载失败回既有图位（未知占位），换 URL 清失败态', () => {
    const 宿主 = render(<职位正文展示 数据={头像数据} />);
    const 图 = 宿主.container.querySelector('img[src="https://cdn.example.com/p.png"]');
    expect(图).toBeTruthy();
    fireEvent.error(图 as Element);
    expect(宿主.container.querySelector('img')).toBeNull();
    expect(screen.getByLabelText('发布人图片未知')).toBeTruthy();
    宿主.rerender(<职位正文展示 数据={{ ...头像数据, 发布人: { ...头像数据.发布人, 图: { 种类: '图片', URL: 'https://cdn.example.com/p2.png', 兜底字: '', 可访问名: '发布人图片未知' } } }} />);
    expect(宿主.container.querySelector('img[src="https://cdn.example.com/p2.png"]')).toBeTruthy();
  });

  it('字标/未知图位不渲染图片：Mock 字标与 Backend 中性占位行为逐字不变', () => {
    const 字标宿主 = render(<职位正文展示 数据={模型数据} />);
    expect(字标宿主.container.querySelectorAll('img').length).toBe(0);
    字标宿主.unmount();
    render(<职位正文展示 数据={说明未知数据} />);
    expect(document.querySelectorAll('img').length).toBe(0);
    expect(screen.getByLabelText('公司图片未知')).toBeTruthy();
    expect(screen.getByLabelText('发布人图片未知')).toBeTruthy();
  });
});