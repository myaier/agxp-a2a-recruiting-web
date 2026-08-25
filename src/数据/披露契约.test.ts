import { describe, expect, it } from 'vitest';
import { 各单阶段小结, 各单阶段对话, 披露四阶段 } from './模拟数据';
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
});