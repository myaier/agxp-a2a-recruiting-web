// 个人优势受控正文（合同 B，Spec §5.1/§5.3）：日常 /wizard?from=resume 与
// onboarding 资料页共用的唯一绘制 —— textarea（aria-label 个人优势、maxLength=500）、
// 实时字数、真实恢复按钮（恢复 = null 时整行不出现，不虚构「可恢复」的假动作）。
// 不含保存 / 路由，也不含已失效的「删除一行：长按段落」提示：这些由调用页承担。

import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 个人优势编辑正文 from './个人优势编辑正文';

/** 受控宿主：正文是受控组件，输入必须回流成新的 文本 才能继续打字（同调用页的 useState）。 */
function 受控宿主({
  文本初值,
  说明,
  恢复,
  恢复文案,
  修改,
}: {
  文本初值: string;
  说明?: string;
  恢复: (() => void) | null;
  恢复文案: string;
  修改: (值: string) => void;
}) {
  const [文本, 设文本] = useState(文本初值);
  const 记修改 = (值: string) => {
    修改(值);
    设文本(值);
  };
  return (
    <个人优势编辑正文
      文本={文本}
      修改={记修改}
      说明={说明}
      恢复={恢复}
      恢复文案={恢复文案}
    />
  );
}

function 渲染(选项: {
  文本?: string;
  说明?: string;
  恢复?: (() => void) | null;
  恢复文案?: string;
} = {}) {
  const 修改 = vi.fn();
  render(
    <受控宿主
      文本初值={选项.文本 ?? ''}
      说明={选项.说明}
      恢复={选项.恢复 ?? null}
      恢复文案={选项.恢复文案 ?? '恢复简历识别建议'}
      修改={修改}
    />,
  );
  return { 修改 };
}

/** 正文框（aria-label 个人优势） */
function 优势框(): HTMLTextAreaElement {
  return screen.getByLabelText('个人优势') as HTMLTextAreaElement;
}

describe('个人优势编辑正文 · 受控输入与字数', () => {
  it('值来自 文本；输入把原样值回传 修改（换行逐字保留）', async () => {
    const { 修改 } = 渲染({ 文本: '存量优势' });
    expect(优势框().value).toBe('存量优势');
    const 用户 = userEvent.setup();
    await 用户.clear(优势框());
    await 用户.type(优势框(), '第一行{Enter}第二行');
    expect(修改).toHaveBeenLastCalledWith('第一行\n第二行');
  });

  it('textarea 带上限 500 与读屏标签；字数按当前文本实时显示', () => {
    渲染({ 文本: '一二三' });
    expect(优势框().maxLength).toBe(500);
    expect(优势框().tagName).toBe('TEXTAREA');
    expect(screen.getByText('3 / 500')).toBeTruthy();
  });

  it('可选说明按实际来源渲染；不给则整行不出现', () => {
    渲染({ 文本: 'x', 说明: '已根据你上传的简历预先提取，直接删改即可。' });
    expect(screen.getByText('已根据你上传的简历预先提取，直接删改即可。')).toBeTruthy();
  });

  it('不给说明时不渲染说明行', () => {
    渲染({ 文本: 'x' });
    expect(screen.queryByText(/预先提取/)).toBeNull();
  });
});

describe('个人优势编辑正文 · 恢复语义由调用方给', () => {
  it('恢复为 null：整行不渲染，不虚构可恢复动作', () => {
    渲染({ 文本: '存量优势', 恢复: null, 恢复文案: '恢复简历识别建议' });
    expect(screen.queryByRole('button', { name: /恢复简历识别建议|重新从简历提取/ })).toBeNull();
  });

  it('给了恢复动作：按恢复文案渲染并点击回调一次', async () => {
    const 恢复 = vi.fn();
    渲染({ 文本: '', 恢复, 恢复文案: '恢复简历识别建议' });
    const 键 = screen.getByRole('button', { name: /恢复简历识别建议/ });
    const 用户 = userEvent.setup();
    await 用户.click(键);
    expect(恢复).toHaveBeenCalledTimes(1);
  });
});

describe('个人优势编辑正文 · 职责边界（无保存 / 无路由 / 无失效提示）', () => {
  it('不渲染保存键、不渲染长按段落说明，也不渲染向导的其它题', () => {
    渲染({ 文本: '存量优势', 恢复: () => {} });
    for (const 文案 of ['保存', '保存并继续', '下一步']) {
      expect(screen.queryByRole('button', { name: 文案 })).toBeNull();
    }
    expect(screen.queryByText(/长按/)).toBeNull();
  });
});
