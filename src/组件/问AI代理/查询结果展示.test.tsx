// 查询结果展示：合同 B 固定组件的展示契约测试（Spec §4 三类结果 + §10 展示增量）。
// 全部 DTO 自造（形状对齐 Task 1 助手会话.ts 的闭合解码产物），不引用演示业务 fixture。
// 时间断言与 格式化聊天时间 同源比较（不硬编码本地时区字面量）；queried_at 与 created_at
// 用跨分钟样本，防止同一分钟掩盖取错字段。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { 查询结果展示 } from './查询结果展示';
import type { 查询结果展示属性 } from './查询结果展示';
import { 格式化聊天时间 } from '../聊天气泡';
import type {
  AssistantCard,
  AssistantJobItem,
  AssistantNegotiationDetail,
  AssistantNegotiationItem,
  AssistantReply,
} from '../../数据/招聘数据源/助手会话';

// 本组默认消息创建时间（与卡片 queried_at 跨分钟，可辨取错字段）
const 创建时间串 = '2026-09-16T09:07:00Z';
const 创建时间文 = 格式化聊天时间(创建时间串);

// Spec §10.5 用户提供的完整 Markdown 样本（实施不依赖聊天历史，仅作渲染契约）
const 完整Markdown样本 = [
  '为你找到 **产品经理（北京市）** 的 2 个推荐岗位：',
  '',
  '---',
  '',
  '### 📌 产品经理 · 北京市',
  '',
  '**1. Project Star — 产品经理**',
  '- 📍 **地点：** 远程办公；每月北京线下协作 2 天（具体地点另行通知）',
  '- 💰 **薪资：** 20–30K/月（12 薪）',
  '',
  '**2. 快手 — 产品经理**',
  '- 📍 **地点：** 三里屯',
  '- 💰 **薪资：** 20–30K/月（12 薪）',
  '',
  '---',
  '',
  '两个岗位薪资一致（20–30K/月），区别主要在工作模式：',
  '- **Project Star** 是**远程为主**，灵活度高',
  '- **快手**是**三里屯办公**，现场协作',
  '',
  '需要我查看**前端开发工程师**的推荐，或者深入了解某个岗位的详情吗？😊',
].join('\n');

// ── 自造 DTO ──

function 造岗位项(覆盖: Partial<AssistantJobItem> = {}): AssistantJobItem {
  return {
    job_id: 'job-1',
    title: '资深后端工程师',
    organization_name: null,
    office_location: '上海 · 浦东',
    salary_lower: 20,
    salary_upper: 35,
    salary_period: 'month',
    annual_salary_months: 15,
    safe_reasons: ['方向匹配', '城市一致'],
    ...覆盖,
  };
}

function 造在谈项(覆盖: Partial<AssistantNegotiationItem> = {}): AssistantNegotiationItem {
  return {
    record_id: `dlg_${'a'.repeat(32)}`,
    record_kind: 'delegation',
    intention_id: 'int-1',
    job: {
      job_id: 'job-9',
      title: '后端负责人',
      location: '上海',
      public_salary_range: '20-35K·15薪',
      availability: 'available',
    },
    case_id: null,
    phase: 'accepted',
    needs_action: false,
    ...覆盖,
  };
}

function 造详情项(覆盖: Partial<AssistantNegotiationDetail> = {}): AssistantNegotiationDetail {
  return {
    ...造在谈项(),
    agent_summary: {
      public_evaluation: {
        evaluation_id: 'eval-1',
        decision: 'fit',
        summary: '公开信息与简历方向一致。',
        coverage: 'public_job_and_candidate_data',
        evidence: {
          matches: [{ dimension: 'skills', code: 'go', source: 'structured_precheck' }],
          conflicts: [],
          unknowns: [{ dimension: 'experience', code: 'years', source: 'candidate_agent' }],
        },
        next_action: 'promote_to_a2a',
        completed_at: '2026-09-15T10:00:00Z',
      },
      condition_confirmation: {
        case_id: 'case-1',
        stage_status: 'active',
        latest_summary: {
          id: 's2', phase: 'reevaluation', round: 2,
          summary: '第二轮确认薪资一致。', occurredAt: '2026-09-15T11:00:00Z',
        },
        summaries: [
          { id: 's1', phase: 'initial', summary: '首轮确认工作地点。', occurredAt: '2026-09-14T09:00:00Z' },
          { id: 's2', phase: 'reevaluation', round: 2, summary: '第二轮确认薪资一致。', occurredAt: '2026-09-15T11:00:00Z' },
        ],
      },
    },
    ...覆盖,
  };
}

function 造回复(cards: AssistantCard[], 覆盖: Partial<AssistantReply> = {}): AssistantReply {
  return { text: '这是回复正文。', visibility: 'available', cards, ...覆盖 };
}

function 渲染(
  cards: AssistantCard[],
  覆盖: Partial<AssistantReply> = {},
  时间: string = 创建时间串,
): {
  属性: 查询结果展示属性;
  宿主: ReturnType<typeof render>;
} {
  const 属性: 查询结果展示属性 = {
    回复: 造回复(cards, 覆盖),
    时间,
    打开岗位: vi.fn(),
    打开在谈: vi.fn(),
    解读在谈: vi.fn(),
    解读禁用: false,
  };
  const 宿主 = render(<查询结果展示 {...属性} />);
  return { 属性, 宿主 };
}

const 岗位卡 = (项们: AssistantJobItem[], next_cursor: string | null = null): AssistantCard => ({
  kind: 'job_recommendations',
  queried_at: '2026-09-16T08:00:00Z',
  data: { intention_id: 'int-1', items: 项们, next_cursor },
});

const 在谈列表卡 = (项们: AssistantNegotiationItem[], next_cursor: string | null = null): AssistantCard => ({
  kind: 'negotiation_list',
  queried_at: '2026-09-16T10:52:00Z',
  data: { items: 项们, next_cursor },
});

const 详情卡 = (项: AssistantNegotiationDetail = 造详情项()): AssistantCard => ({
  kind: 'negotiation_detail',
  queried_at: '2026-09-16T11:38:00Z',
  data: 项,
});

// ── 纯文本与不可用回复 ──

describe('查询结果展示 · 纯文本与不可用回复（合同 B）', () => {
  it('无 cards：只出普通代理气泡 Markdown 正文，无结果区、无分割线、无查询时间、无任何卡', () => {
    const { 属性, 宿主 } = 渲染([]);
    expect(screen.getByText('这是回复正文。')).toBeTruthy();
    expect(宿主.container.querySelectorAll('[data-testid]')).toHaveLength(0);
    expect(宿主.container.textContent).not.toContain('查询于');
    expect(宿主.container.querySelectorAll('[class*="结果分割线"]')).toHaveLength(0);
    for (const 回调 of [属性.打开岗位, 属性.打开在谈, 属性.解读在谈]) {
      expect(回调).not.toHaveBeenCalled();
    }
  });

  it('无卡回复按 Markdown 渲染 Spec §10.5 完整样本：加粗/标题/列表/分割线都在正文容器内', () => {
    const 宿主 = render(<查询结果展示
      回复={{ text: 完整Markdown样本, visibility: 'available', cards: [] }}
      时间={创建时间串}
      打开岗位={vi.fn()} 打开在谈={vi.fn()} 解读在谈={vi.fn()} 解读禁用={false}
    />);
    expect(宿主.container.querySelector('strong')?.textContent).toBe('产品经理（北京市）');
    expect(宿主.container.querySelector('h3')?.textContent).toContain('产品经理 · 北京市');
    const 列表条 = Array.from(宿主.container.querySelectorAll('li')).map((项) => 项.textContent);
    expect(列表条.some((文) => 文?.includes('远程办公'))).toBe(true);
    expect(列表条.some((文) => 文?.includes('三里屯办公，现场协作'))).toBe(true);
    // 正文自己的 --- 是 Markdown 分割线，不是结果分割线（无卡无结果区）
    expect(宿主.container.querySelectorAll('[class*="结果分割线"]')).toHaveLength(0);
  });

  it('visibility=unavailable：只显示服务端提示文本（Markdown），不渲染任何卡片区域', () => {
    const 宿主 = render(<查询结果展示
      回复={{ text: '该回复引用的信息已不可查看。', visibility: 'unavailable', cards: [] }}
      时间={创建时间串}
      打开岗位={vi.fn()} 打开在谈={vi.fn()} 解读在谈={vi.fn()} 解读禁用={false}
    />);
    expect(screen.getByText('该回复引用的信息已不可查看。')).toBeTruthy();
    expect(宿主.container.querySelectorAll('[data-testid]')).toHaveLength(0);
  });
});

// ── 类型标题、数量与分割线（Spec §10.2）──

describe('查询结果展示 · 类型标题与数量（Spec §10.2）', () => {
  it('三类各自返回：标题一一对应，两列表带实际数量、详情不显示数量', () => {
    const 岗位 = 渲染([岗位卡([造岗位项(), 造岗位项({ job_id: 'job-2' })])]);
    expect(岗位.宿主.container.textContent).toContain('推荐岗位');
    expect(岗位.宿主.container.textContent).toContain('2 个岗位');
    expect(岗位.宿主.container.textContent).not.toContain('条在谈');
    岗位.宿主.unmount();

    const 列表 = 渲染([在谈列表卡([造在谈项()])]);
    expect(列表.宿主.container.textContent).toContain('在谈列表');
    expect(列表.宿主.container.textContent).toContain('1 条在谈');
    列表.宿主.unmount();

    const 详情 = 渲染([详情卡()]);
    expect(详情.宿主.container.textContent).toContain('在谈详情');
    // 详情不伪造列表数量
    expect(详情.宿主.container.textContent).not.toContain('个岗位');
    expect(详情.宿主.container.textContent).not.toContain('条在谈');
  });

  it('混排与重复类型：cards 原序、重复类型不合并各出标题，正文后只有一条结果分割线', () => {
    const { 宿主 } = 渲染([
      岗位卡([造岗位项()]),
      在谈列表卡([造在谈项()]),
      岗位卡([造岗位项({ job_id: 'job-2' })]),
    ]);
    const 文 = 宿主.container.textContent ?? '';
    expect(文.indexOf('推荐岗位')).toBeGreaterThanOrEqual(0);
    expect(文.indexOf('推荐岗位')).toBeLessThan(文.indexOf('在谈列表'));
    expect(文.indexOf('在谈列表')).toBeLessThan(文.lastIndexOf('推荐岗位'));
    // 重复类型各自成组：两个「推荐岗位」标题
    expect(文.match(/推荐岗位/g)?.length).toBe(2);
    expect(宿主.container.querySelectorAll('[class*="结果分割线"]')).toHaveLength(1);
    // 正文在最前，分割线在正文与首个结果之间
    expect(文.indexOf('这是回复正文。')).toBeLessThan(文.indexOf('资深后端工程师'));
  });

  it('空列表仍显示正确标题与真实空态', () => {
    const 岗位 = 渲染([岗位卡([])]);
    expect(岗位.宿主.container.textContent).toContain('推荐岗位');
    expect(岗位.宿主.container.textContent).toContain('0 个岗位');
    expect(screen.getByText('暂无推荐岗位')).toBeTruthy();
    岗位.宿主.unmount();

    const 列表 = 渲染([在谈列表卡([])]);
    expect(列表.宿主.container.textContent).toContain('在谈列表');
    expect(列表.宿主.container.textContent).toContain('0 条在谈');
    expect(screen.getByText('暂无在谈记录')).toBeTruthy();
  });

  it('有已知卡片才显示结果分割线；查询时间不展示（queried_at 只解码不上屏）', () => {
    const 无卡 = 渲染([]);
    expect(无卡.宿主.container.querySelectorAll('[class*="结果分割线"]')).toHaveLength(0);
    无卡.宿主.unmount();

    const { 宿主 } = 渲染([岗位卡([造岗位项()])]);
    expect(宿主.container.querySelectorAll('[class*="结果分割线"]')).toHaveLength(1);
    expect(宿主.container.textContent).not.toContain('查询于');
    expect(宿主.container.textContent).not.toContain(格式化聊天时间('2026-09-16T08:00:00Z'));
  });
});

// ── Agent 时间（Spec §10.4：整条回复气泡之后仅一次，同条 created_at）──

describe('查询结果展示 · 消息时间（Spec §10.4）', () => {
  it('多卡也只显示一次 Agent 时间，取 created_at 不取 queried_at，位置在全部结果之后', () => {
    const { 宿主 } = 渲染([岗位卡([造岗位项()]), 在谈列表卡([造在谈项()]), 详情卡()]);
    const 时间节点们 = 宿主.container.querySelectorAll('time');
    expect(时间节点们).toHaveLength(1);
    expect(时间节点们[0]?.getAttribute('datetime')).toBe(创建时间串);
    expect(时间节点们[0]?.textContent).toBe(创建时间文);
    // queried_at（08:00/10:52/11:38 与 created 09:07 跨分钟）不得上屏
    expect(宿主.container.textContent).not.toContain(格式化聊天时间('2026-09-16T10:52:00Z'));
    expect(宿主.container.textContent).not.toContain(格式化聊天时间('2026-09-16T11:38:00Z'));
    // 时间在气泡列内、最后一个结果之后
    const 气泡列 = 时间节点们[0]?.parentElement;
    expect(气泡列?.lastElementChild).toBe(时间节点们[0]);
  });

  it('无卡回复同样带时间；不可见提示回复也遵循此布局', () => {
    const 无卡 = 渲染([]);
    expect(无卡.宿主.container.querySelector('time')?.getAttribute('datetime')).toBe(创建时间串);
    无卡.宿主.unmount();

    const 不可见 = render(<查询结果展示
      回复={{ text: '该回复引用的信息已不可查看。', visibility: 'unavailable', cards: [] }}
      时间={创建时间串}
      打开岗位={vi.fn()} 打开在谈={vi.fn()} 解读在谈={vi.fn()} 解读禁用={false}
    />);
    expect(不可见.container.querySelector('time')?.textContent).toBe(创建时间文);
  });
});

// ── 岗位推荐结果（Spec §4.1 + §10.3 卡内中文理由）──

describe('查询结果展示 · 岗位推荐结果', () => {
  it('真实字段映射原市场卡：薪资/标签[地点,n 薪]、未知占位、委托禁用、卡内中文理由原序、打开岗位送精确 job_id', () => {
    const { 属性, 宿主 } = 渲染([岗位卡([
      造岗位项({
        safe_reasons: ['category_matched', 'experience_met', '城市一致'],
      }),
    ])]);
    expect(screen.getByText('资深后端工程师')).toBeTruthy();
    expect(screen.getByText('20–35K')).toBeTruthy();
    // 未知占位：公司/简介/分/发布人未知，公司图位中性空位
    expect(screen.getByText('公司信息未知')).toBeTruthy();
    expect(screen.getByText('公司简介未知')).toBeTruthy();
    expect(screen.getByLabelText('公司图片未知')).toBeTruthy();
    expect(screen.getByLabelText('匹配分未知')).toBeTruthy();
    expect(screen.getByText('发布人未知')).toBeTruthy();
    // 标签顺序 = [office_location, "n 薪"]；未提供招聘类型/办公方式不制造事实
    const 标签们 = Array.from(
      screen.getByTestId('求职推荐卡').querySelector('[class*="标签行"]')?.children ?? [],
    ).map((元) => 元.textContent);
    expect(标签们).toEqual(['上海 · 浦东', '15 薪']);
    // 匹配理由进卡内：已知码译中文带勾、自然语言保留原文；原序；无机器码透出
    const 卡文 = screen.getByTestId('求职推荐卡').textContent ?? '';
    expect(卡文.indexOf('职位方向匹配')).toBeGreaterThanOrEqual(0);
    expect(卡文.indexOf('职位方向匹配')).toBeLessThan(卡文.indexOf('经验要求匹配'));
    expect(卡文.indexOf('经验要求匹配')).toBeLessThan(卡文.indexOf('城市一致'));
    expect(卡文).not.toContain('category_matched');
    expect(卡文).not.toContain('experience_met');
    // 旧附属区脚注已移除（用户明确取消）
    expect(宿主.container.textContent).not.toContain('请进入岗位详情操作');
    // 委托固定 未委托 + 禁用：去谈键 disabled，不借已委托回执分支改文案
    const 去谈键 = screen.getByRole('button', { name: '让AI代理去谈' }) as HTMLButtonElement;
    expect(去谈键.disabled).toBe(true);
    expect(screen.queryByText('AI代理已接手')).toBeNull();
    // 项目主体点击 → 打开岗位(job_id)；无解读动作、渲染期间零回调
    fireEvent.click(screen.getByText('资深后端工程师'));
    expect(属性.打开岗位).toHaveBeenCalledTimes(1);
    expect(属性.打开岗位).toHaveBeenCalledWith('job-1');
    expect(属性.解读在谈).not.toHaveBeenCalled();
    expect(宿主.container.querySelectorAll('img')).toHaveLength(0);
  });

  it('月/日/时薪三档、年薪月数缺席不假设薪数、空地点显示地点未知、理由全过滤出卡内占位', () => {
    const { 宿主 } = 渲染([岗位卡([
      造岗位项({ job_id: 'job-1', salary_period: 'month', annual_salary_months: null, office_location: '上海' }),
      造岗位项({ job_id: 'job-2', salary_lower: 300, salary_upper: 500, salary_period: 'day', annual_salary_months: null, office_location: ' ' }),
      造岗位项({ job_id: 'job-3', salary_lower: 80, salary_upper: 120, salary_period: 'hour', annual_salary_months: 13, office_location: '北京' }),
      造岗位项({
        job_id: 'job-4', salary_lower: 10, salary_upper: 12,
        annual_salary_months: null, office_location: '深圳', safe_reasons: ['strategy_fit', ''],
      }),
    ])]);
    expect(screen.getByText('20–35K')).toBeTruthy();
    expect(screen.getByText('300–500 元/天')).toBeTruthy();
    expect(screen.getByText('80–120 元/时')).toBeTruthy();
    expect(screen.getByText('地点未知')).toBeTruthy();
    expect(screen.getByText('13 薪')).toBeTruthy();
    // 缺年薪月数不假设 12/13 薪
    expect(screen.queryByText('12 薪')).toBeNull();
    expect(screen.queryByText('15 薪')).toBeNull();
    // 理由真实为空（未知机器码被过滤）：卡内出「暂无推荐理由」占位，不编造理由
    expect(screen.getByText('暂无推荐理由')).toBeTruthy();
    expect(宿主.container.textContent).not.toContain('strategy_fit');
  });

  it("next_cursor 非 null 显示可继续问'下一批'；null 不显示；不新增分页按钮", () => {
    const 有游标 = render(<查询结果展示
      回复={造回复([岗位卡([造岗位项()], '7')])}
      时间={创建时间串}
      打开岗位={vi.fn()} 打开在谈={vi.fn()} 解读在谈={vi.fn()} 解读禁用={false}
    />);
    expect(有游标.container.textContent).toContain("可继续问‘下一批’");
    // 只有原市场卡的三个既有按钮（卡主体 + › + 禁用的去谈键），无分页按钮
    expect(有游标.container.querySelectorAll('button')).toHaveLength(3);
    有游标.unmount();

    const 无游标 = render(<查询结果展示
      回复={造回复([岗位卡([造岗位项()], null)])}
      时间={创建时间串}
      打开岗位={vi.fn()} 打开在谈={vi.fn()} 解读在谈={vi.fn()} 解读禁用={false}
    />);
    expect(无游标.container.textContent).not.toContain('下一批');
  });

  it('空列表显示真实空态：不填充演示行、无序号', () => {
    const { 宿主 } = 渲染([岗位卡([])]);
    expect(screen.getByText('暂无推荐岗位')).toBeTruthy();
    expect(宿主.container.querySelectorAll('[data-testid="求职推荐卡"]')).toHaveLength(0);
  });
});

// ── 在谈列表结果（Spec §4.2）──

describe('查询结果展示 · 在谈列表结果', () => {
  it('phase 五枚举映射冻结标题；只映射现有阶段色系，不编 S0–S3', () => {
    const 标题表 = {
      accepted: '已受理',
      evaluating: '评估中',
      evaluation_failed: '评估失败',
      refused: '未进入在谈',
      case_started: '已进入在谈',
    } as const;
    for (const [phase, 标题] of Object.entries(标题表)) {
      const 宿主 = render(<查询结果展示
        回复={造回复([在谈列表卡([造在谈项({ phase: phase as keyof typeof 标题表 })])])}
        时间={创建时间串}
        打开岗位={vi.fn()} 打开在谈={vi.fn()} 解读在谈={vi.fn()} 解读禁用={false}
      />);
      expect(screen.getByText(标题)).toBeTruthy();
      expect(宿主.container.textContent).not.toMatch(/S[0-3]/);
      宿主.unmount();
    }
  });

  it('公司/分数占位、城市/薪资/职位真实；needs_action 真才显示需要你', () => {
    const 无待办 = render(<查询结果展示
      回复={造回复([在谈列表卡([造在谈项({ needs_action: false })])])}
      时间={创建时间串}
      打开岗位={vi.fn()} 打开在谈={vi.fn()} 解读在谈={vi.fn()} 解读禁用={false}
    />);
    expect(screen.getByText('公司信息未知')).toBeTruthy();
    expect(screen.getByLabelText('匹配分未知')).toBeTruthy();
    expect(screen.getByText('后端负责人')).toBeTruthy();
    expect(screen.getByText('上海')).toBeTruthy();
    expect(screen.getByText('20–35K·15薪')).toBeTruthy();
    expect(无待办.queryByText('需要你')).toBeNull();
    无待办.unmount();

    render(<查询结果展示
      回复={造回复([在谈列表卡([造在谈项({ needs_action: true })])])}
      时间={创建时间串}
      打开岗位={vi.fn()} 打开在谈={vi.fn()} 解读在谈={vi.fn()} 解读禁用={false}
    />);
    expect(screen.getByText('需要你')).toBeTruthy();
  });

  it('每项外加序号与让 AI 解读：序号当前结果内从 1 起、解读送整项、打开在谈送精确 record_id', () => {
    const 项甲 = 造在谈项({ record_id: `dlg_${'a'.repeat(32)}` });
    const 项乙 = 造在谈项({
      record_id: `mc_${'b'.repeat(32)}`,
      record_kind: 'case',
      case_id: 'case-9',
      job: {
        job_id: 'job-8', title: '数据工程师', location: '北京',
        public_salary_range: '25-40K', availability: 'available',
      },
    });
    const { 属性 } = 渲染([在谈列表卡([项甲, 项乙])]);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    const 解读键们 = screen.getAllByRole('button', { name: '让 AI 解读' });
    expect(解读键们).toHaveLength(2);
    fireEvent.click(解读键们[1] as HTMLButtonElement);
    expect(属性.解读在谈).toHaveBeenCalledTimes(1);
    expect(属性.解读在谈).toHaveBeenCalledWith(项乙);
    fireEvent.click(screen.getByText('后端负责人'));
    expect(属性.打开在谈).toHaveBeenCalledTimes(1);
    expect(属性.打开在谈).toHaveBeenCalledWith(`dlg_${'a'.repeat(32)}`);
  });

  it('availability=unavailable：整卡禁点、解读禁用、卡面显示岗位信息不可查看、缺失职位/薪资/城市占位', () => {
    const { 属性, 宿主 } = 渲染([在谈列表卡([造在谈项({
      job: {
        job_id: 'job-9', title: null, location: null,
        public_salary_range: null, availability: 'unavailable',
      },
    })])]);
    expect(screen.getByText('岗位信息不可查看')).toBeTruthy();
    expect(screen.getByText('职位信息未知')).toBeTruthy();
    expect(screen.getByText('薪资未知')).toBeTruthy();
    expect(screen.getByText('标签信息未知')).toBeTruthy();
    // 整卡退化为不可点容器：卡内没有 button；点击不导航
    expect(screen.getByTestId('求职在谈卡').querySelectorAll('button')).toHaveLength(0);
    fireEvent.click(screen.getByTestId('求职在谈卡'));
    expect(属性.打开在谈).not.toHaveBeenCalled();
    // 该项目的解读键也禁用
    const 解读键 = screen.getByRole('button', { name: '让 AI 解读' }) as HTMLButtonElement;
    expect(解读键.disabled).toBe(true);
    fireEvent.click(解读键);
    expect(属性.解读在谈).not.toHaveBeenCalled();
    expect(宿主.container.querySelectorAll('img')).toHaveLength(0);
  });

  it('解读禁用=true 控制所有次级解读动作（多项全禁）', () => {
    const 解读在谈 = vi.fn();
    render(<查询结果展示
      回复={造回复([在谈列表卡([造在谈项(), 造在谈项({ record_id: `mc_${'b'.repeat(32)}` })])])}
      时间={创建时间串}
      打开岗位={vi.fn()} 打开在谈={vi.fn()} 解读在谈={解读在谈} 解读禁用={true}
    />);
    for (const 键 of screen.getAllByRole('button', { name: '让 AI 解读' })) {
      expect((键 as HTMLButtonElement).disabled).toBe(true);
    }
    fireEvent.click(screen.getAllByRole('button', { name: '让 AI 解读' })[0] as HTMLButtonElement);
    expect(解读在谈).not.toHaveBeenCalled();
  });

  it('空列表显示真实空态', () => {
    const { 宿主 } = 渲染([在谈列表卡([])]);
    expect(screen.getByText('暂无在谈记录')).toBeTruthy();
    expect(宿主.container.querySelectorAll('[data-testid="求职在谈卡"]')).toHaveLength(0);
  });
});

// ── 在谈详情摘要（Spec §4.3）──

describe('查询结果展示 · 在谈详情摘要', () => {
  it('初评与条件确认完整呈现：证据三组全出（空组显式无）、next_action 中文、最新条件确认 + 历次摘要原生展开、内部 ID 不作正文', () => {
    const { 属性, 宿主 } = 渲染([详情卡()]);
    // 初评：判断（与详情页同一原词口径）/摘要/证据三组/next_action 中文文案
    expect(screen.getByText('公开信息初评')).toBeTruthy();
    expect(screen.getByText('结论：fit')).toBeTruthy();
    expect(screen.getByText('公开信息与简历方向一致。')).toBeTruthy();
    expect(screen.getByText('匹配')).toBeTruthy();
    expect(screen.getByText('skills · go · structured_precheck')).toBeTruthy();
    expect(screen.getByText('冲突')).toBeTruthy();
    expect(screen.getByText('无')).toBeTruthy();
    expect(screen.getByText('待确认')).toBeTruthy();
    expect(screen.getByText('experience · years · candidate_agent')).toBeTruthy();
    expect(screen.getByText('建议：继续推进')).toBeTruthy();
    // 条件确认：最新摘要 + 历次摘要（原生 details/summary，遵循返回顺序）
    expect(screen.getByText('条件确认')).toBeTruthy();
    // 最新摘要与历次末条同文：最新槽 + 历次展开内各一份
    expect(screen.getAllByText('第二轮确认薪资一致。')).toHaveLength(2);
    const 历次标 = screen.getByText('历次摘要');
    expect(历次标.tagName).toBe('SUMMARY');
    const details = 历次标.closest('details');
    expect(details?.textContent ?? '').toContain('首轮确认工作地点。');
    expect((details?.textContent ?? '').indexOf('首轮确认工作地点。'))
      .toBeLessThan((details?.textContent ?? '').indexOf('第二轮确认薪资一致。'));
    // 内部标识 ID 不作正文结论
    const 文 = 宿主.container.textContent ?? '';
    expect(文).not.toContain('eval-1');
    expect(文).not.toContain('case-1');
    // 详情导航走 record_id；解读是卡外独立次级动作
    fireEvent.click(screen.getByText('后端负责人'));
    expect(属性.打开在谈).toHaveBeenCalledTimes(1);
    expect(属性.打开在谈).toHaveBeenCalledWith(`dlg_${'a'.repeat(32)}`);
    fireEvent.click(screen.getByRole('button', { name: '让 AI 解读' }));
    expect(属性.解读在谈).toHaveBeenCalledTimes(1);
    expect(属性.解读在谈).toHaveBeenCalledWith(造详情项());
  });

  it('null 区块显式暂无：暂无公开初评 / 暂无条件确认，不生成分析评语', () => {
    const { 宿主 } = 渲染([详情卡(造详情项({ agent_summary: { public_evaluation: null, condition_confirmation: null } }))]);
    expect(screen.getByText('暂无公开初评')).toBeTruthy();
    expect(screen.getByText('暂无条件确认')).toBeTruthy();
    expect(宿主.container.textContent).not.toContain('结论：');
  });

  it('latest_summary 缺席显式暂无、无历次不展开；解读服从解读禁用', () => {
    const 解读在谈 = vi.fn();
    render(<查询结果展示
      回复={造回复([{
        kind: 'negotiation_detail',
        queried_at: '2026-09-16T08:00:00Z',
        data: 造详情项({
          agent_summary: {
            public_evaluation: null,
            condition_confirmation: {
              case_id: 'case-1', stage_status: 'pending', latest_summary: null, summaries: [],
            },
          },
        }),
      }])}
      时间={创建时间串}
      打开岗位={vi.fn()} 打开在谈={vi.fn()} 解读在谈={解读在谈} 解读禁用={true}
    />);
    expect(screen.getByText('暂无确认摘要')).toBeTruthy();
    expect(screen.queryByText('历次摘要')).toBeNull();
    const 解读键 = screen.getByRole('button', { name: '让 AI 解读' }) as HTMLButtonElement;
    expect(解读键.disabled).toBe(true);
    fireEvent.click(解读键);
    expect(解读在谈).not.toHaveBeenCalled();
  });

  it('详情岗位不可查看：整卡禁点、解读禁用、显示岗位信息不可查看', () => {
    const 打开在谈 = vi.fn();
    render(<查询结果展示
      回复={造回复([{
        kind: 'negotiation_detail',
        queried_at: '2026-09-16T08:00:00Z',
        data: 造详情项({
          job: {
            job_id: 'job-9', title: '后端负责人', location: '上海',
            public_salary_range: '20-35K·15薪', availability: 'unavailable',
          },
        }),
      }])}
      时间={创建时间串}
      打开岗位={vi.fn()} 打开在谈={打开在谈} 解读在谈={vi.fn()} 解读禁用={false}
    />);
    expect(screen.getByText('岗位信息不可查看')).toBeTruthy();
    expect(screen.getByTestId('求职在谈卡').querySelectorAll('button')).toHaveLength(0);
    fireEvent.click(screen.getByTestId('求职在谈卡'));
    expect(打开在谈).not.toHaveBeenCalled();
    const 解读键 = screen.getByRole('button', { name: '让 AI 解读' }) as HTMLButtonElement;
    expect(解读键.disabled).toBe(true);
  });
});

// ── 同一回复多卡 ──

describe('查询结果展示 · 同一回复多卡（Spec §2）', () => {
  it('cards 按原序内嵌、各组标题数量、列表游标提示；无假统计/假图/简报标题，渲染零回调', () => {
    const { 属性, 宿主 } = 渲染([
      岗位卡([造岗位项()]),
      在谈列表卡([造在谈项()], '7'),
    ]);
    const 文 = 宿主.container.textContent ?? '';
    expect(文.indexOf('资深后端工程师')).toBeGreaterThanOrEqual(0);
    expect(文.indexOf('资深后端工程师')).toBeLessThan(文.indexOf('后端负责人'));
    expect(文).toContain('推荐岗位');
    expect(文).toContain('1 个岗位');
    expect(文).toContain('在谈列表');
    expect(文).toContain('1 条在谈');
    expect(文).toContain("可继续问‘下一批’");
    // 正文在前：正文下标小于任何结果区内容
    expect(文.indexOf('这是回复正文。')).toBeLessThan(文.indexOf('资深后端工程师'));
    // 无假统计、假图、简报标题
    expect(文).not.toContain('今日简报');
    expect(宿主.container.querySelectorAll('img')).toHaveLength(0);
    // 渲染期间零回调（无请求/状态副作用）
    expect(属性.打开岗位).not.toHaveBeenCalled();
    expect(属性.打开在谈).not.toHaveBeenCalled();
    expect(属性.解读在谈).not.toHaveBeenCalled();
  });
});
