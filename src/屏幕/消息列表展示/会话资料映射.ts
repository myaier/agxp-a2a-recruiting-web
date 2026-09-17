// 会话资料映射（Task 2 共同契约A）：P7 会话列表与真人会话页头共用的对方资料模型。
// 只做纯映射：输入是既有 P5详情（本轮成功快照）、查看者角色、调用方本轮解析的
// 发布企业名（string | null）；不接 wire 新字段、不请求、不建缓存。
// 身份来源铁律（与 use真人会话资料 一致）：
//   · 招聘端 = Case candidateIdentity：anonymous 恒不返回 name/avatar（不拿 Case
//     代号冒充真名）；disclosed 时姓名与头像独立处理，有图无名仍是图。
//     企业 = 同 Case 冻结 jobDetail 的用人企业 display_name（代招不取猎头/发布方，
//     发布企业名参数对招聘端无效）；职位 = 冻结 context.job.job.title。
//   · 候选端 = jobDetail.publisher_profile（姓名/头像/职务）+ 发布企业名参数
//    （当前岗位 publisher_organization_ref → 公开企业 display_name 的可信链），
//     绝不拿用人企业 jobDetail.organization 替代发布方。
// 取姓名首字 只从真实姓名取 trim 后首个 Unicode 码点，缺名为「·」—— 不从 alias、
// 公司、岗位或提示文案推导首字。组装失败/缺值互不串联：任一字段缺席只置 null。

import type { P5详情 } from '../../数据/招聘数据源/MatchCase';
import type { P7角色 } from '../../数据/招聘数据源/真人会话';

/** 列表行与详情页头共用的对方资料（全部可空：null = 本轮未取到，不互相顶替）。 */
export type 真人对方资料 = {
  姓名: string | null;
  头像URL: string | null;
  企业: string | null;
  职位: string | null;
};

/** 资料三态：loading = 本轮补读在飞；unavailable = 失败/失权（不暴露旧资料）。 */
export type 会话资料状态 =
  | { 状态: 'loading' | 'unavailable'; 资料: null }
  | { 状态: 'available'; 资料: 真人对方资料 };

/** trim 后非空才算已知值；空白不得冒充披露（姓名/企业名/头像 URL 同一纪律）。 */
export function 非空(值: string | null | undefined): string | null {
  const 文 = 值?.trim() ?? '';
  return 文 === '' ? null : 文;
}

/** 真实姓名 trim 后首个 Unicode 码点；缺名为「·」（Array.from 不拆代理对）。 */
export function 取姓名首字(name: string | null): string {
  return Array.from(name?.trim() ?? '')[0] ?? '·';
}

/**
 * 从 P5详情（本轮成功快照）组装对方资料 —— 列表与详情页头同一映射，失败不暴露旧资料
 * 由调用方保证（只有本轮成功快照才进本函数）。jobDetail/context 是双角色变体共有
 * 成员、按查看者角色直接取用；candidateIdentity 只存在于 recruiter 变体，角色或详情
 * role 任一不是 recruiter 时身份字段保持 null。
 */
export function 从P5详情取对方资料(
  详情: P5详情,
  角色: P7角色,
  发布企业名: string | null,
): 真人对方资料 {
  if (角色 === 'recruiter') {
    // 招聘端身份只认 Case 作用域 candidateIdentity：anonymous 恒 null/null。
    const 身份 = 详情.role === 'recruiter' ? 详情.candidateIdentity : null;
    const 已披露 = 身份 !== null && 身份.state === 'disclosed';
    return {
      姓名: 已披露 ? 非空(身份.name) : null,
      头像URL: 已披露 ? 非空(身份.avatar_url) : null,
      // 用人企业来自同 Case 冻结 jobDetail；发布企业名参数（猎头/发布方）对招聘端无效
      企业: 非空(详情.jobDetail?.organization?.display_name ?? null),
      职位: 非空(详情.context.job.job.title),
    };
  }
  // 候选端：发布人档案（姓名/头像/职务）+ 本轮解析的发布企业名（可信 publisher 链）
  const 发布人 = 详情.jobDetail?.publisher_profile ?? null;
  return {
    姓名: 非空(发布人?.public_name ?? null),
    头像URL: 非空(发布人?.avatar_url ?? null),
    企业: 非空(发布企业名),
    职位: 非空(发布人?.title ?? null),
  };
}
