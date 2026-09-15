// 阶段对话流 的共享渲染缝回归（S0 记录接入 Task 3）：既有 Mock 调用方零迁移 —— 数字编号
// 对话、旧小结、核对清单与用户气泡原样；Backend 段新增 string 编号与 Agent 总结槽，总结
// 只进小结托盘、不计入「N 条」。只断言 DOM 文本与数量，不依赖 CSS hash、像素或截图。

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import 阶段对话流, { type 分段项 } from './阶段对话流';
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

  it('Backend 形状：string 编号对话 + Agent 总结只进托盘且不计入条数（小结→清单→总结）', () => {
    const 分段: 分段项 = {
      阶段: '匿名初筛',
      态: '当前',
      小结: '系统正在复评候选信息',
      核对清单: [{ 项: '匿名初筛已通过', 结果: '通过' }],
      对话: [
        { 编号: 's0:q1', 方: '对方', 时间: '10:01', 内容: '这周需要值几个晚班？' },
        { 编号: 's0:a1', 方: '我方', 时间: '10:05', 内容: '没有固定晚班，只有周末白天偶尔需要支援。' },
      ],
      Agent总结: [
        { 编号: 'sum1', 标签: '初评', 内容: '需要确认岗位的值班安排。' },
        { 编号: 'sum2', 标签: '第 1 轮复评', 内容: '已确认没有固定晚班，仍需了解其它工作安排。' },
      ],
    };
    render(<阶段对话流 分段们={[分段]} />);
    expect(screen.getByText('这周需要值几个晚班？')).toBeTruthy();
    expect(screen.getByText('没有固定晚班，只有周末白天偶尔需要支援。')).toBeTruthy();
    // 两条总结以「标签：内容」进托盘，复用小结正文行
    expect(screen.getByText('初评：需要确认岗位的值班安排。')).toBeTruthy();
    expect(screen.getByText('第 1 轮复评：已确认没有固定晚班，仍需了解其它工作安排。')).toBeTruthy();
    // 条数只算对话（2 条），总结与清单不进去
    expect(screen.getByText('2 条')).toBeTruthy();
    expect(screen.queryByText('4 条')).toBeNull();
    // 托盘内部顺序固定：旧小结 → 旧清单 → Agent 总结
    const 初评 = screen.getByText('初评：需要确认岗位的值班安排。');
    const 复评 = screen.getByText('第 1 轮复评：已确认没有固定晚班，仍需了解其它工作安排。');
    const 头行 = screen.getByText('系统正在复评候选信息');
    const 清单 = screen.getByText('匿名初筛已通过');
    expect(头行.compareDocumentPosition(清单) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(清单.compareDocumentPosition(初评) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(初评.compareDocumentPosition(复评) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('轮询式更新：同 ID question 保持一份、answer 追加一份，总结不进气泡区', () => {
    const 总结 = [{ 编号: 'sum1', 标签: '初评', 内容: '值班安排已确认，团队规模待确认。' }];
    const 仅问: 分段项 = {
      阶段: '匿名初筛',
      态: '当前',
      对话: [{ 编号: 's0:q1', 方: '对方', 时间: '10:01', 内容: '团队规模是多少？' }],
      Agent总结: 总结,
    };
    const 问后答: 分段项 = {
      ...仅问,
      对话: [
        { 编号: 's0:q1', 方: '对方', 时间: '10:01', 内容: '团队规模是多少？' },
        { 编号: 's0:a1', 方: '我方', 时间: '10:04', 内容: '团队一共 6 个人。' },
      ],
    };
    const 页 = render(<阶段对话流 分段们={[仅问]} />);
    // 无旧小结：Agent 总结自己撑开托盘
    const 托盘 = () => screen.getByText('代 理 小 结').parentElement as HTMLElement;
    expect(within(托盘()).getByText('初评：值班安排已确认，团队规模待确认。')).toBeTruthy();
    expect(screen.getByText('1 条')).toBeTruthy();

    页.rerender(<阶段对话流 分段们={[问后答]} />);
    expect(screen.getAllByText('团队规模是多少？').length).toBe(1); // 同 ID question 不重复
    expect(screen.getAllByText('团队一共 6 个人。').length).toBe(1); // answer 只一份
    expect(screen.getByText('2 条')).toBeTruthy(); // 总结不计入条数
    // 总结仍只在托盘里，没有混进气泡列
    const 气泡列 = screen.getByText('团队规模是多少？').closest('div')!.parentElement!
      .parentElement as HTMLElement;
    expect(气泡列.textContent).not.toContain('值班安排已确认');
    expect(within(托盘()).getByText('初评：值班安排已确认，团队规模待确认。')).toBeTruthy();
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

describe('阶段对话流 · S0 Agent 问答与系统状态行（J-PILOT-01）', () => {
  it('Agent对话 带角色标签（己方右/对方左）；系统消息以状态文本落段；对话气泡不带角色标签', () => {
    render(
      <阶段对话流
        分段们={[
          {
            阶段: '匿名初筛',
            态: '当前',
            Agent对话: [
              { 编号: 's0:q1', 角色: '候选 Agent', 方: '我方', 时间: '10:01', 内容: '需要确认岗位的值班安排。' },
              { 编号: 's0:a1', 角色: '招聘 Agent', 方: '对方', 时间: '10:05', 内容: '没有固定晚班。' },
            ],
            系统消息: [{ 编号: 'evt:e1', 内容: '系统正在核对投递政策' }],
            对话: [{ 编号: 'aci:1', 方: '我方', 时间: '01:05', 内容: '工作日联系' }],
          },
        ]}
      />,
    );
    // 角色标签在气泡槽内可见（不显示内部 ID/task/operation 字样）
    expect(screen.getByText('候选 Agent')).toBeTruthy();
    expect(screen.getByText('招聘 Agent')).toBeTruthy();
    expect(screen.getByText('需要确认岗位的值班安排。')).toBeTruthy();
    // 系统事件以系统状态文本显示，不投成对方气泡（无气泡容器包着系统行）
    const 系统行 = screen.getByText('系统正在核对投递政策');
    expect(系统行.closest('div')!.className).not.toContain('气泡');
    // 叮嘱回执不带角色标签（历史叮嘱不伪装 Agent Q/A）
    expect(screen.getByText('工作日联系').closest('div')!.textContent).not.toContain('候选 Agent');
  });
});

// ── S0–S3 连续筛选（continuity_version 2）新增的两个展示槽 ──
// 待办说明 = 正在等对端的人工待办（零按钮）；确认总结 = S3 固定总结的四节。

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
          { 键: 'confirmed', 标题: '已知事实', 空说明: '暂无已确认的公开事实', 条目们: [{ 编号: 'c0', 文本: '岗位在浦东园区' }] },
          { 键: 'agreed', 标题: '已达成的安排', 空说明: '没有双方公开接受的安排（继续或确认都不是接受证据）', 条目们: [] },
          { 键: 'unresolved', 标题: '仍未解决', 空说明: '暂无未决事项', 条目们: [{ 编号: 'u0', 文本: '远程比例仍未定' }] },
          { 键: 'incomplete', 标题: '未完成', 空说明: '没有因技术原因未完成的事项', 条目们: [{ 编号: 'i0', 文本: '出差频率未完成确认' }] },
        ],
      },
    };
    render(<阶段对话流 分段们={[分段]} />);
    expect(screen.getByText('本次确认的总结版本：第 1 版')).toBeTruthy();
    expect(screen.getByText('确认表示你愿意继续讨论，不代表接受全部条件')).toBeTruthy();
    for (const 标题 of ['已知事实', '已达成的安排', '仍未解决', '未完成']) {
      expect(screen.getByText(标题)).toBeTruthy();
    }
    expect(screen.getByText('岗位在浦东园区')).toBeTruthy();
    // 空的「已达成的安排」按自己的空态说明呈现，绝不读成已达成
    expect(screen.getByText('没有双方公开接受的安排（继续或确认都不是接受证据）')).toBeTruthy();
    expect(screen.getByText('远程比例仍未定')).toBeTruthy();
    expect(screen.getByText('出差频率未完成确认')).toBeTruthy();
  });
});
