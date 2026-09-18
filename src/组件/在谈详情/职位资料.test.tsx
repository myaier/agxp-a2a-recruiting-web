// 职位资料 · 无 Provider 展示测试：组件只吃 职位资料信息 + 公司详情（详情按钮），
// 不读 Context/fixture、不请求数据、不拼路由。钉住契约 B 的缺失口径：
//   · 缺资料时五个区块全在原位，各区块有标题或标签，缺失显示缺失（分析 / JD / 要求 /
//     公司五元行 / 标签 / 对接人），绝不隐藏区块、绝不编默认值；
//   · 分析区 = 共享 匹配分析块（藏环 —— 顶栏分数是详情唯一总分，Spec §3.4）；
//     分数 0 合法、解释显式 null 给缺失说明、有限依据仅列已知原因，
//     绝不从分数/正文推断六行；聊天空隙（分析藏环=false）才在块内画唯一总分环；
//   · 部分公司字段缺失时保留已知部分，未知字段显示缺失；
//   · 空数组与 null 文案不同（「暂无…」vs「…缺失」）；
//   · 无合法公司导航坐标：入口真实 disabled、禁用说明可见、点击零回调；
//   · 同一已挂载组件 rerender 有值→合法空值：文字/图位变缺失、导航禁用且旧回调不再
//     执行；空值→有值再次可显示新值。
// 仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { 职位资料 } from './职位资料';
import 样式 from './职位资料.module.css';
import type { 详情按钮, 职位资料信息 } from './类型';
import { 解匹配解释 } from '../../数据/招聘数据源/匹配解释';
import { BFF匹配解释92分样本 } from '../../测试/BFF样本';

/** Backend 形态的导航坐标：无合法公司导航坐标，入口只留禁用说明。 */
const 禁用导航: 详情按钮 = {
  键: '公司详情',
  文案: '公司详情',
  外观: '次要',
  禁用说明: '公司详情暂不可用',
  执行: null,
};

function 可用导航(执行: () => void = () => undefined): 详情按钮 {
  return { 键: '公司详情', 文案: '公司详情', 外观: '次要', 禁用说明: null, 执行 };
}

/** 公司五元行：标签闭集固定，值可缺。 */
function 元行(值们: Partial<Record<'融资阶段' | '规模' | '行业' | '成立' | '地址', string>>) {
  const 序 = ['融资阶段', '规模', '行业', '成立', '地址'] as const;
  return 序.map((标签) => ({ 标签, 值: 值们[标签] ?? null }));
}

/** P5 形态：摘要已知（冻结四事实），其余字段全部缺失。 */
const 全缺信息: 职位资料信息 = {
  摘要: { 职位: '平台工程师', 城市: '上海', 薪资: '25-40K·16薪', 技能: ['Go', 'Kubernetes'] },
  分析: { 分数: null, 解释: null, 有限依据: [], 上下文: '有来源' },
  职位详情: null,
  职位要求: null,
  公司: { 名称: null, 字标: null, 简介: null, 元行: 元行({}), 标签: null },
  对接人: { 姓名: null, 职务: null, 字标: null },
  接口缺口说明: '当前在谈详情数据未提供',
};

/** Mock 形态：正文 / 公司 / 对接人齐备。 */
const 有值信息: 职位资料信息 = {
  摘要: { 职位: '资深后端工程师 · 交易网关', 城市: '上海', 薪资: '50-65K', 技能: ['Go', '高并发'] },
  分析: {
    分数: 92,
    解释: 解匹配解释(BFF匹配解释92分样本, 92)!,
    有限依据: [],
    上下文: '有来源',
  },
  职位详情: ['负责交易网关的稳定性与容量规划', '与结算侧共建对账链路'],
  职位要求: ['5 年以上后端经验', 'Go 主栈'],
  公司: {
    名称: '星尘智能',
    字标: '星',
    简介: '通用人工智能创业公司，专注交易与结算基础设施。',
    元行: 元行({ 融资阶段: 'A 轮', 行业: '人工智能', 地址: '上海市徐汇区' }),
    标签: ['弹性工作', '15 薪'],
  },
  对接人: { 姓名: '林一', 职务: '技术负责人', 字标: '林' },
  接口缺口说明: null,
};

describe('职位资料 · 全缺（Backend 形态）', () => {
  it('五个区块全部在原位且有标题；分析/JD/要求缺失显示缺失，已知冻结摘要如实保留', () => {
    render(<职位资料 信息={全缺信息} 公司详情={禁用导航} />);
    // 阅读顺序（spec §3.3）：匹配分析 → 职位详情 → 职位要求 → 公司 → 对接人
    for (const 标题 of ['匹配度分析', '职位详情', '职位要求', '公司信息', '对接人']) {
      expect(screen.getByText(标题)).toBeTruthy();
    }
    // 缺失区块：位置保留，解释缺失给约定缺失说明（Spec §5.2；旧「匹配分析缺失」随旧版式退役）
    expect(screen.getByText('暂无该次匹配的详细分析')).toBeTruthy();
    expect(screen.queryByText('匹配分析缺失')).toBeNull();
    expect(screen.getByText('职位详情缺失')).toBeTruthy();
    expect(screen.getByText('职位要求缺失')).toBeTruthy();
    expect(screen.getByText('公司介绍缺失')).toBeTruthy();
    expect(screen.getByText('公司标签缺失')).toBeTruthy();
    // 冻结四事实不丢（岗位摘要位如实展示，技能不冒充完整 JD）
    expect(screen.getByText('上海')).toBeTruthy();
    expect(screen.getByText('Kubernetes')).toBeTruthy();
  });

  it('公司五元行标签恒在、缺值显示「—」+ 可访问缺失说明；对接人缺姓名/职务不生成首字', () => {
    render(<职位资料 信息={全缺信息} 公司详情={禁用导航} />);
    for (const 标签 of ['融资阶段', '规模', '行业', '成立', '地址']) {
      expect(screen.getByText(标签)).toBeTruthy();
      expect(screen.getByTitle(`${标签}缺失`).textContent).toBe('—');
    }
    expect(screen.getByTitle('对接人姓名缺失').textContent).toBe('—');
    expect(screen.getByTitle('对接人职务缺失').textContent).toBe('—');
    // 图位保留：中性占位，不生成字母、不加载外部占位图
    expect(screen.getByRole('img', { name: '公司标志缺失' })).toBeTruthy();
    expect(screen.getByRole('img', { name: '对接人头像缺失' })).toBeTruthy();
    // 公司名称缺位也走缺失色（次要文字色），不残留主色墨字
    expect(screen.getByTitle('公司名称缺失').className).toContain(样式.缺失值);
  });

  it('接口缺口说明原样展示（约定句，不新增原因系统）', () => {
    render(<职位资料 信息={全缺信息} 公司详情={禁用导航} />);
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy();
  });

  it('摘要整体缺失（null）时岗位摘要位显示缺失，不编造四事实', () => {
    render(<职位资料 信息={{ ...全缺信息, 摘要: null }} 公司详情={禁用导航} />);
    expect(screen.getByText('岗位摘要缺失')).toBeTruthy();
    expect(screen.queryByText('Kubernetes')).toBeNull();
    expect(screen.queryByText('暂无技能')).toBeNull();
  });

  // review-r1：摘要技能三态 —— null 是未知（不是已知为空）、[] 才是暂无、有值出标签
  it('摘要技能 null 给未知占位，[] 给暂无，二者不互换', () => {
    const { unmount } = render(
      <职位资料
        信息={{ ...有值信息, 摘要: { 职位: '资深后端工程师', 城市: '上海', 薪资: '50-65K', 技能: null } }}
        公司详情={可用导航()}
      />,
    );
    expect(screen.getByText('技能信息未知')).toBeTruthy();
    expect(screen.queryByText('暂无技能')).toBeNull();
    unmount();
    render(
      <职位资料
        信息={{ ...有值信息, 摘要: { 职位: '资深后端工程师', 城市: '上海', 薪资: '50-65K', 技能: [] } }}
        公司详情={可用导航()}
      />,
    );
    expect(screen.getByText('暂无技能')).toBeTruthy();
    expect(screen.queryByText('技能信息未知')).toBeNull();
  });

  it('无合法公司导航坐标：入口真实 disabled、禁用说明可见、点击零回调零导航', () => {
    render(<职位资料 信息={全缺信息} 公司详情={禁用导航} />);
    const 入口 = screen.getByRole('button');
    expect((入口 as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('公司详情暂不可用')).toBeTruthy();
    fireEvent.click(入口);
    expect(document.body.textContent).not.toContain('/company/');
  });
});

describe('职位资料 · 有值与部分缺失', () => {
  it('分析分 0 是合法值：藏环文本总分「0 分」照常渲染，不画假 0 环也不当缺失', () => {
    render(
      <职位资料
        信息={{ ...全缺信息, 分析: { 分数: 0, 解释: null, 有限依据: [], 上下文: '有来源' } }}
        公司详情={禁用导航}
      />,
    );
    expect(document.body.textContent).toContain('0 分');
    expect(screen.queryByRole('img', { name: '适配 0 分' })).toBeNull(); // 藏环：顶栏分是唯一总分
    expect(screen.getByText('暂无该次匹配的详细分析')).toBeTruthy();
  });

  it('展开解释在场：六维行直接展开（有限依据仅解释缺失时出现）；分数 92 文本总分', () => {
    render(<职位资料 信息={有值信息} 公司详情={可用导航()} />);
    expect(screen.getByText('推荐生成时的匹配结果')).toBeTruthy();
    expect(screen.getByText('命中11/12个岗位关键词')).toBeTruthy();
    expect(screen.getByText('技能按关键词命中核对，不代表能力认证。')).toBeTruthy();
    expect(screen.queryByText('匹配分析缺失')).toBeNull();
    expect(screen.queryByText('暂无该次匹配的详细分析')).toBeNull();
  });

  it('聊天空隙（分析藏环=false）：块内画唯一总分环（适配 92 分），无顶栏同屏', () => {
    render(<职位资料 信息={有值信息} 公司详情={可用导航()} 分析藏环={false} />);
    expect(screen.getByRole('img', { name: '适配 92 分' })).toBeTruthy();
    expect(screen.getByText('推荐生成时的匹配结果')).toBeTruthy();
  });

  it('解释显式 null + 有限旧依据：同区标「有限依据」仅列已知原因，不补六条假状态', () => {
    render(
      <职位资料
        信息={{
          ...全缺信息,
          分析: { 分数: 73, 解释: null, 有限依据: ['求职方向与岗位方向匹配'], 上下文: '有来源' },
        }}
        公司详情={禁用导航}
      />,
    );
    expect(screen.getByText('有限依据')).toBeTruthy();
    expect(screen.getByText('求职方向与岗位方向匹配')).toBeTruthy();
    expect(screen.queryByText('推荐生成时的匹配结果')).toBeNull();
  });

  it('部分公司字段缺失：已知部分保留，未知字段显示缺失', () => {
    render(
      <职位资料
        信息={{
          ...有值信息,
          公司: {
            名称: '星尘智能',
            字标: '星',
            简介: null,
            元行: 元行({ 行业: '人工智能' }),
            标签: null,
          },
        }}
        公司详情={可用导航()}
      />,
    );
    expect(screen.getByText('星尘智能')).toBeTruthy();
    expect(screen.getByText('星')).toBeTruthy();
    expect(screen.getByText('公司介绍缺失')).toBeTruthy();
    expect(screen.getByText('公司标签缺失')).toBeTruthy();
    // 已知行业保留，其余四行原位显示缺失
    expect(screen.queryByText('A 轮')).toBeNull();
    expect(screen.getByText('人工智能')).toBeTruthy();
    expect(screen.getByTitle('融资阶段缺失').textContent).toBe('—');
    expect(screen.getByTitle('规模缺失').textContent).toBe('—');
    expect(screen.getByTitle('成立缺失').textContent).toBe('—');
    expect(screen.getByTitle('地址缺失').textContent).toBe('—');
  });

  it('空数组与 null 文案不同：暂无… 不是 …缺失', () => {
    render(
      <职位资料
        信息={{
          ...有值信息,
          职位详情: [],
          职位要求: null,
          摘要: { 职位: '资深后端工程师', 城市: '上海', 薪资: '50-65K', 技能: [] },
          公司: { ...有值信息.公司, 标签: [] },
        }}
        公司详情={可用导航()}
      />,
    );
    expect(screen.getByText('暂无职位详情')).toBeTruthy();
    expect(screen.queryByText('职位详情缺失')).toBeNull();
    expect(screen.getByText('职位要求缺失')).toBeTruthy();
    expect(screen.queryByText('暂无职位要求')).toBeNull();
    expect(screen.getByText('暂无技能')).toBeTruthy();
    expect(screen.getByText('暂无公司标签')).toBeTruthy();
  });

  // S0–S3 展示统一 Task 5（Spec §6.2）：company_intro "" 是已知空，与缺失语义分开
  it('公司简介空串是已知空（暂无公司介绍），null 才是缺失；rerender 在两态间正确切换', () => {
    const 页 = render(
      <职位资料
        信息={{ ...有值信息, 公司: { ...有值信息.公司, 简介: '' } }}
        公司详情={可用导航()}
      />,
    );
    expect(screen.getByText('暂无公司介绍')).toBeTruthy();
    expect(screen.queryByText('公司介绍缺失')).toBeNull();
    页.rerender(
      <职位资料
        信息={{ ...有值信息, 公司: { ...有值信息.公司, 简介: null } }}
        公司详情={可用导航()}
      />,
    );
    expect(screen.getByText('公司介绍缺失')).toBeTruthy();
    expect(screen.queryByText('暂无公司介绍')).toBeNull();
  });

  it('公司导航可用：整块入口可点，点击只执行调用方给的回调', () => {
    const 执行 = vi.fn();
    render(<职位资料 信息={有值信息} 公司详情={可用导航(执行)} />);
    const 入口 = screen.getByRole('button', { name: /星尘智能/ });
    expect((入口 as HTMLButtonElement).disabled).toBe(false);
    expect(入口.className).toContain('可点'); // 可点行统一的按压反馈
    fireEvent.click(入口);
    expect(执行).toHaveBeenCalledTimes(1);
  });
});

describe('职位资料 · 真实媒体图位（Task 6：只填既有图位，沿用 Task 3/4 图片输入模式）', () => {
  const 有媒体信息: 职位资料信息 = {
    ...有值信息,
    公司: {
      ...有值信息.公司,
      字标: null, // 有真实媒体时不用姓名首字冒充
      图片URL: 'https://cdn.example.com/org_1/media_1.png',
      编号: 'org_1',
    },
    对接人: { ...有值信息.对接人, 字标: null, 头像URL: 'https://cdn.example.com/publisher.png' },
  };

  it('Logo/发布人头像在既有图位内渲染 <img>，未提供媒体输入的调用方行为不变', () => {
    render(<职位资料 信息={有媒体信息} 公司详情={可用导航()} />);
    const 图 = document.querySelector('img[src="https://cdn.example.com/org_1/media_1.png"]');
    expect(图).toBeTruthy();
    expect(图!.closest('button')).toBeTruthy(); // 仍在公司头行图位内
    expect(document.querySelector('img[src="https://cdn.example.com/publisher.png"]')).toBeTruthy();
    // 头像字/字标退场：媒体在场不叠加文字首字
    expect(screen.queryByText('星')).toBeNull();
    expect(screen.queryByText('林')).toBeNull();
  });

  it('媒体 URL 为 null：回到既有中性空位（不加载占位图、不生成字母）', () => {
    render(
      <职位资料
        信息={{
          ...有媒体信息,
          公司: { ...有媒体信息.公司, 图片URL: null },
          对接人: { ...有媒体信息.对接人, 头像URL: null },
        }}
        公司详情={可用导航()}
      />,
    );
    expect(screen.getByRole('img', { name: '公司标志缺失' })).toBeTruthy();
    expect(screen.getByRole('img', { name: '对接人头像缺失' })).toBeTruthy();
    expect(document.querySelector('img[src]')).toBeNull();
  });

  it('加载失败回既有回退（公司回缺失空位、头像回空位），换 URL 清失败态', () => {
    const 页 = render(<职位资料 信息={有媒体信息} 公司详情={可用导航()} />);
    const 公司图 = document.querySelector('img[src="https://cdn.example.com/org_1/media_1.png"]')!;
    fireEvent.error(公司图);
    expect(screen.getByRole('img', { name: '公司标志缺失' })).toBeTruthy();
    const 头像图 = document.querySelector('img[src="https://cdn.example.com/publisher.png"]')!;
    fireEvent.error(头像图);
    expect(screen.getByRole('img', { name: '对接人头像缺失' })).toBeTruthy();

    // 换 URL：失败态清零，新图照常渲染
    页.rerender(
      <职位资料
        信息={{
          ...有媒体信息,
          公司: { ...有媒体信息.公司, 图片URL: 'https://cdn.example.com/org_2/logo.png' },
          对接人: { ...有值信息.对接人, 字标: null, 头像URL: 'https://cdn.example.com/p2.png' },
        }}
        公司详情={可用导航()}
      />,
    );
    expect(document.querySelector('img[src="https://cdn.example.com/org_2/logo.png"]')).toBeTruthy();
    expect(document.querySelector('img[src="https://cdn.example.com/p2.png"]')).toBeTruthy();
  });
});

describe('职位资料 · rerender 的缺失过渡（同一已挂载组件）', () => {
  it('有值→合法空值：文字/图位变缺失、导航禁用且旧回调不再执行；空值→有值再次可显示新值', () => {
    const 旧回调 = vi.fn();
    const 页 = render(<职位资料 信息={有值信息} 公司详情={可用导航(旧回调)} />);
    expect(screen.getByText('星尘智能')).toBeTruthy();
    expect(screen.getByText('林一')).toBeTruthy();

    页.rerender(
      <职位资料
        信息={{ ...有值信息, 公司: { ...有值信息.公司, 名称: null, 字标: null }, 对接人: { 姓名: null, 职务: null, 字标: null } }}
        公司详情={禁用导航}
      />,
    );
    expect(screen.queryByText('星尘智能')).toBeNull();
    expect(screen.queryByText('林一')).toBeNull();
    expect(screen.getByTitle('公司名称缺失').textContent).toBe('—');
    expect(screen.getByRole('img', { name: '公司标志缺失' })).toBeTruthy();
    expect(screen.getByTitle('对接人姓名缺失').textContent).toBe('—');
    expect(screen.getByRole('img', { name: '对接人头像缺失' })).toBeTruthy();
    const 入口 = screen.getByRole('button');
    expect((入口 as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(入口);
    expect(旧回调).not.toHaveBeenCalled(); // 旧导航坐标随空值失效

    页.rerender(
      <职位资料
        信息={{
          ...有值信息,
          公司: { ...有值信息.公司, 名称: '新星科技', 字标: '新' },
          对接人: { 姓名: '沈亦舟', 职务: '招聘负责人', 字标: '沈' },
        }}
        公司详情={可用导航()}
      />,
    );
    expect(screen.getByText('新星科技')).toBeTruthy();
    expect(screen.getByText('沈亦舟')).toBeTruthy();
    expect(screen.getByText('新')).toBeTruthy();
    expect((screen.getByRole('button', { name: /新星科技/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});
