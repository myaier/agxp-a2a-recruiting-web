// 工作城市选择正文 测试（Task 2）：纯展示行为。
// 两业务（候选引导 10 城 / 意向 1 城 / 岗位全页子视图）同输入必须同 DOM 同行为；
// 临时选择归组件内部（挂载复制初始值，父层 rerender / JD 迟到不重置）；
// 失败显示错误与重试、搜索态成功 0 条显示无结果，两者不互装。

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import 工作城市选择正文, { type 城市项, type 城市列表状态 } from './工作城市选择正文';

/** 轻提示 是挂在 document.body 上的纯 DOM 单例，RTL cleanup 不清它 */
function 轻提示文案们(): string[] {
  for (const 节点 of Array.from(document.body.children)) {
    const 元素 = 节点 as HTMLElement;
    if (元素.style.position === 'fixed' && 元素.style.zIndex === '999') {
      return Array.from(元素.children).map((条) => 条.textContent ?? '');
    }
  }
  return [];
}

function 城(键: string, 名称 = 键, 禁用 = false): 城市项 {
  return { 键, 名称, ...(禁用 ? { 禁用: true } : {}) };
}

function 空列表(覆盖: Partial<城市列表状态> = {}): 城市列表状态 {
  return {
    组: [
      { 键: '热门', 名称: '热 门 城 市', 城市: [城('c1', '城市一'), 城('c2', '城市二')] },
    ],
    加载中: false,
    错误: null,
    可加载更多: false,
    加载更多: vi.fn(),
    重试: vi.fn(),
    ...覆盖,
  };
}

function 渲染正文(属性: {
  上限?: 1 | 10;
  初始已选?: 城市项[];
  搜索词?: string;
  列表?: 城市列表状态;
  返回?: () => void;
  保存?: (已选: 城市项[]) => void;
  改搜索词?: (词: string) => void;
}) {
  const 保存 = 属性.保存 ?? vi.fn((): void => {});
  const 返回 = 属性.返回 ?? vi.fn((): void => {});
  const 改搜索词 = 属性.改搜索词 ?? vi.fn((_词: string): void => {});
  const 视图 = render(
    <工作城市选择正文
      标题="选择工作城市"
      上限={属性.上限 ?? 10}
      初始已选={属性.初始已选 ?? []}
      搜索词={属性.搜索词 ?? ''}
      改搜索词={改搜索词}
      列表={属性.列表 ?? 空列表()}
      返回={返回}
      保存={保存}
    />,
  );
  return { 保存, 返回, 改搜索词, 视图 };
}

describe('工作城市选择正文 单选（岗位）', () => {
  it('不显示 N/上限 计数；点新项替换旧项；已选芯片可取消；空选择保存禁用', async () => {
    const { 保存 } = 渲染正文({ 上限: 1 });
    expect(screen.queryByText('0/1')).toBeNull();

    await screen.findByText('城市一');
    fireEvent.click(screen.getByRole('button', { name: '城市一' }));
    // 已选条出现：1 枚芯片，可点 ✕ 取消
    expect(screen.getByRole('button', { name: '城市一 ✕' })).toBeTruthy();
    // 点另一枚 = 单选替换
    fireEvent.click(screen.getByRole('button', { name: '城市二' }));
    expect(screen.queryByRole('button', { name: '城市一 ✕' })).toBeNull();
    expect(screen.getByRole('button', { name: '城市二 ✕' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '城市二 ✕' }));
    expect(screen.queryByText('已选')).toBeNull();
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true);
    expect(保存).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '城市二' }));
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(保存).toHaveBeenCalledWith([{ 键: 'c2', 名称: '城市二' }]);
  });

  it('挂载从 初始已选 复制，父层 rerender 传入不同 初始已选 不重置本次选择', () => {
    const { 视图, 保存 } = 渲染正文({ 上限: 1, 初始已选: [城('c1', '城市一')] });
    expect(screen.getByRole('button', { name: '城市一 ✕' })).toBeTruthy();
    视图.rerender(
      <工作城市选择正文
        标题="选择工作城市"
        上限={1}
        初始已选={[城('c2', '城市二')]}
        搜索词=""
        改搜索词={vi.fn()}
        列表={空列表()}
        返回={vi.fn()}
        保存={保存}
      />,
    );
    // 临时选择仍是挂载时复制的 c1，不被父层新值重置
    expect(screen.getByRole('button', { name: '城市一 ✕' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(保存).toHaveBeenCalledWith([{ 键: 'c1', 名称: '城市一' }]);
  });

  it('禁用项（如 Backend「暂未获取定位」缺失态）点不出选择', () => {
    渲染正文({
      上限: 1,
      列表: 空列表({
        组: [{ 键: '定位', 名称: '当 前 定 位', 城市: [城('no-fix', '暂未获取定位', true)] }],
      }),
    });
    fireEvent.click(screen.getByRole('button', { name: '暂未获取定位' }));
    expect(screen.queryByText('已选')).toBeNull();
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('同名不同键的两枚各自独立选择与取消，保存按 键 上交不按名称重建', () => {
    const { 保存 } = 渲染正文({
      上限: 1,
      列表: 空列表({
        组: [{ 键: 'g', 名称: '组', 城市: [城('a', '朝阳'), 城('b', '朝阳')] }],
      }),
    });
    const 两枚 = screen.getAllByRole('button', { name: '朝阳' });
    expect(两枚).toHaveLength(2);
    fireEvent.click(两枚[1]);
    expect(screen.getByRole('button', { name: '朝阳 ✕' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(保存).toHaveBeenCalledWith([{ 键: 'b', 名称: '朝阳' }]);
  });
});

describe('工作城市选择正文 多选（候选 10 城）', () => {
  const 十二城 = Array.from({ length: 12 }, (_, 序) => 城(`c${序 + 1}`, `城市${序 + 1}`));

  it('显示 N/10 计数；选满 10 后第 11 枚被拒并提示，可取消已选', async () => {
    渲染正文({
      上限: 10,
      列表: 空列表({
        组: [{ 键: '热门', 名称: '热 门 城 市', 城市: 十二城 }],
      }),
    });
    expect(screen.getByText('0/10')).toBeTruthy();
    for (let 序 = 1; 序 <= 10; 序 += 1) {
      fireEvent.click(screen.getByRole('button', { name: `城市${序}` }));
    }
    expect(screen.getByText('10/10')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '城市11' }));
    expect(screen.getByText('10/10')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '城市11 ✕' })).toBeNull();
    expect(轻提示文案们()).toContain('最多选 10 个');
    // 取消一枚后可再选
    fireEvent.click(screen.getByRole('button', { name: '城市10 ✕' }));
    fireEvent.click(screen.getByRole('button', { name: '城市11' }));
    expect(screen.getByRole('button', { name: '城市11 ✕' })).toBeTruthy();
  });

  it('保存把本次临时选择整体上交', () => {
    const { 保存 } = 渲染正文({ 上限: 10 });
    fireEvent.click(screen.getByRole('button', { name: '城市二' }));
    fireEvent.click(screen.getByRole('button', { name: '城市一' }));
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(保存).toHaveBeenCalledWith([
      { 键: 'c2', 名称: '城市二' },
      { 键: 'c1', 名称: '城市一' },
    ]);
  });
});

describe('工作城市选择正文 列表状态', () => {
  it('失败显示错误行与重试，重试回调来自 列表.重试', async () => {
    const 重试 = vi.fn();
    渲染正文({ 上限: 1, 列表: 空列表({ 错误: '后端服务暂时不可用，请稍后重试', 重试 }) });
    await screen.findByText('后端服务暂时不可用，请稍后重试');
    // 失败不装成成功空页：无结果文案不出场
    expect(screen.queryByText('没有匹配的城市，换个词试试。')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(重试).toHaveBeenCalledTimes(1);
  });

  it('搜索态成功 0 条显示无结果；加载中不显示', () => {
    const { 视图 } = 渲染正文({
      上限: 1,
      搜索词: '不存在城',
      列表: 空列表({ 组: [{ 键: '搜索', 名称: '搜 索 结 果', 城市: [] }] }),
    });
    expect(screen.getByText('没有匹配的城市，换个词试试。')).toBeTruthy();
    视图.rerender(
      <工作城市选择正文
        标题="选择工作城市"
        上限={1}
        初始已选={[]}
        搜索词="不存在城"
        改搜索词={vi.fn()}
        列表={空列表({ 组: [{ 键: '搜索', 名称: '搜 索 结 果', 城市: [] }], 加载中: true })}
        返回={vi.fn()}
        保存={vi.fn()}
      />,
    );
    expect(screen.queryByText('没有匹配的城市，换个词试试。')).toBeNull();
  });

  it('组按调用方给的顺序渲染分组标题与网格', () => {
    渲染正文({
      上限: 1,
      列表: 空列表({
        组: [
          { 键: '定位', 名称: '当 前 定 位', 城市: [城('no-fix', '暂未获取定位', true)] },
          { 键: '热门', 名称: '热 门 城 市', 城市: [城('c1', '城市一')] },
          { 键: '广东', 名称: '广东省', 城市: [城('c2', '城市二')] },
        ],
      }),
    });
    expect(screen.getByText('当 前 定 位')).toBeTruthy();
    expect(screen.getByText('热 门 城 市')).toBeTruthy();
    expect(screen.getByText('广东省')).toBeTruthy();
  });

  it('滚到底且可翻页时触发 加载更多；加载中或不可翻页时不触发', () => {
    const 加载更多 = vi.fn();
    const { 视图 } = 渲染正文({ 上限: 1, 列表: 空列表({ 可加载更多: true, 加载更多 }) });
    const 容器 = document.querySelector('.滚动区') as HTMLElement;
    Object.defineProperty(容器, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(容器, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(容器, 'scrollTop', { value: 600, configurable: true, writable: true });
    fireEvent.scroll(容器);
    expect(加载更多).toHaveBeenCalledTimes(1);

    // 加载中：不触发重入
    视图.rerender(
      <工作城市选择正文
        标题="选择工作城市"
        上限={1}
        初始已选={[]}
        搜索词=""
        改搜索词={vi.fn()}
        列表={空列表({ 可加载更多: true, 加载中: true, 加载更多 })}
        返回={vi.fn()}
        保存={vi.fn()}
      />,
    );
    fireEvent.scroll(容器);
    expect(加载更多).toHaveBeenCalledTimes(1);

    // 不可翻页：不触发
    视图.rerender(
      <工作城市选择正文
        标题="选择工作城市"
        上限={1}
        初始已选={[]}
        搜索词=""
        改搜索词={vi.fn()}
        列表={空列表({ 可加载更多: false, 加载更多 })}
        返回={vi.fn()}
        保存={vi.fn()}
      />,
    );
    fireEvent.scroll(容器);
    expect(加载更多).toHaveBeenCalledTimes(1);
  });
});

describe('工作城市选择正文 搜索与返回', () => {
  it('搜索输入受控并上报 改搜索词', () => {
    const { 改搜索词 } = 渲染正文({ 上限: 1, 搜索词: '杭', 列表: 空列表() });
    const 输入 = screen.getByPlaceholderText('搜索城市 / 省份') as HTMLInputElement;
    expect(输入.value).toBe('杭');
    fireEvent.change(输入, { target: { value: '杭州' } });
    expect(改搜索词).toHaveBeenCalledWith('杭州');
  });

  it('返回栏与 Escape 都走 返回（关闭/返回语义归调用方）', () => {
    const 返回 = vi.fn();
    渲染正文({ 上限: 1, 返回 });
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(返回).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(返回).toHaveBeenCalledTimes(2);
  });

  it('保存键文案为 保存 且空选择禁用', () => {
    const { 保存 } = 渲染正文({ 上限: 1 });
    const 键 = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement;
    expect(键.disabled).toBe(true);
    fireEvent.click(键);
    expect(保存).not.toHaveBeenCalled();
  });
});
