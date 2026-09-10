// 详情外壳 · 无 Provider 展示测试：外壳只吃 顶栏信息 + 槽位（不读 Context/fixture、
// 不走路由、不派发业务动作）。钉住本 Task 的共用版式契约：
//   · 两端各两个 Tab（第一 Tab 恒「代谈进度」，第二 Tab 求职端「职位详情」/招聘端
//     「在线简历」—— spec §1/§3.1 产品名，Tab 键仍 进度/资料），点击只回调 切Tab，
//     进度/资料 槽唯一挂载；
//   · 招聘端顶栏不显示 alias/姓名，画像缺段仍占位、性别位给中性未知标记；
//   · 真实分数 0 保留、缺失显示「—」并带可访问的缺失说明，右侧永不出现 NaN；
//   · 真实低分沿用既有警示色，缺失不画警示。
// 仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { 详情外壳 } from './详情外壳';
import 样式 from './详情外壳.module.css';
import type { 顶栏信息 } from './类型';

const 求职顶栏: 顶栏信息 = {
  端: '求职',
  标题: '高级前端工程师 · 豆瓣',
  副标题: '豆瓣 · 全栈 · 大厂',
  画像: null,
  右侧: { kind: '分数', 值: 87 },
  岗位上下文: null,
};

/** 招聘端 Backend 形态：没有画像结构化字段，标题位只剩去名后不渲染的别名。 */
const 招聘顶栏: 顶栏信息 = {
  端: '招聘',
  标题: 'candidate-0123456789ab',
  副标题: null,
  画像: { 性别: null, 年限: null, 学历: null, 求职状态: null },
  右侧: { kind: '分数', 值: 0 },
  岗位上下文: '平台工程师 · 上海 · 25-40K·16薪',
};

function 外壳节点(信息: 顶栏信息, 当前Tab: '进度' | '资料' = '进度', 切Tab = vi.fn()) {
  return (
    <详情外壳
      信息={信息}
      返回={vi.fn()}
      当前Tab={当前Tab}
      切Tab={切Tab}
      进度={<div>进度内容标记</div>}
      资料={<div>资料内容标记</div>}
      底栏={<div>底栏标记</div>}
      弹层={<div>弹层标记</div>}
    />
  );
}

describe('详情外壳 · 两个 Tab 与槽位', () => {
  it('求职端：顶栏标题/副标题/适配分在场，进度与资料两个 Tab 可点，进度槽唯一挂载', () => {
    const 返回 = vi.fn();
    render(
      <详情外壳
        信息={求职顶栏}
        返回={返回}
        当前Tab="进度"
        切Tab={vi.fn()}
        进度={<div>进度内容标记</div>}
        资料={<div>资料内容标记</div>}
        底栏={<div>底栏标记</div>}
        弹层={<div>弹层标记</div>}
      />,
    );
    expect(screen.getByText('高级前端工程师 · 豆瓣')).toBeTruthy();
    expect(screen.getByText('豆瓣 · 全栈 · 大厂')).toBeTruthy();
    expect(screen.getByText('适配')).toBeTruthy();
    expect(screen.getByText('87')).toBeTruthy();
    expect(screen.getByRole('button', { name: '代谈进度' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '职位详情' })).toBeTruthy();
    expect(screen.getByText('进度内容标记')).toBeTruthy();
    expect(screen.queryByText('资料内容标记')).toBeNull();
    expect(screen.getByText('底栏标记')).toBeTruthy();
    expect(screen.getByText('弹层标记')).toBeTruthy();
    expect(返回).not.toHaveBeenCalled();
  });

  it('招聘端：alias/姓名不进顶栏，画像缺段占位 + 中性未知性别标记，岗位上下文单独可读', () => {
    render(外壳节点(招聘顶栏));
    // 去名裁定：candidateAlias 不解析、不渲染（标题位只留画像行）
    expect(screen.queryByText('candidate-0123456789ab')).toBeNull();
    // 位置保留：缺失的三段说缺失，不隐藏、不编值
    expect(screen.getByText('经验缺失')).toBeTruthy();
    expect(screen.getByText('学历缺失')).toBeTruthy();
    expect(screen.getByText('求职状态缺失')).toBeTruthy();
    expect(screen.getByRole('img', { name: '性别未知' })).toBeTruthy();
    expect(screen.getByText('匹配')).toBeTruthy();
    expect(screen.getByText('平台工程师 · 上海 · 25-40K·16薪')).toBeTruthy();
    // 第二 Tab 按端投影：招聘端给「在线简历」
    expect(screen.getByRole('button', { name: '代谈进度' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '在线简历' })).toBeTruthy();
  });

  it('点 Tab 只回调 切Tab（返回零调用、零路由），切到资料后进度槽卸载（唯一挂载）', async () => {
    const user = userEvent.setup();
    const 切Tab = vi.fn();
    const 页 = render(外壳节点(求职顶栏, '进度', 切Tab));
    await user.click(screen.getByRole('button', { name: '职位详情' }));
    expect(切Tab).toHaveBeenCalledTimes(1);
    expect(切Tab).toHaveBeenCalledWith('资料');
    // 受控组件：当前Tab 未变时槽位不动
    expect(screen.getByText('进度内容标记')).toBeTruthy();
    页.rerender(外壳节点(求职顶栏, '资料', 切Tab));
    expect(screen.queryByText('进度内容标记')).toBeNull();
    expect(screen.getByText('资料内容标记')).toBeTruthy();
  });
});

describe('详情外壳 · 顶栏右侧分数与薪资', () => {
  it('真实分数 0 保留（不显示成缺失），低分沿用既有警示色；缺失给「—」且不画警示', () => {
    // 0 是合法分数，照常渲染；0 < 80 走 Mock 既有的低分警示（缺失才不画警示）
    const 零分 = render(外壳节点(招聘顶栏));
    expect(零分.getByText('0').className).toContain(样式.分数警示);
    零分.unmount();

    const 缺失 = render(外壳节点({ ...求职顶栏, 右侧: { kind: '分数', 值: null } }));
    expect(缺失.getByText('—').className).not.toContain(样式.分数警示);
  });

  it('分数缺失显示「—」并带「匹配分缺失」可访问说明；全程无 NaN', () => {
    render(外壳节点({ ...求职顶栏, 右侧: { kind: '分数', 值: null } }));
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByTitle('匹配分缺失')).toBeTruthy();
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('薪资槽：有值原样展示，不占用分数位', () => {
    render(外壳节点({ ...求职顶栏, 右侧: { kind: '薪资', 值: '25-40K·16薪' } }));
    expect(screen.getByText('25-40K·16薪')).toBeTruthy();
    expect(screen.queryByText('适配')).toBeNull();
    expect(screen.queryByText('匹配')).toBeNull();
  });

  it('岗位上下文只在有值时渲染', () => {
    render(外壳节点(求职顶栏));
    expect(screen.queryByText('平台工程师 · 上海 · 25-40K·16薪')).toBeNull();
  });
});
