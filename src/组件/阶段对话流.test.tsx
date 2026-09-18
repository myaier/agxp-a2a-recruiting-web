// 阶段对话流 的共享渲染缝回归（S0 记录接入 Task 3）：既有 Mock 调用方零迁移 —— 数字编号
// 对话、旧小结、核对清单与用户气泡原样；Backend 段新增 string 编号与 Agent 总结槽，总结
// 只进小结托盘、不计入「N 条」。只断言 DOM 文本与数量，不依赖 CSS hash、像素或截图。

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import 阶段对话流, { type 分段项, type 段内记录 } from './阶段对话流';
import { 阶段配色 } from './通用';

afterEach(() => {
  cleanup();
});

/** 旧 Mock 形状：数字编号对话 + 旧小结 + 核对清单 + 用户气泡（调用方不传 Agent总结）。 */
function 旧Mock分段(): 分段项 {
  return {
    阶段: '匿名初筛',
    态: '当前',
    状态文: '进行中',
    小结: '双方确认了到岗范围，晚班安排仍待沟通。',
    核对清单: [
      { 项: '到岗范围已确认', 结果: '通过' },
      { 项: '晚班安排待确认', 结果: '核对中' },
    ],
    对话: [
      { 编号: 1, 方: '对方', 时间: '10:01', 内容: '每周可以到岗几天？' },
      { 编号: 2, 方: '我方', 时间: '10:03', 内容: '每周可以到岗 3 天。' },
    ],
    用户气泡: [{ 编号: 9, 我: '周五也可以到岗', 回执: '已记下你的时间偏好' }],
  };
}

describe('阶段对话流 · S0 记录渲染缝（Task 3）', () => {
  it('旧 Mock 形状不变：数字编号对话、旧小结与清单原样，条数只算对话与用户气泡', () => {
    render(<阶段对话流 分段们={[旧Mock分段()]} />);
    expect(screen.getByText('每周可以到岗几天？')).toBeTruthy();
    expect(screen.getByText('每周可以到岗 3 天。')).toBeTruthy();
    expect(screen.getByText('周五也可以到岗')).toBeTruthy();
    expect(screen.getByText('已记下你的时间偏好')).toBeTruthy();
    // 2 条对话 + 1 组用户气泡（1 话 + 1 回执）= 4 条
    expect(screen.getByText('4 条')).toBeTruthy();
    // 旧小结托盘：小结头行 + 两项清单，托盘只有一个
    const 托盘 = screen.getByText('代 理 小 结').parentElement as HTMLElement;
    expect(within(托盘).getByText('双方确认了到岗范围，晚班安排仍待沟通。')).toBeTruthy();
    expect(within(托盘).getByText('到岗范围已确认')).toBeTruthy();
    expect(within(托盘).getByText('晚班安排待确认')).toBeTruthy();
    expect(screen.getAllByText('代 理 小 结').length).toBe(1);
  });

  it('Backend 形状：string 编号对话 + 小结行们进托盘且不计入条数（小结→小结行们→清单）', () => {
    const 分段: 分段项 = {
      阶段: '匿名初筛',
      态: '当前',
      小结: '匿名初筛已通过',
      小结行们: ['公开资料匹配检查：公开初评匹配'],
      核对清单: [{ 项: '招聘类型：匹配', 结果: '通过' }],
      对话: [
        { 编号: 's0:q1', 方: '对方', 时间: '10:01', 内容: '这周需要值几个晚班？' },
        { 编号: 's0:a1', 方: '我方', 时间: '10:05', 内容: '没有固定晚班，只有周末白天偶尔需要支援。' },
      ],
    };
    render(<阶段对话流 分段们={[分段]} />);
    expect(screen.getByText('这周需要值几个晚班？')).toBeTruthy();
    expect(screen.getByText('没有固定晚班，只有周末白天偶尔需要支援。')).toBeTruthy();
    // 小结行们借 小结正文 行呈现（决定行在清单之前）
    expect(screen.getByText('公开资料匹配检查：公开初评匹配')).toBeTruthy();
    // 条数只算对话（2 条），小结行们与清单不进去
    expect(screen.getByText('2 条')).toBeTruthy();
    expect(screen.queryByText('4 条')).toBeNull();
    // 托盘内部顺序固定：旧小结 → 小结行们 → 清单
    const 头行 = screen.getByText('匿名初筛已通过');
    const 决定行 = screen.getByText('公开资料匹配检查：公开初评匹配');
    const 清单 = screen.getByText('招聘类型：匹配');
    expect(头行.compareDocumentPosition(决定行) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(决定行.compareDocumentPosition(清单) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('轮询式更新：同 ID question 保持一份、answer 追加一份；只有清单没有小结也照样有托盘', () => {
    const 仅问: 分段项 = {
      阶段: '匿名初筛',
      态: '当前',
      核对清单: [{ 项: '匿名初筛已通过', 结果: '通过' }],
      对话: [{ 编号: 's0:q1', 方: '对方', 时间: '10:01', 内容: '团队规模是多少？' }],
    };
    const 问后答: 分段项 = {
      ...仅问,
      对话: [
        { 编号: 's0:q1', 方: '对方', 时间: '10:01', 内容: '团队规模是多少？' },
        { 编号: 's0:a1', 方: '我方', 时间: '10:04', 内容: '团队一共 6 个人。' },
      ],
    };
    const 页 = render(<阶段对话流 分段们={[仅问]} />);
    const 托盘 = () => screen.getByText('代 理 小 结').parentElement as HTMLElement;
    expect(within(托盘()).getByText('匿名初筛已通过')).toBeTruthy();
    expect(screen.getByText('1 条')).toBeTruthy();

    页.rerender(<阶段对话流 分段们={[问后答]} />);
    expect(screen.getAllByText('团队规模是多少？').length).toBe(1); // 同 ID question 不重复
    expect(screen.getAllByText('团队一共 6 个人。').length).toBe(1); // answer 只一份
    expect(screen.getByText('2 条')).toBeTruthy();
  });

  it('用户版式回执的时间戳（review-r2 F4）：非空时间照常显示，null 不产生空时间节点', () => {
    render(
      <阶段对话流
        分段们={[
          {
            阶段: '匿名初筛',
            态: '当前',
            记录: [
              { kind: '气泡', 编号: 'a1', 方: '我方', 角色: '', 时间: '09:05', 内容: '本人的叮嘱', 来自: '用户' },
              { kind: '气泡', 编号: 'a2', 方: '对方', 角色: '招聘方本人', 时间: '09:06', 内容: '对端的叮嘱' },
              { kind: '气泡', 编号: 'a3', 方: '我方', 角色: '', 时间: null, 内容: '无时间的用户话', 来自: '用户' },
            ],
          },
        ]}
      />,
    );
    // 本人回执仍是荧光绿用户版式（我方右、无代理头像），但带时间；对端回执同样有时间
    const 本人 = screen.getByText('本人的叮嘱').parentElement as HTMLElement;
    expect(within(本人.parentElement as HTMLElement).getByText('09:05')).toBeTruthy();
    expect(screen.getByText('09:06')).toBeTruthy();
    // 时间 null：不渲染空时间节点（用户气泡行内只有正文）
    const 无时间 = screen.getByText('无时间的用户话').parentElement as HTMLElement;
    expect(无时间.textContent).toBe('无时间的用户话');
    expect(within(无时间.parentElement as HTMLElement).queryByText(/:/)).toBeNull();
  });

  it('段首说明：附件之下、往来记录之前的上下文行（步骤/轮次分行提示），不计入条数', () => {
    render(
      <阶段对话流
        分段们={[
          {
            阶段: '递交简历',
            态: '当前',
            段首说明: ['正在解析简历', '候选 Agent 回答中', '招聘方已问 1/3 轮'],
            附件: { 文件名: '简历_样本_v1.pdf' },
            附件常驻: true,
            记录: [{ kind: '气泡', 编号: 'q', 方: '对方', 角色: '', 时间: '10:00', 内容: '请说明职责。' }],
          },
        ]}
      />,
    );
    const 步骤 = screen.getByText('候选 Agent 回答中');
    const 轮次 = screen.getByText('招聘方已问 1/3 轮');
    const 附件 = screen.getByText('简历_样本_v1.pdf');
    const 气泡 = screen.getByText('请说明职责。');
    expect(screen.getByText('正在解析简历')).toBeTruthy();
    expect(附件.compareDocumentPosition(步骤) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(步骤.compareDocumentPosition(轮次) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(轮次.compareDocumentPosition(气泡) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('1 条')).toBeTruthy();
  });
});

describe('阶段对话流 · 展示标题（详情统一 Task 2）', () => {
  /** 阶段对话流.tsx 里同一个 展示标题 兼容缝的渲染端：默认仍是原 阶段。 */
  it('传了 展示标题：分节条（含未到达灰条）显示它；颜色胶囊仍用原 阶段 的配色', () => {
    render(
      <阶段对话流
        分段们={[
          { 阶段: '递交简历', 展示标题: '简历提交', 态: '当前', 状态文: '进行中', 对话: [{ 编号: 1, 方: '我方', 时间: '10:00', 内容: '你好' }] },
          { 阶段: '需要协调', 展示标题: '差异协同', 态: '未到达', 待推进说明: '前一阶段通过后 AI 代理自动推进' },
        ]}
      />,
    );
    // 展示标题覆盖分节条文案，原阶段名不再出现（两段都换）
    expect(screen.getByText('简历提交')).toBeTruthy();
    expect(screen.getByText('差异协同')).toBeTruthy();
    expect(screen.queryByText('递交简历')).toBeNull();
    expect(screen.queryByText('需要协调')).toBeNull();
    // 颜色/排序仍按原 阶段 查配色表：分节名与胶囊用的是 递交简历 的文字色
    const 分节名 = screen.getByText('简历提交');
    expect((分节名 as HTMLElement).style.color).toBe(阶段配色['递交简历'].文字);
  });

  it('不传 展示标题：旧调用方行为完全不变，分节条仍是阶段名', () => {
    render(<阶段对话流 分段们={[旧Mock分段()]} />);
    expect(screen.getByText('匿名初筛')).toBeTruthy();
  });
});

// ── S0–S3 连续筛选（continuity_version 2）新增的两个展示槽 ──
// 待办说明 = 正在等对端的人工待办（零按钮）；确认总结 = S3 固定总结的四节。
// （旧 Agent对话/系统消息 展示槽已被 记录 有序联合取代并移除 —— S0–S3 展示统一 Task 4）

describe('阶段对话流 · 连续筛选展示槽', () => {
  it('对端待办只显示在等谁与服务端绝对截止时刻，段内不出现任何按钮', () => {
    const 分段: 分段项 = {
      阶段: '需要协调',
      态: '当前',
      待办说明: [{
        编号: 'todo:cpa_1',
        内容: '等待招聘方回答对方的问题',
        截止说明: '截止 2026-09-18 10:00 · 逾期未回应，这一单会自动结束',
      }],
    };
    const { container } = render(<阶段对话流 分段们={[分段]} />);
    expect(screen.getByText('等待招聘方回答对方的问题')).toBeTruthy();
    expect(screen.getByText('截止 2026-09-18 10:00 · 逾期未回应，这一单会自动结束')).toBeTruthy();
    // 段内零控件：对端待办不是本人的卡，绝不给按钮（分节条本身是唯一可点元素）
    expect(container.querySelectorAll('button').length).toBe(1);
  });

  it('S3 固定总结四节逐节呈现：空节给自己的空态说明，不合并、不省略', () => {
    const 分段: 分段项 = {
      阶段: '意向确认',
      态: '当前',
      确认总结: {
        版本说明: '本次确认的总结版本：第 1 版',
        含义说明: '确认表示你愿意继续讨论，不代表接受全部条件',
        分节们: [
          { 键: 'confirmed', 标题: '已回答事项', 空说明: '暂无已回答事项', 条目们: [{ 编号: 'c0', 文本: '岗位在浦东园区' }] },
          { 键: 'agreed', 标题: '已达成的安排', 空说明: '没有双方公开接受的安排（继续或确认都不是接受证据）', 条目们: [] },
          { 键: 'unresolved', 标题: '仍未解决', 空说明: '暂无未决事项', 条目们: [{ 编号: 'u0', 文本: '远程比例仍未定' }] },
          { 键: 'incomplete', 标题: '未完成', 空说明: '没有因技术原因未完成的事项', 条目们: [{ 编号: 'i0', 文本: '出差频率未完成确认' }] },
        ],
      },
    };
    render(<阶段对话流 分段们={[分段]} />);
    expect(screen.getByText('本次确认的总结版本：第 1 版')).toBeTruthy();
    expect(screen.getByText('确认表示你愿意继续讨论，不代表接受全部条件')).toBeTruthy();
    for (const 标题 of ['已回答事项', '已达成的安排', '仍未解决', '未完成']) {
      expect(screen.getByText(标题)).toBeTruthy();
    }
    expect(screen.getByText('岗位在浦东园区')).toBeTruthy();
    // 空的「已达成的安排」按自己的空态说明呈现，绝不读成已达成
    expect(screen.getByText('没有双方公开接受的安排（继续或确认都不是接受证据）')).toBeTruthy();
    expect(screen.getByText('远程比例仍未定')).toBeTruthy();
    expect(screen.getByText('出差频率未完成确认')).toBeTruthy();
  });
});

// ── S0–S3 展示统一 Task 3：段内记录 有序一次遍历 ──
// 气泡与灰色注释按调用方给的数组原序一次遍历；组件从不排序，灰注释不计条数；
// 传空数组即为空，不回落旧数组兼容入口。

describe('阶段对话流 · 段内记录 有序一次遍历（Task 3）', () => {
  const 记录: 段内记录[] = [
    { kind: '注释', 编号: 'sum:0', 标签: '初评', 时间: '22:28', 内容: '公开资料匹配检查通过。' },
    { kind: '气泡', 编号: 's0:q1', 方: '对方', 角色: '招聘 Agent', 时间: '22:28', 内容: '每周需要值几个晚班？' },
    { kind: '气泡', 编号: 's0:a1', 方: '我方', 角色: '候选 Agent', 时间: '22:29', 内容: '没有固定晚班，只有周末白天。' },
    { kind: '注释', 编号: 'sum:1', 标签: '第 1 轮复评', 时间: '22:30', 内容: '已确认值班安排，继续了解团队规模。' },
  ];

  it('注释/问/答/注释 按数组原序一次遍历：注释走共享灰胶囊，气泡带角色标签与时间', () => {
    render(<阶段对话流 分段们={[{ 阶段: '匿名初筛', 态: '当前', 记录 }]} />);
    const 初评 = screen.getByText('公开资料匹配检查通过。') as HTMLElement;
    const 问 = screen.getByText('每周需要值几个晚班？') as HTMLElement;
    const 答 = screen.getByText('没有固定晚班，只有周末白天。') as HTMLElement;
    const 复评 = screen.getByText('已确认值班安排，继续了解团队规模。') as HTMLElement;
    expect(初评.compareDocumentPosition(问) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(问.compareDocumentPosition(答) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(答.compareDocumentPosition(复评) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 注释的「标签 · 时间」头行由共享 对话系统注释 渲染
    expect(screen.getByText('初评 · 22:28')).toBeTruthy();
    expect(screen.getByText('第 1 轮复评 · 22:30')).toBeTruthy();
    // 气泡仍带角色标签（左右与时间沿用代理气泡版式）
    expect(screen.getByText('招聘 Agent')).toBeTruthy();
    expect(screen.getByText('候选 Agent')).toBeTruthy();
    // 注释不进左右气泡容器（灰胶囊居中，与往来记录同款）
    expect(初评.closest('div')!.className).not.toContain('气泡');
  });

  it('灰注释不计条数：4 条记录里只有 2 个气泡 → 「2 条」', () => {
    render(<阶段对话流 分段们={[{ 阶段: '匿名初筛', 态: '当前', 记录 }]} />);
    expect(screen.getByText('2 条')).toBeTruthy();
    expect(screen.queryByText('4 条')).toBeNull();
  });

  it('传空数组即为空：不回落旧 对话/用户气泡 兼容入口，条数归零、兜底行照常', () => {
    render(
      <阶段对话流
        分段们={[
          {
            阶段: '匿名初筛',
            态: '当前',
            空说明: '本阶段暂无往来',
            记录: [],
            对话: [{ 编号: 1, 方: '对方', 时间: '10:01', 内容: '旧对话不该出现' }],
            用户气泡: [{ 编号: 9, 我: '旧叮嘱不该出现', 回执: '旧回执不该出现' }],
          },
        ]}
      />,
    );
    expect(screen.queryByText('旧对话不该出现')).toBeNull();
    expect(screen.queryByText('旧叮嘱不该出现')).toBeNull();
    expect(screen.queryByText('旧回执不该出现')).toBeNull();
    expect(screen.queryByText(/条$/)).toBeNull();
    expect(screen.getByText('本阶段暂无往来')).toBeTruthy();
  });

  it('用户叮嘱进同一次遍历：来自=用户 的气泡不带代理头像标签，仍按发言单位计数', () => {
    render(
      <阶段对话流
        分段们={[
          {
            阶段: '意向确认',
            态: '当前',
            记录: [
              { kind: '气泡', 编号: '叮嘱-1', 方: '我方', 角色: '', 时间: null, 内容: '周五也可以到岗', 来自: '用户' },
              { kind: '气泡', 编号: '回执-1', 方: '我方', 角色: '', 时间: null, 内容: '已记下你的时间偏好' },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByText('周五也可以到岗')).toBeTruthy();
    expect(screen.getByText('已记下你的时间偏好')).toBeTruthy();
    // 叮嘱 + 回执 = 两个发言单位
    expect(screen.getByText('2 条')).toBeTruthy();
  });

  it('气泡附件不丢：记录里的 气泡.附件 仍在气泡内渲染附件行并可点开', () => {
    const 点附件 = vi.fn();
    render(
      <阶段对话流
        分段们={[
          {
            阶段: '递交简历',
            态: '当前',
            记录: [
              {
                kind: '气泡', 编号: 's1:1', 方: '我方', 角色: '', 时间: '11:02',
                内容: '他已授权递交正式简历。',
                附件: { 文件名: '沈亦舟_简历_2026.pdf', 说明: 'PDF 原件 · 包含姓名与联系方式' },
              },
            ],
          },
        ]}
        点附件={点附件}
      />,
    );
    expect(screen.getByText('沈亦舟_简历_2026.pdf')).toBeTruthy();
    fireEvent.click(screen.getByText('沈亦舟_简历_2026.pdf'));
    expect(点附件).toHaveBeenCalledWith('沈亦舟_简历_2026.pdf');
  });
});

describe('阶段对话流 · 折叠与定位规则（Task 3）', () => {
  it('核对清单五态：通过给成功勾；不匹配 ×；待确认/未完成/核对中 各带自己的字样且都不是勾', () => {
    render(
      <阶段对话流
        分段们={[
          {
            阶段: '匿名初筛',
            态: '当前',
            小结: '匿名初筛已通过',
            核对清单: [
              { 项: '简历已绑定', 结果: '通过' },
              { 项: '薪资条件', 结果: '不匹配' },
              { 项: '办公方式', 结果: '待确认' },
              { 项: '自动筛选', 结果: '未完成' },
              { 项: '作息', 结果: '核对中' },
            ],
          },
        ]}
      />,
    );
    const 行 = (项: string) => (screen.getByText(项).parentElement as HTMLElement).textContent ?? '';
    expect(行('简历已绑定')).toContain('✓');
    expect(行('薪资条件')).toContain('×');
    expect(行('薪资条件')).not.toContain('✓');
    expect(行('薪资条件')).toContain('不匹配');
    expect(行('办公方式')).toContain('待确认');
    expect(行('办公方式')).not.toContain('✓');
    expect(行('自动筛选')).toContain('未完成');
    expect(行('自动筛选')).not.toContain('✓');
    expect(行('作息')).toContain('核对中');
  });

  it('passed（已完成）默认折叠、可点开；ended（已结束）默认展开且分节轴不用成功勾', () => {
    const 引用: { current: HTMLDivElement | null } = { current: null };
    render(
      <阶段对话流
        分段们={[
          { 阶段: '匿名初筛', 态: '已完成', 状态文: '已通过', 记录: [{ kind: '气泡', 编号: 'q', 方: '对方', 角色: '', 时间: '10:00', 内容: '已过段内容' }] },
          { 阶段: '递交简历', 态: '已结束', 状态文: '不匹配', 小结: '本阶段评估不匹配，代谈已结束', 记录: [{ kind: '气泡', 编号: 'q2', 方: '对方', 角色: '', 时间: '11:00', 内容: '已结束段内容' }] },
        ]}
        当前段引用={引用}
      />,
    );
    // 已完成段默认收起，点击分节条可展开
    expect(screen.queryByText('已过段内容')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /匿名初筛/ }));
    expect(screen.getByText('已过段内容')).toBeTruthy();
    // 已结束段默认展开（便于回看结束原因），且不用成功勾
    expect(screen.getByText('已结束段内容')).toBeTruthy();
    let 节点: HTMLElement | null = screen.getByText('已结束段内容') as HTMLElement;
    while (节点 && !节点.className.includes('分段')) 节点 = 节点.parentElement;
    expect(节点?.textContent ?? '').not.toContain('✓');
    // 无当前段但有结束段：自动定位落在结束段
    expect(引用.current?.textContent).toContain('已结束段内容');
  });

  it('当前段引用定位实际当前段：不因增加「已结束」态丢失原自动定位', () => {
    const 引用: { current: HTMLDivElement | null } = { current: null };
    render(
      <阶段对话流
        分段们={[
          { 阶段: '匿名初筛', 态: '已结束', 记录: [{ kind: '气泡', 编号: 'q', 方: '对方', 角色: '', 时间: '10:00', 内容: '已结束段内容' }] },
          { 阶段: '递交简历', 态: '当前', 记录: [{ kind: '气泡', 编号: 'q2', 方: '对方', 角色: '', 时间: '11:00', 内容: '当前段内容' }] },
        ]}
        当前段引用={引用}
      />,
    );
    expect(引用.current?.textContent).toContain('当前段内容');
    expect(引用.current?.textContent).not.toContain('已结束段内容');
  });

  it('未到达灰段默认不可展开；显式 可展开 才可达（默认仍收起，点击后展开信息区）', () => {
    const 页 = render(
      <阶段对话流
        分段们={[{ 阶段: '需要协调', 态: '未到达', 待推进说明: '前一阶段通过后 AI 代理自动推进' }]}
      />,
    );
    // 不可展开：分节条不是按钮，段内信息不可达
    expect(screen.queryByRole('button', { name: /需要协调/ })).toBeNull();
    页.rerender(
      <阶段对话流
        分段们={[
          { 阶段: '需要协调', 态: '未到达', 可展开: true, 待推进说明: '开案前信息', 空说明: '开案前的公开初评信息' },
        ]}
      />,
    );
    // 可展开 ≠ 默认展开：默认仍收起，点击后信息/合法动作区可达
    expect(screen.queryByText('开案前的公开初评信息')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /需要协调/ }));
    expect(screen.getByText('开案前的公开初评信息')).toBeTruthy();
  });

  it('未到达但可展开的段（pre-Case S0）标题旁仍给「未开始」状态胶囊（review 修复钉）', () => {
    // 可展开段走分节条 button 分支：状态文胶囊必须照常渲染，不能因灰条分支只渲染
    // 待推进说明 而「未开始」消失（Spec §5.2「匿名初筛标题旁为『未开始』」）
    render(
      <阶段对话流
        分段们={[
          {
            阶段: '匿名初筛',
            态: '未到达',
            状态文: '未开始',
            可展开: true,
            默认展开: true,
            小结: '公开初评匹配',
          },
        ]}
      />,
    );
    const 条 = screen.getByRole('button', { name: /匿名初筛/ });
    expect(within(条).getByText('未开始')).toBeTruthy();
    // 默认展开：段内小结直达，胶囊不受展开态影响
    expect(screen.getByText('公开初评匹配')).toBeTruthy();
  });

  it('受控展开对：受控值不被 默认展开 覆盖；点击把新值回调给 切展开', () => {
    const 切展开 = vi.fn();
    const 页 = render(
      <阶段对话流
        分段们={[
          {
            阶段: '匿名初筛', 态: '当前', 默认展开: true, 展开状态: false, 切展开,
            记录: [{ kind: '气泡', 编号: 'q', 方: '对方', 角色: '', 时间: '10:00', 内容: '受控段内容' }],
          },
        ]}
      />,
    );
    // 受控 false 压过 默认展开 true（手动覆盖不被推进后的默认值冲掉）
    expect(screen.queryByText('受控段内容')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /匿名初筛/ }));
    expect(切展开).toHaveBeenCalledWith(true);
    页.rerender(
      <阶段对话流
        分段们={[
          {
            阶段: '匿名初筛', 态: '当前', 默认展开: true, 展开状态: true, 切展开,
            记录: [{ kind: '气泡', 编号: 'q', 方: '对方', 角色: '', 时间: '10:00', 内容: '受控段内容' }],
          },
        ]}
      />,
    );
    expect(screen.getByText('受控段内容')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /匿名初筛/ }));
    expect(切展开).toHaveBeenCalledWith(false);
  });
});
