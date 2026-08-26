import { describe, expect, it } from 'vitest';
import { 各单阶段小结, 各单阶段对话, 披露四阶段, 披露偏好初始, 常见问答 } from './模拟数据';
import { 在谈候选列表, 各候选阶段对话 } from './企业端模拟数据';
import { 协议正文 } from '../屏幕/用户协议';

describe('招聘渐进披露契约', () => {
  it('S1 明确递交 PDF 原件并解除姓名和联系方式隐藏', () => {
    const 递交 = 披露四阶段.find((项) => 项.编号 === '递交简历');
    expect(递交?.说明).toContain('PDF 原件');
    expect(递交?.说明).toMatch(/姓名|联系方式/);
    const 协议 = JSON.stringify(协议正文);
    expect(协议).toContain('简历原件成功递交');
    expect(协议).not.toContain('双方身份与联系方式同时互换');
  });

  it('已递交原件的候选有真名，S0 候选仍匿名', () => {
    for (const id of ['A-01', 'A-02', 'A-03', 'B-02']) {
      const 候 = 在谈候选列表.find((条) => 条.编号 === id);
      expect(候?.真名).toBeTruthy();
      expect(候?.真名).not.toBe(候?.代号);
    }
    expect(在谈候选列表.find((候) => 候.编号 === 'A-07')?.真名).toBeNull();
  });

  it('双端 S1 附件说明和对话正文不再声称匿名或隐去联系方式', () => {
    const 企业条们 = Object.values(各候选阶段对话).flatMap((各段) => 各段.递交简历 ?? []);
    const 求职条们 = Object.values(各单阶段对话).flatMap((各段) => 各段.递交简历 ?? []);
    const 小结附件们 = Object.values(各单阶段小结)
      .flat()
      .flatMap((条) => (条.附件?.说明 ? [条.附件.说明] : []));
    const 说明们 = [...企业条们, ...求职条们]
      .flatMap((条) => (条.附件?.说明 ? [条.附件.说明] : []))
      .concat(小结附件们);
    const 正文们 = [...企业条们, ...求职条们].flatMap((条) => (条.内容 ? [条.内容] : []));
    expect(说明们.length).toBeGreaterThan(0);
    expect(说明们.every((说明) => /原件/.test(说明))).toBe(true);
    expect([...说明们, ...正文们].some((文本) => /匿名版|隐去/.test(文本))).toBe(false);
  });

  it('披露偏好与帮助文案不再声称真名/联系方式在意向确认后才给出', () => {
    const 真名 = 披露偏好初始.find((项) => 项.编号 === 'D-01')?.说明 ?? '';
    const 联系 = 披露偏好初始.find((项) => 项.编号 === 'D-02')?.说明 ?? '';
    // S1 原件递交即向招聘方显示
    expect(真名).toMatch(/递交简历|原件/);
    expect(联系).toMatch(/递交简历|原件/);
    // 不再把意向确认当成首次给出真名/联系方式的时点
    expect(真名 + 联系).not.toMatch(/双方确认意向后才露出|确认意向之后才给出|互换是不可逆的/);

    const 问答 = JSON.stringify(常见问答);
    expect(问答).toContain('递交简历');
    expect(问答).not.toContain('双方都确认意向之后才给出');
    expect(问答).not.toContain('换联系方式');
  });
});