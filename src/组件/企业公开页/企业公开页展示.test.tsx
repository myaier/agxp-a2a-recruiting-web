// 企业公开页展示 组件测：一份 JSX 吃 企业公开页资料 + 业务属性/回调。
// fixture 全部用本文件接口 A 构造，不读 Mock 表、不读应用状态、不发请求；
// 断言钉住 Spec §4 的顺序/文案/来源：缺字段占位、核验 badge 各管各的、
// 反馈未知不画图、岗位能力 null 不可点。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 企业公开页展示 from './企业公开页展示';
import type { 企业公开页资料, 企业公开页展示属性 } from './类型';

const 完整资料: 企业公开页资料 = {
  名称: '云衢科技',
  图片: 'https://cdn.example.com/org_1/media_1.png',
  规模行: 'C 轮 · 500-1000 人 · 金融科技',
  简介: ['做券商与银行的交易中台。', '技术团队来自头部券商。'],
  文化: '把复杂留给系统，把确定性交给客户。',
  历程: [
    { 年份: '2018', 事件: '成立' },
    { 年份: '2021', 事件: 'A 轮' },
  ],
  业务: ['交易中台', '清结算系统'],
  相册: ['https://cdn.example.com/相册1.png', 'https://cdn.example.com/相册2.png'],
  产品: '交易网关多活',
  团队: [{ 姓名: '林一', 职务: '网关负责人', 简介: '负责多活' }],
  作息: '上午 09:30 – 下午 07:00 · 双休',
  条款: [
    { 名称: '五险一金', 说明: '养老、医疗、失业、工伤、生育保险与公积金', 已核: true },
    { 名称: '股票期权', 说明: null, 已核: false },
  ],
  代理核对已知: true,
  地址: '上海市浦东新区世纪大道 1568 号',
  地址补充: '地铁 2 / 4 / 6 / 9 号线世纪大道站',
  反馈: [
    { 标签: '技术氛围好', 条数: 42 },
    { 标签: '流程规范', 条数: 21 },
  ],
  工商: [{ 项: '公司全称', 值: '上海云衢信息科技有限公司' }],
  工商来源说明: '已核验',
  身份: {
    法定名称: null,
    展示名称: '云衢科技',
    核验时间: null,
    已核验: false,
    岗位数: 46,
    岗位数已核验: false,
  },
  页脚: '公司自述由企业提供 · 工商信息经第三方核验 · 如有不实可举报',
};

/** Backend 形态的资料：工商缺失、身份已核验、岗位能力不可用 */
const Backend资料: 企业公开页资料 = {
  ...完整资料,
  工商: null,
  工商来源说明: null,
  身份: {
    法定名称: '上海云衢科技有限公司',
    展示名称: '云衢科技',
    核验时间: '2026-08-24',
    已核验: true,
    岗位数: 0,
    岗位数已核验: true,
  },
};

function 渲染公开页(覆盖: Partial<企业公开页展示属性> = {}, 资料覆盖: Partial<企业公开页资料> = {}) {
  const 属性: 企业公开页展示属性 = {
    资料: { ...完整资料, ...资料覆盖 },
    返回: vi.fn(),
    导航: vi.fn(),
    岗位: [
      { 编号: 'J-01', 职位: '平台架构师', 薪资: '60-80k', 在谈: true, 打开: vi.fn() },
      { 编号: 'J-02', 职位: '清结算工程师', 薪资: '45-60k', 在谈: false, 打开: vi.fn() },
    ],
    岗位层说明: '其余 44 个岗位不匹配你当前的求职意向，已被过滤掉，没有展开。',
    条款层说明: '想让代理去核某一条？在这一单的详情页底部对代理说一句，它会带进下一轮。',
    ...覆盖,
  };
  return { ...render(<企业公开页展示 {...属性} />), 属性 };
}

/** 换一份资料重渲染（同一容器，保持既有 DOM 可继续查询） */
function 重渲染(
  视图: ReturnType<typeof 渲染公开页>,
  资料覆盖: Partial<企业公开页资料>,
  属性覆盖: Partial<企业公开页展示属性> = {},
) {
  视图.rerender(
    <企业公开页展示
      资料={{ ...完整资料, ...资料覆盖 }}
      返回={视图.属性.返回}
      导航={视图.属性.导航}
      岗位={视图.属性.岗位}
      岗位层说明={视图.属性.岗位层说明}
      条款层说明={视图.属性.条款层说明}
      {...属性覆盖}
    />,
  );
}

describe('企业公开页展示 · 主屏与公司自述', () => {
  it('头部：名称、真实 LOGO、规模行、主营业务标签齐备', () => {
    const { container } = 渲染公开页();
    expect(screen.getByRole('heading', { name: '云衢科技' })).toBeTruthy();
    expect(
      container.querySelector('img[src="https://cdn.example.com/org_1/media_1.png"]'),
    ).not.toBeNull();
    expect(screen.getByText('C 轮 · 500-1000 人 · 金融科技')).toBeTruthy();
    expect(screen.getByText('主营业务')).toBeTruthy();
    expect(screen.getByText('交易中台')).toBeTruthy();
  });

  it('三 Tab 只换自述正文，缺失的 Tab 显示对应未知', async () => {
    const 用户 = userEvent.setup();
    渲染公开页({}, { 简介: null, 文化: null, 历程: null });
    expect(screen.getByText('公司简介未知')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '企业文化' }));
    expect(screen.getByText('企业文化未知')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '发展历程' }));
    expect(screen.getByText('发展历程未知')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '公司简介' }));
    expect(screen.getByText('公司简介未知')).toBeTruthy();
  });

  it('有数据的 Tab 显示原事实；历程用年份+事件拼接', async () => {
    const 用户 = userEvent.setup();
    渲染公开页();
    expect(screen.getByText('做券商与银行的交易中台。技术团队来自头部券商。')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '发展历程' }));
    expect(screen.getByText('2018 成立；2021 A 轮')).toBeTruthy();
  });

  it('读全文层固定五部分，主屏没有的产品/团队在这里完整可达', async () => {
    const 用户 = userEvent.setup();
    渲染公开页();
    await 用户.click(screen.getByRole('button', { name: '读全文 ›' }));
    for (const 节标 of ['公司简介', '企业文化', '发展历程', '产品介绍', '团队介绍']) {
      expect(screen.getAllByText(节标).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('做券商与银行的交易中台。')).toBeTruthy();
    expect(screen.getByText('交易网关多活')).toBeTruthy();
    expect(screen.getByText('林一')).toBeTruthy();
    expect(screen.getByText('负责多活')).toBeTruthy();
    // 关闭后回到主屏：主屏不保留 Backend 独有的产品/团队独立卡
    await 用户.click(screen.getByRole('button', { name: '关闭' }));
    expect(screen.queryByText('交易网关多活')).toBeNull();
  });

  it('全文五部分缺失时逐部分显示未知，不丢区块', async () => {
    const 用户 = userEvent.setup();
    渲染公开页({}, { 简介: null, 文化: null, 历程: null, 产品: null, 团队: null });
    await 用户.click(screen.getByRole('button', { name: '读全文 ›' }));
    // 主屏截断区与全文层同文案，逐部分计数即可
    for (const 占位 of ['公司简介未知', '企业文化未知', '发展历程未知', '产品介绍未知', '团队介绍未知']) {
      expect(screen.getAllByText(占位).length).toBeGreaterThan(0);
    }
  });

  it('团队成员子字段缺失分别说明，不让整行消失', async () => {
    const 用户 = userEvent.setup();
    渲染公开页({}, { 团队: [{ 姓名: null, 职务: null, 简介: null }] });
    await 用户.click(screen.getByRole('button', { name: '读全文 ›' }));
    expect(screen.getByText('成员姓名未知')).toBeTruthy();
    expect(screen.getByText('成员职务未知')).toBeTruthy();
    expect(screen.getByText('成员简介未知')).toBeTruthy();
  });

  it('主营业务缺失显示占位，不整卡消失', () => {
    渲染公开页({}, { 业务: null });
    expect(screen.getByText('主营业务')).toBeTruthy();
    expect(screen.getByText('主营业务未知')).toBeTruthy();
  });

  it('缺 LOGO 用中性空白图位与可访问说明，不拿首字冒充', () => {
    渲染公开页({}, { 图片: null });
    expect(screen.getByRole('img', { name: '企业 LOGO 未知' })).toBeTruthy();
  });
});

describe('企业公开页展示 · 相册与在职者反馈', () => {
  it('有照片横滑展示，无照片保留一格等尺寸空白图位并标注未知', () => {
    const 视图 = 渲染公开页();
    expect(视图.container.querySelectorAll('img[src*="相册"]').length).toBe(2);
    重渲染(视图, { 相册: null });
    expect(screen.getByText('公司相册未知')).toBeTruthy();
    expect(screen.getByRole('img', { name: '公司相册未知' })).toBeTruthy();
    expect(视图.container.querySelector('img[src*="相册"]')).toBeNull();
  });

  it('反馈未知只有文案：无统计条、无计数、无来源断言', () => {
    const { container } = 渲染公开页({}, { 反馈: null });
    expect(screen.getByText('在职者反馈未知')).toBeTruthy();
    expect(container.querySelector('[class*="感受条轨"]')).toBeNull();
    expect(screen.queryByText('来自平台内匿名评价')).toBeNull();
  });

  it('有反馈数据才画统计条；分母为 0 时条宽为 0，不产生 NaN', () => {
    const 视图 = 渲染公开页();
    expect(screen.getByText('技术氛围好')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(视图.container.querySelector('[class*="感受条"]')).not.toBeNull();
    重渲染(视图, { 反馈: [{ 标签: '技术氛围好', 条数: 0 }] });
    const 条 = 视图.container.querySelector<HTMLElement>('[class*="感受条轨"] > [class*="感受条"]');
    expect(条?.style.width).toBe('0%');
    expect(条?.style.width).not.toContain('NaN');
  });
});

describe('企业公开页展示 · 作息与条款', () => {
  it('摘要区分已知福利与福利未知，已核计数只在代理核对已知时出现', () => {
    const 视图 = 渲染公开页();
    expect(screen.getByText('已提供 2 条条款 · 其中')).toBeTruthy();
    expect(screen.getByText('1 条已由代理核对')).toBeTruthy();
    重渲染(视图, {}, { 资料: { ...完整资料, 代理核对已知: false } });
    expect(screen.getByText('已提供 2 条条款')).toBeTruthy();
    expect(screen.queryByText(/已由代理核对/)).toBeNull();
  });

  it('条款缺失显示福利信息未知，不写 0 条条款', () => {
    渲染公开页({}, { 条款: null });
    expect(screen.getByText('福利信息未知')).toBeTruthy();
    expect(screen.queryByText(/已提供/)).toBeNull();
  });

  it('条款层：已核/自述分组、缺说明标条款说明未知，操作指引文案保留', async () => {
    const 用户 = userEvent.setup();
    渲染公开页();
    await 用户.click(screen.getByText('作息与条款'));
    expect(screen.getByText('五险一金')).toBeTruthy();
    expect(screen.getByText('养老、医疗、失业、工伤、生育保险与公积金')).toBeTruthy();
    expect(screen.getByText('股票期权')).toBeTruthy();
    expect(screen.getByText('条款说明未知')).toBeTruthy();
    expect(
      screen.getByText('想让代理去核某一条？在这一单的详情页底部对代理说一句，它会带进下一轮。'),
    ).toBeTruthy();
  });

  it('代理核对未知：层内显示未知占位，不生成已核计数，也不给未接入的操作指引', async () => {
    const 用户 = userEvent.setup();
    渲染公开页({ 条款层说明: null }, { 代理核对已知: false });
    await 用户.click(screen.getByText('作息与条款'));
    expect(screen.getByText('代理核对信息未知')).toBeTruthy();
    // 不出现任何已核计数（真实 0 也不行：接口没提供核对结果）
    expect(screen.queryByText(/条已由代理核对|已核对 \d+ 条/)).toBeNull();
    expect(screen.queryByText(/想让代理去核/)).toBeNull();
  });

  it('真实 0 条已核：按 0 展示，不冒充未知也不虚构勾选', async () => {
    const 用户 = userEvent.setup();
    渲染公开页({}, { 条款: [{ 名称: '零食下午茶', 说明: null, 已核: false }] });
    expect(screen.getByText('已提供 1 条条款 · 其中')).toBeTruthy();
    expect(screen.getByText('0 条已由代理核对')).toBeTruthy();
    await 用户.click(screen.getByText('作息与条款'));
    expect(screen.getByText('已核对 0 条条款。')).toBeTruthy();
  });

  it('作息缺失显示作息信息未知', () => {
    渲染公开页({}, { 作息: null });
    expect(screen.getByText('作息信息未知')).toBeTruthy();
  });
});

describe('企业公开页展示 · 办公地与导航能力', () => {
  it('有导航回调才渲染可点的导航入口', async () => {
    const 用户 = userEvent.setup();
    const { 属性 } = 渲染公开页();
    await 用户.click(screen.getByRole('button', { name: '导航 ›' }));
    expect(属性.导航).toHaveBeenCalledTimes(1);
  });

  it('导航能力不可用时只显示不可执行提示，不伪装按钮', () => {
    渲染公开页({ 导航: null });
    expect(screen.getByText('导航暂不可用')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '导航 ›' })).toBeNull();
  });

  it('地址与地址补充缺失分别显示未知', () => {
    渲染公开页({}, { 地址: null, 地址补充: null });
    expect(screen.getByText('办公地址未知')).toBeTruthy();
    expect(screen.getByText('地址补充未知')).toBeTruthy();
  });
});

describe('企业公开页展示 · 工商与企业身份', () => {
  it('Mock 侧：工商保留条目与已核验 badge，身份行按事实显示未知，不互相覆盖', () => {
    const { container } = 渲染公开页();
    expect(screen.getByText('工商与企业身份')).toBeTruthy();
    expect(screen.getByText('工商资料')).toBeTruthy();
    expect(screen.getByText('企业身份')).toBeTruthy();
    expect(screen.getByText('公司全称')).toBeTruthy();
    expect(screen.getByText('上海云衢信息科技有限公司')).toBeTruthy();
    // 工商来源说明只作用于工商组
    expect(screen.getByText('已核验')).toBeTruthy();
    // 身份组单独给未核验 badge，缺失的身份字段显示各自的未知
    expect(screen.getByText('未核验')).toBeTruthy();
    expect(screen.getByText('法定名称未知')).toBeTruthy();
    expect(screen.getByText('核验时间未知')).toBeTruthy();
    // Mock 数量没有核验语义，不能借 Backend 文案宣称已核验
    expect(screen.getByText('46 个在招岗位')).toBeTruthy();
    expect(screen.queryByText('46 个已核验在招岗位')).toBeNull();
    expect(container.querySelector('[class*="工商行"]')).not.toBeNull();
  });

  it('Backend 侧：工商缺失显示工商资料未知，身份四项真实保留且真实 0 正常展示', () => {
    渲染公开页({}, Backend资料);
    expect(screen.getByText('工商资料未知')).toBeTruthy();
    expect(screen.queryByText('公司全称')).toBeNull();
    // 只有身份组给已核验 badge，工商组不再有说明
    expect(screen.getAllByText('已核验').length).toBe(1);
    expect(screen.queryByText('未核验')).toBeNull();
    expect(screen.getByText('上海云衢科技有限公司')).toBeTruthy();
    expect(screen.getByText('2026-08-24')).toBeTruthy();
    expect(screen.getByText('0 个已核验在招岗位')).toBeTruthy();
  });
});

describe('企业公开页展示 · 底部岗位能力', () => {
  it('岗位能力可用：底部主键打开岗位层，条目回调逐条触发', async () => {
    const 用户 = userEvent.setup();
    const { 属性 } = 渲染公开页();
    await 用户.click(screen.getByRole('button', { name: '看这家在招的 46 个岗位' }));
    expect(screen.getByText('平台架构师')).toBeTruthy();
    expect(screen.getByText('你已在谈这一岗')).toBeTruthy();
    expect(screen.getByText('可让代理去谈')).toBeTruthy();
    expect(screen.getByText('其余 44 个岗位不匹配你当前的求职意向，已被过滤掉，没有展开。')).toBeTruthy();
    await 用户.click(screen.getByText('平台架构师'));
    expect(属性.岗位?.[0].打开).toHaveBeenCalledTimes(1);
    expect(属性.岗位?.[1].打开).not.toHaveBeenCalled();
  });

  it('岗位能力为 null：底部只剩事实与不可用说明，没有可点的假入口', () => {
    渲染公开页({ 岗位: null, 岗位层说明: null }, {
      身份: {
        法定名称: '上海云衢科技有限公司',
        展示名称: '云衢科技',
        核验时间: '2026-08-24',
        已核验: true,
        岗位数: 2,
        岗位数已核验: true,
      },
    });
    expect(screen.getByText('岗位列表暂不可用')).toBeTruthy();
    // 事实计数保留（身份区 + 底部各一次），但不提供查看入口
    expect(screen.getAllByText('2 个已核验在招岗位').length).toBe(2);
    expect(screen.queryByRole('button', { name: /看这家在招的/ })).toBeNull();
    expect(screen.queryByText('平台架构师')).toBeNull();
  });
});

describe('企业公开页展示 · 页脚与返回', () => {
  it('页脚来源文案来自资料，返回回调触发', async () => {
    const 用户 = userEvent.setup();
    const { 属性 } = 渲染公开页();
    expect(screen.getByText('公司自述由企业提供 · 工商信息经第三方核验 · 如有不实可举报')).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(属性.返回).toHaveBeenCalledTimes(1);
  });
});
