// 求职在谈卡：Mock 在谈单与 Backend P5 候选在谈行共用的唯一卡面（Spec §5.3）。
// 视觉基准 = 原 在谈首页.tsx 的 Mock 在谈卡：公司头行（字标 + 公司名/简介 + 右列[分数 + 薪资]）
// → 职位名 → 标签行 → 在谈阶段区。Backend 当前不提供公司名/简介/图与匹配分，占位由本卡与
// 卡片分数 按同一规则渲染（Spec §4.2/§4.3）；冻结的职位/薪资/城市/技能照常显示。
// 无 Provider 宿主：回调全部走 props。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import 求职在谈卡 from './求职在谈卡';
import type { 求职在谈卡属性, 在谈阶段信息 } from './类型';

function 阶段(覆盖: Partial<在谈阶段信息> = {}): 在谈阶段信息 {
  return {
    标题: '意向确认',
    色系: '意向确认',
    待办: true,
    徽标: null,
    文本: '见面条件已一致，是否确认意向',
    注意说明: null,
    ...覆盖,
  };
}

/** 默认卡：Mock 基准字段（公司三件套 + 已知 94 分），逐用例覆盖自己关心的槽位。
 *  公司名用映射外公司（云帆科技）：不触发静态公司标 img，卡面只看本卡自己的逻辑。 */
function 渲染卡(覆盖: Partial<求职在谈卡属性> = {}): 求职在谈卡属性 {
  const 属性: 求职在谈卡属性 = {
    公司: '云帆科技',
    公司简介: '未上市 · 200-500 人',
    公司字标: { 首字: '云', 公司名: '云帆科技' },
    匹配分: 94,
    薪资: '20-40K·14薪',
    职位: '资深后端工程师 · 交易网关',
    标签: ['上海 · 浦东', '15 薪', 'Go'],
    阶段: 阶段(),
    打开: vi.fn(),
    ...覆盖,
  };
  render(<求职在谈卡 {...属性} />);
  return 属性;
}

describe('求职在谈卡 · 卡面与占位（Spec §5.3 / §4）', () => {
  it('Mock 基准：公司头行 + 右列[分+薪资] → 职位 → 标签 → 阶段区，区域顺序固定', () => {
    render(<求职在谈卡
      公司="云帆科技"
      公司简介="未上市 · 200-500 人"
      公司字标={{ 首字: '云', 公司名: '云帆科技' }}
      匹配分={94}
      薪资="20-40K·14薪"
      职位="资深后端工程师 · 交易网关"
      标签={['上海 · 浦东', '15 薪', 'Go']}
      阶段={阶段()}
      打开={vi.fn()}
    />);
    expect(screen.getByTestId('求职在谈卡')).toBeTruthy();
    expect(screen.getByText('云')).toBeTruthy(); // 字标首字照旧
    expect(screen.getByText('云帆科技')).toBeTruthy();
    expect(screen.getByText('未上市 · 200-500 人')).toBeTruthy();
    expect(screen.getByRole('img', { name: '适配 94 分' })).toBeTruthy();
    // 原展示破折号行为：薪资里的 - 照旧换成 –（不改币种/单位/数值）
    expect(screen.getByText('20–40K·14薪')).toBeTruthy();
    expect(screen.getByText('资深后端工程师 · 交易网关')).toBeTruthy();
    for (const 标签 of ['上海 · 浦东', '15 薪', 'Go']) {
      expect(screen.getByText(标签)).toBeTruthy();
    }
    expect(screen.getByText('见面条件已一致，是否确认意向')).toBeTruthy();
    const 区域顺序 = Array.from(
      screen.getByTestId('求职在谈卡').querySelectorAll('[data-card-region]'),
    ).map((元) => 元.getAttribute('data-card-region'));
    expect(区域顺序).toEqual(['company', 'score', 'salary', 'title', 'tags', 'stage']);
  });

  it('全占位：公司名/简介/字标/分数/标签全未知，冻结的职位与薪资不丢（P5 候选行）', () => {
    const 宿主 = render(<求职在谈卡
      公司={null}
      公司简介={null}
      公司字标={null}
      匹配分={null}
      薪资="300-500 元/天"
      职位="AI 产品实习生"
      标签={[]}
      阶段={阶段()}
      打开={vi.fn()}
    />);
    expect(screen.getByText('公司信息未知')).toBeTruthy();
    expect(screen.getByText('公司简介未知')).toBeTruthy();
    expect(screen.getByLabelText('公司图片未知')).toBeTruthy();
    // 不按未知名称命中静态公司标：连字标元素都不渲染，更不会发空 URL / 外部占位图请求
    expect(宿主.container.querySelector('[class*="公司字标"]')).toBeNull();
    expect(screen.getByTestId('求职在谈卡').querySelectorAll('img')).toHaveLength(0);
    // 分数位 = 未知占位，不画环、不补 0
    expect(screen.queryByRole('img', { name: /适配/ })).toBeNull();
    expect(screen.getByLabelText('匹配分未知')).toBeTruthy();
    expect(screen.getByText('标签信息未知')).toBeTruthy();
    // 未知分说明在分数容器内：薪资位仍在右列原位，职位/阶段照常
    expect(screen.getByText('AI 产品实习生')).toBeTruthy();
    expect(screen.getByText('300–500 元/天')).toBeTruthy();
    expect(screen.getByText('见面条件已一致，是否确认意向')).toBeTruthy();
  });

  it('标签 trim 后无有效展示项才占位；空白项不算展示项，非空项保留顺序与重复', () => {
    render(<求职在谈卡
      公司={null}
      公司简介={null}
      公司字标={null}
      匹配分={null}
      薪资="300-500 元/天"
      职位="AI 产品实习生"
      标签={['上海', '  ', '', 'Python', 'Python']}
      阶段={阶段()}
      打开={vi.fn()}
    />);
    expect(screen.queryByText('标签信息未知')).toBeNull();
    expect(screen.getByText('上海')).toBeTruthy();
    expect(screen.getAllByText('Python')).toHaveLength(2); // 城市在前、技能随后，重复不去
    const 顺序 = Array.from(
      screen.getByTestId('求职在谈卡').querySelector('[data-card-region="tags"]')?.children ?? [],
    ).map((元) => 元.textContent);
    expect(顺序).toEqual(['上海', 'Python', 'Python']);
  });

  it('纯空白公司字段按缺失处理：公司名/简介给占位，公司名占位带次要色类（Spec §4.1/§6）', () => {
    render(<求职在谈卡
      公司=""
      公司简介="  "
      公司字标={{ 首字: '云', 公司名: '云帆科技' }}
      匹配分={94}
      薪资="20-40K·14薪"
      职位="资深后端工程师 · 交易网关"
      标签={['上海 · 浦东']}
      阶段={阶段()}
      打开={vi.fn()}
    />);
    expect(screen.getByText('公司信息未知')).toBeTruthy();
    expect(screen.getByText('公司简介未知')).toBeTruthy();
    // jsdom 不解析 CSS var：公司名占位断次要色类；简介占位沿用 .公司简介 的 --弱化，不另加类
    expect((screen.getByText('公司信息未知').getAttribute('class') ?? '').includes('未知文')).toBe(true);
    expect((screen.getByText('公司简介未知').getAttribute('class') ?? '').includes('未知文')).toBe(false);
  });

  it('阶段区复用在谈阶段区：徽标与注意说明都落在阶段区里', () => {
    render(<求职在谈卡
      公司={null}
      公司简介={null}
      公司字标={null}
      匹配分={null}
      薪资="300-500 元/天"
      职位="AI 产品实习生"
      标签={[]}
      阶段={阶段({ 待办: false, 徽标: '需注意', 注意说明: 'AI 服务暂时不可用，本 Case 尚未继续' })}
      打开={vi.fn()}
    />);
    const 阶段区 = screen.getByTestId('求职在谈卡').querySelector('[data-card-region="stage"]');
    expect(阶段区?.textContent).toContain('意向确认');
    expect(阶段区?.textContent).toContain('需注意');
    expect(阶段区?.textContent).toContain('AI 服务暂时不可用，本 Case 尚未继续');
    expect(阶段区?.textContent).toContain('见面条件已一致，是否确认意向');
  });
});

describe('求职在谈卡 · 行为', () => {
  it('整卡点击只调 打开；卡上没有收藏/委托等第二入口', () => {
    const 属性 = 渲染卡();
    const 键们 = screen.getByTestId('求职在谈卡').querySelectorAll('button');
    expect(键们).toHaveLength(1); // 白卡整卡即唯一可点元素
    fireEvent.click(键们[0] as Element);
    expect(属性.打开).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /收藏|委托|淘汰/ })).toBeNull();
  });
});
