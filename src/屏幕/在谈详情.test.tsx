// 在谈详情 · P5 Task 5：Backend 分支的接线契约（旧 P1C「公司槽只读」面随 P5 详情整体退场）。
// Backend 下这一屏只渲染共享 P5 详情（屏幕/P5/MatchCase详情）：按 URL case_id + 已认证角色
// 强制读详情，不读 在谈列表、不水合 Mock 在谈单、不调公司档案/企业详情导航，匹配对齐卡与
// 职位详情 Tab（P5.1 依赖）不再出现；Mock 分支仍按原 slug 导航、行为与接线前逐字一致。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 在谈详情 from './在谈详情';
import { 在谈列表 } from '../数据/模拟数据';
import type { 在谈单 } from '../数据/类型';
import { P5范围键 } from '../状态/后端/MatchCase操作';
import { 路径 } from '../路由/路径表';

// jsdom 不实现 scrollIntoView，本屏挂载后自动定位会调用它
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

const mock跳转 = vi.fn();
const mock返回 = vi.fn();
const mock派发 = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({ 返回: mock返回, 跳转: mock跳转 }),
}));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

const { mock公司路由键, mock取公司档案 } = vi.hoisted(() => {
  const 静态档案 = {
    键: 'douyin',
    名称: '抖音',
    首字: '抖',
    规模行: '未上市 · 10000 人以上 · 短视频与内容平台',
    地址: '北京市海淀区北三环西路甲 18 号',
    简介: ['短视频与内容平台'],
    工商信息: [{ 项: '成立日期', 值: '2016-03-01' }],
  };
  return {
    mock公司路由键: vi.fn((名称: string) => `slug-${名称}`),
    mock取公司档案: vi.fn(() => 静态档案),
  };
});
vi.mock('../数据/公司档案', () => ({
  公司路由键: mock公司路由键,
  取公司档案: mock取公司档案,
}));

const mock设置P5范围 = vi.fn();
const mock读取详情 = vi.fn(async () => undefined);
const mock新增叮嘱 = vi.fn(async () => undefined);

const 本单 = 在谈列表.find((条) => 条.编号 === 'J-01')!;

/** 渲染在 J-01 的详情路由（Backend 分支下 ?tab=job 已无对应 Tab，参数被忽略） */
function 渲染详情页() {
  return render(
    <MemoryRouter initialEntries={['/deal/J-01?tab=job']}>
      <Routes>
        <Route path="/deal/:id" element={<在谈详情 />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Mock 分支用：渲染在 J-01 的「职位详情」Tab（与真人会话「看职位」同一落点） */
function 渲染职位Tab() {
  return render(
    <MemoryRouter initialEntries={['/deal/J-01?tab=job']}>
      <Routes>
        <Route path="/deal/:id" element={<在谈详情 />} />
      </Routes>
    </MemoryRouter>,
  );
}

function 断言匹配卡在条件段与公司之前() {
  const 匹配卡标题 = screen.getByText('匹配度分析');
  const 职位要求 = screen.getAllByText('职位要求')[0];
  const 公司名 = screen.getByText(本单.公司);
  expect(匹配卡标题).toBeTruthy();
  expect(匹配卡标题.compareDocumentPosition(职位要求) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(匹配卡标题.compareDocumentPosition(公司名) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe('在谈详情 · Backend 分支渲染共享 P5 详情', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock派发.mockClear();
    mock公司路由键.mockClear();
    mock取公司档案.mockClear();
    mock设置P5范围.mockClear();
    mock读取详情.mockClear();
    mock新增叮嘱.mockClear();
    mock应用状态 = {
      状态: {
        在谈列表,
        决策: {},
        决策快照: {},
        叮嘱表: {},
        简历文件名: '',
        简历经历: [],
        简历教育: [],
        简历技能: [],
      },
      派发: mock派发,
      数据源模式: 'backend',
      后端状态: {
        已登录: true,
        主体: {
          subject_id: 'sub_1',
          roles: [{ role: 'candidate', status: 'active' }],
          last_used_role: 'candidate',
        },
        P5详情: {},
      },
      操作: {
        设置P5范围: mock设置P5范围,
        读取详情: mock读取详情,
        新增叮嘱: mock新增叮嘱,
      },
    };
  });

  it('按 URL case_id 强制读 P5 详情；不读公司档案、不跳企业详情、P5.1 面整体退场', () => {
    渲染详情页();
    expect(mock设置P5范围).toHaveBeenCalledWith('candidate', P5范围键.detail('candidate', 'J-01'));
    expect(mock读取详情).toHaveBeenCalledWith('candidate', 'J-01', true);
    // 旧 Backend 公司槽/匹配对齐卡/职位详情 Tab（P5.1 依赖）不再渲染，也不再请求
    expect(mock取公司档案).not.toHaveBeenCalled();
    expect(mock公司路由键).not.toHaveBeenCalled();
    expect(mock跳转.mock.calls.every(([目标]) => !String(目标).startsWith('/company/'))).toBe(true);
    expect(screen.queryByText('匹配度分析')).toBeNull();
    expect(screen.queryByRole('button', { name: '职位详情' })).toBeNull();
    expect(screen.queryByText(本单.公司)).toBeNull(); // Mock 在谈单不进 Backend 视图
    expect(screen.getByText('正在读入这一单…')).toBeTruthy();
  });
});

describe('在谈详情 · Mock 公司卡仍按原 slug 导航', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock派发.mockClear();
    mock公司路由键.mockClear();
    mock取公司档案.mockClear();
    mock应用状态 = {
      状态: {
        在谈列表,
        决策: {},
        决策快照: {},
        叮嘱表: {},
        简历文件名: '',
        简历经历: [],
        简历教育: [],
        简历技能: [],
      },
      派发: mock派发,
    };
  });

  it('公司卡可点，跳 公司路由键 生成的原 slug', async () => {
    渲染职位Tab();
    断言匹配卡在条件段与公司之前();
    // ?tab=job 落在共用外壳的 资料 槽（职位详情 Tab），进度/资料 两个 Tab 由外壳给出
    expect(screen.getByRole('button', { name: '进度' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '资料' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: new RegExp(本单.公司) }));
    expect(mock公司路由键).toHaveBeenCalledWith(本单.公司);
    expect(mock跳转).toHaveBeenCalledWith(`/company/slug-${本单.公司}`);
  });

  it('资料 Tab 用共用 职位资料 渲染连接层投影：摘要/JD/要求/公司五元行/标签/对接人齐备', () => {
    渲染职位Tab();
    // 岗位摘要如实展示冻结事实；在谈单没有独立城市字段，位置取卡片位置标签原文
    // （J-01 在意向确认态，顶栏标题同文案，所以职位用 getAllByText）
    expect(screen.getAllByText(本单.职位).length).toBeGreaterThan(0);
    expect(screen.getByText('上海 · 浦东')).toBeTruthy();
    // 技能标签来自证据源的 JD 技能要求：同一词在 岗位摘要标签区 与 匹配分析要求行 各出现一次
    expect(screen.getAllByText('稳定性治理').length).toBe(2);
    // JD 正文/要求来自 取在谈岗位详情（连接层已把静态查询做掉）
    expect(screen.getByText('1、负责电商交易链路的网关与清结算服务，支撑大促峰值下的下单与退款；')).toBeTruthy();
    // 公司五元行由公司档案投影（档案规模行认段 + 工商信息成立 + 地址），公司标签区保留
    expect(screen.getByText('未上市')).toBeTruthy();
    expect(screen.getByText('10000 人以上')).toBeTruthy();
    expect(screen.getByText('2016 年')).toBeTruthy();
    expect(screen.getByText('北京市海淀区北三环西路甲 18 号')).toBeTruthy();
    expect(screen.getByText('混合 3+2')).toBeTruthy();
    // 对接人原位渲染（不再按取不到就整卡隐藏）
    expect(screen.getByText('林筱')).toBeTruthy();
    expect(screen.getByText('招聘顾问')).toBeTruthy();
  });
});

// ── 详情统一 Task 8：Mock 协调/意向卡接共用 详情动作卡（事实块进正文槽，控制留连接层）──
// 接受/退出/确认仍派发原全局动作与规则入口，零 P5 请求；同一语义按钮只有一套 renderer。
describe('在谈详情 · Mock 决策卡共用详情动作卡（Task 8）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock派发.mockClear();
    mock设置P5范围.mockClear();
    mock读取详情.mockClear();
    mock新增叮嘱.mockClear();
    mock应用状态 = {
      数据源模式: 'mock',
      状态: {
        在谈列表,
        决策: {},
        决策快照: {},
        叮嘱表: {},
        简历文件名: '',
        简历经历: [],
        简历教育: [],
        简历技能: [],
      },
      派发: mock派发,
      操作: {
        设置P5范围: mock设置P5范围,
        读取详情: mock读取详情,
        新增叮嘱: mock新增叮嘱,
      },
    };
  });

  /** 渲染在指定单的详情路由（Mock 分支） */
  function 渲染Mock详情(编号: string) {
    return render(
      <MemoryRouter initialEntries={[`/deal/${编号}`]}>
        <Routes>
          <Route path="/deal/:id" element={<在谈详情 />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('J-02 协调卡走共用卡：卡点决策标题与分歧对比在场；接受 → 原型派发 接受方案 + 拿不准弹层（记成规则仍派发 新增规则）', async () => {
    const user = userEvent.setup();
    渲染Mock详情('J-02');
    expect(screen.getByText('卡点决策')).toBeTruthy(); // 共用卡的标题（详情动作卡）
    expect(screen.getByText('你的条件')).toBeTruthy(); // 分歧对比事实块进正文槽
    expect(screen.getByText('团队大小周')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '接受' }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '接受方案', 编号: 'J-02' });
    await user.click(await screen.findByRole('button', { name: '记成规则' }));
    expect(mock派发).toHaveBeenCalledWith(
      expect.objectContaining({ 型: '新增规则', 来源: '来自小红书单的决策 · 第 2 轮' }),
    );
    // Mock 剧情连接层绝不经 P5 通道
    expect(mock设置P5范围).not.toHaveBeenCalled();
    expect(mock读取详情).not.toHaveBeenCalled();
  });

  it('J-02 退出：不接受 → 二次确认 → 原型派发 退出谈判', async () => {
    const user = userEvent.setup();
    渲染Mock详情('J-02');
    await user.click(screen.getByRole('button', { name: '不接受' }));
    expect(screen.getByText('退出「平台架构师 · 小红书」？')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '退出' }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '退出谈判', 编号: 'J-02' });
  });

  it('J-01 意向卡走共用卡：确认 → 原型派发 确认意向 + 直达真人会话', async () => {
    const user = userEvent.setup();
    渲染Mock详情('J-01');
    expect(screen.getByText('对方已确认意向，等你点头。')).toBeTruthy();
    expect(screen.getByText('双方确认后进入真人沟通与约面')).toBeTruthy(); // 确认警示事实块仍在场
    await user.click(screen.getByRole('button', { name: '开始私聊 ›' }));
    expect(mock派发).toHaveBeenCalledWith({ 型: '确认意向', 编号: 'J-01' });
    expect(mock跳转).toHaveBeenCalledWith(路径.真人会话);
  });

  it('已确认（需要你 false）：按钮只去私聊，零派发', async () => {
    const user = userEvent.setup();
    mock应用状态 = {
      ...mock应用状态,
      状态: {
        ...mock应用状态.状态,
        在谈列表: 在谈列表.map((单): 在谈单 =>
          单.编号 === 'J-01' ? { ...单, 需要你: false } : 单,
        ),
      },
    };
    渲染Mock详情('J-01');
    expect(screen.getByText('双方已确认意向。')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '开始私聊 ›' }));
    expect(mock跳转).toHaveBeenCalledWith(路径.真人会话);
    expect(mock派发).not.toHaveBeenCalled();
  });
});

// ── 详情统一 Task 9：Mock 终局只读（spec §5「Mock 同类终局也只读」）──
// 判断只消费本屏已有的完成/归档事实：归档 = 已移出在谈列表（本屏靠快照单回看），
// 完成 = 意向已确认（需要你 false）；「进入意向确认阶段」不是完成。
describe('在谈详情 · Mock 终局只读（Task 9）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock派发.mockClear();
    mock应用状态 = {
      数据源模式: 'mock',
      状态: {
        在谈列表,
        决策: {},
        决策快照: {},
        叮嘱表: {},
        简历文件名: '',
        简历经历: [],
        简历教育: [],
        简历技能: [],
      },
      派发: mock派发,
      操作: {
        设置P5范围: mock设置P5范围,
        读取详情: mock读取详情,
        新增叮嘱: mock新增叮嘱,
      },
    };
  });

  /** 渲染在指定单的详情路由（Mock 分支） */
  function 渲染Mock详情(编号: string) {
    return render(
      <MemoryRouter initialEntries={[`/deal/${编号}`]}>
        <Routes>
          <Route path="/deal/:id" element={<在谈详情 />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('进行中（已进入意向确认但未点头）：底部输入仍在 —— 不把「进入意向确认阶段」当完成', async () => {
    渲染Mock详情('J-01'); // J-01 在意向确认、需要你=true（对方已确认，等你点头）
    expect(await screen.findByText('对方已确认意向，等你点头。')).toBeTruthy();
    expect(screen.getByPlaceholderText('有想法就告诉你的AI代理')).toBeTruthy();
    expect(screen.queryByText('当前在谈已结束，仅可查看')).toBeNull();
  });

  it('意向已确认（需要你 false）：底部只读条、无输入无发送，零派发', async () => {
    mock应用状态 = {
      ...mock应用状态,
      状态: {
        ...mock应用状态.状态,
        在谈列表: 在谈列表.map((单): 在谈单 =>
          单.编号 === 'J-01' ? { ...单, 需要你: false } : 单,
        ),
      },
    };
    渲染Mock详情('J-01');
    expect(await screen.findByText('当前在谈已结束，仅可查看')).toBeTruthy();
    expect(screen.queryByPlaceholderText('有想法就告诉你的AI代理')).toBeNull();
    expect(screen.queryByRole('button', { name: '发送' })).toBeNull();
    // 移交入口（Mock 原型的开始私聊）不受影响，只是底部叮嘱只读
    expect(screen.getByRole('button', { name: '开始私聊 ›' })).toBeTruthy();
    expect(mock派发).not.toHaveBeenCalled();
  });

  it('退出归档后（快照单回看决策回执）：底部同样只读', async () => {
    const 页 = 渲染Mock详情('J-02');
    // J-02 在需要协调等你拍板：输入在场（占位走协调分支）
    expect(screen.getByPlaceholderText('你的条件是什么？直接告诉代理')).toBeTruthy();
    // 退出谈判把单移出在谈列表（reducer 落归档表）；本屏留快照单回看
    mock应用状态 = {
      ...mock应用状态,
      状态: {
        ...mock应用状态.状态,
        在谈列表: 在谈列表.filter((条) => 条.编号 !== 'J-02'),
        决策: { 'J-02': '退出' },
      },
    };
    页.rerender(
      <MemoryRouter initialEntries={['/deal/J-02']}>
        <Routes>
          <Route path="/deal/:id" element={<在谈详情 />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('当前在谈已结束，仅可查看')).toBeTruthy();
    expect(screen.queryByPlaceholderText('有想法就告诉你的AI代理')).toBeNull();
    expect(screen.getByText('已告知AI代理：终止这一单，不再消耗你的匿名额度。')).toBeTruthy(); // 回执仍可回看
    页.unmount();
  });
});
