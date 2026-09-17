// 真人在线简历正文 · 招聘聊天纸身（Spec §4，Task 4）反例优先：
//   · 纯展示：组件文件不 import 应用状态、不 import Mock 数据（源码合同）；
//   · 手机/邮箱恒「—」：组件没有联系方式输入，真实联系方式在结构上进不来；
//   · 区段 null = 「暂未提供」、合法 [] = 「暂无」，二者不互换；
//   · 缺公司不从描述反推：公司槽缺省只省公司名，描述原样；
//   · 工作日期右对齐（jsdom 不做版式 → CSS 源码合同）；
//   · 经历按源顺序渲染。

import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { 真人在线简历正文 } from './真人在线简历正文';
import type { 真人工作经历段 } from './真人在线简历正文';

/** 组件源码（不读应用状态 / 不 import Mock 数据的源码合同）。 */
const 组件源码 = readFileSync(join(process.cwd(), 'src', '组件', '真人在线简历正文.tsx'), 'utf8');
/** 纸身样式（日期右对齐的源码合同）。 */
const 纸身css源码 = readFileSync(join(process.cwd(), 'src', '组件', '简历预览层.module.css'), 'utf8');

function 经历段(覆盖: Partial<真人工作经历段> = {}): 真人工作经历段 {
  return { 公司: '连连支付', 职位: '高级风控算法工程师', 起止: '2020.06 — 至今', 描述: '建设实时特征平台', ...覆盖 };
}

describe('真人在线简历正文 · 布局（Spec §4 截图）', () => {
  it('按顺序渲染：姓名 → 职位·年限 → 手机/邮箱「—」→ 工作经历 → 教育经历 → 个人优势', () => {
    const 页 = render(
      <真人在线简历正文
        姓名="林若衡"
        最近职位="高级风控算法工程师"
        经验年限="6 年经验"
        工作经历={[经历段()]}
        教育经历={[{ 学校: '中山大学', 学历专业: '应用统计硕士', 起止: '2017 — 2020' }]}
        个人优势={'负责实时风控特征工程\n熟悉支付场景实时决策链路'}
      />,
    );
    expect(screen.getByText('林若衡')).toBeTruthy();
    expect(screen.getByText('高级风控算法工程师 · 6 年经验')).toBeTruthy();
    expect(screen.getByText('手机：—')).toBeTruthy();
    expect(screen.getByText('邮箱：—')).toBeTruthy();
    expect(screen.getByText('连连支付')).toBeTruthy();
    expect(screen.getByText('2020.06 — 至今')).toBeTruthy();
    expect(screen.getByText('中山大学')).toBeTruthy();
    expect(screen.getByText('应用统计硕士')).toBeTruthy();
    // 区段顺序（DOM 位置断言，不靠查询顺序）
    const 姓名标 = screen.getByText('林若衡');
    const 工作标 = screen.getByText('工作经历');
    const 教育标 = screen.getByText('教育经历');
    const 优势标 = screen.getByText('个人优势');
    expect(姓名标.compareDocumentPosition(工作标) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(工作标.compareDocumentPosition(教育标) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(教育标.compareDocumentPosition(优势标) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 职位/描述在公司下方；优势按行拆条
    expect(screen.getByText('建设实时特征平台')).toBeTruthy();
    expect(页.container.querySelectorAll('li')).toHaveLength(2);
  });

  it('抬头行缺一部分只显示另一部分；两缺则整行不出', () => {
    const 页 = render(
      <真人在线简历正文
        姓名="陈屿"
        最近职位={null}
        经验年限="3 年经验"
        工作经历={[]}
        教育经历={[]}
        个人优势=""
      />,
    );
    expect(screen.getByText('3 年经验')).toBeTruthy();
    页.unmount();
    render(
      <真人在线简历正文
        姓名="陈屿"
        最近职位={null}
        经验年限={null}
        工作经历={[]}
        教育经历={[]}
        个人优势=""
      />,
    );
    // 抬头只剩姓名与联系方式占位
    expect(screen.queryByText(/年经验/)).toBeNull();
    expect(screen.getByText('手机：—')).toBeTruthy();
  });
});

describe('真人在线简历正文 · 缺失口径（null ≠ []）', () => {
  it('区段 null 显示「暂未提供」、合法 [] 显示「暂无」，同一屏二者并存不互换', () => {
    render(
      <真人在线简历正文
        姓名="陈屿"
        最近职位={null}
        经验年限={null}
        工作经历={null}
        教育经历={[]}
        个人优势={null}
      />,
    );
    expect(screen.getByText('工作经历').nextElementSibling?.textContent).toBe('暂未提供');
    expect(screen.getByText('教育经历').nextElementSibling?.textContent).toBe('暂无');
    expect(screen.getByText('个人优势').nextElementSibling?.textContent).toBe('暂未提供');
  });

  it('个人优势空白串是合法空（「暂无」），不是「暂未提供」', () => {
    render(
      <真人在线简历正文
        姓名="陈屿"
        最近职位={null}
        经验年限={null}
        工作经历={[]}
        教育经历={[]}
        个人优势={'   \n  '}
      />,
    );
    expect(screen.getByText('个人优势').nextElementSibling?.textContent).toBe('暂无');
  });
});

describe('真人在线简历正文 · 联系方式与公司槽', () => {
  it('手机/邮箱恒「—」：组件没有联系方式输入，Mock/真实联系人都进不来', () => {
    render(
      <真人在线简历正文
        姓名="沈亦舟"
        最近职位={null}
        经验年限={null}
        工作经历={[]}
        教育经历={[]}
        个人优势={null}
      />,
    );
    expect(screen.getByText('手机：—')).toBeTruthy();
    expect(screen.getByText('邮箱：—')).toBeTruthy();
    // 源码合同：组件文件不 import Mock 演示数据、不读取应用状态
    expect(组件源码).not.toContain('模拟数据');
    expect(组件源码).not.toContain('use应用状态');
  });

  it('缺公司不从描述反推：公司槽缺省只省公司名，日期仍右对齐落位、描述原样', () => {
    render(
      <真人在线简历正文
        姓名="陈屿"
        最近职位={null}
        经验年限={null}
        工作经历={[经历段({ 公司: null, 描述: '负责网关重建（公司名不从这里反推）' })]}
        教育经历={[]}
        个人优势={null}
      />,
    );
    expect(screen.queryByText('公司名不从这里反推')).toBeNull();
    expect(screen.getByText('负责网关重建（公司名不从这里反推）')).toBeTruthy();
    // 经历头只剩日期本身：公司槽不渲染、也不用描述补位
    const 头 = screen.getByText('2020.06 — 至今').parentElement;
    expect(头?.textContent).toBe('2020.06 — 至今');
  });
});

describe('真人在线简历正文 · 展示合同', () => {
  it('经历按源顺序渲染，描述多行原样保留', () => {
    const 页 = render(
      <真人在线简历正文
        姓名="陈屿"
        最近职位={null}
        经验年限={null}
        工作经历={[
          经历段({ 公司: '字节跳动', 职位: '研发专家 · 交易中台' }),
          经历段({ 公司: '美团', 起止: '2017.07 — 2019.05', 职位: '后端开发工程师', 描述: '订单状态机\n超时补偿' }),
        ]}
        教育经历={[]}
        个人优势={null}
      />,
    );
    const 先 = screen.getByText('字节跳动');
    const 后 = screen.getByText('美团');
    expect(先.compareDocumentPosition(后) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('订单状态机')).toBeTruthy();
    expect(screen.getByText('超时补偿')).toBeTruthy();
    页.unmount();
  });

  it('日期右对齐：经历公司槽弹性占位、时间右贴（CSS 源码合同）', () => {
    expect(纸身css源码).toMatch(/\.经历公司 \{\s*flex: 1;/);
    expect(纸身css源码).toMatch(/\.经历时间 \{[^}]*flex: none;[^}]*margin-left: auto;/);
  });
});
