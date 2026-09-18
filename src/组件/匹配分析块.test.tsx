// 匹配分析块（Task 4 / 冻结公共合同 C3 + Spec §3.1/§3.2/§4）：双端与 Mock 共用的六维
// 匹配分析组件纯渲染契约。锁定：
//   · props 核心 = 模型: 匹配分析模型 + 藏环?: boolean —— 组件只消费模型，不自行从
//     正文、分数大小或旧依据推断任何状态（Task 2 映射已冻结这一边界）；
//   · Spec §4 行样式：左四态图标（勾/半圆/叉/横线，互不相同）+ 维度名 + 小号
//     points/max_points，右弱化原因与状态文字（标识与文字同时存在），长原因不截断；
//   · 技能行「命中X/Y个岗位关键词」；1/100 命中 floor 后 0 分仍是「部分匹配」；
//   · 解释合法缺失（显式 null）→「暂无该次匹配的详细分析」，有旧依据标「有限依据」
//     仅列已知原因，无旧依据仅缺失说明，绝不补六条假状态，也不同时渲染旧依据的
//     重复分析（「当前接口仅提供部分匹配依据」不出现）；
//   · 分数 null → 中性「—」（藏环为文本、不藏环为缺分占位），真实 0 正常显示；
//   · 藏环 = 文本总分（弹层形态），不藏环 = 原适配环（详情形态）。
// 注：仓库未装 @testing-library/jest-dom，用 toBeTruthy / queryBy* 缺席断言为 null。
// 模型一律经 解匹配解释 真实解码样本构造 —— 组件测试不吃手工六行，防止绕过冻结解码。
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { 解匹配解释 } from '../数据/招聘数据源/匹配解释';
import {
  BFF匹配解释87分样本,
  BFF匹配解释92分样本,
  BFF技能部分命中零分解释样本,
} from '../测试/BFF样本';
import type { 匹配分析模型 } from '../数据/匹配解释展示映射';
import { 匹配分析块 } from './匹配分析块';

/** 合法样本（对齐 mobile-v1 示例约束）：一屏凑齐四态 ——
 *  方向 matched / 技能 partially_matched（1/100 命中 floor 后 0 分）/ 经验 not_matched /
 *  地点 matched / 办公方式 unknown / 薪资 unknown；总分 35 = 分项和。 */
const 四态解释样本 = {
  schema_version: 'match-explanation.v1',
  ranking_version: 'discovery-ranking.v2',
  basis: 'batch_snapshot',
  total_points: 35,
  max_points: 100,
  dimensions: [
    { dimension: 'direction', status: 'matched', points: 25, max_points: 25, reason_code: 'category_matched' },
    {
      dimension: 'skills', status: 'partially_matched', points: 0, max_points: 35,
      reason_code: 'partial_keyword_overlap', matched_count: 1, required_count: 100,
    },
    { dimension: 'experience', status: 'not_matched', points: 0, max_points: 15, reason_code: 'experience_not_met' },
    { dimension: 'location', status: 'matched', points: 10, max_points: 10, reason_code: 'location_matched' },
    { dimension: 'workplace_mode', status: 'unknown', points: 0, max_points: 5, reason_code: 'candidate_workplace_modes_missing' },
    { dimension: 'compensation', status: 'unknown', points: 0, max_points: 10, reason_code: 'compensation_negotiable' },
  ],
};

/** 闭表最长原因之一（compensation_type_mismatch）的合法变体：仅薪资维换 unknown 词 */
const 长原因解释样本 = {
  ...四态解释样本,
  dimensions: [
    ...四态解释样本.dimensions.slice(0, 5),
    { dimension: 'compensation', status: 'unknown', points: 0, max_points: 10, reason_code: 'compensation_type_mismatch' },
  ],
};

/** 已解码样本 → C3 展示模型（组件测试入口统一走真实解码，不手工拼六行） */
function 模型从解释(样本: unknown, 分数: number, 覆盖: Partial<匹配分析模型> = {}): 匹配分析模型 {
  const 解释 = 解匹配解释(样本, 分数);
  if (解释 === null) throw new Error('测试样本必须解码成功');
  return { 分数, 解释, 有限依据: [], 上下文: '有来源', ...覆盖 };
}

/** 有解释的基准模型：四态齐备、分数 35 与分项和一致 */
function 四态模型(覆盖: Partial<匹配分析模型> = {}): 匹配分析模型 {
  return 模型从解释(四态解释样本, 35, 覆盖);
}

describe('匹配分析块 · Spec §4 六维行（四态图标 + 文字 + points/max）', () => {
  it('四态各有独立状态标识（data-状态 四值互不相同），且与状态文字同时存在', () => {
    const { container } = render(<匹配分析块 模型={四态模型()} />);
    const 态值们 = Array.from(container.querySelectorAll('[data-状态]')).map((元) => 元.getAttribute('data-状态'));
    expect([...new Set(态值们)].sort()).toEqual(['matched', 'not_matched', 'partially_matched', 'unknown']);
    // 标识与文字同时存在：四个状态文字全部在场（不只靠图标/颜色区分）。
    // 计数跟样本走：匹配 ×2（方向 + 地点 matched）、未核对 ×2（办公方式 + 薪资 unknown），
    // 部分匹配 / 不匹配 各一次。
    expect(screen.getAllByText('匹配')).toHaveLength(2);
    expect(screen.getAllByText('未核对')).toHaveLength(2);
    expect(screen.getByText('部分匹配')).toBeTruthy();
    expect(screen.getByText('不匹配')).toBeTruthy();
  });

  it('每行显示实际 points/max_points（小号分项），六行按冻结顺序渲染', () => {
    const { container } = render(<匹配分析块 模型={四态模型()} />);
    for (const 分项 of ['25/25', '0/35', '0/15', '10/10', '0/5', '0/10']) {
      expect(screen.getByText(分项)).toBeTruthy();
    }
    // 行数 = 6，不因状态缺失少行
    expect(container.querySelectorAll('[data-状态]')).toHaveLength(6);
    const 全文 = container.textContent ?? '';
    let 上一位 = -1;
    for (const 维度 of ['方向', '技能', '经验', '地点', '办公方式', '薪资']) {
      const 位 = 全文.indexOf(维度);
      expect(位, `缺少维度「${维度}」或顺序不对`).toBeGreaterThan(上一位);
      上一位 = 位;
    }
  });

  it('技能行显示「命中X/Y个岗位关键词」，其他维度不出现命中数', () => {
    const { container } = render(<匹配分析块 模型={四态模型()} />);
    expect(screen.getByText('命中1/100个岗位关键词')).toBeTruthy();
    expect((container.textContent ?? '').match(/个岗位关键词/g)).toHaveLength(1);
    // 92 分样本技能 11/12 同样只出一行命中计数
    const 另一宿主 = render(<匹配分析块 模型={模型从解释(BFF匹配解释92分样本, 92)} />);
    expect(另一宿主.container.textContent ?? '').toContain('命中11/12个岗位关键词');
  });

  it('1/100 命中、0/35 分的技能行仍显示「部分匹配」，不退化为不匹配/未核对', () => {
    const { container } = render(<匹配分析块 模型={四态模型()} />);
    const 技能行 = container.querySelectorAll('[data-状态="partially_matched"]')[0]?.parentElement;
    expect(技能行?.textContent ?? '').toContain('部分匹配');
    expect(技能行?.textContent ?? '').toContain('0/35');
    expect(技能行?.textContent ?? '').not.toContain('不匹配');
    expect(技能行?.textContent ?? '').not.toContain('未核对');
  });

  it('冻结闭表长原因逐字展示、不截断：行注不带单行截断类，全文完整在场', () => {
    const { container } = render(<匹配分析块 模型={模型从解释(长原因解释样本, 35)} />);
    expect(screen.getByText('薪资周期不同，无法直接比较')).toBeTruthy();
    // 找到承载该原因的那一行行注：不挂单行截断类（长原因自然换行）
    const 行注们 = Array.from(container.querySelectorAll('[class*="行注"]'));
    const 目标行注 = 行注们.find((元) => (元.textContent ?? '').includes('薪资周期不同，无法直接比较'));
    expect(目标行注).toBeTruthy();
    expect(目标行注?.className.includes('单行')).toBe(false);
  });

  it('右列原因与状态同时可读：原因说明与状态词同段在场，不互相吞并', () => {
    render(<匹配分析块 模型={四态模型()} />);
    expect(screen.getByText('求职方向与岗位方向匹配')).toBeTruthy();
    expect(screen.getByText('命中部分岗位关键词')).toBeTruthy();
    expect(screen.getByText('经验未满足岗位要求')).toBeTruthy();
  });
});

describe('匹配分析块 · 头行与分数位（藏环 = 弹层文本总分 / 详情唯一环）', () => {
  it('标题「匹配度分析」恒在；新解释下副标「推荐生成时的匹配结果」与技能口径说明在场', () => {
    render(<匹配分析块 模型={四态模型()} />);
    expect(screen.getByText('匹配度分析')).toBeTruthy();
    expect(screen.getByText('推荐生成时的匹配结果')).toBeTruthy();
    expect(screen.getByText('技能按关键词命中核对，不代表能力认证。')).toBeTruthy();
  });

  it('不藏环：非空分是原适配环（44px 详情环），真实 0 正常画 0 分环', () => {
    const { container } = render(<匹配分析块 模型={四态模型({ 分数: 0 })} />);
    expect(screen.getByRole('img', { name: '适配 0 分' })).toBeTruthy();
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(6); // 六态图标 + 环
  });

  it('不藏环：分数 null 显示中性「—」占位（可访问名 匹配分未知），不画假 0 分环', () => {
    render(<匹配分析块 模型={四态模型({ 分数: null })} />);
    expect(screen.getByLabelText('匹配分未知')).toBeTruthy();
    expect(screen.queryByRole('img', { name: /适配/ })).toBeNull();
  });

  it('藏环：文本总分（87 分），不再出现分数环', () => {
    render(<匹配分析块 模型={模型从解释(BFF匹配解释87分样本, 87)} 藏环 />);
    expect(screen.getByText('87 分')).toBeTruthy();
    expect(screen.queryByRole('img', { name: /适配/ })).toBeNull();
  });

  it('藏环：真实 0 是「0 分」不是 —；分数 null 是「—」不冒充 0', () => {
    const 零分宿主 = render(<匹配分析块 模型={四态模型({ 分数: 0 })} 藏环 />);
    expect(screen.getByText('0 分')).toBeTruthy();
    // 两棵树共用 document.body：先卸载零分卡，别让「0 分」串进下个断言
    零分宿主.unmount();
    const 缺分宿主 = render(<匹配分析块 模型={四态模型({ 分数: null })} 藏环 />);
    expect(缺分宿主.getByText('—')).toBeTruthy();
    expect(缺分宿主.queryByText('0 分')).toBeNull();
  });
});

describe('匹配分析块 · 合法缺失（C3：解释 null 不补假状态、有限依据、上下文）', () => {
  it('解释 null：显示「暂无该次匹配的详细分析」，不补六条假状态、不出副标与技能说明', () => {
    const { container } = render(
      <匹配分析块 模型={{ 分数: 87, 解释: null, 有限依据: [], 上下文: '有来源' }} />,
    );
    expect(screen.getByText('暂无该次匹配的详细分析')).toBeTruthy();
    expect(container.querySelector('[data-状态]')).toBeNull();
    expect(screen.queryByText('推荐生成时的匹配结果')).toBeNull();
    expect(screen.queryByText('技能按关键词命中核对，不代表能力认证。')).toBeNull();
    for (const 假状态 of ['不匹配', '未核对', '部分匹配']) {
      expect(screen.queryByText(假状态)).toBeNull();
    }
  });

  it('有旧正向依据：同区标「有限依据」并列出已知原因；文本总分照常', () => {
    const { container } = render(
      <匹配分析块
        模型={{ 分数: 87, 解释: null, 有限依据: ['职位方向匹配', '经验要求匹配'], 上下文: '有来源' }}
        藏环
      />,
    );
    expect(screen.getByText('有限依据')).toBeTruthy();
    expect(screen.getByText('职位方向匹配')).toBeTruthy();
    expect(screen.getByText('经验要求匹配')).toBeTruthy();
    expect(screen.getByText('87 分')).toBeTruthy();
    // 有限依据不是六行分析：仍无状态行、无旧组件的重复分析说明
    expect(container.querySelector('[data-状态]')).toBeNull();
    expect(screen.queryByText('当前接口仅提供部分匹配依据')).toBeNull();
  });

  it('无旧依据：仅缺失说明，无「有限依据」标注', () => {
    render(<匹配分析块 模型={{ 分数: 87, 解释: null, 有限依据: [], 上下文: '有来源' }} />);
    expect(screen.queryByText('有限依据')).toBeNull();
  });

  it('上下文文案：无推荐上下文 / 原推荐不可用 各显示冻结说明', () => {
    render(<匹配分析块 模型={{ 分数: null, 解释: null, 有限依据: [], 上下文: '无推荐上下文' }} />);
    expect(screen.getByText('当前职位没有特定推荐上下文')).toBeTruthy();
    const 不可用 = render(
      <匹配分析块 模型={{ 分数: null, 解释: null, 有限依据: [], 上下文: '原推荐不可用' }} />,
    );
    expect(不可用.getByText('该次推荐上下文已不可用')).toBeTruthy();
  });

  it('有解码解释时不渲染旧依据的重复分析（有限依据标注与统一说明都不出现）', () => {
    render(<匹配分析块 模型={四态模型({ 有限依据: ['职位方向匹配'] })} />);
    expect(screen.queryByText('有限依据')).toBeNull();
    expect(screen.queryByText('当前接口仅提供部分匹配依据')).toBeNull();
    expect(screen.getByText('推荐生成时的匹配结果')).toBeTruthy();
  });
});

describe('匹配分析块 · 只消费模型（不自行推断状态）', () => {
  it('不同解释、不同分数 → 行内容跟随模型，不从分数大小反推状态', () => {
    const 甲 = render(<匹配分析块 模型={模型从解释(BFF匹配解释92分样本, 92)} />);
    const 乙 = render(<匹配分析块 模型={模型从解释(BFF技能部分命中零分解释样本, 65)} />);
    // 92 分样本薪资是部分匹配（薪资范围接近）；65 分样本技能 1/100 命中 0 分仍是部分匹配
    expect(甲.getByText('薪资范围接近')).toBeTruthy();
    expect(乙.getByText('命中1/100个岗位关键词')).toBeTruthy();
    expect(乙.getByText('0/35')).toBeTruthy();
  });

  it('渲染不修改传入模型（只读消费）', () => {
    const 模型 = 四态模型({ 有限依据: ['职位方向匹配'] });
    const 快照 = JSON.stringify(模型);
    render(<匹配分析块 模型={模型} />);
    expect(JSON.stringify(模型)).toBe(快照);
  });

  it('组件内没有任何 button/链接（查看入口在卡片层，不在分析块里），点击文本无副作用', () => {
    const { container } = render(<匹配分析块 模型={四态模型()} />);
    expect(container.querySelectorAll('button, a')).toHaveLength(0);
    fireEvent.click(screen.getByText('匹配度分析'));
  });
});
