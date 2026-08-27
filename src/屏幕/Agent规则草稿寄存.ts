// P6 §7.3：Proposal 原草稿寄存（规则库 / 企业代理设置 两页共用）。
// 公开的 Proposal DTO 不带正文与范围：创建成功后把用户原草稿寄存在 sessionStorage
//（键冻结：agent规则草稿:<proposalId>，值 { subjectId, 文本, 作用域? }，招聘方无 作用域），
// 页面卸载（导航离开）再回来，关闭 failed 卡时仍能原样还原 —— 草稿不再随页面 useState 丢失。
// §8.1 口径不变：这是页面级临时状态，不进 app state、不写 raw snapshot。
// 读写一律 try/catch：隐私模式 / 配额满时静默降级为「无寄存」，行为退回页内寄存同款。
// 还原前必须比对 subjectId：换账号后的失败卡绝不还原上一个账号的草稿（不匹配的键也删掉）。

import type { BFFAgent规则作用域 } from '../数据/BFF契约';

export interface Agent规则草稿寄存 {
  subjectId: string;
  文本: string;
  作用域?: BFFAgent规则作用域;
}

const 草稿键 = (proposalId: string): string => `agent规则草稿:${proposalId}`;

export function 读Agent规则草稿(proposalId: string): Agent规则草稿寄存 | null {
  try {
    const 原文 = window.sessionStorage.getItem(草稿键(proposalId));
    return 原文 === null ? null : (JSON.parse(原文) as Agent规则草稿寄存);
  } catch {
    return null;
  }
}

export function 写Agent规则草稿(proposalId: string, 草稿: Agent规则草稿寄存): void {
  try {
    window.sessionStorage.setItem(草稿键(proposalId), JSON.stringify(草稿));
  } catch {
    // 配额满 / 隐私模式：降级为无寄存（关闭失败卡时没有草稿可还原）
  }
}

export function 删Agent规则草稿(proposalId: string): void {
  try {
    window.sessionStorage.removeItem(草稿键(proposalId));
  } catch {
    // 同上：删除失败等价于无寄存
  }
}
