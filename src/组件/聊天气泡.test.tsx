// 聊天气泡 公共展示合同的受控契约测试：左右对齐 / 头像槽 / 气泡外下方时间 /
// 正文 text·markdown 两种模式与安全边界。纯内存组件，无需 Provider。
// jsdom 不加载模块 CSS，几何属性（短气泡 fit-content、纯文本换行、我方时间右对齐）
// 按仓库既有做法钉 CSS 源码文本（vitest 以仓库根为 cwd）。

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import 样式 from './聊天气泡.module.css';
import { 聊天正文, 聊天气泡, 格式化聊天时间 } from './聊天气泡';

const cssSource = readFileSync(join(process.cwd(), 'src', '组件', '聊天气泡.module.css'), 'utf8');

describe('聊天正文 · text', () => {
  it('纯文本不解析 Markdown，** 原样显示', () => {
    render(<聊天正文 内容="说**要点**了" 格式="text" />);
    expect(screen.getByText('说**要点**了')).toBeTruthy();
    expect(screen.queryByText('要点', { exact: false })).toBeTruthy(); // 未拆成 strong
  });

  it('普通换行保留为换行，多段不被折成一段', () => {
    const 页 = render(<聊天正文 内容={'第一行\n第二行'} 格式="text" />);
    expect(页.container.textContent).toBe('第一行\n第二行');
  });

  it('text 类名挂纯文本样式（pre-wrap 换行在 CSS 源码钉住）', () => {
    const 页 = render(<聊天正文 内容="一行" 格式="text" />);
    expect(页.container.querySelector(`.${样式.纯文本}`)).toBeTruthy();
    expect(cssSource).toMatch(/\.纯文本[^{]*\{[^}]*white-space:\s*pre-wrap/);
  });
});

describe('聊天正文 · markdown', () => {
  it('渲染 strong / 标题 / 列表 / 分割线', () => {
    const 页 = render(
      <聊天正文
        内容={'### 季度标题\n\n**加粗结论**\n\n- 甲项\n- 乙项\n\n---\n\n收尾一段'}
        格式="markdown"
      />,
    );
    expect(页.container.querySelector('h3')?.textContent).toBe('季度标题');
    expect(页.container.querySelector('strong')?.textContent).toBe('加粗结论');
    expect(页.container.querySelectorAll('li').length).toBe(2);
    expect(screen.getByText('甲项')).toBeTruthy();
    expect(页.container.querySelector('hr')).toBeTruthy();
    expect(screen.getByText('收尾一段')).toBeTruthy();
  });

  it('多个空行分段：两段是两个段落节点，不被折成一段', () => {
    const 页 = render(<聊天正文 内容={'第一段\n\n第二段'} 格式="markdown" />);
    expect(页.container.querySelectorAll('p').length).toBe(2);
    expect(页.container.querySelector('p')?.textContent).toBe('第一段');
  });

  it('原始 HTML 不执行：script 元素不进 DOM，也不碰全局', () => {
    const 页 = render(
      <聊天正文 内容={'之前\n\n<script>window.__聊天气泡注入 = 1</script>\n\n之后'} 格式="markdown" />,
    );
    expect(页.container.querySelector('script')).toBeNull();
    expect((window as unknown as Record<string, unknown>)['__聊天气泡注入']).toBeUndefined();
    expect(screen.getByText('之前')).toBeTruthy();
    expect(screen.getByText('之后')).toBeTruthy();
  });

  it('危险链接不产生可执行 href，安全链接保留正常语义', () => {
    const 页 = render(
      <聊天正文 内容={'[危险](javascript:alert(1)) [安全](https://example.com/a)'} 格式="markdown" />,
    );
    const 链接们 = 页.container.querySelectorAll('a');
    for (const 链接 of 链接们) {
      expect(链接.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
    }
    expect(页.container.querySelector('a[href="https://example.com/a"]')).toBeTruthy();
  });

  it('图片标记仅呈现 alt 文本，不加载外部图片', () => {
    const 页 = render(
      <聊天正文 内容={'![替代文字](https://example.com/x.png)'} 格式="markdown" />,
    );
    expect(页.container.querySelector('img')).toBeNull();
    expect(screen.getByText('替代文字')).toBeTruthy();
  });

  it('行内代码与代码块渲染为 code/pre，不依赖 HTML', () => {
    const 页 = render(
      <聊天正文 内容={'行内 `x=1` 代码\n\n```\n块内代码\n```'} 格式="markdown" />,
    );
    expect(页.container.querySelectorAll('code').length).toBe(2);
    expect(页.container.querySelector('pre')).toBeTruthy();
  });
});

describe('聊天气泡', () => {
  it('对方头像在气泡前、我方头像在气泡后（DOM 顺序即视觉顺序）', () => {
    const 对方页 = render(
      <聊天气泡 方="对方" 头像={<b data-testid="头像">左</b>}>
        内容
      </聊天气泡>,
    );
    const 对方序 = 对方页.container.querySelector('[data-testid="头像"]')!.compareDocumentPosition(
      对方页.container.querySelector(`.${样式.气泡}`)!,
    );
    expect(对方序 & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // 头像在前

    const 我方页 = render(
      <聊天气泡 方="我方" 头像={<b data-testid="头像">右</b>}>
        内容
      </聊天气泡>,
    );
    const 我方序 = 我方页.container.querySelector('[data-testid="头像"]')!.compareDocumentPosition(
      我方页.container.querySelector(`.${样式.气泡}`)!,
    );
    expect(我方序 & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy(); // 头像在后
  });

  it('无时间不产生空时间节点（省略 / null / 空串 / 无效串）', () => {
    for (const 时间 of [undefined, null, '', '不是时间']) {
      const 页 = render(
        <聊天气泡 方="对方" 头像={<i>头像</i>} 时间={时间}>
          内容
        </聊天气泡>,
      );
      expect(页.container.querySelector('time')).toBeNull();
    }
  });

  it('合法时间：dateTime 保留原串，显示文本与 格式化聊天时间 一致', () => {
    const 原串 = '2026-09-16T09:07:33.348845Z';
    const 页 = render(
      <聊天气泡 方="对方" 头像={<i>头像</i>} 时间={原串}>
        内容
      </聊天气泡>,
    );
    const 时间节点 = 页.container.querySelector('time');
    expect(时间节点?.getAttribute('datetime')).toBe(原串);
    // 显示文本与纯函数同源（跨年口径由 聊天时间 describe 显式钉住，不依赖机器当前年）
    expect(时间节点?.textContent).toBe(格式化聊天时间(原串));
    // 时间节点在气泡外下方（列内兄弟、气泡之后）
    expect(时间节点?.parentElement?.querySelector(`.${样式.气泡}`)).toBeTruthy();
  });

  it('宽内容与自定义类名挂到对应元素，默认不挂宽内容', () => {
    const 页 = render(
      <聊天气泡 方="对方" 头像={<i>头像</i>}>
        内容
      </聊天气泡>,
    );
    expect(页.container.querySelector(`.${样式.气泡}`)!.className).not.toContain(样式.宽内容);

    const 宽页 = render(
      <聊天气泡 方="对方" 头像={<i>头像</i>} 宽内容 类名="自定义行" 气泡类名="自定义泡">
        内容
      </聊天气泡>,
    );
    expect(宽页.container.firstChild).toBeTruthy();
    expect((宽页.container.firstChild as HTMLElement).className).toContain('自定义行');
    expect(宽页.container.querySelector(`.${样式.气泡}`)!.className).toContain(样式.宽内容);
    expect(宽页.container.querySelector(`.${样式.气泡}`)!.className).toContain('自定义泡');
  });

  it('CSS 几何：短气泡 fit-content 不 grow、时间列不拉伸气泡、我方时间右对齐', () => {
    // 气泡按内容宽度收缩（不因时间列或剩余空间铺满）
    expect(cssSource).toMatch(/\.气泡\s*\{[^}]*width:\s*fit-content/);
    // 长文上限内换行、无空格长串不撑破
    expect(cssSource).toMatch(/\.气泡\s*\{[^}]*max-width:\s*100%/);
    expect(cssSource).toMatch(/\.气泡\s*\{[^}]*min-width:\s*0/);
    expect(cssSource).toMatch(/\.气泡\s*\{[^}]*overflow-wrap:\s*anywhere/);
    // 时间住在气泡列里、列是纵向 flex，不强迫气泡横向拉伸
    expect(cssSource).toMatch(/\.气泡列\s*\{[^}]*flex-direction:\s*column/);
    expect(cssSource).toMatch(/\.气泡列\s*\{[^}]*min-width:\s*0/);
    // 我方列右对齐（时间落在气泡外下方右侧）
    expect(cssSource).toMatch(/\.我方 \.气泡列\s*\{[^}]*align-items:\s*flex-end/);
    // 宽内容显式伸展回整列
    expect(cssSource).toMatch(/\.宽内容\s*\{[^}]*align-self:\s*stretch/);
  });
});

describe('聊天时间', () => {
  it('本地 17:07 构造的输入在本地时区显示 09-16 17:07（显式当前年 2026）', () => {
    const 输入 = new Date(2026, 8, 16, 17, 7).toISOString();
    expect(格式化聊天时间(输入, 2026)).toBe('09-16 17:07');
  });

  it('跨年消息带年份（YYYY-MM-DD HH:mm）', () => {
    const 旧输入 = new Date(2025, 0, 2, 9, 5).toISOString();
    expect(格式化聊天时间(旧输入, 2026)).toBe('2025-01-02 09:05');
  });

  it('月/日/时/分补零', () => {
    const 补零输入 = new Date(2026, 3, 5, 8, 3).toISOString();
    expect(格式化聊天时间(补零输入, 2026)).toBe('04-05 08:03');
  });

  it('无效时间只返回空字符串，不生成当前时间', () => {
    expect(格式化聊天时间('不是时间', 2026)).toBe('');
    expect(格式化聊天时间('', 2026)).toBe('');
  });
});
