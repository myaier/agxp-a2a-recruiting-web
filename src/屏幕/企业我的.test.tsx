// 企业我的 · Backend 身份行组件测试（P1C Task 3 Step 1）。
// Backend：头像行只读 从BFF招聘身份() 的 view model（公司 = current affiliation / 未认证声明，
// 个人与任职状态分开、不从公司名非空推导 verified）；Mock：仍读 企业认证 fixture。
// P6 Task 7 追加：代理卡上的规则计数只在 Mock 或 recruiter rules 已水合时显示，
// 未水合不出 Mock 数字；水合后只数 生效:true 的规则。
// Backend MatchCase 精确统计追加：在谈/待拍板/意向达成 读当前 recruiter owner 的
// summary 精确统计（注册 summary scope + 挂载刷新），在招岗位仍来自 Job；
// 企业候选列表 不再进入 Backend 展示；Mock 保留原型统计且零 summary operation 调用。
// 2026-09-14 追加：头像行改代表招聘者本人 —— 主标题非空实名→非空公开名→「完善招聘名片」
// （企业信息不参与名字判定），头像读 avatarUrl（Mock 招聘头像）、无图或 error 回退有效
// 姓名首字、缺名给中性「人」；职务/公司下移成独立行、非空才显示；图片失败态限定于
// 主体+URL（URL 更新/切主体重挂载重置，旧图迟到 error 不污染新图）；Mock 同样用本人名。

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 企业我的 from './企业我的';
import { BFF企业关系样本, BFF招聘方档案样本, BFF主体样本 } from '../测试/BFF样本';
import { P5范围键 } from '../状态/后端/MatchCase操作';
import { 路径 } from '../路由/路径表';
import type { P5摘要快照 } from '../状态/后端/类型';

const mock派发 = vi.fn();
const mock跳转 = vi.fn();
// 稳定 operation spy：生产 Provider 的 操作 引用稳定，桩宿主同样给恒定表
const mock设置P5范围 = vi.fn();
const mock加载摘要 = vi.fn(async () => undefined);
// 两套 fixture 共用同一个 操作 引用：换 fixture 不换引用，否则屏幕的 summary effect
// 会把「操作对象变了」误判成需要权威刷新（rerender 生命周期用例依赖这一点）
const 操作桩 = { 设置P5范围: mock设置P5范围, 加载摘要: mock加载摘要 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转 }) }));

/** 规则计数种子：一条生效 + 一条停用 —— 数出 2 就是没按 生效:true 过滤 */
const 招聘规则种子 = [
  { 编号: 'R-01', 内容: '必须双休', 来源: '筛选设定', 生效: true },
  { 编号: 'R-02', 内容: '五年以上经验', 来源: '筛选设定', 生效: false },
];

// ── 当前 recruiter owner 的权威 summary fixture（decoder 归一化形状）──
function 成功招聘摘要(ownerSubjectId = 'sub_recruiter'): P5摘要快照 {
  return {
    ownerSubjectId, 阶段: '成功', 刷新中: false,
    summary: {
      openTotal: 52,
      openAnonymousScreeningTotal: 18,
      openNeedsActionTotal: 8,
      endedTotal: 6,
      completedTotal: 5,
    },
    error: null,
    generation: 1,
  };
}

/** 屏幕消费的共享字段补空数组；组织身份字段由用例按 Backend 事实覆写。
 *  主体编号 参数供「切主体」用例换成另一个 recruiter subject。 */
function 置Backend应用状态(
  组织: Record<string, unknown> = {},
  招聘规则阶段 = '未开始',
  P5摘要?: P5摘要快照,
  主体编号 = 'sub_recruiter',
) {
  mock应用状态 = {
    状态: {
      岗位列表: [],
      企业候选列表: [],
      企业规则: [],
      招聘方档案: BFF招聘方档案样本,
      企业关系列表: [],
      当前企业关系编号: null,
      企业管理员申请列表: [],
      未认证公司声明: '',
      ...组织,
    },
    派发: mock派发,
    数据源模式: 'backend',
    操作: 操作桩,
    后端状态: {
      主体: { ...BFF主体样本, subject_id: 主体编号, last_used_role: 'recruiter' },
      Agent规则水合: {
        candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: 招聘规则阶段, proposals: '未开始' },
      },
      P5摘要: P5摘要 === undefined ? {} : { recruiter: P5摘要 },
    },
  };
}

function 置Mock应用状态(组织: Record<string, unknown> = {}) {
  mock应用状态 = {
    状态: {
      岗位列表: [],
      企业候选列表: [],
      企业规则: [],
      企业认证: { 姓名: '邵铭', 公司: '云衢科技', 职务: '技术 VP' },
      ...组织,
    },
    派发: mock派发,
    数据源模式: 'mock',
    操作: 操作桩,
    后端状态: {
      主体: null,
      Agent规则水合: {
        candidate: { rules: '未开始', proposals: '未开始' },
        recruiter: { rules: '未开始', proposals: '未开始' },
      },
      P5摘要: {},
    },
  };
}

beforeEach(() => {
  mock设置P5范围.mockClear();
  mock加载摘要.mockClear();
});

describe('企业我的 · Backend 映射身份行', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    置Backend应用状态();
  });

  it('只显示映射后的公司与个人/任职状态，公司来自 current affiliation', () => {
    置Backend应用状态({
      企业关系列表: [
        { ...BFF企业关系样本, organization_display_name: '后端映射科技' },
      ],
      当前企业关系编号: 'aff_1',
    });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText('后端映射科技')).toBeTruthy();
    expect(screen.getByText('个人：未认证')).toBeTruthy();
    expect(screen.getByText('任职：已认证')).toBeTruthy();
  });

  it('不从公司名非空推导 verified：无关系时显示声明公司与未认证事实', () => {
    置Backend应用状态({ 企业关系列表: [], 未认证公司声明: '声明科技' });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText('声明科技')).toBeTruthy();
    expect(screen.getByText('个人：未认证')).toBeTruthy();
    expect(screen.getByText('任职：无')).toBeTruthy();
  });

  it('verified 个人与 pending 任职各自如实展示', () => {
    置Backend应用状态({
      招聘方档案: {
        ...BFF招聘方档案样本,
        personal_verification_status: 'verified',
        verified_name: '林澈真名',
      },
      企业关系列表: [{ ...BFF企业关系样本, status: 'pending' }],
      当前企业关系编号: null,
    });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText('个人：已认证')).toBeTruthy();
    expect(screen.getByText('任职：无')).toBeTruthy();
  });
});

describe('企业我的 · Mock 保持原 fixture', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
    置Mock应用状态();
  });

  it('Mock 仍读企业认证 fixture，不出现 Backend 状态行', () => {
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText('云衢科技')).toBeTruthy();
    expect(screen.getByText('招聘名片 ✎')).toBeTruthy();
    expect(screen.queryByText('个人：未认证')).toBeNull();
    expect(screen.queryByText('任职：已认证')).toBeNull();
  });
});

describe('企业我的 · Backend 权威 MatchCase 统计', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
  });

  it('在招岗位仍读 Job；其余三项读 recruiter summary；代理卡不追加 MatchCase 文案', async () => {
    置Backend应用状态(
      { 岗位列表: [{ 编号: 'J-1', 名称: 'AI 产品实习生', 状态: '在招', 薪资带: '300-500 元/天' }] },
      '未开始',
      成功招聘摘要(),
    );
    const { unmount } = render(<MemoryRouter><企业我的 /></MemoryRouter>);
    for (const text of ['1', '52', '8', '5', '在招岗位', '在谈', '待拍板', '意向达成']) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByText('1 个在招岗位')).toBeTruthy();
    expect(screen.queryByText(/MatchCase/)).toBeNull();
    await waitFor(() => expect(mock设置P5范围)
      .toHaveBeenCalledWith('recruiter', P5范围键.summary('recruiter')));
    expect(mock加载摘要).toHaveBeenCalledWith('recruiter');
    unmount();
    expect(mock设置P5范围).toHaveBeenLastCalledWith('recruiter', null);
  });

  it('点击待拍板仍派发 企业看全部在谈/待我拍板', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    置Backend应用状态({}, '未开始', 成功招聘摘要());
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /待拍板/ }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '企业看全部在谈', 档: '待我拍板' });
  });

  it('企业候选列表不进入 Backend 展示：旧 owner summary 显示 —', () => {
    置Backend应用状态(
      { 企业候选列表: [{ 编号: 'A-01' }, { 编号: 'A-02' }] },
      '未开始',
      成功招聘摘要('sub_old'),
    );
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(mock派发).not.toHaveBeenCalled();
  });

  it('Mock 统计保持原口径（企业候选列表），零 P5 operation 调用', () => {
    置Mock应用状态({
      企业候选列表: [
        { 编号: 'A-01', 需要你: true, 阶段: '匿名初筛' },
        { 编号: 'A-02', 需要你: false, 阶段: '意向确认' },
      ],
    });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(mock设置P5范围).not.toHaveBeenCalled();
    expect(mock加载摘要).not.toHaveBeenCalled();
    expect(screen.getByText('2')).toBeTruthy(); // 在谈 = 企业候选列表.length
    expect(screen.getAllByText('1')).toHaveLength(2); // 待拍板 = 需要你的 1 条 + 意向达成 = 意向确认 1 条
  });
});

// Backend 没有 runtime presence/status 合同：代理卡不说「在线 · 并行寻访」，只说
// 权威「N 个在招岗位」；占位运营页脚只在 Mock 渲染。指向同一 /hr/jobs 的
// 「归档岗位」宫格从两种模式删除，「岗位管理」入口唯一。
describe('企业我的 · Backend 代理卡事实与归档入口去重', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
  });

  it('Backend 代理卡显示在招岗位事实，无在线断言与占位运营页脚', () => {
    置Backend应用状态({
      岗位列表: [{ 编号: 'J-1', 名称: 'AI 产品实习生', 状态: '在招', 薪资带: '300-500 元/天' }],
    });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText('1 个在招岗位')).toBeTruthy();
    for (const text of ['在线', '并行寻访', '400-000-0000', '人力资源服务许可证', '资质证照']) {
      expect(screen.queryByText(new RegExp(text))).toBeNull();
    }
  });

  it('岗位管理入口唯一：归档岗位重复宫格已删除', () => {
    置Backend应用状态();
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getAllByText('岗位管理')).toHaveLength(1);
    expect(screen.queryByText('归档岗位')).toBeNull();
  });

  it('Mock 保留原型在线文案与页脚，归档岗位同样不出现', () => {
    置Mock应用状态();
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText(/在线 · 正为 \d+ 个岗位并行寻访/)).toBeTruthy();
    expect(screen.getByText(/服务热线 400-000-0000/)).toBeTruthy();
    expect(screen.getAllByText('岗位管理')).toHaveLength(1);
    expect(screen.queryByText('归档岗位')).toBeNull();
  });
});

describe('企业我的 · 代理卡规则计数的水合门控（P6 Task 7）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
  });

  it('Backend rules 未水合时不出 Mock 规则计数', () => {
    置Backend应用状态({ 企业规则: 招聘规则种子 });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.queryByText(/规则 \d+ 条生效/)).toBeNull();
  });

  it('Backend rules 水合成功后只数 生效:true 的规则', () => {
    置Backend应用状态({ 企业规则: 招聘规则种子 }, '成功');
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText(/规则 1 条生效/)).toBeTruthy();
  });

  it('Mock 计数保持原口径：同样只数 生效:true 的规则', () => {
    置Mock应用状态({ 企业规则: 招聘规则种子 });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText(/规则 1 条生效/)).toBeTruthy();
  });
});

// ── 2026-09-14：头像行代表招聘者本人。主标题非空实名→非空公开名→「完善招聘名片」
//    （有无企业不参与名字判定），职务/公司独立行、非空才显示，原个人验证与任职标签
//    和整行跳 招聘名片 保留；Mock 同样用本人名（企业认证.姓名）而非公司。──
describe('企业我的 · 招聘者本人头像与姓名（Backend）', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
  });

  /** 默认带一家已认证公司（后端映射科技），用例按需覆写档案字段。 */
  function 置身份(档案覆写: Record<string, unknown>) {
    置Backend应用状态({
      招聘方档案: { ...BFF招聘方档案样本, ...档案覆写 },
      企业关系列表: [{ ...BFF企业关系样本, organization_display_name: '后端映射科技' }],
      当前企业关系编号: 'aff_1',
    });
  }

  it('实名优先于公开名，头像走 avatar_url 与 alt，职务与公司独立行，标签与跳转保留', () => {
    置身份({
      personal_verification_status: 'verified',
      verified_name: '林澈真名',
      avatar_url: 'https://cdn.example.com/recruiter.png',
    });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText('林澈真名')).toBeTruthy();
    expect(screen.queryByText('林澈')).toBeNull();
    const 图 = screen.getByAltText('招聘者头像') as HTMLImageElement;
    expect(图.getAttribute('src')).toBe('https://cdn.example.com/recruiter.png');
    expect(screen.getByText('招聘负责人')).toBeTruthy();
    expect(screen.getByText('后端映射科技')).toBeTruthy();
    expect(screen.getByText('个人：已认证')).toBeTruthy();
    expect(screen.getByText('任职：已认证')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /林澈真名/ }));
    expect(mock跳转).toHaveBeenCalledWith(路径.招聘名片);
  });

  it('无实名显示公开名，无图时头像取有效姓名首字（不是公司首字）', () => {
    置身份({ verified_name: null, avatar_url: null });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText('林澈')).toBeTruthy();
    expect(screen.queryByAltText('招聘者头像')).toBeNull();
    expect(screen.getByText('林')).toBeTruthy();
    expect(screen.queryByText('后')).toBeNull();
  });

  it('首字回退取首个 Unicode 字符（代理对不拆散）', () => {
    置身份({ verified_name: '𠀀安', avatar_url: null });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText('𠀀安')).toBeTruthy();
    expect(screen.getByText('𠀀')).toBeTruthy();
  });

  it('姓名缺失：主标题给完善招聘名片，头像占位用中性「人」', () => {
    置身份({ verified_name: null, public_name: '', avatar_url: null });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText('完善招聘名片')).toBeTruthy();
    expect(screen.getByText('人')).toBeTruthy();
  });

  it('无企业但有名片：不伪造公司行，主标题仍是本人名且整行可进名片', () => {
    置Backend应用状态({
      招聘方档案: { ...BFF招聘方档案样本, verified_name: '林澈真名' },
      企业关系列表: [],
      当前企业关系编号: null,
      未认证公司声明: '',
    });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText('林澈真名')).toBeTruthy();
    expect(screen.getByText('招聘负责人')).toBeTruthy();
    expect(screen.queryByText(/科技/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /林澈真名/ }));
    expect(mock跳转).toHaveBeenCalledWith(路径.招聘名片);
  });

  it('职务为空时该段不出，公司仍独立显示', () => {
    置身份({ title: '' });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.queryByText('招聘负责人')).toBeNull();
    expect(screen.getByText('后端映射科技')).toBeTruthy();
  });
});

describe('企业我的 · Mock 同样用本人名与招聘头像', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
  });

  it('主标题是企业认证.姓名而非公司，头像读 招聘头像，仍整行进名片', () => {
    置Mock应用状态({ 招聘头像: 'data:image/png;base64,QQ==' });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText('邵铭')).toBeTruthy();
    const 图 = screen.getByAltText('招聘者头像') as HTMLImageElement;
    expect(图.getAttribute('src')).toBe('data:image/png;base64,QQ==');
    expect(screen.getByText('技术 VP')).toBeTruthy();
    expect(screen.getByText('云衢科技')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /邵铭/ }));
    expect(mock跳转).toHaveBeenCalledWith(路径.招聘名片);
  });

  it('无招聘头像显示姓名首字；姓名缺失时占位「人」与完善招聘名片，公司仍如实显示', () => {
    置Mock应用状态({ 企业认证: { 姓名: '', 公司: '云衢科技', 职务: '' } });
    render(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect(screen.getByText('完善招聘名片')).toBeTruthy();
    expect(screen.getByText('人')).toBeTruthy();
    expect(screen.getByText('云衢科技')).toBeTruthy();
  });
});

// ── 图片失败态只属于「当前主体+当前URL」的实例：URL 更新或切主体后新图允许加载，
//    旧 img 节点迟到的 error 不污染新图；头像生命周期不产生任何新请求
//    （原 summary 挂载/换主体刷新不计为新增）。──
describe('企业我的 · 头像生命周期限定于主体+URL', () => {
  beforeEach(() => {
    mock派发.mockClear();
    mock跳转.mockClear();
  });

  function 置头像档案(avatarUrl: string | null, 主体编号 = 'sub_recruiter') {
    置Backend应用状态(
      { 招聘方档案: { ...BFF招聘方档案样本, verified_name: '林澈真名', avatar_url: avatarUrl } },
      '未开始',
      undefined,
      主体编号,
    );
  }

  it('URL 更新后新图加载，旧图迟到 error 不污染新图；除原 summary 加载外零新增请求', () => {
    置头像档案('https://cdn.example.com/a-1.png');
    const { rerender } = render(<MemoryRouter><企业我的 /></MemoryRouter>);
    const 旧图 = screen.getByAltText('招聘者头像') as HTMLImageElement;
    expect(旧图.getAttribute('src')).toBe('https://cdn.example.com/a-1.png');
    expect(mock加载摘要).toHaveBeenCalledTimes(1); // 原 summary 挂载加载

    置头像档案('https://cdn.example.com/a-2.png');
    rerender(<MemoryRouter><企业我的 /></MemoryRouter>);
    const 新图 = screen.getByAltText('招聘者头像') as HTMLImageElement;
    expect(新图.getAttribute('src')).toBe('https://cdn.example.com/a-2.png');
    fireEvent.error(旧图);
    expect(screen.getByAltText('招聘者头像')).toBe(新图);
    expect(mock加载摘要).toHaveBeenCalledTimes(1);
    expect(mock设置P5范围).toHaveBeenCalledTimes(1);
  });

  it('当前 URL 的图 error 后回退姓名首字；URL 再更新时失败态重置、新图重新显示', () => {
    置头像档案('https://cdn.example.com/a-1.png');
    const { rerender } = render(<MemoryRouter><企业我的 /></MemoryRouter>);
    fireEvent.error(screen.getByAltText('招聘者头像'));
    expect(screen.queryByAltText('招聘者头像')).toBeNull();
    expect(screen.getByText('林')).toBeTruthy();

    置头像档案('https://cdn.example.com/a-2.png');
    rerender(<MemoryRouter><企业我的 /></MemoryRouter>);
    expect((screen.getByAltText('招聘者头像') as HTMLImageElement).getAttribute('src'))
      .toBe('https://cdn.example.com/a-2.png');
  });

  it('切主体：key 变化重挂载头像，新主体 URL 的图加载，旧图 error 不污染；summary 按原栅栏随主体刷新', () => {
    置头像档案('https://cdn.example.com/a-1.png');
    const { rerender } = render(<MemoryRouter><企业我的 /></MemoryRouter>);
    const 旧图 = screen.getByAltText('招聘者头像') as HTMLImageElement;

    置头像档案('https://cdn.example.com/a-2.png', 'sub_next');
    rerender(<MemoryRouter><企业我的 /></MemoryRouter>);
    const 新图 = screen.getByAltText('招聘者头像') as HTMLImageElement;
    expect(新图.getAttribute('src')).toBe('https://cdn.example.com/a-2.png');
    fireEvent.error(旧图);
    expect(screen.getByAltText('招聘者头像')).toBe(新图);
    // 换主体的 summary 权威刷新是原有行为（挂载+换主体各一次），其余零请求
    expect(mock加载摘要).toHaveBeenCalledTimes(2);
    expect(mock加载摘要).toHaveBeenCalledWith('recruiter');
  });
});
