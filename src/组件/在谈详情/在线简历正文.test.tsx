// 在线简历正文（详情统一 Task 4）：招聘端详情第二 Tab（资料）与独立匿名简历页共用的
// 唯一正文。覆盖两档行为：
//   · 默认兼容（不传 完整布局 = 独立页旧行为）：空项目不留标题、匹配依据缺行整区不渲染；
//   · 完整布局=true（详情显式选择）：spec §3.4 的九个信息区一个不缺；档 null 时各区
//     在同一组 JSX 里原位显示缺失（不顶层换成另一整页、不以一句「简历尚未同步」替代
//     整页），且不出现假薪资一致性、姓名、年龄与旧人像。
// 仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { 在线简历正文 } from './在线简历正文';
import { 匿名简历表 } from '../../数据/企业端模拟数据';
import type { 对齐行 } from '../../数据/匹配对齐';
import type { 在线简历展示资料 } from './类型';

// A-01：项目/经历/技能齐备；A-02：项目为空（空态用例）。测试不是展示层，可以读夹具表。
const 档A01 = 匿名简历表['A-01'];
const 档A02 = 匿名简历表['A-02'];

const 对齐行样本: 对齐行[] = [
  { 要求: 'Go 主栈', 证据: '字节跳动 · 交易中台 · Go · 9 年', 态: '有证据', 类: '必须' },
  { 要求: '带过团队', 证据: null, 态: '未提及', 类: '必须' },
];

/** 断言 文们 按 spec §3.4 的阅读顺序出现在同一正文根节点里 */
function 断言顺序(正文: Element, 文们: readonly string[]): void {
  const 全文 = 正文.textContent ?? '';
  let 上一位 = -1;
  for (const 文 of 文们) {
    const 位 = 全文.indexOf(文);
    if (位 < 0) throw new Error(`正文里没有「${文}」`);
    expect(位).toBeGreaterThan(上一位);
    上一位 = 位;
  }
}

describe('在线简历正文 · 默认兼容（独立简历页，不传 完整布局）', () => {
  it('A-01 全部信息区按 spec §3.4 顺序在场：画像/职位行 → 匹配依据 → 个人优势 → 期望 → 工作 → 项目 → 教育 → 技能 → 页尾', () => {
    const { container } = render(
      <在线简历正文 档={档A01} 对齐行们={对齐行样本} 求职状态="在职看机会" />,
    );
    const 正文 = container.firstElementChild;
    if (!(正文 instanceof HTMLElement)) throw new Error('正文根节点缺失');
    expect(正文.className).toContain('页体');
    expect(screen.getByText('交易中台研发专家 · 现任字节跳动')).toBeTruthy();
    expect(screen.getByText('匹配度分析')).toBeTruthy();
    expect(screen.getByText('Go 主栈')).toBeTruthy();
    expect(screen.getByText(档A01.自述)).toBeTruthy();
    expect(screen.getByText('交易 / 支付后端，上海')).toBeTruthy();
    expect(screen.getByText('薪资带已进入初筛')).toBeTruthy(); // 薪资结论默认值（旧口径不变）
    expect(screen.getByText(档A01.期望.一致性)).toBeTruthy();
    expect(screen.getByText('字节跳动')).toBeTruthy();
    expect(screen.getByText('交易中台 0→1 重建 · 主导')).toBeTruthy();
    expect(screen.getByText('上海交通大学 · 计算机硕士')).toBeTruthy();
    expect(screen.getByText('Go')).toBeTruthy();
    expect(screen.getByText(/内容真实性经双向核验/)).toBeTruthy();
    断言顺序(正文, [
      '交易中台研发专家',
      '匹配度分析',
      '个人优势',
      '求职期望',
      '工作经历',
      '项目经历',
      '教育经历',
      '专业技能',
      '不可转发',
    ]);
  });

  it('空项目不保留标题（旧版式整区不出）；匹配依据缺行也整区不渲染；无缺失占位', () => {
    render(<在线简历正文 档={档A02} />);
    expect(screen.queryByText('项目经历')).toBeNull();
    expect(screen.queryByText('暂无项目经历')).toBeNull();
    expect(screen.queryByText('匹配度分析')).toBeNull();
    expect(screen.queryByText('当前在谈详情数据未提供')).toBeNull();
    expect(document.body.textContent).not.toContain('缺失');
  });

  it('真名非空（S1）不显示姓名 / 年龄 / 旧人像与代号；性别图标 + 年限｜学历（既有身份契约不变）', () => {
    render(<在线简历正文 档={档A01} 真名="沈亦舟" />);
    expect(screen.queryByText('沈亦舟')).toBeNull();
    expect(screen.queryByText(档A01.代号)).toBeNull();
    expect(screen.queryByText(档A01.年龄)).toBeNull();
    expect(document.querySelector('[class*="人像占位"]')).toBeNull();
    expect(document.querySelector('[class*="大代号"]')).toBeNull();
    expect(screen.getByRole('img', { name: '男' })).toBeTruthy();
  });
});

describe('在线简历正文 · 完整布局=true（详情第二 Tab 显式选择）', () => {
  it('档齐备：九个信息区一个不缺；空项目保留标题与空状态（「暂无项目经历」）', () => {
    const { container } = render(
      <在线简历正文 档={档A02} 完整布局 对齐行们={对齐行样本} />,
    );
    const 正文 = container.firstElementChild;
    if (!(正文 instanceof HTMLElement)) throw new Error('正文根节点缺失');
    expect(screen.getByText('项目经历')).toBeTruthy();
    expect(screen.getByText('暂无项目经历')).toBeTruthy();
    expect(screen.getByText('匹配度分析')).toBeTruthy();
    expect(screen.getByText('个人优势')).toBeTruthy();
    expect(screen.getByText('求职期望')).toBeTruthy();
    expect(screen.getByText('工作经历')).toBeTruthy();
    expect(screen.getByText('教育经历')).toBeTruthy();
    expect(screen.getByText('专业技能')).toBeTruthy();
    expect(screen.getByText(/内容真实性经双向核验/)).toBeTruthy();
    断言顺序(正文, [
      '匹配度分析',
      '个人优势',
      '求职期望',
      '工作经历',
      '项目经历',
      '教育经历',
      '专业技能',
    ]);
  });

  it('档 null：九区标题原位保留并逐区显示缺失，全部在同一根节点里（不另起一页）', () => {
    const { container } = render(
      <在线简历正文 档={null} 完整布局 缺失说明="当前在谈详情数据未提供" />,
    );
    // 同一组 JSX：整页只有正文这一个根节点，区块全在它里面
    expect(container.childElementCount).toBe(1);
    const 正文 = container.firstElementChild;
    if (!(正文 instanceof HTMLElement)) throw new Error('正文根节点缺失');
    expect(screen.getByText('当前在谈详情数据未提供')).toBeTruthy();
    const 标题们 = [
      '匹配度分析', '个人优势', '求职期望', '工作经历', '项目经历', '教育经历', '专业技能',
    ] as const;
    for (const 标题 of 标题们) expect(screen.getByText(标题)).toBeTruthy();
    const 缺失们 = [
      '匿名画像缺失', '职位信息缺失', '匹配分析缺失', '个人优势缺失', '求职期望缺失',
      '工作经历缺失', '项目经历缺失', '教育经历缺失', '专业技能缺失',
    ] as const;
    for (const 缺失 of 缺失们) expect(screen.getByText(缺失)).toBeTruthy();
    expect(screen.getByText(/在线简历缺失 · 内容不可转发/)).toBeTruthy();
    断言顺序(正文, [...标题们, '在线简历缺失']);
  });

  it('档 null 不给无依据承诺与身份信息：无假薪资结论、无一致性 ✓、无姓名 / 年龄 / 人像 / 匹配分', () => {
    render(<在线简历正文 档={null} 完整布局 />);
    expect(screen.queryByText('薪资带已进入初筛')).toBeNull();
    expect(screen.queryByText('✓')).toBeNull();
    expect(screen.queryByText('沈亦舟')).toBeNull();
    expect(document.body.textContent).not.toContain('岁');
    expect(document.body.textContent).not.toContain('适配分'); // 缺失不填 0 分也不给任何分
    expect(document.querySelector('[class*="人像占位"]')).toBeNull();
    expect(document.querySelector('[class*="大代号"]')).toBeNull();
  });
});

// Backend 共享正文的展示资料样本（结构与 在线简历展示映射 的产出一致）；
// 测试不 import 映射 —— 组件契约只看 资料 形状本身。
const 资料齐备: 在线简历展示资料 = {
  画像: { 性别: '女', 年限: '5 年', 学历: '本科', 求职状态: '在职看机会', 职位行: '示例公司 · 软件工程师' },
  个人优势: '四年全栈经验',
  期望: { 标题: '社招全职 · 产品经理', 薪资关系: '薪资带有交集', 副行: '上海 · 混合 · 全远程' },
  工作: [{ 公司: '云衢', 起止: '2021.01—至今', 职位: '工程师', 说明: '平台研发\n第二行' }],
  项目: [{ 名称: '推荐引擎', 角色: '负责人', 结果: '转化提升 12%' }],
  教育: [
    { 行: '复旦大学 · 计算机科学 · 本科', 起止: '2017.09—2021.06' },
    { 行: '复旦大学 · 计算机科学 · 本科', 起止: '2017.09—2021.06' },
  ],
  技能: ['TypeScript', 'React'],
};

describe('在线简历正文 · 资料模式（Backend 显式传 资料，档 恒 null）', () => {
  it('资料齐备：各信息区按原槽渲染；教育两条都出（重复条目不丢）；无匹配分析区（无证据不生成行）', () => {
    const { container } = render(<在线简历正文 档={null} 资料={资料齐备} 求职状态="在职" />);
    const 正文 = container.firstElementChild;
    if (!(正文 instanceof HTMLElement)) throw new Error('正文根节点缺失');
    expect(screen.getByText('示例公司 · 软件工程师')).toBeTruthy(); // 最近工作组合职位行
    expect(screen.getByText('四年全栈经验')).toBeTruthy();
    expect(screen.getByText('社招全职 · 产品经理')).toBeTruthy();
    expect(screen.getByText('薪资带有交集')).toBeTruthy();
    expect(screen.getByText('上海 · 混合 · 全远程')).toBeTruthy();
    expect(screen.getByText('云衢')).toBeTruthy();
    expect(screen.getByText('2021.01—至今')).toBeTruthy();
    expect(screen.getByText('工程师')).toBeTruthy();
    expect(screen.getByText('平台研发')).toBeTruthy();
    expect(screen.getByText('第二行')).toBeTruthy();
    expect(screen.getByText('推荐引擎')).toBeTruthy();
    expect(screen.getByText('负责人')).toBeTruthy();
    expect(screen.getByText('转化提升 12%')).toBeTruthy();
    expect(screen.getByText('TypeScript')).toBeTruthy();
    // 教育两条同文同起止：都渲染，不因 key 重复丢条
    expect(container.querySelectorAll('[class*="教育行"]').length).toBe(2);
    // 头行求职状态按约束取资料摘要事实（闭表更全）；显式 prop 只在摘要缺失时回退
    expect(screen.getByText('在职看机会')).toBeTruthy();
    expect(screen.queryByText('匹配度分析')).toBeNull(); // 无对齐行就不生成匹配区
    断言顺序(正文, [
      '示例公司 · 软件工程师', '个人优势', '求职期望', '工作经历', '项目经历', '教育经历', '专业技能',
    ]);
  });

  it('项目不借工作日期充项目日期：资料项目无起止槽；工作公司缺失给中性标记，不借行业伪装', () => {
    render(
      <在线简历正文
        档={null}
        资料={{
          ...资料齐备,
          工作: [{ 公司: '未披露', 起止: '日期未知', 职位: null, 说明: null }],
          项目: [{ 名称: '推荐引擎', 角色: null, 结果: null }],
        }}
      />,
    );
    expect(screen.getByText('未披露')).toBeTruthy();
    expect(screen.getByText('日期未知')).toBeTruthy();
    expect(screen.queryByText('2021.01—至今')).toBeNull();
    expect(screen.queryByText('工程师')).toBeNull();
    expect(screen.queryByText('负责人')).toBeNull();
  });

  it('区级语义分界：null 给缺失、[] 给暂无（不互换），缺失走既有缺失样式', () => {
    const { container } = render(
      <在线简历正文
        档={null}
        资料={{
          画像: null,
          个人优势: null,
          期望: null,
          工作: null,
          项目: null,
          教育: null,
          技能: null,
        }}
      />,
    );
    for (const 缺失 of ['匿名画像缺失', '职位信息缺失', '个人优势缺失', '求职期望缺失', '工作经历缺失', '项目经历缺失', '教育经历缺失', '专业技能缺失']) {
      expect(screen.getByText(缺失)).toBeTruthy();
    }
    expect(screen.queryByText('暂无项目经历')).toBeNull(); // 项目区本例是 null → 缺失，不是暂无
    expect(container.querySelector('[class*="区块缺失"]')).not.toBeNull();
  });

  it('合法 [] 给无条目状态；项目/技能空数组出「暂无…」而不是缺失', () => {
    render(
      <在线简历正文
        档={null}
        资料={{ ...资料齐备, 画像: null, 个人优势: null, 期望: null, 工作: [], 项目: [], 教育: [], 技能: [] }}
      />,
    );
    for (const 暂无 of ['暂无工作经历', '暂无项目经历', '暂无教育经历', '暂无专业技能']) {
      expect(screen.getByText(暂无)).toBeTruthy();
    }
    expect(screen.queryByText('工作经历缺失')).toBeNull();
  });

  it('摘要带求职状态时取摘要事实，调用方文案不覆盖', () => {
    const 画像 = 资料齐备.画像;
    if (画像 === null) throw new Error('样本画像缺失');
    render(<在线简历正文 档={null} 资料={资料齐备} 求职状态="在职" />);
    expect(screen.getByText('在职看机会')).toBeTruthy();
    expect(screen.queryByText('在职')).toBeNull();
  });

  it('摘要求职状态缺失时才回退调用方文案', () => {
    const 画像 = 资料齐备.画像;
    if (画像 === null) throw new Error('样本画像缺失');
    render(
      <在线简历正文
        档={null}
        资料={{ ...资料齐备, 画像: { ...画像, 求职状态: null } }}
        求职状态="在职"
      />,
    );
    expect(screen.getByText('在职')).toBeTruthy();
  });

  it('资料 null（整份缺源档）与档 null 同构：全部缺失 + 在线简历缺失页尾注', () => {
    render(<在线简历正文 档={null} 资料={null} />);
    expect(screen.getByText('匿名画像缺失')).toBeTruthy();
    expect(screen.getByText('个人优势缺失')).toBeTruthy();
    expect(screen.getByText(/在线简历缺失 · 内容不可转发/)).toBeTruthy();
  });

  it('不给无依据承诺：无一致性 ✓、无默认薪资结论；页尾注不宣称双向核验 / 已核验', () => {
    render(<在线简历正文 档={null} 资料={资料齐备} />);
    expect(screen.queryByText('✓')).toBeNull();
    expect(screen.queryByText('薪资带已进入初筛')).toBeNull();
    expect(screen.queryByText(/双向核验/)).toBeNull();
    expect(document.body.textContent).toContain('内容不可转发');
  });

  it('unknown 薪资关系不作结论：期望标题在、薪资槽整段不出', () => {
    render(
      <在线简历正文
        档={null}
        资料={{ ...资料齐备, 期望: { 标题: '社招全职 · 产品经理', 薪资关系: null, 副行: '上海' } }}
      />,
    );
    expect(screen.getByText('社招全职 · 产品经理')).toBeTruthy();
    expect(screen.queryByText(/薪资带/)).toBeNull();
  });

  it('自由文本以文本节点展示：HTML 样式字符不解释成元素', () => {
    render(
      <在线简历正文
        档={null}
        资料={{
          ...资料齐备,
          个人优势: '<b>主导交易网关重建</b><script>x</script>',
          技能: ['<i>Go</i>'],
        }}
      />,
    );
    expect(document.querySelector('b')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('i')).toBeNull();
    expect(document.body.textContent).toContain('<b>主导交易网关重建</b><script>x</script>');
    expect(screen.getByText('<i>Go</i>')).toBeTruthy();
  });

  it('真名不透传旧真名恢复：资料模式即使传了 真名 也不还原公司实名、不显示姓名', () => {
    render(<在线简历正文 档={null} 资料={资料齐备} 真名="沈亦舟" />);
    expect(screen.queryByText('沈亦舟')).toBeNull();
    expect(screen.getByText('云衢')).toBeTruthy(); // 资料的公司槽原样，不走 已披露 ? 公司实名
    expect(screen.queryByText(/S1 原件披露/)).toBeNull();
  });
});
