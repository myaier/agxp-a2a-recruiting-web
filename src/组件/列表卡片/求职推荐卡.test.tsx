// 求职推荐卡：市场卡（原 看市场.tsx 内 市场卡 JSX）的共享提取（Plan 合同 D）。
// 视觉基准 = 原市场卡一比一：公司头行[公司字标 + 公司名/简介 + 右列(分 + 薪资)]
// → 职位名 → 标签行 → 底行[发布人头像 + 发布人 + › + 去谈键/已委托状态标]。
// 纯展示 props：分由调用方（看市场 薄包装经 use适配分）算好传入，本组只验卡面与
// null/0 区分、禁用委托、头像失败回退等卡层自身行为。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null；
// 适配环的 svg 是 role=img，而 alt="" 的 <img> 在 role 计算里是 presentation ——
// 图位一律用 container.querySelector('img')（同 求职在谈卡.test.tsx 惯例）。
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import 求职推荐卡 from './求职推荐卡';
import type { 求职推荐卡属性 } from './类型';

/** 默认卡：Mock 基准字段（已知 94 分、公司三件套、发布人带公司前缀）。
 *  公司名用静态公司标映射外的 云帆科技：不触发字标 img，卡面只看本卡自己的逻辑。 */
function 渲染卡(覆盖: Partial<求职推荐卡属性> = {}): {
  属性: 求职推荐卡属性;
  宿主: ReturnType<typeof render>;
} {
  const 属性: 求职推荐卡属性 = {
    公司: '云帆科技',
    公司简介: '未上市 · 200-500 人',
    公司首字: '云',
    职位: '资深后端工程师 · 交易网关',
    薪资: '20-40K·14薪',
    标签: ['上海 · 浦东', '15 薪', 'Go'],
    匹配分: 94,
    发布人: '云帆科技 · 企业直招',
    发布人首字: '企',
    发布人底色: '#5b7a9a',
    发布人字色: '#fff',
    已委托: false,
    委托禁用: false,
    委托: vi.fn(),
    打开: vi.fn(),
    ...覆盖,
  };
  const 宿主 = render(<求职推荐卡 {...属性} />);
  return { 属性, 宿主 };
}

describe('求职推荐卡 · 原市场卡已知值（合同 D 提取基准）', () => {
  it('已知卡：公司头行 + 右列[分+薪资] → 职位 → 标签 → 底行，发布人只留身份段', () => {
    const { 属性 } = 渲染卡();
    expect(screen.getByText('云')).toBeTruthy(); // 公司字标首字照旧
    expect(screen.getByText('云帆科技')).toBeTruthy();
    expect(screen.getByText('未上市 · 200-500 人')).toBeTruthy();
    expect(screen.getByRole('img', { name: '适配 94 分' })).toBeTruthy();
    // 原展示破折号行为：薪资里的 - 照旧换成 –（不改币种/单位/数值）
    expect(screen.getByText('20–40K·14薪')).toBeTruthy();
    expect(screen.getByText('资深后端工程师 · 交易网关')).toBeTruthy();
    for (const 标签 of ['上海 · 浦东', '15 薪', 'Go']) {
      expect(screen.getByText(标签)).toBeTruthy();
    }
    // 发布人以「公司 · 」开头只留身份段（原市场卡行为逐字保留）
    expect(screen.getByText('企业直招')).toBeTruthy();
    expect(screen.getByText('企')).toBeTruthy();
    // 去谈键可用，回调走 props
    const 去谈键 = screen.getByRole('button', { name: '让AI代理去谈' }) as HTMLButtonElement;
    expect(去谈键.disabled).toBe(false);
    fireEvent.click(去谈键);
    expect(属性.委托).toHaveBeenCalledTimes(1);
  });

  it('卡主体与 › 都只调 打开；已委托态换状态标、去谈键退场', () => {
    const { 属性 } = 渲染卡({ 已委托: true });
    fireEvent.click(screen.getByRole('button', { name: '查看职位详情' }));
    expect(属性.打开).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '让AI代理去谈' })).toBeNull();
    expect(screen.getByText('AI代理已接手')).toBeTruthy();
    // 默认状态标文字 = 原市场卡缺省；调用方可覆盖
    渲染卡({ 已委托: true, 已委托文字: '已提交给 AI，等待处理' });
    expect(screen.getByText('已提交给 AI，等待处理')).toBeTruthy();
  });
});

describe('求职推荐卡 · null/0 与占位（合同 D：null 控制占位，空串不是 null）', () => {
  it('匹配分 null 走卡片分数未知占位：不画环；真实 0 分仍画 0 分环，不误判未知', () => {
    const 无分宿主 = render(<求职推荐卡
      公司="云帆科技" 公司简介="未上市" 公司首字="云"
      职位="资深后端工程师" 薪资="20-40K" 标签={['上海']}
      匹配分={null}
      发布人="企业直招" 发布人首字="企" 发布人底色="#5b7a9a" 发布人字色="#fff"
      已委托={false} 委托禁用={false} 委托={vi.fn()} 打开={vi.fn()}
    />);
    expect(screen.getByLabelText('匹配分未知')).toBeTruthy();
    expect(screen.queryByRole('img', { name: /适配/ })).toBeNull();
    // 占位槽内不画进度弧（卡上其他位置的图标不算）
    expect(screen.getByLabelText('匹配分未知').querySelector('svg')).toBeNull();
    // 同一用例里的两块卡共用 document.body：先卸载未知分卡，别让它的占位串进下一个断言
    无分宿主.unmount();

    const 零分宿主 = render(<求职推荐卡
      公司="云帆科技" 公司简介="未上市" 公司首字="云"
      职位="资深后端工程师" 薪资="20-40K" 标签={['上海']}
      匹配分={0}
      发布人="企业直招" 发布人首字="企" 发布人底色="#5b7a9a" 发布人字色="#fff"
      已委托={false} 委托禁用={false} 委托={vi.fn()} 打开={vi.fn()}
    />);
    expect(零分宿主.getByRole('img', { name: '适配 0 分' })).toBeTruthy();
    expect(零分宿主.queryByLabelText('匹配分未知')).toBeNull();
  });

  it('公司首字 null 走中性空位：不渲染字标、不按公司名命中静态标；公司/简介 null 给未知占位', () => {
    const 宿主 = render(<求职推荐卡
      公司={null} 公司简介={null} 公司首字={null}
      职位="AI 产品实习生" 薪资="300-500 元/天" 标签={['上海']}
      匹配分={null}
      发布人={null} 发布人首字={null} 发布人底色="#5b7a9a" 发布人字色="#fff"
      已委托={false} 委托禁用={false} 委托={vi.fn()} 打开={vi.fn()}
    />);
    expect(screen.getByLabelText('公司图片未知')).toBeTruthy();
    expect(screen.getByText('公司信息未知')).toBeTruthy();
    expect(screen.getByText('公司简介未知')).toBeTruthy();
    expect(screen.getByText('发布人未知')).toBeTruthy();
    // 卡面一个图请求都没有：不渲染字标元素，也不发空 URL / 外部占位图
    expect(宿主.container.querySelectorAll('img')).toHaveLength(0);
    // 冻结的职位/薪资照常
    expect(screen.getByText('AI 产品实习生')).toBeTruthy();
    expect(screen.getByText('300–500 元/天')).toBeTruthy();
  });

  it('空串不是 null：市场页既有空段渲染逐字不变，不出占位文字', () => {
    const 宿主 = render(<求职推荐卡
      公司="云衢科技" 公司简介="" 公司首字="云"
      职位="AI 产品实习生" 薪资="300-500 元/天" 标签={[]}
      匹配分={87}
      发布人="" 发布人首字="" 发布人底色="#5b7a9a" 发布人字色="#fff"
      已委托={false} 委托禁用={false} 委托={vi.fn()} 打开={vi.fn()}
    />);
    expect(screen.queryByText('公司简介未知')).toBeNull();
    expect(screen.queryByText('发布人未知')).toBeNull();
    expect(宿主.container.querySelectorAll('img')).toHaveLength(0);
    expect(screen.getByRole('img', { name: '适配 87 分' })).toBeTruthy();
  });

  it('委托禁用时去谈键不可点：点击不调用委托回调', () => {
    const { 属性 } = 渲染卡({ 委托禁用: true });
    const 去谈键 = screen.getByRole('button', { name: '让AI代理去谈' }) as HTMLButtonElement;
    expect(去谈键.disabled).toBe(true);
    fireEvent.click(去谈键);
    expect(属性.委托).not.toHaveBeenCalled();
    expect(属性.打开).not.toHaveBeenCalled();
  });
});

describe('求职推荐卡 · 发布人头像（展示本地状态）', () => {
  it('给 发布人图片URL 出真实图；加载失败回中性色块首字位；换 URL 清除失败状态', () => {
    const { 属性, 宿主 } = 渲染卡({ 发布人图片URL: 'https://cdn.example.com/a.png' });
    const 图 = 宿主.container.querySelector('img');
    expect(图?.getAttribute('src')).toBe('https://cdn.example.com/a.png');
    expect(screen.queryByText('企')).toBeNull(); // 有真实图就不叠首字
    fireEvent.error(图 as Element);
    expect(宿主.container.querySelector('img')).toBeNull();
    expect(screen.getByText('企')).toBeTruthy(); // 中性色块 + 首字回退
    fireEvent.click(screen.getByRole('button', { name: '让AI代理去谈' }));
    expect(属性.委托).toHaveBeenCalledTimes(1);

    // 换 URL 清除失败：重新出图（换 URL 清除失败状态是既有市场卡行为）
    const 换图宿主 = render(<求职推荐卡
      公司="云帆科技" 公司简介="未上市" 公司首字="云"
      职位="资深后端工程师" 薪资="20-40K" 标签={[]}
      匹配分={94}
      发布人="企业直招" 发布人首字="企" 发布人底色="#5b7a9a" 发布人字色="#fff"
      发布人图片URL="https://cdn.example.com/坏.png"
      已委托={false} 委托禁用={false} 委托={vi.fn()} 打开={vi.fn()}
    />);
    fireEvent.error(换图宿主.container.querySelector('img') as Element);
    expect(换图宿主.container.querySelector('img')).toBeNull();
    换图宿主.rerender(<求职推荐卡
      公司="云帆科技" 公司简介="未上市" 公司首字="云"
      职位="资深后端工程师" 薪资="20-40K" 标签={[]}
      匹配分={94}
      发布人="企业直招" 发布人首字="企" 发布人底色="#5b7a9a" 发布人字色="#fff"
      发布人图片URL="https://cdn.example.com/b.png"
      已委托={false} 委托禁用={false} 委托={vi.fn()} 打开={vi.fn()}
    />);
    expect(换图宿主.container.querySelector('img[src="https://cdn.example.com/b.png"]'))
      .toBeTruthy();
  });

  it('Mock 未传图片 URL 保持原语义：无图请求，公司字标/发布人首字位照旧', () => {
    const 宿主 = render(<求职推荐卡
      公司="云帆科技" 公司简介="未上市" 公司首字="云"
      职位="资深后端工程师" 薪资="20-40K" 标签={[]}
      匹配分={94}
      发布人="企业直招" 发布人首字="企" 发布人底色="#5b7a9a" 发布人字色="#fff"
      已委托={false} 委托禁用={false} 委托={vi.fn()} 打开={vi.fn()}
    />);
    expect(宿主.container.querySelectorAll('img')).toHaveLength(0);
    expect(screen.getByText('云')).toBeTruthy();
    expect(screen.getByText('企')).toBeTruthy();
  });
});
