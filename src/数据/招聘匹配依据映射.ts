// 招聘匹配依据映射（Task 5 / Spec §5、Plan 契约 C）：推荐卡 wire 三键 → 固定六行的
// 有限匹配展示模型。只解释现有响应（highlights 正向原因码、卡顶层 basis 确认事实、
// 薪资关系），不算新分数、不把缺码当未匹配、不保存任何快照。
//
// 输出语义（契约 C 冻结）：
//   · category / experience / location / workplace_mode 的正向码 → positive
//     （经验还必须 structured_requirements_confirmed，否则不作正向声明）；
//   · skills_matched → some_skills「有技能命中」：只说有关键词命中，不声称全部匹配、
//     不推断命中数量；
//   · 薪资 overlap → positive、near_miss → partial（标部分匹配）、unknown → unknown
//     「未核对」；薪资关系与原因矛盾 → not_provided「判定不完整」，不拼造一致性；
//     disjoint 非正常推荐也不自行构造新扣分（说明沿用既有闭表文案，无 penalty 措辞）；
//   · 其他缺码 → not_provided「未提供判定」（missing ≠ unmatched，绝不画成不匹配）；
//   · 未知开放码丢弃且原 token 不进输出；说明文案与共享 亮点文案 / 薪资关系文案 同源，
//     不另立第二份闭表。

import { 亮点文案, 薪资关系文案 } from './发现推荐映射';
import type { BFF招聘候选推荐 } from './BFF契约';

/** 契约 C：六行只读展示模型（维度顺序 = Spec §5 的六维顺序） */
export type 匹配依据行 = {
  维度: 'category' | 'skills' | 'experience' | 'location' | 'workplace_mode' | 'compensation';
  状态: 'positive' | 'some_skills' | 'partial' | 'unknown' | 'not_provided';
  说明: string;
};

/** 薪资关系 wire 枚举（与 BFF招聘候选推荐.compensation_relationship 同源） */
export type 薪资关系 = BFF招聘候选推荐['compensation_relationship'];

/** 映射输入：现有推荐卡的三键，全部必填 —— 缺一样就没有依据可解释，由调用方给 wire 事实 */
export interface 招聘匹配依据输入 {
  /** 推荐批次返回的正向原因码（开放 string，未知码在此丢弃） */
  highlights: readonly string[];
  /** 卡顶层历史 basis：经验正向声明的确认门槛 */
  structuredRequirementsConfirmed: boolean;
  /** 薪资关系（推荐卡 / 详情同键） */
  compensationRelationship: 薪资关系;
}

const 未提供 = (维度: 匹配依据行['维度']): 匹配依据行 => ({ 维度, 状态: 'not_provided', 说明: '未提供判定' });
const 正向 = (维度: 匹配依据行['维度'], 说明: string): 匹配依据行 => ({ 维度, 状态: 'positive', 说明 });

/** 薪资行：先看关系与原因是否矛盾，再按关系落三态；disjoint 不构造新扣分 */
function 薪资行(输入: 招聘匹配依据输入): 匹配依据行 {
  const 有交集码 = 输入.highlights.includes('compensation_overlap');
  const 接近码 = 输入.highlights.includes('compensation_near_miss');
  if (有交集码 && 接近码) {
    // 两个薪资码互相矛盾：不挑边，判定不完整
    return { 维度: 'compensation', 状态: 'not_provided', 说明: '判定不完整' };
  }
  if (有交集码 || 接近码) {
    // 原因码自带关系断言：与关系字段不一致（含 unknown 这种「没核对过」）就不拼造一致性
    const 码关系: 薪资关系 = 有交集码 ? 'overlap' : 'near_miss';
    if (码关系 !== 输入.compensationRelationship) {
      return { 维度: 'compensation', 状态: 'not_provided', 说明: '判定不完整' };
    }
  }
  switch (输入.compensationRelationship) {
    case 'overlap':
      return 正向('compensation', 薪资关系文案.overlap);
    case 'near_miss':
      // partial 标部分匹配：沿用既有 near_miss 闭表文案 + 部分匹配措辞
      return { 维度: 'compensation', 状态: 'partial', 说明: `${薪资关系文案.near_miss}，部分匹配` };
    case 'unknown':
      return { 维度: 'compensation', 状态: 'unknown', 说明: '未核对' };
    case 'disjoint':
      // 非正常推荐：说明 wire 既有闭表文案（无新扣分措辞），不画不匹配、不合成减分
      return { 维度: 'compensation', 状态: 'not_provided', 说明: 薪资关系文案.disjoint };
  }
}

/** wire 三键 → 固定六行（方向/技能/经验/地点/办公方式/薪资）。纯函数，无默认兜底输入。 */
export function 映射招聘匹配依据(输入: 招聘匹配依据输入): 匹配依据行[] {
  const 有 = (码: string) => 输入.highlights.includes(码);
  return [
    有('category_matched') ? 正向('category', 亮点文案.category_matched) : 未提供('category'),
    有('skills_matched')
      ? { 维度: 'skills', 状态: 'some_skills', 说明: '有技能命中' } as const
      : 未提供('skills'),
    有('experience_met') && 输入.structuredRequirementsConfirmed
      ? 正向('experience', 亮点文案.experience_met)
      : 未提供('experience'),
    有('location_matched') ? 正向('location', 亮点文案.location_matched) : 未提供('location'),
    有('workplace_mode_matched')
      ? 正向('workplace_mode', 亮点文案.workplace_mode_matched)
      : 未提供('workplace_mode'),
    薪资行(输入),
  ];
}
