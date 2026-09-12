// 期望行业选择正文 组件测试（Task 7）：
// 纯展示正文 —— 选期望行业页两模式把控制映射为同一组 props，正文渲染原页面骨架：
// 返回栏 ‹ + 右上「保存」→「已选行业」+ N/3 计数 → 副标题 →「推荐」chips →
// 手风琴清单（组行 + 展开细分片 + 组尾「加载更多」）→ 根列表尾「加载更多」。
// 这里只断言展示契约与点击归属：
//   · 计数与上限态来自 已选项们（不扫可见分组）——已选不依赖当前可见项；
//   · 片点击沿现有优先级：可选则 切换（含取消已选），否则可展开才 展开；
//   · 上限（3）态沿用原页：未选片禁用变灰、已选片仍可点移除、组行展开不受限；
//   · 组尾/根尾分页沿用原控件位置：还有才渲染、忙时「加载中…」禁用；
//   · 层级 ≥1 组沿用原孙项盒（细分片组 + paddingLeft 12），跟随前面 层级 0 组。
// 两模式消费同一正文由 src/屏幕/选期望行业.test.tsx 与 e2e 证明。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  期望行业选择正文,
  type 期望行业组,
  type 期望行业项,
  type 期望行业选择正文Props,
} from './期望行业选择正文';

/** 一枚行业片的展示值 */
function 项(键: string, 名称: string, 覆盖: Partial<Omit<期望行业项, '键' | '名称'>> = {}): 期望行业项 {
  return { 键, 名称, 选中: false, 可选: true, 可展开: false, ...覆盖 };
}

/** 一组（手风琴组或层级 ≥1 的嵌套片组） */
function 组(
  键: string,
  标题: string,
  项们: 期望行业项[],
  覆盖: Partial<Omit<期望行业组, '键' | '标题' | '项们'>> = {},
): 期望行业组 {
  return { 键, 标题, 层级: 0, 已展开: false, 项们, 加载中: false, 还有: false, 加载更多: vi.fn(), ...覆盖 };
}

function 基础Props(覆盖: Partial<期望行业选择正文Props> = {}): 期望行业选择正文Props {
  return {
    已选项们: [],
    推荐项们: [项('rec-fin', '金融科技'), 项('rec-net', '互联网平台')],
    分组们: [
      组('g-fin', '金融科技', [项('c-pay', '支付与清结算'), 项('c-risk', '风控与反欺诈', { 可选: false, 可展开: true })]),
      组('g-net', '互联网平台', []),
    ],
    根加载中: false,
    根还有: false,
    根加载更多: vi.fn(),
    展开: vi.fn(),
    切换: vi.fn(),
    返回: vi.fn(),
    保存: vi.fn(),
    ...覆盖,
  };
}

describe('期望行业选择正文 展示契约', () => {
  /** 组行定位：推荐区也有同名片，取带 aria-expanded 的那枚按钮（jsdom 的可访问名拼接与浏览器不一致，不依赖箭头文本） */
  const 组行 = (标题: string) =>
    screen.getAllByRole('button', { name: new RegExp(标题) }).find((b) => b.getAttribute('aria-expanded') !== null)!;

  it('原页面骨架上屏：返回栏保存、已选行业 0/3 计数、推荐区、收起组不渲染细分片', () => {
    render(<期望行业选择正文 {...基础Props()} />);

    expect(screen.getByRole('button', { name: '保存' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '已选行业' })).toBeTruthy();
    expect(screen.getByText('0/3')).toBeTruthy();
    expect(screen.getByText('请选择行业，最多3个')).toBeTruthy();
    expect(screen.getByText('推荐')).toBeTruthy();
    // 推荐区按给定项渲染
    expect(screen.getByRole('button', { name: '金融科技' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '互联网平台' })).toBeTruthy();
    // 手风琴组行收起：aria-expanded=false，细分片不渲染
    expect(组行('金融科技').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('支付与清结算')).toBeNull();
  });

  it('计数与上限态来自 已选项们：可见分组全收起时计数仍如实', () => {
    render(
      <期望行业选择正文
        {...基础Props({
          已选项们: [项('s1', '支付与清结算', { 选中: true }), 项('s2', '电商与交易', { 选中: true })],
        })}
      />,
    );
    expect(screen.getByText('2/3')).toBeTruthy();
  });

  it('展开组渲染细分片；可选交给 切换、不可选可展开交给 展开，按稳定键回报', async () => {
    const 切换 = vi.fn();
    const 展开 = vi.fn();
    render(
      <期望行业选择正文
        {...基础Props({
          分组们: [
            组('g-fin', '金融科技', [
              项('c-pay', '支付与清结算'),
              项('c-risk', '风控与反欺诈', { 可选: false, 可展开: true }),
              项('c-dead', '死端项', { 可选: false, 可展开: false }),
            ], { 已展开: true }),
          ],
          切换,
          展开,
        })}
      />,
    );
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('支付与清结算'));
    expect(切换).toHaveBeenCalledWith('c-pay');
    expect(展开).not.toHaveBeenCalled();
    await 用户.click(screen.getByText('风控与反欺诈'));
    expect(展开).toHaveBeenCalledWith('c-risk');
    expect(切换).toHaveBeenCalledTimes(1);
    // 既不可选也不可展开：点击不动任何回调（页面侧不发目录请求、不提交）
    await 用户.click(screen.getByText('死端项'));
    expect(切换).toHaveBeenCalledTimes(1);
    expect(展开).toHaveBeenCalledTimes(1);
  });

  it('同名条目按稳定键区分：两枚同名片分别回报各自键，勾只落在选中片', async () => {
    const 切换 = vi.fn();
    render(
      <期望行业选择正文
        {...基础Props({
          分组们: [
            组('g-fin', '金融科技', [
              项('pay_a', '支付与清结算', { 选中: true }),
              项('pay_b', '支付与清结算'),
            ], { 已展开: true }),
          ],
          切换,
        })}
      />,
    );
    const 用户 = userEvent.setup();
    const 同名们 = screen.getAllByText('支付与清结算');
    expect(同名们).toHaveLength(2);
    expect(同名们[0].getAttribute('aria-pressed')).toBe('true');
    expect(同名们[1].getAttribute('aria-pressed')).toBe('false');
    await 用户.click(同名们[1]);
    expect(切换).toHaveBeenCalledWith('pay_b');
    await 用户.click(同名们[0]);
    expect(切换).toHaveBeenLastCalledWith('pay_a');
  });

  it('上限态沿用原页：未选片禁用变灰、已选片仍可点移除、组行展开不受限', async () => {
    const 切换 = vi.fn();
    const 展开 = vi.fn();
    render(
      <期望行业选择正文
        {...基础Props({
          已选项们: [项('s1', '一', { 选中: true }), 项('s2', '二', { 选中: true }), 项('s3', '三', { 选中: true })],
          分组们: [组('g-fin', '金融科技', [项('c-new', '风控与反欺诈')], { 已展开: true }), 组('g-net', '互联网平台', [])],
          切换,
          展开,
        })}
      />,
    );
    const 用户 = userEvent.setup();
    const 未选 = screen.getByText('风控与反欺诈') as HTMLButtonElement;
    expect(未选.disabled).toBe(true);
    expect(未选.className).toContain('行业片禁用');
    // 已选片不在可见分组里也没有替身可点 → 上限态不靠扫分组：3/3 计数在场
    expect(screen.getByText('3/3')).toBeTruthy();
    // 组行展开不受上限影响
    await 用户.click(组行('互联网平台'));
    expect(展开).toHaveBeenCalledWith('g-net');
    expect(切换).not.toHaveBeenCalled();
  });

  it('组尾分页沿用原控件：还有才渲染，忙时「加载中…」禁用，点击交给本组 加载更多', async () => {
    const 加载更多 = vi.fn();
    render(
      <期望行业选择正文
        {...基础Props({
          分组们: [组('g-fin', '金融科技', [项('c-pay', '支付与清结算')], { 已展开: true, 还有: true, 加载更多 })],
        })}
      />,
    );
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '加载更多' }));
    expect(加载更多).toHaveBeenCalledTimes(1);
  });

  it('组尾忙态：加载中渲染「加载中…」并禁用', () => {
    render(
      <期望行业选择正文
        {...基础Props({
          分组们: [
            组('g-fin', '金融科技', [项('c-pay', '支付与清结算')], { 已展开: true, 加载中: true, 还有: true, 加载更多: vi.fn() }),
          ],
        })}
      />,
    );
    const 尾 = screen.getByRole('button', { name: '加载中…' }) as HTMLButtonElement;
    expect(尾.disabled).toBe(true);
  });

  it('展开中空组沿用原加载文案，不渲染分页尾（还有=false）', () => {
    render(
      <期望行业选择正文
        {...基础Props({
          分组们: [组('g-fin', '金融科技', [], { 已展开: true, 加载中: true })],
        })}
      />,
    );
    expect(screen.getByText('加载中…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull();
  });

  it('根列表尾沿原位置挂手风琴尾部：根还有才渲染，点击交给 根加载更多', async () => {
    const 根加载更多 = vi.fn();
    render(
      <期望行业选择正文
        {...基础Props({
          分组们: [组('g-fin', '金融科技', [项('c-pay', '支付与清结算')], { 已展开: true })],
          根还有: true,
          根加载更多,
        })}
      />,
    );
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '加载更多' }));
    expect(根加载更多).toHaveBeenCalledTimes(1);
    // 组没有分页尾时，这个「加载更多」只能来自根列表尾
    expect(screen.getAllByRole('button', { name: '加载更多' })).toHaveLength(1);
  });

  it('层级 1 嵌套组沿用原孙项盒：跟在前面 层级 0 组后、缩进 12、自带分页尾', async () => {
    const 孙加载更多 = vi.fn();
    render(
      <期望行业选择正文
        {...基础Props({
          分组们: [
            组('g-fin', '金融科技', [项('c-risk', '风控与反欺诈', { 可选: false, 可展开: true })], { 已展开: true }),
            组('c-risk', '风控与反欺诈', [项('g-1', '反欺诈引擎'), 项('g-2', '设备指纹', { 选中: true })], {
              层级: 1,
              已展开: true,
              还有: true,
              加载更多: 孙加载更多,
            }),
          ],
        })}
      />,
    );
    const 用户 = userEvent.setup();
    expect(screen.getByText('反欺诈引擎')).toBeTruthy();
    expect(screen.getByText('设备指纹').getAttribute('aria-pressed')).toBe('true');
    // 嵌套盒缩进沿用原 inline paddingLeft 12
    const 嵌套盒 = (screen.getByText('反欺诈引擎').closest('div') as HTMLElement);
    expect(嵌套盒.style.paddingLeft).toBe('12px');
    await 用户.click(screen.getByRole('button', { name: '加载更多' }));
    expect(孙加载更多).toHaveBeenCalledTimes(1);
  });

  it('保存与返回交给回调', async () => {
    const 返回 = vi.fn();
    const 保存 = vi.fn();
    render(<期望行业选择正文 {...基础Props({ 返回, 保存 })} />);
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(保存).toHaveBeenCalledTimes(1);
    await 用户.click(screen.getByRole('button', { name: '返回' }));
    expect(返回).toHaveBeenCalledTimes(1);
  });
});