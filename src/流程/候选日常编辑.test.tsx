// 候选日常编辑来路与退出（合同 A / Spec §5.2）：页面局部参数，不新增应用路由。
// 只记三件事 —— 固定来源、来源格号、本次页面会话标识：不存业务草稿、不存任意 return URL。
// 退一格需要三件事同时成立（本会话写下 / 来源匹配 / 当前格正好在来源格后一格），
// 否则一律替换到来源对应的固定路径 —— 刷新（新文档会话）、深链、越级、来源不符都不盲退。
// 真实浏览器的历史栈完整性由 Task 5 的浏览器 Suite 证明；本文件只钉判定与调用形状。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { 路径 } from '../路由/路径表';
import {
  创建候选编辑来路,
  读候选编辑来源,
  use候选编辑退出,
  type 候选编辑来源,
} from './候选日常编辑';

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock替换跳转 = vi.fn();

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 跳转: mock跳转, 返回: mock返回, 替换跳转: mock替换跳转 }),
}));

/** react-router 在真实浏览器里把格号写在 history.state.idx（导航钩子同源取法）*/
function 置当前格号(idx: number | null) {
  window.history.replaceState(idx === null ? null : { idx, key: `k${idx}`, usr: null }, '');
}

/** 退出钩子的最小宿主：按钮一点即走本来源的退出路径 */
function 宿主({ 来源 }: { 来源: 候选编辑来源 }) {
  const 退出 = use候选编辑退出(来源);
  return <button onClick={退出}>退出</button>;
}

/** 在「编辑页」挂载点渲染：state 就是源列表同一次点击写下的来路证明 */
function 渲染退出(来路: unknown, 来源: 候选编辑来源 = 'resume') {
  return render(
    <MemoryRouter initialEntries={[{ pathname: 路径.基本信息, search: '?from=resume', state: 来路 }]}>
      <宿主 来源={来源} />
    </MemoryRouter>,
  );
}

async function 点退出() {
  const 用户 = userEvent.setup();
  await 用户.click(screen.getByRole('button', { name: '退出' }));
}

beforeEach(() => {
  mock跳转.mockClear();
  mock返回.mockClear();
  mock替换跳转.mockClear();
  置当前格号(null);
});

afterEach(() => {
  置当前格号(null);
});

describe('读候选编辑来源 · 白名单 resume / intentions', () => {
  it.each<[string, 候选编辑来源]>([
    ['?from=resume', 'resume'],
    ['from=resume', 'resume'],
    ['?section=work&from=resume', 'resume'],
    ['?from=intentions', 'intentions'],
  ])('%s → %s', (search, 期望) => {
    expect(读候选编辑来源(search)).toBe(期望);
  });

  it.each([
    '',
    '?section=work',
    '?from=',
    '?from=evil',
    '?from=resume2',
    '?from=RESUME',
    '?from=resume%20',
    '?to=resume',
  ])('白名单外的 %j → null（未知来源不得触发写入）', (search) => {
    expect(读候选编辑来源(search)).toBeNull();
  });
});

describe('创建候选编辑来路 · 只记来源 / 来源格号 / 本页面会话标识', () => {
  it('形状固定：不多带任意 return URL 或业务草稿', () => {
    置当前格号(4);
    const 来路 = 创建候选编辑来路('resume') as Record<string, unknown>;
    expect(来路.来源).toBe('resume');
    expect(来路.格号).toBe(4);
    expect(typeof 来路.会话).toBe('string');
    expect(Object.keys(来路).sort()).toEqual(['会话', '来源', '格号']);
  });

  it('拿不到格号（无 react-router idx）时记 null：退出只能安全替换', () => {
    置当前格号(null);
    const 来路 = 创建候选编辑来路('intentions') as { 格号: unknown };
    expect(来路.格号).toBeNull();
  });

  it('来源按传入值记录：intentions 与 resume 是两个来路', () => {
    置当前格号(2);
    expect((创建候选编辑来路('intentions') as { 来源: string }).来源).toBe('intentions');
    expect((创建候选编辑来路('resume') as { 来源: string }).来源).toBe('resume');
  });
});

describe('use候选编辑退出 · 本会话 / 来源 / 格号三项全对才退一格', () => {
  it('本会话写下、来源匹配、当前格正好在来源格后一格：退一格回原列表', async () => {
    置当前格号(4);
    const 来路 = 创建候选编辑来路('resume');
    置当前格号(5); // 源列表同一次点击只 push 一格
    渲染退出(来路);
    await 点退出();
    expect(mock返回).toHaveBeenCalledTimes(1);
    expect(mock替换跳转).not.toHaveBeenCalled();
  });

  it('intentions 来源匹配：同样退一格', async () => {
    置当前格号(1);
    const 来路 = 创建候选编辑来路('intentions');
    置当前格号(2);
    渲染退出(来路, 'intentions');
    await 点退出();
    expect(mock返回).toHaveBeenCalledTimes(1);
    expect(mock替换跳转).not.toHaveBeenCalled();
  });

  it('无来路时按来源替换到固定路径：intentions → 求职意向管理', async () => {
    渲染退出(undefined, 'intentions');
    await 点退出();
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).toHaveBeenCalledWith(路径.求职意向管理);
  });

  it.each([undefined, null, '', 'resume', 3, {}, []])('深链/垃圾 state %j：替换到我的简历', async (坏) => {
    渲染退出(坏);
    await 点退出();
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).toHaveBeenCalledWith(路径.我的简历);
  });

  it('越级 idx（当前格不是来源格 +1）：不盲退，替换到来源固定路径', async () => {
    置当前格号(4);
    const 来路 = 创建候选编辑来路('resume');
    置当前格号(6); // 中间还有别的格子：退一格会落错地方
    渲染退出(来路);
    await 点退出();
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).toHaveBeenCalledWith(路径.我的简历);
  });

  it('来源不符（意向管理来路却按简历退出）：替换到本来源的固定路径', async () => {
    置当前格号(4);
    const 来路 = 创建候选编辑来路('intentions');
    置当前格号(5);
    渲染退出(来路, 'resume');
    await 点退出();
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).toHaveBeenCalledWith(路径.我的简历);
  });

  it('来路字段被篡改（来源不在白名单 / 格号不是数字）：一律安全替换', async () => {
    置当前格号(4);
    const 来路 = 创建候选编辑来路('resume') as Record<string, unknown>;
    置当前格号(5);
    渲染退出({ ...来路, 来源: 'evil' });
    await 点退出();
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).toHaveBeenCalledWith(路径.我的简历);
  });

  it('旧文档写下的来路（刷新后新的页面会话标识）：安全替换，不盲退', async () => {
    置当前格号(4);
    const 当前文档 = await import('./候选日常编辑');
    const 旧来路 = 当前文档.创建候选编辑来路('resume');
    // 重载模块 = 新文档/刷新的页面会话标识：旧文档写在 history.state 里的证明随之失效
    vi.resetModules();
    const 新文档 = await import('./候选日常编辑');
    置当前格号(5);
    function 新宿主() {
      const 退出 = 新文档.use候选编辑退出('resume');
      return <button onClick={退出}>退出</button>;
    }
    render(
      <MemoryRouter initialEntries={[{ pathname: 路径.基本信息, state: 旧来路 }]}>
        <新宿主 />
      </MemoryRouter>,
    );
    await 点退出();
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).toHaveBeenCalledWith(路径.我的简历);
  });

  it('来路格号缺失（写来路时没有 idx）：安全替换，不按 -1 格盲退', async () => {
    置当前格号(null);
    const 来路 = 创建候选编辑来路('resume');
    置当前格号(0);
    渲染退出(来路);
    await 点退出();
    expect(mock返回).not.toHaveBeenCalled();
    expect(mock替换跳转).toHaveBeenCalledWith(路径.我的简历);
  });
});
