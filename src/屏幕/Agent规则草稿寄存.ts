// P6 §7.3：Proposal 原草稿寄存（规则库 / 企业代理设置 两页共用）。
// 公开的 Proposal DTO 不带正文与范围：创建成功后把用户原草稿寄存在 sessionStorage
//（键冻结：agent规则草稿:<proposalId>，值 { subjectId, 文本, 作用域? }，招聘方无 作用域），
// 页面卸载（导航离开）再回来，关闭 failed 卡时仍能原样还原 —— 草稿不再随页面 useState 丢失。
// §8.1 口径不变：这是页面级临时状态，不进 app state、不写 raw snapshot。
// 读写一律 try/catch：隐私模式 / 配额满时 sessionStorage 抛错也不丢字 —— 写永远先落
// 模块级记忆层再试 sessionStorage（review-r3：旧实现直接丢弃草稿，而页面创建成功后已
// 清空 composer，用户立刻丢字）；读先 storage 后记忆层，删两层一起删。
// 还原前必须比对 subjectId：换账号后的失败卡绝不还原上一个账号的草稿（不匹配的键也删掉）；
// subject 随值存储，记忆层与 storage 层过的是同一把栅栏。

import type { BFFAgent规则作用域 } from '../数据/BFF契约';

export interface Agent规则草稿寄存 {
  subjectId: string;
  文本: string;
  作用域?: BFFAgent规则作用域;
}

const 草稿键 = (proposalId: string): string => `agent规则草稿:${proposalId}`;

/** 模块级记忆层：sessionStorage 抛错（隐私模式 / 配额满）时的同进程兜底。 */
const 记忆层 = new Map<string, string>();

export function 读Agent规则草稿(proposalId: string): Agent规则草稿寄存 | null {
  const 键 = 草稿键(proposalId);
  try {
    const 原文 = window.sessionStorage.getItem(键);
    if (原文 !== null) return JSON.parse(原文) as Agent规则草稿寄存;
  } catch {
    // 读 storage 失败：落记忆层
  }
  const 备份 = 记忆层.get(键);
  return 备份 === undefined ? null : (JSON.parse(备份) as Agent规则草稿寄存);
}

export function 写Agent规则草稿(proposalId: string, 草稿: Agent规则草稿寄存): void {
  const 原文 = JSON.stringify(草稿);
  const 键 = 草稿键(proposalId);
  记忆层.set(键, 原文);
  try {
    window.sessionStorage.setItem(键, 原文);
  } catch {
    // 配额满 / 隐私模式：storage 层缺席，记忆层已兜底（关闭失败卡仍可还原）
  }
}

export function 删Agent规则草稿(proposalId: string): void {
  const 键 = 草稿键(proposalId);
  记忆层.delete(键);
  try {
    window.sessionStorage.removeItem(键);
  } catch {
    // 同上：删除失败等价于无寄存
  }
}
