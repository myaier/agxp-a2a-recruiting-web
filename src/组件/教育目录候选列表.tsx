// 教育目录候选列表（Task 5，core editors §5.2；Task 2 起为 目录候选列表 的教育包装）：
// 教育编辑页 学校/专业 候选行的两模式共用列表。候选行 JSX 已提取到共用的
// 目录候选列表（公司选择抽屉复用同一份简单列表），本文件只保留教育侧的
// props/导出与语义注释 —— 教育原 props/导出不变，学校/专业调用方无需新增任何企业参数。

import { 目录候选列表, type 目录候选, type 目录候选列表属性 } from './目录候选列表';

/** 一枚候选展示值：键是稳定键（Backend = 目录 ID，Mock = 局部模拟键），副文只有学校有 */
export type 教育候选 = 目录候选;

/** 正文 props（页面局部契约，不是公共领域模型） */
export type 教育目录候选列表Props = 目录候选列表属性;

export function 教育目录候选列表(props: 教育目录候选列表Props): React.JSX.Element {
  return <目录候选列表 {...props} />;
}