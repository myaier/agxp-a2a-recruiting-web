export type 薪资初筛结果 = '有交集' | '无交集' | '待核对';

interface 薪资区间 {
  下限: number;
  上限: number;
  单位: '月薪K' | '元/天' | '元/时';
}

/**
 * 薪资只作为结构化初筛字段：本函数在本方数据域内计算交集，UI 和 Agent 对话只拿结论，
 * 不把候选期望值或岗位预算值传给对方，更不据此发起谈薪。
 */
export function 解析薪资区间(文本: string): 薪资区间 | null {
  // 同时兼容「25-35K」和常见的「25K-35K」写法。
  const 命中 = /(\d+(?:\.\d+)?)\s*[Kk]?\s*[-–—]\s*(\d+(?:\.\d+)?)/.exec(文本);
  if (!命中) return null;
  const 下限 = Number(命中[1]);
  const 上限 = Number(命中[2]);
  if (!Number.isFinite(下限) || !Number.isFinite(上限) || 下限 > 上限) return null;

  const 单位: 薪资区间['单位'] = 文本.includes('元/天')
    ? '元/天'
    : 文本.includes('元/时')
      ? '元/时'
      : '月薪K';
  return { 下限, 上限, 单位 };
}

export function 薪资初筛(候选期望: string | undefined, 岗位预算: string | undefined): 薪资初筛结果 {
  if (!候选期望 || !岗位预算) return '待核对';
  const 候选 = 解析薪资区间(候选期望);
  const 岗位 = 解析薪资区间(岗位预算);
  if (!候选 || !岗位 || 候选.单位 !== 岗位.单位) return '待核对';
  return Math.max(候选.下限, 岗位.下限) <= Math.min(候选.上限, 岗位.上限)
    ? '有交集'
    : '无交集';
}

export function 薪资初筛文案(结果: 薪资初筛结果): string {
  if (结果 === '有交集') return '薪资带有交集';
  if (结果 === '无交集') return '薪资带无交集';
  return '薪资带待核对';
}
